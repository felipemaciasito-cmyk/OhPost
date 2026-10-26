from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json'}
etat = {'claude': 'ok', 'mistral': 'bloque', 'requetes': []}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    etat['requetes'].append({'entetes': r.headers, 'corps': r.post_data})
    cle = r.headers.get('x-api-key')
    if not cle: return route.fulfill(status=401, headers=CORS, body=json.dumps({'type': 'error', 'error': {'type': 'authentication_error', 'message': 'x-api-key header is required'}}))
    if cle == 'sk-ant-mauvaise': return route.fulfill(status=401, headers=CORS, body=json.dumps({'type': 'error', 'error': {'type': 'authentication_error', 'message': 'invalid x-api-key'}}))
    if cle == 'sk-ant-pauvre': return route.fulfill(status=400, headers=CORS, body=json.dumps({'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API.'}}))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': 'OK'}]}))
def mistral(route):
    if etat['mistral'] == 'bloque': return route.abort()
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    return route.fulfill(status=401, headers=CORS, body=json.dumps({'message': 'Unauthorized'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 900})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude); pg.route('https://api.mistral.ai/**', mistral)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1000)
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('group', name='Onglets').get_by_role('button', name='IA').click()
    pg.wait_for_timeout(300)
    corps = lambda: pg.locator('main').inner_text()
    verifie('onglet IA affiché', 'Fournisseur d’IA' in corps(), corps()[:200])
    verifie('aucune IA active au départ', 'Aucune IA active' in corps())
    statut = lambda: pg.locator('main p[role=status]').inner_text() if pg.locator('main p[role=status]').count() else ''
    bouton = pg.get_by_role('button', name='Tester et enregistrer')
    # 1. Sans clé : Claude joignable
    bouton.click(); pg.wait_for_timeout(500)
    verifie('sans clé : Claude joignable', 'Anthropic accepte les appels depuis ce navigateur' in statut(), statut())
    # 2. Mauvaise clé
    champ = pg.get_by_label('Clé d’API Anthropic')
    champ.fill('sk-ant-mauvaise'); bouton.click(); pg.wait_for_timeout(500)
    verifie('clé refusée expliquée', statut().startswith('Clé refusée par Anthropic'), statut())
    verifie('rien enregistré après échec', pg.evaluate("localStorage.getItem('postsop-ia')") is None)
    # 3. Crédits insuffisants
    champ.fill('sk-ant-pauvre'); bouton.click(); pg.wait_for_timeout(500)
    verifie('crédits insuffisants expliqués', statut().startswith('Crédits insuffisants chez Anthropic'), statut())
    # 4. Clé qui ne ressemble pas à une clé Claude
    champ.fill('abc'); pg.wait_for_timeout(100)
    verifie('avertissement préfixe', 'ne commence pas par « sk-ant- »' in corps())
    # 5. Bonne clé
    champ.fill('sk-ant-bonne'); bouton.click(); pg.wait_for_timeout(500)
    verifie('connexion réussie', 'Connexion réussie : Anthropic a répondu. Réglage enregistré sur cet appareil.' in statut(), statut())
    verifie('Anthropic actif', 'Anthropic actif' in corps())
    verifie('champ vidé', champ.input_value() == '')
    enreg = json.loads(pg.evaluate("localStorage.getItem('postsop-ia')"))
    verifie('clé enregistrée sur l’appareil', enreg['cles']['claude'] == 'sk-ant-bonne' and enreg['fournisseur'] == 'claude', enreg)
    dern = etat['requetes'][-1]
    verifie('en-tête d’accès navigateur envoyé', dern['entetes'].get('anthropic-dangerous-direct-browser-access') == 'true')
    verifie('demande minuscule', json.loads(dern['corps'])['max_tokens'] == 16 + 6000)
    # 6. Clé absente du dépôt synchronisé : rien dans les données de l'app
    donnees = pg.evaluate("Object.keys(localStorage).filter(k => k !== 'postsop-ia').map(k => localStorage.getItem(k)).join(' ')")
    verifie('clé absente des autres données locales', 'sk-ant-bonne' not in donnees)
    # 7. Mistral bloqué par le navigateur
    pg.get_by_role('group', name='Fournisseur').get_by_role('button', name='Mistral').click(); pg.wait_for_timeout(200)
    verifie('guide Mistral affiché', 'console.mistral.ai' in corps())
    if pg.get_by_text('Options avancées').count(): pg.get_by_text('Options avancées').click(); pg.wait_for_timeout(150)
    verifie('modèle Mistral proposé, dans les options avancées', pg.get_by_label('Modèle Mistral').input_value() == 'mistral-large-latest')
    bouton.click(); pg.wait_for_timeout(500)
    verifie('Mistral refusé expliqué', 'Mistral ne répond pas depuis ce navigateur' in statut(), statut())
    verifie('Claude reste actif', 'Anthropic actif' in corps())
    # 8. Mistral joignable
    etat['mistral'] = 'ok'; bouton.click(); pg.wait_for_timeout(500)
    verifie('Mistral joignable', 'Mistral accepte les appels depuis ce navigateur' in statut(), statut())
    # 9. Retour sur Claude, clé gardée, puis oubli
    pg.get_by_role('group', name='Fournisseur').get_by_role('button', name='Anthropic').click(); pg.wait_for_timeout(200)
    verifie('clé déjà enregistrée signalée', 'Une clé est déjà enregistrée sur cet appareil' in corps())
    pg.reload(); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('group', name='Onglets').get_by_role('button', name='IA').click(); pg.wait_for_timeout(300)
    verifie('après rechargement : Claude actif', 'Anthropic actif' in corps())
    pg.screenshot(path='onglet-ia.png', full_page=True)
    pg.get_by_role('button', name='Oublier la clé sur cet appareil').click(); pg.wait_for_timeout(200)
    verifie('oubli : aucune IA active', 'Aucune IA active' in corps() and 'Clé oubliée sur cet appareil.' in statut())
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
