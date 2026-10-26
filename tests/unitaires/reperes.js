const M = require('../../moteur.js');
let ok = 0, ko = 0;
const t = (nom, c, d) => { if (c) ok++; else { ko++; console.log('ÉCHEC', nom, d === undefined ? '' : JSON.stringify(d)); } };
const F = { l: 1080, h: 1350 };
t('marges standard 81/81/110/110', JSON.stringify(M.MARGES) === JSON.stringify({ gauche: 81, droite: 81, haute: 110, basse: 110 }));
// Aimantation sur la marge gauche
let r = M.reperesDeplacement({ x: 88, y: 500, l: 400, h: 100 }, [], F);
t('aimanté sur la marge gauche', r.ax === -7 && r.ay === 0, r);
t('ligne de marge montrée', r.lignes.some((l) => l.sens === 'v' && l.pos === 81 && l.sorte === 'marge'), r.lignes);
// Centre de la page
r = M.reperesDeplacement({ x: 335, y: 600, l: 400, h: 100 }, [], F);
t('centré horizontalement', r.ax === 5, r);
t('ligne du centre', r.lignes.some((l) => l.sorte === 'centre' && l.pos === 540));
// Alignement sur un autre bloc : segment limité aux deux éléments
const A = { x: 200, y: 200, l: 500, h: 120 };
r = M.reperesDeplacement({ x: 205, y: 700, l: 300, h: 80 }, [A], F);
const lg = r.lignes.find((l) => l.sorte === 'element' && l.pos === 200);
t('aligné sur le bord gauche d’un autre bloc', r.ax === -5 && lg && lg.debut === 184 && lg.fin === 796, r);
// Plusieurs repères à la fois : gauche sur A, bas sur la marge basse
r = M.reperesDeplacement({ x: 203, y: 1150, l: 300, h: 85 }, [A], F);
t('deux repères en même temps', r.ax === -3 && r.ay === 5 && r.lignes.some((l) => l.sens === 'v') && r.lignes.some((l) => l.sens === 'h' && l.pos === 1240), r);
// Écarts égaux entre deux voisins
const B = { x: 200, y: 800, l: 500, h: 120 };
r = M.reperesDeplacement({ x: 300, y: 513, l: 300, h: 100 }, [A, B], F, { seuil: 12 });
t('placé à égale distance de ses voisins', r.ay === -3 && r.ecarts.length === 2 && r.ecarts.every((e) => e.valeur === 190 && e.sens === 'v'), r);
// Même écart que la paire du dessus
const C = { x: 200, y: 400, l: 500, h: 100 }; // A→C : 80
r = M.reperesDeplacement({ x: 250, y: 585, l: 300, h: 100 }, [A, C], F);
t('même écart que entre les deux blocs du dessus', r.ay === -5 && r.ecarts.length === 2 && r.ecarts.every((e) => e.valeur === 80), r);
// Pas de faux écart avec un élément qui n'est pas en face
r = M.reperesDeplacement({ x: 750, y: 513, l: 200, h: 100 }, [A, B], F);
t('voisins hors de face ignorés', r.ecarts.length === 0, r);
// Trop loin : rien
r = M.reperesDeplacement({ x: 600, y: 560, l: 60, h: 60 }, [A], F);
t('rien à moins du seuil : ni décalage ni ligne', r.ax === 0 && r.ay === 0 && r.lignes.length === 0, r);
// Axe limité (redimensionnement) et bandeau seulement en hauteur
r = M.reperesDeplacement({ x: 995, y: -999, l: 0, h: 0 }, [{ x: 0, y: 800, l: 1080, h: 375, axes: 'y' }], F, { axes: 'x' });
t('redimensionnement : bord aimanté sur la marge droite', r.ax === 4 && r.ay === 0 && r.lignes.every((l) => l.sens === 'v'), r);
r = M.reperesDeplacement({ x: 4, y: 795, l: 300, h: 80 }, [{ x: 0, y: 800, l: 1080, h: 375, axes: 'y' }], F);
t('bandeau : aimante le haut, pas le bord 0', r.ay === 5 && r.ax === 0, r);
// Seuil plus large (zoom arrière)
r = M.reperesDeplacement({ x: 100, y: 500, l: 400, h: 100 }, [], F, { seuil: 20 });
t('seuil plus large', r.ax === -19);
console.log(ok + ' réussis, ' + ko + ' échecs');
process.exit(ko ? 1 : 0);
