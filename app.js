// ── CONFIGURATION ──
// Remplacez cette valeur par l'URL de votre Google Apps Script déployé
const CONFIG = {
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbwnRDJCiVa5y_i2AjDOxmjAl9DMtTitSjPWIOnbvR-OYiKm_ept24UwBE6GJBU93e0Bdg/exec', // Ex: 'https://script.google.com/macros/s/XXXXX/exec'
};

// ── PWA INITIALIZATION ──

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .catch(err => console.error('Service Worker registration failed:', err));

  // Recharge la page quand un nouveau SW prend le contrôle (skipWaiting automatique)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}

// ── PWA INSTALL BANNER ──

const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed_at';
const DISMISS_DURATION_MS   = 30 * 24 * 60 * 60 * 1000;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function wasRecentlyDismissed() {
  const ts = localStorage.getItem(INSTALL_DISMISSED_KEY);
  return ts && (Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS);
}
function markDismissed() {
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
}

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installBtn    = document.getElementById('pwa-install-btn');
const dismissBtn    = document.getElementById('pwa-dismiss-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (window.innerWidth < 900 && !isInStandaloneMode && !wasRecentlyDismissed()) {
    setTimeout(showInstallBanner, 2000);
  }
});
function showInstallBanner() {
  installBanner.style.display = 'block';
  document.querySelector('.content').style.paddingBottom = (60 + 80) + 'px';
}
function hideInstallBanner() {
  installBanner.style.display = 'none';
  document.querySelector('.content').style.paddingBottom = '60px';
}
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideInstallBanner();
});
dismissBtn.addEventListener('click', () => { deferredPrompt = null; markDismissed(); hideInstallBanner(); });

const iosModal     = document.getElementById('pwa-ios-modal');
const iosDismissBtn = document.getElementById('pwa-ios-dismiss-btn');
if (isIOS && !isInStandaloneMode && window.innerWidth < 900 && !wasRecentlyDismissed()) {
  setTimeout(() => { iosModal.style.display = 'flex'; }, 2000);
}
iosDismissBtn.addEventListener('click', () => { markDismissed(); iosModal.style.display = 'none'; });
window.addEventListener('appinstalled', () => { hideInstallBanner(); iosModal.style.display = 'none'; });

// ── HELPERS ──

function formatEuro(n) {
  return (isNaN(n) ? 0 : Math.round(n)).toLocaleString('fr-FR') + ' \u20ac';
}
function formatDateFR(ds) {
  if (!ds) return '';
  try { 
    const cleanDs = String(ds).split('T')[0];
    const d = new Date(cleanDs);
    if (isNaN(d.getTime())) return ds;
    
    const currentYear = new Date().getFullYear();
    const opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== currentYear) {
      opts.year = 'numeric';
    }
    return d.toLocaleDateString('fr-FR', opts); 
  }
  catch { return ds; }
}

const STATUS_PILL = { 'Signé': 'pill-green', 'Devis envoyé': 'pill-gold', 'Contacté': 'pill-gold', 'Nouveau': 'pill-terra', 'Terminé': 'pill-gray', 'Perdu': 'pill-red', 'Prestation en cours': 'pill-green' };
const STATUS_LABEL = { 'Nouveau': '🆕 Nouvelle demande', 'Contacté': '☎️ Client contacté', 'Devis envoyé': '💬 Devis envoyé', 'Signé': '✅ Devis signé', 'Terminé': 'Prestation terminée', 'Perdu': '❌ Client perdu', 'Prestation en cours': '🔄 Prestation en cours' };
const STATUS_DOT   = { 'Signé': 'green', 'Devis envoyé': '', 'Contacté': '', 'Nouveau': 'terra', 'Terminé': 'gray', 'Perdu': 'red', 'Prestation en cours': 'green' };

// Rend un numéro de téléphone ou email cliquable, sinon retourne le texte brut
function formatContact(contact) {
  if (contact === null || contact === undefined || contact === '') return '—';
  const c = String(contact).trim();
  if (!c) return '—';
  const digits = c.replace(/\D/g, '');
  if (!c.includes('@') && digits.length >= 6) {
    return `<a href="tel:${digits}" style="color:inherit;text-decoration:none;">${c}</a>`;
  }
  if (c.includes('@') && c.includes('.')) {
    return `<a href="mailto:${c}" style="color:inherit;text-decoration:none;">${c}</a>`;
  }
  return c;
}

// ── SYNC INDICATOR ──

let lastSyncTime = null;
let lastSyncOk = null;

function updateSyncIndicator() {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  if (lastSyncOk === null) { el.innerHTML = ''; return; }
  if (!lastSyncOk) { el.innerHTML = '<span class="sync-offline">● Hors ligne</span>'; return; }
  const mins = Math.floor((Date.now() - lastSyncTime) / 60000);
  const timeStr = mins < 1 ? 'à l\'instant' : `il y a ${mins} min`;
  el.innerHTML = `<span class="sync-ok">● Sync. ${timeStr}</span>`;
}
setInterval(updateSyncIndicator, 60000);

// ── NOTIFICATIONS PUSH ──

const SEEN_EVENTS_KEY = 'chez_papi_seen_events';
let notifPermissionRequested = false;

function requestNotifPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default' || notifPermissionRequested) return;
  notifPermissionRequested = true;
  Notification.requestPermission().catch(() => {});
}

function checkNewEvents(rows) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const seen = new Set(JSON.parse(localStorage.getItem(SEEN_EVENTS_KEY) || '[]'));
  const newLeads = rows.filter(r => r['Statut traitement'] === 'Nouveau' && !seen.has(String(r._row)));
  newLeads.forEach(r => {
    const budget = parseFloat(r['Budget estimé (€)']) || 0;
    const body = `${r['Nom client']} · ${r['Type d\'événement'] || ''}${budget ? ' · ' + formatEuro(budget) : ''}`;
    const tag = 'lead-' + r._row;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: 'Nouvelle demande', body, tag });
    } else {
      new Notification('Nouvelle demande', { body, icon: './icon-192x192.png', tag }).catch(() => {});
    }
    seen.add(String(r._row));
  });
  localStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify([...seen]));
}

