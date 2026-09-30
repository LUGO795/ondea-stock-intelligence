/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — store.js
   État central de l'application + règles métier (services).

   Principe : toutes les données sont chargées en mémoire depuis IndexedDB
   au démarrage (objet S). Chaque opération :
     1. vérifie les règles (quantités, statuts, droits) ;
     2. prépare les nouveaux objets (copies) ;
     3. les écrit dans UNE transaction IndexedDB ;
     4. seulement si l'écriture réussit, met à jour la mémoire ;
     5. prévient l'interface (événement « change ») qui recalcule
        tableau de bord, alertes, badges…
   Ainsi le tableau de bord, la fiche produit et l'historique ne peuvent
   jamais être désynchronisés.
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* ---------- État en mémoire ---------- */
const S = { products: [], categories: [], locations: [], suppliers: [], movements: [], orders: [], inventories: [], journal: [] };
const IDX = { product: new Map(), category: new Map(), location: new Map(), supplier: new Map(), order: new Map(), inventory: new Map(), movement: new Map() };
let VERSION = 0;               // incrémenté à chaque modification (sert de clé de cache aux calculs)

/* Réglages par défaut (modifiables dans Paramètres) */
const DEFAULT_SETTINGS = {
  companyName: '', logoId: null, address: '', phone: '', email: '', website: '', siret: '',
  currency: 'EUR', dateFormat: 'fr',
  defaultMinStock: 5, nearPct: 20, dormantDays: 60, spikeRatio: 1.5, spikeMinQty: 5,
  analysisDays: 90, defaultLeadTime: 7, coverDays: 30, reviewDays: 7,
  vatRates: [20, 10, 5.5, 2.1, 0], defaultVat: 20,
  units: ['pièce', 'kg', 'litre', 'mètre', 'carton', 'boîte', 'lot', 'paire', 'm²', 'sachet', 'rouleau'],
  paymentTerms: ['À réception de facture', '30 jours fin de mois', '45 jours fin de mois', '60 jours', 'Comptant à la commande'],
  outReasons: ['Consommation interne', 'Vente', 'Utilisation chantier', 'Perte', 'Casse', 'Don', 'Autre'],
  valuation: 'cump', pageSize: 25, requirePin: false,
  createdAt: null
};
let SETTINGS = { ...DEFAULT_SETTINGS };
let OPERATORS = [];            // [{id, name, role, pin, active}]
let COUNTERS = { mv: 0, orders: {}, inventories: {} };
let ALERT_SEEN = {};           // clé d'alerte → date de première détection
let SESSION_OP = null;         // opérateur connecté

const ROLE_LABEL = { admin: 'Administrateur', responsable: 'Responsable des stocks', operateur: 'Opérateur' };
/* Droits par rôle — l'administrateur peut tout faire */
const RIGHTS = {
  admin: ['*'],
  responsable: ['product.edit', 'product.delete', 'stock.move', 'stock.force', 'inventory.validate', 'order.edit', 'order.receive', 'supplier.edit', 'catalog.edit', 'movement.cancel', 'export', 'demo'],
  operateur: ['stock.move', 'order.receive', 'inventory.count', 'export']
};
function can(right) {
  const r = SESSION_OP?.role || 'operateur';
  const list = RIGHTS[r] || [];
  if (list.includes('*') || list.includes(right)) return true;
  if (right === 'inventory.count') return true;
  return false;
}
function requireRight(right, label) {
  if (can(right)) return true;
  throw new Error(`Action réservée : votre profil « ${ROLE_LABEL[SESSION_OP?.role] || 'Opérateur'} » ne permet pas de ${label}.`);
}

/* ---------- Chargement initial ---------- */
async function loadAll() {
  for (const k of Object.keys(S)) S[k] = await IDB.getAll(k);
  const kv = await IDB.getAll('kv');
  const get = key => kv.find(x => x.key === key)?.value;
  SETTINGS = { ...DEFAULT_SETTINGS, ...(get('settings') || {}) };
  OPERATORS = get('operators') || [];
  COUNTERS = { mv: 0, orders: {}, inventories: {}, ...(get('counters') || {}) };
  ALERT_SEEN = get('alertSeen') || {};
  S.movements.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  S.journal.sort((a, b) => (a.at < b.at ? 1 : -1));
  reindex();
}
function reindex() {
  IDX.product = new Map(S.products.map(x => [x.id, x]));
  IDX.category = new Map(S.categories.map(x => [x.id, x]));
  IDX.location = new Map(S.locations.map(x => [x.id, x]));
  IDX.supplier = new Map(S.suppliers.map(x => [x.id, x]));
  IDX.order = new Map(S.orders.map(x => [x.id, x]));
  IDX.inventory = new Map(S.inventories.map(x => [x.id, x]));
  IDX.movement = new Map(S.movements.map(x => [x.id, x]));
}
const productById = id => IDX.product.get(id);
const categoryById = id => IDX.category.get(id);
const locationById = id => IDX.location.get(id);
const supplierById = id => IDX.supplier.get(id);
const orderById = id => IDX.order.get(id);
const inventoryById = id => IDX.inventory.get(id);
const movementById = id => IDX.movement.get(id);
const catName = id => categoryById(id)?.name || 'Sans catégorie';
const locName = id => locationById(id)?.name || '—';
const supName = id => supplierById(id)?.name || '—';

/* ---------- Écouteurs de changement (l'interface s'y abonne) ---------- */
const LISTENERS = new Set();
function onChange(fn) { LISTENERS.add(fn); }
function emitChange(info) { VERSION++; LISTENERS.forEach(fn => { try { fn(info); } catch (e) { console.error(e); } }); }

/* ---------- Écriture centralisée ----------
   plan = { put: {store: [objets]}, del: {store: [ids]}, kv: {cle: valeur} }
   Écrit tout dans UNE transaction, puis met à jour la mémoire. */
