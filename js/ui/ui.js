/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — ui.js
   Composants d'interface réutilisables, identiques à la référence :
   notifications (toasts), fenêtre modale, confirmation, panneau latéral
   (drawer), pagination, en-tête de page, états vides, champs de formulaire.
   Ajouts accessibilité : piège du focus dans les modales, retour du focus
   à l'élément d'origine, protection contre les doubles clics.
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* Registre des vues de la SPA (chaque fichier views/*.js y ajoute sa section) */
const VIEWS = {};

/* ---------- Toasts (même rendu que Ondea Staff Manager) ---------- */
function toast(msg, type = 'ok', ms = 3600) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + type;
  el.setAttribute('role', type === 'dng' ? 'alert' : 'status');
  const ic = type === 'ok' ? 'check' : type === 'dng' ? 'warn' : type === 'warn' ? 'warn' : 'info';
  el.innerHTML = `<span class="ic">${svg(ic)}</span><span class="msg">${esc(msg).replace(/\n/g, '<br>')}</span>`;
  box.appendChild(el);
  if (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'dng' ? Math.max(ms, 6000) : ms);
}
/* Affiche une erreur métier (Error) de façon lisible */
function showError(e) { console.warn(e); toast(e && e.message ? e.message : 'Une erreur est survenue.', 'dng', 7000); }

/* ---------- Protection contre les doubles soumissions ----------
   guard(bouton, async () => {...}) : désactive le bouton pendant l'opération. */
async function guard(btn, fn) {
  if (btn && btn.dataset.busy === '1') return;
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try { return await fn(); }
  catch (e) { showError(e); }
  finally { if (btn) { btn.dataset.busy = ''; btn.disabled = false; btn.removeAttribute('aria-busy'); } }
}

/* ---------- Gestion du focus (accessibilité clavier) ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const f = $$(FOCUSABLE, container).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- Modale générique (2 niveaux : formulaire + confirmation) ---------- */
const MODAL_STACK = [];
function openModal({ title, body, footer = '', wide = false, xwide = false, onOpen, onClose, level = 1, label }) {
  const ov = $(level === 2 ? '#overlay2' : '#overlay');
  const m = $('.modal', ov);
  m.className = 'modal' + (wide ? ' wide' : '') + (xwide ? ' xwide' : '');
  m.innerHTML = `<div class="modal-h"><h3 id="modalTitle${level}">${esc(title)}</h3><button class="x-btn" type="button" data-close aria-label="Fermer la fenêtre">${svg('x')}</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}`;
  m.setAttribute('aria-labelledby', 'modalTitle' + level);
  if (label) m.setAttribute('aria-label', label);
  const prevFocus = document.activeElement;
  MODAL_STACK.push({ level, prevFocus, onClose });
  ov.classList.add('on');
  ov.setAttribute('aria-hidden', 'false');
  $$('[data-close]', m).forEach(b => b.onclick = () => closeModal(level));
  hydrateMedia(m);
  if (onOpen) onOpen(m);
  /* Focus sur le premier champ, sinon sur la modale */
  setTimeout(() => {
    const first = $('.modal-b ' + 'input:not([type=hidden]):not([type=file]),.modal-b select,.modal-b textarea', m) || $('.modal-f .btn.gold', m) || $('[data-close]', m);
    first && first.focus();
  }, 60);
  return m;
}
function closeModal(level) {
  const lv = level || (MODAL_STACK.length ? MODAL_STACK[MODAL_STACK.length - 1].level : 1);
  const ov = $(lv === 2 ? '#overlay2' : '#overlay');
  if (!ov.classList.contains('on')) return;
  ov.classList.remove('on'); ov.setAttribute('aria-hidden', 'true');
  const i = MODAL_STACK.map(x => x.level).lastIndexOf(lv);
  const entry = i >= 0 ? MODAL_STACK.splice(i, 1)[0] : null;
  if (entry?.onClose) try { entry.onClose(); } catch (e) { }
  if (entry?.prevFocus && document.contains(entry.prevFocus)) setTimeout(() => entry.prevFocus.focus(), 30);
}
function modalOpen(level = 1) { return $(level === 2 ? '#overlay2' : '#overlay').classList.contains('on'); }

