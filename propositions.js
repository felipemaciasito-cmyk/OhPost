/*
 * PostsOP — propositions de mise en page par l'IA (étape 2 de l'espace de mise en page, 20 octobre 2026)
 *
 * Principe : l'IA choisit, le moteur dessine. L'IA propose des plans (découpage en slides, gabarit et
 * styles de chaque paragraphe, fond) en ne choisissant que dans le catalogue de la charte ; PostsOP construit
 * les slides avec son moteur et vérifie chaque plan. Le texte de l'article ne change jamais : chaque plan
 * doit reprendre tous les paragraphes, dans l'ordre, une seule fois, sinon il est écarté.
 */
(function (racine) {
  'use strict';

  const MAX_PROPOSITIONS = 3;

  function catalogue(gabarits, fonds, natures) {
    const lignes = ['Gabarits (code : nom, famille, usage) :'];
    Object.entries(gabarits).forEach(([code, g]) => lignes.push(`- ${code} : ${g.nom}, ${g.famille}. ${g.aide || ''}`));
    lignes.push('', 'Fonds possibles (un seul pour tout le carrousel) : ' + Object.entries(fonds).map(([c, f]) => `${c} (${f.nom})`).join(', ') + '.');
    lignes.push('', 'Styles de paragraphe : ' + Object.entries(natures).map(([c, n]) => `${c} (${n.nom})`).join(', ') + '.');
    return lignes.join('\n');
  }

  const SYSTEME = [
    'Tu es directeur artistique pour des carrousels LinkedIn et Instagram. Tu proposes des mises en page en choisissant uniquement dans le catalogue fourni ; le moteur de l’application dessine les slides.',
    '',
    'Règles impératives :',
    '1. Le texte ne change jamais : chaque proposition reprend TOUS les paragraphes, dans l’ordre, chacun une seule fois. Une slide regroupe des paragraphes consécutifs (leurs numéros).',
    '2. La première slide utilise un gabarit de la famille Couverture et contient au moins le premier paragraphe, en style titre. La dernière slide peut utiliser F1 (fin).',
    '3. Nombre de slides : respecte strictement le maximum demandé dans le message ; sans maximum, au plus 12. Regroupe les paragraphes qui vont ensemble pour y arriver.',
    '4. Tiens compte du sujet et du ton : une parole rapportée entre guillemets va bien en style citation ; une phrase forte, en style emphase.',
    '5. Les propositions doivent être vraiment différentes (rythme, nombre de slides, gabarits, fond), chacune avec un nom court et une phrase « pourquoi ».',
    '6. N’utilise que les codes du catalogue.',
    '7. Esthétique avant tout : une couverture forte ; un rythme varié (alterne les gabarits, jamais deux slides de suite identiques) ; des accents de couleur dosés (bandeau, surligneur, encadré, citation en couleur de mise en valeur), jamais sur toutes les slides ; un fond qui sert le ton du texte. Aucune slide presque vide, aucune slide chargée : le texte occupe la page avec de l’air autour.',
    '8. Lecture agréable : une idée par slide, un découpage qui suit le sens (ne sépare jamais une phrase de ce qu’elle introduit ou conclut, une parole rapportée de son introduction), des slides au volume régulier, une progression qui donne envie de passer à la suivante.',
    '',
    'Réponds uniquement avec un objet JSON, sans aucun texte autour :',
    '{"reponse":"une phrase","propositions":[{"nom":"…","pourquoi":"…","fond":"code","slides":[{"gabarit":"V1","paragraphes":[0],"styles":["titre"]}]}]}',
    'Dans chaque slide, « styles » donne le style de chaque paragraphe listé, dans le même ordre.',
    'Dans les textes destinés à la personne (« reponse », « pourquoi »), dis « page » et jamais « slide » : c’est le mot employé dans son outil.',
  ].join('\n');

  const paragraphesNumerotes = (paragraphes) => paragraphes.map((p, i) => `[${i}] ${p}`).join('\n');

  // Ce que le carrousel doit faire sur chaque réseau : la mise en page sert cette fonction (le texte, lui, ne change pas).
  const FONCTION_RESEAU = {
    LinkedIn: 'Sur LinkedIn, le carrousel est un document qu’on feuillette depuis le fil : la couverture doit donner envie de l’ouvrir (une promesse ou une tension claire), chaque slide porte une seule idée, la dernière conclut et invite à réagir si le texte le permet.',
    Instagram: 'Sur Instagram, la couverture doit arrêter le défilement en une seconde : peu de mots, très lisibles ; chaque slide se lit d’un coup d’œil ; la dernière conclut et invite à réagir si le texte le permet.',
    'LinkedIn et Instagram': 'Le carrousel sera publié sur LinkedIn (un document qu’on feuillette) et sur Instagram (des images qui défilent) : une couverture qui donne envie d’ouvrir et arrête le défilement, peu de mots par slide, une seule idée par slide, la dernière conclut et invite à réagir si le texte le permet.',
  };

  // Pages au plus pour la création d'un article : 6, ou 7 quand le texte est long (au-delà d'environ 60 mots par page).
  const SEUIL_TEXTE_LONG = 320;
  const maxPagesPour = (paragraphes) => (paragraphes.join(' ').split(/\s+/).filter(Boolean).length > SEUIL_TEXTE_LONG ? 7 : 6);
  const ligneMax = (maxPages) => (maxPages ? `Nombre de slides : ${maxPages} au plus, couverture et fin comprises. C’est impératif.` : '');
  const ligneIndications = (indications) => (indications && indications.length ? 'Indications de la personne, à suivre en priorité tant qu’elles respectent les règles : ' + indications.join(' / ') : '');

  function messageGeneration({ paragraphes, catalogueTexte, format, reseau, favoris, nombre = MAX_PROPOSITIONS, eviter, maxPages, indications }) {
    return [
      catalogueTexte, '',
      `Format : ${format}. Réseau : ${reseau}.`,
      ligneMax(maxPages),
      ligneIndications(indications),
      FONCTION_RESEAU[reseau] || '',
      eviter && eviter.length ? 'Propose des mises en page vraiment différentes de celles déjà vues : ' + eviter.join(', ') + '.' : '',
      favoris && favoris.length ? 'La personne aime ces présentations (gabarit et styles), inspire-t’en : ' + favoris.map((f) => `${f.gabarit} [${f.styles.join(', ')}]`).join(' ; ') + '.' : '',
      '', 'Paragraphes de l’article :', paragraphesNumerotes(paragraphes), '',
      `Propose ${nombre} mises en page différentes.`,
    ].filter((l) => l !== null).join('\n');
  }

  function messageEvolution({ paragraphes, catalogueTexte, plan, historique, demande, maxPages }) {
    const fil = (historique || []).slice(-10).map((m) => (m.de === 'moi' ? 'Personne : ' : 'Toi : ') + m.texte).join('\n');
    return [
      catalogueTexte, '', 'Paragraphes de l’article :', paragraphesNumerotes(paragraphes), '',
      'Mise en page actuelle :', JSON.stringify({ nom: plan.nom, fond: plan.fond, slides: plan.slides }), '',
      fil ? 'Début de la conversation :\n' + fil + '\n' : '',
      ligneMax(maxPages),
      'Demande de la personne : ' + demande,
      'Réponds avec UNE seule proposition (la mise en page modifiée), dans le même format JSON.',
    ].join('\n');
  }

  // Le premier objet JSON valide qui contient des propositions, même si l'IA ajoute du texte autour ou se répète.
  function lireJSON(brut) {
    const R = (typeof racine.PostsOPRelecture !== 'undefined' && racine.PostsOPRelecture) || (typeof require === 'function' ? require('./relecture.js') : null);
    return R ? R.premierObjet(brut, (o) => Array.isArray(o.propositions)) : null;
  }

  // Vérifie et corrige un plan ; renvoie null s'il ne reprend pas tout le texte, dans l'ordre.
  function verifierPlan(plan, n, gabarits, fonds, natures) {
    if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) return null;
    const ordre = [];
    const slides = [];
    for (const s of plan.slides) {
      const paras = Array.isArray(s.paragraphes) ? s.paragraphes.map(Number) : [];
      if (!paras.length) continue;
      ordre.push(...paras);
      const styles = paras.map((_, k) => (Array.isArray(s.styles) && natures[s.styles[k]] ? s.styles[k] : null));
      slides.push({ gabarit: gabarits[s.gabarit] ? s.gabarit : null, paragraphes: paras, styles });
    }
    if (ordre.length !== n || ordre.some((v, i) => v !== i)) return null;
    slides.forEach((s, i) => {
      const famille = s.gabarit ? gabarits[s.gabarit].famille : null;
      if (i === 0 && famille !== 'Couverture') s.gabarit = 'V1';
      else if (i > 0 && (!s.gabarit || famille === 'Couverture')) s.gabarit = 'T1';
      if (i === 0 && !s.styles[0]) s.styles[0] = 'titre';
    });
    const codesFonds = Object.keys(fonds);
    return {
      nom: String(plan.nom || 'Proposition').slice(0, 40),
      pourquoi: String(plan.pourquoi || '').slice(0, 300),
      fond: codesFonds.includes(plan.fond) ? plan.fond : codesFonds[0],
      slides,
    };
  }

  function lireReponse(brut, n, gabarits, fonds, natures) {
    const donnees = lireJSON(brut);
    if (!donnees) throw new Error('La réponse de l’IA est illisible. Réessaie.');
    const brutes = Array.isArray(donnees.propositions) ? donnees.propositions : [];
    const plans = brutes.map((p) => verifierPlan(p, n, gabarits, fonds, natures)).filter(Boolean);
    return { reponse: typeof donnees.reponse === 'string' ? donnees.reponse.trim() : '', plans, ecartes: brutes.length - plans.length };
  }

  // Une proposition est gardée si aucune page ne déborde et si aucune page de plusieurs paragraphes n'est trop chargée.
  // deborde(slide, index, total) : réponse du moteur pour cette page.
  const MOTS_MAX_PAGE = 80;
  function aere(plan, paragraphes, deborde, maxPages) {
    const slides = construireSlides(plan, paragraphes);
    if (maxPages && slides.length > maxPages) return false;
    return slides.every((sl, i) => {
      const mots = sl.blocs.map((b) => b.texte).join(' ').split(/\s+/).filter(Boolean).length;
      if (sl.blocs.length > 1 && mots > MOTS_MAX_PAGE) return false;
      return !deborde(sl, i, slides.length);
    });
  }

  // Les slides que le moteur dessinera, à partir d'un plan vérifié.
  function construireSlides(plan, paragraphes) {
    const slides = plan.slides.map((s, i) => ({
      role: i === 0 ? 'Couverture' : 'Texte',
      gabarit: s.gabarit,
      ...(s.echelle ? { echelle: s.echelle } : {}), // réduction posée par la réparation d'une page qui débordait
      blocs: s.paragraphes.map((k, j) => ({ style: s.styles[j] || (i === 0 && j === 0 ? 'titre' : /^«/.test(paragraphes[k].trim()) ? 'citation' : 'corps'), texte: paragraphes[k] })),
    }));
    slides[slides.length - 1].signature = true;
    return slides;
  }

  /* ---------- Carrousels gardés en favori : une recette, adaptée au volume d'un autre texte ---------- */
  const recetteDe = (plan) => ({ fond: plan.fond, slides: plan.slides.map((s) => ({ gabarit: s.gabarit, styles: s.styles, n: s.paragraphes.length })) });
  function adapterRecette(recette, n, nom, gabarits, fonds, natures) {
    const milieu = recette.slides.slice(1).filter((s) => s.gabarit !== 'F1');
    const parSlide = Math.max(1, Math.round(milieu.reduce((t, s) => t + s.n, 0) / Math.max(1, milieu.length)) || 1);
    const finF1 = recette.slides.length > 1 && recette.slides[recette.slides.length - 1].gabarit === 'F1';
    const slides = [{ gabarit: recette.slides[0].gabarit, paragraphes: [0], styles: ['titre'] }];
    let k = 1;
    let m = 0;
    while (k < n) {
      const paras = [];
      for (let j = 0; j < parSlide && k < n; j++) paras.push(k++);
      const modele = milieu.length ? milieu[m++ % milieu.length] : { gabarit: 'T1', styles: [] };
      slides.push({ gabarit: modele.gabarit, paragraphes: paras, styles: paras.map((_, j) => (modele.styles || [])[j] || null) });
    }
    if (finF1 && slides.length > 1) slides[slides.length - 1].gabarit = 'F1';
    return verifierPlan({ nom, pourquoi: 'Un carrousel que tu as gardé, adapté au volume de ce texte.', fond: recette.fond, slides }, n, gabarits, fonds, natures);
  }

  const JSON_PLANS = { nom: 'mises_en_page', description: 'Les mises en page proposées.', schema: { type: 'object', properties: { reponse: { type: 'string' }, propositions: { type: 'array', items: { type: 'object', properties: { nom: { type: 'string' }, pourquoi: { type: 'string' }, fond: { type: 'string' }, slides: { type: 'array', items: { type: 'object', properties: { gabarit: { type: 'string' }, paragraphes: { type: 'array', items: { type: 'integer' } }, styles: { type: 'array', items: { type: 'string' } } }, required: ['gabarit', 'paragraphes'] } } }, required: ['nom', 'fond', 'slides'] } } }, required: ['propositions'] } };

  const api = { aere, MOTS_MAX_PAGE, maxPagesPour, SEUIL_TEXTE_LONG, FONCTION_RESEAU, JSON_PLANS, recetteDe, adapterRecette, MAX_PROPOSITIONS, SYSTEME, catalogue, messageGeneration, messageEvolution, lireReponse, verifierPlan, construireSlides };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPPropositions = api;
})(typeof window !== 'undefined' ? window : globalThis);
