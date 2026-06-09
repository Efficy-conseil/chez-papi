/**
 * ─────────────────────────────────────────────────────────────────
 *  CHEZ PAPI — Google Apps Script Backend
 *  À déployer depuis : Extensions > Apps Script dans le Google Sheet
 * ─────────────────────────────────────────────────────────────────
 *  1. Ouvrez votre Google Sheet
 *  2. Menu Extensions > Apps Script
 *  3. Collez ce code dans Code.gs et sauvegardez (Ctrl+S)
 *  4. Déployez : Déployer > Nouveau déploiement
 *       Type : Application web
 *       Exécuter en tant que : Moi
 *       Qui a accès : Tout le monde
 *  5. Copiez l'URL du déploiement dans CONFIG.SHEETS_URL de app.js
 * ─────────────────────────────────────────────────────────────────
 */

// Prend le premier onglet du sheet automatiquement
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

const AUTH_USER = "demande.chezpapimaisongourmande@gmail.com";
const AUTH_PASS = "Niconina13/";
const FRONTEND_URL = "https://efficy-conseil.github.io/chez-papi/";

function checkAuth(user, pass) {
  return user === AUTH_USER && pass === AUTH_PASS;
}

// ── GET : lecture de toutes les lignes ──────────────────────────

function doGet(e) {
  try {
    const user = e.parameter.user;
    const pass = e.parameter.pass;
    if (!checkAuth(user, pass)) {
      return ko("Non autorisé");
    }
    
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const rows = data.slice(1)
      .map((row, i) => {
        const obj = { _row: i + 2 }; // numéro de ligne réel dans le sheet
        headers.forEach((h, j) => { obj[h] = serialise(row[j]); });
        return obj;
      })
      .filter(r => headers.some(h => r[h] !== undefined && String(r[h]).trim() !== '')); // ignore les lignes vides

    return ok({ headers, rows });
  } catch (err) {
    return ko(err.message);
  }
}

// ── POST : écriture (add / update) ─────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!checkAuth(body.user, body.pass)) {
      return ko("Non autorisé");
    }
    
    if (body.action === 'add')    return addRow(body.row);
    if (body.action === 'update') return updateRow(body.rowIndex, body.fields);
    if (body.action === 'delete') return deleteRow(body.rowIndex);
    return ko('Action inconnue : ' + body.action);
  } catch (err) {
    return ko(err.message);
  }
}

