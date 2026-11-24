/* Main Application Controller for "Язык музыки" (Static Serverless Mini App + PWA)
 * Orchestrates 4 tabs + Golden Vertical Slice Studio + Scene Builder + Blind Ear Trainer.
 */
(function () {
  "use strict";

  const Theory = window.MusicTheory;
  const AudioEngine = window.MusicAudioEngine;
  const Triptych = window.TriptychVisualizer;
  const Harmony = window.MusicHarmonyLab;
  const FeelingsAtlas = window.MusicFeelingsAtlas;
  const GuitarLab = window.MusicGuitarLab;
  const Drums = window.MusicDrums;
  const Tuner = window.MusicTuner;
  const Storage = window.MusicStorage;
  const Analytics = window.MusicAnalytics || { track: () => {}, params: () => {}, screen: () => {} };

  const CATALOG_URL = "./music-catalog.json?v=113";
  const TRIBUTE_TG_URL = "https://t.me/tribute/app?startapp=dUHt";
  const TRIBUTE_WEB_URL = "https://web.tribute.tg/d/UHt";
  const RATES = [0.75, 1.0, 1.2];

  const ACT_SHORT_NAMES = {
    A1: "I · Физика и пульс",
    A2: "II · Ноты и гриф",
    A3: "III · Интервалы и слух",
    A4: "IV · Ступени и лады",
    A5: "V · Аккорды и гриф",
    A6: "VI · Кино и игры",
    A7: "VII · Свободная фраза",
    A8: "VIII · Акустика и форма",
    A9: "IX · Края света и бит",
  };

  const DENSITY_LABELS_RU = {
    solo: "Соло",
    acoustic: "Акустика",
    groove: "Полный грув",
  };

  const WORLD_MECHANIC_IDS = new Set(["E17", "E18", "E19", "E20"]);
  const RHYTHM_MECHANIC_IDS = new Set(["E08", "E12", "E16", "E17", "E19", "E20"]);

  const state = {
    catalog: null,
    atomsById: new Map(),
    emotionsById: new Map(),
    weeksByNum: new Map(),
    actsById: new Map(),

    store: null,
    audio: new AudioEngine(),

    activeTab: "route",
    returnTab: "route",
    selectedActId: "A1",
    emotionFilter: "all",

    // Studio state (Golden Vertical Slice)
    studioKind: "atom", // "atom" | "emotion"
    studioItem: null,
    studioViz: null,
    studioShowStaff: true,
    studioActiveGlossaryId: null,
    studioManualTuning: false,
    abMode: "full", // "full" | "A" | "B"
    loopOn: false,
    rateIdx: 1,
    transpose: 0,
    capo: 0,
    activePlayer: null, // "studio" | "atlas" | "cof" | "sphere" | "glab" | "gtech" | "scene" | "ear" | null

    // Scene Builder state
    sceneIds: ["E18", "E01", "E20"],
    sceneDensity: "acoustic",
    scenePickerMode: "mechanics", // "mechanics" (E01-E20) | "feelings" (F01-F60)
    sceneViz: null,
    scenePlaying: false,

    // Blind Ear Trainer state
    earMode: "interval",
    earChallenge: null,
    earAnswered: false,
    earChosenId: null,
    earViz: null,

    // Analog 120fps Tuner state
    tuner: null,
    tunerMode: "guitar",
    tunerActiveString: null,

    // Drum Groove Generator & Subdivision Metronome state
    drums: null,
    drumSub: "1/8",
    drumStyle: "rock",
    drumEditBarIdx: 0,
    drumPlayingBarIdx: -1,
    drumPlayingStepIdx: -1,
    drumLiveChord: null,
    drumTheoryVoice: "kick",
    drumTapTimes: [],

    // Emotions sub-views & Harmony Calculators state
    emotionSubTab: "atlas",  // "atlas" | "circle" | "sphere" | "guitar" | "scene" | "catalog"
    atlasFamily: "all",
    atlasQuery: "",
    atlasFeelingId: "F01",   // default: Тепло!
    atlasKeyPc: 0,           // default: До (C)
    atlasPlayingVar: -1,
    cofIndex: 0,             // 0..11 around Circle of Fifths (0 = C / Am)
    cofMode: "major",        // "major" | "minor"
    cofActiveOrbitIdx: 1,    // highlight maj7 / m7 petal by default
    cofProgression: [],      // [{ symbol, roman, midis, role }]
    cofActiveChordIdx: -1,
    cofPreviewChord: null,   // chord currently displayed on the live fretboard below Palette

    sphereRootPc: 0,         // 0..11 (C..B)
    sphereModeId: "lydian",  // default expressive mode
    spherePhrase: [],        // [{ midi, noteEn, noteRu, deg, beats }]
    sphereActiveMidi: null,

    // Guitar Freedom Lab (Anti-Em/Am Neck + 10 Techniques)
    glabRootPc: 6,           // default F# (intentionally breaks Em/Am autopilot!)
    glabModeId: "minor",
    glabLayout: "zone",      // "zone" | "one_string" | "3nps" | "full"
    glabZoneStart: 5,
    glabSingleString: 2,
    glabActiveMidi: null,
    glabTechId: "legato",

    // Interactive Spotlight Product Tour (Гид) & NFS Progressive Unlock Modal
    tourActive: false,
    tourStepIdx: 0,
    unlockModalMode: null,   // "lock" | "milestone" | null
    unlockModalTarget: null, // { kind: "tab"|"esub", id }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function h(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function initTelegramThemeLock() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("#0b0e14");
      if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("#0b0e14");
      if (typeof tg.setBottomBarColor === "function") tg.setBottomBarColor("#0b0e14");
    } catch (_) {}
  }

  /* Unified SessionContext helper: keeps root key & scale mode coherent across Atlas, Circle, Sphere, Guitar & Drums */
  function syncSessionContext(patch) {
    const p = patch || {};
    if (typeof p.rootPc === "number" && Number.isFinite(p.rootPc)) {
      const pc = ((Math.round(p.rootPc) % 12) + 12) % 12;
      state.atlasKeyPc = pc;
      state.sphereRootPc = pc;
      if (!p.keepGuitarRoot) state.glabRootPc = pc;
      if (Harmony) {
        const modeForCof = p.circleMode || state.cofMode || "major";
        const found = Harmony.CIRCLE_OF_FIFTHS.find((c) => (modeForCof === "minor" ? c.minPc === pc : c.pc === pc));
        if (found) {
          state.cofIndex = found.idx;
          state.cofMode = modeForCof;
        }
      }
      if (state.drums) {
        state.drums.backingRootPc = pc;
      }
      if (state.store) state.store.updateProfile({ sessionRootPc: pc });
    }
    if (typeof p.modeId === "string" && Harmony && Harmony.SCALE_MODES.some((m) => m.id === p.modeId)) {
      state.sphereModeId = p.modeId;
      state.glabModeId = p.modeId;
      if (state.store) state.store.updateProfile({ sessionModeId: p.modeId });
    }
  }

  /* 5 One-Click Emergent Handoff Bridges across tabs */
  function handoffToDrums(opts) {
    const o = opts || {};
    ensureDrums();
    const d = state.drums;
    if (!d) return;
    if (typeof o.rootPc === "number") {
      syncSessionContext({ rootPc: o.rootPc, keepGuitarRoot: true });
      d.backingRootPc = ((Math.round(o.rootPc) % 12) + 12) % 12;
    }
    if (o.bpm) d.bpm = Theory.clamp(Math.round(o.bpm), 48, 200);
    if (o.sub) {
      state.drumSub = o.sub;
      d.sub = o.sub;
    }
    if (Array.isArray(o.chords) && o.chords.length) {
      d.setCustomProgression(o.chords, o.progLabel || "Своя палитра");
      const targetLen = Math.max(1, Math.min(4, o.chords.length));
      const baseMeter = o.meter || (d.bars[0] ? d.bars[0].meter : "4/4");
      const nextBars = [];
      for (let i = 0; i < targetLen; i++) {
        nextBars.push(Drums.buildBarPattern(baseMeter, state.drumSub, { style: state.drumStyle, isFirstBar: i === 0 }));
      }
      d.setBars(nextBars);
      state.drumEditBarIdx = 0;
    } else if (o.meter) {
      d.setBars([Drums.buildBarPattern(o.meter, state.drumSub, { style: state.drumStyle, isFirstBar: true })]);
      state.drumEditBarIdx = 0;
    }
    if (o.enableBacking) {
      d.backingBassOn = true;
      if (d.backingSynthMode === "off") d.backingSynthMode = "pad";
    }
    if (state.store) state.store.logEvent("L02", "handoff_to_drums", { source: o.source || "unknown", custom: !!(o.chords && o.chords.length) });
    switchTab("drums");
  }

  function handoffToCircle(opts) {
    const o = opts || {};
    const mode = o.mode || "major";
    if (typeof o.rootPc === "number") {
      syncSessionContext({ rootPc: o.rootPc, circleMode: mode, keepGuitarRoot: true });
    }
    if (Array.isArray(o.chords) && o.chords.length) {
      state.cofProgression = o.chords.slice(0, 8);
      state.cofPreviewChord = state.cofProgression[0];
    }
    state.emotionSubTab = "circle";
    if (state.store) state.store.logEvent("L02", "handoff_to_circle", { source: o.source || "atlas" });
    switchTab("emotions");
  }

  function handoffToGuitarLab(opts) {
    const o = opts || {};
    if (typeof o.rootPc === "number") state.glabRootPc = ((Math.round(o.rootPc) % 12) + 12) % 12;
    if (o.modeId && Harmony && Harmony.SCALE_MODES.some((m) => m.id === o.modeId)) {
      state.glabModeId = o.modeId;
    }
    state.emotionSubTab = "guitar";
    if (state.store) state.store.logEvent("L02", "handoff_to_guitar", { source: o.source || "atlas" });
    switchTab("emotions");
  }

  function handoffToEar(opts) {
    const o = opts || {};
    state.earMode = o.mode || "ab_shift";
    state.earChallenge = Theory.generateEarChallenge(state.catalog, state.earMode, undefined, {
      focusAtom: o.focusAtom || null,
      rootMidi: o.rootMidi,
    });
    state.earAnswered = false;
    state.earChosenId = null;
    if (state.store) state.store.logEvent("L02", "handoff_to_ear", { mode: state.earMode, atomId: o.focusAtom ? o.focusAtom.id : null });
    switchTab("ear");
  }

  function stopAllAudio() {
    state.audio.stopPlayback();
    if (state.drums && state.drums.isPlaying) {
      state.drums.stop();
    }
    state.drumPlayingBarIdx = -1;
    state.drumPlayingStepIdx = -1;
    state.drumLiveChord = null;
    state.scenePlaying = false;
    state.activePlayer = null;
    state.atlasPlayingVar = -1;
    state.cofActiveChordIdx = -1;
    state.sphereActiveMidi = null;
    state.glabActiveMidi = null;
    document.querySelectorAll("#drum-grid .now, #drum-bars-chain .bar-chip-playing, .drum-count-box.pulse-hit, .drum-count-box.silent-gap").forEach((el) => {
      el.classList.remove("now", "bar-chip-playing", "pulse-hit", "silent-gap");
    });
    updatePlayButtons();
  }

  function updatePlayButtons() {
    const playing = state.audio.isPlaying;
    const setBtn = (id, isOn, playLbl, stopLbl) => {
      const btn = $(id);
      if (!btn) return;
      btn.textContent = isOn ? (stopLbl || "■ Стоп") : playLbl;
      btn.classList.toggle("playing", !!isOn);
    };

    const studioOn = playing && state.activePlayer === "studio" && !$("view-studio").classList.contains("hidden");
    setBtn("btn-play", studioOn, "▶ Послушать");
    setBtn("btn-atlas-play-main", playing && state.activePlayer === "atlas", "▶ Послушать");
    setBtn("btn-cof-play", playing && state.activePlayer === "cof", "▶ Сыграть палитру");
    setBtn("btn-sphere-play", playing && state.activePlayer === "sphere", "▶ Сыграть фразу");
    setBtn("btn-glab-play", playing && state.activePlayer === "glab", "▶ Послушать");
    setBtn("btn-gtech-play", playing && state.activePlayer === "gtech", "▶ Звук");
    setBtn("btn-scene-play", state.scenePlaying, "▶ Сыграть сцену");
    setBtn("btn-ear-play", playing && state.activePlayer === "ear", "▶ Послушать");

    const drumsOn = !!(state.drums && state.drums.isPlaying);
    setBtn("btn-drum-play", drumsOn, "▶ Старт");
    setBtn("btn-drum-play-mini", drumsOn, "▶ Старт");
  }

  function updateHud() {
    if (!state.catalog || !state.store) return;
    const done = state.store.progress.completedAtoms.length;
    const total = state.catalog.atoms.length;
    $("hud-pill").textContent = "⚙ " + done + " / " + total;
    applyProgressiveLocks();
  }

  function getNextUncompletedAtom() {
    if (!state.catalog || !state.store) return null;
    const completed = new Set(state.store.progress.completedAtoms || []);
    return state.catalog.atoms.find((a) => !completed.has(a.id)) || state.catalog.atoms[0];
  }

  function applyProgressiveLocks() {
    if (!state.store) return;
    document.querySelectorAll("#main-tabs .tab").forEach((btn) => {
      const tab = btn.dataset.tab;
      btn.classList.toggle("locked", !state.store.isUnlocked(tab));
    });
    document.querySelectorAll("#emotions-subtabs .pill").forEach((btn) => {
      const sub = btn.dataset.esub;
      btn.classList.toggle("locked", !state.store.isUnlocked(sub));
    });
    const tunerBtn = $("btn-open-tuner");
    if (tunerBtn) tunerBtn.classList.toggle("active", state.activeTab === "tuner");
  }

  const LOCK_META = {
    ear:     { label: "Слух",             reqLesson: 1, desc: "Слепой тренажёр слуха откроется автоматически после Урока 1 — чтобы на старте ничего не отвлекало." },
    drums:   { label: "Ударные и джем",   reqLesson: 2, desc: "Ударная установка и джем-минус откроются после Урока 2 — когда ухо уже поймает основу звука." },
    circle:  { label: "Круг и аккорды",   reqLesson: 2, desc: "Кварто-квинтовый круг и аппликатуры откроются после Урока 2." },
    sphere:  { label: "Сфера и древо",    reqLesson: 3, desc: "Сфера гамм и построение фраз откроются после Урока 3." },
    guitar:  { label: "Гриф и техники",   reqLesson: 3, desc: "Карта грифа и 10 техник гитары откроются после Урока 3." },
    scene:   { label: "Сцена",            reqLesson: 3, desc: "Конструктор музыкальных сцен откроется после Урока 3." },
    catalog: { label: "20 приёмов",       reqLesson: 3, desc: "Коллекция 20 приёмов кино и мира откроется после Урока 3." },
  };

  function openLockPrompt(featureKey, target) {
    const modal = $("unlock-modal");
    if (!modal) return;
    const meta = LOCK_META[featureKey] || { label: "Раздел студии", reqLesson: 1, desc: "Откроется по мере прохождения уроков." };
    const nextAtom = getNextUncompletedAtom();
    const nextNum = nextAtom ? (state.catalog.atoms.indexOf(nextAtom) + 1) : 1;

    state.unlockModalMode = "lock";
    state.unlockModalTarget = target || null;

    $("unlock-badge").textContent = "🔒 Карта студии · шаг " + meta.reqLesson;
    $("unlock-title").textContent = "«" + meta.label + "» откроется после Урока " + meta.reqLesson;
    $("unlock-body").textContent = meta.desc + " Хочешь открыть всю студию прямо сейчас или продолжить по шагам?";
    $("btn-unlock-go").textContent = "🔓 Разблокировать всё сразу";
    $("btn-unlock-close").textContent = "▶ Вернуться к прогрессу (Урок " + nextNum + ")";
    $("unlock-tribute-box").classList.add("hidden");
    modal.classList.remove("hidden");
  }

  function openMilestoneModal(level) {
    const modal = $("unlock-modal");
    if (!modal) return;
    const specs = {
      1: {
        badge: "🎉 Новая зона · 2 / 4",
        title: "Открыт тренажёр «Слух»!",
        body: "Первый шаг позади — теперь ты можешь проверять свой слух без подсказок во вкладке «Слух».",
        cta: "👂 Попробовать «Слух»",
        target: { kind: "tab", id: "ear" },
      },
      2: {
        badge: "🎉 Новая зона · 3 / 4",
        title: "Открыты «Ударные» и «Круг аккордов»!",
        body: "Теперь доступны живой бит с басом и квинтовый круг аккордов с аппликатурами для гитары.",
        cta: "🥁 Открыть «Ударные»",
        target: { kind: "tab", id: "drums" },
      },
      3: {
        badge: "🎉 Вся карта открыта · 4 / 4",
        title: "Открыта вся Студия!",
        body: "Сфера фраз, Гриф и 10 техник, Конструктор сцен и 20 приёмов кино теперь полностью в твоих руках.",
        cta: "🎸 Открыть Студию",
        target: { kind: "esub", id: "guitar" },
      },
    };
    const sp = specs[level];
    if (!sp) return;

    state.unlockModalMode = "milestone";
    state.unlockModalTarget = sp.target;

    $("unlock-badge").textContent = sp.badge;
    $("unlock-title").textContent = sp.title;
    $("unlock-body").textContent = sp.body;
    $("btn-unlock-go").textContent = sp.cta;
    $("btn-unlock-close").textContent = "Продолжить по пути →";
    $("unlock-tribute-copy").textContent = "💛 Приложение бесплатное и без рекламы. Если уроки и студия нравятся — можно поддержать автора любой суммой в Tribute:";
    $("btn-unlock-tribute").textContent = "💛 Поддержать проект в Tribute";
    $("unlock-tribute-box").classList.remove("hidden");
    modal.classList.remove("hidden");
  }

  function closeUnlockModal() {
    const modal = $("unlock-modal");
    if (modal) modal.classList.add("hidden");
    state.unlockModalMode = null;
    state.unlockModalTarget = null;
  }

  function isInsideTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return Boolean(tg && (tg.initData || (tg.platform && tg.platform !== "unknown")));
  }

  function openTributeDonation(placement) {
    const tg = window.Telegram && window.Telegram.WebApp;
    const inTg = isInsideTelegram();
    const targetUrl = inTg ? TRIBUTE_TG_URL : TRIBUTE_WEB_URL;
    if (state.store) {
      state.store.recordProInterest("tribute_" + (placement || "rhythm"));
    }
    Analytics.track("donate_click", { provider: "tribute", placement: placement || "rhythm", env: inTg ? "telegram" : "web" });
    if (state.activeTab === "rhythm") renderRhythmTab();
    if (inTg && tg && typeof tg.openTelegramLink === "function") {
      tg.openTelegramLink(targetUrl);
    } else if (inTg && tg && typeof tg.openLink === "function") {
      tg.openLink(TRIBUTE_WEB_URL);
    } else {
      window.open(TRIBUTE_WEB_URL, "_blank", "noopener,noreferrer");
    }
  }

  function switchTab(tabName) {
    stopAllAudio();
    state.audio.setDrone(false);
    state.audio.setMetronome(false);
    state.audio.setRate(1.0);
    state.rateIdx = 1;
    if (tabName !== "tuner" && state.tuner && (state.tuner.running || state.tuner._starting)) {
      state.tuner.stopMic();
    }
    if (tabName !== "rhythm" && tabName !== "tuner") state.returnTab = tabName;
    state.activeTab = tabName;

    const views = {
      route: $("view-route"),
      emotions: $("view-emotions"),
      ear: $("view-ear"),
      drums: $("view-drums"),
      tuner: $("view-tuner"),
      rhythm: $("view-rhythm"),
      studio: $("view-studio"),
    };
    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    $("view-loading").classList.add("hidden");

    if (views[tabName]) views[tabName].classList.remove("hidden");

    // Avoid double Tribute card on My Rhythm screen
    const supportFooter = $("app-support-footer");
    if (supportFooter) supportFooter.classList.toggle("hidden", tabName === "rhythm");

    document.querySelectorAll("#main-tabs .tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    const hud = $("hud-pill");
    if (hud) hud.classList.toggle("active", tabName === "rhythm");
    applyProgressiveLocks();

    if (tabName === "emotions" && state.store && !state.store.isUnlocked(state.emotionSubTab)) {
      state.emotionSubTab = "atlas";
    }

    if (tabName === "route") renderRoute();
    if (tabName === "emotions") renderEmotionsTab();
    if (tabName === "ear") renderEarTab();
    if (tabName === "drums") renderDrumsTab();
    if (tabName === "tuner") renderTunerTab();
    if (tabName === "rhythm") renderRhythmTab();

    Analytics.screen(tabName, "Язык музыки · " + tabName);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function getUserTuningId() {
    return (state.store && state.store.profile && state.store.profile.guitarTuning) || "standard_6";
  }

  function getEffectiveStudioTuningId(item) {
    const userTuning = getUserTuningId();
    if (!state.studioManualTuning && userTuning === "standard_6" && Theory.isDropDItem(item)) return "drop_d_6";
    return userTuning;
  }

  function setUserTuning(tuningId) {
    state.studioManualTuning = true;
    state.store.updateProfile({ guitarTuning: tuningId });
    if (state.tuner) state.tuner.setTuning(tuningId);
    if (!$("view-studio").classList.contains("hidden")) renderStudioContent();
    if (state.activeTab === "emotions") renderEmotionsTab();
    if (state.activeTab === "tuner") renderTunerTab();
    if (state.activeTab === "rhythm") renderRhythmTab();
  }

  function renderTuningPills(container, activeId) {
    if (!container) return;
    container.textContent = "";
    Theory.GUITAR_TUNING_ORDER.forEach((tid) => {
      const spec = Theory.getTuningSpec(tid);
      const btn = h("button", "pill" + (tid === activeId ? " active" : ""), spec.short);
      btn.type = "button";
      btn.addEventListener("click", () => setUserTuning(tid));
      container.appendChild(btn);
    });
  }

  /* ========================= TAB 1: ROUTE ========================= */
  function renderRoute() {
    const cat = state.catalog;
    const store = state.store;
    if (!cat || !store) return;
    updateHud();

    // Clean 1-Screen Hero Card: Next step + NFS Unlock progress (zero Lineage-2 clutter!)
    const doneCount = store.progress.completedAtoms.length;
    const nextAtom = getNextUncompletedAtom() || cat.atoms[0];
    const nextIdx = nextAtom ? cat.atoms.indexOf(nextAtom) : 0;
    const nextOv = nextAtom ? Theory.getSimpleLessonOverlay(nextAtom) : null;
    const lvl = store.getUnlockLevel();

    const kickerEl = $("route-next-kicker");
    if (kickerEl) kickerEl.textContent = "Шаг " + (nextIdx + 1) + " из " + cat.atoms.length + " · Неделя " + (nextAtom ? nextAtom.week : 1);
    const chipEl = $("route-unlock-chip");
    if (chipEl) chipEl.textContent = lvl >= 3 ? "Студия открыта" : "Открыто " + (lvl + 1) + " / 4 зон";
    const titleEl = $("route-next-title");
    if (titleEl) titleEl.textContent = (nextOv && nextOv.title) || (nextAtom ? nextAtom.title : "Урок 1");
    const subEl = $("route-next-sub");
    if (subEl) {
      subEl.textContent = doneCount === 0
        ? "5 минут без сложных терминов: слушаешь, пробуешь на клавишах — и шаг за шагом открываешь всю студию."
        : (nextOv && nextOv.simpleSummary ? nextOv.simpleSummary : "Короткий шаг на слух и пальцы.");
    }
    const startBtn = $("btn-start-day1");
    if (startBtn) {
      startBtn.textContent = doneCount === 0 ? "▶ Начать Урок 1" : "▶ Продолжить: Урок " + (nextIdx + 1);
    }

    // Subtle unlock teaser / sandbox switcher right under CTA
    const teaserEl = $("route-unlock-teaser");
    if (teaserEl) {
      teaserEl.textContent = "";
      if (lvl < 3) {
        const nextZone = lvl === 0 ? "После Урока 1 откроется «Слух»" : lvl === 1 ? "После Урока 2 откроются «Ударные» и «Круг»" : "После Урока 3 откроется вся Студия";
        teaserEl.appendChild(h("span", "", "🗺 " + nextZone));
        const unlockBtn = h("button", "btn-link", "🔓 Открыть всё сразу");
        unlockBtn.type = "button";
        unlockBtn.addEventListener("click", () => {
          store.setSandboxUnlocked(true);
          updateHud();
          renderRoute();
        });
        teaserEl.appendChild(unlockBtn);
      } else if (store.profile.sandboxUnlocked && doneCount < 3) {
        teaserEl.appendChild(h("span", "", "🔓 Свободный режим: вся студия открыта"));
        const backBtn = h("button", "btn-link", "Вернуть по шагам");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => {
          store.setSandboxUnlocked(false);
          updateHud();
          renderRoute();
        });
        teaserEl.appendChild(backBtn);
      }
    }

    // Due Ebbinghaus Review Banner
    const dueIds = store.getDueReviewIds(4);
    const dueBanner = $("due-banner");
    dueBanner.textContent = "";
    if (dueIds.length) {
      dueBanner.classList.remove("hidden");
      const firstDue = state.atomsById.get(dueIds[0]);
      const dueOv = firstDue ? Theory.getSimpleLessonOverlay(firstDue) : null;
      const copy = h("div", "banner-copy");
      copy.appendChild(h("div", "banner-title", "Освежить на слух (" + dueIds.length + ")"));
      copy.appendChild(h("div", "banner-sub", firstDue ? ((dueOv && dueOv.title) || firstDue.title) : dueIds[0]));
      const btn = h("button", "btn secondary", "Повторить");
      btn.type = "button";
      btn.addEventListener("click", () => openStudio("atom", dueIds[0], "route"));
      dueBanner.appendChild(copy);
      dueBanner.appendChild(btn);
    } else {
      dueBanner.classList.add("hidden");
    }

    // 9 Act Pills (inside collapsed #route-map-details)
    const rail = $("act-pills");
    rail.textContent = "";
    cat.acts.forEach((act) => {
      const btn = h("button", "pill" + (act.id === state.selectedActId ? " active" : ""), ACT_SHORT_NAMES[act.id] || act.id);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.selectedActId = act.id;
        store.updateProfile({ lastActId: act.id });
        renderRoute();
      });
      rail.appendChild(btn);
    });

    // Selected Act Hero + Collapsed Weeks
    const act = state.actsById.get(state.selectedActId) || cat.acts[0];
    const completedSet = new Set(store.progress.completedAtoms);
    const actAtoms = cat.atoms.filter((a) => a.act === act.id);
    const actDone = actAtoms.filter((a) => completedSet.has(a.id)).length;

    $("act-kicker").textContent = "Глава " + act.id.slice(1) + " · Недели " + act.weeks[0] + "–" + act.weeks[act.weeks.length - 1] + " · " + actDone + "/" + actAtoms.length;
    $("act-title").textContent = act.title.replace(/^Акт\s+[IVX]+:\s*/i, "");
    $("act-progress-fill").style.width = (actAtoms.length ? Math.round((actDone / actAtoms.length) * 100) : 0) + "%";

    const weeksWrap = $("weeks-list");
    weeksWrap.textContent = "";

    act.weeks.forEach((wNum) => {
      const w = state.weeksByNum.get(wNum);
      if (!w) return;
      // All weeks start collapsed by default so screen never turns into a wall of text!
      const details = h("details", "week-card week-details");

      const summary = h("summary", "");
      const head = h("div", "week-head");
      const wDone = (w.atom_ids || []).filter((id) => completedSet.has(id)).length;
      head.appendChild(h("span", "week-num", "Неделя " + w.week + " · " + wDone + "/" + (w.atom_ids || []).length));
      const firstLens = (w.lenses && w.lenses[0]) ? Theory.getLensNameRu(w.lenses[0]) : "";
      if (firstLens) head.appendChild(h("span", "chip", firstLens));
      summary.appendChild(head);
      summary.appendChild(h("h2", "", w.title));
      summary.appendChild(h("p", "week-goal", w.goal));
      details.appendChild(summary);

      const body = h("div", "week-details-body");
      const list = h("div", "atom-list");
      let weekMeter = "4/4";
      let weekBpm = 96;
      let weekRootPc = 0;

      (w.atom_ids || []).forEach((aid) => {
        const atom = state.atomsById.get(aid);
        if (!atom) return;
        if (atom.music && atom.music.meter) weekMeter = atom.music.meter;
        if (atom.music && atom.music.bpm) weekBpm = atom.music.bpm;
        if (atom.music && typeof atom.music.drone_midi === "number") weekRootPc = atom.music.drone_midi % 12;

        const isDone = completedSet.has(atom.id);
        const em = Theory.getEmotionMeta(atom.emotion_tag);
        const row = h("button", "atom-row" + (isDone ? " done" : ""));
        row.type = "button";

        const left = h("div", "atom-row-left");
        const dot = h("span", "atom-dot");
        dot.style.background = em.accent;
        const txt = h("div", "atom-row-text");
        const ov = Theory.getSimpleLessonOverlay(atom);
        txt.appendChild(h("div", "atom-row-title", (ov && ov.title) || atom.title));
        const subMeta = "День " + atom.day + " · " + em.label + (atom.music ? " · шаг " + atom.music.meter : "");
        txt.appendChild(h("div", "atom-row-sub", subMeta));
        left.appendChild(dot);
        left.appendChild(txt);

        const st = h("span", "atom-row-status", isDone ? "✓" : "▶");
        row.appendChild(left);
        row.appendChild(st);
        row.addEventListener("click", () => openStudio("atom", atom.id, "route"));
        list.appendChild(row);
      });
      body.appendChild(list);

      if (w.jam_day) {
        const jamBtn = h("button", "jam-box jam-box-btn", "🥁 День 7 · Свободный джем: " + w.jam_day + " →");
        jamBtn.type = "button";
        jamBtn.addEventListener("click", () => {
          handoffToDrums({ rootPc: weekRootPc, meter: weekMeter, bpm: weekBpm, enableBacking: true, source: "week_" + w.week + "_jam" });
        });
        body.appendChild(jamBtn);
      }
      details.appendChild(body);
      weeksWrap.appendChild(details);
    });
  }

  /* ========================= STUDIO (GOLDEN VERTICAL SLICE) ========================= */
  function openStudio(kind, id, returnTab) {
    stopAllAudio();
    state.studioKind = kind;
    state.returnTab = returnTab || state.activeTab || "route";
    state.abMode = "full";
    state.loopOn = false;
    state.rateIdx = 1;
    state.studioManualTuning = false;
    state.audio.setRate(1.0);
    state.audio.setMetronome(false);

    const item = kind === "emotion" ? state.emotionsById.get(id) : state.atomsById.get(id);
    if (!item) return;
    state.studioItem = item;
    const ov = Theory.getSimpleLessonOverlay(item);
    state.studioShowStaff = !(ov && ov.hideStaffByDefault);
    state.studioActiveGlossaryId = null;
    const advEl = $("studio-advanced-details");
    if (advEl) advEl.open = false;
    const moreEl = $("studio-more-details");
    if (moreEl) moreEl.open = false;
    const soundTip = $("sound-help-tip");
    if (soundTip) soundTip.classList.add("hidden");

    if (kind === "atom") {
      state.store.updateProfile({ lastAtomId: item.id, lastActId: item.act });
      state.selectedActId = item.act;
    }

    // Apply stored instrument, transpose & droneDefault cleanly (and retune active drone on ‹ / › step!)
    state.transpose = state.store.profile.transpose || 0;
    state.capo = state.store.profile.capo || 0;
    state.audio.setTimbre(state.store.profile.timbre || "guitar");
    state.audio.setTranspose(state.transpose);
    const shouldDrone = !!(state.audio.droneOn || state.store.profile.droneDefault);
    state.audio.setDrone(shouldDrone, getEffectiveDroneMidi());

    // Show studio view
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    $("view-loading").classList.add("hidden");
    $("view-studio").classList.remove("hidden");

    if (!state.studioViz) {
      state.studioViz = new Triptych($("studio-triptych"), {
        onNoteClick: (midi, source) => {
          state.audio.unlock();
          state.audio.playNote(midi, { duration: 1.35, velocity: 0.85 });
          const rootM = getEffectiveDroneMidi();
          const deg = Theory.scaleDegreeLabel(midi, rootM);
          const sourceRu = source === "piano" ? "Клавиши" : source === "guitar" ? "Гриф" : "Нотный стан";
          state.studioViz.setActiveMidis(
            [midi],
            sourceRu + " → " + Theory.midiToLabelPair(midi) + (deg ? " · ступень " + deg : "") + " · " + Math.round(Theory.midiToFreq(midi)) + " Гц"
          );
        },
      });
    }

    renderStudioContent();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function getEffectiveDroneMidi() {
    const m = state.studioItem && state.studioItem.music;
    const base = (m && (m.drone_midi || (m.midi_notes && m.midi_notes[0]))) || 48;
    return Theory.transposeMidi(base, state.transpose);
  }

  function getStudioActiveTimeline() {
    const item = state.studioItem;
    if (!item || !item.music) return [];
    const cab = item.music.contrast_ab;
    if (state.abMode === "A" && cab && Array.isArray(cab.a_events) && cab.a_events.length) {
      return cab.a_events;
    }
    if (state.abMode === "B" && cab && Array.isArray(cab.b_events) && cab.b_events.length) {
      return cab.b_events;
    }
    return item.music.timeline || [];
  }

  function renderStudioContent() {
    const item = state.studioItem;
    if (!item) return;
    const m = item.music || {};
    const em = Theory.getEmotionMeta(item.emotion_tag);

    $("studio-id-badge").textContent = item.id;
    const emBadge = $("studio-emotion-badge");
    emBadge.textContent = em.label;
    emBadge.style.background = em.soft;
    emBadge.style.color = em.accent;

    const ov = Theory.getSimpleLessonOverlay(item);
    $("studio-meter-badge").textContent = "Шаг " + (m.meter || "4/4");
    const primaryLens = (item.lenses && item.lenses[0]) ? Theory.getLensNameRu(item.lenses[0]) : "Музыкальная теория";
    $("studio-lenses-badge").textContent = primaryLens;
    $("studio-title").textContent = (ov && ov.title) || item.title;

    if (state.studioKind === "atom") {
      const act = state.actsById.get(item.act);
      const cleanActTitle = act ? act.title.replace(/^Акт\s+[IVX]+:\s*/i, "") : "";
      $("studio-subtitle").textContent = "Неделя " + item.week + ", день " + item.day + (cleanActTitle ? " · " + cleanActTitle : "");
    } else {
      const chords = (m.chord_progression || []).join(" → ");
      $("studio-subtitle").textContent = chords ? "Аккорды: " + chords : "Музыкальная краска и движение";
    }

    // Plain kid-friendly summary + automatic clickable glossary pills
    const simpleSummary = (ov && ov.simpleSummary) ||
      (state.studioKind === "atom" && item.experience ? item.experience.ontology_invariant : item.mechanism) || "";
    $("studio-simple-text").textContent = simpleSummary;

    const terms = Theory.detectTermsInItem(item);
    const glWrap = $("studio-glossary-wrap");
    const glPills = $("studio-glossary-pills");
    const glPop = $("studio-glossary-popup");
    glPills.textContent = "";
    if (terms.length) {
      glWrap.classList.remove("hidden");
      terms.forEach((termObj) => {
        const isOpen = state.studioActiveGlossaryId === termObj.id;
        const btn = h("button", "glossary-pill" + (isOpen ? " active" : ""), "? " + termObj.term);
        btn.type = "button";
        btn.addEventListener("click", () => {
          state.studioActiveGlossaryId = isOpen ? null : termObj.id;
          renderStudioContent();
        });
        glPills.appendChild(btn);
      });
      const activeTerm = terms.find((t) => t.id === state.studioActiveGlossaryId);
      if (activeTerm) {
        glPop.classList.remove("hidden");
        glPop.textContent = activeTerm.term + " — " + activeTerm.plain;
      } else {
        glPop.classList.add("hidden");
      }
    } else {
      glWrap.classList.add("hidden");
    }

    // Staff toggle label
    $("btn-toggle-staff").textContent = state.studioShowStaff ? "Скрыть нотный стан" : "+ Показать нотный стан";

    // Contrast A/B box (humanized labels, zero internal jargon)
    const cab = m.contrast_ab;
    const cBox = $("contrast-box");
    const labelA = Theory.humanizeContrastLabel(cab && cab.a_label, "A");
    const labelB = Theory.humanizeContrastLabel(cab && cab.b_label, "B");
    if (cab && cab.a_events && cab.b_events) {
      cBox.classList.remove("hidden");
      $("btn-ab-a").textContent = labelA;
      $("btn-ab-b").textContent = labelB;
      $("btn-ab-a").className = "ab-btn" + (state.abMode === "A" ? " active-a" : "");
      $("btn-ab-b").className = "ab-btn" + (state.abMode === "B" ? " active-b" : "");
      $("ab-hint").textContent = Theory.humanizeContrastHint(cab.shift_hint);
    } else {
      cBox.classList.add("hidden");
    }

    // Transport buttons state
    $("btn-loop").setAttribute("aria-pressed", String(state.loopOn));
    $("btn-timbre").textContent = state.audio.timbre === "piano" ? "Пианино" : "Гитара";
    $("btn-drone").setAttribute("aria-pressed", String(state.audio.droneOn));
    $("btn-drone").textContent = "Фон-нота: " + (state.audio.droneOn ? Theory.midiToPitchClass(getEffectiveDroneMidi(), true) : "выкл");
    $("btn-metro").setAttribute("aria-pressed", String(state.audio.metronomeOn));
    $("btn-rate").textContent = "Темп " + RATES[state.rateIdx].toFixed(2).replace(/\.00$/, ".0") + "×";
    $("tr-val").textContent = (state.transpose > 0 ? "+" : "") + state.transpose + " шаг.";
    $("capo-val").textContent = state.capo + " лад";

    // Sync Triptych geometry & highlights
    const activeTimeline = getStudioActiveTimeline();
    const scaleRaw = state.abMode === "full"
      ? (m.midi_notes || [])
      : [...new Set(activeTimeline.flatMap((ev) => ev.midis || []))];
    const scaleTransposed = Theory.transposeMidis(scaleRaw, state.transpose);
    const diffInfo = cab ? Theory.computeContrastDiff(
      Theory.transposeEvents(cab.a_events, state.transpose),
      Theory.transposeEvents(cab.b_events, state.transpose)
    ) : { addedInB: [] };

    const cleanAbLabel = (raw, fallback) => String(raw || fallback).replace(/^[AB]:\s*/i, "");
    const captionBase = state.abMode === "A"
      ? "Режим A · " + cleanAbLabel(labelA, "Обычное звучание")
      : state.abMode === "B"
        ? "Режим B · " + cleanAbLabel(labelB, "Пример из урока")
        : "Нажми «Послушать» или коснись любой клавиши / лада (" + scaleTransposed.slice(0, 6).map((x) => Theory.midiToName(x, true)).join(" · ") + ").";

    const effectiveTuning = getEffectiveStudioTuningId(item);
    renderTuningPills($("studio-tuning-pills"), effectiveTuning);

    state.studioViz.setState({
      scaleMidis: scaleTransposed,
      activeMidis: [],
      rootMidi: getEffectiveDroneMidi(),
      diffPitchClasses: state.abMode === "A" ? [] : diffInfo.addedInB,
      clef: m.staff_clef || "grand",
      showStaff: state.studioShowStaff,
      tuningId: effectiveTuning,
      dropD: effectiveTuning === "drop_d_6",
      capo: state.capo,
      blindMode: false,
      caption: captionBase,
    });

    // Immersive Music Theory & Feeling Anatomy (updates live with Transposer, Capo & Guitar Tuning!)
    const anatomy = Theory.describeMusicalAnatomy(item, {
      transpose: state.transpose,
      capo: state.capo,
      tuningId: effectiveTuning,
    });
    $("anatomy-tonic").textContent = anatomy.tonicLabel;

    const degWrap = $("anatomy-degrees");
    degWrap.textContent = "";
    anatomy.degreeChips.forEach((chip) => {
      const isTonic = chip.deg === "1";
      const isDiff = state.abMode !== "A" && diffInfo.addedInB.includes(((chip.midi % 12) + 12) % 12);
      const btn = h("button", "deg-chip" + (isTonic ? " tonic" : isDiff ? " expressive" : ""));
      btn.type = "button";
      btn.appendChild(h("span", "deg-num", chip.deg));
      btn.appendChild(h("span", "", chip.pitchRu + " · " + chip.role.split(" (")[0]));
      btn.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playNote(chip.midi, { duration: 1.4, velocity: 0.85 });
        state.studioViz.setActiveMidis(
          [chip.midi],
          "Ступень " + chip.deg + " (" + chip.noteRu + " / " + chip.noteEn + ") — " + chip.feel
        );
      });
      degWrap.appendChild(btn);
    });

    const harmonyText = anatomy.chordSummary || anatomy.intervalSummary || anatomy.expressiveNoteStory;
    const harmEl = $("anatomy-harmony");
    harmEl.textContent = harmonyText;
    harmEl.classList.toggle("hidden", !harmonyText);
    $("anatomy-rhythm").textContent = anatomy.rhythmStory;

    $("hands-guitar").textContent = "Гриф: " + (anatomy.guitarGuide || "открытые струны и удобная позиция");
    $("hands-piano").textContent = "Клавиши: " + (anatomy.pianoGuide || "");

    if (state.studioKind === "atom" && item.experience) {
      const ex = item.experience;
      const hasDistinctSimple = !!(ov && ov.simpleSummary);
      $("layer-sensory").textContent = ex.sensory_emotion_channel || "";
      $("layer-feeling-trigger").textContent = anatomy.contrastStory || anatomy.expressiveNoteStory;
      const ontoEl = $("layer-ontology");
      ontoEl.textContent = hasDistinctSimple ? (ex.ontology_invariant || "") : "";
      ontoEl.classList.toggle("hidden", !hasDistinctSimple || !ex.ontology_invariant);
      $("layer-motor").textContent = (ov && ov.simpleTry) || ex.motor_action || "";
      $("layer-practice").textContent = ex.practice_10m ? "Если под рукой инструмент: " + ex.practice_10m : "";
      $("layer-secret-tag").textContent = "Главный секрет урока";
      $("layer-falsifier").textContent = (ov && ov.simpleSecret) || ex.emergent_falsifier || "";

      $("studio-complete-box").classList.remove("hidden");
      const isDone = state.store.progress.completedAtoms.includes(item.id);
      $("complete-status").textContent = isDone
        ? "Уже в твоей копилке слуха. Можно вернуться к этому звуку в любой момент."
        : "Отметь после того, как услышал краску на клавишах, грифе или своём инструменте.";
    } else {
      const hasDistinctSimple = !!(ov && ov.simpleSummary);
      $("layer-sensory").textContent = "Краска и состояние: " + em.label + ". " + (anatomy.expressiveNoteStory || "");
      $("layer-feeling-trigger").textContent = anatomy.contrastStory || "";
      const ontoEl = $("layer-ontology");
      ontoEl.textContent = hasDistinctSimple ? (item.mechanism || "") : "";
      ontoEl.classList.toggle("hidden", !hasDistinctSimple || !item.mechanism);
      $("layer-motor").textContent = "На гитаре: " + (item.guitar_tip || "");
      $("layer-practice").textContent = "На клавишах: " + (item.piano_tip || "");
      $("layer-secret-tag").textContent = "Движение голосов";
      $("layer-falsifier").textContent = item.voice_leading || "";
      $("studio-complete-box").classList.add("hidden");
    }

    updatePlayButtons();
  }

  function playStudioCurrent() {
    const item = state.studioItem;
    if (!item || !item.music) return;
    state.audio.unlock();
    const m = item.music;
    const events = getStudioActiveTimeline();
    if (!events.length) return;

    state.scenePlaying = false;
    state.activePlayer = "studio";
    state.audio.playTimeline(events, {
      bpm: m.bpm || 86,
      meter: m.meter || "4/4",
      playMode: m.play_mode,
      loop: state.loopOn,
      electronic: (m.bpm || 86) >= 124 || item.id === "E20" || item.id === "M213" || item.id === "M214",
      onEvent: (ev) => {
        const names = ev.midis.map((x) => Theory.midiToLabelPair(x)).join(" + ");
        const prefix = ev.label ? ev.label + " → " : "";
        state.studioViz.setActiveMidis(ev.midis, prefix + names);
      },
      onBeat: (b) => {
        if (b.accent >= 3) state.studioViz.triggerPulse(0.6);
      },
      onEnd: () => {
        if (state.activePlayer === "studio") state.activePlayer = null;
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  function stepStudioItem(delta) {
    if (!state.studioItem) return;
    const list = state.studioKind === "emotion" ? state.catalog.emotion_mechanics : state.catalog.atoms;
    const idx = list.findIndex((x) => x.id === state.studioItem.id);
    if (idx < 0) return;
    const nextIdx = (idx + delta + list.length) % list.length;
    openStudio(state.studioKind, list[nextIdx].id, state.returnTab);
  }

  /* ========================= TAB 2: EMOTIONS, HARMONY CALCULATORS & SCENE BUILDER ========================= */
  function svgEl(tag, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) node.setAttribute(k, String(attrs[k]));
    }
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function renderEmotionsTab() {
    document.querySelectorAll("#emotions-subtabs .pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.esub === state.emotionSubTab);
    });
    ["atlas", "circle", "sphere", "guitar", "scene", "catalog"].forEach((sub) => {
      const box = $("esub-" + sub);
      if (box) box.classList.toggle("hidden", state.emotionSubTab !== sub);
    });

    if (state.emotionSubTab === "atlas") renderFeelingsAtlas();
    if (state.emotionSubTab === "circle") renderCircleOfFifths();
    if (state.emotionSubTab === "sphere") renderScaleSphere();
    if (state.emotionSubTab === "guitar") renderGuitarLab();
    if (state.emotionSubTab === "scene") renderSceneBuilder();
    if (state.emotionSubTab === "catalog") renderEmotionsGrid();
  }

  /* ---- CALCULATOR 0: COMPLETE 60-FEELING ATLAS (12 KEYS x FORMULA SHIFTS x 10 VARIATIONS) ---- */
  function renderFeelingsAtlas() {
    if (!FeelingsAtlas) return;
    const tid = getUserTuningId();
    const spec = Theory.getTuningSpec(tid);
    const q = (state.atlasQuery || "").trim().toLowerCase();

    // Family filter pills
    const famRail = $("atlas-families-rail");
    famRail.textContent = "";
    const allFam = [{ id: "all", label: "Все (60)" }, ...FeelingsAtlas.FAMILIES];
    allFam.forEach((fam) => {
      const btn = h("button", "pill" + (fam.id === state.atlasFamily ? " active" : ""), fam.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.atlasFamily = fam.id;
        renderFeelingsAtlas();
      });
      famRail.appendChild(btn);
    });

    // Filtered feelings chips
    const matches = FeelingsAtlas.FEELINGS.filter((f) => {
      if (state.atlasFamily !== "all" && f.family !== state.atlasFamily) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.essence.toLowerCase().includes(q)) return false;
      return true;
    });
    $("atlas-count-chip").textContent = matches.length + " из 60";

    const grid = $("atlas-feelings-grid");
    grid.textContent = "";
    if (!matches.length) {
      grid.appendChild(h("p", "muted small-text", "Ничего не найдено — попробуй другое слово или выбери «Все (60)»."));
    } else {
      matches.forEach((f) => {
        const chip = h("button", "atlas-feeling-chip" + (f.id === state.atlasFeelingId ? " active" : ""), f.name);
        chip.type = "button";
        chip.addEventListener("click", () => {
          stopAllAudio();
          state.atlasFeelingId = f.id;
          state.atlasPlayingVar = -1;
          renderFeelingsAtlas();
        });
        grid.appendChild(chip);
      });
    }

    // Selected feeling details + 12 keys + 1-note shifts + 10 live variations
    const pack = FeelingsAtlas.buildFeelingVariations(state.atlasFeelingId, state.atlasKeyPc, tid);
    const f = pack.feeling;

    $("atlas-cur-name").textContent = f.name;
    $("atlas-cur-mode").textContent = f.arch.modeName;
    $("atlas-cur-essence").textContent = f.essence;
    $("atlas-cur-marker").textContent = "Ключ чувства: " + f.keyMarker;
    $("btn-atlas-timbre").textContent = state.audio.timbre === "piano" ? "Пианино" : "Гитара";
    $("atlas-key-explain").textContent = pack.keyCharacter;

    // 12 key selector pills
    const kRail = $("atlas-keys-rail");
    kRail.textContent = "";
    FeelingsAtlas.KEYS_12.forEach((k) => {
      const btn = h("button", "pill" + (k.pc === state.atlasKeyPc ? " active" : ""), k.ru + " (" + k.en + ")");
      btn.type = "button";
      btn.addEventListener("click", () => {
        stopAllAudio();
        syncSessionContext({ rootPc: k.pc, circleMode: f.arch.circleMode || "major" });
        state.atlasPlayingVar = -1;
        renderFeelingsAtlas();
      });
      kRail.appendChild(btn);
    });

    // Clickable scale degree chips for this feeling & key
    const degWrap = $("atlas-degrees");
    degWrap.textContent = "";
    pack.scaleNotes.forEach((sn) => {
      const btn = h("button", "deg-chip" + (sn.deg === "1" ? " tonic" : ""));
      btn.type = "button";
      btn.appendChild(h("span", "deg-num", sn.deg));
      btn.appendChild(h("span", "", sn.pitchRu));
      btn.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playNote(sn.midi, { duration: 1.3, velocity: 0.85 });
      });
      degWrap.appendChild(btn);
    });

    // Formulaic 1-note transformation shifts to neighboring feelings!
    const shWrap = $("atlas-shifts");
    shWrap.textContent = "";
    f.shifts.forEach((sh) => {
      const btn = h("button", "atlas-shift-btn");
      btn.type = "button";
      btn.appendChild(h("span", "atlas-shift-formula", sh.formula));
      btn.appendChild(h("span", "atlas-shift-target", "⇒ " + sh.targetName + " ›"));
      btn.addEventListener("click", () => {
        stopAllAudio();
        state.atlasFeelingId = sh.targetId;
        state.atlasFamily = "all";
        state.atlasPlayingVar = 1;
        renderFeelingsAtlas();
        const nextPack = FeelingsAtlas.buildFeelingVariations(sh.targetId, state.atlasKeyPc, tid);
        if (nextPack.variations.length) playAtlasVariation(nextPack.variations[0]);
      });
      shWrap.appendChild(btn);
    });

    // 10 distinct playable variations in selected key
    $("atlas-vars-title").textContent = "10 вариантов «" + f.name + "» в " + pack.keyInfo.ru + " (" + pack.keyInfo.en + ")";
    $("atlas-tuning-chip").textContent = spec.short;
    $("atlas-vars-prog").textContent = "Базовая гармония: " + pack.progStr + " · Нажми на любой вариант, чтобы услышать его в этой тональности.";

    const vList = $("atlas-variations-list");
    vList.textContent = "";
    pack.variations.forEach((v) => {
      const isPlaying = state.atlasPlayingVar === v.num;
      const card = h("button", "atlas-var-card" + (isPlaying ? " playing" : ""));
      card.type = "button";
      const head = h("div", "atlas-var-head");
      head.appendChild(h("span", "atlas-var-title", (isPlaying ? "■ " : "▶ ") + String(v.num).padStart(2, "0") + " · " + v.title));
      head.appendChild(h("span", "chip", v.tag));
      card.appendChild(head);
      card.appendChild(h("p", "muted small-text", v.hint));
      card.appendChild(h("div", "atlas-var-meta", "Ноты: " + v.notesLine + (v.guitarLine ? " · Гриф: " + v.guitarLine : "")));
      card.addEventListener("click", () => {
        if (state.atlasPlayingVar === v.num && state.audio.isPlaying) {
          stopAllAudio();
          state.atlasPlayingVar = -1;
          renderFeelingsAtlas();
        } else {
          playAtlasVariation(v);
        }
      });
      vList.appendChild(card);
    });
  }

  function playAtlasVariation(variation) {
    let v = variation;
    if (typeof v === "number" || !v || !Array.isArray(v.events)) {
      if (!FeelingsAtlas) return;
      const pack = FeelingsAtlas.buildFeelingVariations(state.atlasFeelingId, state.atlasKeyPc, getUserTuningId());
      const idx = typeof variation === "number" ? variation : 0;
      v = pack && pack.variations && (pack.variations[idx] || pack.variations[0]);
    }
    if (!v || !Array.isArray(v.events) || !v.events.length) return;
    state.audio.unlock();
    state.audio.setTranspose(0);
    state.activePlayer = "atlas";
    state.atlasPlayingVar = v.num;
    state.audio.playTimeline(v.events, {
      bpm: v.bpm || 84,
      meter: "4/4",
      loop: false,
      onEnd: () => {
        if (state.activePlayer === "atlas") state.activePlayer = null;
        state.atlasPlayingVar = -1;
        updatePlayButtons();
        if (state.activeTab === "emotions" && state.emotionSubTab === "atlas") {
          renderFeelingsAtlas();
        }
      },
    });
    renderFeelingsAtlas();
    updatePlayButtons();
  }

  /* ---- CALCULATOR 1: CIRCLE OF FIFTHS & CHORD PALETTE ---- */
  function ensureDefaultCofProgression() {
    if (!Harmony || state.cofProgression.length) return;
    const pal = Harmony.getChordPalette(state.cofIndex, state.cofMode);
    const keys = state.cofMode === "minor" ? ["i", "bVI", "bIII", "bVII"] : ["I", "V", "vi", "IV"];
    state.cofProgression = keys.map((k) => pal.allByKey[k]).filter(Boolean);
  }

  function renderCircleOfFifths() {
    if (!Harmony) return;
    ensureDefaultCofProgression();
    const pal = Harmony.getChordPalette(state.cofIndex, state.cofMode);
    $("cof-sig-chip").textContent = pal.sig;
    $("cof-caption").textContent =
      "Тональность: " + pal.title + " · 6 родных аккордов-соседей подсвечены на круге (субдоминанта слева ← дом в центре → доминанта справа).";

    const svg = $("cof-svg");
    svg.textContent = "";
    const cx = 170;
    const cy = 170;
    const rOuter = 148;
    const rMid = 104;
    const rInner = 62;

    // Subtle concentric rings
    svg.appendChild(svgEl("circle", { cx, cy, r: rOuter, fill: "#101723", stroke: "rgba(255,255,255,0.1)", "stroke-width": 1.2 }));
    svg.appendChild(svgEl("circle", { cx, cy, r: rMid, fill: "#0e141f", stroke: "rgba(255,255,255,0.1)", "stroke-width": 1 }));
    svg.appendChild(svgEl("circle", { cx, cy, r: rInner, fill: "#0b0e14", stroke: "rgba(95,212,199,0.28)", "stroke-width": 1.2 }));

    const arcSlice = (r1, r2, a1, a2) => {
      const x1 = cx + r2 * Math.cos(a1);
      const y1 = cy + r2 * Math.sin(a1);
      const x2 = cx + r2 * Math.cos(a2);
      const y2 = cy + r2 * Math.sin(a2);
      const x3 = cx + r1 * Math.cos(a2);
      const y3 = cy + r1 * Math.sin(a2);
      const x4 = cx + r1 * Math.cos(a1);
      const y4 = cy + r1 * Math.sin(a1);
      return "M " + x1.toFixed(1) + " " + y1.toFixed(1) +
        " A " + r2 + " " + r2 + " 0 0 1 " + x2.toFixed(1) + " " + y2.toFixed(1) +
        " L " + x3.toFixed(1) + " " + y3.toFixed(1) +
        " A " + r1 + " " + r1 + " 0 0 0 " + x4.toFixed(1) + " " + y4.toFixed(1) + " Z";
    };

    const stepAng = (Math.PI * 2) / 12;
    Harmony.CIRCLE_OF_FIFTHS.forEach((item) => {
      const midAng = -Math.PI / 2 + item.idx * stepAng;
      const a1 = midAng - stepAng / 2;
      const a2 = midAng + stepAng / 2;
      const isNeighbor = pal.neighborIndices.includes(item.idx);
      const isRootMaj = item.idx === state.cofIndex && state.cofMode === "major";
      const isRootMin = item.idx === state.cofIndex && state.cofMode === "minor";

      // Outer Major wedge
      const gMaj = svgEl("g", { class: "viz-hit" });
      gMaj.appendChild(
        svgEl("path", {
          d: arcSlice(rMid, rOuter, a1, a2),
          fill: isRootMaj ? "rgba(245,185,99,0.34)" : isNeighbor ? "rgba(95,212,199,0.16)" : "transparent",
          stroke: isRootMaj ? "#f5b963" : isNeighbor ? "rgba(95,212,199,0.45)" : "rgba(255,255,255,0.08)",
          "stroke-width": isRootMaj ? 1.8 : 1,
        })
      );
      const txM = cx + ((rMid + rOuter) / 2) * Math.cos(midAng);
      const tyM = cy + ((rMid + rOuter) / 2) * Math.sin(midAng);
      gMaj.appendChild(
        svgEl("text", {
          x: txM.toFixed(1),
          y: (tyM + 4.5).toFixed(1),
          "text-anchor": "middle",
          fill: isRootMaj ? "#fef3c7" : isNeighbor ? "#e6fffa" : "#94a3b8",
          "font-size": isRootMaj ? 14 : 12.5,
          "font-weight": isRootMaj || isNeighbor ? "800" : "600",
        }, item.maj)
      );
      gMaj.addEventListener("click", () => {
        stopAllAudio();
        state.cofIndex = item.idx;
        state.cofMode = "major";
        state.cofProgression = [];
        syncSessionContext({ rootPc: item.pc, circleMode: "major", keepGuitarRoot: true });
        const p2 = Harmony.getChordPalette(item.idx, "major");
        state.cofPreviewChord = p2.diatonic[0];
        state.audio.unlock();
        state.audio.playChord(p2.diatonic[0].midis, { strum: true, duration: 1.5 });
        renderCircleOfFifths();
      });
      svg.appendChild(gMaj);

      // Inner Relative Minor wedge
      const gMin = svgEl("g", { class: "viz-hit" });
      gMin.appendChild(
        svgEl("path", {
          d: arcSlice(rInner, rMid, a1, a2),
          fill: isRootMin ? "rgba(167,139,250,0.34)" : isNeighbor ? "rgba(129,140,248,0.14)" : "transparent",
          stroke: isRootMin ? "#a78bfa" : isNeighbor ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.06)",
          "stroke-width": isRootMin ? 1.8 : 1,
        })
      );
      const txm = cx + ((rInner + rMid) / 2) * Math.cos(midAng);
      const tym = cy + ((rInner + rMid) / 2) * Math.sin(midAng);
      gMin.appendChild(
        svgEl("text", {
          x: txm.toFixed(1),
          y: (tym + 3.8).toFixed(1),
          "text-anchor": "middle",
          fill: isRootMin ? "#ede9fe" : isNeighbor ? "#dbeafe" : "#64748b",
          "font-size": isRootMin ? 11.5 : 10.5,
          "font-weight": isRootMin || isNeighbor ? "700" : "500",
        }, item.min)
      );
      gMin.addEventListener("click", () => {
        stopAllAudio();
        state.cofIndex = item.idx;
        state.cofMode = "minor";
        state.cofProgression = [];
        syncSessionContext({ rootPc: item.minPc, circleMode: "minor", keepGuitarRoot: true });
        const p2 = Harmony.getChordPalette(item.idx, "minor");
        state.cofPreviewChord = p2.diatonic[0];
        state.audio.unlock();
        state.audio.playChord(p2.diatonic[0].midis, { strum: true, duration: 1.5 });
        renderCircleOfFifths();
      });
      svg.appendChild(gMin);
    });

    // Center tonic badge
    svg.appendChild(
      svgEl("text", { x: cx, y: cy - 6, "text-anchor": "middle", fill: "#f5b963", "font-size": 21, "font-weight": "800" }, pal.mode === "minor" ? pal.circlePos.min : pal.circlePos.maj)
    );
    svg.appendChild(
      svgEl("text", { x: cx, y: cy + 12, "text-anchor": "middle", fill: "#94a3b8", "font-size": 10.5, "font-weight": "600" }, pal.mode === "minor" ? "минор" : "мажор")
    );
    svg.appendChild(
      svgEl("text", { x: cx, y: cy + 27, "text-anchor": "middle", fill: "#5fd4c7", "font-size": 9.5 }, "← IV · V →")
    );

    // Blooming Sub-Circle of 8 Melodic Chord Extensions (maj7, add9, sus2, sus4, 6, 7, maj7#11 / m7, m9, m6...)
    renderCofExtensionOrbit();

    // 7 Diatonic chords + 3 Borrowed modal-interchange chords
    const renderPadGrid = (container, list) => {
      container.textContent = "";
      list.forEach((ch) => {
        const pad = h("button", "chord-pad" + (ch.borrowed ? " borrowed" : ""));
        pad.type = "button";
        const top = h("div", "chord-pad-top");
        const sym = h("span", "chord-pad-sym", ch.symbol);
        sym.style.color = ch.color;
        top.appendChild(sym);
        top.appendChild(h("span", "chord-pad-roman", ch.roman));
        pad.appendChild(top);
        pad.appendChild(h("span", "chord-pad-role", ch.role));
        pad.addEventListener("click", () => {
          state.audio.unlock();
          state.audio.playChord(ch.midis, { strum: true, duration: 1.4 });
          state.cofPreviewChord = ch;
          if (state.cofProgression.length < 8) {
            state.cofProgression.push(ch);
            renderCofProgressionBar();
          }
          renderCofChordFretboard(ch);
          $("cof-caption").textContent = ch.symbol + " (" + ch.roman + ") — " + ch.role + " · ноты: " + ch.midis.map((m) => Theory.midiToName(m, true)).join(" – ");
        });
        container.appendChild(pad);
      });
    };

    renderPadGrid($("cof-diatonic-grid"), pal.diatonic);
    renderPadGrid($("cof-borrowed-grid"), pal.borrowed);

    // Emotional chord progression presets (12 rich Atlas-linked feeling chord sets!)
    const pRail = $("cof-presets-rail");
    pRail.textContent = "";
    Harmony.CHORD_FEELING_PRESETS.forEach((pr) => {
      const btn = h("button", "btn-pill", pr.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        const built = Harmony.buildFeelingChordSet(state.cofIndex, pr.id);
        state.cofMode = built.mode;
        state.cofProgression = built.chords;
        renderCircleOfFifths();
        playCofProgression();
      });
      pRail.appendChild(btn);
    });

    $("btn-cof-timbre").textContent = state.audio.timbre === "piano" ? "Пианино" : "Гитара";
    renderCofProgressionBar();
    const fallbackChord = state.cofPreviewChord || state.cofProgression[0] || pal.diatonic[0];
    renderCofChordFretboard(fallbackChord);
  }

  /* Live 6/7-string Guitar Fretboard right below the Chord Palette (updates live during Play!) */
  function renderCofChordFretboard(chord) {
    const svg = $("cof-fret-svg");
    if (!svg || !chord || !Array.isArray(chord.midis) || !chord.midis.length) return;

    const tid = getUserTuningId();
    const spec = Theory.getTuningSpec(tid);
    const numStrings = spec.strings;
    const fretCount = 12;

    $("cof-fret-title").textContent = "Аппликатура: " + chord.symbol + (chord.roman ? " (" + chord.roman + ")" : "");
    $("cof-fret-tuning-chip").textContent = spec.short;
    renderTuningPills($("cof-tuning-pills"), tid);

    const positions = Theory.choosePlayableChordVoicing(chord.midis, { tuningId: tid, capo: 0, maxFret: fretCount });
    const posByString = new Map(positions.map((p) => [p.string, p]));
    const rootPc = ((chord.midis[0] % 12) + 12) % 12;

    svg.textContent = "";
    const leftX = 46;
    const rightX = 348;
    const topY = 14;
    const rowGap = numStrings >= 7 ? 14.5 : 16;
    const boardH = rowGap * (numStrings - 1);
    const svgH = Math.round(topY + boardH + 22);
    svg.setAttribute("viewBox", "0 0 360 " + svgH);

    const fretW = (rightX - leftX) / fretCount;

    // Fretboard plate
    svg.appendChild(
      svgEl("rect", { x: leftX, y: topY - 4, width: rightX - leftX, height: boardH + 8, rx: 4, fill: "#141c28", stroke: "rgba(255,255,255,0.08)" })
    );

    // Fret inlays & numbers
    [3, 5, 7, 9, 12].forEach((f) => {
      const fx = leftX + (f - 0.5) * fretW;
      if (f === 12) {
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + rowGap * 1.5, r: 2.1, fill: "rgba(148,163,184,0.28)" }));
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + boardH - rowGap * 1.5, r: 2.1, fill: "rgba(148,163,184,0.28)" }));
      } else {
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + boardH / 2, r: 2.3, fill: "rgba(148,163,184,0.28)" }));
      }
      svg.appendChild(svgEl("text", { x: fx, y: topY + boardH + 15, "text-anchor": "middle", fill: "#64748b", "font-size": 8.5 }, String(f)));
    });

    // Nut & fret wires
    svg.appendChild(svgEl("line", { x1: leftX, y1: topY - 4, x2: leftX, y2: topY + boardH + 4, stroke: "#cbd5e1", "stroke-width": 2.4 }));
    for (let f = 1; f <= fretCount; f++) {
      const x = leftX + f * fretW;
      svg.appendChild(svgEl("line", { x1: x, y1: topY - 4, x2: x, y2: topY + boardH + 4, stroke: "rgba(226,232,240,0.18)", "stroke-width": 1 }));
    }

    // Strings + muted (×) or active finger dot
    for (let s = 0; s < numStrings; s++) {
      const strNum = s + 1;
      const y = topY + s * rowGap;
      const pos = posByString.get(strNum);
      svg.appendChild(
        svgEl("line", {
          x1: leftX,
          y1: y,
          x2: rightX,
          y2: y,
          stroke: pos ? "rgba(95,212,199,0.52)" : "rgba(148,163,184,0.2)",
          "stroke-width": (0.85 + s * 0.24).toFixed(2),
        })
      );
      svg.appendChild(
        svgEl("text", { x: 13, y: y + 3, "text-anchor": "middle", fill: s === 6 ? "#f5b963" : "#94a3b8", "font-size": 8.5, "font-weight": "700" }, Theory.midiToPitchClass(spec.midis[s], false))
      );

      if (!pos) {
        svg.appendChild(
          svgEl("text", { x: leftX - 12, y: y + 3.2, "text-anchor": "middle", fill: "#64748b", "font-size": 9.5, "font-weight": "700" }, "×")
        );
      } else {
        const isRoot = ((pos.midi % 12) + 12) % 12 === rootPc;
        const cx = pos.fret === 0 ? leftX - 12 : leftX + (pos.fret - 0.5) * fretW;
        const g = svgEl("g", { class: "viz-hit" });
        g.appendChild(
          svgEl("circle", {
            cx: cx.toFixed(1),
            cy: y.toFixed(1),
            r: isRoot ? 6.8 : 6.1,
            fill: isRoot ? "#f5b963" : "#5fd4c7",
            stroke: "#0b0e14",
            "stroke-width": 1.3,
          })
        );
        g.appendChild(
          svgEl("text", {
            x: cx.toFixed(1),
            y: (y + 2.7).toFixed(1),
            "text-anchor": "middle",
            fill: "#0b0e14",
            "font-size": 7.6,
            "font-weight": "800",
          }, String(pos.fret))
        );
        g.addEventListener("click", () => {
          state.audio.unlock();
          state.audio.playNote(pos.midi, { duration: 1.25, velocity: 0.85 });
        });
        svg.appendChild(g);
      }
    }

    const sortedDesc = positions.slice().sort((a, b) => b.string - a.string);
    const fingersTxt = sortedDesc
      .map((p) => p.string + "-я/" + (p.fret === 0 ? "откр." : p.fret + "л.") + " (" + Theory.midiToPitchClass(p.midi, true) + ")")
      .join(" · ");
    $("cof-fret-caption").textContent =
      chord.symbol + (chord.role ? " — " + chord.role : "") + " · Пальцы: " + fingersTxt + " (янтарь = тоника, × = глушим).";
  }

  function renderCofExtensionOrbit() {
    if (!Harmony) return;
    const orbit = Harmony.getChordExtensionsOrbit(state.cofIndex, state.cofMode);
    $("cof-orbit-chip").textContent = orbit.rootEn + " · 8 надстроек";

    const svg = $("cof-orbit-svg");
    svg.textContent = "";
    const cx = 170;
    const cy = 118;
    const rx = 122;
    const ry = 82;

    // Luminous orbit ellipse & center glow
    svg.appendChild(svgEl("ellipse", { cx, cy, rx, ry, fill: "none", stroke: "rgba(167,139,250,0.22)", "stroke-dasharray": "4 4" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: 34, fill: "#131c2b", stroke: "#f5b963", "stroke-width": 1.8 }));
    svg.appendChild(svgEl("text", { x: cx, y: cy - 3, "text-anchor": "middle", fill: "#fef3c7", "font-size": 17, "font-weight": "800" }, orbit.rootEn));
    svg.appendChild(svgEl("text", { x: cx, y: cy + 12, "text-anchor": "middle", fill: "#94a3b8", "font-size": 9 }, "надстройки"));

    orbit.petals.forEach((pt, idx) => {
      const ang = -Math.PI / 2 + (idx * Math.PI * 2) / orbit.petals.length;
      const px = cx + rx * Math.cos(ang);
      const py = cy + ry * Math.sin(ang);
      const isHot = idx === state.cofActiveOrbitIdx;

      // Radial spoke from tonic hub to extension petal
      svg.appendChild(
        svgEl("line", {
          x1: (cx + 34 * Math.cos(ang)).toFixed(1),
          y1: (cy + 34 * Math.sin(ang)).toFixed(1),
          x2: (px - 22 * Math.cos(ang)).toFixed(1),
          y2: (py - 16 * Math.sin(ang)).toFixed(1),
          stroke: isHot ? pt.color : "rgba(255,255,255,0.14)",
          "stroke-width": isHot ? 2 : 1.1,
        })
      );

      const g = svgEl("g", { class: "viz-hit" });
      g.appendChild(
        svgEl("rect", {
          x: (px - 34).toFixed(1),
          y: (py - 18).toFixed(1),
          width: 68,
          height: 36,
          rx: 12,
          fill: isHot ? "rgba(95,212,199,0.22)" : "#151f2e",
          stroke: isHot ? pt.color : "rgba(255,255,255,0.16)",
          "stroke-width": isHot ? 1.8 : 1,
        })
      );
      g.appendChild(
        svgEl("text", {
          x: px.toFixed(1),
          y: (py - 2).toFixed(1),
          "text-anchor": "middle",
          fill: isHot ? "#ffffff" : pt.color,
          "font-size": pt.symbol.length >= 7 ? 9.5 : 11,
          "font-weight": "800",
        }, pt.symbol)
      );
      g.appendChild(
        svgEl("text", {
          x: px.toFixed(1),
          y: (py + 11).toFixed(1),
          "text-anchor": "middle",
          fill: "#94a3b8",
          "font-size": 8.5,
          "font-weight": "600",
        }, pt.added)
      );
      g.addEventListener("click", () => {
        state.cofActiveOrbitIdx = idx;
        state.cofPreviewChord = pt;
        state.audio.unlock();
        state.audio.playChord(pt.midis, { strum: true, duration: 1.6 });
        if (state.cofProgression.length < 8) {
          state.cofProgression.push(pt);
          renderCofProgressionBar();
        }
        renderCofExtensionOrbit();
        renderCofChordFretboard(pt);
      });
      svg.appendChild(g);
    });

    const activePetal = orbit.petals[state.cofActiveOrbitIdx] || orbit.petals[0];
    const frets = Theory.choosePlayableChordVoicing(activePetal.midis, { tuningId: getUserTuningId(), capo: 0, maxFret: 12 });
    const fretStr = frets.map((p) => p.string + "-я/" + (p.fret === 0 ? "откр." : p.fret + "л.")).join(" · ");
    $("cof-orbit-caption").textContent =
      activePetal.symbol + " (" + activePetal.added + ") — " + activePetal.role +
      " · ноты: " + activePetal.midis.map((m) => Theory.midiToName(m, true)).join(" – ") +
      (fretStr ? " · гриф: " + fretStr : "");
  }

  function renderCofProgressionBar() {
    const slots = $("cof-prog-slots");
    slots.textContent = "";
    $("cof-prog-count").textContent = state.cofProgression.length + " акк.";
    const toDrumsBtn = $("btn-cof-to-drums");
    if (toDrumsBtn) toDrumsBtn.disabled = !state.cofProgression.length;
    if (!state.cofProgression.length) {
      slots.appendChild(h("span", "muted small-text", "Нажимай на аккорды выше или выбери эмоциональный пресет."));
      return;
    }
    state.cofProgression.forEach((ch, idx) => {
      const chip = h(
        "button",
        "scene-slot-chip" + (idx === state.cofActiveChordIdx ? " bar-chip-active" : ""),
        ch.symbol + " (" + ch.roman + ") ×"
      );
      chip.type = "button";
      chip.addEventListener("click", () => {
        stopAllAudio();
        state.cofProgression.splice(idx, 1);
        renderCofProgressionBar();
      });
      slots.appendChild(chip);
    });
  }

  function playCofProgression() {
    if (state.audio.isPlaying && state.activePlayer === "cof") {
      stopAllAudio();
      renderCofProgressionBar();
      return;
    }
    if (!state.cofProgression.length) return;
    state.audio.unlock();
    state.audio.setTranspose(0);
    state.activePlayer = "cof";
    const snapshot = state.cofProgression.slice();
    const events = snapshot.map((ch) => ({
      midis: ch.midis,
      beats: 2.0,
      label: ch.symbol + " (" + ch.roman + ")",
      velocity: 0.8,
      strum: true,
    }));
    state.audio.playTimeline(events, {
      bpm: 84,
      meter: "4/4",
      loop: false,
      onEvent: (ev) => {
        state.cofActiveChordIdx = ev.index;
        renderCofProgressionBar();
        const ch = snapshot[ev.index];
        if (ch) {
          state.cofPreviewChord = ch;
          renderCofChordFretboard(ch);
          $("cof-caption").textContent = "Звучит: " + ch.symbol + " (" + ch.roman + ") — " + ch.role;
        }
      },
      onEnd: () => {
        if (state.activePlayer === "cof") state.activePlayer = null;
        state.cofActiveChordIdx = -1;
        renderCofProgressionBar();
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  /* ---- CALCULATOR 2: SCALE SPHERE & BRANCHING MELODY-PHRASE TREE ---- */
  function renderScaleSphere() {
    if (!Harmony) return;
    const scaleData = Harmony.getScaleNotes(state.sphereRootPc, state.sphereModeId, 60);
    if (!state.spherePhrase.length) {
      const first = scaleData.notes[0];
      state.spherePhrase = [{ midi: first.midi, noteEn: first.noteEn, noteRu: first.noteRu, deg: first.deg, beats: 0.75 }];
    }
    const lastSounding = [...state.spherePhrase].reverse().find((s) => typeof s.midi === "number");
    const curMidi = lastSounding ? lastSounding.midi : scaleData.tonicMidi;

    $("sphere-mode-chip").textContent = scaleData.mode.name;

    // 12 root selector pills
    const rRail = $("sphere-roots-rail");
    rRail.textContent = "";
    for (let pc = 0; pc < 12; pc++) {
      const btn = h("button", "pill" + (pc === state.sphereRootPc ? " active" : ""), Harmony.PC_NAMES_RU[pc]);
      btn.type = "button";
      btn.addEventListener("click", () => {
        stopAllAudio();
        state.audio.setDrone(false);
        syncSessionContext({ rootPc: pc });
        state.spherePhrase = [];
        renderScaleSphere();
      });
      rRail.appendChild(btn);
    }

    // Expressive modes pills
    const mRail = $("sphere-modes-rail");
    mRail.textContent = "";
    Harmony.SCALE_MODES.forEach((m) => {
      const btn = h("button", "pill" + (m.id === state.sphereModeId ? " active" : ""), m.name);
      btn.type = "button";
      btn.addEventListener("click", () => {
        stopAllAudio();
        state.audio.setDrone(false);
        syncSessionContext({ modeId: m.id });
        state.spherePhrase = [];
        renderScaleSphere();
      });
      mRail.appendChild(btn);
    });

    // Draw Interactive Scale Sphere SVG (12 chromatic orbits rotated so tonic sits at 12 o'clock)
    const svg = $("sphere-svg");
    svg.textContent = "";
    const cx = 170;
    const cy = 138;
    const R = 104;

    // Outer luminous sphere halo & inner gravity rings
    svg.appendChild(svgEl("circle", { cx, cy, r: R + 12, fill: "rgba(95,212,199,0.03)", stroke: "rgba(255,255,255,0.06)" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: R, fill: "#0e1522", stroke: "rgba(255,255,255,0.12)", "stroke-width": 1.2 }));
    svg.appendChild(svgEl("circle", { cx, cy, r: R * 0.56, fill: "none", stroke: "rgba(255,255,255,0.06)", "stroke-dasharray": "3 4" }));

    const coordForSemi = (semi, radius) => {
      const ang = -Math.PI / 2 + (((semi % 12) + 12) % 12) * ((Math.PI * 2) / 12);
      return { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) };
    };

    // Scale polygon inside the sphere
    const polyPts = scaleData.notes.map((n) => {
      const pt = coordForSemi(n.semi, R);
      return pt.x.toFixed(1) + "," + pt.y.toFixed(1);
    }).join(" ");
    svg.appendChild(
      svgEl("polygon", {
        points: polyPts,
        fill: "rgba(95,212,199,0.08)",
        stroke: scaleData.mode.color,
        "stroke-width": 1.5,
        opacity: 0.72,
      })
    );

    // Growing Melody Tree Trajectory lines inside the sphere!
    const soundingSteps = state.spherePhrase.filter((s) => typeof s.midi === "number");
    for (let i = 1; i < soundingSteps.length; i++) {
      const p1 = coordForSemi(soundingSteps[i - 1].midi - scaleData.tonicMidi, R * 0.88);
      const p2 = coordForSemi(soundingSteps[i].midi - scaleData.tonicMidi, R * 0.88);
      const isLastEdge = i === soundingSteps.length - 1;
      svg.appendChild(
        svgEl("line", {
          x1: p1.x.toFixed(1),
          y1: p1.y.toFixed(1),
          x2: p2.x.toFixed(1),
          y2: p2.y.toFixed(1),
          stroke: isLastEdge ? "#f5b963" : "#5fd4c7",
          "stroke-width": isLastEdge ? 2.8 : 1.7,
          "stroke-linecap": "round",
          opacity: isLastEdge ? 0.95 : 0.6,
        })
      );
    }

    // 12 chromatic orbits (dim outside scale, glowing clickable nodes inside scale)
    const noteBySemi = new Map(scaleData.notes.map((n) => [n.semi, n]));
    for (let semi = 0; semi < 12; semi++) {
      const pt = coordForSemi(semi, R);
      const scaleNode = noteBySemi.get(semi);
      if (!scaleNode) {
        svg.appendChild(svgEl("circle", { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 3, fill: "rgba(148,163,184,0.22)" }));
        continue;
      }
      const isTonic = semi === 0;
      const isCur = ((curMidi - scaleData.tonicMidi) % 12 + 12) % 12 === semi;
      const isHot = state.sphereActiveMidi !== null && ((state.sphereActiveMidi - scaleData.tonicMidi) % 12 + 12) % 12 === semi;

      const g = svgEl("g", { class: "viz-hit" });
      g.appendChild(
        svgEl("circle", {
          cx: pt.x.toFixed(1),
          cy: pt.y.toFixed(1),
          r: isHot || isCur ? 16.5 : isTonic ? 15.5 : 14.5,
          fill: isHot ? "#ff7a6b" : isTonic ? "#f5b963" : isCur ? "#5fd4c7" : "#182334",
          stroke: isCur || isHot ? "#ffffff" : scaleData.mode.color,
          "stroke-width": isCur || isHot ? 2 : 1.4,
        })
      );
      g.appendChild(
        svgEl("text", {
          x: pt.x.toFixed(1),
          y: (pt.y + 3.2).toFixed(1),
          "text-anchor": "middle",
          fill: isTonic || isCur || isHot ? "#0b0e14" : "#eef2f7",
          "font-size": scaleNode.pitchRu.length >= 4 ? 8.5 : 10.5,
          "font-weight": "800",
        }, scaleNode.pitchRu)
      );
      // Outer degree micro-tag
      const degPt = coordForSemi(semi, R + 21);
      g.appendChild(
        svgEl("text", {
          x: degPt.x.toFixed(1),
          y: (degPt.y + 3).toFixed(1),
          "text-anchor": "middle",
          fill: isTonic ? "#f5b963" : "#94a3b8",
          "font-size": 9,
          "font-weight": "700",
        }, scaleNode.deg)
      );
      g.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playNote(scaleNode.midi, { duration: 1.2, velocity: 0.85 });
        if (state.spherePhrase.length < 12) {
          state.spherePhrase.push({
            midi: scaleNode.midi,
            noteEn: scaleNode.noteEn,
            noteRu: scaleNode.noteRu,
            deg: scaleNode.deg,
            beats: 0.75,
          });
        }
        renderScaleSphere();
      });
      svg.appendChild(g);
    }

    // Center mode feeling caption inside sphere
    svg.appendChild(
      svgEl("text", { x: cx, y: cy - 3, "text-anchor": "middle", fill: scaleData.mode.color, "font-size": 13, "font-weight": "800" }, Harmony.PC_NAMES_RU[state.sphereRootPc])
    );
    svg.appendChild(
      svgEl("text", { x: cx, y: cy + 12, "text-anchor": "middle", fill: "#94a3b8", "font-size": 9.5 }, scaleData.mode.name)
    );

    $("sphere-caption").textContent = scaleData.mode.name + " от " + Harmony.PC_NAMES_RU[state.sphereRootPc] + " — " + scaleData.mode.feel + ".";

    // Branching Melody Tree from current note
    const branches = Harmony.getMelodyTreeBranches(scaleData, curMidi);
    const brWrap = $("sphere-tree-branches");
    brWrap.textContent = "";
    branches.forEach((br) => {
      const btn = h("button", "tree-branch-btn " + br.kind);
      btn.type = "button";
      btn.appendChild(h("span", "tree-branch-title", br.title));
      btn.appendChild(h("span", "tree-branch-hint", br.hint));
      btn.addEventListener("click", () => {
        state.audio.unlock();
        if (typeof br.midi === "number") {
          state.audio.playNote(br.midi, { duration: 1.1, velocity: 0.85 });
        }
        if (state.spherePhrase.length < 12) {
          state.spherePhrase.push({
            midi: br.midi,
            noteEn: br.noteEn,
            noteRu: br.noteRu,
            deg: br.deg,
            beats: br.beats,
          });
        }
        renderScaleSphere();
      });
      brWrap.appendChild(btn);
    });

    // Phrase chips + live Guitar positions for user's chosen 6/7-string tuning!
    const pSlots = $("sphere-phrase-slots");
    pSlots.textContent = "";
    $("sphere-phrase-count").textContent = state.spherePhrase.length + " ш.";
    state.spherePhrase.forEach((st, idx) => {
      const label = st.midi === null ? "пауза" : st.noteRu + " (" + st.deg + ")";
      const chip = h("button", "scene-slot-chip", (idx + 1) + ". " + label);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (typeof st.midi === "number") {
          state.audio.unlock();
          state.audio.playNote(st.midi, { duration: 1.0, velocity: 0.85 });
        }
      });
      pSlots.appendChild(chip);
    });

    const uniqueMidis = [...new Set(soundingSteps.map((s) => s.midi))];
    const tid = getUserTuningId();
    const frets = Theory.chooseErgonomicFrets(uniqueMidis, { tuningId: tid, capo: 0, maxFret: 12 });
    const spec = Theory.getTuningSpec(tid);
    $("sphere-guitar-map").textContent =
      "На твоём грифе (" + spec.short + "): " +
      frets.map((p) => p.string + "-я/" + (p.fret === 0 ? "откр." : p.fret + "л.") + " (" + Theory.midiToPitchClass(p.midi, true) + ")").join(" · ");
  }

  function playSpherePhrase() {
    if (state.audio.isPlaying && state.activePlayer === "sphere") {
      stopAllAudio();
      state.audio.setDrone(false);
      renderScaleSphere();
      return;
    }
    if (!Harmony || !state.spherePhrase.length) return;
    const scaleData = Harmony.getScaleNotes(state.sphereRootPc, state.sphereModeId, 60);
    state.audio.unlock();
    state.audio.setTranspose(0);
    state.audio.setDrone(true, scaleData.droneMidi);
    state.activePlayer = "sphere";

    const events = state.spherePhrase.map((st) => ({
      midis: typeof st.midi === "number" ? [st.midi] : [],
      beats: st.beats || 0.75,
      label: st.noteRu,
      velocity: 0.85,
      strum: false,
    }));
    state.audio.playTimeline(events, {
      bpm: 88,
      meter: "4/4",
      loop: false,
      onEvent: (ev) => {
        state.sphereActiveMidi = ev.midis && ev.midis.length ? ev.midis[0] : null;
        renderScaleSphere();
      },
      onEnd: () => {
        if (state.activePlayer === "sphere") state.activePlayer = null;
        state.sphereActiveMidi = null;
        state.audio.setDrone(false);
        renderScaleSphere();
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  /* ---- CALCULATOR 3: ANTI-EM/AM FRETBOARD MAP & 10 GUITAR TECHNIQUES ---- */
  function renderGuitarLab() {
    if (!GuitarLab || !Harmony) return;
    const tid = getUserTuningId();
    const map = GuitarLab.computeFretboardMap({
      rootPc: state.glabRootPc,
      modeId: state.glabModeId,
      tuningId: tid,
      layout: state.glabLayout,
      zoneStart: state.glabZoneStart,
      singleString: state.glabSingleString,
    });
    const spec = map.tuningSpec;
    $("glab-tuning-chip").textContent = spec.short;
    renderTuningPills($("glab-tuning-pills"), tid);

    // 12 root pills
    const rRail = $("glab-roots-rail");
    rRail.textContent = "";
    for (let pc = 0; pc < 12; pc++) {
      const btn = h("button", "pill" + (pc === state.glabRootPc ? " active" : ""), Harmony.PC_NAMES_RU[pc]);
      btn.type = "button";
      btn.addEventListener("click", () => {
        stopAllAudio();
        syncSessionContext({ rootPc: pc });
        renderGuitarLab();
      });
      rRail.appendChild(btn);
    }

    // Expressive modes pills
    const mRail = $("glab-modes-rail");
    mRail.textContent = "";
    Harmony.SCALE_MODES.forEach((m) => {
      const btn = h("button", "pill" + (m.id === state.glabModeId ? " active" : ""), m.name);
      btn.type = "button";
      btn.addEventListener("click", () => {
        stopAllAudio();
        syncSessionContext({ modeId: m.id });
        renderGuitarLab();
      });
      mRail.appendChild(btn);
    });

    // Layout mode pills & parameter controls
    document.querySelectorAll("#glab-layout-pills .pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.glayout === state.glabLayout);
    });
    const showZone = state.glabLayout === "zone" || state.glabLayout === "3nps";
    $("glab-zone-controls").classList.toggle("hidden", !showZone);
    $("glab-zone-val").textContent = state.glabZoneStart + "–" + (state.glabZoneStart + 3) + " лад";

    const showStr = state.glabLayout === "one_string";
    $("glab-string-controls").classList.toggle("hidden", !showStr);
    if (showStr) {
      const sWrap = $("glab-string-pills");
      sWrap.textContent = "";
      for (let s = 1; s <= spec.strings; s++) {
        const btn = h("button", "btn-pill" + (s === map.singleString ? " active" : ""), s + "-я");
        btn.type = "button";
        btn.addEventListener("click", () => {
          state.glabSingleString = s;
          renderGuitarLab();
        });
        sWrap.appendChild(btn);
      }
    }

    // Render spacious 0..15 Fretboard SVG (6 or 7 strings!)
    const svg = $("glab-neck-svg");
    svg.textContent = "";
    const fretCount = 15;
    const numStrings = spec.strings;
    const leftX = 48;
    const rightX = 528;
    const topY = 16;
    const rowGap = 16.5;
    const boardH = rowGap * (numStrings - 1);
    const svgH = Math.round(topY + boardH + 24);
    svg.setAttribute("viewBox", "0 0 540 " + svgH);

    const fretW = (rightX - leftX) / fretCount;

    // Wood plate
    svg.appendChild(
      svgEl("rect", { x: leftX, y: topY - 5, width: rightX - leftX, height: boardH + 10, rx: 5, fill: "#131b27", stroke: "rgba(255,255,255,0.09)" })
    );

    // Highlight active 4-fret cage if in zone mode
    if (state.glabLayout === "zone") {
      const zX = state.glabZoneStart === 0 ? leftX - 10 : leftX + (state.glabZoneStart - 1) * fretW;
      const zW = (state.glabZoneStart === 0 ? 10 : 0) + Math.min(5, fretCount - Math.max(0, state.glabZoneStart - 1)) * fretW;
      svg.appendChild(
        svgEl("rect", {
          x: zX,
          y: topY - 7,
          width: zW,
          height: boardH + 14,
          rx: 5,
          fill: "rgba(245,185,99,0.08)",
          stroke: "rgba(245,185,99,0.55)",
          "stroke-dasharray": "4 3",
        })
      );
    }

    // Inlay markers & fret numbers
    [3, 5, 7, 9, 12, 15].forEach((f) => {
      const fx = leftX + (f - 0.5) * fretW;
      if (f === 12) {
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + rowGap * 1.5, r: 2.5, fill: "rgba(148,163,184,0.28)" }));
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + boardH - rowGap * 1.5, r: 2.5, fill: "rgba(148,163,184,0.28)" }));
      } else {
        svg.appendChild(svgEl("circle", { cx: fx, cy: topY + boardH / 2, r: 2.6, fill: "rgba(148,163,184,0.28)" }));
      }
      svg.appendChild(svgEl("text", { x: fx, y: topY + boardH + 16, "text-anchor": "middle", fill: "#7d90aa", "font-size": 9, "font-weight": "600" }, String(f)));
    });

    // Nut & fret wires
    svg.appendChild(svgEl("line", { x1: leftX, y1: topY - 5, x2: leftX, y2: topY + boardH + 5, stroke: "#cbd5e1", "stroke-width": 2.6 }));
    for (let f = 1; f <= fretCount; f++) {
      const x = leftX + f * fretW;
      svg.appendChild(svgEl("line", { x1: x, y1: topY - 5, x2: x, y2: topY + boardH + 5, stroke: "rgba(226,232,240,0.18)", "stroke-width": 1 }));
    }

    // Strings
    for (let s = 0; s < numStrings; s++) {
      const y = topY + s * rowGap;
      svg.appendChild(
        svgEl("line", {
          x1: leftX,
          y1: y,
          x2: rightX,
          y2: y,
          stroke: s === 6 ? "rgba(245,185,99,0.58)" : "rgba(203,213,225,0.38)",
          "stroke-width": (0.85 + s * 0.24).toFixed(2),
        })
      );
      svg.appendChild(
        svgEl("text", { x: 14, y: y + 3.5, "text-anchor": "middle", fill: s === 6 ? "#f5b963" : "#94a3b8", "font-size": 9.5, "font-weight": "700" }, Theory.midiToPitchClass(spec.midis[s], false))
      );
    }

    // Draw clickable scale dots
    map.points.forEach((pt) => {
      const y = topY + (pt.string - 1) * rowGap;
      const x = pt.fret === 0 ? leftX - 13 : leftX + (pt.fret - 0.5) * fretW;
      const isHot = state.glabActiveMidi === pt.midi;
      const fill = isHot ? "#ffffff" : pt.isTonic ? "#f5b963" : pt.isColor ? "#ff7a6b" : "#5fd4c7";
      const g = svgEl("g", { class: "viz-hit" });
      g.appendChild(
        svgEl("circle", {
          cx: x.toFixed(1),
          cy: y.toFixed(1),
          r: isHot ? 8 : pt.isTonic ? 7.2 : 6.4,
          fill,
          stroke: "#0b0e14",
          "stroke-width": 1.2,
        })
      );
      g.appendChild(
        svgEl("text", {
          x: x.toFixed(1),
          y: (y + 2.8).toFixed(1),
          "text-anchor": "middle",
          fill: "#0b0e14",
          "font-size": 7.6,
          "font-weight": "800",
        }, pt.deg)
      );
      g.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playGuitarNote(pt.midi, undefined, 1.3, 0.85);
        state.glabActiveMidi = pt.midi;
        $("glab-caption").textContent =
          pt.string + "-я струна, " + (pt.fret === 0 ? "открытая" : pt.fret + " лад") +
          " → " + pt.noteRu + " (" + pt.noteEn + ") · ступень " + pt.deg;
        renderGuitarLab();
      });
      svg.appendChild(g);
    });

    if (!$("glab-caption").textContent || state.glabActiveMidi === null) {
      $("glab-caption").textContent =
        map.rootRu + " · " + map.mode.name + " (" + map.points.length + " точек на грифе · янтарь = тоника 1, коралл = характерная ступень). Коснись любой точки!";
    }
    $("glab-challenge").textContent = map.challengeText;

    // Auto-scroll guitar neck container horizontally to keep active zone in view on 390px!
    const neckScroll = $("glab-neck-scroll");
    if (neckScroll && (state.glabLayout === "zone" || state.glabLayout === "3nps")) {
      const targetX = Math.max(0, Math.round((state.glabZoneStart - 1) * 32));
      neckScroll.scrollLeft = targetX;
    }

    // 10 Guitar Techniques Lab
    const techRail = $("gtech-pills");
    techRail.textContent = "";
    GuitarLab.GUITAR_TECHNIQUES.forEach((tech) => {
      const btn = h("button", "pill" + (tech.id === state.glabTechId ? " active" : ""), tech.short);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.glabTechId = tech.id;
        state.activePlayer = "gtech";
        renderGuitarLab();
        GuitarLab.playTechniqueDemo(state.audio, tech, state.glabRootPc, () => {
          if (state.activePlayer === "gtech") state.activePlayer = null;
          updatePlayButtons();
        });
        updatePlayButtons();
      });
      techRail.appendChild(btn);
    });

    const curTech = GuitarLab.GUITAR_TECHNIQUES.find((t) => t.id === state.glabTechId) || GuitarLab.GUITAR_TECHNIQUES[0];
    $("gtech-notation-chip").textContent = curTech.notation;
    $("gtech-name").textContent = curTech.name;
    $("gtech-feel").textContent = curTech.feel;
    $("gtech-tab").textContent = "Таб под твой строй: " + GuitarLab.formatTechniqueTab(curTech, state.glabRootPc, tid);
    $("gtech-mechanics").textContent = "Механика рук: " + curTech.mechanics;
    $("gtech-emotion").textContent = "Связь с чувствами: " + curTech.emotionLink;
    $("gtech-drill").textContent = "Этюд на 5 минут: " + curTech.drill5m;

    // One-click Handoff links from Guitar Techniques -> Drums / Tuner!
    const hRow = $("gtech-handoff-row");
    if (hRow) {
      hRow.textContent = "";
      let hasAny = false;
      if (curTech.drumLink) {
        hasAny = true;
        const dBtn = h("button", "btn secondary full", curTech.drumLink.label + " →");
        dBtn.type = "button";
        dBtn.addEventListener("click", () => {
          handoffToDrums({
            rootPc: state.glabRootPc,
            sub: curTech.drumLink.sub,
            bpm: curTech.drumLink.bpm,
            enableBacking: true,
            source: "gtech_" + curTech.id,
          });
        });
        hRow.appendChild(dBtn);
      }
      if (curTech.tunerLink) {
        hasAny = true;
        const tBtn = h("button", "btn secondary full", curTech.tunerLink.label + " →");
        tBtn.type = "button";
        tBtn.addEventListener("click", () => switchTab("tuner"));
        hRow.appendChild(tBtn);
      }
      hRow.classList.toggle("hidden", !hasAny);
    }
    updatePlayButtons();
  }

  function playGuitarLabSequence() {
    if (state.audio.isPlaying && state.activePlayer === "glab") {
      stopAllAudio();
      renderGuitarLab();
      return;
    }
    if (!GuitarLab) return;
    const map = GuitarLab.computeFretboardMap({
      rootPc: state.glabRootPc,
      modeId: state.glabModeId,
      tuningId: getUserTuningId(),
      layout: state.glabLayout,
      zoneStart: state.glabZoneStart,
      singleString: state.glabSingleString,
    });
    if (!map.playSequence.length) return;
    state.audio.unlock();
    state.audio.setTranspose(0);
    state.activePlayer = "glab";
    const events = map.playSequence.map((pt) => ({
      midis: [pt.midi],
      beats: 0.5,
      label: pt.noteRu + " (" + pt.deg + ")",
      velocity: pt.isTonic ? 0.9 : 0.78,
      strum: false,
    }));
    state.audio.playTimeline(events, {
      bpm: 108,
      meter: "4/4",
      loop: false,
      onEvent: (ev) => {
        state.glabActiveMidi = ev.midis[0];
        $("glab-caption").textContent = "Звучит: " + ev.label;
        renderGuitarLab();
      },
      onEnd: () => {
        if (state.activePlayer === "glab") state.activePlayer = null;
        state.glabActiveMidi = null;
        renderGuitarLab();
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  function resolveSceneItem(id) {
    const mech = state.emotionsById.get(id);
    if (mech) return mech;
    if (FeelingsAtlas && FeelingsAtlas.FEELINGS_BY_ID[id]) {
      const pack = FeelingsAtlas.buildFeelingVariations(id, state.atlasKeyPc || 0, getUserTuningId());
      const v = pack.variations[2] || pack.variations[0]; // rich chord/melody variation
      return {
        id: pack.feeling.id,
        title: pack.feeling.name,
        emotion_tag: pack.feeling.family,
        mechanism: pack.feeling.essence,
        music: {
          bpm: pack.feeling.arch.bpm || 84,
          meter: pack.feeling.arch.meter || "4/4",
          drone_midi: pack.droneMidi,
          midi_notes: pack.scaleNotes.map((n) => n.midi),
          timeline: v.events,
        },
      };
    }
    return null;
  }

  function renderSceneBuilder() {
    const slots = $("scene-slots");
    slots.textContent = "";
    $("scene-count").textContent = state.sceneIds.length + " / 6";

    if (!state.sceneIds.length) {
      slots.appendChild(h("span", "muted small-text", "Нажми «+» в списке ниже или выбери готовый пресет выше."));
    } else {
      state.sceneIds.forEach((eid, idx) => {
        const item = resolveSceneItem(eid);
        const rawTitle = item ? item.title.split("(")[0].trim() : "";
        const words = rawTitle.split(/\s+/).slice(0, 3).join(" ");
        const label = (idx + 1) + ". " + eid + (words ? " · " + words : "") + " ×";
        const chip = h("button", "scene-slot-chip", label);
        chip.type = "button";
        chip.addEventListener("click", () => {
          stopAllAudio();
          state.sceneIds.splice(idx, 1);
          renderSceneBuilder();
        });
        slots.appendChild(chip);
      });
    }

    const canPlayScene = state.sceneIds.length >= 2;
    const btnScPlay = $("btn-scene-play");
    const btnScSave = $("btn-scene-save");
    if (btnScPlay) btnScPlay.disabled = !canPlayScene && !state.scenePlaying;
    if (btnScSave) btnScSave.disabled = !canPlayScene;
    const isFull = state.sceneIds.length >= 6;

    document.querySelectorAll(".density-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.density === state.sceneDensity);
    });

    // Inline "+ Добавить в сцену" picker (20 mechanics E01-E20 OR 60 feelings F01-F60!)
    $("btn-spick-mech").classList.toggle("active", state.scenePickerMode === "mechanics");
    $("btn-spick-feel").classList.toggle("active", state.scenePickerMode === "feelings");

    const pList = $("scene-picker-list");
    pList.textContent = "";
    const addBlock = (id) => {
      if (state.sceneIds.length >= 6) return;
      stopAllAudio();
      state.sceneIds.push(id);
      const it = resolveSceneItem(id);
      if (it && it.music && it.music.timeline && it.music.timeline[0]) {
        state.audio.unlock();
        state.audio.playChord(it.music.timeline[0].midis, { strum: true, duration: 0.9 });
      }
      renderSceneBuilder();
    };

    if (state.scenePickerMode === "feelings" && FeelingsAtlas) {
      FeelingsAtlas.FEELINGS.forEach((f) => {
        const row = h("div", "scene-pick-row");
        const copy = h("div", "scene-pick-copy");
        copy.appendChild(h("div", "scene-pick-title", f.id + " · " + f.name));
        copy.appendChild(h("div", "scene-pick-sub", f.arch.modeName + " — " + f.essence));
        const plus = h("button", "scene-plus-btn", "+");
        plus.type = "button";
        plus.disabled = isFull;
        plus.setAttribute("aria-label", "Добавить " + f.name + " в сцену");
        plus.addEventListener("click", () => addBlock(f.id));
        row.appendChild(copy);
        row.appendChild(plus);
        pList.appendChild(row);
      });
    } else {
      state.catalog.emotion_mechanics.forEach((em) => {
        const row = h("div", "scene-pick-row");
        const copy = h("div", "scene-pick-copy");
        copy.appendChild(h("div", "scene-pick-title", em.id + " · " + em.title));
        copy.appendChild(h("div", "scene-pick-sub", Theory.SIMPLE_EMOTIONS[em.id] || em.mechanism));
        const plus = h("button", "scene-plus-btn", "+");
        plus.type = "button";
        plus.disabled = isFull;
        plus.setAttribute("aria-label", "Добавить " + em.id + " в сцену");
        plus.addEventListener("click", () => addBlock(em.id));
        row.appendChild(copy);
        row.appendChild(plus);
        pList.appendChild(row);
      });
    }

    updatePlayButtons();
  }

  function playCurrentScene() {
    if (state.scenePlaying) {
      stopAllAudio();
      return;
    }
    const mechs = state.sceneIds.map((id) => resolveSceneItem(id)).filter(Boolean);
    if (mechs.length < 2) return;

    const scene = Theory.buildSceneTimeline(mechs, state.sceneDensity);
    const wrap = $("scene-triptych");
    wrap.classList.remove("hidden");

    if (!state.sceneViz) {
      state.sceneViz = new Triptych(wrap, {
        onNoteClick: (midi) => {
          state.audio.unlock();
          state.audio.playNote(midi, { duration: 1.2, velocity: 0.82 });
          state.sceneViz.setActiveMidis([midi], "Сцена · " + Theory.midiToLabelPair(midi));
        },
      });
    }

    state.audio.unlock();
    state.audio.setTranspose(0);
    state.scenePlaying = true;
    state.store.logEvent("L02", "scene_play", { ids: state.sceneIds.slice(), density: state.sceneDensity });

    state.sceneViz.setState({
      scaleMidis: [...new Set(scene.events.flatMap((e) => e.midis || []))],
      activeMidis: [],
      rootMidi: scene.drone_midi,
      diffPitchClasses: [],
      clef: "grand",
      tuningId: getUserTuningId(),
      dropD: getUserTuningId() === "drop_d_6",
      capo: 0,
      blindMode: false,
      caption: "Сцена: " + scene.title + " (" + (DENSITY_LABELS_RU[state.sceneDensity] || "Акустика") + ")",
    });

    state.audio.playTimeline(scene.events, {
      bpm: scene.bpm,
      meter: scene.meter,
      forceMetronome: state.sceneDensity === "groove",
      electronic: state.sceneDensity === "groove",
      loop: false,
      onEvent: (ev) => {
        state.sceneViz.setActiveMidis(
          ev.midis,
          (ev.mechanicId ? ev.mechanicId + " · " + ev.mechanicTitle + " → " : "") +
            ev.midis.map((x) => Theory.midiToName(x, false)).join(" + ")
        );
      },
      onEnd: () => {
        state.scenePlaying = false;
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  function renderEmotionsGrid() {
    const grid = $("emotions-grid");
    grid.textContent = "";

    document.querySelectorAll("#emotion-filters .pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.efilter === state.emotionFilter);
    });

    const filtered = state.catalog.emotion_mechanics.filter((em) => {
      if (state.emotionFilter === "world") return WORLD_MECHANIC_IDS.has(em.id);
      if (state.emotionFilter === "rhythm") return RHYTHM_MECHANIC_IDS.has(em.id);
      if (state.emotionFilter === "cinema") return !WORLD_MECHANIC_IDS.has(em.id);
      return true;
    });

    filtered.forEach((em) => {
      const meta = Theory.getEmotionMeta(em.emotion_tag);
      const card = h("article", "emotion-card");
      const head = h("div", "emotion-card-head");
      head.appendChild(h("div", "emotion-card-title", em.id + " · " + em.title));
      const pill = h("span", "emotion-pill", meta.label);
      pill.style.background = meta.soft;
      pill.style.color = meta.accent;
      head.appendChild(pill);
      card.appendChild(head);

      card.appendChild(h("p", "emotion-card-desc", Theory.SIMPLE_EMOTIONS[em.id] || em.mechanism));

      const acts = h("div", "emotion-card-actions");
      const openBtn = h("button", "btn secondary", "▶ В студии");
      openBtn.type = "button";
      openBtn.addEventListener("click", () => openStudio("emotion", em.id, "emotions"));

      const inScene = state.sceneIds.includes(em.id);
      const addBtn = h("button", "btn-pill" + (inScene ? " active" : ""), inScene ? "✓ В сцене" : "+ В сцену");
      addBtn.type = "button";
      addBtn.addEventListener("click", () => {
        stopAllAudio();
        const existingIdx = state.sceneIds.indexOf(em.id);
        if (existingIdx >= 0) {
          state.sceneIds.splice(existingIdx, 1);
        } else if (state.sceneIds.length < 6) {
          state.sceneIds.push(em.id);
        }
        renderEmotionsTab();
      });

      acts.appendChild(openBtn);
      acts.appendChild(addBtn);
      card.appendChild(acts);
      grid.appendChild(card);
    });
  }

  /* ========================= TAB 3: BLIND EAR TRAINER ========================= */
  function renderEarTab() {
    document.querySelectorAll("#ear-mode-pills .pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.earmode === state.earMode);
    });

    if (!state.earViz) {
      state.earViz = new Triptych($("ear-triptych"), {
        onNoteClick: (midi) => {
          state.audio.unlock();
          state.audio.playNote(midi, { duration: 1.1, velocity: 0.85 });
          state.earViz.setActiveMidis([midi], "Проверка на слух: " + Theory.midiToLabelPair(midi));
          // In interval mode, tapping the exact ASCENDING target note answers the ear challenge directly!
          if (!state.earAnswered && state.earChallenge && state.earChallenge.mode === "interval") {
            const upDiff = midi - state.earChallenge.rootMidi;
            const expected = parseInt(state.earChallenge.correctId, 10);
            if (midi === state.earChallenge.targetMidi || (upDiff > 0 && upDiff === expected)) {
              submitEarAnswer(state.earChallenge.correctId, "Нашёл прямо на инструменте!");
            }
          }
        },
      });
    }

    if (!state.earChallenge) {
      nextEarChallenge();
    } else {
      renderEarChallengeView();
    }
  }

  function nextEarChallenge() {
    stopAllAudio();
    state.earChallenge = Theory.generateEarChallenge(state.catalog, state.earMode);
    state.earAnswered = false;
    state.earChosenId = null;
    renderEarChallengeView();
  }

  function renderEarChallengeView() {
    const ch = state.earChallenge;
    if (!ch) return;
    const p = state.store.progress;
    $("ear-score-chip").textContent = p.earCorrect + " / " + p.earTotal;
    $("ear-prompt").textContent = ch.prompt;

    const refBtn = $("btn-ear-ref");
    refBtn.classList.toggle("hidden", ch.mode !== "ab_shift");

    // Hide triptych before answer on non-interval modes (keeps 4 answer buttons cleanly above fold on 390x844!)
    const showViz = state.earAnswered || ch.mode === "interval";
    $("ear-triptych").classList.toggle("hidden", !showViz);

    state.earViz.setState({
      scaleMidis: ch.revealNotes || [],
      activeMidis: state.earAnswered ? (ch.revealNotes || []) : [],
      rootMidi: ch.rootMidi,
      diffPitchClasses: [],
      clef: "grand",
      showStaff: state.earAnswered,
      tuningId: getUserTuningId(),
      dropD: getUserTuningId() === "drop_d_6",
      capo: 0,
      blindMode: !state.earAnswered,
      caption: state.earAnswered
        ? "Открыто: " + (ch.revealNotes || []).map((m) => Theory.midiToLabelPair(m)).join(" · ")
        : "Нажми «▶ Послушать» — или найди вторую ноту прямо на клавишах/грифе.",
    });

    const optsEl = $("ear-options");
    optsEl.textContent = "";
    const isCorrectSaved = state.earAnswered && String(state.earChosenId) === String(ch.correctId);
    ch.options.forEach((opt) => {
      let cls = "ear-opt";
      if (state.earAnswered) {
        if (String(opt.id) === String(ch.correctId)) cls += " correct";
        else if (String(opt.id) === String(state.earChosenId) && !isCorrectSaved) cls += " wrong";
      }
      const btn = h("button", cls);
      btn.type = "button";
      btn.dataset.optId = opt.id;
      btn.disabled = state.earAnswered;
      btn.appendChild(h("div", "ear-opt-title", opt.label));
      if (opt.sub) btn.appendChild(h("div", "ear-opt-sub", opt.sub));
      btn.addEventListener("click", () => {
        if (!state.earAnswered) submitEarAnswer(opt.id);
      });
      optsEl.appendChild(btn);
    });

    const fb = $("ear-feedback");
    if (!state.earAnswered) {
      fb.classList.add("hidden");
      fb.textContent = "";
    }
    const hRow = $("ear-handoff-row");
    if (hRow) {
      const canOpen = state.earAnswered && (ch.sourceAtomId || ch.sourceEmotionId);
      hRow.classList.toggle("hidden", !canOpen);
    }
    updatePlayButtons();
  }

  function playEarTimeline(useReference) {
    if (!useReference && state.audio.isPlaying && state.activePlayer === "ear") {
      stopAllAudio();
      return;
    }
    const ch = state.earChallenge;
    if (!ch) return;
    state.audio.unlock();
    state.audio.setTranspose(0);
    state.activePlayer = "ear";
    const tl = useReference && ch.referenceTimeline ? ch.referenceTimeline : ch.timeline;
    state.audio.playTimeline(tl, {
      bpm: ch.bpm || 88,
      meter: ch.meter || "4/4",
      forceMetronome: !!ch.forceMetronome,
      loop: false,
      onEvent: (ev) => {
        if (state.earAnswered) {
          state.earViz.setActiveMidis(ev.midis, ev.midis.map((m) => Theory.midiToLabelPair(m)).join(" + "));
        } else {
          state.earViz.triggerPulse(0.9);
        }
      },
      onEnd: () => {
        if (state.activePlayer === "ear") state.activePlayer = null;
        updatePlayButtons();
      },
    });
    updatePlayButtons();
  }

  function submitEarAnswer(chosenId, bonusPrefix) {
    const ch = state.earChallenge;
    if (!ch || state.earAnswered) return;
    state.earAnswered = true;
    state.earChosenId = String(chosenId);

    const isCorrect = String(chosenId) === String(ch.correctId);
    const score = state.store.recordEarAttempt(ch.mode, isCorrect);
    $("ear-score-chip").textContent = score.correct + " / " + score.total;

    renderEarChallengeView();

    const fb = $("ear-feedback");
    fb.classList.remove("hidden");
    const head = isCorrect ? (bonusPrefix ? "✓ Точно! " + bonusPrefix + " " : "✓ Точно в цель! ") : "Хорошая калибровка слуха: ";
    fb.textContent = head + ch.explanation;
  }

  /* ========================= TAB 4: DRUM GROOVE GENERATOR & METRONOME ========================= */
  function ensureDrums() {
    if (state.drums || !Drums) return;
    state.drums = new Drums.DrumGrooveEngine(state.audio);
    state.drums.bpm = 104;
    state.drums.sub = state.drumSub;
    state.drums.setBars([Drums.buildBarPattern("4/4", state.drumSub, { style: "rock", isFirstBar: true })]);
  }

  function rebuildDrumBarsWithSub(newSub) {
    ensureDrums();
    state.drumSub = newSub;
    state.drums.sub = newSub;
    const meters = state.drums.bars.map((b) => b.meter);
    state.drums.setBars(
      meters.map((m, idx) => Drums.buildBarPattern(m, newSub, { style: state.drumStyle, isFirstBar: idx === 0 }))
    );
    renderDrumsTab();
  }

  function applyDrumPreset(preset) {
    ensureDrums();
    state.drumStyle = preset.style || "rock";
    state.drumSub = preset.sub || "1/8";
    state.drums.bpm = preset.bpm || 104;
    state.drums.sub = state.drumSub;
    state.drums.setBars(
      preset.bars.map((m, idx) => Drums.buildBarPattern(m, state.drumSub, { style: state.drumStyle, isFirstBar: idx === 0 }))
    );
    state.drumEditBarIdx = 0;
    renderDrumsTab();
  }

  function syncDrumBarsToProgression() {
    ensureDrums();
    const d = state.drums;
    if (!d) return;
    const targetLen = Math.max(1, Math.min(4, d.getProgressionLength()));
    const baseMeters = d.bars.length ? d.bars.map((b) => b.meter) : ["4/4"];
    const nextBars = [];
    for (let i = 0; i < targetLen; i++) {
      if (d.bars[i]) {
        nextBars.push(d.bars[i]);
      } else {
        const m = baseMeters[i % baseMeters.length];
        nextBars.push(Drums.buildBarPattern(m, state.drumSub, { style: state.drumStyle, isFirstBar: i === 0 }));
      }
    }
    d.setBars(nextBars);
    if (state.drumEditBarIdx >= nextBars.length) state.drumEditBarIdx = 0;
  }

  function updateDrumLiveHighlight(info) {
    const barChanged = info.barIdx !== state.drumEditBarIdx && state.drums && state.drums.bars[info.barIdx];
    const prevSymbol = state.drumLiveChord ? state.drumLiveChord.symbol : null;
    const nextSymbol = info.chordInfo ? info.chordInfo.symbol : null;
    const chordChanged = !!(nextSymbol && nextSymbol !== prevSymbol);
    state.drumPlayingBarIdx = info.barIdx;
    state.drumPlayingStepIdx = info.stepIdx;
    if (info.chordInfo) state.drumLiveChord = info.chordInfo;

    if (barChanged || (chordChanged && state.drums && state.drums.bars.length === 1)) {
      if (barChanged) state.drumEditBarIdx = info.barIdx;
      renderDrumGridAndChain();
    }

    const cBox = document.querySelector(".drum-count-box");
    if (cBox) {
      cBox.classList.toggle("silent-gap", !!info.isSilentGap);
      cBox.classList.toggle("pulse-hit", info.stepIdx === 0 && !info.isSilentGap);
    }
    $("drum-live-count").textContent = info.isSilentGap ? "…" : (info.countLabel || "·");
    $("drum-live-meter").textContent =
      (info.isSilentGap ? "Тихий такт · " : "Такт " + (info.barIdx + 1) + " · ") +
      info.meter +
      (info.chordLabel ? " · " + info.chordLabel : "");
    if (info.chordLabel) {
      $("drum-backing-chord").textContent = "Звучит: " + info.chordLabel;
    }

    // Highlight active bar chip in compound chain
    document.querySelectorAll("#drum-bars-chain .scene-slot-chip").forEach((el, idx) => {
      el.classList.toggle("bar-chip-playing", idx === info.barIdx);
    });

    // Highlight active step column in the synced bar grid
    document.querySelectorAll("#drum-grid [data-col]").forEach((el) => {
      const col = parseInt(el.dataset.col, 10);
      el.classList.toggle("now", col === info.stepIdx);
    });
  }

  function renderDrumGridAndChain() {
    const d = state.drums;
    if (!d || !d.bars.length) return;
    if (state.drumEditBarIdx >= d.bars.length) state.drumEditBarIdx = 0;

    // Compound bar chain chips — each bar clearly shows BOTH its meter AND its linked chord!
    const chainEl = $("drum-bars-chain");
    chainEl.textContent = "";
    d.bars.forEach((bar, idx) => {
      const ch = d.bars.length === 1 && d.isPlaying && state.drumLiveChord
        ? state.drumLiveChord
        : d.resolveChordForBar(idx);
      const chip = h(
        "button",
        "scene-slot-chip" +
          (idx === state.drumEditBarIdx ? " bar-chip-active" : "") +
          (d.isPlaying && idx === state.drumPlayingBarIdx ? " bar-chip-playing" : ""),
        (idx + 1) + ". " + bar.meter + " · " + ch.symbol
      );
      chip.type = "button";
      chip.addEventListener("click", () => {
        state.drumEditBarIdx = idx;
        renderDrumsTab();
      });
      chainEl.appendChild(chip);
    });

    // 5-voice interactive step sequencer + synced Backing Chord/Bass row for selected bar
    const curBar = d.bars[state.drumEditBarIdx];
    const barChord = d.bars.length === 1 && d.isPlaying && state.drumLiveChord
      ? state.drumLiveChord
      : d.resolveChordForBar(state.drumEditBarIdx);
    $("drum-grid-title").textContent =
      "Сетка такта " + (state.drumEditBarIdx + 1) + " · " + curBar.meter + " · " +
      barChord.symbol + " (" + barChord.roman + ") · " + curBar.steps + " ш.";

    const gridEl = $("drum-grid");
    gridEl.textContent = "";
    const colsTemplate = "58px repeat(" + curBar.steps + ", minmax(22px, 1fr))";

    // Header count row
    const hdrRow = h("div", "drum-row");
    hdrRow.style.gridTemplateColumns = colsTemplate;
    hdrRow.appendChild(h("span", "drum-step-hdr", "Счёт"));
    curBar.labels.forEach((lbl, sIdx) => {
      const cell = h("span", "drum-step-hdr" + (sIdx % curBar.spb === 0 ? " beat-start" : ""), lbl);
      cell.dataset.col = String(sIdx);
      hdrRow.appendChild(cell);
    });
    gridEl.appendChild(hdrRow);

    // Synced Chord & Bass anchor row (visually ties chord progression + meter to the grid!)
    const backingRow = h("div", "drum-row");
    backingRow.style.gridTemplateColumns = colsTemplate;
    const bLbl = h("button", "drum-row-lbl", barChord.symbol);
    bLbl.type = "button";
    bLbl.style.color = "#f5b963";
    bLbl.title = "Аккорд такта " + (state.drumEditBarIdx + 1) + ": " + barChord.symbol + " (" + barChord.roman + ")";
    bLbl.addEventListener("click", () => {
      state.audio.unlock();
      state.audio.playChord(barChord.padMidis, { duration: 1.1, velocity: 0.72, strum: true });
    });
    backingRow.appendChild(bLbl);

    for (let s = 0; s < curBar.steps; s++) {
      const kickHit = curBar.grid.kick ? curBar.grid.kick[s] > 0 : false;
      const isDownbeat = s === 0;
      const isPickup = s >= curBar.steps - curBar.spb && kickHit;
      const lv = isDownbeat ? 2 : (kickHit ? 1 : 0);
      const cell = h(
        "span",
        "drum-cell v-backing" + (s % curBar.spb === 0 ? " beat-start" : "") + (lv === 2 ? " lv2" : lv === 1 ? " lv1" : ""),
        isDownbeat ? barChord.roman : (isPickup ? "5" : (kickHit ? "●" : ""))
      );
      cell.dataset.col = String(s);
      backingRow.appendChild(cell);
    }
    gridEl.appendChild(backingRow);

    // 5 drum voice rows
    Drums.VOICES.forEach((vId) => {
      const th = Drums.DRUM_THEORY[vId];
      const row = h("div", "drum-row");
      row.style.gridTemplateColumns = colsTemplate;

      const lblBtn = h("button", "drum-row-lbl", th.short);
      lblBtn.type = "button";
      lblBtn.style.color = th.color;
      lblBtn.addEventListener("click", () => {
        d.playVoice(vId, vId === "snare" || vId === "cymbal" ? 2 : 1);
        state.drumTheoryVoice = vId;
        renderDrumTheoryCard();
      });
      row.appendChild(lblBtn);

      const arr = curBar.grid[vId] || [];
      for (let s = 0; s < curBar.steps; s++) {
        const lv = arr[s] || 0;
        const cell = h(
          "button",
          "drum-cell v-" + vId + (s % curBar.spb === 0 ? " beat-start" : "") + (lv === 1 ? " lv1" : lv >= 2 ? " lv2" : "")
        );
        cell.type = "button";
        cell.dataset.col = String(s);
        cell.setAttribute("aria-label", th.name + " шаг " + (s + 1));
        cell.addEventListener("click", () => {
          const maxLv = vId === "kick" ? 1 : 2;
          const nextLv = (arr[s] + 1) % (maxLv + 1);
          arr[s] = nextLv;
          if (nextLv > 0) d.playVoice(vId, nextLv);
          renderDrumsTab();
        });
        row.appendChild(cell);
      }
      gridEl.appendChild(row);
    });
  }

  function renderDrumsTab() {
    ensureDrums();
    const d = state.drums;
    if (!d) return;
    if (state.drumEditBarIdx >= d.bars.length) state.drumEditBarIdx = 0;

    const chainStr = d.bars.map((b) => b.meter).join(" + ");
    $("drum-chain-badge").textContent = chainStr + " · " + state.drumSub;
    $("drum-bars-count").textContent = d.bars.length + " / 4 такта";
    $("drum-bpm-val").textContent = d.bpm + " BPM";
    $("drum-bpm-slider").value = String(d.bpm);

    const curChord = d.resolveChordForBar(state.drumEditBarIdx);
    if (!d.isPlaying) {
      $("drum-live-count").textContent = "1";
      $("drum-live-meter").textContent =
        "Такт " + (state.drumEditBarIdx + 1) + " · " + d.bars[state.drumEditBarIdx].meter + " · " + curChord.symbol;
    }

    // Subdivision pills
    document.querySelectorAll("#drum-sub-pills .btn-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.sub === state.drumSub);
    });

    // Mode toggles (sync BOTH .active and aria-pressed cleanly!)
    const syncToggle = (id, on, label) => {
      const btn = $(id);
      if (!btn) return;
      btn.setAttribute("aria-pressed", String(!!on));
      btn.classList.toggle("active", !!on);
      if (label !== undefined) btn.textContent = label;
    };
    syncToggle("btn-drum-click", d.metronomeOn, "Клик: " + (d.metronomeOn ? "вкл" : "выкл"));
    syncToggle("btn-drum-metro-only", d.metronomeOnly);
    syncToggle("btn-drum-autofill", d.autoFill);
    syncToggle("btn-drum-gap", d.gapMode);

    // Custom progression banner (from Circle of Fifths / 60 Feelings handoff)
    const customBanner = $("drum-custom-prog-banner");
    const hasCustom = !!(d.customChords && d.customChords.length);
    if (customBanner) {
      customBanner.classList.toggle("hidden", !hasCustom);
      if (hasCustom) {
        const syms = d.customChords.map((c) => c.symbol).join(" – ");
        $("drum-custom-prog-text").textContent = "🎯 " + (d.customProgLabel || "Своя палитра") + ": " + syms;
      }
    }

    // Jam Backing Track controls (Analog Bass + 2 Soft Synths + 12 Keys + 6 Progressions)
    const backingActive = d.backingBassOn || d.backingSynthMode !== "off";
    $("drum-backing-chord").textContent = backingActive
      ? curChord.symbol + (curChord.rootRu ? " (" + curChord.rootRu + ")" : "")
      : curChord.symbol + " · выкл";
    $("btn-backing-bass").setAttribute("aria-pressed", String(d.backingBassOn));
    $("btn-backing-bass").classList.toggle("active", d.backingBassOn);
    $("btn-backing-bass").textContent = "Бас: " + (d.backingBassOn ? "вкл" : "выкл");
    document.querySelectorAll(".backing-synth-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bsynth === d.backingSynthMode);
    });

    const bKeysRail = $("drum-backing-keys");
    bKeysRail.textContent = "";
    Drums.BACKING_KEYS.forEach((k) => {
      const btn = h("button", "pill" + (!hasCustom && k.pc === d.backingRootPc ? " active" : ""), k.ru + " (" + k.en + ")");
      btn.type = "button";
      btn.addEventListener("click", () => {
        d.clearCustomProgression();
        d.backingRootPc = k.pc;
        syncSessionContext({ rootPc: k.pc, keepGuitarRoot: true });
        renderDrumsTab();
        if (backingActive && !d.isPlaying) d.previewBacking();
      });
      bKeysRail.appendChild(btn);
    });

    const bProgsRail = $("drum-backing-progs");
    bProgsRail.textContent = "";
    Drums.BACKING_PROGRESSIONS.forEach((pr) => {
      const btn = h("button", "pill" + (!hasCustom && pr.id === d.backingProgId ? " active" : ""), pr.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        d.clearCustomProgression();
        d.backingProgId = pr.id;
        syncDrumBarsToProgression();
        renderDrumsTab();
        if (backingActive && !d.isPlaying) d.previewBacking();
      });
      bProgsRail.appendChild(btn);
    });

    // Presets rail
    const pRail = $("drum-presets-rail");
    pRail.textContent = "";
    Drums.GROOVE_PRESETS.forEach((pr) => {
      const isCur = pr.bars.join("+") === d.bars.map((b) => b.meter).join("+") && pr.style === state.drumStyle;
      const btn = h("button", "pill" + (isCur ? " active" : ""), pr.label);
      btn.type = "button";
      btn.addEventListener("click", () => applyDrumPreset(pr));
      pRail.appendChild(btn);
    });

    const delBtn = $("btn-drum-del-bar");
    if (delBtn) delBtn.disabled = d.bars.length <= 1;

    renderDrumGridAndChain();
    renderDrumTheoryCard();
    updatePlayButtons();
  }

  function renderDrumTheoryCard() {
    if (!Drums) return;
    const padsEl = $("drum-theory-pads");
    padsEl.textContent = "";
    ["kick", "snare", "hat", "tom", "cymbal"].forEach((vId) => {
      const th = Drums.DRUM_THEORY[vId];
      const pad = h("button", "drum-pad" + (state.drumTheoryVoice === vId ? " active" : ""), th.short);
      pad.type = "button";
      pad.addEventListener("click", () => {
        ensureDrums();
        state.drumTheoryVoice = vId;
        state.drums.playVoice(vId, vId === "snare" || vId === "cymbal" ? 2 : 1);
        renderDrumTheoryCard();
      });
      padsEl.appendChild(pad);
    });

    const cur = Drums.DRUM_THEORY[state.drumTheoryVoice] || Drums.DRUM_THEORY.kick;
    $("dt-name").textContent = cur.name + " — роль в музыке";
    $("dt-role").textContent = cur.role;
    $("dt-placement").textContent = "Куда ставится: " + cur.placement;
    $("dt-rehearsal").textContent = "На репетиции: " + cur.rehearsal;
  }

  /* ========================= TAB 5: ANALOG 120FPS TUNER ========================= */
  function ensureTuner() {
    if (state.tuner || !Tuner) return;
    state.tuner = new Tuner.AnalogTunerController($("tuner-canvas"), {
      onStateChange: ({ running }) => {
        const btn = $("btn-tuner-mic");
        if (btn) {
          btn.textContent = running ? "■ Выключить микрофон" : "Включить микрофон";
          btn.classList.toggle("playing", running);
        }
      },
      onUpdate: (info) => {
        if (info.fps > 20) {
          $("tuner-fps-chip").textContent = info.fps + " fps · Точный";
        }
        if (!info.active || !info.pitch) {
          $("tuner-freq").textContent = "— Гц";
          const cEl = $("tuner-cents");
          cEl.textContent = state.tuner.running ? "Слушаю звук..." : "Готов к настройке";
          cEl.classList.remove("in-tune");
          $("tuner-dir").textContent = "Ля = 440 Гц";
          state.tunerActiveString = null;
          updateTunerStringHighlight();
          return;
        }
        const p = info.pitch;
        $("tuner-freq").textContent = p.freq.toFixed(1) + " Гц";
        const cEl = $("tuner-cents");
        const rounded = Math.round(p.cents);
        if (info.preview) {
          cEl.textContent = "Эталон · " + p.noteEn + " (" + p.noteRu + ")";
          cEl.classList.add("in-tune");
          $("tuner-dir").textContent = "0 ¢";
        } else if (p.inTune) {
          cEl.textContent = "✓ В точку (0 ¢)";
          cEl.classList.add("in-tune");
          $("tuner-dir").textContent = "точно";
        } else {
          cEl.textContent = (rounded > 0 ? "+" : "") + rounded + " ¢";
          cEl.classList.remove("in-tune");
          $("tuner-dir").textContent = rounded < 0 ? "↑ подтяни" : "↓ ослабь";
        }
        state.tunerActiveString = info.closestString ? info.closestString.stringNum : null;
        updateTunerStringHighlight();
      },
    });
  }

  function updateTunerStringHighlight() {
    document.querySelectorAll("#tuner-strings-grid .string-btn").forEach((btn) => {
      const sNum = parseInt(btn.dataset.stringNum, 10);
      btn.classList.toggle("active", sNum === state.tunerActiveString);
    });
  }

  function renderTunerTab() {
    ensureTuner();
    const tid = getUserTuningId();
    const spec = Theory.getTuningSpec(tid);
    const damping = state.store.profile.tunerDamping || "slow";

    if (state.tuner) {
      state.tuner.setMode(state.tunerMode);
      state.tuner.setTuning(tid);
      state.tuner.setDamping(damping);
      state.tuner._drawFrame();
    }

    $("tuner-mode-guitar").classList.toggle("active", state.tunerMode === "guitar");
    $("tuner-mode-voice").classList.toggle("active", state.tunerMode === "voice");
    $("tuner-damp-slow").classList.toggle("active", damping === "slow");
    $("tuner-damp-fast").classList.toggle("active", damping === "fast");

    $("tuner-guitar-box").classList.toggle("hidden", state.tunerMode === "voice");
    $("tuner-tuning-label").textContent = spec.strings + " струн · " + spec.lowToHighLabel;
    renderTuningPills($("tuner-tuning-pills"), tid);

    // Render string reference buttons from lowest/thickest string (7th/6th) to 1st string
    const grid = $("tuner-strings-grid");
    grid.textContent = "";
    for (let idx = spec.midis.length - 1; idx >= 0; idx--) {
      const strNum = idx + 1;
      const midi = spec.midis[idx];
      const hz = Theory.midiToFreq(midi);
      const btn = h("button", "string-btn");
      btn.type = "button";
      btn.dataset.stringNum = String(strNum);
      btn.appendChild(h("span", "string-btn-num", strNum + "-я стр."));
      btn.appendChild(h("span", "string-btn-note", Theory.midiToName(midi, false)));
      btn.appendChild(h("span", "string-btn-hz", hz.toFixed(1) + " Гц"));
      btn.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playReferenceTone(midi, 2.3);
        if (state.tuner) state.tuner.showReferencePreview(midi);
      });
      grid.appendChild(btn);
    }
    updateTunerStringHighlight();
  }

  /* ========================= TAB 5: MY RHYTHM ========================= */
  function renderRhythmTab() {
    const cat = state.catalog;
    const store = state.store;
    const done = store.progress.completedAtoms.length;
    const total = cat.atoms.length;
    const dueIds = store.getDueReviewIds(12);

    $("stat-atoms").textContent = done + " / " + total;
    $("stat-ear").textContent = store.progress.earTotal
      ? Math.round((store.progress.earCorrect / store.progress.earTotal) * 100) + "%"
      : "—";
    $("stat-due").textContent = String(dueIds.length);

    // Due reviews list
    const dueWrap = $("rhythm-due-list");
    dueWrap.textContent = "";
    if (!dueIds.length) {
      dueWrap.appendChild(h("p", "muted small-text", "На сегодня повторов нет. Пройденные уроки будут мягко возвращаться через 1, 3, 7, 14 и 30 дней, чтобы слух узнавал их мгновенно."));
    } else {
      dueIds.forEach((aid) => {
        const atom = state.atomsById.get(aid);
        if (!atom) return;
        const simple = Theory.SIMPLE_LESSONS && Theory.SIMPLE_LESSONS[atom.id];
        const btn = h("button", "atom-row");
        btn.type = "button";
        btn.appendChild(h("span", "atom-row-title", atom.id + " · " + (simple && simple.title ? simple.title : atom.title)));
        btn.appendChild(h("span", "atom-row-status", "▶"));
        btn.addEventListener("click", () => openStudio("atom", atom.id, "rhythm"));
        dueWrap.appendChild(btn);
      });
    }

    // 9 Acts progress bars
    const barsWrap = $("rhythm-acts-bars");
    barsWrap.textContent = "";
    const completedSet = new Set(store.progress.completedAtoms);
    cat.acts.forEach((act) => {
      const atoms = cat.atoms.filter((a) => a.act === act.id);
      const count = atoms.filter((a) => completedSet.has(a.id)).length;
      const pct = atoms.length ? Math.round((count / atoms.length) * 100) : 0;

      const row = h("div", "act-bar-item");
      const top = h("div", "act-bar-top");
      top.appendChild(h("span", "", ACT_SHORT_NAMES[act.id] || act.title));
      top.appendChild(h("span", "muted", count + " / " + atoms.length));
      const track = h("div", "progress-track");
      const fill = h("div", "progress-fill");
      fill.style.width = pct + "%";
      track.appendChild(fill);
      row.appendChild(top);
      row.appendChild(track);
      barsWrap.appendChild(row);
    });

    // Saved scenes
    const scenesWrap = $("rhythm-scenes-list");
    scenesWrap.textContent = "";
    const saved = store.progress.savedScenes || [];
    if (!saved.length) {
      scenesWrap.appendChild(h("p", "muted small-text", "Пока нет сохранённых сцен. Собери цепочку во вкладке «Студия → Сцена» и нажми «Сохранить»."));
    } else {
      saved.forEach((sc) => {
        const btn = h("button", "atom-row");
        btn.type = "button";
        const dLbl = DENSITY_LABELS_RU[sc.density] || sc.density;
        btn.appendChild(h("span", "atom-row-title", sc.ids.join(" → ") + " (" + dLbl + ")"));
        btn.appendChild(h("span", "atom-row-status", "▶"));
        btn.addEventListener("click", () => {
          state.sceneIds = sc.ids.slice();
          state.sceneDensity = sc.density || "acoustic";
          if (typeof sc.keyPc === "number") state.atlasKeyPc = sc.keyPc;
          state.emotionSubTab = "scene";
          switchTab("emotions");
          playCurrentScene();
        });
        scenesWrap.appendChild(btn);
      });
    }

    // Settings
    const curTimbre = store.profile.timbre || "guitar";
    $("pref-guitar").classList.toggle("active", curTimbre === "guitar");
    $("pref-piano").classList.toggle("active", curTimbre === "piano");
    $("pref-drone").classList.toggle("active", !!store.profile.droneDefault);
    $("pref-drone").textContent = store.profile.droneDefault ? "Вкл" : "Выкл";
    const sbBtn = $("pref-sandbox");
    if (sbBtn) {
      const fullOpen = !!store.profile.sandboxUnlocked || store.getUnlockLevel() >= 3;
      sbBtn.classList.toggle("active", fullOpen);
      sbBtn.textContent = store.profile.sandboxUnlocked ? "Всё открыто" : (store.getUnlockLevel() >= 3 ? "Открыто (пройдено)" : "По шагам");
    }
    renderTuningPills($("pref-tuning-pills"), getUserTuningId());

    // Tribute support confirmation
    $("l04-status").textContent = store.profile.proInterestClicked
      ? "💛 Спасибо за поддержку! Это помогает развивать уроки, ударные и тюнер бесплатно и без рекламы."
      : "";

    $("storage-backend-info").textContent =
      "Хранилище: " + (store.useCloud ? "облако Telegram + локально" : "локально на устройстве") +
      " · Завершено занятий: " + (store.progress.totalSessions || 0);
  }

  /* ========================= EVENT WIRING ========================= */
  function bindEvents() {
    // Continuously keep iOS / Telegram WKWebView audio unlocked on trusted touchend & click gestures
    const ensureAudioUnlocked = () => {
      state.audio.unlock();
    };
    window.addEventListener("touchend", ensureAudioUnlocked, { passive: true, capture: true });
    window.addEventListener("click", ensureAudioUnlocked, { passive: true, capture: true });

    $("brand-home").addEventListener("click", () => switchTab("route"));
    const btnOpenTuner = $("btn-open-tuner");
    if (btnOpenTuner) {
      btnOpenTuner.addEventListener("click", () => {
        if (state.activeTab !== "tuner" && state.activeTab !== "rhythm") state.returnTab = state.activeTab;
        switchTab("tuner");
      });
    }
    const btnTunerBack = $("btn-tuner-back");
    if (btnTunerBack) btnTunerBack.addEventListener("click", () => switchTab(state.returnTab || "route"));
    $("hud-pill").addEventListener("click", () => {
      if (state.activeTab !== "rhythm" && state.activeTab !== "tuner") state.returnTab = state.activeTab;
      switchTab("rhythm");
    });
    const btnRhythmBack = $("btn-rhythm-back");
    if (btnRhythmBack) btnRhythmBack.addEventListener("click", () => switchTab(state.returnTab || "route"));
    $("btn-footer-tribute").addEventListener("click", () => openTributeDonation("footer"));
    $("btn-start-day1").addEventListener("click", () => {
      const next = getNextUncompletedAtom();
      openStudio("atom", (next && next.id) || "M001", "route");
    });
    $("btn-toggle-staff").addEventListener("click", () => {
      state.studioShowStaff = !state.studioShowStaff;
      renderStudioContent();
    });
    const btnSoundHelp = $("btn-sound-help");
    if (btnSoundHelp) {
      btnSoundHelp.addEventListener("click", () => {
        state.audio.unlock();
        state.audio.playReferenceTone(69, 0.75);
        const tip = $("sound-help-tip");
        if (tip) {
          const d = state.audio.getDiagnostics ? state.audio.getDiagnostics() : { ctxState: "?", iosTag: "?" };
          tip.textContent = "Пробный сигнал Ля (440 Гц) отправлен · Движок: " + d.ctxState + " · Канал: " + d.iosTag + ". Если всё равно тихо — прибавь громкость сбоку телефона или сними беззвучный режим.";
          tip.classList.remove("hidden");
        }
      });
    }

    document.querySelectorAll("#main-tabs .tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (state.store && !state.store.isUnlocked(tab)) {
          openLockPrompt(tab, { kind: "tab", id: tab });
          return;
        }
        switchTab(tab);
      });
    });

    // Studio nav & controls
    $("btn-studio-back").addEventListener("click", () => switchTab(state.returnTab || "route"));
    $("btn-studio-prev").addEventListener("click", () => stepStudioItem(-1));
    $("btn-studio-next").addEventListener("click", () => stepStudioItem(1));

    $("btn-play").addEventListener("click", () => {
      if (state.audio.isPlaying && !state.scenePlaying) {
        stopAllAudio();
      } else {
        playStudioCurrent();
      }
    });

    $("btn-loop").addEventListener("click", () => {
      state.loopOn = !state.loopOn;
      $("btn-loop").setAttribute("aria-pressed", String(state.loopOn));
      if (state.audio.isPlaying) playStudioCurrent();
    });

    $("btn-timbre").addEventListener("click", () => {
      const next = state.audio.timbre === "guitar" ? "piano" : "guitar";
      state.audio.setTimbre(next);
      state.store.updateProfile({ timbre: next });
      $("btn-timbre").textContent = next === "piano" ? "Пианино" : "Гитара";
      if (state.audio.isPlaying) playStudioCurrent();
    });

    $("btn-drone").addEventListener("click", () => {
      state.audio.unlock();
      const next = !state.audio.droneOn;
      const baseDrone = (state.studioItem && state.studioItem.music && state.studioItem.music.drone_midi) || 48;
      state.audio.setDrone(next, baseDrone);
      $("btn-drone").setAttribute("aria-pressed", String(next));
      $("btn-drone").textContent = "Фон-нота: " + (next ? Theory.midiToPitchClass(getEffectiveDroneMidi(), true) : "выкл");
    });

    $("btn-metro").addEventListener("click", () => {
      const next = !state.audio.metronomeOn;
      state.audio.setMetronome(next);
      $("btn-metro").setAttribute("aria-pressed", String(next));
      if (state.audio.isPlaying) playStudioCurrent();
    });

    $("btn-rate").addEventListener("click", () => {
      state.rateIdx = (state.rateIdx + 1) % RATES.length;
      state.audio.setRate(RATES[state.rateIdx]);
      $("btn-rate").textContent = "Темп " + RATES[state.rateIdx].toFixed(2).replace(/\.00$/, ".0") + "×";
      if (state.audio.isPlaying) playStudioCurrent();
    });

    // Live A <-> B Contrast switcher (switches AND plays immediately!)
    $("btn-ab-a").addEventListener("click", () => {
      state.abMode = "A";
      state.store.logEvent("L02", "ab_compare", { id: state.studioItem.id, side: "A" });
      renderStudioContent();
      playStudioCurrent();
    });
    $("btn-ab-b").addEventListener("click", () => {
      state.abMode = "B";
      state.store.logEvent("L02", "ab_compare", { id: state.studioItem.id, side: "B" });
      renderStudioContent();
      playStudioCurrent();
    });
    $("btn-ab-full").addEventListener("click", () => {
      state.abMode = "full";
      renderStudioContent();
      playStudioCurrent();
    });

    // Live 12-key Transposer & Virtual Capo
    const setTranspose = (val) => {
      state.transpose = Theory.clamp(val, -5, 6);
      state.audio.setTranspose(state.transpose);
      state.store.updateProfile({ transpose: state.transpose });
      renderStudioContent();
      if (state.audio.isPlaying) playStudioCurrent();
    };
    $("btn-tr-down").addEventListener("click", () => setTranspose(state.transpose - 1));
    $("btn-tr-up").addEventListener("click", () => setTranspose(state.transpose + 1));

    const setCapo = (val) => {
      state.capo = Theory.clamp(val, 0, 7);
      state.store.updateProfile({ capo: state.capo });
      renderStudioContent();
    };
    $("btn-capo-down").addEventListener("click", () => setCapo(state.capo - 1));
    $("btn-capo-up").addEventListener("click", () => setCapo(state.capo + 1));

    // 2-click semantic atom completion + NFS Milestone Celebration trigger
    $("btn-complete-heard").addEventListener("click", () => {
      if (!state.studioItem || state.studioKind !== "atom") return;
      const prevLevel = state.store.getUnlockLevel();
      state.store.completeAtom(state.studioItem.id, "heard_shift");
      Analytics.track("lesson_complete", { id: state.studioItem.id, act: state.studioItem.act });
      const nextLevel = state.store.getUnlockLevel();
      updateHud();
      stepStudioItem(1);
      const seen = state.store.profile.seenMilestones || [];
      if (!state.store.profile.sandboxUnlocked && nextLevel > prevLevel && nextLevel >= 1 && nextLevel <= 3 && !seen.includes(nextLevel)) {
        state.store.markMilestoneSeen(nextLevel);
        openMilestoneModal(nextLevel);
      }
    });
    $("btn-complete-repeat").addEventListener("click", () => {
      if (!state.studioItem || state.studioKind !== "atom") return;
      state.store.completeAtom(state.studioItem.id, "need_repeat");
      updateHud();
      $("complete-status").textContent = "✓ Запланировано мягкое возвращение к этому звуку завтра.";
    });

    // Studio -> Ear & Drums handoff bridges
    const btnStudioToEar = $("btn-studio-to-ear");
    if (btnStudioToEar) {
      btnStudioToEar.addEventListener("click", () => {
        if (!state.studioItem) return;
        if (state.studioKind === "atom") {
          const m = state.studioItem.music || {};
          const mode = m.contrast && m.contrast.a && m.contrast.b ? "ab_shift" : "interval";
          handoffToEar({ mode, focusAtom: state.studioItem });
        } else {
          handoffToEar({ mode: "emotion_mode" });
        }
      });
    }
    const btnStudioToDrums = $("btn-studio-to-drums");
    if (btnStudioToDrums) {
      btnStudioToDrums.addEventListener("click", () => {
        const m = (state.studioItem && state.studioItem.music) || {};
        const rawRoot = typeof m.drone_midi === "number" ? m.drone_midi + state.transpose : 48 + state.transpose;
        const meter = m.meter && Drums && Drums.METERS[m.meter] ? m.meter : "4/4";
        handoffToDrums({
          rootPc: ((rawRoot % 12) + 12) % 12,
          bpm: m.bpm || 96,
          meter,
          enableBacking: true,
          source: "studio_" + (state.studioItem ? state.studioItem.id : "lesson"),
        });
      });
    }

    // 60-Feeling Atlas search, play, timbre & 4 handoff bridges
    $("atlas-search").addEventListener("input", (ev) => {
      state.atlasQuery = ev.target.value || "";
      renderFeelingsAtlas();
    });
    const btnAtlasPlayMain = $("btn-atlas-play-main");
    if (btnAtlasPlayMain) {
      btnAtlasPlayMain.addEventListener("click", () => {
        if (state.audio.isPlaying && state.activePlayer === "atlas") {
          stopAllAudio();
          renderFeelingsAtlas();
        } else {
          playAtlasVariation(0);
        }
      });
    }
    $("btn-atlas-timbre").addEventListener("click", () => {
      const next = state.audio.timbre === "guitar" ? "piano" : "guitar";
      state.audio.setTimbre(next);
      state.store.updateProfile({ timbre: next });
      renderFeelingsAtlas();
    });
    const getAtlasBuilt = () => {
      if (!FeelingsAtlas) return null;
      return FeelingsAtlas.buildFeelingVariations(state.atlasFeelingId, state.atlasKeyPc, getUserTuningId());
    };
    const btnAtlasToCircle = $("btn-atlas-to-circle");
    if (btnAtlasToCircle) {
      btnAtlasToCircle.addEventListener("click", () => {
        const built = getAtlasBuilt();
        if (!built) return;
        handoffToCircle({
          rootPc: state.atlasKeyPc,
          mode: (built.archetype && built.archetype.circleMode) || "major",
          chords: built.backingChords,
          source: "atlas_" + built.feeling.id,
        });
      });
    }
    const btnAtlasToGuitar = $("btn-atlas-to-guitar");
    if (btnAtlasToGuitar) {
      btnAtlasToGuitar.addEventListener("click", () => {
        const built = getAtlasBuilt();
        if (!built) return;
        handoffToGuitarLab({
          rootPc: state.atlasKeyPc,
          modeId: (built.archetype && built.archetype.scaleModeId) || "major",
          source: "atlas_" + built.feeling.id,
        });
      });
    }
    const btnAtlasToDrums = $("btn-atlas-to-drums");
    if (btnAtlasToDrums) {
      btnAtlasToDrums.addEventListener("click", () => {
        const built = getAtlasBuilt();
        if (!built) return;
        handoffToDrums({
          rootPc: state.atlasKeyPc,
          chords: built.backingChords,
          progLabel: built.feeling.name + " · " + built.keyLabel,
          bpm: (built.archetype && built.archetype.bpm) || 96,
          enableBacking: true,
          source: "atlas_" + built.feeling.id,
        });
      });
    }
    const btnAtlasToScene = $("btn-atlas-to-scene");
    if (btnAtlasToScene) {
      btnAtlasToScene.addEventListener("click", () => {
        if (state.sceneIds.length < 6 && !state.sceneIds.includes(state.atlasFeelingId)) {
          state.sceneIds.push(state.atlasFeelingId);
        } else if (state.sceneIds.length < 6) {
          state.sceneIds.push(state.atlasFeelingId);
        }
        state.emotionSubTab = "scene";
        renderEmotionsTab();
      });
    }

    // Emotions sub-tabs & Harmony Calculators controls
    document.querySelectorAll("#emotions-subtabs .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subId = btn.dataset.esub;
        if (state.store && !state.store.isUnlocked(subId)) {
          openLockPrompt(subId, { kind: "esub", id: subId });
          return;
        }
        stopAllAudio();
        state.audio.setDrone(false);
        state.emotionSubTab = subId;
        renderEmotionsTab();
      });
    });

    $("btn-cof-play").addEventListener("click", playCofProgression);
    $("btn-cof-clear").addEventListener("click", () => {
      stopAllAudio();
      state.cofProgression = [];
      renderCofProgressionBar();
    });
    $("btn-cof-timbre").addEventListener("click", () => {
      const next = state.audio.timbre === "guitar" ? "piano" : "guitar";
      state.audio.setTimbre(next);
      state.store.updateProfile({ timbre: next });
      $("btn-cof-timbre").textContent = next === "piano" ? "Пианино" : "Гитара";
    });
    const btnCofToDrums = $("btn-cof-to-drums");
    if (btnCofToDrums) {
      btnCofToDrums.addEventListener("click", () => {
        if (!Harmony) return;
        let prog = state.cofProgression;
        if (!prog || !prog.length) {
          const pal = Harmony.getChordPalette(state.cofIndex, state.cofMode);
          prog = [pal.diatonic[0], pal.diatonic[4], pal.diatonic[5], pal.diatonic[3]].filter(Boolean);
        }
        const chords = Harmony.toBackingChords(prog);
        const keySpec = Harmony.CIRCLE_OF_FIFTHS[state.cofIndex] || Harmony.CIRCLE_OF_FIFTHS[0];
        const rootPc = state.cofMode === "minor" ? keySpec.minPc : keySpec.pc;
        const keyName = state.cofMode === "minor" ? keySpec.min : keySpec.maj;
        handoffToDrums({
          rootPc,
          chords,
          progLabel: "Палитра из Круга (" + keyName + ")",
          enableBacking: true,
          source: "circle",
        });
      });
    }

    document.querySelectorAll("#sphere-archetypes .btn-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!Harmony) return;
        const scaleData = Harmony.getScaleNotes(state.sphereRootPc, state.sphereModeId, 60);
        state.spherePhrase = Harmony.generateMelodicPhrase(scaleData, btn.dataset.arch);
        renderScaleSphere();
        playSpherePhrase();
      });
    });
    $("btn-sphere-play").addEventListener("click", playSpherePhrase);
    $("btn-sphere-undo").addEventListener("click", () => {
      if (state.spherePhrase.length > 1) state.spherePhrase.pop();
      renderScaleSphere();
    });
    $("btn-sphere-clear").addEventListener("click", () => {
      stopAllAudio();
      state.audio.setDrone(false);
      state.spherePhrase = [];
      renderScaleSphere();
    });

    // Guitar Freedom Lab (Anti-Em/Am Neck + 10 Techniques) controls
    $("btn-glab-antihabit").addEventListener("click", () => {
      if (!GuitarLab || !Harmony) return;
      const roots = GuitarLab.ANTI_HABIT_ROOTS.filter((r) => r !== state.glabRootPc);
      state.glabRootPc = roots[Math.floor(Math.random() * roots.length)];
      const modes = Harmony.SCALE_MODES;
      state.glabModeId = modes[Math.floor(Math.random() * modes.length)].id;
      state.glabZoneStart = 2 + Math.floor(Math.random() * 8);
      state.glabActiveMidi = null;
      renderGuitarLab();
      playGuitarLabSequence();
    });
    $("btn-glab-play").addEventListener("click", playGuitarLabSequence);
    document.querySelectorAll("#glab-layout-pills .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.glabLayout = btn.dataset.glayout;
        state.glabActiveMidi = null;
        renderGuitarLab();
      });
    });
    $("btn-glab-zone-down").addEventListener("click", () => {
      state.glabZoneStart = Math.max(0, state.glabZoneStart - 1);
      renderGuitarLab();
    });
    $("btn-glab-zone-up").addEventListener("click", () => {
      state.glabZoneStart = Math.min(11, state.glabZoneStart + 1);
      renderGuitarLab();
    });
    $("btn-gtech-play").addEventListener("click", () => {
      if (!GuitarLab) return;
      if (state.audio.isPlaying && state.activePlayer === "gtech") {
        stopAllAudio();
        return;
      }
      stopAllAudio();
      const tech = GuitarLab.GUITAR_TECHNIQUES.find((t) => t.id === state.glabTechId) || GuitarLab.GUITAR_TECHNIQUES[0];
      state.activePlayer = "gtech";
      updatePlayButtons();
      GuitarLab.playTechniqueDemo(state.audio, tech, state.glabRootPc, () => {
        if (state.activePlayer === "gtech") {
          state.activePlayer = null;
          updatePlayButtons();
        }
      });
    });

    // Emotions & Scene Builder controls
    document.querySelectorAll("#emotion-filters .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.emotionFilter = btn.dataset.efilter;
        renderEmotionsGrid();
      });
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.sceneIds = String(btn.dataset.preset || "").split(",").filter(Boolean).slice(0, 6);
        renderEmotionsTab();
      });
    });

    $("btn-spick-mech").addEventListener("click", () => {
      state.scenePickerMode = "mechanics";
      renderSceneBuilder();
    });
    $("btn-spick-feel").addEventListener("click", () => {
      state.scenePickerMode = "feelings";
      renderSceneBuilder();
    });

    document.querySelectorAll(".density-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.sceneDensity = btn.dataset.density;
        renderSceneBuilder();
      });
    });

    $("btn-scene-play").addEventListener("click", playCurrentScene);
    $("btn-scene-save").addEventListener("click", () => {
      if (state.sceneIds.length < 2) return;
      state.store.saveScene(state.sceneIds, state.sceneDensity, state.atlasKeyPc);
      $("btn-scene-save").textContent = "✓ Сохранено";
      setTimeout(() => { $("btn-scene-save").textContent = "Сохранить"; }, 1400);
    });
    $("btn-scene-clear").addEventListener("click", () => {
      stopAllAudio();
      state.sceneIds = [];
      renderEmotionsTab();
    });

    // Blind Ear Trainer controls
    document.querySelectorAll("#ear-mode-pills .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.earMode = btn.dataset.earmode;
        nextEarChallenge();
        renderEarTab();
      });
    });
    $("btn-ear-play").addEventListener("click", () => playEarTimeline(false));
    $("btn-ear-ref").addEventListener("click", () => playEarTimeline(true));
    $("btn-ear-next").addEventListener("click", nextEarChallenge);
    const btnEarOpenLesson = $("btn-ear-open-lesson");
    if (btnEarOpenLesson) {
      btnEarOpenLesson.addEventListener("click", () => {
        const ch = state.earChallenge;
        if (!ch) return;
        if (ch.sourceAtomId && state.atomsById.has(ch.sourceAtomId)) {
          openStudio("atom", ch.sourceAtomId, "ear");
        } else if (ch.sourceEmotionId && state.emotionsById.has(ch.sourceEmotionId)) {
          openStudio("emotion", ch.sourceEmotionId, "ear");
        }
      });
    }

    // Drum Groove Generator & Subdivision Metronome controls
    const toggleDrumsPlayback = () => {
      state.audio.unlock();
      ensureDrums();
      if (!state.drums) return;
      if (state.drums.isPlaying) {
        stopAllAudio();
        renderDrumsTab();
      } else {
        state.audio.stopPlayback();
        state.audio.setDrone(false);
        state.drums.start((info) => updateDrumLiveHighlight(info));
        updatePlayButtons();
      }
    };
    $("btn-drum-play").addEventListener("click", toggleDrumsPlayback);
    const btnDrumPlayMini = $("btn-drum-play-mini");
    if (btnDrumPlayMini) btnDrumPlayMini.addEventListener("click", toggleDrumsPlayback);
    const btnDrumClearCustom = $("btn-drum-clear-custom");
    if (btnDrumClearCustom) {
      btnDrumClearCustom.addEventListener("click", () => {
        ensureDrums();
        state.drums.clearCustomProgression();
        syncDrumBarsToProgression();
        renderDrumsTab();
      });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.drums && state.drums.isPlaying) {
        stopAllAudio();
        renderDrumsTab();
      }
    });

    $("btn-drum-improv").addEventListener("click", () => {
      ensureDrums();
      const meters = state.drums.bars.map((b) => b.meter);
      const fresh = Drums.improviseChain(meters, state.drumSub, state.drumStyle);
      state.drums.setBars(fresh);
      renderDrumsTab();
    });

    $("btn-drum-tap").addEventListener("click", () => {
      ensureDrums();
      const now = performance.now();
      state.drumTapTimes = state.drumTapTimes.filter((t) => now - t < 2600);
      state.drumTapTimes.push(now);
      state.drums.playVoice("click", 2);
      if (state.drumTapTimes.length >= 2) {
        let sum = 0;
        for (let i = 1; i < state.drumTapTimes.length; i++) {
          sum += state.drumTapTimes[i] - state.drumTapTimes[i - 1];
        }
        const avgMs = sum / (state.drumTapTimes.length - 1);
        state.drums.bpm = Theory.clamp(Math.round(60000 / avgMs), 48, 200);
        renderDrumsTab();
      }
    });

    const setDrumBpm = (val) => {
      ensureDrums();
      state.drums.bpm = Theory.clamp(Math.round(Number(val) || 104), 48, 200);
      $("drum-bpm-val").textContent = state.drums.bpm + " BPM";
      $("drum-bpm-slider").value = String(state.drums.bpm);
    };
    $("drum-bpm-slider").addEventListener("input", (ev) => setDrumBpm(ev.target.value));
    $("btn-drum-bpm-down").addEventListener("click", () => setDrumBpm((state.drums ? state.drums.bpm : 104) - 2));
    $("btn-drum-bpm-up").addEventListener("click", () => setDrumBpm((state.drums ? state.drums.bpm : 104) + 2));

    document.querySelectorAll("#drum-sub-pills .btn-pill").forEach((btn) => {
      btn.addEventListener("click", () => rebuildDrumBarsWithSub(btn.dataset.sub));
    });

    $("btn-drum-click").addEventListener("click", () => {
      ensureDrums();
      state.drums.metronomeOn = !state.drums.metronomeOn;
      renderDrumsTab();
    });
    $("btn-drum-metro-only").addEventListener("click", () => {
      ensureDrums();
      state.drums.metronomeOnly = !state.drums.metronomeOnly;
      renderDrumsTab();
    });
    $("btn-drum-autofill").addEventListener("click", () => {
      ensureDrums();
      state.drums.autoFill = !state.drums.autoFill;
      renderDrumsTab();
    });
    $("btn-drum-gap").addEventListener("click", () => {
      ensureDrums();
      state.drums.gapMode = !state.drums.gapMode;
      renderDrumsTab();
    });

    // Jam Backing Track (Analog Bass + Warm Pad / Soft Keys)
    $("btn-backing-bass").addEventListener("click", () => {
      ensureDrums();
      state.drums.backingBassOn = !state.drums.backingBassOn;
      renderDrumsTab();
      if (state.drums.backingBassOn && !state.drums.isPlaying) state.drums.previewBacking();
    });
    document.querySelectorAll(".backing-synth-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureDrums();
        state.drums.backingSynthMode = btn.dataset.bsynth;
        renderDrumsTab();
        if (state.drums.backingSynthMode !== "off" && !state.drums.isPlaying) state.drums.previewBacking();
      });
    });

    document.querySelectorAll("#drum-add-meters [data-addmeter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureDrums();
        if (state.drums.bars.length >= 4) return;
        const m = btn.dataset.addmeter;
        const newBar = Drums.buildBarPattern(m, state.drumSub, { style: state.drumStyle, isFirstBar: false });
        state.drums.bars.push(newBar);
        state.drums.setBars(state.drums.bars);
        state.drumEditBarIdx = state.drums.bars.length - 1;
        renderDrumsTab();
      });
    });
    const btnDrumDelBar = $("btn-drum-del-bar");
    if (btnDrumDelBar) {
      btnDrumDelBar.addEventListener("click", () => {
        ensureDrums();
        if (state.drums.bars.length <= 1) return;
        state.drums.bars.splice(state.drumEditBarIdx, 1);
        state.drumEditBarIdx = Math.max(0, state.drumEditBarIdx - 1);
        state.drums.setBars(state.drums.bars);
        renderDrumsTab();
      });
    }

    // Analog 120fps Tuner controls
    $("tuner-mode-guitar").addEventListener("click", () => {
      state.tunerMode = "guitar";
      renderTunerTab();
    });
    $("tuner-mode-voice").addEventListener("click", () => {
      state.tunerMode = "voice";
      renderTunerTab();
    });
    $("tuner-damp-slow").addEventListener("click", () => {
      state.store.updateProfile({ tunerDamping: "slow" });
      renderTunerTab();
    });
    $("tuner-damp-fast").addEventListener("click", () => {
      state.store.updateProfile({ tunerDamping: "fast" });
      renderTunerTab();
    });
    $("btn-tuner-mic").addEventListener("click", async () => {
      ensureTuner();
      if (!state.tuner) return;
      if (state.tuner.running) {
        state.tuner.stopMic();
        $("tuner-status").textContent = "Микрофон остановлен. Можно нажать любую струну ниже для эталонного тона.";
      } else {
        stopAllAudio();
        state.audio.setDrone(false);
        const res = await state.tuner.startMic();
        if (res.ok) {
          $("tuner-status").textContent = "Микрофон активен — сыграй открытую струну или спой ровную ноту.";
        } else {
          $("tuner-status").textContent = res.error;
        }
      }
    });

    // My Rhythm settings & L04
    $("pref-guitar").addEventListener("click", () => {
      state.store.updateProfile({ timbre: "guitar" });
      state.audio.setTimbre("guitar");
      renderRhythmTab();
    });
    $("pref-piano").addEventListener("click", () => {
      state.store.updateProfile({ timbre: "piano" });
      state.audio.setTimbre("piano");
      renderRhythmTab();
    });
    $("pref-drone").addEventListener("click", () => {
      const next = !state.store.profile.droneDefault;
      state.store.updateProfile({ droneDefault: next });
      renderRhythmTab();
    });
    const prefSandbox = $("pref-sandbox");
    if (prefSandbox) {
      prefSandbox.addEventListener("click", () => {
        const next = !state.store.profile.sandboxUnlocked;
        state.store.setSandboxUnlocked(next);
        updateHud();
        renderRhythmTab();
      });
    }
    $("btn-support-tribute").addEventListener("click", () => openTributeDonation("rhythm_card"));

    // NFS Progressive Unlock & Milestone Celebration Sheet wiring
    const btnUnlockGo = $("btn-unlock-go");
    if (btnUnlockGo) {
      btnUnlockGo.addEventListener("click", () => {
        const mode = state.unlockModalMode;
        const target = state.unlockModalTarget;
        if (mode === "lock") {
          state.store.setSandboxUnlocked(true);
          updateHud();
        }
        closeUnlockModal();
        if (target) {
          if (target.kind === "esub") {
            state.emotionSubTab = target.id;
            switchTab("emotions");
          } else if (target.kind === "tab") {
            switchTab(target.id);
          }
        }
      });
    }
    const btnUnlockClose = $("btn-unlock-close");
    if (btnUnlockClose) {
      btnUnlockClose.addEventListener("click", () => {
        const wasLock = state.unlockModalMode === "lock";
        closeUnlockModal();
        if (wasLock) {
          const next = getNextUncompletedAtom();
          openStudio("atom", (next && next.id) || "M001", "route");
        }
      });
    }
    const btnUnlockX = $("btn-unlock-x");
    if (btnUnlockX) btnUnlockX.addEventListener("click", closeUnlockModal);
    const unlockBackdrop = $("unlock-backdrop");
    if (unlockBackdrop) unlockBackdrop.addEventListener("click", closeUnlockModal);
    const btnUnlockTribute = $("btn-unlock-tribute");
    if (btnUnlockTribute) {
      btnUnlockTribute.addEventListener("click", () => openTributeDonation("milestone_unlock"));
    }

    // Interactive Spotlight Product Tour (Обучение)
    const btnStartTour = $("btn-start-tour");
    if (btnStartTour) btnStartTour.addEventListener("click", () => startTour(0));
    const btnOnboardingTour = $("btn-onboarding-tour");
    if (btnOnboardingTour) btnOnboardingTour.addEventListener("click", () => startTour(0));
    const btnTourPrev = $("btn-tour-prev");
    if (btnTourPrev) {
      btnTourPrev.addEventListener("click", () => {
        if (state.tourStepIdx > 0) {
          state.tourStepIdx -= 1;
          renderTourStep();
        }
      });
    }
    const btnTourNext = $("btn-tour-next");
    if (btnTourNext) {
      btnTourNext.addEventListener("click", () => {
        const steps = getTourSteps();
        if (state.tourStepIdx < steps.length - 1) {
          state.tourStepIdx += 1;
          renderTourStep();
        } else {
          closeTour(true, true);
        }
      });
    }
    const btnTourSkip = $("btn-tour-skip");
    if (btnTourSkip) btnTourSkip.addEventListener("click", () => closeTour(false, false));
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (state.unlockModalMode) closeUnlockModal();
        if (state.tourActive) closeTour(false, false);
      }
    });
    window.addEventListener("resize", () => {
      if (state.tourActive) positionTourSpotlight();
    });
    window.addEventListener("scroll", () => {
      if (state.tourActive) positionTourSpotlight();
    }, { passive: true });

    $("btn-export").addEventListener("click", () => {
      const text = JSON.stringify(state.store.exportSnapshot(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          $("btn-export").textContent = "✓ Скопировано";
          setTimeout(() => { $("btn-export").textContent = "Скопировать JSON"; }, 1400);
        }).catch(() => {});
      }
    });
    $("btn-reset").addEventListener("click", () => {
      if (!window.confirm("Сбросить локальный прогресс и статистику слуха?")) return;
      stopAllAudio();
      state.audio.setDrone(false);
      state.store.resetAll();
      state.audio.setTimbre("guitar");
      state.transpose = 0;
      state.capo = 0;
      state.audio.setTranspose(0);
      state.selectedActId = "A1";
      state.earChallenge = null;
      state.earAnswered = false;
      state.earChosenId = null;
      state.studioManualTuning = false;
      if (state.tuner) state.tuner.setTuning("standard_6");
      syncSessionContext({ rootPc: 0, modeId: "minor", circleMode: "major" });
      updateHud();
      renderRhythmTab();
    });
  }

  /* ========================= INTERACTIVE SPOTLIGHT TOUR (Гид · 6 разделов · 22 шага) ========================= */
  const TOUR_CHAPTERS = [
    { id: "route",    label: "1. Путь" },
    { id: "studio",   label: "2. Урок" },
    { id: "emotions", label: "3. Студия" },
    { id: "ear",      label: "4. Слух" },
    { id: "drums",    label: "5. Ударные" },
    { id: "tuner",    label: "6. Тюнер" },
  ];

  function openEmotionsSubForTour(subId) {
    state.emotionSubTab = subId;
    switchTab("emotions");
    renderEmotionsTab();
  }

  function ensureLesson1OpenForTour() {
    if (!state.studioItem || state.studioItem.id !== "M001" || $("view-studio").classList.contains("hidden")) {
      openStudio("atom", "M001", "route");
    }
  }

  function getTourSteps() {
    return [
      // === РАЗДЕЛ 1: ПУТЬ ===
      {
        id: "tabs",
        chapter: "route",
        selector: "#main-tabs",
        prepare: () => switchTab("route"),
        title: "Главное меню: открывается шаг за шагом",
        body: "Сверху 4 вкладки: «Путь» (уроки), «Студия» (чувства, аккорды, гриф), «Слух» (проверка ухом) и «Ударные» (ритм и джем). Тюнер-камертон всегда под рукой в правом верхнем углу.",
        link: "Новые зоны открываются по мере прохождения первых 3 уроков (или в 1 клик «Разблокировать всё сразу»), чтобы не перегружать экран на старте.",
      },
      {
        id: "acts",
        chapter: "route",
        selector: "#act-pills",
        prepare: () => {
          switchTab("route");
          const map = $("route-map-details");
          if (map) map.open = true;
        },
        title: "9 глав: от октавы до музыки мира",
        body: "Весь курс выстроен от простого к сложному (36 недель): от физики звука и пульса до аккордов, кино-музыки, джаза и этники.",
        link: "Все главы и недели по умолчанию свёрнуты, чтобы не отвлекать — раскрой «Все 36 недель» в любой момент, когда захочешь заглянуть вперёд.",
      },
      {
        id: "weeks",
        chapter: "route",
        selector: "#weeks-list .week-card",
        prepare: () => switchTab("route"),
        title: "Недели и уроки по 5 минут в день",
        body: "В каждой неделе 6 коротких шагов + День 7 для свободного джема. Открывай День 1 и пробуй на слух, без длинных учебников.",
        link: "Прошёл урок и отметил «Услышал» → система сама вернёт его в повторение через 1, 3 и 7 дней (метод Эббингауза), чтобы звук закрепился в памяти без зубрёжки.",
      },

      // === РАЗДЕЛ 2: СТУДИЯ УРОКА ===
      {
        id: "studio_simple",
        chapter: "studio",
        selector: "#studio-simple-box",
        prepare: () => {
          openStudio("atom", "M001", "route");
          const adv = $("studio-advanced-details");
          if (adv) adv.open = false;
        },
        title: "Объяснение простыми словами + словарь",
        body: "Вверху урока — суть за 2 простые фразы. Незнакомые слова («? Октава», «? Размер 4/4», «? Флажолет») вынесены чипами — жми на любой, сразу откроется расшифровка.",
        link: "Сначала понимаешь идею без сложных терминов → тогда на следующем шаге ухо точно знает, какую именно разницу слушать.",
      },
      {
        id: "studio_transport",
        chapter: "studio",
        selector: "#view-studio .transport-row",
        prepare: () => {
          ensureLesson1OpenForTour();
          const adv = $("studio-advanced-details");
          if (adv) adv.open = false;
        },
        title: "Кнопка «▶ Послушать», тембр и повтор",
        body: "Жми «▶ Послушать» — звук синтезируется вживую прямо в браузере. Рядом переключатель «Гитара / Пианино» и «⟳ Повтор» по кругу, чтобы спокойно подбирать руками.",
        link: "Нажал «▶ Послушать» → звучит живой пример, и те же ноты в ту же секунду загораются на клавишах и грифе ниже, чтобы глаза и уши запомнили их вместе.",
      },
      {
        id: "studio_triptych",
        chapter: "studio",
        selector: "#studio-triptych",
        prepare: () => {
          ensureLesson1OpenForTour();
          const adv = $("studio-advanced-details");
          if (adv) adv.open = false;
        },
        title: "Синхронные клавиши, гриф и нотный стан",
        body: "Нажимай прямо на любую клавишу пианино или лад гитары — они звучат и подписывают ноту. В 1-й неделе нотный стан скрыт, чтобы не пугать новичка — включить его можно кнопкой «+ Нотный стан».",
        link: "Клавиши, гриф и нотный стан показывают одну и ту же ноту в трёх проекциях: нажал клавишу на пианино → сразу видишь её точный лад на гитаре и место на нотном стане.",
      },
      {
        id: "studio_ab",
        chapter: "studio",
        selector: "#contrast-box",
        prepare: () => {
          ensureLesson1OpenForTour();
          const adv = $("studio-advanced-details");
          if (adv) adv.open = false;
        },
        title: "Сравнение A и B — как ухо учится само",
        body: "Нажми «A: Обычное звучание», затем «B: Как звучит в этом уроке». Мозг быстрее всего схватывает музыкальный смысл на контрасте «было → стало».",
        link: "Ухо плохо запоминает звук в отрыве, но мгновенно ловит сдвиг: жмёшь A, потом B → на триптихе выше цветом выделяется именно та нота, которая изменила настроение.",
      },
      {
        id: "studio_adv",
        chapter: "studio",
        selector: "#studio-advanced-details",
        prepare: () => {
          ensureLesson1OpenForTour();
          const adv = $("studio-advanced-details");
          if (adv) adv.open = true;
        },
        title: "Тонкие настройки: тональность, каподастр, строй",
        body: "По умолчанию шторка свёрнута, чтобы не перегружать новичков. Внутри: «Сдвиг высоты» (под твой голос), «Каподастр» (зажим на грифе), «Фон-нота», «Метроном», «Темп» и строй гитары (6 и 7 струн, включая Drop C).",
        link: "Подвинул «Сдвиг высоты», поставил «Каподастр» или сменил «Строй» → все ноты, звук, лады на грифе и подсказки пальцев внизу урока сразу пересчитались под твой инструмент.",
      },

      // === РАЗДЕЛ 3: ЧУВСТВА (ВСЕ 6 МАСТЕРСКИХ) ===
      {
        id: "emotions_subtabs",
        chapter: "emotions",
        selector: "#emotions-subtabs",
        prepare: () => {
          const adv = $("studio-advanced-details");
          if (adv) adv.open = false;
          openEmotionsSubForTour("atlas");
        },
        title: "Вкладка «Студия»: 6 мастерских сочинения",
        body: "Здесь 6 инструментов: «60 чувств», «Круг и аккорды», «Сфера и древо», «Гриф и техники», «Сцена» и «20 приёмов». Сейчас пройдём каждый по порядку.",
        link: "Это маршрут от замысла к песне: в «60 чувствах» находишь настроение → в 1 клик отправляешь его в «Круг» (аккорды), на «Гриф» или в «Ударные» для джема.",
      },
      {
        id: "atlas_search",
        chapter: "emotions",
        selector: "#esub-atlas .card",
        prepare: () => openEmotionsSubForTour("atlas"),
        title: "Атлас 60 чувств: от «Тепла» до смешанных",
        body: "Выбери любое из 60 чувств — базовое или сложное смешанное (например «Горько-сладкая радость» или «Светлая печаль»). Можно искать по слову или фильтровать по 6 семействам.",
        link: "Выбрал чувство здесь → карточка ниже сразу раскрывает его музыкальную формулу и позволяет в 1 клик отправить её в Круг, на Гриф, в Ударные или в Сцену.",
      },
      {
        id: "atlas_keys_shifts",
        chapter: "emotions",
        selector: "#esub-atlas .layer-feeling",
        prepare: () => openEmotionsSubForTour("atlas"),
        title: "12 тональностей, перекладки и 10 вариантов",
        body: "Переключай 12 тональностей, чтобы услышать разницу в регистре и удобстве на грифе. А ниже сдвигай 1 ноту для перехода в соседнее чувство и слушай 10 готовых вариантов.",
        link: "Сменил тональность здесь → она автоматически синхронизируется с Кругом, Сферой и Ударными. Нажал переход → сдвинулась 1 ступень, и настроение изменилось.",
      },
      {
        id: "circle_orbit",
        chapter: "emotions",
        selector: "#esub-circle .cof-svg-wrap",
        prepare: () => {
          openEmotionsSubForTour("circle");
          const orb = $("cof-orbit-details");
          if (orb) orb.open = true;
        },
        title: "Кварто-квинтовый круг + суб-круг 8 красок",
        body: "Коснись любой тональности на круге (мажор снаружи, минор внутри) — подсветится семья из 6 родных аккордов. Сразу под кругом можно раскрыть суб-круг 8 мелодических красок (maj7, add9, sus2, #11 и др.).",
        link: "Нажал тональность на круге → подсветились её 6 родных аккордов и 8 красок. Нажал любой аккорд или лепесток → он сразу улетел в Палитру и открылся на грифе ниже.",
      },
      {
        id: "circle_fretboard",
        chapter: "emotions",
        selector: "#cof-fretboard-box",
        prepare: () => {
          const orb = $("cof-orbit-details");
          if (orb) orb.open = false;
          openEmotionsSubForTour("circle");
          if (Harmony && !state.cofPreviewChord) {
            const pal = Harmony.getChordPalette(state.cofIndex, state.cofMode);
            if (pal && pal.diatonic && pal.diatonic.length) {
              state.cofPreviewChord = pal.diatonic[0];
              renderCircleOfFifths();
            }
          }
        },
        title: "Палитра аккордов + живая аппликатура на грифе",
        body: "Выше можно выбрать один из 12 готовых наборов аккордов или собрать свой, нажать «▶ Сыграть палитру» или отправить её кнопкой «🥁 Джемовать эту палитру в Ударных». Здесь показывается реальная удобная постановка пальцев.",
        link: "Нажал «▶ Сыграть палитру» → пока звучит цепочка аккордов, гриф под ней сам перелистывает аппликатуры в такт музыке. А кнопка джема переносит эти же аккорды прямо в «Ударные».",
      },
      {
        id: "sphere_tree",
        chapter: "emotions",
        selector: "#esub-sphere .card",
        prepare: () => openEmotionsSubForTour("sphere"),
        title: "Сфера гаммы и древо мелодических фраз",
        body: "Представь гамму как сферу, а мелодию — как путь по веткам дерева. Выбери тонику и лад, нажми один из 4 подходов к фразе или сам добавляй шаги («Шаг вверх», «Скачок», «Домой», «Пауза»).",
        link: "Добавил шаг на ветке дерева → внутри сферы прорастает линия мелодии, а внизу она сразу раскладывается на конкретные струны и лады гитары.",
      },
      {
        id: "guitar_lab",
        chapter: "emotions",
        selector: "#esub-guitar .card",
        prepare: () => openEmotionsSubForTour("guitar"),
        title: "Гриф (выход из клетки Em/Am) и 10 техник",
        body: "Чтобы пальцы не залипали в привычных Em/Am, включай «Зону 4 ладов», «1 струну», «3 ноты на струну» или жми «🎲 Другой ключ». Ниже — 10 гитарных техник (легато, бенд, свинг, тэппинг, свип, флажолеты) со звуком и табами.",
        link: "Сменил режим карты, тонику или строй гитары → вся сетка ладов и табулатура 10 техник ниже перестраиваются под новую аппликатуру.",
      },
      {
        id: "scene_builder",
        chapter: "emotions",
        selector: "#esub-scene .scene-card",
        prepare: () => openEmotionsSubForTour("scene"),
        title: "Конструктор «Сцена»: склейка чувств в сюжет",
        body: "Выбери готовый кино-сюжет или собери цепочку от 2 до 6 блоков кнопкой «+» из списка ниже (доступны и «20 механик», и все «60 чувств»). Задай плотность (Соло / Акустика / Полный грув) и жми «▶ Сыграть сцену».",
        link: "Нажал «+» у любого чувства или механики в списке ниже → блок встал в цепочку, и при проигрывании все блоки склеиваются в единую партию на живом триптихе.",
      },

      // === РАЗДЕЛ 4: СЛУХ ===
      {
        id: "ear_trainer",
        chapter: "ear",
        selector: "#view-ear .card",
        prepare: () => switchTab("ear"),
        title: "Слепой тренажёр слуха (4 режима)",
        body: "Угадывай на слух Интервалы, Сдвиг A↔B, Лад и чувство или Размер и грув. Нотный стан и подсказки скрыты до ответа, чтобы работало именно ухо.",
        link: "Тренажёр берёт те же интервалы, лады и ритмы, что изучаются в «Пути», но прячет ноты до ответа — чтобы проверить, слышишь ли ты их сам, без зрительной подсказки.",
      },

      // === РАЗДЕЛ 5: УДАРНЫЕ И ДЖЕМ ===
      {
        id: "drums_hero",
        chapter: "drums",
        selector: "#view-drums .drum-hero-card",
        prepare: () => switchTab("drums"),
        title: "Ударные, темп BPM и кратность до 1/32",
        body: "Запускай «▶ Старт», настучи свой темп через «Tap BPM», жми «🎲 Грув» для случайного ритма или включай «Тихий такт» для тренировки внутреннего пульса. Кратность меняется от 1/4 до 1/32.",
        link: "Переключил кратность (1/4 → 1/32) → в нижней сетке тактов сразу меняется число шагов (от 4 до 32), а темп BPM синхронно ускоряет и барабаны, и бас с синтом.",
      },
      {
        id: "drums_backing",
        chapter: "drums",
        selector: "#view-drums .scene-card",
        prepare: () => {
          switchTab("drums");
          ensureDrums();
          if (state.drums && state.drums.bars.length < 2) {
            syncDrumBarsToProgression();
            renderDrumsTab();
          }
        },
        title: "Джем-сопровождение: аналоговый бас + синт",
        body: "Включай «Бас» и мягкий синт («Тёплый пэд» или «Мягкие клавиши»), выбирай любую из 12 тональностей и гармонический квадрат — получается живой минус для игры на гитаре.",
        link: "Выбрал гармонический квадрат (например, из 4 аккордов) → ниже автоматически создаются 4 такта по 1 аккорду на такт, а аналоговый бас привязывается к ударам бочки.",
      },
      {
        id: "drums_grid",
        chapter: "drums",
        selector: "#drum-grid-scroll",
        prepare: () => switchTab("drums"),
        title: "Связки размеров и живая сетка тактов",
        body: "Сверху можно склеивать размеры (4/4 + 3/4 + 7/8), а здесь кликать по ячейкам: 1 тап = удар, 2-й тап = акцент. Верхняя золотая строка показывает аккорд такта (жми на него слева, чтобы услышать).",
        link: "Нажал на такт в связке («1. 4/4 · Cm», «2. 4/4 · Ab») → сетка и её строка аккорда перестроились на этот такт. Во время игры сетка сама шагает за текущим тактом.",
      },

      // === РАЗДЕЛ 6: ТЮНЕР И ФИНАЛ ===
      {
        id: "tuner_rhythm",
        chapter: "tuner",
        selector: "#view-tuner .tuner-card",
        prepare: () => switchTab("tuner"),
        title: "Тюнер 120fps для гитары и голоса",
        body: "Переключай «Гитара / Голос», включай микрофон — плавная аналоговая стрелка точно ловит даже 7-ю струну A1 (55 Гц). Ниже можно нажать на любую струну, чтобы настроиться на слух.",
        link: "Выбрал строй гитары здесь или в «Моём ритме» (счётчик «⚙ 0 / 216» сверху) → тюнер настраивает ровно эти 6 или 7 струн, и этот же строй подставляется во все уроки и карты грифа.",
      },
      {
        id: "finale",
        chapter: "tuner",
        selector: null,
        prepare: () => switchTab("route"),
        title: "Теперь ты знаешь всю студию! 🎵",
        body: "Начни с Урока 1 (5 минут), открывай зоны по шагам или включи Свободный режим. Вернуться к гиду можно в любой момент в «⚙ Мой ритм».",
        link: null,
      },
    ];
  }

  function startTour(stepIdx) {
    stopAllAudio();
    state.tourActive = true;
    state.tourStepIdx = Math.max(0, Math.min(getTourSteps().length - 1, stepIdx || 0));
    $("tour-overlay").classList.remove("hidden");
    renderTourStep();
  }

  function closeTour(completed, openFirstLesson) {
    state.tourActive = false;
    $("tour-overlay").classList.add("hidden");
    const adv = $("studio-advanced-details");
    if (adv) adv.open = false;
    const more = $("studio-more-details");
    if (more) more.open = false;
    const map = $("route-map-details");
    if (map) map.open = false;
    const orb = $("cof-orbit-details");
    if (orb) orb.open = false;
    if (state.store && typeof state.store.markTourDone === "function") {
      state.store.markTourDone(!!completed);
    }
    if (openFirstLesson) {
      openStudio("atom", "M001", "route");
    }
  }

  function positionTourSpotlight() {
    if (!state.tourActive) return;
    const steps = getTourSteps();
    const step = steps[state.tourStepIdx];
    const spot = $("tour-spotlight");
    const backdrop = $("tour-backdrop");
    const card = $("tour-card");
    if (!step || !spot || !backdrop || !card) return;

    const el = step.selector ? document.querySelector(step.selector) : null;
    if (!el) {
      spot.classList.add("hidden");
      backdrop.classList.remove("spotlight-active");
      card.classList.remove("pos-top", "pos-bottom");
      card.classList.add("pos-center");
      return;
    }

    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      spot.classList.add("hidden");
      backdrop.classList.remove("spotlight-active");
      card.classList.remove("pos-top", "pos-bottom");
      card.classList.add("pos-center");
      return;
    }

    const pad = 6;
    const vw = window.innerWidth || 390;
    const vh = window.innerHeight || 844;
    const left = Math.max(4, r.left - pad);
    const width = Math.min(vw - 8, r.width + pad * 2);
    const maxSpotH = Math.round(vh * 0.40);
    const clampedH = Math.min(r.height + pad * 2, maxSpotH);
    const top = Math.max(6, Math.min(vh - clampedH - 6, r.top - pad));

    spot.style.left = left + "px";
    spot.style.top = top + "px";
    spot.style.width = width + "px";
    spot.style.height = clampedH + "px";
    spot.classList.remove("hidden");
    backdrop.classList.add("spotlight-active");

    const spotCenterY = top + clampedH / 2;
    card.classList.remove("pos-center", "pos-top", "pos-bottom");
    if (spotCenterY < vh * 0.48) {
      card.classList.add("pos-bottom");
    } else {
      card.classList.add("pos-top");
    }
  }

  function renderTourStep() {
    const steps = getTourSteps();
    const idx = Math.max(0, Math.min(steps.length - 1, state.tourStepIdx));
    state.tourStepIdx = idx;
    const step = steps[idx];
    if (!step) return;

    if (typeof step.prepare === "function") step.prepare();

    $("tour-step-badge").textContent = "Шаг " + (idx + 1) + " из " + steps.length;
    $("tour-progress-fill").style.width = Math.round(((idx + 1) / steps.length) * 100) + "%";
    $("tour-title").textContent = step.title;
    $("tour-body").textContent = step.body;

    // Render clickable 6-chapter jump bar inside the tour card
    const chapWrap = $("tour-chapters");
    if (chapWrap) {
      chapWrap.textContent = "";
      TOUR_CHAPTERS.forEach((ch) => {
        const firstIdx = steps.findIndex((s) => s.chapter === ch.id);
        const btn = h("button", "tour-chap-pill" + (step.chapter === ch.id ? " active" : ""), ch.label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          if (firstIdx >= 0) {
            state.tourStepIdx = firstIdx;
            renderTourStep();
          }
        });
        chapWrap.appendChild(btn);
      });
      const activePill = chapWrap.querySelector(".tour-chap-pill.active");
      if (activePill && typeof activePill.scrollIntoView === "function") {
        try { activePill.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" }); } catch (_) {}
      }
    }

    // Causal connection box ("🔗 Как связано")
    const linkBox = $("tour-link-box");
    const linkText = $("tour-link-text");
    if (linkBox && linkText) {
      if (step.link) {
        linkText.textContent = step.link;
        linkBox.classList.remove("hidden");
      } else {
        linkBox.classList.add("hidden");
      }
    }

    const tBox = $("tour-tribute-box");
    if (tBox) tBox.classList.toggle("hidden", !step.showTribute);

    const btnPrev = $("btn-tour-prev");
    btnPrev.disabled = idx === 0;
    btnPrev.style.visibility = idx === 0 ? "hidden" : "visible";

    const btnNext = $("btn-tour-next");
    btnNext.textContent = idx === steps.length - 1 ? "▶ Начать Урок 1" : "Далее →";

    const el = step.selector ? document.querySelector(step.selector) : null;
    if (el && typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ behavior: "instant", block: "start" });
        const rect = el.getBoundingClientRect();
        if (rect.top < 16) window.scrollBy(0, rect.top - 16);
      } catch (_) {
        el.scrollIntoView(true);
      }
    }
    requestAnimationFrame(() => {
      positionTourSpotlight();
      setTimeout(positionTourSpotlight, 90);
    });
  }

  async function boot() {
    initTelegramThemeLock();
    state.store = new Storage.MusicStore();
    await state.store.init();
    state.selectedActId = state.store.profile.lastActId || "A1";
    state.audio.setTimbre(state.store.profile.timbre || "guitar");
    if (typeof state.store.profile.sessionRootPc === "number") {
      syncSessionContext({
        rootPc: state.store.profile.sessionRootPc,
        modeId: state.store.profile.sessionModeId,
        keepGuitarRoot: false,
      });
    }

    bindEvents();

    try {
      const resp = await fetch(CATALOG_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const cat = await resp.json();
      state.catalog = cat;
      (cat.atoms || []).forEach((a) => state.atomsById.set(a.id, a));
      (cat.emotion_mechanics || []).forEach((e) => state.emotionsById.set(e.id, e));
      (cat.weeks || []).forEach((w) => state.weeksByNum.set(w.week, w));
      (cat.acts || []).forEach((a) => state.actsById.set(a.id, a));

      updateHud();
      switchTab("route");
    } catch (err) {
      $("view-loading").textContent = "Не удалось загрузить каталог музыки (" + String(err.message || err) + "). Обнови страницу.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
