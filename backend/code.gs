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
    'Nouvelle demande': 1, 'À rappeler': 2, 'Client contacté': 3,
    'Devis envoyé': 4, 'Devis signé': 5, 'Prestation en cours': 6,
    'Prestation terminée': 7, 'Client perdu': 8
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

