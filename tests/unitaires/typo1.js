const T = require('../../typographie.js');
const NB = '\u00A0';
const v = (s) => s.replace(/\u00A0/g, '⍽');
let ok = 0, ko = 0;
function eq(nom, obtenu, attendu) { if (obtenu === attendu) ok++; else { ko++; console.log('ÉCHEC', nom, '\n  obtenu :', v(obtenu), '\n  attendu:', v(attendu)); } }
const tout = (t) => T.appliquer(t, T.corrections(t));
const cas = [
  ['Pourquoi ?', `Pourquoi${NB}?`], ['Pourquoi?', `Pourquoi${NB}?`], ['Pourquoi  ?', `Pourquoi${NB}?`],
  ['Vraiment !', `Vraiment${NB}!`], ['Quoi ?!', `Quoi${NB}?!`], ['Non !!!', `Non${NB}!!!`],
  ['Trois étapes : observer; essayer ; ajuster.', `Trois étapes${NB}: observer${NB}; essayer${NB}; ajuster.`],
  ['Rendez-vous à 14:30 ou 9:05.', 'Rendez-vous à 14:30 ou 9:05.'], ['Ratio 1:2', 'Ratio 1:2'],
  ['Voir https://ohpotentiel.fr/page?x=1&y=2 !', `Voir https://ohpotentiel.fr/page?x=1&y=2${NB}!`],
  ['Écris à contact@oh-potentiel.fr ; merci', `Écris à contact@oh-potentiel.fr${NB}; merci`],
  ['www.site.fr/a:b', 'www.site.fr/a:b'], ['http:', 'http:'], ['Note:', `Note${NB}:`],
  ['Elle dit "bonjour" et part.', `Elle dit «${NB}bonjour${NB}» et part.`],
  ['"Le talent, ça se cultive !"', `«${NB}Le talent, ça se cultive${NB}!${NB}»`],
  ['« Oui »', `«${NB}Oui${NB}»`], ['«Oui»', `«${NB}Oui${NB}»`], [`«${NB}Oui${NB}»`, `«${NB}Oui${NB}»`],
  ["L'IA c'est l'avenir", 'L’IA c’est l’avenir'], ["1'000 euros", "1'000 euros"],
  ['Et puis... rien.', 'Et puis… rien.'], ['Quatre....', 'Quatre....'], ['Attends...?', 'Attends…?'],
  ['Super :)', 'Super :)'], ['Clin ;)', 'Clin ;)'], ['(?)', '(?)'], ['? début', '? début'],
  ['Ligne\n? suite', 'Ligne\n? suite'], [`Déjà${NB}?`, `Déjà${NB}?`], ['Fine\u202F?', 'Fine\u202F?'],
  ['Dit : "oui"', `Dit${NB}: «${NB}oui${NB}»`], ['50 %', '50 %'],
  ['Il a dit "ça va ?" puis "non".', `Il a dit «${NB}ça va${NB}?${NB}» puis «${NB}non${NB}».`],
];
for (const [e, s] of cas) eq(JSON.stringify(e), tout(e), s);
// Idempotence
for (const [e] of cas) { const une = tout(e); eq('idempotent ' + JSON.stringify(e), tout(une), une); }
console.log(`${ok} réussis, ${ko} échecs`);
