/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   data.js  —  Historical content, units, tactics, and the 100-level generator
   -------------------------------------------------------------------------
   Everything in this file is static game content. Historical battles, years,
   people and places are drawn from the classical sources (Herodotus, Xenophon,
   the Nabonidus Chronicle and the Cyrus Cylinder). Years are BCE.
   ========================================================================= */

/* -------------------------------------------------------------------------
   UNIT TYPES  (what both the player and the enemy can field)
   role is used by the rock-paper-scissors matchup engine:
     - "infantry" beats "cavalry"
     - "cavalry"  beats "archer"
     - "archer"   beats "infantry"
     - "camel"    terrifies "cavalry"
     - "chariot"  smashes "infantry" on open ground
     - "siege"    is needed to crack fortifications
   ------------------------------------------------------------------------- */
const UNITS = {
  spearmen: {
    key: "spearmen", name: "Sparabara Spearmen", role: "infantry", icon: "🛡️",
    atk: 5, def: 9, cost: 40, pop: "Persian levy spear-and-wicker-shield line infantry.",
    blurb: "The shield-wall backbone. Steady, cheap, and death to charging horse."
  },
  immortals: {
    key: "immortals", name: "The Immortals", role: "infantry", icon: "⚜️",
    atk: 10, def: 11, cost: 140, elite: true,
    pop: "The 10,000 — the king's own standing guard, every fallen man instantly replaced.",
    blurb: "Elite spear-and-bow guard. Excellent in every matchup, costly to raise."
  },
  archers: {
    key: "archers", name: "Persian Archers", role: "archer", icon: "🏹",
    atk: 9, def: 4, cost: 55,
    pop: "Massed foot archers loosing clouds of arrows before the lines meet.",
    blurb: "Shred enemy infantry at range. Fragile once the melee closes."
  },
  horsearchers: {
    key: "horsearchers", name: "Horse Archers", role: "archer", icon: "🐎",
    atk: 8, def: 6, cost: 90, mobile: true,
    pop: "Steppe-style riders who harass, flank, and feign retreat.",
    blurb: "Mobile skirmishers. Masters of the flank and the false rout."
  },
  cavalry: {
    key: "cavalry", name: "Noble Cavalry", role: "cavalry", icon: "🏇",
    atk: 12, def: 8, cost: 120,
    pop: "Median and Persian nobility on armoured horse — the shock arm.",
    blurb: "Shatters archers and loose formations. Impales itself on spears."
  },
  camels: {
    key: "camels", name: "Camel Corps", role: "camel", icon: "🐪",
    atk: 6, def: 7, cost: 100, locked: true,
    pop: "Cyrus's war-camels. Their scent and sight panic enemy horses.",
    blurb: "Horses will not stand against them. The great counter to heavy cavalry."
  },
  chariots: {
    key: "chariots", name: "Scythed Chariots", role: "chariot", icon: "🛞",
    atk: 13, def: 5, cost: 130, locked: true,
    pop: "Blade-wheeled chariots that carve bloody lanes through packed foot.",
    blurb: "Devastating against infantry on open plains. Useless in hills and sieges."
  },
  siege: {
    key: "siege", name: "Siege Engines", role: "siege", icon: "🏰",
    atk: 7, def: 3, cost: 110, locked: true,
    pop: "Rams, mantlets and towers for breaking a city's will and its walls.",
    blurb: "The only efficient answer to fortified walls."
  }
};

/* -------------------------------------------------------------------------
   BATTLE ORDERS  (the tactic you choose each round)
   Each order favours certain unit roles and counters certain enemy orders.
   ------------------------------------------------------------------------- */
