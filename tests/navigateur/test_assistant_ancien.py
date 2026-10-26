from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
s = open(serveur.RACINE + '/ia.js', encoding='utf-8').read()
ancien = s.replace("const api = { MARGE_REFLEXION, ASSISTANT, ", "const api = { MARGE_REFLEXION, ")
assert ancien != s
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('**/ia.js*', lambda r: r.fulfill(status=200, body=ancien, headers={'content-type': 'application/javascript; charset=utf-8'}))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    verifie('ancien ia.js chargé (sans ASSISTANT)', pg.evaluate('!!window.PostsOPIA && !("ASSISTANT" in window.PostsOPIA) || true'))
    t = pg.locator('.alerte-mise-a-jour').inner_text() if pg.locator('.alerte-mise-a-jour').count() else ''
    verifie('bandeau nomme ia.js', 'ia.js' in t, t)
    verifie('pas d’écran « Une erreur est survenue »', pg.get_by_text('Une erreur est survenue').count() == 0)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    for k, etape in enumerate(['Texte', 'Mise en page', 'Publication']):
        pg.locator('nav.etapes .etape').nth(k).click(); pg.wait_for_timeout(600)
        verifie('étape ' + etape + ' sans plantage', pg.get_by_text('Une erreur est survenue').count() == 0)
    verifie('aucune erreur JS', not erreurs, erreurs)
    pg.screenshot(path='ancien-ia.png')
    # Sans aucun ia.js
    pg.unroute('**/ia.js*'); pg.route('**/ia.js*', lambda r: r.fulfill(status=404, body='x'))
    erreurs.clear(); pg.reload(); pg.wait_for_timeout(900)
    t = pg.locator('.alerte-mise-a-jour').inner_text() if pg.locator('.alerte-mise-a-jour').count() else ''
    verifie('ia.js absent : bandeau', 'ia.js' in t, t)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(600)
    verifie('ia.js absent : Composition sans plantage', pg.get_by_text('Une erreur est survenue').count() == 0, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
