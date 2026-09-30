/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — produits-visibilite.js  (AJOUT)
   Afficher / ne plus afficher un produit en un clic.
     • Bouton « œil » sur chaque ligne du tableau et chaque carte
       de « Produits et références ».
     • Masquer demande TOUJOURS une confirmation (stock, valeur et
       commandes en cours sont rappelés avant de valider).
     • Bouton « Produits masqués (n) » en haut de la page Produits,
       et rappel sur le Tableau de bord : on peut ré-afficher un
       produit, ou tous, à n'importe quel moment.
   Un produit masqué utilise le statut « archivé » déjà géré par
   l'application : il disparaît automatiquement du tableau de bord
   (indicateurs, valeur du stock), des alertes, des statistiques,
   des catégories, des stocks, des rapports et exports, des
   suggestions de commande et des listes de saisie. Son historique
   (mouvements, commandes, inventaires) est conservé intact.
   Ré-afficher le produit le remet partout, instantanément.
   Mise à jour immédiate de tous les écrans (et des autres onglets)
   via le mécanisme de sauvegarde central (commit).
   À charger APRÈS app.js. Aucune modification des autres fichiers.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  if (typeof VIEWS === 'undefined' || typeof productRow !== 'function') return;

  /* ---------- Icônes ---------- */
  const IC_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const IC_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  /* ---------- Styles (conventions Obsidienne & Or) ---------- */
  const st = document.createElement('style');
  st.id = 'produits-visibilite-style';
  st.textContent = `
    .vis-btn svg{width:16px;height:16px}
    .vis-btn.is-hidden{color:var(--accent-bright,#e7c877);border-color:var(--or-line)}
    .pcard .pcard-img .btn.vis-btn{position:absolute;right:10px;top:10px;z-index:2;width:38px;height:38px;padding:0;
      display:grid;place-items:center;border-radius:100px;background:#0b0d10;color:#f6f3ec;border:2px solid #f6f3ec;
      box-shadow:0 2px 10px rgba(0,0,0,.45)}
    html[data-theme="light"] .pcard .pcard-img .btn.vis-btn{background:#fff;color:#1a1d23;border-color:#1a1d23}
    .pcard .pcard-img .btn.vis-btn:hover,.pcard .pcard-img .btn.vis-btn:focus-visible{outline:3px solid var(--or-400,#d8b35e);outline-offset:2px}
    .vis-list{display:flex;flex-direction:column;gap:8px;max-height:min(60vh,520px);overflow:auto;margin-top:12px;padding-right:4px}
    .vis-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg-elev)}
    .vis-item .grow{min-width:0}
    .vis-item b{display:block;font-size:.95rem;line-height:1.3}
    .vis-item small{display:block;color:var(--txt-soft);font-size:.82rem}
    .vis-count{font-family:var(--mono);font-weight:700}`;
  document.head.appendChild(st);

  const masques = () => S.products.filter(p => p.status === 'archived');
  const peutModifier = () => typeof can === 'function' && can('product.edit');

  /* ---------- Bouton œil ---------- */
  function boutonVis(p, carte) {
    if (!peutModifier()) return '';
    const cache = p.status === 'archived';
    const lib = cache ? `Afficher à nouveau : ${p.name}` : `Ne plus afficher : ${p.name}`;
    return `<button type="button" class="btn icon sm vis-btn${cache ? ' is-hidden' : ''}" data-vis="${esc(p.id)}" aria-label="${esc(lib)}" title="${cache ? 'Afficher à nouveau ce produit' : 'Ne plus afficher ce produit'}">${cache ? IC_EYE : IC_EYE_OFF}</button>`;
  }

  /* Ajout du bouton dans chaque ligne du tableau (cellule des actions rapides) */
  const _row = productRow;
  productRow = function (p) {
    const html = _row.apply(this, arguments);
    const b = boutonVis(p, false);
    if (!b) return html;
    const i = html.lastIndexOf('</td>');
    return i < 0 ? html : html.slice(0, i) + b + html.slice(i);
  };
  /* Ajout du bouton sur l'image de chaque carte */
  const _card = productCard;
  productCard = function (p) {
    const html = _card.apply(this, arguments);
    const b = boutonVis(p, true);
    if (!b) return html;
    return html.replace('<div class="pcard-img">', '<div class="pcard-img">' + b);
  };

  /* ---------- Masquer (avec confirmation) / ré-afficher ---------- */
  function demanderMasquage(id) {
    const p = productById(id); if (!p) return;
    const q = productQty(p), v = productValue(p);
    const cmd = S.orders.filter(o => isOrderOpen(o) && o.lines.some(l => l.productId === id && lineRemaining(l) > 0)).length;
    const details = `<ul style="margin:12px 0 0 18px;line-height:1.7">
        <li>Stock actuel : <b>${fmtNum(q)} ${esc(p.unit)}</b> — valeur <b>${fmtMoney(v)}</b> (ne sera plus comptée dans le tableau de bord).</li>
        ${cmd ? `<li><b>${cmd}</b> commande(s) fournisseur en cours contiennent ce produit : elles restent consultables.</li>` : ''}
        <li>Il disparaîtra des alertes, statistiques, rapports et suggestions de commande.</li>
        <li>Son historique est conservé. Vous pourrez l'afficher à nouveau à tout moment (bouton « Produits masqués »).</li></ul>`;
    confirmDialog(`Ne plus afficher « ${p.name} » ?`, async () => {
      await setProductStatus(id, 'archived');
      toast(`« ${p.name} » n'est plus affiché. Retrouvez-le dans « Produits masqués ».`, 'ok', 6000);
    }, { title: 'Ne plus afficher ce produit', yes: 'Ne plus afficher', danger: true, details });
  }
  async function afficher(id) {
    const p = productById(id); if (!p) return;
    await setProductStatus(id, 'active');
    toast(`« ${p.name} » est de nouveau affiché partout.`, 'ok');
  }

  /* Clic sur un bouton œil : intercepté AVANT l'ouverture de la fiche produit */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-vis]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const p = productById(b.dataset.vis); if (!p) return;
    if (p.status === 'archived') guard(b, () => afficher(p.id));
    else demanderMasquage(p.id);
  }, true);
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-vis]')) e.stopPropagation();
  }, true);

  /* ---------- Fenêtre « Produits masqués » ---------- */
  function gererMasques() {
    let filtre = '';
    const liste = () => {
      const t = norm(filtre);
      const rows = masques().filter(p => !t || norm(p.name).includes(t) || norm(p.sku).includes(t))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!masques().length) return `<p class="muted" style="padding:14px 4px">Aucun produit masqué : tous vos produits sont affichés.</p>`;
      if (!rows.length) return `<p class="muted" style="padding:14px 4px">Aucun produit masqué ne correspond à la recherche.</p>`;
      return rows.map(p => `<div class="vis-item">${productThumb(p)}
          <div class="grow"><b>${esc(p.name)}</b><small class="mono">${esc(p.sku)} · ${esc(catName(p.categoryId))} · ${fmtNum(productQty(p))} ${esc(p.unit)} · ${fmtMoney(productValue(p))}</small></div>
          ${peutModifier() ? `<button type="button" class="btn sm gold" data-show="${esc(p.id)}" aria-label="Afficher à nouveau : ${esc(p.name)}">${IC_EYE} Afficher</button>` : ''}</div>`).join('');
    };
    openModal({
      title: 'Produits masqués', wide: true,
      body: `<p style="line-height:1.6">Ces produits ne sont plus affichés dans l'application (tableau de bord, alertes, statistiques, rapports…). Leur historique est conservé. Cliquez sur <b>Afficher</b> pour les remettre partout.</p>
        <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap"><div class="search grow" style="max-width:none"><input id="visQ" type="search" class="inp" placeholder="Rechercher un produit masqué…" aria-label="Rechercher un produit masqué"></div>
        ${peutModifier() ? `<button type="button" class="btn" id="visAll">${IC_EYE} Tout afficher</button>` : ''}</div>
        <div class="vis-list" id="visList" aria-live="polite"></div>`,
      footer: `<button class="btn ghost" type="button" data-close>Fermer</button>`,
      onOpen: m => {
        const draw = () => {
          $('#visList', m).innerHTML = liste(); hydrateMedia($('#visList', m));
          const all = $('#visAll', m); if (all) all.disabled = !masques().length;
          $$('[data-show]', m).forEach(b => b.onclick = () => guard(b, async () => { await afficher(b.dataset.show); draw(); }));
        };
        $('#visQ', m).oninput = e => { filtre = e.target.value; draw(); };
        const all = $('#visAll', m);
        if (all) all.onclick = () => guard(all, async () => {
          const ids = masques().map(p => p.id); if (!ids.length) return;
          const put = ids.map(id => ({ ...clone(productById(id)), status: 'active', updatedAt: nowStamp() }));
          await commit({ put: { products: put, journal: [journalEntry('product', `a de nouveau affiché <b>${ids.length}</b> produit(s) masqué(s)`, { type: 'product', id: ids[0] })] } }, { what: 'product' });
          toast(`${ids.length} produit(s) de nouveau affiché(s) partout.`, 'ok'); draw();
        });
        draw();
      }
    });
  }
  window.gererProduitsMasques = gererMasques;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-vis-manage]');
    if (b) { e.preventDefault(); gererMasques(); }
  });
  const boutonGerer = () => `<button type="button" class="btn" data-vis-manage>${IC_EYE_OFF} Produits masqués <span class="vis-count">(${masques().length})</span></button>`;

  /* ---------- Page Produits : bouton « Produits masqués (n) » ---------- */
  const _products = VIEWS.products;
  VIEWS.products = function (el) {
    const r = _products.apply(this, arguments);
    const actions = $('.page-head .row', el);
    if (actions) actions.insertAdjacentHTML('afterbegin', boutonGerer());
    return r;
  };

  /* ---------- Tableau de bord : rappel des produits masqués ---------- */
  const _dash = VIEWS.dashboard;
  VIEWS.dashboard = function (el) {
    const r = _dash.apply(this, arguments);
    const n = masques().length;
    const head = $('.page-head', el);
    if (n && head) head.insertAdjacentHTML('afterend', `<div class="notice" role="note">${IC_EYE_OFF}<div class="grow"><b>${n} produit(s) masqué(s)</b> — ils ne sont pas comptés dans ce tableau de bord (valeur, alertes, indicateurs).</div>${boutonGerer().replace('class="btn"', 'class="btn sm"')}</div>`);
    return r;
  };

  /* Affichage à jour dès le chargement du script */
  if (typeof refreshView === 'function' && typeof SESSION_OP !== 'undefined' && SESSION_OP) refreshView();
})();