// ── SHEETS API ──

const SheetsAPI = {
  async load() {
    if (!CONFIG.SHEETS_URL) return null;
    const res = await fetch(CONFIG.SHEETS_URL + '?action=getAll', { redirect: 'follow' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error('SheetsAPI: réponse non-JSON :', text.slice(0, 300));
      throw new Error('Réponse invalide du serveur (non-JSON)');
    }
  },
  async add(row) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'add', row }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Réponse invalide : ' + text.slice(0, 100)); }
  },
  async update(rowIndex, fields) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'update', rowIndex, fields }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Réponse invalide : ' + text.slice(0, 100)); }
  },
  async remove(rowIndex) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'delete', rowIndex }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Réponse invalide : ' + text.slice(0, 100)); }
  }
};

// ── APP DATA ──

let appData = [];

function isEventPast(e) {
  if (!e['Date de l\'événement']) return false;
  const d = new Date(String(e['Date de l\'événement']).split('T')[0]);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  return d.getTime() < today.getTime();
}

async function loadData() {
  if (!CONFIG.SHEETS_URL) { renderAll(); return; }
  setConnectionStatus('loading');
  setLoading(true);
  try {
    const result = await SheetsAPI.load();
    if (result && result.rows) {
      appData = result.rows;
      lastSyncTime = Date.now(); lastSyncOk = true; updateSyncIndicator();
      setConnectionStatus('ok', result.rows.length);
      checkNewEvents(result.rows);
      requestNotifPermission();
      renderAll();
    } else {
      const msg = result?.error || 'Réponse inattendue';
      console.error('loadData: erreur API :', msg, result);
      lastSyncOk = false; updateSyncIndicator();
      setConnectionStatus('error', msg);
      showNotification('Erreur Google Sheet : ' + msg, 'error');
    }
  } catch (err) {
    console.error('loadData:', err);
    lastSyncOk = false; updateSyncIndicator();
    setConnectionStatus('error', err.message);
    showNotification(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function setConnectionStatus(state, info = '') {
  const el = document.getElementById('accueil-sub');
  if (!el) return;
  if (state === 'loading') { el.textContent = 'Connexion…'; el.style.color = ''; }
  else if (state === 'ok')  { el.textContent = ''; }
  else { el.textContent = '⚠ ' + info; el.style.color = 'var(--red-soft)'; }
}

function setLoading(on) {
  document.querySelectorAll('.btn-refresh').forEach(b => {
    b.textContent = on ? '\u2026' : '\u21bb';
    b.disabled = on;
  });
}

function renderAll() {
  try { renderDashboard(); } catch(e) { console.error('renderDashboard:', e); }
  try { renderPipeline(); } catch(e) { console.error('renderPipeline:', e); }
  try { renderClients(); } catch(e) { console.error('renderClients:', e); }
  try { if (typeof renderHistorique === 'function') renderHistorique(); } catch(e) { console.error('renderHistorique:', e); }
}

// ── RENDER: DASHBOARD ──

function renderDashboard() {
  const currentYear = new Date().getFullYear();
  const yearlySigned = appData.filter(e => {
    if (e['Statut traitement'] !== 'Signé') return false;
    if (!e['Date de l\'événement']) return false;
    const d = new Date(String(e['Date de l\'événement']).split('T')[0]);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
  });
  const caConf = yearlySigned.reduce((s, e) => s + (parseFloat(e['Budget estimé (€)']) || 0), 0);

  const actives = appData.filter(e => !isEventPast(e));
  const confirmes = actives.filter(e => e['Statut traitement'] === 'Signé');
  const devisEnv  = actives.filter(e => e['Statut traitement'] === 'Devis envoyé');

  const nouveaux = actives.filter(e => e['Statut traitement'] === 'Nouveau');

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-ca-val',          formatEuro(caConf));
  set('kpi-confirmes-val',   confirmes.length || '—');
  set('kpi-confirmes-delta', devisEnv.length + ' en cours de devis');
  set('kpi-devis-val',       devisEnv.length || '—');
  set('kpi-leads-val',       nouveaux.length || '—');


  // ── Carte 1 : Demandes en cours (Nouveau / Contacté / Devis envoyé)
  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const PIPELINE_SCOPE_HOME = ['Nouveau', 'Contacté', 'Devis envoyé'];
  const demandesHome = actives
    .filter(e => PIPELINE_SCOPE_HOME.includes(e['Statut traitement']) && e['Date de l\'événement'])
    .sort((a, b) => (a['Date de l\'événement'] || '').localeCompare(b['Date de l\'événement'] || ''))
    .slice(0, 6);

  const tbody = document.getElementById('upcoming-tbody');
  if (!tbody) return;

  if (!CONFIG.SHEETS_URL) {
    tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">\u2699 Configurez CONFIG.SHEETS_URL dans app.js</td></tr>';
    return;
  }
  if (!demandesHome.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">Aucune demande en cours</td></tr>';
  } else {
    tbody.innerHTML = demandesHome.map(e => {
      const budget = parseFloat(e['Budget estimé (€)']);
      const d = new Date(String(e['Date de l\'événement']).split('T')[0]);
      const diffDays = Math.ceil((d.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      const urgClass = diffDays <= URGENCE_JOURS_URGENT ? 'row-urgent' : diffDays <= URGENCE_JOURS_PRIORITAIRE ? 'row-prio' : '';
      return `<tr class="${urgClass}" style="cursor:pointer" onclick="openEventModal(${e._row})">
        <td><strong>${formatDateFR(e['Date de l\'événement'])}</strong></td>
        <td>${e['Nom client']}</td>
        <td>${budget ? formatEuro(budget) : '—'}</td>
        <td><span class="pill ${STATUS_PILL[e['Statut traitement']] || 'pill-gray'}">${STATUS_LABEL[e['Statut traitement']] || e['Statut traitement']}</span></td>
      </tr>`;
    }).join('');
  }

  // ── Carte 2 : Prestations en cours (Signé / Prestation en cours)
  const prestationsHome = actives
    .filter(e => e['Statut traitement'] === 'Signé' || e['Statut traitement'] === 'Prestation en cours')
    .sort((a, b) => (a['Date de l\'événement'] || '').localeCompare(b['Date de l\'événement'] || ''))
    .slice(0, 5);

  const actEl = document.getElementById('recent-activity');
  if (actEl) {
    if (!prestationsHome.length) {
      actEl.innerHTML = '<div class="act-time" style="padding:12px 0;color:var(--muted);">Aucune prestation en cours</div>';
    } else {
      const thead = '<table class="tbl tbl-sm"><thead><tr><th style="width:22%">Date</th><th style="width:36%">Client</th><th style="width:20%">€</th><th style="width:22%">Statut</th></tr></thead><tbody>';
      actEl.innerHTML = thead + prestationsHome.map(e => {
        const budget = parseFloat(e['Budget estimé (€)']);
        return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
          <td><strong>${formatDateFR(e['Date de l\'événement'])}</strong></td>
          <td>${e['Nom client']}</td>
          <td>${budget ? formatEuro(budget) : '—'}</td>
          <td><span class="pill ${STATUS_PILL[e['Statut traitement']] || 'pill-gray'}">${STATUS_LABEL[e['Statut traitement']] || e['Statut traitement']}</span></td>
        </tr>`;
      }).join('') + '</tbody></table>';
    }
  }
}

// ── RENDER: PIPELINE (STATUT DES DEMANDES) ──

const URGENCE_JOURS_URGENT = 15;
const URGENCE_JOURS_PRIORITAIRE = 45;
const URGENCE_SEUIL_CA = 3000;

const PIPELINE_COLS = [
  { label: 'Urgent',      id: 'urgent'      },
  { label: 'Prioritaire', id: 'prioritaire' },
  { label: 'Important',   id: 'important'   },
  { label: 'Normal',      id: 'normal'      },
];

const ALL_STATUSES = ['Nouveau', 'Contacté', 'Devis envoyé', 'Signé', 'Prestation en cours', 'Terminé', 'Perdu'];

function renderPipeline() {
  const el = document.getElementById('pipeline');
  if (!el) return;

  if (!CONFIG.SHEETS_URL) {
    el.innerHTML = '<div class="pipe-empty-state">\u2699 Renseignez <code>CONFIG.SHEETS_URL</code> dans app.js</div>';
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  // Scope: Nouveau, Contacté, Devis envoyé uniquement
  const PIPELINE_SCOPE = ['Nouveau', 'Contacté', 'Devis envoyé'];
  const colsData = { 'urgent': [], 'prioritaire': [], 'important': [], 'normal': [] };

  appData.forEach(e => {
    if (!PIPELINE_SCOPE.includes(e['Statut traitement'])) return;
    if (isEventPast(e)) return;

    if (!e['Date de l\'événement']) { colsData['normal'].push(e); return; }
    const d = new Date(String(e['Date de l\'événement']).split('T')[0]);
    if (isNaN(d.getTime())) { colsData['normal'].push(e); return; }

    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const budget = parseFloat(e['Budget estimé (€)']) || 0;

    if (diffDays <= URGENCE_JOURS_URGENT) {
      colsData['urgent'].push(e);
    } else if (diffDays <= URGENCE_JOURS_PRIORITAIRE) {
      colsData['prioritaire'].push(e);
    } else if (budget >= URGENCE_SEUIL_CA) {
      colsData['important'].push(e);
    } else {
      colsData['normal'].push(e);
    }
  });

  el.innerHTML = PIPELINE_COLS.map(col => {
    const events = colsData[col.id];

    const cards = events.map(e => {
      const options = ALL_STATUSES.map(s =>
        `<option value="${s}"${s === e['Statut traitement'] ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`
      ).join('');

      // Badge ancienneté pour Nouveau / Contacté
      let ageBadge = '';
      if ((e['Statut traitement'] === 'Nouveau' || e['Statut traitement'] === 'Contacté') && e['Date de la demande']) {
        const hours = Math.floor((Date.now() - new Date(String(e['Date de la demande']).split('T')[0]).getTime()) / 3600000);
        let badgeColor = hours < 24 ? '#4A6741' : hours < 72 ? '#B8860B' : '#C0453A';
        let badgeText = hours < 24 ? `Reçu il y a ${hours}h` : `Reçu il y a ${Math.floor(hours/24)} jour${Math.floor(hours/24) > 1 ? 's' : ''}`;
        ageBadge = `<div style="font-size:10px;font-weight:600;color:${badgeColor};margin-top:4px;">${badgeText}</div>`;
      }

      const contactRaw = e['Contact'] ? formatContact(e['Contact']) : '';
      const emailRaw   = e['Email client'] ? formatContact(e['Email client']) : '';
      const contactLine = [contactRaw, emailRaw].filter(v => v && v !== '—').join(' · ');

      return `
      <div class="pipe-card" onclick="openEventModal(${e._row})">
        <div class="pipe-client">${e['Nom client']}</div>
        <div class="pipe-event">${e['Type d\'événement']} \xb7 ${e['Nb convives']} pers.${e['Date de l\'événement'] ? ' \xb7 ' + formatDateFR(e['Date de l\'événement']) : ''}</div>
        ${contactLine ? `<div class="pipe-contact" onclick="event.stopPropagation()">${contactLine}</div>` : ''}
        <div class="pipe-footer" style="padding-top: 8px;">
          <div>
            <span class="pipe-amount" style="font-size:12px">${formatEuro(parseFloat(e['Budget estimé (€)']) || 0)}</span>
            ${ageBadge}
          </div>
          <select class="pipe-status-sel pill ${STATUS_PILL[e['Statut traitement']] || 'pill-gray'}" style="border:none; outline:none; cursor:pointer; font-family:inherit;" onchange="updateEventStatus(this,${e._row})" onclick="event.stopPropagation()">
            ${options}
          </select>
        </div>
      </div>`;
    }).join('') || '<div class="pipe-card-empty">\u2014</div>';

    return `<div class="pipe-col">
      <div class="pipe-header">${col.label} <span class="pipe-count">${events.length}</span></div>
      ${cards}
    </div>`;
  }).join('');
}

async function updateEventStatus(selectEl, rowIndex) {
  const newStatus = selectEl.value;
  selectEl.disabled = true;
  try {
    const result = await SheetsAPI.update(rowIndex, { 'Statut traitement': newStatus });
    if (result.success) {
      const row = appData.find(e => e._row === rowIndex);
      if (row) row['Statut traitement'] = newStatus;
      renderPipeline(); renderDashboard();
      showNotification('Statut mis à jour', 'success');
    } else {
      selectEl.disabled = false;
      showNotification('Erreur : ' + (result.error || 'inconnue'), 'error');
    }
  } catch {
    selectEl.disabled = false;
    showNotification('Erreur réseau', 'error');
  }
}

// ── RENDER: CLIENTS (Prestations en cours) ──

function renderClients() {
  const container = document.getElementById('clients-cards');
  const sub       = document.getElementById('clients-sub');
  if (!container) return;

  if (!CONFIG.SHEETS_URL || !appData.length) {
    if (sub) sub.textContent = 'Non connecté';
    container.innerHTML = '<div class="tbl-empty" style="padding:20px;">Aucune donnée</div>';
    return;
  }

  const prestations = appData
    .filter(e => (e['Statut traitement'] === 'Signé' || e['Statut traitement'] === 'Prestation en cours') && !isEventPast(e))
    .sort((a, b) => (a['Date de l\'événement'] || '').localeCompare(b['Date de l\'événement'] || ''));

  if (sub) sub.textContent = `${prestations.length} prestation${prestations.length > 1 ? 's' : ''} en cours`;

  if (!prestations.length) {
    container.innerHTML = '<div class="tbl-empty" style="padding:20px;">Aucune prestation en cours</div>';
    return;
  }

  container.innerHTML = prestations.map(e => {
    const budget = parseFloat(e['Budget estimé (€)']) || 0;
    const pill   = `<span class="pill ${STATUS_PILL[e['Statut traitement']] || 'pill-gray'}">${STATUS_LABEL[e['Statut traitement']] || e['Statut traitement']}</span>`;
    const contact = e['Contact'] ? formatContact(e['Contact']) : '';
    const email   = e['Email client'] ? formatContact(e['Email client']) : '';
    const contactLine = [contact, email].filter(v => v && v !== '—').join(' · ');
    return `<div class="prestation-card">
      <div class="pc-header" onclick="openEventModal(${e._row})" style="cursor:pointer">
        <div class="pc-line1"><strong>${e['Nom client']}</strong> · ${e['Type d\'événement'] || '—'} · <em>${formatDateFR(e['Date de l\'événement'])}</em></div>
        <div class="pc-line2">${budget ? formatEuro(budget) : '—'} &nbsp;${pill}</div>
        ${contactLine ? `<div class="pc-contact">${contactLine}</div>` : ''}
      </div>
      <div class="pc-todos" id="todos-${e._row}"></div>
      <div class="pc-todo-add">
        <input type="text" class="pc-todo-input" id="todo-input-${e._row}" placeholder="Ajouter une tâche…" onkeydown="if(event.key==='Enter'){event.preventDefault();addTodo(${e._row});}">
        <button class="pc-todo-btn" onclick="addTodo(${e._row})">+</button>
      </div>
    </div>`;
  }).join('');

  prestations.forEach(e => renderTodos(e._row));
}

function getTodos(rowId) {
  try { return JSON.parse(localStorage.getItem('todos_' + rowId) || '[]'); } catch { return []; }
}
function saveTodos(rowId, todos) {
  localStorage.setItem('todos_' + rowId, JSON.stringify(todos));
}
function renderTodos(rowId) {
  const el = document.getElementById('todos-' + rowId);
  if (!el) return;
  const todos = getTodos(rowId);
  el.innerHTML = todos.map((t, i) => `
    <div class="pc-todo-item">
      <input type="checkbox" ${t.done ? 'checked' : ''} onclick="toggleTodo(${rowId},${i})">
      <span class="pc-todo-text${t.done ? ' done' : ''}">${t.text}</span>
      <button class="pc-todo-del" onclick="deleteTodo(${rowId},${i})">✕</button>
    </div>`).join('');
}
function addTodo(rowId) {
  const input = document.getElementById('todo-input-' + rowId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const todos = getTodos(rowId);
  todos.push({ text, done: false });
  saveTodos(rowId, todos);
  input.value = '';
  renderTodos(rowId);
}
function toggleTodo(rowId, index) {
  const todos = getTodos(rowId);
  if (todos[index]) { todos[index].done = !todos[index].done; saveTodos(rowId, todos); renderTodos(rowId); }
}
function deleteTodo(rowId, index) {
  const todos = getTodos(rowId);
  todos.splice(index, 1);
  saveTodos(rowId, todos);
  renderTodos(rowId);
}

// ── RENDER: HISTORIQUE ──

let historiqueFilter   = 'all';
let historiqueDateFrom = null;
let historiqueDateTo   = null;

function setHistoriqueFilter(filter, btn) {
  historiqueFilter   = filter;
  historiqueDateFrom = null;
  historiqueDateTo   = null;
  const df = document.getElementById('hist-date-from');
  const dt = document.getElementById('hist-date-to');
  if (df) df.value = '';
  if (dt) dt.value = '';
  document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistorique();
}

function applyHistoriqueDateRange() {
  historiqueFilter   = 'range';
  historiqueDateFrom = document.getElementById('hist-date-from')?.value || null;
  historiqueDateTo   = document.getElementById('hist-date-to')?.value   || null;
  document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.remove('active'));
  renderHistorique();
}

function getFilteredHistorique() {
  const allPast = appData
    .filter(e => isEventPast(e))
    .sort((a, b) => (b['Date de l\'événement'] || '').localeCompare(a['Date de l\'événement'] || ''));

  if (historiqueFilter === 'all') return allPast;

  const quarters = { T1: ['01','02','03'], T2: ['04','05','06'], T3: ['07','08','09'], T4: ['10','11','12'] };

  if (historiqueFilter === '2026') {
    return allPast.filter(e => String(e['Date de l\'événement'] || '').startsWith('2026-'));
  }
  if (quarters[historiqueFilter]) {
    const months = quarters[historiqueFilter];
    return allPast.filter(e => {
      const ds = String(e['Date de l\'événement'] || '').split('T')[0];
      return ds.startsWith('2026-') && months.includes(ds.slice(5, 7));
    });
  }
  if (historiqueFilter === 'range') {
    return allPast.filter(e => {
      const ds = String(e['Date de l\'événement'] || '').split('T')[0];
      if (historiqueDateFrom && ds < historiqueDateFrom) return false;
      if (historiqueDateTo   && ds > historiqueDateTo)   return false;
      return true;
    });
  }
  return allPast;
}

function renderHistorique() {
  const tbody = document.getElementById('historique-tbody');
  const sub   = document.getElementById('historique-sub');
  if (!tbody) return;

  const pastEvents = getFilteredHistorique();
  if (sub) sub.textContent = `${pastEvents.length} événement${pastEvents.length > 1 ? 's' : ''}`;

  if (!pastEvents.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="tbl-empty">Aucun événement passé</td></tr>';
    return;
  }

  tbody.innerHTML = pastEvents.map(e => {
    const notes  = String(e['Notes'] || '');
    const notesTrunc = notes.length > 40 ? notes.slice(0, 40) + '…' : notes;
    const budget = parseFloat(e['Budget estimé (€)']);
    return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
      <td><strong>${formatDateFR(e['Date de l\'événement'])}</strong></td>
      <td>${e['Nom client']}</td>
      <td>${e['Type d\'événement'] || '—'}</td>
      <td>${e['Lieu de la prestation'] || '—'}</td>
      <td>${e['Nb convives'] || '—'}</td>
      <td>${budget ? formatEuro(budget) : '—'}</td>
      <td><span class="pill ${STATUS_PILL[e['Statut traitement']] || 'pill-gray'}">${STATUS_LABEL[e['Statut traitement']] || e['Statut traitement']}</span></td>
      <td>${e['Email client'] ? formatContact(e['Email client']) : '—'}</td>
      <td>${formatContact(e['Contact'] || '')}</td>
      <td title="${notes}">${notesTrunc || '—'}</td>
    </tr>`;
  }).join('');
}

function exportHistoriqueCSV() {
  const rows = getFilteredHistorique();
  const BOM  = '\uFEFF';
  const esc  = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const headers = ['Date','Client','Type','Lieu','Couverts','Budget','Statut','Email','Contact','Notes'];
  const lines = [headers.join(';')].concat(rows.map(e => [
    String(e['Date de l\'événement'] || '').split('T')[0],
    e['Nom client'],
    e['Type d\'événement'] || '',
    e['Lieu de la prestation'] || '',
    e['Nb convives'] || '',
    parseFloat(e['Budget estimé (€)']) || '',
    e['Statut traitement'] || '',
    e['Email client'] || '',
    e['Contact'] || '',
    e['Notes'] || ''
  ].map(esc).join(';')));
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `chez-papi-historique-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── FINANCES REMOVED ──

// ── EVENT MODAL ──

let editingRow = null;
let formMode = 'quick'; // 'quick' | 'full'

function applyFormMode() {
  const section = document.getElementById('form-full-section');
  const link    = document.getElementById('form-toggle-link');
  if (section) section.style.display = formMode === 'full' ? 'block' : 'none';
  if (link)    link.textContent = formMode === 'full' ? '← Saisie rapide' : 'Compléter la fiche →';
}

function toggleFormMode(e) {
  e?.preventDefault();
  formMode = formMode === 'quick' ? 'full' : 'quick';
  applyFormMode();
}

function closeViewModal() {
  const v = document.getElementById('view-modal');
  if (v) v.style.display = 'none';
  editingRow = null;
}

function showViewModal(rowIndex) {
  editingRow = rowIndex;
  const data = appData.find(e => e._row === rowIndex);
  if (!data) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  
  set('view-date-evt', formatDateFR(data['Date de l\'événement']));
  set('view-client', data['Nom client']);
  set('view-type', data['Type d\'événement']);
  set('view-invites', data['Nb convives']);
  set('view-budget', formatEuro(parseFloat(data['Budget estimé (€)']) || 0));
  set('view-statut', STATUS_LABEL[data['Statut traitement']] || data['Statut traitement']);
  const contactEl = document.getElementById('view-contact');
  if (contactEl) contactEl.innerHTML = formatContact(data['Contact'] || '');
  const emailEl = document.getElementById('view-email');
  if (emailEl) emailEl.innerHTML = formatContact(data['Email client'] || '');
  set('view-lieu', data['Lieu de la prestation']);
  set('view-notes', data['Notes']);

  document.getElementById('view-modal').style.display = 'flex';
}

function openEventModal(rowIndex = null, forceEdit = false) {
  if (rowIndex && !forceEdit) {
    showViewModal(rowIndex);
    return;
  }

  closeViewModal();
  editingRow = rowIndex;

  const modal = document.getElementById('event-modal');
  document.getElementById('modal-title').textContent = rowIndex ? "Modifier l'événement" : 'Nouvel événement';

  const form = document.getElementById('event-form');
  form.reset();

  if (rowIndex) {
    const data = appData.find(e => e._row === rowIndex);
    if (data) {
      for (const el of form.elements) {
        if (el.name && data[el.name] !== undefined) {
          let val = data[el.name];
          if (el.type === 'date' && val) {
            val = String(val).split('T')[0];
          }
          el.value = val;
        }
      }
    }
  } else {
    form.elements['Date de la demande'].value = new Date().toISOString().split('T')[0];
    form.elements['Statut traitement'].value  = 'Nouveau';
  }

  const btnDel = document.getElementById('btn-delete-event');
  if (btnDel) btnDel.style.display = rowIndex ? 'block' : 'none';

  // Quick mode pour nouvelle saisie, full mode pour édition
  formMode = rowIndex ? 'full' : 'quick';
  applyFormMode();

  // Réinitialiser la bannière conflit de date
  const conflictBanner = document.getElementById('date-conflict-banner');
  if (conflictBanner) conflictBanner.style.display = 'none';

  modal.style.display = 'flex';
}

function closeEventModal() {
  document.getElementById('event-modal').style.display = 'none';
  editingRow = null;
}

function checkDateConflict(dateValue) {
  const banner = document.getElementById('date-conflict-banner');
  if (!banner) return;
  if (!dateValue) { banner.style.display = 'none'; return; }

  const conflicts = appData.filter(e => {
    if (editingRow && e._row === editingRow) return false;
    if (!['Signé', 'Prestation en cours'].includes(e['Statut traitement'])) return false;
    return String(e['Date de l\'événement'] || '').split('T')[0] === dateValue;
  });

  banner.style.display = 'block';
  if (conflicts.length) {
    const c = conflicts[0];
    banner.style.cssText = 'display:block;padding:8px 12px;border-radius:4px;font-size:12px;margin:4px 0 8px;background:rgba(245,166,35,0.15);color:#B86A00;border:1px solid rgba(245,166,35,0.4);';
    banner.textContent = `⚠️ ${c['Nom client']} (${c['Type d\'événement']}) est déjà signé à cette date`;
  } else {
    banner.style.cssText = 'display:block;padding:8px 12px;border-radius:4px;font-size:12px;margin:4px 0 8px;background:rgba(74,103,65,0.12);color:#4A6741;border:1px solid rgba(74,103,65,0.3);';
    banner.textContent = '✓ Date disponible';
  }
}

document.getElementById('event-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('event-modal')) closeEventModal();
});

// Vérification conflit de date sur changement du champ date événement
document.getElementById('event-form').addEventListener('change', e => {
  if (e.target.name === 'Date de l\'événement') checkDateConflict(e.target.value);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEventModal(); });

document.getElementById('event-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const data = {};
  new FormData(form).forEach((val, key) => { data[key] = val; });

  const btn = form.querySelector('.btn-primary');
  btn.disabled = true; btn.textContent = '\u2026';

  try {
    let result;
    if (editingRow) {
      result = await SheetsAPI.update(editingRow, data);
      if (result.success) {
        const row = appData.find(r => r._row === editingRow);
        if (row) Object.assign(row, data);
        renderAll();
        closeEventModal();
        showNotification('Événement mis à jour', 'success');
      }
    } else {
      result = await SheetsAPI.add(data);
      if (result.success) {
        await loadData();
        closeEventModal();
        showNotification('Événement ajouté', 'success');
        return;
      }
    }
    if (!result.success) showNotification('Erreur : ' + (result.error || 'inconnue'), 'error');
  } catch {
    showNotification('Erreur réseau', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Enregistrer';
  }
});

async function deleteCurrentEvent() {
  if (!editingRow) return;
  if (!confirm("Voulez-vous vraiment supprimer cet événement ? Cette action est irréversible.")) return;

  const btnDel = document.getElementById('btn-delete-view-modal') || document.getElementById('btn-delete-event');
  if (btnDel) {
    btnDel.disabled = true;
    btnDel.textContent = '...';
  }

  try {
    const result = await SheetsAPI.remove(editingRow);
    if (result.success) {
      appData = appData.filter(r => r._row !== editingRow);
      renderAll();
      if (typeof closeEventModal === 'function') closeEventModal();
      if (typeof closeViewModal === 'function') closeViewModal();
      showNotification('Événement supprimé', 'success');
    } else {
      showNotification('Erreur : ' + (result.error || 'inconnue'), 'error');
    }
  } catch (err) {
    showNotification('Erreur réseau', 'error');
  } finally {
    if (btnDel) {
      btnDel.disabled = false;
      btnDel.textContent = 'Supprimer';
    }
  }
}

// ── CALENDAR (supprimé) ──
// Le panel Agenda a été retiré de l'interface.

if (false) { // bloc conservé pour éviter les erreurs de référence
const Calendar = (() => {
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

  const now = new Date();
  let currentYear  = now.getFullYear();
  let currentMonth = now.getMonth();
  let selectedDate = null;

  function toStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function eventsForDate(ds) {
    return appData.filter(e => {
      const dbDate = e['Date de l\'événement'];
      return dbDate && String(dbDate).startsWith(ds);
    });
  }
  function eventsForMonth(y, m) {
    const pfx = `${y}-${String(m+1).padStart(2,'0')}`;
    return appData.filter(e => {
      const dbDate = e['Date de l\'événement'];
      return dbDate && String(dbDate).startsWith(pfx);
    });
  }

  function renderGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    const todayStr     = toStr(now.getFullYear(), now.getMonth(), now.getDate());
    const firstWkd     = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
    const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev   = new Date(currentYear, currentMonth, 0).getDate();

    let html = DAYS_FR.map(d => `<div class="cal-hd">${d}</div>`).join('');
    for (let i = firstWkd - 1; i >= 0; i--)
      html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = toStr(currentYear, currentMonth, d);
      const cls = ['cal-day',
        ds === todayStr          ? 'today'     : '',
        eventsForDate(ds).length ? 'has-event' : '',
        ds === selectedDate      ? 'selected'  : '',
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}" data-date="${ds}">${d}</div>`;
    }
    const tail = (firstWkd + daysInMonth) % 7;
    for (let d = 1; d <= (tail ? 7 - tail : 0); d++)
      html += `<div class="cal-day other-month">${d}</div>`;

    grid.innerHTML = html;
    grid.querySelectorAll('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const ds = el.getAttribute('data-date');
        selectedDate = selectedDate === ds ? null : ds;
        renderGrid(); renderDetail();
      });
    });
  }

  function renderDetail() {
    const titleEl = document.getElementById('cal-detail-title');
    const listEl  = document.getElementById('cal-detail-list');
    if (!titleEl || !listEl) return;
    let events;
    if (selectedDate) {
      events = eventsForDate(selectedDate);
      titleEl.textContent = events.length ? `Événements \u2014 ${formatDateFR(selectedDate)}` : `Aucun événement \u2014 ${formatDateFR(selectedDate)}`;
    } else {
      events = eventsForMonth(currentYear, currentMonth);
      titleEl.textContent = events.length
        ? `${events.length} événement${events.length > 1 ? 's' : ''} ce mois`
        : 'Aucun événement ce mois';
    }
    if (!events.length) { listEl.innerHTML = '<div class="cal-empty">Aucun événement.</div>'; return; }
    listEl.innerHTML = events.map(e => `
      <div class="activity-item" style="cursor:pointer" onclick="openEventModal(${e._row})">
        <div class="act-dot terra"></div>
        <div class="act-body">
          <div class="act-text"><strong>${formatDateFR(e['Date de l\'événement'])} \u2014 ${e['Nom client']}</strong></div>
          <div class="act-text" style="color:var(--muted);font-size:11px;">${e['Type d\'événement']} \xb7 ${e['Nb convives']} pers. \xb7 ${formatEuro(parseFloat(e['Budget estimé (€)']) || 0)}</div>
        </div>
      </div>`).join('');
  }

  function updateHeader() {
    const hEl = document.getElementById('agenda-heading');
    const sEl = document.getElementById('agenda-sub');
    const mSel = document.getElementById('cal-month-sel');
    const ySel = document.getElementById('cal-year-sel');
    if (hEl) hEl.textContent = `Agenda \u2014 ${MONTHS_FR[currentMonth]} ${currentYear}`;
    const count = eventsForMonth(currentYear, currentMonth).length;
    if (sEl) sEl.textContent = '';
    if (mSel) mSel.value = currentMonth;
    if (ySel) ySel.value = currentYear;
  }

  function render() { renderGrid(); renderDetail(); updateHeader(); }

  function init() {
    const mSel = document.getElementById('cal-month-sel');
    if (mSel) {
      MONTHS_FR.forEach((m, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = m; mSel.appendChild(o);
      });
      mSel.addEventListener('change', () => { currentMonth = parseInt(mSel.value); selectedDate = null; render(); });
    }
    const ySel = document.getElementById('cal-year-sel');
    if (ySel) {
      for (let y = 2023; y <= now.getFullYear() + 3; y++) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y; ySel.appendChild(o);
      }
      ySel.addEventListener('change', () => { currentYear = parseInt(ySel.value); selectedDate = null; render(); });
    }
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      if (--currentMonth < 0) { currentMonth = 11; currentYear--; }
      selectedDate = null; render();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      if (++currentMonth > 11) { currentMonth = 0; currentYear++; }
      selectedDate = null; render();
    });
    render();
  }

  return { init, refresh: render, getSelectedDate: () => selectedDate };
})();
Calendar.init();
} // fin bloc Calendar désactivé

