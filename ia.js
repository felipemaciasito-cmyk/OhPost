/*
 * PostsOP — connexion à l'IA (Anthropic par défaut, Mistral en option ; décision du 18 octobre 2026). Dans l'app, l'assistant s'appelle CCB (Creative Collaborative Boost) : le nom des modèles n'apparaît jamais.
 *
 * Un seul point d'entrée pour toute l'app : demander(config, { systeme, texte }) renvoie la réponse en texte.
 * Changer de fournisseur ne touche rien d'autre.
 *
 * La configuration (fournisseur, clés, modèles) reste sur l'appareil, dans le navigateur :
 * elle n'est jamais envoyée dans le dépôt de données. Comme pour la clé GitHub, on la saisit sur chaque appareil.
 * Les appels partent directement du navigateur vers le fournisseur : il n'y a pas de serveur PostsOP.
 */
(function (racine) {
  'use strict';

  const CLE_STOCKAGE = 'postsop-ia';
  const MARGE_REFLEXION = 6000; // jetons ajoutés pour la réflexion des modèles de la génération 5 (facturés seulement s'ils servent)

  const FOURNISSEURS = {
    claude: {
      nom: 'Anthropic',
      societe: 'Anthropic',
      modele: 'claude-sonnet-5-5',
      prefixe: 'sk-ant-',
      adresse: 'https://api.anthropic.com/v1/messages',
      console: 'console.anthropic.com',
    },
    mistral: {
      nom: 'Mistral',
      societe: 'Mistral AI',
      modele: 'mistral-large-latest',
      prefixe: '',
      adresse: 'https://api.mistral.ai/v1/chat/completions',
      console: 'console.mistral.ai',
    },
  };

  /* ---------- Configuration sur cet appareil ---------- */

  function lire() {
    let brut = null;
    try { brut = JSON.parse(racine.localStorage.getItem(CLE_STOCKAGE)); } catch (e) { brut = null; }
    const c = brut && typeof brut === 'object' ? brut : {};
    return {
      fournisseur: FOURNISSEURS[c.fournisseur] ? c.fournisseur : 'claude',
      cles: { ...(c.cles || {}) },
      modeles: { ...(c.modeles || {}) },
    };
  }

  function enregistrer(config) {
    racine.localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ fournisseur: config.fournisseur, cles: config.cles || {}, modeles: config.modeles || {} }));
  }

  function oublierCle(fournisseur) {
    const c = lire();
    delete c.cles[fournisseur];
    enregistrer(c);
    return c;
  }

  const modeleDe = (config, fournisseur) => (config.modeles && config.modeles[fournisseur]) || FOURNISSEURS[fournisseur].modele;

  // La configuration prête à l'emploi pour le fournisseur choisi, ou null s'il manque la clé.
  function active(config = lire()) {
    const f = config.fournisseur;
    const cle = config.cles[f];
    return cle ? { fournisseur: f, cle, modele: modeleDe(config, f) } : null;
  }

  /* ---------- Appel ---------- */

  // json (facultatif) : { nom, description, schema } — la réponse doit être un objet de cette forme.
  // Anthropic : on impose un « outil » dont les paramètres suivent le schéma, ce qui garantit un JSON valide.
  // Mistral : mode JSON.
  function requete(fournisseur, cle, modele, systeme, texte, maxJetons, json) {
    if (fournisseur === 'claude') {
      const entetes = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      if (cle) entetes['x-api-key'] = cle;
      // Modèles de la génération 5 (Sonnet 5.5 par défaut) : ils réfléchissent avant de répondre, et cette réflexion
      // compte dans max_tokens. On laisse de la marge et on demande un effort moyen, adapté à un travail de rédaction.
      const generation5 = /^claude-(sonnet|opus|haiku|fable|mythos)-5(\b|-)/.test(String(modele || ''));
      const corps = { model: modele, max_tokens: maxJetons + (generation5 ? MARGE_REFLEXION : 0), messages: [{ role: 'user', content: texte }] };
      if (generation5) corps.output_config = { effort: 'medium' };
      if (systeme) corps.system = systeme;
      if (json) {
        // Sonnet 5.5 refuse l'outil imposé (tool_choice « tool » ou « any ») : on le propose (« auto ») et la consigne
        // demande de s'en servir. Si le modèle répond quand même en texte, le JSON est lu dans le texte.
        const nomOutil = json.nom || 'repondre';
        corps.tools = [{ name: nomOutil, description: json.description || 'Donne ta réponse.', input_schema: json.schema }];
        corps.tool_choice = { type: 'auto' };
        corps.system = (systeme ? systeme + '\n\n' : '') + `Donne ta réponse en appelant l’outil « ${nomOutil} », une seule fois.`;
      }
      return { adresse: FOURNISSEURS.claude.adresse, entetes, corps };
    }
    const entetes = { 'content-type': 'application/json' };
    if (cle) entetes.authorization = 'Bearer ' + cle;
    const messages = (systeme ? [{ role: 'system', content: systeme }] : []).concat([{ role: 'user', content: texte }]);
    const corps = { model: modele, max_tokens: maxJetons, messages };
    if (json) corps.response_format = { type: 'json_object' };
    return { adresse: FOURNISSEURS.mistral.adresse, entetes, corps };
  }

  function texteReponse(fournisseur, donnees) {
    if (fournisseur === 'claude') {
      const outil = (donnees.content || []).find((b) => b.type === 'tool_use');
      if (outil) return JSON.stringify(outil.input || {});
      return (donnees.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    }
    const choix = donnees.choices && donnees.choices[0];
    const contenu = choix && choix.message ? choix.message.content : '';
    return Array.isArray(contenu) ? contenu.map((b) => b.text || '').join('') : String(contenu || '');
  }

  // Message clair en français, selon la réponse du fournisseur.
  function expliquer(fournisseur, statut, detail) {
    const nom = FOURNISSEURS[fournisseur].nom;
    const d = String(detail || '');
    if (statut === 401) return `Clé refusée par ${nom}. Vérifie qu’elle est complète, qu’elle n’a pas expiré et qu’elle n’a pas été supprimée.`;
    if (statut === 429) return `Trop de demandes à la suite. Réessaie dans une minute.`;
    if (statut === 402 || /credit balance|insufficient|billing|payment/i.test(d)) return `Crédits insuffisants chez ${nom}. Ajoute des fonds sur ${FOURNISSEURS[fournisseur].console}.`;
    if (statut === 403) return `${nom} refuse cette demande avec cette clé (droits insuffisants).`;
    if (statut === 404 || /not_found|not found|does not exist|invalid model|unknown model|model.*(introuvable|inconnu)/i.test(d)) return `Modèle inconnu chez ${nom}. Vérifie le nom du modèle dans les réglages.`;
    if (statut === 400) return `${nom} a refusé la demande${d ? ' : ' + d.slice(0, 220) : '.'} Envoie-moi une capture de ce message.`;
    if (statut === 413) return `Texte trop long pour ${nom}.`;
    if (statut === 529 || statut >= 500) return `${nom} est momentanément surchargé ou indisponible. Réessaie dans quelques instants.`;
    return `${nom} a répondu par une erreur (${statut}).${d ? ' ' + d.slice(0, 200) : ''}`;
  }

  class ErreurIA extends Error {
    constructor(message, genre) { super(message); this.genre = genre; }
  }

  async function appeler(fournisseur, cle, modele, systeme, texte, { maxJetons = 1024, delai = 90000, json = null } = {}) {
    const r = requete(fournisseur, cle, modele, systeme, texte, maxJetons, json);
    const abandon = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const minuterie = abandon ? setTimeout(() => abandon.abort(), delai) : null;
    let reponse;
    try {
      reponse = await fetch(r.adresse, { method: 'POST', headers: r.entetes, body: JSON.stringify(r.corps), signal: abandon ? abandon.signal : undefined });
    } catch (erreur) {
      if (erreur && erreur.name === 'AbortError') throw new ErreurIA(`${FOURNISSEURS[fournisseur].nom} n’a pas répondu à temps. Réessaie.`, 'delai');
      throw new ErreurIA(`Impossible de joindre ${FOURNISSEURS[fournisseur].nom} depuis ce navigateur. Vérifie ta connexion internet ; si elle fonctionne, ce fournisseur refuse peut-être les appels venant d’un navigateur.`, 'reseau');
    } finally {
      if (minuterie) clearTimeout(minuterie);
    }
    let donnees = null;
    try { donnees = await reponse.json(); } catch (e) { donnees = null; }
    if (!reponse.ok) {
      const detail = donnees && (donnees.error ? (donnees.error.message || donnees.error.type || '') : (donnees.message || donnees.detail || ''));
      throw new ErreurIA(expliquer(fournisseur, reponse.status, typeof detail === 'string' ? detail : JSON.stringify(detail)), 'reponse');
    }
    // Réponse coupée faute de place : une réponse structurée serait incomplète, on le dit clairement.
    if (donnees && donnees.stop_reason === 'refusal') throw new ErreurIA(`${FOURNISSEURS[fournisseur].nom} a refusé de traiter ce texte (filtre de sécurité). Reformule le passage en cause ou réessaie.`, 'refus');
    const coupee = donnees && (donnees.stop_reason === 'max_tokens' || (donnees.choices && donnees.choices[0] && donnees.choices[0].finish_reason === 'length'));
    if (json && coupee) throw new ErreurIA(`La réponse de l’IA était trop longue et a été coupée. Choisis un passage plus court ou demande moins de propositions.`, 'longueur');
    return { texte: texteReponse(fournisseur, donnees || {}), donnees };
  }

  // Le point d'entrée des futures fonctions d'IA : renvoie le texte de la réponse.
  async function demander(config, { systeme = '', texte, maxJetons, delai, json = null } = {}) {
    if (!config || !config.cle) throw new ErreurIA('Aucune clé d’IA n’est enregistrée sur cet appareil. Ajoute-la dans Configuration, onglet IA.', 'cle');
    // Qui est CCB et à qui il parle : ajouté à la fin de chaque consigne.
    const consigne = (systeme ? systeme + '\n\n' : '') + identite();
    return (await appeler(config.fournisseur, config.cle, config.modele, consigne, texte, { maxJetons, delai, json })).texte;
  }

  /* ---------- Tests ---------- */

  // Avec une clé : une toute petite demande (une fraction de centime) qui vérifie clé, crédits, modèle et appel direct.
  async function tester(fournisseur, cle, modele) {
    const m = modele || FOURNISSEURS[fournisseur].modele;
    const { texte } = await appeler(fournisseur, cle, m, '', 'Réponds seulement par le mot : OK', { maxJetons: 16, delai: 30000 });
    if (!texte.trim()) throw new ErreurIA(`${FOURNISSEURS[fournisseur].nom} a répondu, mais sans texte. Réessaie ou vérifie le modèle.`, 'reponse');
    return `Connexion réussie : ${FOURNISSEURS[fournisseur].nom} a répondu.`;
  }

  // Sans clé : vérifie seulement que le fournisseur accepte les appels venant de ce navigateur. Gratuit.
  async function joignable(fournisseur) {
    const r = requete(fournisseur, '', FOURNISSEURS[fournisseur].modele, '', 'test', 1);
    try {
      await fetch(r.adresse, { method: 'POST', headers: r.entetes, body: JSON.stringify(r.corps) });
      return true; // une réponse, même un refus faute de clé : l'appel depuis le navigateur passe
    } catch (e) {
      return false;
    }
  }

  const ASSISTANT = { nom: 'CCB', complet: 'Creative Collaborative Boost' }; // le nom de l'assistant dans toute l'app

  /* ---------- Qui est CCB, et à qui il parle ---------- */

  // Le prénom de la personne (Configuration › IA), « Anne » par défaut. Gardé sur l'appareil.
  const CLE_PRENOM = 'postsop-prenom';
  const PRENOM_DEFAUT = 'Anne';
  function prenom() {
    try { const v = racine.localStorage.getItem(CLE_PRENOM); return v === null ? PRENOM_DEFAUT : String(v).trim(); } catch (e) { return PRENOM_DEFAUT; }
  }
  function ecrirePrenom(v) { try { racine.localStorage.setItem(CLE_PRENOM, String(v || '').trim()); } catch (e) { /* stockage indisponible */ } }

  // Ajouté à toutes les consignes envoyées à l'IA : son nom, son ton, le prénom de la personne.
  // Le prénom et les mots d'accueil restent dans la conversation, jamais dans les textes à publier.
  function identite(p = prenom()) {
    return [
      'Qui tu es : tu es CCB (Creative Collaborative Boost), l’assistant d’Oh!Post.',
      p ? `Tu parles à ${p} : quand tu t’adresses directement à ${p} (tes réponses, tes explications, tes commentaires), appelle ${p} par son prénom de temps en temps, tutoie et garde un ton professionnel, bienveillant et chaleureux.`
        : 'Quand tu t’adresses directement à la personne (tes réponses, tes explications, tes commentaires), tutoie et garde un ton professionnel, bienveillant et chaleureux.',
      'Le prénom et ces mots chaleureux ne vont jamais dans les textes que tu écris pour être publiés (article, pages, post, titres, formulations).',
    ].join(' ');
  }

  // L'accueil de CCB en début de conversation : une phrase selon le moment de la journée, écrite à l'avance
  // (aucun appel à l'IA). {p} est le prénom. Les dernières phrases utilisées sont évitées d'une session à l'autre.
  const ACCUEILS = {
    aube: [ // 5 h – 8 h
      'Bonjour {p}, déjà au travail ! Comment puis-je t’aider de si bon matin ?',
      'Bonjour {p} ! Le jour se lève à peine : par quoi commençons-nous ?',
      'Bon début de journée, {p}. Je t’écoute.',
      'Bonjour {p}, la journée commence tôt : que puis-je faire pour toi ?',
      'Bonjour {p} ! Un moment de calme avant la journée : sur quoi veux-tu avancer ?',
      'Bonjour {p}, belle énergie de bon matin ! Comment puis-je t’accompagner ?',
      'Bonjour {p}. Le monde dort encore, nous avons tout le temps de bien faire : je t’écoute.',
      'Bonjour {p} ! Commençons la journée par quelque chose de beau ?',
      'Bonjour {p}, ravi de commencer la journée avec toi. Que puis-je faire ?',
      'Bonjour {p} ! Une idée du réveil à mettre en forme ?',
    ],
    matin: [ // 8 h – 12 h
      'Bonjour {p}, comment puis-je t’aider ce matin ?',
      'Bonjour {p}, ravi de te retrouver ce matin. Sur quoi travaillons-nous ?',
      'Belle matinée, {p} ! Par quoi veux-tu commencer ?',
      'Bonjour {p} ! Qu’allons-nous mettre en valeur ce matin ?',
      'Bonne matinée, {p}. Dis-moi ce dont tu as besoin.',
      'Bonjour {p}, je suis là pour t’accompagner ce matin. Que puis-je faire pour toi ?',
      'Bonjour {p} ! Une idée à travailler ce matin ?',
      'Bonjour {p}, belle journée qui commence : comment puis-je t’aider ?',
      'Bonjour {p} ! Un nouveau carrousel à faire briller ce matin ?',
      'Bonjour {p}, je suis prêt à t’aider à trouver les mots justes ce matin. Je t’écoute.',
      'Bonjour {p} ! Que dirais-tu d’avancer ensemble sur ton texte ce matin ?',
    ],
    midi: [ // 12 h – 14 h
      'Bonjour {p}, comment puis-je t’aider ce midi ?',
      'Bonjour {p} ! Une petite pause créative autour de midi ?',
      'Bonjour {p}, on avance ensemble sur ton carrousel ce midi ?',
      'Bonjour {p}, la mi-journée est un bon moment pour faire le point. Je t’écoute.',
      'Bonjour {p} ! Je suis là si tu as besoin d’un coup de main ce midi.',
      'Bonjour {p}, que puis-je faire pour toi avant de reprendre l’après-midi ?',
      'Bon midi, {p} ! Sur quoi veux-tu avancer ?',
      'Bonjour {p} ! Une idée attrapée à la pause de midi ?',
      'Bonjour {p}, ravi de te retrouver à la mi-journée. Dis-moi tout.',
    ],
    apresmidi: [ // 14 h – 18 h
      'Bon après-midi, {p} ! Comment puis-je t’aider ?',
      'Bonjour {p}, que veux-tu travailler cet après-midi ?',
      'Bon après-midi, {p}. Sur quel texte avançons-nous ensemble ?',
      'Bonjour {p} ! Un nouveau carrousel à faire briller cet après-midi ?',
      'Ravi de te retrouver cet après-midi, {p}. Dis-moi tout.',
      'Bon après-midi, {p} ! Je suis là pour t’aider à trouver les bons mots.',
      'Bonjour {p}, un coup de pouce pour cet après-midi ?',
      'Bon après-midi, {p}. Qu’allons-nous mettre en lumière aujourd’hui ?',
      'Bonjour {p} ! Prenons le temps de bien faire cet après-midi : je t’écoute.',
      'Bon après-midi, {p} ! Par quoi veux-tu continuer ?',
      'Bonjour {p}, l’après-midi est à toi : comment puis-je t’accompagner ?',
    ],
    soir: [ // 18 h – 22 h
      'Bonsoir {p}, comment puis-je t’aider ce soir ?',
      'Bonsoir {p} ! On termine la journée en beauté ?',
      'Bonsoir {p}. Prenons le temps de bien faire : que veux-tu travailler ?',
      'Bonsoir {p} ! Une dernière idée à mettre en forme aujourd’hui ?',
      'Bonne soirée, {p}. Je suis là si tu as besoin de moi.',
      'Bonsoir {p}, ravi de t’accompagner ce soir. Par quoi commençons-nous ?',
      'Bonsoir {p} ! Que puis-je faire pour toi ce soir ?',
      'Bonsoir {p}, une touche finale à apporter à ton carrousel ?',
      'Bonsoir {p}. Le calme du soir est idéal pour écrire : je t’écoute.',
      'Bonsoir {p} ! Sur quoi veux-tu avancer avant de clore la journée ?',
    ],
    nuit: [ // 22 h – 5 h
      'Bonsoir {p}, tu travailles tard ! Comment puis-je t’aider ?',
      'Bonsoir {p}. Il se fait tard : allons droit à l’essentiel, je t’écoute.',
      'Bonsoir {p} ! Une idée qui ne pouvait pas attendre demain ?',
      'Bonsoir {p}, je suis là, même à cette heure-ci. Que puis-je faire pour toi ?',
      'Bonsoir {p}. Avançons ensemble, puis pense à te reposer !',
      'Bonsoir {p} ! L’inspiration de la nuit, c’est précieux : dis-moi tout.',
      'Bonsoir {p}, encore à l’ouvrage ? Je t’accompagne volontiers.',
      'Bonsoir {p}. Que puis-je faire pour toi avant une bonne nuit ?',
    ],
  };
  const momentDe = (heure) => (heure >= 5 && heure < 8 ? 'aube' : heure < 12 && heure >= 8 ? 'matin' : heure >= 12 && heure < 14 ? 'midi' : heure >= 14 && heure < 18 ? 'apresmidi' : heure >= 18 && heure < 22 ? 'soir' : 'nuit');
  // Typographie française : espace insécable avant ? ! : ;
  const insecables = (t) => t.replace(/ ([?!:;])/g, '\u00a0$1');
  function phraseAccueil(modele, p) {
    const t = p ? modele.replace(/\{p\}/g, p) : modele.replace(/,? \{p\}/g, '').replace(/^\{p\},? /, '');
    return insecables(t.charAt(0).toUpperCase() + t.slice(1));
  }
  const CLE_ACCUEILS = 'postsop-accueils'; // les dernières phrases utilisées, pour varier d'une session à l'autre
  const RETENUES = 12;
  function accueil(date = new Date(), p = prenom(), hasard = Math.random) {
    const moment = momentDe(date.getHours());
    const liste = ACCUEILS[moment];
    let vues = [];
    try { vues = JSON.parse(racine.localStorage.getItem(CLE_ACCUEILS)) || []; } catch (e) { vues = []; }
    if (!Array.isArray(vues)) vues = [];
    let libres = liste.map((_, k) => k).filter((k) => !vues.includes(moment + k));
    if (!libres.length) libres = liste.map((_, k) => k);
    const k = libres[Math.floor(hasard() * libres.length) % libres.length];
    try { racine.localStorage.setItem(CLE_ACCUEILS, JSON.stringify([moment + k].concat(vues.filter((v) => v !== moment + k)).slice(0, RETENUES))); } catch (e) { /* stockage indisponible */ }
    return phraseAccueil(liste[k], p);
  }

  const api = { MARGE_REFLEXION, ASSISTANT, FOURNISSEURS, lire, enregistrer, oublierCle, modeleDe, active, demander, tester, joignable, ErreurIA, expliquer, texteReponse, requete, prenom, ecrirePrenom, PRENOM_DEFAUT, identite, ACCUEILS, momentDe, phraseAccueil, accueil };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPIA = api;
})(typeof window !== 'undefined' ? window : globalThis);