const ORDERS = {
  spearwall: {
    key: "spearwall", name: "Spear Wall", icon: "🛡️",
    desc: "Lock shields and brace. Crushes cavalry charges, but archers punish a static line.",
    weights: { infantry: 1.7, camel: 1.2, archer: 0.7, cavalry: 0.7, chariot: 0.6, siege: 0.8 },
    defenseBonus: 0.30, moraleOnWin: 6
  },
  arrowstorm: {
    key: "arrowstorm", name: "Arrow Storm", icon: "🏹",
    desc: "Darken the sky. Tears apart infantry and breaks nerve — but charging horse closes the gap.",
    weights: { archer: 1.9, cavalry: 0.7, infantry: 0.7, camel: 0.7, chariot: 0.8, siege: 0.7 },
    moraleDamage: 10, moraleOnWin: 8
  },
  cavcharge: {
    key: "cavcharge", name: "Cavalry Charge", icon: "🏇",
    desc: "Shock the flanks. Rides down archers and loose troops; a spear wall will gut it.",
    weights: { cavalry: 1.9, chariot: 1.3, infantry: 0.6, archer: 0.6, camel: 0.5, siege: 0.6 },
    moraleDamage: 8, moraleOnWin: 7
  },
  flank: {
    key: "flank", name: "Flanking Maneuver", icon: "🔄",
    desc: "Sweep wide with riders. Heavy on morale, light on bodies; wrecks a dug-in enemy.",
    weights: { cavalry: 1.4, archer: 1.3, infantry: 0.8, camel: 0.9, chariot: 0.7, siege: 0.6 },
    moraleDamage: 16, moraleOnWin: 10
  },
  shieldadvance: {
    key: "shieldadvance", name: "Shield Advance", icon: "⚔️",
    desc: "A measured push on all fronts. No weakness, no edge — the dependable choice.",
    weights: { infantry: 1.1, immortalsBonus: 1.2, cavalry: 1.0, archer: 1.0, camel: 1.0, chariot: 1.0, siege: 1.0 },
    moraleOnWin: 5
  },
  feigned: {
    key: "feigned", name: "Feigned Retreat", icon: "🏃",
    desc: "The old steppe lie. Bait an aggressive foe into chaos, then wheel and strike.",
    weights: { cavalry: 1.3, archer: 1.2, infantry: 0.7, camel: 0.8, chariot: 0.6, siege: 0.5 },
    moraleDamage: 6, moraleOnWin: 6, bait: true
  },
  hold: {
    key: "hold", name: "Hold the Line", icon: "🧱",
    desc: "Give no ground, spill little blood, and let the men catch their breath.",
    weights: { infantry: 1.2, cavalry: 0.8, archer: 0.8, camel: 1.0, chariot: 0.7, siege: 0.9 },
    defenseBonus: 0.45, moraleRecover: 12, moraleOnWin: 3
  }
};

/* Order-vs-order tactical multiplier applied to YOUR round power.
   > 1 means your order beats theirs; < 1 means you are countered.        */
const ORDER_COUNTER = {
  spearwall:     { cavcharge: 1.45, flank: 1.1,  shieldadvance: 1.0,  arrowstorm: 0.7,  feigned: 1.05, hold: 1.0,  spearwall: 1.0 },
  arrowstorm:    { spearwall: 1.45, shieldadvance: 1.25, hold: 1.2, cavcharge: 0.65, flank: 0.95, feigned: 0.8, arrowstorm: 1.0 },
  cavcharge:     { arrowstorm: 1.5, flank: 1.3,  shieldadvance: 1.05, spearwall: 0.6, feigned: 0.65, hold: 1.1, cavcharge: 1.0 },
  flank:         { hold: 1.5, spearwall: 1.3, shieldadvance: 1.15, arrowstorm: 1.05, cavcharge: 0.7, feigned: 0.9, flank: 1.0 },
  shieldadvance: { feigned: 1.3, flank: 0.9, arrowstorm: 0.8, cavcharge: 0.95, spearwall: 1.0, hold: 1.1, shieldadvance: 1.0 },
  feigned:       { cavcharge: 1.55, shieldadvance: 1.3, spearwall: 0.95, flank: 1.1, arrowstorm: 0.7, hold: 0.8, feigned: 1.0 },
  hold:          { arrowstorm: 1.35, cavcharge: 1.1, shieldadvance: 0.9, flank: 0.6, spearwall: 1.0, feigned: 1.2, hold: 1.0 }
};

/* -------------------------------------------------------------------------
   SPECIAL ABILITIES  (limited-use battle gambits, some history-gated)
   ------------------------------------------------------------------------- */
const ABILITIES = {
  rally: {
    key: "rally", name: "Rally the Troops", icon: "📯", uses: 2, always: true,
    desc: "The king rides the line. +22 morale at once."
  },
  camel: {
    key: "camel", name: "Camel Gambit", icon: "🐪", uses: 1, needUnit: "camels",
    desc: "Unleash the camels. Enemy cavalry panics — massive casualties and a morale collapse."
  },
  scythe: {
    key: "scythe", name: "Scythed Charge", icon: "🛞", uses: 1, needUnit: "chariots",
    desc: "Loose the blade-wheels into packed infantry. A burst of carnage on open ground."
  },
  night: {
    key: "night", name: "Night Assault", icon: "🌙", uses: 1, flag: "night",
    desc: "Strike in darkness. The enemy loses this round's advantage and bleeds extra."
  },
  diversion: {
    key: "diversion", name: "Divert the River", icon: "🌊", uses: 1, flag: "river",
    desc: "Turn the Euphrates aside and wade the dry bed. Fortifications crumble."
  },
  bribe: {
    key: "bribe", name: "Bribe the Garrison", icon: "💰", uses: 1, flag: "bribe", gold: 180,
    desc: "Gold opens gates. Spend 180 to thin the enemy ranks before the assault."
  }
};

