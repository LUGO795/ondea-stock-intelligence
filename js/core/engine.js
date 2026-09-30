/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — engine.js
   Calculs « intelligents » à partir des données RÉELLEMENT enregistrées :
     • consommation moyenne, couverture de stock, point de commande ;
     • quantité de réapprovisionnement recommandée ;
     • alertes (ruptures, seuils, surstock, dormants, hausses, retards) ;
     • statistiques et séries pour les graphiques.

   IMPORTANT : aucune intelligence artificielle externe n'est utilisée.
   Ce sont des règles métier et des moyennes statistiques transparentes,
   détaillées à l'écran (bouton « Comment est-ce calculé ? »).
   Les résultats sont mis en cache et recalculés uniquement quand les
   données changent (variable VERSION de store.js).
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* Mouvements « valides » : ni annulés, ni annulations */
const isLive = m => !m.cancelledById && m.type !== 'cancel';
const isConsumption = m => m.type === 'out' && isLive(m);
const isSupply = m => (m.type === 'in' || m.type === 'reception') && isLive(m);
const mvDay = m => dayOf(m.date || m.at);

/* ---------- Cache ---------- */
let _anaCache = { v: -1, data: null };

/* Analyse par produit (consommation, couverture, réapprovisionnement) */
function analytics() {
  if (_anaCache.v === VERSION) return _anaCache.data;
  const today = todayISO();
  const N = Math.max(7, Number(SETTINGS.analysisDays) || 90);
  const winStart = addDays(today, -N + 1);
  const d30 = addDays(today, -29), d60 = addDays(today, -59);
  const per = new Map();
  S.products.forEach(p => per.set(p.id, { cons: 0, consCost: 0, last30: 0, prev30: 0, lastMove: null, lastOut: null, nOut: 0, ruptures: 0 }));
  for (const m of S.movements) {
    const a = per.get(m.productId); if (!a) continue;
    const day = mvDay(m);
    if (m.type !== 'cancel' && (!a.lastMove || day > a.lastMove)) a.lastMove = day;
    if (isConsumption(m)) {
      if (!a.lastOut || day > a.lastOut) a.lastOut = day;
      if (day >= winStart) { a.cons += m.qty; a.consCost += m.value; a.nOut++; }
      if (day >= d30) a.last30 += m.qty; else if (day >= d60) a.prev30 += m.qty;
    }
    if (m.qtyBefore > 0 && m.qtyAfter <= 0 && m.type !== 'transfer') a.ruptures++;
  }
  /* Quantités déjà commandées et non reçues */
  const onOrder = new Map();
  S.orders.filter(isOrderOpen).forEach(o => o.lines.forEach(l => onOrder.set(l.productId, (onOrder.get(l.productId) || 0) + lineRemaining(l))));

  const res = new Map();
  S.products.forEach(p => {
    const a = per.get(p.id);
    const created = dayOf(p.createdAt) || winStart;
    const start = created > winStart ? created : winStart;
    /* Au moins 14 jours au dénominateur : évite d'extrapoler un historique trop court */
    const days = Math.max(14, daysBetween(start, today) + 1);
    const avgDaily = a.cons / days;
    const lowData = daysBetween(start, today) + 1 < 14 || a.nOut < 2;
    const sup = supplierById(p.supplierId);
    const leadTime = sup && sup.leadTime != null ? Number(sup.leadTime) : Number(SETTINGS.defaultLeadTime) || 7;
    const qty = productQty(p), avail = productAvailable(p);
    const oo = round3(onOrder.get(p.id) || 0);
    const min = Number(p.minStock) || 0, max = Number(p.maxStock) || 0;
    const reorderPoint = Math.ceil(avgDaily * leadTime + min);
    const coverDays = Number(SETTINGS.coverDays) || 30;
    let target = max > 0 ? max : Math.ceil(reorderPoint + avgDaily * coverDays);
    if (target < reorderPoint) target = reorderPoint;
    const projected = round3(avail + oo);
    let recommended = 0;
    if (reorderPoint > 0 && projected <= reorderPoint) recommended = Math.max(0, Math.ceil(target - projected));
    if (recommended === 0 && qty <= 0 && oo <= 0 && (min > 0 || a.cons > 0)) recommended = Math.max(1, Math.ceil(target));
    /* Lot de commande imposé : on arrondit au multiple supérieur */
    const lot = Number(p.reorderQty) || 0;
    if (recommended > 0 && lot > 0) recommended = Math.ceil(recommended / lot) * lot;
    const daysCover = avgDaily > 0 ? avail / avgDaily : null;
    res.set(p.id, {
      avgDaily, consWindow: a.cons, consCost: a.consCost, windowDays: days, lowData, leadTime, onOrder: oo,
      reorderPoint, target, projected, recommended, daysCover, lastMove: a.lastMove, lastOut: a.lastOut,
      last30: a.last30, prev30: a.prev30, ruptures: a.ruptures, qty, avail
    });
  });
  _anaCache = { v: VERSION, data: res };
  return res;
}
const anaOf = id => analytics().get(id);

