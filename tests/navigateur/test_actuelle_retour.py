# Apparence générale : un paragraphe qui contient un retour à la ligne ne fait plus disparaître « Actuelle »,
# et « Appliquer » ne le coupe pas en deux.
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
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
    # Étape Texte : un retour à la ligne au milieu du premier paragraphe (sans ligne vide : il reste un seul paragraphe)
    z = pg.locator('textarea.editeur-zone')
    i = z.input_value().index('Pourtant')
    z.evaluate('(el, i) => { el.focus(); el.setSelectionRange(i, i); }', i)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    a1 = article(pg)
    verifie('le premier paragraphe contient un retour à la ligne', '\n' in a1['texte'][0], a1['texte'][0][:80])
    # Mise en page › Apparence générale
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(500)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    choix = fa.get_by_role('group', name='Mises en page proposées').get_by_role('button')
    verifie('« Actuelle » est proposée', 'Actuelle' in choix.all_inner_texts(), choix.all_inner_texts())
    verifie('et affichée : la mise en page de « Mise en page »', 'Mise en page actuelle' in fa.locator('.mep-infos h3').inner_text() and f"{len(a1['slides'])} page" in fa.locator('.mep-infos').inner_text(), fa.locator('.mep-infos').inner_text()[:120])
    # Appliquer ne coupe pas le paragraphe en deux
    fa.get_by_role('button', name='Appliquer').click(); pg.wait_for_timeout(500)
    a2 = article(pg)
    verifie('« Appliquer » garde le texte tel quel (même nombre de paragraphes, retour compris)', a2['texte'] == a1['texte'], (len(a1['texte']), len(a2['texte'])))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
