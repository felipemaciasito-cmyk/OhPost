from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    toile = lambda: pg.locator('canvas[aria-label="Page 1"]').evaluate('(c) => c.toDataURL()')
    avant = toile()
    pg.mouse.click(600, 590); pg.wait_for_timeout(250); pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    ed = pg.locator('.editeur-bloc')
    verifie('écriture d’un bloc ouverte', ed.count() == 1)
    # Sélectionner les 12 premiers caractères du bloc
    ed.evaluate('(el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(12, n.length)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); }')
    pg.wait_for_timeout(200)
    # Plus de menu Format : le même menu du filet s'ouvre par la barre du texte choisi (« Couleur du filet »)
    if pg.get_by_role('button', name='Plus d’outils').count(): pg.get_by_role('button', name='Plus d’outils').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Couleur du filet').click(); pg.wait_for_timeout(200)
    menu = pg.locator('[role=menu]').last.inner_text()
    verifie('sous-menu : lignes choisies, couleurs de charte et couleur libre', 'À côté des lignes choisies' in menu and 'Charte · vert pâle' in menu and 'Couleur libre' in menu, menu[:300])
    pg.get_by_role('menuitem', name='Charte · vert pâle', exact=True).click(); pg.wait_for_timeout(400)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('filet ajouté à côté des lignes choisies', 'Filet ajouté' in msg, msg)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    apres = toile()
    verifie('la page est redessinée avec le filet', apres != avant)
    pg.locator('.message').get_by_role('button', name='Annuler').click() if pg.locator('.message').count() else None
    pg.wait_for_timeout(400)
    verifie('Annuler retire le filet', toile() == avant)
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    pg.screenshot(path='filet.png')
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