/* Niveau de stock d'un produit (utilisé pour les filtres et les pastilles) */
function stockLevel(p) {
  const q = productQty(p), min = Number(p.minStock) || 0, max = Number(p.maxStock) || 0;
  if (q <= 0) return 'rupture';
  if (min > 0 && q <= min) return 'low';
  if (min > 0 && q <= min * (1 + (Number(SETTINGS.nearPct) || 20) / 100)) return 'near';
  if (max > 0 && q > max) return 'over';
  return 'ok';
}
const LEVEL = {
  rupture: { label: 'Rupture', cls: 'dng', icon: 'x' },
  low: { label: 'Stock faible', cls: 'warn', icon: 'warn' },
  near: { label: 'Proche du seuil', cls: 'gold', icon: 'clock' },
  over: { label: 'Surstock', cls: 'info', icon: 'layers' },
  ok: { label: 'Stock correct', cls: 'ok', icon: 'check' }
};
function levelChip(p) { const l = LEVEL[stockLevel(p)]; return `<span class="chip ${l.cls}">${svg(l.icon)}${l.label}</span>`; }

/* ══════════════════════════════════════════════════════════════
   ALERTES
   ══════════════════════════════════════════════════════════════ */
const ALERT_TYPES = {
  rupture: { label: 'Rupture totale', prio: 4, icon: 'x' },
  orderLate: { label: 'Commande en retard', prio: 3, icon: 'truck' },
  low: { label: 'Sous le seuil minimal', prio: 3, icon: 'warn' },
  near: { label: 'Proche du seuil minimal', prio: 2, icon: 'clock' },
  reorder: { label: 'À réapprovisionner prochainement', prio: 2, icon: 'cart' },
  spike: { label: 'Consommation en forte hausse', prio: 2, icon: 'trend' },
  over: { label: 'Au-dessus du maximum', prio: 1, icon: 'layers' },
  dormant: { label: 'Sans mouvement', prio: 1, icon: 'archive' }
};
const PRIO = { 4: { label: 'Critique', cls: 'dng' }, 3: { label: 'Haute', cls: 'warn' }, 2: { label: 'Moyenne', cls: 'gold' }, 1: { label: 'Basse', cls: 'info' } };

