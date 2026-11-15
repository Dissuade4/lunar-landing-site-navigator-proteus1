// Dôme du ciel en 3D : l'horizon réel dessiné comme une couronne de relief autour du site,
// avec le trajet du Soleil et de la Terre. On tourne autour en faisant glisser la souris.
//
// Pas de bibliothèque : une projection simple sur un <canvas>, dessinée du plus loin au plus près.
// Les données sont exactement celles du calcul (horizon à 360° + positions), seules les hauteurs
// sont exagérées pour rester lisibles.

const vuesDome = {};   // clé de la vue -> { lacet, tangage } en degrés (gardés d'un affichage à l'autre)

// options : horizon (360 hauteurs), trajet (états de la mission), actuel (état à l'instant choisi)
// cle : identifiant de la vue ('detail', 'a', 'b') pour mémoriser l'orientation
function dessinerDome(canvas, o, cle) {
  const vue = vuesDome[cle] || (vuesDome[cle] = { lacet: null, tangage: 26 });
  if (vue.lacet === null) vue.lacet = o.actuel ? o.actuel.sunAz : 0;   // au départ, on regarde vers le Soleil
  canvas._dome = { o, cle };
  brancherDome(canvas);

  // Taille réelle du canvas (écrans haute densité compris)
  const largeur = canvas.clientWidth || 600;
  const hauteur = Math.max(260, Math.min(520, Math.round(largeur * 0.55)));
  const densite = window.devicePixelRatio || 1;
  canvas.style.height = `${hauteur}px`;
  canvas.width = Math.round(largeur * densite);
  canvas.height = Math.round(hauteur * densite);
  const g = canvas.getContext('2d');
  g.setTransform(densite, 0, 0, densite, 0, 0);
  g.clearRect(0, 0, largeur, hauteur);

  const trajet = (o.trajet || []).filter(Boolean);
  const hauteurs = [...o.horizon, ...trajet.flatMap(p => [p.sunEl, p.earthEl])];
  if (o.actuel) hauteurs.push(o.actuel.sunEl, o.actuel.earthEl);
  const maxAbs = Math.max(6, ...hauteurs.map(Math.abs));
  const echelle = 0.5 / maxAbs;                               // unités de hauteur par degré
  const R_ASTRES = 1.3;                                       // le Soleil et la Terre sont dessinés au-delà du relief

  const rad = Math.PI / 180;
  const lacet = vue.lacet * rad, tangage = vue.tangage * rad;
  // Rayon à l'écran choisi pour que tout tienne, quelle que soit l'inclinaison de la vue
  const R = Math.min(largeur / 3.0, hauteur / 2.6);
  const cx = largeur / 2, cy = hauteur * 0.57;

  // Point 3D (azimut, rayon au sol, hauteur) -> écran + profondeur (plus grand = plus loin)
  const projeter = (az, rayon, z) => {
    const a = az * rad - lacet;
    const x = rayon * Math.sin(a), y = rayon * Math.cos(a);
    return { x: cx + R * x, y: cy - R * (z * Math.cos(tangage) + y * Math.sin(tangage)), d: y * Math.cos(tangage) - z * Math.sin(tangage) };
  };
  const astre = (az, el) => projeter(az, R_ASTRES, R_ASTRES * echelle * el);
  const hauteurRelief = az => hauteurHorizon(o.horizon, az);

  const formes = [];   // { d, dessiner }
  const ligne = (p, q, couleur, epaisseur, tirets = []) => formes.push({
    d: (p.d + q.d) / 2,
    dessiner: () => { g.beginPath(); g.setLineDash(tirets); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.strokeStyle = couleur; g.lineWidth = epaisseur; g.stroke(); g.setLineDash([]); },
  });

  // Couronne de relief : un panneau par degré, entre le niveau du site (0°) et la hauteur de l'horizon.
  // Là où l'horizon est sous 0° (le site domine le terrain), le panneau descend sous le sol.
  for (let az = 0; az < 360; az += 1) {
    const h1 = echelle * hauteurRelief(az), h2 = echelle * hauteurRelief(az + 1);
    const a = projeter(az, 1, 0), b = projeter(az + 1, 1, 0), c = projeter(az + 1, 1, h2), e = projeter(az, 1, h1);
    const loin = projeter(az + 0.5, 1, 0).d > 0;   // côté éloigné : on voit la face intérieure
    const sousLeSol = h1 + h2 < 0;
    if (sousLeSol && loin) continue;               // caché par le sol
    formes.push({
      d: projeter(az + 0.5, 1, h1 / 2).d,
      dessiner: () => {
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath();
        g.fillStyle = sousLeSol ? '#1B2027' : loin ? '#3B434E' : 'rgba(38, 44, 53, 0.62)';   // le côté proche reste translucide
        g.fill();
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(c.x, c.y);
        g.strokeStyle = loin ? '#8A93A0' : 'rgba(138, 147, 160, 0.75)'; g.lineWidth = 1.5; g.stroke();
      },
    });
    // Bord du sol : l'horizon plat (0°)
    ligne(projeter(az, 1, 0), projeter(az + 1, 1, 0), '#5A626D', 1);
  }

  // Trajets du Soleil et de la Terre pendant la mission
  for (let i = 1; i < trajet.length; i++) {
    const p = trajet[i - 1], q = trajet[i];
    if (Math.abs(p.sunAz - q.sunAz) < 180) ligne(astre(p.sunAz, p.sunEl), astre(q.sunAz, q.sunEl), C.soleil, 2, [5, 5]);
    if (Math.abs(p.earthAz - q.earthAz) < 180) ligne(astre(p.earthAz, p.earthEl), astre(q.earthAz, q.earthEl), C.terre, 2, [5, 5]);
  }

  // Lignes de visée depuis le site, et positions actuelles
  const texte = (p, contenu, couleur, dy = -14) => {
    g.font = '600 13px Inter, system-ui, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = '#0B0E13'; g.strokeText(contenu, p.x, p.y + dy);
    g.fillStyle = couleur; g.fillText(contenu, p.x, p.y + dy);
  };
  const viser = (az, el, visible, partiel, couleur, couleurTexte, nom, rayon) => {
    const morceaux = 14;
    for (let k = 0; k < morceaux; k++) {
      const r1 = (R_ASTRES * k) / morceaux, r2 = (R_ASTRES * (k + 1)) / morceaux;
      ligne(projeter(az, r1, r1 * echelle * el), projeter(az, r2, r2 * echelle * el), visible ? couleur : '#7A8390', visible ? 2 : 1.5, visible ? [] : [3, 4]);
    }
    const p = astre(az, el);
    formes.push({
      d: p.d - 0.001,
      dessiner: () => {
        g.beginPath(); g.arc(p.x, p.y, rayon, 0, 2 * Math.PI);
        g.globalAlpha = partiel ? 0.55 : 1;
        g.fillStyle = visible ? couleur : '#0B0E13'; g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = couleur; g.lineWidth = 2; g.stroke();
        texte(p, visible ? t(nom) : t('{n} (caché)', { n: t(nom) }), couleurTexte, -rayon - 6);
      },
    });
  };
  if (o.actuel) {
    viser(o.actuel.earthAz, o.actuel.earthEl, o.actuel.terre, false, C.terre, C.terreClair, 'Terre', 7);
    viser(o.actuel.sunAz, o.actuel.sunEl, o.actuel.soleil !== 'cache', o.actuel.soleil === 'partiel', C.soleil, C.soleilClair, 'Soleil', 9);
  }

  // Le site, au centre
  const centre = projeter(0, 0, 0);
  formes.push({
    d: centre.d,
    dessiner: () => { g.beginPath(); g.arc(centre.x, centre.y, 5, 0, 2 * Math.PI); g.fillStyle = C.blanc; g.fill(); texte(centre, t('site'), C.blanc, 20); },
  });

  // Sol (toujours derrière), puis tout le reste du plus loin au plus près
  g.beginPath();
  for (let az = 0; az <= 360; az += 3) { const p = projeter(az, 1, 0); if (az) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }
  g.fillStyle = '#151A21'; g.fill();
  formes.sort((p, q) => q.d - p.d).forEach(f => f.dessiner());

  // Points cardinaux, autour du sol
  [['N', 0], ['E', 90], ['S', 180], [langue === 'en' ? 'W' : 'O', 270]].forEach(([nom, az]) => {
    const p = projeter(az, 1.14, 0);
    texte(p, nom, C.texte, 5);
  });

  return { exageration: echelle / Math.tan(rad) };   // rapport avec une hauteur à l'échelle réelle
}

