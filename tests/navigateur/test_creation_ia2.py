# Nouvel article : discussion avec CCB, favoris, étapes cliquables ; « Mise en page » d'un article existant ; 7 pages pour un texte long.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
src = open(serveur.DONNEES + '/rendre.py', encoding='utf-8').read()
P0 = eval(src[src.index('P0 = [') + 5: src.index(']', src.index('P0 = [')) + 1])
TEXTE = '\n\n'.join(P0)
plans = json.load(open(serveur.DONNEES + '/plans6.json', encoding='utf-8'))
def plan_ia(pl, nom=None, fond=None):
    return {'nom': nom or pl['nom'], 'pourquoi': pl['pourquoi'], 'fond': fond or pl['fond'], 'slides': [{'gabarit': p['g'], 'paragraphes': p['p'], 'styles': p['s']} for p in pl['pages']]}
BONS = [plan_ia(p) for p in plans]
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'reponses': [], 'envois': []}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); etat['envois'].append(c)
    rep = etat['reponses'].pop(0) if etat['reponses'] else {'propositions': BONS}
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': rep.get('reponse', 'Voici.'), 'propositions': rep['propositions']}}], 'stop_reason': 'tool_use'}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(300)
    fe = pg.locator('[role=dialog]').first
    verifie('création : impossible de continuer sans texte', pg.get_by_role('button', name='Continuer', exact=True).is_disabled())
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300); _q = pg.get_by_role('dialog', name='Ton nouvel article'); _q.get_by_role('button', name='Portrait · 4:5').click(); _q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(700)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(1300)
    fe = pg.locator('[role=dialog]').first
    seg = fe.get_by_role('group', name='Mises en page proposées')
    verifie('premier passage : propositions', seg.get_by_role('button').count() == 4)
    # Favoris
    fe.get_by_role('button', name='Garder dans mes favoris', exact=True).click(); pg.wait_for_timeout(200)
    verifie('proposition gardée dans les favoris', fe.get_by_role('button', name='Retirer de mes favoris').count() == 1)
    nb_fav = pg.evaluate("() => 0")
    # Agent général : la bulle du robot (trois propositions tout de suite, ou une envie)
    fe.locator('.bouton-robot').first.click(); pg.wait_for_timeout(200)
    bulle = fe.locator('.bulle-ccb')
    verifie('robot : bulle « Générer 3 propositions » ou « Une envie ? »', bulle.get_by_role('menuitem').count() == 2 and 'Une envie ?' in bulle.inner_text())
    bulle.get_by_role('menuitem', name='Une envie').click(); pg.wait_for_timeout(200)
    etat['reponses'] = [{'propositions': [plan_ia(plans[0], nom='Récit en vert', fond='vertPale'), plan_ia(plans[1], nom='Contraste vert', fond='vertPale'), plan_ia(plans[2], nom='Chocs en vert', fond='vertPale')]}]
    champ = fe.get_by_label('Une envie ?'); champ.fill('Mets un fond vert pâle'); champ.press('Enter'); pg.wait_for_timeout(1500)
    c = etat['envois'][-1]['messages'][0]['content']
    verifie('l’envie part avec la demande de trois propositions', 'Mets un fond vert pâle' in c and 'Nombre de slides : 6 au plus' in c)
    verifie('trois nouvelles propositions, fond suivi', seg.get_by_role('button').first.inner_text() == 'Récit en vert' and 'fond vert pâle' in fe.locator('.mep-infos').inner_text())
    # Les indications servent aux nouvelles propositions
    fe.locator('.bouton-robot').click(); pg.wait_for_timeout(200); fe.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(1200)
    verifie('« Générer 3 propositions » reprend tes indications', 'Indications de la personne' in etat['envois'][-1]['messages'][0]['content'] and 'Mets un fond vert pâle' in etat['envois'][-1]['messages'][0]['content'])
    # Retour à l'étape 1 puis 3 par les pastilles
    fe.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(900)
    verifie('appliqué : étape Mise en page', 'Mise en page' in pg.locator('.etape.active').inner_text())
    # Mise en page d'un article existant : bouton « Mise en page… »
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    fr = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    seg2 = fr.get_by_role('group', name='Mises en page proposées')
    verifie('réglages : ouverts à l’étape 2 sur la mise en page actuelle, sans appel', fr.locator('.etapes-assistant').count() == 0 and seg2.get_by_role('button', name='Actuelle').get_attribute('aria-pressed') == 'true')
    n_av = len(etat['envois'])
    etat['reponses'] = [{'propositions': BONS}]
    fr.locator('.bouton-robot').click(); pg.wait_for_timeout(200); fr.get_by_role('menuitem', name='Générer 3 propositions').click(); pg.wait_for_timeout(1200)
    verifie('réglages : propositions à la demande', len(etat['envois']) == n_av + 1 and seg2.get_by_role('button').count() == 5)
    seg2.get_by_role('button', name=plans[1]['nom']).click(); pg.wait_for_timeout(200)
    fr.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(600)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('appliqué : message annulable', 'Mise en page appliquée' in msg and pg.get_by_role('dialog', name='Apparence générale', exact=True).count() == 0, msg)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fond_bleu = pg.locator('canvas[aria-label="Page 1"]').evaluate("c => { const d = c.getContext('2d').getImageData(5, 5, 1, 1).data; return [d[0], d[1], d[2]]; }")
    verifie('la proposition « Avant, après » est appliquée (fond bleu)', fond_bleu[2] > fond_bleu[0] and fond_bleu[0] < 40, fond_bleu)
    # Texte long : 7 pages permises
    pg.get_by_role('button', name='Articles').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(300)
    fe = pg.locator('[role=dialog]').first
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE + '\n\n' + ' '.join(['Une phrase de plus pour allonger le texte.'] * 8)); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300); _q = pg.get_by_role('dialog', name='Ton nouvel article'); _q.get_by_role('button', name='Portrait · 4:5').click(); _q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='Continuer : Mise en page').click(); pg.wait_for_timeout(1300)
    verifie('texte long : 7 pages au plus demandées', 'Nombre de slides : 7 au plus' in etat['envois'][-1]['messages'][0]['content'])
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
