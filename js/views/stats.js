/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/stats.js
   Statistiques et consommation, pensées pour un dirigeant de petite
   entreprise : chaque indicateur est expliqué en langage simple, et
   aucune tendance n'est affichée quand les données sont insuffisantes.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const STAT = { period: '30', from: '', to: '', compare: false, cmpFrom: '', cmpTo: '', flow: 'value' };

/* Période de comparaison : période précédente de même durée (ou dates choisies) */
function comparePeriod(P) {
  if (STAT.cmpFrom && STAT.cmpTo) return { from: STAT.cmpFrom <= STAT.cmpTo ? STAT.cmpFrom : STAT.cmpTo, to: STAT.cmpFrom <= STAT.cmpTo ? STAT.cmpTo : STAT.cmpFrom, label: `Du ${fmtDate(STAT.cmpFrom)} au ${fmtDate(STAT.cmpTo)}` };
  const days = daysBetween(P.from, P.to) + 1;
  const to = addDays(P.from, -1), from = addDays(to, -days + 1);
  return { from, to, label: `Période précédente (${fmtDate(from)} – ${fmtDate(to)})` };
}
function deltaChip(a, b, { better = 'up', fmt = fmtMoney, minBase = 0.01 } = {}) {
  if (b === null || b === undefined || a === null || a === undefined) return `<span class="chip xs" title="Données insuffisantes">—</span>`;
  if (Math.abs(b) < minBase) return `<span class="chip xs" title="Pas de base de comparaison">n.c.</span>`;
  const pct = (a - b) / Math.abs(b) * 100;
  const up = pct >= 0; const good = better === 'none' ? null : (up === (better === 'up'));
  return `<span class="chip xs ${good === null ? '' : good ? 'ok' : 'warn'}">${up ? '▲' : '▼'} ${fmtPct(Math.abs(pct), Math.abs(pct) < 10 ? 1 : 0)}<span class="sr-only"> par rapport à ${esc(fmt(b))}</span></span>`;
}