let _alertCache = { v: -1, list: [] };
/* Calcule la liste des alertes actives (sans date de détection) */
function computeAlerts() {
  if (_alertCache.v === VERSION) return _alertCache.list;
  const out = [];
  const today = todayISO();
  const ana = analytics();
  S.products.filter(p => p.status === 'active').forEach(p => {
    const a = ana.get(p.id); const q = a.qty; const min = Number(p.minStock) || 0; const max = Number(p.maxStock) || 0;
    const lvl = stockLevel(p);
    const orderHint = a.onOrder > 0 ? ` ${fmtNum(a.onOrder)} ${p.unit} déjà en commande.` : '';
    if (lvl === 'rupture') out.push({ key: 'rupture:' + p.id, type: 'rupture', productId: p.id, qty: q, threshold: min, action: a.onOrder > 0 ? `Relancer la commande en cours (${fmtNum(a.onOrder)} ${p.unit} attendus).` : `Commander ${fmtNum(a.recommended || Math.max(min, 1))} ${p.unit} en urgence.`, cmd: a.onOrder > 0 ? 'orders' : 'order' });
    else if (lvl === 'low') out.push({ key: 'low:' + p.id, type: 'low', productId: p.id, qty: q, threshold: min, action: a.recommended > 0 ? `Commander ${fmtNum(a.recommended)} ${p.unit}.${orderHint}` : `Stock couvert par les commandes en cours.${orderHint}`, cmd: a.recommended > 0 ? 'order' : 'orders' });
    else if (lvl === 'near') out.push({ key: 'near:' + p.id, type: 'near', productId: p.id, qty: q, threshold: min, action: a.recommended > 0 ? `Prévoir une commande de ${fmtNum(a.recommended)} ${p.unit}.` : 'Surveiller les prochaines sorties.', cmd: a.recommended > 0 ? 'order' : 'product' });
    if (lvl !== 'rupture' && lvl !== 'low' && lvl !== 'near' && a.recommended > 0) {
      out.push({ key: 'reorder:' + p.id, type: 'reorder', productId: p.id, qty: q, threshold: a.reorderPoint, action: `Commander ${fmtNum(a.recommended)} ${p.unit} (point de commande ${fmtNum(a.reorderPoint)} atteint${a.daysCover != null ? ', couverture ≈ ' + Math.floor(a.daysCover) + ' j' : ''}).`, cmd: 'order' });
    }
    if (max > 0 && q > max) out.push({ key: 'over:' + p.id, type: 'over', productId: p.id, qty: q, threshold: max, action: `Réduire les prochains achats : ${fmtNum(round3(q - max))} ${p.unit} au-dessus du maximum.`, cmd: 'product' });
    const dd = Number(SETTINGS.dormantDays) || 60;
    const since = a.lastMove || dayOf(p.createdAt);
    if (q > 0 && since && daysBetween(since, today) >= dd && daysBetween(dayOf(p.createdAt), today) >= dd) {
      out.push({ key: 'dormant:' + p.id, type: 'dormant', productId: p.id, qty: q, threshold: dd, action: `Aucun mouvement depuis ${daysBetween(since, today)} jours : vérifier l'utilité de ce stock (${fmtMoney(productValue(p))} immobilisés).`, cmd: 'product' });
    }
    /* Hausse de consommation : seulement si les deux périodes ont assez de données */
    const ratio = Number(SETTINGS.spikeRatio) || 1.5, minQ = Number(SETTINGS.spikeMinQty) || 5;
    if (a.prev30 >= minQ && a.last30 >= a.prev30 * ratio) {
      out.push({ key: 'spike:' + p.id, type: 'spike', productId: p.id, qty: q, threshold: a.prev30, action: `Consommation des 30 derniers jours : ${fmtNum(a.last30)} contre ${fmtNum(a.prev30)} les 30 jours précédents (×${(a.last30 / a.prev30).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}). Revoir le seuil minimal.`, cmd: 'product' });
    }
  });
  S.orders.filter(isOrderLate).forEach(o => {
    const late = daysBetween(o.expectedDate, today);
    out.push({ key: 'orderLate:' + o.id, type: 'orderLate', orderId: o.id, qty: sum(o.lines, lineRemaining), threshold: null, action: `Relancer ${supName(o.supplierId)} : livraison prévue le ${fmtDate(o.expectedDate)} (${late} j de retard).`, cmd: 'orderView' });
  });
  out.forEach(a => { a.prio = ALERT_TYPES[a.type].prio; });
  out.sort((a, b) => b.prio - a.prio || (a.qty - b.qty));
  _alertCache = { v: VERSION, list: out };
  return out;
}
/* Alertes avec leur date de détection (mémorisée dans ALERT_SEEN) */
function activeAlerts() {
  return computeAlerts().map(a => ({ ...a, detectedAt: ALERT_SEEN[a.key] || nowStamp() }));
}
/* Synchronise les dates de détection et journalise les nouvelles alertes importantes.
   Appelée après chaque modification ; n'écrit que si quelque chose a changé. */
