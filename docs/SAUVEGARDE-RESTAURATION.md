# Sauvegarde et restauration

## Où sont mes données ?

Dans **le navigateur** que vous utilisez, sur **ce poste** :

- **IndexedDB** (base `OndeaStockIntelligenceDB`) : produits, catégories, emplacements, fournisseurs, mouvements, commandes, inventaires, journal d'activité, réglages, opérateurs, compteurs, photos et justificatifs ;
- **localStorage** : uniquement les préférences d'affichage (thème, contraste, taille du texte, pause des animations, son, vue produits, dernier opérateur, date de la dernière sauvegarde).

Conséquences : un autre navigateur, un autre profil Windows ou un autre ordinateur ne voient pas vos données ; effacer les « données de site » du navigateur les supprime. **La sauvegarde JSON est votre filet de sécurité.**

L'application demande au navigateur un stockage « persistant » (moins susceptible d'être vidé automatiquement) ; l'espace utilisé est affiché dans le menu latéral et dans Paramètres.

## Exporter une sauvegarde complète

**Rapports et exports → Exporter la sauvegarde (JSON)** (ou Paramètres → Sauvegarde complète).

Le fichier `ondea-stock-sauvegarde-AAAA-MM-JJ.json` contient :

| Contenu | Inclus |
|---|---|
| Produits, catégories, emplacements, fournisseurs | ✅ |
| Historique complet des mouvements (y compris annulations) | ✅ |
| Commandes, lignes, réceptions, historique des statuts | ✅ |
| Inventaires, lignes, écarts, observations | ✅ |
| Journal d'activité | ✅ |
| Réglages de l'entreprise, opérateurs (avec leur code PIN), compteurs de numérotation | ✅ |
| Photos des produits, logo, justificatifs d'inventaire (encodés en base64) | ✅ |
| Préférences d'affichage propres au poste (thème, taille du texte…) | ❌ (non nécessaires) |

Le message de confirmation indique la taille du fichier et le nombre d'images incluses.

⚠️ Le fichier contient les codes PIN des opérateurs en clair : conservez-le dans un endroit sûr.

**Bonnes pratiques** : une sauvegarde par semaine (ou avant un inventaire, une mise à jour ou un changement de poste), conservée hors de l'ordinateur ; gardez plusieurs versions datées.

## Restaurer une sauvegarde

- **Depuis l'application** : Rapports et exports (ou Paramètres) → **Restaurer…** (administrateurs uniquement).
- **Sur un nouveau poste** : écran d'accueil → lien **Restaurer un fichier JSON**.

Étapes :

1. **Contrôle d'intégrité** automatique : format, sections obligatoires, champs indispensables des produits et mouvements. Un fichier invalide est **refusé sans rien modifier**. Les anomalies non bloquantes (photo manquante, mouvement orphelin, stock différent du dernier mouvement) sont signalées.
2. **Choix explicite du mode** :
   - **Fusionner** : ajoute les éléments absents de ce navigateur. Les éléments déjà présents (même identifiant) sont conservés tels quels ; vos réglages et opérateurs actuels sont gardés ; les compteurs de numérotation prennent la valeur la plus haute (pas de doublon de numéro).
   - **Remplacer** : efface **toutes** les données actuelles du navigateur puis charge la sauvegarde (réglages et opérateurs compris). Une confirmation par saisie du mot **REMPLACER** est exigée si des données existent.
3. À la fin, un message indique le nombre d'éléments restaurés. Après un remplacement, reconnectez-vous avec un opérateur de la sauvegarde.

## Transférer vers un autre ordinateur

1. Sur l'ancien poste : exportez la sauvegarde.
2. Copiez le dossier de l'application et le fichier JSON sur le nouveau poste.
3. Ouvrez `index.html`, puis sur l'écran d'accueil : **Restaurer un fichier JSON** → mode **Remplacer**.

## Exports CSV (Excel)

Les exports CSV ne sont **pas** des sauvegardes (pas de photos, pas de restauration) : ils servent à l'analyse dans Excel. Format : UTF-8 avec BOM, séparateur `;`, décimales avec virgule, dates JJ/MM/AAAA — ouverture directe par double-clic dans Excel en français.
