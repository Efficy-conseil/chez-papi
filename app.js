// ── CONFIGURATION ──
// Remplacez cette valeur par l'URL de votre Google Apps Script déployé
const CONFIG = {
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbzpmDJWRgFZHAKSeHais4uyzslhpbEAItrsx7QirUjXF7CnHQFOtb4Xn9K8nvxvFSei-w/exec', // Ex: 'https://script.google.com/macros/s/XXXXX/exec'
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

// Échappe les caractères HTML pour éviter les injections XSS
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convertit n'importe quelle date (ISO UTC ou YYYY-MM-DD) en minuit heure locale
function parseLocalDate(ds) {
  if (!ds) return null;
  let cleanDs = String(ds).trim();
  // Extrait la première date YYYY-MM-DD trouvée
  const dateMatch = cleanDs.match(/\d{4}-\d{2}-\d{2}/);
  if (dateMatch) {
    cleanDs = dateMatch[0];
  }
  const d = new Date(cleanDs);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatEuro(n) {
  return (isNaN(n) ? 0 : Math.round(n)).toLocaleString('fr-FR') + ' \u20ac';
}

function formatBudget(val) {
  if (!val) return '—';
  const s = String(val).trim();
  if (s.includes('€') || s.toLowerCase().includes('eur')) return s;
  const num = parseFloat(s.replace(/\s/g, ''));
  if (!isNaN(num) && String(num) === s.replace(/\s/g, '')) {
    return formatEuro(num);
  }
  return s + (isNaN(num) ? '' : ' €');
}

function formatDateFR(ds) {
  if (!ds) return '';
  try {
    // Si c'est une plage comme "2026-06-30 au 2026-07-03", on formate les composants individuellement
    let cleanDs = String(ds).trim();
    if (cleanDs.includes(' au ')) {
      return cleanDs.split(' au ').map(part => formatDateFR(part)).join(' au ');
    }
    const d = parseLocalDate(cleanDs);
    if (!d) return cleanDs;
    const currentYear = new Date().getFullYear();
    const opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== currentYear) opts.year = 'numeric';
    return d.toLocaleDateString('fr-FR', opts);
  }
  catch { return String(ds); }
}

const STATUS_PILL = {
  'Nouvelle demande': 'pill-terra',
  'À rappeler': 'pill-orange',
  'Devis à préparer': 'pill-gold',
  'Devis envoyé': 'pill-gold',
  'Événement confirmé': 'pill-green',
  'Événement terminé': 'pill-gray',
  'Perdu / Sans suite': 'pill-red'
};

const STATUS_LABEL = {
  'Nouvelle demande': '🆕 Nouvelle demande',
  'À rappeler': '📞 À rappeler',
  'Devis à préparer': '📝 Devis à préparer',
  'Devis envoyé': '✉️ Devis envoyé',
  'Événement confirmé': '📅 Événement confirmé',
  'Événement terminé': '✅ Événement terminé',
  'Perdu / Sans suite': '❌ Perdu / Sans suite'
};

const STATUS_DOT = {
  'Nouvelle demande': 'terra',
  'À rappeler': 'orange',
  'Devis à préparer': 'gold',
  'Devis envoyé': 'gold',
  'Événement confirmé': 'green',
  'Événement terminé': 'gray',
  'Perdu / Sans suite': 'red'
};

function normalizeFrenchPhone(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\s+/g, '').trim();
  
  // Extract all digits
  let digits = clean.replace(/\D/g, '');
  
  // Handle international +33 or 33 prefix
  if (digits.startsWith('33')) {
    if (digits.startsWith('330')) {
      digits = digits.substring(2); // remove '33', keeps the '0'
    } else {
      digits = '0' + digits.substring(2); // replace '33' with '0'
    }
  }
  
  // If it's 9 digits starting with 1-9 (e.g. 663515474), prepend 0
  if (digits.length === 9 && /^[1-9]/.test(digits)) {
    digits = '0' + digits;
  }
  
  // If we have exactly 10 digits now, format as "0X XX XX XX XX"
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  
  return phone;
}

// Rend un numéro de téléphone ou email cliquable, sinon retourne le texte brut
// Sécurisé contre l'injection via href (encodeURIComponent + validation regex)
function formatContact(contact) {
  if (contact === null || contact === undefined || contact === '') return '—';
  const c = String(contact).trim();
  if (!c) return '—';

  const linkStyle = 'color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;';
  const displayText = escHtml(c);

  // Email : validation stricte avant insertion dans href
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
    return `<a href="mailto:${encodeURIComponent(c)}" style="${linkStyle}">${displayText}</a>`;
  }

  // Téléphone
  const normalized = normalizeFrenchPhone(c);
  if (normalized && normalized.replace(/\s/g, '').length >= 9) {
    const rawTel = normalized.replace(/\s/g, '');
    // Seuls les chiffres, +, espaces sont autorisés dans un tel:
    if (/^[\d\s+]+$/.test(rawTel)) {
      return `<a href="tel:${encodeURIComponent(rawTel)}" style="${linkStyle}">${escHtml(normalized)}</a>`;
    }
  }

  return displayText;
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
  const newLeads = rows.filter(r => (r.statut === 'Nouveau' || r.statut === 'Nouvelle demande') && !seen.has(String(r._row)));
  newLeads.forEach(r => {
    const sBudget = String(r.budget_estime || '').replace(/\s/g, '');
    const numMatch = sBudget.match(/\d+/);
    const budgetVal = numMatch ? parseFloat(numMatch[0]) : 0;
    const body = `${r.nom_client || 'Sans nom'} · ${r.type_evenement || ''}${budgetVal ? ' · ' + formatEuro(budgetVal) : ''}`;
    const tag = 'lead-' + r._row;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: 'Nouvelle demande', body, tag });
    } else {
      new Notification('Nouvelle demande', { body, icon: './icon-192x192.png', tag }).catch(() => {});
    }
    seen.add(String(r._row));
  });
  localStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify([...seen]));
  // Synchroniser la liste des vus avec le SW pour le polling en arrière-plan
  syncSeenRowsToSW([...seen]);
}

// ── Synchronisation des credentials et état avec le Service Worker ───────────

function syncCredentialsToSW() {
  const user = localStorage.getItem('cp_user') || '';
  const pass = localStorage.getItem('cp_pass') || '';
  if (!user || !CONFIG.SHEETS_URL) return;
  navigator.serviceWorker?.controller?.postMessage({
    type: 'SYNC_CREDENTIALS',
    user, pass,
    url: CONFIG.SHEETS_URL
  });
  // Aussi écrire dans IndexedDB (accessible au SW même après redémarrage)
  try {
    const req = indexedDB.open('chez-papi-sw', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('state', { keyPath: 'key' }); };
    req.onsuccess = e => {
      const tx = e.target.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ key: 'credentials', value: { user, pass, url: CONFIG.SHEETS_URL } });
    };
  } catch {}
}

function syncSeenRowsToSW(rows) {
  navigator.serviceWorker?.controller?.postMessage({ type: 'SYNC_SEEN_ROWS', rows });
  try {
    const req = indexedDB.open('chez-papi-sw', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('state', { keyPath: 'key' }); };
    req.onsuccess = e => {
      const tx = e.target.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ key: 'seen_rows', value: rows });
    };
  } catch {}
}

// ── Traitement des lignes brutes (normalisation + déduplication) ─────────────
// Fonction partagée par loadData() et silentPoll() pour garantir la cohérence.

function processRows(rawRows) {
  const statOrder = {
    'Nouvelle demande': 1,
    'À rappeler': 2,
    'Devis à préparer': 3,
    'Devis envoyé': 4,
    'Événement confirmé': 5,
    'Événement terminé': 6,
    'Perdu / Sans suite': 7
  };

  // 1. Normaliser les statuts
  const normalized = rawRows.map(row => { row.statut = normalizeStatus(row.statut); return row; });

  // 2. Dédupliquer par id_demande : conserver le statut le plus avancé
  const seenIds = new Map();
  normalized.forEach(row => {
    const id = String(row.id_demande || '').trim();
    if (!id) return;
    const existing = seenIds.get(id);
    if (!existing) {
      seenIds.set(id, row);
    } else {
      const o1 = statOrder[existing.statut] || 0;
      const o2 = statOrder[row.statut] || 0;
      if (o2 > o1) {
        seenIds.set(id, row);
      } else if (o2 === o1) {
        const d1 = new Date(existing.derniere_modification || 0).getTime();
        const d2 = new Date(row.derniere_modification || 0).getTime();
        if (d2 > d1) seenIds.set(id, row);
      }
    }
  });

  // 3. Reconstruire en préservant l'ordre d'origine
  const uniqueRows = [];
  normalized.forEach(row => {
    const id = String(row.id_demande || '').trim();
    if (!id) { uniqueRows.push(row); return; }
    const best = seenIds.get(id);
    if (best && best._row === row._row) uniqueRows.push(row);
  });

  return uniqueRows;
}

