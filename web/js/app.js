// Navigation entre les écrans et mise à jour de l'affichage.

const etat = {
  sites: [],
  sources: new Map(),          // id du site -> source (horizon + positions)
  choisis: new Set(['malapert_massif', 'leibnitz_beta', 'connecting_ridge']),
  dateDebut: Date.UTC(2025, 2, 1, 0),   // début de la période calculée par le moteur Python
  dureeJours: 14,
  decalages: [0, 7, 15, 30],
  siteDetail: 'malapert_massif',
  decalageDetail: 0,
  heureDetail: 0,
  criteres: { soleilMin: 33, terreMin: 50, nuitMaxH: 48, elevationMin: 1 },
  report: 7,
  etape: 1,
  jourDecouverte: 9,
  rejeu: 4,
  relief: true,
  missionRejeu: 'im1',
  comparerPlat: false,
  son: false,
  joursCalendrier: 60,
  detailCote: false,           // Détail : un site, ou deux sites côte à côte
  siteB: null,                 // second site du côte à côte
  periodeDebut: null,          // fenêtre de l'onglet Période (initialisée autour de la date d'alunissage)
  periodeFin: null,
  dateHistorique: null,        // id du site historique dont la date est affichée dans le Détail
  dateAvantHistorique: null,   // date des candidats, restaurée en quittant ce site
};

const resumesEnCache = new Map();
let minuterie = null;

const $ = id => document.getElementById(id);
const site = id => etat.sites.find(s => s.id === id);
const source = id => etat.sources.get(id);

// ---------- Textes du parcours Découverte ----------
// Pour modifier un texte, c'est ici.

// Missions réelles rejouées à l'étape 4. Dates : sources publiques (voir README).
const MISSIONS_REELLES = [
  {
    id: 'im1',
    nom: 'IM-1 « Odysseus »',
    titreVisuel: 'IM-1 « Odysseus » près de Malapert A',
    site: 'im1_malapert_a',
    alunissage: Date.UTC(2024, 1, 22, 23, 23),   // 22 février 2024, 23:23 UTC
    fin: Date.UTC(2024, 1, 29),                  // 29 février 2024
    libelleFin: 'Dernier contact',
    titreFin: 'Dernier contact observé',
    dureeJours: 12,
    textes: [
      'L\'atterrisseur Odysseus s\'est posé près de Malapert A le 22 février 2024. Il n\'était pas conçu pour survivre à la nuit lunaire.',
      'Le dernier contact date du 29 février 2024. Odysseus s\'était aussi couché sur le flanc à l\'arrivée, ce qui a réduit sa production d\'énergie : notre calcul prédit le coucher du Soleil, pas cet accident.',
    ],
  },
  {
    id: 'ch3',
    nom: 'Chandrayaan-3',
    titreVisuel: 'Chandrayaan-3 « Vikram » au point Shiv Shakti',
    site: 'chandrayaan3',
    alunissage: Date.UTC(2023, 7, 23, 12, 33),   // 23 août 2023
    fin: Date.UTC(2023, 8, 4, 2, 30),            // 4 septembre 2023, mise en veille de Vikram
    libelleFin: 'Mise en veille',
    titreFin: 'Mise en veille observée',
    dureeJours: 16,
    textes: [
      'Vikram s\'est posé le 23 août 2023, vers 69° S : plus loin du pôle qu\'IM-1, avec un Soleil plus haut.',
      'Le rover Pragyan a été mis en veille le 2 septembre et l\'atterrisseur le 4, quand l\'énergie solaire diminuait. Deux missions, deux latitudes : de quoi tester l\'outil sur des cas réels.',
    ],
  },
];
const missionRejeu = () => MISSIONS_REELLES.find(m => m.id === etat.missionRejeu);

const ETAPES = [
  {
    nom: 'Le Soleil rasant',
    site: 'malapert_massif',
    debut: Date.UTC(2025, 2, 1),
    relief: false, soleil: true, terre: false,
    titre: 'Au pôle, le Soleil ne se lève pas : il fait le tour de l\'horizon',
    textes: [
      'L\'axe de la Lune n\'est incliné que d\'environ 1,5°. Vu du pôle Sud, le Soleil ne monte donc jamais haut : il glisse le long de l\'horizon et en fait le tour en un mois lunaire, environ 29,5 jours.',
      'Les panneaux solaires reçoivent une lumière rasante, et la moindre bosse du terrain peut tout changer.',
    ],
    essai: 'Faites avancer le temps et regardez la hauteur du Soleil : elle reste à quelques degrés autour de 0°.',
  },
  {
    nom: 'Le relief cache le Soleil',
    site: 'malapert_massif',
    debut: Date.UTC(2025, 2, 1),
    relief: true, soleil: true, terre: false, caseRelief: true,
    titre: 'Un sommet suffit à éteindre les panneaux solaires',
    textes: [
      'Au pôle Sud, le Soleil ne monte jamais haut : il tourne autour de l\'horizon. Dès qu\'un bord de cratère se dresse dans sa direction, il disparaît, même en plein « jour ».',
      'Sans atmosphère, la lumière ne contourne pas le relief : dès qu\'une crête passe devant le Soleil, l\'ombre tombe d\'un coup.',
    ],
    essai: 'Bougez le curseur et repérez les moments où le Soleil passe derrière un sommet.',
  },
  {
    nom: 'La Terre apparaît et disparaît',
    site: 'malapert_massif',
    debut: Date.UTC(2025, 2, 1),
    relief: true, soleil: false, terre: true,
    titre: 'La Terre aussi joue à cache-cache',
    textes: [
      'Vue du pôle, la Terre reste près de l\'horizon. Au fil du mois, elle oscille de quelques degrés à cause de la libration de la Lune.',
      'Quand elle passe sous le relief, la communication directe est coupée : il faut alors un satellite relais.',
    ],
    essai: 'Faites avancer le temps et repérez quand la Terre passe sous le relief.',
  },
  {
    nom: 'Rejeu de missions réelles',
    rejeu: true,
    titre: 'Une mission solaire vit le temps d\'un jour lunaire',
  },
];

// ---------- Démarrage ----------

async function demarrer() {
  demarrerTraduction();
  $('langue').textContent = langue === 'en' ? 'FR' : 'EN';
  etat.sites = await chargerSites();
  const sources = await Promise.all(etat.sites.map(chargerSource));
  sources.forEach(s => etat.sources.set(s.site.id, s));
  etat.choisis = new Set([...etat.choisis].filter(id => site(id) && !estHistorique(id)));
  if (!site(etat.siteDetail)) etat.siteDetail = etat.sites[0].id;

  appliquerParametres();
  await assurerDonnees();
  dessinerHorizonAccueil($('accueil-horizon'));
  afficherPied();
  brancherEvenements();
  window.addEventListener('hashchange', afficher);
  afficher();
}

function afficherPied() {
  const reels = [...etat.sources.values()].filter(s => !s.exemple).length;
  const plage = plageCommune();
  const periode = plage ? ' ' + t('Période calculée : du {d} au {f}.', { d: formatDate(plage.debut), f: formatDate(plage.fin) }) : '';
  $('pied').textContent = (reels === etat.sites.length
    ? t('Données : {n} sites calculés à partir d\'Horizons (JPL) et du relief LOLA.', { n: reels })
    : t('Données réelles : {n} site(s) sur {total}. Les autres affichent des valeurs d\'exemple en attendant les fichiers du dossier data/.', { n: reels, total: etat.sites.length })) + periode;
}

// ---------- Période des données ----------
// Le moteur Python précalcule les positions sur plusieurs années (calcul/precalcul.py).
// Quand l'utilisateur choisit une date, on calcule la fenêtre dont l'interface a besoin
// et on télécharge seulement les années correspondantes.

// Période couverte par TOUS les sites calculés (null si aucun site n'a de données réelles).
// Les missions historiques ont leur propre période (2023, 2024) : elles n'entrent pas dans ce calcul.
function plageCommune() {
  const t = [...etat.sources.values()].filter(s => !s.site.historique).map(s => s.timeline).filter(Boolean);
  if (!t.length) return null;
  const debut = Math.max(...t.map(x => x.debut)), fin = Math.min(...t.map(x => x.fin));
  return debut <= fin ? { debut, fin } : null;
}

// Fenêtre de temps utilisée par le mode Mission pour la date choisie :
//   - le report le plus lointain, ou la dernière date du calendrier (60 jours),
//   - plus la durée de la mission,
//   - plus 30 jours pour les comptes à rebours « Coucher dans… » de l'écran Détail.
function fenetreMission() {
  const joursAvant = Math.max(etat.joursCalendrier - 1, ...etat.decalages, etat.decalageDetail);
  return {
    debut: etat.dateDebut - JOUR,
    fin: etat.dateDebut + (joursAvant + etat.dureeJours + 30 + 1) * JOUR,
  };
}

