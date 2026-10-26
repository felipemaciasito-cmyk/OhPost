from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
NB = '\u00a0'
v = lambda s: s.replace(NB, '⍽')
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json'}
PROPS = {"propositions": [
  {"type": "vocabulaire", "avant": "causes racines", "apres": "causes profondes", "phrase": "Nous travaillons sur les causes racines de son mal-être, son besoin de reconnaissance et de sécurité, puis sur quelques clés de communication pour oser aborder le sujet avec son manager.", "pourquoi": "« Causes racines » est calqué sur l’anglais.", "vigilance": "Si c’est un terme de ta méthode, garde-le."},
  {"type": "clarte", "avant": "Parce qu'on parle", "apres": "On parle", "phrase": "Parce qu'on parle beaucoup de communication au travail, mais finalement assez peu de tout ce qu'on imagine quand elle disparaît.", "pourquoi": "La phrase se lit mieux seule.", "vigilance": ""},
  {"type": "ponctuation", "avant": "Et là, surprise.", "apres": "Et là, surprise!", "phrase": "Et là, surprise.", "pourquoi": "Souligne l’effet.", "vigilance": ""},
  {"type": "orthographe", "avant": "texte inventé", "apres": "x", "phrase": "Phrase qui n’existe pas.", "pourquoi": "", "vigilance": ""}]}
