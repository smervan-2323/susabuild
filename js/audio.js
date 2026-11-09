/* =========================================================================
   CYRUS: LORD OF THE FOUR CORNERS
   audio.js  —  All battle sound, synthesized live with the Web Audio API.
   No audio files: war horns, clashing steel, arrow volleys, drums, panic,
   victory fanfares and more are generated from oscillators and noise.
   Exposed as window.SFX. Safe to call before init (it lazy-starts on a gesture).
   ========================================================================= */
(function () {
  const SFX = {
    ctx: null, master: null, enabled: true, _noiseBuf: null,

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.0001;
        this.master.connect(this.ctx.destination);
        // gentle fade-in of the master so the first sound isn't a click
        this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0.0001, this.ctx.currentTime, 0.05);
        // pre-build a noise buffer
        const n = this.ctx.sampleRate * 1.0;
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this._noiseBuf = buf;
      } catch (e) { this.ctx = null; }
      try { const v = localStorage.getItem("cyrus_sfx"); if (v === "0") this.enabled = false; } catch (e) {}
    },
    resume() { this.init(); if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
    setEnabled(v) {
      this.enabled = v;
      if (this.master) this.master.gain.setTargetAtTime(v ? 0.5 : 0.0001, this.ctx.currentTime, 0.03);
      try { localStorage.setItem("cyrus_sfx", v ? "1" : "0"); } catch (e) {}
    },
    _ok() { if (!this.ctx) this.init(); return this.ctx && this.enabled; },
    _now() { return this.ctx.currentTime; },

    // one oscillator note with an envelope
    _tone(freq, t0, dur, type, peak, glideTo) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || "sawtooth"; o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.04, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    // filtered noise burst
    _noise(t0, dur, type, freq, q, peak) {
      const s = this.ctx.createBufferSource(); s.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(peak, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + dur + 0.02);
      return f;
    },

    /* ---- the battle library ---- */
    horn() { if (!this._ok()) return; const t = this._now();
      this._tone(174, t, 0.7, "sawtooth", 0.16, 196);
      this._tone(261, t + 0.02, 0.7, "sawtooth", 0.1, 294);
      this._tone(130, t, 0.8, "triangle", 0.08); },
    charge() { if (!this._ok()) return; const t = this._now();
      this.horn();
      for (let i = 0; i < 4; i++) this._tone(80, t + i * 0.12, 0.14, "sine", 0.22, 52); },
    clash() { if (!this._ok()) return; const t = this._now();
      this._noise(t, 0.09, "highpass", 2600, 0, 0.14);
      this._tone(380 + Math.random() * 300, t, 0.07, "square", 0.05, 180); },
    arrow() { if (!this._ok()) return; const t = this._now();
      const f = this._noise(t, 0.22, "bandpass", 1800, 6, 0.12);
      f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.22); },
    drum() { if (!this._ok()) return; const t = this._now(); this._tone(70, t, 0.18, "sine", 0.3, 44); },
    panic() { if (!this._ok()) return; const t = this._now();
      this._tone(500, t, 0.5, "sawtooth", 0.14, 120);
      this._noise(t, 0.5, "lowpass", 900, 0, 0.1); },
    rally() { if (!this._ok()) return; const t = this._now();
      [392, 523, 659].forEach((f, i) => this._tone(f, t + i * 0.09, 0.3, "triangle", 0.14)); this.horn(); },
    water() { if (!this._ok()) return; const t = this._now();
      const f = this._noise(t, 0.9, "lowpass", 500, 0, 0.14); f.frequency.exponentialRampToValueAtTime(120, t + 0.9); },
    thud() { if (!this._ok()) return; const t = this._now();
      this._tone(96, t, 0.26, "sine", 0.32, 38); this._noise(t, 0.16, "lowpass", 400, 0, 0.14); },
    victory() { if (!this._ok()) return; const t = this._now();
      [523, 659, 784, 1046].forEach((f, i) => this._tone(f, t + i * 0.13, 0.5, "triangle", 0.16));
      this._tone(261, t, 1.0, "sawtooth", 0.1, 392); this.drum(); },
    defeat() { if (!this._ok()) return; const t = this._now();
      [392, 349, 294, 233].forEach((f, i) => this._tone(f, t + i * 0.18, 0.6, "triangle", 0.14));
      this._tone(110, t, 1.2, "sawtooth", 0.1, 82); },
    cry() { if (!this._ok()) return; const t = this._now();
      this._tone(220, t, 0.5, "sawtooth", 0.18, 330); this._tone(330, t + 0.03, 0.45, "sawtooth", 0.1, 440); this.drum(); }
  };
  window.SFX = SFX;
})();
