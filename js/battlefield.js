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
      commander: D.getCommander(levelObj.n)
    };

    // Spawn figures from the committed armies.
    this._spawnSide("p", battle.player, true);
    this._spawnSide("e", battle.enemy, false);

    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(t => this._loop(t));
    this._announce("⚔️ " + levelObj.title, 1.6);
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
    const MAX = 34;                      // max figures per side
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

    if (key === "rally") {
      a.pMorale = Math.min(150, a.pMorale + 24);
      for (const u of this.units) if (u.side === "p" && u.state !== "dead") { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.18); this._burst(u.x, u.y, "#4caf50", 6); }
      this._announce("📯 RALLY!", 1.3, "#4caf50");
    }
    if (key === "camel") {
      // enemy cavalry panic and flee; big morale hit
      for (const u of this.units) if (u.side === "e" && (u.role === "cavalry") && u.state !== "dead") { u.state = "flee"; u.spook = 3; }
      a.eMorale -= 28; this._announce("🐪 THE CAMELS! Their horses bolt!", 1.8, "#e0b64b");
      this._shake();
    }
    if (key === "scythe") {
      for (const u of this.units) if (u.side === "e" && u.role === "infantry" && u.state !== "dead") { this._hurt(u, u.maxHp * 0.6, null); }
      a.eMorale -= 16; this._announce("🛞 SCYTHED CHARGE!", 1.5, "#b5342a"); this._shake();
    }
    if (key === "night") {
      for (const u of this.units) if (u.side === "e" && u.state !== "dead") this._hurt(u, u.maxHp * 0.22, null);
      a.eMorale -= 18; this._announce("🌙 NIGHT ASSAULT!", 1.5, "#3f7ab0");
    }
    if (key === "diversion") {
      a.fort = Math.round(a.fort * 0.2); a.eMorale -= 22;
      for (const u of this.units) if (u.side === "e" && u.state !== "dead" && Math.random() < 0.4) this._hurt(u, u.maxHp * 0.3, null);
      this._announce("🌊 THE RIVER SINKS — through the dry bed!", 2, "#3f7ab0"); this._shake();
    }
    if (key === "bribe") {
      const foes = this.units.filter(u => u.side === "e" && u.state !== "dead");
      foes.slice(0, Math.ceil(foes.length * 0.28)).forEach(u => this._kill(u));
      a.eMorale -= 14; this._announce("💰 The gates are bought open!", 1.6, "#e0b64b");
    }
    return { ok: true, name: ab.name };
  },

  /* ---------- simulation loop ---------- */
  _loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts; this.time += dt;
    if (!this.active.paused) this._update(dt);
    this._draw();
    if (!this.active.ended) this.raf = requestAnimationFrame(t => this._loop(t));
  },

  _alive(side) { return this.units.filter(u => u.side === side && u.state !== "dead" && u.state !== "gone"); },

  _update(dt) {
    const a = this.active;
    if (a.stanceTimer > 0) { a.stanceTimer -= dt; if (a.stanceTimer <= 0 && a.stance !== "advance") a.stance = "advance"; }
    if (a.flashT > 0) a.flashT -= dt;
    if (this._shakeT > 0) this._shakeT -= dt;

    // stance modifiers for player units
    const st = a.stance;
    for (const u of this.units) {
      if (u.state === "dead" || u.state === "gone") continue;
      u.bob += dt * 6;
      if (u.flinch > 0) u.flinch -= dt;
      if (u.spook > 0) u.spook -= dt;

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
            // charge bonus
            if (!u.charged && (u.role === "cavalry" || u.role === "chariot")) { dmg *= 2.0; u.charged = true; this._burst(tg.x, tg.y, "#fff", 5); }
            // matchup: spears vs cavalry (esp. shieldwall), archers die in melee, camels vs cav
            if (u.role === "infantry" && tg.role === "cavalry") dmg *= (u.side === "p" && st === "shieldwall") ? 1.9 : 1.35;
            if (u.role === "cavalry" && tg.role === "archer") dmg *= 1.6;
            if (u.role === "camel" && tg.role === "cavalry") { dmg *= 1.8; tg.spook = 2; }
            if (tg.role === "archer" && u.role !== "archer") dmg *= 1.3;
            this._hurt(tg, dmg, u);
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
    u.hp -= dmg; u.flinch = 0.15;
    this._burst(u.x, u.y - 8, "#c0392b", 3);
    if (u.hp <= 0) this._kill(u);
  },

  _kill(u) {
    if (u.state === "dead") return;
    u.state = "dead"; u.deadAngle = (Math.random() - 0.5) * 1.2; u.fade = 1;
    const a = this.active;
    const share = u.hero ? 10 : 2.6;
    if (u.side === "p") a.pMorale -= share; else a.eMorale -= share;
    if (u.hero) this._announce(u.side === "p" ? "Your commander falls!" : u.name + " is slain!", 1.8, u.side === "p" ? "#c0392b" : "#e0b64b");
  },

  _strengthFrac(side) {
    const tot = this.units.filter(u => u.side === side).length || 1;
    const al = this._alive(side).length;
    return al / tot;
  },

  _burst(x, y, color, n) { for (let i = 0; i < n; i++) this.fx.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 90, life: 0.4 + Math.random() * 0.3, color }); },
  _announce(text, dur, color) { this.active.flash = { text, color: color || "#f2e6cf" }; this.active.flashT = dur; },
  _shake() { this._shakeT = 0.4; },

  _finish(won) {
    if (this.active.ended) return;
    this.active.ended = true; this.active.won = won;
    this._announce(won ? "🏆 VICTORY!" : "💀 DEFEAT", 2.4, won ? "#e0b64b" : "#c0392b");
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
    ctx.save();
    if (this._shakeT > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    this._drawBackground(ctx, W, H);

    // sort by y for depth; dead first (under), heroes last (over)
    const order = this.units.slice().sort((a, b) => (a.state === "dead" ? -1 : 0) - (b.state === "dead" ? -1 : 0) || a.y - b.y);
    for (const u of order) this._drawWarrior(ctx, u);

    // projectiles
    ctx.strokeStyle = "#e8dcbf"; ctx.lineWidth = 2;
    for (const p of this.projectiles) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * 9, p.y - Math.sin(ang) * 9); ctx.stroke();
    }
    // fx
    for (const f of this.fx) { ctx.globalAlpha = Math.max(0, f.life * 2); ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, 3, 3); ctx.globalAlpha = 1; }

    // announcement flash
    if (this.active.flashT > 0 && this.active.flash) {
      const al = Math.min(1, this.active.flashT);
      ctx.globalAlpha = al; ctx.textAlign = "center";
      ctx.font = "800 30px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillText(this.active.flash.text, W / 2 + 2, H / 2 + 2);
      ctx.fillStyle = this.active.flash.color; ctx.fillText(this.active.flash.text, W / 2, H / 2);
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
    ctx.restore();
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
    const player = u.side === "p";
    const main = player ? "#2f5d8c" : "#8e2b24";
    const trim = player ? "#e0b64b" : "#e0b64b";
    const skin = "#caa06a";
    ctx.save();
    ctx.translate(u.x, u.y);
    const s = u.hero ? 1.5 : 1;
    ctx.scale(u.face * s, s);

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

    // hero crown + banner + name
    if (u.hero) {
      ctx.fillStyle = "#e0b64b";
      ctx.beginPath(); ctx.moveTo(-4, ry - 26 + bob); ctx.lineTo(-4, ry - 30 + bob); ctx.lineTo(-1.5, ry - 27 + bob);
      ctx.lineTo(0, ry - 31 + bob); ctx.lineTo(1.5, ry - 27 + bob); ctx.lineTo(4, ry - 30 + bob); ctx.lineTo(4, ry - 26 + bob); ctx.fill();
      // banner pole
      ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, ry + 2 + bob); ctx.lineTo(-8, ry - 34 + bob); ctx.stroke();
      ctx.fillStyle = player ? "#8e2b24" : "#2f5d8c"; ctx.fillRect(-8, ry - 34 + bob, 11, 8);
      ctx.restore();
      // name label (unflipped)
      ctx.save(); ctx.translate(u.x, u.y);
      ctx.font = "700 10px 'Trebuchet MS'"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillText(u.name || "", 0, (mounted ? -40 : -34) + 1);
      ctx.fillStyle = player ? "#bfe0ff" : "#ffd9b0"; ctx.fillText(u.name || "", 0, mounted ? -40 : -34);
      ctx.textAlign = "left"; ctx.restore();
      return;
    }
    ctx.restore();
  }
};

window.Field = Field;
