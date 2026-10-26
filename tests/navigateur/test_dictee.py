# Dictée : dans chaque conversation avec CCB, le micro écrit dans le champ sans rien envoyer (micro simulé).
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
# La phrase à « entendre » est posée par le test dans window.__phrase ; elle n'est dite qu'une fois.
SIMU = """
(() => {
  window.__phrase = ''; window.__dit = [];
  class Reco { start() { setTimeout(() => {
      const p = window.__phrase; window.__phrase = '';
      if (p) this.onresult && this.onresult({ results: [Object.assign([{ transcript: p }], { isFinal: true })] });
      this.onend && this.onend();
    }, 120); } abort() { this.onend = null; } stop() {} }
  window.webkitSpeechRecognition = Reco; window.SpeechRecognition = Reco;
  const synth = { speak(u) { if (u.text && u.text.trim()) window.__dit.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return []; } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""
def dicter(pg, zone, phrase):
    pg.evaluate('(p) => { window.__phrase = p; }', phrase)
    zone.get_by_role('button', name='Dicter ta demande à CCB').click(); pg.wait_for_timeout(700)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    pg.add_init_script(SIMU)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.route('https://api.anthropic.com/**', claude)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('postsop-ia', JSON.stringify({fournisseur:'claude', cles:{claude:'sk-ant-test'}, modeles:{}}))"); pg.reload(); pg.wait_for_timeout(900)
    pg.get_by_text('Le silence au travail').first.click(); pg.wait_for_timeout(300)
    pg.locator('nav.etapes .etape').nth(1).click(); pg.wait_for_timeout(700)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    if fa.count(): fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # « Une envie ? » dans Apparence générale
    pg.locator('.bouton-robot-menu').click(); pg.wait_for_timeout(200)
    pg.get_by_role('menuitem', name='Une envie ?').click(); pg.wait_for_timeout(500)
    fa = pg.get_by_role('dialog', name='Apparence générale', exact=True)
    champ = fa.locator('#indications-ccb')
    champ.fill('Un fond bleu,')
    dicter(pg, fa, 'plus de citations en grand')
    verifie('« Une envie ? » : la dictée s’ajoute à ce qui est écrit', champ.input_value() == 'Un fond bleu, plus de citations en grand', champ.input_value())
    verifie('« Une envie ? » : rien n’est envoyé', len(envois) == 0, len(envois))
    verifie('« Une envie ? » : l’état de la dictée est affiché', 'Je t’écoute' in fa.inner_text())
    fa.get_by_role('button', name='Arrêter la dictée').click(); pg.wait_for_timeout(200)
    verifie('« Une envie ? » : toucher le micro arrête la dictée', fa.get_by_role('button', name='Dicter ta demande à CCB').count() == 1 and 'Je t’écoute' not in fa.inner_text())
    fa.get_by_role('button', name='Envoyer').click(); pg.wait_for_timeout(1200)
    verifie('« Une envie ? » : l’envie part quand tu envoies', len(envois) >= 1 and 'Un fond bleu, plus de citations en grand' in json.dumps(envois[-1], ensure_ascii=False), len(envois))
    fa.locator('.feuille-tete').get_by_role('button', name='Annuler').click(); pg.wait_for_timeout(300)
    # Agent ciblé de la grande fenêtre (depuis l'aperçu de Publication)
    pg.locator('nav.etapes .etape').nth(2).click(); pg.wait_for_timeout(600)
    pg.evaluate('window.scrollTo(0,0)')
    pg.locator('.publication-apercu .page-cliquable').click(); pg.wait_for_timeout(500)
    gf = pg.locator('.grande-fenetre'); bb = gf.locator('.gf-surface').bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] * 0.25, bb['y'] + bb['height'] * 0.38); pg.wait_for_timeout(300)
    agent = gf.locator('.gf-agent')
    n0 = len(envois)
    dicter(pg, agent, 'Raccourcis ce paragraphe')
    champ = agent.get_by_label('Ta demande à CCB pour cette zone')
    verifie('agent ciblé : la dictée s’écrit dans le champ', agent.count() == 1 and champ.input_value() == 'Raccourcis ce paragraphe', champ.input_value() if agent.count() else '')
    verifie('agent ciblé : rien n’est envoyé', len(envois) == n0, len(envois) - n0)
    verifie('agent ciblé : haut-parleur présent', agent.get_by_role('button', name='Lire les réponses de CCB à voix haute').count() == 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    if pg.locator('.grande-fenetre').count(): pg.locator('.gf-fermer').click(); pg.wait_for_timeout(300)
    # Titre d'un nouvel article
    pg.get_by_role('button', name='Oh!Post').first.click() if pg.get_by_role('button', name='Oh!Post').count() else None
    pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Nouvel article').first.click(); pg.wait_for_timeout(400)
    pg.locator('#texte-modele').click(); pg.keyboard.insert_text('Un texte pour essayer la dictée du titre.\n\nUn second paragraphe.'); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Continuer', exact=True).click(); pg.wait_for_timeout(300)
    q = pg.get_by_role('dialog', name='Ton nouvel article')
    q.get_by_role('button', name='Carré · 1:1').click()
    q.get_by_role('button', name='Écrire un titre').click(); pg.wait_for_timeout(150)
    q.locator('.bouton-robot').click(); pg.wait_for_timeout(150)
    q.locator('.bulle-ccb').get_by_role('menuitem').nth(1).click(); pg.wait_for_timeout(200)
    n1 = len(envois)
    dicter(pg, q, 'Plus court avec le prénom')
    champ = q.get_by_label('Ta demande à CCB')
    verifie('titre : la dictée s’écrit dans le champ', champ.input_value() == 'Plus court avec le prénom', champ.input_value())
    verifie('titre : rien n’est envoyé', len(envois) == n1, len(envois) - n1)
    verifie('aucune voix tant que le haut-parleur est coupé', pg.evaluate('window.__dit') == [], pg.evaluate('window.__dit'))
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
