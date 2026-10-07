/**
 * ─────────────────────────────────────────────────────────────────
 *  CHEZ PAPI — Google Apps Script Backend
 *  À déployer depuis : Extensions > Apps Script dans le Google Sheet
 * ─────────────────────────────────────────────────────────────────
 *  Déploiement recommandé : GitHub + clasp.
 *  Secrets requis dans PropertiesService :
 *    AUTH_USER, AUTH_PASS
 * ─────────────────────────────────────────────────────────────────
 */

// Prend le premier onglet du sheet automatiquement
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function onOpen() {
  applyDefaultRowHeights(getSheet());
}

function onEdit(e) {
  if (e && e.range) applyDefaultRowHeight(e.range.getSheet(), e.range.getRow());
}

const FRONTEND_URL = "https://efficy-conseil.github.io/chez-papi/";

const AUTH_USER_PROP = "AUTH_USER";
const AUTH_PASS_PROP = "AUTH_PASS";
const MAKE_FOLLOWUP_TOKEN = "cp_make_followup_2026_06";
const MAKE_ERROR_DELAY_MS = 20000;
const DEFAULT_ROW_HEIGHT_PX = 20;
const VOICEMAIL_MAX_RESULTS = 30;
const VOICEMAIL_HISTORY_LABEL = 'Historique_OVH';
const VOICEMAIL_QUERY = 'label:Historique_OVH is:unread';
const PENDING_VOICEMAIL_QUERY = 'in:inbox is:unread from:no-reply@ovh.fr';
const VOICEMAIL_MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const VOICEMAIL_GMAIL_ACCOUNT = 'demande.chezpapimaisongourmande@gmail.com';
const VOICEMAIL_ANALYSIS_TIMEZONE = 'Europe/Paris';
const VOICEMAIL_ANALYSIS_HOURS = [6, 12, 16, 21];
const DISCARDED_VOICEMAILS_PROPERTY = 'discarded-ovh-voicemails-v1';
const DISCARDED_VOICEMAILS_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;
let DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT = false;

const ALLOWED_STATUSES = [
  "Nouvelle demande",
  "À vérifier",
  "À rappeler",
  "En attente de réponse",
  "Devis à préparer",
  "Devis envoyé",
  "Événement confirmé",
  "Événement terminé",
  "Perdu / Sans suite",
  "Refusé / Complet"
];

const ALLOWED_CHANNELS = [
  "Téléphone",
  "Email",
  "Site Internet",
  "Réseaux sociaux",
  "Saisie manuelle"
];

// Ces champs décrivent la demande elle-même. Lors d'un suivi, Make peut
// compléter une valeur absente, mais ne peut remplacer une valeur existante
// que si le message récent indique explicitement cette modification.
const FOLLOWUP_PROTECTED_FIELDS = [
  "nom_client",
  "telephone",
  "email_client",
  "type_evenement",
  "date_evenement",
  "heure_evenement",
  "nb_convives",
  "lieu_prestation",
  "budget_estime",
  "statut",
  "message_original",
  "notes"
];

const ALLOWED_FIELDS = [
  "date_reception",
  "canal",
  "nom_client",
  "telephone",
  "email_client",
  "type_evenement",
  "date_evenement",
  "heure_evenement",
  "nb_convives",
  "lieu_prestation",
  "budget_estime",
  "statut",
  "message_original",
  "url_email_origine",
  "notes",
  "url_dossier_drive",
  "gmail_thread_id",
  "gmail_message_id",
  "wix_form_fingerprint",
  "dernier_email_recu_le",
  "dernier_message_client",
  "nb_relances_client",
  "relance_a_traiter",
  "en_attente_reponse_depuis",
  "derniere_modification"
];

const SCHEMA_HEADERS = [
  "gmail_thread_id",
  "gmail_message_id",
  "wix_form_fingerprint",
  "dernier_email_recu_le",
  "dernier_message_client",
  "nb_relances_client",
  "relance_a_traiter",
  "en_attente_reponse_depuis",
  "make_operation_log"
];

const KEY_MAP = {
  "id_demande": "id_demande",
  "ID Demande": "id_demande",
  "id demande": "id_demande",
  "statut": "statut",
  "Statut": "statut",
  "nom_client": "nom_client",
  "Nom Client": "nom_client",
  "Client": "nom_client",
  "date_evenement": "date_evenement",
  "Date Evenement": "date_evenement",
  "Date Événement": "date_evenement",
  "heure_evenement": "heure_evenement",
  "Heure Evenement": "heure_evenement",
  "Heure Événement": "heure_evenement",
  "Heure": "heure_evenement",
  "type_evenement": "type_evenement",
  "Type": "type_evenement",
  "Type Evenement": "type_evenement",
  "Type Événement": "type_evenement",
  "lieu_prestation": "lieu_prestation",
  "Lieu": "lieu_prestation",
  "Lieu Prestation": "lieu_prestation",
  "nb_convives": "nb_convives",
  "Convives": "nb_convives",
  "Nb Convives": "nb_convives",
  "budget_estime": "budget_estime",
  "Budget": "budget_estime",
  "Budget Estime": "budget_estime",
  "notes": "notes",
  "Notes": "notes",
  "telephone": "telephone",
  "Telephone": "telephone",
  "Téléphone": "telephone",
  "email_client": "email_client",
  "Email": "email_client",
  "Email Client": "email_client",
  "date_reception": "date_reception",
  "Date Réception": "date_reception",
  "Date Reception": "date_reception",
  "canal": "canal",
  "Canal": "canal",
  "message_original": "message_original",
  "Message Original": "message_original",
  "url_email_origine": "url_email_origine",
  "URL Email Origine": "url_email_origine",
  "url_dossier_drive": "url_dossier_drive",
  "URL Dossier Drive": "url_dossier_drive",
  "gmail_thread_id": "gmail_thread_id",
  "Gmail Thread ID": "gmail_thread_id",
  "gmail_message_id": "gmail_message_id",
  "Gmail Message ID": "gmail_message_id",
  "wix_form_fingerprint": "wix_form_fingerprint",
  "Wix Form Fingerprint": "wix_form_fingerprint",
  "dernier_email_recu_le": "dernier_email_recu_le",
  "Dernier Email Reçu Le": "dernier_email_recu_le",
  "dernier_message_client": "dernier_message_client",
  "Dernier Message Client": "dernier_message_client",
  "nb_relances_client": "nb_relances_client",
  "Nb Relances Client": "nb_relances_client",
  "relance_a_traiter": "relance_a_traiter",
  "Relance À Traiter": "relance_a_traiter",
  "en_attente_reponse_depuis": "en_attente_reponse_depuis",
  "En Attente Réponse Depuis": "en_attente_reponse_depuis",
  "make_operation_log": "make_operation_log",
  "Make Operation Log": "make_operation_log",
  "derniere_modification": "derniere_modification",
  "Dernière Modification": "derniere_modification"
};

function checkAuth(user, pass) {
  const props = PropertiesService.getScriptProperties();
  return user === props.getProperty(AUTH_USER_PROP) && pass === props.getProperty(AUTH_PASS_PROP);
}

// À exécuter une seule fois depuis l'éditeur Apps Script, puis supprimer les valeurs.
function setupAuthSecrets() {
  PropertiesService.getScriptProperties().setProperties({
    AUTH_USER: "REMPLACER_PAR_EMAIL",
    AUTH_PASS: "REMPLACER_PAR_MOT_DE_PASSE"
  }, true);
}

// ── GET : désactivé pour ne pas exposer les identifiants en URL ─────────────

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: "Utilisez POST" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST : lecture / écriture ──────────────────────────────────

function doPost(e) {
  const rawBody = String(e && e.postData && e.postData.contents || '');
  DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT = rawBody.indexOf(MAKE_FOLLOWUP_TOKEN) >= 0;
  let action = 'requete_invalide';
  try {
    const body = JSON.parse(rawBody);
    action = String(body.action || 'action_inconnue');
    const auth = body.auth || { user: body.user, pass: body.pass };
    const isMakeFollowup = (
      (body.action === 'updateThreadFollowup' || body.action === 'updateWixFollowup' || body.action === 'updateExistingDemandFollowup' || body.action === 'checkDuplicate' || body.action === 'upsertWixDemand' || body.action === 'createMakeDemand' || body.action === 'mergeWixDuplicateDemand' || body.action === 'mergeVoxistDuplicateDemand' || body.action === 'archiveOvhVoicemail') &&
      body.make_token === MAKE_FOLLOWUP_TOKEN
    );
    if (!isMakeFollowup && !checkAuth(auth.user, auth.pass)) {
      return ko("Non autorisé");
    }

    if (body.action === 'list' || body.action === 'getAll') return listRows();
    if (body.action === 'listVoicemails') return listUnreadVoicemails();
    if (body.action === 'getVoicemailAudio') return getVoicemailAudio(body.message_id);
    if (body.action === 'linkVoicemailToDemand') return withDocumentLock(function() { return linkVoicemailToDemand(body.message_id, body.id_demande); });
    if (body.action === 'markVoicemailRead') return markVoicemailRead(body.message_id);
    if (body.action === 'trashVoicemail') return trashVoicemail(body.message_id);
    if (body.action === 'archiveOvhVoicemail') return archiveOvhVoicemail(body.message_id);
    if (body.action === 'add')    return withDocumentLock(function() { return addRow(body.row || {}, body.options || {}); });
    if (body.action === 'update') return withDocumentLock(function() { return updateRowById(body.id_demande, body.fields || {}); });
    if (body.action === 'updateThreadFollowup') return withDocumentLock(function() { return updateThreadFollowup(body.gmail_thread_id, body.fields || {}, body.options || {}); });
    if (body.action === 'updateWixFollowup') return withDocumentLock(function() { return updateWixFollowup(body.gmail_thread_id, body.email_client, body.fields || {}, body.options || {}); });
    if (body.action === 'updateExistingDemandFollowup') return withDocumentLock(function() { return updateExistingDemandFollowup(body.match || {}, body.fields || {}, body.options || {}); });
    if (body.action === 'checkDuplicate') return checkDuplicate(body.match || {});
    if (body.action === 'upsertWixDemand') return withDocumentLock(function() { return upsertWixDemand(body.row || {}, body.options || {}); });
    if (body.action === 'createMakeDemand') return withDocumentLock(function() { return createMakeDemand(body.row || {}); });
    if (body.action === 'mergeWixDuplicateDemand') return withDocumentLock(function() { return mergeWixDuplicateDemand(body.primary_id_demande, body.wix_duplicate_id); });
    if (body.action === 'mergeVoxistDuplicateDemand') return withDocumentLock(function() { return mergeVoxistDuplicateDemand(body.primary_id_demande, body.voxist_duplicate_id); });
    if (body.action === 'mergeDemandRecords') return withDocumentLock(function() { return mergeDemandRecords(body.source_id_demande, body.target_id_demande); });
    if (body.action === 'delete') return withDocumentLock(function() { return deleteRowById(body.id_demande); });
    return ko('Action inconnue : ' + body.action);
  } catch (err) {
    const message = String(err && err.message || err || 'Erreur backend inconnue');
    // Les erreurs Make sont volontairement retardées pour déclencher la reprise
    // HTTP. Sans cette trace, Make ne conserve que son propre timeout et masque
    // la cause initiale dans Apps Script.
    Logger.log('Erreur Make [' + action + '] : ' + message);
    return ko(message);
  } finally {
    DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT = false;
  }
}

function createMakeDemand(rowData) {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const raw = normalizeRowKeys(rowData || {});
  const clean = sanitizeFields(raw, false);
  clean.id_demande = String(raw.id_demande || '').trim();
  if (!clean.id_demande) throw new Error('id_demande manquant');

  const existing = findRowByDemandId(sheet, headers, clean.id_demande);
  if (existing) return ok({ id_demande: clean.id_demande, row: existing.rowIndex, created: false, replayed: true });

  // Deux vocaux distincts peuvent appartenir au même dossier. Contrairement à
  // checkDuplicate, qui ne protège que la reprise du même message Gmail, ce
  // rapprochement métier est volontairement limité à un téléphone et une date
  // d'événement identiques, et seulement si la cible active est unique.
  if (clean.id_demande.indexOf('VOXIST-') === 0) {
    const matches = findActiveRowsByPhoneAndEventDate(
      sheet,
      headers,
      clean.telephone,
      clean.date_evenement
    );
    if (matches.length === 1) {
      const target = matches[0];
      const followupFields = {
        gmail_thread_id: clean.gmail_thread_id,
        gmail_message_id: clean.gmail_message_id,
        url_email_origine: clean.url_email_origine,
        dernier_email_recu_le: clean.date_reception,
        dernier_message_client: clean.message_original,
        relance_a_traiter: true,
        telephone: clean.telephone,
        derniere_modification: new Date()
      };
      writeMakeFollowup(sheet, headers, target.rowIndex, followupFields, {
        created: false,
        merged: true,
        updated: true,
        matched_by: 'telephone_et_date_evenement'
      });
      applyDefaultRowHeight(sheet, target.rowIndex);
      return ok({
        id_demande: target.id_demande,
        row: target.rowIndex,
        created: false,
        merged: true,
        updated: true,
        matched_by: 'telephone_et_date_evenement'
      });
    }
  }

  if (!clean.date_reception) clean.date_reception = new Date();
  if (!clean.date_evenement) clean.date_evenement = 'Inconnu / à compléter';
  clean.derniere_modification = new Date();
  sheet.appendRow(headers.map(function(h) { return clean[canonicalKey(h)] ?? ''; }));
  clean._row = sheet.getLastRow();
  forceTextCell(sheet, headers, clean._row, 'date_evenement', clean.date_evenement);
  applyDefaultRowHeight(sheet, clean._row);
  return ok({ id_demande: clean.id_demande, row: clean._row, created: true, replayed: false });
}