// Télécharge les années nécessaires (mode Mission + étapes du mode Découverte).
async function assurerDonnees() {
  const periode = fenetrePeriode();
  const anneePeriode = Date.UTC(new Date(periode.debut).getUTCFullYear(), 0, 1);
  const fenetres = [fenetreMission(), periode,
    { debut: anneePeriode, fin: Date.UTC(new Date(periode.debut).getUTCFullYear() + 1, 0, 1) },
    ...ETAPES.filter(e => e.debut).map(e => ({ debut: e.debut, fin: e.debut + 31 * JOUR })),
    // Rejeu des missions réelles du mode Découverte, à leurs vraies dates
    ...MISSIONS_REELLES.map(m => ({ debut: m.alunissage - JOUR, fin: m.alunissage + (m.dureeJours + 2) * JOUR }))];
  const nouveau = await Promise.all([...etat.sources.values()].flatMap(src =>
    fenetres.map(f => chargerPeriode(src, f.debut, f.fin))));
  if (nouveau.some(Boolean)) resumesEnCache.clear();
}

// Date tapée dans le champ (AAAA-MM-JJ) -> instant à 14 h UTC, ou null si incomplète ou absurde.
function dateSaisie(texte) {
  if (!/^\d{4}-\d\d-\d\d$/.test(texte || '')) return null;
  const [a, m, j] = texte.split('-').map(Number);
  if (a < 1950 || a > 2150) return null;
  return Date.UTC(a, m - 1, j, 14);
}

// Valeur du champ date pour un instant (toujours au format AAAA-MM-JJ).
function valeurChampDate(instant) {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1000 || d.getUTCFullYear() > 9999) return '';
  return d.toISOString().slice(0, 10);
}

// ---------- Sites historiques ----------
// IM-1 et Chandrayaan-3 n'ont de données qu'autour de leur vraie date (2024, 2023).
// Ils restent hors de la comparaison des candidats ; dans le Détail, les choisir place la date
// sur leur alunissage, et revenir à un candidat restaure la date précédente.

const estHistorique = id => Boolean(site(id) && site(id).historique);

function dateMission(id) {
  const mission = MISSIONS_REELLES.find(m => m.site === id);
  if (mission) return mission.alunissage;
  const t = source(id) && source(id).timeline;
  return t ? t.debut + JOUR : etat.dateDebut;
}

// À appeler avant d'afficher un écran : place ou restaure la date selon le site du Détail.
function ajusterDatePourSite(ecran) {
  const historique = ecran === 'detail' && !etat.detailCote && estHistorique(etat.siteDetail);
  if (historique && etat.dateHistorique !== etat.siteDetail) {
    if (!etat.dateHistorique) etat.dateAvantHistorique = etat.dateDebut;
    etat.dateDebut = dateMission(etat.siteDetail);
    etat.dateHistorique = etat.siteDetail;
    etat.decalageDetail = 0;
    etat.heureDetail = 0;
  } else if (!historique && etat.dateHistorique) {
    etat.dateDebut = etat.dateAvantHistorique ?? etat.dateDebut;
    etat.dateHistorique = null;
    etat.heureDetail = 0;
  }
}

// Bornes du champ de date et message sur la période disponible.
function afficherPlage() {
  const th = etat.dateHistorique && source(etat.dateHistorique).timeline;
  const plage = th ? { debut: th.debut, fin: th.fin } : plageCommune();
  const champ = $('date-debut'), texte = $('plage-donnees');
  if (!plage) {
    champ.removeAttribute('min');
    champ.removeAttribute('max');
    texte.textContent = '';
    return;
  }
  const jourISO = ms => new Date(ms).toISOString().slice(0, 10);
  const derniere = plage.fin - etat.dureeJours * JOUR;   // la mission sans report doit tenir dans les données
  champ.min = jourISO(plage.debut);
  champ.max = jourISO(derniere);
  const f = fenetreMission();
  texte.classList.toggle('alerte', etat.dateDebut < plage.debut || f.fin > plage.fin);
  if (etat.dateDebut < plage.debut || etat.dateDebut > derniere) {
    texte.textContent = t('Hors des données : choisissez une date entre le {d} et le {f}.', { d: formatDate(plage.debut), f: formatDate(derniere) });
  } else if (f.fin > plage.fin) {
    texte.textContent = t('Données calculées jusqu\'au {f} : les reports et le calendrier qui vont au-delà afficheront « Sans données ».', { f: formatDate(plage.fin) });
  } else {
    texte.textContent = t('Données calculées du {d} au {f}.', { d: formatDate(plage.debut), f: formatDate(plage.fin) });
  }
  if (th) {
    texte.classList.remove('alerte');
    texte.textContent = t('Mission historique : données du {d} au {f}. Les autres onglets restent sur la date choisie pour les sites candidats.',
      { d: formatDate(plage.debut), f: formatDate(plage.fin) });
  }
}

// ---------- Navigation ----------

function lireAdresse() {
  const [chemin] = location.hash.slice(1).split('?');
  const [vue, detail] = (chemin || 'accueil').split('/');
  return { vue, detail };
}

// ---------- Lien partageable ----------
// Tout le scénario tient dans l'adresse : un ingénieur envoie le lien,
// un scientifique ouvre exactement la même vue.

function lienScenario() {
  const { vue, detail } = lireAdresse();
  const c = etat.criteres;
  const p = new URLSearchParams({
    site: etat.siteDetail,
    date: new Date(etat.dateDebut).toISOString().slice(0, 10),
    duree: etat.dureeJours,
    report: etat.report,
    decalage: etat.decalageDetail,
    sites: [...etat.choisis].join(','),
    dates: etat.decalages.join(','),
    lang: langue,
    criteres: [c.soleilMin, c.terreMin, c.nuitMaxH, c.elevationMin].join(','),
  });
  if (etat.detailCote) { p.set('cote', '1'); p.set('siteb', siteB()); }
  if (etat.periodeDebut !== null) {
    p.set('du', new Date(etat.periodeDebut).toISOString().slice(0, 10));
    p.set('au', new Date(etat.periodeFin).toISOString().slice(0, 10));
  }
  return `${location.origin}${location.pathname}#${vue}/${detail || 'selection'}?${p}`;
}

function appliquerParametres() {
  const requete = location.hash.split('?')[1];
  if (!requete) return;
  const p = new URLSearchParams(requete);
  const nombres = cle => (p.get(cle) || '').split(',').filter(Boolean).map(Number);
  if (site(p.get('site'))) etat.siteDetail = p.get('site');
  if (estHistorique(p.get('site'))) etat.detailCote = false;   // un site historique se voit seul, à sa date
  if (dateSaisie(p.get('date')) !== null) etat.dateDebut = dateSaisie(p.get('date'));
  if ([7, 10, 14].includes(Number(p.get('duree')))) etat.dureeJours = Number(p.get('duree'));
  if (p.has('report')) etat.report = Number(p.get('report')) || 0;
  if (p.has('decalage')) { etat.decalageDetail = Number(p.get('decalage')) || 0; etat.depuisConclusion = true; }
  if (p.get('sites')) etat.choisis = new Set(p.get('sites').split(',').filter(id => site(id) && !estHistorique(id)));
  if (nombres('dates').length) etat.decalages = [...new Set([0, ...nombres('dates')])].sort((a, b) => a - b);
  if (p.get('cote') === '1') etat.detailCote = true;
  if (site(p.get('siteb'))) etat.siteB = p.get('siteb');
  const jourUTC = texte => (/^\d{4}-\d\d-\d\d$/.test(texte || '') ? Date.parse(texte + 'T00:00:00Z') : null);
  if (jourUTC(p.get('du')) !== null && jourUTC(p.get('au')) > jourUTC(p.get('du'))) {
    etat.periodeDebut = jourUTC(p.get('du'));
    etat.periodeFin = jourUTC(p.get('au'));
  }
  const c = nombres('criteres');
  if (c.length === 4) [etat.criteres.soleilMin, etat.criteres.terreMin, etat.criteres.nuitMaxH, etat.criteres.elevationMin] = c;
  // On garde une adresse propre une fois le scénario chargé.
  history.replaceState(null, '', location.hash.split('?')[0]);
}

async function copierLien() {
  const lien = lienScenario();
  try {
    await navigator.clipboard.writeText(lien);
    $('copier-lien').textContent = 'Lien copié';
  } catch (erreur) {
    window.prompt(t('Copiez ce lien :'), lien);
  }
  setTimeout(() => { $('copier-lien').textContent = 'Copier le lien du scénario'; }, 2000);
}

async function afficher() {
  arreterLecture();
  sonner(null, false, false);
  const { vue, detail } = lireAdresse();
  appliquerParametres();
  const ongletsMission = ['selection', 'detail', 'comparaison', 'calendrier', 'periode'];
  ajusterDatePourSite(vue === 'mission' ? detail : vue);
  await assurerDonnees();
  const ecran = vue === 'decouverte' ? 'decouverte' : vue === 'mission' ? (ongletsMission.includes(detail) ? detail : 'selection') : 'accueil';
  if (vue === 'decouverte') etat.etape = Math.min(Math.max(Number(detail) || 1, 1), ETAPES.length);

  document.querySelectorAll('.vue').forEach(v => { v.hidden = true; });
  $(`vue-${ecran}`).hidden = false;

  $('mention-challenge').hidden = ecran !== 'accueil';
  $('choix-mode').hidden = ecran === 'accueil';
  $('onglets-mission').hidden = vue !== 'mission';
  $('copier-lien').hidden = vue !== 'mission';
  document.querySelectorAll('#choix-mode a').forEach(a => a.classList.toggle('actif', a.dataset.mode === vue));
  document.querySelectorAll('#onglets-mission a').forEach(a => a.classList.toggle('actif', a.dataset.onglet === ecran));

  if (ecran === 'decouverte') afficherDecouverte(true);
  if (ecran === 'selection') afficherSelection();
  if (ecran === 'detail') {
    // Le report ne s'applique que si l'on vient du bouton de la comparaison.
    if (!etat.depuisConclusion) etat.decalageDetail = 0;
    etat.depuisConclusion = false;
    afficherDetail(true);
  }
  if (ecran === 'comparaison') afficherComparaison();
  if (ecran === 'calendrier') afficherCalendrier();
  if (ecran === 'periode') afficherPeriode();
  window.scrollTo(0, 0);
}

