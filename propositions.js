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
    '3. Adapte le découpage au volume : peu de texte par slide (environ 25 à 45 mots), sans dépasser 10 slides si possible.',
    '4. Tiens compte du sujet et du ton : une parole rapportée entre guillemets va bien en style citation ; une phrase forte, en style emphase.',
    '5. Les propositions doivent être vraiment différentes (rythme, nombre de slides, gabarits, fond), chacune avec un nom court et une phrase « pourquoi ».',
    '6. N’utilise que les codes du catalogue.',
    '',
    'Réponds uniquement avec un objet JSON, sans aucun texte autour :',
    '{"reponse":"une phrase","propositions":[{"nom":"…","pourquoi":"…","fond":"code","slides":[{"gabarit":"V1","paragraphes":[0],"styles":["titre"]}]}]}',
    'Dans chaque slide, « styles » donne le style de chaque paragraphe listé, dans le même ordre.',
  ].join('\n');

  const paragraphesNumerotes = (paragraphes) => paragraphes.map((p, i) => `[${i}] ${p}`).join('\n');

  function messageGeneration({ paragraphes, catalogueTexte, format, reseau, favoris, nombre = MAX_PROPOSITIONS }) {
    return [
      catalogueTexte, '',
      `Format : ${format}. Réseau : ${reseau}.`,
      favoris && favoris.length ? 'La personne aime ces présentations (gabarit et styles), inspire-t’en : ' + favoris.map((f) => `${f.gabarit} [${f.styles.join(', ')}]`).join(' ; ') + '.' : '',
      '', 'Paragraphes de l’article :', paragraphesNumerotes(paragraphes), '',
      `Propose ${nombre} mises en page différentes.`,
    ].filter((l) => l !== null).join('\n');
  }

  function messageEvolution({ paragraphes, catalogueTexte, plan, historique, demande }) {
    const fil = (historique || []).slice(-10).map((m) => (m.de === 'moi' ? 'Personne : ' : 'Toi : ') + m.texte).join('\n');
    return [
      catalogueTexte, '', 'Paragraphes de l’article :', paragraphesNumerotes(paragraphes), '',
      'Mise en page actuelle :', JSON.stringify({ nom: plan.nom, fond: plan.fond, slides: plan.slides }), '',
      fil ? 'Début de la conversation :\n' + fil + '\n' : '',
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

  // Les slides que le moteur dessinera, à partir d'un plan vérifié.
  function construireSlides(plan, paragraphes) {
    const slides = plan.slides.map((s, i) => ({
      role: i === 0 ? 'Couverture' : 'Texte',
      gabarit: s.gabarit,
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

  const api = { JSON_PLANS, recetteDe, adapterRecette, MAX_PROPOSITIONS, SYSTEME, catalogue, messageGeneration, messageEvolution, lireReponse, verifierPlan, construireSlides };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPPropositions = api;
})(typeof window !== 'undefined' ? window : globalThis);
