// Langue de l'interface : français (texte d'origine) ou anglais.
//
// Deux mécanismes :
//  - t('texte français {x}', { x }) pour les phrases construites dans le code ;
//  - une traduction automatique des textes fixes de la page (et des libellés exacts produits
//    par le code) : chaque texte ou attribut (placeholder, aria-label, title, alt) qui
//    correspond exactement à une clé du dictionnaire est remplacé, dans les deux sens.
// Pour ajouter un texte : l'écrire en français dans le code, puis ajouter sa traduction ici.

let langue = 'fr';
try {
  const memorisee = localStorage.getItem('langue');
  if (memorisee === 'fr' || memorisee === 'en') langue = memorisee;
} catch (erreur) { /* stockage indisponible : on reste en français */ }
const langueDemandee = new URLSearchParams(location.hash.split('?')[1] || '').get('lang');
if (langueDemandee === 'fr' || langueDemandee === 'en') langue = langueDemandee;

const localeDates = () => (langue === 'en' ? 'en-GB' : 'fr-FR');
const lettreJour = () => (langue === 'en' ? 'D' : 'J');   // J+3 / D+3, « 4 j 16 h » / « 4 d 16 h »

function formatNombre(valeur, decimales = null) {
  const texte = decimales === null ? String(valeur) : Number(valeur).toFixed(decimales);
  return langue === 'en' ? texte : texte.replace('.', ',');
}

// Noms des sites en anglais (les noms français viennent de data/sites.json).
const NOMS_SITES_EN = {
  malapert_massif: { court: 'Malapert', nom: 'Malapert Massif (Site23, Artemis III candidate region)',
    source: 'Centre of the LOLA Site23 tile (NASA PGDA, https://pgda.gsfc.nasa.gov/products/78); coordinates computed by calcul_horizon.py' },
  leibnitz_beta: { court: 'Leibnitz β', nom: 'Leibnitz Beta Plateau (Site20, Artemis III candidate region in 2022)',
    source: 'Centre of the LOLA Site20 tile (NASA PGDA, https://pgda.gsfc.nasa.gov/products/78); coordinates computed by calcul_horizon.py' },
  connecting_ridge: { court: 'Connecting Ridge', nom: 'Connecting Ridge (Site01, crest of the ridge between Shackleton and de Gerlache)',
    source: 'Highest point of the LOLA Site01 tile (NASA PGDA, https://pgda.gsfc.nasa.gov/products/78), 740 m from the tile centre; the centre, 15 m lower, is shadowed by the ridge (horizon up to 2.8°)' },
  im1_malapert_a: { court: 'IM-1 Odysseus', nom: 'IM-1 Odysseus (Malapert A)',
    source: 'Odysseus, 80.13°S 1.44°E (LROC, February 2024; to be confirmed); terrain: LDEM_60S_240MPP_ADJ (NASA PGDA, product 90), 240 m/px: nearby terrain coarsely resolved' },
  chandrayaan3: { court: 'Chandrayaan-3', nom: 'Chandrayaan-3 Vikram (Shiv Shakti point)',
    source: 'Shiv Shakti point, 69.373°S 32.319°E (ISRO / LROC); terrain: LDEM_60S_240MPP_ADJ (NASA PGDA, product 90), 240 m/px' },
};

