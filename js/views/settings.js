/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — views/settings.js
   Paramètres : entreprise et logo, devise, format de date, seuils
   d'alerte, réapprovisionnement, TVA, unités, motifs, opérateurs,
   affichage (thème, contraste, taille du texte…), sauvegardes,
   données de démonstration et réinitialisation.
   ██████████████████████████████████████████████████████████████ */
"use strict";

/* Éditeur de liste (unités, motifs, conditions de paiement) */
function listEditor(id, label, values, hint = '') {
  return `<div class="field"><span class="flabel" id="${id}L">${esc(label)}</span>
    <div class="tag-list" id="${id}" role="list" aria-labelledby="${id}L">${values.map(v => `<span class="chip tag" role="listitem">${esc(v)}<button type="button" class="tag-x" data-tagdel="${esc(v)}" aria-label="Retirer ${esc(v)}">×</button></span>`).join('')}</div>
    <div class="row" style="margin-top:8px"><label class="sr-only" for="${id}New">Ajouter à « ${esc(label)} »</label><input class="inp" id="${id}New" placeholder="Ajouter…" style="max-width:240px"><button type="button" class="btn sm" data-tagadd="${id}">${svg('plus')} Ajouter</button></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
}
function readList(root, id) { return $$(`#${id} .tag`, root).map(t => t.firstChild.textContent.trim()); }
function bindListEditors(root) {
  $$('[data-tagadd]', root).forEach(b => {
    const id = b.dataset.tagadd; const inp = $('#' + id + 'New', root);
    const add = () => { const v = inp.value.trim(); if (!v) return; if (readList(root, id).some(x => norm(x) === norm(v))) return toast('Déjà présent.', 'warn');
      $('#' + id, root).insertAdjacentHTML('beforeend', `<span class="chip tag" role="listitem">${esc(v)}<button type="button" class="tag-x" data-tagdel="${esc(v)}" aria-label="Retirer ${esc(v)}">×</button></span>`); inp.value = ''; bindTagDel(root); };
    b.onclick = add; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  });
  bindTagDel(root);
}
function bindTagDel(root) { $$('[data-tagdel]', root).forEach(x => x.onclick = () => { const list = x.closest('.tag-list'); if (list.children.length <= 1) return toast('Au moins une valeur est nécessaire.', 'warn'); x.parentElement.remove(); }); }

VIEWS.settings = (el) => {
  const s = SETTINGS; const admin = SESSION_OP?.role === 'admin';
  const dis = admin ? '' : 'disabled';
  const size = Number(PREF.get('ondea_stock_textsize', 100)) || 100;
  el.innerHTML = pageHead('Paramètres', crumbFor('parametres'), admin ? `<button type="button" class="btn gold" id="stSaveAll">${svg('check')} Enregistrer les paramètres</button>` : '',
    admin ? 'Les réglages sont enregistrés dans ce navigateur (IndexedDB). Les préférences d\'affichage sont propres à chaque poste.' : 'Consultation seule : seuls les administrateurs peuvent modifier les paramètres de l\'entreprise.') +
    `<div class="settings-grid"><fieldset class="set-fs" ${dis}>
      <section class="panel"><div class="panel-h"><h3>Entreprise</h3></div><div class="panel-b">
        <div class="row" style="gap:16px;align-items:center;margin-bottom:14px"><div class="av lg logo-prev" id="stLogo">${s.logoId ? `<img data-media="${esc(s.logoId)}" alt="Logo actuel">` : `<span aria-hidden="true">${esc(initialsOf(s.companyName || 'O'))}</span>`}</div>
          <div><label class="btn sm ghost" style="cursor:pointer">${svg('up')} Logo de l'entreprise<input type="file" id="stLogoIn" accept="image/*" class="sr-only"></label> ${s.logoId ? `<button type="button" class="btn sm ghost danger" id="stLogoDel">Retirer</button>` : ''}<span class="hint d-block">Affiché sur les bons de commande et rapports imprimés.</span></div></div>
        ${fieldHTML({ id: 'stName', label: 'Nom de l\'entreprise', value: s.companyName, req: true })}
        ${textareaHTML({ id: 'stAddr', label: 'Adresse', value: s.address, rows: 2 })}
        <div class="grid-2">${fieldHTML({ id: 'stPhone', label: 'Téléphone', type: 'tel', value: s.phone })}${fieldHTML({ id: 'stMail', label: 'E-mail', type: 'email', value: s.email })}</div>
        <div class="grid-2">${fieldHTML({ id: 'stWeb', label: 'Site Internet', value: s.website })}${fieldHTML({ id: 'stSiret', label: 'SIRET', value: s.siret, attrs: 'inputmode="numeric"' })}</div>
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Formats et TVA</h3></div><div class="panel-b">
        <div class="grid-2">${selectHTML({ id: 'stCur', label: 'Devise', options: [['EUR', 'Euro (€)'], ['CHF', 'Franc suisse (CHF)'], ['USD', 'Dollar américain ($)'], ['GBP', 'Livre sterling (£)'], ['XPF', 'Franc CFP (XPF)'], ['MAD', 'Dirham marocain (MAD)'], ['CAD', 'Dollar canadien ($ CA)']], value: s.currency })}
          ${selectHTML({ id: 'stDate', label: 'Format de date', options: [['fr', '28/09/2026'], ['long', '28 sept. 2026'], ['iso', '2026-09-28']], value: s.dateFormat })}</div>
        <div class="grid-2">${fieldHTML({ id: 'stVat', label: 'Taux de TVA disponibles (%)', value: s.vatRates.map(v => String(v).replace('.', ',')).join(' ; '), hint: 'Séparés par « ; » — ex. 20 ; 10 ; 5,5 ; 2,1 ; 0' })}
          ${fieldHTML({ id: 'stVatDef', label: 'Taux par défaut (%)', value: String(s.defaultVat).replace('.', ','), attrs: 'inputmode="decimal"' })}</div>
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Seuils et alertes</h3></div><div class="panel-b">
        <div class="grid-2">${fieldHTML({ id: 'stMin', label: 'Seuil minimal par défaut (nouveaux produits)', value: s.defaultMinStock, attrs: 'inputmode="decimal"' })}${fieldHTML({ id: 'stNear', label: 'Marge « proche du seuil » (%)', value: s.nearPct, attrs: 'inputmode="numeric"', hint: 'Alerte si stock ≤ seuil + ce pourcentage.' })}</div>
        <div class="grid-3">${fieldHTML({ id: 'stDorm', label: 'Sans mouvement après (jours)', value: s.dormantDays, attrs: 'inputmode="numeric"' })}${fieldHTML({ id: 'stSpike', label: 'Hausse de consommation (×)', value: String(s.spikeRatio).replace('.', ','), attrs: 'inputmode="decimal"', hint: '30 derniers jours vs 30 précédents.' })}${fieldHTML({ id: 'stSpikeMin', label: 'Volume minimal de référence', value: s.spikeMinQty, attrs: 'inputmode="numeric"', hint: 'Évite les fausses alertes.' })}</div>
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Réapprovisionnement et valorisation</h3></div><div class="panel-b">
        <div class="grid-3">${fieldHTML({ id: 'stAna', label: 'Historique analysé (jours)', value: s.analysisDays, attrs: 'inputmode="numeric"', hint: 'Pour la consommation moyenne.' })}${fieldHTML({ id: 'stLead', label: 'Délai fournisseur par défaut (jours)', value: s.defaultLeadTime, attrs: 'inputmode="numeric"' })}${fieldHTML({ id: 'stCover', label: 'Couverture visée (jours)', value: s.coverDays, attrs: 'inputmode="numeric"', hint: 'Si aucun stock maximal n\'est défini.' })}</div>
        ${selectHTML({ id: 'stVal', label: 'Méthode de valorisation des entrées', options: [['cump', 'Coût unitaire moyen pondéré (CUMP) — recommandé'], ['last', 'Dernier prix d\'achat']], value: s.valuation, hint: 'Détermine le prix d\'achat utilisé pour la valeur du stock et le coût des sorties.' })}
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Listes de référence</h3></div><div class="panel-b">
        ${listEditor('stUnits', 'Unités de mesure', s.units)}
        ${listEditor('stReasons', 'Motifs de sortie', s.outReasons)}
        ${listEditor('stTerms', 'Conditions de paiement', s.paymentTerms)}
        <div class="row wrap" style="gap:10px;margin-top:6px"><a class="btn sm" href="#/categories">${svg('tag')} Catégories (${S.categories.length})</a><a class="btn sm" href="#/stocks">${svg('warehouse')} Emplacements (${S.locations.length})</a></div>
      </div></section>
    </fieldset>
    <div class="set-col">
      <section class="panel"><div class="panel-h"><h3>Affichage (ce poste)</h3></div><div class="panel-b">
        <div class="set-row"><span>Thème</span><div class="seg" role="group" aria-label="Thème"><button type="button" data-th="dark" class="${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}">Sombre</button><button type="button" data-th="light" class="${document.documentElement.dataset.theme === 'light' ? 'on' : ''}">Clair</button></div></div>
        <div class="set-row"><span>Contraste élevé</span><label class="switch"><input type="checkbox" id="stContrast" ${document.documentElement.getAttribute('data-contrast') === 'high' ? 'checked' : ''}><span class="sr-only">Contraste élevé</span></label></div>
        <div class="set-row"><span>Taille du texte</span><div class="seg" role="group" aria-label="Taille du texte">${TEXT_SIZES.map(z => `<button type="button" data-ts="${z}" class="${z === size ? 'on' : ''}" aria-pressed="${z === size}">${z} %</button>`).join('')}</div></div>
        <div class="set-row"><span>Animations d'arrière-plan</span><label class="switch"><input type="checkbox" id="stBg" ${BG_PAUSED ? '' : 'checked'}><span class="sr-only">Animations d'arrière-plan</span></label></div>
        <div class="set-row"><span>Son du bouton « retour en haut »</span><label class="switch"><input type="checkbox" id="stSound" ${PREF.get('osi_sound', 'on') === 'on' ? 'checked' : ''}><span class="sr-only">Son</span></label></div>
        <div class="set-row"><label for="stPage">Lignes par page</label><select class="sel" id="stPage" style="width:auto">${[25, 50, 100].map(n => `<option ${Number(SETTINGS.pageSize) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <p class="hint">Le réglage « Réduire les animations » de votre système est toujours respecté.</p>
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Opérateurs</h3>${admin ? `<button type="button" class="btn sm" id="opNew">${svg('plus')} Ajouter</button>` : ''}</div><div class="panel-b">
        ${OPERATORS.map(o => `<div class="list-row static"><div class="row"><div class="av sm" aria-hidden="true">${esc(initialsOf(o.name))}</div><div><b>${esc(o.name)}</b>${o.id === SESSION_OP?.id ? ' <span class="chip xs gold">vous</span>' : ''}${o.active === false ? ' <span class="chip xs">inactif</span>' : ''}<small class="muted d-block">${esc(ROLE_LABEL[o.role])}${o.pin ? ' · PIN' : ''}</small></div></div>${admin ? `<button type="button" class="btn icon sm" data-opedit="${o.id}" aria-label="Modifier ${esc(o.name)}">${svg('edit')}</button>` : ''}</div>`).join('')}
        <p class="hint" style="margin-top:10px">Chaque mouvement mémorise l'opérateur. Rôles : <b>Administrateur</b> (tout), <b>Responsable</b> (tout sauf paramètres et restauration), <b>Opérateur</b> (entrées, sorties, transferts, réceptions, comptages). Le code PIN limite l'accès sur un poste partagé mais ne constitue pas une sécurité forte (données locales).</p>
      </div></section>
      <section class="panel"><div class="panel-h"><h3>Données et sauvegardes</h3></div><div class="panel-b" id="stData">
        <div class="set-row"><span>Stockage</span><span id="stStore" class="mono soft">…</span></div>
        <div class="set-row"><span>Dernière sauvegarde exportée</span><span class="soft">${PREF.get('osi_last_backup') ? fmtDateTime(PREF.get('osi_last_backup')) : 'jamais'}</span></div>
        <div class="row wrap" style="gap:10px;margin-top:12px"><button type="button" class="btn gold" id="stBk">${svg('down')} Sauvegarde complète</button>${admin ? `<label class="btn" style="cursor:pointer">${svg('up')} Restaurer…<input type="file" id="stRs" accept="application/json,.json" class="sr-only"></label>` : ''}</div>
        ${S.products.some(p => p.demo) || S.suppliers.some(x => x.demo) ? `<div class="notice demo-notice" style="margin-top:16px">${svg('info')}<div class="grow">Des données de démonstration sont présentes.</div>${can('demo') ? `<button type="button" class="btn sm" id="stDemoDel">${svg('trash')} Supprimer la démo</button>` : ''}</div>` : (can('demo') ? `<button type="button" class="btn sm ghost" id="stDemoLoad" style="margin-top:14px">${svg('zap')} Charger des données de démonstration</button>` : '')}
        ${admin ? `<div class="danger-zone"><h4>Zone sensible</h4><p class="soft">Efface toutes les données de ce navigateur (produits, mouvements, commandes, réglages, opérateurs). Exportez une sauvegarde avant.</p><button type="button" class="btn danger sm" id="stReset">${svg('trash')} Tout réinitialiser</button></div>` : ''}
      </div></section>
    </div></div>`;
  bindListEditors(el); hydrateMedia(el);
  IDB.estimate().then(est => { const x = $('#stStore', el); if (x) x.textContent = (IDB.persistent ? 'IndexedDB' : 'mémoire temporaire') + (est?.usage != null ? ` · ${(est.usage / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo utilisés` + (est.quota ? ` sur ${(est.quota / 1073741824).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go` : '') : ''); });

  /* Affichage : appliqué immédiatement */
  $$('[data-th]', el).forEach(b => b.onclick = () => { applyTheme(b.dataset.th); $$('[data-th]', el).forEach(x => x.classList.toggle('on', x === b)); });
  $('#stContrast', el).onchange = e => applyContrast(e.target.checked);
  $$('[data-ts]', el).forEach(b => b.onclick = () => { applyTextSize(+b.dataset.ts); $$('[data-ts]', el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  $('#stBg', el).onchange = e => applyBgPause(!e.target.checked);
  $('#stSound', el).onchange = e => PREF.set('osi_sound', e.target.checked ? 'on' : 'off');
  $('#stPage', el).onchange = e => guard(null, async () => { await saveSettings({ pageSize: Number(e.target.value) }); toast('Pagination : ' + e.target.value + ' lignes', 'ok'); });

  /* Logo */
  if ($('#stLogoIn', el)) $('#stLogoIn', el).onchange = ev => guard(null, async () => {
    const f = ev.target.files[0]; if (!f) return; const blob = await resizeImage(f, 512);
    const id = await IDB.putMedia(blob, 'logo'); const old = SETTINGS.logoId;
    await saveSettings({ logoId: id }); if (old) { await IDB.tx(['media'], t => t.del('media', old)); forgetMediaURL(old); } toast('Logo enregistré', 'ok');
  });
  if ($('#stLogoDel', el)) $('#stLogoDel', el).onclick = () => guard(null, async () => { const old = SETTINGS.logoId; await saveSettings({ logoId: null }); if (old) await IDB.tx(['media'], t => t.del('media', old)); toast('Logo retiré', 'ok'); });

  /* Enregistrement des paramètres de l'entreprise */
  if ($('#stSaveAll', el)) $('#stSaveAll', el).onclick = e => guard(e.currentTarget, async () => {
    const intIn = (id, min, max, lbl) => { const n = parseNum(val(el, id)); if (isNaN(n) || n < min || n > max) throw new Error(`${lbl} : valeur attendue entre ${min} et ${max}.`); return n; };
    const vat = val(el, 'stVat').split(/[;\s]+/).filter(Boolean).map(parseNum);
    if (!vat.length || vat.some(v => isNaN(v) || v < 0 || v > 100)) throw new Error('Taux de TVA invalides : saisissez des nombres entre 0 et 100 séparés par « ; ».');
    const vatDef = parseNum(val(el, 'stVatDef'));
    if (!vat.includes(vatDef)) throw new Error('Le taux de TVA par défaut doit faire partie de la liste des taux.');
    const name = val(el, 'stName'); if (!name) { markInvalid(el, ['stName']); throw new Error('Le nom de l\'entreprise est obligatoire.'); }
    const siret = val(el, 'stSiret').replace(/\s/g, ''); if (siret && !/^\d{14}$/.test(siret)) throw new Error('Le SIRET doit comporter 14 chiffres.');
    await saveSettings({
      companyName: name, address: val(el, 'stAddr'), phone: val(el, 'stPhone'), email: val(el, 'stMail'), website: val(el, 'stWeb'), siret,
      currency: val(el, 'stCur'), dateFormat: val(el, 'stDate'), vatRates: [...new Set(vat)], defaultVat: vatDef,
      defaultMinStock: intIn('stMin', 0, 1e9, 'Seuil par défaut'), nearPct: intIn('stNear', 0, 500, 'Marge proche du seuil'), dormantDays: intIn('stDorm', 7, 3650, 'Jours sans mouvement'),
      spikeRatio: intIn('stSpike', 1.1, 20, 'Ratio de hausse'), spikeMinQty: intIn('stSpikeMin', 1, 1e9, 'Volume minimal'),
      analysisDays: intIn('stAna', 14, 730, 'Historique analysé'), defaultLeadTime: intIn('stLead', 0, 365, 'Délai par défaut'), coverDays: intIn('stCover', 1, 730, 'Couverture'),
      valuation: val(el, 'stVal'), units: readList(el, 'stUnits'), outReasons: readList(el, 'stReasons'), paymentTerms: readList(el, 'stTerms')
    });
    toast('Paramètres enregistrés — les alertes et recommandations sont recalculées.', 'ok');
  });

  /* Opérateurs */
  if ($('#opNew', el)) $('#opNew', el).onclick = () => operatorForm();
  $$('[data-opedit]', el).forEach(b => b.onclick = () => operatorForm(b.dataset.opedit));
  /* Données */
  $('#stBk', el).onclick = e => guard(e.currentTarget, exportBackup);
  if ($('#stRs', el)) $('#stRs', el).onchange = e => { const f = e.target.files[0]; if (f) restoreFromFile(f); e.target.value = ''; };
  if ($('#stDemoDel', el)) $('#stDemoDel', el).onclick = () => confirmRemoveDemo();
  if ($('#stDemoLoad', el)) $('#stDemoLoad', el).onclick = e => guard(e.currentTarget, async () => { await loadDemoData(); toast('Données de démonstration chargées', 'ok'); });
  if ($('#stReset', el)) $('#stReset', el).onclick = () => confirmDialog('Effacer DÉFINITIVEMENT toutes les données de ce navigateur ? Cette action est irréversible.', async () => {
    await IDB.tx(STORES, t => STORES.forEach(n => t.clear(n)));
    try { localStorage.removeItem('osi_session'); } catch (e) { }
    location.hash = ''; location.reload();
  }, { yes: 'Tout effacer', requireText: 'EFFACER', title: 'Réinitialisation complète' });
};

function operatorForm(id) {
  const o = id ? OPERATORS.find(x => x.id === id) : { role: 'operateur', active: true };
  openModal({
    title: id ? 'Modifier l\'opérateur' : 'Nouvel opérateur',
    body: fieldHTML({ id: 'opName', label: 'Prénom et nom', value: o.name || '', req: true }) +
      selectHTML({ id: 'opRole', label: 'Rôle', options: Object.entries(ROLE_LABEL), value: o.role }) +
      fieldHTML({ id: 'opPin', label: 'Code PIN (facultatif, 4 à 8 chiffres)', type: 'password', value: o.pin || '', attrs: 'inputmode="numeric" maxlength="8" autocomplete="new-password"' }) +
      (id && id !== SESSION_OP?.id ? `<label class="chk-inline"><input type="checkbox" id="opActive" ${o.active !== false ? 'checked' : ''}> Compte actif</label>` : ''),
    footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn gold" id="opSave">Enregistrer</button>`,
    onOpen: m => $('#opSave', m).onclick = e => guard(e.currentTarget, async () => {
      const name = val(m, 'opName'), pin = val(m, 'opPin'), role = val(m, 'opRole');
      if (!name) { formError(m, 'Le nom est obligatoire.'); return markInvalid(m, ['opName']); }
      if (pin && !/^\d{4,8}$/.test(pin)) { formError(m, 'Le code PIN doit contenir 4 à 8 chiffres.'); return markInvalid(m, ['opPin']); }
      const list = clone(OPERATORS);
      const active = $('#opActive', m) ? $('#opActive', m).checked : true;
      if (id) { const x = list.find(y => y.id === id); Object.assign(x, { name, pin, role, active }); }
      else list.push({ id: uid('op'), name, role, pin, active: true, createdAt: nowStamp() });
      if (!list.some(x => x.role === 'admin' && x.active !== false)) { formError(m, 'Il doit rester au moins un administrateur actif.'); return; }
      await saveOperators(list);
      if (id === SESSION_OP?.id) { SESSION_OP = list.find(x => x.id === id); }
      closeModal(1); toast('Opérateur enregistré', 'ok');
    })
  });
}
