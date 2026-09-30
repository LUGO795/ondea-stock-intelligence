/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/dashboard.js
   Tableau de bord : indicateurs calculés à partir des données réelles,
   graphiques interactifs filtrables par période, alertes prioritaires
   et activité récente cliquable.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const DASH = { period: '30', from: '', to: '', flow: 'value' };

/* ---------- Sélecteur de période (partagé avec Statistiques et Rapports) ---------- */
function periodControls(state, id = 'per') {
  const opts = [['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['year', 'Année en cours'], ['custom', 'Personnalisée']];
  return `<div class="period-bar" role="group" aria-label="Période analysée">
    <div class="seg">${opts.map(([k, l]) => `<button type="button" data-per="${k}" class="${state.period === k ? 'on' : ''}" aria-pressed="${state.period === k}">${l}</button>`).join('')}</div>
    <div class="row per-custom ${state.period === 'custom' ? '' : 'hide'}" id="${id}Custom">
      <label class="sr-only" for="${id}From">Du</label><input class="inp" type="date" id="${id}From" value="${state.from || addDays(todayISO(), -29)}" style="width:auto">
      <span class="muted" aria-hidden="true">→</span>
      <label class="sr-only" for="${id}To">Au</label><input class="inp" type="date" id="${id}To" value="${state.to || todayISO()}" style="width:auto">
      <button type="button" class="btn sm" id="${id}Apply">Appliquer</button></div></div>`;
}
function bindPeriodControls(root, state, redraw, id = 'per') {
  $$('[data-per]', root).forEach(b => b.onclick = () => {
    state.period = b.dataset.per;
    if (state.period === 'custom') { $('#' + id + 'Custom', root).classList.remove('hide'); $$('[data-per]', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); $('#' + id + 'From', root).focus(); return; }
    redraw();
  });
  const ap = $('#' + id + 'Apply', root);
  if (ap) ap.onclick = () => {
    const f = $('#' + id + 'From', root).value, t = $('#' + id + 'To', root).value;
    if (!f || !t) return toast('Choisissez une date de début et une date de fin.', 'warn');
    state.from = f; state.to = t; redraw();
  };
}
const statePeriod = st => periodFromKey(st.period, { from: st.from, to: st.to });

/* ---------- Carte KPI (même composant que la référence) ---------- */
function kpiCard({ icon, cls = '', num, lbl, trend = '', go: target = '', sub = '', small = false }) {
  const attrs = target ? ` data-goto="${target}" role="link" tabindex="0" title="Ouvrir la section"` : '';
  return `<div class="kpi${target ? ' clickable' : ''}"${attrs}><div class="ic ${cls}">${svg(icon)}</div>
    <div class="num${small ? ' sm' : ''}">${num}</div><div class="lbl">${lbl}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}${trend ? `<div class="trend gold">${trend}</div>` : ''}</div>`;
}
function bindKpiLinks(root) {
  $$('[data-goto]', root).forEach(c => {
    const [id, q] = c.dataset.goto.split('?');
    const params = {}; (q || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = v; });
    c.onclick = () => go(id, params);
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(id, params); } };
  });
}

/* ---------- Bandeau « données de démonstration » ---------- */
function demoBanner() {
  const n = S.products.filter(p => p.demo).length;
  if (!n) return '';
  return `<div class="notice demo-notice" role="note">${svg('info')}<div><b>Données de démonstration actives</b> — ${n} produits fictifs, identifiés par l'étiquette <span class="chip gold">Démo</span>.
    Vous pouvez les supprimer à tout moment sans toucher à vos propres données.</div>
    ${can('demo') ? `<button type="button" class="btn sm" id="demoRemove">${svg('trash')} Supprimer la démo</button>` : ''}</div>`;
}
function bindDemoBanner(root) { const b = $('#demoRemove', root); if (b) b.onclick = () => confirmRemoveDemo(); }

