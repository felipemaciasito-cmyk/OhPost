/*
 * PostsOP — moteur de composition des slides
 *
 * Calcule la position de chaque ligne à partir de la charte, puis dessine.
 * Le même calcul sert à l'aperçu, aux miniatures et, plus tard, aux exports PNG et PDF.
 * Aucune dépendance au navigateur pour le calcul : il est testé hors ligne.
 */
(function (racine) {
  'use strict';

  /* ---------- Charte Oh ! Potentiel (décisions du 11 octobre 2026) ---------- */

  const PALETTE = { bleu: '#003846', vert: '#C9D420', blanc: '#FFFFFF' };

  // Pour chaque fond : couleur du texte, couleur des mots mis en valeur, couleur du filet des citations.
  // Interdits respectés : jamais de texte vert sur blanc, jamais de texte blanc sur vert.
  const FONDS = {
    bleu: { nom: 'Bleu', fond: PALETTE.bleu, texte: PALETTE.blanc, accent: PALETTE.vert, filet: null },
    blanc: { nom: 'Blanc', fond: PALETTE.blanc, texte: PALETTE.bleu, accent: PALETTE.bleu, filet: PALETTE.vert },
    vert: { nom: 'Vert', fond: PALETTE.vert, texte: PALETTE.bleu, accent: PALETTE.bleu, filet: PALETTE.bleu },
  };

  const FORMATS = {
    carre: { nom: 'Carré 1:1', l: 1080, h: 1080 },
    portrait: { nom: 'Portrait 4:5', l: 1080, h: 1350 },
  };

  const MARGES = { gauche: 81, droite: 162, haute: 110, basse: 110 };
  const SIGNATURE = { largeur: 220, hauteur: 90, ecart: 40 }; // zone réservée au logo

  // Tailles calées sur la hauteur des minuscules de tes carrousels actuels.
  const STYLES = {
    couverture: { nom: 'Couverture', role: 'bold', taille: 114, interligne: 1.1, couleur: 'texte' },
    contrepoint: { nom: 'Contrepoint', role: 'bold', taille: 114, interligne: 1.1, couleur: 'accent' },
    corps: { nom: 'Texte', role: 'light', taille: 39, interligne: 1.25, couleur: 'texte' },
    emphase: { nom: 'Phrase-choc', role: 'bold', taille: 39, interligne: 1.25, couleur: 'texte' },
    citation: { nom: 'Citation', role: 'light', taille: 39, interligne: 1.25, couleur: 'accent', filet: true },
  };

  // Blanc entre deux paragraphes, en nombre de lignes du paragraphe précédent.
  const ESPACE_PARAGRAPHE = { couverture: 0, contrepoint: 0, corps: 1, emphase: 1, citation: 1 };

  // Nombre maximal de slides par réseau : valeurs à vérifier au développement, elles changent.
  const LIMITES_SLIDES = { instagram: 20, linkedin: 100 };

  /* ---------- Polices ---------- */

  // Police lue depuis tes fichiers : rendu exact, identique à l'export.
  function policeExacte(font) {
    return {
      exacte: true,
      asc: font.ascender / font.unitsPerEm,
      desc: -font.descender / font.unitsPerEm,
      mesurer: (texte, taille) => font.getAdvanceWidth(texte, taille, { kerning: true }),
      dessiner(ctx, texte, x, y, taille, couleur) {
        const chemin = font.getPath(texte, x, y, taille, { kerning: true });
        chemin.fill = couleur;
        chemin.draw(ctx);
      },
    };
  }

  // Police système de l'iPad (Gill Sans y est installée) : rendu approché, pour la maquette.
  function policeSysteme(poids) {
    let ctxMesure = null;
    const css = (taille) => `${poids} ${taille}px "Gill Sans", "Gill Sans MT", "Helvetica Neue", sans-serif`;
    return {
      exacte: false,
      asc: 0.92,
      desc: 0.24,
      mesurer(texte, taille) {
        if (!ctxMesure) ctxMesure = document.createElement('canvas').getContext('2d');
        ctxMesure.font = css(taille);
        return ctxMesure.measureText(texte).width;
      },
      dessiner(ctx, texte, x, y, taille, couleur) {
        ctx.font = css(taille);
        ctx.fillStyle = couleur;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(texte, x, y);
      },
    };
  }

  /* ---------- Composition ---------- */

  // L'espace fine insécable n'existe pas dans Gill Sans : on la remplace par une espace insécable.
  const normaliserEspaces = (texte) => texte.replace(/\u202F/g, '\u00A0');

  function couperLignes(police, texte, taille, largeurMax) {
    const lignes = [];
    for (const ligneImposee of normaliserEspaces(texte).split('\n')) {
      let courante = '';
      for (const mot of ligneImposee.split(' ')) {
        const essai = courante ? courante + ' ' + mot : mot;
        if (!courante || police.mesurer(essai, taille) <= largeurMax) {
          courante = essai;
        } else {
          lignes.push(courante);
          courante = mot;
        }
      }
      lignes.push(courante);
    }
    return lignes;
  }

  // slide = { role, blocs: [{ style, texte }], signature }
  function composer(slide, formatId, fondId, choisirPolice) {
    const fmt = FORMATS[formatId];
    const fond = FONDS[fondId];
    const largeurColonne = fmt.l - MARGES.gauche - MARGES.droite;
    const basDisponible = fmt.h - MARGES.basse - (slide.signature ? SIGNATURE.hauteur + SIGNATURE.ecart : 0);
    const lignes = [];
    const filets = [];
    let y = 0;
    let tropLarge = false;

    slide.blocs.forEach((bloc, i) => {
      const style = STYLES[bloc.style];
      // Sur fond blanc ou vert, le contrepoint ne peut pas changer de couleur : il change de graisse.
      const role = bloc.style === 'contrepoint' && fond.accent === fond.texte ? 'light' : style.role;
      const police = choisirPolice(role);
      const hauteurLigne = style.taille * style.interligne;
      const ligneDeBase = (hauteurLigne - (police.asc + police.desc) * style.taille) / 2 + police.asc * style.taille;
      const couleur = fond[style.couleur];
      const debutBloc = y;

      for (const texte of couperLignes(police, bloc.texte, style.taille, largeurColonne)) {
        const largeur = police.mesurer(texte, style.taille);
        if (largeur > largeurColonne + 0.5) tropLarge = true;
        lignes.push({ texte, x: MARGES.gauche, yBase: y + ligneDeBase, police, taille: style.taille, couleur, largeur });
        y += hauteurLigne;
      }
      if (style.filet && fond.filet) filets.push({ y0: debutBloc, y1: y, couleur: fond.filet });
      if (i < slide.blocs.length - 1) y += ESPACE_PARAGRAPHE[bloc.style] * hauteurLigne;
    });

    const hauteur = y;
    const centre = String(slide.role).toLowerCase() === 'couverture';
    const y0 = centre ? (MARGES.haute + basDisponible - hauteur) / 2 : MARGES.haute;
    for (const ligne of lignes) ligne.yBase += y0;
    for (const filet of filets) { filet.y0 += y0; filet.y1 += y0; }

    const depasseBas = y0 + hauteur > basDisponible + 0.5;
    const depasseHaut = y0 < MARGES.haute - 0.5;
    return {
      fmt, fond, lignes, filets, hauteur, y0, largeurColonne,
      deborde: tropLarge || depasseBas || depasseHaut,
      tropLarge,
      exacte: lignes.every((l) => l.police.exacte),
      signature: slide.signature ? {
        x: MARGES.gauche,
        y: fmt.h - MARGES.basse - SIGNATURE.hauteur,
        l: SIGNATURE.largeur,
        h: SIGNATURE.hauteur,
      } : null,
    };
  }

  /* ---------- Dessin ---------- */

  function dessiner(ctx, compo) {
    const { fmt, fond } = compo;
    ctx.fillStyle = fond.fond;
    ctx.fillRect(0, 0, fmt.l, fmt.h);
    for (const filet of compo.filets) {
      ctx.fillStyle = filet.couleur;
      ctx.fillRect(MARGES.gauche - 30, filet.y0 + 8, 5, filet.y1 - filet.y0 - 16);
    }
    for (const ligne of compo.lignes) {
      ligne.police.dessiner(ctx, ligne.texte, ligne.x, ligne.yBase, ligne.taille, ligne.couleur);
    }
    if (compo.signature) {
      // Emplacement du logo officiel : la version à fond transparent n'est pas encore disponible.
      const s = compo.signature;
      ctx.save();
      ctx.strokeStyle = fond.texte;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(s.x, s.y, s.l, s.h);
      ctx.setLineDash([]);
      ctx.fillStyle = fond.texte;
      ctx.font = '500 22px -apple-system, "Helvetica Neue", sans-serif';
      ctx.fillText('Logo Oh ! Potentiel', s.x + 18, s.y + 52);
      ctx.restore();
    }
  }

  /* ---------- Contrôles qualité ---------- */

  const normaliserTexte = (texte) => normaliserEspaces(texte).replace(/\s+/g, ' ').trim();
  const compterMots = (texte) => (normaliserTexte(texte).match(/\S+/g) || []).length;

  // Passages de l'article absents des slides (rien ne doit disparaître sans ton accord).
  function passagesManquants(paragraphes, slides) {
    const contenu = normaliserTexte(slides.map((s) => s.blocs.map((b) => b.texte).join(' ')).join(' '));
    return paragraphes.filter((p) => normaliserTexte(p) && !contenu.includes(normaliserTexte(p)));
  }

  function controler(article, compositions, reglages) {
    const alertes = [];
    compositions.forEach((compo, i) => {
      if (compo.deborde) alertes.push({ niveau: 'bloquant', slide: i, message: 'Le texte dépasse les marges.' });
      const mots = article.slides[i].blocs.reduce((n, b) => n + compterMots(b.texte), 0);
      if (mots > reglages.motsMax) alertes.push({ niveau: 'avertissement', slide: i, message: `${mots} mots : au-delà de ta limite de ${reglages.motsMax}.` });
    });
    const limite = LIMITES_SLIDES[article.reseau];
    if (article.slides.length > limite) {
      alertes.push({ niveau: 'bloquant', slide: null, message: `${article.slides.length} slides : la limite ${article.reseau === 'instagram' ? 'd’Instagram' : 'de LinkedIn'} est de ${limite}.` });
    }
    for (const passage of passagesManquants(article.texte, article.slides)) {
      alertes.push({ niveau: 'bloquant', slide: null, message: `Passage de l’article absent des slides : « ${passage.slice(0, 60)}${passage.length > 60 ? '…' : ''} »` });
    }
    return alertes;
  }

  // Découpage sans IA : on remplit chaque slide de paragraphes tant qu'ils tiennent.
  function decouperMecaniquement(paragraphes, formatId, fondId, choisirPolice) {
    const slides = [];
    if (!paragraphes.length) return slides;
    const [premier, ...suite] = paragraphes;
    slides.push({ role: 'Couverture', blocs: [{ style: compterMots(premier) <= 14 ? 'couverture' : 'corps', texte: premier }] });
    let courante = null;
    for (const p of suite) {
      const style = /^«/.test(p.trim()) ? 'citation' : 'corps';
      if (courante) {
        const essai = { role: 'Texte', blocs: [...courante.blocs, { style, texte: p }] };
        if (!composer(essai, formatId, fondId, choisirPolice).deborde) { courante = essai; continue; }
        slides.push(courante);
      }
      courante = { role: 'Texte', blocs: [{ style, texte: p }] };
    }
    if (courante) slides.push(courante);

    // La dernière slide porte le logo : si elle déborde à cause de lui, ses derniers paragraphes passent sur une slide de fin.
    const derniere = slides[slides.length - 1];
    derniere.signature = true;
    const fin = { role: 'Texte', blocs: [], signature: true };
    while (derniere.blocs.length > 1 && composer(derniere, formatId, fondId, choisirPolice).deborde) {
      fin.blocs.unshift(derniere.blocs.pop());
    }
    if (fin.blocs.length) {
      derniere.signature = false;
      slides.push(fin);
    }
    return slides;
  }

  const api = {
    PALETTE, FONDS, FORMATS, MARGES, STYLES, LIMITES_SLIDES,
    policeExacte, policeSysteme, couperLignes, composer, dessiner,
    compterMots, passagesManquants, controler, decouperMecaniquement,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPMoteur = api;
})(typeof window !== 'undefined' ? window : globalThis);
