const T = require('../../typographie.js');
const A = require('../donnees/articles.json');
for (const [nom, paras] of Object.entries(A)) {
  const n = T.notesDeTravail(paras.join('\n\n'));
  console.log(nom.padEnd(32), n.length, n.map((x) => '\n     · ' + x.texte.slice(0, 60) + ' (' + x.raison + ')').join(''));
}
const t = 'Posts LinkedIn Anne / Oh\n\n(une question ?)\n\nTitre commun : bla\n\n« Vrai début. »\n\nRésultat : une phrase.\n\nNB : penser aux hashtags\n\nFin.';
const n = T.notesDeTravail(t);
console.log('cas types :', n.map((x) => x.texte));
console.log('retrait :', JSON.stringify(T.retirerLignes(t, n.map((x) => x.ligne))));
