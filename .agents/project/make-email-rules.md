# Règles Make et emails

## Classification

Classer `is_demande=true` quand le dernier message demande une disponibilité, un devis ou une prestation alimentaire pour un événement, un buffet, un cocktail, un repas, une réception ou un groupe.

Classer `is_followup=true` quand le dernier message concerne une demande existante :

- modification de devis ;
- remplacement de pièces salées/sucrées ;
- validation après nouvelle version ;
- relance sur devis envoyé ;
- organisation d'un appel au sujet d'un devis déjà en cours.

Classer hors scope uniquement pour newsletter, publicité, fournisseur, facture, spam, message personnel ou contenu sans lien avec une prestation traiteur.

## Doublons

- Ne pas se fier uniquement au `threadId` Gmail.
- Si `is_followup=true`, rattacher par `email_client + date_evenement` via Apps Script.
- Si une vraie nouvelle demande arrive dans un vieux fil, créer une nouvelle ligne avec un ID basé sur le message Gmail.
- Ne pas envoyer d'accusé de réception automatique pour une modification de devis existant.

## Prompts Make

- Toujours demander à l'IA d'analyser le message le plus récent avant l'historique cité.
- Exiger un JSON court, sans markdown, avec champs absents vides ou `null`.
- Ajouter un exemple obligatoire quand un cas réel a été mal classé.
- Ne pas demander à l'IA de résoudre seule l'idempotence : ajouter une protection Apps Script quand une erreur peut créer des doublons.

## Vérifications blueprint

- Valider le JSON avec `python3 -m json.tool`.
- Inspecter les filtres autour des modules `openai`, `json:ParseJSON`, `google-sheets:addRow`, `google-email:moveAnEmail`, `http:ActionSendData`.
- Vérifier que les IDs de modules ajoutés ne dupliquent pas un ID existant.
