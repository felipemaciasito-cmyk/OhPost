# Simule les règles de Claude Sonnet 5.5 : outil imposé refusé (400), réflexion avant la réponse, blocs « thinking ».
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def erreur400(msg): return {'status': 400, 'headers': CORS, 'body': json.dumps({'type': 'error', 'error': {'type': 'invalid_request_error', 'message': msg}})}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c); s = c.get('system', '')
    tc = (c.get('tool_choice') or {}).get('type')
    if tc in ('tool', 'any'): return route.fulfill(**erreur400('tool_choice: type "tool" and "any" are not supported for this model.'))
    if (c.get('thinking') or {}).get('type') in ('disabled', 'enabled'): return route.fulfill(**erreur400('thinking type not supported for this model.'))
    if any(k in c for k in ('temperature', 'top_p', 'top_k')): return route.fulfill(**erreur400('temperature is not supported for this model.'))
    if c['max_tokens'] < 3000: return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'thinking', 'thinking': '', 'signature': 'x'}], 'stop_reason': 'max_tokens'}))
    pensee = {'type': 'thinking', 'thinking': '', 'signature': 'x'}
    if s.startswith('Tu relis un article'):
        contenu = [pensee, {'type': 'tool_use', 'id': 't1', 'name': c['tools'][0]['name'], 'input': {'propositions': [{'type': 'vocabulaire', 'avant': 'causes racines', 'apres': 'causes profondes', 'alternatives': ['origines'], 'phrase': 'x', 'pourquoi': 'Plus courant.', 'vigilance': ''}]}}]
    elif s.startswith('Tu proposes d’autres formulations'):
        contenu = [pensee, {'type': 'text', 'text': '{"formulations":["les sources","les ressorts"]}'}]  # répond en texte malgré l'outil proposé
    elif s.startswith('Tu écris le texte qui accompagne'):
        contenu = [pensee, {'type': 'text', 'text': 'Description Sonnet 5.5.'}]
    else:
        contenu = [pensee, {'type': 'tool_use', 'id': 't2', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Réponse Sonnet 5.5.', 'propositions': [], 'pistes': []}}]
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': contenu, 'stop_reason': 'tool_use' if contenu[-1]['type'] == 'tool_use' else 'end_turn'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    verifie('pas de bandeau avec le bon ia.js', pg.locator('.alerte-mise-a-jour').count() == 0)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Relire avec CCB').click(); pg.wait_for_timeout(1200)
    c = envois[-1]
    verifie('relecture : requête acceptée par les règles de Sonnet 5.5', c['tool_choice'] == {'type': 'auto'} and c['model'] == 'claude-sonnet-5-5' and c['output_config'] == {'effort': 'medium'} and c['max_tokens'] >= 6000 + 6000, (c.get('tool_choice'), c.get('output_config'), c.get('max_tokens')))
    verifie('relecture : la consigne demande l’outil', 'appelant l’outil' in c['system'])
    corps = pg.locator('main').inner_text()
    verifie('relecture : la proposition s’affiche (bloc de réflexion ignoré)', pg.locator('.carte.proposition').count() == 1 and 'Modèle inconnu' not in corps, corps[-300:])
    pg.locator('.carte.proposition').first.get_by_role('button', name='D’autres formulations').click(); pg.wait_for_timeout(900)
    verifie('formulations : réponse en texte lue quand même', 'les ressorts' in pg.locator('.carte.proposition').first.inner_text())
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').first.click(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(300); fen = pg.locator('.fenetre-discussion'); champ = fen.get_by_label('Ta consigne à CCB'); champ.fill('Ton avis ?'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1000)
    verifie('discussion : réponse affichée', 'Réponse Sonnet 5.5.' in pg.locator('.fenetre-discussion').inner_text(), pg.locator('.fenetre-discussion').inner_text()[-300:])
    pg.locator('.fenetre-discussion').get_by_role('button', name='Fermer la discussion').click()
    pg.get_by_role('button', name='Publication').first.click(); pg.wait_for_timeout(400)
    (pg.locator('.carte .bouton-robot').first.click(), pg.get_by_role('menuitem', name='Générer 3 propositions').click()); pg.wait_for_timeout(900)
    verifie('description : proposition affichée', 'Description Sonnet 5.5.' in pg.locator('main').inner_text())
    verifie('aucune requête avec outil imposé, réflexion coupée ou température', all((e.get('tool_choice') or {}).get('type') in (None, 'auto') and 'thinking' not in e and 'temperature' not in e for e in envois), len(envois))
    # Ancien ia.js (outil imposé) : le bandeau le signale, et l'erreur n'est plus « Modèle inconnu »
    s = open(serveur.RACINE + '/ia.js', encoding='utf-8').read().replace('const api = { MARGE_REFLEXION, ASSISTANT, ', 'const api = { ASSISTANT, ')
    pg.route('**/ia.js*', lambda r: r.fulfill(status=200, body=s, headers={'content-type': 'application/javascript; charset=utf-8'}))
    pg.reload(); pg.wait_for_timeout(900)
    t = pg.locator('.alerte-mise-a-jour').inner_text() if pg.locator('.alerte-mise-a-jour').count() else ''
    verifie('ia.js ancien : le bandeau le nomme', 'ia.js' in t, t)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
