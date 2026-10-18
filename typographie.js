/*
 * PostsOP — typographie française automatique
 *
 * Quatre règles, appliquées au collage et pendant la frappe, dans le texte de l'article comme sur les slides :
 *   1. une espace insécable avant ? ! : ; et à l'intérieur des guillemets « » (espace normale, décision du 18 octobre 2026) ;
 *   2. les guillemets droits "…" deviennent « … » ;
 *   3. l'apostrophe droite ' devient l'apostrophe typographique ’ ;
 *   4. trois points ... deviennent le caractère des points de suspension ….
 *
 * Rien ne change en silence : chaque correction est annoncée et peut être annulée.
 * Pendant la saisie, seules les corrections qui touchent ce qui vient d'être tapé ou collé sont faites :
 * une correction annulée ailleurs dans le texte n'est jamais refaite d'elle-même.
 * Sont protégés : les adresses web et e-mail, les heures et rapports (14:30, 1:2), les nombres (1'000),
 * les retours à la ligne choisis pour la mise en page, et les limites entre paragraphes de slides.
 *
 * Une correction (« remplacement ») : { debut, fin, texte, ancien, regle, signe }, positions dans le texte de départ.
 */
(function (racine) {
  'use strict';

  const L = racine.PostsOPLiens || (typeof require !== 'undefined' ? require('./liens.js') : null);

  const NB = '\u00A0'; // espace insécable (la police n'a pas d'espace fine : espace normale partout)
  const ESPACES = ' \t\u00A0\u202F\u2009\u2007';
  const estEspace = (c) => c !== undefined && c !== '' && ESPACES.includes(c);
  const insecableSeule = (passage) => passage === NB || passage === '\u202F';
  // Caractères auxquels une ponctuation double peut être collée par une espace insécable.
  const COLLABLE = /[\p{L}\p{N})\]}»”’"'%*]/u;
  const AVANT_OUVRANT = '([{—–-/«';
  const PROTOCOLES = /^(?:https?|ftp|mailto|file|tel|sms)$/i;
  // Le mot qui se termine juste avant la position « fin » (pour reconnaître « http » dans « http: »).
  function motAvant(t, fin) {
    let d = fin;
    while (d > 0 && !/\s/.test(t[d - 1])) d--;
    return t.slice(d, fin);
  }

  // Passages à ne jamais toucher : adresses web et e-mail.
  function zonesProtegees(texte) {
    const zones = [];
    const motifs = [/(?:https?:\/\/|ftp:\/\/|mailto:|www\.)[^\s«»"<>]+/gi, /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g];
    for (const motif of motifs) {
      let m;
      while ((m = motif.exec(texte))) zones.push([m.index, m.index + m[0].length]);
    }
    return zones;
  }

  /* ---------- Toutes les corrections possibles d'un texte ---------- */

  function corrections(texte) {
    const t = String(texte || '');
    const trouvees = [];
    const ajouter = (debut, fin, remplacement, regle, signe, declencheur) => {
      const ancien = t.slice(debut, fin);
      if (ancien === remplacement) return;
      trouvees.push({ debut, fin, texte: remplacement, ancien, regle, signe, declencheur });
    };
    let profondeur = 0; // guillemets ouverts dans la ligne en cours
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (c === '\n') { profondeur = 0; continue; }

      if (c === '?' || c === '!' || c === ';' || c === ':') {
        const prec = t[k - 1];
        if (prec === '?' || prec === '!' || (c === ':' && prec === ':')) continue; // suite d'une ponctuation (?! !!) : rien entre les signes
        if (c === ';' || c === ':') {
          const suiv = t[k + 1];
          if (!(suiv === undefined || suiv === '\n' || estEspace(suiv) || '»"«'.includes(suiv))) continue; // 14:30, https://, ;) …
        }
        let j = k;
        while (j > 0 && estEspace(t[j - 1])) j--;
        if (j < k) {
          if (j === 0 || t[j - 1] === '\n') continue; // rien à quoi l'attacher
          if (c === ':' && PROTOCOLES.test(motAvant(t, j))) continue;
          if (insecableSeule(t.slice(j, k))) continue;
          ajouter(j, k + 1, NB + c, 'espace', c, [j - 1, k + 1]);
        } else {
          if (prec === undefined || prec === '\n' || !COLLABLE.test(prec)) continue;
          if (c === ':' && /\d/.test(prec)) continue; // heures et rapports : 14:30
          if (c === ':' && PROTOCOLES.test(motAvant(t, k))) continue; // http:
          ajouter(k, k + 1, NB + c, 'espace', c, [k - 1, k + 1]);
        }
        continue;
      }

      if (c === '«') {
        profondeur++;
        let j = k + 1;
        while (estEspace(t[j])) j++;
        if (t[j] === undefined || t[j] === '\n') continue; // rien encore après : on attend la suite
        if (insecableSeule(t.slice(k + 1, j))) continue;
        ajouter(k, j, '«' + NB, 'espace', '«', [k, j + 1]);
        continue;
      }

      if (c === '»') {
        profondeur = Math.max(0, profondeur - 1);
        let j = k;
        while (j > 0 && estEspace(t[j - 1])) j--;
        if (j === 0 || t[j - 1] === '\n') continue;
        if (insecableSeule(t.slice(j, k))) continue;
        ajouter(j, k + 1, NB + '»', 'espace', '»', [j - 1, k + 1]);
        continue;
      }

      if (c === '"') {
        const prec = t[k - 1];
        const colle = prec !== undefined && prec !== '\n' && !estEspace(prec) && !AVANT_OUVRANT.includes(prec);
        if (!colle && profondeur === 0) {
          profondeur++;
          let j = k + 1;
          while (estEspace(t[j])) j++;
          ajouter(k, j, '«' + NB, 'guillemets', '"', [k, j]);
        } else {
          profondeur = Math.max(0, profondeur - 1);
          let j = k;
          while (j > 0 && estEspace(t[j - 1])) j--;
          if (j === 0 || t[j - 1] === '\n') ajouter(j, k + 1, '»', 'guillemets', '"', [j, k + 1]);
          else ajouter(j, k + 1, NB + '»', 'guillemets', '"', [j, k + 1]);
        }
        continue;
      }

      if (c === "'") {
        if (/\d/.test(t[k - 1] || '') && /\d/.test(t[k + 1] || '')) continue; // 1'000
        ajouter(k, k + 1, '’', 'apostrophe', "'", [k, k + 1]);
        continue;
      }

      if (c === '.' && t[k + 1] === '.' && t[k + 2] === '.' && t[k - 1] !== '.' && t[k + 3] !== '.') {
        ajouter(k, k + 3, '…', 'suspension', '...', [k, k + 3]);
        k += 2;
      }
    }
    // Hors des adresses, et jamais deux corrections sur les mêmes caractères.
    const protege = new Uint8Array(t.length + 1);
    for (const [d, f] of zonesProtegees(t)) protege.fill(1, d, f);
    const touchePassageProtege = (r) => { for (let k = r.debut; k < r.fin; k++) if (protege[k]) return true; return false; };
    const sortie = [];
    let borne = -1;
    for (const r of trouvees.sort((a, b) => a.debut - b.debut)) {
      if (r.debut < borne) continue;
      if (touchePassageProtege(r)) continue;
      sortie.push(r);
      borne = r.fin;
    }
    return sortie;
  }

  /* ---------- Outils sur une liste de remplacements ---------- */

  function appliquer(texte, remplacements) {
    let sortie = '';
    let curseur = 0;
    for (const r of remplacements) {
      sortie += texte.slice(curseur, r.debut) + r.texte;
      curseur = r.fin;
    }
    return sortie + texte.slice(curseur);
  }

  // Position après les remplacements (une position prise dans un passage remplacé va à la fin de son remplacement).
  function placer(position, remplacements) {
    let ecart = 0;
    for (const r of remplacements) {
      if (position >= r.fin) ecart += r.texte.length - (r.fin - r.debut);
      else if (position > r.debut) return r.debut + ecart + r.texte.length;
      else break;
    }
    return position + ecart;
  }

  // Les mêmes remplacements, à l'envers, exprimés dans le texte corrigé : de quoi revenir en arrière.
  function inverser(remplacements) {
    let ecart = 0;
    return remplacements.map((r) => {
      const debut = r.debut + ecart;
      ecart += r.texte.length - (r.fin - r.debut);
      return { debut, fin: debut + r.texte.length, texte: r.ancien, ancien: r.texte, regle: r.regle, signe: r.signe };
    });
  }

  // Zone modifiée entre deux versions d'un texte : [debut, fin[ dans la nouvelle, et le décalage après elle.
  function zoneModifiee(ancien, nouveau) {
    const L1 = ancien.length;
    const N = nouveau.length;
    let a = 0;
    while (a < L1 && a < N && ancien[a] === nouveau[a]) a++;
    let b = 0;
    while (b < L1 - a && b < N - a && ancien[L1 - 1 - b] === nouveau[N - 1 - b]) b++;
    return { a, finAncien: L1 - b, finNouveau: N - b };
  }

  // Pour annuler plus tard : les remplacements inverses encore applicables au texte tel qu'il est devenu
  // (si l'on a continué d'écrire, ceux qui ont été retouchés depuis sont laissés tels quels).
  function retablir(courant, base, inverses) {
    if (courant === base) return inverses.filter((r) => courant.slice(r.debut, r.fin) === r.ancien);
    const z = zoneModifiee(base, courant);
    const decalage = courant.length - base.length;
    const sortie = [];
    for (const r of inverses) {
      let debut;
      if (r.fin <= z.a) debut = r.debut;
      else if (r.debut >= z.finAncien) debut = r.debut + decalage;
      else continue;
      const fin = debut + (r.fin - r.debut);
      if (courant.slice(debut, fin) === r.ancien) sortie.push({ ...r, debut, fin });
    }
    return sortie;
  }

  /* ---------- Pendant la saisie ---------- */

  // ancien : le texte avant la frappe ; nouveau : le texte juste après ; curseur : position dans « nouveau ».
  // options.zone : [debut, fin] de ce qui vient d'être tapé ou collé, si on le connaît (sélection juste avant la saisie,
  //   curseur juste après) ; utile quand on recolle un texte presque identique, que la simple comparaison ne voit pas.
  // options.permis(debut, fin) : refuse une correction (limite de paragraphe, retour à la ligne choisi…).
  function corrigerSaisie(ancien, nouveau, options = {}) {
    const avant = String(ancien || '');
    const apres = String(nouveau || '');
    const curseur = options.curseur == null ? apres.length : options.curseur;
    const rien = { texte: apres, curseur, remplacements: [] };
    if (avant === apres) return rien;
    const z = zoneModifiee(avant, apres);
    let debut = z.a;
    let fin = z.finNouveau;
    const saisie = options.zone;
    if (saisie && saisie[0] >= 0 && saisie[1] <= apres.length && saisie[1] > saisie[0]) {
      if (fin > debut) { debut = Math.min(debut, saisie[0]); fin = Math.max(fin, saisie[1]); } else [debut, fin] = saisie;
    }
    if (fin <= debut) return rien; // effacement pur : on ne corrige jamais ce que tu viens de retirer
    const touche = (r) => r.declencheur[0] < fin && r.declencheur[1] > debut;
    // Les règles ne dépassent jamais une ligne : on n'examine que les lignes touchées (rapide sur un long article).
    const d0 = apres.lastIndexOf('\n', Math.max(0, debut - 1)) + 1;
    const f0 = apres.indexOf('\n', fin);
    const f1 = f0 < 0 ? apres.length : f0;
    const decaler = (r) => ({ ...r, debut: r.debut + d0, fin: r.fin + d0, declencheur: [r.declencheur[0] + d0, r.declencheur[1] + d0] });
    const remplacements = corrections(apres.slice(d0, f1)).map(decaler).filter((r) => touche(r) && (!options.permis || options.permis(r.debut, r.fin)));
    if (!remplacements.length) return rien;
    return { texte: appliquer(apres, remplacements), curseur: placer(curseur, remplacements), remplacements };
  }

  /* ---------- Comment l'annoncer ---------- */

  const NOMS = {
    espace: ['espace insécable', 'espaces insécables'],
    guillemets: ['guillemets « »', 'guillemets « »'],
    apostrophe: ['apostrophe ’', 'apostrophes ’'],
    suspension: ['points de suspension …', 'points de suspension …'],
  };
  const ORDRE = ['espace', 'guillemets', 'apostrophe', 'suspension'];

  function decrireUne(r) {
    if (r.regle === 'espace') {
      if (r.signe === '«' || r.signe === '»') return 'espace insécable dans les guillemets';
      return `espace insécable avant « ${r.signe} »`;
    }
    if (r.regle === 'guillemets') return 'guillemets droits remplacés par « »';
    if (r.regle === 'apostrophe') return 'apostrophe ’';
    return 'points de suspension …';
  }

  // « espace insécable avant « ? » » ou « 7 corrections (espaces insécables, apostrophes ’) ».
  function resume(remplacements) {
    if (!remplacements.length) return '';
    if (remplacements.length === 1) return decrireUne(remplacements[0]);
    const nombres = {};
    for (const r of remplacements) nombres[r.regle] = (nombres[r.regle] || 0) + 1;
    const genres = ORDRE.filter((g) => nombres[g]).map((g) => NOMS[g][nombres[g] > 1 ? 1 : 0]);
    return `${remplacements.length} corrections (${genres.join(', ')})`;
  }

  /* ---------- Sur un article entier ---------- */

  const enFrancais = (article) => (article.langue || 'fr') === 'fr';

  // Remplacements sur le texte d'un paragraphe de slide (sans lien avec l'article) : texte et mise en forme suivent.
  function appliquerSurBloc(bloc, remplacements) {
    if (!remplacements.length) return bloc;
    const texte = appliquer(bloc.texte, remplacements);
    const copie = { ...bloc, texte };
    const marques = (bloc.marques || []).map((m) => ({ ...m, debut: placer(m.debut, remplacements), fin: placer(m.fin, remplacements) }));
    return L ? L.avecMarques(copie, marques) : copie;
  }

  // Tout ce qui reste à corriger : le texte de l'article (hors passages protégés) et les paragraphes ajoutés sur les slides.
  function correctionsArticle(article) {
    const vide = { source: [], libres: [], total: 0, liste: [] };
    if (!enFrancais(article) || !L) return vide;
    const source = L.passagesPermis(article, corrections(L.sourceDe(article)));
    const libres = [];
    article.slides.forEach((s, i) => s.blocs.forEach((b, n) => {
      if (b.lien || !b.texte) return;
      const remplacements = corrections(b.texte);
      if (remplacements.length) libres.push({ i, n, remplacements });
    }));
    const liste = [...source, ...libres.flatMap((x) => x.remplacements)];
    return { source, libres, total: liste.length, liste };
  }

  function corrigerArticle(article) {
    const c = correctionsArticle(article);
    if (!c.total) return article;
    let a = c.source.length ? L.remplacerPassages(article, c.source) : article;
    if (c.libres.length) {
      a = { ...a, slides: a.slides.map((s, i) => ({ ...s, blocs: s.blocs.map((b, n) => {
        const x = c.libres.find((y) => y.i === i && y.n === n);
        return x && !b.lien && b.texte === article.slides[i].blocs[n].texte ? appliquerSurBloc(b, x.remplacements) : b;
      }) })) };
    }
    return a;
  }

  // Annuler une correction annoncée, même si l'on a continué d'écrire ailleurs depuis.
  // trace : { base, inverses } (texte de l'article) ou { i, n, base, inverses } (paragraphe sans lien).
  function annulerTrace(article, trace) {
    if (trace.i != null) {
      const bloc = article.slides[trace.i] && article.slides[trace.i].blocs[trace.n];
      if (!bloc || bloc.lien) return article;
      const liste = retablir(bloc.texte, trace.base, trace.inverses);
      if (!liste.length) return article;
      return { ...article, slides: article.slides.map((s, k) => (k !== trace.i ? s : { ...s, blocs: s.blocs.map((b, m) => (m === trace.n ? appliquerSurBloc(b, liste) : b)) })) };
    }
    const liste = retablir(L.sourceDe(article), trace.base, trace.inverses);
    return liste.length ? L.remplacerPassages(article, liste) : article;
  }

  const api = { NB, corrections, appliquer, placer, inverser, retablir, zoneModifiee, corrigerSaisie, resume, enFrancais, correctionsArticle, corrigerArticle, appliquerSurBloc, annulerTrace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPTypographie = api;
})(typeof window !== 'undefined' ? window : globalThis);
