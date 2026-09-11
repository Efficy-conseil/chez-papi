(function initSearch(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChezPapiSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSearchApi() {
  'use strict';

  const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const FIELDS = {
    nom_client: 'Client', lieu_prestation: 'Lieu', telephone: 'Téléphone',
    email_client: 'Email', date_evenement: 'Événement', date_reception: 'Réception',
    type_evenement: 'Type', statut: 'Statut', canal: 'Canal', id_demande: 'Référence',
    heure_evenement: 'Heure', nb_convives: 'Convives', budget_estime: 'Budget',
    notes: 'Notes', message_original: 'Message', dernier_message_client: 'Dernier message',
    dernier_email_recu_le: 'Dernier échange', derniere_modification: 'Modification'
  };
  const DATE_FIELDS = new Set(['date_evenement', 'date_reception', 'dernier_email_recu_le', 'derniere_modification']);

  function fold(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }

  function normalize(value) {
    return fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function dateWords(day, month, year = '') {
    const name = MONTHS[Number(month) - 1];
    if (!name || Number(day) < 1 || Number(day) > 31) return `${day}/${month}/${year}`;
    return `${Number(day)} ${name}${year ? ` ${year.length === 2 ? '20' : ''}${year}` : ''}`;
  }

  function expandDates(value) {
    return fold(value)
      .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?/gi, (_, year, month, day) => dateWords(day, month, year))
      .replace(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?\b/g, (_, day, month, year) => dateWords(day, month, year))
      .replace(new RegExp(`\\b0?(\\d{1,2})(?:er)?\\s+(${MONTHS.join('|')})\\b`, 'g'), (_, day, month) => `${Number(day)} ${month}`);
  }

  function termsFor(query) {
    // Keep dates together: the day, month and year must describe the same date.
    const expanded = expandDates(String(query).replace(/\+?\d(?:[ .()-]*\d){8,}/g, phone => phone.replace(/\D/g, '')));
    const pattern = new RegExp(`\\b(?:\\d{1,2}\\s+)?(?:${MONTHS.join('|')})(?:\\s+\\d{4})?\\b|\\+?\\d(?:[ .()-]*\\d){5,}|[a-z0-9]+`, 'g');
    return (expanded.match(pattern) || []).map(value => {
      const date = MONTHS.some(month => value.includes(month));
      const phone = !date && /\d(?:[ .()-]*\d){5,}/.test(value);
      return { text: phone ? value.replace(/\D/g, '') : normalize(value), date };
    });
  }

  function buildIndex(rows, formatDate = value => value) {
    return rows.map(row => ({
      row,
      fields: Object.entries(FIELDS).flatMap(([key, label]) => {
        const raw = row[key];
        if (raw === null || raw === undefined || raw === '') return [];
        const value = String(DATE_FIELDS.has(key) ? formatDate(raw) : raw);
        const aliases = [normalize(value), normalize(expandDates(value))];
        if (key === 'telephone') {
          const digits = String(raw).replace(/\D/g, '');
          aliases.push(digits);
          if (digits.startsWith('33')) aliases.push('0' + digits.slice(2));
          if (digits.startsWith('0')) aliases.push('33' + digits.slice(1));
        }
        return [{ key, label, value, aliases }];
      })
    }));
  }

  function matches(field, term) {
    return field.aliases.some(alias => term.date
      ? ` ${alias} `.includes(` ${term.text} `)
      : alias.includes(term.text));
  }

  function excerpt(field, terms) {
    const text = field.value.replace(/\s+/g, ' ').trim();
    const normalized = normalize(text);
    const positions = terms.map(term => normalized.indexOf(term.text)).filter(pos => pos >= 0);
    const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 45);
    return `${field.label} : ${start ? '…' : ''}${text.slice(start, start + 170)}${text.length > start + 170 ? '…' : ''}`;
  }

  function search(index, query) {
    const terms = termsFor(query);
    if (!terms.length) return [];
    return index.flatMap(entry => {
      if (!terms.every(term => entry.fields.some(field => matches(field, term)))) return [];
      const matching = entry.fields.filter(field => terms.some(term => matches(field, term)));
      const score = matching.reduce((sum, field) => sum + (['nom_client', 'id_demande', 'telephone', 'email_client'].includes(field.key) ? 3 : 1), 0);
      return [{ row: entry.row, score, excerpt: matching.slice(0, 3).map(field => excerpt(field, terms)).join(' · ') }];
    }).sort((a, b) => b.score - a.score);
  }

  return { buildIndex, search };
});
