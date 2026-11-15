// Les dessins : panorama de l'horizon, frise, courbe du rejeu IM-1, carte polaire.
// Chaque fonction reçoit un élément et le remplit. Pas de bibliothèque.

const C = {
  soleil: '#F5A524', soleilClair: '#FFD58A', soleilPartiel: '#8A6420',
  terre: '#4C9AFF', terreClair: '#A9CFFF',
  relief: '#2E343D', reliefBord: '#7A8390',
  ligne: '#5A626D', grille: '#252B34', texte: '#9AA3AE', blanc: '#E8EAED',
  masque: '#3A1D22', masqueTexte: '#FFC9CE', nuit: '#1A1E26',
};

const POLICE = 'font-family="Inter, system-ui, sans-serif"';

function texteSvg(x, y, contenu, couleur, taille = 14, ancre = 'start', gras = false) {
  // Le contour sombre garde le texte lisible quand il passe sur le relief.
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${couleur}" font-size="${taille}" text-anchor="${ancre}" ${gras ? 'font-weight="600"' : ''} stroke="#0B0E13" stroke-width="3" paint-order="stroke" ${POLICE}>${contenu}</text>`;
}

// Ligne brisée qui se coupe quand l'azimut fait le tour (360° -> 0°).
function tracesParAzimut(points, x, y) {
  const traces = [];
  let courante = [];
  let precedent = null;
  for (const p of points) {
    if (precedent && Math.abs(p.az - precedent.az) > 180) {
      traces.push(courante);
      courante = [];
    }
    courante.push(`${x(p.az).toFixed(1)},${y(p.el).toFixed(1)}`);
    precedent = p;
  }
  traces.push(courante);
  return traces.filter(t => t.length > 1).map(t => 'M' + t.join(' L'));
}

