# Lunar Landing Site Navigator

Projet pour le NASA Space Apps Challenge 2026, défi « Lunar Landing Site Navigator ».

Un outil pour **comparer rapidement des combinaisons site + date d'alunissage** au pôle Sud lunaire.
Pour chaque scénario, il répond aux deux questions d'un planificateur de mission :

- **Énergie** : le Soleil est-il au-dessus du relief réel du site, à quelle hauteur, et pour combien de temps ?
- **Communication** : la Terre est-elle visible pour une liaison directe, et jusqu'à quand ?

- **Site en ligne :** https://COMPTE.github.io/DEPOT/ *(à compléter après la publication)*
- **Vidéo / présentation :** *(à compléter)*

## Ce que fait l'interface

| Onglet | Contenu |
| --- | --- |
| **Découverte** | Parcours en 4 étapes pour le grand public : Soleil rasant, relief qui le cache, Terre qui apparaît et disparaît, rejeu de deux missions réelles (IM-1, Chandrayaan-3). |
| **1. Sites et dates** | Choix des sites (liste ou carte polaire), durée de la mission, dates alternatives à tester (+7, +15, +30 jours…). |
| **2. Détail** | Date d'alunissage ; élévations et comptes à rebours avant le coucher du Soleil et de la Terre ; panorama de l'horizon à 360° ; **dôme du ciel en 3D** ; frise de la mission ; comparaison avec un sol plat. Mode **côte à côte** : deux sites, mêmes conditions, avec un tableau des compromis. |
| **3. Comparaison** | Grille sites × reports avec verdict (viable, limite, exclu) selon des critères réglables, et une phrase de conclusion. |
| **4. Calendrier** | Faisabilité de chaque date d'alunissage sur 60 jours et plus longue fenêtre de tir. |
| **5. Période** | Soleil visible semaine par semaine sur une année (saisons lunaires), zoom sur une fenêtre de dates, bilan par site. |

Le bouton « Copier le lien du scénario » enregistre site, date, reports et critères dans l'adresse de la page.
L'interface existe en **français et en anglais** (bouton FR/EN en haut à droite).

Les critères par défaut (33 % de Soleil, 50 % de Terre, 48 h de nuit au plus, 1° de marge) sont **indicatifs et réglables** :
ce ne sont pas des seuils officiels de la NASA.

## Sites

| Site | Position | Relief | Données |
| --- | --- | --- | --- |
| Massif de Malapert (Site23) | 86,0°S | LOLA 5 m/px | 2025-2030 |
| Plateau Leibnitz β (Site20) | 85,4°S | LOLA 5 m/px | 2025-2030 |
| Connecting Ridge (Site01, sommet de la crête) | 89,4°S | LOLA 5 m/px | 2025-2030 |
| IM-1 Odysseus (historique) | 80,1°S | LOLA 240 m/px | février-mars 2024 |
| Chandrayaan-3 Vikram (historique) | 69,4°S | LOLA 240 m/px | août-octobre 2023 |

## Méthode

1. **Horizon réel** (`calcul_horizon.py`) : à partir des modèles d'élévation LOLA, hauteur du relief dans chaque direction
   (360 azimuts), avec correction du nord de la projection polaire, de l'échelle de projection et de la courbure lunaire.
2. **Positions du Soleil et de la Terre** (`precalcul.py`, `calcul_timeline.py`) : éphémérides JPL Horizons, heure par heure,
   calculées exactement au point où l'horizon a été calculé.
3. **Visibilité** (dans le navigateur) : un astre est visible s'il est au-dessus du relief dans sa direction ; le disque solaire
   (0,53°) peut être partiellement caché. L'interface en déduit pourcentages, plus longue nuit, comptes à rebours et verdicts.

## Résultats et validation

- **Chandrayaan-3** (`calcul/validation_chandrayaan3.py`, 4/4) : coucher du Soleil calculé le 04/09/2023 à 06:00 UTC,
  3 h 30 après la mise en veille de Vikram ; le Soleil retrouve la position qu'il avait à l'alunissage le 21/09 à 22:00 UTC,
  2 h avant le réveil visé par l'ISRO (22/09). Ce dernier critère a été défini après avoir constaté que le 22/09 ne correspondait
  pas au lever géométrique (20/09) : l'alunissage du 23/08 suivait lui aussi le lever géométrique d'environ 2 jours.
- **Connecting Ridge** : Soleil visible 88 % du temps sur 2025-2030, à comparer aux ~92 % publiés pour le point le mieux éclairé
  de cette crête (Gläser et al., 2014, à 2 m du sol, sur un an).
- **Contraste entre sites** (2025-2030) : Soleil visible 15 % à Malapert, 20 % à Leibnitz β, 88 % à Connecting Ridge ;
  missions de 14 jours viables avec les critères par défaut : 0 %, 0,5 % et 50 %.
- **Tests** : `calcul/tests_horizon.py`, 10 tests du calcul d'horizon sur des reliefs artificiels.

## Limites

