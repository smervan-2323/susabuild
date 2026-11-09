/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   hero.js  —  A hand-built, fully animated SVG portrait of Cyrus the Great
               (Achaemenid king: fluted crown, royal robe, the Faravahar,
                swaying cape, flickering braziers, Persepolis columns).
   Self-contained: the <style> lives inside the SVG, so dropping this markup
   into any element animates it. Exposed as window.CYRUS_SVG + helpers.
   ========================================================================= */
(function () {
  // Build the row-of-curls beard characteristic of Persian reliefs.
  function beardCurls() {
    let s = "";
    const rows = [
      { y: 250, n: 7, r: 7.5, x0: 207 },
      { y: 263, n: 8, r: 7.5, x0: 203 },
      { y: 276, n: 7, r: 7,   x0: 207 },
      { y: 288, n: 6, r: 6.5, x0: 211 },
      { y: 299, n: 5, r: 6,   x0: 215 },
      { y: 309, n: 4, r: 5.5, x0: 219 }
    ];
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const cx = row.x0 + i * (row.r * 2 + 1);
        s += `<circle cx="${cx}" cy="${row.y}" r="${row.r}" fill="#2e2016"/>`;
        s += `<circle cx="${cx - 1.5}" cy="${row.y - 1.5}" r="${row.r * 0.5}" fill="#4a3522"/>`;
      }
    }
    return s;
  }

  // Vertical flutes for a column shaft.
  function flutes(x, w, top, bot, color) {
    let s = "";
    for (let fx = x + 3; fx < x + w - 2; fx += 6) s += `<line x1="${fx}" y1="${top}" x2="${fx}" y2="${bot}" stroke="${color}" stroke-width="1.4" opacity=".5"/>`;
    return s;
  }

  const CYRUS_SVG = `
<svg class="cyrus-svg" viewBox="0 0 480 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated portrait of Cyrus the Great">
  <defs>
    <linearGradient id="cy-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17233f"/><stop offset=".55" stop-color="#3a2f52"/><stop offset="1" stop-color="#8a5a3a"/>
    </linearGradient>
    <radialGradient id="cy-halo" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset=".5" stop-color="#e0b64b" stop-opacity=".45"/><stop offset="1" stop-color="#e0b64b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cy-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#e0b64b"/><stop offset="1" stop-color="#9c7016"/>
    </linearGradient>
    <linearGradient id="cy-robe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9c2f27"/><stop offset="1" stop-color="#5e1813"/>
    </linearGradient>
    <linearGradient id="cy-cape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a2a7a"/><stop offset="1" stop-color="#2e1546"/>
    </linearGradient>
    <linearGradient id="cy-flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ffcf4a"/><stop offset=".6" stop-color="#ff7a1e"/><stop offset="1" stop-color="#ff3d1e"/>
    </linearGradient>
    <filter id="cy-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    <style>
      .cyrus-svg *{transform-box:fill-box;}
      .cy-breathe{animation:cyBreathe 4.2s ease-in-out infinite;transform-origin:50% 100%;}
      .cy-cape{animation:cyCape 5.5s ease-in-out infinite;transform-origin:50% 0%;}
      .cy-wingL{animation:cyWingL 4s ease-in-out infinite;transform-origin:100% 50%;}
      .cy-wingR{animation:cyWingR 4s ease-in-out infinite;transform-origin:0% 50%;}
      .cy-halo{animation:cyHalo 6s ease-in-out infinite;transform-origin:50% 50%;}
      .cy-star{animation:cyTwinkle 3s ease-in-out infinite;}
      .cy-star:nth-child(2n){animation-delay:1s;} .cy-star:nth-child(3n){animation-delay:2s;}
      .cy-lid{animation:cyBlink 5.5s infinite;transform-origin:50% 0%;}
      .cy-flame{animation:cyFlame .5s ease-in-out infinite alternate;transform-origin:50% 100%;}
      .cy-flame.r{animation-delay:.25s;}
      .cy-mote{animation:cyMote 7s linear infinite;}
      .cy-mote:nth-child(2n){animation-delay:2.5s;} .cy-mote:nth-child(3n){animation-delay:4.5s;}
      .cy-arm{transform-origin:86% 8%;transition:transform .35s cubic-bezier(.4,1.6,.5,1);}
      .cyrus-svg.cry .cy-arm{transform:rotate(-58deg);}
      .cyrus-svg.cry .cy-flash{animation:cyFlash .6s ease-out;}
      @keyframes cyBreathe{0%,100%{transform:translateY(0) scaleY(1);}50%{transform:translateY(-3px) scaleY(1.012);}}
      @keyframes cyCape{0%,100%{transform:rotate(-2.2deg) skewX(2deg);}50%{transform:rotate(2.4deg) skewX(-2deg);}}
      @keyframes cyWingL{0%,100%{transform:rotate(3deg);}50%{transform:rotate(-5deg);}}
      @keyframes cyWingR{0%,100%{transform:rotate(-3deg);}50%{transform:rotate(5deg);}}
      @keyframes cyHalo{0%,100%{transform:scale(1);opacity:.85;}50%{transform:scale(1.08);opacity:1;}}
      @keyframes cyTwinkle{0%,100%{opacity:.25;}50%{opacity:1;}}
      @keyframes cyBlink{0%,92%,100%{transform:scaleY(0);}95%,97%{transform:scaleY(1);}}
      @keyframes cyFlame{0%{transform:scaleY(.86) scaleX(1.05);}100%{transform:scaleY(1.12) scaleX(.94);}}
      @keyframes cyMote{0%{transform:translateY(0);opacity:0;}15%{opacity:.8;}100%{transform:translateY(-220px);opacity:0;}}
      @keyframes cyFlash{0%{opacity:.32;}100%{opacity:0;}}
      @media (prefers-reduced-motion: reduce){ .cyrus-svg *{animation:none!important;} }
    </style>
  </defs>

  <!-- sky -->
  <rect width="480" height="640" fill="url(#cy-sky)"/>
  <g>
    <circle class="cy-star" cx="60" cy="70" r="2" fill="#fff"/><circle class="cy-star" cx="120" cy="40" r="1.5" fill="#fff"/>
    <circle class="cy-star" cx="200" cy="60" r="1.6" fill="#ffe9a8"/><circle class="cy-star" cx="300" cy="44" r="2" fill="#fff"/>
    <circle class="cy-star" cx="380" cy="80" r="1.5" fill="#fff"/><circle class="cy-star" cx="430" cy="50" r="2" fill="#ffe9a8"/>
    <circle class="cy-star" cx="150" cy="100" r="1.4" fill="#fff"/><circle class="cy-star" cx="350" cy="110" r="1.4" fill="#fff"/>
  </g>

  <!-- halo behind head -->
  <circle class="cy-halo" cx="240" cy="210" r="150" fill="url(#cy-halo)"/>

  <!-- Persepolis columns framing -->
  <g opacity=".92">
    <g>
      <rect x="18" y="150" width="34" height="400" fill="#b89a5a"/>${flutes(18, 34, 150, 550, "#7a5f2a")}
      <rect x="10" y="120" width="50" height="30" rx="4" fill="url(#cy-gold)"/>
      <path d="M12 150 q10 -16 23 -8 q13 -8 23 8 Z" fill="#d8b45a"/>
      <rect x="12" y="545" width="46" height="18" fill="url(#cy-gold)"/>
    </g>
    <g>
      <rect x="428" y="150" width="34" height="400" fill="#b89a5a"/>${flutes(428, 34, 150, 550, "#7a5f2a")}
      <rect x="420" y="120" width="50" height="30" rx="4" fill="url(#cy-gold)"/>
      <path d="M422 150 q10 -16 23 -8 q13 -8 23 8 Z" fill="#d8b45a"/>
      <rect x="422" y="545" width="46" height="18" fill="url(#cy-gold)"/>
    </g>
  </g>

  <!-- Faravahar (winged sun disc) -->
  <g transform="translate(240,96)">
    <g class="cy-wingL">
      <path d="M0 0 L-110 -6 Q-60 2 -108 10 Q-58 12 -100 22 Q-52 22 -90 32 Q-46 32 0 24 Z" fill="url(#cy-gold)"/>
    </g>
    <g class="cy-wingR">
      <path d="M0 0 L110 -6 Q60 2 108 10 Q58 12 100 22 Q52 22 90 32 Q46 32 0 24 Z" fill="url(#cy-gold)"/>
    </g>
    <circle cx="0" cy="8" r="17" fill="url(#cy-gold)" stroke="#7a5713" stroke-width="2"/>
    <circle cx="0" cy="8" r="7" fill="#7a1f18"/>
    <path d="M-30 30 q-14 20 -6 40 M30 30 q14 20 6 40 M0 32 l0 46" stroke="url(#cy-gold)" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g>

  <!-- CAPE (behind king) -->
  <g class="cy-cape">
    <path d="M240 250 C150 300 150 470 165 560 L240 540 L315 560 C330 470 330 300 240 250 Z" fill="url(#cy-cape)"/>
    <path d="M240 255 C190 295 185 470 200 545 L240 535 Z" fill="#6a3a8a" opacity=".5"/>
  </g>

  <!-- KING (breathing group) -->
  <g class="cy-breathe">
    <!-- robe -->
    <path d="M240 300 C300 320 320 360 322 420 L332 560 L148 560 L158 420 C160 360 180 320 240 300 Z" fill="url(#cy-robe)"/>
    <!-- central pleat + rosettes -->
    <path d="M240 300 L240 560" stroke="#c88" stroke-width="2" opacity=".4"/>
    <g fill="#e0b64b" opacity=".85">
      <circle cx="240" cy="360" r="4"/><circle cx="240" cy="392" r="4"/><circle cx="240" cy="424" r="4"/><circle cx="240" cy="456" r="4"/><circle cx="240" cy="488" r="4"/>
      <circle cx="210" cy="520" r="3.5"/><circle cx="270" cy="520" r="3.5"/>
    </g>
    <!-- gold hem -->
    <rect x="148" y="548" width="184" height="14" fill="url(#cy-gold)"/>
    <path d="M158 420 L322 420" stroke="url(#cy-gold)" stroke-width="5"/>

    <!-- left arm holding royal scepter -->
    <path d="M176 330 C150 360 150 420 160 470 L182 464 C176 420 178 372 196 346 Z" fill="url(#cy-robe)"/>
    <g>
      <rect x="150" y="250" width="7" height="300" rx="3" fill="url(#cy-gold)"/>
      <path d="M153 250 q-14 -6 -8 -22 q10 10 24 0 q6 16 -8 22 Z" fill="#e0b64b" stroke="#7a5713"/>
      <circle cx="153.5" cy="238" r="6" fill="#7a1f18" stroke="#e0b64b"/>
    </g>
    <ellipse cx="162" cy="470" rx="11" ry="9" fill="#d8a36a"/>

    <!-- right arm (raises on battle-cry) holding a sword -->
    <g class="cy-arm">
      <path d="M304 330 C332 356 338 410 330 456 L308 450 C314 410 308 364 288 342 Z" fill="url(#cy-robe)"/>
      <ellipse cx="322" cy="452" rx="11" ry="9" fill="#d8a36a"/>
      <g transform="translate(322,452)">
        <rect x="-3" y="-66" width="6" height="60" rx="2" fill="#dfe6ee"/>
        <rect x="-3" y="-72" width="6" height="8" fill="#e0b64b"/>
        <rect x="-12" y="-8" width="24" height="6" rx="2" fill="#e0b64b"/>
        <rect x="-4" y="-2" width="8" height="12" rx="2" fill="#7a5713"/>
      </g>
    </g>

    <!-- broad jeweled collar -->
    <path d="M205 300 Q240 326 275 300 L272 318 Q240 340 208 318 Z" fill="url(#cy-gold)"/>
    <g fill="#2a5a8c"><circle cx="222" cy="312" r="3"/><circle cx="240" cy="318" r="3.4"/><circle cx="258" cy="312" r="3"/></g>

    <!-- neck + head -->
    <rect x="228" y="286" width="24" height="26" rx="6" fill="#c89458"/>
    <ellipse cx="240" cy="226" rx="40" ry="46" fill="#d8a36a"/>
    <!-- side hair curls -->
    <g fill="#2e2016">
      <circle cx="202" cy="212" r="9"/><circle cx="200" cy="228" r="9"/><circle cx="202" cy="244" r="8"/>
      <circle cx="278" cy="212" r="9"/><circle cx="280" cy="228" r="9"/><circle cx="278" cy="244" r="8"/>
    </g>
    <!-- brows + eyes -->
    <path d="M214 214 q10 -7 22 0 M244 214 q10 -7 22 0" stroke="#2e2016" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <g>
      <ellipse cx="225" cy="224" rx="7" ry="4.6" fill="#fff"/><circle cx="225" cy="224" r="3.2" fill="#3a2a16"/>
      <ellipse cx="255" cy="224" rx="7" ry="4.6" fill="#fff"/><circle cx="255" cy="224" r="3.2" fill="#3a2a16"/>
      <rect class="cy-lid" x="218" y="219.4" width="14" height="5" rx="2" fill="#d8a36a"/>
      <rect class="cy-lid" x="248" y="219.4" width="14" height="5" rx="2" fill="#d8a36a"/>
    </g>
    <!-- nose + mustache + mouth -->
    <path d="M240 228 l-4 16 q4 4 8 0 Z" fill="#c08b4e"/>
    <path d="M222 250 q18 -10 36 0 q-18 6 -36 0 Z" fill="#2e2016"/>
    <!-- the great square curled beard -->
    ${beardCurls()}

    <!-- fluted Achaemenid crown -->
    <g>
      <rect x="198" y="150" width="84" height="40" rx="4" fill="url(#cy-gold)" stroke="#7a5713" stroke-width="2"/>
      ${flutes(198, 84, 152, 188, "#9c7016")}
      <!-- crenellated top -->
      <g fill="url(#cy-gold)" stroke="#7a5713" stroke-width="1.5">
        <rect x="200" y="138" width="14" height="14"/><rect x="220" y="138" width="14" height="14"/>
        <rect x="240" y="138" width="14" height="14"/><rect x="260" y="138" width="14" height="14"/>
      </g>
      <!-- jeweled band -->
      <rect x="198" y="186" width="84" height="9" fill="#7a1f18"/>
      <g fill="#e0b64b"><circle cx="214" cy="190.5" r="3"/><circle cx="240" cy="190.5" r="3.6"/><circle cx="266" cy="190.5" r="3"/></g>
      <!-- central sun jewel -->
      <circle cx="240" cy="168" r="8" fill="#2a5a8c" stroke="#e0b64b" stroke-width="2"/>
      <path d="M240 156 l2 6 h-4 Z M240 180 l2 -6 h-4 Z M228 168 l6 2 v-4 Z M252 168 l-6 2 v-4 Z" fill="#ffe9a8"/>
    </g>
  </g>

  <!-- battle-cry flash (soft golden glow, not a white-out) -->
  <rect class="cy-flash" x="0" y="0" width="480" height="640" fill="url(#cy-halo)" opacity="0" pointer-events="none"/>

  <!-- dais steps -->
  <g>
    <rect x="70" y="560" width="340" height="22" fill="#9c824c"/>
    <rect x="40" y="582" width="400" height="24" fill="#86703f"/>
    <rect x="10" y="606" width="460" height="34" fill="#6e5a34"/>
  </g>

  <!-- braziers -->
  <g>
    <rect x="96" y="512" width="12" height="40" fill="#6e5a34"/><ellipse cx="102" cy="512" rx="18" ry="7" fill="#4a3a20"/>
    <g class="cy-flame"><path d="M102 512 C90 498 94 484 102 470 C110 484 114 498 102 512 Z" fill="url(#cy-flame)"/></g>
    <rect x="372" y="512" width="12" height="40" fill="#6e5a34"/><ellipse cx="378" cy="512" rx="18" ry="7" fill="#4a3a20"/>
    <g class="cy-flame r"><path d="M378 512 C366 498 370 484 378 470 C386 484 390 498 378 512 Z" fill="url(#cy-flame)"/></g>
  </g>

  <!-- rising dust motes -->
  <g fill="#ffe9a8" opacity=".6">
    <circle class="cy-mote" cx="130" cy="540" r="2"/><circle class="cy-mote" cx="350" cy="548" r="2"/>
    <circle class="cy-mote" cx="200" cy="560" r="1.6"/><circle class="cy-mote" cx="300" cy="556" r="1.6"/>
    <circle class="cy-mote" cx="240" cy="552" r="1.8"/>
  </g>
</svg>`;

  // Trigger the one-shot "battle cry": raise the sword and flash.
  function cyrusCry(root) {
    const svg = root ? root.querySelector(".cyrus-svg") : document.querySelector(".cyrus-svg");
    if (!svg) return;
    svg.classList.remove("cry"); void svg.offsetWidth; svg.classList.add("cry");
    clearTimeout(svg._cryT);
    svg._cryT = setTimeout(() => svg.classList.remove("cry"), 1600);
  }

  window.CYRUS_SVG = CYRUS_SVG;
  window.cyrusCry = cyrusCry;
})();
