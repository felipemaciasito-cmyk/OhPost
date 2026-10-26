const L = require('../../liens.js');
const T = require('../../typographie.js');
const NB = '\u00A0';
let ok = 0, ko = 0;
const v = (s) => String(s).replace(/\u00A0/g, '⍽').replace(/\n/g, '⏎');
function eq(nom, obtenu, attendu) { if (obtenu === attendu) ok++; else { ko++; console.log('ÉCHEC', nom, '\n  obtenu :', v(obtenu), '\n  attendu:', v(attendu)); } }
function coherent(nom, a) {
  const src = L.sourceDe(a);
  for (const s of a.slides) for (const b of s.blocs) {
    if (!b.lien) continue;
    if (b.texte !== L.materialiser(src, b.lien)) { ko++; console.log('INCOHÉRENT', nom, v(b.texte), '≠', v(L.materialiser(src, b.lien))); return false; }
    for (const m of b.marques || []) if (m.debut < 0 || m.fin > b.texte.length || m.fin <= m.debut) { ko++; console.log('MARQUE HORS BORNES', nom, m); return false; }
    for (const r of b.lien.retours) if (src[r] !== ' ') { ko++; console.log('RETOUR PERDU', nom); return false; }
  }
  ok++; return true;
}
// Article : deux paragraphes, le second coupé sur deux slides, un retour à la ligne, une mise en forme
const texte = ['Je crois que je vais démissionner. Pourtant, j\'adore mon travail !', 'Elle dit "bonjour" puis... rien. Et toi ? Moi : non.'];
let art = { id: 'x', texte, slides: [
  { blocs: [{ style: 'titre', texte: 'Je crois que\nje vais démissionner.' }, { style: 'corps', texte: 'Pourtant, j\'adore mon travail !', marques: [{ debut: 10, fin: 17, gras: true }] }] },
  { blocs: [{ style: 'corps', texte: 'Elle dit "bonjour" puis... rien. Et toi' }] },
  { blocs: [{ style: 'corps', texte: '? Moi : non.' }] },
  { blocs: [{ style: 'corps', texte: 'Ajout libre : "oui" !' }] },
] };
art = L.lierArticle(art);
eq('liaison bloc libre', !!art.slides[3].blocs[0].libre, true);
coherent('départ', art);
const c = T.correctionsArticle(art);
// « toi ? » traverse la limite entre slides 2 et 3 : protégé
eq('limite protégée', c.source.some((r) => r.signe === '?'), false);
const apres = T.corrigerArticle(art);
coherent('après', apres);
eq('slide 1 titre (retour gardé)', apres.slides[0].blocs[0].texte, 'Je crois que\nje vais démissionner.');
eq('slide 1 corps', apres.slides[0].blocs[1].texte, `Pourtant, j’adore mon travail${NB}!`);
eq('marque suit', JSON.stringify(apres.slides[0].blocs[1].marques), JSON.stringify([{ debut: 10, fin: 17, gras: true }]));
eq('slide 2', apres.slides[1].blocs[0].texte, `Elle dit «${NB}bonjour${NB}» puis… rien. Et toi`);
eq('slide 3', apres.slides[2].blocs[0].texte, `? Moi${NB}: non.`);
eq('bloc libre', apres.slides[3].blocs[0].texte, `Ajout libre${NB}: «${NB}oui${NB}»${NB}!`);
eq('plus rien à corriger', T.correctionsArticle(apres).total, 0);
eq('texte article', apres.texte[1], `Elle dit «${NB}bonjour${NB}» puis… rien. Et toi ? Moi${NB}: non.`);
// Annulation d'une trace sur le texte
const src0 = L.sourceDe(art);
const trace = { base: L.sourceDe(apres), inverses: T.inverser(c.source) };
const retour = T.annulerTrace(apres, trace);
coherent('annulé', retour);
eq('annulé = départ (texte)', L.sourceDe(retour), src0);
eq('annulé = départ (slides liées)', JSON.stringify(retour.slides.slice(0, 3)), JSON.stringify(art.slides.slice(0, 3)));
// Retour à la ligne de mise en page sur l'espace avant « ? » : protégé
let art2 = L.lierArticle({ id: 'y', texte: ['Pourquoi partir ? Parce que.'], slides: [{ blocs: [{ style: 'corps', texte: 'Pourquoi partir\n? Parce que.' }] }] });
eq('retour avant ? gardé', T.correctionsArticle(art2).total, 0);

// Fuzz : articles aléatoires, coupures aléatoires, corrections, cohérence et retour exact
const mots = ['mot', 'Pourquoi', '?', '!', ':', ';', '"', "l'IA", '...', '«', '»', 'texte', 'Oui', 'non', '14:30', 'https://a.fr/b?c', 'et', 'puis', ',', '.'];
let graine = 7; const hasard = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
const phrase = () => Array.from({ length: 4 + hasard(14) }, () => mots[hasard(mots.length)]).join(hasard(5) ? ' ' : '');
let essais = 0;
for (let e = 0; e < 1500; e++) {
  const paras = Array.from({ length: 1 + hasard(4) }, phrase).map((p) => p.trim()).filter(Boolean);
  if (!paras.length) continue;
  let a = L.lierArticle({ id: 'f', texte: paras, slides: paras.map((p) => ({ blocs: [{ style: 'corps', texte: p, marques: p.length > 6 ? [{ debut: 2, fin: 5, gras: true }] : undefined }] })) });
  // coupures au hasard
  for (let k = 0; k < 2; k++) { const i = hasard(a.slides.length); const b = a.slides[i].blocs[0]; if (b && b.texte.length > 3) a = L.couperSlide(a, i, 0, 1 + hasard(b.texte.length - 2)); }
  if (!coherent('fuzz départ ' + e, a)) break;
  const c2 = T.correctionsArticle(a);
  const b2 = T.corrigerArticle(a);
  if (!coherent('fuzz après ' + e, b2)) { console.log(paras); break; }
  // Le texte de l'article est exactement le texte corrigé
  if (L.sourceDe(b2) !== T.appliquer(L.sourceDe(a), c2.source)) { ko++; console.log('SOURCE', e); break; }
  // Idempotence
  if (T.correctionsArticle(b2).total !== 0 && T.correctionsArticle(T.corrigerArticle(b2)).total !== 0) { ko++; console.log('NON IDEMPOTENT', e, v(L.sourceDe(b2))); break; }
  // Annuler
  const r2 = T.annulerTrace(b2, { base: L.sourceDe(b2), inverses: T.inverser(c2.source) });
  if (L.sourceDe(r2) !== L.sourceDe(a) || JSON.stringify(r2.slides.map((s) => s.blocs.map((x) => [x.texte, x.lien]))) !== JSON.stringify(a.slides.map((s) => s.blocs.map((x) => [x.texte, x.lien])))) { ko++; console.log('ANNULATION', e, v(L.sourceDe(a))); break; }
  essais++;
}
ok += essais;
console.log(`${ok} réussis (dont ${essais} articles aléatoires), ${ko} échecs`);
