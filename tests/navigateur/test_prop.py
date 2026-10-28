# Fenêtre unique de mise en page sur un article existant (remplace l'ancienne « Propositions de mise en page… »).
from playwright.sync_api import sync_playwright
import serveur, json, re; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'texte': '', 'systeme': ''}
def plan(nom, fond, n, gab):
    slides = [{'gabarit': 'V1', 'paragraphes': [0], 'styles': ['titre']}]
    k = 1; g = max(1, -(-(n - 1) // 5))  # au plus 6 pages
    while k < n:
        p = list(range(k, min(n, k + g))); slides.append({'gabarit': gab, 'paragraphes': p, 'styles': ['corps'] * len(p)}); k += g
    return {'nom': nom, 'pourquoi': 'Pour essayer.', 'fond': fond, 'slides': slides}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); etat['texte'] = c['messages'][0]['content']; etat['systeme'] = c.get('system', '')
    n = len(re.findall(r'^\[\d+\] ', etat['texte'], re.M))
    incomplet = plan('Incomplet', 'bleu', n, 'T1'); incomplet['slides'] = incomplet['slides'][:-1]
    props = [plan('Récit', 'blanc', n, 'T1'), plan('Contraste', 'vertPale', n, 'T3'), incomplet]
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici.', 'propositions': props}}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    texte_avant = pg.locator('textarea.editeur-zone').input_value()
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fen = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    seg = fen.get_by_role('group', name='Mises en page proposées')
    verifie('fenêtre ouverte sur la mise en page actuelle', fen.count() == 1 and seg.get_by_role('button', name='Actuelle').get_attribute('aria-pressed') == 'true')
    fen.locator('.bouton-robot').click(); pg.wait_for_timeout(200); fen.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(1500)
    verifie('consigne : catalogue, paragraphes numérotés, règles', 'Gabarits (code : nom, famille, usage)' in etat['texte'] and '[0] ' in etat['texte'] and 'Esthétique avant tout' in etat['systeme'], etat['texte'][:200])
    noms = seg.get_by_role('button').all_inner_texts()
    verifie('deux propositions retenues, l’incomplète écartée et annoncée', noms == ['Actuelle', 'Récit', 'Contraste', 'Sans IA'] and 'écartée' in fen.inner_text(), noms)
    verifie('pages dessinées par le moteur', fen.locator('.mep-vignette canvas').count() >= 3)
    seg.get_by_role('button', name='Contraste').click(); pg.wait_for_timeout(200)
    fen.get_by_role('button', name='Garder dans mes favoris', exact=True).click(); pg.wait_for_timeout(200)
    verifie('carrousel gardé dans les favoris', fen.get_by_role('button', name='Retirer de mes favoris').count() == 1)
    fen.get_by_role('button', name='Mes favoris', exact=True).click(); pg.wait_for_timeout(200)
    verifie('il apparaît dans « Mes favoris »', 'Contraste' in fen.get_by_role('group', name='Mes carrousels favoris').inner_text())
    fen.get_by_role('button', name='Mes favoris', exact=True).click(); pg.wait_for_timeout(150)
    fen.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(700)
    verifie('fenêtre fermée, message annulable', pg.get_by_role('dialog').count() == 0 and 'Mise en page appliquée' in pg.locator('.message').inner_text())
    pg.locator('nav.etapes .etape').nth(0).click(); pg.wait_for_timeout(400)
    verifie('le texte de l’article est inchangé', pg.locator('textarea.editeur-zone').input_value() == texte_avant)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='Annuler').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    verifie('Annuler rétablit l’ancienne mise en page', pg.get_by_role('dialog', name='Apparence générale', exact=True).get_by_role('group', name='Mises en page proposées').get_by_role('button', name='Actuelle').count() == 1)
    # Discussion sur « Actuelle » : CCB compose avec les indications ; le message dit combien sont vraiment affichées
    if not pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fen = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    fen.get_by_role('group', name='Mises en page proposées').get_by_role('button', name='Actuelle').click(); pg.wait_for_timeout(200)
    fen.locator('.bouton-robot').click(); pg.wait_for_timeout(200)
    fen.locator('.bulle-ccb').get_by_role('menuitem', name='Une envie').click(); pg.wait_for_timeout(200)
    fen.get_by_label('Une envie ?').fill('Plus de citations'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1800)
    t = fen.locator('.mep-discussion').inner_text() if fen.locator('.mep-discussion').count() else fen.inner_text()
    verifie('message honnête : deux propositions affichées, pas trois', 'deux propositions' in t and 'Voici trois propositions' not in t, t[-300:])
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
