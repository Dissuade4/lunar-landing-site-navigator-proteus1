import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# Outil de vérification rapide des résultats Python.
# L'interface présentée au jury est dans ../web.
DOSSIER = Path(__file__).resolve().parent
SITES = DOSSIER / "sites.json"
RESULTATS = DOSSIER / "resultats"

st.set_page_config(page_title="Lunar Landing Site Navigator", layout="wide")


# --- CHARGEMENT DES DONNÉES ---
@st.cache_data
def load_sites(mtime):
    # mtime (date de modification) invalide le cache dès que sites.json change
    with open(SITES, encoding="utf-8") as f:
        return json.load(f)


@st.cache_data
def load_site_data(site_id):
    with open(RESULTATS / f"horizon_{site_id}.json", encoding="utf-8") as f:
        horizon = json.load(f)
    df = pd.read_csv(RESULTATS / f"timeline_{site_id}.csv")
    df["datetime"] = pd.to_datetime(df["datetime"])
    return horizon, df


def fichiers_presents(site_id):
    return (RESULTATS / f"horizon_{site_id}.json").exists() and (RESULTATS / f"timeline_{site_id}.csv").exists()


sites = load_sites(os.path.getmtime(SITES))
disponibles = [s for s in sites if fichiers_presents(s["id"])]
manquants = [s for s in sites if not fichiers_presents(s["id"])]

if not disponibles:
    st.error("Aucun site n'a ses fichiers horizon_<id>.json et timeline_<id>.csv. "
             "Lance d'abord calcul_horizon.py puis calcul_timeline.py.")
    st.stop()

# --- BARRE LATÉRALE ---
st.sidebar.header("Paramètres de mission")
labels = {s["nom"]: s for s in disponibles}
current_site = labels[st.sidebar.selectbox("Site d'alunissage", list(labels.keys()))]
horizon_data, df = load_site_data(current_site["id"])

st.sidebar.markdown(
    f"**Coordonnées :** Lat `{current_site['lat']}°` | Lon `{current_site['lon']}°`  \n"
    f"**Altitude du sol :** `{horizon_data.get('altitude_sol_m', float('nan')):.0f} m`  \n"
    f"**Hauteur capteur :** `{horizon_data.get('hauteur_capteur_m', 1.0)} m`"
)
if manquants:
    st.sidebar.caption("Sites sans données calculées : " + ", ".join(s["nom"] for s in manquants))

selected_idx = st.sidebar.slider(
    "Explorer un instant précis", min_value=0, max_value=len(df) - 1, value=0, format="pas n° %d"
)
current_row = df.iloc[selected_idx]
mode_pedagogique = st.sidebar.checkbox("Activer le mode pédagogique", value=True)

# --- EN-TÊTE ---
st.title("Lunar Landing Site Navigator")
st.caption(
    f"**Site étudié :** {current_site['nom']} — "
    f"**Instant sélectionné :** {current_row['datetime'].strftime('%d %b %Y à %H:%M UTC')}"
)
if mode_pedagogique:
    st.info(
        "Au pôle Sud lunaire, le Soleil rase l'horizon (axe incliné de 1,5°) et la Terre oscille par libration (~27 jours) : "
        "le relief local (LOLA) décide directement de l'énergie solaire et des liaisons directes avec la Terre (DTE)."
    )


# --- INDICATEURS ---
def prochain_coucher(col):
    """Prochain passage visible -> caché après l'instant sélectionné."""
    apres = df.iloc[selected_idx:]
    if not apres[col].iloc[0]:
        return "Caché", "sous l'horizon à cet instant"
    couchers = apres.loc[apres[col].diff() == -1, "datetime"]
    if couchers.empty:
        return "> période", "pas de coucher avant la fin des données"
    t = couchers.iloc[0]
    heures = (t - current_row["datetime"]).total_seconds() / 3600
    return f"{heures:.0f} h", f"le {t.strftime('%d/%m à %H:%M')} UTC"


sun_pct = 100 * df["sun_visible"].mean()
earth_pct = 100 * df["earth_visible"].mean()
both_pct = 100 * (df["sun_visible"] & df["earth_visible"]).mean()
sun_val, sun_detail = prochain_coucher("sun_visible")
earth_val, earth_detail = prochain_coucher("earth_visible")

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Énergie (Soleil visible)", f"{sun_pct:.1f} %")
c2.metric("Communication (Terre visible)", f"{earth_pct:.1f} %")
c3.metric("Les deux visibles", f"{both_pct:.1f} %")
c4.metric("Avant le coucher du Soleil", sun_val, delta=sun_detail, delta_color="off")
c5.metric("Avant le coucher de la Terre", earth_val, delta=earth_detail, delta_color="off")
st.caption(f"Pourcentages calculés sur la période affichée : "
           f"{df['datetime'].iloc[0]:%d/%m/%Y} → {df['datetime'].iloc[-1]:%d/%m/%Y} (UTC).")

