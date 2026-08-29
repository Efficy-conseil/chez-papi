import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  Logger: { log() {} }
});
vm.runInContext(readFileSync('apps-script/code.gs', 'utf8'), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

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

assert.equal(evaluate('isExplicitSignedQuoteFollowup("En pj le devis signé.")'), true);
assert.equal(evaluate('isExplicitSignedQuoteFollowup("Merci pour votre retour.")'), false);

const rossellaRows = [
  ['VOXIST-ROSSELLA', 'Rossella', '06 20 00 52 66', '', 'Autres', '05/09/2026', 'beaucoup plus de personnes que prévu', '', 'Événement confirmé', 'Téléphone', ''],
  ['EMAIL-OTHER', 'Autre client', '', 'client@example.com', 'Entreprise', '03/09/2026', '190', '', 'Événement confirmé', 'Email', '']
];
context.rossellaSheet = {
  getLastRow() { return rossellaRows.length + 1; },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, rossellaRows.length);
    const selected = rossellaRows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return { getValues() { return selected; }, getDisplayValues() { return selected.map(values => values.map(String)); } };
  }
};
const imminentConfirmedMatches = evaluate(
  'findImminentConfirmedRowsWithoutEmail(rossellaSheet, testHeaders, "2026-08-28T14:45:01.000Z", 14)'
);
assert.deepEqual(Array.from(imminentConfirmedMatches, candidate => candidate.id_demande), ['VOXIST-ROSSELLA']);

const ambiguousRows = rossellaRows.concat([
  ['VOXIST-AMBIGUOUS', 'Autre appelante', '06 00 00 00 01', '', 'Autres', '07/09/2026', '', '', 'Événement confirmé', 'Téléphone', '']
]);
context.ambiguousSheet = {
  getLastRow() { return ambiguousRows.length + 1; },
  getRange(row, column, rowCount, columnCount) {
    assert.equal(row, 2);
    assert.equal(rowCount, ambiguousRows.length);
    const selected = ambiguousRows.map(values => values.slice(column - 1, column - 1 + columnCount));
    return { getValues() { return selected; }, getDisplayValues() { return selected.map(values => values.map(String)); } };
  }
};
assert.equal(
  evaluate('findImminentConfirmedRowsWithoutEmail(ambiguousSheet, testHeaders, "2026-08-28T14:45:01.000Z", 14).length'),
  2
);

console.log('Tests de rapprochement réussis.');