async function commit(plan, info = {}) {
  const put = plan.put || {}, del = plan.del || {}, kv = plan.kv || {};
  const stores = [...Object.keys(put), ...Object.keys(del)];
  if (Object.keys(kv).length) stores.push('kv');
  if (!stores.length) return;
  await IDB.tx(stores, t => {
    for (const [s, list] of Object.entries(put)) list.forEach(o => t.put(s, o));
    for (const [s, ids] of Object.entries(del)) ids.forEach(id => t.del(s, id));
    for (const [k, v] of Object.entries(kv)) t.put('kv', { key: k, value: v });
  });
  /* Écriture réussie → mise à jour de la mémoire */
  for (const [s, list] of Object.entries(put)) {
    if (s === 'media') continue;
    const map = new Map(S[s].map(x => [x.id, x]));
    list.forEach(o => map.set(o.id, o));
    S[s] = [...map.values()];
  }
  for (const [s, ids] of Object.entries(del)) {
    if (s === 'media') continue;
    const set = new Set(ids); S[s] = S[s].filter(x => !set.has(x.id));
  }
  if ('settings' in kv) SETTINGS = { ...DEFAULT_SETTINGS, ...kv.settings };
  if ('operators' in kv) OPERATORS = kv.operators;
  if ('counters' in kv) COUNTERS = kv.counters;
  if ('alertSeen' in kv) ALERT_SEEN = kv.alertSeen;
  if (put.movements) S.movements.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  if (put.journal) { S.journal.sort((a, b) => (a.at < b.at ? 1 : -1)); if (S.journal.length > 3000) trimJournal(); }
  reindex();
  emitChange(info);
  /* Prévient les autres onglets ouverts sur l'application (ils rechargent leurs données) */
  try { TAB_CHANNEL && TAB_CHANNEL.postMessage({ type: 'changed', what: info.what || '' }); } catch (e) { }
}
/* Synchronisation entre onglets : évite qu'un onglet resté ouvert écrive des données périmées */
const TAB_CHANNEL = ('BroadcastChannel' in window) ? new BroadcastChannel('ondea-stock-intelligence') : null;
if (TAB_CHANNEL) TAB_CHANNEL.onmessage = async (e) => {
  if (!e.data || e.data.type !== 'changed') return;
  try { await loadAll(); emitChange({ what: 'external' }); } catch (err) { console.warn('[Ondea Stock] resynchronisation', err); }
};
function trimJournal() {
  const extra = S.journal.slice(3000).map(j => j.id);
  S.journal = S.journal.slice(0, 3000);
  IDB.tx(['journal'], t => extra.forEach(id => t.del('journal', id))).catch(() => { });
}

/* ---------- Numérotation ---------- */
function nextNumbers(counters, kind, n = 1) {
  const c = clone(counters);
  const year = new Date().getFullYear();
  const out = [];
  if (kind === 'mv') { for (let i = 0; i < n; i++) { c.mv = (c.mv || 0) + 1; out.push({ seq: c.mv, number: 'MV-' + String(c.mv).padStart(6, '0') }); } }
  else {
    c[kind] = c[kind] || {}; c[kind][year] = c[kind][year] || 0;
    for (let i = 0; i < n; i++) { c[kind][year]++; out.push((kind === 'orders' ? 'CF-' : 'INV-') + year + '-' + String(c[kind][year]).padStart(4, '0')); }
  }
  return { counters: c, out };
}

/* ---------- Journal d'activité ---------- */
function journalEntry(kind, text, ref = {}, extra = {}) {
  return { id: uid('jr'), at: nowStamp(), kind, text, ref, operatorId: SESSION_OP?.id || null, operatorName: SESSION_OP?.name || '', ...extra };
}

/* ══════════════════════════════════════════════════════════════
   PRODUITS
   ══════════════════════════════════════════════════════════════ */
const productQty = p => round3(sum(Object.values(p.stock || {})));
const productAvailable = p => round3(productQty(p) - (Number(p.reserved) || 0));
const productValue = p => round2(Math.max(0, productQty(p)) * (Number(p.purchasePrice) || 0));

/* Validation d'une fiche produit (retourne la liste des erreurs lisibles) */
function validateProduct(d, id) {
  const e = [];
  if (!d.name || !d.name.trim()) e.push('Le nom du produit est obligatoire.');
  if (!d.sku || !d.sku.trim()) e.push('La référence interne (SKU) est obligatoire.');
  else if (S.products.some(p => p.id !== id && norm(p.sku) === norm(d.sku))) e.push(`La référence « ${d.sku} » est déjà utilisée par un autre produit.`);
  if (d.ean && !/^[0-9]{8,14}$/.test(d.ean)) e.push('Le code-barres doit contenir de 8 à 14 chiffres (EAN-8, EAN-13, GTIN-14…).');
  else if (d.ean && S.products.some(p => p.id !== id && p.ean === d.ean)) e.push('Ce code-barres est déjà attribué à un autre produit.');
  ['purchasePrice', 'salePrice', 'minStock', 'maxStock', 'reserved', 'reorderQty'].forEach(k => {
    if (d[k] !== null && d[k] !== undefined && d[k] !== '' && (isNaN(d[k]) || d[k] < 0)) e.push(`Valeur invalide pour « ${FIELD_LABEL[k]} » : un nombre positif est attendu.`);
  });
  if (isNaN(d.purchasePrice)) e.push('Le prix d\'achat unitaire est obligatoire (0 accepté).');
  if (d.maxStock > 0 && d.minStock > d.maxStock) e.push('Le seuil minimal ne peut pas dépasser le stock maximal souhaité.');
  return e;
}
const FIELD_LABEL = { purchasePrice: 'Prix d\'achat', salePrice: 'Prix de vente', minStock: 'Seuil minimal', maxStock: 'Stock maximal', reserved: 'Quantité réservée', reorderQty: 'Réapprovisionnement' };