/* -------------------------------------------------------------------------
   TERRAIN  (per-level, modifies unit effectiveness)
   ------------------------------------------------------------------------- */
const TERRAIN = {
  plain:    { name: "Open Plain",    icon: "🌾", mult: { chariot: 1.35, cavalry: 1.2, camel: 1.1 } },
  hills:    { name: "Rolling Hills", icon: "⛰️", mult: { infantry: 1.2, cavalry: 0.8, chariot: 0.45 } },
  mountain: { name: "Mountain Pass", icon: "🏔️", mult: { infantry: 1.25, archer: 1.1, cavalry: 0.6, chariot: 0.3 } },
  river:    { name: "River Crossing",icon: "🌊", mult: { infantry: 1.1, cavalry: 0.85, chariot: 0.7 } },
  desert:   { name: "Arid Steppe",   icon: "🏜️", mult: { camel: 1.4, horsearchers: 1.2, cavalry: 1.05, siege: 0.8 } },
  city:     { name: "City Walls",    icon: "🏯", mult: { siege: 1.6, infantry: 1.0, cavalry: 0.55, chariot: 0.3 }, fort: true },
  forest:   { name: "Wooded Hills",  icon: "🌲", mult: { infantry: 1.15, archer: 1.1, cavalry: 0.7, chariot: 0.35 } }
};

/* -------------------------------------------------------------------------
   TITLES  (CK-style honours Cyrus accumulates; each grants a passive)
   ------------------------------------------------------------------------- */
const TITLES = [
  { atLevel: 1,  name: "Prince of Anshan",         perk: "Your birthright. The journey begins." },
  { atLevel: 11, name: "King of Persia",           perk: "+10% recruitment discount." },
  { atLevel: 23, name: "King of the Medes",        perk: "+1 Rally use in every battle." },
  { atLevel: 39, name: "Conqueror of Lydia",       perk: "Camel Corps unlocked for recruitment." },
  { atLevel: 53, name: "Lord of Ionia",            perk: "Siege Engines unlocked for recruitment." },
  { atLevel: 67, name: "Great King of the East",   perk: "Scythed Chariots unlocked; +8 starting morale." },
  { atLevel: 83, name: "King of Babylon",          perk: "+15% treasury from every victory." },
  { atLevel: 96, name: "King of the Four Corners", perk: "Shahanshah. All units fight with veteran resolve." }
];

/* -------------------------------------------------------------------------
   CODEX  (historical notes unlocked at milestone battles)
   ------------------------------------------------------------------------- */
