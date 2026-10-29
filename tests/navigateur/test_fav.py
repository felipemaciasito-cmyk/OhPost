from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
def etat_articles(pg):
    return pg.evaluate("""() => new Promise((ok) => { const r = indexedDB.open('postsop'); r.onsuccess = () => { try { const db = r.result; const noms = [...db.objectStoreNames]; ok(noms); } catch (e) { ok(String(e)); } }; r.onerror = () => ok('err'); })""")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)

    def gabarits():
        for nom_menu in ('Affichage',):
            pg.get_by_role('button', name=nom_menu, exact=True).click(); pg.wait_for_timeout(200)
        pg.get_by_role('menuitem', name='Aller à la page').click(); pg.wait_for_timeout(200)
        t = pg.locator('[role^=menuitem]').filter(has_text='Page ').all_inner_texts()
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
        return [x.replace('\n', ' ') for x in t if x.startswith('Page ')]
    def menu_slide(n):
        pg.get_by_role('button', name='Page', exact=True).click(); pg.wait_for_timeout(250)  # le menu « Page » agit sur la page active
    menu_slide(1)
    verifie('menu Page : « Garder dans mes favoris »', pg.get_by_role('menuitem', name='☆ Garder dans mes favoris').count() == 1)
    pg.get_by_role('menuitem', name='☆ Garder dans mes favoris').click(); pg.wait_for_timeout(300)
    verifie('message de confirmation', 'gardée dans tes favoris' in pg.locator('.message').inner_text())
    menu_slide(1)
    verifie('la page est marquée ★', pg.get_by_role('menuitem', name='★ Retirer de mes favoris').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # Aller à la page 3 et appliquer le favori
    for nom_menu in ('Affichage', 'Réglages', 'Édition'):
        pg.get_by_role('button', name=nom_menu, exact=True).click(); pg.wait_for_timeout(200)
        if pg.get_by_role('menuitem', name='Aller à la page').count(): break
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.get_by_role('menuitem', name='Aller à la page').click(); pg.wait_for_timeout(200)
    print('   sous-menu :', pg.get_by_role('menuitem').all_inner_texts()[:12])
    pg.locator('[role^=menuitem]').filter(has_text='Page 3').first.click(); pg.wait_for_timeout(400)
    actif = pg.locator('.compteur-slide, [class*=compteur]').first.inner_text() if pg.locator('.compteur-slide, [class*=compteur]').count() else ''
    nom_slide = ['Page ' + str(int(pg.locator('.page-slide.active').get_attribute('data-index')) + 1)]  # la page active (le menu s'appelle maintenant « Page »)
    img_avant = pg.locator('canvas[aria-label="Page 3"]').evaluate('(c) => c.toDataURL()')
    menu_slide(int(nom_slide[0][5:]))
    print('   slide active :', nom_slide[0], '| menu :', pg.get_by_role('menuitem').all_inner_texts()[:4])
    n = int(nom_slide[0][5:])
    avant = pg.evaluate("() => JSON.stringify(window.__PostsOPEtat ? 1 : 0)")
    pg.get_by_role('menuitem', name='Appliquer un style favori').click(); pg.wait_for_timeout(300)
    tuiles = pg.locator('.favori-menu')
    verifie('galerie des favoris avec aperçu', tuiles.count() == 1 and tuiles.first.locator('canvas').count() == 1)
    tuiles.first.locator('button.gabarit-menu').click(); pg.wait_for_timeout(400)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('style appliqué, texte inchangé annoncé', f'Style favori appliqué à la page {n}' in msg, msg)
    menu_slide(n)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    img_apres = pg.locator('canvas[aria-label="Page 3"]').evaluate('(c) => c.toDataURL()')
    verifie('la page 3 a changé de présentation', img_apres != img_avant)
    print('   message avant Annuler :', pg.locator('.message').inner_text() if pg.locator('.message').count() else '(aucun)')
    pg.locator('.message').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(300)
    verifie('Annuler : la page reprend sa présentation exacte', pg.locator('canvas[aria-label="Page 3"]').evaluate('(c) => c.toDataURL()') == img_avant)
    # Le texte des pages n'a pas bougé : vérifier dans l'étape Texte + Vérifier
    pg.locator('.bouton-notifications').click(); pg.wait_for_timeout(300)
    t = pg.locator('body').inner_text()
    verifie('aucun texte perdu ni ajouté', 'absent' not in t.lower() and 'ajouté' not in t.lower())
    pg.keyboard.press('Escape')
    # Rechargement : le favori est gardé
    pg.reload(); pg.wait_for_timeout(1000)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    menu_slide(1)
    verifie('favori gardé après rechargement', pg.get_by_role('menuitem', name='★ Retirer de mes favoris').count() == 1)
    pg.get_by_role('menuitem', name='Appliquer un style favori').click(); pg.wait_for_timeout(300)
    pg.locator('.favori-retirer').first.click(); pg.wait_for_timeout(300)
    verifie('× retire le favori : galerie vide', 'Aucun favori pour l’instant' in pg.locator('body').inner_text())
    pg.screenshot(path='fav.png')
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
