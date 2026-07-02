# Filtres Gmail

Dernière mise à jour : 02/07/2026.

Ce fichier contient la configuration cible à appliquer manuellement dans Gmail. Gmail permet de tester le critère avant de créer le filtre ; cette vérification est obligatoire pour les filtres 4 et 5.

Le fichier prêt à importer est `config/gmail/chez-papi-filters.xml`.

## Import direct dans Gmail

1. Ouvrir Gmail sur ordinateur, puis `Paramètres` > `Voir tous les paramètres` > `Filtres et adresses bloquées`.
2. En bas de la page, cliquer sur `Importer des filtres`.
3. Sélectionner `config/gmail/chez-papi-filters.xml`, puis créer les six filtres proposés.
4. Vérifier que `support@efficy-conseil.fr` est toujours une adresse de transfert validée dans Gmail.
5. Supprimer ensuite les anciens filtres indiqués dans la section « Filtres à supprimer ou remplacer » : l'import ne les remplace pas automatiquement.

L'import n'applique pas ces filtres aux anciens messages. Les libellés `0 - Récap_Quotidien`, `Alerte_Make` et `Hors_Scope_Gmail` doivent exister dans le compte.

## Configuration cible

### 1. Récapitulatif quotidien

Critère :

```text
from:demande.chezpapimaisongourmande@gmail.com subject:"[Chez Papi] Récapitulatif"
```

Actions : ignorer la boîte de réception ; appliquer `0 - Récap_Quotidien`.

### 2. Alertes Make critiques

Critère :

```text
from:make.com {error warning disabled failed scenario credits usage limit quota subscription billing "credit usage"}
```

Actions : appliquer `Alerte_Make` ; transférer à `support@efficy-conseil.fr`.

Ce filtre regroupe les deux anciens filtres d'alerte qui avaient les mêmes actions.

### 3. Notifications techniques Make et OpenAI

Critère :

```text
{from:make.com from:mailer.make.com from:noreply@make.com from:openai.com from:noreply@openai.com}
```

Actions : ignorer la boîte de réception ; appliquer `Alerte_Make`.

Le chevauchement avec le filtre 2 est volontaire : une alerte critique est à la fois transférée et rangée dans `Alerte_Make`.

### 4. Notifications système Google

Critère :

```text
{from:google.com from:googlemail.com from:accounts.google.com from:no-reply@accounts.google.com from:noreply@google.com from:workspace-noreply@google.com}
```

Actions : ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail`.

### 5. Newsletters hors sources métier

Critère :

```text
-from:message@voxist.com -from:notifications@wix-forms.com -from:demande.chezpapimaisongourmande@gmail.com -from:chezpapimaisongourmande@gmail.com {unsubscribe désabonnement "se désabonner" newsletter "view in browser" "voir dans le navigateur"}
```

Actions : ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail`.

Les termes trop génériques `promotion`, `offre spéciale` et `publicité` sont supprimés : ils peuvent apparaître dans une demande client légitime. Les quatre sources métier sont exclues explicitement.

### 6. Newsletter METRO

Critère :

```text
from:email.metro.fr
```

Actions : ignorer la boîte de réception ; marquer comme lu ; appliquer `Hors_Scope_Gmail`.

## Filtres à supprimer ou remplacer

- Remplacer les deux anciens filtres Make « erreurs » et « crédits » par le filtre 2.
- Remplacer l'ancien filtre Google sans opérateur `from:` par le filtre 4. L'ancien critère pouvait correspondre à du texte présent dans le corps d'un email.
- Remplacer les deux anciens filtres newsletter par le filtre 5. L'ancien filtre général annulait de fait la tentative d'exclusion Wix/Voxist.
- Supprimer le filtre général basé sur `facture`, `reçu`, `paiement`, `prélèvement`, `échéance` ou `invoice`. Ces mots appartiennent aussi à de vraies conversations commerciales. Créer ensuite des filtres par expéditeur connu pour les factures réellement hors périmètre.
- Conserver le filtre METRO sous la forme du filtre 6.

## Ordre d'application

1. Créer les six nouveaux filtres sans appliquer les actions aux conversations existantes.
2. Tester les critères 4 et 5 dans la barre de recherche Gmail et vérifier qu'aucune demande Wix, Voxist ou client n'apparaît.
3. Supprimer les anciens filtres remplacés.
4. Envoyer un email de test pour chaque source métier et vérifier qu'il reste visible pour Make.
5. Vérifier qu'une alerte Make critique reçoit `Alerte_Make` et est transférée une seule fois.

## Principes de maintenance

- Utiliser systématiquement `from:` pour filtrer un expéditeur ou un domaine.
- Utiliser `{...}` pour exprimer un `OR` entre plusieurs expéditeurs ou termes.
- Ne jamais classer automatiquement les emails clients à partir de mots administratifs génériques.
- Toute source surveillée par Make doit être exclue explicitement des filtres de contenu.
- Les libellés visibles sur un fil Gmail peuvent provenir de messages différents du même fil.

## État précédent archivé

La configuration relevée avant cette rationalisation comportait neuf filtres : deux alertes Make séparées, un filtre Google sans `from:`, deux filtres newsletter qui se chevauchaient et un filtre administratif général. Elle est conservée dans l'historique Git antérieur au présent fichier.
