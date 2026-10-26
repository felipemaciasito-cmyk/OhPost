const R = require('../../relecture.js');
const P = require('../../propositions.js');
const M = require('../../moteur.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const json = JSON.stringify({ reponse: 'Voici trois versions nettement plus relâchées, avec « truc », « skill ».', propositions: [
  { avant: 'L’intelligence émotionnelle n’est pas une question de tempérament ou de personnalité.', apres: 'L’intelligence émotionnelle, c’est pas une histoire de caractère, hein.', pourquoi: 'Registre oral.', vigilance: '' },
  { avant: 'x', apres: 'Franchement, c’est un skill qui se développe.', pourquoi: 'Ado.', vigilance: '{accolade} dans le texte' }] });
// Le cas réel : balises parasites, bloc de code, excuse, puis le JSON répété.
const brut = '<invoke name="x">\n</invoke>\n```json\n' + json + '\n```\n\nOups, je dois répondre uniquement avec l\'objet JSON.\n\n<invoke name="x">\n</invoke>\n\n' + json;
const r = R.lireDiscussion(brut);
eq('discussion : réponse et 2 propositions malgré le bruit', [r.reponse.slice(0, 22), r.propositions.length, r.propositions[1].vigilance], ['Voici trois versions n', 2, '{accolade} dans le texte']);
eq('JSON abîmé : jamais affiché', R.lireDiscussion('<invoke>{"reponse": "coupé').reponse.slice(0, 26), 'Ma réponse était mal formé');
eq('texte simple : gardé', R.lireDiscussion('Ton accroche est forte.').reponse, 'Ton accroche est forte.');
eq('relecture avec bruit', R.lireReponse('Voici : {"propositions":[{"avant":"a","apres":"b"}]} fin').length, 1);
eq('formulations avec bruit', R.lireFormulations('```json\n{"formulations":["a","b"]}\n``` Oups {"formulations":["c"]}'), ['a', 'b']);
eq('suggestion avec bruit', R.lireSuggestion('<x>{"autre":1}{"proposition":"Court.","pourquoi":"p"}', 'Long.').proposition, 'Court.');
const fonds = M.fondsDe(M.CHARTE_DEFAUT.palette);
const plan = JSON.stringify({ propositions: [{ nom: 'A', fond: Object.keys(fonds)[0], slides: [{ gabarit: 'V1', paragraphes: [0] }, { gabarit: 'T1', paragraphes: [1] }] }] });
eq('propositions de mise en page avec bruit', P.lireReponse('<invoke name="x"></invoke>' + plan + ' Oups ' + plan, 2, M.GABARITS, fonds, M.NATURES).plans.length, 1);
console.log(`${ok} réussis, ${ko} échecs`);
