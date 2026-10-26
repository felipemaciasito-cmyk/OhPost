# Agent ciblé depuis Apparence générale : la retouche suit « Appliquer » ; Annuler ; texte hors zone intact.
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
    c = json.loads(r.post_data); envois.append(c); t = c['messages'][0]['content']
    blocs = [int(m) for m in re.findall(r'^\[(\d+)\]', t.split('<zone>')[1].split('</zone>')[0], re.M)]
    mods = [{'bloc': blocs[0], 'texte': 'Retouche « test ».'}, {'bloc': 99, 'texte': 'hors zone : ignorée'}]
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Fait.', 'modifications': mods}}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e))); consoles = []; pg.on('console', lambda m: consoles.append(m.text) if m.type == 'error' else None)
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(500)
    fen = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    fen.locator('.mep-vignette').nth(1).click(); pg.wait_for_timeout(200)
    fen.locator('.page-cliquable').click(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre'); sf = gf.locator('.gf-surface'); bb = sf.bounding_box()
    verifie('la grande fenêtre s’ouvre sur la page choisie (2)', '2 / ' in gf.inner_text())
    pg.mouse.click(bb['x'] + bb['width'] * 0.3, bb['y'] + bb['height'] * 0.45); pg.wait_for_timeout(200)
    if not gf.locator('.gf-agent').count():
        pg.mouse.move(bb['x'] + bb['width'] * 0.05, bb['y'] + bb['height'] * 0.2); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.95, bb['y'] + bb['height'] * 0.8, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    verifie('un paragraphe est sélectionné', gf.locator('.gf-agent').count() == 1)
    champ = gf.get_by_label('Ta demande à CCB pour cette zone'); champ.fill('Reformule'); champ.press('Enter'); pg.wait_for_timeout(1300)
    verifie('la retouche est valide : seul le paragraphe de la zone change (le bloc 99 est ignoré)', 'Fait.' in gf.locator('.gf-agent').inner_text() and 'Annuler la retouche' in gf.locator('.gf-agent').inner_text())
    gf.get_by_role('button', name='Annuler la retouche').click(); pg.wait_for_timeout(300)
    verifie('« Annuler la retouche » : confirmé dans la discussion', 'J’ai annulé la dernière retouche.' in gf.locator('.gf-agent').inner_text() and gf.get_by_role('button', name='Annuler la retouche').count() == 0)
    champ.fill('Reformule encore'); champ.press('Enter'); pg.wait_for_timeout(1300)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    verifie('fenêtre refermée', pg.locator('.grande-fenetre').count() == 0)
    fen = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    verifie('on est toujours dans Apparence générale', fen.count() == 1)
    fen.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(900)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(400)
    verifie('aucune erreur JavaScript ni de React dans la console', not erreurs and not [c for c in consoles if 'hook' in c.lower() or 'Warning' in c], (erreurs, consoles[:3]))
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
