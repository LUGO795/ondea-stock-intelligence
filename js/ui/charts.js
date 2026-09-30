/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — charts.js
   Graphiques SVG faits maison (aucune bibliothèque) :
     • courbe / aire  (évolution de la valeur du stock, dépenses)
     • barres groupées (entrées / sorties)
     • anneau (répartition par catégorie) avec légende
   Chaque graphique :
     – suit le thème clair/sombre (couleurs = variables CSS --c1…--c6) ;
     – affiche une info-bulle au survol, au toucher ET au clavier (flèches) ;
     – propose une vue « Tableau » (accessibilité : l'information n'est
       jamais transmise uniquement par la couleur) ;
     – se redessine à la bonne largeur (ResizeObserver).
   ██████████████████████████████████████████████████████████████ */
"use strict";

const CHART_H = 250;
const _chartRO = new Map();

/* Observe la largeur du conteneur et redessine au redimensionnement */
function observeChart(host, draw) {
  draw();
  if (!('ResizeObserver' in window)) return;
  let w = host.clientWidth;
  const ro = new ResizeObserver(debounce(() => {
    if (!document.contains(host)) { ro.disconnect(); return; }
    if (Math.abs(host.clientWidth - w) > 4) { w = host.clientWidth; draw(); }
  }, 120));
  ro.observe(host); _chartRO.set(host, ro);
}
/* Échelle « jolie » pour l'axe vertical */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function tipHTML(title, rows) {
  return `<div class="ct-t">${esc(title)}</div>` + rows.map(r => `<div class="ct-r"><span class="ct-k"><i class="sw ${r.cls}"></i>${esc(r.name)}</span><b>${esc(r.value)}</b></div>`).join('');
}
function placeTip(host, tip, x, y) {
  tip.hidden = false;
  const W = host.clientWidth, tw = tip.offsetWidth;
  let left = x + 14; if (left + tw > W - 4) left = x - tw - 14; if (left < 4) left = 4;
  tip.style.left = left + 'px'; tip.style.top = Math.max(0, y - 10) + 'px';
}
/* Tableau de données (vue alternative accessible) */
function chartTable(labels, series, fmt, head = 'Période') {
  return `<div class="tbl-wrap chart-table"><table class="tbl" style="min-width:0"><thead><tr><th scope="col">${esc(head)}</th>${series.map(s => `<th scope="col" class="num-c">${esc(s.name)}</th>`).join('')}</tr></thead>
    <tbody>${labels.map((l, i) => `<tr><th scope="row" style="font-weight:600">${esc(l)}</th>${series.map(s => `<td class="num-c mono">${esc(fmt(s.values[i]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function noData(msg = 'Pas encore de données sur cette période.') {
  return `<div class="chart-empty">${svg('chart')}<p>${esc(msg)}</p></div>`;
}

/* ═══════════════ COURBE / AIRE ═══════════════
   opts = {labels, series:[{name, values, cls:'s1'}], fmt, area:true, label} */
function lineChart(host, opts) {
  const fmt = opts.fmt || fmtNum;
  const all = opts.series.flatMap(s => s.values);
  if (!all.length || all.every(v => !v)) { host.innerHTML = noData(opts.empty); return; }
  host.classList.add('chart');
  const draw = () => {
    const W = Math.max(280, host.clientWidth), H = CHART_H;
    const m = { l: 58, r: 14, t: 14, b: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = opts.labels.length;
    const max = niceMax(Math.max(...all) * 1.08);
    const X = i => m.l + (n <= 1 ? iw / 2 : i * iw / (n - 1));
    const Y = v => m.t + ih - (v / max) * ih;
    const ticks = [0, .25, .5, .75, 1].map(t => t * max);
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 78))));
    let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opts.label || '')}">`;
    g += ticks.map(t => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(opts.axisFmt ? opts.axisFmt(t) : fmtNum(t))}</text>`).join('');
    g += opts.labels.map((l, i) => i % every === 0 || i === n - 1 ? `<text class="ax" x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(l)}</text>` : '').join('');
    opts.series.forEach(s => {
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      if (opts.area) g += `<path class="area ${s.cls}" d="M${X(0)},${Y(0)} L${pts.join(' L')} L${X(n - 1)},${Y(0)} Z"/>`;
      g += `<polyline class="line ${s.cls}" points="${pts.join(' ')}"/>`;
    });
    g += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    g += opts.series.map((s, k) => `<circle class="dotm ${s.cls}" r="5" cx="0" cy="0" visibility="hidden" data-k="${k}"/>`).join('');
    g += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></svg><div class="chart-tip" hidden></div>`;
    host.innerHTML = g;
    const sv = $('svg', host), tip = $('.chart-tip', host), xh = $('.xhair', host), dots = $$('.dotm', host);
    const show = i => {
      i = clamp(i, 0, n - 1); host.dataset.idx = i;
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', X(i)); d.setAttribute('cy', Y(opts.series[k].values[i])); d.setAttribute('visibility', 'visible'); });
      tip.innerHTML = tipHTML(opts.labels[i], opts.series.map(s => ({ name: s.name, value: fmt(s.values[i]), cls: s.cls })));
      const topY = Math.min(...opts.series.map(s => Y(s.values[i])));
      placeTip(host, tip, X(i) * host.clientWidth / W, topY);
    };
    const hide = () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); };
    const idxAt = ev => { const r = sv.getBoundingClientRect(); const x = (ev.clientX - r.left) * W / r.width; return Math.round((x - m.l) / (iw / Math.max(1, n - 1))); };
    $('.hit', host).addEventListener('pointermove', ev => show(idxAt(ev)));
    $('.hit', host).addEventListener('pointerdown', ev => show(idxAt(ev)));
    host.onpointerleave = hide;
    keyNav(host, n, show, hide);
  };
  observeChart(host, draw);
}

