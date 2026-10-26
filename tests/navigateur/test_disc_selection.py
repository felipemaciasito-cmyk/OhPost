# Mise en page : discussion ouverte depuis le robot de la barre de sélection, puis sélection de mots dans une page → le passage discuté change.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici.', 'propositions': [], 'pistes': []}}], 'stop_reason': 'tool_use'}))
def selectionner(pg, n_car):
    pg.locator('.editeur-bloc').evaluate("(el, n) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const t = w.nextNode(); const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, Math.min(n, t.length)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); }", n_car)
    pg.wait_for_timeout(400)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    # La discussion s'ouvre depuis le robot de la barre de sélection (celui de la barre de menus sert à l'apparence).
    pg.mouse.click(600, 300); pg.wait_for_timeout(250); pg.mouse.click(600, 300); pg.wait_for_timeout(400)
    selectionner(pg, 9)
    rb = pg.locator('.barre-flottante').get_by_role('button', name='CCB · Creative Collaborative Boost')
    pg.wait_for_timeout(300); rb.click(); pg.wait_for_timeout(300)
    if pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').count() == 0: rb.click(); pg.wait_for_timeout(300)  # la barre peut encore se placer
    pg.get_by_role('menuitem', name='Discuter de ce passage avec CCB').click(); pg.wait_for_timeout(300)
    fen = pg.locator('.fenetre-discussion')
    verifie('discussion ouverte sur le passage sélectionné', fen.count() == 1 and 'Passage choisi' in fen.inner_text(), fen.inner_text()[:200] if fen.count() else '')
    verifie('on peut encore écrire dans un bloc, la discussion reste ouverte', pg.locator('.editeur-bloc').count() == 1 and fen.count() == 1)
    selectionner(pg, 9)
    t = fen.inner_text()
    verifie('les mots sélectionnés deviennent le passage discuté', 'Passage choisi' in t, t[:200])
    p1 = fen.locator('.discussion-passage').inner_text()
    selectionner(pg, 4)
    p2 = fen.locator('.discussion-passage').inner_text()
    verifie('une autre sélection remplace le passage', p1 != p2 and len(p2) < len(p1), (p1, p2))
    champ = fen.get_by_label('Ta consigne à CCB'); champ.fill('Plus court'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(900)
    m = envois[-1]['messages'][0]['content'] if envois else ''
    verifie('la demande porte sur ce passage', bool(envois) and 'passage' in m.lower(), m[-300:])
    verifie('CCB sait sur quelle page est le passage et ce qu’une page doit être', 'étape Mise en page' in m and 'page 1 sur' in m and '20 à 40 mots' in m, m[-600:])
    verifie('CCB sait sur quelle page on travaille (gabarit, volume)', 'étape Mise en page), page 1 sur' in m and 'gabarit « ' in m and 'mots) : « ' in m, m[-600:])
    fen.get_by_role('button', name='Retirer le passage choisi').click(); pg.wait_for_timeout(300)
    verifie('passage retiré : invitation à sélectionner', fen.count() == 1 and 'touche deux fois un bloc' in fen.inner_text())
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