let _syncing = false;
async function syncAlertSeen() {
  if (_syncing) return; _syncing = true;
  try {
    const list = computeAlerts();
    const keys = new Set(list.map(a => a.key));
    const next = {}; let changed = false; const journal = [];
    list.forEach(a => {
      if (ALERT_SEEN[a.key]) next[a.key] = ALERT_SEEN[a.key];
      else {
        next[a.key] = nowStamp(); changed = true;
        if (a.prio >= 3 && a.productId) {
          const p = productById(a.productId);
          journal.push(journalEntry('alert', `Alerte « ${ALERT_TYPES[a.type].label} » : <b>${esc(p?.name || '')}</b> (${fmtNum(a.qty)} ${esc(p?.unit || '')})`, { type: 'product', id: a.productId }, { system: true, operatorName: 'Système' }));
        }
      }
    });
    Object.keys(ALERT_SEEN).forEach(k => { if (!keys.has(k)) changed = true; });
    if (changed) await commit({ kv: { alertSeen: next }, put: journal.length ? { journal } : {} }, { what: 'alerts' });
  } catch (e) { console.warn('[Ondea Stock] synchronisation des alertes', e); }
  finally { _syncing = false; }
}

/* ══════════════════════════════════════════════════════════════
   STATISTIQUES
   ══════════════════════════════════════════════════════════════ */
/* Période : {from, to} en AAAA-MM-JJ */
function periodFromKey(key, custom = {}) {
  const t = todayISO();
  if (key === '7') return { from: addDays(t, -6), to: t, label: '7 derniers jours' };
  if (key === '30') return { from: addDays(t, -29), to: t, label: '30 derniers jours' };
  if (key === '90') return { from: addDays(t, -89), to: t, label: '90 derniers jours' };
  if (key === 'year') return { from: t.slice(0, 4) + '-01-01', to: t, label: 'Année ' + t.slice(0, 4) };
  if (key === 'custom' && custom.from && custom.to) {
    const [a, b] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
    return { from: a, to: b, label: `Du ${fmtDate(a)} au ${fmtDate(b)}` };
  }
  return { from: addDays(t, -29), to: t, label: '30 derniers jours' };
}
const inPeriod = (m, P) => { const d = mvDay(m); return d >= P.from && d <= P.to; };

/* Regroupement automatique : jour (≤ 31 j), semaine (≤ 190 j), mois au-delà */
function bucketsFor(P, forced) {
  const days = daysBetween(P.from, P.to) + 1;
  const mode = forced || (days <= 31 ? 'day' : days <= 190 ? 'week' : 'month');
  const out = [];
  if (mode === 'day') {
    for (let d = P.from; d <= P.to; d = addDays(d, 1)) out.push({ from: d, to: d, label: fmtDayShort(d) });
  } else if (mode === 'week') {
    let d = P.from;
    while (d <= P.to) { const e = addDays(d, 6) > P.to ? P.to : addDays(d, 6); out.push({ from: d, to: e, label: 'Sem. ' + fmtDayShort(d) }); d = addDays(e, 1); }
  } else {
    let d = P.from;
    while (d <= P.to) {
      const dt = new Date(d + 'T12:00:00');
      const end = localISO(new Date(dt.getFullYear(), dt.getMonth() + 1, 0));
      const e = end > P.to ? P.to : end;
      out.push({ from: d, to: e, label: dt.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) });
      d = addDays(e, 1);
    }
  }
  return { mode, buckets: out };
}
function bucketIndex(buckets, day) {
  let lo = 0, hi = buckets.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (day < buckets[mid].from) hi = mid - 1; else if (day > buckets[mid].to) lo = mid + 1; else return mid; }
  return -1;
}

/* Entrées / sorties par période (quantités et valeurs) */
function flowSeries(P, filter = () => true, forced) {
  const { mode, buckets } = bucketsFor(P, forced);
  const inQ = buckets.map(() => 0), outQ = buckets.map(() => 0), inV = buckets.map(() => 0), outV = buckets.map(() => 0);
  for (const m of S.movements) {
    if (!isLive(m) || !filter(m)) continue;
    const i = bucketIndex(buckets, mvDay(m)); if (i < 0) continue;
    if (isSupply(m)) { inQ[i] += m.qty; inV[i] += m.value; }
    else if (m.type === 'out') { outQ[i] += m.qty; outV[i] += m.value; }
  }
  return { mode, buckets, inQ, outQ, inV: inV.map(round2), outV: outV.map(round2) };
}

