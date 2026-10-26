# Le texte suit le fond, sélection lisible, boutons sous l'aperçu d'Apparence générale.
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
    # Sélection sur fond bleu : aplat vert anis, texte bleu foncé
    pg.mouse.click(600, 590); pg.wait_for_timeout(300); pg.mouse.click(600, 590); pg.wait_for_timeout(400)
    ed = pg.locator('.editeur-bloc')
    v = ed.evaluate("e => [getComputedStyle(e).getPropertyValue('--sel-fond').trim(), getComputedStyle(e).getPropertyValue('--sel-texte').trim()]")
    verifie('fond sombre : sélection en aplat vert anis, texte bleu foncé', v == ['#C9D420', '#12313A'], v)
    # Le texte en blanc (choix explicite), puis la page passe en fond blanc : le texte doit redevenir lisible tout seul
    ed.evaluate(SEL); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Couleur', exact=True).click(); pg.wait_for_timeout(200)
    pg.locator('[role=menu]').last.locator('[role^=menuitem]', has_text='Charte · bleu pâle').first.click(); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.mouse.click(5, 300); pg.wait_for_timeout(300)
    pg.locator('.menus-composition .titre-menu').filter(has_text='Carrousel').first.click(); pg.wait_for_timeout(150)
    pg.get_by_role('menuitem', name='Fond', exact=True).click(); pg.wait_for_timeout(200)
    pg.locator('.nuance-menu[aria-label="Blanc"]').click(); pg.wait_for_timeout(700)
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('fond devenu clair : le texte bleu pâle repasse en bleu foncé tout seul, annulable', 'pour rester lisible' in msg and 'Annuler' in msg, msg)
    pg.mouse.click(600, 590); pg.wait_for_timeout(300); pg.mouse.click(600, 590); pg.wait_for_timeout(400)
    v = pg.locator('.editeur-bloc').evaluate("e => [getComputedStyle(e).getPropertyValue('--sel-fond').trim(), getComputedStyle(e).getPropertyValue('--sel-texte').trim(), getComputedStyle(e).color]")
    verifie('fond clair : sélection en aplat bleu foncé, texte blanc ; texte du bloc foncé', v[0] == '#003846' and v[1] == '#FFFFFF' and v[2] != 'rgb(255, 255, 255)', v)
    pg.keyboard.press('Escape'); pg.mouse.click(5, 300); pg.wait_for_timeout(300)
    # Apparence générale : les deux boutons sous l'aperçu, l'un au-dessus de l'autre
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    zone = pg.locator('[role=dialog] .mep-apercu .mep-actions-apercu')
    bts = zone.get_by_role('button').all_inner_texts() if zone.count() else []
    verifie('plus de bouton « Aperçu du post » sous l’aperçu', 'Aperçu du post' not in bts and pg.locator('[role=dialog] .page-cliquable').count() == 1, bts)
    if zone.count() and zone.get_by_role('button').count() >= 2:
        a = zone.get_by_role('button').nth(0).bounding_box(); c = zone.get_by_role('button').nth(1).bounding_box()
        verifie('l’un au-dessus de l’autre', c['y'] > a['y'] + a['height'] - 1 and abs(c['x'] - a['x']) < 2, (a, c))
    verifie('plus dans la colonne de droite', pg.locator('[role=dialog] .mep-infos').get_by_role('button', name='Aperçu du post').count() == 0)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
