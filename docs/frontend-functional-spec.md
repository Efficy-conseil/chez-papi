# Chez Papi — Spécification fonctionnelle du frontend

Statut : référence fonctionnelle du frontend de production actuel.

Fichiers concernés : `chez-papi/index.html`, `chez-papi/app.js`, `chez-papi/styles.css`, `chez-papi/sw.js` et `chez-papi/manifest.json`.

Cette spécification sert à préserver les fonctionnalités pendant les modifications, à vérifier leur exhaustivité et à permettre une future réimplémentation, notamment en fournissant ce document à un outil comme Lovable.

Les prototypes de `chez-papi/prototypes/` ne définissent pas le comportement de référence. Ils utilisent cependant la même URL Apps Script et les mêmes données de production que le frontend principal.

## 1. Finalité

Le frontend est un tableau de bord de suivi des demandes et prestations d'un traiteur. Il permet de :

- consulter les demandes reçues ;
- suivre leur progression commerciale ;
- créer, compléter, modifier ou supprimer une fiche ;
- changer rapidement un statut ;
- suivre les événements confirmés et les tâches associées ;
- consulter un agenda mensuel ;
- rechercher, filtrer et exporter l'historique ;
- analyser l'origine et la conversion des demandes ;
- ouvrir les ressources Gmail et Google Drive associées ;
- déclencher via le backend la création ou la mise à jour d'un événement Google Calendar lorsqu'une demande passe au statut `Événement confirmé`.

Les créations automatiques Wix, Voxist, Email et Tally sont réalisées en amont par Make et Apps Script. Le frontend affiche et modifie le résultat de ces traitements.

## 2. Authentification et connexion

- Un écran de connexion bloque le tableau de bord au chargement.
- L'utilisateur saisit un email et un mot de passe.
- Les identifiants sont validés par le backend et joints à chaque action authentifiée.
- Les champs vides et les identifiants invalides produisent des messages distincts.
- Les identifiants sont conservés dans le stockage local du navigateur pour les appels suivants et la synchronisation en arrière-plan.
- Le bouton `Déconnexion` efface les identifiants locaux et réaffiche l'écran de connexion.
- L'accueil indique une synchronisation réussie, son ancienneté ou un état hors ligne.
- Les erreurs réseau, réponses non JSON et autorisations Google manquantes sont détectées et signalées.

## 3. Navigation et responsive

La navigation comprend cinq sections :

1. `Accueil` ;
2. `Demandes en cours` ;
3. `Événements confirmés` ;
4. `Agenda` ;
5. `Historique`.

Sur ordinateur, ces sections sont accessibles dans une barre latérale. Sur mobile, elles sont reprises dans une barre inférieure. La barre latérale mobile dispose d'un bouton de fermeture et d'un fond d'obscurcissement.

Lors d'un changement de section :

- l'état actif est synchronisé entre les deux navigations ;
- la zone de contenu revient en haut ;
- l'agenda revient au mois courant lorsqu'il est ouvert ;
- la barre horizontale de l'historique est recalculée.

Les tableaux restent défilables horizontalement. L'historique possède deux barres de défilement horizontales synchronisées, en haut et en bas du tableau.

## 4. Règles de données transverses

### 4.1 Canaux

Les variantes historiques sont normalisées vers :

- `Téléphone` ;
- `Email` ;
- `Site Internet` ;
- `Réseaux sociaux` ;
- `Saisie manuelle`.

### 4.2 Statuts

Les valeurs affichées sont :

- `Nouvelle demande` ;
- `À rappeler` ;
- `En attente de réponse` ;
- `Devis à préparer` ;
- `Devis envoyé` ;
- `Événement confirmé` ;
- `Événement terminé` ;
- `Perdu / Sans suite` ;
- `Refusé / Complet`.

Les anciennes variantes connues, par exemple `Nouveau`, `Contacté`, `Signé`, `Prestation en cours` ou `Sans suite`, sont converties vers ces valeurs. Un statut vide devient `Nouvelle demande`.

### 4.3 Déduplication d'affichage

- Les lignes partageant le même `id_demande` sont dédupliquées.
- La ligne ayant le statut le plus avancé est conservée.
- À statut égal, la modification la plus récente est conservée.
- Les lignes sans identifiant ne sont pas éliminées automatiquement.

### 4.4 Dates et heures

