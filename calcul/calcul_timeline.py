"""Étapes 2 et 3 : éphémérides du Soleil et de la Terre (JPL Horizons) + visibilité.

Usage :
    python calcul_timeline.py malapert_massif --debut 2024-02-22 --fin 2024-03-02
    python calcul_timeline.py malapert_massif --debut 2024-02-22 --fin 2024-03-02 --pas 30m --apercu

Lit resultats/horizon_<id>.json (profil d'horizon + coordonnées exactes du point),
interroge JPL Horizons à ces coordonnées, et écrit resultats/timeline_<id>.csv.
Sans fichier d'horizon : horizon plat (0°) et coordonnées de sites.json.
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
import pandas as pd


def charger_site(site_id, chemin=SITES):
    with open(chemin, encoding="utf-8") as f:
        sites = json.load(f)
    for s in sites:
        if s["id"] == site_id:
            return s
    raise SystemExit(f"Site '{site_id}' absent de {chemin}.")


def point_du_site(site):
    """Horizon et coordonnées du point calculé, relus dans resultats/horizon_<id>.json.

    Le ciel est ainsi calculé exactement au point où l'horizon a été calculé.
    Sans fichier d'horizon : horizon plat (0°) et coordonnées de sites.json.
    Renvoie (horizon_360, lat, lon, altitude_m).
    """
    try:
        with open(RESULTATS / f"horizon_{site['id']}.json", encoding="utf-8") as f:
            h = json.load(f)
        elev_m = h["altitude_sol_m"] + h["hauteur_capteur_m"]
        print(f"Point lu dans horizon_{site['id']}.json : lat {h['lat']}°, lon {h['lon']}°, altitude {elev_m:.1f} m.")
        return h["horizon_elevation_deg"], h["lat"], h["lon"], elev_m
    except FileNotFoundError:
        if site.get("lat") is None or site.get("lon") is None:
            raise SystemExit(f"Ni horizon_{site['id']}.json ni coordonnées dans sites.json pour {site['id']}.")
        print(f"horizon_{site['id']}.json absent : horizon plat (0°) et coordonnées de sites.json.")
        return [0.0] * 360, site["lat"], site["lon"], site.get("altitude_sol_m", 0.0)


def get_sun_earth_ephemerides(lat_deg, lon_deg, elev_m, start_date, stop_date, step="1h"):
    from astroquery.jplhorizons import Horizons

    lunar_site = {"lon": float(lon_deg), "lat": float(lat_deg), "elevation": float(elev_m) / 1000.0, "body": 301}
    epochs = {"start": start_date, "stop": stop_date, "step": step}
    print(f"Requête JPL Horizons ({start_date} -> {stop_date}, pas {step})...")
    sun = Horizons(id="10", location=lunar_site, epochs=epochs).ephemerides(quantities="4").to_pandas()
    earth = Horizons(id="399", location=lunar_site, epochs=epochs).ephemerides(quantities="4").to_pandas()
    return pd.DataFrame({
        "datetime": pd.to_datetime(sun["datetime_str"]),
        "sun_az": sun["AZ"].astype(float),
        "sun_alt": sun["EL"].astype(float),
        "earth_az": earth["AZ"].astype(float),
        "earth_alt": earth["EL"].astype(float),
    })


def compute_visibility_timeline(df, horizon_360):
    horizon_arr = np.asarray(horizon_360, dtype=float)
    df["sun_horizon_alt"] = horizon_arr[df["sun_az"].round().astype(int) % 360]
    df["earth_horizon_alt"] = horizon_arr[df["earth_az"].round().astype(int) % 360]
    df["sun_visible"] = (df["sun_alt"] > df["sun_horizon_alt"]).astype(int)
    df["earth_visible"] = (df["earth_alt"] > df["earth_horizon_alt"]).astype(int)
    df["both_visible"] = df["sun_visible"] & df["earth_visible"]
    return df


def resume(df):
    for col, nom in [("sun_visible", "Soleil"), ("earth_visible", "Terre")]:
        couchers = df.loc[df[col].diff() == -1, "datetime"]
        levers = df.loc[df[col].diff() == 1, "datetime"]
        print(f"{nom} visible {df[col].mean() * 100:.1f} % du temps ; "
              f"couchers : {[str(t) for t in couchers] or 'aucun'} ; levers : {[str(t) for t in levers] or 'aucun'}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("site_id")
    p.add_argument("--debut", required=True, help="AAAA-MM-JJ ou 'AAAA-MM-JJ HH:MM' (UTC)")
    p.add_argument("--fin", required=True)
    p.add_argument("--pas", default="1h")
    p.add_argument("--apercu", action="store_true", help="enregistrer aussi timeline_<id>_preview.png")
    args = p.parse_args()

    site = charger_site(args.site_id)
    horizon_360, lat, lon, elev_m = point_du_site(site)

    df = get_sun_earth_ephemerides(lat, lon, elev_m, args.debut, args.fin, args.pas)
    df = compute_visibility_timeline(df, horizon_360)
    df.insert(1, "site_id", site["id"])

    RESULTATS.mkdir(exist_ok=True)
    nom = RESULTATS / f"timeline_{site['id']}.csv"
    df.to_csv(nom, index=False)
    print(f"resultats/{nom.name} écrit ({len(df)} lignes).")
    resume(df)

    if args.apercu:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.figure(figsize=(12, 5))
        plt.plot(df["datetime"], df["sun_alt"], color="orange", lw=2, label="Soleil")
        plt.plot(df["datetime"], df["sun_horizon_alt"], color="gray", ls="--", label="Horizon face au Soleil")
        plt.plot(df["datetime"], df["earth_alt"], color="royalblue", lw=2, label="Terre")
        plt.plot(df["datetime"], df["earth_horizon_alt"], color="lightblue", ls=":", label="Horizon face à la Terre")
        plt.ylabel("Élévation (°)")
        plt.xlabel("UTC")
        plt.title(f"Fenêtres Énergie et Communication – {site['nom']}")
        plt.legend(loc="upper right", fontsize="small", ncol=2)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(RESULTATS / f"timeline_{site['id']}_preview.png", dpi=150)
        print(f"resultats/timeline_{site['id']}_preview.png écrit.")


if __name__ == "__main__":
    main()
