# Chez Papi - Contrat fonctionnel et contraintes techniques

Statut du document : brouillon à valider avec le client.

Objectif : ce document est la source de référence avant toute modification du dashboard, du backend Apps Script ou des blueprints Make. Toute correction doit préserver les comportements listés ici, ou expliciter la modification de contrat dans ce fichier.

## Principes généraux

- Une vraie demande client doit créer ou enrichir une seule ligne dans l'onglet `Demandes`.
- Un suivi client sur une demande existante ne doit pas créer de nouvelle ligne.
- Un email interne, un accusé automatique, une newsletter, une facture fournisseur ou un spam ne doit pas créer de demande.
- Make doit toujours archiver un message traité dans le bon libellé Gmail, sauf si une erreur volontairement remontée empêche le traitement.
- Un accusé optionnel ne doit jamais être placé avant l'archivage dans une même branche, car son filtre pourrait interrompre le flux.
- Les filtres Gmail ne doivent pas masquer les sources métier surveillées par Make.
- Les corrections doivent être testées contre les chemins Wix, Voxist, Email direct et Tally avant import.

## Sources et canaux autorisés

Canaux autorisés dans la base et le dashboard :

- `Téléphone`
- `Email`
- `Site Internet`
- `Réseaux sociaux`
- `Saisie manuelle`

Mapping attendu :

- Voxist -> `Téléphone`
- Email direct -> `Email`
- Wix -> `Site Internet`
- Tally -> `Réseaux sociaux`
- Création dashboard -> `Saisie manuelle`

## Champs de base

Champs métier principaux :

- `id_demande`
- `date_reception`
- `canal`
- `nom_client`
- `telephone`
- `email_client`
- `type_evenement`
- `date_evenement`
- `heure_evenement`
- `nb_convives`
- `lieu_prestation`
- `budget_estime`
- `statut`
- `message_original`
- `url_email_origine`
- `notes`
- `url_dossier_drive`
- `derniere_modification`

Champs techniques :

- `gmail_thread_id`
- `gmail_message_id`
- `wix_form_fingerprint`
- `dernier_email_recu_le`
- `dernier_message_client`
- `nb_relances_client`
- `relance_a_traiter`
- `en_attente_reponse_depuis`
- `make_operation_log` (journal technique interne des opérations Make déjà appliquées)

## Statuts autorisés

- `Nouvelle demande`
- `À rappeler`
- `En attente de réponse`
- `Devis à préparer`
- `Devis envoyé`
- `Événement confirmé`
- `Événement terminé`
- `Perdu / Sans suite`
- `Refusé / Complet`

Lorsqu'une demande passe à `En attente de réponse`, le backend renseigne `en_attente_reponse_depuis`. Cette date est conservée tant que le statut ne quitte pas puis ne réintègre pas cet état ; elle sert au dashboard pour compter les jours sans réponse et signaler une relance à partir de sept jours.

## Dates

Format canonique attendu pour `date_evenement` :

- Date complète : `JJ/MM/AAAA`
- Date saisie sans année : `JJ/MM`, normalisée avec l'année en cours
- Plage : `JJ/MM/AAAA au JJ/MM/AAAA`
- Année seule : `AAAA`
- Inconnu ou trop vague : `Inconnu / à compléter`

Contraintes :

- Ne jamais stocker `MM/DD/YYYY`.
- Ne jamais transformer une année seule en `01/01/AAAA`.
- Une date `JJ/MM` doit utiliser l'année en cours et être normalisée en `JJ/MM/AAAA`.
- Pour une demande de prestation, une date complète avec une année manifestement ancienne dont seul le chiffre des dizaines est erroné peut être corrigée vers l'année de réception ou l'année suivante : par exemple `2016` → `2026` et `2007` → `2027` pour une demande reçue en 2026. La date corrigée doit rester strictement future par rapport à la réception. Cette correction ne s'applique pas à une année seule, à une date au-delà de l'année suivante ou à un contexte historique explicite ; dans ces cas, la date est à compléter.
- Ne jamais laisser JavaScript convertir une date `JJ/MM` en une date de 2001.
- Le dashboard doit afficher les dates au format `JJ/MM/AAAA`.
- Le dashboard doit afficher une date `JJ/MM` avec l'année en cours.
- Les dates longues comme `du 26/08/2026 au 27/08/2026` doivent être stockées `26/08/2026 au 27/08/2026`.
- Les années seules doivent rester visibles dans le dashboard mais ne doivent pas créer d'événement calendrier.
- Les dates saisies sans année participent au tri et au calendrier avec l'année en cours.

