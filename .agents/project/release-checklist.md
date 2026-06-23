# Checklist de validation et publication

## Avant commit

- Lire `git status --short`.
- Vérifier le diff des fichiers modifiés.
- Lancer les contrôles pertinents :
  - `node --check app.js`
  - `node --check sw.js`
  - `cp backend/code.gs /tmp/code.gs.js && node --check /tmp/code.gs.js`
  - `python3 -m json.tool "make-blueprints/<fichier>.blueprint.json" >/tmp/blueprint.json`
  - `git diff --check`
- Ne pas inclure de fichiers temporaires, captures, secrets ou changements non liés.

## Commit et push

- Committer avec un message court et concret.
- Pousser la branche courante après commit si autorisé.
- Si le push est bloqué par permissions ou politique, le dire clairement et donner le hash du commit local.

## Après push

- Frontend GitHub Pages : les fichiers statiques sont en ligne après publication GitHub Pages.
- Apps Script : les changements `backend/code.gs` ne sont pas actifs tant que le script n'est pas redéployé.
- Make : les changements de blueprint ne sont pas actifs tant que le scénario n'est pas réimporté ou modifié dans Make.
- Données existantes : une correction de logique n'efface pas les anciennes lignes polluées ; prévoir une correction manuelle ou scriptée.
