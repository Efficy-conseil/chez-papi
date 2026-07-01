const CONFIG = {
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbzouc3kD6Qc68XzK3Ne_Rlnh5_e5o_IVMkAkHKAXJl-BFrxIIVEj7IS684CugVmh2Qlow/exec',
};

const STATUSES = [
  'Nouvelle demande',
  'À rappeler',
  'Devis à préparer',
  'Devis envoyé',
  'Événement confirmé',
  'Événement terminé',
  'Perdu / Sans suite',
  'Refusé / Complet',
];

const STATUS_LABELS = {
  'Nouvelle demande': 'Nouveau',
  'À rappeler': 'À rappeler',
  'Devis à préparer': 'Réponse à envoyer',
  'Devis envoyé': 'En attente client',
  'Événement confirmé': 'Confirmé',
  'Événement terminé': 'Archivé',
  'Perdu / Sans suite': 'Archivé',
  'Refusé / Complet': 'Refusé / Complet',
};

const state = {
  rows: [],
  view: 'today',
  query: '',
  channel: '',
  status: '',
  selectedId: '',
  saving: false,
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const api = {
  auth() {
    return {
      user: localStorage.getItem('cp_user') || '',
      pass: localStorage.getItem('cp_pass') || '',
    };
  },
  async request(payload) {
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, auth: this.auth() }),
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Réponse serveur invalide');
    }
    if (parsed?.error === 'Non autorisé' || parsed?.ok === false && parsed?.error === 'Non autorisé') {
      throw new Error('Identifiants invalides');
    }
    if (parsed?.ok === false) {
      throw new Error(parsed.error || 'Erreur serveur');
    }
    return parsed?.ok === true ? parsed.data || {} : parsed;
  },
  load() {
    return this.request({ action: 'list' });
  },
  update(id, fields) {
    return this.request({ action: 'update', id_demande: id, fields });
  },
  add(row) {
    return this.request({ action: 'add', row });
  },
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value === 'nouveau' || value === 'nouvelle demande') return 'Nouvelle demande';
  if (['à rappeler', 'a rappeler', 'rappeler'].includes(value)) return 'À rappeler';
  if (['contacté', 'contacte', 'client contacté', 'devis à préparer', 'devis a preparer'].includes(value)) return 'Devis à préparer';
  if (['devis envoyé', 'devis envoye'].includes(value)) return 'Devis envoyé';
  if (['signé', 'signe', 'devis signé', 'devis signe', 'événement confirmé', 'evenement confirme'].includes(value)) return 'Événement confirmé';
  if (['terminé', 'termine', 'événement terminé', 'evenement termine'].includes(value)) return 'Événement terminé';
  if (value.includes('perdu') || value.includes('sans suite')) return 'Perdu / Sans suite';
  if (value.includes('refus') || value === 'complet') return 'Refusé / Complet';
  return status || 'Nouvelle demande';
}

function rowId(row) {
  return String(row.id_demande || row._row || '').trim();
}

function parseLocalDate(value) {
  if (!value) return null;
  let raw = String(value).trim();
  if (raw.includes(' au ')) raw = raw.split(' au ')[0].trim();
  if (/^(?:en\s+)?\d{4}$/i.test(raw)) return null;
  const ymd = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return parseLocalDate(value);
}

function formatDate(value) {
  const date = parseLocalDate(value);
  if (!date) return value || '—';
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
}

function receivedAge(value) {
  const date = parseDateTime(value);
  if (!date) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function daysUntilEvent(row) {
  const date = parseLocalDate(row.date_evenement);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function isArchive(row) {
  return row.statut === 'Événement terminé' || row.statut === 'Perdu / Sans suite' || row.statut === 'Refusé / Complet';
}

function isUrgent(row) {
  const explicit = String(row.urgent || row.urgence || '').toLowerCase();
  if (['true', 'oui', 'urgent', '1'].includes(explicit)) return true;
  const days = daysUntilEvent(row);
  return !isArchive(row) && days !== null && days >= 0 && days <= 30;
}

function needsReply(row) {
  return row.statut === 'Devis à préparer';
}

function eventSummary(row) {
  const type = row.type_evenement || 'Événement';
  const guests = row.nb_convives && row.nb_convives !== '—' ? ` · ${row.nb_convives} pers.` : '';
  return `${type}${guests}`;
}

function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('33')) digits = `0${digits.slice(2)}`;
  if (digits.length === 9) digits = `0${digits}`;
  return digits;
}

function phoneHref(phone) {
  const digits = normalizePhone(phone);
  return digits.length >= 9 ? `tel:${digits}` : '';
}

