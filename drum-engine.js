/* Drum Groove Improviser, Subdivision Metronome, Compound Meter Engine & Drum Kit Music Theory
 * 100% WebAudio DSP (0 KB MP3) + deterministic UMD pattern/theory logic (unit-tested in Node.js).
 * Voices: kick (Бочка), snare (Рабочий + ghost), hat (Хай-хэт closed/open), tom (Томы hi/floor), cymbal (Железо ride/crash).
 */
(function (root, factory) {
  const exported = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  } else {
    root.MusicDrums = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VOICES = ["cymbal", "tom", "hat", "snare", "kick"];

  const DRUM_THEORY = {
    kick: {
      id: "kick",
      name: "Бочка",
      short: "Бочка",
      color: "#ff7a6b",
      role: "Гравитация, фундамент и связь с басом.",
      placement: "В 4/4 держит сильную долю «1» и задаёт грув перед «3» (синкопа на «2-и» или «3»). В нечётных (5/4, 7/8, 9/8) маркирует начало каждой малой группы (например 1–3–5 в 7/8 = 2+2+3).",
      rehearsal: "На репетиции бас-гитара и нижние струны гитары (особенно Drop C / 7-я струна A) должны «дышать» в унисон с бочкой: если рифф бьёт на «1» и «2-и», ставь бочку туда же — появится монолитная тяжесть и кач.",
    },
    snare: {
      id: "snare",
      name: "Рабочий",
      short: "Рабочий",
      color: "#f5b963",
      role: "Пружина тела (бэкбит) и живой пульс между сильными долями.",
      placement: "В 4/4 классический бэкбит — на «2» и «4» (в half-time и тяжёлых риффах — один мощный удар на «3»). Тихие «гост-ноты» (1/16 между основными ударами) создают фанковый и живой кач.",
      rehearsal: "Рабочий — это точка, на которую кивает голова. В сложных размерах (7/8 = 2+2+3) рабочий чаще всего стоит на 3-й или 5-й восьмой, чтобы тело не теряло опору при смене такта.",
    },
    hat: {
      id: "hat",
      name: "Хай-хэт",
      short: "Хай-хэт",
      color: "#5fd4c7",
      role: "Линейка времени, кратность и ощущение скорости.",
      placement: "Ведёт ровную сетку (1/8, 1/16 или триоли 1/8T). Акцент на сильных долях даёт собранность; приоткрытый хай-хэт (оранжевая точка) на последней восьмой перед «1» работает как вдох перед новым тактом.",
      rehearsal: "Если в репетиции темп «плывёт», слушай именно хай-хэт — он делит пространство на равные кусочки. Для тренировки чувства кратности переключай 1/4 → 1/8 → 1/8T → 1/16 на одном и том же BPM.",
    },
    tom: {
      id: "tom",
      name: "Томы",
      short: "Томы",
      color: "#a78bfa",
      role: "Мелодика ритма, переходы (сбивки / fills) и племенное движение.",
      placement: "В куплете могут заменять хай-хэт для глубокого телесного грува (напольный том). Главная роль в форме — сбивки (fills) в конце 4-го такта от высокого тома к низкому, подводящие к припеву.",
      rehearsal: "Хорошая сбивка томами не ломает пульс, а «заводит пружину» к следующей доле «1». Попробуй включить «Сбивка томами» и проиграть рифф поверх перехода в новый такт.",
    },
    cymbal: {
      id: "cymbal",
      name: "Железо",
      short: "Железо",
      color: "#38bdf8",
      role: "Границы формы (Crash) и широкое воздушное пространство (Ride).",
      placement: "Crash (яркая точка) ставится на «1» нового раздела или сразу после сбивки томами — он открывает пространство. Ride (спокойный звон) заменяет хай-хэт в припевах, джазе и широких проигрышах.",
      rehearsal: "Не бей Crash хаотично: один точный Crash на «1» после сбивки (или на стыке 4/4 → 7/8) сразу делает структуру композиции кристально ясной для всех музыкантов в комнате.",
    },
  };

  const METER_SPECS = {
    "4/4":  { meter: "4/4",  beats: 4, baseDen: 4, groups: [1, 1, 1, 1], accentBeats: [0, 2], label: "4/4" },
    "3/4":  { meter: "3/4",  beats: 3, baseDen: 4, groups: [1, 1, 1],    accentBeats: [0],    label: "3/4" },
    "5/4":  { meter: "5/4",  beats: 5, baseDen: 4, groups: [3, 2],       accentBeats: [0, 3], label: "5/4 (3+2)" },
    "6/8":  { meter: "6/8",  beats: 6, baseDen: 8, groups: [3, 3],       accentBeats: [0, 3], label: "6/8 (3+3)" },
    "7/8":  { meter: "7/8",  beats: 7, baseDen: 8, groups: [2, 2, 3],    accentBeats: [0, 2, 4], label: "7/8 (2+2+3)" },
    "9/8":  { meter: "9/8",  beats: 9, baseDen: 8, groups: [2, 2, 2, 3], accentBeats: [0, 2, 4, 6], label: "9/8 (2+2+2+3)" },
    "12/8": { meter: "12/8", beats: 12, baseDen: 8, groups: [3, 3, 3, 3], accentBeats: [0, 3, 6, 9], label: "12/8 (4×3)" },
  };

  const SUBDIVISIONS = {
    "1/4":  { id: "1/4",  label: "1/4",  perQuarter: 1, perEighth: 1, countTags: [""] },
    "1/8":  { id: "1/8",  label: "1/8",  perQuarter: 2, perEighth: 1, countTags: ["", "и"] },
    "1/8T": { id: "1/8T", label: "1/8T", perQuarter: 3, perEighth: 1, countTags: ["", "та", "ти"] },
    "1/16": { id: "1/16", label: "1/16", perQuarter: 4, perEighth: 2, countTags: ["", "е", "и", "а"] },
    "1/32": { id: "1/32", label: "1/32", perQuarter: 8, perEighth: 4, countTags: ["", "·", "е", "·", "и", "·", "а", "·"] },
  };

  const BACKING_KEYS = [
    { pc: 0,  en: "C",  ru: "До" },
    { pc: 1,  en: "C#", ru: "До#" },
    { pc: 2,  en: "D",  ru: "Ре" },
    { pc: 3,  en: "Eb", ru: "Миb" },
    { pc: 4,  en: "E",  ru: "Ми" },
    { pc: 5,  en: "F",  ru: "Фа" },
    { pc: 6,  en: "F#", ru: "Фа#" },
    { pc: 7,  en: "G",  ru: "Соль" },
    { pc: 8,  en: "Ab", ru: "Ляb" },
    { pc: 9,  en: "A",  ru: "Ля" },
    { pc: 10, en: "Bb", ru: "Сиb" },
    { pc: 11, en: "B",  ru: "Си" },
  ];

  const BACKING_PROGRESSIONS = [
    {
      id: "minor_drive",
      label: "Минор · Драйв (i–bVI–bIII–bVII)",
      chords: [
        { semi: 0,  q: "m", roman: "i" },
        { semi: 8,  q: "",  roman: "bVI" },
        { semi: 3,  q: "",  roman: "bIII" },
        { semi: 10, q: "",  roman: "bVII" },
      ],
    },
    {
      id: "major_light",
      label: "Мажор · Свет (I–V–vi–IV)",
      chords: [
        { semi: 0, q: "",  roman: "I" },
        { semi: 7, q: "",  roman: "V" },
        { semi: 9, q: "m", roman: "vi" },
        { semi: 5, q: "",  roman: "IV" },
      ],
    },
    {
      id: "lydian_flight",
      label: "Лидийский · Полёт (I–II)",
      chords: [
        { semi: 0, q: "maj7", roman: "Imaj7" },
        { semi: 2, q: "",     roman: "II" },
        { semi: 0, q: "maj7", roman: "Imaj7" },
        { semi: 2, q: "",     roman: "II" },
      ],
    },
    {
      id: "dorian_groove",
      label: "Дорийский · Грув (i7–IV)",
      chords: [
        { semi: 0, q: "m7", roman: "i7" },
        { semi: 5, q: "",   roman: "IV" },
        { semi: 0, q: "m7", roman: "i7" },
        { semi: 5, q: "",   roman: "IV" },
      ],
    },
    {
      id: "hijaz_east",
      label: "Хиджаз · Восток (I–bII–bvii–I)",
      chords: [
        { semi: 0,  q: "",  roman: "I" },
        { semi: 1,  q: "",  roman: "bII" },
        { semi: 10, q: "m", roman: "bvii" },
        { semi: 0,  q: "",  roman: "I" },
      ],
    },
    {
      id: "single_drone",
      label: "Одна тоника · Фон",
      chords: [
        { semi: 0, q: "5", roman: "I5" },
      ],
    },
  ];

  function resolveBackingChord(rootPc, progId, barNumber) {
    const prog = BACKING_PROGRESSIONS.find((p) => p.id === progId) || BACKING_PROGRESSIONS[0];
    const spec = prog.chords[((barNumber % prog.chords.length) + prog.chords.length) % prog.chords.length];
    const pc = (((rootPc || 0) + spec.semi) % 12 + 12) % 12;
    const keyInfo = BACKING_KEYS[pc];

    // Deep warm bass octave (C2=36 .. B2=47) so it supports Drop C & 7-string guitar cleanly
    const bassMidi = 36 + pc;
    // Warm mid-register pad chord (around C4..G4, never muddy!)
    let padRoot = 54 + ((pc + 6) % 12); // keeps voicings compact in F#3..F4
    if (padRoot > 62) padRoot -= 12;
    let padMidis = [padRoot, padRoot + 4, padRoot + 7];
    if (spec.q === "m") padMidis = [padRoot, padRoot + 3, padRoot + 7];
    else if (spec.q === "m7") padMidis = [padRoot, padRoot + 3, padRoot + 7, padRoot + 10];
    else if (spec.q === "maj7") padMidis = [padRoot, padRoot + 4, padRoot + 7, padRoot + 11];
    else if (spec.q === "5") padMidis = [padRoot, padRoot + 7, padRoot + 12];

    const sym = keyInfo.en + (spec.q === "5" ? "5" : spec.q);
    return {
      symbol: sym,
      roman: spec.roman,
      rootRu: keyInfo.ru,
      bassMidi,
      fifthBassMidi: bassMidi + 7,
      padMidis,
    };
  }

  const GROOVE_PRESETS = [
    { id: "rock_44",      label: "Рок · 4/4",             bars: ["4/4"],               sub: "1/8",  bpm: 96,  style: "rock" },
    { id: "halftime_c",   label: "Drop C / Half-Time",    bars: ["4/4"],               sub: "1/16", bpm: 126, style: "halftime" },
    { id: "funk_16",      label: "Фанк · 1/16 гост-ноты", bars: ["4/4"],               sub: "1/16", bpm: 94,  style: "funk" },
    { id: "waltz_34",     label: "Вальс · 3/4",           bars: ["3/4"],               sub: "1/8",  bpm: 108, style: "waltz" },
    { id: "odd_78",       label: "Нечётный · 7/8",        bars: ["7/8"],               sub: "1/8",  bpm: 132, style: "odd" },
    { id: "mix_44_34",    label: "Связка 4/4 + 3/4",      bars: ["4/4", "3/4"],        sub: "1/8",  bpm: 104, style: "rock" },
    { id: "mix_44_34_78", label: "Прог 4/4 + 3/4 + 7/8",  bars: ["4/4", "3/4", "7/8"], sub: "1/8",  bpm: 112, style: "prog" },
    { id: "mix_78_54",    label: "Переменный 7/8 + 5/4",  bars: ["7/8", "5/4"],        sub: "1/8",  bpm: 118, style: "prog" },
    { id: "balkan_98",    label: "Балканы · 9/8",         bars: ["9/8"],               sub: "1/8",  bpm: 136, style: "odd" },
    { id: "four_floor",   label: "Электро · 4/4 Бит",     bars: ["4/4"],               sub: "1/16", bpm: 128, style: "electro" },
  ];

  function makeRng(seed) {
    if (typeof seed === "function") return seed;
    if (typeof seed !== "number") return Math.random;
    let s = (seed >>> 0) || 987654321;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function getStepsPerBeat(meterStr, subId) {
    const spec = METER_SPECS[meterStr] || METER_SPECS["4/4"];
    const sub = SUBDIVISIONS[subId] || SUBDIVISIONS["1/8"];
    return spec.baseDen === 8 ? sub.perEighth : sub.perQuarter;
  }

  function getBarStepCount(meterStr, subId) {
    const spec = METER_SPECS[meterStr] || METER_SPECS["4/4"];
    return spec.beats * getStepsPerBeat(meterStr, subId);
  }

  function getStepCountLabels(meterStr, subId) {
    const spec = METER_SPECS[meterStr] || METER_SPECS["4/4"];
    const spb = getStepsPerBeat(meterStr, subId);
    const sub = SUBDIVISIONS[subId] || SUBDIVISIONS["1/8"];
    const tags = spb === 1 ? [""] : spb === 2 ? ["", "и"] : spb === 3 ? ["", "та", "ти"] : spb === 4 ? ["", "е", "и", "а"] : sub.countTags;
    const out = [];
    for (let b = 0; b < spec.beats; b++) {
      for (let s = 0; s < spb; s++) {
        out.push(s === 0 ? String(b + 1) : (tags[s] || "·"));
      }
    }
    return out;
  }

  function createEmptyGrid(stepCount) {
    const grid = {};
    for (const v of VOICES) grid[v] = new Array(stepCount).fill(0);
    return grid;
  }

  /* Build a musically grounded drum pattern for 1 bar according to real drum theory:
   * - Kick anchors downbeat & group starts (and syncopations)
   * - Snare anchors backbeat (2 & 4 in 4/4, 3 in half-time, group anchor in odd meters)
   * - Hi-hat / Ride holds the subdivision ruler
   * - Crash marks bar 0 downbeat when isFirstBar=true
   */
  function buildBarPattern(meterStr, subId, opts) {
    const o = opts || {};
    const style = o.style || "rock";
    const isFirstBar = !!o.isFirstBar;
    const spec = METER_SPECS[meterStr] || METER_SPECS["4/4"];
    const spb = getStepsPerBeat(meterStr, subId);
    const steps = spec.beats * spb;
    const grid = createEmptyGrid(steps);

    // 1. Hi-hat / Ride timekeeper
    for (let i = 0; i < steps; i++) {
      const isBeat = i % spb === 0;
      if (style === "halftime" || style === "prog") {
        if (isBeat || (spb >= 2 && i % Math.max(1, Math.floor(spb / 2)) === 0)) {
          grid.cymbal[i] = style === "halftime" && isBeat ? 1 : 0; // Ride on beats in half-time
          if (!grid.cymbal[i]) grid.hat[i] = 1;
        }
      } else if (style === "electro") {
        grid.hat[i] = isBeat ? 1 : (spb >= 2 && i % spb === Math.floor(spb / 2)) ? 2 : (spb === 4 && i % 2 === 1 ? 1 : 0);
      } else {
        // Closed hat on every 1/8 (or 1/16 in funk); add crisp 1/32 roll on the last 4 steps when spb === 8!
        if (spb === 8) {
          grid.hat[i] = i % 4 === 0 ? 1 : (i >= steps - 4 ? 1 : 0);
        } else if (spb === 4) {
          grid.hat[i] = i % 2 === 0 ? 1 : (style === "funk" ? 1 : 0);
        } else {
          grid.hat[i] = 1;
        }
      }
    }
    // Open hi-hat "breath" on the last subdivision before the next bar in rock/funk
    if (steps >= 4 && (style === "rock" || style === "funk" || style === "prog")) {
      grid.hat[steps - 1] = 2;
    }

    // 2. Crash on bar 1 beat 1 to mark form boundary
    if (isFirstBar) {
      grid.cymbal[0] = 2;
    }

    // 3. Kick & Snare placement based on meter & musical theory
    if (meterStr === "4/4") {
      if (style === "electro") {
        for (let b = 0; b < 4; b++) grid.kick[b * spb] = 1; // Four-on-the-Floor
        grid.snare[1 * spb] = 2;
        grid.snare[3 * spb] = 2;
      } else if (style === "halftime") {
        // Heavy Drop C / 7-string groove: kick syncopations + massive backbeat snare on beat 3
        grid.kick[0] = 1;
        if (spb >= 2) grid.kick[Math.min(steps - 1, Math.round(1.5 * spb))] = 1;
        if (spb >= 4) grid.kick[Math.min(steps - 1, Math.round(2.75 * spb))] = 1;
        else if (spb >= 2) grid.kick[Math.min(steps - 1, Math.round(3.5 * spb))] = 1;
        grid.snare[2 * spb] = 2; // Beat 3 half-time backbeat
        if (spb >= 4) grid.snare[Math.min(steps - 1, 2 * spb - 1)] = 1; // Ghost pickup
      } else if (style === "funk") {
        grid.kick[0] = 1;
        if (spb >= 4) {
          grid.kick[Math.min(steps - 1, 2)] = 1;
          grid.kick[Math.min(steps - 1, 2 * spb + 2)] = 1;
          grid.snare[1 * spb + 3] = 1; // Ghost note!
          grid.snare[2 * spb + 1] = 1; // Ghost note!
        } else {
          grid.kick[2 * spb] = 1;
        }
        grid.snare[1 * spb] = 2;
        grid.snare[3 * spb] = 2;
      } else {
        // Classic Rock / Pop 4/4: Kick on 1 & 3 (+ optional 3-and), Snare backbeat on 2 & 4
        grid.kick[0] = 1;
        grid.kick[2 * spb] = 1;
        if (spb >= 2) grid.kick[2 * spb + Math.floor(spb / 2)] = 1;
        grid.snare[1 * spb] = 2;
        grid.snare[3 * spb] = 2;
      }
    } else if (meterStr === "3/4") {
      grid.kick[0] = 1;
      grid.snare[1 * spb] = 2;
      grid.snare[2 * spb] = 1; // Softer beat 3 response
      if (style === "prog" && spb >= 2) grid.kick[Math.min(steps - 1, 2 * spb + 1)] = 1;
    } else if (meterStr === "5/4") {
      // 3 + 2 grouping: Kick 1 & 4, Snare 3 & 5
      grid.kick[0] = 1;
      grid.kick[3 * spb] = 1;
      grid.snare[2 * spb] = 2;
      grid.snare[4 * spb] = 2;
    } else if (meterStr === "6/8") {
      // Two 3-eighth waves: Kick on 1, Snare on 4
      grid.kick[0] = 1;
      if (steps > 2 * spb) grid.kick[2 * spb] = 1;
      grid.snare[3 * spb] = 2;
    } else if (meterStr === "7/8") {
      // 2 + 2 + 3: Kick on 1 & 5, Snare on 3 & 6
      grid.kick[0] = 1;
      grid.kick[4 * spb] = 1;
      grid.snare[2 * spb] = 2;
      grid.snare[5 * spb] = 1;
      grid.tom[6 * spb] = 2; // Floor tom push into next bar!
    } else if (meterStr === "9/8") {
      // Balkan aksak 2 + 2 + 2 + 3
      grid.kick[0] = 1;
      grid.kick[4 * spb] = 1;
      grid.snare[2 * spb] = 2;
      grid.snare[6 * spb] = 2;
      grid.tom[8 * spb] = 1;
    } else if (meterStr === "12/8") {
      // 4 x 3 wave: Kick 1 & 7, Snare 4 & 10
      grid.kick[0] = 1;
      grid.kick[6 * spb] = 1;
      grid.snare[3 * spb] = 2;
      grid.snare[9 * spb] = 2;
    }

    return {
      meter: meterStr,
      sub: subId,
      spb,
      steps,
      labels: getStepCountLabels(meterStr, subId),
      grid,
    };
  }

  /* Musical Groove Improviser: keeps real kick/snare/hat musical grammar while varying syncopations,
   * ghost notes, open hats & melodic tom punctuation across every bar in the compound chain.
   */
  function improviseChain(barMeters, subId, style, seed) {
    const rng = makeRng(seed);
    const meters = (barMeters && barMeters.length ? barMeters : ["4/4"]).slice(0, 4);

    return meters.map((meterStr, barIdx) => {
      const bar = buildBarPattern(meterStr, subId, { style: style || "rock", isFirstBar: barIdx === 0 });
      const g = bar.grid;
      const steps = bar.steps;
      const spb = bar.spb;

      // 1. Add 1-2 tasteful syncopated kicks (never clashing directly with main snare backbeat)
      const kickAttempts = 2;
      for (let k = 0; k < kickAttempts; k++) {
        const idx = 1 + Math.floor(rng() * (steps - 1));
        if (g.snare[idx] < 2 && rng() < 0.65) {
          g.kick[idx] = 1;
        }
      }

      // 2. Add subtle snare ghost-notes on off-beats when subdivision allows
      if (spb >= 2) {
        for (let i = 1; i < steps; i++) {
          if (g.snare[i] === 0 && g.kick[i] === 0 && i % spb !== 0 && rng() < 0.22) {
            g.snare[i] = 1; // Ghost note
          }
        }
      }

      // 3. Vary hi-hat openness or switch bar to Ride cymbal for wider texture
      const useRide = rng() < 0.28;
      if (useRide) {
        for (let i = 0; i < steps; i++) {
          if (i % spb === 0) {
            g.cymbal[i] = i === 0 && barIdx === 0 ? 2 : 1;
            g.hat[i] = 0;
          }
        }
      } else if (steps >= 4) {
        const openSlot = Math.max(1, steps - 1 - Math.floor(rng() * Math.min(2, spb)));
        if (g.hat[openSlot] > 0) g.hat[openSlot] = 2;
      }

      // 4. Add melodic tom fill on the last bar tail (last 2-3 steps)
      if (barIdx === meters.length - 1 && steps >= 4 && rng() < 0.7) {
        g.tom[steps - 2] = 1; // High tom
        g.tom[steps - 1] = 2; // Floor tom resolving into Bar 1 Crash!
      }

      return bar;
    });
  }

  /* Pure WebAudio Drum Kit + Precision Lookahead Sequencer */
  class DrumGrooveEngine {
    constructor(audioEngine) {
      this.audioEngine = audioEngine || null;
      this.ctx = null;
      this._rootMaster = null;
      this.master = null; // resettable drumBus GainNode
      this._noiseBuf = null;

      this.bpm = 104;
      this.sub = "1/8";
      this.bars = [buildBarPattern("4/4", "1/8", { style: "rock", isFirstBar: true })];
      this.metronomeOn = true;
      this.metronomeOnly = false;
      this.autoFill = true;
      this.gapMode = false; // Silent 4th cycle bar for inner-pulse training!

      // Jam Backing Track (Analog Bass + 2 Soft Synths locked to the same WebAudio clock!)
      this.backingRootPc = 0; // C (great for D Drop C!)
      this.backingProgId = "minor_drive";
      this.customChords = null; // Optional custom chord array from Circle Palette or 60-Feeling Atlas!
      this.customProgLabel = "";
      this.backingBassOn = false;
      this.backingSynthMode = "off"; // "off" | "pad" | "keys"

      this.isPlaying = false;
      this.playbackId = 0;
      this._timerId = null;
      this._uiTimers = [];

      // Transport cursor
      this._barIdx = 0;
      this._stepIdx = 0;
      this._cycleCount = 0;
      this._totalBarsPlayed = 0;
      this._nextStepTime = 0;
      this.onStep = null;
    }

    _ensureCtx() {
      if (this.audioEngine && typeof this.audioEngine.ensureContext === "function") {
        this.ctx = this.audioEngine.ensureContext();
        this._rootMaster = this.audioEngine.master || this.ctx.destination;
      } else if (!this.ctx) {
        const AudioCtx = root.AudioContext || root.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this._rootMaster = this.ctx.destination;
      }
      if (this.ctx && !this.master) {
        this.master = this.ctx.createGain();
        this.master.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.master.connect(this._rootMaster);
      }
      if (this.ctx && this.ctx.state !== "running") {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && !this._noiseBuf) {
        const len = Math.floor(this.ctx.sampleRate * 0.7);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noiseBuf = buf;
      }
      return this.ctx;
    }

    _resetDrumBus() {
      if (!this.ctx || !this.master || !this._rootMaster) return;
      const oldBus = this.master;
      const now = this.ctx.currentTime;
      try {
        oldBus.gain.cancelScheduledValues(now);
        oldBus.gain.setValueAtTime(Math.max(0.0001, oldBus.gain.value), now);
        oldBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      } catch (_) {}
      setTimeout(() => {
        try { oldBus.disconnect(); } catch (_) {}
      }, 35);
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(1.0, now);
      this.master.connect(this._rootMaster);
    }

    setCustomProgression(chords, label) {
      if (Array.isArray(chords) && chords.length) {
        this.customChords = chords.slice(0, 8).map((c) => {
          const pc = typeof c.pc === "number" ? ((c.pc % 12) + 12) % 12 : ((c.bassMidi || 36) % 12);
          const keyInfo = BACKING_KEYS[pc] || BACKING_KEYS[0];
          const bassMidi = typeof c.bassMidi === "number" ? c.bassMidi : 36 + pc;
          const padMidis = Array.isArray(c.padMidis) && c.padMidis.length
            ? c.padMidis.slice()
            : (Array.isArray(c.midis) && c.midis.length
                ? c.midis.map((m) => (m < 52 ? m + 12 : m > 72 ? m - 12 : m))
                : [54 + ((pc + 6) % 12), 58 + ((pc + 6) % 12), 61 + ((pc + 6) % 12)]);
          return {
            symbol: c.symbol || keyInfo.en,
            roman: c.roman || "",
            rootRu: c.rootRu || keyInfo.ru,
            pc,
            bassMidi,
            fifthBassMidi: bassMidi + 7,
            padMidis,
          };
        });
        this.customProgLabel = String(label || "Своя палитра");
      } else {
        this.customChords = null;
        this.customProgLabel = "";
      }
    }

    clearCustomProgression() {
      this.customChords = null;
      this.customProgLabel = "";
    }

    getProgressionLength() {
      if (this.customChords && this.customChords.length) return this.customChords.length;
      const prog = BACKING_PROGRESSIONS.find((p) => p.id === this.backingProgId) || BACKING_PROGRESSIONS[0];
      return prog.chords.length;
    }

    resolveChordForBar(barNumber) {
      if (this.customChords && this.customChords.length) {
        const idx = ((barNumber % this.customChords.length) + this.customChords.length) % this.customChords.length;
        return this.customChords[idx];
      }
      return resolveBackingChord(this.backingRootPc, this.backingProgId, barNumber);
    }

    _withCtx(fn) {
      if (this.audioEngine && typeof this.audioEngine.unlock === "function") {
        this.audioEngine.unlock();
      }
      const ctx = this._ensureCtx();
      if (!ctx) return;
      if (ctx.state !== "running") {
        ctx.resume().then(() => fn(ctx)).catch(() => fn(ctx));
      } else {
        fn(ctx);
      }
    }

    /* Synthesize each of the 5 studio drum kit voices */
    playVoice(voice, level, when) {
      if (!level) return;
      this._withCtx((ctx) => {
        const t = Math.max(ctx.currentTime, when || ctx.currentTime);
        if (voice === "kick") this._trigKick(ctx, t, level);
        else if (voice === "snare") this._trigSnare(ctx, t, level);
        else if (voice === "hat") this._trigHat(ctx, t, level);
        else if (voice === "tom") this._trigTom(ctx, t, level);
        else if (voice === "cymbal") this._trigCymbal(ctx, t, level);
        else if (voice === "click") this._trigClick(ctx, t, level);
      });
    }

    _trigKick(ctx, t, level) {
      // Deep punchy sine sweep + beater click
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(155, t);
      osc.frequency.exponentialRampToValueAtTime(46, t + 0.085);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(level >= 2 ? 0.85 : 0.72, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.26);

      // Subtle attack click so kick reads on phone speakers
      const click = ctx.createOscillator();
      click.type = "triangle";
      click.frequency.setValueAtTime(1450, t);
      click.frequency.exponentialRampToValueAtTime(220, t + 0.012);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.24, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
      click.connect(cg);
      cg.connect(this.master);
      click.start(t);
      click.stop(t + 0.02);
    }

    _trigSnare(ctx, t, level) {
      // level 1 = quiet ghost-note, level 2 = crisp full backbeat
      const isGhost = level === 1;
      const amp = isGhost ? 0.22 : 0.62;
      const dur = isGhost ? 0.085 : 0.165;

      // Snare wire noise
      const noise = ctx.createBufferSource();
      noise.buffer = this._noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(isGhost ? 2300 : 1850, t);
      bp.Q.setValueAtTime(0.8, t);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(amp, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      noise.start(t);
      noise.stop(t + dur + 0.02);

      // Drum shell tone
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(198, t);
      body.frequency.exponentialRampToValueAtTime(124, t + 0.065);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(isGhost ? 0.12 : 0.36, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      body.connect(bg);
      bg.connect(this.master);
      body.start(t);
      body.stop(t + 0.1);
    }

    _trigHat(ctx, t, level) {
      // level 1 = tight closed chick, level 2 = open sizzle hat
      const isOpen = level >= 2;
      const dur = isOpen ? 0.27 : 0.048;

      const noise = ctx.createBufferSource();
      noise.buffer = this._noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(isOpen ? 6400 : 7600, t);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(isOpen ? 0.26 : 0.20, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(this.master);
      noise.start(t);
      noise.stop(t + dur + 0.02);

      // Subtle metallic shimmer harmonic
      const metal = ctx.createOscillator();
      metal.type = "square";
      metal.frequency.setValueAtTime(isOpen ? 462 : 592, t);
      const mhp = ctx.createBiquadFilter();
      mhp.type = "highpass";
      mhp.frequency.setValueAtTime(6200, t);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(0.05, t);
      mg.gain.exponentialRampToValueAtTime(0.001, t + dur);
      metal.connect(mhp);
      mhp.connect(mg);
      mg.connect(this.master);
      metal.start(t);
      metal.stop(t + dur + 0.02);
    }

    _trigTom(ctx, t, level) {
      // level 1 = High/Mid Tom, level 2 = Deep Floor Tom
      const isFloor = level >= 2;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isFloor ? 116 : 184, t);
      osc.frequency.exponentialRampToValueAtTime(isFloor ? 66 : 112, t + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.56, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.26);
    }

    _trigCymbal(ctx, t, level) {
      // level 1 = Ride ping + air, level 2 = Full Crash explosion
      const isCrash = level >= 2;
      const dur = isCrash ? 0.62 : 0.26;

      const noise = ctx.createBufferSource();
      noise.buffer = this._noiseBuf;
      const filt = ctx.createBiquadFilter();
      filt.type = isCrash ? "highpass" : "bandpass";
      filt.frequency.setValueAtTime(isCrash ? 3800 : 5400, t);
      if (!isCrash) filt.Q.setValueAtTime(1.2, t);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(isCrash ? 0.30 : 0.16, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(filt);
      filt.connect(ng);
      ng.connect(this.master);
      noise.start(t);
      noise.stop(t + dur + 0.03);

      // Ride bell ping
      const bell = ctx.createOscillator();
      bell.type = "sine";
      bell.frequency.setValueAtTime(isCrash ? 2480 : 3180, t);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(isCrash ? 0.07 : 0.11, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + (isCrash ? 0.35 : 0.16));
      bell.connect(bg);
      bg.connect(this.master);
      bell.start(t);
      bell.stop(t + 0.38);
    }

    _trigClick(ctx, t, level) {
      // level 3 = bar downbeat, 2 = beat/group accent, 1 = subdivision tick
      const freq = level >= 3 ? 1480 : level === 2 ? 1020 : 720;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level >= 3 ? 0.30 : level === 2 ? 0.20 : 0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.04);
    }

    _midiHz(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /* Warm Analog Bass (sub-sine + filtered triangle, sits cleanly underneath guitar!) */
    _trigAnalogBass(ctx, t, midi, durSec) {
      const freq = this._midiHz(midi);
      const dur = Math.max(0.18, Math.min(1.4, durSec || 0.45));

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(460, t);
      lp.frequency.exponentialRampToValueAtTime(210, t + dur * 0.85);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.38, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.55);
      env.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      const oscSub = ctx.createOscillator();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(freq, t);
      const oscBody = ctx.createOscillator();
      oscBody.type = "triangle";
      oscBody.frequency.setValueAtTime(freq * 2, t);
      const gBody = ctx.createGain();
      gBody.gain.setValueAtTime(0.24, t);

      oscSub.connect(lp);
      oscBody.connect(gBody);
      gBody.connect(lp);
      lp.connect(env);
      env.connect(this.master);

      oscSub.start(t);
      oscBody.start(t);
      oscSub.stop(t + dur + 0.03);
      oscBody.stop(t + dur + 0.03);
    }

    /* Soft Synth 1: Velvet Warm Ambient Pad (lush slow attack, zero harsh highs) */
    _trigWarmPad(ctx, t, midis, durSec) {
      const dur = Math.max(0.6, Math.min(4.2, durSec || 2.0));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(740, t);
      lp.Q.setValueAtTime(0.7, t);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.14 / Math.max(1, Math.sqrt(midis.length)), t + Math.min(0.24, dur * 0.22));
      env.gain.setValueAtTime(0.12 / Math.max(1, Math.sqrt(midis.length)), t + Math.max(0.26, dur - 0.35));
      env.gain.exponentialRampToValueAtTime(0.0005, t + dur);

      lp.connect(env);
      env.connect(this.master);

      midis.forEach((m) => {
        const f = this._midiHz(m);
        const o1 = ctx.createOscillator();
        o1.type = "triangle";
        o1.frequency.setValueAtTime(f * 0.998, t);
        const o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.setValueAtTime(f * 1.002, t);
        o1.connect(lp);
        o2.connect(lp);
        o1.start(t);
        o2.start(t);
        o1.stop(t + dur + 0.05);
        o2.stop(t + dur + 0.05);
      });
    }

    /* Soft Synth 2: Gentle Rhodes / Electric Keys Pulse */
    _trigSoftKeys(ctx, t, midis, durSec) {
      const dur = Math.max(0.35, Math.min(1.6, durSec || 0.85));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1450, t);
      lp.frequency.exponentialRampToValueAtTime(520, t + dur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.16 / Math.max(1, Math.sqrt(midis.length)), t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.05 / Math.max(1, Math.sqrt(midis.length)), t + dur * 0.45);
      env.gain.exponentialRampToValueAtTime(0.0006, t + dur);

      lp.connect(env);
      env.connect(this.master);

      midis.forEach((m) => {
        const f = this._midiHz(m);
        const o1 = ctx.createOscillator();
        o1.type = "sine";
        o1.frequency.setValueAtTime(f, t);
        const o2 = ctx.createOscillator();
        o2.type = "triangle";
        o2.frequency.setValueAtTime(f * 2, t);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.16, t);
        o1.connect(lp);
        o2.connect(g2);
        g2.connect(lp);
        o1.start(t);
        o2.start(t);
        o1.stop(t + dur + 0.04);
        o2.stop(t + dur + 0.04);
      });
    }

    previewBacking(barNumber) {
      this._withCtx((ctx) => {
        const chord = this.resolveChordForBar(barNumber || 0);
        const now = ctx.currentTime + 0.02;
        if (this.backingBassOn) this._trigAnalogBass(ctx, now, chord.bassMidi, 0.75);
        if (this.backingSynthMode === "pad") this._trigWarmPad(ctx, now, chord.padMidis, 1.4);
        else if (this.backingSynthMode === "keys") this._trigSoftKeys(ctx, now, chord.padMidis, 1.0);
      });
    }

    setBars(bars) {
      this.bars = Array.isArray(bars) && bars.length ? bars : [buildBarPattern("4/4", this.sub)];
      if (this._barIdx >= this.bars.length) this._barIdx = 0;
      if (this._stepIdx >= this.bars[this._barIdx].steps) this._stepIdx = 0;
    }

    start(onStep) {
      this.stop();
      this.onStep = onStep || this.onStep;
      const myId = this.playbackId;
      this.isPlaying = true;
      this._barIdx = 0;
      this._stepIdx = 0;
      this._cycleCount = 0;
      this._totalBarsPlayed = 0;

      this._withCtx((ctx) => {
        if (this.playbackId !== myId || !this.isPlaying) return;
        this._nextStepTime = ctx.currentTime + 0.05;
        this._scheduleLoop(myId);
      });
    }

    stop() {
      this.playbackId += 1;
      this.isPlaying = false;
      if (this._timerId) {
        clearInterval(this._timerId);
        this._timerId = null;
      }
      for (const tid of this._uiTimers) clearTimeout(tid);
      this._uiTimers = [];
      this._resetDrumBus();
    }

    _stepDurationSec(bar) {
      const spec = METER_SPECS[bar.meter] || METER_SPECS["4/4"];
      const quarterSec = 60 / Math.max(40, Math.min(220, this.bpm));
      const beatSec = spec.baseDen === 8 ? quarterSec * 0.5 : quarterSec;
      return beatSec / Math.max(1, bar.spb);
    }

    _scheduleLoop(myId) {
      const lookaheadSec = 0.12;
      const tick = () => {
        if (!this.isPlaying || this.playbackId !== myId || !this.ctx) return;
        // Guard against catch-up burst after mobile sleep / background tab throttling!
        if (this._nextStepTime < this.ctx.currentTime - 0.25) {
          this._nextStepTime = this.ctx.currentTime + 0.05;
        }
        let guard = 0;
        while (this._nextStepTime < this.ctx.currentTime + lookaheadSec && guard < 16) {
          this._scheduleCurrentStep(myId);
          this._advanceCursor();
          guard += 1;
        }
      };
      tick();
      this._timerId = setInterval(tick, 25);
    }

    _trigVoiceDirect(ctx, voice, level, t) {
      if (voice === "kick") this._trigKick(ctx, t, level);
      else if (voice === "snare") this._trigSnare(ctx, t, level);
      else if (voice === "hat") this._trigHat(ctx, t, level);
      else if (voice === "tom") this._trigTom(ctx, t, level);
      else if (voice === "cymbal") this._trigCymbal(ctx, t, level);
      else if (voice === "click") this._trigClick(ctx, t, level);
    }

    _scheduleCurrentStep(myId) {
      const barIdx = this._barIdx;
      const stepIdx = this._stepIdx;
      const bar = this.bars[barIdx];
      if (!bar) return;

      const t = Math.max(this.ctx.currentTime, this._nextStepTime);
      const spec = METER_SPECS[bar.meter] || METER_SPECS["4/4"];
      const isLastBar = barIdx === this.bars.length - 1;
      const isGapSilent = this.gapMode && (
        (this.bars.length === 1 && this._cycleCount % 4 === 3) ||
        (this.bars.length > 1 && isLastBar && this._cycleCount % 2 === 1)
      );

      const progLen = this.getProgressionLength();
      const chordBarIndex = this.bars.length === progLen ? barIdx : this._totalBarsPlayed;
      const chordInfo = this.resolveChordForBar(chordBarIndex);
      const barDurSec = this._stepDurationSec(bar) * bar.steps;

      if (!isGapSilent) {
        // 0. Jam Backing Track (Analog Bass locked to Kick + Soft Pad / Soft Keys!)
        if (this.backingBassOn) {
          const kickHit = bar.grid.kick ? bar.grid.kick[stepIdx] > 0 : false;
          const isBarStart = stepIdx === 0;
          const isMidBar = stepIdx === Math.floor(bar.steps / 2);
          if (isBarStart || (!this.metronomeOnly && kickHit) || (this.metronomeOnly && isMidBar)) {
            const bassNote = stepIdx >= bar.steps - bar.spb ? chordInfo.fifthBassMidi : chordInfo.bassMidi;
            this._trigAnalogBass(this.ctx, t, bassNote, Math.max(0.24, this._stepDurationSec(bar) * Math.max(2, bar.spb)));
          }
        }
        if (this.backingSynthMode === "pad" && stepIdx === 0) {
          this._trigWarmPad(this.ctx, t, chordInfo.padMidis, barDurSec * 1.04);
        } else if (this.backingSynthMode === "keys") {
          const isKeyPulse = stepIdx === 0 || stepIdx === Math.floor(bar.steps / 2) || (bar.spb >= 2 && stepIdx === Math.round(bar.spb * 1.5));
          if (isKeyPulse) {
            this._trigSoftKeys(this.ctx, t, chordInfo.padMidis, Math.max(0.45, this._stepDurationSec(bar) * Math.max(2, bar.spb * 1.5)));
          }
        }

        // 1. Metronome click (when enabled or metronome-only mode)
        if (this.metronomeOn || this.metronomeOnly) {
          const isBeat = stepIdx % bar.spb === 0;
          const beatNum = Math.floor(stepIdx / bar.spb);
          if (stepIdx === 0) {
            this._trigClick(this.ctx, t, 3);
          } else if (isBeat) {
            const isGroupAccent = spec.accentBeats.includes(beatNum);
            this._trigClick(this.ctx, t, isGroupAccent ? 2 : 1);
          } else {
            this._trigClick(this.ctx, t, 1);
          }
        }

        // 2. Drum Kit voices (unless pure metronome mode)
        if (!this.metronomeOnly) {
          // When gapMode is on, fire tom fill on the bar BEFORE the silent gap so autoFill stays alive!
          const fillCycleMatch = this.gapMode
            ? (this.bars.length === 1 ? this._cycleCount % 4 === 2 : this._cycleCount % 2 === 0)
            : (this.bars.length === 1 ? this._cycleCount % 4 === 3 : this._cycleCount % 2 === 1);
          const isFillZone =
            this.autoFill &&
            isLastBar &&
            fillCycleMatch &&
            stepIdx >= Math.max(1, bar.steps - Math.min(4, bar.spb * 2));

          if (isFillZone) {
            const distFromEnd = bar.steps - 1 - stepIdx;
            this._trigTom(this.ctx, t, distFromEnd <= 1 ? 2 : 1);
            if (stepIdx === bar.steps - 1) this._trigSnare(this.ctx, t, 2);
          } else {
            for (const v of VOICES) {
              const lv = bar.grid[v] ? bar.grid[v][stepIdx] : 0;
              if (lv > 0) this._trigVoiceDirect(this.ctx, v, lv, t);
            }
          }
        }
      }

      const delayMs = Math.max(0, Math.round((t - this.ctx.currentTime) * 1000));
      const tid = setTimeout(() => {
        if (!this.isPlaying || this.playbackId !== myId) return;
        if (typeof this.onStep === "function") {
          this.onStep({
            barIdx,
            stepIdx,
            meter: bar.meter,
            countLabel: bar.labels[stepIdx] || "",
            chordInfo,
            chordLabel: (this.backingBassOn || this.backingSynthMode !== "off")
              ? (chordInfo.symbol + (chordInfo.roman ? " (" + chordInfo.roman + ")" : ""))
              : "",
            isSilentGap: isGapSilent,
            cycle: this._cycleCount,
          });
        }
      }, delayMs);
      this._uiTimers.push(tid);
      if (this._uiTimers.length > 64) this._uiTimers.shift();
    }

    _advanceCursor() {
      const bar = this.bars[this._barIdx];
      this._nextStepTime += this._stepDurationSec(bar);
      this._stepIdx += 1;
      if (this._stepIdx >= bar.steps) {
        this._stepIdx = 0;
        this._barIdx += 1;
        this._totalBarsPlayed += 1;
        if (this._barIdx >= this.bars.length) {
          this._barIdx = 0;
          this._cycleCount += 1;
        }
      }
    }
  }

  return {
    VOICES,
    DRUM_THEORY,
    METER_SPECS,
    SUBDIVISIONS,
    BACKING_KEYS,
    BACKING_PROGRESSIONS,
    GROOVE_PRESETS,
    resolveBackingChord,
    getStepsPerBeat,
    getBarStepCount,
    getStepCountLabels,
    buildBarPattern,
    improviseChain,
    DrumGrooveEngine,
  };
});
