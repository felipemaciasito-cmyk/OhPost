# Dictée et haut-parleur dans les conversations avec CCB (micro et voix simulés) ; étoile et flèche des favoris.
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
    c = json.loads(r.post_data); envois.append(c)
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
    # La discussion s'ouvre depuis le robot de la barre de sélection (celui de la barre de menus sert à l'apparence).
    pg.mouse.click(600, 300); pg.wait_for_timeout(250); pg.mouse.click(600, 300); pg.wait_for_timeout(400)
    pg.locator('.editeur-bloc').evaluate("(el) => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); }"); pg.wait_for_timeout(400)
    rb = pg.locator('.barre-flottante').get_by_role('button', name='CCB · Creative Collaborative Boost')
    rb.click(); pg.wait_for_timeout(300)
    if pg.locator('[role=menu][aria-label="CCB · Creative Collaborative Boost"]').count() == 0: rb.click(); pg.wait_for_timeout(300)  # la barre peut encore se placer
    pg.get_by_role('menuitem', name='Discuter de ce passage avec CCB').click(); pg.wait_for_timeout(300)
    fen = pg.locator('.fenetre-discussion')
    micro = fen.get_by_role('button', name='Dicter ta demande à CCB')
    hp = fen.get_by_role('button', name='Lire les réponses de CCB à voix haute')
    verifie('micro et haut-parleur dans la fenêtre de discussion', micro.count() == 1 and hp.count() == 1)
    verifie('haut-parleur coupé au départ', hp.get_attribute('aria-pressed') == 'false')
    champ = fen.get_by_label('Ta consigne à CCB')
    micro.click(); pg.wait_for_timeout(1500)
    verifie('la phrase dictée s’écrit dans le champ', champ.input_value() == 'Rends le passage plus court', champ.input_value())
    verifie('rien n’est envoyé à CCB pendant la dictée', len(envois) == 0 and 'Voici une version plus courte.' not in fen.inner_text(), len(envois))
    verifie('le micro continue d’écouter', fen.get_by_role('button', name='Arrêter la dictée').count() == 1 and pg.evaluate('window.__ecoutes') >= 2, pg.evaluate('window.__ecoutes'))
    champ.fill('Rends le passage plus court et plus doux')
    fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1000)
    t = fen.inner_text()
    verifie('le texte corrigé part quand tu envoies', len(envois) == 1 and 'Rends le passage plus court et plus doux' in envois[0]['messages'][0]['content'] and 'Voici une version plus courte.' in t, t[-300:])
    verifie('envoyer arrête la dictée', fen.get_by_role('button', name='Dicter ta demande à CCB').count() == 1)
    verifie('haut-parleur coupé : CCB ne lit pas sa réponse', pg.evaluate('window.__dit') == [], pg.evaluate('window.__dit'))
    hp.click(); pg.wait_for_timeout(200)
    verifie('le haut-parleur s’active et le choix est gardé sur l’appareil', hp.get_attribute('aria-pressed') == 'true' and pg.evaluate("localStorage.getItem('postsop-voix-lecture')") == 'oui')
    champ.fill('Encore plus court'); fen.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1000)
    verifie('haut-parleur activé : CCB lit sa réponse', pg.evaluate('window.__dit') == ['Voici une version plus courte.'], pg.evaluate('window.__dit'))
    hp.click(); pg.wait_for_timeout(200)
    verifie('toucher de nouveau coupe le haut-parleur', hp.get_attribute('aria-pressed') == 'false' and pg.evaluate("localStorage.getItem('postsop-voix-lecture')") == 'non')
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
    verifie('micro et haut-parleur dans la discussion d’Apparence générale', d.get_by_role('button', name='Dicter ta demande à CCB').count() == 1 and d.get_by_role('button', name='Lire les réponses de CCB à voix haute').count() == 1)
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
