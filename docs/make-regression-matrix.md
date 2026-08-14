# Matrice de non-régression Make

Cette matrice doit être rejouée avant toute activation d'un blueprint modifié. Une validation statique signifie que la structure du fichier a été contrôlée localement ; elle ne remplace pas un essai réel dans Make.

## Contrôles communs

| ID | Cas | Résultat attendu | Validation locale |
|---|---|---|---|
| C01 | Appel Apps Script depuis un module HTTP | `Follow redirect` et `Follow all redirects` actifs | Automatique |
| C02 | Réponse anti-doublon `count = 0` | Passage vers la route de création ou d'analyse de la bonne source | Automatique |
| C03 | Réponse anti-doublon `count > 0` | Mise à jour, archivage explicite ou arrêt documenté, jamais création aveugle | Automatique + essai Make |
| C04 | Message traité | Retrait de `INBOX` et application du bon libellé Gmail | Essai Make |
| C05 | Erreur backend volontaire | Erreur visible dans Make, message non perdu | Essai Make |
| C06 | Date complète, plage, année seule, date inconnue | Respect du format défini dans le contrat produit | Essai Make |
| C08 | Demande reçue en 2026, avec date complète à venir saisie `2016` ou `2007` au lieu de `2026` ou `2027` | L'année est corrigée vers l'année courante ou suivante, jour et mois conservés, seulement si la date reste future ; sinon date à compléter | Automatique + essai Make |
| C09 | Relance contenant retours à la ligne, guillemets ou antislashs | Mise à jour de la demande existante, incrément de `nb_relances_client`, `relance_a_traiter = TRUE`, puis archivage | Automatique + essai Make |
| C07 | Réponse anti-doublon sans champ `count` ou inexploitable | Aucune création ; exécution en erreur visible, message conservé pour reprise | Automatique + essai Make |
| C10 | Réponse HTTP Apps Script perdue après une écriture réussie, puis reprise Make | Le même `gmail_message_id` renvoie le résultat initial ; aucune seconde écriture, aucun second incrément de `nb_relances_client` et le flux restant reprend | Backend + essai Make |
| C11 | Réponse HTTP Apps Script réussie, y compris `checkDuplicate` | Les filtres Make lisent les champs métier sous `data.data` (par exemple `updated` ou `count`) et poursuivent la route attendue | Automatique + essai Make |

## Wix

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| W01 | Nouveau formulaire complet | Une ligne `WIX-<messageId>`, canal `Site Internet`, statut `Nouvelle demande`, accusé, `Historique_Wix` | Essai Make |
| W02 | Même formulaire à moins de 15 minutes, second plus complet | Une ligne enrichie, aucun second accusé | Statique + essai Make |
| W03 | Même message Wix déjà traité (`count > 0`) | Aucun doublon, archivage explicite dans `Historique_Wix` | Statique |
| W04 | Réponse client dans un fil Wix | Mise à jour de la demande existante, relance à traiter, aucun accusé | Statique + essai Make |
| W05 | Formulaire Wix non qualifié ou incomplet | Aucune création erronée ; message classé ou anomalie visible | Essai Make |
| W06 | Email Wix | Ne passe jamais dans Voxist ou Email direct | Automatique |
| W07 | Formulaire Wix avec texte multiligne, guillemets ou antislashs | JSON valide envoyé au backend, une ligne créée et aucun `Bad control character` | Automatique + essai Make |
| W08 | Deux formulaires Wix distincts regroupés dans le même fil Gmail | Le second `gmail_message_id` reste nouveau ; création ou fusion décidée ensuite par `upsertWixDemand` | Backend + essai Make |
| W09 | Vocal Voxist puis formulaire Wix de Catherine, même téléphone normalisé et même date d'anniversaire | Une seule ligne : identifiant, date de réception et canal Voxist conservés ; données formulaire et lien Gmail Wix remplacent les données moins fiables ; aucun second accusé | Backend + essai Make |

