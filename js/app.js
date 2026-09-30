/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — app.js
   Démarrage de l'application :
     • écran d'accueil (première utilisation guidée / choix de l'opérateur) ;
     • structure (barre latérale, barre supérieure) identique à la référence ;
     • routeur SPA (#/produits, #/mouvements…) sans rechargement ;
     • thème clair/sombre, contraste élevé, taille du texte, pause des
       animations, horloge, bouton « retour en haut », recherche globale.
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* ---------- Préférences d'affichage (localStorage, comme la référence) ---------- */
const PREF = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
};

/* ══════════════ THÈME (même mécanisme que Ondea Staff Manager) ══════════════ */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  PREF.set('ondea_theme', t);
  const next = t === 'dark' ? 'light' : 'dark';
  const icon = t === 'dark' ? 'sun' : 'moon';
  const lbl = next === 'light' ? 'Passer au thème clair' : 'Passer au thème sombre';
  ['#themeBtn', '#loginThemeBtn'].forEach(s => { const b = $(s); if (b) { b.innerHTML = svg(icon); b.setAttribute('aria-label', lbl); b.title = lbl; } });
}
function toggleTheme() { applyTheme((document.documentElement.dataset.theme || 'dark') === 'dark' ? 'light' : 'dark'); }

/* Contraste élevé (bascule mémorisée) */
function applyContrast(on) {
  document.documentElement.setAttribute('data-contrast', on ? 'high' : 'normal');
  const b = $('#contrastBtn');
  if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); b.title = on ? 'Contraste élevé : activé (cliquer pour revenir à la normale)' : 'Contraste élevé'; }
  PREF.set('ondea_contrast', on ? 'high' : 'normal');
}
/* Taille du texte : agit sur la taille racine (toute l'interface est en rem) */
const TEXT_SIZES = [100, 112, 125, 140];
function applyTextSize(pct, announce) {
  document.documentElement.style.fontSize = pct === 100 ? '' : pct + '%';
  PREF.set('ondea_stock_textsize', pct);
  const b = $('#textSizeBtn');
  if (b) { b.setAttribute('aria-label', `Taille du texte : ${pct} % (cliquer pour agrandir)`); b.title = `Taille du texte : ${pct} %`; b.classList.toggle('on', pct !== 100); }
  if (announce) toast(`Taille du texte : ${pct} %`, 'info', 1800);
}
/* Pause des icônes d'arrière-plan */
let BG_PAUSED = false;
function applyBgPause(p) {
  BG_PAUSED = p;
  $('#ondeaBgIcons')?.classList.toggle('is-paused', p);
  const b = $('#bgPauseBtn');
  if (b) { b.classList.toggle('on', p); b.setAttribute('aria-pressed', p ? 'true' : 'false'); b.title = p ? "Animations d'arrière-plan : en pause (cliquer pour reprendre)" : "Mettre en pause les animations d'arrière-plan"; }
  PREF.set('ondea_bg_icons', p ? 'paused' : 'running');
}

