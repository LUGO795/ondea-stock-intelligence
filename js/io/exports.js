/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — io/exports.js
   • Exports CSV compatibles Excel français : UTF-8 avec BOM, séparateur
     « ; », décimales avec virgule, dates JJ/MM/AAAA, fin de ligne CRLF.
   • Sauvegarde JSON COMPLÈTE (toutes les données + photos en base64)
     et restauration (fusion ou remplacement, au choix explicite).
   • Documents imprimables A4 (bon de commande, inventaire, rapports)
     via l'impression native du navigateur (« Enregistrer en PDF »).
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* ═════════════════════ CSV ═════════════════════ */
/* Nombre au format Excel français, sans séparateur de milliers */
function csvNum(n, dec = 2) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '';
  let s = Number(n).toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('.', ',');
}
const csvMoney = n => (n === null || n === undefined || isNaN(n)) ? '' : Number(n).toFixed(2).replace('.', ',');
const csvDate = iso => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR'); };
const csvDateTime = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  /* Protection contre l'injection de formules dans Excel (texte commençant par = + - @) */
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(header, rows) { return '﻿' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n'; }
function saveCSV(name, header, rows) {
  if (!rows.length) { toast('Rien à exporter avec ces filtres.', 'warn'); return; }
  downloadBlob(new Blob([toCSV(header, rows)], { type: 'text/csv;charset=utf-8' }), `ondea-stock-${name}-${todayISO()}.csv`);
  toast(`Export CSV : ${rows.length} ligne(s)`, 'ok');
}

function exportProductsCSV(list = S.products) {
  saveCSV('catalogue-produits', ['Identifiant', 'Nom', 'Référence (SKU)', 'Code-barres', 'Description', 'Catégorie', 'Fournisseur principal', 'Unité', 'Prix d\'achat HT', 'Prix de vente', 'Quantité en stock', 'Quantité réservée', 'Réellement disponible', 'Seuil minimal', 'Stock maximal', 'Réappro. recommandé', 'Emplacement principal', 'Valeur du stock', 'Niveau', 'Statut', 'Créé le', 'Modifié le', 'Démo'],
    list.map(p => [p.id, p.name, p.sku, p.ean, p.description, catName(p.categoryId), p.supplierId ? supName(p.supplierId) : '', p.unit, csvMoney(p.purchasePrice), p.salePrice == null ? '' : csvMoney(p.salePrice), csvNum(productQty(p), 3), csvNum(p.reserved || 0, 3), csvNum(productAvailable(p), 3), csvNum(p.minStock, 3), csvNum(p.maxStock, 3), csvNum(anaOf(p.id)?.recommended || 0, 0), locName(p.locationId), csvMoney(productValue(p)), LEVEL[stockLevel(p)].label, p.status === 'archived' ? 'Archivé' : 'Actif', csvDateTime(p.createdAt), csvDateTime(p.updatedAt), p.demo ? 'oui' : '']));
}
function exportStockStateCSV(locId = '') {
  const rows = [];
  S.products.filter(p => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'fr')).forEach(p => {
    const entries = Object.entries(p.stock || {}).filter(([l]) => !locId || l === locId);
    if (!entries.length && !locId) entries.push([p.locationId, 0]);
    entries.forEach(([l, q]) => rows.push([p.sku, p.name, catName(p.categoryId), locName(l), csvNum(q, 3), p.unit, csvMoney(p.purchasePrice), csvMoney(Math.max(0, q) * p.purchasePrice), csvNum(p.minStock, 3), LEVEL[stockLevel(p)].label]));
  });
  saveCSV('etat-des-stocks', ['Référence', 'Produit', 'Catégorie', 'Emplacement', 'Quantité', 'Unité', 'Prix d\'achat HT', 'Valeur', 'Seuil minimal', 'Niveau (produit)'], rows);
}
function exportMovementsCSV(list) {
  saveCSV('historique-mouvements', ['N°', 'Identifiant', 'Date de l\'opération', 'Enregistré le', 'Type', 'Référence produit', 'Produit', 'Quantité', 'Variation', 'Stock avant', 'Stock après', 'Emplacement', 'Destination', 'Coût unitaire', 'Valeur', 'Motif', 'Destinataire', 'Fournisseur', 'Référence documentaire', 'Commentaire', 'Opérateur', 'Annulé par', 'Annule', 'Forcé'],
    list.map(m => { const p = productById(m.productId); return [m.number, m.id, csvDateTime(m.date), csvDateTime(m.at), MV_TYPES[m.type]?.label, p?.sku || '', p?.name || '', csvNum(m.qty, 3), csvNum(m.delta, 3), csvNum(m.qtyBefore, 3), csvNum(m.qtyAfter, 3), locName(m.locId), m.toLocId ? locName(m.toLocId) : '', csvMoney(m.unitCost), csvMoney(m.value), m.reason, m.recipient, m.supplierId ? supName(m.supplierId) : '', m.docRef, m.comment, m.operatorName, m.cancelledById ? movementById(m.cancelledById)?.number || 'oui' : '', m.cancelsId ? movementById(m.cancelsId)?.number || '' : '', m.forced ? 'oui' : '']; }));
}
function exportRupturesCSV() {
  const list = activeAlerts().filter(a => ['rupture', 'low', 'near', 'reorder'].includes(a.type));
  saveCSV('ruptures-et-alertes', ['Priorité', 'Type d\'alerte', 'Référence', 'Produit', 'Quantité', 'Unité', 'Seuil', 'En commande', 'Réappro. recommandé', 'Fournisseur', 'Détectée le', 'Action recommandée'],
    list.map(a => { const p = productById(a.productId); const an = anaOf(p.id); return [PRIO[a.prio].label, ALERT_TYPES[a.type].label, p.sku, p.name, csvNum(a.qty, 3), p.unit, csvNum(a.threshold, 3), csvNum(an.onOrder, 3), csvNum(an.recommended, 0), p.supplierId ? supName(p.supplierId) : '', csvDateTime(a.detectedAt), a.action]; }));
}
function exportOrdersCSV(list = S.orders) {
  const rows = [];
  list.forEach(o => { const t = orderTotals(o); o.lines.forEach(l => { const p = productById(l.productId); rows.push([o.number, ORDER_STATUS[o.status].label, supName(o.supplierId), csvDate(o.createdAt), csvDate(o.expectedDate), p?.sku || '', p?.name || '', csvNum(l.qty, 3), csvNum(l.received || 0, 3), csvNum(o.closedRemainder ? 0 : lineRemaining(l), 3), csvMoney(l.unitPrice), csvMoney(l.qty * l.unitPrice), csvNum(o.vatRate, 2), csvMoney(t.ht), csvMoney(t.tva), csvMoney(t.ttc), o.paymentTerms, o.comments]); }); });
  saveCSV('commandes-fournisseurs', ['N° commande', 'Statut', 'Fournisseur', 'Créée le', 'Livraison prévue', 'Référence', 'Produit', 'Qté commandée', 'Qté reçue', 'Reste à recevoir', 'Prix unitaire HT', 'Montant ligne HT', 'Taux TVA %', 'Total commande HT', 'TVA commande', 'Total commande TTC', 'Conditions de paiement', 'Commentaires'], rows);
}
function exportSuppliersCSV() {
  saveCSV('fournisseurs', ['Nom', 'Contact', 'Téléphone', 'E-mail', 'Adresse', 'Site Internet', 'SIRET', 'Conditions de paiement', 'Délai (jours)', 'Produits référencés', 'Commandes en cours', 'Commentaires', 'Statut'],
    S.suppliers.map(s => [s.name, s.contact, s.phone, s.email, s.address, s.website, s.siret, s.paymentTerms, s.leadTime ?? '', S.products.filter(p => p.supplierId === s.id).length, S.orders.filter(o => o.supplierId === s.id && isOrderOpen(o)).length, s.comments, s.status === 'archived' ? 'Archivé' : 'Actif']));
}
function exportInventoryCSV(v) {
  saveCSV('inventaire-' + v.number, ['Inventaire', 'Statut', 'Référence', 'Produit', 'Emplacement', 'Stock théorique', 'Quantité comptée', 'Écart', 'Prix d\'achat', 'Valeur de l\'écart', 'Note'],
    v.lines.map(l => { const p = productById(l.productId); const d = l.counted !== null && l.theoretical !== null ? l.counted - l.theoretical : null; return [v.number, INV_STATUS[v.status].label, p?.sku, p?.name, locName(l.locId), csvNum(l.theoretical, 3), csvNum(l.counted, 3), csvNum(d, 3), csvMoney(p?.purchasePrice), d === null ? '' : csvMoney(d * (p?.purchasePrice || 0)), l.note]; }));
}
function exportConsumptionCSV(P) {
  const days = daysBetween(P.from, P.to) + 1;
  saveCSV('consommation', ['Période du', 'au', 'Référence', 'Produit', 'Catégorie', 'Quantité sortie', 'Unité', 'Nombre de sorties', 'Moyenne par jour', 'Coût des consommations', 'Stock actuel', 'Couverture (jours)'],
    consumptionByProduct(P).map(r => { const p = productById(r.productId); const a = anaOf(r.productId); return [csvDate(P.from), csvDate(P.to), p?.sku, p?.name, catName(p?.categoryId), csvNum(r.qty, 3), p?.unit, r.n, csvNum(r.qty / days, 3), csvMoney(r.value), csvNum(a?.qty, 3), a?.daysCover == null ? '' : Math.floor(a.daysCover)]; }));
}
function exportStockValueCSV() {
  const rows = stockByCategory().map(c => [catName(c.categoryId), c.refs, csvNum(c.qty, 3), csvMoney(c.value)]);
  rows.push(['TOTAL', sum(rows, r => r[1]), '', csvMoney(sum(S.products.filter(p => p.status === 'active'), productValue))]);
  saveCSV('valeur-du-stock', ['Catégorie', 'Références', 'Unités', 'Valeur au prix d\'achat'], rows);
}

