from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
etat = {'mode': 'relecture'}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    corps = json.loads(r.post_data); etat['systeme'] = corps.get('system', ''); etat['texte'] = corps['messages'][0]['content']
    if etat['systeme'].startswith('Tu proposes d’autres formulations'):
        t = json.dumps({'formulations': ['les sources', 'causes profondes', 'les ressorts']}, ensure_ascii=False)
    else:
        t = json.dumps({'propositions': [{'type': 'vocabulaire', 'avant': 'causes racines', 'apres': 'causes profondes', 'alternatives': ['origines', 'racines profondes', 'causes profondes'], 'phrase': 'Nous travaillons sur les causes racines de son mal-être, son besoin de reconnaissance et de sécurité, puis sur quelques clés de communication pour oser aborder le sujet avec son manager.', 'pourquoi': '« Causes racines » est un calque de l’anglais.', 'vigilance': ''}]}, ensure_ascii=False)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': t}]}))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(700)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))")
    pg.reload(); pg.wait_for_timeout(900); pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    zone = pg.locator('textarea.editeur-zone'); avant = zone.input_value()
    pg.get_by_role('button', name='Relire avec CCB').click(); pg.wait_for_timeout(900)
    verifie('consigne : alternatives et style demandés', 'alternatives' in etat['systeme'] and 'type « style »' in etat['systeme'])
    carte = pg.locator('.carte.proposition').first
    print('   cartes :', pg.locator('.carte.proposition').count(), '|', pg.locator('aside, .panneau-droite, .colonne-droite').first.inner_text()[:400] if pg.locator('aside, .panneau-droite, .colonne-droite').count() else pg.locator('main').inner_text()[-600:])
    f = carte.locator('.formulation')
    verifie('3 formulations distinctes (doublon retiré)', f.count() == 3 and f.all_inner_texts() == ['causes profondes', 'origines', 'racines profondes'], f.all_inner_texts())
    verifie('la première est choisie', f.nth(0).get_attribute('aria-checked') == 'true')
    f.nth(1).click(); pg.wait_for_timeout(200)
    verifie('choisir une autre : l’aperçu « Après » suit', 'origines' in carte.locator('.ajoute').inner_text() and f.nth(1).get_attribute('aria-checked') == 'true')
    carte.get_by_role('button', name='D’autres formulations').click(); pg.wait_for_timeout(800)
    verifie('nouvelles formulations demandées avec le passage et celles déjà vues', '<passage>causes racines</passage>' in etat['texte'] and '- origines' in etat['texte'])
    verifie('nouvelles formulations ajoutées sans doublon', carte.locator('.formulation').all_inner_texts() == ['causes profondes', 'origines', 'racines profondes', 'les sources', 'les ressorts'], carte.locator('.formulation').all_inner_texts())
    verifie('le choix reste « origines »', carte.locator('.formulation').nth(1).get_attribute('aria-checked') == 'true')
    carte.get_by_role('button', name='Accepter').click(); pg.wait_for_timeout(400)
    v = zone.input_value()
    verifie('accepter applique la formulation choisie', 'les origines de son mal-être' in v and 'causes racines' not in v)
    pg.get_by_role('button', name='Annuler ce choix').click(); pg.wait_for_timeout(300)
    verifie('annuler ce choix', zone.input_value() == avant)
    pg.screenshot(path='formul.png')
    print('erreurs JS :', erreurs); verifie('aucune erreur JavaScript', not erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