/* Évolution de la valeur du stock : on part de la valeur actuelle et on
   « remonte le temps » en retirant l'effet de chaque mouvement postérieur.
   Limite documentée : une modification manuelle du prix d'achat n'est pas rétroactive. */
function stockValueSeries(P) {
  const { mode, buckets } = bucketsFor(P);
  let current = sum(S.products, p => productQty(p) * (Number(p.purchasePrice) || 0));
  const effects = new Map();   // jour → variation de valeur ce jour-là
  for (const m of S.movements) { if (m.type === 'transfer') continue; const d = mvDay(m); effects.set(d, (effects.get(d) || 0) + (m.valueDelta || 0)); }
  const days = [...effects.keys()].sort();
  /* valeur à la fin du jour X = valeur actuelle − Σ effets des jours > X */
  const valueAtEnd = (x) => { let v = current; for (let i = days.length - 1; i >= 0 && days[i] > x; i--) v -= effects.get(days[i]); return v; };
  const values = buckets.map(b => round2(Math.max(0, valueAtEnd(b.to))));
  return { mode, buckets, values };
}

/* Consommation par produit sur la période */
function consumptionByProduct(P, filter = () => true) {
  const map = new Map();
  for (const m of S.movements) {
    if (!isConsumption(m) || !inPeriod(m, P) || !filter(m)) continue;
    const r = map.get(m.productId) || { productId: m.productId, qty: 0, value: 0, n: 0 };
    r.qty += m.qty; r.value += m.value; r.n++; map.set(m.productId, r);
  }
  return [...map.values()].map(r => ({ ...r, qty: round3(r.qty), value: round2(r.value) })).sort((a, b) => b.value - a.value);
}
function consumptionByCategory(P) {
  const map = new Map();
  consumptionByProduct(P).forEach(r => {
    const c = productById(r.productId)?.categoryId || null;
    const x = map.get(c) || { categoryId: c, qty: 0, value: 0 }; x.qty += r.qty; x.value += r.value; map.set(c, x);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}
function consumptionByReason(P) {
  const map = new Map();
  for (const m of S.movements) { if (!isConsumption(m) || !inPeriod(m, P)) continue; const k = m.reason || 'Autre'; const x = map.get(k) || { reason: k, qty: 0, value: 0 }; x.qty += m.qty; x.value += m.value; map.set(k, x); }
  return [...map.values()].sort((a, b) => b.value - a.value);
}
/* Répartition de la valeur actuelle du stock par catégorie */
function stockByCategory() {
  const map = new Map();
  S.products.filter(p => p.status === 'active').forEach(p => {
    const k = p.categoryId || null; const x = map.get(k) || { categoryId: k, value: 0, qty: 0, refs: 0 };
    x.value += productValue(p); x.qty += Math.max(0, productQty(p)); x.refs++; map.set(k, x);
  });
  return [...map.values()].map(x => ({ ...x, value: round2(x.value) })).sort((a, b) => b.value - a.value);
}
/* Ruptures (passage d'un stock positif à zéro ou moins) sur la période */
function rupturesByProduct(P) {
  const map = new Map();
  for (const m of S.movements) {
    if (m.type === 'transfer' || !(m.qtyBefore > 0 && m.qtyAfter <= 0) || !inPeriod(m, P)) continue;
    map.set(m.productId, (map.get(m.productId) || 0) + 1);
  }
  return [...map.entries()].map(([productId, n]) => ({ productId, n })).sort((a, b) => b.n - a.n);
}
/* Synthèse d'une période (utilisée pour la comparaison de deux périodes) */
function periodSummary(P) {
  let inV = 0, outV = 0, inQ = 0, outQ = 0, nIn = 0, nOut = 0, nMv = 0, spend = 0;
  for (const m of S.movements) {
    if (!isLive(m) || !inPeriod(m, P)) continue;
    nMv++;
    if (isSupply(m)) { inV += m.value; inQ += m.qty; nIn++; spend += m.value; }
    else if (m.type === 'out') { outV += m.value; outQ += m.qty; nOut++; }
  }
  const vs = stockValueSeries(P);
  const avgValue = vs.values.length ? sum(vs.values) / vs.values.length : 0;
  const days = daysBetween(P.from, P.to) + 1;
  /* Rotation = coût des sorties / valeur moyenne du stock (uniquement si données suffisantes) */
  const rotation = avgValue > 0 && outV > 0 ? outV / avgValue : null;
  const storageDays = rotation ? days / rotation : null;
  const ruptures = sum(rupturesByProduct(P), r => r.n);
  return { P, days, inV: round2(inV), outV: round2(outV), inQ: round3(inQ), outQ: round3(outQ), nIn, nOut, nMv, spend: round2(spend), avgValue: round2(avgValue), rotation, storageDays, ruptures, endValue: vs.values[vs.values.length - 1] || 0 };
}
/* Évolution des prix d'achat : un point par entrée ou réception */
function priceHistory(productId) {
  return S.movements.filter(m => m.productId === productId && isSupply(m) && m.unitCost > 0).map(m => ({ day: mvDay(m), price: m.unitCost, qty: m.qty, number: m.number }));
}
function priceChanges(P) {
  /* Un seul passage sur l'historique (performant avec des milliers de références) */
  const hist = new Map();
  for (const m of S.movements) {
    if (!isSupply(m) || !(m.unitCost > 0)) continue;
    const day = mvDay(m); if (day > P.to) continue;
    if (!hist.has(m.productId)) hist.set(m.productId, []);
    hist.get(m.productId).push({ day, price: m.unitCost });
  }
  const out = [];
  hist.forEach((h, productId) => {
    if (h.length < 2) return;
    const inside = h.filter(x => x.day >= P.from);
    if (!inside.length) return;
    const before = h.filter(x => x.day < P.from);
    const first = before.length ? before[before.length - 1] : inside[0];
    const last = inside[inside.length - 1];
    if (first === last) return;
    const pct = first.price > 0 ? (last.price - first.price) / first.price * 100 : null;
    out.push({ productId, first: first.price, last: last.price, pct, n: inside.length });
  });
  return out.sort((a, b) => Math.abs(b.pct || 0) - Math.abs(a.pct || 0));
}
/* Produits à faible rotation : en stock mais peu ou pas consommés sur la période */
function slowMovers(P) {
  const cons = new Map(consumptionByProduct(P).map(r => [r.productId, r]));
  return S.products.filter(p => p.status === 'active' && productQty(p) > 0).map(p => {
    const c = cons.get(p.id); const q = productQty(p);
    return { productId: p.id, qty: q, value: productValue(p), cons: c ? c.qty : 0, ratio: c ? c.qty / q : 0 };
  }).filter(x => x.ratio < 0.25).sort((a, b) => a.ratio - b.ratio || b.value - a.value);
}
/* Historique des réapprovisionnements (réceptions et entrées) */
function supplyHistory(P) {
  return S.movements.filter(m => isSupply(m) && inPeriod(m, P)).slice().reverse();
}

/* ══════════════════════════════════════════════════════════════
   INDICATEURS DU TABLEAU DE BORD
   ══════════════════════════════════════════════════════════════ */
function dashboardKpis(P) {
  const act = S.products.filter(p => p.status === 'active');
  const today = todayISO();
  let units = 0, value = 0, low = 0, rupt = 0;
  act.forEach(p => { const q = productQty(p); units += Math.max(0, q); value += productValue(p); const l = stockLevel(p); if (l === 'rupture') rupt++; else if (l === 'low') low++; });
  const pendingOrders = S.orders.filter(isOrderOpen).length;
  const todayMv = S.movements.filter(m => mvDay(m) === today && m.type !== 'cancel').length;
  const sm = periodSummary(P);
  return { refs: act.length, archived: S.products.length - act.length, units: round3(units), value: round2(value), low, rupt, pendingOrders, todayMv, inV: sm.inV, outV: sm.outV, P };
}