// Rotation à la souris, au doigt ou au clavier (flèches). Branché une seule fois par canvas.
function brancherDome(canvas) {
  if (canvas._domeBranche) return;
  canvas._domeBranche = true;
  let depart = null;
  const tourner = (dLacet, dTangage) => {
    const vue = vuesDome[canvas._dome.cle];
    vue.lacet = (vue.lacet + dLacet + 360) % 360;
    vue.tangage = Math.max(6, Math.min(60, vue.tangage + dTangage));
    dessinerDome(canvas, canvas._dome.o, canvas._dome.cle);
  };
  canvas.addEventListener('pointerdown', e => { depart = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!depart) return;
    tourner(-(e.clientX - depart.x) * 0.4, (e.clientY - depart.y) * 0.3);
    depart = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel'].forEach(nom => canvas.addEventListener(nom, () => { depart = null; }));
  canvas.addEventListener('keydown', e => {
    const pas = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (!pas) return;
    e.preventDefault();
    tourner(pas[0], pas[1]);
  });
}

// Oriente une vue pour avoir un azimut donné en face (au fond de l'image).
function orienterDome(canvas, azimut) {
  if (!canvas._dome || azimut === null || azimut === undefined) return;
  vuesDome[canvas._dome.cle].lacet = azimut;
  dessinerDome(canvas, canvas._dome.o, canvas._dome.cle);
}

// Les dômes suivent la largeur de la fenêtre.
window.addEventListener('resize', () => {
  document.querySelectorAll('canvas.dome').forEach(canvas => {
    if (canvas._dome && canvas.clientWidth) dessinerDome(canvas, canvas._dome.o, canvas._dome.cle);
  });
});
