// Chargement des données des sites.
//
// Pour chaque site, le site web lit les fichiers produits par calcul/exporter_web.py :
//   data/sites.json                    la liste des sites ; "timeline" donne les années disponibles
//   data/horizon/<id>.json             la hauteur de l'horizon tous les degrés d'azimut
//   data/timeline/<id>/<annee>.csv     les positions du Soleil et de la Terre, heure par heure,
//                                      téléchargées seulement pour les années utiles (chargerPeriode)
//
// Tant qu'un fichier manque, on génère des valeurs d'exemple pour que l'interface
// reste utilisable. Elles sont signalées à l'écran par le badge « Valeurs d'exemple ».

const DOSSIER_DONNEES = 'data';
const HEURE = 3600 * 1000;
const JOUR = 24 * HEURE;

// Copie de data/sites.json (généré par calcul/exporter_web.py), utilisée seulement si la page est ouverte sans serveur
// (le navigateur refuse alors de lire les fichiers du dossier data).
const SITES_PAR_DEFAUT = [
  { id: 'malapert_massif', nom: 'Massif de Malapert (Site23)', court: 'Malapert', lat: -85.99487, lon: 359.76539, groupe: 'pole', source: 'Centre de la tuile LOLA Site23' },
  { id: 'leibnitz_beta', nom: 'Plateau Leibnitz bêta (Site20)', court: 'Leibnitz β', lat: -85.4266, lon: 31.74418, groupe: 'pole', source: 'Centre de la tuile LOLA Site20' },
  { id: 'im1_malapert_a', nom: 'IM-1 Odysseus (Malapert A)', court: 'IM-1 Odysseus', lat: -80.13, lon: 1.44, groupe: 'historique', historique: true, source: 'LROC, à vérifier' },
  { id: 'chandrayaan3', nom: 'Chandrayaan-3 Vikram', court: 'Chandrayaan-3', lat: -69.373, lon: 32.319, groupe: 'historique', historique: true, source: 'ISRO / LROC' },
];

// Nom court d'un site (carte, tableaux, en-têtes) : champ « court » de data/sites.json,
// sinon le nom complet sans sa parenthèse.
function nomCourt(site) {
  const en = langue === 'en' && NOMS_SITES_EN[site.id];
  if (en) return en.court;
  return site.court || site.nom.replace(/\s*\(.*\)\s*$/, '');
}

// Source des coordonnées d'un site (info-bulle de la liste), dans la langue choisie.
function sourceSite(site) {
  const en = langue === 'en' && NOMS_SITES_EN[site.id];
  return (en && en.source) || site.source || '';
}

// Nom complet d'un site, dans la langue choisie (liste des sites, info-bulles).
function nomLong(site) {
  const en = langue === 'en' && NOMS_SITES_EN[site.id];
  return en ? en.nom : site.nom;
}

