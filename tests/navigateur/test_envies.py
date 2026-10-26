# « Une envie ? » dans Apparence générale : chaque envie garde ses propositions, avec l'article, pour y revenir.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
src = open(serveur.DONNEES + '/rendre.py', encoding='utf-8').read()
P0 = eval(src[src.index('P0 = [') + 5: src.index(']', src.index('P0 = [')) + 1])
TEXTE = '\n\n'.join(P0)
plans = json.load(open(serveur.DONNEES + '/plans6.json', encoding='utf-8'))
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c)
    # Chaque appel renvoie les trois mises en page d'exemple, avec un nom qui dit de quel appel elles viennent.
    n = len(envois)
    props = [{'nom': p['nom'] + ' · ' + str(n), 'pourquoi': p['pourquoi'], 'fond': p['fond'], 'slides': [{'gabarit': x['g'], 'paragraphes': x['p'], 'styles': x['s']} for x in p['pages']]} for p in plans]
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici.', 'propositions': props}}], 'stop_reason': 'tool_use'}))
def choix_affiches(fa):
    return fa.get_by_role('group', name='Mises en page proposées').get_by_role('button').all_inner_texts()
def ouvrir_envie(pg):
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Une envie ?').click(); pg.wait_for_timeout(500)
    return pg.get_by_role('dialog', name='Apparence générale', exact=True)
def envoyer_envie(pg, fa, envie):
    fa.locator('#indications-ccb').fill(envie); fa.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1500)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    # Un article au texte assez long pour les mises en page d'exemple
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(300)
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text(TEXTE); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300)
    q = pg.get_by_role('dialog', name='Ton nouvel article'); q.get_by_role('button', name='Portrait · 4:5').click(); q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Continuer : Mise en page').click(); pg.wait_for_timeout(1500)
    fw = pg.get_by_role('dialog', name='Choisis ta mise en page')
    if fw.count(): fw.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(500)
    # Deux envies : chacune garde ses propositions
    fa = ouvrir_envie(pg)
    envoyer_envie(pg, fa, 'Plus de citations en grand')
    n_a = len(envois)
    verifie('1re envie : ses propositions s’affichent', any('· ' + str(n_a) in t for t in choix_affiches(fa)), choix_affiches(fa))
    envoyer_envie(pg, fa, 'Un fond bleu pâle')
    n_b = len(envois)
    verifie('2e envie : les nouvelles propositions remplacent l’affichage', any('· ' + str(n_b) in t for t in choix_affiches(fa)) and not any('· ' + str(n_a) in t for t in choix_affiches(fa)), choix_affiches(fa))
    boutons = fa.get_by_role('button', name='Revoir ces propositions')
    verifie('la 1re envie propose « Revoir ces propositions »', boutons.count() == 1 and 'Affichées en haut' in fa.locator('.mep-fil-messages').inner_text())
    boutons.first.click(); pg.wait_for_timeout(400)
    verifie('« Revoir » remet les propositions de la 1re envie, sans appeler CCB', any('· ' + str(n_a) in t for t in choix_affiches(fa)) and len(envois) == n_b, (choix_affiches(fa), len(envois) - n_b))
    # Fermer puis rouvrir : la conversation et ses propositions sont toujours là
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    fa = ouvrir_envie(pg)
    fil = fa.locator('.mep-fil-messages')
    verifie('rouverte : les deux envies sont dans la conversation', fil.count() == 1 and 'Plus de citations en grand' in fil.inner_text() and 'Un fond bleu pâle' in fil.inner_text())
    verifie('rouverte : chaque envie a son bouton « Revoir »', fa.get_by_role('button', name='Revoir ces propositions').count() == 2)
    fa.get_by_role('button', name='Revoir ces propositions').nth(1).click(); pg.wait_for_timeout(400)
    verifie('rouverte : « Revoir » remet les propositions de la 2e envie', any('· ' + str(n_b) in t for t in choix_affiches(fa)), choix_affiches(fa))
    # Une nouvelle envie ne reprend pas les anciennes dans ses indications
    envoyer_envie(pg, fa, 'Une couverture plus percutante')
    m = json.dumps(envois[-1], ensure_ascii=False)
    verifie('nouvelle envie : seules les envies de cette fois sont transmises', 'Une couverture plus percutante' in m and 'Plus de citations en grand' not in m, m[-300:])
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # Gardé avec l'article : après un rechargement, l'historique est toujours là
    pg.reload(); pg.wait_for_timeout(1200)
    if pg.locator('nav.etapes .etape').count() == 0: pg.get_by_text(P0[0][:20]).first.click(); pg.wait_for_timeout(400)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = ouvrir_envie(pg)
    verifie('après rechargement : les trois envies sont gardées', fa.get_by_role('button', name='Revoir ces propositions').count() + fa.locator('.pastille-envie').count() == 3 and 'Plus de citations en grand' in fa.locator('.mep-fil-messages').inner_text())
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # Le texte change : les propositions d'une ancienne envie sont adaptées au nouveau texte
    pg.locator('nav.etapes .etape').nth(0).click(); pg.wait_for_timeout(600)
    zone = pg.locator('textarea').first
    zone.click(); pg.keyboard.press('Control+End'); pg.keyboard.insert_text('\n\nUn paragraphe ajouté après les envies.'); pg.wait_for_timeout(400)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = ouvrir_envie(pg)
    n_c = len(envois)
    fa.get_by_role('button', name='Revoir ces propositions').first.click(); pg.wait_for_timeout(600)
    t = fa.locator('.mep-fil-messages').inner_text()
    verifie('texte modifié : une note le dit, sans appeler CCB', ('Ton texte a changé depuis cette envie' in t or 'ne tiennent plus sur ton texte modifié' in t) and len(envois) == n_c, t[-300:])
    verifie('texte modifié : propositions adaptées, ou bouton pour relancer l’envie', any('· ' + str(n_a) in x for x in choix_affiches(fa)) or fa.get_by_role('button', name='Relancer cette envie').count() == 1, choix_affiches(fa))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
