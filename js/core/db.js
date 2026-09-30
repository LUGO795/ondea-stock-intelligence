/* ██████████████████████████████████████████████████████████████
   ONDEA STOCK INTELLIGENCE — db.js
   Accès à IndexedDB (base locale du navigateur).

   Magasins (object stores) :
     products     → fiches produits
     categories   → catégories
     locations    → emplacements / entrepôts
     suppliers    → fournisseurs
     movements    → historique des mouvements (jamais modifiés, sauf le lien d'annulation)
     orders       → commandes fournisseurs
     inventories  → inventaires
     journal      → activité récente (créations, commandes, alertes…)
     media        → photos (Blob) des produits et logo de l'entreprise
     kv           → réglages, opérateurs, compteurs de numérotation

   Toutes les écritures passent par IDB.tx() : une seule transaction pour
   plusieurs magasins. Si une écriture échoue, AUCUNE n'est appliquée
   (atomicité garantie par IndexedDB).

   Si IndexedDB est indisponible (navigation privée stricte, iframe…),
   un stockage en mémoire prend le relais et un bandeau prévient l'utilisateur.
   ██████████████████████████████████████████████████████████████ */
"use strict";

const DB_NAME = 'OndeaStockIntelligenceDB';
const DB_VERSION = 1;
const STORES = ['products', 'categories', 'locations', 'suppliers', 'movements', 'orders', 'inventories', 'journal', 'media', 'kv'];

const IDB = {
  db: null,
  memory: null,      // repli en mémoire si IndexedDB n'est pas disponible
  get persistent() { return !!this.db; },

  /* Ouverture (et création des magasins au premier lancement) */
  open() {
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { this._fallback(e); return resolve(false); }
      const timer = setTimeout(() => { this._fallback(new Error('délai dépassé')); resolve(false); }, 5000);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        STORES.forEach(name => {
          if (d.objectStoreNames.contains(name)) return;
          const os = d.createObjectStore(name, { keyPath: name === 'kv' ? 'key' : 'id' });
          if (name === 'movements') { os.createIndex('productId', 'productId'); os.createIndex('at', 'at'); }
        });
      };
      req.onsuccess = e => {
        clearTimeout(timer);
        this.db = e.target.result;
        /* Une autre fenêtre met à jour la base : on ferme proprement */
        this.db.onversionchange = () => { this.db.close(); toast('La base a été mise à jour dans un autre onglet. Rechargez la page.', 'warn', 8000); };
        resolve(true);
      };
      req.onerror = e => { clearTimeout(timer); this._fallback(e.target.error); resolve(false); };
      req.onblocked = () => { toast('Fermez les autres onglets d\'Ondea Stock Intelligence puis rechargez.', 'warn', 8000); };
    });
  },
  _fallback(err) {
    console.warn('[Ondea Stock] IndexedDB indisponible, stockage en mémoire :', err);
    this.db = null;
    this.memory = {}; STORES.forEach(s => this.memory[s] = new Map());
  },

  /* Lecture de tout un magasin */
  getAll(store) {
    if (!this.db) return Promise.resolve([...(this.memory[store] || new Map()).values()].map(clone));
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const rq = tx.objectStore(store).getAll();
      rq.onsuccess = () => resolve(rq.result || []);
      rq.onerror = () => reject(rq.error);
    });
  },
  get(store, key) {
    if (!this.db) return Promise.resolve(clone(this.memory[store].get(key)) || null);
    return new Promise((resolve) => {
      const rq = this.db.transaction(store, 'readonly').objectStore(store).get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => resolve(null);
    });
  },

  /* Transaction d'écriture multi-magasins.
     fn reçoit un objet { put(store, obj), del(store, key), clear(store) }.
     La promesse est résolue quand TOUT est écrit, rejetée sinon (rien n'est écrit). */
  tx(storeNames, fn) {
    storeNames = [...new Set(storeNames)];
    if (!this.db) {
      /* Mode mémoire : on prépare les changements puis on les applique d'un bloc */
      const ops = [];
      const api = { put: (s, o) => ops.push(['put', s, clone(o)]), del: (s, k) => ops.push(['del', s, k]), clear: s => ops.push(['clear', s]) };
      try { fn(api); } catch (e) { return Promise.reject(e); }
      ops.forEach(([op, s, v]) => {
        const m = this.memory[s];
        if (op === 'put') m.set(v[s === 'kv' ? 'key' : 'id'], v); else if (op === 'del') m.delete(v); else m.clear();
      });
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = this.db.transaction(storeNames, 'readwrite'); }
      catch (e) { return reject(e); }
      const api = {
        put: (s, o) => tx.objectStore(s).put(o),
        del: (s, k) => tx.objectStore(s).delete(k),
        clear: s => tx.objectStore(s).clear()
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Erreur IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
      try { fn(api); } catch (e) { try { tx.abort(); } catch (_) { } reject(e); }
    });
  },

  /* ---- Médias (photos) ---- */
  async putMedia(blob, name = '', meta = {}) {
    const id = meta.id || uid('media');
    await this.tx(['media'], t => t.put('media', { id, blob, type: blob.type, name, at: nowStamp(), demo: !!meta.demo }));
    return id;
  },
  getMedia(id) { return id ? this.get('media', id) : Promise.resolve(null); },

  /* Estimation de l'espace utilisé (Chrome) */
  async estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { }
    return null;
  },
  /* Demande de stockage persistant (évite l'effacement automatique par le navigateur) */
  async persist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { }
    return false;
  }
};

/* Copie profonde simple (les objets métiers sont du JSON pur ; les Blob sont conservés) */
function clone(o) {
  if (o == null) return o;
  if (typeof structuredClone === 'function') { try { return structuredClone(o); } catch (e) { } }
  return JSON.parse(JSON.stringify(o));
}

/* ---------- Cache des URL d'images ----------
   Les photos sont stockées en Blob dans IndexedDB ; on crée une URL temporaire
   à la demande, UNIQUEMENT pour les vignettes affichées (pas de chargement massif). */
const MEDIA_URLS = new Map();
async function mediaURL(id) {
  if (!id) return null;
  if (MEDIA_URLS.has(id)) return MEDIA_URLS.get(id);
  const m = await IDB.getMedia(id);
  if (!m || !m.blob) return null;
  const u = URL.createObjectURL(m.blob);
  MEDIA_URLS.set(id, u);
  /* On limite le cache à 300 images pour préserver la mémoire */
  if (MEDIA_URLS.size > 300) { const [k, v] = MEDIA_URLS.entries().next().value; URL.revokeObjectURL(v); MEDIA_URLS.delete(k); }
  return u;
}
function forgetMediaURL(id) { if (MEDIA_URLS.has(id)) { URL.revokeObjectURL(MEDIA_URLS.get(id)); MEDIA_URLS.delete(id); } }

/* Remplit toutes les <img data-media="…"> d'une zone (vignettes visibles seulement) */
async function hydrateMedia(root = document) {
  const imgs = $$('img[data-media]', root);
  for (const img of imgs) {
    const id = img.dataset.media;
    const u = await mediaURL(id);
    if (u) { img.src = u; img.removeAttribute('data-media'); }
    else { img.closest('.av')?.classList.add('noimg'); }
  }
}