function withDocumentLock(fn) {
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function listRows() {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const range = sheet.getDataRange();
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  const headers = data[0].map(String);
  const rows = data.slice(1)
    .map((row, i) => {
      const obj = { _row: i + 2 };
      const displayRow = displayData[i + 1] || [];
      headers.forEach((h, j) => {
        const key = canonicalKey(h);
        obj[key] = serialiseCell(key, row[j], displayRow[j]);
      });
      return obj;
    })
    .filter(r => Object.keys(r).some(k => k !== "_row" && r[k] !== undefined && String(r[k]).trim() !== ""));

  return ok({ headers, rows });
}

// ── Messages vocaux OVH conservés dans Gmail ────────────────────────────────

function listUnreadVoicemails() {
  ensureVoicemailMailbox();
  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  const processedResponse = Gmail.Users.Messages.list('me', {
    q: VOICEMAIL_QUERY,
    maxResults: VOICEMAIL_MAX_RESULTS,
    includeSpamTrash: false
  }) || {};
  const pendingResponse = Gmail.Users.Messages.list('me', {
    q: PENDING_VOICEMAIL_QUERY,
    maxResults: VOICEMAIL_MAX_RESULTS,
    includeSpamTrash: false
  }) || {};
  const refsById = {};
  (processedResponse.messages || []).forEach(function(ref) {
    if (ref && ref.id) refsById[String(ref.id)] = { id: String(ref.id), processing_status: 'processed' };
  });
  (pendingResponse.messages || []).forEach(function(ref) {
    const id = String(ref && ref.id || '');
    if (id && !refsById[id]) refsById[id] = { id: id, processing_status: 'pending' };
  });
  const refs = Object.keys(refsById).map(function(id) { return refsById[id]; });
  const messageIds = refs.map(function(ref) { return String(ref.id || '').trim(); }).filter(Boolean);
  const demandAssociations = findVoicemailDemandAssociations(messageIds);
  const labelNamesById = getGmailLabelNamesById();
  const nextAnalysis = nextVoicemailAnalysis();
  const messages = [];

  refs.forEach(function(ref) {
    const message = Gmail.Users.Messages.get('me', ref.id, { format: 'full' });
    const bodyText = extractGmailMessageText(message.payload || {}, message.id);
    const isProcessed = isManagedOvhVoicemail(message, bodyText, voicemailLabelId);
    const isPending = ref.processing_status === 'pending' && isPendingOvhVoicemail(message, bodyText, voicemailLabelId);
    if (!isProcessed && !isPending) return;
    if (isDiscardedVoicemail(message.id)) return;

    const labels = (message.labelIds || []).map(function(id) {
      return labelNamesById[id] || id;
    });
    const association = isProcessed ? demandAssociations[String(message.id || '')] || null : null;
    const audioPart = findVoicemailAudioPart(message.payload || {});
    // Le libellé Historique_OVH prouve que Make a traité le message, pas qu'une
    // demande commerciale existe réellement. Seul un rattachement exact à la
    // base permet donc d'afficher « Demande traiteur ».
    const classification = association ? 'professionnel' : 'personnel';
    const internalDate = Number(message.internalDate || 0);

    messages.push({
      id: String(message.id || ''),
      thread_id: String(message.threadId || ''),
      subject: getGmailHeader(message.payload, 'Subject'),
      received_at: internalDate ? new Date(internalDate).toISOString() : '',
      caller: extractOvhCaller(getGmailHeader(message.payload, 'Subject'), bodyText),
      transcription: extractOvhTranscription(bodyText),
      has_audio: !!audioPart,
      audio_name: audioPart ? String(audioPart.filename || 'Message vocal') : '',
      classification: isPending ? 'analyse' : classification,
      processing_status: isPending ? 'pending' : 'processed',
      next_analysis_time: isPending ? nextAnalysis.time : '',
      next_analysis_day: isPending ? nextAnalysis.day : '',
      labels: labels,
      demand: association
    });
  });

  messages.sort(function(a, b) {
    return String(b.received_at || '').localeCompare(String(a.received_at || ''));
  });
  return ok({ messages: messages, count: messages.length });
}

function getVoicemailAudio(messageId) {
  ensureVoicemailMailbox();
  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  const id = validateGmailMessageId(messageId);
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const bodyText = extractGmailMessageText(message.payload || {});
  if (!isAccessibleOvhVoicemail(message, bodyText, voicemailLabelId) || isDiscardedVoicemail(id)) throw new Error('Message vocal introuvable');

  const audioPart = findVoicemailAudioPart(message.payload || {});
  if (!audioPart) throw new Error('Aucun fichier audio disponible pour ce message');
  const expectedSize = Number(audioPart.body && audioPart.body.size || 0);
  if (expectedSize > VOICEMAIL_MAX_AUDIO_BYTES) throw new Error('Le fichier audio est trop volumineux');

  const gmailMessage = GmailApp.getMessageById(id);
  if (!gmailMessage) throw new Error('Message vocal Gmail introuvable');
  const attachments = gmailMessage.getAttachments({
    includeInlineImages: false,
    includeAttachments: true
  }) || [];
  const expectedName = String(audioPart.filename || '').trim().toLowerCase();
  const attachment = attachments.find(function(item) {
    return expectedName && String(item.getName() || '').trim().toLowerCase() === expectedName;
  }) || attachments.find(function(item) {
    const mime = String(item.getContentType() || '').toLowerCase();
    const name = String(item.getName() || '').toLowerCase();
    return mime.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|aac|ogg|oga|amr)$/i.test(name);
  });
  if (!attachment) throw new Error('Aucun fichier audio disponible pour ce message');
  if (typeof attachment.getSize === 'function' && attachment.getSize() > VOICEMAIL_MAX_AUDIO_BYTES) {
    throw new Error('Le fichier audio est trop volumineux');
  }
  const audioBytes = attachment.getBytes();
  if (!audioBytes || !audioBytes.length) throw new Error('Le fichier audio est vide');
  if (audioBytes.length > VOICEMAIL_MAX_AUDIO_BYTES) throw new Error('Le fichier audio est trop volumineux');

  return ok({
    message_id: id,
    filename: String(attachment.getName() || audioPart.filename || 'message-vocal'),
    mime_type: String(attachment.getContentType() || voicemailAudioMimeType(audioPart)),
    // GmailApp fournit directement les octets du fichier : aucun décodage de
    // chaîne Base64URL n'est nécessaire avant de produire un Base64 standard.
    data_base64: Utilities.base64Encode(audioBytes),
    data_encoding: 'base64'
  });
}

function linkVoicemailToDemand(messageId, idDemande) {
  ensureVoicemailMailbox();
  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  const id = validateGmailMessageId(messageId);
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const bodyText = extractGmailMessageText(message.payload || {});
  if (!isManagedOvhVoicemail(message, bodyText, voicemailLabelId)) throw new Error('Message vocal OVH introuvable');

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const found = findRowByDemandId(sheet, headers, idDemande);
  if (!found) throw new Error('Demande introuvable : ' + String(idDemande || ''));

  // Le journal idempotent sait déjà associer plusieurs messages Gmail à une
  // même fiche. On l'utilise pour ne jamais écraser gmail_message_id, qui peut
  // référencer un autre échange utile de la demande.
  const logCol = headers.findIndex(function(header) {
    return canonicalKey(header) === 'make_operation_log';
  }) + 1;
  if (logCol <= 0) throw new Error('Colonne make_operation_log introuvable');
  const logCell = sheet.getRange(found.rowIndex, logCol);
  logCell.setValue(appendMakeOperationLog(logCell.getValue(), id, {
    updated: true,
    linked_manually: true
  }));

  const row = readRowData(sheet, headers, found.rowIndex);
  return ok({
    message_id: id,
    linked: true,
    demand: {
      id_demande: String(row.id_demande || ''),
      nom_client: String(row.nom_client || '').trim(),
      statut: String(row.statut || '').trim(),
      date_evenement: String(row.date_evenement || '').trim(),
      row: found.rowIndex
    }
  });
}

function markVoicemailRead(messageId) {
  ensureVoicemailMailbox();
  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  const id = validateGmailMessageId(messageId);
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const bodyText = extractGmailMessageText(message.payload || {});
  if (!isAccessibleOvhVoicemail(message, bodyText, voicemailLabelId) || isDiscardedVoicemail(id)) throw new Error('Message vocal introuvable');

  Gmail.Users.Messages.modify({ removeLabelIds: ['UNREAD'] }, 'me', id);
  return ok({ message_id: id, read: true });
}

function trashVoicemail(messageId) {
  ensureVoicemailMailbox();
  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  const id = validateGmailMessageId(messageId);
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const bodyText = extractGmailMessageText(message.payload || {});
  if (!isPendingOvhVoicemail(message, bodyText, voicemailLabelId)) {
    throw new Error('Seul un vocal en attente d’analyse automatique peut être supprimé');
  }

  rememberDiscardedVoicemail(id);
  Gmail.Users.Messages.trash('me', id);
  return ok({ message_id: id, trashed: true });
}

function archiveOvhVoicemail(messageId) {
  ensureVoicemailMailbox();
  const id = validateGmailMessageId(messageId);
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const bodyText = extractGmailMessageText(message.payload || {});
  if (!isOvhVoicemailMessage(message, bodyText)) throw new Error('Message vocal OVH introuvable');

  const voicemailLabelId = getGmailLabelIdByName(VOICEMAIL_HISTORY_LABEL);
  Gmail.Users.Messages.modify({ addLabelIds: [voicemailLabelId], removeLabelIds: ['INBOX'] }, 'me', id);
  return ok({ message_id: id, archived: true, label: VOICEMAIL_HISTORY_LABEL });
}

function ensureGmailService() {
  if (typeof Gmail === 'undefined' || !Gmail.Users || !Gmail.Users.Messages) {
    throw new Error('Le service Gmail du backend n’est pas disponible');
  }
}

function ensureVoicemailMailbox() {
  ensureGmailService();
  const cache = CacheService.getScriptCache();
  const cacheKey = 'voicemail-gmail-account-v1';
  let email = String(cache.get(cacheKey) || '').toLowerCase();
  if (!email) {
    const profile = Gmail.Users.getProfile('me') || {};
    email = String(profile.emailAddress || '').trim().toLowerCase();
    if (email) cache.put(cacheKey, email, 600);
  }
  if (email !== VOICEMAIL_GMAIL_ACCOUNT) {
    throw new Error('Le backend n’est pas connecté à la boîte Gmail Chez Papi');
  }
  return email;
}

// À exécuter depuis l’éditeur Apps Script après l’ajout du service Gmail.
// Cette fonction déclenche l’autorisation OAuth et confirme la boîte utilisée.
function authorizeVoicemailGmailAccess() {
  const email = ensureVoicemailMailbox();
  Logger.log('Boîte Gmail des messages vocaux : ' + email);
  return email;
}

function validateGmailMessageId(messageId) {
  const id = String(messageId || '').trim();
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('Identifiant Gmail invalide');
  }
  return id;
}

function getGmailHeader(payload, name) {
  const target = String(name || '').toLowerCase();
  const header = (payload && payload.headers || []).find(function(item) {
    return String(item.name || '').toLowerCase() === target;
  });
  return header ? String(header.value || '') : '';
}

function decodeGmailBody(data) {
  if (!data) return '';
  try {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(String(data))).getDataAsString('UTF-8');
  } catch (err) {
    Logger.log('Corps Gmail illisible : ' + err.message);
    return '';
  }
}

function bestOvhMessageText(candidates) {
  const usable = candidates.map(cleanVoicemailText).filter(Boolean);
  const transcribed = usable
    .filter(hasUsefulOvhTranscription)
    .sort(function(a, b) {
      return extractOvhTranscription(b).length - extractOvhTranscription(a).length;
    });
  return transcribed[0] || usable[0] || '';
}