/* ═════════════════════ SAUVEGARDE JSON ═════════════════════ */
function blobToDataURL(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
function dataURLToBlob(url) {
  const [head, data] = String(url).split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(data || ''); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function exportBackup() {
  const media = [];
  for (const m of await IDB.getAll('media')) {
    try { media.push({ id: m.id, name: m.name, type: m.type, at: m.at, demo: !!m.demo, data: await blobToDataURL(m.blob) }); }
    catch (e) { console.warn('Média illisible ignoré', m.id); }
  }
  const stores = {}; ['products', 'categories', 'locations', 'suppliers', 'movements', 'orders', 'inventories', 'journal'].forEach(k => stores[k] = S[k]);
  const payload = {
    app: 'Ondea Stock Intelligence', format: 1, exportedAt: nowStamp(), exportedBy: SESSION_OP?.name || '',
    counts: Object.fromEntries(Object.entries(stores).map(([k, v]) => [k, v.length]).concat([['media', media.length]])),
    stores, kv: { settings: SETTINGS, operators: OPERATORS, counters: COUNTERS, alertSeen: ALERT_SEEN }, media
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  downloadBlob(blob, `ondea-stock-sauvegarde-${todayISO()}.json`);
  PREF.set('osi_last_backup', nowStamp());
  toast(`Sauvegarde complète exportée (${(blob.size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo, ${media.length} image(s) incluse(s)).`, 'ok', 6000);
}

/* Contrôle d'intégrité d'une sauvegarde avant restauration */
function checkBackup(data) {
  const errs = [], warns = [];
  if (!data || data.app !== 'Ondea Stock Intelligence') { errs.push('Ce fichier n\'est pas une sauvegarde Ondea Stock Intelligence.'); return { errs, warns }; }
  if (data.format !== 1) errs.push('Version de sauvegarde non prise en charge (format ' + data.format + ').');
  const st = data.stores || {};
  ['products', 'categories', 'locations', 'suppliers', 'movements', 'orders', 'inventories'].forEach(k => { if (!Array.isArray(st[k])) errs.push(`Section « ${k} » absente ou invalide.`); });
  if (errs.length) return { errs, warns };
  st.products.forEach((p, i) => { if (!p.id || !p.name || !p.sku || typeof p.stock !== 'object') errs.push(`Produit n° ${i + 1} incomplet (identifiant, nom, référence ou stock manquant).`); });
  st.movements.forEach((m, i) => { if (!m.id || !m.productId || !MV_TYPES[m.type]) errs.push(`Mouvement n° ${i + 1} invalide.`); });
  if (errs.length > 8) errs.splice(8, errs.length, `… et d'autres erreurs.`);
  const pids = new Set(st.products.map(p => p.id));
  const orphan = st.movements.filter(m => !pids.has(m.productId)).length;
  if (orphan) warns.push(`${orphan} mouvement(s) font référence à des produits absents de la sauvegarde.`);
  /* Cohérence stock ↔ historique (information) */
  let drift = 0;
  st.products.forEach(p => { const mv = st.movements.filter(m => m.productId === p.id && m.type !== 'transfer'); if (mv.length) { const last = mv.reduce((a, b) => ((a.seq || 0) > (b.seq || 0) ? a : b)); const q = sum(Object.values(p.stock || {})); if (Math.abs(q - last.qtyAfter) > 1e-6) drift++; } });
  if (drift) warns.push(`${drift} produit(s) ont un stock différent de leur dernier mouvement (données modifiées hors application ?).`);
  const photoIds = new Set(st.products.map(p => p.photoId).filter(Boolean));
  const mediaIds = new Set((data.media || []).map(m => m.id));
  const missing = [...photoIds].filter(id => !mediaIds.has(id)).length;
  if (missing) warns.push(`${missing} photo(s) référencée(s) ne sont pas incluses dans le fichier.`);
  return { errs, warns };
}
function restoreFromFile(file, { fromWelcome = false } = {}) {
  const rd = new FileReader();
  rd.onload = () => {
    let data;
    try { data = JSON.parse(rd.result); } catch (e) { return toast('Fichier illisible : ce n\'est pas un JSON valide.', 'dng'); }
    const { errs, warns } = checkBackup(data);
    if (errs.length) return openModal({ title: 'Sauvegarde refusée', body: `<div class="login-err">${errs.map(esc).join('<br>')}</div><p class="soft">Aucune donnée n'a été modifiée.</p>`, footer: '<button type="button" class="btn" data-close>Fermer</button>' });
    const c = data.counts || {};
    openModal({
      title: 'Restaurer une sauvegarde', wide: true,
      body: `<p class="soft">Fichier du <b>${fmtDateTime(data.exportedAt)}</b>${data.exportedBy ? ' par ' + esc(data.exportedBy) : ''} :</p>
        <ul class="count-list"><li><b>${c.products ?? data.stores.products.length}</b> produits</li><li><b>${c.movements ?? data.stores.movements.length}</b> mouvements</li><li><b>${c.orders ?? data.stores.orders.length}</b> commandes</li><li><b>${c.inventories ?? data.stores.inventories.length}</b> inventaires</li><li><b>${c.suppliers ?? data.stores.suppliers.length}</b> fournisseurs</li><li><b>${(data.media || []).length}</b> images</li></ul>
        ${warns.length ? `<div class="notice warn-n">${svg('warn')}<div>${warns.map(esc).join('<br>')}</div></div>` : `<p class="notice-sm">${svg('check', 'inl')} Contrôle d'intégrité réussi.</p>`}
        <fieldset class="fs"><legend>Mode de restauration</legend>
          <label class="radio-card"><input type="radio" name="rsMode" value="merge" ${fromWelcome ? '' : 'checked'}><span><b>Fusionner</b> — ajoute les éléments absents de ce navigateur. Les éléments déjà présents (même identifiant) sont conservés tels quels ; vos réglages actuels sont gardés.</span></label>
          <label class="radio-card"><input type="radio" name="rsMode" value="replace" ${fromWelcome ? 'checked' : ''}><span><b>Remplacer</b> — efface TOUTES les données actuelles de ce navigateur et les remplace par la sauvegarde (y compris réglages et opérateurs).</span></label>
        </fieldset>`,
      footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="rsGo">Continuer</button>`,
      onOpen: m => $('#rsGo', m).onclick = () => {
        const mode = $('input[name=rsMode]:checked', m).value;
        const run = async () => { await applyRestore(data, mode); closeModal(1); };
        if (mode === 'replace' && (S.products.length || S.movements.length)) confirmDialog(`Toutes les données actuelles (${S.products.length} produits, ${S.movements.length} mouvements…) seront définitivement remplacées. Pensez à exporter une sauvegarde avant.`, run, { yes: 'Remplacer mes données', requireText: 'REMPLACER', title: 'Restauration destructive' });
        else confirmDialog(mode === 'replace' ? 'Restaurer la sauvegarde ?' : 'Fusionner la sauvegarde avec les données actuelles ?', run, { danger: false, yes: 'Restaurer' });
      }
    });
  };
  rd.onerror = () => toast('Lecture du fichier impossible.', 'dng');
  rd.readAsText(file);
}
async function applyRestore(data, mode) {
  const st = data.stores;
  const names = ['products', 'categories', 'locations', 'suppliers', 'movements', 'orders', 'inventories', 'journal'];
  const media = (data.media || []).map(m => { try { return { id: m.id, name: m.name, type: m.type, at: m.at, demo: !!m.demo, blob: dataURLToBlob(m.data) }; } catch (e) { return null; } }).filter(Boolean);
  let added = 0, kept = 0;
  if (mode === 'replace') {
    await IDB.tx([...names, 'media', 'kv'], t => {
      names.forEach(n => t.clear(n)); t.clear('media'); t.clear('kv');
      names.forEach(n => (st[n] || []).forEach(o => t.put(n, o)));
      media.forEach(md => t.put('media', md));
      const kv = data.kv || {};
      ['settings', 'operators', 'counters', 'alertSeen'].forEach(k => { if (kv[k] !== undefined) t.put('kv', { key: k, value: kv[k] }); });
    });
    added = sum(names, n => (st[n] || []).length);
  } else {
    const localMedia = new Set((await IDB.getAll('media')).map(m => m.id));
    const plan = {}; names.forEach(n => { const ids = new Set(S[n].map(x => x.id)); plan[n] = (st[n] || []).filter(o => { if (ids.has(o.id)) { kept++; return false; } added++; return true; }); });
    const counters = clone(COUNTERS); const bc = data.kv?.counters || {};
    counters.mv = Math.max(counters.mv || 0, bc.mv || 0);
    ['orders', 'inventories'].forEach(k => { counters[k] = counters[k] || {}; Object.entries(bc[k] || {}).forEach(([y, n]) => counters[k][y] = Math.max(counters[k][y] || 0, n)); });
    /* Opérateurs de la sauvegarde absents localement : ajoutés (pour l'historique) */
    const ops = OPERATORS.concat((data.kv?.operators || []).filter(o => !OPERATORS.some(x => x.id === o.id)).map(o => ({ ...o, active: false })));
    await IDB.tx([...names, 'media', 'kv'], t => {
      names.forEach(n => plan[n].forEach(o => t.put(n, o)));
      media.filter(m => !localMedia.has(m.id)).forEach(md => t.put('media', md));
      t.put('kv', { key: 'counters', value: counters }); t.put('kv', { key: 'operators', value: ops });
    });
  }
  await loadAll(); MEDIA_URLS.forEach(u => URL.revokeObjectURL(u)); MEDIA_URLS.clear();
  emitChange({ what: 'restore' });
  toast(mode === 'replace' ? `Sauvegarde restaurée : ${fmtNum(added, 0)} élément(s).` : `Fusion terminée : ${fmtNum(added, 0)} élément(s) ajouté(s), ${fmtNum(kept, 0)} déjà présent(s) conservé(s).`, 'ok', 7000);
  if (!SESSION_OP || !OPERATORS.some(o => o.id === SESSION_OP.id)) { SESSION_OP = null; PREF.set('osi_session', ''); $('#app').classList.remove('on'); $('#login').style.display = 'grid'; renderWelcome(); }
  else { SESSION_OP = OPERATORS.find(o => o.id === SESSION_OP.id); buildShell(); refreshView(); }
}

/* ═════════════════════ IMPRESSION A4 ═════════════════════ */
function docHeader(title, sub = '') {
  const s = SETTINGS;
  return `<header class="doc-h"><div class="doc-co">${s.logoId ? `<img data-media="${esc(s.logoId)}" alt="" class="doc-logo">` : ''}<div><b class="doc-cn">${esc(s.companyName || 'Mon entreprise')}</b>
      <div>${esc(s.address || '').replace(/\n/g, '<br>')}</div><div>${[s.phone, s.email].filter(Boolean).map(esc).join(' · ')}</div>${s.siret ? `<div>SIRET ${esc(s.siret)}</div>` : ''}</div></div>
    <div class="doc-t"><h1>${esc(title)}</h1>${sub}</div></header>`;
}
const docFooter = () => `<footer class="doc-f">Document généré par Ondea Stock Intelligence le ${fmtDateTime(nowStamp())}${SESSION_OP ? ' par ' + esc(SESSION_OP.name) : ''}</footer>`;

/* Aperçu à l'écran puis impression (le navigateur propose « Enregistrer au format PDF ») */
function printPreview(title, html) {
  openModal({
    title: 'Aperçu avant impression — ' + title, xwide: true, label: 'Aperçu avant impression',
    body: `<div class="paper-wrap"><div class="paper">${html}</div></div>`,
    footer: `<small class="muted grow" style="text-align:left">Astuce : choisissez « Enregistrer au format PDF » comme imprimante pour obtenir un PDF.</small><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn gold" id="ppGo">${svg('printer')} Imprimer</button>`,
    onOpen: m => { hydrateMedia(m); $('#ppGo', m).onclick = () => doPrint(html); }
  });
}
async function doPrint(html) {
  const area = $('#printArea');
  area.innerHTML = `<div class="paper">${html}</div>`;
  await hydrateMedia(area);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 1500); }, 60);
}