/* ═══════════════ BARRES GROUPÉES ═══════════════ */
function barChart(host, opts) {
  const fmt = opts.fmt || fmtNum;
  const all = opts.series.flatMap(s => s.values);
  if (!all.length || all.every(v => !v)) { host.innerHTML = noData(opts.empty); return; }
  host.classList.add('chart');
  const draw = () => {
    const W = Math.max(280, host.clientWidth), H = CHART_H;
    const m = { l: 58, r: 10, t: 14, b: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = opts.labels.length, k = opts.series.length;
    const max = niceMax(Math.max(...all) * 1.08);
    const slot = iw / n, gap = 2;
    const bw = Math.max(2, Math.min(26, (slot * 0.72 - gap * (k - 1)) / k));
    const groupW = bw * k + gap * (k - 1);
    const Y = v => m.t + ih - (v / max) * ih;
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
    let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opts.label || '')}">`;
    g += [0, .25, .5, .75, 1].map(t => t * max).map(t => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(opts.axisFmt ? opts.axisFmt(t) : fmtNum(t))}</text>`).join('');
    for (let i = 0; i < n; i++) {
      const x0 = m.l + i * slot + (slot - groupW) / 2;
      opts.series.forEach((s, j) => {
        const v = s.values[i]; if (!v) return;
        const x = x0 + j * (bw + gap), y = Y(v), h = m.t + ih - y, r = Math.min(4, bw / 2, h);
        g += `<path class="bar ${s.cls}" d="M${x},${m.t + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${m.t + ih} Z"/>`;
      });
      if (i % every === 0) g += `<text class="ax" x="${m.l + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${esc(opts.labels[i])}</text>`;
    }
    g += `<rect class="band" x="0" y="${m.t}" width="${slot}" height="${ih}" visibility="hidden"/>`;
    g += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></svg><div class="chart-tip" hidden></div>`;
    host.innerHTML = g;
    const sv = $('svg', host), tip = $('.chart-tip', host), band = $('.band', host);
    const show = i => {
      i = clamp(i, 0, n - 1); host.dataset.idx = i;
      band.setAttribute('x', m.l + i * slot); band.setAttribute('visibility', 'visible');
      tip.innerHTML = tipHTML(opts.labels[i], opts.series.map(s => ({ name: s.name, value: fmt(s.values[i]), cls: s.cls })));
      placeTip(host, tip, (m.l + i * slot + slot / 2) * host.clientWidth / W, Y(Math.max(...opts.series.map(s => s.values[i]))));
    };
    const hide = () => { tip.hidden = true; band.setAttribute('visibility', 'hidden'); };
    const idxAt = ev => { const r = sv.getBoundingClientRect(); const x = (ev.clientX - r.left) * W / r.width; return Math.floor((x - m.l) / slot); };
    $('.hit', host).addEventListener('pointermove', ev => show(idxAt(ev)));
    $('.hit', host).addEventListener('pointerdown', ev => show(idxAt(ev)));
    host.onpointerleave = hide;
    keyNav(host, n, show, hide);
  };
  observeChart(host, draw);
}

/* ═══════════════ ANNEAU + LÉGENDE ═══════════════
   items = [{name, value}] ; au-delà de 5 parts, regroupement en « Autres » */
function donutChart(host, items, { fmt = fmtMoney, label = '', center = '' } = {}) {
  items = items.filter(x => x.value > 0);
  const total = sum(items, x => x.value);
  if (!total) { host.innerHTML = noData('Aucune valeur de stock à répartir.'); return; }
  if (items.length > 6) { const rest = items.slice(5); items = items.slice(0, 5).concat([{ name: 'Autres (' + rest.length + ')', value: sum(rest, x => x.value) }]); }
  const R = 70, r = 46, C = 90;
  let a0 = -Math.PI / 2;
  const arc = (a, rad) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
  const segs = items.map((it, i) => {
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = arc(a0, R), [x1, y1] = arc(a1, R), [x2, y2] = arc(a1, r), [x3, y3] = arc(a0, r);
    const d = items.length === 1
      ? `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} Z M${C},${C - r} A${r},${r} 0 1 0 ${C + 0.01},${C - r} Z`
      : `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    a0 = a1;
    return `<path class="seg s${i + 1}" d="${d}" data-i="${i}" tabindex="-1"><title>${esc(it.name)} : ${esc(fmt(it.value))} (${fmtPct(it.value / total * 100, 1)})</title></path>`;
  }).join('');
  host.innerHTML = `<div class="donut-wrap">
    <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="${esc(label)}">${segs}
      <text x="90" y="86" text-anchor="middle" class="dn-v">${esc(center || fmtMoneyShort(total))}</text>
      <text x="90" y="106" text-anchor="middle" class="dn-l">au total</text></svg>
    <ul class="legend">${items.map((it, i) => `<li data-i="${i}"><i class="sw s${i + 1}" aria-hidden="true"></i><span class="lg-n">${esc(it.name)}</span><b class="mono">${esc(fmt(it.value))}</b><small class="mono">${fmtPct(it.value / total * 100, 1)}</small></li>`).join('')}</ul></div>`;
  const hl = i => { $$('.seg', host).forEach(s => s.classList.toggle('dim', i !== null && s.dataset.i != i)); $$('.legend li', host).forEach(l => l.classList.toggle('on', l.dataset.i == i)); };
  $$('.seg,.legend li', host).forEach(el => { el.onpointerenter = () => hl(el.dataset.i); el.onpointerleave = () => hl(null); });
}

