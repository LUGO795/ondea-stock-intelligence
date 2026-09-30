/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/alerts.js
   Alertes et ruptures : calculées automatiquement à partir des seuils,
   de la consommation réelle et des commandes. Elles disparaissent
   d'elles-mêmes lorsque la situation est corrigée.
   Génération de commandes fournisseurs à partir des recommandations.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const ALF = { prio: '', type: '', q: '' };

function alertRow(a) {
  const t = ALERT_TYPES[a.type], pr = PRIO[a.prio];
  const p = a.productId ? productById(a.productId) : null;
  const o = a.orderId ? orderById(a.orderId) : null;
  const title = p ? p.name : o ? `${o.number} · ${supName(o.supplierId)}` : '—';
  const qtyTxt = p ? (a.type === 'dormant' ? `${fmtNum(a.qty)} ${esc(p.unit)} · seuil ${a.threshold} j` : a.type === 'spike' ? `${fmtNum(anaOf(p.id)?.last30 || 0)} sortis / 30 j` : `${fmtNum(a.qty)} ${esc(p.unit)}${a.threshold != null ? ` · seuil ${fmtNum(a.threshold)}` : ''}`) : `${fmtNum(a.qty)} unité(s) en attente`;
  const btn = a.cmd === 'order' && can('order.edit') && p ? `<button type="button" class="btn sm gold" data-aorder="${p.id}">${svg('cart')} Commander</button>`
    : a.cmd === 'orderView' || a.cmd === 'orders' ? `<button type="button" class="btn sm" data-aord="${a.orderId || ''}" data-aprod="${a.productId || ''}">${svg('truck')} Voir la commande</button>` : '';
  return `<div class="alert-row prio-${a.prio}" role="group" aria-label="Alerte ${pr.label} : ${esc(t.label)}, ${esc(title)}">
    <span class="al-ic ${pr.cls}" aria-hidden="true">${svg(t.icon)}</span>
    <div class="grow al-b">
      <div class="row wrap" style="gap:6px"><span class="chip ${pr.cls} xs">${pr.label}</span><b>${esc(t.label)}</b><span class="muted" aria-hidden="true">·</span>
        <button type="button" class="link-btn" ${p ? `data-aprodv="${p.id}"` : `data-aord="${a.orderId}"`}>${esc(title)}</button></div>
      <div class="al-meta"><span class="mono">${qtyTxt}</span> · <span>détectée le ${fmtDateTime(a.detectedAt)}</span></div>
      <div class="al-act">${svg('zap', 'inl')} ${esc(a.action)}</div>
    </div><div class="al-btns">${btn}</div></div>`;
}
function bindAlertRows(root) {
  $$('[data-aorder]', root).forEach(b => b.onclick = () => {
    const p = productById(b.dataset.aorder); const a = anaOf(p.id);
    orderForm(null, { supplierId: p.supplierId, lines: [{ productId: p.id, qty: a.recommended || Math.max(1, p.minStock), unitPrice: p.purchasePrice }], fromAlerts: true });
  });
  $$('[data-aprodv]', root).forEach(b => b.onclick = () => openProductDrawer(b.dataset.aprodv, 'reappro'));
  $$('[data-aord]', root).forEach(b => b.onclick = () => {
    if (b.dataset.aord) return openOrderDrawer(b.dataset.aord);
    const o = S.orders.filter(isOrderOpen).find(x => x.lines.some(l => l.productId === b.dataset.aprod && lineRemaining(l) > 0));
    if (o) openOrderDrawer(o.id); else go('commandes');
  });
}