/* ---------- Démarrage guidé (base vide) ---------- */
function gettingStarted() {
  const steps = [
    { ok: S.locations.length > 0, t: 'Créer un emplacement de stockage', a: 'stocks', b: 'Emplacements' },
    { ok: S.categories.length > 0, t: 'Créer vos catégories', a: 'categories', b: 'Catégories' },
    { ok: S.suppliers.length > 0, t: 'Ajouter vos fournisseurs', a: 'fournisseurs', b: 'Fournisseurs' },
    { ok: S.products.length > 0, t: 'Créer votre premier produit (avec son stock initial)', a: 'produits', b: 'Produits', act: 'new' },
    { ok: S.movements.some(m => m.type !== 'initial'), t: 'Enregistrer une entrée ou une sortie', a: 'mouvements', b: 'Mouvements' }
  ];
  const done = steps.filter(s => s.ok).length;
  return `<section class="panel start-panel" aria-labelledby="gsT"><div class="panel-h"><h3 id="gsT">Démarrage guidé</h3><span class="chip gold">${done} / ${steps.length}</span></div>
    <div class="panel-b"><p class="soft" style="margin-bottom:14px">Suivez ces étapes pour mettre en place votre gestion des stocks. Vous pouvez aussi explorer l'application avec des données fictives.</p>
    <ol class="gs-list">${steps.map((s, i) => `<li class="${s.ok ? 'done' : ''}"><span class="gs-n" aria-hidden="true">${s.ok ? svg('check') : i + 1}</span><span class="grow">${esc(s.t)}${s.ok ? ' <span class="sr-only">(fait)</span>' : ''}</span>
      <a class="btn sm ${s.ok ? 'ghost' : ''}" href="#/${s.a}${s.act ? '?action=' + s.act : ''}">${esc(s.b)}</a></li>`).join('')}</ol>
    ${can('demo') ? `<div class="row wrap" style="margin-top:16px"><button type="button" class="btn" id="gsDemo">${svg('zap')} Charger les données de démonstration</button></div>` : ''}</div></section>`;
}

