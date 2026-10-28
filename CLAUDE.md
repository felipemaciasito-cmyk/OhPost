# Oh!Post — guide pour Claude Code

Oh!Post est l'application de Romain (Oh ! Potentiel, cabinet d'Anne Litique) pour transformer des articles en carrousels LinkedIn et Instagram fidèles à la charte. C'est une PWA sans étape de construction, publiée par GitHub Pages depuis la branche `main`, utilisée surtout sur iPad (Safari et app installée sur l'écran d'accueil).

Ce fichier résume l'architecture, les règles et les décisions prises avec Romain pendant le développement (fait jusqu'ici dans des conversations claude.ai). Respecte-les : elles ont toutes été validées par lui.

## Première tâche (une seule fois)

Si le fichier `ohpost-tests.zip` est à la racine du dépôt :
1. décompresse-le à la racine (il crée le dossier `tests/`) ;
2. supprime `ohpost-tests.zip` ;
3. lance les tests (voir plus bas) : tout doit passer ;
4. propose une pull request « Ajout des tests », en français.

## Travailler avec Romain

- **Toujours en français**, en tutoyant, avec un ton simple et précis. Romain n'est pas développeur : explique sans jargon, dis ce qui change pour lui à l'usage.
- **Honnêteté avant tout** : signale clairement ce que tu n'as pas pu vérifier (l'iPad réel, les vrais appels à l'IA), ce qui est incertain, et tes erreurs.
- **Ne pousse jamais sur `main`.** Travaille sur une branche, lance tous les tests, puis ouvre une pull request en français : ce qui change à l'usage, les fichiers touchés, les tests passés, ce qui n'a pas été testé.
- **Pas de gros changement sans validation.** Pour une nouvelle fonctionnalité visible ou un changement d'interface important, propose d'abord une maquette ou un plan court et attends l'accord de Romain. Les maquettes : une page web simple à onglets, avec des écrans cliquables et une explication au-dessus de chaque écran (pas de canevas).
- **Une version par livraison** (voir « Numéro de version »).

## Architecture (aucune étape de construction)

React 18.3.1 en UMD depuis jsDelivr, sans JSX (`h = React.createElement`). Chaque module est un fichier JavaScript qui s'enregistre sur `window` (`PostsOPMoteur`, `PostsOPRelecture`…) et fonctionne aussi avec `require` dans Node (tests unitaires).

