/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   engine.js  —  Game state, persistence, recruitment, and the battle resolver
   ========================================================================= */

const D = window.GAMEDATA;
const SAVE_KEY = "cyrus_four_corners_save_v1";

/* -------------------------------------------------------------------------
   PERSISTENT GAME STATE
   ------------------------------------------------------------------------- */
const Game = {
  state: null,

  newGame() {
    this.state = {
      level: 1,                 // next level to play (1..100)
      cleared: 0,               // highest level completed
      gold: 260,
      renown: 0,
      // Starting roster — a small Persian host.
      roster: {
        spearmen:   { count: 320, vet: 0 },
        archers:    { count: 180, vet: 0 },
        cavalry:    { count: 90,  vet: 0 }
      },
      unlocked: {},             // unit keys unlocked for recruitment
      codex: {},                // unlocked codex entries
      titleIndex: 0,
      morale: 100,
      stats: { battlesWon: 0, troopsLost: 0, enemiesRouted: 0 }
    };
    this.applyTitles();
    this.save();
    return this.state;
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { this.state = JSON.parse(raw); return true; }
    } catch (e) { /* ignore corrupt/blocked storage */ }
    return false;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); }
    catch (e) { /* storage may be unavailable; game still works in-memory */ }
  },

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    return this.newGame();
  },

  /* ---- titles & unlocks ---- */
  currentTitle() {
    let t = D.TITLES[0];
    for (const title of D.TITLES) if (this.state.cleared + 1 >= title.atLevel) t = title;
    return t;
  },

  applyTitles() {
    const lvl = this.state.cleared + 1;
    // Unit unlocks tied to historical progression.
    if (lvl >= 34) this.state.unlocked.camels = true;    // after Thymbra approaches
    if (lvl >= 39) this.state.unlocked.camels = true;    // Conqueror of Lydia
    if (lvl >= 53) this.state.unlocked.siege = true;     // Lord of Ionia
    if (lvl >= 67) this.state.unlocked.chariots = true;  // Great King of the East
    // Immortals become recruitable once you are a king.
    if (lvl >= 11) this.state.unlocked.immortals = true;
  },

  /* ---- economy ---- */
  recruitCost(unitKey) {
    const base = D.UNITS[unitKey].cost;
    const title = this.currentTitle();
    const discount = title.perk.includes("discount") ? 0.9 : 1;
    return Math.round(base * discount);
  },

  // Buy a block of `size` troops of a unit type.
  recruit(unitKey, size) {
    const cost = this.recruitCost(unitKey) * (size / 10);
    const total = Math.round(cost);
    if (this.state.gold < total) return { ok: false, msg: "Not enough treasury." };
    this.state.gold -= total;
    if (!this.state.roster[unitKey]) this.state.roster[unitKey] = { count: 0, vet: 0 };
    this.state.roster[unitKey].count += size;
    this.save();
    return { ok: true, msg: `Raised ${size} ${D.UNITS[unitKey].name}.` };
  },

  totalTroops() {
    return Object.values(this.state.roster).reduce((s, u) => s + u.count, 0);
  },

  /* ---- advancing ---- */
  winLevel(levelObj, survivors, result) {
    const s = this.state;
    s.roster = survivors;                       // apply battle losses
    let gold = levelObj.reward.gold;
    const title = this.currentTitle();
    if (title.perk.includes("treasury")) gold = Math.round(gold * 1.15);
    s.gold += gold;
    s.renown += levelObj.reward.renown;
    if (levelObj.n > s.cleared) s.cleared = levelObj.n;
    s.level = Math.min(100, s.cleared + 1);
    s.stats.battlesWon++;
    s.stats.enemiesRouted++;
    if (levelObj.codex) s.codex[levelObj.codex] = true;
    // Veterancy: survivors gain experience.
    for (const u of Object.values(s.roster)) u.vet = Math.min(3, u.vet + (result.flawless ? 2 : 1) * 0.34);
    this.applyTitles();
    this.save();
    return gold;
  },

  loseLevel(survivors) {
    // Defeat is not permadeath — you keep partial survivors and may retry.
    this.state.roster = survivors;
    // Guarantee the player is never softlocked with an empty army.
    if (this.totalTroops() < 120) {
      this.state.roster.spearmen = this.state.roster.spearmen || { count: 0, vet: 0 };
      this.state.roster.spearmen.count += 140;
      this.state.gold += 120;
    }
    this.save();
  }
};

/* =========================================================================
   BATTLE ENGINE
   A turn-based, order-driven tactical resolver. Each round the player and the
   AI each commit an Order; power is computed from unit roles, terrain, enemy
   composition and the order-vs-order matchup; casualties and morale follow.
   ========================================================================= */

