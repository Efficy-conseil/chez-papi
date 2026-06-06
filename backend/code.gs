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
      .filter(r => r.id_demande || r.nom_client || r.date_evenement); // ignore les lignes vides

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
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    rowData.id_demande = 'CP-' + yyyymmdd + '-' + rand;
  }
  
  // Initialisation de la date de réception si absente
  if (!rowData.date_reception) {
    rowData.date_reception = new Date();
  }
  
  rowData.derniere_modification = new Date();
  
  sheet.appendRow(headers.map(h => rowData[h] ?? ''));
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
  return ok({ success: true });
}

function deleteRow(rowIndex) {
  const sheet = getSheet();
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

