# Étape Publication : la grande fenêtre n'est qu'un aperçu (agrandir, feuilleter, aperçus des posts), sans rien pouvoir modifier.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
envois = []
def claude(route):
    envois.append(route.request.url)
    return route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'content-type': 'application/json'}, body=json.dumps({'content': [{'type': 'text', 'text': '{}'}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    article = lambda: next(a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail')
    a0 = article(); n = len(a0['slides'])
    pg.locator('nav.etapes .etape').nth(2).click(); pg.wait_for_timeout(600); pg.evaluate('window.scrollTo(0,0)')
    pg.locator('.publication-apercu .page-cliquable').click(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre')
    verifie('toucher l’aperçu ouvre le carrousel en grand', gf.count() == 1 and gf.locator('canvas').first.bounding_box()['width'] > 400)
    verifie('pas de « + » (ajouter une zone)', gf.locator('.gf-ajout').count() == 0)
    sf = gf.locator('.gf-surface'); bb = sf.bounding_box()
    verifie('surface en aperçu seulement', gf.locator('.gf-surface.lecture').count() == 1)
    # Tracer un rectangle et toucher un paragraphe : rien ne s'ouvre
    pg.mouse.move(bb['x'] + bb['width'] * 0.1, bb['y'] + bb['height'] * 0.3); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.12, bb['y'] + bb['height'] * 0.7, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.mouse.click(bb['x'] + bb['width'] * 0.3, bb['y'] + bb['height'] * 0.45); pg.wait_for_timeout(300)
    verifie('tracer une zone ou toucher un paragraphe n’ouvre pas l’agent ciblé', gf.locator('.gf-agent').count() == 0 and gf.locator('.gf-zone').count() == 0 and gf.get_by_label('Ta demande à CCB pour cette zone').count() == 0)
    verifie('la fenêtre reste ouverte', gf.count() == 1)
    # Feuilleter : flèches, puis glisser du doigt
    gf.get_by_role('button', name='Page suivante').click(); pg.wait_for_timeout(250)
    verifie('la flèche passe à la page suivante', gf.locator('.gf-compteur').inner_text() == f'2 / {n}')
    pg.mouse.move(bb['x'] + bb['width'] * 0.8, bb['y'] + bb['height'] * 0.5); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.2, bb['y'] + bb['height'] * 0.52, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
    verifie('glisser vers la gauche : page suivante', gf.locator('.gf-compteur').inner_text() == f'3 / {n}', gf.locator('.gf-compteur').inner_text())
    pg.mouse.move(bb['x'] + bb['width'] * 0.2, bb['y'] + bb['height'] * 0.5); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] * 0.8, bb['y'] + bb['height'] * 0.52, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
    verifie('glisser vers la droite : page précédente', gf.locator('.gf-compteur').inner_text() == f'2 / {n}', gf.locator('.gf-compteur').inner_text())
    # Aperçus des posts
    gf.get_by_role('button', name='Aperçu du post LinkedIn').click(); pg.wait_for_timeout(300)
    verifie('le logo LinkedIn ouvre l’aperçu du post', pg.get_by_role('dialog', name='Aperçu du post').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    verifie('Échap referme', pg.locator('.grande-fenetre').count() == 0)
    # Les petites pages ouvrent le carrousel sur elles
    vig = pg.locator('.publication-vignettes .vignette-publication')
    verifie('chaque petite page est un bouton (44 points)', vig.count() == n - 1 and vig.first.bounding_box()['height'] >= 44 and vig.first.bounding_box()['width'] >= 44)
    pg.get_by_role('button', name='Voir la page 3 en grand').click(); pg.wait_for_timeout(400)
    verifie('« Voir la page 3 en grand » ouvre sur la page 3', pg.locator('.grande-fenetre .gf-compteur').inner_text() == f'3 / {n}')
    pg.locator('.grande-fenetre').get_by_role('button', name='Fermer').click(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(800)
    a1 = article()
    verifie('ni la mise en page ni le texte n’ont changé', a1['slides'] == a0['slides'] and a1['texte'] == a0['texte'])
    verifie('aucun appel à l’IA', len(envois) == 0, len(envois))
    # À l'étape Mise en page, « Agrandir » garde l'agent ciblé
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    pg.locator('.page-slide[data-index="0"] .bouton-agrandir').click(); pg.wait_for_timeout(500)
    verifie('Mise en page › Agrandir : le « + » et le tracé de zone restent', pg.locator('.grande-fenetre .gf-ajout').count() == 1 and pg.locator('.grande-fenetre .gf-surface.lecture').count() == 0)
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
