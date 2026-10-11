/*
 * Oh ! Potentiel ContentsHelper — Phase 0 : banc d'essai technique
 *
 * Ce fichier n'est PAS l'application finale. Il vérifie sur ton iPad que :
 *   1. tes polices se lisent et se dessinent correctement ;
 *   2. l'aperçu, le PNG et le PDF sortent identiques (même calcul pour les trois) ;
 *   3. LanguageTool et Mistral répondent depuis une app web ;
 *   4. le stockage local tient et l'installation sur l'écran d'accueil fonctionne.
 *
 * Bibliothèques utilisées :
 *   - opentype.js 1.3.4 (lecture des polices, contours des lettres) — chargée depuis jsDelivr ;
 *   - pdf-lib 1.17.1 (création du PDF) — fichier pdf-lib.min.js à côté de celui-ci.
 */
'use strict';

/* ------------------------------------------------------------------ */
/* 1. Réglages relevés sur tes carrousels (mesures ramenées à 1080 px) */
/* ------------------------------------------------------------------ */

const COULEURS = {
  bleu: { mesure: '#293D56', fourni: '#003846' }, // mesuré dans tes fichiers / valeur RVB que tu m'as donnée
  vert: { texte: '#D5E22A', logo: '#C9D420' },    // vert du texte des carrousels / vert du logo et des fleurs
  blanc: '#FFFFFF',
};

const FORMATS = {
  carre: { l: 1080, h: 1080 },    // format de tes carrousels actuels
  portrait: { l: 1080, h: 1350 }, // format 4:5, plus haut dans le fil Instagram
};

// Marges en pixels pour une slide de 1080 px de large.
const MISE_EN_PAGE = { margeGauche: 81, margeDroite: 162, margeHaute: 110, margeBasse: 110 };

// role = quelle police utiliser ; espaceApres = blanc après le paragraphe, en nombre de lignes.
const STYLES = {
  couverture: { role: 'bold', taille: 93, interligne: 1.27, espaceApres: 0 },
  corps: { role: 'light', taille: 34, interligne: 1.4, espaceApres: 1 },
  emphase: { role: 'bold', taille: 34, interligne: 1.4, espaceApres: 1 },
};

const ESPACE_INSECABLE = '\u00A0';

