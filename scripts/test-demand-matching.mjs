import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  Logger: {
    log(message) { context.loggedMessages.push(String(message)); }
  },
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
context.loggedMessages = [];
vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

const getError = evaluate('doGet({})');
assert.deepEqual(JSON.parse(getError.getContent()), { ok: false, error: 'Utilisez POST' });
assert.equal(getError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, []);
context.malformedMakeRequest = {
  postData: {
    contents: `{"action":"checkDuplicate","make_token":"cp_make_followup_2026_06",`
  }
};
const malformedMakeError = evaluate('doPost(malformedMakeRequest)');
assert.equal(JSON.parse(malformedMakeError.getContent()).ok, false);
assert.equal(malformedMakeError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, [20000]);
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
      checkDuplicate = function() { throw new Error('Erreur backend Make'); };
      return doPost(validMakeRequest);
    } finally {
      checkDuplicate = original;
    }
  })()`);
assert.deepEqual(JSON.parse(validMakeError.getContent()), { ok: false, error: 'Erreur backend Make' });
assert.equal(validMakeError.getMimeType(), 'application/json');
assert.deepEqual(context.sleepDurations, [20000, 20000]);
assert.equal(evaluate('DELAY_MAKE_ERRORS_FOR_HTTP_TIMEOUT'), false);
assert.equal(context.loggedMessages.at(-1), 'Erreur Make [checkDuplicate] : Erreur backend Make');
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

// Un fil Gmail partagé ne suffit jamais à dédupliquer deux expéditeurs directs.
const duplicateHeaders = ['id_demande', 'gmail_thread_id', 'email_client'];
const duplicateRows = [
  ['GMAIL-MANON', 'THREAD-MANON', 'contact@pantaiaevents.com']
];
context.duplicateHeaders = duplicateHeaders;
context.duplicateSheet = {
  getLastRow() { return duplicateRows.length + 1; },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, duplicateRows.length);
    const selected = duplicateRows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return { getValues() { return selected; } };
  }
};
assert.equal(
  evaluate('findDuplicateDemand(duplicateSheet, duplicateHeaders, ["GMAIL-THREAD-MANON"], "THREAD-MANON", "contact@6817076.brevosend.com")'),
  null
);
assert.equal(
  evaluate('findDuplicateDemand(duplicateSheet, duplicateHeaders, ["GMAIL-THREAD-MANON"], "THREAD-MANON", "contact@pantaiaevents.com").id_demande'),
  'GMAIL-MANON'
);
assert.equal(evaluate('isTechnicalTransactionalEmail("contact@6817076.brevosend.com")'), true);
assert.equal(evaluate('isTechnicalTransactionalEmail("contact@pantaiaevents.com")'), false);

context.createMakeDemand = row => ({
  getContent() {
    return JSON.stringify({ data: { id_demande: row.id_demande, created: true } });
  }
});
context.unmatchedRow = {
  id_demande: 'GMAIL-THREAD-81',
  statut: 'Devis envoyé',
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

const followupHeaders = [
  'telephone', 'nb_convives', 'email_client', 'gmail_message_id',
  'relance_a_traiter', 'make_operation_log'
];
const followupRows = [
  followupHeaders,
  ['06 12 34 56 78', '80', 'ancienne@example.com', 'MESSAGE-INITIAL', false, '']
];
context.followupSheet = {
  getLastColumn() { return followupHeaders.length; },
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return {
      getValues() {
        return followupRows
          .slice(row - 1, row - 1 + rowCount)
          .map(line => line.slice(column - 1, column - 1 + columnCount));
      },
      setValues(values) {
        values.forEach((line, rowOffset) => {
          line.forEach((value, columnOffset) => {
            followupRows[row - 1 + rowOffset][column - 1 + columnOffset] = value;
          });
        });
        return this;
      }
    };
  }
};
evaluate(`writeMakeFollowup(followupSheet, ${JSON.stringify(followupHeaders)}, 2, {
  telephone: '',
  nb_convives: '90',
  email_client: 'nouvelle@example.com',
  gmail_message_id: 'MESSAGE-SUIVI',
  relance_a_traiter: true
}, { updated: true })`);
assert.equal(followupRows[1][followupHeaders.indexOf('telephone')], '06 12 34 56 78');
assert.equal(followupRows[1][followupHeaders.indexOf('nb_convives')], '80');
assert.equal(followupRows[1][followupHeaders.indexOf('email_client')], 'ancienne@example.com');
assert.equal(followupRows[1][followupHeaders.indexOf('relance_a_traiter')], true);
const protectedWriteLog = JSON.parse(followupRows[1][followupHeaders.indexOf('make_operation_log')]);
assert.deepEqual(
  Array.from(protectedWriteLog['MESSAGE-SUIVI'].skipped_non_explicit_fields).sort(),
  ['email_client', 'nb_convives']
);
assert.deepEqual(
  JSON.parse(JSON.stringify(protectedWriteLog['MESSAGE-SUIVI'].skipped_non_explicit_changes.nb_convives)),
  { current: '80', proposed: '90' }
);

evaluate(`writeMakeFollowup(followupSheet, ${JSON.stringify(followupHeaders)}, 2, {
  nb_convives: '90',
  email_client: 'nouvelle@example.com',
  gmail_message_id: 'MESSAGE-CORRECTION'
}, { updated: true }, {
  explicit_changes: { nb_convives: true, email_client: false }
})`);
assert.equal(followupRows[1][followupHeaders.indexOf('nb_convives')], '90');
assert.equal(followupRows[1][followupHeaders.indexOf('email_client')], 'ancienne@example.com');
const explicitWriteLog = JSON.parse(followupRows[1][followupHeaders.indexOf('make_operation_log')]);
assert.deepEqual(
  JSON.parse(JSON.stringify(explicitWriteLog['MESSAGE-CORRECTION'].applied_business_changes.nb_convives)),
  { previous: '80', next: '90', reason: 'explicit_change' }
);

followupRows[1][followupHeaders.indexOf('telephone')] = '';
evaluate(`writeMakeFollowup(followupSheet, ${JSON.stringify(followupHeaders)}, 2, {
  telephone: '06 98 76 54 32',
  gmail_message_id: 'MESSAGE-ENRICHISSEMENT'
}, { updated: true })`);
assert.equal(followupRows[1][followupHeaders.indexOf('telephone')], '06 98 76 54 32');
assert.equal(evaluate('followupRequiresCalendarSync({ applied_business_fields: ["email_client"] })'), false);
assert.equal(evaluate('followupRequiresCalendarSync({ applied_business_fields: ["date_evenement"] })'), true);

context.threadFallbackOptions = {
  match: { email_client: 'cliente@example.com' },
  create_if_not_found: true,
  fallback_row: { id_demande: 'GMAIL-THREAD-SANS-FICHE' }
};
context.fallbackFields = { gmail_message_id: 'MESSAGE-SANS-FICHE' };
const delegatedThreadFollowup = evaluate(`(() => {
  const originals = {
    getSheet,
    ensureSchemaHeaders,
    findMakeOperationByMessageId,
    findRowByCanonicalValue,
    updateExistingDemandFollowup
  };
  try {
    getSheet = () => ({
      getLastColumn: () => 1,
      getRange: () => ({ getValues: () => [['gmail_thread_id']] })
    });
    ensureSchemaHeaders = () => {};
    findMakeOperationByMessageId = () => null;
    findRowByCanonicalValue = () => null;
    updateExistingDemandFollowup = (match, fields, options) => ok({
      updated: true,
      delegated: true,
      match,
      fallback_id: options.fallback_row.id_demande
    });
    return JSON.parse(updateThreadFollowup('THREAD-SANS-FICHE', fallbackFields, threadFallbackOptions).getContent()).data;
  } finally {
    Object.assign(globalThis, originals);
  }
})()`);
assert.equal(delegatedThreadFollowup.updated, true);
assert.equal(delegatedThreadFollowup.delegated, true);
assert.equal(delegatedThreadFollowup.match.email_client, 'cliente@example.com');
assert.equal(delegatedThreadFollowup.fallback_id, 'GMAIL-THREAD-SANS-FICHE');

context.wixFallbackOptions = {
  create_if_not_found: true,
  fallback_row: { id_demande: 'GMAIL-WIX-SANS-FICHE' }
};
const createdWixFallback = evaluate(`(() => {
  const originals = {
    getSheet,
    ensureSchemaHeaders,
    findMakeOperationByMessageId,
    findRowByCanonicalValue,
    findLatestRowByEmailAndIdPrefix,
    createUnmatchedFollowupDemand
  };
  try {
    getSheet = () => ({
      getLastColumn: () => 1,
      getRange: () => ({ getValues: () => [['gmail_thread_id']] })
    });
    ensureSchemaHeaders = () => {};
    findMakeOperationByMessageId = () => null;
    findRowByCanonicalValue = () => null;
    findLatestRowByEmailAndIdPrefix = () => null;
    createUnmatchedFollowupDemand = (row, fields) => ok({
      updated: true,
      created_from_unmatched_followup: true,
      id_demande: row.id_demande,
      gmail_message_id: fields.gmail_message_id
    });
    return JSON.parse(updateWixFollowup('THREAD-WIX', 'cliente@example.com', fallbackFields, wixFallbackOptions).getContent()).data;
  } finally {
    Object.assign(globalThis, originals);
  }
})()`);
assert.equal(createdWixFallback.updated, true);
assert.equal(createdWixFallback.created_from_unmatched_followup, true);
assert.equal(createdWixFallback.id_demande, 'GMAIL-WIX-SANS-FICHE');
assert.equal(createdWixFallback.gmail_message_id, 'MESSAGE-SANS-FICHE');

const forcedReview = evaluate(`(() => {
  const originals = {
    getSheet,
    ensureSchemaHeaders,
    findMakeOperationByMessageId,
    createUnmatchedFollowupDemand
  };
  try {
    getSheet = () => ({
      getLastColumn: () => 1,
      getRange: () => ({ getValues: () => [['id_demande']] })
    });
    ensureSchemaHeaders = () => {};
    findMakeOperationByMessageId = () => null;
    createUnmatchedFollowupDemand = (row, fields) => ok({
      updated: true,
      forced_review: true,
      id_demande: row.id_demande,
      gmail_message_id: fields.gmail_message_id
    });
    return JSON.parse(updateExistingDemandFollowup(
      { email_client: 'incertain@example.com' },
      { gmail_message_id: 'MESSAGE-INCERTAIN' },
      { force_review_card: true, fallback_row: { id_demande: 'GMAIL-INCERTAIN' } }
    ).getContent()).data;
  } finally {
    Object.assign(globalThis, originals);
  }
})()`);
assert.equal(forcedReview.forced_review, true);
assert.equal(forcedReview.id_demande, 'GMAIL-INCERTAIN');

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
assert.equal(mergeRows[1][mergeHeaders.indexOf('relance_a_traiter')], false);
assert.match(targetAfterMerge[mergeHeaders.indexOf('notes')], /Rattachement manuel depuis GMAIL-SOURCE/);
assert.match(mergeRows[1][mergeHeaders.indexOf('notes')], /Rattachée manuellement à MANUAL-TARGET/);

const targetNotesBeforeReplay = targetAfterMerge[mergeHeaders.indexOf('notes')];
const replayedMerge = evaluate('JSON.parse(mergeDemandRecords(mergeSourceId, mergeTargetId).getContent()).data');
assert.equal(replayedMerge.replayed, true);
assert.equal(targetAfterMerge[mergeHeaders.indexOf('notes')], targetNotesBeforeReplay);

// Fiches « À vérifier » : la date parasite « \ » transmise par Make est vide.
assert.equal(evaluate('normalizeEventDateText("\\\\")'), '');
assert.equal(evaluate('normalizeEventDateText("\\\\\\"\\\\\\"")'), '');
assert.equal(evaluate('normalizeEventDateText("null")'), '');
assert.equal(evaluate('sanitizeFields({ budget_estime: "\\\\" }, true).budget_estime'), '');
assert.equal(evaluate('sanitizeFields({ budget_estime: "?" }, true).budget_estime'), '?');
assert.equal(evaluate('sanitizeFields({ budget_estime: "20€ par personne" }, true).budget_estime'), '20€ par personne');
assert.equal(evaluate('normalizeEventDateText("25/10/2026")'), '25/10/2026');
assert.equal(evaluate('normalizeEventDateText("Inconnu / à compléter")'), 'Inconnu / à compléter');

// Expéditeurs automatiques jamais rattachés ni transformés en fiche.
assert.equal(evaluate('isTechnicalTransactionalEmail("ordersender-prod@ansmtp.ariba.com")'), true);
assert.equal(evaluate('isTechnicalTransactionalEmail("Facturation@Notif.Facture.net")'), true);
assert.equal(evaluate('isTechnicalTransactionalEmail("client@facture.net")'), false);
const excludedFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'ordersender-prod@ansmtp.ariba.com' },
  { gmail_message_id: 'MESSAGE-ARIBA' },
  { create_if_not_found: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-ARIBA' } }
).getContent()).data`);
assert.equal(excludedFollowup.updated, false);
assert.equal(excludedFollowup.excluded, true);
const excludedFallback = evaluate(`JSON.parse(createUnmatchedFollowupDemand(
  { id_demande: 'GMAIL-FACTURE', email_client: 'noreply@notif.facture.net' }, {}
).getContent()).data`);
assert.equal(excludedFallback.updated, false);
assert.equal(excludedFallback.excluded, true);