async function lireFichier(chemin) {
  // no-cache : le navigateur vérifie toujours auprès du serveur si le fichier a changé
  // (sinon il peut garder d'anciennes données après un nouvel export).
  const reponse = await fetch(chemin, { cache: 'no-cache' });
  if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status}`);
  return reponse.text();
}

async function chargerSites() {
  try {
    return JSON.parse(await lireFichier(`${DOSSIER_DONNEES}/sites.json`));
  } catch (erreur) {
    console.warn('sites.json non lu, liste par défaut utilisée.', erreur.message);
    return SITES_PAR_DEFAUT;
  }
}

// Renvoie la « source » d'un site : son horizon et une fonction qui donne
// les positions du Soleil et de la Terre à un instant donné.
async function chargerSource(site) {
  const source = { site, exemple: false };

  try {
    const fichier = JSON.parse(await lireFichier(`${DOSSIER_DONNEES}/horizon/${site.id}.json`));
    source.horizon = fichier.hauteurs;
  } catch (erreur) {
    source.horizon = horizonExemple(site);
    source.exemple = true;
  }

  if (site.timeline && site.timeline.annees && site.timeline.annees.length) {
    preparerTimelineParAnnee(source);
  } else {
    source.positions = positionsExemple(site);
    source.exemple = true;
  }

  return source;
}

// ---------- Timelines découpées par année ----------
// data/timeline/<id>/<annee>.csv : une année civile (UTC) par fichier.
// Seules les années utiles à la date choisie sont téléchargées (voir chargerPeriode).

function preparerTimelineParAnnee(source) {
  const t = source.site.timeline;
  const pas = (t.pas_h || 1) * HEURE;
  source.timeline = {
    pas,
    annees: new Set(t.annees),
    debut: Date.parse(t.debut),
    fin: Date.parse(t.fin),
    chargees: new Map(),     // année -> { debut, valeurs }
    enCours: new Map(),      // année -> promesse de chargement
  };
  source.positions = instant => {
    // On arrondit au pas le plus proche avant de choisir l'année :
    // le 31 décembre à 23 h 40 se lit dans le fichier de l'année suivante.
    const annee = new Date(instant + pas / 2).getUTCFullYear();
    const donnees = source.timeline.chargees.get(annee);
    if (!donnees) return null;
    const i = Math.round((instant - donnees.debut) / pas);
    if (i < 0 || i >= donnees.valeurs.length) return null;
    const v = donnees.valeurs[i];
    if (v.some(Number.isNaN)) return null;   // heure manquante dans le calcul
    const [sunAz, sunEl, earthAz, earthEl] = v;
    return { sunAz, sunEl, earthAz, earthEl };
  };
}

// Télécharge les années nécessaires pour couvrir [debut, fin].
// Renvoie true si de nouvelles données ont été chargées (les résumés en cache sont alors périmés).
async function chargerPeriode(source, debut, fin) {
  const t = source.timeline;
  if (!t) return false;
  const debutUtile = Math.max(debut, t.debut), finUtile = Math.min(fin, t.fin);
  if (debutUtile > finUtile) return false;

  const attentes = [];
  for (let annee = new Date(debutUtile).getUTCFullYear(); annee <= new Date(finUtile).getUTCFullYear(); annee++) {
    if (!t.annees.has(annee) || t.chargees.has(annee)) continue;
    if (!t.enCours.has(annee)) {
      t.enCours.set(annee, lireFichier(`${DOSSIER_DONNEES}/timeline/${source.site.id}/${annee}.csv`)
        .then(texte => { t.chargees.set(annee, lireTimelineCSV(texte)); })
        .catch(erreur => { console.warn(`Année ${annee} de ${source.site.id} non lue :`, erreur.message); })
        .finally(() => t.enCours.delete(annee)));
    }
    attentes.push(t.enCours.get(annee));
  }
  await Promise.all(attentes);
  return attentes.length > 0;
}

// Lit un CSV horaire. Colonnes attendues : time_utc, sun_az, sun_el, earth_az, earth_el.
// Une case vide (heure non calculée) devient NaN.
function lireTimelineCSV(texte) {
  const lignes = texte.trim().split(/\r?\n/);
  const entetes = lignes[0].split(',').map(nom => nom.trim());
  const colonnes = ['time_utc', 'sun_az', 'sun_el', 'earth_az', 'earth_el'];
  const index = colonnes.map(nom => entetes.indexOf(nom));
  if (index.includes(-1)) throw new Error(`colonnes manquantes dans le CSV, attendu : ${colonnes.join(', ')}`);

  const valeurs = [];
  let debut = null;
  for (const ligne of lignes.slice(1)) {
    const cases = ligne.split(',');
    if (debut === null) {
      const date = cases[index[0]].trim();
      debut = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(date) ? date : date + 'Z');
    }
    valeurs.push(index.slice(1).map(i => (cases[i] === undefined || cases[i].trim() === '' ? NaN : Number(cases[i]))));
  }
  return { debut, valeurs };
}

// ---------- Valeurs d'exemple ----------
// Un modèle simplifié, suffisant pour que les écrans aient l'air vrais.
// Il ne remplace pas Horizons : il ignore notamment la parallaxe et l'excentricité.

const NOUVELLE_LUNE_REF = Date.UTC(2024, 0, 11, 11, 57);

function positionsExemple(site) {
  return instant => {
    const jours = (instant - NOUVELLE_LUNE_REF) / JOUR;
    // Point de la Lune où le Soleil est au zénith : il recule de 360° par mois synodique
    // et monte ou descend de 1,54° au fil de l'« année » lunaire (346,6 jours).
    // La phase de cette saison est arbitraire ici : seules les vraies données la fixeront.
    const soleil = hauteurEtAzimut(site.lat, site.lon,
      -1.54 * Math.cos(2 * Math.PI * (jours - 114) / 346.62),
      180 - 360 * jours / 29.530589);
    // Point où la Terre est au zénith : il oscille autour de 0°, 0° (libration).
    const terre = hauteurEtAzimut(site.lat, site.lon,
      6.7 * Math.sin(2 * Math.PI * jours / 27.2122),
      7.9 * Math.sin(2 * Math.PI * jours / 27.5546));
    return { sunAz: soleil.az, sunEl: soleil.el, earthAz: terre.az, earthEl: terre.el };
  };
}

// Hauteur et azimut (depuis le nord, vers l'est) d'un point du ciel
// situé au zénith du point (latPoint, lonPoint), vu depuis (latObs, lonObs).
function hauteurEtAzimut(latObs, lonObs, latPoint, lonPoint) {
  const rad = Math.PI / 180;
  const phi = latObs * rad, beta = latPoint * rad, dl = (lonPoint - lonObs) * rad;
  const sinH = Math.sin(phi) * Math.sin(beta) + Math.cos(phi) * Math.cos(beta) * Math.cos(dl);
  const hauteur = Math.asin(Math.max(-1, Math.min(1, sinH))) / rad;
  const azimut = Math.atan2(
    Math.sin(dl) * Math.cos(beta),
    Math.cos(phi) * Math.sin(beta) - Math.sin(phi) * Math.cos(beta) * Math.cos(dl)
  ) / rad;
  return { el: hauteur, az: (azimut + 360) % 360 };
}

// Un relief inventé mais stable : le même site donne toujours le même horizon.
function horizonExemple(site) {
  const alea = generateurAleatoire(site.id);
  const polaire = Math.abs(site.lat) > 75;
  const sommets = Array.from({ length: 6 }, () => ({
    azimut: alea() * 360,
    largeur: 8 + alea() * 25,
    hauteur: polaire ? 0.4 + alea() * 1.8 : 0.2 + alea() * 0.8,
  }));

  return Array.from({ length: 360 }, (_, azimut) => {
    let hauteur = -0.6;
    for (const s of sommets) {
      const ecart = ((azimut - s.azimut + 540) % 360) - 180;
      hauteur += s.hauteur * Math.exp(-(ecart * ecart) / (2 * s.largeur * s.largeur));
    }
    return Math.round((hauteur + (alea() - 0.5) * 0.15) * 100) / 100;
  });
}

function generateurAleatoire(texte) {
  let graine = 0;
  for (const c of texte) graine = (graine * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    graine = (graine + 0x6D2B79F5) >>> 0;
    let t = graine;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