// ---------- Découverte ----------

function afficherDecouverte(nouvelleEtape = false) {
  const etape = ETAPES[etat.etape - 1];
  const estRejeu = Boolean(etape.rejeu);
  const mission = missionRejeu();
  const src = source(estRejeu ? mission.site : etape.site);

  $('dec-etapes').innerHTML = ETAPES.map((e, i) =>
    `<li class="${i + 1 === etat.etape ? 'actif' : ''}"><a href="#decouverte/${i + 1}"><span>${i + 1}</span> ${e.nom}</a></li>`).join('');
  $('dec-numero').textContent = t('Étape {n} sur {total}', { n: etat.etape, total: ETAPES.length });
  $('dec-titre').textContent = etape.titre;
  $('dec-paragraphes').innerHTML = (estRejeu ? mission.textes : etape.textes).map(t => `<p>${t}</p>`).join('');
  $('dec-missions').hidden = !estRejeu;
  $('dec-missions').innerHTML = MISSIONS_REELLES.map(m =>
    `<button type="button" data-mission="${m.id}" class="${m.id === etat.missionRejeu ? 'actif' : ''}">${m.nom}</button>`).join('');
  $('dec-paris').hidden = etat.etape !== 1;
  $('dec-son').hidden = estRejeu;
  $('dec-badge').hidden = !src.exemple;
  $('dec-essai').hidden = estRejeu;
  $('dec-im1').hidden = !estRejeu;
  $('dec-essai-texte').textContent = etape.essai || '';
  $('dec-case-relief').hidden = !etape.caseRelief;

  $('dec-precedent').href = etat.etape > 1 ? `#decouverte/${etat.etape - 1}` : '#accueil';
  $('dec-suivant').href = estRejeu ? '#mission/selection' : `#decouverte/${etat.etape + 1}`;
  $('dec-suivant').textContent = estRejeu ? 'Passer en mode Mission' : 'Étape suivante';

  const curseur = $('dec-curseur');
  if (nouvelleEtape) {
    if (estRejeu) Object.assign(curseur, { min: 0, max: mission.dureeJours, step: 0.25 });
    else Object.assign(curseur, { min: 0, max: 29.5, step: 0.5 });
    curseur.value = estRejeu ? etat.rejeu : etat.jourDecouverte;
  }

  if (estRejeu) dessinerRejeu(src, mission);
  else dessinerCielDecouverte(etape, src);
  if (etat.etape === 1) dessinerParis(etape, src);
}

function dessinerParis(etape, src) {
  const jour = etape.debut + Math.floor(etat.jourDecouverte) * JOUR;
  const lune = [], paris = [];
  for (let h = 0; h <= 24; h++) {
    const e = etatA(sansRelief(src), jour + h * HEURE);
    lune.push(e ? e.sunEl : 0);
    paris.push(hauteurSoleilTerre(48.85, 2.35, jour + h * HEURE));
  }
  dessinerComparaisonParis($('paris-svg'), lune, paris, nomCourt(src.site));
  const maxParis = Math.max(...paris), minLune = Math.min(...lune), maxLune = Math.max(...lune);
  $('paris-texte').textContent = t('Le {date}, le Soleil monte à {max} au-dessus de Paris.', { date: formatDate(jour), max: formatDeg(maxParis, false) }) + ' '
    + t('Sur le site « {site} », il reste entre {min} et {max} toute la journée : sur cette échelle, sa courbe paraît plate.',
      { site: nomCourt(src.site), min: formatDeg(minLune), max: formatDeg(maxLune) });
}

function dessinerCielDecouverte(etape, src) {
  const avecRelief = etape.relief && (!etape.caseRelief || etat.relief);
  const calcul = avecRelief ? src : sansRelief(src);
  const instant = etape.debut + etat.jourDecouverte * JOUR;
  const trajet = serie(calcul, etape.debut, 29.5 * 24, 3);

  $('dec-titre-visuel').textContent = t('Le ciel vu depuis : {site}', { site: nomCourt(src.site) });
  $('dec-curseur-texte').textContent = t('Faites avancer le temps : jour {j} sur {total}', { j: formatNombre(etat.jourDecouverte), total: formatNombre(29.5) });
  $('dec-legende').innerHTML = [
    etape.soleil ? '<span><i class="trait orange"></i>Trajectoire du Soleil sur un jour lunaire</span>' : '',
    etape.terre ? '<span><i class="trait bleu"></i>Trajectoire de la Terre sur un mois</span>' : '',
    avecRelief ? '<span><i class="carre-relief"></i>Relief LOLA</span>' : '',
  ].join('');

  sonner(etatA(calcul, instant), etape.soleil, etape.terre);
  dessinerPanorama($('dec-svg'), {
    horizon: src.horizon,
    afficherRelief: avecRelief,
    trajetSoleil: etape.soleil ? trajet : [],
    trajetTerre: etape.terre ? trajet : [],
    actuel: etatA(calcul, instant),
    montrerSoleil: etape.soleil,
    montrerTerre: etape.terre,
    etiquetterMasques: etape.soleil,
  });
}

function dessinerRejeu(src, mission) {
  const points = serie(src, mission.alunissage, mission.dureeJours * 24, 1);
  let coucher = null;
  let dejaVisible = false;
  points.forEach((p, i) => {
    if (!p || coucher !== null) return;
    if (p.soleil !== 'cache') dejaVisible = true;
    else if (dejaVisible) coucher = i;
  });
  const fin = Math.round((mission.fin - mission.alunissage) / HEURE);
  const actuel = Math.round(etat.rejeu * 24);
  const jPlus = ms => `${lettreJour()}+${formatNombre(ms / JOUR, 1)}`;

  $('dec-titre-visuel').textContent = `${t(mission.titreVisuel)} · ${formatDeg(Math.abs(src.site.lat), false)} S`;
  $('dec-curseur-texte').textContent = t('Position dans le rejeu : {date}', { date: formatDate(mission.alunissage + actuel * HEURE) });
  $('dec-legende').innerHTML = '<span><i class="trait orange plein"></i>Hauteur du Soleil au-dessus du relief</span>';
  $('im1-predit').textContent = coucher === null
    ? 'pas de coucher sur la période'
    : `${formatDate(mission.alunissage + coucher * HEURE, true)} (${jPlus(coucher * HEURE)})`;
  $('im1-observe-titre').textContent = mission.titreFin;
  $('im1-observe').textContent = `${formatDate(mission.fin)} (${jPlus(mission.fin - mission.alunissage)})`;

  dessinerCourbeMarge($('dec-svg'), points, { coucher, dernierContact: fin, libelleFin: mission.libelleFin, actuel });
}

// ---------- Mission : sites et dates ----------

function afficherSelection() {
  const filtre = $('recherche').value.trim().toLowerCase();
  const groupes = [['pole', t('Pôle Sud · CLPS et Artemis')], ['autre', t('Autres régions (hors carte)')], ['historique', t('Missions historiques (rejeu, dates passées)')]];
  $('liste-sites').innerHTML = groupes.map(([groupe, titre]) => {
    const lignes = etat.sites
      .filter(s => (s.groupe || 'autre') === groupe && (s.nom + ' ' + nomLong(s)).toLowerCase().includes(filtre))
      .map(s => s.historique
        ? `<div class="ligne-site historique" title="${sourceSite(s)}">
          <a href="#mission/detail?site=${s.id}" class="lien-historique">Voir</a>
          <span>${nomLong(s)}<small>${t('Mission passée : à voir dans le Détail ou le rejeu (Découverte, étape 4)')}</small></span><span class="lat">${formatDeg(Math.abs(s.lat), false)} ${s.lat < 0 ? 'S' : 'N'}</span>
        </div>`
        : `<label class="ligne-site" title="${sourceSite(s)}">
          <input type="checkbox" data-id="${s.id}" ${etat.choisis.has(s.id) ? 'checked' : ''}>
          <span>${nomLong(s)}</span><span class="lat">${formatDeg(Math.abs(s.lat), false)} ${s.lat < 0 ? 'S' : 'N'}</span>
        </label>`).join('');
    return lignes ? `<span class="petit-titre">${titre}</span>${lignes}` : '';
  }).join('');

  dessinerCarte($('carte'), etat.sites, etat.choisis);

  $('selection-date').textContent = formatDate(etat.dateDebut);
  $('duree').value = String(etat.dureeJours);
  $('decalages').innerHTML = etat.decalages.map(d =>
    `<span class="puce">+${d} ${lettreJour().toLowerCase()}${d ? ` <button type="button" data-retirer="${d}" aria-label="${t('Retirer +{n} jours', { n: d })}">×</button>` : ''}</span>`).join('');
  const n = etat.choisis.size, m = etat.decalages.length;
  $('nb-scenarios').textContent = t('{n} site{ps} × {m} date{pm} = {total} scénarios', { n, m, ps: n > 1 ? 's' : '', pm: m > 1 ? 's' : '', total: n * m });
}

