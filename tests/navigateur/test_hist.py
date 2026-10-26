from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
PASSAGE = 'Pas de conflit ouvert, pas de reproches. Juste des mails de plus en plus froids, des réunions auxquelles elle n’est plus conviée et des décisions qu’elle découvre après tout le monde.'
AUTRE = 'Le silence laisse rarement un vide.'
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    texte = json.loads(r.post_data)['messages'][0]['content']
    t = json.dumps({'reponse': 'Réponse sur « ' + texte.split('Nouvelle demande de la personne :\n')[1][:30] + ' ».', 'propositions': [], 'pistes': []}, ensure_ascii=False)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
def choisir(pg, zone, morceau):
    v = zone.input_value(); d = v.index(morceau); zone.click(); zone.evaluate(f'(el) => el.setSelectionRange({d}, {d + len(morceau)})'); pg.keyboard.press('Shift'); pg.wait_for_timeout(150)
def demander(fen, t):
    c = fen.get_by_label('Ta consigne à CCB'); c.fill(t); c.press('Enter')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    zone = pg.locator('textarea.editeur-zone')
    choisir(pg, zone, PASSAGE)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    fen = pg.locator('.fenetre-discussion')
    verifie('passage surligné dans le texte pendant la discussion', pg.locator('.editeur-fond mark.passage-discussion').count() == 1 and pg.locator('.editeur-fond mark.passage-discussion').inner_text().startswith('Pas de conflit'))
    verifie('extrait court + « Voir en entier »', '…' in fen.locator('.discussion-passage').first.inner_text() and fen.get_by_role('button', name='Voir en entier').count() == 1)
    fen.get_by_role('button', name='Voir en entier').click(); pg.wait_for_timeout(150)
    verifie('passage affiché en entier', 'après tout le monde.' in fen.locator('.discussion-passage').first.inner_text() and fen.get_by_role('button', name='Réduire').count() == 1)
    demander(fen, 'Première question'); pg.wait_for_timeout(700)
    fen.get_by_role('button', name='Nouvelle conversation').click(); pg.wait_for_timeout(200)
    verifie('nouvelle conversation vide, historique (1)', fen.locator('.bulle.moi').count() == 0 and fen.get_by_role('button', name='Historique (1)').count() == 1)
    choisir(pg, zone, AUTRE)
    demander(fen, 'Deuxième sujet'); pg.wait_for_timeout(700)
    verifie('le surlignage suit le nouveau passage', pg.locator('.editeur-fond mark.passage-discussion').inner_text() == AUTRE)
    fen.get_by_role('button', name='Historique (2)').click(); pg.wait_for_timeout(200)
    items = fen.locator('.conversation-item')
    verifie('historique : 2 conversations, la plus récente en tête', items.count() == 2 and 'Deuxième sujet' in items.nth(0).inner_text() and 'en cours' in items.nth(0).inner_text() and 'Première question' in items.nth(1).inner_text())
    items.nth(1).locator('.conversation-ouvrir').click(); pg.wait_for_timeout(200)
    verifie('ancienne conversation rouverte', 'Première question' in fen.inner_text() and 'Deuxième sujet' not in fen.inner_text())
    verifie('rappel de son passage, différent du passage choisi', 'Cette conversation portait sur' in fen.inner_text())
    fen.get_by_role('button', name='Le choisir').click(); pg.wait_for_timeout(200)
    verifie('« Le choisir » sélectionne de nouveau ce passage', pg.locator('.editeur-fond mark.passage-discussion').inner_text().startswith('Pas de conflit') and 'Cette conversation portait sur' not in fen.inner_text())
    demander(fen, 'Suite de la première'); pg.wait_for_timeout(700)
    verifie('on continue l’ancienne conversation', fen.locator('.bulle.moi').count() == 2)
    # Rechargement : tout est gardé sur l'appareil
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    fen = pg.locator('.fenetre-discussion')
    verifie('après rechargement : dernière conversation et historique', 'Suite de la première' in fen.inner_text() and fen.get_by_role('button', name='Historique (2)').count() == 1)
    fen.get_by_role('button', name='Historique (2)').click(); pg.wait_for_timeout(200)
    fen.locator('.conversation-item').nth(1).get_by_role('button', name='Supprimer cette conversation').click(); pg.wait_for_timeout(200)
    verifie('supprimer une conversation', fen.locator('.conversation-item').count() == 1)
    pg.screenshot(path='hist.png')
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
