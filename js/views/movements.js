/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/movements.js
   Mouvements de stock : entrées, sorties, transferts, ajustements.
   Historique non modifiable (filtrable, exportable) ; toute erreur se
   corrige par une ANNULATION tracée (mouvement inverse).
   ██████████████████████████████████████████████████████████████ */
"use strict";

const MVF = { q: '', type: '', product: '', loc: '', op: '', period: 'all', from: '', to: '', page: 1 };

function filteredMovements(f = MVF) {
  const t = norm(f.q);
  let P = null;
  if (f.period === 'today') P = { from: todayISO(), to: todayISO() };
  else if (f.period === 'custom' && f.from && f.to) P = { from: f.from, to: f.to };
  else if (['7', '30', '90', 'year'].includes(f.period)) P = periodFromKey(f.period);
  return S.movements.filter(m => {
    if (f.type && (f.type === 'entries' ? !['in', 'reception', 'initial'].includes(m.type) : m.type !== f.type)) return false;
    if (f.product && m.productId !== f.product) return false;
    if (f.loc && m.locId !== f.loc && m.toLocId !== f.loc) return false;
    if (f.op && m.operatorId !== f.op) return false;
    if (P && !inPeriod(m, P)) return false;
    if (t) { const p = productById(m.productId); if (!(norm(m.number).includes(t) || norm(p?.name).includes(t) || norm(p?.sku).includes(t) || norm(m.docRef).includes(t) || norm(m.reason).includes(t) || norm(m.comment).includes(t) || norm(m.recipient).includes(t))) return false; }
    return true;
  }).reverse();
}

