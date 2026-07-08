# Audit des blueprints Make

Date de l'audit : 02/07/2026.

Références : `docs/product-contract.md` et `docs/make-regression-matrix.md`.

## Corrections intégrées

- Réparation du JSON envoyé par le module `60` à `checkDuplicate`.
- Conservation des identifiants source : `WIX-<messageId>`, `VOXIST-<messageId>` et `GMAIL-<threadId>`.
- Confirmation que le backend ignore `legacy_id` et `gmail_thread_id` pour Voxist.
- Ajout d'une route explicite d'archivage des messages Wix déjà traités.
- Ajout d'une route explicite d'archivage des messages Voxist déjà traités.
- Ajout de l'archivage `Historique_Email` après mise à jour d'une relance email existante.
- Extension de la route Email direct à tous les emails entrants hors sources techniques ; l'IA décide ensuite demande réelle, suivi ou hors scope.
- Vérification de `Follow redirect` et `Follow all redirects` sur tous les modules HTTP Apps Script.
- Normalisation des dates inconnues vers `Inconnu / à compléter` pour Voxist, Email direct et Tally.
- Normalisation de la date Tally vers `JJ/MM/AAAA` avant écriture.
- Alignement du backend pour les créations manuelles et Wix sans date exploitable.
- Passage de l'anti-doublon en mode strict : une réponse sans `count` ne vaut plus implicitement zéro et ne peut plus créer une ligne.
- Envoi des identifiants Gmail bruts à l'anti-doublon ; le backend construit l'identifiant métier selon la source, sans fonction Make de sérialisation non prise en charge.
- Suppression du chevauchement entre la route de suivi `count > 0` et la route d'analyse d'une nouvelle demande Email.
- Ajout du fil Gmail du 30/06–02/07/2026 comme cas de non-régression : une réponse citant la demande initiale ne doit jamais recréer la demande.

## État par source

### Wix

- Création et fusion passent par `upsertWixDemand`.
- L'accusé dépend de `created = true`.
- Les réponses Wix sont rattachées via `updateWixFollowup`.
- Les messages déjà connus sont archivés sans recréation.
- Les champs Wix issus de l'IA sont protégés avec `escapeJSON` avant leur insertion dans le corps JSON brut du module 43, notamment les textes multilignes, guillemets et antislashs.
- L'anti-doublon Wix utilise uniquement `WIX-<gmail_message_id>` : un fil Gmail partagé par plusieurs formulaires distincts ne bloque plus les messages suivants.

### Voxist

- Le routage principal dépend de l'expéditeur Voxist, pas du seul mot `VOXIST`.
- Les mots métier élargis du contrat sont présents dans le préfiltre.
- Les chemins transcription et audio possèdent chacun une sortie demande et hors scope.
- Les messages déjà connus sont archivés sans retraitement.

### Email direct

- Wix, Voxist et les boîtes internes sont exclus avant analyse.
- Tous les autres nouveaux emails peuvent être analysés, même sans ancien mot-clé de préfiltrage.
- L'IA distingue nouvelle demande, suivi et hors scope.
- Les suivis rattachés sont archivés après mise à jour.

### Tally

- Le filtre de production impose `formId = Gx52AQ`.
- L'anti-doublon utilise le backend Apps Script.
- La création Sheets exige explicitement `count = 0` ; une réponse absente ou invalide bloque la création.
- Aucune lecture Google Sheets n'est utilisée pour l'anti-doublon.

## Limites nécessitant un essai Make

- Les identifiants de connexions et de labels ne peuvent être validés complètement qu'après import dans le compte Make cible.
- Les sorties exactes des modules OpenAI doivent être testées avec les messages de référence.
- Les filtres et expressions Make doivent être confirmés par un `Run once` après import.
- Les blueprints locaux ne sont pas automatiquement déployés dans Make : l'import et l'activation restent volontaires pour préserver le retour arrière.
