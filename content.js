// Alle tekst en het verzorgingsritme. Geen logica, behalve het ritme per maand.
//
// Voornaamwoorden staan tussen accolades en worden ingevuld op basis van wat
// Wouter en Nona bij de naam kiezen: {hij} {hem} {zijn}, met hoofdletter {Hij}.

export const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const DAYS_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export const PRONOUNS = {
  m: { hij: "hij", hem: "hem", zijn: "zijn", label: "hij" },
  v: { hij: "zij", hem: "haar", zijn: "haar", label: "zij" },
  x: { hij: "die", hem: "die", zijn: "diens", label: "geen van beide" },
};

// Maanden tellen vanaf 0. De ficus groeit van maart tot en met september.
const grows = (month) => month >= 2 && month <= 8;
const pruningSeason = (month) => month >= 3 && month <= 8;

// Elke taak:
//   every(month)  dagen tussen twee beurten, afhankelijk van de maand
//   first         dagen na de naamgeving waarop de eerste beurt valt
//   sub(month)    de ene zin op de kaart
export const TASKS = [
  {
    id: "water", kanji: "水", name: "Grond voelen",
    doneLabel: "Gegoten", skipLabel: "Nog vochtig",
    logDone: "Water gegeven", logSkip: "Gevoeld, nog vochtig",
    first: 0,
    every: (month) => [4, 4, 3, 3, 2, 2, 2, 2, 3, 3, 4, 4][month],
    // Was de grond nog vochtig, dan kijken ze sneller opnieuw dan het gewone ritme.
    recheck: (month) => (month >= 4 && month <= 7 ? 1 : 2),
    sub: () => "Vinger onder het mos. Droog? Gieten tot het onderaan uitloopt, daarna het schoteltje leeg.",
  },
  {
    id: "plaag", kanji: "虫", name: "Blad nakijken",
    first: 0,
    every: () => 7,
    sub: () => "Draai een paar blaadjes om. Spinsel, bruine schildjes of wit pluis? Dan is er bezoek.",
  },
  {
    id: "foto", kanji: "写", name: "Maandfoto",
    doneLabel: "Foto nemen", logDone: "Foto genomen",
    first: 0,
    every: () => 30,
    sub: () => "Zelfde plek, zelfde hoek. Stuur ze daarna ook naar Vic en Julie, ze zijn benieuwd!",
  },
  {
    id: "licht", kanji: "光", name: "Kwartslag draaien",
    first: 14,
    every: () => 14,
    sub: () => "Anders groeit {hij} scheef naar het raam toe.",
  },
  {
    id: "stof", kanji: "葉", name: "Blad afstoffen",
    first: 21,
    every: () => 30,
    sub: () => "Natte doek erover, of even onder een lauwe douche. Stof houdt licht tegen.",
  },
  {
    id: "mest", kanji: "肥", name: "Bemesten",
    first: 28,
    every: (month) => (grows(month) ? 14 : 35),
    sub: (month) => grows(month)
      ? "Bonsaimest in het gietwater. Alleen als de grond al vochtig is."
      : "Groeit {hij} nog? Halve dosis. Staat {hij} stil? Sla over.",
  },
  {
    id: "snoei", kanji: "剪", name: "Scheuten knippen",
    first: 28,
    every: (month) => (pruningSeason(month) ? 14 : 30),
    sub: (month) => pruningSeason(month)
      ? "Scheut met 6 à 8 blaadjes? Terug naar 2, net boven een blad."
      : "Alleen wat echt uitsteekt. De grote knipbeurt is voor april.",
  },
];

// Eén notitie per maand, onderaan het scherm Vandaag.
export const MONTH_NOTES = [
  "De donkerste weken. Zet {hem} zo dicht mogelijk bij het raam en giet weinig. Bij de verwarming komt er sneller spint.",
  "De dagen lengen, {hij} groeit nog traag. Zuinig gieten en kijken of er knoppen zwellen.",
  "{Hij} schiet weer in gang. Vanaf nu om de twee weken mest.",
  "Knipmaand. Kijk ook eens onder de schaal: steken er wortels uit de gaten?",
  "Volle groei. Vaker gieten, scheuten bijhouden. Verpotten kan nog tot juni.",
  "Blijven de nachten boven 15 °C, dan mag {hij} naar buiten. Eerst een week in de schaduw.",
  "Buiten droogt de schaal snel uit. Elke dag even voelen.",
  "Blijven knippen en mesten. Felle zon achter glas verbrandt het blad.",
  "Terug naar binnen voor de nachten onder 15 °C zakken. Eerst nakijken op meelifters.",
  "Minder licht, dus minder water en mest. Raamplek.",
  "Verwarming aan, droge lucht. Weg van de radiator. Een groeilamp mag.",
  "Rustmaand. Gieten als de grond erom vraagt, verder met rust laten.",
];
export const REPOT_NOTE = " Dit jaar is het verpotjaar. Hoe het moet, staat bij Hulp.";
export const FIRST_REPOT_YEAR = 2027;