function basculerSite(id) {
  if (estHistorique(id)) return;   // une mission passée n'entre pas dans la comparaison
  if (etat.choisis.has(id)) etat.choisis.delete(id);
  else etat.choisis.add(id);
  afficherSelection();
}

// ---------- Mission : détail d'un site ----------

function afficherDetail(reinitialiser = false) {
  // La date d'alunissage se choisit ici (commune aux deux modes de l'onglet).
  if (document.activeElement !== $('date-debut')) $('date-debut').value = valeurChampDate(etat.dateDebut);
  afficherPlage();
  $('detail-un').hidden = etat.detailCote;
  $('detail-cote').hidden = !etat.detailCote;
  $('detail-site-champ').hidden = etat.detailCote;
  $('cote-titre').hidden = !etat.detailCote;
  $('mode-un').setAttribute('aria-pressed', String(!etat.detailCote));
  $('mode-cote').setAttribute('aria-pressed', String(etat.detailCote));
  if (etat.detailCote) {
    afficherCote(reinitialiser);
    return;
  }
  const src = source(etat.siteDetail);
  const debut = etat.dateDebut + etat.decalageDetail * JOUR;
  const heures = etat.dureeJours * 24;

  if (reinitialiser) {
    $('detail-site').innerHTML = etat.sites.map(s =>
      `<option value="${s.id}" ${s.id === etat.siteDetail ? 'selected' : ''}>${nomCourt(s)} · ${formatDeg(Math.abs(s.lat), false)} ${s.lat < 0 ? 'S' : 'N'}${s.historique ? ` · mission ${new Date(dateMission(s.id)).getUTCFullYear()}` : ''}</option>`).join('');
    $('detail-curseur').max = heures;
    etat.heureDetail = Math.min(etat.heureDetail, heures);
  }
  $('detail-curseur').value = etat.heureDetail;

  const instant = debut + etat.heureDetail * HEURE;
  const e = etatA(src, instant);
  $('detail-badge').hidden = !src.exemple;
  $('detail-date').textContent = formatDate(instant, true) + (etat.decalageDetail ? ' · ' + t('report de {n} j', { n: etat.decalageDetail }) : '');
  $('detail-curseur-texte').textContent = `${lettreJour()}+${Math.floor(etat.heureDetail / 24)} ${String(etat.heureDetail % 24).padStart(2, '0')} h`;

  afficherIndicateurs(src, e, instant);
  sonner(e, true, true);

  dessinerPanorama($('detail-panorama'), {
    horizon: src.horizon,
    afficherRelief: true,
    trajetSoleil: serie(src, instant, 72, 2),
    actuel: e,
    montrerSoleil: true,
    montrerTerre: true,
    etiquetterMasques: true,
  });

  const points = serie(src, debut, heures, 1);
  const resume = resumer(points);
  const dome = dessinerDome($('detail-dome'), { horizon: src.horizon, trajet: points.filter((_, k) => k % 2 === 0), actuel: e }, 'detail');
  $('detail-dome-note').textContent = t('Le relief entoure le site comme une couronne ; les pointillés montrent le trajet du Soleil et de la Terre pendant la mission.') + ' '
    + t('Faites glisser pour tourner. Hauteurs exagérées ×{x} pour rester lisibles.', { x: formatNombre(dome.exageration, 1) });
  $('frise-titre').textContent = t('Frise de la mission ({n} jours)', { n: etat.dureeJours });
  $('frise-chiffres').innerHTML = resume
    ? `<span>Ensoleillement <strong class="txt-soleil">${formatPct(resume.pctSoleil)}</strong></span>
       <span>Terre visible <strong class="txt-terre">${formatPct(resume.pctTerre)}</strong></span>
       <span>Les deux <strong>${formatPct(resume.pctLesDeux)}</strong></span>
       <span>Plus longue nuit <strong>${formatDuree(resume.nuitMaxH)}</strong></span>`
    : '<span>Pas de données pour ces dates</span>';
  const pointsPlat = etat.comparerPlat ? serie(sansRelief(src), debut, heures, 1) : null;
  dessinerFrise($('frise'), points, debut, 1, etat.heureDetail, pointsPlat);
  afficherComparaisonPlat(resume, pointsPlat ? resumer(pointsPlat) : null);
}

// Ce que le relief change par rapport à un sol parfaitement plat.
function afficherComparaisonPlat(reel, plat) {
  $('texte-plat').hidden = !(reel && plat);
  if (!reel || !plat) return;
  const ecartSoleil = plat.pctSoleil - reel.pctSoleil;
  const ecartNuit = reel.nuitMaxH - plat.nuitMaxH;
  const effetSoleil = Math.abs(ecartSoleil) < 1
    ? t('ne change presque pas l\'ensoleillement')
    : ecartSoleil > 0
      ? t('retire {n} points d\'ensoleillement ({r} au lieu de {p})', { n: Math.round(ecartSoleil), r: formatPct(reel.pctSoleil), p: formatPct(plat.pctSoleil) })
      : t('ajoute {n} points d\'ensoleillement ({r} au lieu de {p})', { n: Math.round(-ecartSoleil), r: formatPct(reel.pctSoleil), p: formatPct(plat.pctSoleil) });
  const effetNuit = ecartNuit === 0
    ? t('et ne change pas la plus longue nuit.')
    : ecartNuit > 0
      ? t('et allonge la plus longue nuit de {d}.', { d: formatDuree(ecartNuit) })
      : t('et raccourcit la plus longue nuit de {d}.', { d: formatDuree(-ecartNuit) });
  $('texte-plat').textContent = t('Sur cette mission, le relief {a} {b}', { a: effetSoleil, b: effetNuit });
}

function afficherIndicateurs(src, e, instant) {
  if (!e) {
    ['ind-soleil-el', 'ind-soleil-cd', 'ind-terre-el', 'ind-terre-cd'].forEach(id => { $(id).textContent = 'n/d'; });
    ['ind-soleil-el-note', 'ind-terre-el-note', 'ind-terre-cd-note'].forEach(id => { $(id).textContent = 'pas de données à cette date'; });
    $('ind-soleil-cd-titre').textContent = 'Coucher du Soleil dans';
    $('ind-terre-cd-titre').textContent = 'Coucher de la Terre dans';
    return;
  }
  $('ind-soleil-el').textContent = formatDeg(e.margeSoleil);
  $('ind-soleil-el-note').textContent = e.soleil === 'partiel' ? 'disque partiellement caché' : e.margeSoleil >= 0 ? 'au-dessus du relief' : 'sous le relief';
  $('ind-soleil-cd-titre').textContent = e.soleil !== 'cache' ? 'Coucher du Soleil dans' : 'Lever du Soleil dans';
  $('ind-soleil-cd').textContent = formatDuree(heuresAvantChangement(src, instant, 'soleil'));

  $('ind-terre-el').textContent = formatDeg(e.margeTerre);
  $('ind-terre-el-note').textContent = e.terre ? 'communication directe possible' : 'pas de liaison directe';
  $('ind-terre-cd-titre').textContent = e.terre ? 'Coucher de la Terre dans' : 'Lever de la Terre dans';
  $('ind-terre-cd').textContent = formatDuree(heuresAvantChangement(src, instant, 'terre'));
  $('ind-terre-cd-note').textContent = e.terre ? 'fin de la fenêtre radio' : 'début de la fenêtre radio';
}

// ---------- Mission : détail côte à côte ----------
// Deux sites, même date, même durée, mêmes critères : de quoi lire les compromis d'un coup d'œil.

// Couleur et tirets de chaque site dans les graphiques à plusieurs sites (colonne A, B, puis les suivants).
const STYLES_SITES = [
  { couleur: '#FFD58A', tirets: '8 5' },
  { couleur: '#F5A524', tirets: '' },
  { couleur: '#C9A2FF', tirets: '2 4' },
  { couleur: '#7EE2A8', tirets: '12 4 2 4' },
];

// Second site : celui choisi, sinon le premier autre site coché, sinon n'importe quel autre site.
function siteB() {
  if (etat.siteB && site(etat.siteB) && !estHistorique(etat.siteB)) return etat.siteB;
  const autres = [...sitesCompares(), ...etat.sites.map(s => s.id)].filter(id => id !== etat.siteDetail && !estHistorique(id));
  return autres[0] || etat.siteDetail;
}

function optionsSites(choisi) {
  return etat.sites.filter(s => !s.historique).map(s =>
    `<option value="${s.id}" ${s.id === choisi ? 'selected' : ''}>${nomCourt(s)} · ${formatDeg(Math.abs(s.lat), false)} ${s.lat < 0 ? 'S' : 'N'}</option>`).join('');
}

