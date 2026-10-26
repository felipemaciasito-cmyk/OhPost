const M = require('../../moteur.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const police = { mesurer: (t, taille) => t.length * taille * 0.5, asc: 0.8, desc: 0.2, dessiner: () => {}, chemin: () => ({ draw() {}, fill: '' }), exacte: true };
const cp = () => police;
const texte = 'Une phrase assez longue pour tenir sur plusieurs lignes dans la slide, et même un peu plus que ça pour être sûr.';
const slide = (extra) => ({ role: 'Texte', gabarit: 'T1', blocs: [{ style: 'corps', texte, ...extra }] });
const rects = (r) => r.elements.filter((e) => e.type === 'rect' && e.l !== 5);
const base = M.composer(slide({}), 'carre', 'blanc', cp, {});
eq('T1 sans fond', rects(base).length, 0);
const rect = M.composer(slide({ fondBloc: { couleur: '#E6EBEC', forme: 'rectangle', angles: 'arrondis' } }), 'carre', 'blanc', cp, {});
eq('fond rectangle arrondi', rects(rect).map((e) => [e.couleur, e.rayon]), [['#E6EBEC', 28]]);
const droit = M.composer(slide({ fondBloc: { couleur: '#E6EBEC', forme: 'rectangle', angles: 'droits' } }), 'carre', 'blanc', cp, {});
eq('angles droits', rects(droit)[0].rayon, 0);
const lignes = M.composer(slide({ fondBloc: { couleur: 'accent', forme: 'lignes', angles: 'arrondis' } }), 'carre', 'blanc', cp, {});
const rl = rects(lignes);
eq('suit les lignes : un fond par ligne, couleur de rôle résolue', [rl.length > 1, rl.every((e) => e.rayon === 8), rl[0].couleur === M.fondsDe(M.CHARTE_DEFAUT.palette).blanc.accent], [true, true, true]);
const t4 = { role: 'Texte', gabarit: 'T5', blocs: [{ style: 'emphase', texte: 'Phrase encadrée par le gabarit.' }] };
const avecCarte = rects(M.composer(t4, 'carre', 'blanc', cp, {})).length;
eq('« Aucun fond » retire celui du gabarit', [avecCarte > 0, rects(M.composer({ ...t4, blocs: [{ ...t4.blocs[0], fondBloc: 'aucun' }] }, 'carre', 'blanc', cp, {})).length], [true, 0]);
// Le bloc en écriture garde son fond : on dessine sur un faux contexte et on compte les remplissages.
const appels = []; const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { appels.push(k); return { width: 10 }; }), set: (t, k, v) => { t[k] = v; return true; } });
const compo = M.composer(t4, 'carre', 'blanc', cp, {});
appels.length = 0; try { M.dessiner(ctx, compo, {}, { masquer: 0 }); } catch (e) { console.log('dessin :', e.message); }
const remplis = appels.filter((k) => k === 'fill' || k === 'fillRect').length;
appels.length = 0; try { M.dessiner(ctx, compo, {}, {}); } catch (e) {}
const tous = appels.filter((k) => k === 'fill' || k === 'fillRect').length;
eq('en écriture : le fond de l’encadré est encore dessiné', remplis >= 2, true);
console.log(`${ok} réussis, ${ko} échecs`, '(remplissages masqué/complet :', remplis, '/', tous, ')');