/* ══════════════ ÉCRAN D'ACCUEIL ══════════════ */
function renderWelcome() {
  const body = $('#loginBody');
  if (!OPERATORS.length) return renderOnboarding(body);
  $('#loginTitle').innerHTML = 'Ondea <span class="gold">Stock</span>';
  $('#loginSub').textContent = (SETTINGS.companyName ? SETTINGS.companyName + ' · ' : '') + 'La gestion intelligente de vos stocks, simplement.';
  const ops = OPERATORS.filter(o => o.active !== false);
  body.innerHTML = `
    <div id="loginErr" class="login-err hide" role="alert"></div>
    <div class="demo-accts" style="margin-top:0;border-top:none;padding-top:0">
      <div class="lbl" id="opLbl">Qui êtes-vous ?</div>
      <div id="demoList" role="group" aria-labelledby="opLbl">
        ${ops.map(o => `<button class="demo-btn" type="button" data-op="${o.id}"><div class="av sm" aria-hidden="true">${esc(initialsOf(o.name))}</div>
          <div><div style="font-weight:700;font-size:.9rem">${esc(o.name)}</div><small>${esc(ROLE_LABEL[o.role] || '')}${o.pin ? ' · code PIN' : ''}</small></div></button>`).join('')}
      </div>
    </div>
    <div class="field hide" id="pinField" style="margin-top:14px"><label for="liPin">Code PIN de <span id="pinName"></span></label>
      <div class="pw-wrap"><input class="inp" id="liPin" type="password" inputmode="numeric" autocomplete="off" placeholder="••••" maxlength="8"></div></div>
    <button class="btn gold hide" id="loginBtn" type="button" style="width:100%;margin-top:6px;padding:12px">Ouvrir la session</button>
    <p class="muted" style="font-size:.78rem;margin-top:16px;line-height:1.5">${svg('shield', 'inl')} Données enregistrées uniquement dans ce navigateur (${IDB.persistent ? 'IndexedDB' : '<b>mémoire temporaire</b>'}). Pensez aux sauvegardes régulières.</p>`;
  let pending = null;
  $$('#demoList .demo-btn', body).forEach(b => b.onclick = () => {
    const op = OPERATORS.find(o => o.id === b.dataset.op);
    if (op.pin) { pending = op; $('#pinName').textContent = op.name; $('#pinField').classList.remove('hide'); $('#loginBtn').classList.remove('hide'); $('#liPin').value = ''; $('#liPin').focus(); }
    else openSession(op);
  });
  const tryPin = () => {
    if (!pending) return;
    if ($('#liPin').value === pending.pin) openSession(pending);
    else { const e = $('#loginErr'); e.textContent = 'Code PIN incorrect.'; e.classList.remove('hide'); $('#liPin').select(); }
  };
  $('#loginBtn').onclick = tryPin;
  $('#liPin').onkeydown = e => { if (e.key === 'Enter') tryPin(); };
}

/* Première utilisation : création de l'espace + choix données vides / démonstration */
function renderOnboarding(body) {
  $('#loginTitle').innerHTML = 'Bienvenue dans <span class="gold">Ondea Stock</span>';
  $('#loginSub').textContent = 'Première utilisation : créons votre espace en 30 secondes.';
  body.innerHTML = `
    <div id="loginErr" class="login-err hide" role="alert"></div>
    <ol class="steps" aria-label="Étapes de démarrage"><li class="on">Votre entreprise</li><li>Votre profil</li><li>Vos données</li></ol>
    <div class="field"><label for="obCompany">Nom de votre entreprise <span class="req" aria-hidden="true">*</span></label><input class="inp" id="obCompany" autocomplete="organization" placeholder="Ex. Atelier Dupont"></div>
    <div class="grid-2">
      <div class="field"><label for="obName">Votre prénom et nom <span class="req" aria-hidden="true">*</span></label><input class="inp" id="obName" autocomplete="name" placeholder="Ex. Claire Martin"></div>
      <div class="field"><label for="obPin">Code PIN (facultatif)</label><input class="inp" id="obPin" type="password" inputmode="numeric" maxlength="8" placeholder="4 à 8 chiffres" aria-describedby="obPinH"><span class="hint" id="obPinH">Protège l'accès à votre profil sur ce poste.</span></div>
    </div>
    <div class="field"><label for="obLoc">Premier emplacement de stockage</label><input class="inp" id="obLoc" value="Réserve principale"></div>
    <div class="ob-choice" role="group" aria-label="Comment voulez-vous démarrer ?">
      <button class="btn gold" type="button" id="obEmpty">${svg('play')} Démarrer avec une base vide</button>
      <button class="btn" type="button" id="obDemo">${svg('zap')} Explorer avec des données de démonstration</button>
    </div>
    <p class="muted" style="font-size:.78rem;margin-top:14px;line-height:1.5">Les données de démonstration sont clairement identifiées et pourront être supprimées en un clic (Paramètres), sans toucher à vos propres données.
      Vous avez déjà une sauvegarde ? <label class="link-btn" style="cursor:pointer">Restaurer un fichier JSON<input type="file" id="obRestore" accept="application/json,.json" hidden></label></p>`;
  const go = async (demo, btn) => guard(btn, async () => {
    const company = val(body, 'obCompany'), name = val(body, 'obName'), pin = val(body, 'obPin');
    const err = $('#loginErr');
    const errs = [];
    if (!company) errs.push('Indiquez le nom de votre entreprise.');
    if (!name) errs.push('Indiquez votre prénom et votre nom.');
    if (pin && !/^\d{4,8}$/.test(pin)) errs.push('Le code PIN doit contenir 4 à 8 chiffres.');
    if (errs.length) { err.innerHTML = errs.map(esc).join('<br>'); err.classList.remove('hide'); markInvalid(body, [!company && 'obCompany', !name && 'obName', pin && !/^\d{4,8}$/.test(pin) && 'obPin'].filter(Boolean)); return; }
    const op = { id: uid('op'), name, role: 'admin', pin: pin || '', active: true, createdAt: nowStamp() };
    const loc = { id: uid('loc'), name: val(body, 'obLoc') || 'Réserve principale', site: '', description: 'Créé au démarrage', createdAt: nowStamp(), demo: false };
    await commit({ put: { locations: [loc] }, kv: { operators: [op], settings: { ...SETTINGS, companyName: company, createdAt: nowStamp() } } }, { what: 'setup' });
    SESSION_OP = op;
    if (demo) { await loadDemoData(); }
    IDB.persist();
    openSession(op, true);
  });
  $('#obEmpty').onclick = e => go(false, e.currentTarget);
  $('#obDemo').onclick = e => go(true, e.currentTarget);
  $('#obRestore').onchange = e => { const f = e.target.files[0]; if (f) restoreFromFile(f, { fromWelcome: true }); e.target.value = ''; };
  setTimeout(() => $('#obCompany')?.focus(), 200);
}

