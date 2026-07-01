# Chez Papi - Contrat fonctionnel et contraintes techniques

Statut du document : brouillon à valider avec le client.

Objectif : ce document est la source de référence avant toute modification du dashboard, du backend Apps Script ou des blueprints Make. Toute correction doit préserver les comportements listés ici, ou expliciter la modification de contrat dans ce fichier.

## Principes généraux

- Une vraie demande client doit créer ou enrichir une seule ligne dans l'onglet `Demandes`.
- Un suivi client sur une demande existante ne doit pas créer de nouvelle ligne.
- Un email interne, un accusé automatique, une newsletter, une facture fournisseur ou un spam ne doit pas créer de demande.
- Make doit toujours archiver un message traité dans le bon libellé Gmail, sauf si une erreur volontairement remontée empêche le traitement.
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

## Statuts autorisés

- `Nouvelle demande`
- `À rappeler`
- `Devis à préparer`
- `Devis envoyé`
- `Événement confirmé`
- `Événement terminé`
- `Perdu / Sans suite`
- `Refusé / Complet`

## Dates

Format canonique attendu pour `date_evenement` :

- Date complète : `JJ/MM/AAAA`
- Plage : `JJ/MM/AAAA au JJ/MM/AAAA`
- Année seule : `AAAA`
- Inconnu ou trop vague : champ vide

Contraintes :

- Ne jamais stocker `MM/DD/YYYY`.
- Ne jamais transformer une année seule en `01/01/AAAA`.
- Le dashboard doit afficher les dates au format `JJ/MM/AAAA`.
- Les dates longues comme `du 26/08/2026 au 27/08/2026` doivent être stockées `26/08/2026 au 27/08/2026`.
- Les années seules doivent rester visibles dans le dashboard mais ne doivent pas créer d'événement calendrier.

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

Blueprint principal : `make-blueprints/Integration Email - Wix - Voxist - sécurisé - IDs corrigés.blueprint.json`.

Déclencheur : Gmail nouveaux emails.

Étape commune :

- Module `60` appelle le backend `checkDuplicate`.
- Le backend répond avec `count`.
- `count = 0` signifie nouveau message non connu.
- `count > 0` signifie message, thread ou ligne déjà connu.

Contrainte critique :

- Une source métier ne doit jamais être uniquement exclue d'une route sans disposer d'une route de secours.
- Si une route source est bloquée par `count > 0`, il doit exister un comportement explicite : archiver comme déjà traité, mettre à jour une demande existante, ou signaler une anomalie.

## Make - Wix

Source :

- `fromEmail = notifications@wix-forms.com`
- Le corps contient les champs du formulaire, notamment `Nom / Prénom`.

Comportement attendu :

- Nouveau formulaire qualifié -> création d'une demande `WIX-<gmail_message_id>`.
- Canal -> `Site Internet`.
- Label Gmail -> `Historique_Wix`.
- Accusé de réception envoyé au client uniquement lors d'une création réelle.
- Deux formulaires Wix identiques à quelques minutes d'intervalle avec même `nom_client + email_client + date_evenement + telephone` doivent fusionner.
- La fusion Wix doit enrichir la première ligne si le second message est plus complet, sans envoyer un deuxième accusé.

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
- Statut -> `À rappeler`.
- Label Gmail -> `Historique_Voxist`.
- Aucun accusé email automatique.
- Le téléphone doit prioriser le numéro appelant détecté par l'email Voxist si la transcription donne un numéro incohérent.

Critères de vraie demande Voxist :

- demande de devis, renseignements, prestations, formules, formules à la carte ;
- événement, mariage, baptême, anniversaire, 18 ans, buffet, cocktail, repas, réception ;
- nombre de personnes, convives, quarantaine de personnes ;
- date ou période, même si l'année est absente.

Cas de référence :

- `prendre des renseignements sur vos prestations`, `formules à la carte`, `quarantaine de personnes`, `18 ans de mon fils`, `12 septembre` doit créer une demande `Téléphone`, type `Anniversaire`, statut `À rappeler`.

Contrainte anti-régression :

- Voxist ne doit jamais passer dans la route `Relance email`.
- Voxist ne doit jamais être classé `Hors_Scope_Make` s'il contient des indices traiteur ou événementiels.
- Si `checkDuplicate` renvoie `count > 0` pour un message Voxist, une route explicite doit traiter ce cas. Point d'audit actuel : ce chemin est fragile et doit être corrigé avant nouvelle importation si confirmé.

## Make - Email direct

Source :

- Emails entrants hors Wix, hors Voxist, hors boîtes internes.

Comportement attendu :

- Nouvelle demande claire -> création d'une demande `GMAIL-<gmail_thread_id>` ou `GMAIL-<gmail_message_id>` selon l'anti-doublon.
- Canal -> `Email`.
- Label Gmail -> `Historique_Email`.
- Accusé de réception envoyé en réponse au client pour une vraie nouvelle demande.
- Newsletter, fournisseur, facture, spam -> `Hors_Scope_Make`.

Vraies demandes :

- demande de devis, disponibilité, prestation, buffet, cocktail, repas, mariage, anniversaire, entreprise ;
- demande de formules ou tarifs pour vérifier un budget ;
- demande mairie/collectivité/institution avec pièces salées/sucrées, cocktail, réception, avant concert.

Relances et suivis :

