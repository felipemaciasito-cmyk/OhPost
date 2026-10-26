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
    pg.get_by_role('button', name='Carrousel', exact=True).click(); pg.wait_for_timeout(200)
    ouverts = lambda: [x for x in pg.locator('.popover-menu.sous').evaluate_all('(l) => l.map((e) => e.dataset.sous)')]
    centre = lambda nom: pg.get_by_role('menuitem', name=nom, exact=True).bounding_box()
    def survoler(nom):
        bb = centre(nom); pg.mouse.move(bb['x'] + 30, bb['y'] + bb['height'] / 2, steps=4); pg.wait_for_timeout(250)
    survoler('Fond'); verifie('survol de Fond : un seul sous-menu', ouverts() == ['Fond'], ouverts())
    survoler('Dimensions'); verifie('survol de Dimensions : Fond se referme', ouverts() == ['Dimensions'], ouverts())
    survoler('Réseau'); verifie('survol de Réseau : un seul ouvert', ouverts() == ['Réseau'], ouverts())
    pg.get_by_role('menuitem', name='Réseau', exact=True).click(); pg.wait_for_timeout(200)
    verifie('clic après survol : le sous-menu reste ouvert', ouverts() == ['Réseau'], ouverts())
    pg.get_by_role('menuitem', name='Réseau', exact=True).click(); pg.wait_for_timeout(200)
    verifie('second clic : il se referme', ouverts() == [], ouverts())
    survoler('Logo')
    verifie('survol de Logo : un seul ouvert', ouverts() == ['Logo'], ouverts())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # Au doigt : toucher un sous-menu puis un autre
    pg2 = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True); pg2.on('pageerror', lambda e: erreurs.append(str(e)))
    pg2.goto('http://localhost:8765/'); pg2.wait_for_timeout(900)
    pg2.get_by_text('Le silence au travail').first.tap(); pg2.wait_for_timeout(300)
    pg2.locator('nav.etapes .etape').nth(1).tap(); pg2.wait_for_timeout(700)
    pg2.get_by_role('button', name='Carrousel', exact=True).tap(); pg2.wait_for_timeout(200)
    o2 = lambda: pg2.locator('.popover-menu.sous').evaluate_all('(l) => l.map((e) => e.dataset.sous)')
    pg2.get_by_role('menuitem', name='Fond', exact=True).tap(); pg2.wait_for_timeout(200)
    pg2.get_by_role('menuitem', name='Dimensions', exact=True).tap(); pg2.wait_for_timeout(200)
    verifie('au doigt : le second remplace le premier', o2() == ['Dimensions'], o2())
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
