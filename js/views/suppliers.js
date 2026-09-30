/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/suppliers.js
   Répertoire des fournisseurs : fiche, produits référencés, commandes
   en cours et historique des livraisons.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const SUPF = { q: '', status: 'active', page: 1 };

VIEWS.suppliers = (el) => {
  el.innerHTML = pageHead('Fournisseurs', crumbFor('fournisseurs'),
    (can('export') ? `<button type="button" class="btn" id="fCsv">${svg('down')} Export CSV</button>` : '') +
    (can('supplier.edit') ? `<button type="button" class="btn gold" id="fNew">${svg('plus')} Nouveau fournisseur</button>` : ''),
    `${S.suppliers.filter(s => s.status !== 'archived').length} fournisseur(s) actif(s)`) +
    `<div class="tbl-tools"><div class="search" style="max-width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="fQ" type="search" aria-label="Rechercher un fournisseur" placeholder="Nom, contact, ville…" value="${esc(SUPF.q)}"></div>
      <label class="sr-only" for="fSt">Statut</label><select class="sel" id="fSt" style="width:auto"><option value="active" ${SUPF.status === 'active' ? 'selected' : ''}>Actifs</option><option value="archived" ${SUPF.status === 'archived' ? 'selected' : ''}>Archivés</option><option value="" ${!SUPF.status ? 'selected' : ''}>Tous</option></select></div>
    <div id="fList"></div>`;
  const draw = () => {
    const t = norm(SUPF.q);
    const rows = S.suppliers.filter(s => (!SUPF.status || (SUPF.status === 'active' ? s.status !== 'archived' : s.status === 'archived')) &&
      (!t || norm(s.name).includes(t) || norm(s.contact).includes(t) || norm(s.address).includes(t) || norm(s.email).includes(t))).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const pg = paginate(rows, SUPF);
    const host = $('#fList', el);
    host.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Liste des fournisseurs</caption><thead><tr><th scope="col">Fournisseur</th><th scope="col">Contact</th><th scope="col">Téléphone</th><th scope="col" class="num-c">Délai</th><th scope="col" class="num-c">Produits</th><th scope="col" class="num-c">Commandes en cours</th><th scope="col" class="num-c">Achats 12 mois</th></tr></thead><tbody>
      ${pg.rows.map(s => {
      const prods = S.products.filter(p => p.supplierId === s.id && p.status === 'active').length;
      const open = S.orders.filter(o => o.supplierId === s.id && isOrderOpen(o));
      const late = open.filter(isOrderLate).length;
      const y = addDays(todayISO(), -365);
      const spend = sum(S.movements.filter(m => m.supplierId === s.id && isSupply(m) && mvDay(m) >= y), m => m.value);
      return `<tr data-sup="${s.id}" tabindex="0" class="${s.status === 'archived' ? 'is-archived' : ''}"><td><div class="cell-user"><div class="av sm" aria-hidden="true">${esc(initialsOf(s.name))}</div><div><b>${esc(s.name)}</b>${s.demo ? ' <span class="chip gold xs">Démo</span>' : ''}${s.status === 'archived' ? ' <span class="chip xs">Archivé</span>' : ''}<small>${esc(s.email || s.address || '')}</small></div></div></td>
        <td>${esc(s.contact || '—')}</td><td class="mono">${esc(s.phone || '—')}</td><td class="num-c mono">${s.leadTime != null ? s.leadTime + ' j' : '—'}</td><td class="num-c mono">${prods}</td>
        <td class="num-c">${open.length ? `<span class="chip ${late ? 'dng' : 'gold'}">${open.length}${late ? ` · ${late} en retard` : ''}</span>` : '<span class="muted">0</span>'}</td><td class="num-c mono">${fmtMoney(spend)}</td></tr>`;
    }).join('')}</tbody></table></div>` + pagerHTML(SUPF.page, pg.pages, pg.total, pg.start, pg.rows.length, 'fournisseur')
      : S.suppliers.length ? emptyState('search', 'Aucun résultat', 'Aucun fournisseur ne correspond.') : emptyState('users', 'Aucun fournisseur', 'Enregistrez vos fournisseurs pour rattacher les produits, calculer les délais de réapprovisionnement et éditer vos bons de commande.', can('supplier.edit') ? `<button type="button" class="btn gold" data-fnew>${svg('plus')} Ajouter un fournisseur</button>` : '');
    bindPager(host, SUPF, draw);
    $$('[data-sup]', host).forEach(r => { r.onclick = () => openSupplierDrawer(r.dataset.sup); r.onkeydown = e => { if (e.key === 'Enter') openSupplierDrawer(r.dataset.sup); }; });
    $$('[data-fnew]', host).forEach(b => b.onclick = () => supplierForm());
  };
  draw();
  $('#fQ', el).oninput = debounce(e => { SUPF.q = e.target.value; SUPF.page = 1; draw(); }, 150);
  $('#fSt', el).onchange = e => { SUPF.status = e.target.value; SUPF.page = 1; draw(); };
  if ($('#fNew', el)) $('#fNew', el).onclick = () => supplierForm();
  if ($('#fCsv', el)) $('#fCsv', el).onclick = () => exportSuppliersCSV();
};

function supplierForm(id) {
  const s = id ? supplierById(id) : {};
  openModal({
    title: id ? 'Modifier le fournisseur' : 'Nouveau fournisseur', wide: true,
    body: `<p class="muted" style="font-size:.82rem;margin-bottom:12px">Seul le nom est obligatoire. Les autres informations sont facultatives.</p>
      <div class="grid-2">${fieldHTML({ id: 'sfName', label: 'Nom de l\'entreprise', value: s.name || '', req: true, attrs: 'autocomplete="organization"' })}${fieldHTML({ id: 'sfContact', label: 'Contact principal', value: s.contact || '' })}</div>
      <div class="grid-2">${fieldHTML({ id: 'sfPhone', label: 'Téléphone', type: 'tel', value: s.phone || '' })}${fieldHTML({ id: 'sfEmail', label: 'Adresse e-mail', type: 'email', value: s.email || '' })}</div>
      ${textareaHTML({ id: 'sfAddr', label: 'Adresse postale', value: s.address || '', rows: 2 })}
      <div class="grid-2">${fieldHTML({ id: 'sfWeb', label: 'Site Internet', type: 'url', value: s.website || '', placeholder: 'https://' })}${fieldHTML({ id: 'sfSiret', label: 'N° SIRET', value: s.siret || '', attrs: 'inputmode="numeric"', hint: '14 chiffres' })}</div>
      <div class="grid-2">${selectHTML({ id: 'sfTerms', label: 'Conditions de paiement', options: [...new Set([...SETTINGS.paymentTerms, s.paymentTerms].filter(Boolean))], value: s.paymentTerms || '', empty: '— Non précisé —' })}
        ${fieldHTML({ id: 'sfLead', label: 'Délai habituel de livraison (jours)', value: s.leadTime ?? '', attrs: 'inputmode="numeric"', hint: `Utilisé pour le calcul du réapprovisionnement (${SETTINGS.defaultLeadTime} j par défaut).` })}</div>
      ${textareaHTML({ id: 'sfCom', label: 'Commentaires', value: s.comments || '', rows: 2 })}`,
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="sfSave">Enregistrer</button>`,
    onOpen: m => $('#sfSave', m).onclick = e => guard(e.currentTarget, async () => {
      const d = { name: val(m, 'sfName'), contact: val(m, 'sfContact'), phone: val(m, 'sfPhone'), email: val(m, 'sfEmail'), address: val(m, 'sfAddr'), website: val(m, 'sfWeb'), siret: val(m, 'sfSiret'), paymentTerms: val(m, 'sfTerms'), leadTime: val(m, 'sfLead') === '' ? '' : parseNum(val(m, 'sfLead')), comments: val(m, 'sfCom') };
      try { const r = await saveSupplier(d, id); closeModal(1); toast('Fournisseur enregistré', 'ok'); if (!id) openSupplierDrawer(r.id); }
      catch (err) { formError(m, err.message); markInvalid(m, [!d.name && 'sfName', err.message.includes('e-mail') && 'sfEmail', err.message.includes('SIRET') && 'sfSiret', err.message.includes('délai') && 'sfLead'].filter(Boolean)); }
    })
  });
}

