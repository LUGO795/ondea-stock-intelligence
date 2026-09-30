/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — pin-eye.js  (AJOUT)
   Ajoute un « œil » dans chaque champ de code PIN pour afficher
   ou masquer les chiffres saisis :
     • écran de première utilisation (#obPin) ;
     • choix de l'opérateur (#liPin) et écran PIN direct (#pinOnly) ;
     • fiche opérateur dans les Paramètres (#opPin) ;
     • et tout futur champ mot de passe / PIN, automatiquement.
   Accessible : vrai bouton, libellé lu par les lecteurs d'écran,
   état annoncé (aria-pressed), utilisable au clavier.
   Le code redevient masqué à chaque nouvel affichage de l'écran.
   À charger APRÈS les autres scripts. Aucune modification ailleurs.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  /* ---- Styles (mêmes jetons que le design system) ---- */
  const css = `
    .pw-wrap{position:relative}
    .pw-wrap > input.has-eye{padding-right:48px}
    .pw-wrap .pin-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);
      width:36px;height:36px;display:grid;place-items:center;padding:0;border-radius:8px;
      color:var(--txt-mute);background:transparent;border:1px solid transparent;cursor:pointer;
      transition:color .15s,background .15s,border-color .15s}
    .pw-wrap .pin-eye:hover{color:var(--accent-bright);background:var(--or-glow)}
    .pw-wrap .pin-eye:focus-visible{outline:2px solid var(--accent-bright);outline-offset:2px}
    .pw-wrap .pin-eye[aria-pressed="true"]{color:var(--accent-bright)}
    .pw-wrap .pin-eye svg{width:19px;height:19px}
    html[data-theme="light"] .pw-wrap .pin-eye:hover,
    html[data-theme="light"] .pw-wrap .pin-eye[aria-pressed="true"]{color:#4e3a10}
    html[data-contrast="high"] .pw-wrap .pin-eye{color:var(--txt)}
    @media print{.pin-eye{display:none!important}}`;
  const st = document.createElement('style');
  st.id = 'pin-eye-style';
  st.textContent = css;
  document.head.appendChild(st);

  /* ---- Icônes (trait identique aux icônes de l'application) ---- */
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function setState(inp, btn, visible) {
    inp.type = visible ? 'text' : 'password';
    btn.innerHTML = visible ? EYE_OFF : EYE;
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    const lbl = visible ? 'Masquer le code PIN' : 'Afficher le code PIN';
    btn.setAttribute('aria-label', lbl);
    btn.title = lbl;
  }

  function enhance(inp) {
    if (inp.dataset.eye === '1') return;
    inp.dataset.eye = '1';
    if (!inp.id) inp.id = 'pin-' + Math.random().toString(36).slice(2, 9);

    /* Le champ doit être dans un conteneur .pw-wrap : on l'ajoute si besoin */
    let wrap = inp.parentElement;
    if (!wrap || !wrap.classList.contains('pw-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
    }
    inp.classList.add('has-eye');

    const btn = document.createElement('button');
    btn.type = 'button';                       // ne soumet jamais le formulaire
    btn.className = 'toggle pin-eye';
    btn.setAttribute('aria-controls', inp.id);
    setState(inp, btn, false);
    btn.addEventListener('mousedown', e => e.preventDefault()); // garde le curseur dans le champ
    btn.addEventListener('click', () => {
      const show = inp.type === 'password';
      const pos = inp.selectionStart;
      setState(inp, btn, show);
      inp.focus();
      try { if (pos != null) inp.setSelectionRange(pos, pos); } catch (e) { }
    });
    wrap.appendChild(btn);
  }

  function scan(root) {
    (root.querySelectorAll ? root : document)
      .querySelectorAll('input[type="password"]:not([data-eye])')
      .forEach(enhance);
  }

  /* Les écrans sont générés dynamiquement : on surveille la page */
  function start() {
    scan(document);
    new MutationObserver(muts => {
      for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="password"]')) enhance(n); else scan(n); } });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();