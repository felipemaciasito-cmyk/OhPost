# Réparer au lieu de rejeter : une proposition dont une page déborde est ajustée, pas écartée.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
import re
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); t = c['messages'][0]['content']
    n = len(re.findall(r'^\[\d+\] ', t, re.M))
    # Trois propositions : la deuxième entasse tout le reste du texte sur une seule page (elle déborde).
    a = {'nom': 'Aérée', 'pourquoi': 'x', 'fond': 'bleu', 'slides': [{'gabarit': 'V1', 'paragraphes': [0], 'styles': ['titre']}] + [{'gabarit': 'T1', 'paragraphes': list(range(k, min(n, k + 3))), 'styles': ['corps'] * len(range(k, min(n, k + 3)))} for k in range(1, n, 3)]}
    b = {'nom': 'Entassée', 'pourquoi': 'x', 'fond': 'blanc', 'slides': [{'gabarit': 'V1', 'paragraphes': [0], 'styles': ['titre']}, {'gabarit': 'T1', 'paragraphes': list(range(1, n)), 'styles': ['corps'] * (n - 1)}]}
    cc = dict(a, nom='Troisième', fond='bleuPale')
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici.', 'propositions': [a, b, cc]}}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fen = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    fen.locator('.bouton-robot').click(); pg.wait_for_timeout(200); fen.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(2000)
    noms = fen.get_by_role('group', name='Mises en page proposées').get_by_role('button').all_inner_texts()
    verifie('la proposition qui débordait est gardée, réparée', 'Entassée' in noms, noms)
    fen.get_by_role('group', name='Mises en page proposées').get_by_role('button', name='Entassée').click(); pg.wait_for_timeout(300)
    n = fen.locator('.mep-vignette').count()
    verifie('page trop chargée coupée : plus de 2 pages, 6 au plus', 2 < n <= 6, n)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
