/*
 * PostsOP — connexion à l'IA (Claude par défaut, Mistral en option ; décision du 18 octobre 2026)
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

  const FOURNISSEURS = {
    claude: {
      nom: 'Claude',
      societe: 'Anthropic',
      modele: 'claude-sonnet-5-5',
      prefixe: 'sk-ant-',
      adresse: 'https://api.anthropic.com/v1/messages',
      console: 'platform.claude.com',
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

  function requete(fournisseur, cle, modele, systeme, texte, maxJetons) {
    if (fournisseur === 'claude') {
      const entetes = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      if (cle) entetes['x-api-key'] = cle;
      const corps = { model: modele, max_tokens: maxJetons, messages: [{ role: 'user', content: texte }] };
      if (systeme) corps.system = systeme;
      return { adresse: FOURNISSEURS.claude.adresse, entetes, corps };
    }
    const entetes = { 'content-type': 'application/json' };
    if (cle) entetes.authorization = 'Bearer ' + cle;
    const messages = (systeme ? [{ role: 'system', content: systeme }] : []).concat([{ role: 'user', content: texte }]);
    return { adresse: FOURNISSEURS.mistral.adresse, entetes, corps: { model: modele, max_tokens: maxJetons, messages } };
  }

  function texteReponse(fournisseur, donnees) {
    if (fournisseur === 'claude') return (donnees.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
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
    if (statut === 404 || (statut === 400 && /model/i.test(d))) return `Modèle inconnu chez ${nom}. Vérifie le nom du modèle dans les réglages.`;
    if (statut === 413) return `Texte trop long pour ${nom}.`;
    if (statut === 529 || statut >= 500) return `${nom} est momentanément surchargé ou indisponible. Réessaie dans quelques instants.`;
    return `${nom} a répondu par une erreur (${statut}).${d ? ' ' + d.slice(0, 200) : ''}`;
  }

  class ErreurIA extends Error {
    constructor(message, genre) { super(message); this.genre = genre; }
  }

  async function appeler(fournisseur, cle, modele, systeme, texte, { maxJetons = 1024, delai = 90000 } = {}) {
    const r = requete(fournisseur, cle, modele, systeme, texte, maxJetons);
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
    return { texte: texteReponse(fournisseur, donnees || {}), donnees };
  }

  // Le point d'entrée des futures fonctions d'IA : renvoie le texte de la réponse.
  async function demander(config, { systeme = '', texte, maxJetons, delai } = {}) {
    if (!config || !config.cle) throw new ErreurIA('Aucune clé d’IA n’est enregistrée sur cet appareil. Ajoute-la dans Configuration, onglet IA.', 'cle');
    return (await appeler(config.fournisseur, config.cle, config.modele, systeme, texte, { maxJetons, delai })).texte;
  }

  /* ---------- Tests ---------- */

  // Avec une clé : une toute petite demande (une fraction de centime) qui vérifie clé, crédits, modèle et appel direct.
  async function tester(fournisseur, cle, modele) {
    const m = modele || FOURNISSEURS[fournisseur].modele;
    const { texte } = await appeler(fournisseur, cle, m, '', 'Réponds seulement par le mot : OK', { maxJetons: 16, delai: 30000 });
    if (!texte.trim()) throw new ErreurIA(`${FOURNISSEURS[fournisseur].nom} a répondu, mais sans texte. Réessaie ou vérifie le modèle.`, 'reponse');
    return `Connexion réussie : ${FOURNISSEURS[fournisseur].nom} a répondu (modèle ${m}).`;
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

  const api = { FOURNISSEURS, lire, enregistrer, oublierCle, modeleDe, active, demander, tester, joignable, ErreurIA, expliquer, texteReponse, requete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPIA = api;
})(typeof window !== 'undefined' ? window : globalThis);