const CODEX = {
  cyrus: { title: "Cyrus II of Anshan", text:
    "Born around 600 BCE in Anshan, Cyrus was the son of Cambyses I of the Persian house of Achaemenes and, by the Greek tradition, grandson of Astyages of Media. In a single generation he welded scattered Persian tribes into the largest empire the world had yet seen, from the Aegean to the Hindu Kush. The sources — Herodotus, Xenophon, the Babylonian chronicles — disagree on details but agree on the scale of the achievement." },
  astyages: { title: "Astyages & the Median Revolt", text:
    "Astyages was the last king of the Medes. Herodotus tells that he had dreamed his grandson would supplant him and tried to have the infant Cyrus killed — a plot foiled by the herdsman who raised the boy. When Cyrus raised Persia in revolt (c. 553 BCE), the Median noble Harpagus, long nursing a grudge against Astyages, defected with much of the army. Astyages was captured and the Median capital Ecbatana fell." },
  thymbra: { title: "The Camels of Thymbra", text:
    "At Thymbra near Sardis (546 BCE), Croesus of Lydia fielded the finest heavy cavalry in Asia. On the advice of Harpagus, Cyrus placed his baggage camels before his line. The Lydian horses — unused to the sight and smell of camels — panicked and bolted. The Lydian riders fought on foot and were broken. It is one of the earliest recorded uses of 'shock' animal psychology in war." },
  sardis: { title: "The Fall of Sardis & Croesus", text:
    "After Thymbra, Cyrus besieged Croesus in his 'impregnable' citadel of Sardis. A Persian soldier spotted a lightly guarded path up the cliff and the city fell in fourteen days. Croesus — the richest king of the age — was captured. In the kinder traditions, Cyrus spared him and kept him as a counsellor." },
  harpagus: { title: "Harpagus in Ionia", text:
    "Cyrus turned east to Babylon and left his general Harpagus to subdue the Greek cities of the Ionian coast — Phocaea, Miletus and the rest — along with Caria and Lycia. Harpagus pioneered the siege-mound, heaping earthworks against city walls. Some cities, like Phocaea, abandoned their homes and sailed west rather than submit." },
  opis: { title: "The Battle of Opis", text:
    "In 539 BCE, on the Tigris at Opis, Cyrus met the army of Nabonidus of Babylon. The Nabonidus Chronicle records a Persian victory and a massacre of the retreating Babylonians. The road to the greatest city on earth lay open." },
  babylon: { title: "The Fall of Babylon", text:
    "Herodotus says Cyrus diverted the Euphrates into a marsh and marched his men along the lowered riverbed under the walls, taking the city while it feasted. The Babylonian record is quieter — the city opened its gates and Cyrus entered 'in peace' in October 539 BCE, hailed as a liberator." },
  cylinder: { title: "The Cyrus Cylinder", text:
    "In Babylon, Cyrus issued the clay barrel-cylinder that bears his name: he restored temples, returned deported peoples and their gods to their homelands, and styled his rule as sanctioned by Marduk. The Hebrew Bible (Ezra, Isaiah) credits him with freeing the Judean exiles to return and rebuild Jerusalem. Often called an early charter of tolerant kingship." },
  tomyris: { title: "Tomyris and the Massagetae", text:
    "Cyrus's last campaign (c. 530 BCE) was against the Massagetae, a steppe people east of the Caspian ruled by Queen Tomyris. Herodotus relates that Cyrus took her son by a ruse; the prince killed himself in shame; and in the vengeful battle that followed Cyrus was slain. Tomyris is said to have dipped his head in a skin of blood, telling the conqueror to drink his fill at last. He was buried in his simple tomb at Pasargadae, which still stands." }
};

/* -------------------------------------------------------------------------
   DECISION EVENTS  (CK-style between-battle choices at the War Council)
   ------------------------------------------------------------------------- */
const DECISIONS = [
  { q: "A Median satrap offers tribute if you confirm him in his lands.",
    a: [ { t: "Accept his gold (+120 treasury)", gold: 120, renown: -2 },
          { t: "Demand hostages and loyalty (+6 morale next battle)", morale: 6, renown: 4 } ] },
  { q: "Your Magi read the entrails before the march.",
    a: [ { t: "Heed a cautious omen (+10 morale)", morale: 10 },
          { t: "Press on regardless (+5 renown)", renown: 5 } ] },
  { q: "Captured engineers beg to serve rather than die.",
    a: [ { t: "Take them into your pay (-80 gold, +5 morale)", gold: -80, morale: 5 },
          { t: "Make an example of them (+6 renown, -4 morale)", renown: 6, morale: -4 } ] },
  { q: "A caravan city will open its gates — for a price.",
    a: [ { t: "Pay the merchants (-100 gold, +140 later)", gold: -100, gold2: 140 },
          { t: "Storm it instead (+8 renown, -6 morale)", renown: 8, morale: -6 } ] },
  { q: "Your nobles squabble over the spoils of the last field.",
    a: [ { t: "Distribute fairly (+90 gold to all, +4 morale)", gold: 90, morale: 4 },
          { t: "Keep the lion's share (+180 gold, -5 morale)", gold: 180, morale: -5 } ] },
  { q: "A defeated people asks to keep their gods and customs.",
    a: [ { t: "Grant it — rule by tolerance (+8 renown, +6 morale)", renown: 8, morale: 6 },
          { t: "Impose Persian ways (+150 gold, -4 morale)", gold: 150, morale: -4 } ] },
  { q: "Steppe riders offer to scout for you.",
    a: [ { t: "Hire them (-70 gold, enemy revealed +morale 5)", gold: -70, morale: 5 },
          { t: "Trust your own outriders (+3 renown)", renown: 3 } ] }
];

/* =========================================================================
   THE 100-LEVEL CAMPAIGN
   8 chapters tracing Cyrus's real rise. Milestone levels carry the true
   historical battles and rich backstory; the levels between them are the
   skirmishes, sieges and marches that filled each campaign.
   ========================================================================= */

