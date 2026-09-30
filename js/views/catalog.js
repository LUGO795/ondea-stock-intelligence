/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/catalog.js
   Catégories  +  Stocks et entrepôts (emplacements, stock par emplacement).
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* ═════════════════════ CATÉGORIES ═════════════════════ */
VIEWS.categories = (el) => {
  const stats = new Map();
  S.products.forEach(p => {
    const k = p.categoryId || '_none';
    const s = stats.get(k) || { refs: 0, active: 0, units: 0, value: 0, alerts: 0 };
    s.refs++; if (p.status === 'active') { s.active++; s.units += Math.max(0, productQty(p)); s.value += productValue(p); if (['rupture', 'low'].includes(stockLevel(p))) s.alerts++; }
    stats.set(k, s);
  });
  const rows = S.categories.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const totalValue = sum([...stats.values()], s => s.value) || 1;
  const none = stats.get('_none');
  el.innerHTML = pageHead('Catégories', crumbFor('categories'),
    can('catalog.edit') ? `<button type="button" class="btn gold" id="cNew">${svg('plus')} Nouvelle catégorie</button>` : '',
    `${rows.length} catégorie(s) pour organiser votre catalogue`) +
    (rows.length || none ? `<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Catégories et indicateurs de stock</caption><thead><tr>
      <th scope="col">Catégorie</th><th scope="col" class="num-c">Références</th><th scope="col" class="num-c">Unités</th><th scope="col" class="num-c">Valeur</th><th scope="col">Part de la valeur</th><th scope="col">Alertes</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${rows.map(c => { const s = stats.get(c.id) || { refs: 0, active: 0, units: 0, value: 0, alerts: 0 }; return catRow(c.id, c.name, c.description, s, totalValue, c.demo); }).join('')}
      ${none ? catRow('_none', 'Sans catégorie', 'Produits non classés', none, totalValue) : ''}
      </tbody></table></div>`
      : emptyState('tag', 'Aucune catégorie', 'Les catégories regroupent vos produits (ex. Quincaillerie, Emballages, Consommables) et alimentent les statistiques.', can('catalog.edit') ? `<button type="button" class="btn gold" data-cnew>${svg('plus')} Créer une catégorie</button>` : ''));
  $$('[data-cat]', el).forEach(r => { r.onclick = e => { if (e.target.closest('button')) return; go('produits', { cat: r.dataset.cat }); }; r.onkeydown = e => { if (e.key === 'Enter' && e.target === r) go('produits', { cat: r.dataset.cat }); }; });
  $$('[data-cedit]', el).forEach(b => b.onclick = () => categoryForm(b.dataset.cedit));
  $$('[data-cdel]', el).forEach(b => b.onclick = () => { const c = categoryById(b.dataset.cdel); confirmDialog(`Supprimer la catégorie « ${c.name} » ?`, async () => { await deleteCategory(c.id); toast('Catégorie supprimée', 'ok'); }); });
  $$('#cNew,[data-cnew]', el).forEach(b => b.onclick = () => categoryForm());
};
function catRow(id, name, desc, s, total, demo) {
  const pct = s.value / total * 100;
  return `<tr data-cat="${id}" tabindex="0" aria-label="${esc(name)} : voir les produits">
    <td><div class="cell-user"><div class="av sm" aria-hidden="true">${esc(initialsOf(name))}</div><div><b>${esc(name)}</b>${demo ? ' <span class="chip gold xs">Démo</span>' : ''}<small>${esc(desc || '')}</small></div></div></td>
    <td class="num-c mono">${fmtNum(s.active)}${s.refs > s.active ? ` <small class="muted">(+${s.refs - s.active} arch.)</small>` : ''}</td>
    <td class="num-c mono">${fmtNum(s.units)}</td><td class="num-c mono">${fmtMoney(s.value)}</td>
    <td style="min-width:140px"><div class="stat-row" style="border:none;padding:0"><div class="lbar"><span style="width:${pct}%"></span></div><small class="mono" style="width:48px;text-align:right">${fmtPct(pct, 1)}</small></div></td>
    <td>${s.alerts ? `<span class="chip warn">${svg('warn')}${s.alerts}</span>` : '<span class="chip ok">' + svg('check') + 'OK</span>'}</td>
    <td class="qa-cell">${id !== '_none' && can('catalog.edit') ? `<button type="button" class="btn icon sm" data-cedit="${id}" aria-label="Modifier ${esc(name)}">${svg('edit')}</button><button type="button" class="btn icon sm danger" data-cdel="${id}" aria-label="Supprimer ${esc(name)}">${svg('trash')}</button>` : ''}</td></tr>`;
}
function categoryForm(id) {
  const c = id ? categoryById(id) : {};
  openModal({
    title: id ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    body: fieldHTML({ id: 'cfName', label: 'Nom', value: c.name || '', req: true }) + textareaHTML({ id: 'cfDesc', label: 'Description (facultatif)', value: c.description || '', rows: 2 }),
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="cfSave">Enregistrer</button>`,
    onOpen: m => {
      $('#cfName', m).onkeydown = e => { if (e.key === 'Enter') $('#cfSave', m).click(); };
      $('#cfSave', m).onclick = e => guard(e.currentTarget, async () => {
        try { await saveCategory({ name: val(m, 'cfName'), description: val(m, 'cfDesc') }, id); closeModal(1); toast('Catégorie enregistrée', 'ok'); }
        catch (err) { formError(m, err.message); markInvalid(m, ['cfName']); }
      });
    }
  });
}

/* ═════════════════════ STOCKS ET ENTREPÔTS ═════════════════════ */
const STK = { q: '', loc: '', only: true, page: 1 };
VIEWS.stocks = (el) => {
  const locs = S.locations.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const locStats = new Map(locs.map(l => [l.id, { refs: 0, units: 0, value: 0 }]));
  S.products.forEach(p => Object.entries(p.stock || {}).forEach(([l, q]) => { const s = locStats.get(l); if (!s) return; s.refs++; s.units += Math.max(0, q); s.value += Math.max(0, q) * p.purchasePrice; }));
  const tv = sum([...locStats.values()], s => s.value);
  el.innerHTML = pageHead('Stocks et entrepôts', crumbFor('stocks'),
    (can('stock.move') && S.products.length ? `<button type="button" class="btn" id="sTr">${svg('swap')} Transfert</button>` : '') +
    (can('catalog.edit') ? `<button type="button" class="btn gold" id="lNew">${svg('plus')} Nouvel emplacement</button>` : ''),
    `${locs.length} emplacement(s) · valeur totale ${fmtMoney(tv)}`) +
    `<div class="loc-grid">${locs.map(l => { const s = locStats.get(l.id); return `<article class="kpi loc-card"><div class="row between"><div class="ic">${svg('warehouse')}</div>
        ${can('catalog.edit') ? `<div class="row" style="gap:4px"><button type="button" class="btn icon sm" data-ledit="${l.id}" aria-label="Modifier ${esc(l.name)}">${svg('edit')}</button><button type="button" class="btn icon sm danger" data-ldel="${l.id}" aria-label="Supprimer ${esc(l.name)}">${svg('trash')}</button></div>` : ''}</div>
        <h3 class="loc-n">${esc(l.name)}${l.demo ? ' <span class="chip gold xs">Démo</span>' : ''}</h3><small class="muted">${esc([l.site, l.description].filter(Boolean).join(' · ') || '—')}</small>
        <div class="loc-m"><div><b class="mono">${fmtNum(s.refs)}</b><small>réf.</small></div><div><b class="mono">${fmtNum(s.units)}</b><small>unités</small></div><div><b class="mono">${fmtMoneyShort(s.value)}</b><small>valeur</small></div></div>
        <button type="button" class="btn sm ghost" data-lfilter="${l.id}" style="margin-top:12px">Voir le contenu</button></article>`; }).join('')
      || emptyState('warehouse', 'Aucun emplacement', 'Créez vos lieux de stockage : réserve, magasin, dépôt, véhicule, étagère A…', can('catalog.edit') ? `<button type="button" class="btn gold" data-lnew>${svg('plus')} Créer un emplacement</button>` : '')}</div>
    ${locs.length ? `<section class="panel" style="margin-top:22px" aria-labelledby="mxT"><div class="panel-h"><h3 id="mxT">Stock par emplacement</h3>
      <div class="row wrap"><div class="search" style="max-width:240px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="sQ" type="search" aria-label="Rechercher un produit" placeholder="Produit…" value="${esc(STK.q)}"></div>
      <label class="sr-only" for="sLoc">Emplacement</label><select class="sel" id="sLoc" style="width:auto"><option value="">Tous les emplacements</option>${locs.map(l => `<option value="${l.id}" ${STK.loc === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
      <label class="row chk-inline"><input type="checkbox" id="sOnly" ${STK.only ? 'checked' : ''}> En stock uniquement</label></div></div>
      <div class="panel-b" id="sMatrix" style="padding:0"></div></section>` : ''}`;

  const draw = () => {
    const host = $('#sMatrix', el); if (!host) return;
    const t = norm(STK.q);
    const cols = STK.loc ? locs.filter(l => l.id === STK.loc) : locs;
    let rows = S.products.filter(p => p.status === 'active' && (!t || norm(p.name).includes(t) || norm(p.sku).includes(t) || (p.ean || '').includes(t)));
    if (STK.only) rows = rows.filter(p => cols.some(l => (p.stock?.[l.id] || 0) !== 0));
    rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const pg = paginate(rows, STK);
    host.innerHTML = rows.length ? `<div class="tbl-wrap flat"><table class="tbl"><caption class="sr-only">Quantités par produit et par emplacement</caption><thead><tr><th scope="col">Produit</th>${cols.map(l => `<th scope="col" class="num-c">${esc(l.name)}</th>`).join('')}<th scope="col" class="num-c">Total</th><th scope="col">Niveau</th></tr></thead><tbody>
      ${pg.rows.map(p => `<tr data-prod="${p.id}" tabindex="0"><td><div class="cell-user">${productThumb(p, 'sm')}<div><b>${esc(p.name)}</b><small class="mono">${esc(p.sku)}</small></div></div></td>
        ${cols.map(l => { const q = p.stock?.[l.id] || 0; return `<td class="num-c mono ${q ? '' : 'muted'}">${q ? fmtNum(q) : '—'}</td>`; }).join('')}
        <td class="num-c mono"><b>${fmtNum(productQty(p))}</b> <small class="muted">${esc(p.unit)}</small></td><td>${levelChip(p)}</td></tr>`).join('')}
      </tbody></table></div><div style="padding:0 16px 14px">${pagerHTML(STK.page, pg.pages, pg.total, pg.start, pg.rows.length, 'produit')}</div>`
      : `<div class="empty" style="padding:30px">${svg('box')}<h4>Aucun produit</h4><p>Aucun stock ne correspond à ces critères.</p></div>`;
    hydrateMedia(host); bindPager(host, STK, draw);
    $$('[data-prod]', host).forEach(r => { r.onclick = () => openProductDrawer(r.dataset.prod, 'stock'); r.onkeydown = e => { if (e.key === 'Enter') openProductDrawer(r.dataset.prod, 'stock'); }; });
  };
  draw();
  if ($('#sQ', el)) {
    $('#sQ', el).oninput = debounce(e => { STK.q = e.target.value; STK.page = 1; draw(); }, 150);
    $('#sLoc', el).onchange = e => { STK.loc = e.target.value; STK.page = 1; draw(); };
    $('#sOnly', el).onchange = e => { STK.only = e.target.checked; STK.page = 1; draw(); };
  }
  $$('[data-lfilter]', el).forEach(b => b.onclick = () => { STK.loc = b.dataset.lfilter; STK.page = 1; route({ keepScroll: true }); setTimeout(() => $('#mxT')?.scrollIntoView({ behavior: 'smooth' }), 60); });
  $$('#lNew,[data-lnew]', el).forEach(b => b.onclick = () => locationForm());
  $$('[data-ledit]', el).forEach(b => b.onclick = () => locationForm(b.dataset.ledit));
  $$('[data-ldel]', el).forEach(b => b.onclick = () => { const l = locationById(b.dataset.ldel); confirmDialog(`Supprimer l'emplacement « ${l.name} » ?`, async () => { await deleteLocation(l.id); toast('Emplacement supprimé', 'ok'); }); });
  if ($('#sTr', el)) $('#sTr', el).onclick = () => movementForm('transfer', STK.loc ? { locId: STK.loc } : {});
};
function locationForm(id) {
  const l = id ? locationById(id) : {};
  openModal({
    title: id ? 'Modifier l\'emplacement' : 'Nouvel emplacement',
    body: fieldHTML({ id: 'lfName', label: 'Nom de l\'emplacement', value: l.name || '', req: true, placeholder: 'Ex. Réserve – Étagère A' }) +
      fieldHTML({ id: 'lfSite', label: 'Site / entrepôt (facultatif)', value: l.site || '', placeholder: 'Ex. Dépôt de Draguignan' }) +
      textareaHTML({ id: 'lfDesc', label: 'Description (facultatif)', value: l.description || '', rows: 2 }),
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="lfSave">Enregistrer</button>`,
    onOpen: m => {
      $('#lfSave', m).onclick = e => guard(e.currentTarget, async () => {
        try { await saveLocation({ name: val(m, 'lfName'), site: val(m, 'lfSite'), description: val(m, 'lfDesc') }, id); closeModal(1); toast('Emplacement enregistré', 'ok'); }
        catch (err) { formError(m, err.message); markInvalid(m, ['lfName']); }
      });
    }
  });
}
