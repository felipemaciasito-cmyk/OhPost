const T = require('../../typographie.js');
const A = require('../donnees/articles.json');
const v = (s) => s.replace(/\u00A0/g, '⍽');
for (const [nom, paras] of Object.entries(A)) {
  const texte = paras.join('\n\n');
  const c = T.corrections(texte);
  const parRegle = {};
  c.forEach((r) => { parRegle[r.regle] = (parRegle[r.regle] || 0) + 1; });
  console.log(`\n== ${nom} : ${c.length} corrections`, JSON.stringify(parRegle));
  c.forEach((r) => { const ctx = texte.slice(Math.max(0, r.debut - 18), r.fin + 6).replace(/\n/g, '⏎'); console.log(`   ${r.regle.padEnd(11)} « ${v(ctx)} »  →  « ${v(texte.slice(Math.max(0, r.debut - 18), r.debut) + r.texte + texte.slice(r.fin, r.fin + 6)).replace(/\n/g, '⏎')} »`); });
  const corr = T.appliquer(texte, c);
  if (T.corrections(corr).length) console.log('   !! non stable');
}