function afficherCote(reinitialiser) {
  const debut = etat.dateDebut + etat.decalageDetail * JOUR;
  const heures = etat.dureeJours * 24;
  if (reinitialiser) {
    $('cote-curseur').max = heures;
    etat.heureDetail = Math.min(etat.heureDetail, heures);
  }
  $('cote-curseur').value = etat.heureDetail;
  const instant = debut + etat.heureDetail * HEURE;
  $('detail-date').textContent = formatDate(debut, true) + ' · ' + t('mission de {n} jours', { n: etat.dureeJours })
    + (etat.decalageDetail ? ' · ' + t('report de {n} j', { n: etat.decalageDetail }) : '');
  $('cote-curseur-texte').textContent = t('Instant affiché sur les panoramas : {j} ({date})', {
    j: `${lettreJour()}+${Math.floor(etat.heureDetail / 24)} ${String(etat.heureDetail % 24).padStart(2, '0')} h`, date: formatDate(instant, true) });

  const infos = [etat.siteDetail, siteB()].map(id => {
    const src = source(id);
    const points = serie(src, debut, heures, 1);
    const r = resumer(points);
    return { id, src, points, r, v: verdict(r, etat.criteres), e: etatA(src, instant) };
  });
  $('detail-badge').hidden = !infos.some(x => x.src.exemple);
  infos.forEach((x, i) => remplirColonne(document.querySelector(`.cote-colonne[data-colonne="${i ? 'b' : 'a'}"]`), x, i, infos[1 - i], instant, debut));
  afficherCompromis(infos);
}

function remplirColonne(colonne, x, i, autre, instant, debut) {
  const lettre = i ? 'B' : 'A', autreLettre = i ? 'A' : 'B';
  const r = x.r, c = etat.criteres;
  const ecart = (valeur, valeurAutre) => {
    if (!autre.r) return '';
    const d = Math.round(valeur - valeurAutre);
    return d === 0 ? t('identique à {l}', { l: autreLettre }) : t('{n} points par rapport à {l}', { n: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, l: autreLettre });
  };
  const changement = quoi => {
    if (!x.e) return t('pas de données à cet instant');
    const visible = quoi === 'soleil' ? x.e.soleil !== 'cache' : x.e.terre;
    const verbe = visible ? 'coucher' : 'lever';
    return t(`${verbe} ${quoi === 'soleil' ? 'du Soleil' : 'de la Terre'} dans {d}`, { d: formatDuree(heuresAvantChangement(x.src, instant, quoi)) });
  };
  const indicateur = (titre, valeur, note, classe = '') =>
    `<div class="indicateur"><span>${titre}</span><strong class="${classe}">${valeur}</strong><small>${note}</small></div>`;
  const raison = x.v.statut === 'viable' ? t('Tous les critères sont remplis.')
    : x.v.raisons.map((t, k) => (k ? t : t[0].toUpperCase() + t.slice(1))).join(', ') + '.';

  colonne.setAttribute('aria-label', t('Site {l} : {n}', { l: lettre, n: nomCourt(x.src.site) }));
  colonne.innerHTML = `
    <div class="cote-entete">
      <span class="cote-lettre" aria-hidden="true">${lettre}</span>
      <select data-cote="${i ? 'b' : 'a'}" aria-label="${t('Site {l}', { l: lettre })}">${optionsSites(x.id)}</select>
      <span class="statut ${x.v.statut}">${libelleStatut(x.v.statut)}</span>
    </div>
    ${x.src.exemple ? `<span class="badge-exemple">${t('Valeurs d\'exemple')}</span>` : ''}
    <p class="cote-raison">${raison}</p>
    <div class="cote-indicateurs">
      ${indicateur('Soleil visible', r ? formatPct(r.pctSoleil) : 'n/d', r ? ecart(r.pctSoleil, autre.r && autre.r.pctSoleil) : '', 'txt-soleil')}
      ${indicateur('Terre visible', r ? formatPct(r.pctTerre) : 'n/d', r ? ecart(r.pctTerre, autre.r && autre.r.pctTerre) : '', 'txt-terre')}
      ${indicateur('Plus longue nuit', r ? formatDuree(r.nuitMaxH) : 'n/d', changement('soleil'))}
      ${indicateur('Soleil au-dessus du relief', r ? `${formatDeg(r.margeMax)} max` : 'n/d', t('critère : au moins {x}', { x: formatDeg(c.elevationMin, false) }))}
    </div>
    <svg class="graphique" role="img" aria-label="${t('Panorama de {site} avec le trajet du Soleil et de la Terre pendant la mission', { site: nomCourt(x.src.site) })}"></svg>
    <canvas class="dome" tabindex="0" role="img" aria-label="${t('Dôme du ciel en 3D de {site} : couronne du relief, Soleil et Terre. Flèches du clavier pour tourner.', { site: nomCourt(x.src.site) })}"></canvas>
    <p class="note">${t('{texte}. Dôme 3D : faites glisser pour tourner.', { texte: changement('terre')[0].toUpperCase() + changement('terre').slice(1) })}</p>
    <div class="frise"></div>`;

  // Trajets de toute la mission (un point toutes les 2 h), position à l'instant du curseur.
  const trajet = x.points.filter((_, k) => k % 2 === 0);
  dessinerPanorama(colonne.querySelector('svg'), {
    horizon: x.src.horizon,
    afficherRelief: true,
    trajetSoleil: trajet,
    trajetTerre: trajet,
    actuel: x.e,
    montrerSoleil: true,
    montrerTerre: true,
    etiquetterMasques: false,
    echelleTexte: 1.6,
  });
  dessinerDome(colonne.querySelector('canvas.dome'), { horizon: x.src.horizon, trajet, actuel: x.e }, i ? 'b' : 'a');
  dessinerFrise(colonne.querySelector('.frise'), x.points, debut, 1, etat.heureDetail);
}

// Tableau des compromis : chaque critère, la valeur des deux sites, et qui l'emporte.
function afficherCompromis(infos) {
  const c = etat.criteres;
  const [a, b] = infos;
  const nomA = nomCourt(a.src.site), nomB = nomCourt(b.src.site);
  const criteres = [
    { nom: t('Énergie (Soleil visible)'), seuil: `≥ ${formatPct(c.soleilMin)}`, val: r => r.pctSoleil, fmt: formatPct, ok: v => v >= c.soleilMin, mieux: 1 },
    { nom: t('Communication (Terre visible)'), seuil: `≥ ${formatPct(c.terreMin)}`, val: r => r.pctTerre, fmt: formatPct, ok: v => v >= c.terreMin, mieux: 1 },
    { nom: t('Survie (plus longue nuit)'), seuil: `≤ ${formatDuree(c.nuitMaxH)}`, val: r => r.nuitMaxH, fmt: formatDuree, ok: v => v <= c.nuitMaxH, mieux: -1 },
    { nom: t('Marge du Soleil sur le relief'), seuil: `≥ ${formatDeg(c.elevationMin, false)}`, val: r => r.margeMax, fmt: v => formatDeg(v), ok: v => v >= c.elevationMin, mieux: 1 },
    { nom: t('Soleil et Terre en même temps'), seuil: '–', val: r => r.pctLesDeux, fmt: formatPct, ok: null, mieux: 1 },
  ];
  const victoires = { a: 0, b: 0 };
  const lignes = criteres.map(k => {
    const cellule = x => {
      if (!x.r) return '<td>n/d</td>';
      const v = k.val(x.r);
      if (!k.ok) return `<td>${k.fmt(v)}</td>`;
      return `<td class="${k.ok(v) ? 'ok' : 'ko'}">${k.fmt(v)} ${k.ok(v) ? '✓' : '✕'}</td>`;
    };
    let avantage = '–';
    if (a.r && b.r) {
      const va = k.val(a.r), vb = k.val(b.r);
      if (k.fmt(va) === k.fmt(vb)) avantage = t('égalité');
      else if ((va - vb) * k.mieux > 0) { avantage = `A · ${nomA}`; if (k.ok) victoires.a++; }
      else { avantage = `B · ${nomB}`; if (k.ok) victoires.b++; }
    }
    return `<tr><th scope="row">${k.nom}</th><td>${k.seuil}</td>${cellule(a)}${cellule(b)}<td class="${avantage.length > 8 ? 'gagnant' : ''}">${avantage}</td></tr>`;
  }).join('');
  $('cote-compromis').innerHTML = `<thead><tr><th scope="col">${t('Critère')}</th><th scope="col">${t('Seuil')}</th><th scope="col">A · ${nomA}</th><th scope="col">B · ${nomB}</th><th scope="col">${t('Avantage')}</th></tr></thead><tbody>${lignes}</tbody>`;

  const etatSite = (x, n) => t('{n} est {statut}', { n, statut: libelleStatut(x.v.statut).toLowerCase() })
    + (x.v.statut === 'viable' || !x.v.raisons.length ? '' : ` (${x.v.raisons[0]})`);
  let resume = `${etatSite(a, nomA)} ; ${etatSite(b, nomB)}.`;
  if (a.r && b.r && victoires.a !== victoires.b) {
    const [gagnant, n] = victoires.a > victoires.b ? [nomA, victoires.a] : [nomB, victoires.b];
    resume += ' ' + t('{g} l\'emporte sur {n} des 4 critères de la mission.', { g: gagnant, n });
  }
  $('cote-resume').textContent = resume;
}

// ---------- Mission : zoom sur une période ----------
// Filtre les positions déjà précalculées : aucun nouvel appel à JPL Horizons.

const anneeUTC = t => new Date(t).getUTCFullYear();

function fenetrePeriode() {
  if (etat.periodeDebut === null || etat.periodeFin === null) {
    const jour = Math.floor(etat.dateDebut / JOUR) * JOUR;
    etat.periodeDebut = jour - 6 * JOUR;
    etat.periodeFin = jour + 14 * JOUR;
  }
  return { debut: etat.periodeDebut, fin: etat.periodeFin };
}