- Les dates sont interprétées localement, sans conversion implicite en format américain.
- Une date complète est affichée en `JJ/MM/AAAA`.
- Une plage est affichée en `JJ/MM/AAAA au JJ/MM/AAAA`.
- Une année seule reste une année seule.
- Les numéros de série Google Sheets sont pris en charge.
- Les tris utilisent la date de début.
- La date de fin d'une plage sert à déterminer si l'événement est passé.
- Les heures valides sont affichées en `HH:MM`.

### 4.5 Coordonnées et liens

- Les numéros français sont normalisés lorsque possible et deviennent des liens `tel:`. Lorsqu'une fiche contient plusieurs numéros séparés par ` / `, chacun possède son propre lien et sa propre action `Appeler` dans la fiche détaillée.
- Les emails deviennent des liens `mailto:` ou ouvrent Gmail.
- Le lien Gmail choisit le libellé attendu selon le canal : Wix, Voxist ou Email.
- Les liens Drive sont ouverts dans un nouvel onglet.
- Les textes et attributs issus des données sont échappés.
- Les URL sont limitées aux domaines Gmail et Drive autorisés selon le champ.

### 4.6 Informations manquantes

Une fiche est signalée comme incomplète lorsque :

- téléphone et email sont tous les deux absents ;
- le lieu est absent ;
- le nombre de convives est absent ou égal à zéro.

Un badge est affiché dans les listes concernées. La fiche détaille les champs manquants.

### 4.7 Passage automatique en terminé

Une demande `Événement confirmé` dont la date de fin est passée est automatiquement mise à jour en `Événement terminé`. La modification est envoyée au backend et propagée aux autres onglets ouverts.

### 4.8 Mise à jour de statut

- Un changement de statut depuis le dashboard met à jour immédiatement les listes, compteurs et cartes de l'onglet courant après confirmation du backend.
- Il ne déclenche pas de rechargement complet des demandes ; les autres onglets ouverts reçoivent une synchronisation silencieuse.
- Le backend retourne les champs techniques éventuellement complétés, notamment `en_attente_reponse_depuis`.

## 5. Accueil

### 5.1 Commandes

- Un bouton permet d'actualiser les données.
- Un bouton `Nouvel événement` ouvre le formulaire de création.
- Un indicateur présente l'état et l'ancienneté de la synchronisation.

### 5.2 Indicateurs cliquables

Six indicateurs affichent le nombre de dossiers actifs :

- nouvelles demandes ;
- demandes à rappeler ;
- demandes en attente de réponse ;
- messages reçus à traiter ;
- devis à préparer ;
- événements confirmés.

Chaque indicateur ouvre une fenêtre détaillée. Les lignes de cette fenêtre ouvrent la fiche, et le statut peut y être modifié directement. Le détail `À rappeler` affiche également le téléphone ; le détail `En attente de réponse` affiche la colonne `Depuis` avec le nombre de jours écoulés depuis la proposition d'appel ; le nombre est mis en évidence à partir de sept jours. Le détail `Messages reçus` regroupe les demandes dont `relance_a_traiter` est vrai, les trie par date de dernier message décroissante et affiche un extrait du message sans remplacer leur statut commercial. Le détail `Devis à préparer` affiche le budget.

Lorsqu'un dossier passe au statut `En attente de réponse`, le backend renseigne `en_attente_reponse_depuis`. La carte d'accueil affiche uniquement le nombre total de dossiers dans cet état ; la colonne `Depuis` de la fenêtre détaillée signale les attentes de sept jours ou plus.

Lorsqu'un échange est rattaché à une demande existante, une étoile discrète `★` apparaît à côté du client dans les listes actives. Elle dépend de `relance_a_traiter`, indépendamment du statut : une demande peut donc être simultanément `En attente de réponse`, `Devis envoyé` ou `Événement confirmé` et avoir un nouveau message.

### 5.3 Dernières demandes

- Affiche initialement dix demandes actives aux statuts `Nouvelle demande`, `À vérifier`, `À rappeler` ou `En attente de réponse`.
- Trie les demandes par date de réception décroissante.
- Affiche date d'événement, client, résumé, ancienneté de réception et statut.
- Colore l'ancienneté selon qu'elle est récente, à surveiller ou ancienne.
- Signale les informations manquantes.
- Signale par une étoile les nouveaux messages clients à traiter.
- Permet d'ouvrir la fiche et de modifier le statut.
- Un libellé `Voir plus…` en bas de section permet d'en afficher dix de plus à chaque clic.
- Le lien `Voir tout` ouvre la section complète correspondante.

