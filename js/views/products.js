/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/products.js
   Produits et références : liste filtrable (vue tableau ou cartes,
   pagination fluide même avec des milliers de références), fiche
   détaillée en panneau latéral, formulaire avec photo (IndexedDB),
   duplication, archivage et suppression contrôlée.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const PROD = { q: '', cat: '', sup: '', loc: '', status: 'active', level: '', sort: 'name', dir: 1, view: PREF_VIEW(), page: 1 };
/* Libellés français des tris (légende du tableau lue par les lecteurs d'écran) */
const PROD_SORT_LABEL = { name: 'nom', qty: 'quantité', value: 'valeur', date: 'date de modification', category: 'catégorie' };
function PREF_VIEW() { try { return localStorage.getItem('osi_prod_view') || 'table'; } catch (e) { return 'table'; } }

/* Filtrage + tri (appelé à chaque saisie, sans reconstruire toute la page) */
function filteredProducts(f = PROD) {
  const t = norm(f.q);
  let rows = S.products.filter(p =>
    (!f.status || p.status === f.status) &&
    (!f.cat || (f.cat === '_none' ? !p.categoryId : p.categoryId === f.cat)) &&
    (!f.sup || p.supplierId === f.sup) &&
    (!f.loc || (p.stock?.[f.loc] || 0) !== 0 || p.locationId === f.loc) &&
    (!f.level || stockLevel(p) === f.level) &&
    (!t || norm(p.name).includes(t) || norm(p.sku).includes(t) || (p.ean || '').includes(t) || norm(p.description).includes(t))
  );
  const key = {
    name: p => norm(p.name), qty: p => productQty(p), value: p => productValue(p),
    date: p => p.updatedAt || p.createdAt, category: p => norm(catName(p.categoryId)) + norm(p.name)
  }[f.sort] || (p => norm(p.name));
  rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * f.dir; });
  return rows;
}