## Google Calendar

- Une demande ne doit créer un événement Google Calendar que lorsque son statut devient `Événement confirmé`.
- Cette règle s'applique à tous les canaux : Téléphone, Email, Site Internet, Réseaux sociaux et Saisie manuelle.
- La création initiale d'une demande avec un autre statut ne doit pas créer d'événement calendrier.
- Un changement de statut entre deux états non confirmés ne doit pas consulter Google Calendar.

## Types d'événement

Valeurs attendues :

- `Mariage`
- `Baptême`
- `Anniversaire`
- `Entreprise`
- `Autres`

Règles :

- `Entreprise` couvre les entreprises, mairies, collectivités, associations, institutions, événements professionnels, cocktails avant concert, cafés d'accueil, séminaires, repas internes.
- Une demande de particuliers pour les 18 ans, anniversaire enfant/adulte ou événement familial doit être `Anniversaire` si le contexte est clair.

## Make - contrat de routage global

Blueprint principal : `make/Integration Email - Wix - Voxist.blueprint.json`.
Le nom du blueprint ne doit pas être modifié, la gestion des versions est gérée par Make.

Déclencheur : Gmail nouveaux emails.

Étape commune :

- Module `60` appelle le backend `checkDuplicate` avec `source_email`, `gmail_message_id` et `gmail_thread_id` ; le backend construit l'identifiant métier préfixé.
- Le backend répond avec `count`.
- `count = 0` signifie nouveau message non connu.
- `count > 0` signifie message, thread ou ligne déjà connu.
- Exception importante : pour Wix et Voxist, `checkDuplicate` ne doit vérifier que l'identifiant préfixé construit avec `gmail_message_id`, jamais `gmail_thread_id`. Gmail peut regrouper plusieurs formulaires Wix distincts ou plusieurs messages vocaux dans un même fil.

Contrainte critique :

- Une source métier ne doit jamais être uniquement exclue d'une route sans disposer d'une route de secours.
- Si une route source est bloquée par `count > 0`, il doit exister un comportement explicite : archiver comme déjà traité, mettre à jour une demande existante, ou signaler une anomalie.
- Tout texte libre interpolé dans un corps JSON brut Make doit être protégé avec `escapeJSON` afin de préserver les retours à la ligne, guillemets et antislashs sans produire un JSON invalide.
- Toute création Make passe par l'action backend `createMakeDemand`, y compris Voxist, Email direct et Tally, afin d'appliquer les mêmes validations et la normalisation des coordonnées que les créations manuelles.

## Make - Wix

Source :

- `fromEmail = notifications@wix-forms.com`
- Le corps contient les champs du formulaire, notamment `Nom / Prénom`.

Comportement attendu :

- Nouveau formulaire qualifié -> création d'une demande `WIX-<gmail_message_id>`.
- Canal -> `Site Internet`.
- Statut -> `Nouvelle demande`.
- Label Gmail -> `Historique_Wix`.
- Accusé de réception envoyé au client uniquement lors d'une création réelle.
- Deux formulaires Wix identiques à quelques minutes d'intervalle avec même `nom_client + email_client + date_evenement + telephone` doivent fusionner.
- La fusion Wix doit enrichir la première ligne si le second message est plus complet, sans envoyer un deuxième accusé.
- Lorsqu'un formulaire Wix arrive après une demande active d'un autre canal et qu'il existe une unique ligne avec le même téléphone normalisé et la même date d'événement, il doit enrichir cette première ligne au lieu d'en créer une autre. L'identifiant, la date de réception, le canal et le statut de la première ligne sont conservés ; Wix remplace les coordonnées et détails métier non techniques par ses données, et son lien Gmail devient le seul lien conservé.
- Les doublons Wix déjà présents peuvent être résorbés par l'opération backend `mergeWixDuplicateDemand` uniquement si les deux dossiers actifs ont le même téléphone normalisé et la même date d'événement. Elle enrichit le dossier principal depuis Wix puis supprime le doublon Wix.

