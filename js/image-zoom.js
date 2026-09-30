/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — image-zoom.js  (AJOUT)
   Loupe d'accessibilité : au survol d'une image (photo produit,
   vignette du tableau, carte, logo…), l'image s'affiche EN GRAND
   à côté, avec sa légende en gros caractères, pour qu'elle soit
   parfaitement lisible, y compris par les personnes malvoyantes.
     • Souris : survol ≈ 0,3 s → agrandissement ; on sort → fermeture.
     • Clavier : une ligne ou une carte qui reçoit le focus (Tab)
       affiche aussi son image en grand.
     • Écran tactile : appui long (≈ 0,5 s) → agrandissement ;
       on relâche → fermeture.
     • Échap ferme l'agrandissement à tout moment.
   Image affichée en pleine définition (sans le recadrage des cartes),
   thèmes clair et sombre, taille du texte de l'application respectée,
   animations coupées si « réduire les animations » est activé.
   Fonctionne aussi pour les images ajoutées plus tard (changement de
   rubrique, fiches, fenêtres) : aucune modification des autres fichiers.
   À charger APRÈS app.js.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  const DELAI_SURVOL = 300;      // ms avant l'agrandissement au survol
  const DELAI_TACTILE = 450;     // ms d'appui long sur écran tactile
  const TAILLE_MAX = 640;        // largeur maximale de l'image agrandie (px)
  const DEJA_GRANDE = 420;       // une image déjà affichée plus large n'est pas agrandie

  /* ---------- Styles (reprennent les variables Obsidienne & Or) ---------- */
  const st = document.createElement('style');
  st.id = 'image-zoom-style';
  st.textContent = `
    .iz-loupe{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;
      display:flex;flex-direction:column;align-items:center;gap:12px;
      padding:14px 14px 16px;border-radius:20px;background:var(--bg-card,#161a20);
      border:2px solid var(--or-400,#d8b35e);
      box-shadow:0 0 0 6px var(--or-glow,rgba(201,162,75,.16)),0 24px 70px rgba(0,0,0,.55);
      opacity:0;transform:scale(.96);transition:opacity .16s ease,transform .16s ease;visibility:hidden}
    .iz-loupe.on{opacity:1;transform:none;visibility:visible}
    .iz-loupe img{display:block;border-radius:12px;object-fit:contain;background:#0b0d10;
      max-width:calc(100vw - 60px);max-height:calc(100vh - 170px)}
    .iz-loupe .iz-leg{max-width:100%;margin:0;text-align:center;font-family:var(--sans,system-ui,sans-serif);
      font-size:1.3rem;font-weight:700;line-height:1.35;color:var(--txt,#f6f3ec);overflow-wrap:anywhere}
    .iz-loupe .iz-aide{margin:0;font-family:var(--sans,system-ui,sans-serif);font-size:1rem;font-weight:600;
      color:var(--txt-soft,#c9c4b8)}
    .iz-loupe .iz-aide kbd{font:inherit;font-weight:800;padding:1px 8px;border-radius:6px;
      border:1px solid var(--or-line,rgba(201,162,75,.4));color:var(--or-400,#d8b35e)}
    img.iz-source{cursor:zoom-in;outline:3px solid var(--or-400,#d8b35e);outline-offset:2px}
    @media (prefers-reduced-motion:reduce){.iz-loupe{transition:none;transform:none}}
    @media (forced-colors:active){.iz-loupe{border-color:Highlight;background:Canvas}
      .iz-loupe .iz-leg,.iz-loupe .iz-aide{color:CanvasText}}
    @media print{.iz-loupe{display:none!important}}`;
  document.head.appendChild(st);

  /* ---------- Panneau d'agrandissement (unique, réutilisé) ---------- */
  const loupe = document.createElement('div');
  loupe.className = 'iz-loupe';
  loupe.setAttribute('aria-hidden', 'true');   // copie visuelle : la description (alt) est déjà lue par les lecteurs d'écran
  loupe.innerHTML = '<img alt=""><p class="iz-leg"></p><p class="iz-aide"><kbd>Échap</kbd> pour fermer</p>';
  const grandeImg = loupe.querySelector('img');
  const legende = loupe.querySelector('.iz-leg');
  const aide = loupe.querySelector('.iz-aide');
  const monter = () => { if (!loupe.isConnected) document.body.appendChild(loupe); };
  if (document.body) monter(); else document.addEventListener('DOMContentLoaded', monter);

  let source = null, minuteur = null, bloque = false;

  /* Image « agrandissable » : chargée, visible, pas déjà grande, hors loupe */
  function eligible(img) {
    if (!img || img.tagName !== 'IMG' || loupe.contains(img)) return false;
    if (!img.currentSrc && !img.getAttribute('src')) return false;
    if (!img.complete || !img.naturalWidth) return false;
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    return r.width < DEJA_GRANDE;
  }

  /* Texte de la légende : description de l'image, sinon le nom visible à côté */
  function texteLegende(img) {
    let t = (img.getAttribute('alt') || '').trim();
    if (!t) {
      const bloc = img.closest('[aria-label],[data-prod],.pcard,.cell-user,.sb-brand,.brand-mark');
      t = (bloc?.getAttribute('aria-label') || bloc?.querySelector('b,h4,h3')?.textContent || '').trim();
    }
    return t.replace(/^Photo de /, '');
  }

  function placer() {
    if (!source) return;
    const r = source.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, marge = 16;
    const lw = loupe.offsetWidth, lh = loupe.offsetHeight;
    /* À droite de l'image si possible, sinon à gauche, sinon centrée */
    let x = r.right + marge;
    if (x + lw > vw - marge) x = r.left - marge - lw;
    if (x < marge) x = Math.max(marge, (vw - lw) / 2);
    let y = r.top + r.height / 2 - lh / 2;
    y = Math.min(Math.max(marge, y), Math.max(marge, vh - lh - marge));
    loupe.style.left = Math.round(x) + 'px';
    loupe.style.top = Math.round(y) + 'px';
  }

  function afficher(img, viaClavier) {
    if (bloque || !eligible(img)) return;
    monter();
    if (source) source.classList.remove('iz-source');
    source = img;
    source.classList.add('iz-source');
    /* Taille : la plus grande possible dans l'écran, sans dépasser la définition réelle ×2 */
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = Math.min(TAILLE_MAX, img.naturalWidth * 2, innerWidth - 60, (innerHeight - 170) * ratio);
    w = Math.max(160, Math.round(w));
    grandeImg.src = img.currentSrc || img.src;
    grandeImg.style.width = w + 'px';
    grandeImg.style.height = Math.round(w / ratio) + 'px';
    legende.textContent = texteLegende(img);
    legende.style.display = legende.textContent ? '' : 'none';
    legende.style.width = w + 'px';
    aide.style.display = viaClavier ? '' : 'none';
    loupe.classList.add('on');
    placer();
  }

  function masquer() {
    clearTimeout(minuteur); minuteur = null;
    if (source) source.classList.remove('iz-source');
    source = null;
    loupe.classList.remove('on');
  }

  const programmer = (img, delai, viaClavier) => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => afficher(img, viaClavier), delai);
  };

  /* ---------- Souris ---------- */
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const img = e.target.closest ? e.target.closest('img') : null;
    if (!img || loupe.contains(img)) return;
    bloque = false;
    if (img !== source) programmer(img, DELAI_SURVOL, false);
  }, true);
  document.addEventListener('pointerout', e => {
    if (e.pointerType === 'touch') return;
    const img = e.target.closest ? e.target.closest('img') : null;
    if (!img) return;
    if (e.relatedTarget && img.contains(e.relatedTarget)) return;
    masquer();
  }, true);

  /* ---------- Écran tactile : appui long ---------- */
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') { masquer(); return; }      // un clic ferme la loupe
    const img = e.target.closest ? e.target.closest('img') : null;
    if (img) { bloque = false; programmer(img, DELAI_TACTILE, false); }
  }, true);
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, e => { if (e.pointerType === 'touch') masquer(); }, true));
  document.addEventListener('contextmenu', e => { if (source && e.target.closest && e.target.closest('img') === source) e.preventDefault(); }, true);

  /* ---------- Clavier : focus sur une ligne / carte / vignette contenant une image ---------- */
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (!el || !el.matches || !el.matches(':focus-visible')) return;   // seulement la navigation au clavier
    const img = el.tagName === 'IMG' ? el : el.querySelector && el.querySelector('img');
    if (img && !(el.matches('.modal *, [role="dialog"] *') && el.matches('input,select,textarea,button'))) { bloque = false; programmer(img, DELAI_SURVOL, true); }
    else masquer();
  });
  document.addEventListener('focusout', () => masquer());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (source || minuteur)) { bloque = true; masquer(); e.stopPropagation(); }
  }, true);

  /* ---------- Fermetures automatiques ---------- */
  addEventListener('scroll', masquer, true);
  addEventListener('resize', masquer);
  addEventListener('hashchange', masquer);
  addEventListener('blur', masquer);
  document.addEventListener('visibilitychange', masquer);
  /* L'image survolée disparaît (changement de vue, fiche fermée…) : on ferme */
  new MutationObserver(() => { if (source && !source.isConnected) masquer(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();