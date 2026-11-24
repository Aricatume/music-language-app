/* Harmony & Melody Calculators for "Язык музыки":
 *   1) Interactive Circle of Fifths + Diatonic & Modal-Interchange Chord Palette Calculator
 *   2) Scale Sphere & Branching Melody-Phrase Tree (grounded in emotion & melodic contour laws)
 * Pure UMD module (runs in browser & Node.js unit tests).
 */
(function (root, factory) {
  const exported = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  } else {
    root.MusicHarmonyLab = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const Theory = root.MusicTheory || (typeof require === "function" ? require("./music-theory.js") : null);

  // 12 positions around the Circle of Fifths (clockwise by +7 semitones)
  const CIRCLE_OF_FIFTHS = [
    { idx: 0,  pc: 0,  maj: "C",  min: "Am",  minPc: 9,  sig: "0 знаков",            ruMaj: "До мажор",       ruMin: "Ля минор" },
    { idx: 1,  pc: 7,  maj: "G",  min: "Em",  minPc: 4,  sig: "1 диез (F#)",         ruMaj: "Соль мажор",     ruMin: "Ми минор" },
    { idx: 2,  pc: 2,  maj: "D",  min: "Bm",  minPc: 11, sig: "2 диеза (F#, C#)",    ruMaj: "Ре мажор",       ruMin: "Си минор" },
    { idx: 3,  pc: 9,  maj: "A",  min: "F#m", minPc: 6,  sig: "3 диеза",             ruMaj: "Ля мажор",       ruMin: "Фа# минор" },
    { idx: 4,  pc: 4,  maj: "E",  min: "C#m", minPc: 1,  sig: "4 диеза",             ruMaj: "Ми мажор",       ruMin: "До# минор" },
    { idx: 5,  pc: 11, maj: "B",  min: "G#m", minPc: 8,  sig: "5 диезов",            ruMaj: "Си мажор",       ruMin: "Соль# минор" },
    { idx: 6,  pc: 6,  maj: "F#", min: "D#m", minPc: 3,  sig: "6 диезов / 6 бем.",   ruMaj: "Фа# мажор",      ruMin: "Ре# минор" },
    { idx: 7,  pc: 1,  maj: "Db", min: "Bbm", minPc: 10, sig: "5 бемолей",           ruMaj: "Реb мажор",      ruMin: "Сиb минор" },
    { idx: 8,  pc: 8,  maj: "Ab", min: "Fm",  minPc: 5,  sig: "4 бемоля",            ruMaj: "Ляb мажор",      ruMin: "Фа минор" },
    { idx: 9,  pc: 3,  maj: "Eb", min: "Cm",  minPc: 0,  sig: "3 бемоля (Bb,Eb,Ab)", ruMaj: "Миb мажор",      ruMin: "До минор" },
    { idx: 10, pc: 10, maj: "Bb", min: "Gm",  minPc: 7,  sig: "2 бемоля (Bb, Eb)",   ruMaj: "Сиb мажор",      ruMin: "Соль минор" },
    { idx: 11, pc: 5,  maj: "F",  min: "Dm",  minPc: 2,  sig: "1 бемоль (Bb)",       ruMaj: "Фа мажор",       ruMin: "Ре минор" },
  ];

  const PC_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const PC_NAMES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const PC_NAMES_RU    = ["До", "До#", "Ре", "Миb", "Ми", "Фа", "Фа#", "Соль", "Ляb", "Ля", "Сиb", "Си"];

  const SCALE_MODES = [
    {
      id: "major",
      name: "Мажор",
      feel: "Ясный свет, тепло и открытый горизонт",
      intervals: [0, 2, 4, 5, 7, 9, 11],
      color: "#fbbf24",
    },
    {
      id: "minor",
      name: "Минор",
      feel: "Тёплая глубина, лирика и искренний рассказ",
      intervals: [0, 2, 3, 5, 7, 8, 10],
      color: "#818cf8",
    },
    {
      id: "lydian",
      name: "Лидийский (#4)",
      feel: "Чудо, парение и невесомость кино-кадра",
      intervals: [0, 2, 4, 6, 7, 9, 11],
      color: "#a78bfa",
    },
    {
      id: "dorian",
      name: "Дорийский (6)",
      feel: "Благородная грусть с тёплым лучом надежды",
      intervals: [0, 2, 3, 5, 7, 9, 10],
      color: "#5fd4c7",
    },
    {
      id: "hijaz",
      name: "Хиджаз (b2–3)",
      feel: "Восточный и балканский магнетизм, горячая драма",
      intervals: [0, 1, 4, 5, 7, 8, 10],
      color: "#fb7185",
    },
    {
      id: "pent_min",
      name: "Пентатоника",
      feel: "Свобода гитарной фразы, тайский Пхин и фолк",
      intervals: [0, 3, 5, 7, 10],
      color: "#f5b963",
    },
    {
      id: "hirajoshi",
      name: "Хирадзёси",
      feel: "Японская прозрачность, созерцание и пауза Ма",
      intervals: [0, 2, 3, 7, 8],
      color: "#38bdf8",
    },
    {
      id: "blues",
      name: "Блюз (b5)",
      feel: "Живой нерв, терпкий сдвиг и телесный кач",
      intervals: [0, 3, 5, 6, 7, 10],
      color: "#f97316",
    },
    {
      id: "mixolydian",
      name: "Миксолидийский (b7)",
      feel: "Тёплый рок-драйв, свобода дороги и солнечный грув",
      intervals: [0, 2, 4, 5, 7, 9, 10],
      color: "#eab308",
    },
    {
      id: "phrygian",
      name: "Фригийский (b2)",
      feel: "Испанский накал, тревожный рифф и острота полутона",
      intervals: [0, 1, 3, 5, 7, 8, 10],
      color: "#ef4444",
    },
    {
      id: "harmonic_minor",
      name: "Гарм. минор (7)",
      feel: "Благородная драма, неоклассика и сильное притяжение домой",
      intervals: [0, 2, 3, 5, 7, 8, 11],
      color: "#ec4899",
    },
  ];

  const CHORD_FEELING_PRESETS = [
    { id: "warmth",     label: "Тепло (Imaj7–IVadd9)",       mode: "major", chords: [[0,"maj7","Imaj7","дом и тепло"], [5,"add9","IVadd9","мягкий свет"], [9,"m7","vi7","близость"], [7,"sus4","Vsus4","тихий вдох"]] },
    { id: "wonder",     label: "Чудо и полёт (#4)",          mode: "major", chords: [[0,"maj7","Imaj7","свет"], [2,"","II","лидийский полёт"], [5,"maj7","IVmaj7","простор"], [0,"add9","Iadd9","парение"]] },
    { id: "nostalgia",  label: "Щемящая ностальгия",         mode: "major", chords: [[0,"maj7","Imaj7","память"], [5,"","IV","светлый миг"], [5,"m","iv","полутон в прошлое"], [0,"add9","Iadd9","тихий дом"]] },
    { id: "bittersweet",label: "Горько-сладкая радость",     mode: "major", chords: [[0,"maj7","Imaj7","улыбка"], [4,"m7","iii7","хрупкость"], [5,"m6","iv6","слеза тепла"], [0,"maj7","Imaj7","принятие"]] },
    { id: "light_sad",  label: "Светлая печаль (дорийск.)",  mode: "minor", chords: [[0,"m7","i7","грусть"], [5,"","IV","луч света"], [10,"add9","bVIIadd9","воздух"], [0,"m9","i9","тепло"]] },
    { id: "epic",       label: "Эпический порыв",            mode: "minor", chords: [[0,"m","i","старт"], [8,"","bVI","размах"], [3,"","bIII","высота"], [10,"","bVII","прорыв"]] },
    { id: "noble_rage", label: "Благородная ярость",         mode: "minor", chords: [[0,"m","i","накал"], [8,"","bVI","масса"], [5,"m","iv","давление"], [7,"7","V7","магнит в удар"]] },
    { id: "hijaz_east", label: "Восточный магнетизм",        mode: "major", chords: [[0,"","I","ось"], [1,"maj7","bIImaj7","фригийская искра"], [10,"m","bvii","тень"], [0,"","I","притяжение"]] },
    { id: "tender_pow", label: "Нежная сила",                mode: "major", chords: [[0,"add9","Iadd9","мягкая мощь"], [8,"","bVI","глубина"], [10,"","bVII","простор"], [0,"add9","Iadd9","опора"]] },
    { id: "jazz_warm",  label: "Джазовое тепло (ii–V–I)",    mode: "major", chords: [[2,"m7","ii7","бархат"], [7,"7","V7","притяжение"], [0,"maj7","Imaj7","сияние"], [9,"m7","vi7","уют"]] },
    { id: "contemp",    label: "Созерцание (Ма)",            mode: "minor", chords: [[0,"m","i","тишина"], [8,"maj7","bVImaj7","прозрачность"], [7,"sus4","Vsus4","пауза"], [0,"sus2","Isus2","растворение"]] },
    { id: "hope_anx",   label: "Тревожная надежда",          mode: "minor", chords: [[0,"m","i","дрожь"], [1,"","bII","тревога"], [5,"","IV","луч вверх"], [0,"m9","i9","дыхание"]] },
  ];

  function pcName(pc, preferFlat) {
    const idx = ((pc % 12) + 12) % 12;
    return (preferFlat ? PC_NAMES_FLAT : PC_NAMES_SHARP)[idx];
  }

  function buildTriadMidis(rootPc, quality, baseOctaveMidi) {
    const base = (baseOctaveMidi || 48) + (((rootPc % 12) + 12) % 12);
    const root = base > 59 ? base - 12 : base;
    if (quality === "m") return [root, root + 3, root + 7];
    if (quality === "dim") return [root, root + 3, root + 6];
    if (quality === "maj7") return [root, root + 4, root + 7, root + 11];
    if (quality === "maj7#11") return [root, root + 4, root + 7, root + 11, root + 18];
    if (quality === "add9") return [root, root + 4, root + 7, root + 14];
    if (quality === "6") return [root, root + 4, root + 7, root + 9];
    if (quality === "m6") return [root, root + 3, root + 7, root + 9];
    if (quality === "m7") return [root, root + 3, root + 7, root + 10];
    if (quality === "m9") return [root, root + 3, root + 7, root + 10, root + 14];
    if (quality === "mmaj7") return [root, root + 3, root + 7, root + 11];
    if (quality === "m7b5") return [root, root + 3, root + 6, root + 10];
    if (quality === "sus2") return [root, root + 2, root + 7];
    if (quality === "sus4") return [root, root + 5, root + 7];
    if (quality === "7") return [root, root + 4, root + 7, root + 10];
    return [root, root + 4, root + 7];
  }

  /* Blooming Sub-Circle of 8 melodic chord extensions around any tapped key on the Circle of Fifths */
  function getChordExtensionsOrbit(circleIdx, mode) {
    const pos = CIRCLE_OF_FIFTHS[((circleIdx % 12) + 12) % 12];
    const isMin = mode === "minor";
    const preferFlat = pos.idx >= 7;
    const rootPc = isMin ? pos.minPc : pos.pc;
    const rootEn = pcName(rootPc, preferFlat);

    const defs = isMin
      ? [
          { q: "m",     short: "m",      added: "b3 + 5",  role: "Чистая основа минора",       color: "#f5b963" },
          { q: "m7",    short: "m7",     added: "+ b7",    role: "Бархатное тепло и соул",     color: "#5fd4c7" },
          { q: "m9",    short: "m9",     added: "+ b7 + 9",role: "Вечерняя нежность и глубина",color: "#a78bfa" },
          { q: "sus2",  short: "sus2",   added: "2 без 3", role: "Воздушный простор и Ма",     color: "#38bdf8" },
          { q: "sus4",  short: "sus4",   added: "4 → b3",  role: "Мягкий вопрос и задержка",   color: "#60a5fa" },
          { q: "m6",    short: "m6",     added: "+ 6",     role: "Дорийский свет внутри тени", color: "#34d399" },
          { q: "mmaj7", short: "m(maj7)",added: "+ 7",     role: "Кино-нуар и магнетизм",      color: "#fb7185" },
          { q: "m7b5",  short: "m7b5",   added: "b5 + b7", role: "Горько-сладкая тень",        color: "#f97316" },
        ]
      : [
          { q: "",        short: "maj",    added: "1–3–5",   role: "Ясная опора и свет",          color: "#f5b963" },
          { q: "maj7",    short: "maj7",   added: "+ 7",     role: "Мечтательное сияние кино",    color: "#5fd4c7" },
          { q: "add9",    short: "add9",   added: "+ 9 (2)", role: "Тёплый уют и звонкий колокол",color: "#34d399" },
          { q: "sus2",    short: "sus2",   added: "2 без 3", role: "Свобода, ветер и горизонт",   color: "#38bdf8" },
          { q: "sus4",    short: "sus4",   added: "4 → 3",   role: "Ожидание разрешения вниз",    color: "#60a5fa" },
          { q: "6",       short: "6",      added: "+ 6",     role: "Винтажное тепло и нежность",  color: "#fbbf24" },
          { q: "7",       short: "7",      added: "+ b7",    role: "Блюзовый нерв и притяжение",  color: "#fb7185" },
          { q: "maj7#11", short: "maj7#11",added: "+ 7 + #4",role: "Лидийское чудо и полёт",      color: "#a78bfa" },
        ];

    return {
      rootEn: isMin ? rootEn + "m" : rootEn,
      rootRu: isMin ? pos.ruMin : pos.ruMaj,
      mode: isMin ? "minor" : "major",
      petals: defs.map((d, idx) => ({
        idx,
        symbol: rootEn + (d.q === "mmaj7" ? "m(maj7)" : d.q),
        short: d.short,
        roman: d.short,
        added: d.added,
        role: d.role,
        color: d.color,
        midis: buildTriadMidis(rootPc, d.q, 48),
      })),
    };
  }

  function buildFeelingChordSet(circleIdx, presetId) {
    const preset = CHORD_FEELING_PRESETS.find((p) => p.id === presetId) || CHORD_FEELING_PRESETS[0];
    const pos = CIRCLE_OF_FIFTHS[((circleIdx % 12) + 12) % 12];
    const preferFlat = pos.idx >= 7;
    const rootPc = preset.mode === "minor" ? pos.minPc : pos.pc;
    return {
      preset,
      mode: preset.mode,
      chords: preset.chords.map(([semi, q, roman, role]) => {
        const pc = (rootPc + semi) % 12;
        return {
          symbol: pcName(pc, preferFlat) + (q === "mmaj7" ? "m(maj7)" : q),
          roman,
          role,
          midis: buildTriadMidis(pc, q, 48),
        };
      }),
    };
  }

  /* Compute complete diatonic chord palette + 3 expressive modal-interchange borrowed chords
   * for any Circle of Fifths position (0..11) and quality ("major" | "minor").
   */
  function getChordPalette(circleIdx, mode) {
    const pos = CIRCLE_OF_FIFTHS[((circleIdx % 12) + 12) % 12];
    const isMin = mode === "minor";
    const preferFlat = pos.idx >= 7;
    const rootPc = isMin ? pos.minPc : pos.pc;

    const specs = isMin
      ? [
          { key: "i",    semi: 0,  q: "m",   roman: "i",    role: "Дом · покой",        color: "#f5b963" },
          { key: "ii0",  semi: 2,  q: "dim", roman: "ii°",  role: "Острая тень",        color: "#94a3b8" },
          { key: "bIII", semi: 3,  q: "",    roman: "bIII", role: "Светлый просвет",    color: "#5fd4c7" },
          { key: "iv",   semi: 5,  q: "m",   roman: "iv",   role: "Глубокий вздох",     color: "#818cf8" },
          { key: "v",    semi: 7,  q: "m",   roman: "v",    role: "Мягкое движение",    color: "#60a5fa" },
          { key: "bVI",  semi: 8,  q: "",    roman: "bVI",  role: "Широкий размах",     color: "#a78bfa" },
          { key: "bVII", semi: 10, q: "",    roman: "bVII", role: "Свободный порыв",    color: "#fbbf24" },
        ]
      : [
          { key: "I",    semi: 0,  q: "",    roman: "I",    role: "Дом · свет",         color: "#f5b963" },
          { key: "ii",   semi: 2,  q: "m",   roman: "ii",   role: "Тёплый шаг",         color: "#5fd4c7" },
          { key: "iii",  semi: 4,  q: "m",   roman: "iii",  role: "Хрупкая мечта",      color: "#818cf8" },
          { key: "IV",   semi: 5,  q: "",    roman: "IV",   role: "Широта и подъём",    color: "#38bdf8" },
          { key: "V",    semi: 7,  q: "",    roman: "V",    role: "Магнит домой",       color: "#fb7185" },
          { key: "vi",   semi: 9,  q: "m",   roman: "vi",   role: "Тёплая глубина",     color: "#a78bfa" },
          { key: "vii0", semi: 11, q: "dim", roman: "vii°", role: "Напряжение перед I", color: "#94a3b8" },
        ];

    const borrowedSpecs = isMin
      ? [
          { key: "V_bor",  semi: 7, q: "7", roman: "V7",  role: "Гарм. магнит домой", color: "#ff7a6b" },
          { key: "IV_bor", semi: 5, q: "",  roman: "IV",  role: "Дорийский луч света", color: "#5fd4c7" },
          { key: "bII_bor",semi: 1, q: "",  roman: "bII", role: "Фригийский накал",    color: "#f97316" },
        ]
      : [
          { key: "iv_bor",  semi: 5,  q: "m", roman: "iv",   role: "Ностальгия (из минора)", color: "#818cf8" },
          { key: "II_bor",  semi: 2,  q: "",  roman: "II",   role: "Лидийский полёт (#4)",   color: "#a78bfa" },
          { key: "bVI_bor", semi: 8,  q: "",  roman: "bVI",  role: "Кино-чудо (эпик)",       color: "#fb7185" },
        ];

    const toChord = (s, borrowed) => {
      const pc = (rootPc + s.semi) % 12;
      // Enharmonic fix: leading diminished triad in F# major / D# minor is E#°, not F°
      const noteLabel = (!preferFlat && pos.idx === 6 && pc === 5 && s.q === "dim") ? "E#" : pcName(pc, preferFlat);
      const sym = noteLabel + (s.q === "dim" ? "°" : s.q);
      return {
        key: s.key,
        symbol: sym,
        roman: s.roman,
        role: s.role,
        color: s.color,
        pc,
        borrowed: !!borrowed,
        midis: buildTriadMidis(pc, s.q, 48),
      };
    };

    const diatonic = specs.map((s) => toChord(s, false));
    const borrowed = borrowedSpecs.map((s) => toChord(s, true));

    // Circle neighbor indices: left (IV/ii), center (I/vi), right (V/iii)
    const leftIdx = (pos.idx + 11) % 12;
    const rightIdx = (pos.idx + 1) % 12;

    return {
      circlePos: pos,
      mode: isMin ? "minor" : "major",
      title: isMin ? pos.min + " (" + pos.ruMin + ")" : pos.maj + " (" + pos.ruMaj + ")",
      sig: pos.sig,
      rootPc,
      neighborIndices: [leftIdx, pos.idx, rightIdx],
      diatonic,
      borrowed,
      allByKey: Object.fromEntries([...diatonic, ...borrowed].map((c) => [c.key, c])),
    };
  }

  /* Scale Sphere & Branching Melody-Phrase Tree */
  function getScaleNotes(rootPc, modeId, baseMidi) {
    const mode = SCALE_MODES.find((m) => m.id === modeId) || SCALE_MODES[0];
    const start = (baseMidi || 60) + (((rootPc % 12) + 12) % 12);
    const tonic = start > 66 ? start - 12 : start;
    const notes = mode.intervals.map((semi, idx) => {
      const midi = tonic + semi;
      const degInfo = Theory ? Theory.describeDegree(midi, tonic) : { deg: String(idx + 1), role: "", feel: "" };
      return {
        scaleIdx: idx,
        semi,
        midi,
        pc: ((midi % 12) + 12) % 12,
        noteEn: Theory ? Theory.midiToName(midi, false) : pcName(midi, false),
        noteRu: Theory ? Theory.midiToName(midi, true) : PC_NAMES_RU[midi % 12],
        pitchRu: PC_NAMES_RU[((midi % 12) + 12) % 12],
        deg: degInfo.deg,
        role: degInfo.role,
        feel: degInfo.feel,
      };
    });
    // Add octave tonic at top of sphere range for soaring phrases
    const topOctave = {
      scaleIdx: notes.length,
      semi: 12,
      midi: tonic + 12,
      pc: tonic % 12,
      noteEn: Theory ? Theory.midiToName(tonic + 12, false) : "",
      noteRu: Theory ? Theory.midiToName(tonic + 12, true) : "",
      pitchRu: PC_NAMES_RU[tonic % 12],
      deg: "8",
      role: "Верхний дом (октава)",
      feel: "чистый взлёт и слияние на октаву выше",
    };
    return {
      mode,
      tonicMidi: tonic,
      droneMidi: tonic - 12,
      notes,
      extendedNotes: [...notes, topOctave],
    };
  }

  /* Given the current note in the Scale Sphere, return 4 expressive "Tree Branches"
   * so the musician learns melodic intuition by feeling (Step Up, Step Down, Expressive Leap, Home / Breath).
   */
  function getMelodyTreeBranches(scaleData, currentMidi) {
    const ext = scaleData.extendedNotes;
    if (!ext.length) return [];
    let curIdx = ext.findIndex((n) => n.midi === currentMidi);
    if (curIdx < 0) curIdx = 0;

    const branches = [];
    const seenMidi = new Set();
    const pushBranch = (kind, title, hint, node, beats) => {
      if (!node || seenMidi.has(node.midi)) return;
      seenMidi.add(node.midi);
      branches.push({
        kind,
        title,
        hint,
        midi: node.midi,
        noteEn: node.noteEn,
        noteRu: node.noteRu,
        deg: node.deg,
        beats: beats || 0.75,
      });
    };

    // 1. Gentle step up (singable breath upward)
    if (curIdx + 1 < ext.length) {
      const up = ext[curIdx + 1];
      pushBranch("step_up", "Шаг вверх → " + up.pitchRu + " (" + up.deg + ")", "Плавное певучее дыхание вверх", up, 0.75);
    }

    // 2. Gentle step down (soft sigh / release)
    if (curIdx - 1 >= 0) {
      const dn = ext[curIdx - 1];
      pushBranch("step_down", "Шаг вниз → " + dn.pitchRu + " (" + dn.deg + ")", "Мягкий выдох и спуск", dn, 0.75);
    }

    // 3. Expressive leap (jump 2-3 scale steps to open emotion / peak)
    const leapIdx = curIdx + 2 < ext.length ? curIdx + 2 : Math.max(0, curIdx - 2);
    if (leapIdx !== curIdx) {
      const lp = ext[leapIdx];
      pushBranch("leap", "Скачок чувства → " + lp.pitchRu + " (" + lp.deg + ")", lp.feel || "Открывает простор и порыв", lp, 1.0);
    }

    // 4. Gravity return home (tonic or 5th)
    const home = curIdx === 0 ? ext[Math.min(ext.length - 1, Math.floor(ext.length / 2))] : ext[0];
    pushBranch(
      curIdx === 0 ? "anchor" : "home",
      curIdx === 0 ? "Опора простора → " + home.pitchRu + " (" + home.deg + ")" : "Возврат домой → " + home.pitchRu + " (1)",
      curIdx === 0 ? "Устойчивая вершина внутри сферы" : "Спокойное завершение фразы в тонику",
      home,
      1.25
    );

    // 5. Intentional Breath / Pause ("Ma")
    branches.push({
      kind: "rest",
      title: "Пауза · дыхание (Ма)",
      hint: "1 доля тишины — превращает набор нот в живую речь",
      midi: null,
      noteEn: "—",
      noteRu: "пауза",
      deg: "·",
      beats: 0.75,
    });

    return branches;
  }

  /* Generate an expressive 6-8 step musical phrase using one of 4 classic melodic contour archetypes */
  function generateMelodicPhrase(scaleData, archetype) {
    const ext = scaleData.extendedNotes;
    const pick = (i) => ext[Math.max(0, Math.min(ext.length - 1, i))];
    const mid = Math.floor((ext.length - 1) / 2);
    const top = ext.length - 1;

    const toStep = (node, beats) => ({
      midi: node ? node.midi : null,
      noteEn: node ? node.noteEn : "—",
      noteRu: node ? node.noteRu : "пауза",
      deg: node ? node.deg : "·",
      beats: beats || 0.75,
    });

    if (archetype === "leap_fill") {
      // Classic melodic law: wide upward leap -> smooth stepwise descent home
      return [
        toStep(pick(0), 0.75),
        toStep(pick(Math.min(top, mid + 2)), 1.25),
        toStep(pick(Math.min(top, mid + 1)), 0.5),
        toStep(pick(mid), 0.75),
        toStep(pick(Math.max(0, mid - 1)), 0.75),
        toStep(pick(0), 1.5),
      ];
    }
    if (archetype === "pendulum") {
      // Hypnotic pendulum around tonic/color tone (great for guitar riffs & world grooves)
      return [
        toStep(pick(0), 0.5),
        toStep(pick(2), 0.5),
        toStep(pick(0), 0.5),
        toStep(pick(Math.min(top, 3)), 0.75),
        toStep(pick(0), 0.5),
        toStep(pick(Math.min(top, 4)), 0.75),
        toStep(pick(1), 0.5),
        toStep(pick(0), 1.25),
      ];
    }
    if (archetype === "wave") {
      // Breathing arch: gentle rise -> emotional peak -> pause -> soft exhale
      return [
        toStep(pick(0), 0.75),
        toStep(pick(1), 0.5),
        toStep(pick(2), 0.75),
        toStep(pick(Math.min(top, mid + 1)), 1.25),
        toStep(null, 0.5),
        toStep(pick(mid), 0.75),
        toStep(pick(1), 0.5),
        toStep(pick(0), 1.5),
      ];
    }
    // Default: "question_answer" (rises to tension -> breath -> resolves home)
    return [
      toStep(pick(0), 0.75),
      toStep(pick(2), 0.75),
      toStep(pick(Math.min(top, 3)), 1.25),
      toStep(null, 0.75),
      toStep(pick(Math.min(top, 4)), 0.75),
      toStep(pick(2), 0.5),
      toStep(pick(1), 0.5),
      toStep(pick(0), 1.5),
    ];
  }

  function toBackingChords(progression) {
    return (progression || []).filter(Boolean).map((ch) => {
      const pc = typeof ch.pc === "number" ? ((ch.pc % 12) + 12) % 12 : ((ch.midis && ch.midis.length ? ch.midis[0] : 48) % 12);
      const bassMidi = 36 + pc;
      const padMidis = Array.isArray(ch.midis) && ch.midis.length
        ? ch.midis.map((m) => (m < 52 ? m + 12 : m > 72 ? m - 12 : m))
        : [54 + ((pc + 6) % 12), 58 + ((pc + 6) % 12), 61 + ((pc + 6) % 12)];
      return {
        symbol: ch.symbol || PC_NAMES_SHARP[pc],
        roman: ch.roman || "",
        rootRu: PC_NAMES_RU[pc],
        pc,
        bassMidi,
        fifthBassMidi: bassMidi + 7,
        padMidis,
      };
    });
  }

  return {
    CIRCLE_OF_FIFTHS,
    SCALE_MODES,
    CHORD_FEELING_PRESETS,
    PC_NAMES_RU,
    getChordPalette,
    getChordExtensionsOrbit,
    buildFeelingChordSet,
    toBackingChords,
    getScaleNotes,
    getMelodyTreeBranches,
    generateMelodicPhrase,
  };
});
