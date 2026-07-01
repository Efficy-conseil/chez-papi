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
- Exception importante : pour Voxist, `checkDuplicate` ne doit vérifier que `VOXIST-<gmail_message_id>`, pas `gmail_thread_id`, car Gmail peut regrouper plusieurs messages vocaux dans un même fil.

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
- Si `checkDuplicate` renvoie `count > 0` pour un message Voxist, cela doit signifier que le même `VOXIST-<gmail_message_id>` existe déjà. Cela ne doit pas arriver seulement parce que le `gmail_thread_id` existe déjà.

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

## Points ouverts de l'audit

Ces points doivent être validés avant la prochaine correction fonctionnelle :

- Les routes Make sont encore sensibles à l'ordre et aux filtres globaux. Il faut continuer à privilégier des routes strictement séparées par source.
- Les routes Make sont nombreuses et certaines conditions sont redondantes. Une refonte future devrait réduire les routes globales et isoler strictement Wix, Voxist, Email direct et Tally.
- Le backend ne synchronise pas encore le calendrier lors de `upsertWixDemand` création Wix, contrairement aux créations manuelles via `addRow`. À valider selon besoin.
- Les modules Make qui écrivent encore directement dans Google Sheets : Voxist transcription, Voxist audio, Email direct, Tally. Cela reste acceptable pour l'instant car le quota rencontré concernait les lectures, mais une stratégie backend unique serait plus robuste.