function addRow(rowData) {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  
  // Auto-génération de l'identifiant unique si absent
  if (!rowData.id_demande) {
    const today = new Date();
    const yyyymmdd = today.getFullYear() + 
      String(today.getMonth() + 1).padStart(2, '0') + 
      String(today.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    rowData.id_demande = 'CP-' + yyyymmdd + '-' + rand;
  }
  
  // Initialisation de la date de réception si absente
  if (!rowData.date_reception) {
    rowData.date_reception = new Date();
  }
  
  rowData.derniere_modification = new Date();
  
  sheet.appendRow(headers.map(h => rowData[h] ?? ''));
  rowData._row = sheet.getLastRow();
  
  // Synchroniser avec Google Calendar
  try {
    syncCalendarEvent(rowData);
  } catch (err) {
    Logger.log("Erreur de synchronisation Google Calendar dans addRow: " + err.message);
  }
  
  // Envoyer une notification e-mail immédiate
  try {
    sendNewDemandEmail(rowData);
  } catch (err) {
    Logger.log("Erreur envoi email immédiat: " + err.message);
  }
  
  return ok({ success: true });
}

function updateRow(rowIndex, fields) {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  
  fields.derniere_modification = new Date();
  
  headers.forEach((h, i) => {
    if (fields[h] !== undefined) {
      sheet.getRange(rowIndex, i + 1).setValue(fields[h]);
    }
  });

  // Forcer l'écriture dans le sheet avant de relire la ligne
  SpreadsheetApp.flush();

  // Synchroniser avec Google Calendar (ligne complète relue après écriture)
  try {
    const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rawData = {};
    headers.forEach((h, i) => { rawData[h] = rowValues[i]; });
    syncCalendarEvent(rawData); // normalizeRowKeys est appelé à l'intérieur
  } catch (err) {
    Logger.log("Erreur de synchronisation Google Calendar dans updateRow: " + err.message);
  }
  
  return ok({ success: true });
}

function deleteRow(rowIndex) {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  
  // Supprimer l'événement Google Calendar associé avant de supprimer la ligne
  try {
    const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rawData = {};
    headers.forEach((h, i) => { rawData[h] = rowValues[i]; });
    const data = normalizeRowKeys(rawData); // robuste quel que soit le nom de colonne
    const idDemande = data.id_demande;
    if (idDemande) {
      var calendar = CalendarApp.getDefaultCalendar();
      var existingEvent = findCalendarEvent(calendar, idDemande);
      if (existingEvent) {
        existingEvent.deleteEvent();
        Logger.log("Événement Google Calendar supprimé via deleteRow pour " + idDemande);
      }
    }
  } catch (err) {
    Logger.log("Erreur suppression Google Calendar dans deleteRow: " + err.message);
  }
  
  sheet.deleteRow(rowIndex);
  return ok({ success: true });
}

// ── Helpers ─────────────────────────────────────────────────────

function serialise(val) {
  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    } catch (e) {
      return val.toISOString();
    }
  }
  return val;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ko(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: msg }))
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
        ${r.nom_client || 'Sans nom'}
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #5C3D1E;">
        <tr>
          <td style="width: 35%; padding: 4px 0; color: #8A7260;"><strong>Type d'événement:</strong></td>
          <td style="padding: 4px 0;">${r.type_evenement || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Date de l'événement:</strong></td>
          <td style="padding: 4px 0;">${r.date_evenement || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Nombre de convives:</strong></td>
          <td style="padding: 4px 0;">${r.nb_convives || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Lieu:</strong></td>
          <td style="padding: 4px 0;">${r.lieu_prestation || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Téléphone:</strong></td>
          <td style="padding: 4px 0;">${normalizeFrenchPhone(r.telephone) || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Email:</strong></td>
          <td style="padding: 4px 0;">${r.email_client || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Budget:</strong></td>
          <td style="padding: 4px 0;">${r.budget_estime || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #8A7260;"><strong>Canal:</strong></td>
          <td style="padding: 4px 0;">${r.canal || '—'}</td>
        </tr>
      </table>
      ${r.message_original ? `<div style="background-color: #fdf6f0; border-radius: 4px; padding: 12px; margin-top: 12px; font-size: 13px; color: #5C3D1E; white-space: pre-wrap;"><strong>Message original:</strong><br/>${r.message_original}</div>` : ''}
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
    'Perdu / Sans suite': 7
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

  sendSummaryEmail(deduped, yesterdayDateString);
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
          ${r.nom_client || 'Sans nom'}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #5C3D1E;">
          <tr>
            <td style="width: 35%; padding: 4px 0; color: #8A7260;"><strong>Type d'événement:</strong></td>
            <td style="padding: 4px 0;">${r.type_evenement || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Date de l'événement:</strong></td>
            <td style="padding: 4px 0;">${r.date_evenement || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Nombre de convives:</strong></td>
            <td style="padding: 4px 0;">${r.nb_convives || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Lieu:</strong></td>
            <td style="padding: 4px 0;">${r.lieu_prestation || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Téléphone:</strong></td>
            <td style="padding: 4px 0;">${normalizeFrenchPhone(r.telephone) || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Email:</strong></td>
            <td style="padding: 4px 0;">${r.email_client || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Budget:</strong></td>
            <td style="padding: 4px 0;">${r.budget_estime || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #8A7260;"><strong>Canal:</strong></td>
            <td style="padding: 4px 0;">${r.canal || '—'}</td>
          </tr>
        </table>
        ${r.message_original ? `<div style="background-color: #fdf6f0; border-radius: 4px; padding: 10px; margin-top: 10px; font-size: 12px; color: #5C3D1E; white-space: pre-wrap;"><strong>Message original:</strong><br/>${r.message_original}</div>` : ''}
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
    .atHour(7)
    .create();
}

// ── GOOGLE CALENDAR SYNCHRONISATION ──────────────────────────────────────────

function parseEventDate(dateStr) {
  if (!dateStr) return null;
  var s = String(dateStr).trim();
  if (s === '' || s === '—') return null;

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
  // Mapping : nom de colonne dans le sheet → clé snake_case attendue
  var KEY_MAP = {
    'id_demande': 'id_demande',
    'ID Demande': 'id_demande',
    'id demande': 'id_demande',
    'statut': 'statut',
    'Statut': 'statut',
    'nom_client': 'nom_client',
    'Nom Client': 'nom_client',
    'Client': 'nom_client',
    'date_evenement': 'date_evenement',
    'Date Evenement': 'date_evenement',
    'Date Événement': 'date_evenement',
    'type_evenement': 'type_evenement',
    'Type': 'type_evenement',
    'Type Evenement': 'type_evenement',
    'Type Événement': 'type_evenement',
    'lieu_prestation': 'lieu_prestation',
    'Lieu': 'lieu_prestation',
    'Lieu Prestation': 'lieu_prestation',
    'nb_convives': 'nb_convives',
    'Convives': 'nb_convives',
    'Nb Convives': 'nb_convives',
    'budget_estime': 'budget_estime',
    'Budget': 'budget_estime',
    'Budget Estime': 'budget_estime',
    'notes': 'notes',
    'Notes': 'notes',
    'telephone': 'telephone',
    'Telephone': 'telephone',
    'Téléphone': 'telephone',
    'email_client': 'email_client',
    'Email': 'email_client',
    'Email Client': 'email_client',
  };
  var normalized = {};
  var keys = Object.keys(rawData);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var mapped = KEY_MAP[k] || k;
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
  // Comparison insensible aux accents via normalisation
  var isConfirmed = statutStr === 'Événement confirmé' ||
                    statutStr === 'evenement confirme' ||
                    statutStr.toLowerCase().replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a') === 'evenement confirme';
  
  Logger.log("[syncCalendarEvent] isConfirmed=" + isConfirmed + ", statut brut='" + statutStr + "'");
  
  if (isConfirmed) {
    var eventDate = parseEventDate(data.date_evenement);
    if (!eventDate) {
      Logger.log("[syncCalendarEvent] Annulé : date_evenement manquante ou invalide : '" + data.date_evenement + "'");
      return;
    }
    
    var title = (data.nom_client || 'Client inconnu') + ' - ' + (data.type_evenement || 'Événement');
    var location = data.lieu_prestation || '';
    var description = 'ID Demande: ' + data.id_demande + '\n' +
                      'Nombre de convives: ' + (data.nb_convives || 'Non renseigné') + '\n' +
                      'Budget estimé: ' + (data.budget_estime || 'Non renseigné') + '\n' +
                      'Notes: ' + (data.notes || 'Aucune');
    
    if (existingEvent) {
      existingEvent.setTitle(title);
      existingEvent.setLocation(location);
      existingEvent.setDescription(description);
      existingEvent.setAllDayDate(eventDate);
      Logger.log("[syncCalendarEvent] Événement MIS À JOUR pour " + data.id_demande);
    } else {
      calendar.createAllDayEvent(title, eventDate, {
        location: location,
        description: description
      });
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