function extractGmailMessageText(payload, messageId) {
  const plain = [];
  const html = [];

  function collect(part) {
    if (!part) return;
    const mime = String(part.mimeType || '').toLowerCase();
    const filename = String(part.filename || '').trim();
    if (!filename && part.body && part.body.data) {
      const decoded = decodeGmailBody(part.body.data);
      if (mime === 'text/plain') plain.push(decoded);
      else if (mime === 'text/html') html.push(decoded);
    }
    (part.parts || []).forEach(collect);
  }

  collect(payload || {});
  const candidates = plain
    .concat(html.map(htmlToPlainText));
  const apiText = bestOvhMessageText(candidates);
  if (hasUsefulOvhTranscription(apiText) || !messageId) return apiText;

  try {
    const gmailMessage = GmailApp.getMessageById(String(messageId));
    if (gmailMessage) {
      candidates.push(gmailMessage.getPlainBody());
      candidates.push(htmlToPlainText(gmailMessage.getBody()));
    }
  } catch (err) {
    Logger.log('Corps GmailApp illisible : ' + err.message);
  }
  return bestOvhMessageText(candidates);
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanVoicemailText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isOvhVoicemailMessage(message, bodyText) {
  const payload = message && message.payload || {};
  const from = getGmailHeader(payload, 'From').toLowerCase();
  const subject = getGmailHeader(payload, 'Subject').toLowerCase();
  const body = String(bodyText || '').toLowerCase();
  return from.indexOf('no-reply@ovh.fr') !== -1 && (
    subject.indexOf('message vocal du') !== -1 ||
    body.indexOf('vous avez reçu un message vocal provenant du numéro') !== -1
  );
}

function isManagedOvhVoicemail(message, bodyText, voicemailLabelId) {
  return isOvhVoicemailMessage(message, bodyText) &&
    (message.labelIds || []).indexOf(voicemailLabelId) !== -1;
}

function isPendingOvhVoicemail(message, bodyText, voicemailLabelId) {
  const labels = message.labelIds || [];
  return isOvhVoicemailMessage(message, bodyText) &&
    labels.indexOf('INBOX') !== -1 &&
    labels.indexOf(voicemailLabelId) === -1;
}

function isAccessibleOvhVoicemail(message, bodyText, voicemailLabelId) {
  return isManagedOvhVoicemail(message, bodyText, voicemailLabelId) ||
    isPendingOvhVoicemail(message, bodyText, voicemailLabelId);
}

function nextVoicemailAnalysis(now) {
  const current = now instanceof Date ? now : new Date();
  const currentHour = Number(Utilities.formatDate(current, VOICEMAIL_ANALYSIS_TIMEZONE, 'H'));
  const currentMinute = Number(Utilities.formatDate(current, VOICEMAIL_ANALYSIS_TIMEZONE, 'm'));
  const nextHour = VOICEMAIL_ANALYSIS_HOURS.find(function(hour) {
    return hour > currentHour || (hour === currentHour && currentMinute === 0);
  });
  return {
    time: String(nextHour === undefined ? VOICEMAIL_ANALYSIS_HOURS[0] : nextHour).padStart(2, '0') + ':00',
    day: nextHour === undefined ? 'demain' : "aujourd’hui"
  };
}

function discardedVoicemailMap() {
  const properties = PropertiesService.getScriptProperties();
  let discarded = {};
  try {
    const parsed = JSON.parse(properties.getProperty(DISCARDED_VOICEMAILS_PROPERTY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) discarded = parsed;
  } catch (err) {}
  const cutoff = Date.now() - DISCARDED_VOICEMAILS_RETENTION_MS;
  let changed = false;
  Object.keys(discarded).forEach(function(id) {
    if (Number(discarded[id]) < cutoff) {
      delete discarded[id];
      changed = true;
    }
  });
  if (changed) properties.setProperty(DISCARDED_VOICEMAILS_PROPERTY, JSON.stringify(discarded));
  return discarded;
}

function isDiscardedVoicemail(messageId) {
  const id = String(messageId || '').trim();
  return !!id && !!discardedVoicemailMap()[id];
}

function rememberDiscardedVoicemail(messageId) {
  const id = validateGmailMessageId(messageId);
  const properties = PropertiesService.getScriptProperties();
  const discarded = discardedVoicemailMap();
  discarded[id] = Date.now();
  properties.setProperty(DISCARDED_VOICEMAILS_PROPERTY, JSON.stringify(discarded));
}

function extractOvhCaller(subject, bodyText) {
  const combined = String(subject || '') + '\n' + String(bodyText || '');
  const contextual = combined.match(/(?:message vocal du|provenant du num(?:é|e)ro)\s*[:\-]?\s*((?:\+|00)?33[\s.()\-]*\d(?:[\s.()\-]*\d){8}|0\d(?:[\s.()\-]*\d){8})/i);
  if (!contextual) return '';
  return formatFrenchPhone(contextual[1]);
}

function findOvhTranscriptionMarker(text) {
  const markers = [
    /voici la transcription de ce dernier\s*[:\-]?\s*/i,
    /transcription(?: automatique)?(?: du message vocal)?\s*[:\-]\s*/i,
    /message retranscrit\s*[:\-]?\s*/i
  ];
  for (var i = 0; i < markers.length; i++) {
    const match = markers[i].exec(String(text || ''));
    if (match) return match;
  }
  return null;
}

function hasUsefulOvhTranscription(text) {
  return !!findOvhTranscriptionMarker(text) && !!extractOvhTranscription(text);
}

function extractOvhTranscription(bodyText) {
  const text = cleanVoicemailText(bodyText);
  if (!text) return '';
  let transcription = '';
  const marker = findOvhTranscriptionMarker(text);
  if (marker) {
    transcription = text.substring(marker.index + marker[0].length);
  }
  if (!marker) {
    transcription = text
      .replace(/vous avez reçu un message vocal provenant du num(?:é|e)ro[^\n.]*(?:[.\n]|$)/i, '')
      .replace(/message vocal du[^\n.]*(?:[.\n]|$)/i, '')
      .replace(/dur(?:é|e)e\s*[:\-]?\s*\d+[^\n]*(?:\n|$)/i, '');
  }
  transcription = transcription
    .replace(/^[ \t]*(?:\d{1,2}:)?\d{2}(?:[.,]\d{1,3})?\s*-+>\s*(?:\d{1,2}:)?\d{2}(?:[.,]\d{1,3})?\s*/gm, '')
    .split(/\n[ \t]*(?:attention\s*:|pour écouter|accédez à|cordialement|l'équipe ovh|ovhcloud|nouveau message vocal chez papi)/i)[0]
    .trim();
  return transcription.substring(0, 4000);
}

function findVoicemailAudioPart(payload) {
  let found = null;
  function walk(part) {
    if (!part || found) return;
    const mime = String(part.mimeType || '').toLowerCase();
    const filename = String(part.filename || '').toLowerCase();
    const audioExtension = /\.(mp3|wav|m4a|aac|ogg|oga|amr)$/i.test(filename);
    if ((mime.indexOf('audio/') === 0 || audioExtension) && part.body && (part.body.attachmentId || part.body.data)) {
      found = part;
      return;
    }
    (part.parts || []).forEach(walk);
  }
  walk(payload || {});
  return found;
}

function voicemailAudioMimeType(part) {
  const mime = String(part && part.mimeType || '').toLowerCase();
  if (mime.indexOf('audio/') === 0) return mime;
  const filename = String(part && part.filename || '').toLowerCase();
  if (/\.wav$/.test(filename)) return 'audio/wav';
  if (/\.(m4a|aac)$/.test(filename)) return 'audio/mp4';
  if (/\.(ogg|oga)$/.test(filename)) return 'audio/ogg';
  if (/\.amr$/.test(filename)) return 'audio/amr';
  return 'audio/mpeg';
}

function getGmailLabelNamesById(refresh) {
  const cache = CacheService.getScriptCache();
  const cached = !refresh && cache.get('gmail-label-names-v1');
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }
  const response = Gmail.Users.Labels.list('me') || {};
  const names = {};
  (response.labels || []).forEach(function(label) {
    names[String(label.id || '')] = String(label.name || label.id || '');
  });
  cache.put('gmail-label-names-v1', JSON.stringify(names), 300);
  return names;
}

function getGmailLabelIdByName(labelName) {
  const wanted = String(labelName || '');
  let labelsById = getGmailLabelNamesById();
  let labelId = Object.keys(labelsById).find(function(id) {
    return labelsById[id] === wanted;
  });
  if (!labelId) {
    labelsById = getGmailLabelNamesById(true);
    labelId = Object.keys(labelsById).find(function(id) {
      return labelsById[id] === wanted;
    });
  }
  if (!labelId) throw new Error('Libellé Gmail introuvable : ' + wanted);
  return labelId;
}

function findVoicemailDemandAssociations(messageIds) {
  const wanted = {};
  (messageIds || []).forEach(function(id) { if (id) wanted[String(id)] = true; });
  if (!Object.keys(wanted).length) return {};

  const sheet = getSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  if (!values.length) return {};
  const headers = values[0].map(function(header) { return canonicalKey(header); });
  const associations = {};

  values.slice(1).forEach(function(row, rowOffset) {
    const data = {};
    headers.forEach(function(key, columnIndex) {
      data[key] = key === 'date_evenement'
        ? String((displayValues[rowOffset + 1] || [])[columnIndex] || row[columnIndex] || '')
        : row[columnIndex];
    });
    const directMessageId = String(data.gmail_message_id || '').trim();
    const demandId = String(data.id_demande || '').trim();
    const operationLog = parseMakeOperationLog(data.make_operation_log);
    Object.keys(wanted).forEach(function(messageId) {
      if (associations[messageId]) return;
      if (directMessageId !== messageId && demandId !== 'VOXIST-' + messageId && !operationLog[messageId]) return;
      associations[messageId] = {
        id_demande: demandId,
        nom_client: String(data.nom_client || '').trim(),
        statut: String(data.statut || '').trim(),
        date_evenement: String(data.date_evenement || '').trim(),
        row: rowOffset + 2
      };
    });
  });
  return associations;
}

function addRow(rowData, options) {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const clean = sanitizeFields(rowData || {}, false);
  const resolution = options || {};

  if (resolution.merge_into_id) {
    const target = findRowByDemandId(sheet, headers, resolution.merge_into_id);
    if (!target) throw new Error("Demande à enrichir introuvable : " + resolution.merge_into_id);
    mergeManualDemandRow(sheet, headers, target.rowIndex, clean);
    applyDefaultRowHeight(sheet, target.rowIndex);
    syncCalendarForRow(sheet, headers, target.rowIndex, "addRow merge");
    return ok({
      id_demande: resolution.merge_into_id,
      row: target.rowIndex,
      created: false,
      merged: true
    });
  }

  if (resolution.check_duplicates && !resolution.force_create) {
    const candidates = findDemandMatchCandidates(sheet, headers, clean, { mode: "manual" });
    if (candidates.length) {
      return ok({
        created: false,
        merged: false,
        requires_resolution: true,
        candidates: candidates
      });
    }
  }
  
  // Génération d'un identifiant unique côté serveur
  // Pour une création manuelle, on ne fait pas confiance à l'ID envoyé par le dashboard.
  clean.id_demande = generateUniqueDemandId(sheet, headers);
  
  // Initialisation de la date de réception si absente
  if (!clean.date_reception) {
    clean.date_reception = new Date();
  }
  if (!clean.date_evenement) {
    clean.date_evenement = "Inconnu / à compléter";
  }
  if (clean.statut === "En attente de réponse" && !clean.en_attente_reponse_depuis) {
    clean.en_attente_reponse_depuis = new Date();
  }
  
  clean.derniere_modification = new Date();
  
  sheet.appendRow(headers.map(h => clean[canonicalKey(h)] ?? ''));
  clean._row = sheet.getLastRow();
  forceTextCell(sheet, headers, clean._row, "date_evenement", clean.date_evenement);
  applyDefaultRowHeight(sheet, clean._row);
  
  // Synchroniser avec Google Calendar
  try {
    syncCalendarEvent(clean);
  } catch (err) {
    Logger.log("Erreur de synchronisation Google Calendar dans addRow: " + err.message);
  }
  
  // Envoyer une notification e-mail immédiate
  /* try {
    sendNewDemandEmail(rowData);
  } catch (err) {
    Logger.log("Erreur envoi email immédiat: " + err.message);
  }
  */
  return ok({ id_demande: clean.id_demande, row: clean._row, created: true, merged: false });
}

function upsertWixDemand(rowData, options) {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const clean = sanitizeFields(rowData || {}, false);
  const raw = normalizeRowKeys(rowData || {});
  clean.id_demande = String(raw.id_demande || '').trim();
  clean.wix_form_fingerprint = String(clean.wix_form_fingerprint || '').trim();
  if (!clean.id_demande) throw new Error("id_demande manquant");
  if (!clean.wix_form_fingerprint) throw new Error("wix_form_fingerprint manquant");
  if (!clean.date_reception) clean.date_reception = new Date();
  if (!clean.date_evenement) clean.date_evenement = "Inconnu / à compléter";
  clean.derniere_modification = new Date();

  const replay = findMakeOperationByMessageId(sheet, headers, clean.gmail_message_id);
  if (replay) {
    return ok(Object.assign({}, replay.result, {
      id_demande: replay.id_demande,
      row: replay.rowIndex,
      replayed: true
    }));
  }

  const windowMinutes = Math.max(1, Number(options.merge_window_minutes || 15));
  // Un même client peut d'abord laisser un vocal puis compléter sa demande via
  // Wix. Le numéro et la date sont alors des identifiants suffisamment forts,
  // à condition qu'ils désignent une seule demande active. La première ligne
  // reste le dossier de référence ; Wix en devient la source la plus fiable.
  const crossChannelMatches = findActiveRowsByPhoneAndEventDate(
    sheet,
    headers,
    clean.telephone,
    clean.date_evenement
  );
  const duplicate = crossChannelMatches.length === 1
    ? crossChannelMatches[0]
    : findRecentWixDuplicate(sheet, headers, clean.wix_form_fingerprint, clean.date_reception, windowMinutes);
  if (duplicate) {
    mergeWixDemandRow(sheet, headers, duplicate.rowIndex, clean, {
      created: false,
      merged: true
    });
    applyDefaultRowHeight(sheet, duplicate.rowIndex);
    return ok({
      id_demande: duplicate.id_demande || clean.id_demande,
      row: duplicate.rowIndex,
      created: false,
      merged: true,
      matched_by: crossChannelMatches.length === 1 ? "telephone_et_date_evenement" : "wix_form_fingerprint"
    });
  }

  clean.make_operation_log = appendMakeOperationLog('', clean.gmail_message_id, {
    created: true,
    merged: false
  });
  sheet.appendRow(headers.map(function(h) {
    return clean[canonicalKey(h)] !== undefined ? clean[canonicalKey(h)] : '';
  }));
  clean._row = sheet.getLastRow();
  forceTextCell(sheet, headers, clean._row, "date_evenement", clean.date_evenement);
  applyDefaultRowHeight(sheet, clean._row);
  return ok({ id_demande: clean.id_demande, row: clean._row, created: true, merged: false });
}

// Opération de maintenance explicitement bornée : elle ne supprime une ligne
// Wix que si celle-ci représente de façon certaine le même événement qu'un
// dossier principal déjà actif. Elle sert à résorber les doublons antérieurs à
// la règle de fusion automatique dans upsertWixDemand.
function mergeWixDuplicateDemand(primaryIdDemande, wixDuplicateId) {
  const primaryId = String(primaryIdDemande || '').trim();
  const wixId = String(wixDuplicateId || '').trim();
  if (!primaryId) throw new Error('primary_id_demande manquant');
  if (wixId.indexOf('WIX-') !== 0) throw new Error('Le doublon doit être une demande Wix');
  if (primaryId === wixId) throw new Error('Les deux identifiants doivent être différents');

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const primary = findRowByDemandId(sheet, headers, primaryId);
  const wixDuplicate = findRowByDemandId(sheet, headers, wixId);
  if (!primary) throw new Error('Dossier principal introuvable : ' + primaryId);
  if (!wixDuplicate) throw new Error('Doublon Wix introuvable : ' + wixId);

  const primaryData = readRowData(sheet, headers, primary.rowIndex);
  const wixData = readRowData(sheet, headers, wixDuplicate.rowIndex);
  const matchingRows = findActiveRowsByPhoneAndEventDate(
    sheet,
    headers,
    wixData.telephone,
    wixData.date_evenement
  );
  if (!isActiveDemandStatus(primaryData.statut)) throw new Error('Le dossier principal doit être actif');
  if (matchingRows.length !== 2 || !matchingRows.some(function(row) { return row.id_demande === primaryId; }) || !matchingRows.some(function(row) { return row.id_demande === wixId; })) {
    throw new Error('Les dossiers ne forment pas un doublon Wix unique par téléphone et date');
  }

  mergeWixDemandRow(sheet, headers, primary.rowIndex, wixData, {
    created: false,
    merged: true,
    merged_from_id: wixId
  });
  sheet.deleteRow(wixDuplicate.rowIndex);
  applyDefaultRowHeight(sheet, primary.rowIndex > wixDuplicate.rowIndex ? primary.rowIndex - 1 : primary.rowIndex);
  return ok({
    id_demande: primaryId,
    deleted_id_demande: wixId,
    merged: true,
    matched_by: 'telephone_et_date_evenement'
  });
}

// Opération de maintenance explicitement bornée pour résorber un doublon
// Voxist historique. Le dossier le plus récent reste la référence et reçoit
// les informations absentes du premier vocal ; la transcription antérieure est
// conservée dans les notes avant suppression de sa ligne.
function mergeVoxistDuplicateDemand(primaryIdDemande, voxistDuplicateId) {
  const primaryId = String(primaryIdDemande || '').trim();
  const duplicateId = String(voxistDuplicateId || '').trim();
  if (!primaryId || !duplicateId) throw new Error('Identifiants de fusion Voxist manquants');
  if (primaryId.indexOf('VOXIST-') !== 0 || duplicateId.indexOf('VOXIST-') !== 0) throw new Error('Les deux dossiers doivent être des demandes Voxist');
  if (primaryId === duplicateId) throw new Error('Les deux identifiants doivent être différents');

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const primary = findRowByDemandId(sheet, headers, primaryId);
  const duplicate = findRowByDemandId(sheet, headers, duplicateId);
  if (!primary || !duplicate) throw new Error('Dossier Voxist introuvable');

  const primaryData = readRowData(sheet, headers, primary.rowIndex);
  const duplicateData = readRowData(sheet, headers, duplicate.rowIndex);
  const matchingRows = findActiveRowsByPhoneAndEventDate(sheet, headers, primaryData.telephone, primaryData.date_evenement);
  if (!isActiveDemandStatus(primaryData.statut) || !isActiveDemandStatus(duplicateData.statut) ||
      matchingRows.length !== 2 ||
      !matchingRows.some(function(row) { return row.id_demande === primaryId; }) ||
      !matchingRows.some(function(row) { return row.id_demande === duplicateId; })) {
    throw new Error('Les dossiers ne forment pas un doublon Voxist unique par téléphone et date');
  }

  mergeManualDemandRow(sheet, headers, primary.rowIndex, duplicateData);
  const transcript = String(duplicateData.message_original || '').trim();
  if (transcript) {
    const notesCol = headers.findIndex(function(h) { return canonicalKey(h) === 'notes'; }) + 1;
    const currentNotes = String(sheet.getRange(primary.rowIndex, notesCol).getValue() || '').trim();
    const historyNote = 'Transcription du vocal fusionné (' + duplicateId + ') : ' + transcript;
    sheet.getRange(primary.rowIndex, notesCol).setValue(currentNotes ? currentNotes + '\n' + historyNote : historyNote);
  }
  sheet.deleteRow(duplicate.rowIndex);
  applyDefaultRowHeight(sheet, primary.rowIndex > duplicate.rowIndex ? primary.rowIndex - 1 : primary.rowIndex);
  return ok({
    id_demande: primaryId,
    deleted_id_demande: duplicateId,
    merged: true,
    matched_by: 'telephone_et_date_evenement'
  });
}

function updateRowById(idDemande, fields) {
  if (!idDemande) throw new Error("id_demande manquant");
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const found = findRowByDemandId(sheet, headers, idDemande);
  if (!found) throw new Error("Demande introuvable : " + idDemande);
  const clean = sanitizeFields(fields || {}, true);
  const isStatusOnlyUpdate = Object.keys(clean).length === 1 && clean.statut !== undefined;
  const isFollowupOnlyUpdate = Object.keys(clean).length === 1 && clean.relance_a_traiter !== undefined;
  const statusColumn = headers.findIndex(function(h) { return canonicalKey(h) === "statut"; }) + 1;
  const currentStatus = statusColumn > 0 ? String(sheet.getRange(found.rowIndex, statusColumn).getValue() || '').trim() : '';
  if (clean.statut === "En attente de réponse" && currentStatus !== "En attente de réponse") {
    clean.en_attente_reponse_depuis = new Date();
  }
  
  clean.derniere_modification = new Date();
  
  headers.forEach((h, i) => {
    const key = canonicalKey(h);
    if (clean[key] !== undefined) {
      const cell = sheet.getRange(found.rowIndex, i + 1);
      if (key === "date_evenement") cell.setNumberFormat("@");
      cell.setValue(clean[key]);
    }
  });
  if (!isStatusOnlyUpdate && !isFollowupOnlyUpdate) {
    applyDefaultRowHeight(sheet, found.rowIndex);
  }

  // Le marquage d'un message ne change aucune donnée de l'événement calendrier.
  // Un changement de statut entre deux états non confirmés ne le concerne pas non plus.
  const requiresCalendarSync = !isFollowupOnlyUpdate && (!isStatusOnlyUpdate || isConfirmedStatus(currentStatus) || isConfirmedStatus(clean.statut));
  if (requiresCalendarSync) {
    SpreadsheetApp.flush();
    try {
      const rowValues = sheet.getRange(found.rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      const rowData = {};
      headers.forEach((h, i) => {
        rowData[canonicalKey(h)] = rowValues[i];
      });
      syncCalendarEvent(rowData);
    } catch (err) {
      Logger.log("Erreur de synchronisation Google Calendar dans updateRow: " + err.message);
    }
  }
  
  return ok({ id_demande: idDemande, fields: clean });
}

function updateThreadFollowup(gmailThreadId, fields, options) {
  if (!gmailThreadId) throw new Error("gmail_thread_id manquant");
  const sourceEmail = String(options && options.match && options.match.email_client || '').trim().toLowerCase();
  if (isTechnicalTransactionalEmail(sourceEmail)) {
    return ok({ updated: false, reason: "technical_transactional_sender", email_client: sourceEmail });
  }
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const replay = findMakeOperationByMessageId(sheet, headers, getMakeMessageId(fields));
  if (replay) return ok(replayFollowupResult(replay));
  if (options && normalizeBoolean(options.force_review_card)) {
    return createUnmatchedFollowupDemand(options.fallback_row || {}, fields || {});
  }
  const found = findRowByCanonicalValue(sheet, headers, "gmail_thread_id", gmailThreadId);
  if (found && sourceEmail) {
    const foundEmail = String(readRowData(sheet, headers, found.rowIndex).email_client || '').trim().toLowerCase();
    if (foundEmail !== sourceEmail) {
      return ok({
        updated: false,
        reason: "source_email_mismatch",
        id_demande: found.id_demande || "",
        email_client: sourceEmail
      });
    }
  }
  if (!found) {
    if (options && options.match) {
      return updateExistingDemandFollowup(options.match, fields || {}, options);
    }
    if (options && options.create_if_not_found) {
      return createUnmatchedFollowupDemand(options.fallback_row || {}, fields || {});
    }
    return ok({ updated: false, reason: "thread_not_found", gmail_thread_id: gmailThreadId });
  }

  const clean = sanitizeFields(fields || {}, true);
  clean.relance_a_traiter = clean.relance_a_traiter !== undefined ? clean.relance_a_traiter : true;
  clean.dernier_email_recu_le = clean.dernier_email_recu_le || new Date();
  clean.derniere_modification = new Date();

  if (clean.nb_relances_client === undefined) {
    const countCol = headers.findIndex(function(h) { return canonicalKey(h) === "nb_relances_client"; }) + 1;
    const current = countCol > 0 ? Number(sheet.getRange(found.rowIndex, countCol).getValue() || 0) : 0;
    clean.nb_relances_client = current + 1;
  }

  const writeResult = { updated: true };
  writeMakeFollowup(sheet, headers, found.rowIndex, clean, writeResult, options || {});
  applyDefaultRowHeight(sheet, found.rowIndex);
  if (followupRequiresCalendarSync(writeResult)) syncCalendarForRow(sheet, headers, found.rowIndex, 'updateThreadFollowup');

  return ok(Object.assign({ id_demande: found.id_demande || "", row: found.rowIndex }, writeResult));
}

function updateWixFollowup(gmailThreadId, emailClient, fields, options) {
  if (!gmailThreadId) throw new Error("gmail_thread_id manquant");
  const email = String(emailClient || '').trim().toLowerCase();
  if (!email) throw new Error("email_client manquant");
  if (isTechnicalTransactionalEmail(email)) {
    return ok({ updated: false, reason: "technical_transactional_sender", email_client: email });
  }

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const replay = findMakeOperationByMessageId(sheet, headers, getMakeMessageId(fields));
  if (replay) return ok(replayFollowupResult(replay));
  const foundByThread = findRowByCanonicalValue(sheet, headers, "gmail_thread_id", gmailThreadId);
  const threadEmail = foundByThread
    ? String(readRowData(sheet, headers, foundByThread.rowIndex).email_client || '').trim().toLowerCase()
    : "";
  const threadMatchesSender = !!foundByThread && threadEmail === email;
  const found = threadMatchesSender
    ? foundByThread
    : findLatestRowByEmailAndIdPrefix(sheet, headers, email, "WIX-");
  if (!found) {
    if (options && options.create_if_not_found) {
      return createUnmatchedFollowupDemand(options.fallback_row || {}, fields || {});
    }
    return ok({ updated: false, reason: "wix_demand_not_found", gmail_thread_id: gmailThreadId, email_client: email });
  }

  const clean = sanitizeFields(fields || {}, true);
  clean.gmail_thread_id = gmailThreadId;
  clean.relance_a_traiter = clean.relance_a_traiter !== undefined ? clean.relance_a_traiter : true;
  clean.dernier_email_recu_le = clean.dernier_email_recu_le || new Date();
  clean.derniere_modification = new Date();

  if (clean.nb_relances_client === undefined) {
    const countCol = headers.findIndex(function(h) { return canonicalKey(h) === "nb_relances_client"; }) + 1;
    const current = countCol > 0 ? Number(sheet.getRange(found.rowIndex, countCol).getValue() || 0) : 0;
    clean.nb_relances_client = current + 1;
  }

  const writeResult = { updated: true };
  writeMakeFollowup(sheet, headers, found.rowIndex, clean, writeResult, options || {});
  applyDefaultRowHeight(sheet, found.rowIndex);
  if (followupRequiresCalendarSync(writeResult)) syncCalendarForRow(sheet, headers, found.rowIndex, 'updateWixFollowup');

  return ok(Object.assign({
    matched_by: threadMatchesSender ? "gmail_thread_id_and_email_client" : "email_client",
    id_demande: found.id_demande || "",
    row: found.rowIndex
  }, writeResult));
}

function updateExistingDemandFollowup(match, fields, options) {
  const email = String(match.email_client || '').trim().toLowerCase();
  const phone = normalizePhoneKey(match.telephone || fields.telephone);
  const name = normalizePersonName(match.nom_client);
  const dateEvenement = normalizeEventDateText(match.date_evenement);
  const hasSpecificEventDate = !!dateEvenement && dateEvenement !== "Inconnu / à compléter";
  const preferUniquePhone = !!(options && options.prefer_unique_phone);
  if (!email && !name && !phone) throw new Error("email_client, téléphone ou nom_client manquant");

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const replay = findMakeOperationByMessageId(sheet, headers, getMakeMessageId(fields));
  if (replay) return ok(replayFollowupResult(replay));
  if (options && normalizeBoolean(options.force_review_card)) {
    return createUnmatchedFollowupDemand(options.fallback_row || {}, fields || {});
  }
  // Voxist fournit un numéro appelant fiable : une unique demande active portant
  // ce numéro prévaut sur un nom éventuellement mal retranscrit par l'audio.
  const phoneMatches = preferUniquePhone && phone
    ? findActiveRowsByPhone(sheet, headers, phone)
    : [];
  const emailMatches = phoneMatches.length === 0 && hasSpecificEventDate && email
    ? findRowsByEmailAndEventDate(sheet, headers, email, dateEvenement)
    : [];
  const nameMatches = phoneMatches.length === 0 && hasSpecificEventDate && emailMatches.length === 0 && name
    ? findRowsByNameAndEventDate(sheet, headers, name, dateEvenement)
    : [];
  const activeEmailMatches = phoneMatches.length === 0 && !hasSpecificEventDate && email
    ? findActiveRowsByEmail(sheet, headers, email)
    : [];
  let matches = phoneMatches.length > 0
    ? phoneMatches
    : (emailMatches.length > 0
    ? emailMatches
    : (nameMatches.length > 0 ? nameMatches : activeEmailMatches));
  if (matches.length === 0) {
    matches = findDemandMatchCandidates(sheet, headers, {
      email_client: email,
      nom_client: match.nom_client,
      date_evenement: dateEvenement,
      telephone: match.telephone || fields.telephone,
      nb_convives: match.nb_convives || fields.nb_convives,
      lieu_prestation: match.lieu_prestation || fields.lieu_prestation,
      type_evenement: match.type_evenement || fields.type_evenement
    }, { mode: "followup" });
  }
  if (matches.length === 0 && options && options.allow_unique_active_event_date && hasSpecificEventDate) {
    matches = findActiveRowsByEventDate(sheet, headers, dateEvenement);
  }
  if (matches.length !== 1) {
    const mayCreateReviewCard = options && options.create_if_not_found && (
      matches.length === 0 || (matches.length > 1 && options.create_if_ambiguous)
    );
    if (mayCreateReviewCard) {
      return createUnmatchedFollowupDemand(options.fallback_row || {}, fields || {});
    }
    return ok({
      updated: false,
      reason: matches.length === 0 ? "existing_demand_not_found" : "existing_demand_ambiguous",
      email_client: email,
      nom_client: name,
      date_evenement: dateEvenement,
      candidate_count: matches.length
    });
  }
  const found = matches[0];

  const clean = sanitizeFields(fields || {}, true);
  // Un suivi reçu depuis une adresse inconnue peut compléter la fiche. En
  // revanche, l'adresse déjà enregistrée reste la référence : un message
  // transféré ou envoyé par un proche ne doit pas la remplacer.
  const explicitEmailChange = options && options.explicit_changes && normalizeBoolean(options.explicit_changes.email_client);
  if (clean.email_client && String(found.email_client || '').trim() && !explicitEmailChange) {
    delete clean.email_client;
  }
  clean.relance_a_traiter = clean.relance_a_traiter !== undefined ? clean.relance_a_traiter : true;
  clean.dernier_email_recu_le = clean.dernier_email_recu_le || new Date();
  clean.derniere_modification = new Date();

  if (clean.nb_relances_client === undefined) {
    const countCol = headers.findIndex(function(h) { return canonicalKey(h) === "nb_relances_client"; }) + 1;
    const current = countCol > 0 ? Number(sheet.getRange(found.rowIndex, countCol).getValue() || 0) : 0;
    clean.nb_relances_client = current + 1;
  }

  const writeResult = { updated: true };
  writeMakeFollowup(sheet, headers, found.rowIndex, clean, writeResult, options || {});
  applyDefaultRowHeight(sheet, found.rowIndex);
  if (followupRequiresCalendarSync(writeResult)) syncCalendarForRow(sheet, headers, found.rowIndex, 'updateExistingDemandFollowup');

  return ok(Object.assign({ id_demande: found.id_demande || "", row: found.rowIndex }, writeResult));
}

function createUnmatchedFollowupDemand(rowData, followupFields) {
  const raw = normalizeRowKeys(rowData || {});
  const automaticNote = "Fiche de contrôle créée automatiquement : ce message n'a pas pu être rattaché avec certitude. À vérifier et à rattacher si nécessaire.";
  const existingNotes = String(raw.notes || '').trim();
  const message = String(raw.message_original || followupFields.dernier_message_client || '').trim();
  const row = Object.assign({}, raw, followupFields || {}, {
    statut: "À vérifier",
    notes: appendUniqueLine(existingNotes, automaticNote),
    dernier_message_client: String(followupFields.dernier_message_client || message).slice(0, 900),
    dernier_email_recu_le: followupFields.dernier_email_recu_le || raw.date_reception || new Date(),
    relance_a_traiter: true,
    nb_relances_client: Math.max(1, Number(raw.nb_relances_client || 0))
  });
  const result = createMakeDemand(row);
  const data = result && result.getContent ? JSON.parse(result.getContent()).data : null;
  return ok(Object.assign({}, data || {}, {
    updated: true,
    created_from_unmatched_followup: true,
    reason: data && data.created === false ? "automatic_demand_replayed" : "automatic_demand_created"
  }));
}

function mergeDemandRecords(sourceIdDemande, targetIdDemande) {
  const sourceId = String(sourceIdDemande || '').trim();
  const targetId = String(targetIdDemande || '').trim();
  if (!sourceId || !targetId) throw new Error('Demandes source et cible obligatoires');
  if (sourceId === targetId) throw new Error('Les demandes source et cible doivent être différentes');

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const source = findRowByDemandId(sheet, headers, sourceId);
  const target = findRowByDemandId(sheet, headers, targetId);
  if (!source) throw new Error('Demande source introuvable : ' + sourceId);
  if (!target) throw new Error('Demande cible introuvable : ' + targetId);

  const sourceData = readRowData(sheet, headers, source.rowIndex);
  const targetData = readRowData(sheet, headers, target.rowIndex);
  const mergeMarker = 'Rattachement manuel depuis ' + sourceId;
  if (String(targetData.notes || '').indexOf(mergeMarker) !== -1) {
    return ok({ merged: true, replayed: true, source_retained: true, source_id_demande: sourceId, id_demande: targetId });
  }

  const fillIfMissing = [
    'nom_client', 'telephone', 'email_client', 'type_evenement', 'date_evenement',
    'heure_evenement', 'nb_convives', 'lieu_prestation', 'budget_estime',
    'url_dossier_drive', 'message_original'
  ];
  const updates = {};
  fillIfMissing.forEach(function(key) {
    if (!String(targetData[key] || '').trim() && String(sourceData[key] || '').trim()) updates[key] = sourceData[key];
  });

  ['gmail_thread_id', 'gmail_message_id', 'url_email_origine', 'dernier_email_recu_le', 'dernier_message_client'].forEach(function(key) {
    if (String(sourceData[key] || '').trim()) updates[key] = sourceData[key];
  });
  updates.relance_a_traiter = normalizeBoolean(targetData.relance_a_traiter) || normalizeBoolean(sourceData.relance_a_traiter);
  updates.nb_relances_client = Number(targetData.nb_relances_client || 0) + Number(sourceData.nb_relances_client || 0);

  const noteParts = [mergeMarker + ' (fiche source conservée).'];
  const sourceNotes = String(sourceData.notes || '').trim();
  const sourceOriginal = String(sourceData.message_original || '').trim();
  if (sourceNotes) noteParts.push(sourceNotes);
  if (sourceOriginal && sourceOriginal !== String(targetData.message_original || '').trim()) {
    noteParts.push('Message d’origine de ' + sourceId + ' : ' + sourceOriginal);
  }
  updates.notes = appendUniqueLine(String(targetData.notes || '').trim(), noteParts.join('\n'));
  updates.derniere_modification = new Date();

  writeFieldsToRow(sheet, headers, target.rowIndex, sanitizeFields(updates, true));
  const sourceNote = appendUniqueLine(String(sourceData.notes || '').trim(), 'Rattachée manuellement à ' + targetId + '. Cette fiche source est conservée et peut être supprimée séparément après vérification.');
  writeFieldsToRow(sheet, headers, source.rowIndex, sanitizeFields({
    notes: sourceNote,
    relance_a_traiter: false,
    derniere_modification: new Date()
  }, true));
  applyDefaultRowHeight(sheet, target.rowIndex);
  applyDefaultRowHeight(sheet, source.rowIndex);
  syncCalendarForRow(sheet, headers, target.rowIndex, 'mergeDemandRecords');

  return ok({
    merged: true,
    replayed: false,
    source_retained: true,
    source_id_demande: sourceId,
    id_demande: targetId,
    fields: updates
  });
}

function writeFieldsToRow(sheet, headers, rowIndex, fields) {
  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (fields[key] === undefined) return;
    const cell = sheet.getRange(rowIndex, i + 1);
    if (key === 'date_evenement') cell.setNumberFormat('@');
    cell.setValue(fields[key]);
  });
}

function appendUniqueLine(existing, addition) {
  const current = String(existing || '').trim();
  const next = String(addition || '').trim();
  if (!next || current.indexOf(next) !== -1) return current;
  return current ? current + '\n' + next : next;
}

function syncCalendarForRow(sheet, headers, rowIndex, context) {
  SpreadsheetApp.flush();
  try {
    const values = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = {};
    headers.forEach(function(h, i) {
      row[canonicalKey(h)] = values[i];
    });
    syncCalendarEvent(row);
  } catch (err) {
    Logger.log("Erreur de synchronisation Google Calendar dans " + context + " : " + err.message);
  }
}

function checkDuplicate(match) {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const ids = [];
  const sourceEmail = String(match.source_email || '').trim().toLowerCase();
  if (isTechnicalTransactionalEmail(sourceEmail)) {
    return ok({
      count: 1,
      duplicate: false,
      excluded: true,
      reason: "technical_transactional_sender",
      id_demande: "",
      row: ""
    });
  }
  const gmailMessageId = String(match.gmail_message_id || '').trim();
  const requestedThreadId = String(match.gmail_thread_id || '').trim();
  if (sourceEmail === 'no-reply@ovh.fr' && gmailMessageId && isDiscardedVoicemail(gmailMessageId)) {
    return ok({
      count: 1,
      duplicate: true,
      discarded: true,
      reason: 'discarded_from_dashboard',
      id_demande: 'VOXIST-' + gmailMessageId,
      row: ''
    });
  }
  let idDemande = String(match.id_demande || '').trim();
  if (!idDemande) {
    if (sourceEmail === 'notifications@wix-forms.com' && gmailMessageId) {
      idDemande = 'WIX-' + gmailMessageId;
    } else if (sourceEmail === 'message@voxist.com' && gmailMessageId) {
      idDemande = 'VOXIST-' + gmailMessageId;
    } else if (requestedThreadId) {
      idDemande = 'GMAIL-' + requestedThreadId;
    }
  }
  const isMessageScopedSource = idDemande.indexOf("WIX-") === 0 || idDemande.indexOf("VOXIST-") === 0;
  const legacyId = isMessageScopedSource ? "" : String(match.legacy_id || '').trim();
  const gmailThreadId = isMessageScopedSource ? "" : requestedThreadId;
  [idDemande, legacyId].forEach(function(value) {
    if (value && ids.indexOf(value) === -1) ids.push(value);
  });

  const found = findDuplicateDemand(
    sheet,
    headers,
    ids,
    gmailThreadId,
    isMessageScopedSource ? "" : sourceEmail
  );
  return ok({
    count: found ? 1 : 0,
    duplicate: !!found,
    id_demande: found ? found.id_demande || "" : "",
    row: found ? found.rowIndex : ""
  });
}

function deleteRowById(idDemande) {
  if (!idDemande) throw new Error("id_demande manquant");
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const found = findRowByDemandId(sheet, headers, idDemande);
  if (!found) throw new Error("Demande introuvable : " + idDemande);
  
  // Supprimer l'événement Google Calendar associé avant de supprimer la ligne
  // CORRECTION : utilisation de normalizeRowKeys() pour être robuste quel que soit le nom de colonne
  try {
    const rowValues = sheet.getRange(found.rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rawData = {};
    headers.forEach((h, i) => { rawData[canonicalKey(h)] = rowValues[i]; });
    const data = normalizeRowKeys(rawData);
    if (data.id_demande) {
      var calendar = CalendarApp.getDefaultCalendar();
      var existingEvent = findCalendarEvent(calendar, data.id_demande);
      if (existingEvent) {
        existingEvent.deleteEvent();
        Logger.log("Événement Google Calendar supprimé via deleteRow pour " + data.id_demande);
      }
    }
  } catch (err) {
    Logger.log("Erreur suppression Google Calendar dans deleteRow: " + err.message);
  }
  
  sheet.deleteRow(found.rowIndex);
  return ok({ id_demande: idDemande });
}

// ── Helpers ─────────────────────────────────────────────────────

function canonicalKey(header) {
  return KEY_MAP[String(header || '').trim()] || String(header || '').trim();
}

function ensureSchemaHeaders(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const existing = {};
  headers.forEach(function(h) {
    existing[canonicalKey(h)] = true;
  });

  const missing = SCHEMA_HEADERS.filter(function(key) {
    return !existing[key];
  });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    applyDefaultRowHeight(sheet, 1);
  }
}

function getMakeMessageId(fields) {
  return String((fields || {}).gmail_message_id || '').trim();
}

function parseMakeOperationLog(value) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

function appendMakeOperationLog(value, messageId, result) {
  const id = String(messageId || '').trim();
  const log = parseMakeOperationLog(value);
  if (id) log[id] = result || {};
  const ids = Object.keys(log);
  if (ids.length > 200) {
    ids.slice(0, ids.length - 200).forEach(function(key) { delete log[key]; });
  }
  return JSON.stringify(log);
}

function findMakeOperationByMessageId(sheet, headers, messageId) {
  const id = String(messageId || '').trim();
  if (!id) return null;
  const logCol = headers.findIndex(function(h) { return canonicalKey(h) === 'make_operation_log'; }) + 1;
  const demandCol = headers.findIndex(function(h) { return canonicalKey(h) === 'id_demande'; }) + 1;
  if (logCol <= 0) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const logs = sheet.getRange(2, logCol, lastRow - 1, 1).getValues();
  const demandIds = demandCol > 0 ? sheet.getRange(2, demandCol, lastRow - 1, 1).getValues() : [];
  for (var i = logs.length - 1; i >= 0; i--) {
    const result = parseMakeOperationLog(logs[i][0])[id];
    if (result) {
      return {
        rowIndex: i + 2,
        id_demande: demandCol > 0 ? String(demandIds[i][0] || '').trim() : '',
        result: result
      };
    }
  }
  return null;
}

function replayFollowupResult(replay) {
  return Object.assign({}, replay.result, {
    updated: replay.result.updated !== false,
    id_demande: replay.id_demande,
    row: replay.rowIndex,
    replayed: true
  });
}

function writeMakeFollowup(sheet, headers, rowIndex, fields, result, options) {
  const values = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const explicitChanges = options && options.explicit_changes || {};
  const appliedBusinessFields = [];
  const skippedBusinessFields = [];
  const appliedBusinessChanges = {};
  const skippedBusinessChanges = {};
  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    // Un suivi enrichit une fiche : une valeur absente de l'email ne doit
    // jamais effacer une information métier déjà connue.
    if (fields[key] === undefined || fields[key] === null || String(fields[key]).trim() === '') return;

    if (FOLLOWUP_PROTECTED_FIELDS.indexOf(key) !== -1) {
      const currentValue = String(values[i] === undefined || values[i] === null ? '' : values[i]).trim();
      const explicitChange = normalizeBoolean(explicitChanges[key]);
      const trustedCallerPhone = key === 'telephone' && options && options.prefer_unique_phone;
      if (currentValue && !explicitChange && !trustedCallerPhone) {
        skippedBusinessFields.push(key);
        skippedBusinessChanges[key] = { current: values[i], proposed: fields[key] };
        return;
      }
      appliedBusinessFields.push(key);
      appliedBusinessChanges[key] = {
        previous: values[i],
        next: fields[key],
        reason: currentValue ? (trustedCallerPhone ? 'trusted_caller_phone' : 'explicit_change') : 'empty_field'
      };
    }
    values[i] = fields[key];
  });
  result.applied_business_fields = appliedBusinessFields;
  result.skipped_non_explicit_fields = skippedBusinessFields;
  result.applied_business_changes = appliedBusinessChanges;
  result.skipped_non_explicit_changes = skippedBusinessChanges;
  const logCol = headers.findIndex(function(h) { return canonicalKey(h) === 'make_operation_log'; }) + 1;
  if (logCol <= 0) throw new Error('Colonne make_operation_log introuvable');
  values[logCol - 1] = appendMakeOperationLog(values[logCol - 1], getMakeMessageId(fields), result);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

function followupRequiresCalendarSync(result) {
  const calendarFields = [
    'nom_client',
    'type_evenement',
    'date_evenement',
    'heure_evenement',
    'nb_convives',
    'lieu_prestation',
    'statut'
  ];
  return (result && result.applied_business_fields || []).some(function(key) {
    return calendarFields.indexOf(key) !== -1;
  });
}

function applyDefaultRowHeights(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  sheet.getRange(1, 1, lastRow, lastColumn).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  applyRowHeights(sheet, 1, lastRow);
}

function applyDefaultRowHeight(sheet, rowIndex) {
  if (!rowIndex || rowIndex < 1) return;
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  sheet.getRange(rowIndex, 1, 1, lastColumn).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  applyRowHeights(sheet, rowIndex, 1);
}

function applyRowHeights(sheet, startRow, rowCount) {
  if (!rowCount || rowCount < 1) return;
  if (typeof sheet.setRowHeightsForced === "function") {
    sheet.setRowHeightsForced(startRow, rowCount, DEFAULT_ROW_HEIGHT_PX);
    return;
  }
  sheet.setRowHeights(startRow, rowCount, DEFAULT_ROW_HEIGHT_PX);
}

function sanitizeFields(rawFields, isUpdate) {
  const raw = normalizeRowKeys(rawFields || {});
  const clean = {};
  Object.keys(raw).forEach(function(key) {
    if (key === "id_demande") return;
    if (ALLOWED_FIELDS.indexOf(key) === -1) return;
    clean[key] = raw[key];
  });

  if (clean.statut !== undefined && ALLOWED_STATUSES.indexOf(String(clean.statut)) === -1) {
    throw new Error("Statut invalide : " + clean.statut);
  }

  if (clean.canal !== undefined) {
    clean.canal = normalizeCanal(clean.canal);
    if (clean.canal && ALLOWED_CHANNELS.indexOf(String(clean.canal)) === -1) {
      throw new Error("Canal invalide : " + clean.canal);
    }
  }

  if (clean.date_evenement !== undefined) {
    clean.date_evenement = normalizeEventDateText(clean.date_evenement);
  }

  if (clean.telephone !== undefined) {
    clean.telephone = formatFrenchPhone(clean.telephone);
  }

  if (clean.relance_a_traiter !== undefined) {
    clean.relance_a_traiter = normalizeBoolean(clean.relance_a_traiter);
  }

  if (clean.nb_relances_client !== undefined) {
    const n = Number(clean.nb_relances_client || 0);
    clean.nb_relances_client = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  if (clean.dernier_message_client !== undefined) {
    clean.dernier_message_client = String(clean.dernier_message_client || '').slice(0, 900);
  }

  ["url_email_origine", "url_dossier_drive"].forEach(function(key) {
    if (clean[key] !== undefined && !isSafeBusinessUrl(clean[key])) {
      throw new Error("URL invalide : " + key);
    }
  });

  return clean;
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === 'vrai' || s === 'oui' || s === '1' || s === 'yes';
}

function normalizePersonName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function normalizePhoneKey(value) {
  return normalizePhoneKeys(value)[0] || '';
}

function normalizePhoneKeys(value) {
  return splitPhoneEntries(value)
    .map(normalizeSingleFrenchPhone)
    .filter(function(phone, index, phones) {
      return !!phone && phones.indexOf(phone) === index;
    });
}

function splitPhoneEntries(value) {
  return String(value || '')
    .split(/\s*(?:\/|;|,|\bet\b|\bou\b)\s*/i)
    .map(function(entry) { return entry.trim(); })
    .filter(Boolean);
}

function normalizeSingleFrenchPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.indexOf('0033') === 0) digits = digits.substring(4);
  if (digits.indexOf('33') === 0 && digits.length >= 11) digits = digits.substring(2);
  if (digits.length === 9 && /^[1-9]/.test(digits)) digits = '0' + digits;
  return digits.length === 10 ? digits : '';
}

