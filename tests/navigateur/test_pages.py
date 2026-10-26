# Aucun « slide » visible : écrans, menus de Composition, aides, Configuration, libellés d'accessibilité.
from playwright.sync_api import sync_playwright
import serveur, re; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
JS = "() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label],[title],[placeholder]')].map(e => (e.getAttribute('aria-label')||'') + ' ' + (e.getAttribute('title')||'') + ' ' + (e.getAttribute('placeholder')||''))].join('\\n')"
trouve = {}
def releve(pg, ou):
    t = pg.evaluate(JS)
    for m in re.finditer(r'[^\n]{0,40}\bslides?\b[^\n]{0,40}', t, re.I): trouve.setdefault(ou, set()).add(m.group(0).strip())
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900); releve(pg, 'accueil')
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    for o in pg.locator('main [role=tab], .onglets button').all_inner_texts():
        bt = pg.get_by_role('button', name=o, exact=True)
        if bt.count(): bt.first.click(); pg.wait_for_timeout(250); releve(pg, 'configuration ' + o)
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    for k, e in enumerate(['Texte', 'Mise en page', 'Publication']):
        pg.locator('nav.etapes .etape').nth(k).click(); pg.wait_for_timeout(600)
        if pg.get_by_role('dialog').count(): pg.keyboard.press('Escape')
        releve(pg, 'étape ' + e)
        bi = pg.locator('header button', has_text='i').last
        if bi.count():
            bi.click(); pg.wait_for_timeout(250); releve(pg, 'aide ' + e)
            if pg.locator('.panneau-aide').count(): bi.click(force=True); pg.wait_for_timeout(200)
            if pg.locator('.panneau-aide').count(): pg.locator('.panneau-aide button').first.click(); pg.wait_for_timeout(200)
        if e == 'Mise en page':
            for m in pg.locator('.menus-composition .titre-menu').all_inner_texts():
                pg.locator('.menus-composition .titre-menu').filter(has_text=m).first.click(); pg.wait_for_timeout(250)
                releve(pg, 'menu ' + m)
                for s in pg.locator('.popover-menu .sous-menu > .item-menu').all():
                    try: s.click(); pg.wait_for_timeout(200); releve(pg, 'menu ' + m + ' › sous-menu')
                    except Exception: pass
                pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
                if pg.locator('.popover-menu').count(): pg.keyboard.press('Escape')
    for ou, t in trouve.items(): print('   ', ou, '→', sorted(t)[:6])
    verifie('aucun « slide » visible dans l’app', not trouve, len(trouve))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