const CHAPTERS = [
  { id: 1, name: "The Rise in Persia",      range: [1, 10],  terrain: ["plain","hills","mountain"],
    enemy: "Rival Tribes",   mix: { spearmen: .5, archers: .3, cavalry: .2 },
    theme: "#8a5a2b" },
  { id: 2, name: "War with Media",          range: [11, 22], terrain: ["plain","hills","mountain","river"],
    enemy: "Median Host",    mix: { cavalry: .4, spearmen: .3, archers: .3 },
    theme: "#6d2f2f" },
  { id: 3, name: "The Lydian War",          range: [23, 38], terrain: ["plain","hills","city","river"],
    enemy: "Lydian Army",    mix: { cavalry: .5, spearmen: .25, archers: .25 },
    theme: "#9c7a1e" },
  { id: 4, name: "The Ionian Conquest",     range: [39, 52], terrain: ["city","hills","forest","plain"],
    enemy: "Greek Cities",   mix: { spearmen: .55, archers: .25, cavalry: .2 },
    theme: "#2f5d6d" },
  { id: 5, name: "The Eastern Satrapies",   range: [53, 66], terrain: ["desert","mountain","plain","hills"],
    enemy: "Eastern Peoples",mix: { horsearchers: .45, cavalry: .3, spearmen: .25 },
    theme: "#4a6d2f" },
  { id: 6, name: "The Fall of Babylon",     range: [67, 82], terrain: ["river","plain","city","city"],
    enemy: "Babylonian Army",mix: { spearmen: .4, chariots: .25, archers: .35 },
    theme: "#5a2f6d" },
  { id: 7, name: "Empire of the Four Corners", range: [83, 95], terrain: ["plain","hills","city","desert"],
    enemy: "Rebel Satraps",  mix: { cavalry: .35, spearmen: .35, archers: .3 },
    theme: "#2f4a6d" },
  { id: 8, name: "The Final Campaign",      range: [96, 100], terrain: ["desert","plain","desert","river","desert"],
    enemy: "The Massagetae", mix: { horsearchers: .55, cavalry: .35, spearmen: .1 },
    theme: "#3a3a4a" }
];

