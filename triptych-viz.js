/* Interactive Synchronized SVG Triptych:
 *   1) Musical Staff (Treble / Bass / Grand)
 *   2) 2.5-Octave Piano Keyboard (auto-centered around atom pitch range)
 *   3) 6-String Guitar Fretboard (Standard & Drop D + Virtual Capo)
 * Clicking any projection plays live sound and highlights the other two.
 * Follows Cognition OS v3.0 invariants:
 *   - Short labels only inside SVG; wrapping captions in HTML .viz-caption
 *   - 60fps lerpExp pulse smoothing; style-only updates inside requestAnimationFrame
 */
(function (root) {
  "use strict";

  const Theory = root.MusicTheory;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        node.setAttribute(k, String(attrs[k]));
      }
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function lerpExp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  class TriptychVisualizer {
    constructor(containerEl, opts) {
      this.container = containerEl;
      this.opts = opts || {};
      this.onNoteClick = typeof this.opts.onNoteClick === "function" ? this.opts.onNoteClick : () => {};

      this.state = {
        scaleMidis: [48, 52, 55, 60],
        activeMidis: [],
        rootMidi: 48,
        diffPitchClasses: [],
        clef: "grand",
        showStaff: true,
        tuningId: "standard_6",
        dropD: false,
        capo: 0,
        blindMode: false,
        caption: "Нажми «Послушать» или коснись клавиши / лада на грифе.",
      };

      // 60fps pulse animation state (DOM style-only, zero innerHTML)
      this._pulseTarget = 0;
      this._pulseVal = 0;
      this._lastTs = 0;
      this._rafId = null;

      this._buildShell();
      this.render();
    }

    _buildShell() {
      this.container.textContent = "";
      const wrap = document.createElement("div");
      wrap.className = "triptych-wrap";

      // Subtle 60fps audio pulse bar
      const pulseTrack = document.createElement("div");
      pulseTrack.className = "triptych-pulse-track";
      this._pulseBar = document.createElement("div");
      this._pulseBar.className = "triptych-pulse-bar";
      pulseTrack.appendChild(this._pulseBar);
      wrap.appendChild(pulseTrack);

      // 1. Staff card
      const staffBox = document.createElement("div");
      staffBox.className = "viz-panel";
      this._staffBox = staffBox;
      const staffHead = document.createElement("div");
      staffHead.className = "viz-panel-head";
      this._staffBadge = document.createElement("span");
      this._staffBadge.className = "viz-badge";
      this._staffBadge.textContent = "Нотный стан";
      this._staffHint = document.createElement("span");
      this._staffHint.className = "viz-mini";
      staffHead.appendChild(this._staffBadge);
      staffHead.appendChild(this._staffHint);
      this._staffSvg = el("svg", {
        class: "viz-svg staff-svg",
        viewBox: "0 0 360 112",
        role: "img",
        "aria-label": "Нотный стан",
      });
      staffBox.appendChild(staffHead);
      staffBox.appendChild(this._staffSvg);
      wrap.appendChild(staffBox);

      // 2. Piano card
      const pianoBox = document.createElement("div");
      pianoBox.className = "viz-panel";
      const pianoHead = document.createElement("div");
      pianoHead.className = "viz-panel-head";
      const pTitle = document.createElement("span");
      pTitle.className = "viz-badge";
      pTitle.textContent = "Клавиши";
      this._pianoHint = document.createElement("span");
      this._pianoHint.className = "viz-mini";
      pianoHead.appendChild(pTitle);
      pianoHead.appendChild(this._pianoHint);
      this._pianoSvg = el("svg", {
        class: "viz-svg piano-svg",
        viewBox: "0 0 360 82",
        role: "img",
        "aria-label": "Клавиатура пианино",
      });
      pianoBox.appendChild(pianoHead);
      pianoBox.appendChild(this._pianoSvg);
      wrap.appendChild(pianoBox);

      // 3. Guitar Fretboard card
      const guitarBox = document.createElement("div");
      guitarBox.className = "viz-panel";
      const guitarHead = document.createElement("div");
      guitarHead.className = "viz-panel-head";
      this._guitarBadge = document.createElement("span");
      this._guitarBadge.className = "viz-badge";
      this._guitarBadge.textContent = "Гриф (6 струн)";
      this._guitarHint = document.createElement("span");
      this._guitarHint.className = "viz-mini";
      guitarHead.appendChild(this._guitarBadge);
      guitarHead.appendChild(this._guitarHint);
      this._guitarSvg = el("svg", {
        class: "viz-svg guitar-svg",
        viewBox: "0 0 360 108",
        role: "img",
        "aria-label": "6-струнный гриф гитары",
      });
      guitarBox.appendChild(guitarHead);
      guitarBox.appendChild(this._guitarSvg);
      wrap.appendChild(guitarBox);

      // Wrapping HTML caption below SVG (zero SVG text clipping)
      this._captionEl = document.createElement("div");
      this._captionEl.className = "viz-caption";
      wrap.appendChild(this._captionEl);

      this.container.appendChild(wrap);

      // Delegated pointer clicks on SVG elements carrying data-midi
      const bindSvgClick = (svg, source) => {
        svg.addEventListener("click", (ev) => {
          const target = ev.target.closest("[data-midi]");
          if (!target) return;
          const midi = parseInt(target.getAttribute("data-midi"), 10);
          if (!Number.isFinite(midi)) return;
          this.triggerPulse(1.0);
          this.onNoteClick(midi, source);
        });
      };
      bindSvgClick(this._staffSvg, "staff");
      bindSvgClick(this._pianoSvg, "piano");
      bindSvgClick(this._guitarSvg, "guitar");
    }

    _startAnimLoop() {
      if (this._rafId || !root.requestAnimationFrame) return;
      this._lastTs = 0;
      const tick = (ts) => {
        const dt = this._lastTs ? Math.min(0.05, (ts - this._lastTs) / 1000) : 0.016;
        this._lastTs = ts;
        this._pulseTarget = Math.max(0, this._pulseTarget - dt * 2.2);
        this._pulseVal = lerpExp(this._pulseVal, this._pulseTarget, 14, dt);
        if (this._pulseBar) {
          const sx = Math.max(0.04, Math.min(1, 0.08 + this._pulseVal * 0.92));
          this._pulseBar.style.transform = "scaleX(" + sx.toFixed(3) + ")";
          this._pulseBar.style.opacity = (0.35 + this._pulseVal * 0.65).toFixed(3);
        }
        if (this._pulseTarget > 0.002 || this._pulseVal > 0.002) {
          this._rafId = root.requestAnimationFrame(tick);
        } else {
          this._pulseVal = 0;
          this._rafId = null;
        }
      };
      this._rafId = root.requestAnimationFrame(tick);
    }

    destroy() {
      if (this._rafId && root.cancelAnimationFrame) {
        root.cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }

    triggerPulse(strength) {
      this._pulseTarget = Math.max(this._pulseTarget, Math.min(1, strength || 0.85));
      this._startAnimLoop();
    }

    setState(patch) {
      Object.assign(this.state, patch || {});
      this.render();
    }

    setActiveMidis(midis, caption) {
      this.state.activeMidis = Array.isArray(midis) ? midis.slice() : [];
      if (typeof caption === "string") {
        this.state.caption = caption;
      }
      if (this.state.activeMidis.length) {
        this.triggerPulse(0.95);
      }
      this.render();
    }

    _noteRole(midi) {
      const s = this.state;
      const pc = ((midi % 12) + 12) % 12;
      const rootPc = typeof s.rootMidi === "number" ? ((s.rootMidi % 12) + 12) % 12 : -1;
      const isActive = s.activeMidis.includes(midi);
      const isActivePc = s.activeMidis.some((m) => ((m % 12) + 12) % 12 === pc);
      const isDiff = (s.diffPitchClasses || []).includes(pc);
      const isScale = s.scaleMidis.includes(midi);
      const isRoot = pc === rootPc;
      return { isActive, isActivePc, isDiff, isScale, isRoot };
    }

    _noteFill(role) {
      if (role.isActive && role.isDiff) return "#ff7a6b";
      if (role.isActive && role.isRoot) return "#f5b963";
      if (role.isActive) return "#5fd4c7";
      if (role.isDiff && role.isScale) return "#e87062";
      if (role.isRoot && role.isScale) return "#d9a24e";
      if (role.isScale) return "#567499";
      return "transparent";
    }

    render() {
      if (this._staffBox) {
        this._staffBox.classList.toggle("hidden", this.state.showStaff === false);
      }
      if (this.state.showStaff !== false) {
        this._renderStaff();
      }
      this._renderPiano();
      this._renderGuitar();
      if (this._captionEl) {
        this._captionEl.textContent = this.state.caption || "";
      }
    }

    _renderStaff() {
      const svg = this._staffSvg;
      svg.textContent = "";
      const s = this.state;

      if (s.blindMode) {
        svg.setAttribute("viewBox", "0 0 360 72");
        this._staffHint.textContent = "Скрыто · режим слуха";
        svg.appendChild(
          el("rect", { x: 8, y: 8, width: 344, height: 56, rx: 10, fill: "#101722", stroke: "rgba(95,212,199,0.28)" })
        );
        // Subtle waveform glyph
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const x = 34 + i * 12;
          const y = 36 + Math.sin(i * 0.9) * (i % 2 === 0 ? 11 : 6);
          pts.push(x + "," + y.toFixed(1));
        }
        svg.appendChild(el("polyline", { points: pts.join(" "), fill: "none", stroke: "#5fd4c7", "stroke-width": 2, opacity: 0.75 }));
        svg.appendChild(
          el("text", { x: 180, y: 60, "text-anchor": "middle", fill: "#94a3b8", "font-size": 10 }, "Слушай ухом — ноты откроются после ответа")
        );
        return;
      }

      const notesToShow = [];
      const seen = new Set();
      const source = s.activeMidis.length ? s.activeMidis : s.scaleMidis;
      for (const m of source) {
        const rm = Math.round(m);
        if (!seen.has(rm)) {
          seen.add(rm);
          notesToShow.push(rm);
        }
      }
      notesToShow.sort((a, b) => a - b);

      const hasLow = notesToShow.some((m) => m < 57);
      const hasHigh = notesToShow.some((m) => m >= 60);
      const clefMode = s.clef === "grand" || (hasLow && hasHigh) ? "grand" : s.clef === "bass" || (!hasHigh && hasLow) ? "bass" : "treble";
      this._staffHint.textContent = clefMode === "grand" ? "Двойной стан" : clefMode === "bass" ? "Басовый" : "Скрипичный";

      const isGrand = clefMode === "grand";
      const H = isGrand ? 126 : 86;
      svg.setAttribute("viewBox", "0 0 360 " + H);

      const lineGap = 8;
      const halfStep = lineGap / 2;
      const drawFiveLines = (topY, clefTag) => {
        for (let i = 0; i < 5; i++) {
          const y = topY + i * lineGap;
          svg.appendChild(el("line", { x1: 16, y1: y, x2: 344, y2: y, stroke: "rgba(226,232,240,0.22)", "stroke-width": 1 }));
        }
        // Clean typographic clef label (universally crisp across iOS/macOS/Android fonts)
        svg.appendChild(
          el("text", {
            x: 24,
            y: topY + 25,
            fill: "#94a3b8",
            "font-size": 15,
            "font-weight": "700",
          }, clefTag === "bass" ? "𝄢" : "𝄞")
        );
      };

      const trebleTopY = isGrand ? 18 : 24;
      const bassTopY = isGrand ? 76 : 24;
      if (isGrand) {
        drawFiveLines(trebleTopY, "treble");
        drawFiveLines(bassTopY, "bass");
        svg.appendChild(el("line", { x1: 16, y1: trebleTopY, x2: 16, y2: bassTopY + 32, stroke: "rgba(226,232,240,0.4)", "stroke-width": 2 }));
      } else if (clefMode === "bass") {
        drawFiveLines(bassTopY, "bass");
      } else {
        drawFiveLines(trebleTopY, "treble");
      }

      // Lay out notes horizontally with generous spacing
      const count = Math.max(1, notesToShow.length);
      const startX = 62;
      const spanX = 272;
      const stepX = count === 1 ? 0 : Math.min(34, spanX / (count - 1));
      const baseX = count === 1 ? 186 : startX + Math.max(0, (spanX - stepX * (count - 1)) / 2);

      notesToShow.forEach((midi, idx) => {
        const pos = Theory.midiToStaffPos(midi, clefMode);
        const topY = pos.clef === "bass" ? bassTopY : trebleTopY;
        const bottomY = topY + 4 * lineGap;
        const cy = bottomY - pos.offset * halfStep;
        const cx = baseX + idx * stepX;

        const role = this._noteRole(midi);
        const fill = this._noteFill(role);
        const isHot = role.isActive;

        // Ledger lines if above/below 5 staff lines
        for (const lo of pos.ledgerOffsets) {
          const ly = bottomY - lo * halfStep;
          svg.appendChild(el("line", { x1: cx - 10, y1: ly, x2: cx + 10, y2: ly, stroke: "rgba(226,232,240,0.45)", "stroke-width": 1.1 }));
        }

        const g = el("g", { class: "viz-hit", "data-midi": midi });
        if (pos.acc) {
          g.appendChild(
            el("text", { x: cx - 10.5, y: cy + 3.2, fill: isHot ? "#fde68a" : "#cbd5e1", "font-size": 9, "font-weight": "700" }, pos.acc)
          );
        }
        g.appendChild(
          el("ellipse", {
            cx,
            cy,
            rx: isHot ? 6.2 : 5.3,
            ry: isHot ? 4.4 : 3.8,
            transform: "rotate(-16 " + cx + " " + cy + ")",
            fill: fill === "transparent" ? "#567499" : fill,
            stroke: isHot ? "#ffffff" : "rgba(255,255,255,0.28)",
            "stroke-width": isHot ? 1.3 : 0.8,
          })
        );
        // Short note name tag (only EN pitch name, <=3 chars)
        g.appendChild(
          el("text", {
            x: cx,
            y: cy + 14,
            "text-anchor": "middle",
            fill: isHot ? "#f8fafc" : "#8da2bf",
            "font-size": 8.5,
            "font-weight": isHot ? "700" : "500",
          }, Theory.midiToName(midi, false))
        );
        svg.appendChild(g);
      });
    }

    _computePianoWindow() {
      const s = this.state;
      const all = [...s.scaleMidis, ...s.activeMidis].filter(Number.isFinite);
      if (!all.length) return { startMidi: 48, endMidi: 77 };
      const minM = Math.min(...all);
      const maxM = Math.max(...all);
      let startMidi = Math.max(24, Math.min(60, Math.floor(minM / 12) * 12));
      if (maxM > startMidi + 29) {
        const shifted = Math.min(60, Math.ceil((maxM - 29) / 12) * 12);
        startMidi = Math.max(24, shifted);
      }
      return { startMidi, endMidi: startMidi + 29 };
    }

    _renderPiano() {
      const svg = this._pianoSvg;
      svg.textContent = "";
      const s = this.state;
      const { startMidi, endMidi } = this._computePianoWindow();
      this._pianoHint.textContent = Theory.midiToName(startMidi, false) + "–" + Theory.midiToName(endMidi, false);

      const whites = [];
      const blacks = [];
      const isBlackPc = (pc) => pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;

      for (let m = startMidi; m <= endMidi; m++) {
        const pc = ((m % 12) + 12) % 12;
        if (!isBlackPc(pc)) whites.push(m);
      }

      const padX = 6;
      const totalW = 360 - padX * 2;
      const wKeyW = totalW / whites.length;
      const wKeyH = 72;
      const bKeyW = wKeyW * 0.64;
      const bKeyH = 44;

      const whiteXMap = new Map();
      whites.forEach((m, idx) => {
        const x = padX + idx * wKeyW;
        whiteXMap.set(m, x);
        const role = s.blindMode ? { isActive: s.activeMidis.includes(m), isRoot: false, isScale: false, isDiff: false } : this._noteRole(m);
        let fill = "#e5ebf3";
        if (role.isActive) fill = this._noteFill(role);
        else if (role.isScale) fill = role.isDiff ? "#f7b5ad" : role.isRoot ? "#f7d79f" : "#bfdcf2";

        const g = el("g", { class: "viz-hit", "data-midi": m });
        g.appendChild(
          el("rect", {
            x: x + 0.5,
            y: 4,
            width: Math.max(4, wKeyW - 1),
            height: wKeyH,
            rx: 3,
            fill,
            stroke: "#0b0e14",
            "stroke-width": 1,
          })
        );
        // Mark C octaves and active notes with short pitch label
        const pc = ((m % 12) + 12) % 12;
        if (pc === 0 || role.isActive || (!s.blindMode && role.isRoot && role.isScale)) {
          g.appendChild(
            el("text", {
              x: x + wKeyW / 2,
              y: wKeyH - 3,
              "text-anchor": "middle",
              fill: role.isActive ? "#0b0e14" : "#334155",
              "font-size": 7.8,
              "font-weight": "700",
            }, pc === 0 ? Theory.midiToName(m, false) : Theory.midiToPitchClass(m, false))
          );
        }
        svg.appendChild(g);
      });

      // Black keys on top
      for (let m = startMidi; m <= endMidi; m++) {
        const pc = ((m % 12) + 12) % 12;
        if (!isBlackPc(pc)) continue;
        const leftWhiteX = whiteXMap.get(m - 1);
        if (leftWhiteX === undefined) continue;
        blacks.push({ midi: m, x: leftWhiteX + wKeyW - bKeyW / 2 });
      }

      blacks.forEach(({ midi, x }) => {
        const role = s.blindMode ? { isActive: s.activeMidis.includes(midi), isRoot: false, isScale: false, isDiff: false } : this._noteRole(midi);
        let fill = "#18202c";
        if (role.isActive) fill = this._noteFill(role);
        else if (role.isScale) fill = role.isDiff ? "#c4574b" : role.isRoot ? "#b98634" : "#3a5b82";

        const g = el("g", { class: "viz-hit", "data-midi": midi });
        g.appendChild(
          el("rect", {
            x,
            y: 4,
            width: bKeyW,
            height: bKeyH,
            rx: 2.5,
            fill,
            stroke: "#070a0f",
            "stroke-width": 1,
          })
        );
        if (role.isActive) {
          g.appendChild(
            el("circle", { cx: x + bKeyW / 2, cy: bKeyH - 7, r: 2.5, fill: "#0b0e14" })
          );
        }
        svg.appendChild(g);
      });
    }

    _renderGuitar() {
      const svg = this._guitarSvg;
      svg.textContent = "";
      const s = this.state;
      const effectiveTuningId = s.tuningId || (s.dropD ? "drop_d_6" : "standard_6");
      const spec = Theory.getTuningSpec(effectiveTuningId);
      const tuning = spec.midis;
      const numStrings = tuning.length; // 6 or 7
      const fretCount = 12;

      this._guitarBadge.textContent = "Гриф (" + spec.short + ")";
      this._guitarHint.textContent = s.capo > 0 ? "Капо: " + s.capo + " лад · " + spec.lowToHighLabel : spec.lowToHighLabel;

      const leftX = 34;
      const rightX = 348;
      const topY = 13;
      const rowGap = numStrings >= 7 ? 14.5 : 15.5;
      const boardH = rowGap * (numStrings - 1);
      const svgH = Math.round(topY + boardH + 22);
      svg.setAttribute("viewBox", "0 0 360 " + svgH);

      const fretW = (rightX - leftX) / fretCount;

      // Fretboard wood plate
      svg.appendChild(
        el("rect", {
          x: leftX,
          y: topY - 4,
          width: rightX - leftX,
          height: boardH + 8,
          rx: 4,
          fill: "#141c28",
          stroke: "rgba(255,255,255,0.08)",
        })
      );

      // Fret inlay dots at 3, 5, 7, 9, 12
      const inlays = [3, 5, 7, 9, 12];
      const midY = topY + boardH / 2;
      inlays.forEach((f) => {
        const fx = leftX + (f - 0.5) * fretW;
        if (f === 12) {
          svg.appendChild(el("circle", { cx: fx, cy: topY + rowGap * 1.5, r: 2.2, fill: "rgba(148,163,184,0.28)" }));
          svg.appendChild(el("circle", { cx: fx, cy: topY + boardH - rowGap * 1.5, r: 2.2, fill: "rgba(148,163,184,0.28)" }));
        } else {
          svg.appendChild(el("circle", { cx: fx, cy: midY, r: 2.4, fill: "rgba(148,163,184,0.28)" }));
        }
        svg.appendChild(
          el("text", { x: fx, y: topY + boardH + 14, "text-anchor": "middle", fill: "#64748b", "font-size": 8 }, String(f))
        );
      });

      // Nut + fret wires
      svg.appendChild(
        el("line", { x1: leftX, y1: topY - 4, x2: leftX, y2: topY + boardH + 4, stroke: "#cbd5e1", "stroke-width": 2.4 })
      );
      for (let f = 1; f <= fretCount; f++) {
        const x = leftX + f * fretW;
        svg.appendChild(
          el("line", { x1: x, y1: topY - 4, x2: x, y2: topY + boardH + 4, stroke: "rgba(226,232,240,0.2)", "stroke-width": 1 })
        );
      }

      // Capo visual bar if capo > 0
      if (s.capo > 0 && s.capo <= fretCount) {
        const cx = leftX + (s.capo - 0.5) * fretW;
        svg.appendChild(
          el("rect", {
            x: cx - 3.5,
            y: topY - 6,
            width: 7,
            height: boardH + 12,
            rx: 3,
            fill: "rgba(245,185,99,0.85)",
          })
        );
      }

      // 6 or 7 strings (1=thin high string at top -> N=thick low string at bottom)
      for (let str = 0; str < numStrings; str++) {
        const y = topY + str * rowGap;
        const openMidi = tuning[str] + s.capo;
        svg.appendChild(
          el("line", {
            x1: leftX,
            y1: y,
            x2: rightX,
            y2: y,
            stroke: str === 6 ? "rgba(245,185,99,0.58)" : "rgba(203,213,225,0.42)",
            "stroke-width": (0.85 + str * 0.24).toFixed(2),
          })
        );
        // Clickable open string label
        const openHit = el("g", { class: "viz-hit", "data-midi": openMidi });
        openHit.appendChild(
          el("text", { x: 16, y: y + 3, "text-anchor": "middle", fill: str === 6 ? "#f5b963" : "#94a3b8", "font-size": 8.5, "font-weight": "700" }, Theory.midiToPitchClass(tuning[str], false))
        );
        svg.appendChild(openHit);
      }

      // Invisible interactive hit grid across frets 1..12 so user can tap ANY fret cleanly
      for (let str = 0; str < numStrings; str++) {
        const y = topY + str * rowGap;
        for (let f = 1; f <= fretCount; f++) {
          if (f < s.capo) continue;
          const midi = tuning[str] + f;
          svg.appendChild(
            el("rect", {
              class: "viz-hit",
              "data-midi": midi,
              x: leftX + (f - 1) * fretW + 1,
              y: y - rowGap / 2 + 1,
              width: fretW - 2,
              height: rowGap - 2,
              fill: "transparent",
            })
          );
        }
      }

      // Compute scale & active positions (hide scale in blindMode, still show clicked active notes)
      const fretOpts = { tuningId: effectiveTuningId, capo: s.capo, maxFret: fretCount };
      const scalePositions = s.blindMode ? [] : Theory.chooseErgonomicFrets(s.scaleMidis, fretOpts);
      const activePositions = Theory.chooseErgonomicFrets(s.activeMidis, fretOpts);

      const drawnKey = new Set();
      const drawMarker = (pos, isHot) => {
        const absFret = pos.absFret;
        if (absFret > fretCount) return;
        const key = pos.string + ":" + absFret;
        if (drawnKey.has(key) && !isHot) return;
        drawnKey.add(key);

        const y = topY + (pos.string - 1) * rowGap;
        const x = absFret === 0 ? leftX - 9 : leftX + (absFret - 0.5) * fretW;
        const role = s.blindMode ? { isActive: isHot, isRoot: false, isDiff: false, isScale: false } : this._noteRole(pos.originalMidi || pos.midi);
        if (isHot) role.isActive = true;
        const fill = this._noteFill(role);

        const g = el("g", { class: "viz-hit", "data-midi": pos.midi });
        g.appendChild(
          el("circle", {
            cx: x,
            cy: y,
            r: isHot ? 6.4 : 5.2,
            fill: fill === "transparent" ? "#567499" : fill,
            stroke: isHot ? "#ffffff" : "#0b0e14",
            "stroke-width": isHot ? 1.5 : 1,
          })
        );
        g.appendChild(
          el("text", {
            x,
            y: y + 2.7,
            "text-anchor": "middle",
            fill: isHot ? "#0b0e14" : "#f8fafc",
            "font-size": 7.2,
            "font-weight": "700",
          }, pos.fret === 0 ? "0" : String(pos.fret))
        );
        svg.appendChild(g);
      };

      scalePositions.forEach((p) => drawMarker(p, false));
      activePositions.forEach((p) => drawMarker(p, true));
    }
  }

  root.TriptychVisualizer = TriptychVisualizer;
})(typeof globalThis !== "undefined" ? globalThis : this);