const Battle = {
  active: null,

  begin(levelObj) {
    const s = Game.state;
    // Snapshot the player's committed army for this battle.
    const player = {};
    for (const [k, u] of Object.entries(s.roster)) {
      if (u.count > 0) player[k] = { count: u.count, vet: u.vet };
    }
    // Build enemy divisions.
    const enemy = {};
    for (const [k, c] of Object.entries(levelObj.enemyComp)) {
      if (c > 0) enemy[k] = { count: c, vet: Math.min(2, Math.floor(levelObj.n / 40)) };
    }

    // Abilities available: base set + roster/flag driven.
    const abilityPool = {};
    const addAb = (key) => {
      const def = D.ABILITIES[key];
      if (!def) return;
      if (def.needUnit && !player[def.needUnit]) return;
      abilityPool[key] = { ...def, left: def.uses };
    };
    addAb("rally");
    // Title: extra rally for King of the Medes+.
    if (Game.currentTitle().perk.includes("Rally")) abilityPool.rally && (abilityPool.rally.left += 1);
    if (player.camels) addAb("camel");
    if (player.chariots) addAb("scythe");
    for (const a of levelObj.abilities) addAb(a);
    if (levelObj.forceAbility) addAb(levelObj.forceAbility);

    const startMorale = 100 + (Game.currentTitle().perk.includes("starting morale") ? 8 : 0);

    this.active = {
      level: levelObj,
      terrain: levelObj.terrain,
      player, enemy,
      pMorale: startMorale, eMorale: levelObj.enemyMorale,
      pStart: this._strength(player), eStart: this._strength(enemy),
      fort: levelObj.fort,
      abilities: abilityPool,
      round: 0,
      lastEnemyOrder: null,
      baitActive: false,
      log: [],
      over: false, won: false,
      pendingAbility: null
    };
    this.active.log.push({ t: "sys", m: `⚔️ ${levelObj.title} — ${D.TERRAIN[levelObj.terrain].name}${levelObj.fort ? " · Fortified" : ""}` });
    return this.active;
  },

  _strength(army) {
    return Object.values(army).reduce((s, u) => s + u.count, 0);
  },

  // Fraction of an army that is a given role.
  _roleFraction(army, role) {
    const tot = this._strength(army);
    if (!tot) return 0;
    let r = 0;
    for (const [k, u] of Object.entries(army)) if (D.UNITS[k].role === role) r += u.count;
    return r / tot;
  },

  /* Compute one side's offensive power for the round. */
  _power(army, order, enemyArmy, terrain, extra = {}) {
    const O = D.ORDERS[order];
    const terr = D.TERRAIN[terrain].mult;
    const enemyCav = this._roleFraction(enemyArmy, "cavalry");
    const enemyInf = this._roleFraction(enemyArmy, "infantry");
    const enemyArc = this._roleFraction(enemyArmy, "archer");

    let power = 0;
    for (const [k, u] of Object.entries(army)) {
      if (u.count <= 0) continue;
      const def = D.UNITS[k];
      let w = O.weights[def.role] != null ? O.weights[def.role] : 1;
      if (def.key === "immortals" && O.weights.immortalsBonus) w *= O.weights.immortalsBonus;

      // Terrain multiplier (by role and by unit key).
      let tmul = 1;
      if (terr[def.role]) tmul *= terr[def.role];
      if (terr[def.key]) tmul *= terr[def.key];

      // Rock-paper-scissors matchup bonus vs the enemy composition.
      let matchup = 1;
      if (def.role === "infantry") matchup += enemyCav * 0.8;
      if (def.role === "cavalry")  matchup += enemyArc * 0.9;
      if (def.role === "archer")   matchup += enemyInf * 0.7;
      if (def.role === "camel")    matchup += enemyCav * 1.3;       // camels terrify horse
      if (def.role === "chariot")  matchup += enemyInf * 0.9 * (terrain === "plain" || terrain === "desert" ? 1 : 0.3);
      if (def.role === "siege")    matchup += (extra.fort ? 0.6 : 0);

      const vet = 1 + (u.vet || 0) * 0.12;
      const atk = def.atk;
      power += u.count * w * tmul * matchup * vet * (atk / 7);
    }

    // Veteran-resolve title bonus.
    if (Game.currentTitle().perk.includes("veteran resolve")) power *= 1.08;
    return power;
  },

  // AI picks an order: weighted toward countering the player's army & last order.
  _enemyChooseOrder() {
    const a = this.active;
    const pCav = this._roleFraction(a.player, "cavalry");
    const pInf = this._roleFraction(a.player, "infantry");
    const pArc = this._roleFraction(a.player, "archer");
    const weights = {
      spearwall: 1 + pCav * 3,
      arrowstorm: 1 + pInf * 3,
      cavcharge: 1 + pArc * 3,
      flank: 1.2,
      shieldadvance: 1.1,
      feigned: 0.6,
      hold: a.eMorale < 55 ? 2.2 : 0.5
    };
    // Scale aggression with difficulty.
    const diff = Math.min(1, a.level.n / 100);
    weights.flank += diff; weights.cavcharge += diff * 0.5;
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [k, w] of entries) { roll -= w; if (roll <= 0) return k; }
    return "shieldadvance";
  },

  // Queue a special ability to fire on the next resolve().
  useAbility(key) {
    const a = this.active;
    const ab = a.abilities[key];
    if (!ab || ab.left <= 0 || a.over) return { ok: false };
    if (ab.gold && Game.state.gold < ab.gold) return { ok: false, msg: "Not enough treasury." };
    a.pendingAbility = key;
    return { ok: true, name: ab.name };
  },

  /* Resolve one full round given the player's chosen order. */
  resolve(playerOrder) {
    const a = this.active;
    if (a.over) return a;
    a.round++;

    const enemyOrder = this._enemyChooseOrder();
    let pPow = this._power(a.player, playerOrder, a.enemy, a.terrain, { fort: 0 });
    let ePow = this._power(a.enemy, enemyOrder, a.player, a.terrain, { fort: a.fort });

    // Order-vs-order tactical multiplier (mind game on top of unit matchups).
    const pMult = (D.ORDER_COUNTER[playerOrder] && D.ORDER_COUNTER[playerOrder][enemyOrder]) || 1;
    const eMult = (D.ORDER_COUNTER[enemyOrder] && D.ORDER_COUNTER[enemyOrder][playerOrder]) || 1;
    pPow *= pMult; ePow *= eMult;

    // Feigned-retreat bait: if the enemy came in aggressive, punish next.
    if (a.baitActive) { pPow *= 1.35; a.baitActive = false; a.log.push({ t: "good", m: "Your feigned retreat springs the trap!" }); }
    if (D.ORDERS[playerOrder].bait && (enemyOrder === "cavcharge" || enemyOrder === "shieldadvance")) a.baitActive = true;

    // Fortification protects the defender (enemy) unless cracked.
    let fortGuard = a.fort > 0 ? 1 + a.fort / 400 : 1;

    // --- Special abilities fire here ---
    const log = a.log;
    let abilityNote = null, extraEnemyCas = 0, enemyMoraleHit = 0, skipEnemyEdge = false;
    if (a.pendingAbility) {
      const key = a.pendingAbility; const ab = a.abilities[key]; ab.left--;
      a.pendingAbility = null;
      abilityNote = ab.name;
      if (key === "rally") { a.pMorale = Math.min(140, a.pMorale + 22); }
      if (key === "camel") {
        const cav = this._roleFraction(a.enemy, "cavalry");
        extraEnemyCas += Math.round(this._strength(a.enemy) * (0.18 + cav * 0.5));
        enemyMoraleHit += 30; pPow *= 1.2;
        log.push({ t: "good", m: "🐪 The camels surge forward — the enemy horse rears and bolts in terror!" });
      }
      if (key === "scythe") {
        const inf = this._roleFraction(a.enemy, "infantry");
        extraEnemyCas += Math.round(this._strength(a.enemy) * (0.12 + inf * 0.4));
        enemyMoraleHit += 16;
        log.push({ t: "good", m: "🛞 Scythed wheels carve bloody lanes through their foot!" });
      }
      if (key === "night") { skipEnemyEdge = true; extraEnemyCas += Math.round(this._strength(a.enemy) * 0.1); enemyMoraleHit += 14;
        log.push({ t: "good", m: "🌙 Your night assault catches them unready." }); }
      if (key === "diversion") { a.fort = Math.round(a.fort * 0.25); fortGuard = 1; enemyMoraleHit += 20;
        extraEnemyCas += Math.round(this._strength(a.enemy) * 0.12);
        log.push({ t: "good", m: "🌊 The river sinks to the thigh — your men wade the dry bed beneath the walls!" }); }
      if (key === "bribe") { Game.state.gold -= ab.gold; Game.save();
        extraEnemyCas += Math.round(this._strength(a.enemy) * 0.14); enemyMoraleHit += 12;
        log.push({ t: "good", m: "💰 Bribed sentries throw open a postern gate." }); }
    }
    if (skipEnemyEdge) ePow *= 0.7;
    ePow *= fortGuard;

    // --- Casualties ---
    const pStr = this._strength(a.player), eStr = this._strength(a.enemy);
    const ratio = pPow / (pPow + ePow || 1);           // share of the round you won
    const CAS = 0.14;                                  // base casualty rate
    const jitter = () => 0.85 + Math.random() * 0.3;

    let eCas = Math.round(eStr * CAS * ratio * jitter() * 2) + extraEnemyCas;
    let pCas = Math.round(pStr * CAS * (1 - ratio) * jitter() * 2);

    // Defensive orders cut incoming losses.
    const pOdef = D.ORDERS[playerOrder].defenseBonus || 0;
    const eOdef = D.ORDERS[enemyOrder].defenseBonus || 0;
    pCas = Math.round(pCas * (1 - pOdef));
    eCas = Math.round(eCas * (1 - eOdef) + extraEnemyCas * eOdef); // ability casualties partly ignore fort/defence

    this._applyCasualties(a.player, pCas, a.enemy);    // enemy comp informs which of your units die
    this._applyCasualties(a.enemy, eCas, a.player);

    // --- Morale ---
    const swing = 18;
    const pO = D.ORDERS[playerOrder], eO = D.ORDERS[enemyOrder];
    let pM = (ratio - 0.5) * swing;
    let eM = (0.5 - ratio) * swing;
    if (ratio > 0.5) pM += pO.moraleOnWin || 0; else eM += eO.moraleOnWin || 0;
    eM -= (pO.moraleDamage || 0) * ratio;              // flanking / arrows break nerve
    pM -= (eO.moraleDamage || 0) * (1 - ratio);
    if (pO.moraleRecover) pM += pO.moraleRecover;
    if (eO.moraleRecover) eM += eO.moraleRecover;
    eM -= enemyMoraleHit;

    a.pMorale = Math.max(0, Math.min(150, a.pMorale + pM));
    a.eMorale = Math.max(0, Math.min(150, a.eMorale + eM));

    // --- Log the round ---
    log.push({ t: ratio >= 0.5 ? "good" : "bad",
      m: `R${a.round}: You ordered <b>${pO.name}</b> vs their <b>${eO.name}</b>. ` +
         `You felled ~${eCas}, lost ~${pCas}.` + (abilityNote ? ` [${abilityNote}]` : "") });

    a.lastEnemyOrder = enemyOrder;

    // --- Check end conditions ---
    const eLeft = this._strength(a.enemy), pLeft = this._strength(a.player);
    const eRout = a.eMorale <= 0 || eLeft <= a.eStart * 0.12;
    const pRout = a.pMorale <= 0 || pLeft <= 1;
    if (eRout && !pRout) { a.over = true; a.won = true; log.push({ t: "sys", m: "🏆 The enemy breaks and runs. The field is yours!" }); }
    else if (pRout) { a.over = true; a.won = false; log.push({ t: "sys", m: "💀 Your line shatters. Sound the retreat." }); }
    return a;
  },

  // Distribute `cas` casualties across an army, hitting units countered by the
  // foe harder, so composition choices matter.
  _applyCasualties(army, cas, foe) {
    if (cas <= 0) return;
    const foeCav = this._roleFraction(foe, "cavalry");
    const foeInf = this._roleFraction(foe, "infantry");
    const foeArc = this._roleFraction(foe, "archer");
    // Vulnerability weight per unit.
    const vuln = {};
    let totalV = 0;
    for (const [k, u] of Object.entries(army)) {
      if (u.count <= 0) continue;
      const role = D.UNITS[k].role;
      let v = 1;
      if (role === "archer")   v += foeCav * 1.2;   // archers die to cavalry
      if (role === "infantry") v += foeArc * 0.9;   // infantry die to arrows
      if (role === "cavalry")  v += foeInf * 1.0;   // cavalry die to spears
      v *= u.count;                                 // bigger stacks absorb more
      vuln[k] = v; totalV += v;
    }
    if (totalV <= 0) return;
    for (const [k, v] of Object.entries(vuln)) {
      const share = Math.round(cas * (v / totalV));
      army[k].count = Math.max(0, army[k].count - share);
    }
  },

  // Package the surviving player army back into roster shape.
  survivors() {
    const out = {};
    for (const [k, u] of Object.entries(this.active.player)) {
      out[k] = { count: u.count, vet: u.vet || 0 };
    }
    // Carry over any units that were at 0 before the battle too.
    for (const [k, u] of Object.entries(Game.state.roster)) {
      if (!out[k]) out[k] = { count: u.count, vet: u.vet };
    }
    return out;
  },

  result() {
    const a = this.active;
    const lost = a.pStart - this._strength(a.player);
    const flawless = lost < a.pStart * 0.15;
    Game.state.stats.troopsLost += Math.max(0, lost);
    return { won: a.won, lost, flawless };
  }
};

window.Game = Game;
window.Battle = Battle;
