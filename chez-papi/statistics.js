(function initChezPapiStatistics(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChezPapiStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStatisticsApi() {
  'use strict';

  const WON_STATUSES = new Set(['Événement confirmé', 'Événement terminé']);
  const LOST_STATUS = 'Perdu / Sans suite';
  const REJECTED_STATUS = 'Refusé / Complet';
  const CHANNEL_ORDER = ['Site Internet', 'Email', 'Téléphone', 'Saisie manuelle', 'Réseaux sociaux'];

  function normalizeChannel(value) {
    const raw = String(value || '').trim();
    const lower = raw.toLocaleLowerCase('fr');
    if (lower === 'téléphone + email' || lower === 'telephone + email') return 'Téléphone';
    if (lower === 'email direct' || lower === 'email') return 'Email';
    if (['formulaire site', 'site web', 'site internet', 'wix'].includes(lower)) return 'Site Internet';
    if (['voxist', 'telephone', 'téléphone'].includes(lower)) return 'Téléphone';
    if (['réseaux sociaux', 'reseaux sociaux', 'réseau social', 'reseau social'].includes(lower)) return 'Réseaux sociaux';
    if (['saisie manuelle', 'manuel', 'manual'].includes(lower)) return 'Saisie manuelle';
    return raw || 'Non renseigné';
  }

  function classifyStatus(status) {
    if (WON_STATUSES.has(status)) return 'won';
    if (status === LOST_STATUS) return 'lost';
    if (status === REJECTED_STATUS) return 'rejected';
    return 'open';
  }

  function emptyMetrics() {
    return { total: 0, open: 0, won: 0, lost: 0, rejected: 0 };
  }

  function addRow(metrics, row) {
    metrics.total++;
    metrics[classifyStatus(row?.statut)]++;
  }

  function finalizeMetrics(metrics) {
    const commerciallyDecided = metrics.won + metrics.lost;
    return {
      ...metrics,
      commerciallyDecided,
      conversionRate: commerciallyDecided > 0 ? metrics.won / commerciallyDecided : null,
      rejectionRate: metrics.total > 0 ? metrics.rejected / metrics.total : null,
      openRate: metrics.total > 0 ? metrics.open / metrics.total : null
    };
  }

  function summarize(rows) {
    const total = emptyMetrics();
    const channels = new Map();

    (rows || []).forEach(row => {
      const channel = normalizeChannel(row?.canal);
      if (!channels.has(channel)) channels.set(channel, emptyMetrics());
      addRow(total, row);
      addRow(channels.get(channel), row);
    });

    const byChannel = [...channels.entries()]
      .map(([channel, metrics]) => ({ channel, ...finalizeMetrics(metrics) }))
      .sort((a, b) => {
        const orderA = CHANNEL_ORDER.indexOf(a.channel);
        const orderB = CHANNEL_ORDER.indexOf(b.channel);
        if (orderA >= 0 && orderB >= 0) return orderA - orderB;
        if (orderA >= 0) return -1;
        if (orderB >= 0) return 1;
        return b.total - a.total;
      });

    return { total: finalizeMetrics(total), byChannel };
  }

  function filterByReceiptDate(rows, filter, parseDate) {
    if (!filter || filter.mode === 'all') return [...(rows || [])];

    return (rows || []).filter(row => {
      const date = parseDate(row?.date_reception);
      if (!date) return false;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      if (filter.mode === 'year') return year === Number(filter.year);
      if (filter.mode === 'quarter') {
        const quarter = Math.floor((month - 1) / 3) + 1;
        return year === Number(filter.year) && quarter === Number(filter.quarter);
      }
      if (filter.mode === 'range') {
        const time = new Date(year, date.getMonth(), date.getDate()).getTime();
        const from = filter.from ? parseDate(filter.from)?.getTime() : null;
        const to = filter.to ? parseDate(filter.to)?.getTime() : null;
        return (from === null || time >= from) && (to === null || time <= to);
      }
      return true;
    });
  }

  return {
    CHANNEL_ORDER,
    normalizeChannel,
    classifyStatus,
    summarize,
    filterByReceiptDate
  };
});
