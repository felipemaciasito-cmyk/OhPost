const L = require('../../liens.js');
const T = require('../../typographie.js');
const v = (s) => String(s).replace(/\u00A0/g, '⍽').replace(/\n/g, '⏎');
const mots = ['mot', 'Pourquoi', '?', '!', ':', ';', '"', "l'IA", '...', '«', '»', 'texte', 'Oui', 'non', '14:30', 'https://a.fr/b?c', 'et', 'puis', ',', '.'];
let graine = 7; const hasard = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
const phrase = () => Array.from({ length: 4 + hasard(14) }, () => mots[hasard(mots.length)]).join(hasard(5) ? ' ' : '');
let reste = 0, montres = 0;
for (let e = 0; e < 3000; e++) {
  const p = phrase().trim(); if (!p) continue;
  const c = T.corrections(p); const une = T.appliquer(p, c); const c2 = T.corrections(une);
  if (c2.length) { reste++; if (montres++ < 6) console.log(v(p), '\n →', v(une), '\n reste', c2.map((r) => r.regle + ':' + v(r.ancien) + '→' + v(r.texte)).join(' | ')); }
}
console.log('textes non stables après une passe :', reste, '/ 3000');