Contrainte anti-régression :

- Les réponses clients dans un fil Wix ne doivent pas créer de nouvelle demande.
- Les réponses clients dans un fil Wix doivent marquer une relance ou être archivées dans `Historique_Wix`.

## Make - Voxist

Source :

- `fromEmail = message@voxist.com`
- Le corps contient `VOXIST` ou une structure de message vocal.

Comportement attendu :

- Message vocal qualifié traiteur -> création d'une demande `VOXIST-<gmail_message_id>`.
- Canal -> `Téléphone`.
- Statut -> `Nouvelle demande`.
- Label Gmail -> `Historique_Voxist`.
- Aucun accusé email automatique.
- Le téléphone doit prioriser le numéro appelant détecté par l'email Voxist si la transcription donne un numéro incohérent.
- Les numéros de téléphone reçus par le backend sont enregistrés au format français lisible `06 00 00 00 00` lorsqu'ils sont valides. Plusieurs numéros valides sont conservés et séparés par ` / `. Cette normalisation intervient à l'écriture uniquement et ne déclenche aucune réécriture lors de la consultation.
- Si l'appelant n'énonce aucun nom ou prénom, `nom_client` doit être `Inconnu / à compléter`. Le type d'événement ou le motif de l'appel ne doit jamais être utilisé comme nom client.
- Avant toute création Voxist, un appel contenant une date peut être rattaché à une unique demande active, y compris d'origine Wix, lorsque les indices disponibles (nom, téléphone, lieu, date, convives, type ou statut) convergent. En dernier recours, une date de prestation unique parmi les demandes actives suffit uniquement pour cette route Voxist explicite ; une absence ou une ambiguïté de candidate ne crée ni ne modifie aucune ligne.
- Un rattachement Voxist conserve le statut commercial de la demande, enregistre la transcription comme `dernier_message_client`, remplace le téléphone par le numéro appelant exploitable et positionne `relance_a_traiter = TRUE`.
- Lorsqu'un unique dossier actif porte le même numéro normalisé, Voxist le rattache directement avant d'évaluer le nom ou la date. Le nom retranscrit est alors secondaire ; si plusieurs dossiers actifs partagent ce numéro, aucun rattachement ni création automatique n'est effectué.

Critères de vraie demande Voxist :

- demande de devis, renseignements, prestations, formules, formules à la carte ;
- événement, mariage, baptême, anniversaire, buffet, cocktail, repas, réception ;
- nombre de personnes, convives, invités ;
- date ou période, même si l'année est absente. Prendre l'année en cours si non précisée ou mal interprétée.

Cas de référence :

- `prendre des renseignements sur vos prestations`, `formules à la carte`, `quarantaine de personnes`, `18 ans de mon fils`, `12 septembre` doit créer une demande `Téléphone`, type `Anniversaire`, statut `Nouvelle demande`.
- Une demande de disponibilité pour les `20 ans de ma fille`, avec `apéro dînatoire`, `30 personnes` et une date comme le `15 août`, doit créer une demande `Téléphone`, type `Anniversaire`, statut `Nouvelle demande`, même si les mots `anniversaire`, `traiteur` et `devis` ne sont pas prononcés.

Contrainte anti-régression :

- Voxist ne doit jamais passer dans la route relance email, ni nouvel email, ni Wix.
- Voxist ne doit jamais être classé `Hors_Scope_Make` s'il contient des indices traiteur ou événementiels.
- Si `checkDuplicate` renvoie `count > 0` pour un message Voxist, cela doit signifier que le même `VOXIST-<gmail_message_id>` existe déjà. Cela ne doit pas arriver seulement parce que le `gmail_thread_id` existe déjà.

## Make - Email direct

