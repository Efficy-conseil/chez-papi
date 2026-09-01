import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  Logger: { log() {} },
  Utilities: {
    sleep(duration) { context.sleepDurations.push(duration); }
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput(content) {
      return {
        getContent() { return content; },
        getMimeType() { return this.mimeType; },
        setMimeType(mimeType) { this.mimeType = mimeType; return this; }
      };
    }
  }
});
context.sleepDurations = [];
vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

const getError = evaluate('doGet({})');
assert.deepEqual(JSON.parse(getError.getContent()), { ok: false, error: 'Utilisez POST' });
assert.equal(getError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, [20000]);
context.malformedMakeRequest = {
  postData: {
    contents: `{"action":"checkDuplicate","make_token":"cp_make_followup_2026_06",`
  }
};
const malformedMakeError = evaluate('doPost(malformedMakeRequest)');
assert.equal(JSON.parse(malformedMakeError.getContent()).ok, false);
assert.equal(malformedMakeError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, [20000, 20000]);
assert.equal(evaluate('DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT'), false);
context.validMakeRequest = {
  postData: {
    contents: JSON.stringify({
      action: 'checkDuplicate',
      make_token: 'cp_make_followup_2026_06',
      match: { gmail_message_id: 'TEST-MAKE-ERROR' }
    })
  }
};
const validMakeError = evaluate(`(() => {
    const original = checkDuplicate;
    try {
      checkDuplicate = function() { return ko('Erreur backend Make'); };
      return doPost(validMakeRequest);
    } finally {
      checkDuplicate = original;
    }
  })()`);
assert.deepEqual(JSON.parse(validMakeError.getContent()), { ok: false, error: 'Erreur backend Make' });
assert.equal(validMakeError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, [20000, 20000, 20000]);
assert.equal(evaluate('DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT'), false);
assert.deepEqual(
  JSON.parse(evaluate('ko("Erreur dashboard").getContent()')),
  { ok: false, error: 'Erreur dashboard' }
);

const phoneVariants = [
  '+0683782160',
  '683782160',
  '06 83 78 21 60'
].map(value => evaluate(`normalizePhoneKey(${JSON.stringify(value)})`));
assert.deepEqual(phoneVariants, ['0683782160', '0683782160', '0683782160']);
assert.equal(evaluate('formatFrenchPhone("+33683782160")'), '06 83 78 21 60');
assert.equal(evaluate('formatFrenchPhone("0769893745 / 0665301812")'), '07 69 89 37 45 / 06 65 30 18 12');
assert.equal(evaluate('formatFrenchPhone("+33(0)6 64 35 00 42")'), '06 64 35 00 42');

const headers = [
  'id_demande',
  'nom_client',
  'telephone',
  'email_client',
  'type_evenement',
  'date_evenement',
  'nb_convives',
  'lieu_prestation',
  'statut',
  'canal',
  'notes'
];
const rows = [
  [
    'VOXIST-1',
    'Blanchon',
    '+0683782160',
    '',
    'Mariage',
    'Inconnu / à compléter',
    '40 personnes',
    'à domicile dans le jardin',
    'En attente de réponse',
    'Téléphone',
    ''
  ],
  [
    'MANUAL-1',
    'Delphine',
    '683782160',
    '',
    'Mariage',
    '12/09/2026',
    '40',
    'Entressen',
    'Devis envoyé',
    'Saisie manuelle',
    ''
  ],
  [
    'CLOSED-1',
    'Delphine Blanchon',
    '06 83 78 21 60',
    '',
    'Mariage',
    '12/09/2024',
    '40',
    'Entressen',
    'Événement terminé',
    'Saisie manuelle',
    ''
  ]
];

context.testHeaders = headers;
context.testSheet = {
  getLastRow() {
    return rows.length + 1;
  },
  getLastColumn() {
    return headers.length;
  },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, rows.length);
    const selected = rows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return {
      getValues() {
        return selected;
      },
      getDisplayValues() {
        return selected.map(values => values.map(String));
      }
    };
  }
};

context.testIncoming = {
  nom_client: 'Delphine Blanchon',
  telephone: '0683782160',
  type_evenement: 'Mariage',
  date_evenement: '12/09/2026',
  nb_convives: '40',
  lieu_prestation: 'Entressen'
};

const candidates = evaluate(
  'findDemandMatchCandidates(testSheet, testHeaders, testIncoming, { mode: "manual" })'
);
assert.deepEqual(
  Array.from(candidates, candidate => candidate.id_demande).sort(),
  ['MANUAL-1', 'VOXIST-1']
);
assert(candidates.every(candidate => candidate.reasons.includes('même téléphone')));
assert(!candidates.some(candidate => candidate.id_demande === 'CLOSED-1'));