/* Création d'un produit, avec éventuel stock initial (mouvement « initial » tracé) */
async function createProduct(d, initial = null) {
  requireRight('product.edit', 'créer un produit');
  const errs = validateProduct(d);
  if (errs.length) throw new Error(errs.join('\n'));
  const p = {
    id: uid('prd'), name: d.name.trim(), sku: d.sku.trim(), ean: d.ean || '', description: d.description || '',
    categoryId: d.categoryId || null, supplierId: d.supplierId || null,
    purchasePrice: round2(d.purchasePrice || 0), salePrice: d.salePrice === '' || d.salePrice == null || isNaN(d.salePrice) ? null : round2(d.salePrice),
    reserved: Number(d.reserved) || 0, minStock: Number(d.minStock) || 0, maxStock: Number(d.maxStock) || 0,
    reorderQty: d.reorderQty ? Number(d.reorderQty) : null, unit: d.unit || 'pièce',
    locationId: d.locationId || S.locations[0]?.id || null, stock: {}, photoId: d.photoId || null,
    status: 'active', createdAt: nowStamp(), updatedAt: nowStamp(), demo: !!d.demo
  };
  const plan = { put: { products: [p], journal: [journalEntry('product', `a créé le produit <b>${esc(p.name)}</b>`, { type: 'product', id: p.id })] } };
  if (initial && initial.qty > 0) {
    const locId = initial.locId || p.locationId;
    if (!locId) throw new Error('Créez d\'abord un emplacement de stockage (rubrique Stocks et entrepôts).');
    const { counters, out } = nextNumbers(COUNTERS, 'mv');
    const mv = makeMovement(p, { type: 'initial', delta: initial.qty, locId, unitCost: p.purchasePrice, comment: 'Stock initial à la création de la fiche', date: nowStamp() }, out[0]);
    plan.put.movements = [mv];
    plan.kv = { counters };
  }
  await commit(plan, { what: 'product' });
  return p;
}

async function updateProduct(id, d) {
  requireRight('product.edit', 'modifier un produit');
  const cur = productById(id); if (!cur) throw new Error('Produit introuvable.');
  const errs = validateProduct(d, id);
  if (errs.length) throw new Error(errs.join('\n'));
  const p = { ...clone(cur), ...d, name: d.name.trim(), sku: d.sku.trim(), updatedAt: nowStamp() };
  p.salePrice = d.salePrice === '' || d.salePrice == null || isNaN(d.salePrice) ? null : round2(d.salePrice);
  p.purchasePrice = round2(d.purchasePrice);
  const changes = [];
  if (cur.purchasePrice !== p.purchasePrice) changes.push(`prix d'achat ${fmtMoney(cur.purchasePrice)} → ${fmtMoney(p.purchasePrice)}`);
  if (cur.minStock !== p.minStock) changes.push(`seuil ${cur.minStock} → ${p.minStock}`);
  await commit({ put: { products: [p], journal: [journalEntry('product', `a modifié la fiche <b>${esc(p.name)}</b>${changes.length ? ' (' + esc(changes.join(', ')) + ')' : ''}`, { type: 'product', id })] } }, { what: 'product' });
  return p;
}

async function duplicateProduct(id) {
  requireRight('product.edit', 'dupliquer un produit');
  const src = productById(id); if (!src) throw new Error('Produit introuvable.');
  let sku = src.sku + '-COPIE', i = 2;
  while (S.products.some(p => norm(p.sku) === norm(sku))) sku = src.sku + '-COPIE' + (i++);
  /* La copie démarre sans stock ni code-barres (un code-barres est unique) */
  return createProduct({ ...clone(src), name: src.name + ' (copie)', sku, ean: '', photoId: src.photoId, demo: false });
}

async function setProductStatus(id, status) {
  requireRight('product.edit', 'archiver un produit');
  const cur = productById(id); if (!cur) throw new Error('Produit introuvable.');
  const p = { ...clone(cur), status, updatedAt: nowStamp() };
  await commit({ put: { products: [p], journal: [journalEntry('product', `a ${status === 'archived' ? 'archivé' : 'réactivé'} le produit <b>${esc(p.name)}</b>`, { type: 'product', id })] } }, { what: 'product' });
}

/* Suppression définitive : autorisée uniquement sans historique (sinon archivage) */
function productDeletionBlockers(id) {
  const b = [];
  const mv = S.movements.filter(m => m.productId === id).length;
  if (mv) b.push(`${mv} mouvement(s) dans l'historique`);
  const ord = S.orders.filter(o => o.lines.some(l => l.productId === id)).length;
  if (ord) b.push(`${ord} commande(s) fournisseur`);
  const inv = S.inventories.filter(v => v.lines.some(l => l.productId === id)).length;
  if (inv) b.push(`${inv} inventaire(s)`);
  return b;
}
async function deleteProduct(id) {
  requireRight('product.delete', 'supprimer un produit');
  const p = productById(id); if (!p) return;
  const b = productDeletionBlockers(id);
  if (b.length) throw new Error('Suppression impossible : ce produit possède ' + b.join(', ') + '. Archivez-le pour conserver la traçabilité.');
  const plan = { del: { products: [id] }, put: { journal: [journalEntry('product', `a supprimé le produit <b>${esc(p.name)}</b>`, { type: 'product', id })] } };
  if (p.photoId && !S.products.some(x => x.id !== id && x.photoId === p.photoId)) plan.del.media = [p.photoId];
  await commit(plan, { what: 'product' });
}

/* ══════════════════════════════════════════════════════════════
   MOUVEMENTS DE STOCK
   ══════════════════════════════════════════════════════════════ */
const MV_TYPES = {
  initial: { label: 'Stock initial', icon: 'box', cls: 'info' },
  in: { label: 'Entrée', icon: 'arrin', cls: 'ok' },
  reception: { label: 'Réception commande', icon: 'truck', cls: 'ok' },
  out: { label: 'Sortie', icon: 'arrout', cls: 'warn' },
  transfer: { label: 'Transfert', icon: 'swap', cls: 'info' },
  adjust: { label: 'Ajustement', icon: 'sliders', cls: 'gold' },
  inventory: { label: 'Régularisation inventaire', icon: 'clipcheck', cls: 'gold' },
  cancel: { label: 'Annulation', icon: 'undo', cls: 'dng' }
};

/* Construit un mouvement complet et MET À JOUR la copie de travail du produit p.
   o = {type, delta, locId, toLocId, unitCost, reason, recipient, supplierId, docRef, comment, date, orderId, inventoryId, cancelsId, forced, allowNegative}
   num = {seq, number} */
