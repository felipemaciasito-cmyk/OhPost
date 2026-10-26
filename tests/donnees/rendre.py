import sys, json, base64; sys.path.insert(0, '/home/claude/banc')
from playwright.sync_api import sync_playwright
import serveur; serveur.demarrer()
P0 = ["« J’ai le cerveau qui disjoncte ! »",
"Hélène est dirigeante. Charisme, leadership, vision, courage, écoute, audace… Elle a tous les atouts pour embarquer ses équipes.",
"Mais elle a un gros trou dans la raquette en matière d’intelligence émotionnelle : quand elle est en colère, elle boude !",
"Bras croisés, tête baissée, moue d’enfant contrariée… Elle qui est d’habitude si vivante se fige complètement.",
"Impossible de parler, de réfléchir ou d’expliquer ce qui se passe. Et ça peut durer toute une journée !",
"« C’est comme si mon cerveau disjonctait. » Et le pire, c’est qu’elle le dit aussi à son équipe, qui s’inquiète : si notre boss a le cerveau qui disjoncte, on est mal barrés…",
"Son Codir marche sur des œufs, la situation devient franchement insécurisante.",
"Hélène me demande de l’aide.",
"En cinq séances, nous remontons le fil de son histoire, mettons à jour le déclencheur initial de cette réaction et identifions de nouvelles façons de gérer sa colère.",
"Hélène s’entraîne avec moi, puis entre les séances. Avec courage, authenticité et une vraie volonté de changer.",
"Un an plus tard, elle me raconte :",
"« Je n’ai plus jamais boudé, t’y crois ça ? Aujourd’hui, je sens la colère arriver, j’arrive à trouver ce qui l’a déclenchée, je l’écris tout de suite, je touche ma bague, je me concentre sur mon corps et ma respiration et hop, je retrouve mon cerveau capable de penser et de chercher des solutions. »",
"Et elle ajoute :",
"« Pourquoi on n’apprend pas ça à l’école ? »",
"Excellente question, Hélène !",
"L’intelligence émotionnelle n’est pas une question de tempérament ou de personnalité. C’est aussi une compétence qui se développe.",
"Et quand on dirige une équipe, apprendre à accueillir sa colère plutôt qu’à la subir peut tout changer."]
import re
NB = chr(0xA0)
P = [re.sub(r' ([:;!?»])', lambda m: NB + m.group(1), x.replace('« ', '«' + NB)) for x in P0]
MODE = sys.argv[1] if len(sys.argv) > 1 else 'actuel'
PLANS = json.load(open('/home/claude/maquette/plans.json', encoding='utf-8'))
JS = r"""
async ({ P, PLANS }) => {
  const M = window.PostsOPMoteur;
  const pol = (role) => M.policeSysteme(role === 'bold' ? 700 : 300);
  const sortie = {};
  const rendre = (slides, fond, format, cle) => {
    const pages = [];
    slides.forEach((sl, i) => {
      const c = M.composer(sl, format, fond, pol, { index: i, total: slides.length, reglages: { numero: true, glisser: true } });
      const cv = document.createElement('canvas'); cv.width = c.fmt.l; cv.height = c.fmt.h;
      M.dessiner(cv.getContext('2d'), c, {}, { export: true });
      const petit = document.createElement('canvas'); petit.width = 324; petit.height = Math.round(324 * c.fmt.h / c.fmt.l);
      const g = petit.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, petit.width, petit.height);
      const mots = sl.blocs.map((b) => b.texte).join(' ').split(/\s+/).filter(Boolean).length;
      pages.push({ img: petit.toDataURL('image/jpeg', 0.86), deborde: !!c.deborde, tropLarge: !!c.tropLarge, gabarit: sl.gabarit || M.gabaritParDefaut(sl, i, slides.length), mots });
    });
    sortie[cle] = pages;
  };
  for (const pl of PLANS) {
    const slides = pl.pages.map((pg) => ({ gabarit: pg.g, blocs: pg.p.map((n, k) => ({ texte: P[n], style: pg.s[k] })), signature: pg.g === 'F1' }));
    rendre(slides, pl.fond, 'portrait', pl.cle);
  }
  const simple = M.decouperMecaniquement(P, 'portrait', 'bleu', pol, {});
  rendre(simple, 'bleu', 'portrait', 'simple');
  return sortie;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    if MODE == 'equilibreX': pg.route('**/moteur.js*', lambda rt: rt.fulfill(status=200, body=open('/home/claude/maquette/moteur-equilibre.js', encoding='utf-8').read(), headers={'content-type': 'application/javascript; charset=utf-8'}))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(900)
    out = pg.evaluate(JS, {'P': P, 'PLANS': PLANS})
    json.dump(out, open(f'/home/claude/maquette/pages-{MODE}.json', 'w'))
    for k, v in out.items():
        print(k, len(v), 'pages |', ' '.join(f"{x['gabarit']}:{x['mots']}{'!DEB' if x['deborde'] else ''}{'!LARGE' if x['tropLarge'] else ''}" for x in v))
    b.close()