// ── KPI MODALS ──

function showKpiModal(type) {
  const currentYear = new Date().getFullYear();
  const title = document.getElementById('kpi-title');
  const thead = document.getElementById('kpi-thead');
  const tbody = document.getElementById('kpi-tbody');
  const tfoot = document.getElementById('kpi-tfoot');
  if (!tbody) return;
  
  thead.innerHTML = '';
  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  const actives = appData.filter(e => !isEventPast(e));

  if (type === 'ca') {
    title.textContent = `CA Estimé ${currentYear}`;
    const yearlySigned = appData.filter(e => {
      if (e['Statut traitement'] !== 'Signé') return false;
      if (!e['Date de l\'événement']) return false;
      const d = new Date(String(e['Date de l\'événement']).split('T')[0]);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });

    const cm = {};
    yearlySigned.forEach(e => {
      const n = e['Nom client'] || 'Inconnu';
      if (!cm[n]) cm[n] = 0;
      cm[n] += (parseFloat(e['Budget estimé (€)']) || 0);
    });
    const rows = Object.entries(cm).sort((a,b)=>b[1]-a[1]);
    
    thead.innerHTML = '<tr><th>Client</th><th>CA Signé</th></tr>';
    tbody.innerHTML = rows.length ? rows.map(([c, v]) => `<tr><td>${c}</td><td><strong>${formatEuro(v)}</strong></td></tr>`).join('') : '<tr><td colspan="2" class="tbl-empty">Aucun CA</td></tr>';
    const total = rows.reduce((s, r)=>s+r[1], 0);
    if(rows.length) tfoot.innerHTML = `<tr><td><strong>TOTAL</strong></td><td><strong>${formatEuro(total)}</strong></td></tr>`;
  } 
  else if (type === 'confirmes') {
    title.textContent = 'Événements confirmés';
    const evts = actives.filter(e => e['Statut traitement'] === 'Signé');
    evts.sort((a,b) => new Date(String(a['Date de l\'événement']||'').split('T')[0]).getTime() - new Date(String(b['Date de l\'événement']||'').split('T')[0]).getTime());
    
    thead.innerHTML = '<tr><th style="width:22%">Date</th><th style="width:36%">Client</th><th style="width:24%">Type</th><th style="width:18%">Montant</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      const budget = parseFloat(e['Budget estimé (€)']);
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td>${formatDateFR(e['Date de l\'événement'])}</td><td><strong>${e['Nom client']}</strong></td><td>${e['Type d\'événement'] || '—'}</td><td>${budget ? formatEuro(budget) : '—'}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="tbl-empty">Aucun événement signé</td></tr>';
  }
  else if (type === 'devis') {
    title.textContent = 'Devis en attente';
    const evts = actives.filter(e => e['Statut traitement'] === 'Devis envoyé');
    evts.sort((a,b) => new Date(String(a['Date de l\'événement']||'').split('T')[0]).getTime() - new Date(String(b['Date de l\'événement']||'').split('T')[0]).getTime());
    
    thead.innerHTML = '<tr><th style="width:30%">Date prévue</th><th style="width:45%">Client</th><th style="width:25%">Montant</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      const budget = parseFloat(e['Budget estimé (€)']);
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td>${formatDateFR(e['Date de l\'événement'])}</td><td><strong>${e['Nom client']}</strong></td><td>${budget ? formatEuro(budget) : '—'}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="tbl-empty">Aucun devis en attente</td></tr>';
  }
  else if (type === 'leads') {
    title.textContent = 'Nouvelles demandes';
    const evts = actives.filter(e => e['Statut traitement'] === 'Nouveau');
    evts.sort((a,b) => new Date(String(a['Date de l\'événement']||'').split('T')[0]).getTime() - new Date(String(b['Date de l\'événement']||'').split('T')[0]).getTime());
    
    thead.innerHTML = '<tr><th style="width:32%">Client</th><th style="width:22%">Date</th><th style="width:22%">Montant</th><th style="width:24%">Statut</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      const budget = parseFloat(e['Budget estimé (€)']);
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td><strong>${e['Nom client']}</strong></td><td>${formatDateFR(e['Date de l\'événement']) || 'À dét.'}</td><td>${budget ? formatEuro(budget) : '—'}</td><td>${STATUS_LABEL[e['Statut traitement']]}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="tbl-empty">Aucun nouveau lead</td></tr>';
  }

  document.getElementById('kpi-modal').style.display = 'flex';
}

