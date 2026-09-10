import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const frontend = readFileSync('chez-papi/app.js', 'utf8');
function section(start, end) {
  const first = frontend.indexOf(start);
  const last = frontend.indexOf(end, first);
  assert(first >= 0 && last > first, `Section introuvable : ${start}`);
  return frontend.slice(first, last);
}

function fixture() {
  const requests = [];
  const notifications = [];
  let submit;
  const element = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {} },
    setAttribute(key, value) { this[key] = value; }
  });
  const button = { ...element(), id: 'mark-followup-handled-btn', dataset: { followupId: 'TEST-A' } };
  const form = {
    ...element(), values: { notes: 'Notes initiales' },
    querySelector: () => element(),
    addEventListener(type, handler) { submit = handler; }
  };
  const elements = {
    'event-form': form,
    'event-modal': { ...element(), style: { display: 'flex' } },
    'mark-followup-handled-btn': button,
    'kpi-modal': { ...element(), style: { display: 'none' } },
    'kpi-title': element(), 'kpi-thead': element(),
    'kpi-tbody': element(), 'kpi-tfoot': element()
  };
  const context = vm.createContext({
    console, editingRow: 42, initialFormValuesStr: JSON.stringify(form.values), eventSaveInFlight: false,
    appData: [{ _row: 42, id_demande: 'TEST-A', relance_a_traiter: true, statut: 'Devis envoyé', notes: 'Notes initiales' }],
    document: {
      getElementById: id => elements[id],
      querySelectorAll: () => [button]
    },
    FormData: class {
      constructor(target) { this.values = target.values; }
      entries() { return Object.entries(this.values).values(); }
      forEach(fn) { Object.entries(this.values).forEach(([key, value]) => fn(value, key)); }
    },
    SheetsAPI: {
      update(id, fields) {
        return new Promise((resolve, reject) => requests.push({ id, fields, resolve, reject }));
      },
      add() { assert.fail('Aucune nouvelle demande ne doit être créée'); }
    },
    openEventModal() { assert.fail('Le traitement ne doit jamais rouvrir ou réinitialiser la fiche'); },
    renderAll() {}, broadcastSync() {}, hideBusyOverlay() {}, showBusyOverlay() {},
    showNotification: (...args) => notifications.push(args),
    confirm: () => true, setTimeout() {}, parseLocalDate: () => null,
    WAITING_RESPONSE_STATUS: 'En attente de réponse',
    isEventPast: () => false, dateTimeSortValue: () => 0,
    formatDateTimeFR: value => value || '', generateStatusSelectHtml: () => '<select></select>'
  });
  vm.runInContext([
    section('function escHtml(', 'function safeUrl('),
    section('function eventId(', '// Convertit'),
    section('function isTruthy(', 'function clientMessageStar('),
    section('function clientMessageStar(', 'let _completingPastEvents'),
    section('function changedFormFields(', 'function selectedDuplicateCandidate('),
    section('function closeEventModal(', 'function checkDateConflict('),
    section("document.getElementById('event-form').addEventListener('submit'", 'const followupUpdatesInFlight'),
    section('const followupUpdatesInFlight', 'async function deleteCurrentEvent('),
    section('function showKpiModal(', '// ── SIDEBAR MOBILE TOGGLE')
  ].join('\n'), context);
  return { context, form, button, elements, requests, notifications, save: () => submit({ preventDefault() {}, target: form }) };
}

// Reproduction exacte : Enregistrer sans modification pendant une réponse lente.
{
  const f = fixture();
  const pending = f.context.markFollowupHandled();
  assert.equal(f.button.disabled, true);
  await f.save();
  assert.equal(f.context.editingRow, null);
  f.requests[0].resolve({ success: true });
  await pending;
  assert.equal(f.elements['event-modal'].style.display, 'none');
  assert.equal(f.context.appData[0].relance_a_traiter, false);
}

// Une réponse ne doit pas effacer une saisie non enregistrée ; les doubles clics sont ignorés.
{
  const f = fixture();
  const pending = f.context.markFollowupHandled();
  f.form.values.notes = 'Saisie en cours';
  await f.context.markClientMessageHandled('TEST-A');
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ success: true });
  await pending;
  assert.equal(f.form.values.notes, 'Saisie en cours');
  assert.equal(f.context.initialFormValuesStr, '{"notes":"Notes initiales"}');
  assert.equal(f.button.style.display, 'none');
}

// Enregistrement modifié et marquage en parallèle, dans les deux ordres de réponse.
for (const order of [[0, 1], [1, 0]]) {
  const f = fixture();
  const marking = f.context.markFollowupHandled();
  f.form.values.notes = 'Notes enregistrées';
  const saving = f.save();
  assert.equal(f.requests.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[1].fields)), { notes: 'Notes enregistrées' });
  for (const index of order) {
    f.requests[index].resolve({ success: true });
    await Promise.resolve();
  }
  await Promise.all([marking, saving]);
  assert.equal(f.elements['event-modal'].style.display, 'none');
  assert.equal(f.context.appData[0].notes, 'Notes enregistrées');
  assert.equal(f.context.appData[0].relance_a_traiter, false);
}

