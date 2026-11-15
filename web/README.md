# Lunar Landing Site Navigator : interface

Interface du projet (NASA Space Apps Challenge 2026). HTML, CSS et JavaScript sans framework ni étape de compilation.
Voir le README à la racine du projet pour la méthode, les résultats et la publication.

## Lancer en local

```
cd web
python -m http.server 8000
```

puis ouvrir http://localhost:8000 (ouvrir `index.html` directement ne fonctionne pas : le navigateur refuse de lire `data/`).

En ligne, ce dossier est publié tel quel sur GitHub Pages par `.github/workflows/pages.yml`.

## Organisation

```
index.html          les écrans (accueil, découverte, sites et dates, détail, comparaison, calendrier, période)
css/style.css       la mise en forme
img/                logo et icône d'onglet
js/donnees.js       lecture de data/ (années chargées à la demande), noms courts, valeurs d'exemple si un fichier manque
js/calculs.js       visibilité, résumés, verdicts, mise en forme des nombres
js/dessins.js       panorama, frise, carte polaire, calendrier, graphique de période (SVG)
js/dome.js          dôme du ciel en 3D (canvas, sans bibliothèque)
js/app.js           navigation, état de l'application, textes du parcours Découverte
data/               GÉNÉRÉ par calcul/exporter_web.py : ne pas modifier à la main
```

## Données

`data/sites.json` (liste des sites et années disponibles), `data/horizon/<id>.json` (360 hauteurs d'horizon),
`data/timeline/<id>/<annee>.csv` (positions du Soleil et de la Terre heure par heure).
L'interface ne télécharge que les années utiles à la date choisie. Un site sans fichiers affiche
des valeurs d'exemple inventées, signalées par le badge « Valeurs d'exemple ».

## Ce qui est calculé dans le navigateur

- la marge du Soleil et de la Terre au-dessus du relief (horizon interpolé entre deux degrés) ;
- l'état du Soleil : visible, partiellement caché (disque de 0,53°) ou caché ;
- les comptes à rebours avant le coucher du Soleil et de la Terre ;
- les pourcentages, la plus longue nuit et le verdict de chaque scénario ;
- le Soleil semaine par semaine et les bilans de l'onglet Période.

## Après une modification du code

Changer le numéro `?v=...` des fichiers CSS et JS dans `index.html` pour que les navigateurs rechargent les nouvelles versions.