/* Confirmation explicite (toujours au-dessus des autres fenêtres) */
function confirmDialog(msg, onYes, { danger = true, yes = 'Confirmer', title = 'Confirmation', details = '', requireText = '' } = {}) {
  openModal({
    level: 2, title,
    body: `<p style="line-height:1.6">${esc(msg)}</p>${details}
      ${requireText ? `<div class="field" style="margin-top:14px"><label for="cfmText">Pour confirmer, saisissez <b class="mono">${esc(requireText)}</b></label><input class="inp" id="cfmText" autocomplete="off"></div>` : ''}`,
    footer: `<button class="btn ghost" type="button" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'gold'}" type="button" id="cfmYes">${esc(yes)}</button>`,
    onOpen: m => {
      const yesBtn = $('#cfmYes', m);
      if (requireText) { yesBtn.disabled = true; $('#cfmText', m).oninput = e => yesBtn.disabled = e.target.value.trim() !== requireText; }
      yesBtn.onclick = () => guard(yesBtn, async () => { await onYes(); closeModal(2); });
    }
  });
}

/* ---------- Panneau latéral (fiche détaillée) ---------- */
let _drawerPrevFocus = null;
function openDrawer(html, onOpen, label = 'Fiche détaillée') {
  const d = $('#drawer');
  if (!d.classList.contains('on')) _drawerPrevFocus = document.activeElement;
  d.innerHTML = html; d.classList.add('on'); d.setAttribute('aria-label', label); d.setAttribute('aria-hidden', 'false');
  $('#drawerScrim').classList.add('on');
  hydrateMedia(d);
  if (onOpen) onOpen(d);
  setTimeout(() => ($('[data-drclose]', d) || d).focus(), 60);
}
function closeDrawer() {
  const d = $('#drawer'); if (!d.classList.contains('on')) return;
  d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); $('#drawerScrim').classList.remove('on');
  if (_drawerPrevFocus && document.contains(_drawerPrevFocus)) _drawerPrevFocus.focus();
}

/* ---------- Pagination (reprise de la référence, libellé paramétrable) ---------- */
function pagerHTML(page, pages, total, start, shown, unit = 'élément') {
  if (!total) return '';
  const u = total > 1 ? unit + 's' : unit;
  if (pages <= 1) return `<div class="pager"><span class="pager-info">${fmtNum(total)} ${u}</span></div>`;
  let nums = '';
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums += `<button type="button" class="${i === page ? 'on' : ''}" data-pg="${i}" aria-label="Page ${i}" ${i === page ? 'aria-current="page"' : ''}>${i}</button>`;
    else if (i === page - 2 || i === page + 2) nums += '<span class="pager-dots" aria-hidden="true">…</span>';
  }
  return `<nav class="pager" aria-label="Pagination">
    <span class="pager-info">${fmtNum(start + 1)}–${fmtNum(start + shown)} sur ${fmtNum(total)} ${u}</span>
    <div class="pager-ctrls">
      <button type="button" data-pg="prev" ${page === 1 ? 'disabled' : ''}>‹ Préc.</button>${nums}
      <button type="button" data-pg="next" ${page === pages ? 'disabled' : ''}>Suiv. ›</button>
    </div></nav>`;
}
/* Branche les boutons de pagination sur un état {page} */
function bindPager(root, state, redraw) {
  $$('.pager button[data-pg]', root).forEach(b => b.onclick = () => {
    const v = b.dataset.pg;
    if (v === 'prev') state.page--; else if (v === 'next') state.page++; else state.page = +v;
    redraw();
    const top = root.closest('.view') || root; top.scrollIntoView?.({ block: 'start' });
  });
}
function paginate(rows, state, per) {
  per = per || Number(SETTINGS.pageSize) || 25;
  const total = rows.length, pages = Math.max(1, Math.ceil(total / per));
  state.page = clamp(state.page || 1, 1, pages);
  const start = (state.page - 1) * per;
  return { total, pages, start, rows: rows.slice(start, start + per) };
}

/* ---------- En-tête de page (eyebrow = fil d'Ariane, comme la référence) ---------- */
function pageHead(title, crumb, actions = '', sub = '') {
  return `<div class="page-head"><div>
      <nav class="eyebrow crumb" aria-label="Fil d'Ariane">${crumb}</nav>
      <h2 id="pageTitle">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="row wrap">${actions}</div></div>`;
}

/* ---------- État vide professionnel ---------- */
function emptyState(icon, title, text, action = '') {
  return `<div class="empty">${svg(icon)}<h4>${esc(title)}</h4><p>${text}</p>${action ? `<div style="margin-top:16px">${action}</div>` : ''}</div>`;
}