Source :

- Emails entrants hors Wix, hors Voxist, hors boîtes internes.

Comportement attendu :

- Nouvelle demande claire -> création d'une demande `GMAIL-<gmail_thread_id>` ou `GMAIL-<gmail_message_id>` selon l'anti-doublon.
- Canal -> `Email`.
- Label Gmail -> `Historique_Email`.
- Accusé de réception envoyé en réponse au client pour une vraie nouvelle demande.
- Newsletter, fournisseur, facture, spam -> `Hors_Scope_Make`. Mais normalement ça doit être filtré avant par Gmail.

Vraies demandes :

- demande de devis, disponibilité, prestation, buffet, cocktail, repas, mariage, anniversaire, entreprise ;
- demande de formules ou tarifs pour vérifier un budget ;
- demande mairie/collectivité/institution avec pièces salées/sucrées, cocktail, réception, avant concert.

Relances et suivis :

- Une modification de devis existant ne crée pas une nouvelle ligne et ne déclenche pas d'accusé automatique.
- Une validation de devis ne crée pas une nouvelle ligne et ne déclenche pas d'accusé automatique.
- Un bon de commande, une commande validée ou un document confirmant un devis est un suivi, même lorsqu'il vient d'un portail ou d'un expéditeur technique dans un nouveau fil Gmail. Il doit être rattaché uniquement s'il existe une seule demande correspondant exactement au contact identifié et à la date de prestation ; sinon, aucune ligne ne doit être créée et le message reste à vérifier dans la boîte de réception.
- Une réponse à un sujet `Re: Devis`, `TR: Devis`, `Fwd: Devis` n'est une relance que si le dernier message parle du devis existant : nouveau devis, devis actualisé, budget par personne, modification, validation, nouvelle version.
- Une nouvelle demande dans un ancien fil reste une nouvelle demande si elle concerne une nouvelle date, un nouveau lieu, un nouveau type de prestation ou un nouvel événement.
- Une réponse courte qui accepte ou précise un créneau de rappel, sans redonner la date de prestation, est un suivi. Elle est rattachée uniquement lorsqu’une seule demande active possède exactement la même adresse email ; si aucune ou plusieurs demandes actives correspondent, aucune ligne n’est créée et le message reste à vérifier.
- Les formulations `Merci pour vos propositions` et `modifier certaines pièces` sont des indices déterministes de suivi commercial. Elles doivent emprunter la route de rattachement même si l’IA retourne à tort `is_followup=false`, et elles sont interdites dans la route de création Email.
- Une réponse rattachée à une demande existante renseigne `dernier_email_recu_le`, `dernier_message_client`, incrémente `nb_relances_client`, positionne `relance_a_traiter = TRUE` et conserve une `url_email_origine` ouvrant le fil Gmail.
- Le frontend présente ces réponses dans le regroupement transversal `Messages reçus`, sans modifier automatiquement le statut commercial de la demande.
- Une étoile signale les demandes ayant un message à traiter. L'action explicite `Marquer comme traité` positionne `relance_a_traiter = FALSE` ; un échange ultérieur le réactive.

## Make - Tally

Blueprint : `make/Integration Tally.blueprint.json`.
Le nom du blueprint ne doit pas être modifié, la gestion des versions est gérée par Make.

Comportement attendu :

- Déclencheur Tally production uniquement `formId = Gx52AQ`.
- Anti-doublon via backend `checkDuplicate`.
- Création `TALLY-<submissionId>`.
- Canal -> `Réseaux sociaux`.
- Accusé Tally propre après création.

Contrainte :

- Le module anti-doublon ne doit pas relire Google Sheets directement via Make, pour éviter les quotas Sheets API.

## Backend Apps Script

Fichier : `apps-script/code.gs`.

Actions dashboard avec authentification utilisateur :

- `list` / `getAll`
- `add`
- `update`
- `delete`

Actions Make avec `make_token` :

- `checkDuplicate`
- `upsertWixDemand`
- `updateThreadFollowup`
- `updateWixFollowup`
- `updateExistingDemandFollowup`

Contraintes backend :