VIEWS.alerts = (el, params) => {
  if (params.type) ALF.type = params.type;
  const all = activeAlerts();
  const counts = { 4: 0, 3: 0, 2: 0, 1: 0 }; all.forEach(a => counts[a.prio]++);
  const recos = S.products.filter(p => p.status === 'active' && anaOf(p.id).recommended > 0);
  el.innerHTML = pageHead('Alertes et ruptures', crumbFor('alertes'),
    (can('export') ? `<button type="button" class="btn" id="aCsv">${svg('down')} Export des ruptures</button>` : '') +
    (can('order.edit') && recos.length ? `<button type="button" class="btn gold" id="aGen">${svg('cart')} Générer les commandes (${recos.length})</button>` : ''),
    'Calculées en continu à partir de vos seuils, de la consommation réelle et des commandes en cours.') +
    `<div class="kpi-grid">
      ${[4, 3, 2, 1].map(p => `<button type="button" class="kpi kpi-btn ${ALF.prio == p ? 'sel' : ''}" data-prio="${p}" aria-pressed="${ALF.prio == p}"><div class="ic ${PRIO[p].cls}">${svg(p === 4 ? 'x' : p === 3 ? 'warn' : p === 2 ? 'clock' : 'info')}</div><div class="num">${counts[p]}</div><div class="lbl">Priorité ${PRIO[p].label.toLowerCase()}</div></button>`).join('')}
    </div>
    <div class="tbl-tools"><div class="search" style="max-width:260px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="aQ" type="search" aria-label="Rechercher un produit" placeholder="Produit…" value="${esc(ALF.q)}"></div>
      <label class="sr-only" for="aType">Type d'alerte</label><select class="sel" id="aType" style="width:auto"><option value="">Tous les types</option>${Object.entries(ALERT_TYPES).map(([k, t]) => `<option value="${k}" ${ALF.type === k ? 'selected' : ''}>${t.label} (${all.filter(a => a.type === k).length})</option>`).join('')}</select>
      <label class="sr-only" for="aPrio">Priorité</label><select class="sel" id="aPrio" style="width:auto"><option value="">Toutes priorités</option>${[4, 3, 2, 1].map(p => `<option value="${p}" ${ALF.prio == p ? 'selected' : ''}>${PRIO[p].label}</option>`).join('')}</select>
      <button type="button" class="btn ghost sm" id="aReset">Réinitialiser</button></div>
    <section class="panel" aria-labelledby="alListT"><div class="panel-h"><h3 id="alListT">Alertes actives</h3><span class="chip" id="aCount"></span></div><div class="panel-b" id="aList"></div></section>
    <details class="panel how-panel" style="margin-top:20px"><summary class="panel-h"><h3>Comment les alertes sont-elles calculées ?</h3></summary><div class="panel-b soft how-b">
      <ul>
        <li><b>Rupture totale</b> : quantité en stock ≤ 0.</li>
        <li><b>Sous le seuil minimal</b> : quantité ≤ seuil minimal du produit.</li>
        <li><b>Proche du seuil</b> : quantité ≤ seuil + ${SETTINGS.nearPct} % (réglable dans Paramètres).</li>
        <li><b>À réapprovisionner prochainement</b> : stock projeté (disponible + en commande) ≤ point de commande (consommation moyenne × délai fournisseur + seuil).</li>
        <li><b>Au-dessus du maximum</b> : quantité &gt; stock maximal souhaité.</li>
        <li><b>Sans mouvement</b> : aucun mouvement depuis ${SETTINGS.dormantDays} jours alors qu'il reste du stock.</li>
        <li><b>Consommation en forte hausse</b> : sorties des 30 derniers jours ≥ ${String(SETTINGS.spikeRatio).replace('.', ',')} × celles des 30 jours précédents (minimum ${SETTINGS.spikeMinQty} unités sur la période de référence, pour éviter les fausses alertes).</li>
        <li><b>Commande en retard</b> : date de livraison prévue dépassée et commande non entièrement reçue.</li>
      </ul>
      <p>La « date de détection » est la première fois que l'alerte a été constatée par l'application. Une alerte disparaît automatiquement dès que la situation est corrigée (entrée de stock, réception, modification du seuil…).</p></div></details>`;

  const draw = () => {
    const t = norm(ALF.q);
    const list = all.filter(a => (!ALF.prio || a.prio == ALF.prio) && (!ALF.type || a.type === ALF.type) &&
      (!t || norm(productById(a.productId)?.name || orderById(a.orderId)?.number || '').includes(t) || norm(productById(a.productId)?.sku || '').includes(t)));
    $('#aCount', el).textContent = list.length;
    $('#aList', el).innerHTML = list.length ? list.slice(0, 300).map(alertRow).join('') + (list.length > 300 ? `<p class="muted" style="margin-top:12px">300 premières alertes affichées sur ${list.length} — affinez les filtres.</p>` : '')
      : `<div class="empty" style="padding:36px">${svg('check')}<h4>${all.length ? 'Aucune alerte pour ces filtres' : 'Aucune alerte'}</h4><p>${all.length ? 'Modifiez les filtres pour voir les autres alertes.' : 'Tous vos stocks sont sous contrôle.'}</p></div>`;
    bindAlertRows($('#aList', el));
  };
  draw();
  $('#aQ', el).oninput = debounce(e => { ALF.q = e.target.value; draw(); }, 150);
  $('#aType', el).onchange = e => { ALF.type = e.target.value; draw(); };
  $('#aPrio', el).onchange = e => { ALF.prio = e.target.value; route({ keepScroll: true }); };
  $$('[data-prio]', el).forEach(b => b.onclick = () => { ALF.prio = ALF.prio == b.dataset.prio ? '' : b.dataset.prio; route({ keepScroll: true }); });
  $('#aReset', el).onclick = () => { Object.assign(ALF, { prio: '', type: '', q: '' }); go('alertes'); };
  if ($('#aGen', el)) $('#aGen', el).onclick = () => generateOrdersFromAlerts();
  if ($('#aCsv', el)) $('#aCsv', el).onclick = () => exportRupturesCSV();
};

