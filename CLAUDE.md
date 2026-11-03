# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Oh!Post — guide pour Claude Code

Oh!Post est l'application de Romain (Oh ! Potentiel, cabinet d'Anne Litique) pour transformer des articles en carrousels LinkedIn et Instagram fidèles à la charte. C'est une PWA sans étape de construction, publiée par GitHub Pages depuis la branche `main`, utilisée surtout sur iPad (Safari et app installée sur l'écran d'accueil).

Ce fichier résume les règles et les décisions prises avec Romain pendant le développement (fait jusqu'ici dans des conversations claude.ai). Respecte-les : elles ont toutes été validées par lui.

## Travailler avec Romain

- **Toujours en français**, en tutoyant, avec un ton simple et précis. Romain n'est pas développeur : explique sans jargon, dis ce qui change pour lui à l'usage.
- **Honnêteté avant tout** : signale clairement ce que tu n'as pas pu vérifier (l'iPad réel, les vrais appels à l'IA), ce qui est incertain, et tes erreurs.
- **Ne pousse jamais sur `main`.** Travaille sur une branche, lance tous les tests, puis ouvre une pull request en français : ce qui change à l'usage, les fichiers touchés, les tests passés, ce qui n'a pas été testé.
- **Pas de gros changement sans validation.** Pour une nouvelle fonctionnalité visible ou un changement d'interface important, propose d'abord une maquette ou un plan court et attends l'accord de Romain. Les maquettes : une page web simple à onglets, avec des écrans cliquables et une explication au-dessus de chaque écran (pas de canevas).
- **Une version par livraison** (voir « Numéro de version »).

## Noms à ne jamais changer

**Ne renomme jamais les clés `postsop-…` du `localStorage`, les noms de modules `PostsOP…` ni les classes CSS existantes** : l'app s'appelait PostsOP et les données des appareils (et du dépôt de synchronisation `postsop-donnees`) en dépendent. Seul le nom affiché est « Oh!Post ».

## Numéro de version

Format `AAAA-MM-JJ.n` (par exemple `2026-10-26.2`). À chaque livraison, change-le partout en même temps, sinon l'app affiche « Mise à jour incomplète » :
- `const VERSION = '…'` dans `postsop.js` ;
- tous les `?v=…` de `index.html`, sauf `icon-180.png?v=robot`.

## Tests

Prérequis : Node.js, Python 3, Playwright et Chromium (`pip install playwright`, puis `python3 -m playwright install chromium`). Lancement : `python3 tests/lancer.py` (options en tête du fichier).

**Règle : tout doit passer avant une pull request.** Quand tu changes un comportement, mets à jour les tests concernés et ajoute une série pour la nouveauté. Ne modifie jamais un test pour qu'il passe sans comprendre pourquoi il échouait. Aucun test ne doit appeler une vraie IA.

## Règles de l'interface

- Vocabulaire : « page » (jamais « slide » à l'écran), « post » (sans e), « Oh!Post », « CCB » (Creative Collaborative Boost).
- Typographie française partout : apostrophe ’, guillemets « » avec espaces insécables, espaces insécables avant ; : ? !
- iPad d'abord : zones à toucher d'au moins 44 points, pas de survol indispensable, menus et fenêtres qui tiennent dans l'écran (le clavier virtuel réduit la hauteur).
- Une fenêtre au premier plan ne se ferme en touchant le fond que si l'appui ET le relâchement ont lieu sur le fond, et jamais pendant une saisie (sinon le clavier de l'iPad la fait se fermer).
- Animations discrètes, désactivées si « Réduire les animations ».

## Charte et mise en page

- Couleurs : bleu `#003846`, vert anis `#C9D420`, blanc, bleu pâle `#E6EBEC`, vert pâle `#F3F6CE`.
- Le vert anis ne sert jamais de fond de page plein (bandeaux, surligneurs et fonds de texte seulement).
- Fonds de texte et bandeaux toujours à 85 % d'opacité, y compris dans le PDF.
- Lisibilité : contraste d'au moins 3:1. Quand un fond change, un texte devenu illisible reprend sa couleur d'origine si elle est lisible, sinon la couleur de la charte la plus lisible.
- Marges de page : 81 points à gauche et à droite, 110 en haut et en bas.
- Propositions de CCB : 6 pages au plus (7 si texte long), une idée par page, 20 à 40 mots ; une page qui déborde est réparée (texte réduit jusqu'à 80 %, sinon page coupée) plutôt que rejetée.

## Décisions de Romain

- **Nouvel article** : pas de fenêtre ; un questionnaire demande le format puis le titre. Un article laissé vide est supprimé en le quittant.
- **Mise en page, barre de menus** : plus de menu Format ni de « taille libre » en pixels ; pas de « Tout sélectionner » ni « Sélectionner tous les blocs » dans Édition (⌘A reste au clavier) ; pas de « Bloc de texte » dans Insertion ; le titre du menu Page ne montre plus le numéro de la page ; « Carrousel » s'appelle « Réglages ». Le menu « Vérifier » est remplacé par une cloche de notifications avant « Page 1 sur 6 » (dessin A, emplacement A).
- **Barre des blocs sélectionnés** : les outils de mise en forme sont en icônes à la suite (proposition A). L'alignement du texte a son propre bouton : Romain ne veut pas « Placer » et l'alignement dans le même bouton. « Aligner » s'appelle « Placer » ; les icônes de « Placer » et du filet ne doivent pas se confondre (proposition 3). La barre n'affiche plus le nombre de blocs sélectionnés.
- **Apparence générale** : « Mes favoris » montre une rangée de vignettes par favori (proposition 1). L'explication du choix affiché est dans un « i » à côté de son nom, pas sous le titre ; celle de « Une envie ? » est hors de l'étiquette, pour ne pas ouvrir le clavier. Plus de bouton « Proposer 3 autres » sous l'aperçu : le robot CCB de la fenêtre le propose. Pour un article existant, prendre ses paragraphes tels quels (un paragraphe peut contenir un retour à la ligne) : ne jamais recouper le texte à chaque retour, sinon « Actuelle » disparaît et « Appliquer » coupe le paragraphe.
- **Grande fenêtre** : à l'étape Publication, elle n'est qu'un aperçu ; rien n'y modifie la mise en page ni le texte. Les logos des réseaux, blancs, s'affichent en noir sur une page au fond clair par un filtre d'affichage, sans toucher aux fichiers.
- **Agent ciblé** : il ne retouche que ce qui est dans la zone. Pour libérer de la place, il peut envoyer le **dernier** paragraphe au début de la page suivante ou le **premier** à la fin de la précédente, jamais un paragraphe du milieu : l'ordre du texte ne change jamais. Texte et gestes de mise en page ne se mélangent pas dans une même réponse.
- **Voix** : le micro sert de dictée ; Romain corrige et envoie lui-même, rien ne part tout seul. La lecture à voix haute est coupée par défaut.
- **Synchronisation** : l'indicateur reste discret (une ligne, pas de bandeau) mais dit combien d'articles ne sont pas encore copiés ; un toucher ouvre une bulle de détails. La bulle doit passer devant la barre de menus de la Mise en page, sinon elle est coupée.
- **Personnalité de CCB** (décision de l'utilisatrice) : CCB appelle la personne par son prénom (« Anne » par défaut), la tutoie, avec un ton professionnel, bienveillant et chaleureux. Le prénom ne va jamais dans les textes à publier.

## Les logos des réseaux

`logo-instagram.png` et `logo-linkedin.png` sont des fichiers fournis par Romain. Ne les redessine pas, ne les modifie pas, ne les fais pas tourner ni ne les déforme. Instagram demande au moins 29 pixels et un espace libre autour du logo.

## Points ouverts

- Rien n'est testé sur un vrai iPad ni avec de vrais appels à l'IA : demande à Romain de vérifier.
