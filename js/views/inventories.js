/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/inventories.js
   Inventaires : général ou partiel (catégorie, emplacement, sélection).
   Cycle : Brouillon → En cours (stock théorique figé) → À vérifier →
   Validé (régularisations générées) — ou Annulé.
   La saisie d'un comptage NE MODIFIE JAMAIS le stock : seules les
   régularisations créées à la validation le font.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const INVL = { status: '' };
const INVW = { id: null, edits: new Map(), q: '', onlyTodo: false, onlyDiff: false, page: 1 };

VIEWS.inventories = (el, params) => {
  if (params.id && inventoryById(params.id)) return inventoryDetail(el, inventoryById(params.id));
  const rows = S.inventories.filter(v => !INVL.status || v.status === INVL.status).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  el.innerHTML = pageHead('Inventaires', crumbFor('inventaires'),
    can('inventory.validate') ? `<button type="button" class="btn gold" id="iNew">${svg('plus')} Nouvel inventaire</button>` : '',
    'Comptez, comparez au stock théorique, puis validez pour régulariser les écarts.') +
    `<div class="tbl-tools"><div class="seg" role="group" aria-label="Filtrer par statut">${[['', 'Tous'], ...Object.entries(INV_STATUS).map(([k, s]) => [k, s.label])].map(([k, l]) => `<button type="button" data-ist="${k}" class="${INVL.status === k ? 'on' : ''}" aria-pressed="${INVL.status === k}">${l}</button>`).join('')}</div></div>` +
    (rows.length ? `<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Liste des inventaires</caption><thead><tr><th scope="col">N°</th><th scope="col">Intitulé</th><th scope="col">Périmètre</th><th scope="col">Statut</th><th scope="col" class="num-c">Lignes</th><th scope="col" class="num-c">Comptées</th><th scope="col" class="num-c">Écarts</th><th scope="col">Date</th></tr></thead><tbody>
      ${rows.map(v => { const s = invSummary(v); return `<tr data-inv="${v.id}" tabindex="0"><td class="mono"><b>${esc(v.number)}</b></td><td>${esc(v.name)}${v.demo ? ' <span class="chip gold xs">Démo</span>' : ''}</td><td>${esc(scopeLabel(v.scope))}</td>
        <td><span class="chip ${INV_STATUS[v.status].cls}">${INV_STATUS[v.status].label}</span></td><td class="num-c mono">${v.lines.length}</td><td class="num-c mono">${s.counted}</td>
        <td class="num-c mono">${s.diffLines ? `<span class="${s.diffValue < 0 ? 'dng-t' : 'ok-t'}">${s.diffLines} (${fmtMoney(s.diffValue)})</span>` : '0'}</td><td>${fmtDate(v.validatedAt || v.openedAt || v.createdAt)}</td></tr>`; }).join('')}
      </tbody></table></div>`
      : emptyState('clipcheck', 'Aucun inventaire', 'Lancez un inventaire général ou partiel pour vérifier vos quantités réelles et corriger les écarts.', can('inventory.validate') && S.products.length ? `<button type="button" class="btn gold" data-inew>${svg('plus')} Créer un inventaire</button>` : ''));
  $$('[data-inv]', el).forEach(r => { r.onclick = () => go('inventaires', { id: r.dataset.inv }); r.onkeydown = e => { if (e.key === 'Enter') go('inventaires', { id: r.dataset.inv }); }; });
  $$('[data-ist]', el).forEach(b => b.onclick = () => { INVL.status = b.dataset.ist; route({ keepScroll: true }); });
  $$('#iNew,[data-inew]', el).forEach(b => b.onclick = () => inventoryForm());
};