- Une modification de devis existant ne crée pas une nouvelle ligne.
- Une validation de devis ne crée pas une nouvelle ligne et ne déclenche pas d'accusé automatique.
- Une réponse à un sujet `Re: Devis`, `TR: Devis`, `Fwd: Devis` n'est une relance que si le dernier message parle du devis existant : nouveau devis, devis actualisé, budget par personne, modification, validation, nouvelle version.
- Une nouvelle demande dans un ancien fil reste une nouvelle demande si elle concerne une nouvelle date, un nouveau lieu, un nouveau type de prestation ou un nouvel événement.

## Make - Tally

Blueprint : `make-blueprints/Integration Tally - sécurisé - IDs corrigés.blueprint.json`.

Comportement attendu :

- Déclencheur Tally production uniquement `formId = Gx52AQ`.
- Anti-doublon via backend `checkDuplicate`.
- Création `TALLY-<submissionId>`.
- Canal -> `Réseaux sociaux`.
- Accusé Tally propre après création.

Contrainte :

- Le module anti-doublon ne doit pas relire Google Sheets directement via Make, pour éviter les quotas Sheets API.

## Backend Apps Script

Fichier : `backend/code.gs`.

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
- `upsertWixDemand` doit créer ou fusionner les doublons Wix rapprochés.
- `updateThreadFollowup` rattache par `gmail_thread_id`.
- `updateWixFollowup` rattache par `gmail_thread_id`, puis fallback dernier `WIX-` par email.
- `updateExistingDemandFollowup` rattache par email+date, puis nom+date si l'email manque.
- Le backend normalise les canaux autorisés.
- Le backend normalise `date_evenement`.
- Le backend force `date_evenement` en texte pour éviter les conversions Google Sheets.

## Dashboard frontend

Fichiers : `index.html`, `app.js`, `styles.css`, `sw.js`.

Comportement attendu :

- Afficher les demandes actives dans le dashboard et le pipeline.
- Afficher toutes les demandes dans `Historique`, avec filtres par date/année/trimestre.
- Afficher les dates au format français.
- Afficher les années seules telles quelles.
- Ne pas afficher une demande à la mauvaise date à cause d'un parsing US.
- Ouvrir le fil Gmail avec le bon label selon le canal :
  - `Site Internet` -> `Historique_Wix`
  - `Téléphone` -> `Historique_Voxist`
  - autres -> `Historique_Email`
- Boutons `Appeler` et `Ouvrir le fil` alignés et cohérents visuellement.
- Le champ `Demande reçue le` doit être renseigné depuis `date_reception`.
- Les relances doivent être visibles via les champs techniques quand l'IHM V2 les exploite.

## Filtres Gmail

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
- Identifier les chemins Make impactés.
- Vérifier les sources non concernées : Wix, Voxist, Email direct, Tally.
- Vérifier si la modification touche `count = 0`, `count > 0`, ou les deux.
- Vérifier qu'aucune source métier ne peut finir sans route.

Après toute modification :

- Valider le JSON des blueprints Make.
- Vérifier la syntaxe de `backend/code.gs` si touché.
- Vérifier les constantes frontend si le dashboard est touché.
- Mettre à jour ce document si le contrat change.
- Commit + push systématiques après validation technique.

Commandes de contrôle locales :

```bash
python3 -m json.tool 'make-blueprints/Integration Email - Wix - Voxist - sécurisé - IDs corrigés.blueprint.json' >/dev/null
python3 -m json.tool 'make-blueprints/Integration Tally - sécurisé - IDs corrigés.blueprint.json' >/dev/null
node --check < backend/code.gs
node --check app.js
git diff --check
```

## Cas de test de non-régression

Wix :

- Nouveau formulaire complet -> une ligne + accusé + `Historique_Wix`.
- Deux formulaires identiques à 1 minute, second plus complet -> une seule ligne enrichie + un seul accusé.
- Réponse client au fil Wix -> relance sur la demande existante, pas de nouvelle ligne.

Voxist :

- Message vocal “prendre des renseignements / prestations / formules à la carte / quarantaine / 18 ans / 12 septembre” -> demande `Téléphone`, `À rappeler`, `Historique_Voxist`.
- Message Voxist personnel sans indice traiteur -> `Hors_Scope_Make`.
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
- `26/08/2026 au 27/08/2026` reste lisible et triable sur la date de début.
- `Ouvrir le fil` utilise le bon label Gmail selon le canal.

## Points ouverts de l'audit

Ces points doivent être validés avant la prochaine correction fonctionnelle :

- Le chemin Voxist avec `checkDuplicate count > 0` peut ne pas avoir de route active après exclusion de la route relance email. Il faut décider : archiver comme déjà traité, mettre à jour une demande existante, ou remonter une alerte.
- Les routes Make sont nombreuses et certaines conditions sont redondantes. Une refonte future devrait réduire les routes globales et isoler strictement Wix, Voxist, Email direct et Tally.
- Le backend ne synchronise pas encore le calendrier lors de `upsertWixDemand` création Wix, contrairement aux créations manuelles via `addRow`. À valider selon besoin.
- Les modules Make qui écrivent encore directement dans Google Sheets : Voxist transcription, Voxist audio, Email direct, Tally. Cela reste acceptable pour l'instant car le quota rencontré concernait les lectures, mais une stratégie backend unique serait plus robuste.
