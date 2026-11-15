# CLAUDE.md – Lunar Landing Site Navigator (NASA Space Apps Challenge 2026)

Contexte pour Claude Code. Rédigé le 14/11/2026 à partir de la session de travail sur claude.ai ; mis à jour pour l'organisation combinée calcul/ + web/.
Langue de l'équipe : français. Hackathon : 14-15 novembre 2026, soumission avant dimanche 23h59.

## Le défi

Défi « Lunar Landing Site Navigator ». Construire un outil intuitif pour **comparer rapidement des
combinaisons site + date** au pôle Sud lunaire : positions du Soleil (énergie) et de la Terre
(communication directe, DTE) par rapport à l'horizon réel du site, temps restant avant le coucher
du Soleil / de la Terre, élévation solaire. Publics : planificateurs de mission, enseignants, grand public.

- L'outil **ne choisit pas le point d'atterrissage précis** (rochers, pente sous l'atterrisseur,
  trajectoire : hors périmètre). Il aide à comparer des options et à réagir quand la date ou le site change.
- Point fort visé : la comparaison de scénarios (« et si on atterrit N jours plus tard ? », « et sur le site voisin ? »).

## Architecture (dossier `NASAHackathon`)

Deux parties dans un seul dossier, reliées par un script d'export :

```
calcul/sites.json ─> calcul_horizon.py ─> resultats/horizon_<id>.json ─> precalcul.py ─> resultats/timelines/<id>_<annee>.csv
                       (cartes/*.tif, LOLA)     (360 hauteurs + coordonnées)    (JPL Horizons année par année + visibilité)
                                                                         (ou calcul_timeline.py ─> resultats/timeline_<id>.csv, période libre)
                                                                                         │
                                                       exporter_web.py ─> web/data/ ─> interface web (web/index.html)
```

| Fichier | Rôle |
| --- | --- |
| `calcul/sites.json` | **Source unique** des sites : `id`, `nom`, `nom_court` (étiquettes de l'interface), `dem` (nom du .tif dans `calcul/cartes/`, ou null), `point` (`"centre_tuile"` ou absent), `lat`, `lon` (-180..180), `distance_max_m` (optionnel), `source` |
| `calcul/calcul_horizon.py <id>` | Horizon réel sur 360 azimuts. Écrit `resultats/horizon_<id>.json` et met à jour **uniquement** l'entrée du site dans `sites.json` |
| `calcul/calcul_timeline.py <id> --debut --fin [--pas 1h]` | JPL Horizons (astroquery) **aux coordonnées lues dans `resultats/horizon_<id>.json`** + visibilité → `resultats/timeline_<id>.csv` |
| `calcul/precalcul.py [ids] [--de 2025 --a 2030] [--force]` | Appelle les fonctions de `calcul_timeline.py` **une année civile UTC à la fois** (pas 1 h, 3 essais) → `resultats/timelines/<id>_<annee>.csv`. Saute les années déjà faites (reprise après coupure). Sans id : tous les sites qui ont un `horizon_<id>.json` |
| `calcul/exporter_web.py` | Regénère entièrement `web/data/` : `sites.json` (lon 0..360, `groupe` pole si lat ≤ -80, et `timeline: {annees, debut, fin, pas_h}` pour les sites calculés), `horizon/<id>.json` (`hauteurs`), `timeline/<id>/<annee>.csv` (`time_utc, sun_az, sun_el, earth_az, earth_el`). Fusionne fichiers annuels (prioritaires) et `timeline_<id>.csv`, remet sur une grille régulière (heures manquantes = cases vides), signale si les sites n'ont pas de période commune |
| `calcul/tests_horizon.py` | 10 tests sur cartes artificielles. Doivent tous passer |
| `calcul/validation_chandrayaan3.py` | Compare levers/couchers calculés aux dates publiées de Chandrayaan-3 |
| `calcul/app_streamlit.py` | Ancienne interface, gardée comme outil de vérification rapide |
| `web/` | Interface présentée au jury (ex-`lunar-control`, HTML/CSS/JS sans framework). Modes Découverte (4 étapes, rejeu IM-1/Chandrayaan-3) et Mission (Sites et dates, Détail, Comparaison sites × reports, Calendrier 60 jours). Recalcule la visibilité dans le navigateur (disque solaire 0,27°, horizon interpolé). Un site sans fichiers affiche des **valeurs d'exemple inventées** avec un badge |

Colonnes de `resultats/timeline_<id>.csv` : `datetime, site_id, sun_az, sun_alt, earth_az, earth_alt,
sun_horizon_alt, earth_horizon_alt, sun_visible, earth_visible, both_visible`.

Commandes (depuis le dossier du projet `NASAHackathon`) : `python calcul/calcul_horizon.py <id>`,
`python calcul/precalcul.py`, `python calcul/exporter_web.py`,
puis `cd web && python -m http.server 8000`. Ne jamais modifier `web/data/` à la main.

**Date libre dans l'interface** (`web/js/app.js` : `fenetreMission`, `assurerDonnees`, `plageCommune`, `afficherPlage` ;
`web/js/donnees.js` : `preparerTimelineParAnnee`, `chargerPeriode`) : pour une date D, la fenêtre utile va de D − 1 j à
D + max(joursCalendrier − 1, report max, decalageDetail) + durée + 30 j (comptes à rebours) + 1 j. Seules les années
de cette fenêtre sont téléchargées ; `afficher()` attend le chargement avant de dessiner et vide `resumesEnCache` si de
nouvelles années arrivent. Le champ date est borné à la période commune des sites calculés (fin − durée).
`positions(instant)` choisit l'année après arrondi au pas (le 31/12 à 23 h 40 se lit dans l'année suivante).

