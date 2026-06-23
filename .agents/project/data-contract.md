# Contrat de données

## Statuts autorisés

- `Nouvelle demande`
- `À rappeler`
- `Devis à préparer`
- `Devis envoyé`
- `Événement confirmé`
- `Événement terminé`
- `Perdu / Sans suite`

Ne pas introduire de nouveau statut sans mettre à jour Apps Script, frontend, filtres, compteurs, agenda et historiques.

## Canaux autorisés

- `Téléphone`
- `Email`
- `Site Internet`
- `Réseaux sociaux`
- `Saisie manuelle`

## Colonnes métier principales

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

## Colonnes de suivi email

- `gmail_thread_id`
- `gmail_message_id`
- `wix_form_fingerprint`
- `dernier_email_recu_le`
- `dernier_message_client`
- `nb_relances_client`
- `relance_a_traiter`

## Règles métier

- Un changement de devis demandé par un client existant est un suivi, pas une nouvelle demande.
- Une nouvelle demande claire dans un ancien fil doit créer une demande distincte.
- Une demande venant d'une mairie, collectivité, organisme public, association ou société est généralement `Entreprise`.
- Les dates doivent rester normalisées en `JJ/MM/AAAA` ou `JJ/MM/AAAA au JJ/MM/AAAA`.
- Les heures doivent rester en `HH:MM`.
- Les URLs métier acceptées côté backend sont Gmail et Google Drive.
