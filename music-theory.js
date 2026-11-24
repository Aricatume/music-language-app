/* Music Theory, Guitar Fretboard, Staff Geometry, Scene Builder & Ear Trainer
 * Pure deterministic UMD module (runs in browser & Node.js unit tests).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MusicTheory = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NOTE_EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const NOTE_EN_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const NOTE_RU = ["До", "До#", "Ре", "Ре#", "Ми", "Фа", "Фа#", "Соль", "Соль#", "Ля", "Ля#", "Си"];
  const NOTE_RU_FLAT = ["До", "Ре♭", "Ре", "Ми♭", "Ми", "Фа", "Соль♭", "Соль", "Ля♭", "Ля", "Си♭", "Си"];
  const DEGREE_LABELS = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"];

  // Diatonic step inside octave [0..6] and accidental flag for each pitch class 0..11
  const DIATONIC_MAP = [
    { d: 0, acc: "" },  // C
    { d: 0, acc: "#" }, // C#
    { d: 1, acc: "" },  // D
    { d: 1, acc: "#" }, // D#
    { d: 2, acc: "" },  // E
    { d: 3, acc: "" },  // F
    { d: 3, acc: "#" }, // F#
    { d: 4, acc: "" },  // G
    { d: 4, acc: "#" }, // G#
    { d: 5, acc: "" },  // A
    { d: 5, acc: "#" }, // A#
    { d: 6, acc: "" },  // B
  ];

  // String 1 (thin high string) down to lowest/thickest string
  const GUITAR_TUNINGS = {
    standard_6: {
      id: "standard_6",
      strings: 6,
      short: "6 стр · Std E",
      name: "6 струн · Standard E (E–A–D–G–B–E)",
      lowToHighLabel: "E–A–D–G–B–E",
      midis: [64, 59, 55, 50, 45, 40],
    },
    drop_d_6: {
      id: "drop_d_6",
      strings: 6,
      short: "6 стр · Drop D",
      name: "6 струн · Drop D (D–A–D–G–B–E)",
      lowToHighLabel: "D–A–D–G–B–E",
      midis: [64, 59, 55, 50, 45, 38],
    },
    drop_c_6: {
      id: "drop_c_6",
      strings: 6,
      short: "6 стр · D Drop C",
      name: "6 струн · D Drop C (C–G–C–F–A–D)",
      lowToHighLabel: "C–G–C–F–A–D",
      midis: [62, 57, 53, 48, 43, 36],
    },
    drop_c_7_a: {
      id: "drop_c_7_a",
      strings: 7,
      short: "7 стр · Drop C + A",
      name: "7 струн · Drop C + 7-я в A (A–C–G–C–F–A–D)",
      lowToHighLabel: "A–C–G–C–F–A–D",
      midis: [62, 57, 53, 48, 43, 36, 33],
    },
    drop_a_7: {
      id: "drop_a_7",
      strings: 7,
      short: "7 стр · Drop A",
      name: "7 струн · Drop A (A–E–A–D–G–B–E)",
      lowToHighLabel: "A–E–A–D–G–B–E",
      midis: [64, 59, 55, 50, 45, 40, 33],
    },
  };
  const GUITAR_TUNING_ORDER = ["standard_6", "drop_d_6", "drop_c_6", "drop_c_7_a", "drop_a_7"];
  const GUITAR_STANDARD = GUITAR_TUNINGS.standard_6.midis;
  const GUITAR_DROP_D = GUITAR_TUNINGS.drop_d_6.midis;

  const INTERVAL_CATALOG = [
    { semi: 1, short: "м2", name: "Малая секунда (1 полутон)", feel: "Острое напряжение, тревога, вкрадчивость" },
    { semi: 2, short: "б2", name: "Большая секунда (2 полутона)", feel: "Естественный шаг, открытое начало фразы" },
    { semi: 3, short: "м3", name: "Малая терция (3 полутона)", feel: "Тёплая грусть, глубина, минорное ядро" },
    { semi: 4, short: "б3", name: "Большая терция (4 полутона)", feel: "Свет, ясность, открытое мажорное ядро" },
    { semi: 5, short: "ч4", name: "Чистая кварта (5 полутонов)", feel: "Призыв, решительность, опора шага вверх" },
    { semi: 6, short: "тритон", name: "Тритон (#4 / b5)", feel: "Невесомость, тайна или резкий контраст" },
    { semi: 7, short: "ч5", name: "Чистая квинта (7 полутонов)", feel: "Простор, мощь, чистая акустическая опора" },
    { semi: 8, short: "м6", name: "Малая секста (8 полутонов)", feel: "Ностальгия, драматический порыв, тоска" },
    { semi: 9, short: "б6", name: "Большая секста (9 полутонов)", feel: "Светлая нежность, тёплый лирический взлёт" },
    { semi: 10, short: "м7", name: "Малая септима (10 полутонов)", feel: "Блюзовый/грувовый характер, мягкий вопрос" },
    { semi: 11, short: "б7", name: "Большая септима (11 полутонов)", feel: "Хрупкая мечтательность, сияние кино-кадра" },
    { semi: 12, short: "ч8", name: "Октава (12 полутонов)", feel: "Полное слияние 2:1, вертикальный простор" },
  ];

  const EMOTION_META = {
    curiosity:    { label: "Любопытство", accent: "#60a5fa", soft: "rgba(96,165,250,0.16)" },
    calm:         { label: "Покой",       accent: "#5fd4c7", soft: "rgba(95,212,199,0.16)" },
    warmth:       { label: "Тепло",       accent: "#f5b963", soft: "rgba(245,185,99,0.16)" },
    wonder:       { label: "Чудо",        accent: "#a78bfa", soft: "rgba(167,139,250,0.18)" },
    joy:          { label: "Радость",     accent: "#fbbf24", soft: "rgba(251,191,36,0.16)" },
    drive:        { label: "Драйв",       accent: "#fb7185", soft: "rgba(251,113,133,0.18)" },
    power:        { label: "Мощь",        accent: "#f97316", soft: "rgba(249,115,22,0.18)" },
    anticipation: { label: "Ожидание",    accent: "#38bdf8", soft: "rgba(56,189,248,0.16)" },
    tension:      { label: "Напряжение",  accent: "#f43f5e", soft: "rgba(244,63,94,0.18)" },
    melancholy:   { label: "Глубина",     accent: "#818cf8", soft: "rgba(129,140,248,0.18)" },
  };

  const LENS_NAMES_RU = {
    MU01: "Слух и акустика",
    MU02: "Ноты и лады",
    MU03: "Гармония и краски",
    MU04: "Ритм и дыхание",
    MU05: "Инструмент и руки",
    MU06: "Чувства и сюжет",
  };

  const DEGREE_FEELINGS = [
    { deg: "1",  role: "Тоника · дом",       feel: "точка покоя и притяжения, куда всё стремится вернуться" },
    { deg: "b2", role: "Низкая 2-я",         feel: "острое напряжение, фригийская или восточная глубина" },
    { deg: "2",  role: "Большая 2-я",        feel: "естественный шаг вперёд, воздух и начало движения" },
    { deg: "b3", role: "Малая 3-я",          feel: "минорное сердце — мягкая тень, нежность и задумчивость" },
    { deg: "3",  role: "Большая 3-я",        feel: "мажорный свет — открытость, ясность и тепло" },
    { deg: "4",  role: "Чистая 4-я",         feel: "мягкий вопрос и порыв, ищущий разрешения в 3-ю" },
    { deg: "#4", role: "Высокая 4-я (#4)",   feel: "лидийская невесомость, чудо и снятие тяжести" },
    { deg: "5",  role: "Чистая 5-я",         feel: "чистый простор, широта горизонта и устойчивая опора" },
    { deg: "b6", role: "Малая 6-я",          feel: "щемящая ностальгия, тяготение вниз к 5-й ступени" },
    { deg: "6",  role: "Большая 6-я",        feel: "светлый лирический взлёт, тёплая надежда в мелодии" },
    { deg: "b7", role: "Малая 7-я",          feel: "свободный грув, народная естественность и мягкая открытость" },
    { deg: "7",  role: "Большая 7-я",        feel: "хрупкое сияние на самом пороге тоники, сильное притяжение домой" },
  ];

  const METER_FEELINGS = {
    "4/4":  "Ровный четырёхдольный шаг (1–2–3–4) — естественное дыхание речи и сердца.",
    "3/4":  "Вальсовое качание (РАЗ–два–три) — мягкий круговой полёт без резких углов.",
    "6/8":  "Две широкие триольные волны (1-2-3 · 4-5-6) — колыбельный или балладный размах.",
    "5/4":  "Несимметричный шаг 3+2 — интрига, лёгкое зависание и киношная загадка.",
    "7/8":  "Живой неровный пульс 2+2+3 — танцевальный толчок, который не даёт стоять на месте.",
    "9/8":  "Балканский аксак 2+2+2+3 — упругий танец с удлинённым подбросом в конце такта.",
    "12/8": "Глубокая цикличная волна 4×3 — основа блюза и западноафриканского колокольного грува.",
  };

  /* Kid-friendly (5–14) & plain-adult (25–45), zero-jargon musical glossary */
  const GLOSSARY_SIMPLE = [
    {
      id: "octave",
      term: "Октава",
      match: /октав|2:1|\b110\b|\b220\b|\b440\b|удвоен/i,
      plain: "Когда одна и та же нота звучит «этажом выше» или «этажом ниже» — как будто папа и ребёнок поют одну и ту же мелодию. Звук дрожит ровно в 2 раза быстрее, поэтому ухо слышит их как одну семью (Ля и Ля).",
    },
    {
      id: "overtone",
      term: "Обертоны",
      match: /обертон/i,
      plain: "Тихие «призвуки-эхо» внутри одного звука. Когда ты дёргаешь одну струну, внутри неё незаметно звучит целый маленький хор более высоких нот — именно они делают звук живым и объёмным.",
    },
    {
      id: "timbre",
      term: "Тембр",
      match: /тембр|у грифа|у бриджа|щипк/i,
      plain: "«Голос» и окраска звука. Гитара, пианино и флейта могут сыграть одну и ту же ноту одинаковой громкости, но ты сразу отличишь их с закрытыми глазами — это и есть тембр.",
    },
    {
      id: "consonance",
      term: "Консонанс и биения",
      match: /консонанс|диссонанс|биени/i,
      plain: "Консонанс — когда две ноты «дружат» и сливаются спокойно, без дрожания. Биения (диссонанс) — когда ноты слишком близко и слегка «трутся», создавая напряжение и ожидание.",
    },
    {
      id: "semitone",
      term: "Полутон",
      match: /(?:мал|больш|увелич)[а-яё]*\s+секунд|полутон|хромат|[A-G][#♯♭]/i,
      plain: "Самый маленький шаг в музыке: на гитаре — это просто соседний лад (+1 лад), на пианино — ближайшая соседняя клавиша (даже если она чёрная).",
    },
    {
      id: "meter44",
      term: "Размер 4/4",
      match: /\b4\/4\b/,
      plain: "Означает, что музыка шагает ровными четвёрками: РАЗ–два–три–четыре. Как спокойная ходьба или ровное биение сердца.",
    },
    {
      id: "meter",
      term: "Размер и доля",
      match: /\b(?:3\/4|5\/4|6\/8|7\/8|9\/8|12\/8)\b|размер|сильн[а-яё]*\s+дол|пульс/i,
      plain: "Как музыка считает шаги в такте: на «РАЗ–два–три» (вальс 3/4), на четвёрки (4/4) или неровными шагами (5/4, 7/8). Первая доля — самая тяжёлая, как опора ноги при шаге.",
    },
    {
      id: "harmonic",
      term: "Флажолет",
      match: /флажолет/i,
      plain: "Нежный «колокольчик» на гитаре: ты НЕ прижимаешь струну к дереву, а лишь еле касаешься её пальцем прямо над 12-м ладом и щипаешь. Струна начинает звенеть ровно вдвое выше.",
    },
    {
      id: "staff",
      term: "Нотный стан",
      match: /нотн|стан|скрипичн|басов[а-яё]*\s+ключ/i,
      plain: "Обычная лесенка из 5 линеек: чем выше на ней кружок — тем тоньше звук; чем ниже — тем звук глубже. Читается слева направо, как обычная строчка книги.",
    },
    {
      id: "tonic",
      term: "Тоника (дом)",
      match: /тоник|устой|разрешен/i,
      plain: "Главная нота-«дом» в песне. Когда мелодия приходит на неё, появляется чувство точки, покоя и завершения.",
    },
    {
      id: "interval",
      term: "Интервал",
      match: /интервал|терци|квинт|кварт|секст|септим|тритон/i,
      plain: "Просто расстояние между двумя нотами. Близкие ноты дают напряжение или мягкий шаг, далёкие — простор и полёт.",
    },
    {
      id: "chord",
      term: "Аккорд",
      match: /аккорд|трезвуч|септаккорд|мажор|минор/i,
      plain: "Когда одновременно звучат 3 и более ноты. Одиночная нота — это один цвет, а аккорд — сразу целое настроение и атмосфера.",
    },
    {
      id: "mode",
      term: "Лад (гамма)",
      match: /лад|гамм|пентатон|лидийск|дорийск|фригийск|хиджаз|макам/i,
      plain: "Набор «дружественных» нот, из которых складывается мелодия. Меняешь всего одну ноту в этом наборе — и грусть превращается в свет или сказку.",
    },
    {
      id: "capo",
      term: "Тональность и каподастр",
      match: /тональн|транспон|каподастр/i,
      plain: "Тональность — это общая высота песни (удобно подстроить под свой голос). Каподастр — зажим на гриф гитары, который сдвигает все ноты выше без смены привычных аккордов.",
    },
    {
      id: "drone",
      term: "Фон-нота (бурдон)",
      match: /бурдон|дрон|фон-нот/i,
      plain: "Одна тихая долгая нота на фоне (как гул волынки или органа). Поверх неё сразу слышно, какое настроение рождает каждая новая нота.",
    },
    {
      id: "syncopation",
      term: "Синкопа",
      match: /синкоп|грув|свинг/i,
      plain: "Неожиданный акцент чуть раньше или чуть позже главного шага — именно из-за него тело начинает непроизвольно качаться в такт.",
    },
  ];

  /* Plain, warm, 1-to-1 catalog-aligned rewrites for Week 1–2 (M001–M008) & Emotion Mechanics (E01–E20) */
  const SIMPLE_LESSONS = {
    M001: {
      title: "Что такое октава: одна нота на разных этажах",
      simpleSummary: "Представь, что папа и ребёнок поют одну и ту же мелодию. Голоса разные по высоте, но нота одна — просто у ребёнка звук дрожит вдвое быстрее. Так в музыке рождается октава.",
      simpleTry: "Нажми «▶ Послушать» — ты услышишь три ноты Ля (низкую, среднюю и высокую). Они не спорят, а сливаются, как три этажа одного дома. Потом сам коснись подсвеченных точек на клавишах или гитаре.",
      simpleSecret: "Каждые 12 шагов звук повторяет сам себя вдвое выше. Выучил 12 клавиш — знаешь весь инструмент!",
      hideStaffByDefault: true,
    },
    M002: {
      title: "Хор внутри одной струны (Обертоны и флажолеты)",
      simpleSummary: "Когда дёргаешь одну открытую струну Ми, она звучит не одной точкой — внутри неё прячется целый тихий хор высоких нот (обертонов), которые сами складываются в светлый мажорный аккорд.",
      simpleTry: "Нажми «▶ Послушать» — услышишь, как из одной басовой Ми вырастают 4 её родных призвука (Ми → Си → Ми → Соль#). На гитаре их можно достать лёгким касанием над 12-м, 7-м и 5-м ладом (флажолет).",
      simpleSecret: "Мажорный аккорд не придумали в учебниках — он физически уже звучит внутри каждой струны и каждого голоса.",
      hideStaffByDefault: true,
    },
    M003: {
      title: "Почему одни ноты «дружат», а другие «спорят»",
      simpleSummary: "Когда две ноты хорошо совпадают волнами (как квинта До–Соль), ухо чувствует покой и простор. Когда они стоят вплотную (До–До#) — появляется лёгкое дрожащее трение (биения).",
      simpleTry: "Попереключай кнопки A и B ниже: сначала услышишь мягкое слияние, потом — острое трение. Оба нужны музыке, как свет и тень в кино!",
      simpleSecret: "Напряжение — это не ошибка, а энергия и вопрос, после которого особенно приятно вернуться в покой.",
      hideStaffByDefault: true,
    },
    M004: {
      title: "Тембр: одна нота — пять разных характеров",
      simpleSummary: "Одна и та же нота Ми может звучать тепло и мягко, как колыбельная, или ярко и звонко, как сталь — всё зависит от инструмента и того, где именно ты касаешься струны.",
      simpleTry: "Нажми «▶ Послушать» (прозвучат три одинаковые ноты Ми), потом нажми кнопку «Гитара», чтобы переключить звук на «Пианино». Если под рукой живая гитара — щипни струну сначала над грифом (мягко), а потом у самого бриджа (ярко).",
      simpleSecret: "Характер и эмоция звука рождаются уже на первой ноте — ещё до того, как ты сыграл мелодию.",
      hideStaffByDefault: true,
    },
    M005: {
      title: "Ожидание и выдох: почему последний шаг радует",
      simpleSummary: "Когда мелодия доходит до предпоследней ступени (Си) и на секунду замирает, внутри появляется лёгкое «ну же, договори!». А шаг в родную ноту До мгновенно приносит ощущение точки и облегчения.",
      simpleTry: "Попереключай кнопки A и B ниже: в одном варианте мелодия зависает на вопросе, в другом — делает последний шаг домой. Почувствуй эту разницу телом.",
      simpleSecret: "Секрет цепляющей мелодии — не количество нот, а игра «зависли на вопросе → мягко отпустили домой».",
      hideStaffByDefault: true,
    },
    M006: {
      title: "Три слоя любой песни: Бас · Голос · Воздух",
      simpleSummary: "Почти любая музыка устроена как слоёный торт: внизу держит фундамент (бас), посередине рассказывает историю (мелодия), а вокруг создаёт атмосферу фон (аккорды и воздух).",
      simpleTry: "Нажми «▶ Послушать» и попробуй по очереди удержать внимание только на самой низкой ноте (До внизу), затем на верхней мелодии, затем на всём аккорде целиком.",
      simpleSecret: "Как только ухо научилось разделять 3 слоя, ты начинаешь слышать любую любимую песню насквозь.",
      hideStaffByDefault: true,
    },
    M007: {
      title: "Внутренний пульс: шаги времени в теле",
      simpleSummary: "Пульс — это ровное «тик-так» внутри тебя, как спокойные шаги или биение сердца. Ноты могут быть быстрыми или редкими, но невидимая сетка пульса идёт ровно.",
      simpleTry: "Включи «▶ Послушать» и просто покачивай головой или постукивай ногой в такт. Попробуй не ускоряться, когда всё даётся легко.",
      simpleSecret: "Ровный пульс делает даже простую мелодию из 3 нот по-настоящему музыкальной.",
      hideStaffByDefault: true,
    },
    M008: {
      title: "Сильная и слабая доля: как дышит такт 4/4",
      simpleSummary: "В размере 4/4 четыре шага не одинаковые: 1-й шаг тяжёлый («РАЗ»), 2-й лёгкий, 3-й средний, 4-й снова подталкивает к новому «РАЗ». Из этой волны рождается кач.",
      simpleTry: "Нажми «▶ Послушать» и проговори вслух с разной силой: РАЗ — два — Три — четыре. Почувствуй, как 1-й шаг всегда возвращает на землю.",
      simpleSecret: "Убери разницу между сильной и слабой долей — и музыка станет плоской, как робот.",
      hideStaffByDefault: true,
    },
  };

  const SIMPLE_EMOTIONS = {
    E01: "Одна поднятая нота (#4) убирает земное притяжение — музыка начинает парить, как в сказках Миядзаки.",
    E02: "Когда светлый мажор на секунду одалживает тёмный минорный аккорд (iv), в радости появляется тёплая ностальгия.",
    E03: "Мягкое движение по простым устойчивым ступеням без резких углов даёт чувство дома, безопасности и тепла.",
    E04: "Тёплый аккорд с добавочной мягкой нотой (maj7) и спокойный темп создают эффект тихой нежности и уюта.",
    E05: "Низкая долгая нота в фундаменте и постепенное усиление аккордов создают ощущение огромного пространства и восхода.",
    E06: "Резкий шаг всего на 1 лад вверх от дома (b2) мгновенно превращает спокойную мелодию в тревогу и опасность.",
    E07: "Прыжок на неожиданный далёкий аккорд (как в саундтреках кино) резко меняет картинку и рождает чувство тайны.",
    E08: "Нежный минор с приподнятой 6-й ступенью: грусть не давит, а звучит как светлая дорога и приключение.",
    E09: "Равные шаги без явного «дома» растворяют почву под ногами — звучит как сон, туман или космос.",
    E10: "Повторяющаяся ритмичная фигура с короткими паузами держит внимание в тонусе, как сцена погони или квеста.",
    E11: "Открытый аккорд без жёсткой «грусти/радости» (sus2/sus4) оставляет воздух и ощущение рассвета.",
    E12: "Шаг по тёмному минору к мягкому разрешению даёт благородную, глубокую печаль без тяжести.",
    E13: "Классический путь «вопрос → ответ» в аккордах ставит уверенную, тёплую точку в конце фразы.",
    E14: "Мягкие блюзовые «потёртости» и покачивание ритма добавляют живую человеческую улыбку и свободу.",
    E15: "Высокий прозрачный регистр и редкие ноты с воздухом создают ощущение зимней тишины и звёздного неба.",
    E16: "Мощный акцент на 3-й доле и низкий строй (Drop) делают ритм тяжёлым, собранным и кинематографичным.",
    E17: "Неровный шаг 2+2+2+3 (9/8) и восточный широкий шаг создают завораживающий танец Балкан и Востока.",
    E18: "Пять прозрачных нот японского лада и тишина между ними рисуют ветер, воду и созерцание.",
    E19: "Живой синкопированный перебор тайского Пхина и пульс 3–2 сразу вовлекают тело в светлый танец.",
    E20: "Ровная бочка на каждый шаг (1–2–3–4) и нарастание перед паузой дают мощный заряд движения.",
  };

  function getSimpleLessonOverlay(item) {
    if (!item || !item.id) return null;
    if (SIMPLE_LESSONS[item.id]) return SIMPLE_LESSONS[item.id];
    if (SIMPLE_EMOTIONS[item.id]) {
      return {
        title: item.title,
        simpleSummary: SIMPLE_EMOTIONS[item.id],
        hideStaffByDefault: false,
      };
    }
    // Hide intimidating staff by default across all of Act I (Weeks 1–4, except M012 which introduces pitch/staff)
    if (typeof item.week === "number" && item.week <= 4 && item.id !== "M012") {
      return {
        title: item.title,
        simpleSummary: null,
        hideStaffByDefault: true,
      };
    }
    return null;
  }

  function detectTermsInItem(item) {
    if (!item) return [];
    const ex = item.experience || {};
    const m = item.music || {};
    const ov = getSimpleLessonOverlay(item);
    const primaryBlob = [
      ov && ov.title,
      item.title,
      ov && ov.simpleSummary,
      ex.ontology_invariant,
      item.mechanism,
    ].filter(Boolean).join(" ");
    const secondaryBlob = [
      ex.sensory_emotion_channel,
      ex.motor_action,
      ex.practice_10m,
      ex.emergent_falsifier,
      m.meter,
    ].filter(Boolean).join(" ");

    const scored = [];
    for (const g of GLOSSARY_SIMPLE) {
      const inPrimary = g.match.test(primaryBlob);
      const inSecondary = !inPrimary && g.match.test(secondaryBlob);
      if (inPrimary || inSecondary) {
        // Avoid showing "Размер 4/4" on non-4/4 meters even if text mentions 4/4 as contrast
        if (g.id === "meter44" && m.meter && m.meter !== "4/4") continue;
        scored.push({ g, score: inPrimary ? 2 : (g.id === "meter44" ? 0.5 : 1) });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((x) => x.g);
  }

  function humanizeContrastLabel(raw, side) {
    const s = String(raw || "").trim();
    if (!s || /нейтральная опора|целевой окрас атома|базовый скелет/i.test(s)) {
      return side === "A" ? "A: Обычное звучание (для сравнения)" : "B: Как звучит в этом уроке";
    }
    return s.replace(/\bатома\b/gi, "урока").replace(/\bатом\b/gi, "урок");
  }

  function humanizeContrastHint(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Нажимай по очереди A и B, чтобы услышать разницу ухом.";
    return s.replace(/\bатома\b/gi, "урока").replace(/\bатом\b/gi, "урок");
  }

  function getLensNameRu(code) {
    return LENS_NAMES_RU[code] || code;
  }

  function describeDegree(midi, rootMidi) {
    const diff = (((Math.round(midi) - Math.round(rootMidi)) % 12) + 12) % 12;
    return DEGREE_FEELINGS[diff] || DEGREE_FEELINGS[0];
  }

  function describeChordRu(symbol) {
    const raw = String(symbol || "").trim();
    if (!raw) return "";
    const parts = raw.split("/");
    const main = parts[0];
    const bass = parts[1] || "";
    const m = main.match(/^([A-G])([#b]?)(.*)$/);
    if (!m) return raw;

    const mapRu = { C: "До", D: "Ре", E: "Ми", F: "Фа", G: "Соль", A: "Ля", B: "Си" };
    const rootRu = (mapRu[m[1]] || m[1]) + (m[2] === "#" ? "#" : m[2] === "b" ? "b" : "");
    const qual = m[3] || "";

    let color = "мажор (светлая опора)";
    if (qual === "m" || qual === "min") color = "минор (тёплая глубина)";
    else if (qual.includes("maj7")) color = "большой мажорный септаккорд (мечтательное сияние)";
    else if (qual.includes("m7b5")) color = "полууменьшённый (горько-сладкая тень)";
    else if (qual.includes("m7")) color = "минорный септаккорд (бархатная мягкость)";
    else if (qual.includes("sus2") || qual.includes("sus4")) color = "аккорд с задержанием (воздух без жёсткого наклонения)";
    else if (qual.includes("dim")) color = "уменьшённый (острое драматическое напряжение)";
    else if (qual.includes("aug") || qual.includes("+")) color = "увеличенный (загадочное расширение)";
    else if (qual.includes("add9") || qual.includes("9")) color = "с 9-й ступенью (объём и киношное дыхание)";
    else if (qual.includes("7")) color = "доминантсептаккорд (притяжение и зов домой)";
    else if (qual === "5") color = "квинтаккорд (чистая мощь без терции)";

    const bassNote = bass ? " поверх баса " + (mapRu[bass[0]] || bass) + (bass.slice(1) || "") : "";
    return raw + " — " + rootRu + " " + color + bassNote;
  }

  function describeMusicalAnatomy(item, opts) {
    const o = opts || {};
    const semis = Math.round(o.transpose || 0);
    const capo = Math.round(o.capo || 0);
    const m = (item && item.music) || {};
    const dropD = isDropDItem(item);

    const rawNotes = Array.isArray(m.midi_notes) && m.midi_notes.length ? m.midi_notes : [48, 52, 55];
    const notes = transposeMidis(rawNotes, semis);
    const rootMidi = transposeMidi(m.drone_midi || rawNotes[0] || 48, semis);

    // Unique pitch classes ordered from root
    const seenPc = new Set();
    const degreeChips = [];
    for (const midi of notes) {
      const pc = ((midi % 12) + 12) % 12;
      if (seenPc.has(pc)) continue;
      seenPc.add(pc);
      const info = describeDegree(midi, rootMidi);
      degreeChips.push({
        midi,
        noteEn: midiToName(midi, false),
        noteRu: midiToName(midi, true),
        pitchRu: midiToPitchClass(midi, true),
        deg: info.deg,
        role: info.role,
        feel: info.feel,
      });
    }

    // Highlight the most expressive non-tonic degree for emotional storytelling
    const expressive = degreeChips.find((c) => ["#4", "b2", "b6", "7", "b3", "6", "b7", "3"].includes(c.deg)) || degreeChips[1] || degreeChips[0];

    // Analyze contrast A -> B in plain human musical language
    let contrastStory = "";
    const cab = m.contrast_ab;
    if (cab && cab.a_events && cab.b_events) {
      const aEv = transposeEvents(cab.a_events, semis);
      const bEv = transposeEvents(cab.b_events, semis);
      const diff = computeContrastDiff(aEv, bEv);
      if (diff.addedInB.length) {
        const keyPc = diff.addedInB[0];
        const sampleMidi = bEv.flatMap((e) => e.midis || []).find((x) => ((x % 12) + 12) % 12 === keyPc) || (rootMidi + ((keyPc - (rootMidi % 12) + 12) % 12));
        const dInfo = describeDegree(sampleMidi, rootMidi);
        contrastStory =
          "Ключевая краска при переходе A → B — звук " +
          midiToPitchClass(sampleMidi, true) +
          " (" + dInfo.role.toLowerCase() + "): " +
          dInfo.feel + ".";
      } else {
        contrastStory =
          "В паре A ↔ B звучат близкие ноты, но меняется их движение, акцент или фактура — переключи их подряд, чтобы почувствовать, как меняется дыхание фразы.";
      }
    }

    // Chord progression explanation (only when not transposed, or note the transposition)
    const chords = Array.isArray(m.chord_progression) ? m.chord_progression.filter(Boolean) : [];
    const chordDetails = chords.map((c) => describeChordRu(c));
    const chordSummary = chords.length
      ? (semis !== 0
          ? "Оригинальные аккорды: " + chords.join(" → ") + " (сейчас сдвинуты на " + (semis > 0 ? "+" : "") + semis + " шаг.)."
          : chordDetails.slice(0, 4).join(" · "))
      : "";

    // Interval summary when no chord progression
    let intervalSummary = "";
    if (!chords.length && notes.length >= 2) {
      const span = Math.abs(notes[notes.length - 1] - notes[0]);
      if (span === 0) {
        intervalSummary = "Все ноты на одной высоте (унисон) — слушай тембр, ритм и динамику.";
      } else {
        const modSpan = span === 12 ? 12 : ((span % 12) || 12);
        const iv = INTERVAL_CATALOG.find((x) => x.semi === modSpan);
        if (iv) {
          intervalSummary = "Главный шаг мелодии: " + iv.name + " — " + iv.feel.toLowerCase() + ".";
        }
      }
    }

    const meter = m.meter || "4/4";
    const bpm = m.bpm || 86;
    const meterFeel = METER_FEELINGS[meter] || METER_FEELINGS["4/4"];

    // Playable hands guide (live for current transpose + capo + chosen 6/7-str tuning)
    const tuningId = o.tuningId || (dropD ? "drop_d_6" : "standard_6");
    const frets = chooseErgonomicFrets(notes.slice(0, 6), { tuningId, dropD, capo, maxFret: 12 });
    const guitarGuide = frets
      .map((p) => p.string + "-я стр. / " + (p.fret === 0 ? "откр." : p.fret + " лад") + " (" + midiToPitchClass(p.midi, true) + ")")
      .join(" · ");
    const pianoGuide = notes.slice(0, 6).map((x) => midiToName(x, true) + " (" + midiToName(x, false) + ")").join(" → ");

    return {
      tonicLabel: midiToPitchClass(rootMidi, true) + " (" + midiToName(rootMidi, false) + " · " + Math.round(midiToFreq(rootMidi)) + " Гц)",
      degreeChips,
      expressiveNoteStory: expressive
        ? "Особую окраску здесь задаёт " + expressive.pitchRu + " (" + expressive.role.toLowerCase() + "): " + expressive.feel + "."
        : "",
      contrastStory,
      chordSummary,
      intervalSummary,
      rhythmStory: "Размер " + meter + " (" + bpm + " уд/мин): " + meterFeel,
      guitarGuide,
      pianoGuide,
    };
  }

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function midiToName(midi, useRu, preferFlat) {
    const m = Math.round(midi);
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    const arr = useRu ? (preferFlat ? NOTE_RU_FLAT : NOTE_RU) : (preferFlat ? NOTE_EN_FLAT : NOTE_EN);
    return arr[pc] + oct;
  }

  function midiToPitchClass(midi, useRu, preferFlat) {
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const arr = useRu ? (preferFlat ? NOTE_RU_FLAT : NOTE_RU) : (preferFlat ? NOTE_EN_FLAT : NOTE_EN);
    return arr[pc];
  }

  function midiToLabelPair(midi) {
    return midiToName(midi, false) + " · " + midiToName(midi, true);
  }

  function scaleDegreeLabel(midi, rootMidi) {
    if (typeof rootMidi !== "number" || !Number.isFinite(rootMidi)) return "";
    const diff = (((Math.round(midi) - Math.round(rootMidi)) % 12) + 12) % 12;
    return DEGREE_LABELS[diff];
  }

  function transposeMidi(midi, semis) {
    if (!semis) return midi;
    return clamp(Math.round(midi) + Math.round(semis), 33, 88);
  }

  function transposeMidis(midis, semis) {
    if (!Array.isArray(midis)) return [];
    if (!semis) return midis.slice();
    return midis.map((m) => transposeMidi(m, semis));
  }

  function transposeEvents(events, semis) {
    if (!Array.isArray(events)) return [];
    if (!semis) return events.map((ev) => ({ ...ev, midis: (ev.midis || []).slice() }));
    return events.map((ev) => ({
      ...ev,
      midis: transposeMidis(ev.midis || [], semis),
    }));
  }

  function isDropDItem(item) {
    if (!item) return false;
    const slug = String(item.slug || "").toLowerCase();
    const title = String(item.title || "").toLowerCase();
    if (slug.includes("drop-d") || title.includes("drop d")) return true;
    const notes = (item.music && item.music.midi_notes) || [];
    return notes.includes(38);
  }

  function getTuningSpec(tuningIdOrDropD) {
    if (typeof tuningIdOrDropD === "string" && GUITAR_TUNINGS[tuningIdOrDropD]) {
      return GUITAR_TUNINGS[tuningIdOrDropD];
    }
    if (tuningIdOrDropD === true) return GUITAR_TUNINGS.drop_d_6;
    return GUITAR_TUNINGS.standard_6;
  }

  function getGuitarTuning(tuningIdOrDropD) {
    return getTuningSpec(tuningIdOrDropD).midis;
  }

  function midiToGuitarPositions(midi, opts) {
    const o = opts || {};
    const spec = o.tuningId ? getTuningSpec(o.tuningId) : getTuningSpec(!!o.dropD);
    const tuning = spec.midis;
    const capo = clamp(Math.round(o.capo || 0), 0, 7);
    const maxFret = clamp(Math.round(o.maxFret || 12), 5, 15);
    const out = [];
    for (let idx = 0; idx < tuning.length; idx++) {
      const openMidi = tuning[idx] + capo;
      const fret = Math.round(midi) - openMidi;
      if (fret >= 0 && fret <= maxFret && capo + fret <= maxFret) {
        out.push({
          midi: Math.round(midi),
          string: idx + 1, // 1 = thinnest high string, N = thickest low string
          fret,
          absFret: capo + fret,
          open: fret === 0,
        });
      }
    }
    return out;
  }

  function chooseErgonomicFrets(midis, opts) {
    const o = opts || {};
    const spec = o.tuningId ? getTuningSpec(o.tuningId) : getTuningSpec(!!o.dropD);
    const lowBound = Math.min(...spec.midis) + (o.capo || 0);
    const highBound = Math.max(...spec.midis) + (o.maxFret || 12);
    const unique = [];
    const seen = new Set();
    for (const m of midis || []) {
      const rm = Math.round(m);
      if (!seen.has(rm)) {
        seen.add(rm);
        unique.push(rm);
      }
    }
    unique.sort((a, b) => a - b); // low to high -> assign thick strings first

    const usedStrings = new Set();
    const chosen = [];
    let anchorFret = 2;

    for (const midi of unique) {
      let candidates = midiToGuitarPositions(midi, o);
      if (!candidates.length) {
        let folded = midi;
        while (folded < lowBound) folded += 12;
        while (folded > highBound) folded -= 12;
        candidates = midiToGuitarPositions(folded, o);
      }
      if (!candidates.length) continue;

      const available = candidates.filter((c) => !usedStrings.has(c.string));
      const pool = available.length ? available : candidates;

      pool.sort((a, b) => {
        const scoreA = (a.open ? -1.5 : Math.abs(a.fret - anchorFret)) + a.fret * 0.18;
        const scoreB = (b.open ? -1.5 : Math.abs(b.fret - anchorFret)) + b.fret * 0.18;
        return scoreA - scoreB;
      });

      const best = pool[0];
      usedStrings.add(best.string);
      if (!best.open && chosen.length === 0) {
        anchorFret = clamp(best.fret, 1, 8);
      }
      chosen.push({ ...best, originalMidi: midi });
    }
    return chosen;
  }

  /* Physically playable human left-hand chord voicing solver (<=4 fret span, max 1 note per string, root in bass)
   * Works across ALL 6- and 7-string tunings including D Drop C & 7-str Drop C + A.
   */
  /* Physical human left-hand grip validator for 6- & 7-string chord voicings:
   *  - contiguous strings (0 muted interior strings)
   *  - fret span <= 3 (fits 4-fret human hand)
   *  - <= 4 fretted fingers, OR a valid index-finger barre at minFret covering down to string 1
   *    with NO open string underneath the barre and <= 3 remaining fingers above minFret
   */
  function isPhysicallyPlayableGrip(picked) {
    if (!Array.isArray(picked) || picked.length < 2) return false;
    const sorted = picked.slice().sort((a, b) => b.string - a.string); // bass -> treble
    // 1. Contiguous strings (no muted '×' gap inside the strum)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].string - sorted[i].string !== 1) return false;
    }
    const fretted = sorted.filter((p) => p.fret > 0);
    if (fretted.length === 0) return true;
    const frets = fretted.map((p) => p.fret);
    const minF = Math.min(...frets);
    const maxF = Math.max(...frets);
    if (maxF - minF > 3) return false;

    if (fretted.length <= 4) {
      // Check against awkward inverted double-barre where thick strings sit higher than multiple thin-string fretted notes
      const aboveMin = fretted.filter((p) => p.fret > minF);
      const atMin = fretted.filter((p) => p.fret === minF);
      if (fretted.length === 4 && atMin.length >= 2) {
        const barreStart = Math.max(...atMin.map((p) => p.string));
        const hasOpenUnderBarre = sorted.some((p) => p.string < barreStart && p.fret === 0);
        if (hasOpenUnderBarre && aboveMin.length >= 2) return false;
      }
      return true;
    }

    // 5+ fretted notes: MUST be a genuine index-finger barre on minF
    const atMin = fretted.filter((p) => p.fret === minF);
    if (atMin.length < 2) return false;
    const barreStart = Math.max(...atMin.map((p) => p.string));
    // Index finger covers from barreStart all the way to the thinnest sounded string -> no open string below barreStart!
    for (const p of sorted) {
      if (p.string <= barreStart && p.fret < minF) return false;
    }
    // No fretted notes thicker than barreStart (prevents inverted barre like 6:5 5:5 4:5 3:4 2:3 1:3)
    for (const p of sorted) {
      if (p.string > barreStart && p.fret > 0) return false;
    }
    const extraFingers = fretted.filter((p) => p.fret > minF).length;
    return extraFingers <= 3;
  }

  function choosePlayableChordVoicing(midis, opts) {
    const o = opts || {};
    if (!Array.isArray(midis) || !midis.length) return [];
    const spec = o.tuningId ? getTuningSpec(o.tuningId) : getTuningSpec(!!o.dropD);
    const capo = clamp(Math.round(o.capo || 0), 0, 7);
    const maxFret = clamp(Math.round(o.maxFret || 12), 5, 15);
    const tuning = spec.midis;

    const rootPc = ((Math.round(midis[0]) % 12) + 12) % 12;
    const reqPcs = [...new Set(midis.map((m) => ((Math.round(m) % 12) + 12) % 12))];
    const reqSet = new Set(reqPcs);

    let bestVoicing = null;
    let bestScore = -1e9;

    // Evaluate both open-position shapes (win<=2, allowOpen=true) and clean movable barre shapes (allowOpen=false)
    for (let win = 1; win <= Math.min(9, maxFret - 3); win++) {
      const openModes = win <= 2 ? [true, false] : [false];
      for (const allowOpen of openModes) {
        const perStringChoices = [];
        for (let sIdx = 0; sIdx < tuning.length; sIdx++) {
          const openMidi = tuning[sIdx] + capo;
          const cands = [];
          if (allowOpen && reqSet.has(((openMidi % 12) + 12) % 12)) {
            cands.push({ string: sIdx + 1, fret: 0, absFret: capo, midi: openMidi, pc: ((openMidi % 12) + 12) % 12 });
          }
          for (let f = win; f <= Math.min(maxFret - capo, win + 3); f++) {
            const m = openMidi + f;
            const pc = ((m % 12) + 12) % 12;
            if (reqSet.has(pc)) {
              cands.push({ string: sIdx + 1, fret: f, absFret: capo + f, midi: m, pc });
            }
          }
          perStringChoices.push(cands);
        }

        // Try every contiguous slice [bassIdx .. topIdx] with root on bassIdx
        for (let bassIdx = tuning.length - 1; bassIdx >= 2; bassIdx--) {
          const bassRoots = perStringChoices[bassIdx].filter((c) => c.pc === rootPc);
          if (!bassRoots.length) continue;

          for (const bassRoot of bassRoots) {
            for (const topIdx of [0, 1]) {
              if (bassIdx - topIdx < 2) continue;
              // Build compact contiguous voicing from bassIdx down to topIdx
              let validSlice = true;
              const picked = [bassRoot];
              const covered = new Set([rootPc]);

              for (let sIdx = bassIdx - 1; sIdx >= topIdx; sIdx--) {
                const cands = perStringChoices[sIdx];
                if (!cands.length) {
                  validSlice = false;
                  break;
                }
                const missing = cands.filter((c) => !covered.has(c.pc));
                const pool = (missing.length ? missing : cands).slice();
                // Prefer barre fret (win) or lowest playable fret
                pool.sort((a, b) => a.fret - b.fret);
                const pick = pool[0];
                picked.push(pick);
                covered.add(pick.pc);
              }
              if (!validSlice) continue;
              if (!isPhysicallyPlayableGrip(picked)) continue;

              const fretted = picked.filter((p) => p.fret > 0).map((p) => p.fret);
              const span = fretted.length > 1 ? Math.max(...fretted) - Math.min(...fretted) : 0;
              const openBonus = allowOpen ? picked.filter((p) => p.fret === 0).length * 4 : 0;

              const score =
                covered.size * 50 +
                (covered.size === reqPcs.length ? 95 : 0) +
                Math.min(5, picked.length) * 6 +
                openBonus -
                span * 9 -
                win * 2.4 -
                (bassIdx === 6 && reqPcs.length <= 4 ? 5 : 0);

              if (score > bestScore) {
                bestScore = score;
                bestVoicing = picked;
              }
            }
          }
        }
      }
    }

    if (bestVoicing && bestVoicing.length >= 2) {
      return bestVoicing.sort((a, b) => b.string - a.string);
    }
    // Safe playable fallback: pick up to 4 contiguous strings around lowest root
    const fb = chooseErgonomicFrets(midis, o);
    const seenStr = new Set();
    return fb.filter((p) => {
      if (seenStr.has(p.string)) return false;
      seenStr.add(p.string);
      return true;
    }).slice(0, 4);
  }

  function midiToDiatonicStep(midi) {
    const m = Math.round(midi);
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    const info = DIATONIC_MAP[pc];
    return {
      step: oct * 7 + info.d,
      acc: info.acc,
      oct,
      pc,
    };
  }

  function midiToStaffPos(midi, clefMode) {
    const info = midiToDiatonicStep(midi);
    let clef = clefMode || "treble";
    if (clef === "grand") {
      clef = midi >= 60 ? "treble" : "bass";
    }
    // Treble bottom line E4 = 4*7 + 2 = 30; top line F5 = 38 (8 steps above)
    // Bass bottom line G2 = 2*7 + 4 = 18; top line A3 = 26 (8 steps above)
    const bottomStep = clef === "bass" ? 18 : 30;
    const offset = info.step - bottomStep; // 0 = bottom line, 2 = 2nd line, ..., 8 = top line

    const ledgerOffsets = [];
    if (offset < 0) {
      for (let s = -2; s >= offset; s -= 2) ledgerOffsets.push(s);
    } else if (offset > 8) {
      for (let s = 10; s <= offset; s += 2) ledgerOffsets.push(s);
    }
    return {
      midi: Math.round(midi),
      clef,
      offset,
      acc: info.acc,
      ledgerOffsets,
    };
  }

  function parseMeter(meterStr) {
    const m = String(meterStr || "4/4").match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return { num: 4, den: 4 };
    return { num: parseInt(m[1], 10) || 4, den: parseInt(m[2], 10) || 4 };
  }

  function getMeterAccentPattern(meterStr) {
    switch (String(meterStr || "4/4")) {
      case "3/4":  return [3, 1, 1];
      case "5/4":  return [3, 1, 1, 2, 1];
      case "6/8":  return [3, 1, 1, 2, 1, 1];
      case "7/8":  return [3, 1, 2, 1, 2, 1, 1];
      case "9/8":  return [3, 1, 2, 1, 2, 1, 2, 1, 1]; // Balkan 2+2+2+3 feel
      case "12/8": return [3, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1];
      default:     return [3, 1, 2, 1]; // 4/4
    }
  }

  function getEmotionMeta(tag) {
    return EMOTION_META[tag] || EMOTION_META.curiosity;
  }

  function computeContrastDiff(aEvents, bEvents) {
    const setA = new Set();
    const setB = new Set();
    for (const ev of aEvents || []) for (const m of ev.midis || []) setA.add(m % 12);
    for (const ev of bEvents || []) for (const m of ev.midis || []) setB.add(m % 12);
    const addedInB = [...setB].filter((pc) => !setA.has(pc));
    const removedFromA = [...setA].filter((pc) => !setB.has(pc));
    return { addedInB, removedFromA };
  }

  function buildSceneTimeline(mechanics, density) {
    const list = (mechanics || []).filter(Boolean).slice(0, 6);
    const mode = density || "acoustic";
    const events = [];
    const segments = [];
    if (!list.length) {
      return { title: "Пустая сцена", bpm: 88, meter: "4/4", drone_midi: 48, segments: [], events: [] };
    }

    const baseBpm = Math.round(
      list.reduce((acc, m) => acc + ((m.music && m.music.bpm) || 88), 0) / list.length
    );

    list.forEach((mech, segIdx) => {
      const music = mech.music || {};
      const srcEvents = Array.isArray(music.timeline) && music.timeline.length
        ? music.timeline
        : [{ midis: (music.midi_notes || [60]).slice(0, 3), beats: 2.0, label: mech.id, velocity: 0.78, strum: true }];

      const segStart = events.length;
      srcEvents.forEach((ev) => {
        const rawMidis = (ev.midis || []).slice().sort((a, b) => a - b);
        if (!rawMidis.length) return;
        const baseBeats = Number(ev.beats) || 1.0;

        if (mode === "solo") {
          // Delicate single-voice melody contour (highest expressive tone)
          const top = rawMidis[rawMidis.length - 1];
          events.push({
            midis: [top],
            beats: Math.max(0.5, Math.min(2.0, baseBeats)),
            label: mech.id + " · " + midiToName(top, false),
            velocity: Math.min(0.85, (ev.velocity || 0.75)),
            strum: false,
            segmentIndex: segIdx,
            mechanicId: mech.id,
            mechanicTitle: mech.title,
            emotion_tag: mech.emotion_tag,
            meter: music.meter || "4/4",
            bpm: music.bpm || baseBpm,
            drone_midi: music.drone_midi || rawMidis[0],
          });
        } else if (mode === "groove") {
          // Split long chords into pulsing bass + chord bounce for kinetic drive
          const root = rawMidis[0];
          const upper = rawMidis.length > 1 ? rawMidis : [root, root + 7];
          const half = Math.max(0.4, baseBeats / 2);
          events.push({
            midis: [root, ...upper.slice(1)],
            beats: half,
            label: (ev.label || mech.id) + " ↓",
            velocity: Math.min(0.92, (ev.velocity || 0.8) + 0.08),
            strum: true,
            accentKick: true,
            segmentIndex: segIdx,
            mechanicId: mech.id,
            mechanicTitle: mech.title,
            emotion_tag: mech.emotion_tag,
            meter: music.meter || "4/4",
            bpm: music.bpm || baseBpm,
            drone_midi: music.drone_midi || root,
          });
          events.push({
            midis: upper.slice(-Math.min(3, upper.length)),
            beats: half,
            label: (ev.label || mech.id) + " ↑",
            velocity: 0.68,
            strum: false,
            accentHat: true,
            segmentIndex: segIdx,
            mechanicId: mech.id,
            mechanicTitle: mech.title,
            emotion_tag: mech.emotion_tag,
            meter: music.meter || "4/4",
            bpm: music.bpm || baseBpm,
            drone_midi: music.drone_midi || root,
          });
        } else {
          // Balanced acoustic voicing
          events.push({
            midis: rawMidis,
            beats: baseBeats,
            label: ev.label || mech.id,
            velocity: ev.velocity || 0.78,
            strum: !!ev.strum || rawMidis.length >= 3,
            segmentIndex: segIdx,
            mechanicId: mech.id,
            mechanicTitle: mech.title,
            emotion_tag: mech.emotion_tag,
            meter: music.meter || "4/4",
            bpm: music.bpm || baseBpm,
            drone_midi: music.drone_midi || rawMidis[0],
          });
        }
      });

      segments.push({
        index: segIdx,
        id: mech.id,
        title: mech.title,
        emotion_tag: mech.emotion_tag,
        startEvent: segStart,
        endEvent: events.length - 1,
      });
    });

    const firstMusic = list[0].music || {};
    return {
      title: list.map((m) => m.id).join(" → "),
      bpm: baseBpm,
      meter: firstMusic.meter || "4/4",
      drone_midi: firstMusic.drone_midi || 48,
      density: mode,
      segments,
      events,
    };
  }

  function makeRng(seed) {
    if (typeof seed === "function") return seed;
    if (typeof seed !== "number") return Math.random;
    let s = (seed >>> 0) || 123456789;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pickN(arr, n, rng) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = copy[i];
      copy[i] = copy[j];
      copy[j] = t;
    }
    return copy.slice(0, n);
  }

  function generateEarChallenge(catalog, mode, seed, opts) {
    const o = opts || {};
    const rng = makeRng(seed);
    const m = mode || "interval";
    const atoms = (catalog && catalog.atoms) || [];
    const emotions = (catalog && catalog.emotion_mechanics) || [];

    if (m === "interval") {
      const rootChoices = [48, 50, 52, 53, 55, 57, 60]; // C3..C4
      const rootMidi = typeof o.rootMidi === "number" ? o.rootMidi : rootChoices[Math.floor(rng() * rootChoices.length)];
      const chosen4 = pickN(INTERVAL_CATALOG, 4, rng);
      const target = chosen4[0];
      const options = pickN(chosen4, 4, rng).map((it) => ({
        id: String(it.semi),
        label: it.short + " · " + it.name.split(" (")[0],
        sub: it.feel,
      }));
      const targetMidi = rootMidi + target.semi;
      return {
        mode: "interval",
        prompt: "Услышь шаг вверх от первой ноты (" + midiToName(rootMidi, true) + ") — выбери ответ или нажми вторую ноту на клавишах/грифе.",
        rootMidi,
        targetMidi,
        correctId: String(target.semi),
        options,
        bpm: 86,
        meter: "4/4",
        drone_midi: rootMidi,
        timeline: [
          { midis: [rootMidi], beats: 1.0, label: "Опора", velocity: 0.82, strum: false },
          { midis: [targetMidi], beats: 1.25, label: "?", velocity: 0.85, strum: false },
          { midis: [rootMidi, targetMidi], beats: 1.75, label: "Вместе", velocity: 0.78, strum: false },
        ],
        revealNotes: [rootMidi, targetMidi],
        explanation: target.name + " (" + midiToName(rootMidi, true) + " → " + midiToName(targetMidi, true) + "): " + target.feel + ".",
      };
    }

    if (m === "emotion_mode" && emotions.length >= 4) {
      const pool = pickN(emotions, 4, rng);
      const target = pool[0];
      const options = pickN(pool, 4, rng).map((em) => ({
        id: em.id,
        label: em.title,
        sub: getEmotionMeta(em.emotion_tag).label + " · " + (em.music ? em.music.meter : "4/4"),
      }));
      const tm = target.music || {};
      return {
        mode: "emotion_mode",
        sourceEmotionId: target.id,
        prompt: "Послушай окрас музыки вслепую: какое настроение и приём сейчас звучат?",
        rootMidi: tm.drone_midi || (tm.midi_notes && tm.midi_notes[0]) || 48,
        correctId: target.id,
        options,
        bpm: tm.bpm || 84,
        meter: tm.meter || "4/4",
        drone_midi: tm.drone_midi || 48,
        timeline: tm.timeline || [],
        revealNotes: tm.midi_notes || [],
        explanation: target.title + " — " + (SIMPLE_EMOTIONS[target.id] || target.mechanism),
      };
    }

    if (m === "meter_groove" && atoms.length > 0) {
      const targetMeters = ["4/4", "3/4", "5/4", "7/8", "9/8", "12/8"];
      const byMeter = {};
      for (const a of atoms) {
        const mt = a.music && a.music.meter;
        if (targetMeters.includes(mt)) {
          if (!byMeter[mt]) byMeter[mt] = [];
          byMeter[mt].push(a);
        }
      }
      const availableMeters = targetMeters.filter((mt) => byMeter[mt] && byMeter[mt].length > 0);
      const pickedMeters = pickN(availableMeters, Math.min(4, availableMeters.length), rng);
      const ansMeter = (o.focusAtom && o.focusAtom.music && targetMeters.includes(o.focusAtom.music.meter))
        ? o.focusAtom.music.meter
        : pickedMeters[0];
      const finalMeters = pickedMeters.includes(ansMeter) ? pickedMeters : [ansMeter, ...pickedMeters.slice(0, 3)];
      const samplePool = byMeter[ansMeter];
      const sample = (o.focusAtom && o.focusAtom.music && o.focusAtom.music.meter === ansMeter)
        ? o.focusAtom
        : samplePool[Math.floor(rng() * samplePool.length)];
      const meterHints = {
        "4/4": "Ровный шаг 1–2–3–4",
        "3/4": "Вальсовое качание РАЗ–два–три",
        "5/4": "Неровный шаг 3+2 (с задержкой)",
        "7/8": "Живой шаг 2+2+3",
        "9/8": "Танец 2+2+2+3",
        "12/8": "Плавная волна 4×3",
      };
      const options = pickN(finalMeters, finalMeters.length, rng).map((mt) => ({
        id: mt,
        label: "Размер " + mt,
        sub: meterHints[mt] || "",
      }));
      const sm = sample.music || {};
      const ov = getSimpleLessonOverlay(sample);
      const sampleTitle = (ov && ov.title) || sample.title;
      return {
        mode: "meter_groove",
        sourceAtomId: sample.id,
        prompt: "Почувствуй сильную долю и посчитай шаги — какой это размер?",
        rootMidi: sm.drone_midi || 45,
        correctId: ansMeter,
        options,
        bpm: sm.bpm || 104,
        meter: ansMeter,
        drone_midi: sm.drone_midi || 45,
        forceMetronome: true,
        timeline: sm.timeline || [],
        revealNotes: sm.midi_notes || [],
        explanation: "Это " + ansMeter + " (" + (meterHints[ansMeter] || "") + ") из урока «" + sampleTitle + "».",
      };
    }

    // Default / ab_shift mode: compare A vs B from an atom with real contrast_ab
    const rich = atoms.filter(
      (a) =>
        a.music &&
        a.music.contrast_ab &&
        Array.isArray(a.music.contrast_ab.a_events) &&
        Array.isArray(a.music.contrast_ab.b_events) &&
        a.music.contrast_ab.a_events.length > 0 &&
        a.music.contrast_ab.b_events.length > 0
    );
    const hasFocusAb = o.focusAtom && o.focusAtom.music && o.focusAtom.music.contrast_ab &&
      Array.isArray(o.focusAtom.music.contrast_ab.a_events) && o.focusAtom.music.contrast_ab.a_events.length > 0 &&
      Array.isArray(o.focusAtom.music.contrast_ab.b_events) && o.focusAtom.music.contrast_ab.b_events.length > 0;
    const chosen = hasFocusAb ? o.focusAtom : (rich.length ? rich[Math.floor(rng() * rich.length)] : atoms[0]);
    const cab = chosen.music.contrast_ab;
    const isB = rng() >= 0.5;
    const ov = getSimpleLessonOverlay(chosen);
    const chosenTitle = (ov && ov.title) || chosen.title;
    const lblA = humanizeContrastLabel(cab.a_label, "A");
    const lblB = humanizeContrastLabel(cab.b_label, "B");
    const options = [
      { id: "A", label: lblA, sub: "Обычный вариант для сравнения" },
      { id: "B", label: lblB, sub: "Приём из урока «" + chosenTitle + "»" },
    ];
    return {
      mode: "ab_shift",
      sourceAtomId: chosen.id,
      prompt: "Сначала послушай эталон A, затем «Послушать» — это остался вариант A или уже сработал вариант B?",
      rootMidi: chosen.music.drone_midi || 48,
      correctId: isB ? "B" : "A",
      options,
      bpm: chosen.music.bpm || 86,
      meter: chosen.music.meter || "4/4",
      drone_midi: chosen.music.drone_midi || 48,
      referenceTimeline: cab.a_events,
      timeline: isB ? cab.b_events : cab.a_events,
      revealNotes: chosen.music.midi_notes || [],
      explanation:
        "Звучал " +
        (isB ? lblB : lblA) +
        ". " +
        humanizeContrastHint(cab.shift_hint || (ov && ov.simpleSummary) || chosen.experience.ontology_invariant),
    };
  }

  return {
    NOTE_EN,
    NOTE_RU,
    DEGREE_LABELS,
    DEGREE_FEELINGS,
    LENS_NAMES_RU,
    METER_FEELINGS,
    GLOSSARY_SIMPLE,
    SIMPLE_LESSONS,
    SIMPLE_EMOTIONS,
    INTERVAL_CATALOG,
    EMOTION_META,
    GUITAR_TUNINGS,
    GUITAR_TUNING_ORDER,
    GUITAR_STANDARD,
    GUITAR_DROP_D,
    clamp,
    midiToFreq,
    midiToName,
    midiToPitchClass,
    midiToLabelPair,
    scaleDegreeLabel,
    getLensNameRu,
    getSimpleLessonOverlay,
    detectTermsInItem,
    humanizeContrastLabel,
    humanizeContrastHint,
    describeDegree,
    describeChordRu,
    describeMusicalAnatomy,
    transposeMidi,
    transposeMidis,
    transposeEvents,
    isDropDItem,
    getTuningSpec,
    getGuitarTuning,
    midiToGuitarPositions,
    chooseErgonomicFrets,
    isPhysicallyPlayableGrip,
    choosePlayableChordVoicing,
    midiToStaffPos,
    parseMeter,
    getMeterAccentPattern,
    getEmotionMeta,
    computeContrastDiff,
    buildSceneTimeline,
    generateEarChallenge,
  };
});
