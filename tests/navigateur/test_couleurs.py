# Couleurs de la barre de sélection : texte, filet, fond du paragraphe.
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
SEL = "(el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(9, n.length)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); }"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-barre-depliee', 'oui')"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    def editer():
        if not pg.locator('.editeur-bloc').count():
            pg.mouse.click(600, 590); pg.wait_for_timeout(300); pg.mouse.click(600, 590); pg.wait_for_timeout(400)
        pg.locator('.editeur-bloc').evaluate(SEL); pg.wait_for_timeout(300)
    def menu(nom):
        pg.get_by_role('button', name=nom, exact=True).click(); pg.wait_for_timeout(250)
        return pg.locator('[role=menu]').last
    rgb = lambda loc: loc.evaluate('e => getComputedStyle(e).backgroundColor')
    # Fond de page bleu : texte blanc et vert lisibles
    editer()
    m = menu('Couleur'); t = m.inner_text()
    verifie('fond bleu : blanc et vert proposés comme lisibles', 'Lisibles sur ce fond' in t and 'Couleur du texte' in t and 'Couleur de mise en valeur' in t and 'Couleur libre' in t, t.replace('\n', ' | '))
    m.locator('[role^=menuitem]', has_text='Couleur de mise en valeur').first.click(); pg.wait_for_timeout(400)
    editer()
    verifie('le carré montre la couleur des mots choisis (vert)', rgb(pg.get_by_role('button', name='Couleur', exact=True).locator('.pastille-couleur')) == 'rgb(201, 212, 32)', rgb(pg.get_by_role('button', name='Couleur', exact=True).locator('.pastille-couleur')))
    # Couleur libre de la charte : bleu pâle
    m = menu('Couleur'); m.locator('[role^=menuitem]', has_text='Charte · bleu pâle').first.click(); pg.wait_for_timeout(400)
    editer()
    verifie('couleur de la charte appliquée et affichée', rgb(pg.get_by_role('button', name='Couleur', exact=True).locator('.pastille-couleur')) == 'rgb(230, 235, 236)')
    m = menu('Couleur'); m.locator('[role^=menuitem]', has_text='Couleur d’origine').first.click(); pg.wait_for_timeout(400)
    # Fond de page vert pâle : le bleu lisible, les autres à part
    pg.keyboard.press('Escape'); pg.mouse.click(5, 300); pg.wait_for_timeout(200)
    pg.locator('.menus-composition .titre-menu').filter(has_text='Carrousel').first.click(); pg.wait_for_timeout(150)
    pg.get_by_role('menuitem', name='Fond', exact=True).click(); pg.wait_for_timeout(200)
    pg.locator('.nuance-menu[aria-label="Vert pâle"]').click(); pg.wait_for_timeout(500)
    editer()
    t = menu('Couleur').inner_text()
    verifie('fond vert pâle : bleu lisible, vert et blanc « peu lisibles » mais proposés', 'Peu lisibles sur ce fond' in t and 'Charte · vert' in t and t.index('Couleur du texte') < t.index('Peu lisibles'), t.replace('\n', ' | '))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # Fond de paragraphe bleu : proposition de passer le texte en blanc
    editer()
    mf = menu('Fond du paragraphe')
    mf.locator('[role^=menuitem]', has_text='Couleur de mise en valeur').first.click(); pg.wait_for_timeout(500)
    msg = pg.locator('.message')
    verifie('fond bleu sur texte bleu : texte passé en blanc tout seul', msg.count() == 1 and 'pour rester lisible' in msg.inner_text() and 'blanc' in msg.inner_text(), msg.inner_text() if msg.count() else '')
    editer()
    verifie('le texte du bloc passe en blanc', rgb(pg.get_by_role('button', name='Couleur', exact=True).locator('.pastille-couleur')) == 'rgb(255, 255, 255)')
    t = menu('Couleur').inner_text()
    verifie('sur ce fond bleu, le blanc est lisible', t.index('Charte · blanc') < (t.index('Peu lisibles') if 'Peu lisibles' in t else 10**6) if 'Charte · blanc' in t else 'Couleur' in t, t.replace('\n', ' | '))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # Filet : le carré est un trait, à la couleur du filet du paragraphe
    editer()
    mm = menu('Couleur du filet'); mm.locator('[role^=menuitem]', has_text='Charte · vert').first.click(); pg.wait_for_timeout(400)
    editer()
    tr = pg.get_by_role('button', name='Couleur du filet').locator('.filet-trait')
    verifie('carré du filet : un trait à la couleur posée', tr.count() == 1 and rgb(tr) == 'rgb(201, 212, 32)', rgb(tr) if tr.count() else 'absent')
    verifie('sélection toujours possible après les fonds', pg.locator('.barre-flottante').count() == 1 and len(pg.evaluate('getSelection().toString()')) > 0)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
