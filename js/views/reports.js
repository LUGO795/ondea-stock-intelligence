/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/reports.js
   Rapports et exports centralisés : CSV (Excel), impression / PDF,
   sauvegarde complète JSON. Les exports respectent la période et les
   filtres choisis en haut de page.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const REP = { period: '30', from: '', to: '', cat: '', loc: '', inv: '' };

VIEWS.reports = (el) => {
  const P = statePeriod(REP);
  const invs = S.inventories.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!REP.inv && invs.length) REP.inv = invs[0].id;
  const last = PREF.get('osi_last_backup');
  const card = (id, icon, title, desc, uses, btns) => `<article class="card pad rep-card"><div class="row" style="align-items:flex-start"><div class="kpi-ic ic">${svg(icon)}</div><div class="grow"><h3>${esc(title)}</h3><p class="soft">${desc}</p><small class="muted">${uses}</small></div></div><div class="row wrap rep-btns">${btns}</div></article>`;
  const b = (id, icon, lbl, cls = '') => `<button type="button" class="btn sm ${cls}" data-rep="${id}">${svg(icon)} ${lbl}</button>`;
  el.innerHTML = pageHead('Rapports et exports', crumbFor('rapports'), '', 'CSV compatible Excel (UTF-8, séparateur « ; »), impression A4 ou PDF, sauvegarde complète.') +
    `<section class="panel" style="margin-bottom:20px" aria-labelledby="rfT"><div class="panel-h"><h3 id="rfT">Filtres appliqués aux exports</h3><small class="muted">${esc(P.label)}</small></div><div class="panel-b">
      <div class="row wrap" style="gap:12px">${periodControls(REP, 'rp')}
      <label class="sr-only" for="rCat">Catégorie</label><select class="sel" id="rCat" style="width:auto"><option value="">Toutes catégories</option>${optCategories().map(([v, l]) => `<option value="${v}" ${REP.cat === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="rLoc">Emplacement</label><select class="sel" id="rLoc" style="width:auto"><option value="">Tous emplacements</option>${optLocations().map(([v, l]) => `<option value="${v}" ${REP.loc === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div></section>
    <div class="rep-grid">
      ${card('cat', 'box', 'Catalogue des produits', 'Toutes les fiches : références, prix, seuils, stock, valeur, niveau.', 'Filtres : catégorie, emplacement', b('catCsv', 'down', 'CSV') + b('catPrint', 'printer', 'Imprimer'))}
      ${card('state', 'warehouse', 'État des stocks', 'Quantités et valeur par produit et par emplacement, à l\'instant présent.', 'Filtres : catégorie, emplacement', b('stateCsv', 'down', 'CSV') + b('statePrint', 'printer', 'Imprimer'))}
      ${card('value', 'euro', 'Valeur du stock', 'Valorisation au prix d\'achat, par catégorie, avec total général.', 'Instantané', b('valCsv', 'down', 'CSV') + b('valPrint', 'printer', 'Imprimer'))}
      ${card('mv', 'swap', 'Historique des mouvements', 'Toutes les opérations tracées avec stock avant / après, opérateur et documents.', 'Filtres : période, catégorie, emplacement', b('mvCsv', 'down', 'CSV') + b('mvPrint', 'printer', 'Imprimer'))}
      ${card('rup', 'bell', 'Ruptures et alertes', 'Produits en rupture, sous le seuil ou à réapprovisionner, avec action recommandée.', 'Filtres : catégorie', b('rupCsv', 'down', 'CSV') + b('rupPrint', 'printer', 'Imprimer'))}
      ${card('cons', 'chart', 'Statistiques de consommation', 'Quantités sorties, coût, moyenne quotidienne et couverture par produit.', 'Filtres : période, catégorie', b('consCsv', 'down', 'CSV') + b('consPrint', 'printer', 'Imprimer'))}
      ${card('ord', 'cart', 'Commandes fournisseurs', 'Lignes de commande, quantités reçues et restantes, montants HT/TVA/TTC.', 'Filtre : période (date de création)', b('ordCsv', 'down', 'CSV') + b('ordPrint', 'printer', 'Imprimer'))}
      ${card('sup', 'users', 'Fiches fournisseurs', 'Coordonnées, conditions, délais, produits et commandes en cours.', 'Tous les fournisseurs', b('supCsv', 'down', 'CSV') + b('supPrint', 'printer', 'Imprimer'))}
      ${card('inv', 'clipcheck', 'Inventaire', invs.length ? `<label class="sr-only" for="rInv">Inventaire</label><select class="sel" id="rInv">${invs.map(v => `<option value="${v.id}" ${REP.inv === v.id ? 'selected' : ''}>${esc(v.number)} · ${esc(v.name)} (${INV_STATUS[v.status].label})</option>`).join('')}</select>` : 'Aucun inventaire pour le moment.', 'Écarts, valeurs et observations', invs.length ? b('invCsv', 'down', 'CSV') + b('invPrint', 'printer', 'Imprimer') : '')}
    </div>
    <section class="panel backup-panel" style="margin-top:22px" aria-labelledby="bkT"><div class="panel-h"><h3 id="bkT">Sauvegarde complète et restauration</h3>${last ? `<span class="chip ok">Dernière sauvegarde : ${fmtDateTime(last)}</span>` : '<span class="chip warn">Aucune sauvegarde exportée depuis ce navigateur</span>'}</div><div class="panel-b">
      <p class="soft" style="margin-bottom:14px">Le fichier JSON contient <b>toutes</b> les données : produits, catégories, emplacements, fournisseurs, mouvements, commandes, inventaires, journal, réglages, opérateurs, compteurs de numérotation <b>et les images</b> (encodées dans le fichier). Conservez-le sur une clé USB ou un espace de stockage sécurisé.</p>
      <div class="row wrap" style="gap:10px"><button type="button" class="btn gold" id="bkExport">${svg('down')} Exporter la sauvegarde (JSON)</button>
      ${can('*') || SESSION_OP?.role === 'admin' ? `<label class="btn" style="cursor:pointer">${svg('up')} Restaurer une sauvegarde…<input type="file" id="bkImport" accept="application/json,.json" class="sr-only"></label>` : '<small class="muted">La restauration est réservée aux administrateurs.</small>'}</div></div></section>`;

  const catF = p => !REP.cat || p?.categoryId === REP.cat;
  const locF = p => !REP.loc || (p?.stock?.[REP.loc] || 0) !== 0 || p?.locationId === REP.loc;
  const prods = () => S.products.filter(p => catF(p) && locF(p)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const mvs = () => S.movements.filter(m => inPeriod(m, P) && catF(productById(m.productId)) && (!REP.loc || m.locId === REP.loc || m.toLocId === REP.loc)).reverse();
  const sub = `<div><span>Période</span><b>${esc(P.label)}</b></div>${REP.cat ? `<div><span>Catégorie</span><b>${esc(catName(REP.cat))}</b></div>` : ''}${REP.loc ? `<div><span>Emplacement</span><b>${esc(locName(REP.loc))}</b></div>` : ''}`;
  const subNow = `<div><span>Au</span><b>${fmtDateTime(nowStamp())}</b></div>${REP.cat ? `<div><span>Catégorie</span><b>${esc(catName(REP.cat))}</b></div>` : ''}${REP.loc ? `<div><span>Emplacement</span><b>${esc(locName(REP.loc))}</b></div>` : ''}`;
  const A = {
    catCsv: () => exportProductsCSV(prods()),
    catPrint: () => printTable('Catalogue des produits', subNow, ['Référence', 'Produit', 'Catégorie', 'Fournisseur', { t: 'Prix achat', r: 1 }, { t: 'Stock', r: 1 }, { t: 'Seuil', r: 1 }, { t: 'Valeur', r: 1 }], prods().map(p => [esc(p.sku), esc(p.name) + (p.status === 'archived' ? ' (archivé)' : ''), esc(catName(p.categoryId)), esc(p.supplierId ? supName(p.supplierId) : ''), fmtMoney(p.purchasePrice), fmtNum(productQty(p)) + ' ' + esc(p.unit), fmtNum(p.minStock), fmtMoney(productValue(p))])),
    stateCsv: () => { const keep = new Set(prods().map(p => p.id)); const save = S.products; try { S.products = save.filter(p => keep.has(p.id)); exportStockStateCSV(REP.loc); } finally { S.products = save; } },
    statePrint: () => { const rows = []; prods().filter(p => p.status === 'active').forEach(p => Object.entries(p.stock || {}).filter(([l]) => !REP.loc || l === REP.loc).forEach(([l, q]) => rows.push([esc(p.sku), esc(p.name), esc(locName(l)), fmtNum(q) + ' ' + esc(p.unit), fmtMoney(Math.max(0, q) * p.purchasePrice), esc(LEVEL[stockLevel(p)].label)])));
      printTable('État des stocks', subNow, ['Référence', 'Produit', 'Emplacement', { t: 'Quantité', r: 1 }, { t: 'Valeur', r: 1 }, 'Niveau'], rows, `Valeur totale : <b>${fmtMoney(sum(rows, r => 0) + sum(prods().filter(p => p.status === 'active'), p => sum(Object.entries(p.stock || {}).filter(([l]) => !REP.loc || l === REP.loc), ([, q]) => Math.max(0, q) * p.purchasePrice)))}</b>`); },
    valCsv: () => exportStockValueCSV(),
    valPrint: () => { const c = stockByCategory(); printTable('Valeur du stock', subNow, ['Catégorie', { t: 'Références', r: 1 }, { t: 'Unités', r: 1 }, { t: 'Valeur', r: 1 }], c.map(x => [esc(catName(x.categoryId)), x.refs, fmtNum(x.qty), fmtMoney(x.value)]).concat([['<b>Total</b>', sum(c, x => x.refs), fmtNum(sum(c, x => x.qty)), `<b>${fmtMoney(sum(c, x => x.value))}</b>`]])); },
    mvCsv: () => exportMovementsCSV(mvs()),
    mvPrint: () => printTable('Historique des mouvements', sub, ['N°', 'Date', 'Type', 'Produit', { t: 'Qté', r: 1 }, { t: 'Avant → après', r: 1 }, 'Motif / doc.', 'Opérateur'], mvs().slice(0, 1500).map(m => { const p = productById(m.productId); return [esc(m.number), fmtDateTime(m.date), esc(MV_TYPES[m.type].label) + (m.cancelledById ? ' (annulé)' : ''), esc(p?.name || ''), (m.delta > 0 ? '+' : m.delta < 0 ? '−' : '') + fmtNum(m.qty), fmtNum(m.qtyBefore) + ' → ' + fmtNum(m.qtyAfter), esc([m.reason, m.docRef].filter(Boolean).join(' · ')), esc(m.operatorName)]; }), mvs().length > 1500 ? 'Impression limitée aux 1 500 mouvements les plus récents ; l\'export CSV est complet.' : ''),
    rupCsv: () => { const save = S.products; try { const keep = new Set(prods().map(p => p.id)); _alertCache.v = -1; S.products = save.filter(p => keep.has(p.id)); exportRupturesCSV(); } finally { S.products = save; _alertCache.v = -1; } },
    rupPrint: () => { const list = activeAlerts().filter(a => ['rupture', 'low', 'near', 'reorder'].includes(a.type) && catF(productById(a.productId)));
      printTable('Ruptures et alertes de stock', subNow, ['Priorité', 'Alerte', 'Produit', { t: 'Stock', r: 1 }, { t: 'Seuil', r: 1 }, { t: 'À commander', r: 1 }, 'Action recommandée'], list.map(a => { const p = productById(a.productId); return [PRIO[a.prio].label, esc(ALERT_TYPES[a.type].label), esc(p.name), fmtNum(a.qty) + ' ' + esc(p.unit), fmtNum(a.threshold), fmtNum(anaOf(p.id).recommended), esc(a.action)]; })); },
    consCsv: () => { const save = S.movements; try { S.movements = save.filter(m => catF(productById(m.productId))); exportConsumptionCSV(P); } finally { S.movements = save; } },
    consPrint: () => { const save = S.movements; try { S.movements = save.filter(m => catF(productById(m.productId))); printStats(P, periodSummary(P)); } finally { S.movements = save; } },
    ordCsv: () => exportOrdersCSV(S.orders.filter(o => { const d = dayOf(o.createdAt); return d >= P.from && d <= P.to; })),
    ordPrint: () => { const list = S.orders.filter(o => { const d = dayOf(o.createdAt); return d >= P.from && d <= P.to; }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      printTable('Commandes fournisseurs', sub, ['N°', 'Fournisseur', 'Créée le', 'Livraison prévue', 'Statut', { t: 'Reçu', r: 1 }, { t: 'Total HT', r: 1 }, { t: 'Total TTC', r: 1 }], list.map(o => { const t = orderTotals(o); return [esc(o.number), esc(supName(o.supplierId)), fmtDate(o.createdAt), fmtDate(o.expectedDate), esc(ORDER_STATUS[o.status].label), fmtNum(sum(o.lines, l => l.received || 0)) + ' / ' + fmtNum(sum(o.lines, l => l.qty)), fmtMoney(t.ht), fmtMoney(t.ttc)]; })); },
    supCsv: () => exportSuppliersCSV(),
    supPrint: () => printTable('Fiches fournisseurs', subNow, ['Fournisseur', 'Contact', 'Téléphone / e-mail', 'Adresse', { t: 'Délai', r: 1 }, 'Paiement', { t: 'Produits', r: 1 }], S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(s => [esc(s.name) + (s.status === 'archived' ? ' (archivé)' : ''), esc(s.contact || ''), esc([s.phone, s.email].filter(Boolean).join(' · ')), esc(s.address || '').replace(/\n/g, '<br>'), s.leadTime != null ? s.leadTime + ' j' : '', esc(s.paymentTerms || ''), S.products.filter(p => p.supplierId === s.id).length])),
    invCsv: () => { const v = inventoryById(REP.inv); if (v) exportInventoryCSV(v); },
    invPrint: () => { const v = inventoryById(REP.inv); if (v) printInventory(v); }
  };
  $$('[data-rep]', el).forEach(btn => btn.onclick = () => { try { A[btn.dataset.rep](); } catch (e) { showError(e); } });
  bindPeriodControls(el, REP, () => route({ keepScroll: true }), 'rp');
  $('#rCat', el).onchange = e => { REP.cat = e.target.value; };
  $('#rLoc', el).onchange = e => { REP.loc = e.target.value; };
  if ($('#rInv', el)) $('#rInv', el).onchange = e => { REP.inv = e.target.value; };
  $('#bkExport', el).onclick = e => guard(e.currentTarget, exportBackup);
  if ($('#bkImport', el)) $('#bkImport', el).onchange = e => { const f = e.target.files[0]; if (f) restoreFromFile(f); e.target.value = ''; };
};