/* Propose une commande par fournisseur à partir des quantités recommandées */
function generateOrdersFromAlerts() {
  const prods = S.products.filter(p => p.status === 'active' && anaOf(p.id).recommended > 0);
  const groups = new Map();
  prods.forEach(p => { const k = p.supplierId || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
  const keys = [...groups.keys()].sort((a, b) => (a ? supName(a) : 'zzz').localeCompare(b ? supName(b) : 'zzz', 'fr'));
  openModal({
    title: 'Générer les commandes de réapprovisionnement', xwide: true,
    body: `<p class="soft" style="margin-bottom:14px">Une commande <b>brouillon</b> sera créée par fournisseur. Vérifiez et ajustez les quantités : rien n'est envoyé ni reçu automatiquement.</p>
      ${keys.map(k => `<fieldset class="fs gen-g"><legend>${k ? esc(supName(k)) : 'Sans fournisseur principal'}</legend>
        ${!k ? `${selectHTML({ id: 'gs_none', label: 'Fournisseur à utiliser pour ces produits', options: optSuppliers(), empty: '— Ne pas commander —' })}` : ''}
        <div class="tbl-wrap flat"><table class="tbl" style="min-width:560px"><thead><tr><th scope="col"><span class="sr-only">Inclure</span></th><th scope="col">Produit</th><th scope="col" class="num-c">Stock</th><th scope="col" class="num-c">En commande</th><th scope="col" class="num-c">Quantité</th><th scope="col" class="num-c">Prix u.</th></tr></thead><tbody>
        ${groups.get(k).map(p => { const a = anaOf(p.id); return `<tr><td><input type="checkbox" checked data-gp="${p.id}" data-gs="${k}" aria-label="Commander ${esc(p.name)}"></td><td><b>${esc(p.name)}</b><small class="mono muted d-block">${esc(p.sku)}</small></td><td class="num-c mono">${fmtNum(a.qty)}</td><td class="num-c mono">${fmtNum(a.onOrder)}</td>
          <td class="num-c"><label class="sr-only" for="gq_${p.id}">Quantité pour ${esc(p.name)}</label><input class="inp count-inp" id="gq_${p.id}" inputmode="decimal" value="${a.recommended}"></td><td class="num-c mono">${fmtMoney(p.purchasePrice)}</td></tr>`; }).join('')}
        </tbody></table></div></fieldset>`).join('')}`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="genGo">${svg('cart')} Créer les brouillons</button>`,
    onOpen: m => $('#genGo', m).onclick = e => guard(e.currentTarget, async () => {
      const bySup = new Map();
      $$('[data-gp]', m).forEach(c => {
        if (!c.checked) return;
        let sup = c.dataset.gs || val(m, 'gs_none'); if (!sup) return;
        const q = parseNum($('#gq_' + c.dataset.gp, m).value); if (!(q > 0)) return;
        if (!bySup.has(sup)) bySup.set(sup, []);
        bySup.get(sup).push({ productId: c.dataset.gp, qty: q, unitPrice: productById(c.dataset.gp).purchasePrice });
      });
      if (!bySup.size) return formError(m, 'Aucune ligne à commander (cochez des produits et, si besoin, choisissez un fournisseur).');
      const created = [];
      for (const [sup, lines] of bySup) {
        const s = supplierById(sup);
        created.push(await saveOrder({ supplierId: sup, lines, vatRate: SETTINGS.defaultVat, paymentTerms: s?.paymentTerms || '', expectedDate: addDays(todayISO(), s?.leadTime ?? SETTINGS.defaultLeadTime), comments: 'Générée à partir des alertes de réapprovisionnement.', fromAlerts: true }));
      }
      closeModal(1); toast(`${created.length} commande(s) brouillon créée(s) : ${created.map(o => o.number).join(', ')}`, 'ok', 6000); go('commandes', { status: 'draft' });
    })
  });
}
