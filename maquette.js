/*
 * PostsOP — Phase 1 : maquette interactive
 *
 * But : valider le parcours et l'organisation des écrans sur ton iPad.
 * Ce qui est réel : le rendu des slides (moteur de composition), les contrôles qualité,
 * le découpage sans IA d'un nouveau texte, la vérification orthographique LanguageTool,
 * l'import de tes polices.
 * Ce qui est simulé : les propositions de l'IA, les descriptions, la traduction, l'export.
 * Rien n'est enregistré, sauf tes polices.
 */
(function (racine) {
  'use strict';

  const React = racine.React || require('react');
  const M = racine.PostsOPMoteur || require('./moteur.js');
  const { createElement: h, Fragment, useState, useReducer, useEffect, useRef, useContext, createContext } = React;

  const NB = '\u00A0'; // espace insécable

  /* ================================================================== */
  /* 1. Données d'exemple                                                */
  /* ================================================================== */

  const TEXTE_CLARA = [
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
  const P = TEXTE_CLARA;

  // Découpage proposé : 6 slides, la troisième se termine sur la bascule pour donner envie de glisser.
  const SLIDES_CLARA = [
    { role: 'Couverture', blocs: [{ style: 'couverture', texte: 'Je crois que\nje vais\ndémissionner.' }, { style: 'contrepoint', texte: 'Pourtant,\nj’adore mon\ntravail.' }] },
    { role: 'Contexte', blocs: [{ style: 'corps', texte: P[1] }, { style: 'corps', texte: P[2] }, { style: 'corps', texte: P[3] }, { style: 'citation', texte: P[4] }] },
    { role: 'Bascule', blocs: [{ style: 'corps', texte: P[5] }, { style: 'corps', texte: P[6] }, { style: 'emphase', texte: P[7] }] },
    { role: 'Révélation', blocs: [{ style: 'corps', texte: P[8] }, { style: 'citation', texte: P[9] }] },
    { role: 'Enseignement', blocs: [{ style: 'corps', texte: P[10] }, { style: 'citation', texte: P[11] }, { style: 'corps', texte: P[12] }, { style: 'emphase', texte: P[13] }] },
    { role: 'Conclusion', blocs: [{ style: 'corps', texte: P[14] }], signature: true },
  ];

  // Traduction simulée de deux slides, pour montrer l'affichage côte à côte.
  const SLIDES_CLARA_EN = [
    { role: 'Couverture', blocs: [{ style: 'couverture', texte: 'I think\nI’m going\nto quit.' }, { style: 'contrepoint', texte: 'And yet,\nI love\nmy job.' }] },
    { role: 'Contexte', blocs: [
      { style: 'corps', texte: 'That’s what Clara, 32, told me during our first session.' },
      { style: 'corps', texte: 'For a few months now, her manager has barely spoken to her.' },
      { style: 'corps', texte: 'No open conflict, no criticism. Just increasingly cold emails, meetings she’s no longer invited to, and decisions she learns about after everyone else.' },
      { style: 'citation', texte: '“The worst part is, I don’t even know what I did wrong.”' }] },
  ];

  const FICHE = (selection, pertinence, objectif, message, poids, traitement, risques) =>
    ({ selection, pertinence, objectif, message, poids, traitement, risques });

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
        blocs: [{ style: 'couverture', texte: 'Je crois que\nje vais\ndémissionner.' }, { style: 'contrepoint', texte: 'Pourtant,\nj’adore mon\ntravail.' }],
        fiche: FICHE('« Je crois que je vais démissionner. Pourtant, j’adore mon travail. » (ouverture de l’article)',
          'C’est une parole de cliente qui contient un paradoxe.',
          'Arrêter le défilement par une contradiction qui appelle une explication.',
          'Le malaise au travail ne vient pas toujours du travail lui-même.',
          'Le paradoxe tient en deux temps : la couleur sépare le constat du contrepoint.',
          'Couverture en Bold ; contrepoint en vert sur fond bleu, en Light sur fond blanc ou vert.',
          'Aucun : c’est la première phrase de l’article, inchangée.'),
      },
      {
        id: 'a2',
        blocs: [{ style: 'couverture', texte: 'Le silence\nlaisse rarement\nun vide.' }],
        fiche: FICHE('« Le silence laisse rarement un vide. » (slide 5)',
          'C’est l’enseignement général du récit.',
          'Promettre une idée transposable plutôt qu’une histoire.',
          'Ce carrousel parle de ce que l’on imagine quand personne ne parle.',
          'Phrase courte et frappante, lisible en miniature.',
          'Couverture en Bold, une seule couleur.',
          'La phrase apparaîtrait deux fois, et l’ouverture de l’article ne serait plus dans les slides : l’outil le signalera.'),
      },
      {
        id: 'a3',
        blocs: [{ style: 'couverture', texte: `«${NB}On vivait\ndeux histoires\ncomplètement\ndifférentes${NB}!${NB}»` }],
        fiche: FICHE('« On vivait deux histoires complètement différentes ! » (slide 4)',
          'C’est la phrase de la bascule, dite par la cliente.',
          'Susciter la curiosité sur le malentendu.',
          'Deux personnes peuvent vivre la même situation de façons opposées.',
          'Citation directe, plus intime qu’un énoncé général.',
          'Couverture en Bold, entre guillemets.',
          'Sortie de son contexte, la citation peut sembler parler d’un couple : à garder en tête.'),
      },
    ],
    misesEnAvant: [
      {
        id: 'm1', slide: 2, statut: 'proposee',
        fiche: FICHE('« Et là, surprise. »',
          'C’est la bascule du récit : tout ce qui précède est relu à sa lumière.',
          'Finir la slide sur le retournement, pour donner envie de glisser vers la suite.',
          'Ce que Clara croyait n’était pas la réalité.',
          'Phrase courte et isolée : en gras, elle crée une respiration.',
          'Phrase-choc en Bold, à la taille du texte.',
          'Aucun : la formule est la tienne, inchangée.'),
      },
      {
        id: 'm2', slide: 4, statut: 'proposee',
        fiche: FICHE('« Le silence laisse rarement un vide. Notre cerveau s’empresse de le remplir, souvent avec nos propres peurs. »',
          'C’est l’enseignement général tiré du cas.',
          'Permettre au lecteur de transposer l’histoire à sa propre situation.',
          'Nos interprétations du silence parlent souvent de nos peurs.',
          'C’est la phrase que le lecteur doit retenir et pouvoir citer.',
          'Phrase-choc en Bold.',
          '« souvent » nuance l’affirmation : à conserver tel quel.'),
      },
      {
        id: 'm3', slide: 1, statut: 'proposee',
        fiche: FICHE('Les trois citations de Clara (slides 2, 4 et 5)',
          'Elles donnent la voix de la cliente et rendent le récit crédible.',
          'Faire entendre le vécu, pas seulement le raconter.',
          'Ce sont ses mots, pas une interprétation.',
          'Elles rythment le récit : une citation par temps fort.',
          'Citation : verte sur fond bleu, avec un filet sur fond blanc ou vert.',
          'Vérifie que le prénom est modifié et que la cliente a donné son accord.'),
      },
    ],
  };

  const DESCRIPTIONS_CLARA = {
    instagram: {
      fr: `«${NB}Je crois que je vais démissionner. Pourtant, j’adore mon travail.${NB}»\n\nLe silence d’un manager peut laisser place à toutes nos peurs. L’histoire de Clara montre qu’une conversation courageuse peut tout changer.\n\nEt vous, avez-vous déjà interprété un silence au travail${NB}?`,
      en: '',
    },
    linkedin: {
      fr: `«${NB}Je crois que je vais démissionner. Pourtant, j’adore mon travail.${NB}»\n\nC’est ce que me confiait Clara lors de notre première séance. Son manager ne lui parlait presque plus, et elle ne savait pas pourquoi.\n\nLe silence laisse rarement un vide${NB}: notre cerveau s’empresse de le remplir, souvent avec nos propres peurs.\n\nSon histoire, en 6 slides.`,
      en: '',
    },
  };

  const ARTICLES_INITIAUX = [
    {
      id: 'clara', titre: 'Le silence au travail', statut: 'Prêt', reseau: 'instagram', format: 'carre', fond: 'bleu',
      langues: ['fr', 'en'], modifie: '11 oct.', texte: TEXTE_CLARA, slides: SLIDES_CLARA, slidesEn: SLIDES_CLARA_EN,
      propositions: PROPOSITIONS_CLARA, accroche: 'a1', descriptions: DESCRIPTIONS_CLARA,
    },
    {
      id: 'ex1', titre: 'Exemple · Prévenir les conflits', statut: 'Brouillon', reseau: 'linkedin', format: 'portrait', fond: 'blanc',
      langues: ['fr'], modifie: '9 oct.',
      texte: ['Prévenir les conflits et renouer un dialogue constructif.', 'Équipes, managers, dirigeants : elle aide chacun à retrouver de l’efficacité, du plaisir et du sens dans le cadre de sa mission et de sa place au sein de l’entreprise.'],
      slides: [
        { role: 'Couverture', blocs: [{ style: 'couverture', texte: 'Prévenir les conflits et renouer un dialogue constructif.' }] },
        { role: 'Conclusion', blocs: [{ style: 'corps', texte: 'Équipes, managers, dirigeants : elle aide chacun à retrouver de l’efficacité, du plaisir et du sens dans le cadre de sa mission et de sa place au sein de l’entreprise.' }], signature: true },
      ],
      slidesEn: [], propositions: null, accroche: null, descriptions: { instagram: { fr: '', en: '' }, linkedin: { fr: '', en: '' } },
    },
    {
      id: 'ex2', titre: 'Exemple · Gérer ses émotions', statut: 'Exporté', reseau: 'instagram', format: 'carre', fond: 'vert',
      langues: ['fr'], modifie: '2 oct.',
      texte: ['Savoir gérer ses émotions.', 'Dépasser son stress pour gagner en efficacité.'],
      slides: [
        { role: 'Couverture', blocs: [{ style: 'couverture', texte: 'Savoir gérer\nses émotions.' }] },
        { role: 'Conclusion', blocs: [{ style: 'emphase', texte: 'Dépasser son stress pour gagner en efficacité.' }], signature: true },
      ],
      slidesEn: [], propositions: null, accroche: null, descriptions: { instagram: { fr: '', en: '' }, linkedin: { fr: '', en: '' } },
    },
  ];

  const REGLAGES_INITIAUX = {
    automatisation: 'hybride', rythme: 'equilibre', motsMax: 90, depassement: 'demander', intensite: 'minimale',
    numero: false, glisser: false, signature: true, longueurDescription: 'moyenne', appelAction: true,
    reseauDefaut: 'instagram', formatDefaut: 'carre', langueDefaut: 'fr', resolution: '2', pdfTexte: 'traces',
    ia: 'aucun', rappelSauvegarde: 'hebdomadaire',
  };

  const ETAPES = [
    { id: 'texte', nom: 'Texte' },
    { id: 'structure', nom: 'Structure' },
    { id: 'design', nom: 'Design' },
    { id: 'description', nom: 'Description' },
    { id: 'export', nom: 'Export' },
  ];

  const ETAT_INITIAL = {
    ecran: 'bibliotheque', articleId: null, etape: 'texte', langue: 'fr', slide: 0,
    onglet: 'charte', feuille: null, message: null,
    articles: ARTICLES_INITIAUX, reglages: REGLAGES_INITIAUX, polices: { light: null, bold: null, noms: {} },
  };

  /* ================================================================== */
  /* 2. État de la maquette                                              */
  /* ================================================================== */

  function majArticle(etat, id, maj) {
    return { ...etat, articles: etat.articles.map((a) => (a.id === id ? maj(a) : a)) };
  }

  function reducteur(etat, action) {
    switch (action.type) {
      case 'ecran':
        return { ...etat, ecran: action.ecran, feuille: null, message: null };
      case 'ouvrir':
        return { ...etat, ecran: 'atelier', articleId: action.id, etape: 'texte', slide: 0, langue: 'fr', message: null };
      case 'etape':
        return { ...etat, etape: action.etape, message: null };
      case 'langue':
        return { ...etat, langue: action.langue };
      case 'slide':
        return { ...etat, slide: action.index };
      case 'onglet':
        return { ...etat, onglet: action.onglet };
      case 'feuille':
        return { ...etat, feuille: action.feuille };
      case 'message':
        return { ...etat, message: action.message };
      case 'article':
        return majArticle(etat, action.id, action.maj);
      case 'reglage':
        return { ...etat, reglages: { ...etat.reglages, [action.cle]: action.valeur } };
      case 'polices':
        return { ...etat, polices: { ...etat.polices, ...action.polices, noms: { ...etat.polices.noms, ...(action.noms || {}) } } };
      case 'creer':
        return { ...etat, articles: [action.article, ...etat.articles], ecran: 'atelier', articleId: action.article.id, etape: 'structure', slide: 0, feuille: null, langue: 'fr' };
      case 'dupliquer': {
        const source = etat.articles.find((a) => a.id === action.id);
        const copie = { ...source, id: source.id + '-copie-' + etat.articles.length, titre: source.titre + ' (copie)', statut: 'Brouillon', modifie: 'à l’instant' };
        const index = etat.articles.indexOf(source);
        const articles = [...etat.articles];
        articles.splice(index + 1, 0, copie);
        return { ...etat, articles };
      }
      default:
        return etat;
    }
  }

  // Opérations sur un article (renvoient un nouvel article).
  const OP = {
    deplacerSlide: (i, delta) => (a) => {
      const j = i + delta;
      if (j < 0 || j >= a.slides.length) return a;
      const slides = [...a.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...a, slides };
    },
    modifierBloc: (i, b, champs) => (a) => ({
      ...a,
      slides: a.slides.map((s, k) => (k !== i ? s : { ...s, blocs: s.blocs.map((bloc, n) => (n === b ? { ...bloc, ...champs } : bloc)) })),
    }),
    gabarit: (i, gabarit) => (a) => ({
      ...a,
      slides: a.slides.map((s, k) => {
        if (k !== i) return s;
        if (gabarit === 'couverture') return { ...s, role: 'Couverture', blocs: s.blocs.map((b, n) => ({ ...b, style: n === 0 ? 'couverture' : 'contrepoint' })) };
        if (gabarit === 'enonce') return { ...s, blocs: s.blocs.map((b) => ({ ...b, style: 'emphase' })) };
        return { ...s, role: s.role === 'Couverture' ? 'Développement' : s.role, blocs: s.blocs.map((b) => ({ ...b, style: b.style === 'couverture' || b.style === 'contrepoint' ? 'corps' : b.style })) };
      }),
    }),
    champ: (cle, valeur) => (a) => ({ ...a, [cle]: valeur }),
    texte: (paragraphes) => (a) => ({ ...a, texte: paragraphes }),
    accroche: (accroche) => (a) => ({ ...a, accroche: accroche.id, slides: a.slides.map((s, k) => (k === 0 ? { ...s, role: 'Couverture', blocs: accroche.blocs } : s)) }),
    statutMiseEnAvant: (id, statut) => (a) => ({
      ...a,
      propositions: { ...a.propositions, misesEnAvant: a.propositions.misesEnAvant.map((m) => (m.id === id ? { ...m, statut } : m)) },
    }),
    selectionMiseEnAvant: (id, selection) => (a) => ({
      ...a,
      propositions: { ...a.propositions, misesEnAvant: a.propositions.misesEnAvant.map((m) => (m.id === id ? { ...m, fiche: { ...m.fiche, selection } } : m)) },
    }),
    toutAccepter: () => (a) => ({
      ...a,
      propositions: { ...a.propositions, misesEnAvant: a.propositions.misesEnAvant.map((m) => (m.statut === 'proposee' ? { ...m, statut: 'acceptee' } : m)) },
    }),
    description: (reseau, langue, texte) => (a) => ({
      ...a,
      descriptions: { ...a.descriptions, [reseau]: { ...a.descriptions[reseau], [langue]: texte } },
    }),
  };

  /* ================================================================== */
  /* 3. Polices (réel) : import, mémorisation, choix                     */
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

  // Cherche tes polices dans la maquette, puis dans le banc d'essai (même adresse).
  async function restaurerPolices(dispatch) {
    if (typeof opentype === 'undefined' || typeof indexedDB === 'undefined') return;
    for (const role of ['light', 'bold']) {
      try {
        const trouvee = (await lireBase('postsop', 'ressources', 'police-' + role))
          || (await lireBase('contentshelper-phase0', 'kv', 'police-' + role));
        if (trouvee) {
          dispatch({ type: 'polices', polices: { [role]: opentype.parse(trouvee.octets) }, noms: { [role]: trouvee.nom } });
        }
      } catch (erreur) { /* police illisible : on garde le rendu approché */ }
    }
  }

  const ContextePolices = createContext({ choisirPolice: null, version: 0 });

  function fabriquerChoix(polices) {
    const systeme = { light: null, bold: null };
    return (role) => {
      if (polices[role]) return M.policeExacte(polices[role]);
      if (!systeme[role]) systeme[role] = M.policeSysteme(role === 'bold' ? 700 : 300);
      return systeme[role];
    };
  }

  /* ================================================================== */
  /* 4. Composants de base                                               */
  /* ================================================================== */

  const Icone = ({ nom }) => {
    const traces = {
      retour: 'M15 5l-7 7 7 7',
      reglages: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
      plus: 'M12 5v14M5 12h14',
      gauche: 'M14 6l-6 6 6 6',
      droite: 'M10 6l6 6-6 6',
    };
    return h('svg', { className: 'icone', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      h('path', { d: traces[nom], fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  };

  function Bouton({ variante = 'secondaire', onClick, disabled, children, titre }) {
    return h('button', { className: 'bouton ' + variante, onClick, disabled, title: titre, type: 'button' }, children);
  }

  function Segmente({ options, valeur, onChange, etiquette }) {
    return h('div', { className: 'segmente', role: 'group', 'aria-label': etiquette },
      options.map((o) => h('button', {
        key: o.valeur, type: 'button', 'aria-pressed': o.valeur === valeur,
        onClick: () => onChange(o.valeur),
      }, o.libelle)));
  }

  function Pastille({ ton = 'neutre', children }) {
    return h('span', { className: 'pastille ' + ton }, children);
  }

  function Carte({ titre, sousTitre, children, actions, classe }) {
    return h('section', { className: 'carte ' + (classe || '') },
      (titre || actions) && h('div', { className: 'carte-tete' },
        h('div', null, titre && h('h3', null, titre), sousTitre && h('p', { className: 'doux' }, sousTitre)),
        actions && h('div', { className: 'carte-actions' }, actions)),
      children);
  }

  function Ligne({ etiquette, aide, children }) {
    return h('div', { className: 'ligne-reglage' },
      h('div', null, h('div', { className: 'ligne-etiquette' }, etiquette), aide && h('div', { className: 'doux petit' }, aide)),
      h('div', { className: 'ligne-controle' }, children));
  }

  function SlideCanvas({ slide, formatId, fondId, largeur, onClick, selectionnee, etiquette }) {
    const ref = useRef(null);
    const { choisirPolice, version } = useContext(ContextePolices);
    const fmt = M.FORMATS[formatId];
    const hauteur = Math.round((largeur * fmt.h) / fmt.l);
    useEffect(() => {
      const canvas = ref.current;
      if (!canvas || !choisirPolice) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(largeur * ratio);
      canvas.height = Math.round(hauteur * ratio);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / fmt.l, 0, 0, canvas.height / fmt.h, 0, 0);
      M.dessiner(ctx, M.composer(slide, formatId, fondId, choisirPolice));
    }, [slide, formatId, fondId, largeur, hauteur, version, choisirPolice]);
    return h('canvas', {
      ref, role: 'img', 'aria-label': etiquette || 'Slide',
      className: 'slide' + (selectionnee ? ' selectionnee' : '') + (onClick ? ' cliquable' : ''),
      style: { width: largeur + 'px', height: hauteur + 'px' }, onClick,
    });
  }

  // Largeur disponible d'un conteneur, pour dimensionner l'aperçu.
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

  /* ================================================================== */
  /* 5. Bibliothèque                                                     */
  /* ================================================================== */

  const TON_STATUT = { Brouillon: 'neutre', Prêt: 'ok', Exporté: 'info' };

  function Bibliotheque({ etat, dispatch }) {
    return h(Fragment, null,
      h('header', { className: 'barre' },
        h('div', { className: 'barre-gauche' }, h('span', { className: 'marque' }, 'PostsOP')),
        h('div', { className: 'barre-droite' },
          h(Bouton, { variante: 'icone', titre: 'Configuration', onClick: () => dispatch({ type: 'ecran', ecran: 'configuration' }) }, h(Icone, { nom: 'reglages' })),
          h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'feuille', feuille: 'nouvel' }) }, h(Icone, { nom: 'plus' }), 'Nouvel article'))),
      h('main', { className: 'contenu' },
        h('h1', null, 'Articles'),
        h('div', { className: 'grille-articles' },
          etat.articles.map((a) => h('article', { key: a.id, className: 'carte-article' },
            h('button', { type: 'button', className: 'carte-article-ouvrir', onClick: () => dispatch({ type: 'ouvrir', id: a.id }), 'aria-label': 'Ouvrir ' + a.titre },
              h('div', { className: 'vignette' }, h(SlideCanvas, { slide: a.slides[0], formatId: a.format, fondId: a.fond, largeur: 220, etiquette: 'Couverture de ' + a.titre })),
              h('div', { className: 'carte-article-texte' },
                h('div', { className: 'carte-article-titre' }, a.titre),
                h('div', { className: 'doux petit' }, `${a.slides.length} slides · ${M.FORMATS[a.format].nom} · ${a.reseau === 'instagram' ? 'Instagram' : 'LinkedIn'}`),
                h('div', { className: 'carte-article-pied' },
                  h(Pastille, { ton: TON_STATUT[a.statut] }, a.statut),
                  h('span', { className: 'doux petit' }, a.langues.map((l) => l.toUpperCase()).join(' · ') + ' · ' + a.modifie)))),
            h('button', { type: 'button', className: 'lien petit', onClick: () => dispatch({ type: 'dupliquer', id: a.id }) }, 'Dupliquer'))))),
      etat.feuille === 'nouvel' && h(FeuilleNouvelArticle, { etat, dispatch }));
  }

  function FeuilleNouvelArticle({ etat, dispatch }) {
    const r = etat.reglages;
    const [texte, setTexte] = useState('');
    const [reseau, setReseau] = useState(r.reseauDefaut);
    const [format, setFormat] = useState(r.formatDefaut);
    const [fond, setFond] = useState('bleu');
    const { choisirPolice } = useContext(ContextePolices);
    const paragraphes = texte.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);

    function creer() {
      const slides = M.decouperMecaniquement(paragraphes, format, fond, choisirPolice);
      const premier = paragraphes[0] || 'Nouvel article';
      const article = {
        id: 'nouveau-' + etat.articles.length, titre: premier.length > 40 ? premier.slice(0, 40) + '…' : premier,
        statut: 'Brouillon', reseau, format, fond, langues: ['fr'], modifie: 'à l’instant',
        texte: paragraphes, slides, slidesEn: [], propositions: null, accroche: null,
        descriptions: { instagram: { fr: '', en: '' }, linkedin: { fr: '', en: '' } },
      };
      dispatch({ type: 'creer', article });
    }

    return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nouvel article' },
      h('div', { className: 'feuille' },
        h('div', { className: 'feuille-tete' },
          h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'feuille', feuille: null }) }, 'Annuler'),
          h('h2', null, 'Nouvel article'),
          h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: creer }, 'Créer')),
        h('div', { className: 'feuille-corps' },
          h('label', { className: 'etiquette', htmlFor: 'texte-nouvel' }, 'Texte de l’article'),
          h('textarea', { id: 'texte-nouvel', className: 'zone-texte', rows: 9, value: texte, placeholder: 'Colle ici le texte de ton article Word.', onChange: (e) => setTexte(e.target.value) }),
          h('p', { className: 'doux petit' }, paragraphes.length
            ? `${paragraphes.length} paragraphe(s) · ${M.compterMots(texte)} mots. Le découpage en slides se fera sans IA, paragraphe par paragraphe.`
            : 'L’import direct d’un fichier Word arrivera en phase 3.'),
          h(Ligne, { etiquette: 'Réseau' }, h(Segmente, { valeur: reseau, onChange: setReseau, options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
          h(Ligne, { etiquette: 'Format' }, h(Segmente, { valeur: format, onChange: setFormat, options: [{ valeur: 'carre', libelle: 'Carré 1:1' }, { valeur: 'portrait', libelle: 'Portrait 4:5' }] })),
          h(Ligne, { etiquette: 'Fond', aide: 'Il pourra changer ensuite.' }, h(Segmente, { valeur: fond, onChange: setFond, options: Object.entries(M.FONDS).map(([v, f]) => ({ valeur: v, libelle: f.nom })) })))));
  }

  /* ================================================================== */
  /* 6. Atelier                                                          */
  /* ================================================================== */

  function Atelier({ etat, dispatch }) {
    const article = etat.articles.find((a) => a.id === etat.articleId);
    const majA = (maj) => dispatch({ type: 'article', id: article.id, maj });
    const proprietes = { etat, dispatch, article, majA };
    const vues = { texte: EtapeTexte, structure: EtapeStructure, design: EtapeDesign, description: EtapeDescription, export: EtapeExport };
    const index = ETAPES.findIndex((e) => e.id === etat.etape);
    return h(Fragment, null,
      h('header', { className: 'barre' },
        h('div', { className: 'barre-gauche' },
          h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles')),
        h('div', { className: 'barre-titre' }, article.titre),
        h('div', { className: 'barre-droite' },
          h(Segmente, { etiquette: 'Langue', valeur: etat.langue, onChange: (l) => dispatch({ type: 'langue', langue: l }), options: [{ valeur: 'fr', libelle: 'FR' }, { valeur: 'en', libelle: 'EN' }] }))),
      h('nav', { className: 'etapes', 'aria-label': 'Étapes' },
        ETAPES.map((e, i) => h('button', {
          key: e.id, type: 'button', className: 'etape' + (e.id === etat.etape ? ' active' : '') + (i < index ? ' faite' : ''),
          onClick: () => dispatch({ type: 'etape', etape: e.id }),
        }, h('span', { className: 'etape-num' }, i + 1), e.nom))),
      etat.message && h('div', { className: 'message', role: 'status' }, etat.message,
        h('button', { type: 'button', className: 'lien petit', onClick: () => dispatch({ type: 'message', message: null }) }, 'Fermer')),
      h('main', { className: 'contenu atelier' }, h(vues[etat.etape], proprietes)),
      h('footer', { className: 'pied-etapes' },
        h(Bouton, { disabled: index === 0, onClick: () => dispatch({ type: 'etape', etape: ETAPES[index - 1].id }) }, 'Étape précédente'),
        index < ETAPES.length - 1
          ? h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'etape', etape: ETAPES[index + 1].id }) }, 'Continuer : ' + ETAPES[index + 1].nom)
          : h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, 'Terminer')));
  }

  /* ---------- Étape 1 : Texte ---------- */

  function EtapeTexte({ etat, dispatch, article, majA }) {
    const [verification, setVerification] = useState({ etat: 'repos', erreurs: [], detail: '' });
    const [intention, setIntention] = useState(null);
    const texteComplet = article.texte.join('\n\n');
    const enAnglais = etat.langue === 'en';

    async function verifier() {
      setVerification({ etat: 'encours', erreurs: [], detail: '' });
      try {
        const reponse = await fetch('https://api.languagetool.org/v2/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      const debut = texteComplet.slice(0, erreur.offset);
      const fin = texteComplet.slice(erreur.offset + erreur.length);
      const ecart = remplacement.length - erreur.length;
      majA(OP.texte((debut + remplacement + fin).split('\n\n')));
      setVerification((v) => ({
        ...v,
        erreurs: v.erreurs.filter((e) => e !== erreur).map((e) => (e.offset > erreur.offset ? { ...e, offset: e.offset + ecart } : e)),
      }));
    }

    const ignorer = (erreur) => setVerification((v) => ({ ...v, erreurs: v.erreurs.filter((e) => e !== erreur) }));

    return h('div', { className: 'deux-colonnes' },
      h('div', { className: 'colonne-principale' },
        enAnglais && h('div', { className: 'note' }, 'Le texte anglais est généré à partir de la version française validée (phase 7). Ici, tu travailles le texte français.'),
        h(Carte, { titre: 'Texte de l’article', sousTitre: `${article.texte.length} paragraphes · ${M.compterMots(texteComplet)} mots. Une ligne vide sépare deux paragraphes.` },
          h('textarea', {
            className: 'zone-texte grande', rows: 22, value: texteComplet, 'aria-label': 'Texte de l’article',
            onChange: (e) => majA(OP.texte(e.target.value.split('\n\n'))),
          }))),
      h('aside', { className: 'panneau' },
        h(Carte, { titre: 'Typographie', sousTitre: 'Règles fixes, sans IA, appliquées automatiquement.' },
          h('ul', { className: 'liste-simple' },
            h('li', null, 'Espaces insécables avant : ; ! ?'),
            h('li', null, 'Guillemets « » et apostrophes typographiques'),
            h('li', null, 'Points de suspension en un seul caractère'))),
        h(Carte, {
          titre: 'Orthographe et grammaire',
          sousTitre: 'Vérification réelle avec LanguageTool. Chaque correction attend ton accord.',
          actions: h(Bouton, { onClick: verifier, disabled: verification.etat === 'encours' }, verification.etat === 'encours' ? 'Vérification…' : 'Vérifier'),
        },
        verification.etat === 'erreur' && h('p', { className: 'erreur petit' }, 'Vérification impossible : ' + verification.detail),
        verification.etat === 'fait' && !verification.erreurs.length && h('p', { className: 'ok petit' }, 'Aucune faute détectée.'),
        verification.erreurs.map((e, i) => h('div', { key: e.offset + '-' + i, className: 'correction' },
          h('div', { className: 'petit' }, h('span', { className: 'barre-mot' }, texteComplet.substr(e.offset, e.length)), ' → ', h('strong', null, e.replacements[0].value)),
          h('div', { className: 'doux petit' }, e.message),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'principal petit', onClick: () => corriger(e, e.replacements[0].value) }, 'Corriger'),
            h(Bouton, { variante: 'petit', onClick: () => ignorer(e) }, 'Ignorer')))),
        h('p', { className: 'mention' }, 'Correction fournie par ', h('a', { href: 'https://languagetool.org', target: '_blank', rel: 'noopener' }, 'LanguageTool'), '.')),
        h(Carte, { titre: 'Suggestions de style', sousTitre: 'Sur l’article entier ou un passage sélectionné.' },
          h('div', { className: 'puces' },
            ['Clarifier', 'Raccourcir', 'Restructurer', 'Plus percutant', 'Varier les tournures'].map((nom) => h('button', {
              key: nom, type: 'button', className: 'puce' + (intention === nom ? ' active' : ''), onClick: () => setIntention(nom),
            }, nom))),
          intention && h(PropositionStyle, { intention, dispatch }))));
  }

  // Exemple simulé : montre la présentation d'une suggestion, sans IA réelle.
  function PropositionStyle({ intention, dispatch }) {
    const original = TEXTE_CLARA[12];
    const versions = [
      'Cette histoire me touche. On parle beaucoup de communication au travail, mais rarement de ce qu’on imagine quand elle disparaît.',
      'On parle beaucoup de communication au travail. Bien moins de ce qu’on imagine quand elle disparaît.',
    ];
    return h('div', { className: 'suggestion' },
      h(Pastille, { ton: 'info' }, 'Exemple simulé · ' + intention),
      h('div', { className: 'doux petit' }, 'Passage :'),
      h('blockquote', null, original),
      versions.map((v, i) => h('div', { key: i, className: 'version' },
        h('div', { className: 'petit' }, h('strong', null, 'Version ' + (i + 1) + ' : '), v),
        h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'message', message: 'Maquette : la suggestion n’est pas appliquée. Dans l’outil, elle remplacera le passage après ton accord.' }) }, 'Utiliser'))),
      h('div', { className: 'alerte-sens petit' }, '⚠︎ Glissement de sens possible : « finalement assez peu » devient « rarement ». La nuance est un peu renforcée.'));
  }

  /* ---------- Étape 2 : Structure ---------- */

  function EtapeStructure({ etat, dispatch, article, majA }) {
    const { choisirPolice } = useContext(ContextePolices);
    const limite = M.LIMITES_SLIDES[article.reseau];
    const slidesAffichees = etat.langue === 'en' ? article.slides.map((s, i) => article.slidesEn[i] || null) : article.slides;
    const p = article.propositions;
    const enAttente = p ? p.misesEnAvant.filter((m) => m.statut === 'proposee').length : 0;

    return h('div', { className: 'deux-colonnes' },
      h('div', { className: 'colonne-principale' },
        h('div', { className: 'resume-volume' },
          h('strong', null, `${article.slides.length} slides`), ` · limite ${article.reseau === 'instagram' ? 'Instagram' : 'LinkedIn'} : ${limite} · ${M.compterMots(article.texte.join(' '))} mots`),
        etat.langue === 'en' && h('div', { className: 'note' }, 'Vue côte à côte français / anglais. Dans la maquette, seules les deux premières slides sont traduites (traduction simulée).'),
        h('ol', { className: 'liste-slides' },
          article.slides.map((s, i) => h('li', { key: i, className: 'item-slide' + (i === etat.slide ? ' actif' : ''), onClick: () => dispatch({ type: 'slide', index: i }) },
            h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 120, etiquette: 'Slide ' + (i + 1) }),
            h('div', { className: 'item-slide-texte' },
              h('div', { className: 'item-slide-tete' }, h('span', { className: 'num' }, i + 1), h(Pastille, null, s.role),
                h('span', { className: 'doux petit' }, s.blocs.reduce((n, b) => n + M.compterMots(b.texte), 0) + ' mots')),
              h('p', { className: 'extrait' }, s.blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ')),
              etat.langue === 'en' && h('p', { className: 'extrait en' }, slidesAffichees[i]
                ? slidesAffichees[i].blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ')
                : 'Traduction à générer (phase 7).')))))),
      h('aside', { className: 'panneau' },
        !p
          ? h(Carte, { titre: 'Propositions de l’IA', sousTitre: 'Découpage sans IA, paragraphe par paragraphe.' },
            h('p', { className: 'petit' }, 'L’analyse éditoriale (compréhension, accroches, mises en avant justifiées) arrivera en phase 5. Ouvre l’article « Le silence au travail » pour voir comment elle se présentera.'),
            h(Bouton, { onClick: () => majA(OP.champ('slides', M.decouperMecaniquement(article.texte, article.format, article.fond, choisirPolice))) }, 'Redécouper le texte'))
          : h(Fragment, null,
            h('div', { className: 'bandeau-propositions' },
              h(Pastille, { ton: 'info' }, 'Propositions simulées'),
              h(Bouton, { variante: 'principal petit', disabled: !enAttente, onClick: () => majA(OP.toutAccepter()) }, enAttente ? `Tout accepter (${enAttente})` : 'Tout est traité')),
            h(Carte, { titre: 'Ce que l’IA a compris', sousTitre: 'À corriger si besoin : tout le reste en dépend.' },
              h('dl', { className: 'definitions' },
                ['sujet', 'message', 'intention', 'ton'].map((cle) => h(Fragment, { key: cle },
                  h('dt', null, { sujet: 'Sujet', message: 'Message central', intention: 'Intention', ton: 'Ton' }[cle]),
                  h('dd', null, p.comprehension[cle]))))),
            h(Carte, { titre: 'Accroche de couverture', sousTitre: 'Trois candidates tirées de ton texte.' },
              p.accroches.map((a, i) => h(CarteAccroche, {
                key: a.id, accroche: a, numero: i + 1, choisie: article.accroche === a.id,
                onChoisir: () => majA(OP.accroche(a)),
              }))),
            h(Carte, { titre: 'Mises en avant', sousTitre: 'Accepte, modifie ou refuse chaque proposition.' },
              p.misesEnAvant.map((m) => h(CarteMiseEnAvant, { key: m.id, proposition: m, majA, dispatch }))))));
  }

  function Fiche({ fiche, sauf }) {
    const libelles = [['selection', 'Sélection'], ['pertinence', 'Pourquoi'], ['objectif', 'Objectif'], ['message', 'Message au lecteur'], ['poids', 'Poids visuel'], ['traitement', 'Traitement'], ['risques', 'Risques']];
    return h('dl', { className: 'fiche' },
      libelles.filter(([cle]) => cle !== sauf).map(([cle, libelle]) => h(Fragment, { key: cle }, h('dt', null, libelle), h('dd', { className: cle === 'risques' ? 'risque' : '' }, fiche[cle]))));
  }

  function CarteAccroche({ accroche, numero, choisie, onChoisir }) {
    const [ouverte, setOuverte] = useState(numero === 1);
    return h('div', { className: 'proposition' + (choisie ? ' choisie' : '') },
      h('div', { className: 'proposition-tete' },
        h('div', { className: 'petit' }, h('strong', null, 'Accroche ' + numero), choisie && h(Pastille, { ton: 'ok' }, 'Retenue')),
        h('div', { className: 'actions-ligne' },
          h('button', { type: 'button', className: 'lien petit', onClick: () => setOuverte(!ouverte) }, ouverte ? 'Masquer' : 'Pourquoi ?'),
          !choisie && h(Bouton, { variante: 'petit', onClick: onChoisir }, 'Choisir'))),
      h('p', { className: 'citation-proposee' }, accroche.blocs.map((b) => b.texte.replace(/\n/g, ' ')).join(' ')),
      ouverte && h(Fiche, { fiche: accroche.fiche, sauf: 'selection' }));
  }

  function CarteMiseEnAvant({ proposition, majA, dispatch }) {
    const [ouverte, setOuverte] = useState(false);
    const [edition, setEdition] = useState(false);
    const m = proposition;
    const tons = { proposee: 'neutre', acceptee: 'ok', refusee: 'erreur' };
    const libelles = { proposee: 'Proposée', acceptee: 'Acceptée', refusee: 'Refusée' };
    return h('div', { className: 'proposition ' + m.statut },
      h('div', { className: 'proposition-tete' },
        h('div', { className: 'petit' }, h('strong', null, 'Slide ' + (m.slide + 1)), h(Pastille, { ton: tons[m.statut] }, libelles[m.statut])),
        h('button', { type: 'button', className: 'lien petit', onClick: () => setOuverte(!ouverte) }, ouverte ? 'Masquer' : 'Pourquoi ?')),
      edition
        ? h('textarea', { className: 'zone-texte', rows: 3, value: m.fiche.selection, onChange: (e) => majA(OP.selectionMiseEnAvant(m.id, e.target.value)), 'aria-label': 'Sélection' })
        : h('p', { className: 'citation-proposee' }, m.fiche.selection),
      ouverte && h(Fiche, { fiche: m.fiche, sauf: 'selection' }),
      h('div', { className: 'actions-ligne' },
        h(Bouton, { variante: 'principal petit', disabled: m.statut === 'acceptee', onClick: () => { setEdition(false); majA(OP.statutMiseEnAvant(m.id, 'acceptee')); } }, 'Accepter'),
        h(Bouton, { variante: 'petit', onClick: () => setEdition(!edition) }, edition ? 'Terminer' : 'Modifier'),
        h(Bouton, { variante: 'petit', disabled: m.statut === 'refusee', onClick: () => majA(OP.statutMiseEnAvant(m.id, 'refusee')) }, 'Refuser'),
        h('button', { type: 'button', className: 'lien petit', onClick: () => dispatch({ type: 'slide', index: m.slide }) }, 'Voir la slide')));
  }

  /* ---------- Étape 3 : Design ---------- */

  const GABARITS = [{ valeur: 'couverture', libelle: 'Couverture' }, { valeur: 'texte', libelle: 'Texte' }, { valeur: 'enonce', libelle: 'Énoncé' }];
  const STYLES_CHOIX = ['corps', 'emphase', 'citation', 'couverture', 'contrepoint'];

  function gabaritDe(slide) {
    if (slide.blocs.some((b) => b.style === 'couverture')) return 'couverture';
    if (slide.blocs.every((b) => b.style === 'emphase')) return 'enonce';
    return 'texte';
  }

  function EtapeDesign({ etat, dispatch, article, majA }) {
    const { choisirPolice } = useContext(ContextePolices);
    const [refApercu, largeurDispo] = useLargeur(520);
    const i = Math.min(etat.slide, article.slides.length - 1);
    const enAnglais = etat.langue === 'en';
    const slide = enAnglais && article.slidesEn[i] ? article.slidesEn[i] : article.slides[i];
    const compositions = article.slides.map((s) => M.composer(s, article.format, article.fond, choisirPolice));
    const alertes = M.controler(article, compositions, etat.reglages);
    const exacte = compositions.every((c) => c.exacte);
    const largeurApercu = Math.max(240, Math.min(largeurDispo, article.format === 'portrait' ? 480 : 600));

    return h('div', { className: 'deux-colonnes' },
      h('div', { className: 'colonne-principale' },
        enAnglais && h('div', { className: 'note' }, article.slidesEn[i] ? 'Version anglaise (traduction simulée).' : 'Pas encore de version anglaise pour cette slide : affichage du français.'),
        h('div', { className: 'zone-apercu', ref: refApercu },
          h(SlideCanvas, { slide, formatId: article.format, fondId: article.fond, largeur: largeurApercu, etiquette: 'Aperçu de la slide ' + (i + 1) })),
        !exacte && h('p', { className: 'doux petit centre' }, 'Rendu approché avec la Gill Sans de l’iPad. Importe tes fichiers dans Configuration › Ressources pour un rendu exact.'),
        h('div', { className: 'bande-miniatures', role: 'list' },
          article.slides.map((s, k) => h('div', { key: k, className: 'miniature', role: 'listitem' },
            h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 96, selectionnee: k === i, onClick: () => dispatch({ type: 'slide', index: k }), etiquette: 'Slide ' + (k + 1) }),
            h('div', { className: 'miniature-pied' },
              h('span', { className: 'petit' + (compositions[k].deborde ? ' erreur' : '') }, (compositions[k].deborde ? '⚠︎ ' : '') + (k + 1))))))),
      h('aside', { className: 'panneau' },
        h(Carte, { titre: 'Carrousel', sousTitre: 'S’applique à toutes les slides.' },
          h(Ligne, { etiquette: 'Fond' }, h(Segmente, { valeur: article.fond, onChange: (v) => majA(OP.champ('fond', v)), options: Object.entries(M.FONDS).map(([v, f]) => ({ valeur: v, libelle: f.nom })) })),
          h(Ligne, { etiquette: 'Format' }, h(Segmente, { valeur: article.format, onChange: (v) => majA(OP.champ('format', v)), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
          h(Ligne, { etiquette: 'Réseau' }, h(Segmente, { valeur: article.reseau, onChange: (v) => majA(OP.champ('reseau', v)), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] }))),
        h(Carte, {
          titre: 'Slide ' + (i + 1), sousTitre: article.slides[i].role,
          actions: h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'icone', titre: 'Avancer la slide', disabled: i === 0, onClick: () => { majA(OP.deplacerSlide(i, -1)); dispatch({ type: 'slide', index: i - 1 }); } }, h(Icone, { nom: 'gauche' })),
            h(Bouton, { variante: 'icone', titre: 'Reculer la slide', disabled: i === article.slides.length - 1, onClick: () => { majA(OP.deplacerSlide(i, 1)); dispatch({ type: 'slide', index: i + 1 }); } }, h(Icone, { nom: 'droite' }))),
        },
        h(Ligne, { etiquette: 'Gabarit' }, h(Segmente, { valeur: gabaritDe(article.slides[i]), onChange: (g) => majA(OP.gabarit(i, g)), options: GABARITS })),
        article.slides[i].blocs.map((b, n) => h('div', { key: n, className: 'bloc-edition' },
          h('select', { className: 'choix', value: b.style, 'aria-label': 'Style du paragraphe ' + (n + 1), onChange: (e) => majA(OP.modifierBloc(i, n, { style: e.target.value })) },
            STYLES_CHOIX.map((st) => h('option', { key: st, value: st }, M.STYLES[st].nom))),
          h('textarea', { className: 'zone-texte', rows: 3, value: b.texte, 'aria-label': 'Texte du paragraphe ' + (n + 1), onChange: (e) => majA(OP.modifierBloc(i, n, { texte: e.target.value })) })))),
        h(Carte, { titre: 'Contrôle qualité', sousTitre: alertes.length ? `${alertes.length} point(s) à regarder` : 'Tout est en ordre.' },
          alertes.length
            ? h('ul', { className: 'liste-alertes' }, alertes.map((a, k) => h('li', { key: k, className: a.niveau },
              a.slide !== null && h('button', { type: 'button', className: 'lien petit', onClick: () => dispatch({ type: 'slide', index: a.slide }) }, 'Slide ' + (a.slide + 1) + ' · '),
              a.message)))
            : h('p', { className: 'ok petit' }, 'Marges, densité, limite du réseau et intégrité du texte : OK.'))));
  }

  /* ---------- Étape 4 : Description ---------- */

  const LIMITES_DESCRIPTION = { instagram: 2200, linkedin: 3000 }; // valeurs indicatives, à vérifier

  function EtapeDescription({ etat, dispatch, article, majA }) {
    const langue = etat.langue;
    return h('div', { className: 'colonne-unique' },
      h('div', { className: 'note' }, 'Descriptions simulées pour la maquette. Dans l’outil, elles seront rédigées à partir de ton article seul, sans aucun fait ajouté.'),
      ['instagram', 'linkedin'].map((reseau) => {
        const texte = article.descriptions[reseau][langue] || '';
        return h(Carte, {
          key: reseau, titre: reseau === 'instagram' ? 'Légende Instagram' : 'Texte du post LinkedIn',
          sousTitre: reseau === 'instagram' ? 'Seules les premières lignes s’affichent avant « plus ».' : 'Il s’affiche au-dessus du document.',
          actions: h(Fragment, null,
            h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'message', message: 'Maquette : l’IA n’est pas branchée. La génération arrivera en phase 6.' }) }, 'Régénérer'),
            h(Bouton, {
              variante: 'petit',
              onClick: () => {
                if (navigator.clipboard) navigator.clipboard.writeText(texte).catch(() => {});
                dispatch({ type: 'message', message: 'Description copiée.' });
              },
            }, 'Copier')),
        },
        h('textarea', { className: 'zone-texte', rows: 9, value: texte, placeholder: langue === 'en' ? 'Description anglaise à générer après la traduction.' : 'Description à générer.', onChange: (e) => majA(OP.description(reseau, langue, e.target.value)), 'aria-label': 'Description ' + reseau }),
        h('div', { className: 'doux petit droite' }, `${texte.length} / ${LIMITES_DESCRIPTION[reseau]} caractères (limite indicative)`));
      }));
  }

  /* ---------- Étape 5 : Export ---------- */

  function EtapeExport({ etat, dispatch, article }) {
    const { choisirPolice } = useContext(ContextePolices);
    const compositions = article.slides.map((s) => M.composer(s, article.format, article.fond, choisirPolice));
    const bloquants = M.controler(article, compositions, etat.reglages).filter((a) => a.niveau === 'bloquant');
    const fichier = article.reseau === 'linkedin' ? 'Un PDF de ' + article.slides.length + ' pages' : article.slides.length + ' images PNG';
    return h('div', { className: 'colonne-unique' },
      h(Carte, {
        titre: 'Exporter', sousTitre: `${fichier} · ${M.FORMATS[article.format].nom} · fond ${M.FONDS[article.fond].nom.toLowerCase()}`,
        actions: h(Bouton, {
          variante: 'principal', disabled: bloquants.length > 0,
          onClick: () => dispatch({ type: 'message', message: 'Maquette : l’export réel arrive en phase 3. Le banc d’essai de la phase 0 l’a déjà validé sur ton iPad.' }),
        }, 'Exporter'),
      },
      bloquants.length
        ? h('p', { className: 'erreur petit' }, `Export bloqué : ${bloquants.length} point(s) à régler dans l’étape Design.`)
        : h('p', { className: 'ok petit' }, 'Prêt à exporter.')),
      h('div', { className: 'grille-export' },
        article.slides.map((s, k) => h('div', { key: k, className: 'export-item' },
          h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 180, etiquette: 'Slide ' + (k + 1) }),
          h('div', { className: 'doux petit centre' }, k + 1)))));
  }

  /* ================================================================== */
  /* 7. Configuration                                                    */
  /* ================================================================== */

  function Configuration({ etat, dispatch }) {
    const onglets = { charte: OngletCharte, ressources: OngletRessources, reglages: OngletReglages };
    return h(Fragment, null,
      h('header', { className: 'barre' },
        h('div', { className: 'barre-gauche' },
          h(Bouton, { variante: 'retour', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, h(Icone, { nom: 'retour' }), 'Articles')),
        h('div', { className: 'barre-titre' }, 'Configuration · Oh ! Potentiel'),
        h('div', { className: 'barre-droite' })),
      h('nav', { className: 'onglets' },
        h(Segmente, { etiquette: 'Onglets', valeur: etat.onglet, onChange: (o) => dispatch({ type: 'onglet', onglet: o }), options: [{ valeur: 'charte', libelle: 'Charte' }, { valeur: 'ressources', libelle: 'Ressources' }, { valeur: 'reglages', libelle: 'Réglages' }] })),
      h('main', { className: 'contenu colonne-unique' }, h(onglets[etat.onglet], { etat, dispatch })));
  }

  function OngletCharte() {
    const exemple = { role: 'Couverture', blocs: [{ style: 'couverture', texte: 'Le silence\nlaisse rarement' }, { style: 'contrepoint', texte: 'un vide.' }] };
    const exempleTexte = { role: 'Développement', blocs: [{ style: 'corps', texte: 'Depuis quelques mois, son manager ne lui parle presque plus.' }, { style: 'emphase', texte: 'Et là, surprise.' }, { style: 'citation', texte: `«${NB}Le pire, c’est que je ne sais même pas ce que j’ai fait de mal.${NB}»` }] };
    return h(Fragment, null,
      h(Carte, { titre: 'Couleurs', sousTitre: 'Tes références font foi.' },
        h('div', { className: 'nuancier' },
          [['Bleu Oh ! Potentiel', M.PALETTE.bleu, 'Pantone 547 U · RVB 0/56/70', 'Fonds et texte'],
            ['Vert Oh ! Potentiel', M.PALETTE.vert, 'Pantone 397 · écran #C9D420', 'Mots mis en valeur, fleurs, filets'],
            ['Blanc', M.PALETTE.blanc, '#FFFFFF', 'Fonds et texte']].map(([nom, code, ref, usage]) => h('div', { key: nom, className: 'pastille-couleur' },
            h('div', { className: 'echantillon', style: { background: code } }),
            h('div', null, h('div', { className: 'petit' }, h('strong', null, nom)), h('div', { className: 'doux petit' }, ref), h('div', { className: 'doux petit' }, usage)))))),
      h(Carte, { titre: 'Planche de validation', sousTitre: 'Les trois fonds autorisés, avec le texte, la phrase-choc et la citation.' },
        h('div', { className: 'planche' },
          Object.keys(M.FONDS).map((f) => h('div', { key: f, className: 'planche-colonne' },
            h(SlideCanvas, { slide: exemple, formatId: 'carre', fondId: f, largeur: 200, etiquette: 'Couverture fond ' + f }),
            h(SlideCanvas, { slide: exempleTexte, formatId: 'carre', fondId: f, largeur: 200, etiquette: 'Texte fond ' + f }),
            h('div', { className: 'petit centre' }, 'Fond ' + M.FONDS[f].nom.toLowerCase()))))),
      h(Carte, { titre: 'Typographie', sousTitre: 'Gill Sans MT, tailles calées sur tes carrousels actuels.' },
        h('table', { className: 'tableau' },
          h('thead', null, h('tr', null, ['Style', 'Police', 'Taille', 'Interligne', 'Couleur'].map((t) => h('th', { key: t }, t)))),
          h('tbody', null, Object.entries(M.STYLES).map(([cle, s]) => h('tr', { key: cle },
            h('td', null, s.nom), h('td', null, s.role === 'bold' ? 'Gill Sans MT Bold' : 'Gill Sans MT Light'),
            h('td', null, s.taille + ' px'), h('td', null, String(s.interligne).replace('.', ',')),
            h('td', null, s.couleur === 'accent' ? 'Mise en valeur' : 'Texte')))))),
      h(Carte, { titre: 'Règles', sousTitre: 'Le contrat que l’outil fait respecter.' },
        h('div', { className: 'regles' },
          h('div', null, h('h4', null, 'Obligatoire'), h('ul', { className: 'liste-simple' },
            h('li', null, 'Marge gauche de 81 px, texte aligné à gauche'),
            h('li', null, 'Un seul fond par carrousel'),
            h('li', null, 'Logo officiel sur la dernière slide'))),
          h('div', null, h('h4', null, 'Autorisé'), h('ul', { className: 'liste-simple' },
            h('li', null, 'Fond bleu, blanc ou vert, selon le carrousel'),
            h('li', null, 'Format 1:1 ou 4:5, selon la publication'),
            h('li', null, 'Couverture centrée verticalement'))),
          h('div', null, h('h4', null, 'Interdit'), h('ul', { className: 'liste-simple' },
            h('li', null, 'Texte vert sur fond blanc'),
            h('li', null, 'Texte blanc sur fond vert'),
            h('li', null, 'Texte sous la taille minimale de la charte'))))));
  }

  function OngletRessources({ etat, dispatch }) {
    const [etatImport, setEtatImport] = useState('');
    async function importer(role, fichier) {
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
    const statutPolice = (role) => (etat.polices[role] ? h(Pastille, { ton: 'ok' }, etat.polices.noms[role] || 'Importée') : h(Pastille, null, 'Rendu approché'));
    return h(Fragment, null,
      h(Carte, { titre: 'Polices', sousTitre: 'Elles restent sur cet iPad, jamais sur GitHub.' },
        h(Ligne, { etiquette: 'Gill Sans MT Light', aide: 'Texte courant et citations' }, statutPolice('light'),
          h('input', { type: 'file', 'aria-label': 'Importer Gill Sans MT Light', onChange: (e) => importer('light', e.target.files[0]) })),
        h(Ligne, { etiquette: 'Gill Sans MT Bold', aide: 'Couverture et phrases-chocs' }, statutPolice('bold'),
          h('input', { type: 'file', 'aria-label': 'Importer Gill Sans MT Bold', onChange: (e) => importer('bold', e.target.files[0]) })),
        etatImport && h('p', { className: 'petit' }, etatImport)),
      h(Carte, { titre: 'Logos' },
        h(Ligne, { etiquette: 'Logo fond blanc (JPG)', aide: 'Utilisable sur fond blanc uniquement' }, h(Pastille, { ton: 'ok' }, 'Reçu')),
        h(Ligne, { etiquette: 'Logo fond bleu (JPG)', aide: 'Son bleu diffère de la référence : un rectangle serait visible' }, h(Pastille, { ton: 'attention' }, 'À remplacer')),
        h(Ligne, { etiquette: 'Logo sans fond (SVG ou PNG)', aide: 'Nécessaire pour les fonds bleu et vert' }, h(Pastille, { ton: 'erreur' }, 'Manquant'))),
      h(Carte, { titre: 'Motifs et références' },
        h(Ligne, { etiquette: 'Fleurs (PNG transparent)', aide: '696 × 275 px · nettes jusqu’à environ 350 px de large en export ×2' }, h(Pastille, { ton: 'ok' }, 'Reçu')),
        h(Ligne, { etiquette: 'Carrousel « Clara » (4 slides)', aide: 'Référence de composition et de ton' }, h(Pastille, { ton: 'ok' }, 'Reçu')),
        h(Ligne, { etiquette: 'Plaquette PDF', aide: 'Référence de couleurs et de typographie' }, h(Pastille, { ton: 'ok' }, 'Reçu'))));
  }

  function OngletReglages({ etat, dispatch }) {
    const r = etat.reglages;
    const regler = (cle) => (valeur) => dispatch({ type: 'reglage', cle, valeur });
    const interrupteur = (cle) => h('label', { className: 'interrupteur' },
      h('input', { type: 'checkbox', checked: r[cle], onChange: (e) => regler(cle)(e.target.checked) }), h('span', null));
    return h(Fragment, null,
      h('p', { className: 'note' }, 'Maquette : les réglages changent l’affichage quand c’est possible, mais ne sont pas enregistrés.'),
      h(Carte, { titre: 'Travail éditorial' },
        h(Ligne, { etiquette: 'Niveau d’automatisation', aide: 'Hybride : tout est proposé, tu valides d’un geste ou en détail.' },
          h(Segmente, { valeur: r.automatisation, onChange: regler('automatisation'), options: [{ valeur: 'hybride', libelle: 'Hybride' }, { valeur: 'etapes', libelle: 'Étape par étape' }] })),
        h(Ligne, { etiquette: 'Intensité des suggestions' },
          h(Segmente, { valeur: r.intensite, onChange: regler('intensite'), options: [{ valeur: 'minimale', libelle: 'Changement minimal' }, { valeur: 'libre', libelle: 'Plus libre' }] })),
        h(Ligne, { etiquette: 'Fournisseur d’IA', aide: 'Choix en attente : la clé Mistral gratuite n’est pas disponible pour l’instant.' },
          h(Segmente, { valeur: r.ia, onChange: regler('ia'), options: [{ valeur: 'mistral', libelle: 'Mistral' }, { valeur: 'gemini', libelle: 'Gemini' }, { valeur: 'aucun', libelle: 'Aucun' }] }))),
      h(Carte, { titre: 'Mise en page' },
        h(Ligne, { etiquette: 'Rythme visuel', aide: 'Alternance entre slides denses et slides « respiration ».' },
          h(Segmente, { valeur: r.rythme, onChange: regler('rythme'), options: [{ valeur: 'regulier', libelle: 'Régulier' }, { valeur: 'equilibre', libelle: 'Équilibré' }, { valeur: 'contraste', libelle: 'Contrasté' }] })),
        h(Ligne, { etiquette: 'Mots maximum par slide', aide: `Tes carrousels actuels montent à 90 mots. Réglage : ${r.motsMax}.` },
          h('input', { type: 'range', min: 30, max: 120, step: 5, value: r.motsMax, onChange: (e) => regler('motsMax')(Number(e.target.value)), 'aria-label': 'Mots maximum par slide' })),
        h(Ligne, { etiquette: 'Si la limite de slides est dépassée' },
          h(Segmente, { valeur: r.depassement, onChange: regler('depassement'), options: [{ valeur: 'demander', libelle: 'Me demander' }, { valeur: 'densifier', libelle: 'Densifier' }, { valeur: 'serie', libelle: 'Série' }] })),
        h(Ligne, { etiquette: 'Numéro de slide' }, interrupteur('numero')),
        h(Ligne, { etiquette: 'Indicateur « glisser »' }, interrupteur('glisser')),
        h(Ligne, { etiquette: 'Logo sur la dernière slide' }, interrupteur('signature'))),
      h(Carte, { titre: 'Par défaut pour un nouvel article' },
        h(Ligne, { etiquette: 'Réseau' }, h(Segmente, { valeur: r.reseauDefaut, onChange: regler('reseauDefaut'), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
        h(Ligne, { etiquette: 'Format' }, h(Segmente, { valeur: r.formatDefaut, onChange: regler('formatDefaut'), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })),
        h(Ligne, { etiquette: 'Description', aide: 'Longueur visée et appel à réagir en fin de texte.' },
          h(Segmente, { valeur: r.longueurDescription, onChange: regler('longueurDescription'), options: [{ valeur: 'courte', libelle: 'Courte' }, { valeur: 'moyenne', libelle: 'Moyenne' }, { valeur: 'longue', libelle: 'Longue' }] }))),
      h(Carte, { titre: 'Export et sauvegarde' },
        h(Ligne, { etiquette: 'Résolution des PNG' }, h(Segmente, { valeur: r.resolution, onChange: regler('resolution'), options: [{ valeur: '1', libelle: '×1' }, { valeur: '2', libelle: '×2' }] })),
        h(Ligne, { etiquette: 'Texte du PDF', aide: 'Tracés : identiques à l’aperçu et sans contrainte de licence.' },
          h(Segmente, { valeur: r.pdfTexte, onChange: regler('pdfTexte'), options: [{ valeur: 'traces', libelle: 'Tracés' }, { valeur: 'selectionnable', libelle: 'Sélectionnable' }] })),
        h(Ligne, { etiquette: 'Rappel de sauvegarde' },
          h(Segmente, { valeur: r.rappelSauvegarde, onChange: regler('rappelSauvegarde'), options: [{ valeur: 'hebdomadaire', libelle: 'Chaque semaine' }, { valeur: 'mensuel', libelle: 'Chaque mois' }] }))));
  }

  /* ================================================================== */
  /* 8. Application                                                      */
  /* ================================================================== */

  function App({ etatInitial }) {
    const [etat, dispatch] = useReducer(reducteur, etatInitial || ETAT_INITIAL);
    const [contexte, setContexte] = useState(() => ({ choisirPolice: fabriquerChoix(etat.polices), version: 0 }));
    useEffect(() => { restaurerPolices(dispatch); }, []);
    useEffect(() => {
      setContexte((c) => ({ choisirPolice: fabriquerChoix(etat.polices), version: c.version + 1 }));
    }, [etat.polices.light, etat.polices.bold]);
    const ecrans = { bibliotheque: Bibliotheque, atelier: Atelier, configuration: Configuration };
    return h(ContextePolices.Provider, { value: contexte },
      h('div', { className: 'app' },
        h('div', { className: 'bandeau-maquette' }, 'Maquette · données d’exemple · propositions de l’IA simulées · rien n’est enregistré, sauf tes polices'),
        h(ecrans[etat.ecran], { etat, dispatch })));
  }

  const api = { App, reducteur, OP, ETAT_INITIAL, ARTICLES_INITIAUX, TEXTE_CLARA, SLIDES_CLARA, fabriquerChoix };
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