function scopeLabel(sc) {
  if (!sc) return '—';
  if (sc.type === 'category') return 'Catégorie : ' + catName(sc.value);
  if (sc.type === 'location') return 'Emplacement : ' + locName(sc.value);
  if (sc.type === 'selection') return 'Sélection de ' + (sc.ids?.length || 0) + ' produit(s)';
  return 'Inventaire général';
}
function invSummary(v) {
  let counted = 0, diffLines = 0, diffValue = 0, plus = 0, minus = 0;
  v.lines.forEach(l => {
    const e = INVW.id === v.id && INVW.edits.has(l.id) ? INVW.edits.get(l.id) : l;
    if (e.counted === null || e.counted === '' || e.counted === undefined) return;
    counted++;
    const d = Number(e.counted) - Number(l.theoretical ?? 0);
    if (Math.abs(d) > 1e-9) { diffLines++; const pr = productById(l.productId)?.purchasePrice || 0; diffValue += d * pr; if (d > 0) plus += d * pr; else minus += d * pr; }
  });
  return { counted, todo: v.lines.length - counted, diffLines, diffValue: round2(diffValue), plus: round2(plus), minus: round2(minus) };
}

/* ═════════════════════ CRÉATION ═════════════════════ */
function inventoryForm() {
  let sel = new Set();
  openModal({
    title: 'Nouvel inventaire', wide: true,
    body: `${fieldHTML({ id: 'ifName', label: 'Intitulé', value: 'Inventaire du ' + fmtDate(todayISO()), req: true })}
      <div class="field"><span class="flabel" id="ifScopeL">Périmètre</span><div class="seg wrap-seg" role="radiogroup" aria-labelledby="ifScopeL">
        ${[['all', 'Général'], ['category', 'Par catégorie'], ['location', 'Par emplacement'], ['selection', 'Sélection de produits']].map(([k, l], i) => `<button type="button" role="radio" data-sc="${k}" class="${i ? '' : 'on'}" aria-checked="${!i}">${l}</button>`).join('')}</div></div>
      <div id="ifScopeVal"></div>
      <p class="notice-sm" id="ifCount" aria-live="polite"></p>
      ${textareaHTML({ id: 'ifObs', label: 'Observations (facultatif)', rows: 2 })}`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="ifSave">Créer l'inventaire</button>`,
    onOpen: m => {
      let scope = { type: 'all' };
      const count = () => {
        const ids = scope.type === 'selection' ? [...sel] : inventoryScopeProducts(scope).map(p => p.id);
        $('#ifCount', m).innerHTML = `${svg('info', 'inl')} <b>${ids.length}</b> produit(s) concerné(s). Le stock théorique sera figé au démarrage du comptage.`;
        return ids;
      };
      const drawScope = () => {
        const h = $('#ifScopeVal', m);
        if (scope.type === 'category') h.innerHTML = selectHTML({ id: 'ifCat', label: 'Catégorie', options: optCategories(), req: true });
        else if (scope.type === 'location') h.innerHTML = selectHTML({ id: 'ifLoc', label: 'Emplacement', options: optLocations(), req: true });
        else if (scope.type === 'selection') {
          h.innerHTML = `<div class="field"><label for="ifQ">Produits à inventorier</label><input class="inp" id="ifQ" type="search" placeholder="Filtrer…"><div class="pick-list" id="ifList" role="group" aria-label="Produits"></div>
            <div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" id="ifAll">Tout cocher (liste filtrée)</button><button type="button" class="btn sm ghost" id="ifNone">Tout décocher</button></div></div>`;
          const list = () => { const t = norm(val(m, 'ifQ')); return S.products.filter(p => p.status === 'active' && (!t || norm(p.name).includes(t) || norm(p.sku).includes(t))).sort((a, b) => a.name.localeCompare(b.name, 'fr')); };
          const draw = () => {
            $('#ifList', m).innerHTML = list().slice(0, 300).map(p => `<label class="pick-i"><input type="checkbox" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}><span>${esc(p.name)} <small class="mono muted">${esc(p.sku)} · ${fmtNum(productQty(p))} ${esc(p.unit)}</small></span></label>`).join('') || '<p class="muted">Aucun produit.</p>';
            $$('#ifList input', m).forEach(c => c.onchange = () => { c.checked ? sel.add(c.value) : sel.delete(c.value); scope.ids = [...sel]; count(); });
          };
          $('#ifQ', m).oninput = debounce(draw, 120); draw();
          $('#ifAll', m).onclick = () => { list().forEach(p => sel.add(p.id)); scope.ids = [...sel]; draw(); count(); };
          $('#ifNone', m).onclick = () => { sel.clear(); scope.ids = []; draw(); count(); };
        } else h.innerHTML = '';
        const s = $('#ifCat', m) || $('#ifLoc', m);
        if (s) { scope.value = s.value; s.onchange = () => { scope.value = s.value; count(); }; }
        count();
      };
      $$('[data-sc]', m).forEach(b => b.onclick = () => { scope = { type: b.dataset.sc, ids: [...sel] }; $$('[data-sc]', m).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); drawScope(); });
      drawScope();
      $('#ifSave', m).onclick = e => guard(e.currentTarget, async () => {
        const ids = count();
        try {
          const inv = await createInventory({ name: val(m, 'ifName'), scope: scope.type === 'selection' ? { type: 'selection', ids } : { type: scope.type, value: scope.value }, productIds: ids, observations: val(m, 'ifObs') });
          closeModal(1); toast(`Inventaire ${inv.number} créé`, 'ok'); go('inventaires', { id: inv.id });
        } catch (err) { formError(m, err.message); }
      });
    }
  });
}