- `checkDuplicate` est la source commune d'anti-doublon pour Make.
- Tous les modules HTTP Make qui appellent Apps Script doivent avoir `Follow redirect` activé. Sinon Make reçoit seulement une réponse Google `302 Moved Temporarily` au lieu du JSON backend, et les champs comme `count` deviennent inexploitables.
- Les réponses de succès Apps Script sont toutes enveloppées sous `data` (`{ ok: true, data: { … } }`). Dans Make, un champ métier du module HTTP se référence donc avec deux niveaux `data`, par exemple `{{60.data.data.count}}` ou `{{81.data.data.updated}}`.
- `upsertWixDemand` doit créer ou fusionner les doublons Wix rapprochés.
- Les écritures Make doivent être idempotentes par `gmail_message_id` : après une écriture réussie dont la réponse HTTP est perdue, la reprise doit renvoyer le résultat initial sans ré-incrémenter `nb_relances_client`.
- `upsertWixDemand` doit mémoriser le résultat d'un message Wix déjà appliqué afin qu'une reprise poursuive l'archivage et l'accusé attendus sans créer de seconde ligne.
- `updateThreadFollowup` rattache par `gmail_thread_id`.
- `updateWixFollowup` rattache par `gmail_thread_id`, puis fallback dernier `WIX-` par email.
- `updateExistingDemandFollowup` rattache par email+date, puis nom+date si l'email manque. Sans date de prestation, il accepte uniquement une correspondance exacte et unique sur l’email parmi les demandes actives.
- Si ces critères exacts échouent, `updateExistingDemandFollowup` peut utiliser le même rapprochement prudent que la saisie manuelle : téléphone ou email exact, ou combinaison forte et unique entre nom, date, convives, type, lieu et statut. Une correspondance absente ou ambiguë ne crée aucune ligne.
- L'option Make `allow_unique_active_event_date` est réservée au parcours Voxist : après les rapprochements habituels, elle autorise seulement une demande active unique partageant la même date de prestation.
- La nouvelle interface appelle l'action dashboard `add` avec l'option `check_duplicates`. Le backend recherche alors les demandes actives similaires sous le même verrou que l'écriture ; sans décision explicite, il retourne les candidates et ne crée rien. Il accepte ensuite soit l'enrichissement d'un `id_demande` choisi, soit une création forcée confirmée par l'utilisatrice. Un ancien frontend qui n'envoie pas cette option conserve temporairement le comportement historique de création, afin que le déploiement backend reste compatible pendant la publication GitHub Pages.
- L'enrichissement manuel conserve l'identifiant, la date de réception, le canal et tous les champs techniques de la fiche choisie. Les champs non vides de la saisie complètent la fiche ; le statut `Nouvelle demande` par défaut ne rétrograde pas un dossier déjà avancé.
- Le backend normalise les canaux autorisés.
- Le backend normalise `date_evenement`.
- Le backend force `date_evenement` en texte pour éviter les conversions Google Sheets.
- Le backend force les lignes Google Sheets à 20 px et coupe le retour à la ligne automatique pour éviter les lignes très hautes.
- La lecture des demandes ne doit jamais reformater toute la feuille ni effectuer d'écriture hors ajout éventuel des colonnes techniques manquantes.

## Dashboard frontend

Fichiers : `chez-papi/index.html`, `chez-papi/app.js`, `chez-papi/styles.css`, `chez-papi/sw.js`.

La description fonctionnelle détaillée du frontend se trouve dans `docs/frontend-functional-spec.md`. Toute modification visible doit mettre à jour cette spécification et le présent contrat si une règle métier change.

Comportement attendu :

- Afficher les demandes actives dans le dashboard et le pipeline.
- Afficher toutes les demandes dans `Historique`, avec filtres par date/année/trimestre.
- Afficher les dates au format français.
- Une synchronisation frontend doit s'arrêter après 30 secondes et afficher une erreur exploitable au lieu de bloquer indéfiniment l'interface.
- Afficher les années seules telles quelles.
- Ne pas afficher une demande à la mauvaise date à cause d'un parsing US.
- Ouvrir le fil Gmail avec le bon label selon le canal :
  - `Site Internet` -> `Historique_Wix`
  - `Téléphone` -> `Historique_Voxist`
  - autres -> `Historique_Email`
