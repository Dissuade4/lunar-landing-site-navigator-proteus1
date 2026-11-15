"""Étape 4 : exporte les résultats Python vers l'interface web (dossier ../web/data).

Usage :
    python calcul/exporter_web.py

Lit calcul/sites.json et calcul/resultats/, puis écrit :
  web/data/sites.json                  liste des sites (longitude de 0 à 360, groupe pole/autre/historique)
                                       + pour chaque site calculé : "timeline": {"annees", "debut", "fin", "pas_h"}
  web/data/horizon/<id>.json           {"site_id", "pas_deg": 1, "hauteurs": [360 valeurs]}
  web/data/timeline/<id>/<annee>.csv   time_utc, sun_az, sun_el, earth_az, earth_el (une année civile UTC par fichier)

Les positions d'un site sont rassemblées depuis :
  resultats/timelines/<id>_<annee>.csv   (precalcul.py, prioritaires)
  resultats/timeline_<id>.csv            (calcul_timeline.py, période libre)
puis remises sur une grille régulière (les heures manquantes restent vides : « pas de données » dans l'interface).
L'interface ne charge que les années dont elle a besoin pour la date choisie.

Le dossier web/data est entièrement regénéré : ne pas le modifier à la main.
La visibilité est recalculée par l'interface à partir de l'horizon et des positions.
"""
import json
import shutil
from pathlib import Path

import pandas as pd

DOSSIER = Path(__file__).resolve().parent
SITES = DOSSIER / "sites.json"
RESULTATS = DOSSIER / "resultats"
DOSSIER_ANNEES = RESULTATS / "timelines"
WEB_DATA = DOSSIER.parent / "web" / "data"


def lire_positions(site_id):
    """Toutes les positions connues d'un site, triées, sans doublon. None si aucune."""
    fichiers = sorted(DOSSIER_ANNEES.glob(f"{site_id}_*.csv")) if DOSSIER_ANNEES.exists() else []
    libre = RESULTATS / f"timeline_{site_id}.csv"
    if libre.exists():
        fichiers.append(libre)  # en dernier : en cas de doublon, les fichiers annuels gagnent
    if not fichiers:
        return None, []
    morceaux = [pd.read_csv(f, parse_dates=["datetime"]) for f in fichiers]
    df = pd.concat(morceaux, ignore_index=True)
    df = df.drop_duplicates("datetime", keep="first").sort_values("datetime").reset_index(drop=True)
    return df, fichiers


def sur_grille_reguliere(df):
    """Remet les positions sur une grille au pas le plus fréquent. Renvoie (df, pas, nb heures manquantes)."""
    pas = df["datetime"].diff().dropna().mode()[0]
    grille = pd.date_range(df["datetime"].iloc[0], df["datetime"].iloc[-1], freq=pas)
    hors_grille = (~df["datetime"].isin(grille)).sum()
    df = df.set_index("datetime").reindex(grille)
    df.index.name = "datetime"
    manquantes = df["sun_az"].isna().sum()
    return df.reset_index(), pas, manquantes, hors_grille


def main():
    with open(SITES, encoding="utf-8") as f:
        sites = json.load(f)

    # On repart d'un dossier vide pour ne pas laisser de fichiers d'un site supprimé.
    for sous_dossier in ("horizon", "timeline"):
        if (WEB_DATA / sous_dossier).exists():
            shutil.rmtree(WEB_DATA / sous_dossier)
        (WEB_DATA / sous_dossier).mkdir(parents=True)
        (WEB_DATA / sous_dossier / ".gitkeep").touch()

    sites_web = []
    periodes = {}
    for site in sites:
        if site.get("lat") is None or site.get("lon") is None:
            print(f"[ignoré] {site['id']} : coordonnées absentes (lancer calcul_horizon.py d'abord).")
            continue
        entree = {
            "id": site["id"],
            "nom": site.get("nom", site["id"]),
            "court": site.get("nom_court") or site.get("nom", site["id"]),  # étiquettes, tableaux, carte
            "lat": site["lat"],
            "lon": round(site["lon"] % 360, 5),  # l'interface attend 0..360 degrés est
            # Les missions historiques (rejeu, dates passées) restent hors de la comparaison des candidats.
            "groupe": "historique" if site.get("historique") else ("pole" if site["lat"] <= -80 else "autre"),
            "historique": bool(site.get("historique")),
            "source": site.get("source", ""),
        }
        sites_web.append(entree)

        etat = []
        horizon = RESULTATS / f"horizon_{site['id']}.json"
        if horizon.exists():
            with open(horizon, encoding="utf-8") as f:
                h = json.load(f)
            with open(WEB_DATA / "horizon" / f"{site['id']}.json", "w", encoding="utf-8") as f:
                json.dump({"site_id": site["id"], "pas_deg": 1, "hauteurs": h["horizon_elevation_deg"]}, f)
            etat.append("horizon")

        df, fichiers = lire_positions(site["id"])
        if df is not None:
            df, pas, manquantes, hors_grille = sur_grille_reguliere(df)
            if hors_grille:
                print(f"[attention] {site['id']} : {hors_grille} instants ignorés car hors du pas de {pas} "
                      f"(fichiers calculés avec des pas différents ?).")
            dossier = WEB_DATA / "timeline" / site["id"]
            dossier.mkdir()
            annees = []
            for annee, morceau in df.groupby(df["datetime"].dt.year):
                web = pd.DataFrame({
                    "time_utc": morceau["datetime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "sun_az": morceau["sun_az"].round(4),
                    "sun_el": morceau["sun_alt"].round(4),
                    "earth_az": morceau["earth_az"].round(4),
                    "earth_el": morceau["earth_alt"].round(4),
                })
                web.to_csv(dossier / f"{annee}.csv", index=False)  # heures manquantes : cases vides
                annees.append(int(annee))
            debut, fin = df["datetime"].iloc[0], df["datetime"].iloc[-1]
            entree["timeline"] = {
                "annees": annees,
                "debut": debut.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fin": fin.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "pas_h": pas / pd.Timedelta(hours=1),
            }
            if not site.get("historique"):
                periodes[site["id"]] = (debut, fin)
            texte = f"timeline {debut:%d/%m/%Y} -> {fin:%d/%m/%Y} ({len(fichiers)} fichier(s), années {annees[0]}-{annees[-1]})"
            if manquantes:
                texte += f", {manquantes} heures manquantes"
            etat.append(texte)

        if len(etat) == 2:
            print(f"[données réelles] {site['id']} : {', '.join(etat)}")
        else:
            print(f"[valeurs d'exemple] {site['id']} : il manque "
                  + " et ".join(x for x in ("horizon", "timeline") if not any(e.startswith(x) for e in etat))
                  + " ; l'interface affichera le badge « Valeurs d'exemple ».")

    with open(WEB_DATA / "sites.json", "w", encoding="utf-8") as f:
        json.dump(sites_web, f, indent=2, ensure_ascii=False)
    print(f"\n{len(sites_web)} sites exportés dans {WEB_DATA}.")

    # Comparer des sites n'a de sens que sur une période commune.
    if len(periodes) > 1:
        debut_commun = max(d for d, _ in periodes.values())
        fin_commune = min(f for _, f in periodes.values())
        if debut_commun >= fin_commune:
            print("[attention] Les sites calculés n'ont AUCUNE période en commun : la comparaison affichera "
                  "« Sans données ». Calculer tous les sites sur les mêmes années (precalcul.py).")
        else:
            print(f"Période commune aux sites calculés : {debut_commun:%d/%m/%Y} -> {fin_commune:%d/%m/%Y}.")


if __name__ == "__main__":
    main()
