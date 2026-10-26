from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
NB = '\u00a0'
v = lambda s: s.replace(NB, '⍽').replace('\n', '⏎')
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
BRUT = 'Pourquoi partir?\n\nElle m\'a dit : "je reste"... Et toi ?'
CORR = 'Pourquoi partir' + NB + '?\n\nElle m’a dit' + NB + ': «' + NB + 'je reste' + NB + '»… Et toi' + NB + '?'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1000)
    # Nouvel article : collage
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(300)
    zone = pg.locator('#texte-modele'); zone.click()
    pg.keyboard.insert_text(BRUT); pg.wait_for_timeout(150)
    verifie('nouvel article : collage corrigé', zone.input_value() == CORR, v(zone.input_value()))
    note = pg.locator('main p[role=status]').inner_text()
    verifie('nouvel article : correction annoncée', note.startswith('Typographie corrigée : 7 corrections'), note)
    verifie('nouvel article : curseur à la fin', zone.evaluate('(el) => el.selectionStart') == len(CORR))
    pg.locator('main p[role=status] button', has_text='Annuler').click(); pg.wait_for_timeout(150)
    verifie('nouvel article : Annuler rend le texte collé', zone.input_value() == BRUT, v(zone.input_value()))
    # Frappe : seule la zone tapée est corrigée
    zone.click(); zone.evaluate('(el) => el.setSelectionRange(el.value.length, el.value.length)'); pg.keyboard.type(" C'est tout!", delay=30); pg.wait_for_timeout(150)
    verifie('nouvel article : frappe corrigée, collage annulé intact', zone.input_value() == BRUT + ' C’est tout' + NB + '!', v(zone.input_value()))
    # Recoller en entier puis créer
    zone.evaluate('(el) => el.select()'); pg.keyboard.insert_text(BRUT); pg.wait_for_timeout(150)
    verifie('nouvel article : recollage corrigé', zone.input_value() == CORR, v(zone.input_value()))
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300); _q = pg.get_by_role('dialog', name='Ton nouvel article'); _q.get_by_role('button', name='Portrait · 4:5').click(); _q.get_by_role('button', name='Commencer').click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='Texte').first.click(); pg.wait_for_timeout(300)
    val = pg.locator('textarea.editeur-zone').input_value()
    verifie('article créé avec le texte corrigé', val == CORR, v(val))
    carte = pg.locator('section.carte', has_text='Typographie').inner_text()
    verifie('article créé conforme', 'Ton article respecte ces règles' in carte, carte)
    # Remplacer tout le texte : à l'étape Texte, tout sélectionner puis coller
    z2 = pg.locator('textarea.editeur-zone'); z2.click(); pg.keyboard.press('Control+a'); pg.keyboard.insert_text('Un "essai"... ok?'); pg.wait_for_timeout(400)
    val = pg.locator('textarea.editeur-zone').input_value()
    verifie('remplacer : texte de l’article corrigé', val == 'Un «' + NB + 'essai' + NB + '»… ok' + NB + '?', v(val))
    pg.screenshot(path='texte.png', full_page=False)
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
