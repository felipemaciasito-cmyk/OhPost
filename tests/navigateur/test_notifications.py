# Notifications à la place du menu « Vérifier » : la cloche de la barre de menus et le bouton d'alerte à côté d'une page.
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
    menus = pg.locator('.menus-composition .titre-menu').all_inner_texts()
    verifie('plus de menu « Vérifier »', not any('Vérifier' in m for m in menus), menus)
    cloche = pg.locator('.menus-composition .bouton-notifications')
    bb = cloche.bounding_box() if cloche.count() else None
    verifie('une cloche dans la barre de menus (44 points)', cloche.count() == 1 and bb['height'] >= 44 and bb['width'] >= 44)
    verifie('placée avant « Page 1 sur 6 » et la fleur', cloche.evaluate("e => { const f = document.querySelector('.menus-composition .bouton-fleur'), p = document.querySelector('.historique-menus .position'); return !!(e.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(e.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING); }"))
    verifie('tout en ordre : coche vert anis, nom explicite', 'tout est en ordre' in cloche.get_attribute('aria-label') and cloche.locator('.pastille-notif.ok').count() == 1, cloche.get_attribute('aria-label'))
    verifie('aucune page n’a de bouton d’alerte', pg.locator('.alerte-page').count() == 0)
    verifie('pas de tintement au premier affichage', cloche.locator('.cloche.tinte').count() == 0)
    cloche.click(); pg.wait_for_timeout(300)
    pan = pg.locator('.popover-menu .panneau-verifier')
    verifie('la cloche ouvre la liste : tout est en ordre', pan.count() == 1 and 'Tout est en ordre' in pan.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    verifie('Échap la referme', pg.locator('.panneau-verifier').count() == 0)
    # Une page trop chargée : réunir les pages 1 et 2
    pg.locator('.menus-composition .titre-menu').filter(has_text='Page 1').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Réunir avec la suivante').click(); pg.wait_for_timeout(600)
    lab = cloche.get_attribute('aria-label')
    n = int(cloche.locator('.pastille-notif').inner_text())
    verifie('la pastille compte les alertes', 'à vérifier' in lab and n >= 1 and str(n) in lab, lab)
    verifie('la cloche tinte une fois', cloche.locator('.cloche.tinte').count() == 1)
    ap = pg.locator('.page-slide[data-index="0"] .alerte-page')
    bb = ap.bounding_box() if ap.count() else None
    verifie('la page 1 a son bouton d’alerte (44 points), sous « Agrandir »', ap.count() == 1 and bb['height'] >= 44 and ap.evaluate("e => !!e.previousElementSibling && e.previousElementSibling.classList.contains('bouton-agrandir')"))
    verifie('les autres pages n’en ont pas', pg.locator('.page-slide:not([data-index="0"]) .alerte-page').count() == 0)
    ap.click(); pg.wait_for_timeout(300)
    pan = pg.locator('.popover-menu .panneau-verifier')
    items = pan.locator('.liste-alertes li').all_inner_texts() if pan.count() else []
    verifie('le bouton de la page ne montre que ses alertes', len(items) >= 1 and all(t.startswith('Page 1 ·') for t in items), items)
    pg.locator('.voile-menu').click(position={'x': 5, 'y': 400}); pg.wait_for_timeout(250)
    verifie('toucher à côté referme la liste', pg.locator('.panneau-verifier').count() == 0)
    # « C'est voulu » depuis la page : le bouton disparaît quand il ne reste rien
    for _ in range(6):
        if not ap.count(): break
        ap.click(); pg.wait_for_timeout(250)
        pg.locator('.popover-menu .panneau-verifier').get_by_role('button', name='C’est voulu').first.click(); pg.wait_for_timeout(300)
        if pg.locator('.voile-menu').count(): pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    verifie('« C’est voulu » : le bouton de la page disparaît', ap.count() == 0)
    verifie('la cloche suit', 'tout est en ordre' in cloche.get_attribute('aria-label') or pg.locator('.alerte-page').count() == 0, cloche.get_attribute('aria-label'))
    # Petit écran : le bouton de la page garde son icône
    pg.set_viewport_size({'width': 700, 'height': 900}); pg.wait_for_timeout(300)
    pg.locator('.bouton-notifications').click(); pg.wait_for_timeout(250)
    if pg.locator('.panneau-verifier').get_by_role('button', name='Les réafficher').count():
        pg.locator('.panneau-verifier').get_by_role('button', name='Les réafficher').click(); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    ap = pg.locator('.page-slide[data-index="0"] .alerte-page')
    verifie('alertes réaffichées : le bouton revient', ap.count() == 1)
    bb = ap.bounding_box() if ap.count() else None
    verifie('sur petit écran : icône seule, 44 points', bb and bb['height'] >= 44 and bb['width'] <= 60 and ap.locator('svg').count() == 1, bb)
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
