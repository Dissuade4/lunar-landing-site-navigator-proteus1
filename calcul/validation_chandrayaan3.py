"""Validation sur une mission réelle : Chandrayaan-3 (Vikram), point Shiv Shakti, 69,373°S ; 32,319°E.

Usage (après calcul_horizon.py et calcul_timeline.py pour chandrayaan3) :
    python validation_chandrayaan3.py

Faits publiés (sources dans sites.json) :
  - atterrissage le 23 août 2023, peu après le lever du Soleil local ;
  - rover mis en veille le 2 septembre, atterrisseur le 4 septembre 2023,
    avant la nuit lunaire ;
  - réveil tenté par l'ISRO à partir du 22 septembre 2023. Ce n'est pas le lever géométrique :
    l'ISRO attendait que le Soleil soit revenu assez haut pour recharger les batteries, soit
    des conditions d'éclairement comparables à celles de l'atterrissage. Le script vérifie donc
    la date où le Soleil retrouve la hauteur qu'il avait à l'atterrissage (et affiche le lever) ;
  - liaison directe avec la Terre pendant toute la mission (face visible).

Le script compare ces faits aux levers et couchers trouvés dans timeline_chandrayaan3.csv.
"""
from pathlib import Path

import pandas as pd

RESULTATS = Path(__file__).resolve().parent / "resultats"

ATTERRISSAGE = pd.Timestamp("2023-08-23")
INSTANT_ATTERRISSAGE = pd.Timestamp("2023-08-23 12:33")  # 18:03 heure indienne
VEILLE_ATTERRISSEUR = pd.Timestamp("2023-09-04")
LEVER_ATTENDU = pd.Timestamp("2023-09-22")
TOLERANCE_LEVER = pd.Timedelta(days=1.5)
COUCHER_MAX = pd.Timestamp("2023-09-08")  # le coucher doit suivre de peu la mise en veille


def transitions(df, col):
    d = df[col].diff()
    return df.loc[d == 1, "datetime"].tolist(), df.loc[d == -1, "datetime"].tolist()


def main():
    try:
        df = pd.read_csv(RESULTATS / "timeline_chandrayaan3.csv", parse_dates=["datetime"])
    except FileNotFoundError:
        raise SystemExit("resultats/timeline_chandrayaan3.csv absent : lancer d'abord\n"
                         "  python calcul_horizon.py chandrayaan3 --apercu\n"
                         "  python calcul_timeline.py chandrayaan3 --debut 2023-08-15 --fin 2023-09-30")
    if df["datetime"].min() > ATTERRISSAGE or df["datetime"].max() < LEVER_ATTENDU + TOLERANCE_LEVER:
        raise SystemExit("La timeline doit couvrir au moins du 2023-08-23 au 2023-09-24 "
                         "(conseillé : --debut 2023-08-15 --fin 2023-09-30).")

    levers, couchers = transitions(df, "sun_visible")
    print("Levers du Soleil  :", [f"{t:%d/%m %H:%M}" for t in levers] or "aucun")
    print("Couchers du Soleil:", [f"{t:%d/%m %H:%M}" for t in couchers] or "aucun")

    resultats = []

    def verifier(nom, ok, detail):
        resultats.append(ok)
        print(f"[{'OK  ' if ok else 'ECHEC'}] {nom} : {detail}")

    soleil_atterrissage = df.loc[df["datetime"].dt.normalize() == ATTERRISSAGE, "sun_visible"].max() == 1
    verifier("Soleil visible le jour de l'atterrissage (23/08)", soleil_atterrissage,
             "oui" if soleil_atterrissage else "non")

    coucher = next((t for t in couchers if t > ATTERRISSAGE), None)
    ok = coucher is not None and VEILLE_ATTERRISSEUR <= coucher <= COUCHER_MAX
    verifier("Coucher après la mise en veille du 04/09 et avant le 08/09", ok,
             f"coucher calculé le {coucher:%d/%m/%Y %H:%M} UTC" if coucher is not None else "aucun coucher trouvé")

    lever = next((t for t in levers if coucher is not None and t > coucher), None)
    if lever is not None:
        print(f"       (lever géométrique suivant : {lever:%d/%m/%Y %H:%M} UTC)")
    i = (df["datetime"] - INSTANT_ATTERRISSAGE).abs().idxmin()
    hauteur = df.loc[i, "sun_alt"]
    apres = df[(df["datetime"] > (lever if lever is not None else VEILLE_ATTERRISSEUR)) & (df["sun_alt"] >= hauteur)]
    retour = apres["datetime"].iloc[0] if len(apres) else None
    ok = retour is not None and abs(retour - LEVER_ATTENDU) <= TOLERANCE_LEVER
    ecart = f" (écart {(retour - LEVER_ATTENDU) / pd.Timedelta(hours=1):+.0f} h avec le 22/09 00:00)" if retour is not None else ""
    verifier(f"Soleil revenu à sa hauteur de l'atterrissage ({hauteur:.1f}°) vers le 22/09, date de réveil ISRO (± 1,5 jour)", ok,
             (f"le {retour:%d/%m/%Y %H:%M} UTC" if retour is not None else "jamais sur la période") + ecart)

    mission = df[(df["datetime"] >= ATTERRISSAGE) & (df["datetime"] < VEILLE_ATTERRISSEUR + pd.Timedelta(days=1))]
    terre = mission["earth_visible"].mean() * 100
    verifier("Terre visible pendant toute la mission (liaison directe)", terre == 100,
             f"{terre:.1f} % du temps entre le 23/08 et le 04/09 ; hauteur min {mission['earth_alt'].min():.1f}°")

    print(f"\n{sum(resultats)}/{len(resultats)} vérifications réussies.")
    print("Rappel : le 22/09 est la date de réveil prévue par l'ISRO, pas une mesure ; un écart de quelques heures est normal.")


if __name__ == "__main__":
    main()
