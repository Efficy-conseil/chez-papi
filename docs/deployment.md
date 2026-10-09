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

Après l'ajout ou la modification de l'accès aux messages vocaux Gmail :

1. ouvrir l'éditeur Apps Script avec le compte `demande.chezpapimaisongourmande@gmail.com` ;
2. exécuter `authorizeVoicemailGmailAccess` ;
3. accepter le scope Gmail demandé, puis vérifier que la fonction retourne cette même adresse ;
4. ne jamais valider le fonctionnement avec un compte Gmail personnel : le backend le refusera explicitement.

Le manifeste active le service avancé Gmail et le scope `https://www.googleapis.com/auth/gmail.modify`. Cette autorisation permet de lister les messages OVH, charger leur pièce jointe audio et retirer uniquement le libellé système `UNREAD` sur action explicite (vocal `Marquer comme lu`, ou e-mails `Historique_Email` d'une demande lors de `Marquer comme traité`).

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
