# Nouvel article en trois étapes : propositions de CCB vérifiées par le moteur, aperçu dans le fil, création.
from playwright.sync_api import sync_playwright
import serveur, json, re; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
src = open(serveur.DONNEES + '/rendre.py', encoding='utf-8').read()
P0 = eval(src[src.index('P0 = [') + 5: src.index(']', src.index('P0 = [')) + 1])
TEXTE = '\n\n'.join(P0)
plans = json.load(open(serveur.DONNEES + '/plans6.json', encoding='utf-8'))
def plan_ia(pl):
    return {'nom': pl['nom'], 'pourquoi': pl['pourquoi'], 'fond': pl['fond'], 'slides': [{'gabarit': p['g'], 'paragraphes': p['p'], 'styles': p['s']} for p in pl['pages']]}
BONS = [plan_ia(p) for p in plans]
CHARGE = {'nom': 'Trop long', 'pourquoi': 'x', 'fond': 'bleu', 'slides': [{'gabarit': 'V1', 'paragraphes': [0], 'styles': ['titre']}] + [{'gabarit': 'T1', 'paragraphes': [k, k + 1], 'styles': ['corps', 'corps']} for k in range(1, 17, 2)]}
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'reponses': [], 'envois': []}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); etat['envois'].append(c)
    rep = etat['reponses'].pop(0) if etat['reponses'] else {'propositions': BONS}
    if rep == 'panne': return route.fulfill(status=529, headers=CORS, body=json.dumps({'type': 'error', 'error': {'type': 'overloaded_error', 'message': 'Overloaded'}}))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'thinking', 'thinking': '', 'signature': 's'}, {'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici.', **rep}}], 'stop_reason': 'tool_use'}))