**Date d'alunissage** : choisie dans l'onglet 2. Détail (champ `date-debut`, commun aux modes « Un site » et « Côte à côte ») ; l'onglet 1 ne fait que l'afficher. Logo : `web/img/logo.png` (favicon `web/img/favicon.png`).
**Détail côte à côte** (onglet 2, bouton « Un site / Côte à côte », `afficherCote`, `remplirColonne`, `afficherCompromis`) :
deux sites (A = `etat.siteDetail`, B = `etat.siteB`), même date, durée et critères ; indicateurs sur la mission,
panorama avec le trajet de toute la mission (`echelleTexte` agrandit les textes en demi-largeur), frise, tableau des
compromis (critère, seuil, A, B, avantage). **Zoom sur une période** (onglet 5, `afficherPeriode`, `dessinerZoom`,
`dessinerBandesTerre`) : Soleil visible par semaine sur l'année, double curseur, champs Du/Au, largeurs rapides, courbe
de la marge du Soleil sur le relief pour les sites cochés, bilan de la fenêtre. Ne fait que filtrer les données
précalculées. Paramètres de lien : `cote`, `siteb`, `du`, `au`.
**Dôme du ciel en 3D** (`web/js/dome.js`, `dessinerDome(canvas, {horizon, trajet, actuel}, cle)`) : couronne du relief
(les 360 hauteurs d'horizon, donc exactement les données du calcul), trajets et lignes de visée du Soleil et de la Terre,
dessinés sur un `<canvas>` sans bibliothèque (projection simple, tri du plus loin au plus près). Rotation à la souris,
au doigt ou aux flèches ; hauteurs exagérées (facteur affiché). Présent dans le Détail (un site et côte à côte).
**Sites historiques** (`"historique": true` dans `calcul/sites.json`) : groupe « Missions historiques » dans l'interface, exclus de la période commune (`plageCommune`) et de toute comparaison (non cochables, absents du côte à côte, repère gris non cliquable sur la carte) ; dans le Détail (mode « Un site »), les choisir place la date sur leur alunissage (`ajusterDatePourSite`, `etat.dateHistorique`) et revenir à un candidat restaure la date précédente (`etat.dateAvantHistorique`) ; leurs timelines couvrent leurs vraies dates et servent au rejeu du mode Découverte (`assurerDonnees` charge les dates de `MISSIONS_REELLES`).
**Langue (FR/EN)** (`web/js/i18n.js`, bouton FR/EN de l'en-tête, mémorisé dans le navigateur, paramètre de lien `lang`) :
les phrases construites dans le code passent par `t('texte français {x}', { x })` ; les textes fixes et les libellés exacts sont
traduits automatiquement (texte et attributs placeholder/aria-label/title/alt) par correspondance exacte avec le dictionnaire `EN`.
Nouveau texte : l'écrire en français, puis ajouter sa traduction dans `EN`. Formats : `formatNombre`, `localeDates`, `lettreJour` (J/D).
Noms et sources des sites en anglais : `NOMS_SITES_EN` (`nomCourt`, `nomLong`, `sourceSite`).
**Noms courts** : champ `nom_court` de `calcul/sites.json` → `court` dans `web/data/sites.json` → `nomCourt(site)`
(carte, tableaux, calendrier, menus). La carte place les étiquettes pour éviter les chevauchements.
« Les deux » compte un Soleil partiellement caché pour moitié, comme l'ensoleillement ; la plus longue nuit est
plafonnée à la durée de la série.

Valeurs par défaut de l'interface (`web/js/app.js`, objet `etat`) : sites `malapert_massif` et `leibnitz_beta`,
date 1er mars 2025, mission 14 jours, reports 0/7/15/30 jours, calendrier 60 jours.
Critères par défaut (33 % Soleil, 50 % Terre) : réglables, **pas des seuils NASA officiels**.
Un verdict est calculé même si une partie de la fenêtre est hors données (`resumer` ne compte que les heures connues,
champ `complet`) : près de la fin de la période, les reports lointains sont donc peu fiables (le texte sous la date le signale).

## Conventions (ne pas changer sans tout mettre à jour)

- Temps en **UTC**, angles en **degrés**, longitudes de -180 à +180 (est positif).
- Azimut : **0 = nord, 90 = est, sens horaire** (convention JPL Horizons).
- Hauteur du capteur : 1 m au-dessus du sol par défaut. Rayon lunaire de référence : 1 737 400 m.
- Un astre est visible si son altitude > hauteur de l'horizon à son azimut (arrondi au degré).

## Décisions techniques importantes

- **Relief et ciel au même point** : les coordonnées viennent de la tuile (`"point": "centre_tuile"`)
  ou de `sites.json`, sont écrites dans `horizon_<id>.json`, et `calcul_timeline.py` les relit là.
  Bug historique : l'horizon de Malapert (86°S) avait été combiné avec le ciel d'IM-1 (80°S, à 180 km) ;
  le « coucher d'IM-1 » obtenu était une fausse validation.
- **Nord de la carte** : en stéréographique polaire sud, le nord géographique est tourné d'un angle
  égal à la longitude ; le calcul utilise le gisement `azimut + longitude`.
- **Échelle de la projection** corrigée (`pyproj` `get_factors`) : ~3 % à 69°S, 0,1 % à 86°S.
- **Grandes tuiles** : avec `distance_max_m`, seule la fenêtre utile autour du site est lue.
- Correction de courbure `d²/2R` : valable seulement pour d << R → limiter la distance (ex. 150 km).

## Sites

| id | Tuile (`calcul/cartes/`) | Point | État |
| --- | --- | --- | --- |
| `malapert_massif` | `Site23_final_adj_5mpp_surf.tif` (5 m/px, 21×21 km) | centre : -85,99487 ; -0,23461 ; 4 783,63 m | horizon ; timeline 01/03-01/05/2025 ; précalcul 2025-2030 à lancer (`precalcul.py`) |
| `leibnitz_beta` | `Site20_final_adj_5mpp_surf.tif` (5 m/px, 16×16 km) | centre : -85,4266 ; 31,74418 ; 6 398,83 m | horizon ; timeline 01/03-01/05/2025 ; précalcul 2025-2030 à lancer |
| `connecting_ridge` | `Site01_final_adj_5mpp_surf.tif` (5 m/px, 16×16 km) | **sommet** de la tuile (pas le centre) : -89,43891 ; -137,14357 ; 1 959,5 m | horizon (de -3,65° à -0,47°) ; précalcul 2025-2030 à lancer. Le centre de la tuile, 740 m plus loin et 15 m plus bas, a un horizon jusqu'à 2,8° (masqué par la crête) |
| `im1_malapert_a` (historique) | `LDEM_60S_240MPP_ADJ.tiff` (240 m/px, `distance_max_m` 150 km) | -80,13 ; 1,44 (LROC, à vérifier) | horizon : jusqu'à 15,5° à l'ESE, dû à la pente locale vue à 240 m/px (peu fiable) ; timeline à calculer 15/02-31/03/2024 |
| `chandrayaan3` (historique) | `LDEM_60S_240MPP_ADJ.tiff` | -69,373 ; 32,319 (Shiv Shakti) | horizon 0,4° à 2,5° ; timeline à calculer 15/08-15/10/2023, puis `validation_chandrayaan3.py` |

Sources des tuiles :
- Produit 78 (5 m/px, 6 sites : Site01 Connecting ridge, 04 Shackleton rim, 07 Peak near Shackleton,
  11 de Gerlache rim, 20 Leibnitz beta plateau, 23 Malapert massif) : https://pgda.gsfc.nasa.gov/products/78
  – fichiers : https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
- Produit 90 (tout le pôle Sud, 10 à 240 m/px) : https://pgda.gsfc.nasa.gov/products/90
  – ex. https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF (Chandrayaan-3),
  `LDEM_80S_80MPP_ADJ.TIF` (relief lointain), `LDEM_75S_30MPP_ADJ.TIF` (IM-1, 2,7 Go).

Les .tif ne sont pas versionnés (trop lourds, voir `.gitignore`) : ils doivent être dans `calcul/cartes/`.

## Résultats et sensibilité

Malapert, 22/02-02/03/2024 : Soleil ~41 %, Terre ~60 %. Mars 2025 : Soleil 7,2 % seulement (Soleil plus bas
cette « saison » lunaire, max 4,09°, caché de 0,3° par la crête au nord ; visible seulement au sud, sous
l'horizon géométrique, le point étant en hauteur). Fourchette selon les incertitudes : ~3 % à ~19 %.
Leibnitz bêta, 22/02-02/03/2024 : Soleil 36,4 %, Terre 43,8 %, **jamais les deux en même temps**
(la Terre reste au nord-nord-ouest, ~328°, où le relief bloque aussi le Soleil quand il est au plus haut).

**Les résultats sont très sensibles** : le Soleil ne dépasse le relief que de 0,9° au maximum.
Décaler le point d'un pixel (5 m) change l'horizon jusqu'à 0,9° ; une différence de 0,005° sur la
position de la Terre a déjà décalé un coucher d'une heure. Présenter les heures comme des estimations
à quelques heures près, jamais comme des valeurs exactes.

Leibnitz bêta : le centre est sur une pente de 8° qui monte vers le nord, à 674 m d'un sommet 65 m
plus haut → horizon à 8° au nord, là où le Soleil culmine (~6° max) : probablement peu éclairé.
Idée de démo : comparer avec le sommet voisin.

**Validation Chandrayaan-3 (vraies données, 15/11/2026)** : lever géométrique calculé le 21/08 17:00 UTC, coucher le
04/09 06:00 UTC (Vikram mis en veille le 04/09 02:30 UTC, Soleil alors à +0,5° du relief), lever suivant le 20/09 01:00 UTC.
L'ISRO visait un réveil le 22/09 : le Soleil y retrouve la hauteur qu'il avait à l'atterrissage (8,7°, azimut 62°) le
21/09 22:00 UTC, soit 2 h d'écart. Le critère « même hauteur qu'à l'atterrissage » a été choisi APRÈS avoir vu l'écart
de 47 h avec le lever géométrique : le dire ainsi. Argument : l'atterrissage du 23/08 suit aussi le lever géométrique
de 1,8 jour, le même décalage que le 22/09 par rapport au 20/09.

## Limites connues (à citer au jury)

- Relief analysé seulement jusqu'au bord de la tuile (~8 à 10 km pour les tuiles 5 m) ; au pôle,
  des reliefs plus lointains peuvent masquer le Soleil rasant → résultats plutôt optimistes.
  Amélioration possible : tuile fine pour le proche + tuile large (produit 90) pour le lointain.
- Soleil traité comme un point (son disque fait ~0,5°), azimut arrondi au degré, pas d'une heure.

## Validation : ce qui est fait et ce qui ne l'est pas

- Fait : 10 tests synthétiques ; cohérence physique des éphémérides (Soleil max ≈ 90 - |lat| + 1,5°,
  ~12,2°/jour d'est en ouest, Terre vers le nord pour une longitude ≈ 0°).
- À faire : `validation_chandrayaan3.py` (attendus : Soleil visible le 23/08/2023, coucher entre le
  04/09 et le 08/09, lever à ± 1,5 jour du 22/09 attendu par l'ISRO, Terre visible pendant la mission).
- À faire : comparaison visuelle avec l'animation NASA « Illumination at the Moon's South Pole to 80°S,
  2025 to 2028 » https://svs.gsfc.nasa.gov/5027 (couvre 2025-2028 seulement : calculer une timeline
  Malapert en 2025).
- Référence publiée possible plus tard : Gläser et al. 2014, point le mieux éclairé de Connecting Ridge
  = 92,27 % du temps à 2 m du sol (22/10/2018-22/10/2019, DTM 20 m) → tuile Site01.
- **Ne pas présenter comme validations** : la date d'extinction d'IM-1 (atterrisseur posé de travers,
  énergie réduite) ; un test « Shackleton à 0 % » sans tuile qui couvre Shackleton.
- Dire au jury « calculé à partir de données NASA (LOLA, JPL Horizons) », pas « données NASA ».

## Environnement et pièges

- Windows, dossier iCloud Drive : `...\nasa challenge 2026\NASAHackathon_v5\NASAHackathon` (avec `venv`, `calcul/`, `web/`).
  C'est **le** dossier du projet. Obsolètes, ne plus les modifier : `NASAHackathon_v4`, les anciens scripts
  à la racine (`calcul_horizon.py`, `calcul_timeline.py`, `app.py`, `sites.json`, `horizon_*.json`, `timeline_*.csv`…),
  le dossier `lunar-navigator` et le zip `lunar-control`.
- venv : `venv\Scripts\activate`, puis `pip install -r calcul/requirements.txt`.
- JPL Horizons demande internet ; `calcul_timeline.py` doit tourner sur la machine de l'équipe.
- Une seule version du code : éviter de recréer des scripts parallèles (`NASAHackathon.py`, `NASAHackathonv3.py`,
  `generer_sites*.py` sont obsolètes). Erreurs déjà commises avec ces scripts : repli silencieux sur la carte de
  Malapert pour un identifiant mal tapé (« site 20 »), et oubli de la correction du nord, qui tournait l'horizon
  de Leibnitz bêta de ~32° (92 % de Soleil au lieu de 36 %).
- Après chaque modification du calcul : relancer `python calcul/tests_horizon.py`.

## Prochaines étapes possibles

1. Lancer `precalcul.py` (Malapert et Leibnitz bêta, 2025-2030), puis `exporter_web.py`. Les sites historiques gardent
   une période libre (`calcul_timeline.py`) autour de leur vraie date, hors de la comparaison des candidats.
2. Validation Chandrayaan-3 (télécharger la tuile, calculer, `validation_chandrayaan3.py`), puis export :
   le rejeu de mission de l'interface utilise ce site.
3. Comparaison visuelle avec l'animation NASA https://svs.gsfc.nasa.gov/5027 sur mars 2025.
4. Afficher l'incertitude (quelques points dans un rayon de 100 m) plutôt qu'une valeur unique.
5. Relief lointain avec une tuile du produit 90.
6. Mise en ligne de `web/` sur GitHub Pages.