function makeMovement(p, o, num) {
  p.stock = p.stock || {};
  const qtyBefore = productQty(p);
  const priceBefore = Number(p.purchasePrice) || 0;
  let unitCost = o.unitCost != null && !isNaN(o.unitCost) ? Number(o.unitCost) : priceBefore;
  let locBefore = null, locAfter = null, toBefore = null, toAfter = null;

  if (o.type === 'transfer') {
    const q = Math.abs(o.delta);
    if (!o.locId || !o.toLocId || o.locId === o.toLocId) throw new Error('Choisissez deux emplacements différents pour le transfert.');
    locBefore = Number(p.stock[o.locId] || 0);
    if (q > locBefore + 1e-9) throw new Error(`Transfert impossible pour « ${p.name} » : seulement ${fmtNum(locBefore)} ${p.unit} à « ${locName(o.locId)} ».`);
    toBefore = Number(p.stock[o.toLocId] || 0);
    p.stock[o.locId] = round3(locBefore - q); locAfter = p.stock[o.locId];
    p.stock[o.toLocId] = round3(toBefore + q); toAfter = p.stock[o.toLocId];
  } else {
    if (!o.locId) throw new Error('Emplacement de stockage manquant.');
    locBefore = Number(p.stock[o.locId] || 0);
    const next = round3(locBefore + o.delta);
    if (next < -1e-9 && !o.allowNegative) {
      throw new Error(`Stock insuffisant pour « ${p.name} » à « ${locName(o.locId)} » : ${fmtNum(locBefore)} ${p.unit} disponible(s), ${fmtNum(Math.abs(o.delta))} demandé(s).`);
    }
    p.stock[o.locId] = next; locAfter = next;
    /* Valorisation des entrées : CUMP (coût unitaire moyen pondéré) ou dernier prix */
    if (o.delta > 0 && ['in', 'reception', 'initial'].includes(o.type) && o.unitCost != null && !isNaN(o.unitCost)) {
      const base = Math.max(0, qtyBefore);
      if (SETTINGS.valuation === 'last' || base <= 0) p.purchasePrice = round2(o.unitCost);
      else p.purchasePrice = round2((base * priceBefore + o.delta * o.unitCost) / (base + o.delta));
    } else if (o.delta !== 0 && !(o.unitCost != null && o.type === 'cancel')) {
      unitCost = priceBefore;   // sorties, ajustements : valorisés au prix d'achat courant
    }
  }
  /* Nettoyage des emplacements vides */
  Object.keys(p.stock).forEach(k => { if (Math.abs(p.stock[k]) < 1e-9) delete p.stock[k]; });
  p.updatedAt = nowStamp();
  const qtyAfter = productQty(p);
  const delta = o.type === 'transfer' ? 0 : round3(o.delta);
  return {
    id: uid('mv'), seq: num.seq, number: num.number, type: o.type, productId: p.id,
    qty: Math.abs(round3(o.delta)), delta, qtyBefore, qtyAfter,
    locId: o.locId || null, toLocId: o.toLocId || null, locBefore, locAfter, toBefore, toAfter,
    unitCost: round2(unitCost), value: round2(Math.abs(o.delta) * unitCost), valueDelta: round2(delta * unitCost),
    priceBefore, priceAfter: p.purchasePrice,
    reason: o.reason || '', recipient: o.recipient || '', supplierId: o.supplierId || null,
    docRef: o.docRef || '', comment: o.comment || '', forced: !!o.forced,
    orderId: o.orderId || null, orderLineId: o.orderLineId || null, receptionId: o.receptionId || null,
    inventoryId: o.inventoryId || null, cancelsId: o.cancelsId || null, cancelledById: null,
    operatorId: SESSION_OP?.id || null, operatorName: SESSION_OP?.name || '',
    date: o.date || nowStamp(), at: nowStamp(), demo: !!p.demo
  };
}

/* Point d'entrée des opérations simples : entrée, sortie, transfert, ajustement */
async function recordMovement(o) {
  requireRight('stock.move', 'enregistrer un mouvement');
  const src = productById(o.productId);
  if (!src) throw new Error('Choisissez un produit.');
  if (src.status === 'archived') throw new Error('Ce produit est archivé : réactivez-le avant de saisir un mouvement.');
  const q = Number(o.qty);
  if (!(q > 0)) throw new Error('La quantité doit être un nombre strictement positif.');
  if (o.forced || o.type === 'adjust') requireRight('stock.force', 'faire un ajustement de stock');
  if (!['in', 'out', 'transfer', 'adjust'].includes(o.type)) throw new Error('Type de mouvement inconnu.');
  if (o.forced && !(o.comment || '').trim()) throw new Error('Un ajustement exceptionnel doit être justifié dans le commentaire.');
  const p = clone(src);
  let delta = q;
  if (o.type === 'out' || (o.type === 'adjust' && o.direction === 'minus')) delta = -q;
  const { counters, out } = nextNumbers(COUNTERS, 'mv');
  const mv = makeMovement(p, { ...o, delta, allowNegative: !!o.forced }, out[0]);
  const plan = { put: { movements: [mv], products: [p] }, kv: { counters } };
  /* Entrée avec un fournisseur : on le retient comme fournisseur principal si aucun n'est défini */
  if (o.type === 'in' && o.supplierId && !p.supplierId) p.supplierId = o.supplierId;
  await commit(plan, { what: 'movement', movement: mv });
  return mv;
}

