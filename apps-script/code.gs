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
const DEFAULT_ROW_HEIGHT_PX = 20;

const ALLOWED_STATUSES = [
  "Nouvelle demande",
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
  "en_attente_reponse_depuis"
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
  try {
    return ko("Utilisez POST");
  } catch (err) {
    return ko(err.message);
  }
}

// ── POST : lecture / écriture ──────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const auth = body.auth || { user: body.user, pass: body.pass };
    const isMakeFollowup = (
      (body.action === 'updateThreadFollowup' || body.action === 'updateWixFollowup' || body.action === 'updateExistingDemandFollowup' || body.action === 'checkDuplicate' || body.action === 'upsertWixDemand') &&
      body.make_token === MAKE_FOLLOWUP_TOKEN
    );
    if (!isMakeFollowup && !checkAuth(auth.user, auth.pass)) {
      return ko("Non autorisé");
    }

    if (body.action === 'list' || body.action === 'getAll') return listRows();
    if (body.action === 'add')    return withDocumentLock(function() { return addRow(body.row || {}); });
    if (body.action === 'update') return withDocumentLock(function() { return updateRowById(body.id_demande, body.fields || {}); });
    if (body.action === 'updateThreadFollowup') return withDocumentLock(function() { return updateThreadFollowup(body.gmail_thread_id, body.fields || {}); });
    if (body.action === 'updateWixFollowup') return withDocumentLock(function() { return updateWixFollowup(body.gmail_thread_id, body.email_client, body.fields || {}); });
    if (body.action === 'updateExistingDemandFollowup') return withDocumentLock(function() { return updateExistingDemandFollowup(body.match || {}, body.fields || {}); });
    if (body.action === 'checkDuplicate') return checkDuplicate(body.match || {});
    if (body.action === 'upsertWixDemand') return withDocumentLock(function() { return upsertWixDemand(body.row || {}, body.options || {}); });
    if (body.action === 'delete') return withDocumentLock(function() { return deleteRowById(body.id_demande); });
    return ko('Action inconnue : ' + body.action);
  } catch (err) {
    return ko(err.message);
  }
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

function addRow(rowData) {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const clean = sanitizeFields(rowData || {}, false);
  
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
  return ok({ id_demande: clean.id_demande });
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

  const windowMinutes = Math.max(1, Number(options.merge_window_minutes || 15));
  const duplicate = findRecentWixDuplicate(sheet, headers, clean.wix_form_fingerprint, clean.date_reception, windowMinutes);
  if (duplicate) {
    mergeWixDemandRow(sheet, headers, duplicate.rowIndex, clean);
    applyDefaultRowHeight(sheet, duplicate.rowIndex);
    return ok({
      id_demande: duplicate.id_demande || clean.id_demande,
      row: duplicate.rowIndex,
      created: false,
      merged: true
    });
  }

  sheet.appendRow(headers.map(function(h) {
    return clean[canonicalKey(h)] !== undefined ? clean[canonicalKey(h)] : '';
  }));
  clean._row = sheet.getLastRow();
  forceTextCell(sheet, headers, clean._row, "date_evenement", clean.date_evenement);
  applyDefaultRowHeight(sheet, clean._row);
  return ok({ id_demande: clean.id_demande, row: clean._row, created: true, merged: false });
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
  if (!isStatusOnlyUpdate) {
    applyDefaultRowHeight(sheet, found.rowIndex);
  }

  // Un changement de statut entre deux états non confirmés ne concerne pas le calendrier.
  const requiresCalendarSync = !isStatusOnlyUpdate || isConfirmedStatus(currentStatus) || isConfirmedStatus(clean.statut);
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

function updateThreadFollowup(gmailThreadId, fields) {
  if (!gmailThreadId) throw new Error("gmail_thread_id manquant");
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const found = findRowByCanonicalValue(sheet, headers, "gmail_thread_id", gmailThreadId);
  if (!found) return ok({ updated: false, reason: "thread_not_found", gmail_thread_id: gmailThreadId });

  const clean = sanitizeFields(fields || {}, true);
  clean.relance_a_traiter = clean.relance_a_traiter !== undefined ? clean.relance_a_traiter : true;
  clean.dernier_email_recu_le = clean.dernier_email_recu_le || new Date();
  clean.derniere_modification = new Date();

  if (clean.nb_relances_client === undefined) {
    const countCol = headers.findIndex(function(h) { return canonicalKey(h) === "nb_relances_client"; }) + 1;
    const current = countCol > 0 ? Number(sheet.getRange(found.rowIndex, countCol).getValue() || 0) : 0;
    clean.nb_relances_client = current + 1;
  }

  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (clean[key] !== undefined) {
      sheet.getRange(found.rowIndex, i + 1).setValue(clean[key]);
    }
  });
  applyDefaultRowHeight(sheet, found.rowIndex);

  return ok({ updated: true, id_demande: found.id_demande || "", row: found.rowIndex });
}