const phoneMatches = evaluate(
  'findActiveRowsByPhone(testSheet, testHeaders, "06 83 78 21 60")'
);
assert.deepEqual(
  Array.from(phoneMatches, candidate => candidate.id_demande).sort(),
  ['MANUAL-1', 'VOXIST-1']
);

const crossChannelMatches = evaluate(
  'findActiveRowsByPhoneAndEventDate(testSheet, testHeaders, "06 83 78 21 60", "12/09/2026")'
);
assert.deepEqual(
  Array.from(crossChannelMatches, candidate => candidate.id_demande),
  ['MANUAL-1']
);

const borelRows = [
  ['VOXIST-OLD', 'Borel', '06 21 66 22 77', '', 'Entreprise', '19/09/2026', '60 personnes', '', 'Nouvelle demande', 'Téléphone', ''],
  ['VOXIST-NEW', 'M. Borel', '0621662277', '', 'Anniversaire', '19/09/2026', 'environ 60 personnes', '', 'Nouvelle demande', 'Téléphone', '']
];
context.borelSheet = {
  getLastRow() { return borelRows.length + 1; },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, borelRows.length);
    const selected = borelRows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return { getValues() { return selected; }, getDisplayValues() { return selected.map(values => values.map(String)); } };
  }
};
const borelMatches = evaluate(
  'findActiveRowsByPhoneAndEventDate(borelSheet, testHeaders, "06 21 66 22 77", "19/09/2026")'
);
assert.deepEqual(Array.from(borelMatches, candidate => candidate.id_demande), ['VOXIST-OLD', 'VOXIST-NEW']);

context.weakIncoming = {
  nom_client: 'Delphine',
  type_evenement: 'Autres'
};
const weakCandidates = evaluate(
  'findDemandMatchCandidates(testSheet, testHeaders, weakIncoming, { mode: "manual" })'
);
assert.equal(weakCandidates.length, 0);

assert.equal(
  evaluate('normalizePersonName("Bordas Manon")'),
  evaluate('normalizePersonName("Manon BORDAS")')
);

const bordasRows = [
  ['VOXIST-BORDAS', 'Bordas Manon', '06 13 89 02 36', '', 'Mariage', '04/09/2027', '', '', 'Devis à préparer', 'Téléphone', ''],
  ['VOXIST-OTHER', 'Manon Martin', '06 00 00 00 00', '', 'Mariage', '04/09/2027', '', '', 'Devis à préparer', 'Téléphone', '']
];
context.bordasSheet = {
  getLastRow() { return bordasRows.length + 1; },
  getLastColumn() { return headers.length; },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, bordasRows.length);
    const selected = bordasRows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return { getValues() { return selected; }, getDisplayValues() { return selected.map(values => values.map(String)); } };
  }
};
const bordasMatches = evaluate(
  'findDemandMatchCandidates(bordasSheet, testHeaders, { nom_client: "Manon Bordas" }, { mode: "followup" })'
);
assert.deepEqual(Array.from(bordasMatches, candidate => candidate.id_demande), ['VOXIST-BORDAS']);

const activeDateMatches = evaluate(
  'findActiveRowsByEventDate(testSheet, testHeaders, "12/09/2026")'
);
assert.deepEqual(
  Array.from(activeDateMatches, candidate => candidate.id_demande),
  ['MANUAL-1']
);

assert.equal(evaluate('ALLOWED_STATUSES.indexOf("À vérifier") >= 0'), true);
assert.equal(evaluate('sanitizeFields({ statut: "À vérifier" }, false).statut'), 'À vérifier');
assert.equal(evaluate('appendUniqueLine("Note existante", "Note existante")'), 'Note existante');
assert.equal(evaluate('appendUniqueLine("Note existante", "Nouvelle note")'), 'Note existante\nNouvelle note');

context.createMakeDemand = row => ({
  getContent() {
    return JSON.stringify({ data: { id_demande: row.id_demande, created: true } });
  }
});
context.unmatchedRow = {
  id_demande: 'GMAIL-THREAD-81',
  statut: 'Statut inventé',
  notes: 'Information IA',
  message_original: 'Message reçu sans demande correspondante'
};
context.unmatchedFields = {
  gmail_message_id: 'MESSAGE-81',
  dernier_message_client: 'Message reçu sans demande correspondante',
  relance_a_traiter: true
};
const automaticDemand = evaluate('JSON.parse(createUnmatchedFollowupDemand(unmatchedRow, unmatchedFields).getContent()).data');
assert.equal(automaticDemand.updated, true);
assert.equal(automaticDemand.created_from_unmatched_followup, true);
assert.equal(automaticDemand.reason, 'automatic_demand_created');