const EN = {
  // ---------- En-tête, accueil, navigation ----------
  'Vues du mode Mission': 'Mission mode views',
  '1. Sites et dates': '1. Sites and dates',
  '2. Détail': '2. Detail',
  '3. Comparaison': '3. Comparison',
  '4. Calendrier': '4. Calendar',
  '5. Période': '5. Period',
  'Mode': 'Mode',
  'Découverte': 'Discovery',
  'Copier le lien du scénario': 'Copy scenario link',
  'Lien copié': 'Link copied',
  'Copiez ce lien :': 'Copy this link:',
  'Changer de langue': 'Change language',
  'Où poser une mission au pôle Sud de la Lune, et quand ?': 'Where should a mission land at the Moon’s south pole, and when?',
  'Pour chaque site et chaque date, deux questions : le Soleil est-il au-dessus du relief pour produire de l\'énergie, et la Terre est-elle visible pour communiquer ?':
    'For each site and each date, two questions: is the Sun above the terrain to produce power, and is the Earth visible to communicate?',
  'Horizon lunaire avec le Soleil rasant et la Terre': 'Lunar horizon with the grazing Sun and the Earth',
  'Mode Découverte': 'Discovery mode',
  'Comprendre pourquoi le pôle Sud est si difficile': 'Understand why the south pole is so hard',
  'Un parcours guidé en 4 étapes : le Soleil rasant, le relief qui le cache, la Terre qui apparaît et disparaît, puis le rejeu de la mission IM-1.':
    'A guided tour in 4 steps: the grazing Sun, the terrain that hides it, the Earth appearing and disappearing, then a replay of the IM-1 mission.',
  'Élèves, enseignants, grand public · environ 5 min': 'Students, teachers, general public · about 5 min',
  'Commencer le parcours': 'Start the tour',
  'Mode Mission': 'Mission mode',
  'Évaluer et comparer des sites d\'alunissage': 'Assess and compare landing sites',
  'Choisissez des sites et des dates, réglez vos seuils d\'énergie et de communication, et voyez ce que change un report de N jours.':
    'Pick sites and dates, set your power and communication thresholds, and see what an N-day delay changes.',
  'Planificateurs de mission': 'Mission planners',
  'Ouvrir le planificateur': 'Open the planner',

  // ---------- Découverte ----------
  'Étapes du parcours': 'Tour steps',
  'Valeurs d\'exemple': 'Sample values',
  '(valeurs d\'exemple)': '(sample values)',
  'Lecture': 'Play',
  'Pause': 'Pause',
  'Son coupé': 'Sound off',
  'Son activé': 'Sound on',
  'Le même jour, vu depuis Paris': 'The same day, seen from Paris',
  'Position du Soleil approchée': 'Approximate Sun position',
  'Course du Soleil sur une journée à Paris et au pôle Sud lunaire, à la même échelle': 'Path of the Sun over one day in Paris and at the lunar south pole, on the same scale',
  'À essayer': 'Try it',
  'Afficher le relief': 'Show the terrain',
  'Coucher prédit par l\'outil': 'Sunset predicted by the tool',
  'Dernier contact observé': 'Last contact observed',
  'Mise en veille observée': 'Observed shutdown',
  'Dernier contact': 'Last contact',
  'Mise en veille': 'Shutdown',
  'Précédent': 'Previous',
  'Étape suivante': 'Next step',
  'Passer en mode Mission': 'Switch to Mission mode',
  'Étape {n} sur {total}': 'Step {n} of {total}',
  'Le {date}, le Soleil monte à {max} au-dessus de Paris.': 'On {date}, the Sun climbs to {max} above Paris.',
  'Sur le site « {site} », il reste entre {min} et {max} toute la journée : sur cette échelle, sa courbe paraît plate.':
    'At the “{site}” site, it stays between {min} and {max} all day: on this scale, its curve looks flat.',
  'Le ciel vu depuis : {site}': 'The sky seen from: {site}',
  'Faites avancer le temps : jour {j} sur {total}': 'Move time forward: day {j} of {total}',
  'Position dans le rejeu : {date}': 'Position in the replay: {date}',
  'Trajectoire du Soleil sur un jour lunaire': 'Path of the Sun over a lunar day',
  'Trajectoire de la Terre sur un mois': 'Path of the Earth over a month',
  'Relief LOLA': 'LOLA terrain',
  'Hauteur du Soleil au-dessus du relief': 'Height of the Sun above the terrain',
  'pas de coucher sur la période': 'no sunset in the period',
  'IM-1 « Odysseus »': 'IM-1 “Odysseus”',
  'IM-1 « Odysseus » près de Malapert A': 'IM-1 “Odysseus” near Malapert A',
  'Chandrayaan-3 « Vikram » au point Shiv Shakti': 'Chandrayaan-3 “Vikram” at the Shiv Shakti point',
  'L\'atterrisseur Odysseus s\'est posé près de Malapert A le 22 février 2024. Il n\'était pas conçu pour survivre à la nuit lunaire.':
    'The Odysseus lander touched down near Malapert A on 22 February 2024. It was not designed to survive the lunar night.',
  'Le dernier contact date du 29 février 2024. Odysseus s\'était aussi couché sur le flanc à l\'arrivée, ce qui a réduit sa production d\'énergie : notre calcul prédit le coucher du Soleil, pas cet accident.':
    'Last contact was on 29 February 2024. Odysseus had also tipped onto its side on landing, which reduced its power: our calculation predicts the sunset, not that accident.',
  'Vikram s\'est posé le 23 août 2023, vers 69° S : plus loin du pôle qu\'IM-1, avec un Soleil plus haut.':
    'Vikram landed on 23 August 2023, near 69° S: farther from the pole than IM-1, with a higher Sun.',
  'Le rover Pragyan a été mis en veille le 2 septembre et l\'atterrisseur le 4, quand l\'énergie solaire diminuait. Deux missions, deux latitudes : de quoi tester l\'outil sur des cas réels.':
    'The Pragyan rover was put to sleep on 2 September and the lander on the 4th, as solar power was fading. Two missions, two latitudes: a way to test the tool on real cases.',
  'Le Soleil rasant': 'The grazing Sun',
  'Au pôle, le Soleil ne se lève pas : il fait le tour de l\'horizon': 'At the pole, the Sun does not rise: it circles the horizon',
  'L\'axe de la Lune n\'est incliné que d\'environ 1,5°. Vu du pôle Sud, le Soleil ne monte donc jamais haut : il glisse le long de l\'horizon et en fait le tour en un mois lunaire, environ 29,5 jours.':
    'The Moon’s axis is tilted by only about 1.5°. Seen from the south pole, the Sun therefore never climbs high: it slides along the horizon and goes around it in one lunar month, about 29.5 days.',
  'Les panneaux solaires reçoivent une lumière rasante, et la moindre bosse du terrain peut tout changer.':
    'Solar panels receive grazing light, and the slightest bump in the terrain can change everything.',
  'Faites avancer le temps et regardez la hauteur du Soleil : elle reste à quelques degrés autour de 0°.':
    'Move time forward and watch the Sun’s height: it stays within a few degrees of 0°.',
  'Le relief cache le Soleil': 'The terrain hides the Sun',
  'Un sommet suffit à éteindre les panneaux solaires': 'One peak is enough to switch off the solar panels',
  'Au pôle Sud, le Soleil ne monte jamais haut : il tourne autour de l\'horizon. Dès qu\'un bord de cratère se dresse dans sa direction, il disparaît, même en plein « jour ».':
    'At the south pole, the Sun never climbs high: it circles the horizon. As soon as a crater rim stands in its way, it disappears, even in the middle of the “day”.',
  'Sans atmosphère, la lumière ne contourne pas le relief : dès qu\'une crête passe devant le Soleil, l\'ombre tombe d\'un coup.':
    'With no atmosphere, light does not bend around the terrain: as soon as a ridge passes in front of the Sun, darkness falls at once.',
  'Bougez le curseur et repérez les moments où le Soleil passe derrière un sommet.': 'Move the slider and spot when the Sun passes behind a peak.',
  'La Terre apparaît et disparaît': 'The Earth appears and disappears',
  'La Terre aussi joue à cache-cache': 'The Earth plays hide-and-seek too',
  'Vue du pôle, la Terre reste près de l\'horizon. Au fil du mois, elle oscille de quelques degrés à cause de la libration de la Lune.':
    'Seen from the pole, the Earth stays near the horizon. Over the month, it wobbles by a few degrees because of the Moon’s libration.',
  'Quand elle passe sous le relief, la communication directe est coupée : il faut alors un satellite relais.':
    'When it drops below the terrain, direct communication is cut: a relay satellite is then needed.',
  'Faites avancer le temps et repérez quand la Terre passe sous le relief.': 'Move time forward and spot when the Earth drops below the terrain.',
  'Rejeu de missions réelles': 'Replay of real missions',
  'Une mission solaire vit le temps d\'un jour lunaire': 'A solar-powered mission lives for one lunar day',

  // ---------- Sites et dates ----------
  'Sites': 'Sites',
  'Rechercher un site': 'Search for a site',
  'Carte polaire · 80° S à 90° S': 'Polar map · 80° S to 90° S',
  'Carte du pôle Sud avec les sites': 'Map of the south pole with the sites',
  'Sélectionné': 'Selected',
  'Disponible': 'Available',
  'Cliquez un site pour le sélectionner': 'Click a site to select it',
  'Dates': 'Dates',
  'Date d\'alunissage :': 'Landing date:',
  '. Elle se change dans l\'onglet': '. You can change it in the tab',
  'Durée de la mission': 'Mission duration',
  '7 jours': '7 days',
  '10 jours': '10 days',
  '14 jours (≈ un jour lunaire)': '14 days (≈ one lunar day)',
  'Dates alternatives à tester': 'Alternative dates to test',
  'jours': 'days',
  'Nombre de jours de report': 'Number of days of delay',
  '+ Ajouter': '+ Add',
  'Comparer les scénarios': 'Compare scenarios',
  'Voir le détail d\'un site': 'See a site in detail',
  'Pôle Sud · CLPS et Artemis': 'South pole · CLPS and Artemis',
  'Autres régions (hors carte)': 'Other regions (off the map)',
  'Missions historiques (rejeu, dates passées)': 'Historical missions (replay, past dates)',
  'Mission passée : à voir dans le Détail ou le rejeu (Découverte, étape 4)': 'Past mission: see it in Detail or in the replay (Discovery, step 4)',
  'Voir': 'View',
  'Retirer +{n} jours': 'Remove +{n} days',
  '{n} site{ps} × {m} date{pm} = {total} scénarios': '{n} site{ps} × {m} date{pm} = {total} scenarios',
  '0° (face à la Terre)': '0° (facing Earth)',
  '{n} (mission passée, hors comparaison)': '{n} (past mission, not compared)',

  // ---------- Détail ----------
  'Site': 'Site',
  'Deux sites, la même mission': 'Two sites, the same mission',
  'Affichage du détail': 'Detail display',
  'Un site': 'One site',
  'Côte à côte': 'Side by side',
  'Date d\'alunissage': 'Landing date',
  'Élévation du Soleil': 'Sun elevation',
  'derrière le relief': 'behind the terrain',
  'Élévation de la Terre': 'Earth elevation',
  'Coucher du Soleil dans': 'Sunset in',
  'Lever du Soleil dans': 'Sunrise in',
  'Coucher de la Terre dans': 'Earthset in',
  'Lever de la Terre dans': 'Earthrise in',
  'pas de données à cette date': 'no data for this date',
  'disque partiellement caché': 'disc partly hidden',
  'au-dessus du relief': 'above the terrain',
  'sous le relief': 'below the terrain',
  'communication directe possible': 'direct communication possible',
  'pas de liaison directe': 'no direct link',
  'fin de la fenêtre radio': 'end of the radio window',
  'début de la fenêtre radio': 'start of the radio window',
  'Panorama d\'horizon à 360°': '360° horizon panorama',
  'Soleil (3 prochains jours en pointillés)': 'Sun (next 3 days dotted)',
  'Terre': 'Earth',
  'Soleil': 'Sun',
  'Panorama de l\'horizon avec le Soleil et la Terre': 'Horizon panorama with the Sun and the Earth',
  'Dôme du ciel en 3D': '3D sky dome',
  'Face au Soleil': 'Face the Sun',
  'Face à la Terre': 'Face the Earth',
  'Vue en trois dimensions : la couronne du relief autour du site, avec le Soleil, la Terre et leurs trajets pendant la mission. Flèches du clavier pour tourner.':
    'Three-dimensional view: the ring of terrain around the site, with the Sun, the Earth and their paths during the mission. Arrow keys to rotate.',
  'Le relief entoure le site comme une couronne ; les pointillés montrent le trajet du Soleil et de la Terre pendant la mission.':
    'The terrain surrounds the site like a ring; the dotted lines show the path of the Sun and the Earth during the mission.',
  'Faites glisser pour tourner. Hauteurs exagérées ×{x} pour rester lisibles.': 'Drag to rotate. Heights exaggerated ×{x} to stay readable.',
  'site': 'site',
  '{n} (caché)': '{n} (hidden)',
  'Frise de la mission ({n} jours)': 'Mission timeline ({n} days)',
  'Ensoleillement': 'Sunlight',
  'Terre visible': 'Earth visible',
  'Soleil visible': 'Sun visible',
  'Les deux': 'Both',
  'Plus longue nuit': 'Longest night',
  'Soleil, sol plat': 'Sun, flat ground',
  'Pas de données pour ces dates': 'No data for these dates',
  'Comparer avec un sol plat (sans relief)': 'Compare with flat ground (no terrain)',
  'ne change presque pas l\'ensoleillement': 'barely changes the sunlight',
  'retire {n} points d\'ensoleillement ({r} au lieu de {p})': 'removes {n} points of sunlight ({r} instead of {p})',
  'ajoute {n} points d\'ensoleillement ({r} au lieu de {p})': 'adds {n} points of sunlight ({r} instead of {p})',
  'et ne change pas la plus longue nuit.': 'and does not change the longest night.',
  'et allonge la plus longue nuit de {d}.': 'and lengthens the longest night by {d}.',
  'et raccourcit la plus longue nuit de {d}.': 'and shortens the longest night by {d}.',
  'Sur cette mission, le relief {a} {b}': 'On this mission, the terrain {a} {b}',
  'report de {n} j': '{n}-day delay',
  'mission de {n} jours': '{n}-day mission',
  'Instant affiché sur les panoramas : {j} ({date})': 'Time shown on the panoramas: {j} ({date})',
  'identique à {l}': 'same as {l}',
  '{n} points par rapport à {l}': '{n} points compared with {l}',
  'pas de données à cet instant': 'no data at this time',
  'coucher du Soleil dans {d}': 'sunset in {d}',
  'lever du Soleil dans {d}': 'sunrise in {d}',
  'coucher de la Terre dans {d}': 'Earthset in {d}',
  'lever de la Terre dans {d}': 'Earthrise in {d}',
  'Tous les critères sont remplis.': 'All criteria are met.',
  'Site {l} : {n}': 'Site {l}: {n}',
  'Site {l}': 'Site {l}',
  'Site A': 'Site A',
  'Site B': 'Site B',
  'Soleil au-dessus du relief': 'Sun above the terrain',
  'critère : au moins {x}': 'criterion: at least {x}',
  'Panorama de {site} avec le trajet du Soleil et de la Terre pendant la mission': 'Panorama of {site} with the path of the Sun and the Earth during the mission',
  'Dôme du ciel en 3D de {site} : couronne du relief, Soleil et Terre. Flèches du clavier pour tourner.': '3D sky dome of {site}: ring of terrain, Sun and Earth. Arrow keys to rotate.',
  '{texte}. Dôme 3D : faites glisser pour tourner.': '{texte}. 3D dome: drag to rotate.',
  'Compromis à cette date': 'Trade-offs on this date',
  'Critère': 'Criterion',
  'Seuil': 'Threshold',
  'Avantage': 'Advantage',
  'égalité': 'tie',
  'Énergie (Soleil visible)': 'Power (Sun visible)',
  'Communication (Terre visible)': 'Communication (Earth visible)',
  'Survie (plus longue nuit)': 'Survival (longest night)',
  'Marge du Soleil sur le relief': 'Sun margin above the terrain',
  'Soleil et Terre en même temps': 'Sun and Earth at the same time',
  '{n} est {statut}': '{n} is {statut}',
  '{g} l\'emporte sur {n} des 4 critères de la mission.': '{g} wins on {n} of the 4 mission criteria.',
  'Soleil masqué': 'Sun hidden',
  'horizon d\'une sphère lisse (0°)': 'horizon of a smooth sphere (0°)',
  '{m} au-dessus du relief': '{m} above the terrain',
  '{m} sous le relief': '{m} below the terrain',
  '{m} au-dessus de l\'horizon': '{m} above the horizon',
  '{m} sous l\'horizon': '{m} below the horizon',

  // ---------- Période ----------
  'Zoom sur une période': 'Zoom on a period',
  'Choisissez une fenêtre dans les données déjà calculées : rien n\'est recalculé, l\'affichage est instantané. Sites affichés : ceux cochés dans « Sites et dates ».':
    'Pick a window in the data already computed: nothing is recomputed, the display is instant. Sites shown: those ticked in “Sites and dates”.',
  'Année': 'Year',
  'Début de la période': 'Start of the period',
  'Fin de la période': 'End of the period',
  'janv.': 'Jan', 'mars': 'Mar', 'mai': 'May', 'juil.': 'Jul', 'sept.': 'Sep', 'nov.': 'Nov', 'déc.': 'Dec',
  'Du': 'From',
  'Au': 'To',
  'Largeurs rapides': 'Quick widths',
  'Mission': 'Mission',
  '20 jours': '20 days',
  'Mois lunaire (29,5 j)': 'Lunar month (29.5 d)',
  'Hauteur du Soleil au-dessus du relief sur la période': 'Height of the Sun above the terrain over the period',
  'Année {a} · Soleil visible par semaine': 'Year {a} · Sun visible per week',
  '{site}, semaine du {date} : {val}': '{site}, week of {date}: {val}',
  'pas de données': 'no data',
  'Soleil {p}': 'Sun {p}',
  'Mission ({n} j)': 'Mission ({n} d)',
  'Hauteur du Soleil au-dessus du relief · {d} → {f}': 'Height of the Sun above the terrain · {d} → {f}',
  'Mission prévue': 'Planned mission',
  'mission': 'mission',
  'relief': 'terrain',
  'Terre · {n}': 'Earth · {n}',
  'Sur ces {n} jours': 'Over these {n} days',
  'Soleil max au-dessus du relief': 'Max Sun above the terrain',
  'pas de données sur cette période': 'no data in this period',
  'exemple': 'sample',

  // ---------- Comparaison ----------
  'Critères de la mission': 'Mission criteria',
  'Ensoleillement minimal': 'Minimum sunlight',
  'Visibilité Terre minimale': 'Minimum Earth visibility',
  'Plus longue nuit tolérée': 'Longest night tolerated',
  'Élévation solaire minimale': 'Minimum solar elevation',
  'La nuit tolérée correspond à l\'autonomie des batteries. Chaque case se recalcule quand vous modifiez un critère.':
    'The tolerated night matches the battery autonomy. Each cell is recomputed when you change a criterion.',
  'Légende': 'Legend',
  'Viable': 'Viable',
  'Limite': 'Marginal',
  'Exclu': 'Excluded',
  'Sans données': 'No data',
  'tous les critères remplis': 'all criteria met',
  'au moins un critère manqué': 'at least one criterion missed',
  'nuit trop longue ou Terre jamais visible': 'night too long or Earth never visible',
  'Et si la mission glisse ?': 'What if the mission slips?',
  'Chiffre affiché : la plus longue nuit pendant la mission. Survolez une case pour le détail.': 'Number shown: the longest night during the mission. Hover over a cell for details.',
  'Report de la date d\'alunissage : <strong>+{n} jours</strong> ({date})': 'Landing date delay: <strong>+{n} days</strong> ({date})',
  'Soleil {s} · Terre {e} · nuit max {n}': 'Sun {s} · Earth {e} · max night {n}',
  'nuit {d}': 'night {d}',
  'nuit max {d}': 'max night {d}',
  'Aucun site n\'est viable à cette date.': 'No site is viable on this date.',
  '{s} est le seul site viable.': '{s} is the only viable site.',
  '{liste} et {dernier} restent viables.': '{liste} and {dernier} remain viable.',
  '{s} est exclu : {r}.': '{s} is excluded: {r}.',
  'Avec un report de {n} jours': 'With a {n}-day delay',
  'À la date prévue': 'On the planned date',
  'Ouvrir {s}': 'Open {s}',
  'pas de données pour cette date': 'no data for this date',
  'nuit de {d}, au-delà de l\'autonomie': 'night of {d}, beyond battery life',
  'Terre jamais visible': 'Earth never visible',
  'ensoleillement de {p}': 'sunlight of {p}',
  'Terre visible {p} du temps': 'Earth visible {p} of the time',
  'Soleil jamais à plus de {m} du relief': 'Sun never more than {m} above the terrain',
  'hors données': 'out of data',

  // ---------- Calendrier ----------
  'Calendrier de faisabilité': 'Feasibility calendar',
  'Une case = une date d\'alunissage. Cliquez une case pour ouvrir le détail. Les critères sont ceux de l\'écran Comparaison.':
    'One cell = one landing date. Click a cell to open the detail. The criteria are those of the Comparison screen.',
  'Chaque ligne montre, pour une date d\'alunissage entre le {d} et le {f}, si une mission de {n} jours serait viable.':
    'Each row shows, for a landing date between {d} and {f}, whether a {n}-day mission would be viable.',
  'Plus longue fenêtre de tir : {s}, du {d} au {f} ({n} jour{p} d\'affilée).': 'Longest launch window: {s}, from {d} to {f} ({n} day{p} in a row).',
  'Aucune date viable sur la période avec les critères actuels.': 'No viable date in the period with the current criteria.',
  'Alunissage {d}': 'Landing {d}',
  'Coucher prédit': 'Predicted sunset',
  'Soleil sous le relief': 'Sun below the terrain',
  'Fin de mission': 'End of mission',

  // ---------- Pied de page et période des données ----------
  'Période calculée : du {d} au {f}.': 'Computed period: {d} to {f}.',
  'Données : {n} sites calculés à partir d\'Horizons (JPL) et du relief LOLA.': 'Data: {n} sites computed from JPL Horizons and LOLA terrain.',
  'Données réelles : {n} site(s) sur {total}. Les autres affichent des valeurs d\'exemple en attendant les fichiers du dossier data/.':
    'Real data: {n} site(s) out of {total}. The others show sample values until the data/ files are available.',
  'Hors des données : choisissez une date entre le {d} et le {f}.': 'Outside the data: choose a date between {d} and {f}.',
  'Données calculées jusqu\'au {f} : les reports et le calendrier qui vont au-delà afficheront « Sans données ».':
    'Data computed until {f}: delays and calendar dates beyond it will show “No data”.',
  'Données calculées du {d} au {f}.': 'Data computed from {d} to {f}.',
  'Mission historique : données du {d} au {f}. Les autres onglets restent sur la date choisie pour les sites candidats.':
    'Historical mission: data from {d} to {f}. The other tabs keep the date chosen for the candidate sites.',
};