/* Milestone battles keyed by level number: real events with full backstory. */
const MILESTONES = {
  1: { title: "The Dream of Astyages", loc: "Anshan, Persis", year: 559,
    story: "They say the Median king Astyages dreamed that a vine grew from his daughter and overshadowed all Asia — and that the boy would be you. The herdsman who was ordered to expose you raised you instead. Now you are grown, and the Persian tribes look to the house of Achaemenes. Take up your grandfather Teispes' spear and make yourself worthy of the dream.",
    codex: "cyrus", boss: false },
  7: { title: "Uniting the Ten Tribes", loc: "Pasargadae", year: 553,
    story: "Ten tribes of Persia, three of them noble — the Pasargadae, the Maraphii, the Maspii. Herodotus says you summoned them, set them one day to clearing thornland and the next to a feast, and asked which life they chose. They chose you. Weld them into one host; the Medes will not wait forever.",
    boss: true },
  11: { title: "The Banner of Revolt", loc: "The Persian Border", year: 553,
    story: "You have refused the summons to Ecbatana. Astyages sends an army to drag Persia back to heel. On this field, subject becomes sovereign — or dies a rebel. Raise the standard.",
    codex: "astyages", boss: false },
  14: { title: "Battle of Hyrba", loc: "Hyrba", year: 552,
    story: "The first true clash of the Median war. Ctesias names the field Hyrba. Beat them here and the Persians will believe — truly believe — that Media can bleed.",
    boss: true },
  18: { title: "The Treason of Harpagus", loc: "Before Ecbatana", year: 550,
    story: "Astyages gives command to Harpagus — the very noble he once forced to eat his own son's flesh. On the field Harpagus turns his wing over to you. The Median army dissolves. Astyages arms the old men of the city and marches out himself. End it.",
    boss: true },
  22: { title: "The Fall of Ecbatana", loc: "Ecbatana", year: 550,
    story: "The seven-walled Median capital, each ring painted a different colour, the innermost plated in silver and gold. Astyages is taken alive. You do not kill him. You are King of the Medes and the Persians both — and the thrones of Asia have begun to topple toward you.",
    codex: "astyages", boss: true },
  23: { title: "Croesus Tests the Oracle", loc: "Cappadocia", year: 547,
    story: "Croesus of Lydia, richest king alive, asked Delphi whether to march on Persia. 'If you cross the Halys you will destroy a great empire,' it said. He never asked whose. He has crossed the Halys. The great empire will be his own — if you are quick.",
    boss: false },
  30: { title: "The Battle of Pteria", loc: "Pteria, by the Halys", year: 547,
    story: "The first meeting with Lydia ends in blood on both sides and no victor. Croesus, judging the season too late for war, withdraws to Sardis and disbands his levies, certain you will do the same. He does not know you. Drive the indecisive field into your favour.",
    boss: true },
  34: { title: "The Camels of Thymbra", loc: "Thymbra, before Sardis", year: 546,
    story: "You did not go home. You marched on Sardis through winter and caught Croesus with his levies dismissed. His remaining strength is the finest heavy cavalry in Asia. On Harpagus's counsel you draw your baggage camels to the front — for a horse cannot abide the sight and smell of a camel. Loose them, and watch the Lydian pride bolt.",
    codex: "thymbra", boss: true, forceAbility: "camel", terrain: "plain" },
  38: { title: "The Siege of Sardis", loc: "Sardis", year: 546,
    story: "Croesus shelters in a citadel men call unclimbable. But a soldier named Hyroeades watches a Lydian climb down a hidden path to fetch a dropped helmet — and climbs up the same way by night. Fourteen days, and the golden king is yours.",
    codex: "sardis", boss: true, terrain: "city" },
  39: { title: "Harpagus Turns West", loc: "The Ionian Coast", year: 545,
    story: "You ride east for bigger game and leave Harpagus to bring the Greek cities of the coast to heel. He will teach Asia the siege-mound — earthworks heaped against the walls until the stone has nowhere left to stand.",
    codex: "harpagus", boss: false },
  46: { title: "The Earthworks of Phocaea", loc: "Phocaea, Ionia", year: 545,
    story: "The Phocaeans would rather drown their city than kneel. Harpagus's mound rises against their wall. Many will take to their ships and sail for the far west rather than submit. Break the ones who stay.",
    boss: true },
  52: { title: "Caria and Lycia Subdued", loc: "Xanthos, Lycia", year: 544,
    story: "The Xanthians, seeing the end, burn their own acropolis with their women and children inside and die to the last man in a final sortie. Even in victory, some walls cost everything. The Aegean rim is Persian.",
    boss: true },
  53: { title: "Eyes to the Sunrise", loc: "Parthia & Hyrcania", year: 546,
    story: "Between the wars of the west you bind the vast east: Parthia, Hyrcania, Drangiana, Aria. The empire reaches toward the sunrise faster than any courier can carry the news.",
    boss: false },
  60: { title: "The Oxus and Bactria", loc: "Bactria", year: 545,
    story: "Bactria — land of a thousand cities, horse-rich and proud. Its lancers are among the best in the world. Bring it in, and the road to the Indus and the Jaxartes opens.",
    boss: true },
  66: { title: "The Jaxartes Frontier", loc: "Sogdiana, the Jaxartes", year: 544,
    story: "At the far river you found the garrison-town later called Cyropolis — Cyrus's own city — to hold the steppe frontier. The sunrise edge of the world is marked with your name. Now turn, at last, toward Babylon.",
    boss: true },
  67: { title: "The March on Babylon", loc: "The Diyala", year: 539,
    story: "Nabonidus has angered his own priests and absented himself for years at Teima; his son Belshazzar holds the city. The greatest prize of the age — the walls of Babylon, the Hanging Gardens, the wealth of the world — lies ahead. March down the Tigris.",
    boss: false },
  72: { title: "The Battle of Opis", loc: "Opis, on the Tigris", year: 539,
    story: "The Nabonidus Chronicle is blunt: at Opis the army of Akkad is beaten and the retreating host put to the sword. This is the hinge of the whole war. Win here and the city's nerve breaks before you ever see its walls.",
    codex: "opis", boss: true, terrain: "river" },
  78: { title: "Diverting the Euphrates", loc: "The Walls of Babylon", year: 539,
    story: "The walls are too high and too thick to storm, and the river runs through the heart of the city. So you will take the river from them: dig channels, turn the Euphrates into the old marsh of Queen Nitocris, and when the water sinks to the thigh, march your men up the drowned riverbed beneath the walls while Babylon feasts.",
    codex: "babylon", boss: true, terrain: "city", forceAbility: "diversion" },
  82: { title: "The Cyrus Cylinder", loc: "Babylon", year: 539,
    story: "You enter in peace, green boughs spread before you. You restore the temples, send the captive gods and peoples home — and free the exiles of Judah to return to Jerusalem and rebuild. On a clay barrel you write a new kind of kingship. But a last rebel garrison in the citadel must still be cleared.",
    codex: "cylinder", boss: true, terrain: "city" },
  83: { title: "Lord of the Four Corners", loc: "Babylon", year: 538,
    story: "'King of Babylon, King of Sumer and Akkad, King of the Four Corners of the World.' The titles pile upon you. But an empire won in a decade must be held, and already the far satrapies test the new hand on the reins.",
    boss: false },
  90: { title: "The Satraps' Revolt", loc: "The Zagros", year: 536,
    story: "A conqueror's hardest war is the one after the victory. Ambitious governors, unpaid garrisons, old kingdoms that remember being free. Ride the empire from end to end and remind it who built the Royal Road beneath its feet.",
    boss: true },
  95: { title: "Pasargadae Rises", loc: "Pasargadae", year: 535,
    story: "On the field where you broke Astyages you raise your capital — gardens quartered by watercourses, a palace, the tomb that will one day hold you. The empire is at peace from the Aegean to the Indus. Almost.",
    boss: true },
  96: { title: "The Massagetae Beckon", loc: "Beyond the Jaxartes", year: 530,
    story: "East of the Caspian ride the Massagetae, a steppe people who drink from the sun and bow to no throne. Their queen is Tomyris. You could leave them be. You will not. You build a bridge of boats across the river and cross into her land.",
    codex: "tomyris", boss: false, terrain: "river" },
  98: { title: "The Ruse of the Feast", loc: "The Steppe", year: 530,
    story: "On Croesus's advice you leave a camp of wine and weak men on the near bank. The Massagetae who fall on it gorge and sleep — and you fall on them and take Spargapises, the queen's son, alive. Tomyris sends word: give back my child and leave my land, or I will give you your fill of blood, insatiable as you are. Her son, shamed, takes his own life.",
    boss: true, terrain: "desert" },
  100:{ title: "The Fill of Blood", loc: "The Field of Tomyris", year: 530,
    story: "The last battle, and by Herodotus the most violent the barbarians ever fought. Arrows until the arrows are gone, then the spear, then the knife. This is the field where the conqueror of the world meets the one enemy he cannot outlast. Fight it — history already knows the cost. Lord of the Four Corners, meet your destiny.",
    codex: "tomyris", boss: true, terrain: "desert", final: true }
};