VIEWS.stats = (el) => {
  const P = statePeriod(STAT);
  const A = periodSummary(P);
  const C = STAT.compare ? comparePeriod(P) : null;
  const B = C ? periodSummary(C) : null;
  const hasData = S.movements.length > 0;
  const k = (icon, cls, num, lbl, help, cmp = '') => `<div class="kpi"><div class="ic ${cls}">${svg(icon)}</div><div class="num sm2">${num}</div><div class="lbl">${lbl}</div>${cmp ? `<div class="kpi-cmp">${cmp}</div>` : ''}<p class="kpi-help">${help}</p></div>`;
  el.innerHTML = pageHead('Statistiques et consommation', crumbFor('statistiques'),
    can('export') ? `<button type="button" class="btn" id="stCsv">${svg('down')} Export CSV</button><button type="button" class="btn" id="stPrint">${svg('printer')} Imprimer</button>` : '',
    'Analyse calculée uniquement à partir des mouvements enregistrés dans l\'application.') +
    `<div class="row wrap between" style="margin-bottom:18px;gap:12px">${periodControls(STAT, 'sp')}
      <label class="chk-inline"><input type="checkbox" id="stCmp" ${STAT.compare ? 'checked' : ''}> Comparer à une autre période</label></div>
    ${STAT.compare ? `<div class="notice" style="margin-bottom:18px">${svg('info')}<div class="grow">Comparaison : <b>${esc(P.label)}</b> face à <b>${esc(C.label)}</b>.
      <span class="row wrap" style="margin-top:8px;gap:8px"><label for="cmpFrom" class="soft">Autre période :</label><input class="inp" type="date" id="cmpFrom" value="${STAT.cmpFrom}" style="width:auto"><input class="inp" type="date" id="cmpTo" value="${STAT.cmpTo}" style="width:auto" aria-label="Fin de la période de comparaison"><button type="button" class="btn sm" id="cmpApply">Appliquer</button><button type="button" class="btn sm ghost" id="cmpPrev">Période précédente</button></span></div></div>` : ''}
    ${!hasData ? `<div class="notice">${svg('info')}<div>Aucun mouvement n'est encore enregistré : les statistiques apparaîtront au fil de vos entrées et sorties.</div></div>` : ''}
    <div class="kpi-grid k6">
      ${k('euro', 'ok', fmtMoneyShort(sum(S.products, productValue)), 'Valeur actuelle du stock', 'Quantités × prix d\'achat unitaire (valorisation ' + (SETTINGS.valuation === 'cump' ? 'au coût moyen pondéré' : 'au dernier prix') + ').')}
      ${k('arrin', 'ok', fmtMoneyShort(A.inV), 'Valeur des entrées', `${A.nIn} entrée(s) / réception(s), ${fmtNum(A.inQ)} unités.`, B ? deltaChip(A.inV, B.inV, { better: 'none' }) : '')}
      ${k('arrout', 'warn', fmtMoneyShort(A.outV), 'Coût des consommations', `${A.nOut} sortie(s), ${fmtNum(A.outQ)} unités, valorisées au prix d'achat.`, B ? deltaChip(A.outV, B.outV, { better: 'none' }) : '')}
      ${k('swap', '', A.rotation === null ? '—' : A.rotation.toLocaleString('fr-FR', { maximumFractionDigits: 2 }), 'Taux de rotation', A.rotation === null ? 'Non calculable : pas de sortie ou pas de stock valorisé sur la période.' : `Le stock moyen (${fmtMoney(A.avgValue)}) a été « consommé » ${A.rotation.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} fois sur la période.`, B && A.rotation !== null && B.rotation !== null ? deltaChip(A.rotation, B.rotation, { better: 'up', fmt: v => v.toFixed(2) }) : '')}
      ${k('clock', '', A.storageDays === null ? '—' : Math.round(A.storageDays) + ' j', 'Durée moyenne de stockage', A.storageDays === null ? 'Données insuffisantes pour l\'estimer.' : 'Estimation : durée de la période ÷ taux de rotation. Plus elle est courte, moins l\'argent reste immobilisé.', B && A.storageDays !== null && B.storageDays !== null ? deltaChip(A.storageDays, B.storageDays, { better: 'down', fmt: v => Math.round(v) + ' j' }) : '')}
      ${k('x', A.ruptures ? 'dng' : 'ok', fmtNum(A.ruptures, 0), 'Ruptures sur la période', 'Nombre de fois où un produit est passé d\'un stock positif à zéro.', B ? deltaChip(A.ruptures, B.ruptures, { better: 'down', fmt: v => v, minBase: 1 }) : '')}
    </div>
    <div class="cols">
      ${chartPanel('stFlow', 'Consommation par période', legendItem('s2', 'Sorties') + legendItem('s1', 'Entrées'), `<div class="seg" role="group" aria-label="Unité"><button type="button" data-sflow="value" class="${STAT.flow === 'value' ? 'on' : ''}" aria-pressed="${STAT.flow === 'value'}">€</button><button type="button" data-sflow="qty" class="${STAT.flow === 'qty' ? 'on' : ''}" aria-pressed="${STAT.flow === 'qty'}">Qté</button></div>`)}
      ${chartPanel('stCat', 'Consommation par catégorie')}
    </div>
    <div class="cols" style="margin-top:20px">
      <section class="panel"><div class="panel-h"><h3>Produits à forte consommation</h3></div><div class="panel-b" id="stTop"></div></section>
      <section class="panel"><div class="panel-h"><h3>Sorties par motif</h3></div><div class="panel-b" id="stReason"></div></section>
    </div>
    <section class="panel" style="margin-top:20px"><div class="panel-h"><h3>Consommation par produit</h3><small class="muted">${esc(P.label)}</small></div><div class="panel-b" style="padding:0" id="stByProd"></div></section>
    <div class="cols" style="margin-top:20px">
      <section class="panel"><div class="panel-h"><h3>Produits à faible rotation</h3></div><div class="panel-b" id="stSlow"></div></section>
      <section class="panel"><div class="panel-h"><h3>Fréquence des ruptures</h3></div><div class="panel-b" id="stRupt"></div></section>
    </div>
    <div class="cols" style="margin-top:20px">
      <section class="panel"><div class="panel-h"><h3>Évolution des prix d'achat</h3></div><div class="panel-b" id="stPrice"></div></section>
      <section class="panel"><div class="panel-h"><h3>Historique des réapprovisionnements</h3></div><div class="panel-b" id="stSupply"></div></section>
    </div>`;

  const fl = flowSeries(P); const isV = STAT.flow === 'value';
  barChart($('#stFlow', el), { labels: fl.buckets.map(b => b.label), series: [{ name: 'Sorties', values: isV ? fl.outV : fl.outQ, cls: 's2' }, { name: 'Entrées', values: isV ? fl.inV : fl.inQ, cls: 's1' }], fmt: v => isV ? fmtMoney(v) : fmtNum(v), axisFmt: isV ? fmtMoneyShort : v => fmtNum(v, 0), label: 'Consommation et entrées par période' });
  const cc = consumptionByCategory(P);
  donutChart($('#stCat', el), cc.map(c => ({ name: catName(c.categoryId), value: c.value })), { label: 'Coût des consommations par catégorie' });
  bindChartToggles(el, {
    stFlow: () => chartTable(fl.buckets.map(b => b.label), [{ name: 'Sorties (qté)', values: fl.outQ }, { name: 'Sorties (€)', values: fl.outV }, { name: 'Entrées (qté)', values: fl.inQ }, { name: 'Entrées (€)', values: fl.inV }], v => fmtNum(v)),
    stCat: () => chartTable(cc.map(c => catName(c.categoryId)), [{ name: 'Quantité', values: cc.map(c => c.qty) }, { name: 'Coût', values: cc.map(c => c.value) }], v => fmtNum(round2(v)), 'Catégorie')
  });
  $$('[data-sflow]', el).forEach(b => b.onclick = () => { STAT.flow = b.dataset.sflow; route({ keepScroll: true }); });

  const cons = consumptionByProduct(P);
  const days = daysBetween(P.from, P.to) + 1;
  $('#stTop', el).innerHTML = rankBars(cons.slice().sort((a, b) => b.qty - a.qty).slice(0, 8).map(r => ({ label: productById(r.productId)?.name || '?', value: r.qty, attrs: ` data-prod="${r.productId}" role="button" tabindex="0"` })), { fmt: v => fmtNum(v), empty: 'Aucune sortie sur la période.' });
  const reasons = consumptionByReason(P);
  $('#stReason', el).innerHTML = rankBars(reasons.map(r => ({ label: r.reason, value: r.value })), { fmt: fmtMoney, empty: 'Aucune sortie sur la période.' });
  const cmpMap = B ? new Map(consumptionByProduct(C).map(r => [r.productId, r])) : null;
  $('#stByProd', el).innerHTML = cons.length ? `<div class="tbl-wrap flat"><table class="tbl"><caption class="sr-only">Consommation par produit sur la période</caption><thead><tr><th scope="col">Produit</th><th scope="col">Catégorie</th><th scope="col" class="num-c">Quantité sortie</th><th scope="col" class="num-c">Moyenne / jour</th><th scope="col" class="num-c">Coût</th>${B ? '<th scope="col" class="num-c">Évolution</th>' : ''}<th scope="col" class="num-c">Stock actuel</th><th scope="col" class="num-c">Couverture</th></tr></thead><tbody>
    ${cons.slice(0, 50).map(r => { const p = productById(r.productId); const a = anaOf(r.productId); const b = cmpMap?.get(r.productId);
    return `<tr data-prod="${r.productId}" tabindex="0"><td><b>${esc(p?.name || '?')}</b><small class="mono muted d-block">${esc(p?.sku || '')}</small></td><td>${esc(catName(p?.categoryId))}</td><td class="num-c mono">${fmtNum(r.qty)} <small class="muted">${esc(p?.unit || '')}</small></td><td class="num-c mono">${fmtNum(round2(r.qty / days))}</td><td class="num-c mono">${fmtMoney(r.value)}</td>
      ${B ? `<td class="num-c">${b ? deltaChip(r.qty, b.qty, { better: 'none', fmt: fmtNum }) : '<span class="chip xs" title="Aucune sortie sur la période de comparaison">nouveau</span>'}</td>` : ''}<td class="num-c mono">${fmtNum(a?.qty || 0)}</td><td class="num-c mono">${a?.daysCover == null ? '—' : Math.floor(a.daysCover) + ' j'}</td></tr>`; }).join('')}
    </tbody></table></div>${cons.length > 50 ? `<p class="muted" style="padding:10px 16px">50 premiers produits sur ${cons.length} — l'export CSV contient la liste complète.</p>` : ''}` : `<p class="muted" style="padding:16px 20px">Aucune sortie de stock sur la période.</p>`;

  const slow = slowMovers(P).slice(0, 8);
  $('#stSlow', el).innerHTML = slow.length ? `<p class="soft small-p">Produits en stock dont moins d'un quart de la quantité a été consommée sur la période — argent potentiellement immobilisé.</p>` + slow.map(s => { const p = productById(s.productId); return `<button type="button" class="list-row" data-prod="${s.productId}"><div><b>${esc(p.name)}</b><small class="muted d-block">${fmtNum(s.cons)} sorti(s) pour ${fmtNum(s.qty)} en stock</small></div><span class="mono">${fmtMoney(s.value)}</span></button>`; }).join('') : '<p class="muted">Aucun produit à faible rotation détecté.</p>';
  const rupt = rupturesByProduct(P).slice(0, 8);
  $('#stRupt', el).innerHTML = rankBars(rupt.map(r => ({ label: productById(r.productId)?.name || '?', value: r.n, attrs: ` data-prod="${r.productId}" role="button" tabindex="0"` })), { fmt: v => v + ' fois', empty: 'Aucune rupture sur la période.' });
  const pc = priceChanges(P).slice(0, 10);
  $('#stPrice', el).innerHTML = pc.length ? `<div class="tbl-wrap flat"><table class="tbl" style="min-width:0"><thead><tr><th scope="col">Produit</th><th scope="col" class="num-c">Avant</th><th scope="col" class="num-c">Dernier prix</th><th scope="col" class="num-c">Variation</th></tr></thead><tbody>
    ${pc.map(x => `<tr data-prod="${x.productId}" tabindex="0"><td>${esc(productById(x.productId)?.name)}</td><td class="num-c mono">${fmtMoney(x.first)}</td><td class="num-c mono">${fmtMoney(x.last)}</td><td class="num-c">${x.pct === null ? '—' : `<span class="chip xs ${x.pct > 0 ? 'warn' : 'ok'}">${x.pct > 0 ? '▲' : '▼'} ${fmtPct(Math.abs(x.pct), 1)}</span>`}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted">Pas assez d\'entrées avec prix sur la période pour mesurer une évolution (au moins deux achats d\'un même produit sont nécessaires).</p>';
  const sup = supplyHistory(P).slice(0, 12);
  $('#stSupply', el).innerHTML = sup.length ? `<div class="mv-list">${sup.map(movementMini).join('')}</div><p class="muted small-p" style="margin-top:10px">Total de la période : ${fmtMoney(A.spend)} sur ${A.nIn} opération(s).</p>` : '<p class="muted">Aucun réapprovisionnement sur la période.</p>';

  $$('[data-prod]', el).forEach(r => { r.onclick = () => openProductDrawer(r.dataset.prod); r.onkeydown = e => { if (e.key === 'Enter') openProductDrawer(r.dataset.prod); }; });
  $$('[data-mvd]', el).forEach(b => b.onclick = () => movementDetail(b.dataset.mvd));
  bindPeriodControls(el, STAT, () => route({ keepScroll: true }), 'sp');
  $('#stCmp', el).onchange = e => { STAT.compare = e.target.checked; route({ keepScroll: true }); };
  if ($('#cmpApply', el)) $('#cmpApply', el).onclick = () => { STAT.cmpFrom = $('#cmpFrom', el).value; STAT.cmpTo = $('#cmpTo', el).value; if (!STAT.cmpFrom || !STAT.cmpTo) return toast('Choisissez les deux dates.', 'warn'); route({ keepScroll: true }); };
  if ($('#cmpPrev', el)) $('#cmpPrev', el).onclick = () => { STAT.cmpFrom = ''; STAT.cmpTo = ''; route({ keepScroll: true }); };
  if ($('#stCsv', el)) $('#stCsv', el).onclick = () => exportConsumptionCSV(P);
  if ($('#stPrint', el)) $('#stPrint', el).onclick = () => printStats(P, A);
};
