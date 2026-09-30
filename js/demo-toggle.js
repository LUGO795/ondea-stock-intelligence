/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — demo-toggle.js  (AJOUT)
   « Supprimer la démo » / « Restaurer la démo »
     • « Supprimer la démo » retire toutes les données fictives
       (produits, mouvements, commandes, fournisseurs, catégories,
       emplacements, inventaires, photos fictives, journal).
       Le logo de l'entreprise, le nom, les réglages, les opérateurs
       et vos propres données ne sont PAS touchés.
     • À la place du bouton apparaît alors « Restaurer la démo » :
       un clic recharge l'ensemble des données de démonstration
       (même jeu fictif, avec 4 mois d'historique à jour).
     • Le bandeau apparaît au même endroit : Tableau de bord et
       Produits et références.
   À charger APRÈS app.js. Aucune modification des autres fichiers.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  const KEY = 'osi_demo_removed';   // mémorisé sur ce poste : la démo a été retirée

  const demoPresent = () =>
    S.products.some(p => p.demo) || S.suppliers.some(s => s.demo) || S.movements.some(m => m.demo);

  /* ---- 1. Après une suppression réussie : on retient qu'on peut restaurer ---- */
  const _removeDemoData = removeDemoData;
  removeDemoData = async function () {
    const r = await _removeDemoData.apply(this, arguments);
    PREF.set(KEY, '1');
    refreshView();                   // le bandeau « Restaurer la démo » s'affiche aussitôt
    return r;
  };

  /* ---- 2. Bandeau : « Restaurer la démo » à la place de « Supprimer la démo » ---- */
  const _demoBanner = demoBanner;
  demoBanner = function () {
    const html = _demoBanner.apply(this, arguments);
    if (html) return html;                                   // démo présente : bandeau d'origine
    if (PREF.get(KEY) !== '1' || demoPresent()) return '';   // jamais retirée : rien à proposer
    return `<div class="notice demo-notice" role="note">${svg('info')}<div><b>Données de démonstration retirées</b> — vos propres données, le logo et les réglages de l'entreprise sont conservés.
      Vous pouvez réafficher l'ensemble des données fictives à tout moment.</div>
      ${can('demo') ? `<button type="button" class="btn sm gold" id="demoRestore">${svg('undo')} Restaurer la démo</button>` : ''}</div>`;
  };

  /* ---- 3. Branchement du nouveau bouton ---- */
  const _bindDemoBanner = bindDemoBanner;
  bindDemoBanner = function (root) {
    _bindDemoBanner.apply(this, arguments);
    const b = $('#demoRestore', root);
    if (!b) return;
    b.onclick = e => guard(e.currentTarget, async () => {
      requireRight('demo', 'restaurer les données de démonstration');
      if (demoPresent()) { PREF.set(KEY, ''); refreshView(); return; }
      await loadDemoData();          // recharge tout le jeu de démonstration
      PREF.set(KEY, '');
      toast('Données de démonstration restaurées', 'ok');
    });
  };

  /* ---- 4. Si la démo est rechargée autrement (Paramètres, démarrage guidé…) ---- */
  const _loadDemoData = loadDemoData;
  loadDemoData = async function () {
    const r = await _loadDemoData.apply(this, arguments);
    PREF.set(KEY, '');
    return r;
  };
})();