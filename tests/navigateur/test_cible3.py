# Agent ciblé : gestes de mise en page (déplacer, taille, page voisine, logo et fleurs), « Annuler », refus expliqués.
from playwright.sync_api import sync_playwright
import serveur, json, re; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data); envois.append(c)
    t = c['messages'][0]['content']
    zone = t.split('<zone>')[1].split('</zone>')[0]
    blocs = [int(m) for m in re.findall(r'^\[(\d+)\]', zone, re.M)]
    demande = t.split('Demande de la personne :')[-1].lower()
    actions = []
    if 'fleurs' in demande or 'logo' in demande: actions = [{'type': 'image', 'image': 'fleurs' if 'fleurs' in demande else 'logo', 'vertical': 'bas', 'horizontal': 'droite'}]
    elif 'en bas' in demande and blocs: actions = [{'type': 'deplacer', 'bloc': blocs[0], 'vertical': 'bas'}]
    elif 'page suivante' in demande and blocs: actions = [{'type': 'page', 'bloc': blocs[-1], 'vers': 'suivante'}]
    elif 'page précédente' in demande and blocs: actions = [{'type': 'page', 'bloc': blocs[0], 'vers': 'precedente'}]
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voilà.', 'modifications': [], 'actions': actions}}], 'stop_reason': 'tool_use'}))
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
def article(pg):
    pg.wait_for_timeout(1200)  # l'enregistrement sur l'appareil se fait juste après la modification
    return next((a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail'), None)
def demander(pg, texte):
    champ = pg.get_by_label('Ta demande à CCB pour cette zone'); champ.fill(texte); champ.press('Enter'); pg.wait_for_timeout(1000)
    return pg.locator('.gf-agent').inner_text() if pg.locator('.gf-agent').count() else ''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    a0 = article(pg)
    verifie('article lu sur l’appareil', a0 is not None and len(a0['slides']) >= 3, len(a0['slides']) if a0 else None)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # La grande fenêtre de l'étape Mise en page (« Agrandir ») : à l'étape Publication, elle n'est plus qu'un aperçu
    pg.locator('.page-slide[data-index="0"] .bouton-agrandir').click(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre')
    # Page 2 : la sélection de tout le texte de la page
    gf.get_by_role('button', name='Page suivante').click(); pg.wait_for_timeout(300)
    bb = gf.locator('.gf-surface').bounding_box()
    def tout_choisir():
        pg.mouse.move(bb['x'] + 2, bb['y'] + 2); pg.mouse.down(); pg.mouse.move(bb['x'] + bb['width'] - 2, bb['y'] + bb['height'] - 2, steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
    tout_choisir()
    n2 = len(a0['slides'][1]['blocs'])
    m = envois[-1]['messages'][0]['content'] if envois else ''
    t = demander(pg, 'Mets le premier paragraphe en bas')
    m = envois[-1]['messages'][0]['content']
    verifie('la demande dit quel paragraphe est le premier et le dernier de la page', '[premier de la page]' in m and ('[dernier de la page]' in m or n2 == 1), m[:400])
    a1 = article(pg)
    verifie('déplacer : la page passe en mise en page libre et son premier paragraphe descend', a1['slides'][1].get('libre') is True and a1['slides'][1]['blocs'][0]['pos']['y'] > 600, json.dumps(a1['slides'][1]['blocs'][0].get('pos')))
    verifie('déplacer : CCB dit que la page est en mise en page libre', 'mise en page libre' in t, t[-300:])
    verifie('déplacer : le texte de l’article ne change pas', a1['texte'] == a0['texte'])
    gf.locator('.gf-agent').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    a2 = article(pg)
    verifie('« Annuler » rétablit la page', not a2['slides'][1].get('libre') and a2['slides'][1]['blocs'] == a0['slides'][1]['blocs'])
    # Page voisine : le dernier paragraphe de la page 2 devient le premier de la page 3
    tout_choisir()
    dernier = a0['slides'][1]['blocs'][-1]['texte']
    t = demander(pg, 'Envoie le dernier paragraphe sur la page suivante')
    a3 = article(pg)
    verifie('page suivante : le dernier paragraphe de la page 2 ouvre la page 3', len(a3['slides'][1]['blocs']) == n2 - 1 and a3['slides'][2]['blocs'][0]['texte'] == dernier, [b['texte'][:30] for b in a3['slides'][2]['blocs']])
    verifie('page suivante : l’ordre des paragraphes ne change pas', [b['texte'] for s in a3['slides'] for b in s['blocs']] == [b['texte'] for s in a0['slides'] for b in s['blocs']])
    verifie('page suivante : CCB le dit', 'premier de la page 3' in t, t[-300:])
    verifie('page suivante : la conversation reste affichée', gf.locator('.gf-agent').count() == 1)
    # Annuler : le paragraphe revient
    gf.locator('.gf-agent').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    a4 = article(pg)
    verifie('« Annuler » remet le paragraphe sur sa page', [len(s['blocs']) for s in a4['slides']] == [len(s['blocs']) for s in a0['slides']])
    # Page précédente : le premier paragraphe de la page 2 va à la fin de la page 1 ; un paragraphe du milieu est refusé
    tout_choisir()
    premier = a0['slides'][1]['blocs'][0]['texte']
    t = demander(pg, 'Envoie ce paragraphe sur la page précédente')
    a5 = article(pg)
    verifie('page précédente : le premier paragraphe de la page 2 termine la page 1', a5['slides'][0]['blocs'][-1]['texte'] == premier, [b['texte'][:30] for b in a5['slides'][0]['blocs']])
    gf.locator('.gf-agent').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    verifie('« Annuler » remet aussi ce paragraphe sur sa page', [len(s['blocs']) for s in article(pg)['slides']] == [len(s['blocs']) for s in a0['slides']])
    # Logo et fleurs : sur la première page qui en a, en bas à droite
    def aller_a(k):
        for _ in range(12):
            cur = int(gf.locator('.gf-compteur').inner_text().split('/')[0]) - 1
            if cur == k: return
            gf.get_by_role('button', name='Page suivante' if cur < k else 'Page précédente').click(); pg.wait_for_timeout(150)
    trouve = None
    for k in range(len(a0['slides'])):
        aller_a(k); tout_choisir()
        tete = gf.locator('.gf-agent').inner_text().split('\n')[0:3]
        tete = ' '.join(tete)
        for nom in ('fleurs', 'logo'):
            if '· ' + nom in tete or ' et ' + nom in tete: trouve = (k, nom); break
        if trouve: break
    verifie('une page a du logo ou des fleurs, et la zone les choisit', trouve is not None)
    if trouve:
        k, nom = trouve
        t = demander(pg, 'Mets les ' + nom + ' en bas à droite')
        a6 = article(pg)
        im = next((i for i in (a6['slides'][k].get('images') or []) if i['type'] == nom), None)
        verifie(nom + ' : placé(es) en bas à droite, dans les marges', im is not None and abs((im['x'] + im['w']) * 1080 - (1080 - 81)) < 2, im)
        verifie(nom + ' : la page ne passe pas en mise en page libre', not a6['slides'][k].get('libre'))
    aller_a(0)
    # Le premier paragraphe de la première page ne peut pas aller sur une page précédente
    tout_choisir()
    t = demander(pg, 'Envoie ce paragraphe sur la page précédente')
    verifie('pas de page précédente : refus expliqué', 'pas de page précédente' in t or 'seul paragraphe' in t, t[-300:])
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
