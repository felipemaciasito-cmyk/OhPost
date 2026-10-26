from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
NB = '\u00a0'
v = lambda s: s.replace(NB, '⍽')
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1200)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(500)
    zone = pg.locator('textarea.editeur-zone')
    carte = lambda: pg.locator('section.carte', has_text='Typographie').inner_text()
    verifie('carte : article conforme au départ', 'Ton article respecte ces règles' in carte(), carte())
    # 1. Frappe au bout du 3e paragraphe
    val = zone.input_value(); fin3 = val.index('presque plus.') + len('presque plus.')
    zone.click(); zone.evaluate(f'(el) => el.setSelectionRange({fin3}, {fin3})')
    pg.keyboard.type(' Vraiment?', delay=30); pg.wait_for_timeout(150)
    val = zone.input_value()
    verifie('frappe : espace insécable ajoutée', 'presque plus. Vraiment' + NB + '?' in val, v(val[fin3-5:fin3+20]))
    pos = zone.evaluate('(el) => el.selectionStart')
    verifie('frappe : curseur juste après « ? »', pos == fin3 + len(' Vraiment' + NB + '?'), f'{pos} vs {fin3 + 11}')
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('message annoncé', 'Typographie corrigée : espace insécable avant « ? »' in msg, msg)
    pg.keyboard.type(' Oui', delay=30); pg.wait_for_timeout(150)
    val = zone.input_value()
    verifie('suite de frappe au bon endroit', 'Vraiment' + NB + '? Oui\n' in val, v(val[fin3:fin3+25]))
    # 2. Annuler depuis le message, après avoir continué d'écrire
    pg.locator('.message button', has_text='Annuler').click(); pg.wait_for_timeout(200)
    val = zone.input_value()
    verifie('Annuler : seule la correction est défaite', 'Vraiment? Oui\n' in val, v(val[fin3:fin3+25]))
    verifie('carte : 1 correction restante', 'Reste 1 correction : espace insécable avant « ? »' in carte(), carte())
    # 3. Écrire ailleurs ne refait pas la correction annulée
    zone.click(); zone.evaluate('(el) => el.setSelectionRange(0, 0)'); pg.keyboard.type('X', delay=30); pg.wait_for_timeout(150)
    val = zone.input_value()
    verifie('correction annulée pas refaite', 'Vraiment? Oui' in val and val.startswith('XJe crois'), v(val[:20]))
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(150)
    # 4. Collage
    zone.evaluate('(el) => el.setSelectionRange(el.value.length, el.value.length)')
    pg.keyboard.insert_text('\n\nElle dit "merci" puis... rien. C\'est fini!'); pg.wait_for_timeout(200)
    val = zone.input_value()
    attendu = 'Elle dit «' + NB + 'merci' + NB + '» puis… rien. C’est fini' + NB + '!'
    verifie('collage corrigé', val.endswith(attendu), v(val[-60:]))
    verifie('collage : curseur à la fin', zone.evaluate('(el) => el.selectionStart') == len(val))
    msg = pg.locator('.message').inner_text()
    verifie('collage annoncé', '5 corrections (espace insécable, guillemets « », apostrophe ’, points de suspension …)' in msg, msg)
    # 5. Bouton « Corriger la typographie »
    pg.locator('section.carte', has_text='Typographie').get_by_role('button', name='Corriger la typographie').click(); pg.wait_for_timeout(200)
    val = zone.input_value()
    verifie('bouton : article corrigé', 'Vraiment' + NB + '? Oui' in val)
    verifie('carte : conforme après correction', 'Ton article respecte ces règles' in carte(), carte())
    # 6. ⌘Z / Ctrl+Z défait le bouton
    pg.locator('body').click(position={'x': 5, 'y': 400}); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    verifie('Ctrl+Z défait la correction globale', 'Vraiment? Oui' in zone.input_value())
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(200)
    # 7. Les slides suivent : étape Composition
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.screenshot(path='compo.png')
    print('erreurs JS :', erreurs)
    verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