/* ═════════════════════ VUE ═════════════════════ */
VIEWS.dashboard = (el) => {
  const P = statePeriod(DASH);
  const k = dashboardKpis(P);
  const alerts = activeAlerts();
  const empty = !S.products.length;
  const canMove = can('stock.move');
  el.innerHTML = pageHead('Tableau de bord', crumb('Pilotage', 'Tableau de bord'),
    (canMove && !empty ? `<button type="button" class="btn" id="dIn">${svg('arrin')} Entrée</button><button type="button" class="btn" id="dOut">${svg('arrout')} Sortie</button>` : '') +
    (can('product.edit') ? `<button type="button" class="btn gold" id="dNew">${svg('plus')} Nouveau produit</button>` : ''),
    `Bonjour ${esc(SESSION_OP.name.split(' ')[0])} · ${esc(SETTINGS.companyName || '')} · ${fmtDate(todayISO())}`) +
    demoBanner() + (empty || S.products.length < 3 ? gettingStarted() : '') +
    `<div class="kpi-grid k8">
      ${kpiCard({ icon: 'box', num: fmtNum(k.refs, 0), lbl: 'Références actives', sub: k.archived ? `${k.archived} archivée(s)` : '', go: 'produits' })}
      ${kpiCard({ icon: 'layers', num: fmtNum(k.units), lbl: 'Unités en stock', go: 'stocks' })}
      ${kpiCard({ icon: 'euro', cls: 'ok', num: fmtMoneyShort(k.value), lbl: 'Valeur du stock (achat)', sub: fmtMoney(k.value), go: 'statistiques' })}
      ${kpiCard({ icon: 'warn', cls: 'warn', num: fmtNum(k.low, 0), lbl: 'Stock faible', go: 'produits?level=low' })}
      ${kpiCard({ icon: 'x', cls: k.rupt ? 'dng' : 'ok', num: fmtNum(k.rupt, 0), lbl: 'Ruptures', go: 'alertes?type=rupture' })}
      ${kpiCard({ icon: 'cart', num: fmtNum(k.pendingOrders, 0), lbl: 'Commandes en attente', go: 'commandes?status=open' })}
      ${kpiCard({ icon: 'swap', cls: 'ok', num: fmtNum(k.todayMv, 0), lbl: 'Mouvements du jour', go: 'mouvements?period=today' })}
      ${kpiCard({ icon: 'trend', num: `<span class="in-v">+${fmtMoneyShort(k.inV)}</span><span class="sep-v" aria-hidden="true">/</span><span class="out-v">−${fmtMoneyShort(k.outV)}</span>`, small: true, lbl: `Entrées / sorties · ${P.label.toLowerCase()}`, sub: `<span class="sr-only">Entrées ${fmtMoney(k.inV)}, sorties ${fmtMoney(k.outV)}</span>`, go: 'statistiques' })}
    </div>
    <div class="row wrap between" style="margin:4px 0 18px">${periodControls(DASH, 'dp')}<small class="muted">Période : ${esc(P.label)}</small></div>
    <div class="cols">
      ${chartPanel('chValue', 'Évolution de la valeur du stock')}
      ${chartPanel('chCat', 'Répartition du stock par catégorie')}
    </div>
    <div class="cols" style="margin-top:20px">
      ${chartPanel('chFlow', 'Entrées et sorties', legendItem('s1', 'Entrées') + legendItem('s2', 'Sorties'),
      `<div class="seg" role="group" aria-label="Unité"><button type="button" data-flow="value" class="${DASH.flow === 'value' ? 'on' : ''}" aria-pressed="${DASH.flow === 'value'}">€</button><button type="button" data-flow="qty" class="${DASH.flow === 'qty' ? 'on' : ''}" aria-pressed="${DASH.flow === 'qty'}">Qté</button></div>`)}
      <section class="panel" aria-labelledby="topT"><div class="panel-h"><h3 id="topT">Produits les plus consommés</h3><a class="btn sm ghost" href="#/statistiques">Détails</a></div><div class="panel-b" id="topCons"></div></section>
    </div>
    <div class="cols" style="margin-top:20px">
      ${chartPanel('chSpend', 'Dépenses d\'approvisionnement')}
      <section class="panel" aria-labelledby="rupT"><div class="panel-h"><h3 id="rupT">Produits les plus souvent en rupture</h3></div><div class="panel-b" id="topRupt"></div></section>
    </div>
    <div class="cols" style="margin-top:20px">
      <section class="panel" aria-labelledby="actT"><div class="panel-h"><h3 id="actT">Activité récente</h3><a class="btn sm ghost" href="#/mouvements">Historique</a></div><div class="panel-b" style="padding-top:6px" id="feed"></div></section>
      <section class="panel" aria-labelledby="alT"><div class="panel-h"><h3 id="alT">Alertes prioritaires</h3><span class="chip ${alerts.some(a => a.prio >= 3) ? 'dng' : 'ok'}">${alerts.length}</span></div><div class="panel-b" id="dAlerts"></div></section>
    </div>`;

  /* Graphiques */
  const vs = stockValueSeries(P);
  lineChart($('#chValue', el), { labels: vs.buckets.map(b => b.label), series: [{ name: 'Valeur du stock', values: vs.values, cls: 's1' }], fmt: v => fmtMoney(v), axisFmt: fmtMoneyShort, area: true, label: 'Évolution de la valeur du stock sur la période' });
  const cats = stockByCategory();
  donutChart($('#chCat', el), cats.map(c => ({ name: catName(c.categoryId), value: c.value })), { label: 'Répartition de la valeur du stock par catégorie' });
  const fl = flowSeries(P);
  const flowIsVal = DASH.flow === 'value';
  barChart($('#chFlow', el), { labels: fl.buckets.map(b => b.label), series: [{ name: 'Entrées', values: flowIsVal ? fl.inV : fl.inQ, cls: 's1' }, { name: 'Sorties', values: flowIsVal ? fl.outV : fl.outQ, cls: 's2' }], fmt: v => flowIsVal ? fmtMoney(v) : fmtNum(v), axisFmt: flowIsVal ? fmtMoneyShort : v => fmtNum(v, 0), label: 'Entrées et sorties par période' });
  lineChart($('#chSpend', el), { labels: fl.buckets.map(b => b.label), series: [{ name: 'Achats reçus', values: fl.inV, cls: 's3' }], fmt: v => fmtMoney(v), axisFmt: fmtMoneyShort, area: true, label: 'Évolution des dépenses d\'approvisionnement', empty: 'Aucune entrée de marchandises sur cette période.' });
  bindChartToggles(el, {
    chValue: () => chartTable(vs.buckets.map(b => b.label), [{ name: 'Valeur', values: vs.values }], fmtMoney),
    chCat: () => chartTable(cats.map(c => catName(c.categoryId)), [{ name: 'Valeur', values: cats.map(c => c.value) }, { name: 'Références', values: cats.map(c => c.refs) }], v => v > 1000 || !Number.isInteger(v) ? fmtMoney(v) : fmtNum(v), 'Catégorie'),
    chFlow: () => chartTable(fl.buckets.map(b => b.label), [{ name: 'Entrées (qté)', values: fl.inQ }, { name: 'Sorties (qté)', values: fl.outQ }, { name: 'Entrées (€)', values: fl.inV }, { name: 'Sorties (€)', values: fl.outV }], v => fmtNum(v)),
    chSpend: () => chartTable(fl.buckets.map(b => b.label), [{ name: 'Achats reçus', values: fl.inV }], fmtMoney)
  });
  $$('[data-flow]', el).forEach(b => b.onclick = () => { DASH.flow = b.dataset.flow; route({ keepScroll: true }); });

  const top = consumptionByProduct(P).sort((a, b) => b.qty - a.qty).slice(0, 7);
  $('#topCons', el).innerHTML = rankBars(top.map(r => ({ label: productById(r.productId)?.name || '?', value: r.qty, attrs: ` data-prod="${r.productId}" role="button" tabindex="0"` })), { fmt: v => fmtNum(v), empty: 'Aucune sortie de stock sur cette période.' });
  const rup = rupturesByProduct(P).slice(0, 7);
  $('#topRupt', el).innerHTML = rankBars(rup.map(r => ({ label: productById(r.productId)?.name || '?', value: r.n, attrs: ` data-prod="${r.productId}" role="button" tabindex="0"` })), { fmt: v => v + ' fois', empty: 'Aucune rupture sur cette période. 👏' });
  $$('[data-prod]', el).forEach(r => { r.onclick = () => openProductDrawer(r.dataset.prod); r.onkeydown = e => { if (e.key === 'Enter') openProductDrawer(r.dataset.prod); }; });

  /* Activité récente : mouvements + journal fusionnés */
  $('#feed', el).innerHTML = activityFeed(12);
  bindFeed(el);
  /* Alertes */
  $('#dAlerts', el).innerHTML = alerts.length ? alerts.slice(0, 6).map(alertRow).join('') + (alerts.length > 6 ? `<a class="btn sm ghost" style="margin-top:12px" href="#/alertes">Voir les ${alerts.length} alertes</a>` : '')
    : `<div class="row" style="color:var(--ok-300)">${svg('check')}<b>Aucune alerte : tous les stocks sont sous contrôle.</b></div>`;
  bindAlertRows(el);

  bindKpiLinks(el); bindDemoBanner(el);
  bindPeriodControls(el, DASH, () => route({ keepScroll: true }), 'dp');
  if ($('#dNew', el)) $('#dNew', el).onclick = () => productForm();
  if ($('#dIn', el)) $('#dIn', el).onclick = () => movementForm('in');
  if ($('#dOut', el)) $('#dOut', el).onclick = () => movementForm('out');
  if ($('#gsDemo', el)) $('#gsDemo', el).onclick = e => guard(e.currentTarget, async () => { await loadDemoData(); toast('Données de démonstration chargées', 'ok'); });
};