/* Annulation tracée : crée le mouvement inverse, ne supprime rien */
function cancelBlocker(mv) {
  if (!mv) return 'Mouvement introuvable.';
  if (mv.type === 'cancel') return 'Une annulation ne peut pas être annulée : saisissez un nouveau mouvement si nécessaire.';
  if (mv.cancelledById) return 'Ce mouvement a déjà été annulé.';
  const p = productById(mv.productId); if (!p) return 'Le produit n\'existe plus.';
  if (mv.type === 'transfer') {
    if ((p.stock?.[mv.toLocId] || 0) + 1e-9 < mv.qty) return `Annulation impossible : il ne reste que ${fmtNum(p.stock?.[mv.toLocId] || 0)} ${p.unit} à « ${locName(mv.toLocId)} ».`;
  } else if (mv.delta > 0) {
    if ((p.stock?.[mv.locId] || 0) + 1e-9 < mv.delta) return `Annulation impossible : le stock actuel à « ${locName(mv.locId)} » (${fmtNum(p.stock?.[mv.locId] || 0)}) est inférieur à la quantité à retirer (${fmtNum(mv.delta)}).`;
  }
  return null;
}
async function cancelMovement(id, reason) {
  requireRight('movement.cancel', 'annuler un mouvement');
  const orig = movementById(id);
  const block = cancelBlocker(orig); if (block) throw new Error(block);
  if (!(reason || '').trim()) throw new Error('Indiquez le motif de l\'annulation.');
  const p = clone(productById(orig.productId));
  const { counters, out } = nextNumbers(COUNTERS, 'mv');
  let mv;
  if (orig.type === 'transfer') {
    mv = makeMovement(p, { type: 'transfer', delta: orig.qty, locId: orig.toLocId, toLocId: orig.locId, cancelsId: orig.id, comment: reason, docRef: orig.number }, out[0]);
    mv.type = 'cancel'; mv.delta = 0;
  } else {
    const before = p.purchasePrice;
    mv = makeMovement(p, { type: 'cancel', delta: -orig.delta, locId: orig.locId, unitCost: orig.unitCost, cancelsId: orig.id, comment: reason, docRef: orig.number, allowNegative: true }, out[0]);
    /* Annulation d'une entrée : on retire son effet du coût moyen */
    if (orig.delta > 0 && ['in', 'reception', 'initial'].includes(orig.type)) {
      const rest = mv.qtyAfter;
      p.purchasePrice = rest > 0 && SETTINGS.valuation === 'cump' ? round2(Math.max(0, (mv.qtyBefore * before - orig.delta * orig.unitCost) / rest)) : before;
      mv.priceAfter = p.purchasePrice;
    }
    mv.valueDelta = round2(mv.delta * orig.unitCost); mv.unitCost = orig.unitCost; mv.value = round2(Math.abs(mv.delta) * orig.unitCost);
  }
  const o2 = { ...clone(orig), cancelledById: mv.id };
  const plan = { put: { movements: [mv, o2], products: [p] }, kv: { counters } };
  /* Annulation d'une réception : la quantité redevient « en attente » sur la commande */
  if (orig.type === 'reception' && orig.orderId && orderById(orig.orderId)) {
    const ord = clone(orderById(orig.orderId));
    const line = ord.lines.find(l => l.id === orig.orderLineId);
    if (line) { line.received = round3(Math.max(0, (line.received || 0) - orig.qty)); }
    const prev = ord.status; ord.status = computeOrderStatus(ord);
    if (prev !== ord.status) ord.history.push({ at: nowStamp(), status: ord.status, by: SESSION_OP?.name || '', note: 'Annulation de réception ' + orig.number });
    plan.put.orders = [ord];
  }
  plan.put.journal = [journalEntry('cancel', `a annulé le mouvement <b>${esc(orig.number)}</b> (${esc(p.name)})`, { type: 'movement', id: mv.id })];
  await commit(plan, { what: 'movement', movement: mv });
  return mv;
}

/* ══════════════════════════════════════════════════════════════
   CATÉGORIES, EMPLACEMENTS, FOURNISSEURS
   ══════════════════════════════════════════════════════════════ */
async function saveCategory(d, id) {
  requireRight('catalog.edit', 'modifier les catégories');
  if (!d.name?.trim()) throw new Error('Le nom de la catégorie est obligatoire.');
  if (S.categories.some(c => c.id !== id && norm(c.name) === norm(d.name))) throw new Error('Une catégorie porte déjà ce nom.');
  const c = id ? { ...clone(categoryById(id)), ...d, name: d.name.trim() } : { id: uid('cat'), name: d.name.trim(), description: d.description || '', color: d.color || 1, createdAt: nowStamp(), demo: !!d.demo };
  await commit({ put: { categories: [c] } }, { what: 'catalog' });
  return c;
}
async function deleteCategory(id) {
  requireRight('catalog.edit', 'supprimer une catégorie');
  const n = S.products.filter(p => p.categoryId === id).length;
  if (n) throw new Error(`Suppression impossible : ${n} produit(s) utilisent cette catégorie. Réaffectez-les d'abord.`);
  await commit({ del: { categories: [id] } }, { what: 'catalog' });
}
async function saveLocation(d, id) {
  requireRight('catalog.edit', 'modifier les emplacements');
  if (!d.name?.trim()) throw new Error('Le nom de l\'emplacement est obligatoire.');
  if (S.locations.some(c => c.id !== id && norm(c.name) === norm(d.name))) throw new Error('Un emplacement porte déjà ce nom.');
  const c = id ? { ...clone(locationById(id)), ...d, name: d.name.trim() } : { id: uid('loc'), name: d.name.trim(), site: d.site || '', description: d.description || '', createdAt: nowStamp(), demo: !!d.demo };
  await commit({ put: { locations: [c] } }, { what: 'catalog' });
  return c;
}
async function deleteLocation(id) {
  requireRight('catalog.edit', 'supprimer un emplacement');
  const withStock = S.products.filter(p => Math.abs(p.stock?.[id] || 0) > 0).length;
  if (withStock) throw new Error(`Suppression impossible : ${withStock} produit(s) ont encore du stock à cet emplacement. Transférez-le d'abord.`);
  if (S.movements.some(m => m.locId === id || m.toLocId === id)) throw new Error('Suppression impossible : cet emplacement apparaît dans l\'historique des mouvements (traçabilité).');
  const defaults = S.products.filter(p => p.locationId === id).map(p => ({ ...clone(p), locationId: S.locations.find(l => l.id !== id)?.id || null }));
  await commit({ del: { locations: [id] }, put: defaults.length ? { products: defaults } : {} }, { what: 'catalog' });
}
function validateSupplier(d, id) {
  const e = [];
  if (!d.name?.trim()) e.push('Le nom de l\'entreprise est obligatoire.');
  else if (S.suppliers.some(s => s.id !== id && norm(s.name) === norm(d.name))) e.push('Un fournisseur porte déjà ce nom.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.push('L\'adresse e-mail n\'est pas valide.');
  if (d.siret && !/^\d{14}$/.test(d.siret.replace(/\s/g, ''))) e.push('Le numéro SIRET doit comporter 14 chiffres.');
  if (d.leadTime !== '' && d.leadTime != null && (isNaN(d.leadTime) || d.leadTime < 0)) e.push('Le délai de livraison doit être un nombre de jours positif.');
  return e;
}
async function saveSupplier(d, id) {
  requireRight('supplier.edit', 'modifier les fournisseurs');
  const errs = validateSupplier(d, id); if (errs.length) throw new Error(errs.join('\n'));
  const base = id ? clone(supplierById(id)) : { id: uid('sup'), status: 'active', createdAt: nowStamp(), demo: !!d.demo };
  const s = { ...base, ...d, name: d.name.trim(), siret: (d.siret || '').replace(/\s/g, ''), leadTime: d.leadTime === '' || d.leadTime == null ? null : Number(d.leadTime), updatedAt: nowStamp() };
  await commit({ put: { suppliers: [s], journal: id ? [] : [journalEntry('supplier', `a ajouté le fournisseur <b>${esc(s.name)}</b>`, { type: 'supplier', id: s.id })] } }, { what: 'supplier' });
  return s;
}
async function setSupplierStatus(id, status) {
  requireRight('supplier.edit', 'archiver un fournisseur');
  await commit({ put: { suppliers: [{ ...clone(supplierById(id)), status }] } }, { what: 'supplier' });
}
async function deleteSupplier(id) {
  requireRight('supplier.edit', 'supprimer un fournisseur');
  const n = S.orders.filter(o => o.supplierId === id).length + S.products.filter(p => p.supplierId === id).length + S.movements.filter(m => m.supplierId === id).length;
  if (n) throw new Error('Suppression impossible : ce fournisseur est lié à des produits, commandes ou mouvements. Archivez-le.');
  await commit({ del: { suppliers: [id] } }, { what: 'supplier' });
}

