# Mise en page : « Agrandir » ouvre la page en grand (agent ciblé, aperçu des posts) sans passer par Apparence générale.
from playwright.sync_api import sync_playwright
import serveur, json, re; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c)
    t = c['messages'][0]['content']
    blocs = [int(m) for m in re.findall(r'^\[(\d+)\]', t.split('<zone>')[1].split('</zone>')[0], re.M)]
    actions = [{'type': 'deplacer', 'bloc': blocs[0], 'vertical': 'bas'}] if blocs else []
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voilà.', 'modifications': [], 'actions': actions}}], 'stop_reason': 'tool_use'}))
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
def article(pg):
    pg.wait_for_timeout(1200)
    return next((a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail'), None)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    n = len(article(pg)['slides'])
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    boutons = pg.locator('.bouton-agrandir')
    verifie('un bouton « Agrandir » par page', boutons.count() == n, (boutons.count(), n))
    verifie('son nom ne se confond pas avec le menu « Page 1 »', pg.get_by_role('button', name='Page 1').count() == 1)
    ag2 = pg.locator('section.page-slide').nth(1).get_by_role('button', name='Agrandir')
    bb = ag2.bounding_box()
    verifie('assez grand pour le doigt (44 points)', bb['height'] >= 44, bb)
    ag2.scroll_into_view_if_needed()
    ag2.tap(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre')
    verifie('la grande fenêtre s’ouvre sur la page 2', gf.count() == 1 and gf.get_attribute('aria-label').startswith('Page 2 sur'), gf.get_attribute('aria-label') if gf.count() else '')
    verifie('Apparence générale ne s’ouvre pas', pg.get_by_role('dialog', name='Apparence générale', exact=True).count() == 0)
    verifie('les logos LinkedIn et Instagram sont là (aperçu du post)', gf.get_by_role('button', name='Aperçu du post LinkedIn').count() == 1 and gf.get_by_role('button', name='Aperçu du post Instagram').count() == 1)
    # Agent ciblé : un geste de mise en page, enregistré dans l'article
    s = gf.locator('.gf-surface').bounding_box()
    pg.mouse.move(s['x'] + 2, s['y'] + 2); pg.mouse.down(); pg.mouse.move(s['x'] + s['width'] - 2, s['y'] + s['height'] - 2, steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
    champ = pg.get_by_label('Ta demande à CCB pour cette zone'); champ.fill('Mets-le en bas'); champ.press('Enter'); pg.wait_for_timeout(1000)
    a = article(pg)
    verifie('le geste de CCB est enregistré dans l’article', a['slides'][1].get('libre') is True, json.dumps(a['slides'][1])[:200])
    pg.locator('.gf-fermer').click(); pg.wait_for_timeout(400)
    verifie('fermer : retour à Mise en page, la page 2 est en mise en page libre', pg.locator('.grande-fenetre').count() == 0 and 'Mise en page libre' in pg.locator('section.page-slide').nth(1).inner_text())
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