function openSession(op, first = false) {
  SESSION_OP = op;
  PREF.set('osi_session', op.id);
  $('#login').style.display = 'none';
  $('#app').classList.add('on');
  buildShell();
  if (!location.hash || location.hash === '#' || first) location.hash = '#/tableau-de-bord';
  else route();
  toast(first ? `Votre espace est prêt, ${op.name.split(' ')[0]} !` : `Bienvenue, ${op.name.split(' ')[0]}`, 'ok');
  syncAlertSeen();
}
function logout() {
  SESSION_OP = null; PREF.set('osi_session', '');
  closeModal(2); closeModal(1); closeDrawer();
  $('#app').classList.remove('on'); $('#login').style.display = 'grid';
  renderWelcome();
}

/* ══════════════ STRUCTURE (sidebar + topbar) ══════════════ */
const NAV = [
  { sec: 'Pilotage' },
  { id: 'tableau-de-bord', label: 'Tableau de bord', icon: 'dash', view: 'dashboard' },
  { id: 'produits', label: 'Produits et références', icon: 'box', view: 'products' },
  { id: 'categories', label: 'Catégories', icon: 'tag', view: 'categories' },
  { id: 'stocks', label: 'Stocks et entrepôts', icon: 'warehouse', view: 'stocks' },
  { sec: 'Opérations' },
  { id: 'mouvements', label: 'Mouvements de stock', icon: 'swap', view: 'movements', badge: 'today' },
  { id: 'inventaires', label: 'Inventaires', icon: 'clipcheck', view: 'inventories', badge: 'inv' },
  { id: 'alertes', label: 'Alertes et ruptures', icon: 'bell', view: 'alerts', badge: 'alerts' },
  { id: 'fournisseurs', label: 'Fournisseurs', icon: 'users', view: 'suppliers' },
  { id: 'commandes', label: 'Commandes fournisseurs', icon: 'cart', view: 'orders', badge: 'orders' },
  { sec: 'Analyse' },
  { id: 'statistiques', label: 'Statistiques et consommation', icon: 'chart', view: 'stats' },
  { id: 'rapports', label: 'Rapports et exports', icon: 'file', view: 'reports' },
  { id: 'parametres', label: 'Paramètres', icon: 'gear', view: 'settings' }
];
const SECTION_OF = {};
{ let sec = ''; NAV.forEach(n => { if (n.sec) sec = n.sec; else SECTION_OF[n.id] = sec; }); }
const navItem = id => NAV.find(n => n.id === id);

