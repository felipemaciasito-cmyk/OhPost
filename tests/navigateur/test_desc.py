from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
NB = '\u00a0'
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'n': 0, 'erreur': False, 'systeme': ''}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    corps = json.loads(r.post_data); etat['systeme'] = corps.get('system', ''); etat['texte'] = corps['messages'][0]['content']
    if etat['erreur']: return route.fulfill(status=429, headers=CORS, body=json.dumps({'error': {'type': 'rate_limit_error', 'message': 'rate limited'}}))
    etat['n'] += 1
    t = '"Et si le silence au travail cachait autre chose ? Clara pensait que son manager voulait se débarrasser d\'elle...\n\nUne conversation a tout changé.\n\nEt toi, as-tu déjà imaginé le pire ?\n\n#coaching #management #communication"' if etat['n'] == 1 else 'Deuxième version : une seule conversation peut tout changer.'
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 900})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    verifie('Discussion sans IA : invitation à ajouter une clé', pg.get_by_role('button', name='CCB · Creative Collaborative Boost').count() == 1 and 'Claude' not in pg.locator('body').inner_text())
    pg.get_by_role('button', name='Publication').first.click(); pg.wait_for_timeout(400); pg.get_by_role('group', name='Réseau de publication').get_by_role('button', name='Instagram').click(); pg.wait_for_timeout(200)
    corps = lambda: pg.locator('main').inner_text()
    verifie('sans IA : invitation à ajouter une clé, pas de bouton', 'ajoute une clé dans Configuration' in corps() and pg.locator('.carte .bouton-robot').count() == 0)
    verifie('nouveau texte d’attente', pg.locator('textarea').first.get_attribute('placeholder') == 'Écris ici le texte qui accompagnera ton carrousel.')
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Publication').first.click(); pg.wait_for_timeout(400); pg.get_by_role('group', name='Réseau de publication').get_by_role('button', name='Instagram').click(); pg.wait_for_timeout(200)
    verifie('avec IA : le robot CCB pour le réseau affiché', pg.locator('.carte .bouton-robot').count() == 1)
    (pg.locator('.carte .bouton-robot').first.click(), pg.get_by_role('menuitem', name='Générer 3 propositions').click()); pg.wait_for_timeout(800)
    verifie('consigne Instagram envoyée avec l’article', 'publié sur Instagram' in etat['systeme'] and 'N’invente rien' in etat['systeme'] and 'Je crois que je vais démissionner' in etat['texte'])
    boite = pg.locator('.proposition-description').first
    t = boite.inner_text()
    verifie('proposition affichée, sans guillemets autour', 'proposition 1 de ccb' in t.lower() and '\nEt si le silence' in t and '"Et si' not in t, t[:120])
    verifie('typographie appliquée', ('autre chose' + NB + '?') in t and 'd’elle…' in t, t[:200])
    zone = pg.locator('textarea').first
    verifie('ton texte n’est pas touché avant ton choix', zone.input_value() == '')
    boite.get_by_role('button', name='Utiliser celle-ci').click(); pg.wait_for_timeout(300)
    verifie('« Utiliser » remplit la légende', zone.input_value().startswith('Et si le silence au travail'))
    verifie('message avec Annuler', pg.locator('.message').count() == 1 and 'Proposition 1 utilisée' in pg.locator('.message').inner_text())
    pg.get_by_role('button', name='Annuler').first.click(); pg.wait_for_timeout(300)
    verifie('Annuler vide la légende', zone.input_value() == '', zone.input_value()[:40])
    zone.fill('Mon texte à moi.'); pg.wait_for_timeout(200)
    (pg.locator('.carte .bouton-robot').first.click(), pg.get_by_role('menuitem', name='Générer 3 propositions').click()); pg.wait_for_timeout(800)
    boite = pg.locator('.proposition-description').first
    verifie('avec un texte existant : « Remplacer mon texte »', boite.get_by_role('button', name='Remplacer mon texte').count() == 1)
    verifie('« Ignorer les propositions » disponible', pg.get_by_role('button', name='Ignorer les propositions').count() == 1)
    pg.get_by_role('button', name='Ignorer les propositions').click(); pg.wait_for_timeout(200)
    verifie('Ignorer : ton texte reste', zone.input_value() == 'Mon texte à moi.' and pg.locator('.proposition-description').count() == 0)
    etat['erreur'] = True
    pg.get_by_role('group', name='Réseau de publication').get_by_role('button', name='LinkedIn').click(); pg.wait_for_timeout(200)
    (pg.locator('.carte .bouton-robot').first.click(), pg.get_by_role('menuitem', name='Générer 3 propositions').click()); pg.wait_for_timeout(800)
    verifie('erreur expliquée sur LinkedIn', 'Trop de demandes' in corps(), corps()[-300:])
    verifie('consigne LinkedIn', 'publié sur LinkedIn' in etat['systeme'])
    pg.screenshot(path='desc.png', full_page=True)
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
