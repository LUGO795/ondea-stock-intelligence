# Guide rapide de première utilisation

Ce guide vous accompagne de l'ouverture de l'application à votre premier inventaire. Comptez 15 minutes.

## 1. Ouvrir l'application

1. Extrayez le ZIP (clic droit → **Extraire tout…**).
2. Double-cliquez sur `index.html` (ou `Lancer Ondea Stock.bat`). Chrome ou Edge conseillés.
3. Sur l'écran d'accueil, saisissez le **nom de l'entreprise**, **votre nom**, éventuellement un **code PIN**, et le nom de votre premier emplacement de stockage.
4. Choisissez **Démarrer avec une base vide**. (Pour découvrir l'outil d'abord, choisissez plutôt les données de démonstration : elles seront supprimables à tout moment dans Paramètres.)

Vous êtes **administrateur**. Le tableau de bord affiche un **démarrage guidé** qui coche chaque étape au fur et à mesure.

## 2. Mettre en place le référentiel

| Étape | Où | Conseil |
|---|---|---|
| Emplacements | Stocks et entrepôts → **Nouvel emplacement** | Un emplacement par lieu physique : réserve, magasin, dépôt, véhicule… |
| Catégories | Catégories → **Nouvelle catégorie** | 5 à 10 familles suffisent pour des statistiques lisibles. |
| Fournisseurs | Fournisseurs → **Nouveau fournisseur** | Renseignez le **délai habituel de livraison** : il sert au calcul du réapprovisionnement. |

## 3. Créer vos produits

Produits et références → **Nouveau produit** :

- **Nom** et **référence interne (SKU)** sont obligatoires ; la référence est proposée automatiquement.
- **Prix d'achat HT** : base de la valeur du stock.
- **Seuil minimal** : en dessous, l'alerte « stock faible » apparaît.
- **Stock maximal souhaité** (facultatif) : sert de niveau cible pour la quantité recommandée.
- **Stock initial** : crée un mouvement « Stock initial » tracé dans l'historique.
- **Photo** : cliquez sur « Choisir une photo » ; elle est enregistrée localement.
- **Code-barres** : avec une douchette USB, cliquez dans le champ et scannez.

## 4. Enregistrer les mouvements au quotidien

Depuis le tableau de bord, la liste des produits (icônes ⬇ ⬆) ou la rubrique Mouvements :

- **Entrée** : quantité reçue, prix d'achat, fournisseur, n° de facture/BL. Le prix moyen du produit est recalculé.
- **Sortie** : quantité, motif (vente, consommation, chantier, perte, casse, don…), destinataire. Une sortie supérieure au stock est **refusée** (sauf procédure exceptionnelle réservée aux responsables, justification obligatoire).
- **Transfert** : d'un emplacement à un autre, sans changer le stock total.
- **Erreur de saisie ?** Ouvrez le mouvement → **Annuler ce mouvement**. Un mouvement inverse est créé ; rien n'est effacé.

Astuce : dans la recherche globale (touche `/`), scannez un code-barres pour ouvrir directement la fiche du produit.

## 5. Surveiller les alertes et commander

- La **cloche** et le menu **Alertes et ruptures** affichent le nombre d'alertes importantes.
- Chaque alerte indique la quantité, le seuil, la date de détection et **l'action recommandée**.
- **Générer les commandes** crée un brouillon par fournisseur avec les quantités recommandées ; vous les ajustez avant validation.

## 6. Gérer une commande fournisseur

1. Commandes fournisseurs → **Nouvelle commande** (ou depuis une alerte).
2. **Valider**, puis **Marquer envoyée** ; imprimez le **bon de commande** (aperçu A4, « Enregistrer en PDF » possible).
3. À la livraison : **Réceptionner** et saisissez les quantités **réellement reçues**. Si tout n'est pas livré, la commande passe en « Partiellement réceptionnée » et le reste demeure attendu.
4. Si le reliquat ne viendra jamais : **Clôturer le reliquat**.

## 7. Faire un inventaire

1. Inventaires → **Nouvel inventaire** : général, par catégorie, par emplacement ou sélection de produits.
2. **Démarrer le comptage** : le stock théorique est figé.
3. Saisissez les quantités comptées (touche `Entrée` = ligne suivante). **Enregistrer** : le stock n'est **pas** modifié.
4. **Terminer et vérifier** : contrôlez les écarts (en valeur), ajoutez observations et justificatifs.
5. **Valider l'inventaire** : les mouvements de régularisation sont créés. L'inventaire reste consultable et imprimable.

## 8. Protéger vos données

Chaque semaine (au minimum) : Rapports et exports → **Exporter la sauvegarde (JSON)**, puis copiez le fichier sur une clé USB ou un espace sécurisé. Voir `SAUVEGARDE-RESTAURATION.md`.

## 9. Ajouter des collègues

Paramètres → **Opérateurs** → Ajouter : choisissez le rôle (Opérateur, Responsable, Administrateur) et, si besoin, un code PIN. Chaque mouvement enregistre l'opérateur connecté. Changer d'opérateur : icône de sortie en bas du menu.