// Années proposées : celles calculées pour tous les sites, sinon quelques années autour de la date.
function anneesDisponibles() {
  const plage = plageCommune();
  const de = plage ? anneeUTC(plage.debut) : anneeUTC(etat.dateDebut) - 1;
  const a = plage ? anneeUTC(plage.fin) : anneeUTC(etat.dateDebut) + 1;
  return Array.from({ length: a - de + 1 }, (_, k) => de + k);
}

// Soleil visible (%) semaine par semaine sur une année, pour un site (un point toutes les 2 h).
function semainesSoleil(id, annee) {
  const cle = `semaines|${id}|${annee}`;
  if (!resumesEnCache.has(cle)) {
    const debutAnnee = Date.UTC(annee, 0, 1), finAnnee = Date.UTC(annee + 1, 0, 1);
    const semaines = [];
    for (let w = 0; debutAnnee + w * 7 * JOUR < finAnnee; w++) {
      const debut = debutAnnee + w * 7 * JOUR;
      const heures = Math.round((Math.min(debut + 7 * JOUR, finAnnee) - debut) / HEURE) - 2;
      const r = resumer(serie(source(id), debut, heures, 2), 2);
      semaines.push({ debut, pct: r ? r.pctSoleil : null });
    }
    resumesEnCache.set(cle, semaines);
  }
  return resumesEnCache.get(cle);
}

async function changerPeriode(debut, fin) {
  if (!(fin > debut)) fin = debut + JOUR;
  etat.periodeDebut = debut;
  etat.periodeFin = fin;
  await assurerDonnees();
  afficherPeriode();
}

function afficherPeriode() {
  const { debut, fin } = fenetrePeriode();
  const annee = anneeUTC(debut);
  const debutAnnee = Date.UTC(annee, 0, 1), finAnnee = Date.UTC(annee + 1, 0, 1);
  const nbJours = Math.round((finAnnee - debutAnnee) / JOUR);
  const ids = sitesCompares();
  const plage = plageCommune();

  // Année et vue d'ensemble
  const annees = anneesDisponibles();
  if (!annees.includes(annee)) annees.push(annee);
  $('periode-annee').innerHTML = annees.sort((x, y) => x - y).map(a => `<option value="${a}" ${a === annee ? 'selected' : ''}>${a}</option>`).join('');
  $('periode-titre-annee').textContent = t('Année {a} · Soleil visible par semaine', { a: annee })
    + (plage ? '' : ' ' + t('(valeurs d\'exemple)'));
  $('periode-bandes').innerHTML = ids.map(id => {
    const cases = semainesSoleil(id, annee).map((sem, w) => {
      const dans = sem.debut < fin && sem.debut + 7 * JOUR > debut;
      const fond = sem.pct === null ? '#252B34' : sem.pct === 0 ? '#0B0E13' : `rgba(245, 165, 36, ${(0.18 + 0.82 * sem.pct / 100).toFixed(2)})`;
      const texte = t('{site}, semaine du {date} : {val}', { site: nomCourt(site(id)), date: formatDateCourte(sem.debut),
        val: sem.pct === null ? t('pas de données') : t('Soleil {p}', { p: formatPct(sem.pct) }) });
      return `<button type="button" class="${dans ? 'dans' : ''}" style="background:${fond}" data-semaine="${sem.debut}" title="${texte}" aria-label="${texte}"></button>`;
    }).join('');
    return `<span title="${nomLong(site(id))}">${nomCourt(site(id))}</span><div class="bande">${cases}</div>`;
  }).join('');

  // Double curseur (en jours depuis le 1er janvier) et champs de date
  const jourDe = Math.max(0, Math.min(nbJours, Math.floor((debut - debutAnnee) / JOUR)));
  const jourA = Math.max(0, Math.min(nbJours, Math.ceil((fin - debutAnnee) / JOUR)));
  for (const [id, valeur] of [['periode-curseur-de', jourDe], ['periode-curseur-a', jourA]]) {
    $(id).max = nbJours;
    $(id).value = valeur;
  }
  $('periode-plage').style.left = `${(100 * jourDe) / nbJours}%`;
  $('periode-plage').style.width = `${(100 * Math.max(jourA - jourDe, 0)) / nbJours}%`;
  const iso = t => new Date(t).toISOString().slice(0, 10);
  // On ne réécrit pas un champ pendant que l'utilisateur tape dedans.
  if (document.activeElement !== $('periode-de')) $('periode-de').value = iso(debut);
  if (document.activeElement !== $('periode-a')) $('periode-a').value = iso(fin);
  if (plage) {
    for (const id of ['periode-de', 'periode-a']) { $(id).min = iso(plage.debut); $(id).max = iso(plage.fin); }
  }
  const jours = (fin - debut) / JOUR;
  const mission = etat.dureeJours;
  document.querySelectorAll('#periode-largeurs button').forEach(bouton => {
    const l = bouton.dataset.largeur;
    const actif = l === 'annee' ? debut === debutAnnee && fin === finAnnee
      : l === 'mission' ? debut === etat.dateDebut && Math.abs(jours - mission) < 0.01
        : Math.abs(jours - Number(l)) < 0.01;
    bouton.setAttribute('aria-pressed', String(actif));
    if (l === 'mission') bouton.textContent = t('Mission ({n} j)', { n: mission });
  });

  // Graphique : un point par heure, ou moins sur les longues périodes
  const heures = Math.round((fin - debut) / HEURE);
  const pas = Math.max(1, Math.ceil(heures / 1200));
  const series = ids.map((id, k) => ({
    id,
    nom: nomCourt(site(id)),
    ...STYLES_SITES[k % STYLES_SITES.length],
    points: serie(source(id), debut, heures, pas),
  }));
  const formatJours = j => (Number.isInteger(j) ? `${j}` : formatNombre(j, 1));
  $('periode-titre-graphique').textContent = t('Hauteur du Soleil au-dessus du relief · {d} → {f}', { d: formatDate(debut), f: formatDate(fin) });
  $('periode-legende').innerHTML = series.map(sr =>
    `<span><i class="trait-site" style="border-top-color:${sr.couleur};border-top-style:${sr.tirets ? 'dashed' : 'solid'}"></i>${sr.nom}</span>`).join('')
    + `<span><i class="carre-relief" style="background:#253041;border-color:#4C9AFF"></i>${t('Mission prévue')}</span>`;
  dessinerZoom($('periode-graphique'), series, {
    debut, fin,
    mission: { debut: etat.dateDebut, fin: etat.dateDebut + etat.dureeJours * JOUR },
  });
  dessinerBandesTerre($('periode-terre'), series);

  // Bilan de la période, site par site
  $('periode-titre-bilan').textContent = t('Sur ces {n} jours', { n: formatJours(jours) });
  const lignes = series.map(sr => {
    const r = resumer(sr.points, pas);
    const cellules = r
      ? `<td class="txt-soleil">${formatPct(r.pctSoleil)}</td><td class="txt-terre">${formatPct(r.pctTerre)}</td><td>${formatPct(r.pctLesDeux)}</td><td>${formatDuree(r.nuitMaxH)}</td><td>${formatDeg(r.margeMax)}</td>`
      : '<td colspan="5">pas de données sur cette période</td>';
    return `<tr><th scope="row"><i class="trait-site" style="border-top-color:${sr.couleur};border-top-style:${sr.tirets ? 'dashed' : 'solid'}"></i>${sr.nom}${source(sr.id).exemple ? ' <span class="badge-exemple">exemple</span>' : ''}</th>${cellules}</tr>`;
  }).join('');
  $('periode-bilan').innerHTML = '<thead><tr><th scope="col">Site</th><th scope="col">Soleil visible</th><th scope="col">Terre visible</th><th scope="col">Les deux</th><th scope="col">Plus longue nuit</th><th scope="col">Soleil max au-dessus du relief</th></tr></thead>'
    + `<tbody>${lignes}</tbody>`;
}

// ---------- Mission : comparaison ----------

function resumeScenario(id, decalage) {
  const cle = `${id}|${etat.dateDebut}|${decalage}|${etat.dureeJours}`;
  if (!resumesEnCache.has(cle)) {
    const debut = etat.dateDebut + decalage * JOUR;
    resumesEnCache.set(cle, resumer(serie(source(id), debut, etat.dureeJours * 24, 1)));
  }
  return resumesEnCache.get(cle);
}

function sitesCompares() {
  const ids = etat.sites.filter(s => etat.choisis.has(s.id)).map(s => s.id);
  return ids.length ? ids : etat.sites.filter(s => s.groupe === 'pole').map(s => s.id);
}

