# Barre des blocs sélectionnés : style de paragraphe, filet, fond, alignement du texte (dans « Aligner ») et « Revenir à l'original ».
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
LIRE = """() => new Promise((ok) => { const r = indexedDB.open('postsop-app'); r.onsuccess = () => { const t = r.result.transaction('fichiers').objectStore('fichiers').getAll(); t.onsuccess = () => ok(t.result.filter((e) => e.chemin.startsWith('articles/')).map((e) => JSON.parse(new TextDecoder().decode(e.octets)))); }; r.onerror = () => ok([]); })"""
def article(pg):
    pg.wait_for_timeout(1200)
    return next((a for a in pg.evaluate(LIRE) if a.get('titre') == 'Le silence au travail'), None)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    a0 = article(pg)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    # Page 2 : toucher le premier paragraphe pour le sélectionner (on descend jusqu'à trouver un bloc)
    page2 = pg.locator('.page-slide[data-index="1"]')
    page2.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    cal = page2.locator('.calque').bounding_box()
    barre = pg.locator('.barre-blocs')
    for k in range(3, 18):
        pg.mouse.click(cal['x'] + cal['width'] * 0.3, cal['y'] + cal['height'] * k / 20); pg.wait_for_timeout(250)
        if barre.count(): break
        pg.mouse.click(cal['x'] - 30, cal['y'] + 10); pg.wait_for_timeout(150)
    verifie('un bloc sélectionné : la barre apparaît', barre.count() == 1 and '1 bloc' in barre.inner_text())
    for nom in ['Style de paragraphe', 'Filet latéral', 'Fond du paragraphe', 'Revenir à l’original (effacer la mise en forme)']:
        bt = barre.get_by_role('button', name=nom, exact=True)
        verifie('bouton « ' + nom + ' » (44 points)', bt.count() == 1 and bt.bounding_box()['height'] >= 44)
    verifie('pas de bouton « Alignement » en double', barre.get_by_role('button', name='Alignement').count() == 0)
    def choisir_dans(nom_bouton, nom_choix):
        barre.get_by_role('button', name=nom_bouton, exact=True).click(); pg.wait_for_timeout(250)
        m = pg.locator('.popover-menu').last
        txt = m.inner_text()
        m.get_by_text(nom_choix, exact=True).first.click(); pg.wait_for_timeout(300)
        return txt
    def bloc_choisi():
        a = article(pg); return a['slides'][1]['blocs'], a
    # Style
    t = choisir_dans('Style de paragraphe', 'Citation')
    blocs, a = bloc_choisi()
    n = next(k for k, x in enumerate(blocs) if x.get('style') == 'citation' and a0['slides'][1]['blocs'][k].get('style') != 'citation') if any(x.get('style') == 'citation' and a0['slides'][1]['blocs'][k].get('style') != 'citation' for k, x in enumerate(blocs)) else None
    verifie('style : le menu propose les styles, « Citation » s’applique', 'Phrase-choc' in t and n is not None, t[:120])
    verifie('la barre reste là après un réglage', pg.locator('.barre-blocs').count() == 1)
    # Filet
    t = choisir_dans('Filet latéral', 'Filet de la charte')
    blocs, _ = bloc_choisi()
    verifie('filet : posé sur le paragraphe', blocs[n].get('filet') is True, json.dumps(blocs[n])[:200])
    # Fond
    t = choisir_dans('Fond du paragraphe', 'Couleur de mise en valeur')
    blocs, _ = bloc_choisi()
    verifie('fond : posé sur le paragraphe', isinstance(blocs[n].get('fondBloc'), dict), json.dumps(blocs[n].get('fondBloc')))
    # Alignement du texte, dans « Aligner »
    t = choisir_dans('Aligner', 'Texte centré')
    blocs, _ = bloc_choisi()
    verifie('« Aligner » propose aussi le texte dans le bloc', 'Le texte dans le bloc' in t.upper() or 'LE TEXTE DANS LE BLOC' in t.upper(), t[-150:])
    verifie('alignement du texte : centré', blocs[n].get('alignement') == 'centre', blocs[n].get('alignement'))
    # Revenir à l'original
    barre.get_by_role('button', name='Revenir à l’original (effacer la mise en forme)', exact=True).click(); pg.wait_for_timeout(300)
    blocs, _ = bloc_choisi()
    verifie('« Revenir à l’original » : filet, fond et alignement effacés', blocs[n].get('filet') in (None, False) and not blocs[n].get('fondBloc') and not blocs[n].get('alignement'), json.dumps(blocs[n])[:250])
    verifie('« Revenir à l’original » : le texte ne change pas', blocs[n]['texte'] == a0['slides'][1]['blocs'][n]['texte'])
    msg = pg.locator('.message').inner_text() if pg.locator('.message').count() else ''
    verifie('message « Mise en forme effacée »', 'Mise en forme effacée' in msg, msg)
    # Un seul « Annuler » rétablit la mise en forme effacée
    pg.get_by_role('button', name='Annuler', exact=True).first.click(); pg.wait_for_timeout(300)
    blocs, _ = bloc_choisi()
    verifie('un seul « Annuler » rétablit tout', blocs[n].get('alignement') == 'centre' and isinstance(blocs[n].get('fondBloc'), dict), json.dumps(blocs[n])[:250])
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
