# Fonctionnalités réellement implémentées

Chaque point ci-dessous est opérationnel : les données sont réellement enregistrées dans IndexedDB et les calculs portent sur ces données. 
Les points marqués ✔︎ ont été vérifiés par les tests automatisés (voir `RAPPORT-DE-TESTS.md`).

## Identité, navigation et interface

- Design system « Obsidienne & Or » d'Ondea Staff Manager v2 repris à l'identique : feuille de style d'origine (`ondea-core.css`), 
couches premium (`ondea-premium.css`), polices embarquées, favicon, logo ◆.
- Barre latérale de 264 px (verre dépoli, filet lumineux, rail actif doré, badges), barre supérieure, horloge avec secondes, indicateur de stockage, bouton « retour en haut » avec son, flash et vibration (son désactivable), fond d'icônes animées (thème « stocks ») avec pause.
- 12 rubriques en navigation SPA (adresse `#/rubrique`, boutons Précédent/Suivant du navigateur), fil d'Ariane, état actif, menu mobile avec voile.
- Thème clair/sombre (même mécanisme et même clé `ondea_theme` que la référence), contraste élevé, taille du texte (100–140 %).
- Recherche globale (produits, code-barres, fournisseurs, commandes, inventaires) avec navigation clavier ; raccourci `/`.
- Notifications (toasts), fenêtres modales à deux niveaux, panneau latéral de fiche, confirmations explicites, états vides soignés, démarrage guidé.

## Première utilisation

- ✔︎ Assistant de démarrage : entreprise, administrateur, code PIN facultatif, premier emplacement.
- ✔︎ Base vide ou données de démonstration (35 produits, 5 fournisseurs, 4 emplacements, ≈ 1 500 mouvements sur 4 mois générés par le vrai moteur, commandes dont une partielle et une en retard, un inventaire validé et un en cours, photos illustrées).
- ✔︎ Données de démonstration identifiées (étiquette « Démo ») et supprimables sans toucher aux données réelles.
- ✔︎ Restauration d'une sauvegarde dès l'écran d'accueil.

## Produits et références