// ── SIDEBAR MOBILE TOGGLE ──

const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn        = document.getElementById('menu-btn');
const sidebarClose   = document.querySelector('.sidebar-close');

function toggleSidebar() {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('open');
}
menuBtn.addEventListener('click', toggleSidebar);
sidebarClose.addEventListener('click', toggleSidebar);
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 900) {
      setTimeout(() => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('open'); }, 100);
    }
  });
});

// ── PANEL NAVIGATION ──

function showPanel(panelName, element) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + panelName);
  if (panel) panel.classList.add('active');
  if (element) element.classList.add('active');
  // Sync sidebar item si non déjà marqué
  const sidebarItem = document.querySelector(`.nav-item[data-panel="${panelName}"]`);
  if (sidebarItem && sidebarItem !== element) sidebarItem.classList.add('active');
  // Sync bottom nav item
  const bnItem = document.getElementById('bn-' + panelName);
  if (bnItem && bnItem !== element) bnItem.classList.add('active');
  document.querySelector('.content').scrollTop = 0;
}

// ── RESPONSIVE HANDLING ──

let isDesktop = window.innerWidth >= 900;
window.addEventListener('resize', () => {
  const newIsDesktop = window.innerWidth >= 900;
  if (newIsDesktop !== isDesktop) {
    isDesktop = newIsDesktop;
    if (isDesktop) { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('open'); }
  }
});

