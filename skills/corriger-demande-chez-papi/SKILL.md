---
name: corriger-demande-chez-papi
description: Préparer et appliquer une correction ciblée dans les demandes Chez Papi via le backend Apps Script. Utiliser lorsqu’une demande existante doit être enrichie ou corrigée (coordonnées, message reçu, relance, lien ou identifiants Gmail) sans copier-coller dans Google Sheets. Exiger systématiquement une confirmation explicite de l’utilisatrice juste avant toute écriture.
---

# Corriger une demande Chez Papi

Utiliser cette compétence pour une correction ponctuelle d’une demande existante. Ne jamais l’utiliser pour créer une demande, supprimer une ligne ou modifier une donnée sans accord explicite au moment de l’écriture.

## Préparer la correction

1. Lire `docs/product-contract.md` et, si la correction vient d’un email ou de Make, `docs/make-regression-matrix.md`.
2. Recueillir l’identifiant de la demande ou les éléments de rapprochement disponibles : email, téléphone, date, nom, lieu, type et statut.
3. Déterminer une seule demande cible. Avec plusieurs candidates ou aucune candidate fiable, s’arrêter et demander une précision ; ne pas écrire.
4. Préparer un diff concis : demande cible, valeurs actuelles connues, valeurs proposées, champs conservés et raison du rapprochement.
5. Préserver le statut commercial, l’identifiant, le canal, la date de réception et les champs techniques non concernés, sauf demande explicite contraire.

## Confirmation obligatoire

Avant l’appel d’écriture, demander une confirmation explicite et isolée qui indique :

- l’`id_demande` ou les critères exacts qui désignent la ligne ;
- chaque champ à modifier et sa nouvelle valeur ;
- les conséquences métier, notamment `relance_a_traiter = TRUE` lorsque la correction correspond à un message client.

Ne pas considérer comme confirmation une intention générale (« corrige la demande », « fais-le systématiquement ») exprimée avant la présentation du diff. Attendre une réponse claire telle que « oui, applique cette correction ».

## Écrire via le backend

Après confirmation uniquement :

1. Préférer l’action backend qui correspond au cas :
   - `updateExistingDemandFollowup` pour rattacher un message client à une demande existante ;
   - l’action dashboard `update` si une session authentifiée permet une correction ciblée par `id_demande`.
2. Lire l’URL du backend dans `chez-papi/app.js`. Réutiliser les mécanismes d’authentification déjà configurés par le projet ; ne jamais afficher ni demander de secret dans la conversation.
3. Envoyer uniquement les champs nécessaires. Pour un message reçu, renseigner au minimum `dernier_email_recu_le`, `dernier_message_client` et `relance_a_traiter = true`; ajouter téléphone, identifiants Gmail et `url_email_origine` seulement s’ils sont connus.
4. Pour un rapprochement par suivi, ne continuer que si le backend renvoie exactement une candidate et `updated: true`. Une réponse `existing_demand_not_found` ou `existing_demand_ambiguous` interdit toute nouvelle écriture manuelle non validée.

## Vérifier et rendre compte

Contrôler la réponse backend : `ok: true`, `updated: true`, `id_demande` attendu et, si présent, numéro de ligne. Signaler clairement les champs qui n’ont pas pu être complétés, par exemple un lien Gmail rétroactif sans identifiant de message ou de fil.

Ne pas modifier les blueprints Make ni le code du projet pour une correction ponctuelle, sauf si l’utilisatrice demande aussi une correction durable de l’automatisation.