- Si `url_email_origine` est absente, reconstruire ce lien depuis `gmail_thread_id` (ou `gmail_message_id`) lorsqu'il est disponible.
- Boutons `Appeler` et `Ouvrir le fil` alignés et cohérents visuellement.
- Le champ `Demande reçue le` doit être renseigné depuis `date_reception`.
- Les relances doivent être visibles via les champs techniques quand l'IHM V2 les exploite.

## Filtres Gmail

L'inventaire versionné des filtres actuellement configurés dans Gmail est conservé dans `docs/gmail-filters.md`. Il doit être mis à jour à chaque modification manuelle dans Gmail.

Contraintes :

- Les filtres Gmail ne doivent pas faire `Skip Inbox` sur :
  - `message@voxist.com`
  - `notifications@wix-forms.com`
  - emails clients directs probables
- Les filtres newsletter doivent exclure explicitement Voxist et Wix si leurs templates contiennent `ouvrir dans le navigateur` ou équivalent.
- `Hors_Scope_Gmail` doit rester séparé de `Hors_Scope_Make` pour identifier qui a classé l'email.

## Labels Gmail attendus

- Wix traité -> `Historique_Wix`
- Voxist traité -> `Historique_Voxist`
- Email direct traité -> `Historique_Email`
- Hors scope Make -> `Hors_Scope_Make`
- Hors scope Gmail -> `Hors_Scope_Gmail`
- Alertes Make -> `Alerte_Make`

## Règles de modification obligatoires

Avant toute modification :

- Lire ce document.
- Considérer l'état fonctionnel actuel comme la référence comportementale à préserver.
- Identifier les chemins Make impactés.
- Vérifier les sources non concernées : Wix, Voxist, Email direct, Tally.
- Vérifier si la modification touche `count = 0`, `count > 0`, ou les deux.
- Vérifier qu'aucune source métier ne peut finir sans route.
- Pour toute modification structurelle de Make, disposer d'un export fonctionnel de référence et d'une procédure de retour arrière avant import.
- Ne supprimer ou fusionner aucune route avant d'avoir couvert son comportement par des tests de caractérisation.
- Utiliser `docs/make-regression-matrix.md` comme liste de contrôle pour toute modification Make.

Après toute modification :

- Valider le JSON des blueprints Make.
- Vérifier la syntaxe de `apps-script/code.gs` si touché.
- Vérifier les constantes frontend si le dashboard est touché.
- Rejouer les cas de non-régression des quatre sources, y compris les chemins anti-doublon et relance concernés.
- Mettre à jour ce document si le contrat change.
- Commit + push systématiques après validation technique.

Commandes de contrôle locales :

```bash
npm run check
git diff --check
```

## Cas de test de non-régression

Wix :

- Nouveau formulaire complet -> une ligne + accusé + `Historique_Wix`.
- Deux formulaires identiques à 5 minutes, second plus complet -> une seule ligne enrichie + un seul accusé.
- Réponse client au fil Wix -> relance sur la demande existante, pas de nouvelle ligne.

Voxist :

- Message vocal “prendre des renseignements / prestations / formules à la carte / quarantaine / 18 ans / 12 septembre” -> demande `Téléphone`, `Nouvelle demande`, `Historique_Voxist`.
- Message Voxist personnel sans indice traiteur ou événement -> `Hors_Scope_Make`.
- Message Voxist déjà connu par anti-doublon -> doit avoir une route explicite de traitement ou d'archivage.

Email direct :

- Demande mairie cocktail 140 personnes -> demande `Entreprise`.
- Demande mariage formules/tarifs -> demande `Mariage`.
- Newsletter METRO -> `Hors_Scope_Make`, pas de ligne.
- `DEVIS VALIDE` -> relance/suivi, pas de ligne, pas d'accusé, `Historique_Email`.
- `Re: Devis` avec “c'est parfait pour le nouveau devis” -> relance, pas de ligne.
- Ancien fil avec nouvelle prestation/date -> nouvelle ligne.

