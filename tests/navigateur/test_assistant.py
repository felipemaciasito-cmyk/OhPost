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
    corps = json.loads(r.post_data); etat['texte'] = corps['messages'][0]['content']
    t = json.dumps({'reponse': 'Voici une version plus courte.', 'propositions': [{'titre': 'Plus court', 'avant': 'Pourtant, j’adore mon travail.', 'apres': 'Et pourtant, j’aime mon travail.', 'pourquoi': 'Plus bref.', 'vigilance': ''}], 'pistes': []}, ensure_ascii=False)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    verifie('robot à droite de la barre de menus', pg.locator('.historique-menus').get_by_role('button', name='CCB · Creative Collaborative Boost').count() == 1)
    pg.get_by_role('button', name='Carrousel', exact=True).click(); pg.wait_for_timeout(150)
    verifie('plus de « Propositions de mise en page » dans les menus', pg.get_by_role('menuitem', name='Propositions de mise en page…').count() == 0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    m = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text()
    verifie('sans clé : invitation à ajouter une clé', 'ajoute une clé' in m, m)
    pg.keyboard.press('Escape')
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(200)
    m = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text()
    verifie('avec clé : bulle à deux choix, l’apparence', 'Générer 3 propositions' in m and 'Une envie ?' in m and 'Discuter' not in m, m)
    pg.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(300)
    verifie('le robot ouvre la fenêtre de mise en page', pg.locator('[role=dialog][aria-label="Apparence générale"]').count() == 1)
    pg.locator('[role=dialog] .feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # Barre flottante : passage sélectionné
    pg.mouse.click(600, 590); pg.wait_for_timeout(250); pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    pg.locator('.editeur-bloc').evaluate('(el) => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); }'); pg.wait_for_timeout(300)
    rb = pg.locator('.barre-flottante').get_by_role('button', name='CCB · Creative Collaborative Boost')
    verifie('robot dans la barre flottante', rb.count() == 1)
    pg.wait_for_timeout(500); rb.click(); pg.wait_for_timeout(300)
    if pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').count() == 0: rb.click(); pg.wait_for_timeout(300)  # la barre peut encore se placer
    m = pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').inner_text()
    verifie('menu du passage : discuter et actions rapides', 'Discuter de ce passage avec CCB' in m and 'Raccourcir' in m and 'Générer 3 propositions' not in m, m)
    pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').get_by_role('menuitem', name='Raccourcir').click(); pg.wait_for_timeout(1000)
    fen = pg.locator('.fenetre-discussion')
    verifie('la discussion s’ouvre avec le passage et envoie la demande', fen.count() == 1 and 'Passage choisi' in fen.inner_text() and 'Nouvelle demande de la personne :\nRaccourcis ce passage pour qu’il tienne mieux dans sa page.' in etat.get('texte', '') and 'Plus court' in fen.inner_text(), fen.inner_text()[:300] if fen.count() else '')
    toile = lambda: pg.locator('canvas[aria-label="Page 1"]').evaluate('(c) => c.toDataURL()')
    avant = toile()
    fen.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(500)
    verifie('appliquer change la page', toile() != avant)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(300)
    verifie('et le texte de l’article', 'Et pourtant, j’aime mon travail.' in pg.locator('textarea.editeur-zone').input_value())
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