function channelLabel(row) {
  return row.canal || 'Non renseigné';
}

function channelClass(row) {
  const label = channelLabel(row).toLowerCase();
  if (label.includes('télé') || label.includes('tele')) return 'channel-phone';
  if (label.includes('mail')) return 'channel-email';
  if (label.includes('form')) return 'channel-form';
  if (label.includes('réseau') || label.includes('reseau') || label.includes('social')) return 'channel-social';
  return '';
}

function statusClass(row) {
  if (row.statut === 'Nouvelle demande') return 'status-new';
  if (row.statut === 'À rappeler') return 'status-call';
  if (needsReply(row)) return 'status-reply';
  if (row.statut === 'Événement confirmé') return 'status-confirmed';
  if (isArchive(row)) return 'status-archive';
  return '';
}

function prepareRows(rows) {
  const seen = new Map();
  rows.forEach((row, index) => {
    const clean = { ...row, _row: row._row || index + 2, statut: normalizeStatus(row.statut) };
    const id = rowId(clean);
    if (id) seen.set(id, clean);
  });
  return Array.from(seen.values());
}

function filteredRows() {
  const query = state.query.trim().toLowerCase();
  return state.rows
    .filter(row => {
      if (state.view === 'today') return !isArchive(row) && (row.statut === 'Nouvelle demande' || row.statut === 'À rappeler' || needsReply(row) || isUrgent(row));
      if (state.view === 'new') return row.statut === 'Nouvelle demande';
      if (state.view === 'call') return row.statut === 'À rappeler';
      if (state.view === 'reply') return needsReply(row);
      if (state.view === 'urgent') return isUrgent(row);
      if (state.view === 'soon') {
        const days = daysUntilEvent(row);
        return !isArchive(row) && days !== null && days >= 0 && days <= 30;
      }
      if (state.view === 'archive') return isArchive(row);
      return !isArchive(row);
    })
    .filter(row => !state.channel || channelLabel(row) === state.channel)
    .filter(row => !state.status || row.statut === state.status)
    .filter(row => {
      if (!query) return true;
      const haystack = [
        row.nom_client,
        row.telephone,
        row.email_client,
        row.type_evenement,
        row.lieu_prestation,
        row.message_original,
        row.notes,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (isUrgent(a) !== isUrgent(b)) return isUrgent(a) ? -1 : 1;
      const ad = daysUntilEvent(a);
      const bd = daysUntilEvent(b);
      if (ad !== null && bd !== null) return ad - bd;
      if (ad !== null) return -1;
      if (bd !== null) return 1;
      return String(b.date_reception || '').localeCompare(String(a.date_reception || ''));
    });
}

function counts() {
  const active = state.rows.filter(row => !isArchive(row));
  return {
    today: active.filter(row => row.statut === 'Nouvelle demande' || row.statut === 'À rappeler' || needsReply(row) || isUrgent(row)).length,
    new: active.filter(row => row.statut === 'Nouvelle demande').length,
    call: active.filter(row => row.statut === 'À rappeler').length,
    reply: active.filter(needsReply).length,
    urgent: active.filter(isUrgent).length,
    soon: active.filter(row => {
      const days = daysUntilEvent(row);
      return days !== null && days >= 0 && days <= 30;
    }).length,
  };
}

function renderBadges(row) {
  return [
    isUrgent(row) ? '<span class="badge urgent">Urgent</span>' : '',
    `<span class="badge ${statusClass(row)}">${esc(STATUS_LABELS[row.statut] || row.statut)}</span>`,
  ].filter(Boolean).join('');
}

function renderList() {
  const list = $('#demand-list');
  const rows = filteredRows();
  if (!rows.length) {
    list.innerHTML = '<div class="empty-state">Aucune demande pour cette vue.</div>';
    return;
  }
  list.innerHTML = rows.map(row => {
    const id = rowId(row);
    const action = phoneHref(row.telephone) ? 'Appeler' : row.email_client ? 'Email' : 'Voir';
    return `
      <button class="demand-row ${isUrgent(row) ? 'urgent' : ''} ${state.selectedId === id ? 'active' : ''}" data-id="${esc(id)}">
        <span>
          <span class="contact-name">${esc(row.nom_client || 'Sans nom')} ${isUrgent(row) ? '<span class="badge urgent">Urgent</span>' : ''}</span>
          <span class="event-line">${esc(eventSummary(row))}</span>
          <span class="meta-line">${esc(row.lieu_prestation || 'Lieu non renseigné')}</span>
        </span>
        <span>${renderBadges(row)}</span>
        <span><span class="badge ${channelClass(row)}">${esc(channelLabel(row))}</span></span>
        <span>${esc(receivedAge(row.date_reception))}</span>
        <span>${esc(formatDate(row.date_evenement))}</span>
        <span><span class="row-action">${action}</span></span>
      </button>
    `;
  }).join('');
}

function renderFilters() {
  const channels = Array.from(new Set(state.rows.map(channelLabel).filter(Boolean))).sort();
  const channelSelect = $('#channel-filter');
  const statusSelect = $('#status-filter');
  channelSelect.innerHTML = '<option value="">Tous les canaux</option>' + channels.map(channel => `<option value="${esc(channel)}">${esc(channel)}</option>`).join('');
  statusSelect.innerHTML = '<option value="">Tous les statuts</option>' + STATUSES.map(status => `<option value="${esc(status)}">${esc(STATUS_LABELS[status] || status)}</option>`).join('');
  channelSelect.value = state.channel;
  statusSelect.value = state.status;
}

function renderCounts() {
  const c = counts();
  $('#kpi-new').textContent = c.new;
  $('#kpi-urgent').textContent = c.urgent;
  $('#kpi-call').textContent = c.call;
  $('#kpi-reply').textContent = c.reply;
  $('#kpi-soon').textContent = c.soon;
  $('#nav-today').textContent = c.today;
  $('#nav-new').textContent = c.new;
  $('#nav-call').textContent = c.call;
  $('#nav-reply').textContent = c.reply;
}

function renderTitle() {
  const titles = {
    today: ['À traiter', 'Demandes nouvelles, urgentes ou en attente d’action.'],
    new: ['Nouvelles demandes', 'Demandes entrantes pas encore traitées.'],
    call: ['À rappeler', 'Contacts à rappeler rapidement.'],
    reply: ['Réponse à envoyer', 'Demandes qui attendent un devis ou une réponse.'],
    urgent: ['Urgentes', 'Événements proches ou marqués urgents.'],
    soon: ['Événements dans moins de 30 jours', 'Demandes et prestations à sécuriser vite.'],
    all: ['Toutes les demandes', 'Vue complète des demandes actives.'],
    archive: ['Archives', 'Événements terminés ou sans suite.'],
  };
  const [title, subtitle] = titles[state.view] || titles.today;
  $('#view-title').textContent = title;
  $('#view-subtitle').textContent = subtitle;
  $$('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
}

function renderDetail() {
  const panel = $('#detail-panel');
  const content = $('#detail-content');
  const row = state.rows.find(item => rowId(item) === state.selectedId);
  panel.classList.toggle('has-selection', Boolean(row));
  panel.classList.toggle('open', Boolean(row));
  if (!row) {
    content.innerHTML = '';
    return;
  }
  const phone = phoneHref(row.telephone);
  const email = String(row.email_client || '').trim();
  const emailUrl = row.url_email_origine && String(row.url_email_origine).startsWith('https://mail.google.com/') ? row.url_email_origine : '';
  const driveUrl = row.url_dossier_drive && String(row.url_dossier_drive).startsWith('https://drive.google.com/') ? row.url_dossier_drive : '';
  content.innerHTML = `
    <div class="detail-head">
      <button class="quick-actions drawer-close" id="close-detail-btn">Fermer</button>
      <div class="detail-badges">${renderBadges(row)} <span class="badge ${channelClass(row)}">${esc(channelLabel(row))}</span></div>
      <h2>${esc(row.nom_client || 'Sans nom')}</h2>
      <select id="detail-status">
        ${STATUSES.map(status => `<option value="${esc(status)}" ${row.statut === status ? 'selected' : ''}>${esc(STATUS_LABELS[status] || status)}</option>`).join('')}
      </select>
    </div>
    <section class="detail-section">
      <h3>Contact</h3>
      <div class="field-line"><span>Téléphone</span><strong>${esc(row.telephone || '—')}</strong></div>
      <div class="field-line"><span>Email</span><strong>${esc(email || '—')}</strong></div>
      <div class="quick-actions">
        ${phone ? `<a href="${phone}">Appeler</a>` : ''}
        ${email ? `<a href="mailto:${esc(email)}">Email</a>` : ''}
        ${emailUrl ? `<a href="${esc(emailUrl)}" target="_blank" rel="noopener noreferrer">Fil email</a>` : ''}
        ${driveUrl ? `<a href="${esc(driveUrl)}" target="_blank" rel="noopener noreferrer">Drive</a>` : ''}
      </div>
    </section>
    <section class="detail-section">
      <h3>Événement</h3>
      <div class="field-line"><span>Type</span><strong>${esc(row.type_evenement || '—')}</strong></div>
      <div class="field-line"><span>Date</span><strong>${esc(formatDate(row.date_evenement))}</strong></div>
      <div class="field-line"><span>Convives</span><strong>${esc(row.nb_convives || '—')}</strong></div>
      <div class="field-line"><span>Lieu</span><strong>${esc(row.lieu_prestation || '—')}</strong></div>
      <div class="field-line"><span>Budget</span><strong>${esc(row.budget_estime || '—')}</strong></div>
    </section>
    <section class="detail-section">
      <h3>Message original</h3>
      <p>${esc(row.message_original || 'Aucun message original renseigné.')}</p>
    </section>
    <section class="detail-section">
      <h3>Notes internes</h3>
      <textarea id="detail-notes">${esc(row.notes || '')}</textarea>
      <button class="primary-btn" id="save-notes-btn">Enregistrer les notes</button>
    </section>
  `;
}

function render() {
  renderCounts();
  renderTitle();
  renderList();
  renderDetail();
}

function setView(view) {
  state.view = view;
  localStorage.setItem('cp_v2_view', view);
  render();
}

function showToast(message, type = 'info') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#C43D32' : type === 'success' ? '#28786A' : '#2F241F';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setSync(label) {
  $('#sync-indicator').textContent = label;
}

async function loadData() {
  setSync('Synchronisation...');
  const result = await api.load();
  state.rows = prepareRows(result.rows || []);
  renderFilters();
  render();
  setSync(`Sync. ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
}

async function updateSelected(fields, successMessage) {
  if (state.saving || !state.selectedId) return;
  state.saving = true;
  try {
    await api.update(state.selectedId, fields);
    const row = state.rows.find(item => rowId(item) === state.selectedId);
    if (row) Object.assign(row, fields);
    render();
    showToast(successMessage, 'success');
  } catch (err) {
    showToast(err.message || 'Erreur de sauvegarde', 'error');
  } finally {
    state.saving = false;
  }
}

async function createRequest() {
  const name = prompt('Nom du client ?');
  if (!name) return;
  try {
    await api.add({
      nom_client: name.trim(),
      statut: 'Nouvelle demande',
      canal: 'Saisie manuelle',
      date_reception: new Date().toISOString(),
    });
    await loadData();
    showToast('Demande ajoutée', 'success');
  } catch (err) {
    showToast(err.message || 'Création impossible', 'error');
  }
}

function bindEvents() {
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const user = $('#login-email').value.trim();
    const pass = $('#login-password').value.trim();
    const error = $('#login-error-msg');
    localStorage.setItem('cp_user', user);
    localStorage.setItem('cp_pass', pass);
    error.style.display = 'none';
    try {
      await loadData();
      $('#login-overlay').style.display = 'none';
    } catch (err) {
      localStorage.removeItem('cp_user');
      localStorage.removeItem('cp_pass');
      error.textContent = err.message === 'Identifiants invalides' ? 'Identifiants incorrects.' : 'Connexion impossible.';
      error.style.display = 'block';
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    localStorage.removeItem('cp_user');
    localStorage.removeItem('cp_pass');
    $('#login-overlay').style.display = 'flex';
  });

  $('#refresh-btn').addEventListener('click', () => loadData().catch(err => showToast(err.message, 'error')));
  $('#new-request-btn').addEventListener('click', createRequest);

  $('#search-input').addEventListener('input', event => {
    state.query = event.target.value;
    render();
  });

  $('#channel-filter').addEventListener('change', event => {
    state.channel = event.target.value;
    render();
  });

  $('#status-filter').addEventListener('change', event => {
    state.status = event.target.value;
    render();
  });

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) setView(viewButton.dataset.view);

    const row = event.target.closest('.demand-row');
    if (row) {
      state.selectedId = row.dataset.id;
      render();
    }

    if (event.target.id === 'close-detail-btn') {
      state.selectedId = '';
      render();
    }

    if (event.target.id === 'save-notes-btn') {
      updateSelected({ notes: $('#detail-notes').value }, 'Notes enregistrées');
    }
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'detail-status') {
      updateSelected({ statut: event.target.value }, 'Statut mis à jour');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      state.selectedId = '';
      render();
    }
  });
}

async function init() {
  bindEvents();
  state.view = localStorage.getItem('cp_v2_view') || 'today';
  const user = localStorage.getItem('cp_user');
  const pass = localStorage.getItem('cp_pass');
  if (user && pass) {
    $('#login-overlay').style.display = 'none';
    try {
      await loadData();
    } catch {
      $('#login-overlay').style.display = 'flex';
    }
  } else {
    render();
  }
}

init();