// Changement de fiche et remplacement des objets par le polling pendant l'attente.
{
  const f = fixture();
  const pending = f.context.markFollowupHandled();
  f.context.closeEventModal(true);
  f.context.appData = [
    { ...f.context.appData[0], _row: 77 },
    { _row: 42, id_demande: 'TEST-B', relance_a_traiter: true }
  ];
  f.context.editingRow = 42;
  f.button.dataset.followupId = 'TEST-B';
  f.elements['event-modal'].style.display = 'flex';
  f.form.values.notes = 'Autre fiche';
  f.requests[0].resolve({ success: true });
  await pending;
  assert.equal(f.context.appData[0].relance_a_traiter, false);
  assert.equal(f.context.appData[1].relance_a_traiter, true);
  assert.equal(f.context.editingRow, 42);
  assert.equal(f.form.values.notes, 'Autre fiche');
  assert.equal(f.button.style.display, 'inline-flex');
}

// Les erreurs conservent le message et permettent de réessayer.
for (const networkError of [false, true]) {
  const f = fixture();
  const pending = f.context.markFollowupHandled();
  if (networkError) f.requests[0].reject(new Error('Délai dépassé'));
  else f.requests[0].resolve({ success: false, error: 'Échec écriture' });
  await pending;
  assert.equal(f.context.appData[0].relance_a_traiter, true);
  assert.equal(f.button.disabled, false);
  assert.equal(f.notifications.at(-1)[1], 'error');
  const retry = f.context.markFollowupHandled();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ success: true });
  await retry;
}

// Le regroupement affiche le message intégral échappé, y compris les fiches closes.
{
  const f = fixture();
  f.context.appData[0].dernier_message_client = 'Texte long\n'.repeat(100) + '<script>FIN</script>';
  f.context.appData[0].statut = 'Perdu / Sans suite';
  f.context.showKpiModal('messages');
  assert(f.elements['kpi-tbody'].innerHTML.includes('Texte long\n'.repeat(100)));
  assert(f.elements['kpi-tbody'].innerHTML.includes('&lt;script&gt;FIN&lt;/script&gt;'));
  assert(f.elements['kpi-thead'].innerHTML.includes('Marquer comme traité'));
  const pending = f.context.markClientMessageHandled('TEST-A');
  f.context.showKpiModal('messages');
  assert(f.elements['kpi-tbody'].innerHTML.includes('Traitement…'));
  f.requests[0].resolve({ success: true });
  await pending;
  assert(f.elements['kpi-tbody'].innerHTML.includes('Aucun message client à traiter'));
  assert.equal(f.context.appData[0].statut, 'Perdu / Sans suite');
}

// Backend réel : marquage seul sans Calendar, autres synchronisations conservées.
const backend = vm.createContext({ Logger: { log() {} } });
vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), backend);
for (const [status, fields, expectedCalendar] of [
  ['Devis envoyé', { relance_a_traiter: false }, 0],
  ['Événement confirmé', { relance_a_traiter: false }, 0],
  ['Perdu / Sans suite', { relance_a_traiter: 'FALSE' }, 0],
  ['Devis envoyé', { statut: 'À rappeler' }, 0],
  ['Devis envoyé', { statut: 'Événement confirmé' }, 1],
  ['Événement confirmé', { statut: 'Perdu / Sans suite' }, 1],
  ['Événement confirmé', { notes: 'Modification' }, 1],
  ['Événement confirmé', { relance_a_traiter: false, notes: 'Modification' }, 1]
]) {
  const headers = ['id_demande', 'statut', 'relance_a_traiter', 'notes', 'derniere_modification'];
  const row = ['TEST-A', status, true, '', ''];
  let calendarCalls = 0;
  let rowHeightCalls = 0;
  backend.getSheet = () => ({
    getLastColumn: () => headers.length,
    getRange(line, column) {
      return {
        getValues: () => [line === 1 ? headers : row],
        getValue: () => row[column - 1],
        setValue(value) { row[column - 1] = value; }
      };
    }
  });
  backend.ensureSchemaHeaders = () => {};
  backend.findRowByDemandId = () => ({ rowIndex: 2 });
  backend.applyDefaultRowHeight = () => rowHeightCalls++;
  backend.SpreadsheetApp = { flush() {} };
  backend.syncCalendarEvent = () => calendarCalls++;
  backend.ok = value => value;
  const result = backend.updateRowById('TEST-A', fields);
  assert.equal(calendarCalls, expectedCalendar, JSON.stringify({ status, fields }));
  assert.equal(result.id_demande, 'TEST-A');
  if (Object.keys(fields).length === 1 && fields.relance_a_traiter !== undefined) {
    assert.equal(row[2], false);
    assert.equal(row[1], status);
    assert.equal(rowHeightCalls, 0);
  }
}

console.log('Tests de traitement des messages réussis (réponses lentes, saisies, navigation, erreurs, contenu intégral et Calendar).');
