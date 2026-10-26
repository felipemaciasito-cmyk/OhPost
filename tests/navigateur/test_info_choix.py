# Apparence générale : l'explication du choix affiché est dans un « i » à côté de son nom, plus sous le titre.
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
ACTUELLE = 'Les pages de ton article telles qu’elles sont aujourd’hui'
SANS_IA = 'Les paragraphes les uns après les autres'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if fa.count() == 0: pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    infos = fa.locator('.mep-infos')
    titre = infos.locator('h3')
    verifie('Actuelle : l’explication n’est plus affichée sous le titre', 'Mise en page actuelle' in titre.inner_text() and ACTUELLE not in infos.inner_text(), infos.inner_text()[:300])
    i = titre.get_by_role('button', name='Explication')
    verifie('un « i » à côté du nom', i.count() == 1)
    i.tap(); pg.wait_for_timeout(200)
    bulle = pg.locator('.bulle-fixe[role=tooltip]')
    verifie('toucher le « i » montre l’explication', bulle.count() == 1 and ACTUELLE in bulle.inner_text(), bulle.inner_text() if bulle.count() else '')
    pg.wait_for_timeout(700); i.tap(); pg.wait_for_timeout(200)
    verifie('toucher de nouveau la referme', pg.locator('.bulle-fixe[role=tooltip]').count() == 0)
    fa.get_by_role('group', name='Mises en page proposées').get_by_role('button', name='Sans IA').tap(); pg.wait_for_timeout(300)
    verifie('Sans IA : son explication n’est pas non plus sous le titre', SANS_IA not in infos.inner_text(), infos.inner_text()[:300])
    titre.get_by_role('button', name='Explication').tap(); pg.wait_for_timeout(200)
    bulle = pg.locator('.bulle-fixe[role=tooltip]')
    verifie('Sans IA : le « i » donne l’explication de ce choix', bulle.count() == 1 and SANS_IA in bulle.inner_text(), bulle.inner_text() if bulle.count() else '')
    # À la souris : le survol ouvre, et le clic qui suit ne referme pas aussitôt
    pg2 = b.new_page(viewport={'width': 1180, 'height': 820})
    pg2.goto('http://localhost:8765/'); pg2.wait_for_timeout(900)
    pg2.get_by_text('Le silence au travail').first.click(); pg2.wait_for_timeout(300)
    pg2.locator('nav.etapes .etape').nth(1).click(); pg2.wait_for_timeout(700)
    if pg2.get_by_role('dialog', name='Apparence générale', exact=True).count() == 0: pg2.get_by_role('button', name='Apparence générale').first.click(); pg2.wait_for_timeout(400)
    pg2.get_by_role('dialog', name='Apparence générale', exact=True).locator('.mep-infos h3').get_by_role('button', name='Explication').click(); pg2.wait_for_timeout(200)
    verifie('à la souris, le clic ouvre l’explication', pg2.locator('.bulle-fixe[role=tooltip]').count() == 1)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