const reviewHeaders = [
  'id_demande', 'nom_client', 'email_client', 'telephone', 'type_evenement',
  'date_evenement', 'nb_convives', 'lieu_prestation', 'statut', 'canal', 'notes',
  'gmail_thread_id', 'gmail_message_id', 'url_email_origine', 'dernier_email_recu_le',
  'dernier_message_client', 'nb_relances_client', 'relance_a_traiter',
  'derniere_modification', 'make_operation_log'
];
function reviewRow(values) {
  return reviewHeaders.map(key => values[key] ?? '');
}
function reviewSheet(rows) {
  const all = [reviewHeaders, ...rows.map(reviewRow)];
  return {
    rows: all,
    getLastRow() { return all.length; },
    getLastColumn() { return reviewHeaders.length; },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      const values = () => all.slice(row - 1, row - 1 + rowCount).map(line => line.slice(column - 1, column - 1 + columnCount));
      return {
        getValues: values,
        getDisplayValues() { return values().map(line => line.map(value => String(value ?? ''))); },
        getValue() { return all[row - 1][column - 1]; },
        setValue(value) { all[row - 1][column - 1] = value; return this; },
        setValues(next) { next.forEach((line, i) => line.forEach((value, j) => { all[row - 1 + i][column - 1 + j] = value; })); return this; },
        setNumberFormat() { return this; }
      };
    }
  };
}
function cell(sheet, idDemande, key) {
  const line = sheet.rows.find(values => values[0] === idDemande);
  return line[reviewHeaders.indexOf(key)];
}
context.reviewCardCalls = [];
context.createUnmatchedFollowupDemand = (row) => {
  context.reviewCardCalls.push(row.id_demande);
  return context.ok({ updated: true, created_from_unmatched_followup: true, id_demande: row.id_demande });
};

