"""Précalcul des timelines année par année, pour que l'interface accepte n'importe quelle date de la plage.

Usage (depuis le dossier du projet) :
    python calcul/precalcul.py                                   # sites ayant un horizon, 2025 à 2030
    python calcul/precalcul.py malapert_massif --de 2025 --a 2027
    python calcul/precalcul.py --force                           # recalcule même les années déjà faites

Pour chaque site et chaque année, interroge JPL Horizons (pas d'une heure par défaut) et écrit
resultats/timelines/<id>_<annee>.csv (mêmes colonnes que calcul_timeline.py).
Une année déjà calculée est sautée : on peut relancer le script après une coupure réseau.
Il faut ensuite lancer exporter_web.py pour mettre l'interface à jour.

Durée indicative : quelques secondes à une minute par site et par année (deux requêtes Horizons).
"""
import argparse
import json
import time

import pandas as pd

from calcul_timeline import (RESULTATS, SITES, compute_visibility_timeline,
                             get_sun_earth_ephemerides, point_du_site)

DOSSIER_ANNEES = RESULTATS / "timelines"
ESSAIS = 3


def sites_par_defaut():
    """Les sites dont l'horizon a déjà été calculé (les autres n'auraient qu'un horizon plat)."""
    with open(SITES, encoding="utf-8") as f:
        sites = json.load(f)
    return [s for s in sites if (RESULTATS / f"horizon_{s['id']}.json").exists()]


def calculer_annee(site, annee, pas, point):
    horizon_360, lat, lon, elev_m = point
    debut, fin = f"{annee}-01-01 00:00", f"{annee + 1}-01-01 00:00"
    for essai in range(1, ESSAIS + 1):
        try:
            df = get_sun_earth_ephemerides(lat, lon, elev_m, debut, fin, pas)
            break
        except Exception as erreur:  # coupure réseau, Horizons surchargé...
            if essai == ESSAIS:
                raise
            print(f"  échec ({erreur}) ; nouvel essai dans 10 s...")
            time.sleep(10)
    # Horizons inclut la date de fin : on retire le 1er janvier 00:00 de l'année suivante.
    df = df[df["datetime"].dt.year == annee].reset_index(drop=True)
    df = compute_visibility_timeline(df, horizon_360)
    df.insert(1, "site_id", site["id"])
    return df


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("site_ids", nargs="*", help="par défaut : tous les sites qui ont un fichier horizon")
    p.add_argument("--de", type=int, default=2025, help="première année (défaut 2025)")
    p.add_argument("--a", type=int, default=2030, help="dernière année incluse (défaut 2030)")
    p.add_argument("--pas", default="1h", help="pas de temps (défaut 1h ; l'interface suppose un pas régulier)")
    p.add_argument("--force", action="store_true", help="recalculer les années déjà présentes")
    args = p.parse_args()

    with open(SITES, encoding="utf-8") as f:
        tous = {s["id"]: s for s in json.load(f)}
    if args.site_ids:
        inconnus = [i for i in args.site_ids if i not in tous]
        if inconnus:
            raise SystemExit(f"Sites absents de sites.json : {', '.join(inconnus)}. Identifiants possibles : {', '.join(tous)}.")
        sites = [tous[i] for i in args.site_ids]
    else:
        sites = sites_par_defaut()
        if not sites:
            raise SystemExit("Aucun site n'a de fichier horizon : lancer d'abord calcul_horizon.py.")

    annees = range(args.de, args.a + 1)
    print(f"Sites : {', '.join(s['id'] for s in sites)} ; années {args.de} à {args.a} ; pas {args.pas}.")
    DOSSIER_ANNEES.mkdir(parents=True, exist_ok=True)

    echecs = []
    for site in sites:
        print(f"\n== {site['id']} ==")
        point = point_du_site(site)
        for annee in annees:
            fichier = DOSSIER_ANNEES / f"{site['id']}_{annee}.csv"
            if fichier.exists() and not args.force:
                print(f"{annee} : déjà calculé ({fichier.name}), sauté.")
                continue
            try:
                df = calculer_annee(site, annee, args.pas, point)
            except Exception as erreur:
                print(f"{annee} : ÉCHEC ({erreur}). Relancer le script plus tard : les années faites seront gardées.")
                echecs.append(f"{site['id']} {annee}")
                continue
            df.to_csv(fichier, index=False)
            print(f"{annee} : {len(df)} lignes, Soleil visible {df['sun_visible'].mean() * 100:.1f} %, "
                  f"Terre visible {df['earth_visible'].mean() * 100:.1f} % -> {fichier.name}")

    if echecs:
        print(f"\nAnnées manquantes : {', '.join(echecs)}. Relancer la même commande pour les compléter.")
    print("\nEnsuite : python calcul/exporter_web.py")


if __name__ == "__main__":
    main()
