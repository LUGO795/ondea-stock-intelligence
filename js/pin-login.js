/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — pin-login.js  (AJOUT)
   Retour rapide sur le poste : une fois l'espace créé, les
   renseignements restent enregistrés sur ce poste (IndexedDB),
   même après fermeture de l'onglet ou du navigateur.
   Au retour, l'écran d'accueil affiche directement la saisie
   du code PIN choisi à l'installation — rien d'autre à remplir.
     • Mémorise le dernier opérateur connecté sur ce poste.
     • Écran « Code PIN » direct, avec « Changer d'opérateur ».
     • 5 essais incorrects → pause de 30 secondes.
     • Demande au navigateur un stockage persistant (évite
       l'effacement automatique des données).
   À charger APRÈS app.js. Aucune modification des autres fichiers.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  const KEY_LAST_OP = 'osi_last_op';     // dernier opérateur connecté sur ce poste
  const MAX_TRIES = 5, LOCK_MS = 30000;  // anti-essais répétés
  let tries = 0, lockedUntil = 0;

  /* ---- 1. On retient l'opérateur à chaque ouverture de session ---- */
  const _openSession = openSession;
  openSession = function (op, first) {
    if (op && op.id) PREF.set(KEY_LAST_OP, op.id);
    tries = 0; lockedUntil = 0;
    return _openSession.apply(this, arguments);
  };

  /* ---- 2. Écran d'accueil : saisie directe du code PIN ---- */
  const _renderWelcome = renderWelcome;
  renderWelcome = function () {
    /* Première utilisation (aucun opérateur) : assistant d'origine */
    if (!OPERATORS.length) return _renderWelcome.apply(this, arguments);

    const actifs = OPERATORS.filter(o => o.active !== false);
    const lastId = PREF.get(KEY_LAST_OP);
    const op = actifs.find(o => o.id === lastId) || (actifs.length === 1 ? actifs[0] : null);

    /* Opérateur inconnu ou sans code PIN : comportement d'origine */
    if (!op || !op.pin) return _renderWelcome.apply(this, arguments);

    renderPinOnly(op);
  };

  function renderPinOnly(op) {
    const body = $('#loginBody');
    const prenom = (op.name || '').split(' ')[0];
    $('#loginTitle').innerHTML = `Bon retour, <span class="gold">${esc(prenom)}</span>`;
    $('#loginSub').textContent = (SETTINGS.companyName ? SETTINGS.companyName + ' · ' : '') + 'Saisissez votre code PIN pour accéder à vos stocks.';
    body.innerHTML = `
      <div id="loginErr" class="login-err hide" role="alert"></div>
      <div class="demo-btn" style="cursor:default;margin-bottom:14px" aria-hidden="true">
        <div class="av sm">${esc(initialsOf(op.name))}</div>
        <div><div style="font-weight:700;font-size:.9rem">${esc(op.name)}</div><small>${esc(ROLE_LABEL[op.role] || '')}</small></div>
      </div>
      <form id="pinOnlyForm" autocomplete="off" novalidate>
        <div class="field"><label for="pinOnly">Code PIN de ${esc(op.name)}</label>
          <div class="pw-wrap"><input class="inp" id="pinOnly" type="password" inputmode="numeric" autocomplete="off"
            placeholder="••••" maxlength="8" aria-describedby="pinOnlyHint" required></div>
          <span class="hint" id="pinOnlyHint">Le code à 4 à 8 chiffres choisi lors de l'installation.</span>
        </div>
        <button class="btn gold" id="pinOnlyBtn" type="submit" style="width:100%;margin-top:6px;padding:12px">${svg('check')} Accéder à mes stocks</button>
      </form>
      <p style="margin-top:14px;text-align:center"><button type="button" class="link-btn" id="pinSwitch">Changer d'opérateur</button></p>
      <p class="muted" style="font-size:.78rem;margin-top:12px;line-height:1.5">${svg('shield', 'inl')} Vos renseignements sont mémorisés sur ce poste (${IDB.persistent ? 'IndexedDB' : '<b>mémoire temporaire</b>'}). Pensez aux sauvegardes régulières.</p>`;

    const inp = $('#pinOnly'), err = $('#loginErr');
    const showErr = msg => { err.textContent = msg; err.classList.remove('hide'); inp.setAttribute('aria-invalid', 'true'); };

    $('#pinOnlyForm').onsubmit = e => {
      e.preventDefault();
      const now = Date.now();
      if (now < lockedUntil) { showErr(`Trop d'essais. Réessayez dans ${Math.ceil((lockedUntil - now) / 1000)} s.`); return; }
      if (inp.value === op.pin) { inp.removeAttribute('aria-invalid'); openSession(op); return; }
      tries++;
      if (tries >= MAX_TRIES) { tries = 0; lockedUntil = now + LOCK_MS; showErr('Code PIN incorrect. Trop d\'essais : patientez 30 secondes.'); }
      else showErr(`Code PIN incorrect (${MAX_TRIES - tries} essai(s) restant(s)).`);
      inp.value = ''; inp.focus();
    };
    /* Accès à la liste complète des opérateurs (écran d'origine) */
    $('#pinSwitch').onclick = () => { PREF.set(KEY_LAST_OP, ''); _renderWelcome(); };

    setTimeout(() => inp.focus(), 150);
  }

  /* ---- 3. Stockage persistant demandé à chaque démarrage ---- */
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { if (typeof IDB !== 'undefined' && IDB.persist) IDB.persist(); } catch (e) { } }, 1500);
  });
})();