# --- PANORAMA D'HORIZON ---
st.subheader("1. Panorama de l'horizon réel (360°) et position des astres")
if mode_pedagogique:
    st.caption("Un astre fournit de l'énergie (Soleil) ou une liaison directe (Terre) uniquement s'il est au-dessus de la zone grise du relief.")

az_list = horizon_data["azimuth_deg"]
hor_list = horizon_data["horizon_elevation_deg"]
fig_hor = go.Figure()
fig_hor.add_trace(go.Scatter(
    x=az_list, y=hor_list, fill="tozeroy", mode="lines",
    line=dict(color="dimgray", width=2), fillcolor="rgba(160,160,160,0.45)", name="Horizon réel (relief LOLA)",
))
fig_hor.add_hline(y=0, line_dash="dash", line_color="black", annotation_text="Horizon géométrique (0°)")
for nom, col_az, col_alt, couleur in [("Soleil", "sun_az", "sun_alt", "orange"), ("Terre", "earth_az", "earth_alt", "royalblue")]:
    fig_hor.add_trace(go.Scatter(
        x=[current_row[col_az]], y=[current_row[col_alt]], mode="markers+text",
        marker=dict(size=15, color=couleur, line=dict(width=1, color="black")),
        text=[nom], textposition="top center",
        name=f"{nom} (Az {current_row[col_az]:.1f}°, Alt {current_row[col_alt]:.1f}°)",
    ))
fig_hor.update_layout(
    xaxis=dict(title="Azimut (°)", range=[0, 360], tickvals=[0, 90, 180, 270, 360],
               ticktext=["Nord (0°)", "Est (90°)", "Sud (180°)", "Ouest (270°)", "Nord (360°)"]),
    yaxis=dict(title="Élévation (°)", range=[min(-6, min(hor_list) - 1), max(18, max(hor_list) + 4)]),
    height=380, margin=dict(l=20, r=20, t=20, b=20),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
)
st.plotly_chart(fig_hor, use_container_width=True)

# --- FRISE TEMPORELLE ---
st.subheader("2. Évolution temporelle : fenêtres d'énergie et de communication")
if mode_pedagogique:
    st.caption("Cliquez sur les éléments de la légende pour activer ou désactiver chaque couche.")

y_bas, y_haut = -5, 16
fig_time = go.Figure()
# Bandes de visibilité : None quand l'astre est caché, pour ne rien colorer.
for col, couleur, nom in [("sun_visible", "rgba(255,215,0,0.20)", "Fenêtre Énergie (Soleil visible)"),
                          ("earth_visible", "rgba(30,144,255,0.12)", "Fenêtre Communication (Terre visible)")]:
    fig_time.add_trace(go.Scatter(
        x=df["datetime"], y=np.where(df[col] == 1, y_haut, None),
        fill="tozeroy", mode="none", fillcolor=couleur, name=nom, connectgaps=False,
    ))
fig_time.add_trace(go.Scatter(x=df["datetime"], y=df["sun_alt"], mode="lines",
                              line=dict(color="orange", width=2.5), name="Altitude du Soleil (°)"))
fig_time.add_trace(go.Scatter(x=df["datetime"], y=df["sun_horizon_alt"], mode="lines",
                              line=dict(color="gray", width=1.5, dash="dash"), name="Horizon face au Soleil (°)"))
fig_time.add_trace(go.Scatter(x=df["datetime"], y=df["earth_alt"], mode="lines",
                              line=dict(color="royalblue", width=2.5), name="Altitude de la Terre (°)"))
fig_time.add_trace(go.Scatter(x=df["datetime"], y=df["earth_horizon_alt"], mode="lines",
                              line=dict(color="lightskyblue", width=1.5, dash="dot"), name="Horizon face à la Terre (°)"))
fig_time.add_vline(x=current_row["datetime"], line_width=2, line_color="crimson")
fig_time.update_layout(
    xaxis_title="Date et heure (UTC)", yaxis=dict(title="Élévation (°)", range=[y_bas, y_haut]),
    height=420, margin=dict(l=20, r=20, t=20, b=20),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
)
st.plotly_chart(fig_time, use_container_width=True)
