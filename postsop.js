/*
 * PostsOP — application (phase 2 : le socle réel)
 *
 * Tout est enregistré sur l'appareil et synchronisé avec ton dépôt GitHub privé :
 * articles, charte, réglages, polices, logo et fleurs.
 * Réel : rendu, 11 gabarits, contrôles qualité, découpage sans IA, LanguageTool, annulation,
 * synchronisation. À venir : export (phase 3), propositions de l'IA (phases 4 à 6),
 * traduction (phase 7).
 */
(function (racine) {
  'use strict';

  const React = racine.React || require('react');
  const M = racine.PostsOPMoteur || require('./moteur.js');
  const S = racine.PostsOPSynchro || require('./synchro.js');
  const X = racine.PostsOPExport || require('./export.js');
  const L = racine.PostsOPLiens || require('./liens.js');
  const T = racine.PostsOPTypographie || require('./typographie.js');
  const IA = racine.PostsOPIA || require('./ia.js');
  const R = racine.PostsOPRelecture || require('./relecture.js');
  const { createElement: h, Fragment, Component, useState, useReducer, useEffect, useLayoutEffect, useMemo, useRef, useContext, createContext } = React;
  const useApresRendu = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  const NB = '\u00A0';
  const cls = (...noms) => noms.filter(Boolean).join(' ');
  const maintenant = () => new Date().toISOString();
  const nouvelId = () => 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ================================================================== */
  /* 1. Données de départ                                                */
  /* ================================================================== */

  const P = [
    'Je crois que je vais démissionner. Pourtant, j’adore mon travail.',
    'C’est ce que me confie Clara, 32 ans, lors de notre première séance.',
    'Depuis quelques mois, son manager ne lui parle presque plus.',
    'Pas de conflit ouvert, pas de reproches. Juste des mails de plus en plus froids, des réunions auxquelles elle n’est plus conviée et des décisions qu’elle découvre après tout le monde.',
    `«${NB}Le pire, c’est que je ne sais même pas ce que j’ai fait de mal.${NB}»`,
    'Nous travaillons sur les causes racines de son mal-être, son besoin de reconnaissance et de sécurité, puis sur quelques clés de communication pour oser aborder le sujet avec son manager.',
    'Elle finit par lui demander un entretien.',
    'Et là, surprise.',
    'Son manager lui explique qu’il traverse une période personnelle difficile et qu’il pensait justement lui témoigner sa confiance en la laissant travailler en autonomie.',
    `«${NB}Je croyais qu’il voulait se débarrasser de moi. Lui pensait me donner de l’espace. On vivait deux histoires complètement différentes${NB}!${NB}»`,
    `Quelques semaines plus tard, Clara m’écrit${NB}:`,
    `«${NB}J’ai retrouvé le plaisir de venir travailler. Et surtout, j’ai arrêté d’essayer de deviner ce que les autres pensent de moi.${NB}»`,
    'Cette histoire me touche particulièrement. Parce qu’on parle beaucoup de communication au travail, mais finalement assez peu de tout ce qu’on imagine quand elle disparaît.',
    'Le silence laisse rarement un vide. Notre cerveau s’empresse de le remplir, souvent avec nos propres peurs.',
    'Et parfois, une conversation courageuse évite une démission que personne ne souhaitait.',
  ];

  const DESCRIPTIONS_VIDES = { instagram: { fr: '', en: '' }, linkedin: { fr: '', en: '' } };

  // Article d'exemple : ton carrousel « Clara », créé à la première ouverture.
  const EXEMPLE = {
    id: 'exemple-clara', titre: 'Le silence au travail', statut: 'Brouillon', reseau: 'instagram', format: 'carre', fond: 'bleu',
    modifie: '2026-10-11T12:00:00.000Z', texte: P, descriptions: DESCRIPTIONS_VIDES,
    slides: [
      { role: 'Couverture', gabarit: 'V1', blocs: [{ style: 'titre', texte: 'Je crois que\nje vais\ndémissionner.' }, { style: 'contrepoint', texte: 'Pourtant,\nj’adore mon\ntravail.' }] },
      { role: 'Contexte', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[1] }, { style: 'corps', texte: P[2] }, { style: 'corps', texte: P[3] }, { style: 'citation', texte: P[4] }] },
      { role: 'Bascule', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[5] }, { style: 'corps', texte: P[6] }, { style: 'emphase', texte: P[7] }] },
      { role: 'Révélation', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[8] }, { style: 'citation', texte: P[9] }] },
      { role: 'Enseignement', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[10] }, { style: 'citation', texte: P[11] }, { style: 'corps', texte: P[12] }, { style: 'emphase', texte: P[13] }] },
      { role: 'Conclusion', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[14] }], signature: true },
    ],
  };

  const REGLAGES_DEFAUT = {
    automatisation: 'hybride', rythme: 'equilibre', motsMax: 90, depassement: 'demander', intensite: 'minimale',
    numero: false, glisser: false, logoPartout: false, longueurDescription: 'moyenne',
    reseauDefaut: 'instagram', formatDefaut: 'carre', resolution: '2', pdfTexte: 'traces', ia: 'aucun',
  };

  const PROJET_DEFAUT = {
    version: 1, nom: 'Oh ! Potentiel', charte: M.CHARTE_DEFAUT, reglages: REGLAGES_DEFAUT, ordre: [EXEMPLE.id], ressources: {},
  };

  const ETAPES = [
    { id: 'texte', nom: 'Texte' },
    { id: 'composition', nom: 'Composition' },
    { id: 'description', nom: 'Description' },
    { id: 'export', nom: 'Export' },
  ];
  // Les alertes du moteur visent encore « structure » ou « design » : c'est désormais l'étape Composition.
  const etapeDe = (cible) => (cible === 'structure' || cible === 'design' ? 'composition' : cible);

  const AIDES = {
    bibliotheque: { titre: 'Tes articles', textes: ['Trois sections : En cours, Publiés (validés par toi) et Corbeille, d’où tu peux restaurer un article.', 'Le menu « … » d’une carte permet de dupliquer, d’utiliser un article comme modèle pour un nouveau texte, de le marquer comme publié ou de le mettre à la corbeille.', 'Trie et affiche tes articles comme tu veux, en grille ou en liste. « Annuler » et ⌘Z (Ctrl+Z) reviennent en arrière à tout moment.'] },
    configuration: { titre: 'La configuration', textes: ['Charte : tes couleurs et tes tailles de texte. Tout changement s’applique à tous tes carrousels.', 'Ressources : tes polices, ton logo et tes fleurs, importés une fois et retrouvés sur tous tes appareils.', 'Réglages : le comportement de l’outil. Synchronisation : la liaison avec ton dépôt GitHub privé.', 'IA : le fournisseur d’intelligence artificielle et sa clé. Comme la clé GitHub, elle reste sur l’appareil : à saisir une fois sur chacun.'] },
    texte: { titre: 'Étape 1 · Texte', textes: ['Ton texte est la référence du carrousel : chaque modification ici met les slides à jour, sans toucher à leur mise en page. Et un paragraphe modifié dans Design modifie aussi ce texte.', 'Avec une IA active (Configuration, onglet IA), « Relire avec Claude » propose des corrections sous forme de cartes : accepte, modifie ou refuse chacune ; rien n’est appliqué sans toi. Sans IA, la vérification LanguageTool surligne les fautes ; pour chacune, choisis la bonne correction ou ignore-la.', 'La typographie française se corrige toute seule quand tu tapes ou colles du texte, ici comme sur les slides : un message montre chaque correction, avec « Annuler ».', 'Les suggestions de style arriveront avec l’IA : tu sélectionneras un passage directement dans ton texte.'] },
    composition: { titre: 'Étape 2 · Composition', textes: ['Tes slides, les unes sous les autres, exactement comme elles seront exportées. Clique dans un paragraphe pour l’écrire à sa place ; sélectionne des mots pour les mettre en forme avec la petite barre qui apparaît.', 'Entrée crée un nouveau paragraphe, ⇧Entrée un retour à la ligne, ⌘↩ (Ctrl+↩) un saut de slide. ⌫ au début d’un paragraphe le réunit au précédent ; au début d’une slide, avec la slide précédente.', 'Les menus en haut regroupent tout le reste : gabarits, fond, logo, redécoupage, et Vérifier pour les points à regarder. Ton texte reste la référence : chaque modification ici le met à jour.'] },
    description: { titre: 'Étape 4 · Description', textes: ['Le texte qui accompagne le carrousel : légende Instagram et texte du post LinkedIn.', 'Pour l’instant tu l’écris toi-même ; l’IA pourra te proposer une version plus tard.'] },
    export: { titre: 'Étape 5 · Export', textes: ['Les fichiers à publier : des images PNG pour Instagram, un PDF pour LinkedIn, ou les deux.', 'S’il reste des alertes, l’outil te les rappelle avant d’exporter : à toi de décider.', 'Une fois publié sur le réseau, marque l’article comme publié : il rejoint la section Publiés.'] },
  };

  /* ================================================================== */
  /* 2. État                                                             */
  /* ================================================================== */

  const ETAT_INITIAL = {
    pret: false, ecran: 'bibliotheque', articleId: null, etape: 'texte', slide: 0, onglet: 'charte',
    feuille: null, aide: false, message: null, edition: false,
    articles: [], projet: PROJET_DEFAUT, apparence: 'auto',
    polices: { light: null, bold: null, lightItalic: null, boldItalic: null }, images: { logo: null, logoClair: null, fleurs: null },
    bibliotheque: { section: 'encours', tri: 'ordre', vue: 'grille' },
    synchro: { statut: 'non-configure', detail: '', derniere: null, attente: 0, conflits: [] },
    historique: { passe: [], futur: [], groupe: null, quand: 0 },
  };

  const HISTORIQUE_MAX = 80;

  // Enregistre l'état des articles avant une modification, pour pouvoir l'annuler.
  // Les frappes successives dans un même champ sont regroupées en une seule étape.
  function avecHistorique(etat, nouveauxArticles, groupe) {
    const h0 = etat.historique;
    const t = Date.now();
    const regrouper = groupe && h0.groupe === groupe && t - h0.quand < 1500;
    const passe = regrouper ? h0.passe : [...h0.passe, etat.articles].slice(-HISTORIQUE_MAX);
    return { ...etat, articles: nouveauxArticles, historique: { passe, futur: [], groupe: groupe || null, quand: t } };
  }

  function normaliserProjet(p) {
    const projet = p || {};
    return {
      ...PROJET_DEFAUT, ...projet,
      charte: { ...M.CHARTE_DEFAUT, ...(projet.charte || {}), palette: { ...M.CHARTE_DEFAUT.palette, ...((projet.charte || {}).palette || {}) } },
      reglages: { ...REGLAGES_DEFAUT, ...(projet.reglages || {}) },
    };
  }

  const trierSelonOrdre = (articles, ordre) => [...articles].sort((a, b) => {
    const ia = ordre.indexOf(a.id); const ib = ordre.indexOf(b.id);
    if (ia === -1 && ib === -1) return String(b.modifie).localeCompare(String(a.modifie));
    if (ia === -1) return -1;
    if (ib === -1) return 1;
    return ia - ib;
  });

  function reducteur(etat, action) {
    switch (action.type) {
      case 'charger': {
        const projet = normaliserProjet(action.projet);
        const articles = trierSelonOrdre(action.articles.map(L.lierArticle), projet.ordre || []);
        const ouvert = articles.some((a) => a.id === etat.articleId);
        return { ...etat, pret: true, articles, projet, ...(ouvert ? {} : { ecran: etat.ecran === 'atelier' ? 'bibliotheque' : etat.ecran, articleId: null }) };
      }
      case 'ecran': return { ...etat, ecran: action.ecran, feuille: null, message: null, aide: false, edition: false, ...(action.onglet ? { onglet: action.onglet } : {}) };
      case 'ouvrir': return { ...etat, ecran: 'atelier', articleId: action.id, etape: 'texte', slide: 0, message: null, aide: false };
      case 'etape': return { ...etat, etape: etapeDe(action.etape), message: null };
      case 'aller': return { ...etat, etape: etapeDe(action.etape), slide: action.slide == null ? etat.slide : action.slide, message: null };
      case 'slide': return { ...etat, slide: action.index };
      case 'onglet': return { ...etat, onglet: action.onglet };
      case 'feuille': return { ...etat, feuille: action.feuille };
      case 'aide': return { ...etat, aide: action.ouverte == null ? !etat.aide : action.ouverte };
      case 'message': return { ...etat, message: action.message };
      case 'edition': return { ...etat, edition: !etat.edition };
      case 'apparence': return { ...etat, apparence: action.valeur };
      case 'polices': return { ...etat, polices: { ...etat.polices, ...action.polices } };
      case 'images': return { ...etat, images: { ...etat.images, ...action.images } };
      case 'synchro': return { ...etat, synchro: { ...etat.synchro, ...action.synchro } };
      case 'projet': return { ...etat, projet: action.maj(etat.projet) };
      case 'reglage': return { ...etat, projet: { ...etat.projet, reglages: { ...etat.projet.reglages, [action.cle]: action.valeur } } };
      case 'article': {
        const articles = etat.articles.map((a) => (a.id === action.id ? { ...action.maj(a), modifie: maintenant() } : a));
        const e = avecHistorique(etat, articles, action.groupe);
        return action.annonce ? { ...e, message: { texte: action.annonce, annulable: true } } : e;
      }
      case 'bibliotheque': return { ...etat, bibliotheque: { ...etat.bibliotheque, [action.champ]: action.valeur }, edition: action.champ === 'tri' ? false : etat.edition };
      case 'corbeille': {
        const articles = etat.articles.map((a) => (a.id === action.id ? { ...a, corbeille: maintenant() } : a));
        return { ...avecHistorique(etat, articles), message: { texte: 'Article mis à la corbeille.', annulable: true } };
      }
      case 'restaurer': {
        const articles = etat.articles.map((a) => (a.id === action.id ? { ...a, corbeille: null } : a));
        return { ...avecHistorique(etat, articles), message: { texte: 'Article restauré.', annulable: true } };
      }
      case 'viderCorbeille': {
        const articles = etat.articles.filter((a) => !a.corbeille);
        const e = avecHistorique(etat, articles);
        return { ...e, feuille: null, message: { texte: 'Corbeille vidée. GitHub garde une copie de chaque article dans son historique.', annulable: true }, projet: { ...e.projet, ordre: articles.map((a) => a.id) } };
      }
      case 'statut': {
        const articles = etat.articles.map((a) => (a.id === action.id ? { ...a, statut: action.statut, publie: action.statut === 'Publié' ? maintenant() : null } : a));
        return { ...avecHistorique(etat, articles), message: { texte: action.statut === 'Publié' ? 'Article marqué comme publié : il est rangé dans la section Publiés.' : 'Article remis en cours.', annulable: true } };
      }
      case 'creer': {
        const e = avecHistorique(etat, [action.article, ...etat.articles]);
        return { ...e, projet: { ...e.projet, ordre: [action.article.id, ...(e.projet.ordre || [])] }, ecran: 'atelier', articleId: action.article.id, etape: 'composition', slide: 0, feuille: null };
      }
      case 'dupliquer': {
        const source = etat.articles.find((a) => a.id === action.id);
        const copie = { ...source, id: nouvelId(), titre: source.titre + ' (copie)', statut: 'Brouillon', modifie: maintenant() };
        const articles = [...etat.articles];
        articles.splice(etat.articles.indexOf(source) + 1, 0, copie);
        const e = avecHistorique(etat, articles);
        return { ...e, projet: { ...e.projet, ordre: articles.map((a) => a.id) } };
      }
      case 'supprimerArticle': {
        const articles = etat.articles.filter((a) => a.id !== action.id);
        const e = avecHistorique(etat, articles);
        return { ...e, feuille: null, message: { texte: 'Article supprimé définitivement.', annulable: true }, projet: { ...e.projet, ordre: articles.map((a) => a.id) } };
      }
      case 'deplacerArticle': {
        const i = etat.articles.findIndex((a) => a.id === action.id);
        const j = i + action.delta;
        if (i < 0 || j < 0 || j >= etat.articles.length) return etat;
        const articles = [...etat.articles];
        [articles[i], articles[j]] = [articles[j], articles[i]];
        const e = avecHistorique(etat, articles);
        return { ...e, projet: { ...e.projet, ordre: articles.map((a) => a.id) } };
      }
      case 'annuler': {
        const { passe, futur } = etat.historique;
        if (!passe.length) return etat;
        const articles = passe[passe.length - 1];
        return { ...etat, articles, projet: { ...etat.projet, ordre: articles.map((a) => a.id) }, historique: { passe: passe.slice(0, -1), futur: [etat.articles, ...futur], groupe: null, quand: 0 } };
      }
      case 'retablir': {
        const { passe, futur } = etat.historique;
        if (!futur.length) return etat;
        const articles = futur[0];
        return { ...etat, articles, projet: { ...etat.projet, ordre: articles.map((a) => a.id) }, historique: { passe: [...passe, etat.articles], futur: futur.slice(1), groupe: null, quand: 0 } };
      }
      default: return etat;
    }
  }

  const majSlide = (i, maj) => (a) => ({ ...a, slides: a.slides.map((s, k) => (k === i ? maj(s) : s)) });

  const OP = {
    deplacerSlide: (i, delta) => (a) => {
      const j = i + delta;
      if (j < 0 || j >= a.slides.length) return a;
      const slides = [...a.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...a, slides };
    },
    fusionnerAvecSuivante: (i) => (a) => {
      if (i >= a.slides.length - 1) return a;
      const fusion = { ...a.slides[i], blocs: [...a.slides[i].blocs, ...a.slides[i + 1].blocs], signature: a.slides[i].signature || a.slides[i + 1].signature };
      return { ...a, slides: [...a.slides.slice(0, i), fusion, ...a.slides.slice(i + 2)] };
    },
    scinder: (i, b) => (a) => {
      const s = a.slides[i];
      if (b <= 0 || b >= s.blocs.length) return a;
      const premiere = { ...s, blocs: s.blocs.slice(0, b), signature: false };
      const seconde = { role: 'Texte', gabarit: 'T1', blocs: s.blocs.slice(b), signature: s.signature };
      return { ...a, slides: [...a.slides.slice(0, i), premiere, seconde, ...a.slides.slice(i + 1)] };
    },
    ajouterSlide: (i) => (a) => ({ ...a, slides: [...a.slides.slice(0, i + 1), { role: 'Texte', gabarit: 'T1', blocs: [{ style: 'corps', texte: '' }] }, ...a.slides.slice(i + 1)] }),
    supprimerSlide: (i) => (a) => {
      if (a.slides.length <= 1) return a;
      const slides = a.slides.filter((_, k) => k !== i);
      if (a.slides[i].signature) slides[slides.length - 1] = { ...slides[slides.length - 1], signature: true };
      return { ...a, slides };
    },
    // Choisir un gabarit rend la mise en page automatique à la slide (fin de la mise en page libre).
    gabarit: (i, gabarit) => majSlide(i, (s) => ({ ...M.revenirAuGabarit(s), gabarit })),
    slide: (i, slide) => (a) => ({ ...a, slides: a.slides.map((s, k) => (k === i ? slide : s)) }),
    supprimerBlocs: (i, indices) => (a) => L.supprimerBlocs(a, i, indices),
    dupliquerBlocs: (i, indices) => (a) => [...indices].sort((p, q) => q - p).reduce((x, n) => L.dupliquerBloc(x, i, n), a),
    fusionnerPlusieurs: (i, ordre) => (a) => L.fusionnerPlusieurs(a, i, ordre),
    // Envoyer des blocs sur une autre slide, posés à l'endroit visé ; une slide d'origine vidée est retirée.
    envoyerSurSlide: (i, indices, j, positions, baseI, baseJ) => (a) => {
      const deplaces = indices.map((n, q) => ({ ...a.slides[i].blocs[n], fige: baseI.blocs[n] && baseI.blocs[n].fige, pos: positions[q] }));
      let slides = a.slides.map((s, k) => {
        if (k === i) return { ...s, blocs: s.blocs.filter((_, m) => !indices.includes(m)) };
        if (k === j) return { ...baseJ, libre: true, blocs: [...baseJ.blocs, ...deplaces] };
        return s;
      });
      if (!slides[i].blocs.length && slides.length > 1) {
        const signee = slides[i].signature;
        slides = slides.filter((_, k) => k !== i);
        if (signee) slides[slides.length - 1] = { ...slides[slides.length - 1], signature: true };
      }
      return { ...a, slides };
    },
    modifierBloc: (i, b, champs) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.map((bloc, n) => {
      if (n !== b) return bloc;
      if (champs.texte === undefined) return { ...bloc, ...champs };
      return L.avecMarques({ ...bloc, ...champs }, L.remapperMarques(bloc.texte, champs.texte, bloc.marques));
    }) })),
    // Mise en forme d'un passage (gras, italique, souligné, taille) ; null retire l'attribut.
    formater: (i, b, debut, fin, changement) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.map((bloc, n) => (n !== b ? bloc : L.avecMarques(bloc, L.appliquerForme(bloc.marques, bloc.texte.length, debut, fin, changement)))) })),
    // Réglages du paragraphe entier (alignement, filet) ; null revient au réglage du gabarit.
    paragraphe: (i, b, champs) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.map((bloc, n) => {
      if (n !== b) return bloc;
      const copie = { ...bloc };
      for (const [cle, valeur] of Object.entries(champs)) { if (valeur === null) delete copie[cle]; else copie[cle] = valeur; }
      return copie;
    }) })),
    ajouterBloc: (i) => majSlide(i, (s) => ({ ...s, blocs: [...s.blocs, { style: 'corps', texte: '' }] })),
    supprimerBloc: (i, b) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.filter((_, n) => n !== b) })),
    deplacerBloc: (i, b, delta) => majSlide(i, (s) => {
      const j = b + delta;
      if (j < 0 || j >= s.blocs.length) return s;
      const blocs = [...s.blocs];
      [blocs[b], blocs[j]] = [blocs[j], blocs[b]];
      return { ...s, blocs };
    }),
    // Envoie un paragraphe à la fin de la slide précédente, ou au début de la suivante.
    blocVersSlide: (i, b, sens) => (a) => {
      const j = i + sens;
      if (j < 0 || j >= a.slides.length) return a;
      const bloc = a.slides[i].blocs[b];
      const slides = a.slides.map((s, k) => {
        if (k === i) return { ...s, blocs: s.blocs.filter((_, n) => n !== b) };
        if (k === j) return { ...s, blocs: sens < 0 ? [...s.blocs, bloc] : [bloc, ...s.blocs] };
        return s;
      });
      return { ...a, slides };
    },
    champ: (cle, valeur) => (a) => ({ ...a, [cle]: valeur }),
    echelle: (i, echelle) => majSlide(i, (s) => ({ ...s, echelle })),
    validerAlerte: (cle) => (a) => ({ ...a, alertesValidees: [...new Set([...(a.alertesValidees || []), cle])] }),
    reafficherAlertes: () => (a) => ({ ...a, alertesValidees: [] }),
    texte: (paragraphes) => (a) => ({ ...a, texte: paragraphes }),
    source: (valeur) => (a) => L.appliquerEditionSource(a, valeur),
    blocLie: (i, n, texte) => (a) => L.modifierBlocLie(a, i, n, texte),
    couper: (i, n, position) => (a) => L.couperSlide(a, i, n, position),
    retirerCoupure: (i) => (a) => L.retirerCoupure(a, i),
    redecouper: (slides) => (a) => L.lierArticle({ ...a, slides }),
    scinderBloc: (i, n, position) => (a) => L.scinderBloc(a, i, n, position),
    fusionnerBlocs: (i, n) => (a) => { const r = L.fusionnerBlocs(a, i, n); return r ? r.article : a; },
    insererParagraphe: (i, n, texte) => (a) => L.insererParagrapheApres(a, i, n, texte),
    // Une slide dupliquée sert de modèle : ses paragraphes deviennent indépendants du texte de l'article.
    dupliquerSlide: (i) => (a) => {
      const copie = { ...a.slides[i], signature: false, blocs: a.slides[i].blocs.map((b) => { const c = { ...b }; delete c.lien; return c; }) };
      return { ...a, slides: [...a.slides.slice(0, i + 1), copie, ...a.slides.slice(i + 1)] };
    },
    remplacerTexte: (texte, slides) => (a) => L.lierArticle({ ...a, texte, slides, alertesValidees: [] }),
    presentation: ({ fond, slides }) => (a) => ({ ...a, fond, slides }),
    description: (reseau, texte) => (a) => ({ ...a, descriptions: { ...a.descriptions, [reseau]: { ...(a.descriptions || DESCRIPTIONS_VIDES)[reseau], fr: texte } } }),
  };

  /* ================================================================== */
  /* 3. Lisibilité des couleurs                                          */
  /* ================================================================== */

  function luminance(hex) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contraste(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  }
  function verifierLisibilite(palette) {
    const fonds = M.construireFonds({ ...M.PALETTE, ...palette });
    const lignes = [];
    for (const [cle, f] of Object.entries(fonds)) {
      lignes.push({ fond: f.nom, element: 'Texte', ratio: contraste(f.texte, f.fond) });
      if (f.accent !== f.texte) lignes.push({ fond: f.nom, element: 'Mise en valeur', ratio: contraste(f.accent, f.fond) });
      lignes.push({ fond: f.nom, element: 'Bandeau', ratio: contraste(f.bande.texte, f.bande.fond) });
      lignes.push({ fond: f.nom, element: 'Encadré', ratio: contraste(f.carte.texte, f.carte.fond) });
      lignes.push({ fond: f.nom, element: 'Surligneur', ratio: contraste(f.surligne.texte, f.surligne.fond) });
      void cle;
    }
    return lignes;
  }

  /* ================================================================== */
  /* 4. Composants de base                                               */
  /* ================================================================== */

  const Contexte = createContext({ choisirPolice: null, version: 0, images: {}, reglages: REGLAGES_DEFAUT, charte: M.CHARTE_DEFAUT });

  // Rôles : light, bold, lightItalic, boldItalic. Sans fichier italique, les lettres de la police droite sont penchées.
  function fabriquerChoix(polices) {
    const cache = {};
    return (role) => {
      if (cache[role]) return cache[role];
      const italique = /Italic$/.test(role);
      const droite = role.replace('Italic', '');
      if (polices[role]) cache[role] = M.policeExacte(polices[role]);
      else if (italique && polices[droite]) cache[role] = M.policeExacte(polices[droite], { inclinaison: 0.2 });
      else cache[role] = M.policeSysteme(droite === 'bold' ? 700 : 300, italique);
      return cache[role];
    };
  }

  const TRACES = {
    retour: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', gauche: 'M14 6l-6 6 6 6', droite: 'M10 6l6 6-6 6', haut: 'M6 14l6-6 6 6', bas: 'M6 10l6 6 6-6',
    reglages: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    soleil: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    lune: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z', auto: 'M12 3a9 9 0 100 18V3z M12 3a9 9 0 010 18',
    baguette: 'M4 20l10-10M14 4v3M18.5 5.5l-2 2M20 10h-3M12 7l5 5', poubelle: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    oeil: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    annuler: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', retablir: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
    nuage: 'M7 18h10a4 4 0 00.5-7.97A6 6 0 006.1 9.2 4.5 4.5 0 007 18z', ciseaux: 'M6 6a2 2 0 100 4 2 2 0 000-4zM6 14a2 2 0 100 4 2 2 0 000-4zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
    fusion: 'M8 4v6a4 4 0 004 4h0a4 4 0 014 4v2M16 4v6a4 4 0 01-4 4',
    engrenage: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    points: 'M5 12h.01M12 12h.01M19 12h.01', grille: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', liste: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    coche: 'M5 12l5 5L20 7', partager: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6', telecharger: 'M12 3v12M8 11l4 4 4-4M5 19h14',
    restaurer: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5', modele: 'M8 8h12v12H8zM16 8V4H4v12h4',
  };
  const Icone = ({ nom, taille = 20 }) => h('svg', { className: 'icone', width: taille, height: taille, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('path', { d: TRACES[nom], fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  function Bouton({ variante = 'secondaire', onClick, disabled, children, titre, etiquette }) {
    return h('button', { className: 'bouton ' + variante, onClick, disabled, title: titre, 'aria-label': etiquette, type: 'button' }, children);
  }

  function Segmente({ options, valeur, onChange, etiquette, petit }) {
    return h('div', { className: cls('segmente', petit && 'petit'), role: 'group', 'aria-label': etiquette },
      options.map((o) => h('button', {
        key: o.valeur, type: 'button', 'aria-pressed': o.valeur === valeur, 'aria-label': o.etiquette, title: o.etiquette, onClick: () => onChange(o.valeur),
      }, o.icone ? h(Icone, { nom: o.icone, taille: 18 }) : o.libelle)));
  }

  const Pastille = ({ ton = 'neutre', children }) => h('span', { className: 'pastille ' + ton }, children);

  function Info({ texte }) {
    const [position, setPosition] = useState(null);
    const bouton = useRef(null);
    const ouvrir = () => {
      const r = bouton.current && bouton.current.getBoundingClientRect();
      if (!r) return;
      const largeur = 280;
      const gauche = Math.max(12, Math.min(r.left + r.width / 2 - largeur / 2, racine.innerWidth - largeur - 12));
      const enBas = r.bottom + 160 < racine.innerHeight;
      setPosition({ left: gauche, top: enBas ? r.bottom + 8 : undefined, bottom: enBas ? undefined : racine.innerHeight - r.top + 8, width: largeur });
    };
    const fermer = () => setPosition(null);
    return h('span', { className: 'info', onMouseEnter: ouvrir, onMouseLeave: fermer },
      h('button', { type: 'button', ref: bouton, className: 'info-bouton', 'aria-label': 'Explication', 'aria-expanded': !!position, onClick: () => (position ? fermer() : ouvrir()), onBlur: fermer }, 'i'),
      position && h('span', { className: 'bulle-fixe', role: 'tooltip', style: position }, texte));
  }

  function Carte({ titre, sousTitre, info, children, actions, classe }) {
    return h('section', { className: 'carte ' + (classe || '') },
      (titre || actions) && h('div', { className: 'carte-tete' },
        h('div', null, titre && h('h3', { className: 'gill' }, titre, info && h(Info, { texte: info })), sousTitre && h('p', { className: 'doux' }, sousTitre)),
        actions && h('div', { className: 'carte-actions' }, actions)),
      children);
  }

  function Ligne({ etiquette, aide, info, children }) {
    return h('div', { className: 'ligne-reglage' },
      h('div', { className: 'ligne-texte' }, h('div', { className: 'ligne-etiquette' }, etiquette, info && h(Info, { texte: info })), aide && h('div', { className: 'doux petit' }, aide)),
      h('div', { className: 'ligne-controle' }, children));
  }

  function SlideCanvas({ slide, formatId, fondId, largeur, index = 0, total = 1, onClick, selectionnee, etiquette, logo = 'auto', compo, masquer, onPointer }) {
    const ref = useRef(null);
    const { choisirPolice, version, images, reglages, charte } = useContext(Contexte);
    const fmt = M.FORMATS[formatId];
    const hauteur = Math.round((largeur * fmt.h) / fmt.l);
    useEffect(() => {
      const canvas = ref.current;
      if (!canvas || !choisirPolice) return;
      const ratio = Math.min(racine.devicePixelRatio || 1, 2);
      canvas.width = Math.round(largeur * ratio);
      canvas.height = Math.round(hauteur * ratio);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / fmt.l, 0, 0, canvas.height / fmt.h, 0, 0);
      M.dessiner(ctx, compo || M.composer(slide, formatId, fondId, choisirPolice, { index, total, reglages, charte, logo }), images, { masquer });
    }, [slide, formatId, fondId, largeur, hauteur, version, choisirPolice, images, reglages, charte, index, total, logo, compo, masquer]);
    const proprietes = { ref, className: cls('slide', selectionnee && 'selectionnee', onPointer && 'editable'), style: { width: largeur + 'px', height: hauteur + 'px' } };
    if (onPointer) {
      proprietes.onClick = (e) => { const r = e.currentTarget.getBoundingClientRect(); onPointer(((e.clientX - r.left) * fmt.l) / r.width, ((e.clientY - r.top) * fmt.h) / r.height, e); };
      proprietes['aria-label'] = etiquette;
      proprietes.role = 'img';
      return h('canvas', proprietes);
    }
    if (onClick) return h('button', { type: 'button', className: 'slide-bouton', onClick, 'aria-label': etiquette }, h('canvas', proprietes));
    return h('canvas', { ...proprietes, role: 'img', 'aria-label': etiquette || 'Slide' });
  }

  function useLargeur(defaut) {
    const ref = useRef(null);
    const [largeur, setLargeur] = useState(defaut);
    useEffect(() => {
      if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
      const observateur = new ResizeObserver(([entree]) => setLargeur(Math.floor(entree.contentRect.width)));
      observateur.observe(ref.current);
      return () => observateur.disconnect();
    }, []);
    return [ref, largeur];
  }

  const LIBELLES_SYNCHRO = {
    'non-configure': ['Non synchronisé', 'neutre'], 'en-cours': ['Synchronisation…', 'info'], 'a-jour': ['À jour', 'ok'],
    'hors-ligne': ['Hors ligne', 'attention'], erreur: ['Erreur de synchronisation', 'erreur'], conflit: ['Conflit résolu', 'attention'],
  };

  function Barre({ etat, dispatch, gauche, titre }) {
    const [libelle, ton] = LIBELLES_SYNCHRO[etat.synchro.statut] || LIBELLES_SYNCHRO['non-configure'];
    const h0 = etat.historique;
    return h('header', { className: 'barre' },
      h('div', { className: 'barre-gauche' }, gauche,
        h('div', { className: 'historique', role: 'group', 'aria-label': 'Historique' },
          h(Bouton, { variante: 'petit', titre: 'Annuler (⌘Z ou Ctrl+Z)', disabled: !h0.passe.length, onClick: () => dispatch({ type: 'annuler' }) }, h(Icone, { nom: 'annuler', taille: 18 }), 'Annuler'),
          h(Bouton, { variante: 'petit', titre: 'Rétablir (⇧⌘Z ou Ctrl+Y)', disabled: !h0.futur.length, onClick: () => dispatch({ type: 'retablir' }) }, h(Icone, { nom: 'retablir', taille: 18 }), 'Rétablir'))),
      h('div', { className: 'barre-titre gill' }, titre),
      h('div', { className: 'barre-droite' },
        h('button', { type: 'button', className: 'etat-synchro ' + ton, title: etat.synchro.detail || libelle, onClick: () => dispatch({ type: 'ecran', ecran: 'configuration', onglet: 'synchro' }) },
          h(Icone, { nom: 'nuage', taille: 18 }), h('span', null, libelle + (etat.synchro.attente ? ` · ${etat.synchro.attente} en attente` : ''))),
        h(Segmente, {
          etiquette: 'Apparence', petit: true, valeur: etat.apparence, onChange: (v) => dispatch({ type: 'apparence', valeur: v }),
          options: [{ valeur: 'clair', icone: 'soleil', etiquette: 'Mode clair' }, { valeur: 'sombre', icone: 'lune', etiquette: 'Mode sombre' }, { valeur: 'auto', icone: 'auto', etiquette: 'Automatique, comme l’appareil' }],
        }),
        h('button', { type: 'button', className: cls('bouton-aide', etat.aide && 'actif'), 'aria-label': 'Aide sur cet écran', 'aria-expanded': etat.aide, onClick: () => dispatch({ type: 'aide' }) }, 'i')));
  }

  function PanneauAide({ cle, dispatch }) {
    const aide = AIDES[cle];
    if (!aide) return null;
    return h('div', { className: 'panneau-aide', role: 'dialog', 'aria-label': aide.titre },
      h('h3', { className: 'gill' }, aide.titre), aide.textes.map((t, i) => h('p', { key: i }, t)),
      h(Bouton, { onClick: () => dispatch({ type: 'aide', ouverte: false }) }, 'Compris'));
  }

  function Message({ etat, dispatch }) {
    const arme = useRef(false);
    // Le message flotte en bas de l'écran et s'efface tout seul après quelques secondes.
    useEffect(() => {
      arme.current = false;
      if (!etat.message) return undefined;
      const t = setTimeout(() => dispatch({ type: 'message', message: null }), 6000);
      return () => clearTimeout(t);
    }, [etat.message]);
    if (!etat.message) return null;
    const m = typeof etat.message === 'string' ? { texte: etat.message } : etat.message;
    // Le message peut apparaître sous le doigt juste après un toucher : son « clic fantôme » ne doit rien déclencher.
    // Un bouton n'agit que s'il a été pressé lui-même (ou activé au clavier).
    const voulu = (e) => e.detail === 0 || arme.current;
    return h('div', { className: 'message', role: 'status' }, h('span', null, m.texte),
      h('span', { className: 'actions-ligne' },
        // « annulation » : une action précise à défaire (une correction typographique, même si l'on a continué d'écrire) ;
        // « annulable » : la dernière étape de l'historique.
        (m.annulable || m.annulation) && h('button', { type: 'button', className: 'lien fort', onPointerDown: () => { arme.current = true; }, onClick: (e) => { if (!voulu(e)) return; arme.current = false; dispatch(m.annulation || { type: 'annuler' }); dispatch({ type: 'message', message: null }); } }, 'Annuler'),
        h('button', { type: 'button', className: 'lien', onPointerDown: () => { arme.current = true; }, onClick: (e) => { if (!voulu(e)) return; arme.current = false; dispatch({ type: 'message', message: null }); } }, 'Fermer')));
  }

  function Feuille({ titre, onAnnuler, action, children }) {
    return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
      h('div', { className: 'feuille' },
        h('div', { className: 'feuille-tete' }, h(Bouton, { onClick: onAnnuler }, 'Annuler'), h('h2', { className: 'gill' }, titre), h('div', { className: 'feuille-action' }, action)),
        h('div', { className: 'feuille-corps' }, children)));
  }

  function SelecteurFond({ valeur, onChange }) {
    const { charte } = useContext(Contexte);
    const fonds = M.fondsDe(charte.palette);
    return h('div', { className: 'fonds', role: 'group', 'aria-label': 'Fond' },
      Object.entries(fonds).map(([cle, f]) => h('button', { key: cle, type: 'button', className: cls('fond-choix', valeur === cle && 'actif'), 'aria-pressed': valeur === cle, title: f.nom, onClick: () => onChange(cle) },
        h('span', { className: 'fond-echantillon', style: { background: f.fond } }), h('span', { className: 'fond-nom' }, f.nom))));
  }

  const dateCourte = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const ecart = Date.now() - d.getTime();
    if (ecart < 60000) return 'à l’instant';
    if (ecart < 3600000) return `il y a ${Math.round(ecart / 60000)} min`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  /* ================================================================== */
  /* 5. Bibliothèque                                                     */
  /* ================================================================== */

  const TON_STATUT = { Brouillon: 'neutre', Prêt: 'neutre', Exporté: 'info', Publié: 'ok' };
  const TRIS = [['ordre', 'Mon ordre'], ['modifie', 'Dernière modification'], ['titre', 'Titre'], ['statut', 'Statut'], ['reseau', 'Réseau']];
  const RANG_STATUT = { Brouillon: 0, Prêt: 0, Exporté: 1, Publié: 2 };

  function trierArticles(liste, tri) {
    if (tri === 'ordre') return liste;
    const comparer = {
      modifie: (a, b) => String(b.modifie).localeCompare(String(a.modifie)),
      titre: (a, b) => a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' }),
      statut: (a, b) => (RANG_STATUT[a.statut] || 0) - (RANG_STATUT[b.statut] || 0) || String(b.modifie).localeCompare(String(a.modifie)),
      reseau: (a, b) => a.reseau.localeCompare(b.reseau) || String(b.modifie).localeCompare(String(a.modifie)),
    }[tri];
    return [...liste].sort(comparer);
  }

  function MenuArticle({ article, dispatch, section }) {
    const [ouvert, setOuvert] = useState(false);
    const faire = (action) => () => { setOuvert(false); dispatch(action); };
    const elements = section === 'corbeille'
      ? [['restaurer', 'Restaurer', { type: 'restaurer', id: article.id }], ['poubelle', 'Supprimer définitivement', { type: 'feuille', feuille: { supprimer: article.id } }, 'danger']]
      : [
        ['modele', 'Dupliquer', { type: 'dupliquer', id: article.id }],
        ['plus', 'Utiliser comme modèle', { type: 'feuille', feuille: { nouvel: true, modele: article.id } }],
        article.statut === 'Publié' ? ['restaurer', 'Remettre en cours', { type: 'statut', id: article.id, statut: 'Exporté' }] : ['coche', 'Marquer comme publié', { type: 'statut', id: article.id, statut: 'Publié' }],
        ['poubelle', 'Mettre à la corbeille', { type: 'corbeille', id: article.id }, 'danger'],
      ];
    return h('span', { className: 'menu-article' },
      h(Bouton, { variante: 'icone', etiquette: 'Actions pour ' + article.titre, titre: 'Actions', onClick: () => setOuvert(!ouvert) }, h(Icone, { nom: 'points' })),
      ouvert && h(Fragment, null,
        h('span', { className: 'voile-menu', onClick: () => setOuvert(false) }),
        h('span', { className: 'menu', role: 'menu' }, elements.map(([icone, libelle, action, ton]) => h('button', { key: libelle, type: 'button', role: 'menuitem', className: cls('menu-element', ton), onClick: faire(action) }, h(Icone, { nom: icone, taille: 18 }), libelle)))));
  }

  function Bibliotheque({ etat, dispatch }) {
    const b = etat.bibliotheque;
    const sections = {
      encours: etat.articles.filter((a) => !a.corbeille && a.statut !== 'Publié'),
      publies: etat.articles.filter((a) => !a.corbeille && a.statut === 'Publié'),
      corbeille: etat.articles.filter((a) => a.corbeille),
    };
    const liste = trierArticles(sections[b.section] || [], b.tri);
    const reordonnable = b.tri === 'ordre' && b.section !== 'corbeille';
    const aSupprimer = etat.feuille && etat.feuille.supprimer ? etat.articles.find((a) => a.id === etat.feuille.supprimer) : null;
    const nouvel = etat.feuille === 'nouvel' || (etat.feuille && etat.feuille.nouvel);
    const regler = (champ) => (valeur) => dispatch({ type: 'bibliotheque', champ, valeur });
    const vignette = (a, largeur) => h('div', { className: 'vignette' }, a.slides[0] && h(SlideCanvas, { slide: a.slides[0], formatId: a.format, fondId: a.fond, largeur, total: a.slides.length, logo: a.logo, etiquette: 'Couverture de ' + a.titre }),
      a.statut === 'Publié' && h('span', { className: 'tampon-publie' }, h(Icone, { nom: 'coche', taille: 16 }), 'Publié'));
    const details = (a) => h(Fragment, null,
      h('span', { className: 'carte-article-titre gill' }, a.titre),
      h('span', { className: 'doux petit bloc' }, `${a.slides.length} slides · ${M.FORMATS[a.format].nom} · ${a.reseau === 'instagram' ? 'Instagram' : 'LinkedIn'}`),
      h('span', { className: 'carte-article-pied' }, h(Pastille, { ton: TON_STATUT[a.statut] }, a.statut === 'Publié' && a.publie ? 'Publié le ' + new Date(a.publie).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : a.statut === 'Prêt' ? 'Brouillon' : a.statut),
        h('span', { className: 'doux petit' }, b.section === 'corbeille' ? 'supprimé ' + dateCourte(a.corbeille) : dateCourte(a.modifie))));
    const outils = (a, i) => h('div', { className: 'barre-edition' },
      etat.edition && reordonnable && h(Fragment, null,
        h(Bouton, { variante: 'icone', etiquette: 'Avancer', disabled: i === 0, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: liste[i - 1] ? etat.articles.indexOf(liste[i - 1]) - etat.articles.indexOf(a) : 0 }) }, h(Icone, { nom: b.vue === 'liste' ? 'haut' : 'gauche' })),
        h(Bouton, { variante: 'icone', etiquette: 'Reculer', disabled: i === liste.length - 1, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: liste[i + 1] ? etat.articles.indexOf(liste[i + 1]) - etat.articles.indexOf(a) : 0 }) }, h(Icone, { nom: b.vue === 'liste' ? 'bas' : 'droite' }))),
      h(MenuArticle, { article: a, dispatch, section: b.section }));
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: '', gauche: h('span', { className: 'marque gill' }, 'PostsOP') }),
      etat.aide && h(PanneauAide, { cle: 'bibliotheque', dispatch }),
      h(Message, { etat, dispatch }),
      h('main', { className: 'contenu' },
        h('div', { className: 'tete-page' },
          h('h1', { className: 'gill' }, 'Articles'),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'icone', etiquette: 'Configuration', titre: 'Configuration', onClick: () => dispatch({ type: 'ecran', ecran: 'configuration' }) }, h(Icone, { nom: 'engrenage' })),
            h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'feuille', feuille: 'nouvel' }) }, h(Icone, { nom: 'plus' }), 'Nouvel article'))),
        h('div', { className: 'outils-bibliotheque' },
          h(Segmente, { etiquette: 'Section', valeur: b.section, onChange: regler('section'), options: [
            { valeur: 'encours', libelle: `En cours (${sections.encours.length})` },
            { valeur: 'publies', libelle: `Publiés (${sections.publies.length})` },
            { valeur: 'corbeille', libelle: `Corbeille (${sections.corbeille.length})` }] }),
          h('div', { className: 'actions-ligne' },
            h('label', { className: 'tri' }, h('span', { className: 'doux petit' }, 'Trier par'),
              h('select', { className: 'choix', value: b.tri, onChange: (e) => regler('tri')(e.target.value), 'aria-label': 'Trier par' }, TRIS.map(([v, l]) => h('option', { key: v, value: v }, l)))),
            h(Segmente, { etiquette: 'Présentation', petit: true, valeur: b.vue, onChange: regler('vue'), options: [{ valeur: 'grille', icone: 'grille', etiquette: 'En grille' }, { valeur: 'liste', icone: 'liste', etiquette: 'En liste' }] }),
            reordonnable && liste.length > 1 && h(Bouton, { variante: etat.edition ? 'principal' : 'secondaire', onClick: () => dispatch({ type: 'edition' }) }, etat.edition ? 'Terminé' : 'Réordonner'),
            b.section === 'corbeille' && liste.length > 0 && h(Bouton, { variante: 'danger', onClick: () => dispatch({ type: 'feuille', feuille: 'vider' }) }, 'Vider la corbeille'))),
        b.section === 'corbeille' && h('p', { className: 'note' }, 'Les articles de la corbeille ne s’affichent plus ailleurs. Restaure-les depuis leur menu « … ».'),
        !liste.length && h('div', { className: 'vide' }, h('p', { className: 'gill' }, { encours: 'Aucun article en cours.', publies: 'Aucun article publié pour l’instant.', corbeille: 'La corbeille est vide.' }[b.section]),
          b.section === 'encours' && h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'feuille', feuille: 'nouvel' }) }, h(Icone, { nom: 'plus' }), 'Créer un article')),
        b.vue === 'grille'
          ? h('div', { className: 'grille-articles' }, liste.map((a, i) => h('article', { key: a.id, className: cls('carte-article', a.statut === 'Publié' && 'publie', b.section === 'corbeille' && 'en-corbeille') },
            h('button', { type: 'button', className: 'carte-article-ouvrir', disabled: etat.edition || b.section === 'corbeille', onClick: () => dispatch({ type: 'ouvrir', id: a.id }), 'aria-label': 'Ouvrir ' + a.titre },
              vignette(a, 210), h('span', { className: 'carte-article-texte' }, details(a))),
            outils(a, i))))
          : h('ul', { className: 'liste-articles' }, liste.map((a, i) => h('li', { key: a.id, className: cls('ligne-article', a.statut === 'Publié' && 'publie', b.section === 'corbeille' && 'en-corbeille') },
            h('button', { type: 'button', className: 'ligne-article-ouvrir', disabled: etat.edition || b.section === 'corbeille', onClick: () => dispatch({ type: 'ouvrir', id: a.id }), 'aria-label': 'Ouvrir ' + a.titre },
              vignette(a, 64), h('span', { className: 'ligne-article-texte' }, details(a))),
            outils(a, i))))),
      nouvel && h(FeuilleNouvelArticle, { etat, dispatch }),
      aSupprimer && h(Feuille, {
        titre: 'Supprimer définitivement ?', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }),
        action: h(Bouton, { variante: 'danger plein', onClick: () => dispatch({ type: 'supprimerArticle', id: aSupprimer.id }) }, 'Supprimer'),
      }, h('p', null, `« ${aSupprimer.titre} » sera supprimé sur tous tes appareils. Tu pourras encore l’annuler juste après, et GitHub en garde une copie dans son historique.`)),
      etat.feuille === 'vider' && h(Feuille, {
        titre: 'Vider la corbeille ?', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }),
        action: h(Bouton, { variante: 'danger plein', onClick: () => dispatch({ type: 'viderCorbeille' }) }, 'Vider'),
      }, h('p', null, `${sections.corbeille.length} article(s) seront supprimés sur tous tes appareils. GitHub en garde une copie dans son historique.`)));
  }

  // Applique la mise en page d'un article modèle à de nouvelles slides : couverture, rythme des gabarits, fin.
  function appliquerModele(slides, modele) {
    const textes = modele.slides.slice(1).map((s, i) => M.gabaritParDefaut(s, i + 1)).filter((g) => g !== 'F1');
    const fin = M.gabaritParDefaut(modele.slides[modele.slides.length - 1], modele.slides.length - 1);
    return slides.map((s, i) => {
      if (i === 0) return { ...s, gabarit: M.gabaritParDefaut(modele.slides[0], 0) };
      if (i === slides.length - 1 && fin === 'F1') return { ...s, gabarit: 'F1' };
      return { ...s, gabarit: textes.length ? textes[(i - 1) % textes.length] : 'T1' };
    });
  }

  // Sélection juste avant une saisie (frappe ou collage) : avec le curseur juste après, elle dit exactement ce qui vient
  // d'être tapé ou collé, même quand on recolle un texte presque identique.
  function useAvantSaisie(zone) {
    const avant = useRef(null);
    useEffect(() => {
      const el = zone.current;
      if (!el) return undefined;
      const noter = () => { avant.current = { debut: el.selectionStart, fin: el.selectionEnd }; };
      el.addEventListener('beforeinput', noter);
      return () => el.removeEventListener('beforeinput', noter);
    }, []);
    return () => { const a = avant.current; avant.current = null; return a; };
  }

  // Zone de texte où l'on colle un article : la typographie française y est corrigée au collage et à la frappe,
  // et la dernière correction s'annonce juste dessous, avec « Annuler ».
  function ZoneTexteTypo({ valeur, onValeur, ...attributs }) {
    const zone = useRef(null);
    const curseur = useRef(null);
    const avantSaisie = useAvantSaisie(zone);
    const [note, setNote] = useState(null);
    useApresRendu(() => {
      if (curseur.current === null || !zone.current) return;
      zone.current.setSelectionRange(curseur.current, curseur.current);
      curseur.current = null;
    }, [valeur]);
    function changer(e) {
      const a = avantSaisie();
      const r = T.corrigerSaisie(valeur, e.target.value, { curseur: e.target.selectionEnd, zone: a ? [a.debut, e.target.selectionEnd] : null });
      if (r.remplacements.length) {
        curseur.current = r.curseur;
        setNote({ texte: T.resume(r.remplacements), base: r.texte, inverses: T.inverser(r.remplacements) });
      }
      onValeur(r.texte);
    }
    function annuler() {
      onValeur(T.appliquer(valeur, T.retablir(valeur, note.base, note.inverses)));
      setNote(null);
    }
    // Notes de travail (en-tête, question entre parenthèses, « Titre : … ») : signalées, retirées seulement si tu le décides.
    const notes = useMemo(() => T.notesDeTravail(valeur), [valeur]);
    const [gardees, setGardees] = useState([]);
    const [decochees, setDecochees] = useState([]);
    const [retrait, setRetrait] = useState(null);
    const visibles = notes.filter((n) => !gardees.includes(n.texte));
    const aRetirer = visibles.filter((n) => !decochees.includes(n.texte));
    const extrait = (t) => (t.length > 90 ? t.slice(0, 90).replace(/\s\S*$/, '') + '…' : t);
    function retirer() {
      setRetrait({ avant: valeur, nombre: aRetirer.length });
      setGardees(gardees.concat(visibles.filter((n) => decochees.includes(n.texte)).map((n) => n.texte)));
      onValeur(T.retirerLignes(valeur, aRetirer.map((n) => n.ligne)));
    }
    const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
    return h(Fragment, null,
      h('textarea', { ...attributs, ref: zone, value: valeur, onChange: changer }),
      note && h('p', { className: 'doux petit', role: 'status' }, 'Typographie corrigée : ' + note.texte + '. ',
        h('button', { type: 'button', className: 'lien fort', onClick: annuler }, 'Annuler')),
      visibles.length > 0 && h('div', { className: 'notes-travail', role: 'status' },
        h('p', null, h('strong', null, `${visibles.length} ${pluriel(visibles.length, 'ligne ressemble', 'lignes ressemblent')} à des notes de travail.`), ' Elles finiraient dans le carrousel. Décoche celles à garder.'),
        h('ul', null, visibles.map((n) => h('li', { key: n.ligne + n.texte },
          h('label', null,
            h('input', { type: 'checkbox', checked: !decochees.includes(n.texte), onChange: () => setDecochees(decochees.includes(n.texte) ? decochees.filter((x) => x !== n.texte) : decochees.concat([n.texte])) }),
            h('span', null, h('span', { className: 'notes-extrait' }, extrait(n.texte)), h('span', { className: 'petit' }, ' · ' + n.raison)))))),
        h('div', { className: 'actions-ligne' },
          h(Bouton, { variante: 'principal', disabled: aRetirer.length === 0, onClick: retirer }, aRetirer.length > 1 ? `Retirer les ${aRetirer.length} lignes cochées` : 'Retirer la ligne cochée'),
          h(Bouton, { variante: 'lien', onClick: () => setGardees(gardees.concat(visibles.map((n) => n.texte))) }, 'Tout garder'))),
      retrait && h('p', { className: 'doux petit', role: 'status' }, `${retrait.nombre} ${pluriel(retrait.nombre, 'ligne retirée', 'lignes retirées')}. `,
        h('button', { type: 'button', className: 'lien fort', onClick: () => { onValeur(retrait.avant); setRetrait(null); setGardees([]); } }, 'Annuler')));
  }

  function FeuilleNouvelArticle({ etat, dispatch }) {
    const r = etat.projet.reglages;
    const modele = etat.feuille && etat.feuille.modele ? etat.articles.find((a) => a.id === etat.feuille.modele) : null;
    const [texte, setTexte] = useState('');
    const [reseau, setReseau] = useState(modele ? modele.reseau : r.reseauDefaut);
    const [format, setFormat] = useState(modele ? modele.format : r.formatDefaut);
    const [fond, setFond] = useState(modele ? modele.fond : 'bleu');
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const paragraphes = texte.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    function creer() {
      const premier = paragraphes[0] || 'Nouvel article';
      let slides = M.decouperMecaniquement(paragraphes, format, fond, choisirPolice, { charte, reglages });
      if (modele) slides = appliquerModele(slides, modele);
      dispatch({
        type: 'creer',
        article: L.lierArticle({ id: nouvelId(), titre: premier.length > 48 ? premier.slice(0, 48) + '…' : premier, statut: 'Brouillon', reseau, format, fond, logo: modele ? modele.logo || 'auto' : 'auto', modifie: maintenant(), texte: paragraphes, slides, descriptions: DESCRIPTIONS_VIDES }),
      });
    }
    return h(Feuille, { titre: modele ? 'Nouvel article d’après un modèle' : 'Nouvel article', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }), action: h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: creer }, 'Créer') },
      modele && h('p', { className: 'note' }, `Mise en page reprise de « ${modele.titre} » : fond, format, réseau, gabarits et logo. Colle ton nouveau texte.`),
      h('label', { className: 'etiquette', htmlFor: 'texte-nouvel' }, 'Texte de l’article'),
      h(ZoneTexteTypo, { id: 'texte-nouvel', className: 'zone-texte', rows: 9, valeur: texte, onValeur: setTexte, placeholder: 'Colle ici le texte de ton article Word.' }),
      h('p', { className: 'doux petit' }, paragraphes.length ? `${paragraphes.length} paragraphe(s) · ${M.compterMots(texte)} mots. Le découpage en slides se fera sans IA, paragraphe par paragraphe.` : 'Colle le texte de ton article : la typographie française est corrigée au passage.'),
      h(Ligne, { etiquette: 'Réseau', aide: 'Fixe le format d’export : images pour Instagram, PDF pour LinkedIn.' }, h(Segmente, { valeur: reseau, onChange: setReseau, options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
      h(Ligne, { etiquette: 'Format', aide: '1:1 comme tes carrousels actuels, 4:5 pour plus de place.' }, h(Segmente, { valeur: format, onChange: setFormat, options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
      h(Ligne, { etiquette: 'Fond', aide: 'Il pourra changer ensuite.' }, h(SelecteurFond, { valeur: fond, onChange: setFond })));
  }

  /* ================================================================== */
  /* 6. Atelier                                                          */
  /* ================================================================== */

  function Atelier({ etat, dispatch }) {
    const article = etat.articles.find((a) => a.id === etat.articleId);
    if (!article) return h(Bibliotheque, { etat, dispatch });
    const majA = (maj, groupe, annonce) => dispatch({ type: 'article', id: article.id, maj, groupe, annonce });
    const vues = { texte: EtapeTexte, composition: EtapeComposition, description: EtapeDescription, export: EtapeExport };
    const index = ETAPES.findIndex((e) => e.id === etat.etape);
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: article.titre, gauche: h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles') }),
      h('nav', { className: 'etapes', 'aria-label': 'Étapes' },
        ETAPES.map((e, i) => h('button', {
          key: e.id, type: 'button', className: cls('etape', e.id === etat.etape && 'active', i < index && 'faite'), 'aria-current': e.id === etat.etape ? 'step' : undefined, onClick: () => dispatch({ type: 'etape', etape: e.id }),
        }, h('span', { className: 'etape-num' }, i + 1), e.nom))),
      etat.aide && h(PanneauAide, { cle: etat.etape, dispatch }),
      h(Message, { etat, dispatch }),
      h('main', { className: cls('contenu atelier', etat.etape === 'composition' && 'large', (!vues[etat.etape] || etat.etape === 'texte') && 'texte-fixe') }, h(vues[etat.etape] || EtapeTexte, { etat, dispatch, article, majA })),
      h('footer', { className: 'pied-etapes' },
        h(Bouton, { disabled: index === 0, onClick: () => dispatch({ type: 'etape', etape: ETAPES[index - 1].id }) }, 'Étape précédente'),
        index < ETAPES.length - 1
          ? h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'etape', etape: ETAPES[index + 1].id }) }, 'Continuer : ' + ETAPES[index + 1].nom)
          : h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, 'Terminer')));
  }

  /* ---------- Étape 1 : Texte ---------- */

  // Zone de texte qui surligne les fautes directement dans ton texte.
  // Le texte est affiché deux fois, exactement superposé : derrière, avec les surlignages ; devant, modifiable.
  function EditeurTexte({ valeur, onChange, marques, active, zoneRef, onCurseur }) {
    const fond = useRef(null);
    const ajuster = () => {
      const el = zoneRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    };
    useEffect(ajuster, [valeur]);
    const morceaux = [];
    let curseur = 0;
    [...marques].sort((a, b) => a.debut - b.debut).forEach((m, i) => {
      if (m.debut < curseur) return;
      morceaux.push(valeur.slice(curseur, m.debut));
      morceaux.push(h('mark', { key: i, className: cls(active === m.debut && 'active') }, valeur.slice(m.debut, m.fin)));
      curseur = m.fin;
    });
    morceaux.push(valeur.slice(curseur) + '\n');
    return h('div', { className: 'editeur' },
      h('div', { className: 'editeur-fond', ref: fond, 'aria-hidden': 'true' }, morceaux),
      h('textarea', { ref: zoneRef, className: 'editeur-zone', value: valeur, spellCheck: true, lang: 'fr', 'aria-label': 'Texte de l’article', onChange: (e) => onChange(e.target.value, e.target), onSelect: onCurseur ? (e) => onCurseur(e.target.selectionStart) : undefined }));
  }

  function extraitAvecMarque(texte, debut, longueur) {
    const avant = texte.slice(Math.max(0, debut - 40), debut);
    const fin = debut + longueur;
    return [(debut > 40 ? '…' : '') + avant, texte.slice(debut, fin), texte.slice(fin, fin + 40) + (fin + 40 < texte.length ? '…' : '')];
  }

  /* ---------- Relecture par l'IA (phase 4) : cartes dans le panneau de droite ---------- */

  const RELECTURES = new Map(); // id d'article → état de sa relecture, le temps de la session

  function useRelecture(article, texteComplet, majA) {
    const [r, setR] = useState(() => RELECTURES.get(article.id) || { source: texteComplet, props: [], actif: null, etat: 'repos', detail: '', ecartees: 0, edition: null, brouillon: '' });
    const maj = (f) => setR((x) => { const y = typeof f === 'function' ? f(x) : { ...x, ...f }; RELECTURES.set(article.id, y); return y; });
    // Dernier état connu, pour les actions (y compris après l'attente de la réponse de l'IA).
    const dernier = useRef(r);
    dernier.current = r;
    const remplacer = (y) => { dernier.current = y; RELECTURES.set(article.id, y); setR(y); };
    // Le texte a changé ailleurs (frappe, Annuler, slides) : chaque proposition est recalée, ou retirée si son passage a été touché.
    useEffect(() => { maj((x) => (x.source === texteComplet ? x : { ...x, source: texteComplet, props: R.recaler(x.source, texteComplet, x.props) })); }, [texteComplet]);
    const position = (p) => (p.applique ? p.applique.debut : p.debut);
    const trier = (props) => props.slice().sort((a, b) => position(a) - position(b));
    const prochaine = (props, depuis) => {
      const i = props.findIndex((p) => p.id === depuis);
      const ordre = props.slice(i + 1).concat(props.slice(0, Math.max(0, i)));
      const p = ordre.find((q) => q.statut === 'attente');
      return p ? p.id : null;
    };
    const montrer = (id, ouvrir = { texte: true, carte: true }) => racine.requestAnimationFrame(() => {
      if (!id) return;
      if (ouvrir.carte) { const c = document.getElementById('proposition-' + id); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      if (ouvrir.texte) { const m = document.querySelector('.editeur-fond mark.active'); if (m) m.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
    async function relire() {
      const config = IA.active();
      if (!config) return;
      const source = texteComplet;
      maj({ etat: 'encours', detail: '' });
      try {
        const reponse = await IA.demander(config, { systeme: R.SYSTEME, texte: R.consigne(source), maxJetons: 6000, delai: 150000 });
        const { retenues, ecartees } = R.localiser(source, R.lireReponse(reponse));
        const x = dernier.current; // le texte a pu changer pendant l'attente : on recale
        const props = R.recaler(source, x.source, retenues.map((p) => ({ ...p, statut: 'attente', apercu: R.apercu(source, p) })));
        const premier = props.length ? props[0].id : null;
        remplacer({ ...x, props, ecartees, etat: 'fait', detail: '', actif: premier, edition: null, brouillon: '' });
        montrer(premier);
      } catch (erreur) {
        maj({ etat: 'erreur', detail: erreur.message });
      }
    }
    function accepter(p, texte) {
      const source = texteComplet;
      if (source.slice(p.debut, p.fin) !== p.avant) { maj((x) => ({ ...x, props: x.props.filter((q) => q.id !== p.id) })); return; }
      const remplacement = texte == null ? p.apres : texte;
      const a = R.appliquer(source, p.debut, p.fin, remplacement);
      majA(OP.source(a.texte), null);
      const x = dernier.current;
      const autres = R.recaler(source, a.texte, x.props.filter((q) => q.id !== p.id));
      const traitee = { ...p, statut: texte == null || texte === p.apres ? 'acceptee' : 'modifiee', texteFinal: a.insere, applique: { debut: a.debut, longueur: a.longueur, insere: a.insere, ancien: p.avant } };
      const props = trier(autres.concat([traitee]));
      const suivante = prochaine(props, p.id);
      remplacer({ ...x, source: a.texte, props, actif: suivante, edition: null, brouillon: '' });
      montrer(suivante);
    }
    function refuser(p) {
      const x = dernier.current;
      const props = x.props.map((q) => (q.id === p.id ? { ...q, statut: 'refusee' } : q));
      const suivante = prochaine(props, p.id);
      remplacer({ ...x, props, actif: suivante, edition: null, brouillon: '' });
      montrer(suivante);
    }
    function annuler(p) {
      if (p.statut === 'refusee') { maj((x) => ({ ...x, props: x.props.map((q) => (q.id === p.id ? { ...q, statut: 'attente' } : q)), actif: p.id })); montrer(p.id); return; }
      const source = texteComplet;
      const ap = p.applique;
      if (!ap || ap.perdu || source.slice(ap.debut, ap.debut + ap.longueur) !== ap.insere) { maj((x) => ({ ...x, props: x.props.map((q) => (q.id === p.id ? { ...q, applique: { ...q.applique, perdu: true } } : q)) })); return; }
      const texte = source.slice(0, ap.debut) + ap.ancien + source.slice(ap.debut + ap.longueur);
      majA(OP.source(texte), null);
      const x = dernier.current;
      const autres = R.recaler(source, texte, x.props.filter((q) => q.id !== p.id));
      const remise = { ...p, statut: 'attente', debut: ap.debut, fin: ap.debut + ap.ancien.length, applique: undefined, texteFinal: undefined };
      remplacer({ ...x, source: texte, props: trier(autres.concat([remise])), actif: p.id, edition: null, brouillon: '' });
      montrer(p.id);
    }
    const choisir = (id, depuis) => { maj({ actif: id }); montrer(id, { texte: depuis !== 'texte', carte: depuis !== 'carte' }); };
    return {
      ...r, relire, accepter, refuser, annuler, choisir,
      modifier: (p) => maj({ edition: p.id, brouillon: p.apres, actif: p.id }),
      saisir: (v) => maj({ brouillon: v }),
      abandonner: () => maj({ edition: null, brouillon: '' }),
      valider: (p) => { const t = r.brouillon.trim(); if (t) accepter(p, t); },
      // Toucher un passage surligné dans le texte fait apparaître sa carte.
      curseur: (pos) => { const p = r.props.find((q) => q.statut === 'attente' && pos >= q.debut && pos <= q.fin); if (p && p.id !== r.actif) choisir(p.id, 'texte'); },
    };
  }

  const LIBELLES_PROPOSITION = { acceptee: 'Acceptée', modifiee: 'Modifiée', refusee: 'Refusée' };

  function CarteProposition({ p, rel }) {
    const traitee = p.statut !== 'attente';
    const actif = rel.actif === p.id;
    if (traitee) {
      return h('section', { id: 'proposition-' + p.id, className: cls('carte proposition traitee', actif && 'active') },
        h('span', { className: 'badge-type' }, p.type),
        h(Pastille, { ton: p.statut === 'refusee' ? 'neutre' : 'ok' }, LIBELLES_PROPOSITION[p.statut]),
        p.statut === 'modifiee' && h('span', { className: 'doux petit' }, '« ' + p.texteFinal + ' »'),
        p.applique && p.applique.perdu
          ? h('span', { className: 'doux petit' }, 'Plus annulable : le passage a changé depuis.')
          : h(Bouton, { variante: 'lien', onClick: () => rel.annuler(p) }, 'Annuler ce choix'));
    }
    const enEdition = rel.edition === p.id;
    return h('section', { id: 'proposition-' + p.id, className: cls('carte proposition', actif && 'active') },
      h('div', { className: 'proposition-tete' },
        h('span', { className: 'badge-type' }, p.type),
        h(Bouton, { variante: 'lien', onClick: () => rel.choisir(p.id, 'carte') }, 'Voir dans le texte')),
      h('div', { className: 'avant-apres' },
        h('div', { className: 'etiquette-mini' }, 'Avant'),
        h('p', null, p.contexteAvant, h('span', { className: 'retire' }, p.avant), p.contexteApres),
        h('div', { className: 'etiquette-mini' }, 'Après'),
        h('p', null, p.contexteAvant, h('span', { className: 'ajoute' }, p.apercu || p.apres), p.contexteApres)),
      p.pourquoi && h('div', null, h('div', { className: 'etiquette-mini' }, 'Pourquoi'), h('p', { className: 'pourquoi' }, p.pourquoi)),
      p.vigilance && h('div', { className: 'vigilance' }, h('strong', null, 'Point de vigilance. '), p.vigilance),
      enEdition
        ? h(Fragment, null,
          h('textarea', { className: 'zone-texte', rows: 3, value: rel.brouillon, onChange: (e) => rel.saisir(e.target.value), 'aria-label': 'Ta version du passage' }),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'principal', disabled: !rel.brouillon.trim(), onClick: () => rel.valider(p) }, 'Valider ma version'),
            h(Bouton, { variante: 'lien', onClick: rel.abandonner }, 'Abandonner')))
        : h('div', { className: 'actions-ligne' },
          h(Bouton, { variante: 'principal', onClick: () => rel.accepter(p) }, 'Accepter'),
          h(Bouton, { onClick: () => rel.modifier(p) }, 'Modifier'),
          h(Bouton, { variante: 'contour', onClick: () => rel.refuser(p) }, 'Refuser')));
  }

  function PanneauRelecture({ rel, nomIA, onSecours }) {
    const encours = rel.etat === 'encours';
    const attente = rel.props.filter((p) => p.statut === 'attente').length;
    const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
    return h(Fragment, null,
      h(Carte, { titre: 'Relecture', info: `${nomIA} relit l’orthographe, la grammaire, la ponctuation, le vocabulaire et la clarté. La typographie reste corrigée automatiquement. Chaque relecture utilise un peu de crédit sur ton compte.`, sousTitre: 'Rien n’est appliqué sans ton accord.', actions: h(Bouton, { variante: 'principal', onClick: rel.relire, disabled: encours }, encours ? 'Relecture…' : rel.props.length ? 'Relire à nouveau' : 'Relire avec ' + nomIA) },
        encours && h('p', { className: 'doux petit', role: 'status' }, `${nomIA} relit ton article. Cela peut prendre jusqu’à une minute.`),
        rel.etat === 'erreur' && h(Fragment, null,
          h('p', { className: 'erreur petit', role: 'status' }, rel.detail),
          h(Bouton, { variante: 'lien', onClick: onSecours }, 'Vérifier avec LanguageTool à la place')),
        rel.etat === 'fait' && h('p', { className: rel.props.length ? 'petit' : 'ok petit', role: 'status' },
          rel.props.length ? `${pluriel(rel.props.length, 'proposition')}, dont ${attente} en attente.` : `${nomIA} n’a rien relevé dans ton article.`),
        rel.etat === 'fait' && rel.ecartees > 0 && h('p', { className: 'doux petit' }, `${pluriel(rel.ecartees, 'proposition')} ${rel.ecartees > 1 ? 'écartées' : 'écartée'} : leur passage est introuvable tel quel dans ton texte.`)),
      rel.props.map((p) => h(CarteProposition, { key: p.id, p, rel })));
  }

  function EtapeTexte({ dispatch, article, majA }) {
    const zone = useRef(null);
    const curseur = useRef(null);
    const avantSaisie = useAvantSaisie(zone);
    // Le texte et le panneau de droite défilent chacun de leur côté : la zone occupe la hauteur de l'écran
    // entre l'en-tête et le pied (sur téléphone, où le panneau passe dessous, la page défile normalement).
    const cadre = useRef(null);
    const [hauteur, setHauteur] = useState(null);
    useEffect(() => {
      const mesurer = () => {
        const el = cadre.current;
        if (!el) return;
        const pied = document.querySelector('.pied-etapes');
        const bas = pied ? pied.getBoundingClientRect().height : 0;
        const haut = el.getBoundingClientRect().top + racine.scrollY;
        setHauteur(Math.max(320, Math.round(racine.innerHeight - haut - bas - 12)));
      };
      mesurer();
      racine.addEventListener('resize', mesurer);
      const observateur = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
      if (observateur) ['.barre', '.etapes', '.pied-etapes'].forEach((sel) => { const e = document.querySelector(sel); if (e) observateur.observe(e); });
      return () => { racine.removeEventListener('resize', mesurer); if (observateur) observateur.disconnect(); };
    }, []);
    const [verification, setVerification] = useState({ etat: 'repos', erreurs: [], detail: '' });
    const [active, setActive] = useState(null);
    const [remplacer, setRemplacer] = useState(null);
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const texteComplet = article.texte.join('\n\n');
    const rel = useRelecture(article, texteComplet, majA);
    const configIA = IA.active();
    const [secours, setSecours] = useState(false);
    const relectureIA = !!configIA && !secours;
    const marquesRelecture = relectureIA ? rel.props.filter((p) => p.statut === 'attente').map((p) => ({ debut: p.debut, fin: p.fin })) : [];
    const actifRelecture = relectureIA && rel.actif ? (rel.props.find((p) => p.id === rel.actif) || {}).debut : undefined;
    const typo = useMemo(() => T.correctionsArticle(article), [article.texte, article.slides, article.langue]);
    // Après une correction typographique, le curseur reste juste après ce que tu viens de taper.
    useApresRendu(() => {
      if (curseur.current === null || !zone.current) return;
      if (document.activeElement === zone.current) zone.current.setSelectionRange(curseur.current, curseur.current);
      curseur.current = null;
    }, [texteComplet]);
    function remplacerTout() {
      const paragraphes = remplacer.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
      const slides = appliquerModele(M.decouperMecaniquement(paragraphes, article.format, article.fond, choisirPolice, { charte, reglages }), article);
      majA(OP.remplacerTexte(paragraphes, slides), null, 'Texte remplacé et redécoupé, avec la même mise en page.');
      setRemplacer(null);
    }

    function montrer(e) {
      setActive(e.offset);
      const el = zone.current;
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); }
      el.setSelectionRange(e.offset, e.offset + e.length);
      // La faute surlignée est amenée au milieu de la colonne du texte (ou de la page sur téléphone).
      racine.requestAnimationFrame(() => {
        const marque = el.parentNode && el.parentNode.querySelector('mark.active');
        if (marque) marque.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }

    async function verifier() {
      setVerification({ etat: 'encours', erreurs: [], detail: '' });
      try {
        const reponse = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text: texteComplet, language: 'fr' }) });
        if (!reponse.ok) throw new Error('réponse ' + reponse.status);
        const donnees = await reponse.json();
        setVerification({ etat: 'fait', erreurs: donnees.matches.filter((m) => m.replacements.length), detail: '' });
      } catch (erreur) {
        setVerification({ etat: 'erreur', erreurs: [], detail: erreur.message });
      }
    }
    function corriger(erreur, remplacement) {
      const nouveau = texteComplet.slice(0, erreur.offset) + remplacement + texteComplet.slice(erreur.offset + erreur.length);
      const ecart = remplacement.length - erreur.length;
      majA(OP.source(nouveau));
      setVerification((v) => ({ ...v, erreurs: v.erreurs.filter((e) => e !== erreur).map((e) => (e.offset > erreur.offset ? { ...e, offset: e.offset + ecart } : e)) }));
    }
    const ignorer = (erreur) => setVerification((v) => ({ ...v, erreurs: v.erreurs.filter((e) => e !== erreur) }));
    // Si le texte change à la main, les positions des fautes ne sont plus fiables : on les efface.
    const modifierTexte = (valeur, el) => {
      if (verification.erreurs.length) setVerification({ etat: 'repos', erreurs: [], detail: '' });
      // Typographie : seulement autour de ce qui vient d'être tapé ou collé, jamais sur un retour à la ligne
      // de mise en page ni à cheval sur deux paragraphes de slides.
      const brut = L.appliquerEditionSource(article, valeur);
      const a = avantSaisie();
      const r = T.enFrancais(article)
        ? T.corrigerSaisie(texteComplet, valeur, { curseur: el ? el.selectionEnd : valeur.length, zone: a && el ? [a.debut, el.selectionEnd] : null, permis: (debut, fin) => L.passagesPermis(brut, [{ debut, fin }]).length === 1 })
        : { remplacements: [] };
      if (!r.remplacements.length) { majA(OP.source(valeur), 'texte'); return; }
      majA((a) => L.remplacerPassages(L.appliquerEditionSource(a, valeur), r.remplacements), 'texte');
      curseur.current = r.curseur;
      const trace = { base: r.texte, inverses: T.inverser(r.remplacements) };
      dispatch({ type: 'message', message: { texte: 'Typographie corrigée : ' + T.resume(r.remplacements) + '.', annulation: { type: 'article', id: article.id, maj: (a) => T.annulerTrace(a, trace) } } });
    };

    return h('div', { className: 'deux-colonnes defilement-separe', ref: cadre, style: hauteur ? { '--hauteur-texte': hauteur + 'px' } : undefined },
      h('div', { className: 'colonne-principale' },
        h(Carte, { titre: 'Texte de l’article', info: 'Ton texte est la référence : les slides suivent chaque modification, sans changer leur mise en page.', sousTitre: `${article.texte.length} paragraphes · ${M.compterMots(texteComplet)} mots. Une ligne vide sépare deux paragraphes. Les slides se mettent à jour à chaque modification.`, actions: h(Bouton, { variante: 'petit', onClick: () => setRemplacer('') }, 'Remplacer tout le texte') },
          h(EditeurTexte, { valeur: texteComplet, onChange: modifierTexte, marques: marquesRelecture.concat(verification.erreurs.map((e) => ({ debut: e.offset, fin: e.offset + e.length }))), active: actifRelecture !== undefined ? actifRelecture : active, zoneRef: zone, onCurseur: relectureIA ? rel.curseur : undefined }))),
      h('aside', { className: 'panneau' },
        relectureIA && h(PanneauRelecture, { rel, nomIA: IA.FOURNISSEURS[configIA.fournisseur].nom, onSecours: () => setSecours(true) }),
        !relectureIA && h(Carte, { titre: 'Orthographe et grammaire', info: 'Vérification par LanguageTool, un service gratuit. Rien n’est corrigé sans ton accord.', sousTitre: 'Les fautes sont surlignées dans ton texte.', actions: h(Bouton, { variante: 'principal', onClick: verifier, disabled: verification.etat === 'encours' }, verification.etat === 'encours' ? 'Vérification…' : 'Vérifier') },
          verification.etat === 'erreur' && h('p', { className: 'erreur petit' }, 'Vérification impossible : ' + verification.detail),
          verification.etat === 'fait' && !verification.erreurs.length && h('p', { className: 'ok petit' }, 'Aucune faute détectée.'),
          verification.erreurs.map((e, i) => {
            const [avant, fautif, apres] = extraitAvecMarque(texteComplet, e.offset, e.length);
            return h('div', { key: e.offset + '-' + i, className: cls('correction', active === e.offset && 'active') },
              h('p', { className: 'extrait-correction' }, avant, h('mark', null, fautif), apres),
              h('div', { className: 'doux petit' }, e.message),
              h('div', { className: 'propositions-correction' }, h('span', { className: 'petit' }, 'Remplacer par :'),
                e.replacements.slice(0, 4).map((r, k) => h(Bouton, { key: k, variante: k === 0 ? 'principal petit' : 'petit', onClick: () => corriger(e, r.value) }, r.value || '(supprimer)'))),
              h('div', { className: 'actions-ligne' },
                h(Bouton, { variante: 'petit', onClick: () => montrer(e) }, h(Icone, { nom: 'oeil', taille: 16 }), 'Montrer dans le texte'),
                h(Bouton, { variante: 'lien', onClick: () => ignorer(e) }, 'Ignorer')));
          }),
          h('p', { className: 'mention' }, 'Correction fournie par ', h('a', { href: 'https://languagetool.org', target: '_blank', rel: 'noopener' }, 'LanguageTool'), '.'),
          configIA
            ? h(Bouton, { variante: 'lien', onClick: () => setSecours(false) }, 'Revenir à la relecture par ' + IA.FOURNISSEURS[configIA.fournisseur].nom)
            : h('p', { className: 'doux petit' }, 'Pour une relecture complète (grammaire, vocabulaire, clarté), ajoute une clé dans Configuration, onglet IA.')),
        h(Carte, { titre: 'Typographie', info: 'Ces règles ne changent jamais tes mots. Les adresses web, les heures (14:30) et les nombres ne sont pas touchés.', sousTitre: 'Corrigée toute seule quand tu tapes ou colles : espace insécable avant : ; ! ? et dans « », guillemets « », apostrophe ’, points de suspension …' },
          typo.total
            ? h(Fragment, null,
              h('p', { className: 'petit' }, typo.total === 1 ? 'Reste 1 correction : ' + T.resume(typo.liste) + '.' : 'Restent ' + T.resume(typo.liste) + '.'),
              h(Bouton, { variante: 'principal', onClick: () => majA(T.corrigerArticle, null, 'Typographie corrigée : ' + T.resume(typo.liste) + '.') }, 'Corriger la typographie'))
            : h('p', { className: 'ok petit' }, 'Ton article respecte ces règles.')),
        h(Carte, { titre: 'Suggestions de style', sousTitre: 'Elles arriveront avec l’IA. Tu sélectionneras un passage directement dans ton texte, et un petit menu te proposera : clarifier, raccourcir, restructurer, rendre plus percutant.' })),
      remplacer !== null && h(Feuille, { titre: 'Remplacer tout le texte', onAnnuler: () => setRemplacer(null), action: h(Bouton, { variante: 'principal', disabled: !remplacer.trim(), onClick: remplacerTout }, 'Remplacer') },
        h('p', { className: 'note' }, 'Le nouveau texte est redécoupé en slides avec la même mise en page : fond, format, gabarits et logo. Tu pourras l’annuler juste après.'),
        h(ZoneTexteTypo, { className: 'zone-texte', rows: 12, valeur: remplacer, onValeur: setRemplacer, placeholder: 'Colle ici le nouveau texte.', 'aria-label': 'Nouveau texte' })));
  }

  const FAMILLES = [['Couverture', ['V1', 'V2', 'V3', 'V4', 'V5']], ['Texte', ['T1', 'T2', 'T3', 'T4', 'T5']], ['Fin', ['F1']]];

  /* ---------- Étape 2 : Composition (fichier composition.js) ---------- */

  const { EtapeComposition } = (racine.PostsOPComposition || require('./composition.js'))({ React, M, L, T, OP, Contexte, Icone, Bouton, SlideCanvas, cls });

  /* ---------- Étapes 4 et 5 ---------- */

  const LIMITES_DESCRIPTION = { instagram: 2200, linkedin: 3000 }; // indicatives, à vérifier

  function EtapeDescription({ dispatch, article, majA }) {
    const descriptions = article.descriptions || DESCRIPTIONS_VIDES;
    return h('div', { className: 'colonne-unique' },
      ['instagram', 'linkedin'].map((reseau) => {
        const texte = descriptions[reseau].fr || '';
        return h(Carte, {
          key: reseau, titre: reseau === 'instagram' ? 'Légende Instagram' : 'Texte du post LinkedIn',
          info: reseau === 'instagram' ? 'Seules les premières lignes s’affichent avant « plus » : la première phrase compte le plus.' : 'Il s’affiche au-dessus du document : il donne envie de l’ouvrir.',
          actions: h(Bouton, { variante: 'petit', disabled: !texte, onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(texte).catch(() => {}); dispatch({ type: 'message', message: 'Description copiée.' }); } }, 'Copier'),
        },
        h('textarea', { className: 'zone-texte', rows: 9, value: texte, placeholder: 'Écris ici le texte qui accompagnera ton carrousel. L’IA pourra te proposer une version plus tard.', onChange: (e) => majA(OP.description(reseau, e.target.value), 'description-' + reseau), 'aria-label': 'Description ' + reseau }),
        h('div', { className: 'doux petit droite' }, `${texte.length} / ${LIMITES_DESCRIPTION[reseau]} caractères (limite indicative)`));
      }));
  }

  const taille = (octets) => (octets > 1048576 ? (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(octets / 1024)) + ' Ko');

  function EtapeExport({ dispatch, article, majA }) {
    const { choisirPolice, reglages, charte, images } = useContext(Contexte);
    const [quoi, setQuoi] = useState(article.reseau === 'linkedin' ? 'pdf' : 'png');
    const [suivi, setSuivi] = useState({ statut: 'repos' });
    const total = article.slides.length;
    const logo = article.logo || 'auto';
    const compositions = article.slides.map((s, k) => M.composer(s, article.format, article.fond, choisirPolice, { index: k, total, reglages, charte, logo }));
    const validees = article.alertesValidees || [];
    const alertes = M.controler(article, compositions, reglages).filter((a) => !validees.includes(a.cle));
    const manquants = [...new Set(compositions.flatMap((c) => c.elements.filter((e) => e.type === 'image' && !images[e.cle]).map((e) => e.cle)))];
    const nomsImages = { logo: 'le logo foncé', logoClair: 'le logo clair', fleurs: 'les fleurs' };
    const exacte = compositions.every((c) => c.exacte);

    async function preparer(force) {
      if (!force && (alertes.length || manquants.length)) { setSuivi({ statut: 'confirmation' }); return; }
      if ((quoi === 'pdf' || quoi === 'les-deux') && !racine.PDFLib) { setSuivi({ statut: 'erreur', message: 'Le fichier pdf-lib.min.js est introuvable sur ton site : vérifie qu’il est bien dans ton dépôt.' }); return; }
      setSuivi({ statut: 'encours' });
      try {
        const echelle = reglages.resolution === '1' ? 1 : 2;
        const resultat = await X.preparer({ article, compositions, ressources: images, echelle, quoi, PDFLib: racine.PDFLib });
        setSuivi({ statut: 'pret', ...resultat, partage: X.peutPartager(resultat.fichiers) });
        if (article.statut === 'Brouillon' || article.statut === 'Prêt') majA(OP.champ('statut', 'Exporté'));
      } catch (erreur) {
        setSuivi({ statut: 'erreur', message: erreur.message });
      }
    }
    async function partager() {
      try { await X.partager(suivi.fichiers); } catch (erreur) { if (erreur.name !== 'AbortError') dispatch({ type: 'message', message: 'Partage impossible ici : utilise « Télécharger ». (' + erreur.message + ')' }); }
    }
    async function telecharger() {
      const nom = await X.telecharger(suivi.fichiers, suivi.base);
      dispatch({ type: 'message', message: `« ${nom} » téléchargé.` });
    }

    return h('div', { className: 'colonne-unique' },
      h(Carte, { titre: 'Exporter', info: 'Les fichiers sont dessinés par le même moteur que l’aperçu : ce que tu vois est ce que tu obtiens.', sousTitre: `${total} slides · ${M.FORMATS[article.format].nom} · fond ${M.fondsDe(charte.palette)[article.fond].nom.toLowerCase()}` },
        h(Ligne, { etiquette: 'Fichiers', aide: 'Images PNG pour Instagram, PDF pour LinkedIn (le réseau le recommande pour les carrousels).' },
          h(Segmente, { valeur: quoi, onChange: (v) => { setQuoi(v); setSuivi({ statut: 'repos' }); }, options: [{ valeur: 'png', libelle: 'Images PNG' }, { valeur: 'pdf', libelle: 'PDF' }, { valeur: 'les-deux', libelle: 'Les deux' }] })),
        h('p', { className: 'doux petit' }, `Résolution des images : ×${reglages.resolution === '1' ? 1 : 2} (modifiable dans Réglages).${exacte ? '' : ' Tes polices ne sont pas importées sur cet appareil : le rendu sera approché, et le PDF contiendra des images.'}`),
        suivi.statut !== 'confirmation' && h(Bouton, { variante: 'principal large', disabled: suivi.statut === 'encours', onClick: () => preparer(false) }, h(Icone, { nom: 'telecharger', taille: 18 }), suivi.statut === 'encours' ? 'Préparation…' : 'Préparer les fichiers'),
        suivi.statut === 'confirmation' && h('div', { className: 'confirmation' },
          h('p', null, h('strong', null, 'Avant d’exporter, il reste :')),
          h('ul', { className: 'liste-alertes' },
            alertes.map((a) => h('li', { key: a.cle, className: a.niveau }, h('span', null, (a.slide !== null ? `Slide ${a.slide + 1} · ` : '') + a.message))),
            manquants.map((m) => h('li', { key: m, className: 'avertissement' }, h('span', null, `Il manque ${nomsImages[m] || m} : sa place restera vide dans les fichiers.`)))),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'principal', onClick: () => preparer(true) }, 'Exporter quand même'),
            h(Bouton, { onClick: () => dispatch({ type: 'aller', etape: 'composition', slide: alertes[0] && alertes[0].slide !== null ? alertes[0].slide : 0 }) }, 'Revenir corriger'))),
        suivi.statut === 'erreur' && h('p', { className: 'erreur' }, 'Export impossible : ' + suivi.message),
        suivi.statut === 'pret' && h('div', { className: 'fichiers-prets' },
          h('ul', { className: 'liste-fichiers' }, suivi.fichiers.map((f) => h('li', { key: f.nom }, h('span', null, f.nom), h('span', { className: 'doux petit' }, taille(f.blob.size))))),
          h('div', { className: 'actions-ligne' },
            suivi.partage && h(Bouton, { variante: 'principal', onClick: partager }, h(Icone, { nom: 'partager', taille: 18 }), 'Partager ou enregistrer'),
            h(Bouton, { variante: suivi.partage ? 'secondaire' : 'principal', onClick: telecharger }, h(Icone, { nom: 'telecharger', taille: 18 }), suivi.fichiers.length > 1 ? 'Télécharger (archive ZIP)' : 'Télécharger')))),
      h(Carte, { titre: 'Publication', info: 'Une fois le carrousel publié sur le réseau, marque-le comme publié : il rejoint la section Publiés de ta bibliothèque.' },
        article.statut === 'Publié'
          ? h('div', { className: 'actions-ligne' }, h(Pastille, { ton: 'ok' }, 'Publié le ' + new Date(article.publie || Date.now()).toLocaleDateString('fr-FR')), h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'statut', id: article.id, statut: 'Exporté' }) }, 'Remettre en cours'))
          : h(Bouton, { onClick: () => dispatch({ type: 'statut', id: article.id, statut: 'Publié' }) }, h(Icone, { nom: 'coche', taille: 18 }), 'Marquer comme publié')),
      h('div', { className: 'grille-export' }, article.slides.map((s, k) => h('div', { key: k, className: 'export-item' },
        h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 180, index: k, total, logo, etiquette: 'Slide ' + (k + 1) }), h('div', { className: 'doux petit centre' }, k + 1)))));
  }

  /* ================================================================== */
  /* 7. Configuration                                                    */
  /* ================================================================== */

  function Configuration({ etat, dispatch, actions }) {
    const onglets = { charte: OngletCharte, ressources: OngletRessources, reglages: OngletReglages, synchro: OngletSynchro, ia: OngletIA };
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: 'Configuration', gauche: h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles') }),
      h('nav', { className: 'onglets' }, h(Segmente, { etiquette: 'Onglets', valeur: etat.onglet, onChange: (o) => dispatch({ type: 'onglet', onglet: o }), options: [{ valeur: 'charte', libelle: 'Charte' }, { valeur: 'ressources', libelle: 'Ressources' }, { valeur: 'reglages', libelle: 'Réglages' }, { valeur: 'synchro', libelle: 'Synchronisation' }, { valeur: 'ia', libelle: 'IA' }] })),
      etat.aide && h(PanneauAide, { cle: 'configuration', dispatch }),
      h(Message, { etat, dispatch }),
      h('main', { className: 'contenu colonne-unique' }, h(onglets[etat.onglet] || OngletCharte, { etat, dispatch, actions })));
  }

  const EXEMPLE_COUVERTURE = { role: 'Couverture', blocs: [{ style: 'titre', texte: 'Le silence\nlaisse rarement' }, { style: 'contrepoint', texte: 'un vide.' }] };
  const EXEMPLE_TEXTE = { role: 'Texte', blocs: [{ style: 'corps', texte: 'Depuis quelques mois, son manager ne lui parle presque plus.' }, { style: 'emphase', texte: 'Et là, surprise.' }, { style: 'citation', texte: `«${NB}Le pire, c’est que je ne sais même pas ce que j’ai fait de mal.${NB}»` }], signature: true };
  const COULEURS = [['bleu', 'Bleu Oh ! Potentiel', 'Fonds et texte'], ['vert', 'Vert Oh ! Potentiel', 'Mises en valeur, fleurs, bandeaux'], ['blanc', 'Blanc', 'Fonds et texte'], ['bleuPale', 'Bleu pâle', 'Fonds uniquement'], ['vertPale', 'Vert pâle', 'Fonds uniquement']];

  function OngletCharte({ etat, dispatch }) {
    const charte = etat.projet.charte;
    const majCharte = (champs) => dispatch({ type: 'projet', maj: (p) => ({ ...p, charte: { ...p.charte, ...champs } }) });
    const majCouleur = (cle, valeur) => { if (/^#[0-9a-f]{6}$/i.test(valeur)) majCharte({ palette: { ...charte.palette, [cle]: valeur.toUpperCase() } }); };
    const lisibilite = verifierLisibilite(charte.palette);
    const faibles = lisibilite.filter((l) => l.ratio < 4.5);
    return h(Fragment, null,
      h(Carte, { titre: 'Couleurs', info: 'Elles s’appliquent à tous tes carrousels, sur tous tes appareils.', actions: h(Bouton, { variante: 'petit', onClick: () => majCharte({ palette: { ...M.PALETTE } }) }, 'Rétablir les couleurs d’origine') },
        h('div', { className: 'nuancier' }, COULEURS.map(([cle, nom, usage]) => h('div', { key: cle, className: 'couleur-charte' },
          h('label', { className: 'echantillon', style: { background: charte.palette[cle] } }, h('input', { type: 'color', value: charte.palette[cle], 'aria-label': 'Couleur ' + nom, onChange: (e) => majCouleur(cle, e.target.value) })),
          h('div', null, h('div', { className: 'petit' }, h('strong', null, nom)),
            h('input', { className: 'code-couleur', defaultValue: charte.palette[cle], key: charte.palette[cle], 'aria-label': 'Code de la couleur ' + nom, onBlur: (e) => majCouleur(cle, e.target.value.trim()) }),
            h('div', { className: 'doux petit' }, usage))))),
        faibles.length
          ? h('div', { className: 'liste-alertes' }, h('li', { className: 'avertissement' }, h('span', null, `Lisibilité insuffisante : ${faibles.map((l) => `${l.element.toLowerCase()} sur fond ${l.fond.toLowerCase()} (${l.ratio.toFixed(1)})`).join(', ')}. Il faut au moins 4,5.`)))
          : h('p', { className: 'ok petit' }, 'Toutes les associations de couleurs sont lisibles (contraste d’au moins 4,5).')),
      h(Carte, { titre: 'Tailles de texte', info: 'Les autres tailles (bandeaux, grandes citations, encadrés…) suivent ces deux valeurs.' },
        h(Ligne, { etiquette: `Titre de couverture : ${charte.tailleTitre} px`, aide: 'Valeur d’origine : 114 px.' }, h('input', { type: 'range', min: 90, max: 130, value: charte.tailleTitre, onChange: (e) => majCharte({ tailleTitre: Number(e.target.value) }), 'aria-label': 'Taille du titre' })),
        h(Ligne, { etiquette: `Texte courant : ${charte.tailleTexte} px`, aide: 'Valeur d’origine : 39 px. En dessous de 34 px, la lecture sur téléphone devient difficile.' }, h('input', { type: 'range', min: 32, max: 46, value: charte.tailleTexte, onChange: (e) => majCharte({ tailleTexte: Number(e.target.value) }), 'aria-label': 'Taille du texte courant' })),
        h(Bouton, { variante: 'petit', onClick: () => majCharte({ tailleTitre: 114, tailleTexte: 39 }) }, 'Rétablir les tailles d’origine')),
      h(Carte, { titre: 'Planche de validation', info: 'Le même contenu sur chacun des cinq fonds, avec ta charte actuelle.' },
        h('div', { className: 'planche' }, Object.entries(M.fondsDe(charte.palette)).map(([f, fond]) => h('figure', { key: f, className: 'galerie-item' },
          h(SlideCanvas, { slide: { ...EXEMPLE_COUVERTURE, gabarit: 'V1' }, formatId: 'carre', fondId: f, largeur: 150 }),
          h(SlideCanvas, { slide: { ...EXEMPLE_TEXTE, gabarit: 'T1' }, formatId: 'carre', fondId: f, largeur: 150 }),
          h('figcaption', null, h('strong', null, fond.nom)))))),
      h(Carte, { titre: 'Gabarits', info: 'Les 11 mises en page validées.' },
        FAMILLES.map(([famille, codes]) => h('div', { key: famille, className: 'famille-gabarits' }, h('div', { className: 'surtitre' }, famille),
          h('div', { className: 'galerie' }, codes.map((code) => h('figure', { key: code, className: 'galerie-item' },
            h(SlideCanvas, { slide: { ...(famille === 'Couverture' ? EXEMPLE_COUVERTURE : EXEMPLE_TEXTE), gabarit: code }, formatId: 'carre', fondId: famille === 'Texte' ? 'blanc' : 'bleu', largeur: 150 }),
            h('figcaption', null, h('strong', null, M.GABARITS[code].nom), h('span', { className: 'doux' }, M.GABARITS[code].aide)))))))),
      h(Carte, { titre: 'Règles', info: 'Le contrat que l’outil fait respecter automatiquement.' },
        h('div', { className: 'regles' },
          h('div', null, h('h4', null, 'Obligatoire'), h('ul', { className: 'liste-simple' }, h('li', null, 'Marge gauche de 81 px ; texte aligné à gauche par défaut'), h('li', null, 'Un seul fond par carrousel'), h('li', null, 'Logo officiel sur la dernière slide'))),
          h('div', null, h('h4', null, 'Autorisé'), h('ul', { className: 'liste-simple' }, h('li', null, 'Cinq fonds, dont deux nuances pâles'), h('li', null, 'Format 1:1 ou 4:5'), h('li', null, 'Dernière slide centrée'), h('li', null, 'Logo sur chaque slide (réglage)'), h('li', null, 'Alignement, gras, italique, souligné, taille et filet choisis paragraphe par paragraphe'))),
          h('div', null, h('h4', null, 'Interdit'), h('ul', { className: 'liste-simple' }, h('li', null, 'Texte vert sur fond blanc ou pâle'), h('li', null, 'Texte blanc sur fond vert ou pâle'), h('li', null, 'Associations de couleurs peu lisibles'))))));
  }

  function OngletRessources({ etat, actions }) {
    const [etatImport, setEtatImport] = useState('');
    const r = etat.projet.ressources || {};
    const importer = async (cle, fichier) => {
      if (!fichier) return;
      try { setEtatImport(await actions.importerRessource(cle, fichier)); } catch (erreur) { setEtatImport(`${fichier.name} : ${erreur.message}`); }
    };
    const statut = (present, nom, absent) => (present ? h(Pastille, { ton: 'ok' }, nom || 'Importé') : h(Pastille, { ton: 'attention' }, absent));
    const champ = (etiquette, cle, accepte) => h('label', { className: 'bouton secondaire petit fichier' }, etiquette, h('input', { type: 'file', accept: accepte, onChange: (e) => importer(cle, e.target.files[0]) }));
    return h(Fragment, null,
      h('p', { className: 'note' }, 'Importe chaque fichier une seule fois : la synchronisation le retrouve sur tes autres appareils. Il reste dans ton dépôt privé, jamais sur le site public.'),
      h(Carte, { titre: 'Polices', info: 'Leur licence Monotype interdit de les diffuser : elles ne vont que dans ton dépôt privé.' },
        h(Ligne, { etiquette: 'Gill Sans MT Light', aide: 'Texte courant et citations.' }, statut(etat.polices.light, r.light && r.light.nom, 'Rendu approché'), champ('Importer', 'light')),
        h(Ligne, { etiquette: 'Gill Sans MT Bold', aide: 'Titres et phrases-chocs.' }, statut(etat.polices.bold, r.bold && r.bold.nom, 'Rendu approché'), champ('Importer', 'bold')),
        h(Ligne, { etiquette: 'Gill Sans MT Light Italic', aide: 'Passages mis en italique dans le texte courant. Sans lui, les lettres sont simplement penchées.' }, statut(etat.polices.lightItalic, r.lightItalic && r.lightItalic.nom, 'Italique simulé'), champ('Importer', 'lightItalic')),
        h(Ligne, { etiquette: 'Gill Sans MT Bold Italic', aide: 'Passages en gras et en italique.' }, statut(etat.polices.boldItalic, r.boldItalic && r.boldItalic.nom, 'Italique simulé'), champ('Importer', 'boldItalic'))),
      h(Carte, { titre: 'Logo et motifs', info: 'Utilise des PNG à fond transparent : ils s’affichent sur tous les fonds.' },
        h(Ligne, { etiquette: 'Logo foncé, pour les fonds clairs', aide: 'Fonds blanc, vert et pâles. En attendant, un cadre en pointillés marque sa place.' }, statut(etat.images.logo, r.logo && r.logo.nom, 'Manquant'), champ('Importer', 'logo', 'image/png,image/svg+xml')),
        h(Ligne, { etiquette: 'Logo clair, pour les fonds foncés', aide: 'Fond bleu. Tu choisis ensuite la version voulue pour chaque article, dans Design.' }, statut(etat.images.logoClair, r.logoClair && r.logoClair.nom, 'Manquant'), champ('Importer', 'logoClair', 'image/png,image/svg+xml')),
        h(Ligne, { etiquette: 'Fleurs', aide: 'Utilisées par les gabarits « Fleurs » et « Fin centrée ».' }, statut(etat.images.fleurs, r.fleurs && r.fleurs.nom, 'À importer'), champ('Importer', 'fleurs', 'image/png,image/svg+xml'))),
      etatImport && h('p', { className: 'note' }, etatImport));
  }

  function OngletReglages({ etat, dispatch }) {
    const r = etat.projet.reglages;
    const regler = (cle) => (valeur) => dispatch({ type: 'reglage', cle, valeur });
    const interrupteur = (cle, etiquette) => h('label', { className: 'interrupteur' }, h('input', { type: 'checkbox', checked: !!r[cle], onChange: (e) => regler(cle)(e.target.checked), 'aria-label': etiquette }), h('span', null));
    return h(Fragment, null,
      h('p', { className: 'note' }, 'Tes réglages sont enregistrés et synchronisés, sauf l’apparence, propre à chaque appareil.'),
      h(Carte, { titre: 'Apparence de cet appareil' },
        h(Ligne, { etiquette: 'Mode', aide: 'Automatique suit le réglage clair ou sombre de l’appareil.' }, h(Segmente, { valeur: etat.apparence, onChange: (v) => dispatch({ type: 'apparence', valeur: v }), options: [{ valeur: 'clair', libelle: 'Clair' }, { valeur: 'sombre', libelle: 'Sombre' }, { valeur: 'auto', libelle: 'Automatique' }] }))),
      h(Carte, { titre: 'Mise en page' },
        h(Ligne, { etiquette: 'Rythme visuel', aide: 'Utilisé par « Proposer une autre présentation ». Régulier : le même gabarit de texte partout. Contrasté : plus de variété.' }, h(Segmente, { valeur: r.rythme, onChange: regler('rythme'), options: [{ valeur: 'regulier', libelle: 'Régulier' }, { valeur: 'equilibre', libelle: 'Équilibré' }, { valeur: 'contraste', libelle: 'Contrasté' }] })),
        h(Ligne, { etiquette: 'Mots maximum par slide', aide: `Au-delà, une alerte s’affiche dans Design. Tes carrousels actuels montent à 90 mots. Réglage : ${r.motsMax}.` }, h('input', { type: 'range', min: 30, max: 120, step: 5, value: r.motsMax, onChange: (e) => regler('motsMax')(Number(e.target.value)), 'aria-label': 'Mots maximum par slide' })),
        h(Ligne, { etiquette: 'Logo sur chaque slide', aide: 'Un petit logo en bas à droite de toutes les slides. La dernière garde son logo de fin.' }, interrupteur('logoPartout', 'Logo sur chaque slide')),
        h(Ligne, { etiquette: 'Numéro de slide', aide: 'Affiche « 2 / 6 » en bas à gauche.' }, interrupteur('numero', 'Numéro de slide')),
        h(Ligne, { etiquette: 'Indicateur « glisser »', aide: 'Une petite flèche à droite invite à passer à la slide suivante.' }, interrupteur('glisser', 'Indicateur glisser'))),
      h(Carte, { titre: 'Par défaut pour un nouvel article' },
        h(Ligne, { etiquette: 'Réseau', aide: 'Présélectionné à la création.' }, h(Segmente, { valeur: r.reseauDefaut, onChange: regler('reseauDefaut'), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
        h(Ligne, { etiquette: 'Format', aide: 'Présélectionné à la création.' }, h(Segmente, { valeur: r.formatDefaut, onChange: regler('formatDefaut'), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] }))),
      h(Carte, { titre: 'Export', sousTitre: 'Utilisés à partir de la phase 3.' },
        h(Ligne, { etiquette: 'Résolution des PNG', aide: '×2 : images deux fois plus grandes, plus nettes à l’archive.' }, h(Segmente, { valeur: r.resolution, onChange: regler('resolution'), options: [{ valeur: '1', libelle: '×1' }, { valeur: '2', libelle: '×2' }] })),
        h(Ligne, { etiquette: 'Texte du PDF', aide: 'Tracés : identiques à l’aperçu, sans contrainte de licence.' }, h(Segmente, { valeur: r.pdfTexte, onChange: regler('pdfTexte'), options: [{ valeur: 'traces', libelle: 'Tracés' }, { valeur: 'selectionnable', libelle: 'Sélectionnable' }] }))));
  }

  function OngletSynchro({ etat, actions }) {
    const config = actions.lireConfig() || {};
    const [proprietaire, setProprietaire] = useState(config.proprietaire || '');
    const [depot, setDepot] = useState(config.depot || 'postsop-donnees');
    const [cle, setCle] = useState('');
    const [test, setTest] = useState({ etat: 'repos', message: '' });
    const s = etat.synchro;
    const [libelle, ton] = LIBELLES_SYNCHRO[s.statut] || LIBELLES_SYNCHRO['non-configure'];
    async function enregistrer() {
      setTest({ etat: 'encours', message: 'Test de la connexion…' });
      try { setTest({ etat: 'ok', message: await actions.configurerSynchro({ proprietaire: proprietaire.trim(), depot: depot.trim(), cle: cle.trim() || config.cle }) }); setCle(''); } catch (erreur) { setTest({ etat: 'erreur', message: erreur.message }); }
    }
    return h(Fragment, null,
      h(Carte, { titre: 'État', actions: h(Bouton, { variante: 'principal', disabled: !config.cle || s.statut === 'en-cours', onClick: () => actions.synchroniser(true) }, 'Synchroniser maintenant') },
        h('p', null, h(Pastille, { ton }, libelle), ' ', s.derniere ? `Dernière synchronisation : ${new Date(s.derniere).toLocaleString('fr-FR')}.` : ''),
        s.attente > 0 && h('p', { className: 'petit' }, `${s.attente} changement(s) enregistré(s) sur cet appareil, en attente d’envoi.`),
        s.detail && h('p', { className: s.statut === 'erreur' ? 'erreur petit' : 'doux petit' }, s.detail),
        s.conflits && s.conflits.length > 0 && h('ul', { className: 'liste-alertes' }, s.conflits.map((c, i) => h('li', { key: i, className: 'avertissement' }, h('span', null, c.copie ? `« ${c.titre} » avait été modifié sur deux appareils : la version de cet appareil est gardée à part, sous le titre « … (conflit) ».` : `${c.titre} : ${c.raison || 'modifié sur deux appareils, la version la plus récente de GitHub a été gardée.'}`))))),
      h(Carte, { titre: 'Connexion à ton dépôt privé', info: 'Ces informations restent sur cet appareil. À saisir une fois sur chacun de tes appareils.' },
        h(Ligne, { etiquette: 'Pseudo GitHub' }, h('input', { className: 'champ-texte', value: proprietaire, autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setProprietaire(e.target.value), 'aria-label': 'Pseudo GitHub' })),
        h(Ligne, { etiquette: 'Nom du dépôt de données' }, h('input', { className: 'champ-texte', value: depot, autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setDepot(e.target.value), 'aria-label': 'Nom du dépôt' })),
        h(Ligne, { etiquette: 'Clé d’accès', aide: config.cle ? 'Une clé est déjà enregistrée sur cet appareil. Laisse vide pour la garder.' : 'Commence par « github_pat_ ».' }, h('input', { className: 'champ-texte', type: 'password', value: cle, autoComplete: 'off', onChange: (e) => setCle(e.target.value), 'aria-label': 'Clé d’accès' })),
        h('div', { className: 'actions-ligne' },
          h(Bouton, { variante: 'principal', disabled: !proprietaire || !depot || !(cle || config.cle) || test.etat === 'encours', onClick: enregistrer }, 'Tester et enregistrer'),
          config.cle && h(Bouton, { variante: 'lien', onClick: () => { actions.oublierSynchro(); setTest({ etat: 'repos', message: 'Clé oubliée sur cet appareil.' }); } }, 'Oublier la clé sur cet appareil')),
        test.message && h('p', { className: test.etat === 'erreur' ? 'erreur' : test.etat === 'ok' ? 'ok' : 'doux' }, test.message)),
      h(Carte, { titre: 'Mise en place, une seule fois', sousTitre: 'Une dizaine de minutes. Les intitulés de GitHub peuvent légèrement varier.' },
        h('ol', { className: 'guide' },
          h('li', null, 'Sur github.com, touche « + » en haut, puis « New repository ». Nom : ', h('strong', null, 'postsop-donnees'), '. Choisis ', h('strong', null, 'Private'), ', puis « Create repository ».'),
          h('li', null, 'Ouvre ton profil (ta photo, en haut à droite), puis Settings, puis, tout en bas, Developer settings.'),
          h('li', null, 'Personal access tokens, puis Fine-grained tokens, puis « Generate new token ». Nom : PostsOP. Choisis la durée la plus longue proposée.'),
          h('li', null, 'Dans « Repository access », choisis « Only select repositories », puis postsop-donnees.'),
          h('li', null, 'Dans « Permissions », trouve « Contents » et choisis « Read and write ».'),
          h('li', null, 'Touche « Generate token », copie la clé (elle ne s’affiche qu’une fois) et colle-la ci-dessus.')),
        h('p', { className: 'doux petit' }, 'Ne colle jamais cette clé dans une conversation ni dans ton dépôt public. Si elle fuit, supprime-la sur GitHub et crées-en une autre.')));
  }

  // Fournisseur d'IA : Claude par défaut, Mistral en option. Tout reste sur cet appareil (voir ia.js).
  const GUIDES_IA = {
    claude: [
      ['Sur ', h('strong', null, 'platform.claude.com'), ', crée un compte au nom de l’entreprise.'],
      ['Dans le tableau de bord, touche « Ajouter des fonds ». Laisse le rechargement automatique désactivé : la dépense ne pourra jamais dépasser les crédits achetés.'],
      ['Ouvre « Clés API », touche « Créer une clé », puis « Continuer avec une clé API ».'],
      ['Nom : ', h('strong', null, 'PostsOP'), '. Expiration : 90 jours, ou la durée proposée la plus proche. Laisse l’espace de travail par défaut.'],
      ['Touche le bouton de création, copie la clé (elle ne s’affiche qu’une fois) et colle-la ci-dessus.'],
    ],
    mistral: [
      ['Sur ', h('strong', null, 'console.mistral.ai'), ', crée un compte au nom de l’entreprise et choisis une offre payante : avec l’offre gratuite, les textes envoyés peuvent servir à entraîner leurs modèles.'],
      ['Ouvre la page des clés d’API et crée une clé nommée ', h('strong', null, 'PostsOP'), '.'],
      ['Copie la clé (elle ne s’affiche en général qu’une fois) et colle-la ci-dessus.'],
    ],
  };

  function OngletIA() {
    const [config, setConfig] = useState(() => IA.lire());
    const [fournisseur, setFournisseur] = useState(config.fournisseur);
    const [cle, setCle] = useState('');
    const [modele, setModele] = useState(() => IA.modeleDe(config, config.fournisseur));
    const [test, setTest] = useState({ etat: 'repos', message: '' });
    const f = IA.FOURNISSEURS[fournisseur];
    const cleEnregistree = !!config.cles[fournisseur];
    const actif = IA.active(config);
    const choisir = (v) => { setFournisseur(v); setModele(IA.modeleDe(config, v)); setCle(''); setTest({ etat: 'repos', message: '' }); };
    async function testerEtEnregistrer() {
      const cleUtilisee = cle.trim() || config.cles[fournisseur];
      const m = modele.trim() || f.modele;
      setTest({ etat: 'encours', message: 'Test de la connexion…' });
      if (!cleUtilisee) {
        // Sans clé : on vérifie seulement que le fournisseur accepte les appels de ce navigateur.
        const ok = await IA.joignable(fournisseur);
        setTest(ok
          ? { etat: 'ok', message: `${f.nom} accepte les appels depuis ce navigateur. Ajoute une clé pour un test complet.` }
          : { etat: 'erreur', message: `${f.nom} ne répond pas depuis ce navigateur. Si ta connexion internet fonctionne, ce fournisseur refuse les appels venant d’un navigateur : il faudrait un petit serveur relais pour l’utiliser.` });
        return;
      }
      try {
        const message = await IA.tester(fournisseur, cleUtilisee, m);
        IA.enregistrer({ fournisseur, cles: { ...config.cles, [fournisseur]: cleUtilisee }, modeles: { ...config.modeles, [fournisseur]: m === f.modele ? undefined : m } });
        setConfig(IA.lire());
        setCle('');
        setTest({ etat: 'ok', message: message + ' Réglage enregistré sur cet appareil.' });
      } catch (erreur) {
        setTest({ etat: 'erreur', message: erreur.message });
      }
    }
    function oublier() {
      setConfig(IA.oublierCle(fournisseur));
      setTest({ etat: 'repos', message: 'Clé oubliée sur cet appareil.' });
    }
    const aideCle = cleEnregistree
      ? 'Une clé est déjà enregistrée sur cet appareil. Laisse vide pour la garder.'
      : (f.prefixe ? `Commence par « ${f.prefixe} ». ` : '') + 'Sans clé, le test vérifie seulement que le fournisseur répond depuis ce navigateur.';
    const douteuse = cle.trim() && f.prefixe && !cle.trim().startsWith(f.prefixe);
    return h(Fragment, null,
      h('p', { className: 'note' }, 'L’IA proposera, tu décideras : rien ne sera appliqué sans ta validation. Ces réglages restent sur cet appareil, comme ta clé GitHub.'),
      h(Carte, { titre: 'État' },
        h('p', null, actif
          ? h(Fragment, null, h(Pastille, { ton: 'ok' }, `${IA.FOURNISSEURS[actif.fournisseur].nom} actif`), ' ', h('span', { className: 'doux petit' }, `Modèle ${actif.modele}.`))
          : h(Fragment, null, h(Pastille, { ton: 'attention' }, 'Aucune IA active'), ' ', h('span', { className: 'doux petit' }, 'L’app fonctionne normalement sans IA.')))),
      h(Carte, { titre: 'Fournisseur d’IA', info: 'Les coûts sont prélevés sur le compte que tu ouvres chez le fournisseur, jamais par PostsOP. Tes textes ne lui sont envoyés que lorsque tu demandes une proposition.' },
        h(Ligne, { etiquette: 'Fournisseur', aide: fournisseur === 'claude' ? 'Par défaut. Société américaine Anthropic.' : 'Société française ; données hébergées en Europe.' },
          h(Segmente, { etiquette: 'Fournisseur', valeur: fournisseur, onChange: choisir, options: [{ valeur: 'claude', libelle: 'Claude' }, { valeur: 'mistral', libelle: 'Mistral' }] })),
        h(Ligne, { etiquette: 'Clé d’API', aide: aideCle },
          h('input', { className: 'champ-texte', type: 'password', value: cle, autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setCle(e.target.value), 'aria-label': 'Clé d’API ' + f.nom })),
        douteuse && h('p', { className: 'erreur petit' }, `Cette clé ne commence pas par « ${f.prefixe} » : vérifie qu’il s’agit bien d’une clé ${f.nom}.`),
        h(Ligne, { etiquette: 'Modèle', aide: `Laisse « ${f.modele} », sauf si le fournisseur retire ce modèle.` },
          h('input', { className: 'champ-texte', value: modele, autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setModele(e.target.value), 'aria-label': 'Modèle ' + f.nom })),
        h('div', { className: 'actions-ligne' },
          h(Bouton, { variante: 'principal', disabled: test.etat === 'encours', onClick: testerEtEnregistrer }, 'Tester et enregistrer'),
          cleEnregistree && h(Bouton, { variante: 'lien', onClick: oublier }, 'Oublier la clé sur cet appareil')),
        h('p', { className: 'doux petit' }, 'Le test avec une clé envoie une toute petite demande, qui coûte une fraction de centime.'),
        test.message && h('p', { className: test.etat === 'erreur' ? 'erreur' : test.etat === 'ok' ? 'ok' : 'doux', role: 'status' }, test.message)),
      h(Carte, { titre: 'Mise en place, une seule fois', sousTitre: 'Quelques minutes. Les intitulés de la console peuvent légèrement varier.' },
        h('ol', { className: 'guide' }, GUIDES_IA[fournisseur].map((morceaux, i) => h('li', { key: fournisseur + i }, ...morceaux))),
        h('p', { className: 'doux petit' }, 'Ne colle jamais cette clé dans une conversation ni dans ton dépôt public. Si elle fuit, supprime-la sur la console et crées-en une autre.')));
  }

  /* ================================================================== */
  /* 8. Application                                                      */
  /* ================================================================== */

  function useModeSysteme() {
    const requete = () => (racine.matchMedia ? racine.matchMedia('(prefers-color-scheme: dark)') : null);
    const [sombre, setSombre] = useState(() => !!(requete() && requete().matches));
    useEffect(() => {
      const r = requete();
      if (!r) return undefined;
      const changer = () => setSombre(r.matches);
      if (r.addEventListener) r.addEventListener('change', changer); else if (r.addListener) r.addListener(changer);
      return () => { if (r.removeEventListener) r.removeEventListener('change', changer); else if (r.removeListener) r.removeListener(changer); };
    }, []);
    return sombre;
  }

  const CLE_CONFIG = 'postsop-github';
  const lireConfig = () => { try { return JSON.parse(racine.localStorage.getItem(CLE_CONFIG)) || null; } catch (e) { return null; } };
  const lireApparence = () => { try { return racine.localStorage.getItem('postsop-apparence') || 'auto'; } catch (e) { return 'auto'; } };

  const CHEMINS_RESSOURCES = { light: 'ressources/police-light', bold: 'ressources/police-bold', lightItalic: 'ressources/police-light-italique', boldItalic: 'ressources/police-bold-italique', logo: 'ressources/logo', logoClair: 'ressources/logo-clair', fleurs: 'ressources/fleurs' };
  const lirePreferencesBibliotheque = () => { try { return { ...ETAT_INITIAL.bibliotheque, ...(JSON.parse(racine.localStorage.getItem('postsop-bibliotheque')) || {}) }; } catch (e) { return ETAT_INITIAL.bibliotheque; } };

  function chargerImage(blob) {
    return new Promise((resoudre, rejeter) => {
      const image = new Image();
      image.onload = () => resoudre(image);
      image.onerror = () => rejeter(new Error('image illisible (utilise un PNG ou un SVG)'));
      image.src = URL.createObjectURL(blob);
    });
  }
  const versTampon = (octets) => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
  // Le paragraphe en cours d'édition s'affiche avec tes vraies polices : on les déclare au navigateur.
  const POLICES_CSS = {};
  function enregistrerPoliceCSS(role, octets) {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
    const [poids, style] = { light: ['300', 'normal'], bold: ['700', 'normal'], lightItalic: ['300', 'italic'], boldItalic: ['700', 'italic'] }[role] || ['400', 'normal'];
    try {
      const police = new FontFace('PostsOP Gill', versTampon(octets), { weight: poids, style });
      police.load().then(() => { if (POLICES_CSS[role]) document.fonts.delete(POLICES_CSS[role]); document.fonts.add(police); POLICES_CSS[role] = police; }).catch(() => {});
    } catch (e) { /* police illisible par le navigateur : l'édition utilise une police proche */ }
  }

  // Récupère les polices et images importées dans la maquette ou le banc d'essai, une seule fois.
  async function lireAncienneBase(nom, magasin, cle) {
    if (typeof indexedDB === 'undefined') return undefined;
    return new Promise((resoudre) => {
      const r = indexedDB.open(nom);
      r.onerror = () => resoudre(undefined);
      r.onsuccess = () => {
        const base = r.result;
        if (!base.objectStoreNames.contains(magasin)) { base.close(); resoudre(undefined); return; }
        const g = base.transaction(magasin).objectStore(magasin).get(cle);
        g.onsuccess = () => { resoudre(g.result); base.close(); };
        g.onerror = () => { resoudre(undefined); base.close(); };
      };
    });
  }

  function App({ etatInitial }) {
    const [etat, dispatch] = useReducer(reducteur, etatInitial || { ...ETAT_INITIAL, apparence: lireApparence(), bibliotheque: lirePreferencesBibliotheque() });
    const systemeSombre = useModeSysteme();
    const [contexte, setContexte] = useState(() => ({ choisirPolice: fabriquerChoix(etat.polices), version: 0, images: etat.images, reglages: etat.projet.reglages, charte: etat.projet.charte }));
    const etatRef = useRef(etat);
    etatRef.current = etat;
    const depotRef = useRef(null);
    const enregistre = useRef({ articles: new Map(), projet: null });
    const ecritures = useRef(Promise.resolve());
    const synchroEnCours = useRef(false);
    const minuterie = useRef(null);

    useEffect(() => {
      setContexte((c) => ({ choisirPolice: fabriquerChoix(etat.polices), version: c.version + 1, images: etat.images, reglages: etat.projet.reglages, charte: etat.projet.charte }));
    }, [etat.polices.light, etat.polices.bold, etat.polices.lightItalic, etat.polices.boldItalic, etat.images.logo, etat.images.logoClair, etat.images.fleurs, etat.projet.reglages, etat.projet.charte]);

    useEffect(() => { try { racine.localStorage.setItem('postsop-apparence', etat.apparence); } catch (e) { /* indisponible */ } }, [etat.apparence]);
    useEffect(() => { try { racine.localStorage.setItem('postsop-bibliotheque', JSON.stringify(etat.bibliotheque)); } catch (e) { /* indisponible */ } }, [etat.bibliotheque]);

    /* ---------- Enregistrement local ---------- */

    function retenirCommeEnregistre(donnees) {
      enregistre.current = { articles: new Map(donnees.articles.map((a) => [a.id, JSON.stringify(a)])), projet: JSON.stringify(normaliserProjet(donnees.projet)) };
    }
    function persister() {
      const depot = depotRef.current;
      const e = etatRef.current;
      if (!depot || !e.pret) return ecritures.current;
      const travaux = [];
      const vus = new Set();
      for (const a of e.articles) {
        vus.add(a.id);
        const json = JSON.stringify(a);
        if (enregistre.current.articles.get(a.id) !== json) { enregistre.current.articles.set(a.id, json); travaux.push(() => depot.ecrireJSON(`articles/${a.id}.json`, a)); }
      }
      for (const id of [...enregistre.current.articles.keys()]) if (!vus.has(id)) { enregistre.current.articles.delete(id); travaux.push(() => depot.supprimer(`articles/${id}.json`)); }
      const pj = JSON.stringify(e.projet);
      if (pj !== enregistre.current.projet) { enregistre.current.projet = pj; travaux.push(() => depot.ecrireJSON('projet.json', e.projet)); }
      if (travaux.length) {
        ecritures.current = ecritures.current.then(async () => { for (const t of travaux) await t(); })
          .catch((erreur) => dispatch({ type: 'message', message: 'Enregistrement impossible sur cet appareil : ' + erreur.message }));
        planifierSynchro(4000);
      }
      return ecritures.current;
    }
    useEffect(() => {
      if (!etat.pret) return undefined;
      const id = setTimeout(persister, 400);
      return () => clearTimeout(id);
    }, [etat.articles, etat.projet, etat.pret]);

    /* ---------- Ressources ---------- */

    async function appliquerRessources(donnees) {
      const r = donnees.ressources;
      const infos = (donnees.projet && donnees.projet.ressources) || {};
      for (const role of ['light', 'bold', 'lightItalic', 'boldItalic']) {
        const octets = r[CHEMINS_RESSOURCES[role]];
        if (octets && typeof opentype !== 'undefined') {
          try { dispatch({ type: 'polices', polices: { [role]: opentype.parse(versTampon(octets)) } }); } catch (e) { /* police illisible : rendu approché */ }
          enregistrerPoliceCSS(role, octets);
        }
      }
      for (const cle of ['logo', 'logoClair', 'fleurs']) {
        const octets = r[CHEMINS_RESSOURCES[cle]];
        if (octets) {
          try { dispatch({ type: 'images', images: { [cle]: await chargerImage(new Blob([octets], { type: (infos[cle] && infos[cle].type) || 'image/png' })) } }); } catch (e) { /* image illisible */ }
        }
      }
    }

    async function recharger() {
      await persister();
      const donnees = await depotRef.current.lireTout();
      retenirCommeEnregistre(donnees);
      dispatch({ type: 'charger', articles: donnees.articles, projet: donnees.projet });
      await appliquerRessources(donnees);
    }

    /* ---------- Synchronisation ---------- */

    async function synchroniser() {
      const depot = depotRef.current;
      if (!depot) return;
      if (!depot.estConfigure()) { dispatch({ type: 'synchro', synchro: { statut: 'non-configure', attente: await depot.changementsEnAttente() } }); return; }
      if (racine.navigator && racine.navigator.onLine === false) { dispatch({ type: 'synchro', synchro: { statut: 'hors-ligne', attente: await depot.changementsEnAttente() } }); return; }
      if (synchroEnCours.current) return;
      synchroEnCours.current = true;
      dispatch({ type: 'synchro', synchro: { statut: 'en-cours', detail: '' } });
      try {
        await persister();
        const rapport = await depot.synchroniser();
        if (rapport.recus || rapport.supprimes || rapport.conflits.length) await recharger();
        dispatch({ type: 'synchro', synchro: { statut: rapport.conflits.length ? 'conflit' : 'a-jour', derniere: maintenant(), attente: await depot.changementsEnAttente(), conflits: rapport.conflits, detail: '' } });
        if (rapport.conflits.length) dispatch({ type: 'message', message: 'Un article avait été modifié sur deux appareils : les deux versions sont gardées. Détails dans Configuration › Synchronisation.' });
      } catch (erreur) {
        dispatch({ type: 'synchro', synchro: { statut: erreur.code === 'reseau' ? 'hors-ligne' : 'erreur', detail: erreur.message, attente: await depot.changementsEnAttente() } });
      } finally {
        synchroEnCours.current = false;
      }
    }
    function planifierSynchro(delai) {
      clearTimeout(minuterie.current);
      minuterie.current = setTimeout(synchroniser, delai);
    }

    const actions = {
      lireConfig,
      synchroniser,
      async configurerSynchro(config) {
        const client = S.creerClientGitHub(config);
        const infos = await client.tester();
        if (!infos.prive) throw new Error('Ce dépôt est public : tes articles et tes polices seraient visibles par tous. Passe-le en privé dans ses réglages GitHub, puis réessaie.');
        if (!infos.ecriture) throw new Error('La clé ne permet pas d’écrire dans ce dépôt : vérifie la permission « Contents : Read and write ».');
        racine.localStorage.setItem(CLE_CONFIG, JSON.stringify(config));
        depotRef.current.configurer(client);
        if (await depotRef.current.distantContientDesArticles()) await depotRef.current.oublierNonSynchronises();
        await synchroniser();
        await recharger();
        const donnees = await depotRef.current.lireTout();
        if (!donnees.projet) await depotRef.current.ecrireJSON('projet.json', etatRef.current.projet);
        return `Connecté à ${infos.nom}, dépôt privé. Synchronisation activée sur cet appareil.`;
      },
      oublierSynchro() {
        racine.localStorage.removeItem(CLE_CONFIG);
        depotRef.current.configurer(null);
        dispatch({ type: 'synchro', synchro: { statut: 'non-configure', detail: '' } });
      },
      async importerRessource(cle, fichier) {
        const octets = new Uint8Array(await fichier.arrayBuffer());
        if (cle === 'light' || cle === 'bold' || cle === 'lightItalic' || cle === 'boldItalic') {
          if (typeof opentype === 'undefined') throw new Error('lecteur de polices indisponible (connexion ?)');
          let police;
          try { police = opentype.parse(versTampon(octets)); } catch (e) { throw new Error('fichier illisible : utilise un .ttf ou un .otf'); }
          dispatch({ type: 'polices', polices: { [cle]: police } });
          enregistrerPoliceCSS(cle, octets);
        } else {
          dispatch({ type: 'images', images: { [cle]: await chargerImage(new Blob([octets], { type: fichier.type || 'image/png' })) } });
        }
        await depotRef.current.ecrireBinaire(CHEMINS_RESSOURCES[cle], octets);
        dispatch({ type: 'projet', maj: (p) => ({ ...p, ressources: { ...(p.ressources || {}), [cle]: { nom: fichier.name, type: fichier.type || '' } } }) });
        planifierSynchro(1500);
        return `${fichier.name} importé${depotRef.current.estConfigure() ? ' : il sera envoyé sur tes autres appareils.' : '.'}`;
      },
    };

    /* ---------- Démarrage ---------- */

    useEffect(() => {
      if (etatInitial) return undefined;
      let actif = true;
      (async () => {
        const magasin = typeof indexedDB !== 'undefined' ? S.creerMagasinIndexedDB() : S.creerMagasinMemoire();
        const config = lireConfig();
        const depot = S.creerDepot({ magasin, client: config ? S.creerClientGitHub(config) : null });
        depotRef.current = depot;
        let donnees = await depot.lireTout();
        if (!donnees.projet) {
          // Première ouverture sur cet appareil : charte d'origine et article d'exemple, sans créer de faux conflit.
          await depot.ecrireJSON('projet.json', PROJET_DEFAUT, { initial: true });
          if (!donnees.articles.length) await depot.ecrireJSON(`articles/${EXEMPLE.id}.json`, EXEMPLE, { initial: true });
          donnees = await depot.lireTout();
        }
        // Reprise des polices et images importées dans la maquette ou le banc d'essai.
        const infos = { ...(donnees.projet.ressources || {}) };
        let repris = false;
        for (const [cle, ancienne] of [['light', 'police-light'], ['bold', 'police-bold'], ['logo', 'image-logo'], ['fleurs', 'image-fleurs']]) {
          if (donnees.ressources[CHEMINS_RESSOURCES[cle]]) continue;
          const trouvee = (await lireAncienneBase('postsop', 'ressources', ancienne)) || (cle === 'light' || cle === 'bold' ? await lireAncienneBase('contentshelper-phase0', 'kv', ancienne) : undefined);
          if (!trouvee) continue;
          const octets = trouvee.octets ? new Uint8Array(trouvee.octets) : new Uint8Array(await trouvee.blob.arrayBuffer());
          await depot.ecrireBinaire(CHEMINS_RESSOURCES[cle], octets);
          infos[cle] = { nom: trouvee.nom, type: trouvee.blob ? trouvee.blob.type : '' };
          repris = true;
        }
        if (repris) { await depot.ecrireJSON('projet.json', { ...donnees.projet, ressources: infos }); donnees = await depot.lireTout(); }
        if (!actif) return;
        retenirCommeEnregistre(donnees);
        dispatch({ type: 'charger', articles: donnees.articles, projet: donnees.projet });
        await appliquerRessources(donnees);
        synchroniser();
      })().catch((erreur) => dispatch({ type: 'message', message: 'Ouverture impossible : ' + erreur.message }));

      const enLigne = () => planifierSynchro(500);
      const visible = () => { if (document.visibilityState === 'visible') planifierSynchro(500); };
      const intervalle = setInterval(() => synchroniser(), 120000);
      racine.addEventListener('online', enLigne);
      document.addEventListener('visibilitychange', visible);
      return () => { actif = false; clearInterval(intervalle); racine.removeEventListener('online', enLigne); document.removeEventListener('visibilitychange', visible); };
    }, []);

    /* ---------- Raccourcis : ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y ---------- */

    useEffect(() => {
      if (typeof document === 'undefined') return undefined;
      const touche = (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'annuler' }); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); dispatch({ type: 'retablir' }); }
      };
      document.addEventListener('keydown', touche);
      return () => document.removeEventListener('keydown', touche);
    }, []);

    const mode = etat.apparence === 'auto' ? (systemeSombre ? 'sombre' : 'clair') : etat.apparence;
    const ecrans = { bibliotheque: Bibliotheque, atelier: Atelier, configuration: Configuration };
    return h(Contexte.Provider, { value: contexte },
      h('div', { className: 'app theme-' + mode },
        etat.pret ? h(ecrans[etat.ecran], { etat, dispatch, actions }) : h('div', { className: 'chargement gill' }, 'Chargement de tes articles…')));
  }

  // Si une erreur imprévue survient, on l'affiche au lieu d'une page blanche.
  class Filet extends Component {
    constructor(props) { super(props); this.state = { erreur: null }; }
    static getDerivedStateFromError(erreur) { return { erreur }; }
    render() {
      if (!this.state.erreur) return this.props.children;
      return h('div', { className: 'erreur-globale' }, h('h1', null, 'Une erreur est survenue'), h('p', null, String(this.state.erreur && this.state.erreur.message)),
        h('p', null, 'Tes données sont enregistrées sur cet appareil. Recharge la page ; si l’erreur revient, envoie-moi une capture.'), h('button', { type: 'button', onClick: () => racine.location.reload() }, 'Recharger'));
    }
  }

  const api = { App, Filet, reducteur, OP, normaliserProjet, trierArticles, appliquerModele, ETAT_INITIAL, PROJET_DEFAUT, EXEMPLE, REGLAGES_DEFAUT, verifierLisibilite, contraste, extraitAvecMarque, fabriquerChoix };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    racine.addEventListener('DOMContentLoaded', () => {
      const conteneur = document.getElementById('racine');
      if (!racine.React || !racine.ReactDOM) { conteneur.textContent = 'Impossible de charger React : vérifie ta connexion Internet, puis recharge la page.'; return; }
      racine.ReactDOM.createRoot(conteneur).render(h(Filet, null, h(App)));
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
