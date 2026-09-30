# Limitations connues

Ces limites sont réelles et **non résolues** dans la version 1.0. Elles sont listées pour vous permettre de décider en connaissance de cause.

## Données et multi-utilisateurs

- **Données locales à un navigateur** : pas de serveur ni de synchronisation entre postes. Plusieurs personnes sur des ordinateurs différents ne partagent pas le même stock. Pour un usage multi-postes, il faut une version serveur (non incluse).
- Plusieurs **onglets** du même navigateur sont resynchronisés automatiquement, mais deux saisies strictement simultanées sur le même produit dans deux onglets ne sont pas arbitrées.
- Les données peuvent être perdues si le navigateur efface les « données de site » : **sauvegardez régulièrement** (JSON).
- En navigation privée ou si IndexedDB est bloqué, l'application fonctionne en mémoire et **perd les données à la fermeture** (un avertissement s'affiche).

## Sécurité

- Le **code PIN** n'est ni chiffré ni haché ; il limite l'accès sur un poste partagé mais ne protège pas contre une personne ayant accès au navigateur ou au fichier de sauvegarde.
- Les rôles sont contrôlés dans l'application, pas par un serveur : ce n'est pas une sécurité forte.

## Fonctionnel

- Pas de gestion des **lots, numéros de série, dates de péremption (DLC/DLUO)** ni de méthode FIFO/FEFO.
- Pas de **lecture de code-barres par la caméra** (les douchettes USB, qui se comportent comme un clavier, fonctionnent dans la recherche, les sélecteurs de produit et le champ EAN).
- Pas d'**import CSV** de catalogue produits (saisie manuelle ou restauration JSON).
- Pas de module de **ventes / factures clients** : la quantité réservée est saisie manuellement.
- Transferts instantanés (pas d'état « en transit »).
- Pas d'**envoi automatique** des bons de commande par e-mail : imprimez ou enregistrez en PDF puis envoyez-le vous-même.
- Une seule **devise** par base : changer la devise dans les Paramètres ne convertit pas les montants existants.
- Une **modification manuelle du prix d'achat** d'un produit n'est pas rétroactive : le graphique d'évolution de la valeur du stock reconstruit le passé à partir des mouvements.
- La **consommation moyenne** utilise un dénominateur d'au moins 14 jours ; pour un produit récent, la recommandation reste prudente et s'affine avec l'historique (signalé à l'écran).
- Le comptage d'inventaire ne **bloque pas** les mouvements : l'application applique l'écart (compté − théorique) au stock actuel et signale les mouvements intervenus pendant le comptage.

## Technique

- **PDF** produit via la fonction d'impression du navigateur (« Enregistrer au format PDF »), pas par un générateur intégré.
- Ouverture impossible directement depuis le ZIP (Windows n'expose alors pas les dossiers `css` et `js`) : extraire l'archive.
- La **météo géolocalisée** de la barre latérale d'Ondea Staff Manager n'a pas été reprise : elle nécessitait Internet et une clé d'API externe, contraires au fonctionnement 100 % local demandé. L'horloge est conservée.
- L'**écran de connexion** de la référence (identifiant / mot de passe de démonstration) est remplacé par un choix d'opérateur avec PIN facultatif, plus adapté à un poste de magasin partagé.
- Accessibilité : l'audit automatique axe-core (WCAG 2 A/AA/AAA) ne relève aucune violation, mais un audit manuel avec lecteur d'écran (NVDA, JAWS) n'a pas été réalisé ; certains critères AAA (langage simplifié, aide contextuelle exhaustive) ne sont pas vérifiables automatiquement.
- Navigateurs testés automatiquement : Chromium (moteur de Chrome et Edge). Firefox et Safari récents devraient fonctionner mais n'ont pas été testés.