// De 24 sekki van de Japanse almanak: [maand, dag, naam, betekenis].
// De begindatum schuift per jaar hooguit een dag.
export const SEKKI = [
  [1, 5, "小寒", "kleine kou"], [1, 20, "大寒", "grote kou"],
  [2, 4, "立春", "begin van de lente"], [2, 19, "雨水", "regenwater"],
  [3, 5, "啓蟄", "insecten ontwaken"], [3, 20, "春分", "lente-evening"],
  [4, 4, "清明", "helder en klaar"], [4, 20, "穀雨", "graanregen"],
  [5, 5, "立夏", "begin van de zomer"], [5, 21, "小満", "kleine volheid"],
  [6, 5, "芒種", "graan in de aar"], [6, 21, "夏至", "zomerzonnewende"],
  [7, 7, "小暑", "kleine hitte"], [7, 22, "大暑", "grote hitte"],
  [8, 7, "立秋", "begin van de herfst"], [8, 23, "処暑", "einde van de hitte"],
  [9, 7, "白露", "witte dauw"], [9, 23, "秋分", "herfst-evening"],
  [10, 8, "寒露", "koude dauw"], [10, 23, "霜降", "eerste rijp"],
  [11, 7, "立冬", "begin van de winter"], [11, 22, "小雪", "lichte sneeuw"],
  [12, 7, "大雪", "zware sneeuw"], [12, 21, "冬至", "winterzonnewende"],
];

// Korte stappenplannen achter de knop "Tip?".
export const TIPS = {
  water: {
    title: "Zo giet je",
    when: "Wanneer de grond onder het mos droog aanvoelt.",
    steps: [
      "Voel onder het mos, een vingerkootje diep. Nog vochtig? Wacht een dag.",
      "Droog? Giet langzaam met lauw water tot het onderaan uitloopt.",
      "Wacht een minuut en giet nog eens. De eerste beurt maakt de grond nat, de tweede dringt door.",
      "Giet na een kwartier het schoteltje leeg.",
    ],
    note: "Loopt het water over de grond weg in plaats van erin? Zet de schaal tien minuten in een kom lauw water.",
  },
  plaag: {
    title: "Zo kijk je het blad na",
    when: "Elke week, in de winter extra goed.",
    steps: [
      "Draai drie of vier blaadjes om, ook onderin de kruin.",
      "Kijk in de oksels, waar blad en takje samenkomen.",
      "Spinsel is spint. Bruine bolletjes zijn schildluis. Wit pluis is wolluis.",
      "Iets gevonden? Onder Er scheelt iets staat wat jullie doen.",
    ],
  },
  licht: {
    title: "Zo draai je",
    when: "Om de twee weken.",
    steps: [
      "Draai de schaal een kwartslag, altijd in dezelfde richting.",
      "Kijk of {hij} nog vlak bij het raam staat. Elke meter verder scheelt veel licht.",
      "Niet boven de radiator en niet in de tocht.",
    ],
    note: "Verder blijft {hij} op {zijn} plek. Van verhuizen laat {hij} blad vallen.",
  },
  mest: {
    title: "Zo bemest je",
    when: "Maart tot september om de twee weken. In de winter alleen als {hij} groeit.",
    steps: [
      "Giet eerst gewoon water. Mest op droge grond verbrandt de wortels.",
      "Doe vloeibare bonsaimest in de gieter, zoveel als het etiket zegt. Gewone kamerplantenvoeding kan ook, op halve dosis.",
      "Giet daarmee zoals anders, tot het onderaan uitloopt.",
    ],
    note: "Geen mest als {hij} ziek is, en niet in de eerste maand na het verpotten.",
  },
  snoei: {
    title: "Zo knip je",
    when: "Het hele jaar licht, van april tot september vaker.",
    steps: [
      "Zoek scheuten met zes tot acht blaadjes.",
      "Tel vanaf de tak twee blaadjes en knip er net boven, met een schone, scherpe schaar.",
      "Knip de top korter dan de onderste takken. Onderaan mag {hij} langer doorgroeien.",
      "Er komt wit sap uit de wonde. Afdeppen en handen wassen.",
    ],
    note: "Dikke takken wegnemen doe je alleen tussen april en juni.",
  },
  foto: {
    title: "Zo maak je de maandfoto",
    when: "Eén keer per maand.",
    steps: [
      "Kies één vaste plek en één hoek, en houd die aan.",
      "Daglicht, geen flits.",
      "Een effen muur erachter toont de vorm het best.",
    ],
    note: "Stuur ze daarna ook naar Vic en Julie, ze zijn benieuwd!",
  },
  stof: {
    title: "Zo stof je af",
    when: "Ongeveer elke maand.",
    steps: [
      "Leg je hand onder het blad en veeg met een vochtige doek.",
      "Of zet de schaal in de douche: lauw water, zachte straal, een halve minuut.",
      "Laat {hem} uitlekken voor {hij} terug op {zijn} plek gaat.",
    ],
    note: "Geen bladglans gebruiken.",
  },
  verpot: {
    title: "Zo verpot je",
    when: "Om de twee jaar, tussen april en juni. De eerste keer in het voorjaar van 2027.",
    steps: [
      "Leg klaar: bonsaigrond (akadama of een luchtige bonsaimix), een schaar en een houten stokje.",
      "Til de boom uit de schaal en peuter met het stokje de oude grond tussen de wortels uit.",
      "Knip tot een derde van de wortels weg, vooral de lange.",
      "Laagje verse grond in de schaal, boom erop, opvullen. Duw de grond met het stokje tussen de wortels.",
      "Grondig gieten. Daarna een maand geen mest en niet snoeien.",
    ],
    note: "Niet in de winter en niet als {hij} ziek is. Gewone potgrond houdt te veel water vast.",
  },
};

