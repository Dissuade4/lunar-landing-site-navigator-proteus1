// Tout ce qui se calcule dans le navigateur : visibilité, résumés, verdicts.
// Ces calculs dépendent de la date choisie par l'utilisateur, c'est pourquoi
// ils ne sont pas faits à l'avance en Python.

// Le disque du Soleil mesure environ 0,53° : il est partiellement caché
// tant que son centre est à moins de 0,27° du relief.
const RAYON_SOLEIL = 0.27;
const FIN_DES_DONNEES = -1;

function hauteurHorizon(horizon, azimut) {
  const n = horizon.length;
  const position = ((((azimut % 360) + 360) % 360) / 360) * n;
  const i = Math.floor(position) % n;
  const fraction = position - Math.floor(position);
  return horizon[i] * (1 - fraction) + horizon[(i + 1) % n] * fraction;
}

// État du site à un instant : positions, marges au-dessus du relief, visibilité.
function etatA(source, instant) {
  const p = source.positions(instant);
  if (!p) return null;
  const margeSoleil = p.sunEl - hauteurHorizon(source.horizon, p.sunAz);
  const margeTerre = p.earthEl - hauteurHorizon(source.horizon, p.earthAz);
  let soleil = 'cache';
  if (margeSoleil > RAYON_SOLEIL) soleil = 'visible';
  else if (margeSoleil > -RAYON_SOLEIL) soleil = 'partiel';
  return { instant, ...p, margeSoleil, margeTerre, soleil, terre: margeTerre > 0 };
}

function serie(source, debut, heures, pasHeures = 1) {
  const points = [];
  for (let h = 0; h <= heures; h += pasHeures) points.push(etatA(source, debut + h * HEURE));
  return points;
}

// Le même site avec un horizon plat (pour montrer le ciel « sans relief »).
function sansRelief(source) {
  return { ...source, horizon: new Array(360).fill(0) };
}

function resumer(points, pasHeures = 1) {
  const connus = points.filter(Boolean);
  if (!connus.length) return null;

  let soleil = 0, terre = 0, lesDeux = 0, nuit = 0, nuitMax = 0, margeMax = -Infinity;
  for (const p of points) {
    if (!p) { nuit = 0; continue; }
    const part = p.soleil === 'visible' ? 1 : p.soleil === 'partiel' ? 0.5 : 0;
    soleil += part;
    if (p.terre) terre += 1;
    if (p.terre) lesDeux += part;   // même pondération que l'ensoleillement (Soleil partiel = 1/2)
    if (p.soleil === 'cache') {
      nuit += pasHeures;
      nuitMax = Math.max(nuitMax, nuit);
    } else {
      nuit = 0;
    }
    margeMax = Math.max(margeMax, p.margeSoleil);
  }

  const n = connus.length;
  return {
    pctSoleil: (100 * soleil) / n,
    pctTerre: (100 * terre) / n,
    pctLesDeux: (100 * lesDeux) / n,
    // Une nuit ne peut pas dépasser la durée de la série (n points = n − 1 intervalles).
    nuitMaxH: Math.min(nuitMax, (points.length - 1) * pasHeures),
    margeMax,
    complet: n === points.length,
  };
}

// Nombre d'heures avant que le Soleil (ou la Terre) change d'état.
// Renvoie null au-delà de 30 jours, et FIN_DES_DONNEES si les données s'arrêtent avant.
function heuresAvantChangement(source, instant, quoi) {
  const visible = e => (quoi === 'soleil' ? e.soleil !== 'cache' : e.terre);
  const depart = etatA(source, instant);
  if (!depart) return null;
  for (let h = 1; h <= 30 * 24; h += 1) {
    const e = etatA(source, instant + h * HEURE);
    if (!e) return FIN_DES_DONNEES;
    if (visible(e) !== visible(depart)) return h;
  }
  return null;
}

// Verdict d'un scénario (site + date) selon les critères de la mission.
//   exclu  : énergie ou communication impossible
//   limite : au moins un critère manqué
//   viable : tous les critères remplis
function verdict(resume, criteres) {
  if (!resume) return { statut: 'inconnu', raisons: [t('pas de données pour cette date')] };

  const raisons = [];
  if (resume.nuitMaxH > criteres.nuitMaxH) raisons.push(t('nuit de {d}, au-delà de l\'autonomie', { d: formatDuree(resume.nuitMaxH) }));
  if (resume.pctTerre === 0) raisons.push(t('Terre jamais visible'));
  if (raisons.length) return { statut: 'exclu', raisons };

  if (resume.pctSoleil < criteres.soleilMin) raisons.push(t('ensoleillement de {p}', { p: formatPct(resume.pctSoleil) }));
  if (resume.pctTerre < criteres.terreMin) raisons.push(t('Terre visible {p} du temps', { p: formatPct(resume.pctTerre) }));
  if (resume.margeMax < criteres.elevationMin) raisons.push(t('Soleil jamais à plus de {m} du relief', { m: formatDeg(resume.margeMax) }));
  return { statut: raisons.length ? 'limite' : 'viable', raisons };
}

// Hauteur du Soleil vue depuis la Terre (formule approchée, à 1° près environ).
// Sert seulement à la comparaison « le même jour à Paris ».
function hauteurSoleilTerre(lat, lon, instant) {
  const rad = Math.PI / 180;
  const date = new Date(instant);
  const jour = (instant - Date.UTC(date.getUTCFullYear(), 0, 1)) / JOUR;
  const declinaison = -23.44 * Math.cos((2 * Math.PI * (jour + 10)) / 365.25);
  const heures = date.getUTCHours() + date.getUTCMinutes() / 60;
  const angleHoraire = 15 * (heures - 12) + lon;
  const sinH = Math.sin(lat * rad) * Math.sin(declinaison * rad)
    + Math.cos(lat * rad) * Math.cos(declinaison * rad) * Math.cos(angleHoraire * rad);
  return Math.asin(sinH) / rad;
}

// ---------- Mise en forme ----------

function formatDeg(valeur, signe = true) {
  const texte = formatNombre(Math.abs(valeur), 1) + '°';
  if (!signe) return texte;
  return (valeur < 0 ? '−' : '+') + texte;
}

function formatPct(valeur) {
  return langue === 'en' ? `${Math.round(valeur)}%` : `${Math.round(valeur)} %`;
}

function formatDuree(heures) {
  if (heures === null || heures === undefined) return `> 30 ${lettreJour().toLowerCase()}`;
  if (heures === FIN_DES_DONNEES) return t('hors données');
  const h = Math.round(heures);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} ${lettreJour().toLowerCase()} ${String(h % 24).padStart(2, '0')} h`;
}

function formatDate(instant, avecHeure = false) {
  const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  const date = new Date(instant).toLocaleDateString(localeDates(), options);
  if (!avecHeure) return date;
  const heure = new Date(instant).toISOString().slice(11, 16);
  return `${date} · ${heure} UTC`;
}

function formatDateCourte(instant) {
  return new Date(instant).toLocaleDateString(localeDates(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