/* Navigation clavier dans un graphique : ← → pour parcourir, Échap pour quitter */
function keyNav(host, n, show, hide) {
  host.tabIndex = 0;
  host.onkeydown = e => {
    let i = host.dataset.idx === undefined ? -1 : +host.dataset.idx;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i < 0 ? n - 1 : i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(n - 1); }
    else if (e.key === 'Escape') { hide(); }
  };
  host.onfocus = () => { if (host.dataset.idx === undefined) show(n - 1); };
  host.onblur = () => { hide(); delete host.dataset.idx; };
}

/* Barres horizontales (classement) — style .stat-row de la référence */
function rankBars(rows, { fmt = fmtNum, labelW = 170, empty = 'Aucune donnée sur la période.' } = {}) {
  if (!rows.length) return `<p class="muted" style="padding:6px 0">${esc(empty)}</p>`;
  const max = Math.max(...rows.map(r => r.value), 1);
  return rows.map(r => `<div class="stat-row"${r.attrs || ''}><span class="soft rk-l" style="width:${labelW}px" title="${esc(r.label)}">${esc(r.label)}</span>
    <div class="lbar" role="presentation"><span style="width:${Math.max(2, r.value / max * 100)}%"></span></div><b class="mono rk-v">${esc(fmt(r.value))}</b></div>`).join('');
}

/* Panneau de graphique avec bascule Graphique / Tableau */
function chartPanel(id, title, legend = '', extra = '') {
  return `<section class="panel chart-panel" aria-labelledby="${id}T"><div class="panel-h"><h3 id="${id}T">${esc(title)}</h3>
      <div class="row">${extra}<div class="seg" role="group" aria-label="Affichage de « ${esc(title)} »">
        <button type="button" class="on" data-cv="chart" aria-pressed="true" data-for="${id}">Graphique</button>
        <button type="button" data-cv="table" aria-pressed="false" data-for="${id}">Tableau</button></div></div></div>
    <div class="panel-b">${legend ? `<div class="legend-inline">${legend}</div>` : ''}<div id="${id}" class="chart-host"></div><div id="${id}Tbl" hidden></div></div></section>`;
}
/* Branche les bascules Graphique/Tableau d'une vue */
function bindChartToggles(root, tables) {
  $$('[data-cv]', root).forEach(b => b.onclick = () => {
    const id = b.dataset.for, mode = b.dataset.cv;
    $$(`[data-for="${id}"]`, root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    const host = $('#' + id, root), tbl = $('#' + id + 'Tbl', root);
    if (mode === 'table') { tbl.innerHTML = tables[id] ? tables[id]() : ''; tbl.hidden = false; host.hidden = true; }
    else { tbl.hidden = true; host.hidden = false; }
  });
}
const legendItem = (cls, name) => `<span class="lg-i"><i class="sw ${cls}" aria-hidden="true"></i>${esc(name)}</span>`;
