// Agent ciblé : déplacer et agrandir un paragraphe, placer le logo et les fleurs, sans sortir des marges.
const M = require('../../moteur.js');
let ok = 0, ko = 0; const eq = (n, a, b) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) ok++; else { ko++; console.log('ÉCHEC', n, '\n  obtenu :', A, '\n  attendu:', B); } };
const police = { mesurer: (t, taille) => t.length * taille * 0.5, asc: 0.8, desc: 0.2, dessiner: () => {}, chemin: () => ({ draw() {}, fill: '' }), exacte: true };
const cp = () => police;
const page = { role: 'Texte', gabarit: 'T1', blocs: [{ style: 'corps', texte: 'Un premier paragraphe assez court.' }, { style: 'citation', texte: '« Une citation. »' }] };
const compo = (s) => M.composer(s, 'portrait', 'bleu', cp, { index: 1, total: 3 });
const boite = (c, n) => { const z = c.elements.filter((e) => e.type === 'bloc' && e.bloc === n); return { y0: Math.min(...z.map((e) => e.y)), y1: Math.max(...z.map((e) => e.y + e.h)), x0: Math.min(...z.map((e) => e.x)), x1: Math.max(...z.map((e) => e.x + e.l)) }; };
const H = 1350, L = 1080, M_ = M.MARGES;

// Déplacer en bas : la page passe en mise en page libre, le paragraphe touche la marge du bas.
let r = M.retoucherDisposition(page, compo(page), [{ type: 'deplacer', bloc: 1, vertical: 'bas' }]);
let c = compo(r.slide);
eq('en bas : mise en page libre', [r.slide.libre, r.libre], [true, true]);
eq('en bas : posé sur la marge du bas', Math.round(boite(c, 1).y1), H - M_.basse);
eq('en bas : l’autre paragraphe ne bouge pas', Math.round(boite(c, 0).y0), Math.round(boite(compo(page), 0).y0));
eq('en bas : la page ne déborde pas', c.deborde, false);
// En haut, au milieu
r = M.retoucherDisposition(page, compo(page), [{ type: 'deplacer', bloc: 0, vertical: 'haut' }]);
eq('en haut : posé sur la marge du haut', Math.round(boite(compo(r.slide), 0).y0), M_.haute);
r = M.retoucherDisposition(page, compo(page), [{ type: 'deplacer', bloc: 1, vertical: 'milieu' }]);
const bm = boite(compo(r.slide), 1);
eq('au milieu : centré verticalement', Math.abs((bm.y0 + bm.y1) / 2 - (M_.haute + H - M_.basse) / 2) < 2, true);
// Plus bas, plusieurs fois : jamais au-delà de la marge
let s = page;
for (let k = 0; k < 20; k++) s = M.retoucherDisposition(s, compo(s), [{ type: 'deplacer', bloc: 1, vertical: 'plus_bas' }]).slide;
eq('plus bas répété : bloqué à la marge du bas', boite(compo(s), 1).y1 <= H - M_.basse + 0.5, true);
// Centrer : l'alignement change, sans passer la page en libre
r = M.retoucherDisposition(page, compo(page), [{ type: 'deplacer', bloc: 0, horizontal: 'centre' }]);
eq('centrer : alignement centré, page non libre', [r.slide.blocs[0].alignement, !!r.slide.libre], ['centre', false]);
// Taille : plus gros, borné
r = M.retoucherDisposition(page, compo(page), [{ type: 'taille', bloc: 0, facteur: 1.5 }]);
eq('plus gros : taille × 1,5', r.slide.blocs[0].fige.style.taille, Math.round(compo(page).elements.find((e) => e.type === 'bloc' && e.bloc === 0).style.taille * 1.5));
r = M.retoucherDisposition(page, compo(page), [{ type: 'taille', bloc: 0, facteur: 10 }]);
eq('taille bornée à × 1,6', r.slide.blocs[0].fige.style.taille, Math.round(compo(page).elements.find((e) => e.type === 'bloc' && e.bloc === 0).style.taille * 1.6));
eq('la slide d’origine n’est pas modifiée', page.libre === undefined && page.blocs[0].fige === undefined, true);
// Largeur : plus étroit, puis placé à droite, dans les marges
r = M.retoucherDisposition(page, compo(page), [{ type: 'largeur', bloc: 1, facteur: 0.5 }, { type: 'deplacer', bloc: 1, horizontal: 'droite' }]);
const bl = r.slide.blocs[1].pos;
eq('plus étroit puis à droite : collé à la marge droite', [Math.round(bl.l), Math.round(bl.x + bl.l)], [Math.round((L - M_.gauche - M_.droite) * 0.5), L - M_.droite]);
// Logo et fleurs
const couv = { role: 'Couverture', gabarit: 'V5', blocs: [{ style: 'titre', texte: 'Je crois que je vais démissionner.' }] };
const cc = M.composer(couv, 'portrait', 'bleu', cp, {});
r = M.retoucherDisposition(couv, cc, [{ type: 'image', image: 'fleurs', vertical: 'bas', horizontal: 'droite' }]);
const fl = r.slide.images.find((im) => im.type === 'fleurs');
eq('fleurs en bas à droite, dans les marges', [Math.round((fl.x + fl.w) * L), Math.round(fl.y * H + fl.w * L * 275 / 696)], [L - M_.droite, H - M_.basse]);
eq('fleurs : la page ne passe pas en libre', !!r.slide.libre, false);
r = M.retoucherDisposition(couv, cc, [{ type: 'image', image: 'fleurs', facteur: 1.2 }]);
eq('fleurs agrandies', Math.round(r.slide.images[0].w * 1000), Math.round(M.imagesDe(cc)[0].w * 1.2 * 1000));
r = M.retoucherDisposition(couv, cc, [{ type: 'image', image: 'fleurs', retirer: true }]);
eq('fleurs retirées', [r.slide.images.length, r.faits.length], [0, 1]);
r = M.retoucherDisposition(couv, cc, [{ type: 'image', image: 'logo', vertical: 'bas' }]);
eq('pas de logo : refus expliqué, rien ne change', [r.refus.length, r.slide.images === undefined], [1, true]);
r = M.retoucherDisposition({ ...couv, images: [{ type: 'fleurs', x: 0.1, y: 0.1, w: 0.2, verrou: true }] }, cc, [{ type: 'image', image: 'fleurs', vertical: 'bas' }]);
eq('fleurs verrouillées : refus', [r.refus.length, r.slide.images[0].y], [1, 0.1]);
console.log(ok + ' / ' + (ok + ko) + ' vérifications réussies');
process.exit(ko ? 1 : 0);
