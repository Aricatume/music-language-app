/* Studio Analog 120fps Guitar & Voice Tuner
 * - Pure YIN fundamental pitch detector with parabolic interpolation (accurate down to 7-str A1 = 55 Hz!)
 * - Critically-damped slow/fast analog needle physics on native requestAnimationFrame (120fps on ProMotion)
 * - UMD export for detectPitchYIN & freqToPitchInfo (unit-tested in Node.js on synthetic waveforms)
 */
(function (root, factory) {
  const exported = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  } else {
    root.MusicTuner = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const Theory = root.MusicTheory || (typeof require === "function" ? require("./music-theory.js") : null);

  /* YIN pitch detection (de Cheveigne & Kawahara, 2002)
   * Returns { freq, probability, rms } or null when silent / unpitched.
   */
  function detectPitchYIN(buffer, sampleRate, opts) {
    const o = opts || {};
    const minFreq = o.minFreq || 42;    // covers 7-string dropped down to G1/A1 (55 Hz)
    const maxFreq = o.maxFreq || 1100;  // covers guitar upper frets & soprano voice
    const threshold = o.threshold || 0.16;
    const minRms = o.minRms || 0.008;

    const len = buffer.length;
    if (len < 512) return null;

    // 1. RMS gate + DC removal
    let mean = 0;
    for (let i = 0; i < len; i++) mean += buffer[i];
    mean /= len;

    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      const v = buffer[i] - mean;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / len);
    if (rms < minRms) return null;

    const halfLen = Math.floor(len / 2);
    const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
    const maxTau = Math.min(halfLen - 2, Math.ceil(sampleRate / minFreq));
    if (maxTau <= minTau) return null;

    // 2. Difference function d(tau)
    const diff = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < halfLen; i++) {
        const delta = (buffer[i] - mean) - (buffer[i + tau] - mean);
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // 3. Cumulative Mean Normalized Difference Function (CMNDF)
    const cmndf = new Float32Array(maxTau + 1);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // 4. First local minimum below threshold (avoids octave errors)
    let tauEstimate = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmndf[tau] < threshold) {
        while (tau + 1 <= maxTau && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Fallback to global minimum if clean tonal signal sits just above threshold
    if (tauEstimate === -1) {
      let bestVal = 1.0;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (cmndf[tau] < bestVal) {
          bestVal = cmndf[tau];
          tauEstimate = tau;
        }
      }
      if (bestVal > 0.24 || tauEstimate === -1) return null;
    }

    // 5. Parabolic interpolation around tauEstimate for sub-cent accuracy
    let betterTau = tauEstimate;
    if (tauEstimate > 1 && tauEstimate < maxTau) {
      const s0 = cmndf[tauEstimate - 1];
      const s1 = cmndf[tauEstimate];
      const s2 = cmndf[tauEstimate + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (Math.abs(denom) > 1e-9) {
        betterTau = tauEstimate + (s2 - s0) / denom;
      }
    }

    const freq = sampleRate / betterTau;
    if (!Number.isFinite(freq) || freq < minFreq || freq > maxFreq) return null;
    return {
      freq,
      probability: Math.max(0, Math.min(1, 1 - cmndf[tauEstimate])),
      rms,
    };
  }

  function freqToPitchInfo(freq, a4Ref) {
    const a4 = a4Ref || 440;
    const exactMidi = 69 + 12 * Math.log2(freq / a4);
    const midi = Math.round(exactMidi);
    const cents = (exactMidi - midi) * 100;
    return {
      freq,
      midi,
      cents,
      noteEn: Theory ? Theory.midiToName(midi, false) : String(midi),
      noteRu: Theory ? Theory.midiToName(midi, true) : String(midi),
      pitchClassEn: Theory ? Theory.midiToPitchClass(midi, false) : "",
      pitchClassRu: Theory ? Theory.midiToPitchClass(midi, true) : "",
      inTune: Math.abs(cents) <= 3.5,
    };
  }

  function findClosestTuningString(freq, tuningId) {
    if (!Theory) return null;
    const spec = Theory.getTuningSpec(tuningId);
    let best = null;
    spec.midis.forEach((m, idx) => {
      const targetFreq = Theory.midiToFreq(m);
      const centsDiff = 1200 * Math.log2(freq / targetFreq);
      if (!best || Math.abs(centsDiff) < Math.abs(best.centsDiff)) {
        best = {
          stringNum: idx + 1,
          midi: m,
          noteEn: Theory.midiToName(m, false),
          noteRu: Theory.midiToName(m, true),
          targetFreq,
          centsDiff,
        };
      }
    });
    return best;
  }

  /* 120fps Damped Analog Needle Tuner Controller */
  class AnalogTunerController {
    constructor(canvasEl, opts) {
      this.canvas = canvasEl;
      this.ctx2d = canvasEl ? canvasEl.getContext("2d") : null;
      this.opts = opts || {};
      this.onUpdate = typeof this.opts.onUpdate === "function" ? this.opts.onUpdate : () => {};
      this.onStateChange = typeof this.opts.onStateChange === "function" ? this.opts.onStateChange : () => {};

      this.mode = "guitar"; // "guitar" | "voice"
      this.tuningId = "standard_6";
      this.damping = "slow"; // "slow" (analog weighted needle) | "fast"
      this.running = false;
      this._starting = false;
      this._micSessionId = 0;
      this.previewMode = false;
      this.previewHoldUntil = 0;

      // Audio capture nodes
      this.audioCtx = null;
      this.stream = null;
      this.source = null;
      this.analyser = null;
      this.timeBuf = null;

      // Damped spring-needle physics state (updates every animation frame up to 120fps)
      this.targetCents = 0;
      this.needleCents = 0;
      this.needleVel = 0;
      this.signalLevel = 0;
      this.activePitch = null;
      this.holdUntil = 0;
      this._rafId = null;
      this._lastTs = 0;
      this._fpsSamples = 0;
      this._fpsTimer = 0;
      this.measuredFps = 0;

      this._drawFrame(0);
    }

    setMode(mode) {
      this.mode = mode === "voice" ? "voice" : "guitar";
    }

    setTuning(tuningId) {
      this.tuningId = tuningId || "standard_6";
    }

    setDamping(damping) {
      this.damping = damping === "fast" ? "fast" : "slow";
    }

    /* Visual needle lock preview when user taps a reference string button */
    showReferencePreview(midi) {
      if (!Theory) return;
      const freq = Theory.midiToFreq(midi);
      const now = performance.now();
      this.previewMode = true;
      this.previewHoldUntil = now + 2400;
      this.activePitch = freqToPitchInfo(freq);
      this.targetCents = 0;
      this.needleCents = -16;
      this.needleVel = 0;
      this.signalLevel = 0.72;
      this.holdUntil = now + 2400;
      this._ensureRafLoop();
      this.onUpdate({
        active: true,
        preview: true,
        pitch: this.activePitch,
        closestString: findClosestTuningString(freq, this.tuningId),
        fps: this.measuredFps,
      });
    }

    async startMic() {
      if (this.running || this._starting) return { ok: true };
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { ok: false, error: "Микрофон недоступен в этом браузере. Используй эталонные струны ниже для настройки на слух." };
      }
      this._starting = true;
      const mySession = ++this._micSessionId;
      let stream = null;
      let audioCtx = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        if (mySession !== this._micSessionId) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
          this._starting = false;
          return { ok: false, error: "" };
        }
        const AudioCtx = root.AudioContext || root.webkitAudioContext;
        audioCtx = new AudioCtx();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        if (mySession !== this._micSessionId) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
          try { audioCtx.close(); } catch (_) {}
          this._starting = false;
          return { ok: false, error: "" };
        }
        this.stream = stream;
        this.audioCtx = audioCtx;
        this.source = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0;
        this.timeBuf = new Float32Array(this.analyser.fftSize);
        this.source.connect(this.analyser);

        this._starting = false;
        this.running = true;
        this.previewMode = false;
        this.previewHoldUntil = 0;
        this.onStateChange({ running: true });
        this._ensureRafLoop();
        return { ok: true };
      } catch (err) {
        if (stream) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        }
        if (audioCtx) {
          try { audioCtx.close(); } catch (_) {}
        }
        this._starting = false;
        this.stopMic();
        const msg = err && err.name === "NotAllowedError"
          ? "Доступ к микрофону отклонён. Разреши микрофон в настройках браузера/Telegram или настраивайся по эталонным струнам ниже."
          : "Не удалось включить микрофон (" + String((err && err.message) || err) + ").";
        return { ok: false, error: msg };
      }
    }

    stopMic() {
      this._micSessionId += 1;
      this._starting = false;
      this.running = false;
      this.previewMode = false;
      this.previewHoldUntil = 0;
      if (this.source) {
        try { this.source.disconnect(); } catch (_) {}
        this.source = null;
      }
      if (this.stream) {
        try { this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        this.stream = null;
      }
      if (this.audioCtx) {
        try { this.audioCtx.close(); } catch (_) {}
        this.audioCtx = null;
      }
      this.analyser = null;
      this.activePitch = null;
      this.targetCents = 0;
      this.signalLevel = 0;
      this.onStateChange({ running: false });
      this._drawFrame(0);
    }

    _ensureRafLoop() {
      if (this._rafId) return;
      this._lastTs = 0;
      this._fpsSamples = 0;
      this._fpsTimer = performance.now();

      const loop = (ts) => {
        const dt = this._lastTs ? Math.min(0.04, Math.max(0.002, (ts - this._lastTs) / 1000)) : 0.0083;
        this._lastTs = ts;

        this._fpsSamples += 1;
        if (ts - this._fpsTimer >= 600) {
          this.measuredFps = Math.round((this._fpsSamples * 1000) / (ts - this._fpsTimer));
          this._fpsSamples = 0;
          this._fpsTimer = ts;
        }

        const now = performance.now();
        if (this.previewMode && now < this.previewHoldUntil) {
          // Keep reference string preview clean even if mic is active
        } else if (this.running && this.analyser && this.timeBuf) {
          this.previewMode = false;
          this.analyser.getFloatTimeDomainData(this.timeBuf);
          const minFreq = this.mode === "voice" ? 72 : 42;
          const maxFreq = this.mode === "voice" ? 1100 : 1050;
          const res = detectPitchYIN(this.timeBuf, this.audioCtx.sampleRate, {
            minFreq,
            maxFreq,
            threshold: this.mode === "voice" ? 0.18 : 0.15,
            minRms: 0.009,
          });

          if (res) {
            const info = freqToPitchInfo(res.freq);
            this.activePitch = info;
            this.targetCents = Math.max(-50, Math.min(50, info.cents));
            this.signalLevel = Math.min(1, res.rms * 7.5);
            this.holdUntil = now + 520;
            this.onUpdate({
              active: true,
              preview: false,
              pitch: info,
              closestString: this.mode === "guitar" ? findClosestTuningString(res.freq, this.tuningId) : null,
              fps: this.measuredFps,
            });
          } else if (now > this.holdUntil) {
            this.signalLevel *= Math.exp(-8 * dt);
            this.targetCents = 0;
            if (this.signalLevel < 0.03) {
              this.activePitch = null;
              this.onUpdate({ active: false, preview: false, pitch: null, closestString: null, fps: this.measuredFps });
            }
          }
        } else if (this.previewMode && now > this.holdUntil) {
          this.previewMode = false;
          this.signalLevel = 0;
          this.activePitch = null;
          this.targetCents = 0;
          this.onUpdate({ active: false, preview: false, pitch: null, closestString: null, fps: this.measuredFps });
        }

        // Critically damped spring physics for buttery 120fps analog VU needle motion
        const stiffness = this.damping === "fast" ? 145 : 54;
        const dampingCoeff = this.damping === "fast" ? 23 : 14.2;
        const accel = (this.targetCents - this.needleCents) * stiffness - this.needleVel * dampingCoeff;
        this.needleVel += accel * dt;
        this.needleCents += this.needleVel * dt;

        this._drawFrame(dt);

        const stillMoving = Math.abs(this.needleCents - this.targetCents) > 0.08 || Math.abs(this.needleVel) > 0.2;
        if (this.running || this.previewMode || stillMoving) {
          this._rafId = root.requestAnimationFrame(loop);
        } else {
          this._rafId = null;
        }
      };

      this._rafId = root.requestAnimationFrame(loop);
    }

    _drawFrame() {
      const canvas = this.canvas;
      const ctx = this.ctx2d;
      if (!canvas || !ctx) return;

      const dpr = Math.min(3, root.devicePixelRatio || 1);
      const cssW = Math.max(280, Math.round(canvas.clientWidth || 336));
      const cssH = 212;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const pivotY = cssH - 22;
      const radius = Math.min(cssW * 0.43, 152);
      const maxAngle = (50 * Math.PI) / 180; // -50° .. +50° arc
      const toAngle = (cents) => -Math.PI / 2 + (Math.max(-50, Math.min(50, cents)) / 50) * maxAngle;

      // Subtle analog meter background glow
      const bgGrad = ctx.createRadialGradient(cx, pivotY - radius * 0.45, 10, cx, pivotY, radius * 1.15);
      bgGrad.addColorStop(0, "rgba(95, 212, 199, 0.08)");
      bgGrad.addColorStop(1, "rgba(11, 14, 20, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cssW, cssH);

      // Outer arc rail
      ctx.beginPath();
      ctx.arc(cx, pivotY, radius, toAngle(-50), toAngle(50));
      ctx.strokeStyle = "rgba(226, 232, 240, 0.16)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sweet-spot green lock band (-4¢ .. +4¢)
      ctx.beginPath();
      ctx.arc(cx, pivotY, radius, toAngle(-4), toAngle(4));
      ctx.strokeStyle = this.activePitch && Math.abs(this.needleCents) <= 3.5 ? "#34d399" : "rgba(52, 211, 153, 0.48)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      // Etched analog scale ticks (-50..+50 every 5¢)
      for (let c = -50; c <= 50; c += 5) {
        const ang = toAngle(c);
        const isZero = c === 0;
        const isMajor = c % 10 === 0;
        const innerR = radius - (isZero ? 18 : isMajor ? 13 : 7);
        const outerR = radius + (isZero ? 3 : 0);

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * innerR, pivotY + Math.sin(ang) * innerR);
        ctx.lineTo(cx + Math.cos(ang) * outerR, pivotY + Math.sin(ang) * outerR);
        ctx.strokeStyle = isZero ? "#34d399" : isMajor ? "rgba(226,232,240,0.58)" : "rgba(148,163,184,0.28)";
        ctx.lineWidth = isZero ? 2.6 : isMajor ? 1.5 : 1;
        ctx.stroke();

        if (c === -50 || c === -25 || c === 0 || c === 25 || c === 50) {
          const lblR = radius - 26;
          ctx.fillStyle = isZero ? "#34d399" : "#8da2bf";
          ctx.font = (isZero ? "700 11px " : "600 10px ") + "-apple-system, BlinkMacSystemFont, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(isZero ? "0" : (c > 0 ? "+" + c : String(c)), cx + Math.cos(ang) * lblR, pivotY + Math.sin(ang) * lblR);
        }
      }

      // Flat (♭) / Sharp (♯) guides
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("♭ ниже", 14, 24);
      ctx.textAlign = "right";
      ctx.fillText("выше ♯", cssW - 14, 24);

      // Center Note Readout inside the analog dial
      const pitch = this.activePitch;
      const inTune = !!(pitch && Math.abs(this.needleCents) <= 3.5);
      const needleColor = !pitch
        ? "rgba(148, 163, 184, 0.5)"
        : inTune
          ? "#34d399"
          : Math.abs(this.needleCents) <= 12
            ? "#f5b963"
            : "#ff7a6b";

      // Analog needle (smooth 120fps motion)
      const nAng = toAngle(this.needleCents);
      const needleLen = radius - 8;
      ctx.save();
      ctx.shadowColor = needleColor;
      ctx.shadowBlur = pitch ? 12 : 0;
      ctx.beginPath();
      ctx.moveTo(cx, pivotY);
      ctx.lineTo(cx + Math.cos(nAng) * needleLen, pivotY + Math.sin(nAng) * needleLen);
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // Center note badge sitting cleanly over the lower half of the dial
      ctx.fillStyle = "rgba(18, 24, 34, 0.86)";
      ctx.beginPath();
      ctx.arc(cx, pivotY - 46, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pitch ? needleColor : "rgba(255,255,255,0.12)";
      ctx.lineWidth = pitch ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = pitch ? "#f8fafc" : "#64748b";
      ctx.font = "800 24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pitch ? pitch.noteEn : "—", cx, pivotY - 51);

      ctx.fillStyle = pitch ? "#cbd5e1" : "#64748b";
      ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(pitch ? pitch.noteRu : "тишина", cx, pivotY - 29);

      // Brass/obsidian needle pivot cap
      ctx.beginPath();
      ctx.arc(cx, pivotY, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.restore();
    }
  }

  return {
    detectPitchYIN,
    freqToPitchInfo,
    findClosestTuningString,
    AnalogTunerController,
  };
});
