# Barre de menus de la Mise en page, retravaillée avec Romain : Édition, Affichage, Insertion, Bloc, Page, Réglages (plus de Format).
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 900})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    if pg.get_by_role('dialog', name='Apparence générale', exact=True).count(): pg.get_by_role('dialog', name='Apparence générale', exact=True).locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    article = lambda: (pg.wait_for_timeout(900), next(a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail'))[1]
    noms = pg.locator('.menus-composition .titre-menu').all_inner_texts()
    verifie('menus : Édition, Affichage, Insertion, Bloc, Page, Réglages', noms == ['Édition', 'Affichage', 'Insertion', 'Bloc', 'Page', 'Réglages'], noms)
    def menu(nom):
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
        pg.locator('.menus-composition .titre-menu').filter(has_text=nom).first.click(); pg.wait_for_timeout(250)
        return pg.locator('.popover-menu').last.inner_text()
    t = menu('Édition')
    verifie('Édition : plus de « Tout sélectionner »', 'Tout sélectionner' not in t and 'Sélectionner tous les blocs' not in t and 'Annuler' in t and 'Coller' in t, t)
    t = menu('Insertion')
    verifie('Insertion : plus de « Bloc de texte » ni de note du double-clic', 'Bloc de texte' not in t and 'double-clique' not in t and 'Nouveau paragraphe' in t and 'Logo' in t, t)
    t = menu('Réglages')
    verifie('« Carrousel » s’appelle « Réglages », même contenu', all(x in t for x in ('Fond', 'Dimensions', 'Réseau', 'Logo')), t)
    pg.keyboard.press('Escape')
    # Le menu Page ne montre plus le numéro de la page
    pg.locator('.page-slide[data-index="2"]').scroll_into_view_if_needed(); pg.locator('.page-slide[data-index="2"] .reperes').click(); pg.wait_for_timeout(300)
    verifie('page 3 active : le menu s’appelle toujours « Page »', pg.locator('.menus-composition .titre-menu').filter(has_text='Page').first.inner_text() == 'Page' and pg.locator('.historique-menus .position').inner_text().startswith('Page 3'))
    t = menu('Page')
    verifie('le menu Page agit toujours sur la page active', 'Dupliquer la page' in t, t[:120])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # Bloc › Fond du paragraphe, sur le bloc choisi
    pg.locator('.page-slide[data-index="0"]').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    cal = pg.locator('.page-slide[data-index="0"] .calque').bounding_box()
    barre = pg.locator('.barre-blocs')
    for y in range(20, 90, 4):
        pg.mouse.click(cal['x'] + cal['width'] * 0.3, cal['y'] + cal['height'] * y / 100); pg.wait_for_timeout(250)
        if barre.count(): break
        pg.mouse.click(5, 450); pg.wait_for_timeout(250)
    verifie('un bloc choisi', barre.count() == 1)
    n = int(pg.locator('.selection-bloc').first.get_attribute('data-bloc'))
    ic = lambda: barre.get_by_role('button', name='Fond du paragraphe', exact=True).evaluate("(b) => { const r = b.querySelector('svg rect'); return r.getAttribute('fill') === 'none' ? 'pointillé' : r.getAttribute('fill'); }")
    verifie('barre des blocs : bouton « Fond du paragraphe » (44 points), en pointillé sans fond', barre.get_by_role('button', name='Fond du paragraphe', exact=True).bounding_box()['height'] >= 44 and ic() == 'pointillé', ic())
    pg.locator('.menus-composition .titre-menu').filter(has_text='Bloc').first.click(); pg.wait_for_timeout(250)
    pg.get_by_role('menuitem', name='Fond du paragraphe').click(); pg.wait_for_timeout(250)
    m = pg.locator('.popover-menu').last
    verifie('menu Bloc › Fond du paragraphe : les couleurs', 'Couleur libre' in m.inner_text() and m.get_by_role('menuitem', name='Charte · bleu pâle', exact=True).count() == 1, m.inner_text()[:200])
    m.get_by_role('menuitem', name='Charte · bleu pâle', exact=True).click(); pg.wait_for_timeout(400)
    fb = article()['slides'][0]['blocs'][n].get('fondBloc')
    verifie('le paragraphe entier prend ce fond', isinstance(fb, dict) and str(fb.get('couleur')).upper() == '#E6EBEC', fb)
    if not barre.count():
        for y in range(20, 90, 4):
            pg.mouse.click(cal['x'] + cal['width'] * 0.3, cal['y'] + cal['height'] * y / 100); pg.wait_for_timeout(250)
            if barre.count(): break
    verifie('l’icône du bouton montre la couleur du fond', str(ic()).upper() == '#E6EBEC', ic())
    barre.get_by_role('button', name='Fond du paragraphe', exact=True).click(); pg.wait_for_timeout(250)
    pg.locator('.popover-menu').last.locator('[role^=menuitem]', has_text='Charte · vert pâle').first.click()  # cochables : un fond est déjà posé; pg.wait_for_timeout(400)
    fb2 = article()['slides'][0]['blocs'][n].get('fondBloc')
    verifie('la barre des blocs change aussi la couleur du fond', isinstance(fb2, dict) and str(fb2.get('couleur')).upper() == '#F3F6CE', fb2)
    verifie('aucune erreur JavaScript', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
