import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildIndex, search } = require('../chez-papi/search.js');
const rows = [
  { id_demande: 'WIX-abc123', nom_client: 'Élodie Dupont', lieu_prestation: '12 rue de la République, Lyon', telephone: '06 12 34 56 78', email_client: 'elodie@example.fr', type_evenement: 'Mariage', statut: 'Événement terminé', date_evenement: '12/09/2024', date_reception: '2024-02-03T10:30:00Z', notes: 'Buffet végétarien', message_original: 'Accueil dans la cour', dernier_message_client: 'Prévoir des parasols', nb_convives: 80, budget_estime: 2500 },
  { id_demande: 'MAN-2', nom_client: 'Martin', lieu_prestation: 'Nantes', type_evenement: 'Mariage', statut: 'Refusé / Complet', date_evenement: '12/09/2026 au 14/09/2026', telephone: '+33 6 98 76 54 32' },
  { id_demande: 'MAN-3', nom_client: 'Durand', date_evenement: '02/09/2026', date_reception: '12/08/2025' },
  { id_demande: 'MAN-4', nom_client: '<img src=x onerror=alert(1)>', date_evenement: '2027', make_operation_log: 'secret-interne' },
  { id_demande: 'MAN-5', nom_client: 'Sans date', date_evenement: 'Inconnu / à compléter' }
];
const index = buildIndex(rows);
const ids = query => search(index, query).map(result => result.row.id_demande);
assert.deepEqual(ids('elodie LYON'), ['WIX-abc123']);
assert.deepEqual(ids('republi'), ['WIX-abc123']);
assert.deepEqual(ids('mariage septembre 2026'), ['MAN-2']);
assert.deepEqual(ids('12 septembre'), ['WIX-abc123', 'MAN-2']);
assert.deepEqual(ids('12/09/2026'), ['MAN-2']);
assert.deepEqual(ids('12-09-2026'), ['MAN-2']);
assert.deepEqual(ids('2026-09-12'), ['MAN-2']);
assert.deepEqual(ids('12/09'), ['WIX-abc123', 'MAN-2']);
assert.deepEqual(ids('14 septembre 2026'), ['MAN-2']);
assert.deepEqual(ids('02 septembre 2026'), ['MAN-3']);
assert.deepEqual(ids('12 septembre 2025'), []); // Cannot mix reception day/year with event month.
assert.deepEqual(ids('3 fevrier 2024'), ['WIX-abc123']);
assert.deepEqual(ids('0612345678'), ['WIX-abc123']);
assert.deepEqual(ids('06.12.34.56.78'), ['WIX-abc123']);
assert.deepEqual(ids('06 12 34 56 78'), ['WIX-abc123']);
assert.deepEqual(ids('+33 6 12 34 56 78'), ['WIX-abc123']);
assert.deepEqual(ids('0698765432'), ['MAN-2']);
for (const query of ['elodie@example.fr', 'vegetarien', 'cour', 'parasols', 'abc123', '80', '2500', 'termine']) assert.deepEqual(ids(query), ['WIX-abc123']);
assert.deepEqual(ids('refuse'), ['MAN-2']);
assert.deepEqual(ids('2027'), ['MAN-4']);
assert.deepEqual(ids('janvier 2027'), []);
assert.deepEqual(ids('secret-interne'), []);
assert.deepEqual(ids('introuvable'), []);
assert.deepEqual(ids('   '), []);
assert.deepEqual(ids('...'), []);
assert.match(search(index, 'parasols')[0].excerpt, /Dernier message : Prévoir des parasols/);
const changed = buildIndex([{ ...rows[0], nom_client: 'Nouveau nom' }]);
assert.equal(search(changed, 'dupont').length, 0);
assert.equal(search(changed, 'nouveau nom').length, 1);
assert.equal(search(buildIndex(Array.from({ length: 25 }, (_, i) => ({ nom_client: `Client ${i}` }))), 'client').length, 25);
console.log('Tests recherche globale réussis.');