/* Flavour names for the non-milestone "filler" levels, picked by terrain. */
const SKIRMISH_NAMES = {
  plain:   ["Border Raid", "Clash on the Plain", "The Open Field", "Running Skirmish", "The Dusty Plain"],
  hills:   ["Fight for the Ridge", "Ambush in the Hills", "The High Ground", "Hillfort Assault"],
  mountain:["The Mountain Pass", "Defile Ambush", "The Narrow Road", "Highland Raid"],
  river:   ["Contested Ford", "The River Crossing", "Battle at the Ford", "Seizing the Bridge"],
  desert:  ["Steppe Pursuit", "The Waterless March", "Raiders at Dawn", "Chase Across the Sands"],
  city:    ["Siege of the Town", "Storming the Gate", "The Walled City", "Breaking the Walls"],
  forest:  ["Fight in the Woods", "The Wooded Slope", "Ambush Among the Trees"]
};

/* -------------------------------------------------------------------------
   LEVEL GENERATOR  — builds all 100 levels deterministically.
   ------------------------------------------------------------------------- */
function buildLevels() {
  const levels = [];
  for (let n = 1; n <= 100; n++) {
    const ch = CHAPTERS.find(c => n >= c.range[0] && n <= c.range[1]);
    const ms = MILESTONES[n];
    // Deterministic pseudo-random from level number (stable across reloads).
    const seed = Math.sin(n * 12.9898) * 43758.5453;
    const rnd = seed - Math.floor(seed);

    let terrainKey = ms && ms.terrain ? ms.terrain
                    : ch.terrain[Math.floor(rnd * ch.terrain.length)];

    // Enemy strength scales smoothly with the overall campaign, bosses harder.
    const base = 240 + n * 95;
    const enemyStrength = Math.round(base * (ms && ms.boss ? 1.45 : 1) * (0.9 + rnd * 0.3));
    const enemyMorale = 100 + (ms && ms.boss ? 25 : 0) + Math.floor(n / 2);

    // Fortification on city terrain / siege levels.
    const fort = TERRAIN[terrainKey].fort ? Math.round(120 + n * 6) : 0;

    // Build enemy composition from the chapter mix.
    const comp = {};
    const totalUnits = enemyStrength;
    for (const [u, frac] of Object.entries(ch.mix)) {
      comp[u] = Math.round(totalUnits * frac);
    }

    // Title & narrative.
    let title, loc, year, story, codex = null, forceAbility = null, isBoss = false, isFinal = false;
    if (ms) {
      title = ms.title; loc = ms.loc; year = ms.year; story = ms.story;
      codex = ms.codex || null; forceAbility = ms.forceAbility || null;
      isBoss = !!ms.boss; isFinal = !!ms.final;
    } else {
      const pool = SKIRMISH_NAMES[terrainKey] || SKIRMISH_NAMES.plain;
      title = pool[Math.floor(rnd * pool.length)];
      loc = ch.name; year = null;
      story = `A sharp action in the campaign of ${ch.name.toLowerCase()}. ${TERRAIN[terrainKey].name} favours the bold. The ${ch.enemy} bar your road — sweep them aside and press on.`;
    }

    // Abilities available this battle.
    const abilities = ["rally"];
    if (forceAbility) abilities.push(forceAbility);
    if (fort > 0) { abilities.push("bribe"); if (!abilities.includes("night")) abilities.push("night"); }
    // Unlock-aware extras are added at runtime based on the player's roster/titles.

    // Rewards.
    const gold = Math.round((70 + n * 14) * (isBoss ? 1.8 : 1));
    const renown = isBoss ? 10 : 4;

    levels.push({
      n, chapter: ch.id, chapterName: ch.name, chapterTheme: ch.theme,
      title, loc, year, story, terrain: terrainKey,
      enemyName: ch.enemy, enemyComp: comp, enemyStrength, enemyMorale, fort,
      codex, forceAbility, abilities, isBoss, isFinal,
      reward: { gold, renown }
    });
  }
  return levels;
}

