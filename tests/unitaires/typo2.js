const T = require('../../typographie.js');
const NB = '\u00A0';
const v = (s) => s.replace(/\u00A0/g, '⍽');
let ok = 0, ko = 0;
function eq(nom, obtenu, attendu) { if (obtenu === attendu) ok++; else { ko++; console.log('ÉCHEC', nom, '\n  obtenu :', v(String(obtenu)), '\n  attendu:', v(String(attendu))); } }
// Frappe caractère par caractère, curseur à la fin, comme un utilisateur
function taper(depart, frappe, curseur = depart.length) {
  let texte = depart, c = curseur, annonces = [];
  for (const ch of frappe) {
    const brut = texte.slice(0, c) + ch + texte.slice(c);
    const r = T.corrigerSaisie(texte, brut, { curseur: c + 1 });
    if (r.remplacements.length) annonces.push(T.resume(r.remplacements));
    texte = r.texte; c = r.curseur;
  }
  return { texte, c, annonces };
}
let r = taper('', 'Pourquoi ?');
eq('frappe ?', r.texte, `Pourquoi${NB}?`); eq('curseur ?', r.c, r.texte.length); eq('annonce', r.annonces.join('|'), 'espace insécable avant « ? »');
r = taper('', 'Pourquoi?'); eq('frappe collé', r.texte, `Pourquoi${NB}?`); eq('curseur collé', r.c, r.texte.length);
r = taper('', 'Elle dit "bonjour" !'); eq('frappe guillemets', r.texte, `Elle dit «${NB}bonjour${NB}»${NB}!`); eq('curseur g', r.c, r.texte.length);
r = taper('', 'Elle dit " bonjour " !'); eq('frappe guillemets espacés', r.texte, `Elle dit «${NB}bonjour${NB}»${NB}!`);
r = taper('', 'Il dit « oui » ; fin.'); eq('frappe « espacés', r.texte, `Il dit «${NB}oui${NB}»${NB}; fin.`);
r = taper('', 'Il dit «oui».'); eq('frappe « collés', r.texte, `Il dit «${NB}oui${NB}».`);
r = taper('', "C'est l'heure... 14:30 !"); eq('frappe mix', r.texte, `C’est l’heure… 14:30${NB}!`); eq('curseur mix', r.c, r.texte.length);
r = taper('', 'Voir https://site.fr/a?b:c ok'); eq('frappe url', r.texte, 'Voir https://site.fr/a?b:c ok');
r = taper('', 'Super :)'); eq('frappe smiley', r.texte, `Super${NB}:)`);
// Insertion au milieu du texte, curseur au milieu
r = taper('Je pars. Fin', ' vraiment!', 7); eq('milieu', r.texte, `Je pars vraiment${NB}!. Fin`); eq('curseur milieu', r.c, 7 + ' vraiment'.length + 2);
// Collage d'un bloc
const ancien = 'Début.\n\nFin.';
const colle = 'Il dit "ça va ?" puis... rien. L\'IA!';
const brut = ancien.slice(0, 8) + colle + ancien.slice(8);
let s = T.corrigerSaisie(ancien, brut, { curseur: 8 + colle.length });
eq('collage', s.texte, `Début.\n\nIl dit «${NB}ça va${NB}?${NB}» puis… rien. L’IA${NB}!Fin.`);
eq('collage résumé', T.resume(s.remplacements), '6 corrections (espaces insécables, guillemets « », apostrophe ’, points de suspension …)');
eq('collage curseur', s.curseur, s.texte.indexOf('Fin.'));
// Le reste du texte n'est jamais touché (correction annulée ailleurs)
s = T.corrigerSaisie("Ailleurs ? Ici l'", "Ailleurs ? Ici l'a", { curseur: 18 }); eq('zone seule', s.texte, "Ailleurs ? Ici l'a");
// Effacement : jamais de correction
s = T.corrigerSaisie(`Mot${NB}?`, 'Mot?', { curseur: 3 }); eq('effacement', s.texte, 'Mot?');
// Annuler : retour exact
const base0 = 'Je dis "oui" ? Non...';
const c0 = T.corrections(base0); const corr = T.appliquer(base0, c0); const inv = T.inverser(c0);
eq('inverse exact', T.appliquer(corr, T.retablir(corr, corr, inv)), base0);
// Annuler après avoir continué d'écrire à la fin
const suite = corr + ' Et la suite.';
eq('inverse après suite', T.appliquer(suite, T.retablir(suite, corr, inv)), base0 + ' Et la suite.');
// Annuler après une écriture au début
const avantTexte = 'Bon. ' + corr;
eq('inverse après début', T.appliquer(avantTexte, T.retablir(avantTexte, corr, inv)), 'Bon. ' + base0);
// Correction retouchée depuis : laissée telle quelle, le reste est annulé
const retouche = corr.replace('…', '!');
const res = T.appliquer(retouche, T.retablir(retouche, corr, inv));
eq('inverse partiel', res, 'Je dis "oui" ? Non!');
console.log(`${ok} réussis, ${ko} échecs`);