function formatFrenchPhone(value) {
  const entries = splitPhoneEntries(value);
  if (!entries.length) return '';
  return entries.map(function(entry) {
    const normalized = normalizeSingleFrenchPhone(entry);
    return normalized ? normalized.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : entry;
  }).join(' / ');
}

function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function comparableTokens(value) {
  const ignored = {
    a: true, au: true, aux: true, de: true, des: true, du: true, en: true,
    et: true, inconnu: true, la: true, le: true, les: true, pour: true,
    remplir: true, une: true
  };
  return normalizeComparableText(value).split(' ').filter(function(token) {
    return token.length > 1 && !ignored[token];
  });
}

function hasSharedToken(left, right) {
  const leftTokens = comparableTokens(left);
  const rightTokens = comparableTokens(right);
  return leftTokens.some(function(token) { return rightTokens.indexOf(token) !== -1; });
}

function normalizeGuestCountKey(value) {
  const numbers = String(value || '').match(/\d+/g);
  if (!numbers || numbers.length !== 1) return '';
  return String(Number(numbers[0]));
}

function isActiveDemandStatus(status) {
  return [
    "Événement terminé",
    "Perdu / Sans suite",
    "Refusé / Complet"
  ].indexOf(String(status || '').trim()) === -1;
}

function isSafeBusinessUrl(value) {
  const s = String(value || '').trim();
  if (!s || s === '—') return true;
  return s.indexOf("https://mail.google.com/") === 0 || s.indexOf("https://drive.google.com/") === 0;
}