function badgeCount(kind) {
  if (kind === 'alerts') return computeAlerts().filter(a => a.prio >= 3).length;
  if (kind === 'orders') return S.orders.filter(isOrderOpen).length;
  if (kind === 'inv') return S.inventories.filter(v => ['counting', 'review'].includes(v.status)).length;
  return 0;
}
function buildShell() {
  $('#sbCompany').textContent = SETTINGS.companyName || 'Intelligence';
  $('#sbNav').innerHTML = NAV.map(it => {
    if (it.sec) return `<div class="sb-sec" role="heading" aria-level="2">${it.sec}</div>`;
    return `<a class="nav-item" href="#/${it.id}" data-view="${it.id}">${svg(it.icon)}<span>${it.label}</span></a>`;
  }).join('');
  $$('#sbNav .nav-item').forEach(a => a.addEventListener('click', () => closeSidebar()));
  const op = SESSION_OP;
  const av = $('#sbAvatar'); av.textContent = initialsOf(op?.name);
  $('#sbUserName').textContent = op?.name || '—';
  $('#sbUserRole').textContent = ROLE_LABEL[op?.role] || '';
  refreshBadges(); renderStoreStatus();
}
function refreshBadges() {
  $$('#sbNav .nav-item').forEach(b => {
    const it = navItem(b.dataset.view);
    const bc = it && it.badge && it.badge !== 'today' ? badgeCount(it.badge) : 0;
    let bd = b.querySelector('.badge');
    if (bc) {
      if (!bd) { bd = document.createElement('span'); b.appendChild(bd); }
      bd.className = 'badge ' + (it.badge === 'alerts' ? 'red' : '');
      bd.textContent = bc; bd.setAttribute('aria-label', `(${bc} ${it.badge === 'alerts' ? 'alertes importantes' : it.badge === 'orders' ? 'commandes en attente' : 'en cours'})`);
    } else if (bd) bd.remove();
  });
  const n = computeAlerts().filter(a => a.prio >= 3).length;
  const p = $('#notiPing');
  if (p) { if (n) { p.textContent = n; p.classList.remove('hide'); } else p.classList.add('hide'); }
  $('#notiBtn')?.setAttribute('aria-label', n ? `Alertes de stock : ${n} alerte(s) importante(s)` : 'Alertes de stock : aucune alerte importante');
}
async function renderStoreStatus() {
  const el = $('#sbStore'); if (!el) return;
  let usage = '';
  const est = await IDB.estimate();
  if (est && est.usage != null) usage = ' · ' + (est.usage / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
  el.innerHTML = IDB.persistent
    ? `<span class="dot on" aria-hidden="true"></span><span>Données locales${usage}</span>`
    : `<span class="dot off" aria-hidden="true"></span><span>Mémoire seule : exportez vos données</span>`;
}
function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('on'); $('#burger').setAttribute('aria-expanded', 'true'); $('#sbNav .nav-item.active')?.focus(); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on'); $('#burger').setAttribute('aria-expanded', 'false'); }

/* ══════════════ ROUTEUR ══════════════ */
/* VIEWS est déclaré dans ui.js (chargé avant les vues) */
let CURRENT = { id: 'tableau-de-bord', params: {} };
function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, query] = h.split('?');
  const params = {};
  (query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = v; });
  return { id: path || 'tableau-de-bord', params };
}
function go(id, params = {}) {
  const q = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const h = '#/' + id + (q ? '?' + q : '');
  if (location.hash === h) route(); else location.hash = h;
}
function route(opts = {}) {
  if (!SESSION_OP) return;
  const { id, params } = parseHash();
  const item = navItem(id) || navItem('tableau-de-bord');
  const changed = CURRENT.id !== item.id;
  CURRENT = { id: item.id, params };
  $$('#sbNav .nav-item').forEach(b => { const on = b.dataset.view === item.id; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const main = $('#main');
  const keepScroll = opts.keepScroll ? main.scrollTop : 0;
  const wrap = document.createElement('div');
  wrap.className = 'view' + (opts.keepScroll ? ' no-anim' : '');
  wrap.dataset.view = item.id;
  main.innerHTML = ''; main.appendChild(wrap);
  try { (VIEWS[item.view] || VIEWS.dashboard)(wrap, params); }
  catch (e) { console.error(e); wrap.innerHTML = emptyState('warn', 'Erreur d\'affichage', esc(e.message)); }
  hydrateMedia(wrap);
  main.scrollTop = keepScroll;
  document.title = item.label + ' · Ondea Stock Intelligence';
  if (changed && !opts.keepScroll) { $('#srLive').textContent = 'Section ' + item.label; }
}
/* Rafraîchit la vue courante après une modification (conserve le défilement) */
let _refreshT = null;
function refreshView() { clearTimeout(_refreshT); _refreshT = setTimeout(() => route({ keepScroll: true }), 30); }
const crumb = (...parts) => ['Ondea Stock', ...parts].map((p, i, a) => i === a.length - 1 ? `<span aria-current="page">${esc(p)}</span>` : `<span>${esc(p)}</span><span class="sep" aria-hidden="true">›</span>`).join('');
const crumbFor = (id, extra) => crumb(SECTION_OF[id], ...(extra ? [navItem(id).label, extra] : [navItem(id).label]));

/* Rafraîchissement du panneau latéral ouvert (fiche produit, commande…) */
let DRAWER_REFRESH = null;

/* ══════════════ RECHERCHE GLOBALE ══════════════ */
function globalSearchResults(q) {
  const t = norm(q.trim()); if (!t) return [];
  const res = [];
  S.products.forEach(p => { if (norm(p.name).includes(t) || norm(p.sku).includes(t) || (p.ean && p.ean.includes(t))) res.push({ kind: 'Produit', icon: 'box', label: p.name, sub: `${p.sku} · ${fmtNum(productQty(p))} ${p.unit}${p.status === 'archived' ? ' · archivé' : ''}`, open: () => openProductDrawer(p.id), exact: p.ean === q.trim() || norm(p.sku) === t }); });
  S.suppliers.forEach(s => { if (norm(s.name).includes(t) || norm(s.contact || '').includes(t)) res.push({ kind: 'Fournisseur', icon: 'users', label: s.name, sub: s.contact || s.email || '', open: () => openSupplierDrawer(s.id) }); });
  S.orders.forEach(o => { if (norm(o.number).includes(t)) res.push({ kind: 'Commande', icon: 'cart', label: o.number, sub: supName(o.supplierId) + ' · ' + ORDER_STATUS[o.status].label, open: () => openOrderDrawer(o.id) }); });
  S.inventories.forEach(v => { if (norm(v.number).includes(t) || norm(v.name).includes(t)) res.push({ kind: 'Inventaire', icon: 'clipcheck', label: v.number, sub: v.name, open: () => go('inventaires', { id: v.id }) }); });
  res.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0));
  return res.slice(0, 12);
}
function bindGlobalSearch() {
  const inp = $('#globalSearch'), drop = $('#searchDrop');
  let results = [], sel = -1;
  const close = () => { drop.classList.add('hide'); inp.setAttribute('aria-expanded', 'false'); sel = -1; };
  const draw = () => {
    results = globalSearchResults(inp.value);
    if (!inp.value.trim()) return close();
    drop.innerHTML = results.length ? results.map((r, i) => `<button type="button" class="noti sr-item ${i === sel ? 'unread' : ''}" role="option" aria-selected="${i === sel}" data-i="${i}">${svg(r.icon)}<div><div class="nt"><b>${esc(r.label)}</b></div><div class="nm">${esc(r.kind)} · ${esc(r.sub)}</div></div></button>`).join('')
      : `<div class="empty" style="padding:22px"><small>Aucun résultat pour « ${esc(inp.value)} »</small></div>`;
    drop.classList.remove('hide'); inp.setAttribute('aria-expanded', 'true');
    $$('.sr-item', drop).forEach(b => b.onclick = () => { const r = results[+b.dataset.i]; close(); inp.value = ''; r.open(); });
  };
  inp.addEventListener('input', debounce(() => { sel = -1; draw(); }, 120));
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[sel >= 0 ? sel : 0]; if (r) { close(); inp.value = ''; r.open(); } else if (inp.value.trim()) toast('Aucun résultat pour « ' + inp.value.trim() + ' »', 'warn'); }
    else if (e.key === 'Escape') { close(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
}

/* ══════════════ EFFETS D'AMBIANCE (repris de la référence) ══════════════ */
function startClock() {
  const tick = () => {
    const el = $('#sbClock'); if (!el) return;
    const d = new Date();
    el.innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':<span class="sec">' + pad2(d.getSeconds()) + '</span>';
    const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#sbDate').textContent = s.charAt(0).toUpperCase() + s.slice(1);
  };
  tick(); setInterval(tick, 1000);
  /* Changement de jour : recalcul des alertes (commandes en retard, dormants) */
  let day = todayISO();
  setInterval(() => { if (todayISO() !== day) { day = todayISO(); VERSION++; refreshBadges(); syncAlertSeen(); if (SESSION_OP) refreshView(); } }, 60000);
}
/* Icônes d'arrière-plan : même moteur que la référence, pictogrammes « stocks » */
function startBgIcons() {
  const layer = $('#ondeaBgIcons'); if (!layer) return;
  const ICONS = [ICON.box, ICON.truck, ICON.barcode, ICON.warehouse, ICON.cart, ICON.chart, ICON.tag, ICON.clipcheck, ICON.layers, ICON.swap, ICON.db, ICON.shield];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const maxIcons = () => innerWidth < 600 ? 5 : innerWidth < 1100 ? 8 : 12;
  const make = () => { const el = document.createElement('span'); el.className = 'obi'; el.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + ICONS[Math.floor(Math.random() * ICONS.length)] + '</svg>'; el.style.setProperty('--s', Math.round(rnd(28, 48)) + 'px'); return el; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    layer.classList.add('is-static');
    for (let i = 0; i < Math.min(6, maxIcons()); i++) { const st = make(); st.style.transform = `translate(${rnd(4, 90)}vw,${rnd(10, 88)}vh)`; layer.appendChild(st); }
    return;
  }
  const spawn = () => {
    if (BG_PAUSED || document.hidden || layer.childElementCount >= maxIcons()) return;
    const el = make(); const x0 = rnd(2, 94), y0 = rnd(15, 95);
    el.style.setProperty('--x0', x0 + 'vw'); el.style.setProperty('--y0', y0 + 'vh');
    el.style.setProperty('--x1', (x0 + rnd(-6, 6)) + 'vw'); el.style.setProperty('--y1', (y0 - rnd(10, 22)) + 'vh');
    el.style.setProperty('--d', rnd(18, 30).toFixed(1) + 's');
    el.addEventListener('animationend', () => el.remove());
    layer.appendChild(el);
  };
  (function loop() { spawn(); setTimeout(loop, rnd(1400, 3200)); })();
  for (let k = 0; k < Math.ceil(maxIcons() / 2); k++) setTimeout(spawn, k * 400);
}
/* Bouton « Retour en haut » : son + flash + vibration à l'arrivée (identique à la référence) */
function buildToTop() {
  const scroller = $('#main');
  const btn = document.createElement('button');
  btn.id = 'toTopBtn'; btn.type = 'button'; btn.title = 'Retour en haut'; btn.setAttribute('aria-label', 'Retour en haut de la page');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
  document.body.appendChild(btn);
  const flash = document.createElement('div');
  flash.id = 'toTopFlash'; flash.setAttribute('role', 'status'); flash.setAttribute('aria-live', 'assertive');
  flash.innerHTML = '<span aria-hidden="true">⬆</span><span>Haut de page</span>';
  document.body.appendChild(flash);
  let armed = false, ac = null;
  const audio = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { } return ac; };
  function chime() {
    if (PREF.get('osi_sound', 'on') !== 'on') return;
    const c = audio(); if (!c) return;
    try {
      const t = c.currentTime, master = c.createGain(); master.connect(c.destination);
      master.gain.setValueAtTime(0.0001, t); master.gain.exponentialRampToValueAtTime(0.5, t + 0.02); master.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = f; o.connect(g); g.connect(master);
        const s = t + i * 0.11; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1, s + 0.015); g.gain.exponentialRampToValueAtTime(0.001, s + 0.4); o.start(s); o.stop(s + 0.45);
      });
    } catch (e) { }
  }
  function arrive() {
    chime();
    if (navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch (e) { } }
    flash.classList.add('on'); btn.classList.add('arrived');
    setTimeout(() => flash.classList.remove('on'), 1000); setTimeout(() => btn.classList.remove('arrived'), 650);
    $('#pageTitle')?.setAttribute('tabindex', '-1'); $('#pageTitle')?.focus({ preventScroll: true });
  }
  const onScroll = () => {
    if (!$('#app').classList.contains('on')) { btn.classList.remove('show'); return; }
    const y = scroller.scrollTop; btn.classList.toggle('show', y > 240);
    if (armed && y <= 2) { armed = false; arrive(); }
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => {
    audio();
    if (scroller.scrollTop <= 2) { arrive(); return; }
    armed = true; scroller.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => { if (armed && scroller.scrollTop <= 2) { armed = false; arrive(); } }, 900);
  });
}

