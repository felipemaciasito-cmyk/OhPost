from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'n': 0, 'erreur': False}
PASSAGE = 'Pas de conflit ouvert, pas de reproches. Juste des mails de plus en plus froids, des réunions auxquelles elle n’est plus conviée et des décisions qu’elle découvre après tout le monde.'
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    corps = json.loads(r.post_data); etat['systeme'] = corps.get('system', ''); etat['texte'] = corps['messages'][0]['content']
    if etat['erreur']: return route.fulfill(status=529, headers=CORS, body=json.dumps({'error': {'type': 'overloaded_error'}}))
    etat['n'] += 1
    t = json.dumps({'reponse': 'Voici 3 versions plus courtes.', 'propositions': [
        {'avant': PASSAGE.replace('’', "'"), 'apres': "Pas de conflit, pas de reproches : juste des mails plus froids, des réunions sans elle et des décisions qu'elle apprend après tout le monde.", 'pourquoi': 'Plus court, mêmes faits.', 'vigilance': ''},
        {'avant': PASSAGE, 'apres': 'Pas de dispute. Des mails plus froids, des réunions sans elle, des décisions découvertes après les autres.', 'pourquoi': 'Plus sec.', 'vigilance': '« Pas de dispute » perd la nuance « ouvert ».'},
        {'avant': PASSAGE, 'apres': 'Aucun conflit ouvert, aucun reproche. Seulement des mails plus froids et des réunions sans elle.', 'pourquoi': 'Plus court encore.', 'vigilance': 'Les décisions apprises en dernier disparaissent.'}]}, ensure_ascii=False) if etat['n'] == 1 else json.dumps({'reponse': 'Oui, ton accroche est claire.\nElle annonce bien le récit.', 'propositions': [], 'pistes': ['Rends la chute plus percutante', 'Vérifie les répétitions de « silence »']}, ensure_ascii=False)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    verifie('carte « Discussion » à la place des suggestions', pg.get_by_role('button', name='CCB · Creative Collaborative Boost').count() == 1 and 'Suggestions de style' not in pg.locator('main').inner_text())
    zone = pg.locator('textarea.editeur-zone'); val = zone.input_value(); d = val.index('Pas de conflit'); f = d + len(PASSAGE)
    zone.click(); zone.evaluate(f'(el) => el.setSelectionRange({d}, {f})'); pg.keyboard.press('Shift'); pg.wait_for_timeout(150)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    fen = pg.locator('.fenetre-discussion')
    verifie('petite fenêtre ouverte, passage rappelé', fen.count() == 1 and 'Passage choisi : « Pas de conflit ouvert' in fen.inner_text())
    champ = fen.get_by_label('Ta consigne à CCB'); champ.fill('Donne-moi 3 versions plus courtes'); champ.press('Enter'); pg.wait_for_timeout(900)
    verifie('consigne envoyée avec article, passage et demande', 'partenaire d’écriture' in etat['systeme'] and '<passage>\n' + PASSAGE in etat['texte'] and 'Nouvelle demande de la personne :\nDonne-moi 3 versions plus courtes' in etat['texte'])
    verifie('3 propositions affichées', fen.locator('.discussion-proposition').count() == 3 and 'Voici 3 versions plus courtes.' in fen.inner_text())
    verifie('typographie dans l’aperçu', 'qu’elle apprend' in fen.locator('.discussion-proposition').first.inner_text())
    fen.locator('.discussion-proposition').nth(0).get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(300)
    v1 = zone.input_value()
    verifie('appliquer (l’IA avait recopié des apostrophes droites)', 'des réunions sans elle et des décisions qu’elle apprend' in v1 and PASSAGE not in v1)
    verifie('la fenêtre reste ouverte', pg.locator('.fenetre-discussion').count() == 1)
    fen.locator('.discussion-proposition').nth(1).get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(300)
    v2 = zone.input_value()
    verifie('passage choisi = la version appliquée', 'Passage choisi : « Pas de dispute.' in fen.inner_text(), fen.inner_text()[:200])
    verifie('une autre proposition remplace la première', 'Pas de dispute.' in v2 and 'qu’elle apprend' not in v2 and v2.count('réunions sans elle') == 1)
    fen.locator('.discussion-proposition').nth(1).get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    verifie('annuler rétablit le texte d’origine', zone.input_value() == val)
    verifie('le passage choisi suit le texte', 'Passage choisi : « Pas de conflit ouvert' in fen.inner_text())
    champ.fill('Est-ce que mon accroche est claire ?'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(800)
    verifie('question simple : réponse sans proposition, l’historique est envoyé', 'Oui, ton accroche est claire.' in fen.inner_text() and 'Personne : Donne-moi 3 versions plus courtes' in etat['texte'])
    verifie('contexte : paragraphes numérotés et place du passage', '[1]\n' in etat['texte'] and '← le passage choisi est dans ce paragraphe' in etat['texte'] and 'Passage choisi (paragraphe' in etat['texte'] and 'publié sur Instagram' in etat['texte'])
    verifie('pistes proposées pour continuer', fen.locator('.puce.piste').count() == 2 and 'Pour continuer' in fen.inner_text().upper().title() or fen.locator('.puce.piste').count() == 2)
    fen.locator('.puce.piste').first.click(); pg.wait_for_timeout(800)
    verifie('toucher une piste l’envoie', 'Nouvelle demande de la personne :\nRends la chute plus percutante' in etat['texte'])
    fen.get_by_role('button', name='Fermer la discussion').click(); pg.wait_for_timeout(200)
    verifie('fermée, conversation gardée', pg.locator('.fenetre-discussion').count() == 0 and pg.get_by_role('button', name='CCB · Creative Collaborative Boost').count() == 1)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    verifie('rouverte avec la conversation', 'Oui, ton accroche est claire.' in pg.locator('.fenetre-discussion').inner_text())
    # Profil éditorial : Configuration › IA, puis envoyé à Claude
    pg.locator('.fenetre-discussion').get_by_role('button', name='Fermer la discussion').click()
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='IA', exact=True).click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Partir d’une proposition, à vérifier et compléter').click(); pg.wait_for_timeout(200)
    verifie('profil proposé, modifiable', 'Anne Litique' in pg.get_by_label('Ton profil éditorial').input_value())
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    etat['erreur'] = True
    pg.locator('.fenetre-discussion').get_by_role('button', name='Clarifier').click(); pg.wait_for_timeout(800)
    verifie('le profil éditorial est envoyé', '<profil>\nOh ! Potentiel' in etat.get('texte', ''))
    verifie('erreur expliquée', 'surchargé' in pg.locator('.fenetre-discussion').inner_text())
    pg.locator('.fenetre-discussion').get_by_role('button', name='Nouvelle').click(); pg.wait_for_timeout(200)
    verifie('nouvelle conversation', pg.locator('.fenetre-discussion .bulle.moi').count() == 0)
    pg.screenshot(path='disc.png')
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
