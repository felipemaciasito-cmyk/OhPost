# Grande fenêtre : les logos LinkedIn et Instagram (blancs) s'affichent en noir sur une page au fond clair.
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
def filtres(pg):
    return pg.evaluate("[...document.querySelectorAll('.gf-reseau img')].map((i) => getComputedStyle(i).filter)")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if fa.count() == 0: pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    # Fond bleu (foncé) : les logos restent blancs
    fa.get_by_role('group', name='Fond').get_by_role('button', name='Bleu', exact=True).click(); pg.wait_for_timeout(300)
    fa.locator('.page-cliquable').click(); pg.wait_for_timeout(500)
    verifie('fond bleu : deux logos, affichés tels quels (blancs)', len(filtres(pg)) == 2 and all(f == 'none' for f in filtres(pg)), filtres(pg))
    pg.locator('.gf-fermer').click(); pg.wait_for_timeout(300)
    # Fond blanc (clair) : les logos s'affichent en noir
    fa.get_by_role('group', name='Fond').get_by_role('button', name='Blanc', exact=True).click(); pg.wait_for_timeout(300)
    fa.locator('.page-cliquable').click(); pg.wait_for_timeout(500)
    verifie('fond blanc : les logos s’affichent en noir', len(filtres(pg)) == 2 and all('brightness(0)' in f for f in filtres(pg)), filtres(pg))
    srcs = pg.evaluate("[...document.querySelectorAll('.gf-reseau img')].map((i) => i.getAttribute('src'))")
    verifie('les fichiers des logos ne changent pas', srcs == ['logo-linkedin.png', 'logo-instagram.png'], srcs)
    op = pg.evaluate("getComputedStyle(document.querySelector('.gf-reseau img')).opacity")
    verifie('toujours à 50 % de visibilité au repos', op == '0.5', op)
    pg.locator('.gf-fermer').click(); pg.wait_for_timeout(300)
    # Fond vert pâle (clair) aussi
    fa.get_by_role('group', name='Fond').get_by_role('button', name='Vert pâle', exact=True).click(); pg.wait_for_timeout(300)
    fa.locator('.page-cliquable').click(); pg.wait_for_timeout(500)
    verifie('fond vert pâle : les logos s’affichent en noir', all('brightness(0)' in f for f in filtres(pg)), filtres(pg))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