function normalizeCanal(canal) {
  const raw = String(canal || '').trim();
  if (!raw || raw === '—') return '';
  const lower = raw.toLowerCase();
  if (lower === 'email direct' || lower === 'email') return 'Email';
  if (lower === 'formulaire site' || lower === 'site web' || lower === 'site internet' || lower === 'wix') return 'Site Internet';
  if (lower === 'voxist' || lower === 'telephone' || lower === 'téléphone') return 'Téléphone';
  if (lower === 'réseaux sociaux' || lower === 'reseaux sociaux' || lower === 'réseau social' || lower === 'reseau social') return 'Réseaux sociaux';
  if (lower === 'saisie manuelle' || lower === 'manuel' || lower === 'manual') return 'Saisie manuelle';
  return raw;
}

function forceTextCell(sheet, headers, rowIndex, key, value) {
  if (value === undefined || value === null || value === '') return;
  const colIndex = headers.findIndex(function(h) { return canonicalKey(h) === key; }) + 1;
  if (colIndex <= 0) return;
  sheet.getRange(rowIndex, colIndex).setNumberFormat("@").setValue(String(value));
}

function serialiseCell(key, value, displayValue) {
  if (key === "date_evenement") {
    const display = String(displayValue || '').trim();
    if (display) return normalizeEventDateText(display);
    return normalizeEventDateText(value);
  }
  return serialise(value);
}

