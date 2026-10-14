/*
 * PostsOP — maquette v2
 *
 * Réel : rendu des slides et des 11 gabarits, contrôles qualité, découpage sans IA,
 * « Proposer une autre présentation », LanguageTool, import des polices, du logo et des fleurs,
 * modes clair / sombre / automatique.
 * Simulé : propositions éditoriales de l'IA, descriptions, traduction, export.
 * Rien n'est enregistré, sauf tes polices, tes images et ton choix d'apparence.
 */
(function (racine) {
  'use strict';

  const React = racine.React || require('react');
  const M = racine.PostsOPMoteur || require('./moteur.js');
  const { createElement: h, Fragment, useState, useReducer, useEffect, useRef, useContext, createContext } = React;

  const NB = '\u00A0';
  const cls = (...noms) => noms.filter(Boolean).join(' ');

  /* ================================================================== */
  /* 1. Données d'exemple                                                */
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

  const SLIDES_CLARA = [
    { role: 'Couverture', gabarit: 'V1', blocs: [{ style: 'titre', texte: 'Je crois que\nje vais\ndémissionner.' }, { style: 'contrepoint', texte: 'Pourtant,\nj’adore mon\ntravail.' }] },
    { role: 'Contexte', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[1] }, { style: 'corps', texte: P[2] }, { style: 'corps', texte: P[3] }, { style: 'citation', texte: P[4] }] },
    { role: 'Bascule', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[5] }, { style: 'corps', texte: P[6] }, { style: 'emphase', texte: P[7] }] },
    { role: 'Révélation', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[8] }, { style: 'citation', texte: P[9] }] },
    { role: 'Enseignement', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[10] }, { style: 'citation', texte: P[11] }, { style: 'corps', texte: P[12] }, { style: 'emphase', texte: P[13] }] },
    { role: 'Conclusion', gabarit: 'T1', blocs: [{ style: 'corps', texte: P[14] }], signature: true },
  ];

  // Traduction simulée de deux slides, pour montrer l'affichage côte à côte.
  const SLIDES_CLARA_EN = [
    { role: 'Couverture', gabarit: 'V1', blocs: [{ style: 'titre', texte: 'I think\nI’m going\nto quit.' }, { style: 'contrepoint', texte: 'And yet,\nI love\nmy job.' }] },
    { role: 'Contexte', gabarit: 'T1', blocs: [{ style: 'corps', texte: 'That’s what Clara, 32, told me during our first session.' }, { style: 'corps', texte: 'For a few months now, her manager has barely spoken to her.' }, { style: 'corps', texte: 'No open conflict, no criticism. Just increasingly cold emails, meetings she’s no longer invited to, and decisions she learns about after everyone else.' }, { style: 'citation', texte: '“The worst part is, I don’t even know what I did wrong.”' }] },
  ];

  const FICHE = (selection, pertinence, objectif, message, poids, traitement, risques) => ({ selection, pertinence, objectif, message, poids, traitement, risques });

  const PROPOSITIONS_CLARA = {
    comprehension: {
      sujet: 'Un malentendu entre une salariée et son manager, nourri par le silence.',
      message: 'Le silence laisse place à nos peurs ; une conversation courageuse peut éviter une rupture.',
      intention: 'Faire réfléchir salariés et managers, en illustrant l’accompagnement par un cas réel.',
      ton: 'Récit sobre et bienveillant, à la première personne.',
    },
    accroches: [
      {
        id: 'a1',
        blocs: [{ style: 'titre', texte: 'Je crois que\nje vais\ndémissionner.' }, { style: 'contrepoint', texte: 'Pourtant,\nj’adore mon\ntravail.' }],
        fiche: FICHE('« Je crois que je vais démissionner. Pourtant, j’adore mon travail. » (ouverture de l’article)', 'C’est une parole de cliente qui contient un paradoxe.', 'Arrêter le défilement par une contradiction qui appelle une explication.', 'Le malaise au travail ne vient pas toujours du travail lui-même.', 'Le paradoxe tient en deux temps : la couleur sépare le constat du contrepoint.', 'Titre en Bold, contrepoint dans la couleur de mise en valeur.', 'Aucun : c’est la première phrase de l’article, inchangée.'),
      },
      {
        id: 'a2',
        blocs: [{ style: 'titre', texte: 'Le silence\nlaisse rarement\nun vide.' }],
        fiche: FICHE('« Le silence laisse rarement un vide. » (slide 5)', 'C’est l’enseignement général du récit.', 'Promettre une idée transposable plutôt qu’une histoire.', 'Ce carrousel parle de ce que l’on imagine quand personne ne parle.', 'Phrase courte et frappante, lisible en miniature.', 'Titre en Bold, une seule couleur.', 'La première phrase de l’article ne figurerait plus dans aucune slide : l’outil le signalera, car tout le texte doit être dans le carrousel.'),
      },
      {
        id: 'a3',
        blocs: [{ style: 'titre', texte: `«${NB}On vivait\ndeux histoires\ncomplètement\ndifférentes${NB}!${NB}»` }],
        fiche: FICHE('« On vivait deux histoires complètement différentes ! » (slide 4)', 'C’est la phrase de la bascule, dite par la cliente.', 'Susciter la curiosité sur le malentendu.', 'Deux personnes peuvent vivre la même situation de façons opposées.', 'Citation directe, plus intime qu’un énoncé général.', 'Titre en Bold, entre guillemets.', 'Sortie de son contexte, la citation peut sembler parler d’un couple. Et la première phrase de l’article ne figurerait plus dans les slides.'),
      },
    ],
    misesEnAvant: [
      {
        id: 'm1', slide: 2, statut: 'proposee', cibles: [{ slide: 2, bloc: 2 }], style: 'emphase',
        fiche: FICHE('« Et là, surprise. »', 'C’est la bascule du récit : tout ce qui précède est relu à sa lumière.', 'Finir la slide sur le retournement, pour donner envie de glisser vers la suite.', 'Ce que Clara croyait n’était pas la réalité.', 'Phrase courte et isolée : en gras, elle crée une respiration.', 'Phrase-choc en Bold, à la taille du texte.', 'Aucun : la formule est la tienne, inchangée.'),
      },
      {
        id: 'm2', slide: 4, statut: 'proposee', cibles: [{ slide: 4, bloc: 3 }], style: 'emphase',
        fiche: FICHE('« Le silence laisse rarement un vide. Notre cerveau s’empresse de le remplir, souvent avec nos propres peurs. »', 'C’est l’enseignement général tiré du cas.', 'Permettre au lecteur de transposer l’histoire à sa propre situation.', 'Nos interprétations du silence parlent souvent de nos peurs.', 'C’est la phrase que le lecteur doit retenir et pouvoir citer.', 'Phrase-choc en Bold.', '« souvent » nuance l’affirmation : à conserver tel quel.'),
      },
      {
        id: 'm3', slide: 1, statut: 'proposee', cibles: [{ slide: 1, bloc: 3 }, { slide: 3, bloc: 1 }, { slide: 4, bloc: 1 }], style: 'citation',
        fiche: FICHE('Les trois citations de Clara (slides 2, 4 et 5)', 'Elles donnent la voix de la cliente et rendent le récit crédible.', 'Faire entendre le vécu, pas seulement le raconter.', 'Ce sont ses mots, pas une interprétation.', 'Elles rythment le récit : une citation par temps fort.', 'Citation : verte sur fond bleu, avec un filet sur les fonds clairs.', 'Vérifie que le prénom est modifié et que la cliente a donné son accord.'),
      },
    ],
    ponctuation: [
      {
        id: 'p1', slide: 2, ancien: 'Et là, surprise.', statut: 'proposee',
        options: [
          { texte: 'Et là… surprise.', pourquoi: 'Les points de suspension créent une attente juste avant la révélation de la slide suivante.' },
          { texte: `Et là, surprise${NB}:`, pourquoi: 'Les deux-points annoncent une suite et invitent à glisser.' },
        ],
      },
    ],
  };

  const DESCRIPTIONS_CLARA = {
    instagram: { fr: `«${NB}Je crois que je vais démissionner. Pourtant, j’adore mon travail.${NB}»\n\nLe silence d’un manager peut laisser place à toutes nos peurs. L’histoire de Clara montre qu’une conversation courageuse peut tout changer.\n\nEt vous, avez-vous déjà interprété un silence au travail${NB}?`, en: '' },
    linkedin: { fr: `«${NB}Je crois que je vais démissionner. Pourtant, j’adore mon travail.${NB}»\n\nC’est ce que me confiait Clara lors de notre première séance. Son manager ne lui parlait presque plus, et elle ne savait pas pourquoi.\n\nLe silence laisse rarement un vide${NB}: notre cerveau s’empresse de le remplir, souvent avec nos propres peurs.\n\nSon histoire, en 6 slides.`, en: '' },
  };

  const DESCRIPTIONS_VIDES = { instagram: { fr: '', en: '' }, linkedin: { fr: '', en: '' } };

  const ARTICLES_INITIAUX = [
    { id: 'clara', titre: 'Le silence au travail', statut: 'Prêt', reseau: 'instagram', format: 'carre', fond: 'bleu', langues: ['fr', 'en'], modifie: '11 oct.', texte: P, slides: SLIDES_CLARA, slidesEn: SLIDES_CLARA_EN, propositions: PROPOSITIONS_CLARA, accroche: 'a1', descriptions: DESCRIPTIONS_CLARA },
    {
      id: 'ex1', titre: 'Exemple · Prévenir les conflits', statut: 'Brouillon', reseau: 'linkedin', format: 'portrait', fond: 'blanc', langues: ['fr'], modifie: '9 oct.',
      texte: ['Prévenir les conflits et renouer un dialogue constructif.', 'Équipes, managers, dirigeants : elle aide chacun à retrouver de l’efficacité, du plaisir et du sens dans le cadre de sa mission et de sa place au sein de l’entreprise.'],
      slides: [
        { role: 'Couverture', gabarit: 'V2', blocs: [{ style: 'titre', texte: 'Prévenir les conflits' }, { style: 'contrepoint', texte: 'et renouer un dialogue constructif.' }] },
        { role: 'Conclusion', gabarit: 'T1', blocs: [{ style: 'corps', texte: 'Équipes, managers, dirigeants : elle aide chacun à retrouver de l’efficacité, du plaisir et du sens dans le cadre de sa mission et de sa place au sein de l’entreprise.' }], signature: true },
      ],
      slidesEn: [], propositions: null, accroche: null, descriptions: DESCRIPTIONS_VIDES,
    },
    {
      id: 'ex2', titre: 'Exemple · Gérer ses émotions', statut: 'Exporté', reseau: 'instagram', format: 'carre', fond: 'vert', langues: ['fr'], modifie: '2 oct.',
      texte: ['Savoir gérer ses émotions.', 'Dépasser son stress pour gagner en efficacité.'],
      slides: [
        { role: 'Couverture', gabarit: 'V3', blocs: [{ style: 'titre', texte: 'Savoir gérer' }, { style: 'contrepoint', texte: 'ses émotions.' }] },
        { role: 'Conclusion', gabarit: 'T2', blocs: [{ style: 'emphase', texte: 'Dépasser son stress pour gagner en efficacité.' }], signature: true },
      ],
      slidesEn: [], propositions: null, accroche: null, descriptions: DESCRIPTIONS_VIDES,
    },
  ];

  const lireApparence = () => {
    try { return (racine.localStorage && racine.localStorage.getItem('postsop-apparence')) || 'auto'; } catch (e) { return 'auto'; }
  };

  const REGLAGES_INITIAUX = {
    apparence: 'auto', automatisation: 'hybride', rythme: 'equilibre', motsMax: 90, depassement: 'demander', intensite: 'minimale',
    numero: false, glisser: false, logoPartout: false, longueurDescription: 'moyenne',
    reseauDefaut: 'instagram', formatDefaut: 'carre', resolution: '2', pdfTexte: 'traces', ia: 'aucun', rappelSauvegarde: 'hebdomadaire',
  };

  const ETAPES = [
    { id: 'texte', nom: 'Texte' },
    { id: 'structure', nom: 'Structure' },
    { id: 'design', nom: 'Design' },
    { id: 'description', nom: 'Description' },
    { id: 'export', nom: 'Export' },
  ];

  const AIDES = {
    bibliotheque: { titre: 'Tes articles', textes: ['Chaque article devient un carrousel. Touche une carte pour l’ouvrir.', '« Nouvel article » crée un carrousel à partir d’un texte collé. « Modifier » permet de réordonner ou de supprimer des articles.'] },
    configuration: { titre: 'La configuration', textes: ['Charte : tes couleurs, tes gabarits, tes polices et tes règles. L’outil les applique partout.', 'Ressources : tes polices, ton logo et tes fleurs, gardés sur cet iPad.', 'Réglages : le comportement de l’outil. Chaque réglage explique son effet.'] },
    texte: { titre: 'Étape 1 · Texte', textes: ['Tu relis et corriges ton article avant de le mettre en slides.', 'La typographie se corrige seule. L’orthographe se vérifie avec LanguageTool : chaque correction attend ton accord, et « Montrer » la sélectionne dans le texte.', 'Les suggestions de style portent soit sur le passage que tu as sélectionné, soit sur tout l’article.'] },
    structure: { titre: 'Étape 2 · Structure', textes: ['L’outil propose comment répartir ton texte en slides, quelle accroche mettre en couverture et quels passages mettre en valeur.', 'Accepter garde la mise en valeur proposée. Refuser remet le passage en texte courant. Tu vois l’effet dans l’étape Design.'] },
    design: { titre: 'Étape 3 · Design', textes: ['Tu choisis l’apparence du carrousel, puis tu ajustes chaque slide. Ce que tu vois ici est exactement ce qui sera exporté.', 'Changer de gabarit ne modifie jamais ton texte : essaie-les librement.', '« Proposer une autre présentation » choisit un fond et des gabarits différents de tes derniers articles, toujours dans ta charte.'] },
    description: { titre: 'Étape 4 · Description', textes: ['Le texte qui accompagne le carrousel : légende Instagram et texte du post LinkedIn.', 'Il complète le carrousel au lieu de le répéter, sans aucun fait absent de l’article.'] },
    export: { titre: 'Étape 5 · Export', textes: ['Les fichiers à publier : des images PNG pour Instagram, un PDF pour LinkedIn.', 'Tant qu’un point bloquant reste à régler, l’export attend. Touche « Corriger » pour aller directement à l’endroit concerné.'] },
  };

  const ETAT_INITIAL = {
    ecran: 'bibliotheque', articleId: null, etape: 'texte', langue: 'fr', slide: 0,
    onglet: 'charte', feuille: null, aide: false, message: null, edition: false,
    articles: ARTICLES_INITIAUX, reglages: REGLAGES_INITIAUX,
    polices: { light: null, bold: null, noms: {} },
    ressources: { logo: null, fleurs: null, noms: {} },
  };

  /* ================================================================== */
  /* 2. État                                                             */
  /* ================================================================== */

  const majArticle = (etat, id, maj) => ({ ...etat, articles: etat.articles.map((a) => (a.id === id ? maj(a) : a)) });

  function reducteur(etat, action) {
    switch (action.type) {
      case 'ecran': return { ...etat, ecran: action.ecran, feuille: null, message: null, aide: false, edition: false };
      case 'ouvrir': return { ...etat, ecran: 'atelier', articleId: action.id, etape: 'texte', slide: 0, langue: 'fr', message: null, aide: false };
      case 'etape': return { ...etat, etape: action.etape, message: null };
      case 'aller': return { ...etat, etape: action.etape, slide: action.slide == null ? etat.slide : action.slide, message: null };
      case 'langue': return { ...etat, langue: action.langue };
      case 'slide': return { ...etat, slide: action.index };
      case 'onglet': return { ...etat, onglet: action.onglet };
      case 'feuille': return { ...etat, feuille: action.feuille };
      case 'aide': return { ...etat, aide: action.ouverte == null ? !etat.aide : action.ouverte };
      case 'message': return { ...etat, message: action.message };
      case 'edition': return { ...etat, edition: !etat.edition };
      case 'article': return majArticle(etat, action.id, action.maj);
      case 'reglage': return { ...etat, reglages: { ...etat.reglages, [action.cle]: action.valeur } };
      case 'polices': return { ...etat, polices: { ...etat.polices, ...action.polices, noms: { ...etat.polices.noms, ...(action.noms || {}) } } };
      case 'ressources': return { ...etat, ressources: { ...etat.ressources, ...action.ressources, noms: { ...etat.ressources.noms, ...(action.noms || {}) } } };
      case 'creer': return { ...etat, articles: [action.article, ...etat.articles], ecran: 'atelier', articleId: action.article.id, etape: 'structure', slide: 0, feuille: null, langue: 'fr' };
      case 'dupliquer': {
        const source = etat.articles.find((a) => a.id === action.id);
        const copie = { ...source, id: source.id + '-copie-' + Date.now(), titre: source.titre + ' (copie)', statut: 'Brouillon', modifie: 'à l’instant' };
        const articles = [...etat.articles];
        articles.splice(etat.articles.indexOf(source) + 1, 0, copie);
        return { ...etat, articles };
      }
      case 'supprimerArticle': return { ...etat, articles: etat.articles.filter((a) => a.id !== action.id), feuille: null };
      case 'deplacerArticle': {
        const i = etat.articles.findIndex((a) => a.id === action.id);
        const j = i + action.delta;
        if (i < 0 || j < 0 || j >= etat.articles.length) return etat;
        const articles = [...etat.articles];
        [articles[i], articles[j]] = [articles[j], articles[i]];
        return { ...etat, articles };
      }
      default: return etat;
    }
  }

  const majSlide = (i, maj) => (a) => ({ ...a, slides: a.slides.map((s, k) => (k === i ? maj(s) : s)) });
  const remplacerDans = (texte, ancien, nouveau) => texte.split(ancien).join(nouveau);

  const OP = {
    deplacerSlide: (i, delta) => (a) => {
      const j = i + delta;
      if (j < 0 || j >= a.slides.length) return a;
      const slides = [...a.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...a, slides };
    },
    gabarit: (i, gabarit) => majSlide(i, (s) => ({ ...s, gabarit })),
    modifierBloc: (i, b, champs) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.map((bloc, n) => (n === b ? { ...bloc, ...champs } : bloc)) })),
    ajouterBloc: (i) => majSlide(i, (s) => ({ ...s, blocs: [...s.blocs, { style: 'corps', texte: '' }] })),
    supprimerBloc: (i, b) => majSlide(i, (s) => ({ ...s, blocs: s.blocs.filter((_, n) => n !== b) })),
    deplacerBloc: (i, b, delta) => majSlide(i, (s) => {
      const j = b + delta;
      if (j < 0 || j >= s.blocs.length) return s;
      const blocs = [...s.blocs];
      [blocs[b], blocs[j]] = [blocs[j], blocs[b]];
      return { ...s, blocs };
    }),
    champ: (cle, valeur) => (a) => ({ ...a, [cle]: valeur }),
    texte: (paragraphes) => (a) => ({ ...a, texte: paragraphes }),
    presentation: ({ fond, slides }) => (a) => ({ ...a, fond, slides }),
    accroche: (accroche) => (a) => ({ ...a, accroche: accroche.id, slides: a.slides.map((s, k) => (k === 0 ? { ...s, role: 'Couverture', blocs: accroche.blocs } : s)) }),
    // Accepter garde la mise en valeur ; refuser remet le passage en texte courant.
    statutMiseEnAvant: (id, statut) => (a) => {
      const m = a.propositions.misesEnAvant.find((x) => x.id === id);
      const style = statut === 'refusee' ? 'corps' : m.style;
      let article = { ...a, propositions: { ...a.propositions, misesEnAvant: a.propositions.misesEnAvant.map((x) => (x.id === id ? { ...x, statut } : x)) } };
      for (const c of m.cibles) {
        if (article.slides[c.slide] && article.slides[c.slide].blocs[c.bloc]) article = OP.modifierBloc(c.slide, c.bloc, { style })(article);
      }
      return article;
    },
    toutAccepter: () => (a) => a.propositions.misesEnAvant.filter((m) => m.statut === 'proposee').reduce((art, m) => OP.statutMiseEnAvant(m.id, 'acceptee')(art), a),
    // Une ponctuation acceptée change l'article ET les slides, pour qu'ils restent identiques.
    remplacerTexte: (ancien, nouveau) => (a) => ({
      ...a,
      texte: a.texte.map((p) => remplacerDans(p, ancien, nouveau)),
      slides: a.slides.map((s) => ({ ...s, blocs: s.blocs.map((b) => ({ ...b, texte: remplacerDans(b.texte, ancien, nouveau) })) })),
    }),
    statutPonctuation: (id, statut) => (a) => ({ ...a, propositions: { ...a.propositions, ponctuation: a.propositions.ponctuation.map((p) => (p.id === id ? { ...p, statut } : p)) } }),
    description: (reseau, langue, texte) => (a) => ({ ...a, descriptions: { ...a.descriptions, [reseau]: { ...a.descriptions[reseau], [langue]: texte } } }),
  };

  /* ================================================================== */
  /* 3. Stockage sur l'iPad : polices et images                          */
  /* ================================================================== */

  function ouvrirBase(nom, magasin) {
    return new Promise((resoudre, rejeter) => {
      const requete = indexedDB.open(nom, 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore(magasin);
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
  }
  async function lireBase(nom, magasin, cle) {
    const base = await ouvrirBase(nom, magasin);
    if (!base.objectStoreNames.contains(magasin)) return undefined;
    return new Promise((resoudre) => {
      const requete = base.transaction(magasin).objectStore(magasin).get(cle);
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => resoudre(undefined);
    });
  }
  async function ecrireBase(nom, magasin, cle, valeur) {
    const base = await ouvrirBase(nom, magasin);
    return new Promise((resoudre, rejeter) => {
      const transaction = base.transaction(magasin, 'readwrite');
      transaction.objectStore(magasin).put(valeur, cle);
      transaction.oncomplete = () => resoudre();
      transaction.onerror = () => rejeter(transaction.error);
    });
  }

  function chargerImage(blob) {
    return new Promise((resoudre, rejeter) => {
      const image = new Image();
      image.onload = () => resoudre(image);
      image.onerror = () => rejeter(new Error('image illisible'));
      image.src = URL.createObjectURL(blob);
    });
  }

  async function restaurer(dispatch) {
    if (typeof indexedDB === 'undefined') return;
    if (typeof opentype !== 'undefined') {
      for (const role of ['light', 'bold']) {
        try {
          const trouvee = (await lireBase('postsop', 'ressources', 'police-' + role)) || (await lireBase('contentshelper-phase0', 'kv', 'police-' + role));
          if (trouvee) dispatch({ type: 'polices', polices: { [role]: opentype.parse(trouvee.octets) }, noms: { [role]: trouvee.nom } });
        } catch (erreur) { /* rendu approché */ }
      }
    }
    for (const cle of ['logo', 'fleurs']) {
      try {
        const trouvee = await lireBase('postsop', 'ressources', 'image-' + cle);
        if (trouvee) dispatch({ type: 'ressources', ressources: { [cle]: await chargerImage(trouvee.blob) }, noms: { [cle]: trouvee.nom } });
      } catch (erreur) { /* emplacement en pointillés */ }
    }
  }

  const Contexte = createContext({ choisirPolice: null, version: 0, ressources: {}, reglages: REGLAGES_INITIAUX });

  function fabriquerChoix(polices) {
    const systeme = {};
    return (role) => {
      if (polices[role]) return M.policeExacte(polices[role]);
      if (!systeme[role]) systeme[role] = M.policeSysteme(role === 'bold' ? 700 : 300);
      return systeme[role];
    };
  }

  /* ================================================================== */
  /* 4. Composants de base                                               */
  /* ================================================================== */

  const TRACES = {
    retour: 'M15 5l-7 7 7 7',
    plus: 'M12 5v14M5 12h14',
    gauche: 'M14 6l-6 6 6 6',
    droite: 'M10 6l6 6-6 6',
    haut: 'M6 14l6-6 6 6',
    bas: 'M6 10l6 6 6-6',
    fermer: 'M6 6l12 12M18 6L6 18',
    reglages: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    soleil: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    lune: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
    auto: 'M12 3a9 9 0 100 18V3z M12 3a9 9 0 010 18',
    baguette: 'M4 20l10-10M14 4v3M18.5 5.5l-2 2M20 10h-3M12 7l5 5',
    poubelle: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    oeil: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  };
  const Icone = ({ nom, taille = 20 }) => h('svg', { className: 'icone', width: taille, height: taille, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('path', { d: TRACES[nom], fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  function Bouton({ variante = 'secondaire', onClick, disabled, children, titre, etiquette }) {
    return h('button', { className: 'bouton ' + variante, onClick, disabled, title: titre, 'aria-label': etiquette, type: 'button' }, children);
  }

  function Segmente({ options, valeur, onChange, etiquette, petit }) {
    return h('div', { className: cls('segmente', petit && 'petit'), role: 'group', 'aria-label': etiquette },
      options.map((o) => h('button', {
        key: o.valeur, type: 'button', 'aria-pressed': o.valeur === valeur, 'aria-label': o.etiquette, title: o.etiquette,
        onClick: () => onChange(o.valeur),
      }, o.icone ? h(Icone, { nom: o.icone, taille: 18 }) : o.libelle)));
  }

  const Pastille = ({ ton = 'neutre', children }) => h('span', { className: 'pastille ' + ton }, children);

  // « i » : explication au survol avec le pointeur, ou au toucher.
  function Info({ texte }) {
    const [ouverte, setOuverte] = useState(false);
    return h('span', { className: cls('info', ouverte && 'ouverte') },
      h('button', { type: 'button', className: 'info-bouton', 'aria-label': 'Explication', onClick: () => setOuverte(!ouverte), onBlur: () => setOuverte(false) }, 'i'),
      h('span', { className: 'bulle', role: 'tooltip' }, texte));
  }

  function Carte({ titre, sousTitre, info, children, actions, classe }) {
    return h('section', { className: 'carte ' + (classe || '') },
      (titre || actions) && h('div', { className: 'carte-tete' },
        h('div', null,
          titre && h('h3', { className: 'gill' }, titre, info && h(Info, { texte: info })),
          sousTitre && h('p', { className: 'doux' }, sousTitre)),
        actions && h('div', { className: 'carte-actions' }, actions)),
      children);
  }

  function Ligne({ etiquette, aide, info, children }) {
    return h('div', { className: 'ligne-reglage' },
      h('div', { className: 'ligne-texte' },
        h('div', { className: 'ligne-etiquette' }, etiquette, info && h(Info, { texte: info })),
        aide && h('div', { className: 'doux petit' }, aide)),
      h('div', { className: 'ligne-controle' }, children));
  }

  function SlideCanvas({ slide, formatId, fondId, largeur, index = 0, total = 1, onClick, selectionnee, etiquette }) {
    const ref = useRef(null);
    const { choisirPolice, version, ressources, reglages } = useContext(Contexte);
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
      M.dessiner(ctx, M.composer(slide, formatId, fondId, choisirPolice, { index, total, reglages }), ressources);
    }, [slide, formatId, fondId, largeur, hauteur, version, choisirPolice, ressources, reglages, index, total]);
    const proprietes = { ref, 'aria-label': etiquette || 'Slide', className: cls('slide', selectionnee && 'selectionnee'), style: { width: largeur + 'px', height: hauteur + 'px' } };
    if (onClick) return h('button', { type: 'button', className: 'slide-bouton', onClick, 'aria-label': etiquette }, h('canvas', { ...proprietes, 'aria-label': undefined }));
    return h('canvas', { ...proprietes, role: 'img' });
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

  // Barre du haut, commune à tous les écrans.
  function Barre({ etat, dispatch, gauche, titre, langue }) {
    return h('header', { className: 'barre' },
      h('div', { className: 'barre-gauche' }, gauche),
      h('div', { className: 'barre-titre gill' }, titre),
      h('div', { className: 'barre-droite' },
        h(Segmente, {
          etiquette: 'Apparence', petit: true, valeur: etat.reglages.apparence, onChange: (v) => dispatch({ type: 'reglage', cle: 'apparence', valeur: v }),
          options: [{ valeur: 'clair', icone: 'soleil', etiquette: 'Mode clair' }, { valeur: 'sombre', icone: 'lune', etiquette: 'Mode sombre' }, { valeur: 'auto', icone: 'auto', etiquette: 'Automatique, comme l’iPad' }],
        }),
        langue && h(Segmente, { etiquette: 'Langue', petit: true, valeur: etat.langue, onChange: (l) => dispatch({ type: 'langue', langue: l }), options: [{ valeur: 'fr', libelle: 'FR' }, { valeur: 'en', libelle: 'EN' }] }),
        h('button', { type: 'button', className: cls('bouton-aide', etat.aide && 'actif'), 'aria-label': 'Aide sur cet écran', 'aria-expanded': etat.aide, onClick: () => dispatch({ type: 'aide' }) }, 'i')));
  }

  function PanneauAide({ cle, dispatch }) {
    const aide = AIDES[cle];
    if (!aide) return null;
    return h('div', { className: 'panneau-aide', role: 'dialog', 'aria-label': aide.titre },
      h('h3', { className: 'gill' }, aide.titre),
      aide.textes.map((t, i) => h('p', { key: i }, t)),
      h(Bouton, { onClick: () => dispatch({ type: 'aide', ouverte: false }) }, 'Compris'));
  }

  /* ================================================================== */
  /* 5. Bibliothèque                                                     */
  /* ================================================================== */

  const TON_STATUT = { Brouillon: 'neutre', Prêt: 'ok', Exporté: 'info' };

  function Bibliotheque({ etat, dispatch }) {
    const aSupprimer = etat.feuille && etat.feuille.supprimer ? etat.articles.find((a) => a.id === etat.feuille.supprimer) : null;
    return h(Fragment, null,
      h(Barre, {
        etat, dispatch, titre: '',
        gauche: h('span', { className: 'marque gill' }, 'PostsOP'),
      }),
      etat.aide && h(PanneauAide, { cle: 'bibliotheque', dispatch }),
      h('main', { className: 'contenu' },
        h('div', { className: 'tete-page' },
          h('h1', { className: 'gill' }, 'Articles'),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'icone', etiquette: 'Configuration', titre: 'Configuration', onClick: () => dispatch({ type: 'ecran', ecran: 'configuration' }) }, h(Icone, { nom: 'reglages' })),
            h(Bouton, { variante: etat.edition ? 'principal' : 'secondaire', onClick: () => dispatch({ type: 'edition' }) }, etat.edition ? 'Terminé' : 'Modifier'),
            h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'feuille', feuille: 'nouvel' }) }, h(Icone, { nom: 'plus' }), 'Nouvel article'))),
        etat.edition && h('p', { className: 'note' }, 'Mode modification : réordonne tes articles avec les flèches, ou supprime-les. Touche « Terminé » quand c’est fini.'),
        h('div', { className: 'grille-articles' },
          etat.articles.map((a, i) => h('article', { key: a.id, className: cls('carte-article', etat.edition && 'en-edition') },
            h('button', { type: 'button', className: 'carte-article-ouvrir', disabled: etat.edition, onClick: () => dispatch({ type: 'ouvrir', id: a.id }), 'aria-label': 'Ouvrir ' + a.titre },
              h('div', { className: 'vignette' }, h(SlideCanvas, { slide: a.slides[0], formatId: a.format, fondId: a.fond, largeur: 210, total: a.slides.length, etiquette: 'Couverture de ' + a.titre })),
              h('div', { className: 'carte-article-texte' },
                h('div', { className: 'carte-article-titre gill' }, a.titre),
                h('div', { className: 'doux petit' }, `${a.slides.length} slides · ${M.FORMATS[a.format].nom} · ${a.reseau === 'instagram' ? 'Instagram' : 'LinkedIn'}`),
                h('div', { className: 'carte-article-pied' },
                  h(Pastille, { ton: TON_STATUT[a.statut] }, a.statut),
                  h('span', { className: 'doux petit' }, a.langues.map((l) => l.toUpperCase()).join(' · ') + ' · ' + a.modifie)))),
            etat.edition
              ? h('div', { className: 'barre-edition' },
                h(Bouton, { variante: 'icone', etiquette: 'Avancer', disabled: i === 0, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: -1 }) }, h(Icone, { nom: 'gauche' })),
                h(Bouton, { variante: 'icone', etiquette: 'Reculer', disabled: i === etat.articles.length - 1, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: 1 }) }, h(Icone, { nom: 'droite' })),
                h(Bouton, { variante: 'danger', onClick: () => dispatch({ type: 'feuille', feuille: { supprimer: a.id } }) }, h(Icone, { nom: 'poubelle', taille: 18 }), 'Supprimer'))
              : h('div', { className: 'barre-edition' }, h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'dupliquer', id: a.id }) }, 'Dupliquer')))))),
      etat.feuille === 'nouvel' && h(FeuilleNouvelArticle, { etat, dispatch }),
      aSupprimer && h(Feuille, {
        titre: 'Supprimer cet article ?', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }),
        action: h(Bouton, { variante: 'danger plein', onClick: () => dispatch({ type: 'supprimerArticle', id: aSupprimer.id }) }, 'Supprimer'),
      }, h('p', null, `« ${aSupprimer.titre} » et son carrousel seront supprimés. Dans la maquette, rien n’est définitif : recharger la page le fait revenir.`)));
  }

  function Feuille({ titre, onAnnuler, action, children }) {
    return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
      h('div', { className: 'feuille' },
        h('div', { className: 'feuille-tete' },
          h(Bouton, { onClick: onAnnuler }, 'Annuler'),
          h('h2', { className: 'gill' }, titre),
          h('div', { className: 'feuille-action' }, action)),
        h('div', { className: 'feuille-corps' }, children)));
  }

  function FeuilleNouvelArticle({ etat, dispatch }) {
    const r = etat.reglages;
    const [texte, setTexte] = useState('');
    const [reseau, setReseau] = useState(r.reseauDefaut);
    const [format, setFormat] = useState(r.formatDefaut);
    const [fond, setFond] = useState('bleu');
    const { choisirPolice } = useContext(Contexte);
    const paragraphes = texte.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    function creer() {
      const premier = paragraphes[0] || 'Nouvel article';
      dispatch({
        type: 'creer',
        article: {
          id: 'nouveau-' + Date.now(), titre: premier.length > 40 ? premier.slice(0, 40) + '…' : premier, statut: 'Brouillon', reseau, format, fond,
          langues: ['fr'], modifie: 'à l’instant', texte: paragraphes, slides: M.decouperMecaniquement(paragraphes, format, fond, choisirPolice),
          slidesEn: [], propositions: null, accroche: null, descriptions: DESCRIPTIONS_VIDES,
        },
      });
    }
    return h(Feuille, {
      titre: 'Nouvel article', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }),
      action: h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: creer }, 'Créer'),
    },
    h('label', { className: 'etiquette', htmlFor: 'texte-nouvel' }, 'Texte de l’article'),
    h('textarea', { id: 'texte-nouvel', className: 'zone-texte', rows: 9, value: texte, placeholder: 'Colle ici le texte de ton article Word.', onChange: (e) => setTexte(e.target.value) }),
    h('p', { className: 'doux petit' }, paragraphes.length ? `${paragraphes.length} paragraphe(s) · ${M.compterMots(texte)} mots. Le découpage en slides se fera sans IA, paragraphe par paragraphe.` : 'L’import direct d’un fichier Word arrivera en phase 3.'),
    h(Ligne, { etiquette: 'Réseau', aide: 'Fixe le format d’export : images pour Instagram, PDF pour LinkedIn.' }, h(Segmente, { valeur: reseau, onChange: setReseau, options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
    h(Ligne, { etiquette: 'Format', aide: '1:1 comme tes carrousels actuels, 4:5 pour plus de place.' }, h(Segmente, { valeur: format, onChange: setFormat, options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
    h(Ligne, { etiquette: 'Fond', aide: 'Il pourra changer ensuite.' }, h(SelecteurFond, { valeur: fond, onChange: setFond })));
  }

  function SelecteurFond({ valeur, onChange }) {
    return h('div', { className: 'fonds', role: 'group', 'aria-label': 'Fond' },
      Object.entries(M.FONDS).map(([cle, f]) => h('button', {
        key: cle, type: 'button', className: cls('fond-choix', valeur === cle && 'actif'), 'aria-pressed': valeur === cle, title: f.nom, onClick: () => onChange(cle),
      }, h('span', { className: 'fond-echantillon', style: { background: f.fond } }), h('span', { className: 'fond-nom' }, f.nom))));
  }

  /* ================================================================== */
  /* 6. Atelier                                                          */
  /* ================================================================== */

  function Atelier({ etat, dispatch }) {
    const article = etat.articles.find((a) => a.id === etat.articleId);
    if (!article) return h(Bibliotheque, { etat, dispatch });
    const majA = (maj) => dispatch({ type: 'article', id: article.id, maj });
    const vues = { texte: EtapeTexte, structure: EtapeStructure, design: EtapeDesign, description: EtapeDescription, export: EtapeExport };
    const index = ETAPES.findIndex((e) => e.id === etat.etape);
    return h(Fragment, null,
      h(Barre, {
        etat, dispatch, langue: true, titre: article.titre,
        gauche: h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles'),
      }),
      h('nav', { className: 'etapes', 'aria-label': 'Étapes' },
        ETAPES.map((e, i) => h('button', {
          key: e.id, type: 'button', className: cls('etape', e.id === etat.etape && 'active', i < index && 'faite'), 'aria-current': e.id === etat.etape ? 'step' : undefined,
          onClick: () => dispatch({ type: 'etape', etape: e.id }),
        }, h('span', { className: 'etape-num' }, i + 1), e.nom))),
      etat.aide && h(PanneauAide, { cle: etat.etape, dispatch }),
      etat.message && h('div', { className: 'message', role: 'status' }, h('span', null, etat.message),
        h('button', { type: 'button', className: 'lien', onClick: () => dispatch({ type: 'message', message: null }) }, 'Fermer')),
      h('main', { className: 'contenu atelier' }, h(vues[etat.etape], { etat, dispatch, article, majA })),
      h('footer', { className: 'pied-etapes' },
        h(Bouton, { disabled: index === 0, onClick: () => dispatch({ type: 'etape', etape: ETAPES[index - 1].id }) }, 'Étape précédente'),
        index < ETAPES.length - 1
          ? h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'etape', etape: ETAPES[index + 1].id }) }, 'Continuer : ' + ETAPES[index + 1].nom)
          : h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, 'Terminer')));
  }

  /* ---------- Étape 1 : Texte ---------- */

  function extraitAvecMarque(texte, debut, longueur) {
    const avant = texte.slice(Math.max(0, debut - 40), debut);
    const fin = debut + longueur;
    return [(debut > 40 ? '…' : '') + avant, texte.slice(debut, fin), texte.slice(fin, fin + 40) + (fin + 40 < texte.length ? '…' : '')];
  }

  function EtapeTexte({ etat, article, majA, dispatch }) {
    const zone = useRef(null);
    const [verification, setVerification] = useState({ etat: 'repos', erreurs: [], detail: '' });
    const [portee, setPortee] = useState('passage');
    const [selection, setSelection] = useState({ debut: 0, fin: 0 });
    const [intention, setIntention] = useState(null);
    const texteComplet = article.texte.join('\n\n');
    const passage = texteComplet.slice(selection.debut, selection.fin).trim();

    const lireSelection = () => { if (zone.current) setSelection({ debut: zone.current.selectionStart, fin: zone.current.selectionEnd }); };

    function montrer(debut, longueur) {
      const el = zone.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(debut, debut + longueur);
      const ligne = texteComplet.slice(0, debut).split('\n').length;
      el.scrollTop = Math.max(0, (ligne - 3) * 26);
    }

    async function verifier() {
      setVerification({ etat: 'encours', erreurs: [], detail: '' });
      try {
        const reponse = await fetch('https://api.languagetool.org/v2/check', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ text: texteComplet, language: 'fr' }),
        });
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
      majA(OP.texte(nouveau.split('\n\n')));
      setVerification((v) => ({ ...v, erreurs: v.erreurs.filter((e) => e !== erreur).map((e) => (e.offset > erreur.offset ? { ...e, offset: e.offset + ecart } : e)) }));
    }
    const ignorer = (erreur) => setVerification((v) => ({ ...v, erreurs: v.erreurs.filter((e) => e !== erreur) }));

    return h('div', { className: 'deux-colonnes' },
      h('div', { className: 'colonne-principale' },
        etat.langue === 'en' && h('div', { className: 'note' }, 'La version anglaise est produite à partir du texte français validé (phase 7). Ici, tu travailles le texte français.'),
        h(Carte, { titre: 'Texte de l’article', sousTitre: `${article.texte.length} paragraphes · ${M.compterMots(texteComplet)} mots. Une ligne vide sépare deux paragraphes.` },
          h('textarea', {
            ref: zone, className: 'zone-texte grande', rows: 22, value: texteComplet, 'aria-label': 'Texte de l’article',
            onChange: (e) => majA(OP.texte(e.target.value.split('\n\n'))),
            onSelect: lireSelection, onKeyUp: lireSelection, onMouseUp: lireSelection, onTouchEnd: lireSelection,
          }))),
      h('aside', { className: 'panneau' },
        h(Carte, { titre: 'Typographie', info: 'Ces règles s’appliquent toutes seules, sans IA : elles ne changent jamais tes mots.', sousTitre: 'Appliquée automatiquement.' },
          h('ul', { className: 'liste-simple' }, h('li', null, 'Espaces insécables avant : ; ! ?'), h('li', null, 'Guillemets « » et apostrophes typographiques'), h('li', null, 'Points de suspension en un seul caractère'))),
        h(Carte, {
          titre: 'Orthographe et grammaire', info: 'Vérification par LanguageTool, un service gratuit. Rien n’est corrigé sans ton accord.',
          sousTitre: 'Chaque correction attend ton accord.',
          actions: h(Bouton, { variante: 'principal', onClick: verifier, disabled: verification.etat === 'encours' }, verification.etat === 'encours' ? 'Vérification…' : 'Vérifier'),
        },
        verification.etat === 'erreur' && h('p', { className: 'erreur petit' }, 'Vérification impossible : ' + verification.detail),
        verification.etat === 'fait' && !verification.erreurs.length && h('p', { className: 'ok petit' }, 'Aucune faute détectée.'),
        verification.erreurs.map((e, i) => {
          const [avant, fautif, apres] = extraitAvecMarque(texteComplet, e.offset, e.length);
          return h('div', { key: e.offset + '-' + i, className: 'correction' },
            h('p', { className: 'extrait-correction' }, avant, h('mark', null, fautif), apres),
            h('div', { className: 'petit' }, h('span', { className: 'barre-mot' }, fautif), ' → ', h('strong', null, e.replacements[0].value)),
            h('div', { className: 'doux petit' }, e.message),
            h('div', { className: 'actions-ligne' },
              h(Bouton, { variante: 'principal petit', onClick: () => corriger(e, e.replacements[0].value) }, 'Corriger'),
              h(Bouton, { variante: 'petit', onClick: () => montrer(e.offset, e.length) }, h(Icone, { nom: 'oeil', taille: 16 }), 'Montrer'),
              h(Bouton, { variante: 'petit', onClick: () => ignorer(e) }, 'Ignorer')));
        }),
        h('p', { className: 'mention' }, 'Correction fournie par ', h('a', { href: 'https://languagetool.org', target: '_blank', rel: 'noopener' }, 'LanguageTool'), '.')),
        h(Carte, { titre: 'Suggestions de style', info: 'L’IA propose des versions retravaillées. Rien ne remplace ton texte sans ton accord.', sousTitre: 'Choisis d’abord sur quoi elles portent.' },
          h(Ligne, { etiquette: 'Porter sur' }, h(Segmente, { valeur: portee, onChange: setPortee, options: [{ valeur: 'passage', libelle: 'Le passage choisi' }, { valeur: 'article', libelle: 'Tout l’article' }] })),
          portee === 'passage' && (passage
            ? h('blockquote', null, passage.length > 160 ? passage.slice(0, 160) + '…' : passage)
            : h('p', { className: 'doux petit' }, 'Sélectionne un passage dans le texte, à gauche.')),
          h('div', { className: 'puces' }, ['Clarifier', 'Raccourcir', 'Restructurer', 'Plus percutant', 'Varier les tournures'].map((nom) => h('button', {
            key: nom, type: 'button', className: cls('puce', intention === nom && 'active'), disabled: portee === 'passage' && !passage, onClick: () => setIntention(nom),
          }, nom))),
          intention && (portee === 'article' || passage) && h(PropositionStyle, { intention, portee, dispatch }))));
  }

  // Exemple simulé : montre la présentation d'une suggestion, sans IA réelle.
  function PropositionStyle({ intention, portee, dispatch }) {
    const original = P[12];
    const versions = [
      'Cette histoire me touche. On parle beaucoup de communication au travail, mais rarement de ce qu’on imagine quand elle disparaît.',
      'On parle beaucoup de communication au travail. Bien moins de ce qu’on imagine quand elle disparaît.',
    ];
    return h('div', { className: 'suggestion' },
      h(Pastille, { ton: 'info' }, `Exemple de présentation · ${intention} · ${portee === 'article' ? 'tout l’article' : 'passage'}`),
      h('p', { className: 'doux petit' }, 'L’IA n’est pas encore branchée (phase 4). Voici comment une suggestion s’affichera, sur un passage de l’article « Clara » :'),
      h('blockquote', null, original),
      versions.map((v, i) => h('div', { key: i, className: 'version' },
        h('div', { className: 'petit' }, h('strong', null, 'Version ' + (i + 1) + ' : '), v),
        h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'message', message: 'Maquette : la suggestion n’est pas appliquée. Dans l’outil, elle remplacera le passage après ton accord.' }) }, 'Utiliser cette version'))),
      h('div', { className: 'alerte-sens petit' }, '⚠︎ Glissement de sens possible : « finalement assez peu » devient « rarement ». La nuance est un peu renforcée.'));
  }

  /* ---------- Étape 2 : Structure ---------- */

  function EtapeStructure({ etat, dispatch, article, majA }) {
    const { choisirPolice } = useContext(Contexte);
    const limite = M.LIMITES_SLIDES[article.reseau];
    const p = article.propositions;
    const enAttente = p ? p.misesEnAvant.filter((m) => m.statut === 'proposee').length : 0;
    return h('div', { className: 'deux-colonnes' },
      h('div', { className: 'colonne-principale' },
        h('div', { className: 'resume-volume' }, h('strong', null, `${article.slides.length} slides`), ` · limite ${article.reseau === 'instagram' ? 'Instagram' : 'LinkedIn'} : ${limite} · ${M.compterMots(article.texte.join(' '))} mots`),
        etat.langue === 'en' && h('div', { className: 'note' }, 'Vue côte à côte français / anglais. Dans la maquette, seules les deux premières slides sont traduites (traduction simulée).'),
        h('ol', { className: 'liste-slides' },
          article.slides.map((s, i) => h('li', { key: i },
            h('button', { type: 'button', className: cls('item-slide', i === etat.slide && 'actif'), onClick: () => dispatch({ type: 'aller', etape: 'design', slide: i }), 'aria-label': `Ouvrir la slide ${i + 1} dans Design` },
              h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 112, index: i, total: article.slides.length, etiquette: 'Slide ' + (i + 1) }),
              h('span', { className: 'item-slide-texte' },
                h('span', { className: 'item-slide-tete' }, h('span', { className: 'num' }, i + 1), h(Pastille, null, s.role), h(Pastille, { ton: 'info' }, M.GABARITS[M.gabaritParDefaut(s, i)].nom),
                  h('span', { className: 'doux petit' }, s.blocs.reduce((n, b) => n + M.compterMots(b.texte), 0) + ' mots')),
                h('span', { className: 'extrait' }, s.blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ')),
                etat.langue === 'en' && h('span', { className: 'extrait en' }, article.slidesEn[i] ? article.slidesEn[i].blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ') : 'Traduction à générer (phase 7).'))))))),
      h('aside', { className: 'panneau' },
        !p
          ? h(Carte, { titre: 'Propositions de l’IA', sousTitre: 'Découpage sans IA, paragraphe par paragraphe.' },
            h('p', { className: 'petit' }, 'L’analyse éditoriale arrivera avec l’IA. Ouvre « Le silence au travail » pour voir comment elle se présentera.'),
            h(Bouton, { onClick: () => majA(OP.champ('slides', M.decouperMecaniquement(article.texte, article.format, article.fond, choisirPolice))) }, 'Redécouper le texte'))
          : h(Fragment, null,
            h('div', { className: 'bandeau-propositions' },
              h('div', null, h(Pastille, { ton: 'info' }, 'Propositions simulées'), h('p', { className: 'doux petit' }, 'Accepter garde la mise en valeur ; refuser la retire.')),
              h(Bouton, { variante: 'principal', disabled: !enAttente, onClick: () => majA(OP.toutAccepter()) }, enAttente ? `Tout accepter (${enAttente})` : 'Tout est traité')),
            h(Carte, { titre: 'Ce que l’IA a compris', info: 'Si un point est faux, corrige-le : toutes les propositions en découlent.' },
              h('dl', { className: 'definitions' }, ['sujet', 'message', 'intention', 'ton'].map((cle) => h(Fragment, { key: cle },
                h('dt', null, { sujet: 'Sujet', message: 'Message central', intention: 'Intention', ton: 'Ton' }[cle]), h('dd', null, p.comprehension[cle]))))),
            h(Carte, { titre: 'Accroche de couverture', info: 'Trois phrases de ton texte, candidates pour la couverture. Choisir en remplace le texte.' },
              p.accroches.map((a, i) => h(CarteAccroche, { key: a.id, accroche: a, numero: i + 1, choisie: article.accroche === a.id, onChoisir: () => majA(OP.accroche(a)) }))),
            h(Carte, { titre: 'Mises en avant', info: 'Accepter : le passage garde son traitement (phrase-choc, citation). Refuser : il redevient du texte courant.' },
              p.misesEnAvant.map((m) => h(CarteMiseEnAvant, { key: m.id, proposition: m, majA, dispatch }))),
            h(Carte, { titre: 'Fins de slide', info: 'Une ponctuation différente peut donner envie de glisser. Appliquer change l’article et la slide ensemble.' },
              p.ponctuation.map((pp) => h(CartePonctuation, { key: pp.id, proposition: pp, majA }))))));
  }

  function Fiche({ fiche }) {
    const libelles = [['pertinence', 'Pourquoi'], ['objectif', 'Objectif'], ['message', 'Message au lecteur'], ['poids', 'Poids visuel'], ['traitement', 'Traitement'], ['risques', 'Risques']];
    return h('dl', { className: 'fiche' }, libelles.map(([cle, libelle]) => h(Fragment, { key: cle }, h('dt', null, libelle), h('dd', { className: cle === 'risques' ? 'risque' : '' }, fiche[cle]))));
  }

  function BoutonJustification({ ouverte, onClick }) {
    return h(Bouton, { variante: 'petit', onClick }, h(Icone, { nom: ouverte ? 'haut' : 'bas', taille: 16 }), ouverte ? 'Masquer la justification' : 'Voir la justification');
  }

  function CarteAccroche({ accroche, numero, choisie, onChoisir }) {
    const [ouverte, setOuverte] = useState(false);
    return h('div', { className: cls('proposition', choisie && 'choisie') },
      h('div', { className: 'proposition-tete' }, h('strong', null, 'Accroche ' + numero), choisie ? h(Pastille, { ton: 'ok' }, 'Retenue') : h(Bouton, { variante: 'principal petit', onClick: onChoisir }, 'Choisir')),
      h('p', { className: 'citation-proposee' }, accroche.blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ')),
      h(BoutonJustification, { ouverte, onClick: () => setOuverte(!ouverte) }),
      ouverte && h(Fiche, { fiche: accroche.fiche }));
  }

  function CarteMiseEnAvant({ proposition: m, majA, dispatch }) {
    const [ouverte, setOuverte] = useState(false);
    const tons = { proposee: 'neutre', acceptee: 'ok', refusee: 'erreur' };
    const libelles = { proposee: 'Proposée', acceptee: 'Acceptée', refusee: 'Refusée' };
    return h('div', { className: cls('proposition', m.statut) },
      h('div', { className: 'proposition-tete' }, h('span', null, h('strong', null, 'Slide ' + (m.slide + 1)), ' ', h(Pastille, { ton: tons[m.statut] }, libelles[m.statut])),
        h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'aller', etape: 'design', slide: m.slide }) }, 'Voir la slide')),
      h('p', { className: 'citation-proposee' }, m.fiche.selection),
      h(BoutonJustification, { ouverte, onClick: () => setOuverte(!ouverte) }),
      ouverte && h(Fiche, { fiche: m.fiche }),
      h('div', { className: 'actions-ligne' },
        h(Bouton, { variante: 'principal petit', disabled: m.statut === 'acceptee', onClick: () => majA(OP.statutMiseEnAvant(m.id, 'acceptee')) }, 'Accepter'),
        h(Bouton, { variante: 'petit', disabled: m.statut === 'refusee', onClick: () => majA(OP.statutMiseEnAvant(m.id, 'refusee')) }, 'Refuser')));
  }

  function CartePonctuation({ proposition: p, majA }) {
    if (p.statut !== 'proposee') return h('p', { className: 'doux petit' }, p.statut === 'appliquee' ? 'Ponctuation appliquée.' : 'Proposition ignorée.');
    return h('div', { className: 'proposition' },
      h('div', { className: 'proposition-tete' }, h('strong', null, 'Slide ' + (p.slide + 1)), h(Pastille, { ton: 'info' }, 'Exemple simulé')),
      h('p', { className: 'citation-proposee' }, p.ancien),
      p.options.map((o, i) => h('div', { key: i, className: 'version' },
        h('div', { className: 'petit' }, h('strong', null, o.texte), ' — ', o.pourquoi),
        h(Bouton, { variante: 'petit', onClick: () => majA((a) => OP.statutPonctuation(p.id, 'appliquee')(OP.remplacerTexte(p.ancien, o.texte)(a))) }, 'Appliquer'))),
      h(Bouton, { variante: 'lien', onClick: () => majA(OP.statutPonctuation(p.id, 'ignoree')) }, 'Garder la ponctuation actuelle'));
  }

  /* ---------- Étape 3 : Design ---------- */

  const FAMILLES = [['Couverture', ['V1', 'V2', 'V3', 'V4', 'V5']], ['Texte', ['T1', 'T2', 'T3', 'T4', 'T5']], ['Fin', ['F1']]];

  function EtapeDesign({ etat, dispatch, article, majA }) {
    const { choisirPolice, reglages } = useContext(Contexte);
    const [refApercu, largeurDispo] = useLargeur(480);
    const i = Math.min(etat.slide, article.slides.length - 1);
    const total = article.slides.length;
    const slide = etat.langue === 'en' && article.slidesEn[i] ? { ...article.slidesEn[i], gabarit: article.slides[i].gabarit, signature: article.slides[i].signature } : article.slides[i];
    const compositions = article.slides.map((s, k) => M.composer(s, article.format, article.fond, choisirPolice, { index: k, total, reglages }));
    const alertes = M.controler(article, compositions, etat.reglages);
    const exacte = compositions.every((c) => c.exacte);
    const largeurApercu = Math.max(220, Math.min(largeurDispo, article.format === 'portrait' ? 440 : 540));
    const gabaritActuel = M.gabaritParDefaut(article.slides[i], i);

    function proposer() {
      const autres = etat.articles.filter((a) => a.id !== article.id);
      const convient = (s, k, fond) => !M.composer(s, article.format, fond, choisirPolice, { index: k, total, reglages }).deborde;
      const proposition = M.proposerPresentation(article, autres, etat.reglages.rythme, Math.random, convient);
      majA(OP.presentation(proposition));
      dispatch({ type: 'message', message: `Nouvelle présentation : fond ${M.FONDS[proposition.fond].nom.toLowerCase()}, couverture « ${M.GABARITS[proposition.slides[0].gabarit].nom} ». Ton texte n’a pas changé.` });
    }

    return h('div', { className: 'deux-colonnes design' },
      h('div', { className: 'colonne-principale' },
        etat.langue === 'en' && h('div', { className: 'note' }, article.slidesEn[i] ? 'Version anglaise (traduction simulée).' : 'Pas encore de version anglaise pour cette slide : affichage du français.'),
        h('div', { className: 'zone-apercu', ref: refApercu },
          h(SlideCanvas, { slide, formatId: article.format, fondId: article.fond, largeur: largeurApercu, index: i, total, etiquette: 'Aperçu de la slide ' + (i + 1) })),
        !exacte && h('p', { className: 'doux petit centre' }, 'Rendu approché avec la Gill Sans de l’iPad. Importe tes fichiers dans Configuration › Ressources pour un rendu exact.'),
        h('div', { className: 'bande-miniatures', role: 'list' },
          article.slides.map((s, k) => h('div', { key: k, className: 'miniature', role: 'listitem' },
            h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 92, index: k, total, selectionnee: k === i, onClick: () => dispatch({ type: 'slide', index: k }), etiquette: 'Afficher la slide ' + (k + 1) }),
            h('div', { className: cls('miniature-pied', compositions[k].deborde && 'erreur') }, (compositions[k].deborde ? '⚠︎ ' : '') + (k + 1)))))),
      h('aside', { className: 'panneau' },
        h(Carte, { titre: 'Carrousel', info: 'Ces choix s’appliquent à toutes les slides de cet article.' },
          h(Ligne, { etiquette: 'Fond', aide: 'Change-le d’un article à l’autre pour varier ta grille.' }),
          h(SelecteurFond, { valeur: article.fond, onChange: (v) => majA(OP.champ('fond', v)) }),
          h(Ligne, { etiquette: 'Format', aide: '4:5 donne plus de place sur Instagram.' }, h(Segmente, { valeur: article.format, onChange: (v) => majA(OP.champ('format', v)), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
          h(Ligne, { etiquette: 'Réseau', aide: 'Fixe le type de fichier exporté.' }, h(Segmente, { valeur: article.reseau, onChange: (v) => majA(OP.champ('reseau', v)), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
          h(Bouton, { variante: 'principal large', onClick: proposer }, h(Icone, { nom: 'baguette', taille: 18 }), 'Proposer une autre présentation'),
          h('p', { className: 'doux petit' }, 'Un fond et des gabarits différents de tes derniers articles, toujours dans ta charte. Ton texte ne change pas.')),
        h(Carte, {
          titre: 'Slide ' + (i + 1), sousTitre: article.slides[i].role,
          actions: h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'icone', etiquette: 'Déplacer la slide vers la gauche', disabled: i === 0, onClick: () => { majA(OP.deplacerSlide(i, -1)); dispatch({ type: 'slide', index: i - 1 }); } }, h(Icone, { nom: 'gauche' })),
            h(Bouton, { variante: 'icone', etiquette: 'Déplacer la slide vers la droite', disabled: i === total - 1, onClick: () => { majA(OP.deplacerSlide(i, 1)); dispatch({ type: 'slide', index: i + 1 }); } }, h(Icone, { nom: 'droite' }))),
        },
        h('div', { className: 'ligne-etiquette' }, 'Gabarit', h(Info, { texte: 'La composition de la slide. En changer ne modifie jamais ton texte : essaie-les librement.' })),
        h('p', { className: 'doux petit' }, M.GABARITS[gabaritActuel].aide),
        FAMILLES.map(([famille, codes]) => h('div', { key: famille, className: 'famille-gabarits' },
          h('div', { className: 'surtitre' }, famille),
          h('div', { className: 'grille-gabarits' }, codes.map((code) => h('button', {
            key: code, type: 'button', className: cls('gabarit-choix', gabaritActuel === code && 'actif'), 'aria-pressed': gabaritActuel === code,
            onClick: () => majA(OP.gabarit(i, code)), title: M.GABARITS[code].aide,
          },
          h(SlideCanvas, { slide: { ...article.slides[i], gabarit: code }, formatId: article.format, fondId: article.fond, largeur: 64, index: i, total }),
          h('span', null, M.GABARITS[code].nom)))))),
        h('div', { className: 'ligne-etiquette blocs-titre' }, 'Paragraphes', h(Info, { texte: 'Change la nature d’un paragraphe, réordonne-le avec les flèches ou supprime-le. Tout texte supprimé ou ajouté ici est signalé s’il ne correspond plus à l’article.' })),
        article.slides[i].blocs.map((b, n) => h('div', { key: n, className: 'bloc-edition' },
          h('div', { className: 'bloc-outils' },
            h('select', { className: 'choix', value: b.style, 'aria-label': 'Nature du paragraphe ' + (n + 1), onChange: (e) => majA(OP.modifierBloc(i, n, { style: e.target.value })) },
              Object.entries(M.NATURES).map(([cle, nat]) => h('option', { key: cle, value: cle }, nat.nom))),
            h(Bouton, { variante: 'icone petit', etiquette: 'Monter le paragraphe', disabled: n === 0, onClick: () => majA(OP.deplacerBloc(i, n, -1)) }, h(Icone, { nom: 'haut', taille: 18 })),
            h(Bouton, { variante: 'icone petit', etiquette: 'Descendre le paragraphe', disabled: n === article.slides[i].blocs.length - 1, onClick: () => majA(OP.deplacerBloc(i, n, 1)) }, h(Icone, { nom: 'bas', taille: 18 })),
            h(Bouton, { variante: 'icone petit danger', etiquette: 'Supprimer le paragraphe', onClick: () => majA(OP.supprimerBloc(i, n)) }, h(Icone, { nom: 'poubelle', taille: 18 }))),
          h('textarea', { className: 'zone-texte', rows: 3, value: b.texte, 'aria-label': 'Texte du paragraphe ' + (n + 1), onChange: (e) => majA(OP.modifierBloc(i, n, { texte: e.target.value })) }))),
        h(Bouton, { variante: 'ajouter', onClick: () => majA(OP.ajouterBloc(i)) }, h(Icone, { nom: 'plus', taille: 18 }), 'Ajouter un paragraphe')),
        h(Carte, { titre: 'Contrôle qualité', info: 'Marges, densité, limite du réseau, et présence de tout le texte de l’article.', sousTitre: alertes.length ? `${alertes.length} point(s) à regarder` : 'Tout est en ordre.' },
          alertes.length
            ? h('ul', { className: 'liste-alertes' }, alertes.map((a, k) => h('li', { key: k, className: a.niveau },
              h('span', null, a.message),
              a.slide !== null && h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'slide', index: a.slide }) }, 'Voir la slide ' + (a.slide + 1)))))
            : h('p', { className: 'ok petit' }, 'Marges, densité, limite du réseau et intégrité du texte : OK.'))));
  }

  /* ---------- Étape 4 : Description ---------- */

  const LIMITES_DESCRIPTION = { instagram: 2200, linkedin: 3000 }; // indicatives, à vérifier

  function EtapeDescription({ etat, dispatch, article, majA }) {
    const langue = etat.langue;
    return h('div', { className: 'colonne-unique' },
      h('div', { className: 'note' }, 'Descriptions simulées pour la maquette. Dans l’outil, elles seront rédigées à partir de ton article seul, sans aucun fait ajouté.'),
      ['instagram', 'linkedin'].map((reseau) => {
        const texte = article.descriptions[reseau][langue] || '';
        return h(Carte, {
          key: reseau, titre: reseau === 'instagram' ? 'Légende Instagram' : 'Texte du post LinkedIn',
          info: reseau === 'instagram' ? 'Seules les premières lignes s’affichent avant « plus » : la première phrase compte le plus.' : 'Il s’affiche au-dessus du document : il donne envie de l’ouvrir.',
          actions: h(Fragment, null,
            h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'message', message: 'Maquette : l’IA n’est pas branchée. La génération arrivera avec elle.' }) }, 'Régénérer'),
            h(Bouton, { variante: 'petit', onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(texte).catch(() => {}); dispatch({ type: 'message', message: 'Description copiée.' }); } }, 'Copier')),
        },
        h('textarea', { className: 'zone-texte', rows: 9, value: texte, placeholder: langue === 'en' ? 'La description anglaise sera rédigée après la traduction.' : 'Description à rédiger.', onChange: (e) => majA(OP.description(reseau, langue, e.target.value)), 'aria-label': 'Description ' + reseau }),
        h('div', { className: 'doux petit droite' }, `${texte.length} / ${LIMITES_DESCRIPTION[reseau]} caractères (limite indicative)`));
      }));
  }

  /* ---------- Étape 5 : Export ---------- */

  function EtapeExport({ etat, dispatch, article }) {
    const { choisirPolice, reglages } = useContext(Contexte);
    const total = article.slides.length;
    const compositions = article.slides.map((s, k) => M.composer(s, article.format, article.fond, choisirPolice, { index: k, total, reglages }));
    const bloquants = M.controler(article, compositions, etat.reglages).filter((a) => a.niveau === 'bloquant');
    const fichier = article.reseau === 'linkedin' ? 'Un PDF de ' + total + ' pages' : total + ' images PNG';
    return h('div', { className: 'colonne-unique' },
      h(Carte, {
        titre: 'Exporter', sousTitre: `${fichier} · ${M.FORMATS[article.format].nom} · fond ${M.FONDS[article.fond].nom.toLowerCase()}`,
        actions: h(Bouton, { variante: 'principal', disabled: bloquants.length > 0, onClick: () => dispatch({ type: 'message', message: 'Maquette : l’export réel arrive en phase 3. Le banc d’essai l’a déjà validé sur ton iPad.' }) }, 'Exporter'),
      },
      bloquants.length
        ? h(Fragment, null,
          h('p', { className: 'erreur' }, `Export en attente : ${bloquants.length} point(s) à régler.`),
          h('ul', { className: 'liste-alertes' }, bloquants.map((a, k) => h('li', { key: k, className: 'bloquant' },
            h('span', null, (a.slide !== null ? `Slide ${a.slide + 1} · ` : '') + a.message),
            h(Bouton, { variante: 'principal petit', onClick: () => dispatch({ type: 'aller', etape: a.cible, slide: a.slide }) }, 'Corriger')))))
        : h('p', { className: 'ok' }, 'Prêt à exporter.')),
      h('div', { className: 'grille-export' }, article.slides.map((s, k) => h('div', { key: k, className: 'export-item' },
        h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 180, index: k, total, etiquette: 'Slide ' + (k + 1) }),
        h('div', { className: 'doux petit centre' }, k + 1)))));
  }

  /* ================================================================== */
  /* 7. Configuration                                                    */
  /* ================================================================== */

  function Configuration({ etat, dispatch }) {
    const onglets = { charte: OngletCharte, ressources: OngletRessources, reglages: OngletReglages };
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: 'Configuration', gauche: h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles') }),
      h('nav', { className: 'onglets' }, h(Segmente, { etiquette: 'Onglets', valeur: etat.onglet, onChange: (o) => dispatch({ type: 'onglet', onglet: o }), options: [{ valeur: 'charte', libelle: 'Charte' }, { valeur: 'ressources', libelle: 'Ressources' }, { valeur: 'reglages', libelle: 'Réglages' }] })),
      etat.aide && h(PanneauAide, { cle: 'configuration', dispatch }),
      h('main', { className: 'contenu colonne-unique' }, h(onglets[etat.onglet], { etat, dispatch })));
  }

  const EXEMPLE_COUVERTURE = { role: 'Couverture', blocs: [{ style: 'titre', texte: 'Le silence\nlaisse rarement' }, { style: 'contrepoint', texte: 'un vide.' }] };
  const EXEMPLE_TEXTE = { role: 'Texte', blocs: [{ style: 'corps', texte: 'Depuis quelques mois, son manager ne lui parle presque plus.' }, { style: 'emphase', texte: 'Et là, surprise.' }, { style: 'citation', texte: `«${NB}Le pire, c’est que je ne sais même pas ce que j’ai fait de mal.${NB}»` }], signature: true };

  function OngletCharte() {
    return h(Fragment, null,
      h(Carte, { titre: 'Couleurs', info: 'Tes références font foi. Les nuances pâles servent uniquement de fonds.' },
        h('div', { className: 'nuancier' }, [
          ['Bleu Oh ! Potentiel', M.PALETTE.bleu, 'Pantone 547 U · RVB 0/56/70', 'Fonds et texte'],
          ['Vert Oh ! Potentiel', M.PALETTE.vert, 'Pantone 397 · écran #C9D420', 'Mots mis en valeur, fleurs, filets, bandeaux'],
          ['Blanc', M.PALETTE.blanc, '#FFFFFF', 'Fonds et texte'],
          ['Bleu pâle', M.PALETTE.bleuPale, 'Nuance de fond', 'Fonds uniquement'],
          ['Vert pâle', M.PALETTE.vertPale, 'Nuance de fond', 'Fonds uniquement'],
        ].map(([nom, code, ref, usage]) => h('div', { key: nom, className: 'pastille-couleur' },
          h('div', { className: 'echantillon', style: { background: code } }),
          h('div', null, h('div', { className: 'petit' }, h('strong', null, nom)), h('div', { className: 'doux petit' }, ref), h('div', { className: 'doux petit' }, usage)))))),
      h(Carte, { titre: 'Gabarits', info: 'Les 11 mises en page validées. L’outil peut te les proposer d’un article à l’autre.' },
        FAMILLES.map(([famille, codes]) => h('div', { key: famille, className: 'famille-gabarits' },
          h('div', { className: 'surtitre' }, famille),
          h('div', { className: 'galerie' }, codes.map((code) => h('figure', { key: code, className: 'galerie-item' },
            h(SlideCanvas, { slide: { ...(famille === 'Couverture' ? EXEMPLE_COUVERTURE : EXEMPLE_TEXTE), gabarit: code }, formatId: 'carre', fondId: famille === 'Texte' ? 'blanc' : 'bleu', largeur: 150 }),
            h('figcaption', null, h('strong', null, M.GABARITS[code].nom), h('span', { className: 'doux' }, M.GABARITS[code].aide)))))))),
      h(Carte, { titre: 'Planche des fonds', info: 'Le même contenu sur chacun des cinq fonds autorisés.' },
        h('div', { className: 'planche' }, Object.keys(M.FONDS).map((f) => h('figure', { key: f, className: 'galerie-item' },
          h(SlideCanvas, { slide: { ...EXEMPLE_TEXTE, gabarit: 'T1' }, formatId: 'carre', fondId: f, largeur: 150 }),
          h('figcaption', null, h('strong', null, M.FONDS[f].nom)))))),
      h(Carte, { titre: 'Typographie', info: 'Tailles calées pour garder la lisibilité de tes carrousels actuels.' },
        h('div', { className: 'tableau-defilant' }, h('table', { className: 'tableau' },
          h('thead', null, h('tr', null, ['Usage', 'Police', 'Taille', 'Interligne'].map((t) => h('th', { key: t }, t)))),
          h('tbody', null, [['Titre de couverture', 'Gill Sans MT Bold', '114 px', '1,1'], ['Texte courant', 'Gill Sans MT Light', '39 px', '1,25'], ['Phrase-choc', 'Gill Sans MT Bold', '39 px', '1,25'], ['Citation', 'Gill Sans MT Light', '39 px', '1,25']].map((ligne) => h('tr', { key: ligne[0] }, ligne.map((c, k) => h('td', { key: k }, c)))))))),
      h(Carte, { titre: 'Règles', info: 'Le contrat que l’outil fait respecter automatiquement.' },
        h('div', { className: 'regles' },
          h('div', null, h('h4', null, 'Obligatoire'), h('ul', { className: 'liste-simple' }, h('li', null, 'Marge gauche de 81 px, texte aligné à gauche'), h('li', null, 'Un seul fond par carrousel'), h('li', null, 'Logo officiel sur la dernière slide'))),
          h('div', null, h('h4', null, 'Autorisé'), h('ul', { className: 'liste-simple' }, h('li', null, 'Cinq fonds, dont deux nuances pâles'), h('li', null, 'Format 1:1 ou 4:5'), h('li', null, 'Dernière slide centrée (gabarit Fin centrée)'), h('li', null, 'Logo sur chaque slide (réglage)'))),
          h('div', null, h('h4', null, 'Interdit'), h('ul', { className: 'liste-simple' }, h('li', null, 'Texte vert sur fond blanc ou pâle'), h('li', null, 'Texte blanc sur fond vert ou pâle'), h('li', null, 'Texte sous la taille minimale de la charte'))))));
  }

  function OngletRessources({ etat, dispatch }) {
    const [etatImport, setEtatImport] = useState('');
    async function importerPolice(role, fichier) {
      if (!fichier) return;
      try {
        const octets = await fichier.arrayBuffer();
        const font = opentype.parse(octets);
        await ecrireBase('postsop', 'ressources', 'police-' + role, { nom: fichier.name, octets });
        dispatch({ type: 'polices', polices: { [role]: font }, noms: { [role]: fichier.name } });
        setEtatImport(`${fichier.name} importée.`);
      } catch (erreur) {
        setEtatImport(`${fichier.name} : fichier illisible (utilise un .ttf ou un .otf).`);
      }
    }
    async function importerImage(cle, fichier) {
      if (!fichier) return;
      try {
        const image = await chargerImage(fichier);
        await ecrireBase('postsop', 'ressources', 'image-' + cle, { nom: fichier.name, blob: fichier });
        dispatch({ type: 'ressources', ressources: { [cle]: image }, noms: { [cle]: fichier.name } });
        setEtatImport(`${fichier.name} importée.`);
      } catch (erreur) {
        setEtatImport(`${fichier.name} : image illisible (utilise un PNG ou un SVG).`);
      }
    }
    const statut = (present, nom, absent) => (present ? h(Pastille, { ton: 'ok' }, nom || 'Importé') : h(Pastille, { ton: 'attention' }, absent));
    const champFichier = (etiquette, onChange, accepte) => h('label', { className: 'bouton secondaire petit fichier' }, etiquette, h('input', { type: 'file', accept: accepte, onChange: (e) => onChange(e.target.files[0]) }));
    return h(Fragment, null,
      h(Carte, { titre: 'Polices', info: 'Elles restent sur cet iPad, jamais sur GitHub : leur licence interdit de les diffuser.' },
        h(Ligne, { etiquette: 'Gill Sans MT Light', aide: 'Texte courant et citations.' }, statut(etat.polices.light, etat.polices.noms.light, 'Rendu approché'), champFichier('Importer', (f) => importerPolice('light', f))),
        h(Ligne, { etiquette: 'Gill Sans MT Bold', aide: 'Titres et phrases-chocs.' }, statut(etat.polices.bold, etat.polices.noms.bold, 'Rendu approché'), champFichier('Importer', (f) => importerPolice('bold', f)))),
      h(Carte, { titre: 'Logo et motifs', info: 'Utilise des PNG à fond transparent : ils s’affichent sur tous les fonds.' },
        h(Ligne, { etiquette: 'Logo officiel sans fond', aide: 'Nécessaire sur les fonds bleu, vert et pâles. En attendant, un cadre en pointillés marque sa place.' }, statut(etat.ressources.logo, etat.ressources.noms.logo, 'Manquant'), champFichier('Importer', (f) => importerImage('logo', f), 'image/png,image/svg+xml')),
        h(Ligne, { etiquette: 'Fleurs', aide: 'Utilisées par les gabarits « Fleurs » et « Fin centrée ».' }, statut(etat.ressources.fleurs, etat.ressources.noms.fleurs, 'À importer'), champFichier('Importer', (f) => importerImage('fleurs', f), 'image/png,image/svg+xml'))),
      etatImport && h('p', { className: 'note' }, etatImport),
      h(Carte, { titre: 'Références' },
        h(Ligne, { etiquette: 'Carrousel « Clara »', aide: 'Référence de composition et de ton.' }, h(Pastille, { ton: 'ok' }, 'Reçu')),
        h(Ligne, { etiquette: 'Plaquette PDF', aide: 'Référence de couleurs et de typographie.' }, h(Pastille, { ton: 'ok' }, 'Reçu'))));
  }

  function OngletReglages({ etat, dispatch }) {
    const r = etat.reglages;
    const regler = (cle) => (valeur) => dispatch({ type: 'reglage', cle, valeur });
    const interrupteur = (cle, etiquette) => h('label', { className: 'interrupteur' },
      h('input', { type: 'checkbox', checked: !!r[cle], onChange: (e) => regler(cle)(e.target.checked), 'aria-label': etiquette }), h('span', null));
    return h(Fragment, null,
      h('p', { className: 'note' }, 'Maquette : ton choix d’apparence est enregistré ; les autres réglages changent l’affichage mais ne sont pas encore conservés.'),
      h(Carte, { titre: 'Apparence' },
        h(Ligne, { etiquette: 'Mode', aide: 'Automatique suit le réglage clair ou sombre de ton iPad.' },
          h(Segmente, { valeur: r.apparence, onChange: regler('apparence'), options: [{ valeur: 'clair', libelle: 'Clair' }, { valeur: 'sombre', libelle: 'Sombre' }, { valeur: 'auto', libelle: 'Automatique' }] }))),
      h(Carte, { titre: 'Travail éditorial' },
        h(Ligne, { etiquette: 'Niveau d’automatisation', aide: 'Hybride : tout est proposé d’un coup, tu valides d’un geste ou en détail. Étape par étape : l’outil attend ton accord avant chaque étape.' },
          h(Segmente, { valeur: r.automatisation, onChange: regler('automatisation'), options: [{ valeur: 'hybride', libelle: 'Hybride' }, { valeur: 'etapes', libelle: 'Étape par étape' }] })),
        h(Ligne, { etiquette: 'Intensité des suggestions', aide: 'Changement minimal : l’IA touche le moins de mots possible. Plus libre : elle peut reformuler davantage.' },
          h(Segmente, { valeur: r.intensite, onChange: regler('intensite'), options: [{ valeur: 'minimale', libelle: 'Minimale' }, { valeur: 'libre', libelle: 'Plus libre' }] })),
        h(Ligne, { etiquette: 'Fournisseur d’IA', aide: 'Choix en attente : l’offre gratuite de Mistral ne donne plus de clé. Sans IA, tout fonctionne sauf les propositions.' },
          h(Segmente, { valeur: r.ia, onChange: regler('ia'), options: [{ valeur: 'mistral', libelle: 'Mistral' }, { valeur: 'gemini', libelle: 'Gemini' }, { valeur: 'aucun', libelle: 'Aucun' }] }))),
      h(Carte, { titre: 'Mise en page' },
        h(Ligne, { etiquette: 'Rythme visuel', aide: 'Utilisé par « Proposer une autre présentation ». Régulier : le même gabarit de texte partout. Contrasté : plus de variété (grandes citations, fin centrée).' },
          h(Segmente, { valeur: r.rythme, onChange: regler('rythme'), options: [{ valeur: 'regulier', libelle: 'Régulier' }, { valeur: 'equilibre', libelle: 'Équilibré' }, { valeur: 'contraste', libelle: 'Contrasté' }] })),
        h(Ligne, { etiquette: 'Mots maximum par slide', aide: `Au-delà, une alerte s’affiche dans Design. Tes carrousels actuels montent à 90 mots. Réglage : ${r.motsMax}.` },
          h('input', { type: 'range', min: 30, max: 120, step: 5, value: r.motsMax, onChange: (e) => regler('motsMax')(Number(e.target.value)), 'aria-label': 'Mots maximum par slide' })),
        h(Ligne, { etiquette: 'Si la limite de slides est dépassée', aide: 'Ce que l’outil fait quand l’article ne tient pas dans la limite du réseau.' },
          h(Segmente, { valeur: r.depassement, onChange: regler('depassement'), options: [{ valeur: 'demander', libelle: 'Me demander' }, { valeur: 'densifier', libelle: 'Densifier' }, { valeur: 'serie', libelle: 'Série' }] })),
        h(Ligne, { etiquette: 'Logo sur chaque slide', aide: 'Ajoute un petit logo en bas à droite de toutes les slides. La dernière garde son logo de fin.' }, interrupteur('logoPartout', 'Logo sur chaque slide')),
        h(Ligne, { etiquette: 'Numéro de slide', aide: 'Affiche « 2 / 6 » en bas à gauche.' }, interrupteur('numero', 'Numéro de slide')),
        h(Ligne, { etiquette: 'Indicateur « glisser »', aide: 'Une petite flèche à droite invite à passer à la slide suivante.' }, interrupteur('glisser', 'Indicateur glisser'))),
      h(Carte, { titre: 'Par défaut pour un nouvel article' },
        h(Ligne, { etiquette: 'Réseau', aide: 'Présélectionné à la création.' }, h(Segmente, { valeur: r.reseauDefaut, onChange: regler('reseauDefaut'), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
        h(Ligne, { etiquette: 'Format', aide: 'Présélectionné à la création.' }, h(Segmente, { valeur: r.formatDefaut, onChange: regler('formatDefaut'), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
        h(Ligne, { etiquette: 'Longueur des descriptions', aide: 'Longueur visée pour la légende et le post.' },
          h(Segmente, { valeur: r.longueurDescription, onChange: regler('longueurDescription'), options: [{ valeur: 'courte', libelle: 'Courte' }, { valeur: 'moyenne', libelle: 'Moyenne' }, { valeur: 'longue', libelle: 'Longue' }] }))),
      h(Carte, { titre: 'Export et sauvegarde' },
        h(Ligne, { etiquette: 'Résolution des PNG', aide: '×2 : images deux fois plus grandes, plus nettes à l’archive. Les réseaux les réduisent à l’affichage.' }, h(Segmente, { valeur: r.resolution, onChange: regler('resolution'), options: [{ valeur: '1', libelle: '×1' }, { valeur: '2', libelle: '×2' }] })),
        h(Ligne, { etiquette: 'Texte du PDF', aide: 'Tracés : identiques à l’aperçu, sans contrainte de licence. Sélectionnable : le texte peut être copié depuis le PDF.' },
          h(Segmente, { valeur: r.pdfTexte, onChange: regler('pdfTexte'), options: [{ valeur: 'traces', libelle: 'Tracés' }, { valeur: 'selectionnable', libelle: 'Sélectionnable' }] })),
        h(Ligne, { etiquette: 'Rappel de sauvegarde', aide: 'L’outil te rappelle d’enregistrer une copie de tes articles dans Fichiers.' },
          h(Segmente, { valeur: r.rappelSauvegarde, onChange: regler('rappelSauvegarde'), options: [{ valeur: 'hebdomadaire', libelle: 'Chaque semaine' }, { valeur: 'mensuel', libelle: 'Chaque mois' }] }))));
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

  function App({ etatInitial }) {
    const [etat, dispatch] = useReducer(reducteur, etatInitial || { ...ETAT_INITIAL, reglages: { ...REGLAGES_INITIAUX, apparence: lireApparence() } });
    const systemeSombre = useModeSysteme();
    const [contexte, setContexte] = useState(() => ({ choisirPolice: fabriquerChoix(etat.polices), version: 0, ressources: etat.ressources, reglages: etat.reglages }));
    useEffect(() => { restaurer(dispatch); }, []);
    useEffect(() => {
      setContexte((c) => ({ choisirPolice: fabriquerChoix(etat.polices), version: c.version + 1, ressources: etat.ressources, reglages: etat.reglages }));
    }, [etat.polices.light, etat.polices.bold, etat.ressources.logo, etat.ressources.fleurs, etat.reglages]);
    useEffect(() => {
      try { racine.localStorage.setItem('postsop-apparence', etat.reglages.apparence); } catch (e) { /* stockage indisponible */ }
    }, [etat.reglages.apparence]);
    const mode = etat.reglages.apparence === 'auto' ? (systemeSombre ? 'sombre' : 'clair') : etat.reglages.apparence;
    const ecrans = { bibliotheque: Bibliotheque, atelier: Atelier, configuration: Configuration };
    return h(Contexte.Provider, { value: contexte },
      h('div', { className: 'app theme-' + mode },
        h('div', { className: 'bandeau-maquette' }, 'Maquette v2 · données d’exemple · propositions de l’IA simulées'),
        h(ecrans[etat.ecran], { etat, dispatch })));
  }

  const api = { App, reducteur, OP, ETAT_INITIAL, ARTICLES_INITIAUX, P, SLIDES_CLARA, fabriquerChoix, extraitAvecMarque };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    racine.addEventListener('DOMContentLoaded', () => {
      const conteneur = document.getElementById('racine');
      if (!racine.React || !racine.ReactDOM) {
        conteneur.textContent = 'Impossible de charger React : vérifie ta connexion Internet, puis recharge la page.';
        return;
      }
      racine.ReactDOM.createRoot(conteneur).render(h(App));
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