VIEWS.products = (el, params) => {
  if (params.level !== undefined) PROD.level = params.level;
  if (params.cat) PROD.cat = params.cat;
  if (params.sup) PROD.sup = params.sup;
  if (params.loc) PROD.loc = params.loc;
  const act = S.products.filter(p => p.status === 'active').length;
  el.innerHTML = pageHead('Produits et références', crumbFor('produits'),
    (can('export') ? `<button type="button" class="btn" id="pExport">${svg('down')} Export CSV</button>` : '') +
    (can('product.edit') ? `<button type="button" class="btn gold" id="pNew">${svg('plus')} Nouveau produit</button>` : ''),
    `${fmtNum(act, 0)} référence(s) active(s) · ${fmtNum(S.products.length - act, 0)} archivée(s)`) +
    demoBanner() +
    `<div class="tbl-tools" role="search" aria-label="Filtrer les produits">
      <div class="search" style="max-width:300px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="pSearch" type="search" aria-label="Rechercher par nom, référence ou code-barres" placeholder="Nom, référence, code-barres…" value="${esc(PROD.q)}"></div>
      <label class="sr-only" for="pCat">Catégorie</label><select class="sel" id="pCat" style="width:auto"><option value="">Toutes catégories</option><option value="_none" ${PROD.cat === '_none' ? 'selected' : ''}>Sans catégorie</option>${optCategories().map(([v, l]) => `<option value="${v}" ${PROD.cat === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="pSup">Fournisseur</label><select class="sel" id="pSup" style="width:auto"><option value="">Tous fournisseurs</option>${optSuppliers(true).map(([v, l]) => `<option value="${v}" ${PROD.sup === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="pLoc">Emplacement</label><select class="sel" id="pLoc" style="width:auto"><option value="">Tous emplacements</option>${optLocations().map(([v, l]) => `<option value="${v}" ${PROD.loc === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="pLevel">Niveau de stock</label><select class="sel" id="pLevel" style="width:auto"><option value="">Tous niveaux</option>${Object.entries(LEVEL).map(([k, l]) => `<option value="${k}" ${PROD.level === k ? 'selected' : ''}>${l.label}</option>`).join('')}</select>
      <label class="sr-only" for="pStatus">Statut</label><select class="sel" id="pStatus" style="width:auto"><option value="active" ${PROD.status === 'active' ? 'selected' : ''}>Actifs</option><option value="archived" ${PROD.status === 'archived' ? 'selected' : ''}>Archivés</option><option value="" ${PROD.status === '' ? 'selected' : ''}>Tous statuts</option></select>
      <label class="sr-only" for="pSort">Trier par</label><select class="sel" id="pSort" style="width:auto">${[['name', 'Tri : nom'], ['qty', 'Tri : quantité'], ['value', 'Tri : valeur'], ['date', 'Tri : date de modification'], ['category', 'Tri : catégorie']].map(([v, l]) => `<option value="${v}" ${PROD.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn icon" id="pDir" aria-label="Ordre ${PROD.dir > 0 ? 'croissant' : 'décroissant'} (cliquer pour inverser)" title="Inverser l'ordre">${PROD.dir > 0 ? '↑' : '↓'}</button>
      <div class="seg" role="group" aria-label="Affichage"><button type="button" data-pv="table" class="${PROD.view === 'table' ? 'on' : ''}" aria-pressed="${PROD.view === 'table'}">${svg('list', 'seg-ic')}Tableau</button><button type="button" data-pv="cards" class="${PROD.view === 'cards' ? 'on' : ''}" aria-pressed="${PROD.view === 'cards'}">${svg('grid', 'seg-ic')}Cartes</button></div>
      <button type="button" class="btn ghost sm" id="pReset">Réinitialiser</button>
    </div>
    <div id="pList" aria-live="polite"></div>`;

  const draw = () => {
    const rows = filteredProducts();
    const pg = paginate(rows, PROD);
    const host = $('#pList', el);
    if (!S.products.length) {
      host.innerHTML = emptyState('box', 'Aucun produit pour le moment', 'Créez votre première référence avec son stock initial, ou chargez les données de démonstration.',
        can('product.edit') ? `<button type="button" class="btn gold" data-new>${svg('plus')} Créer un produit</button>` : '');
    } else if (!rows.length) {
      host.innerHTML = emptyState('search', 'Aucun résultat', 'Aucun produit ne correspond à ces filtres. Modifiez la recherche ou réinitialisez les filtres.');
    } else if (PROD.view === 'cards') {
      host.innerHTML = `<div class="pcards">${pg.rows.map(productCard).join('')}</div>` + pagerHTML(PROD.page, pg.pages, pg.total, pg.start, pg.rows.length, 'produit');
    } else {
      const th = (k, l, cls = '') => { const on = PROD.sort === k; return `<th scope="col" class="${cls}" ${on ? `aria-sort="${PROD.dir > 0 ? 'ascending' : 'descending'}"` : ''}><button type="button" class="sort" data-sort="${k}">${l}${on ? (PROD.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`; };
      host.innerHTML = `<div class="tbl-wrap"><table class="tbl" id="prodTable" style="min-width:980px"><caption class="sr-only">Liste des produits, triée par ${PROD_SORT_LABEL[PROD.sort] || 'nom'}, ordre ${PROD.dir > 0 ? 'croissant' : 'décroissant'}</caption><thead><tr>
        ${th('name', 'Produit')}${th('category', 'Catégorie')}<th scope="col">Emplacement</th>${th('qty', 'Stock', 'num-c')}<th scope="col" class="num-c">Seuil</th>${th('value', 'Valeur', 'num-c')}<th scope="col">Niveau</th><th scope="col"><span class="sr-only">Actions rapides</span></th></tr></thead>
        <tbody>${pg.rows.map(productRow).join('')}</tbody></table></div>` + pagerHTML(PROD.page, pg.pages, pg.total, pg.start, pg.rows.length, 'produit');
    }
    hydrateMedia(host);
    bindPager(host, PROD, draw);
    $$('[data-prod]', host).forEach(r => {
      r.onclick = e => { if (e.target.closest('[data-qa]')) return; openProductDrawer(r.dataset.prod); };
      r.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); openProductDrawer(r.dataset.prod); } };
    });
    $$('[data-qa]', host).forEach(b => b.onclick = e => { e.stopPropagation(); movementForm(b.dataset.qa, { productId: b.dataset.id }); });
    $$('[data-sort]', host).forEach(b => b.onclick = () => { if (PROD.sort === b.dataset.sort) PROD.dir *= -1; else { PROD.sort = b.dataset.sort; PROD.dir = 1; } PROD.page = 1; route({ keepScroll: true }); });
    $$('[data-new]', host).forEach(b => b.onclick = () => productForm());
  };
  draw();
  $('#pSearch', el).oninput = debounce(e => { PROD.q = e.target.value; PROD.page = 1; draw(); }, 150);
  [['pCat', 'cat'], ['pSup', 'sup'], ['pLoc', 'loc'], ['pLevel', 'level'], ['pStatus', 'status'], ['pSort', 'sort']].forEach(([id, k]) => $('#' + id, el).onchange = e => { PROD[k] = e.target.value; PROD.page = 1; draw(); });
  $('#pDir', el).onclick = () => { PROD.dir *= -1; route({ keepScroll: true }); };
  $$('[data-pv]', el).forEach(b => b.onclick = () => { PROD.view = b.dataset.pv; try { localStorage.setItem('osi_prod_view', PROD.view); } catch (e) { } route({ keepScroll: true }); });
  $('#pReset', el).onclick = () => { Object.assign(PROD, { q: '', cat: '', sup: '', loc: '', status: 'active', level: '', sort: 'name', dir: 1, page: 1 }); go('produits'); };
  if ($('#pNew', el)) $('#pNew', el).onclick = () => productForm();
  if ($('#pExport', el)) $('#pExport', el).onclick = () => exportProductsCSV(filteredProducts());
  bindDemoBanner(el);
  if (params.action === 'new' && can('product.edit')) { history.replaceState(null, '', '#/produits'); setTimeout(() => productForm(), 50); }
};

function productRow(p) {
  const q = productQty(p), lvl = stockLevel(p);
  const locs = Object.keys(p.stock || {});
  return `<tr data-prod="${p.id}" tabindex="0" class="${p.status === 'archived' ? 'is-archived' : ''}" aria-label="${esc(p.name)}, ${fmtNum(q)} ${esc(p.unit)}, ${LEVEL[lvl].label}">
    <td><div class="cell-user">${productThumb(p)}<div><b>${esc(p.name)}</b>${p.demo ? ' <span class="chip gold xs">Démo</span>' : ''}${p.status === 'archived' ? ' <span class="chip xs">Archivé</span>' : ''}<small class="mono">${esc(p.sku)}${p.ean ? ' · ' + esc(p.ean) : ''}</small></div></div></td>
    <td>${esc(catName(p.categoryId))}</td>
    <td>${locs.length > 1 ? `${esc(locName(p.locationId))} <small class="muted">+${locs.length - 1}</small>` : esc(locName(locs[0] || p.locationId))}</td>
    <td class="num-c"><b class="mono">${fmtNum(q)}</b> <small class="muted">${esc(p.unit)}</small>${p.reserved ? `<small class="muted d-block">dont ${fmtNum(p.reserved)} réservé(s)</small>` : ''}</td>
    <td class="num-c mono">${fmtNum(p.minStock)}</td>
    <td class="num-c mono">${fmtMoney(productValue(p))}</td>
    <td>${levelChip(p)}</td>
    <td class="qa-cell">${p.status === 'active' && can('stock.move') ? `<button type="button" class="btn icon sm" data-qa="in" data-id="${p.id}" aria-label="Entrée de stock : ${esc(p.name)}" title="Entrée">${svg('arrin')}</button><button type="button" class="btn icon sm" data-qa="out" data-id="${p.id}" aria-label="Sortie de stock : ${esc(p.name)}" title="Sortie">${svg('arrout')}</button>` : ''}</td></tr>`;
}
function productCard(p) {
  const q = productQty(p), min = Number(p.minStock) || 0, max = Number(p.maxStock) || Math.max(min * 3, q, 1);
  return `<article class="pcard card" data-prod="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
    <div class="pcard-img">${p.photoId ? `<img data-media="${esc(p.photoId)}" alt="Photo de ${esc(p.name)}" loading="lazy">` : `<span aria-hidden="true">${esc(initialsOf(p.name))}</span>`}${levelChip(p)}</div>
    <div class="pcard-b"><h4>${esc(p.name)}</h4><small class="mono muted">${esc(p.sku)} · ${esc(catName(p.categoryId))}</small>
      <div class="row between" style="margin-top:10px"><b class="pcard-q">${fmtNum(q)} <small>${esc(p.unit)}</small></b><span class="mono muted">${fmtMoney(productValue(p))}</span></div>
      <div class="prog" role="img" aria-label="Niveau : ${fmtNum(q)} sur un maximum de ${fmtNum(max)}"><span style="width:${clamp(q / max * 100, 0, 100)}%"></span></div>
      <small class="muted">Seuil ${fmtNum(min)}${p.maxStock ? ' · max ' + fmtNum(p.maxStock) : ''}</small>
      ${p.status === 'active' && can('stock.move') ? `<div class="row" style="margin-top:12px"><button type="button" class="btn sm grow" data-qa="in" data-id="${p.id}">${svg('arrin')} Entrée</button><button type="button" class="btn sm grow" data-qa="out" data-id="${p.id}">${svg('arrout')} Sortie</button></div>` : ''}
    </div></article>`;
}

/* ═════════════════════ FORMULAIRE PRODUIT ═════════════════════ */
function productForm(id, preset = {}) {
  const p = id ? productById(id) : null;
  if (!p && !S.locations.length) { toast('Créez d\'abord un emplacement de stockage (Stocks et entrepôts).', 'warn'); return go('stocks'); }
  const d = p || { unit: 'pièce', minStock: SETTINGS.defaultMinStock, maxStock: 0, purchasePrice: '', locationId: S.locations[0]?.id, ...preset };
  let photo = { id: p?.photoId || null, blob: null, removed: false };
  const a = p ? anaOf(p.id) : null;
  openModal({
    title: p ? 'Modifier le produit' : 'Nouveau produit', xwide: true,
    body: `<div class="pf-grid">
      <div class="pf-photo">
        <div class="av xl photo-prev" id="pfAv">${p?.photoId ? `<img data-media="${esc(p.photoId)}" alt="Photo actuelle">` : `<span aria-hidden="true">${svg('image')}</span>`}</div>
        <label class="btn sm ghost" style="margin-top:12px;cursor:pointer">${svg('up')} Choisir une photo<input type="file" id="pfPhoto" accept="image/*" class="sr-only"></label>
        <button type="button" class="btn sm ghost danger ${p?.photoId ? '' : 'hide'}" id="pfPhotoDel">${svg('trash')} Retirer</button>
        <small class="hint" style="text-align:center">JPEG, PNG ou WebP. L'image est redimensionnée (1024 px max) puis enregistrée localement.</small>
      </div>
      <div>
        <fieldset class="fs"><legend>Identification</legend>
        <div class="grid-2">${fieldHTML({ id: 'pfName', label: 'Nom du produit', value: d.name || '', req: true })}${fieldHTML({ id: 'pfSku', label: 'Référence interne (SKU)', value: d.sku || suggestSku(), req: true, attrs: 'autocomplete="off" spellcheck="false"' })}</div>
        <div class="grid-2">${fieldHTML({ id: 'pfEan', label: 'Code-barres EAN (facultatif)', value: d.ean || '', attrs: 'inputmode="numeric" autocomplete="off"', hint: '8 à 14 chiffres — une douchette USB saisit le code directement ici.' })}
          ${selectHTML({ id: 'pfUnit', label: 'Unité de mesure', options: SETTINGS.units, value: d.unit })}</div>
        ${textareaHTML({ id: 'pfDesc', label: 'Description détaillée', value: d.description || '', rows: 2 })}
        <div class="grid-2">${selectHTML({ id: 'pfCat', label: 'Catégorie', options: optCategories(), value: d.categoryId || '', empty: '— Sans catégorie —' })}
          ${selectHTML({ id: 'pfSup', label: 'Fournisseur principal', options: optSuppliers(), value: d.supplierId || '', empty: '— Aucun —' })}</div>
        </fieldset>
        <fieldset class="fs"><legend>Prix</legend>
        <div class="grid-2">${fieldHTML({ id: 'pfBuy', label: `Prix d'achat unitaire HT (${SETTINGS.currency})`, value: d.purchasePrice === '' ? '' : String(d.purchasePrice ?? '').replace('.', ','), req: true, attrs: 'inputmode="decimal"', hint: p ? 'Mis à jour automatiquement à chaque entrée (' + (SETTINGS.valuation === 'cump' ? 'coût moyen pondéré' : 'dernier prix') + ').' : '' })}
          ${fieldHTML({ id: 'pfSell', label: `Prix de vente unitaire (facultatif)`, value: d.salePrice == null ? '' : String(d.salePrice).replace('.', ','), attrs: 'inputmode="decimal"' })}</div>
        </fieldset>
        <fieldset class="fs"><legend>Stock et réapprovisionnement</legend>
        <div class="grid-3">${fieldHTML({ id: 'pfMin', label: 'Seuil minimal', value: d.minStock ?? '', attrs: 'inputmode="decimal"', hint: 'Déclenche l\'alerte « stock faible ».' })}
          ${fieldHTML({ id: 'pfMax', label: 'Stock maximal souhaité', value: d.maxStock || '', attrs: 'inputmode="decimal"', hint: '0 ou vide = pas de maximum.' })}
          ${fieldHTML({ id: 'pfRes', label: 'Quantité réservée', value: d.reserved || '', attrs: 'inputmode="decimal"', hint: 'Promise à un client ou un chantier.' })}</div>
        <div class="grid-3">${selectHTML({ id: 'pfLoc', label: 'Emplacement principal', options: optLocations(), value: d.locationId || '' })}
          ${fieldHTML({ id: 'pfLot', label: 'Lot de commande (facultatif)', value: d.reorderQty || '', attrs: 'inputmode="decimal"', hint: 'Arrondit la quantité recommandée à ce multiple (carton de 12…).' })}
          ${p ? `<div class="field"><span class="flabel">Réapprovisionnement recommandé</span><div class="calc-box"><b class="mono">${fmtNum(a.recommended)} ${esc(p.unit)}</b><small class="muted">calcul automatique, voir la fiche</small></div></div>` : `${fieldHTML({ id: 'pfInit', label: 'Stock initial', value: '', attrs: 'inputmode="decimal"', hint: 'Crée un mouvement « Stock initial » tracé.' })}`}</div>
        </fieldset>
      </div></div>`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="pfSave">${p ? 'Enregistrer' : 'Créer le produit'}</button>`,
    onOpen: m => {
      $('#pfPhoto', m).onchange = async ev => {
        const f = ev.target.files[0]; if (!f) return;
        if (!/^image\//.test(f.type)) return toast('Ce fichier n\'est pas une image.', 'dng');
        try { photo.blob = await resizeImage(f, 1024); photo.removed = false; }
        catch (e) { return toast('Image illisible : ' + e.message, 'dng'); }
        const u = URL.createObjectURL(photo.blob);
        $('#pfAv', m).innerHTML = `<img src="${u}" alt="Aperçu de la nouvelle photo">`;
        $('#pfPhotoDel', m).classList.remove('hide');
      };
      $('#pfPhotoDel', m).onclick = () => { photo = { id: null, blob: null, removed: true }; $('#pfAv', m).innerHTML = `<span aria-hidden="true">${svg('image')}</span>`; $('#pfPhotoDel', m).classList.add('hide'); };
      $('#pfSave', m).onclick = e => guard(e.currentTarget, async () => {
        formError(m, '');
        const data = {
          name: val(m, 'pfName'), sku: val(m, 'pfSku'), ean: val(m, 'pfEan').replace(/\s/g, ''), unit: val(m, 'pfUnit'), description: val(m, 'pfDesc'),
          categoryId: val(m, 'pfCat') || null, supplierId: val(m, 'pfSup') || null,
          purchasePrice: val(m, 'pfBuy') === '' ? NaN : parseNum(val(m, 'pfBuy')), salePrice: numVal(m, 'pfSell'),
          minStock: numVal(m, 'pfMin') ?? 0, maxStock: numVal(m, 'pfMax') ?? 0, reserved: numVal(m, 'pfRes') ?? 0,
          locationId: val(m, 'pfLoc') || null, reorderQty: numVal(m, 'pfLot')
        };
        const init = p ? null : numVal(m, 'pfInit');
        const errs = validateProduct(data, id);
        if (init !== null && (isNaN(init) || init < 0)) errs.push('Le stock initial doit être un nombre positif.');
        if (errs.length) {
          formError(m, errs.join('\n'));
          markInvalid(m, [!data.name && 'pfName', (!data.sku || errs.some(x => x.includes('référence'))) && 'pfSku', errs.some(x => x.includes('code-barres')) && 'pfEan', isNaN(data.purchasePrice) && 'pfBuy'].filter(Boolean));
          return;
        }
        /* Photo : enregistrée dans IndexedDB avant la fiche */
        let newMedia = null;
        if (photo.blob) { newMedia = await IDB.putMedia(photo.blob, 'photo-' + data.sku, { demo: false }); data.photoId = newMedia; }
        else if (photo.removed) data.photoId = null;
        try {
          if (p) {
            const oldPhoto = p.photoId;
            await updateProduct(id, data);
            if ((newMedia || photo.removed) && oldPhoto && !S.products.some(x => x.photoId === oldPhoto)) { await IDB.tx(['media'], t => t.del('media', oldPhoto)); forgetMediaURL(oldPhoto); }
            toast('Produit mis à jour', 'ok');
          } else {
            const np = await createProduct(data, init > 0 ? { qty: init, locId: data.locationId } : null);
            toast(`Produit « ${np.name} » créé${init > 0 ? ' avec ' + fmtNum(init) + ' ' + np.unit + ' en stock' : ''}`, 'ok');
          }
          closeModal(1);
        } catch (err) {
          if (newMedia) IDB.tx(['media'], t => t.del('media', newMedia)).catch(() => { });
          formError(m, err.message);
        }
      });
    }
  });
}
function suggestSku() {
  let n = S.products.length + 1, sku;
  do { sku = 'REF-' + String(n++).padStart(4, '0'); } while (S.products.some(p => p.sku === sku));
  return sku;
}
/* Redimensionnement d'image via <canvas> (préserve la mémoire et l'espace de stockage) */
function resizeImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const r = Math.min(1, max / Math.max(img.width, img.height));
      if (r === 1 && file.size < 400000) return resolve(file);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? resolve(b) : reject(new Error('conversion impossible')), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('format non reconnu')); };
    img.src = u;
  });
}