### 5.4 Demandes en cours

- Affiche initialement dix dossiers `Devis à préparer` ou `Devis envoyé`.
- Trie les dossiers par date d'événement croissante.
- Affiche date, client et statut.
- Signale par une étoile les nouveaux messages clients à traiter.
- Un libellé `Voir plus…` en bas de section permet d'en afficher dix de plus à chaque clic.
- Le lien `Voir tout` ouvre la section complète correspondante.
- Met en évidence la proximité de la date : moins de 7 jours puis de 7 à 30 jours pour les demandes ordinaires ; mise en gras pour les événements `Entreprise`.

### 5.5 Événements confirmés

- Affiche initialement dix événements confirmés non passés.
- Trie les événements par date croissante.
- Affiche date, client et statut.
- Signale par une étoile les nouveaux messages clients à traiter.
- Un libellé `Voir plus…` en bas de section permet d'en afficher dix de plus à chaque clic.
- Le lien `Voir tout` ouvre la section complète correspondante.

## 6. Demandes en cours — pipeline

Le pipeline contient les statuts commerciaux actifs : `Nouvelle demande`, `À vérifier`, `À rappeler`, `En attente de réponse`, `Devis à préparer` et `Devis envoyé`. `À vérifier` est affiché avec l'icône `❓` pour attirer l'attention.

Les dossiers sont répartis dans quatre colonnes :

1. `Entreprise` : tous les événements de type Entreprise, quelle que soit leur date ;
2. `Dans moins de 7j` : événements non-Entreprise à moins de sept jours ;
3. `Dans moins de 30j` : événements non-Entreprise entre sept et trente jours ;
4. `Autres` : dates plus éloignées, absentes ou non interprétables.

Les cartes sont triées par date croissante dans chaque colonne et affichent :

- client ;
- type et nombre de convives ;
- date et heure ;
- téléphone et email cliquables ;
- icônes Gmail et Drive si disponibles ;
- ancienneté de réception pour les premières étapes ;
- avertissement d'informations manquantes ;
- étoile de nouveau message lorsque `relance_a_traiter` est vrai ;
- sélecteur de statut.

Un clic sur la carte ouvre la fiche. Les clics sur coordonnées, liens ou statut n'ouvrent pas la fiche par erreur.

## 7. Événements confirmés

- Affiche uniquement les événements `Événement confirmé` non passés.
- Trie les prestations par date croissante.
- Affiche client, résumé, date, statut, coordonnées, liens Gmail/Drive et l'étoile de nouveau message lorsqu'elle s'applique.
- Permet l'ouverture de la fiche et le changement rapide de statut.

Chaque prestation possède une liste de tâches. Cette fonctionnalité devra être réévaluée ultérieurement selon l'usage réel du client :

- ajout par le bouton `+` ou la touche Entrée ;
- tâche cochable et décochable ;
- suppression individuelle ;
- conservation dans le stockage local du navigateur.

Ces tâches ne sont ni partagées entre utilisateurs, ni enregistrées dans Google Sheets. Elles sont actuellement indexées par numéro de ligne et non par identifiant métier.

## 8. Agenda

- Affiche les événements du mois sélectionné dans un tableau.
- Permet de naviguer au mois précédent ou suivant.
- Le titre du mois ouvre un sélecteur direct mois/année.
- Le sélecteur permet de parcourir les années.
- L'ouverture de la section ramène au mois courant.
- Les événements sont triés chronologiquement.
- Les colonnes sont : date, client, type, lieu, couverts, budget et statut.
- Le type `Entreprise` possède un style distinct.
- Le statut peut être modifié directement.
- Un clic ouvre la fiche.

Pour les dates futures et la date du jour, tous les statuts non clos sont visibles. Pour les dates passées, seuls `Événement confirmé` et `Événement terminé` sont affichés. `Perdu / Sans suite` et `Refusé / Complet` sont toujours exclus.

Une année seule ou une date non interprétable n'est pas positionnée dans un mois.

## 9. Historique

### 9.1 Vue liste

La liste contient toutes les demandes, pas seulement les dossiers terminés. Les colonnes sont :

- date et heure ;
- client ;
- type ;
- lieu ;
- couverts ;
- budget ;
- statut ;
- email ;
- téléphone ;
- notes.