function formatDateFr(date) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear()
  ].join('/');
}

function normalizeSingleEventDateText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateFr(value);
  const s = String(value || '').trim();
  if (!s || s === '—') return '';

  const yearOnly = s.match(/^(?:en\s+)?(\d{4})$/i);
  if (yearOnly) return yearOnly[1];

  const partialDate = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (partialDate) {
    const day = Number(partialDate[1]);
    const month = Number(partialDate[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${new Date().getFullYear()}`;
    }
    return s;
  }

  const ymd = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;

  const dmy = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${String(Number(dmy[1])).padStart(2, '0')}/${String(Number(dmy[2])).padStart(2, '0')}/${year}`;
  }

  return s;
}

function normalizeEventDateText(value) {
  const s = String(value === null || value === undefined ? '' : value).trim();
  if (!s || s === '—') return '';
  const range = s.match(/^(?:du\s+)?(.+?)\s+au\s+(.+)$/i);
  if (range) {
    const start = normalizeSingleEventDateText(range[1]);
    const end = normalizeSingleEventDateText(range[2]);
    return [start, end].filter(Boolean).join(' au ');
  }
  return normalizeSingleEventDateText(value);
}

function parseDateTimeValue(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const s = String(value || '').trim();
  if (!s || s === '—') return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findRowByDemandId(sheet, headers, idDemande) {
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (idCol <= 0) throw new Error("Colonne id_demande introuvable");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const target = String(idDemande || '').trim();
  const values = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === target) {
      return { rowIndex: i + 2, id_demande: target };
    }
  }
  return null;
}

function readRowData(sheet, headers, rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const displays = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const row = {};
  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    row[key] = key === 'date_evenement'
      ? normalizeEventDateText(displays[i] || values[i])
      : values[i];
  });
  return row;
}

function findDemandMatchCandidates(sheet, headers, incoming, options) {
  const mode = String((options || {}).mode || "manual");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const displays = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  const target = {
    email: String(incoming.email_client || '').trim().toLowerCase(),
    phones: normalizePhoneKeys(incoming.telephone),
    name: normalizePersonName(incoming.nom_client),
    date: normalizeEventDateText(incoming.date_evenement),
    guests: normalizeGuestCountKey(incoming.nb_convives),
    type: normalizeComparableText(incoming.type_evenement),
    place: normalizeComparableText(incoming.lieu_prestation)
  };
  const targetHasDate = !!target.date && target.date !== "Inconnu / à compléter";
  const candidates = [];

  values.forEach(function(rowValues, rowOffset) {
    const row = {};
    headers.forEach(function(h, i) {
      const key = canonicalKey(h);
      row[key] = key === "date_evenement"
        ? normalizeEventDateText(displays[rowOffset][i] || rowValues[i])
        : rowValues[i];
    });
    if (!row.id_demande || !isActiveDemandStatus(row.statut)) return;

    const rowEmail = String(row.email_client || '').trim().toLowerCase();
    const rowPhones = normalizePhoneKeys(row.telephone);
    const rowName = normalizePersonName(row.nom_client);
    const rowDate = normalizeEventDateText(row.date_evenement);
    const rowGuests = normalizeGuestCountKey(row.nb_convives);
    const rowType = normalizeComparableText(row.type_evenement);
    const rowPlace = normalizeComparableText(row.lieu_prestation);
    let score = 0;
    let secondaryScore = 0;
    const reasons = [];

    if (target.email && rowEmail && target.email === rowEmail) {
      score += 100;
      reasons.push("même email");
    }
    if (target.phones.length && rowPhones.some(function(phone) { return target.phones.indexOf(phone) !== -1; })) {
      score += 100;
      reasons.push("même téléphone");
    }
    const sameDate = targetHasDate && rowDate === target.date;
    if (sameDate) {
      score += 60;
      reasons.push("même date");
    }
    if (target.name && rowName && target.name === rowName) {
      score += 50;
      reasons.push("même nom");
    } else if (target.name && rowName && hasSharedToken(target.name, rowName)) {
      score += 30;
      reasons.push("nom proche");
    }
    if (target.guests && rowGuests && target.guests === rowGuests) {
      score += 15;
      secondaryScore += 15;
      reasons.push("même nombre de convives");
    }
    if (target.type && target.type !== "autres" && rowType === target.type) {
      score += 10;
      secondaryScore += 10;
      reasons.push("même événement");
    }
    if (target.place && rowPlace && (
      target.place === rowPlace ||
      target.place.indexOf(rowPlace) !== -1 ||
      rowPlace.indexOf(target.place) !== -1 ||
      hasSharedToken(target.place, rowPlace)
    )) {
      score += 10;
      secondaryScore += 10;
      reasons.push("lieu proche");
    }
    if (mode === "followup" && row.statut === "Devis envoyé") score += 10;

    const hasStrongIdentity =
      (target.email && rowEmail && target.email === rowEmail) ||
      (target.phones.length && rowPhones.some(function(phone) { return target.phones.indexOf(phone) !== -1; })) ||
      (sameDate && target.name && rowName && (
        target.name === rowName || hasSharedToken(target.name, rowName)
      )) ||
      (target.name && rowName && target.name === rowName && secondaryScore > 0) ||
      (mode === "followup" && target.name && rowName && target.name === rowName);
    // Dans un suivi, un nom complet exact est suffisant à condition que la
    // demande active soit unique. Cela permet notamment de rattacher une
    // réponse email à une ancienne demande téléphonique sans adresse email.
    const exactNameFollowup = mode === "followup" && target.name && rowName && target.name === rowName;
    const minimumScore = exactNameFollowup ? 50 : (mode === "followup" ? 60 : 70);
    if (!hasStrongIdentity || score < minimumScore) return;

    candidates.push({
      rowIndex: rowOffset + 2,
      id_demande: String(row.id_demande || '').trim(),
      score: score,
      reasons: reasons,
      nom_client: String(row.nom_client || '').trim(),
      telephone: String(row.telephone || '').trim(),
      email_client: String(row.email_client || '').trim(),
      type_evenement: String(row.type_evenement || '').trim(),
      date_evenement: rowDate,
      heure_evenement: String(row.heure_evenement || '').trim(),
      nb_convives: String(row.nb_convives || '').trim(),
      lieu_prestation: String(row.lieu_prestation || '').trim(),
      statut: String(row.statut || '').trim(),
      canal: String(row.canal || '').trim(),
      notes: String(row.notes || '').trim()
    });
  });

  return candidates.sort(function(a, b) {
    return b.score - a.score || b.rowIndex - a.rowIndex;
  }).slice(0, 5);
}

function mergeManualDemandRow(sheet, headers, rowIndex, incoming) {
  const currentValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const current = {};
  headers.forEach(function(h, i) {
    current[canonicalKey(h)] = currentValues[i];
  });

  const preserved = {
    id_demande: true,
    date_reception: true,
    canal: true,
    gmail_thread_id: true,
    gmail_message_id: true,
    wix_form_fingerprint: true,
    dernier_email_recu_le: true,
    dernier_message_client: true,
    nb_relances_client: true,
    relance_a_traiter: true,
    en_attente_reponse_depuis: true
  };

  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (preserved[key] || incoming[key] === undefined) return;
    const incomingText = String(incoming[key] || '').trim();
    if (!incomingText) return;

    let value = incoming[key];
    const currentText = String(current[key] || '').trim();
    if (key === "statut" && incomingText === "Nouvelle demande" && currentText) return;
    if (key === "message_original" && currentText) return;
    if (key === "notes" && currentText && incomingText !== currentText) {
      value = currentText + "\n" + incomingText;
    }

    const cell = sheet.getRange(rowIndex, i + 1);
    if (key === "date_evenement") cell.setNumberFormat("@");
    cell.setValue(value);
  });

  const modificationCol = headers.findIndex(function(h) {
    return canonicalKey(h) === "derniere_modification";
  }) + 1;
  if (modificationCol > 0) sheet.getRange(rowIndex, modificationCol).setValue(new Date());
}

function findRowByCanonicalValue(sheet, headers, key, value) {
  const col = headers.findIndex(function(h) { return canonicalKey(h) === key; }) + 1;
  if (col <= 0) throw new Error("Colonne " + key + " introuvable");
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const target = String(value || '').trim();
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || '').trim() === target) {
      return {
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      };
    }
  }
  return null;
}

