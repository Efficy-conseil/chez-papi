# Inventaire des filtres Gmail

Dernière transcription : 02/07/2026.

Ce fichier décrit l'état déclaré des filtres configurés manuellement dans Gmail. Il ne configure pas Gmail automatiquement. Toute modification dans Gmail doit être reportée ici et vérifiée avec les scénarios Make.

| N° | Critère Gmail | Actions |
|---:|---|---|
| 1 | `from:(demande.chezpapimaisongourmande@gmail.com) subject:([Chez Papi] Récapitulatif)` | Ignorer la boîte de réception ; appliquer `0 - Récap_Quotidien` |
| 2 | `from:(make.com) (error OR warning OR disabled OR failed OR scenario)` | Appliquer `Alerte_Make` ; transférer à `support@efficy-conseil.fr` |
| 3 | `from:(make.com) (credits OR usage OR limit OR quota OR subscription OR billing OR "credit usage")` | Appliquer `Alerte_Make` ; transférer à `support@efficy-conseil.fr` |
| 4 | `(google.com OR googlemail.com OR accounts.google.com OR no-reply@accounts.google.com OR noreply@google.com OR workspace-noreply@google.com)` | Ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail` |
| 5 | `(make.com OR mailer.make.com OR noreply@make.com OR openai.com OR noreply@openai.com)` | Ignorer la boîte de réception ; appliquer `Alerte_Make` |
| 6 | `(unsubscribe OR désabonnement OR se désabonner OR newsletter OR promotion OR offre spéciale OR publicité OR "view in browser" OR "voir dans le navigateur")` | Ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail` |
| 7 | `(facture OR reçu OR paiement OR prélèvement OR échéance OR "votre facture" OR "payment receipt" OR invoice)` | Ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail` |
| 8 | `from:(email.metro.fr)` | Ignorer la boîte de réception ; marquer comme lu ; appliquer `Hors_Scope_Gmail` |
| 9 | `from:(-message@voxist.com -notifications@wix-forms.com) (unsubscribe OR désabonnement OR se désabonner OR newsletter OR promotion OR offre spéciale OR publicité OR "view in browser" OR "voir dans le navigateur")` | Ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail` |

## Points de vigilance constatés

- Le filtre 6 est plus large que le filtre 9 et s'applique avant toute exception explicite : Wix ou Voxist peuvent donc recevoir `Hors_Scope_Gmail` si leur contenu contient une formule de désabonnement ou d'ouverture dans le navigateur.
- La syntaxe d'exclusion fiable est `-from:message@voxist.com -from:notifications@wix-forms.com (...)`. La forme du filtre 9 doit être corrigée dans Gmail avant de servir de protection.
- Les filtres 6 et 7 reposent sur des mots présents dans le contenu. Une réponse client peut reprendre ces mots dans le texte cité d'un fil et cumuler `Hors_Scope_Gmail` avec un label historique.
- Le filtre 7 peut masquer une demande métier légitime concernant une facture ou un paiement.
- Gmail affiche au niveau du fil les labels accumulés par ses différents messages. La présence de plusieurs labels dans la conversation ne signifie donc pas nécessairement qu'un seul message a suivi plusieurs routes Make.

## Correction Gmail recommandée

Remplacer le filtre 6 par le critère suivant, puis supprimer le filtre 9 devenu redondant :

```text
-from:message@voxist.com -from:notifications@wix-forms.com (unsubscribe OR désabonnement OR "se désabonner" OR newsletter OR promotion OR "offre spéciale" OR publicité OR "view in browser" OR "voir dans le navigateur")
```

Conserver temporairement le filtre 7 sous surveillance, puis préférer à terme des expéditeurs connus ou des catégories Gmail à une liste de mots générale.
