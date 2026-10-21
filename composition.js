/*
 * PostsOP — étape Composition (Structure et Design réunies)
 *
 * Les slides s'affichent les unes sous les autres, rendues par le moteur (exactement comme à l'export).
 * Un clic dans un paragraphe l'ouvre en édition à sa place : on écrit, on sélectionne, on met en forme.
 * Tout passe par le modèle de l'article : le texte reste la référence, chaque geste s'annule avec ⌘Z.
 *
 * Gestes : Entrée = nouveau paragraphe · ⇧Entrée = retour à la ligne · ⌘↩ = saut de slide
 *          ⌫ au début d'un paragraphe = réunir avec le précédent (au début d'une slide : avec la slide précédente)
 */
(function (racine) {
  'use strict';

  function fabriquer(d) {
    const { React, M, L, T, OP, Contexte, Icone, Bouton, SlideCanvas, cls, partager } = d;
    const { createElement: h, Fragment, useState, useEffect, useLayoutEffect, useRef, useContext, useMemo } = React;
    const useMiseEnPage = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
    const FAMILLE = "'PostsOP Gill', 'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', sans-serif";
    const NATURES_GRASSES = ['titre', 'contrepoint', 'emphase'];
    const TAILLES_ECRAN = { petites: 420, moyennes: 620, grandes: 840 };
    const lirePref = (cle, defaut) => { try { return racine.localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } };
    const ecrirePref = (cle, valeur) => { try { racine.localStorage.setItem(cle, valeur); } catch (e) { /* indisponible */ } };

    /* ================================================================ */
    /* Texte d'un paragraphe en cours d'édition                         */
    /* ================================================================ */

    // Les espaces insécables de la typographie française (« », : ; ! ?) sont gardées ; les autres
    // (ajoutées par le navigateur pendant la frappe) redeviennent des espaces simples.
    const normaliser = (t) => t.replace(/\u00A0/g, (m, k, s) => (/[:;!?»%]/.test(s[k + 1] || '') || s[k - 1] === '«' ? m : ' '));

    function longueurDe(noeud) {
      let n = 0;
      const parcourir = (x) => {
        for (const c of x.childNodes) {
          if (c.nodeType === 3) n += c.nodeValue.length;
          else if (c.nodeName === 'BR') n += 1;
          else parcourir(c);
        }
      };
      parcourir(noeud);
      return n;
    }
    function lireTexte(el) {
      let t = '';
      const parcourir = (x) => {
        for (const c of x.childNodes) {
          if (c.nodeType === 3) t += c.nodeValue;
          else if (c.nodeName === 'BR') t += '\n';
          else { if ((c.nodeName === 'DIV' || c.nodeName === 'P') && t && !t.endsWith('\n')) t += '\n'; parcourir(c); }
        }
      };
      parcourir(el);
      if (t.endsWith('\n') && el.lastChild && el.lastChild.nodeName === 'BR') t = t.slice(0, -1); // <br> de remplissage
      return normaliser(t);
    }
    function positionDans(el, noeud, decalage) {
      const r = document.createRange();
      r.setStart(el, 0);
      r.setEnd(noeud, decalage);
      return longueurDe(r.cloneContents());
    }
    function selectionDans(el) {
      const s = racine.getSelection && racine.getSelection();
      if (!s || !s.rangeCount) return null;
      const r = s.getRangeAt(0);
      if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
      return { debut: positionDans(el, r.startContainer, r.startOffset), fin: positionDans(el, r.endContainer, r.endOffset) };
    }
    function point(el, pos) {
      let reste = pos;
      let trouve = null;
      const parcourir = (x) => {
        for (let k = 0; k < x.childNodes.length && !trouve; k++) {
          const c = x.childNodes[k];
          if (c.nodeType === 3) { if (reste <= c.nodeValue.length) { trouve = [c, reste]; return; } reste -= c.nodeValue.length; }
          else if (c.nodeName === 'BR') { if (reste === 0) { trouve = [x, k]; return; } reste -= 1; }
          else parcourir(c);
        }
      };
      parcourir(el);
      return trouve || [el, el.childNodes.length];
    }
    function placerSelection(el, debut, fin = debut) {
      const s = racine.getSelection();
      const r = document.createRange();
      const [n1, o1] = point(el, debut);
      const [n2, o2] = point(el, fin);
      r.setStart(n1, o1);
      r.setEnd(n2, o2);
      s.removeAllRanges();
      s.addRange(r);
    }
    const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Le paragraphe, avec sa mise en forme, en HTML : gras, italique, souligné, taille, couleur.
    function htmlDuBloc(texte, marques, fond, echelle) {
      const morceaux = [];
      let curseur = 0;
      const style = (m) => [
        m.gras === true ? 'font-weight:700' : m.gras === false ? 'font-weight:300' : '',
        m.italique ? 'font-style:italic' : '',
        m.souligne ? 'text-decoration:underline;text-underline-offset:0.11em' : '',
        m.taille ? `font-size:${Math.round(m.taille * echelle)}px` : '',
        m.couleur ? `color:${m.couleur === 'accent' ? fond.accent : fond.texte}` : '',
      ].filter(Boolean).join(';');
      for (const m of marques || []) {
        if (m.debut > curseur) morceaux.push(echapper(texte.slice(curseur, m.debut)));
        morceaux.push(`<span style="${style(m)}">${echapper(texte.slice(m.debut, m.fin))}</span>`);
        curseur = m.fin;
      }
      morceaux.push(echapper(texte.slice(curseur)));
      return morceaux.join('').replace(/\n/g, '<br>') + (texte.endsWith('\n') || !texte ? '<br>' : '');
    }

    /* ================================================================ */
    /* Éditeur posé exactement sur le paragraphe de la slide            */
    /* ================================================================ */

    function EditeurBloc({ bloc, zone, fond, echelleSlide, depart, version, onTexte, onTouche, refExterne }) {
      const ref = useRef(null);
      const rendu = useRef({ texte: null, marques: null, version: -1 });
      const attendu = useRef(null);
      const curseurVoulu = useRef(null); // après une correction typographique : où remettre le curseur
      const avantSaisie = useRef(null); // sélection juste avant une frappe ou un collage
      const saisieEnCours = useRef(false);
      const marquesJSON = JSON.stringify(bloc.marques || []);

      useMiseEnPage(() => {
        const el = ref.current;
        if (!el) return;
        if (refExterne) refExterne.current = el;
        // Notre propre frappe revient du modèle : le contenu est déjà juste, on n'y touche pas (le curseur reste).
        if (attendu.current !== null && bloc.texte === attendu.current) {
          attendu.current = null;
          rendu.current = { texte: bloc.texte, marques: marquesJSON, version };
          return;
        }
        if (rendu.current.texte === bloc.texte && rendu.current.marques === marquesJSON && rendu.current.version === version) return;
        const avant = document.activeElement === el ? selectionDans(el) : null;
        const premier = rendu.current.texte === null;
        el.innerHTML = htmlDuBloc(bloc.texte, bloc.marques, fond, echelleSlide);
        rendu.current = { texte: bloc.texte, marques: marquesJSON, version };
        const borne = (x) => Math.max(0, Math.min(x, bloc.texte.length));
        if (premier) {
          el.focus({ preventScroll: true });
          if (depart && depart.point && (document.caretRangeFromPoint || document.caretPositionFromPoint)) {
            const { x, y } = depart.point;
            let noeud = null;
            let decalage = 0;
            if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { noeud = r.startContainer; decalage = r.startOffset; } }
            else { const p = document.caretPositionFromPoint(x, y); if (p) { noeud = p.offsetNode; decalage = p.offset; } }
            if (noeud && el.contains(noeud)) { const pos = positionDans(el, noeud, decalage); placerSelection(el, pos); return; }
          }
          if (depart && depart.sel) { placerSelection(el, borne(depart.sel.debut), borne(depart.sel.fin)); return; }
          placerSelection(el, bloc.texte.length);
          return;
        }
        const voulu = curseurVoulu.current;
        curseurVoulu.current = null;
        if (avant && voulu !== null) placerSelection(el, borne(voulu));
        else if (avant) placerSelection(el, borne(avant.debut), borne(avant.fin));
      });

      useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const noter = () => { avantSaisie.current = selectionDans(el); };
        el.addEventListener('beforeinput', noter);
        return () => el.removeEventListener('beforeinput', noter);
      }, []);

      const lire = () => {
        const el = ref.current;
        if (!el || saisieEnCours.current) return;
        const texte = lireTexte(el);
        attendu.current = texte;
        const sel = selectionDans(el);
        const av = avantSaisie.current;
        avantSaisie.current = null;
        // Si la typographie a été corrigée, le paragraphe est réécrit et le curseur replacé juste après la frappe.
        const corrige = onTexte(texte, sel, av && sel ? [av.debut, sel.fin] : null);
        if (corrige) { attendu.current = null; curseurVoulu.current = corrige.curseur; }
      };
      return h('div', {
        ref, className: 'editeur-bloc', contentEditable: true, suppressContentEditableWarning: true, spellCheck: true, lang: 'fr',
        role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Paragraphe en cours d’édition',
        style: {
          left: zone.x + 'px', top: zone.y + 'px', width: zone.l + 'px', minHeight: zone.h + 'px',
          fontFamily: FAMILLE, fontWeight: zone.role === 'bold' ? 700 : 300, fontSize: zone.taille + 'px', lineHeight: zone.taille * zone.interligne + 'px',
          color: zone.couleur, textAlign: zone.alignement === 'centre' ? 'center' : zone.alignement === 'droite' ? 'right' : 'left', caretColor: fond.accent,
        },
        onInput: lire,
        onCompositionStart: () => { saisieEnCours.current = true; },
        onCompositionEnd: () => { saisieEnCours.current = false; lire(); },
        onKeyDown: (e) => onTouche(e, ref.current),
        onPaste: (e) => { e.preventDefault(); const t = (e.clipboardData || racine.clipboardData).getData('text/plain'); avantSaisie.current = selectionDans(e.currentTarget); document.execCommand('insertText', false, t.replace(/\r\n?/g, '\n')); },
      });
    }

    /* ================================================================ */
    /* Menus : placement d'après les bords réels de l'écran             */
    /* ================================================================ */

    const MARGE = 8;
    const ecran = () => ({ l: document.documentElement.clientWidth, h: racine.visualViewport ? Math.min(racine.innerHeight, racine.visualViewport.height) : racine.innerHeight });
    function placerMenu(pop, ancre) {
      const e = ecran();
      pop.style.left = '0px'; pop.style.top = '0px'; pop.style.maxHeight = '';
      const a = ancre.getBoundingClientRect();
      const l = Math.min(pop.offsetWidth, e.l - 2 * MARGE);
      const dessous = e.h - a.bottom - 6 - MARGE;
      const dessus = a.top - 6 - MARGE;
      const versLeHaut = pop.scrollHeight > dessous && dessus > dessous;
      const hMax = Math.max(160, versLeHaut ? dessus : dessous);
      pop.style.maxHeight = hMax + 'px';
      const hReelle = Math.min(pop.scrollHeight, hMax);
      pop.style.left = Math.max(MARGE, Math.min(a.left, e.l - l - MARGE)) + 'px';
      pop.style.top = (versLeHaut ? a.top - 6 - hReelle : a.bottom + 6) + 'px';
    }
    function placerSousMenu(pop, ancre, parent) {
      const e = ecran();
      pop.style.left = '0px'; pop.style.top = '0px'; pop.style.maxHeight = (e.h - 2 * MARGE) + 'px'; pop.style.minWidth = '';
      const a = ancre.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      const l = Math.min(pop.offsetWidth, e.l - 2 * MARGE);
      const hReelle = Math.min(pop.scrollHeight, e.h - 2 * MARGE);
      const aDroite = p.right + 4 + l <= e.l - MARGE;
      const aGauche = p.left - 4 - l >= MARGE;
      if (!aDroite && !aGauche) {
        // Écran étroit : le sous-menu prend la place du menu (un bouton Retour est affiché en tête).
        const largeur = Math.min(Math.max(l, p.width), e.l - 2 * MARGE);
        pop.style.minWidth = largeur + 'px';
        pop.style.left = Math.max(MARGE, Math.min(p.left, e.l - largeur - MARGE)) + 'px';
        pop.style.top = Math.max(MARGE, Math.min(p.top, e.h - MARGE - hReelle)) + 'px';
        return true;
      }
      pop.style.left = (aDroite ? p.right + 4 : p.left - 4 - l) + 'px';
      let y = a.top - 7;
      if (y + hReelle > e.h - MARGE) y = e.h - MARGE - hReelle;
      pop.style.top = Math.max(MARGE, y) + 'px';
      return false;
    }

    const garder = (e) => e.preventDefault(); // garde la sélection du texte pendant un clic sur un menu

    // Un élément de menu : action, case cochée, sous-menu, séparateur, titre, note, ou contenu libre.
    function ElementMenu({ el, fermer, parentRef }) {
      const [ouvert, setOuvert] = useState(false);
      const [remplace, setRemplace] = useState(false);
      const ancre = useRef(null);
      const pop = useRef(null);
      const minuterie = useRef(null);
      const parSurvol = useRef(false); // sous-menu ouvert par le survol : le clic qui suit ne doit pas le refermer
      const apresRetour = useRef(false); // après « Retour », le survol ne rouvre pas le sous-menu tant que le pointeur n'est pas reparti
      useMiseEnPage(() => { if (ouvert && pop.current && ancre.current && parentRef.current) { const r = placerSousMenu(pop.current, ancre.current, parentRef.current); if (r !== remplace) setRemplace(r); } }, [ouvert, remplace]);
      useEffect(() => () => clearTimeout(minuterie.current), []);
      if (el.type === 'trait') return h('div', { className: 'trait-menu', role: 'separator' });
      if (el.type === 'titre') return h('div', { className: 'titre-section' }, el.libelle);
      if (el.type === 'note') return h('p', { className: 'note-menu' }, el.texte);
      if (el.type === 'libre') return h('div', { className: 'libre-menu' }, el.rendu(fermer));
      if (el.type === 'sous') {
        return h('div', {
          className: 'sous-menu',
          onPointerEnter: (e) => { if (e.pointerType === 'touch' || apresRetour.current) return; clearTimeout(minuterie.current); minuterie.current = setTimeout(() => { parSurvol.current = true; setOuvert(true); }, 80); },
          onPointerLeave: (e) => { if (e.pointerType !== 'touch') { clearTimeout(minuterie.current); apresRetour.current = false; } },
        },
        h('button', { ref: ancre, type: 'button', className: 'item-menu', role: 'menuitem', 'aria-haspopup': 'true', 'aria-expanded': ouvert, onMouseDown: garder, onClick: () => { clearTimeout(minuterie.current); if (parSurvol.current) { parSurvol.current = false; setOuvert(true); } else setOuvert(!ouvert); } },
          h('span', null, el.libelle), h('svg', { className: 'fleche-droite', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M9 6l6 6-6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }))),
        ouvert && h('div', { ref: pop, className: 'popover-menu sous', role: 'menu', 'data-sous': el.libelle },
          remplace && h('button', { type: 'button', className: 'item-menu retour', onMouseDown: garder, onClick: () => { apresRetour.current = true; setOuvert(false); } },
            h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M15 6l-6 6 6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })), el.libelle),
          el.contenu().map((x, k) => h(ElementMenu, { key: k, el: x, fermer, parentRef: pop }))));
      }
      return h('button', {
        type: 'button', className: cls('item-menu', el.danger && 'danger'), role: el.coche === undefined ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': el.coche === undefined ? undefined : !!el.coche,
        disabled: el.desactive, onMouseDown: garder, onClick: () => { fermer(); el.action(); },
        onPointerEnter: () => { const p = parentRef.current; if (p) for (const s of p.querySelectorAll(':scope > .sous-menu > [aria-expanded="true"]')) s.click(); },
      }, h('span', { className: 'libelle-item' }, el.libelle), el.raccourci && h('span', { className: 'raccourci' }, el.raccourci));
    }

    function Popover({ ancre, contenu, fermer, classe, etiquette }) {
      const ref = useRef(null);
      useMiseEnPage(() => { if (ref.current && ancre.current) placerMenu(ref.current, ancre.current); });
      return h('div', { ref, className: cls('popover-menu', classe), role: 'menu', 'aria-label': etiquette },
        contenu().map((x, k) => h(ElementMenu, { key: k, el: x, fermer, parentRef: ref })));
    }

    function BarreMenus({ menus, ouvert, setOuvert, droite }) {
      const refs = useRef({});
      return h('div', { className: 'menus-composition', role: 'menubar', 'aria-label': 'Menus' },
        menus.map((m) => h('span', { key: m.nom, className: 'menu-racine' },
          h('button', {
            ref: (e) => { refs.current[m.nom] = { current: e }; }, type: 'button', className: cls('titre-menu', ouvert === m.nom && 'ouvert'), 'aria-haspopup': 'true', 'aria-expanded': ouvert === m.nom,
            onMouseDown: garder, onClick: () => setOuvert(ouvert === m.nom ? null : m.nom),
            onPointerEnter: (e) => { if (e.pointerType !== 'touch' && ouvert && ouvert !== m.nom) setOuvert(m.nom); },
          }, m.titre || m.nom),
          ouvert === m.nom && h(Popover, { ancre: refs.current[m.nom], contenu: m.contenu, fermer: () => setOuvert(null), classe: m.classe, etiquette: m.nom }))),
        h('span', { className: 'espace' }),
        droite);
    }

    /* ================================================================ */
    /* Étape Composition                                                */
    /* ================================================================ */

    function EtapeComposition({ etat, dispatch, article, majA }) {
      const ctx = useContext(Contexte);
      const { choisirPolice, reglages, charte, images } = ctx;
      const [edition, setEdition] = useState(null);
      const [propositionsOuvertes, setPropositionsOuvertes] = useState(false);
      // Assistant IA (bouton robot) : propositions de mise en page et discussion sur un passage, comme dans l'étape Texte.
      const outilsIA = d.ia();
      const IA = racine.PostsOPIA;
      const R = racine.PostsOPRelecture;
      const configIA = IA && IA.active();
      const nomIA = configIA ? IA.FOURNISSEURS[configIA.fournisseur].nom : 'Claude';
      const texteArticle = article.texte.join('\n\n');
      const [zoneIA, setZoneIA] = useState(null);
      const passageIA = zoneIA ? texteArticle.slice(zoneIA.d, zoneIA.f) : '';
      const disc = outilsIA.useDiscussion(article, texteArticle, majA, (d0, f0) => setZoneIA({ d: d0, f: f0 }), (etat.projet && etat.projet.profilEditorial) || '');
      const [menuIA, setMenuIA] = useState(false);
      const refRobot = useRef(null);
      useEffect(() => {
        if (!menuIA) return undefined;
        const touche = (e) => { if (e.key === 'Escape') setMenuIA(false); };
        racine.addEventListener('keydown', touche);
        return () => racine.removeEventListener('keydown', touche);
      }, [menuIA]);
      const choisirPassageIA = (t) => { const pos = t ? R.placerPassage(texteArticle, t, null) : null; setZoneIA(pos ? { d: pos[0], f: pos[1] } : null); return !!pos; };
      const [version, setVersion] = useState(0);
      const [menu, setMenu] = useState(null);
      const [tailleEcran, setTailleEcran] = useState(() => lirePref('postsop-taille-slides', 'moyennes'));
      const [marges, setMarges] = useState(false);
      const [deplie, setDeplie] = useState(() => lirePref('postsop-barre-depliee', 'non') === 'oui');
      const [barre, setBarre] = useState(null);
      const [sousBarre, setSousBarre] = useState(null);
      const selRef = useRef({ debut: 0, fin: 0 });
      const editeurRef = useRef(null);
      const pagesRef = useRef(null);
      const [largeurDispo, setLargeurDispo] = useState(900);
      const minuterieBarre = useRef(null);
      const total = article.slides.length;
      const logo = article.logo || 'auto';
      const fond = M.fondsDe(charte.palette)[article.fond] || M.fondsDe(charte.palette).bleu;
      const fmt = M.FORMATS[article.format];
      const active = Math.min(etat.slide || 0, total - 1);
      const [selection, setSelection] = useState({ i: null, n: [] });
      const [apercu, setApercu] = useState(null); // la slide telle qu'elle est pendant un glisser (rien n'est enregistré avant le lâcher)
      const [imageChoisie, setImageChoisie] = useState(null); // logo ou fleurs choisis : { i, k }
      const [dernierFilet, setDernierFilet] = useState('charte'); // dernière couleur de filet choisie, reprise par le bouton de la barre
      const [lasso, setLasso] = useState(null);
      const [guides, setGuides] = useState(null);
      const [survol, setSurvol] = useState(null);
      const [cible, setCible] = useState(null);
      const geste = useRef(null);
      const dernierTapVide = useRef(null);
      // Compositions : seule la slide qui change est recalculée (pendant un glisser, à chaque mouvement).
      const slidesVues = apercu ? article.slides.map((s, kk) => (kk === apercu.i ? apercu.slide : s)) : article.slides;
      const cache = useRef(null);
      const cleCompo = [article.format, article.fond, total, logo].join('|');
      if (!cache.current || cache.current.cle !== cleCompo || cache.current.choisirPolice !== choisirPolice || cache.current.reglages !== reglages || cache.current.charte !== charte) {
        cache.current = { cle: cleCompo, choisirPolice, reglages, charte, carte: new WeakMap() };
      }
      const compositions = slidesVues.map((s, kk) => {
        const memo = cache.current.carte.get(s);
        if (memo && memo.kk === kk) return memo.c;
        const c = M.composer(s, article.format, article.fond, choisirPolice, { index: kk, total, reglages, charte, logo });
        cache.current.carte.set(s, { kk, c });
        return c;
      });
      const validees = article.alertesValidees || [];
      const toutes = M.controler(article, compositions, reglages);
      const alertes = toutes.filter((a) => !validees.includes(a.cle));
      const largeurSlide = Math.max(240, Math.min(TAILLES_ECRAN[tailleEcran], largeurDispo - (largeurDispo > 760 ? 150 : 70)));
      const k = largeurSlide / 1080;
      const blocCourant = edition && article.slides[edition.i] ? article.slides[edition.i].blocs[edition.n] : null;
      const zoneMemoire = useRef(null);

      // Largeur disponible pour les slides
      useEffect(() => {
        const el = pagesRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const o = new ResizeObserver(([e]) => setLargeurDispo(Math.floor(e.contentRect.width)));
        o.observe(el);
        return () => o.disconnect();
      }, []);
      // Arrivée sur l'étape avec une slide précise (depuis l'export, une alerte…) : on la montre.
      useEffect(() => {
        const page = pagesRef.current && pagesRef.current.querySelector(`[data-index="${active}"]`);
        if (page && active > 0 && page.scrollIntoView) page.scrollIntoView({ block: 'center' });
      }, []);
      // Si le paragraphe en cours d'édition disparaît (annulation, synchronisation…), l'édition se ferme.
      useEffect(() => { if (edition && !blocCourant) setEdition(null); }, [edition, blocCourant]);

      /* ---------- Sélection et barre flottante ---------- */
      useEffect(() => {
        const surSelection = () => {
          const el = editeurRef.current;
          if (!el || !document.contains(el)) { setBarre(null); return; }
          const s = selectionDans(el);
          if (!s) return;
          selRef.current = s;
          clearTimeout(minuterieBarre.current);
          if (s.fin <= s.debut) { setBarre(null); return; }
          // Discrète : elle n'apparaît qu'une fois la sélection posée.
          minuterieBarre.current = setTimeout(() => {
            const sel = racine.getSelection();
            if (!sel.rangeCount || sel.isCollapsed) return;
            const r = sel.getRangeAt(0).getBoundingClientRect();
            setBarre({ x: r.left + r.width / 2, haut: r.top, bas: r.bottom });
          }, 160);
        };
        document.addEventListener('selectionchange', surSelection);
        return () => document.removeEventListener('selectionchange', surSelection);
      }, []);
      useEffect(() => { if (menu) setBarre(null); }, [menu]);
      useEffect(() => {
        // Seule la barre flottante suit la sélection : elle s'efface si la page défile vraiment.
        let depart = racine.scrollY;
        const defiler = () => { if (Math.abs(racine.scrollY - depart) > 24) { depart = racine.scrollY; setBarre(null); setSousBarre(null); } };
        const exterieur = (e) => {
          const t = e.target;
          if (!t.closest) return;
          if (!t.closest('.menus-composition, .popover-menu')) setMenu(null);
          if (!t.closest('.barre-flottante, .popover-menu')) setSousBarre(null);
          if (!t.closest('.editeur-bloc, .menus-composition, .popover-menu, .barre-flottante, .barre-blocs, .calque, .barre')) { setEdition(null); setSelection({ i: null, n: [] }); }
        };
        const echap = (e) => {
          if (e.key !== 'Escape') return;
          if (menu || sousBarre) { setMenu(null); setSousBarre(null); return; }
          const ed = vu.current.edition;
          if (ed) { setEdition(null); setSelection({ i: ed.i, n: [ed.n] }); }
        };
        racine.addEventListener('scroll', defiler, { passive: true });
        document.addEventListener('pointerdown', exterieur);
        document.addEventListener('keydown', echap);
        return () => { racine.removeEventListener('scroll', defiler); document.removeEventListener('pointerdown', exterieur); document.removeEventListener('keydown', echap); };
      }, [menu, sousBarre]);

      /* ---------- Édition ---------- */
      const ouvrirBloc = (i, n, depart) => { selRef.current = depart && depart.sel ? depart.sel : { debut: 0, fin: 0 }; setBarre(null); setSelection({ i: null, n: [] }); setEdition({ i, n, depart, cle: Date.now() }); dispatch({ type: 'slide', index: i }); };
      const vu = useRef({});
      vu.current = { article, compositions, selection, k, fmt, edition, imageChoisie };
      // Logo et fleurs d'une slide : placés à la main (slide.images) ou, à défaut, ceux du gabarit, convertis au premier geste.
      const estImage = (e) => e.type === 'image' && (e.cle === 'fleurs' || e.cle === 'logo' || e.cle === 'logoClair');
      const imagesSlide = (i) => { const { article: a, compositions: cs } = vu.current; const sl = a.slides[i]; return Array.isArray(sl.images) ? sl.images.map((x) => ({ ...x })) : (cs[i] ? M.imagesDe(cs[i]) : []); };
      const boitesImages = (i) => { const cs = vu.current.compositions; return cs[i] ? cs[i].elements.filter(estImage) : []; };
      const imageAuPoint = (i, p) => { const els = boitesImages(i); for (let k = els.length - 1; k >= 0; k--) { const b = els[k]; if (p.x >= b.x && p.x <= b.x + b.l && p.y >= b.y && p.y <= b.y + b.h) return { k, verrou: !!b.verrou }; } return null; };
      const nomImage = (imgs, k) => { const x = imgs[k]; const memes = imgs.filter((y) => y.type === x.type); return (x.type === 'fleurs' ? 'Fleurs' : 'Logo') + (memes.length > 1 ? ' ' + (memes.indexOf(x) + 1) : ''); };
      const majImages = (i, images, annonce) => majA(OP.slide(i, { ...vu.current.article.slides[i], images }), null, annonce);
      const ajouterImage = (type) => {
        const i = active;
        const imgs = imagesSlide(i).concat([type === 'fleurs' ? { type, x: 0.31, y: 0.4, w: 0.38 } : { type, x: 0.36, y: 0.44, w: 0.28 }]);
        majImages(i, imgs, (type === 'fleurs' ? 'Fleurs ajoutées' : 'Logo ajouté') + ' au centre de la slide : glisse pour déplacer, rond blanc pour la taille.');
        setSelection({ i: null, n: [] }); setEdition(null); setImageChoisie({ i, k: imgs.length - 1 });
      };
      const coordonnees = (e, i) => {
        const cal = pagesRef.current && pagesRef.current.querySelector(`.page-slide[data-index="${i}"] .calque`);
        const r = cal.getBoundingClientRect();
        return { x: (e.clientX - r.left) / vu.current.k, y: (e.clientY - r.top) / vu.current.k };
      };
      const zonesDe = (i) => ((vu.current.compositions[i] || { elements: [] }).elements.filter((z) => z.type === 'bloc'));
      const boiteDe = (i, n, cs) => {
        const zs = (cs ? cs[i].elements.filter((z) => z.type === 'bloc') : zonesDe(i)).filter((z) => z.bloc === n);
        if (!zs.length) return null;
        const x = Math.min(...zs.map((z) => z.x)); const y = Math.min(...zs.map((z) => z.y));
        return { x, y, l: Math.max(...zs.map((z) => z.x + z.l)) - x, h: Math.max(...zs.map((z) => z.y + z.h)) - y };
      };
      // Le bloc sous le pointeur ; s'il y en a plusieurs (superposés), le plus petit.
      const blocAuPoint = (i, p) => {
        let meilleur = null;
        for (const z of zonesDe(i)) {
          if (p.x >= z.x - 10 && p.x <= z.x + z.l + 10 && p.y >= z.y - 10 && p.y <= z.y + z.h + 10 && (!meilleur || z.l * z.h < meilleur.aire)) meilleur = { n: z.bloc, aire: z.l * z.h };
        }
        return meilleur ? meilleur.n : null;
      };
      const basculerSelection = (i, n) => setSelection((sel) => (sel.i === i ? { i, n: sel.n.includes(n) ? sel.n.filter((x) => x !== n) : [...sel.n, n] } : { i, n: [n] }));
      // Repères magnétiques : marges de la charte, centre de la slide, bords et centres des autres blocs.
      function aimanter(boite, autres) {
        const { fmt: f } = vu.current;
        const vx = [M.MARGES.gauche, f.l / 2, f.l - M.MARGES.droite, ...autres.flatMap((o) => [o.x, o.x + o.l, o.x + o.l / 2])];
        const hy = [M.MARGES.haute, f.h / 2, f.h - M.MARGES.basse, ...autres.flatMap((o) => [o.y, o.y + o.h, o.y + o.h / 2])];
        const seuil = 12;
        let ax = 0; let ay = 0; let gx = null; let gy = null; let mx = seuil + 1; let my = seuil + 1;
        for (const bord of [boite.x, boite.x + boite.l / 2, boite.x + boite.l]) for (const v of vx) if (Math.abs(v - bord) < Math.abs(mx)) { mx = v - bord; gx = v; }
        for (const bord of [boite.y, boite.y + boite.h / 2, boite.y + boite.h]) for (const v of hy) if (Math.abs(v - bord) < Math.abs(my)) { my = v - bord; gy = v; }
        if (Math.abs(mx) <= seuil) ax = mx; else gx = null;
        if (Math.abs(my) <= seuil) ay = my; else gy = null;
        return { ax, ay, gx, gy };
      }
      // Écouteurs du document : des fonctions stables qui appellent toujours la version à jour des gestionnaires
      // (sinon un écouteur d'un rendu précédent resterait branché et traiterait le geste à la place du bon).
      const gestionnaires = useRef({});
      gestionnaires.current = { pendant: (e) => pendantPointeur(e), fin: (e) => finPointeur(e), annuler: () => annulerPointeur() };
      const stables = useRef(null);
      if (!stables.current) stables.current = { pendant: (e) => gestionnaires.current.pendant(e), fin: (e) => gestionnaires.current.fin(e), annuler: () => gestionnaires.current.annuler() };
      const ecouter = () => { document.addEventListener('pointermove', stables.current.pendant); document.addEventListener('pointerup', stables.current.fin); document.addEventListener('pointercancel', stables.current.annuler); };
      const arreter = () => { document.removeEventListener('pointermove', stables.current.pendant); document.removeEventListener('pointerup', stables.current.fin); document.removeEventListener('pointercancel', stables.current.annuler); };
      useEffect(() => () => arreter(), []);
      function debutPointeur(e, i) {
        if (e.target.closest('.editeur-bloc') || e.target.closest('.barre-image')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const p = coordonnees(e, i);
        const cote = e.target.dataset ? e.target.dataset.cote : undefined;
        const n = cote ? selection.n[0] : blocAuPoint(i, p);
        const poignee = e.target.dataset ? e.target.dataset.poigneeImage : undefined;
        // L'élément déjà choisi passe devant le texte pour le geste ; sinon le texte reste prioritaire.
        const ch = vu.current.imageChoisie;
        const bch = ch && ch.i === i ? boitesImages(i)[ch.k] : null;
        const surChoisie = bch && !bch.verrou && p.x >= bch.x && p.x <= bch.x + bch.l && p.y >= bch.y && p.y <= bch.y + bch.h;
        const touche = surChoisie ? { k: ch.k, verrou: false } : !cote && n === null && poignee === undefined ? imageAuPoint(i, p) : null;
        if (poignee !== undefined || (touche && !touche.verrou)) {
          e.preventDefault();
          if (edition) setEdition(null);
          geste.current = { type: poignee !== undefined ? 'redimImage' : 'image', i, k: poignee !== undefined ? Number(poignee) : touche.k, x0: e.clientX, y0: e.clientY, p0: p, bouge: false, tactile: e.pointerType === 'touch' };
          ecouter();
          return;
        }
        const tactile = e.pointerType === 'touch';
        if (n !== null || cote) e.preventDefault(); // pas de sélection de texte par le navigateur
        if (edition && !(edition.i === i && edition.n === n)) setEdition(null);
        const g = { type: cote ? 'redim' : n !== null ? 'bloc' : 'vide', i, n, cote, x0: e.clientX, y0: e.clientY, p0: p, bouge: false, tactile, mod: e.shiftKey || e.metaKey || e.ctrlKey };
        // Au doigt : un appui long ajoute le bloc à la sélection.
        if (tactile && n !== null && !cote) g.minuterie = setTimeout(() => { if (!g.bouge && geste.current === g) { g.appuiLong = true; basculerSelection(i, n); if (navigator.vibrate) navigator.vibrate(10); } }, 450);
        geste.current = g;
        ecouter();
      }
      function commencerGlisser(g) {
        const { article: a, compositions: cs, selection: sel } = vu.current;
        const slide = a.slides[g.i];
        if (g.type === 'bloc' && !(sel.i === g.i && sel.n.includes(g.n))) { setSelection({ i: g.i, n: [g.n] }); g.indices = [g.n]; } else g.indices = g.type === 'redim' ? [g.n] : sel.n.slice();
        g.base = slide.libre ? slide : M.figerSlide(slide, cs[g.i]);
        g.depart = g.indices.map((n) => ({ n, pos: g.base.blocs[n] && g.base.blocs[n].pos ? { ...g.base.blocs[n].pos } : null, boite: boiteDe(g.i, n, cs) })).filter((d) => d.pos && d.boite);
        g.autres = cs[g.i].elements.filter((z) => z.type === 'bloc' && !g.indices.includes(z.bloc));
        g.k = vu.current.k;
        setApercu({ i: g.i, slide: g.base, cote: g.type === 'redim' ? g.cote : null });
        setMenu(null); setBarre(null); setSurvol(null);
      }
      function pendantPointeur(e) {
        const g = geste.current;
        if (!g) return;
        if (g.type === 'image' || g.type === 'redimImage') {
          if (!g.bouge) {
            if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
            const ch = vu.current.imageChoisie;
            // Au doigt, glisser sur un élément non choisi fait défiler la page : on le touche d'abord pour le choisir.
            if (g.tactile && g.type === 'image' && !(ch && ch.i === g.i && ch.k === g.k)) { arreter(); geste.current = null; return; }
            g.bouge = true; g.echelle = vu.current.k; g.depart = imagesSlide(g.i);
            setMenu(null); setBarre(null);
          }
          const f = vu.current.compositions[g.i].fmt;
          const dx = (e.clientX - g.x0) / g.echelle / f.l;
          const dy = (e.clientY - g.y0) / g.echelle / f.h;
          // L'élément peut déborder de la slide, mais jamais de plus de la moitié : sa poignée reste toujours à portée.
          const hauteur = (x) => x.w * (x.type === 'fleurs' ? 275 / 696 : M.RATIO_LOGO) * f.l / f.h;
          const borne = (v, a, b) => Math.max(a, Math.min(b, v));
          const imgs = g.depart.map((x, k) => (k !== g.k ? x : g.type === 'image'
            ? { ...x, x: borne(x.x + dx, -x.w / 2, 1 - x.w / 2), y: borne(x.y + dy, -hauteur(x) / 2, 1 - hauteur(x) / 2) }
            : { ...x, w: borne(x.w + dx, 0.06, Math.min(0.95, 1.2 - x.x)) }));
          g.final = { ...vu.current.article.slides[g.i], images: imgs };
          setApercu({ i: g.i, slide: g.final });
          return;
        }
        if (!g.bouge) {
          if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
          const sel = vu.current.selection;
          // Au doigt, glisser sur le vide ou sur un bloc non sélectionné fait défiler la page.
          if (g.tactile && (g.type === 'vide' || (g.type === 'bloc' && !(sel.i === g.i && sel.n.includes(g.n))))) { clearTimeout(g.minuterie); arreter(); geste.current = null; return; }
          g.bouge = true;
          clearTimeout(g.minuterie);
          if (g.type === 'bloc' || g.type === 'redim') commencerGlisser(g);
        }
        g.dernier = { clientX: e.clientX, clientY: e.clientY };
        if (g.type === 'bloc') { glisser(g); defilerAuBord(g); } else if (g.type === 'redim') redimensionner(g); else if (g.type === 'vide') tracerLasso(g);
      }
      function glisser(g) {
        if (!g.depart.length) return;
        const dx = (g.dernier.clientX - g.x0) / g.k;
        const dy = (g.dernier.clientY - g.y0) / g.k;
        const sous = document.elementsFromPoint(g.dernier.clientX, g.dernier.clientY).find((x) => x.classList && x.classList.contains('calque'));
        const ici = sous ? Number(sous.closest('.page-slide').dataset.index) : g.i;
        g.cible = ici;
        if (ici !== g.i) { setGuides(null); setCible(ici); setApercu({ i: g.i, slide: g.base }); g.final = null; return; }
        setCible(null);
        const bs = g.depart.map((d) => d.boite);
        const x0 = Math.min(...bs.map((b) => b.x)); const y0 = Math.min(...bs.map((b) => b.y));
        const boite = { x: x0 + dx, y: y0 + dy, l: Math.max(...bs.map((b) => b.x + b.l)) - x0, h: Math.max(...bs.map((b) => b.y + b.h)) - y0 };
        const a = aimanter(boite, g.autres);
        const mx = Math.round(dx + a.ax); const my = Math.round(dy + a.ay);
        const slide = { ...g.base, blocs: g.base.blocs.map((b, n) => { const d = g.depart.find((x) => x.n === n); return d ? { ...b, pos: { ...d.pos, x: d.pos.x + mx, y: d.pos.y + my } } : b; }) };
        g.final = slide;
        setApercu({ i: g.i, slide });
        setGuides({ i: g.i, gx: a.gx, gy: a.gy });
      }
      function redimensionner(g) {
        const d = g.depart[0];
        if (!d) return;
        const dx = (g.dernier.clientX - g.x0) / g.k;
        let x = d.pos.x; let l = d.pos.l;
        if (g.cote === 'd') l = Math.max(160, d.pos.l + dx);
        else { l = Math.max(160, d.pos.l - dx); x = d.pos.x + d.pos.l - l; }
        const a = aimanter(g.cote === 'd' ? { x: x + l, y: -999, l: 0, h: 0 } : { x, y: -999, l: 0, h: 0 }, g.autres);
        if (g.cote === 'd') l += a.ax; else { x += a.ax; l -= a.ax; }
        const slide = { ...g.base, blocs: g.base.blocs.map((b, n) => (n === d.n ? { ...b, pos: { ...b.pos, x: Math.round(x), l: Math.round(l) } } : b)) };
        g.final = slide;
        setApercu({ i: g.i, slide, cote: g.cote });
        setGuides({ i: g.i, gx: a.gx, gy: null });
      }
      function tracerLasso(g) {
        const p = coordonnees(g.dernier, g.i);
        const x = Math.min(p.x, g.p0.x); const y = Math.min(p.y, g.p0.y);
        g.boite = { x, y, l: Math.abs(p.x - g.p0.x), h: Math.abs(p.y - g.p0.y) };
        setLasso({ i: g.i, ...g.boite });
      }
      // En glissant un bloc près du bord de l'écran, la page défile (pour l'emmener sur une autre slide).
      function defilerAuBord(g) {
        if (g.boucle) return;
        const pas = () => {
          if (geste.current !== g || !g.bouge || !g.dernier) { g.boucle = null; return; }
          const y = g.dernier.clientY;
          const haut = 140;
          const v = y > racine.innerHeight - 70 ? Math.min(26, (y - (racine.innerHeight - 70)) / 2 + 6) : y < haut ? -Math.min(26, (haut - y) / 2 + 6) : 0;
          if (!v) { g.boucle = null; return; }
          racine.scrollBy(0, v);
          g.y0 -= v;
          glisser(g);
          g.boucle = racine.requestAnimationFrame(pas);
        };
        g.boucle = racine.requestAnimationFrame(pas);
      }
      function finPointeur(e) {
        const g = geste.current;
        arreter();
        geste.current = null;
        if (!g) return;
        clearTimeout(g.minuterie);
        setGuides(null); setCible(null);
        if (g.type === 'image' || g.type === 'redimImage') {
          if (g.bouge && g.final) { majA(OP.slide(g.i, g.final), null); setApercu(null); }
          setImageChoisie({ i: g.i, k: g.k }); setSelection({ i: null, n: [] }); dispatch({ type: 'slide', index: g.i });
          return;
        }
        setImageChoisie(null);
        if (!g.bouge) {
          if (g.type === 'bloc') {
            if (g.appuiLong) return;
            const sel = vu.current.selection;
            if (g.mod) { basculerSelection(g.i, g.n); dispatch({ type: 'slide', index: g.i }); return; }
            // Un bloc déjà sélectionné, touché à nouveau : il s'ouvre en écriture, curseur à l'endroit touché.
            if (sel.i === g.i && sel.n.length === 1 && sel.n[0] === g.n) { ouvrirBloc(g.i, g.n, { point: { x: e.clientX, y: e.clientY } }); return; }
            setSelection({ i: g.i, n: [g.n] });
            dispatch({ type: 'slide', index: g.i });
            return;
          }
          if (g.type === 'vide') {
            // Deux clics (ou deux touchers) rapprochés sur le vide : un nouveau bloc à cet endroit.
            const t = Date.now();
            const d = dernierTapVide.current;
            if (d && d.i === g.i && t - d.t < 380 && Math.hypot(d.p.x - g.p0.x, d.p.y - g.p0.y) < 40) { dernierTapVide.current = null; creerBlocAuPoint(g.i, g.p0); return; }
            dernierTapVide.current = { t, i: g.i, p: g.p0 };
            setSelection({ i: null, n: [] });
            setEdition(null);
            dispatch({ type: 'slide', index: g.i });
          }
          return;
        }
        if (g.type === 'bloc') {
          if (g.cible !== undefined && g.cible !== g.i) poserSurSlide(g, e);
          else if (g.final) majA(OP.slide(g.i, g.final), null, g.indices.length > 1 ? `${g.indices.length} blocs déplacés.` : 'Bloc déplacé.');
          setApercu(null);
          return;
        }
        if (g.type === 'redim') { if (g.final) majA(OP.slide(g.i, g.final), null, 'Largeur du bloc modifiée.'); setApercu(null); return; }
        if (g.type === 'vide') {
          setLasso(null);
          const b = g.boite;
          if (!b) return;
          const choisis = [...new Set(zonesDe(g.i).filter((z) => z.x < b.x + b.l && z.x + z.l > b.x && z.y < b.y + b.h && z.y + z.h > b.y).map((z) => z.bloc))];
          setSelection(choisis.length ? { i: g.i, n: choisis } : { i: null, n: [] });
          dispatch({ type: 'slide', index: g.i });
        }
      }
      function annulerPointeur() {
        const g = geste.current;
        arreter();
        geste.current = null;
        if (g) clearTimeout(g.minuterie);
        setApercu(null); setGuides(null); setLasso(null); setCible(null);
      }
      // Lâcher sur une autre slide : le groupe y est posé à l'endroit visé (elle passe en mise en page libre).
      function poserSurSlide(g, e) {
        const { article: a, compositions: cs } = vu.current;
        const j = g.cible;
        const baseJ = a.slides[j].libre ? a.slides[j] : M.figerSlide(a.slides[j], cs[j]);
        const pj = coordonnees(e, j);
        const x0 = Math.min(...g.depart.map((d) => d.pos.x)); const y0 = Math.min(...g.depart.map((d) => d.pos.y));
        const prise = { x: g.p0.x - x0, y: g.p0.y - y0 };
        const positions = g.depart.map((d) => ({ ...d.pos, x: Math.round(pj.x - prise.x + d.pos.x - x0), y: Math.round(pj.y - prise.y + d.pos.y - y0) }));
        const indices = g.depart.map((d) => d.n);
        const nbAvant = baseJ.blocs.length;
        majA(OP.envoyerSurSlide(g.i, indices, j, positions, g.base, baseJ), null, `${indices.length > 1 ? indices.length + ' blocs envoyés' : 'Bloc envoyé'} sur la slide ${j + 1}.`);
        const resteDansSource = a.slides[g.i].blocs.length - indices.length;
        const jFinal = resteDansSource === 0 && j > g.i ? j - 1 : j;
        setSelection({ i: jFinal, n: indices.map((_, q) => nbAvant + q) });
        dispatch({ type: 'slide', index: jFinal });
      }
      function creerBlocAuPoint(i, p) {
        const { compositions: cs, fmt: f } = vu.current;
        const nb = article.slides[i].blocs.length;
        const l = Math.max(240, Math.min(620, f.l - M.MARGES.droite - p.x));
        majA((a) => {
          let x = a;
          if (!x.slides[i].libre) x = OP.slide(i, M.figerSlide(x.slides[i], cs[i]))(x);
          x = L.insererParagrapheApres(x, i, nb - 1, 'Nouveau texte');
          return { ...x, slides: x.slides.map((sl, kk) => (kk !== i ? sl : { ...sl, blocs: sl.blocs.map((b, n) => (n === nb ? { ...b, pos: { x: Math.round(p.x), y: Math.round(p.y), l: Math.round(l) } } : b)) })) };
        }, null, 'Nouveau bloc : écris ton texte.');
        ouvrirBloc(i, nb, { sel: { debut: 0, fin: 'Nouveau texte'.length } });
      }

      /* ---------- Actions sur les blocs sélectionnés ---------- */
      const ordreDeLecture = (i, indices) => [...indices].sort((p, q) => { const a = boiteDe(i, p) || { x: 0, y: 0 }; const b = boiteDe(i, q) || { x: 0, y: 0 }; return a.y - b.y || a.x - b.x; });
      const figeeOuActuelle = (i) => (article.slides[i].libre ? article.slides[i] : M.figerSlide(article.slides[i], compositions[i]));
      const actionsBlocs = {
        fusionner() {
          const { i, n } = selection;
          if (n.length < 2) return;
          const ordre = ordreDeLecture(i, n);
          majA(OP.fusionnerPlusieurs(i, ordre), null, `${n.length} blocs fusionnés en un seul paragraphe, aussi dans le texte de l’article.`);
          setSelection({ i, n: [Math.min(...n)] });
        },
        dupliquer() {
          const { i, n } = selection;
          const tries = [...n].sort((p, q) => p - q);
          majA(OP.dupliquerBlocs(i, tries), null, n.length > 1 ? `${n.length} blocs dupliqués.` : 'Bloc dupliqué.');
          setSelection({ i, n: tries.map((x, q) => x + 1 + q) });
        },
        nouveau() {
          const i = selection.i !== null ? selection.i : active;
          const apres = selection.n.length ? Math.max(...selection.n) : article.slides[i].blocs.length - 1;
          const boite = boiteDe(i, apres);
          majA((a) => {
            let x = L.insererParagrapheApres(a, i, apres, 'Nouveau texte');
            const s = x.slides[i];
            if (s.libre && boite) x = { ...x, slides: x.slides.map((sl, kk) => (kk !== i ? sl : { ...sl, blocs: sl.blocs.map((b, m) => (m === apres + 1 ? { ...b, pos: { x: Math.round(boite.x), y: Math.round(boite.y + boite.h + 40), l: Math.round(boite.l) } } : b)) })) };
            return x;
          }, null, 'Nouveau bloc, aussi dans le texte de l’article.');
          ouvrirBloc(i, apres + 1, { sel: { debut: 0, fin: 'Nouveau texte'.length } });
        },
        supprimer() {
          const { i, n } = selection;
          if (!n.length) return;
          const vide = article.slides[i].blocs.length === n.length && total > 1;
          majA((a) => { const x = OP.supprimerBlocs(i, n)(a); return vide ? { ...x, slides: x.slides.filter((_, kk) => kk !== i) } : x; }, null,
            `${n.length > 1 ? n.length + ' blocs supprimés' : 'Bloc supprimé'}, avec leur texte dans l’article.${vide ? ' La slide, vide, a été retirée.' : ''}`);
          setSelection({ i: null, n: [] });
        },
        aligner(mode) {
          const { i, n } = selection;
          if (!n.length) return;
          const base = figeeOuActuelle(i);
          const boites = Object.fromEntries(n.map((x) => [x, boiteDe(i, x)]));
          const gauche = Math.min(...n.map((x) => base.blocs[x].pos.x));
          let blocs = base.blocs.map((b, m) => {
            if (!n.includes(m) || !b.pos) return b;
            const p = { ...b.pos };
            if (mode === 'marge') p.x = M.MARGES.gauche;
            else if (mode === 'centre') p.x = Math.round((fmt.l - p.l) / 2);
            else if (mode === 'droite') p.x = fmt.l - M.MARGES.droite - p.l;
            else if (mode === 'entre') p.x = gauche;
            return { ...b, pos: p };
          });
          if (mode === 'repartir' && n.length > 2) {
            const tries = [...n].sort((p, q) => blocs[p].pos.y - blocs[q].pos.y);
            const hauteurs = tries.map((x) => (boites[x] ? boites[x].h : 0));
            const debut = blocs[tries[0]].pos.y;
            const fin = blocs[tries[tries.length - 1]].pos.y + hauteurs[hauteurs.length - 1];
            const vide = (fin - debut - hauteurs.reduce((a, b) => a + b, 0)) / (tries.length - 1);
            let y = debut;
            const nouvellesY = {};
            tries.forEach((x, q) => { nouvellesY[x] = Math.round(y); y += hauteurs[q] + vide; });
            blocs = blocs.map((b, m) => (nouvellesY[m] !== undefined ? { ...b, pos: { ...b.pos, y: nouvellesY[m] } } : b));
          }
          majA(OP.slide(i, { ...base, blocs }), null, 'Blocs alignés.');
        },
        revenir(i) {
          majA(OP.slide(i, M.revenirAuGabarit(article.slides[i])), null, `Slide ${i + 1} : mise en page du gabarit rétablie.`);
          setSelection({ i: null, n: [] });
        },
        pousser(dx, dy) {
          const { i, n } = selection;
          const base = figeeOuActuelle(i);
          majA(OP.slide(i, { ...base, blocs: base.blocs.map((b, m) => (n.includes(m) && b.pos ? { ...b, pos: { ...b.pos, x: b.pos.x + dx, y: b.pos.y + dy } } : b)) }), `pousser-${i}`);
        },
        toutSelectionner(i) { setEdition(null); setSelection({ i, n: article.slides[i].blocs.map((_, m) => m).filter((m) => article.slides[i].blocs[m].texte.trim()) }); },
      };
      // La sélection ne survit pas à une slide qui change de nombre de blocs (annulation, synchronisation…).
      useEffect(() => {
        if (selection.i === null) return;
        const s = article.slides[selection.i];
        if (!s || selection.n.some((n) => n >= s.blocs.length)) setSelection({ i: null, n: [] });
      }, [article.slides]);
      // Clavier, hors écriture : ⌫ supprime, flèches déplacent (⇧ : de 10), ↩ écrit, ⌘A sélectionne tout, Échap désélectionne.
      useEffect(() => {
        const touche = (e) => {
          if (edition || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); actionsBlocs.toutSelectionner(selection.i !== null ? selection.i : active); return; }
          if (!selection.n.length) return;
          if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); actionsBlocs.supprimer(); }
          else if (e.key === 'Escape') setSelection({ i: null, n: [] });
          else if (e.key === 'Enter' && selection.n.length === 1) { e.preventDefault(); const b = article.slides[selection.i].blocs[selection.n[0]]; ouvrirBloc(selection.i, selection.n[0], { sel: { debut: b.texte.length, fin: b.texte.length } }); }
          else if (e.key.startsWith('Arrow') && !mod) {
            e.preventDefault();
            const pas = e.shiftKey ? 10 : 1;
            actionsBlocs.pousser(e.key === 'ArrowLeft' ? -pas : e.key === 'ArrowRight' ? pas : 0, e.key === 'ArrowUp' ? -pas : e.key === 'ArrowDown' ? pas : 0);
          }
        };
        document.addEventListener('keydown', touche);
        return () => document.removeEventListener('keydown', touche);
      });

      const ecrire = (texte, sel, zoneSaisie) => {
        if (!edition || !blocCourant) return null;
        const { i, n } = edition;
        // Typographie française : seulement autour de ce qui vient d'être tapé ou collé dans ce paragraphe.
        const r = T && T.enFrancais(article) ? T.corrigerSaisie(blocCourant.texte, texte, { curseur: sel ? sel.fin : texte.length, zone: zoneSaisie }) : null;
        const corrige = r && r.remplacements.length > 0;
        const final = corrige ? r.texte : texte;
        majA(blocCourant.lien ? OP.blocLie(i, n, final) : OP.modifierBloc(i, n, { texte: final }), `edition-${i}-${n}`);
        if (!corrige) return null;
        // De quoi annuler cette correction plus tard, même si l'on a continué d'écrire.
        const inverses = T.inverser(r.remplacements);
        let trace;
        if (blocCourant.lien) {
          const d0 = blocCourant.lien.debut;
          trace = { base: L.sourceDe(L.modifierBlocLie(article, i, n, final)), inverses: inverses.map((x) => ({ ...x, debut: x.debut + d0, fin: x.fin + d0 })) };
        } else trace = { i, n, base: final, inverses };
        dispatch({ type: 'message', message: { texte: 'Typographie corrigée : ' + T.resume(r.remplacements) + '.', annulation: { type: 'article', id: article.id, maj: (a) => T.annulerTrace(a, trace) } } });
        return { curseur: r.curseur };
      };
      function toucher(e, el) {
        if (!edition) return;
        const { i, n } = edition;
        const s = selectionDans(el) || { debut: 0, fin: 0 };
        const longueur = lireTexte(el).length;
        const mod = e.metaKey || e.ctrlKey;
        const touche = e.key;
        if (mod && ['b', 'i', 'u'].includes(touche.toLowerCase())) { e.preventDefault(); basculer({ b: 'gras', i: 'italique', u: 'souligne' }[touche.toLowerCase()]); return; }
        if (touche === 'Enter' && mod) {
          e.preventDefault();
          if (n === 0 && s.debut === 0) return;
          majA(OP.couper(i, n, s.debut), null, `Saut de slide : la suite est sur la slide ${i + 2}.`);
          ouvrirBloc(i + 1, 0, { sel: { debut: 0, fin: 0 } });
          return;
        }
        if (touche === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          majA(OP.scinderBloc(i, n, s.fin), `edition-${i}-${n}`);
          ouvrirBloc(i, n + 1, { sel: { debut: 0, fin: 0 } });
          return;
        }
        if (touche === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
        const replie = s.debut === s.fin;
        if (touche === 'Backspace' && replie && s.debut === 0 && !mod && !e.altKey) {
          if (n > 0) {
            e.preventDefault();
            const r = L.fusionnerBlocs(article, i, n);
            if (r) { majA(OP.fusionnerBlocs(i, n)); ouvrirBloc(i, n - 1, { sel: { debut: r.jonction, fin: r.jonction } }); }
            else { const p = article.slides[i].blocs[n - 1]; ouvrirBloc(i, n - 1, { sel: { debut: p.texte.length, fin: p.texte.length } }); }
            return;
          }
          if (i > 0) {
            e.preventDefault();
            const nbAvant = article.slides[i - 1].blocs.length;
            const apres = L.retirerCoupure(article, i - 1);
            const fusionne = apres.slides[i - 1].blocs.length === nbAvant + article.slides[i].blocs.length - 1;
            const jonction = fusionne ? apres.slides[i - 1].blocs[nbAvant - 1].texte.length - article.slides[i].blocs[0].texte.length : 0;
            majA(OP.retirerCoupure(i - 1), null, `Slides ${i} et ${i + 1} réunies.`);
            ouvrirBloc(i - 1, fusionne ? nbAvant - 1 : nbAvant, { sel: { debut: jonction, fin: jonction } });
          }
          return;
        }
        if (replie && (touche === 'ArrowUp' || touche === 'ArrowLeft') && s.debut === 0) {
          const prec = n > 0 ? [i, n - 1] : i > 0 ? [i - 1, article.slides[i - 1].blocs.length - 1] : null;
          if (prec) { e.preventDefault(); const t = article.slides[prec[0]].blocs[prec[1]].texte.length; ouvrirBloc(prec[0], prec[1], { sel: { debut: t, fin: t } }); }
          return;
        }
        if (replie && (touche === 'ArrowDown' || touche === 'ArrowRight') && s.debut === longueur) {
          const suiv = n < article.slides[i].blocs.length - 1 ? [i, n + 1] : i < total - 1 ? [i + 1, 0] : null;
          if (suiv) { e.preventDefault(); ouvrirBloc(suiv[0], suiv[1], { sel: { debut: 0, fin: 0 } }); }
        }
      }
      // Quand l'édition se ferme, un paragraphe vidé est retiré.
      const precedente = useRef(null);
      useEffect(() => {
        const p = precedente.current;
        precedente.current = edition;
        if (p && (!edition || edition.i !== p.i || edition.n !== p.n)) {
          const b = article.slides[p.i] && article.slides[p.i].blocs[p.n];
          if (b && !b.texte.trim() && article.slides[p.i].blocs.length > 1) majA(OP.supprimerBlocs(p.i, [p.n]));
        }
      }, [edition]);

      /* ---------- Mise en forme ---------- */
      const plage = () => { const { debut, fin } = selRef.current; return fin > debut ? [debut, Math.min(fin, blocCourant.texte.length)] : [0, blocCourant.texte.length]; };
      // Les cibles d'une mise en forme : le passage sélectionné dans le paragraphe en écriture, sinon les blocs sélectionnés, entiers.
      const cibles = () => {
        if (edition && blocCourant) { const [d, f] = plage(); return [{ i: edition.i, n: edition.n, d, f, b: blocCourant }]; }
        if (selection.i !== null && article.slides[selection.i]) return selection.n.map((n) => article.slides[selection.i].blocs[n]).map((b, q) => (b ? { i: selection.i, n: selection.n[q], d: 0, f: b.texte.length, b } : null)).filter(Boolean);
        return [];
      };
      const exigerBloc = () => { if (!cibles().length) { dispatch({ type: 'message', message: 'Sélectionne un bloc, ou clique dans un paragraphe d’une slide.' }); return false; } return true; };
      const apresForme = () => setVersion((v) => v + 1);
      const appliquer = (fabriquer, annonce, groupe) => { const cs = cibles(); majA((a) => cs.reduce((x, c) => fabriquer(c)(x), a), groupe || null, annonce); apresForme(); };
      function basculer(cle) {
        if (!exigerBloc()) return;
        const cs = cibles();
        const base = (b) => (cle === 'gras' ? NATURES_GRASSES.includes(b.style) : false);
        const actif = cs.every((c) => L.partoutVrai(c.b.marques, c.d, c.f, cle, base(c.b)));
        appliquer((c) => OP.formater(c.i, c.n, c.d, c.f, { [cle]: !actif === base(c.b) ? null : !actif }));
      }
      function formater(changement, annonce) { if (exigerBloc()) appliquer((c) => OP.formater(c.i, c.n, c.d, c.f, changement), annonce); }
      function paragraphe(champs) { if (exigerBloc()) appliquer((c) => OP.paragraphe(c.i, c.n, typeof champs === 'function' ? champs(c) : champs)); }
      const etatSel = () => {
        if (!blocCourant) {
          const c = cibles()[0];
          if (!c) return {};
          return { gras: L.partoutVrai(c.b.marques, 0, c.f, 'gras', NATURES_GRASSES.includes(c.b.style)), italique: L.partoutVrai(c.b.marques, 0, c.f, 'italique', false), souligne: L.partoutVrai(c.b.marques, 0, c.f, 'souligne', false), style: c.b.style, alignement: c.b.alignement, filet: c.b.filet };
        }
        const [debut, fin] = plage();
        const base = NATURES_GRASSES.includes(blocCourant.style);
        const tailles = [...new Set((blocCourant.marques || []).filter((m) => m.debut < fin && m.fin > debut).map((m) => m.taille || 0))];
        return {
          gras: L.partoutVrai(blocCourant.marques, debut, fin, 'gras', base), italique: L.partoutVrai(blocCourant.marques, debut, fin, 'italique', false), souligne: L.partoutVrai(blocCourant.marques, debut, fin, 'souligne', false),
          filetLignes: L.partoutVrai(blocCourant.marques, debut, fin, 'filet', false),
          taille: tailles.length === 1 && tailles[0] ? tailles[0] : null, alignement: blocCourant.alignement || (M.gabaritParDefaut(article.slides[edition.i], edition.i) === 'F1' ? 'centre' : 'gauche'),
          filet: blocCourant.filet !== undefined ? blocCourant.filet : blocCourant.style === 'citation' && !!fond.filet && ['T1', 'T3', 'T5'].includes(M.gabaritParDefaut(article.slides[edition.i], edition.i)),
          style: blocCourant.style,
        };
      };
      const st = etatSel();
      const presets = [['Petit', Math.round(charte.tailleTexte * 0.85)], ['Texte', charte.tailleTexte], ['Moyen', Math.round(charte.tailleTexte * 1.5)], ['Grand', Math.round(charte.tailleTitre * 0.75)], ['Titre', charte.tailleTitre]];
      const parDefautF1 = (c) => (M.gabaritParDefaut(article.slides[c.i], c.i) === 'F1' ? 'centre' : 'gauche');
      const filetParDefaut = (c) => c.b.style === 'citation' && !!fond.filet && ['T1', 'T3', 'T5'].includes(M.gabaritParDefaut(article.slides[c.i], c.i));
      const aligner = (a) => paragraphe((c) => ({ alignement: a === parDefautF1(c) ? null : a }));
      const basculerFilet = () => {
        if (!exigerBloc()) return;
        const actuel = (c) => (c.b.filet !== undefined ? c.b.filet : filetParDefaut(c));
        const tous = cibles().every(actuel);
        paragraphe((c) => ({ filet: !tous === filetParDefaut(c) ? null : !tous }));
      };
      const effacer = () => { const enEcriture = !!blocCourant; const { debut, fin } = selRef.current; formater({ gras: null, italique: null, souligne: null, taille: null, couleur: null }); if (!enEcriture || fin <= debut) paragraphe({ alignement: null, filet: null }); };
      const natureDe = (n) => { if (exigerBloc()) appliquer((c) => OP.modifierBloc(c.i, c.n, { style: n })); };

      /* ---------- Contenus des menus ---------- */
      const item = (libelle, action, extra = {}) => ({ type: 'action', libelle, action, ...extra });
      const trait = { type: 'trait' };
      const natures = () => M.naturesUtiles(M.gabaritParDefaut(article.slides[edition ? edition.i : active], edition ? edition.i : active));
      const menuTaille = () => [
        { type: 'titre', libelle: 'Tailles de la charte' },
        ...presets.map(([nom, px]) => item(nom, () => formater({ taille: px }, `Taille ${px} px.`), { raccourci: px + ' px', coche: st.taille === px })),
        item('Taille d’origine', () => formater({ taille: null }, 'Taille d’origine rétablie.')),
        { type: 'titre', libelle: 'Taille libre' },
        { type: 'libre', rendu: (fermer) => h(TailleLibre, { appliquer: (px) => { fermer(); formater({ taille: px }, `Taille ${px} px.`); } }) },
      ];
      const menuCouleur = () => [
        { type: 'titre', libelle: 'Couleurs permises sur ce fond' },
        item(h(Fragment, null, h('span', { className: 'pastille-couleur', style: { background: fond.texte } }), 'Couleur du texte'), () => formater({ couleur: 'texte' })),
        item(h(Fragment, null, h('span', { className: 'pastille-couleur', style: { background: fond.accent } }), 'Couleur de mise en valeur'), () => formater({ couleur: 'accent' })),
        item('Couleur d’origine', () => formater({ couleur: null })),
      ];
      // Filet latéral : à côté des lignes choisies (sélection pendant l'écriture) ou du paragraphe entier ; couleurs de la charte ou couleur libre.
      const menuFilet = () => {
        const [d, f] = blocCourant ? plage() : [0, 0];
        const lignes = !!blocCourant && f > d;
        const vus = new Set();
        const couleurs = [['charte', 'Filet de la charte', fond.filet || fond.accent], ['accent', 'Couleur de mise en valeur', fond.accent], ['texte', 'Couleur du texte', fond.texte]]
          .concat(Object.entries(charte.palette || {}).map(([nom, hex]) => { const joli = nom.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/\bpale\b/, 'pâle'); return [hex, 'Charte · ' + joli, hex]; }))
          .filter(([, , hex]) => { const k = String(hex).toLowerCase(); if (vus.has(k)) return false; vus.add(k); return true; });
        const poser = (v) => { setDernierFilet(v); if (lignes) formater({ filet: v }, 'Filet ajouté à côté des lignes choisies.'); else paragraphe({ filet: true, filetCouleur: v === 'charte' ? null : v }); };
        return [
          { type: 'titre', libelle: lignes ? 'À côté des lignes choisies' : 'À côté du paragraphe entier (sélectionne des lignes pour les cibler)' },
          ...couleurs.map(([v, nom, hex]) => item(h(Fragment, null, h('span', { className: 'pastille-couleur', style: { background: hex } }), nom), () => poser(v))),
          { type: 'libre', rendu: () => h('label', { className: 'couleur-libre' }, h('span', null, 'Couleur libre'), h('input', { type: 'color', defaultValue: '#003846', 'aria-label': 'Choisir une couleur libre pour le filet', onChange: (e) => poser(e.target.value) })) },
          trait,
          lignes
            ? item('Retirer le filet de ces lignes', () => formater({ filet: null }))
            : item('Filet sur tout le paragraphe', () => (blocCourant || cibles().length ? basculerFilet() : exigerBloc()), { coche: blocCourant ? st.filet : undefined }),
        ];
      };
      // Bouton filet de la barre : avec des lignes choisies, il ne touche qu'elles (et les retire si elles ont déjà un filet).
      const filetLignes = () => {
        if (!blocCourant) return basculerFilet();
        const [d, f] = plage();
        if (f <= d) return basculerFilet();
        const deja = L.partoutVrai(blocCourant.marques, d, f, 'filet', false);
        formater({ filet: deja ? null : dernierFilet }, deja ? 'Filet retiré de ces lignes.' : 'Filet ajouté à côté des lignes choisies.');
      };
      const couleurFiletVue = dernierFilet === 'charte' ? fond.filet || fond.accent : dernierFilet === 'accent' ? fond.accent : dernierFilet === 'texte' ? fond.texte : dernierFilet;
      // Fond du paragraphe : aucun, couleur, rectangle ou suivant les lignes, angles arrondis ou droits ; ou celui du gabarit.
      const luminance = (hex) => { const c = String(hex || '').replace('#', ''); if (c.length !== 6) return 0.5; const v = [0, 2, 4].map((k) => { const x = parseInt(c.slice(k, k + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const couleurDe = (v) => (v === 'charte' ? fond.filet || fond.accent : v === 'accent' ? fond.accent : v === 'texte' ? fond.texte : v);
      const fondActuel = () => { const c = cibles()[0]; return c && c.b.fondBloc && typeof c.b.fondBloc === 'object' ? c.b.fondBloc : null; };
      const poserFond = (champs, annonce) => {
        if (!blocCourant && !cibles().length) return exigerBloc();
        paragraphe((c) => ({ fondBloc: { couleur: 'accent', forme: 'rectangle', angles: 'arrondis', ...(c.b.fondBloc && typeof c.b.fondBloc === 'object' ? c.b.fondBloc : {}), ...champs } }));
        const couleur = couleurDe(champs.couleur || (fondActuel() || {}).couleur || 'accent');
        dispatch({ type: 'message', message: contraste(couleur, fond.texte) < 3 && contraste(couleur, fond.accent) < 3 ? 'Attention : le texte risque d’être peu lisible sur ce fond. Change sa couleur (Format › Couleur) ou choisis un autre fond.' : (annonce || 'Fond du paragraphe modifié.') });
      };
      const menuFond = () => {
        const actuel = fondActuel();
        const vus = new Set();
        const couleurs = [['accent', 'Couleur de mise en valeur', fond.accent], ['texte', 'Couleur du texte', fond.texte]]
          .concat(Object.entries(charte.palette || {}).map(([nom, hex]) => [hex, 'Charte · ' + nom.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/\bpale\b/, 'pâle'), hex]))
          .filter(([, , hex]) => { const k = String(hex).toLowerCase(); if (vus.has(k)) return false; vus.add(k); return true; });
        return [
          { type: 'titre', libelle: 'Couleur du fond' },
          ...couleurs.map(([v, nom, hex]) => item(h(Fragment, null, h('span', { className: 'pastille-couleur', style: { background: hex } }), nom), () => poserFond({ couleur: v }), { coche: actuel ? actuel.couleur === v : undefined })),
          { type: 'libre', rendu: () => h('label', { className: 'couleur-libre' }, h('span', null, 'Couleur libre'), h('input', { type: 'color', defaultValue: '#E6EBEC', 'aria-label': 'Choisir une couleur libre pour le fond', onChange: (e) => poserFond({ couleur: e.target.value }) })) },
          trait,
          { type: 'titre', libelle: 'Forme' },
          item('Rectangle autour du paragraphe', () => poserFond({ forme: 'rectangle' }), { coche: actuel ? actuel.forme !== 'lignes' : undefined }),
          item('Suit les lignes du texte', () => poserFond({ forme: 'lignes' }), { coche: actuel ? actuel.forme === 'lignes' : undefined }),
          { type: 'titre', libelle: 'Angles' },
          item('Arrondis', () => poserFond({ angles: 'arrondis' }), { coche: actuel ? actuel.angles !== 'droits' : undefined }),
          item('Droits', () => poserFond({ angles: 'droits' }), { coche: actuel ? actuel.angles === 'droits' : undefined }),
          trait,
          item('Aucun fond', () => (blocCourant || cibles().length ? paragraphe({ fondBloc: 'aucun' }) : exigerBloc())),
          item('Revenir au fond du gabarit', () => (blocCourant || cibles().length ? paragraphe({ fondBloc: null }) : exigerBloc())),
        ];
      };
      // Le passage sélectionné dans le bloc en cours d'écriture (pour l'assistant).
      const texteChoisi = () => { if (!blocCourant) return ''; const [dd, ff] = plage(); return ff > dd ? blocCourant.texte.slice(dd, ff) : ''; };
      const ouvrirDiscussion = (texte, demande) => {
        setMenuIA(false); setSousBarre(null);
        if (texte) choisirPassageIA(texte);
        disc.ouvrir();
        if (demande) setTimeout(() => disc.envoyer(demande, texte || passageIA), 0);
      };
      const menuAssistant = (depuisBarre) => {
        if (!configIA) return [{ type: 'titre', libelle: 'Assistant IA' }, { type: 'note', texte: 'Pour utiliser l’IA, ajoute une clé dans Configuration, onglet IA.' }];
        const sel = texteChoisi();
        const rapides = [['Clarifier', 'Clarifie ce passage.'], ['Raccourcir', 'Raccourcis ce passage.'], ['Plus percutant', 'Rends ce passage plus percutant.'], ['3 propositions', 'Donne-moi 3 propositions différentes pour ce passage.']];
        return [
          { type: 'titre', libelle: 'Assistant IA' },
          ...(sel ? [item('Discuter de ce passage avec ' + nomIA, () => ouvrirDiscussion(sel)), ...rapides.map(([nom, demande]) => item(nom, () => ouvrirDiscussion(sel, demande)))] : [item('Discuter avec ' + nomIA, () => ouvrirDiscussion(''))]),
          ...(depuisBarre ? [] : [trait, item('Propositions de mise en page…', () => { setMenuIA(false); setPropositionsOuvertes(true); })]),
          ...(!sel && !depuisBarre ? [{ type: 'note', texte: 'Sélectionne un passage dans un bloc pour le retravailler avec l’IA.' }] : []),
        ];
      };
      const menuAlignement = () => [['gauche', 'Aligner à gauche'], ['centre', 'Centrer'], ['droite', 'Aligner à droite']].map(([v, nom]) => item(nom, () => aligner(v), { coche: blocCourant ? st.alignement === v : undefined }));
      const allerA = (i) => { dispatch({ type: 'slide', index: i }); const page = pagesRef.current && pagesRef.current.querySelector(`[data-index="${i}"]`); if (page) page.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      const nouveauParagraphe = () => {
        const [i, n] = edition ? [edition.i, edition.n] : [active, article.slides[active].blocs.length - 1];
        majA(OP.insererParagraphe(i, n), null, 'Nouveau paragraphe ajouté, aussi dans le texte de l’article.');
        ouvrirBloc(i, n + 1, { sel: { debut: 0, fin: 'Nouveau paragraphe'.length } });
      };
      const sautDeSlide = () => {
        if (!exigerBloc()) return;
        const { i, n } = edition;
        const pos = selRef.current.debut;
        if (n === 0 && pos === 0) { dispatch({ type: 'message', message: 'Place le curseur après le début de la slide : ce qui suit partira sur une nouvelle slide.' }); return; }
        majA(OP.couper(i, n, pos), null, `Saut de slide : la suite est sur la slide ${i + 2}.`);
        ouvrirBloc(i + 1, 0, { sel: { debut: 0, fin: 0 } });
      };
      const slideVide = () => {
        const i = active;
        const n = article.slides[i].blocs.length - 1;
        majA((a) => OP.couper(i, n + 1, 0)(OP.insererParagraphe(i, n)(a)), null, 'Slide ajoutée, avec un paragraphe à remplacer.');
        ouvrirBloc(i + 1, 0, { sel: { debut: 0, fin: 'Nouveau paragraphe'.length } });
      };
      const presse = (commande) => () => {
        const el = editeurRef.current;
        if (!el || !document.contains(el)) { exigerBloc(); return; }
        el.focus({ preventScroll: true });
        placerSelection(el, selRef.current.debut, selRef.current.fin);
        if (commande === 'coller') {
          if (!navigator.clipboard || !navigator.clipboard.readText) { dispatch({ type: 'message', message: 'Pour coller, utilise ⌘V (Ctrl+V sur PC).' }); return; }
          navigator.clipboard.readText().then((t) => { el.focus({ preventScroll: true }); placerSelection(el, selRef.current.debut, selRef.current.fin); document.execCommand('insertText', false, t); })
            .catch(() => dispatch({ type: 'message', message: 'Pour coller, utilise ⌘V (Ctrl+V sur PC).' }));
          return;
        }
        if (commande === 'tout') { placerSelection(el, 0, lireTexte(el).length); return; }
        document.execCommand(commande);
      };
      const reunirPrecedente = () => {
        const i = active;
        if (i === 0) return;
        majA(OP.retirerCoupure(i - 1), null, `Slides ${i} et ${i + 1} réunies.`);
        dispatch({ type: 'slide', index: i - 1 });
        setEdition(null);
      };
      const deplacer = (dlt) => { const j = active + dlt; majA(OP.deplacerSlide(active, dlt), null, `Slide déplacée en position ${j + 1}.`); dispatch({ type: 'slide', index: j }); setEdition(null); };
      const proposer = () => {
        const autres = etat.articles.filter((a) => a.id !== article.id);
        const convient = (s, kk, fd) => !M.composer(s, article.format, fd, choisirPolice, { index: kk, total, reglages, charte, logo }).deborde;
        const p = M.proposerPresentation(article, autres, reglages.rythme, Math.random, convient);
        majA(OP.presentation(p), null, `Nouvelle présentation : fond ${M.fondsDe(charte.palette)[p.fond].nom.toLowerCase()}. Ton texte n’a pas changé.`);
        setEdition(null);
      };
      const coche = (v) => ({ coche: v });
      const nomGabarit = (code) => M.GABARITS[code].nom;
      const menus = [
        { nom: 'Édition', contenu: () => [
          item('Annuler', () => dispatch({ type: 'annuler' }), { raccourci: '⌘Z', desactive: !etat.historique.passe.length }),
          item('Rétablir', () => dispatch({ type: 'retablir' }), { raccourci: '⇧⌘Z', desactive: !etat.historique.futur.length }),
          trait,
          item('Couper', presse('cut'), { raccourci: '⌘X', desactive: !blocCourant }), item('Copier', presse('copy'), { raccourci: '⌘C', desactive: !blocCourant }), item('Coller', presse('coller'), { raccourci: '⌘V', desactive: !blocCourant }),
          trait,
          item('Tout sélectionner dans le paragraphe', presse('tout'), { raccourci: '⌘A', desactive: !blocCourant }),
          item('Sélectionner tous les blocs de la slide', () => actionsBlocs.toutSelectionner(active), { raccourci: blocCourant ? '' : '⌘A' }),
        ] },
        { nom: 'Affichage', contenu: () => [
          { type: 'sous', libelle: 'Taille des slides', contenu: () => [['petites', 'Petites'], ['moyennes', 'Moyennes'], ['grandes', 'Grandes']].map(([v, nom]) => item(nom, () => { setTailleEcran(v); ecrirePref('postsop-taille-slides', v); }, coche(tailleEcran === v))) },
          item('Afficher les marges de texte', () => setMarges(!marges), coche(marges)),
          trait,
          { type: 'sous', libelle: 'Aller à la slide', contenu: () => article.slides.map((s, i) => item(`Slide ${i + 1}`, () => allerA(i), { raccourci: nomGabarit(M.gabaritParDefaut(s, i)), coche: active === i })) },
        ] },
        { nom: 'Insertion', contenu: () => [
          item('Bloc de texte', actionsBlocs.nouveau),
          { type: 'note', texte: 'Ou double-clique sur le vide d’une slide pour créer un bloc à cet endroit.' },
          item('Nouveau paragraphe', nouveauParagraphe, { raccourci: '↩' }),
          item('Saut de slide', sautDeSlide, { raccourci: '⌘↩' }),
          { type: 'note', texte: 'Le texte qui suit le curseur part sur une nouvelle slide.' },
          trait,
          item('Logo', () => ajouterImage('logo')),
          item('Fleurs', () => ajouterImage('fleurs')),
          { type: 'note', texte: 'Ils se placent derrière le texte : glisse-les où tu veux.' },
          trait,
          item('Slide après celle-ci', slideVide),
        ] },
        { nom: 'Format', contenu: () => [
          { type: 'sous', libelle: 'Style de paragraphe', contenu: () => natures().map(([cle, nom]) => item(h('span', { className: 'apercu-style ' + cle }, nom), () => natureDe(cle), { coche: blocCourant ? M.natureAffichee(M.gabaritParDefaut(article.slides[edition.i], edition.i), blocCourant.style, edition.n) === cle : undefined })) },
          trait,
          item(h('b', null, 'Gras'), () => basculer('gras'), { raccourci: '⌘B', coche: blocCourant ? st.gras : undefined }),
          item(h('i', null, 'Italique'), () => basculer('italique'), { raccourci: '⌘I', coche: blocCourant ? st.italique : undefined }),
          item(h('u', null, 'Souligné'), () => basculer('souligne'), { raccourci: '⌘U', coche: blocCourant ? st.souligne : undefined }),
          { type: 'sous', libelle: 'Taille', contenu: menuTaille },
          { type: 'sous', libelle: 'Couleur', contenu: menuCouleur },
          trait,
          { type: 'sous', libelle: 'Alignement', contenu: menuAlignement },
          { type: 'sous', libelle: 'Filet latéral', contenu: menuFilet },
          { type: 'sous', libelle: 'Fond du paragraphe', contenu: menuFond },
          trait,
          item('Effacer la mise en forme', () => (blocCourant ? effacer() : exigerBloc())),
        ] },
        { nom: 'Bloc', contenu: () => {
          const n = selection.n.length;
          const ici = selection.i !== null ? selection.i : active;
          return [
            ...(n ? [] : [{ type: 'note', texte: 'Clique sur un bloc pour le sélectionner ; ⇧ ou ⌘ + clic, ou un rectangle tracé sur le vide, pour en prendre plusieurs.' }]),
            item('Fusionner', actionsBlocs.fusionner, { desactive: n < 2 }),
            item('Dupliquer', actionsBlocs.dupliquer, { desactive: !n }),
            item('Nouveau bloc après', actionsBlocs.nouveau),
            { type: 'sous', libelle: 'Aligner', contenu: () => [
              { type: 'titre', libelle: 'Sur la slide' },
              item('Sur la marge de gauche', () => actionsBlocs.aligner('marge'), { desactive: !n }), item('Centrer sur la slide', () => actionsBlocs.aligner('centre'), { desactive: !n }), item('Sur la marge de droite', () => actionsBlocs.aligner('droite'), { desactive: !n }),
              { type: 'titre', libelle: 'Entre les blocs sélectionnés' },
              item('Aligner leurs bords gauches', () => actionsBlocs.aligner('entre'), { desactive: n < 2 }), item('Répartir verticalement', () => actionsBlocs.aligner('repartir'), { desactive: n < 3 }),
            ] },
            trait,
            item('Supprimer', actionsBlocs.supprimer, { raccourci: '⌫', danger: true, desactive: !n }),
            trait,
            item('Revenir au gabarit', () => actionsBlocs.revenir(ici), { desactive: !article.slides[ici].libre }),
          ];
        } },
        { nom: 'Slide', titre: `Slide ${active + 1}`, contenu: () => [
          ...(article.slides[active].libre ? [item('Revenir au gabarit', () => actionsBlocs.revenir(active)), { type: 'note', texte: 'La slide reprend sa mise en page automatique : marges, espacements et alignements de la charte.' }, trait] : []),
          { type: 'sous', libelle: 'Gabarit', contenu: () => [{ type: 'libre', rendu: (fermer) => h(GalerieGabarits, { slide: article.slides[active], index: active, total, article, choisir: (g) => { fermer(); majA(OP.gabarit(active, g), null, `Gabarit « ${nomGabarit(g)} ».`); setEdition(null); } }) }] },
          trait,
          (() => {
            const favoris = (etat.projet && etat.projet.favoris) || [];
            const pres = presentationDe(article.slides[active], active);
            const deja = favoris.find((f) => memePresentation(f.presentation, pres));
            return deja
              ? item('★ Retirer de mes favoris', () => dispatch({ type: 'projet', maj: (pr) => ({ ...pr, favoris: (pr.favoris || []).filter((f) => f.id !== deja.id) }) }))
              : item('☆ Garder dans mes favoris', () => { dispatch({ type: 'projet', maj: (pr) => ({ ...pr, favoris: [nouveauFavori(article.slides[active], active, article)].concat(pr.favoris || []) }) }); dispatch({ type: 'message', message: `Slide ${active + 1} gardée dans tes favoris : « Appliquer un style favori » la réutilise sur n’importe quelle slide.` }); });
          })(),
          { type: 'sous', libelle: 'Logo et fleurs', contenu: () => [{ type: 'libre', rendu: () => {
            const i = active;
            const imgs = imagesSlide(i);
            const sl = article.slides[i];
            return h('div', { className: 'liste-images' },
              h('div', { className: 'titre-section' }, 'Derrière le texte, devant le fond'),
              !imgs.length && h('p', { className: 'doux petit' }, 'Aucun sur cette slide. Menu Insertion : Logo, Fleurs.'),
              imgs.map((x, k) => h('div', { key: k, className: 'ligne-image' },
                h('button', { type: 'button', className: 'nom-image', onMouseDown: garder, disabled: x.verrou, onClick: () => { setImageChoisie({ i, k }); setMenu(null); } }, nomImage(imgs, k) + (x.verrou ? ' · verrouillé' : '')),
                h('button', { type: 'button', className: 'bouton-image', onMouseDown: garder, 'aria-label': (x.verrou ? 'Déverrouiller ' : 'Verrouiller ') + nomImage(imgs, k), title: x.verrou ? 'Déverrouiller' : 'Verrouiller', onClick: () => majImages(i, imgs.map((y, j) => (j === k ? { ...y, verrou: !y.verrou } : y)), x.verrou ? nomImage(imgs, k) + ' déverrouillé.' : nomImage(imgs, k) + ' verrouillé.') }, x.verrou ? '🔒' : '🔓'),
                h('button', { type: 'button', className: 'bouton-image', onMouseDown: garder, 'aria-label': 'Retirer ' + nomImage(imgs, k), onClick: () => { majImages(i, imgs.filter((_, j) => j !== k)); setImageChoisie(null); } }, '×'))),
              Array.isArray(sl.images) && h('button', { type: 'button', className: 'lien fort', onMouseDown: garder, onClick: () => { const { images, ...reste } = sl; majA(OP.slide(i, reste), null, 'Logo et fleurs replacés par le gabarit.'); setImageChoisie(null); } }, 'Revenir au placement du gabarit'));
          } }] },
          { type: 'sous', libelle: 'Appliquer un style favori', contenu: () => [{ type: 'libre', rendu: (fermer) => h(GalerieFavoris, {
            favoris: (etat.projet && etat.projet.favoris) || [], slide: article.slides[active], index: active, total, article,
            appliquer: (f) => { fermer(); majA(OP.slide(active, appliquerFavori(article.slides[active], f)), null, `Style favori appliqué à la slide ${active + 1} : son texte n’a pas changé.`); setEdition(null); },
            retirer: (f) => dispatch({ type: 'projet', maj: (pr) => ({ ...pr, favoris: (pr.favoris || []).filter((x) => x.id !== f.id) }) }),
          }) }] },
          trait,
          item('Dupliquer la slide', () => { majA(OP.dupliquerSlide(active), null, `Slide ${active + 1} dupliquée.`); dispatch({ type: 'slide', index: active + 1 }); }),
          item('Réunir avec la précédente', reunirPrecedente, { raccourci: '⌫ en tête', desactive: active === 0 }),
          item('Réunir avec la suivante', () => { majA(OP.retirerCoupure(active), null, `Slides ${active + 1} et ${active + 2} réunies.`); setEdition(null); }, { desactive: active === total - 1 }),
          trait,
          item('Monter la slide', () => deplacer(-1), { raccourci: active > 0 ? `devient la n° ${active}` : '', desactive: active === 0 }),
          item('Descendre la slide', () => deplacer(1), { raccourci: active < total - 1 ? `devient la n° ${active + 2}` : '', desactive: active === total - 1 }),
          trait,
          item('Supprimer la slide', () => { majA(OP.supprimerSlide(active), null, `Slide ${active + 1} supprimée. Son texte reste dans l’article.`); dispatch({ type: 'slide', index: Math.max(0, active - 1) }); setEdition(null); }, { danger: true, desactive: total <= 1 }),
        ] },
        { nom: 'Carrousel', contenu: () => [
          { type: 'sous', libelle: 'Fond', contenu: () => [{ type: 'libre', rendu: (fermer) => h(Nuancier, { valeur: article.fond, choisir: (f) => { fermer(); majA(OP.champ('fond', f), null, `Fond ${M.fondsDe(charte.palette)[f].nom.toLowerCase()}.`); setEdition(null); } }) }] },
          { type: 'sous', libelle: 'Format', contenu: () => [['carre', 'Carré · 1:1'], ['portrait', 'Portrait · 4:5']].map(([v, nom]) => item(nom, () => { majA(OP.champ('format', v)); setEdition(null); }, coche(article.format === v))) },
          { type: 'sous', libelle: 'Réseau', contenu: () => [['instagram', 'Instagram (images)'], ['linkedin', 'LinkedIn (PDF)']].map(([v, nom]) => item(nom, () => majA(OP.champ('reseau', v)), coche(article.reseau === v))) },
          { type: 'sous', libelle: 'Logo', contenu: () => [
            ...[['auto', 'Automatique'], ['fonce', 'Logo foncé'], ['clair', 'Logo clair']].map(([v, nom]) => item(nom, () => majA(OP.champ('logo', v)), coche(logo === v))),
            ...(!images.logo || !images.logoClair ? [{ type: 'note', texte: 'Une version du logo n’est pas encore importée (Configuration › Ressources).' }] : []),
          ] },
          trait,
          item('Redécouper automatiquement', () => { majA(OP.redecouper(M.decouperMecaniquement(article.texte, article.format, article.fond, choisirPolice, { charte, reglages })), null, 'Texte redécoupé automatiquement.'); setEdition(null); }),
          item('Proposer une autre présentation', proposer),
        ] },
        { nom: 'Vérifier', titre: h(Fragment, null, 'Vérifier ', h('span', { className: cls('compteur', !alertes.length && 'ok') }, alertes.length || '✓')), classe: 'large', contenu: () => [
          { type: 'libre', rendu: (fermer) => h(PanneauVerifier, { article, alertes, nbValidees: toutes.length - alertes.length, majA, choisirPolice, contexteRendu: { reglages, charte, logo }, voir: (i) => { fermer(); allerA(i); } }) },
        ] },
      ];

      /* ---------- Rendu ---------- */
      const fondClair = (() => { const c = (fond.fond || '#003846').replace('#', ''); const v = [0, 2, 4].map((p) => parseInt(c.slice(p, p + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.5; })();
      const zoneEdition = edition && compositions[edition.i] ? compositions[edition.i].elements.find((z) => z.type === 'bloc' && z.bloc === edition.n) : null;
      if (zoneEdition) zoneMemoire.current = zoneEdition;
      const zoneAffichee = zoneEdition || (edition && zoneMemoire.current) || null;
      const historique = h('span', { className: 'historique-menus' },
        h('span', { className: 'position' }, `Slide ${active + 1} sur ${total}`),
        h('button', { ref: refRobot, type: 'button', className: cls('bouton-robot', 'bouton-robot-menu', (menuIA || disc.ouvert) && 'actif'), 'aria-label': 'Assistant IA', title: 'Assistant IA', 'aria-haspopup': 'true', 'aria-expanded': menuIA, onMouseDown: garder, onClick: () => { setMenu(null); setMenuIA(!menuIA); } }, h(outilsIA.Robot, { taille: 34 })),
        menuIA && h('div', { className: 'voile-menu', 'aria-hidden': 'true', onPointerDown: () => setMenuIA(false) }),
        menuIA && h(Popover, { ancre: refRobot, fermer: () => setMenuIA(false), etiquette: 'Assistant IA', contenu: () => menuAssistant(false) }));
      return h('div', { className: 'composition' },
        propositionsOuvertes && h(FenetrePropositions, { etat, dispatch, article, majA, fermer: () => setPropositionsOuvertes(false) }),
        configIA && disc.ouvert && h(outilsIA.FenetreDiscussion, {
          disc, nomIA, passage: passageIA, onRetirerPassage: () => setZoneIA(null),
          onChoisirPassage: (t) => { if (!choisirPassageIA(t)) disc.signaler('Ce passage n’est plus dans ton texte tel quel : sélectionne-le de nouveau dans un bloc.'); },
        }),
        h(BarreMenus, { menus, ouvert: menu, setOuvert: setMenu, droite: historique }),
        h('div', { className: 'pages-composition', ref: pagesRef },
          article.slides.map((s, i) => {
            const c = compositions[i];
            const g = M.gabaritParDefaut(s, i);
            const mots = s.blocs.reduce((m, b) => m + M.compterMots(b.texte), 0);
            const enEdition = edition && edition.i === i;
            return h('section', { key: i, className: cls('page-slide', i === active && 'active'), 'data-index': i, 'aria-label': `Slide ${i + 1}` },
              h('div', { className: 'reperes', onClick: () => dispatch({ type: 'slide', index: i }) },
                h('span', { className: 'num' }, i + 1),
                h('span', { className: 'gab' }, nomGabarit(g)),
                h('span', { className: 'mots' }, `${mots} mots`),
                c.deborde && h('span', { className: 'deborde' }, c.libre ? 'Texte coupé' : 'Déborde'),
                s.echelle && s.echelle < 1 && h('span', { className: 'reduit' }, `Texte à ${Math.round(s.echelle * 100)} %`),
                s.libre && h('span', { className: 'libre' }, 'Mise en page libre'),
                s.libre && h('button', { type: 'button', className: 'lien-repere', onClick: (e) => { e.stopPropagation(); actionsBlocs.revenir(i); } }, 'Revenir au gabarit')),
              h('div', { className: cls('cadre-page', cible === i && 'cible'), style: { width: largeurSlide + 'px', height: Math.round(largeurSlide * fmt.h / fmt.l) + 'px' } },
                h(SlideCanvas, { slide: slidesVues[i], compo: c, formatId: article.format, fondId: article.fond, largeur: largeurSlide, index: i, total, logo, masquer: enEdition ? edition.n : undefined, etiquette: `Slide ${i + 1}` }),
                h('div', {
                  className: cls('calque', fondClair && 'sur-clair'), 'data-index': i, role: 'group', 'aria-label': `Slide ${i + 1} : clique sur un bloc pour le sélectionner, clique à nouveau pour l’écrire`,
                  onPointerDown: (e) => debutPointeur(e, i),
                  onPointerMove: (e) => { if (geste.current || e.pointerType !== 'mouse') return; const n = blocAuPoint(i, coordonnees(e, i)); if (!survol || survol.i !== i || survol.n !== n) setSurvol(n === null ? null : { i, n }); },
                  onPointerLeave: () => setSurvol(null),
                },
                  h('div', { className: 'echelle', style: { width: fmt.l + 'px', height: fmt.h + 'px', transform: `scale(${k})`, '--inv': 1 / k } },
                    (marges || (guides && guides.i === i)) && h('div', { className: 'repere-marges', style: { left: M.MARGES.gauche + 'px', top: M.MARGES.haute + 'px', width: fmt.l - M.MARGES.gauche - M.MARGES.droite + 'px', height: fmt.h - M.MARGES.haute - M.MARGES.basse + 'px' } }),
                    survol && survol.i === i && !(selection.i === i && selection.n.includes(survol.n)) && !(enEdition && edition.n === survol.n) && (() => { const b = boiteDe(i, survol.n); return b && h('div', { className: 'survol-bloc', style: { left: b.x - 8 + 'px', top: b.y - 8 + 'px', width: b.l + 16 + 'px', height: b.h + 16 + 'px' } }); })(),
                    imageChoisie && imageChoisie.i === i && (() => {
                      const b = (c ? c.elements.filter(estImage) : [])[imageChoisie.k];
                      if (!b || b.verrou) return null;
                      const imgs = imagesSlide(i);
                      const k2 = imageChoisie.k;
                      return h(Fragment, null,
                        h('div', { className: 'selection-image', style: { left: b.x - 6 + 'px', top: b.y - 6 + 'px', width: b.l + 12 + 'px', height: b.h + 12 + 'px' } }),
                        !(apercu && apercu.i === i) && h('div', { className: 'poignee-image', 'data-poignee-image': k2, title: 'Taille', style: { left: Math.min(b.x + b.l, (c ? c.fmt.l : 1080) - 16) + 'px', top: Math.min(b.y + b.h, (c ? c.fmt.h : 1080) - 16) + 'px' } }),
                        !(apercu && apercu.i === i) && h('div', { className: 'barre-image', style: { left: b.x + 'px', top: Math.max(0, b.y - 12) + 'px' } },
                          h('strong', null, imgs[k2] ? nomImage(imgs, k2) : ''),
                          h('button', { type: 'button', onClick: () => { majImages(i, imgs.map((x, j) => (j === k2 ? { ...x, verrou: true } : x)), 'Verrouillé : il ne bouge plus. Pour le déverrouiller : menu Slide, « Logo et fleurs ».'); setImageChoisie(null); } }, 'Verrouiller'),
                          h('button', { type: 'button', onClick: () => { const n = imgs.concat([{ ...imgs[k2], x: imgs[k2].x + 0.03, y: imgs[k2].y + 0.03, verrou: false }]); majImages(i, n); setImageChoisie({ i, k: n.length - 1 }); } }, 'Dupliquer'),
                          h('button', { type: 'button', className: 'danger', onClick: () => { majImages(i, imgs.filter((_, j) => j !== k2), nomImage(imgs, k2) + ' retiré de la slide.'); setImageChoisie(null); } }, 'Supprimer')));
                    })(),
                    selection.i === i && selection.n.map((n) => { const b = boiteDe(i, n); return b && h('div', { key: 'sel' + n, className: 'selection-bloc', style: { left: b.x - 8 + 'px', top: b.y - 8 + 'px', width: b.l + 16 + 'px', height: b.h + 16 + 'px' } }); }),
                    selection.i === i && selection.n.length === 1 && (!apercu || apercu.cote) && (() => { const b = boiteDe(i, selection.n[0]); return b && h(Fragment, null,
                      h('div', { className: cls('poignee-redim', apercu && apercu.cote === 'g' && 'actif'), 'data-cote': 'g', title: 'Largeur', style: { left: b.x - 8 + 'px', top: b.y + b.h / 2 + 'px' } }),
                      h('div', { className: cls('poignee-redim', apercu && apercu.cote === 'd' && 'actif'), 'data-cote': 'd', title: 'Largeur', style: { left: b.x + b.l + 8 + 'px', top: b.y + b.h / 2 + 'px' } })); })(),
                    lasso && lasso.i === i && h('div', { className: 'lasso-blocs', style: { left: lasso.x + 'px', top: lasso.y + 'px', width: lasso.l + 'px', height: lasso.h + 'px' } }),
                    guides && guides.i === i && guides.gx !== null && h('div', { className: 'guide-v', style: { left: guides.gx + 'px' } }),
                    guides && guides.i === i && guides.gy !== null && h('div', { className: 'guide-h', style: { top: guides.gy + 'px' } }),
                    enEdition && blocCourant && zoneAffichee && h(EditeurBloc, {
                      key: edition.cle, bloc: blocCourant, zone: zoneAffichee, fond, echelleSlide: s.echelle || 1, depart: edition.depart, version, refExterne: editeurRef,
                      onTexte: ecrire, onTouche: toucher,
                    })))));
          })),
        selection.n.length > 0 && !apercu && !menu && !edition && h(BarreBlocs, { selection, boites: selection.n.map((n) => boiteDe(selection.i, n)).filter(Boolean), k, pagesRef, libre: !!(article.slides[selection.i] && article.slides[selection.i].libre), actions: actionsBlocs }),
        barre && blocCourant && !menu && h(BarreFlottante, {
          position: barre, st, deplie, setDeplie: (v) => { setDeplie(v); ecrirePref('postsop-barre-depliee', v ? 'oui' : 'non'); },
          presets, fond, natures: natures(), sous: sousBarre, setSous: setSousBarre,
          actions: { basculer, formater, aligner, basculerFilet, filetLignes, effacer, natureDe },
          menuCouleur, menuTaille, menuFilet, couleurFilet: couleurFiletVue, menuFond, menuAssistant: () => menuAssistant(true), Robot: outilsIA.Robot,
        }));
    }

    /* ================================================================ */
    /* Petits composants                                                */
    /* ================================================================ */

    // Barre d'actions des blocs sélectionnés : au-dessus de la sélection, sans contour (comme la barre de texte).
    function BarreBlocs({ selection, boites, k, pagesRef, libre, actions }) {
      const ref = useRef(null);
      const refAligner = useRef(null);
      const [aligner, setAligner] = useState(false);
      const [pos, setPos] = useState({ left: -9999, top: -9999 });
      const [, rafraichir] = useState(0);
      useEffect(() => { const f = () => rafraichir((x) => x + 1); racine.addEventListener('scroll', f, { passive: true }); racine.addEventListener('resize', f); return () => { racine.removeEventListener('scroll', f); racine.removeEventListener('resize', f); }; }, []);
      useMiseEnPage(() => {
        const el = ref.current;
        const cal = pagesRef.current && pagesRef.current.querySelector(`.page-slide[data-index="${selection.i}"] .calque`);
        if (!el || !cal || !boites.length) return;
        const r = cal.getBoundingClientRect();
        const haut = r.top + Math.min(...boites.map((b) => b.y)) * k - 8 * k;
        const bas = r.top + Math.max(...boites.map((b) => b.y + b.h)) * k + 8 * k;
        const gauche = r.left + Math.min(...boites.map((b) => b.x)) * k;
        const droite = r.left + Math.max(...boites.map((b) => b.x + b.l)) * k;
        const l = el.offsetWidth; const hh = el.offsetHeight;
        let top = haut - hh - 12;
        if (top < 120) top = bas + 12; // pas assez de place au-dessus (sous la barre de menus) : en dessous
        const left = Math.max(8, Math.min((gauche + droite) / 2 - l / 2, document.documentElement.clientWidth - l - 8));
        if (Math.abs(left - pos.left) > 0.5 || Math.abs(top - pos.top) > 0.5) setPos({ left, top });
      });
      const n = selection.n.length;
      const b = (contenu, action, titre, extra = {}) => h('button', { type: 'button', className: cls('outil', extra.classe), title: titre, 'aria-label': titre, disabled: extra.desactive, onMouseDown: garder, onClick: action, ref: extra.ref }, contenu);
      const ico = (d) => h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
      return h('div', { ref, className: 'barre-blocs', role: 'toolbar', 'aria-label': 'Actions sur les blocs sélectionnés', style: pos },
        h('span', { className: 'nb-blocs' }, n > 1 ? `${n} blocs` : '1 bloc'),
        h('span', { className: 'separateur', 'aria-hidden': 'true' }),
        b(h(Fragment, null, ico('M8 4v6a4 4 0 004 4 4 4 0 014 4v2M16 4v6a4 4 0 01-4 4'), 'Fusionner'), actions.fusionner, 'Réunir les blocs sélectionnés en un seul paragraphe', { desactive: n < 2, classe: 'avec-texte' }),
        b(h(Fragment, null, ico('M8 8h12v12H8zM16 8V4H4v12h4'), 'Dupliquer'), actions.dupliquer, 'Dupliquer', { classe: 'avec-texte' }),
        b(h(Fragment, null, ico('M12 5v14M5 12h14'), 'Nouveau'), actions.nouveau, 'Nouveau bloc après', { classe: 'avec-texte' }),
        b(h(Fragment, null, ico('M4 4v16M8 7h12M8 12h8M8 17h10'), 'Aligner'), () => setAligner(!aligner), 'Aligner', { classe: 'avec-texte', ref: refAligner }),
        h('span', { className: 'separateur', 'aria-hidden': 'true' }),
        b(ico('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'), actions.supprimer, 'Supprimer (⌫)', { classe: 'danger' }),
        libre && b(h(Fragment, null, ico('M4 4h16v16H4zM4 9h16'), 'Revenir au gabarit'), () => actions.revenir(selection.i), 'La slide reprend sa mise en page automatique', { classe: 'avec-texte' }),
        aligner && h(Popover, { ancre: refAligner, fermer: () => setAligner(false), etiquette: 'Aligner', contenu: () => [
          { type: 'titre', libelle: 'Sur la slide' },
          { type: 'action', libelle: 'Sur la marge de gauche', action: () => actions.aligner('marge') },
          { type: 'action', libelle: 'Centrer sur la slide', action: () => actions.aligner('centre') },
          { type: 'action', libelle: 'Sur la marge de droite', action: () => actions.aligner('droite') },
          { type: 'titre', libelle: 'Entre les blocs sélectionnés' },
          { type: 'action', libelle: 'Aligner leurs bords gauches', action: () => actions.aligner('entre'), desactive: n < 2 },
          { type: 'action', libelle: 'Répartir verticalement', action: () => actions.aligner('repartir'), desactive: n < 3 },
        ] }));
    }

    function TailleLibre({ appliquer }) {
      const [v, setV] = useState('');
      const ok = () => { const n = Number(v); if (n) appliquer(Math.max(12, Math.min(400, Math.round(n)))); };
      return h('div', { className: 'taille-libre' },
        h('input', { type: 'number', inputMode: 'numeric', min: 12, max: 400, placeholder: 'px', value: v, 'aria-label': 'Taille libre en pixels', onChange: (e) => setV(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') ok(); } }),
        h('button', { type: 'button', className: 'bouton principal petit', onClick: ok, disabled: !v }, 'Appliquer'));
    }

    /* ---------- Favoris : garder la présentation d'une slide et l'appliquer à une autre (sans IA) ----------
     * Un favori garde la présentation (gabarit, échelle, styles, alignements, placement libre), jamais le texte :
     * appliqué à une slide, il change sa présentation et laisse son texte (et ses liens avec l'article) intacts. */
    const NATURES_FAVORI = { V: 'Couverture', T: 'Texte', F: 'Fin' };
    function presentationDe(slide, index) {
      const gabarit = M.gabaritParDefaut(slide, index);
      return {
        gabarit, echelle: slide.echelle || null, libre: !!slide.libre,
        blocs: slide.blocs.map((b) => ({ style: b.style, alignement: b.alignement || null, pos: slide.libre && b.pos ? b.pos : null })),
      };
    }
    const memePresentation = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function nouveauFavori(slide, index, article) {
      const pres = presentationDe(slide, index);
      return { id: 'fav-' + Date.now().toString(36), cree: new Date().toISOString(), nature: NATURES_FAVORI[pres.gabarit[0]] || 'Slide', origine: article.titre, presentation: pres, apercu: { blocs: slide.blocs.map((b) => ({ style: b.style, texte: b.texte, marques: b.marques })), fond: article.fond } };
    }
    function appliquerFavori(slide, fav) {
      const p = fav.presentation;
      const garderPlacement = p.libre && p.blocs.length === slide.blocs.length && p.blocs.every((b) => b.pos);
      const blocs = slide.blocs.map((b, k) => {
        const modele = p.blocs[Math.min(k, p.blocs.length - 1)];
        const c = { ...b, style: modele ? modele.style : b.style };
        if (modele && modele.alignement) c.alignement = modele.alignement; else delete c.alignement;
        delete c.pos; delete c.fige;
        if (garderPlacement) c.pos = p.blocs[k].pos;
        return c;
      });
      const nouvelle = { ...slide, gabarit: p.gabarit, blocs };
      if (p.echelle) nouvelle.echelle = p.echelle; else delete nouvelle.echelle;
      if (garderPlacement) nouvelle.libre = true; else delete nouvelle.libre;
      return nouvelle;
    }

    function GalerieFavoris({ favoris, slide, index, total, article, appliquer, retirer }) {
      if (!favoris.length) return h('p', { className: 'doux petit galerie-vide' }, 'Aucun favori pour l’instant. Sur une slide qui te plaît, choisis « Garder dans mes favoris ».');
      return h('div', { className: 'galerie-menu' },
        h('div', { className: 'titre-section' }, 'Tes slides gardées : aperçu avec le texte de cette slide'),
        h('div', { className: 'grille-gabarits-menu' }, favoris.map((f) => h('div', { key: f.id, className: 'favori-menu' },
          h('button', { type: 'button', className: 'gabarit-menu', onMouseDown: garder, onClick: () => appliquer(f), 'aria-label': 'Appliquer le style favori ' + f.nature + ' (' + f.origine + ')' },
            h(SlideCanvas, { slide: appliquerFavori(slide, f), formatId: article.format, fondId: article.fond, largeur: 84, index, total, logo: article.logo }),
            h('span', null, f.nature)),
          h('button', { type: 'button', className: 'favori-retirer', onMouseDown: garder, onClick: () => retirer(f), 'aria-label': 'Retirer ce favori' }, '×')))));
    }

    /* ---------- Propositions de mise en page (Studio simplifié, décisions du 19 octobre 2026) ---------- */
    const PROPOSITIONS_PAR_ARTICLE = new Map(); // gardées le temps de la session
    function FenetrePropositions({ etat, dispatch, article, majA, fermer }) {
      const IA = racine.PostsOPIA;
      const P = racine.PostsOPPropositions;
      const { choisirPolice, reglages, charte } = useContext(Contexte);
      const fonds = M.fondsDe(charte.palette);
      const config = IA && IA.active();
      const nomIA = config ? IA.FOURNISSEURS[config.fournisseur].nom : 'Claude';
      const [liste, setListeBrute] = useState(() => PROPOSITIONS_PAR_ARTICLE.get(article.id) || []);
      const setListe = (l) => { PROPOSITIONS_PAR_ARTICLE.set(article.id, l); setListeBrute(l); };
      const [choisie, setChoisie] = useState(() => (liste[0] ? liste[0].id : 'actuelle'));
      const [onglet, setOnglet] = useState('propositions');
      const [inspirer, setInspirer] = useState(true);
      const [suivi, setSuivi] = useState({ etat: 'repos', detail: '' });
      const [passe, setPasse] = useState([]);
      const [futur, setFutur] = useState([]);
      const [chat, setChat] = useState({ ouvert: false, messages: [], encours: false });
      const [saisie, setSaisie] = useState('');
      const favoris = (etat.projet && etat.projet.favoris) || [];
      const favorisCarrousels = (etat.projet && etat.projet.favorisCarrousels) || [];
      useEffect(() => {
        const touche = (e) => { if (e.key === 'Escape') fermer(); };
        racine.addEventListener('keydown', touche);
        return () => racine.removeEventListener('keydown', touche);
      }, []);
      const paragraphes = article.texte;
      const catalogueTexte = P.catalogue(M.GABARITS, fonds, M.NATURES);
      const element = liste.find((x) => x.id === choisie);
      const plan = element ? element.plan : null;
      const slides = plan ? P.construireSlides(plan, paragraphes) : article.slides;
      const fond = plan ? plan.fond : article.fond;
      const total = slides.length;
      const deborde = slides.filter((sl, i) => M.composer(sl, article.format, fond, choisirPolice, { charte, reglages, index: i, total }).deborde).length;
      const recette = plan && JSON.stringify(P.recetteDe(plan));
      const carrouselGarde = plan && favorisCarrousels.find((f) => JSON.stringify(f.recette) === recette);

      async function generer() {
        if (!config) return;
        setSuivi({ etat: 'encours', detail: '' });
        try {
          const favs = inspirer ? favoris.map((f) => ({ gabarit: f.presentation.gabarit, styles: f.presentation.blocs.map((b) => b.style) })) : [];
          const brut = await IA.demander(config, { systeme: P.SYSTEME, texte: P.messageGeneration({ paragraphes, catalogueTexte, format: M.FORMATS[article.format].nom, reseau: article.reseau === 'linkedin' ? 'LinkedIn' : 'Instagram', favoris: favs }), maxJetons: 4000, delai: 150000 });
          const r = P.lireReponse(brut, paragraphes.length, M.GABARITS, fonds, M.NATURES);
          if (!r.plans.length) throw new Error('Aucune proposition ne reprenait tout ton texte dans l’ordre : réessaie.');
          const nouvelles = r.plans.map((pl, k) => ({ id: 'p' + Date.now().toString(36) + k, plan: pl }));
          setListe(nouvelles.concat(liste).slice(0, 9));
          setChoisie(nouvelles[0].id);
          setOnglet('propositions');
          setSuivi({ etat: 'repos', detail: r.ecartes ? `${r.ecartes} proposition${r.ecartes > 1 ? 's écartées' : ' écartée'} : elle${r.ecartes > 1 ? 's' : ''} ne reprenai${r.ecartes > 1 ? 'en' : ''}t pas tout ton texte.` : '' });
        } catch (erreur) {
          setSuivi({ etat: 'erreur', detail: erreur.message });
        }
      }
      function remplacerPlan(id, nouveau) { setListe(liste.map((x) => (x.id === id ? { ...x, plan: nouveau } : x))); }
      async function demander(texte) {
        const t = String(texte || '').trim();
        if (!t || !plan || !config || chat.encours) return;
        const historique = chat.messages;
        setChat({ ...chat, encours: true, messages: historique.concat([{ de: 'moi', texte: t }]) });
        setSaisie('');
        try {
          const brut = await IA.demander(config, { systeme: P.SYSTEME, texte: P.messageEvolution({ paragraphes, catalogueTexte, plan, historique, demande: t }), maxJetons: 3000, delai: 120000 });
          const r = P.lireReponse(brut, paragraphes.length, M.GABARITS, fonds, M.NATURES);
          if (r.plans.length) {
            setPasse(passe.concat([{ id: choisie, plan }]));
            setFutur([]);
            remplacerPlan(choisie, { ...r.plans[0], nom: plan.nom });
          }
          setChat((c) => ({ ...c, encours: false, messages: c.messages.concat([{ de: 'ia', texte: r.plans.length ? (r.reponse || 'Voici la mise en page modifiée.') + ' « Annuler » revient en arrière.' : 'Ma proposition ne reprenait pas tout ton texte : je n’ai rien changé. Reformule ta demande.' }]) }));
        } catch (erreur) {
          setChat((c) => ({ ...c, encours: false, messages: c.messages.concat([{ de: 'ia', texte: erreur.message }]) }));
        }
      }
      function annuler() { const d = passe[passe.length - 1]; if (!d) return; const actuel = liste.find((x) => x.id === d.id); setFutur(futur.concat([{ id: d.id, plan: actuel.plan }])); setPasse(passe.slice(0, -1)); remplacerPlan(d.id, d.plan); setChoisie(d.id); }
      function retablir() { const d = futur[futur.length - 1]; if (!d) return; const actuel = liste.find((x) => x.id === d.id); setPasse(passe.concat([{ id: d.id, plan: actuel.plan }])); setFutur(futur.slice(0, -1)); remplacerPlan(d.id, d.plan); setChoisie(d.id); }
      function utiliser() {
        if (!plan) return;
        const nouvelles = P.construireSlides(plan, paragraphes);
        majA((a) => OP.remplacerTexte(a.texte, nouvelles)({ ...a, fond: plan.fond }), null, `« ${plan.nom} » est maintenant ton carrousel. Retouche-le à la main ici, slide par slide.`);
        fermer();
      }
      const majProjet = (maj) => dispatch({ type: 'projet', maj });
      function basculerFavoriSlide(sl, i) {
        const pres = presentationDe(sl, i);
        const deja = favoris.find((f) => memePresentation(f.presentation, pres));
        if (deja) majProjet((pr) => ({ ...pr, favoris: (pr.favoris || []).filter((f) => f.id !== deja.id) }));
        else majProjet((pr) => ({ ...pr, favoris: [nouveauFavori(sl, i, { ...article, fond })].concat(pr.favoris || []) }));
      }
      function basculerCarrousel() {
        if (!plan) return;
        if (carrouselGarde) majProjet((pr) => ({ ...pr, favorisCarrousels: (pr.favorisCarrousels || []).filter((f) => f.id !== carrouselGarde.id) }));
        else majProjet((pr) => ({ ...pr, favorisCarrousels: [{ id: 'car-' + Date.now().toString(36), nom: plan.nom, origine: article.titre, recette: P.recetteDe(plan) }].concat(pr.favorisCarrousels || []) }));
      }
      function voirCarrousel(f) {
        const adapte = P.adapterRecette(f.recette, paragraphes.length, f.nom + ' (favori)', M.GABARITS, fonds, M.NATURES);
        if (!adapte) return;
        const id = 'f' + Date.now().toString(36);
        setListe([{ id, plan: adapte, favori: true }].concat(liste).slice(0, 9));
        setChoisie(id);
        setOnglet('propositions');
      }
      const miniatures = (sls, fd) => h('div', { className: 'propositions-mini' }, sls.slice(0, 4).map((sl, i) => h(SlideCanvas, { key: i, slide: sl, formatId: article.format, fondId: fd, largeur: 44, index: i, total: sls.length, logo: article.logo })));
      const itemListe = (id, nom, sous, sls, fd) => h('button', { key: id, type: 'button', className: cls('proposition-item', choisie === id && 'actif'), 'aria-pressed': choisie === id, onClick: () => setChoisie(id) },
        h('strong', null, nom), h('span', { className: 'doux petit' }, sous), miniatures(sls, fd));

      return h('div', { className: 'voile', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Propositions de mise en page' },
        h('div', { className: 'feuille fenetre-propositions' },
          h('div', { className: 'calendrier-tete' },
            h('h2', { className: 'gill' }, 'Propositions de mise en page'),
            h('div', { className: 'actions-ligne' },
              h(Bouton, { variante: 'petit', disabled: !passe.length, onClick: annuler }, 'Annuler'),
              h(Bouton, { variante: 'petit', disabled: !futur.length, onClick: retablir }, 'Rétablir'),
              h(Bouton, { variante: 'icone', etiquette: 'Fermer', titre: 'Fermer', onClick: fermer }, '×'))),
          h('div', { className: 'propositions-corps' },
            h('div', { className: 'propositions-liste' },
              h('div', { className: 'segmente', role: 'group', 'aria-label': 'Sources' },
                h('button', { type: 'button', 'aria-pressed': onglet === 'propositions', onClick: () => setOnglet('propositions') }, 'Propositions'),
                h('button', { type: 'button', 'aria-pressed': onglet === 'favoris', onClick: () => setOnglet('favoris') }, '★ Favoris (' + (favoris.length + favorisCarrousels.length) + ')')),
              onglet === 'propositions' ? h(Fragment, null,
                itemListe('actuelle', 'Ta mise en page actuelle', `${article.slides.length} slides`, article.slides, article.fond),
                liste.map((x) => itemListe(x.id, x.plan.nom, `${x.plan.slides.length} slides${x.favori ? ' · favori' : ''}`, P.construireSlides(x.plan, paragraphes), x.plan.fond)),
                config
                  ? h(Fragment, null,
                    h(Bouton, { variante: liste.length ? undefined : 'principal', disabled: suivi.etat === 'encours', onClick: generer }, suivi.etat === 'encours' ? nomIA + ' compose…' : liste.length ? 'Nouvelles propositions' : 'Proposer 3 mises en page'),
                    favoris.length > 0 && h('label', { className: 'propositions-case' }, h('input', { type: 'checkbox', checked: inspirer, onChange: () => setInspirer(!inspirer) }), 'S’inspirer de mes favoris'),
                    suivi.etat === 'encours' && h('p', { className: 'doux petit', role: 'status' }, nomIA + ' compose trois mises en page. Cela peut prendre jusqu’à une minute.'),
                    suivi.etat === 'erreur' && h('p', { className: 'erreur petit', role: 'status' }, suivi.detail),
                    suivi.detail && suivi.etat === 'repos' && h('p', { className: 'doux petit' }, suivi.detail))
                  : h('p', { className: 'doux petit' }, 'Pour que Claude te propose des mises en page, ajoute une clé dans Configuration, onglet IA.'))
              : h(Fragment, null,
                !favoris.length && !favorisCarrousels.length && h('p', { className: 'doux petit' }, 'Touche ☆ sur une slide, ou « Garder ce carrousel », pour retrouver ici ce qui te plaît.'),
                favorisCarrousels.map((f) => h('div', { key: f.id, className: 'proposition-item' },
                  h('div', { className: 'proposition-tete' }, h('strong', null, f.nom), h(Bouton, { variante: 'icone', etiquette: 'Retirer des favoris', onClick: () => majProjet((pr) => ({ ...pr, favorisCarrousels: (pr.favorisCarrousels || []).filter((x) => x.id !== f.id) })) }, '★')),
                  h('span', { className: 'doux petit' }, 'Carrousel · ' + f.recette.slides.length + ' slides'),
                  h(Bouton, { variante: 'lien', onClick: () => voirCarrousel(f) }, 'Voir sur cet article'))),
                favoris.length > 0 && h('p', { className: 'doux petit' }, `${favoris.length} slide${favoris.length > 1 ? 's gardées' : ' gardée'}. Pour en appliquer une : menu Slide, « Appliquer un style favori ».`))),
            h('div', { className: 'propositions-centre' },
              h('div', { className: 'proposition-tete' },
                h('div', null, h('h3', { className: 'gill' }, (plan ? plan.nom : 'Ta mise en page actuelle') + ' · ' + total + ' slides'), h('p', { className: 'doux petit' }, plan ? plan.pourquoi : 'Celle de ton carrousel aujourd’hui.')),
                h(Bouton, { disabled: !plan || !config, titre: plan ? '' : 'Choisis une proposition pour la faire évoluer', onClick: () => setChat({ ...chat, ouvert: !chat.ouvert }), 'aria-expanded': chat.ouvert }, h(Icone, { nom: 'bulle', taille: 18 }), chat.ouvert ? 'Fermer' : 'Demander à ' + nomIA)),
              deborde > 0 && h('p', { className: 'vigilance' }, `${deborde} slide${deborde > 1 ? 's débordent' : ' déborde'} : demande à ${nomIA} d’aérer, ou retouche-la${deborde > 1 ? 's' : ''} ensuite dans Composition.`),
              h('div', { className: 'proposition-slides' }, slides.map((sl, i) => {
                const garde = favoris.some((f) => memePresentation(f.presentation, presentationDe(sl, i)));
                return h('div', { key: i, className: 'proposition-slide' },
                  h(SlideCanvas, { slide: sl, formatId: article.format, fondId: fond, largeur: 150, index: i, total, logo: article.logo }),
                  h('button', { type: 'button', className: cls('etoile-slide', garde && 'gardee'), 'aria-label': (garde ? 'Ne plus garder' : 'Garder') + ' la slide ' + (i + 1), title: garde ? 'Retirer des favoris' : 'Garder dans mes favoris', onClick: () => basculerFavoriSlide(sl, i) }, garde ? '★' : '☆'));
              })),
              h('div', { className: 'actions-ligne' },
                plan && h(Bouton, { variante: 'principal', onClick: utiliser }, 'Utiliser cette proposition'),
                plan && h(Bouton, { onClick: basculerCarrousel }, carrouselGarde ? '★ Gardé dans tes favoris' : '☆ Garder ce carrousel')),
              chat.ouvert && h('div', { className: 'fenetre-discussion propositions-discussion', role: 'dialog', 'aria-label': 'Demander à ' + nomIA },
                h('div', { className: 'proposition-tete' }, h('h3', { className: 'gill' }, 'Demander à ' + nomIA), h(Bouton, { variante: 'icone', etiquette: 'Fermer', onClick: () => setChat({ ...chat, ouvert: false }) }, '×')),
                h('div', { className: 'discussion-fil' },
                  !chat.messages.length && h('p', { className: 'bulle ia' }, 'Ton texte ne change jamais : seule la présentation bouge. Chaque demande s’annule avec « Annuler », en haut.'),
                  chat.messages.map((m, i) => h('p', { key: i, className: cls('bulle', m.de === 'moi' ? 'moi' : 'ia') }, m.texte)),
                  chat.encours && h('p', { className: 'bulle ia doux' }, nomIA + ' réfléchit…')),
                h('div', { className: 'discussion-raccourcis' }, ['Plus aéré', 'Une slide de moins', 'La citation la plus forte en couverture'].map((t) => h('button', { key: t, type: 'button', className: 'puce', disabled: chat.encours, onClick: () => demander(t) }, t))),
                h('div', { className: 'discussion-saisie' },
                  h('input', { className: 'champ-texte', value: saisie, placeholder: 'Ta demande, en une phrase', 'aria-label': 'Ta demande à ' + nomIA, onChange: (e) => setSaisie(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); demander(saisie); } } }),
                  h(Bouton, { variante: 'principal', disabled: chat.encours || !saisie.trim(), onClick: () => demander(saisie) }, 'Envoyer')))))));
    }

    function GalerieGabarits({ slide, index, total, article, choisir }) {
      const actuel = M.gabaritParDefaut(slide, index);
      const familles = [['Couverture', ['V1', 'V2', 'V3', 'V4', 'V5']], ['Texte', ['T1', 'T2', 'T3', 'T4', 'T5']], ['Fin', ['F1']]];
      return h('div', { className: 'galerie-menu' }, familles.map(([nom, codes]) => h(Fragment, { key: nom },
        h('div', { className: 'titre-section' }, nom),
        h('div', { className: 'grille-gabarits-menu' }, codes.map((code) => h('button', { key: code, type: 'button', className: cls('gabarit-menu', code === actuel && 'actif'), 'aria-pressed': code === actuel, onMouseDown: garder, onClick: () => choisir(code) },
          h(SlideCanvas, { slide: { ...slide, gabarit: code }, formatId: article.format, fondId: article.fond, largeur: 70, index, total, logo: article.logo }), h('span', null, M.GABARITS[code].nom)))))));
    }

    function Nuancier({ valeur, choisir }) {
      const { charte } = useContext(Contexte);
      return h('div', { className: 'nuancier-menu' }, Object.entries(M.fondsDe(charte.palette)).map(([cle, f]) => h('button', {
        key: cle, type: 'button', className: cls('nuance-menu', valeur === cle && 'actif'), title: f.nom, 'aria-label': f.nom, 'aria-pressed': valeur === cle, style: { background: f.fond }, onMouseDown: garder, onClick: () => choisir(cle),
      })));
    }

    function PanneauVerifier({ article, alertes, nbValidees, majA, choisirPolice, contexteRendu, voir }) {
      const libelles = {
        reduire: (s) => `Réduire le texte à ${Math.round(s.echelle * 100)} %`,
        scinder: (s) => (s.reste > 1 ? `Envoyer les ${s.reste} derniers paragraphes sur une nouvelle slide` : 'Envoyer le dernier paragraphe sur une nouvelle slide'),
        portrait: () => 'Passer tout le carrousel en 4:5',
        gabarit: (s) => `Essayer le gabarit « ${M.GABARITS[s.gabarit].nom} »`,
      };
      const appliquer = (a, sol) => {
        if (sol.type === 'reduire') majA(OP.echelle(a.slide, sol.echelle), null, `Texte de la slide ${a.slide + 1} réduit à ${Math.round(sol.echelle * 100)} %.`);
        else if (sol.type === 'scinder') majA(OP.scinder(a.slide, sol.bloc), null, `Slide ${a.slide + 1} coupée en deux.`);
        else if (sol.type === 'portrait') majA(OP.champ('format', 'portrait'), null, 'Carrousel passé en 4:5.');
        else if (sol.type === 'gabarit') majA(OP.gabarit(a.slide, sol.gabarit), null, `Gabarit « ${M.GABARITS[sol.gabarit].nom} » appliqué à la slide ${a.slide + 1}.`);
      };
      return h('div', { className: 'panneau-verifier' },
        alertes.length ? h('ul', { className: 'liste-alertes' }, alertes.map((a) => h('li', { key: a.cle, className: a.niveau },
          h('span', null, (a.slide !== null ? `Slide ${a.slide + 1} · ` : '') + a.message),
          a.type === 'deborde' && h('span', { className: 'solutions' }, M.solutionsDebordement(article, a.slide, choisirPolice, contexteRendu).map((sol, kk) => h('button', { key: kk, type: 'button', className: cls('bouton', kk === 0 ? 'principal' : 'secondaire', 'petit'), onMouseDown: garder, onClick: () => appliquer(a, sol) }, libelles[sol.type](sol)))),
          h('span', { className: 'actions-ligne' },
            a.slide !== null && h('button', { type: 'button', className: 'bouton secondaire petit', onMouseDown: garder, onClick: () => voir(a.slide) }, 'Voir la slide ' + (a.slide + 1)),
            h('button', { type: 'button', className: 'bouton secondaire petit', onMouseDown: garder, onClick: () => majA(OP.validerAlerte(a.cle), null, 'Alerte validée : elle reviendra si la slide change.') }, 'C’est voulu')))))
          : h('p', { className: 'ok petit' }, 'Tout est en ordre : marges, densité, lisibilité, limite du réseau et intégrité du texte.'),
        nbValidees > 0 && h('p', { className: 'doux petit' }, `${nbValidees} alerte(s) validée(s). `, h('button', { type: 'button', className: 'lien', onMouseDown: garder, onClick: () => majA(OP.reafficherAlertes(), null, 'Alertes réaffichées.') }, 'Les réafficher')));
    }

    // Barre flottante « dépliable », sans contour : cinq outils, et une seconde rangée à la demande.
    function BarreFlottante({ position, st, deplie, setDeplie, presets, fond, natures, sous, setSous, actions, menuCouleur, menuTaille, menuFilet, couleurFilet, menuFond, menuAssistant, Robot }) {
      const refFilet = useRef(null);
      const refRobotBarre = useRef(null);
      const refFond = useRef(null);
      const ref = useRef(null);
      const refStyle = useRef(null);
      const refCouleur = useRef(null);
      const [pos, setPos] = useState({ left: -9999, top: -9999 });
      useMiseEnPage(() => {
        const el = ref.current;
        if (!el) return;
        const l = el.offsetWidth;
        const hBarre = el.offsetHeight;
        const tactile = racine.matchMedia && racine.matchMedia('(pointer: coarse)').matches; // sur iPad, la bulle Copier/Coller occupe le dessus
        let top = tactile ? position.bas + 14 : position.haut - hBarre - 14;
        if (top < 74) top = position.bas + 14;
        if (top + hBarre > racine.innerHeight - 8) top = Math.max(74, position.haut - hBarre - 14);
        setPos({ left: Math.max(8, Math.min(position.x - l / 2, document.documentElement.clientWidth - l - 8)), top });
      }, [position.x, position.haut, position.bas, deplie]);
      const bouton = (contenu, action, extra = {}) => h('button', { type: 'button', className: cls('outil', extra.actif && 'actif', extra.classe), title: extra.titre, 'aria-label': extra.titre, 'aria-pressed': extra.actif === undefined ? undefined : !!extra.actif, onMouseDown: garder, onClick: action }, contenu);
      const nomStyle = (natures.find(([c]) => c === st.style) || [0, 'Style'])[1];
      return h('div', { ref, className: 'barre-flottante', role: 'toolbar', 'aria-label': 'Mise en forme de la sélection', style: pos },
        h('div', { className: 'rang' },
          h('button', { ref: refStyle, type: 'button', className: 'outil libelle', 'aria-haspopup': 'true', 'aria-expanded': sous === 'style', onMouseDown: garder, onClick: () => setSous(sous === 'style' ? null : 'style') }, nomStyle, h('span', { className: 'chevron-bas', 'aria-hidden': 'true' }, '▾')),
          bouton(h('b', null, 'B'), () => actions.basculer('gras'), { titre: 'Gras (⌘B)', actif: st.gras }),
          bouton(h('i', { className: 'serif' }, 'I'), () => actions.basculer('italique'), { titre: 'Italique (⌘I)', actif: st.italique }),
          bouton(h('u', null, 'U'), () => actions.basculer('souligne'), { titre: 'Souligné (⌘U)', actif: st.souligne }),
          bouton(h('svg', { className: cls('icone', deplie && 'retournee'), width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M6 9l6 6 6-6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })), () => setDeplie(!deplie), { titre: deplie ? 'Moins d’outils' : 'Plus d’outils', classe: 'deplier' }),
          h('button', { ref: refRobotBarre, type: 'button', className: cls('outil', 'outil-robot', sous === 'ia' && 'actif'), title: 'Assistant IA', 'aria-label': 'Assistant IA', 'aria-haspopup': 'true', 'aria-expanded': sous === 'ia', onMouseDown: garder, onClick: () => setSous(sous === 'ia' ? null : 'ia') }, h(Robot, { taille: 30 }))),
        deplie && h('div', { className: 'rang second' },
          presets.map(([nom, px]) => bouton(String(px), () => actions.formater({ taille: px }), { titre: `${nom} · ${px} px`, actif: st.taille === px, classe: 'puce-taille' })),
          h('span', { className: 'separateur', 'aria-hidden': 'true' }),
          h('button', { ref: refCouleur, type: 'button', className: 'outil', title: 'Couleur', 'aria-label': 'Couleur', 'aria-haspopup': 'true', 'aria-expanded': sous === 'couleur', onMouseDown: garder, onClick: () => setSous(sous === 'couleur' ? null : 'couleur') },
            h('span', { className: 'pastille-couleur', style: { background: fond.accent } })),
          ...[['gauche', 'M4 6h16M4 12h10M4 18h14', 'Aligner à gauche'], ['centre', 'M4 6h16M7 12h10M5 18h14', 'Centrer'], ['droite', 'M4 6h16M10 12h10M6 18h14', 'Aligner à droite']].map(([v, d, t]) => h('button', { key: v, type: 'button', className: cls('outil', st.alignement === v && 'actif'), title: t, 'aria-label': t, 'aria-pressed': st.alignement === v, onMouseDown: garder, onClick: () => actions.aligner(v) },
            h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })))),
          bouton(h('span', { className: 'filet-icone', 'aria-hidden': 'true', style: { background: couleurFilet } }), actions.filetLignes, { titre: 'Filet latéral sur les lignes choisies', actif: st.filetLignes || st.filet }),
          h('button', { ref: refFilet, type: 'button', className: 'outil outil-couleur-filet', title: 'Couleur du filet', 'aria-label': 'Couleur du filet', 'aria-haspopup': 'true', 'aria-expanded': sous === 'filet', onMouseDown: garder, onClick: () => setSous(sous === 'filet' ? null : 'filet') },
            h('span', { className: 'pastille-couleur', style: { background: couleurFilet } }), h('span', { className: 'fleche-mini', 'aria-hidden': 'true' }, '▾')),
          h('button', { ref: refFond, type: 'button', className: 'outil outil-fond', title: 'Fond du paragraphe', 'aria-label': 'Fond du paragraphe', 'aria-haspopup': 'true', 'aria-expanded': sous === 'fond', onMouseDown: garder, onClick: () => setSous(sous === 'fond' ? null : 'fond') },
            h('span', { className: 'icone-fond', 'aria-hidden': 'true' }, 'A')),
          bouton(h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M4 20h16M7 16L17 6M14 3l7 7-7 7', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })), actions.effacer, { titre: 'Effacer la mise en forme' })),
        sous === 'style' && h(Popover, { ancre: refStyle, fermer: () => setSous(null), etiquette: 'Style', contenu: () => natures.map(([cle, nom]) => ({ type: 'action', libelle: h('span', { className: 'apercu-style ' + cle }, nom), coche: st.style === cle, action: () => actions.natureDe(cle) })) }),
        sous === 'couleur' && h(Popover, { ancre: refCouleur, fermer: () => setSous(null), etiquette: 'Couleur', contenu: menuCouleur }),
        sous === 'filet' && h(Popover, { ancre: refFilet, fermer: () => setSous(null), etiquette: 'Couleur du filet', contenu: menuFilet }),
        sous === 'fond' && h(Popover, { ancre: refFond, fermer: () => setSous(null), etiquette: 'Fond du paragraphe', contenu: menuFond }),
        sous === 'ia' && h(Popover, { ancre: refRobotBarre, fermer: () => setSous(null), etiquette: 'Assistant IA', contenu: menuAssistant }));
    }

    return { EtapeComposition, lireTexte, htmlDuBloc, normaliser };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = fabriquer;
  else racine.PostsOPComposition = fabriquer;
})(typeof window !== 'undefined' ? window : globalThis);