// Flore : une première fiche de contrôle ne doit pas rendre le second message ambigu.
context.followupSheetFlore = reviewSheet([
  { id_demande: 'MANUAL-FLORE', nom_client: 'Flore De Régis', email_client: 'flore@example.com', type_evenement: 'Baptême', date_evenement: '25/10/2026', statut: 'Devis envoyé' },
  { id_demande: 'GMAIL-FLORE-1', nom_client: 'Flore De Régis', email_client: 'flore@example.com', date_evenement: '\\', statut: 'À vérifier', gmail_thread_id: 'THREAD-FLORE-2' }
]);
context.getSheet = () => context.followupSheetFlore;
const floreFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'flore@example.com', nom_client: 'Flore De Régis', date_evenement: '\\\\' },
  { gmail_message_id: 'MESSAGE-FLORE-3', dernier_message_client: 'Oui je finis à 15h' },
  { create_if_not_found: true, create_if_ambiguous: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-FLORE-3' } }
).getContent()).data`);
assert.equal(floreFollowup.updated, true);
assert.equal(floreFollowup.id_demande, 'MANUAL-FLORE');
assert.equal(cell(context.followupSheetFlore, 'MANUAL-FLORE', 'dernier_message_client'), 'Oui je finis à 15h');
assert.deepEqual(context.reviewCardCalls, []);

// Dubois : même fil et même email l'emportent sur une classification « incertain ».
context.followupSheetDubois = reviewSheet([
  { id_demande: 'GMAIL-THREAD-DUBOIS', nom_client: 'Stéphanie Dubois', email_client: 'dubois@example.com', statut: 'Nouvelle demande', gmail_thread_id: 'THREAD-DUBOIS' },
  { id_demande: 'GMAIL-MESSAGE-DUBOIS-1', nom_client: 'Stéphanie Dubois', email_client: 'dubois@example.com', statut: 'À vérifier', gmail_thread_id: 'THREAD-DUBOIS' }
]);
context.getSheet = () => context.followupSheetDubois;
const duboisFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'Dubois@example.com', nom_client: 'Stéphanie Dubois' },
  { gmail_thread_id: 'THREAD-DUBOIS', gmail_message_id: 'MESSAGE-DUBOIS-2', dernier_message_client: 'Merci' },
  { force_review_card: true, create_if_not_found: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-DUBOIS-2' } }
).getContent()).data`);
assert.equal(duboisFollowup.updated, true);
assert.equal(duboisFollowup.id_demande, 'GMAIL-THREAD-DUBOIS');
assert.equal(duboisFollowup.matched_by, 'gmail_thread_id_and_email_client');
assert.deepEqual(context.reviewCardCalls, []);

