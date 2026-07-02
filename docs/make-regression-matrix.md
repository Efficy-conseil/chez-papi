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
| C07 | Réponse anti-doublon sans champ `count` ou inexploitable | Aucune création ; exécution en erreur visible, message conservé pour reprise | Automatique + essai Make |

## Wix

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| W01 | Nouveau formulaire complet | Une ligne `WIX-<messageId>`, canal `Site Internet`, statut `Nouvelle demande`, accusé, `Historique_Wix` | Essai Make |
| W02 | Même formulaire à moins de 15 minutes, second plus complet | Une ligne enrichie, aucun second accusé | Statique + essai Make |
| W03 | Même message Wix déjà traité (`count > 0`) | Aucun doublon, archivage explicite dans `Historique_Wix` | Statique |
| W04 | Réponse client dans un fil Wix | Mise à jour de la demande existante, relance à traiter, aucun accusé | Statique + essai Make |
| W05 | Formulaire Wix non qualifié ou incomplet | Aucune création erronée ; message classé ou anomalie visible | Essai Make |
| W06 | Email Wix | Ne passe jamais dans Voxist ou Email direct | Automatique |

## Voxist

| ID | Entrée | Résultat attendu | Validation |
|---|---|---|---|
| V01 | Transcription avec renseignements, prestations, formules, quarantaine, 18 ans, 12 septembre | Une ligne `VOXIST-<messageId>`, `Téléphone`, `Anniversaire`, `Nouvelle demande`, `Historique_Voxist` | Statique + essai Make |
| V02 | Nouveau vocal dans un fil Gmail déjà utilisé | Contrôle uniquement de `VOXIST-<messageId>`, création autorisée | Backend + essai Make |
| V03 | Même vocal déjà traité (`count > 0`) | Aucun doublon, archivage explicite dans `Historique_Voxist` | Statique |
| V04 | Vocal sans transcription exploitable | Téléchargement et transcription audio, puis même qualification | Statique + essai Make |
| V05 | Vocal personnel hors traiteur/événement | Aucune ligne, `Hors_Scope_Make` | Statique + essai Make |
| V06 | Numéro appelant différent de la transcription | Numéro appelant conservé en priorité | Essai Make |
| V07 | Email Voxist | Ne passe jamais dans Wix, Email direct ou relance email | Automatique |

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

## Procédure d'exécution

1. Exporter et conserver les scénarios Make actifs.
2. Importer les nouveaux blueprints comme scénarios distincts et désactivés.
3. Reconnecter les connexions Gmail, Sheets, OpenAI, Tally et Apps Script si Make le demande.
4. Exécuter chaque cas avec des données de test identifiables.
5. Vérifier simultanément l'historique Make, Gmail, Google Sheets et le dashboard.
6. N'activer le nouveau scénario qu'après validation de tous les cas critiques.
7. Conserver l'ancien scénario désactivé pendant la période de retour arrière.
