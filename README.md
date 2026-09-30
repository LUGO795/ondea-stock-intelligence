# Ondea Stock Intelligence

> **La gestion intelligente de vos stocks, simplement.**
> Gestion des stocks pour les petites entreprises, commerces, artisans et PME.
> 100 % autonome : aucun serveur, aucune installation, aucune dépendance externe.

![Version](https://img.shields.io/badge/version-1.0-c9a24b)
![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JavaScript-0b0d10)
![Hors--ligne](https://img.shields.io/badge/hors--ligne-100%25-5aa87a)
![Données](https://img.shields.io/badge/donn%C3%A9es-IndexedDB-86b6d4)

Application de la gamme **Ondea Studio**, conçue sur le design system « Obsidienne & Or » d'Ondea Staff Manager.

---

## Sommaire

1. [Démarrage en 30 secondes](#démarrage-en-30-secondes)
2. [Arborescence du projet](#arborescence-du-projet)
3. [Les 12 rubriques](#les-12-rubriques)
4. [Données, sauvegarde et restauration](#données-sauvegarde-et-restauration)
5. [Rôles des opérateurs](#rôles-des-opérateurs)
6. [Calculs « intelligents » : ce qui est vraiment fait](#calculs-intelligents--ce-qui-est-vraiment-fait)
7. [Accessibilité et confort](#accessibilité-et-confort)
8. [Architecture technique](#architecture-technique)
9. [Tests réalisés](#tests-réalisés)
10. [Limitations connues](#limitations-connues)
11. [Dépannage](#dépannage)

Documents complémentaires dans le dossier `docs/` :

- `GUIDE-RAPIDE.md` — première utilisation, pas à pas ;
- `SAUVEGARDE-RESTAURATION.md` — protéger et transférer vos données ;
- `FONCTIONNALITES.md` — liste détaillée de ce qui est réellement implémenté ;
- `LIMITATIONS.md` — ce que l'application ne fait pas (encore) ;
- `RAPPORT-DE-TESTS.md` — résultats des tests fonctionnels exécutés.

---

## Démarrage en 30 secondes

1. Extrayez l'archive ZIP dans un dossier (par exemple `Documents\Ondea-Stock-Intelligence`).
   **Ne lancez pas l'application depuis l'intérieur du ZIP** : Windows ne donne alors accès qu'à `index.html`, sans les dossiers `css` et `js`.
2. Double-cliquez sur **`index.html`** (ou sur `Lancer Ondea Stock.bat`).
   Google Chrome ou Microsoft Edge récents sont recommandés.
3. Au premier lancement, indiquez le nom de l'entreprise et votre nom, puis choisissez :
   - **Démarrer avec une base vide** : vous saisissez vos propres données ;
   - **Explorer avec des données de démonstration** : un atelier-boutique fictif (35 produits, 5 fournisseurs, 4 mois d'historique, commandes, inventaires), supprimable ensuite en un clic sans toucher à vos données.

> Les données sont enregistrées **dans le navigateur utilisé** (IndexedDB). Un autre navigateur ou un autre ordinateur ne les voit pas : utilisez la sauvegarde JSON pour les transférer.

---

## Arborescence du projet

```
Ondea-Stock-Intelligence/
├── index.html                  Page unique de l'application (SPA)
├── Lancer Ondea Stock.bat      Raccourci Windows (ouvre index.html)
├── README.md                   Ce document
├── css/
│   ├── fonts.css               Polices embarquées (Playfair Display, Atkinson Hyperlegible, JetBrains Mono)
│   ├── ondea-core.css          Design system « Obsidienne & Or » — copie fidèle d'Ondea Staff Manager v2
│   ├── ondea-premium.css       Couches premium de la référence (fond animé, effets « Whaou », zoom)
│   └── stock.css               Composants propres aux stocks, graphiques, accessibilité AAA, impression A4
├── js/
│   ├── core/
│   │   ├── utils.js            Outils : dates, montants en euros, icônes SVG, échappement HTML
│   │   ├── db.js               Accès IndexedDB (transactions, photos, repli mémoire)
│   │   ├── store.js            État central + règles métier (produits, mouvements, commandes, inventaires)
│   │   └── engine.js           Calculs : consommation, réapprovisionnement, alertes, statistiques
│   ├── ui/
│   │   ├── ui.js               Composants : toasts, modales, panneau latéral, pagination, formulaires
│   │   └── charts.js           Graphiques SVG interactifs (courbes, barres, anneau) + vue tableau
│   ├── io/
│   │   └── exports.js          CSV Excel, sauvegarde / restauration JSON, documents imprimables A4
│   ├── views/                  Une vue par rubrique du menu
│   │   ├── dashboard.js  products.js  catalog.js (catégories + entrepôts)
│   │   ├── movements.js  inventories.js  alerts.js  suppliers.js  orders.js
│   │   └── stats.js  reports.js  settings.js
│   ├── demo.js                 Données de démonstration (générées par le vrai moteur de mouvements)
│   └── app.js                  Démarrage, accueil, menu, routeur, thème, horloge, recherche globale
└── docs/                       Guides et rapports (voir Sommaire)
```

Aucun module ES, aucune compilation : les scripts sont chargés dans l'ordre par `index.html`, ce qui permet l'ouverture en double-clic (`file://`).

---

## Les 12 rubriques

| Rubrique | Ce que vous pouvez faire |
|---|---|
| **Tableau de bord** | 8 indicateurs calculés en temps réel (références, unités, valeur au prix d'achat, stock faible, ruptures, commandes en attente, mouvements du jour, entrées/sorties de la période), graphiques filtrables (7 j, 30 j, 90 j, année, personnalisée), alertes prioritaires, activité récente cliquable, démarrage guidé. |
| **Produits et références** | Fiche complète (SKU, EAN, catégorie, fournisseur, prix, seuils, réservé, unité, emplacement, photo), recherche instantanée (nom, référence, code-barres), 6 filtres, tri, vue tableau ou cartes, pagination, duplication, archivage, suppression contrôlée, fiche détaillée à onglets. |
| **Catégories** | Création, modification, suppression protégée ; unités, valeur, part du stock et alertes par catégorie. |
| **Stocks et entrepôts** | Emplacements (réserve, magasin, dépôt, véhicule…), valeur par emplacement, matrice produit × emplacement, transferts. |
| **Mouvements de stock** | Entrées, sorties (motifs), transferts, ajustements ; historique non modifiable avec stock avant/après, filtres, export ; annulation tracée. |
| **Inventaires** | Général ou partiel (catégorie, emplacement, sélection) ; stock théorique figé ; comptage ; écarts ; vérification ; validation avec régularisations ; justificatifs ; impression et CSV. |
| **Alertes et ruptures** | 8 types d'alertes, 4 niveaux de priorité, date de détection, action recommandée ; génération de commandes brouillon par fournisseur. |
| **Fournisseurs** | Répertoire, fiche (coordonnées, SIRET, conditions, délai), produits associés, commandes, historique des livraisons. |
| **Commandes fournisseurs** | Brouillon → validée → envoyée → partiellement réceptionnée → réceptionnée (ou annulée) ; HT / TVA / TTC ; réceptions partielles ; bon de commande A4. |
| **Statistiques et consommation** | Consommation par produit, catégorie, période et motif ; coût des consommations ; rotation ; durée de stockage ; faible rotation ; ruptures ; évolution des prix ; comparaison de deux périodes. |
| **Rapports et exports** | 9 rapports en CSV et impression/PDF, respectant période, catégorie et emplacement ; sauvegarde complète JSON. |
| **Paramètres** | Entreprise et logo, devise, format de date, TVA, seuils d'alerte, réapprovisionnement, valorisation (CUMP / dernier prix), unités, motifs, conditions de paiement, opérateurs, affichage, sauvegardes, démonstration, réinitialisation. |

La barre supérieure offre aussi une **recherche globale** (produit, code-barres, fournisseur, commande, inventaire — raccourci `/`), la pause des animations, la **taille du texte**, le **contraste élevé**, le thème clair/sombre et la cloche d'alertes.

---

## Données, sauvegarde et restauration

- **Stockage** : IndexedDB (base `OndeaStockIntelligenceDB`) pour toutes les données et les photos ; `localStorage` pour les seules préférences d'affichage (thème, contraste, taille du texte, vue produits, session).
- **Transactions** : chaque opération qui touche plusieurs éléments (réception = commande + mouvements + produits) est écrite dans **une seule transaction** ; en cas d'échec, rien n'est modifié.
- **Sauvegarde** (Rapports et exports ou Paramètres) : un fichier `ondea-stock-sauvegarde-AAAA-MM-JJ.json` contenant **toutes** les données, les réglages, les opérateurs, les compteurs de numérotation **et les images** (encodées en base64).
- **Restauration** : contrôle d'intégrité, puis choix explicite **Fusionner** (ajoute ce qui manque, garde l'existant) ou **Remplacer** (efface tout, confirmation par saisie du mot REMPLACER).

Détails : `docs/SAUVEGARDE-RESTAURATION.md`.

---

## Rôles des opérateurs

| Action | Administrateur | Responsable des stocks | Opérateur |
|---|:---:|:---:|:---:|
| Entrées, sorties, transferts | ✅ | ✅ | ✅ |
| Réceptionner une commande | ✅ | ✅ | ✅ |
| Saisir un comptage d'inventaire | ✅ | ✅ | ✅ |
| Ajustement / sortie exceptionnelle (stock négatif) | ✅ | ✅ | — |
| Créer, modifier, archiver produits, catégories, fournisseurs, commandes | ✅ | ✅ | — |
| Créer, valider, annuler un inventaire | ✅ | ✅ | — |
| Annuler un mouvement (annulation tracée) | ✅ | ✅ | — |
| Paramètres, opérateurs, restauration, réinitialisation | ✅ | — | — |

Le code PIN facultatif limite l'accès sur un poste partagé ; ce n'est **pas** une sécurité forte (voir Limitations).

---

## Calculs « intelligents » : ce qui est vraiment fait

**Aucune intelligence artificielle externe n'est utilisée.** Les recommandations reposent sur des règles métier transparentes, détaillées dans chaque fiche produit (onglet « Réappro. », bouton « Comment est-ce calculé ? ») :

- **Consommation moyenne / jour** = sorties sur la période d'analyse (90 j par défaut, ou depuis la création du produit, minimum 14 jours) ÷ nombre de jours ;
- **Point de commande** = consommation moyenne × délai fournisseur + seuil minimal ;
- **Stock projeté** = (stock − réservé) + quantités commandées non reçues ;
- **Niveau cible** = stock maximal si renseigné, sinon point de commande + 30 jours de consommation ;
- **Quantité recommandée** = niveau cible − stock projeté, si le stock projeté ≤ point de commande (arrondie au lot de commande éventuel).

Les statistiques n'affichent **ni tendance ni pourcentage** quand les données sont insuffisantes (message explicatif ou « n.c. »).

**Valorisation** : coût unitaire moyen pondéré (CUMP) par défaut, ou dernier prix d'achat (Paramètres). Les sorties sont valorisées au prix d'achat courant.

---

## Accessibilité et confort

- Contrastes renforcés : audit automatique **axe-core (WCAG 2 A, AA et AAA)** sans violation sur les 12 rubriques, en thème clair et sombre (les petits textes discrets et dorés ont été légèrement assombris en mode clair par rapport à la référence pour atteindre 7:1).
- Mode **contraste élevé** (repris de la référence), **taille du texte** 100 / 112 / 125 / 140 %, respect de « réduire les animations », pause du fond animé.
- Navigation complète au clavier : lien d'évitement, focus visible, piège du focus dans les fenêtres, retour du focus, `Échap` pour fermer, flèches dans les onglets et les graphiques, `Entrée` pour passer à la ligne suivante lors d'un comptage.
- Libellés explicites, messages d'erreur lisibles avec `aria-invalid`, annonces `aria-live`, aucune information transmise par la seule couleur (icônes + textes), graphiques avec vue « Tableau ».

---

## Architecture technique

- **HTML5 sémantique**, **CSS3** à variables (thèmes par `data-theme` / `data-contrast`), **JavaScript ES2020** natif, sans framework ni bibliothèque.
- **État central** (`store.js`) : les données sont chargées en mémoire au démarrage ; chaque opération vérifie les règles, écrit dans IndexedDB, puis met à jour la mémoire et prévient l'interface (événement de changement) → tableau de bord, alertes, badges et fiche ouverte se recalculent automatiquement.
- **Calculs mis en cache** (`engine.js`) et recalculés uniquement après une modification.
- **Listes paginées** (25 / 50 / 100 lignes), recherche avec anti-rebond, photos chargées uniquement pour les lignes visibles, images redimensionnées à 1024 px.
- Mesures sur 3 000 produits et 30 000 mouvements : rendu des listes < 0,2 s, recalcul des alertes ≈ 50 ms, filtrage ≈ 2 ms.

---

## Tests réalisés

63 contrôles automatisés exécutés dans Chromium (scénarios 1 à 11 du cahier des charges) : **63 / 63 réussis, aucune erreur JavaScript**. Détail dans `docs/RAPPORT-DE-TESTS.md`.

---

## Limitations connues

Résumé (détail dans `docs/LIMITATIONS.md`) : données propres à un navigateur (pas de synchronisation multi-postes), PIN non chiffré, pas de lecture de code-barres par caméra (les douchettes USB fonctionnent), pas de gestion des lots / numéros de série / dates de péremption, pas de multi-devises par commande, PDF via l'impression du navigateur.

---

## Dépannage

| Problème | Solution |
|---|---|
| Page blanche ou sans style | Vous avez ouvert `index.html` depuis le ZIP : extrayez d'abord l'archive. |
| « IndexedDB indisponible » | Navigation privée ou stockage bloqué : utilisez une fenêtre normale ; exportez régulièrement en JSON. |
| Les données ont disparu | Vous utilisez un autre navigateur, un autre profil ou les données du site ont été effacées : restaurez votre dernière sauvegarde. |
| L'impression contient le menu | Utilisez les boutons « Imprimer » de l'application (aperçu A4), pas `Ctrl+P` sur une page quelconque. |
| Code PIN oublié | Un administrateur peut le modifier dans Paramètres → Opérateurs. |

---

© Ondea Studio — Ondea Web Studio. Application fournie telle quelle ; vérifiez vos sauvegardes avant toute utilisation en production.
