/* Zero-MP3 WebAudio DSP Engine for "Язык музыки"
 * Synthesizes:
 *  - Karplus-Strong acoustic plucked guitar (with strum & body warmth)
 *  - Additive acoustic/electric piano (harmonics + gentle hammer transient)
 *  - Continuous tonic drone / pad (for modal, raga, Celtic & Lydian grounding)
 *  - Multi-meter groove percussion (kick, woodblock/clave, shaker across 4/4..12/8)
 */
(function (root) {
  "use strict";

  const Theory = root.MusicTheory;

  /* Build a canonical 1.0s silent 8kHz 8-bit mono PCM WAV Blob URL (0x80 = exact zero amplitude).
   * Looping this silent <audio playsinline> element while the app is foregrounded forces iOS
   * Safari & Telegram WKWebView to hold AVAudioSessionCategoryPlayback, so WebAudio plays cleanly
   * even when the physical iPhone Silent Switch is turned ON (proven unmute-ios-audio pattern).
   */
  function createSilentWavUrl() {
    if (typeof Uint8Array === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
      return null;
    }
    try {
      const sampleRate = 8000;
      const numSamples = 8000; // 1.0 second
      const buf = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buf);
      const writeStr = (off, s) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
      };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + numSamples, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);       // PCM chunk size
      view.setUint16(20, 1, true);        // PCM format
      view.setUint16(22, 1, true);        // 1 channel (mono)
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true); // byte rate (8-bit mono)
      view.setUint16(32, 1, true);        // block align
      view.setUint16(34, 8, true);        // 8 bits per sample
      writeStr(36, "data");
      view.setUint32(40, numSamples, true);
      const bytes = new Uint8Array(buf, 44);
      bytes.fill(0x80); // exact digital silence for unsigned 8-bit PCM
      return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    } catch (_) {
      return null;
    }
  }

  class MusicAudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.playbackBus = null;
      this.compressor = null;
      this.timbre = "guitar"; // "guitar" | "piano"
      this.droneOn = false;
      this.droneMidi = 48;
      this.droneNodes = null;
      this.metronomeOn = false;
      this.playbackId = 0;
      this.isPlaying = false;
      this.loop = false;
      this.rate = 1.0;
      this.transpose = 0;
      this._timers = [];
      this._activeSources = new Set();
      this._activeLoopSpec = null;
      this._ksNoiseCache = new Map();
      this._iosAudioEl = null;
      this._iosWavUrl = null;
      this._iosSessionActivated = false;

      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.hidden && this._iosAudioEl && !this._iosAudioEl.paused) {
            try { this._iosAudioEl.pause(); } catch (_) {}
          }
        });
      }
    }

    /* Switch iOS Safari / Telegram WKWebView audio session from Ambient -> Playback
     * so WebAudio plays cleanly even when the physical iPhone Silent Switch is ON.
     */
    enableIOSPlaybackSession(fromGesture) {
      try {
        if (typeof navigator !== "undefined" && navigator.audioSession) {
          if (navigator.audioSession.type !== "playback") {
            navigator.audioSession.type = "playback";
          }
          this._iosSessionActivated = true;
        }
      } catch (_) {}

      if (fromGesture && typeof document !== "undefined" && !document.hidden && typeof Audio !== "undefined") {
        try {
          if (!this._iosAudioEl) {
            if (!this._iosWavUrl) this._iosWavUrl = createSilentWavUrl();
            if (this._iosWavUrl) {
              const el = new Audio();
              el.src = this._iosWavUrl;
              el.loop = true;
              el.muted = false;
              el.volume = 1.0;
              el.preload = "auto";
              el.playsInline = true;
              el.setAttribute("playsinline", "");
              el.setAttribute("webkit-playsinline", "");
              el.setAttribute("x-webkit-airplay", "deny");
              this._iosAudioEl = el;
            }
          }
          if (this._iosAudioEl && this._iosAudioEl.paused) {
            const p = this._iosAudioEl.play();
            if (p && typeof p.then === "function") {
              p.then(() => {
                this._iosSessionActivated = true;
              }).catch(() => {});
            } else {
              this._iosSessionActivated = true;
            }
          }
        } catch (_) {}
      }
      return this._iosSessionActivated;
    }

    getDiagnostics() {
      const ctxState = this.ctx ? this.ctx.state : "uninitialized";
      const iosTag = this._iosAudioEl && !this._iosAudioEl.paused
        ? "playback (loop)"
        : (this._iosSessionActivated ? "playback (api)" : "standby");
      return { ctxState, iosTag };
    }

    ensureContext() {
      this.enableIOSPlaybackSession(false);
      if (!this.ctx) {
        const AudioCtx = root.AudioContext || root.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

        this.master = this.ctx.createGain();
        this.master.gain.setValueAtTime(0.86, this.ctx.currentTime);
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        this.playbackBus = this._createPlaybackBus(this.ctx);
      }
      // Recover BOTH "suspended" AND iOS-specific "interrupted" states!
      if (this.ctx.state !== "running") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    _createPlaybackBus(ctx) {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(1.0, ctx.currentTime);
      bus.connect(this.master);
      return bus;
    }

    getPlaybackBus(ctx) {
      const c = ctx || this.ensureContext();
      if (!c) return this.master;
      if (!this.playbackBus) this.playbackBus = this._createPlaybackBus(c);
      return this.playbackBus;
    }

    trackSource(node) {
      if (!node) return;
      this._activeSources.add(node);
      try {
        node.onended = () => this._activeSources.delete(node);
      } catch (_) {}
    }

    withActiveContext(fn) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state !== "running") {
        ctx.resume().then(() => fn(ctx)).catch(() => fn(ctx));
      } else {
        fn(ctx);
      }
    }

    playReferenceTone(midi, durationSec) {
      this.withActiveContext((ctx) => {
        const now = ctx.currentTime;
        const dur = Math.max(1.0, Math.min(3.5, durationSec || 2.0));
        const freq = Theory.midiToFreq(midi);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
        env.gain.setValueAtTime(0.24, now + dur - 0.35);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(Math.max(520, freq * 4.5), now);

        // Fundamental + gentle 2nd & 3rd harmonics so low A1 (55Hz) & C2 (65Hz) are clearly heard on phone speakers
        const osc1 = ctx.createOscillator();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(freq, now);
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freq * 2, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(freq < 100 ? 0.45 : 0.22, now);

        osc1.connect(lp);
        osc2.connect(g2);
        g2.connect(lp);
        lp.connect(env);
        env.connect(this.getPlaybackBus(ctx));
        this.trackSource(osc1);
        this.trackSource(osc2);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.04);
        osc2.stop(now + dur + 0.04);
      });
    }

    unlock() {
      this.enableIOSPlaybackSession(true);
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state !== "running") {
        ctx.resume().catch(() => {});
        try {
          const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch (_) {}
      }
    }

    setTimbre(timbre) {
      this.timbre = timbre === "piano" ? "piano" : "guitar";
    }

    setRate(rate) {
      this.rate = Math.max(0.55, Math.min(1.4, Number(rate) || 1.0));
    }

    setTranspose(semis) {
      this.transpose = Math.max(-5, Math.min(6, Math.round(Number(semis) || 0)));
      if (this.droneOn) {
        this._updateDroneFreq();
      }
    }

    setMetronome(enabled) {
      this.metronomeOn = !!enabled;
    }

    setDrone(enabled, midi) {
      if (typeof midi === "number" && Number.isFinite(midi)) {
        this.droneMidi = midi;
      }
      this.droneOn = !!enabled;
      if (!this.droneOn) {
        this._stopDroneNodes();
        return;
      }
      this.withActiveContext((ctx) => {
        if (!this.droneOn) return;
        if (this.droneNodes) {
          this._updateDroneFreq();
          return;
        }

        const now = ctx.currentTime;
        const baseMidi = this._effectiveDroneMidi();
        const freq = Theory.midiToFreq(baseMidi);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.13, now + 0.28);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(460, now);
        filter.Q.setValueAtTime(0.8, now);

        const osc1 = ctx.createOscillator();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(freq, now);

        const osc2 = ctx.createOscillator();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(freq * 1.0023, now);

        const osc5 = ctx.createOscillator();
        osc5.type = "sine";
        osc5.frequency.setValueAtTime(freq * 1.4983, now);

        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.24, now);
        const g5 = ctx.createGain();
        g5.gain.setValueAtTime(0.16, now);

        osc1.connect(filter);
        osc2.connect(g2);
        g2.connect(filter);
        osc5.connect(g5);
        g5.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);

        osc1.start(now);
        osc2.start(now);
        osc5.start(now);

        this.droneNodes = { osc1, osc2, osc5, gain, filter };
      });
    }

    _effectiveDroneMidi() {
      let m = Theory.transposeMidi(this.droneMidi || 48, this.transpose);
      while (m > 52) m -= 12;
      while (m < 36) m += 12;
      return m;
    }

    _updateDroneFreq() {
      if (!this.droneNodes || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = Theory.midiToFreq(this._effectiveDroneMidi());
      this.droneNodes.osc1.frequency.setTargetAtTime(freq, now, 0.06);
      this.droneNodes.osc2.frequency.setTargetAtTime(freq * 1.0023, now, 0.06);
      this.droneNodes.osc5.frequency.setTargetAtTime(freq * 1.4983, now, 0.06);
    }

    _stopDroneNodes() {
      if (!this.droneNodes || !this.ctx) return;
      const nodes = this.droneNodes;
      this.droneNodes = null;
      const now = this.ctx.currentTime;
      try {
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.gain.gain.setValueAtTime(Math.max(0.0001, nodes.gain.gain.value), now);
        nodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        const stopAt = now + 0.24;
        nodes.osc1.stop(stopAt);
        nodes.osc2.stop(stopAt);
        nodes.osc5.stop(stopAt);
      } catch (_) {}
    }

    /* Synthesize Karplus-Strong plucked acoustic guitar buffer */
    _createKarplusStrongBuffer(ctx, freq, durationSec, brightness) {
      const sr = ctx.sampleRate;
      const totalSamples = Math.max(1024, Math.floor(sr * Math.min(2.8, Math.max(0.45, durationSec))));
      const delayLen = Math.max(2, Math.round(sr / freq));
      const buf = ctx.createBuffer(1, totalSamples, sr);
      const out = buf.getChannelData(0);

      // Warm filtered excitation burst (plucked nylon/acoustic string)
      const ring = new Float32Array(delayLen);
      let prev = 0;
      const excSmooth = 0.42;
      for (let i = 0; i < delayLen; i++) {
        const white = Math.random() * 2 - 1;
        prev = prev * excSmooth + white * (1 - excSmooth);
        ring[i] = prev;
      }

      // Frequency-dependent decay so bass strings ring warmly and treble strings decay cleanly
      const decay = Math.min(0.9968, 0.991 + (1 - Math.min(1, freq / 900)) * 0.0052);
      const damp = 0.46 + (1 - brightness) * 0.18; // lowpass blend
      let ptr = 0;
      for (let i = 0; i < totalSamples; i++) {
        const nextPtr = (ptr + 1) % delayLen;
        const sample = ring[ptr];
        out[i] = sample;
        ring[ptr] = decay * ((1 - damp) * sample + damp * ring[nextPtr]);
        ptr = nextPtr;
      }

      // Soft tail fade to eliminate clicks
      const fadeSamples = Math.min(Math.floor(sr * 0.04), totalSamples);
      for (let i = 0; i < fadeSamples; i++) {
        out[totalSamples - 1 - i] *= i / fadeSamples;
      }
      return buf;
    }

    playGuitarNote(midi, when, durationSec, velocity) {
      if (!Number.isFinite(midi)) return;
      const safeMidi = Math.max(21, Math.min(108, Math.round(midi)));
      const ctx = this.ensureContext();
      if (!ctx) return;
      const t = Math.max(ctx.currentTime, when || ctx.currentTime);
      const freq = Theory.midiToFreq(safeMidi);
      const vel = Math.max(0.15, Math.min(1.0, velocity || 0.78));
      const dur = Math.max(0.45, Math.min(2.6, durationSec || 1.25));

      let buf = this._ksNoiseCache.get(safeMidi);
      if (!buf) {
        buf = this._createKarplusStrongBuffer(ctx, freq, 2.6, 0.65);
        if (this._ksNoiseCache.size > 64) {
          const firstKey = this._ksNoiseCache.keys().next().value;
          this._ksNoiseCache.delete(firstKey);
        }
        this._ksNoiseCache.set(safeMidi, buf);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      // Subtle wooden guitar body resonance
      const body = ctx.createBiquadFilter();
      body.type = "peaking";
      body.frequency.setValueAtTime(215, t);
      body.Q.setValueAtTime(1.1, t);
      body.gain.setValueAtTime(3.2, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vel * 0.68, t + 0.005);
      gain.gain.setValueAtTime(vel * 0.68, t + Math.max(0.05, dur - 0.12));
      gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      src.connect(body);
      body.connect(gain);
      gain.connect(this.getPlaybackBus(ctx));
      this.trackSource(src);

      src.start(t);
      src.stop(t + dur + 0.03);
    }

    playPianoNote(midi, when, durationSec, velocity) {
      if (!Number.isFinite(midi)) return;
      const safeMidi = Math.max(21, Math.min(108, Math.round(midi)));
      const ctx = this.ensureContext();
      if (!ctx) return;
      const t = Math.max(ctx.currentTime, when || ctx.currentTime);
      const freq = Theory.midiToFreq(safeMidi);
      const vel = Math.max(0.15, Math.min(1.0, velocity || 0.78));
      const dur = Math.max(0.35, Math.min(2.8, durationSec || 1.2));

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(5400, freq * (3.5 + vel * 4.5)), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 1.9), t + dur * 0.85);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vel * 0.34, t + 0.007);
      env.gain.exponentialRampToValueAtTime(vel * 0.14, t + Math.min(0.28, dur * 0.4));
      env.gain.exponentialRampToValueAtTime(0.0006, t + dur);

      filter.connect(env);
      env.connect(this.getPlaybackBus(ctx));

      // 3 warm piano partials
      const partials = [
        { mult: 1.0, amp: 0.72, type: "triangle" },
        { mult: 2.0, amp: 0.28, type: "sine" },
        { mult: 3.001, amp: 0.11, type: "sine" },
      ];
      for (const p of partials) {
        const osc = ctx.createOscillator();
        osc.type = p.type;
        osc.frequency.setValueAtTime(freq * p.mult, t);
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(p.amp, t);
        osc.connect(pg);
        pg.connect(filter);
        this.trackSource(osc);
        osc.start(t);
        osc.stop(t + dur + 0.03);
      }
    }

    playNote(midi, opts) {
      if (!Number.isFinite(midi)) return;
      const o = opts || {};
      this.withActiveContext((ctx) => {
        const when = o.when || ctx.currentTime;
        const dur = o.duration || 1.25;
        const vel = o.velocity || 0.8;
        const timbre = o.timbre || this.timbre;
        if (timbre === "piano") {
          this.playPianoNote(midi, when, dur, vel);
        } else {
          this.playGuitarNote(midi, when, dur, vel);
        }
      });
    }

    playChord(midis, opts) {
      const o = opts || {};
      if (!Array.isArray(midis) || !midis.length) return;
      this.withActiveContext((ctx) => {
        const sorted = midis.filter(Number.isFinite).slice().sort((a, b) => a - b);
        if (!sorted.length) return;
        const baseTime = Math.max(ctx.currentTime, o.when || ctx.currentTime);
        const timbre = o.timbre || this.timbre;
        const strumSec = o.strum ? (timbre === "guitar" ? 0.022 : 0.011) : 0;
        const velScale = sorted.length >= 4 ? 0.82 : sorted.length === 3 ? 0.9 : 1.0;
        sorted.forEach((m, idx) => {
          const when = baseTime + idx * strumSec;
          const dur = o.duration || 1.3;
          const vel = (o.velocity || 0.78) * velScale;
          if (timbre === "piano") {
            this.playPianoNote(m, when, dur, vel);
          } else {
            this.playGuitarNote(m, when, dur, vel);
          }
        });
      });
    }

    /* Synthesized groove percussion: level 3=kick/downbeat, 2=woodblock/accent, 1=soft shaker */
    playPercussion(level, when, electronic) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const t = Math.max(ctx.currentTime, when || ctx.currentTime);
      const outBus = this.getPlaybackBus(ctx);

      if (level >= 3) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(electronic ? 148 : 118, t);
        osc.frequency.exponentialRampToValueAtTime(electronic ? 44 : 52, t + 0.11);
        const g = ctx.createGain();
        g.gain.setValueAtTime(electronic ? 0.42 : 0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g);
        g.connect(outBus);
        this.trackSource(osc);
        osc.start(t);
        osc.stop(t + 0.2);
      } else if (level === 2) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(electronic ? 920 : 780, t);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.045);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        osc.connect(g);
        g.connect(outBus);
        this.trackSource(osc);
        osc.start(t);
        osc.stop(t + 0.08);
      } else {
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(5200, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        src.connect(hp);
        hp.connect(g);
        g.connect(outBus);
        this.trackSource(src);
        src.start(t);
      }
    }

    stopPlayback() {
      this.playbackId += 1;
      this.isPlaying = false;
      this._activeLoopSpec = null;
      for (const id of this._timers) clearTimeout(id);
      this._timers = [];

      // Tear down active WebAudio playbackBus smoothly (20ms fade) & stop all scheduled sources!
      if (this.ctx && this.playbackBus) {
        const oldBus = this.playbackBus;
        const now = this.ctx.currentTime;
        try {
          oldBus.gain.cancelScheduledValues(now);
          oldBus.gain.setValueAtTime(Math.max(0.0001, oldBus.gain.value), now);
          oldBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        } catch (_) {}
        const sourcesToStop = Array.from(this._activeSources);
        this._activeSources.clear();
        setTimeout(() => {
          for (const node of sourcesToStop) {
            try { node.stop(); } catch (_) {}
          }
          try { oldBus.disconnect(); } catch (_) {}
        }, 35);
        this.playbackBus = this._createPlaybackBus(this.ctx);
      }
    }

    /* Schedule a full timeline with guaranteed AudioContext resume, metronome & loop */
    playTimeline(events, opts) {
      this.stopPlayback();
      if (!Array.isArray(events) || !events.length) return;

      const o = opts || {};
      const myId = this.playbackId;
      this.isPlaying = true;
      this.loop = !!o.loop;

      this.withActiveContext((ctx) => {
        if (this.playbackId !== myId) return;
        this._scheduleTimelineNow(ctx, myId, events, o);
      });
    }

    _scheduleTimelineNow(ctx, myId, events, o) {
      const baseBpm = Math.max(42, Math.min(200, Number(o.bpm) || 88));
      const effBpm = baseBpm * this.rate;
      const secPerBeat = 60 / effBpm;
      const meterStr = o.meter || "4/4";
      const parsedMeter = Theory.parseMeter(meterStr);
      const accents = Theory.getMeterAccentPattern(meterStr);
      const useMetronome = o.forceMetronome || this.metronomeOn || o.playMode === "rhythm_pulse";
      const electronic = o.electronic || baseBpm >= 124;

      const startAudioTime = ctx.currentTime + 0.04;
      let cursorBeats = 0;

      // Schedule musical events
      events.forEach((ev, idx) => {
        const beats = Math.max(0.25, Number(ev.beats) || 1.0);
        const evTime = startAudioTime + cursorBeats * secPerBeat;
        const durSec = Math.max(0.32, beats * secPerBeat * 1.08);
        const midis = Theory.transposeMidis(ev.midis || [], this.transpose);

        if (midis.length === 1) {
          this.playNote(midis[0], { when: evTime, duration: durSec, velocity: ev.velocity || 0.8 });
        } else if (midis.length > 1) {
          this.playChord(midis, {
            when: evTime,
            duration: durSec,
            velocity: ev.velocity || 0.78,
            strum: !!ev.strum,
          });
        }

        if (ev.accentKick) this.playPercussion(3, evTime, electronic);
        if (ev.accentHat) this.playPercussion(1, evTime, electronic);

        const delayMs = Math.max(0, Math.round((evTime - ctx.currentTime) * 1000));
        const tid = setTimeout(() => {
          if (this.playbackId !== myId) return;
          if (typeof o.onEvent === "function") {
            o.onEvent({
              index: idx,
              total: events.length,
              midis,
              rawMidis: ev.midis || [],
              label: ev.label || "",
              segmentIndex: ev.segmentIndex,
              mechanicId: ev.mechanicId,
              mechanicTitle: ev.mechanicTitle,
              progress: (idx + 1) / events.length,
            });
          }
        }, delayMs);
        this._timers.push(tid);
        cursorBeats += beats;
      });

      // Schedule multi-meter percussion grid across total beats
      const totalBeats = Math.max(1, cursorBeats);
      if (useMetronome) {
        const stepBeats = parsedMeter.den === 8 ? 0.5 : 1.0;
        const totalSteps = Math.max(1, Math.round(totalBeats / stepBeats));
        for (let s = 0; s < totalSteps; s++) {
          const t = startAudioTime + s * stepBeats * secPerBeat;
          const accent = accents[s % accents.length];
          this.playPercussion(accent, t, electronic);
          const delayMs = Math.max(0, Math.round((t - ctx.currentTime) * 1000));
          const tid = setTimeout(() => {
            if (this.playbackId !== myId) return;
            if (typeof o.onBeat === "function") {
              o.onBeat({ step: s % accents.length, totalSteps: accents.length, accent });
            }
          }, delayMs);
          this._timers.push(tid);
        }
      }

      const endMs = Math.max(120, Math.round((totalBeats * secPerBeat + 0.08) * 1000));
      const endTid = setTimeout(() => {
        if (this.playbackId !== myId) return;
        if (this.loop && o.loop) {
          this.playTimeline(events, o);
        } else {
          this.isPlaying = false;
          if (typeof o.onEnd === "function") o.onEnd();
        }
      }, endMs);
      this._timers.push(endTid);
    }
  }

  root.MusicAudioEngine = MusicAudioEngine;
})(typeof globalThis !== "undefined" ? globalThis : this);
