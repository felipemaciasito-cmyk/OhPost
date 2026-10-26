# Nouvel article sans fenêtre : écran vierge, questionnaire (format, titre, CCB), article vide supprimé, réseau à la publication.
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
    c = json.loads(r.post_data); etat['envois'].append(c); s = c.get('system', '')
    if c.get('tools') and 'titre court' in s:
        return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'propositions': [{'titre': 'Le cerveau qui disjoncte', 'pourquoi': 'Reprend l’image forte du début.'}, {'titre': 'Hélène et sa colère', 'pourquoi': 'Nomme la personne et le sujet.'}, {'titre': 'Accueillir sa colère', 'pourquoi': 'Résume la leçon.'}]}}], 'stop_reason': 'tool_use'}))
    if 'titre court' in s:
        return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': 'Essaie « Hélène et ses émotions », plus doux.'}]}))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': '{}'}]}))
TEXTE = '« J’ai le cerveau qui disjoncte ! »\n\nHélène est dirigeante. Charisme, leadership, vision.\n\nMais quand elle est en colère, elle boude !\n\nEt elle ajoute : pourquoi on n’apprend pas ça à l’école ?'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    n0 = pg.locator('.carte-article, .article-carte, [class*=carte-article]').count()
    # Nouvel article : plus de fenêtre
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(500)
    verifie('« Nouvel article » ouvre l’étape Texte sur un champ vide, sans fenêtre', pg.get_by_role('dialog').count() == 0 and pg.locator('#texte-modele').input_value() == '' and pg.locator('.etape.active').inner_text().strip().endswith('Texte'))
    # Quitter sans rien coller : l'article vide disparaît
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(400)
    verifie('article laissé vide : supprimé en le quittant', pg.get_by_text('Nouvel article', exact=True).count() == 0 or 'Nouvel article' not in pg.locator('main').inner_text().replace('Nouvel article\n', ''), pg.locator('main').inner_text()[:200])
    # Questionnaire
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(400)
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300)
    q = pg.get_by_role('dialog', name='Ton nouvel article')
    verifie('« Continuer » ouvre le questionnaire : format et titre', q.count() == 1 and 'Quel format ?' in q.inner_text() and 'Quel titre dans ta bibliothèque ?' in q.inner_text())
    verifie('pas de question sur le réseau', 'LinkedIn' not in q.locator('.question').first.locator('h3').inner_text() and q.get_by_role('button', name='Instagram').count() == 0)
    q.get_by_role('button', name='Carré · 1:1').click()
    q.get_by_role('button', name='Écrire un titre').click(); pg.wait_for_timeout(150)
    q.locator('.bouton-robot').click(); pg.wait_for_timeout(150)
    verifie('robot : « Générer 3 propositions » et « Discuter »', q.locator('.bulle-ccb').get_by_role('menuitem').count() == 2)
    q.locator('.bulle-ccb').get_by_role('menuitem').first.click(); pg.wait_for_timeout(700)
    tp = q.locator('.titre-propose')
    verifie('trois titres avec une explication chacun', tp.count() == 3 and 'Reprend l’image forte' in tp.first.inner_text())
    tp.nth(1).get_by_role('button', name='Choisir').click(); pg.wait_for_timeout(150)
    verifie('le titre choisi remplit le champ', q.get_by_label('Titre de l’article').input_value() == 'Hélène et sa colère')
    q.locator('.bouton-robot').click(); pg.wait_for_timeout(150)
    q.locator('.bulle-ccb').get_by_role('menuitem').nth(1).click(); pg.wait_for_timeout(150)
    champ = q.get_by_label('Ta demande à CCB'); champ.fill('Plus doux'); q.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(700)
    verifie('discussion : réponse et bouton « Utiliser »', 'plus doux' in q.inner_text() and q.get_by_role('button', name='Utiliser « Hélène et ses émotions »').count() == 1)
    q.get_by_role('button', name='Utiliser « Hélène et ses émotions »').click(); pg.wait_for_timeout(150)
    q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(600)
    verifie('article prêt à l’étape Texte, titre choisi', pg.get_by_role('dialog').count() == 0 and 'Hélène et ses émotions' in pg.locator('header, .barre').first.inner_text() and pg.locator('textarea.editeur-zone').count() == 1)
    # Premier passage à Mise en page : la fenêtre Apparence générale s'ouvre ; carré 1:1
    pg.get_by_role('button', name='Continuer : Mise en page').click(); pg.wait_for_timeout(800)
    verifie('premier passage : la fenêtre de mise en page s’ouvre', pg.get_by_role('dialog').count() == 1)
    c = [e for e in etat['envois'] if 'Format' in e['messages'][0]['content']]
    verifie('CCB compose pour LinkedIn et Instagram, en 1:1', bool(c) and 'Réseau : LinkedIn et Instagram' in c[-1]['messages'][0]['content'] and '1:1' in c[-1]['messages'][0]['content'], c[-1]['messages'][0]['content'][-300:] if c else 'aucun appel')
    pg.get_by_role('dialog').locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(200)
    # Publication : où publier
    pg.get_by_role('button', name='Continuer : Publication').click(); pg.wait_for_timeout(500)
    g = pg.get_by_role('group', name='Réseau de publication')
    verifie('Publication : « Où publies-tu ce carrousel ? », les deux par défaut', g.get_by_role('button', name='Les deux').get_attribute('aria-pressed') == 'true' and pg.get_by_role('group', name='Réseau du texte').count() == 1)
    g.get_by_role('button', name='Instagram').click(); pg.wait_for_timeout(300)
    verifie('Instagram : légende seule, images PNG proposées', 'Légende Instagram' in pg.locator('main').inner_text() and pg.get_by_role('group', name='Réseau du texte').count() == 0)
    # Questionnaire d'après un modèle : seulement le titre
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Actions pour Le silence au travail').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Utiliser comme modèle').click(); pg.wait_for_timeout(400); pg.locator('#texte-modele').wait_for(timeout=5000)
    if pg.locator('.message').count(): pg.locator('.message').get_by_role('button', name='Fermer').click(); pg.wait_for_timeout(150)
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE); pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300)
    q = pg.get_by_role('dialog', name='Ton nouvel article')
    verifie('d’après un modèle : seulement la question du titre', 'Quel format ?' not in q.inner_text() and 'Quel titre' in q.inner_text())
    q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(500)
    verifie('titre par défaut : les premières lignes', 'cerveau qui disjoncte' in pg.locator('header, .barre').first.inner_text().replace('\u00a0', ' '))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