/* ---------- Fil d'activité ---------- */
function activityFeed(n = 12) {
  const mv = S.movements.slice(-n * 2).map(m => ({ at: m.at, kind: 'mv', m }));
  const jr = S.journal.filter(j => j.kind !== 'movement').slice(0, n * 2).map(j => ({ at: j.at, kind: 'jr', j }));
  const items = mv.concat(jr).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, n);
  if (!items.length) return `<div class="empty" style="padding:30px 10px"><h4>Aucune activité</h4><p>Les opérations apparaîtront ici.</p></div>`;
  return items.map(it => {
    if (it.kind === 'mv') {
      const m = it.m, p = productById(m.productId), t = MV_TYPES[m.type];
      const sign = m.type === 'transfer' ? '⇄' : m.delta > 0 ? '+' : m.delta < 0 ? '−' : '';
      return `<button type="button" class="feed-item feed-btn" data-mv="${m.id}"><span class="tm">${timeAgo(m.at)}</span>
        <span class="txt"><span class="chip ${t.cls} xs">${svg(t.icon)}${esc(t.label)}</span> <b>${esc(p?.name || '?')}</b>
        <span class="mono">${sign}${fmtNum(m.qty)} ${esc(p?.unit || '')}</span>${m.cancelledById ? ' <span class="chip dng xs">annulé</span>' : ''}
        <small class="muted feed-meta">${fmtDateTime(m.date)} · ${esc(m.number)}${m.operatorName ? ' · ' + esc(m.operatorName) : ''}</small></span></button>`;
    }
    const j = it.j;
    const icon = { product: 'box', order: 'cart', reception: 'truck', inventory: 'clipcheck', alert: 'warn', supplier: 'users', cancel: 'undo', system: 'gear' }[j.kind] || 'info';
    return `<button type="button" class="feed-item feed-btn" data-ref="${esc(j.ref?.type || '')}" data-id="${esc(j.ref?.id || '')}"><span class="tm">${timeAgo(j.at)}</span>
      <span class="txt">${svg(icon, 'feed-ic')} <b>${esc(j.operatorName || 'Système')}</b> ${j.text}<small class="muted feed-meta">${fmtDateTime(j.at)}</small></span></button>`;
  }).join('');
}
function bindFeed(root) {
  $$('.feed-btn', root).forEach(b => b.onclick = () => {
    if (b.dataset.mv) return movementDetail(b.dataset.mv);
    openRef(b.dataset.ref, b.dataset.id);
  });
}
function openRef(type, id) {
  if (!id) return;
  if (type === 'product' && productById(id)) return openProductDrawer(id);
  if (type === 'order' && orderById(id)) return openOrderDrawer(id);
  if (type === 'inventory' && inventoryById(id)) return go('inventaires', { id });
  if (type === 'supplier' && supplierById(id)) return openSupplierDrawer(id);
  if (type === 'movement' && movementById(id)) return movementDetail(id);
  toast('Cet élément n\'existe plus.', 'warn');
}
