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
        return { ...bloc, lien, texte: materialiser(nouvelle, lien) };
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
    const recale = appliquerEditionSource(article, nouvelle, { garderVides: true });
    const lien = { debut: bloc.lien.debut, fin: bloc.lien.debut + plat.length, retours: [] };
    for (let k = 0; k < nouveau.length; k++) if (nouveau[k] === '\n') lien.retours.push(bloc.lien.debut + k);
    return {
      ...recale,
      slides: recale.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.map((b, m) => (m !== n ? b : { ...b, lien, texte: materialiser(nouvelle, lien) })) })),
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
      avant = [...avant, { ...bloc, lien: l1, texte: materialiser(source, l1) }];
      apres = [{ ...bloc, style: suiteDe(bloc.style), lien: l2, texte: materialiser(source, l2) }, ...apres];
    } else {
      avant = [...avant, { ...bloc, texte: bloc.texte.slice(0, position).trim() }];
      apres = [{ ...bloc, style: suiteDe(bloc.style), texte: bloc.texte.slice(position).trim() }, ...apres];
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
        blocs = [...s1.blocs.slice(0, -1), { ...dernier, lien, texte: materialiser(source, lien) }, ...s2.blocs.slice(1)];
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

  const api = { SEPARATEUR, sourceDe, materialiser, lierArticle, appliquerEditionSource, modifierBlocLie, couperSlide, retirerCoupure, phrases, passagesNonCouverts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPLiens = api;
})(typeof window !== 'undefined' ? window : globalThis);
