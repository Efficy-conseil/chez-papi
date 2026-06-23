# Chez Papi - Instructions Codex

## Objectif

Ce dépôt sert le dashboard Chez Papi : une PWA statique GitHub Pages, un backend Google Apps Script, et des blueprints Make pour transformer les demandes clients en lignes Google Sheets.

## Références projet

- Architecture et responsabilités : `.agents/project/architecture.md`
- Contrat de données Google Sheets : `.agents/project/data-contract.md`
- Règles Make et qualification email : `.agents/project/make-email-rules.md`
- Guidelines UX/UI : `.agents/project/ux-guidelines.md`
- Checklist de validation et publication : `.agents/project/release-checklist.md`

## Skills repo

Utiliser les skills locaux dans `.agents/skills` quand la tâche correspond :

- `chez-papi-senior-developer` : modification de code, correction de bug, refactor ciblé, tests.
- `chez-papi-architecture` : choix d'architecture, flux Make/Sheets/Apps Script, dette technique.
- `chez-papi-ux-design` : layout, styles, responsive, lisibilité, cohérence visuelle.
- `chez-papi-ergonomics` : workflows, tableaux, filtres, statuts, navigation, efficacité métier.
- `chez-papi-email-automation` : classification email, doublons, relances, blueprints Make, Apps Script de suivi.

## Conventions de travail

- Lire le code existant avant de modifier. Privilégier les patterns déjà en place.
- Garder les changements ciblés. Éviter les refontes non demandées.
- Ne jamais exposer de secret Apps Script, Gmail, Make ou Google.
- Ne pas committer `.clasp.json`, `.clasprc.json`, exports temporaires, caches, captures ou fichiers personnels.
- Après toute modification validée, faire un commit puis un push sur la branche courante, sauf demande explicite contraire ou blocage technique.
- Avant de commit, vérifier `git status`, les diffs, et ne pas inclure de changements sans rapport.
- Après le push, préciser ce qui est réellement en ligne. Distinguer le frontend GitHub Pages des éléments qui nécessitent une action séparée : déploiement Apps Script, réimportation Make, configuration Gmail/Sheets.

## Vérifications minimales

- Frontend JS : `node --check app.js`
- Service worker : `node --check sw.js`
- Backend Apps Script : copier en `.js` temporaire puis `node --check`
- Blueprints Make : `python3 -m json.tool <blueprint> >/tmp/blueprint.json`
- Toujours lancer `git diff --check` avant commit.

## Review Guidelines

- Priorité aux bugs métier : statut incohérent, doublon, demande perdue, mauvaise classification email, date tronquée, action impossible sur mobile.
- Vérifier les régressions UX sur les tableaux : Date, Client, Statut et Contact doivent rester accessibles.
- Vérifier que les changements Make/Apps Script préservent l'idempotence et ne créent pas de lignes en double.
- Vérifier que les liens Gmail/Drive restent filtrés par `safeUrl`.
