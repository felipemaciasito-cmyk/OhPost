# Indicateur de synchronisation : discret, mais il dit combien d'articles ne sont que sur cet appareil ; bulle au toucher.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
appels = []
def github(route):
    # GitHub refuse la clé : rien ne peut être copié.
    appels.append(route.request.url)
    return route.fulfill(status=401, headers={'content-type': 'application/json', 'access-control-allow-origin': '*'}, body=json.dumps({'message': 'Bad credentials'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.github.com/**', github)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1000)
    ind = pg.locator('.etat-synchro')
    # Sans synchronisation réglée
    verifie('non réglée : « Non synchronisé »', ind.count() == 1 and 'Non synchronisé' in ind.inner_text(), ind.inner_text())
    ind.tap(); pg.wait_for_timeout(200)
    bulle = pg.locator('.bulle-synchro')
    verifie('toucher : une bulle explique que les articles ne sont que sur cet appareil', bulle.count() == 1 and 'ne sont que sur cet appareil' in bulle.inner_text() and bulle.get_by_role('button', name='Copier maintenant').count() == 0)
    bulle.get_by_role('button', name='Réglages de synchronisation').tap(); pg.wait_for_timeout(400)
    verifie('« Réglages de synchronisation » ouvre Configuration', 'Configuration' in pg.locator('header').inner_text() and pg.locator('.bulle-synchro').count() == 0)
    # Synchronisation réglée, mais GitHub refuse : les articles restent sur l'appareil
    pg.evaluate("localStorage.setItem('postsop-github', JSON.stringify({proprietaire: 'romain', depot: 'postsop-donnees', cle: 'cle-perimee'}))")
    pg.reload(); pg.wait_for_timeout(2500)
    ind = pg.locator('.etat-synchro')
    t = ind.inner_text()
    verifie('réglée mais en échec : l’indicateur dit combien d’articles ne sont pas copiés', 'pas encore copié' in t and 'Erreur' in t, t)
    verifie('l’indicateur reste discret (une ligne, pas de bandeau)', pg.locator('.alerte-synchro, [role=alert]').count() == 0 and ind.bounding_box()['height'] <= 48, ind.bounding_box())
    ind.tap(); pg.wait_for_timeout(200)
    bulle = pg.locator('.bulle-synchro')
    bt = bulle.inner_text()
    verifie('bulle : la liste des articles concernés', '« Le silence au travail »' in bt and 'que sur cet appareil' in bt, bt[:300])
    verifie('bulle : la raison de l’échec', 'Clé d’accès refusée' in bt, bt[:400])
    n0 = len(appels)
    bulle.get_by_role('button', name='Copier maintenant').tap(); pg.wait_for_timeout(1200)
    verifie('« Copier maintenant » relance la copie', len(appels) > n0, len(appels) - n0)
    pg.mouse.click(600, 600); pg.wait_for_timeout(200)
    verifie('toucher ailleurs ferme la bulle', pg.locator('.bulle-synchro').count() == 0)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
