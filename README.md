# Chez Papi

Tableau de bord GitHub Pages, backend Google Apps Script et automatisations Make pour le suivi des demandes traiteur.

## Organisation

- `chez-papi/` : frontend publié par GitHub Pages.
- `chez-papi/prototypes/` : prototypes accessibles en ligne pour les démonstrations.
- `apps-script/` : backend Google Apps Script.
- `make/` : blueprints Make à importer manuellement.
- `docs/` : contrat produit, procédures et spécifications fonctionnelles.

Les trois frontends de démonstration utilisent actuellement la même URL backend Apps Script que le frontend principal.

## Installation locale

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

## Vérifications

```bash
npm run check
```

Cette commande vérifie le backend, le frontend principal et les deux blueprints Make.

## Déploiement du backend Apps Script

La configuration locale `.clasp.json` associe `apps-script/` au projet Apps Script de production. Elle n'est pas versionnée.

Lors de la première utilisation uniquement :

```bash
npx clasp login
```

Pour vérifier, envoyer, versionner et redéployer le backend sans changer l'URL de la Web App :

```bash
npm run deploy:backend -- "Description du déploiement"
```

Le dépôt reste la source de vérité. Ne pas modifier directement le code dans l'éditeur Apps Script après la mise en place de ce flux.

La compétence projet `skills/deploy-chez-papi-backend/SKILL.md` rend ce redéploiement systématique après toute modification du backend, sauf demande explicite contraire.

## Déploiement du frontend

Le workflow `.github/workflows/deploy-pages.yml` publie uniquement `chez-papi/` après chaque push sur `main` qui touche ce répertoire.

Dans les paramètres GitHub du dépôt, la source de GitHub Pages doit être réglée une seule fois sur **GitHub Actions**.

## Blueprints Make

Les fichiers contenus dans `make/` conservent leurs noms attendus par Make. Leur import reste manuel afin de permettre le contrôle visuel et le retour arrière avant activation.

Voir [la procédure de déploiement](docs/deployment.md), [le contrat produit](docs/product-contract.md), [la spécification fonctionnelle du frontend](docs/frontend-functional-spec.md), [l'inventaire des filtres Gmail](docs/gmail-filters.md), [la matrice de tests Make](docs/make-regression-matrix.md) et [l'audit des blueprints](docs/make-audit.md).
