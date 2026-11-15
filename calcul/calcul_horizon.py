"""Étape 1 : calcul de l'horizon réel d'un site à partir d'une tuile de relief LOLA.

Usage :
    python calcul_horizon.py malapert_massif
    python calcul_horizon.py malapert_massif --hauteur 1.0 --distance-max 10500 --apercu

Lit l'entrée du site dans calcul/sites.json (la carte doit être dans calcul/cartes/) :
  - "point": "centre_tuile" -> le site est le pixel central de la tuile ; ses
    coordonnées sont calculées depuis la tuile et réécrites dans sites.json ;
  - sinon "lat" et "lon" donnent le point, placé sur la tuile.

Écrit resultats/horizon_<id>.json : coordonnées exactes du point, altitude du sol,
hauteur du capteur et 360 hauteurs d'horizon (une par degré d'azimut).
Ces coordonnées sont celles que calcul_timeline.py envoie à JPL Horizons :
le relief et le ciel portent toujours sur le même point.
"""
import argparse
import json

from pathlib import Path

# Chemins fixes : les scripts marchent quel que soit le dossier d'où on les lance.
DOSSIER = Path(__file__).resolve().parent
SITES = DOSSIER / "sites.json"
CARTES = DOSSIER / "cartes"
RESULTATS = DOSSIER / "resultats"

import numpy as np
import rasterio
from pyproj import CRS, Proj, Transformer
from rasterio.transform import rowcol
from rasterio.windows import Window, from_bounds

R_MOON = 1737400.0  # rayon lunaire de référence (m), le même que celui des tuiles LOLA


def charger_sites(chemin=SITES):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def trouver_site(sites, site_id):
    for s in sites:
        if s["id"] == site_id:
            return s
    raise SystemExit(f"Site '{site_id}' absent de sites.json.")


def mettre_a_jour_site(site_id, champs, chemin=SITES):
    """Met à jour une seule entrée de sites.json, sans toucher aux autres sites."""
    sites = charger_sites(chemin)
    trouver_site(sites, site_id).update(champs)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(sites, f, indent=4, ensure_ascii=False)


