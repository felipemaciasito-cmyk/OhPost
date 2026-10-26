"""Lance tous les tests d'Oh!Post et résume le résultat.
  python3 tests/lancer.py              tout (unitaires puis navigateur)
  python3 tests/lancer.py unitaires    seulement les tests unitaires (Node)
  python3 tests/lancer.py navigateur   seulement les tests dans le navigateur (Playwright, Chromium)
  python3 tests/lancer.py test_cible   une série précise (nom partiel accepté)
Code de sortie 0 si tout passe, 1 sinon."""
import os, re, subprocess, sys, glob
ICI = os.path.dirname(os.path.abspath(__file__))
choix = sys.argv[1] if len(sys.argv) > 1 else ''
choix = choix[:-3] if choix.endswith('.py') else choix[:-3] if choix.endswith('.js') else choix
echecs = []
def lancer(cmd, cwd, nom, delai):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=delai)
        sortie = r.stdout + r.stderr
        ok_code = r.returncode == 0
    except subprocess.TimeoutExpired:
        return False, 'temps dépassé'
    m = re.findall(r'(\d+) / (\d+) vérifications réussies', sortie)
    if m:
        a, b = m[-1]
        ok = a == b and ok_code and 'Traceback' not in sortie
        return ok, f'{a} / {b}' + ('' if ok else '\n' + '\n'.join(l for l in sortie.splitlines() if 'ÉCHEC' in l or 'Error' in l)[:1500])
    ok = ok_code and 'ÉCHEC' not in sortie and 'Traceback' not in sortie
    return ok, ('ok' if ok else sortie[-1500:])
if choix in ('', 'unitaires') or (choix and not choix.startswith('navigateur') and glob.glob(os.path.join(ICI, 'unitaires', f'*{choix}*.js'))):
    for f in sorted(glob.glob(os.path.join(ICI, 'unitaires', '*.js'))):
        n = os.path.basename(f)
        if choix not in ('', 'unitaires') and choix not in n: continue
        ok, detail = lancer(['node', n], os.path.join(ICI, 'unitaires'), n, 300)
        print(('OK    ' if ok else 'ÉCHEC ') + 'unitaires/' + n + ('' if ok else ' : ' + detail)); sys.stdout.flush()
        if not ok: echecs.append(n)
if choix in ('', 'navigateur') or (choix and glob.glob(os.path.join(ICI, 'navigateur', f'*{choix}*.py'))):
    for f in sorted(glob.glob(os.path.join(ICI, 'navigateur', 'test_*.py'))):
        n = os.path.basename(f)
        if choix not in ('', 'navigateur') and choix not in n: continue
        ok, detail = lancer([sys.executable, n], os.path.join(ICI, 'navigateur'), n, 240)
        print(('OK    ' if ok else 'ÉCHEC ') + 'navigateur/' + n + ' ' + detail.split('\n')[0] + ('' if ok else '\n' + '\n'.join(detail.split('\n')[1:]))); sys.stdout.flush()
        if not ok: echecs.append(n)
print('\n' + ('Tout passe.' if not echecs else f'{len(echecs)} série(s) en échec : ' + ', '.join(echecs)))
sys.exit(1 if echecs else 0)