Les notes sont tronquées visuellement à quarante caractères mais restent accessibles en infobulle. Un clic ouvre la fiche et le statut est modifiable dans le tableau.

### 9.2 Filtres

Les filtres temporels sont :

- tout ;
- exercice 2026 ;
- T1, T2, T3 et T4 2026 ;
- plage de dates personnalisée.

Chaque colonne possède également une recherche textuelle indépendante.

Les filtres exercice et trimestre sont actuellement figés sur 2026. Ils devront devenir dynamiques dans une future réimplémentation.

### 9.3 Export CSV

- Exporte uniquement les lignes correspondant aux filtres actifs.
- Utilise le séparateur `;`, des valeurs entre guillemets et un BOM UTF-8.
- Nomme le fichier avec la date d'export.
- Inclut les champs visibles et des champs supplémentaires : identifiant, réception, canal, message original, URL Gmail, URL Drive et dernière modification.

### 9.4 Statistiques

La vue Statistiques répond à deux objectifs : analyser l'origine des demandes et piloter la performance commerciale. Ses périodes sont indépendantes des filtres de la vue Liste et utilisent exclusivement `date_reception`.

Les filtres disponibles sont : toutes les dates de réception, année, trimestre et plage personnalisée. Les demandes sans date de réception restent incluses dans la vue globale, sont exclues des périodes datées et font l'objet d'un avertissement visible.

Les indicateurs globaux affichent : demandes reçues, dossiers ouverts, gagnés, perdus, refusés/complets, taux de transformation commercial et taux de refus. Les catégories sont définies ainsi :

- gagnés : `Événement confirmé` ou `Événement terminé` ;
- perdus commercialement : `Perdu / Sans suite` ;
- refusés séparément : `Refusé / Complet` ;
- ouverts : tous les autres statuts.

Le taux de transformation commercial est `gagnés / (gagnés + perdus)`. Les dossiers ouverts et les refus sont exclus de son dénominateur. Le taux de refus est `Refusé / Complet / demandes reçues`.

Le graphique en anneau présente le volume et la part de chaque canal. Pour les statistiques uniquement, la variante historique `Téléphone + Email` est regroupée sous `Téléphone` sans réécriture de la base. `Saisie manuelle` reste une catégorie à part entière lorsque l'origine réelle n'est pas connue.

Le tableau par canal affiche : reçues, ouvertes, gagnées, perdues, refusées, taux de transformation commercial et taux de refus. Un avertissement `Échantillon faible` apparaît lorsque moins de cinq dossiers sont commercialement décidés.

Les dates de réception absentes sont signalées sans modifier les données de production.

## 10. Fiche d'une demande

### 10.1 Modes

- La même fenêtre sert à créer et à modifier une demande.
- Une nouvelle fiche s'ouvre en mode rapide.
- Une fiche existante s'ouvre directement en mode complet.
- Le lien `Compléter la fiche` ou `Saisie rapide` permet de basculer entre les modes.
- La fermeture par le bouton, le fond ou Échap demande confirmation si des données ont changé.
- Enregistrer sans modification ferme la fiche sans requête inutile.

### 10.2 Champs du mode rapide

- statut ;
- nom client, obligatoire ;
- date de l'événement, obligatoire ;
- heure ;
- téléphone ;
- email ;
- type : Mariage, Baptême, Anniversaire, Entreprise ou Autres ;
- nombre de convives ;
- lieu.

### 10.3 Champs du mode complet

- budget estimé ;
- canal d'origine ;
- date et heure de réception ;
- fil de discussion Gmail, en lecture seule ;
- dossier Drive ;
- message original, en lecture seule ;
- dernier message client, sa date et le nombre d'échanges, en lecture seule lorsqu'un suivi a été reçu ;
- notes internes ;
- dernière modification, en lecture seule.

Le fil Gmail et le message original ne sont pas affichés lors d'une création manuelle.

### 10.4 Actions contextuelles

Selon les données présentes, la fiche propose :

- `Appeler` ;
- `Répondre` par Gmail si seule l'adresse est connue ;
- `Ouvrir le fil` si une URL Gmail est connue ;
- ouvrir le dossier Drive ;
- `Marquer comme traité` lorsqu'un nouveau message client est signalé.

Pour un message client à traiter, le bouton `Répondre` est également présenté à côté de `Marquer comme traité`. Il ouvre le fil Gmail si son identifiant est connu ; sinon, il ouvre un nouveau message préadressé au client. L'accès au fil est reconstruit à partir de `gmail_thread_id` ou `gmail_message_id` si `url_email_origine` est vide.

