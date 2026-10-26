from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch()
    for mode in ('souris', 'doigt'):
        ctx = b.new_context(viewport={'width': 1148, 'height': 600}, has_touch=(mode == 'doigt'))
        pg = ctx.new_page(); erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
        pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
        pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
        pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
        clic = (lambda l: l.tap()) if mode == 'doigt' else (lambda l: l.click())
        clic(pg.locator('.menus-composition .titre-menu').filter(has_text='Page').first); pg.wait_for_timeout(300)
        menu = pg.locator('.popover-menu:not(.sous)').first
        sh, ch = menu.evaluate('e => [e.scrollHeight, e.clientHeight]')
        verifie(mode + ' : le menu Page défile (comme sur l’iPad)', sh > ch, (sh, ch))
        for nom in ['Gabarit', 'Logo et fleurs', 'Appliquer un style favori']:
            it = menu.locator('.item-menu').filter(has_text=nom).first
            it.scroll_into_view_if_needed()
            if mode == 'souris': it.hover(); pg.wait_for_timeout(200)
            clic(it); pg.wait_for_timeout(300)
            s = pg.locator(f'.popover-menu.sous[data-sous="{nom}"]')
            dedans = s.count() and s.evaluate('(e) => !!e.parentElement.closest(".popover-menu")')
            bb = s.bounding_box() if s.count() else None
            verifie(f'{mode} : « {nom} » s’ouvre, hors du menu qui défile, à l’écran', s.count() == 1 and not dedans and bb and bb['x'] >= 0 and bb['x'] + bb['width'] <= 1148 and bb['height'] > 30, (s.count(), dedans, bb))
            if s.count() and mode == 'souris':
                s.hover(); pg.wait_for_timeout(250)
                verifie(f'souris : « {nom} » reste ouvert quand on y entre', pg.locator(f'.popover-menu.sous[data-sous="{nom}"]').count() == 1)
        # Choisir un gabarit dans le sous-menu : l'action s'applique et tout se ferme
        it = menu.locator('.item-menu').filter(has_text='Gabarit').first
        it.scroll_into_view_if_needed(); clic(it); pg.wait_for_timeout(300)
        s = pg.locator('.popover-menu.sous[data-sous="Gabarit"]')
        choix = s.locator('.gabarit-menu:not(.actif)').first
        libelle = choix.get_attribute('title') or choix.inner_text() or 'gabarit'
        clic(choix); pg.wait_for_timeout(400)
        verifie(f'{mode} : choisir un gabarit ferme les menus et l’applique', pg.locator('.popover-menu').count() == 0 and pg.get_by_text('Gabarit «').count() >= 1, pg.locator('.popover-menu').count())
        verifie(mode + ' : aucune erreur JS', not erreurs, erreurs)
        # Le thème suit : en sombre, le sous-menu est bien dans .app
        ctx.close()
    ctx = b.new_context(viewport={'width': 1148, 'height': 802}, color_scheme='dark'); pg = ctx.new_page()
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.locator('.menus-composition .titre-menu').filter(has_text='Page').first.click(); pg.wait_for_timeout(300)
    pg.locator('.popover-menu .item-menu').filter(has_text='Gabarit').first.click(); pg.wait_for_timeout(300)
    s = pg.locator('.popover-menu.sous').first
    fond = s.evaluate('e => getComputedStyle(e).backgroundColor'); fondMenu = pg.locator('.popover-menu:not(.sous)').first.evaluate('e => getComputedStyle(e).backgroundColor')
    verifie('sombre : le sous-menu garde les couleurs du thème', fond == fondMenu and s.evaluate('e => !!e.closest(".app")'), (fond, fondMenu))
    pg.screenshot(path='sous-sombre.png'); ctx.close()
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
