"""Tests de validation du calcul d'horizon sur des cartes artificielles.

Usage :
    python tests_horizon.py

Chaque test fabrique une petite carte de relief dont on connaît la réponse
théorique, lance le vrai calcul (calcul_horizon.compute_horizon_360 et
calcul_timeline.compute_visibility_timeline) et compare.
"""
import os
import tempfile

import numpy as np
import pandas as pd
import rasterio
from pyproj import CRS, Transformer
from rasterio.transform import from_origin

from calcul_horizon import R_MOON, compute_horizon_360
from calcul_timeline import compute_visibility_timeline

# Même projection que les tuiles LOLA du pôle Sud (stéréographique polaire, sphère de 1737,4 km)
CRS_POLAIRE = CRS.from_proj4(f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R={R_MOON} +units=m +no_defs")
VERS_PROJ = Transformer.from_crs(CRS_POLAIRE.geodetic_crs, CRS_POLAIRE, always_xy=True)
RES = 5.0       # mètres par pixel
N = 2001        # carte de 10 km de côté, site au centre
H_OBS = 1.0     # hauteur du capteur (m)


def fabriquer_carte(dossier, nom, lat, lon, modifier=None):
    """Carte plate (altitude 0) centrée sur le site ; `modifier(dem, x, y)` y ajoute du relief."""
    x0, y0 = VERS_PROJ.transform(lon, lat)
    gauche, haut = x0 - RES * N / 2, y0 + RES * N / 2
    dem = np.zeros((N, N), dtype=np.float32)
    if modifier:
        cols, rows = np.meshgrid(np.arange(N), np.arange(N))
        x = gauche + (cols + 0.5) * RES
        y = haut - (rows + 0.5) * RES
        modifier(dem, x, y)
    chemin = os.path.join(dossier, nom)
    with rasterio.open(chemin, "w", driver="GTiff", height=N, width=N, count=1, dtype="float32",
                       crs=CRS_POLAIRE.to_wkt(), transform=from_origin(gauche, haut, RES, RES)) as dst:
        dst.write(dem, 1)
    return chemin


def angle_theorique(hauteur, distance):
    """Angle sous lequel on voit un obstacle, courbure lunaire comprise."""
    return np.degrees(np.arctan2(hauteur - H_OBS - distance ** 2 / (2 * R_MOON), distance))


def bloc(lat, lon, azimut_deg, distance=1000.0, hauteur=100.0, demi_largeur=40.0):
    """Relief : un bloc placé à `distance` du site dans la direction géographique `azimut_deg`."""
    d_lat = np.degrees(distance * np.cos(np.radians(azimut_deg)) / R_MOON)
    d_lon = np.degrees(distance * np.sin(np.radians(azimut_deg)) / (R_MOON * np.cos(np.radians(lat))))
    xb, yb = VERS_PROJ.transform(lon + d_lon, lat + d_lat)

    def modifier(dem, x, y):
        dem[(np.abs(x - xb) <= demi_largeur) & (np.abs(y - yb) <= demi_largeur)] = hauteur
    return modifier


RESULTATS = []


def verifier(nom, condition, detail):
    RESULTATS.append(condition)
    print(f"[{'OK  ' if condition else 'ECHEC'}] {nom} : {detail}")


def test_horizon_plat(d):
    """Sol plat : l'horizon doit être très légèrement sous 0° (capteur à 1 m + courbure)."""
    tif = fabriquer_carte(d, "plat.tif", -86.0, 0.0)
    _, h, _ = compute_horizon_360(tif, -86.0, 0.0, H_OBS)
    attendu = -np.degrees(2 / np.sqrt(2 * R_MOON * H_OBS))  # dépression de l'horizon, ~ -0,06°
    verifier("Horizon plat", np.all(np.abs(h - attendu) < 0.01),
             f"calculé {h.min():.3f}° à {h.max():.3f}°, théorie {attendu:.3f}°")


def test_bloc(d, nom, lat, lon, azimut, distance=1000.0, hauteur=100.0, demi_largeur=40.0, max_dist=None):
    """Un bloc de 100 m à 1 km : pic d'horizon de ~5,6° à 6,0° dans la bonne direction, plat ailleurs."""
    tif = fabriquer_carte(d, f"{nom}.tif", lat, lon, bloc(lat, lon, azimut, distance, hauteur, demi_largeur))
    _, h, _ = compute_horizon_360(tif, lat, lon, H_OBS, max_dist)
    # Le bloc a une épaisseur : son point le plus proche est entre son centre et son coin avant.
    mini = angle_theorique(hauteur, distance)
    maxi = angle_theorique(hauteur, distance - demi_largeur * np.sqrt(2))
    # Direction du pic = milieu de la plage d'azimuts masquée par le bloc
    masque = np.radians(np.flatnonzero(h > h.max() / 2))
    az_pic = np.degrees(np.arctan2(np.sin(masque).mean(), np.cos(masque).mean())) % 360
    ecart_az = min(abs(az_pic - azimut), 360 - abs(az_pic - azimut))
    oppose = h[(azimut + 180) % 360]
    ok = ecart_az <= 1.0 and mini - 0.05 <= h.max() <= maxi + 0.05 and abs(oppose) < 0.1
    verifier(nom, ok, f"pic {h.max():.2f}° vers l'azimut {az_pic:.1f}° "
                      f"(théorie {mini:.2f}° à {maxi:.2f}° vers {azimut}°), côté opposé {oppose:.2f}°")


def test_visibilite(d):
    """Un astre à 3° est caché derrière le bloc (5,6°) et visible du côté dégagé."""
    tif = fabriquer_carte(d, "visi.tif", -86.0, 0.0, bloc(-86.0, 0.0, 0))
    _, h, _ = compute_horizon_360(tif, -86.0, 0.0, H_OBS)
    df = pd.DataFrame({"sun_az": [0.0, 180.0], "sun_alt": [3.0, 3.0],
                       "earth_az": [359.6, 90.0], "earth_alt": [8.0, -1.0]})
    df = compute_visibility_timeline(df, h)
    ok = (df["sun_visible"].tolist() == [0, 1] and df["earth_visible"].tolist() == [1, 0]
          and df["both_visible"].tolist() == [0, 0])
    verifier("Visibilité", ok, f"Soleil {df['sun_visible'].tolist()} (attendu [0, 1]), "
                               f"Terre {df['earth_visible'].tolist()} (attendu [1, 0])")


def main():
    with tempfile.TemporaryDirectory() as d:
        test_horizon_plat(d)
        test_bloc(d, "Bloc au nord", -86.0, 0.0, 0)
        test_bloc(d, "Bloc à l'est", -86.0, 0.0, 90)
        test_bloc(d, "Bloc au sud", -86.0, 0.0, 180)
        test_bloc(d, "Bloc à l'ouest", -86.0, 0.0, 270)
        test_bloc(d, "Bloc au nord, site à 60°E", -86.0, 60.0, 0)
        test_bloc(d, "Bloc à l'est, site à 135°O", -86.0, -135.0, 90)
        # Loin du pôle, l'échelle de la projection fausse les distances de ~3 % : le test le vérifie
        test_bloc(d, "Bloc au nord, site à 69°S (type Chandrayaan-3)", -69.36, 32.34, 0)
        test_bloc(d, "Bloc à l'ouest, 69°S, lecture partielle (3 km)", -69.36, 32.34, 270, max_dist=3000.0)
        test_visibilite(d)
    print(f"\n{sum(RESULTATS)}/{len(RESULTATS)} tests réussis.")
    raise SystemExit(0 if all(RESULTATS) else 1)


if __name__ == "__main__":
    main()
