// Corrections du bilan du 3 novembre 2026 : annulation après une synchronisation, envies gardées par ⌘Z,
// message des conflits de réglages, fusion d'un paragraphe avec un texte ajouté, deux-points après un chiffre.
// postsop.js a besoin de React pour se charger : une version minimale suffit ici (aucun écran n'est dessiné).
globalThis.React = { createElement: () => null, Fragment: 'f', Component: class {}, createContext: () => ({ Provider: 'p' }), useState: () => [], useReducer: () => [], useEffect() {}, useLayoutEffect() {}, useMemo: (f) => f(), useRef: () => ({}), useContext: () => ({}) };
const A = require('../../postsop.js');
const L = require('../../liens.js');
const T = require('../../typographie.js');
const S = require('../../synchro.js');
let ok = 0, ko = 0; const t = (n, c, d) => { if (c) ok++; else { ko++; console.log('ÉCHEC', n, d === undefined ? '' : d); } };
const NB = ' ';
const r = A.reducteur;
const art = (id, texte) => ({ id, titre: id, statut: 'Brouillon', reseau: 'deux', format: 'carre', fond: 'bleu', texte: [texte], slides: [{ gabarit: 'V1', blocs: [{ style: 'titre', texte }], signature: true }], descriptions: {} });

(async () => {
  // 1. ⌘Z après une synchronisation qui a reçu des changements : il ne défait plus ce qui vient de GitHub.
  let e = r({ ...A.ETAT_INITIAL }, { type: 'charger', projet: null, articles: [art('a1', 'Texte A'), art('a2', 'Texte B')] });
  e = r(e, { type: 'article', id: 'a1', maj: (a) => ({ ...a, titre: 'A modifié' }) });
  t('une modification s’ajoute à l’historique', e.historique.passe.length === 1);
  e = r(e, { type: 'charger', projet: e.projet, articles: e.articles.map((a) => (a.id === 'a2' ? { ...a, titre: 'B modifié ailleurs' } : a)) });
  t('synchronisation reçue : l’historique repart de zéro', e.historique.passe.length === 0 && e.historique.futur.length === 0);
  e = r(e, { type: 'annuler' });
  t('⌘Z après la synchronisation ne défait pas le changement reçu', e.articles.find((a) => a.id === 'a2').titre === 'B modifié ailleurs');
  t('⌘Z après la synchronisation garde aussi le changement local copié', e.articles.find((a) => a.id === 'a1').titre === 'A modifié');
  e = r(e, { type: 'article', id: 'a1', maj: (a) => ({ ...a, titre: 'A encore' }) });
  e = r(e, { type: 'annuler' });
  t('les modifications faites après la synchronisation s’annulent toujours', e.articles.find((a) => a.id === 'a1').titre === 'A modifié');

  // 3. Les envies (« Une envie ? ») survivent à ⌘Z et au rétablissement.
  let f = r({ ...A.ETAT_INITIAL }, { type: 'charger', projet: null, articles: [art('a1', 'Texte A')] });
  f = r(f, { type: 'article', id: 'a1', maj: (a) => ({ ...a, titre: 'retouche' }) });
  f = r(f, { type: 'envies', id: 'a1', maj: (l) => [...l, { id: 'e1', envie: 'plus aéré' }] });
  f = r(f, { type: 'annuler' });
  t('⌘Z annule la retouche', f.articles[0].titre === 'a1');
  t('⌘Z garde l’envie ajoutée après la retouche', JSON.stringify(f.articles[0].envies) === JSON.stringify([{ id: 'e1', envie: 'plus aéré' }]), JSON.stringify(f.articles[0].envies));
  f = r(f, { type: 'retablir' });
  t('rétablir remet la retouche et garde l’envie', f.articles[0].titre === 'retouche' && f.articles[0].envies.length === 1);
  f = r(f, { type: 'annuler' });
  f = r(f, { type: 'article', id: 'a1', maj: (a) => ({ ...a, titre: 'autre retouche' }) });
  t('après ⌘Z puis une autre retouche, l’envie est toujours là', (f.articles[0].envies || []).length === 1);
  const sansEnvie = r(r(r({ ...A.ETAT_INITIAL }, { type: 'charger', projet: null, articles: [art('a1', 'X')] }), { type: 'article', id: 'a1', maj: (a) => ({ ...a, titre: 'Y' }) }), { type: 'annuler' });
  t('un article sans envie n’en reçoit pas', !('envies' in sansEnvie.articles[0]) && sansEnvie.articles[0].titre === 'a1');

  // 2. Conflit sur les réglages : le message dit ce qui a vraiment été gardé.
  const distant = new Map(); let n = 0;
  const client = {
    async lister(dossier) { const o = {}; for (const [c, v] of distant) { const d = c.includes('/') ? c.split('/')[0] : ''; if (d === dossier) o[c] = v.sha; } return o; },
    async lire(c) { return { octets: distant.get(c).octets, sha: distant.get(c).sha }; },
    async ecrire(c, octets) { const s = 'sha' + (++n); distant.set(c, { octets, sha: s }); return s; },
    async supprimer(c) { distant.delete(c); },
  };
  const D1 = S.creerDepot({ magasin: S.creerMagasinMemoire(), client });
  const D2 = S.creerDepot({ magasin: S.creerMagasinMemoire(), client });
  await D1.ecrireJSON('projet.json', { favoris: ['f0'] }); await D1.synchroniser(); await D2.synchroniser();
  await D1.ecrireJSON('projet.json', { favoris: ['f0', 'sur D1'] });
  await D2.ecrireJSON('projet.json', { favoris: ['f0', 'sur D2'] });
  await D1.synchroniser();
  const rapport = await D2.synchroniser();
  const m = A.messageConflits(rapport.conflits);
  t('conflit de réglages : le message ne dit plus que les deux versions sont gardées', !/deux versions sont gardées/.test(m), m);
  t('conflit de réglages : le message dit que la version de GitHub a été gardée', /Tes réglages/.test(m) && /version copiée sur GitHub a été gardée/.test(m), m);
  t('conflit de réglages : le détail dit que les changements faits ici sont perdus', /ne l’ont pas été/.test(A.detailConflit(rapport.conflits[0])), A.detailConflit(rapport.conflits[0]));
  const ma = A.messageConflits([{ chemin: 'articles/x.json', copie: 'articles/x-conflit-1.json', titre: 'X' }]);
  t('conflit d’article : les deux versions sont gardées (inchangé)', /deux versions sont gardées/.test(ma) && !/Tes réglages/.test(ma), ma);
  const mr = A.messageConflits([{ chemin: 'ressources/logo', copie: null, titre: 'ressources/logo' }]);
  t('conflit de police ou d’image : la version de GitHub', /police ou une image/.test(mr) && !/deux versions sont gardées/.test(mr), mr);
  t('aucun conflit : aucun message', A.messageConflits([]) === '');

  // 5. Fusionner un paragraphe de l'article avec un texte ajouté (sans lien) : le texte ajouté entre dans l'article.
  let b = L.lierArticle({ texte: ['Premier paragraphe ici.', 'Second paragraphe.'], slides: [{ gabarit: 'T1', blocs: [{ style: 'corps', texte: 'Premier paragraphe ici.' }, { style: 'corps', texte: 'Second paragraphe.' }] }] });
  b = { ...b, slides: [{ ...b.slides[0], blocs: [...b.slides[0].blocs, { style: 'emphase', texte: 'Texte ajouté', marques: [{ debut: 0, fin: 5, gras: true }] }] }] };
  const f1 = L.fusionnerPlusieurs(b, 0, [0, 2]);
  t('lié puis ajouté : un seul bloc, lié à l’article', f1.slides[0].blocs.length === 2 && !!f1.slides[0].blocs[0].lien && f1.slides[0].blocs[0].texte === 'Premier paragraphe ici. Texte ajouté', JSON.stringify(f1.slides[0].blocs[0]));
  t('lié puis ajouté : le texte ajouté est dans l’article', f1.texte[0] === 'Premier paragraphe ici. Texte ajouté', JSON.stringify(f1.texte));
  t('lié puis ajouté : la mise en forme du texte ajouté suit', JSON.stringify(f1.slides[0].blocs[0].marques) === JSON.stringify([{ debut: 24, fin: 29, gras: true }]), JSON.stringify(f1.slides[0].blocs[0].marques));
  const e1 = L.appliquerEditionSource(f1, L.sourceDe(f1).replace('Second', 'Deuxième'));
  t('lié puis ajouté : le texte ajouté ne disparaît plus à la modification suivante', e1.slides[0].blocs[0].texte === 'Premier paragraphe ici. Texte ajouté', e1.slides[0].blocs[0].texte);
  const f2 = L.fusionnerPlusieurs(b, 0, [2, 0]);
  t('ajouté puis lié : le bloc reste lié à l’article', !!f2.slides[0].blocs[0].lien && f2.slides[0].blocs[0].texte === 'Texte ajouté Premier paragraphe ici.', JSON.stringify(f2.slides[0].blocs[0]));
  t('ajouté puis lié : l’apparence du premier bloc est gardée', f2.slides[0].blocs[0].style === 'emphase');
  const e2 = L.appliquerEditionSource(f2, L.sourceDe(f2).replace('Premier', 'Tout premier'));
  t('ajouté puis lié : modifier l’article met le bloc à jour', e2.slides[0].blocs[0].texte === 'Texte ajouté Tout premier paragraphe ici.', e2.slides[0].blocs[0].texte);
  t('aucun passage de l’article n’est oublié', L.passagesNonCouverts(e1).length === 0 && L.passagesNonCouverts(e2).length === 0);

  // 6. Deux-points après un chiffre suivis d'une espace : espace insécable ; les heures et rapports ne bougent pas.
  const corrige = (s) => T.appliquer(s, T.corrections(s));
  t('« En 2026: une année » est corrigé', corrige('En 2026: une année') === `En 2026${NB}: une année`, corrige('En 2026: une année'));
  t('les heures restent intactes', corrige('Rendez-vous à 14:30 ou 9:05.') === 'Rendez-vous à 14:30 ou 9:05.');
  t('les rapports restent intacts', corrige('Ratio 1:2') === 'Ratio 1:2');
  t('« 14: » en fin de texte : on attend la suite', corrige('14:') === '14:');
  let frappe = ''; for (const c of 'Étape 2: la suite à 14:30 !') frappe = T.corrigerSaisie(frappe, frappe + c).texte;
  t('à la frappe : corrigé en tapant l’espace, heure intacte', frappe === `Étape 2${NB}: la suite à 14:30${NB}!`, frappe);

  console.log(ok + ' / ' + (ok + ko) + ' vérifications réussies'); process.exit(ko ? 1 : 0);
})();
