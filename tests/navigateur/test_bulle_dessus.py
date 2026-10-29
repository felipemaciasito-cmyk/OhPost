# La bulle de synchronisation passe au-dessus de la barre de menus de la Mise en page (elle était coupée par elle).
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
DESSUS = """(b) => { const r = b.getBoundingClientRect(); const pts = []; for (let y = r.top + 6; y < r.bottom - 4; y += 10) pts.push([r.left + r.width / 2, y], [r.left + 12, y]);
  return pts.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !e || !b.contains(e); }).length; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.github.com/**', lambda r: r.fulfill(status=401, headers={'content-type': 'application/json', 'access-control-allow-origin': '*'}, body=json.dumps({'message': 'Bad credentials'})))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-github', JSON.stringify({proprietaire: 'romain', depot: 'postsop-donnees', cle: 'cle-perimee'}))")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(800)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count():
        pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    pg.locator('.etat-synchro').tap(); pg.wait_for_timeout(300)
    bulle = pg.locator('.bulle-synchro')
    menus = pg.locator('.menus-composition').bounding_box()
    bb = bulle.bounding_box() if bulle.count() else None
    verifie('la bulle s’ouvre et croise la barre de menus (le cas signalé)', bb and bb['y'] < menus['y'] + menus['height'] and bb['y'] + bb['height'] > menus['y'], (bb, menus))
    caches = bulle.evaluate(DESSUS)
    verifie('rien ne recouvre la bulle', caches == 0, caches)
    bt = bulle.get_by_role('button', name='Copier maintenant')
    verifie('« Copier maintenant » est visible et touchable', bt.count() == 1 and bt.evaluate("(e) => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }"))
    pg.mouse.click(600, 650); pg.wait_for_timeout(200)
    verifie('toucher ailleurs ferme la bulle', bulle.count() == 0)
    # Les menus de la Mise en page restent au-dessus des pages, comme avant
    pg.locator('.menus-composition .titre-menu').filter(has_text='Réglages').first.click(); pg.wait_for_timeout(250)
    m = pg.locator('.popover-menu').first
    verifie('un menu ouvert reste visible au-dessus des pages', m.count() == 1 and m.evaluate(DESSUS) == 0)
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
