/*
 * PostsOP — lien entre le texte de l'article et ses slides
 *
 * Le texte de l'article est la référence. Chaque paragraphe d'une slide (un « bloc ») mémorise
 * l'endroit exact du texte d'où il vient : { debut, fin } dans le texte complet, plus les retours
 * à la ligne choisis pour la mise en page (« retours », des espaces affichés comme des retours).
 *
 *   - Modifier le texte (étape Texte) met à jour toutes les slides.
 *   - Modifier un paragraphe dans Design modifie aussi le texte de l'article.
 *   - Couper une slide n'importe où, même au milieu d'un paragraphe, ou retirer une coupure.
 *
 * Un bloc sans lien (« libre ») est un texte ajouté qui n'existe pas dans l'article : il est signalé
 * par le contrôle qualité.
 */
(function (racine) {
  'use strict';

  const SEPARATEUR = '\n\n';
  const sourceDe = (article) => article.texte.join(SEPARATEUR);
  const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const estBlanc = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\u00A0' || c === '\u202F';

  // Texte affiché d'un bloc lié : le passage du texte, avec ses retours à la ligne de mise en page.
  function materialiser(source, lien) {
    const morceau = source.slice(lien.debut, lien.fin).split('');
    for (const r of lien.retours || []) {
      const k = r - lien.debut;
      if (k > 0 && k < morceau.length && morceau[k] === ' ') morceau[k] = '\n';
    }
    return morceau.join('');
  }

  // Retire les blancs en bordure d'un passage.
  function resserrer(source, debut, fin) {
    while (debut < fin && estBlanc(source[debut])) debut++;
    while (fin > debut && estBlanc(source[fin - 1])) fin--;
    return [debut, fin];
  }

  /* ---------- Mise en forme d'un paragraphe ----------
   * marques : [{ debut, fin, gras?, italique?, souligne?, taille? }], positions dans le texte affiché du paragraphe.
   * Une valeur null retire l'attribut ; false force l'absence (du gras sur un titre déjà gras, par exemple). */

  const ATTRIBUTS = ['gras', 'italique', 'souligne', 'taille', 'couleur'];

  function normaliserMarques(marques, longueur) {
    const bornes = new Set([0, longueur]);
    for (const m of marques || []) { bornes.add(Math.max(0, Math.min(longueur, m.debut))); bornes.add(Math.max(0, Math.min(longueur, m.fin))); }
    const points = [...bornes].sort((x, y) => x - y);
    const sortie = [];
    for (let k = 0; k < points.length - 1; k++) {
      const p = points[k];
      const q = points[k + 1];
      const attributs = {};
      for (const m of marques || []) {
        if (m.debut <= p && m.fin >= q) for (const cle of ATTRIBUTS) if (cle in m) { if (m[cle] === null) delete attributs[cle]; else attributs[cle] = m[cle]; }
      }
      if (!Object.keys(attributs).length) continue;
      const precedente = sortie[sortie.length - 1];
      if (precedente && precedente.fin === p && ATTRIBUTS.every((cle) => precedente[cle] === attributs[cle])) precedente.fin = q;
      else sortie.push({ debut: p, fin: q, ...attributs });
    }
    return sortie;
  }

  function appliquerForme(marques, longueur, debut, fin, changement) {
    if (fin <= debut) return normaliserMarques(marques, longueur);
    return normaliserMarques([...(marques || []), { debut, fin, ...changement }], longueur);
  }

  // Valeur effective d'un attribut sur chaque caractère du passage : vrai partout ?
  function partoutVrai(marques, debut, fin, cle, parDefaut) {
    if (fin <= debut) return false;
    for (let k = debut; k < fin; k++) {
      const m = (marques || []).find((x) => x.debut <= k && x.fin > k && cle in x);
      if (!(m ? !!m[cle] : parDefaut)) return false;
    }
    return true;
  }

  // Le texte d'un paragraphe change : les marques suivent (taper juste après un mot en gras continue le gras).
  function remapperMarques(ancien, nouveau, marques) {
    if (!marques || !marques.length || ancien === nouveau) return marques;
    const L = ancien.length;
    const N = nouveau.length;
    let a = 0;
    while (a < L && a < N && ancien[a] === nouveau[a]) a++;
    let b = 0;
    while (b < L - a && b < N - a && ancien[L - 1 - b] === nouveau[N - 1 - b]) b++;
    const delta = N - L;
    const versDebut = (x) => (x < a ? x : x >= L - b ? x + delta : N - b);
    const versFin = (x) => (x >= L - b ? x + delta : x <= a ? x : N - b);
    return normaliserMarques(marques.map((m) => ({ ...m, debut: versDebut(m.debut), fin: versFin(m.fin) })).filter((m) => m.fin > m.debut), N);
  }

  // Marques d'un morceau [debut, fin[ du paragraphe, ramenées au début de ce morceau.
  const extraireMarques = (marques, debut, fin) => normaliserMarques((marques || []).map((m) => ({ ...m, debut: Math.max(m.debut, debut) - debut, fin: Math.min(m.fin, fin) - debut })).filter((m) => m.fin > m.debut), fin - debut);
  const decalerMarques = (marques, d) => (marques || []).map((m) => ({ ...m, debut: m.debut + d, fin: m.fin + d }));
  const avecMarques = (bloc, marques) => {
    const propres = normaliserMarques(marques, (bloc.texte || '').length);
    const copie = { ...bloc };
    if (propres.length) copie.marques = propres; else delete copie.marques;
    return copie;
  };

  /* ---------- Liaison d'un article existant (ancien format, ou nouvelles slides) ---------- */

  function lierArticle(article) {
    const source = sourceDe(article);
    let curseur = 0;
    const lierBloc = (b) => {
      if (b.lien || b.libre) return b;
      const affiche = String(b.texte || '').trim();
      const mots = affiche.split(/\s+/).filter(Boolean);
      if (!mots.length) return { ...b, libre: true };
      const motif = new RegExp(mots.map(echapper).join('\\s+'), 'g');
      motif.lastIndex = curseur;
      let trouve = motif.exec(source);
      if (!trouve) { motif.lastIndex = 0; trouve = motif.exec(source); }
      if (!trouve) return { ...b, libre: true };
      // Position de chaque mot dans le texte, pour retrouver les retours à la ligne voulus.
      const separateurs = affiche.split(/\S+/).slice(1, -1);
      const retours = [];
      let p = trouve.index;
      mots.forEach((mot, k) => {
        p = source.indexOf(mot, p) + mot.length;
        if (k < separateurs.length && separateurs[k].includes('\n')) retours.push(p);
      });
      curseur = trouve.index + trouve[0].length;
      const lien = { debut: trouve.index, fin: curseur, retours };
      return { ...b, texte: materialiser(source, lien), lien };
    };
    return { ...article, slides: article.slides.map((s) => ({ ...s, blocs: s.blocs.map(lierBloc) })) };
  }

  /* ---------- Modification du texte : toutes les slides suivent ---------- */

  function appliquerEditionSource(article, nouvelle, options = {}) {
    const ancienne = sourceDe(article);
    const texte = nouvelle.split(SEPARATEUR);
    if (ancienne === nouvelle) return { ...article, texte };
    const L = ancienne.length;
    const N = nouvelle.length;
    let a = 0;
    while (a < L && a < N && ancienne[a] === nouvelle[a]) a++;
    let b = 0;
    while (b < L - a && b < N - a && ancienne[L - 1 - b] === nouvelle[N - 1 - b]) b++;
    // Ajout ou suppression pure : la zone modifiée peut souvent glisser sans changer le résultat
    // (supprimer « Elle …\n\nE » ou « E… \n\n » revient au même). On la cale sur des limites
    // de paragraphe ou de mot, pour qu'une lettre ne passe jamais d'un paragraphe à l'autre.
    if (L - b === a || N - b === a) {
      const suppression = N - b === a;
      const chaine = suppression ? ancienne : nouvelle;
      const k = suppression ? L - b - a : N - b - a;
      const limite = (x) => (x === 0 || x === chaine.length || chaine.slice(x - 2, x) === SEPARATEUR || chaine.slice(x, x + 2) === SEPARATEUR ? 4 : estBlanc(chaine[x - 1]) || estBlanc(chaine[x]) ? 2 : 0);
      let meilleur = a;
      let score = limite(a) + limite(a + k);
      for (let d = 1; d <= a && chaine[a - d] === chaine[a + k - d]; d++) {
        const note = limite(a - d) + limite(a + k - d);
        if (note > score) { score = note; meilleur = a - d; }
      }
      for (let d = 1; a + k + d <= chaine.length && chaine[a + d - 1] === chaine[a + k + d - 1]; d++) {
        const note = limite(a + d) + limite(a + k + d);
        if (note > score) { score = note; meilleur = a + d; }
      }
      a = meilleur;
      b = suppression ? L - a - k : L - a;
    }
    const delta = N - L;
    // Un début placé dans la zone modifiée prend le texte inséré ; une fin placée juste après l'absorbe.
    const versDebut = (x) => (x <= a ? x : x >= L - b ? x + delta : a);
    const versFin = (x) => (x >= L - b ? x + delta : x <= a ? x : a);
    const versRetour = (x) => (x < a ? x : x >= L - b ? x + delta : -1);

    const liens = [];
    let slides = article.slides.map((s, i) => ({
      ...s,
      blocs: s.blocs.map((bloc, n) => {
        if (!bloc.lien) return bloc;
        const lien = { debut: versDebut(bloc.lien.debut), fin: versFin(bloc.lien.fin), retours: (bloc.lien.retours || []).map(versRetour).filter((r) => r >= 0) };
        liens.push({ i, n, lien });
        return { ...bloc, lien };
      }),
    }));
    // Deux passages voisins ne se chevauchent jamais : le second commence après le premier.
    liens.sort((x, y) => x.lien.debut - y.lien.debut || x.lien.fin - y.lien.fin);
    for (let k = 1; k < liens.length; k++) {
      const precedent = liens[k - 1].lien;
      const courant = liens[k].lien;
      if (courant.debut < precedent.fin) courant.debut = Math.min(precedent.fin, courant.fin);
    }
    slides = slides.map((s) => ({
      ...s,
      blocs: s.blocs.map((bloc) => {
        if (!bloc.lien) return bloc;
        // Les bornes ne sont pas resserrées : une lettre tapée juste après un espace en fin de paragraphe
        // doit rester dans ce paragraphe. Le moteur ignore les blancs en bordure à la mise en page.
        const { debut } = bloc.lien;
        const fin = Math.max(debut, bloc.lien.fin);
        const lien = { debut, fin, retours: bloc.lien.retours.filter((r) => r > debut && r < fin) };
        const texteNeuf = materialiser(nouvelle, lien);
        return avecMarques({ ...bloc, lien, texte: texteNeuf }, remapperMarques(bloc.texte, texteNeuf, bloc.marques));
      }),
    }));
    if (!options.garderVides) {
      slides = slides.map((s) => ({ ...s, blocs: s.blocs.filter((bloc) => !bloc.lien || bloc.texte.trim()) }));
      const restantes = slides.filter((s) => s.blocs.length);
      if (restantes.length && restantes.length < slides.length) {
        const signee = slides.some((s) => s.signature);
        slides = restantes.map((s, k) => (k === restantes.length - 1 && signee ? { ...s, signature: true } : s));
      }
    }
    return { ...article, texte, slides };
  }

  // Modifier un paragraphe dans Design modifie le texte de l'article au même endroit.
  // Les autres passages sont recalés ; celui-ci prend exactement le texte tapé, blancs compris
  // (sinon un espace tapé en fin de paragraphe disparaîtrait aussitôt).
  function modifierBlocLie(article, i, n, nouveau) {
    const bloc = article.slides[i].blocs[n];
    if (!bloc.lien) return article;
    const source = sourceDe(article);
    const plat = nouveau.replace(/\n/g, ' ');
    const nouvelle = source.slice(0, bloc.lien.debut) + plat + source.slice(bloc.lien.fin);
    // Position connue : les paragraphes suivants sont décalés exactement (fonction définie plus bas, hissée).
    const recale = decalerApres(article, nouvelle, bloc.lien.fin, plat.length - (bloc.lien.fin - bloc.lien.debut), (k, m) => k === i && m === n);
    const lien = { debut: bloc.lien.debut, fin: bloc.lien.debut + plat.length, retours: [] };
    for (let k = 0; k < nouveau.length; k++) if (nouveau[k] === '\n') lien.retours.push(bloc.lien.debut + k);
    return {
      ...recale,
      slides: recale.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.map((b, m) => (m !== n ? b : avecMarques({ ...b, lien, texte: nouveau }, remapperMarques(bloc.texte, nouveau, bloc.marques)))) })),
    };
  }

  /* ---------- Découpage manuel ---------- */

  // Coupe la slide i dans son bloc n, à la position « position » du texte affiché de ce bloc.
  function couperSlide(article, i, n, position) {
    const s = article.slides[i];
    const bloc = s.blocs[n];
    let avant = s.blocs.slice(0, n);
    let apres = s.blocs.slice(n + 1);
    if (position <= 0) apres = [bloc, ...apres];
    else if (position >= bloc.texte.length) avant = [...avant, bloc];
    else if (bloc.lien) {
      const source = sourceDe(article);
      const coupe = bloc.lien.debut + position;
      const [d1, f1] = resserrer(source, bloc.lien.debut, coupe);
      const [d2, f2] = resserrer(source, coupe, bloc.lien.fin);
      const l1 = { debut: d1, fin: f1, retours: bloc.lien.retours.filter((r) => r > d1 && r < f1) };
      const l2 = { debut: d2, fin: f2, retours: bloc.lien.retours.filter((r) => r > d2 && r < f2) };
      const base = bloc.lien.debut;
      avant = [...avant, avecMarques({ ...bloc, lien: l1, texte: materialiser(source, l1) }, extraireMarques(bloc.marques, d1 - base, f1 - base))];
      apres = [avecMarques({ ...bloc, style: suiteDe(bloc.style), lien: l2, texte: materialiser(source, l2) }, extraireMarques(bloc.marques, d2 - base, f2 - base)), ...apres];
    } else {
      const gauche = bloc.texte.slice(0, position);
      const droite = bloc.texte.slice(position);
      const debutDroite = position + (droite.length - droite.trimStart().length);
      avant = [...avant, avecMarques({ ...bloc, texte: gauche.trimEnd() }, extraireMarques(bloc.marques, 0, gauche.trimEnd().length))];
      apres = [avecMarques({ ...bloc, style: suiteDe(bloc.style), texte: droite.trim() }, extraireMarques(bloc.marques, debutDroite, debutDroite + droite.trim().length)), ...apres];
    }
    if (!avant.length || !apres.length) return article;
    const couverture = /^V/.test(s.gabarit || '') || (i === 0 && !s.gabarit);
    const premiere = { ...s, blocs: avant, signature: false };
    const seconde = { role: 'Texte', gabarit: couverture ? 'T1' : s.gabarit, blocs: apres.map((b) => (couverture ? { ...b, style: b.style === 'titre' || b.style === 'contrepoint' ? 'emphase' : b.style } : b)), signature: s.signature };
    return { ...article, slides: [...article.slides.slice(0, i), premiere, seconde, ...article.slides.slice(i + 1)] };
  }
  const suiteDe = (style) => (style === 'titre' ? 'contrepoint' : style);

  // Retire la coupure entre la slide i et la suivante ; un paragraphe coupé en deux est recollé.
  function retirerCoupure(article, i) {
    if (i >= article.slides.length - 1) return article;
    const s1 = article.slides[i];
    const s2 = article.slides[i + 1];
    const source = sourceDe(article);
    let blocs = [...s1.blocs, ...s2.blocs];
    const dernier = s1.blocs[s1.blocs.length - 1];
    const premier = s2.blocs[0];
    if (dernier && premier && dernier.lien && premier.lien && premier.lien.debut >= dernier.lien.fin) {
      const entre = source.slice(dernier.lien.fin, premier.lien.debut);
      if (!entre.includes(SEPARATEUR) && !entre.trim()) {
        const lien = { debut: dernier.lien.debut, fin: premier.lien.fin, retours: [...dernier.lien.retours, ...premier.lien.retours] };
        const marques = [...(dernier.marques || []), ...decalerMarques(premier.marques, premier.lien.debut - dernier.lien.debut)];
        blocs = [...s1.blocs.slice(0, -1), avecMarques({ ...dernier, lien, texte: materialiser(source, lien) }, marques), ...s2.blocs.slice(1)];
      }
    }
    const fusion = { ...s1, blocs, signature: s1.signature || s2.signature };
    return { ...article, slides: [...article.slides.slice(0, i), fusion, ...article.slides.slice(i + 2)] };
  }

  // Phrases d'un texte affiché, pour choisir où couper : [{ debut, fin }].
  function phrases(texte) {
    const sortie = [];
    const motif = /[^.!?…]+(?:[.!?…]+[»”"’)\]]*|$)/g;
    let m;
    while ((m = motif.exec(texte))) {
      if (!m[0]) { motif.lastIndex++; continue; }
      let debut = m.index;
      let fin = m.index + m[0].length;
      while (debut < fin && estBlanc(texte[debut])) debut++;
      while (fin > debut && estBlanc(texte[fin - 1])) fin--;
      if (fin > debut) sortie.push({ debut, fin });
    }
    return sortie;
  }

  // Passages du texte qui ne figurent sur aucune slide.
  function passagesNonCouverts(article) {
    const source = sourceDe(article);
    const couvert = new Uint8Array(source.length);
    for (const s of article.slides) for (const b of s.blocs) if (b.lien) couvert.fill(1, b.lien.debut, b.lien.fin);
    const passages = [];
    let k = 0;
    while (k < source.length) {
      if (couvert[k]) { k++; continue; }
      let j = k;
      while (j < source.length && !couvert[j]) j++;
      for (const morceau of source.slice(k, j).split(SEPARATEUR)) if (morceau.trim()) passages.push(morceau.trim());
      k = j;
    }
    return passages;
  }

  /* ---------- Gestes de traitement de texte, directement sur la slide ---------- */

  // Insertion ou retrait à une position connue : les autres paragraphes sont décalés exactement,
  // sans deviner où la modification a eu lieu (aucune ambiguïté aux limites de paragraphes).
  function decalerApres(article, nouvelle, position, delta, sauf) {
    return {
      ...article,
      texte: nouvelle.split(SEPARATEUR),
      slides: article.slides.map((s, i) => ({
        ...s,
        blocs: s.blocs.map((b, n) => {
          if (!b.lien || (sauf && sauf(i, n))) return b;
          // Un paragraphe qui commence au point d'insertion est décalé ; un paragraphe qui s'y termine ne bouge pas.
          const d = (x) => (x >= position ? x + delta : x);
          const f = (x) => (x > position ? x + delta : x);
          const lien = { debut: d(b.lien.debut), fin: Math.max(d(b.lien.debut), f(b.lien.fin)), retours: (b.lien.retours || []).map(d) };
          return { ...b, lien, texte: materialiser(nouvelle, lien) };
        }),
      })),
    };
  }

  // Entrée : le paragraphe est coupé en deux, dans la slide comme dans le texte de l'article.
  function scinderBloc(article, i, n, position) {
    const bloc = article.slides[i].blocs[n];
    const longueur = bloc.texte.length;
    const p = Math.max(0, Math.min(position, longueur));
    let premier;
    let second;
    let recale = article;
    if (bloc.lien) {
      const source = sourceDe(article);
      const coupe = bloc.lien.debut + p;
      const nouvelle = source.slice(0, coupe) + SEPARATEUR + source.slice(coupe);
      recale = decalerApres(article, nouvelle, coupe, 2, (k, m) => k === i && m === n);
      const l1 = { debut: bloc.lien.debut, fin: coupe, retours: bloc.lien.retours.filter((r) => r < coupe) };
      const l2 = { debut: coupe + 2, fin: bloc.lien.fin + 2, retours: bloc.lien.retours.filter((r) => r > coupe).map((r) => r + 2) };
      premier = avecMarques({ ...bloc, lien: l1, texte: materialiser(nouvelle, l1) }, extraireMarques(bloc.marques, 0, p));
      second = avecMarques({ ...bloc, lien: l2, texte: materialiser(nouvelle, l2) }, extraireMarques(bloc.marques, p, longueur));
    } else {
      premier = avecMarques({ ...bloc, texte: bloc.texte.slice(0, p) }, extraireMarques(bloc.marques, 0, p));
      second = avecMarques({ ...bloc, texte: bloc.texte.slice(p) }, extraireMarques(bloc.marques, p, longueur));
    }
    if (second.style === 'titre') second.style = 'titre';
    delete second.filet;
    return { ...recale, slides: recale.slides.map((s, k) => (k !== i ? s : { ...s, blocs: [...s.blocs.slice(0, n), premier, second, ...s.blocs.slice(n + 1)] })) };
  }

  // ⌫ au début d'un paragraphe : il rejoint le précédent (et les deux paragraphes de l'article n'en font plus qu'un).
  // Renvoie null si les deux paragraphes ne se suivent pas dans le texte.
  function fusionnerBlocs(article, i, n) {
    if (n <= 0) return null;
    const blocs = article.slides[i].blocs;
    const a = blocs[n - 1];
    const b = blocs[n];
    let fusion;
    let jonction;
    let recale = article;
    if (a.lien && b.lien) {
      const source = sourceDe(article);
      if (b.lien.debut < a.lien.fin) return null;
      const entre = source.slice(a.lien.fin, b.lien.debut);
      if (entre.trim()) return null;
      // Un autre paragraphe (même vide) se trouve entre les deux : ils ne se suivent pas vraiment.
      const intercale = article.slides.some((s, k) => s.blocs.some((x, m) => x.lien && !(k === i && (m === n || m === n - 1)) && x.lien.debut >= a.lien.fin && x.lien.debut <= b.lien.debut && (x.lien.debut > a.lien.fin || x.lien.fin > x.lien.debut || x.lien.debut < b.lien.debut)));
      if (intercale) return null;
      const sep = a.texte.length && b.texte.length ? ' ' : '';
      const nouvelle = source.slice(0, a.lien.fin) + sep + source.slice(b.lien.debut);
      const decalage = sep.length - entre.length;
      recale = decalerApres(article, nouvelle, b.lien.debut, decalage, (k, m) => k === i && (m === n || m === n - 1));
      const lien = { debut: a.lien.debut, fin: b.lien.fin + decalage, retours: [...a.lien.retours, ...b.lien.retours.map((r) => r + decalage)] };
      jonction = a.texte.length;
      fusion = avecMarques({ ...a, lien, texte: materialiser(nouvelle, lien) }, [...(a.marques || []), ...decalerMarques(b.marques, jonction + sep.length)]);
    } else if (!a.lien && !b.lien) {
      const sep = a.texte.length && b.texte.length ? ' ' : '';
      jonction = a.texte.length;
      fusion = avecMarques({ ...a, texte: a.texte + sep + b.texte }, [...(a.marques || []), ...decalerMarques(b.marques, jonction + sep.length)]);
    } else return null;
    return { article: { ...recale, slides: recale.slides.map((s, k) => (k !== i ? s : { ...s, blocs: [...s.blocs.slice(0, n - 1), fusion, ...s.blocs.slice(n + 1)] })) }, jonction };
  }

  // Nouveau paragraphe après le paragraphe n : ajouté aussi au texte de l'article, juste après.
  function insererParagrapheApres(article, i, n, texte = 'Nouveau paragraphe') {
    const bloc = article.slides[i].blocs[n];
    if (!bloc || !bloc.lien) {
      const nouveau = { style: 'corps', texte };
      return { ...article, slides: article.slides.map((s, k) => (k !== i ? s : { ...s, blocs: [...s.blocs.slice(0, n + 1), nouveau, ...s.blocs.slice(n + 1)] })) };
    }
    const source = sourceDe(article);
    const p = bloc.lien.fin;
    const apres = source.slice(p);
    const insertion = SEPARATEUR + texte + (apres.length && !apres.startsWith(SEPARATEUR) ? SEPARATEUR : '');
    const espaces = apres.length - apres.replace(/^ +/, '').length;
    const nouvelle = source.slice(0, p) + insertion + apres.slice(espaces);
    const recale = decalerApres(article, nouvelle, p + espaces, insertion.length - espaces, (k, m) => k === i && m === n);
    const lien = { debut: p + 2, fin: p + 2 + texte.length, retours: [] };
    const nouveau = { style: 'corps', lien, texte: materialiser(nouvelle, lien) };
    // Le paragraphe courant garde exactement ses bornes.
    return { ...recale, slides: recale.slides.map((s, k) => (k !== i ? s : { ...s, blocs: [...s.blocs.slice(0, n), { ...s.blocs[n], lien: bloc.lien, texte: materialiser(nouvelle, bloc.lien) }, nouveau, ...s.blocs.slice(n + 1)] })) };
  }

  /* ---------- Plusieurs blocs à la fois (sélection d'objets dans Composition) ---------- */

  // Retire du texte de l'article le passage d'un bloc (et la séparation de paragraphe qui devient inutile).
  function retirerTexte(article, i, n) {
    const bloc = article.slides[i].blocs[n];
    if (!bloc.lien) return article;
    const source = sourceDe(article);
    let a = bloc.lien.debut;
    let b = bloc.lien.fin;
    const avant = source.slice(0, a);
    const apres = source.slice(b);
    const debutPar = a === 0 || avant.endsWith(SEPARATEUR);
    const finPar = b === source.length || apres.startsWith(SEPARATEUR);
    if (debutPar && finPar) { if (apres.startsWith(SEPARATEUR)) b += 2; else if (avant.endsWith(SEPARATEUR)) a -= 2; }
    else if (apres.startsWith(' ')) b += 1;
    const nouvelle = source.slice(0, a) + source.slice(b);
    // Après le passage retiré : décalé ; dans le passage retiré (paragraphe vide voisin, par exemple) : ramené à son début.
    const d = (x) => (x >= b ? x - (b - a) : x > a ? a : x);
    return {
      ...article,
      texte: nouvelle.split(SEPARATEUR),
      slides: article.slides.map((s, k) => ({
        ...s,
        blocs: s.blocs.map((x, m) => {
          if (k === i && m === n) return { ...x, lien: null };
          if (!x.lien) return x;
          const lien = { debut: d(x.lien.debut), fin: Math.max(d(x.lien.debut), d(x.lien.fin)), retours: (x.lien.retours || []).map(d) };
          return { ...x, lien, texte: materialiser(nouvelle, lien) };
        }),
      })),
    };
  }

  // Supprimer des blocs : ils disparaissent de la slide et leur texte de l'article.
  function supprimerBlocs(article, i, indices) {
    let a = article;
    for (const n of [...indices].sort((p, q) => q - p)) {
      a = retirerTexte(a, i, n);
      a = { ...a, slides: a.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.filter((_, m) => m !== n) })) };
    }
    return a;
  }

  // Dupliquer un bloc : une copie de son texte est ajoutée à l'article, juste après ; la copie garde style et mise en forme.
  function dupliquerBloc(article, i, n, decalage = 30) {
    const bloc = article.slides[i].blocs[n];
    let a = insererParagrapheApres(article, i, n, bloc.texte.replace(/\n/g, ' '));
    const copie = { ...a.slides[i].blocs[n + 1] };
    for (const cle of ['style', 'marques', 'alignement', 'filet', 'fige']) if (bloc[cle] !== undefined) copie[cle] = bloc[cle];
    if (bloc.pos) copie.pos = { ...bloc.pos, x: bloc.pos.x + decalage, y: bloc.pos.y + decalage };
    a = { ...a, slides: a.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.map((x, m) => (m === n + 1 ? copie : x)) })) };
    return a;
  }

  // Déplace, dans le texte de l'article, le passage du bloc n juste après celui du bloc p (pour pouvoir les réunir).
  function rapprocherTexte(article, i, p, n) {
    const bloc = article.slides[i].blocs[n];
    if (!bloc.lien || !article.slides[i].blocs[p].lien) return article;
    const texte = sourceDe(article).slice(bloc.lien.debut, bloc.lien.fin);
    const retours = bloc.lien.retours.map((r) => r - bloc.lien.debut);
    let a = retirerTexte(article, i, n);
    const cible = a.slides[i].blocs[p].lien.fin;
    const source = sourceDe(a);
    const nouvelle = source.slice(0, cible) + SEPARATEUR + texte + source.slice(cible);
    a = decalerApres(a, nouvelle, cible, texte.length + 2, (k, m) => (k === i && (m === p || m === n)));
    const lien = { debut: cible + 2, fin: cible + 2 + texte.length, retours: retours.map((r) => r + cible + 2) };
    return { ...a, slides: a.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.map((x, m) => (m === n ? { ...x, lien, texte: materialiser(nouvelle, lien) } : x)) })) };
  }

  // Fusionner plusieurs blocs d'une slide, dans l'ordre de lecture donné : un seul paragraphe, dans la slide et dans l'article.
  function fusionnerPlusieurs(article, i, ordre) {
    if (ordre.length < 2) return article;
    const blocs = article.slides[i].blocs;
    const premier = Math.min(...ordre);
    const choisis = ordre.map((n) => blocs[n]);
    const autres = blocs.filter((_, m) => !ordre.includes(m));
    const place = autres.filter((_, m) => blocs.indexOf(autres[m]) < premier).length;
    let a = { ...article, slides: article.slides.map((s, k) => (k !== i ? s : { ...s, blocs: [...autres.slice(0, place), ...choisis, ...autres.slice(place)] })) };
    for (let k = 1; k < ordre.length; k++) {
      let r = fusionnerBlocs(a, i, place + 1);
      if (!r) {
        a = rapprocherTexte(a, i, place, place + 1);
        r = fusionnerBlocs(a, i, place + 1);
      }
      if (!r) {
        // Bloc sans lien avec le texte (copie de slide) : les textes sont simplement réunis.
        const x = a.slides[i].blocs[place];
        const y = a.slides[i].blocs[place + 1];
        const fusion = avecMarques({ ...x, texte: x.texte + ' ' + y.texte }, [...(x.marques || []), ...decalerMarques(y.marques, x.texte.length + 1)]);
        if (y.lien) Object.assign(fusion, {}); // le texte de y reste dans l'article ; Vérifier le signalera
        a = { ...a, slides: a.slides.map((s, kk) => (kk !== i ? s : { ...s, blocs: [...s.blocs.slice(0, place), fusion, ...s.blocs.slice(place + 2)] })) };
        continue;
      }
      a = r.article;
    }
    return a;
  }

  // Envoyer des blocs sur une autre slide, à des positions données (mise en page libre).
  function deplacerBlocsVersSlide(article, i, indices, j, positions) {
    const blocs = indices.map((n, k) => ({ ...article.slides[i].blocs[n], pos: positions[k] }));
    return {
      ...article,
      slides: article.slides.map((s, k) => {
        if (k === i && k === j) return s;
        if (k === i) return { ...s, blocs: s.blocs.filter((_, m) => !indices.includes(m)) };
        if (k === j) return { ...s, libre: true, blocs: [...s.blocs, ...blocs] };
        return s;
      }),
    };
  }

  /* ---------- Remplacements à plusieurs endroits du texte (typographie) ----------
   * remplacements : [{ debut, fin, texte, ancien? }], triés, sans chevauchement, positions dans le texte complet.
   * Contrairement à une modification ordinaire, chaque passage est recalé exactement : des corrections
   * éparpillées dans tout l'article ne déplacent aucun paragraphe de slide. */

  // Garde les remplacements sans danger : texte attendu présent, aucun retour à la ligne de mise en page touché,
  // aucune limite entre deux paragraphes de slides traversée.
  function passagesPermis(article, remplacements) {
    const source = sourceDe(article);
    const bornes = [];
    const retours = [];
    for (const s of article.slides) for (const b of s.blocs) if (b.lien) { bornes.push(b.lien.debut, b.lien.fin); retours.push(...(b.lien.retours || [])); }
    return remplacements.filter((r) => r.fin > r.debut && r.fin <= source.length
      && (r.ancien === undefined || source.slice(r.debut, r.fin) === r.ancien)
      && !retours.some((x) => x >= r.debut && x < r.fin)
      && !bornes.some((x) => x > r.debut && x < r.fin));
  }

  function remplacerPassages(article, remplacements) {
    const liste = passagesPermis(article, remplacements);
    if (!liste.length) return article;
    const source = sourceDe(article);
    let nouvelle = '';
    let curseur = 0;
    for (const r of liste) { nouvelle += source.slice(curseur, r.debut) + r.texte; curseur = r.fin; }
    nouvelle += source.slice(curseur);
    // Position après remplacement ; « interieur » : où va une position prise dans un passage remplacé.
    const placer = (x, interieur) => {
      let ecart = 0;
      for (const r of liste) {
        if (x >= r.fin) ecart += r.texte.length - (r.fin - r.debut);
        else if (x > r.debut) return r.debut + ecart + (interieur === 'fin' ? r.texte.length : 0);
        else break;
      }
      return x + ecart;
    };
    return {
      ...article,
      texte: nouvelle.split(SEPARATEUR),
      slides: article.slides.map((s) => ({
        ...s,
        blocs: s.blocs.map((b) => {
          if (!b.lien) return b;
          const debut = placer(b.lien.debut, 'debut');
          const lien = { debut, fin: Math.max(debut, placer(b.lien.fin, 'fin')), retours: (b.lien.retours || []).map((x) => placer(x, 'debut')) };
          const texte = materialiser(nouvelle, lien);
          const marques = (b.marques || []).map((m) => ({ ...m, debut: placer(b.lien.debut + m.debut, 'debut') - debut, fin: placer(b.lien.debut + m.fin, 'fin') - debut }));
          return avecMarques({ ...b, lien, texte }, marques);
        }),
      })),
    };
  }

  const api = { passagesPermis, remplacerPassages, supprimerBlocs, dupliquerBloc, fusionnerPlusieurs, deplacerBlocsVersSlide, retirerTexte, scinderBloc, fusionnerBlocs, insererParagrapheApres, ATTRIBUTS, normaliserMarques, appliquerForme, partoutVrai, remapperMarques, extraireMarques, avecMarques, SEPARATEUR, sourceDe, materialiser, lierArticle, appliquerEditionSource, modifierBlocLie, couperSlide, retirerCoupure, phrases, passagesNonCouverts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPLiens = api;
})(typeof window !== 'undefined' ? window : globalThis);
