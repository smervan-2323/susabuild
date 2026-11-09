/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   battlefield.js  —  Live, animated, real-time battle on an HTML canvas.
   Little warrior characters advance, charge, loose arrows, clash and fall.
   Your orders change what they do, live. Outcome drives the campaign.
   ========================================================================= */

const Field = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  raf: 0, lastTs: 0, time: 0,
  units: [], projectiles: [], fx: [],
  active: null,
  onEnd: null,

  /* ---------- lifecycle ---------- */
  start(levelObj, battle, onEnd) {
    this.onEnd = onEnd;
    this.canvas = document.getElementById("field");
    this.ctx = this.canvas.getContext("2d");
    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener("resize", this._resizeHandler);

    this.units = []; this.projectiles = []; this.fx = []; this.time = 0;

    const terr = levelObj.terrain;
    this.active = {
      level: levelObj, terrain: terr, fort: battle.fort || 0,
      pMorale: 100 + (battle.bonusMorale || 0), eMorale: 100,
      stance: "advance", stanceTimer: 0,
      startCount: { p: {}, e: {} }, figTotal: { p: {}, e: {} },
      ended: false, won: false, paused: false,
      flash: null, flashT: 0,
      commander: D.getCommander(levelObj.n),
      timeScale: 1, slowT: 0,
      cam: { zoom: 1, cx: this.W / 2, cy: this.H / 2, tz: 1, tcx: this.W / 2, tcy: this.H / 2, shakeT: 0 },
      sfx: { clash: 0, arrow: 0, dust: 0 }
    };

    // Spawn figures from the committed armies.
    this._spawnSide("p", battle.player, true);
    this._spawnSide("e", battle.enemy, false);

    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(t => this._loop(t));
    this._announce("⚔️ " + levelObj.title, 1.6);
    if (window.SFX) { SFX.resume(); setTimeout(() => SFX.horn(), 120); }
  },

  stop() {
    cancelAnimationFrame(this.raf);
    if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
  },

  _resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = rect.width; this.H = rect.height;
    c.width = Math.round(this.W * this.dpr);
    c.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  /* ---------- spawning ---------- */
  _spawnSide(side, army, isPlayer) {
    const MAX = 44;                      // max figures per side
    const total = Object.values(army).reduce((s, u) => s + u.count, 0) || 1;
    const entries = Object.entries(army).filter(([, u]) => u.count > 0);

    // figure budget per type (proportional, at least 1).
    let budget = {};
    let used = 0;
    for (const [k, u] of entries) {
      let n = Math.max(1, Math.round((u.count / total) * MAX));
      budget[k] = n; used += n;
      this.active.startCount[side][k] = u.count;
    }
    // trim if over budget
    while (used > MAX) {
      const big = Object.entries(budget).sort((a, b) => b[1] - a[1])[0];
      if (big[1] <= 1) break; budget[big[0]]--; used--;
    }

    const colBase = isPlayer ? 0.16 : 0.86;   // player left, enemy right (x fraction)
    let heroPlaced = false;
    for (const [k, u] of entries) {
      const def = D.UNITS[k];
      const n = budget[k];
      this.active.figTotal[side][k] = n;
      const rep = u.count / n;
      for (let i = 0; i < n; i++) {
        const laneRows = Math.ceil(n / 4);
        const row = i % laneRows, col = Math.floor(i / laneRows);
        const archerish = def.role === "archer";
        const cavish = def.role === "cavalry" || def.role === "camel" || def.role === "chariot";
        // x by role: archers hang back, cavalry slightly forward on wings.
        let bx = colBase;
        if (archerish) bx += isPlayer ? -0.07 : 0.07;
        if (cavish)    bx += isPlayer ? 0.03 : -0.03;
        const x = this.W * (bx + (isPlayer ? -1 : 1) * col * 0.028);
        const y = this.H * (0.34 + row * (0.42 / Math.max(1, laneRows)) + (Math.random() * 0.03));
        const vet = 1 + (u.vet || 0) * 0.12;
        const hp = (26 + def.def * 3.2) * vet * (def.elite ? 1.5 : 1);
        this.units.push({
          side, type: k, role: def.role, icon: def.icon,
          x, y, hx: x, hy: y, home: { x, y },
          hp, maxHp: hp, dmg: def.atk * 1.15 * vet,
          speed: (cavish ? 62 : archerish ? 30 : 40) * (def.role === "chariot" ? 1.15 : 1),
          state: "adv", target: null, atkCd: 0, shootCd: Math.random() * 1.2,
          rep, hero: false, charged: false, spook: 0, flinch: 0,
          face: isPlayer ? 1 : -1, bob: Math.random() * 6.28
        });
      }
    }
    // Place a hero on each side (Cyrus for player, the commander for enemy).
    const anchor = this.units.filter(f => f.side === side);
    if (anchor.length) {
      const h = anchor.reduce((a, b) => (b.role === "cavalry" ? b : a), anchor[0]);
      h.hero = true; h.maxHp *= 3.2; h.hp = h.maxHp; h.dmg *= 1.6; h.speed *= 0.9;
      h.name = isPlayer ? D.HERO.name : this.active.commander.name;
      h.avatar = isPlayer ? D.HERO.avatar : this.active.commander.avatar;
    }
  },

  /* ---------- player input ---------- */
  setStance(key) {
    if (this.active.ended) return;
    const a = this.active;
    a.stance = key;
    a.stanceTimer = (key === "volley" || key === "feigned") ? 3.2 : 6;
    const labels = { charge: "CHARGE!", shieldwall: "SHIELD WALL!", volley: "LOOSE!", flank: "FLANK THEM!", feigned: "FALL BACK!" };
    if (labels[key]) this._announce(labels[key], 1.1, "#e0b64b");
    if (window.SFX) { SFX.resume();
      if (key === "charge") SFX.charge();
      else if (key === "volley") SFX.arrow();
      else if (key === "flank") SFX.drum();
      else SFX.drum();
    }
    // charge kicks up a wall of dust along the player line
    if (key === "charge") { this._shake(); for (const u of this.units) if (u.side === "p" && u.state !== "dead") this._dust(u.x - u.face * 10, u.y + 2, 2); }
    // volley: instant arrow burst from archers
    if (key === "volley") for (const u of this.units) if (u.side === "p" && u.role === "archer" && u.state !== "dead") u.shootCd = Math.min(u.shootCd, 0.1);
  },

  fireAbility(key, battle) {
    const a = this.active;
    const ab = battle.abilities[key];
    if (!ab || ab.left <= 0 || a.ended) return { ok: false };
    if (ab.gold && Game.state.gold < ab.gold) return { ok: false, msg: "Not enough treasury." };
    ab.left--;
    if (ab.gold) { Game.state.gold -= ab.gold; Game.save(); }

    if (window.SFX) SFX.resume();
    if (key === "rally") {
      a.pMorale = Math.min(150, a.pMorale + 24);
      for (const u of this.units) if (u.side === "p" && u.state !== "dead") { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.18); this._burst(u.x, u.y, "#4caf50", 6); }
      this._announce("📯 RALLY!", 1.3, "#4caf50"); if (window.SFX) SFX.rally();
    }
    if (key === "camel") {
      // enemy cavalry panic and flee; big morale hit
      for (const u of this.units) if (u.side === "e" && (u.role === "cavalry") && u.state !== "dead") { u.state = "flee"; u.spook = 3; this._dust(u.x, u.y, 3); }
      a.eMorale -= 28; this._announce("🐪 THE CAMELS! Their horses bolt!", 1.8, "#e0b64b");
      this._shake(0.6); if (window.SFX) SFX.panic();
    }
    if (key === "scythe") {
      for (const u of this.units) if (u.side === "e" && u.role === "infantry" && u.state !== "dead") { this._hurt(u, u.maxHp * 0.6, null); this._burst(u.x, u.y, "#c0392b", 6); }
      a.eMorale -= 16; this._announce("🛞 SCYTHED CHARGE!", 1.5, "#b5342a"); this._shake(0.6); if (window.SFX) { SFX.charge(); SFX.clash(); }
    }
    if (key === "night") {
      for (const u of this.units) if (u.side === "e" && u.state !== "dead") this._hurt(u, u.maxHp * 0.22, null);
      a.eMorale -= 18; this._announce("🌙 NIGHT ASSAULT!", 1.5, "#3f7ab0"); this._shake(0.4); if (window.SFX) SFX.clash();
    }
    if (key === "diversion") {
      a.fort = Math.round(a.fort * 0.2); a.eMorale -= 22;
      for (const u of this.units) if (u.side === "e" && u.state !== "dead" && Math.random() < 0.4) this._hurt(u, u.maxHp * 0.3, null);
      this._announce("🌊 THE RIVER SINKS — through the dry bed!", 2, "#3f7ab0"); this._shake(0.6); if (window.SFX) SFX.water();
    }
    if (key === "bribe") {
      const foes = this.units.filter(u => u.side === "e" && u.state !== "dead");
      foes.slice(0, Math.ceil(foes.length * 0.28)).forEach(u => this._kill(u));
      a.eMorale -= 14; this._announce("💰 The gates are bought open!", 1.6, "#e0b64b"); if (window.SFX) SFX.horn();
    }
    return { ok: true, name: ab.name };
  },

  /* ---------- simulation loop ---------- */
  _loop(ts) {
    const real = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const a = this.active;
    // slow-motion timer (cinematic finishing blows) runs on real time
    if (a.slowT > 0) { a.slowT -= real; if (a.slowT <= 0) { a.timeScale = 1; a.cam.tz = 1; a.cam.tcx = this.W / 2; a.cam.tcy = this.H / 2; } }
    this._updateCamera(real);
    const dt = real * a.timeScale;
    this.time += dt;
    if (!a.paused) this._update(dt);
    this._draw();
    if (!a.ended) this.raf = requestAnimationFrame(t => this._loop(t));
  },

  _updateCamera(dt) {
    const c = this.active.cam;
    const k = Math.min(1, dt * 6);
    c.zoom += (c.tz - c.zoom) * k;
    c.cx += (c.tcx - c.cx) * k;
    c.cy += (c.tcy - c.cy) * k;
    if (c.shakeT > 0) c.shakeT -= dt;
  },

  // Cinematic: slow time and punch-zoom onto a point (a falling commander, etc.)
  _cinematic(x, y, zoom, dur) {
    const a = this.active;
    a.timeScale = 0.32; a.slowT = dur || 1.1;
    a.cam.tz = zoom || 1.7; a.cam.tcx = x; a.cam.tcy = y; a.cam.shakeT = 0.5;
  },

  _alive(side) { return this.units.filter(u => u.side === side && u.state !== "dead" && u.state !== "gone"); },

  _update(dt) {
    const a = this.active;
    if (a.stanceTimer > 0) { a.stanceTimer -= dt; if (a.stanceTimer <= 0 && a.stance !== "advance") a.stance = "advance"; }
    if (a.flashT > 0) a.flashT -= dt;
    for (const k in a.sfx) if (a.sfx[k] > 0) a.sfx[k] -= dt;

    // stance modifiers for player units
    const st = a.stance;
    for (const u of this.units) {
      if (u.state === "dead" || u.state === "gone") continue;
      u.bob += dt * 6;
      if (u.flinch > 0) u.flinch -= dt;
      if (u.spook > 0) u.spook -= dt;
      if (u.lunge > 0) u.lunge -= dt;
      if (u.kb) { u.x += u.kb * dt * 12; u.kb *= Math.max(0, 1 - dt * 9); if (Math.abs(u.kb) < 0.05) u.kb = 0; }
      // dust kicked up by moving mounts
      if ((u.role === "cavalry" || u.role === "camel" || u.role === "chariot") && u.state === "adv" && Math.random() < dt * 4) this._dust(u.x - u.face * 8, u.y + 2, 1);

      let dmgMul = 1, spdMul = 1, defMul = 1;
      if (u.side === "p") {
        if (st === "charge")     { dmgMul = 1.4; spdMul = 1.5; defMul = 0.85; }
        if (st === "shieldwall") { dmgMul = 0.95; spdMul = 0.45; defMul = 1.7; }
        if (st === "volley" && u.role === "archer") { dmgMul = 1.3; }
        if (st === "flank" && (u.role === "cavalry" || u.role === "archer")) { spdMul = 1.35; }
      }

      // Fleeing units run off their own edge.
      if (u.state === "flee") {
        const dir = u.side === "p" ? -1 : 1;
        u.x += dir * u.speed * 1.5 * dt;
        u.face = dir;
        if (u.x < -40 || u.x > this.W + 40) u.state = "gone";
        continue;
      }

      // find nearest living enemy
      if (!u.target || u.target.state === "dead" || u.target.state === "gone") {
        u.target = this._nearestEnemy(u);
      }
      const tg = u.target;
      if (!tg) continue;
      const dx = tg.x - u.x, dy = tg.y - u.y;
      const dist = Math.hypot(dx, dy) || 1;
      u.face = dx >= 0 ? 1 : -1;

      if (u.role === "archer") {
        // archers keep distance and shoot
        const ideal = 150;
        if (dist < ideal - 30) { u.x -= (dx / dist) * u.speed * spdMul * dt; u.y -= (dy / dist) * u.speed * 0.5 * dt; }
        else if (dist > ideal + 60) { u.x += (dx / dist) * u.speed * 0.6 * spdMul * dt; u.y += (dy / dist) * u.speed * 0.4 * dt; }
        u.shootCd -= dt;
        if (u.shootCd <= 0 && dist < 320) {
          this._shoot(u, tg, dmgMul);
          u.shootCd = (st === "volley" && u.side === "p") ? 0.7 : 1.5 + Math.random() * 0.6;
          if (window.SFX && a.sfx.arrow <= 0) { SFX.arrow(); a.sfx.arrow = 0.5; }
        }
      } else {
        // melee: close in, then fight
        const reach = (u.role === "cavalry" || u.role === "chariot") ? 26 : 22;
        // flank behaviour: cavalry/archer arc vertically
        let ty = tg.y;
        if (u.side === "p" && st === "flank" && (u.role === "cavalry")) ty = tg.y + (u.y < this.H / 2 ? -60 : 60);
        const ady = ty - u.y;
        if (dist > reach) {
          u.x += (dx / dist) * u.speed * spdMul * dt;
          u.y += (ady / (Math.abs(ady) || 1)) * Math.min(Math.abs(ady), u.speed * spdMul * dt * 0.7);
          u.state = "adv";
          // cavalry charge impact bonus on first contact
        } else {
          u.state = "fight";
          u.atkCd -= dt;
          if (u.atkCd <= 0) {
            let dmg = u.dmg * dmgMul;
            u.lunge = 0.18;                                  // visible attack lunge
            this._slash(tg.x, tg.y - 10, u.face);            // slash arc
            // charge bonus
            if (!u.charged && (u.role === "cavalry" || u.role === "chariot")) { dmg *= 2.0; u.charged = true; this._burst(tg.x, tg.y, "#fff", 7); this._shake(0.3); if (window.SFX) SFX.thud(); }
            // matchup: spears vs cavalry (esp. shieldwall), archers die in melee, camels vs cav
            if (u.role === "infantry" && tg.role === "cavalry") dmg *= (u.side === "p" && st === "shieldwall") ? 1.9 : 1.35;
            if (u.role === "cavalry" && tg.role === "archer") dmg *= 1.6;
            if (u.role === "camel" && tg.role === "cavalry") { dmg *= 1.8; tg.spook = 2; }
            if (tg.role === "archer" && u.role !== "archer") dmg *= 1.3;
            tg.kb = (u.face) * (u.role === "cavalry" || u.role === "chariot" ? 3.2 : 1.6);  // knockback
            this._hurt(tg, dmg, u);
            if (window.SFX && a.sfx.clash <= 0) { SFX.clash(); a.sfx.clash = 0.12; }
            u.atkCd = 0.55 + Math.random() * 0.3;
          }
        }
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      // hit test vs target area
      const tg = p.target;
      if (tg && tg.state !== "dead" && tg.state !== "gone") {
        if (Math.hypot(tg.x - p.x, tg.y - p.y) < 14) { this._hurt(tg, p.dmg, p.owner); p.dead = true; this._burst(p.x, p.y, "#d8c48a", 3); }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // fx
    for (const f of this.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; f.life -= dt; }
    this.fx = this.fx.filter(f => f.life > 0);

    // morale decay from losses handled in _kill; check rout
    const pa = this._alive("p").length, ea = this._alive("e").length;
    if (!a.ended) {
      if (a.eMorale <= 0 && ea > 0) { for (const u of this._alive("e")) u.state = "flee"; a.eMorale = 1; }
      if (a.pMorale <= 0 && pa > 0) { for (const u of this._alive("p")) u.state = "flee"; a.pMorale = 1; }
      // win when enemy wiped/routed off; lose when player wiped/routed off
      const eGone = this.units.filter(u => u.side === "e").every(u => u.state === "dead" || u.state === "gone" || u.state === "flee") && ea === 0;
      const pGone = this.units.filter(u => u.side === "p").every(u => u.state === "dead" || u.state === "gone" || u.state === "flee") && pa === 0;
      const eRouted = this.units.filter(u => u.side === "e" && (u.state === "dead" || u.state === "gone")).length >= this.units.filter(u => u.side === "e").length;
      const pRouted = this.units.filter(u => u.side === "p" && (u.state === "dead" || u.state === "gone")).length >= this.units.filter(u => u.side === "p").length;
      // Safety timeout (90s): whoever has more surviving strength wins.
      const timeout = this.time > 90;
      if (eRouted || eGone || (timeout && this._strengthFrac("p") >= this._strengthFrac("e"))) this._finish(true);
      else if (pRouted || pGone || (timeout)) this._finish(false);
    }
  },

  _nearestEnemy(u) {
    let best = null, bd = 1e9;
    for (const o of this.units) {
      if (o.side === u.side || o.state === "dead" || o.state === "gone" || o.state === "flee") continue;
      const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  },

  _shoot(u, tg, dmgMul) {
    const lead = 0.25;
    const tx = tg.x, ty = tg.y;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1;
    const sp = 320;
    this.projectiles.push({
      x: u.x, y: u.y - 14, vx: (dx / d) * sp, vy: (dy / d) * sp - 40,
      life: 1.6, dmg: u.dmg * 0.7 * dmgMul, target: tg, owner: u, dead: false
    });
  },

  _hurt(u, dmg, from) {
    // shieldwall defence for player targets
    if (u.side === "p" && this.active.stance === "shieldwall") dmg *= 0.6;
    u.hp -= dmg; u.flinch = 0.18;
    this._burst(u.x, u.y - 8, "#9c1c14", 4);                 // blood
    if (u.hp <= 0) this._kill(u);
  },

  _kill(u) {
    if (u.state === "dead") return;
    u.state = "dead"; u.deadAngle = (Math.random() - 0.5) * 1.2; u.fade = 1;
    const a = this.active;
    const share = u.hero ? 10 : 2.6;
    if (u.side === "p") a.pMorale -= share; else a.eMorale -= share;
    this._burst(u.x, u.y - 6, "#7c1810", u.hero ? 14 : 6);   // death spray
    if (u.hero) {
      this._announce(u.side === "p" ? "⚑ Your commander falls!" : "⚑ " + u.name + " is slain!", 2.2, u.side === "p" ? "#c0392b" : "#e0b64b");
      this._cinematic(u.x, u.y - 10, 2.0, 1.2);              // slow-motion finishing blow
      if (window.SFX) { SFX.thud(); setTimeout(() => u.side === "p" ? SFX.defeat() : SFX.cry(), 200); }
    }
  },

  _strengthFrac(side) {
    const tot = this.units.filter(u => u.side === side).length || 1;
    const al = this._alive(side).length;
    return al / tot;
  },

  _burst(x, y, color, n) { for (let i = 0; i < n; i++) this.fx.push({ type: "p", x, y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 100, life: 0.4 + Math.random() * 0.35, color }); },
  _dust(x, y, n) { for (let i = 0; i < n; i++) this.fx.push({ type: "dust", x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 14, life: 0.5 + Math.random() * 0.4, r: 3 + Math.random() * 4 }); },
  _slash(x, y, face) { this.fx.push({ type: "slash", x, y, face, life: 0.16 }); },
  _announce(text, dur, color) { this.active.flash = { text, color: color || "#f2e6cf" }; this.active.flashT = dur; },
  _shake(amt) { this.active.cam.shakeT = Math.max(this.active.cam.shakeT, amt || 0.4); },

  _finish(won) {
    if (this.active.ended) return;
    this.active.ended = true; this.active.won = won;
    this._announce(won ? "🏆 VICTORY!" : "💀 DEFEAT", 2.4, won ? "#e0b64b" : "#c0392b");
    this._cinematic(this.W / 2, this.H / 2, 1.35, 1.3);
    if (window.SFX) won ? SFX.victory() : SFX.defeat();
    // Compute survivors per type for the campaign roster.
    const survivors = {};
    for (const [k, start] of Object.entries(this.active.startCount.p)) {
      const tot = this.active.figTotal.p[k] || 1;
      const aliveFigs = this.units.filter(u => u.side === "p" && u.type === k && (u.state !== "dead" && u.state !== "gone")).length;
      survivors[k] = { count: Math.round(start * (aliveFigs / tot)), vet: (Game.state.roster[k] ? Game.state.roster[k].vet : 0) };
    }
    const self = this;
    setTimeout(() => { self.stop(); self.onEnd && self.onEnd({ won, survivors }); }, 1400);
  },

  /* ================= DRAWING ================= */
  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const cam = this.active.cam;
    ctx.save();
    // camera: shake + punch-zoom focus
    if (cam.shakeT > 0) { const m = cam.shakeT * 14; ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    this._drawBackground(ctx, W, H);

    // sort by y for depth; dead first (under), heroes last (over)
    const order = this.units.slice().sort((a, b) => (a.state === "dead" ? -1 : 0) - (b.state === "dead" ? -1 : 0) || (a.hero ? 1 : 0) - (b.hero ? 1 : 0) || a.y - b.y);
    for (const u of order) this._drawWarrior(ctx, u);

    // projectiles (arrows)
    ctx.strokeStyle = "#e8dcbf"; ctx.lineWidth = 2;
    for (const p of this.projectiles) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * 10, p.y - Math.sin(ang) * 10); ctx.stroke();
    }
    // fx: dust clouds, slash arcs, blood/spark particles
    for (const f of this.fx) {
      const al = Math.max(0, Math.min(1, f.life * 2.2));
      if (f.type === "dust") {
        ctx.globalAlpha = al * 0.5; ctx.fillStyle = "#cbb78a";
        ctx.beginPath(); ctx.arc(f.x, f.y, (f.r || 4) * (1.4 - f.life), 0, 6.28); ctx.fill();
      } else if (f.type === "slash") {
        ctx.globalAlpha = al; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, 14, f.face > 0 ? -1.0 : 2.1, f.face > 0 ? 1.0 : 4.1); ctx.stroke();
      } else {
        ctx.globalAlpha = al; ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, 3.2, 3.2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // announcement flash — drawn in screen space (not zoomed)
    if (this.active.flashT > 0 && this.active.flash) {
      const al = Math.min(1, this.active.flashT);
      ctx.save(); ctx.globalAlpha = al; ctx.textAlign = "center";
      ctx.font = "800 clamp(22px,4vw,34px) 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillText(this.active.flash.text, W / 2 + 2, H * 0.3 + 2);
      ctx.fillStyle = this.active.flash.color; ctx.fillText(this.active.flash.text, W / 2, H * 0.3);
      ctx.restore();
    }
  },

  _drawBackground(ctx, W, H) {
    const terr = this.active.terrain;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    const skies = {
      plain:   ["#f3d9a0", "#c98f52"], hills: ["#e9c98a", "#9c7a4a"],
      mountain:["#cdd8e6", "#7a8aa0"], river: ["#cfe3e8", "#7fa0a8"],
      desert:  ["#f6dca0", "#d79a53"], city: ["#e7c98f", "#8a6a44"], forest: ["#cfe0b0", "#7a8a5a"]
    };
    const pal = skies[terr] || skies.plain;
    sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = "rgba(255,244,214,.85)";
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.2, 34, 0, 6.28); ctx.fill();

    // distant silhouettes
    ctx.fillStyle = "rgba(90,70,45,.35)";
    if (terr === "mountain" || terr === "hills") {
      for (let i = 0; i < 6; i++) { const bx = (i / 5) * W; ctx.beginPath(); ctx.moveTo(bx - 120, H * 0.55); ctx.lineTo(bx, H * (terr === "mountain" ? 0.2 : 0.38)); ctx.lineTo(bx + 120, H * 0.55); ctx.fill(); }
    } else if (terr === "city") {
      ctx.fillStyle = "rgba(70,52,34,.5)";
      const wy = H * 0.3, wh = H * 0.28, wx = W * 0.1, ww = W * 0.8;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = "rgba(50,36,24,.6)";
      for (let x = wx; x < wx + ww; x += 36) ctx.fillRect(x, wy - 14, 20, 14);              // crenellations
      for (let x = wx + 60; x < wx + ww - 40; x += 120) ctx.fillRect(x, wy, 26, wh);         // towers
    } else if (terr === "desert") {
      ctx.fillStyle = "rgba(150,110,60,.3)";
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(W * (0.2 + i * 0.25), H * 0.52, 160, 40, 0, Math.PI, 0); ctx.fill(); }
    } else {
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(W * (i * 0.25), H * 0.52, 140, 30, 0, Math.PI, 0); ctx.fill(); }
    }

    // ground
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    const grounds = {
      plain: ["#b89258", "#8a6a3c"], hills: ["#a8884e", "#6e5630"], mountain: ["#9a9286", "#6a6256"],
      river: ["#a89a6a", "#7a6e46"], desert: ["#d9b472", "#b08a4a"], city: ["#a38a62", "#6e5a3c"], forest: ["#8a9458", "#5a6436"]
    };
    const gp = grounds[terr] || grounds.plain;
    g.addColorStop(0, gp[0]); g.addColorStop(1, gp[1]);
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);

    // river band
    if (terr === "river") { ctx.fillStyle = "rgba(90,140,160,.55)"; ctx.fillRect(0, H * 0.6, W, H * 0.12); }
  },

  _drawWarrior(ctx, u) {
    if (u.hero) return this._drawHero(ctx, u);
    const player = u.side === "p";
    const main = player ? "#2f5d8c" : "#8e2b24";
    const trim = "#e0b64b";
    const skin = "#caa06a";
    const lunge = (u.lunge > 0 ? (u.lunge / 0.18) * 5 : 0);   // thrust toward foe when striking
    ctx.save();
    ctx.translate(u.x + u.face * lunge, u.y);
    ctx.scale(u.face, 1);

    if (u.state === "dead") {
      ctx.globalAlpha = 0.5; ctx.rotate(u.deadAngle || 1);
      ctx.fillStyle = "rgba(60,40,30,.6)"; ctx.fillRect(-8, -4, 16, 6);
      ctx.restore(); return;
    }

    const bob = Math.sin(u.bob) * (u.state === "adv" ? 1.6 : 0.5);
    const flinch = u.flinch > 0 ? 2 : 0;

    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, 2, 10, 3.4, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;

    // The Immortals get distinctive elite guardsman art.
    if (u.type === "immortals") { this._immortalBody(ctx, u, bob); ctx.restore(); return; }
    // Player's Persian line gets original Achaemenid-styled art.
    if (player && u.role === "infantry") { this._drawSparabara(ctx, u, bob); ctx.restore(); return; }
    if (player && u.role === "archer")   { this._drawPersianArcher(ctx, u, bob); ctx.restore(); return; }

    const mounted = u.role === "cavalry" || u.role === "camel" || u.role === "chariot";
    if (mounted) {
      // mount body
      const horse = u.role === "camel" ? "#c9a36a" : (player ? "#5a4636" : "#4a3628");
      ctx.fillStyle = horse;
      ctx.fillRect(-12, -14, 24, 9);                    // body
      ctx.fillRect(10, -22, 5, 10);                     // neck
      ctx.fillRect(-12, -6, 3, 8); ctx.fillRect(9, -6, 3, 8);  // legs
      ctx.beginPath(); ctx.arc(14, -23, 3.5, 0, 6.28); ctx.fill(); // head
      if (u.role === "camel") { ctx.fillRect(-4, -20, 6, 6); }    // hump
    }
    const ry = mounted ? -22 : -2 + flinch;

    // legs (foot only)
    if (!mounted) { ctx.fillStyle = "#6a5236"; ctx.fillRect(-5, -8 + bob * 0.3, 3, 9); ctx.fillRect(2, -8 - bob * 0.3, 3, 9); }
    // torso
    ctx.fillStyle = main; ctx.fillRect(-5, ry - 14 + bob, 10, 15);
    // belt/trim
    ctx.fillStyle = trim; ctx.fillRect(-5, ry - 4 + bob, 10, 2);
    // head
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, ry - 18 + bob, 4.2, 0, 6.28); ctx.fill();
    // cap/helmet
    ctx.fillStyle = player ? "#24405f" : "#5e1d18"; ctx.fillRect(-4.5, ry - 23 + bob, 9, 4);

    // weapons by role
    ctx.strokeStyle = "#caa870"; ctx.lineWidth = 2;
    if (u.role === "archer") {
      // bow
      ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(7, ry - 12 + bob, 9, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = "#e8dcbf"; ctx.beginPath(); ctx.moveTo(7, ry - 21 + bob); ctx.lineTo(7, ry - 3 + bob); ctx.stroke();
    } else if (u.role === "infantry" || u.role === "camel" || u.role === "chariot") {
      // spear
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, ry - 24 + bob); ctx.lineTo(8, ry + 2 + bob); ctx.stroke();
      ctx.fillStyle = "#d8d0bf"; ctx.beginPath(); ctx.moveTo(5, ry - 24 + bob); ctx.lineTo(3, ry - 20 + bob); ctx.lineTo(7, ry - 21 + bob); ctx.fill();
      // shield
      ctx.fillStyle = player ? "#315f8c" : "#7a241e"; ctx.beginPath(); ctx.ellipse(-6, ry - 7 + bob, 3.6, 6, 0, 0, 6.28); ctx.fill();
      ctx.strokeStyle = trim; ctx.lineWidth = 1; ctx.stroke();
    } else if (u.role === "cavalry") {
      // sword raised
      ctx.strokeStyle = "#dcd4c0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, ry - 14 + bob); ctx.lineTo(13, ry - 24 + bob); ctx.stroke();
    }

    ctx.restore();
  },

  // An original Immortal guardsman: fluted gold tiara, patterned robe, a tall
  // spear and a big spara shield bearing a winged emblem. (Elite, player-side.)
  _immortalBody(ctx, u, bob) {
    const gold = "#d8b24a", goldD = "#9c7016", blue = "#2f4a8c", robe = "#c49a3e";
    const f = u.flinch > 0 ? 1.5 : 0;
    // patterned trousers
    ctx.fillStyle = blue;
    ctx.fillRect(-6, -9 + bob * 0.3, 5, 10); ctx.fillRect(1, -9 - bob * 0.3, 5, 10);
    ctx.fillStyle = gold; ctx.fillRect(-5, -6, 1.4, 1.4); ctx.fillRect(2.6, -4, 1.4, 1.4); ctx.fillRect(-4, -2, 1.4, 1.4); ctx.fillRect(3, -7, 1.4, 1.4);
    const ry = -2 + f;
    // long robe (trapezoid)
    ctx.fillStyle = robe;
    ctx.beginPath(); ctx.moveTo(-6, ry - 14 + bob); ctx.lineTo(6, ry - 14 + bob); ctx.lineTo(9, -2); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
    // hem band + studs
    ctx.fillStyle = blue; ctx.fillRect(-9, -5, 18, 3);
    ctx.fillStyle = gold; for (let x = -8; x <= 8; x += 3) ctx.fillRect(x, -4.4, 1.3, 1.3);
    // gilded chest
    ctx.fillStyle = gold; ctx.fillRect(-5, ry - 14 + bob, 10, 8);
    ctx.fillStyle = goldD; ctx.fillRect(-5, ry - 10 + bob, 10, 1.4);
    ctx.fillStyle = "#7a5713"; ctx.fillRect(-6, ry - 6 + bob, 12, 2);   // belt
    // tall spear (back hand)
    ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-7, ry - 32 + bob); ctx.lineTo(-7, 2); ctx.stroke();
    ctx.fillStyle = "#e8e2d2"; ctx.beginPath(); ctx.moveTo(-7, ry - 37 + bob); ctx.lineTo(-9.4, ry - 31 + bob); ctx.lineTo(-4.6, ry - 31 + bob); ctx.closePath(); ctx.fill();
    // head + curled beard
    ctx.fillStyle = "#caa06a"; ctx.beginPath(); ctx.arc(0, ry - 20 + bob, 4.4, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#2e2016"; ctx.beginPath(); ctx.arc(0, ry - 16 + bob, 3.8, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(-4, ry - 21 + bob, 2.4, 0.5, 2.9); ctx.fill();   // hair
    // fluted tiara (crenellated gold crown)
    ctx.fillStyle = gold; ctx.fillRect(-5, ry - 25 + bob, 10, 5);
    ctx.fillStyle = goldD; for (let cx = -5; cx < 5; cx += 2.4) ctx.fillRect(cx, ry - 29 + bob, 1.7, 4);
    ctx.fillStyle = "#8e2b24"; ctx.fillRect(-1.2, ry - 23 + bob, 2.4, 2);    // central gem
    // big spara shield (forward hand), with a winged emblem
    ctx.save(); ctx.translate(8, ry - 9 + bob);
    ctx.fillStyle = "#7c2a20"; ctx.beginPath(); ctx.ellipse(0, 0, 6.4, 12.5, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 6.28); ctx.fill();            // boss
    ctx.strokeStyle = gold; ctx.lineWidth = 1; // winged emblem hint
    ctx.beginPath(); ctx.moveTo(-4.5, -6); ctx.quadraticCurveTo(0, -4, 4.5, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.5, 6); ctx.quadraticCurveTo(0, 4, 4.5, 6); ctx.stroke();
    ctx.restore();
  },

  // Sparabara spearman: patterned tunic, soft cap, spear, and a tall woven
  // wicker body-shield (spara). Original art in the Achaemenid style.
  _drawSparabara(ctx, u, bob) {
    const tunic = "#3a6a9c", trim = "#e0b64b", skin = "#caa06a", f = u.flinch > 0 ? 1.5 : 0;
    const ry = -2 + f;
    ctx.fillStyle = "#6a5236"; ctx.fillRect(-4, -8 + bob * 0.3, 3, 9); ctx.fillRect(2, -8 - bob * 0.3, 3, 9);
    // tunic
    ctx.fillStyle = tunic; ctx.fillRect(-5, ry - 14 + bob, 10, 16);
    ctx.fillStyle = trim; ctx.fillRect(-5, ry - 2 + bob, 10, 2);           // hem
    ctx.fillStyle = "#d8b45a"; ctx.fillRect(-5, ry - 10 + bob, 10, 1.2);   // chest band
    // head + beard
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, ry - 18 + bob, 4.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#2e2016"; ctx.beginPath(); ctx.arc(0, ry - 14 + bob, 3.2, 0, Math.PI); ctx.fill();
    // soft rounded cap
    ctx.fillStyle = "#24405f"; ctx.beginPath(); ctx.arc(0, ry - 20 + bob, 4.4, Math.PI, 0); ctx.fill();
    ctx.fillStyle = trim; ctx.fillRect(-4.4, ry - 20 + bob, 8.8, 1.4);
    // spear (back hand)
    ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-6, ry - 28 + bob); ctx.lineTo(-6, 1); ctx.stroke();
    ctx.fillStyle = "#e8e2d2"; ctx.beginPath(); ctx.moveTo(-6, ry - 32 + bob); ctx.lineTo(-8, ry - 27 + bob); ctx.lineTo(-4, ry - 27 + bob); ctx.closePath(); ctx.fill();
    // tall woven wicker spara shield (forward)
    ctx.save(); ctx.translate(6, ry - 7 + bob);
    ctx.fillStyle = "#9c7a2e"; ctx.fillRect(-4, -11, 9, 22);
    ctx.strokeStyle = "#5a4420"; ctx.lineWidth = 0.9;
    for (let yy = -9; yy < 10; yy += 2.6) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(5, yy); ctx.stroke(); }
    ctx.strokeStyle = trim; ctx.lineWidth = 1.4; ctx.strokeRect(-4, -11, 9, 22);
    ctx.restore();
  },

  // Persian archer: bashlyk hood, patterned tunic, a back quiver and a drawn bow.
  _drawPersianArcher(ctx, u, bob) {
    const tunic = "#5a4a8c", trim = "#e0b64b", skin = "#caa06a", f = u.flinch > 0 ? 1.5 : 0;
    const ry = -2 + f;
    ctx.fillStyle = "#6a5236"; ctx.fillRect(-4, -8 + bob * 0.3, 3, 9); ctx.fillRect(2, -8 - bob * 0.3, 3, 9);
    // quiver + arrows on back
    ctx.fillStyle = "#7a4a2a"; ctx.fillRect(-8, ry - 16 + bob, 3, 13);
    ctx.strokeStyle = "#e8dcbf"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, ry - 16 + bob); ctx.lineTo(-9, ry - 22 + bob); ctx.moveTo(-6, ry - 16 + bob); ctx.lineTo(-7.5, ry - 22 + bob); ctx.stroke();
    // tunic
    ctx.fillStyle = tunic; ctx.fillRect(-5, ry - 14 + bob, 10, 16);
    ctx.fillStyle = trim; ctx.fillRect(-5, ry - 2 + bob, 10, 2);
    ctx.fillStyle = "#d8b45a"; ctx.fillRect(-5, ry - 9 + bob, 10, 1.1);
    // head
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, ry - 18 + bob, 4.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#2e2016"; ctx.beginPath(); ctx.arc(0, ry - 14 + bob, 2.8, 0, Math.PI); ctx.fill();
    // bashlyk soft hood
    ctx.fillStyle = "#c69a3e"; ctx.beginPath();
    ctx.moveTo(-4.4, ry - 17 + bob); ctx.quadraticCurveTo(-1, ry - 26 + bob, 4.4, ry - 19 + bob);
    ctx.lineTo(4.4, ry - 16 + bob); ctx.lineTo(-4.4, ry - 16 + bob); ctx.closePath(); ctx.fill();
    // drawn bow (forward)
    ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(7, ry - 12 + bob, 9, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = "#e8dcbf"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7, ry - 21 + bob); ctx.lineTo(7, ry - 3 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, ry - 12 + bob); ctx.lineTo(13, ry - 12 + bob); ctx.stroke();   // nocked arrow
  },

  // A mounted, crowned commander (Cyrus, or the enemy king) — larger and regal.
  _drawHero(ctx, u) {
    const player = u.side === "p";
    const robe = player ? "#7a4a9c" : "#2f4a6d";
    const horse = player ? "#5a4030" : "#40342a";
    const cape = player ? "#4a2a68" : "#3a2f5a";
    ctx.save(); ctx.translate(u.x, u.y);

    // shadow
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, 5, 20, 5.5, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;

    if (u.state === "dead") {
      ctx.rotate(u.deadAngle || 1); ctx.globalAlpha = 0.6;
      ctx.fillStyle = robe; ctx.fillRect(-16, -6, 32, 10);
      ctx.fillStyle = "#e0b64b"; ctx.fillRect(14, -8, 10, 6);   // fallen crown
      ctx.restore(); return;
    }

    const bob = Math.sin(u.bob) * (u.state === "adv" ? 1.8 : 0.6);
    const lunge = (u.lunge > 0 ? (u.lunge / 0.18) * 6 : 0);
    // distinction glow
    ctx.globalAlpha = 0.18; ctx.fillStyle = player ? "#3f7ab0" : "#b5342a";
    ctx.beginPath(); ctx.arc(0, -30, 30, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;

    ctx.save(); ctx.translate(u.face * lunge, 0); ctx.scale(u.face, 1);
    // ---- war-horse ----
    ctx.fillStyle = horse;
    ctx.fillRect(-20, -22, 40, 15);                 // body
    ctx.fillRect(16, -36, 8, 17);                   // neck
    ctx.beginPath(); ctx.arc(23, -38, 6, 0, 6.28); ctx.fill();   // head
    ctx.fillRect(-19, -9, 5, 15); ctx.fillRect(13, -9, 5, 15);   // legs
    ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(-30, -14); ctx.lineTo(-20, -12); ctx.fill(); // tail
    // royal saddle cloth
    ctx.fillStyle = robe; ctx.fillRect(-17, -24, 28, 9);
    ctx.fillStyle = "#e0b64b"; ctx.fillRect(-17, -16, 28, 2);

    const ry = -34;
    // cape
    ctx.fillStyle = cape;
    ctx.beginPath(); ctx.moveTo(-6, ry - 12 + bob); ctx.quadraticCurveTo(-22, ry + 10 + bob, -14, ry + 20 + bob); ctx.lineTo(-4, ry + 2 + bob); ctx.fill();
    // robe/torso
    ctx.fillStyle = robe; ctx.fillRect(-7, ry - 18 + bob, 14, 22);
    ctx.fillStyle = "#e0b64b"; ctx.fillRect(-7, ry - 2 + bob, 14, 2);  // belt
    ctx.fillStyle = "#e0b64b"; ctx.fillRect(-1, ry - 18 + bob, 2, 20); // robe seam
    // head + beard
    ctx.fillStyle = "#d8a36a"; ctx.beginPath(); ctx.arc(0, ry - 24 + bob, 6, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#2e2016"; ctx.beginPath(); ctx.arc(0, ry - 19 + bob, 5.4, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(-5, ry - 24 + bob, 3, 0.4, 2.6); ctx.arc(5, ry - 24 + bob, 3, 0.6, 2.8); ctx.fill(); // side hair
    // fluted crown
    ctx.fillStyle = "#e0b64b"; ctx.fillRect(-8, ry - 34 + bob, 16, 10);
    ctx.fillStyle = "#c8912b"; for (let cx = -8; cx < 8; cx += 4) ctx.fillRect(cx, ry - 38 + bob, 3, 4);
    ctx.fillStyle = "#2a5a8c"; ctx.beginPath(); ctx.arc(0, ry - 29 + bob, 2.4, 0, 6.28); ctx.fill();
    // raised sword (lifts when striking)
    const raise = u.lunge > 0 ? 9 : 0;
    ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(7, ry - 8 + bob); ctx.lineTo(17, ry - 26 - raise + bob); ctx.stroke();
    ctx.fillStyle = "#e0b64b"; ctx.fillRect(5, ry - 10 + bob, 5, 3);   // hilt guard
    // banner (behind)
    ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-14, ry + 4 + bob); ctx.lineTo(-14, ry - 46 + bob); ctx.stroke();
    ctx.fillStyle = player ? "#8e2b24" : "#2f5d8c"; ctx.fillRect(-14, ry - 46 + bob, 14, 10);
    ctx.fillStyle = "#e0b64b"; ctx.font = "8px serif"; ctx.textAlign = "center"; ctx.fillText(player ? "𐎠" : "✶", -7, ry - 38 + bob); ctx.textAlign = "left";
    ctx.restore();

    // name label (screen-upright)
    ctx.font = "700 11px 'Trebuchet MS'"; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillText(u.name || "", 1, -61);
    ctx.fillStyle = player ? "#bfe0ff" : "#ffd9b0"; ctx.fillText(u.name || "", 0, -62);
    ctx.textAlign = "left";
    ctx.restore();
  }
};

window.Field = Field;
