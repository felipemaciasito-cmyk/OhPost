const stock = {}; globalThis.localStorage = { getItem: (k) => (k in stock ? stock[k] : null), setItem: (k, v) => { stock[k] = String(v); }, removeItem: (k) => { delete stock[k]; } };
const IA = require('../../ia.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { if (a === b) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', a, '\n  attendu:', b); } };
const vrai = (n, c, d = '') => eq(n + (c ? '' : ' ' + d), !!c, true);
let dernier = null;
const repondre = (statut, corps) => async (url, init) => { dernier = { url, init }; return { ok: statut < 300, status: statut, json: async () => corps }; };
(async () => {
  // Configuration
  let c = IA.lire(); eq('défaut claude', c.fournisseur, 'claude'); eq('pas active', IA.active(c), null);
  IA.enregistrer({ fournisseur: 'claude', cles: { claude: 'sk-ant-x' }, modeles: {} });
  c = IA.lire(); eq('active', IA.active(c).modele, 'claude-sonnet-5-5'); eq('clé', IA.active(c).cle, 'sk-ant-x');
  IA.oublierCle('claude'); eq('oubliée', IA.active(IA.lire()), null);
  // Claude : requête et réponse
  globalThis.fetch = repondre(200, { content: [{ type: 'text', text: 'OK' }] });
  eq('test claude', await IA.tester('claude', 'sk-ant-x'), 'Connexion réussie : Anthropic a répondu.');
  const h = dernier.init.headers; const corps = JSON.parse(dernier.init.body);
  eq('adresse claude', dernier.url, 'https://api.anthropic.com/v1/messages');
  eq('clé en en-tête', h['x-api-key'], 'sk-ant-x'); eq('accès navigateur', h['anthropic-dangerous-direct-browser-access'], 'true'); eq('version', h['anthropic-version'], '2023-06-01');
  eq('modèle envoyé', corps.model, 'claude-sonnet-5-5'); eq('max (16 + marge de réflexion)', corps.max_tokens, 16 + 6000);
  eq('demander', await IA.demander({ fournisseur: 'claude', cle: 'k', modele: 'm' }, { systeme: 'S', texte: 'T' }), 'OK');
  // Qui est CCB et à qui il parle (prénom « Anne » par défaut) : ajouté à la fin de chaque consigne.
  eq('système claude (avec l’identité de CCB)', JSON.parse(dernier.init.body).system, 'S\n\n' + IA.identite());
  eq('identité : nom, prénom, ton', /CCB \(Creative Collaborative Boost\)/.test(IA.identite()) && /Tu parles à Anne/.test(IA.identite()) && /professionnel, bienveillant et chaleureux/.test(IA.identite()), true);
  // Mistral
  globalThis.fetch = repondre(200, { choices: [{ message: { content: 'OK' } }] });
  eq('test mistral', await IA.tester('mistral', 'mk', 'mistral-large-latest'), 'Connexion réussie : Mistral a répondu.');
  eq('bearer', dernier.init.headers.authorization, 'Bearer mk');
  const cm = JSON.parse(dernier.init.body); eq('messages mistral', cm.messages.length, 1);
  await IA.demander({ fournisseur: 'mistral', cle: 'k', modele: 'm' }, { systeme: 'S', texte: 'T' });
  eq('système mistral', JSON.parse(dernier.init.body).messages[0].role, 'system');
  // Erreurs
  const erreur = async (f, statut, corps) => { globalThis.fetch = repondre(statut, corps); try { await IA.tester(f, 'k'); return 'pas d’erreur'; } catch (e) { return e.message; } };
  vrai('401', (await erreur('claude', 401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } })).startsWith('Clé refusée par Anthropic'));
  vrai('crédits', (await erreur('claude', 400, { error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } })).startsWith('Crédits insuffisants chez Anthropic'));
  vrai('modèle', (await erreur('claude', 404, { error: { type: 'not_found_error', message: 'model: claude-x' } })).startsWith('Modèle inconnu'));
  vrai('429', (await erreur('mistral', 429, { message: 'Requests rate limit exceeded' })).startsWith('Trop de demandes'));
  vrai('529', (await erreur('claude', 529, { error: { type: 'overloaded_error' } })).includes('surchargé'));
  vrai('réponse vide', (await erreur('claude', 200, { content: [] })).includes('sans texte'));
  globalThis.fetch = async () => { throw new TypeError('Load failed'); };
  vrai('réseau', (await (async () => { try { await IA.tester('mistral', 'k'); } catch (e) { return e.message; } })()).startsWith('Impossible de joindre Mistral'));
  eq('injoignable', await IA.joignable('mistral'), false);
  globalThis.fetch = repondre(401, {}); eq('joignable', await IA.joignable('claude'), true);
  vrai('sans clé', (await (async () => { try { await IA.demander(null, { texte: 'x' }); } catch (e) { return e.message; } })()).startsWith('Aucune clé'));
  console.log(`${ok} réussis, ${ko} échecs`);
})();
