---
name: deploy-chez-papi-backend
description: Vérifier, publier, versionner et redéployer le backend Google Apps Script de production Chez Papi sans changer son URL. Utiliser après toute modification de `apps-script/`, lorsqu'un correctif backend doit être mis en ligne, ou lorsqu'un utilisateur demande de redéployer ou vérifier le déploiement backend.
---

# Déployer le backend Chez Papi

## Procédure

1. Lire `docs/product-contract.md` et `docs/deployment.md`.
2. Vérifier que `.clasp.json` cible le projet attendu et que `scripts/deploy-apps-script.mjs` contient l'identifiant du déploiement de production attendu.
3. Exécuter `npm run check`.
4. Après validation et commit des changements, exécuter :

```bash
npm run deploy:backend -- "Résumé précis de la modification"
```

5. Vérifier que la commande confirme une nouvelle version et que cette version est active sur le déploiement existant.
6. Signaler dans le compte rendu la version Apps Script publiée. En cas d'échec, ne jamais annoncer que le backend est à jour.

## Règles

- Redéployer automatiquement dans la même intervention après toute modification validée de `apps-script/`, sauf demande explicite de ne pas déployer.
- Toujours utiliser `npm run deploy:backend`; ne pas enchaîner manuellement des commandes `clasp` ordinaires.
- Mettre à jour le déploiement existant. Ne jamais créer une nouvelle Web App et ne jamais changer l'URL consommée par le frontend ou Make.
- Ne pas déployer si les contrôles échouent ou si des changements backend non liés et non compris sont présents.
- Le déploiement nécessite une session `clasp` authentifiée et un accès réseau. Demander l'autorisation d'exécution nécessaire si l'environnement l'impose.
- Une modification uniquement frontend ne déclenche pas de redéploiement backend.
