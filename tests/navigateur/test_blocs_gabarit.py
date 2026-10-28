# Barre des blocs : « Revenir au gabarit » ne touche que les blocs choisis, « Retirer le filet », plus de compteur de blocs.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 900})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.evaluate("localStorage.setItem('postsop-barre-depliee', 'oui')"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    def article():
        pg.wait_for_timeout(900)
        return next(a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail')
    a0 = article()
    # La page qui a le plus de blocs (au moins deux)
    i = max(range(len(a0['slides'])), key=lambda k: len([x for x in a0['slides'][k]['blocs'] if x['texte'].strip()]))
    nb = len(a0['slides'][i]['blocs'])
    page = pg.locator(f'.page-slide[data-index="{i}"]'); page.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    cal = page.locator('.calque')
    barre = pg.locator('.barre-blocs')
    def selectionner(n):
        # Touche le bloc n là où il est : d'après sa place enregistrée (page libre), sinon en cherchant du haut vers le bas.
        pg.mouse.click(5, 450); pg.wait_for_timeout(200)
        bb = cal.bounding_box(); k = bb['width'] / 1080
        s = article()['slides'][i]
        pos = s['blocs'][n].get('pos') if s.get('libre') else None
        essais = [(bb['x'] + (pos['x'] + 40) * k, bb['y'] + (pos['y'] + 25) * k)] if pos else [(bb['x'] + bb['width'] * 0.3, bb['y'] + bb['height'] * y / 100) for y in range(4, 96, 3)]
        for x, y in essais:
            pg.mouse.click(x, y); pg.wait_for_timeout(350)
            vus = pg.evaluate("() => [...document.querySelectorAll('.selection-bloc')].map(e => e.dataset.bloc)")
            if vus == [str(n)]: return True
            pg.mouse.click(5, 450); pg.wait_for_timeout(350)
        return False
    print('   page', i + 1, ':', nb, 'blocs')
    verifie('la page de test a au moins deux blocs', nb >= 2, nb)
    ok = selectionner(0)
    verifie('un bloc sélectionné : la barre apparaît', ok and barre.count() == 1)
    verifie('plus d’espace « 1 bloc » à gauche de la barre', barre.locator('.nb-blocs').count() == 0 and '1 bloc' not in barre.inner_text(), barre.inner_text()[:60])
    premier = barre.locator('button').first.get_attribute('aria-label')
    verifie('la barre commence directement par « Fusionner »', premier and premier.startswith('Réunir'), premier)
    # Filet : poser, puis le bouton devient « Retirer le filet »
    def menu_filet():
        barre.get_by_role('button', name='Filet latéral', exact=True).click(); pg.wait_for_timeout(250)
        return pg.locator('.popover-menu').last
    m = menu_filet()
    verifie('sans filet : « Filet sur tout le paragraphe »', m.get_by_role('menuitem', name='Filet sur tout le paragraphe').count() == 1 and m.get_by_role('menuitem', name='Retirer le filet').count() == 0)
    m.get_by_role('menuitem', name='Filet sur tout le paragraphe').click(); pg.wait_for_timeout(300)
    a1 = article()
    verifie('le filet est posé', a1['slides'][i]['blocs'][0].get('filet') is True, a1['slides'][i]['blocs'][0].get('filet'))
    if not barre.count(): selectionner(0)
    m = menu_filet()
    verifie('avec un filet : le bouton devient « Retirer le filet »', m.get_by_role('menuitem', name='Retirer le filet').count() == 1 and m.get_by_role('menuitem', name='Filet sur tout le paragraphe').count() == 0)
    m.get_by_role('menuitem', name='Retirer le filet').click(); pg.wait_for_timeout(300)
    a2 = article()
    verifie('« Retirer le filet » l’enlève', not a2['slides'][i]['blocs'][0].get('filet'), a2['slides'][i]['blocs'][0].get('filet'))
    # Filet sur une partie du texte seulement : le bouton propose aussi de le retirer
    pg.mouse.click(5, 450); pg.wait_for_timeout(150)
    selectionner(0)
    zb = pg.locator('.selection-bloc').first.bounding_box()
    pg.mouse.dblclick(zb['x'] + 30, zb['y'] + 20); pg.wait_for_timeout(400)
    sel = '(el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(6, n.length)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); }'
    if pg.locator('.editeur-bloc').count():
        pg.locator('.editeur-bloc').evaluate(sel); pg.wait_for_timeout(300)
        pg.get_by_role('button', name='Filet latéral sur les lignes choisies').click(); pg.wait_for_timeout(300)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    a3 = article()
    partiel = any(mq.get('filet') for mq in (a3['slides'][i]['blocs'][0].get('marques') or []))
    verifie('filet posé sur une partie du texte seulement', partiel, json.dumps(a3['slides'][i]['blocs'][0].get('marques'))[:200])
    if not barre.count(): selectionner(0)
    m = menu_filet()
    verifie('filet sur une partie du texte : « Retirer le filet » aussi', m.get_by_role('menuitem', name='Retirer le filet').count() == 1)
    m.get_by_role('menuitem', name='Retirer le filet').click(); pg.wait_for_timeout(300)
    a4 = article()
    verifie('le filet partiel est retiré', not any(mq.get('filet') for mq in (a4['slides'][i]['blocs'][0].get('marques') or [])) and not a4['slides'][i]['blocs'][0].get('filet'))
    # Revenir au gabarit : seulement le bloc choisi
    def glisser(n, dx, dy):
        if not selectionner(n): return False
        s0 = pg.locator('.selection-bloc').first.bounding_box(); x0, y0 = s0['x'] + s0['width'] / 2, s0['y'] + s0['height'] / 2
        pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 10, y0 + 10, steps=3); pg.mouse.move(x0 + dx, y0 + dy, steps=8); pg.mouse.up(); pg.wait_for_timeout(400)
        return True
    ok1 = glisser(1, 47, 33)
    a5 = article()
    s5 = a5['slides'][i]
    verifie('glisser un bloc : la page passe en mise en page libre', s5.get('libre') is True and s5['blocs'][0].get('pos'), json.dumps(s5)[:200])
    p_gabarit0 = s5['blocs'][0]['pos']
    glisser(0, 61, 29)
    a6 = article()
    p_deplace0 = a6['slides'][i]['blocs'][0]['pos']; p_deplace1 = a6['slides'][i]['blocs'][1]['pos']
    verifie('le premier bloc a bougé', abs(p_deplace0['x'] - p_gabarit0['x']) > 5 or abs(p_deplace0['y'] - p_gabarit0['y']) > 5, (p_gabarit0, p_deplace0))
    selectionner(0)
    # Mise en forme à effacer aussi : un filet
    m = menu_filet(); m.get_by_role('menuitem', name='Filet sur tout le paragraphe').click(); pg.wait_for_timeout(300)
    if not barre.count(): selectionner(0)
    rv = barre.get_by_role('button', name='Ce bloc reprend la place et l’apparence du gabarit', exact=True)
    verifie('« Revenir au gabarit » dans la barre, pour ce bloc', rv.count() == 1)
    rv.click(); pg.wait_for_timeout(400)
    a7 = article(); s7 = a7['slides'][i]
    p0 = s7['blocs'][0].get('pos'); p1 = s7['blocs'][1].get('pos')
    verifie('le bloc choisi reprend sa place du gabarit', p0 and abs(p0['x'] - p_gabarit0['x']) < 2 and abs(p0['y'] - p_gabarit0['y']) < 2, (p_gabarit0, p0))
    verifie('et son apparence (filet effacé)', not s7['blocs'][0].get('filet'))
    verifie('l’autre bloc ne bouge pas', p1 == p_deplace1, (p_deplace1, p1))
    verifie('la page reste en mise en page libre', s7.get('libre') is True)
    verifie('le texte ne change pas', [x['texte'] for x in s7['blocs']] == [x['texte'] for x in a0['slides'][i]['blocs']], [x['texte'][:20] for x in s7['blocs']])
    # Tous les blocs choisis : toute la page revient au gabarit
    pg.mouse.click(5, 450); pg.wait_for_timeout(150)
    selectionner(0); pg.keyboard.press('Meta+a'); pg.wait_for_timeout(250)
    if pg.locator('.selection-bloc').count() < 2:
        pg.keyboard.press('Control+a'); pg.wait_for_timeout(250)
    if pg.locator('.selection-bloc').count() >= 2:
        barre.get_by_role('button', name='Ces blocs reprennent la place et l’apparence du gabarit', exact=True).click(); pg.wait_for_timeout(400)
        s8 = article()['slides'][i]
        verifie('tous les blocs choisis : la page revient entièrement au gabarit', not s8.get('libre') and not any(x.get('pos') for x in s8['blocs']))
    else:
        verifie('tout sélectionner (⌘A) choisit tous les blocs', False, pg.locator('.selection-bloc').count())
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