Tally :

- Nouvelle soumission production -> ligne `TALLY-...`.
- Soumission déjà connue -> pas de doublon.
- Formulaire non production -> ignoré.

Dashboard :

- `25/08/2026` affiché correctement, pas interprété comme format US.
- `11/07/2026` reste 11 juillet, pas 7 novembre.
- `2028` reste visible comme année.
- En 2026, `12/09` est affiché `12/09/2026`, jamais `09/12/2001`.
- `26/08/2026 au 27/08/2026` reste lisible et triable sur la date de début.
- `Ouvrir le fil` utilise le bon label Gmail selon le canal.

## Audit des erreurs possibles par canal

Cette section sert à raisonner avant toute correction. Une erreur peut venir de Gmail, Make, backend, Google Sheets ou dashboard.

### Téléphone / Voxist

Erreurs possibles déjà rencontrées :

- Filtre Gmail trop large qui applique `Hors_Scope_Gmail` et fait `Skip Inbox` avant Make.
- Route email relance qui capture un message Voxist.
- Anti-doublon qui bloque un nouveau message vocal parce que le `gmail_thread_id` existe déjà.
- Préfiltre Voxist trop restrictif : message vocal qualifié qui ne déclenche pas l'IA.
- IA Voxist qui classe hors scope une demande de renseignements, formules ou prestations.
- Transcription absente ou non exploitable, avec bascule vers le chemin audio.
- Numéro de téléphone extrait depuis la transcription incohérent avec le numéro appelant.
- Date sans année, par exemple `12 septembre`, qui peut être ambiguë.

Contraintes de prévention :

- Gmail ne doit pas exclure `message@voxist.com` de l'Inbox.
- Make doit traiter Voxist avant toute route email générique.
- La route principale Voxist doit se baser sur `fromEmail = message@voxist.com`, pas sur la présence exacte du mot `VOXIST` dans `fullTextBody`.
- Voxist doit être exclu des routes Email direct et Relance email.
- `checkDuplicate` Voxist doit ignorer `gmail_thread_id` et `legacy_id` basés sur le thread.
- Les mots `renseignements`, `prestations`, `formules`, `à la carte`, `quarantaine`, `18 ans` doivent qualifier le message.
- Le numéro appelant détecté par Voxist est prioritaire si la transcription contient un numéro déformé.

### Site Internet / Wix

Erreurs possibles déjà rencontrées :

- Filtre Gmail newsletter qui capture le template Wix à cause de `ouvrir dans le navigateur`.
- Même formulaire envoyé deux fois, le premier incomplet et le second complet.
- Demande Wix traitée deux fois : route Wix puis route Email direct.
- Accusé de réception envoyé à l'adresse technique Wix au lieu du client.
- Réponse client au fil Wix traitée comme nouvelle demande email.
- Transfert ou réponse Wix avec nouveau `gmail_thread_id` impossible à rattacher.

Contraintes de prévention :

- Gmail ne doit pas exclure `notifications@wix-forms.com` de l'Inbox.
- Email direct doit exclure les emails venant de Wix.
- `upsertWixDemand` doit fusionner les doublons rapprochés par empreinte `nom + email + date + téléphone`.
- Les réponses ou transferts de sujets Wix doivent passer par `updateWixFollowup`.
- Un accusé Wix ne doit partir que sur création réelle, jamais sur fusion.

### Email direct

Erreurs possibles déjà rencontrées :

- Newsletter fournisseur ou METRO classée trop tard ou provoquant une erreur JSON.
- Vraie demande mairie/collectivité classée hors scope.
- Demande mariage ou tarifs classée hors scope faute de mot `devis`.
- Réponse client à un devis existant créée comme nouvelle demande.
- Nouvelle demande envoyée dans un ancien fil classée à tort comme relance.
- Validation de devis générant un accusé automatique ou une nouvelle demande.
- Sujet `Re: Devis` bloqué trop largement.
- Mauvais rattachement si demande initiale manuelle n'a pas d'email.

