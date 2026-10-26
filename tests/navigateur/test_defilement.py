from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
def lt(route):
    r = route.request
    cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
    texte = dict(x.split('=', 1) for x in r.post_data.split('&')).get('text', '')
    from urllib.parse import unquote_plus
    t = unquote_plus(texte); pos = t.rfind('autres')
    return route.fulfill(status=200, headers=cors, body=json.dumps({'matches': [{'offset': pos, 'length': 6, 'message': 'Faute simulée', 'replacements': [{'value': 'autres'}], 'context': {'text': t[max(0,pos-20):pos+20], 'offset': 20, 'length': 6}, 'rule': {'id': 'X', 'issueType': 'misspelling'}}]}))
with sync_playwright() as p:
    b = p.chromium.launch()
    for (l, ht) in ((1180, 820), (1024, 700)):
        print(f'--- iPad {l}×{ht}')
        pg = b.new_page(viewport={'width': l, 'height': ht})
        erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
        pg.route('https://api.languagetool.org/**', lt)
        pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
        pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(700)
        info = lambda: pg.evaluate("""() => { const c = document.querySelector('.colonne-principale'), p = document.querySelector('.defilement-separe > .panneau'), pied = document.querySelector('.pied-etapes').getBoundingClientRect();
            return { doc: document.documentElement.scrollHeight - innerHeight, fenetre: scrollY, texte: c.scrollTop, texteMax: c.scrollHeight - c.clientHeight, panneau: p.scrollTop, panneauMax: p.scrollHeight - p.clientHeight, basCadre: Math.round(document.querySelector('.defilement-separe').getBoundingClientRect().bottom), hautPied: Math.round(pied.top) }; }""")
        i0 = info(); print(i0)
        verifie('la page elle-même ne défile pas', i0['doc'] <= 0, i0)
        verifie('le texte a sa propre barre de défilement', i0['texteMax'] > 0, i0)
        verifie('la zone s’arrête au-dessus du pied', i0['basCadre'] <= i0['hautPied'], i0)
        panneau = pg.locator('.defilement-separe > .panneau').bounding_box(); texte = pg.locator('.colonne-principale').bounding_box()
        # Molette sur le panneau de droite
        pg.mouse.move(panneau['x'] + panneau['width'] / 2, panneau['y'] + 200)
        for _ in range(6): pg.mouse.wheel(0, 400); pg.wait_for_timeout(120)
        i1 = info()
        verifie('molette à droite : le texte ne bouge pas', i1['texte'] == 0 and i1['fenetre'] == 0, i1)
        if i0['panneauMax'] > 0: verifie('molette à droite : le panneau défile', i1['panneau'] > 0, i1)
        # Molette sur le texte
        pg.mouse.move(texte['x'] + texte['width'] / 2, texte['y'] + 300)
        for _ in range(3): pg.mouse.wheel(0, 400); pg.wait_for_timeout(120)
        i2 = info()
        verifie('molette sur le texte : le texte défile', i2['texte'] > 0, i2)
        verifie('molette sur le texte : le panneau ne bouge pas', i2['panneau'] == i1['panneau'] and i2['fenetre'] == 0, i2)
        # Frappe tout en bas : le curseur reste visible
        zone = pg.locator('textarea.editeur-zone'); zone.click(); zone.evaluate('(el) => el.setSelectionRange(el.value.length, el.value.length)')
        pg.keyboard.type(' Fin.', delay=20); pg.wait_for_timeout(300)
        i3 = pg.evaluate("""() => { const z = document.querySelector('textarea.editeur-zone').getBoundingClientRect(), c = document.querySelector('.colonne-principale').getBoundingClientRect(); const pad = parseFloat(getComputedStyle(document.querySelector('textarea.editeur-zone')).paddingBottom); return { derniereLigne: Math.round(z.bottom - pad - 4), basColonne: Math.round(c.bottom), hautColonne: Math.round(c.top) }; }""")
        verifie('frappe en fin de texte : la dernière ligne reste visible', i3['hautColonne'] < i3['derniereLigne'] <= i3['basColonne'], i3)
        # Montrer une faute (LanguageTool simulé)
        pg.evaluate("document.querySelector('.colonne-principale').scrollTop = 0"); pg.wait_for_timeout(200)
        pg.get_by_role('button', name='Vérifier').click(); pg.wait_for_timeout(600)
        pg.get_by_role('button', name='Montrer dans le texte').first.click(); pg.wait_for_timeout(900)
        r = pg.evaluate("""() => { const m = document.querySelector('mark.active').getBoundingClientRect(), c = document.querySelector('.colonne-principale').getBoundingClientRect(); return { m: Math.round(m.top), haut: Math.round(c.top), bas: Math.round(c.bottom), fenetre: scrollY }; }""")
        verifie('« Montrer dans le texte » amène la faute dans la colonne', r['haut'] < r['m'] < r['bas'] and r['fenetre'] == 0, r)
        pg.screenshot(path=f'defilement-{l}.png')
        verifie('aucune erreur JavaScript', not erreurs, erreurs)
        pg.close()
    # Téléphone / fenêtre étroite : la page défile normalement
    pg = b.new_page(viewport={'width': 680, 'height': 900})
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(700)
    d = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    verifie('fenêtre étroite : la page défile comme avant', d > 300, d)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