## Voxist

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| V01 | Transcription avec renseignements, prestations, formules, quarantaine, 18 ans, 12 septembre | Une ligne `VOXIST-<messageId>`, `Téléphone`, `Anniversaire`, `Nouvelle demande`, `Historique_Voxist` | Statique + essai Make |
| V02 | Nouveau vocal dans un fil Gmail déjà utilisé | Contrôle uniquement de `VOXIST-<messageId>`, création autorisée | Backend + essai Make |
| V03 | Même vocal déjà traité (`count > 0`) | Aucun doublon, archivage explicite dans `Historique_Voxist` | Statique |
| V04 | Vocal sans transcription Voxist car le quota de retranscriptions est épuisé, avec audio joint | Téléchargement et transcription audio, puis même qualification ; le texte de quota ne doit pas empêcher cette branche | Statique + essai Make |
| V05 | Vocal personnel hors traiteur/événement | Aucune ligne, `Hors_Scope_Make` | Statique + essai Make |
| V06 | Numéro appelant différent de la transcription | Numéro appelant conservé en priorité | Essai Make |
| V07 | Email Voxist | Ne passe jamais dans Wix, Email direct ou relance email | Automatique |
| V08 | Transcription préqualifiée puis rejetée par l’IA | Aucune ligne, archivage dans `Hors_Scope_Make` | Automatique + essai Make |
| V09 | Audio retranscrit puis rejeté par l’IA | Aucune ligne, archivage dans `Hors_Scope_Make` | Automatique + essai Make |
| V10 | Vocal de demande d’anniversaire sans nom énoncé | `nom_client` = `Inconnu / à compléter`, type = `Anniversaire`, sans jamais utiliser le type comme nom | Automatique + essai Make |
| V11 | Vocal demandant une disponibilité le 15 août pour les 20 ans de sa fille, un apéro dînatoire et 30 personnes | La transcription atteint l’IA, puis une ligne `VOXIST-<messageId>`, `Téléphone`, `Anniversaire`, `Nouvelle demande`, `Historique_Voxist` | Automatique + essai Make |
| V12 | Appel Voxist « Monsieur Petit, chemin des Crozes », pour définir les besoins du 12 septembre, avec une unique demande Wix active de Daniel Petit à cette date | Rattachement à `WIX-19fae44050c5c754`, conservation du statut, transcription enregistrée, téléphone `06 95 40 81 33`, `relance_a_traiter = TRUE`, `Historique_Voxist`, aucun doublon | Backend + automatique + essai Make |
| V13 | Appel Voxist avec une date correspondant à plusieurs demandes actives, sans autre rapprochement déterminant | Aucune modification ni création ; le message reste à vérifier et n'est pas archivé comme traité | Backend + essai Make |
| V14 | Transcription Voxist contenant « Si vous pouviez me rappeler » avant le pied d'e-mail | La transcription complète, y compris le nom et les coordonnées prononcés après « rappeler », atteint l'IA et est enregistrée | Automatique + essai Make |
| V15 | Vocal Voxist sans transcription, retranscrit depuis l'audio, correspondant à une unique demande active | La demande existante est enrichie (transcription, téléphone appelant, relance à traiter) et conservée ; aucune nouvelle ligne n'est créée, puis l'e-mail est archivé dans `Historique_Voxist` | Backend + automatique + essai Make |
| V16 | Vocal Voxist de « Madame Blanchard », appelant `06 83 78 21 60`, alors qu'une unique demande active de Delphine Blanchon contient `683782160` | Le numéro est normalisé ; le dossier existant est enrichi et apparaît dans `Messages reçus`, sans création d'une seconde ligne malgré le nom divergent | Backend + automatique + essai Make |
| V17 | Vocal Voxist de Madame Leclerc de Grange, appelant `06 07 03 40 37`, demandant des précisions sur un devis déjà envoyé ; l'IA retourne à tort `is_demande=false` mais conserve `statut=À rappeler` et le mot « devis » | Le module 102 exécute le rattachement ; l'unique demande active portant ce numéro est enrichie, apparaît dans `Messages reçus`, sans création de ligne | Automatique + essai Make |
| V18 | Création Voxist transcription ou audio interrompue par un `404` Apps Script / Google Drive temporaire | Trois reprises automatiques à cinq minutes d’intervalle ; une création déjà enregistrée ne produit pas de doublon | Automatique + essai Make |
| V19 | Deux nouveaux vocaux Voxist de M. Borel, téléphone `06 21 66 22 77`, date `19/09/2026`, avec noms, type et transcription divergents | Le second vocal enrichit l'unique dossier actif existant ; aucune seconde ligne, statut conservé, transcription dans `dernier_message_client`, `relance_a_traiter = TRUE` | Backend + automatique + essai Make |

