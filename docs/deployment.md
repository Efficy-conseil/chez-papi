# Procédure de déploiement

## Contrôles préalables

1. Lire `docs/product-contract.md`.
2. Vérifier les changements avec `git diff`.
3. Exécuter `npm run check`.
4. Pour Make, conserver l'export fonctionnel précédent avant tout import.

## Backend Apps Script

Première utilisation sur un poste :

```bash
npm install
npx clasp login
```

Redéploiement courant :

```bash
npm run deploy:backend -- "Résumé de la modification"
```

La commande vérifie les fichiers, pousse explicitement le code local avec `clasp push --force`, crée une version Apps Script puis met à jour le déploiement existant. L'URL utilisée par les frontends et Make reste identique. Le push forcé évite qu'un cache local `clasp` obsolète produise une nouvelle version sans inclure les sources modifiées.

Règle projet : toute modification validée de `apps-script/` déclenche ce redéploiement dans la même intervention, sauf demande explicite de ne pas déployer. La procédure détaillée pour les agents se trouve dans `skills/deploy-chez-papi-backend/SKILL.md`.

## Frontend GitHub Pages

Après validation et push sur `main`, GitHub Actions publie automatiquement le contenu de `chez-papi/`.

Le frontend principal est servi à la racine du site. Les démonstrations se trouvent sous :

- `prototypes/v2/`
- `prototypes/ihm-ng/`
- `prototypes/relances/`

## Make

Les blueprints présents dans `make/` sont importés manuellement. Avant activation :

1. exporter le scénario Make fonctionnel ;
2. importer le nouveau blueprint sans écraser la sauvegarde ;
3. contrôler les connexions, les redirections HTTP et les filtres ;
4. rejouer les cas de non-régression du contrat produit ;
5. activer seulement après validation.