function afficherComparaison() {
  const c = etat.criteres;
  $('crit-soleil-min').value = c.soleilMin;
  $('crit-terre-min').value = c.terreMin;
  $('crit-nuit-max').value = c.nuitMaxH;
  $('crit-elev-min').value = c.elevationMin;
  $('val-soleil-min').textContent = formatPct(c.soleilMin);
  $('val-terre-min').textContent = formatPct(c.terreMin);
  $('val-nuit-max').textContent = formatDuree(c.nuitMaxH);
  $('val-elev-min').textContent = formatDeg(c.elevationMin, false);
  $('report').value = etat.report;
  $('report-texte').innerHTML = t('Report de la date d\'alunissage : <strong>+{n} jours</strong> ({date})', { n: etat.report, date: formatDate(etat.dateDebut + etat.report * JOUR) });

  const ids = sitesCompares();
  const decalages = [...etat.decalages].sort((a, b) => a - b);
  $('comp-badge').hidden = !ids.some(id => source(id).exemple);

  const entete = '<thead><tr><th scope="col">Site</th>' + decalages.map(d =>
    `<th scope="col" class="${d === etat.report ? 'colonne-active' : ''}">+${d} ${lettreJour().toLowerCase()} · ${formatDateCourte(etat.dateDebut + d * JOUR)}</th>`).join('') + '</tr></thead>';
  const corps = ids.map(id => '<tr><th scope="row" title="' + nomLong(site(id)) + '">' + nomCourt(site(id)) + '</th>' + decalages.map(d => {
    const r = resumeScenario(id, d);
    const v = verdict(r, c);
    const detail = r
      ? t('Soleil {s} · Terre {e} · nuit max {n}', { s: formatPct(r.pctSoleil), e: formatPct(r.pctTerre), n: formatDuree(r.nuitMaxH) }) + (v.raisons.length ? ` · ${v.raisons.join(', ')}` : '')
      : t('pas de données');
    return `<td class="${d === etat.report ? 'colonne-active' : ''}" title="${detail}">
        <span class="statut ${v.statut}">${libelleStatut(v.statut)}</span>
        <span class="nuit">${r ? t('nuit {d}', { d: formatDuree(r.nuitMaxH) }) : 'n/d'}</span>
      </td>`;
  }).join('') + '</tr>').join('');
  $('matrice').innerHTML = entete + `<tbody>${corps}</tbody>`;

  afficherConclusion(ids);
}

function libelleStatut(statut) {
  return t({ viable: 'Viable', limite: 'Limite', exclu: 'Exclu', inconnu: 'Sans données' }[statut]);
}

function afficherConclusion(ids) {
  const ordre = { viable: 0, limite: 1, exclu: 2, inconnu: 3 };
  const resultats = ids.map(id => {
    const r = resumeScenario(id, etat.report);
    return { id, nom: nomCourt(site(id)), r, v: verdict(r, etat.criteres) };
  }).sort((a, b) => ordre[a.v.statut] - ordre[b.v.statut] || (a.r ? a.r.nuitMaxH : 1e9) - (b.r ? b.r.nuitMaxH : 1e9));

  const viables = resultats.filter(x => x.v.statut === 'viable').map(x => x.nom);
  const exclus = resultats.filter(x => x.v.statut === 'exclu');

  let texte;
  if (!viables.length) texte = t('Aucun site n\'est viable à cette date.');
  else if (viables.length === 1) texte = t('{s} est le seul site viable.', { s: viables[0] });
  else texte = t('{liste} et {dernier} restent viables.', { liste: viables.slice(0, -1).join(', '), dernier: viables.at(-1) });
  for (const x of exclus) texte += ' ' + t('{s} est exclu : {r}.', { s: x.nom, r: x.v.raisons[0] });

  $('conclusion-titre').textContent = etat.report ? t('Avec un report de {n} jours', { n: etat.report }) : t('À la date prévue');
  $('conclusion-texte').textContent = texte;
  const meilleur = resultats[0];
  $('conclusion-bouton').textContent = t('Ouvrir {s}', { s: meilleur.nom });
  $('conclusion-bouton').dataset.id = meilleur.id;
}

// ---------- Mission : calendrier de faisabilité ----------

function afficherCalendrier() {
  const ids = sitesCompares();
  const nbJours = etat.joursCalendrier;
  $('cal-badge').hidden = !ids.some(id => source(id).exemple);
  $('cal-intro').textContent = t('Chaque ligne montre, pour une date d\'alunissage entre le {d} et le {f}, si une mission de {n} jours serait viable.',
    { d: formatDate(etat.dateDebut), f: formatDate(etat.dateDebut + (nbJours - 1) * JOUR), n: etat.dureeJours });

  const lignes = ids.map(id => ({
    id,
    nom: nomCourt(site(id)),
    cases: Array.from({ length: nbJours }, (_, j) => {
      const r = resumeScenario(id, j);
      const v = verdict(r, etat.criteres);
      const titre = `${nomCourt(site(id))}, ${formatDate(etat.dateDebut + j * JOUR)} : ${libelleStatut(v.statut)}`
        + (r ? ', ' + t('nuit max {d}', { d: formatDuree(r.nuitMaxH) }) : '');
      return { statut: v.statut, titre };
    }),
  }));
  dessinerCalendrier($('calendrier'), lignes, etat.dateDebut, nbJours);

  // Plus longue fenêtre de dates viables, tous sites confondus
  let meilleure = null;
  for (const ligne of lignes) {
    let debut = null;
    ligne.cases.forEach((c, j) => {
      const viable = c.statut === 'viable';
      if (viable && debut === null) debut = j;
      if ((!viable || j === nbJours - 1) && debut !== null) {
        const fin = viable ? j : j - 1;
        if (!meilleure || fin - debut > meilleure.fin - meilleure.debut) meilleure = { nom: ligne.nom, debut, fin };
        debut = null;
      }
    });
  }
  $('cal-resume').textContent = meilleure
    ? t('Plus longue fenêtre de tir : {s}, du {d} au {f} ({n} jour{p} d\'affilée).', { s: meilleure.nom, d: formatDate(etat.dateDebut + meilleure.debut * JOUR),
      f: formatDate(etat.dateDebut + meilleure.fin * JOUR), n: meilleure.fin - meilleure.debut + 1, p: meilleure.fin > meilleure.debut ? 's' : '' })
    : t('Aucune date viable sur la période avec les critères actuels.');
}

// ---------- Son ----------
// Une note suit la hauteur du Soleil et se tait quand il est caché ;
// un second son, plus aigu, signale que la Terre est visible.

const audio = { contexte: null, soleil: null, terre: null };

function preparerSon() {
  if (audio.contexte) return;
  audio.contexte = new (window.AudioContext || window.webkitAudioContext)();
  const voix = (type, frequence) => {
    const osc = audio.contexte.createOscillator();
    const volume = audio.contexte.createGain();
    osc.type = type;
    osc.frequency.value = frequence;
    volume.gain.value = 0;
    osc.connect(volume).connect(audio.contexte.destination);
    osc.start();
    return { osc, volume };
  };
  audio.soleil = voix('sine', 330);
  audio.terre = voix('triangle', 880);
}

function sonner(e, avecSoleil, avecTerre) {
  if (!etat.son || !audio.contexte) return;
  const t = audio.contexte.currentTime;
  const soleilVisible = e && avecSoleil && e.soleil !== 'cache';
  const terreVisible = e && avecTerre && e.terre;
  if (soleilVisible) audio.soleil.osc.frequency.setTargetAtTime(Math.max(150, Math.min(900, 330 + 40 * e.margeSoleil)), t, 0.05);
  audio.soleil.volume.gain.setTargetAtTime(soleilVisible ? (e.soleil === 'partiel' ? 0.05 : 0.12) : 0, t, 0.03);
  audio.terre.volume.gain.setTargetAtTime(terreVisible ? 0.03 : 0, t, 0.03);
}

function basculerSon() {
  etat.son = !etat.son;
  if (etat.son) {
    preparerSon();
    audio.contexte.resume();
  } else if (audio.contexte) {
    sonner(null, false, false);
    audio.soleil.volume.gain.value = 0;
    audio.terre.volume.gain.value = 0;
  }
  ['dec-son', 'detail-son'].forEach(id => {
    $(id).textContent = etat.son ? 'Son activé' : 'Son coupé';
    $(id).setAttribute('aria-pressed', String(etat.son));
  });
  const { vue, detail } = lireAdresse();
  if (vue === 'decouverte') afficherDecouverte();
  if (detail === 'detail') afficherDetail();
}

// ---------- Lecture automatique ----------

function iconeLecture(bouton, enCours) {
  bouton.innerHTML = enCours
    ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L13 8 L4 14 Z" fill="currentColor"/></svg>';
  bouton.setAttribute('aria-label', enCours ? 'Pause' : 'Lecture');
}

function lancerLecture(bouton, avancer) {
  if (minuterie) { arreterLecture(); return; }
  iconeLecture(bouton, true);
  minuterie = setInterval(() => { if (!avancer()) arreterLecture(); }, 60);
}

function arreterLecture() {
  clearInterval(minuterie);
  minuterie = null;
  iconeLecture($('dec-lecture'), false);
  iconeLecture($('detail-lecture'), false);
}

// ---------- Événements ----------

