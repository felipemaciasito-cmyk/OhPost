# Supprimer tous les blocs de la dernière page : la page vide est retirée et la nouvelle dernière page reprend
# la signature (le logo de fin). Avant, le logo de fin disparaissait du carrousel.
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
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    def article():
        pg.wait_for_timeout(900)
        return next(a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail')
    a0 = article()
    n0 = len(a0['slides']); i = n0 - 1
    verifie('au départ, la dernière page porte la signature', a0['slides'][i].get('signature') is True and not any(s.get('signature') for s in a0['slides'][:-1]))
    page = pg.locator(f'.page-slide[data-index="{i}"]'); page.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    cal = page.locator('.calque')
    # Sélectionner tous les blocs de la dernière page (un seul dans l'exemple) : on cherche du haut vers le bas.
    trouve = False
    bb = cal.bounding_box()
    for y in range(4, 96, 3):
        pg.mouse.click(bb['x'] + bb['width'] * 0.3, bb['y'] + bb['height'] * y / 100); pg.wait_for_timeout(300)
        vus = pg.evaluate("() => [...document.querySelectorAll('.selection-bloc')].map(e => e.dataset.bloc)")
        if vus == ['0']: trouve = True; break
        pg.mouse.click(5, 450); pg.wait_for_timeout(250)
    verifie('le bloc de la dernière page est sélectionné', trouve)
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(500)
    a1 = article()
    verifie('la page vide est retirée', len(a1['slides']) == n0 - 1, len(a1['slides']))
    verifie('la nouvelle dernière page reprend la signature (logo de fin)', a1['slides'][-1].get('signature') is True, [s.get('signature') for s in a1['slides']])
    verifie('aucune autre page n’a la signature', not any(s.get('signature') for s in a1['slides'][:-1]))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