- Le relief n'est analysé que jusqu'au bord de la carte (environ 7 à 10 km pour les cartes à 5 m/px) : un relief plus lointain
  peut masquer le Soleil rasant, les pourcentages sont donc plutôt optimistes.
- Les résultats sont très sensibles à la position exacte du point : 5 m de décalage peuvent changer l'horizon de près d'un degré.
  L'outil compare des sites et des dates ; il ne certifie pas un point d'alunissage précis.
- IM-1 : relief à 240 m/px, coordonnées à vérifier, et atterrisseur couché sur le flanc : le coucher prédit est une estimation,
  pas une validation.
- Les heures sont des estimations à quelques heures près.

## Organisation

```
NASAHackathon/
├── calcul/                    moteur de calcul (Python)
│   ├── sites.json             la liste des sites (source unique)
│   ├── calcul_horizon.py      relief LOLA -> resultats/horizon_<id>.json
│   ├── precalcul.py           JPL Horizons année par année -> resultats/timelines/<id>_<annee>.csv
│   ├── calcul_timeline.py     JPL Horizons sur une période libre -> resultats/timeline_<id>.csv
│   ├── exporter_web.py        résultats -> web/data (format de l'interface)
│   ├── tests_horizon.py       tests du calcul d'horizon
│   ├── validation_chandrayaan3.py
│   ├── app_streamlit.py       outil de vérification rapide (optionnel)
│   ├── cartes/                cartes LOLA .tif (non versionnées, voir plus bas)
│   └── resultats/
├── web/                       l'interface (HTML, CSS, JavaScript, sans framework)
│   ├── index.html, css/, js/, img/
│   └── data/                  GÉNÉRÉ par exporter_web.py : ne pas modifier à la main
└── .github/workflows/pages.yml  publication automatique de web/ sur GitHub Pages
```

## Lancer l'interface en local

```
cd web
python -m http.server 8000
```

puis ouvrir http://localhost:8000. Il faut lancer le serveur **depuis le dossier `web`** : ouvrir `index.html` directement
ne fonctionne pas (le navigateur refuse alors de lire `data/`).

## Recalculer les données

Installation (une fois) :

```
python -m venv venv
venv\Scripts\activate            (Mac/Linux : source venv/bin/activate)
pip install -r calcul/requirements.txt
```

Cartes LOLA à placer dans `calcul/cartes/` (trop lourdes pour GitHub) :

- produit 78, tuiles à 5 m/px : `Site01_…`, `Site20_…`, `Site23_final_adj_5mpp_surf.tif`
  (https://pgda.gsfc.nasa.gov/products/78, fichiers : https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) ;
- produit 90, `LDEM_60S_240MPP_ADJ` pour IM-1 et Chandrayaan-3 (https://pgda.gsfc.nasa.gov/products/90).

Depuis le dossier du projet (JPL Horizons demande une connexion internet) :

```
python calcul/tests_horizon.py                               # 10/10 attendu
python calcul/calcul_horizon.py <id> --apercu                # une fois par site
python calcul/precalcul.py                                   # sites candidats, 2025 à 2030 (reprend là où il s'est arrêté)
python calcul/calcul_timeline.py chandrayaan3 --debut 2023-08-15 --fin 2023-10-15
python calcul/calcul_timeline.py im1_malapert_a --debut 2024-02-15 --fin 2024-03-31
python calcul/validation_chandrayaan3.py
python calcul/exporter_web.py                                # toujours en dernier
```

Pour ajouter un site : une entrée dans `calcul/sites.json` (`id`, `nom`, `nom_court`, `dem`, `lat`/`lon` ou
`"point": "centre_tuile"`, `source`, et `"historique": true` pour une mission passée), sa carte dans `calcul/cartes/`,
puis `calcul_horizon.py`, `precalcul.py` (ou `calcul_timeline.py`) et `exporter_web.py`.
Les sites comparés doivent être calculés sur les mêmes années.

## Publication (GitHub Pages)

1. Envoyer le projet sur un dépôt GitHub public. Le `.gitignore` exclut les cartes, `venv/` et `__pycache__/`.
   Éviter de garder le dépôt Git dans un dossier synchronisé (iCloud, OneDrive) : la synchronisation peut abîmer `.git`.
2. Sur GitHub : **Settings > Pages > Build and deployment > Source : GitHub Actions**.
3. Chaque envoi qui modifie `web/` republie le site (`.github/workflows/pages.yml`) ; on peut aussi le relancer
   à la main depuis l'onglet **Actions**. L'adresse apparaît dans Settings > Pages.

Les données ne sont pas recalculées en ligne : lancer `python calcul/exporter_web.py` et envoyer `web/data/` avec le reste.

## Crédits

- Relief : NASA Goddard, Planetary Geodesy Data Archive (LOLA, produits 78 et 90).
- Éphémérides : NASA JPL Horizons (via astroquery).
- Les résultats sont **calculés à partir de** ces données ; ce ne sont pas des produits officiels de la NASA.

## Utilisation de l'IA

Conformément au règlement de Space Apps : le code et une partie de l'analyse ont été réalisés avec l'aide d'une IA
(Claude, Anthropic). Usage à déclarer dans le formulaire de soumission.