// ---------- Panorama à 360° ----------
// options : horizon, afficherRelief, trajetSoleil (états), trajetTerre (états),
//           actuel (état), montrerSoleil, montrerTerre, etiquetterMasques
function dessinerPanorama(svg, o) {
  const L = 1000, H = 250, haut = 18, bas = 212;
  const horizon = o.afficherRelief ? o.horizon : new Array(360).fill(0);
  const k = o.echelleTexte || 1;   // textes plus grands quand le panorama est affiché en demi-largeur

  const hauteurs = [...horizon, 0];
  if (o.montrerSoleil) o.trajetSoleil.filter(Boolean).forEach(p => hauteurs.push(p.sunEl));
  if (o.montrerTerre) (o.trajetTerre || []).filter(Boolean).forEach(p => hauteurs.push(p.earthEl));
  if (o.actuel && o.montrerSoleil) hauteurs.push(o.actuel.sunEl);
  if (o.actuel && o.montrerTerre) hauteurs.push(o.actuel.earthEl);
  let min = Math.min(...hauteurs) - 0.8;
  let max = Math.max(...hauteurs) + 1.2;
  if (max - min < 5) {
    const milieu = (max + min) / 2;
    min = milieu - 2.5;
    max = milieu + 2.5;
  }

  const x = az => (az / 360) * L;
  const y = el => haut + ((max - el) / (max - min)) * (bas - haut);
  let s = '';

  // Horizon d'une sphère lisse
  s += `<line x1="0" y1="${y(0)}" x2="${L}" y2="${y(0)}" stroke="${C.ligne}" stroke-dasharray="3 5"/>`;
  if (!o.afficherRelief) s += texteSvg(8, y(0) - 6, "horizon d'une sphère lisse (0°)", C.texte, 13 * k);

  // Relief
  if (o.afficherRelief) {
    let relief = `M0 ${H}`;
    for (let az = 0; az <= 360; az += 1) relief += ` L${x(az).toFixed(1)} ${y(hauteurHorizon(horizon, az)).toFixed(1)}`;
    relief += ` L${L} ${H} Z`;
    s += `<path d="${relief}" fill="${C.relief}" stroke="${C.reliefBord}" stroke-width="1.5"/>`;
  }

  // Trajectoires
  if (o.montrerSoleil && o.trajetSoleil.length) {
    const pts = o.trajetSoleil.filter(Boolean).map(p => ({ az: p.sunAz, el: p.sunEl }));
    for (const d of tracesParAzimut(pts, x, y)) {
      s += `<path d="${d}" fill="none" stroke="${C.soleil}" stroke-width="2" stroke-dasharray="5 6"/>`;
    }
  }
  if (o.montrerTerre && o.trajetTerre && o.trajetTerre.length) {
    const pts = o.trajetTerre.filter(Boolean).map(p => ({ az: p.earthAz, el: p.earthEl }));
    for (const d of tracesParAzimut(pts, x, y)) {
      s += `<path d="${d}" fill="none" stroke="${C.terre}" stroke-width="2" stroke-dasharray="5 6"/>`;
    }
  }

  // Étiquettes « Soleil masqué » sur les passages derrière le relief
  if (o.etiquetterMasques && o.afficherRelief) {
    for (const passage of passagesMasques(o.trajetSoleil).slice(0, 4)) {
      const milieu = passage[Math.floor(passage.length / 2)];
      const sommet = Math.max(...passage.map(p => hauteurHorizon(horizon, p.sunAz)));
      const cx = Math.min(Math.max(x(milieu.sunAz), 64), L - 64);
      const cy = Math.max(y(sommet) - 30, 4);
      s += `<rect x="${cx - 60}" y="${cy}" width="120" height="22" rx="6" fill="${C.masque}"/>`;
      s += texteSvg(cx, cy + 15, 'Soleil masqué', C.masqueTexte, 14, 'middle');
    }
  }

  // Positions actuelles
  const repere = o.afficherRelief ? 'du relief' : "de l'horizon";
  if (o.actuel && o.montrerTerre) s += point(o.actuel.earthAz, o.actuel.earthEl, o.actuel.terre, C.terre, C.terreClair, o.actuel.margeTerre, 9 * k, x, y, L, false, repere, k);
  if (o.actuel && o.montrerSoleil) s += point(o.actuel.sunAz, o.actuel.sunEl, o.actuel.soleil !== 'cache', C.soleil, C.soleilClair, o.actuel.margeSoleil, 11 * k, x, y, L, o.actuel.soleil === 'partiel', repere, k);

  // Points cardinaux (azimut 0° = nord)
  [['N', 0], ['E', 90], ['S', 180], [langue === 'en' ? 'W' : 'O', 270], ['N', 360]].forEach(([nom, az]) => {
    s += texteSvg(Math.min(Math.max(x(az), 6 * k), L - 6 * k), H - 6, nom, C.texte, 13 * k, 'middle');
  });

  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  svg.innerHTML = s;
}

function point(az, el, visible, couleur, couleurTexte, marge, rayon, x, y, L, partiel, repere, k = 1) {
  const cx = x(az), cy = y(el);
  const remplissage = visible ? couleur : 'none';
  const opacite = partiel ? 0.55 : 1;
  const surRelief = repere === 'du relief';
  const legende = t(marge >= 0 ? (surRelief ? '{m} au-dessus du relief' : '{m} au-dessus de l\'horizon') : (surRelief ? '{m} sous le relief' : '{m} sous l\'horizon'), { m: formatDeg(marge) });
  const aDroite = cx < L - 220 * k;
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rayon}" fill="${remplissage}" fill-opacity="${opacite}" stroke="${couleur}" stroke-width="2"/>`
    + texteSvg(aDroite ? cx + rayon + 6 : cx - rayon - 6, cy - rayon, `Az ${Math.round(az)}° · ${legende}`, couleurTexte, 14 * k, aDroite ? 'start' : 'end');
}

function passagesMasques(trajet) {
  const passages = [];
  let courant = [];
  for (const p of trajet) {
    if (p && p.soleil === 'cache') courant.push(p);
    else {
      if (courant.length >= 3) passages.push(courant);
      courant = [];
    }
  }
  if (courant.length >= 3) passages.push(courant);
  return passages;
}