Contraintes de prévention :

- Les règles IA doivent distinguer dernier message et historique cité.
- `is_followup=true` doit empêcher création et accusé.
- Une nouvelle prestation avec nouvelle date dans un ancien fil doit rester `is_followup=false`.
- Les suivis peuvent être rattachés par email+date ou nom+date.
- `DEVIS VALIDE` est un suivi sans accusé.
- Les fournisseurs et newsletters doivent rester hors scope avec résumé court, pas corps brut.

### Réseaux sociaux / Tally

Erreurs possibles :

- Soumission du mauvais formulaire Tally traitée par erreur.
- Doublon de soumission si l'anti-doublon échoue.
- Date Tally au mauvais format.
- Canal incorrect si la valeur Make change.
- Quota Google Sheets si Make relit directement la feuille.

Contraintes de prévention :

- Filtre production `formId = Gx52AQ`.
- Anti-doublon via backend `checkDuplicate`.
- Canal `Réseaux sociaux`.
- Ne pas restaurer de lecture Sheets directe dans le module anti-doublon.

### Saisie manuelle / Dashboard

Erreurs possibles :

- Date saisie manuellement au format `JJ/MM/AAAA` interprétée en format US.
- Année seule affichée comme date complète.
- Plage de dates non triable ou mal affichée.
- Canal non autorisé rejeté par backend.
- Demande initiale manuelle sans email difficile à rattacher à un suivi email.
- Écriture dashboard qui remplace des champs techniques utiles.

Contraintes de prévention :

- Le backend force `date_evenement` en texte.
- Le dashboard affiche `date_evenement` via `formatDateFR`.
- Les suivis email peuvent fallback sur nom+date quand email absent.
- Les canaux du formulaire doivent rester synchronisés avec `ALLOWED_CHANNELS`.
- Une création manuelle similaire à une ou plusieurs demandes actives ne doit pas écrire immédiatement une nouvelle ligne.
- Le dashboard doit proposer les candidates dans une fenêtre de rapprochement, permettre de consulter leurs différences sans perdre la saisie, puis exiger le choix explicite d'enrichir ou de créer malgré tout.
- Les variantes françaises d'un même téléphone, avec ou sans espaces, préfixe national ou zéro initial, doivent partager la même clé de rapprochement.

### Backend / Google Sheets / Calendar

Erreurs possibles transverses :

- Colonnes techniques absentes.
- En-têtes renommés non reconnus.
- URL rejetée par sécurité.
- Statut ou canal invalide rejeté.
- Événement calendrier non synchronisé pour certains chemins Make.
- Quota Google Apps Script ou Google Sheets.

Contraintes de prévention :

- `ensureSchemaHeaders` ajoute les colonnes techniques.
- `KEY_MAP` doit être mis à jour si un en-tête change.
- Les URLs autorisées sont `mail.google.com` et `drive.google.com`.
- Toute nouvelle création Make devrait idéalement passer par backend pour homogénéiser calendrier, dates et validation.

## Décisions issues de l'audit

Ces décisions encadrent les prochaines corrections fonctionnelles :

- Décision validée : l'architecture Make évoluera progressivement vers des routes strictement séparées par source pour Wix, Voxist et Email direct ; Tally restera dans son blueprint dédié.
- Décision validée : aucune refonte globale immédiate. Les conditions redondantes seront supprimées progressivement, uniquement après ajout de tests de caractérisation, validation des cas de non-régression et préparation d'un retour arrière.
- Décision validée : un événement Google Calendar est créé uniquement lorsque la demande passe au statut `Événement confirmé`, quel que soit son canal. `upsertWixDemand` n'a donc pas à créer d'événement pour une nouvelle demande Wix au statut `Nouvelle demande`.
- Décision validée : les écritures directes de Make vers Google Sheets pour Voxist transcription, Voxist audio, Email direct et Tally sont conservées pour l'instant, car elles ne sont pas critiques et le quota rencontré concernait les lectures. Une migration éventuelle vers le backend se fera source par source, uniquement après tests comparatifs et avec retour arrière possible.
