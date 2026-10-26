# Configuration › IA : personnaliser la voix de CCB (voix simulées).
from playwright.sync_api import sync_playwright
import serveur; _srv = serveur.demarrer()
res = []
def verifie(nom, cond, detail=''):
    res.append((nom, bool(cond))); print(('OK   ' if cond else 'ÉCHEC'), nom, detail if not cond else '')
SIMU = """
(() => {
  window.__dits = [];
  const voix = [{ name: 'Thomas', lang: 'fr-FR', localService: true }, { name: 'Amélie (améliorée)', lang: 'fr-CA', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }];
  const synth = { speak(u) { window.__dits.push({ t: u.text, voix: u.voice && u.voice.name, vitesse: u.rate, hauteur: u.pitch, volume: u.volume }); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return voix; }, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1180, 'height': 820})
    pg.add_init_script(SIMU)
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('group', name='Onglets').get_by_role('button', name='IA').click(); pg.wait_for_timeout(400)
    carte = pg.locator('section.carte', has_text='Voix de CCB')
    verifie('carte « Voix de CCB » dans Configuration › IA', carte.count() == 1)
    options = carte.locator('select option').all_inner_texts()
    verifie('seulement les voix françaises de l’appareil, plus « Automatique »', len(options) == 3 and options[0].startswith('Automatique') and any('améliorée' in o for o in options) and not any('Samantha' in o for o in options), options)
    carte.locator('select').select_option('Thomas')
    carte.get_by_label('Vitesse de la voix').fill('1.2'); carte.get_by_label('Hauteur de la voix').fill('0.85')
    pg.wait_for_timeout(200)
    carte.get_by_role('button', name='Écouter un exemple').click(); pg.wait_for_timeout(200)
    d = pg.evaluate('window.__dits')[-1]
    verifie('l’exemple est dit avec la voix, la vitesse et la hauteur choisies', d['voix'] == 'Thomas' and abs(d['vitesse'] - 1.2) < 0.01 and abs(d['hauteur'] - 0.85) < 0.01 and 'Bonjour, je suis CCB' in d['t'], d)
    pg.reload(); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='Configuration').click(); pg.wait_for_timeout(300)
    pg.get_by_role('group', name='Onglets').get_by_role('button', name='IA').click(); pg.wait_for_timeout(400)
    carte = pg.locator('section.carte', has_text='Voix de CCB')
    verifie('les réglages sont gardés sur l’appareil', carte.locator('select').input_value() == 'Thomas' and carte.get_by_label('Vitesse de la voix').input_value() == '1.2')
    carte.get_by_role('button', name='Revenir aux réglages d’origine').click(); pg.wait_for_timeout(200)
    verifie('retour aux réglages d’origine', carte.locator('select').input_value() == '' and carte.get_by_label('Vitesse de la voix').input_value() == '1')
    verifie('aucune erreur JS', not erreurs, erreurs)
    b.close()
print(sum(1 for _, o in res if o), '/', len(res), 'vérifications réussies')