/* ══════════════════════════════════════════════════════════════
   COMMANDES FOURNISSEURS
   ══════════════════════════════════════════════════════════════ */
const ORDER_STATUS = {
  draft: { label: 'Brouillon', cls: '' },
  validated: { label: 'Validée', cls: 'info' },
  sent: { label: 'Envoyée', cls: 'gold' },
  partial: { label: 'Partiellement réceptionnée', cls: 'warn' },
  received: { label: 'Réceptionnée', cls: 'ok' },
  cancelled: { label: 'Annulée', cls: 'dng' }
};
function orderTotals(o) {
  const ht = round2(sum(o.lines, l => (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)));
  const rate = Number(o.vatRate) || 0;
  const tva = round2(ht * rate / 100);
  return { ht, tva, ttc: round2(ht + tva), rate };
}
const lineRemaining = l => round3(Math.max(0, (Number(l.qty) || 0) - (Number(l.received) || 0)));
function computeOrderStatus(o) {
  if (o.status === 'cancelled' || o.status === 'draft') return o.status;
  const rec = sum(o.lines, l => l.received || 0);
  if (o.closedRemainder || o.lines.every(l => lineRemaining(l) <= 0)) return rec > 0 || o.closedRemainder ? 'received' : o.status;
  if (rec > 0) return 'partial';
  return o.sentAt ? 'sent' : 'validated';
}
const isOrderOpen = o => ['validated', 'sent', 'partial'].includes(o.status);
function isOrderLate(o) { return isOrderOpen(o) && o.expectedDate && o.expectedDate < todayISO(); }

function validateOrder(d) {
  const e = [];
  if (!d.supplierId) e.push('Choisissez un fournisseur.');
  if (!d.lines?.length) e.push('Ajoutez au moins une ligne de produit.');
  d.lines?.forEach((l, i) => {
    if (!l.productId) e.push(`Ligne ${i + 1} : choisissez un produit.`);
    if (!(Number(l.qty) > 0)) e.push(`Ligne ${i + 1} : la quantité doit être positive.`);
    if (isNaN(l.unitPrice) || Number(l.unitPrice) < 0) e.push(`Ligne ${i + 1} : prix unitaire invalide.`);
  });
  const ids = d.lines?.map(l => l.productId).filter(Boolean) || [];
  if (new Set(ids).size !== ids.length) e.push('Un même produit apparaît sur plusieurs lignes : regroupez les quantités.');
  if (isNaN(d.vatRate) || d.vatRate < 0 || d.vatRate > 100) e.push('Taux de TVA invalide.');
  return e;
}
async function saveOrder(d, id) {
  requireRight('order.edit', 'modifier une commande');
  const errs = validateOrder(d); if (errs.length) throw new Error(errs.join('\n'));
  let plan, o;
  if (id) {
    const cur = orderById(id);
    if (cur.status !== 'draft') throw new Error('Seule une commande au statut « Brouillon » peut être modifiée.');
    o = { ...clone(cur), ...d, lines: d.lines.map(l => ({ id: l.id || uid('ol'), productId: l.productId, qty: Number(l.qty), unitPrice: round2(l.unitPrice), received: 0 })), updatedAt: nowStamp() };
    plan = { put: { orders: [o] } };
  } else {
    const { counters, out } = nextNumbers(COUNTERS, 'orders');
    o = {
      id: uid('ord'), number: out[0], supplierId: d.supplierId, createdAt: nowStamp(), expectedDate: d.expectedDate || '',
      lines: d.lines.map(l => ({ id: uid('ol'), productId: l.productId, qty: Number(l.qty), unitPrice: round2(l.unitPrice), received: 0 })),
      vatRate: Number(d.vatRate), paymentTerms: d.paymentTerms || '', comments: d.comments || '',
      status: 'draft', history: [{ at: nowStamp(), status: 'draft', by: SESSION_OP?.name || '' }], receptions: [],
      operatorId: SESSION_OP?.id || null, demo: !!d.demo, fromAlerts: !!d.fromAlerts
    };
    plan = { put: { orders: [o], journal: [journalEntry('order', `a créé la commande <b>${o.number}</b> (${esc(supName(o.supplierId))})`, { type: 'order', id: o.id })] }, kv: { counters } };
  }
  await commit(plan, { what: 'order' });
  return o;
}
async function setOrderStatus(id, status, note = '') {
  requireRight('order.edit', 'changer le statut d\'une commande');
  const cur = orderById(id); if (!cur) throw new Error('Commande introuvable.');
  const allowed = { draft: ['validated', 'cancelled'], validated: ['sent', 'cancelled', 'draft'], sent: ['cancelled'], partial: [], received: [], cancelled: [] };
  if (!(allowed[cur.status] || []).includes(status)) throw new Error(`Passage de « ${ORDER_STATUS[cur.status].label} » à « ${ORDER_STATUS[status].label} » impossible.`);
  if (status === 'cancelled' && sum(cur.lines, l => l.received || 0) > 0) throw new Error('Des quantités ont déjà été reçues : utilisez « Clôturer le reliquat ».');
  const o = clone(cur);
  o.status = status;
  if (status === 'sent') o.sentAt = nowStamp();
  if (status === 'validated') o.validatedAt = nowStamp();
  o.history.push({ at: nowStamp(), status, by: SESSION_OP?.name || '', note });
  await commit({ put: { orders: [o], journal: [journalEntry('order', `a passé la commande <b>${o.number}</b> au statut « ${ORDER_STATUS[status].label} »`, { type: 'order', id })] } }, { what: 'order' });
}
async function closeOrderRemainder(id, note) {
  requireRight('order.edit', 'clôturer une commande');
  const o = clone(orderById(id));
  if (o.status !== 'partial') throw new Error('Seule une commande partiellement réceptionnée peut être clôturée.');
  o.closedRemainder = true; o.status = 'received';
  o.history.push({ at: nowStamp(), status: 'received', by: SESSION_OP?.name || '', note: 'Reliquat abandonné. ' + (note || '') });
  await commit({ put: { orders: [o], journal: [journalEntry('order', `a clôturé le reliquat de la commande <b>${o.number}</b>`, { type: 'order', id })] } }, { what: 'order' });
}
async function deleteOrder(id) {
  requireRight('order.edit', 'supprimer une commande');
  const o = orderById(id);
  if (o.status !== 'draft') throw new Error('Seul un brouillon peut être supprimé. Annulez la commande pour conserver sa trace.');
  await commit({ del: { orders: [id] } }, { what: 'order' });
}

