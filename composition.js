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
    const { React, M, L, OP, Contexte, Icone, Bouton, SlideCanvas, cls, partager } = d;
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
        if (avant) placerSelection(el, borne(avant.debut), borne(avant.fin));
      });

      const lire = () => {
        const el = ref.current;
        if (!el || saisieEnCours.current) return;
        const texte = lireTexte(el);
        attendu.current = texte;
        onTexte(texte);
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
        onPaste: (e) => { e.preventDefault(); const t = (e.clipboardData || racine.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t.replace(/\r\n?/g, '\n')); },
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
      useMiseEnPage(() => { if (ouvert && pop.current && ancre.current && parentRef.current) { const r = placerSousMenu(pop.current, ancre.current, parentRef.current); if (r !== remplace) setRemplace(r); } }, [ouvert, remplace]);
      useEffect(() => () => clearTimeout(minuterie.current), []);
      if (el.type === 'trait') return h('div', { className: 'trait-menu', role: 'separator' });
      if (el.type === 'titre') return h('div', { className: 'titre-section' }, el.libelle);
      if (el.type === 'note') return h('p', { className: 'note-menu' }, el.texte);
      if (el.type === 'libre') return h('div', { className: 'libre-menu' }, el.rendu(fermer));
      if (el.type === 'sous') {
        return h('div', {
          className: 'sous-menu',
          onPointerEnter: (e) => { if (e.pointerType === 'touch') return; clearTimeout(minuterie.current); minuterie.current = setTimeout(() => setOuvert(true), 80); },
          onPointerLeave: (e) => { if (e.pointerType !== 'touch') clearTimeout(minuterie.current); },
        },
        h('button', { ref: ancre, type: 'button', className: 'item-menu', role: 'menuitem', 'aria-haspopup': 'true', 'aria-expanded': ouvert, onMouseDown: garder, onClick: () => setOuvert(!ouvert) },
          h('span', null, el.libelle), h('svg', { className: 'fleche-droite', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M9 6l6 6-6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }))),
        ouvert && h('div', { ref: pop, className: 'popover-menu sous', role: 'menu', 'data-sous': el.libelle },
          remplace && h('button', { type: 'button', className: 'item-menu retour', onMouseDown: garder, onClick: () => setOuvert(false) },
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
      const compositions = useMemo(() => article.slides.map((s, k) => M.composer(s, article.format, article.fond, choisirPolice, { index: k, total, reglages, charte, logo })),
        [article.slides, article.format, article.fond, choisirPolice, reglages, charte, logo, total]);
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
          if (!t.closest('.editeur-bloc, .menus-composition, .popover-menu, .barre-flottante, canvas.slide, .barre')) setEdition(null);
        };
        const echap = (e) => { if (e.key === 'Escape') { if (menu || sousBarre) { setMenu(null); setSousBarre(null); } else setEdition(null); } };
        racine.addEventListener('scroll', defiler, { passive: true });
        document.addEventListener('pointerdown', exterieur);
        document.addEventListener('keydown', echap);
        return () => { racine.removeEventListener('scroll', defiler); document.removeEventListener('pointerdown', exterieur); document.removeEventListener('keydown', echap); };
      }, [menu, sousBarre]);

      /* ---------- Édition ---------- */
      const ouvrirBloc = (i, n, depart) => { selRef.current = depart && depart.sel ? depart.sel : { debut: 0, fin: 0 }; setBarre(null); setEdition({ i, n, depart, cle: Date.now() }); dispatch({ type: 'slide', index: i }); };
      function cliquer(i, x, y, e) {
        dispatch({ type: 'slide', index: i });
        const zones = compositions[i].elements.filter((z) => z.type === 'bloc');
        const tol = 14;
        const z = zones.find((b) => x >= b.x - tol && x <= b.x + b.l + tol && y >= b.y - tol && y <= b.y + b.h + tol);
        if (z) ouvrirBloc(i, z.bloc, { point: { x: e.clientX, y: e.clientY } });
        else setEdition(null);
      }
      const ecrire = (texte) => {
        if (!edition || !blocCourant) return;
        const { i, n } = edition;
        majA(blocCourant.lien ? OP.blocLie(i, n, texte) : OP.modifierBloc(i, n, { texte }), `edition-${i}-${n}`);
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
          if (b && !b.texte.trim() && article.slides[p.i].blocs.length > 1) majA(OP.supprimerBloc(p.i, p.n));
        }
      }, [edition]);

      /* ---------- Mise en forme ---------- */
      const exigerBloc = () => { if (!blocCourant) { dispatch({ type: 'message', message: 'Clique d’abord dans un paragraphe d’une slide.' }); return false; } return true; };
      const plage = () => { const { debut, fin } = selRef.current; return fin > debut ? [debut, Math.min(fin, blocCourant.texte.length)] : [0, blocCourant.texte.length]; };
      const apresForme = () => setVersion((v) => v + 1);
      function basculer(cle) {
        if (!exigerBloc()) return;
        const base = cle === 'gras' ? NATURES_GRASSES.includes(blocCourant.style) : false;
        const [debut, fin] = plage();
        const actif = L.partoutVrai(blocCourant.marques, debut, fin, cle, base);
        majA(OP.formater(edition.i, edition.n, debut, fin, { [cle]: !actif === base ? null : !actif }));
        apresForme();
      }
      function formater(changement, annonce) {
        if (!exigerBloc()) return;
        const [debut, fin] = plage();
        majA(OP.formater(edition.i, edition.n, debut, fin, changement), null, annonce);
        apresForme();
      }
      function paragraphe(champs) {
        if (!exigerBloc()) return;
        majA(OP.paragraphe(edition.i, edition.n, champs));
        apresForme();
      }
      const etatSel = () => {
        if (!blocCourant) return {};
        const [debut, fin] = plage();
        const base = NATURES_GRASSES.includes(blocCourant.style);
        const tailles = [...new Set((blocCourant.marques || []).filter((m) => m.debut < fin && m.fin > debut).map((m) => m.taille || 0))];
        return {
          gras: L.partoutVrai(blocCourant.marques, debut, fin, 'gras', base), italique: L.partoutVrai(blocCourant.marques, debut, fin, 'italique', false), souligne: L.partoutVrai(blocCourant.marques, debut, fin, 'souligne', false),
          taille: tailles.length === 1 && tailles[0] ? tailles[0] : null, alignement: blocCourant.alignement || (M.gabaritParDefaut(article.slides[edition.i], edition.i) === 'F1' ? 'centre' : 'gauche'),
          filet: blocCourant.filet !== undefined ? blocCourant.filet : blocCourant.style === 'citation' && !!fond.filet && ['T1', 'T3', 'T5'].includes(M.gabaritParDefaut(article.slides[edition.i], edition.i)),
          style: blocCourant.style,
        };
      };
      const st = etatSel();
      const presets = [['Petit', Math.round(charte.tailleTexte * 0.85)], ['Texte', charte.tailleTexte], ['Moyen', Math.round(charte.tailleTexte * 1.5)], ['Grand', Math.round(charte.tailleTitre * 0.75)], ['Titre', charte.tailleTitre]];
      const aligner = (a) => paragraphe({ alignement: a === (M.gabaritParDefaut(article.slides[edition.i], edition.i) === 'F1' ? 'centre' : 'gauche') ? null : a });
      const basculerFilet = () => { const parDefaut = blocCourant.style === 'citation' && !!fond.filet && ['T1', 'T3', 'T5'].includes(M.gabaritParDefaut(article.slides[edition.i], edition.i)); paragraphe({ filet: !st.filet === parDefaut ? null : !st.filet }); };
      const effacer = () => { const { debut, fin } = selRef.current; formater({ gras: null, italique: null, souligne: null, taille: null, couleur: null }); if (fin <= debut) paragraphe({ alignement: null, filet: null }); };
      const natureDe = (n) => { if (!exigerBloc()) return; majA(OP.modifierBloc(edition.i, edition.n, { style: n })); apresForme(); };

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
        ] },
        { nom: 'Affichage', contenu: () => [
          { type: 'sous', libelle: 'Taille des slides', contenu: () => [['petites', 'Petites'], ['moyennes', 'Moyennes'], ['grandes', 'Grandes']].map(([v, nom]) => item(nom, () => { setTailleEcran(v); ecrirePref('postsop-taille-slides', v); }, coche(tailleEcran === v))) },
          item('Afficher les marges de texte', () => setMarges(!marges), coche(marges)),
          trait,
          { type: 'sous', libelle: 'Aller à la slide', contenu: () => article.slides.map((s, i) => item(`Slide ${i + 1}`, () => allerA(i), { raccourci: nomGabarit(M.gabaritParDefaut(s, i)), coche: active === i })) },
        ] },
        { nom: 'Insertion', contenu: () => [
          item('Nouveau paragraphe', nouveauParagraphe, { raccourci: '↩' }),
          item('Saut de slide', sautDeSlide, { raccourci: '⌘↩' }),
          { type: 'note', texte: 'Le texte qui suit le curseur part sur une nouvelle slide.' },
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
          item('Filet latéral', () => blocCourant ? basculerFilet() : exigerBloc(), { coche: blocCourant ? st.filet : undefined }),
          trait,
          item('Effacer la mise en forme', () => (blocCourant ? effacer() : exigerBloc())),
        ] },
        { nom: 'Slide', titre: `Slide ${active + 1}`, contenu: () => [
          { type: 'sous', libelle: 'Gabarit', contenu: () => [{ type: 'libre', rendu: (fermer) => h(GalerieGabarits, { slide: article.slides[active], index: active, total, article, choisir: (g) => { fermer(); majA(OP.gabarit(active, g), null, `Gabarit « ${nomGabarit(g)} ».`); setEdition(null); } }) }] },
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
      const zoneEdition = edition && compositions[edition.i] ? compositions[edition.i].elements.find((z) => z.type === 'bloc' && z.bloc === edition.n) : null;
      if (zoneEdition) zoneMemoire.current = zoneEdition;
      const zoneAffichee = zoneEdition || (edition && zoneMemoire.current) || null;
      const historique = h('span', { className: 'historique-menus' },
        h('span', { className: 'position' }, `Slide ${active + 1} sur ${total}`));
      return h('div', { className: 'composition' },
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
                c.deborde && h('span', { className: 'deborde' }, 'Déborde'),
                s.echelle && s.echelle < 1 && h('span', { className: 'reduit' }, `Texte à ${Math.round(s.echelle * 100)} %`)),
              h('div', { className: 'cadre-page', style: { width: largeurSlide + 'px', height: Math.round(largeurSlide * fmt.h / fmt.l) + 'px' } },
                h(SlideCanvas, { slide: s, compo: c, formatId: article.format, fondId: article.fond, largeur: largeurSlide, index: i, total, logo, masquer: enEdition ? edition.n : undefined, onPointer: (x, y, e) => cliquer(i, x, y, e), etiquette: `Slide ${i + 1} : clique dans un paragraphe pour l’écrire` }),
                h('div', { className: 'calque' },
                  h('div', { className: 'echelle', style: { width: fmt.l + 'px', height: fmt.h + 'px', transform: `scale(${k})` } },
                    marges && h('div', { className: 'repere-marges', style: { left: M.MARGES.gauche + 'px', top: M.MARGES.haute + 'px', width: fmt.l - M.MARGES.gauche - M.MARGES.droite + 'px', height: fmt.h - M.MARGES.haute - M.MARGES.basse + 'px' } }),
                    enEdition && blocCourant && zoneAffichee && h(EditeurBloc, {
                      key: edition.cle, bloc: blocCourant, zone: zoneAffichee, fond, echelleSlide: s.echelle || 1, depart: edition.depart, version, refExterne: editeurRef,
                      onTexte: ecrire, onTouche: toucher,
                    })))));
          })),
        barre && blocCourant && !menu && h(BarreFlottante, {
          position: barre, st, deplie, setDeplie: (v) => { setDeplie(v); ecrirePref('postsop-barre-depliee', v ? 'oui' : 'non'); },
          presets, fond, natures: natures(), sous: sousBarre, setSous: setSousBarre,
          actions: { basculer, formater, aligner, basculerFilet, effacer, natureDe },
          menuCouleur, menuTaille,
        }));
    }

    /* ================================================================ */
    /* Petits composants                                                */
    /* ================================================================ */

    function TailleLibre({ appliquer }) {
      const [v, setV] = useState('');
      const ok = () => { const n = Number(v); if (n) appliquer(Math.max(12, Math.min(400, Math.round(n)))); };
      return h('div', { className: 'taille-libre' },
        h('input', { type: 'number', inputMode: 'numeric', min: 12, max: 400, placeholder: 'px', value: v, 'aria-label': 'Taille libre en pixels', onChange: (e) => setV(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') ok(); } }),
        h('button', { type: 'button', className: 'bouton principal petit', onClick: ok, disabled: !v }, 'Appliquer'));
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
    function BarreFlottante({ position, st, deplie, setDeplie, presets, fond, natures, sous, setSous, actions, menuCouleur, menuTaille }) {
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
          bouton(h('svg', { className: cls('icone', deplie && 'retournee'), width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M6 9l6 6 6-6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })), () => setDeplie(!deplie), { titre: deplie ? 'Moins d’outils' : 'Plus d’outils', classe: 'deplier' })),
        deplie && h('div', { className: 'rang second' },
          presets.map(([nom, px]) => bouton(String(px), () => actions.formater({ taille: px }), { titre: `${nom} · ${px} px`, actif: st.taille === px, classe: 'puce-taille' })),
          h('span', { className: 'separateur', 'aria-hidden': 'true' }),
          h('button', { ref: refCouleur, type: 'button', className: 'outil', title: 'Couleur', 'aria-label': 'Couleur', 'aria-haspopup': 'true', 'aria-expanded': sous === 'couleur', onMouseDown: garder, onClick: () => setSous(sous === 'couleur' ? null : 'couleur') },
            h('span', { className: 'pastille-couleur', style: { background: fond.accent } })),
          ...[['gauche', 'M4 6h16M4 12h10M4 18h14', 'Aligner à gauche'], ['centre', 'M4 6h16M7 12h10M5 18h14', 'Centrer'], ['droite', 'M4 6h16M10 12h10M6 18h14', 'Aligner à droite']].map(([v, d, t]) => h('button', { key: v, type: 'button', className: cls('outil', st.alignement === v && 'actif'), title: t, 'aria-label': t, 'aria-pressed': st.alignement === v, onMouseDown: garder, onClick: () => actions.aligner(v) },
            h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })))),
          bouton(h('span', { className: 'filet-icone', 'aria-hidden': 'true' }), actions.basculerFilet, { titre: 'Filet latéral', actif: st.filet }),
          bouton(h('svg', { className: 'icone', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M4 20h16M7 16L17 6M14 3l7 7-7 7', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })), actions.effacer, { titre: 'Effacer la mise en forme' })),
        sous === 'style' && h(Popover, { ancre: refStyle, fermer: () => setSous(null), etiquette: 'Style', contenu: () => natures.map(([cle, nom]) => ({ type: 'action', libelle: h('span', { className: 'apercu-style ' + cle }, nom), coche: st.style === cle, action: () => actions.natureDe(cle) })) }),
        sous === 'couleur' && h(Popover, { ancre: refCouleur, fermer: () => setSous(null), etiquette: 'Couleur', contenu: menuCouleur }));
    }

    return { EtapeComposition, lireTexte, htmlDuBloc, normaliser };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = fabriquer;
  else racine.PostsOPComposition = fabriquer;
})(typeof window !== 'undefined' ? window : globalThis);