// ── Synchronisation multi-onglets via BroadcastChannel ───────────────────────
// Permet de notifier instantanément tous les onglets ouverts après une mutation.

const _tabsChannel = ('BroadcastChannel' in window)
  ? new BroadcastChannel('chez-papi-tabs-sync')
  : null;

// Envoyer un signal de sync à tous les autres onglets
function broadcastSync() {
  try { _tabsChannel?.postMessage({ type: 'sync' }); } catch {}
}

// Réception du signal dans les onglets frères → silentPoll()
if (_tabsChannel) {
  _tabsChannel.onmessage = (e) => {
    if (e.data?.type === 'sync') {
      silentPoll();
    }
  };
}

// ── Polling toutes les 3 minutes (quand l'app est ouverte) ───────────────────

let _pollingTimer = null;

async function silentPoll() {
  if (!CONFIG.SHEETS_URL || !localStorage.getItem('cp_user')) return;
  try {
    const result = await SheetsAPI.load();
    if (result?.rows) {
      const processed = processRows(result.rows);
      checkNewEvents(processed);
      // Toujours mettre à jour appData et re-render pour refléter toute modification externe
      appData = processed;
      renderAll();
    }
  } catch { /* polling silencieux, on ignore les erreurs réseau */ }
}

function startBackgroundPolling() {
  if (_pollingTimer) clearInterval(_pollingTimer);
  _pollingTimer = setInterval(silentPoll, 3 * 60 * 1000); // toutes les 3 min
}

function stopBackgroundPolling() {
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; }
}

// ── Periodic Background Sync (Chrome Android, PWA installée) ─────────────────

async function registerPeriodicSync() {
  if (!('periodicSync' in ServiceWorkerRegistration.prototype)) return;
  try {
    const sw = await navigator.serviceWorker.ready;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted') {
      await sw.periodicSync.register('poll-new-events', { minInterval: 3 * 60 * 1000 });
      console.log('[PWA] Periodic Background Sync enregistré');
    }
  } catch (err) {
    console.log('[PWA] Periodic Background Sync non disponible :', err.message);
  }
}


// ── SHEETS API ──

const SheetsAPI = {
  async load() {
    if (!CONFIG.SHEETS_URL) return null;
    const user = localStorage.getItem('cp_user') || '';
    const pass = localStorage.getItem('cp_pass') || '';
    const url = CONFIG.SHEETS_URL + '?action=getAll&user=' + encodeURIComponent(user) + '&pass=' + encodeURIComponent(pass);
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    if (text && text.indexOf('Authorization is required') !== -1) {
      throw new Error('Authorization required');
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'Non autorisé') {
        logout();
        throw new Error('Identifiants invalides');
      }
      return parsed;
    } catch (e) {
      if (e.message === 'Identifiants invalides' || e.message === 'Authorization required') throw e;
      console.error('SheetsAPI: réponse non-JSON :', text.slice(0, 300));
      throw new Error('Réponse invalide du serveur (non-JSON)');
    }
  },
  async add(row) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const user = localStorage.getItem('cp_user') || '';
    const pass = localStorage.getItem('cp_pass') || '';
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'add', row, user, pass }),
    });
    const text = await res.text();
    if (text && text.indexOf('Authorization is required') !== -1) {
      throw new Error('Authorization required');
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'Non autorisé') {
        logout();
        return { error: 'Session expirée ou non autorisée' };
      }
      return parsed;
    } catch {
      throw new Error('Réponse invalide : ' + text.slice(0, 100));
    }
  },
  async update(rowIndex, fields) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const user = localStorage.getItem('cp_user') || '';
    const pass = localStorage.getItem('cp_pass') || '';
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'update', rowIndex, fields, user, pass }),
    });
    const text = await res.text();
    if (text && text.indexOf('Authorization is required') !== -1) {
      throw new Error('Authorization required');
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'Non autorisé') {
        logout();
        return { error: 'Session expirée ou non autorisée' };
      }
      return parsed;
    } catch {
      throw new Error('Réponse invalide : ' + text.slice(0, 100));
    }
  },
  async remove(rowIndex) {
    if (!CONFIG.SHEETS_URL) return { error: 'Non configuré' };
    const user = localStorage.getItem('cp_user') || '';
    const pass = localStorage.getItem('cp_pass') || '';
    const res = await fetch(CONFIG.SHEETS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'delete', rowIndex, user, pass }),
    });
    const text = await res.text();
    if (text && text.indexOf('Authorization is required') !== -1) {
      throw new Error('Authorization required');
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'Non autorisé') {
        logout();
        return { error: 'Session expirée ou non autorisée' };
      }
      return parsed;
    } catch {
      throw new Error('Réponse invalide : ' + text.slice(0, 100));
    }
  }
};

// ── APP DATA ──

let appData = [];

