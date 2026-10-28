# CCB : son nom, le prénom (Anne par défaut, réglable), son ton, et l'accueil selon le moment de la journée, qui varie.
from playwright.sync_api import sync_playwright
import serveur, json, datetime; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c)
    t = json.dumps({'reponse': 'Avec plaisir, Anne.', 'propositions': []})
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
def heure(pg, h, m=30):
    pg.clock.install(time=datetime.datetime(2026, 10, 28, h, m))
with sync_playwright() as p:
    b = p.chromium.launch()
    def ouvrir(h):
        pg = b.new_page(viewport={'width': 1180, 'height': 820})
        heure(pg, h)
        pg.route('https://api.anthropic.com/**', claude)
        pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
        pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
        pg.reload(); pg.wait_for_timeout(900)
        return pg
    pg = ouvrir(9)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    matin = pg.evaluate("() => PostsOPIA.ACCUEILS.matin.map((t) => PostsOPIA.phraseAccueil(t, 'Anne'))")
    verifie('environ 60 phrases d’accueil écrites à l’avance', 55 <= pg.evaluate("() => Object.values(PostsOPIA.ACCUEILS).flat().length") <= 70)
    verifie('typographie : espaces insécables avant ? et !', all(' ?' in t or '?' not in t for t in matin) and not any(' ?' in t or ' !' in t for t in matin))
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(300)
    fen = pg.locator('.fenetre-discussion')
    acc = fen.locator('.accueil-ccb')
    t1 = acc.inner_text() if acc.count() else ''
    verifie('à 9 h 30 : CCB accueille Anne avec une phrase du matin', acc.count() == 1 and t1 in matin and 'Anne' in t1, t1)
    verifie('l’accueil est la première bulle de CCB', fen.locator('.discussion-fil > *').first.evaluate("e => e.classList.contains('accueil-ccb')"))
    champ = fen.get_by_label('Ta consigne à CCB'); champ.fill('Rends le début plus vivant'); champ.press('Enter'); pg.wait_for_timeout(900)
    sy = envois[-1].get('system', '') if envois else ''
    verifie('CCB connaît son nom', 'tu es CCB (Creative Collaborative Boost)' in sy, sy[-400:])
    verifie('CCB appelle Anne par son prénom, en la tutoyant', 'Tu parles à Anne' in sy and 'tutoie' in sy)
    verifie('ton professionnel, bienveillant et chaleureux', 'professionnel, bienveillant et chaleureux' in sy)
    verifie('jamais le prénom dans les textes à publier', 'ne vont jamais dans les textes que tu écris pour être publiés' in sy)
    verifie('les consignes habituelles restent en tête', sy.startswith('Tu es') or 'partenaire d’écriture' in sy.split('Qui tu es')[0])
    verifie('l’accueil reste en tête après l’échange', acc.count() == 1 and acc.inner_text() == t1)
    fen.get_by_role('button', name='Fermer la discussion').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(300)
    verifie('même conversation rouverte : même accueil', pg.locator('.fenetre-discussion .accueil-ccb').inner_text() == t1)
    pg.locator('.fenetre-discussion').get_by_role('button', name='Nouvelle conversation').click(); pg.wait_for_timeout(300)
    t2 = pg.locator('.fenetre-discussion .accueil-ccb').inner_text()
    verifie('nouvelle conversation : une autre phrase', t2 in matin and t2 != t1, (t1, t2))
    # D'une session à l'autre : les dernières phrases ne reviennent pas
    suite = pg.evaluate("() => Array.from({ length: 6 }, () => PostsOPIA.accueil(new Date(2026, 9, 28, 9, 30), 'Anne'))")
    verifie('d’une session à l’autre, les phrases varient (pas de répétition récente)', len(set(suite + [t1, t2])) == len(suite) + 2, suite)
    # Apparence générale › « Une envie ? »
    pg.locator('.fenetre-discussion').get_by_role('button', name='Fermer la discussion').click(); pg.wait_for_timeout(200)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    d = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if not d.count(): pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    d = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    d.locator('.bouton-robot').click(); pg.wait_for_timeout(200)
    d.locator('.bulle-ccb').get_by_role('menuitem', name='Une envie').click(); pg.wait_for_timeout(300)
    ae = d.locator('.mep-discussion .accueil-ccb')
    verifie('« Une envie ? » commence aussi par l’accueil', ae.count() == 1 and ae.inner_text() in matin, ae.inner_text() if ae.count() else '')
    verifie('aucune erreur JavaScript (matin)', not erreurs, erreurs)
    pg.close()
    # Le soir, avec un autre prénom réglé dans Configuration › IA
    pg = ouvrir(20)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/#configuration'); pg.wait_for_timeout(500)
    if not pg.get_by_label('Ton prénom').count():
        for nom in ['Configuration', 'Réglages']:
            if pg.get_by_role('button', name=nom).count(): pg.get_by_role('button', name=nom).first.click(); pg.wait_for_timeout(400); break
        if pg.get_by_role('tab', name='IA').count(): pg.get_by_role('tab', name='IA').click()
        elif pg.get_by_role('button', name='IA', exact=True).count(): pg.get_by_role('button', name='IA', exact=True).click()
        pg.wait_for_timeout(400)
    champ = pg.get_by_label('Ton prénom')
    verifie('Configuration › IA : « Ton prénom », Anne par défaut', champ.count() == 1 and champ.input_value() == 'Anne')
    champ.fill('Claire'); pg.wait_for_timeout(200)
    soir = pg.evaluate("() => PostsOPIA.ACCUEILS.soir.map((t) => PostsOPIA.phraseAccueil(t, 'Claire'))")
    verifie('l’exemple suit le prénom et l’heure (soir)', 'Claire' in pg.locator('main').inner_text() and 'Bonsoir' in pg.locator('main').inner_text())
    pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='CCB · Creative Collaborative Boost').click(); pg.wait_for_timeout(300)
    t3 = pg.locator('.fenetre-discussion .accueil-ccb').inner_text()
    verifie('à 20 h 30 : « Bonsoir Claire… »', t3 in soir and t3.startswith('Bonsoir Claire') or (t3 in soir and 'Claire' in t3), t3)
    n0 = len(envois)
    f2 = pg.locator('.fenetre-discussion'); f2.get_by_label('Ta consigne à CCB').fill('Plus court'); f2.get_by_label('Ta consigne à CCB').press('Enter'); pg.wait_for_timeout(900)
    verifie('CCB appelle maintenant Claire', len(envois) > n0 and 'Tu parles à Claire' in envois[-1].get('system', ''))
    verifie('aucune erreur JavaScript (soir)', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
