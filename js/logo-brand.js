/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — logo-brand.js  (AJOUT)
   Le logo de l'entreprise (Paramètres → Entreprise → Logo)
   remplace automatiquement le losange ◆ :
     • dans la carte de l'écran d'accueil / code PIN (.brand-mark) ;
     • en haut de la barre latérale, à côté de « Ondea Stock » (.sb-brand .mk).
   Mise à jour immédiate quand le logo est changé ou retiré,
   au démarrage, après une restauration de sauvegarde et dans les
   autres onglets ouverts. Sans logo : le losange ◆ d'origine revient.
   À charger APRÈS app.js. Aucune modification des autres fichiers.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  /* ---- Styles : le logo remplit la pastille, coins arrondis conservés ---- */
  const st = document.createElement('style');
  st.id = 'logo-brand-style';
  st.textContent = `
    .brand-mark.has-logo, .sb-brand .mk.has-logo{
      background:var(--bg-card); padding:0; overflow:hidden;
      box-shadow:0 0 0 1px var(--or-line), 0 8px 24px rgba(0,0,0,.25)}
    .brand-mark.has-logo img, .sb-brand .mk.has-logo img{
      width:100%; height:100%; display:block; object-fit:cover; border-radius:inherit}
    html[data-contrast="high"] .brand-mark.has-logo,
    html[data-contrast="high"] .sb-brand .mk.has-logo{box-shadow:0 0 0 2px var(--accent)}`;
  document.head.appendChild(st);

  const TARGETS = ['#loginBox .brand-mark', '.sb-brand .mk'];
  let applying = 0;

  async function applyBrandLogo() {
    const ticket = ++applying;
    const id = (typeof SETTINGS !== 'undefined' && SETTINGS) ? SETTINGS.logoId : null;
    let url = null;
    if (id) { try { url = await mediaURL(id); } catch (e) { url = null; } }
    if (ticket !== applying) return;            // un appel plus récent a pris le relais

    const name = (SETTINGS && SETTINGS.companyName) ? SETTINGS.companyName : 'l\'entreprise';
    TARGETS.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (url) {
        if (el.dataset.logo === id) return;     // déjà à jour
        el.dataset.logo = id;
        el.classList.add('has-logo');
        el.innerHTML = `<img src="${url}" alt="Logo de ${esc(name)}">`;
      } else if (el.dataset.logo) {
        delete el.dataset.logo;                 // logo retiré : retour au losange d'origine
        el.classList.remove('has-logo');
        el.textContent = '◆';
      }
    });
  }
  window.applyBrandLogo = applyBrandLogo;

  /* 1. À chaque modification enregistrée (paramètres, restauration, autre onglet…) */
  onChange(() => { applyBrandLogo(); });

  /* 2. À l'affichage de l'écran d'accueil / code PIN (démarrage, changement d'opérateur) */
  const _renderWelcome = renderWelcome;
  renderWelcome = function () {
    const r = _renderWelcome.apply(this, arguments);
    applyBrandLogo();
    return r;
  };

  /* 3. À la construction de la barre latérale (ouverture de session) */
  const _buildShell = buildShell;
  buildShell = function () {
    const r = _buildShell.apply(this, arguments);
    applyBrandLogo();
    return r;
  };
})();