/* ═════════════════════ FICHE PRODUIT (panneau latéral) ═════════════════════ */
let _drawerTab = 'infos';
function openProductDrawer(id, tab) {
  const p = productById(id); if (!p) return toast('Produit introuvable.', 'warn');
  if (tab) _drawerTab = tab;
  const render = () => {
    const pp = productById(id); if (!pp) { closeDrawer(); DRAWER_REFRESH = null; return; }
    const a = anaOf(id); const q = productQty(pp);
    const mvs = S.movements.filter(m => m.productId === id);
    const orders = S.orders.filter(o => o.lines.some(l => l.productId === id));
    const scroll = $('#drawer .drawer-b')?.scrollTop || 0;
    openDrawer(`
      <div class="drawer-h">
        <div class="row" style="justify-content:space-between"><button type="button" class="x-btn" data-drclose aria-label="Fermer la fiche">${svg('x')}</button>
          <div class="row wrap" style="gap:6px">
            ${pp.status === 'active' && can('stock.move') ? `<button type="button" class="btn sm" data-dq="in">${svg('arrin')} Entrée</button><button type="button" class="btn sm" data-dq="out">${svg('arrout')} Sortie</button><button type="button" class="btn sm" data-dq="transfer" aria-label="Transfert">${svg('swap')}</button>` : ''}
            ${can('product.edit') ? `<button type="button" class="btn sm ghost" id="drEdit" aria-label="Modifier">${svg('edit')}</button>` : ''}</div></div>
        <div class="row" style="margin-top:14px;align-items:flex-start">${productThumb(pp, 'lg')}
          <div style="min-width:0"><h3 style="font-size:1.35rem">${esc(pp.name)}</h3>
            <div class="soft mono" style="font-size:.84rem">${esc(pp.sku)}${pp.ean ? ' · ' + svg('barcode', 'inl') + ' ' + esc(pp.ean) : ''}</div>
            <div class="row wrap" style="margin-top:8px;gap:6px">${levelChip(pp)}<span class="chip">${esc(catName(pp.categoryId))}</span>${pp.status === 'archived' ? '<span class="chip">Archivé</span>' : ''}${pp.demo ? '<span class="chip gold">Démo</span>' : ''}</div></div></div>
        <div class="mini-kpis">
          <div><span class="k">En stock</span><b class="mono">${fmtNum(q)}</b><small>${esc(pp.unit)}</small></div>
          <div><span class="k">Disponible</span><b class="mono">${fmtNum(productAvailable(pp))}</b><small>réservé ${fmtNum(pp.reserved || 0)}</small></div>
          <div><span class="k">Valeur</span><b class="mono">${fmtMoneyShort(productValue(pp))}</b><small>${fmtMoney(pp.purchasePrice)} / u</small></div>
          <div><span class="k">À commander</span><b class="mono ${a.recommended ? 'gold' : ''}">${fmtNum(a.recommended)}</b><small>${a.onOrder ? fmtNum(a.onOrder) + ' en commande' : 'recommandé'}</small></div>
        </div>
      </div>
      <div class="drawer-b">
        <div class="tabs" role="tablist" aria-label="Sections de la fiche">
          ${[['infos', 'Informations'], ['stock', 'Emplacements'], ['mv', `Mouvements (${mvs.length})`], ['reappro', 'Réappro.'], ['prix', 'Prix'], ['cmd', `Commandes (${orders.length})`]].map(([k, l]) => `<button type="button" class="tab ${_drawerTab === k ? 'active' : ''}" role="tab" aria-selected="${_drawerTab === k}" data-t="${k}" id="tab-${k}" aria-controls="drTab">${l}</button>`).join('')}
        </div>
        <div id="drTab" role="tabpanel" aria-labelledby="tab-${_drawerTab}"></div>
        <div class="drawer-actions">
          ${can('product.edit') ? `<button type="button" class="btn sm ghost" id="drDup">${svg('copy')} Dupliquer</button>
          <button type="button" class="btn sm ghost" id="drArch">${svg('archive')} ${pp.status === 'archived' ? 'Réactiver' : 'Archiver'}</button>` : ''}
          ${can('product.delete') ? `<button type="button" class="btn sm danger" id="drDel">${svg('trash')} Supprimer</button>` : ''}
        </div>
      </div>`, d => {
      const tabs = {
        infos: () => `
          <div class="info-line"><span class="k">Description</span><span class="v" style="text-align:left;max-width:65%">${esc(pp.description || '—')}</span></div>
          <div class="info-line"><span class="k">Catégorie</span><span class="v">${esc(catName(pp.categoryId))}</span></div>
          <div class="info-line"><span class="k">Fournisseur principal</span><span class="v">${pp.supplierId ? `<button type="button" class="link-btn" data-sup="${pp.supplierId}">${esc(supName(pp.supplierId))}</button>` : '—'}</span></div>
          <div class="info-line"><span class="k">Unité</span><span class="v">${esc(pp.unit)}</span></div>
          <div class="info-line"><span class="k">Prix d'achat unitaire</span><span class="v mono">${fmtMoney(pp.purchasePrice)}</span></div>
          <div class="info-line"><span class="k">Prix de vente unitaire</span><span class="v mono">${pp.salePrice != null ? fmtMoney(pp.salePrice) : '—'}</span></div>
          ${pp.salePrice != null && pp.purchasePrice > 0 ? `<div class="info-line"><span class="k">Marge brute unitaire</span><span class="v mono">${fmtMoney(pp.salePrice - pp.purchasePrice)} (${fmtPct((pp.salePrice - pp.purchasePrice) / pp.salePrice * 100, 1)})</span></div>` : ''}
          <div class="info-line"><span class="k">Quantité disponible</span><span class="v mono">${fmtNum(q)} ${esc(pp.unit)}</span></div>
          <div class="info-line"><span class="k">Quantité réservée</span><span class="v mono">${fmtNum(pp.reserved || 0)}</span></div>
          <div class="info-line"><span class="k">Réellement disponible</span><span class="v mono">${fmtNum(productAvailable(pp))}</span></div>
          <div class="info-line"><span class="k">Seuil minimal / maximum</span><span class="v mono">${fmtNum(pp.minStock)} / ${pp.maxStock ? fmtNum(pp.maxStock) : '—'}</span></div>
          <div class="info-line"><span class="k">Emplacement principal</span><span class="v">${esc(locName(pp.locationId))}</span></div>
          <div class="info-line"><span class="k">Identifiant</span><span class="v mono" style="font-size:.76rem">${esc(pp.id)}</span></div>
          <div class="info-line"><span class="k">Créé le</span><span class="v">${fmtDateTime(pp.createdAt)}</span></div>
          <div class="info-line"><span class="k">Modifié le</span><span class="v">${fmtDateTime(pp.updatedAt)}</span></div>
          <div class="info-line"><span class="k">Statut</span><span class="v">${pp.status === 'archived' ? 'Archivé' : 'Actif'}</span></div>`,
        stock: () => {
          const locs = Object.entries(pp.stock || {});
          return locs.length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0"><thead><tr><th scope="col">Emplacement</th><th scope="col" class="num-c">Quantité</th><th scope="col" class="num-c">Valeur</th></tr></thead><tbody>
            ${locs.map(([l, qq]) => `<tr><td>${esc(locName(l))}${l === pp.locationId ? ' <span class="chip xs gold">principal</span>' : ''}</td><td class="num-c mono">${fmtNum(qq)}</td><td class="num-c mono">${fmtMoney(Math.max(0, qq) * pp.purchasePrice)}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="muted">Aucun stock pour ce produit.</p>';
        },
        mv: () => mvs.length ? `<div class="mv-list">${mvs.slice(-40).reverse().map(movementMini).join('')}</div>${mvs.length > 40 ? `<a class="btn sm ghost" href="#/mouvements?product=${id}" style="margin-top:12px">Voir les ${mvs.length} mouvements</a>` : ''}` : '<p class="muted">Aucun mouvement enregistré.</p>',
        reappro: () => reorderExplain(pp, a),
        prix: () => {
          const h = priceHistory(id);
          if (h.length < 2) return `<p class="muted">L'évolution du prix d'achat s'affichera après au moins deux entrées de marchandises avec prix (${h.length} actuellement).</p>`;
          return `<div id="drPrice" class="chart-host"></div><div class="tbl-wrap" style="margin-top:12px"><table class="tbl" style="min-width:0"><thead><tr><th scope="col">Date</th><th scope="col">Document</th><th scope="col" class="num-c">Qté</th><th scope="col" class="num-c">Prix unitaire</th></tr></thead><tbody>
            ${h.slice().reverse().slice(0, 30).map(x => `<tr><td>${fmtDate(x.day)}</td><td class="mono">${esc(x.number)}</td><td class="num-c mono">${fmtNum(x.qty)}</td><td class="num-c mono">${fmtMoney(x.price)}</td></tr>`).join('')}</tbody></table></div>`;
        },
        cmd: () => orders.length ? orders.slice().reverse().map(o => { const l = o.lines.find(x => x.productId === id); return `<button type="button" class="list-row" data-ord="${o.id}"><div><b class="mono">${esc(o.number)}</b> <span class="chip ${ORDER_STATUS[o.status].cls} xs">${ORDER_STATUS[o.status].label}</span><small class="muted d-block">${esc(supName(o.supplierId))} · ${fmtDate(o.createdAt)}</small></div><span class="mono">${fmtNum(l.received || 0)} / ${fmtNum(l.qty)}</span></button>`; }).join('') : '<p class="muted">Aucune commande fournisseur pour ce produit.</p>'
      };
      const show = t => {
        _drawerTab = t;
        $('#drTab', d).innerHTML = tabs[t](); $('#drTab', d).setAttribute('aria-labelledby', 'tab-' + t);
        $$('.tab', d).forEach(x => { const on = x.dataset.t === t; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
        $$('[data-mvd]', d).forEach(b => b.onclick = () => movementDetail(b.dataset.mvd));
        $$('[data-ord]', d).forEach(b => b.onclick = () => openOrderDrawer(b.dataset.ord));
        $$('[data-sup]', d).forEach(b => b.onclick = () => openSupplierDrawer(b.dataset.sup));
        if ($('#reOrder', d)) $('#reOrder', d).onclick = () => { closeDrawer(); orderForm(null, { supplierId: pp.supplierId, lines: [{ productId: pp.id, qty: a.recommended || 1, unitPrice: pp.purchasePrice }], fromAlerts: true }); };
        if (t === 'prix' && $('#drPrice', d)) { const h = priceHistory(id); lineChart($('#drPrice', d), { labels: h.map(x => fmtDayShort(x.day)), series: [{ name: 'Prix d\'achat', values: h.map(x => x.price), cls: 's1' }], fmt: fmtMoney, axisFmt: v => fmtMoney(v), label: 'Évolution du prix d\'achat' }); }
      };
      show(tabs[_drawerTab] ? _drawerTab : 'infos');
      $$('.tab', d).forEach(t => t.onclick = () => show(t.dataset.t));
      /* Navigation clavier entre onglets (flèches) */
      $('.tabs', d).onkeydown = e => { if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; const ts = $$('.tab', d); const i = ts.findIndex(x => x.classList.contains('active')); const n = ts[(i + (e.key === 'ArrowRight' ? 1 : ts.length - 1)) % ts.length]; n.focus(); show(n.dataset.t); };
      $('[data-drclose]', d).onclick = closeDrawer;
      $$('[data-dq]', d).forEach(b => b.onclick = () => movementForm(b.dataset.dq, { productId: id }));
      if ($('#drEdit', d)) $('#drEdit', d).onclick = () => productForm(id);
      if ($('#drDup', d)) $('#drDup', d).onclick = e => guard(e.currentTarget, async () => { const np = await duplicateProduct(id); toast('Copie créée : ' + np.sku, 'ok'); openProductDrawer(np.id, 'infos'); });
      if ($('#drArch', d)) $('#drArch', d).onclick = () => {
        const arch = pp.status !== 'archived';
        confirmDialog(arch ? `Archiver « ${pp.name} » ? Il n'apparaîtra plus dans les listes actives ni dans les alertes, mais tout son historique est conservé.` : `Réactiver « ${pp.name} » ?`,
          async () => { await setProductStatus(id, arch ? 'archived' : 'active'); toast(arch ? 'Produit archivé' : 'Produit réactivé', 'ok'); }, { danger: false, yes: arch ? 'Archiver' : 'Réactiver' });
      };
      if ($('#drDel', d)) $('#drDel', d).onclick = () => {
        const b = productDeletionBlockers(id);
        if (b.length) return confirmDialog(`Ce produit ne peut pas être supprimé définitivement car il possède ${b.join(', ')}. Pour préserver la traçabilité, nous vous conseillons de l'archiver.`,
          async () => { await setProductStatus(id, 'archived'); toast('Produit archivé', 'ok'); }, { danger: false, yes: 'Archiver à la place', title: 'Suppression impossible' });
        confirmDialog(`Supprimer définitivement « ${pp.name} » ? Aucune donnée d'historique n'est associée. Cette action est irréversible.`,
          async () => { await deleteProduct(id); closeDrawer(); toast('Produit supprimé', 'dng'); }, { yes: 'Supprimer définitivement', requireText: 'SUPPRIMER' });
      };
      const b = $('.drawer-b', d); if (b) b.scrollTop = scroll;
    }, 'Fiche produit : ' + pp.name);
  };
  DRAWER_REFRESH = render;
  render();
}

/* Explication transparente du calcul de réapprovisionnement */
function reorderExplain(p, a) {
  const u = esc(p.unit);
  const f = n => fmtNum(round2(n));
  return `<div class="explain">
    <p class="soft" style="margin-bottom:12px">Calcul fondé sur des règles métier et sur l'historique réel des sorties — aucune intelligence artificielle externe.</p>
    <div class="info-line"><span class="k">Consommation sur ${a.windowDays} j</span><span class="v mono">${f(a.consWindow)} ${u}</span></div>
    <div class="info-line"><span class="k">Consommation moyenne / jour</span><span class="v mono">${f(a.avgDaily)} ${u}</span></div>
    <div class="info-line"><span class="k">Délai fournisseur</span><span class="v mono">${a.leadTime} j</span></div>
    <div class="info-line"><span class="k">Seuil minimal (stock de sécurité)</span><span class="v mono">${f(p.minStock)} ${u}</span></div>
    <div class="info-line"><span class="k">Point de commande</span><span class="v mono">${f(a.reorderPoint)} ${u}</span></div>
    <div class="info-line"><span class="k">Disponible (stock − réservé)</span><span class="v mono">${f(a.avail)} ${u}</span></div>
    <div class="info-line"><span class="k">Déjà en commande</span><span class="v mono">${f(a.onOrder)} ${u}</span></div>
    <div class="info-line"><span class="k">Stock projeté</span><span class="v mono">${f(a.projected)} ${u}</span></div>
    <div class="info-line"><span class="k">Niveau cible</span><span class="v mono">${f(a.target)} ${u}</span></div>
    <div class="info-line"><span class="k">Couverture estimée</span><span class="v mono">${a.daysCover == null ? 'non calculable (aucune sortie)' : Math.floor(a.daysCover) + ' jours'}</span></div>
    <div class="calc-result ${a.recommended ? 'on' : ''}"><span>Quantité recommandée</span><b class="mono">${fmtNum(a.recommended)} ${u}</b></div>
    <details class="how"><summary>Comment est-ce calculé ?</summary>
      <ol>
        <li><b>Consommation moyenne</b> = sorties des ${SETTINGS.analysisDays} derniers jours (ou depuis la création du produit, avec un minimum de 14 jours pour ne pas extrapoler un historique trop court) ÷ nombre de jours.</li>
        <li><b>Point de commande</b> = consommation moyenne × délai fournisseur + seuil minimal.</li>
        <li><b>Stock projeté</b> = stock disponible + quantités déjà commandées et non reçues.</li>
        <li><b>Niveau cible</b> = stock maximal souhaité s'il est renseigné, sinon point de commande + ${SETTINGS.coverDays} jours de consommation.</li>
        <li>Si le stock projeté ≤ point de commande : <b>quantité recommandée</b> = niveau cible − stock projeté${p.reorderQty ? `, arrondie au lot de ${fmtNum(p.reorderQty)}` : ''}.</li>
      </ol>
      ${a.lowData ? `<p class="notice-sm">${svg('info', 'inl')} Historique encore court (${a.windowDays} j, ${fmtNum(a.consWindow)} ${u} sortis) : la recommandation s'affinera avec l'usage.</p>` : ''}
    </details>
    ${a.recommended && can('order.edit') ? `<button type="button" class="btn gold" id="reOrder" style="margin-top:14px">${svg('cart')} Créer une commande de ${fmtNum(a.recommended)} ${u}</button>` : ''}
  </div>`;
}