function updateWixFollowup(gmailThreadId, emailClient, fields) {
  if (!gmailThreadId) throw new Error("gmail_thread_id manquant");
  const email = String(emailClient || '').trim().toLowerCase();
  if (!email) throw new Error("email_client manquant");

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const foundByThread = findRowByCanonicalValue(sheet, headers, "gmail_thread_id", gmailThreadId);
  const found = foundByThread || findLatestRowByEmailAndIdPrefix(sheet, headers, email, "WIX-");
  if (!found) {
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

  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (clean[key] !== undefined) {
      sheet.getRange(found.rowIndex, i + 1).setValue(clean[key]);
    }
  });
  applyDefaultRowHeight(sheet, found.rowIndex);

  return ok({
    updated: true,
    matched_by: foundByThread ? "gmail_thread_id" : "email_client",
    id_demande: found.id_demande || "",
    row: found.rowIndex
  });
}

function updateExistingDemandFollowup(match, fields) {
  const email = String(match.email_client || '').trim().toLowerCase();
  const name = normalizePersonName(match.nom_client);
  const dateEvenement = normalizeEventDateText(match.date_evenement);
  if (!email && !name) throw new Error("email_client ou nom_client manquant");
  if (!dateEvenement) throw new Error("date_evenement manquante");

  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const emailMatches = email ? findRowsByEmailAndEventDate(sheet, headers, email, dateEvenement) : [];
  const nameMatches = emailMatches.length === 0 && name
    ? findRowsByNameAndEventDate(sheet, headers, name, dateEvenement)
    : [];
  const matches = emailMatches.length > 0 ? emailMatches : nameMatches;
  if (matches.length !== 1) {
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
  clean.relance_a_traiter = clean.relance_a_traiter !== undefined ? clean.relance_a_traiter : true;
  clean.dernier_email_recu_le = clean.dernier_email_recu_le || new Date();
  clean.derniere_modification = new Date();

  if (clean.nb_relances_client === undefined) {
    const countCol = headers.findIndex(function(h) { return canonicalKey(h) === "nb_relances_client"; }) + 1;
    const current = countCol > 0 ? Number(sheet.getRange(found.rowIndex, countCol).getValue() || 0) : 0;
    clean.nb_relances_client = current + 1;
  }

  headers.forEach(function(h, i) {
    const key = canonicalKey(h);
    if (clean[key] !== undefined) {
      sheet.getRange(found.rowIndex, i + 1).setValue(clean[key]);
    }
  });
  applyDefaultRowHeight(sheet, found.rowIndex);

  return ok({ updated: true, id_demande: found.id_demande || "", row: found.rowIndex });
}

function checkDuplicate(match) {
  const sheet = getSheet();
  ensureSchemaHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const ids = [];
  const sourceEmail = String(match.source_email || '').trim().toLowerCase();
  const gmailMessageId = String(match.gmail_message_id || '').trim();
  const requestedThreadId = String(match.gmail_thread_id || '').trim();
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

  const found = findDuplicateDemand(sheet, headers, ids, gmailThreadId);
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      count: found ? 1 : 0,
      duplicate: !!found,
      id_demande: found ? found.id_demande || "" : "",
      row: found ? found.rowIndex : ""
    }))
    .setMimeType(ContentService.MimeType.JSON);
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
    .toLowerCase();
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
      return { rowIndex: i + 2 };
    }
  }
  return null;
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

function mergeWixDemandRow(sheet, headers, rowIndex, incoming) {
  const currentValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const current = {};
  headers.forEach(function(h, i) {
    current[canonicalKey(h)] = currentValues[i];
  });

  const preserveExisting = {
    id_demande: true,
    date_reception: true,
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
      key === "derniere_modification" ||
      key === "gmail_message_id" ||
      key === "url_email_origine" ||
      (key === "message_original" && incomingText.length > currentText.length) ||
      (key === "notes" && incomingText.length > currentText.length);

    if (shouldReplace) {
      const cell = sheet.getRange(rowIndex, i + 1);
      if (key === "date_evenement") cell.setNumberFormat("@");
      cell.setValue(incomingValue);
    }
  });
}

function findDuplicateDemand(sheet, headers, demandIds, gmailThreadId) {
  const idCol = headers.findIndex(function(h) { return canonicalKey(h) === "id_demande"; }) + 1;
  const threadCol = headers.findIndex(function(h) { return canonicalKey(h) === "gmail_thread_id"; }) + 1;
  if (idCol <= 0) throw new Error("Colonne id_demande introuvable");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const targetIds = {};
  (demandIds || []).forEach(function(value) {
    const s = String(value || '').trim();
    if (s) targetIds[s] = true;
  });
  const targetThread = String(gmailThreadId || '').trim();

  const idValues = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  const threadValues = threadCol > 0 ? sheet.getRange(2, threadCol, lastRow - 1, 1).getValues() : [];
  for (var i = idValues.length - 1; i >= 0; i--) {
    const rowId = String(idValues[i][0] || '').trim();
    const rowThread = threadCol > 0 ? String(threadValues[i][0] || '').trim() : "";
    if ((rowId && targetIds[rowId]) || (targetThread && rowId === targetThread) || (targetThread && rowThread === targetThread)) {
      return { rowIndex: i + 2, id_demande: rowId };
    }
  }
  return null;
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
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
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
