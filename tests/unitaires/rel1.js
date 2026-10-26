const R = require('../../relecture.js');
const NB = '\u00A0';
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const source = `Depuis quelques mois, son manager ne lui parle presque plus. Juste des réunions auxquelles elle n’est plus convié et des décisions qu’elle découvre après tout le monde.\n\nNous travaillons sur les causes racines de son mal-être. Il m’a dit${NB}: «${NB}C’est fini${NB}!${NB}» Et puis… rien.\n\nLe silence laisse rarement un vide. Le silence est partout.`;
// Lecture de la réponse
eq('json simple', R.lireReponse('{"propositions":[{"a":1}]}').length, 1);
eq('json dans des balises', R.lireReponse('```json\n{"propositions":[]}\n```').length, 0);
let erreur = ''; try { R.lireReponse('Désolé, je ne peux pas.'); } catch (e) { erreur = e.message; } eq('illisible', erreur, 'La réponse de l’IA est illisible. Réessaie.');
// Repérage
const liste = [
  { type: 'grammaire', avant: 'convié', apres: 'conviée', phrase: 'Juste des réunions auxquelles elle n\'est plus convié et des décisions qu\'elle découvre après tout le monde.', pourquoi: 'Accord.', vigilance: '' },
  { type: 'vocabulaire', avant: 'causes racines', apres: 'causes profondes', phrase: 'Nous travaillons sur les causes racines de son mal-être.', pourquoi: 'Calque.', vigilance: 'Terme de méthode ?' },
  { type: 'ponctuation', avant: 'Il m\'a dit : « C\'est fini ! »', apres: 'Il m\'a dit : « C\'est terminé ! »', phrase: 'Il m\'a dit : « C\'est fini ! »', pourquoi: 'test copie typographique', vigilance: '' },
  { type: 'clarté', avant: 'Et puis... rien.', apres: 'Puis plus rien.', phrase: 'Et puis... rien.', pourquoi: 'ellipse', vigilance: '' },
  { type: 'repetition', avant: 'Le silence', apres: 'Il', phrase: 'Le silence est partout.', pourquoi: 'répétition', vigilance: '' },
  { type: 'orthographe', avant: 'inexistant', apres: 'x', phrase: 'Phrase inventée.', pourquoi: '', vigilance: '' },
  { type: 'orthographe', avant: 'plus', apres: 'plus', phrase: '', pourquoi: 'identique', vigilance: '' },
  { type: 'orthographe', avant: 'convié', apres: 'invitée', phrase: 'Juste des réunions auxquelles elle n’est plus convié et des décisions', pourquoi: 'chevauche', vigilance: '' },
  { type: 'clarte', avant: 'monde.\n\nNous', apres: 'monde. Nous', phrase: '', pourquoi: 'deux paragraphes', vigilance: '' },
];
const { retenues, ecartees } = R.localiser(source, liste);
eq('retenues', retenues.map((r) => [r.id, r.type, r.avant]), [['r1', 'Grammaire', 'convié'], ['r2', 'Vocabulaire', 'causes racines'], ['r3', 'Ponctuation', `Il m’a dit${NB}: «${NB}C’est fini${NB}!${NB}»`], ['r4', 'Clarté', 'Et puis… rien.'], ['r5', 'Répétition', 'Le silence']]);
eq('écartées', ecartees, 4);
eq('positions exactes', retenues.every((r) => source.slice(r.debut, r.fin) === r.avant), true);
eq('la répétition vise la 2e phrase', retenues[4].debut, source.lastIndexOf('Le silence'));
eq('contexte', [retenues[0].contexteAvant, retenues[0].contexteApres], ['Juste des réunions auxquelles elle n’est plus ', ' et des décisions qu’elle découvre après tout le monde.']);
// Application avec typographie
let a = R.appliquer(source, retenues[2].debut, retenues[2].fin, 'Il m\'a dit : "C\'est terminé !"');
eq('typographie appliquée au remplacement', a.insere, `Il m’a dit${NB}: «${NB}C’est terminé${NB}!${NB}»`);
eq('texte complet cohérent', a.texte.slice(a.debut, a.debut + a.longueur), a.insere);
eq('aperçu', R.apercu(source, retenues[0]), 'conviée');
// Recalage après acceptation de r1
const props = retenues.map((r) => ({ ...r, statut: 'attente' }));
a = R.appliquer(source, props[0].debut, props[0].fin, props[0].apres);
let apres = props.map((p, i) => (i === 0 ? { ...p, statut: 'acceptee', applique: { debut: a.debut, longueur: a.longueur, insere: a.insere, ancien: p.avant } } : p));
apres = R.recaler(source, a.texte, apres.map((p, i) => i === 0 ? p : p));
eq('les suivantes décalées', apres.slice(1).every((p) => a.texte.slice(p.debut, p.fin) === p.avant), true);
// Frappe qui touche une proposition en attente : elle disparaît
const t2 = a.texte.replace('causes racines', 'causes racine');
const apres2 = R.recaler(a.texte, t2, apres);
eq('proposition touchée retirée', apres2.map((p) => p.id), ['r1', 'r3', 'r4', 'r5']);
eq('les autres toujours justes', apres2.filter((p) => p.statut === 'attente').every((p) => t2.slice(p.debut, p.fin) === p.avant), true);
// Frappe sur une proposition acceptée : elle reste mais n'est plus annulable
const t3 = t2.replace('conviée', 'invitée');
const apres3 = R.recaler(t2, t3, apres2);
eq('acceptée touchée : perdue', apres3[0].applique.perdu, true);
// Frappe juste après un mot : pas touché
const t4 = t3.replace('Le silence est', 'Le silence, est');
eq('frappe juste après : gardée', R.recaler(t3, t4, apres3).map((p) => p.id), ['r1', 'r3', 'r4', 'r5']);
console.log(`${ok} réussis, ${ko} échecs`);