// ---------- Frise ----------
// Trois bandes (Soleil, Terre, les deux), découpées en plages de même état.
// Si pointsPlat est fourni, une 4e bande montre le Soleil avec un sol plat.
function dessinerFrise(conteneur, points, debut, pasHeures, indexCurseur, pointsPlat = null) {
  const etatSoleil = p => (p.soleil === 'visible' ? 'plein' : p.soleil === 'partiel' ? 'partiel' : 'vide');
  const bandes = [
    { nom: 'Soleil visible', points, etat: etatSoleil, couleur: C.soleil, partiel: C.soleilPartiel },
    { nom: 'Terre visible', points, etat: p => (p.terre ? 'plein' : 'vide'), couleur: C.terre },
    { nom: 'Les deux', points, etat: p => (p.terre ? etatSoleil(p) : 'vide'), couleur: '#D9DEE5', partiel: '#6B7380' },
  ];
  if (pointsPlat) bandes.push({ nom: 'Soleil, sol plat', points: pointsPlat, etat: etatSoleil, couleur: '#8C7A55', partiel: '#5C5037', discret: true });

  const n = points.length;
  const curseur = (100 * indexCurseur) / Math.max(n - 1, 1);

  let html = '';
  for (const b of bandes) {
    let plages = '', depart = 0;
    const etatDe = i => (b.points[i] ? b.etat(b.points[i]) : 'manque');
    for (let i = 1; i <= n; i++) {
      if (i === n || etatDe(i) !== etatDe(depart)) {
        const etat = etatDe(depart);
        const couleur = etat === 'plein' ? b.couleur : etat === 'partiel' ? b.partiel : etat === 'manque' ? C.grille : 'transparent';
        plages += `<span style="width:${((100 * (i - depart)) / n).toFixed(3)}%;background:${couleur}"></span>`;
        depart = i;
      }
    }
    html += `<span class="frise-nom${b.discret ? ' discret' : ''}">${b.nom}</span><div class="frise-barre">${plages}<i class="frise-curseur" style="left:${curseur}%"></i></div>`;
  }

  const jours = ((n - 1) * pasHeures) / 24;
  // Moins de graduations quand la frise est étroite (affichage côte à côte, téléphone).
  const etroite = conteneur.clientWidth > 0 && conteneur.clientWidth < 700;
  const pas = (jours > 20 ? 7 : jours > 8 ? 2 : 1) * (etroite ? 2 : 1);
  let graduations = '';
  for (let j = 0; j <= jours + 0.001; j += pas) {
    const libelle = j === 0 ? `${lettreJour()}0 · ${formatDateCourte(debut)}` : `${lettreJour()}${j}`;
    graduations += `<span style="left:${(100 * j) / jours}%">${libelle}</span>`;
  }
  html += `<span></span><div class="frise-graduations">${graduations}</div>`;
  conteneur.innerHTML = html;
}

// ---------- Le même jour à Paris ----------
// Hauteur du Soleil heure par heure, sur la même échelle pour les deux lieux :
// la courbe lunaire paraît plate, et c'est tout l'intérêt.
function dessinerComparaisonParis(svg, hauteursLune, hauteursParis, nomLune) {
  const L = 1000, H = 260, gauche = 60, droite = 980, haut = 20, bas = 220;
  const min = -10, max = Math.max(70, Math.ceil(Math.max(...hauteursParis) / 10) * 10);
  const x = h => gauche + ((droite - gauche) * h) / 24;
  const y = el => haut + ((max - el) / (max - min)) * (bas - haut);
  let s = '';
  for (let el = min; el <= max; el += 10) {
    s += `<line x1="${gauche}" y1="${y(el)}" x2="${droite}" y2="${y(el)}" stroke="${el === 0 ? C.ligne : C.grille}"/>`;
    s += texteSvg(12, y(el) + 4, `${el}°`, C.texte, 13);
  }
  for (let h = 0; h <= 24; h += 6) s += texteSvg(x(h), H - 12, `${h} h UTC`, C.texte, 13, 'middle');
  const trace = hauteurs => hauteurs.map((el, h) => `${h ? 'L' : 'M'}${x(h).toFixed(1)} ${y(el).toFixed(1)}`).join(' ');
  s += `<path d="${trace(hauteursParis)}" fill="none" stroke="${C.blanc}" stroke-width="2.5"/>`;
  s += `<path d="${trace(hauteursLune)}" fill="none" stroke="${C.soleil}" stroke-width="3"/>`;
  const iMax = hauteursParis.indexOf(Math.max(...hauteursParis));
  s += texteSvg(x(iMax), y(hauteursParis[iMax]) - 10, 'Paris', C.blanc, 14, 'middle', true);
  s += texteSvg(x(20), y(hauteursLune[20]) - 12, nomLune, C.soleilClair, 14, 'middle', true);
  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  svg.innerHTML = s;
}