/* ═════════════════════ DÉTAIL / COMPTAGE / VALIDATION ═════════════════════ */
function inventoryDetail(el, v) {
  if (INVW.id !== v.id) { INVW.id = v.id; INVW.edits = new Map(); INVW.page = 1; INVW.q = ''; }
  const st = INV_STATUS[v.status];
  const editable = ['counting'].includes(v.status);
  const s = invSummary(v);
  const since = v.status === 'review' || v.status === 'counting' ? movementsSinceOpening(v) : [];
  const actions = [];
  if (v.status === 'draft') actions.push(`<button type="button" class="btn gold" id="ivStart">${svg('play')} Démarrer le comptage</button>`);
  if (v.status === 'counting') actions.push(`<button type="button" class="btn" id="ivSave">${svg('check')} Enregistrer</button><button type="button" class="btn gold" id="ivReview">Terminer et vérifier</button>`);
  if (v.status === 'review') actions.push(`<button type="button" class="btn" id="ivBack">${svg('undo')} Revenir au comptage</button>` + (can('inventory.validate') ? `<button type="button" class="btn gold" id="ivValidate">${svg('check')} Valider l'inventaire</button>` : ''));
  if (['draft', 'counting', 'review'].includes(v.status) && can('inventory.validate')) actions.push(`<button type="button" class="btn danger" id="ivCancel">Annuler</button>`);
  actions.push(`<button type="button" class="btn" id="ivPrint">${svg('printer')} Imprimer</button><button type="button" class="btn" id="ivCsv">${svg('down')} CSV</button>`);
  el.innerHTML = pageHead(`${v.number} · ${v.name}`, crumb('Opérations', 'Inventaires', v.number), actions.join(''),
    `<span class="chip ${st.cls}">${st.label}</span> · ${esc(scopeLabel(v.scope))} · créé le ${fmtDateTime(v.createdAt)}${v.openedAt ? ' · stock théorique figé le ' + fmtDateTime(v.openedAt) : ''}${v.validatedAt ? ' · validé le ' + fmtDateTime(v.validatedAt) + ' par ' + esc(v.validatedBy || '') : ''}`) +
    `<a class="btn sm ghost" href="#/inventaires" style="margin-bottom:16px">${svg('undo')} Retour à la liste</a>
    <ol class="steps inv-steps" aria-label="Avancement">${['draft', 'counting', 'review', 'validated'].map((k, i) => `<li class="${k === v.status ? 'on' : ['draft', 'counting', 'review', 'validated'].indexOf(v.status) > i ? 'done' : ''}">${INV_STATUS[k].label}</li>`).join('')}</ol>
    ${v.status === 'cancelled' ? `<div class="notice">${svg('x')}<div>Inventaire annulé : aucune quantité n'a été modifiée.</div></div>` : ''}
    <div class="kpi-grid inv-k" id="ivKpis"></div>
    ${since.length ? `<div class="notice warn-n" role="note">${svg('warn')}<div><b>${since.length} mouvement(s)</b> ont été saisis sur ces produits depuis l'ouverture du comptage. À la validation, seul l'<b>écart</b> (compté − théorique) sera appliqué au stock actuel, ce qui tient compte de ces mouvements.</div></div>` : ''}
    ${v.status === 'draft' ? `<div class="notice">${svg('info')}<div>Au démarrage du comptage, le stock théorique de chaque ligne est figé. Vous pourrez ensuite saisir les quantités comptées : <b>le stock ne sera modifié qu'à la validation</b>.</div></div>` : ''}
    ${v.status === 'validated' && v.adjustments?.length ? `<section class="panel" style="margin-bottom:20px"><div class="panel-h"><h3>Mouvements de régularisation</h3><span class="chip ok">${v.adjustments.length}</span></div><div class="panel-b mv-list">${v.adjustments.map(id => movementById(id)).filter(Boolean).map(movementMini).join('')}</div></section>` : ''}
    <section class="panel" aria-labelledby="ivLT"><div class="panel-h"><h3 id="ivLT">Lignes d'inventaire</h3>
      <div class="row wrap"><div class="search" style="max-width:220px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="ivQ" type="search" aria-label="Rechercher une ligne" placeholder="Produit…" value="${esc(INVW.q)}"></div>
      ${editable ? `<label class="row chk-inline"><input type="checkbox" id="ivTodo" ${INVW.onlyTodo ? 'checked' : ''}> Non comptées</label>` : ''}
      <label class="row chk-inline"><input type="checkbox" id="ivDiff" ${INVW.onlyDiff ? 'checked' : ''}> Avec écart</label>
      ${editable ? `<button type="button" class="btn sm ghost" id="ivFill" title="Reporte le stock théorique dans les lignes non comptées">Compté = théorique (lignes vides)</button>` : ''}</div></div>
      <div class="panel-b" style="padding:0" id="ivLines"></div></section>
    <div class="cols" style="margin-top:20px">
      <section class="panel"><div class="panel-h"><h3>Observations</h3></div><div class="panel-b">
        ${['draft', 'counting', 'review'].includes(v.status) ? `<label class="sr-only" for="ivObs">Observations</label><textarea class="inp" id="ivObs" rows="4">${esc(v.observations || '')}</textarea><button type="button" class="btn sm" id="ivObsSave" style="margin-top:10px">Enregistrer les observations</button>` : `<p class="soft" style="white-space:pre-wrap">${esc(v.observations || 'Aucune observation.')}</p>`}
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Justificatifs</h3><span class="chip">${(v.attachments || []).length}</span></div><div class="panel-b">
        ${(v.attachments || []).map(a => `<div class="row between att-row"><span>${svg('file', 'inl')} ${esc(a.name)} <small class="muted">${(a.size / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko</small></span><button type="button" class="btn sm ghost" data-att="${a.id}" data-name="${esc(a.name)}">${svg('down')} Ouvrir</button></div>`).join('') || '<p class="muted">Aucun justificatif (photos d\'étiquettes, feuilles de comptage signées…).</p>'}
        ${v.status !== 'cancelled' ? `<label class="btn sm ghost" style="margin-top:10px;cursor:pointer">${svg('up')} Ajouter un fichier<input type="file" id="ivAtt" class="sr-only"></label>` : ''}
      </div></section>
    </div>
    <section class="panel" style="margin-top:20px"><div class="panel-h"><h3>Historique de l'inventaire</h3></div><div class="panel-b">${v.history.map(h => `<div class="feed-item"><span class="tm">${hhmm(h.at)}</span><span class="txt"><span class="chip ${INV_STATUS[h.status]?.cls || ''} xs">${INV_STATUS[h.status]?.label || h.status}</span> ${esc(h.by || '')}<small class="muted feed-meta">${fmtDateTime(h.at)}</small></span></div>`).join('')}</div></section>`;

  const drawKpis = () => {
    const s2 = invSummary(v);
    $('#ivKpis', el).innerHTML = kpiCard({ icon: 'list', num: fmtNum(v.lines.length, 0), lbl: 'Lignes' }) + kpiCard({ icon: 'check', cls: 'ok', num: fmtNum(s2.counted, 0), lbl: 'Comptées', sub: s2.todo ? `${s2.todo} restante(s)` : 'Tout est compté' })
      + kpiCard({ icon: 'warn', cls: s2.diffLines ? 'warn' : 'ok', num: fmtNum(s2.diffLines, 0), lbl: 'Lignes en écart' })
      + kpiCard({ icon: 'euro', cls: s2.diffValue < 0 ? 'dng' : 'ok', num: fmtMoneyShort(s2.diffValue), lbl: 'Valeur nette des écarts', sub: `+${fmtMoney(s2.plus)} / ${fmtMoney(s2.minus)}` });
  };
  const drawLines = () => {
    const host = $('#ivLines', el);
    const t = norm(INVW.q);
    let rows = v.lines.filter(l => { const p = productById(l.productId); return !t || norm(p?.name).includes(t) || norm(p?.sku).includes(t) || (p?.ean || '').includes(t); });
    const cur = l => INVW.edits.has(l.id) ? INVW.edits.get(l.id) : l;
    if (INVW.onlyTodo) rows = rows.filter(l => cur(l).counted === null || cur(l).counted === '');
    if (INVW.onlyDiff) rows = rows.filter(l => { const c = cur(l).counted; return c !== null && c !== '' && Math.abs(Number(c) - Number(l.theoretical ?? 0)) > 1e-9; });
    const pg = paginate(rows, INVW, 50);
    host.innerHTML = rows.length ? `<div class="tbl-wrap flat"><table class="tbl inv-tbl"><caption class="sr-only">Lignes d'inventaire : stock théorique, quantité comptée et écart</caption><thead><tr><th scope="col">Produit</th><th scope="col">Emplacement</th><th scope="col" class="num-c">Théorique</th><th scope="col" class="num-c">Compté</th><th scope="col" class="num-c">Écart</th><th scope="col" class="num-c">Valeur écart</th><th scope="col">Note</th></tr></thead><tbody>
      ${pg.rows.map(l => {
      const p = productById(l.productId); const c = cur(l); const theo = l.theoretical;
      const has = c.counted !== null && c.counted !== '' && c.counted !== undefined;
      const d = has && theo !== null ? round3(Number(c.counted) - theo) : null;
      const idQ = 'q_' + l.id, idN = 'n_' + l.id;
      return `<tr data-line="${l.id}" class="${d ? (d > 0 ? 'diff-p' : 'diff-m') : ''}"><td><b>${esc(p?.name || '?')}</b><small class="mono muted d-block">${esc(p?.sku || '')}</small></td><td>${esc(locName(l.locId))}</td>
        <td class="num-c mono">${theo === null ? '<span class="muted">à figer</span>' : fmtNum(theo)}</td>
        <td class="num-c">${editable ? `<label class="sr-only" for="${idQ}">Quantité comptée pour ${esc(p?.name || '')} à ${esc(locName(l.locId))}</label><input class="inp count-inp" id="${idQ}" data-q="${l.id}" inputmode="decimal" value="${has ? String(c.counted).replace('.', ',') : ''}" placeholder="—" autocomplete="off">` : `<span class="mono">${has ? fmtNum(c.counted) : '<span class="muted">non compté</span>'}</span>`}</td>
        <td class="num-c mono" data-d="${l.id}">${d === null ? '—' : d === 0 ? '<span class="ok-t">0</span>' : `<b class="${d > 0 ? 'ok-t' : 'dng-t'}">${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))}</b>`}</td>
        <td class="num-c mono" data-dv="${l.id}">${d ? fmtMoney(d * (p?.purchasePrice || 0)) : '—'}</td>
        <td>${editable ? `<label class="sr-only" for="${idN}">Note pour ${esc(p?.name || '')}</label><input class="inp note-inp" id="${idN}" data-n="${l.id}" value="${esc(c.note || '')}" placeholder="Observation…">` : esc(c.note || '')}</td></tr>`;
    }).join('')}</tbody></table></div><div style="padding:0 16px 14px">${pagerHTML(INVW.page, pg.pages, pg.total, pg.start, pg.rows.length, 'ligne')}</div>`
      : `<div class="empty" style="padding:30px"><h4>Aucune ligne</h4><p>Aucune ligne ne correspond aux filtres.</p></div>`;
    bindPager(host, INVW, async () => { await persistEdits(true); drawLines(); });
    $$('[data-q]', host).forEach(inp => {
      inp.oninput = () => {
        const id = inp.dataset.q; const l = v.lines.find(x => x.id === id); const e = INVW.edits.get(id) || { counted: l.counted, note: l.note };
        const raw = inp.value.trim(); const n = raw === '' ? null : parseNum(raw);
        inp.setAttribute('aria-invalid', raw !== '' && (isNaN(n) || n < 0) ? 'true' : 'false');
        e.counted = raw === '' ? null : (isNaN(n) ? e.counted : n); INVW.edits.set(id, e);
        const d = e.counted === null ? null : round3(e.counted - (l.theoretical || 0));
        const p = productById(l.productId);
        $(`[data-d="${id}"]`, host).innerHTML = d === null ? '—' : d === 0 ? '<span class="ok-t">0</span>' : `<b class="${d > 0 ? 'ok-t' : 'dng-t'}">${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))}</b>`;
        $(`[data-dv="${id}"]`, host).textContent = d ? fmtMoney(d * (p?.purchasePrice || 0)) : '—';
        inp.closest('tr').className = d ? (d > 0 ? 'diff-p' : 'diff-m') : '';
        drawKpis();
      };
      /* Entrée = ligne suivante (saisie rapide au clavier ou à la douchette) */
      inp.onkeydown = e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); const all = $$('[data-q]', host); const i = all.indexOf(inp); (all[i + 1] || all[i]).focus(); all[i + 1]?.select(); } else if (e.key === 'ArrowUp') { e.preventDefault(); const all = $$('[data-q]', host); const i = all.indexOf(inp); all[i - 1]?.focus(); } };
    });
    $$('[data-n]', host).forEach(inp => inp.oninput = () => { const id = inp.dataset.n; const l = v.lines.find(x => x.id === id); const e = INVW.edits.get(id) || { counted: l.counted, note: l.note }; e.note = inp.value; INVW.edits.set(id, e); });
  };
  /* Enregistrement des comptages en attente (ne touche pas au stock) */
  const persistEdits = async (quiet) => {
    if (!INVW.edits.size || v.status !== 'counting') return;
    const lines = [...INVW.edits.entries()].map(([id, e]) => ({ id, counted: e.counted, note: e.note }));
    v = await saveInventoryCounts(v.id, lines, $('#ivObs', el) ? $('#ivObs', el).value : undefined);
    INVW.edits.clear();
    if (!quiet) toast('Comptage enregistré (le stock n\'est pas modifié avant validation)', 'ok');
  };
  drawKpis(); drawLines();
  $('#ivQ', el).oninput = debounce(e => { INVW.q = e.target.value; INVW.page = 1; drawLines(); }, 150);
  if ($('#ivTodo', el)) $('#ivTodo', el).onchange = e => { INVW.onlyTodo = e.target.checked; INVW.page = 1; drawLines(); };
  $('#ivDiff', el).onchange = e => { INVW.onlyDiff = e.target.checked; INVW.page = 1; drawLines(); };
  if ($('#ivFill', el)) $('#ivFill', el).onclick = () => { v.lines.forEach(l => { const c = INVW.edits.get(l.id) || { counted: l.counted, note: l.note }; if (c.counted === null || c.counted === '') { c.counted = l.theoretical; INVW.edits.set(l.id, c); } }); drawLines(); drawKpis(); toast('Lignes vides complétées avec le stock théorique. Pensez à enregistrer.', 'info'); };
  if ($('#ivStart', el)) $('#ivStart', el).onclick = e => guard(e.currentTarget, async () => { await startInventory(v.id); toast('Comptage démarré : stock théorique figé', 'ok'); });
  if ($('#ivSave', el)) $('#ivSave', el).onclick = e => guard(e.currentTarget, async () => { if (!INVW.edits.size) return toast('Aucune modification à enregistrer.', 'info'); await persistEdits(false); refreshView(); });
  if ($('#ivReview', el)) $('#ivReview', el).onclick = e => guard(e.currentTarget, async () => {
    await persistEdits(true);
    const s2 = invSummary(inventoryById(v.id));
    const go2 = async () => { await setInventoryStatus(v.id, 'review'); toast('Inventaire à vérifier', 'ok'); };
    if (s2.todo) confirmDialog(`${s2.todo} ligne(s) ne sont pas comptées. Elles ne seront pas régularisées à la validation. Continuer ?`, go2, { danger: false, yes: 'Passer en vérification' });
    else await go2();
  });
  if ($('#ivBack', el)) $('#ivBack', el).onclick = e => guard(e.currentTarget, async () => { await setInventoryStatus(v.id, 'counting'); });
  if ($('#ivValidate', el)) $('#ivValidate', el).onclick = () => {
    const s2 = invSummary(v);
    confirmDialog(`Valider l'inventaire ${v.number} ? ${s2.diffLines} mouvement(s) de régularisation seront créés (valeur nette ${fmtMoney(s2.diffValue)}). Cette opération est définitive ; chaque régularisation restera annulable individuellement.`,
      async () => { const r = await validateInventory(v.id); toast(`Inventaire validé : ${r.adjustments.length} régularisation(s)`, 'ok'); }, { danger: false, yes: 'Valider et régulariser', title: 'Validation de l\'inventaire' });
  };
  if ($('#ivCancel', el)) $('#ivCancel', el).onclick = () => confirmDialog(`Annuler l'inventaire ${v.number} ? Aucune quantité ne sera modifiée ; l'inventaire restera consultable.`, async () => { INVW.edits.clear(); await setInventoryStatus(v.id, 'cancelled'); toast('Inventaire annulé', 'warn'); });
  if ($('#ivObsSave', el)) $('#ivObsSave', el).onclick = e => guard(e.currentTarget, async () => {
    const cur = inventoryById(v.id);
    if (cur.status === 'counting' || cur.status === 'review') { await saveInventoryCounts(v.id, [...INVW.edits.entries()].map(([id, x]) => ({ id, ...x })), $('#ivObs', el).value); INVW.edits.clear(); }
    else await commit({ put: { inventories: [{ ...clone(cur), observations: $('#ivObs', el).value }] } }, { what: 'inventory', silent: true });
    toast('Observations enregistrées', 'ok');
  });
  if ($('#ivAtt', el)) $('#ivAtt', el).onchange = ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > 15 * 1048576) return toast('Fichier trop volumineux (15 Mo maximum).', 'dng'); guard(null, async () => { await persistEdits(true); await addInventoryAttachment(v.id, f); toast('Justificatif ajouté', 'ok'); }); };
  $$('[data-att]', el).forEach(b => b.onclick = async () => { const md = await IDB.getMedia(b.dataset.att); if (!md) return toast('Fichier introuvable.', 'dng'); downloadBlob(md.blob, b.dataset.name); });
  $('#ivPrint', el).onclick = async () => { await persistEdits(true); printInventory(inventoryById(v.id)); };
  $('#ivCsv', el).onclick = async () => { await persistEdits(true); exportInventoryCSV(inventoryById(v.id)); };
}
