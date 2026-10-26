# Apparence générale : la conversation « Une envie ? » se replie et se ferme, et reste gardée.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
envois = []
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    envois.append(json.loads(r.post_data))
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'text', 'text': '{"propositions": []}'}]}))
SIMU = """
(() => {
  window.__phrase = '';
  class Reco { start() { setTimeout(() => { const p = window.__phrase; window.__phrase = '';
      if (p) this.onresult && this.onresult({ results: [Object.assign([{ transcript: p }], { isFinal: true })] });
      this.onend && this.onend(); }, 120); } abort() { this.onend = null; } stop() {} }
  window.webkitSpeechRecognition = Reco; window.SpeechRecognition = Reco;
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820}, has_touch=True)
    pg.add_init_script(SIMU)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if fa.count(): fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Une envie ?').click(); pg.wait_for_timeout(500)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    disc = fa.locator('.mep-discussion')
    replier = disc.get_by_role('button', name='Replier la discussion')
    fermer = disc.get_by_role('button', name='Fermer la discussion')
    verifie('en-tête avec « Replier » et « Fermer »', disc.count() == 1 and replier.count() == 1 and fermer.count() == 1 and 'Une envie ?' in disc.locator('.mep-discussion-tete').inner_text())
    verifie('boutons d’au moins 44 points', replier.bounding_box()['height'] >= 44 and fermer.bounding_box()['width'] >= 44, (replier.bounding_box(), fermer.bounding_box()))
    # Une envie envoyée, puis une dictée en cours dans le champ
    fa.locator('#indications-ccb').fill('Plus de citations'); fa.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1500)
    fa.locator('#indications-ccb').fill('Un fond vert pâle')
    pg.evaluate("window.__phrase = 'et des bandeaux'"); disc.get_by_role('button', name='Dicter au micro').tap(); pg.wait_for_timeout(500)
    # Replier
    replier.tap(); pg.wait_for_timeout(300)
    deplier = disc.get_by_role('button', name='Déplier la discussion')
    verifie('repliée : il ne reste que l’en-tête', deplier.count() == 1 and deplier.get_attribute('aria-expanded') == 'false' and fa.locator('#indications-ccb').count() == 0 and disc.locator('.mep-fil-messages').count() == 0)
    verifie('repliée : l’en-tête dit combien d’envies', '1 envie' in disc.locator('.mep-discussion-tete').inner_text(), disc.locator('.mep-discussion-tete').inner_text())
    verifie('replier arrête la dictée', 'Je t’écoute' not in fa.inner_text())
    deplier.tap(); pg.wait_for_timeout(300)
    verifie('dépliée : la conversation et le texte en cours sont toujours là', 'Plus de citations' in disc.locator('.mep-fil-messages').inner_text() and fa.locator('#indications-ccb').input_value().startswith('Un fond vert pâle'), fa.locator('#indications-ccb').input_value())
    # Fermer
    disc.get_by_role('button', name='Fermer la discussion').tap(); pg.wait_for_timeout(300)
    verifie('fermée : la conversation disparaît', fa.locator('.mep-discussion').count() == 0)
    fa.locator('.bouton-robot').tap(); pg.wait_for_timeout(200)
    fa.locator('.bulle-ccb').get_by_role('menuitem', name='Une envie').tap(); pg.wait_for_timeout(300)
    disc = fa.locator('.mep-discussion')
    verifie('rouverte par le robot : dépliée, avec la conversation gardée', disc.count() == 1 and disc.get_by_role('button', name='Replier la discussion').count() == 1 and 'Plus de citations' in disc.locator('.mep-fil-messages').inner_text())
    # Replier puis rouvrir par le robot : elle revient dépliée
    disc.get_by_role('button', name='Replier la discussion').tap(); pg.wait_for_timeout(200)
    fa.locator('.bouton-robot').tap(); pg.wait_for_timeout(200)
    fa.locator('.bulle-ccb').get_by_role('menuitem', name='Une envie').tap(); pg.wait_for_timeout(300)
    verifie('repliée puis « Une envie ? » : elle se déplie', fa.locator('#indications-ccb').count() == 1)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
