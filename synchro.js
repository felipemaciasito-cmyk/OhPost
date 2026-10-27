/*
 * PostsOP — stockage et synchronisation
 *
 * Chaque appareil garde une copie complète de tes données (IndexedDB) : l'app marche sans connexion.
 * Quand une connexion GitHub est configurée, la synchronisation compare chaque fichier
 * avec ton dépôt privé grâce à son empreinte (sha) :
 *   - modifié ici seulement        → envoyé ;
 *   - modifié là-bas seulement     → récupéré ;
 *   - modifié des deux côtés       → rien n'est écrasé : ta version locale est gardée en copie « (conflit) » ;
 *   - supprimé d'un côté           → supprimé de l'autre, sauf si l'autre côté l'a modifié entre-temps.
 * Chaque envoi crée une version dans l'historique GitHub : on peut toujours revenir en arrière.
 */
(function (racine) {
  'use strict';

  /* ---------- Encodages ---------- */

  const texteVersOctets = (texte) => new TextEncoder().encode(texte);
  const octetsVersTexte = (octets) => new TextDecoder().decode(octets);

  function versBase64(octets) {
    let binaire = '';
    for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(binaire);
  }
  function depuisBase64(texte) {
    const binaire = atob(String(texte).replace(/\s/g, ''));
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return octets;
  }

  /* ---------- Client GitHub (API Contents) ---------- */

  function creerClientGitHub({ proprietaire, depot, cle, fetch: f = racine.fetch && racine.fetch.bind(racine) }) {
    const base = `https://api.github.com/repos/${encodeURIComponent(proprietaire)}/${encodeURIComponent(depot)}`;
    const entetes = (extra = {}) => ({ Authorization: 'Bearer ' + cle, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra });
    const url = (chemin) => base + '/contents/' + chemin.split('/').map(encodeURIComponent).join('/');

    async function appeler(methode, adresse, corps, extra) {
      let reponse;
      try {
        reponse = await f(adresse, { method: methode, headers: entetes(extra), body: corps ? JSON.stringify(corps) : undefined, cache: 'no-store' });
      } catch (erreur) {
        const e = new Error('Pas de connexion à GitHub.'); e.code = 'reseau'; throw e;
      }
      return reponse;
    }
    async function erreurDe(reponse, action) {
      let detail = '';
      try { detail = (await reponse.json()).message || ''; } catch (e) { /* corps vide */ }
      const messages = {
        401: 'Clé d’accès refusée : vérifie-la ou crée-en une nouvelle.',
        403: 'Accès refusé : la clé n’a pas le droit d’écrire dans ce dépôt, ou la limite de requêtes est atteinte.',
        404: 'Dépôt introuvable : vérifie ton pseudo et le nom du dépôt.',
        409: 'Le fichier a changé sur GitHub pendant l’envoi.',
        422: 'GitHub a refusé la demande.',
      };
      const e = new Error((messages[reponse.status] || `Erreur GitHub ${reponse.status}`) + (detail ? ` (${detail})` : ''));
      e.code = reponse.status; e.action = action; throw e;
    }

    return {
      async tester() {
        const r = await appeler('GET', base);
        if (!r.ok) await erreurDe(r, 'tester');
        const infos = await r.json();
        return { prive: !!infos.private, ecriture: !!(infos.permissions && (infos.permissions.push || infos.permissions.admin)), nom: infos.full_name };
      },
      // Liste un dossier : { chemin: sha }. Un dossier ou un dépôt vide donne une liste vide.
      async lister(dossier) {
        const r = await appeler('GET', dossier ? url(dossier) : base + '/contents');
        if (r.status === 404) return {};
        if (!r.ok) await erreurDe(r, 'lister');
        const liste = await r.json();
        const sortie = {};
        if (Array.isArray(liste)) for (const e of liste) if (e.type === 'file') sortie[e.path] = e.sha;
        return sortie;
      },
      async lire(chemin) {
        const r = await appeler('GET', url(chemin));
        if (!r.ok) await erreurDe(r, 'lire');
        const infos = await r.json();
        if (infos.content && infos.encoding === 'base64') return { octets: depuisBase64(infos.content), sha: infos.sha };
        // Fichier de plus d'1 Mo : on le demande en brut.
        const brut = await appeler('GET', url(chemin), null, { Accept: 'application/vnd.github.raw' });
        if (!brut.ok) await erreurDe(brut, 'lire');
        return { octets: new Uint8Array(await brut.arrayBuffer()), sha: infos.sha };
      },
      async ecrire(chemin, octets, sha, message) {
        const r = await appeler('PUT', url(chemin), { message, content: versBase64(octets), ...(sha ? { sha } : {}) });
        if (!r.ok) await erreurDe(r, 'ecrire');
        return (await r.json()).content.sha;
      },
      async supprimer(chemin, sha, message) {
        const r = await appeler('DELETE', url(chemin), { message, sha });
        if (!r.ok && r.status !== 404) await erreurDe(r, 'supprimer');
      },
    };
  }

  /* ---------- Magasins locaux ---------- */

  // Entrée : { chemin, octets: Uint8Array, shaBase: sha du dernier état synchronisé, sale: modifié ici, supprime: effacé ici }
  function creerMagasinMemoire() {
    const donnees = new Map();
    const copie = (e) => (e ? { ...e, octets: e.octets ? new Uint8Array(e.octets) : e.octets } : undefined);
    return {
      async lire(chemin) { return copie(donnees.get(chemin)); },
      async ecrire(entree) { donnees.set(entree.chemin, copie(entree)); },
      async effacer(chemin) { donnees.delete(chemin); },
      async tout() { return [...donnees.values()].map(copie); },
    };
  }

  function creerMagasinIndexedDB(nom = 'postsop-app') {
    let base = null;
    const ouvrir = () => base || (base = new Promise((resoudre, rejeter) => {
      const r = indexedDB.open(nom, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fichiers', { keyPath: 'chemin' });
      r.onsuccess = () => resoudre(r.result);
      r.onerror = () => rejeter(r.error);
    }));
    const transaction = async (mode, action) => {
      const b = await ouvrir();
      return new Promise((resoudre, rejeter) => {
        const t = b.transaction('fichiers', mode);
        const requete = action(t.objectStore('fichiers'));
        t.oncomplete = () => resoudre(requete && requete.result);
        t.onerror = () => rejeter(t.error);
      });
    };
    return {
      lire: (chemin) => transaction('readonly', (s) => s.get(chemin)),
      ecrire: (entree) => transaction('readwrite', (s) => s.put(entree)),
      effacer: (chemin) => transaction('readwrite', (s) => s.delete(chemin)),
      tout: () => transaction('readonly', (s) => s.getAll()),
    };
  }

  /* ---------- Dépôt : données de l'app ---------- */

  const DOSSIERS = ['', 'articles', 'ressources'];
  const estJSON = (chemin) => chemin.endsWith('.json');

  function creerDepot({ magasin, client = null, horloge = () => new Date() }) {
    let clientActuel = client;

    async function ecrireLocal(chemin, octets, initial = false) {
      const avant = await magasin.lire(chemin);
      await magasin.ecrire({ chemin, octets, shaBase: avant ? avant.shaBase : null, sale: !initial, supprime: false, modifie: horloge().toISOString(), version: (avant && avant.version || 0) + 1 });
    }

    const depot = {
      configurer(nouveau) { clientActuel = nouveau; },
      estConfigure: () => !!clientActuel,

      async lireTout() {
        const entrees = (await magasin.tout()).filter((e) => !e.supprime && e.octets);
        const projetEntree = entrees.find((e) => e.chemin === 'projet.json');
        return {
          projet: projetEntree ? JSON.parse(octetsVersTexte(projetEntree.octets)) : null,
          articles: entrees.filter((e) => e.chemin.startsWith('articles/') && estJSON(e.chemin)).map((e) => JSON.parse(octetsVersTexte(e.octets))),
          ressources: Object.fromEntries(entrees.filter((e) => e.chemin.startsWith('ressources/')).map((e) => [e.chemin, e.octets])),
        };
      },
      ecrireJSON: (chemin, objet, options = {}) => ecrireLocal(chemin, texteVersOctets(JSON.stringify(objet, null, 2)), !!options.initial),
      ecrireBinaire: (chemin, octets) => ecrireLocal(chemin, octets instanceof Uint8Array ? octets : new Uint8Array(octets)),
      async supprimer(chemin) {
        const avant = await magasin.lire(chemin);
        if (!avant) return;
        if (!avant.shaBase) await magasin.effacer(chemin); // jamais envoyé : on l'efface simplement
        else await magasin.ecrire({ ...avant, octets: null, supprime: true, sale: true, modifie: horloge().toISOString(), version: (avant.version || 0) + 1 });
      },
      async oublierNonSynchronises() {
        for (const e of await magasin.tout()) if (!e.sale && !e.shaBase) await magasin.effacer(e.chemin);
      },
      async distantContientDesArticles() {
        if (!clientActuel) return false;
        return Object.keys(await clientActuel.lister('articles')).length > 0;
      },
      async changementsEnAttente() {
        return (await magasin.tout()).filter((e) => e.sale).length;
      },
      // Ce qui n'est pas encore copié sur GitHub : un fichier par changement (article, réglages, police…).
      async enAttente() {
        return (await magasin.tout()).filter((e) => e.sale).map((e) => ({ chemin: e.chemin, supprime: !!e.supprime }));
      },

      async synchroniser() {
        if (!clientActuel) throw Object.assign(new Error('Synchronisation non configurée.'), { code: 'non-configure' });
        const c = clientActuel;
        const rapport = { recus: 0, envoyes: 0, supprimes: 0, conflits: [] };
        const distant = {};
        for (const dossier of DOSSIERS) {
          const liste = await c.lister(dossier);
          for (const [chemin, sha] of Object.entries(liste)) if (chemin === 'projet.json' || chemin.startsWith('articles/') || chemin.startsWith('ressources/')) distant[chemin] = sha;
        }
        const locales = Object.fromEntries((await magasin.tout()).map((e) => [e.chemin, e]));
        const chemins = new Set([...Object.keys(distant), ...Object.keys(locales)]);
        const message = (verbe, chemin) => `PostsOP : ${verbe} ${chemin}`;

        const modifieEntreTemps = async (chemin, avant) => {
          const actuel = await magasin.lire(chemin);
          return actuel && avant && (actuel.version || 0) !== (avant.version || 0) ? actuel : null;
        };
        const recevoir = async (chemin, avant) => {
          const { octets, sha } = await c.lire(chemin);
          if (await modifieEntreTemps(chemin, avant)) return; // modifié pendant la synchro : traité au prochain passage
          await magasin.ecrire({ chemin, octets, shaBase: sha, sale: false, supprime: false, modifie: horloge().toISOString(), version: (avant && avant.version || 0) + 1 });
          rapport.recus++;
        };
        const envoyer = async (chemin, entree, sha) => {
          const nouveau = await c.ecrire(chemin, entree.octets, sha, message(sha ? 'mise à jour de' : 'ajout de', chemin));
          const actuel = await modifieEntreTemps(chemin, entree);
          // Si tu as encore modifié le fichier pendant l'envoi, il reste à envoyer, sur la bonne base.
          await magasin.ecrire(actuel ? { ...actuel, shaBase: nouveau, sale: true } : { ...entree, shaBase: nouveau, sale: false });
          rapport.envoyes++;
        };
        // Conflit sur un article : la version locale devient un nouvel article « (conflit) », la version distante reprend sa place.
        const sauverEnCopie = async (chemin, entree) => {
          if (chemin.startsWith('articles/') && estJSON(chemin)) {
            const article = JSON.parse(octetsVersTexte(entree.octets));
            const id = article.id + '-conflit-' + horloge().getTime();
            const copie = { ...article, id, titre: article.titre + ' (conflit, version de cet appareil)' };
            const cheminCopie = `articles/${id}.json`;
            await magasin.ecrire({ chemin: cheminCopie, octets: texteVersOctets(JSON.stringify(copie, null, 2)), shaBase: null, sale: true, supprime: false, modifie: horloge().toISOString() });
            rapport.conflits.push({ chemin, copie: cheminCopie, titre: article.titre });
          } else {
            rapport.conflits.push({ chemin, copie: null, titre: chemin });
          }
        };

        for (const chemin of chemins) {
          const L = locales[chemin];
          const R = distant[chemin];
          if (!L) { await recevoir(chemin, null); continue; }
          if (L.supprime) {
            if (!R) await magasin.effacer(chemin);
            else if (R === L.shaBase) { await c.supprimer(chemin, R, message('suppression de', chemin)); await magasin.effacer(chemin); rapport.supprimes++; }
            else { await recevoir(chemin, L); rapport.conflits.push({ chemin, copie: null, titre: chemin, raison: 'modifié ailleurs après ta suppression : il a été gardé' }); }
            continue;
          }
          if (!L.sale) {
            if (!R) { if (L.shaBase) { await magasin.effacer(chemin); rapport.supprimes++; } else await envoyer(chemin, L, null); }
            else if (R !== L.shaBase) await recevoir(chemin, L);
            continue;
          }
          // Modifié ici.
          if (!R) { await envoyer(chemin, L, null); continue; }
          if (R === L.shaBase) { await envoyer(chemin, L, R); continue; }
          await sauverEnCopie(chemin, L);
          const rafraichi = await magasin.lire(chemin);
          await recevoir(chemin, rafraichi);
        }
        // Les copies « (conflit) » créées pendant ce passage sont envoyées tout de suite.
        for (const conflit of rapport.conflits) {
          if (!conflit.copie) continue;
          const entree = await magasin.lire(conflit.copie);
          if (entree && entree.sale) await envoyer(conflit.copie, entree, null);
        }
        return rapport;
      },
    };
    return depot;
  }

  const api = { creerClientGitHub, creerMagasinMemoire, creerMagasinIndexedDB, creerDepot, versBase64, depuisBase64, texteVersOctets, octetsVersTexte };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPSynchro = api;
})(typeof window !== 'undefined' ? window : globalThis);