// ---------- Calendrier de faisabilité ----------
// lignes : [{ id, nom, cases: [{ statut, titre }] }], une case par jour.
function dessinerCalendrier(conteneur, lignes, debut, nbJours) {
  let tete = '<span></span>';
  for (let j = 0; j < nbJours; j++) {
    const date = new Date(debut + j * JOUR);
    const premier = j === 0 || date.getUTCDate() === 1;
    tete += `<span class="cal-mois">${premier ? date.toLocaleDateString(localeDates(), { month: 'short', timeZone: 'UTC' }) : ''}</span>`;
  }
  let corps = '';
  for (const ligne of lignes) {
    corps += `<span class="cal-nom">${ligne.nom}</span>`;
    ligne.cases.forEach((c, j) => {
      corps += `<button type="button" class="cal-case ${c.statut}" data-id="${ligne.id}" data-jour="${j}" title="${c.titre}" aria-label="${c.titre}"></button>`;
    });
  }
  conteneur.style.gridTemplateColumns = `170px repeat(${nbJours}, 14px)`;
  conteneur.innerHTML = tete + corps;
}

// ---------- Courbe du rejeu d'une mission réelle ----------
// Marge du Soleil au-dessus du relief, de l'alunissage à la fin du rejeu.
function dessinerCourbeMarge(svg, points, reperes) {
  const L = 1000, H = 290, gauche = 60, droite = 980, haut = 36, bas = 230;
  const marges = points.filter(Boolean).map(p => p.margeSoleil);
  const min = Math.min(-2, Math.floor(Math.min(...marges)));
  const max = Math.max(4, Math.ceil(Math.max(...marges)) + 1);
  const x = i => gauche + ((droite - gauche) * i) / (points.length - 1);
  const y = m => haut + ((max - m) / (max - min)) * (bas - haut);
  let s = texteSvg(12, 20, 'Hauteur du Soleil au-dessus du relief', C.texte, 13);

  const pasGrille = max - min > 12 ? 5 : 2;
  for (let m = Math.ceil(min / pasGrille) * pasGrille; m <= max; m += pasGrille) {
    s += `<line x1="${gauche}" y1="${y(m)}" x2="${droite}" y2="${y(m)}" stroke="${m === 0 ? C.ligne : C.grille}"/>`;
    s += texteSvg(12, y(m) + 4, (m === 0 ? '0°' : formatDeg(m).replace(',0', '')), C.texte, 13);
  }

  if (reperes.coucher !== null) {
    s += `<rect x="${x(reperes.coucher)}" y="${haut}" width="${droite - x(reperes.coucher)}" height="${bas - haut}" fill="${C.nuit}" opacity="0.8"/>`;
    if (droite - x(reperes.coucher) > 170) s += texteSvg((x(reperes.coucher) + droite) / 2, haut + 20, 'Soleil sous le relief', C.texte, 14, 'middle');
  }

  let trace = '';
  points.forEach((p, i) => {
    if (p) trace += `${trace ? ' L' : 'M'}${x(i).toFixed(1)} ${y(p.margeSoleil).toFixed(1)}`;
  });
  s += `<path d="${trace}" fill="none" stroke="${C.soleil}" stroke-width="2.5"/>`;

  s += `<line x1="${x(0)}" y1="${haut}" x2="${x(0)}" y2="${bas + 10}" stroke="${C.terre}" stroke-width="1.5"/>`;
  s += texteSvg(x(0) + 6, bas + 28, t('Alunissage {d}', { d: formatDateCourte(points[0].instant) }), C.terreClair, 14);
  if (reperes.coucher !== null) {
    s += `<line x1="${x(reperes.coucher)}" y1="${haut}" x2="${x(reperes.coucher)}" y2="${bas + 10}" stroke="${C.soleil}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    s += texteSvg(x(reperes.coucher) - 6, bas + 28, 'Coucher prédit', C.soleilClair, 14, 'end');
  }
  if (reperes.dernierContact !== null) {
    s += `<line x1="${x(reperes.dernierContact)}" y1="${haut}" x2="${x(reperes.dernierContact)}" y2="${bas + 10}" stroke="${C.blanc}" stroke-width="1" stroke-dasharray="1 4"/>`;
    s += texteSvg(x(reperes.dernierContact) + 6, bas + 46, reperes.libelleFin || 'Fin de mission', C.texte, 14);
  }

  const actuel = points[reperes.actuel];
  if (actuel) {
    s += `<line x1="${x(reperes.actuel)}" y1="${haut}" x2="${x(reperes.actuel)}" y2="${bas}" stroke="${C.blanc}"/>`;
    s += `<circle cx="${x(reperes.actuel)}" cy="${y(actuel.margeSoleil)}" r="6" fill="${C.blanc}"/>`;
    s += texteSvg(x(reperes.actuel) + 8, y(actuel.margeSoleil) - 10, formatDeg(actuel.margeSoleil), C.blanc, 14);
  }

  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  svg.innerHTML = s;
}

// ---------- Zoom sur une période ----------
// Hauteur du Soleil au-dessus du relief pour plusieurs sites, sur une fenêtre de dates.
// series : [{ nom, couleur, tirets, points: [état | null] }] (mêmes instants pour tous les sites)
// o : { debut, fin, mission: { debut, fin } }
function dessinerZoom(svg, series, o) {
  const L = 1000, H = 300, gauche = 56, droite = 988, haut = 14, bas = 250;
  const marges = series.flatMap(sr => sr.points.filter(Boolean).map(p => p.margeSoleil));
  const min = Math.max(-12, Math.min(-2, Math.floor(marges.length ? Math.min(...marges) : -2)));
  const max = Math.min(12, Math.max(2, Math.ceil(marges.length ? Math.max(...marges) : 2) + 1));
  const x = t => gauche + ((droite - gauche) * (t - o.debut)) / (o.fin - o.debut);
  const y = m => haut + ((max - Math.min(Math.max(m, min), max)) / (max - min)) * (bas - haut);
  let s = '';

  // Mission en cours de préparation (date et durée choisies dans « Sites et dates »)
  if (o.mission && o.mission.fin > o.debut && o.mission.debut < o.fin) {
    const x1 = x(Math.max(o.mission.debut, o.debut)), x2 = x(Math.min(o.mission.fin, o.fin));
    s += `<rect x="${x1}" y="${haut}" width="${Math.max(x2 - x1, 1)}" height="${bas - haut}" fill="#253041" opacity="0.6"/>`;
    s += `<line x1="${x1}" y1="${haut}" x2="${x1}" y2="${bas}" stroke="${C.terre}" stroke-width="1.5"/>`;
    s += `<line x1="${x2}" y1="${haut}" x2="${x2}" y2="${bas}" stroke="${C.terre}" stroke-width="1.5"/>`;
    if (x2 - x1 > 120 || x1 < droite - 160) s += texteSvg(x1 + 6, haut + 16, 'mission', C.terreClair, 13);
  }

  // Bande du disque solaire partiellement caché (± 0,27°) et grille
  s += `<rect x="${gauche}" y="${y(RAYON_SOLEIL)}" width="${droite - gauche}" height="${y(-RAYON_SOLEIL) - y(RAYON_SOLEIL)}" fill="${C.soleil}" opacity="0.12"/>`;
  const pas = max - min > 12 ? 4 : 2;
  for (let m = Math.ceil(min / pas) * pas; m <= max; m += pas) {
    s += `<line x1="${gauche}" y1="${y(m)}" x2="${droite}" y2="${y(m)}" stroke="${m === 0 ? C.reliefBord : C.grille}" stroke-width="${m === 0 ? 1.5 : 1}"/>`;
    s += texteSvg(gauche - 8, y(m) + 4, m === 0 ? '0°' : `${m > 0 ? '+' : '−'}${Math.abs(m)}°`, m === 0 ? C.blanc : C.texte, 13, 'end');
  }
  s += texteSvg(gauche + 6, y(0) - 7, 'relief', '#B8C0CA', 13);

  // Graduations de dates : environ 5, sur des jours ronds
  const jours = (o.fin - o.debut) / JOUR;
  const pasJours = [1, 2, 5, 7, 10, 15, 30, 61].find(p => jours / p <= 6) || 61;
  const premier = Math.ceil(o.debut / JOUR) * JOUR;
  for (let t = premier; t <= o.fin; t += pasJours * JOUR) {
    s += `<line x1="${x(t)}" y1="${bas}" x2="${x(t)}" y2="${bas + 5}" stroke="${C.ligne}"/>`;
    const ancre = x(t) > droite - 40 ? 'end' : x(t) < gauche + 40 ? 'start' : 'middle';
    s += texteSvg(x(t), bas + 22, formatDateCourte(t), C.texte, 13, ancre);
  }

  // Une ligne par site
  for (const sr of series) {
    let trace = '';
    let ouvert = false;
    for (const p of sr.points) {
      if (!p) { ouvert = false; continue; }
      trace += `${ouvert ? ' L' : ' M'}${x(p.instant).toFixed(1)} ${y(p.margeSoleil).toFixed(1)}`;
      ouvert = true;
    }
    s += `<path d="${trace}" fill="none" stroke="${sr.couleur}" stroke-width="2.5" ${sr.tirets ? `stroke-dasharray="${sr.tirets}"` : ''}/>`;
  }

  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  svg.innerHTML = s;
}

// Bandes de visibilité de la Terre, une par site, sur la même fenêtre.
function dessinerBandesTerre(conteneur, series) {
  let html = '';
  for (const sr of series) {
    const n = sr.points.length;
    let plages = '', depart = 0;
    const etatDe = i => (sr.points[i] ? (sr.points[i].terre ? 'plein' : 'vide') : 'manque');
    for (let i = 1; i <= n; i++) {
      if (i === n || etatDe(i) !== etatDe(depart)) {
        const etat = etatDe(depart);
        const couleur = etat === 'plein' ? C.terre : etat === 'manque' ? C.grille : 'transparent';
        plages += `<span style="width:${((100 * (i - depart)) / n).toFixed(3)}%;background:${couleur}"></span>`;
        depart = i;
      }
    }
    html += `<span class="frise-nom">${t('Terre · {n}', { n: sr.nom })}</span><div class="frise-barre">${plages}</div>`;
  }
  conteneur.innerHTML = html;
}

// ---------- Carte polaire ----------
// Projection simple : distance au pôle proportionnelle à la colatitude,
// longitude 0° (face à la Terre) en bas.
function dessinerCarte(svg, sites, choisis) {
  const T = 760, cx = 380, cy = 380, R = 330;
  const position = site => {
    const r = ((90 - Math.abs(site.lat)) / 10) * R;
    const lon = (site.lon * Math.PI) / 180;
    return { x: cx - r * Math.sin(lon), y: cy + r * Math.cos(lon) };
  };

  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#151920" stroke="#3A414B"/>`;
  [82, 84, 86, 88].forEach(lat => {
    const r = ((90 - lat) / 10) * R;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2A3038" stroke-dasharray="3 5"/>`;
    s += texteSvg(cx + 6, cy - r - 4, `${lat}° S`, C.texte, 14);
  });
  s += `<line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="#2A3038"/>`;
  s += `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="#2A3038"/>`;
  s += texteSvg(cx, T - 8, '0° (face à la Terre)', C.texte, 14, 'middle');
  s += texteSvg(cx, 32, '180°', C.texte, 14, 'middle');
  s += texteSvg(cx - R - 8, cy + 4, '90° E', C.texte, 14, 'end');
  s += texteSvg(cx + R + 8, cy + 4, langue === 'en' ? '90° W' : '90° O', C.texte, 14, 'start');

  // Étiquettes : nom court, placé à droite du point, sinon à gauche, sinon décalé vers le bas,
  // pour que deux sites proches (Malapert et Leibnitz β) restent lisibles.
  const poles = sites.filter(si => si.lat <= -80).map(site => ({ site, ...position(site) }));
  const obstacles = poles.map(p => ({ x1: p.x - 10, x2: p.x + 10, y1: p.y - 10, y2: p.y + 10 }));
  const chevauche = b => obstacles.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
  const etiquettes = new Map();
  for (const p of [...poles].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const largeur = nomCourt(p.site).length * 9 + 4;
    let choix = null;
    for (const decalage of [0, 22, -22, 44, -44]) {
      const droite = { x1: p.x + 14, x2: p.x + 14 + largeur, y1: p.y - 10 + decalage, y2: p.y + 10 + decalage, ancre: 'start', tx: p.x + 14 };
      const gauche = { x1: p.x - 14 - largeur, x2: p.x - 14, y1: p.y - 10 + decalage, y2: p.y + 10 + decalage, ancre: 'end', tx: p.x - 14 };
      choix = [droite, gauche].find(b => !chevauche(b) && b.x1 > 0 && b.x2 < T);
      if (choix) { choix.ty = p.y + 5 + decalage; break; }
    }
    choix = choix || { ancre: 'start', tx: p.x + 14, ty: p.y + 5, x1: 0, x2: 0, y1: 0, y2: 0 };
    obstacles.push(choix);
    etiquettes.set(p.site.id, choix);
  }

  for (const { site, x, y } of poles) {
    const choisi = choisis.has(site.id);
    const e = etiquettes.get(site.id);
    if (site.historique) {
      // Mission passée : repère gris en pointillés, non cliquable (hors comparaison)
      s += `<g><title>${t('{n} (mission passée, hors comparaison)', { n: nomLong(site) })}</title>`;
      s += `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#7A8390" stroke-width="1.5" stroke-dasharray="2 3"/>`;
      s += texteSvg(e.tx, e.ty, nomCourt(site), '#9AA3AE', 14, e.ancre);
      s += '</g>';
      continue;
    }
    s += `<g class="carte-site" data-id="${site.id}" style="cursor:pointer"><title>${nomLong(site)}</title>`;
    s += choisi
      ? `<circle cx="${x}" cy="${y}" r="9" fill="${C.terre}" stroke="${C.blanc}" stroke-width="2"/>`
      : `<circle cx="${x}" cy="${y}" r="7" fill="#0E1116" stroke="#B8C0CA" stroke-width="2"/>`;
    if (Math.abs(e.ty - (y + 5)) > 1) s += `<line x1="${x}" y1="${y}" x2="${e.ancre === 'start' ? e.x1 - 2 : e.x2 + 2}" y2="${e.ty - 5}" stroke="#5A626D"/>`;
    s += texteSvg(e.tx, e.ty, nomCourt(site), choisi ? C.blanc : '#B8C0CA', 16, e.ancre, choisi);
    s += '</g>';
  }

  svg.setAttribute('viewBox', `0 0 ${T} ${T}`);
  svg.innerHTML = s;
}

// Petit horizon décoratif de la page d'accueil
function dessinerHorizonAccueil(svg) {
  svg.setAttribute('viewBox', '0 0 1120 120');
  svg.innerHTML = `
    <path d="M0 96 L90 88 L160 70 L220 78 L300 52 L360 64 L430 90 L560 94 L640 84 L720 60 L780 46 L850 72 L940 88 L1020 76 L1120 92 L1120 120 L0 120 Z" fill="#2A3038"/>
    <path d="M0 80 Q560 50 1120 80" fill="none" stroke="${C.soleil}" stroke-width="1.5" stroke-dasharray="4 6" opacity="0.7"/>
    <circle cx="470" cy="64" r="9" fill="${C.soleil}"/>
    <circle cx="900" cy="40" r="8" fill="${C.terre}"/>`;
}
