/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/orders.js
   Commandes fournisseurs : Brouillon → Validée → Envoyée →
   Partiellement réceptionnée → Réceptionnée (ou Annulée).
   Réceptions partielles : le stock n'augmente que des quantités
   effectivement reçues, jamais au-delà du reliquat.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const ORDF = { status: '', q: '', sup: '', page: 1 };

VIEWS.orders = (el, params) => {
  if (params.status !== undefined) ORDF.status = params.status;
  const cnt = k => k === 'open' ? S.orders.filter(isOrderOpen).length : k === 'late' ? S.orders.filter(isOrderLate).length : k ? S.orders.filter(o => o.status === k).length : S.orders.length;
  el.innerHTML = pageHead('Commandes fournisseurs', crumbFor('commandes'),
    (can('export') ? `<button type="button" class="btn" id="oCsv">${svg('down')} Export CSV</button>` : '') +
    (can('order.edit') ? `<button type="button" class="btn gold" id="oNew">${svg('plus')} Nouvelle commande</button>` : ''),
    `${cnt('open')} commande(s) en attente de livraison${cnt('late') ? ` · <b class="dng-t">${cnt('late')} en retard</b>` : ''}`) +
    `<div class="tbl-tools"><div class="seg wrap-seg" role="group" aria-label="Filtrer par statut">${[['', 'Toutes'], ['open', 'En attente'], ['late', 'En retard'], ...Object.entries(ORDER_STATUS).map(([k, s]) => [k, s.label])].map(([k, l]) => `<button type="button" data-ost="${k}" class="${ORDF.status === k ? 'on' : ''}" aria-pressed="${ORDF.status === k}">${l} <span class="mono">${cnt(k)}</span></button>`).join('')}</div></div>
    <div class="tbl-tools"><div class="search" style="max-width:260px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="oQ" type="search" aria-label="Rechercher une commande" placeholder="N° de commande, produit…" value="${esc(ORDF.q)}"></div>
      <label class="sr-only" for="oSup">Fournisseur</label><select class="sel" id="oSup" style="width:auto"><option value="">Tous fournisseurs</option>${optSuppliers(true).map(([v, l]) => `<option value="${v}" ${ORDF.sup === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div id="oList"></div>`;
  const draw = () => {
    const rows = filteredOrders();
    const pg = paginate(rows, ORDF);
    const host = $('#oList', el);
    host.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Commandes fournisseurs</caption><thead><tr><th scope="col">N°</th><th scope="col">Fournisseur</th><th scope="col">Créée le</th><th scope="col">Livraison prévue</th><th scope="col">Statut</th><th scope="col">Réception</th><th scope="col" class="num-c">Total HT</th><th scope="col" class="num-c">Total TTC</th></tr></thead><tbody>
      ${pg.rows.map(o => { const t = orderTotals(o); const q = sum(o.lines, l => l.qty), r = sum(o.lines, l => l.received || 0); const late = isOrderLate(o);
      return `<tr data-ord="${o.id}" tabindex="0"><td><b class="mono">${esc(o.number)}</b>${o.demo ? ' <span class="chip gold xs">Démo</span>' : ''}</td><td>${esc(supName(o.supplierId))}</td><td>${fmtDate(o.createdAt)}</td>
        <td>${o.expectedDate ? fmtDate(o.expectedDate) : '—'}${late ? ` <span class="chip dng xs">${svg('clock')}${daysBetween(o.expectedDate, todayISO())} j de retard</span>` : ''}</td>
        <td><span class="chip ${ORDER_STATUS[o.status].cls}">${ORDER_STATUS[o.status].label}</span></td>
        <td style="min-width:130px"><div class="prog" role="img" aria-label="${fmtNum(r)} reçus sur ${fmtNum(q)}"><span style="width:${q ? r / q * 100 : 0}%"></span></div><small class="mono muted">${fmtNum(r)} / ${fmtNum(q)}</small></td>
        <td class="num-c mono">${fmtMoney(t.ht)}</td><td class="num-c mono">${fmtMoney(t.ttc)}</td></tr>`; }).join('')}
      </tbody></table></div>` + pagerHTML(ORDF.page, pg.pages, pg.total, pg.start, pg.rows.length, 'commande')
      : S.orders.length ? emptyState('search', 'Aucune commande', 'Aucune commande ne correspond à ces filtres.')
        : emptyState('cart', 'Aucune commande fournisseur', 'Créez une commande manuellement ou générez-la depuis les alertes de réapprovisionnement.', can('order.edit') ? `<button type="button" class="btn gold" data-onew>${svg('plus')} Nouvelle commande</button> <a class="btn" href="#/alertes">${svg('bell')} Voir les alertes</a>` : '');
    bindPager(host, ORDF, draw);
    $$('[data-ord]', host).forEach(r => { r.onclick = () => openOrderDrawer(r.dataset.ord); r.onkeydown = e => { if (e.key === 'Enter') openOrderDrawer(r.dataset.ord); }; });
    $$('[data-onew]', host).forEach(b => b.onclick = () => orderForm());
  };
  draw();
  $$('[data-ost]', el).forEach(b => b.onclick = () => { ORDF.status = b.dataset.ost; ORDF.page = 1; history.replaceState(null, '', '#/commandes'); route({ keepScroll: true }); });
  $('#oQ', el).oninput = debounce(e => { ORDF.q = e.target.value; ORDF.page = 1; draw(); }, 150);
  $('#oSup', el).onchange = e => { ORDF.sup = e.target.value; ORDF.page = 1; draw(); };
  if ($('#oNew', el)) $('#oNew', el).onclick = () => orderForm();
  if ($('#oCsv', el)) $('#oCsv', el).onclick = () => exportOrdersCSV(filteredOrders());
};
function filteredOrders() {
  const t = norm(ORDF.q);
  return S.orders.filter(o => (!ORDF.status || (ORDF.status === 'open' ? isOrderOpen(o) : ORDF.status === 'late' ? isOrderLate(o) : o.status === ORDF.status)) &&
    (!ORDF.sup || o.supplierId === ORDF.sup) &&
    (!t || norm(o.number).includes(t) || norm(supName(o.supplierId)).includes(t) || o.lines.some(l => norm(productById(l.productId)?.name).includes(t))))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* ═════════════════════ FORMULAIRE DE COMMANDE ═════════════════════ */
function orderForm(id, preset = {}) {
  const o = id ? orderById(id) : null;
  if (!S.suppliers.some(s => s.status !== 'archived')) { toast('Ajoutez d\'abord un fournisseur.', 'warn'); return go('fournisseurs'); }
  const d = o ? clone(o) : { supplierId: preset.supplierId || '', lines: preset.lines || [], vatRate: SETTINGS.defaultVat, paymentTerms: '', expectedDate: '', comments: '', fromAlerts: !!preset.fromAlerts };
  let lines = d.lines.map(l => ({ id: l.id, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice }));
  const supDefaults = sid => { const s = supplierById(sid); return { terms: s?.paymentTerms || '', date: addDays(todayISO(), s?.leadTime ?? SETTINGS.defaultLeadTime) }; };
  if (!o && d.supplierId) { const sd = supDefaults(d.supplierId); d.paymentTerms = sd.terms; d.expectedDate = sd.date; }
  openModal({
    title: o ? `Modifier la commande ${o.number}` : 'Nouvelle commande fournisseur', xwide: true,
    body: `<div class="grid-3">${selectHTML({ id: 'ofSup', label: 'Fournisseur', options: optSuppliers(), value: d.supplierId, req: true, empty: '— Choisir —' })}
        ${fieldHTML({ id: 'ofDate', label: 'Date de livraison prévue', type: 'date', value: d.expectedDate || addDays(todayISO(), SETTINGS.defaultLeadTime) })}
        ${selectHTML({ id: 'ofVat', label: 'Taux de TVA', options: SETTINGS.vatRates.map(r => [r, fmtPct(r, r % 1 ? 1 : 0)]), value: d.vatRate })}</div>
      <fieldset class="fs"><legend>Produits commandés</legend>
        <div class="add-line">${productPicker('ofAdd', 'Ajouter un produit', '', { req: false })}<button type="button" class="btn" id="ofAddBtn">${svg('plus')} Ajouter</button></div>
        <label class="chk-inline" style="margin:-4px 0 10px"><input type="checkbox" id="ofOnlySup" checked> Proposer d'abord les produits de ce fournisseur</label>
        <div id="ofLines"></div>
      </fieldset>
      <div class="grid-2">${selectHTML({ id: 'ofTerms', label: 'Conditions de paiement', options: [...new Set([...SETTINGS.paymentTerms, d.paymentTerms].filter(Boolean))], value: d.paymentTerms, empty: '— Non précisé —' })}
        ${textareaHTML({ id: 'ofCom', label: 'Commentaires (imprimés sur le bon)', value: d.comments, rows: 2 })}</div>`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="ofSave">${o ? 'Enregistrer' : 'Créer le brouillon'}</button>`,
    onOpen: m => {
      const drawLines = () => {
        const vat = parseNum(val(m, 'ofVat')) || 0;
        const ht = round2(sum(lines, l => (parseNum(l.qty) || 0) * (parseNum(l.unitPrice) || 0)));
        $('#ofLines', m).innerHTML = lines.length ? `<div class="tbl-wrap flat"><table class="tbl" style="min-width:600px"><thead><tr><th scope="col">Produit</th><th scope="col" class="num-c">Stock</th><th scope="col" class="num-c">Quantité</th><th scope="col" class="num-c">Prix unitaire HT</th><th scope="col" class="num-c">Montant HT</th><th scope="col"><span class="sr-only">Retirer</span></th></tr></thead><tbody>
          ${lines.map((l, i) => { const p = productById(l.productId); return `<tr><td><b>${esc(p?.name || '?')}</b><small class="mono muted d-block">${esc(p?.sku || '')} · ${esc(p?.unit || '')}</small></td><td class="num-c mono">${fmtNum(productQty(p))}</td>
            <td class="num-c"><label class="sr-only" for="olq${i}">Quantité ${esc(p?.name || '')}</label><input class="inp count-inp" id="olq${i}" data-lq="${i}" inputmode="decimal" value="${String(l.qty).replace('.', ',')}"></td>
            <td class="num-c"><label class="sr-only" for="olp${i}">Prix ${esc(p?.name || '')}</label><input class="inp count-inp" id="olp${i}" data-lp="${i}" inputmode="decimal" value="${String(l.unitPrice).replace('.', ',')}"></td>
            <td class="num-c mono" data-lt="${i}">${fmtMoney((parseNum(l.qty) || 0) * (parseNum(l.unitPrice) || 0))}</td>
            <td><button type="button" class="btn icon sm danger" data-lrm="${i}" aria-label="Retirer ${esc(p?.name || '')}">${svg('x')}</button></td></tr>`; }).join('')}</tbody></table></div>
          <div class="totals" aria-live="polite"><div><span>Total HT</span><b class="mono">${fmtMoney(ht)}</b></div><div><span>TVA ${fmtPct(vat, vat % 1 ? 1 : 0)}</span><b class="mono">${fmtMoney(ht * vat / 100)}</b></div><div class="ttc"><span>Total TTC</span><b class="mono">${fmtMoney(ht * (1 + vat / 100))}</b></div></div>`
          : '<p class="muted" style="padding:10px 0">Aucune ligne. Recherchez un produit ci-dessus pour l\'ajouter.</p>';
        $$('[data-lq],[data-lp]', m).forEach(inp => inp.oninput = () => {
          const i = +(inp.dataset.lq ?? inp.dataset.lp);
          if (inp.dataset.lq !== undefined) lines[i].qty = inp.value; else lines[i].unitPrice = inp.value;
          const tot = (parseNum(lines[i].qty) || 0) * (parseNum(lines[i].unitPrice) || 0);
          $(`[data-lt="${i}"]`, m).textContent = fmtMoney(tot);
          const vat2 = parseNum(val(m, 'ofVat')) || 0, ht2 = sum(lines, l => (parseNum(l.qty) || 0) * (parseNum(l.unitPrice) || 0));
          const t = $$('.totals b', m); t[0].textContent = fmtMoney(ht2); t[1].textContent = fmtMoney(ht2 * vat2 / 100); t[2].textContent = fmtMoney(ht2 * (1 + vat2 / 100));
        });
        $$('[data-lrm]', m).forEach(b => b.onclick = () => { lines.splice(+b.dataset.lrm, 1); drawLines(); });
      };
      /* Liste de produits : ceux du fournisseur en priorité */
      const refreshPicker = () => {
        const sid = val(m, 'ofSup'); const only = $('#ofOnlySup', m).checked;
        const sel = $('#ofAdd', m);
        let opts = optProducts();
        if (sid && only) { const mine = opts.filter(([v]) => productById(v).supplierId === sid); if (mine.length) opts = mine; }
        sel.innerHTML = `<option value="">— Choisir un produit —</option>` + opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
      };
      const add = () => {
        const pid = val(m, 'ofAdd'); if (!pid) return toast('Choisissez un produit à ajouter.', 'warn');
        const ex = lines.find(l => l.productId === pid);
        const p = productById(pid);
        if (ex) ex.qty = (parseNum(ex.qty) || 0) + Math.max(1, anaOf(pid).recommended || 1);
        else lines.push({ productId: pid, qty: Math.max(1, anaOf(pid).recommended || p.minStock || 1), unitPrice: p.purchasePrice });
        $('#ofAddQ', m).value = ''; drawLines(); $('#ofAddQ', m).focus();
      };
      refreshPicker(); bindProductPicker(m, 'ofAdd');
      $('#ofAddBtn', m).onclick = add;
      $('#ofAdd', m).ondblclick = add;
      $('#ofOnlySup', m).onchange = () => { refreshPicker(); bindProductPicker(m, 'ofAdd'); };
      $('#ofSup', m).onchange = () => { const sd = supDefaults(val(m, 'ofSup')); if (!o) { $('#ofDate', m).value = sd.date; if (sd.terms) { const t = $('#ofTerms', m); if (![...t.options].some(x => x.value === sd.terms)) t.add(new Option(sd.terms, sd.terms)); t.value = sd.terms; } } refreshPicker(); bindProductPicker(m, 'ofAdd'); };
      $('#ofVat', m).onchange = drawLines;
      drawLines();
      $('#ofSave', m).onclick = e => guard(e.currentTarget, async () => {
        const data = { supplierId: val(m, 'ofSup'), expectedDate: val(m, 'ofDate'), vatRate: parseNum(val(m, 'ofVat')), paymentTerms: val(m, 'ofTerms'), comments: val(m, 'ofCom'), fromAlerts: d.fromAlerts,
          lines: lines.map(l => ({ id: l.id, productId: l.productId, qty: parseNum(l.qty), unitPrice: parseNum(l.unitPrice) })) };
        try { const r = await saveOrder(data, id); closeModal(1); toast(o ? 'Commande mise à jour' : `Commande ${r.number} créée (brouillon)`, 'ok'); openOrderDrawer(r.id); }
        catch (err) { formError(m, err.message); }
      });
    }
  });
}

/* ═════════════════════ FICHE COMMANDE ═════════════════════ */
let _ordTab = 'lines';
function openOrderDrawer(id) {
  const render = () => {
    const o = orderById(id); if (!o) { closeDrawer(); return; }
    const t = orderTotals(o), st = ORDER_STATUS[o.status];
    const q = sum(o.lines, l => l.qty), r = sum(o.lines, l => l.received || 0);
    const edit = can('order.edit');
    const acts = [];
    if (o.status === 'draft' && edit) acts.push(`<button type="button" class="btn sm" data-oa="edit">${svg('edit')} Modifier</button><button type="button" class="btn sm gold" data-oa="validated">${svg('check')} Valider</button>`);
    if (o.status === 'validated' && edit) acts.push(`<button type="button" class="btn sm gold" data-oa="sent">${svg('send')} Marquer envoyée</button>`);
    if (['validated', 'sent', 'partial'].includes(o.status) && can('order.receive')) acts.push(`<button type="button" class="btn sm gold" data-oa="receive">${svg('truck')} Réceptionner</button>`);
    openDrawer(`<div class="drawer-h"><div class="row" style="justify-content:space-between"><button type="button" class="x-btn" data-drclose aria-label="Fermer">${svg('x')}</button>
        <div class="row wrap" style="gap:6px">${acts.join('')}<button type="button" class="btn sm" data-oa="print">${svg('printer')} Bon de commande</button></div></div>
      <div style="margin-top:14px"><div class="eyebrow">Commande fournisseur</div><h3 style="font-size:1.5rem" class="mono">${esc(o.number)}</h3>
        <div class="row wrap" style="gap:6px;margin-top:6px"><span class="chip ${st.cls}">${st.label}</span>${isOrderLate(o) ? `<span class="chip dng">${svg('clock')}En retard de ${daysBetween(o.expectedDate, todayISO())} j</span>` : ''}${o.fromAlerts ? '<span class="chip info">Issue des alertes</span>' : ''}${o.demo ? '<span class="chip gold">Démo</span>' : ''}</div>
        <p class="soft" style="margin-top:8px"><button type="button" class="link-btn" id="odSup">${esc(supName(o.supplierId))}</button> · créée le ${fmtDate(o.createdAt)}${o.expectedDate ? ' · livraison prévue le ' + fmtDate(o.expectedDate) : ''}</p></div>
      <div class="mini-kpis"><div><span class="k">Total HT</span><b class="mono">${fmtMoneyShort(t.ht)}</b><small>${fmtMoney(t.ht)}</small></div><div><span class="k">TVA ${fmtPct(t.rate, t.rate % 1 ? 1 : 0)}</span><b class="mono">${fmtMoneyShort(t.tva)}</b></div><div><span class="k">Total TTC</span><b class="mono">${fmtMoneyShort(t.ttc)}</b></div><div><span class="k">Reçu</span><b class="mono">${fmtNum(r)}/${fmtNum(q)}</b><small>${q ? fmtPct(r / q * 100) : ''}</small></div></div></div>
      <div class="drawer-b"><div class="tabs" role="tablist">${[['lines', `Lignes (${o.lines.length})`], ['rec', `Réceptions (${o.receptions.length})`], ['hist', 'Historique']].map(([k, l]) => `<button type="button" role="tab" class="tab ${_ordTab === k ? 'active' : ''}" aria-selected="${_ordTab === k}" data-t="${k}">${l}</button>`).join('')}</div><div id="odTab" role="tabpanel"></div>
      <div class="drawer-actions">
        ${o.status === 'validated' && edit ? `<button type="button" class="btn sm ghost" data-oa="draft">${svg('undo')} Repasser en brouillon</button>` : ''}
        ${o.status === 'partial' && edit ? `<button type="button" class="btn sm ghost" data-oa="close">${svg('check')} Clôturer le reliquat</button>` : ''}
        ${edit ? `<button type="button" class="btn sm ghost" data-oa="dup">${svg('copy')} Dupliquer</button>` : ''}
        ${['draft', 'validated', 'sent'].includes(o.status) && edit && !r ? `<button type="button" class="btn sm danger" data-oa="cancel">${svg('x')} Annuler la commande</button>` : ''}
        ${o.status === 'draft' && edit ? `<button type="button" class="btn sm danger" data-oa="del">${svg('trash')} Supprimer</button>` : ''}
      </div></div>`, d => {
      const tabs = {
        lines: () => `<div class="tbl-wrap flat"><table class="tbl" style="min-width:0"><thead><tr><th scope="col">Produit</th><th scope="col" class="num-c">Commandé</th><th scope="col" class="num-c">Reçu</th><th scope="col" class="num-c">Reste</th><th scope="col" class="num-c">Montant HT</th></tr></thead><tbody>
          ${o.lines.map(l => { const p = productById(l.productId); const rem = o.closedRemainder ? 0 : lineRemaining(l); return `<tr><td><button type="button" class="link-btn" data-pr="${l.productId}">${esc(p?.name || '?')}</button><small class="mono muted d-block">${esc(p?.sku || '')} · ${fmtMoney(l.unitPrice)} / ${esc(p?.unit || 'u')}</small></td>
            <td class="num-c mono">${fmtNum(l.qty)}</td><td class="num-c mono">${fmtNum(l.received || 0)}</td><td class="num-c mono ${rem ? 'gold' : ''}">${fmtNum(rem)}</td><td class="num-c mono">${fmtMoney(l.qty * l.unitPrice)}</td></tr>`; }).join('')}</tbody></table></div>
          ${o.paymentTerms ? `<div class="info-line"><span class="k">Conditions de paiement</span><span class="v">${esc(o.paymentTerms)}</span></div>` : ''}
          ${o.comments ? `<div class="info-line"><span class="k">Commentaires</span><span class="v" style="text-align:left;max-width:65%">${esc(o.comments)}</span></div>` : ''}
          ${o.closedRemainder ? `<p class="notice-sm">${svg('info', 'inl')} Reliquat clôturé : les quantités non livrées ne sont plus attendues.</p>` : ''}`,
        rec: () => o.receptions.length ? o.receptions.slice().reverse().map(rc => `<div class="card pad rec-card"><div class="row between"><b>${fmtDateTime(rc.date)}</b><small class="muted">${esc(rc.by || '')}</small></div>
            ${rc.docRef ? `<small class="mono muted">BL / facture : ${esc(rc.docRef)}</small>` : ''}
            ${rc.items.map(it => { const l = o.lines.find(x => x.id === it.lineId); const p = productById(l?.productId); const mv = movementById(it.movementId); return `<button type="button" class="list-row" data-mvd="${it.movementId}"><span>${esc(p?.name || '?')} <small class="muted">→ ${esc(locName(it.locId))}</small>${mv?.cancelledById ? ' <span class="chip dng xs">annulée</span>' : ''}</span><b class="mono">+${fmtNum(it.qty)}</b></button>`; }).join('')}
            ${rc.comment ? `<small class="soft">${esc(rc.comment)}</small>` : ''}</div>`).join('') : '<p class="muted">Aucune réception enregistrée.</p>',
        hist: () => o.history.map(h => `<div class="feed-item"><span class="tm">${hhmm(h.at)}</span><span class="txt"><span class="chip ${ORDER_STATUS[h.status]?.cls || ''} xs">${ORDER_STATUS[h.status]?.label || h.status}</span> ${esc(h.by || '')}${h.note ? ' — ' + esc(h.note) : ''}<small class="muted feed-meta">${fmtDateTime(h.at)}</small></span></div>`).join('')
      };
      const show = tt => { _ordTab = tt; $('#odTab', d).innerHTML = tabs[tt](); $$('.tab', d).forEach(x => { x.classList.toggle('active', x.dataset.t === tt); x.setAttribute('aria-selected', x.dataset.t === tt); });
        $$('[data-pr]', d).forEach(b => b.onclick = () => openProductDrawer(b.dataset.pr)); $$('[data-mvd]', d).forEach(b => b.onclick = () => movementDetail(b.dataset.mvd)); };
      show(tabs[_ordTab] ? _ordTab : 'lines');
      $$('.tab', d).forEach(x => x.onclick = () => show(x.dataset.t));
      $('[data-drclose]', d).onclick = closeDrawer;
      $('#odSup', d).onclick = () => openSupplierDrawer(o.supplierId);
      $$('[data-oa]', d).forEach(b => b.onclick = () => orderAction(o, b.dataset.oa, b));
    }, 'Commande ' + o.number);
  };
  DRAWER_REFRESH = render;
  render();
}
function orderAction(o, a, btn) {
  const L = { validated: 'Valider la commande', sent: 'Marquer la commande comme envoyée au fournisseur', draft: 'Repasser la commande en brouillon (modifiable)' };
  if (a === 'edit') return orderForm(o.id);
  if (a === 'print') return printPurchaseOrder(o);
  if (a === 'receive') return receptionForm(o.id);
  if (a === 'dup') return orderForm(null, { supplierId: o.supplierId, lines: o.lines.map(l => ({ productId: l.productId, qty: l.qty, unitPrice: productById(l.productId)?.purchasePrice ?? l.unitPrice })) });
  if (L[a]) return confirmDialog(L[a] + ' ' + o.number + ' ?', async () => { await setOrderStatus(o.id, a); toast(`Commande ${o.number} : ${ORDER_STATUS[a].label.toLowerCase()}`, 'ok'); }, { danger: false, yes: 'Confirmer' });
  if (a === 'cancel') return confirmDialog(`Annuler la commande ${o.number} ? Elle restera visible avec le statut « Annulée ».`, async () => { await setOrderStatus(o.id, 'cancelled'); toast('Commande annulée', 'warn'); }, { yes: 'Annuler la commande' });
  if (a === 'del') return confirmDialog(`Supprimer le brouillon ${o.number} ?`, async () => { await deleteOrder(o.id); closeDrawer(); toast('Brouillon supprimé', 'dng'); });
  if (a === 'close') return confirmDialog(`Clôturer le reliquat de ${o.number} ? Les quantités restantes ne seront plus attendues (et ne compteront plus comme « en commande »).`, async () => { await closeOrderRemainder(o.id, ''); toast('Reliquat clôturé', 'ok'); }, { danger: false, yes: 'Clôturer' });
}

/* ═════════════════════ RÉCEPTION ═════════════════════ */
function receptionForm(id) {
  const o = orderById(id);
  const open = o.lines.filter(l => lineRemaining(l) > 0);
  if (!open.length) return toast('Tout a déjà été reçu.', 'info');
  const now = localDateTimeValue();
  openModal({
    title: `Réception · ${o.number}`, xwide: true,
    body: `<p class="soft" style="margin-bottom:12px">Saisissez les quantités <b>réellement reçues</b>. Le stock n'augmente que de ces quantités ; le reste demeure en attente sur la commande.</p>
      <div class="row wrap" style="margin-bottom:10px;gap:8px"><button type="button" class="btn sm" id="rcAll">Tout reçu</button><button type="button" class="btn sm ghost" id="rcNone">Tout à zéro</button></div>
      <div class="tbl-wrap flat"><table class="tbl" style="min-width:640px"><caption class="sr-only">Quantités reçues par ligne</caption><thead><tr><th scope="col">Produit</th><th scope="col" class="num-c">Commandé</th><th scope="col" class="num-c">Déjà reçu</th><th scope="col" class="num-c">Reste</th><th scope="col" class="num-c">Reçu maintenant</th><th scope="col">Rangé à</th></tr></thead><tbody>
      ${open.map(l => { const p = productById(l.productId); const rem = lineRemaining(l); return `<tr><td><b>${esc(p?.name || '?')}</b><small class="mono muted d-block">${esc(p?.sku || '')}</small></td><td class="num-c mono">${fmtNum(l.qty)}</td><td class="num-c mono">${fmtNum(l.received || 0)}</td><td class="num-c mono gold">${fmtNum(rem)}</td>
        <td class="num-c"><label class="sr-only" for="rq_${l.id}">Quantité reçue pour ${esc(p?.name || '')} (maximum ${fmtNum(rem)})</label><input class="inp count-inp" id="rq_${l.id}" data-rl="${l.id}" data-max="${rem}" inputmode="decimal" value="${String(rem).replace('.', ',')}"></td>
        <td><label class="sr-only" for="rl_${l.id}">Emplacement pour ${esc(p?.name || '')}</label><select class="sel" id="rl_${l.id}" style="min-width:150px">${optLocations().map(([v, n]) => `<option value="${v}" ${v === (p?.locationId || S.locations[0]?.id) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="grid-3" style="margin-top:14px">${fieldHTML({ id: 'rcDate', label: 'Date de réception', type: 'datetime-local', value: now, req: true, attrs: `max="${now}"` })}${fieldHTML({ id: 'rcDoc', label: 'N° de bon de livraison / facture', value: '' })}${fieldHTML({ id: 'rcCom', label: 'Commentaire', value: '' })}</div>`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="rcSave">${svg('truck')} Valider la réception</button>`,
    onOpen: m => {
      $('#rcAll', m).onclick = () => $$('[data-rl]', m).forEach(i => i.value = String(i.dataset.max).replace('.', ','));
      $('#rcNone', m).onclick = () => $$('[data-rl]', m).forEach(i => i.value = '0');
      $('#rcSave', m).onclick = e => guard(e.currentTarget, async () => {
        formError(m, '');
        const bad = [], errs = [];
        const items = $$('[data-rl]', m).map(i => {
          const q = i.value.trim() === '' ? 0 : parseNum(i.value);
          if (isNaN(q) || q < 0) { bad.push(i.id); errs.push('Quantité invalide.'); }
          else if (q > Number(i.dataset.max) + 1e-9) { bad.push(i.id); errs.push(`Quantité supérieure au reliquat (${fmtNum(Number(i.dataset.max))}).`); }
          return { lineId: i.dataset.rl, qty: q, locId: $('#rl_' + i.dataset.rl, m).value };
        });
        if (errs.length) { formError(m, [...new Set(errs)].join('\n')); markInvalid(m, bad); return; }
        const dt = val(m, 'rcDate');
        try {
          const r = await receiveOrder(id, items, { date: dt ? new Date(dt).toISOString() : nowStamp(), docRef: val(m, 'rcDoc'), comment: val(m, 'rcCom') });
          closeModal(1);
          toast(r.status === 'partial' ? `Réception partielle enregistrée : ${fmtNum(sum(r.lines, lineRemaining))} unité(s) toujours en attente.` : 'Commande entièrement réceptionnée.', 'ok', 5000);
        } catch (err) { formError(m, err.message); }
      });
    }
  });
}