def compute_horizon_360(tif_path, lat_deg=None, lon_deg=None, obs_height=1.0, max_dist_m=None):
    """Hauteur de l'horizon (degrés) pour chaque azimut géographique 0..359.

    Sans lat/lon, le point étudié est le pixel central de la tuile.
    Azimut : 0 = nord, 90 = est, sens horaire (même convention que JPL Horizons).
    """
    with rasterio.open(tif_path) as src:
        res = src.res[0]  # taille d'un pixel en mètres de projection (pixels carrés)
        crs = CRS.from_wkt(src.crs.to_wkt())
        if lat_deg is None or lon_deg is None:
            # Point = centre de la tuile ; coordonnées déduites de la projection
            x_site, y_site = src.xy(src.height // 2, src.width // 2)
            vers_geo = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
            lon_deg, lat_deg = vers_geo.transform(x_site, y_site)
        else:
            vers_proj = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
            x_site, y_site = vers_proj.transform(lon_deg, lat_deg)
            r_tuile, c_tuile = src.index(x_site, y_site)
            if not (0 <= r_tuile < src.height and 0 <= c_tuile < src.width):
                raise SystemExit(
                    f"Le site ({lat_deg}, {lon_deg}) est hors de la tuile {tif_path}. "
                    "Il faut une tuile de relief qui couvre ce site."
                )

        # Grandes tuiles : on ne lit que le carré de côté 2 x max_dist_m autour du site.
        if max_dist_m:
            fenetre = from_bounds(x_site - max_dist_m, y_site - max_dist_m,
                                  x_site + max_dist_m, y_site + max_dist_m, src.transform)
            fenetre = fenetre.round_offsets().round_lengths().intersection(
                Window(0, 0, src.width, src.height))
        else:
            fenetre = Window(0, 0, src.width, src.height)
        dem = src.read(1, window=fenetre).astype(np.float32)
        if src.nodata is not None and not np.isnan(src.nodata):
            dem[dem == src.nodata] = np.nan
        transform = src.window_transform(fenetre)
        nrows, ncols = dem.shape
        row0, col0 = rowcol(transform, x_site, y_site)
        decalage = (int(fenetre.row_off), int(fenetre.col_off))

        z_sol = float(dem[row0, col0])
        if np.isnan(z_sol):
            raise SystemExit("Le pixel du site ne contient pas d'altitude (NoData).")
        z0 = z_sol + obs_height

        # Échelle locale de la projection : loin du pôle, 1 m sur la carte
        # ne vaut plus exactement 1 m au sol (environ 3 % d'écart à 69°S).
        echelle = Proj(crs).get_factors(lon_deg, lat_deg).meridional_scale

        # Rayons de 1 pixel jusqu'à la diagonale de la zone lue (ou jusqu'à max_dist_m au sol)
        n_max = int(np.hypot(nrows, ncols))
        if max_dist_m:
            n_max = min(n_max, int(max_dist_m * echelle / res) + 1)
        steps = np.arange(1, n_max)
        distances = steps * res / echelle  # distances réelles au sol (m)
        chute_courbure = distances ** 2 / (2.0 * R_MOON)

        # En projection stéréographique polaire sud, le nord géographique local
        # est tourné d'un angle égal à la longitude par rapport au haut de la carte.
        horizon = np.zeros(360)
        distance_vue = np.zeros(360)
        for az in range(360):
            gisement = np.deg2rad(az + lon_deg)  # direction sur la grille
            r = np.round(row0 - steps * np.cos(gisement)).astype(int)  # lignes : vers le bas = sud de la grille
            c = np.round(col0 + steps * np.sin(gisement)).astype(int)
            ok = (r >= 0) & (r < nrows) & (c >= 0) & (c < ncols)
            if not np.any(ok):
                continue
            dz = dem[r[ok], c[ok]] - z0 - chute_courbure[ok]
            horizon[az] = np.nanmax(np.rad2deg(np.arctan2(dz, distances[ok])))
            distance_vue[az] = distances[ok][-1]

    meta = {
        "lat": round(float(lat_deg), 5),
        "lon": round(float(lon_deg), 5),
        "pixel_row": int(row0) + decalage[0],
        "pixel_col": int(col0) + decalage[1],
        "echelle_projection": round(float(echelle), 5),
        "x_proj_m": float(x_site),
        "y_proj_m": float(y_site),
        "altitude_sol_m": round(float(z_sol), 2),
        "hauteur_capteur_m": float(obs_height),
        "distance_max_analysee_m": float(distance_vue.min()),
    }
    return np.arange(360), horizon, meta


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("site_id")
    p.add_argument("--hauteur", type=float, default=1.0, help="hauteur du capteur au-dessus du sol (m)")
    p.add_argument("--distance-max", type=float, default=None,
                   help="distance maximale analysée (m) ; par défaut jusqu'au bord de la tuile")
    p.add_argument("--apercu", action="store_true", help="enregistrer aussi horizon_<id>_preview.png")
    args = p.parse_args()

    site = trouver_site(charger_sites(), args.site_id)
    if not site.get("dem"):
        raise SystemExit(f"Aucune tuile de relief ('dem') renseignée pour {args.site_id} dans sites.json.")

    carte = CARTES / site["dem"]
    if not carte.exists():
        raise SystemExit(f"Carte introuvable : {carte}\nPlace le fichier {site['dem']} dans le dossier calcul/cartes/.")
    RESULTATS.mkdir(exist_ok=True)
    centre = site.get("point") == "centre_tuile"
    # Distance maximale : option de la ligne de commande, sinon valeur de sites.json, sinon bord de la tuile
    distance_max = args.distance_max or site.get("distance_max_m")
    az, horizon, meta = compute_horizon_360(
        str(carte), None if centre else site["lat"], None if centre else site["lon"],
        args.hauteur, distance_max,
    )

    sortie = {
        "site_id": site["id"],
        "nom": site.get("nom", site["id"]),
        "tuile_relief": site["dem"],
        "convention_azimut": "0 = nord, 90 = est, sens horaire",
        **meta,
        "azimuth_deg": az.tolist(),
        "horizon_elevation_deg": np.round(horizon, 3).tolist(),
    }
    nom = RESULTATS / f"horizon_{site['id']}.json"
    with open(nom, "w", encoding="utf-8") as f:
        json.dump(sortie, f, indent=2, ensure_ascii=False)

    # sites.json reçoit les coordonnées exactes du point calculé (seulement cette entrée)
    mettre_a_jour_site(site["id"], {"lat": meta["lat"], "lon": meta["lon"], "altitude_sol_m": meta["altitude_sol_m"]})

    print(f"resultats/{nom.name} écrit pour le point lat {meta['lat']}°, lon {meta['lon']}°, altitude {meta['altitude_sol_m']} m "
          f"(pixel {meta['pixel_row']}, {meta['pixel_col']}).")
    print(f"Horizon de {horizon.min():.2f}° à {horizon.max():.2f}°, "
          f"relief analysé jusqu'à {meta['distance_max_analysee_m'] / 1000:.1f} km minimum.")

    if args.apercu:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.figure(figsize=(10, 4))
        plt.fill_between(az, -10, horizon, color="lightgray", label="Relief (LOLA)")
        plt.plot(az, horizon, color="dimgray", linewidth=1.5, label="Horizon local réel")
        plt.axhline(0, color="black", linestyle="--", linewidth=0.8, label="Horizon géométrique (0°)")
        plt.xlim(0, 359)
        plt.ylim(-5, max(15, horizon.max() + 2))
        plt.xticks([0, 90, 180, 270, 359], ["Nord", "Est", "Sud", "Ouest", "Nord"])
        plt.ylabel("Élévation (°)")
        plt.title(f"Horizon réel – {site.get('nom', site['id'])}")
        plt.legend(loc="upper right")
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(RESULTATS / f"horizon_{site['id']}_preview.png", dpi=150)
        print(f"resultats/horizon_{site['id']}_preview.png écrit.")


if __name__ == "__main__":
    main()
