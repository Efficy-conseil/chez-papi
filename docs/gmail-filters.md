# Filtres Gmail

Dernière mise à jour : 11/09/2026.

Ce fichier contient la configuration cible à appliquer manuellement dans Gmail. Gmail permet de tester le critère avant de créer le filtre ; cette vérification est obligatoire pour les filtres 4 et 5.

Le fichier complet prêt à importer est `gmail_filters/chez-papi-filters.xml` (sept filtres). Pour ajouter la protection Mailinblack à une configuration existante, utiliser uniquement `gmail_filters/chez-papi-mailinblack-update.xml` (deux filtres).

## Mise à jour Mailinblack sur une configuration existante

État : fichiers préparés et vérifiés localement ; import et activation Gmail/Make à confirmer manuellement. Cette correction ne répare pas le regroupement des conversations Gmail ni les données historiques.

1. Exporter les filtres Gmail actuels et conserver l'export pour retour arrière. Créer le libellé `Authentification_À_traiter` dans la boîte qui reçoit les invitations (celle surveillée par Make si elle est différente).
2. Tester `from:invitations.mailinblack.com` dans Gmail : inspecter l'expéditeur de chaque message correspondant, car un résultat peut afficher toute une conversation avec des réponses clientes.
3. Dans `Paramètres` > `Voir tous les paramètres` > `Filtres et adresses bloquées` > `Importer des filtres`, choisir `gmail_filters/chez-papi-mailinblack-update.xml`. Créer les deux filtres sans cocher l'application aux conversations existantes.
4. Supprimer uniquement l'ancienne version du filtre général « Newsletters hors sources métier », celle qui ne contient pas `-from:invitations.mailinblack.com`. Garder la nouvelle version et les autres filtres. L'import ajoute des filtres ; il ne remplace pas les anciens. Vérifier aussi qu'aucun ancien filtre personnalisé n'archive ces invitations.
5. Exporter le scénario Make actif pour retour arrière, puis importer `make/Integration Email - Wix - Voxist.blueprint.json` dans un scénario distinct désactivé. Reconnecter les comptes si nécessaire et vérifier la recherche du module 1 ainsi que le filtre avant le module 60 décrits ci-dessous.
6. Tester E26 à E29 de `docs/make-regression-matrix.md` avec des données de test et rejouer les chemins critiques Wix, Voxist, Email et Tally selon la procédure de cette matrice. Pour E27, utiliser un scénario de test isolé avec connexions de test et neutraliser temporairement l'exclusion du déclencheur, puis la rétablir avant activation. Ne pas rejouer l'incident réel en production.
7. Après validation, désactiver l'ancien scénario avant d'activer le nouveau pour éviter un double traitement. Conserver l'ancien scénario désactivé pour retour arrière.

Résultat attendu : les prochaines invitations restent dans la boîte de réception, non marquées comme lues par les filtres ou Make, avec `Authentification_À_traiter`. Elles ne créent ni fiche, ni relance, ni accusé. Une vraie réponse de Julie Morel ou de Caroline Cadet continue son traitement commercial normal.

Dans Make, le déclencheur ajoute `-from:invitations.mailinblack.com`. Le filtre commun avant le module 60 compare `lower(trim(last(split(ifempty(1.fromEmail; ""); "@"))))` à `invitations.mailinblack.com` avec l'opérateur « différent de ». La comparaison porte sur le domaine exact de l'adresse de l'expéditeur, indépendamment de l'objet, du texte cité, de l'IA et du fil Gmail. Si une invitation atteint malgré tout le déclencheur, elle s'arrête avant tout appel backend, traitement commercial ou archivage. Le libellé est posé par Gmail, pas par Make.

La correction cible les invitations émises depuis `invitations.mailinblack.com`. Les autres messages automatiques ne sont pas exclus globalement : les notifications Wix/Voxist et les bons de commande techniques doivent conserver leurs routes métier.

## Import direct dans Gmail

1. Ouvrir Gmail sur ordinateur, puis `Paramètres` > `Voir tous les paramètres` > `Filtres et adresses bloquées`.
2. En bas de la page, cliquer sur `Importer des filtres`.
3. Sélectionner `gmail_filters/chez-papi-filters.xml`, puis créer les sept filtres proposés (installation complète seulement ; pour une boîte déjà configurée, suivre la mise à jour ciblée ci-dessus).
4. Vérifier que `support@efficy-conseil.fr` est toujours une adresse de transfert validée dans Gmail.
5. Supprimer ensuite les anciens filtres indiqués dans la section « Filtres à supprimer ou remplacer » : l'import ne les remplace pas automatiquement.

Ne pas cocher l'application aux conversations existantes lors de l'import. Les libellés `0 - Récap_Quotidien`, `Alerte_Make`, `Hors_Scope_Gmail` et `Authentification_À_traiter` doivent exister dans le compte.

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
-from:invitations.mailinblack.com -from:message@voxist.com -from:notifications@wix-forms.com -from:demande.chezpapimaisongourmande@gmail.com -from:chezpapimaisongourmande@gmail.com {unsubscribe désabonnement "se désabonner" newsletter "view in browser" "voir dans le navigateur"}
```

Actions : ignorer la boîte de réception ; appliquer `Hors_Scope_Gmail`.

Les termes trop génériques `promotion`, `offre spéciale` et `publicité` sont supprimés : ils peuvent apparaître dans une demande client légitime. Les quatre sources métier et les invitations Mailinblack sont exclues explicitement. Cette dernière exclusion évite qu'une invitation soit archivée à cause de son contenu malgré le filtre 7.

### 6. Newsletter METRO

Critère :

```text
from:email.metro.fr
```

Actions : ignorer la boîte de réception ; marquer comme lu ; appliquer `Hors_Scope_Gmail`.

### 7. Invitations Mailinblack à traiter

Critère :

```text
from:invitations.mailinblack.com
```

Action : appliquer uniquement `Authentification_À_traiter`. Ne pas archiver, supprimer, transférer ni marquer comme lu. Ces invitations peuvent signaler qu'un email envoyé attend l'authentification de son expéditeur avant sa délivrance. La validation reste manuelle ; aucune réponse automatique ni ouverture automatique du lien n'est prévue.

## Filtres à supprimer ou remplacer

- Remplacer les deux anciens filtres Make « erreurs » et « crédits » par le filtre 2.
- Remplacer l'ancien filtre Google sans opérateur `from:` par le filtre 4. L'ancien critère pouvait correspondre à du texte présent dans le corps d'un email.
- Remplacer les deux anciens filtres newsletter par le filtre 5. L'ancien filtre général annulait de fait la tentative d'exclusion Wix/Voxist.
- Supprimer le filtre général basé sur `facture`, `reçu`, `paiement`, `prélèvement`, `échéance` ou `invoice`. Ces mots appartiennent aussi à de vraies conversations commerciales. Créer ensuite des filtres par expéditeur connu pour les factures réellement hors périmètre.
- Conserver le filtre METRO sous la forme du filtre 6.

## Ordre d'application

1. Pour une installation complète, créer les sept filtres sans appliquer les actions aux conversations existantes. Pour la seule correction Mailinblack, suivre la procédure ciblée en début de document.
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
