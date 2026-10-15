/*
 * PostsOP — export des carrousels
 *
 * PNG : chaque slide est dessinée par le moteur, à 1 ou 2 fois sa taille.
 * PDF : une page par slide ; les lettres sont des tracés vectoriels (nettes à tout zoom,
 *       sans intégrer la police, donc sans contrainte de licence).
 * Plusieurs images : regroupées dans une archive ZIP quand le partage direct n'est pas possible.
 */
(function (racine) {
  'use strict';

  const M = racine.PostsOPMoteur || require('./moteur.js');

  /* ---------- Noms de fichiers ---------- */

  function nomDeFichier(titre) {
    const base = String(titre || 'carrousel').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    return base || 'carrousel';
  }

  /* ---------- Archive ZIP (sans compression : les PNG le sont déjà) ---------- */

  const TABLE_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(octets) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function creerZip(fichiers, date = new Date()) {
    const encodeur = new TextEncoder();
    const heure = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF;
    const jour = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
    const morceaux = [];
    const central = [];
    let position = 0;
    for (const f of fichiers) {
      const nom = encodeur.encode(f.nom);
      const donnees = f.octets;
      const crc = crc32(donnees);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
      local.setUint16(10, heure, true); local.setUint16(12, jour, true); local.setUint32(14, crc, true);
      local.setUint32(18, donnees.length, true); local.setUint32(22, donnees.length, true); local.setUint16(26, nom.length, true); local.setUint16(28, 0, true);
      morceaux.push(new Uint8Array(local.buffer), nom, donnees);
      const entree = new DataView(new ArrayBuffer(46));
      entree.setUint32(0, 0x02014b50, true); entree.setUint16(4, 20, true); entree.setUint16(6, 20, true); entree.setUint16(8, 0x0800, true); entree.setUint16(10, 0, true);
      entree.setUint16(12, heure, true); entree.setUint16(14, jour, true); entree.setUint32(16, crc, true);
      entree.setUint32(20, donnees.length, true); entree.setUint32(24, donnees.length, true); entree.setUint16(28, nom.length, true);
      entree.setUint32(42, position, true);
      central.push(new Uint8Array(entree.buffer), nom);
      position += 30 + nom.length + donnees.length;
    }
    const tailleCentral = central.reduce((n, m) => n + m.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
    fin.setUint32(12, tailleCentral, true); fin.setUint32(16, position, true);
    const tout = [...morceaux, ...central, new Uint8Array(fin.buffer)];
    const sortie = new Uint8Array(tout.reduce((n, m) => n + m.length, 0));
    let k = 0;
    for (const m of tout) { sortie.set(m, k); k += m.length; }
    return sortie;
  }

  /* ---------- PDF ---------- */

  const versRgb = (PDFLib, hex) => {
    const n = parseInt(hex.slice(1), 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };
  const cheminArrondi = (x, y, l, h, r) => `M${x + r} ${y}H${x + l - r}Q${x + l} ${y} ${x + l} ${y + r}V${y + h - r}Q${x + l} ${y + h} ${x + l - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

  // compositions : résultats de M.composer. images : { cle: octets PNG }. replis : PNG de secours par slide
  // (utilisés si une slide n'a pas ses polices exactes : elle est alors intégrée comme image).
  async function fabriquerPDF({ PDFLib, compositions, images = {}, replis = [], titre = 'Carrousel' }) {
    const pdf = await PDFLib.PDFDocument.create();
    pdf.setTitle(titre);
    pdf.setCreator('PostsOP');
    const cache = {};
    const imageDe = async (cle) => {
      if (!images[cle]) return null;
      if (!cache[cle]) cache[cle] = await pdf.embedPng(images[cle]);
      return cache[cle];
    };
    for (let i = 0; i < compositions.length; i++) {
      const c = compositions[i];
      const { l, h } = c.fmt;
      const page = pdf.addPage([l, h]);
      if (!c.exacte && replis[i]) {
        const image = await pdf.embedPng(replis[i]);
        page.drawImage(image, { x: 0, y: 0, width: l, height: h });
        continue;
      }
      page.drawRectangle({ x: 0, y: 0, width: l, height: h, color: versRgb(PDFLib, c.fond.fond) });
      for (const e of c.elements) {
        if (e.type === 'rect') {
          if (e.rayon) page.drawSvgPath(cheminArrondi(e.x, e.y, e.l, e.h, e.rayon), { x: 0, y: h, color: versRgb(PDFLib, e.couleur) });
          else page.drawRectangle({ x: e.x, y: h - e.y - e.h, width: e.l, height: e.h, color: versRgb(PDFLib, e.couleur) });
        } else if (e.type === 'ligne') {
          const trace = e.police.trace ? e.police.trace(e.texte, e.x, e.y, e.taille) : '';
          if (trace) page.drawSvgPath(trace, { x: 0, y: h, color: versRgb(PDFLib, e.couleur), opacity: e.opacite || 1 });
        } else if (e.type === 'image') {
          const image = await imageDe(e.cle);
          if (!image) continue;
          const echelle = Math.min(e.l / image.width, e.h / image.height);
          const lo = image.width * echelle;
          const ho = image.height * echelle;
          page.drawImage(image, { x: e.x + (e.l - lo) / 2, y: h - e.y - (e.h - ho) / 2 - ho, width: lo, height: ho });
        } else if (e.type === 'fleche') {
          page.drawSvgPath(`M${e.x - 14} ${e.y - 22}L${e.x + 8} ${e.y}L${e.x - 14} ${e.y + 22}`, { x: 0, y: h, borderColor: versRgb(PDFLib, e.couleur), borderWidth: 4, borderOpacity: 0.8 });
        }
      }
    }
    return pdf.save();
  }

  /* ---------- Navigateur : PNG, partage, téléchargement ---------- */

  function dessinerPNG(compo, ressources, echelle) {
    return new Promise((resoudre, rejeter) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(compo.fmt.l * echelle);
      canvas.height = Math.round(compo.fmt.h * echelle);
      const ctx = canvas.getContext('2d');
      ctx.scale(echelle, echelle);
      M.dessiner(ctx, compo, ressources, { export: true });
      canvas.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error('image trop grande pour cet appareil'))), 'image/png');
    });
  }

  async function imageVersPNG(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Prépare les fichiers ; le partage se fait ensuite d'un geste (Safari l'exige).
  async function preparer({ article, compositions, ressources, echelle, quoi, PDFLib }) {
    const base = nomDeFichier(article.titre);
    const fichiers = [];
    const pngs = [];
    for (let i = 0; i < compositions.length; i++) pngs.push(await dessinerPNG(compositions[i], ressources, echelle));
    if (quoi === 'png' || quoi === 'les-deux') {
      pngs.forEach((blob, i) => fichiers.push({ nom: `${base}-${String(i + 1).padStart(2, '0')}.png`, blob }));
    }
    if (quoi === 'pdf' || quoi === 'les-deux') {
      const images = {};
      for (const cle of ['logo', 'logoClair', 'fleurs']) if (ressources[cle]) images[cle] = await imageVersPNG(ressources[cle]);
      const replis = await Promise.all(pngs.map(async (b) => new Uint8Array(await b.arrayBuffer())));
      const octets = await fabriquerPDF({ PDFLib, compositions, images, replis, titre: article.titre });
      fichiers.push({ nom: `${base}.pdf`, blob: new Blob([octets], { type: 'application/pdf' }) });
    }
    return { base, fichiers };
  }

  function peutPartager(fichiers) {
    if (!racine.navigator || !navigator.canShare) return false;
    try { return navigator.canShare({ files: fichiers.map((f) => new File([f.blob], f.nom, { type: f.blob.type })) }); } catch (e) { return false; }
  }

  async function partager(fichiers) {
    await navigator.share({ files: fichiers.map((f) => new File([f.blob], f.nom, { type: f.blob.type })) });
  }

  async function telecharger(fichiers, base) {
    let blob = fichiers[0].blob;
    let nom = fichiers[0].nom;
    if (fichiers.length > 1) {
      const contenus = [];
      for (const f of fichiers) contenus.push({ nom: f.nom, octets: new Uint8Array(await f.blob.arrayBuffer()) });
      blob = new Blob([creerZip(contenus)], { type: 'application/zip' });
      nom = base + '.zip';
    }
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return nom;
  }

  const api = { nomDeFichier, crc32, creerZip, fabriquerPDF, preparer, peutPartager, partager, telecharger };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.PostsOPExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