// ── NOTIFICATIONS ──

function showNotification(message, type = 'info', duration = 3000) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:#2E2018;color:#fff;padding:14px 16px;border-radius:6px;font-size:13px;z-index:600;box-shadow:0 4px 12px rgba(0,0,0,.2);animation:slideUp .3s ease-out;';
  if (type === 'success') n.style.background = '#4A6741';
  if (type === 'error')   n.style.background = '#C0453A';
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => { n.style.transition = 'opacity .3s'; n.style.opacity = '0'; setTimeout(() => n.remove(), 300); }, duration);
}

// ── INIT ──

loadData();

// ── EXPORT ──

window.ChezPapi = {
  SheetsAPI, showPanel, toggleSidebar, showNotification, loadData, openEventModal, showViewModal, closeViewModal, deleteCurrentEvent, showKpiModal,
  renderHistorique, setHistoriqueFilter, applyHistoriqueDateRange, exportHistoriqueCSV,
  addTodo, toggleTodo, deleteTodo, toggleFormMode, checkDateConflict,
  // Diagnostic : testConnection() dans la console pour voir la réponse brute
  async testConnection() {
    console.log('Test connexion →', CONFIG.SHEETS_URL);
    try {
      const res = await fetch(CONFIG.SHEETS_URL + '?action=getAll', { redirect: 'follow' });
      const text = await res.text();
      console.log('Status :', res.status);
      console.log('Réponse (200 premiers chars) :', text.slice(0, 200));
      try { console.log('JSON parsé :', JSON.parse(text)); } catch { console.warn('Pas du JSON valide'); }
    } catch (e) { console.error('Erreur réseau :', e); }
  },
};
console.log('Chez Papi PWA initialized \u2713');
