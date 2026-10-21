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
    vocabulaire: 'Vocabulaire', repetition: 'Répétition', clarte: 'Clarté', style: 'Style',
  };
  const MAX_FORMULATIONS = 6; // la proposition principale et ses autres formulations
  const MAX_PROPOSITIONS = 30;

  const SYSTEME = [
    'Tu relis un article en français destiné à LinkedIn et Instagram. Tu proposes des corrections ; la personne qui l’a écrit décide de chacune.',
    '',
    'Ce que tu relèves :',
    '- orthographe, accords, conjugaison, grammaire ;',
    '- ponctuation (virgules, points), sauf la typographie décrite plus bas ;',
    '- vocabulaire impropre ou calqué sur l’anglais, répétitions gênantes ;',
    '- phrases peu claires, seulement si une reformulation courte les éclaircit vraiment ;',
    '- tournures qu’on peut rendre plus justes, plus précises ou plus vivantes, même si elles sont correctes (type « style »).',
    '',
    'Règles impératives :',
    '1. Ne change jamais le sens. Ne renforce ni n’affaiblis une affirmation. N’ajoute aucun fait.',
    '2. Respecte la voix de l’auteur : tutoiement ou vouvoiement, ton, phrases courtes, mots familiers choisis exprès. Un style oral volontaire n’est pas une faute.',
    '3. Les paroles rapportées entre guillemets sont citées telles qu’elles ont été dites : leur oralité (« je sais plus », « c’est pas juste », « y’a pire ») est voulue. N’y corrige qu’une faute d’orthographe évidente, et signale-le en point de vigilance.',
    '4. Dans « alternatives », donne 2 ou 3 autres formulations du même passage (synonymes, tournures différentes), chacune pouvant remplacer « avant » telle quelle. Pour une simple faute d’orthographe, d’accord ou de conjugaison, laisse « alternatives » vide.',
    '5. Ignore la typographie : espaces insécables, forme des guillemets et des apostrophes, points de suspension. Elle est corrigée automatiquement.',
    '6. Chaque proposition porte sur un passage court, au plus une phrase, à l’intérieur d’un seul paragraphe.',
    '7. « avant » est copié du texte à l’identique, caractère pour caractère. « phrase » est la phrase entière qui le contient, copiée à l’identique.',
    '8. « vigilance » est rempli quand la proposition peut modifier une nuance, le ton ou le sens ; sinon, chaîne vide.',
    '9. Si le texte est correct, renvoie une liste vide. Au plus ' + MAX_PROPOSITIONS + ' propositions, dans l’ordre du texte.',
    '',
    'Réponds uniquement avec un objet JSON, sans aucun texte autour :',
    '{"propositions":[{"type":"orthographe|grammaire|conjugaison|ponctuation|vocabulaire|repetition|clarte|style","avant":"…","apres":"…","alternatives":["…","…"],"phrase":"…","pourquoi":"une phrase courte","vigilance":""}]}',
  ].join('\n');

  const consigne = (texte) => 'Voici l’article à relire, entre les balises <article> et </article> :\n<article>\n' + texte + '\n</article>';

  /* ---------- Lire la réponse ---------- */

  /* ---------- Lire une réponse de l'IA même quand elle ajoute du texte, des balises ou répète son JSON ---------- */
  function extraireObjets(brut) {
    const t = String(brut || '');
    const objets = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== '{') continue;
      let prof = 0;
      let chaine = false;
      let echap = false;
      for (let j = i; j < t.length; j++) {
        const c = t[j];
        if (chaine) { if (echap) echap = false; else if (c === '\\') echap = true; else if (c === '"') chaine = false; continue; }
        if (c === '"') chaine = true;
        else if (c === '{') prof++;
        else if (c === '}' && --prof === 0) {
          try { objets.push(JSON.parse(t.slice(i, j + 1))); i = j; } catch (e) { /* objet mal formé : on cherche plus loin */ }
          break;
        }
      }
    }
    return objets;
  }
  const premierObjet = (brut, forme) => extraireObjets(brut).find((o) => o && typeof o === 'object' && forme(o)) || null;

  function lireReponse(brut) {
    const objet = premierObjet(brut, (o) => Array.isArray(o.propositions));
    if (objet) return objet.propositions;
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
        formulations: formulationsDe(apres, p.alternatives, source.slice(debut, fin)),
        choix: 0,
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

  /* ---------- Descriptions de publication (légende Instagram, texte LinkedIn) ---------- */
  const RESEAUX = {
    instagram: { nom: 'Instagram', limite: 2200, regles: 'La première ligne doit donner envie de lire la suite : seules les premières lignes s’affichent avant « plus ». Puis 3 à 6 phrases courtes, une question qui invite à réagir, et 3 à 5 hashtags pertinents à la toute fin. Vise 600 à 1 200 caractères.' },
    linkedin: { nom: 'LinkedIn', limite: 3000, regles: 'La première ligne doit donner envie d’ouvrir le carrousel : seules les premières lignes s’affichent avant « voir plus ». Puis 4 à 8 lignes courtes et aérées, une invitation à parcourir le carrousel et une question qui invite à réagir. Au plus 3 hashtags, à la fin. Vise 600 à 1 300 caractères.' },
  };
  function consigneDescription(reseau) {
    const r = RESEAUX[reseau];
    return [
      'Tu écris le texte qui accompagne un carrousel publié sur ' + r.nom + '. Le carrousel reprend l’article fourni.',
      '',
      'Règles impératives :',
      '1. Écris en français, avec la voix de l’article : même personne (je, nous), même ton, phrases courtes.',
      '2. N’invente rien : aucun fait, chiffre, prénom, résultat ou citation qui ne soit dans l’article. Ne renforce aucune affirmation.',
      '3. Ne recopie pas l’article : donne envie de le lire dans le carrousel.',
      '4. ' + r.regles,
      '5. Pas d’émoji, pas de titre, pas de guillemets autour de ta réponse.',
      '',
      'Réponds uniquement avec le texte de la description, prêt à être copié.',
    ].join('\n');
  }
  // Nettoie la réponse (guillemets ou balises éventuels) ; la typographie française est appliquée ensuite.
  function nettoyerDescription(brut) {
    let t = String(brut || '').trim().replace(/^```[a-z]*\s*|```$/gi, '').trim();
    if (/^["«“]/.test(t) && /["»”]$/.test(t)) t = t.slice(1, -1).trim();
    return t;
  }

  /* ---------- Suggestions sur un passage choisi ---------- */
  const ACTIONS = {
    clarifier: { libelle: 'Clarifier', consigne: 'Rends le passage plus clair et plus facile à lire, sans l’allonger.' },
    raccourcir: { libelle: 'Raccourcir', consigne: 'Raccourcis le passage d’environ un tiers en gardant toutes les idées importantes.' },
    restructurer: { libelle: 'Restructurer', consigne: 'Réorganise le passage pour un enchaînement plus logique : ordre des idées, des phrases, des paragraphes.' },
    percutant: { libelle: 'Plus percutant', consigne: 'Rends le passage plus percutant : attaque plus directe, rythme plus vif, sans exagérer ni durcir le propos.' },
  };
  const MAX_PASSAGE = 1500;
  function consigneSuggestion(action) {
    return [
      'Tu aides à retravailler un passage d’un article en français destiné à LinkedIn et Instagram. On te donne l’article complet, pour le contexte, et le passage à retravailler.',
      'Demande : ' + ACTIONS[action].consigne,
      '',
      'Règles impératives :',
      '1. Ne change jamais le sens. Ne renforce ni n’affaiblis une affirmation. N’ajoute aucun fait.',
      '2. Garde la voix de l’auteur : même personne, même ton, mots familiers voulus.',
      '3. Les paroles rapportées entre guillemets restent mot pour mot : ne les reformule pas.',
      '4. Ignore la typographie (espaces insécables, forme des guillemets et des apostrophes) : elle est corrigée automatiquement.',
      '5. Ne réécris que le passage, rien d’autre. Garde ses retours à la ligne s’ils séparent des paragraphes.',
      '6. « vigilance » signale ce qui pourrait faire bouger une nuance, le ton ou le sens ; sinon, chaîne vide.',
      '',
      'Réponds uniquement avec un objet JSON, sans aucun texte autour :',
      '{"proposition":"…","pourquoi":"une phrase courte","vigilance":""}',
    ].join('\n');
  }
  const consigneSuggestionTexte = (article, passage) => consigne(article) + '\n\nPassage à retravailler, entre les balises <passage> et </passage> :\n<passage>\n' + passage + '\n</passage>';
  function lireSuggestion(brut, passage) {
    const donnees = premierObjet(brut, (o) => typeof o.proposition === 'string');
    if (!donnees) throw new Error('La réponse de l’IA est illisible. Réessaie.');
    const proposition = donnees.proposition.trim();
    if (!proposition || proposition === passage.trim()) throw new Error('L’IA n’a rien proposé de différent pour ce passage.');
    return { proposition, pourquoi: typeof donnees.pourquoi === 'string' ? donnees.pourquoi.trim() : '', vigilance: typeof donnees.vigilance === 'string' ? donnees.vigilance.trim() : '' };
  }

  /* ---------- Discussion avec l'IA (consignes en langage naturel, plusieurs propositions) ---------- */
  const MAX_HISTORIQUE = 12;
  const MAX_PROPOSITIONS_DISCUSSION = 5;
  const SYSTEME_DISCUSSION = [
    'Tu es le partenaire d’écriture de la personne qui a écrit cet article, en français, publié en carrousel sur LinkedIn ou Instagram. Tu discutes avec elle comme un éditeur expérimenté et bienveillant : tu réponds à ses questions, tu la conseilles, tu l’aiguilles, tu lui proposes des formulations, des styles et des tournures.',
    '',
    'Comment tu travailles :',
    '- Lis tout l’article avant de répondre : son sujet, sa structure (accroche, récit, déclic, morale…), son ton, son public, et la place du passage choisi dans l’ensemble (ce qui le précède et ce qui le suit). Appuie chaque conseil sur ce contexte : cohérence du registre avec le reste du texte, répétitions avec d’autres paragraphes, transitions, rythme, effet recherché sur le lecteur.',
    '- Tiens compte du profil éditorial s’il est fourni : public, ton, valeurs.',
    '- Sois concret : cite les mots en question et explique en une phrase pourquoi une tournure fonctionne mieux.',
    '- Donne ton avis franchement : dis quand le texte est déjà bon, et préviens quand une demande risque d’affaiblir le propos (registre décalé pour le public, nuance perdue), tout en proposant ce qui est demandé.',
    '- Si la demande est floue, propose une première piste et pose une question pour affiner.',
    '- Propose des formulations dès qu’elles aident, même sans demande explicite ; si on t’en demande plusieurs, donne-en autant (au plus ' + MAX_PROPOSITIONS_DISCUSSION + '), vraiment différentes entre elles.',
    '- Termine en proposant 2 ou 3 suites utiles dans « pistes », formulées comme de courtes demandes que la personne pourrait t’envoyer.',
    '',
    'Règles impératives :',
    '1. Ne change jamais le sens sans le signaler. Ne renforce ni n’affaiblis une affirmation en silence. N’ajoute aucun fait.',
    '2. Garde la voix de l’auteur, sauf si on te demande explicitement un autre registre.',
    '3. Les paroles rapportées entre guillemets restent mot pour mot, sauf demande explicite.',
    '4. Ignore la typographie (espaces insécables, forme des guillemets et des apostrophes) : elle est corrigée automatiquement.',
    '5. Chaque proposition remplace un passage du texte : « avant » est copié du texte à l’identique, caractère pour caractère ; « apres » est le nouveau texte.',
    '6. « vigilance » signale ce qui fait bouger une nuance, le ton ou le sens ; sinon, chaîne vide.',
    '6 bis. Chaque proposition a un « titre » de 2 à 5 mots qui dit l’effet qu’elle apporte (par exemple « Plus direct », « Ton plus chaleureux », « Rythme plus vif »), sans répéter le texte proposé ; deux propositions d’une même réponse n’ont jamais le même titre.',
    '7. « reponse » tutoie la personne, en 2 à 8 phrases ; tu peux aller à la ligne.',
    '8. N’écris rien d’autre que cet objet JSON, une seule fois : ni balise, ni bloc de code, ni commentaire, ni excuse.',
    '',
    'Format :',
    '{"reponse":"…","propositions":[{"titre":"2 à 5 mots","avant":"…","apres":"…","pourquoi":"une phrase courte","vigilance":""}],"pistes":["…","…"]}',
  ].join('\n');
  // L'article numéroté par paragraphe, avec l'endroit du passage choisi, pour que l'IA comprenne le contexte.
  function messageDiscussion(article, passage, historique, demande, infos = {}) {
    const paras = String(article || '').split(/\n\s*\n/);
    const ou = passage ? paras.findIndex((p) => p.includes(passage.split('\n')[0].trim().slice(0, 60))) : -1;
    const numerote = paras.map((p, i) => `[${i + 1}]${i === ou ? ' ← le passage choisi est dans ce paragraphe' : ''}\n${p}`).join('\n\n');
    const fil = (historique || []).slice(-MAX_HISTORIQUE).map((m) => (m.de === 'moi' ? 'Personne : ' : 'Toi : ') + m.texte + ((m.propositions || []).length ? ' [propositions : ' + m.propositions.map((p) => (p.titre ? p.titre + ' : ' : '') + '« ' + p.apres + ' »').join(' ; ') + ']' : '')).join('\n');
    return [
      infos.profil ? 'Profil éditorial de la personne :\n' + infos.profil + '\n' : '',
      `Article${infos.titre ? ' « ' + infos.titre + ' »' : ''}${infos.reseau ? ', publié sur ' + infos.reseau : ''} (${paras.length} paragraphes), entre les balises <article> et </article> :`,
      '<article>\n' + numerote + '\n</article>',
      passage ? '\nPassage choisi' + (ou >= 0 ? ` (paragraphe ${ou + 1} sur ${paras.length})` : '') + ', entre les balises <passage> et </passage> :\n<passage>\n' + passage + '\n</passage>' : '\nAucun passage n’est choisi : la personne parle de l’article en général ou désigne un passage dans sa demande.',
      fil ? '\nDébut de la conversation :\n' + fil : '',
      '\nNouvelle demande de la personne :\n' + demande,
    ].filter(Boolean).join('\n');
  }
  function lireDiscussion(brut) {
    const donnees = premierObjet(brut, (o) => typeof o.reponse === 'string' || Array.isArray(o.propositions));
    if (!donnees) {
      const simple = String(brut || '').trim();
      if (!simple) throw new Error('La réponse de l’IA est vide. Réessaie.');
      // Un texte simple, sans JSON, est une vraie réponse ; un JSON abîmé ne s'affiche jamais tel quel.
      if (/[{}<>]/.test(simple)) return { reponse: 'Ma réponse était mal formée et je n’ai pas pu la lire. Renvoie ta demande, ou reformule-la.', propositions: [], illisible: true };
      return { reponse: simple, propositions: [] };
    }
    const propositions = (Array.isArray(donnees.propositions) ? donnees.propositions : [])
      .filter((p) => p && typeof p.apres === 'string' && p.apres.trim())
      .slice(0, MAX_PROPOSITIONS_DISCUSSION)
      .map((p) => ({ titre: typeof p.titre === 'string' ? p.titre.trim().replace(/^["«“\s]+|["»”\s.]+$/g, '').slice(0, 60) : '', avant: typeof p.avant === 'string' ? p.avant.trim() : '', apres: p.apres.trim(), pourquoi: typeof p.pourquoi === 'string' ? p.pourquoi.trim() : '', vigilance: typeof p.vigilance === 'string' ? p.vigilance.trim() : '' }));
    const pistes = (Array.isArray(donnees.pistes) ? donnees.pistes : []).filter((x) => typeof x === 'string' && x.trim() && x.length <= 120).map((x) => x.trim()).slice(0, 3);
    return { reponse: typeof donnees.reponse === 'string' && donnees.reponse.trim() ? donnees.reponse.trim() : (propositions.length ? 'Voici ce que je te propose.' : 'Je n’ai rien à proposer.'), propositions, pistes };
  }
  // Où se trouve un passage dans le texte : de préférence dans le passage choisi, sinon une seule occurrence dans tout le texte.
  function placerPassage(source, cherche, zone) {
    if (!cherche) return null;
    if (zone) { const dedans = trouver(source, cherche, zone.debut, zone.fin); if (dedans.length) return dedans[0]; }
    const partout = trouver(source, cherche);
    return partout.length === 1 ? partout[0] : null;
  }

  /* ---------- Formulations : la proposition principale et ses variantes (synonymes, autres tournures) ---------- */
  function formulationsDe(apres, alternatives, avant, deja = []) {
    const vues = new Set(deja.map((x) => simplifier(x).texte).concat([simplifier(avant).texte]));
    const liste = deja.slice();
    [apres].concat(Array.isArray(alternatives) ? alternatives : []).forEach((x) => {
      if (typeof x !== 'string' || !x.trim()) return;
      const cle = simplifier(x.trim()).texte;
      if (vues.has(cle) && !(liste.length === 0 && x === apres)) return;
      vues.add(cle);
      liste.push(x.trim());
    });
    return liste.slice(0, MAX_FORMULATIONS);
  }
  const SYSTEME_FORMULATIONS = [
    'Tu proposes d’autres formulations pour un passage d’un article en français destiné à LinkedIn et Instagram.',
    'Règles : garde le sens exact, sans renforcer ni affaiblir ; garde la voix de l’auteur ; chaque formulation doit pouvoir remplacer le passage telle quelle dans sa phrase ; elles doivent être différentes de celles déjà proposées et différentes entre elles (synonymes, tournures, images).',
    'Réponds uniquement avec un objet JSON, sans aucun texte autour : {"formulations":["…","…","…"]}',
  ].join('\n');
  const messageFormulations = (article, phrase, passage, deja) => consigne(article)
    + '\n\nPhrase concernée :\n' + phrase + '\n\nPassage à reformuler :\n<passage>' + passage + '</passage>'
    + '\n\nDéjà proposées (à ne pas répéter) :\n' + deja.map((x) => '- ' + x).join('\n') + '\n\nPropose 3 nouvelles formulations.';
  function lireFormulations(brut) {
    const donnees = premierObjet(brut, (o) => Array.isArray(o.formulations));
    if (!donnees) throw new Error('La réponse de l’IA est illisible. Réessaie.');
    return donnees.formulations.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  }

  const api = { extraireObjets, premierObjet, formulationsDe, SYSTEME_FORMULATIONS, messageFormulations, lireFormulations, MAX_FORMULATIONS, SYSTEME_DISCUSSION, messageDiscussion, lireDiscussion, placerPassage, MAX_HISTORIQUE, ACTIONS, MAX_PASSAGE, consigneSuggestion, consigneSuggestionTexte, lireSuggestion, RESEAUX, consigneDescription, nettoyerDescription, SYSTEME, consigne, lireReponse, simplifier, trouver, localiser, appliquer, apercu, recaler, TYPES, MAX_PROPOSITIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPRelecture = api;
})(typeof window !== 'undefined' ? window : globalThis);
