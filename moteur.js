/*
 * PostsOP — moteur de composition des slides (v2)
 *
 * Le gabarit d'une slide ne modifie jamais son texte : il décide seulement de la façon
 * de le dessiner. On peut donc changer de gabarit autant qu'on veut sans rien perdre.
 * Le même calcul sert à l'aperçu, aux miniatures et aux exports.
 */
(function (racine) {
  'use strict';

  /* ---------- Charte Oh ! Potentiel ---------- */

  const PALETTE = { bleu: '#003846', vert: '#C9D420', blanc: '#FFFFFF', bleuPale: '#E6EBEC', vertPale: '#F3F6CE' };
  const P = PALETTE;

  // Pour chaque fond : texte, mise en valeur, filet des citations, bandeau, surligneur, encadré, décor.
  // Interdits respectés par construction : jamais de texte vert ou blanc sur fond pâle,
  // ni blanc sur vert, ni vert sur blanc.
  function construireFonds(p) {
    return {
      bleu: { nom: 'Bleu', fond: p.bleu, texte: p.blanc, accent: p.vert, filet: null, bande: { fond: p.vert, texte: p.bleu }, surligne: { fond: p.vert, texte: p.bleu }, carte: { fond: p.blanc, texte: p.bleu }, decor: p.vert },
      blanc: { nom: 'Blanc', fond: p.blanc, texte: p.bleu, accent: p.bleu, filet: p.vert, bande: { fond: p.vert, texte: p.bleu }, surligne: { fond: p.vert, texte: p.bleu }, carte: { fond: p.bleu, texte: p.blanc }, decor: p.vert },
      vert: { nom: 'Vert', fond: p.vert, texte: p.bleu, accent: p.bleu, filet: p.bleu, bande: { fond: p.bleu, texte: p.blanc }, surligne: { fond: p.blanc, texte: p.bleu }, carte: { fond: p.blanc, texte: p.bleu }, decor: p.bleu },
      bleuPale: { nom: 'Bleu pâle', fond: p.bleuPale, texte: p.bleu, accent: p.bleu, filet: p.vert, bande: { fond: p.bleu, texte: p.blanc }, surligne: { fond: p.vert, texte: p.bleu }, carte: { fond: p.bleu, texte: p.blanc }, decor: p.vert },
      vertPale: { nom: 'Vert pâle', fond: p.vertPale, texte: p.bleu, accent: p.bleu, filet: p.bleu, bande: { fond: p.bleu, texte: p.blanc }, surligne: { fond: p.vert, texte: p.bleu }, carte: { fond: p.bleu, texte: p.blanc }, decor: p.bleu },
    };
  }
  const FONDS = construireFonds(PALETTE);
  const cacheFonds = new WeakMap();
  const fondsDe = (palette) => {
    if (!palette) return FONDS;
    if (!cacheFonds.has(palette)) cacheFonds.set(palette, construireFonds({ ...PALETTE, ...palette }));
    return cacheFonds.get(palette);
  };

  // Charte par défaut : modifiable dans Configuration › Charte, et enregistrée dans projet.json.
  const CHARTE_DEFAUT = { palette: { ...PALETTE }, tailleTitre: 114, tailleTexte: 39 };

  const FORMATS = {
    carre: { nom: 'Carré 1:1', l: 1080, h: 1080 },
    portrait: { nom: 'Portrait 4:5', l: 1080, h: 1350 },
  };

  const MARGES = { gauche: 81, droite: 162, haute: 110, basse: 110 };
  const SIGNATURE = { l: 220, h: 90, ecart: 40 };
  const LOGO_PARTOUT = { l: 170, h: 64, bas: 70 };

  // Natures de paragraphe : ce que le texte EST. Le gabarit décide comment il s'affiche.
  const NATURES = {
    corps: { nom: 'Texte' },
    emphase: { nom: 'Phrase-choc' },
    citation: { nom: 'Citation' },
    titre: { nom: 'Titre de couverture' },
    contrepoint: { nom: 'Contrepoint' },
  };

  const GABARITS = {
    V1: { nom: 'Classique', famille: 'Couverture', aide: 'Le titre en grand, le contrepoint dans la couleur de mise en valeur.' },
    V2: { nom: 'Bandeau', famille: 'Couverture', aide: 'Le contrepoint posé sur un bandeau de couleur.' },
    V3: { nom: 'Grand mot', famille: 'Couverture', aide: 'Le premier mot du contrepoint en très grand.' },
    V4: { nom: 'Deux tons', famille: 'Couverture', aide: 'Le constat en haut, le contrepoint sur une seconde couleur en bas.' },
    V5: { nom: 'Fleurs', famille: 'Couverture', aide: 'La couverture classique, avec ta guirlande de fleurs.' },
    T1: { nom: 'Classique', famille: 'Texte', aide: 'Le texte aligné à gauche, calé en haut.' },
    T2: { nom: 'Respiration', famille: 'Texte', aide: 'Une phrase seule, en grand, centrée verticalement.' },
    T3: { nom: 'Surlignage', famille: 'Texte', aide: 'Les phrases-chocs passées au surligneur.' },
    T4: { nom: 'Grande citation', famille: 'Texte', aide: 'La citation en grand, avec un guillemet géant.' },
    T5: { nom: 'Encadré', famille: 'Texte', aide: 'Les phrases-chocs dans un encadré.' },
    F1: { nom: 'Fin centrée', famille: 'Fin', aide: 'Le texte centré, les fleurs et le logo au centre.' },
  };

  // Pour chaque gabarit : les natures de paragraphe qui ont un effet, et leur nom dans ce gabarit.
  const NATURES_PAR_GABARIT = {
    couverture: [['titre', 'Titre'], ['contrepoint', 'Contrepoint']],
    V3: [['titre', 'Phrase d’introduction'], ['contrepoint', 'Grand mot, puis suite']],
    T1: [['corps', 'Texte'], ['emphase', 'Phrase-choc'], ['citation', 'Citation']],
    T2: [['emphase', 'Phrase en grand'], ['citation', 'Citation en grand']],
    T3: [['corps', 'Texte'], ['emphase', 'Surlignée'], ['citation', 'Citation']],
    T4: [['corps', 'Texte'], ['citation', 'Grande citation'], ['emphase', 'Phrase-choc']],
    T5: [['corps', 'Texte'], ['emphase', 'Encadrée'], ['citation', 'Citation']],
    F1: [['corps', 'Texte'], ['emphase', 'Phrase-choc'], ['citation', 'Citation']],
  };
  function naturesUtiles(gabarit) {
    if (gabarit === 'V3') return NATURES_PAR_GABARIT.V3;
    if (/^V/.test(gabarit)) return NATURES_PAR_GABARIT.couverture;
    return NATURES_PAR_GABARIT[gabarit] || NATURES_PAR_GABARIT.T1;
  }
  // Nature affichée quand un paragraphe vient d'un autre gabarit (son texte et sa nature d'origine sont conservés).
  function natureAffichee(gabarit, nature, position) {
    const utiles = naturesUtiles(gabarit).map((n) => n[0]);
    if (utiles.includes(nature)) return nature;
    if (/^V/.test(gabarit)) return position === 0 ? 'titre' : 'contrepoint';
    if (nature === 'titre' || nature === 'contrepoint') return utiles.includes('emphase') ? 'emphase' : utiles[0];
    return utiles[0];
  }

  function luminanceHex(hex) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  const fondFonce = (couleur) => luminanceHex(couleur) < 0.25;
  // choix : 'auto' (selon la couleur derrière le logo), 'fonce' ou 'clair'.
  function cleLogo(choix, couleurDerriere) {
    if (choix === 'fonce') return 'logo';
    if (choix === 'clair') return 'logoClair';
    return fondFonce(couleurDerriere) ? 'logoClair' : 'logo';
  }

  const LIMITES_SLIDES = { instagram: 20, linkedin: 100 }; // à vérifier au développement : elles changent

  /* ---------- Polices ---------- */

  function policeExacte(font) {
    return {
      exacte: true,
      asc: font.ascender / font.unitsPerEm,
      desc: -font.descender / font.unitsPerEm,
      mesurer: (texte, taille) => font.getAdvanceWidth(texte, taille, { kerning: true }),
      trace: (texte, x, y, taille) => font.getPath(texte, x, y, taille, { kerning: true }).toPathData(2),
      dessiner(ctx, texte, x, y, taille, couleur) {
        const chemin = font.getPath(texte, x, y, taille, { kerning: true });
        chemin.fill = couleur;
        chemin.draw(ctx);
      },
    };
  }

  // Gill Sans de l'iPad : rendu approché, en attendant tes fichiers.
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

  /* ---------- Texte ---------- */

  const normaliserEspaces = (texte) => String(texte).replace(/\u202F/g, '\u00A0');

  function couperLignes(police, texte, taille, largeurMax) {
    const lignes = [];
    for (const ligneImposee of normaliserEspaces(texte).split('\n')) {
      let courante = '';
      for (const mot of ligneImposee.split(' ')) {
        const essai = courante ? courante + ' ' + mot : mot;
        if (!courante || police.mesurer(essai, taille) <= largeurMax) courante = essai;
        else { lignes.push(courante); courante = mot; }
      }
      lignes.push(courante);
    }
    return lignes;
  }

  // Empile des paragraphes dans une colonne. Les éléments sont exprimés depuis le haut de la pile.
  function empiler(specs, zone, choisirPolice) {
    const elements = [];
    let y = 0;
    let tropLarge = false;
    specs.forEach((s, i) => {
      const police = choisirPolice(s.role);
      const hl = s.taille * s.interligne;
      const base = (hl - (police.asc + police.desc) * s.taille) / 2 + police.asc * s.taille;
      const debut = y;
      const marge = s.carte ? s.carte.marge : 0;
      const largeur = (s.largeur || zone.largeur) - 2 * marge;
      const locaux = [];
      if (s.carte) y += marge;
      if (s.decor) {
        // Guillemet géant posé juste au-dessus de la citation.
        locaux.push({ type: 'ligne', texte: '«', x: zone.x - 19, y: y + 170, police: choisirPolice('bold'), taille: 380, couleur: s.decor });
        y += 190;
      }
      for (const texte of couperLignes(police, s.texte, s.taille, largeur)) {
        const l = police.mesurer(texte, s.taille);
        if (l > largeur + 0.5) tropLarge = true;
        const x = zone.alignement === 'centre' ? zone.x + (zone.largeur - l) / 2 : zone.x + marge;
        if (s.surligne) {
          const hb = s.taille * 1.18;
          locaux.push({ type: 'rect', x: x - 10, y: y + (hl - hb) / 2, l: l + 20, h: hb, couleur: s.surligne });
        }
        locaux.push({ type: 'ligne', texte, x, y: y + base, police, taille: s.taille, couleur: s.couleur });
        y += hl;
      }
      if (s.carte) {
        y += marge;
        locaux.unshift({ type: 'rect', x: zone.x, y: debut, l: zone.largeur, h: y - debut, couleur: s.carte.fond, rayon: 28 });
      }
      if (s.filet) locaux.push({ type: 'rect', x: zone.x - 30, y: debut + 8, l: 5, h: y - debut - 16, couleur: s.filet });
      elements.push(...locaux);
      if (i < specs.length - 1) y += s.espaceApres || 0;
    });
    return { elements, hauteur: y, tropLarge };
  }

  const decaler = (elements, dy) => elements.map((e) => ({ ...e, y: e.y + dy }));

  // Plus grande taille (entre min et max) pour laquelle la pile tient dans la zone.
  function ajuster(fabriquer, zone, hauteurMax, choisirPolice, max, min) {
    for (let taille = max; taille >= min; taille -= 4) {
      const pile = empiler(fabriquer(taille), zone, choisirPolice);
      if (!pile.tropLarge && pile.hauteur <= hauteurMax) return pile;
    }
    return empiler(fabriquer(min), zone, choisirPolice);
  }

  /* ---------- Gabarits ---------- */

  function gabaritParDefaut(slide, index, total) {
    if (slide.gabarit && GABARITS[slide.gabarit]) return slide.gabarit;
    if (index === 0 || String(slide.role).toLowerCase() === 'couverture') return 'V1';
    return 'T1';
  }


  function specsTexte(blocs, fond, options = {}) {
    const t = options.tailleTexte || 39;
    const ligne = t * 1.25;
    return blocs.map((b) => {
      const n = b.style;
      if (n === 'citation') return { texte: b.texte, role: 'light', taille: t, interligne: 1.25, couleur: fond.accent, filet: fond.filet, espaceApres: ligne };
      if (n === 'corps') return { texte: b.texte, role: 'light', taille: t, interligne: 1.25, couleur: fond.texte, espaceApres: ligne };
      // emphase, titre, contrepoint
      if (options.surligne) return { texte: b.texte, role: 'bold', taille: options.tailleSurligne || t * 1.5, interligne: 1.4, couleur: fond.surligne.texte, surligne: fond.surligne.fond, espaceApres: ligne };
      return { texte: b.texte, role: 'bold', taille: t, interligne: 1.25, couleur: fond.texte, espaceApres: ligne };
    });
  }

  function composer(slide, formatId, fondId, choisirPolice, contexte = {}) {
    const fmt = FORMATS[formatId];
    const charte = contexte.charte || CHARTE_DEFAUT;
    const fonds = fondsDe(charte.palette);
    const fond = fonds[fondId] || fonds.bleu;
    const echelle = slide.echelle || 1; // réduction propre à cette slide
    const kT = ((charte.tailleTexte || 39) / 39) * echelle; // échelle du texte courant
    const kC = ((charte.tailleTitre || 114) / 114) * echelle; // échelle des couvertures
    const T = (n) => Math.round(n * kT);
    const C = (n) => Math.round(n * kC);
    const LIGNE = T(39) * 1.25;
    const optionsTexte = { tailleTexte: T(39) };
    const index = contexte.index || 0;
    const total = contexte.total || 1;
    const reglages = contexte.reglages || {};
    const gab = gabaritParDefaut(slide, index, total);
    const signature = !!slide.signature;
    const logoPartout = !!reglages.logoPartout && !signature;
    const L = fmt.l;
    const H = fmt.h;
    const zone = { x: MARGES.gauche, largeur: L - MARGES.gauche - MARGES.droite, alignement: 'gauche' };
    const haut = MARGES.haute;
    const bas = H - MARGES.basse - (signature && gab !== 'F1' ? SIGNATURE.h + SIGNATURE.ecart : 0) - (logoPartout ? LOGO_PARTOUT.h + 30 : 0);
    const blocs = slide.blocs.filter((b) => String(b.texte).trim());
    const cp = fond.accent === fond.texte ? 'light' : 'bold';
    let elements = [];
    let deborde = false;
    let tropLarge = false;
    let couleurPied = fond.texte;

    const titre = blocs[0];
    const suite = blocs.slice(1);
    const pileCentree = (pile, zoneHaut, zoneBas) => {
      const y0 = (zoneHaut + zoneBas - pile.hauteur) / 2;
      if (y0 < zoneHaut - 0.5 || y0 + pile.hauteur > zoneBas + 0.5) deborde = true;
      tropLarge = tropLarge || pile.tropLarge;
      return decaler(pile.elements, y0);
    };
    const pileHaut = (pile, y0, zoneBas) => {
      if (y0 + pile.hauteur > zoneBas + 0.5) deborde = true;
      tropLarge = tropLarge || pile.tropLarge;
      return decaler(pile.elements, y0);
    };
    const couverture = (taille, couleurTitre, couleurSuite, roleSuite) => [
      ...(titre ? [{ texte: titre.texte, role: 'bold', taille, interligne: 1.1, couleur: couleurTitre, espaceApres: 0 }] : []),
      ...suite.map((b) => ({ texte: b.texte, role: roleSuite, taille, interligne: 1.1, couleur: couleurSuite, espaceApres: 0 })),
    ];

    switch (gab) {
      case 'V1': {
        elements = pileCentree(empiler(couverture(C(114), fond.texte, fond.accent, cp), zone, choisirPolice), haut, bas);
        break;
      }
      case 'V2': {
        const bandeHaut = Math.round(H * 0.593);
        const bandeH = Math.round(H * 0.278);
        const t = empiler(titre ? [{ texte: titre.texte, role: 'bold', taille: C(104), interligne: 1.08, couleur: fond.texte }] : [], zone, choisirPolice);
        elements.push(...pileHaut(t, haut + 40, bandeHaut - 30));
        elements.push({ type: 'rect', x: 0, y: bandeHaut, l: L, h: bandeH, couleur: fond.bande.fond });
        const zoneBande = { ...zone, largeur: L - 2 * MARGES.gauche };
        const c = ajuster((taille) => suite.map((b) => ({ texte: b.texte, role: 'bold', taille, interligne: 1.08, couleur: fond.bande.texte })), zoneBande, bandeH - 60, choisirPolice, C(92), C(56));
        elements.push(...pileCentree(c, bandeHaut + 30, bandeHaut + bandeH - 30));
        break;
      }
      case 'V3': {
        if (!suite.length) { elements = pileCentree(empiler(couverture(C(114), fond.texte, fond.accent, cp), zone, choisirPolice), haut, bas); break; }
        const texteSuite = suite.map((b) => b.texte).join('\n');
        const coupe = texteSuite.includes('\n') ? texteSuite.indexOf('\n') : (texteSuite.indexOf(' ') > 0 ? texteSuite.indexOf(' ') : texteSuite.length);
        const grand = texteSuite.slice(0, coupe).trim();
        const reste = texteSuite.slice(coupe).replace(/\n/g, ' ').trim();
        const zoneLarge = { ...zone, largeur: L - 2 * MARGES.gauche };
        const police = choisirPolice('bold');
        let tailleGrand = C(230);
        while (tailleGrand > C(120) && police.mesurer(grand, tailleGrand) > zoneLarge.largeur) tailleGrand -= 10;
        const specs = [
          ...(titre ? [{ texte: titre.texte.replace(/\n/g, ' '), role: 'light', taille: C(52), interligne: 1.2, couleur: fond.texte, espaceApres: 36 }] : []),
          { texte: grand, role: 'bold', taille: tailleGrand, interligne: 1, couleur: fond.accent, espaceApres: 36 },
          ...(reste ? [{ texte: reste, role: 'bold', taille: C(84), interligne: 1.1, couleur: fond.texte }] : []),
        ];
        elements = pileCentree(empiler(specs, zoneLarge, choisirPolice), haut + 30, bas - 30);
        break;
      }
      case 'V4': {
        const coupe = Math.round(H * 0.556);
        const zoneLarge = { ...zone, largeur: L - 2 * MARGES.gauche };
        const t = ajuster((taille) => (titre ? [{ texte: titre.texte, role: 'bold', taille, interligne: 1.08, couleur: fond.texte }] : []), zoneLarge, coupe - 56 - haut, choisirPolice, C(96), C(56));
        const yTitre = coupe - 56 - t.hauteur;
        if (yTitre < haut - 0.5) deborde = true;
        tropLarge = tropLarge || t.tropLarge;
        elements.push({ type: 'rect', x: 0, y: coupe, l: L, h: H - coupe, couleur: fond.bande.fond });
        elements.push(...decaler(t.elements, yTitre));
        const c = ajuster((taille) => suite.map((b) => ({ texte: b.texte, role: 'bold', taille, interligne: 1.08, couleur: fond.bande.texte })), zoneLarge, bas - coupe - 56, choisirPolice, C(96), C(56));
        elements.push(...pileHaut(c, coupe + 56, bas));
        couleurPied = fond.bande.texte;
        break;
      }
      case 'V5': {
        elements = pileHaut(empiler(couverture(C(96), fond.texte, fond.accent, cp), zone, choisirPolice), haut + 10, H - 300);
        const l = Math.round(L * 0.52);
        const h = Math.round((l * 275) / 696);
        elements.push({ type: 'image', cle: 'fleurs', x: L - 60 - l, y: H - 70 - h, l, h, libelle: 'Fleurs', couleur: fond.texte });
        break;
      }
      case 'T2': {
        const c = ajuster((taille) => blocs.map((b) => ({ texte: b.texte, role: 'bold', taille, interligne: 1.1, couleur: b.style === 'citation' ? fond.accent : fond.texte, espaceApres: taille * 0.4 })), zone, bas - haut, choisirPolice, T(140), T(52));
        elements = pileCentree(c, haut, bas);
        break;
      }
      case 'T3': {
        const pile = ajuster((taille) => specsTexte(blocs, fond, { ...optionsTexte, surligne: true, tailleSurligne: taille }), zone, bas - haut, choisirPolice, T(58), T(42));
        elements = pileHaut(pile, haut, bas);
        break;
      }
      case 'T4': {
        if (!blocs.some((b) => b.style === 'citation')) { elements = pileHaut(empiler(specsTexte(blocs, fond, optionsTexte), zone, choisirPolice), haut, bas); break; }
        const zoneLarge = { ...zone, largeur: L - MARGES.gauche - 120 };
        let premiere = true;
        const pile = ajuster((taille) => {
          premiere = true;
          return blocs.map((b) => {
            if (b.style === 'citation') {
              const spec = { texte: b.texte.replace(/^«\s*/, ''), role: 'light', taille, interligne: 1.3, couleur: fond.texte, decor: premiere ? fond.decor : null, espaceApres: LIGNE };
              premiere = false;
              return spec;
            }
            return { texte: b.texte, role: b.style === 'corps' ? 'light' : 'bold', taille: T(39), interligne: 1.25, couleur: fond.texte, largeur: zone.largeur, espaceApres: LIGNE };
          });
        }, zoneLarge, bas - haut, choisirPolice, T(56), T(40));
        elements = pileHaut(pile, haut, bas);
        break;
      }
      case 'T5': {
        const zoneLarge = { ...zone, largeur: L - 2 * MARGES.gauche };
        const pile = ajuster((taille) => blocs.map((b) => {
          if (b.style === 'corps' || b.style === 'citation') return { ...specsTexte([b], fond, optionsTexte)[0], largeur: zone.largeur, espaceApres: 56 };
          return { texte: b.texte, role: 'bold', taille, interligne: 1.15, couleur: fond.carte.texte, carte: { fond: fond.carte.fond, marge: 56 }, espaceApres: 56 };
        }), zoneLarge, bas - haut, choisirPolice, T(76), T(40));
        elements = pileHaut(pile, haut, bas);
        break;
      }
      case 'F1': {
        const zoneCentre = { x: 140, largeur: L - 280, alignement: 'centre' };
        const specs = blocs.map((b) => ({ texte: b.texte, role: b.style === 'corps' || b.style === 'citation' ? 'light' : 'bold', taille: T(52), interligne: 1.3, couleur: b.style === 'citation' ? fond.accent : fond.texte, espaceApres: 40 }));
        const pile = empiler(specs, zoneCentre, choisirPolice);
        const y0 = Math.round(H * 0.213);
        elements.push(...pileHaut(pile, y0, H - 420));
        const lf = 420;
        const hf = Math.round((lf * 275) / 696);
        elements.push({ type: 'image', cle: 'fleurs', x: (L - lf) / 2, y: y0 + pile.hauteur + 60, l: lf, h: hf, libelle: 'Fleurs', couleur: fond.texte });
        if (signature) elements.push({ type: 'image', cle: 'logo', x: (L - 260) / 2, y: H - 90 - 100, l: 260, h: 100, libelle: 'Logo Oh ! Potentiel', couleur: fond.texte });
        break;
      }
      default: { // T1
        elements = pileHaut(empiler(specsTexte(blocs, fond, optionsTexte), zone, choisirPolice), haut, bas);
      }
    }

    // Éléments fixes : logo de fin, logo sur chaque slide, numéro, indicateur « glisser ».
    const choixLogo = contexte.logo || 'auto';
    const derriere = gab === 'V4' ? fond.bande.fond : fond.fond;
    const libelleLogo = (cle) => (cle === 'logoClair' ? 'Logo clair' : 'Logo foncé');
    for (const e of elements) if (e.type === 'image' && e.cle === 'logo') { e.cle = cleLogo(choixLogo, fond.fond); e.libelle = libelleLogo(e.cle); }
    if (signature && gab !== 'F1') elements.push({ type: 'image', cle: cleLogo(choixLogo, derriere), libelle: libelleLogo(cleLogo(choixLogo, derriere)), x: MARGES.gauche, y: H - MARGES.basse - SIGNATURE.h, l: SIGNATURE.l, h: SIGNATURE.h, couleur: couleurPied });
    if (logoPartout) elements.push({ type: 'image', cle: cleLogo(choixLogo, derriere), x: L - 81 - LOGO_PARTOUT.l, y: H - LOGO_PARTOUT.bas - LOGO_PARTOUT.h, l: LOGO_PARTOUT.l, h: LOGO_PARTOUT.h, libelle: 'Logo', couleur: couleurPied });
    if (reglages.numero && !signature) {
      const police = choisirPolice('light');
      elements.push({ type: 'ligne', texte: `${index + 1}\u00A0/\u00A0${total}`, x: MARGES.gauche, y: H - 62, police, taille: 26, couleur: couleurPied, opacite: 0.75 });
    }
    if (reglages.glisser && index < total - 1) elements.push({ type: 'fleche', x: L - 64, y: H / 2, couleur: gab === 'V4' && H / 2 > H * 0.556 ? couleurPied : fond.texte });

    return {
      fmt, fond, gabarit: gab, elements, tailleTexte: T(39),
      deborde: deborde || tropLarge,
      exacte: elements.every((e) => e.type !== 'ligne' || e.police.exacte),
    };
  }

  /* ---------- Dessin ---------- */

  function rectArrondi(ctx, x, y, l, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + l - r, y);
    ctx.quadraticCurveTo(x + l, y, x + l, y + r);
    ctx.lineTo(x + l, y + h - r);
    ctx.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function dessiner(ctx, compo, ressources = {}, options = {}) {
    const { fmt, fond } = compo;
    ctx.fillStyle = fond.fond;
    ctx.fillRect(0, 0, fmt.l, fmt.h);
    for (const e of compo.elements) {
      if (e.type === 'rect') {
        ctx.fillStyle = e.couleur;
        if (e.rayon) { rectArrondi(ctx, e.x, e.y, e.l, e.h, e.rayon); ctx.fill(); } else ctx.fillRect(e.x, e.y, e.l, e.h);
      } else if (e.type === 'ligne') {
        ctx.save();
        if (e.opacite) ctx.globalAlpha = e.opacite;
        e.police.dessiner(ctx, e.texte, e.x, e.y, e.taille, e.couleur);
        ctx.restore();
      } else if (e.type === 'image') {
        const image = ressources[e.cle];
        if (image && image.width) {
          const echelle = Math.min(e.l / image.width, e.h / image.height);
          const l = image.width * echelle;
          const h = image.height * echelle;
          ctx.drawImage(image, e.x + (e.l - l) / 2, e.y + (e.h - h) / 2, l, h);
        } else if (!options.export) {
          ctx.save();
          ctx.strokeStyle = e.couleur;
          ctx.fillStyle = e.couleur;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.strokeRect(e.x, e.y, e.l, e.h);
          ctx.setLineDash([]);
          ctx.font = '500 20px -apple-system, "Helvetica Neue", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(e.libelle, e.x + e.l / 2, e.y + e.h / 2 + 7);
          ctx.restore();
        }
      } else if (e.type === 'fleche') {
        ctx.save();
        ctx.strokeStyle = e.couleur;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x - 14, e.y - 22);
        ctx.lineTo(e.x + 8, e.y);
        ctx.lineTo(e.x - 14, e.y + 22);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---------- Contrôles qualité ---------- */

  const normaliserTexte = (texte) => normaliserEspaces(texte).replace(/\s+/g, ' ').trim();
  const compterMots = (texte) => (normaliserTexte(texte).match(/\S+/g) || []).length;

  function passagesManquants(paragraphes, slides) {
    const contenu = normaliserTexte(slides.map((s) => s.blocs.map((b) => b.texte).join(' ')).join(' '));
    return paragraphes.filter((p) => normaliserTexte(p) && !contenu.includes(normaliserTexte(p)));
  }

  function textesAjoutes(paragraphes, slides) {
    const article = normaliserTexte(paragraphes.join(' '));
    const ajoutes = [];
    slides.forEach((s, i) => s.blocs.forEach((b) => {
      const t = normaliserTexte(b.texte);
      if (t && !article.includes(t)) ajoutes.push({ slide: i, texte: t });
    }));
    return ajoutes;
  }

  function empreinte(texte) {
    let h = 2166136261;
    for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function controler(article, compositions, reglages) {
    const brutes = controlerBrut(article, compositions, reglages);
    return brutes.map((a) => {
      const s = a.slide !== null ? article.slides[a.slide] : null;
      const contenu = s ? JSON.stringify([s.blocs, s.gabarit, article.fond, article.format]) : a.message;
      return { ...a, cle: empreinte(a.type + '|' + a.slide + '|' + contenu) };
    });
  }
  function controlerBrut(article, compositions, reglages) {
    const alertes = [];
    compositions.forEach((compo, i) => {
      if (compo.deborde) alertes.push({ type: 'deborde', niveau: 'bloquant', slide: i, cible: 'design', message: 'Le texte dépasse les marges. Raccourcis-le, déplace un paragraphe ou essaie un autre gabarit.' });
      const mots = article.slides[i].blocs.reduce((n, b) => n + compterMots(b.texte), 0);
      if (compo.tailleTexte && compo.tailleTexte < 34) alertes.push({ type: 'lisibilite', niveau: 'avertissement', slide: i, cible: 'design', message: `Texte à ${compo.tailleTexte} px : en dessous de 34 px, la lecture sur téléphone devient difficile.` });
      if (mots > reglages.motsMax) alertes.push({ type: 'densite', niveau: 'avertissement', slide: i, cible: 'design', message: `${mots} mots : au-delà de ta limite de ${reglages.motsMax}.` });
    });
    const limite = LIMITES_SLIDES[article.reseau];
    if (article.slides.length > limite) {
      alertes.push({ type: 'limite', niveau: 'bloquant', slide: null, cible: 'structure', message: `${article.slides.length} slides : la limite ${article.reseau === 'instagram' ? 'd’Instagram' : 'de LinkedIn'} est de ${limite}.` });
    }
    for (const passage of passagesManquants(article.texte, article.slides)) {
      alertes.push({ type: 'manquant', niveau: 'bloquant', slide: null, cible: 'design', message: `Ce passage de l’article ne figure dans aucune slide : « ${passage.slice(0, 60)}${passage.length > 60 ? '…' : ''} ». Tout le texte doit être dans le carrousel : remets-le dans une slide, ou change l’accroche.` });
    }
    for (const ajout of textesAjoutes(article.texte, article.slides)) {
      alertes.push({ type: 'ajout', niveau: 'avertissement', slide: ajout.slide, cible: 'design', message: `Ce texte n’existe pas dans l’article : « ${ajout.texte.slice(0, 50)}${ajout.texte.length > 50 ? '…' : ''} ». Vérifie qu’il est voulu.` });
    }
    return alertes;
  }

  // Découpage sans IA : on remplit chaque slide de paragraphes tant qu'ils tiennent.
  function decouperMecaniquement(paragraphes, formatId, fondId, choisirPolice, contexte = {}) {
    const slides = [];
    if (!paragraphes.length) return slides;
    const [premier, ...suite] = paragraphes;
    slides.push({ role: 'Couverture', gabarit: 'V1', blocs: [{ style: 'titre', texte: premier }] });
    let courante = null;
    for (const p of suite) {
      const style = /^«/.test(p.trim()) ? 'citation' : 'corps';
      if (courante) {
        const essai = { ...courante, blocs: [...courante.blocs, { style, texte: p }] };
        if (!composer(essai, formatId, fondId, choisirPolice, contexte).deborde) { courante = essai; continue; }
        slides.push(courante);
      }
      courante = { role: 'Texte', gabarit: 'T1', blocs: [{ style, texte: p }] };
    }
    if (courante) slides.push(courante);
    const derniere = slides[slides.length - 1];
    derniere.signature = true;
    const fin = { role: 'Texte', gabarit: 'T1', blocs: [], signature: true };
    while (derniere.blocs.length > 1 && composer(derniere, formatId, fondId, choisirPolice, contexte).deborde) fin.blocs.unshift(derniere.blocs.pop());
    if (fin.blocs.length) { derniere.signature = false; slides.push(fin); }
    return slides;
  }

  // Proposer une autre présentation, sans IA : un fond et des gabarits
  // différents de ceux des articles précédents, toujours dans la charte.
  function proposerPresentation(article, autres, rythme, aleatoire = Math.random, convient = () => true) {
    const recents = autres.slice(0, 3);
    const fonds = Object.keys(FONDS).filter((f) => f !== article.fond && !recents.some((a) => a.fond === f));
    const choisir = (liste, repli) => (liste.length ? liste[Math.floor(aleatoire() * liste.length)] : repli);
    const fond = choisir(fonds, Object.keys(FONDS).find((f) => f !== article.fond));
    const couvertures = ['V1', 'V2', 'V3', 'V4', 'V5'].filter((g) => g !== (article.slides[0] && article.slides[0].gabarit) && !recents.some((a) => a.slides[0] && a.slides[0].gabarit === g));
    const melanger = (liste) => liste.map((g) => [aleatoire(), g]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    // Pour chaque slide, des gabarits par ordre de préférence ; on garde le premier qui tient dans les marges.
    const slides = article.slides.map((s, i) => {
      let preferes;
      if (i === 0) preferes = [...melanger(couvertures), 'V1'];
      else if (rythme === 'regulier') preferes = ['T1'];
      else {
        const seulementChoc = s.blocs.length && s.blocs.every((b) => b.style === 'emphase');
        const citation = s.blocs.some((b) => b.style === 'citation');
        const choc = s.blocs.some((b) => b.style === 'emphase');
        if (seulementChoc) preferes = ['T2', 'T5', 'T1'];
        else if (choc) preferes = [...melanger(['T3', 'T5']), 'T1'];
        else if (citation && rythme === 'contraste') preferes = ['T4', 'T1'];
        else preferes = ['T1'];
        if (s.signature && rythme === 'contraste') preferes = ['F1', ...preferes];
      }
      const retenu = preferes.find((g) => convient({ ...s, gabarit: g }, i, fond)) || 'T1';
      return { ...s, gabarit: retenu };
    });
    return { fond, slides };
  }

  // Cherche, pour une slide qui déborde, les corrections possibles en un geste.
  function solutionsDebordement(article, i, choisirPolice, contexte = {}) {
    const s = article.slides[i];
    const ctx = { ...contexte, index: i, total: article.slides.length };
    const tient = (slide, format = article.format, fond = article.fond) => !composer(slide, format, fond, choisirPolice, ctx).deborde;
    const solutions = [];
    for (const e of [0.95, 0.9, 0.85, 0.8, 0.75]) {
      if (tient({ ...s, echelle: (s.echelle || 1) * e })) { solutions.push({ type: 'reduire', echelle: Math.round((s.echelle || 1) * e * 100) / 100 }); break; }
    }
    if (s.blocs.length > 1) {
      for (let b = s.blocs.length - 1; b >= 1; b--) {
        if (tient({ ...s, blocs: s.blocs.slice(0, b), signature: false })) { solutions.push({ type: 'scinder', bloc: b, reste: s.blocs.length - b }); break; }
      }
    }
    if (article.format === 'carre' && tient(s, 'portrait')) solutions.push({ type: 'portrait' });
    const famille = /^V/.test(gabaritParDefaut(s, i)) ? ['V1', 'V2', 'V3', 'V4', 'V5'] : ['T1', 'T3', 'T5', 'T4', 'T2', 'F1'];
    const autre = famille.find((g) => g !== gabaritParDefaut(s, i) && tient({ ...s, gabarit: g }));
    if (autre) solutions.push({ type: 'gabarit', gabarit: autre });
    return solutions;
  }

  const api = {
    PALETTE, FONDS, CHARTE_DEFAUT, construireFonds, fondsDe, naturesUtiles, natureAffichee, FORMATS, MARGES, NATURES, GABARITS, LIMITES_SLIDES,
    policeExacte, policeSysteme, fondFonce, cleLogo, couperLignes, composer, dessiner, gabaritParDefaut,
    compterMots, passagesManquants, textesAjoutes, controler, solutionsDebordement, decouperMecaniquement, proposerPresentation,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPMoteur = api;
})(typeof window !== 'undefined' ? window : globalThis);
