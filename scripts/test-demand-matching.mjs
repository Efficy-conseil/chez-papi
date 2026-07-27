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
    assert.equal(column, 1);
    assert.equal(rowCount, rows.length);
    assert.equal(columnCount, headers.length);
    return {
      getValues() {
        return rows;
      },
      getDisplayValues() {
        return rows.map(values => values.map(String));
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

context.weakIncoming = {
  nom_client: 'Delphine',
  type_evenement: 'Autres'
};
const weakCandidates = evaluate(
  'findDemandMatchCandidates(testSheet, testHeaders, weakIncoming, { mode: "manual" })'
);
assert.equal(weakCandidates.length, 0);

console.log('Tests de rapprochement réussis.');
