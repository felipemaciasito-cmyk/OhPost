# Grande fenêtre : sélection de zones à la souris et agent ciblé.
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
    c = json.loads(r.post_data); envois.append(c); t = c['messages'][0]['content']
    import re
    blocs = [int(x) for x in re.findall(r'<zone>\n(?:\[(\d+)\][^\n]*\n)+', t)] if False else [int(m) for m in re.findall(r'^\[(\d+)\]', t.split('<zone>')[1].split('</zone>')[0], re.M)]
    mods = [{'bloc': blocs[0], 'texte': 'Texte retouché par CCB.', 'style': 'emphase'}] if blocs else []
    if 'couleur' in t.split('Demande de la personne :')[-1].lower(): mods = []
    rep = 'Je ne peux pas changer les couleurs : c’est dans le menu Carrousel.' if not mods else 'Voilà, plus court.'
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': rep, 'modifications': mods}}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # La grande fenêtre de l'étape Mise en page (« Agrandir ») : à l'étape Publication, elle n'est plus qu'un aperçu
    pg.locator('.page-slide[data-index="0"] .bouton-agrandir').click(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre'); sf = gf.locator('.gf-surface'); bb = sf.bounding_box()
    verifie('la grande fenêtre est ouverte avec sa surface de sélection', gf.count() == 1 and bb['width'] > 300)
    verifie('aucun panneau tant qu’il n’y a pas de sélection', gf.locator('.gf-agent').count() == 0)
    # Rectangle à la souris sur le texte de la couverture
    x0, y0 = bb['x'] + bb['width'] * 0.08, bb['y'] + bb['height'] * 0.30
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 80, y0 + 60, steps=6); pg.mouse.move(bb['x'] + bb['width'] * 0.9, bb['y'] + bb['height'] * 0.55, steps=6)
    verifie('pendant le tracé, le rectangle est dessiné', gf.locator('.gf-zone.trace').count() == 1)
    pg.mouse.up(); pg.wait_for_timeout(200)
    verifie('une zone sélectionnée, l’agent ciblé apparaît', gf.locator('.gf-zone').count() == 1 and gf.locator('.gf-agent').count() == 1)
    verifie('le paragraphe touché est entouré et cité', gf.locator('.gf-paragraphe').count() >= 1 and '«' in gf.locator('.gf-extraits').inner_text())
    # Une nouvelle zone sans touche remplace la précédente
    pg.mouse.move(bb['x'] + bb['width'] * 0.1, bb['y'] + bb['height'] * 0.75); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.5, bb['y'] + bb['height'] * 0.9, steps=6); pg.mouse.up(); pg.wait_for_timeout(150)
    verifie('nouvelle zone sans touche : la précédente disparaît', gf.locator('.gf-zone').count() == 1)
    # Maj ajoute
    pg.keyboard.down('Shift')
    pg.mouse.move(bb['x'] + bb['width'] * 0.1, bb['y'] + bb['height'] * 0.30); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.9, bb['y'] + bb['height'] * 0.5, steps=6); pg.mouse.up()
    pg.keyboard.up('Shift'); pg.wait_for_timeout(150)
    verifie('Maj + zone : elle s’ajoute', gf.locator('.gf-zone').count() == 2)
    # Tab ajoute
    pg.keyboard.down('Tab')
    pg.mouse.move(bb['x'] + bb['width'] * 0.6, bb['y'] + bb['height'] * 0.6); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.9, bb['y'] + bb['height'] * 0.7, steps=6); pg.mouse.up()
    pg.keyboard.up('Tab'); pg.wait_for_timeout(150)
    verifie('Tab + zone : elle s’ajoute aussi', gf.locator('.gf-zone').count() == 3)
    gf.locator('.gf-agent').get_by_role('button', name='Effacer la zone').click(); pg.wait_for_timeout(150)
    verifie('« Effacer la zone » retire tout', gf.locator('.gf-zone').count() == 0 and gf.locator('.gf-agent').count() == 0)
    # Un simple toucher sur un paragraphe le sélectionne
    pg.mouse.click(bb['x'] + bb['width'] * 0.25, bb['y'] + bb['height'] * 0.38); pg.wait_for_timeout(200)
    verifie('un toucher sur un paragraphe le sélectionne', gf.locator('.gf-zone').count() == 1)
    # Demande à l'agent ciblé
    champ = gf.get_by_label('Ta demande à CCB pour cette zone'); champ.fill('Raccourcis ce passage'); champ.press('Enter'); pg.wait_for_timeout(1300)
    m = envois[-1]['messages'][0]['content']
    verifie('la demande ne contient que la zone et le contexte de la page', '<zone>' in m and '<page>' in m and 'Raccourcis ce passage' in m and 'Page 1 sur' in m, m[:300])
    verifie('la réponse de CCB s’affiche', 'Voilà, plus court.' in gf.locator('.gf-agent').inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    verifie('Échap efface la zone puis ferme la fenêtre', pg.locator('.grande-fenetre').count() == 0)
    # La retouche est dans l'article
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(500)
    verifie('le texte retouché est dans la page de l’article', pg.locator('.calque').count() > 0)
    pg.locator('nav.etapes .etape').nth(0).click(); pg.wait_for_timeout(500)
    verifie('et dans le texte de l’article', 'Texte retouché par CCB.' in pg.locator('textarea.editeur-zone').input_value(), pg.locator('textarea.editeur-zone').input_value()[:200])
    # Fermeture involontaire : appui dans la boîte de conversation, relâchement ailleurs (clavier de l'iPad qui décale la boîte)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # La grande fenêtre de l'étape Mise en page (« Agrandir ») : à l'étape Publication, elle n'est plus qu'un aperçu
    pg.locator('.page-slide[data-index="0"] .bouton-agrandir').click(); pg.wait_for_timeout(500)
    bb = pg.locator('.gf-surface').bounding_box()
    pg.mouse.move(bb['x'] + bb['width'] * 0.08, bb['y'] + bb['height'] * 0.28); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.92, bb['y'] + bb['height'] * 0.62, steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
    cb = pg.get_by_label('Ta demande à CCB pour cette zone').bounding_box()
    pg.mouse.move(cb['x'] + cb['width'] / 2, cb['y'] + cb['height'] / 2); pg.mouse.down()
    pg.evaluate("document.querySelector('.gf-agent').style.bottom = '400px'"); pg.wait_for_timeout(100)
    pg.mouse.up(); pg.wait_for_timeout(300)
    verifie('appui dans la boîte puis relâchement ailleurs : la fenêtre reste ouverte', pg.locator('.grande-fenetre').count() == 1)
    pg.get_by_role('button', name='Effacer la zone').click(); pg.wait_for_timeout(150)
    pg.evaluate('document.activeElement && document.activeElement.blur()')
    pg.mouse.click(8, 400); pg.wait_for_timeout(300)
    verifie('toucher le fond, hors de la page : la fenêtre se ferme', pg.locator('.grande-fenetre').count() == 0)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
