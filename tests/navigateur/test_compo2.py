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
    ed = pg.locator('.editeur-bloc')
    def ouvrir(x, y):
        pg.mouse.click(x, y); pg.wait_for_timeout(250)
        if not ed.count(): pg.mouse.click(x, y); pg.wait_for_timeout(300)
    def coller(texte):
        ed.evaluate('''(el, t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', texte)
        pg.wait_for_timeout(250)
    # 1. Coller par-dessus tout le paragraphe un texte presque identique (titre de couverture)
    ouvrir(600, 400)
    avant = ed.evaluate('(el) => el.innerText')
    ed.evaluate('(el) => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }')
    coller('Je crois que\nje vais "démissionner"!')
    t = ed.evaluate('(el) => el.innerText')
    verifie('collage sur la page corrigé', t == 'Je crois que\nje vais «' + NB + 'démissionner' + NB + '»' + NB + '!', v(avant) + ' → ' + v(t))
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('collage annoncé', '3 corrections' in msg, msg)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.mouse.click(1100, 500); pg.wait_for_timeout(200)
    # 2. Paragraphe sans lien : slide dupliquée
    pg.get_by_role('button', name='Page', exact=True).click(); pg.wait_for_timeout(200)
    pg.get_by_text('Dupliquer la page').click(); pg.wait_for_timeout(600)
    pg.screenshot(path='dup.png')
    # La copie est la page 2 : on la fait défiler, puis on ouvre son titre
    pages = pg.locator('canvas')
    boite = pages.nth(1).bounding_box()
    print('slide 2 :', boite)
    pg.mouse.wheel(0, 0)
    pages.nth(1).scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    boite = pages.nth(1).bounding_box()
    ouvrir(boite['x'] + boite['width'] * 0.4, boite['y'] + boite['height'] * 0.3)
    verifie('éditeur ouvert sur la copie', ed.count() == 1)
    ed.evaluate('(el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }')
    pg.keyboard.type(" C'est", delay=40); pg.wait_for_timeout(200)
    t = ed.evaluate('(el) => el.innerText')
    verifie('copie : apostrophe corrigée', t.endswith(' C’est'), v(t))
    pg.locator('.message button', has_text='Annuler').click(); pg.wait_for_timeout(250)
    boite = pages.nth(1).bounding_box(); ouvrir(boite['x'] + boite['width'] * 0.4, boite['y'] + boite['height'] * 0.3)
    t = ed.evaluate('(el) => el.innerText') if ed.count() else '(fermé)'
    verifie('copie : Annuler rend l’apostrophe droite', t.endswith(" C'est"), v(t))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(300)
    val = pg.locator('textarea.editeur-zone').input_value()
    verifie('le texte de l’article ne reçoit pas le texte de la copie', "C'est" not in val and 'C’est' not in val.split('\n\n')[0], v(val[:80]))
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