const capturedAutomaticRow = evaluate(`(() => {
  let captured;
  createMakeDemand = row => {
    captured = row;
    return { getContent: () => JSON.stringify({ data: { id_demande: row.id_demande, created: true } }) };
  };
  createUnmatchedFollowupDemand(unmatchedRow, unmatchedFields);
  return captured;
})()`);
assert.equal(capturedAutomaticRow.statut, 'À vérifier');
assert.equal(capturedAutomaticRow.relance_a_traiter, true);
assert.equal(capturedAutomaticRow.nb_relances_client, 1);
assert.match(capturedAutomaticRow.notes, /créée automatiquement/);

const mergeHeaders = [
  'id_demande', 'nom_client', 'email_client', 'telephone', 'date_evenement',
  'lieu_prestation', 'statut', 'notes', 'message_original', 'gmail_thread_id',
  'gmail_message_id', 'url_email_origine', 'dernier_email_recu_le',
  'dernier_message_client', 'nb_relances_client', 'relance_a_traiter',
  'derniere_modification'
];
const mergeRows = [
  mergeHeaders,
  ['GMAIL-SOURCE', 'Solange Ramero', 'solange@example.com', '', '01/09/2026', 'Salon', 'À vérifier', 'Création automatique', 'Demande de précision', 'THREAD-SOURCE', 'MESSAGE-SOURCE', 'https://mail.google.com/mail/u/0/#inbox/THREAD-SOURCE', '29/08/2026', 'Pouvez-vous confirmer ?', 1, true, ''],
  ['MANUAL-TARGET', 'Solange Ramero', 'solange@example.com', '06 00 00 00 00', '01/09/2026', '', 'Devis envoyé', 'Note cible', 'Demande initiale', '', '', '', '', '', 2, false, '']
];
context.mergeSheet = {
  getLastRow() { return mergeRows.length; },
  getLastColumn() { return mergeHeaders.length; },
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const values = () => mergeRows.slice(row - 1, row - 1 + rowCount).map(line => line.slice(column - 1, column - 1 + columnCount));
    return {
      getValues: values,
      getDisplayValues() { return values().map(line => line.map(value => String(value ?? ''))); },
      getValue() { return mergeRows[row - 1][column - 1]; },
      setValue(value) { mergeRows[row - 1][column - 1] = value; return this; },
      setNumberFormat() { return this; }
    };
  }
};
context.getSheet = () => context.mergeSheet;
context.ensureSchemaHeaders = () => {};
context.applyDefaultRowHeight = () => {};
context.syncCalendarForRow = () => {};
context.mergeSourceId = 'GMAIL-SOURCE';
context.mergeTargetId = 'MANUAL-TARGET';

const firstMerge = evaluate('JSON.parse(mergeDemandRecords(mergeSourceId, mergeTargetId).getContent()).data');
assert.equal(firstMerge.merged, true);
assert.equal(firstMerge.replayed, false);
assert.equal(firstMerge.source_retained, true);
const targetAfterMerge = mergeRows[2];
assert.equal(targetAfterMerge[mergeHeaders.indexOf('statut')], 'Devis envoyé');
assert.equal(targetAfterMerge[mergeHeaders.indexOf('lieu_prestation')], 'Salon');
assert.equal(targetAfterMerge[mergeHeaders.indexOf('dernier_message_client')], 'Pouvez-vous confirmer ?');
assert.equal(targetAfterMerge[mergeHeaders.indexOf('relance_a_traiter')], true);
assert.match(targetAfterMerge[mergeHeaders.indexOf('notes')], /Rattachement manuel depuis GMAIL-SOURCE/);
assert.match(mergeRows[1][mergeHeaders.indexOf('notes')], /Rattachée manuellement à MANUAL-TARGET/);

const targetNotesBeforeReplay = targetAfterMerge[mergeHeaders.indexOf('notes')];
const replayedMerge = evaluate('JSON.parse(mergeDemandRecords(mergeSourceId, mergeTargetId).getContent()).data');
assert.equal(replayedMerge.replayed, true);
assert.equal(targetAfterMerge[mergeHeaders.indexOf('notes')], targetNotesBeforeReplay);

console.log('Tests de rapprochement réussis.');
