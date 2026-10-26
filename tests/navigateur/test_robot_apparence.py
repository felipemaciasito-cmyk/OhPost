# Mise en page : le robot de la barre de menus est l'agent de l'apparence (« Générer 3 propositions » ou « Une envie ? »).
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    envois.append(json.loads(r.post_data))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': '{"propositions": []}'}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if fa.count(): fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # La bulle du robot de la barre de menus
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    menu = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]')
    items = menu.get_by_role('menuitem').all_inner_texts()
    verifie('deux choix : « Générer 3 propositions » et « Une envie ? »', len(items) == 2 and 'Générer 3 propositions' in items[0] and 'Une envie ?' in items[1], items)
    verifie('plus de « Discuter » dans cette bulle', 'Discuter' not in menu.inner_text(), menu.inner_text())
    # « Une envie ? » : Apparence générale s'ouvre sur le champ, sans appeler l'IA
    n0 = len(envois)
    menu.get_by_role('menuitem', name='Une envie ?').click(); pg.wait_for_timeout(500)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    champ = fa.locator('#indications-ccb')
    verifie('« Une envie ? » ouvre Apparence générale sur le champ de l’envie', fa.count() == 1 and champ.count() == 1)
    verifie('aucun appel à l’IA avant d’avoir écrit l’envie', len(envois) == n0, len(envois) - n0)
    verifie('la fenêtre de discussion du texte ne s’ouvre pas', pg.locator('.fenetre-discussion').count() == 0)
    champ.fill('Un fond vert pâle'); fa.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1200)
    # Sans proposition valable dans la réponse simulée, CCB peut réessayer : chaque demande doit porter l'envie.
    nouveaux = [json.dumps(e, ensure_ascii=False) for e in envois[n0:]]
    verifie('l’envie part au directeur artistique', nouveaux and all('Un fond vert pâle' in e and 'directeur artistique' in e for e in nouveaux), len(nouveaux))
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # Rouverte par son bouton, Apparence générale ne montre pas le champ d'office
    pg.get_by_role('button', name='Apparence générale').click(); pg.wait_for_timeout(400)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    verifie('par le bouton « Apparence générale » : pas de champ d’envie d’office', fa.count() == 1 and fa.locator('#indications-ccb').count() == 0)
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # « Générer 3 propositions » marche toujours : CCB compose aussitôt
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    n1 = len(envois)
    pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(1000)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    verifie('« Générer 3 propositions » ouvre Apparence générale et lance CCB', fa.count() == 1 and len(envois) > n1, len(envois) - n1)
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # L'aide de l'étape dit à quoi sert ce robot
    pg.get_by_role('button', name='Aide sur cet écran').click(); pg.wait_for_timeout(300)
    aide = pg.locator('.panneau-aide')
    verifie('l’aide explique le robot de la barre', aide.count() == 1 and 'CCB pour l’apparence' in aide.inner_text(), aide.inner_text()[:300] if aide.count() else '')
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
