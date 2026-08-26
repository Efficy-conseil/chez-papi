import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { summarize, filterByReceiptDate, normalizeChannel } = require('../chez-papi/statistics.js');

function rows(channel, counts) {
  const statuses = [
    ['open', 'Devis envoyé'],
    ['won', 'Événement confirmé'],
    ['lost', 'Perdu / Sans suite'],
    ['rejected', 'Refusé / Complet']
  ];
  return statuses.flatMap(([key, status]) =>
    Array.from({ length: counts[key] || 0 }, () => ({ canal: channel, statut: status }))
  );
}

const currentDataset = [
  ...rows('Site Internet', { open: 13, won: 4, rejected: 4 }),
  ...rows('Email', { open: 5, won: 6, lost: 4, rejected: 1 }),
  ...rows('Saisie manuelle', { open: 9, won: 5 }),
  ...rows('Téléphone', { open: 9, won: 2, lost: 2, rejected: 1 }),
  ...rows('Réseaux sociaux', { open: 3, lost: 3, rejected: 1 }),
  ...rows('Téléphone + Email', { won: 1 })
];

const summary = summarize(currentDataset);
assert.deepEqual(
  {
    total: summary.total.total,
    open: summary.total.open,
    won: summary.total.won,
    lost: summary.total.lost,
    rejected: summary.total.rejected
  },
  { total: 73, open: 39, won: 18, lost: 9, rejected: 7 }
);
assert.equal(Math.round(summary.total.conversionRate * 100), 67);
assert.equal(Math.round(summary.total.rejectionRate * 100), 10);
assert.equal(normalizeChannel('Téléphone + Email'), 'Téléphone');

const telephone = summary.byChannel.find(row => row.channel === 'Téléphone');
assert.deepEqual(
  {
    total: telephone.total,
    open: telephone.open,
    won: telephone.won,
    lost: telephone.lost,
    rejected: telephone.rejected
  },
  { total: 15, open: 9, won: 3, lost: 2, rejected: 1 }
);
assert.equal(summary.byChannel.length, 5);

const undecided = summarize([{ canal: 'Email', statut: 'Devis envoyé' }]);
assert.equal(undecided.total.conversionRate, null);

const datedRows = [
  { date_reception: '2026-06-15' },
  { date_reception: '2026-08-01T10:30:00.000Z' },
  { date_reception: '2027-01-10' },
  { date_reception: '' }
];
const parseDate = value => value ? new Date(value) : null;
assert.equal(filterByReceiptDate(datedRows, { mode: 'all' }, parseDate).length, 4);
assert.equal(filterByReceiptDate(datedRows, { mode: 'year', year: 2026 }, parseDate).length, 2);
assert.equal(filterByReceiptDate(datedRows, { mode: 'quarter', year: 2026, quarter: 3 }, parseDate).length, 1);
assert.equal(filterByReceiptDate(datedRows, { mode: 'range', from: '2026-07-01', to: '2026-12-31' }, parseDate).length, 1);

console.log('Tests statistiques réussis.');
