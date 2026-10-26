from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
PROFIL = 'Anne, coach et médiatrice. Public : managers et dirigeants. Ton chaleureux et direct, vouvoiement.'
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    corps = json.loads(r.post_data); s = corps.get('system', ''); t = corps['messages'][0]['content']
    envois.append((s, t))
    if s.startswith('Tu proposes d’autres formulations'): rep = json.dumps({'formulations': ['les sources', 'les ressorts', 'les origines']}, ensure_ascii=False)
    elif s.startswith('Tu écris le texte qui accompagne'): rep = json.dumps({'propositions': ['Une description de test.']}) if corps.get('tools') else 'Une description de test.'
    else: rep = json.dumps({'propositions': [{'type': 'vocabulaire', 'avant': 'causes racines', 'apres': 'causes profondes', 'alternatives': ['origines'], 'phrase': 'x', 'pourquoi': 'Plus courant.', 'vigilance': ''}]}, ensure_ascii=False)
    if corps.get('tools'):
        return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'name': corps['tools'][0]['name'], 'input': json.loads(rep)}], 'stop_reason': 'tool_use'}))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': rep}]}))
def dernier(debut):
    for s, t in reversed(envois):
        if s.startswith(debut): return s, t
    return '', ''
def parcours(pg, avecProfil):
    envois.clear()
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    b = pg.get_by_role('button', name='Relire avec CCB')
    if not b.count(): b = pg.locator('.carte').filter(has_text='Relecture').get_by_role('button').filter(has_text='Relire')
    print('   bouton :', b.first.inner_text()); b.first.click(); pg.wait_for_timeout(1000)
    s, t = dernier('Tu relis un article')
    verifie(f'relecture {avecProfil} : règle du profil dans la consigne', 'Profil éditorial : s’il est fourni' in s)
    pg.locator('.carte').filter(has_text='Relecture').locator('.info-bouton').first.hover(); pg.wait_for_timeout(200)
    bulle = ' '.join(pg.locator('[role=tooltip]').all_inner_texts())
    verifie(f'relecture {avecProfil} : aide ' + ('mentionne' if avecProfil == 'avec' else 'ne mentionne pas') + ' le profil', ('profil éditorial' in bulle) == (avecProfil == 'avec'), bulle)
    pg.mouse.move(5, 5)
    verifie(f'relecture {avecProfil} : profil envoyé' if avecProfil == 'avec' else 'relecture sans : aucun bloc profil', (('<profil>\n' + PROFIL + '\n</profil>') in t) == (avecProfil == 'avec') and '<article>' in t, t[:200])
    carte = pg.locator('.carte.proposition').first
    if carte.count():
        carte.get_by_role('button', name='D’autres formulations').click(); pg.wait_for_timeout(800)
        s, t = dernier('Tu proposes d’autres formulations')
        verifie(f'formulations {avecProfil} : profil ' + ('envoyé' if avecProfil == 'avec' else 'absent'), ('<profil>' in t) == (avecProfil == 'avec') and 'Profil éditorial : s’il est fourni' in s, t[:150])
    else: verifie('carte de relecture affichée', False)
    pg.get_by_role('button', name='Publication').first.click(); pg.wait_for_timeout(400)
    (pg.locator('.carte .bouton-robot').first.click(), pg.get_by_role('menuitem', name='Générer 3 propositions').click()); pg.wait_for_timeout(900)
    s, t = dernier('Tu écris le texte qui accompagne')
    verifie(f'description {avecProfil} : profil ' + ('envoyé' if avecProfil == 'avec' else 'absent'), ('<profil>' in t) == (avecProfil == 'avec') and 'hashtags qui parlent' in s, t[:150])
    verifie(f'description {avecProfil} : texte reçu affiché', 'Une description de test.' in pg.locator('main').inner_text() or any('Une description de test.' in v for v in pg.locator('main textarea').evaluate_all('l => l.map(e => e.value)')))
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    parcours(pg, 'sans')
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='IA', exact=True).click(); pg.wait_for_timeout(300)
    champ = pg.get_by_label('Ton profil éditorial')
    if not champ.count():
        pg.get_by_role('button', name='Partir d’une proposition, à vérifier et compléter').click(); pg.wait_for_timeout(200)
    pg.get_by_label('Ton profil éditorial').fill(PROFIL); pg.wait_for_timeout(300)
    pg.locator('.carte').filter(has_text='Ton profil éditorial').locator('.info-bouton').first.hover(); pg.wait_for_timeout(200)
    bulle = pg.locator('[role=tooltip]').all_inner_texts()
    verifie('explication de la carte à jour', any('relecture, autres formulations, discussion et descriptions' in b for b in bulle), bulle)
    pg.keyboard.press('Escape')
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    parcours(pg, 'avec')
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