function brancherEvenements() {
  // Découverte
  $('dec-curseur').addEventListener('input', e => {
    if (etat.etape === 4) etat.rejeu = Number(e.target.value);
    else etat.jourDecouverte = Number(e.target.value);
    afficherDecouverte();
  });
  $('dec-relief').addEventListener('change', e => { etat.relief = e.target.checked; afficherDecouverte(); });
  $('dec-missions').addEventListener('click', e => {
    const id = e.target.dataset.mission;
    if (!id) return;
    arreterLecture();
    etat.missionRejeu = id;
    etat.rejeu = 4;
    afficherDecouverte(true);
  });
  $('dec-son').addEventListener('click', basculerSon);
  $('detail-son').addEventListener('click', basculerSon);
  $('copier-lien').addEventListener('click', copierLien);
  // Langue : le bouton affiche la langue vers laquelle il bascule.
  $('langue').addEventListener('click', () => {
    changerLangue(langue === 'en' ? 'fr' : 'en', () => {
      $('langue').textContent = langue === 'en' ? 'FR' : 'EN';
      resumesEnCache.clear();          // les raisons des verdicts sont des textes traduits
      dessinerHorizonAccueil($('accueil-horizon'));
      afficherPied();
      afficher();
    });
  });
  $('comparer-plat').addEventListener('change', e => { etat.comparerPlat = e.target.checked; afficherDetail(); });
  $('calendrier').addEventListener('click', e => {
    const c = e.target.closest('.cal-case');
    if (!c) return;
    etat.siteDetail = c.dataset.id;
    etat.decalageDetail = Number(c.dataset.jour);
    etat.heureDetail = 0;
    etat.depuisConclusion = true;
    location.hash = 'mission/detail';
  });
  $('dec-lecture').addEventListener('click', () => lancerLecture($('dec-lecture'), () => {
    const c = $('dec-curseur');
    if (Number(c.value) >= Number(c.max)) return false;
    c.value = Math.min(Number(c.max), Number(c.value) + Number(c.step));
    c.dispatchEvent(new Event('input'));
    return true;
  }));

  // Sites et dates
  $('recherche').addEventListener('input', afficherSelection);
  $('liste-sites').addEventListener('change', e => { if (e.target.dataset.id) basculerSite(e.target.dataset.id); });
  $('carte').addEventListener('click', e => {
    const groupe = e.target.closest('.carte-site');
    if (groupe) basculerSite(groupe.dataset.id);
  });
  // Dès que la date ou la durée change, on télécharge les années utiles en arrière-plan.
  // Le navigateur envoie « change » à chaque chiffre tapé dans l'année (0002, 0020, 0202, 2027…) :
  // on attend que la saisie se calme, on ignore les années absurdes, et on ne réécrit jamais
  // le champ pendant que l'utilisateur tape dedans (voir afficherDetail).
  let attenteDate = null;
  $('date-debut').addEventListener('change', e => {
    clearTimeout(attenteDate);
    const instant = dateSaisie(e.target.value);
    if (instant === null) return;
    attenteDate = setTimeout(() => {
      etat.dateDebut = instant;
      etat.periodeDebut = etat.periodeFin = null;   // l'onglet Période se recentre sur la nouvelle date
      etat.decalageDetail = 0;
      etat.heureDetail = 0;
      afficherPlage();
      // On télécharge les années utiles, puis on redessine le détail à la nouvelle date.
      assurerDonnees().then(() => afficherDetail(true));
    }, 500);
  });
  // En quittant le champ, une saisie incomplète ou absurde est remplacée par la date en cours.
  $('date-debut').addEventListener('blur', e => {
    if (dateSaisie(e.target.value) === null) e.target.value = valeurChampDate(etat.dateDebut);
  });
  $('duree').addEventListener('change', e => { etat.dureeJours = Number(e.target.value); assurerDonnees(); });
  $('decalages').addEventListener('click', e => {
    const valeur = e.target.dataset.retirer;
    if (valeur === undefined) return;
    etat.decalages = etat.decalages.filter(d => d !== Number(valeur));
    afficherSelection();
  });
  $('ajouter-decalage').addEventListener('click', () => {
    const valeur = Math.round(Number($('nouveau-decalage').value));
    if (valeur > 0 && valeur <= 120 && !etat.decalages.includes(valeur)) {
      etat.decalages = [...etat.decalages, valeur].sort((a, b) => a - b);
    }
    $('nouveau-decalage').value = '';
    afficherSelection();
    assurerDonnees();
  });

  // Détail
  $('detail-site').addEventListener('change', async e => {
    etat.siteDetail = e.target.value;
    const avant = etat.dateDebut;
    ajusterDatePourSite('detail');
    await assurerDonnees();
    afficherDetail(etat.dateDebut !== avant);
  });
  $('detail-curseur').addEventListener('input', e => { etat.heureDetail = Number(e.target.value); afficherDetail(); });
  $('detail-lecture').addEventListener('click', () => lancerLecture($('detail-lecture'), () => {
    const max = etat.dureeJours * 24;
    if (etat.heureDetail >= max) return false;
    etat.heureDetail = Math.min(max, etat.heureDetail + 2);
    afficherDetail();
    return true;
  }));

  // Dôme 3D
  const viserDome = cle => () => {
    const actuel = $('detail-dome')._dome && $('detail-dome')._dome.o.actuel;
    if (actuel) orienterDome($('detail-dome'), actuel[cle]);
  };
  $('dome-soleil').addEventListener('click', viserDome('sunAz'));
  $('dome-terre').addEventListener('click', viserDome('earthAz'));

  // Détail côte à côte
  $('mode-un').addEventListener('click', async () => {
    arreterLecture();
    etat.detailCote = false;
    ajusterDatePourSite('detail');
    await assurerDonnees();
    afficherDetail(true);
  });
  $('mode-cote').addEventListener('click', async () => {
    arreterLecture();
    etat.detailCote = true;
    if (estHistorique(etat.siteDetail)) etat.siteDetail = sitesCompares().find(id => !estHistorique(id)) || etat.siteDetail;
    ajusterDatePourSite('detail');
    await assurerDonnees();
    afficherDetail(true);
  });
  $('detail-cote').addEventListener('change', e => {
    const colonne = e.target.dataset.cote;
    if (!colonne) return;
    if (colonne === 'a') etat.siteDetail = e.target.value;
    else etat.siteB = e.target.value;
    afficherDetail();
  });
  $('cote-curseur').addEventListener('input', e => { etat.heureDetail = Number(e.target.value); afficherDetail(); });

  // Zoom sur une période
  // Même prudence que pour la date d'alunissage : années absurdes ignorées, saisie attendue.
  const jourDuChamp = valeur => (dateSaisie(valeur) === null ? null : dateSaisie(valeur) - 14 * HEURE);
  let attentePeriode = null;
  const plusTard = action => { clearTimeout(attentePeriode); attentePeriode = setTimeout(action, 500); };
  ['periode-de', 'periode-a'].forEach(id => $(id).addEventListener('blur', () => afficherPeriode()));
  $('periode-annee').addEventListener('change', e => {
    // Même fenêtre, décalée sur l'année choisie
    const { debut, fin } = fenetrePeriode();
    const ecart = Date.UTC(Number(e.target.value), 0, 1) - Date.UTC(anneeUTC(debut), 0, 1);
    changerPeriode(debut + ecart, fin + ecart);
  });
  $('periode-bandes').addEventListener('click', e => {
    const debut = Number(e.target.dataset.semaine);
    if (!debut) return;
    const { debut: d, fin: f } = fenetrePeriode();
    changerPeriode(debut, debut + (f - d));
  });
  const curseurPeriode = () => {
    const annee = Number($('periode-annee').value);
    let de = Number($('periode-curseur-de').value), a = Number($('periode-curseur-a').value);
    if (a <= de) {
      if (document.activeElement === $('periode-curseur-de')) de = a - 1; else a = de + 1;
    }
    changerPeriode(Date.UTC(annee, 0, 1) + Math.max(de, 0) * JOUR, Date.UTC(annee, 0, 1) + a * JOUR);
  };
  $('periode-curseur-de').addEventListener('input', curseurPeriode);
  $('periode-curseur-a').addEventListener('input', curseurPeriode);
  $('periode-de').addEventListener('change', e => {
    const de = jourDuChamp(e.target.value);
    if (de !== null) plusTard(() => changerPeriode(de, Math.max(fenetrePeriode().fin, de + JOUR)));
  });
  $('periode-a').addEventListener('change', e => {
    const a = jourDuChamp(e.target.value);
    if (a !== null) plusTard(() => changerPeriode(Math.min(fenetrePeriode().debut, a - JOUR), a));
  });
  $('periode-largeurs').addEventListener('click', e => {
    const largeur = e.target.dataset.largeur;
    if (!largeur) return;
    const { debut } = fenetrePeriode();
    if (largeur === 'mission') changerPeriode(etat.dateDebut, etat.dateDebut + etat.dureeJours * JOUR);
    else if (largeur === 'annee') changerPeriode(Date.UTC(anneeUTC(debut), 0, 1), Date.UTC(anneeUTC(debut) + 1, 0, 1));
    else changerPeriode(debut, debut + Number(largeur) * JOUR);
  });

  // Comparaison
  const critere = (id, cle) => $(id).addEventListener('input', e => { etat.criteres[cle] = Number(e.target.value); afficherComparaison(); });
  critere('crit-soleil-min', 'soleilMin');
  critere('crit-terre-min', 'terreMin');
  critere('crit-nuit-max', 'nuitMaxH');
  critere('crit-elev-min', 'elevationMin');
  $('report').addEventListener('input', e => { etat.report = Number(e.target.value); afficherComparaison(); });
  $('conclusion-bouton').addEventListener('click', e => {
    etat.siteDetail = e.currentTarget.dataset.id;
    etat.decalageDetail = etat.report;
    etat.heureDetail = 0;
    etat.depuisConclusion = true;
  });
}

demarrer();