// Sens inverse (anglais -> français), pour revenir au français sans recharger la page.
const FR = Object.fromEntries(Object.entries(EN).filter(([, en]) => !en.includes('{')).map(([fr, en]) => [en, fr]));

function t(texte, valeurs = {}) {
  let resultat = langue === 'en' && EN[texte] !== undefined ? EN[texte] : texte;
  for (const [cle, valeur] of Object.entries(valeurs)) resultat = resultat.split(`{${cle}}`).join(String(valeur));
  return resultat;
}

// ---------- Traduction des textes fixes de la page ----------

const ATTRIBUTS_TRADUITS = ['placeholder', 'aria-label', 'title', 'alt'];

function traduireTexte(brut) {
  const cle = brut.trim();
  if (!cle) return null;
  const table = langue === 'en' ? EN : FR;
  const traduit = table[cle];
  if (traduit === undefined || traduit === cle || traduit.includes('{')) return null;
  return brut.replace(cle, traduit);
}

function traduireArbre(racine) {
  if (racine.nodeType === Node.TEXT_NODE) {
    const nouveau = traduireTexte(racine.nodeValue);
    if (nouveau !== null) racine.nodeValue = nouveau;
    return;
  }
  if (racine.nodeType !== Node.ELEMENT_NODE) return;
  const elements = [racine, ...racine.querySelectorAll('*')];
  for (const el of elements) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    for (const attr of ATTRIBUTS_TRADUITS) {
      const valeur = el.getAttribute(attr);
      if (valeur) {
        const nouveau = traduireTexte(valeur);
        if (nouveau !== null) el.setAttribute(attr, nouveau);
      }
    }
    for (const enfant of el.childNodes) {
      if (enfant.nodeType === Node.TEXT_NODE) {
        const nouveau = traduireTexte(enfant.nodeValue);
        if (nouveau !== null) enfant.nodeValue = nouveau;
      }
    }
  }
}

// Tout ce que le code ajoute ensuite à la page est traduit au passage, avant l'affichage.
const observateurLangue = new MutationObserver(mutations => {
  for (const m of mutations) {
    if (m.type === 'childList') m.addedNodes.forEach(traduireArbre);
    else if (m.type === 'characterData') traduireArbre(m.target);
    else if (m.type === 'attributes') {
      const nouveau = traduireTexte(m.target.getAttribute(m.attributeName) || '');
      if (nouveau !== null) m.target.setAttribute(m.attributeName, nouveau);
    }
  }
});

function demarrerTraduction() {
  document.documentElement.lang = langue;
  traduireArbre(document.body);
  observateurLangue.observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS_TRADUITS,
  });
}

// Change la langue, la mémorise, puis laisse l'application tout redessiner (rappel fourni par app.js).
function changerLangue(nouvelle, redessiner) {
  if (nouvelle === langue) return;
  langue = nouvelle;
  try { localStorage.setItem('langue', langue); } catch (erreur) { /* préférence non mémorisée */ }
  document.documentElement.lang = langue;
  traduireArbre(document.body);
  if (redessiner) redessiner();
}
