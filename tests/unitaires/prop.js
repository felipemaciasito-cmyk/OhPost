const P = require('../../propositions.js');
const M = require('../../moteur.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const fonds = M.fondsDe(M.PALETTE || M.CHARTE_DEFAUT.palette);
const cat = P.catalogue(M.GABARITS, fonds, M.NATURES);
eq('catalogue', ['V1 : Classique, Couverture', 'F1', 'citation (Citation)'].every((x) => cat.includes(x)), true);
const paras = ['« Je crois que je vais démissionner. »', 'C’est ce que me confie Clara.', '« Le pire… »', 'Et là, surprise.', 'Fin de l’histoire.'];
const brut = JSON.stringify({ reponse: 'Trois idées.', propositions: [
  { nom: 'Récit', pourquoi: 'Témoignage.', fond: Object.keys(fonds)[1], slides: [{ gabarit: 'V2', paragraphes: [0], styles: ['titre'] }, { gabarit: 'T1', paragraphes: [1, 2], styles: ['corps', 'citation'] }, { gabarit: 'F1', paragraphes: [3, 4] }] },
  { nom: 'Trou', slides: [{ gabarit: 'V1', paragraphes: [0] }, { gabarit: 'T1', paragraphes: [2, 3, 4] }] },
  { nom: 'Mauvais codes', fond: 'rose', slides: [{ gabarit: 'T2', paragraphes: [0, 1] }, { gabarit: 'V3', paragraphes: [2] }, { gabarit: 'Z9', paragraphes: [3, 4], styles: ['inconnu', 'emphase'] }] } ] });
const r = P.lireReponse('```json\n' + brut + '\n```', paras.length, M.GABARITS, fonds, M.NATURES);
eq('plans retenus / écartés', [r.plans.length, r.ecartes, r.reponse], [2, 1, 'Trois idées.']);
eq('plan 1 intact', [r.plans[0].nom, r.plans[0].slides.map((s) => s.gabarit)], ['Récit', ['V2', 'T1', 'F1']]);
eq('codes corrigés', [r.plans[1].slides.map((s) => s.gabarit), r.plans[1].fond, r.plans[1].slides[0].styles[0], r.plans[1].slides[2].styles], [['V1', 'T1', 'T1'], Object.keys(fonds)[0], 'titre', [null, 'emphase']]);
const slides = P.construireSlides(r.plans[1], paras);
eq('slides construites', [slides.length, slides[0].blocs[0].style, slides[2].blocs.map((b) => b.style), slides[2].signature, slides.map((s) => s.blocs.map((b) => b.texte)).flat().join('|') === paras.join('|')], [3, 'titre', ['corps', 'emphase'], true, true]);
let erreur = ''; try { P.lireReponse('Désolé.', 5, M.GABARITS, fonds, M.NATURES); } catch (e) { erreur = e.message; } eq('illisible', erreur, 'La réponse de l’IA est illisible. Réessaie.');
const msg = P.messageGeneration({ paragraphes: paras, catalogueTexte: cat, format: 'Carré 1:1', reseau: 'Instagram', favoris: [{ gabarit: 'V2', styles: ['titre'] }] });
eq('message de génération', ['[0] « Je crois', '[4] Fin', 'inspire-t’en : V2 [titre]', 'Propose 3 mises en page'].every((x) => msg.includes(x)), true);
const evo = P.messageEvolution({ paragraphes: paras, catalogueTexte: cat, plan: r.plans[0], historique: [{ de: 'moi', texte: 'Plus aéré' }], demande: 'Une slide de moins' });
eq('message d’évolution', ['Mise en page actuelle :', '"nom":"Récit"', 'Personne : Plus aéré', 'Demande de la personne : Une slide de moins', 'UNE seule proposition'].every((x) => evo.includes(x)), true);
console.log(`${ok} réussis, ${ko} échecs`);
{
  const rec = P.recetteDe(r.plans[0]);
  const adapte = P.adapterRecette(rec, 9, 'Récit (favori)', M.GABARITS, fonds, M.NATURES);
  eq('recette adaptée à 9 paragraphes', [adapte.nom, adapte.slides[0].gabarit, adapte.slides[adapte.slides.length - 1].gabarit, adapte.slides.map((s) => s.paragraphes).flat().join(',')], ['Récit (favori)', 'V2', 'F1', '0,1,2,3,4,5,6,7,8']);
  console.log(`recette : ${ok} réussis au total, ${ko} échecs`);
}