// Sans fil commun, « incertain » crée toujours une fiche de contrôle.
const uncertainWithoutThread = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'dubois@example.com' },
  { gmail_thread_id: 'AUTRE-FIL', gmail_message_id: 'MESSAGE-DUBOIS-3' },
  { force_review_card: true, create_if_not_found: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-DUBOIS-3' } }
).getContent()).data`);
assert.equal(uncertainWithoutThread.created_from_unmatched_followup, true);
assert.deepEqual(context.reviewCardCalls, ['GMAIL-MESSAGE-DUBOIS-3']);

// Le fil seul, avec une autre adresse, ne suffit jamais.
const otherSenderInThread = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'autre@example.com' },
  { gmail_thread_id: 'THREAD-DUBOIS', gmail_message_id: 'MESSAGE-AUTRE' },
  { force_review_card: true, create_if_not_found: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-AUTRE' } }
).getContent()).data`);
assert.equal(otherSenderInThread.created_from_unmatched_followup, true);
assert.equal(cell(context.followupSheetDubois, 'GMAIL-THREAD-DUBOIS', 'gmail_message_id'), 'MESSAGE-DUBOIS-2');

// Oummé : une fiche source déjà rattachée manuellement n'est plus candidate.
context.followupSheetOumme = reviewSheet([
  { id_demande: 'WIX-OUMME', nom_client: 'Oummé Abdourahamane', email_client: 'oumme@example.com', statut: 'Devis envoyé' },
  { id_demande: 'GMAIL-OUMME', nom_client: 'Oummé Abdourahamane', email_client: 'oumme@example.com', statut: 'Nouvelle demande', notes: 'Rattachée manuellement à WIX-OUMME. Cette fiche source est conservée.' }
]);
context.getSheet = () => context.followupSheetOumme;
const oummeFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'oumme@example.com' },
  { gmail_message_id: 'MESSAGE-OUMME-2' },
  { create_if_not_found: true, create_if_ambiguous: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-OUMME-2' } }
).getContent()).data`);
assert.equal(oummeFollowup.id_demande, 'WIX-OUMME');

// Aurore : une destination dont les notes ont recopié l'annotation d'une source reste candidate.
context.reviewSheetAurore = reviewSheet([
  { id_demande: 'WIX-AURORE', email_client: 'aurore@example.com', statut: 'Devis envoyé', notes: 'Rattachement manuel depuis GMAIL-AURORE (fiche source conservée).\nRattachée manuellement à MANUAL-AUTRE. Cette fiche source est conservée.' },
  { id_demande: 'GMAIL-AURORE', email_client: 'aurore@example.com', statut: 'À vérifier', notes: 'Rattachée manuellement à WIX-AURORE. Cette fiche source est conservée.' }
]);
context.getSheet = () => context.reviewSheetAurore;
const auroreFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'aurore@example.com' },
  { gmail_message_id: 'MESSAGE-AURORE-2' },
  { create_if_not_found: true, create_if_ambiguous: true, fallback_row: { id_demande: 'GMAIL-MESSAGE-AURORE-2' } }
).getContent()).data`);
assert.equal(auroreFollowup.id_demande, 'WIX-AURORE');