function isEventPast(e) {
  if (!e) return false;
  // Les prestations terminées ou clients perdus sont historisés (non actifs)
  if (e.statut === 'Événement terminé' || e.statut === 'Perdu / Sans suite') return true;
  if (!e.date_evenement) return false;
  let dateStr = String(e.date_evenement).trim();
  if (dateStr.includes(' au ')) {
    const parts = dateStr.split(' au ');
    dateStr = parts[parts.length - 1].trim();
  }
  const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
  if (dateMatch) {
    dateStr = dateMatch[0];
  }
  const d = parseLocalDate(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  return d.getTime() < today.getTime();
}

function getMissingFields(e) {
  if (!e) return [];
  const missing = [];
  const noPhone = !e.telephone || String(e.telephone).trim() === '' || String(e.telephone).trim() === '—';
  const noEmail = !e.email_client || String(e.email_client).trim() === '' || String(e.email_client).trim() === '—';
  const noLieu = !e.lieu_prestation || String(e.lieu_prestation).trim() === '' || String(e.lieu_prestation).trim() === '—';
  const noConvives = !e.nb_convives || String(e.nb_convives).trim() === '' || String(e.nb_convives).trim() === '—' || String(e.nb_convives).trim() === '0';

  if (noPhone && noEmail) {
    missing.push('Téléphone & E-mail');
  }
  if (noLieu) {
    missing.push('Lieu');
  }
  if (noConvives) {
    missing.push('Nombre de convives');
  }
  return missing;
}

function hasMissingInfo(e) {
  return getMissingFields(e).length > 0;
}

function normalizeStatus(status) {
  // Statut vide ou absent → 'Nouvelle demande' (affiché avec badge «infos manquantes»)
  if (status === null || status === undefined) return 'Nouvelle demande';
  const s = String(status).trim();
  if (!s) return 'Nouvelle demande';
  const lower = s.toLowerCase();

  if (lower === 'nouveau' || lower === 'nouvelle demande') return 'Nouvelle demande';
  if (lower === 'à rappeler' || lower === 'a rappeler' || lower === 'rappeler') return 'À rappeler';
  if (lower === 'contacté' || lower === 'client contacté' || lower === 'contacte' || lower === 'devis à préparer' || lower === 'devis a preparer') return 'Devis à préparer';
  if (lower === 'devis envoyé' || lower === 'devis envoye') return 'Devis envoyé';
  if (lower === 'signé' || lower === 'devis signé' || lower === 'signe' || lower === 'prestation en cours' || lower === 'événement confirmé' || lower === 'evenement confirme' || lower === 'evenement confirmé' || lower === 'événement confirme') return 'Événement confirmé';
  if (lower === 'terminé' || lower === 'prestation terminée' || lower === 'termine' || lower === 'événement terminé' || lower === 'evenement termine' || lower === 'evenement terminé' || lower === 'événement termine') return 'Événement terminé';
  if (lower === 'perdu' || lower === 'client perdu' || lower === 'perdu / sans suite' || lower === 'perdu/sans suite' || lower === 'sans suite') return 'Perdu / Sans suite';

  return s;
}

async function loadData() {
  if (!CONFIG.SHEETS_URL) { renderAll(); return; }
  setConnectionStatus('loading');
  setLoading(true);
  try {
    const result = await SheetsAPI.load();
    if (result && result.rows) {
      // Normalisation des statuts + déduplication via processRows()
      appData = processRows(result.rows);
      lastSyncTime = Date.now(); lastSyncOk = true; updateSyncIndicator();
      setConnectionStatus('ok', appData.length);
      checkNewEvents(appData);
      requestNotifPermission();
      renderAll();

      // Démarrer le polling en arrière-plan + synchroniser les credentials avec le SW
      syncCredentialsToSW();
      startBackgroundPolling();
      registerPeriodicSync();

      // Gestion du routage profond (Deep Linking)
      // Supporte ?id=<id_demande> (prioritaire) et ?row=<numéro> (rétrocompat)
      const urlParams = new URLSearchParams(window.location.search);
      const idParam  = urlParams.get('id');
      const rowParam = urlParams.get('row');
      const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;

      if (idParam) {
        const found = appData.find(e => String(e.id_demande || '') === idParam);
        if (found) {
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
          setTimeout(() => openEventModal(found._row), 500);
        }
      } else if (rowParam) {
        const rowIndex = parseInt(rowParam, 10);
        if (!isNaN(rowIndex)) {
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
          setTimeout(() => openEventModal(rowIndex), 500);
        }
      }
    } else {
      const msg = result?.error || 'Réponse inattendue';
      // Si le backend rejette les credentials → propager pour que handleLoginSubmit puisse l'attraper
      if (msg === 'Non autorisé') {
        throw new Error('Identifiants invalides');
      }
      console.error('loadData: erreur API :', msg, result);
      lastSyncOk = false; updateSyncIndicator();
      setConnectionStatus('error', msg);
      showNotification('Erreur Google Sheet : ' + msg, 'error');
    }
  } catch (err) {
    // Relancer les erreurs d'auth pour que handleLoginSubmit puisse les intercepter
    if (err.message === 'Identifiants invalides') {
      lastSyncOk = false; updateSyncIndicator();
      throw err;
    }
    console.error('loadData:', err);
    lastSyncOk = false; updateSyncIndicator();
    setConnectionStatus('error', err.message);
    if (err && (err.message === 'Authorization required' || String(err).includes('Failed to fetch') || String(err).includes('NetworkError'))) {
      handleCalendarAuthError(err);
    } else {
      showNotification(err.message, 'error');
    }
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
  try { renderAgenda(); } catch(e) { console.error('renderAgenda:', e); }
  try { if (typeof renderHistorique === 'function') renderHistorique(); } catch(e) { console.error('renderHistorique:', e); }
}

// ── RENDER: DASHBOARD ──

function renderDashboard() {
  const currentYear = new Date().getFullYear();
  const CA_STATUTS = ['Événement confirmé', 'Événement terminé'];
  const yearlySigned = appData.filter(e => {
    if (!CA_STATUTS.includes(e.statut)) return false;
    if (!e.date_evenement) return false;
    let dateStr = String(e.date_evenement).trim();
    const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) dateStr = dateMatch[0];
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
  });
  
  const caConf = yearlySigned.reduce((s, e) => {
    const sBudget = String(e.budget_estime || '').replace(/\s/g, '');
    const numMatch = sBudget.match(/\d+/);
    const budgetVal = numMatch ? parseFloat(numMatch[0]) : 0;
    return s + budgetVal;
  }, 0);

  const actives = appData.filter(e => !isEventPast(e));
  const confirmes = actives.filter(e => e.statut === 'Événement confirmé');
  const devisEnv  = actives.filter(e => e.statut === 'Devis envoyé');
  const nouveaux = actives.filter(e => e.statut === 'Nouvelle demande' || e.statut === 'À rappeler');

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-ca-val',          formatEuro(caConf));
  set('kpi-confirmes-val',   confirmes.length || '—');
  set('kpi-confirmes-delta', devisEnv.length + ' en cours de devis');
  set('kpi-devis-val',       devisEnv.length || '—');
  set('kpi-leads-val',       nouveaux.length || '—');

  // Nouvelles demandes
  const newDemandes = appData
    .filter(e => e.statut === 'Nouvelle demande' || e.statut === 'À rappeler')
    .sort((a, b) => (b.date_reception || '').localeCompare(a.date_reception || ''))
    .slice(0, 6);

  const newTbody = document.getElementById('new-demandes-tbody');
  if (newTbody) {
    if (!CONFIG.SHEETS_URL) {
      newTbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">\u2699 Configurez CONFIG.SHEETS_URL</td></tr>';
    } else if (!newDemandes.length) {
      newTbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">Aucune nouvelle demande</td></tr>';
    } else {
      newTbody.innerHTML = newDemandes.map(e => {
        let ageBadge = '—';
        if (e.date_reception) {
          const demandDate = parseLocalDate(e.date_reception);
          const hours = demandDate ? Math.floor((Date.now() - demandDate.getTime()) / 3600000) : -1;
          if (hours >= 0) {
            const color = hours < 24 ? '#4A6741' : hours < 72 ? '#B8860B' : '#C0453A';
            ageBadge = hours < 24
              ? `<span style="color:${color};font-weight:600;">il y a ${hours}h</span>`
              : `<span style="color:${color};font-weight:600;">il y a ${Math.floor(hours/24)}j</span>`;
          }
        }
        const warningBadge = hasMissingInfo(e) ? ` <span class="pill pill-red" style="font-size:8px; font-weight:700; background:rgba(192,69,58,.15); color:var(--red-soft); margin-left:6px; flex-shrink:0; vertical-align:middle;">⚠️ Infos manquantes</span>` : '';
        return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
          <td><strong>${formatDateFR(e.date_evenement) || '—'}</strong></td>
          <td>${e.nom_client || '—'}${warningBadge}</td>
          <td>${formatBudget(e.budget_estime)}</td>
          <td>${ageBadge}</td>
        </tr>`;
      }).join('');
    }
  }

  // Demandes en cours (Devis à préparer / Devis envoyé)
  const PIPELINE_SCOPE_HOME = ['Devis à préparer', 'Devis envoyé'];
  const demandesHome = actives
    .filter(e => PIPELINE_SCOPE_HOME.includes(e.statut))
    .sort((a, b) => (a.date_evenement || '').localeCompare(b.date_evenement || ''))
    .slice(0, 6);

  const tbody = document.getElementById('upcoming-tbody');
  if (tbody) {
    if (!CONFIG.SHEETS_URL) {
      tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">\u2699 Configurez CONFIG.SHEETS_URL dans app.js</td></tr>';
    } else if (!demandesHome.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">Aucune demande en cours</td></tr>';
    } else {
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      tbody.innerHTML = demandesHome.map(e => {
        let dateStr = String(e.date_evenement).trim();
        const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) dateStr = dateMatch[0];
        const d = parseLocalDate(dateStr);
        const diffDays = d ? Math.ceil((d.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        
        const isEnterprise = String(e.type_evenement).trim().toLowerCase() === 'entreprise';
        let urgClass = '';
        if (d) {
          if (!isEnterprise) {
            if (diffDays < 7) urgClass = 'row-urgent';
            else if (diffDays >= 7 && diffDays <= 30) urgClass = 'row-prio';
          } else {
            if (diffDays <= URGENCE_JOURS_URGENT) urgClass = 'row-urgent';
            else if (diffDays <= URGENCE_JOURS_PRIORITAIRE) urgClass = 'row-prio';
          }
        }

        const warningBadge = hasMissingInfo(e) ? ` <span class="pill pill-red" style="font-size:8px; font-weight:700; background:rgba(192,69,58,.15); color:var(--red-soft); margin-left:6px; flex-shrink:0; vertical-align:middle;">⚠️ Infos manquantes</span>` : '';
        return `<tr class="${urgClass}" style="cursor:pointer" onclick="openEventModal(${e._row})">
          <td><strong>${formatDateFR(e.date_evenement) || '—'}</strong></td>
          <td>${e.nom_client || '—'}${warningBadge}</td>
          <td>${formatBudget(e.budget_estime)}</td>
          <td><span class="pill ${STATUS_PILL[e.statut] || 'pill-gray'}">${STATUS_LABEL[e.statut] || e.statut}</span></td>
        </tr>`;
      }).join('');
    }
  }

  // Prestations en cours (Événement confirmé)
  const prestationsHome = actives
    .filter(e => e.statut === 'Événement confirmé')
    .sort((a, b) => (a.date_evenement || '').localeCompare(b.date_evenement || ''))
    .slice(0, 5);

  const actEl = document.getElementById('recent-activity');
  if (actEl) {
    if (!prestationsHome.length) {
      actEl.innerHTML = '<div class="act-time" style="padding:12px 0;color:var(--muted);">Aucune prestation en cours</div>';
    } else {
      const thead = '<table class="tbl tbl-sm"><thead><tr><th style="width:22%">Date</th><th style="width:36%">Client</th><th style="width:20%">Budget</th><th style="width:22%">Statut</th></tr></thead><tbody>';
      actEl.innerHTML = thead + prestationsHome.map(e => {
        const warningBadge = hasMissingInfo(e) ? ` <span class="pill pill-red" style="font-size:8px; font-weight:700; background:rgba(192,69,58,.15); color:var(--red-soft); margin-left:6px; flex-shrink:0; vertical-align:middle;">⚠️ Infos manquantes</span>` : '';
        return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
          <td><strong>${formatDateFR(e.date_evenement)}</strong></td>
          <td>${e.nom_client || '—'}${warningBadge}</td>
          <td>${formatBudget(e.budget_estime)}</td>
          <td><span class="pill ${STATUS_PILL[e.statut] || 'pill-gray'}">${STATUS_LABEL[e.statut] || e.statut}</span></td>
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

function renderPipeline() {
  const el = document.getElementById('pipeline');
  if (!el) return;

  if (!CONFIG.SHEETS_URL) {
    el.innerHTML = '<div class="pipe-empty-state">\u2699 Renseignez <code>CONFIG.SHEETS_URL</code> dans app.js</div>';
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const PIPELINE_SCOPE = ['Nouvelle demande', 'À rappeler', 'Devis à préparer', 'Devis envoyé'];
  const colsData = { 'urgent': [], 'prioritaire': [], 'important': [], 'normal': [] };

  appData.forEach(e => {
    if (!PIPELINE_SCOPE.includes(e.statut)) return;
    if (isEventPast(e)) return;

    const isEnterprise = String(e.type_evenement).trim().toLowerCase() === 'entreprise';
    if (isEnterprise) {
      colsData['prioritaire'].push(e);
      return;
    }

    if (!e.date_evenement) { colsData['normal'].push(e); return; }
    let dateStr = String(e.date_evenement).trim();
    const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) dateStr = dateMatch[0];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) { colsData['normal'].push(e); return; }

    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      colsData['urgent'].push(e);
    } else if (diffDays >= 7 && diffDays <= 30) {
      colsData['important'].push(e);
    } else {
      colsData['normal'].push(e);
    }
  });

  // Sort events in each column by date
  const sortEventsByDate = (a, b) => {
    const da = a.date_evenement || '';
    const db = b.date_evenement || '';
    return da.localeCompare(db);
  };
  Object.keys(colsData).forEach(key => {
    colsData[key].sort(sortEventsByDate);
  });

  const ALL_STATUSES = ['Nouvelle demande', 'À rappeler', 'Devis à préparer', 'Devis envoyé', 'Événement confirmé', 'Événement terminé', 'Perdu / Sans suite'];

  el.innerHTML = PIPELINE_COLS.map(col => {
    const events = colsData[col.id];

    const cards = events.map(e => {
      const options = ALL_STATUSES.map(s =>
        `<option value="${s}"${s === e.statut ? ' selected' : ''}>${STATUS_LABEL[s] || s}</option>`
      ).join('');

      // Badge ancienneté
      let ageBadge = '';
      const isNewOrContacted = ['Nouvelle demande', 'À rappeler', 'Devis à préparer'].includes(e.statut);
      if (isNewOrContacted && e.date_reception) {
        const demandDate = parseLocalDate(e.date_reception);
        const hours = demandDate ? Math.floor((Date.now() - demandDate.getTime()) / 3600000) : -1;
        if (hours >= 0) {
          const badgeColor = hours < 24 ? '#4A6741' : hours < 72 ? '#B8860B' : '#C0453A';
          const badgeText  = hours < 24 ? `Reçu il y a ${hours}h` : `Reçu il y a ${Math.floor(hours/24)} jour${Math.floor(hours/24) > 1 ? 's' : ''}`;
          ageBadge = `<div style="font-size:10px;font-weight:600;color:${badgeColor};margin-top:4px;">${badgeText}</div>`;
        }
      }

      const contactRaw = e.telephone ? formatContact(e.telephone) : '';
      const emailRaw   = e.email_client ? formatContact(e.email_client) : '';
      const contactLine = [contactRaw, emailRaw].filter(v => v && v !== '—').join(' · ');

      // Liens e-mail et drive sous forme d'icônes
      let linksLine = '';
      const links = [];
      if (e.url_email_origine) links.push(`<a href="${e.url_email_origine}" target="_blank" title="Email d'origine" style="text-decoration:none; margin-right:6px;">✉️</a>`);
      if (e.url_dossier_drive) links.push(`<a href="${e.url_dossier_drive}" target="_blank" title="Dossier Drive" style="text-decoration:none;">📂</a>`);
      if (links.length) {
        linksLine = `<div style="margin-top: 4px; font-size:14px;">${links.join(' ')}</div>`;
      }

      let warningBadge = '';
      if (hasMissingInfo(e)) {
        warningBadge = `<span class="pill pill-red" style="font-size:8px; font-weight:700; background:rgba(192,69,58,.15); color:var(--red-soft); margin-left:6px; flex-shrink:0; vertical-align:middle;">⚠️ Infos manquantes</span>`;
      }

      return `
      <div class="pipe-card" onclick="openEventModal(${e._row})">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <div class="pipe-client" style="margin-bottom:0;">${e.nom_client || '—'}</div>
          ${warningBadge}
        </div>
        <div class="pipe-event">${e.type_evenement || 'Autre'} \xb7 ${e.nb_convives || '—'} pers.${e.date_evenement ? ' \xb7 ' + formatDateFR(e.date_evenement) : ''}</div>
        ${contactLine ? `<div class="pipe-contact" onclick="event.stopPropagation()">${contactLine}</div>` : ''}
        ${linksLine ? `<div onclick="event.stopPropagation()">${linksLine}</div>` : ''}
        <div class="pipe-footer" style="padding-top: 8px;">
          <div>
            <span class="pipe-amount" style="font-size:12px">${formatBudget(e.budget_estime)}</span>
            ${ageBadge}
          </div>
          <select class="pipe-status-sel pill ${STATUS_PILL[e.statut] || 'pill-gray'}" style="border:none; outline:none; cursor:pointer; font-family:inherit;" onchange="updateEventStatus(this,${e._row})" onclick="event.stopPropagation()">
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
    const result = await SheetsAPI.update(rowIndex, { 'statut': newStatus });
    if (result.success) {
      const row = appData.find(e => e._row === rowIndex);
      if (row) row.statut = newStatus;
      renderAll();
      showNotification('Statut mis à jour', 'success');
      // Notifier les autres onglets immédiatement
      broadcastSync();
      // Resynchronisation complète depuis le Sheet après un court délai
      setTimeout(() => loadData().catch(() => {}), 2000);
    } else {
      selectEl.disabled = false;
      showNotification('Erreur : ' + (result.error || 'inconnue'), 'error');
    }
  } catch (err) {
    selectEl.disabled = false;
    if (err && (err.message === 'Authorization required' || String(err).includes('Failed to fetch') || String(err).includes('NetworkError'))) {
      handleCalendarAuthError(err);
    } else {
      showNotification('Erreur réseau', 'error');
    }
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

  const CLIENTS_SCOPE = ['Événement confirmé'];
  const prestations = appData
    .filter(e => CLIENTS_SCOPE.includes(e.statut) && !isEventPast(e))
    .sort((a, b) => (a.date_evenement || '').localeCompare(b.date_evenement || ''));

  if (sub) sub.textContent = `${prestations.length} prestation${prestations.length > 1 ? 's' : ''} en cours`;

  if (!prestations.length) {
    container.innerHTML = '<div class="tbl-empty" style="padding:20px;">Aucune prestation en cours</div>';
    return;
  }

  container.innerHTML = prestations.map(e => {
    const pill   = `<span class="pill ${STATUS_PILL[e.statut] || 'pill-gray'}">${STATUS_LABEL[e.statut] || e.statut}</span>`;
    const contact = e.telephone ? formatContact(e.telephone) : '';
    const email   = e.email_client ? formatContact(e.email_client) : '';
    const contactLine = [contact, email].filter(v => v && v !== '—').join(' · ');

    let linksLine = '';
    const links = [];
    if (e.url_email_origine) links.push(`<a href="${e.url_email_origine}" target="_blank" style="color:var(--gold);text-decoration:underline;margin-right:12px;">✉️ Ouvrir l'e-mail</a>`);
    if (e.url_dossier_drive) links.push(`<a href="${e.url_dossier_drive}" target="_blank" style="color:var(--gold);text-decoration:underline;">📂 Ouvrir le dossier Drive</a>`);
    if (links.length) {
      linksLine = `<div style="margin-top: 6px; font-size:12px;">${links.join('')}</div>`;
    }

    return `<div class="prestation-card">
      <div class="pc-header" onclick="openEventModal(${e._row})" style="cursor:pointer">
        <div class="pc-line1"><strong>${e.nom_client || '—'}</strong> · ${e.type_evenement || 'Autre'} · <em>${formatDateFR(e.date_evenement)}</em></div>
        <div class="pc-line2">${formatBudget(e.budget_estime)} &nbsp;${pill}</div>
        ${contactLine ? `<div class="pc-contact">${contactLine}</div>` : ''}
        ${linksLine ? `<div onclick="event.stopPropagation()">${linksLine}</div>` : ''}
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
      <span class="pc-todo-text${t.done ? ' done' : ''}">${escHtml(t.text)}</span>
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
    .sort((a, b) => (b.date_evenement || '').localeCompare(a.date_evenement || ''));

  if (historiqueFilter === 'all') return allPast;

  const quarters = { T1: ['01','02','03'], T2: ['04','05','06'], T3: ['07','08','09'], T4: ['10','11','12'] };

  if (historiqueFilter === '2026') {
    return allPast.filter(e => String(e.date_evenement || '').startsWith('2026-'));
  }
  if (quarters[historiqueFilter]) {
    const months = quarters[historiqueFilter];
    return allPast.filter(e => {
      const ds = String(e.date_evenement || '').split('T')[0];
      return ds.startsWith('2026-') && months.includes(ds.slice(5, 7));
    });
  }
  if (historiqueFilter === 'range') {
    return allPast.filter(e => {
      const ds = String(e.date_evenement || '').split('T')[0];
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
    const notes  = String(e.notes || '');
    const notesTrunc = notes.length > 40 ? notes.slice(0, 40) + '…' : notes;
    return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
      <td><strong>${formatDateFR(e.date_evenement)}</strong></td>
      <td>${e.nom_client || '—'}</td>
      <td>${e.type_evenement || '—'}</td>
      <td>${e.lieu_prestation || '—'}</td>
      <td>${e.nb_convives || '—'}</td>
      <td>${formatBudget(e.budget_estime)}</td>
      <td><span class="pill ${STATUS_PILL[e.statut] || 'pill-gray'}">${STATUS_LABEL[e.statut] || e.statut}</span></td>
      <td>${e.email_client ? formatContact(e.email_client) : '—'}</td>
      <td>${e.telephone ? formatContact(e.telephone) : '—'}</td>
      <td title="${notes}">${notesTrunc || '—'}</td>
    </tr>`;
  }).join('');
}

function exportHistoriqueCSV() {
  const rows = getFilteredHistorique();
  const BOM  = '\uFEFF';
  const esc  = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const headers = ['ID Demande','Date Réception','Canal','Client','Téléphone','Email','Type','Date Événement','Convives','Lieu','Budget','Statut','Message','Email Origine','Notes','Dossier Drive','Dernière Modification'];
  const lines = [headers.join(';')].concat(rows.map(e => [
    e.id_demande || '',
    e.date_reception || '',
    e.canal || '',
    e.nom_client || '',
    e.telephone || '',
    e.email_client || '',
    e.type_evenement || '',
    e.date_evenement || '',
    e.nb_convives || '',
    e.lieu_prestation || '',
    e.budget_estime || '',
    e.statut || '',
    e.message_original || '',
    e.url_email_origine || '',
    e.notes || '',
    e.url_dossier_drive || '',
    e.derniere_modification || ''
  ].map(esc).join(';')));
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `chez-papi-historique-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── STATISTIQUES ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#C0453A', '#4A6741', '#D4A843', '#7B5EA7', '#2980B9',
  '#E67E22', '#1ABC9C', '#8E44AD', '#C0392B', '#16A085'
];

function switchHistTab(tab, btn) {
  document.getElementById('hist-view-liste').style.display = tab === 'liste' ? '' : 'none';
  document.getElementById('hist-view-stats').style.display = tab === 'stats' ? '' : 'none';
  document.querySelectorAll('.hist-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'stats') renderStats();
}

function renderStats() {
  // Utilise TOUTES les demandes (pas seulement l'historique filtré)
  const all = appData;
  renderPieChart(all);
  renderConversionTable(all);
}

function renderPieChart(rows) {
  const svg    = document.getElementById('stats-pie-svg');
  const legend = document.getElementById('stats-pie-legend');
  if (!svg || !legend) return;

  // Comptage par canal
  const counts = {};
  rows.forEach(e => {
    const canal = String(e.canal || 'Non renseigné').trim() || 'Non renseigné';
    counts[canal] = (counts[canal] || 0) + 1;
  });
  const total = rows.length;

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // SVG pie (arc paths)
  const cx = 100, cy = 100, r = 80;
  let startAngle = -Math.PI / 2; // début en haut
  let paths = '';
  let legendHtml = '';

  entries.forEach(([canal, count], i) => {
    const pct   = count / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const color = PIE_COLORS[i % PIE_COLORS.length];

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    if (entries.length === 1) {
      // Cercle plein si un seul canal
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
    } else {
      paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z"
        fill="${color}" stroke="#fcfaf7" stroke-width="2">
        <title>${canal} : ${count} (${Math.round(pct * 100)}%)</title>
      </path>`;
    }

    legendHtml += `
      <div class="pie-legend-item">
        <span class="pie-legend-dot" style="background:${color}"></span>
        <span>${canal}</span>
        <span class="pie-legend-pct">${Math.round(pct * 100)}%</span>
        <span style="color:var(--muted);font-size:.72rem">(${count})</span>
      </div>`;

    startAngle = endAngle;
  });

  if (!entries.length) {
    svg.innerHTML = `<text x="100" y="105" text-anchor="middle" font-size="13" fill="#8A7260">Aucune donnée</text>`;
    legend.innerHTML = '';
    return;
  }

  // Trou central (donut) + total
  paths += `<circle cx="${cx}" cy="${cy}" r="44" fill="#fcfaf7"/>`;
  paths += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#5C3D1E">${total}</text>`;
  paths += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="10" fill="#8A7260">demandes</text>`;

  svg.innerHTML = paths;
  legend.innerHTML = legendHtml;
}

function renderConversionTable(rows) {
  const tbody = document.getElementById('stats-conversion-tbody');
  if (!tbody) return;

  const CONFIRMED = ['Événement confirmé', 'Événement terminé'];

  // Comptage par canal
  const byCanal = {};
  rows.forEach(e => {
    const canal = String(e.canal || 'Non renseigné').trim() || 'Non renseigné';
    if (!byCanal[canal]) byCanal[canal] = { total: 0, confirmed: 0 };
    byCanal[canal].total++;
    if (CONFIRMED.includes(e.statut)) byCanal[canal].confirmed++;
  });

  const entries = Object.entries(byCanal).sort((a, b) => b[1].total - a[1].total);

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">Aucune donnée</td></tr>';
    return;
  }

  const maxPct = Math.max(...entries.map(([, v]) => v.total > 0 ? v.confirmed / v.total : 0));

  tbody.innerHTML = entries.map(([canal, v]) => {
    const pct  = v.total > 0 ? v.confirmed / v.total : 0;
    const pctDisplay = Math.round(pct * 100);
    // Largeur de la barre relative au maximum pour la lisibilité
    const barWidth = maxPct > 0 ? Math.round((pct / maxPct) * 100) : 0;
    return `<tr>
      <td><strong>${escHtml(canal)}</strong></td>
      <td style="text-align:center">${v.total}</td>
      <td style="text-align:center">${v.confirmed}</td>
      <td>
        <div class="conv-bar-wrap">
          <div class="conv-bar-bg"><div class="conv-bar-fill" style="width:${barWidth}%"></div></div>
          <span class="conv-pct">${pctDisplay}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

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
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html || '—'; };
  
  set('view-date-evt', formatDateFR(data.date_evenement));
  set('view-client', data.nom_client);
  set('view-type', data.type_evenement);
  set('view-invites', data.nb_convives);
  set('view-budget', formatBudget(data.budget_estime));
  set('view-statut', STATUS_LABEL[data.statut] || data.statut);
  setHtml('view-telephone', data.telephone ? formatContact(data.telephone) : '—');
  setHtml('view-email', data.email_client ? formatContact(data.email_client) : '—');
  set('view-lieu', data.lieu_prestation);
  set('view-canal', data.canal);
  set('view-date-reception', formatDateFR(data.date_reception));
  const clientEmail = data.email_client ? String(data.email_client).trim() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailKnown = clientEmail && clientEmail !== '—' && emailRegex.test(clientEmail);

  const replyContainer = document.getElementById('view-email-reply-container');
  const replyBtn = document.getElementById('view-email-reply-btn');

  if (isEmailKnown) {
    if (replyContainer && replyBtn) {
      replyContainer.style.display = 'block';

      let subject = 'Votre demande Chez Papi';
      if (data.type_evenement && String(data.type_evenement).trim() !== '—') {
        subject += ` - ${String(data.type_evenement).trim()}`;
      }

      const clientName = data.nom_client && String(data.nom_client).trim() !== '—' ? String(data.nom_client).trim() : '';
      const salutation = clientName ? `Bonjour ${clientName},\n\n` : `Bonjour,\n\n`;

      let body = `${salutation}Merci pour votre intérêt pour Chez Papi.\n\n`;

      const missing = [];
      const noPhone = !data.telephone || String(data.telephone).trim() === '' || String(data.telephone).trim() === '—';
      const noLieu = !data.lieu_prestation || String(data.lieu_prestation).trim() === '' || String(data.lieu_prestation).trim() === '—';
      const noConvives = !data.nb_convives || String(data.nb_convives).trim() === '' || String(data.nb_convives).trim() === '—' || String(data.nb_convives).trim() === '0';
      const noDate = !data.date_evenement || String(data.date_evenement).trim() === '' || String(data.date_evenement).trim() === '—';

      if (noPhone) missing.push("votre numéro de téléphone");
      if (noLieu) missing.push("le lieu de l'événement");
      if (noConvives) missing.push("le nombre de convives attendu");
      if (noDate) missing.push("la date souhaitée pour l'événement");

      if (missing.length > 0) {
        body += `Afin d'étudier au mieux votre demande, pourriez-vous nous préciser :\n`;
        missing.forEach(item => {
          body += `- ${item}\n`;
        });
        body += `\n`;
      }

      body += `Restant à votre entière disposition,\n\nL'équipe Chez Papi\nhttps://www.chez-papi.fr/`;

      // Citation du message original en format standard email (lignes préfixées ">")
      // Gmail reconnaît ce format et l'affiche dans la même conversation si l'objet correspond
      const origMsg = data.message_original ? String(data.message_original).trim() : '';
      if (origMsg && origMsg !== '—') {
        const receptionDate = data.date_reception ? formatDateFR(data.date_reception) : '';
        const quoted = origMsg.split('\n').map(line => `> ${line}`).join('\n');
        body += `\n\n\n`;
        body += `Le ${receptionDate}${receptionDate ? ', ' : ''}${clientEmail} a écrit :\n`;
        body += quoted;
      }

      // Préfixe "Re:" → Gmail rattache ce mail au fil de conversation existant
      const replySubject = `Re: ${subject}`;

      replyBtn.href = `https://mail.google.com/mail/u/demande.chezpapimaisongourmande@gmail.com/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(body)}`;
    }
  } else {
    if (replyContainer) {
      replyContainer.style.display = 'none';
    }
  }
  
  let modifStr = '—';
  if (data.derniere_modification) {
    const d = new Date(data.derniere_modification);
    if (!isNaN(d.getTime())) {
      modifStr = d.toLocaleString('fr-FR');
    } else {
      modifStr = String(data.derniere_modification);
    }
  }
  set('view-derniere-modif', modifStr);
  set('view-message', data.message_original);
  set('view-notes', data.notes);

  const warningEl = document.getElementById('view-warning-missing-info');
  if (warningEl) {
    const missingFields = getMissingFields(data);
    if (missingFields.length > 0) {
      warningEl.innerHTML = `⚠️ <strong>Infos manquantes :</strong> veuillez renseigner le/les champ(s) : ${missingFields.join(', ')}.`;
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }

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
    const existing = appData.find(e => e._row === rowIndex);
    if (existing) {
      for (const el of form.elements) {
        if (el.name && el.name in existing) {
          const val = existing[el.name];
          el.value = (val === null || val === undefined || val === '—') ? '' : val;
        }
      }
    }
  } else {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    form.elements['date_reception'].value = localToday;
    form.elements['statut'].value  = 'Nouvelle demande';
  }

  const btnDel = document.getElementById('btn-delete-event');
  if (btnDel) btnDel.style.display = rowIndex ? 'block' : 'none';

  // Quick mode pour nouvelle saisie, full mode pour édition
  formMode = rowIndex ? 'full' : 'quick';
  applyFormMode();

  // Réinitialiser la bannière conflit de date
  const conflictBanner = document.getElementById('date-conflict-banner');
  if (conflictBanner) conflictBanner.style.display = 'none';

  if (rowIndex) {
    const existing = appData.find(e => e._row === rowIndex);
    if (existing) {
      const dateVal = existing['date_evenement'];
      const dateMatch = dateVal ? String(dateVal).match(/\d{4}-\d{2}-\d{2}/) : null;
      if (dateMatch) {
        checkDateConflict(dateMatch[0]);
      }
    }
  }

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
    if (e.statut !== 'Événement confirmé') return false;
    return String(e.date_evenement || '').includes(dateValue);
  });

  banner.style.display = 'block';
  if (conflicts.length) {
    const c = conflicts[0];
    banner.style.cssText = 'display:block;padding:8px 12px;border-radius:4px;font-size:12px;margin:4px 0 8px;background:rgba(245,166,35,0.15);color:#B86A00;border:1px solid rgba(245,166,35,0.4);';
    banner.textContent = `⚠️ ${c.nom_client || 'Sans nom'} (${c.type_evenement || 'Autre'}) est déjà confirmé à cette date`;
  } else {
    banner.style.cssText = 'display:block;padding:8px 12px;border-radius:4px;font-size:12px;margin:4px 0 8px;background:rgba(74,103,65,0.12);color:#4A6741;border:1px solid rgba(74,103,65,0.3);';
    banner.textContent = '✓ Date disponible';
  }
}

