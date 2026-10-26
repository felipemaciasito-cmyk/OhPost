# Liste du 24 octobre, suite : « Utiliser comme modèle » et CCB dans Publication.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'envois': []}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); etat['envois'].append(c)
    s = c.get('system', ''); t = c['messages'][0]['content']
    if s.startswith('Tu écris le texte qui accompagne') and c.get('tools'):
        inp = {'propositions': ['Version une, courte.', 'Version deux, une question ?', 'Version trois, avec un angle différent.']}
    else:
        inp = {'reponse': 'Voici une piste.', 'propositions': [{'avant': 'Bonjour', 'apres': 'Bonjour à tous', 'pourquoi': 'Plus chaleureux.'}], 'pistes': []}
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': inp}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    # Utiliser comme modèle
    pg.get_by_role('button', name='Actions pour Le silence au travail').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Utiliser comme modèle').click(); pg.wait_for_timeout(600)
    z = pg.locator('#texte-modele')
    verifie('nouvel article ouvert à l’étape Texte, champ vierge', z.count() == 1 and z.input_value() == '' and pg.locator('.etape.active').inner_text().strip().endswith('Texte'))
    verifie('le champ a le focus', pg.evaluate("document.activeElement && document.activeElement.id") == 'texte-modele')
    verifie('la mise en page reprise est annoncée', 'Mise en page reprise de « Le silence au travail »' in pg.locator('main').inner_text())
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(400)
    verifie('sans texte, Mise en page invite à le coller', 'Colle d’abord le texte' in pg.locator('main').inner_text() and pg.get_by_role('dialog').count() == 0)
    z.click(); pg.keyboard.insert_text('Mon nouveau titre\n\nUn premier paragraphe "test"... pour voir.\n\nUn second paragraphe.\n\nEt une fin.'); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300); pg.get_by_role('dialog', name='Ton nouvel article').get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(700)
    verifie('pages créées : retour à l’étape Texte, texte en place', pg.locator('.etape.active').inner_text().strip().endswith('Texte') and 'Mon nouveau titre' in pg.locator('textarea.editeur-zone').input_value())
    verifie('typographie corrigée au collage', '«\u00a0test\u00a0»…' in pg.locator('textarea.editeur-zone').input_value())
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(600)
    verifie('mise en page du modèle appliquée (pas de fenêtre)', pg.locator('.calque').count() >= 1 and pg.get_by_role('dialog').count() == 0)
    # CCB dans Publication
    pg.locator('nav.etapes .etape').nth(2).click(); pg.wait_for_timeout(500)
    robot = pg.locator('.carte .bouton-robot').first
    verifie('robot CCB dans la carte du texte du post', robot.count() == 1)
    robot.click(); pg.wait_for_timeout(200)
    bulle = pg.locator('.bulle-ccb')
    verifie('bulle : deux choix', bulle.get_by_role('menuitem').count() == 2 and 'Générer 3 propositions' in bulle.inner_text() and 'Discuter' in bulle.inner_text())
    bulle.get_by_role('menuitem').first.click(); pg.wait_for_timeout(900)
    c = etat['envois'][-1]
    verifie('trois versions demandées en une fois', 'trois versions' in c['system'] and c['tool_choice'] == {'type': 'auto'})
    verifie('le texte du post connaît le carrousel (pages, couverture)', 'Le carrousel compte' in c['messages'][0]['content'] and 'Sa couverture dit' in c['messages'][0]['content'])
    props = pg.locator('.propositions-post .proposition-description')
    verifie('trois propositions affichées', props.count() == 3, props.count())
    props.nth(1).get_by_role('button').click(); pg.wait_for_timeout(300)
    val = pg.locator('.carte textarea.zone-texte').first.input_value()
    verifie('la proposition 2 devient le texte du post', val.startswith('Version deux'), val)
    # Passage choisi : bouton pour en discuter
    zt = pg.locator('.carte textarea.zone-texte').first
    zt.click(); pg.keyboard.press('Control+Home')
    for _ in range(7): pg.keyboard.press('Shift+ArrowRight')
    pg.wait_for_timeout(200)
    bp = pg.get_by_role('button', name='Discuter de ce passage avec CCB')
    verifie('sélection : bouton « Discuter de ce passage »', bp.count() == 1 and 'Version' in pg.locator('.passage-post').inner_text())
    bp.click(); pg.wait_for_timeout(300)
    fen = pg.locator('.fenetre-discussion')
    verifie('la discussion s’ouvre avec le passage', fen.count() == 1 and 'Version' in fen.inner_text())
    champ = fen.get_by_label('Ta consigne à CCB'); champ.fill('Rends-le plus chaleureux'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(900)
    t = etat['envois'][-1]['messages'][0]['content']
    verifie('la demande porte sur le texte du post', 'texte du post' in t and 'Version deux' in t, t[:200])
    verifie('la discussion du post connaît aussi le carrousel', 'Le carrousel compte' in t)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