/* ---------- Champs de formulaire ---------- */
function fieldHTML({ id, label, value = '', type = 'text', req = false, hint = '', attrs = '', placeholder = '' }) {
  const h = hint ? `<span class="hint" id="${id}Hint">${hint}</span>` : '';
  return `<div class="field"><label for="${id}">${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    <input class="inp" id="${id}" type="${type}" value="${esc(value)}" ${req ? 'required aria-required="true"' : ''} ${hint ? `aria-describedby="${id}Hint"` : ''} ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${attrs}>${h}</div>`;
}
function selectHTML({ id, label, options, value = '', req = false, hint = '', empty = null, attrs = '' }) {
  const opts = (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
    options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  return `<div class="field"><label for="${id}">${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    <select class="sel" id="${id}" ${req ? 'required aria-required="true"' : ''} ${hint ? `aria-describedby="${id}Hint"` : ''} ${attrs}>${opts}</select>${hint ? `<span class="hint" id="${id}Hint">${hint}</span>` : ''}</div>`;
}
function textareaHTML({ id, label, value = '', hint = '', rows = 3 }) {
  return `<div class="field"><label for="${id}">${esc(label)}</label><textarea class="inp" id="${id}" rows="${rows}" ${hint ? `aria-describedby="${id}Hint"` : ''}>${esc(value)}</textarea>${hint ? `<span class="hint" id="${id}Hint">${hint}</span>` : ''}</div>`;
}
/* Marque les champs en erreur (message lisible + aria-invalid) */
function markInvalid(root, ids) {
  $$('[aria-invalid="true"]', root).forEach(x => x.removeAttribute('aria-invalid'));
  ids.forEach(id => { const el = $('#' + id, root); if (el) el.setAttribute('aria-invalid', 'true'); });
  if (ids.length) $('#' + ids[0], root)?.focus();
}
function formError(root, msg) {
  let box = $('.form-err', root);
  if (!msg) { box && box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'login-err form-err'; box.setAttribute('role', 'alert'); const b = $('.modal-b', root) || root; b.prepend(box); }
  box.innerHTML = esc(msg).replace(/\n/g, '<br>');
  box.scrollIntoView?.({ block: 'nearest' });
}
const val = (root, id) => ($('#' + id, root)?.value ?? '').trim();
const numVal = (root, id) => { const v = val(root, id); return v === '' ? null : parseNum(v); };

/* Options de listes déroulantes */
const optProducts = (filter = p => p.status === 'active') => S.products.filter(filter).sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(p => [p.id, `${p.name} — ${p.sku}`]);
const optCategories = () => S.categories.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(c => [c.id, c.name]);
const optLocations = () => S.locations.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(l => [l.id, l.name]);
const optSuppliers = (all = false) => S.suppliers.filter(s => all || s.status !== 'archived').sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(s => [s.id, s.name]);

/* Vignette produit (photo ou initiales dorées, même style que les avatars de la référence) */
function productThumb(p, cls = '') {
  if (p?.photoId) return `<div class="av photo ${cls}"><img data-media="${esc(p.photoId)}" alt="Photo de ${esc(p.name)}"></div>`;
  return `<div class="av ${cls}" aria-hidden="true">${esc(initialsOf(p?.name))}</div>`;
}

/* Sélecteur de produit avec recherche (pour les listes de milliers de références) */
function productPicker(id, label, value = '', { req = true, filter } = {}) {
  const opts = optProducts(filter);
  return `<div class="field picker"><label for="${id}Q">${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
    <input class="inp" id="${id}Q" type="search" placeholder="Filtrer par nom, référence ou code-barres…" autocomplete="off" aria-controls="${id}">
    <select class="sel" id="${id}" size="1" ${req ? 'required aria-required="true"' : ''} aria-label="${esc(label)}"><option value="">— Choisir un produit —</option>${opts.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}
function bindProductPicker(root, id, onPick) {
  const q = $('#' + id + 'Q', root), sel = $('#' + id, root);
  const all = [...sel.options].map(o => ({ v: o.value, l: o.textContent }));
  q.oninput = debounce(() => {
    const t = norm(q.value); const cur = sel.value;
    const match = all.filter(o => !o.v || !t || norm(o.l).includes(t) || norm(productById(o.v)?.ean || '').includes(t));
    sel.innerHTML = match.slice(0, 400).map(o => `<option value="${o.v}" ${o.v === cur ? 'selected' : ''}>${esc(o.l)}</option>`).join('');
    /* Un seul résultat (ex. lecture code-barres) : sélection automatique */
    if (t && match.filter(o => o.v).length === 1) { sel.value = match.find(o => o.v).v; sel.dispatchEvent(new Event('change')); }
  }, 120);
  q.onkeydown = e => { if (e.key === 'Enter') e.preventDefault(); };
  if (onPick) sel.addEventListener('change', () => onPick(sel.value));
}