// Deux vraies demandes actives avec le même email restent ambiguës.
context.followupSheetAmbiguous = reviewSheet([
  { id_demande: 'WIX-A', email_client: 'double@example.com', statut: 'Devis envoyé' },
  { id_demande: 'WIX-B', email_client: 'double@example.com', statut: 'Nouvelle demande' }
]);
context.getSheet = () => context.followupSheetAmbiguous;
const ambiguousFollowup = evaluate(`JSON.parse(updateExistingDemandFollowup(
  { email_client: 'double@example.com' },
  { gmail_message_id: 'MESSAGE-DOUBLE' },
  {}
).getContent()).data`);
assert.equal(ambiguousFollowup.reason, 'existing_demand_ambiguous');

// Relance dans un fil connu : la vraie demande passe avant la fiche de contrôle du même fil.
context.followupSheetThread = reviewSheet([
  { id_demande: 'GMAIL-THREAD-RATOU', email_client: 'ratou@example.com', statut: 'Devis envoyé', gmail_thread_id: 'THREAD-RATOU' },
  { id_demande: 'GMAIL-MESSAGE-RATOU-1', email_client: 'ratou@example.com', statut: 'À vérifier', gmail_thread_id: 'THREAD-RATOU' }
]);
context.getSheet = () => context.followupSheetThread;
const threadFollowup = evaluate(`JSON.parse(updateThreadFollowup('THREAD-RATOU',
  { gmail_message_id: 'MESSAGE-RATOU-2', dernier_message_client: 'Bonjour' },
  { match: { email_client: 'ratou@example.com' }, create_if_not_found: true, fallback_row: { id_demande: 'GMAIL-THREAD-RATOU' } }
).getContent()).data`);
assert.equal(threadFollowup.id_demande, 'GMAIL-THREAD-RATOU');
const threadMismatch = evaluate(`JSON.parse(updateThreadFollowup('THREAD-RATOU',
  { gmail_message_id: 'MESSAGE-INTRUS' },
  { match: { email_client: 'intrus@example.com' } }
).getContent()).data`);
assert.equal(threadMismatch.reason, 'source_email_mismatch');