/* Réception (totale ou partielle) : items = [{lineId, qty, locId}]
   Chaque quantité est bornée au reliquat → une même commande ne peut jamais être comptée deux fois. */
async function receiveOrder(id, items, { date, docRef, comment } = {}) {
  requireRight('order.receive', 'réceptionner une commande');
  const cur = orderById(id); if (!cur) throw new Error('Commande introuvable.');
  if (!['validated', 'sent', 'partial'].includes(cur.status)) throw new Error('Cette commande n\'est pas en attente de réception.');
  const o = clone(cur);
  const real = items.filter(it => Number(it.qty) > 0);
  if (!real.length) throw new Error('Saisissez au moins une quantité reçue.');
  const prods = new Map();
  const { counters, out } = nextNumbers(COUNTERS, 'mv', real.length);
  const recId = uid('rec');
  const movements = [];
  real.forEach((it, i) => {
    const line = o.lines.find(l => l.id === it.lineId);
    if (!line) throw new Error('Ligne de commande introuvable.');
    const rem = lineRemaining(line);
    const q = Number(it.qty);
    if (q > rem + 1e-9) throw new Error(`Quantité reçue trop élevée pour « ${productById(line.productId)?.name} » : reliquat de ${fmtNum(rem)}.`);
    if (!it.locId) throw new Error('Choisissez l\'emplacement de rangement.');
    const src = productById(line.productId); if (!src) throw new Error('Un produit de la commande n\'existe plus.');
    const p = prods.get(src.id) || clone(src);
    prods.set(p.id, p);
    const mv = makeMovement(p, {
      type: 'reception', delta: q, locId: it.locId, unitCost: line.unitPrice, supplierId: o.supplierId,
      docRef: docRef || o.number, comment: comment || '', date: date || nowStamp(), orderId: o.id, orderLineId: line.id, receptionId: recId
    }, out[i]);
    movements.push(mv);
    line.received = round3((line.received || 0) + q);
  });
  const prev = o.status;
  o.status = computeOrderStatus(o);
  o.receptions.push({ id: recId, at: nowStamp(), date: date || nowStamp(), docRef: docRef || '', comment: comment || '', by: SESSION_OP?.name || '', items: real.map((it, i) => ({ lineId: it.lineId, qty: Number(it.qty), locId: it.locId, movementId: movements[i].id })) });
  if (prev !== o.status) o.history.push({ at: nowStamp(), status: o.status, by: SESSION_OP?.name || '' });
  const totalQ = sum(real, it => it.qty);
  await commit({
    put: {
      orders: [o], movements, products: [...prods.values()],
      journal: [journalEntry('reception', `a réceptionné ${fmtNum(totalQ)} unité(s) sur la commande <b>${o.number}</b>${o.status === 'partial' ? ' (réception partielle)' : ''}`, { type: 'order', id: o.id })]
    }, kv: { counters }
  }, { what: 'reception' });
  return o;
}

/* ══════════════════════════════════════════════════════════════
   INVENTAIRES
   ══════════════════════════════════════════════════════════════ */
