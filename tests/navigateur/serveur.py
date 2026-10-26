"""Serveur local des tests : sert la racine du dépôt sur http://localhost:8765/.
index.html est servi avec React chargé depuis tests/navigateur/vendor/react-local.js (les tests ne dépendent pas d'internet)."""
import os, re, socket, threading, time, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, '..', '..'))
DONNEES = os.path.join(RACINE, 'tests', 'donnees')
def _version():
    s = open(os.path.join(RACINE, 'postsop.js'), encoding='utf-8').read()
    m = re.search(r"const VERSION = '([^']+)'", s)
    return m.group(1) if m else ''
VERSION = _version()
class _Gestion(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        chemin = self.path.split('?')[0]
        if chemin in ('/', '/index.html'):
            s = open(os.path.join(RACINE, 'index.html'), encoding='utf-8').read()
            s = re.sub(r'\s*<script src="https://cdn\.jsdelivr\.net/npm/react[^"]*"></script>', '', s)
            s = s.replace('</head>', '  <script src="tests/navigateur/vendor/react-local.js"></script>\n</head>', 1) if 'react-local.js' not in s else s
            corps = s.encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(corps))); self.end_headers(); self.wfile.write(corps); return
        return super().do_GET()
def demarrer():
    s = socket.socket()
    if s.connect_ex(('localhost', 8765)) == 0: s.close(); return None
    serveur = ThreadingHTTPServer(('localhost', 8765), functools.partial(_Gestion, directory=RACINE))
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    time.sleep(0.3); return serveur
