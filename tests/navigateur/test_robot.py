from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    etat['texte'] = json.loads(r.post_data)['messages'][0]['content']
    t = json.dumps({'reponse': 'Voici une version plus courte.', 'propositions': [{'titre': 'Plus court', 'avant': 'Pourtant, j’adore mon travail.', 'apres': 'Pourtant, j’aime mon travail.', 'pourquoi': 'Plus simple.', 'vigilance': ''}], 'pistes': []}, ensure_ascii=False)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    verifie('sans clé : le robot invite à ajouter une clé', 'ajoute une clé' in pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text())
    pg.keyboard.press('Escape')
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    if pg.locator('nav.etapes .etape').count() == 0: pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    m = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text()
    verifie('robot de la barre de menus : « Générer 3 propositions » ou « Discuter »', 'Générer 3 propositions' in m and 'Discuter' in m, m)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    verifie('Échap ferme le menu du robot', pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').count() == 0)
    # Barre flottante : sélectionner « Pourtant, » dans le 2e bloc de la couverture
    pg.mouse.click(600, 590); pg.wait_for_timeout(250); pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    pg.locator('.editeur-bloc').evaluate('(el) => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); }'); pg.wait_for_timeout(300)
    barre = pg.locator('.barre-flottante')
    verifie('robot dans la barre flottante', barre.get_by_role('button', name='CCB · Creative Collaborative Boost').count() == 1)
    barre.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(300)
    print('   DEBUG barre :', pg.locator('.barre-flottante').count(), pg.locator('[role=menu]').count(), pg.locator('.barre-flottante .outil-robot').get_attribute('aria-expanded') if pg.locator('.barre-flottante .outil-robot').count() else None)
    m2 = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text()
    verifie('sur une sélection : discussion et actions rapides', 'Discuter de ce passage avec CCB' in m2 and 'Raccourcir' in m2 and 'Générer 3 propositions' not in m2, m2)
    pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').get_by_role('menuitem', name='Raccourcir').click(); pg.wait_for_timeout(900)
    fen = pg.locator('.fenetre-discussion')
    verifie('la discussion s’ouvre avec le passage et la demande envoyée', fen.count() == 1 and 'Passage choisi' in fen.inner_text() and 'Raccourcis ce passage pour qu’il tienne mieux dans sa page.' in fen.inner_text() and '<passage>' in etat.get('texte', ''), fen.inner_text()[:200] if fen.count() else '')
    fen.locator('.discussion-proposition').get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(400)
    verifie('« Appliquer » depuis Composition modifie le texte de l’article', 'Pourtant, j’aime mon travail.' in pg.locator('textarea.editeur-zone').input_value())
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
