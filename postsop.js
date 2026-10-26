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
  // Modules secondaires : s'il en manque un sur GitHub, l'app démarre quand même et le bandeau « Mise à jour incomplète » le nomme.
  const facultatif = (globale, fichier) => racine[globale] || (typeof require === 'function' ? require(fichier) : null);
  const T = facultatif('PostsOPTypographie', './typographie.js');
  // Sans ia.js, une version inerte : l'IA est simplement « non configurée » au lieu de faire planter l'app.
  const IA = facultatif('PostsOPIA', './ia.js') || (() => {
    class ErreurIA extends Error {}
    const absent = () => Promise.reject(new ErreurIA('Le fichier ia.js manque : renvoie-le sur GitHub.'));
    return { ASSISTANT: { nom: 'CCB', complet: 'Creative Collaborative Boost' }, FOURNISSEURS: {}, ErreurIA,
      lire: () => ({ fournisseur: 'claude', cles: {}, modeles: {} }), enregistrer: () => {}, oublierCle: () => {}, modeleDe: () => '',
      active: () => null, demander: absent, tester: absent, joignable: () => false, expliquer: () => 'Le fichier ia.js manque.',
      texteReponse: () => '', requete: () => null, absent: true };
  })();
  const R = facultatif('PostsOPRelecture', './relecture.js');
  const PROP = facultatif('PostsOPPropositions', './propositions.js');
  const VERSION = '2026-10-26.3'; // à changer à chaque livraison (affichée dans l'aide « i »)
  // Mise en ligne incomplète : un fichier ancien resté sur GitHub ferait planter une fonction. On le repère au démarrage
  // et on dit lequel renvoyer, au lieu d'une erreur incompréhensible.
  const FICHIERS_A_RENVOYER = (() => {
    const manque = [];
    const verifier = (module, nom, fonctions) => { if (!module || fonctions.some((f) => typeof module[f] !== 'function')) manque.push(nom); };
    verifier(R, 'relecture.js', ['messageDiscussion', 'lireDiscussion', 'placerPassage', 'consigneDescription', 'lireSuggestion', 'formulationsDe', 'lireFormulations', 'premierObjet', 'blocProfil']);
    if (racine.PostsOPRelecture && !racine.PostsOPRelecture.JSON_DISCUSSION) manque.push('relecture.js');
    verifier(racine.PostsOPTypographie || (typeof require === 'function' ? require('./typographie.js') : null), 'typographie.js', ['notesDeTravail', 'retirerLignes', 'corrections']);
    verifier(racine.PostsOPIA || (typeof require === 'function' ? require('./ia.js') : null), 'ia.js', ['demander', 'active']);
    // Un module trop ancien a ses fonctions, mais pas les éléments ajoutés depuis : on les vérifie aussi.
    if (IA && !IA.absent && (!IA.ASSISTANT || !IA.MARGE_REFLEXION) && !manque.includes('ia.js')) manque.push('ia.js'); // MARGE_REFLEXION : version compatible avec Sonnet 5.5
    if (typeof window !== 'undefined') verifier(racine.PostsOPPropositions, 'propositions.js', ['lireReponse', 'construireSlides', 'adapterRecette', 'aere']);
    if (typeof window !== 'undefined' && racine.PostsOPPropositions && !racine.PostsOPPropositions.JSON_PLANS && !manque.includes('propositions.js')) manque.push('propositions.js');
    return [...new Set(manque)];
  })();
  if (IA && !IA.ASSISTANT) IA.ASSISTANT = { nom: 'CCB', complet: 'Creative Collaborative Boost' };
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

  const nomReseau = (r) => (r === 'instagram' ? 'Instagram' : r === 'deux' ? 'LinkedIn et Instagram' : 'LinkedIn');
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
    { id: 'composition', nom: 'Mise en page' },
    { id: 'publication', nom: 'Publication' },
  ];
  // Les alertes du moteur visent encore « structure » ou « design » : c'est désormais l'étape Composition.
  // Description et Export sont réunis dans Publication (les anciens noms y mènent encore).
  const etapeDe = (cible) => (cible === 'structure' || cible === 'design' ? 'composition' : cible === 'description' || cible === 'export' ? 'publication' : cible);

  const AIDES = {
    bibliotheque: { titre: 'Tes articles', textes: ['Trois sections : En cours, Publiés (validés par toi) et Corbeille, d’où tu peux restaurer un article.', 'Le menu « … » d’une carte permet de dupliquer, d’utiliser un article comme modèle pour un nouveau texte, de le marquer comme publié ou de le mettre à la corbeille.', 'Trie et affiche tes articles comme tu veux, en grille ou en liste. « Annuler » et ⌘Z (Ctrl+Z) reviennent en arrière à tout moment.', 'Calendrier : place tes articles sur une date, puis « Programmer un rappel » ajoute une alerte au calendrier de ton appareil. La publication automatique arrivera plus tard.'] },
    configuration: { titre: 'La configuration', textes: ['Charte : tes couleurs et tes tailles de texte. Tout changement s’applique à tous tes carrousels.', 'Ressources : tes polices, ton logo et tes fleurs, importés une fois et retrouvés sur tous tes appareils.', 'Réglages : le comportement de l’outil. Synchronisation : la liaison avec ton dépôt GitHub privé.', 'IA : le fournisseur d’intelligence artificielle et sa clé. Comme la clé GitHub, elle reste sur l’appareil : à saisir une fois sur chacun.'] },
    texte: { titre: 'Étape 1 · Texte', textes: ['Ton texte est la référence du carrousel : chaque modification ici met les pages à jour, sans toucher à leur mise en page. Et un paragraphe modifié dans Mise en page modifie aussi ce texte.', 'Relis ton texte avant de passer à la mise en page : CCB composera ses propositions sur le texte corrigé.', 'Pour remplacer tout le texte : sélectionne tout, colle le nouveau, puis ouvre « Apparence générale » à l’étape 2 pour que CCB recompose les pages.', 'Avec une IA active (Configuration, onglet IA), « Relire avec CCB » propose des corrections sous forme de cartes : accepte, modifie ou refuse chacune ; rien n’est appliqué sans toi. Sans IA, la vérification LanguageTool surligne les fautes ; pour chacune, choisis la bonne correction ou ignore-la.', 'La typographie française se corrige toute seule quand tu tapes ou colles du texte, ici comme sur les pages : un message montre chaque correction, avec « Annuler ».', 'Discussion : sélectionne un passage, puis « CCB » (le petit robot). Donne tes consignes en langage naturel et demande plusieurs propositions ; « Appliquer » remplace le passage, « Annuler » le rétablit.'] },
    composition: { titre: 'Étape 2 · Mise en page', textes: ['La première fois que tu arrives ici, la fenêtre de mise en page s’ouvre : propositions de CCB, tes favoris, ou le découpage sans IA. Le bouton « Apparence générale », à droite des menus, la rouvre quand tu veux : autres propositions, favoris, fond, logo et fleurs. Le réseau et les dimensions se changent dans le menu Carrousel.', 'Le robot de la barre de menus, c’est CCB pour l’apparence : « Générer 3 propositions » ou « Une envie ? » ouvrent Apparence générale. Pour retravailler des mots, sélectionne-les dans une page : le robot de la petite barre en discute avec toi.', 'Pour retoucher une zone précise : dans Apparence générale (ou sur l’aperçu de Publication), touche la page pour l’ouvrir en grand, puis trace un rectangle avec le doigt ou la souris. CCB ne retouche que les paragraphes de la zone. Maj ou Tab ajoute une zone, le « + » fait de même au doigt.', 'Tes pages, les unes sous les autres, exactement comme elles seront exportées. Clique dans un paragraphe pour l’écrire à sa place ; sélectionne des mots pour les mettre en forme avec la petite barre qui apparaît.', 'Entrée crée un nouveau paragraphe, ⇧Entrée un retour à la ligne, ⌘↩ (Ctrl+↩) un saut de page. ⌫ au début d’un paragraphe le réunit au précédent ; au début d’une page, avec la page précédente.', 'Les menus en haut regroupent tout le reste : gabarits, fond, logo, et Vérifier pour les points à regarder. Ton texte reste la référence : chaque modification ici le met à jour.'] },
    publication: { titre: 'Étape 3 · Publication', textes: ['Tout pour publier, dans l’ordre : le texte du post, le fichier, la date de publication, puis « Marquer comme publié ».', 'Le texte du post : écris-le ou demande une proposition à CCB, puis « Copier » pour le coller sur le réseau.', 'Le fichier : un PDF pour LinkedIn, des images PNG pour Instagram. S’il reste des alertes, l’outil te les rappelle avant : à toi de décider.', 'La date : programme-la (elle apparaît dans le calendrier de la bibliothèque) ou choisis « Ne pas programmer ».'] },
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

  // Un article encore vide (texte jamais collé) est supprimé quand on le quitte, sans passer par la corbeille.
  function sansArticleVide(etat, sauf) {
    const a = etat.articles.find((x) => x.id === etat.articleId);
    if (!a || a.id === sauf || !a.attenteTexte || (a.texte && a.texte.length)) return etat;
    const articles = etat.articles.filter((x) => x.id !== a.id);
    return { ...etat, articles, projet: { ...etat.projet, ordre: (etat.projet.ordre || []).filter((id) => id !== a.id) } };
  }

  function reducteur(etat, action) {
    switch (action.type) {
      case 'charger': {
        const projet = normaliserProjet(action.projet);
        const articles = trierSelonOrdre(action.articles.map(L.lierArticle), projet.ordre || []);
        const ouvert = articles.some((a) => a.id === etat.articleId);
        return { ...etat, pret: true, articles, projet, ...(ouvert ? {} : { ecran: etat.ecran === 'atelier' ? 'bibliotheque' : etat.ecran, articleId: null }) };
      }
      case 'ecran': etat = action.ecran !== 'atelier' ? sansArticleVide(etat) : etat; return { ...etat, ecran: action.ecran, feuille: null, message: null, aide: false, edition: false, ...(action.onglet ? { onglet: action.onglet } : {}) };
      case 'ouvrir': etat = sansArticleVide(etat, action.id); return { ...etat, ecran: 'atelier', articleId: action.id, etape: 'texte', slide: 0, message: null, aide: false };
      case 'etape': case 'aller': {
        const etape = etapeDe(action.etape);
        const suite = { ...etat, etape, slide: action.type === 'aller' && action.slide != null ? action.slide : etat.slide, message: null };
        // Premier passage d'un nouvel article à l'étape Mise en page : la fenêtre de mise en page s'ouvre (une seule fois).
        const a = etape === 'composition' && etat.articles.find((x) => x.id === etat.articleId);
        if (a && a.misEnPage === false && !etat.feuille) {
          return { ...suite, feuille: { reglages: a.id, premiere: true }, articles: etat.articles.map((x) => (x.id === a.id ? { ...x, misEnPage: true } : x)) };
        }
        return suite;
      }
      case 'slide': return { ...etat, slide: action.index };
      case 'onglet': return { ...etat, onglet: action.onglet };
      case 'feuille': return { ...etat, feuille: action.feuille };
      case 'aide': return { ...etat, aide: action.ouverte == null ? !etat.aide : action.ouverte };
      // Le compteur relance le délai d'effacement même quand le même message revient (sinon il disparaissait trop tôt).
      case 'message': return { ...etat, message: action.message, numeroMessage: (etat.numeroMessage || 0) + 1 };
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
      case 'nouveauVide': {
        etat = sansArticleVide(etat);
        const r = etat.projet.reglages;
        const article = { id: nouvelId(), titre: 'Nouvel article', statut: 'Brouillon', reseau: 'deux', format: r.formatDefaut || 'portrait', fond: 'bleu', logo: 'auto', modifie: maintenant(), texte: [], slides: [], descriptions: DESCRIPTIONS_VIDES, attenteTexte: true, misEnPage: false };
        const e = avecHistorique(etat, [article, ...etat.articles]);
        return { ...e, projet: { ...e.projet, ordre: [article.id, ...(e.projet.ordre || [])] }, ecran: 'atelier', articleId: article.id, etape: 'texte', slide: 0, feuille: null };
      }
      case 'depuisModele': {
        etat = sansArticleVide(etat);
        // La mise en page du modèle est reprise ; l'article s'ouvre à l'étape Texte, avec un champ vierge pour le nouveau texte.
        const modele = etat.articles.find((a) => a.id === action.id);
        if (!modele) return etat;
        const article = { id: nouvelId(), titre: `D’après « ${modele.titre} »`, statut: 'Brouillon', reseau: modele.reseau, format: modele.format, fond: modele.fond, logo: modele.logo || 'auto', modifie: maintenant(), texte: [], slides: [], descriptions: DESCRIPTIONS_VIDES, attenteTexte: modele.id, misEnPage: true };
        const e = avecHistorique(etat, [article, ...etat.articles]);
        return { ...e, projet: { ...e.projet, ordre: [article.id, ...(e.projet.ordre || [])] }, ecran: 'atelier', articleId: article.id, etape: 'texte', slide: 0, feuille: null };
      }
      case 'creer': {
        const e = avecHistorique(etat, [action.article, ...etat.articles]);
        return { ...e, projet: { ...e.projet, ordre: [action.article.id, ...(e.projet.ordre || [])] }, ecran: 'atelier', articleId: action.article.id, etape: 'texte', slide: 0, feuille: null };
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
    validerAlertes: (cles) => (a) => ({ ...a, alertesValidees: [...new Set([...(a.alertesValidees || []), ...cles])] }),
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
    coche: 'M5 12l5 5L20 7', calendrier: 'M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4', bulle: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z', partager: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6', telecharger: 'M12 3v12M8 11l4 4 4-4M5 19h14',
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
    return h('canvas', { ...proprietes, role: 'img', 'aria-label': etiquette || 'Page' });
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

  // Le nom de l'app, en haut à gauche : un toucher ramène à la page des articles (ou remonte en haut de la liste).
  function MarqueApp({ etat, dispatch }) {
    const ici = etat.ecran === 'bibliotheque';
    return h('button', { type: 'button', className: cls('marque', 'gill', 'bouton-marque', !ici && 'avec-retour'), title: ici ? 'Oh!Post' : 'Retour aux articles', 'aria-label': ici ? 'Oh!Post' : 'Oh!Post · retour aux Articles',
      onClick: () => { if (ici) racine.scrollTo({ top: 0, behavior: 'smooth' }); else dispatch({ type: 'ecran', ecran: 'bibliotheque' }); } },
      !ici && h(Icone, { nom: 'retour', taille: 18 }), 'Oh!Post');
  }

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
      h('p', { className: 'doux petit' }, 'Oh!Post, version ' + VERSION + '.'),
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
    }, [etat.message, etat.numeroMessage]);
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
        m.action && h('button', { type: 'button', className: 'lien fort', onPointerDown: () => { arme.current = true; }, onClick: (e) => { if (!voulu(e)) return; arme.current = false; dispatch({ type: 'message', message: null }); m.action.faire(); } }, m.action.libelle),
        h('button', { type: 'button', className: 'lien', onPointerDown: () => { arme.current = true; }, onClick: (e) => { if (!voulu(e)) return; arme.current = false; dispatch({ type: 'message', message: null }); } }, 'Fermer')));
  }

  function Feuille({ titre, onAnnuler, action, children, classe, pied }) {
    return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
      h('div', { className: cls('feuille', classe) },
        h('div', { className: 'feuille-tete' }, h(Bouton, { onClick: onAnnuler }, 'Annuler'), h('h2', { className: 'gill' }, titre), h('div', { className: 'feuille-action' }, action)),
        h('div', { className: 'feuille-corps' }, children),
        pied && h('div', { className: 'feuille-pied' }, pied)));
  }

  function SelecteurFond({ valeur, onChange }) {
    const { charte } = useContext(Contexte);
    // Le vert soutenu n'est pas un fond de page ; un article ancien qui l'utilise le garde visible pour pouvoir en changer.
    const tous = M.fondsDe(charte.palette);
    const fonds = { ...M.fondsDePage(charte.palette), ...(tous[valeur] && !M.fondsDePage(charte.palette)[valeur] ? { [valeur]: tous[valeur] } : {}) };
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
        ['plus', 'Utiliser comme modèle', { type: 'depuisModele', id: article.id }],
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
      h('span', { className: 'doux petit bloc' }, `${a.slides.length} pages · ${M.FORMATS[a.format].nom} · ${nomReseau(a.reseau)}`),
      h('span', { className: 'carte-article-pied' }, a.programme && a.statut !== 'Publié' && !a.corbeille
          ? h(Pastille, { ton: 'ok' }, 'Programmé · ' + CAL.libelleCourt(a.programme.date))
          : h(Pastille, { ton: TON_STATUT[a.statut] }, a.statut === 'Publié' && a.publie ? 'Publié le ' + new Date(a.publie).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : a.statut === 'Prêt' ? 'Brouillon' : a.statut),
        h('span', { className: 'doux petit' }, b.section === 'corbeille' ? 'supprimé ' + dateCourte(a.corbeille) : dateCourte(a.modifie))));
    const outils = (a, i) => h('div', { className: 'barre-edition' },
      etat.edition && reordonnable && h(Fragment, null,
        h(Bouton, { variante: 'icone', etiquette: 'Avancer', disabled: i === 0, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: liste[i - 1] ? etat.articles.indexOf(liste[i - 1]) - etat.articles.indexOf(a) : 0 }) }, h(Icone, { nom: b.vue === 'liste' ? 'haut' : 'gauche' })),
        h(Bouton, { variante: 'icone', etiquette: 'Reculer', disabled: i === liste.length - 1, onClick: () => dispatch({ type: 'deplacerArticle', id: a.id, delta: liste[i + 1] ? etat.articles.indexOf(liste[i + 1]) - etat.articles.indexOf(a) : 0 }) }, h(Icone, { nom: b.vue === 'liste' ? 'bas' : 'droite' }))),
      h(MenuArticle, { article: a, dispatch, section: b.section }));
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: '', gauche: h(MarqueApp, { etat, dispatch }) }),
      etat.aide && h(PanneauAide, { cle: 'bibliotheque', dispatch }),
      h(Message, { etat, dispatch }),
      h('main', { className: 'contenu' },
        h('div', { className: 'tete-page' },
          h('h1', { className: 'gill' }, 'Articles'),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { onClick: () => dispatch({ type: 'feuille', feuille: 'calendrier' }), 'aria-haspopup': 'dialog' }, h(Icone, { nom: 'calendrier' }), 'Calendrier'),
            h(Bouton, { variante: 'icone', etiquette: 'Configuration', titre: 'Configuration', onClick: () => dispatch({ type: 'ecran', ecran: 'configuration' }) }, h(Icone, { nom: 'engrenage' })),
            h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'nouveauVide' }) }, h(Icone, { nom: 'plus' }), 'Nouvel article'))),
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
          b.section === 'encours' && h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'nouveauVide' }) }, h(Icone, { nom: 'plus' }), 'Créer un article')),
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
      etat.feuille === 'calendrier' && h(FenetreCalendrier, { etat, dispatch }),
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

  /* ---------- Calendrier de publication (fenêtre au premier plan, décision du 20 octobre 2026) ---------- */
  const CAL = {
    JOURS: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
    cle: (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    date: (cle) => { const [a, m, j] = cle.split('-').map(Number); return new Date(a, m - 1, j); },
    libelleCourt: (cle) => CAL.date(cle).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
    libelleLong: (cle) => CAL.date(cle).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    // Les cases d'un mois, semaines commençant le lundi.
    cases(annee, mois) {
      const premier = new Date(annee, mois, 1);
      const decalage = (premier.getDay() + 6) % 7;
      const jours = new Date(annee, mois + 1, 0).getDate();
      const cases = [];
      for (let k = 0; k < decalage; k++) cases.push(null);
      for (let j = 1; j <= jours; j++) cases.push(CAL.cle(new Date(annee, mois, j)));
      return cases;
    },
    // Rappel pour le calendrier de l'appareil (fichier .ics, heure locale, alerte à l'heure prévue).
    ics(article) {
      const p = article.programme;
      const [h, mi] = (p.heure || '09:00').split(':');
      const debut = p.date.replace(/-/g, '') + 'T' + h + mi + '00';
      const fin = p.date.replace(/-/g, '') + 'T' + String((Number(h) + 1) % 24).padStart(2, '0') + mi + '00';
      const echapper = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
      const reseau = nomReseau(article.reseau);
      return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oh!Post//Calendrier//FR', 'BEGIN:VEVENT',
        'UID:' + article.id + '-' + debut + '@postsop', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
        'DTSTART:' + debut, 'DTEND:' + fin, 'SUMMARY:' + echapper('Publier « ' + article.titre + ' » sur ' + reseau),
        'DESCRIPTION:' + echapper('Carrousel préparé dans Oh!Post.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + echapper('Publier « ' + article.titre + ' »'), 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    },
  };

  function FenetreCalendrier({ etat, dispatch }) {
    const aujourdhui = CAL.cle(new Date());
    const [mois, setMois] = useState(() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() }; });
    const [choisi, setChoisi] = useState(null); // article à placer sur un jour
    const [fiche, setFiche] = useState(null);   // article dont on voit la fiche
    const fermer = () => dispatch({ type: 'feuille', feuille: null });
    useEffect(() => {
      const touche = (e) => { if (e.key === 'Escape') fermer(); };
      racine.addEventListener('keydown', touche);
      return () => racine.removeEventListener('keydown', touche);
    }, []);
    const actifs = etat.articles.filter((a) => !a.corbeille);
    const majArticle = (id, maj, annonce) => dispatch({ type: 'article', id, maj, groupe: null, annonce });
    const programmer = (a, date) => {
      majArticle(a.id, (x) => ({ ...x, programme: { date, heure: (x.programme && x.programme.heure) || '09:00', mode: null } }), `« ${a.titre} » programmé le ${CAL.libelleLong(date)}.`);
      setChoisi(null); setFiche(a.id);
    };
    const aProgrammer = actifs.filter((a) => !a.programme && a.statut !== 'Publié');
    const duJour = (cle) => actifs.filter((a) => (a.statut === 'Publié' ? a.publie && CAL.cle(new Date(a.publie)) === cle : a.programme && a.programme.date === cle));
    const cases = CAL.cases(mois.a, mois.m);
    const nomMois = new Date(mois.a, mois.m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const dansLeMois = actifs.filter((a) => a.programme && a.statut !== 'Publié' && a.programme.date.startsWith(mois.a + '-' + String(mois.m + 1).padStart(2, '0'))).length;
    const aller = (n) => setMois(({ a, m }) => { const d = new Date(a, m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
    const f = fiche ? actifs.find((a) => a.id === fiche) : null;
    function rappel(a) {
      const blob = new Blob([CAL.ics(a)], { type: 'text/calendar;charset=utf-8' });
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = 'Publier ' + a.titre.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.ics';
      document.body.appendChild(lien); lien.click(); lien.remove();
      setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
      majArticle(a.id, (x) => ({ ...x, programme: { ...x.programme, mode: 'rappel' } }));
      dispatch({ type: 'message', message: 'Rappel créé : ouvre le fichier pour l’ajouter au calendrier de ton appareil.' });
    }
    return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Calendrier' },
      h('div', { className: 'feuille fenetre-calendrier' },
        h('div', { className: 'calendrier-tete' },
          h('h2', { className: 'gill' }, h(Icone, { nom: 'calendrier' }), 'Calendrier'),
          h(Bouton, { variante: 'icone', etiquette: 'Fermer le calendrier', titre: 'Fermer', onClick: fermer }, '×')),
        h('div', { className: 'calendrier-corps' },
          h('div', { className: 'calendrier-mois' },
            h('div', { className: 'calendrier-nav' },
              h('div', { className: 'actions-ligne' },
                h(Bouton, { variante: 'icone', etiquette: 'Mois précédent', onClick: () => aller(-1) }, '‹'),
                h('strong', { className: 'gill calendrier-nom-mois' }, nomMois),
                h(Bouton, { variante: 'icone', etiquette: 'Mois suivant', onClick: () => aller(1) }, '›'),
                h(Bouton, { onClick: () => { const d = new Date(); setMois({ a: d.getFullYear(), m: d.getMonth() }); } }, 'Aujourd’hui')),
              h('span', { className: 'doux petit' }, dansLeMois ? `${dansLeMois} publication${dansLeMois > 1 ? 's' : ''} programmée${dansLeMois > 1 ? 's' : ''}` : 'Aucune publication programmée ce mois-ci')),
            h('div', { className: cls('calendrier-grille', choisi && 'en-choix') },
              CAL.JOURS.map((j) => h('span', { key: j, className: 'calendrier-jour-nom' }, j)),
              cases.map((cle, k) => (cle === null ? h('span', { key: 'v' + k }) : h('div', { key: cle, className: cls('calendrier-case', cle === aujourdhui && 'aujourdhui') },
                h('button', { type: 'button', className: 'calendrier-numero', 'aria-label': CAL.libelleLong(cle) + (choisi ? ' : programmer ici' : ''), onClick: () => { if (choisi) programmer(actifs.find((a) => a.id === choisi), cle); } }, String(Number(cle.slice(8)))),
                duJour(cle).map((a) => h('button', { key: a.id, type: 'button', className: cls('calendrier-item', a.statut === 'Publié' && 'publie', fiche === a.id && 'actif'), onClick: () => { setFiche(a.id); setChoisi(null); }, 'aria-label': a.titre + (a.statut === 'Publié' ? ', publié' : ', programmé') },
                  a.statut === 'Publié' && h(Icone, { nom: 'coche', taille: 14 }), h('span', null, a.titre))))))) ),
          h('div', { className: 'calendrier-cote' },
            f && h('div', { className: 'carte calendrier-fiche' },
              h('div', { className: 'proposition-tete' }, h('strong', { className: 'gill' }, f.titre), h(Bouton, { variante: 'lien', onClick: () => setFiche(null) }, 'Fermer')),
              f.statut === 'Publié'
                ? h('p', { className: 'ok petit' }, 'Publié le ' + new Date(f.publie).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + '.')
                : f.programme
                  ? h(Fragment, null,
                    h('div', { className: 'calendrier-champs' },
                      h('label', null, h('span', null, 'Date'), h('input', { className: 'champ-texte', type: 'date', value: f.programme.date, onChange: (e) => e.target.value && majArticle(f.id, (x) => ({ ...x, programme: { ...x.programme, date: e.target.value, mode: null } })) })),
                      h('label', null, h('span', null, 'Heure'), h('input', { className: 'champ-texte', type: 'time', value: f.programme.heure || '09:00', onChange: (e) => e.target.value && majArticle(f.id, (x) => ({ ...x, programme: { ...x.programme, heure: e.target.value, mode: null } })) }))),
                    h('p', { className: 'doux petit' }, 'Réseau : ' + nomReseau(f.reseau) + ', celui de l’article.'),
                    f.programme.mode === 'rappel' && h('p', { className: 'ok petit' }, 'Rappel programmé. Si tu changes la date ou l’heure, programme-le de nouveau.'),
                    h('div', { className: 'calendrier-boutons' },
                      h(Bouton, { variante: 'principal', onClick: () => rappel(f) }, h(Icone, { nom: 'calendrier', taille: 18 }), f.programme.mode === 'rappel' ? 'Programmer un nouveau rappel' : 'Programmer un rappel'),
                      h(Bouton, { disabled: true, titre: 'Bientôt : il faudra d’abord connecter LinkedIn ou Instagram.' }, 'Programmer une publication automatique'),
                      h('p', { className: 'doux petit' }, 'Publication automatique : bientôt disponible. Il faudra d’abord connecter LinkedIn ou Instagram.')),
                    h('div', { className: 'actions-ligne' },
                      h(Bouton, { onClick: () => dispatch({ type: 'ouvrir', id: f.id }) }, 'Ouvrir l’article')),
                    h('div', { className: 'actions-ligne' },
                      h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'statut', id: f.id, statut: 'Publié' }) }, 'Marquer comme publié'),
                      h(Bouton, { variante: 'lien', onClick: () => { majArticle(f.id, (x) => { const { programme, ...reste } = x; return reste; }, `« ${f.titre} » déprogrammé.`); setFiche(null); } }, 'Déprogrammer')))
                  : h('p', { className: 'doux petit' }, 'Pas encore programmé.')),
            h('div', { className: 'carte' },
              h('strong', { className: 'gill' }, 'À programmer'),
              h('p', { className: 'doux petit' }, choisi ? 'Touche maintenant un jour du calendrier.' : 'Touche un article, puis un jour.'),
              aProgrammer.length
                ? h('div', { className: 'calendrier-liste' }, aProgrammer.map((a) => h('button', { key: a.id, type: 'button', className: cls('calendrier-a-programmer', choisi === a.id && 'actif'), 'aria-pressed': choisi === a.id, onClick: () => { setChoisi(choisi === a.id ? null : a.id); setFiche(null); } },
                  h('span', { className: 'gill' }, a.titre), h('span', { className: 'doux petit' }, nomReseau(a.reseau) + ' · ' + a.statut))))
                : h('p', { className: 'ok petit' }, 'Tous tes articles en cours sont programmés.'))))));
  }

  /* ---------- Schéma « Logo et fleurs » du nouvel article (maquette validée le 21 octobre 2026) ----------
   * Le gabarit décide (par défaut), ou on place soi-même le logo et les fleurs sur un schéma de la slide,
   * puis on choisit slide par slide où ils apparaissent. Ensuite, tout reste ajustable dans Composition. */
  const REGLES_PRESENCE = {
    toutes: (n) => Array.from({ length: n }, () => true),
    couverture: (n) => Array.from({ length: n }, (_, i) => i === 0),
    derniere: (n) => Array.from({ length: n }, (_, i) => i === n - 1),
    aucune: (n) => Array.from({ length: n }, () => false),
    'couverture-derniere': (n) => Array.from({ length: n }, (_, i) => i === 0 || i === n - 1),
  };
  const SCHEMA_DEPART = { logo: { x: 0.62, y: 0.86, w: 0.3 }, fleurs: { x: 0.6, y: 0.03, w: 0.36 }, presence: { logo: { regle: 'toutes' }, fleurs: { regle: 'couverture-derniere' } } };
  const presenceDe = (p, n) => (p.regle ? REGLES_PRESENCE[p.regle](n) : Array.from({ length: n }, (_, i) => !!(p.liste || [])[i]));
  function imagesSelonSchema(schema, i, n) {
    const imgs = [];
    if (presenceDe(schema.presence.fleurs, n)[i]) imgs.push({ type: 'fleurs', ...schema.fleurs });
    if (presenceDe(schema.presence.logo, n)[i]) imgs.push({ type: 'logo', ...schema.logo });
    return imgs;
  }

  function SchemaLogoFleurs({ schema, onChange, slides, format, fond }) {
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const [element, setElement] = useState('logo');
    const glisse = useRef(null);
    const zone = useRef(null);
    const n = Math.max(1, slides.length);
    const LARGEUR = 300;
    const fmt = M.FORMATS[format];
    const echelle = LARGEUR / fmt.l;
    const exemple = { ...(slides[0] || { role: 'Couverture', blocs: [{ style: 'titre', texte: 'Ton titre' }] }), images: [{ type: 'fleurs', ...schema.fleurs }, { type: 'logo', ...schema.logo }] };
    const compo = M.composer(exemple, format, fond, choisirPolice, { charte, reglages, index: 0, total: n });
    const boites = compo.elements.filter((e) => e.type === 'image');
    const borne = (v, a, b) => Math.max(a, Math.min(b, v));
    const point = (e) => { const r = zone.current.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    const commencer = (e, el, mode) => {
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
      setElement(el);
      glisse.current = { el, mode, p0: point(e), depart: { ...schema[el] } };
    };
    const bouger = (e) => {
      const g = glisse.current; if (!g) return;
      const p = point(e); const d = g.depart;
      const ratio = (g.el === 'fleurs' ? 275 / 696 : M.RATIO_LOGO) * fmt.l / fmt.h;
      const nouveau = g.mode === 'deplacer'
        ? { ...d, x: borne(d.x + p.x - g.p0.x, -d.w / 2, 1 - d.w / 2), y: borne(d.y + p.y - g.p0.y, -(d.w * ratio) / 2, 1 - (d.w * ratio) / 2) }
        : { ...d, w: borne(d.w + p.x - g.p0.x, 0.08, 0.9) };
      onChange({ ...schema, [g.el]: nouveau });
    };
    const lacher = () => { glisse.current = null; };
    const presence = (el) => presenceDe(schema.presence[el], n);
    const poserRegle = (regle) => onChange({ ...schema, presence: { ...schema.presence, [element]: { regle } } });
    const basculer = (el, i) => { const l = presence(el).slice(); l[i] = !l[i]; onChange({ ...schema, presence: { ...schema.presence, [el]: { liste: l } } }); };
    const regleActuelle = schema.presence[element].regle || null;
    const compte = (el) => presence(el).filter(Boolean).length;
    return h('div', { className: 'schema-logo' },
      h('div', { className: 'schema-tete' },
        h(Segmente, { etiquette: 'Élément', valeur: element, onChange: setElement, options: [{ valeur: 'logo', libelle: 'Logo' }, { valeur: 'fleurs', libelle: 'Fleurs' }] })),
      h('div', { className: 'schema-corps' },
        h('div', { className: 'schema-slide', ref: zone, style: { width: LARGEUR + 'px' } },
          h(SlideCanvas, { slide: exemple, formatId: format, fondId: fond, largeur: LARGEUR, index: 0, total: n }),
          boites.map((b, k) => {
            const el = k === 0 ? 'fleurs' : 'logo';
            const choisi = el === element;
            return h('div', {
              key: el, className: cls('schema-element', choisi && 'choisi'), role: 'button', tabIndex: 0, 'aria-label': (el === 'logo' ? 'Logo' : 'Fleurs') + ' : glisser pour placer',
              style: { left: b.x * echelle + 'px', top: b.y * echelle + 'px', width: b.l * echelle + 'px', height: b.h * echelle + 'px' },
              onPointerDown: (e) => commencer(e, el, 'deplacer'), onPointerMove: bouger, onPointerUp: lacher, onPointerCancel: lacher,
            }, choisi && h('span', { className: 'schema-poignee', 'aria-hidden': 'true', onPointerDown: (e) => commencer(e, el, 'taille'), onPointerMove: bouger, onPointerUp: lacher }));
          })),
        h('div', { className: 'schema-reglages' },
          h('div', { className: 'etiquette-mini' }, 'Raccourcis pour ' + (element === 'logo' ? 'le logo' : 'les fleurs')),
          h(Segmente, { etiquette: 'Raccourcis', valeur: regleActuelle, onChange: poserRegle, options: [{ valeur: 'toutes', libelle: 'Toutes' }, { valeur: 'couverture', libelle: 'Couverture' }, { valeur: 'derniere', libelle: 'Dernière' }, { valeur: 'aucune', libelle: 'Aucune' }] }),
          h('p', { className: 'doux petit' }, 'Glisse le logo et les fleurs sur la page, tire le rond blanc pour la taille. Ou choisis page par page, en dessous.'))),
      h('div', { className: 'etiquette-mini' }, 'Page par page'),
      h('div', { className: 'schema-apercu' }, slides.map((sl, i) => h('div', { key: i, className: 'schema-vignette' },
        h(SlideCanvas, { slide: { ...sl, images: imagesSelonSchema(schema, i, n) }, formatId: format, fondId: fond, largeur: 88, index: i, total: n }),
        h('div', { className: 'schema-boutons' },
          h('button', { type: 'button', className: cls('schema-bascule', presence('logo')[i] && 'actif'), 'aria-pressed': presence('logo')[i], 'aria-label': (presence('logo')[i] ? 'Retirer' : 'Mettre') + ' le logo sur la page ' + (i + 1), onClick: () => basculer('logo', i) }, 'Logo'),
          h('button', { type: 'button', className: cls('schema-bascule', presence('fleurs')[i] && 'actif'), 'aria-pressed': presence('fleurs')[i], 'aria-label': (presence('fleurs')[i] ? 'Retirer' : 'Mettre') + ' les fleurs sur la page ' + (i + 1), onClick: () => basculer('fleurs', i) }, 'Fleurs'))))),
      h('p', { className: 'doux petit' }, `Logo sur ${compte('logo')} page${compte('logo') > 1 ? 's' : ''}, fleurs sur ${compte('fleurs')} page${compte('fleurs') > 1 ? 's' : ''}. Tu pourras encore tout déplacer page par page dans Composition.`));
  }

  // Aperçu du post : la couverture telle qu'elle apparaît dans un fil, puis les pages qu'on fait défiler.
  function ApercuFil({ slides, format, fond, texte, onFermer, reseau }) {
    const [page, setPage] = useState(0);
    const n = slides.length;
    useEffect(() => {
      const touche = (e) => { if (e.key === 'Escape') onFermer(); else if (e.key === 'ArrowRight') setPage((p) => Math.min(n - 1, p + 1)); else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1)); };
      racine.addEventListener('keydown', touche);
      return () => racine.removeEventListener('keydown', touche);
    }, [n]);
    const ratio = M.FORMATS[format].h / M.FORMATS[format].l;
    const largeur = Math.round(Math.max(220, Math.min(440, (racine.innerWidth || 480) - 60, ((racine.innerHeight || 820) - 240) / ratio)));
    const extrait = String(texte || '').replace(/\s+/g, ' ').slice(0, 120);
    return h('div', { className: 'voile fil-voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aperçu du post', onClick: (e) => { if (e.target === e.currentTarget) onFermer(); } },
      h('div', { className: 'fil-cadre' },
        h('div', { className: 'fil-tete' }, h('span', { className: 'doux petit' }, reseau ? `Aperçu indicatif d’un post ${reseau === 'instagram' ? 'Instagram' : 'LinkedIn'} : le réseau présente le carrousel à sa façon.` : 'Aperçu indicatif : chaque réseau présente le carrousel à sa façon.'), h(Bouton, { variante: 'petit', onClick: onFermer }, 'Fermer')),
        h('div', { className: 'post-fil', style: { width: largeur + 'px' } },
          h('div', { className: 'post-entete' }, h('span', { className: 'post-avatar', 'aria-hidden': 'true' }), h('span', { className: 'post-qui' }, h('strong', null, 'Ton profil'), h('span', null, 'à l’instant'))),
          h('div', { className: 'post-texte' }, extrait, extrait.length >= 120 ? '… ' : ' ', h('span', { className: 'post-plus' }, 'plus')),
          h('div', { className: 'post-carrousel' },
            h(SlideCanvas, { slide: slides[page], formatId: format, fondId: fond, largeur, index: page, total: n, etiquette: `Page ${page + 1}` }),
            page > 0 && h('button', { type: 'button', className: 'post-fleche gauche', 'aria-label': 'Page précédente', onClick: () => setPage(page - 1) }, h(Icone, { nom: 'gauche', taille: 20 })),
            page < n - 1 && h('button', { type: 'button', className: 'post-fleche droite', 'aria-label': 'Page suivante', onClick: () => setPage(page + 1) }, h(Icone, { nom: 'droite', taille: 20 })),
            h('span', { className: 'post-compteur' }, `${page + 1} / ${n}`)),
          h('div', { className: 'post-actions', 'aria-hidden': 'true' }, h('span', null, 'J’aime'), h('span', null, 'Commenter'), h('span', null, 'Partager')))));
  }

  /* ---------- La grande fenêtre de présentation ----------
     Toucher la page affichée l'ouvre au premier plan, aussi grande que l'écran le permet (tout l'écran moins 28 points),
     sans fond opaque : l'écran d'avant reste visible derrière un voile. En haut à droite de la page, les logos LinkedIn
     et Instagram (fichiers fournis par Romain, affichés tels quels) ouvrent l'aperçu du post ; Révélation : 50 % au repos,
     100 % au survol, un seul à la fois. Réglages de Romain : 4,8 % de la largeur de la page, à 81,9 % et 89,0 %, 5,4 % du haut. */
  const ICONES_RESEAUX = [
    { id: 'linkedin', nom: 'LinkedIn', fichier: 'logo-linkedin.png', x: 0.819 },
    { id: 'instagram', nom: 'Instagram', fichier: 'logo-instagram.png', x: 0.890 },
  ];
  const TAILLE_ICONE = 0.048; const HAUT_ICONE = 0.054; const MARGE_FENETRE = 28;
  function GrandeFenetre({ slides, format, fond, depart, texte, textes, onFermer, onPage, logo, profil, onModifier }) {
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const [page, setPage] = useState(Math.min(depart || 0, Math.max(0, slides.length - 1)));
    const [fil, setFil] = useState(null); // réseau de l'aperçu du post ouvert
    const [dim, setDim] = useState(() => ({ l: racine.innerWidth || 1180, h: racine.innerHeight || 820 }));
    // Sélection de zones (rectangles en fractions de la page) : Maj, Tab, ⌘ ou le bouton « + » ajoutent une zone.
    const [zones, setZones] = useState([]);
    const [trace, setTrace] = useState(null);
    const [ajout, setAjout] = useState(false);
    const [fils, setFils] = useState({});       // conversation de l'agent ciblé, par page
    const [enCours, setEnCours] = useState(false);
    const [annulations, setAnnulations] = useState([]); // retouches faites, pour « Annuler »
    const [reduit, setReduit] = useState(false);
    const touchesAjout = useRef(false);
    const surface = useRef(null);
    // Le fond ne ferme la fenêtre que si l'appui ET le relâchement ont eu lieu sur lui : un appui dans la boîte de
    // conversation suivi d'un relâchement à côté (le clavier de l'iPad décale la boîte) ne doit rien fermer.
    const appuiSurLeFond = useRef(false);
    const n = slides.length;
    const nomIA = IA.ASSISTANT.nom;
    const configIA = IA.active();
    const aller = (p) => { const q = Math.max(0, Math.min(n - 1, p)); if (q !== page) { setZones([]); setTrace(null); } setPage(q); if (onPage) onPage(q); };
    useEffect(() => {
      const touche = (e) => {
        if (e.key === 'Tab') { e.preventDefault(); touchesAjout.current = true; return; }
        if (fil) return;
        if (e.key === 'Escape') { if (zones.length) { setZones([]); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } else onFermer(); return; }
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; // on écrit : les flèches restent au champ
        if (e.key === 'ArrowRight') aller(page + 1); else if (e.key === 'ArrowLeft') aller(page - 1);
      };
      const relache = (e) => { if (e.key === 'Tab') touchesAjout.current = false; };
      const taille = () => setDim({ l: racine.innerWidth, h: racine.innerHeight });
      racine.addEventListener('keydown', touche); racine.addEventListener('keyup', relache); racine.addEventListener('resize', taille);
      return () => { racine.removeEventListener('keydown', touche); racine.removeEventListener('keyup', relache); racine.removeEventListener('resize', taille); };
    }, [page, fil, n, zones.length]);
    const f = M.FORMATS[format]; const ratio = f.l / f.h;
    let hp = dim.h - 2 * MARGE_FENETRE; let lp = hp * ratio;
    if (lp > dim.l - 2 * MARGE_FENETRE) { lp = dim.l - 2 * MARGE_FENETRE; hp = lp / ratio; }
    const largeur = Math.floor(lp);
    const slide = slides[page];
    // Les paragraphes de la page et leur boîte (en points de la page), pour savoir lesquels une zone touche.
    const boites = useMemo(() => {
      const c = M.composer(slide, format, fond, choisirPolice, { charte, reglages, index: page, total: n, logo });
      const b = {};
      c.elements.filter((e) => e.type === 'bloc').forEach((e) => { const o = b[e.bloc]; b[e.bloc] = o ? { x0: Math.min(o.x0, e.x), y0: Math.min(o.y0, e.y), x1: Math.max(o.x1, e.x + e.l), y1: Math.max(o.y1, e.y + e.h) } : { x0: e.x, y0: e.y, x1: e.x + e.l, y1: e.y + e.h }; });
      return b;
    }, [slide, format, fond, page, n]);
    const touches = (z, b) => {
      const zx0 = z.x0 * f.l, zx1 = z.x1 * f.l, zy0 = z.y0 * f.h, zy1 = z.y1 * f.h;
      const w = Math.min(zx1, b.x1) - Math.max(zx0, b.x0), hh = Math.min(zy1, b.y1) - Math.max(zy0, b.y0);
      if (w <= 0 || hh <= 0) return false;
      return w * hh >= 0.1 * Math.min((b.x1 - b.x0) * (b.y1 - b.y0), (zx1 - zx0) * (zy1 - zy0));
    };
    const choisis = Object.keys(boites).map(Number).filter((k) => zones.some((z) => touches(z, boites[k])));
    const pos = (e) => { const r = surface.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
    const debut = (e) => {
      if (e.button != null && e.button > 0) return;
      e.preventDefault(); surface.current.setPointerCapture(e.pointerId);
      const p = pos(e);
      setTrace({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, ajout: e.shiftKey || e.metaKey || e.ctrlKey || touchesAjout.current || ajout });
    };
    const deplace = (e) => { if (!trace) return; const p = pos(e); setTrace({ ...trace, x1: p.x, y1: p.y }); };
    const fin = () => {
      if (!trace) return;
      const z = { x0: Math.min(trace.x0, trace.x1), y0: Math.min(trace.y0, trace.y1), x1: Math.max(trace.x0, trace.x1), y1: Math.max(trace.y0, trace.y1) };
      const petit = Math.max((z.x1 - z.x0) * largeur, (z.y1 - z.y0) * largeur / ratio) < 8;
      let nouvelle = z;
      if (petit) {
        // Un simple toucher : le paragraphe sous le doigt ; sur le vide, on efface (sauf si on ajoute).
        const cx = trace.x0 * f.l, cy = trace.y0 * f.h;
        const k = Object.keys(boites).map(Number).find((q) => cx >= boites[q].x0 && cx <= boites[q].x1 && cy >= boites[q].y0 && cy <= boites[q].y1);
        nouvelle = k == null ? null : { x0: boites[k].x0 / f.l, x1: boites[k].x1 / f.l, y0: boites[k].y0 / f.h, y1: boites[k].y1 / f.h };
      }
      setZones((anciennes) => (nouvelle ? (trace.ajout ? [...anciennes, nouvelle] : [nouvelle]) : (trace.ajout ? anciennes : [])));
      setTrace(null);
    };
    const messages = fils[page] || [];
    const dire = (de, texte) => setFils((x) => ({ ...x, [page]: [...(x[page] || []), { de, texte }] }));
    async function envoyer(demande) {
      const q = String(demande || '').trim();
      if (!q || enCours || !configIA) return;
      const hist = messages;
      dire('moi', q);
      if (!choisis.length) { dire('ccb', 'Je ne vois aucun paragraphe dans cette zone : trace un rectangle qui touche du texte, ou touche directement un paragraphe.'); return; }
      setEnCours(true);
      try {
        const zone = choisis.map((k) => ({ n: k, style: slide.blocs[k].style, texte: slide.blocs[k].texte }));
        const contexte = slide.blocs.map((b, k) => ({ n: k, style: b.style, texte: b.texte })).filter((b) => !choisis.includes(b.n));
        const g = M.gabaritParDefaut(slide, page);
        const brut = await IA.demander(configIA, { systeme: R.SYSTEME_CIBLE, texte: R.messageCible({ page: page + 1, total: n, role: slide.role, gabarit: M.GABARITS[g] ? M.GABARITS[g].nom : '', reseau: '', zone, contexte, historique: hist, demande: q, profil }), maxJetons: 2500, delai: 90000, json: R.JSON_CIBLE });
        const lu = R.lireCible(brut, choisis);
        const changements = lu.modifications.map((m) => ({ i: page, n: m.bloc, texte: T.appliquer(m.texte, T.corrections(m.texte)), style: m.style, lien: slide.blocs[m.bloc].lien, avant: { texte: slide.blocs[m.bloc].texte, style: slide.blocs[m.bloc].style } }));
        let reponse = lu.reponse || (changements.length ? 'C’est fait.' : 'Je n’ai rien changé.');
        if (changements.length) {
          const essai = { ...slide, blocs: slide.blocs.map((b, k) => { const c = changements.find((x) => x.n === k); return c ? { ...b, texte: c.texte, ...(c.style ? { style: c.style } : {}) } : b; }) };
          const deborde = M.composer(essai, format, fond, choisirPolice, { charte, reglages, index: page, total: n, logo }).deborde;
          onModifier(changements, `Page ${page + 1} retouchée par ${nomIA} (${changements.length} paragraphe${changements.length > 1 ? 's' : ''}).`);
          setAnnulations((a) => [...a, changements]);
          if (deborde) reponse += ' Attention : le texte déborde un peu de la page. Demande-moi de le raccourcir.';
        }
        dire('ccb', reponse);
      } catch (erreur) {
        dire('ccb', erreur instanceof IA.ErreurIA ? erreur.message : 'Je n’ai pas pu répondre : ' + erreur.message);
      } finally { setEnCours(false); }
    }
    const annuler = () => {
      const dernier = annulations[annulations.length - 1];
      if (!dernier) return;
      onModifier(dernier.map((c) => ({ i: c.i, n: c.n, texte: c.avant.texte, style: c.avant.style, lien: c.lien })), `Retouche de la page ${dernier[0].i + 1} annulée.`);
      setAnnulations((a) => a.slice(0, -1)); dire('ccb', 'J’ai annulé la dernière retouche.');
    };
    const voix = useConversationVocale({ envoyer: (t) => envoyer(t), messages, occupe: enCours });
    const [saisie, setSaisie] = useState('');
    const envoyerSaisie = () => { const q = saisie; setSaisie(''); envoyer(q); };
    // Au-dessus de tout (en-tête compris) : la fenêtre est placée à la racine de l'app.
    const RD = racine.ReactDOM;
    const auPremierPlan = (noeud) => (RD && RD.createPortal && typeof document !== 'undefined' ? RD.createPortal(noeud, document.querySelector('.app') || document.body) : noeud);
    const rect = (z, cle, classe) => h('div', { key: cle, className: classe, style: { left: z.x0 * 100 + '%', top: z.y0 * 100 + '%', width: (z.x1 - z.x0) * 100 + '%', height: (z.y1 - z.y0) * 100 + '%' } });
    const apercuTrace = trace ? { x0: Math.min(trace.x0, trace.x1), y0: Math.min(trace.y0, trace.y1), x1: Math.max(trace.x0, trace.x1), y1: Math.max(trace.y0, trace.y1) } : null;
    const nbPar = choisis.length;
    const surLeFond = (e) => e.target === e.currentTarget;
    // La boîte de l'agent ne laisse rien remonter vers les écrans de derrière (la fenêtre est un portail React).
    const isoler = { onPointerDown: (e) => e.stopPropagation(), onMouseDown: (e) => e.stopPropagation(), onTouchStart: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), onKeyDown: (e) => { if (e.key !== 'Escape') e.stopPropagation(); } };
    return auPremierPlan(h('div', { className: 'grande-fenetre', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Page ${page + 1} sur ${n}, en grand`,
      onPointerDown: (e) => { appuiSurLeFond.current = surLeFond(e); },
      onClick: (e) => { const ok = surLeFond(e) && appuiSurLeFond.current && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)); appuiSurLeFond.current = false; if (ok) onFermer(); } },
      h('button', { type: 'button', className: 'gf-fermer', 'aria-label': 'Fermer', onClick: onFermer }, '×'),
      h('div', { className: 'gf-page', style: { width: largeur + 'px' } },
        h(SlideCanvas, { slide, formatId: format, fondId: fond, largeur, index: page, total: n, etiquette: `Page ${page + 1}`, logo }),
        // La surface de sélection : un rectangle tracé à la souris ou au doigt.
        h('div', { ref: surface, className: 'gf-surface', 'aria-hidden': 'true', onPointerDown: debut, onPointerMove: deplace, onPointerUp: fin, onPointerCancel: () => setTrace(null) },
          choisis.map((k) => rect({ x0: boites[k].x0 / f.l, x1: boites[k].x1 / f.l, y0: boites[k].y0 / f.h, y1: boites[k].y1 / f.h }, 'p' + k, 'gf-paragraphe')),
          zones.map((z, k) => rect(z, 'z' + k, 'gf-zone')),
          apercuTrace && rect(apercuTrace, 'trace', 'gf-zone trace')),
        ICONES_RESEAUX.map((ic) => h('button', { key: ic.id, type: 'button', className: 'gf-reseau', 'aria-label': `Aperçu du post ${ic.nom}`,
          style: { left: ic.x * largeur + 'px', top: HAUT_ICONE * largeur + 'px', width: TAILLE_ICONE * largeur + 'px', height: TAILLE_ICONE * largeur + 'px' }, onClick: () => setFil(ic.id) },
          h('img', { src: ic.fichier, alt: '' })))),
      n > 1 && page > 0 && h('button', { type: 'button', className: 'gf-fleche gauche', 'aria-label': 'Page précédente', onClick: () => aller(page - 1) }, h(Icone, { nom: 'gauche', taille: 22 })),
      n > 1 && page < n - 1 && h('button', { type: 'button', className: 'gf-fleche droite', 'aria-label': 'Page suivante', onClick: () => aller(page + 1) }, h(Icone, { nom: 'droite', taille: 22 })),
      n > 1 && h('span', { className: 'gf-compteur' }, `${page + 1} / ${n}`),
      // Au doigt : le « + » fait que le prochain rectangle s'ajoute à la sélection au lieu de la remplacer.
      h('button', { type: 'button', className: cls('gf-ajout', ajout && 'actif'), 'aria-pressed': ajout, 'aria-label': 'Ajouter une zone à la sélection', title: 'Ajouter une zone à la sélection (au clavier : Maj ou Tab)', onClick: () => setAjout(!ajout) }, '+'),
      zones.length > 0 && h('div', { className: cls('gf-agent', reduit && 'reduit'), role: 'region', 'aria-label': `${nomIA}, agent ciblé`, ...isoler },
        h('div', { className: 'gf-agent-tete' },
          h('span', { className: 'gf-agent-titre' }, h(Robot, { taille: 26 }), h('strong', null, nomIA), h('span', { className: 'doux petit' }, `Page ${page + 1} · ${zones.length} zone${zones.length > 1 ? 's' : ''} · ${nbPar} paragraphe${nbPar > 1 ? 's' : ''}`)),
          h('span', { className: 'gf-agent-actions' },
            annulations.length > 0 && h('button', { type: 'button', className: 'btn-mini', onClick: annuler }, 'Annuler la retouche'),
            h('button', { type: 'button', className: 'btn-mini', onClick: () => setReduit(!reduit) }, reduit ? 'Agrandir' : 'Réduire'),
            h('button', { type: 'button', className: 'btn-mini', onClick: () => { setZones([]); setTrace(null); } }, 'Effacer la zone'))),
        !reduit && h(Fragment, null,
          !configIA && h('p', { className: 'doux petit' }, `Pour retoucher avec ${nomIA}, ajoute ta clé dans Configuration, onglet IA.`),
          nbPar === 0 && h('p', { className: 'doux petit' }, 'Aucun paragraphe dans cette zone : trace un rectangle qui touche du texte.'),
          nbPar > 0 && h('p', { className: 'gf-extraits petit' }, choisis.map((k) => '« ' + String(slide.blocs[k].texte).replace(/\s+/g, ' ').slice(0, 46) + (String(slide.blocs[k].texte).length > 46 ? '…' : '') + ' »').join('   ')),
          messages.length > 0 && h('div', { className: 'mep-fil-messages gf-messages' }, messages.map((m, k) => h('div', { key: k, className: cls('mep-message', m.de === 'moi' ? 'moi' : 'ccb') }, m.texte))),
          enCours && h('p', { className: 'doux petit', role: 'status' }, `${nomIA} retouche la zone…`),
          h(EtatVoix, { voix, nomIA }),
          configIA && h('div', { className: 'discussion-saisie' },
            h('input', { className: 'champ-texte', value: saisie, placeholder: 'Que veux-tu changer dans cette zone ?', 'aria-label': `Ta demande à ${nomIA} pour cette zone`, onChange: (e) => setSaisie(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); envoyerSaisie(); } } }),
            h(BoutonMicro, { voix, nomIA }),
            h(Bouton, { variante: 'principal', disabled: enCours || !saisie.trim(), onClick: envoyerSaisie }, 'Envoyer')))),
      fil && h(ApercuFil, { slides, format, fond, texte: (textes && textes[fil]) || texte, reseau: fil, onFermer: () => setFil(null) })));
  }

  function FeuilleNouvelArticle({ etat, dispatch }) {
    const r = etat.projet.reglages;
    const modele = etat.feuille && etat.feuille.modele ? etat.articles.find((a) => a.id === etat.feuille.modele) : null;
    // « Mise en page et réglages » d'un article existant : la même fenêtre, ouverte sur l'étape 2, qui applique au lieu de créer.
    const edite = etat.feuille && etat.feuille.reglages ? etat.articles.find((a) => a.id === etat.feuille.reglages) : null;
    // Premier passage de l'article à l'étape Mise en page : CCB compose tout de suite ses propositions.
    const premiere = !!(edite && etat.feuille.premiere);
    // « Générer 3 propositions » depuis le robot de Mise en page : CCB compose dès l'ouverture, « Actuelle » reste proposée.
    const genererDemande = !!(edite && etat.feuille.generer);
    // « Une envie ? » depuis le robot de Mise en page : la fenêtre s'ouvre sur le champ de l'envie.
    const envieDemande = !!(edite && etat.feuille.envie);
    const base = modele || edite;
    const [texte, setTexte] = useState(edite ? edite.texte.join('\n\n') : '');
    const [reseau, setReseau] = useState(base ? base.reseau : r.reseauDefaut);
    const [format, setFormat] = useState(base ? base.format : r.formatDefaut);
    const [fond, setFond] = useState(base ? base.fond : 'bleu');
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const paragraphes = texte.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    const [schema, setSchema] = useState(null); // null : le gabarit place le logo et les fleurs
    // Assistant en trois étapes : texte, mise en page (propositions de CCB), logo et fleurs. D'après un modèle : une seule étape.
    const [etape, setEtape] = useState(edite ? 2 : 1);
    const [gen, setGen] = useState({ cle: null, etat: 'repos', plans: [], detail: '' });
    const [choix, setChoix] = useState(edite ? 'actuelle' : 'simple'); // indice d'une proposition, « actuelle » ou « simple »
    const [pageVue, setPageVue] = useState(0);
    const [fil, setFil] = useState(false);
    const [discOuverte, setDiscOuverte] = useState(envieDemande);
    const [bulleMep, setBulleMep] = useState(false);
    const refBulleMep = useRef(null);
    useEffect(() => {
      if (!bulleMep) return undefined;
      const fermer = (e) => { if (refBulleMep.current && !refBulleMep.current.contains(e.target)) setBulleMep(false); };
      document.addEventListener('pointerdown', fermer);
      return () => document.removeEventListener('pointerdown', fermer);
    }, [bulleMep]);
    const [discussion, setDiscussion] = useState([]); // { de: 'moi' | 'ccb', texte }
    const [saisie, setSaisie] = useState('');
    const [discEnCours, setDiscEnCours] = useState(false);
    const voixMep = useConversationVocale({ envoyer: (t) => envoyer(t), messages: discussion, occupe: discEnCours });
    const [favori, setFavori] = useState(null);         // carrousel favori appliqué à ce texte
    const [favorisOuverts, setFavorisOuverts] = useState(false);
    const [noteFavori, setNoteFavori] = useState('');
    const [hasard, setHasard] = useState(null);         // « Une autre au hasard » : { cle, fond, slides }
    const configIA = IA.active();
    const fonds = M.fondsDePage(charte.palette);
    const cleTexte = JSON.stringify([paragraphes, reseau, format]);
    const maxPages = PROP ? PROP.maxPagesPour(paragraphes) : 7;
    const indications = discussion.filter((m) => m.de === 'moi').map((m) => m.texte);
    const actuelleValable = !!edite && !premiere && JSON.stringify(paragraphes) === JSON.stringify(edite.texte) && format === edite.format;
    const decoupage = useMemo(() => {
      if (!paragraphes.length) return [];
      let sl = M.decouperMecaniquement(paragraphes, format, fond, choisirPolice, { charte, reglages });
      if (modele) sl = appliquerModele(sl, modele);
      return sl;
    }, [texte, format, fond, choisirPolice, charte, reglages]);
    const plans = gen.cle === cleTexte ? gen.plans : [];
    const plan = choix === 'favori' ? favori : typeof choix === 'number' && plans[choix] ? plans[choix] : null;
    const choixEffectif = plan ? choix : (choix === 'actuelle' && actuelleValable ? 'actuelle' : 'simple');
    const auHasard = choixEffectif === 'simple' && hasard && hasard.cle === cleTexte ? hasard : null;
    const slidesBase = plan ? PROP.construireSlides(plan, paragraphes) : choixEffectif === 'actuelle' ? edite.slides : auHasard ? auHasard.slides : decoupage;
    // Retouches faites dans la grande fenêtre : elles s'ajoutent à la mise en page affichée (et suivent « Appliquer »).
    const [retouche, setRetouche] = useState(null);
    const cleRetouche = JSON.stringify([String(choixEffectif), plan ? plan.nom : '', cleTexte, fond]);
    const slides = retouche && retouche.cle === cleRetouche ? retouche.slides : slidesBase;
    const reseauNom = nomReseau(reseau);
    const catalogueTexte = () => PROP.catalogue(M.GABARITS, fonds, M.NATURES);
    const debordeDe = (pl) => (sl, i, total) => M.composer(sl, format, pl.fond, choisirPolice, { charte, reglages, index: i, total }).deborde;
    const garder = (pl) => PROP.aere(pl, paragraphes, debordeDe(pl), maxPages);
    // Une page qui déborde (ou trop chargée) est réparée plutôt que rejetée : texte un peu réduit sur cette page,
    // sinon la page est coupée en deux tant qu'on reste dans la limite de pages. Seules les propositions impossibles sont écartées.
    const motsDe = (k) => (paragraphes[k] || '').split(/\s+/).filter(Boolean).length;
    function reparer(pl) {
      if (!pl || !pl.slides) return pl;
      const plan = { ...pl, slides: pl.slides.map((s0) => ({ ...s0, paragraphes: [...s0.paragraphes], styles: [...(s0.styles || [])] })) };
      let garde = 0;
      for (let i = 0; i < plan.slides.length && garde < 40; i++, garde++) {
        const page = () => PROP.construireSlides(plan, paragraphes)[i];
        const s0 = plan.slides[i];
        const charge = s0.paragraphes.length > 1 && s0.paragraphes.reduce((t, k) => t + motsDe(k), 0) > PROP.MOTS_MAX_PAGE;
        if (!charge && !debordeDe(plan)(page(), i, plan.slides.length)) continue;
        if (!charge) {
          let ok = false;
          for (const e of [0.95, 0.9, 0.85, 0.8]) { s0.echelle = e; if (!debordeDe(plan)(page(), i, plan.slides.length)) { ok = true; break; } }
          if (ok) { plan.repare = true; continue; }
          delete s0.echelle;
        }
        if (s0.paragraphes.length > 1 && plan.slides.length < maxPages) {
          const m = Math.ceil(s0.paragraphes.length / 2);
          const fin = s0.gabarit === 'F1';
          const avant = { ...s0, gabarit: fin ? 'T1' : s0.gabarit, paragraphes: s0.paragraphes.slice(0, m), styles: s0.styles.slice(0, m) };
          const apres = { ...s0, gabarit: fin ? 'F1' : /^V/.test(s0.gabarit) ? 'T1' : s0.gabarit, paragraphes: s0.paragraphes.slice(m), styles: s0.styles.slice(m) };
          plan.slides.splice(i, 1, avant, apres);
          plan.repare = true;
          i--; // revérifier la première moitié
        }
      }
      return plan;
    }

    async function generer(autres, consignes = indications) {
      if (!configIA || !PROP || !paragraphes.length) return false;
      const cle = cleTexte;
      const deja = autres ? plans : [];
      setGen({ cle, etat: 'encours', plans: deja, detail: '' }); setRetouche(null);
      try {
        const essayer = async (eviter) => {
          const brut = await IA.demander(configIA, { systeme: PROP.SYSTEME, texte: PROP.messageGeneration({ paragraphes, catalogueTexte: catalogueTexte(), format: M.FORMATS[format].nom, reseau: reseauNom, favoris: [], eviter, maxPages, indications: consignes }), maxJetons: 4000, delai: 150000, json: PROP.JSON_PLANS });
          const lu = PROP.lireReponse(brut, paragraphes.length, M.GABARITS, fonds, M.NATURES);
          const gardes = lu.plans.map(reparer).filter(garder);
          return { gardes, ecartes: lu.ecartes + lu.plans.length - gardes.length };
        };
        const eviter = deja.map((p) => p.nom);
        let { gardes, ecartes } = await essayer(eviter);
        // Moins de trois propositions qui tiennent : CCB est relancé une fois.
        if (gardes.length < PROP.MAX_PROPOSITIONS) {
          const encore = await essayer(eviter.concat(gardes.map((p) => p.nom)));
          // Pas deux fois la même proposition (même nom ou mêmes pages).
          const signature = (pl) => pl.nom.toLowerCase() + JSON.stringify(pl.slides);
          gardes = gardes.concat(encore.gardes.filter((pl) => !gardes.some((q) => q.nom.toLowerCase() === pl.nom.toLowerCase() || signature(q) === signature(pl))));
          ecartes += encore.ecartes;
        }
        gardes = gardes.slice(0, PROP.MAX_PROPOSITIONS);
        if (!gardes.length) throw new Error(`aucune proposition ne tenait en ${maxPages} pages sans page qui déborde. Raccourcis le texte, ou garde le découpage simple.`);
        setGen({ cle, etat: 'repos', plans: gardes, detail: ecartes ? `${ecartes} proposition${ecartes > 1 ? 's écartées' : ' écartée'} par la vérification : plus de ${maxPages} pages, page qui déborde ou texte incomplet.` : '' });
        setChoix(0); setFond(gardes[0].fond); setPageVue(0);
        return { n: gardes.length, ecartes };
      } catch (erreur) {
        setGen({ cle, etat: 'erreur', plans: deja, detail: erreur instanceof IA.ErreurIA ? erreur.message : 'CCB n’a pas pu proposer de mise en page : ' + erreur.message });
        return false;
      }
    }
    // En arrivant à l'étape « Mise en page » d'un nouvel article, CCB compose ses propositions (une fois par texte, réseau et format).
    useEffect(() => {
      if ((premiere || genererDemande) && etape === 2 && configIA && PROP && paragraphes.length && gen.cle !== cleTexte && gen.etat !== 'encours') { if (premiere) setChoix('simple'); setPageVue(0); generer(false); }
    }, [etape, cleTexte]);
    const choisir = (v) => {
      const k = v === 'simple' || v === 'actuelle' || v === 'favori' ? v : Number(v);
      setChoix(k); setPageVue(0);
      if (typeof k === 'number' && plans[k]) setFond(plans[k].fond);
      if (k === 'favori' && favori) setFond(favori.fond);
      if (k === 'actuelle' && edite) setFond(edite.fond);
      if (k === 'simple' && auHasard) setFond(auHasard.fond);
    };
    // Un carrousel favori, appliqué à ce texte : même rythme, mêmes gabarits, même fond.
    const appliquerFavori = (f) => {
      setFavorisOuverts(false);
      const pl = PROP.adapterRecette(f.recette, paragraphes.length, f.nom, M.GABARITS, fonds, M.NATURES);
      if (!pl || !PROP.aere(pl, paragraphes, debordeDe(pl))) { setNoteFavori(`« ${f.nom} » ne tient pas sur ce texte sans page qui déborde.`); return; }
      setNoteFavori(''); setFavori(pl); setChoix('favori'); setFond(pl.fond); setPageVue(0);
    };
    // Sans IA : une autre présentation au hasard (gabarits et fond), qui tient dans les marges.
    const autreAuHasard = () => {
      const base = { ...(edite || {}), fond, slides: decoupage };
      const autres = etat.articles.filter((a) => !edite || a.id !== edite.id);
      const convient = (sl, k, fd) => !M.composer(sl, format, fd, choisirPolice, { charte, reglages, index: k, total: decoupage.length }).deborde;
      const p = M.proposerPresentation(base, autres, r.rythme, Math.random, convient);
      setHasard({ cle: cleTexte, fond: p.fond, slides: p.slides }); setFond(p.fond); setChoix('simple'); setPageVue(0);
    };

    // Discussion avec CCB : elle modifie la proposition affichée, ou compose trois propositions qui suivent tes indications.
    async function envoyer(force) {
      const demande = (typeof force === 'string' ? force : saisie).trim();
      if (!demande || discEnCours || !configIA || !PROP) return;
      const fil0 = discussion.concat([{ de: 'moi', texte: demande }]);
      setDiscussion(fil0); setSaisie(''); setDiscEnCours(true);
      const dire = (t) => setDiscussion((d) => d.concat([{ de: 'ccb', texte: t }]));
      try {
        {
          const res = await generer(false, fil0.filter((m) => m.de === 'moi').map((m) => m.texte));
          // Dire combien de propositions sont vraiment affichées (certaines peuvent être écartées par la vérification).
          const nombres = ['', 'une proposition', 'deux propositions', 'trois propositions'];
          dire(!res ? 'Je n’ai pas pu composer de propositions : regarde le message au-dessus de l’aperçu.'
            : res.n >= PROP.MAX_PROPOSITIONS ? 'Voici trois propositions qui tiennent compte de tes indications.'
            : `Voici ${nombres[res.n] || res.n + ' propositions'} qui tiennent compte de tes indications : ${res.ecartes ? 'les autres débordaient de leurs pages ou dépassaient ' + maxPages + ' pages, je les ai écartées' : 'je n’ai pas trouvé mieux'}. Demande « Proposer 3 autres » pour en voir d’autres.`);
        }
      } catch (erreur) {
        dire(erreur instanceof IA.ErreurIA ? erreur.message : 'Je n’ai pas pu répondre : ' + erreur.message);
      } finally { setDiscEnCours(false); }
    }

    // Les propositions de CCB peuvent rejoindre tes carrousels favoris (les mêmes que dans Composition).
    const favorisCarrousels = etat.projet.favorisCarrousels || [];
    // Ce qui est affiché peut devenir un favori : une proposition de CCB, la mise en page actuelle ou le découpage sans IA.
    const planFavori = plan || (PROP && slides.length ? {
      nom: choixEffectif === 'actuelle' && edite ? `Mise en page de « ${edite.titre.length > 40 ? edite.titre.slice(0, 40) + '…' : edite.titre} »` : auHasard ? 'Sans IA, au hasard' : 'Découpage simple',
      fond, slides: slides.map((sl, i) => ({ gabarit: sl.gabarit || M.gabaritParDefaut(sl, i), styles: (sl.blocs || []).map((b) => b.style || null), paragraphes: (sl.blocs || []).map((_, k) => k) })),
    } : null);
    const recette = planFavori && JSON.stringify(PROP.recetteDe(planFavori));
    const dejaFavori = planFavori && favorisCarrousels.find((f) => JSON.stringify(f.recette) === recette);
    const basculerFavori = () => {
      const plan = planFavori;
      if (!plan) return;
      if (dejaFavori) dispatch({ type: 'projet', maj: (pr) => ({ ...pr, favorisCarrousels: (pr.favorisCarrousels || []).filter((f) => f.id !== dejaFavori.id) }) });
      else dispatch({ type: 'projet', maj: (pr) => ({ ...pr, favorisCarrousels: [{ id: 'car-' + Date.now().toString(36), nom: plan.nom, origine: edite ? edite.titre : (paragraphes[0] || '').slice(0, 48), recette: PROP.recetteDe(plan) }].concat(pr.favorisCarrousels || []) }) });
    };

    function terminer() {
      const premier = paragraphes[0] || 'Nouvel article';
      let sl = slides.length ? slides : M.decouperMecaniquement(paragraphes, format, fond, choisirPolice, { charte, reglages });
      if (schema) sl = sl.map((x, i) => ({ ...x, images: imagesSelonSchema(schema, i, sl.length) }));
      if (edite) {
        dispatch({ type: 'article', id: edite.id, maj: (a) => L.lierArticle({ ...a, reseau, format, fond, texte: paragraphes, slides: sl }), annonce: 'Mise en page appliquée.' });
        dispatch({ type: 'feuille', feuille: null });
        return;
      }
      dispatch({
        type: 'creer',
        article: L.lierArticle({ id: nouvelId(), titre: premier.length > 48 ? premier.slice(0, 48) + '…' : premier, statut: 'Brouillon', reseau, format, fond, logo: modele ? modele.logo || 'auto' : 'auto', modifie: maintenant(), texte: paragraphes, slides: sl, descriptions: DESCRIPTIONS_VIDES, ...(modele ? {} : { misEnPage: false }) }),
      });
    }

    const champTexte = h(Fragment, null,
      h('label', { className: 'etiquette', htmlFor: 'texte-nouvel' }, 'Texte de l’article'),
      h(ZoneTexteTypo, { id: 'texte-nouvel', className: 'zone-texte', rows: 9, valeur: texte, onValeur: setTexte, placeholder: 'Colle ici le texte de ton article Word.' }),
      h('p', { className: 'doux petit' }, paragraphes.length ? `${paragraphes.length} paragraphe(s) · ${M.compterMots(texte)} mots.` : 'Colle le texte de ton article : la typographie française est corrigée au passage.'),
      h(Ligne, { etiquette: 'Réseau', aide: 'Fixe le format d’export : images pour Instagram, PDF pour LinkedIn.' }, h(Segmente, { valeur: reseau, onChange: setReseau, options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
      h(Ligne, { etiquette: 'Dimensions', aide: '1:1 comme tes carrousels actuels, 4:5 pour plus de place.' }, h(Segmente, { valeur: format, onChange: setFormat, options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] })));
    // Création d'un article : un seul écran. La mise en page se choisit à l'étape 2, après la relecture.
    if (!modele && !edite) {
      return h(Feuille, { titre: 'Nouvel article', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }), action: h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: terminer }, 'Créer') },
        champTexte,
        h('p', { className: 'note' }, `Ensuite : relis ton texte à l’étape 1. En passant à l’étape 2, Mise en page, ${IA.ASSISTANT.nom} te proposera des mises en page composées sur ton texte corrigé.`));
    }
    const champLogo = h(Fragment, null,
      h(Ligne, { etiquette: 'Logo et fleurs', aide: 'Laisse le gabarit les placer, ou place-les toi-même.' },
        h(Segmente, { etiquette: 'Logo et fleurs', valeur: schema ? 'moi' : 'gabarit', onChange: (v) => setSchema(v === 'moi' ? (schema || SCHEMA_DEPART) : null), options: [{ valeur: 'gabarit', libelle: edite ? 'Ne pas changer' : 'Le gabarit décide' }, { valeur: 'moi', libelle: 'Je les place' }] })),
      schema && (slides.length
        ? h(SchemaLogoFleurs, { schema, onChange: setSchema, slides, format, fond })
        : h('p', { className: 'doux petit' }, 'Colle d’abord ton texte : le schéma montrera tes vraies pages.')));

    // D'après un modèle : la mise en page vient du modèle, tout tient sur un écran.
    if (modele) {
      return h(Feuille, { titre: 'Nouvel article d’après un modèle', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }), action: h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: terminer }, 'Créer') },
        h('p', { className: 'note' }, `Mise en page reprise de « ${modele.titre} » : fond, format, réseau, gabarits et logo. Colle ton nouveau texte.`),
        champTexte, champLogo);
    }

    const mots = (sl) => sl.blocs.map((b) => b.texte).join(' ').split(/\s+/).filter(Boolean).length;
    const moyenne = slides.length ? Math.round(slides.reduce((t, sl) => t + mots(sl), 0) / slides.length) : 0;
    const vue = Math.min(pageVue, Math.max(0, slides.length - 1));
    // Le grand aperçu tient dans l'écran avec les vignettes et les boutons du bas (iPad à l'horizontale compris).
    const ratio = M.FORMATS[format].h / M.FORMATS[format].l;
    const largeurGrande = Math.round(Math.max(170, Math.min(320, (racine.innerWidth || 1000) - 120, ((racine.innerHeight || 820) - 480) / ratio)));
    const options = (actuelleValable ? [{ valeur: 'actuelle', libelle: 'Actuelle' }] : [])
      .concat(plans.map((pl, k) => ({ valeur: String(k), libelle: pl.nom })))
      .concat(favori ? [{ valeur: 'favori', libelle: '★ ' + favori.nom }] : [])
      .concat([{ valeur: 'simple', libelle: 'Sans IA' }]);
    const etatGen = gen.cle === cleTexte ? gen.etat : 'repos';
    const nomChoix = choixEffectif === 'favori' ? 'Favori : ' + plan.nom : plan ? plan.nom : choixEffectif === 'actuelle' ? 'Mise en page actuelle' : auHasard ? 'Sans IA, au hasard' : 'Découpage simple, sans IA';
    const pourquoiChoix = choixEffectif === 'favori' ? 'Ton carrousel favori, appliqué à ce texte : même rythme, mêmes gabarits, même fond.' : plan ? plan.pourquoi : choixEffectif === 'actuelle' ? 'Les pages de ton article telles qu’elles sont aujourd’hui, retouches comprises. Rien ne change tant que tu n’appliques pas une autre mise en page.' : auHasard ? 'Des gabarits et un fond tirés au hasard, sans IA, qui tiennent dans les marges.' : 'Les paragraphes les uns après les autres jusqu’à remplir chaque page. « Une autre au hasard » change les gabarits et le fond, toujours sans IA.';

    const discussionCCB = discOuverte && h('div', { className: 'mep-discussion', role: 'region', 'aria-label': `Discussion avec ${IA.ASSISTANT.nom}` },
      h('p', { className: 'doux petit' }, `Ton envie pour la mise en page : ${IA.ASSISTANT.nom} compose trois nouvelles propositions qui la suivent, en ${maxPages} pages au plus. Pour retoucher une page précise, ouvre-la en grand en la touchant.`),
      discussion.length > 0 && h('div', { className: 'mep-fil-messages' }, discussion.map((m, k) => h('div', { key: k, className: cls('mep-message', m.de === 'moi' ? 'moi' : 'ccb') }, m.texte))),
      discEnCours && h('div', { className: 'mep-attente petit', role: 'status' }, h('span', { className: 'rond-attente', 'aria-hidden': 'true' }), `${IA.ASSISTANT.nom} réfléchit…`),
      h('label', { className: 'etiquette petit', htmlFor: 'indications-ccb' }, 'Une envie ?'),
      h('div', { className: 'mep-saisie' },
        h(EtatVoix, { voix: voixMep, nomIA: IA.ASSISTANT.nom }),
        h('textarea', { id: 'indications-ccb', rows: 3, value: saisie, placeholder: 'Par exemple : plus de citations en grand, un fond vert pâle, une couverture plus percutante…', onChange: (e) => setSaisie(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } } }),
        h('div', { className: 'actions-ligne' }, h(BoutonMicro, { voix: voixMep, nomIA: IA.ASSISTANT.nom }), h(Bouton, { variante: 'principal', disabled: !saisie.trim() || discEnCours || !configIA, onClick: () => envoyer() }, 'Envoyer'))));

    const etapeMiseEnPage = h('div', { className: 'mise-en-page' },
      h('div', { className: 'mep-choix' },
        h(Segmente, { etiquette: 'Mises en page proposées', valeur: String(choixEffectif), onChange: choisir, options }),
        // L'étoile garde la proposition affichée dans tes favoris ; la petite flèche ouvre la liste des favoris.
        h('span', { className: 'etoile-favoris', role: 'group', 'aria-label': 'Favoris' },
          h('button', { type: 'button', className: cls('etoile', dejaFavori && 'pleine'), 'aria-pressed': !!dejaFavori, disabled: !planFavori, onClick: basculerFavori,
            title: !planFavori ? 'Aucune mise en page à garder' : dejaFavori ? 'Retirer de mes favoris' : 'Garder cette mise en page dans mes favoris', 'aria-label': !planFavori ? 'Garder dans mes favoris (aucune mise en page affichée)' : dejaFavori ? 'Retirer de mes favoris' : 'Garder dans mes favoris' },
            h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9L3.4 9.4l6-.7z', fill: dejaFavori ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round' }))),
          h('button', { type: 'button', className: cls('fleche-favoris', favorisOuverts && 'actif'), 'aria-expanded': favorisOuverts, 'aria-label': 'Mes favoris', title: 'Mes favoris', onClick: () => setFavorisOuverts(!favorisOuverts) },
            h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' }, h('path', { d: 'M2.5 4.5 6 8l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' })))),
        // L'agent général : l'apparence de tout le carrousel. Sa bulle : trois propositions tout de suite, ou une envie pour les orienter.
        configIA && PROP && h('span', { className: 'ancre-bulle', ref: refBulleMep },
          h('button', { type: 'button', className: cls('bouton-robot', (bulleMep || discOuverte) && 'actif'), 'aria-label': `${IA.ASSISTANT.nom} · apparence générale`, title: `${IA.ASSISTANT.nom} · apparence générale`, 'aria-haspopup': 'true', 'aria-expanded': bulleMep, onClick: () => setBulleMep(!bulleMep) }, h(Robot, { taille: 40 })),
          bulleMep && h('div', { className: 'bulle-ccb', role: 'menu', 'aria-label': IA.ASSISTANT.nom },
            h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', disabled: etatGen === 'encours', onClick: () => { setBulleMep(false); generer(plans.length > 0); } }, h('strong', null, 'Générer 3 propositions'), h('span', { className: 'doux petit' }, 'Trois nouvelles mises en page, tout de suite')),
            h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', onClick: () => { setBulleMep(false); setDiscOuverte(true); } }, h('strong', null, 'Une envie ?'), h('span', { className: 'doux petit' }, 'Dis ce que tu veux : trois propositions la suivront'))))),
      favorisOuverts && h('div', { className: 'mep-favoris', role: 'group', 'aria-label': 'Mes carrousels favoris' },
        h('p', { className: 'doux petit' }, 'Appliqués à ce texte : même rythme, mêmes gabarits, même fond.'),
        favorisCarrousels.length
          ? favorisCarrousels.map((f) => h('button', { key: f.id, type: 'button', className: 'mep-favori', onClick: () => appliquerFavori(f) }, h('strong', null, f.nom), f.origine && h('span', { className: 'doux petit' }, 'D’après « ' + f.origine + ' »')))
          : h('p', { className: 'doux petit' }, 'Aucun carrousel favori pour l’instant : touche l’étoile sur une proposition de CCB pour la garder.')),
      noteFavori && h('p', { className: 'erreur petit' }, noteFavori),
      etatGen === 'encours' && !discEnCours && h('div', { className: 'note mep-attente', role: 'status' }, h('span', { className: 'rond-attente', 'aria-hidden': 'true' }), `${IA.ASSISTANT.nom} compose trois carrousels pour ${reseauNom}, en ${maxPages} pages au plus… environ 20 à 40 secondes. Chaque proposition est vérifiée page par page avant de s’afficher.`),
      etatGen === 'erreur' && h('div', { className: 'erreur-boite', role: 'alert' }, h('p', null, gen.detail), h(Bouton, { variante: 'petit', onClick: () => generer(false) }, 'Réessayer')),
      !configIA && h('p', { className: 'note' }, `Pour recevoir trois propositions de ${IA.ASSISTANT.nom}, ajoute ta clé dans Configuration, onglet IA. En attendant : le découpage simple, sans IA.`),
      h('div', { className: 'mep-corps' },
        h('div', { className: 'mep-apercu' },
          slides.length ? h(Fragment, null,
            h('div', { className: 'mep-grande' },
              h('button', { type: 'button', className: 'bouton-rond', 'aria-label': 'Page précédente', disabled: vue === 0, onClick: () => setPageVue(vue - 1) }, h(Icone, { nom: 'gauche', taille: 20 })),
              h('button', { type: 'button', className: 'page-cliquable', 'aria-label': `Ouvrir la page ${vue + 1} en grand`, title: 'Ouvrir en grand', onClick: () => setFil(true) },
                h(SlideCanvas, { slide: slides[vue], formatId: format, fondId: fond, largeur: largeurGrande, index: vue, total: slides.length, etiquette: `Page ${vue + 1}` })),
              h('button', { type: 'button', className: 'bouton-rond', 'aria-label': 'Page suivante', disabled: vue >= slides.length - 1, onClick: () => setPageVue(vue + 1) }, h(Icone, { nom: 'droite', taille: 20 }))),
            h('div', { className: 'doux petit centre' }, `Page ${vue + 1} sur ${slides.length}`),
            h('div', { className: 'mep-bande' }, slides.map((sl, i) => h('button', { key: i, type: 'button', className: cls('mep-vignette', i === vue && 'actif'), 'aria-label': `Voir la page ${i + 1}`, 'aria-pressed': i === vue, onClick: () => setPageVue(i) },
              h(SlideCanvas, { slide: sl, formatId: format, fondId: fond, largeur: 52, index: i, total: slides.length })))),
            // Sous l'aperçu, l'un au-dessus de l'autre : voir le post, puis demander d'autres propositions.
            h('div', { className: 'mep-actions-apercu' },
              configIA && PROP && h(Bouton, { disabled: etatGen === 'encours', onClick: () => generer(plans.length > 0) }, plans.length ? 'Proposer 3 autres' : 'Proposer 3 mises en page'))) : null),
        h('div', { className: 'mep-infos' },
          h('h3', { className: 'gill' }, nomChoix),
          h('div', { className: 'doux petit' }, `${slides.length} page${slides.length > 1 ? 's' : ''}, fond ${(fonds[fond] || {}).nom ? fonds[fond].nom.toLowerCase() : fond}, environ ${moyenne} mots par page`),
          // Discussion ouverte : elle passe en premier, juste sous le nom, pour garder le champ de saisie à portée.
          discussionCCB,
          !discOuverte && h('p', null, pourquoiChoix),
          gen.detail && etatGen === 'repos' && h('p', { className: 'doux petit' }, gen.detail),
          choixEffectif === 'simple' && h(Bouton, { variante: 'petit', onClick: autreAuHasard }, 'Une autre au hasard'),
          )),
      fil && slides.length > 0 && h(GrandeFenetre, { slides, format, fond, depart: vue, texte: paragraphes[0], onPage: setPageVue, onFermer: () => setFil(false), profil: (etat.projet && etat.projet.profilEditorial) || '',
        onModifier: (chg) => {
          const copie = slides.map((sl) => ({ ...sl, blocs: sl.blocs.map((b) => ({ ...b })) }));
          chg.forEach((c) => { Object.assign(copie[c.i].blocs[c.n], { texte: c.texte, ...(c.style ? { style: c.style } : {}) }); });
          setRetouche({ cle: cleRetouche, slides: copie });
        } }));

    // Un seul écran : les mises en page, puis le fond, le logo et les fleurs. Le texte se remplace à l'étape Texte
    // de l'article ; le réseau et les dimensions se changent dans le menu Carrousel.
    const pied = h('span', { className: 'pied-droite' }, h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: terminer }, 'Appliquer'));
    return h(Feuille, { titre: premiere ? 'Choisis ta mise en page' : 'Apparence générale', classe: 'assistant large', onAnnuler: () => dispatch({ type: 'feuille', feuille: null }), pied },
      etapeMiseEnPage,
      h('div', { className: 'mep-finitions' },
        h('h3', { className: 'gill' }, 'Fond, logo et fleurs'),
        h(Ligne, { etiquette: 'Fond', aide: plan ? 'Celui de la mise en page choisie. Tu peux le changer.' : 'Il pourra changer ensuite.' }, h(SelecteurFond, { valeur: fond, onChange: setFond })),
        champLogo));
  }


  /* ================================================================== */
  /* 6. Atelier                                                          */
  /* ================================================================== */

  function Atelier({ etat, dispatch }) {
    const article = etat.articles.find((a) => a.id === etat.articleId);
    if (!article) return h(Bibliotheque, { etat, dispatch });
    const majA = (maj, groupe, annonce) => dispatch({ type: 'article', id: article.id, maj, groupe, annonce });
    const vues = { texte: EtapeTexte, composition: EtapeComposition, publication: EtapePublication };
    const index = ETAPES.findIndex((e) => e.id === etat.etape);
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: article.titre, gauche: h(MarqueApp, { etat, dispatch }) }),
      h('nav', { className: 'etapes', 'aria-label': 'Étapes' },
        ETAPES.map((e, i) => h('button', {
          key: e.id, type: 'button', className: cls('etape', e.id === etat.etape && 'active', i < index && 'faite'), 'aria-current': e.id === etat.etape ? 'step' : undefined, onClick: () => dispatch({ type: 'etape', etape: e.id }),
        }, h('span', { className: 'etape-num' }, i + 1), e.nom))),
      etat.aide && h(PanneauAide, { cle: etat.etape, dispatch }),
      h(Message, { etat, dispatch }),
      etat.feuille && etat.feuille.reglages === article.id && h(FeuilleNouvelArticle, { etat, dispatch }),
      etat.feuille === 'calendrier' && h(FenetreCalendrier, { etat, dispatch }),
      h('main', { className: cls('contenu atelier', etat.etape === 'composition' && 'large', (!vues[etat.etape] || etat.etape === 'texte') && 'texte-fixe') }, h(article.attenteTexte ? TexteEnAttente : (vues[etat.etape] || EtapeTexte), { etat, dispatch, article, majA })),
      h('footer', { className: 'pied-etapes' },
        h(Bouton, { disabled: index === 0, onClick: () => dispatch({ type: 'etape', etape: ETAPES[index - 1].id }) }, 'Étape précédente'),
        index < ETAPES.length - 1
          ? h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'etape', etape: ETAPES[index + 1].id }) }, 'Continuer : ' + ETAPES[index + 1].nom)
          : h(Bouton, { variante: 'principal', onClick: () => dispatch({ type: 'ecran', ecran: 'bibliotheque' }) }, 'Terminer')));
  }

  /* ---------- Étape 1 : Texte ---------- */

  // Zone de texte qui surligne les fautes directement dans ton texte.
  // Le texte est affiché deux fois, exactement superposé : derrière, avec les surlignages ; devant, modifiable.
  function EditeurTexte({ valeur, onChange, marques, active, zoneRef, onCurseur, onSelection }) {
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
      morceaux.push(h('mark', { key: i, className: cls(active === m.debut && 'active', m.classe) }, valeur.slice(m.debut, m.fin)));
      curseur = m.fin;
    });
    morceaux.push(valeur.slice(curseur) + '\n');
    return h('div', { className: 'editeur' },
      h('div', { className: 'editeur-fond', ref: fond, 'aria-hidden': 'true' }, morceaux),
      h('textarea', { ref: zoneRef, className: 'editeur-zone', value: valeur, spellCheck: true, lang: 'fr', 'aria-label': 'Texte de l’article', onChange: (e) => onChange(e.target.value, e.target), onSelect: (e) => { if (onCurseur) onCurseur(e.target.selectionStart); if (onSelection) onSelection(e.target.selectionStart, e.target.selectionEnd); } }));
  }

  function extraitAvecMarque(texte, debut, longueur) {
    const avant = texte.slice(Math.max(0, debut - 40), debut);
    const fin = debut + longueur;
    return [(debut > 40 ? '…' : '') + avant, texte.slice(debut, fin), texte.slice(fin, fin + 40) + (fin + 40 < texte.length ? '…' : '')];
  }

  /* ---------- Relecture par l'IA (phase 4) : cartes dans le panneau de droite ---------- */

  const RELECTURES = new Map(); // id d'article → état de sa relecture, le temps de la session

  function useRelecture(article, texteComplet, majA, profil) {
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
        const reponse = await IA.demander(config, { systeme: R.SYSTEME, texte: R.consigne(source, profil), maxJetons: 6000, delai: 150000 , json: R.JSON_RELECTURE });
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
    // Autres formulations : en choisir une (l'aperçu « Après » suit), ou en demander de nouvelles à l'IA.
    function choisirFormulation(p, k) {
      maj((x) => ({ ...x, props: x.props.map((q) => (q.id !== p.id ? q : { ...q, choix: k, apres: q.formulations[k], apercu: R.apercu(texteComplet, { ...q, apres: q.formulations[k] }) })) }));
    }
    async function autresFormulations(p) {
      const config = IA.active();
      if (!config) return;
      const majP = (f) => maj((x) => ({ ...x, props: x.props.map((q) => (q.id === p.id ? f(q) : q)) }));
      majP((q) => ({ ...q, chargement: true, erreurFormulations: '' }));
      try {
        const deja = p.formulations && p.formulations.length ? p.formulations : [p.apres];
        const brut = await IA.demander(config, { systeme: R.SYSTEME_FORMULATIONS, texte: R.messageFormulations(texteComplet, p.contexteAvant + p.avant + p.contexteApres, p.avant, deja, profil), maxJetons: 800, delai: 60000 , json: R.JSON_FORMULATIONS });
        const nouvelles = R.lireFormulations(brut);
        majP((q) => {
          const liste = R.formulationsDe(q.formulations[0] || q.apres, nouvelles, q.avant, q.formulations && q.formulations.length ? q.formulations : [q.apres]);
          return { ...q, chargement: false, formulations: liste, erreurFormulations: liste.length > (q.formulations || []).length ? '' : 'Pas de nouvelle formulation cette fois. Réessaie ou écris la tienne avec « Modifier ».' };
        });
      } catch (erreur) {
        majP((q) => ({ ...q, chargement: false, erreurFormulations: erreur.message }));
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
    // Suggestion sur un passage choisi : la réponse devient une carte, validée comme une proposition de relecture.
    async function suggerer(debut, fin, action) {
      const config = IA.active();
      if (!config || fin <= debut) return;
      const source = texteComplet;
      const passage = source.slice(debut, fin);
      maj({ suggestion: { etat: 'encours', action } });
      try {
        const reponse = await IA.demander(config, { systeme: R.consigneSuggestion(action), texte: R.consigneSuggestionTexte(source, passage, profil), maxJetons: 2000, delai: 90000 });
        const s = R.lireSuggestion(reponse, passage);
        const x = dernier.current;
        const n = (x.compteurSuggestions || 0) + 1;
        const brute = { id: 's' + n, type: R.ACTIONS[action].libelle, avant: passage, apres: s.proposition, debut, fin, contexteAvant: '', contexteApres: '', pourquoi: s.pourquoi, vigilance: s.vigilance, statut: 'attente', apercu: R.apercu(source, { debut, fin, apres: s.proposition }) };
        const [carte] = R.recaler(source, x.source, [brute]);
        if (!carte) { remplacer({ ...x, suggestion: { etat: 'erreur', detail: 'Le passage a changé pendant la rédaction : sélectionne-le de nouveau.' } }); return; }
        const autres = x.props.filter((q) => !(q.statut === 'attente' && q.debut < carte.fin && q.fin > carte.debut));
        remplacer({ ...x, props: trier(autres.concat([carte])), actif: carte.id, compteurSuggestions: n, suggestion: { etat: 'fait' }, edition: null, brouillon: '' });
        montrer(carte.id);
      } catch (erreur) {
        maj({ suggestion: { etat: 'erreur', detail: erreur.message } });
      }
    }
    return {
      ...r, profil: !!String(profil || '').trim(), relire, accepter, refuser, annuler, choisir, suggerer, choisirFormulation, autresFormulations,
      modifier: (p) => maj({ edition: p.id, brouillon: p.apres, actif: p.id }),
      saisir: (v) => maj({ brouillon: v }),
      abandonner: () => maj({ edition: null, brouillon: '' }),
      valider: (p) => { const t = r.brouillon.trim(); if (t) accepter(p, t); },
      // Toucher un passage surligné dans le texte fait apparaître sa carte.
      curseur: (pos) => { const p = r.props.find((q) => q.statut === 'attente' && pos >= q.debut && pos <= q.fin); if (p && p.id !== r.actif) choisir(p.id, 'texte'); },
    };
  }

  /* ---------- Discussion avec l'IA : petite fenêtre au-dessus du panneau (décision du 20 octobre 2026) ---------- */
  const DISCUSSIONS = new Map(); // id d'article → { messages, ouvert }, le temps de la session
  const RACCOURCIS_DISCUSSION = [['Clarifier', 'Clarifie ce passage.'], ['Raccourcir', 'Raccourcis ce passage.'], ['Plus percutant', 'Rends ce passage plus percutant.'], ['3 propositions', 'Donne-moi 3 propositions différentes pour ce passage.']];

  // Le petit robot de la discussion (proposition « Rond », choisie le 21 octobre 2026) : il sourit et tient une fleur.
  const ROBOT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" focusable="false"><rect x="48" y="96" width="8" height="12" rx="3" fill="#003846"></rect><rect x="64" y="96" width="8" height="12" rx="3" fill="#003846"></rect><rect x="42" y="64" width="36" height="34" rx="12" fill="#003846"></rect><circle cx="60" cy="82" r="4" fill="#C9D420"></circle><path d="M43 76 Q33 80 34 90" fill="none" stroke="#003846" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path><path d="M77 76 Q92 74 96 62" fill="none" stroke="#003846" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="96.5" cy="60" r="4.6" fill="#003846"></circle><path d="M97 57 L102 40" fill="none" stroke="#003846" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="103.0" cy="25.5" r="4.7" fill="#FFFFFF" stroke="#003846" stroke-width="1.6"></circle><circle cx="109.2" cy="30.0" r="4.7" fill="#FFFFFF" stroke="#003846" stroke-width="1.6"></circle><circle cx="106.8" cy="37.3" r="4.7" fill="#FFFFFF" stroke="#003846" stroke-width="1.6"></circle><circle cx="99.2" cy="37.3" r="4.7" fill="#FFFFFF" stroke="#003846" stroke-width="1.6"></circle><circle cx="96.8" cy="30.0" r="4.7" fill="#FFFFFF" stroke="#003846" stroke-width="1.6"></circle><circle cx="103" cy="32" r="3.6" fill="#C9D420"></circle><path d="M60 26 V19" fill="none" stroke="#003846" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="60" cy="14" r="5" fill="#C9D420"></circle><rect x="30" y="42" width="6" height="13" rx="3" fill="#C9D420"></rect><rect x="84" y="42" width="6" height="13" rx="3" fill="#C9D420"></rect><rect x="34" y="26" width="52" height="44" rx="22" fill="#003846"></rect><rect x="40" y="33" width="40" height="29" rx="13" fill="#E6EBEC"></rect><circle cx="52" cy="45" r="3.8" fill="#003846"></circle><circle cx="68" cy="45" r="3.8" fill="#003846"></circle><circle cx="53.3" cy="43.6" r="1.3" fill="#FFFFFF"></circle><circle cx="69.3" cy="43.6" r="1.3" fill="#FFFFFF"></circle><circle cx="46.5" cy="52.5" r="2.6" fill="#C9D420"></circle><circle cx="73.5" cy="52.5" r="2.6" fill="#C9D420"></circle><path d="M53 52 Q60 58.5 67 52" fill="none" stroke="#003846" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  // Objet unique : avec un objet neuf à chaque rendu, certaines versions de React réécrivent le dessin, et un toucher
  // commencé sur l'ancien dessin n'aboutissait pas (le bouton CCB ne s'ouvrait pas toujours).
  const HTML_ROBOT = { __html: ROBOT_SVG };
  const Robot = ({ taille = 44 }) => h('span', { className: 'robot', 'aria-hidden': 'true', style: { width: taille + 'px', height: taille + 'px' }, dangerouslySetInnerHTML: HTML_ROBOT });

  // Les conversations sont gardées sur l'appareil, par article (les 20 dernières), pour les retrouver et naviguer entre elles.
  const CLE_DISCUSSIONS = 'postsop-discussions';
  const MAX_CONVERSATIONS = 20;
  function lireConversations(id) { try { return JSON.parse(localStorage.getItem(CLE_DISCUSSIONS) || '{}')[id] || []; } catch (e) { return []; } }
  function ecrireConversations(id, liste) {
    try { const tout = JSON.parse(localStorage.getItem(CLE_DISCUSSIONS) || '{}'); tout[id] = liste.slice(0, MAX_CONVERSATIONS); localStorage.setItem(CLE_DISCUSSIONS, JSON.stringify(tout)); } catch (e) { /* stockage plein ou indisponible : la session continue */ }
  }
  const nouvelIdConversation = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // options (texte du post) : cle de rangement des conversations, ecrire(texte) pour appliquer, precision ajoutée à chaque demande.
  function useDiscussion(article, texteComplet, majA, choisirZone, profil, options = {}) {
    const cleDisc = options.cle || article.id;
    const ecrire = options.ecrire || ((t) => majA(OP.source(t), null));
    const [d, setD] = useState(() => DISCUSSIONS.get(cleDisc) || (() => {
      const conversations = lireConversations(cleDisc);
      const derniere = conversations[0];
      return { conversations, courante: derniere ? derniere.id : nouvelIdConversation(), messages: derniere ? derniere.messages : [], passageConv: derniere ? derniere.passage || '' : '', vue: 'conversation', ouvert: false, etat: 'repos', detail: '' };
    })());
    const dernier = useRef(d);
    dernier.current = d;
    const maj = (y) => {
      // La conversation en cours est rangée en tête de liste dès qu'elle a un message.
      let conversations = (y.conversations || []).filter((c) => c.id !== y.courante);
      if (y.messages.length) {
        const ancienne = (y.conversations || []).find((c) => c.id === y.courante);
        conversations = [{ id: y.courante, cree: ancienne ? ancienne.cree : Date.now(), maj: Date.now(), passage: y.passageConv || '', titre: (y.messages.find((m) => m.de === 'moi') || {}).texte || '', messages: y.messages }].concat(conversations);
      }
      y = { ...y, conversations };
      dernier.current = y; DISCUSSIONS.set(cleDisc, y); ecrireConversations(cleDisc, conversations); setD(y);
    };
    async function envoyer(demande, passage) {
      const config = IA.active();
      const texte = String(demande || '').trim();
      if (!config || !texte) return;
      const avant = dernier.current;
      const historique = avant.messages;
      maj({ ...avant, passageConv: historique.length ? avant.passageConv : (passage || ''), messages: historique.concat([{ de: 'moi', texte }]), etat: 'encours', detail: '' });
      try {
        const brut = await IA.demander(config, { systeme: R.SYSTEME_DISCUSSION, texte: R.messageDiscussion(texteComplet, passage || '', historique, texte, { profil, titre: article.titre, reseau: nomReseau(article.reseau), contexte: options.precision || '' }), maxJetons: 4000, delai: 120000 , json: R.JSON_DISCUSSION });
        const r = R.lireDiscussion(brut);
        const x = dernier.current;
        maj({ ...x, etat: 'repos', messages: x.messages.concat([{ de: 'ia', texte: r.reponse, pistes: r.pistes || [], passage: passage || '', propositions: r.propositions.map((q) => ({ ...q, apercu: T.appliquer(q.apres, T.corrections(q.apres)), statut: 'attente' })) }]) });
      } catch (erreur) {
        maj({ ...dernier.current, etat: 'erreur', detail: erreur.message });
      }
    }
    function majProposition(mi, pi, changement) {
      const x = dernier.current;
      maj({ ...x, detail: '', etat: x.etat === 'erreur' ? 'repos' : x.etat, messages: x.messages.map((m, i) => (i !== mi ? m : { ...m, propositions: m.propositions.map((q, j) => changement(q, j)) })) });
    }
    function appliquer(mi, pi) {
      const m = dernier.current.messages[mi];
      const p = m.propositions[pi];
      let source = texteComplet;
      // Une autre proposition de la même réponse était appliquée : on la retire d'abord.
      const deja = m.propositions.findIndex((q) => q.statut === 'appliquee');
      if (deja >= 0) {
        const q = m.propositions[deja];
        const pos = R.placerPassage(source, q.insere, null);
        if (pos) source = source.slice(0, pos[0]) + q.avantReel + source.slice(pos[1]);
      }
      const zone = m.passage ? R.placerPassage(source, m.passage, null) : null;
      const pos = R.placerPassage(source, p.avant || m.passage, zone ? { debut: zone[0], fin: zone[1] } : null);
      if (!pos) { maj({ ...dernier.current, etat: 'erreur', detail: 'Passage introuvable dans ton texte : il a peut-être changé. Choisis-le de nouveau et redemande.' }); return; }
      const a = R.appliquer(source, pos[0], pos[1], p.apres);
      ecrire(a.texte);
      if (choisirZone) choisirZone(pos[0], pos[0] + a.longueur); // le passage choisi suit le nouveau texte
      majProposition(mi, pi, (q, j) => (j === pi ? { ...q, statut: 'appliquee', insere: a.insere, avantReel: source.slice(pos[0], pos[1]) } : { ...q, statut: 'attente' }));
    }
    function annuler(mi, pi) {
      const p = dernier.current.messages[mi].propositions[pi];
      const pos = R.placerPassage(texteComplet, p.insere, null);
      if (!pos) { maj({ ...dernier.current, etat: 'erreur', detail: 'Impossible d’annuler : le passage a été modifié depuis.' }); return; }
      ecrire(texteComplet.slice(0, pos[0]) + p.avantReel + texteComplet.slice(pos[1]));
      if (choisirZone) choisirZone(pos[0], pos[0] + p.avantReel.length);
      majProposition(mi, pi, (q, j) => (j === pi ? { ...q, statut: 'attente' } : q));
    }
    return {
      ...d, envoyer, appliquer, annuler,
      ouvrir: () => maj({ ...dernier.current, ouvert: true }), fermer: () => maj({ ...dernier.current, ouvert: false }),
      nouvelle: () => maj({ ...dernier.current, courante: nouvelIdConversation(), messages: [], passageConv: '', vue: 'conversation', etat: 'repos', detail: '' }),
      voirHistorique: () => maj({ ...dernier.current, vue: 'historique' }),
      voirConversation: () => maj({ ...dernier.current, vue: 'conversation' }),
      ouvrirConversation: (id) => { const c = dernier.current.conversations.find((x) => x.id === id); if (c) maj({ ...dernier.current, courante: id, messages: c.messages, passageConv: c.passage || '', vue: 'conversation', etat: 'repos', detail: '' }); },
      supprimerConversation: (id) => { const x = dernier.current; maj({ ...x, conversations: x.conversations.filter((c) => c.id !== id), ...(id === x.courante ? { courante: nouvelIdConversation(), messages: [], passageConv: '' } : {}) }); },
      signaler: (detail) => maj({ ...dernier.current, etat: 'erreur', detail }),
    };
  }


  /* ---------- Conversation à voix haute avec CCB (voix de l'appareil, mains libres) ----------
     Le micro écoute ; quand tu te tais, ta phrase est envoyée et transcrite dans la discussion ; CCB répond à voix haute,
     puis le micro se remet à écouter. On arrête en touchant de nouveau le micro. Tout passe par le navigateur (Safari) :
     la transcription est faite par Apple, la voix est celle de l'iPad. */
  const Reconnaissance = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const voixDisponible = () => !!Reconnaissance && typeof window !== 'undefined' && 'speechSynthesis' in window;
  const CLE_VOIX = 'postsop-voix';
  const REGLAGES_VOIX = { nom: '', vitesse: 1, hauteur: 1, volume: 1 };
  const lireReglagesVoix = () => { try { return { ...REGLAGES_VOIX, ...(JSON.parse(localStorage.getItem(CLE_VOIX) || '{}') || {}) }; } catch (e) { return { ...REGLAGES_VOIX }; } };
  const ecrireReglagesVoix = (r) => { try { localStorage.setItem(CLE_VOIX, JSON.stringify(r)); } catch (e) { /* stockage indisponible : réglage pour cette session */ } };
  const voixDeLAppareil = () => (typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : []).filter((v) => /^fr(-|_|$)/i.test(v.lang));
  function voixFrancaise() {
    const voix = voixDeLAppareil();
    // La voix choisie dans Configuration, sinon une voix « améliorée » ou « premium », sinon la voix française par défaut.
    const choisie = lireReglagesVoix().nom;
    return (choisie && voix.find((v) => v.name === choisie)) || voix.find((v) => /premium|enhanced|améliorée/i.test(v.name)) || voix.find((v) => /fr-FR/i.test(v.lang) && v.localService) || voix[0] || null;
  }
  // Dire un texte avec la voix et les réglages choisis (aussi pour « Écouter un exemple »).
  function direAvecLaVoix(texte, fin) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const r = lireReglagesVoix();
    const u = new SpeechSynthesisUtterance(pourLaVoix(texte));
    const v = voixFrancaise(); if (v) u.voice = v;
    u.lang = (v && v.lang) || 'fr-FR'; u.rate = r.vitesse; u.pitch = r.hauteur; u.volume = r.volume;
    if (fin) { u.onend = fin; u.onerror = fin; }
    synth.speak(u);
  }
  const pourLaVoix = (t) => String(t || '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
  function useConversationVocale({ envoyer, messages, occupe }) {
    const [actif, setActif] = useState(false);
    const [phase, setPhase] = useState('repos'); // repos, ecoute, attente, parole, erreur
    const [partiel, setPartiel] = useState('');
    const [detail, setDetail] = useState('');
    const reco = useRef(null);
    const actifRef = useRef(false);
    const dejaDit = useRef(messages.length);
    // Toujours la dernière version de « envoyer » : l'écoute démarrée plus tôt envoie avec l'état du moment.
    const envoyerRef = useRef(envoyer); envoyerRef.current = envoyer;
    const ecouter = () => {
      if (!actifRef.current || !Reconnaissance) return;
      try {
        const r = new Reconnaissance();
        r.lang = 'fr-FR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
        let final = '';
        r.onresult = (e) => {
          let t = ''; final = '';
          for (let k = 0; k < e.results.length; k++) { t += e.results[k][0].transcript; if (e.results[k].isFinal) final += e.results[k][0].transcript; }
          setPartiel(t);
        };
        r.onerror = (e) => {
          if (e.error === 'no-speech' || e.error === 'aborted') return;
          setDetail(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Le micro est refusé : autorise-le pour ce site dans les réglages de Safari.' : 'Le micro ne répond pas (' + e.error + ').');
          setPhase('erreur'); actifRef.current = false; setActif(false);
        };
        r.onend = () => {
          reco.current = null;
          const phrase = final.trim();
          setPartiel('');
          if (!actifRef.current) return;
          if (phrase) { setPhase('attente'); envoyerRef.current(phrase); } else ecouter(); // silence : on réécoute
        };
        reco.current = r; setPhase('ecoute'); r.start();
      } catch (e) { setDetail('Le micro n’a pas pu démarrer : touche-le de nouveau.'); setPhase('erreur'); }
    };
    const parler = (texte) => {
      setPhase('parole');
      direAvecLaVoix(texte, () => { if (actifRef.current) ecouter(); else setPhase('repos'); });
    };
    // Une nouvelle réponse de CCB arrive pendant la conversation : il la dit à voix haute.
    useEffect(() => {
      const n = messages.length;
      if (n > dejaDit.current) {
        const dernier = messages[n - 1];
        dejaDit.current = n;
        if (actifRef.current && dernier && dernier.de !== 'moi' && dernier.texte) parler(dernier.texte);
      }
    }, [messages.length]);
    // La demande n'a pas eu de réponse (erreur) : on se remet à écouter.
    useEffect(() => { if (actifRef.current && phase === 'attente' && !occupe) { const t = setTimeout(() => { if (actifRef.current && dejaDit.current === messages.length) ecouter(); }, 400); return () => clearTimeout(t); } return undefined; }, [occupe]);
    useEffect(() => () => { actifRef.current = false; if (reco.current) try { reco.current.abort(); } catch (e) { /* déjà arrêté */ } if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); }, []);
    const basculer = () => {
      if (actifRef.current) {
        actifRef.current = false; setActif(false); setPhase('repos'); setPartiel('');
        if (reco.current) try { reco.current.abort(); } catch (e) { /* déjà arrêté */ }
        window.speechSynthesis.cancel();
        return;
      }
      if (!voixDisponible()) { setDetail('La conversation à voix haute n’est pas disponible dans ce navigateur. Sur iPad, utilise Safari ; la touche micro du clavier reste possible.'); setPhase('erreur'); return; }
      // Débloque la voix de l'iPad pendant ce toucher (Safari n'autorise le son qu'après un geste).
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch (e) { /* sans effet */ }
      dejaDit.current = messages.length;
      actifRef.current = true; setActif(true); setDetail(''); ecouter();
    };
    return { actif, phase, partiel, detail, basculer, disponible: voixDisponible() };
  }
  function BoutonMicro({ voix, nomIA }) {
    const libelle = voix.actif ? 'Arrêter la conversation à voix haute' : 'Parler à ' + nomIA + ' à voix haute';
    return h('button', { type: 'button', className: cls('bouton-micro', voix.actif && 'actif', voix.phase), 'aria-pressed': voix.actif, 'aria-label': libelle, title: libelle, onClick: voix.basculer },
      h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3, fill: 'currentColor' }),
        h('path', { d: 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })));
  }
  function EtatVoix({ voix, nomIA }) {
    if (voix.phase === 'erreur') return h('p', { className: 'erreur petit', role: 'status' }, voix.detail);
    if (!voix.actif) return null;
    const textes = { ecoute: 'Je t’écoute…', attente: nomIA + ' réfléchit…', parole: nomIA + ' te répond…', repos: '' };
    return h('p', { className: 'etat-voix', role: 'status' }, h('span', { className: cls('pastille-voix', voix.phase), 'aria-hidden': 'true' }), textes[voix.phase] || '', voix.partiel && h('span', { className: 'partiel' }, ' « ' + voix.partiel + ' »'));
  }

  function FenetreDiscussion({ disc, nomIA, passage, onRetirerPassage, onChoisirPassage, invitation }) {
    const [saisie, setSaisie] = useState('');
    const [passageEntier, setPassageEntier] = useState(false);
    const [passageConvEntier, setPassageConvEntier] = useState(false);
    const fil = useRef(null);
    useEffect(() => { if (fil.current) fil.current.scrollTop = fil.current.scrollHeight; }, [disc.messages.length, disc.etat]);
    const encours = disc.etat === 'encours';
    const envoyer = (t) => { if (!encours && t.trim()) { disc.envoyer(t, passage); setSaisie(''); } };
    const voix = useConversationVocale({ envoyer: (t) => envoyer(t), messages: disc.messages, occupe: disc.etat === 'encours' });
    const couper = (t, n) => (t && t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + '…' : t);
    const extrait = passage && (passageEntier ? passage : couper(passage, 110));
    const autrePassage = disc.passageConv && disc.passageConv.trim() !== (passage || '').trim() && disc.passageConv;
    const quand = (t) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (disc.vue === 'historique') {
      return h('div', { className: 'fenetre-discussion', role: 'dialog', 'aria-label': 'Conversations avec ' + nomIA },
        h('div', { className: 'proposition-tete' },
          h(Bouton, { variante: 'lien', onClick: disc.voirConversation }, '‹ Retour'),
          h('h3', { className: 'gill' }, 'Conversations'),
          h(Bouton, { variante: 'icone', etiquette: 'Fermer la discussion', onClick: disc.fermer }, '×')),
        h('div', { className: 'discussion-fil' },
          !disc.conversations.length && h('p', { className: 'doux petit' }, 'Aucune conversation pour cet article.'),
          disc.conversations.map((c) => h('div', { key: c.id, className: cls('conversation-item', c.id === disc.courante && 'courante') },
            h('button', { type: 'button', className: 'conversation-ouvrir', onClick: () => disc.ouvrirConversation(c.id) },
              h('strong', null, couper(c.titre || 'Conversation', 70)),
              c.passage && h('span', { className: 'doux petit' }, '« ' + couper(c.passage, 60) + ' »'),
              h('span', { className: 'doux petit' }, quand(c.maj) + ' · ' + c.messages.length + ' message' + (c.messages.length > 1 ? 's' : '') + (c.id === disc.courante ? ' · en cours' : ''))),
            h(Bouton, { variante: 'icone', etiquette: 'Supprimer cette conversation', onClick: () => disc.supprimerConversation(c.id) }, '×')))),
        h(Bouton, { variante: 'principal', onClick: disc.nouvelle }, 'Nouvelle conversation'));
    }
    return h('div', { className: 'fenetre-discussion', role: 'dialog', 'aria-label': 'CCB · Creative Collaborative Boost' },
      h('div', { className: 'proposition-tete' },
        h('h3', { className: 'gill titre-ccb' }, 'CCB', h('span', { className: 'doux petit' }, ' · Creative Collaborative Boost')),
        h(Bouton, { variante: 'icone', etiquette: 'Fermer la discussion', titre: 'Fermer (la conversation est gardée)', onClick: disc.fermer }, '×')),
      (disc.conversations.length > 0 || disc.messages.length > 0) && h('div', { className: 'discussion-outils' },
        disc.conversations.length > 0 && h(Bouton, { variante: 'lien', onClick: disc.voirHistorique }, 'Historique (' + disc.conversations.length + ')'),
        disc.messages.length > 0 && h(Bouton, { variante: 'lien', onClick: disc.nouvelle }, 'Nouvelle conversation')),
      passage
        ? h('div', { className: 'discussion-passage' },
          h('span', null, h('strong', null, 'Passage choisi : '), '« ' + extrait + ' »',
            passage.length > 110 && h('button', { type: 'button', className: 'lien fort lien-passage', onClick: () => setPassageEntier(!passageEntier) }, passageEntier ? ' Réduire' : ' Voir en entier')),
          h(Bouton, { variante: 'icone', etiquette: 'Retirer le passage choisi', onClick: onRetirerPassage }, '×'))
        : h('p', { className: 'doux petit' }, invitation || 'Aucun passage choisi : sélectionne-en un dans ton texte, ou cite-le dans ta demande.'),
      passage && passage.length > R.MAX_PASSAGE && h('p', { className: 'erreur petit' }, 'Passage trop long : choisis au plus un ou deux paragraphes.'),
      autrePassage && h('div', { className: 'discussion-passage ancien' },
        h('span', null, h('strong', null, 'Cette conversation portait sur : '), '« ' + (passageConvEntier ? autrePassage : couper(autrePassage, 90)) + ' »',
          autrePassage.length > 90 && h('button', { type: 'button', className: 'lien fort lien-passage', onClick: () => setPassageConvEntier(!passageConvEntier) }, passageConvEntier ? ' Réduire' : ' Voir en entier')),
        h(Bouton, { variante: 'petit', onClick: () => onChoisirPassage(autrePassage) }, 'Le choisir')),
      h('div', { className: 'discussion-fil', ref: fil },
        !disc.messages.length && h('p', { className: 'bulle ia' }, `Dis-moi ce que tu veux en langage naturel : « trois versions plus courtes », « garde la citation telle quelle », « plus chaleureux »… Je te propose, tu choisis. Ton texte ne change que si tu appliques une proposition.`),
        disc.messages.map((m, mi) => h(Fragment, { key: mi },
          h('p', { className: cls('bulle', m.de === 'moi' ? 'moi' : 'ia') }, m.texte),
          (m.propositions || []).map((p, pi) => h('div', { key: pi, className: 'discussion-proposition' },
            // Un titre court qui dit l'effet de la proposition (donné par l'IA), sinon son numéro.
            h('div', { className: 'titre-proposition' }, m.propositions.length > 1 && h('span', { className: 'numero-proposition' }, pi + 1), p.titre || (m.propositions.length > 1 ? 'Proposition ' + (pi + 1) : 'Proposition')),
            h('p', { className: 'texte-propose' }, p.apercu || p.apres),
            p.pourquoi && h('p', { className: 'doux petit' }, p.pourquoi),
            p.vigilance && h('div', { className: 'vigilance' }, h('strong', null, 'Point de vigilance. '), p.vigilance),
            p.statut === 'appliquee'
              ? h('div', { className: 'actions-ligne' }, h(Pastille, { ton: 'ok' }, 'Appliquée'), h(Bouton, { variante: 'lien', onClick: () => disc.annuler(mi, pi) }, 'Annuler'))
              : h(Bouton, { variante: 'principal', onClick: () => disc.appliquer(mi, pi) }, 'Appliquer'))))),
        encours && h('p', { className: 'bulle ia doux' }, nomIA + ' réfléchit…'),
        !encours && (() => {
          const dernier = disc.messages[disc.messages.length - 1];
          return dernier && dernier.de === 'ia' && dernier.pistes && dernier.pistes.length > 0 && h('div', { className: 'discussion-pistes' },
            h('div', { className: 'etiquette-mini' }, 'Pour continuer'),
            dernier.pistes.map((t) => h('button', { key: t, type: 'button', className: 'puce piste', onClick: () => envoyer(t) }, t)));
        })()),
      disc.etat === 'erreur' && h('p', { className: 'erreur petit', role: 'status' }, disc.detail),
      h('div', { className: 'discussion-raccourcis' }, RACCOURCIS_DISCUSSION.map(([libelle, demande]) => h('button', { key: libelle, type: 'button', className: 'puce', disabled: encours, onClick: () => envoyer(demande) }, libelle))),
      h(EtatVoix, { voix, nomIA }),
      h('div', { className: 'discussion-saisie' },
        h('input', { className: 'champ-texte', value: saisie, placeholder: 'Ta consigne, en langage naturel', 'aria-label': 'Ta consigne à ' + nomIA, onChange: (e) => setSaisie(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); envoyer(saisie); } } }),
        h(BoutonMicro, { voix, nomIA }),
        h(Bouton, { variante: 'principal', disabled: encours || !saisie.trim(), onClick: () => envoyer(saisie) }, 'Envoyer')),
      );
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
      !enEdition && p.formulations && h('div', { className: 'formulations' },
        p.formulations.length > 1 && h(Fragment, null,
          h('div', { className: 'etiquette-mini' }, 'Formulations : touche celle que tu préfères'),
          h('div', { className: 'formulations-liste', role: 'radiogroup', 'aria-label': 'Formulations proposées' }, p.formulations.map((f, k) => h('button', {
            key: k, type: 'button', role: 'radio', 'aria-checked': (p.choix || 0) === k, className: cls('formulation', (p.choix || 0) === k && 'choisie'),
            onClick: () => rel.choisirFormulation(p, k),
          }, f)))),
        h(Bouton, { variante: 'lien', disabled: p.chargement, onClick: () => rel.autresFormulations(p) }, p.chargement ? 'Recherche de formulations…' : p.formulations.length > 1 ? 'D’autres formulations' : 'Proposer d’autres formulations'),
        p.erreurFormulations && h('p', { className: 'erreur petit', role: 'status' }, p.erreurFormulations)),
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
      h(Carte, { titre: 'Relecture', info: `${nomIA} relit l’orthographe, la grammaire, la ponctuation, le vocabulaire et la clarté. La typographie reste corrigée automatiquement.${rel.profil ? ' Elle tient compte de ton profil éditorial (Configuration › IA).' : ''} Chaque relecture utilise un peu de crédit sur ton compte.`, sousTitre: 'Rien n’est appliqué sans ton accord.', actions: h(Bouton, { variante: 'principal', onClick: rel.relire, disabled: encours }, encours ? 'Relecture…' : rel.props.length ? 'Relire à nouveau' : 'Relire avec ' + nomIA) },
        encours && h('p', { className: 'doux petit', role: 'status' }, `${nomIA} relit ton article. Cela peut prendre jusqu’à une minute.`),
        rel.etat === 'erreur' && h(Fragment, null,
          h('p', { className: 'erreur petit', role: 'status' }, rel.detail),
          h(Bouton, { variante: 'lien', onClick: onSecours }, 'Vérifier avec LanguageTool à la place')),
        rel.etat === 'fait' && h('p', { className: rel.props.length ? 'petit' : 'ok petit', role: 'status' },
          rel.props.length ? `${pluriel(rel.props.length, 'proposition')}, dont ${attente} en attente.` : `${nomIA} n’a rien relevé dans ton article.`),
        rel.etat === 'fait' && rel.ecartees > 0 && h('p', { className: 'doux petit' }, `${pluriel(rel.ecartees, 'proposition')} ${rel.ecartees > 1 ? 'écartées' : 'écartée'} : leur passage est introuvable tel quel dans ton texte.`)),
      rel.props.map((p) => h(CarteProposition, { key: p.id, p, rel })));
  }

  // Nouvel article (vide, ou d'après un modèle) : un champ vierge pour le texte, puis un court questionnaire (format, titre).
  function TexteEnAttente({ etat, dispatch, article, majA }) {
    const { choisirPolice, charte, reglages } = useContext(Contexte);
    const modele = typeof article.attenteTexte === 'string' ? etat.articles.find((a) => a.id === article.attenteTexte) : null;
    const [texte, setTexte] = useState('');
    const [questions, setQuestions] = useState(false);
    const paragraphes = texte.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    useEffect(() => { const z = document.getElementById('texte-modele'); if (z && !questions) z.focus(); }, [questions]);
    const commencer = ({ format, titre }) => {
      let sl = M.decouperMecaniquement(paragraphes, format, article.fond, choisirPolice, { charte, reglages });
      if (modele) sl = appliquerModele(sl, modele);
      const premier = paragraphes[0];
      const nom = titre || (premier.length > 48 ? premier.slice(0, 48) + '…' : premier);
      majA((a) => { const { attenteTexte, ...reste } = a; return L.lierArticle({ ...reste, titre: nom, format, texte: paragraphes, slides: sl }); }, null,
        modele ? `Pages créées avec la mise en page de « ${modele.titre} ».` : 'Article prêt : relis ton texte, la mise en page s’ouvrira à l’étape 2.');
      if (etat.etape !== 'texte') dispatch({ type: 'etape', etape: 'texte' });
    };
    return h('div', { className: 'colonne-unique' },
      h(Carte, { titre: 'Ton texte', sousTitre: modele ? `Mise en page reprise de « ${modele.titre} » : format, fond, gabarits et logo.` : 'Colle le texte de ton article : la typographie française est corrigée au passage.' },
        etat.etape !== 'texte' && h('p', { className: 'note' }, 'Colle d’abord le texte de ton article.'),
        h(ZoneTexteTypo, { id: 'texte-modele', className: 'zone-texte zone-attente', rows: 8, valeur: texte, onValeur: setTexte, placeholder: 'Colle ici le texte de ton article.', 'aria-label': 'Texte de l’article' }),
        h('p', { className: 'doux petit' }, paragraphes.length ? `${paragraphes.length} paragraphe(s) · ${M.compterMots(texte)} mots.` : 'Un article laissé vide est supprimé quand tu le quittes.'),
        h('div', { className: 'actions-ligne' }, h(Bouton, { variante: 'principal', disabled: !paragraphes.length, onClick: () => setQuestions(true) }, 'Continuer'))),
      questions && h(Questionnaire, { etat, article, paragraphes, modele, retour: () => setQuestions(false), commencer }));
  }

  // Le questionnaire du nouvel article : le format (sauf d'après un modèle) et le titre (son nom dans la bibliothèque).
  function Questionnaire({ etat, article, paragraphes, modele, retour, commencer }) {
    const [format, setFormat] = useState(modele ? modele.format : article.format || 'portrait');
    const [mode, setMode] = useState('auto');
    const [titre, setTitre] = useState('');
    const [bulle, setBulle] = useState(false);
    const [props, setProps] = useState({ etat: 'repos', liste: [], detail: '' });
    const [disc, setDisc] = useState({ ouverte: false, messages: [], saisie: '', enCours: false });
    const refBulle = useRef(null);
    const configIA = IA.active();
    const nomIA = IA.ASSISTANT.nom;
    const profil = (etat.projet && etat.projet.profilEditorial) || '';
    const texte = paragraphes.join('\n\n');
    const voixTitre = useConversationVocale({ envoyer: (t) => envoyer(t), messages: disc.messages, occupe: disc.enCours });
    const premier = paragraphes[0] || '';
    useEffect(() => {
      if (!bulle) return undefined;
      const fermer = (e) => { if (refBulle.current && !refBulle.current.contains(e.target)) setBulle(false); };
      document.addEventListener('pointerdown', fermer);
      return () => document.removeEventListener('pointerdown', fermer);
    }, [bulle]);
    async function generer() {
      setBulle(false); setDisc((d) => ({ ...d, ouverte: false }));
      setProps({ etat: 'encours', liste: [], detail: '' });
      try {
        const brut = await IA.demander(configIA, { systeme: R.consigneTitres(), texte: R.blocProfil(profil) + R.consigne(texte), maxJetons: 1500, delai: 90000, json: R.JSON_TITRES });
        const liste = R.lireTitres(brut);
        if (!liste.length) throw new Error('la réponse est vide. Réessaie.');
        setProps({ etat: 'fait', liste, detail: '' });
      } catch (erreur) { setProps({ etat: 'erreur', liste: [], detail: erreur instanceof IA.ErreurIA ? erreur.message : `${nomIA} n’a pas pu proposer de titre : ${erreur.message}` }); }
    }
    async function envoyer(force) {
      const demande = (typeof force === 'string' ? force : disc.saisie).trim();
      if (!demande || disc.enCours) return;
      const historique = disc.messages;
      setDisc({ ...disc, messages: historique.concat([{ de: 'moi', texte: demande }]), saisie: '', enCours: true });
      try {
        const brut = await IA.demander(configIA, { systeme: R.SYSTEME_TITRE_DISCUSSION, texte: R.messageTitre(texte, historique, demande, profil), maxJetons: 800, delai: 90000 });
        const rep = String(brut || '').trim() || '…';
        setDisc((d) => ({ ...d, enCours: false, messages: d.messages.concat([{ de: 'ccb', texte: rep }]) }));
      } catch (erreur) { setDisc((d) => ({ ...d, enCours: false, messages: d.messages.concat([{ de: 'ccb', texte: erreur instanceof IA.ErreurIA ? erreur.message : 'Je n’ai pas pu répondre : ' + erreur.message }]) })); }
    }
    const titresDans = (t) => [...String(t).matchAll(/«\s*([^»]{2,80}?)\s*»/g)].map((m) => m[1]);
    const choisirTitre = (t) => { setTitre(t); setMode('perso'); setProps({ etat: 'repos', liste: [], detail: '' }); };
    const pret = mode === 'auto' || titre.trim();
    return h(Feuille, { titre: 'Ton nouvel article', onAnnuler: retour, pied: h('span', { className: 'pied-droite' }, h(Bouton, { variante: 'principal', disabled: !pret, onClick: () => commencer({ format, titre: mode === 'perso' ? titre.trim() : '' }) }, 'Commencer')) },
      modele
        ? h('p', { className: 'doux petit' }, `Mise en page reprise de « ${modele.titre} » : format, fond, gabarits et logo.`)
        : h('section', { className: 'question' },
          h('h3', null, 'Quel format ?'),
          h('p', { className: 'doux petit' }, 'Les deux conviennent à LinkedIn et à Instagram.'),
          h('div', { className: 'formats', role: 'group', 'aria-label': 'Format' },
            [['carre', 'Carré · 1:1', 'Comme tes carrousels actuels'], ['portrait', 'Portrait · 4:5', 'Plus de place, plus visible dans le fil']].map(([v, nom, aide]) => h('button', { key: v, type: 'button', className: 'format', 'aria-pressed': format === v, onClick: () => setFormat(v) },
              h('span', { className: cls('dessin-format', v) }), h('strong', null, nom), h('span', { className: 'doux petit' }, aide))))),
      h('section', { className: 'question' },
        h('h3', null, 'Quel titre dans ta bibliothèque ?'),
        h('p', { className: 'doux petit' }, 'Il sert à retrouver l’article ; il n’apparaît pas sur les pages.'),
        h(Segmente, { etiquette: 'Titre', valeur: mode, onChange: setMode, options: [{ valeur: 'auto', libelle: 'Les premières lignes' }, { valeur: 'perso', libelle: 'Écrire un titre' }] }),
        mode === 'auto' && h('p', { className: 'doux petit' }, `Titre : « ${premier.length > 48 ? premier.slice(0, 48) + '…' : premier} »`),
        mode === 'perso' && h(Fragment, null,
          h('div', { className: 'ligne-titre' },
            h('input', { className: 'champ-texte', type: 'text', value: titre, placeholder: 'Ton titre', 'aria-label': 'Titre de l’article', onChange: (e) => setTitre(e.target.value), autoFocus: true }),
            configIA && h('span', { ref: refBulle, className: 'ancre-bulle' },
              h('button', { type: 'button', className: cls('bouton-robot', bulle && 'actif'), 'aria-label': nomIA, title: nomIA, 'aria-haspopup': 'true', 'aria-expanded': bulle, onClick: () => setBulle(!bulle) }, h(Robot, { taille: 40 })),
              bulle && h('div', { className: 'bulle-ccb', role: 'menu', 'aria-label': nomIA },
                h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', onClick: generer }, h('strong', null, 'Générer 3 propositions'), h('span', { className: 'doux petit' }, 'Trois titres tirés de ton texte')),
                h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', onClick: () => { setBulle(false); setProps({ etat: 'repos', liste: [], detail: '' }); setDisc((d) => ({ ...d, ouverte: true })); } }, h('strong', null, 'Discuter'), h('span', { className: 'doux petit' }, 'Chercher le titre avec ' + nomIA))))),
          props.etat === 'encours' && h('p', { className: 'doux petit', role: 'status' }, `${nomIA} cherche trois titres…`),
          props.etat === 'erreur' && h('p', { className: 'erreur petit', role: 'status' }, props.detail),
          props.etat === 'fait' && h('div', { className: 'titres-proposes' }, props.liste.map((p, k) => h('div', { key: k, className: 'titre-propose' },
            h('div', null, h('strong', null, p.titre), p.pourquoi && h('div', { className: 'doux petit' }, p.pourquoi)),
            h(Bouton, { variante: 'petit', onClick: () => choisirTitre(p.titre) }, 'Choisir')))),
          disc.ouverte && h('div', { className: 'mep-discussion' },
            disc.messages.length > 0 && h('div', { className: 'mep-fil-messages' }, disc.messages.map((m, k) => h('div', { key: k, className: cls('mep-message', m.de === 'moi' ? 'moi' : 'ccb') }, m.texte,
              m.de === 'ccb' && titresDans(m.texte).length > 0 && h('div', { className: 'actions-ligne' }, titresDans(m.texte).map((t) => h(Bouton, { key: t, variante: 'petit', onClick: () => choisirTitre(t) }, 'Utiliser « ' + t + ' »')))))),
            disc.enCours && h('p', { className: 'doux petit', role: 'status' }, `${nomIA} réfléchit…`),
            h('div', { className: 'mep-saisie' },
              h('textarea', { rows: 2, value: disc.saisie, placeholder: 'Par exemple : plus court, plus doux, avec le prénom…', 'aria-label': 'Ta demande à ' + nomIA, onChange: (e) => setDisc({ ...disc, saisie: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } } }),
              h('div', { className: 'actions-ligne' }, h(BoutonMicro, { voix: voixTitre, nomIA }), h(Bouton, { variante: 'principal', disabled: !disc.saisie.trim() || disc.enCours, onClick: () => envoyer() }, 'Envoyer'))),
            h(EtatVoix, { voix: voixTitre, nomIA })))));
  }

  function EtapeTexte({ etat, dispatch, article, majA }) {
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
    const profilEditorial = (etat && etat.projet && etat.projet.profilEditorial) || '';
    const rel = useRelecture(article, texteComplet, majA, profilEditorial);
    const configIA = IA.active();
    const [secours, setSecours] = useState(false);
    const relectureIA = !!configIA && !secours;
    const marquesRelecture = relectureIA ? rel.props.filter((p) => p.statut === 'attente').map((p) => ({ debut: p.debut, fin: p.fin })) : [];
    const actifRelecture = relectureIA && rel.actif ? (rel.props.find((p) => p.id === rel.actif) || {}).debut : undefined;
    const [selection, setSelection] = useState(null);
    const choisirSelection = (debut, fin) => setSelection(fin - debut >= 3 ? { debut, fin } : null);
    // Sélection au doigt (iPad) ou au clavier : on suit aussi les changements de sélection du document.
    useEffect(() => {
      const suivre = () => { const el = zone.current; if (el && document.activeElement === el) choisirSelection(el.selectionStart, el.selectionEnd); };
      document.addEventListener('selectionchange', suivre);
      return () => document.removeEventListener('selectionchange', suivre);
    }, []);
    const passageChoisi = selection && texteComplet.slice(selection.debut, selection.fin);
    const disc = useDiscussion(article, texteComplet, majA, choisirSelection, profilEditorial, { precision: R.CONTEXTE_TEXTE });
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
        h(Carte, { titre: 'Texte de l’article', info: 'Ton texte est la référence : les pages suivent chaque modification, sans changer leur mise en page.', sousTitre: `${article.texte.length} paragraphes · ${M.compterMots(texteComplet)} mots. Une ligne vide sépare deux paragraphes. Les pages se mettent à jour à chaque modification.`, actions: h('div', { className: 'actions-texte' },
            h('button', {
              type: 'button', className: cls('bouton-robot', disc.ouvert && 'actif'),
              'aria-label': disc.ouvert ? 'Fermer CCB' : 'CCB · Creative Collaborative Boost',
              title: disc.ouvert ? 'Fermer CCB' : 'CCB · Creative Collaborative Boost',
              'aria-expanded': relectureIA ? disc.ouvert : undefined,
              onClick: () => (!relectureIA ? dispatch({ type: 'message', message: 'Pour discuter avec l’IA, ajoute une clé dans Configuration, onglet IA.' }) : disc.ouvert ? disc.fermer() : disc.ouvrir()),
            }, h(Robot, { taille: 46 }))) },
          h(EditeurTexte, { valeur: texteComplet, onChange: modifierTexte, marques: (() => {
              const autres = marquesRelecture.concat(verification.erreurs.map((e) => ({ debut: e.offset, fin: e.offset + e.length })));
              if (!(relectureIA && disc.ouvert && selection)) return autres;
              // Pendant la discussion, le passage choisi reste surligné dans le texte.
              return [{ debut: selection.debut, fin: selection.fin, classe: 'passage-discussion' }].concat(autres.filter((m) => m.fin <= selection.debut || m.debut >= selection.fin));
            })(), active: actifRelecture !== undefined ? actifRelecture : active, zoneRef: zone, onCurseur: relectureIA ? rel.curseur : undefined, onSelection: choisirSelection }))),
      h('aside', { className: 'panneau' },
        relectureIA && h(PanneauRelecture, { rel, nomIA: IA.ASSISTANT.nom, onSecours: () => setSecours(true) }),
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
            ? h(Bouton, { variante: 'lien', onClick: () => setSecours(false) }, 'Revenir à la relecture par ' + IA.ASSISTANT.nom)
            : h('p', { className: 'doux petit' }, 'Pour une relecture complète (grammaire, vocabulaire, clarté), ajoute une clé dans Configuration, onglet IA.')),
        h(Carte, { titre: 'Typographie', info: 'Ces règles ne changent jamais tes mots. Les adresses web, les heures (14:30) et les nombres ne sont pas touchés.', sousTitre: 'Corrigée toute seule quand tu tapes ou colles : espace insécable avant : ; ! ? et dans « », guillemets « », apostrophe ’, points de suspension …' },
          typo.total
            ? h(Fragment, null,
              h('p', { className: 'petit' }, typo.total === 1 ? 'Reste 1 correction : ' + T.resume(typo.liste) + '.' : 'Restent ' + T.resume(typo.liste) + '.'),
              h(Bouton, { variante: 'principal', onClick: () => majA(T.corrigerArticle, null, 'Typographie corrigée : ' + T.resume(typo.liste) + '.') }, 'Corriger la typographie'))
            : h('p', { className: 'ok petit' }, 'Ton article respecte ces règles.')),
        relectureIA && disc.ouvert && h(FenetreDiscussion, {
          disc, nomIA: IA.ASSISTANT.nom, passage: passageChoisi, onRetirerPassage: () => setSelection(null),
          onChoisirPassage: (t) => { const pos = R.placerPassage(texteComplet, t, null); if (pos) setSelection({ debut: pos[0], fin: pos[1] }); else disc.signaler('Ce passage n’est plus dans ton texte tel quel : sélectionne-le de nouveau.'); },
        })),
      remplacer !== null && h(Feuille, { titre: 'Nouveau texte', onAnnuler: () => setRemplacer(null), action: h(Bouton, { variante: 'principal', disabled: !remplacer.trim(), onClick: remplacerTout }, 'Remplacer') },
        h('p', { className: 'note' }, 'Le nouveau texte est redécoupé en pages avec la même mise en page : fond, format, gabarits et logo. Tu pourras l’annuler juste après.'),
        h(ZoneTexteTypo, { className: 'zone-texte', rows: 12, valeur: remplacer, onValeur: setRemplacer, placeholder: 'Colle ici le nouveau texte.', 'aria-label': 'Nouveau texte' })));
  }

  const FAMILLES = [['Couverture', ['V1', 'V2', 'V3', 'V4', 'V5']], ['Texte', ['T1', 'T2', 'T3', 'T4', 'T5']], ['Fin', ['F1']]];

  /* ---------- Étape 2 : Composition (fichier composition.js) ---------- */

  // ia : donné à la demande (ces éléments sont définis plus bas dans ce fichier).
  const { EtapeComposition } = (racine.PostsOPComposition || require('./composition.js'))({ React, M, L, T, OP, Contexte, Icone, Bouton, SlideCanvas, cls, ia: () => ({ useDiscussion, FenetreDiscussion, Robot }) });

  /* ---------- Étapes 4 et 5 ---------- */

  const LIMITES_DESCRIPTION = { instagram: 2200, linkedin: 3000 }; // indicatives, à vérifier

  // Propositions de description par l'IA, gardées le temps de la session (on peut changer d'étape sans les perdre).
  const PROPOSITIONS_DESCRIPTION = new Map();

  function EtapeDescription({ etat, dispatch, article, majA, seulement, numero }) {
    const descriptions = article.descriptions || DESCRIPTIONS_VIDES;
    const configIA = IA.active();
    const nomIA = IA.ASSISTANT.nom;
    const [props, setProps] = useState(() => PROPOSITIONS_DESCRIPTION.get(article.id) || {});
    const profil = (etat && etat.projet && etat.projet.profilEditorial) || '';
    const reseauCourant = seulement || 'linkedin';
    const texteCourant = descriptions[reseauCourant].fr || '';
    const [selDesc, setSelDesc] = useState(null);   // passage choisi dans le texte du post
    const [bulle, setBulle] = useState(false);      // bulle du robot : trois propositions ou discussion
    const refBulle = useRef(null);
    const disc = useDiscussion(article, texteCourant, majA, (debut, fin) => setSelDesc({ debut, fin }), profil, {
      cle: article.id + ':post:' + reseauCourant, ecrire: (t) => majA(OP.description(reseauCourant, t), null), precision: R.precisionPost(reseauCourant, article.slides),
    });
    useEffect(() => {
      if (!bulle) return undefined;
      const fermer = (e) => { if (refBulle.current && !refBulle.current.contains(e.target)) setBulle(false); };
      const echap = (e) => { if (e.key === 'Escape') setBulle(false); };
      document.addEventListener('pointerdown', fermer); racine.addEventListener('keydown', echap);
      return () => { document.removeEventListener('pointerdown', fermer); racine.removeEventListener('keydown', echap); };
    }, [bulle]);
    const passageDesc = selDesc && selDesc.fin > selDesc.debut ? texteCourant.slice(selDesc.debut, selDesc.fin) : '';
    const noterSelection = (e) => { const t = e.target; setSelDesc(t.selectionEnd > t.selectionStart ? { debut: t.selectionStart, fin: t.selectionEnd } : null); };
    async function proposerTrois(reseau) {
      const config = IA.active();
      if (!config) return;
      setBulle(false);
      majProp(reseau, { etat: 'encours', trois: true });
      try {
        const brut = await IA.demander(config, { systeme: R.consigneDescriptions(reseau), texte: R.consigne(article.texte.join('\n\n'), profil) + '\n\n' + R.resumeCarrousel(article.slides), maxJetons: 3000, delai: 120000, json: R.JSON_DESCRIPTIONS });
        let textes = R.lireDescriptions(brut);
        if (!textes.length) { const t = R.nettoyerDescription(typeof brut === 'string' ? brut : ''); if (t && !/^\{/.test(t)) textes = [t]; }
        if (!textes.length) throw new Error('La réponse de l’IA est vide. Réessaie.');
        majProp(reseau, { etat: 'fait', textes: textes.map((t) => T.appliquer(t, T.corrections(t))) });
      } catch (erreur) {
        majProp(reseau, { etat: 'erreur', detail: erreur.message });
      }
    }
    const majProp = (reseau, valeur) => setProps((x) => { const y = { ...x, [reseau]: valeur }; PROPOSITIONS_DESCRIPTION.set(article.id, y); return y; });
    async function proposer(reseau) {
      const config = IA.active();
      if (!config) return;
      majProp(reseau, { etat: 'encours' });
      try {
        const brut = await IA.demander(config, { systeme: R.consigneDescription(reseau), texte: R.consigne(article.texte.join('\n\n'), (etat && etat.projet && etat.projet.profilEditorial) || '') + '\n\n' + R.resumeCarrousel(article.slides), maxJetons: 1500, delai: 90000 });
        const t = R.nettoyerDescription(brut);
        if (!t) throw new Error('La réponse de l’IA est vide. Réessaie.');
        majProp(reseau, { etat: 'fait', texte: T.appliquer(t, T.corrections(t)) });
      } catch (erreur) {
        majProp(reseau, { etat: 'erreur', detail: erreur.message });
      }
    }
    return h('div', { className: 'colonne-unique' },
      !configIA && h('p', { className: 'note' }, 'Pour que ' + IA.ASSISTANT.nom + ' te propose une description, ajoute une clé dans Configuration, onglet IA.'),
      ['instagram', 'linkedin'].filter((x) => !seulement || x === seulement).map((reseau) => {
        const texte = descriptions[reseau].fr || '';
        const p = props[reseau] || { etat: 'repos' };
        const limite = LIMITES_DESCRIPTION[reseau];
        return h(Carte, {
          key: reseau, titre: (numero ? numero + ' · ' : '') + (reseau === 'instagram' ? 'Légende Instagram' : 'Texte du post LinkedIn'),
          info: (reseau === 'instagram' ? 'Seules les premières lignes s’affichent avant « plus » : la première phrase compte le plus.' : 'Il s’affiche au-dessus du document : il donne envie de l’ouvrir.')
            + (configIA && etat && etat.projet && String(etat.projet.profilEditorial || '').trim() ? ` ${nomIA} tient compte de ton profil éditorial (Configuration › IA).` : ''),
          actions: h(Fragment, null,
            configIA && h('span', { ref: refBulle, className: 'ancre-bulle' },
              h('button', { type: 'button', className: cls('bouton-robot', 'bouton-robot-menu', (bulle || disc.ouvert) && 'actif'), title: nomIA + ' · Creative Collaborative Boost', 'aria-label': nomIA + ' · Creative Collaborative Boost', 'aria-haspopup': 'true', 'aria-expanded': bulle, onClick: () => setBulle(!bulle) }, h(Robot, { taille: 40 })),
              bulle && h('div', { className: 'bulle-ccb', role: 'menu', 'aria-label': nomIA },
                h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', disabled: p.etat === 'encours', onClick: () => proposerTrois(reseau) }, h('strong', null, 'Générer 3 propositions'), h('span', { className: 'doux petit' }, 'Trois versions à partir de ton article')),
                h('button', { type: 'button', role: 'menuitem', className: 'item-bulle', onClick: () => { setBulle(false); disc.ouvrir(); } }, h('strong', null, 'Discuter'), h('span', { className: 'doux petit' }, passageDesc ? 'À propos du passage choisi' : 'Améliorer ton texte avec ' + nomIA)))),
            h(Bouton, { variante: 'petit', disabled: !texte, onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(texte).catch(() => {}); dispatch({ type: 'message', message: 'Description copiée.' }); } }, 'Copier')),
        },
        h('textarea', { className: 'zone-texte', rows: 9, value: texte, placeholder: 'Écris ici le texte qui accompagnera ton carrousel.', onChange: (e) => { majA(OP.description(reseau, e.target.value), 'description-' + reseau); noterSelection(e); }, onSelect: noterSelection, onKeyUp: noterSelection, onPointerUp: noterSelection, 'aria-label': 'Description ' + reseau }),
        // Un passage choisi : un bouton pour en discuter avec CCB.
        configIA && passageDesc && h('div', { className: 'passage-post' },
          h('button', { type: 'button', className: 'bouton secondaire petit bouton-passage', onPointerDown: (e) => e.preventDefault(), onClick: () => disc.ouvrir() }, h(Robot, { taille: 24 }), 'Discuter de ce passage avec ' + nomIA),
          h('span', { className: 'doux petit' }, `« ${passageDesc.length > 60 ? passageDesc.slice(0, 60) + '…' : passageDesc} »`)),
        h('div', { className: 'doux petit droite' }, `${texte.length} / ${limite} caractères (limite indicative)`),
        p.etat === 'encours' && h('p', { className: 'doux petit', role: 'status' }, p.trois ? `${nomIA} écrit trois propositions à partir de ton article…` : `${nomIA} écrit une proposition à partir de ton article…`),
        p.etat === 'fait' && p.textes && h('div', { className: 'propositions-post' },
          p.textes.map((t, k) => h('div', { key: k, className: 'proposition-description' },
            h('div', { className: 'etiquette-mini' }, `Proposition ${k + 1} de ${nomIA}`),
            h('p', { className: 'texte-propose' }, t),
            h('div', { className: cls('petit', t.length > limite ? 'erreur' : 'doux') }, `${t.length} caractères${t.length > limite ? ' : au-delà de la limite indicative' : ''}`),
            h('div', { className: 'actions-ligne' }, h(Bouton, { variante: 'principal', onClick: () => { majA(OP.description(reseau, t), null, texte ? 'Texte du post remplacé par la proposition ' + (k + 1) + '.' : 'Proposition ' + (k + 1) + ' utilisée.'); majProp(reseau, { etat: 'repos' }); } }, texte ? 'Remplacer mon texte' : 'Utiliser celle-ci')))),
          h(Bouton, { variante: 'lien', onClick: () => majProp(reseau, { etat: 'repos' }) }, 'Ignorer les propositions')),
        reseau === reseauCourant && configIA && disc.ouvert && h(FenetreDiscussion, {
          disc, nomIA, passage: passageDesc, onRetirerPassage: () => setSelDesc(null),
          onChoisirPassage: (t) => { const pos = R.placerPassage(texteCourant, t, null); if (pos) setSelDesc({ debut: pos[0], fin: pos[1] }); else disc.signaler('Ce passage n’est plus dans ton texte tel quel : sélectionne-le de nouveau.'); },
        }),
        p.etat === 'erreur' && h('p', { className: 'erreur petit', role: 'status' }, p.detail),
        p.etat === 'fait' && !p.textes && h('div', { className: 'proposition-description' },
          h('div', { className: 'etiquette-mini' }, 'Proposition de ' + nomIA),
          h('p', { className: 'texte-propose' }, p.texte),
          h('div', { className: cls('petit', p.texte.length > limite ? 'erreur' : 'doux') }, `${p.texte.length} caractères${p.texte.length > limite ? ' : au-delà de la limite indicative' : ''}`),
          h('div', { className: 'actions-ligne' },
            h(Bouton, { variante: 'principal', onClick: () => { majA(OP.description(reseau, p.texte), null, texte ? 'Description remplacée par la proposition.' : 'Proposition utilisée.'); majProp(reseau, { etat: 'repos' }); } }, texte ? 'Remplacer mon texte' : 'Utiliser cette proposition'),
            h(Bouton, { variante: 'lien', onClick: () => majProp(reseau, { etat: 'repos' }) }, 'Ignorer'))));
      }));
  }

  const taille = (octets) => (octets > 1048576 ? (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(octets / 1024)) + ' Ko');

  function EtapeExport({ dispatch, article, majA, partie, numeros = {} }) {
    const { choisirPolice, reglages, charte, images } = useContext(Contexte);
    const [quoi, setQuoi] = useState(article.reseau === 'linkedin' ? 'pdf' : article.reseau === 'deux' ? 'les-deux' : 'png');
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

    const avecFichiers = !partie || partie === 'fichiers';
    const avecPublie = !partie || partie === 'publie';
    return h('div', { className: 'colonne-unique' },
      avecFichiers && h(Carte, { titre: numeros.fichiers ? numeros.fichiers + ' · Fichier' : 'Exporter', info: 'Les fichiers sont dessinés par le même moteur que l’aperçu : ce que tu vois est ce que tu obtiens.', sousTitre: `${total} pages · ${M.FORMATS[article.format].nom} · fond ${M.fondsDe(charte.palette)[article.fond].nom.toLowerCase()}` },
        h(Ligne, { etiquette: 'Fichiers', aide: 'Images PNG pour Instagram, PDF pour LinkedIn (le réseau le recommande pour les carrousels).' },
          h(Segmente, { valeur: quoi, onChange: (v) => { setQuoi(v); setSuivi({ statut: 'repos' }); }, options: [{ valeur: 'png', libelle: 'Images PNG' }, { valeur: 'pdf', libelle: 'PDF' }, { valeur: 'les-deux', libelle: 'Les deux' }] })),
        h('p', { className: 'doux petit' }, `Résolution des images : ×${reglages.resolution === '1' ? 1 : 2} (modifiable dans Réglages).${exacte ? '' : ' Tes polices ne sont pas importées sur cet appareil : le rendu sera approché, et le PDF contiendra des images.'}`),
        suivi.statut !== 'confirmation' && h(Bouton, { variante: 'principal large', disabled: suivi.statut === 'encours', onClick: () => preparer(false) }, h(Icone, { nom: 'telecharger', taille: 18 }), suivi.statut === 'encours' ? 'Préparation…' : 'Préparer les fichiers'),
        suivi.statut === 'confirmation' && h('div', { className: 'confirmation' },
          h('p', null, h('strong', null, 'Avant d’exporter, il reste :')),
          h('ul', { className: 'liste-alertes' },
            alertes.map((a) => h('li', { key: a.cle, className: a.niveau }, h('span', null, (a.slide !== null ? `Page ${a.slide + 1} · ` : '') + a.message))),
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
      avecPublie && h(Carte, { titre: numeros.publie ? numeros.publie + ' · Publié ?' : 'Publication', info: 'Une fois le carrousel publié sur le réseau, marque-le comme publié : il rejoint la section Publiés de ta bibliothèque.' },
        article.statut === 'Publié'
          ? h('div', { className: 'actions-ligne' }, h(Pastille, { ton: 'ok' }, 'Publié le ' + new Date(article.publie || Date.now()).toLocaleDateString('fr-FR')), h(Bouton, { variante: 'lien', onClick: () => dispatch({ type: 'statut', id: article.id, statut: 'Exporté' }) }, 'Remettre en cours'))
          : h(Bouton, { onClick: () => dispatch({ type: 'statut', id: article.id, statut: 'Publié' }) }, h(Icone, { nom: 'coche', taille: 18 }), 'Marquer comme publié')),
      !partie && h('div', { className: 'grille-export' }, article.slides.map((s, k) => h('div', { key: k, className: 'export-item' },
        h(SlideCanvas, { slide: s, formatId: article.format, fondId: article.fond, largeur: 180, index: k, total, logo, etiquette: 'Page ' + (k + 1) }), h('div', { className: 'doux petit centre' }, k + 1)))));
  }

  // Date de publication : programmée (elle apparaît dans le calendrier de la bibliothèque) ou « Ne pas programmer ».
  function CarteProgrammation({ dispatch, article, majA, numero }) {
    const p = article.programme;
    const demain = () => { const d = new Date(); d.setDate(d.getDate() + 1); return CAL.cle(d); };
    const choisir = (v) => {
      if (v === 'non') majA((a) => ({ ...a, programme: null }), null, 'Publication non programmée.');
      else if (!p) majA((a) => ({ ...a, programme: { date: demain(), heure: '09:00', mode: null } }), null, `Programmé le ${CAL.libelleLong(demain())}.`);
    };
    return h(Carte, { titre: (numero ? numero + ' · ' : '') + 'Date de publication', info: 'La date programmée apparaît dans le calendrier de la bibliothèque. « Ne pas programmer » la retire.' },
      h(Segmente, { etiquette: 'Programmer la publication', valeur: p ? 'oui' : 'non', onChange: choisir, options: [{ valeur: 'oui', libelle: 'Programmer' }, { valeur: 'non', libelle: 'Ne pas programmer' }] }),
      p && h('div', { className: 'champs-programme' },
        h('label', null, h('span', null, 'Date'), h('input', { className: 'champ-texte', type: 'date', value: p.date, onChange: (e) => e.target.value && majA((a) => ({ ...a, programme: { ...a.programme, date: e.target.value, mode: null } }), 'programme') })),
        h('label', null, h('span', null, 'Heure'), h('input', { className: 'champ-texte', type: 'time', value: p.heure || '09:00', onChange: (e) => e.target.value && majA((a) => ({ ...a, programme: { ...a.programme, heure: e.target.value, mode: null } }), 'programme') })),
        h(Bouton, { variante: 'petit', onClick: () => dispatch({ type: 'feuille', feuille: 'calendrier' }) }, 'Ouvrir le calendrier')),
      !p && h('p', { className: 'doux petit' }, 'Pas de date : l’article reste dans « En cours » jusqu’à ce que tu le marques comme publié.'));
  }

  /* ---------- Étape 3 : Publication (texte du post, fichier, date, publié) ---------- */
  function EtapePublication({ etat, dispatch, article, majA }) {
    const [reseau, setReseau] = useState(article.reseau === 'instagram' ? 'instagram' : 'linkedin');
    const deux = article.reseau === 'deux';
    const changerReseau = (v) => { majA((a) => ({ ...a, reseau: v }), null, `Publication prévue sur ${nomReseau(v)}.`); if (v !== 'deux') setReseau(v); };
    const [fil, setFil] = useState(false);
    const logo = article.logo || 'auto';
    const total = article.slides.length;
    return h('div', { className: 'publication' },
      h('div', { className: 'publication-etapes' },
        h(Carte, { titre: 'Où publies-tu ce carrousel ?', sousTitre: 'Il décide du texte à préparer et des fichiers : PDF pour LinkedIn, images pour Instagram.' },
          h(Segmente, { etiquette: 'Réseau de publication', valeur: article.reseau || 'deux', onChange: changerReseau, options: [{ valeur: 'linkedin', libelle: 'LinkedIn' }, { valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'deux', libelle: 'Les deux' }] })),
        deux && h('div', { className: 'publication-reseau' }, h('span', { className: 'doux petit' }, 'Texte du post pour'),
          h(Segmente, { etiquette: 'Réseau du texte', petit: true, valeur: reseau, onChange: setReseau, options: [{ valeur: 'linkedin', libelle: 'LinkedIn' }, { valeur: 'instagram', libelle: 'Instagram' }] })),
        h(EtapeDescription, { key: (deux ? reseau : article.reseau || 'linkedin'), etat, dispatch, article, majA, seulement: deux ? reseau : (article.reseau === 'instagram' ? 'instagram' : 'linkedin'), numero: 1 }),
        h(EtapeExport, { key: 'fichiers-' + article.reseau, etat, dispatch, article, majA, partie: 'fichiers', numeros: { fichiers: 2 } }),
        h(CarteProgrammation, { dispatch, article, majA, numero: 3 }),
        h(EtapeExport, { etat, dispatch, article, majA, partie: 'publie', numeros: { publie: 4 } })),
      h('aside', { className: 'publication-apercu', 'aria-label': 'Aperçu du carrousel' },
        article.slides[0] && h('button', { type: 'button', className: 'page-cliquable', 'aria-label': 'Ouvrir le carrousel en grand', title: 'Ouvrir en grand', onClick: () => setFil(true) },
          h(SlideCanvas, { slide: article.slides[0], formatId: article.format, fondId: article.fond, largeur: 236, index: 0, total, logo, etiquette: 'Page 1' })),
        h('div', { className: 'publication-vignettes' }, article.slides.slice(1).map((s, k) => h(SlideCanvas, { key: k, slide: s, formatId: article.format, fondId: article.fond, largeur: 44, index: k + 1, total, logo }))),
        fil && h(GrandeFenetre, { slides: article.slides, format: article.format, fond: article.fond, depart: 0, logo, profil: (etat.projet && etat.projet.profilEditorial) || '', texte: article.texte[0],
          onModifier: (chg, annonce) => majA((a) => chg.reduce((x, c) => {
            let y = c.lien ? OP.blocLie(c.i, c.n, c.texte)(x) : OP.modifierBloc(c.i, c.n, { texte: c.texte })(x);
            if (c.style) y = OP.modifierBloc(c.i, c.n, { style: c.style })(y);
            return y;
          }, a), null, annonce), textes: { linkedin: ((article.descriptions || {}).linkedin || {}).fr || article.texte[0], instagram: ((article.descriptions || {}).instagram || {}).fr || article.texte[0] }, onFermer: () => setFil(false) })));
  }

  /* ================================================================== */
  /* 7. Configuration                                                    */
  /* ================================================================== */

  function Configuration({ etat, dispatch, actions }) {
    const onglets = { charte: OngletCharte, ressources: OngletRessources, reglages: OngletReglages, synchro: OngletSynchro, ia: OngletIA };
    return h(Fragment, null,
      h(Barre, { etat, dispatch, titre: 'Configuration', gauche: h(MarqueApp, { etat, dispatch }) }),
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
          h('div', null, h('h4', null, 'Obligatoire'), h('ul', { className: 'liste-simple' }, h('li', null, 'Marges de 81 px à gauche et à droite, 110 px en haut et en bas, pour tous les gabarits ; texte aligné à gauche par défaut'), h('li', null, 'Un seul fond par carrousel'), h('li', null, 'Logo officiel sur la dernière page'))),
          h('div', null, h('h4', null, 'Autorisé'), h('ul', { className: 'liste-simple' }, h('li', null, 'Cinq fonds, dont deux nuances pâles'), h('li', null, 'Format 1:1 ou 4:5'), h('li', null, 'Dernière page centrée'), h('li', null, 'Logo sur chaque page (réglage)'), h('li', null, 'Alignement, gras, italique, souligné, taille et filet choisis paragraphe par paragraphe'))),
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
        h(Ligne, { etiquette: 'Mots maximum par page', aide: `Au-delà, une alerte s’affiche dans Design. Tes carrousels actuels montent à 90 mots. Réglage : ${r.motsMax}.` }, h('input', { type: 'range', min: 30, max: 120, step: 5, value: r.motsMax, onChange: (e) => regler('motsMax')(Number(e.target.value)), 'aria-label': 'Mots maximum par page' })),
        h(Ligne, { etiquette: 'Logo sur chaque page', aide: 'Un petit logo en bas à droite de toutes les pages. La dernière garde son logo de fin.' }, interrupteur('logoPartout', 'Logo sur chaque page')),
        h(Ligne, { etiquette: 'Numéro de page', aide: 'Affiche « 2 / 6 » en bas à gauche.' }, interrupteur('numero', 'Numéro de page')),
        h(Ligne, { etiquette: 'Indicateur « glisser »', aide: 'Une petite flèche à droite invite à passer à la page suivante.' }, interrupteur('glisser', 'Indicateur glisser'))),
      h(Carte, { titre: 'Par défaut pour un nouvel article' },
        h(Ligne, { etiquette: 'Réseau', aide: 'Présélectionné à la création.' }, h(Segmente, { valeur: r.reseauDefaut, onChange: regler('reseauDefaut'), options: [{ valeur: 'instagram', libelle: 'Instagram' }, { valeur: 'linkedin', libelle: 'LinkedIn' }] })),
        h(Ligne, { etiquette: 'Dimensions', aide: 'Présélectionnées à la création.' }, h(Segmente, { valeur: r.formatDefaut, onChange: regler('formatDefaut'), options: [{ valeur: 'carre', libelle: '1:1' }, { valeur: 'portrait', libelle: '4:5' }] }))),
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
          h('li', null, 'Personal access tokens, puis Fine-grained tokens, puis « Generate new token ». Nom : Oh!Post. Choisis la durée la plus longue proposée.'),
          h('li', null, 'Dans « Repository access », choisis « Only select repositories », puis postsop-donnees.'),
          h('li', null, 'Dans « Permissions », trouve « Contents » et choisis « Read and write ».'),
          h('li', null, 'Touche « Generate token », copie la clé (elle ne s’affiche qu’une fois) et colle-la ci-dessus.')),
        h('p', { className: 'doux petit' }, 'Ne colle jamais cette clé dans une conversation ni dans ton dépôt public. Si elle fuit, supprime-la sur GitHub et crées-en une autre.')));
  }

  // Fournisseur d'IA : Anthropic par défaut, Mistral en option. Tout reste sur cet appareil (voir ia.js).
  const GUIDES_IA = {
    claude: [
      ['Sur ', h('strong', null, 'platform.claude.com'), ', crée un compte au nom de l’entreprise.'],
      ['Dans le tableau de bord, touche « Ajouter des fonds ». Laisse le rechargement automatique désactivé : la dépense ne pourra jamais dépasser les crédits achetés.'],
      ['Ouvre « Clés API », touche « Créer une clé », puis « Continuer avec une clé API ».'],
      ['Nom : ', h('strong', null, 'Oh!Post'), '. Expiration : 90 jours, ou la durée proposée la plus proche. Laisse l’espace de travail par défaut.'],
      ['Touche le bouton de création, copie la clé (elle ne s’affiche qu’une fois) et colle-la ci-dessus.'],
    ],
    mistral: [
      ['Sur ', h('strong', null, 'console.mistral.ai'), ', crée un compte au nom de l’entreprise et choisis une offre payante : avec l’offre gratuite, les textes envoyés peuvent servir à entraîner leurs modèles.'],
      ['Ouvre la page des clés d’API et crée une clé nommée ', h('strong', null, 'Oh!Post'), '.'],
      ['Copie la clé (elle ne s’affiche en général qu’une fois) et colle-la ci-dessus.'],
    ],
  };

  const EXEMPLE_PROFIL = 'Oh ! Potentiel : Anne Litique, coach en accompagnement individuel et collectif, médiatrice des conflits au travail et formatrice, en Nouvelle-Aquitaine.\nPublic : dirigeants, managers, équipes, surtout sur LinkedIn.\nValeurs : authenticité, développement, performance.\nTon : chaleureux, humain et structuré, à la première personne. Des histoires vraies d’accompagnement, avec les paroles des personnes entre guillemets et une leçon à la fin. Pas de jargon ni de promesses exagérées.';
  function ProfilEditorial({ etat, dispatch }) {
    const valeur = (etat.projet && etat.projet.profilEditorial) || '';
    const changer = (t) => dispatch({ type: 'projet', maj: (pr) => ({ ...pr, profilEditorial: t }) });
    return h(Carte, { titre: 'Ton profil éditorial', info: 'Ton public, ton ton, tes valeurs. CCB s’en sert partout où il travaille sur ton texte : relecture, autres formulations, discussion et descriptions de publication. Il y puise le ton et le public visé, jamais des faits à ajouter. Enregistré avec ta charte, donc sur tous tes appareils.' },
      h('textarea', { className: 'zone-texte', rows: 6, value: valeur, placeholder: 'Qui tu es, pour qui tu écris, le ton que tu veux garder…', 'aria-label': 'Ton profil éditorial', onChange: (e) => changer(e.target.value) }),
      !valeur && h(Bouton, { variante: 'lien', onClick: () => changer(EXEMPLE_PROFIL) }, 'Partir d’une proposition, à vérifier et compléter'));
  }

  function OngletIA(props) {
    if (IA.absent) return h('p', { className: 'erreur' }, 'Le fichier ia.js manque sur GitHub : renvoie-le pour retrouver les réglages de l’IA.');
    return h(OngletIAComplet, props);
  }
  // Configuration › IA : la voix de CCB (celles de l'appareil), sa vitesse, sa hauteur, son volume ; un exemple à écouter.
  function CarteVoix() {
    const nomIA = IA.ASSISTANT.nom;
    const [r, setR] = useState(lireReglagesVoix);
    const [liste, setListe] = useState(voixDeLAppareil);
    useEffect(() => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
      // Les voix arrivent parfois un instant après l'ouverture de la page.
      const maj = () => setListe(voixDeLAppareil());
      window.speechSynthesis.addEventListener ? window.speechSynthesis.addEventListener('voiceschanged', maj) : (window.speechSynthesis.onvoiceschanged = maj);
      const t = setTimeout(maj, 600);
      return () => { clearTimeout(t); if (window.speechSynthesis.removeEventListener) window.speechSynthesis.removeEventListener('voiceschanged', maj); };
    }, []);
    const changer = (champ, valeur) => { const n = { ...r, [champ]: valeur }; setR(n); ecrireReglagesVoix(n); };
    const parDefaut = voixFrancaise();
    const qualite = (v) => (/premium/i.test(v.name) ? ' · premium' : /enhanced|améliorée/i.test(v.name) ? ' · améliorée' : '');
    const exemple = `Bonjour, je suis ${nomIA}. Je t’aide à relire ton article et à mettre en valeur ce qui compte.`;
    if (typeof window === 'undefined' || !window.speechSynthesis) return h(Carte, { titre: 'Voix de ' + nomIA }, h('p', { className: 'doux' }, 'Ce navigateur ne sait pas lire à voix haute. Sur iPad, utilise Safari.'));
    return h(Carte, { titre: 'Voix de ' + nomIA, sousTitre: 'Pour la conversation à voix haute. Réglée pour cet appareil : chaque iPad a ses propres voix.' },
      h(Ligne, { etiquette: 'Voix', aide: liste.length ? `${liste.length} voix française${liste.length > 1 ? 's' : ''} sur cet appareil.` : 'Aucune voix française trouvée pour l’instant.' },
        h('select', { className: 'champ-texte', value: r.nom, 'aria-label': 'Voix de ' + nomIA, onChange: (e) => changer('nom', e.target.value) },
          h('option', { value: '' }, 'Automatique' + (parDefaut ? ' (' + parDefaut.name + ')' : '')),
          liste.map((v) => h('option', { key: v.name + v.lang, value: v.name }, `${v.name} · ${v.lang}${qualite(v)}`)))),
      h(Ligne, { etiquette: 'Vitesse', aide: r.vitesse < 0.95 ? 'Plus lente' : r.vitesse > 1.05 ? 'Plus rapide' : 'Normale' },
        h('input', { type: 'range', min: 0.7, max: 1.4, step: 0.05, value: r.vitesse, 'aria-label': 'Vitesse de la voix', onChange: (e) => changer('vitesse', Number(e.target.value)) })),
      h(Ligne, { etiquette: 'Hauteur', aide: r.hauteur < 0.95 ? 'Plus grave' : r.hauteur > 1.05 ? 'Plus aiguë' : 'Naturelle' },
        h('input', { type: 'range', min: 0.7, max: 1.4, step: 0.05, value: r.hauteur, 'aria-label': 'Hauteur de la voix', onChange: (e) => changer('hauteur', Number(e.target.value)) })),
      h(Ligne, { etiquette: 'Volume', aide: Math.round(r.volume * 100) + ' %' },
        h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: r.volume, 'aria-label': 'Volume de la voix', onChange: (e) => changer('volume', Number(e.target.value)) })),
      h('div', { className: 'actions-ligne' },
        h(Bouton, { variante: 'principal', onClick: () => direAvecLaVoix(exemple) }, 'Écouter un exemple'),
        h(Bouton, { variante: 'lien', onClick: () => { setR({ ...REGLAGES_VOIX }); ecrireReglagesVoix({ ...REGLAGES_VOIX }); } }, 'Revenir aux réglages d’origine')),
      h('p', { className: 'doux petit' }, 'Pour des voix plus naturelles, télécharge une voix française « améliorée » ou « premium » dans les réglages de l’iPad (Accessibilité › Contenu énoncé › Voix, selon la version) ; elle apparaîtra ici.'));
  }

  function OngletIAComplet({ etat, dispatch }) {
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
      etat && h(ProfilEditorial, { etat, dispatch }),
      h(CarteVoix),
      h(Carte, { titre: 'État' },
        h('p', null, actif
          ? h(Fragment, null, h(Pastille, { ton: 'ok' }, `${IA.FOURNISSEURS[actif.fournisseur].nom} actif`))
          : h(Fragment, null, h(Pastille, { ton: 'attention' }, 'Aucune IA active'), ' ', h('span', { className: 'doux petit' }, 'L’app fonctionne normalement sans IA.')))),
      h(Carte, { titre: 'Fournisseur d’IA', info: 'Les coûts sont prélevés sur le compte que tu ouvres chez le fournisseur, jamais par Oh!Post. Tes textes ne lui sont envoyés que lorsque tu demandes une proposition.' },
        h(Ligne, { etiquette: 'Fournisseur', aide: fournisseur === 'claude' ? 'Par défaut. Société américaine Anthropic.' : 'Société française ; données hébergées en Europe.' },
          h(Segmente, { etiquette: 'Fournisseur', valeur: fournisseur, onChange: choisir, options: [{ valeur: 'claude', libelle: 'Anthropic' }, { valeur: 'mistral', libelle: 'Mistral' }] })),
        h(Ligne, { etiquette: 'Clé d’API', aide: aideCle },
          h('input', { className: 'champ-texte', type: 'password', value: cle, autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setCle(e.target.value), 'aria-label': 'Clé d’API ' + f.nom })),
        douteuse && h('p', { className: 'erreur petit' }, `Cette clé ne commence pas par « ${f.prefixe} » : vérifie qu’il s’agit bien d’une clé ${f.nom}.`),
        h('details', { className: 'options-avancees' }, h('summary', null, 'Options avancées'),
          h(Ligne, { etiquette: 'Modèle', aide: 'À ne changer que si le fournisseur retire ce modèle.' },
          h('input', { className: 'champ-texte', value: modele, autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, onChange: (e) => setModele(e.target.value), 'aria-label': 'Modèle ' + f.nom }))),
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
        FICHIERS_A_RENVOYER.length > 0 && h('div', { className: 'alerte-mise-a-jour', role: 'alert' },
          h('strong', null, 'Mise à jour incomplète. '),
          `Renvoie sur GitHub ${FICHIERS_A_RENVOYER.length > 1 ? 'ces fichiers' : 'ce fichier'} de la dernière livraison : ${FICHIERS_A_RENVOYER.join(', ')}. Sans ${FICHIERS_A_RENVOYER.length > 1 ? 'eux' : 'lui'}, certaines fonctions ne marchent pas.`),
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