| Fichier | Rôle |
|---|---|
| `index.html` | Charge React, opentype.js, pdf-lib et les modules (avec `?v=VERSION`). |
| `postsop.js` | L'application : bibliothèque d'articles, étapes Texte, Mise en page, Publication, Configuration, fenêtres de CCB, grande fenêtre de présentation, agent ciblé, voix. |
| `composition.js` | L'étape Mise en page : pages éditables, menus, barre de sélection, repères de déplacement, couleurs, Vérifier. |
| `moteur.js` | Composition et dessin des pages (gabarits, fonds, marges, alertes), sur canvas. Partagé par l'écran et l'export. |
| `propositions.js` | Propositions de mise en page par CCB (consignes, lecture, vérification, recettes des favoris). |
| `relecture.js` | Consignes de CCB : relecture, discussion, texte du post, titres, agent ciblé. |
| `ia.js` | Fournisseurs d'IA (Claude, Mistral), appels, gestion des erreurs. L'assistant s'appelle **CCB** (Creative Collaborative Boost). |
| `liens.js` | Lien entre le texte de l'article et les blocs des pages. |
| `typographie.js` | Typographie française automatique. |
| `export.js` | Export PNG et PDF (pdf-lib). |
| `synchro.js` | Synchronisation avec le dépôt privé de données `postsop-donnees` (clé GitHub saisie dans l'app). |
| `postsop.css` | Styles (thèmes clair et sombre). |
| `icon-180.png`, `icon-512.png` | Icône de l'écran d'accueil (le robot CCB). |
| `logo-instagram.png`, `logo-linkedin.png` | Logos fournis par Romain, affichés tels quels (voir plus bas). |

Les données vivent sur l'appareil (`localStorage`, clés `postsop-…`) et se synchronisent avec `postsop-donnees`. **Ne renomme jamais les clés `postsop-…`, les noms de modules `PostsOP…` ni les classes CSS existantes** : l'app s'appelait PostsOP et les données des appareils en dépendent. Seul le nom affiché est « Oh!Post ».

## Numéro de version

Format `AAAA-MM-JJ.n` (par exemple `2026-10-26.2`). À chaque livraison, change-le partout en même temps :
- `const VERSION = '…'` dans `postsop.js` (affiché dans l'aide « i ») ;
- tous les `?v=…` de `index.html` (11 occurrences).
L'app affiche un bandeau « Mise à jour incomplète » si un module en cache est plus ancien.

## Tests

Prérequis : Node.js, Python 3, Playwright et Chromium (`pip install playwright`, puis `python3 -m playwright install chromium`).

- `python3 tests/lancer.py` : tout (19 fichiers unitaires, 57 séries dans le navigateur).
- `python3 tests/lancer.py unitaires` ou `python3 tests/lancer.py navigateur`.
- `python3 tests/lancer.py test_cible.py` : une série.

Les tests navigateur servent la racine du dépôt sur `localhost:8765` (`tests/navigateur/serveur.py`), avec React chargé depuis `tests/navigateur/vendor/react-local.js` (pas besoin d'internet). Les appels à l'IA sont simulés (`page.route` sur `api.anthropic.com`) : aucun test n'appelle une vraie IA. Données d'exemple dans `tests/donnees/`.

**Règle : tout doit passer avant une pull request.** Quand tu changes un comportement, mets à jour les tests concernés et ajoute une série pour la nouveauté. Ne modifie jamais un test pour qu'il passe sans comprendre pourquoi il échouait.

## Règles de l'interface

- Vocabulaire : « page » (jamais « slide » à l'écran), « post » (sans e), « Oh!Post », « CCB ».
- Typographie française partout : apostrophe ’, guillemets « » avec espaces insécables, espaces insécables avant ; : ? !
- iPad d'abord : zones à toucher d'au moins 44 points, pas de survol indispensable, menus et fenêtres qui tiennent dans l'écran (le clavier virtuel réduit la hauteur).
- Une fenêtre au premier plan ne se ferme en touchant le fond que si l'appui ET le relâchement ont lieu sur le fond, et jamais pendant une saisie (sinon le clavier de l'iPad la fait se fermer).
- Animations discrètes, désactivées si « Réduire les animations ».

## Charte et mise en page

- Couleurs : bleu `#003846`, vert anis `#C9D420`, blanc, bleu pâle `#E6EBEC`, vert pâle `#F3F6CE`.
- Le vert anis ne sert jamais de fond de page plein (bandeaux, surligneurs et fonds de texte seulement).
- Fonds de texte et bandeaux toujours à 85 % d'opacité (`OPACITE_FONDS` dans `moteur.js`), y compris dans le PDF.
- Lisibilité : contraste d'au moins 3:1. Quand un fond change, un texte devenu illisible reprend sa couleur d'origine si elle est lisible, sinon la couleur de la charte la plus lisible.
- Marges de page : 81 points à gauche et à droite, 110 en haut et en bas.
- Propositions de CCB : 6 pages au plus (7 si texte long), une idée par page, 20 à 40 mots ; une page qui déborde est réparée (texte réduit jusqu'à 80 %, sinon page coupée) plutôt que rejetée.

## Parcours actuel (décisions de Romain)

1. **Nouvel article** : pas de fenêtre. L'article s'ouvre sur un champ vide, puis un questionnaire demande le format (1:1 ou 4:5) et le titre (nom dans la bibliothèque, avec CCB pour proposer). Un article laissé vide est supprimé en le quittant. « Utiliser comme modèle » suit le même chemin (seulement la question du titre).
2. **Étape Texte** : texte, relecture, typographie, discussion avec CCB.
3. **Étape Mise en page** : édition directe des pages. Au premier passage, la fenêtre « Apparence générale » s'ouvre. Le robot de la barre de menus est l’agent de l’apparence : sa bulle propose « Générer 3 propositions » ou « Une envie ? », qui ouvrent toutes deux « Apparence générale ». Pour retravailler des mots, le robot de la barre de sélection (passage choisi) ouvre la discussion avec CCB. Un bouton fleur (logo ou fleurs) est dans la barre de menus. La barre des blocs sélectionnés (Fusionner, Dupliquer, Nouveau, Aligner, Supprimer) a aussi, en icônes à la suite (proposition A, choisie par Romain), les outils de mise en forme qui n'y étaient pas : style de paragraphe, filet latéral, fond du paragraphe et « Revenir à l'original » (efface en une étape gras, italique, souligné, taille, couleur, filets, alignement et fond ; ni le texte, ni le style, ni la place ne changent). L'alignement du texte est dans le menu « Aligner » (« Le texte dans le bloc »), pas en bouton à part. Ce sont les mêmes réglages que le menu Format.
4. **Apparence générale** : propositions de CCB, Actuelle, favoris (étoile + petite flèche), Sans IA, fond, logo et fleurs. L'explication du choix affiché est dans un « i » à côté de son nom, pas sous le titre ; celle de « Une envie ? » aussi, dans un « i » à côté de l'étiquette (hors de l'étiquette, pour ne pas ouvrir le clavier). L'agent général : « Générer 3 propositions » ou « Une envie ? ». Chaque envie garde ses propositions, enregistrées avec l'article (champ `envies`, les 20 dernières, synchronisé) : « Revoir ces propositions » les remet en haut ; si le texte a changé depuis, elles sont adaptées au nouveau texte comme un favori. Une nouvelle envie ne reprend que les envies de la même ouverture de la fenêtre. La conversation « Une envie ? » a un en-tête avec « Replier » (réduite à l'en-tête, nombre d'envies) et « Fermer » (×) ; elle est gardée et se rouvre par le robot › « Une envie ? ».
5. **Grande fenêtre** : le bouton « Agrandir », à gauche de chaque page de l'étape Mise en page, l'ouvre directement sur cette page ; toucher la page affichée (Apparence générale) ou l'aperçu (Publication) l'ouvre aussi. Logos LinkedIn puis Instagram en haut à droite (4,8 % de la largeur de la page, à 81,9 % et 89,0 %, 5,4 % du haut), à 50 % de visibilité, 100 % au survol, sans bulle d'aide ; les fichiers sont blancs : sur une page au fond clair (blanc, vert pâle, vert), ils s'affichent en noir (filtre d'affichage, fichiers inchangés, décision de Romain) ; chacun ouvre l'aperçu du post de son réseau. Tracer un rectangle sélectionne une zone (Tab, Maj ou le bouton « + » ajoutent une zone) et ouvre **l'agent ciblé**, qui ne retouche que ce qui est dans la zone (la zone peut aussi toucher le logo et les fleurs). Il change les mots et le style des paragraphes, ou fait des gestes de mise en page (`retoucherDisposition` dans `moteur.js`) : déplacer un paragraphe (haut, milieu, bas, gauche, centre, droite), changer la taille de son texte ou la largeur de son cadre, déplacer, agrandir ou retirer le logo et les fleurs, toujours dans les marges. Déplacer ou agrandir un paragraphe passe la page en mise en page libre. Pour libérer de la place, il peut envoyer le **dernier** paragraphe au début de la page suivante ou le **premier** à la fin de la précédente : jamais un paragraphe du milieu, l'ordre du texte ne change jamais (décision de Romain). Texte et gestes ne se mélangent pas dans une même réponse ; « Annuler la retouche » défait l'un ou l'autre.
6. **Étape Publication** : réseau (LinkedIn, Instagram ou les deux), texte du post (CCB : trois propositions ou discussion), fichier, date (programmer ou non), publié.
8. **Synchronisation** : l'indicateur en haut à droite reste discret (une ligne, pas de bandeau) mais dit combien d'articles ne sont pas encore copiés sur GitHub (« Erreur de synchronisation · 2 articles pas encore copiés »). Un toucher ouvre une bulle : lesquels, la raison d'un échec, la dernière copie réussie, « Copier maintenant », « Réglages de synchronisation » (décision de Romain).
7. **Voix** : dans toutes les conversations avec CCB, le micro sert de dictée : ce que Romain dit s'écrit dans le champ, il le corrige et l'envoie lui-même (rien ne part tout seul). Un bouton haut-parleur, à côté du micro, choisit si CCB lit ses réponses à voix haute (coupé par défaut, choix gardé sur l'appareil dans `postsop-voix-lecture`). Voix de l'iPad réglable dans Configuration › IA.

## Les logos des réseaux

`logo-instagram.png` et `logo-linkedin.png` sont des fichiers fournis par Romain. Ne les redessine pas, ne les modifie pas, ne les fais pas tourner ni ne les déforme. Instagram demande au moins 29 pixels et un espace libre autour du logo.

## Points ouverts

- Rien n'est testé sur un vrai iPad ni avec de vrais appels à l'IA : demande à Romain de vérifier.
