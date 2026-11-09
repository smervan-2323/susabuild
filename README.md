# 👑 Cyrus: Lord of the Four Corners

An ancient-world **grand-strategy battle game** in the spirit of *Crusader Kings* — dynasty titles,
a treasury, an army you build up over time, diplomacy decisions between fights, and a historical
codex — wrapped around a genuinely strategic, turn-based tactical battle system.

Play through **100 levels across 8 chapters** that follow the **real conquests of Cyrus the Great**
(c. 559–530 BCE), from a Persian prince in Anshan to King of the Four Corners of the World.

It runs entirely in the browser. No build step, no dependencies — just open `index.html`.

---

## ▶️ How to play

Open **`index.html`** in any modern browser (desktop or mobile). Your progress saves automatically
to the browser via `localStorage`, so you can close the tab and pick up where you left off.

> You can also serve it locally if you prefer:
> ```bash
> python3 -m http.server 8000   # then visit http://localhost:8000
> ```

---

## 🏛️ The game

### Crusader-Kings-style layer
- **Titles** — accumulate honours as you conquer (Prince of Anshan → King of Persia → King of the
  Medes → Conqueror of Lydia → … → **King of the Four Corners**), each granting a passive perk.
- **Treasury & Renown** — gold funds your armies; renown is your legend.
- **The War Council** — between battles, spend treasury to **recruit and reinforce** units, and make
  a **ruler's decision** (tribute, omens, tolerance, spoils) that shifts your gold, morale and renown.
- **Army roster with veterancy** — the troops that survive a battle gain experience and fight harder.

### The battle system (the heart of it)
Battles are **turn-based**. Each round you commit a **Battle Order**, and the orders counter each other:

| If you order… | It beats… | …but loses to |
|---|---|---|
| 🛡️ Spear Wall | Cavalry Charge | Arrow Storm |
| 🏹 Arrow Storm | Spear Wall / Shield Advance | Cavalry Charge |
| 🏇 Cavalry Charge | Arrow Storm / Flanking | Spear Wall / Feigned Retreat |
| 🏃 Feigned Retreat | aggressive charges | Arrow Storm / Hold |
| 🔄 Flanking Maneuver | dug-in / holding foes | Cavalry Charge |

On top of that, **unit types** follow rock-paper-scissors — infantry beat cavalry, cavalry beat
archers, archers beat infantry — and **terrain** matters (cavalry and chariots dominate open plains
but flounder in mountains and sieges). **Camels terrify horses**, **siege engines crack walls**, and
**scythed chariots** carve through packed infantry.

Watch both **morale** bars: when a side's morale breaks, it routs and the battle ends. Spend limited
**special gambits** at the right moment to swing a fight:
- 📯 **Rally the Troops** · 🐪 **Camel Gambit** · 🛞 **Scythed Charge** · 🌙 **Night Assault**
- 🌊 **Divert the River** (the Euphrates at Babylon) · 💰 **Bribe the Garrison**

Defeat isn't the end — you keep your veterans and can regroup and try again.

---

## 📜 The history (and where the game follows it)

Every chapter traces real events. The **milestone battles (👑)** carry the true backstory and unlock
a **Historical Codex** entry drawn from the classical sources.

| Ch. | Levels | Campaign | Real events featured |
|----|--------|----------|----------------------|
| I | 1–10 | The Rise in Persia | Astyages' dream; uniting the ten Persian tribes at Pasargadae |
| II | 11–22 | War with Media | The revolt; **Battle of Hyrba**; the **treason of Harpagus**; the **fall of Ecbatana** and capture of Astyages |
| III | 23–38 | The Lydian War | Croesus and the oracle; **Battle of Pteria**; the **camels of Thymbra**; the **siege of Sardis** |
| IV | 39–52 | The Ionian Conquest | Harpagus' siege-mounds; **Phocaea**; the last stand of **Xanthos** |
| V | 53–66 | The Eastern Satrapies | Parthia, **Bactria**, Sogdiana; founding Cyropolis on the Jaxartes |
| VI | 67–82 | The Fall of Babylon | **Battle of Opis**; **diverting the Euphrates**; the **Cyrus Cylinder** and the freeing of the exiles |
| VII | 83–95 | Empire of the Four Corners | Holding the empire; the satraps' revolt; building **Pasargadae** |
| VIII | 96–100 | The Final Campaign | The **Massagetae**, Queen **Tomyris**, and Cyrus's last battle |

> Historical content is drawn from Herodotus, Xenophon's *Cyropaedia*, the Nabonidus Chronicle and
> the Cyrus Cylinder. The sources often disagree on detail; the game follows the best-known traditions
> and flags the famous set-pieces. Years are BCE.

---

## 🗂️ Project structure

```
index.html        Entry point — loads the three scripts
css/style.css     Achaemenid-themed styling (lapis, royal red, Persian gold)
js/data.js        Historical content: units, orders, terrain, titles, codex,
                  the 8 chapters and the 100-level generator
js/engine.js      Game state, save/load, recruitment, and the battle resolver
js/ui.js          All screens and player interaction
```

The code is plain, dependency-free ES (classic scripts) — easy to read and extend. Want to add a
unit? Add it to `UNITS` in `data.js`. A new tactic? Extend `ORDERS` and `ORDER_COUNTER`. A new
historical battle? Add a `MILESTONES` entry keyed to its level number.

---

## ✅ Tested

The build is smoke-tested headlessly (Playwright): the full flow — title → map → War Council →
briefing → a complete battle → victory/defeat → the level-100 ending — runs with **zero console
errors**, and the late-game unit unlocks, the Euphrates-diversion milestone and the Tomyris finale
all fire correctly.

Enjoy the conquest. 𐎠
