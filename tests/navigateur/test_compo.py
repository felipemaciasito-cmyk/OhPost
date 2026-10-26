from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
NB = '\u00a0'
v = lambda s: s.replace(NB, '⍽').replace('\n', '⏎')
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1000)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.mouse.click(600, 590); pg.wait_for_timeout(250); pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    ed = pg.locator('.editeur-bloc')
    texte = lambda: ed.evaluate('(el) => el.innerText')
    ed.evaluate('(el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }')
    pg.keyboard.type(' "Oui" !', delay=40); pg.wait_for_timeout(200)
    t = texte()
    verifie('slide : guillemets et espaces corrigés', t.endswith('travail. «' + NB + 'Oui' + NB + '»' + NB + '!'), v(t))
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('slide : message', 'espace insécable avant « ! »' in msg, msg)
    pg.keyboard.type(' Fin', delay=40); pg.wait_for_timeout(200)
    t = texte()
    verifie('slide : curseur resté au bon endroit', t.endswith('»' + NB + '! Fin'), v(t))
    # Annuler depuis le message (la dernière correction : l'espace avant !)
    pg.locator('.message button', has_text='Annuler').click(); pg.wait_for_timeout(250)
    # Toucher le message referme l'écriture (comme tout clic hors de la page) : on rouvre le paragraphe
    pg.mouse.click(600, 590); pg.wait_for_timeout(250)
    if not ed.count(): pg.mouse.click(600, 590); pg.wait_for_timeout(300)
    t = texte() if ed.count() else '(éditeur fermé)'
    verifie('slide : Annuler ne défait que la dernière correction', t.endswith('»' + ' ! Fin'), v(t))
    # Retours à la ligne de mise en page conservés
    verifie('slide : retours à la ligne gardés', t.startswith('Pourtant,\nj’adore mon\ntravail.'), v(t))
    # Le texte de l'article a suivi
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(400)
    val = pg.locator('textarea.editeur-zone').input_value()
    verifie('article : texte suivi', 'Pourtant, j’adore mon travail. «' + NB + 'Oui' + NB + '» ! Fin' in val, v(val[:120]))
    carte = pg.locator('section.carte', has_text='Typographie').inner_text()
    verifie('carte : la correction annulée est proposée', 'Reste 1 correction : espace insécable avant « ! »' in carte, carte)
    # Vérifier : aucune alerte d'intégrité
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(500)
    verifier = pg.locator('button', has_text='Vérifier').first.inner_text()
    pg.locator('button', has_text='Vérifier').first.click(); pg.wait_for_timeout(300)
    pg.screenshot(path='verifier.png')
    panneau = pg.locator('body').inner_text()
    verifie('aucun texte perdu ni ajouté', 'absent' not in panneau.lower() and 'ajouté' not in panneau.lower(), panneau[-400:])
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