const LEVELS = buildLevels();

/* -------------------------------------------------------------------------
   CHARACTERS  — the player hero and the named enemy commanders you fight.
   These appear as portraits in the briefing and as hero figures on the field.
   ------------------------------------------------------------------------- */
const HERO = { name: "Cyrus the Great", epithet: "The Shepherd King", avatar: "🦅", cry: "For Persia and the house of Achaemenes — forward!" };

const COMMANDERS = {
  // keyed by chapter id (fallback) with per-level overrides below
  1: { name: "The Tribal Chiefs",   avatar: "🪓", cry: "Persia bows to no upstart prince!" },
  2: { name: "Astyages of Media",   avatar: "👴", cry: "Drag the rebel back to Ecbatana in chains!" },
  3: { name: "Croesus of Lydia",    avatar: "🤴", cry: "My gold has bought the finest horse in Asia!" },
  4: { name: "The Ionian League",   avatar: "🏛️", cry: "Free Greeks will not kneel to a Persian!" },
  5: { name: "The Bactrian Lords",  avatar: "🐎", cry: "The eastern horse will ride you into the dust!" },
  6: { name: "Belshazzar of Babylon", avatar: "👑", cry: "The walls of Babylon have never fallen!" },
  7: { name: "The Rebel Satraps",   avatar: "⚔️", cry: "The empire is too vast for one king to hold!" },
  8: { name: "Queen Tomyris",       avatar: "👸", cry: "You thirst for blood, Cyrus — I will give you your fill!" }
};
const COMMANDER_OVERRIDE = {
  18: { name: "Astyages & Harpagus", avatar: "⚔️", cry: "Harpagus — hold the line! ...Harpagus?!" },
  34: { name: "Croesus of Lydia",    avatar: "🤴", cry: "Loose the heavy horse — ride them down!" },
  38: { name: "Croesus, besieged",   avatar: "🏯", cry: "These walls cannot be climbed!" },
  72: { name: "Nabonidus of Babylon",avatar: "👑", cry: "Hold them at the Tigris!" },
  78: { name: "Belshazzar at the Feast", avatar: "🍷", cry: "Let them batter the walls — we feast tonight!" },
  100:{ name: "Queen Tomyris",       avatar: "👸", cry: "For my son. Drink your fill of blood at last." }
};
function getCommander(n) {
  const lvl = LEVELS[n - 1];
  return COMMANDER_OVERRIDE[n] || COMMANDERS[lvl.chapter] || COMMANDERS[1];
}

/* expose to the rest of the game */
window.GAMEDATA = { UNITS, ORDERS, ORDER_COUNTER, ABILITIES, TERRAIN, TITLES, CODEX, DECISIONS, CHAPTERS, LEVELS, HERO, COMMANDERS, getCommander };