// De tegels onder "Hoe doe je het": [tip, kanji, label].
export const HOW_TILES = [
  ["water", "水", "Gieten"], ["mest", "肥", "Bemesten"],
  ["snoei", "剪", "Snoeien"], ["verpot", "鉢", "Verpotten"],
  ["plaag", "虫", "Blad nakijken"], ["licht", "光", "Draaien"],
  ["stof", "葉", "Afstoffen"], ["foto", "写", "Maandfoto"],
];

// "Er scheelt iets": wat ze zien, wat het is, wat ze doen. harmless = niets aan de hand.
export const SYMPTOMS = [
  {
    see: "Er valt plots veel blad",
    cause: "Verhuisd, kou gehad, tocht of minder licht dan voordien.",
    fix: "Laat {hem} staan op de lichtste plek. Gewoon blijven gieten, geen mest. Nieuw blad volgt meestal binnen enkele weken.",
  },
  {
    see: "De onderste blaadjes worden geel",
    cause: "Te nat, vaak samen met te weinig licht.",
    fix: "Laat de bovenlaag opdrogen voor je weer giet. Schoteltje leeg. Zet {hem} dichter bij het raam.",
  },
  {
    see: "Bruine, krullende bladranden",
    cause: "De kluit is te droog geweest, de lucht is te droog door de verwarming, of er scheen felle zon door het glas.",
    fix: "Zet de schaal tien minuten in lauw water. Weg van de radiator. Een bord met natte kleikorrels eronder helpt.",
  },
  {
    see: "Fijn spinsel, dof gespikkeld blad",
    cause: "Spint. Kleine mijten die van warme, droge lucht houden.",
    fix: "Afdouchen met lauw water, ook de onderkant van het blad. Elke week opnieuw tot het weg is.",
  },
  {
    see: "Kleverig blad, bruine bolletjes op de takjes",
    cause: "Schildluis.",
    fix: "Wrijf de bolletjes weg met een wattenstaafje en was het blad af. Blijven ze terugkomen, haal dan een middel tegen schildluis op kamerplanten.",
  },
  {
    see: "Wit pluis in de oksels",
    cause: "Wolluis.",
    fix: "Wegvegen met een vochtig wattenstaafje. Zet {hem} apart van andere planten en kijk om de paar dagen opnieuw.",
  },
  {
    see: "De grond blijft nat en ruikt muf",
    cause: "Wortelrot. Het water kan niet weg.",
    fix: "Stop met gieten. Haal {hem} uit de schaal, knip bruine, papperige wortels weg en zet {hem} in verse, luchtige bonsaigrond.",
  },
  {
    see: "Lange, slappe scheuten met weinig blad",
    cause: "Te weinig licht. {Hij} rekt zich uit naar het raam.",
    fix: "Dichter bij het raam. Knip de scheuten daarna terug tot twee blaadjes.",
  },
  {
    see: "Witte spikkels op de stam",
    cause: "Dat zijn ademporiën in de schors. Ze horen bij deze soort.",
    fix: "Laten zitten. Niet afschrobben.",
    harmless: true,
  },
  {
    see: "Wit sap bij het knippen",
    cause: "Elke ficus bloedt melksap uit een wonde.",
    fix: "Afdeppen met een vochtig doekje en handen wassen. Het sap irriteert de huid en is giftig voor kat en hond.",
    harmless: true,
  },
];

// De brief op het welkomstscherm.
export const LETTER = {
  greeting: "Dag Wouter en Nona.",
  body: [
    "Proficiat met jullie eigen stekje en nu we (eindelijk) de housewarming mogen meemaken, schenken we jullie een extra leven in jullie huisje: jullie eigen bonsai!",
    "Gebruik deze app om hem/haar een naam te geven en vanaf dan de perfecte verzorging te bieden. Hou ons ook op de hoogte aub, en succes met jullie nieuwe aanwinst!",
  ],
  closing: "Groetjes,",
  from: "Julie en Vic",
};
