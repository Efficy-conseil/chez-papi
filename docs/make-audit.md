# Audit des blueprints Make

Date de l'audit : 24/07/2026.

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
- Les sorties Wix réelles et hors scope sont séparées par un routeur ; l'archivage d'une demande réelle précède l'accusé optionnel.

### Voxist

- Le routage principal dépend de l'expéditeur Voxist, pas du seul mot `VOXIST`.
- Les mots métier élargis du contrat sont présents dans le préfiltre.
- Le préfiltre reconnaît aussi les demandes formulées avec `apéro`, `dînatoire`, un âge en `ans`, un nombre de `personnes` ou une question de disponibilité ; le cas des 20 ans, apéro dînatoire et 30 personnes atteint donc l'analyse IA.
- Les chemins transcription et audio possèdent chacun une sortie demande et hors scope.
- La retranscription du fichier audio utilise `whisper-1` : ce modèle reste compatible avec le format de la version actuelle du module Make `CreateTranscription`.
- Les rejets IA après extraction de transcription ou retranscription audio sont placés sur des branches distinctes et atteignent toujours `Hors_Scope_Make`.
- Les messages déjà connus sont archivés sans retraitement.

### Email direct

- Wix, Voxist et les boîtes internes sont exclus avant analyse.
- Tous les autres nouveaux emails peuvent être analysés, même sans ancien mot-clé de préfiltrage.
- L'IA distingue nouvelle demande, suivi et hors scope.
- Les suivis rattachés sont archivés après mise à jour.
- Pour une nouvelle demande, l'archivage précède l'accusé optionnel afin qu'une adresse absente ne bloque pas le classement Gmail.

### Tally

- Le filtre de production impose `formId = Gx52AQ`.
- L'anti-doublon utilise le backend Apps Script.
- La création Sheets exige explicitement `count = 0` ; une réponse absente ou invalide bloque la création.
- Aucune lecture Google Sheets n'est utilisée pour l'anti-doublon.
- L'appel anti-doublon effectue trois reprises automatiques espacées de cinq minutes en cas d'erreur HTTP, puis conserve l'exécution incomplète pour une reprise manuelle.

## Limites nécessitant un essai Make

- Les identifiants de connexions et de labels ne peuvent être validés complètement qu'après import dans le compte Make cible.
- Les sorties exactes des modules OpenAI doivent être testées avec les messages de référence.
- Les filtres et expressions Make doivent être confirmés par un `Run once` après import.
- Les blueprints locaux ne sont pas automatiquement déployés dans Make : l'import et l'activation restent volontaires pour préserver le retour arrière.

## Reprise des indisponibilités Apps Script

Le 02/08/2026, le module `60` (`checkDuplicate`) a reçu une réponse HTTP `404` temporaire sous la forme d'une page Google Drive. Une relance manuelle immédiate a réussi, sans modification du scénario ni du backend. Cette situation est donc traitée comme une indisponibilité ponctuelle de la chaîne Google Apps Script / Content Service, et non comme une erreur persistante de configuration.

L'incident s'étant reproduit le 04/08/2026, la protection suivante est désormais présente dans le blueprint versionné et le backend :

1. Le scénario conserve ses exécutions incomplètes.
2. Les modules backend `60`, `43`, `80`, `81`, `84`, `85`, `94`, `62` et `15` possèdent un gestionnaire `Retry` : trois tentatives automatiques, espacées de cinq minutes.
3. Le backend journalise les opérations Make par `gmail_message_id`. Une reprise renvoie le résultat déjà obtenu sans ré-incrémenter `nb_relances_client`.
4. `upsertWixDemand` journalise également ses créations et fusions, afin qu'une reprise conserve le résultat `created` ou `merged` nécessaire à la suite du flux.
5. Le cas de non-régression `C10` couvre une réponse HTTP perdue après une écriture effectivement réalisée.

Le même gestionnaire de reprise protège le module `4` d'anti-doublon du scénario Tally. Comme cet appel ne réalise aucune écriture, une reprise automatique ou manuelle reste sûre ; la création Google Sheets ne peut continuer que si le backend répond explicitement avec `count = 0`.

Ne pas utiliser les gestionnaires `Skip` ou `Resume` pour ces appels : une réponse backend non confirmée ne doit jamais permettre au scénario de poursuivre son classement Gmail ou ses écritures. L'import et l'activation du blueprint dans Make restent manuels.