function printPurchaseOrder(o) {
  const s = supplierById(o.supplierId) || {};
  const t = orderTotals(o);
  const html = docHeader('Bon de commande', `<div class="doc-meta"><div><span>N°</span><b>${esc(o.number)}</b></div><div><span>Date</span><b>${fmtDate(o.createdAt)}</b></div>${o.expectedDate ? `<div><span>Livraison souhaitée</span><b>${fmtDate(o.expectedDate)}</b></div>` : ''}<div><span>Statut</span><b>${ORDER_STATUS[o.status].label}</b></div></div>`) +
    `<section class="doc-parties"><div><h2>Fournisseur</h2><b>${esc(s.name || '—')}</b>${s.contact ? `<div>À l'attention de ${esc(s.contact)}</div>` : ''}<div>${esc(s.address || '').replace(/\n/g, '<br>')}</div><div>${[s.phone, s.email].filter(Boolean).map(esc).join(' · ')}</div>${s.siret ? `<div>SIRET ${esc(s.siret)}</div>` : ''}</div>
      <div><h2>Livraison</h2><b>${esc(SETTINGS.companyName || '')}</b><div>${esc(SETTINGS.address || '').replace(/\n/g, '<br>')}</div></div></section>
    <table class="doc-tbl"><thead><tr><th>Référence</th><th>Désignation</th><th class="r">Quantité</th><th>Unité</th><th class="r">Prix unitaire HT</th><th class="r">Montant HT</th></tr></thead><tbody>
      ${o.lines.map(l => { const p = productById(l.productId); return `<tr><td class="mono">${esc(p?.sku || '')}</td><td>${esc(p?.name || '')}${p?.ean ? `<br><small>EAN ${esc(p.ean)}</small>` : ''}</td><td class="r">${fmtNum(l.qty)}</td><td>${esc(p?.unit || '')}</td><td class="r">${fmtMoney(l.unitPrice)}</td><td class="r">${fmtMoney(l.qty * l.unitPrice)}</td></tr>`; }).join('')}
    </tbody></table>
    <div class="doc-totals"><div><span>Total HT</span><b>${fmtMoney(t.ht)}</b></div><div><span>TVA ${fmtPct(t.rate, t.rate % 1 ? 1 : 0)}</span><b>${fmtMoney(t.tva)}</b></div><div class="ttc"><span>Total TTC</span><b>${fmtMoney(t.ttc)}</b></div></div>
    ${o.paymentTerms ? `<p><b>Conditions de paiement :</b> ${esc(o.paymentTerms)}</p>` : ''}
    ${o.comments ? `<p><b>Commentaires :</b> ${esc(o.comments)}</p>` : ''}
    <div class="doc-sign"><div>Bon pour commande<br><small>Date, cachet et signature</small></div></div>` + docFooter();
  printPreview('Bon de commande ' + o.number, html);
}
function printInventory(v) {
  const s = invSummary(v);
  const html = docHeader('Rapport d\'inventaire', `<div class="doc-meta"><div><span>N°</span><b>${esc(v.number)}</b></div><div><span>Statut</span><b>${INV_STATUS[v.status].label}</b></div><div><span>Périmètre</span><b>${esc(scopeLabel(v.scope))}</b></div><div><span>Ouverture</span><b>${v.openedAt ? fmtDateTime(v.openedAt) : '—'}</b></div>${v.validatedAt ? `<div><span>Validation</span><b>${fmtDateTime(v.validatedAt)}</b></div>` : ''}</div>`) +
    `<p><b>${esc(v.name)}</b> — ${v.lines.length} ligne(s), ${s.counted} comptée(s), ${s.diffLines} en écart. Valeur nette des écarts : <b>${fmtMoney(s.diffValue)}</b> (positifs ${fmtMoney(s.plus)}, négatifs ${fmtMoney(s.minus)}).</p>
    <table class="doc-tbl"><thead><tr><th>Référence</th><th>Produit</th><th>Emplacement</th><th class="r">Théorique</th><th class="r">Compté</th><th class="r">Écart</th><th class="r">Valeur écart</th><th>Note</th></tr></thead><tbody>
    ${v.lines.map(l => { const p = productById(l.productId); const d = l.counted !== null && l.theoretical !== null ? round3(l.counted - l.theoretical) : null; return `<tr><td class="mono">${esc(p?.sku || '')}</td><td>${esc(p?.name || '')}</td><td>${esc(locName(l.locId))}</td><td class="r">${l.theoretical === null ? '' : fmtNum(l.theoretical)}</td><td class="r">${l.counted === null ? '<span class="blank"></span>' : fmtNum(l.counted)}</td><td class="r">${d === null ? '' : (d > 0 ? '+' : '') + fmtNum(d)}</td><td class="r">${d ? fmtMoney(d * (p?.purchasePrice || 0)) : ''}</td><td>${esc(l.note || '')}</td></tr>`; }).join('')}
    </tbody></table>${v.observations ? `<p><b>Observations :</b> ${esc(v.observations)}</p>` : ''}
    <div class="doc-sign two"><div>Compté par<br><small>Nom et signature</small></div><div>Validé par<br><small>${esc(v.validatedBy || 'Nom et signature')}</small></div></div>` + docFooter();
  printPreview('Inventaire ' + v.number, html);
}
function printTable(title, sub, head, rows, note = '') {
  const html = docHeader(title, `<div class="doc-meta">${sub}</div>`) + (note ? `<p>${note}</p>` : '') +
    `<table class="doc-tbl"><thead><tr>${head.map(h => `<th class="${h.r ? 'r' : ''}">${esc(h.t || h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${head[i].r ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` + docFooter();
  printPreview(title, html);
}
function printStats(P, A) {
  const cons = consumptionByProduct(P).slice(0, 40);
  printTable('Statistiques de consommation', `<div><span>Période</span><b>${esc(P.label)}</b></div><div><span>Entrées</span><b>${fmtMoney(A.inV)}</b></div><div><span>Sorties</span><b>${fmtMoney(A.outV)}</b></div><div><span>Rotation</span><b>${A.rotation === null ? 'n.c.' : A.rotation.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</b></div>`,
    ['Référence', 'Produit', { t: 'Quantité', r: 1 }, 'Unité', { t: 'Coût', r: 1 }], cons.map(r => { const p = productById(r.productId); return [esc(p?.sku), esc(p?.name), fmtNum(r.qty), esc(p?.unit), fmtMoney(r.value)]; }));
}