VIEWS.movements = (el, params) => {
  if (params.product) MVF.product = params.product;
  if (params.period) MVF.period = params.period;
  if (params.type) MVF.type = params.type;
  const canMove = can('stock.move') && S.products.length;
  el.innerHTML = pageHead('Mouvements de stock', crumbFor('mouvements'),
    (can('export') ? `<button type="button" class="btn" id="mExport">${svg('down')} Export CSV</button>` : '') +
    (canMove ? `<button type="button" class="btn" id="mTr">${svg('swap')} Transfert</button>` + (can('stock.force') ? `<button type="button" class="btn" id="mAdj">${svg('sliders')} Ajustement</button>` : '') +
      `<button type="button" class="btn" id="mOut">${svg('arrout')} Sortie</button><button type="button" class="btn gold" id="mIn">${svg('arrin')} Entrée</button>` : ''),
    `${fmtNum(S.movements.length, 0)} opération(s) tracée(s) — l'historique n'est jamais modifié : une erreur se corrige par une annulation.`) +
    `<div class="tbl-tools" role="search" aria-label="Filtrer l'historique">
      <div class="search" style="max-width:260px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="mQ" type="search" aria-label="Rechercher : n°, produit, document, motif" placeholder="N°, produit, document, motif…" value="${esc(MVF.q)}"></div>
      <label class="sr-only" for="mType">Type</label><select class="sel" id="mType" style="width:auto"><option value="">Tous types</option><option value="entries" ${MVF.type === 'entries' ? 'selected' : ''}>Toutes les entrées</option>${Object.entries(MV_TYPES).map(([k, t]) => `<option value="${k}" ${MVF.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
      <label class="sr-only" for="mProd">Produit</label><select class="sel" id="mProd" style="width:auto;max-width:230px"><option value="">Tous produits</option>${optProducts(() => true).map(([v, l]) => `<option value="${v}" ${MVF.product === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="mLoc">Emplacement</label><select class="sel" id="mLoc" style="width:auto"><option value="">Tous emplacements</option>${optLocations().map(([v, l]) => `<option value="${v}" ${MVF.loc === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <label class="sr-only" for="mOp">Opérateur</label><select class="sel" id="mOp" style="width:auto"><option value="">Tous opérateurs</option>${OPERATORS.map(o => `<option value="${o.id}" ${MVF.op === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
      <label class="sr-only" for="mPer">Période</label><select class="sel" id="mPer" style="width:auto">${[['all', 'Toute la période'], ['today', "Aujourd'hui"], ['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['year', 'Année en cours'], ['custom', 'Personnalisée…']].map(([v, l]) => `<option value="${v}" ${MVF.period === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="row ${MVF.period === 'custom' ? '' : 'hide'}" id="mCustom"><label class="sr-only" for="mFrom">Du</label><input class="inp" type="date" id="mFrom" value="${MVF.from}" style="width:auto"><label class="sr-only" for="mTo">Au</label><input class="inp" type="date" id="mTo" value="${MVF.to}" style="width:auto"></span>
      <button type="button" class="btn ghost sm" id="mReset">Réinitialiser</button>
    </div><div id="mList" aria-live="polite"></div>`;

  const draw = () => {
    const rows = filteredMovements();
    const pg = paginate(rows, MVF);
    const host = $('#mList', el);
    if (!rows.length) {
      host.innerHTML = S.movements.length ? emptyState('search', 'Aucun mouvement', 'Aucune opération ne correspond à ces filtres.')
        : emptyState('swap', 'Aucun mouvement enregistré', 'Les entrées, sorties, transferts et régularisations apparaîtront ici, avec le stock avant et après chaque opération.', canMove ? `<button type="button" class="btn gold" data-mfirst>${svg('arrin')} Enregistrer une entrée</button>` : '');
    } else {
      const sIn = sum(rows.filter(m => isLive(m) && m.delta > 0), m => m.value), sOut = sum(rows.filter(m => isLive(m) && m.delta < 0), m => m.value);
      host.innerHTML = `<div class="row wrap mv-sum"><span class="chip">${fmtNum(rows.length, 0)} mouvement(s)</span><span class="chip ok">${svg('arrin')}Entrées ${fmtMoney(sIn)}</span><span class="chip warn">${svg('arrout')}Sorties ${fmtMoney(sOut)}</span></div>
      <div class="tbl-wrap"><table class="tbl wide"><caption class="sr-only">Historique des mouvements de stock, du plus récent au plus ancien</caption><thead><tr>
        <th scope="col">N° / date</th><th scope="col">Type</th><th scope="col">Produit</th><th scope="col" class="num-c">Quantité</th><th scope="col" class="num-c">Stock avant → après</th><th scope="col">Emplacement</th><th scope="col">Motif / document</th><th scope="col">Opérateur</th><th scope="col" class="num-c">Valeur</th></tr></thead>
        <tbody>${pg.rows.map(mvRow).join('')}</tbody></table></div>` + pagerHTML(MVF.page, pg.pages, pg.total, pg.start, pg.rows.length, 'mouvement');
    }
    bindPager(host, MVF, draw);
    $$('[data-mvd]', host).forEach(r => { r.onclick = () => movementDetail(r.dataset.mvd); r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); movementDetail(r.dataset.mvd); } }; });
    $$('[data-mfirst]', host).forEach(b => b.onclick = () => movementForm('in'));
  };
  draw();
  $('#mQ', el).oninput = debounce(e => { MVF.q = e.target.value; MVF.page = 1; draw(); }, 150);
  [['mType', 'type'], ['mProd', 'product'], ['mLoc', 'loc'], ['mOp', 'op'], ['mFrom', 'from'], ['mTo', 'to']].forEach(([id, k]) => $('#' + id, el).onchange = e => { MVF[k] = e.target.value; MVF.page = 1; draw(); });
  $('#mPer', el).onchange = e => { MVF.period = e.target.value; MVF.page = 1; $('#mCustom', el).classList.toggle('hide', MVF.period !== 'custom'); if (MVF.period === 'custom') { if (!MVF.from) { MVF.from = addDays(todayISO(), -29); MVF.to = todayISO(); $('#mFrom', el).value = MVF.from; $('#mTo', el).value = MVF.to; } } draw(); };
  $('#mReset', el).onclick = () => { Object.assign(MVF, { q: '', type: '', product: '', loc: '', op: '', period: 'all', from: '', to: '', page: 1 }); go('mouvements'); };
  if ($('#mExport', el)) $('#mExport', el).onclick = () => exportMovementsCSV(filteredMovements());
  if ($('#mIn', el)) $('#mIn', el).onclick = () => movementForm('in');
  if ($('#mOut', el)) $('#mOut', el).onclick = () => movementForm('out');
  if ($('#mTr', el)) $('#mTr', el).onclick = () => movementForm('transfer');
  if ($('#mAdj', el)) $('#mAdj', el).onclick = () => movementForm('adjust');
};

function mvRow(m) {
  const p = productById(m.productId), t = MV_TYPES[m.type];
  const sign = m.type === 'transfer' || (m.type === 'cancel' && m.delta === 0) ? '⇄ ' : m.delta > 0 ? '+' : m.delta < 0 ? '−' : '';
  const loc = m.toLocId ? `${esc(locName(m.locId))} → ${esc(locName(m.toLocId))}` : esc(locName(m.locId));
  const motif = [m.reason, m.docRef, m.recipient ? 'pour ' + m.recipient : ''].filter(Boolean).join(' · ');
  return `<tr data-mvd="${m.id}" tabindex="0" class="${m.cancelledById ? 'is-cancelled' : ''}" aria-label="${esc(t.label)} ${esc(m.number)} : ${esc(p?.name || '')}, ${sign}${fmtNum(m.qty)}${m.cancelledById ? ', annulé' : ''}">
    <td class="nowrap"><b class="mono">${esc(m.number)}</b><small class="muted d-block">${fmtDateTime(m.date)}</small></td>
    <td><span class="chip ${t.cls}">${svg(t.icon)}${esc(t.label)}</span>${m.cancelledById ? ' <span class="chip dng xs">Annulé</span>' : ''}${m.forced ? ' <span class="chip warn xs">Forcé</span>' : ''}</td>
    <td><b>${esc(p?.name || 'Produit supprimé')}</b><small class="mono muted d-block">${esc(p?.sku || '')}</small></td>
    <td class="num-c mono qty-${m.delta > 0 ? 'in' : m.delta < 0 ? 'out' : 'tr'}"><b>${sign}${fmtNum(m.qty)}</b> <small class="muted">${esc(p?.unit || '')}</small></td>
    <td class="num-c mono">${fmtNum(m.qtyBefore)} → <b>${fmtNum(m.qtyAfter)}</b></td>
    <td>${loc}</td><td class="soft">${esc(motif || '—')}</td><td>${esc(m.operatorName || '—')}</td>
    <td class="num-c mono">${fmtMoney(m.value)}</td></tr>`;
}
/* Ligne compacte (fiche produit) */
function movementMini(m) {
  const t = MV_TYPES[m.type]; const sign = m.type === 'transfer' ? '⇄ ' : m.delta > 0 ? '+' : m.delta < 0 ? '−' : '';
  return `<button type="button" class="list-row" data-mvd="${m.id}"><div><span class="chip ${t.cls} xs">${svg(t.icon)}${esc(t.label)}</span>${m.cancelledById ? ' <span class="chip dng xs">Annulé</span>' : ''}
    <small class="muted d-block">${fmtDateTime(m.date)} · ${esc(m.number)}${m.reason ? ' · ' + esc(m.reason) : ''}</small></div>
    <div style="text-align:right"><b class="mono">${sign}${fmtNum(m.qty)}</b><small class="muted d-block mono">${fmtNum(m.qtyBefore)} → ${fmtNum(m.qtyAfter)}</small></div></button>`;
}

/* ═════════════════════ DÉTAIL D'UN MOUVEMENT ═════════════════════ */
function movementDetail(id) {
  const m = movementById(id); if (!m) return toast('Mouvement introuvable.', 'warn');
  const p = productById(m.productId), t = MV_TYPES[m.type];
  const canc = m.cancelledById ? movementById(m.cancelledById) : null;
  const orig = m.cancelsId ? movementById(m.cancelsId) : null;
  const block = cancelBlocker(m);
  const line = (k, v) => `<div class="info-line"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  openModal({
    title: `${t.label} · ${m.number}`, wide: true,
    body: `<div class="row wrap" style="margin-bottom:14px;gap:8px"><span class="chip ${t.cls}">${svg(t.icon)}${esc(t.label)}</span>${m.cancelledById ? '<span class="chip dng">Annulé</span>' : ''}${m.forced ? '<span class="chip warn">Ajustement exceptionnel</span>' : ''}${m.demo ? '<span class="chip gold">Démo</span>' : ''}</div>
      ${line('Identifiant', `<span class="mono" style="font-size:.78rem">${esc(m.id)}</span>`)}
      ${line('Produit', p ? `<button type="button" class="link-btn" id="mdProd">${esc(p.name)}</button> <small class="mono muted">${esc(p.sku)}</small>` : 'Produit supprimé')}
      ${line('Quantité', `<b class="mono">${m.delta > 0 ? '+' : m.delta < 0 ? '−' : ''}${fmtNum(m.qty)} ${esc(p?.unit || '')}</b>`)}
      ${line('Stock total avant → après', `<span class="mono">${fmtNum(m.qtyBefore)} → ${fmtNum(m.qtyAfter)}</span>`)}
      ${m.toLocId ? line('Origine', `${esc(locName(m.locId))} <small class="mono muted">(${fmtNum(m.locBefore)} → ${fmtNum(m.locAfter)})</small>`) + line('Destination', `${esc(locName(m.toLocId))} <small class="mono muted">(${fmtNum(m.toBefore)} → ${fmtNum(m.toAfter)})</small>`) + line('Statut du transfert', m.cancelledById ? 'Annulé' : 'Effectué')
      : line('Emplacement', `${esc(locName(m.locId))} <small class="mono muted">(${fmtNum(m.locBefore)} → ${fmtNum(m.locAfter)})</small>`)}
      ${line('Date de l\'opération', fmtDateTime(m.date))}
      ${line('Enregistré le', fmtDateTime(m.at))}
      ${line('Coût unitaire', `<span class="mono">${fmtMoney(m.unitCost)}</span>`)}
      ${line('Valeur', `<span class="mono">${fmtMoney(m.value)}</span>`)}
      ${m.priceBefore !== m.priceAfter ? line('Prix d\'achat (valorisation)', `<span class="mono">${fmtMoney(m.priceBefore)} → ${fmtMoney(m.priceAfter)}</span>`) : ''}
      ${m.reason ? line('Motif', esc(m.reason)) : ''}${m.recipient ? line('Destinataire', esc(m.recipient)) : ''}
      ${m.supplierId ? line('Fournisseur', esc(supName(m.supplierId))) : ''}
      ${m.docRef ? line('Référence documentaire', `<span class="mono">${esc(m.docRef)}</span>`) : ''}
      ${m.orderId ? line('Commande', `<button type="button" class="link-btn" id="mdOrd">${esc(orderById(m.orderId)?.number || '—')}</button>`) : ''}
      ${m.inventoryId ? line('Inventaire', `<button type="button" class="link-btn" id="mdInv">${esc(inventoryById(m.inventoryId)?.number || '—')}</button>`) : ''}
      ${line('Opérateur', esc(m.operatorName || '—'))}
      ${m.comment ? line('Commentaire', esc(m.comment)) : ''}
      ${canc ? `<div class="notice" style="margin-top:14px">${svg('undo')}<div>Annulé par <button type="button" class="link-btn" data-mvgo="${canc.id}">${esc(canc.number)}</button> le ${fmtDateTime(canc.at)} (${esc(canc.operatorName)}) — motif : ${esc(canc.comment)}</div></div>` : ''}
      ${orig ? `<div class="notice" style="margin-top:14px">${svg('undo')}<div>Ce mouvement annule <button type="button" class="link-btn" data-mvgo="${orig.id}">${esc(orig.number)}</button>.</div></div>` : ''}
      <p class="muted" style="font-size:.78rem;margin-top:16px">${svg('lock', 'inl')} Les mouvements ne sont jamais modifiés ni supprimés. En cas d'erreur, utilisez l'annulation : elle crée un mouvement inverse tracé.</p>`,
    footer: `<button type="button" class="btn ghost" data-close>Fermer</button>${can('movement.cancel') && !block ? `<button type="button" class="btn danger" id="mdCancel">${svg('undo')} Annuler ce mouvement</button>` : ''}`,
    onOpen: md => {
      if ($('#mdProd', md)) $('#mdProd', md).onclick = () => { closeModal(1); openProductDrawer(p.id, 'mv'); };
      if ($('#mdOrd', md)) $('#mdOrd', md).onclick = () => { closeModal(1); openOrderDrawer(m.orderId); };
      if ($('#mdInv', md)) $('#mdInv', md).onclick = () => { closeModal(1); go('inventaires', { id: m.inventoryId }); };
      $$('[data-mvgo]', md).forEach(b => b.onclick = () => movementDetail(b.dataset.mvgo));
      if ($('#mdCancel', md)) $('#mdCancel', md).onclick = () => {
        openModal({
          level: 2, title: 'Annuler le mouvement ' + m.number,
          body: `<p style="line-height:1.6">Un mouvement inverse sera créé : le stock de « ${esc(p?.name || '')} » sera corrigé de <b>${m.type === 'transfer' ? 'retour ' + fmtNum(m.qty) + ' vers ' + esc(locName(m.locId)) : (m.delta > 0 ? '−' : '+') + fmtNum(m.qty)}</b>. Le mouvement d'origine reste visible dans l'historique.</p>
            ${m.type === 'reception' ? `<p class="notice-sm" style="margin-top:10px">${svg('info', 'inl')} La quantité redeviendra « en attente » sur la commande ${esc(orderById(m.orderId)?.number || '')}.</p>` : ''}
            ${textareaHTML({ id: 'cnReason', label: 'Motif de l\'annulation (obligatoire)', rows: 2 })}`,
          footer: `<button type="button" class="btn ghost" data-close>Retour</button><button type="button" class="btn danger" id="cnYes">Confirmer l'annulation</button>`,
          onOpen: m2 => $('#cnYes', m2).onclick = e => guard(e.currentTarget, async () => {
            const r = val(m2, 'cnReason'); if (!r) { formError(m2, 'Indiquez le motif de l\'annulation.'); markInvalid(m2, ['cnReason']); return; }
            const mv = await cancelMovement(m.id, r); closeModal(2); closeModal(1); toast(`Mouvement annulé (${mv.number})`, 'ok');
          })
        });
      };
    }
  });
}

/* ═════════════════════ FORMULAIRE DE MOUVEMENT ═════════════════════ */
function localDateTimeValue(d = new Date()) { return localISO(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function movementForm(type, preset = {}) {
  if (!S.products.some(p => p.status === 'active')) return toast('Créez d\'abord un produit.', 'warn');
  if (type === 'adjust' && !can('stock.force')) return toast('Les ajustements sont réservés aux responsables et administrateurs.', 'warn');
  const TITLES = { in: 'Entrée de marchandises', out: 'Sortie de stock', transfer: 'Transfert entre emplacements', adjust: 'Ajustement de stock' };
  const p0 = preset.productId ? productById(preset.productId) : null;
  const firstLocWithStock = p => Object.keys(p?.stock || {}).find(k => (p.stock[k] || 0) > 0);
  const defLoc = preset.locId || (type === 'in' ? p0?.locationId : firstLocWithStock(p0) || p0?.locationId) || S.locations[0]?.id;
  const locOpts = (p) => optLocations().map(([v, l]) => [v, p ? `${l} — ${fmtNum(p.stock?.[v] || 0)} ${p.unit}` : l]);
  const now = localDateTimeValue();
  const body = `
    ${productPicker('mfProd', 'Produit', preset.productId || '')}
    <div id="mfInfo" class="mf-info" aria-live="polite"></div>
    ${type === 'adjust' ? `<div class="field"><span class="flabel" id="mfDirL">Sens de l'ajustement</span><div class="seg" role="radiogroup" aria-labelledby="mfDirL"><button type="button" role="radio" aria-checked="true" class="on" data-dir="plus">+ Ajouter</button><button type="button" role="radio" aria-checked="false" data-dir="minus">− Retirer</button></div></div>` : ''}
    <div class="grid-2">
      ${fieldHTML({ id: 'mfQty', label: type === 'in' ? 'Quantité reçue' : type === 'out' ? 'Quantité prélevée' : 'Quantité', req: true, attrs: 'inputmode="decimal" autocomplete="off"', value: preset.qty || '' })}
      ${type === 'transfer'
      ? selectHTML({ id: 'mfLoc', label: 'Emplacement d\'origine', options: locOpts(p0), value: defLoc, req: true })
      : selectHTML({ id: 'mfLoc', label: type === 'in' ? 'Emplacement de rangement' : 'Emplacement', options: locOpts(p0), value: defLoc, req: true })}
    </div>
    ${type === 'transfer' ? selectHTML({ id: 'mfTo', label: 'Emplacement de destination', options: optLocations(), value: S.locations.find(l => l.id !== defLoc)?.id || '', req: true }) : ''}
    ${type === 'in' ? `<div class="grid-2">${fieldHTML({ id: 'mfCost', label: `Prix d'achat unitaire HT (${SETTINGS.currency})`, value: p0 ? String(p0.purchasePrice).replace('.', ',') : '', attrs: 'inputmode="decimal"', hint: SETTINGS.valuation === 'cump' ? 'Le prix du produit sera recalculé en coût moyen pondéré.' : 'Devient le prix d\'achat du produit.' })}
      ${selectHTML({ id: 'mfSup', label: 'Fournisseur', options: optSuppliers(), value: preset.supplierId || p0?.supplierId || '', empty: '— Non précisé —' })}</div>
      ${fieldHTML({ id: 'mfDoc', label: 'N° de commande, de bon de livraison ou de facture', value: preset.docRef || '' })}` : ''}
    ${type === 'out' ? `<div class="grid-2">${selectHTML({ id: 'mfReason', label: 'Motif de sortie', options: SETTINGS.outReasons, value: preset.reason || SETTINGS.outReasons[0], req: true })}
      ${fieldHTML({ id: 'mfRecip', label: 'Service ou personne destinataire (facultatif)', value: '' })}</div>` : ''}
    ${type === 'adjust' ? selectHTML({ id: 'mfReason', label: 'Motif', options: ['Correction de saisie', 'Casse constatée', 'Produit retrouvé', 'Péremption', 'Vol / disparition', 'Autre'], req: true }) : ''}
    <div class="grid-2">${fieldHTML({ id: 'mfDate', label: 'Date et heure', type: 'datetime-local', value: now, req: true, attrs: `max="${now}"` })}
      ${type === 'out' ? fieldHTML({ id: 'mfDoc', label: 'Référence (bon, chantier, ticket…)', value: '' }) : '<div></div>'}</div>
    ${textareaHTML({ id: 'mfCom', label: type === 'adjust' ? 'Justification (obligatoire)' : 'Commentaire (facultatif)', rows: 2 })}
    ${type === 'out' && can('stock.force') ? `<label class="chk-inline force-box"><input type="checkbox" id="mfForce"> <span><b>Procédure exceptionnelle</b> : autoriser une sortie supérieure au stock enregistré (stock négatif). Justification obligatoire.</span></label>` : ''}`;
  openModal({
    title: TITLES[type], wide: true, body,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="mfSave">${svg(type === 'in' ? 'arrin' : type === 'out' ? 'arrout' : type === 'transfer' ? 'swap' : 'check')} Valider ${type === 'in' ? "l'entrée" : type === 'out' ? 'la sortie' : type === 'transfer' ? 'le transfert' : "l'ajustement"}</button>`,
    onOpen: m => {
      let dir = 'plus';
      const upd = () => {
        const p = productById(val(m, 'mfProd'));
        const info = $('#mfInfo', m);
        if (!p) { info.innerHTML = ''; return; }
        const loc = val(m, 'mfLoc'); const locQ = p.stock?.[loc] || 0; const q = parseNum(val(m, 'mfQty'));
        let delta = type === 'in' ? q : type === 'out' ? -q : type === 'adjust' ? (dir === 'plus' ? q : -q) : 0;
        const after = isNaN(q) ? null : round3(locQ + (type === 'transfer' ? -q : delta));
        const warn = after !== null && after < 0;
        info.innerHTML = `<div class="mf-card ${warn ? 'bad' : ''}">${productThumb(p, 'sm')}<div class="grow"><b>${esc(p.name)}</b><small class="muted d-block">Stock total ${fmtNum(productQty(p))} ${esc(p.unit)} · disponible ${fmtNum(productAvailable(p))} · seuil ${fmtNum(p.minStock)}</small></div>
          <div class="mf-q"><small>${esc(locName(loc))}</small><b class="mono">${fmtNum(locQ)}${after !== null && q > 0 ? ` → <span class="${warn ? 'dng-t' : 'gold'}">${fmtNum(after)}</span>` : ''}</b></div></div>
          ${warn ? `<p class="notice-sm bad">${svg('warn', 'inl')} Quantité supérieure au stock de cet emplacement.${$('#mfForce', m) ? ' Cochez la procédure exceptionnelle si la sortie est réelle.' : ''}</p>` : ''}
          ${!warn && type === 'out' && after !== null && q > 0 && productQty(p) - q < (p.reserved || 0) ? `<p class="notice-sm">${svg('info', 'inl')} Cette sortie entame la quantité réservée (${fmtNum(p.reserved)}).</p>` : ''}`;
      };
      bindProductPicker(m, 'mfProd', id => {
        const p = productById(id); if (!p) return upd();
        const sel = $('#mfLoc', m); const cur = sel.value;
        sel.innerHTML = locOpts(p).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
        sel.value = type === 'in' ? (p.locationId || cur) : (firstLocWithStock(p) || p.locationId || cur);
        if (type === 'in') { $('#mfCost', m).value = String(p.purchasePrice).replace('.', ','); if (p.supplierId) $('#mfSup', m).value = p.supplierId; }
        if (type === 'transfer') { const to = $('#mfTo', m); if (to.value === sel.value) to.value = S.locations.find(l => l.id !== sel.value)?.id || ''; }
        upd();
      });
      ['mfQty', 'mfLoc'].forEach(id => { $('#' + id, m).addEventListener('input', upd); $('#' + id, m).addEventListener('change', upd); });
      $$('[data-dir]', m).forEach(b => b.onclick = () => { dir = b.dataset.dir; $$('[data-dir]', m).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); upd(); });
      upd();
      if (preset.productId) setTimeout(() => $('#mfQty', m).focus(), 80);
      $('#mfSave', m).onclick = e => guard(e.currentTarget, async () => {
        formError(m, '');
        const productId = val(m, 'mfProd'); const qty = parseNum(val(m, 'mfQty'));
        const dt = val(m, 'mfDate');
        const errs = [], bad = [];
        if (!productId) { errs.push('Choisissez un produit.'); bad.push('mfProd'); }
        if (!(qty > 0)) { errs.push('Saisissez une quantité strictement positive.'); bad.push('mfQty'); }
        if (!dt) { errs.push('Indiquez la date de l\'opération.'); bad.push('mfDate'); }
        else if (new Date(dt) > new Date(Date.now() + 60000)) { errs.push('La date ne peut pas être dans le futur.'); bad.push('mfDate'); }
        let cost = null;
        if (type === 'in') { const c = val(m, 'mfCost'); cost = c === '' ? null : parseNum(c); if (c !== '' && (isNaN(cost) || cost < 0)) { errs.push('Prix d\'achat invalide.'); bad.push('mfCost'); } }
        if (type === 'adjust' && !val(m, 'mfCom')) { errs.push('La justification est obligatoire pour un ajustement.'); bad.push('mfCom'); }
        const forced = !!$('#mfForce', m)?.checked;
        if (forced && !val(m, 'mfCom')) { errs.push('Justifiez la procédure exceptionnelle dans le commentaire.'); bad.push('mfCom'); }
        if (errs.length) { formError(m, errs.join('\n')); markInvalid(m, bad); return; }
        try {
          const mv = await recordMovement({
            type: type === 'adjust' ? 'adjust' : type, direction: dir, productId, qty, locId: val(m, 'mfLoc'), toLocId: type === 'transfer' ? val(m, 'mfTo') : null,
            unitCost: cost, supplierId: type === 'in' ? val(m, 'mfSup') || null : null, docRef: $('#mfDoc', m) ? val(m, 'mfDoc') : '',
            reason: $('#mfReason', m) ? val(m, 'mfReason') : '', recipient: $('#mfRecip', m) ? val(m, 'mfRecip') : '',
            comment: val(m, 'mfCom'), date: new Date(dt).toISOString(), forced: forced || (type === 'adjust' && dir === 'minus' && false)
          });
          closeModal(1);
          const p = productById(productId);
          toast(`${MV_TYPES[mv.type].label} enregistrée : ${p.name} — stock ${fmtNum(mv.qtyBefore)} → ${fmtNum(mv.qtyAfter)} ${p.unit}`, 'ok', 4500);
          const lvl = stockLevel(p);
          if (lvl === 'rupture') toast(`Attention : « ${p.name} » est en rupture.`, 'dng');
          else if (lvl === 'low') toast(`« ${p.name} » est passé sous son seuil minimal (${fmtNum(p.minStock)}).`, 'warn');
        } catch (err) { formError(m, err.message); }
      });
    }
  });
}