/* ══════════════ INITIALISATION ══════════════ */
async function init() {
  applyTheme(PREF.get('ondea_theme', 'dark'));
  applyContrast(PREF.get('ondea_contrast') === 'high');
  applyTextSize(Number(PREF.get('ondea_stock_textsize', 100)) || 100);
  applyBgPause(PREF.get('ondea_bg_icons') === 'paused');
  startBgIcons(); startClock(); buildToTop(); bindGlobalSearch();

  /* Événements globaux */
  $('#themeBtn').onclick = toggleTheme; $('#loginThemeBtn').onclick = toggleTheme;
  $('#contrastBtn').onclick = () => applyContrast(document.documentElement.getAttribute('data-contrast') !== 'high');
  $('#bgPauseBtn').onclick = () => applyBgPause(!BG_PAUSED);
  $('#textSizeBtn').onclick = () => { const cur = Number(PREF.get('ondea_stock_textsize', 100)) || 100; const i = TEXT_SIZES.indexOf(cur); applyTextSize(TEXT_SIZES[(i + 1) % TEXT_SIZES.length], true); };
  /* La cloche est un raccourci vers les alertes (comme la référence vers les demandes) */
  $('#notiBtn').onclick = () => go(CURRENT.id === 'alertes' ? 'tableau-de-bord' : 'alertes');
  $('#logoutBtn').onclick = logout;
  $('#burger').onclick = openSidebar; $('#scrim').onclick = closeSidebar;
  $('#drawerScrim').onclick = closeDrawer;
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(1); });
  $('#overlay2').addEventListener('click', e => { if (e.target.id === 'overlay2') closeModal(2); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modalOpen(2)) closeModal(2); else if (modalOpen(1)) closeModal(1);
      else if ($('#drawer').classList.contains('on')) closeDrawer();
      else if ($('#sidebar').classList.contains('open')) { closeSidebar(); $('#burger').focus(); }
    }
    if (e.key === 'Tab') {
      if (modalOpen(2)) trapFocus($('#overlay2 .modal'), e);
      else if (modalOpen(1)) trapFocus($('#overlay .modal'), e);
      else if ($('#drawer').classList.contains('on')) trapFocus($('#drawer'), e);
    }
    /* Raccourci : « / » place le curseur dans la recherche globale */
    if (e.key === '/' && !e.target.closest('input,textarea,select') && SESSION_OP) { e.preventDefault(); $('#globalSearch').focus(); }
  });
  window.addEventListener('hashchange', () => { closeDrawer(); route(); });
  window.addEventListener('error', e => console.error('[Ondea Stock] erreur', e.error || e.message));
  window.addEventListener('unhandledrejection', e => { console.error('[Ondea Stock] promesse rejetée', e.reason); });

  /* Données */
  const ok = await IDB.open();
  try { await loadAll(); }
  catch (e) { console.error(e); toast('Lecture des données impossible : ' + e.message, 'dng', 10000); }
  if (!ok) toast('IndexedDB indisponible : les données ne seront PAS conservées après fermeture. Utilisez l\'export JSON.', 'warn', 12000);

  /* Réaction à chaque modification : badges, alertes, vue courante, fiche ouverte */
  onChange(info => {
    refreshBadges();
    if (info.what !== 'alerts') syncAlertSeen();
    if (!SESSION_OP || info.silent) return;
    if (DRAWER_REFRESH && $('#drawer').classList.contains('on')) { try { DRAWER_REFRESH(); } catch (e) { console.warn(e); } }
    if (info.what === 'alerts' && !['alertes', 'tableau-de-bord'].includes(CURRENT.id)) return;
    refreshView();
    if (['settings', 'operators', 'setup', 'restore'].includes(info.what)) buildShell();
  });

  /* Session mémorisée */
  const sid = PREF.get('osi_session');
  const op = OPERATORS.find(o => o.id === sid && o.active !== false);
  if (op && !op.pin) openSession(op);
  else renderWelcome();
}
document.addEventListener('DOMContentLoaded', init);
