# Architecture Chez Papi

## Surfaces

- `index.html`, `styles.css`, `app.js` : PWA statique publiée via GitHub Pages.
- `sw.js`, `manifest.json`, icônes : installation PWA, cache, notifications et mise à jour.
- `backend/code.gs` : backend Google Apps Script exposé en Web App, lecture/écriture du Google Sheet, validation des champs, suivi des relances, synchronisation Calendar.
- `make-blueprints/*.blueprint.json` : scénarios Make pour Tally/Wix/Gmail/Voxist vers Google Sheets et Apps Script.
- `v2/` et `draft/` : prototypes ou variantes. Ne pas les modifier pour une demande production sans instruction explicite.

## Flux principal

1. Un prospect arrive par email, Wix, Tally ou Voxist.
2. Make qualifie la demande, extrait les champs, évite les doublons et écrit dans le Google Sheet ou appelle Apps Script pour mettre à jour une demande existante.
3. La PWA charge les lignes via Apps Script, normalise les statuts/canaux, déduplique et affiche les vues.
4. Les modifications faites dans la PWA passent par Apps Script, qui valide et écrit uniquement les champs autorisés.

## Principes d'architecture

- La source de vérité opérationnelle reste le Google Sheet.
- `id_demande` identifie une demande métier. Ne pas créer un nouvel ID pour une relance ou une modification de devis existant.
- `gmail_thread_id` et `gmail_message_id` sont des indices techniques, pas toujours des clés métier fiables.
- Le frontend ne doit pas corriger silencieusement une erreur amont critique. Corriger la source Make/Apps Script quand le problème est une ingestion.
- Apps Script doit rester tolérant aux anciens en-têtes de colonnes via `KEY_MAP`, mais strict sur les statuts, canaux et URLs.

## Décisions préférées

- Pour un bug d'affichage : corriger `app.js`/`styles.css`, puis vérifier les vues concernées.
- Pour un doublon ou statut incohérent : inspecter d'abord Make et Apps Script, puis seulement le dédoublonnage frontend.
- Pour une nouvelle donnée persistée : ajouter le champ dans `ALLOWED_FIELDS`, `SCHEMA_HEADERS` si nécessaire, la lecture/écriture Apps Script, puis l'affichage.
- Pour une automatisation email : mettre la règle métier dans le prompt Make et une protection déterministe côté Apps Script quand l'impact métier est fort.
