# Rapport de tests — Ondea Stock Intelligence 1.0

Tests exécutés le 28/09/2026 dans **Chromium** (moteur de Google Chrome / Microsoft Edge), en mode automatisé (Playwright), en ouvrant `index.html` en `file://` comme un utilisateur Windows. Les actions passent par l'interface (clics, saisies, envois de fichiers) ; certains contrôles d'état lisent directement les données en mémoire pour vérifier les valeurs exactes.

**Résultat : 64 contrôles sur 64 réussis — aucune erreur JavaScript en console.**

## Scénario 1 — Création d'un produit ✅

| Contrôle | Résultat |
|---|---|
| Nom obligatoire (formulaire vide refusé, message affiché) | ✅ |
| Produit créé : SKU, EAN, prix 2,50 €, catégorie, fournisseur, seuil 5, stock initial 10, photo | ✅ |
| Mouvement « Stock initial » tracé (0 → 10) | ✅ |
| Photo enregistrée dans IndexedDB | ✅ |
| Produit visible dans la liste | ✅ |
| Tableau de bord : 1 référence, 10 unités, 25,00 € | ✅ |
| Référence (SKU) en double refusée, insensible à la casse | ✅ |

## Scénario 2 — Entrée de 20 unités ✅

Stock 10 → 30 ; prix moyen pondéré recalculé à 2,90 € ((10 × 2,50 + 20 × 3,10) / 30) ; historique avec stock avant/après et n° de facture ; valeur du stock 87 €. **Double clic** sur « Valider » : une seule entrée enregistrée.

## Scénario 3 — Sortie de 5 unités ✅

Stock diminué de 5, mouvement « Sortie / Vente » enregistré. Une sortie de 999 unités est refusée avec le message « Stock insuffisant… » et le stock reste inchangé.

## Scénario 4 — Seuil puis rupture ✅

Passage à 3 unités (seuil 5) → alerte « Sous le seuil minimal » et quantité recommandée > 0. Passage à 0 → l'alerte devient « Rupture totale » (l'alerte de seuil disparaît), compteur de la cloche mis à jour, alerte affichée avec l'action « Commander ».

## Scénario 5 — Commande de 30, réception de 10 ✅

Commande brouillon (HT 90 €, TVA 18 €, TTC 108 €) → validée → envoyée ; « en commande » = 30 dans le calcul. Réception de 10 : stock +10 seulement, 20 restantes, statut « Partiellement réceptionnée », reliquat de 20 toujours compté « en commande ». Tentative de réception de 25 (> reliquat) refusée, stock inchangé. Aperçu du bon de commande A4 correct.

## Scénario 6 — Inventaire ✅

Inventaire créé (brouillon) → comptage démarré (théorique figé à 10) → saisie de 8 avec note : **stock inchangé** → « À vérifier » → validation confirmée → mouvement de régularisation −2, stock 8, inventaire consultable avec ses régularisations. Annulation tracée d'un ancien mouvement : mouvement inverse créé, original marqué « annulé ».

## Scénario 7 — Persistance ✅

Fermeture complète du navigateur puis réouverture (même profil) : produits, mouvements, commandes, inventaires, fournisseurs identiques, session rouverte, **photo réaffichée** depuis IndexedDB.

## Scénario 8 — Sauvegarde et restauration ✅

Export JSON complet (mouvements et image base64 inclus). Export CSV : BOM UTF-8, séparateur `;`, virgule décimale. Réinitialisation totale (confirmation par saisie « EFFACER ») → base vide → restauration depuis l'écran d'accueil (confirmation demandée) → tous les éléments et l'image restaurés, reconnexion. Fusion de la même sauvegarde : aucun doublon. Fichier JSON étranger : refusé sans modification.

## Scénario 9 — Thèmes clair et sombre ✅

Les 12 rubriques rendues et capturées dans les deux thèmes, ainsi que fiche produit, formulaires, commande, contraste élevé. Audit **axe-core 4 (WCAG 2 A, AA, AAA)** sur les 12 rubriques × 2 thèmes : **0 violation** après corrections (contraste des petits textes dorés et gris renforcé en mode clair, rôles ARIA de la recherche et des notifications).

## Scénario 10 — Responsive ✅

Largeurs 375, 768 et 1024 px sur les 12 rubriques : aucun débordement horizontal global (les grands tableaux défilent dans leur cadre). Menu mobile : ouverture, navigation, fermeture automatique. Formulaires utilisables sur petit écran. Taille du texte 140 % sans débordement.

## Scénario 11 — Console et stabilité ✅

Aucune erreur JavaScript ni ressource manquante pendant l'ensemble des scénarios ; tous les boutons et liens visibles ont un nom accessible ; navigation complète par le menu. Données de démonstration chargées puis supprimées : les données réelles restent intactes. Deux onglets ouverts : une entrée saisie dans l'un apparaît dans l'autre.

## Performance (3 000 produits, 30 000 mouvements)

| Mesure | Durée |
|---|---|
| Affichage Produits | ≈ 0,1 s |
| Affichage Mouvements | ≈ 0,16 s |
| Affichage Statistiques | ≈ 0,16 s |
| Affichage Tableau de bord | ≈ 0,5 s |
| Recalcul de toutes les alertes | ≈ 30 ms |
| Filtrage de la liste produits | ≈ 1,5 ms |

## Non testé automatiquement

- Firefox et Safari ;
- lecteurs d'écran (NVDA, JAWS, VoiceOver) ;
- impression physique (le rendu PDF via l'impression du navigateur a été vérifié) ;
- douchette code-barres physique (simulée par saisie clavier).