## Email direct

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| E01 | Demande mairie, cocktail, 140 personnes | Une ligne Email, type `Entreprise`, accusé, `Historique_Email` | Essai Make |
| E02 | Mariage demandant formules ou tarifs | Une ligne Email, type `Mariage` | Essai Make |
| E03 | Demande sans mot-clé historique mais contexte client clair | Analyse par l'IA, puis création si qualifiée | Statique + essai Make |
| E04 | Newsletter, fournisseur, facture ou spam arrivé dans Make | Aucune ligne, `Hors_Scope_Make` | Statique + essai Make |
| E05 | `DEVIS VALIDE` | Mise à jour d'un suivi, aucune ligne, aucun accusé, `Historique_Email` | Statique + essai Make |
| E06 | `Re: Devis` avec modification du devis existant | Mise à jour de la demande, aucune ligne, aucun accusé | Statique + essai Make |
| E07 | Ancien fil contenant une nouvelle prestation/date | Nouvelle ligne et accusé | Essai Make |
| E08 | Message rattaché à une demande existante (`count > 0`) | Mise à jour technique puis archivage dans `Historique_Email` | Statique |
| E09 | Email des boîtes internes | Aucune création client | Automatique |
| E10 | Réponse dans un fil existant dont le texte cité contient date, devis ou personnes | Une seule ligne conservée, aucune route nouvelle demande, `Historique_Email` uniquement côté Make | Automatique + essai Make |
| E11 | Nouvelle demande réelle sans adresse exploitable pour l’accusé | Ligne créée puis message archivé dans `Historique_Email`, sans accusé | Automatique + essai Make |
| E12 | Réponse à un devis demandant un supplément de service, l’ajout ou le retrait d’éléments | Mise à jour d’un suivi, aucune ligne, aucun accusé, `Historique_Email` | Statique + essai Make |
| E13 | Bon de commande ou commande validée dans un nouveau fil, envoyé par un portail ou une adresse technique | Si un unique dossier partage le contact identifié et la date de prestation : mise à jour et `Historique_Email`, sans accusé ni nouvelle ligne ; sinon le message reste en boîte de réception pour vérification | Backend + statique + essai Make |
| E14 | Réponse courte à une proposition de rappel, par exemple `Ok pour lundi, plutôt en fin de matinée`, sans date de prestation | Si une unique demande active partage exactement l’email : mise à jour du suivi et `Historique_Email`, sans nouvelle ligne ni accusé ; sinon le message reste en boîte de réception | Backend + statique + essai Make |
| E15 | Email commençant par `Merci pour vos propositions` et demandant de `modifier certaines pièces`, sans rappeler la date | Route de suivi obligatoire même si l’IA retourne `is_followup=false` ; rattachement uniquement si une candidate fiable et unique existe, sinon aucune création et email conservé pour vérification | Backend + automatique + essai Make |
| E16 | Message de Flore de Régis dans un fil déjà connu demandant un devis mis à jour (remplacement et ajouts) | Le fil existant est marqué avec le nouveau message ; aucune nouvelle ligne ni accusé n’est créé | Automatique + essai Make |
| E17 | Conjoint d’une cliente confirme le virement pour la réservation du 25/10/2026 et demande si le couscous comprend les légumes | Rattachement à l’unique demande de Mme De Régis pour cette date, `relance_a_traiter = TRUE`, aucun doublon ni accusé | Automatique + essai Make |

## Tally

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| T01 | Nouvelle soumission `formId = Gx52AQ` | Une ligne `TALLY-<submissionId>`, canal `Réseaux sociaux`, accusé | Statique + essai Make |
| T02 | Soumission déjà connue | Aucune seconde ligne et aucun second accusé | Statique + essai Make |
| T03 | Autre formulaire Tally | Ignoré | Automatique |
| T04 | Anti-doublon | Appel du backend, aucune lecture Google Sheets | Automatique |

## Frontend après traitement Make

| ID | Contrôle | Résultat attendu |
|---|---|---|
| F01 | Nouvelle ligne créée par chaque source | Canal et statut affichés avec les valeurs autorisées |
| F02 | Dates `11/07/2026`, `2028` et plage | Affichage français sans inversion |
| F03 | Lien Gmail | Ouverture avec le libellé correspondant au canal |
| F04 | Passage à `Événement confirmé` | Création ou mise à jour de l'événement Google Calendar |
| F05 | Retour à un statut non confirmé | Suppression de l'événement Calendar existant |
| F06 | Saisie manuelle avec téléphone déjà présent sur une demande active | Aucune création immédiate ; fenêtre listant les fiches candidates |
| F07 | Consultation d'une candidate depuis la fenêtre de rapprochement | Comparaison visible et formulaire manuel intégralement conservé |
| F08 | Enrichissement d'une candidate sélectionnée | Une seule ligne conservée, informations métier complétées, identifiant et champs techniques préservés |
| F09 | Choix `Créer quand même` | Confirmation explicite puis nouvelle ligne distincte |
| F10 | Deux créations concurrentes portant sur la même demande | Recherche et écriture sérialisées ; la seconde opération reçoit la candidate créée par la première |
| F11 | Message client rattaché à une demande, y compris une ancienne fiche sans `url_email_origine` | La fiche ouverte depuis `Messages reçus` permet d'ouvrir le fil et propose `Répondre` à côté de `Marquer comme traité` |
| F12 | Fiche ayant `07 69 89 37 45 / 06 65 30 18 12` | Les deux numéros sont affichés au format français et proposent chacun leur propre lien ou bouton `Appeler` |

## Procédure d'exécution

1. Exporter et conserver les scénarios Make actifs.
2. Importer les nouveaux blueprints comme scénarios distincts et désactivés.
3. Reconnecter les connexions Gmail, Sheets, OpenAI, Tally et Apps Script si Make le demande.
4. Exécuter chaque cas avec des données de test identifiables.
5. Vérifier simultanément l'historique Make, Gmail, Google Sheets et le dashboard.
6. N'activer le nouveau scénario qu'après validation de tous les cas critiques.
7. Conserver l'ancien scénario désactivé pendant la période de retour arrière.