def ouvrir(pg, cle=True):
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("(k) => { if (k) localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}})); else localStorage.removeItem('postsop-ia'); }", cle)
    pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(300)
    fe = pg.locator('[role=dialog]').first
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300); _q = pg.get_by_role('dialog', name='Ton nouvel article'); _q.get_by_role('button', name='Portrait · 4:5').click(); _q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(700)
    # Premier passage à l'étape Mise en page : la fenêtre s'ouvre et CCB compose.
    pg.get_by_role('button', name='Continuer : Mise en page').click(); pg.wait_for_timeout(1300)
    return pg.locator('[role=dialog]').first
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    # 1. Trois bonnes propositions et une trop chargée
    etat['reponses'] = [{'propositions': BONS + [CHARGE]}]
    fe = ouvrir(pg)
    verifie('fenêtre de mise en page ouverte, un seul écran', fe.locator('.etapes-assistant').count() == 0 and fe.get_by_role('button', name='Appliquer').count() == 1)
    verifie('CCB appelé une fois', len(etat['envois']) == 1, len(etat['envois']))
    c = etat['envois'][0]
    verifie('consigne : fonction de LinkedIn et pages aérées', 'Le carrousel sera publié sur LinkedIn' in c['messages'][0]['content'] and 'Esthétique avant tout' in c['system'] and 'Nombre de slides : 6 au plus' in c['messages'][0]['content'] and c['tool_choice'] == {'type': 'auto'})
    seg = fe.get_by_role('group', name='Mises en page proposées')
    noms = seg.get_by_role('button').all_inner_texts()
    verifie('trois propositions et « Sans IA », la trop chargée écartée', noms == [p['nom'] for p in plans] + ['Sans IA'], noms)
    verifie('écart annoncé', '1 proposition écartée' in fe.inner_text())
    verifie('la première est choisie, avec son nombre de pages', seg.get_by_role('button').first.get_attribute('aria-pressed') == 'true' and '6 pages' in fe.locator('.mep-infos').inner_text())
    pg.screenshot(path='creation-propositions.png')
    verifie('grand aperçu et bande de vignettes', fe.locator('.mep-grande canvas').count() == 1 and fe.locator('.mep-vignette').count() == 6)
    fe.get_by_role('button', name='Page suivante').click(); pg.wait_for_timeout(200)
    verifie('page suivante', 'Page 2 sur 6' in fe.inner_text())
    seg.get_by_role('button', name=plans[1]['nom']).click(); pg.wait_for_timeout(300)
    verifie('autre proposition : 6 pages, retour à la page 1', fe.locator('.mep-vignette').count() == 6 and 'Page 1 sur 6' in fe.inner_text() and 'fond bleu' in fe.locator('.mep-infos').inner_text())
    # Aperçu dans le fil
    fe.locator('.page-cliquable').click(); pg.wait_for_timeout(300)
    gf = pg.locator('.grande-fenetre')
    verifie('toucher la page l’ouvre en grand, avec les deux logos', gf.count() == 1 and gf.get_by_role('button', name='Aperçu du post LinkedIn').count() == 1 and gf.get_by_role('button', name='Aperçu du post Instagram').count() == 1)
    gf.get_by_role('button', name='Aperçu du post LinkedIn').click(); pg.wait_for_timeout(300)
    filv = pg.get_by_role('dialog', name='Aperçu du post')
    pg.screenshot(path='creation-fil.png')
    verifie('aperçu dans le fil ouvert sur la couverture', filv.count() == 1 and '1 / 6' in filv.inner_text() and filv.locator('canvas').count() == 1)
    filv.get_by_role('button', name='Page suivante').click(); pg.wait_for_timeout(150)
    verifie('on fait défiler comme dans le fil', '2 / 6' in filv.inner_text())
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(150)
    verifie('flèche du clavier', '3 / 6' in filv.inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    verifie('Échap ferme l’aperçu, la fenêtre reste', filv.count() == 0 and fe.get_by_role('button', name='Appliquer').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    verifie('second Échap : la grande fenêtre se ferme', pg.locator('.grande-fenetre').count() == 0)
    # Générer 3 autres propositions (robot CCB de la fenêtre)
    verifie('plus de bouton « Proposer 3 autres » sous l’aperçu (le robot CCB le propose)', fe.get_by_role('button', name='Proposer 3').count() == 0)
    etat['reponses'] = [{'propositions': BONS[::-1]}]
    fe.locator('.bouton-robot').click(); pg.wait_for_timeout(200); fe.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(1200)
    verifie('« Générer 3 propositions » : CCB évite les précédentes', len(etat['envois']) == 2 and 'différentes de celles déjà vues' in etat['envois'][1]['messages'][0]['content'])
    noms2 = fe.get_by_role('group', name='Mises en page proposées').get_by_role('button').all_inner_texts()
    verifie('nouvelles propositions affichées', noms2[0] == plans[2]['nom'], noms2)
    fe.get_by_role('group', name='Mises en page proposées').get_by_role('button', name=plans[1]['nom']).click(); pg.wait_for_timeout(200)
    # Étape 3 et création
    verifie('étape 3 : le fond de la proposition est choisi', fe.locator('.fond-choix.actif').inner_text().strip() == 'Bleu', fe.locator('.fond-choix.actif').inner_text())
    fe.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(900)
    verifie('appliqué : on reste à l’étape Mise en page', 'Mise en page' in pg.locator('.etape.active').inner_text(), pg.locator('.etape.active').inner_text())
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(900)
    verifie('article créé avec les 6 pages de la proposition', pg.locator('.calque').count() == 6, pg.locator('.calque').count())
    # 2. Une seule proposition aérée : CCB est relancé une fois
    etat['envois'].clear(); etat['reponses'] = [{'propositions': [BONS[0], CHARGE]}, {'propositions': [BONS[1], CHARGE]}]
    fe = ouvrir(pg)
    n3 = fe.get_by_role('group', name='Mises en page proposées').get_by_role('button').all_inner_texts()
    verifie('relance automatique : deux appels, deux propositions gardées', len(etat['envois']) == 2 and n3 == [plans[0]['nom'], plans[1]['nom'], 'Sans IA'], (len(etat['envois']), n3))
    # 3. Panne : message, Réessayer, découpage simple toujours possible
    fe.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(200)
    etat['envois'].clear(); etat['reponses'] = ['panne']
    fe = ouvrir(pg)
    verifie('panne : message et Réessayer', fe.locator('.erreur-boite').count() == 1 and fe.get_by_role('button', name='Réessayer').count() == 1, fe.inner_text()[-300:])
    verifie('panne : découpage simple affiché', fe.get_by_role('button', name='Sans IA').get_attribute('aria-pressed') == 'true' and fe.locator('.mep-grande canvas').count() == 1)
    etat['reponses'] = [{'propositions': BONS}]
    fe.get_by_role('button', name='Réessayer').click(); pg.wait_for_timeout(1200)
    verifie('Réessayer : propositions reçues', fe.locator('.erreur-boite').count() == 0 and fe.get_by_role('group', name='Mises en page proposées').get_by_role('button').count() == 4)
    # 4. Sans clé : pas d'appel, découpage simple
    fe.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(200)
    etat['envois'].clear()
    fe = ouvrir(pg, cle=False)
    verifie('sans clé : aucun appel, invitation à ajouter une clé, découpage simple', len(etat['envois']) == 0 and 'ajoute ta clé' in fe.inner_text() and fe.locator('.mep-grande canvas').count() == 1)
    pg.screenshot(path='creation-sans-cle.png')
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