function findLatestRowByEmailAndEventDate(sheet, headers, emailClient, dateEvenement) {
  const emailCol = headers.findIndex(function(h) { return canonicalKey(h) === "email_client"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (emailCol <= 0) throw new Error("Colonne email_client introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetEmail = String(emailClient || '').trim().toLowerCase();
  const targetDate = normalizeEventDateText(dateEvenement);
  const emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];

  for (var i = emails.length - 1; i >= 0; i--) {
    const rowEmail = String(emails[i][0] || '').trim().toLowerCase();
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (rowEmail === targetEmail && rowDate === targetDate) {
      return {
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      };
    }
  }
  return null;
}

function findRowsByEmailAndEventDate(sheet, headers, emailClient, dateEvenement) {
  const emailCol = headers.findIndex(function(h) { return canonicalKey(h) === "email_client"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (emailCol <= 0) throw new Error("Colonne email_client introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const targetEmail = String(emailClient || '').trim().toLowerCase();
  const targetDate = normalizeEventDateText(dateEvenement);
  const emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < emails.length; i++) {
    const rowEmail = String(emails[i][0] || '').trim().toLowerCase();
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (rowEmail === targetEmail && rowDate === targetDate) {
      matches.push({ rowIndex: i + 2, id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : "" });
    }
  }
  return matches;
}

function findActiveRowsByEmail(sheet, headers, emailClient) {
  const emailCol = headers.findIndex(function(h) { return canonicalKey(h) === "email_client"; }) + 1;
  const statusCol = headers.findIndex(function(h) { return canonicalKey(h) === "statut"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (emailCol <= 0) throw new Error("Colonne email_client introuvable");
  if (statusCol <= 0) throw new Error("Colonne statut introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const terminalStatuses = {
    "Événement terminé": true,
    "Perdu / Sans suite": true,
    "Refusé / Complet": true
  };
  const targetEmail = String(emailClient || '').trim().toLowerCase();
  const emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < emails.length; i++) {
    const rowEmail = String(emails[i][0] || '').trim().toLowerCase();
    const rowStatus = String(statuses[i][0] || '').trim();
    if (rowEmail === targetEmail && !terminalStatuses[rowStatus]) {
      matches.push({
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      });
    }
  }
  return matches;
}

function findActiveRowsByPhone(sheet, headers, telephone) {
  const phoneCol = headers.findIndex(function(h) { return canonicalKey(h) === "telephone"; }) + 1;
  const statusCol = headers.findIndex(function(h) { return canonicalKey(h) === "statut"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (phoneCol <= 0) throw new Error("Colonne telephone introuvable");
  if (statusCol <= 0) throw new Error("Colonne statut introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const targetPhones = normalizePhoneKeys(telephone);
  if (!targetPhones.length) return [];
  const phones = sheet.getRange(2, phoneCol, lastRow - 1, 1).getValues();
  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < phones.length; i++) {
    const rowPhones = normalizePhoneKeys(phones[i][0]);
    if (rowPhones.some(function(phone) { return targetPhones.indexOf(phone) !== -1; }) && isActiveDemandStatus(statuses[i][0])) {
      matches.push({
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      });
    }
  }
  return matches;
}

function findActiveRowsByPhoneAndEventDate(sheet, headers, telephone, dateEvenement) {
  const targetDate = normalizeEventDateText(dateEvenement);
  if (!targetDate || targetDate === "Inconnu / à compléter") return [];

  const phoneCol = headers.findIndex(function(h) { return canonicalKey(h) === "telephone"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const statusCol = headers.findIndex(function(h) { return canonicalKey(h) === "statut"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (phoneCol <= 0) throw new Error("Colonne telephone introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");
  if (statusCol <= 0) throw new Error("Colonne statut introuvable");

  const targetPhones = normalizePhoneKeys(telephone);
  if (!targetPhones.length) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const phones = sheet.getRange(2, phoneCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < phones.length; i++) {
    const rowPhones = normalizePhoneKeys(phones[i][0]);
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (
      isActiveDemandStatus(statuses[i][0]) &&
      rowDate === targetDate &&
      rowPhones.some(function(phone) { return targetPhones.indexOf(phone) !== -1; })
    ) {
      matches.push({
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      });
    }
  }
  return matches;
}

// Opération de maintenance explicite, exécutée avec les droits Apps Script.
// Elle ne touche qu'aux numéros français valides et conserve les numéros non
// interprétables afin d'éviter toute correction destructive.
function normalizeExistingPhones() {
  return withDocumentLock(function() {
    const sheet = getSheet();
    ensureSchemaHeaders(sheet);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const phoneCol = headers.findIndex(function(h) { return canonicalKey(h) === 'telephone'; }) + 1;
    if (phoneCol <= 0) throw new Error('Colonne telephone introuvable');
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { scanned: 0, updated: 0 };

    const range = sheet.getRange(2, phoneCol, lastRow - 1, 1);
    const values = range.getValues();
    let updated = 0;
    const normalized = values.map(function(row) {
      const current = String(row[0] || '').trim();
      // Une valeur sans aucun numéro français valide est conservée telle quelle.
      const formatted = normalizePhoneKeys(current).length ? formatFrenchPhone(current) : current;
      if (formatted !== current) updated++;
      return [formatted];
    });
    if (updated) range.setValues(normalized);
    return { scanned: values.length, updated: updated };
  });
}

function findActiveRowsByEventDate(sheet, headers, dateEvenement) {
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const statusCol = headers.findIndex(function(h) { return canonicalKey(h) === "statut"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");
  if (statusCol <= 0) throw new Error("Colonne statut introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const targetDate = normalizeEventDateText(dateEvenement);
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < dates.length; i++) {
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (rowDate === targetDate && isActiveDemandStatus(statuses[i][0])) {
      matches.push({ rowIndex: i + 2, id_demande: idCol > 0 ? String(ids[i][0] || "").trim() : "" });
    }
  }
  return matches;
}

function findLatestRowByNameAndEventDate(sheet, headers, nomClient, dateEvenement) {
  const nameCol = headers.findIndex(function(h) { return canonicalKey(h) === "nom_client"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (nameCol <= 0) throw new Error("Colonne nom_client introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetName = normalizePersonName(nomClient);
  const targetDate = normalizeEventDateText(dateEvenement);
  const names = sheet.getRange(2, nameCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];

  for (var i = names.length - 1; i >= 0; i--) {
    const rowName = normalizePersonName(names[i][0]);
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (rowName === targetName && rowDate === targetDate) {
      return {
        rowIndex: i + 2,
        id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
      };
    }
  }
  return null;
}

function findRowsByNameAndEventDate(sheet, headers, nomClient, dateEvenement) {
  const nameCol = headers.findIndex(function(h) { return canonicalKey(h) === "nom_client"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (nameCol <= 0) throw new Error("Colonne nom_client introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_evenement introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const targetName = normalizePersonName(nomClient);
  const targetDate = normalizeEventDateText(dateEvenement);
  const names = sheet.getRange(2, nameCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const dateDisplays = sheet.getRange(2, dateCol, lastRow - 1, 1).getDisplayValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];
  const matches = [];

  for (var i = 0; i < names.length; i++) {
    const rowName = normalizePersonName(names[i][0]);
    const rowDate = normalizeEventDateText(dateDisplays[i][0] || dates[i][0]);
    if (rowName === targetName && rowDate === targetDate) {
      matches.push({ rowIndex: i + 2, id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : "" });
    }
  }
  return matches;
}

function findLatestRowByEmailAndIdPrefix(sheet, headers, emailClient, idPrefix) {
  const emailCol = headers.findIndex(function(h) { return canonicalKey(h) === "email_client"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (emailCol <= 0) throw new Error("Colonne email_client introuvable");
  if (idCol <= 0) throw new Error("Colonne id_demande introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetEmail = String(emailClient || '').trim().toLowerCase();
  const prefix = String(idPrefix || '').trim();
  const emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

  for (var i = emails.length - 1; i >= 0; i--) {
    const rowEmail = String(emails[i][0] || '').trim().toLowerCase();
    const idDemande = String(ids[i][0] || '').trim();
    if (rowEmail === targetEmail && idDemande.indexOf(prefix) === 0) {
      return { rowIndex: i + 2, id_demande: idDemande };
    }
  }
  return null;
}

function findRecentWixDuplicate(sheet, headers, fingerprint, dateReception, windowMinutes) {
  const fingerprintCol = headers.findIndex(function(h) { return canonicalKey(h) === "wix_form_fingerprint"; }) + 1;
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_reception"; }) + 1;
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  if (fingerprintCol <= 0) throw new Error("Colonne wix_form_fingerprint introuvable");
  if (dateCol <= 0) throw new Error("Colonne date_reception introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetFingerprint = String(fingerprint || '').trim();
  const targetDate = parseDateTimeValue(dateReception) || new Date();
  const maxDiffMs = windowMinutes * 60 * 1000;
  const fingerprints = sheet.getRange(2, fingerprintCol, lastRow - 1, 1).getValues();
  const dates = sheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  const ids = idCol > 0 ? sheet.getRange(2, idCol, lastRow - 1, 1).getValues() : [];

  for (var i = fingerprints.length - 1; i >= 0; i--) {
    const rowFingerprint = String(fingerprints[i][0] || '').trim();
    if (rowFingerprint !== targetFingerprint) continue;

    const rowDate = parseDateTimeValue(dates[i][0]);
    if (!rowDate || Math.abs(targetDate.getTime() - rowDate.getTime()) > maxDiffMs) continue;
    return {
      rowIndex: i + 2,
      id_demande: idCol > 0 ? String(ids[i][0] || '').trim() : ""
    };
  }
  return null;
}

function mergeWixDemandRow(sheet, headers, rowIndex, incoming, operationResult) {
  const currentValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const current = {};
  const nextValues = currentValues.slice();
  headers.forEach(function(h, i) {
    current[canonicalKey(h)] = currentValues[i];
  });

  const preserveExisting = {
    id_demande: true,
    date_reception: true,
    canal: true,
    nb_relances_client: true,
    relance_a_traiter: true
  };

  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (preserveExisting[key]) return;
    if (incoming[key] === undefined) return;

    const incomingValue = incoming[key];
    const currentValue = current[key];
    const incomingText = String(incomingValue || '').trim();
    const currentText = String(currentValue || '').trim();
    if (!incomingText) return;

    const shouldReplace = !currentText ||
      key === "nom_client" ||
      key === "telephone" ||
      key === "email_client" ||
      key === "type_evenement" ||
      key === "date_evenement" ||
      key === "heure_evenement" ||
      key === "nb_convives" ||
      key === "lieu_prestation" ||
      key === "budget_estime" ||
      key === "message_original" ||
      key === "notes" ||
      key === "derniere_modification" ||
      key === "gmail_thread_id" ||
      key === "gmail_message_id" ||
      key === "wix_form_fingerprint" ||
      key === "url_email_origine";

    if (shouldReplace) {
      nextValues[i] = incomingValue;
    }
  });

  const logCol = headers.findIndex(function(h) { return canonicalKey(h) === "make_operation_log"; }) + 1;
  if (logCol <= 0) throw new Error("Colonne make_operation_log introuvable");
  nextValues[logCol - 1] = appendMakeOperationLog(
    nextValues[logCol - 1],
    getMakeMessageId(incoming),
    operationResult
  );
  const dateCol = headers.findIndex(function(h) { return canonicalKey(h) === "date_evenement"; }) + 1;
  if (dateCol > 0) sheet.getRange(rowIndex, dateCol).setNumberFormat("@");
  sheet.getRange(rowIndex, 1, 1, nextValues.length).setValues([nextValues]);
}

function findDuplicateDemand(sheet, headers, demandIds, gmailThreadId, requiredSourceEmail) {
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  const threadCol = headers.findIndex(function(h) { return canonicalKey(h) === "gmail_thread_id"; }) + 1;
  const emailCol = headers.findIndex(function(h) { return canonicalKey(h) === "email_client"; }) + 1;
  if (idCol <= 0) throw new Error("Colonne id_demande introuvable");
  if (requiredSourceEmail && emailCol <= 0) throw new Error("Colonne email_client introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetIds = {};
  (demandIds || []).forEach(function(value) {
    const s = String(value || '').trim();
    if (s) targetIds[s] = true;
  });
  const targetThread = String(gmailThreadId || '').trim();
  const targetSourceEmail = String(requiredSourceEmail || '').trim().toLowerCase();

  // L'anti-doublon est exécuté pour chaque email. Une seule lecture contiguë
  // réduit nettement la latence Apps Script par rapport aux deux lectures de
  // colonnes séparées, tout en gardant exactement les mêmes critères.
  const readColumns = [idCol];
  if (threadCol > 0) readColumns.push(threadCol);
  if (targetSourceEmail) readColumns.push(emailCol);
  const firstCol = Math.min.apply(null, readColumns);
  const lastCol = Math.max.apply(null, readColumns);
  const values = sheet.getRange(2, firstCol, lastRow - 1, lastCol - firstCol + 1).getValues();
  const idOffset = idCol - firstCol;
  const threadOffset = threadCol - firstCol;
  const emailOffset = emailCol - firstCol;
  for (var i = values.length - 1; i >= 0; i--) {
    const rowId = String(values[i][idOffset] || '').trim();
    const rowThread = threadCol > 0 ? String(values[i][threadOffset] || '').trim() : "";
    const rowEmail = targetSourceEmail ? String(values[i][emailOffset] || '').trim().toLowerCase() : "";
    const matchesIdentity = (rowId && targetIds[rowId]) || (targetThread && rowId === targetThread) || (targetThread && rowThread === targetThread);
    if (matchesIdentity && (!targetSourceEmail || rowEmail === targetSourceEmail)) {
      return { rowIndex: i + 2, id_demande: rowId };
    }
  }
  return null;
}

function isTechnicalTransactionalEmail(email) {
  return /@(?:[^@.]+\.)*brevosend\.com$/i.test(String(email || '').trim());
}

function serialise(val) {
  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS");
    } catch (e) {
      return val.toISOString();
    }
  }
  return val;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ko(msg) {
  if (DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT) {
    return makeTransportError(msg);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeTransportError(msg) {
  Utilities.sleep(MAKE_ERROR_DELAY_MS);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: String(msg || 'Erreur backend Make') }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Email & Trigger Security Functions ─────────────────────────

function normalizeFrenchPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\s+/g, '').trim();
  let digits = clean.replace(/\D/g, '');
  
  if (digits.indexOf('33') === 0) {
    if (digits.indexOf('330') === 0) {
      digits = digits.substring(2);
    } else {
      digits = '0' + digits.substring(2);
    }
  }
  
  if (digits.length === 9 && /^[1-9]/.test(digits)) {
    digits = '0' + digits;
  }
  
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  
  return phone;
}

function getMissingFields(e) {
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

function sendNewDemandEmail(r) {
  const recipient = "demande.chezpapimaisongourmande@gmail.com";
  const subject = `[Chez Papi] Nouvelle demande : ${r.nom_client || 'Sans nom'}`;
  const clientName = escapeHtml(r.nom_client || 'Sans nom');
  
  const missing = getMissingFields(r);
  const isIncomplete = missing.length > 0;
  
  let borderStyle = isIncomplete ? "border-left: 4px solid #C0453A;" : "border-left: 4px solid #4A6741;";
  let warningText = "";
  if (isIncomplete) {
    warningText = `<div style="color: #C0453A; font-weight: bold; margin-bottom: 12px; font-size: 13px;">
      ⚠️ Infos manquantes : ${missing.join(', ')}
    </div>`;
  }
  
  let html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eadecc; border-radius: 8px; background-color: #fcfaf7; color: #5C3D1E;">
    <h2 style="color: #5C3D1E; border-bottom: 2px solid #5C3D1E; padding-bottom: 10px; margin-top: 0; font-family: Georgia, serif;">
      Chez Papi — Nouvelle Demande
    </h2>
    <div style="background-color: #fff; border: 1px solid #eadecc; border-radius: 6px; padding: 16px; margin-top: 16px; ${borderStyle}">
      ${warningText}
      <h3 style="margin: 0 0 12px 0; color: #5C3D1E; font-size: 18px;">
        ${clientName}
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #5C3D1E;">
        <tr>
          <td style="width: 35%; padding: 4px 0; color: #8A7260;"><strong>Type d'événement:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.type_evenement || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Date de l'événement:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.date_evenement || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Nombre de convives:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.nb_convives || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Lieu:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.lieu_prestation || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Téléphone:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(normalizeFrenchPhone(r.telephone) || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Email:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.email_client || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Budget:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.budget_estime || '—')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Canal:</strong></td>
          <td style="padding: 4px 0;">${escapeHtml(r.canal || '—')}</td>
        </tr>
      </table>
      ${r.message_original ? `<div style="background-color: #fdf6f0; border-radius: 4px; padding: 12px; margin-top: 12px; font-size: 13px; color: #5C3D1E; white-space: pre-wrap;"><strong>Message original:</strong><br/>${escapeHtml(r.message_original)}</div>` : ''}
      <div style="margin-top: 20px; text-align: center;">
        <a href="${FRONTEND_URL}?id=${encodeURIComponent(r.id_demande || r._row)}" target="_blank" style="display: inline-block; background-color: #5C3D1E; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; box-shadow: 0 4px 6px rgba(92, 61, 30, 0.15);">
          Consulter / Modifier dans le Tableau de Bord
        </a>
      </div>
    </div>
    <p style="font-size: 11px; text-align: center; color: #8A7260; margin-top: 20px;">
      Chez Papi Maison Gourmande • Cet e-mail est généré automatiquement.
    </p>
  </div>`;

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: html
  });
}

function sendDailySummary() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  const yyyy = yesterday.getFullYear();
  const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
  const dd = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayDateString = `${yyyy}-${mm}-${dd}`;
  
  const yesterdayRows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = { _row: i + 1 };
    headers.forEach((h, j) => { rowData[h] = row[j]; });
    
    if (!rowData.id_demande && !rowData.nom_client) continue; // Ignorer les lignes vides
    
    let receptionDateStr = "";
    if (rowData.date_reception instanceof Date) {
      const ry = rowData.date_reception.getFullYear();
      const rm = String(rowData.date_reception.getMonth() + 1).padStart(2, '0');
      const rd = String(rowData.date_reception.getDate()).padStart(2, '0');
      receptionDateStr = `${ry}-${rm}-${rd}`;
    } else if (rowData.date_reception) {
      const match = String(rowData.date_reception).match(/\d{4}-\d{2}-\d{2}/);
      if (match) receptionDateStr = match[0];
    }
    
    if (receptionDateStr === yesterdayDateString) {
      yesterdayRows.push(rowData);
    }
  }

  // Dédoublonner par id_demande avant envoi (garder le statut le plus avancé)
  const statOrder = {
    'Nouvelle demande': 1, 'À rappeler': 2, 'Devis à préparer': 3,
    'Devis envoyé': 4, 'Événement confirmé': 5, 'Événement terminé': 6,
    'Perdu / Sans suite': 7, 'Refusé / Complet': 7
  };
  const seenIds = new Map();
  yesterdayRows.forEach(r => {
    const id = String(r.id_demande || '').trim();
    if (!id) return;
    const existing = seenIds.get(id);
    if (!existing) { seenIds.set(id, r); return; }
    const o1 = statOrder[existing.statut] || 0;
    const o2 = statOrder[r.statut] || 0;
    if (o2 > o1) seenIds.set(id, r);
  });
  const deduped = yesterdayRows.filter(r => {
    const id = String(r.id_demande || '').trim();
    return !id || seenIds.get(id)._row === r._row;
  });

  // Récapitulatif désactivé pour le moment
  //sendSummaryEmail(deduped, yesterdayDateString);
}

function sendSummaryEmail(rows, dateString) {
  const recipient = "demande.chezpapimaisongourmande@gmail.com";
  const parts = dateString.split('-');
  const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  const subject = `[Chez Papi] Récapitulatif du ${formattedDate} : ${rows.length} demande(s)`;
  
  let html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eadecc; border-radius: 8px; background-color: #fcfaf7; color: #5C3D1E;">
    <h2 style="color: #5C3D1E; border-bottom: 2px solid #5C3D1E; padding-bottom: 10px; margin-top: 0; font-family: Georgia, serif;">
      Chez Papi — Récapitulatif quotidien
    </h2>
    <p style="font-size: 14px; color: #8A7260; margin-bottom: 20px;">
      Demandes reçues le <strong>${formattedDate}</strong> :
    </p>`;
    
  if (rows.length === 0) {
    html += `<p style="padding: 16px; background-color: #fff; border: 1px solid #eadecc; border-radius: 6px; text-align: center; font-style: italic; color: #8A7260;">
      Aucune nouvelle demande reçue hier.
    </p>`;
  } else {
    rows.forEach((r, index) => {
      const missing = getMissingFields(r);
      const isIncomplete = missing.length > 0;
      
      let borderStyle = isIncomplete ? "border-left: 4px solid #C0453A;" : "border-left: 4px solid #4A6741;";
      let warningText = "";
      if (isIncomplete) {
        warningText = `<div style="color: #C0453A; font-weight: bold; margin-bottom: 8px; font-size: 13px;">
          ⚠️ Infos manquantes : ${missing.join(', ')}
        </div>`;
      }
      
      html += `<div style="background-color: #fff; border: 1px solid #eadecc; border-radius: 6px; padding: 16px; margin-bottom: 16px; ${borderStyle}">
        ${warningText}
        <h3 style="margin: 0 0 8px 0; color: #5C3D1E; font-size: 16px;">
          ${escapeHtml(r.nom_client || 'Sans nom')}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #5C3D1E;">
          <tr>
            <td style="width: 35%; padding: 4px 0; color: #8A7260;"><strong>Type d'événement:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.type_evenement || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Date de l'événement:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.date_evenement || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Nombre de convives:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.nb_convives || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Lieu:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.lieu_prestation || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Téléphone:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(normalizeFrenchPhone(r.telephone) || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Email:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.email_client || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Budget:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.budget_estime || '—')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Canal:</strong></td>
            <td style="padding: 4px 0;">${escapeHtml(r.canal || '—')}</td>
          </tr>
        </table>
        ${r.message_original ? `<div style="background-color: #fdf6f0; border-radius: 4px; padding: 10px; margin-top: 10px; font-size: 12px; color: #5C3D1E; white-space: pre-wrap;"><strong>Message original:</strong><br/>${escapeHtml(r.message_original)}</div>` : ''}
        <div style="margin-top: 14px; text-align: right;">
          <a href="${FRONTEND_URL}?id=${encodeURIComponent(r.id_demande || r._row)}" target="_blank" style="display: inline-block; background-color: #5C3D1E; color: #fff; padding: 6px 14px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(92, 61, 30, 0.12);">
            Consulter / Modifier
          </a>
        </div>
      </div>`;
    });
  }
  
  html += `<p style="font-size: 11px; text-align: center; color: #8A7260; margin-top: 20px;">
    Chez Papi Maison Gourmande • Cet e-mail est généré automatiquement.
  </p>
  </div>`;
  
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: html
  });
}

function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendDailySummary') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  ScriptApp.newTrigger('sendDailySummary')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();
}

function generateUniqueDemandId(sheet, headers) {
  const idColIndex = headers.findIndex(function(h) { return canonicalKey(h) === 'id_demande'; }) + 1;
  if (idColIndex <= 0) {
    throw new Error("Colonne id_demande introuvable");
  }

  const today = new Date();
  const yyyymmdd = today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const lastRow = sheet.getLastRow();

  let existingIds = new Set();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
    existingIds = new Set(
      values
        .flat()
        .map(v => String(v || '').trim())
        .filter(Boolean)
    );
  }

  let id;
  do {
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    id = 'MANUAL-' + yyyymmdd + '-' + rand;
  } while (existingIds.has(id));

  return id;
}

// ── GOOGLE CALENDAR SYNCHRONISATION ──────────────────────────────────────────

function parseEventDate(dateStr) {
  if (!dateStr) return null;
  var s = String(dateStr).trim();
  if (s === '' || s === '—') return null;
  if (/^(?:en\s+)?\d{4}$/i.test(s)) return null;
  var partialDate = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (partialDate) {
    return new Date(new Date().getFullYear(), Number(partialDate[2]) - 1, Number(partialDate[1]));
  }

  // Option 1: YYYY-MM-DD
  var ymdMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
  }

  // Option 2: DD/MM/YYYY
  var dmyMatch = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmyMatch) {
    return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  }

  // Option 3: Plages de dates "2026-06-30 au 2026-07-03" (on prend la première date)
  if (s.indexOf(' au ') !== -1) {
    var firstPart = s.split(' au ')[0].trim();
    return parseEventDate(firstPart);
  }

  // Fallback standard parse
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return null;
}

function splitEventDateRange(dateStr) {
  var s = String(dateStr || '').trim();
  var match = s.match(/^(?:du\s+)?(.+?)\s+au\s+(.+)$/i);
  if (!match) return null;
  return { start: match[1].trim(), end: match[2].trim() };
}

function parseEventEndDate(dateStr) {
  var range = splitEventDateRange(dateStr);
  return parseEventDate(range ? range.end : dateStr);
}

function addDays(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function parseEventTime(timeStr) {
  if (!timeStr) return null;
  var s = String(timeStr).trim();
  if (s === '' || s === '—') return null;
  var match = s.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    minutes: Number(match[2])
  };
}

function findCalendarEvent(calendar, idDemande) {
  if (!idDemande) return null;
  
  // Plage de recherche large (-1 an à +2 ans)
  var now = new Date();
  var startTime = new Date(now.getFullYear() - 1, 0, 1);
  var endTime = new Date(now.getFullYear() + 2, 11, 31);
  
  var events = calendar.getEvents(startTime, endTime, { search: idDemande });
  if (events && events.length > 0) {
    for (var i = 0; i < events.length; i++) {
      var desc = events[i].getDescription();
      if (desc && desc.indexOf(idDemande) !== -1) {
        return events[i];
      }
    }
  }
  return null;
}

// ── Normalise les clés d'un objet rowData quel que soit le format des en-têtes ──
// Gère aussi bien {"ID Demande": "CP-.."} que {"id_demande": "CP-.."}
function normalizeRowKeys(rawData) {
  var normalized = {};
  var keys = Object.keys(rawData);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var mapped = canonicalKey(k);
    normalized[mapped] = rawData[k];
  }
  return normalized;
}

function syncCalendarEvent(rowData) {
  // Normaliser les clés pour être robuste quelle que soit la source
  var data = normalizeRowKeys(rowData || {});
  
  Logger.log("[syncCalendarEvent] id_demande=" + data.id_demande + ", statut=" + data.statut + ", date_evenement=" + data.date_evenement);
  
  if (!data.id_demande) {
    Logger.log("[syncCalendarEvent] Annulé : id_demande manquant. Clés disponibles : " + Object.keys(rowData || {}).join(', '));
    return;
  }
  
  var calendar;
  try {
    calendar = CalendarApp.getDefaultCalendar();
    Logger.log("[syncCalendarEvent] Calendrier : " + calendar.getName());
  } catch (err) {
    Logger.log("[syncCalendarEvent] Impossible d'accéder au calendrier : " + err.message);
    return;
  }
  
  var existingEvent = findCalendarEvent(calendar, data.id_demande);
  var statutStr = String(data.statut || '').trim();
  var isConfirmed = isConfirmedStatus(statutStr);
  
  Logger.log("[syncCalendarEvent] isConfirmed=" + isConfirmed + ", statut brut='" + statutStr + "'");
  
  if (isConfirmed) {
    var eventDate = parseEventDate(data.date_evenement);
    if (!eventDate) {
      Logger.log("[syncCalendarEvent] Annulé : date_evenement manquante ou invalide : '" + data.date_evenement + "'");
      return;
    }
    var eventEndDate = parseEventEndDate(data.date_evenement) || eventDate;
    if (eventEndDate.getTime() < eventDate.getTime()) {
      eventEndDate = eventDate;
    }
    var allDayEndDate = addDays(eventEndDate, 1);
    var eventTime = parseEventTime(data.heure_evenement);
    
    var title = (data.nom_client || 'Client inconnu') + ' - ' + (data.type_evenement || 'Événement');
    var location = data.lieu_prestation || '';
    var description = 'ID Demande: ' + data.id_demande + '\n' +
                      'Heure: ' + (data.heure_evenement || 'Non renseignée') + '\n' +
                      'Nombre de convives: ' + (data.nb_convives || 'Non renseigné') + '\n' +
                      'Budget estimé: ' + (data.budget_estime || 'Non renseigné') + '\n' +
                      'Notes: ' + (data.notes || 'Aucune');
    var startTime = null;
    var endTime = null;
    if (eventTime) {
      startTime = new Date(eventDate.getTime());
      startTime.setHours(eventTime.hours, eventTime.minutes, 0, 0);
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }
    
    if (existingEvent) {
      existingEvent.setTitle(title);
      existingEvent.setLocation(location);
      existingEvent.setDescription(description);
      if (startTime && endTime) {
        existingEvent.setTime(startTime, endTime);
      } else {
        existingEvent.setAllDayDates(eventDate, allDayEndDate);
      }
      Logger.log("[syncCalendarEvent] Événement MIS À JOUR pour " + data.id_demande);
    } else {
      if (startTime && endTime) {
        calendar.createEvent(title, startTime, endTime, {
          location: location,
          description: description
        });
      } else {
        calendar.createAllDayEvent(title, eventDate, allDayEndDate, {
          location: location,
          description: description
        });
      }
      Logger.log("[syncCalendarEvent] Événement CRÉÉ pour " + data.id_demande);
    }
  } else {
    if (existingEvent) {
      existingEvent.deleteEvent();
      Logger.log("[syncCalendarEvent] Événement SUPPRIMÉ pour " + data.id_demande);
    } else {
      Logger.log("[syncCalendarEvent] Aucune action (statut non confirmé, pas d'event existant)");
    }
  }
}

function isConfirmedStatus(status) {
  const value = String(status || '').trim();
  return value === 'Événement confirmé' ||
    value === 'evenement confirme' ||
    value.toLowerCase().replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a') === 'evenement confirme';
}

function testCalendar() {
  var calendar = CalendarApp.getDefaultCalendar();
  Logger.log("Calendar Name: " + calendar.getName());
}

// ── Fonction de test complète : appeler depuis l'éditeur pour diagnostiquer ──
function testCalendarFull() {
  // 1. Lire la première ligne de données du sheet
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  Logger.log("[testCalendarFull] En-têtes du sheet : " + JSON.stringify(headers));
  
  if (data.length < 2) {
    Logger.log("[testCalendarFull] Aucune donnée dans le sheet.");
    return;
  }
  
  // Tester sur la dernière ligne non vide
  var lastRowValues = data[data.length - 1];
  var rowData = {};
  headers.forEach(function(h, i) { rowData[h] = lastRowValues[i]; });
  Logger.log("[testCalendarFull] rowData = " + JSON.stringify(rowData));
  
  // Tenter la synchronisation
  syncCalendarEvent(rowData);
  Logger.log("[testCalendarFull] Terminé.");
}
