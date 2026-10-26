# Repères pendant le déplacement d'un bloc : alignements, marges standard, écarts égaux avec valeur.
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 900})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(400)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(800)
    # Repère des marges affiché à la demande : 81 / 81 / 110 / 110
    pg.locator('.menus-composition .titre-menu').filter(has_text='Affichage').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitemcheckbox', name='Afficher les marges de texte').first.click() if pg.get_by_role('menuitemcheckbox', name='Afficher les marges de texte').count() else pg.get_by_text('Afficher les marges de texte').click()
    pg.wait_for_timeout(300)
    st = pg.locator('.repere-marges').first.evaluate('e => [e.style.left, e.style.top, e.style.width, e.style.height, e.parentElement.style.width]')
    verifie('repère des marges : 81 à gauche et à droite, 110 en haut et en bas', st[0] == '81px' and st[1] == '110px' and st[2] == '918px', st)
    pg.locator('.menus-composition .titre-menu').filter(has_text='Affichage').first.click(); pg.wait_for_timeout(200)
    pg.get_by_text('Afficher les marges de texte').click(); pg.wait_for_timeout(300)
    # Page 2 : un bloc de texte
    cal = pg.locator('.calque').nth(1); cal.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    bb = cal.bounding_box(); k = bb['width'] / 1080
    # Premier texte de la page (les pages équilibrées ne le posent plus tout en haut) : lu sur la toile.
    y_texte = pg.locator('canvas[aria-label="Page 2"]').evaluate("c => { const g = c.getContext('2d'); const W = c.width, H = c.height; const f = g.getImageData(2, 2, 1, 1).data; for (let y = Math.round(H * 0.08); y < H; y += 2) { const d = g.getImageData(Math.round(W * 0.1), y, Math.round(W * 0.6), 1).data; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - f[0]) + Math.abs(d[i + 1] - f[1]) + Math.abs(d[i + 2] - f[2]) > 120) return y / H; } return 0.2; }")
    pg.mouse.click(bb['x'] + 200 * k, bb['y'] + bb['height'] * y_texte + 12 * k); pg.wait_for_timeout(300)
    sel = pg.locator('.selection-bloc')
    verifie('bloc sélectionné', sel.count() == 1)
    s0 = sel.bounding_box()
    # Glisser lentement vers la droite et le bas, en restant près de la marge gauche (5 points à l'écran)
    x0, y0 = s0['x'] + s0['width'] / 2, s0['y'] + s0['height'] / 2
    pg.mouse.move(x0, y0); pg.mouse.down()
    pg.mouse.move(x0 + 40, y0 + 60, steps=8); pg.mouse.move(x0 + 5 * k * 1.0, y0 + 120 * k, steps=8); pg.wait_for_timeout(150)
    lignes = pg.locator('.repere-ligne').count()
    marge_visible = pg.locator('.repere-marges').count() == 1
    pg.screenshot(path='reperes-glisser.png')
    verifie('pendant le glisser : repère des marges et lignes d’alignement', marge_visible and lignes >= 1, (marge_visible, lignes))
    gauche = pg.locator('.repere-ligne.v').evaluate_all('l => l.map(e => parseFloat(e.style.left))')
    verifie('ligne de la marge gauche (81)', 81 in gauche, gauche)
    pg.mouse.up(); pg.wait_for_timeout(400)
    verifie('lignes effacées au lâcher', pg.locator('.repere-ligne, .repere-ecart').count() == 0)
    s1 = pg.locator('.selection-bloc').bounding_box()
    # .selection-bloc = boîte - 8 : son bord gauche est à 81 - 8 = 73 points de la page
    verifie('bloc aimanté sur la marge gauche', abs((s1['x'] - bb['x']) / k - 73) < 1.5, round((s1['x'] - bb['x']) / k, 1))
    verifie('le texte du bloc est passé en placement libre', pg.get_by_text('Mise en page libre').count() >= 1)
    # Écarts égaux : le bloc du milieu, glissé un peu, revient à égale distance de ses voisins, valeurs affichées
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.mouse.click(5, 300); pg.wait_for_timeout(200)
    bb = cal.bounding_box()
    # Le bloc du milieu : sous le premier bloc sélectionné puis désélectionné
    pg.mouse.click(bb['x'] + 200 * k, bb['y'] + bb['height'] * y_texte + 12 * k); pg.wait_for_timeout(300)
    s_a = pg.locator('.selection-bloc').bounding_box()
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.mouse.click(bb['x'] + 300 * k, s_a['y'] + s_a['height'] + 40 * k); pg.wait_for_timeout(300)
    s2 = pg.locator('.selection-bloc').bounding_box()
    x0, y0 = s2['x'] + s2['width'] / 2, s2['y'] + s2['height'] / 2
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 30, y0 + 30, steps=6); pg.mouse.move(x0 + 200 * k, y0 + 4 * k, steps=8); pg.wait_for_timeout(150)
    vals = pg.locator('.repere-ecart .repere-valeur').all_inner_texts()
    pg.screenshot(path='reperes-ecarts.png')
    verifie('écarts égaux montrés avec leur valeur', len(vals) == 2 and vals[0] == vals[1] and int(vals[0]) > 0, vals)
    pg.mouse.up(); pg.wait_for_timeout(400)
    s3 = pg.locator('.selection-bloc').bounding_box()
    verifie('bloc resté à égale distance (hauteur inchangée)', abs(s3['y'] - s2['y']) < 1.5, (s2['y'], s3['y']))
    # Les fleurs s'aimantent aussi : insérées, puis glissées à 6 points du centre de la page
    pg.get_by_role('button', name='Insertion', exact=True).click(); pg.wait_for_timeout(150)
    pg.get_by_role('menuitem', name='Fleurs', exact=True).click(); pg.wait_for_timeout(400)
    si = pg.locator('.selection-image')
    verifie('fleurs insérées et choisies', si.count() == 1)
    cq = si.evaluate('e => { const r = e.closest(".calque").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }')
    kd = cq['w'] / 1080
    b0 = si.bounding_box(); cx, cy = b0['x'] + b0['width'] / 2, b0['y'] + b0['height'] - 6
    cible_x = cq['x'] + (540 + 6) * kd
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 20, cy - 20, steps=5); pg.mouse.move(cible_x, cy - 30, steps=8); pg.wait_for_timeout(150)
    centre = pg.locator('.repere-ligne.v').evaluate_all('l => l.map(e => parseFloat(e.style.left))')
    verifie('fleurs : ligne du centre de la page pendant le glisser', 540 in centre, centre)
    pg.mouse.up(); pg.wait_for_timeout(400)
    b1 = pg.locator('.selection-image').bounding_box()
    verifie('fleurs centrées (aimantées)', abs((b1['x'] + b1['width'] / 2 - cq['x']) / kd - 540) < 2, round((b1['x'] + b1['width'] / 2 - cq['x']) / kd, 1))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
