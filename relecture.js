/*
 * PostsOP — Relecture par l'IA (phase 4 ; décisions du 19 octobre 2026)
 *
 * L'IA (Claude par défaut) relit tout l'article : orthographe, grammaire, ponctuation, vocabulaire, clarté.
 * Elle propose, la personne décide de chaque proposition (Accepter, Modifier, Refuser, puis Annuler).
 * La typographie (espaces insécables, guillemets, apostrophes, points de suspension) reste à la correction
 * automatique : l'IA ne la propose pas, et toute modification acceptée passe par cette correction.
 *
 * Garde-fou principal : une proposition dont le passage « avant » ne se retrouve pas exactement dans le texte
 * est écartée. L'IA ne peut donc rien modifier qu'on ne puisse montrer à l'endroit précis du texte.
 */
(function (racine) {
  'use strict';

  const T = racine.PostsOPTypographie || (typeof require !== 'undefined' ? require('./typographie.js') : null);

  const TYPES = {
    orthographe: 'Orthographe', grammaire: 'Grammaire', conjugaison: 'Conjugaison', ponctuation: 'Ponctuation',
    vocabulaire: 'Vocabulaire', repetition: 'Répétition', clarte: 'Clarté',
  };
  const MAX_PROPOSITIONS = 30;

  const SYSTEME = [
    'Tu relis un article en français destiné à LinkedIn et Instagram. Tu proposes des corrections ; la personne qui l’a écrit décide de chacune.',
    '',
    'Ce que tu relèves :',
    '- orthographe, accords, conjugaison, grammaire ;',
    '- ponctuation (virgules, points), sauf la typographie décrite plus bas ;',
    '- vocabulaire impropre ou calqué sur l’anglais, répétitions gênantes ;',
    '- phrases peu claires, seulement si une reformulation courte les éclaircit vraiment.',
    '',
    'Règles impératives :',
    '1. Ne change jamais le sens. Ne renforce ni n’affaiblis une affirmation. N’ajoute aucun fait.',
    '2. Respecte la voix de l’auteur : tutoiement ou vouvoiement, ton, phrases courtes, style oral volontaire.',
    '3. Dans une citation entre guillemets, ne corrige qu’une faute évidente, et signale-le en point de vigilance.',
    '4. Ignore la typographie : espaces insécables, forme des guillemets et des apostrophes, points de suspension. Elle est corrigée automatiquement.',
    '5. Chaque proposition porte sur un passage court, au plus une phrase, à l’intérieur d’un seul paragraphe.',
    '6. « avant » est copié du texte à l’identique, caractère pour caractère. « phrase » est la phrase entière qui le contient, copiée à l’identique.',
    '7. « vigilance » est rempli quand la proposition peut modifier une nuance, le ton ou le sens ; sinon, chaîne vide.',
    '8. Si le texte est correct, renvoie une liste vide. Au plus ' + MAX_PROPOSITIONS + ' propositions, dans l’ordre du texte.',
    '',
    'Réponds uniquement avec un objet JSON, sans aucun texte autour :',
    '{"propositions":[{"type":"orthographe|grammaire|conjugaison|ponctuation|vocabulaire|repetition|clarte","avant":"…","apres":"…","phrase":"…","pourquoi":"une phrase courte","vigilance":""}]}',
  ].join('\n');

  const consigne = (texte) => 'Voici l’article à relire, entre les balises <article> et </article> :\n<article>\n' + texte + '\n</article>';

  /* ---------- Lire la réponse ---------- */

  function lireReponse(brut) {
    const t = String(brut || '').replace(/```(?:json)?/gi, '');
    const debut = t.indexOf('{');
    const fin = t.lastIndexOf('}');
    if (debut < 0 || fin <= debut) throw new Error('La réponse de l’IA est illisible. Réessaie.');
    let donnees;
    try { donnees = JSON.parse(t.slice(debut, fin + 1)); } catch (e) { throw new Error('La réponse de l’IA est illisible. Réessaie.'); }
    const liste = Array.isArray(donnees) ? donnees : donnees.propositions;
    if (!Array.isArray(liste)) throw new Error('La réponse de l’IA est illisible. Réessaie.');
    return liste;
  }

  /* ---------- Retrouver un passage dans le texte, malgré les petites différences de copie ---------- */
  // L'IA recopie parfois une espace insécable en espace normale, une apostrophe courbe en droite, « … » en "...".
  // On compare donc des versions simplifiées, sans aucune espace, en gardant pour chaque caractère sa position d'origine.

  const UNIFIER = { '’': "'", '‘': "'", '«': '"', '»': '"', '“': '"', '”': '"' };
  function simplifier(t, decalage = 0) {
    let texte = '';
    const index = [];
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (/\s/.test(c)) continue;
      if (c === '…') { texte += '...'; index.push(k + decalage, k + decalage, k + decalage); continue; }
      texte += UNIFIER[c] || c;
      index.push(k + decalage);
    }
    return { texte, index };
  }

  // Toutes les positions [debut, fin[ du texte d'origine où « cherche » apparaît (entre debut et fin si donnés).
  function trouver(source, cherche, debut = 0, fin = source.length) {
    const s = simplifier(source.slice(debut, fin), debut);
    const c = simplifier(cherche).texte;
    if (!c) return [];
    const trouves = [];
    let k = s.texte.indexOf(c);
    while (k >= 0) {
      trouves.push([s.index[k], s.index[k + c.length - 1] + 1]);
      k = s.texte.indexOf(c, k + 1);
    }
    return trouves;
  }

  const raccourcir = (t, longueur, auDebut) => {
    if (t.length <= longueur) return t;
    return auDebut ? '…' + t.slice(t.length - longueur).replace(/^\S*\s/, '') : t.slice(0, longueur).replace(/\s\S*$/, '') + '…';
  };

  // Place chaque proposition dans le texte. Renvoie les propositions retenues (dans l'ordre du texte) et le nombre écarté.
  function localiser(source, liste) {
    const retenues = [];
    let ecartees = 0;
    (liste || []).slice(0, MAX_PROPOSITIONS * 2).forEach((p) => {
      const avant = typeof p.avant === 'string' ? p.avant.trim() : '';
      const apres = typeof p.apres === 'string' ? p.apres.trim() : '';
      if (!avant || avant === apres || typeof p.apres !== 'string') { ecartees++; return; }
      const phrase = typeof p.phrase === 'string' && p.phrase.trim() ? p.phrase.trim() : avant;
      let place = null;
      for (const [pd, pf] of trouver(source, phrase)) {
        const dedans = trouver(source, avant, pd, pf).find(([d, f]) => !retenues.some((r) => d < r.fin && f > r.debut));
        if (dedans) { place = { passage: dedans, phrase: [pd, pf] }; break; }
      }
      if (!place) {
        const seules = trouver(source, avant);
        if (seules.length === 1) place = { passage: seules[0], phrase: seules[0] };
      }
      if (!place) { ecartees++; return; }
      const [debut, fin] = place.passage;
      if (source.slice(debut, fin).includes('\n') || retenues.some((r) => debut < r.fin && fin > r.debut)) { ecartees++; return; }
      const [pd, pf] = place.phrase;
      retenues.push({
        type: TYPES[String(p.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || 'Correction',
        avant: source.slice(debut, fin),
        apres,
        debut, fin,
        contexteAvant: raccourcir(source.slice(Math.min(pd, debut), debut), 60, true),
        contexteApres: raccourcir(source.slice(fin, Math.max(pf, fin)), 60, false),
        pourquoi: typeof p.pourquoi === 'string' ? p.pourquoi.trim() : '',
        vigilance: typeof p.vigilance === 'string' ? p.vigilance.trim() : '',
      });
    });
    retenues.sort((a, b) => a.debut - b.debut);
    return { retenues: retenues.slice(0, MAX_PROPOSITIONS).map((r, i) => ({ ...r, id: 'r' + (i + 1) })), ecartees };
  }

  /* ---------- Appliquer, annuler, suivre les modifications du texte ---------- */

  // Le texte complet après le remplacement de [debut, fin[ par « texte », typographie française comprise,
  // et la place exacte de ce qui a été inséré (pour pouvoir l'annuler).
  function appliquer(source, debut, fin, texte) {
    const brut = source.slice(0, debut) + texte + source.slice(fin);
    const r = T ? T.corrigerSaisie(source, brut, { curseur: 0, zone: [debut, debut + texte.length] }) : { texte: brut };
    const longueur = Math.max(0, texte.length + (r.texte.length - brut.length));
    return { texte: r.texte, debut, longueur, insere: r.texte.slice(debut, debut + longueur) };
  }

  // Ce qui s'affichera après acceptation (typographie comprise).
  const apercu = (source, p) => appliquer(source, p.debut, p.fin, p.apres).insere;

  // Le texte a changé (frappe, proposition acceptée, annulation…) : on recale chaque proposition.
  // Une proposition dont le passage a été touché n'est plus juste : en attente ou refusée, elle disparaît ;
  // acceptée ou modifiée, elle reste mais ne peut plus être annulée.
  function recaler(ancienne, nouvelle, propositions) {
    if (ancienne === nouvelle) return propositions;
    const L1 = ancienne.length;
    const N = nouvelle.length;
    let a = 0;
    while (a < L1 && a < N && ancienne[a] === nouvelle[a]) a++;
    let b = 0;
    while (b < L1 - a && b < N - a && ancienne[L1 - 1 - b] === nouvelle[N - 1 - b]) b++;
    const finAncien = L1 - b;
    const decalage = N - L1;
    const sortie = [];
    for (const p of propositions) {
      const appliquee = p.statut === 'acceptee' || p.statut === 'modifiee';
      const d = appliquee ? p.applique.debut : p.debut;
      const f = appliquee ? p.applique.debut + p.applique.longueur : p.fin;
      if (f <= a) { sortie.push(p); continue; }
      if (d >= finAncien) {
        if (appliquee) sortie.push({ ...p, applique: { ...p.applique, debut: p.applique.debut + decalage } });
        else sortie.push({ ...p, debut: p.debut + decalage, fin: p.fin + decalage });
        continue;
      }
      if (appliquee) sortie.push({ ...p, applique: { ...p.applique, perdu: true } });
    }
    return sortie;
  }

  const api = { SYSTEME, consigne, lireReponse, simplifier, trouver, localiser, appliquer, apercu, recaler, TYPES, MAX_PROPOSITIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPRelecture = api;
})(typeof window !== 'undefined' ? window : globalThis);
