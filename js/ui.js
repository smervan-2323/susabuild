/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   ui.js  —  Screen rendering and all player interaction
   ========================================================================= */

/* `D` (the game data) is declared once in engine.js and shared across these
   classic scripts' common global scope — we reuse it here, not redeclare it. */
const app = () => document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const UI = {
  pendingDecision: null,

  /* ---------- boot ---------- */
  init() {
    if (!Game.load()) Game.newGame();
    this.renderTitle();
  },

  /* ---------- TITLE / MAIN MENU ---------- */
  renderTitle() {
    const hasSave = Game.state.cleared > 0;
    app().innerHTML = `
      <div class="screen title-screen">
        <div class="title-hero">
          <div class="hero-stage" id="hero-stage" title="Tap for his battle cry!">${window.CYRUS_SVG || ""}</div>
          <div class="hero-cap">Cyrus the Great · <span class="muted">tap him for a battle cry</span></div>
        </div>
        <div class="title-side">
          <h1 class="game-title">CYRUS</h1>
          <h2 class="game-sub">Lord of the Four Corners</h2>
          <p class="tagline">An ancient-world grand-strategy battle game.<br>
             Relive the real conquests of Cyrus the Great across 100 levels — from the plains of Persis to the walls of Babylon.</p>
          <div class="menu-btns">
            <button class="btn btn-gold" id="btn-continue" ${hasSave ? "" : "disabled"}>
              ${hasSave ? `Continue — Level ${Game.state.cleared + 1}` : "Continue"}
            </button>
            <button class="btn" id="btn-new">New Campaign</button>
            <button class="btn btn-ghost" id="btn-howto">How to Play</button>
            <button class="btn btn-ghost" id="btn-codex2">Historical Codex</button>
          </div>
          <p class="credit">A playable history. Years are BCE. Sources: Herodotus · Xenophon · the Nabonidus Chronicle · the Cyrus Cylinder.</p>
        </div>
      </div>`;
    const stage = document.getElementById("hero-stage");
    if (stage) { stage.onclick = () => window.cyrusCry && window.cyrusCry(stage); window.cyrusCry && window.cyrusCry(stage); }
    document.getElementById("btn-continue").onclick = () => hasSave && this.renderMap();
    document.getElementById("btn-new").onclick = () => {
      if (!hasSave || confirm("Begin a new campaign? Your current progress will be lost.")) {
        Game.reset(); this.renderMap();
      }
    };
    document.getElementById("btn-howto").onclick = () => this.renderHowTo();
    document.getElementById("btn-codex2").onclick = () => this.renderCodex(() => this.renderTitle());
  },

  renderHowTo() {
    app().innerHTML = `
      <div class="screen panel-screen">
        <h2 class="hdr">How to Play</h2>
        <div class="howto">
          <h3>⚔️ The Goal</h3>
          <p>Lead Cyrus from a Persian prince to King of the Four Corners across <b>100 historical levels</b> in 8 chapters, each following his real campaigns.</p>
          <h3>🗺️ Campaign Map</h3>
          <p>Pick the next battle. Before each fight you get the <b>true history</b> behind it. Milestone battles (👑) are the famous ones — Thymbra's camels, the Euphrates at Babylon, Tomyris's revenge.</p>
          <h3>🏛️ War Council</h3>
          <p>Between battles, spend your <b>treasury</b> to recruit and reinforce units, and make a <b>decision</b> that shapes your gold, morale and renown — like a Crusader Kings ruler.</p>
          <h3>🎯 Battle — the heart of the game</h3>
          <p>Battles are turn-based. Each round you commit a <b>Battle Order</b>. Orders favour different units and <b>counter each other</b>:</p>
          <ul>
            <li><b>Spear Wall</b> crushes <b>Cavalry Charge</b> — but <b>Arrow Storm</b> shreds a static wall.</li>
            <li><b>Cavalry Charge</b> rides down <b>Arrow Storm</b> — but dies on a <b>Spear Wall</b>.</li>
            <li><b>Feigned Retreat</b> baits aggressive foes into a deadly counter.</li>
          </ul>
          <p>Match your <b>unit types</b> to the enemy too: infantry beat cavalry, cavalry beat archers, archers beat infantry. <b>Camels</b> terrify horses; <b>siege</b> cracks walls; <b>chariots</b> rule open plains.</p>
          <p>Watch both <b>morale</b> bars — when a side's morale breaks, it routs and the battle ends. Spend limited <b>special gambits</b> (Rally, Camel Gambit, River Diversion…) at the right moment to swing a fight.</p>
          <h3>💀 Defeat</h3>
          <p>Losing is not the end — you keep your veterans and may retry. But every soldier lost is one you must pay to replace.</p>
        </div>
        <button class="btn btn-gold" id="back">Back</button>
      </div>`;
    document.getElementById("back").onclick = () => this.renderTitle();
  },

  /* ---------- HUD (top bar shown on map & council) ---------- */
  hud() {
    const s = Game.state;
    const title = Game.currentTitle();
    return `
      <div class="hud">
        <div class="hud-left">
          <span class="hud-title">👑 ${esc(title.name)}</span>
          <span class="hud-perk">${esc(title.perk)}</span>
        </div>
        <div class="hud-right">
          <span class="hud-stat" title="Treasury">💰 ${s.gold}</span>
          <span class="hud-stat" title="Renown">✨ ${s.renown}</span>
          <span class="hud-stat" title="Total troops">⚔️ ${Game.totalTroops()}</span>
          <span class="hud-stat" title="Levels cleared">🏁 ${s.cleared}/100</span>
        </div>
      </div>`;
  },

  /* ---------- CAMPAIGN MAP ---------- */
  renderMap() {
    const s = Game.state;
    let chapters = "";
    for (const ch of D.CHAPTERS) {
      let nodes = "";
      for (let n = ch.range[0]; n <= ch.range[1]; n++) {
        const lvl = D.LEVELS[n - 1];
        const done = n <= s.cleared;
        const current = n === s.cleared + 1;
        const locked = n > s.cleared + 1;
        const cls = done ? "done" : current ? "current" : "locked";
        const mark = lvl.isFinal ? "☠️" : lvl.isBoss ? "👑" : done ? "✓" : n;
        nodes += `<button class="node ${cls}" data-n="${n}" ${locked ? "disabled" : ""}
                    title="${esc(lvl.title)}">${mark}</button>`;
      }
      const chDone = s.cleared >= ch.range[1];
      const chReached = s.cleared + 1 >= ch.range[0];
      chapters += `
        <div class="chapter ${chReached ? "" : "ch-locked"}" style="--ch:${ch.theme}">
          <div class="chapter-head">
            <span class="chapter-num">Chapter ${ch.id}</span>
            <span class="chapter-name">${esc(ch.name)}</span>
            <span class="chapter-foe">vs ${esc(ch.enemy)}</span>
            ${chDone ? '<span class="chapter-done">Conquered</span>' : ""}
          </div>
          <div class="nodes">${nodes}</div>
        </div>`;
    }
    app().innerHTML = `
      <div class="screen map-screen">
        ${this.hud()}
        <div class="map-actions">
          <button class="btn btn-small" id="btn-council">🏛️ War Council</button>
          <button class="btn btn-small btn-ghost" id="btn-codex">📜 Codex</button>
          <button class="btn btn-small btn-ghost" id="btn-menu">☰ Menu</button>
        </div>
        <h2 class="map-title">The Road of Conquest</h2>
        <div class="chapters">${chapters}</div>
      </div>`;

    document.querySelectorAll(".node").forEach(b => {
      if (!b.disabled) b.onclick = () => this.renderBriefing(parseInt(b.dataset.n, 10));
    });
    document.getElementById("btn-council").onclick = () => this.renderCouncil();
    document.getElementById("btn-codex").onclick = () => this.renderCodex(() => this.renderMap());
    document.getElementById("btn-menu").onclick = () => this.renderTitle();

    // Auto-scroll to the current chapter.
    const cur = document.querySelector(".node.current");
    if (cur) cur.scrollIntoView({ behavior: "smooth", block: "center" });
  },

  /* ---------- WAR COUNCIL (recruit + decision) ---------- */
  renderCouncil() {
    const s = Game.state;
    // Build recruit cards for unlocked + base units.
    const avail = ["spearmen", "archers", "cavalry"];
    for (const k of ["immortals", "cavalry", "horsearchers", "camels", "chariots", "siege"]) {
      if ((s.unlocked[k] || !D.UNITS[k].locked) && !avail.includes(k)) avail.push(k);
    }
    // horsearchers always available to recruit.
    if (!avail.includes("horsearchers")) avail.push("horsearchers");

    let cards = "";
    for (const k of avail) {
      const u = D.UNITS[k];
      const have = s.roster[k] ? s.roster[k].count : 0;
      const cost = Game.recruitCost(k);
      cards += `
        <div class="unit-card">
          <div class="unit-top"><span class="unit-icon">${u.icon}</span>
            <div><div class="unit-name">${esc(u.name)}</div>
            <div class="unit-role">${u.role}${u.elite ? " · elite" : ""} · have ${have}</div></div></div>
          <div class="unit-blurb">${esc(u.blurb)}</div>
          <div class="unit-buy">
            <span class="unit-cost">${cost}🪙 / 10</span>
            <button class="btn btn-tiny" data-buy="${k}" data-size="20">+20</button>
            <button class="btn btn-tiny" data-buy="${k}" data-size="50">+50</button>
          </div>
        </div>`;
    }

    // Decision of the council.
    if (!this.pendingDecision) {
      this.pendingDecision = D.DECISIONS[Math.floor(Math.random() * D.DECISIONS.length)];
    }
    const dec = this.pendingDecision;

    app().innerHTML = `
      <div class="screen council-screen">
        ${this.hud()}
        <h2 class="hdr">🏛️ The War Council</h2>
        <div class="council-grid">
          <div class="recruit-col">
            <h3>Raise & Reinforce</h3>
            <p class="muted">Spend treasury to muster troops before you march.</p>
            <div class="unit-cards">${cards}</div>
          </div>
          <div class="decision-col">
            <h3>A Matter for the King</h3>
            <div class="decision-card">
              <p class="decision-q">${esc(dec.q)}</p>
              ${dec.a.map((o, i) => `<button class="btn decision-btn" data-dec="${i}">${esc(o.t)}</button>`).join("")}
            </div>
            <div id="dec-result" class="dec-result"></div>
          </div>
        </div>
        <button class="btn btn-gold" id="to-map">To the Map →</button>
      </div>`;

    document.querySelectorAll("[data-buy]").forEach(b => {
      b.onclick = () => {
        const r = Game.recruit(b.dataset.buy, parseInt(b.dataset.size, 10));
        this.toast(r.msg, r.ok ? "good" : "bad");
        if (r.ok) this.renderCouncil();
      };
    });
    document.querySelectorAll("[data-dec]").forEach(b => {
      b.onclick = () => this.applyDecision(parseInt(b.dataset.dec, 10));
    });
    document.getElementById("to-map").onclick = () => { this.renderMap(); };
  },

  applyDecision(i) {
    const dec = this.pendingDecision;
    const o = dec.a[i];
    const s = Game.state;
    let msg = [];
    if (o.gold) { s.gold += o.gold; msg.push(`${o.gold > 0 ? "+" : ""}${o.gold} treasury`); }
    if (o.gold2) { s.gold += o.gold2; msg.push(`+${o.gold2} later gold arrives`); }
    if (o.renown) { s.renown += o.renown; msg.push(`${o.renown > 0 ? "+" : ""}${o.renown} renown`); }
    if (o.morale) { s.moraleBoost = (s.moraleBoost || 0) + o.morale; msg.push(`${o.morale > 0 ? "+" : ""}${o.morale} morale next battle`); }
    Game.save();
    this.pendingDecision = null;
    const res = document.getElementById("dec-result");
    if (res) res.innerHTML = `<div class="dec-done">Decided. ${esc(msg.join(", "))}.</div>`;
    // Refresh HUD numbers.
    setTimeout(() => {
      const hud = document.querySelector(".hud");
      if (hud) hud.outerHTML = this.hud();
    }, 50);
  },

  /* ---------- PRE-BATTLE BRIEFING ---------- */
  renderBriefing(n) {
    const lvl = D.LEVELS[n - 1];
    const t = D.TERRAIN[lvl.terrain];
    const cmd = D.getCommander(n);
    // first sentence = punchy hook; the rest is optional history.
    const firstDot = lvl.story.indexOf(". ");
    const hook = firstDot > 0 ? lvl.story.slice(0, firstDot + 1) : lvl.story;
    const rest = firstDot > 0 ? lvl.story.slice(firstDot + 1).trim() : "";
    let comp = Object.entries(lvl.enemyComp)
      .filter(([, c]) => c > 0)
      .map(([k, c]) => `${D.UNITS[k].icon} ~${c}`).join("  ");

    app().innerHTML = `
      <div class="screen briefing-screen" style="--ch:${lvl.chapterTheme}">
        <div class="briefing-card">
          <div class="brief-top">
            <span class="brief-chapter">Ch. ${lvl.chapter} · ${esc(lvl.chapterName)}</span>
            <span class="brief-num">Level ${n}/100 ${lvl.isBoss ? "👑 Boss" : ""}</span>
          </div>
          <h2 class="brief-title">${esc(lvl.title)}</h2>
          <div class="brief-meta">
            <span>${t.icon} ${t.name}${lvl.fort ? " · 🏰 Walls" : ""}</span>
            <span>📍 ${esc(lvl.loc)}</span>
            ${lvl.year ? `<span>🗓️ ${lvl.year} BCE</span>` : ""}
          </div>

          <div class="versus">
            <div class="vs-fighter player">
              <div class="portrait p">${D.HERO.avatar}</div>
              <div class="vs-name">${esc(D.HERO.name)}</div>
              <div class="vs-sub">${esc(D.HERO.epithet)}</div>
            </div>
            <div class="vs-mid">VS</div>
            <div class="vs-fighter enemy">
              <div class="portrait e">${cmd.avatar}</div>
              <div class="vs-name">${esc(cmd.name)}</div>
              <div class="vs-sub">${esc(lvl.enemyName)}</div>
            </div>
          </div>

          <p class="brief-hook">${esc(hook)}</p>
          <p class="enemy-cry">“${esc(cmd.cry)}”</p>

          <div class="brief-hosts">
            <div class="host-col"><span class="host-lbl">Your host</span><span class="host-line">${this.rosterLine()}</span></div>
            <div class="host-col"><span class="host-lbl">Enemy host</span><span class="host-line">${comp}</span></div>
          </div>
          ${lvl.forceAbility ? `<div class="brief-hint">💡 A special gambit is in your hand here: <b>${esc(D.ABILITIES[lvl.forceAbility].name)}</b></div>` : ""}

          ${rest ? `<details class="history-fold"><summary>📜 The history behind this battle</summary><p>${esc(rest)}</p></details>` : ""}

          <div class="brief-actions">
            <button class="btn btn-ghost" id="b-back">← Map</button>
            <button class="btn btn-ghost" id="b-council">🏛️ Council</button>
            <button class="btn btn-gold btn-charge" id="b-fight">⚔️ CHARGE INTO BATTLE</button>
          </div>
        </div>
      </div>`;
    document.getElementById("b-back").onclick = () => this.renderMap();
    document.getElementById("b-council").onclick = () => this.renderCouncil();
    document.getElementById("b-fight").onclick = () => this.startBattle(lvl);
  },

  rosterLine() {
    const s = Game.state;
    return Object.entries(s.roster).filter(([, u]) => u.count > 0)
      .map(([k, u]) => `${D.UNITS[k].icon} ${u.count}`).join("  ");
  },

  /* ---------- BATTLE (live animated) ---------- */
  startBattle(lvl) {
    const b = Battle.begin(lvl);
    b.bonusMorale = Game.state.moraleBoost || 0;
    Game.state.moraleBoost = 0; Game.save();
    this._battle = b;
    this._stance = "advance";
    this.renderBattle(lvl, b);
    // kick off the live simulation
    Field.start(lvl, b, (payload) => this.onBattleEnd(lvl, payload));
    this._startHudTicker();
  },

  renderBattle(lvl, b) {
    const stances = [
      { k: "charge",     ico: "🏇", n: "Charge" },
      { k: "shieldwall", ico: "🛡️", n: "Shield Wall" },
      { k: "volley",     ico: "🏹", n: "Volley" },
      { k: "flank",      ico: "🔄", n: "Flank" },
      { k: "advance",    ico: "⚔️", n: "Advance" }
    ];
    const stanceBtns = stances.map(s =>
      `<button class="stance-btn ${s.k === "advance" ? "active" : ""}" data-stance="${s.k}">
         <span class="st-ico">${s.ico}</span><span class="st-n">${s.n}</span></button>`).join("");

    const abBtns = Object.values(b.abilities).map(ab => {
      const disabled = ab.left <= 0 || (ab.gold && Game.state.gold < ab.gold);
      return `<button class="ability-btn" data-ab="${ab.key}" ${disabled ? "disabled" : ""} title="${esc(ab.desc)}">
                ${ab.icon} ${esc(ab.name)} <span class="ab-left">×${ab.left}</span>${ab.gold ? ` 💰${ab.gold}` : ""}
              </button>`;
    }).join("");

    app().innerHTML = `
      <div class="screen battle-screen" style="--ch:${lvl.chapterTheme}">
        <div class="battle-header">
          <span class="bh-title">${esc(lvl.title)}</span>
          <span class="bh-terr">${D.TERRAIN[lvl.terrain].icon} ${D.TERRAIN[lvl.terrain].name}${b.fort > 0 ? ` · 🏰` : ""}</span>
        </div>
        <div class="field-wrap">
          <div class="morale-strip">
            <span class="ms-label">⚜️ Cyrus</span>
            <div class="morale-track"><div class="morale-fill" id="pmor"></div></div>
            <span class="ms-mid">morale</span>
            <div class="morale-track rev"><div class="morale-fill enemy" id="emor"></div></div>
            <span class="ms-label e">${esc(D.getCommander(lvl.n).avatar)} Foe</span>
          </div>
          <canvas id="field"></canvas>
          <div class="field-counts"><span id="pcount">⚜️ —</span><span id="ecount">— 🦁</span></div>
        </div>
        <div class="battle-controls">
          <div class="abilities-row">${abBtns || '<span class="muted">No special gambits here.</span>'}</div>
          <div class="orders-label">Command your army — tap to change their tactics live:</div>
          <div class="stance-row">${stanceBtns}</div>
        </div>
      </div>`;

    document.querySelectorAll("[data-stance]").forEach(btn => {
      btn.onclick = () => {
        Field.setStance(btn.dataset.stance);
        document.querySelectorAll(".stance-btn").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
      };
    });
    document.querySelectorAll("[data-ab]").forEach(btn => {
      btn.onclick = () => {
        const r = Field.fireAbility(btn.dataset.ab, b);
        if (r.ok) { this.toast(`${r.name}!`, "good"); btn.querySelector(".ab-left").textContent = "×" + b.abilities[btn.dataset.ab].left;
          if (b.abilities[btn.dataset.ab].left <= 0) btn.disabled = true; }
        else this.toast(r.msg || "Cannot use that now.", "bad");
      };
    });
  },

  _startHudTicker() {
    clearInterval(this._hud);
    this._hud = setInterval(() => {
      if (!Field.active || Field.active.ended) { clearInterval(this._hud); return; }
      const a = Field.active;
      const pm = document.getElementById("pmor"), em = document.getElementById("emor");
      if (!pm) { clearInterval(this._hud); return; }
      const pMor = Math.max(0, Math.min(100, (a.pMorale / 150) * 100));
      const eMor = Math.max(0, Math.min(100, (a.eMorale / 150) * 100));
      pm.style.width = pMor + "%"; pm.style.background = a.pMorale > 70 ? "#4caf50" : a.pMorale > 35 ? "#e0a92b" : "#c0392b";
      em.style.width = eMor + "%"; em.style.background = a.eMorale > 70 ? "#4caf50" : a.eMorale > 35 ? "#e0a92b" : "#c0392b";
      const pc = Field._alive("p").length, ec = Field._alive("e").length;
      document.getElementById("pcount").textContent = `⚜️ ${pc} standing`;
      document.getElementById("ecount").textContent = `${ec} standing 🦁`;
    }, 120);
  },

  onBattleEnd(lvl, payload) {
    clearInterval(this._hud);
    const survivors = payload.survivors;
    // merge in any roster units that weren't in this fight (count 0 etc.)
    for (const [k, u] of Object.entries(Game.state.roster)) if (!survivors[k]) survivors[k] = { count: u.count, vet: u.vet };
    const startTroops = this._battle.pStart;
    const lost = Math.max(0, startTroops - Object.values(survivors).reduce((s, u) => s + u.count, 0));
    Game.state.stats.troopsLost += lost;

    if (payload.won) {
      const res = { flawless: lost < startTroops * 0.18 };
      const gold = Game.winLevel(lvl, survivors, res);
      if (lvl.isFinal) return this.renderEnding();
      this.renderVictory(lvl, { won: true, lost, flawless: res.flawless }, gold);
    } else {
      Game.loseLevel(survivors);
      this.renderDefeat(lvl);
    }
  },

  renderVictory(lvl, res, gold) {
    const newTitle = Game.currentTitle();
    const codexEntry = lvl.codex ? D.CODEX[lvl.codex] : null;
    app().innerHTML = `
      <div class="screen result-screen victory" style="--ch:${lvl.chapterTheme}">
        <div class="result-card">
          <div class="result-banner">🏆 VICTORY</div>
          <h2>${esc(lvl.title)}</h2>
          <p class="result-flavor">${res.flawless ? "A flawless field — the bards will sing of it." : "The enemy is broken and scattered."}</p>
          <div class="result-rewards">
            <span>💰 +${gold} treasury</span>
            <span>✨ +${lvl.reward.renown} renown</span>
            <span>🩸 ${res.lost} fallen</span>
          </div>
          ${codexEntry ? `<div class="codex-unlock"><b>📜 Codex unlocked:</b> ${esc(codexEntry.title)}<br><span class="muted">${esc(codexEntry.text)}</span></div>` : ""}
          ${this.titleCheck(lvl)}
          <button class="btn btn-gold" id="r-next">${lvl.n >= 100 ? "Finish" : "Onward →"}</button>
          <button class="btn btn-ghost" id="r-map">Campaign Map</button>
        </div>
      </div>`;
    document.getElementById("r-next").onclick = () => {
      this.pendingDecision = null;
      this.renderCouncil();   // go to council between battles, CK-style
    };
    document.getElementById("r-map").onclick = () => this.renderMap();
  },

  titleCheck(lvl) {
    // Show a title-gain banner if this level crossed a title threshold.
    const t = D.TITLES.find(x => x.atLevel === lvl.n + 1);
    if (t) return `<div class="title-gain">👑 You are now <b>${esc(t.name)}</b> — ${esc(t.perk)}</div>`;
    return "";
  },

  renderDefeat(lvl) {
    app().innerHTML = `
      <div class="screen result-screen defeat" style="--ch:${lvl.chapterTheme}">
        <div class="result-card">
          <div class="result-banner bad">💀 DEFEAT</div>
          <h2>${esc(lvl.title)}</h2>
          <p class="result-flavor">Your line broke — but a king learns more from a lost field than a won one. Regroup, reinforce, and return. Your veterans remember.</p>
          <div class="result-rewards"><span class="muted">Survivors have rejoined the host. Visit the War Council to rebuild.</span></div>
          <button class="btn btn-gold" id="d-retry">⚔️ Try Again</button>
          <button class="btn" id="d-council">🏛️ War Council</button>
          <button class="btn btn-ghost" id="d-map">Campaign Map</button>
        </div>
      </div>`;
    document.getElementById("d-retry").onclick = () => this.renderBriefing(lvl.n);
    document.getElementById("d-council").onclick = () => this.renderCouncil();
    document.getElementById("d-map").onclick = () => this.renderMap();
  },

  /* ---------- CODEX ---------- */
  renderCodex(back) {
    const s = Game.state;
    const entries = Object.entries(D.CODEX).map(([k, e]) => {
      const unlocked = s.codex[k] || k === "cyrus";
      return `<div class="codex-entry ${unlocked ? "" : "locked"}">
          <h3>${unlocked ? "📜" : "🔒"} ${esc(e.title)}</h3>
          <p>${unlocked ? esc(e.text) : "Unlock this entry by reaching the battle it describes."}</p>
        </div>`;
    }).join("");
    app().innerHTML = `
      <div class="screen panel-screen">
        <h2 class="hdr">📜 Historical Codex</h2>
        <p class="muted center">Win milestone battles to unlock the true history behind them.</p>
        <div class="codex-list">${entries}</div>
        <button class="btn btn-gold" id="c-back">Back</button>
      </div>`;
    document.getElementById("c-back").onclick = back;
  },

  /* ---------- ENDING ---------- */
  renderEnding() {
    const s = Game.state;
    app().innerHTML = `
      <div class="screen ending-screen">
        <div class="faravahar">𐎠</div>
        <h1 class="game-title">THE FILL OF BLOOD</h1>
        <div class="ending-text">
          <p>On the field beyond the Jaxartes, in the most violent battle the ancient world remembered, the conqueror of Asia met the end that history had written for him. Queen Tomyris of the Massagetae, avenging her son, is said to have found Cyrus's body among the slain and plunged his head into a skin filled with blood:</p>
          <p class="ending-quote">"You thirsted for blood, Cyrus — now drink your fill."</p>
          <p>So died Cyrus the Great, around 530 BCE, after thirty years of conquest. They carried him home to Pasargadae, to the simple stone tomb that still stands today, and on it, the tradition says, were carved the words:</p>
          <p class="ending-quote">"O man, I am Cyrus, who won the Persians their empire. Do not grudge me this little earth that covers my body."</p>
          <p>His empire — the largest the world had yet seen, stretching from the Aegean to the Indus — outlived him by two centuries, until another conqueror came east. But the idea he left behind, of a king who ruled many peoples by tolerance rather than terror, outlived even that.</p>
        </div>
        <div class="ending-stats">
          <span>🏆 Battles won: ${s.stats.battlesWon}</span>
          <span>✨ Renown: ${s.renown}</span>
          <span>🩸 Troops lost: ${s.stats.troopsLost}</span>
        </div>
        <p class="ending-congrats">You have completed all 100 levels and lived the whole arc of Cyrus the Great. 𐎠</p>
        <div class="menu-btns">
          <button class="btn btn-gold" id="e-codex">📜 Read the Full Codex</button>
          <button class="btn" id="e-new">Begin Anew</button>
        </div>
      </div>`;
    document.getElementById("e-codex").onclick = () => this.renderCodex(() => this.renderEnding());
    document.getElementById("e-new").onclick = () => { Game.reset(); this.renderTitle(); };
  },

  /* ---------- toast ---------- */
  toast(msg, kind = "good") {
    if (!msg) return;
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.className = `toast ${kind} show`;
    t.textContent = msg;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { t.className = "toast"; }, 2200);
  }
};

window.addEventListener("DOMContentLoaded", () => UI.init());
window.UI = UI;