`Marquer comme traité` positionne `relance_a_traiter` à faux. L'étoile disparaît et la demande sort du regroupement `Messages reçus`, sans changement de statut. Un nouvel échange rattaché réactive automatiquement l'indicateur.

Le regroupement `Messages reçus` est transversal à tous les statuts : une fiche close ou historisée reste visible dans ce regroupement tant que son message n'a pas été marqué comme traité.

### 10.5 Rattachement manuel d'une demande

Depuis une fiche existante, l'action `Rattacher à une demande` ouvre une fenêtre qui permet de choisir la destination et de comparer les informations principales. Les valeurs différentes sont mises en évidence. Après confirmation :

- les champs déjà renseignés sur la destination restent prioritaires ;
- les champs manquants, messages et notes utiles de la source sont transférés ;
- une répétition de la même opération ne duplique pas les notes ;
- la source est annotée et conservée ;
- sa suppression reste une action séparée qui utilise la confirmation irréversible existante.

### 10.6 Conflits de date

Pendant la saisie ou l'ouverture d'une fiche, l'interface recherche les autres demandes à la même date :

- avertissement renforcé si un événement est déjà confirmé ;
- avertissement simple pour une autre demande ;
- confirmation visuelle si aucun conflit n'est trouvé.

La fiche en cours d'édition est exclue de cette comparaison.

### 10.7 Création

- Utilise l'action backend `add` avec l'option `check_duplicates` lors d'une première tentative de création.
- N'envoie pas d'identifiant choisi par le navigateur.
- Initialise la date de réception si nécessaire.
- Utilise `Saisie manuelle` comme canal par défaut.
- Utilise `Nouvelle demande` comme statut par défaut.
- Avant toute écriture, le backend recherche sous verrou les demandes actives similaires, notamment par téléphone normalisé, email, nom, date, convives, type et lieu.
- Si des candidates existent, aucune ligne n'est créée et une fenêtre de rapprochement s'affiche au-dessus du formulaire.
- La fenêtre propose un sélecteur de fiches, un résumé des raisons de correspondance et une comparaison entre la fiche actuelle et la nouvelle saisie.
- `Voir la fiche` déplie cette comparaison dans la fenêtre sans fermer ni réinitialiser le formulaire en cours.
- `Retour au formulaire` conserve intégralement la saisie.
- `Enrichir cette fiche` complète la candidate sélectionnée tout en conservant son identifiant, sa date de réception, son canal et ses champs techniques.
- `Créer quand même` demande une confirmation explicite avant de forcer une nouvelle ligne.
- Recharge les données et avertit les autres onglets après succès.

### 10.8 Modification

- Utilise l'action backend `update` et `id_demande`.
- Met à jour localement l'affichage après succès puis recharge les données.
- Si la date change, l'agenda se positionne sur le nouveau mois.
- Les champs techniques absents du formulaire ne doivent pas être effacés.

### 10.9 Suppression

- Le bouton n'apparaît que pour une demande existante.
- Une confirmation explicite indique que l'action est irréversible.
- Utilise l'action backend `delete`.
- Recharge toutes les lignes après suppression afin de réaligner les numéros de ligne.

## 11. Synchronisation

- Chargement par l'action backend `list`.
- Création par `add`, modification par `update`, suppression par `delete`.
- Les requêtes suivent les redirections Google.
- Une synchronisation silencieuse est exécutée chaque minute lorsque l'application est ouverte et connectée.
- Les mutations réussies sont diffusées aux autres onglets via `BroadcastChannel`.
- Les autres onglets rechargent alors les données sans interaction.
- Les paramètres d'URL `?id=<id_demande>` et, pour compatibilité, `?row=<numéro>` ouvrent directement une fiche après chargement puis nettoient l'URL.

## 12. PWA et notifications

### 12.1 Installation

- L'application possède un manifeste et peut être installée comme PWA.
- Chrome/Android reçoit une bannière d'installation.
- Une bannière fermée reste masquée pendant trente jours.
- iOS reçoit une fenêtre expliquant l'ajout à l'écran d'accueil.

### 12.2 Mise à jour et cache

- Un service worker met en cache les ressources essentielles.
- Le cache possède une version explicite.
- Une bannière indique qu'une nouvelle version est disponible et permet de l'activer.
- Les anciens caches sont supprimés lors de l'activation.
- Les navigations tentent le réseau avant le cache afin de limiter les versions périmées.

