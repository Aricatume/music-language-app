/* Guitar Freedom Lab:
 *   1) Anti-Em/Am Fretboard Calculator (Full 0-15 neck, 4-Fret Cage, 1-String Horizontal, 3NPS)
 *      adapting dynamically to all 5 guitar tunings (Std E, Drop D, D Drop C, 7-str Drop C + A, 7-str Drop A)
 *   2) 10 Expressive Guitar Techniques with live WebAudio synthesis (Hammer-On, Pull-Off, Legato,
 *      Bend & Vibrato, Slide, Swing/Shuffle, Two-Hand Tapping, Sweep Picking, Alternate Picking / Shred, Harmonics)
 * Pure UMD module (runs in browser & Node.js unit tests).
 */
(function (root, factory) {
  const exported = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  } else {
    root.MusicGuitarLab = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const Theory = root.MusicTheory || (typeof require === "function" ? require("./music-theory.js") : null);
  const Harmony = root.MusicHarmonyLab || (typeof require === "function" ? require("./harmony-lab.js") : null);

  // Unfamiliar "Anti-Habit" keys that intentionally break open-string Em / Am / Dm autopilot
  const ANTI_HABIT_ROOTS = [1, 3, 6, 8, 10, 11, 5]; // C#, Eb, F#, Ab, Bb, B, F

  const GUITAR_TECHNIQUES = [
    {
      id: "hammer_on",
      short: "Hammer-On",
      name: "Хаммер-он (Hammer-On · h)",
      notation: "5h7",
      feel: "Мягкий певучий порыв вверх — нота «расцветает» без резкого щелчка медиатора.",
      mechanics: "Извлеки первую ноту медиатором, затем резко и точно опусти следующий палец левой руки на более высокий лад (как молоточек) — подушечкой ближе к порожку лада.",
      emotionLink: "Идеален для лирических подходов к опорной ноте, кельтских и народных орнаментов, мягкого начала фразы.",
      drill5m: "В непривычной тональности (например F# минор) пройди 1→2 и b3→4 на каждой струне только через хаммер-он под 80 BPM, добиваясь одинаковой громкости обеих нот.",
      synthKind: "hammer_on",
      relSemis: [0, 2, 3, 5, 7, 10],
    },
    {
      id: "pull_off",
      short: "Pull-Off",
      name: "Пулл-офф (Pull-Off · p)",
      notation: "7p5",
      feel: "Текучий каскадный выдох и лёгкость спуска вниз.",
      mechanics: "Оба пальца уже стоят на ладах заранее. Верхний палец не просто поднимается, а слегка «сдёргивает» струну вниз к полу, щипая её для нижней ноты.",
      emotionLink: "Даёт ощущение вздоха, освобождения и быстрой воздушной каскадной волны.",
      drill5m: "Сыграй нисходящие пары (8p5, 7p5) через все 6/7 струн без медиатора на второй ноте; следи, чтобы струна не дребезжала и не тянулась в бенд.",
      synthKind: "pull_off",
      relSemis: [12, 10, 7, 5, 3, 0],
    },
    {
      id: "legato",
      short: "Легато",
      name: "Легато (слитная игра · h + p)",
      notation: "5h7h8p7p5",
      feel: "Шёлковый непрерывный поток речи — как голос или саксофон, без «пулемётной» атаки.",
      mechanics: "Один мягкий удар медиатора на струну — остальные ноты (обычно 3 ноты на струну) исполняются слитной цепочкой хаммер-онов и пулл-оффов. Правая рука слегка глушит неиспользуемые басовые струны.",
      emotionLink: "Рождает ощущение полёта, сновидения и плавного перетекания эмоций (особенно в Лидийском и Дорийском ладах).",
      drill5m: "Выбери режим «3 ноты на струну» выше, поставь метроном на 1/8T (триоли) при 76 BPM и прогоняй 1 удар на 3 ноты (h-h вверх, p-p вниз) через весь гриф.",
      drumLink: { sub: "1/8T", bpm: 76, label: "🥁 Тренировать под 1/8T · 76 BPM" },
      synthKind: "legato",
      relSemis: [0, 2, 3, 5, 7, 8, 10, 8, 7, 5, 3, 2, 0],
    },
    {
      id: "bend_vibrato",
      short: "Бенд/Вибр.",
      name: "Бенд и Вибрато (подтяжка струны)",
      notation: "7b9 ~~",
      feel: "Главный «голос сердца» на гитаре — интонация живого пения, крика или нежного плача.",
      mechanics: "Тяни струну не одним пальцем, а связкой из 2–3 пальцев, вращая предплечье как дверную ручку. Вибрато — ровное ритмичное покачивание высоты вокруг целевой ноты.",
      emotionLink: "Подтяжка ровно на полтона (к b3 или 5) даёт хрупкую нежность; подтяжка на тон (2→3 или 4→5) — мощный эмоциональный взлёт.",
      drill5m: "Сначала сыграй целевую ноту чисто (на 2 лада выше), запомни её ухом, затем вернись на 2 лада ниже и подтяни струну точно в эту высоту — проверь точность в Тюнере!",
      tunerLink: { label: "🎚 Проверить точность подтяжки в Тюнере" },
      synthKind: "bend_vibrato",
      relSemis: [0, 2, 4, 7],
    },
    {
      id: "slide",
      short: "Слайд",
      name: "Слайд (скольжение по струне)",
      notation: "5/9\\7",
      feel: "Свобода горизонтального скольжения — мгновенно разрушает привычку «сидеть в одном месте».",
      mechanics: "Сохраняй равномерное прижатие на всём пути скольжения и заранее смотри глазами на целевой лад (палец всегда приходит туда, куда смотрит взгляд).",
      emotionLink: "Незаменим в восточных ладах (Хиджаз), распевных мелодиях, блюзе и кино — соединяет разные зоны грифа в одну линию.",
      drill5m: "Включи режим «1 струна» выше и сыграй 2-минутную импровизацию на одной 2-й или 3-й струне, соединяя все скачки плавными слайдами.",
      synthKind: "slide",
      relSemis: [0, 3, 7, 5, 3, 0],
    },
    {
      id: "swing",
      short: "Свинг",
      name: "Свинг и Шаффл (живой кач 2:1)",
      notation: "♪. ♪ (2:1)",
      feel: "Упругая телесная пружина и «пританцовывающая» свобода вместо механического марша.",
      mechanics: "Каждая пара восьмых делится не 50/50, а примерно 67/33 (как 1-я и 3-я ноты триоли: «ТА—да, ТА—да»). Акцент и лёгкое глушение приходятся на слабую долю.",
      emotionLink: "Мгновенно превращает сухую гамму в живой блюз, джаз, соул или тёплый акустический грув.",
      drill5m: "Запусти «Ударные» на кратности 1/8T (триоли) при 96 BPM и играй гамму парами «длинная — короткая», слегка приглушая короткую ноту.",
      drumLink: { sub: "1/8T", bpm: 96, label: "🥁 Джемовать свинг в Ударных (1/8T · 96 BPM)" },
      synthKind: "swing",
      relSemis: [0, 3, 5, 6, 7, 10, 7, 5, 3, 0],
    },
    {
      id: "tapping",
      short: "Тэппинг",
      name: "Двуручный тэппинг (стук правой рукой)",
      notation: "T12p5h8",
      feel: "Хрустальные широкие скачки и фортепианная прозрачность на гитаре.",
      mechanics: "Указательный или средний палец правой руки чётко бьёт по высокому ладу (обычно 12–17) и сдёргивает пулл-офф на ноту левой руки, после чего левая делает хаммер-он. В D Drop C и на 7-струнке открываются огромные арпеджио!",
      emotionLink: "Даёт ощущение звёздного простора, электронного арпеджиатора и драматического нарастания.",
      drill5m: "На одной 1-й или 2-й струне крути триоль T(12) → p(5) → h(8) под 84 BPM, затем сдвинь правую руку на 14-й и 15-й лад, меняя аккорд одной точкой.",
      drumLink: { sub: "1/8T", bpm: 84, label: "🥁 Тренировать тэппинг под 1/8T · 84 BPM" },
      synthKind: "tapping",
      relSemis: [12, 0, 3, 12, 0, 3, 14, 0, 3, 15, 0, 3],
    },
    {
      id: "sweep",
      short: "Свип",
      name: "Свип-арпеджио (волны по струнам)",
      notation: "↓ ↓ ↓ ↑ ↑ ↑",
      feel: "Вихревой взлёт аккорда — звук арфы или стремительной кино-волны.",
      mechanics: "Медиатор не бьёт каждую струну отдельно, а плавно «прометает» 3–5 струн одним движением вниз (и обратно вверх). Левая рука «перекатывается» по ладам, сразу отпуская отзвучавшую струну, чтобы ноты не сливались в кашу.",
      emotionLink: "Мощнейший инструмент кульминации и кинематографа: за секунду раскрывает весь аккорд на две октавы.",
      drill5m: "Начни с 3 тонких струн (минорная триада): 3-я→2-я→1-я одним движением вниз и обратно вверх под 66 BPM — чистота разделения нот важнее скорости!",
      drumLink: { sub: "1/8", bpm: 66, label: "🥁 Тренировать свип под 66 BPM" },
      synthKind: "sweep",
      relSemis: [0, 3, 7, 12, 15, 19, 15, 12, 7, 3, 0],
    },
    {
      id: "shred_alt",
      short: "Штрих ↓↑",
      name: "Переменный штрих (ровная скорость ↓↑)",
      notation: "↓ ↑ ↓ ↑ (1/16)",
      feel: "Железная чёткость, энергия, ритмический нерв и пробивная атака.",
      mechanics: "Правая рука работает как маятник строго ↓ ↑ ↓ ↑ без сбоев, минимальной амплитудой от запястья. На басовых струнах (Drop C / 7-я A) добавляй мягкое глушение ребром ладони у нижнего порожка.",
      emotionLink: "Передаёт драйв, собранность, боевой накал и точную ритмическую геометрию в 4/4, 5/4 и 7/8.",
      drill5m: "Играй четвёрки (1-2-3-4, 2-3-4-5, 3-4-5-6) строго переменным штрихом под 1/16 в разделе «Ударные» (начни с 84 BPM и прибавляй по +4 BPM, только когда звук чистый).",
      drumLink: { sub: "1/16", bpm: 84, label: "🥁 Тренировать штрих под 1/16 · 84 BPM" },
      synthKind: "shred_alt",
      relSemis: [0, 2, 3, 5, 2, 3, 5, 7, 3, 5, 7, 10, 12],
    },
    {
      id: "harmonics",
      short: "Флажолеты",
      name: "Флажолеты (Natural & Pinch Harmonics)",
      notation: "<12> <7> <5>",
      feel: "Хрустальный колокольчик, чистый воздух и физическая магия обертонов.",
      mechanics: "Натуральный флажолет: НЕ прижимай струну к дереву — лишь слегка коснись её подушечкой пальца прямо над металлическим порожком 12-го (октава 2:1), 7-го (квинта 3:1) или 5-го лада (две октавы 4:1) и сразу убери палец после щипка.",
      emotionLink: "Открывает ощущение космической прозрачности, паузы и невесомости; искусственный (Pinch) флажолет на перегрузе даёт пронзительный визжащий акцент.",
      drill5m: "Сыграй мелодию из натуральных флажолетов на 12-м и 7-м ладах 1–4 струн (на 7-струнке попробуй 5-й и 7-й лад на низкой A1!) и прислушайся, как долго они парят в воздухе.",
      synthKind: "harmonics",
      relSemis: [12, 19, 24, 19, 12],
    },
  ];

  /* Compute all scale positions across frets 0..15 for ANY 6- or 7-string tuning,
   * filtered cleanly by practice layout mode:
   *  - "full": all scale tones across 0..15
   *  - "zone": 4-fret cage [zoneStart .. zoneStart + 4] (Anti-Em/Am mastery!)
   *  - "one_string": single horizontal string (breaks vertical box habits!)
   *  - "3nps": 3 notes per string across all strings starting near zoneStart
   */
  function computeFretboardMap(opts) {
    const o = opts || {};
    const rootPc = ((Math.round(o.rootPc || 0) % 12) + 12) % 12;
    const modeId = o.modeId || "minor";
    const tuningId = o.tuningId || "standard_6";
    const layout = o.layout || "zone"; // "full" | "zone" | "one_string" | "3nps"
    const zoneStart = Math.max(0, Math.min(11, Math.round(o.zoneStart !== undefined ? o.zoneStart : 5)));
    const singleString = Math.max(1, Math.min(7, Math.round(o.singleString || 2)));
    const maxFret = 15;

    const spec = Theory ? Theory.getTuningSpec(tuningId) : { strings: 6, midis: [64, 59, 55, 50, 45, 40], short: "6 стр" };
    const mode = Harmony
      ? (Harmony.SCALE_MODES.find((m) => m.id === modeId) || Harmony.SCALE_MODES[1])
      : { id: "minor", name: "Минор", intervals: [0, 2, 3, 5, 7, 8, 10], color: "#818cf8" };

    const intervalSet = new Set(mode.intervals);
    const colorInterval = mode.intervals.find((s) => [6, 1, 8, 9, 3, 4].includes(s)) || mode.intervals[1] || 0;
    const points = [];

    for (let sIdx = 0; sIdx < spec.midis.length; sIdx++) {
      const strNum = sIdx + 1;
      if (layout === "one_string" && strNum !== Math.min(singleString, spec.strings)) continue;

      const openMidi = spec.midis[sIdx];
      const strPoints = [];
      for (let fret = 0; fret <= maxFret; fret++) {
        const midi = openMidi + fret;
        const semi = (((midi - rootPc) % 12) + 12) % 12;
        if (!intervalSet.has(semi)) continue;

        if (layout === "zone" && (fret < zoneStart || fret > zoneStart + 3)) continue;

        const degInfo = Theory ? Theory.describeDegree(midi, 60 + rootPc) : { deg: "1", role: "" };
        strPoints.push({
          string: strNum,
          fret,
          midi,
          semi,
          isTonic: semi === 0,
          isColor: semi === colorInterval,
          deg: degInfo.deg,
          noteEn: Theory ? Theory.midiToName(midi, false) : "",
          noteRu: Theory ? Theory.midiToName(midi, true) : "",
          pitchRu: Harmony ? Harmony.PC_NAMES_RU[midi % 12] : "",
        });
      }

      if (layout === "3nps") {
        // Pick 3 consecutive scale tones starting at or near zoneStart
        const startIdx = Math.max(0, strPoints.findIndex((p) => p.fret >= Math.max(1, zoneStart)));
        const slice = strPoints.slice(startIdx, startIdx + 3);
        const finalSlice = slice.length >= 2 ? slice : strPoints.slice(0, 3);
        finalSlice.forEach((p) => points.push(p));
      } else {
        strPoints.forEach((p) => points.push(p));
      }
    }

    // Build an ascending playable practice sequence from the mapped points (low string -> high string)
    const seq = points.slice().sort((a, b) => (b.string - a.string) || (a.fret - b.fret));
    const uniqueSeq = [];
    const seenM = new Set();
    for (const p of seq) {
      if (!seenM.has(p.midi)) {
        seenM.add(p.midi);
        uniqueSeq.push(p);
      }
    }

    const rootRu = Harmony ? Harmony.PC_NAMES_RU[rootPc] : String(rootPc);
    let challengeText = "";
    if (layout === "one_string") {
      challengeText = "Задание (1 струна): играй мелодию в «" + rootRu + " " + mode.name + "» только на " + Math.min(singleString, spec.strings) + "-й струне, соединяя шаги слайдами и хаммер-онами.";
    } else if (layout === "zone") {
      challengeText = "Задание (Зона " + zoneStart + "–" + (zoneStart + 3) + " лад): держи левую руку в этих 4 ладах — найди все тоники (" + rootRu + ") и спой фразу от них.";
    } else if (layout === "3nps") {
      challengeText = "Задание (3 ноты на струну): играй по 3 ноты на каждой струне с одним ударом медиатора (легато h-h вверх / p-p вниз) или строгим переменным штрихом ↓↑↓↑.";
    } else {
      challengeText = "Полная карта грифа (" + spec.short + "): найди все янтарные тоники «" + rootRu + "» от 0 до 15 лада и соедини две соседние зоны слайдом.";
    }

    return {
      tuningSpec: spec,
      mode,
      rootPc,
      rootRu,
      layout,
      zoneStart,
      singleString: Math.min(singleString, spec.strings),
      points,
      playSequence: uniqueSeq.slice(0, 14),
      challengeText,
    };
  }

  /* Pick the most playable anchor string (among strings 2..4) whose fret for rootPc lands cleanly
   * in [3..10] — ALWAYS preserving exact pitch class ((openMidi + rootFret) % 12 === rootPc)!
   */
  function pickTechniqueAnchor(rootPc, tuningId) {
    const spec = Theory ? Theory.getTuningSpec(tuningId) : { midis: [64, 59, 55, 50, 45, 40], short: "6 стр" };
    const pc = ((Math.round(rootPc || 0) % 12) + 12) % 12;
    const candidateIdxs = [2, 1, 3, 0].filter((i) => i < spec.midis.length);
    let best = null;
    for (const sIdx of candidateIdxs) {
      const openMidi = spec.midis[sIdx];
      let fret = (((pc - (openMidi % 12)) % 12) + 12) % 12;
      if (fret < 3) fret += 12;
      const distFromSweetSpot = Math.abs(fret - 6.5) + (fret > 11 ? 6 : 0) + (sIdx === 2 ? -0.4 : 0);
      if (!best || distFromSweetSpot < best.score) {
        best = { anchorStrIdx: sIdx, openMidi, rootFret: fret, baseMidi: openMidi + fret, spec, score: distFromSweetSpot };
      }
    }
    return best;
  }

  /* Format dynamic tab snippet for any technique adapted to the user's chosen 6/7-str tuning & key */
  function formatTechniqueTab(tech, rootPc, tuningId) {
    const a = pickTechniqueAnchor(rootPc, tuningId);
    const { anchorStrIdx, rootFret, baseMidi, spec } = a;

    if (tech.id === "harmonics") {
      return (anchorStrIdx + 1) + "-я стр. (" + spec.short + "): касание над порожком <12> → <7> → <5> лад (без прижатия)";
    }
    if (tech.id === "tapping") {
      return (anchorStrIdx + 1) + "-я стр.: T(" + (rootFret + 7) + ")p" + rootFret + "h" + (rootFret + 3) + " → T(" + (rootFret + 10) + ")p" + rootFret + "h" + (rootFret + 3);
    }
    if (tech.id === "bend_vibrato") {
      return (anchorStrIdx + 1) + "-я стр.: " + rootFret + " → " + (rootFret + 2) + "b" + (rootFret + 4) + " ~~ (подтяжка на тон + вибрато)";
    }
    if (tech.id === "slide") {
      return (anchorStrIdx + 1) + "-я стр.: " + rootFret + "/" + (rootFret + 3) + "/" + (rootFret + 7) + "\\" + (rootFret + 5) + "\\" + rootFret;
    }
    if (tech.id === "sweep") {
      return "3–2–1 стр. (" + spec.short + "): скольжение ↓ " + rootFret + " → " + (rootFret + 1) + " → " + rootFret + "h" + (rootFret + 3) + "p" + rootFret + " ↑";
    }
    if (tech.id === "legato") {
      return (anchorStrIdx + 1) + "-я стр.: " + rootFret + "h" + (rootFret + 2) + "h" + (rootFret + 3) + "p" + (rootFret + 2) + "p" + rootFret + " (1 удар медиатора)";
    }
    if (tech.id === "hammer_on") {
      return (anchorStrIdx + 1) + "-я стр.: " + rootFret + "h" + (rootFret + 2) + " · " + (rootFret + 3) + "h" + (rootFret + 5);
    }
    if (tech.id === "pull_off") {
      return (anchorStrIdx + 1) + "-я стр.: " + (rootFret + 5) + "p" + (rootFret + 3) + " · " + (rootFret + 2) + "p" + rootFret;
    }
    return (anchorStrIdx + 1) + "-я стр. (" + spec.short + ", база " + rootFret + " лад, " + (Theory ? Theory.midiToName(baseMidi, false) : "") + "): " + tech.notation;
  }

  /* Play realistic WebAudio synthesis of each of the 10 guitar techniques via resettable playbackBus */
  function playTechniqueDemo(audioEngine, tech, rootPc, onEnd) {
    if (!audioEngine || !tech) return;
    audioEngine.stopPlayback();
    const myId = audioEngine.playbackId;
    audioEngine.isPlaying = true;
    audioEngine.withActiveContext((ctx) => {
      if (audioEngine.playbackId !== myId) return;
      const outBus = typeof audioEngine.getPlaybackBus === "function" ? audioEngine.getPlaybackBus(ctx) : audioEngine.master;
      const track = (node) => { if (typeof audioEngine.trackSource === "function") audioEngine.trackSource(node); };
      const now = ctx.currentTime + 0.03;
      const base = 57 + (((rootPc % 12) + 12) % 12);
      const root = base > 64 ? base - 12 : base;
      let totalDurSec = 1.95;

      if (tech.synthKind === "bend_vibrato" || tech.synthKind === "slide") {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc.type = "triangle";
        osc2.type = "sawtooth";
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.18, now);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(1750, now);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.001, now);
        env.gain.linearRampToValueAtTime(0.36, now + 0.02);

        const f0 = Theory.midiToFreq(root);
        const f1 = Theory.midiToFreq(root + (tech.synthKind === "bend_vibrato" ? 2 : 7));
        const f2 = Theory.midiToFreq(root + (tech.synthKind === "bend_vibrato" ? 2 : 3));

        osc.frequency.setValueAtTime(f0, now);
        osc2.frequency.setValueAtTime(f0, now);

        if (tech.synthKind === "bend_vibrato") {
          osc.frequency.setValueAtTime(f0, now + 0.25);
          osc.frequency.exponentialRampToValueAtTime(f1, now + 0.62);
          osc2.frequency.setValueAtTime(f0, now + 0.25);
          osc2.frequency.exponentialRampToValueAtTime(f1, now + 0.62);

          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.setValueAtTime(5.6, now);
          lfoGain.gain.setValueAtTime(0, now);
          lfoGain.gain.setValueAtTime(0, now + 0.65);
          lfoGain.gain.linearRampToValueAtTime(f1 * 0.015, now + 0.9);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfoGain.connect(osc2.frequency);
          track(lfo);
          lfo.start(now);
          lfo.stop(now + 1.9);

          env.gain.setValueAtTime(0.32, now + 1.55);
          env.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
        } else {
          osc.frequency.exponentialRampToValueAtTime(f1, now + 0.45);
          osc.frequency.setValueAtTime(f1, now + 0.65);
          osc.frequency.exponentialRampToValueAtTime(f2, now + 1.05);
          osc.frequency.exponentialRampToValueAtTime(f0, now + 1.5);
          osc2.frequency.exponentialRampToValueAtTime(f1, now + 0.45);
          osc2.frequency.setValueAtTime(f1, now + 0.65);
          osc2.frequency.exponentialRampToValueAtTime(f2, now + 1.05);
          osc2.frequency.exponentialRampToValueAtTime(f0, now + 1.5);
          env.gain.setValueAtTime(0.30, now + 1.5);
          env.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
        }

        osc.connect(lp);
        osc2.connect(g2);
        g2.connect(lp);
        lp.connect(env);
        env.connect(outBus);
        track(osc);
        track(osc2);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 1.95);
        osc2.stop(now + 1.95);
      } else if (tech.synthKind === "harmonics") {
        const offsets = [12, 19, 24, 19, 12];
        totalDurSec = offsets.length * 0.44 + 0.9;
        offsets.forEach((semi, idx) => {
          const t = now + idx * 0.44;
          const freq = Theory.midiToFreq(root + semi);
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          const shimmer = ctx.createOscillator();
          shimmer.type = "sine";
          shimmer.frequency.setValueAtTime(freq * 2, t);
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(0.14, t);
          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, t);
          env.gain.linearRampToValueAtTime(0.28, t + 0.012);
          env.gain.exponentialRampToValueAtTime(0.0008, t + 1.35);
          osc.connect(env);
          shimmer.connect(sg);
          sg.connect(env);
          env.connect(outBus);
          track(osc);
          track(shimmer);
          osc.start(t);
          shimmer.start(t);
          osc.stop(t + 1.4);
          shimmer.stop(t + 1.4);
        });
      } else {
        const semis = tech.relSemis || [0, 2, 3, 5, 7];
        let cursor = now;
        semis.forEach((s, idx) => {
          let stepSec = 0.24;
          let vel = 0.82;
          if (tech.synthKind === "swing") {
            stepSec = idx % 2 === 0 ? 0.34 : 0.17;
            vel = idx % 2 === 0 ? 0.88 : 0.64;
          } else if (tech.synthKind === "tapping") {
            stepSec = 0.145;
            vel = idx % 3 === 0 ? 0.92 : 0.66;
          } else if (tech.synthKind === "sweep") {
            stepSec = 0.105;
            vel = 0.78;
          } else if (tech.synthKind === "shred_alt") {
            stepSec = 0.12;
            vel = idx % 4 === 0 ? 0.94 : 0.74;
          } else if (tech.synthKind === "legato") {
            stepSec = 0.135;
            vel = idx === 0 ? 0.90 : 0.60;
          } else if (tech.synthKind === "hammer_on" || tech.synthKind === "pull_off") {
            stepSec = idx % 2 === 0 ? 0.24 : 0.42;
            vel = idx % 2 === 0 ? 0.88 : 0.64;
          }
          audioEngine.playGuitarNote(root + s, cursor, Math.max(0.45, stepSec * 2.2), vel);
          cursor += stepSec;
        });
        totalDurSec = Math.max(0.6, cursor - now + 0.35);
      }

      const endTimer = setTimeout(() => {
        if (audioEngine.playbackId === myId) {
          audioEngine.isPlaying = false;
          if (typeof onEnd === "function") onEnd();
        }
      }, Math.round(totalDurSec * 1000));
      if (Array.isArray(audioEngine._timers)) audioEngine._timers.push(endTimer);
    });
  }

  return {
    ANTI_HABIT_ROOTS,
    GUITAR_TECHNIQUES,
    computeFretboardMap,
    pickTechniqueAnchor,
    formatTechniqueTab,
    playTechniqueDemo,
  };
});