// Un rattachement ne recopie pas l'annotation « Rattachée manuellement à » de la source.
const chainRows = [
  mergeHeaders,
  ['GMAIL-CHAIN', 'Aurore', 'aurore@example.com', '', '03/07/2027', '', 'À vérifier', 'Fiche de contrôle\nRattachée manuellement à MANUAL-AUTRE. Cette fiche source est conservée.', 'Message', 'T1', 'M1', '', '', 'Message', 1, false, ''],
  ['WIX-CHAIN', 'Aurore', 'aurore@example.com', '', '03/07/2027', '', 'Devis envoyé', '', 'Demande', '', '', '', '', '', 0, false, '']
];
context.getSheet = () => ({
  getLastRow() { return chainRows.length; },
  getLastColumn() { return mergeHeaders.length; },
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const values = () => chainRows.slice(row - 1, row - 1 + rowCount).map(line => line.slice(column - 1, column - 1 + columnCount));
    return {
      getValues: values,
      getDisplayValues() { return values().map(line => line.map(value => String(value ?? ''))); },
      getValue() { return chainRows[row - 1][column - 1]; },
      setValue(value) { chainRows[row - 1][column - 1] = value; return this; },
      setNumberFormat() { return this; }
    };
  }
});
evaluate('mergeDemandRecords("GMAIL-CHAIN", "WIX-CHAIN")');
const chainTargetNotes = chainRows[2][mergeHeaders.indexOf('notes')];
assert.match(chainTargetNotes, /Rattachement manuel depuis GMAIL-CHAIN/);
assert.match(chainTargetNotes, /Fiche de contrôle/);
assert.doesNotMatch(chainTargetNotes, /Rattachée manuellement à MANUAL-AUTRE/);
assert.equal(evaluate(`isMergedSourceNotes(${JSON.stringify(chainRows[1][mergeHeaders.indexOf('notes')])})`), true);
assert.equal(evaluate(`isMergedSourceNotes(${JSON.stringify(chainTargetNotes)})`), false);

console.log('Tests de rapprochement réussis.');