mode = {'reponse': 'ok'}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    corps = json.loads(r.post_data)
    if corps['max_tokens'] == 16: return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': 'OK'}]}))
    mode['systeme'] = corps.get('system', ''); mode['texte'] = corps['messages'][0]['content']
    if mode['reponse'] == 'credits': return route.fulfill(status=400, headers=CORS, body=json.dumps({'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API.'}}))
    texte = '```json\n' + json.dumps(PROPS, ensure_ascii=False) + '\n```'
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': texte}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    # Sans IA : LanguageTool comme avant
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(500)
    panneau = lambda: pg.locator('.defilement-separe > .panneau').inner_text()
    verifie('sans IA : carte LanguageTool et invitation à ajouter une clé', 'Orthographe et grammaire' in panneau() and 'ajoute une clé dans Configuration' in panneau())
    # Activer Claude
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(500)
    verifie('avec Claude : carte Relecture à la place', 'Relecture' in panneau() and 'Relire avec CCB' in panneau() and 'Orthographe et grammaire' not in panneau())
    zone = pg.locator('textarea.editeur-zone')
    pg.get_by_role('button', name='Relire avec CCB').click(); pg.wait_for_timeout(1200)
    verifie('consigne envoyée : règles et texte', 'Ignore la typographie' in mode.get('systeme', '') and 'causes racines' in mode.get('texte', ''))
    cartes = pg.locator('.carte.proposition')
    verifie('3 cartes retenues, dans l’ordre du texte', cartes.count() == 3, cartes.count())
    verifie('1 proposition écartée signalée', '1 proposition écartée' in panneau(), panneau()[:400])
    verifie('ordre du texte', [cartes.nth(i).locator('.badge-type').inner_text() for i in range(3)] == ['Vocabulaire', 'Ponctuation', 'Clarté'])
    verifie('première carte active', 'active' in (cartes.nth(0).get_attribute('class') or ''))
    verifie('aperçu typographique dans la carte', ('surprise' + NB + '!') in cartes.nth(1).inner_text(), v(cartes.nth(1).inner_text()))
    verifie('point de vigilance affiché', 'Point de vigilance.' in cartes.nth(0).inner_text())
    verifie('passages surlignés dans le texte', pg.locator('.editeur-fond mark').count() == 3)
    # Accepter la 1re
    cartes.nth(0).get_by_role('button', name='Accepter').click(); pg.wait_for_timeout(400)
    val = zone.input_value()
    verifie('acceptée : texte modifié', 'sur les causes profondes de son mal-être' in val)
    verifie('acceptée : carte repliée', 'traitee' in (pg.locator('#proposition-r1').get_attribute('class') or '') and 'Acceptée' in pg.locator('#proposition-r1').inner_text())
    verifie('la suivante devient active', 'active' in (pg.locator('#proposition-r2').get_attribute('class') or ''), [pg.locator('.carte.proposition').nth(i).get_attribute('id') + ':' + pg.locator('.carte.proposition').nth(i).get_attribute('class') for i in range(3)])
    # Accepter la ponctuation : typographie appliquée
    pg.locator('#proposition-r2').get_by_role('button', name='Accepter').click(); pg.wait_for_timeout(400)
    val = zone.input_value()
    verifie('typographie appliquée à l’acceptation', ('Et là, surprise' + NB + '!') in val, v(val[val.find('Et là'):val.find('Et là') + 25]))
    # Modifier la clarté
    pg.locator('#proposition-r3').get_by_role('button', name='Modifier').click(); pg.wait_for_timeout(200)
    champ = pg.locator('#proposition-r3 textarea'); champ.fill("On parle tant"); pg.locator('#proposition-r3').get_by_role('button', name='Valider ma version').click(); pg.wait_for_timeout(400)
    val = zone.input_value()
    verifie('modifiée : ta version appliquée', 'particulièrement. On parle tant beaucoup de communication' in val, v(val[val.find('particulièrement'):val.find('particulièrement') + 60]))
    verifie('modifiée : carte repliée avec ta version', 'Modifiée' in pg.locator('#proposition-r3').inner_text() and 'On parle tant' in pg.locator('#proposition-r3').inner_text())
    verifie('plus rien en attente', 'dont 0 en attente' in panneau())
    # Annuler l'acceptation de r1
    pg.locator('#proposition-r1').get_by_role('button', name='Annuler ce choix').click(); pg.wait_for_timeout(400)
    val = zone.input_value()
    verifie('annuler : texte d’origine rétabli', 'sur les causes racines de son mal-être' in val and 'On parle tant' in val)
    verifie('annuler : carte de nouveau en attente et active', 'traitee' not in (pg.locator('#proposition-r1').get_attribute('class') or '') and 'active' in (pg.locator('#proposition-r1').get_attribute('class') or ''))
    # Refuser r1
    pg.locator('#proposition-r1').get_by_role('button', name='Refuser').click(); pg.wait_for_timeout(300)
    verifie('refusée : texte inchangé, carte repliée', 'causes racines' in zone.input_value() and 'Refusée' in pg.locator('#proposition-r1').inner_text())
    pg.locator('#proposition-r1').get_by_role('button', name='Annuler ce choix').click(); pg.wait_for_timeout(300)
    verifie('annuler un refus : de nouveau en attente', 'Accepter' in pg.locator('#proposition-r1').inner_text())
    # Toucher le passage dans le texte active sa carte
    pg.evaluate("document.querySelector('#proposition-r1').classList.contains('active')")
    pos = zone.input_value().find('causes racines') + 3
    zone.click(); zone.evaluate(f'(el) => {{ el.setSelectionRange({pos}, {pos}); el.dispatchEvent(new Event("select", {{bubbles: true}})); }}'); pg.wait_for_timeout(300)
    verifie('passage touché : sa carte active', 'active' in (pg.locator('#proposition-r1').get_attribute('class') or ''))
    # Taper dans le passage : la proposition disparaît
    pg.keyboard.type('X', delay=20); pg.wait_for_timeout(300)
    verifie('passage modifié à la main : proposition retirée', pg.locator('#proposition-r1').count() == 0)
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(200)
    # Garder l'état en changeant d'étape
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(500)
    verifie('cartes gardées après un changement d’étape', pg.locator('.carte.proposition').count() == 2)
    # Erreur de crédits : message clair et secours LanguageTool
    mode['reponse'] = 'credits'
    pg.get_by_role('button', name='Relire à nouveau').click(); pg.wait_for_timeout(800)
    verifie('crédits épuisés expliqués', 'Crédits insuffisants chez Anthropic' in panneau(), panneau()[:300])
    pg.get_by_role('button', name='Vérifier avec LanguageTool à la place').click(); pg.wait_for_timeout(300)
    verifie('secours : carte LanguageTool affichée', 'Orthographe et grammaire' in panneau() and 'Revenir à la relecture par CCB' in panneau())
    pg.get_by_role('button', name='Revenir à la relecture par CCB').click(); pg.wait_for_timeout(300)
    verifie('retour à la relecture', 'Relecture' in panneau())
    # Les slides suivent : Vérifier dans Composition
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(600)
    pg.locator('button', has_text='Vérifier').first.click(); pg.wait_for_timeout(300)
    t = pg.locator('body').inner_text()
    verifie('aucun texte perdu ni ajouté dans les pages', 'absent' not in t.lower() and 'ajouté' not in t.lower())
    pg.screenshot(path='relecture.png')
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