let _supTab = 'infos';
function openSupplierDrawer(id) {
  const render = () => {
    const s = supplierById(id); if (!s) { closeDrawer(); return; }
    const prods = S.products.filter(p => p.supplierId === id);
    const orders = S.orders.filter(o => o.supplierId === id).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const open = orders.filter(isOrderOpen);
    const deliveries = S.movements.filter(m => m.supplierId === id && isSupply(m)).slice().reverse();
    openDrawer(`<div class="drawer-h"><div class="row" style="justify-content:space-between"><button type="button" class="x-btn" data-drclose aria-label="Fermer la fiche">${svg('x')}</button>
        <div class="row" style="gap:6px">${can('order.edit') && s.status !== 'archived' ? `<button type="button" class="btn sm gold" id="sdOrder">${svg('cart')} Commander</button>` : ''}${can('supplier.edit') ? `<button type="button" class="btn sm ghost" id="sdEdit" aria-label="Modifier">${svg('edit')}</button>` : ''}</div></div>
      <div class="row" style="margin-top:14px"><div class="av lg" aria-hidden="true">${esc(initialsOf(s.name))}</div><div><h3 style="font-size:1.35rem">${esc(s.name)}</h3><div class="soft">${esc(s.contact || 'Contact non renseigné')}</div>
        <div class="row wrap" style="gap:6px;margin-top:6px">${s.status === 'archived' ? '<span class="chip">Archivé</span>' : '<span class="chip ok">Actif</span>'}${s.leadTime != null ? `<span class="chip gold">${svg('clock')}${s.leadTime} j</span>` : ''}</div></div></div></div>
      <div class="drawer-b"><div class="tabs" role="tablist">${[['infos', 'Informations'], ['prods', `Produits (${prods.length})`], ['orders', `Commandes (${orders.length})`], ['deliv', `Livraisons (${deliveries.length})`]].map(([k, l]) => `<button type="button" role="tab" class="tab ${_supTab === k ? 'active' : ''}" aria-selected="${_supTab === k}" data-t="${k}">${l}</button>`).join('')}</div>
      <div id="sdTab" role="tabpanel"></div>
      <div class="drawer-actions">${can('supplier.edit') ? `<button type="button" class="btn sm ghost" id="sdArch">${svg('archive')} ${s.status === 'archived' ? 'Réactiver' : 'Archiver'}</button><button type="button" class="btn sm danger" id="sdDel">${svg('trash')} Supprimer</button>` : ''}</div></div>`, d => {
      const L = (k, v) => `<div class="info-line"><span class="k">${k}</span><span class="v">${v || '—'}</span></div>`;
      const tabs = {
        infos: () => L('Contact', esc(s.contact)) + L('Téléphone', s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>` : '') + L('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '') +
          L('Adresse', esc(s.address).replace(/\n/g, '<br>')) + L('Site Internet', s.website ? `<a href="${esc(/^https?:/.test(s.website) ? s.website : 'https://' + s.website)}" target="_blank" rel="noopener noreferrer">${esc(s.website)}</a>` : '') +
          L('SIRET', s.siret ? `<span class="mono">${esc(s.siret)}</span>` : '') + L('Conditions de paiement', esc(s.paymentTerms)) + L('Délai habituel', s.leadTime != null ? s.leadTime + ' jours' : `non renseigné (${SETTINGS.defaultLeadTime} j utilisés)`) +
          L('Commandes en cours', `${open.length} · ${fmtMoney(sum(open, o => orderTotals(o).ht))} HT`) + (s.comments ? `<div style="margin-top:14px"><div class="eyebrow" style="margin-bottom:6px">Commentaires</div><p class="soft" style="white-space:pre-wrap">${esc(s.comments)}</p></div>` : ''),
        prods: () => prods.length ? prods.map(p => `<button type="button" class="list-row" data-pr="${p.id}"><div class="row">${productThumb(p, 'sm')}<div><b>${esc(p.name)}</b><small class="muted d-block mono">${esc(p.sku)} · ${fmtMoney(p.purchasePrice)}</small></div></div><div>${levelChip(p)}</div></button>`).join('') : '<p class="muted">Aucun produit n\'a ce fournisseur comme fournisseur principal.</p>',
        orders: () => orders.length ? orders.map(o => `<button type="button" class="list-row" data-ord="${o.id}"><div><b class="mono">${esc(o.number)}</b> <span class="chip ${ORDER_STATUS[o.status].cls} xs">${ORDER_STATUS[o.status].label}</span>${isOrderLate(o) ? ' <span class="chip dng xs">En retard</span>' : ''}<small class="muted d-block">Créée le ${fmtDate(o.createdAt)}${o.expectedDate ? ' · prévue le ' + fmtDate(o.expectedDate) : ''}</small></div><span class="mono">${fmtMoney(orderTotals(o).ttc)}</span></button>`).join('') : '<p class="muted">Aucune commande.</p>',
        deliv: () => deliveries.length ? `<div class="mv-list">${deliveries.slice(0, 60).map(movementMini).join('')}</div>` : '<p class="muted">Aucune livraison enregistrée.</p>'
      };
      const show = t => { _supTab = t; $('#sdTab', d).innerHTML = tabs[t](); $$('.tab', d).forEach(x => { x.classList.toggle('active', x.dataset.t === t); x.setAttribute('aria-selected', x.dataset.t === t); });
        $$('[data-pr]', d).forEach(b => b.onclick = () => openProductDrawer(b.dataset.pr)); $$('[data-ord]', d).forEach(b => b.onclick = () => openOrderDrawer(b.dataset.ord)); $$('[data-mvd]', d).forEach(b => b.onclick = () => movementDetail(b.dataset.mvd)); };
      show(tabs[_supTab] ? _supTab : 'infos');
      $$('.tab', d).forEach(t => t.onclick = () => show(t.dataset.t));
      $('[data-drclose]', d).onclick = closeDrawer;
      if ($('#sdEdit', d)) $('#sdEdit', d).onclick = () => supplierForm(id);
      if ($('#sdOrder', d)) $('#sdOrder', d).onclick = () => { closeDrawer(); orderForm(null, { supplierId: id }); };
      if ($('#sdArch', d)) $('#sdArch', d).onclick = () => { const arch = s.status !== 'archived'; confirmDialog(arch ? `Archiver « ${s.name} » ? Son historique reste consultable.` : `Réactiver « ${s.name} » ?`, async () => { await setSupplierStatus(id, arch ? 'archived' : 'active'); toast(arch ? 'Fournisseur archivé' : 'Fournisseur réactivé', 'ok'); }, { danger: false, yes: arch ? 'Archiver' : 'Réactiver' }); };
      if ($('#sdDel', d)) $('#sdDel', d).onclick = () => confirmDialog(`Supprimer définitivement « ${s.name} » ?`, async () => { await deleteSupplier(id); closeDrawer(); toast('Fournisseur supprimé', 'dng'); });
    }, 'Fiche fournisseur : ' + s.name);
  };
  DRAWER_REFRESH = render;
  render();
}