### 12.3 Notifications

- Après autorisation, une notification est émise pour chaque nouvelle demande jamais vue sur ce navigateur.
- Les identifiants déjà vus sont mémorisés pour éviter les doublons.
- Le service worker peut afficher les notifications.
- Les informations de connexion et les demandes vues sont synchronisées vers IndexedDB pour le service worker.
- Sur les navigateurs compatibles, une synchronisation périodique tente de détecter les nouvelles demandes en arrière-plan.
- Un clic sur une notification remet l'application au premier plan ou l'ouvre.

## 13. Robustesse et sécurité d'affichage

- Échappement séparé des textes et attributs HTML.
- Validation des URL avant création de liens.
- Protection des liens ouverts dans un nouvel onglet.
- Prévention des doubles enregistrements.
- Désactivation temporaire des contrôles pendant les écritures.
- Overlay pendant l'enregistrement ou la suppression.
- Conservation de l'affichage existant en cas d'échec du polling silencieux.
- Rejet des réponses backend non JSON ou explicitement non autorisées.
- Interruption d'une synchronisation après 30 secondes avec retrait de l'overlay et affichage d'une erreur.

## 14. Limites et points à décider

- Les filtres annuels et trimestriels sont figés sur 2026.
- Les statistiques possèdent leurs propres filtres fondés sur la date de réception ; les filtres de la liste Historique restent fondés sur la date d'événement.
- Les tâches sont locales au navigateur et rattachées à un numéro de ligne mutable.
- Les prototypes publics utilisent le backend de production : une écriture depuis une démo modifie les données réelles.
- Les identifiants sont conservés dans le navigateur pour permettre les appels et notifications en arrière-plan.
- La disponibilité des notifications périodiques dépend du navigateur et du système.
- Il n'existe pas encore de tests fonctionnels automatisés dans un navigateur.

## 15. Liste de contrôle de non-régression

- [ ] Connexion, erreurs d'identifiants et déconnexion.
- [ ] Chargement, erreur réseau et indicateur de synchronisation.
- [ ] Normalisation des cinq canaux et dix statuts, dont `❓ À vérifier`.
- [ ] Déduplication par identifiant.
- [ ] Dates françaises, plages, années seules et heures.
- [ ] Cinq sections de navigation sur ordinateur et mobile.
- [ ] Quatre indicateurs et leurs fenêtres détaillées.
- [ ] Dernières demandes, demandes en cours et événements confirmés de l'accueil.
- [ ] Pipeline Entreprise, moins de 7 jours, moins de 30 jours et Autres.
- [ ] Badges d'informations manquantes.
- [ ] Changements rapides de statut dans toutes les vues concernées.
- [ ] Événements confirmés et tâches locales.
- [ ] Agenda mensuel et sélecteur mois/année.
- [ ] Historique complet et recherches par colonne.
- [ ] Filtres temporels et plage personnalisée.
- [ ] Export CSV filtré.
- [ ] Répartition par canal, filtres sur la date de réception et transformation commerciale hors dossiers ouverts et refusés.
- [ ] Création manuelle en saisie rapide.
- [ ] Consultation et modification en mode complet.
- [ ] Confirmation des modifications non enregistrées.
- [ ] Détection des conflits de date.
- [ ] Suppression avec confirmation.
- [ ] Téléphone, réponse Gmail, fil Gmail et dossier Drive.
- [ ] Passage automatique des confirmés passés en terminés.
- [ ] Synchronisation chaque minute et entre onglets.
- [ ] Liens profonds par identifiant et numéro de ligne.
- [ ] Installation PWA, cache et mise à jour.
- [ ] Notifications de nouvelles demandes.
- [ ] Échappement des données et validation des URL.
- [ ] Conservation des champs techniques lors d'une modification.

## 16. Dossier à fournir pour une réimplémentation

Pour reconstruire fidèlement le frontend dans Lovable ou un autre outil, fournir ensemble :

1. cette spécification ;
2. `docs/product-contract.md` ;
3. le schéma des réponses backend `list`, `add`, `update` et `delete` ;
4. des captures des cinq sections sur ordinateur et mobile ;
5. la charte graphique et les icônes ;
6. des données anonymisées couvrant tous les statuts, canaux et formats de date.

La réimplémentation n'est complète qu'après validation de tous les éléments de la liste de non-régression.