- ✔︎ Fiche : identifiant unique, nom, SKU (unicité contrôlée), EAN (8–14 chiffres, unicité), description, catégorie, fournisseur principal, prix d'achat, prix de vente, quantité, réservé, réellement disponible, seuil minimal, stock maximal, quantité recommandée (calculée), lot de commande, unité, emplacement principal, dates de création et de modification, photo, statut.
- ✔︎ Photo depuis un fichier local, redimensionnée et enregistrée dans IndexedDB, restaurée après redémarrage.
- ✔︎ Stock initial à la création (mouvement tracé).
- Recherche instantanée (nom, référence, code-barres, description) ; filtres catégorie, fournisseur, emplacement, statut, niveau de stock ; tri nom, quantité, valeur, date, catégorie ; vue tableau ou cartes ; pagination (25/50/100).
- Fiche détaillée : informations, stock par emplacement, mouvements, réapprovisionnement expliqué, évolution des prix (graphique), commandes.
- Actions : consulter, modifier, dupliquer, archiver/réactiver, supprimer (uniquement sans historique ; sinon proposition d'archivage), entrée/sortie rapide.

## Stocks, emplacements et mouvements

- ✔︎ Entrées (quantité, prix, fournisseur, n° de document, date, emplacement, commentaire) avec valorisation CUMP ou dernier prix.
- ✔︎ Sorties (motifs configurables, destinataire, date et heure, commentaire) ; ✔︎ refus d'une sortie supérieure au stock de l'emplacement.
- Procédure exceptionnelle (stock négatif) et ajustements (+/−) réservés aux responsables, justification obligatoire.
- Transferts entre emplacements (stock global inchangé, contrôle du stock de l'emplacement source, statut « Effectué » / « Annulé »).
- ✔︎ Historique non modifiable : n°, identifiant, type, produit, quantité, stock avant/après (total et emplacement), date de l'opération et d'enregistrement, motif, opérateur, référence documentaire, commentaire, coût et valeur.
- ✔︎ Annulation tracée par mouvement inverse (y compris d'une réception, qui redevient « en attente » sur la commande).
- Filtres (recherche, type, produit, emplacement, opérateur, période), totaux, export CSV.
- ✔︎ Protection contre les doubles soumissions ; aperçu du stock avant/après dans le formulaire.

## Alertes et réapprovisionnement

- ✔︎ 8 types : rupture, sous le seuil, proche du seuil, au-dessus du maximum, sans mouvement, consommation en forte hausse, commande en retard, à réapprovisionner prochainement.
- 4 priorités (critique, haute, moyenne, basse), date de détection mémorisée, action recommandée, compteur (cloche + menu), filtres.
- ✔︎ Disparition / mise à jour automatique quand la situation change.
- ✔︎ Quantité recommandée : stock disponible, seuil, maximum, consommation moyenne, délai fournisseur, commandes en cours — hypothèses affichées.
- Génération de commandes brouillon par fournisseur à partir des recommandations.

## Inventaires

- ✔︎ Général, par catégorie, par emplacement ou par sélection.
- ✔︎ Statuts brouillon, en cours, à vérifier, validé, annulé.
- ✔︎ Stock théorique figé à l'ouverture ; saisie des comptages sans modification du stock ; écarts positifs/négatifs en quantité et en valeur ; notes par ligne, observations, justificatifs (fichiers).
- ✔︎ Validation explicite → mouvements de régularisation ; inventaire consultable ensuite.
- Signalement des mouvements survenus pendant le comptage ; rapport imprimable et CSV.

## Fournisseurs et commandes

- ✔︎ Fournisseurs : création, modification, recherche, archivage ; ✔︎ contrôles e-mail/SIRET ; produits associés, commandes, historique des livraisons, achats sur 12 mois.
- ✔︎ Commandes : numéro unique (CF-AAAA-NNNN), fournisseur, dates, lignes, prix, HT, TVA configurable, TTC, conditions, commentaires.
- ✔︎ Statuts brouillon → validée → envoyée → partiellement réceptionnée → réceptionnée / annulée ; clôture du reliquat.
- ✔︎ Réception partielle : stock augmenté uniquement des quantités reçues ; ✔︎ réception au-delà du reliquat refusée (pas de double comptage).
- ✔︎ Bon de commande A4 avec aperçu (logo, coordonnées, signature) ; « Enregistrer au format PDF ».

## Statistiques

- Valeur du stock, entrées, coût des consommations, taux de rotation, durée moyenne de stockage, ruptures — avec explications simples et « — » / « n.c. » si les données manquent.
- Consommation par période (graphique), par catégorie (anneau), par produit (tableau), par motif ; forte consommation ; faible rotation ; fréquence des ruptures ; évolution des prix d'achat ; historique des réapprovisionnements.
- Comparaison de deux périodes (précédente ou choisie).
- Tous les graphiques : info-bulles souris/tactile/clavier, légende, vue « Tableau », thèmes clair et sombre.

## Rapports, exports, sauvegarde

- ✔︎ CSV Excel (BOM UTF-8, `;`, virgule décimale, dates françaises, protection contre l'injection de formules) : catalogue, état des stocks, valeur du stock, mouvements, ruptures, consommation, commandes, fournisseurs, inventaire — selon période, catégorie et emplacement.
- ✔︎ Impression A4 / PDF de chaque rapport.
- ✔︎ Sauvegarde JSON complète avec images ; ✔︎ restauration avec contrôle d'intégrité, fusion ou remplacement, confirmation.

## Paramètres

Entreprise et logo, devise (€ par défaut, format français), format de date, taux de TVA, seuils d'alerte, réapprovisionnement, méthode de valorisation, unités, motifs de sortie, conditions de paiement, opérateurs et rôles, affichage, pagination, sauvegardes, démonstration, réinitialisation complète (confirmation par saisie).

## Fiabilité

- Transactions IndexedDB multi-magasins (tout ou rien) ; mise à jour de la mémoire seulement après écriture réussie.
- Validation des formulaires avec messages clairs et champs signalés.
- Synchronisation entre onglets ouverts simultanément.
- Repli en mémoire (avec avertissement) si IndexedDB est indisponible.