const INV_STATUS = {
  draft: { label: 'Brouillon', cls: '' },
  counting: { label: 'En cours', cls: 'info' },
  review: { label: 'À vérifier', cls: 'warn' },
  validated: { label: 'Validé', cls: 'ok' },
  cancelled: { label: 'Annulé', cls: 'dng' }
};
/* Produits concernés par un périmètre d'inventaire */
function inventoryScopeProducts(scope) {
  const act = S.products.filter(p => p.status === 'active');
  if (scope.type === 'category') return act.filter(p => p.categoryId === scope.value);
  if (scope.type === 'location') return act.filter(p => (p.stock?.[scope.value] || 0) !== 0 || p.locationId === scope.value);
  if (scope.type === 'selection') { const set = new Set(scope.ids || []); return act.filter(p => set.has(p.id)); }
  return act;
}
/* Lignes produit × emplacement */
function buildInventoryLines(scope, ids) {
  const set = new Set(ids);
  const prods = S.products.filter(p => set.has(p.id));
  const lines = [];
  prods.forEach(p => {
    let locs = Object.keys(p.stock || {}).filter(k => p.stock[k] !== 0);
    if (scope.type === 'location') locs = [scope.value];
    if (!locs.length) locs = [p.locationId || S.locations[0]?.id].filter(Boolean);
    locs.forEach(l => lines.push({ id: uid('il'), productId: p.id, locId: l, theoretical: null, counted: null, note: '' }));
  });
  return lines;
}
async function createInventory(d) {
  requireRight('inventory.validate', 'créer un inventaire');
  if (!d.productIds?.length) throw new Error('Sélectionnez au moins un produit.');
  if (!S.locations.length) throw new Error('Créez d\'abord un emplacement de stockage.');
  const { counters, out } = nextNumbers(COUNTERS, 'inventories');
  const inv = {
    id: uid('inv'), number: out[0], name: d.name?.trim() || 'Inventaire ' + fmtDate(todayISO()), scope: d.scope,
    status: 'draft', createdAt: nowStamp(), openedAt: null, reviewAt: null, validatedAt: null,
    lines: buildInventoryLines(d.scope, d.productIds), observations: d.observations || '', attachments: [],
    history: [{ at: nowStamp(), status: 'draft', by: SESSION_OP?.name || '' }], operatorId: SESSION_OP?.id || null, adjustments: [], demo: !!d.demo
  };
  await commit({ put: { inventories: [inv], journal: [journalEntry('inventory', `a créé l'inventaire <b>${inv.number}</b>`, { type: 'inventory', id: inv.id })] }, kv: { counters } }, { what: 'inventory' });
  return inv;
}
/* Ouverture du comptage : on fige le stock théorique à cet instant */
async function startInventory(id) {
  const inv = clone(inventoryById(id));
  if (inv.status !== 'draft') throw new Error('Le comptage est déjà démarré.');
  inv.lines.forEach(l => { const p = productById(l.productId); l.theoretical = round3(p?.stock?.[l.locId] || 0); });
  inv.status = 'counting'; inv.openedAt = nowStamp(); inv.openedSeq = COUNTERS.mv || 0;
  inv.history.push({ at: nowStamp(), status: 'counting', by: SESSION_OP?.name || '' });
  await commit({ put: { inventories: [inv] } }, { what: 'inventory' });
}
/* Enregistrement des comptages : AUCUNE modification du stock ici */
async function saveInventoryCounts(id, lines, observations) {
  const cur = inventoryById(id);
  if (!['counting', 'review'].includes(cur.status)) throw new Error('Cet inventaire n\'est pas en cours de comptage.');
  const inv = clone(cur);
  const byId = new Map(lines.map(l => [l.id, l]));
  inv.lines.forEach(l => {
    const n = byId.get(l.id); if (!n) return;
    if (n.counted !== null && n.counted !== '' && (isNaN(n.counted) || n.counted < 0)) throw new Error('Les quantités comptées doivent être des nombres positifs.');
    l.counted = n.counted === '' || n.counted === null ? null : round3(n.counted);
    l.note = n.note || '';
  });
  if (observations !== undefined) inv.observations = observations;
  await commit({ put: { inventories: [inv] } }, { what: 'inventory', silent: true });
  return inv;
}
async function setInventoryStatus(id, status) {
  const inv = clone(inventoryById(id));
  const allowed = { counting: ['review', 'cancelled'], review: ['counting', 'cancelled'], draft: ['cancelled'] };
  if (!(allowed[inv.status] || []).includes(status)) throw new Error('Changement de statut impossible.');
  if (status === 'cancelled') requireRight('inventory.validate', 'annuler un inventaire');
  inv.status = status; if (status === 'review') inv.reviewAt = nowStamp();
  inv.history.push({ at: nowStamp(), status, by: SESSION_OP?.name || '' });
  await commit({ put: { inventories: [inv], journal: [journalEntry('inventory', `a passé l'inventaire <b>${inv.number}</b> au statut « ${INV_STATUS[status].label} »`, { type: 'inventory', id })] } }, { what: 'inventory' });
}
async function addInventoryAttachment(id, file) {
  const inv = clone(inventoryById(id));
  const mid = uid('media');
  inv.attachments = inv.attachments || [];
  inv.attachments.push({ id: mid, name: file.name, type: file.type, size: file.size, at: nowStamp() });
  await commit({ put: { media: [{ id: mid, blob: file, type: file.type, name: file.name, at: nowStamp(), demo: !!inv.demo }], inventories: [inv] } }, { what: 'inventory' });
}
/* Mouvements survenus sur les produits de l'inventaire depuis l'ouverture du comptage */
function movementsSinceOpening(inv) {
  const ids = new Set(inv.lines.map(l => l.productId));
  return S.movements.filter(m => m.seq > (inv.openedSeq || 0) && ids.has(m.productId) && m.inventoryId !== inv.id);
}
/* Validation : génère les mouvements de régularisation (écart = compté − théorique) */
async function validateInventory(id) {
  requireRight('inventory.validate', 'valider un inventaire');
  const cur = inventoryById(id);
  if (cur.status !== 'review') throw new Error('Passez d\'abord l\'inventaire au statut « À vérifier ».');
  const inv = clone(cur);
  const diffs = inv.lines.filter(l => l.counted !== null && Math.abs(l.counted - l.theoretical) > 1e-9);
  const prods = new Map();
  const { counters, out } = nextNumbers(COUNTERS, 'mv', diffs.length);
  const movements = diffs.map((l, i) => {
    const src = productById(l.productId); if (!src) throw new Error('Un produit de l\'inventaire n\'existe plus.');
    const p = prods.get(src.id) || clone(src); prods.set(p.id, p);
    const delta = round3(l.counted - l.theoretical);
    return makeMovement(p, { type: 'inventory', delta, locId: l.locId, inventoryId: inv.id, docRef: inv.number, reason: delta > 0 ? 'Écart positif' : 'Écart négatif', comment: l.note || '', allowNegative: true }, out[i]);
  });
  inv.status = 'validated'; inv.validatedAt = nowStamp(); inv.validatedBy = SESSION_OP?.name || '';
  inv.adjustments = movements.map(m => m.id);
  inv.history.push({ at: nowStamp(), status: 'validated', by: SESSION_OP?.name || '' });
  await commit({
    put: {
      inventories: [inv], movements, products: [...prods.values()],
      journal: [journalEntry('inventory', `a validé l'inventaire <b>${inv.number}</b> : ${movements.length} régularisation(s)`, { type: 'inventory', id })]
    }, kv: movements.length ? { counters } : {}
  }, { what: 'inventory' });
  return inv;
}

/* ══════════════════════════════════════════════════════════════
   RÉGLAGES, OPÉRATEURS
   ══════════════════════════════════════════════════════════════ */
async function saveSettings(patch) {
  const s = { ...SETTINGS, ...patch };
  await commit({ kv: { settings: s } }, { what: 'settings' });
}
async function saveOperators(list) { await commit({ kv: { operators: list } }, { what: 'operators' }); }
