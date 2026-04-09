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

// ── GET : lecture de toutes les lignes ──────────────────────────

function doGet(e) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const rows = data.slice(1)
      .map((row, i) => {
        const obj = { _row: i + 2 }; // numéro de ligne réel dans le sheet
        headers.forEach((h, j) => { obj[h] = serialise(row[j]); });
        return obj;
      })
      .filter(r => r['Nom client']); // ignore les lignes vides

    return ok({ headers, rows });
  } catch (err) {
    return ko(err.message);
  }
}

// ── POST : écriture (add / update) ─────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
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
  sheet.appendRow(headers.map(h => rowData[h] ?? ''));
  return ok({ success: true });
}

function updateRow(rowIndex, fields) {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
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
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
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