// Deux slides de test reprises de ton carrousel « Clara ».
// « \n » = retour à la ligne voulu ; le reste est coupé automatiquement.
const SLIDES = {
  couverture: {
    alignement: 'centre',
    blocs: [
      { style: 'couverture', couleur: 'blanc', texte: 'Je crois que\nje vais\ndémissionner.' },
      { style: 'couverture', couleur: 'vert', texte: 'Pourtant,\nj’adore mon\ntravail.' },
    ],
  },
  texte: {
    alignement: 'haut',
    blocs: [
      { style: 'corps', couleur: 'blanc', texte: 'C’est ce que me confie Clara, 32 ans, lors de notre première séance.' },
      { style: 'corps', couleur: 'blanc', texte: 'Depuis quelques mois, son manager ne lui parle presque plus.' },
      { style: 'corps', couleur: 'blanc', texte: 'Pas de conflit ouvert, pas de reproches. Juste des mails de plus en plus froids, des réunions auxquelles elle n’est plus conviée et des décisions qu’elle découvre après tout le monde.' },
      { style: 'emphase', couleur: 'blanc', texte: 'Et là, surprise.' },
      { style: 'corps', couleur: 'vert', texte: '«' + ESPACE_INSECABLE + 'Le pire, c’est que je ne sais même pas ce que j’ai fait de mal.' + ESPACE_INSECABLE + '»' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* 2. Moteur de composition (aucune dépendance au navigateur)          */
/* ------------------------------------------------------------------ */

// Largeur d'un texte, crénage compris.
function mesurer(font, texte, taille) {
  return font.getAdvanceWidth(texte, taille, { kerning: true });
}

// Coupe un paragraphe en lignes qui tiennent dans largeurMax.
// On ne coupe que sur les espaces ordinaires : les espaces insécables restent collés.
function couperLignes(font, texte, taille, largeurMax) {
  const lignes = [];
  for (const ligneImposee of texte.split('\n')) {
    let courante = '';
    for (const mot of ligneImposee.split(' ')) {
      const essai = courante ? courante + ' ' + mot : mot;
      if (!courante || mesurer(font, essai, taille) <= largeurMax) {
        courante = essai;
      } else {
        lignes.push(courante);
        courante = mot;
      }
    }
    lignes.push(courante);
  }
  return lignes;
}

// Calcule la position de chaque ligne d'une slide. Le même résultat sert
// à l'aperçu, au PNG et au PDF : c'est ce qui garantit qu'ils sont identiques.
function composer(slide, fmt, choisirPolice) {
  const largeurColonne = fmt.l - MISE_EN_PAGE.margeGauche - MISE_EN_PAGE.margeDroite;
  const lignes = [];
  let y = 0;
  let tropLarge = false;

  slide.blocs.forEach((bloc, i) => {
    const style = STYLES[bloc.style];
    const font = choisirPolice(style.role);
    const hauteurLigne = style.taille * style.interligne;
    const ascendante = (font.ascender / font.unitsPerEm) * style.taille;
    const descendante = (-font.descender / font.unitsPerEm) * style.taille;
    const ligneDeBase = (hauteurLigne - (ascendante + descendante)) / 2 + ascendante;

    for (const texte of couperLignes(font, bloc.texte, style.taille, largeurColonne)) {
      const largeur = mesurer(font, texte, style.taille);
      if (largeur > largeurColonne + 0.5) tropLarge = true;
      lignes.push({
        texte,
        x: MISE_EN_PAGE.margeGauche,
        yBase: y + ligneDeBase,
        font,
        taille: style.taille,
        couleur: bloc.couleur,
        largeur,
      });
      y += hauteurLigne;
    }
    if (i < slide.blocs.length - 1) y += style.espaceApres * hauteurLigne;
  });

  const hauteur = y;
  const y0 = slide.alignement === 'centre' ? (fmt.h - hauteur) / 2 : MISE_EN_PAGE.margeHaute;
  for (const ligne of lignes) ligne.yBase += y0;

  const deborde = tropLarge
    || y0 < MISE_EN_PAGE.margeHaute - 0.5
    || y0 + hauteur > fmt.h - MISE_EN_PAGE.margeBasse + 0.5;

  return { fmt, lignes, hauteur, y0, deborde, tropLarge, largeurColonne };
}

// Caractères du texte absents de la police (ils s'afficheraient en carré vide).
function glyphesManquants(font, texte) {
  const manquants = new Set();
  for (const caractere of texte) {
    if (caractere === '\n' || caractere === ' ') continue;
    if (font.charToGlyphIndex(caractere) === 0) manquants.add(caractere);
  }
  return [...manquants];
}

function hexVersComposantes(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Exporté pour les tests automatiques (sans effet dans le navigateur).
if (typeof module !== 'undefined') {
  module.exports = { couperLignes, composer, glyphesManquants, hexVersComposantes, SLIDES, FORMATS, STYLES, MISE_EN_PAGE, COULEURS };
}

/* ------------------------------------------------------------------ */
/* 3. Application (navigateur uniquement)                             */
/* ------------------------------------------------------------------ */

if (typeof document !== 'undefined') {
  const etat = {
    polices: { light: null, bold: null },
    nomsPolices: { light: '', bold: '' },
    slide: 'couverture',
    format: 'carre',
    bleu: 'mesure',
    vert: 'texte',
    fichierPret: null,
    resultats: {},
  };

  const $ = (id) => document.getElementById(id);

  const LIBELLES = {
    bibliotheques: 'Bibliothèques chargées',
    polices: 'Polices lues',
    rendu: 'Aperçu = export',
    png: 'Export PNG',
    pdf: 'Export PDF',
    partage: 'Partage du fichier',
    languagetool: 'LanguageTool',
    mistral: 'Mistral',
    stockage: 'Stockage local',
    installation: 'Mode écran d’accueil',
  };

  /* ---------- Affichage des résultats ---------- */

  function noter(cle, ok, detail) {
    etat.resultats[cle] = { ok, detail, quand: new Date() };
    const el = $('st-' + cle);
    if (el) {
      el.textContent = (ok === null ? '… ' : ok ? '✓ ' : '✗ ') + detail;
      el.className = 'statut ' + (ok === null ? 'attente' : ok ? 'ok' : 'erreur');
    }
    majRapport();
  }

  function majRapport() {
    const lignes = [
      'Rapport Phase 0 — ' + new Date().toLocaleString('fr-FR'),
      'Appareil : ' + navigator.userAgent,
      '',
    ];
    for (const [cle, libelle] of Object.entries(LIBELLES)) {
      const r = etat.resultats[cle];
      const marque = !r ? '–' : r.ok === null ? '…' : r.ok ? 'OK' : 'ÉCHEC';
      lignes.push(`${libelle} : ${marque}${r ? ' — ' + r.detail : ''}`);
    }
    $('rapport').value = lignes.join('\n');
  }

  /* ---------- Stockage (IndexedDB) ---------- */

  function ouvrirBase() {
    return new Promise((resoudre, rejeter) => {
      const requete = indexedDB.open('contentshelper-phase0', 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore('kv');
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
  }

  async function lire(cle) {
    const base = await ouvrirBase();
    return new Promise((resoudre, rejeter) => {
      const requete = base.transaction('kv').objectStore('kv').get(cle);
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
  }

  async function ecrire(cle, valeur) {
    const base = await ouvrirBase();
    return new Promise((resoudre, rejeter) => {
      const transaction = base.transaction('kv', 'readwrite');
      transaction.objectStore('kv').put(valeur, cle);
      transaction.oncomplete = () => resoudre();
      transaction.onerror = () => rejeter(transaction.error);
    });
  }

  /* ---------- Polices ---------- */

  function choisirPolice(role) {
    return etat.polices[role] || etat.polices.light || etat.polices.bold;
  }

  function lirePolice(octets) {
    try {
      return opentype.parse(octets);
    } catch (erreur) {
      const message = String(erreur && erreur.message || erreur);
      if (/wOF2/i.test(message)) throw new Error('format WOFF2 non pris en charge : utilise un fichier .ttf ou .otf');
      throw new Error('fichier illisible (' + message + ')');
    }
  }

  async function installerPolice(role, octets, nom, memoriser) {
    const font = lirePolice(octets);
    etat.polices[role] = font;
    etat.nomsPolices[role] = nom;
    if (memoriser) await ecrire('police-' + role, { nom, octets });
    verifierPolices();
    redessiner();
  }

  function verifierPolices() {
    const roles = ['light', 'bold'].filter((r) => etat.polices[r]);
    if (!roles.length) {
      noter('polices', false, 'aucune police chargée');
      return;
    }
    const tousLesTextes = Object.values(SLIDES).flatMap((s) => s.blocs.map((b) => b.texte)).join(' ');
    const details = roles.map((r) => {
      const font = etat.polices[r];
      const manquants = glyphesManquants(font, tousLesTextes);
      const nomFamille = (font.names.fullName && (font.names.fullName.fr || font.names.fullName.en)) || etat.nomsPolices[r];
      return `${r === 'light' ? 'texte' : 'mise en avant'} : ${nomFamille}` + (manquants.length ? ` (caractères absents : ${manquants.join(' ')})` : '');
    });
    const complet = roles.length === 2;
    const sansManque = !details.some((d) => d.includes('absents'));
    noter('polices', complet && sansManque, details.join(' · ') + (complet ? '' : ' · il manque une des deux polices'));
  }

  async function restaurerPolices() {
    for (const role of ['light', 'bold']) {
      try {
        const enregistree = await lire('police-' + role);
        if (enregistree) await installerPolice(role, enregistree.octets, enregistree.nom, false);
      } catch (erreur) {
        noter('polices', false, 'restauration impossible : ' + erreur.message);
      }
    }
  }

  async function chargerLato() {
    const sources = {
      light: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Light.ttf',
      bold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Bold.ttf',
    };
    noter('polices', null, 'téléchargement de Lato…');
    try {
      for (const [role, url] of Object.entries(sources)) {
        const reponse = await fetch(url);
        if (!reponse.ok) throw new Error('réponse ' + reponse.status);
        await installerPolice(role, await reponse.arrayBuffer(), url.split('/').pop(), true);
      }
    } catch (erreur) {
      noter('polices', false, 'Lato non téléchargée (' + erreur.message + ')');
    }
  }

  /* ---------- Rendu ---------- */

  const fond = () => COULEURS.bleu[etat.bleu];
  const couleur = (nom) => (nom === 'vert' ? COULEURS.vert[etat.vert] : COULEURS.blanc);

  function compositionCourante() {
    return composer(SLIDES[etat.slide], FORMATS[etat.format], choisirPolice);
  }

  function dessiner(ctx, compo) {
    ctx.fillStyle = fond();
    ctx.fillRect(0, 0, compo.fmt.l, compo.fmt.h);
    for (const ligne of compo.lignes) {
      const chemin = ligne.font.getPath(ligne.texte, ligne.x, ligne.yBase, ligne.taille, { kerning: true });
      chemin.fill = couleur(ligne.couleur);
      chemin.draw(ctx);
    }
  }

  function rendreCanvas(compo, echelle) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(compo.fmt.l * echelle);
    canvas.height = Math.round(compo.fmt.h * echelle);
    const ctx = canvas.getContext('2d');
    ctx.scale(echelle, echelle);
    dessiner(ctx, compo);
    return canvas;
  }

  function redessiner() {
    const apercu = $('apercu');
    const fmt = FORMATS[etat.format];
    apercu.width = fmt.l;
    apercu.height = fmt.h;
    const ctx = apercu.getContext('2d');
    if (!choisirPolice('light')) {
      ctx.fillStyle = fond();
      ctx.fillRect(0, 0, fmt.l, fmt.h);
      $('infos-rendu').textContent = 'Charge d’abord tes polices (étape 1).';
      return;
    }
    const compo = compositionCourante();
    dessiner(ctx, compo);
    $('infos-rendu').textContent =
      `${fmt.l} × ${fmt.h} px · ${compo.lignes.length} lignes · colonne de ${Math.round(compo.largeurColonne)} px · ` +
      (compo.deborde ? '⚠️ le texte dépasse les marges' : 'texte dans les marges');
  }

  function verifierIdentite() {
    if (!choisirPolice('light')) return noter('rendu', false, 'polices manquantes');
    const compo = compositionCourante();
    const { l, h } = compo.fmt;
    redessiner();
    const a = $('apercu').getContext('2d').getImageData(0, 0, l, h).data;
    const b = rendreCanvas(compo, 1).getContext('2d').getImageData(0, 0, l, h).data;
    let differences = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences++;
    noter('rendu', differences === 0, differences === 0
      ? `identiques au pixel près (${l} × ${h} px)`
      : `${differences} valeurs différentes sur ${a.length}`);
  }

  /* ---------- Exports ---------- */

  function proposerPartage(blob, nom) {
    etat.fichierPret = new File([blob], nom, { type: blob.type });
    const bouton = $('btn-partager');
    bouton.hidden = false;
    bouton.textContent = `Partager ou enregistrer « ${nom} »`;
  }

  async function preparerPNG(echelle) {
    if (!choisirPolice('light')) return noter('png', false, 'polices manquantes');
    try {
      const canvas = rendreCanvas(compositionCourante(), echelle);
      const blob = await new Promise((resoudre) => canvas.toBlob(resoudre, 'image/png'));
      if (!blob) throw new Error('image trop grande pour cet appareil');
      const nom = `test-${etat.slide}-${etat.format}-${canvas.width}px.png`;
      proposerPartage(blob, nom);
      noter('png', true, `${canvas.width} × ${canvas.height} px, ${Math.round(blob.size / 1024)} Ko`);
    } catch (erreur) {
      noter('png', false, erreur.message);
    }
  }

  function versRgbPdf(hex) {
    const [r, v, b] = hexVersComposantes(hex);
    return PDFLib.rgb(r / 255, v / 255, b / 255);
  }

  async function preparerPDF() {
    if (!choisirPolice('light')) return noter('pdf', false, 'polices manquantes');
    try {
      const compo = compositionCourante();
      const { l, h } = compo.fmt;
      const pdf = await PDFLib.PDFDocument.create();
      pdf.setTitle('ContentsHelper — test Phase 0');
      const page = pdf.addPage([l, h]);
      page.drawRectangle({ x: 0, y: 0, width: l, height: h, color: versRgbPdf(fond()) });
      // Les lettres sont tracées comme des formes vectorielles : même position qu'à l'écran,
      // netteté parfaite à tout zoom, et aucune restriction de licence sur l'intégration de police.
      for (const ligne of compo.lignes) {
        const trace = ligne.font.getPath(ligne.texte, ligne.x, ligne.yBase, ligne.taille, { kerning: true }).toPathData(2);
        if (trace) page.drawSvgPath(trace, { x: 0, y: h, color: versRgbPdf(couleur(ligne.couleur)) });
      }
      const octets = await pdf.save();
      const blob = new Blob([octets], { type: 'application/pdf' });
      proposerPartage(blob, `test-${etat.slide}-${etat.format}.pdf`);
      noter('pdf', true, `${l} × ${h} pt, ${Math.round(blob.size / 1024)} Ko, texte vectoriel`);
    } catch (erreur) {
      noter('pdf', false, erreur.message);
    }
  }

  // Appelé directement par le bouton : Safari exige un geste de l'utilisateur pour partager.
  async function partager() {
    const fichier = etat.fichierPret;
    if (!fichier) return;
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier] });
        noter('partage', true, 'menu de partage ouvert');
        return;
      } catch (erreur) {
        if (erreur.name === 'AbortError') return noter('partage', true, 'menu ouvert puis fermé');
        noter('partage', false, 'partage refusé (' + erreur.name + '), essai par téléchargement');
      }
    }
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = fichier.name;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    noter('partage', true, 'téléchargement lancé');
  }

  /* ---------- Services gratuits ---------- */

  const PHRASE_TEST = 'Je croie que il est partit hier soir.';

  async function testerLanguageTool() {
    noter('languagetool', null, 'requête en cours…');
    const debut = performance.now();
    try {
      const reponse = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: PHRASE_TEST, language: 'fr' }),
      });
      if (!reponse.ok) throw new Error('réponse ' + reponse.status);
      const donnees = await reponse.json();
      const duree = Math.round(performance.now() - debut);
      const exemples = donnees.matches.slice(0, 3).map((m) => {
        const fautif = PHRASE_TEST.substr(m.offset, m.length);
        const proposition = m.replacements[0] ? m.replacements[0].value : '?';
        return `« ${fautif} » → « ${proposition} »`;
      });
      noter('languagetool', true, `${donnees.matches.length} erreur(s) trouvée(s) en ${duree} ms : ${exemples.join(', ')}`);
    } catch (erreur) {
      noter('languagetool', false, erreur.message === 'Load failed' || erreur.name === 'TypeError'
        ? 'appel bloqué par le navigateur ou pas de réseau (un relais sera nécessaire)'
        : erreur.message);
    }
  }

  async function testerMistral() {
    const cle = localStorage.getItem('cle-mistral');
    if (!cle) return noter('mistral', false, 'aucune clé enregistrée');
    noter('mistral', null, 'requête en cours…');
    const debut = performance.now();
    try {
      const reponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cle,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          temperature: 0,
          max_tokens: 60,
          messages: [{
            role: 'user',
            content: `Corrige uniquement l’orthographe et la grammaire de cette phrase. Réponds par la phrase corrigée, sans rien d’autre : ${PHRASE_TEST}`,
          }],
        }),
      });
      const duree = Math.round(performance.now() - debut);
      if (reponse.status === 401) throw new Error('clé refusée (401) : vérifie la clé');
      if (reponse.status === 429) throw new Error('limite de requêtes atteinte (429) : réessaie dans une minute');
      if (!reponse.ok) throw new Error('réponse ' + reponse.status);
      const donnees = await reponse.json();
      const texte = donnees.choices[0].message.content.trim();
      noter('mistral', true, `réponse en ${duree} ms : « ${texte} »`);
    } catch (erreur) {
      noter('mistral', false, erreur.message === 'Load failed' || erreur.name === 'TypeError'
        ? 'appel bloqué par le navigateur ou pas de réseau (un relais sera nécessaire)'
        : erreur.message);
    }
  }

  /* ---------- Stockage et installation ---------- */

  async function testerStockage() {
    const installe = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    noter('installation', installe, installe
      ? 'ouverte depuis l’écran d’accueil'
      : 'ouverte dans Safari : ajoute-la à l’écran d’accueil puis relance ce test');
    try {
      let persistant = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (!persistant && navigator.storage && navigator.storage.persist) persistant = await navigator.storage.persist();
      const estimation = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const maintenant = new Date().toISOString();
      const historique = (await lire('historique')) || { premier: maintenant, ouvertures: 0 };
      historique.ouvertures += 1;
      historique.dernier = maintenant;
      await ecrire('historique', historique);
      const relu = await lire('historique');
      if (!relu || relu.dernier !== maintenant) throw new Error('écriture non relue');
      const quota = estimation && estimation.quota ? ` · espace disponible ≈ ${Math.round(estimation.quota / 1e6)} Mo` : '';
      noter('stockage', true,
        `écriture et relecture OK · premier test le ${new Date(relu.premier).toLocaleString('fr-FR')} · ` +
        `${relu.ouvertures} test(s) · stockage persistant : ${persistant ? 'oui' : 'non'}${quota}`);
    } catch (erreur) {
      noter('stockage', false, erreur.message);
    }
  }

  /* ---------- Interface ---------- */

  function brancherSegments() {
    document.querySelectorAll('.segments').forEach((groupe) => {
      groupe.addEventListener('click', (evenement) => {
        const bouton = evenement.target.closest('button[data-valeur]');
        if (!bouton) return;
        etat[groupe.dataset.groupe] = bouton.dataset.valeur;
        groupe.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
        $('btn-partager').hidden = true;
        etat.fichierPret = null;
        redessiner();
      });
    });
  }

  function brancherPolices() {
    for (const role of ['light', 'bold']) {
      $('fichier-' + role).addEventListener('change', async (evenement) => {
        const fichier = evenement.target.files[0];
        if (!fichier) return;
        try {
          await installerPolice(role, await fichier.arrayBuffer(), fichier.name, true);
        } catch (erreur) {
          noter('polices', false, `${fichier.name} : ${erreur.message}`);
        }
      });
    }
    $('btn-lato').addEventListener('click', chargerLato);
  }

  function brancherServices() {
    $('btn-languagetool').addEventListener('click', testerLanguageTool);
    $('btn-cle').addEventListener('click', () => {
      const cle = $('cle-mistral').value.trim();
      if (!cle) return;
      localStorage.setItem('cle-mistral', cle);
      $('cle-mistral').value = '';
      $('etat-cle').textContent = 'Clé enregistrée sur cet iPad.';
    });
    $('btn-effacer-cle').addEventListener('click', () => {
      localStorage.removeItem('cle-mistral');
      $('etat-cle').textContent = 'Aucune clé enregistrée.';
    });
    $('btn-mistral').addEventListener('click', testerMistral);
    $('btn-stockage').addEventListener('click', testerStockage);
    $('etat-cle').textContent = localStorage.getItem('cle-mistral') ? 'Clé enregistrée sur cet iPad.' : 'Aucune clé enregistrée.';
  }

  function brancherRendu() {
    $('btn-identite').addEventListener('click', verifierIdentite);
    $('btn-png').addEventListener('click', () => preparerPNG(1));
    $('btn-png2').addEventListener('click', () => preparerPNG(2));
    $('btn-pdf').addEventListener('click', preparerPDF);
    $('btn-partager').addEventListener('click', partager);
  }

  function brancherRapport() {
    $('btn-copier').addEventListener('click', async () => {
      majRapport();
      try {
        await navigator.clipboard.writeText($('rapport').value);
        $('btn-copier').textContent = 'Rapport copié ✓';
      } catch {
        $('rapport').select();
        $('btn-copier').textContent = 'Sélectionné : copie-le manuellement';
      }
      setTimeout(() => { $('btn-copier').textContent = 'Copier le rapport'; }, 2500);
    });
  }

  async function demarrer() {
    const manquantes = [];
    if (typeof opentype === 'undefined') manquantes.push('opentype.js (connexion Internet ?)');
    if (typeof PDFLib === 'undefined') manquantes.push('pdf-lib.min.js (fichier absent du dépôt ?)');
    noter('bibliotheques', manquantes.length === 0, manquantes.length ? 'manquantes : ' + manquantes.join(', ') : 'opentype.js 1.3.4 et pdf-lib 1.17.1');

    brancherSegments();
    brancherPolices();
    brancherServices();
    brancherRendu();
    brancherRapport();
    redessiner();
    if (typeof opentype !== 'undefined') await restaurerPolices();
    if (!etat.polices.light && !etat.polices.bold) noter('polices', false, 'aucune police chargée');
  }

  document.addEventListener('DOMContentLoaded', demarrer);
}
