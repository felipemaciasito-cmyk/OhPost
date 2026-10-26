const IA = require('../../ia.js');
const R = require('../../relecture.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const rc = IA.requete('claude', 'k', 'm', 'sys', 'txt', 100, R.JSON_DISCUSSION);
eq('Claude : outil proposé (auto), jamais imposé', [rc.corps.tools[0].name, rc.corps.tool_choice, rc.corps.tools[0].input_schema.required, /appelant l’outil « repondre »/.test(rc.corps.system), rc.corps.system.startsWith('sys')], ['repondre', { type: 'auto' }, ['reponse', 'propositions'], true, true]);
const r55 = IA.requete('claude', 'k', 'claude-sonnet-5-5', 'sys', 'txt', 100, R.JSON_DISCUSSION);
eq('Sonnet 5.5 : marge de réflexion, effort moyen, pas de réglage refusé', [r55.corps.max_tokens > 100, r55.corps.output_config, r55.corps.tool_choice.type, 'temperature' in r55.corps, 'thinking' in r55.corps], [true, { effort: 'medium' }, 'auto', false, false]);
const r4 = IA.requete('claude', 'k', 'claude-sonnet-4-5', 's', 't', 100);
eq('ancien modèle : ni marge ni effort', [r4.corps.max_tokens, r4.corps.output_config], [100, undefined]);
eq('erreur outil imposé : plus « modèle inconnu »', /refusé la demande/.test(IA.expliquer('claude', 400, 'tool_choice: type "tool" and "any" are not supported for this model.')), true);
eq('vrai modèle inconnu', /Modèle inconnu/.test(IA.expliquer('claude', 404, 'model: claude-x')) && /Modèle inconnu/.test(IA.expliquer('claude', 400, 'model: claude-x not found')), true);
eq('réponse texte sans outil : JSON lu dans le texte', R.lireDiscussion(IA.texteReponse('claude', { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"reponse":"Ok","propositions":[],"pistes":[]}' }] })).reponse, 'Ok');
const rm = IA.requete('mistral', 'k', 'm', 'sys', 'txt', 100, R.JSON_DISCUSSION);
eq('Mistral : mode JSON', rm.corps.response_format, { type: 'json_object' });
eq('sans forme imposée : rien d’ajouté', [IA.requete('claude', 'k', 'm', 's', 't', 10).corps.tools, IA.requete('mistral', 'k', 'm', 's', 't', 10).corps.response_format], [undefined, undefined]);
const entree = { reponse: 'Voici « trois » versions avec des "guillemets droits".', propositions: [{ titre: 'Plus court', avant: 'a', apres: 'Il dit : "non".', pourquoi: '', vigilance: '' }], pistes: ['Encore'] };
const texte = IA.texteReponse('claude', { content: [{ type: 'tool_use', name: 'repondre', input: entree }] });
const lu = R.lireDiscussion(texte);
eq('réponse par outil, guillemets droits compris : lue sans perte', [lu.reponse, lu.propositions[0].apres, lu.propositions[0].titre, lu.pistes], [entree.reponse, 'Il dit : "non".', 'Plus court', ['Encore']]);
// Réponse coupée : erreur claire
global.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', input: {} }] }) });
(async () => {
  let msg = ''; try { await IA.demander({ fournisseur: 'claude', cle: 'k', modele: 'm' }, { systeme: 's', texte: 't', json: R.JSON_DISCUSSION }); } catch (e) { msg = e.message; }
  eq('réponse coupée signalée', msg.startsWith('La réponse de l’IA était trop longue'), true);
  global.fetch = async () => ({ ok: true, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'Bonjour' }] }) });
  eq('texte libre coupé : rendu tel quel', await IA.demander({ fournisseur: 'claude', cle: 'k', modele: 'm' }, { texte: 't' }), 'Bonjour');
  console.log(`${ok} réussis, ${ko} échecs`);
})();
