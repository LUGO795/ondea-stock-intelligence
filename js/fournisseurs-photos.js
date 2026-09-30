/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — fournisseurs-photos.js  (AJOUT)
   Image de profil (logo ou photo) modifiable pour chaque fournisseur.
     • Formulaire « Nouveau / Modifier le fournisseur » : bloc
       « Image de profil » (choisir, remplacer, retirer).
     • Fiche fournisseur : boutons « Ajouter / Changer l'image »
       et « Retirer l'image » (retrait avec confirmation).
     • L'image remplace les initiales dans la liste des fournisseurs
       et dans la fiche ; elle s'agrandit au survol (image-zoom.js).
   Stockage : l'image est enregistrée dans la base locale (IndexedDB,
   magasin « media ») et reliée au fournisseur (champ photoId). Elle
   est donc incluse dans la sauvegarde complète JSON et restaurée
   avec elle. Les anciennes images inutilisées sont supprimées.
   À charger APRÈS app.js. Aucune modification des autres fichiers.
   ██████████████████████████████████████████████████████████████ */
"use strict";

(function () {
  if (typeof VIEWS === 'undefined' || typeof supplierForm !== 'function') return;

  const TAILLE = 1024;   // l'image est redimensionnée à 1024 px maximum
  const IC_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

  /* ---------- Styles (conventions Obsidienne & Or) ---------- */
  const st = document.createElement('style');
  st.id = 'fournisseurs-photos-style';
  st.textContent = `
    .sup-ph-block{display:flex;align-items:center;gap:16px;padding:14px;margin-bottom:14px;border:1px solid var(--or-line);border-radius:16px;background:var(--bg-elev)}
    .sup-ph-block .av{background:var(--bg-card)}
    .sup-ph-block .av svg{width:46%;height:46%;color:var(--txt-mute)}
    .sup-ph-block .sup-ph-t{display:flex;flex-direction:column;gap:8px;min-width:0}
    .sup-ph-block .sup-ph-t b{font-size:.95rem}
    .sup-ph-block small{color:var(--txt-soft);font-size:.8rem;line-height:1.4}
    .sup-ph-actions{display:flex;flex-wrap:wrap;gap:8px}
    .sup-ph-actions svg{width:15px;height:15px}
    .drawer-h .sup-ph-actions{margin-top:12px}
    .av.sup-ph{background:var(--bg-elev);padding:0;overflow:hidden}`;
  document.head.appendChild(st);

  const peutModifier = () => typeof can === 'function' && can('supplier.edit');
  const nomSimple = s => (s?.name || '').replace(/\s*\(démo\)\s*$/i, '');

  /* Une image n'est supprimée que si plus rien ne l'utilise (fournisseur, produit, logo) */
  async function supprimerSiInutilisee(mid) {
    if (!mid) return;
    const utilisee = S.suppliers.some(x => x.photoId === mid) || S.products.some(x => x.photoId === mid) || SETTINGS.logoId === mid;
    if (utilisee) return;
    try { await IDB.tx(['media'], t => t.del('media', mid)); } catch (e) { }
    forgetMediaURL(mid);
  }

  /* Enregistre (blob) ou retire (null) l'image d'un fournisseur */
  async function definirImage(id, blob) {
    requireRight('supplier.edit', 'modifier l\'image d\'un fournisseur');
    const s = supplierById(id); if (!s) throw new Error('Fournisseur introuvable.');
    const ancienne = s.photoId || null;
    const put = { suppliers: [] };
    let mid = null;
    if (blob) {
      mid = uid('media');
      put.media = [{ id: mid, blob, type: blob.type, name: 'fournisseur-' + nomSimple(s), at: nowStamp(), demo: false }];
    }
    put.suppliers.push({ ...clone(s), photoId: mid, updatedAt: nowStamp() });
    await commit({ put }, { what: 'supplier' });
    if (ancienne && ancienne !== mid) await supprimerSiInutilisee(ancienne);
  }

  /* Choix d'un fichier image → Blob redimensionné */
  function choisirImage() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; inp.remove();
        if (!f) return resolve(null);
        if (!/^image\//.test(f.type)) { toast('Choisissez un fichier image (JPEG, PNG, WebP ou SVG).', 'warn'); return resolve(null); }
        try { resolve(f.type === 'image/svg+xml' ? f : await resizeImage(f, TAILLE)); }
        catch (e) { toast('Image illisible : ' + e.message, 'dng'); resolve(null); }
      };
      document.body.appendChild(inp); inp.click();
    });
  }

  /* ═════════ 1. FORMULAIRE FOURNISSEUR : bloc « Image de profil » ═════════ */
  let ATTENTE = null;   // image choisie dans le formulaire, enregistrée avec le fournisseur

  const _form = supplierForm;
  supplierForm = function (id) {
    const r = _form.apply(this, arguments);
    const m = $('#overlay .modal');
    const body = m && $('.modal-b', m);
    if (!body || !$('#sfSave', m)) return r;
    const s = id ? supplierById(id) : null;
    ATTENTE = { id: id || null, modal: m, blob: null, retiree: false, url: null };
    body.insertAdjacentHTML('afterbegin', `<div class="sup-ph-block">
        <div class="av lg sup-ph" id="sfPhAv">${s?.photoId ? `<img data-media="${esc(s.photoId)}" alt="Image de profil actuelle">` : IC_IMG}</div>
        <div class="sup-ph-t"><b>Image de profil</b><small>Logo ou photo du fournisseur (JPEG, PNG, WebP ou SVG). Elle est enregistrée avec la fiche.</small>
          <div class="sup-ph-actions"><button type="button" class="btn sm" id="sfPhPick">${IC_IMG} ${s?.photoId ? 'Changer l\'image' : 'Choisir une image'}</button>
          <button type="button" class="btn sm ghost danger ${s?.photoId ? '' : 'hide'}" id="sfPhDel">${svg('trash')} Retirer</button></div></div></div>`);
    hydrateMedia($('#sfPhAv', m));
    $('#sfPhPick', m).onclick = async () => {
      const blob = await choisirImage(); if (!blob || !ATTENTE || ATTENTE.modal !== m) return;
      if (ATTENTE.url) URL.revokeObjectURL(ATTENTE.url);
      ATTENTE.blob = blob; ATTENTE.retiree = false; ATTENTE.url = URL.createObjectURL(blob);
      $('#sfPhAv', m).innerHTML = `<img src="${ATTENTE.url}" alt="Aperçu de la nouvelle image de profil">`;
      $('#sfPhDel', m).classList.remove('hide'); $('#sfPhPick', m).lastChild.textContent = ' Changer l\'image';
    };
    $('#sfPhDel', m).onclick = () => {
      if (!ATTENTE || ATTENTE.modal !== m) return;
      ATTENTE.blob = null; ATTENTE.retiree = true;
      $('#sfPhAv', m).innerHTML = IC_IMG;
      $('#sfPhDel', m).classList.add('hide'); $('#sfPhPick', m).lastChild.textContent = ' Choisir une image';
    };
    return r;
  };

  /* L'enregistrement du formulaire ajoute l'image choisie */
  const _save = saveSupplier;
  saveSupplier = async function (d, id) {
    const a = ATTENTE;
    const actif = a && a.modal && a.modal.isConnected && $('#overlay').classList.contains('on') && (a.id || null) === (id || null);
    if (!actif || (!a.blob && !a.retiree)) return _save.apply(this, arguments);
    const ancienne = id ? supplierById(id)?.photoId || null : null;
    let mid = null;
    if (a.blob) mid = await IDB.putMedia(a.blob, 'fournisseur-' + (d.name || ''), { demo: false });
    try {
      const res = await _save.call(this, { ...d, photoId: mid }, id);
      ATTENTE = null;
      if (ancienne && ancienne !== mid) await supprimerSiInutilisee(ancienne);
      return res;
    } catch (e) {
      if (mid) await supprimerSiInutilisee(mid);
      throw e;
    }
  };

  /* Suppression d'un fournisseur : son image est supprimée aussi */
  const _del = deleteSupplier;
  deleteSupplier = async function (id) {
    const mid = supplierById(id)?.photoId;
    const r = await _del.apply(this, arguments);
    await supprimerSiInutilisee(mid);
    return r;
  };
  /* Suppression de la démonstration : images des fournisseurs fictifs nettoyées */
  if (typeof removeDemoData === 'function') {
    const _rm = removeDemoData;
    removeDemoData = async function () {
      const avant = S.suppliers.filter(s => s.demo && s.photoId).map(s => s.photoId);
      const r = await _rm.apply(this, arguments);
      for (const mid of avant) await supprimerSiInutilisee(mid);
      return r;
    };
  }

  /* ═════════ 2. AFFICHAGE : liste et fiche fournisseur ═════════ */
  function avatar(av, s) {
    const cle = s.photoId || '';
    if (av.dataset.supPh === cle) return;
    av.dataset.supPh = cle;
    if (cle) {
      av.classList.add('photo', 'sup-ph');
      av.innerHTML = `<img data-media="${esc(cle)}" alt="Logo de ${esc(nomSimple(s))}">`;
      hydrateMedia(av);
    } else {
      av.classList.remove('photo', 'sup-ph');
      av.textContent = initialsOf(s.name);
    }
  }

  function actionsFiche(d, s) {
    const h = $('.drawer-h', d); if (!h) return;
    let zone = $('.sup-ph-actions', h);
    if (!peutModifier()) { if (zone) zone.remove(); return; }
    const etat = (s.photoId ? '1' : '0') + s.id;
    if (zone && zone.dataset.etat === etat) return;
    if (zone) zone.remove();
    h.insertAdjacentHTML('beforeend', `<div class="sup-ph-actions" data-etat="${etat}">
      <button type="button" class="btn sm" data-sup-ph-set="${esc(s.id)}">${IC_IMG} ${s.photoId ? 'Changer l\'image' : 'Ajouter une image de profil'}</button>
      ${s.photoId ? `<button type="button" class="btn sm ghost danger" data-sup-ph-del="${esc(s.id)}">${svg('trash')} Retirer l'image</button>` : ''}</div>`);
  }

  function decorer() {
    /* Liste des fournisseurs */
    $$('tr[data-sup]').forEach(tr => {
      const s = supplierById(tr.dataset.sup); const av = $('.cell-user > .av', tr);
      if (s && av) avatar(av, s);
    });
    /* Fiche fournisseur ouverte (panneau latéral) */
    const d = $('#drawer');
    if (d && d.classList.contains('on')) {
      const lab = d.getAttribute('aria-label') || '';
      if (lab.startsWith('Fiche fournisseur : ')) {
        const nom = lab.slice('Fiche fournisseur : '.length);
        const s = S.suppliers.find(x => x.name === nom);
        const av = s && $('.drawer-h .av.lg', d);
        if (s && av) { avatar(av, s); actionsFiche(d, s); }
      }
    }
  }
  let planifie = false;
  const planifier = () => { if (planifie) return; planifie = true; requestAnimationFrame(() => { planifie = false; try { decorer(); } catch (e) { console.warn(e); } }); };
  new MutationObserver(planifier).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'class'] });
  if (typeof onChange === 'function') onChange(planifier);

  /* Boutons de la fiche : changer / retirer l'image */
  document.addEventListener('click', async e => {
    const set = e.target.closest && e.target.closest('[data-sup-ph-set]');
    const del = e.target.closest && e.target.closest('[data-sup-ph-del]');
    if (set) {
      e.preventDefault();
      const blob = await choisirImage(); if (!blob) return;
      guard(set, async () => { await definirImage(set.dataset.supPhSet, blob); toast('Image de profil enregistrée', 'ok'); planifier(); });
    } else if (del) {
      e.preventDefault();
      const s = supplierById(del.dataset.supPhDel); if (!s) return;
      confirmDialog(`Retirer l'image de profil de « ${nomSimple(s)} » ?`, async () => { await definirImage(s.id, null); toast('Image de profil retirée', 'ok'); planifier(); },
        { title: 'Retirer l\'image de profil', yes: 'Retirer l\'image', danger: true, details: '<p class="muted" style="margin-top:8px">Les initiales du fournisseur s\'afficheront à la place. Vous pourrez ajouter une nouvelle image à tout moment.</p>' });
    }
  });

  planifier();
})();