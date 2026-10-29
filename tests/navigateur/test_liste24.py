# Liste du 24 octobre : ajout rapide, vert soutenu, opacité des fonds, repères discrets, Vérifier.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    # Moteur : opacité des fonds et fonds de page
    r = pg.evaluate("""() => { const M = window.PostsOPMoteur; const pol = (x) => M.policeSysteme(x === 'bold' ? 700 : 300);
      const c = M.composer({ gabarit: 'V2', blocs: [{ texte: 'Titre', style: 'titre' }, { texte: 'Sous le bandeau', style: 'contrepoint' }] }, 'portrait', 'blanc', pol, { index: 0, total: 3 });
      const bande = c.elements.find((e) => e.type === 'rect' && e.l >= 1080);
      const t5 = M.composer({ gabarit: 'T5', blocs: [{ texte: 'Un encadré', style: 'emphase' }] }, 'portrait', 'blanc', pol, { index: 1, total: 3 });
      const carte = t5.elements.find((e) => e.type === 'rect');
      return [bande && bande.opacite, carte && carte.opacite, Object.keys(M.fondsDePage(M.PALETTE || {})).includes('vert'), M.OPACITE_FONDS]; }""")
    verifie('bandeau et encadré en opacité réduite', r[0] == r[3] and r[1] == r[3] and r[3] < 1, r)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    # Fond de page : pas de vert soutenu
    pg.locator('.menus-composition .titre-menu').filter(has_text='Réglages').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Fond', exact=True).click(); pg.wait_for_timeout(250)
    fonds = pg.locator('.nuance-menu').evaluate_all('l => l.map(e => e.getAttribute("aria-label"))')
    verifie('menu Fond : pas de « Vert » plein', 'Vert' not in fonds and 'Vert pâle' in fonds, fonds)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    noms = pg.locator('[role=dialog] .fond-choix .fond-nom').all_inner_texts()
    verifie('fenêtre Apparence générale : pas de « Vert » plein', 'Vert' not in noms and len(noms) == 4, noms)
    pg.locator('[role=dialog] .feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(200)
    # Ajout rapide depuis la barre de sélection
    pg.mouse.click(600, 590); pg.wait_for_timeout(250); pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    sel = '(el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(9, n.length)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); }'
    pg.locator('.editeur-bloc').evaluate(sel); pg.wait_for_timeout(300)
    verifie('plus de « + » dans la barre de sélection', pg.locator('.barre-flottante').get_by_role('button', name='Ajouter le logo ou les fleurs').count() == 0)
    pg.keyboard.press('Escape'); pg.mouse.click(5, 300); pg.wait_for_timeout(200)
    fl = pg.locator('.menus-composition .bouton-fleur')
    verifie('bouton fleur dans la barre de menus, avant « Apparence générale »', fl.count() == 1 and fl.evaluate("e => { const a = document.querySelector('.bouton-mise-en-page'); return !!a && !!(e.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING); }"))
    fl.hover(); pg.wait_for_timeout(350)
    t = fl.locator('.fleur').evaluate('e => getComputedStyle(e).transform')
    verifie('au survol, la fleur tourne', t != 'none' and t != 'matrix(1, 0, 0, 1, 0, 0)', t)
    b0 = fl.bounding_box(); bp = fl.locator('.pastille-ajout').bounding_box()
    verifie('le « + » dépasse du bouton en haut à droite', bp['x'] + bp['width'] > b0['x'] + b0['width'] and bp['y'] < b0['y'], (b0, bp))
    fl.click(); pg.wait_for_timeout(250)
    pg.locator('[role^=menuitem]', has_text='Fleurs').first.click(); pg.wait_for_timeout(400)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('fleurs ajoutées sur la page et choisies', 'Fleurs ajoutées' in msg and pg.locator('.selection-image').count() == 1, msg)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # Repères plus fins
    w = pg.evaluate("""() => { const d = document.createElement('div'); d.className = 'repere-ligne v'; d.style.setProperty('--inv', '1'); document.body.appendChild(d); const r = [getComputedStyle(d).width, getComputedStyle(d).opacity]; d.remove(); return r; }""")
    verifie('repères d’un pixel, plus discrets', w[0] == '1px' and float(w[1]) < 1, w)
    # Vérifier : un bloc hors de la page, « Voir l'élément », mise en avant, « Tout est voulu »
    def sortir(n):
        cal = pg.locator('.calque').nth(n); cal.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        bb = cal.bounding_box(); k = bb['width'] / 1080
        pg.mouse.click(5, 300); pg.wait_for_timeout(150)
        pg.mouse.click(bb['x'] + 300 * k, bb['y'] + bb['height'] * 0.45); pg.wait_for_timeout(300)
        sb = pg.locator('.selection-bloc')
        if not sb.count(): return False
        s0 = sb.bounding_box(); x0, y0 = s0['x'] + s0['width'] / 2, s0['y'] + s0['height'] / 2
        pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 20, y0 + 20, steps=4); pg.mouse.move(x0 + 520 * k, y0 + 40, steps=10); pg.mouse.up(); pg.wait_for_timeout(400)
        return True
    ok1 = sortir(1); ok2 = sortir(2)
    pg.mouse.click(5, 300); pg.wait_for_timeout(200)
    pg.locator('.bouton-notifications').click(); pg.wait_for_timeout(300)
    panneau = pg.locator('.panneau-verifier')
    txt = panneau.inner_text() if panneau.count() else ''
    verifie('deux blocs sortis de la page : alertes', ok1 and ok2 and txt.count('sort de la page') >= 2, txt[:300])
    voir = panneau.get_by_role('button', name='Voir l’élément')
    verifie('« Voir l’élément » remplace « Voir la page »', voir.count() >= 2 and panneau.get_by_role('button', name='Voir la page 2').count() == 0)
    voir.first.click(); pg.wait_for_timeout(700)
    mea = pg.locator('.mise-en-avant')
    verifie('l’élément est mis en avant sur sa page', mea.count() >= 1 and mea.first.evaluate('e => e.closest(".page-slide").dataset.index') in ('1', '2'))
    pg.screenshot(path='mise-en-avant.png')
    pg.wait_for_timeout(2800)
    verifie('la mise en avant s’efface seule', pg.locator('.mise-en-avant').count() == 0)
    pg.locator('.bouton-notifications').click(); pg.wait_for_timeout(300)
    panneau = pg.locator('.panneau-verifier')
    panneau.get_by_role('button', name='Tout est voulu').click(); pg.wait_for_timeout(200)
    verifie('« Tout est voulu » demande confirmation', panneau.get_by_role('alertdialog').count() == 1 and 'alertes d’un coup' in panneau.inner_text())
    panneau.get_by_role('button', name='Tout valider').click(); pg.wait_for_timeout(400)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('toutes les alertes validées d’un coup', 'validées' in msg, msg)
    if not pg.locator('.panneau-verifier').count(): pg.locator('.bouton-notifications').click(); pg.wait_for_timeout(300)
    verifie('plus d’alerte affichée', 'Tout est en ordre' in pg.locator('.panneau-verifier').inner_text())
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
