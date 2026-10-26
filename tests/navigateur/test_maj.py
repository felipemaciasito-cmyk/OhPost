from playwright.sync_api import sync_playwright
import serveur, shutil; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    verifie('tous les fichiers à jour : aucun avertissement', pg.locator('.alerte-mise-a-jour').count() == 0 and not erreurs, erreurs)
    # Simuler un ancien relecture.js resté sur GitHub
    s = open(serveur.RACINE + '/relecture.js', encoding='utf-8').read(); pass
    ancien = s.replace(' messageDiscussion, lireDiscussion,', '')
    pg.route('**/relecture.js*', lambda r: r.fulfill(status=200, body=ancien, headers={'content-type': 'application/javascript; charset=utf-8'}))
    pg.reload(); pg.wait_for_timeout(900)
    t = pg.locator('.alerte-mise-a-jour').inner_text() if pg.locator('.alerte-mise-a-jour').count() else ''
    verifie('ancien relecture.js : avertissement clair', 'Mise à jour incomplète.' in t and 'relecture.js' in t and 'propositions.js' not in t, t)
    verifie('l’app reste utilisable', pg.get_by_text('Le silence au travail').count() >= 1)
    pg.unroute('**/relecture.js*')
    # Simuler propositions.js absent
    pg.route('**/propositions.js*', lambda r: r.fulfill(status=404, body='introuvable'))
    pg.reload(); pg.wait_for_timeout(900)
    t = pg.locator('.alerte-mise-a-jour').inner_text() if pg.locator('.alerte-mise-a-jour').count() else ''
    print('   bandeau :', repr(t), '| module :', pg.evaluate('typeof window.PostsOPPropositions'))
    verifie('propositions.js absent : avertissement', 'propositions.js' in t, t)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