document.getElementById('event-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('event-modal')) closeEventModal();
});

// Vérification conflit de date
document.getElementById('event-form').addEventListener('change', e => {
  if (e.target.name === 'date_evenement') {
    // Si la valeur ressemble à une date simple YYYY-MM-DD, lance le test de conflit
    const dateMatch = e.target.value.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      checkDateConflict(dateMatch[0]);
    } else {
      const banner = document.getElementById('date-conflict-banner');
      if (banner) banner.style.display = 'none';
    }
  }
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
        if (row) {
          Object.assign(row, data);
          row.derniere_modification = new Date().toISOString();

          // Si la date de l'événement a changé, caler l'agenda sur le nouveau mois
          const newDate = data.date_evenement ? String(data.date_evenement).slice(0, 10) : null;
          if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const d = new Date(newDate + 'T12:00:00');
            if (!isNaN(d.getTime())) {
              agendaYear  = d.getFullYear();
              agendaMonth = d.getMonth();
            }
          }
        }
        renderAll();
        closeEventModal();
        showNotification('Événement mis à jour', 'success');
        // Notifier les autres onglets immédiatement
        broadcastSync();
        // Resynchronisation complète depuis le Sheet pour garantir la cohérence de tous les onglets
        setTimeout(() => loadData().catch(() => {}), 2000);
      }
    } else {
      result = await SheetsAPI.add(data);
      if (result.success) {
        broadcastSync(); // Notifier les autres onglets
        await loadData();
        closeEventModal();
        showNotification('Événement ajouté', 'success');
        return;
      }
    }
    if (!result.success) showNotification('Erreur : ' + (result.error || 'inconnue'), 'error');
  } catch (err) {
    if (err && (err.message === 'Authorization required' || String(err).includes('Failed to fetch') || String(err).includes('NetworkError'))) {
      handleCalendarAuthError(err);
    } else {
      showNotification('Erreur réseau', 'error');
    }
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
      // Recharger depuis le sheet pour que les _row soient cohérents après suppression
      if (typeof closeEventModal === 'function') closeEventModal();
      if (typeof closeViewModal === 'function') closeViewModal();
      showNotification('Événement supprimé', 'success');
      broadcastSync(); // Notifier les autres onglets
      await loadData();
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

// ── RENDER: AGENDA ──

const MONTHS_FR_AGENDA = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
let agendaYear  = new Date().getFullYear();
let agendaMonth = new Date().getMonth();

function agendaPrevMonth() {
  if (--agendaMonth < 0) { agendaMonth = 11; agendaYear--; }
  renderAgenda();
}
function agendaNextMonth() {
  if (++agendaMonth > 11) { agendaMonth = 0; agendaYear++; }
  renderAgenda();
}
function agendaGoToday() {
  const now = new Date();
  agendaYear  = now.getFullYear();
  agendaMonth = now.getMonth();
  renderAgenda();
}

// ── Picker mois/année ──
let pickerYear = new Date().getFullYear();

function toggleAgendaPicker(e) {
  e?.stopPropagation();
  const picker = document.getElementById('agenda-picker');
  if (!picker) return;
  if (picker.style.display === 'none') {
    pickerYear = agendaYear;
    renderAgendaPicker();
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

function closeAgendaPicker() {
  const picker = document.getElementById('agenda-picker');
  if (picker) picker.style.display = 'none';
}

function agendaPickerPrevYear(e) {
  e?.stopPropagation();
  pickerYear--;
  renderAgendaPicker();
}

function agendaPickerNextYear(e) {
  e?.stopPropagation();
  pickerYear++;
  renderAgendaPicker();
}

function selectAgendaMonth(month) {
  agendaYear  = pickerYear;
  agendaMonth = month;
  closeAgendaPicker();
  renderAgenda();
}

function renderAgendaPicker() {
  const yearEl   = document.getElementById('agenda-picker-year');
  const monthsEl = document.getElementById('agenda-picker-months');
  if (!yearEl || !monthsEl) return;

  const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const now = new Date();
  yearEl.textContent = pickerYear;

  monthsEl.innerHTML = MONTHS_SHORT.map((m, i) => {
    const isSelected = (pickerYear === agendaYear && i === agendaMonth);
    const isToday    = (pickerYear === now.getFullYear() && i === now.getMonth());
    const style = isSelected
      ? 'background:var(--brown-dk);color:#fff;border-color:var(--brown-dk);font-weight:700;'
      : isToday
        ? 'background:var(--warm);color:var(--brown-dk);border-color:var(--gold);font-weight:600;'
        : 'background:#fff;color:var(--text);border-color:var(--border);';
    return `<button onclick="selectAgendaMonth(${i})" style="padding:6px 4px;border-radius:4px;border:1px solid;font-size:0.8rem;cursor:pointer;${style}">${m}</button>`;
  }).join('');
}

// Ferme le picker si clic en dehors
document.addEventListener('click', e => {
  const picker = document.getElementById('agenda-picker');
  if (picker && picker.style.display !== 'none' && !picker.contains(e.target)) {
    closeAgendaPicker();
  }
});

function renderAgenda() {
  const labelEl = document.getElementById('agenda-month-label');
  const subEl   = document.getElementById('agenda-sub');
  const listEl  = document.getElementById('agenda-list');
  if (!listEl) return;

  const monthPfx = `${agendaYear}-${String(agendaMonth + 1).padStart(2, '0')}`;
  const events = appData
    .filter(e => {
      const d = e.date_evenement;
      return d && String(d).slice(0, 7) === monthPfx;
    })
    .sort((a, b) => (a.date_evenement || '').localeCompare(b.date_evenement || ''));

  if (labelEl) labelEl.textContent = `${MONTHS_FR_AGENDA[agendaMonth]} ${agendaYear}`;
  if (subEl) subEl.textContent = events.length ? `${events.length} \u00e9v\u00e9nement${events.length > 1 ? 's' : ''}` : '';

  if (!events.length) {
    listEl.innerHTML = '<div class="tbl-empty" style="padding:24px 16px;">Aucun \u00e9v\u00e9nement ce mois</div>';
    return;
  }

  listEl.innerHTML =
    '<table class="tbl" style="padding:0;">' +
    '<thead><tr>' +
    '<th style="padding-left:16px;width:16%">Date</th>' +
    '<th style="width:26%">Client</th>' +
    '<th style="width:18%">Type</th>' +
    '<th style="width:18%">Budget</th>' +
    '<th style="width:22%">Statut</th>' +
    '</tr></thead><tbody>' +
    events.map(e => {
      return `<tr style="cursor:pointer" onclick="openEventModal(${e._row})">
        <td style="padding-left:16px;"><strong>${formatDateFR(e.date_evenement)}</strong></td>
        <td>${e.nom_client || '—'}</td>
        <td>${e.type_evenement || '\u2014'}</td>
        <td>${formatBudget(e.budget_estime)}</td>
        <td><span class="pill ${STATUS_PILL[e.statut] || 'pill-gray'}">${STATUS_LABEL[e.statut] || e.statut}</span></td>
      </tr>`;
    }).join('') +
    '</tbody></table>';
}

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
    const CA_STATUTS = ['Événement confirmé', 'Événement terminé'];
    const yearlySigned = appData.filter(e => {
      if (!CA_STATUTS.includes(e.statut)) return false;
      if (!e.date_evenement) return false;
      let dateStr = String(e.date_evenement).trim();
      const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) dateStr = dateMatch[0];
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });

    const cm = {};
    yearlySigned.forEach(e => {
      const n = e.nom_client || 'Inconnu';
      if (!cm[n]) cm[n] = 0;
      
      const sBudget = String(e.budget_estime || '').replace(/\s/g, '');
      const numMatch = sBudget.match(/\d+/);
      const budgetVal = numMatch ? parseFloat(numMatch[0]) : 0;
      cm[n] += budgetVal;
    });
    const rows = Object.entries(cm).sort((a,b)=>b[1]-a[1]);
    
    thead.innerHTML = '<tr><th>Client</th><th>CA Signé</th></tr>';
    tbody.innerHTML = rows.length ? rows.map(([c, v]) => `<tr><td>${c}</td><td><strong>${formatEuro(v)}</strong></td></tr>`).join('') : '<tr><td colspan="2" class="tbl-empty">Aucun CA</td></tr>';
    const total = rows.reduce((s, r)=>s+r[1], 0);
    if(rows.length) tfoot.innerHTML = `<tr><td><strong>TOTAL</strong></td><td><strong>${formatEuro(total)}</strong></td></tr>`;
  } 
  else if (type === 'confirmes') {
    title.textContent = 'Événements confirmés';
    const CONF_STATUSES = ['Événement confirmé'];
    const evts = actives.filter(e => CONF_STATUSES.includes(e.statut));
    evts.sort((a,b) => {
      let d1 = String(a.date_evenement||'').split('T')[0];
      let d2 = String(b.date_evenement||'').split('T')[0];
      return new Date(d1).getTime() - new Date(d2).getTime();
    });
    
    thead.innerHTML = '<tr><th style="width:22%">Date</th><th style="width:36%">Client</th><th style="width:24%">Type</th><th style="width:18%">Montant</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td>${formatDateFR(e.date_evenement)}</td><td><strong>${e.nom_client || '—'}</strong></td><td>${e.type_evenement || '—'}</td><td>${formatBudget(e.budget_estime)}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="tbl-empty">Aucun événement signé</td></tr>';
  }
  else if (type === 'devis') {
    title.textContent = 'Devis en attente';
    const evts = actives.filter(e => e.statut === 'Devis envoyé');
    evts.sort((a,b) => {
      let d1 = String(a.date_evenement||'').split('T')[0];
      let d2 = String(b.date_evenement||'').split('T')[0];
      return new Date(d1).getTime() - new Date(d2).getTime();
    });
    
    thead.innerHTML = '<tr><th style="width:30%">Date prévue</th><th style="width:45%">Client</th><th style="width:25%">Montant</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td>${formatDateFR(e.date_evenement)}</td><td><strong>${e.nom_client || '—'}</strong></td><td>${formatBudget(e.budget_estime)}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="tbl-empty">Aucun devis en attente</td></tr>';
  }
  else if (type === 'leads') {
    title.textContent = 'Nouvelles demandes';
    const evts = actives.filter(e => e.statut === 'Nouvelle demande' || e.statut === 'À rappeler');
    evts.sort((a,b) => {
      let d1 = String(a.date_evenement||'').split('T')[0];
      let d2 = String(b.date_evenement||'').split('T')[0];
      return new Date(d1).getTime() - new Date(d2).getTime();
    });
    
    thead.innerHTML = '<tr><th style="width:32%">Client</th><th style="width:22%">Date</th><th style="width:22%">Montant</th><th style="width:24%">Statut</th></tr>';
    tbody.innerHTML = evts.length ? evts.map(e => {
      return `<tr style="cursor:pointer" onclick="document.getElementById('kpi-modal').style.display='none'; openEventModal(${e._row})"><td><strong>${e.nom_client || '—'}</strong></td><td>${formatDateFR(e.date_evenement) || 'À dét.'}</td><td>${formatBudget(e.budget_estime)}</td><td>${STATUS_LABEL[e.statut] || e.statut}</td></tr>`;
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
  
  const sidebarItem = document.querySelector(`.nav-item[data-panel="${panelName}"]`);
  if (sidebarItem && sidebarItem !== element) sidebarItem.classList.add('active');
  
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

function handleCalendarAuthError(err) {
  console.error("Calendar Auth/CORS Error:", err);
  const confirmMsg = "L'application a besoin de votre autorisation pour accéder à Google Calendar.\n\nCliquer sur OK pour ouvrir la page d'autorisation Google dans un nouvel onglet. Une fois l'accès accordé, revenez ici et rechargez la page.";
  if (confirm(confirmMsg)) {
    window.open(CONFIG.SHEETS_URL, '_blank');
  }
}

// ── AUTHENTICATION HANDLERS ──

function logout() {
  localStorage.removeItem('cp_user');
  localStorage.removeItem('cp_pass');
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
  const errorMsg = document.getElementById('login-error-msg');
  if (errorMsg) {
    errorMsg.textContent = "⚠️ Session expirée ou identifiants incorrects.";
    errorMsg.style.display = 'block';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passInput  = document.getElementById('login-password');
  const errorMsg   = document.getElementById('login-error-msg');
  const btn        = event.target.querySelector('button[type="submit"]') || event.target.querySelector('button');

  const userVal = emailInput?.value.trim();
  const passVal = passInput?.value.trim();

  if (!userVal || !passVal) {
    if (errorMsg) {
      errorMsg.textContent = '⚠️ Veuillez renseigner votre identifiant et votre mot de passe.';
      errorMsg.style.display = 'block';
    }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Connexion…'; }
  if (errorMsg) errorMsg.style.display = 'none';

  // Stocker temporairement pour l'appel API
  localStorage.setItem('cp_user', userVal);
  localStorage.setItem('cp_pass', passVal);

  try {
    // La validation réelle est faite par le backend (checkAuth dans code.gs)
    await loadData();
    // Succès : masquer l'overlay
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';
  } catch (err) {
    // Échec = identifiants rejetés par le backend ou erreur réseau
    localStorage.removeItem('cp_user');
    localStorage.removeItem('cp_pass');
    if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
    if (errorMsg) {
      const isAuthError = err.message === 'Identifiants invalides' || err.message === 'Authorization required';
      errorMsg.textContent = isAuthError
        ? '❌ Identifiant ou mot de passe incorrect.'
        : '⚠️ Connexion impossible. Vérifiez votre réseau et réessayez.';
      errorMsg.style.display = 'block';
    }
    // Secouer le formulaire pour feedback visuel
    const form = event.target;
    form.classList.add('login-shake');
    setTimeout(() => form.classList.remove('login-shake'), 500);
  }
}

document.getElementById('login-form')?.addEventListener('submit', handleLoginSubmit);

// ── Synchronisation multi-onglets via localStorage (todos + session) ──────────

window.addEventListener('storage', (e) => {
  // Todos : une tâche a changé dans un autre onglet → re-render la liste concernée
  if (e.key && e.key.startsWith('todos_')) {
    const rowId = parseInt(e.key.replace('todos_', ''), 10);
    if (!isNaN(rowId)) {
      try { if (typeof renderTodos === 'function') renderTodos(rowId); } catch {}
    }
  }

  // Session : connexion dans un autre onglet → charger les données
  if (e.key === 'cp_user' && e.newValue && !e.oldValue) {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';
    loadData().catch(() => {});
  }

  // Session : déconnexion dans un autre onglet → afficher le login
  if (e.key === 'cp_user' && !e.newValue) {
    localStorage.removeItem('cp_pass');
    stopBackgroundPolling();
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'flex';
  }
});

// ── INIT ──

const savedUser = localStorage.getItem('cp_user');
const savedPass = localStorage.getItem('cp_pass');
if (savedUser && savedPass) {
  // Tentative de connexion automatique — le backend valide les credentials
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
  loadData().catch(() => {
    // Credentials stockés invalides → afficher le login
    localStorage.removeItem('cp_user');
    localStorage.removeItem('cp_pass');
    if (overlay) overlay.style.display = 'flex';
  });
} else {
  // Aucun credential stocké
}

// ── EXPORT ──

window.ChezPapi = {
  SheetsAPI, showPanel, toggleSidebar, showNotification, loadData, openEventModal, showViewModal, closeViewModal, deleteCurrentEvent, showKpiModal,
  renderHistorique, setHistoriqueFilter, applyHistoriqueDateRange, exportHistoriqueCSV,
  switchHistTab,
  renderAgenda, agendaPrevMonth, agendaNextMonth, agendaGoToday,
  toggleAgendaPicker, agendaPickerPrevYear, agendaPickerNextYear, selectAgendaMonth,
  addTodo, toggleTodo, deleteTodo, toggleFormMode, checkDateConflict,
  logout,
  async testConnection() {
    console.log('Test connexion →', CONFIG.SHEETS_URL);
    try {
      const user = localStorage.getItem('cp_user') || '';
      const pass = localStorage.getItem('cp_pass') || '';
      const url = CONFIG.SHEETS_URL + '?action=getAll&user=' + encodeURIComponent(user) + '&pass=' + encodeURIComponent(pass);
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      console.log('Status :', res.status);
      console.log('Réponse (200 premiers chars) :', text.slice(0, 200));
      try { console.log('JSON parsé :', JSON.parse(text)); } catch { console.warn('Pas du JSON valide'); }
    } catch (e) { console.error('Erreur réseau :', e); }
  },
};
console.log('Chez Papi PWA initialized \u2713');
