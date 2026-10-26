# Conversation à voix haute avec CCB (micro et voix simulés) ; étoile et flèche des favoris.
from playwright.sync_api import sync_playwright
import serveur, json; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'}
def claude(route):
    r = route.request
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    c = json.loads(r.post_data)
    return route.fulfill(status=200, headers=CORS, body=json.dumps({'content': [{'type': 'tool_use', 'id': 't', 'name': c['tools'][0]['name'], 'input': {'reponse': 'Voici une version plus courte.', 'propositions': [], 'pistes': []}}], 'stop_reason': 'tool_use'}))
SIMU = """
(() => {
  window.__dit = []; window.__ecoutes = 0;
  const phrases = ['Rends le passage plus court'];
  class Reco { constructor() { this.lang = ''; } start() { window.__ecoutes++; const k = window.__ecoutes; setTimeout(() => {
      const p = phrases[k - 1];
      if (p) this.onresult && this.onresult({ results: [Object.assign([{ transcript: p }], { isFinal: true })] });
      this.onend && this.onend();
    }, 120); } abort() { this.onend = null; } stop() {} }
  window.webkitSpeechRecognition = Reco; window.SpeechRecognition = Reco;
  const synth = { speak(u) { if (u.text && u.text.trim()) window.__dit.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return [{ name: 'Amélie (améliorée)', lang: 'fr-FR', localService: true }]; } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    pg.add_init_script(SIMU)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Discuter').click(); pg.wait_for_timeout(300)
    fen = pg.locator('.fenetre-discussion')
    micro = fen.get_by_role('button', name='Parler à CCB à voix haute')
    verifie('micro dans la fenêtre de discussion', micro.count() == 1)
    micro.click(); pg.wait_for_timeout(1500)
    t = fen.inner_text()
    verifie('ta phrase est transcrite et envoyée', 'Rends le passage plus court' in t, t[-300:])
    verifie('CCB répond à voix haute', pg.evaluate('window.__dit') == ['Voici une version plus courte.'], pg.evaluate('window.__dit'))
    verifie('la réponse est aussi écrite dans la fenêtre', 'Voici une version plus courte.' in t)
    verifie('le micro se remet à écouter après la réponse', pg.evaluate('window.__ecoutes') >= 2, pg.evaluate('window.__ecoutes'))
    stop = fen.get_by_role('button', name='Arrêter la conversation à voix haute')
    verifie('le micro reste actif (mains libres)', stop.count() == 1)
    stop.click(); pg.wait_for_timeout(200)
    verifie('toucher le micro arrête la conversation', fen.get_by_role('button', name='Parler à CCB à voix haute').count() == 1)
    fen.get_by_role('button', name='Fermer la discussion').click(); pg.wait_for_timeout(200)
    # Apparence générale : micro dans la discussion, étoile et flèche des favoris
    pg.get_by_role('button', name='Apparence générale').first.click(); pg.wait_for_timeout(400)
    d = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    et = d.get_by_role('button', name='Garder dans mes favoris', exact=True)
    verifie('étoile active sur la mise en page actuelle', et.count() == 1 and not et.is_disabled())
    et.click(); pg.wait_for_timeout(250)
    verifie('la mise en page actuelle rejoint les favoris', d.get_by_role('button', name='Retirer de mes favoris').count() == 1)
    d.get_by_role('button', name='Mes favoris', exact=True).click(); pg.wait_for_timeout(200)
    verifie('la flèche ouvre la liste des favoris, avec la mise en page gardée', d.get_by_role('group', name='Mes carrousels favoris').count() == 1 and 'Mise en page de « Le silence au travail »' in d.get_by_role('group', name='Mes carrousels favoris').inner_text())
    d.locator('.bouton-robot').click(); pg.wait_for_timeout(200)
    d.locator('.bulle-ccb').get_by_role('menuitem', name='Une envie').click(); pg.wait_for_timeout(200)
    verifie('micro dans la discussion d’Apparence générale', d.get_by_role('button', name='Parler à CCB à voix haute').count() == 1)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
