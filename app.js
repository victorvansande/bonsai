// Bonsai-almanak. Eén pagina, geen framework, geen build.
//
// Opbouw van dit bestand:
//   1. datums            kalenderdagen als "JJJJ-MM-DD", in lokale tijd
//   2. opslag            localStorage, met een tweede kopie in IndexedDB
//   3. planning          wanneer is welke taak aan de beurt
//   4. foto's            verkleinen, bewaren, delen
//   5. reservecode       de hele stand als één regel tekst
//   6. schermen          functies die HTML teruggeven
//   7. bediening         één klik-luisteraar, acties per data-action

import {
  MONTHS, MONTHS_SHORT, DAYS_SHORT, PRONOUNS, TASKS, MONTH_NOTES, REPOT_NOTE,
  FIRST_REPOT_YEAR, SEKKI, TIPS, HOW_TILES, SYMPTOMS, LETTER,
} from "./content.js";

// Met ?test achter het adres werkt de app op een aparte set gegevens.
const TEST = new URLSearchParams(location.search).has("test");
const KEY = TEST ? "bonsai-almanak-test" : "bonsai-almanak";

const SETTLE_DAYS = 28;       // wenperiode na aankomst
const LOG_LIMIT = 400;        // ruim een jaar aan regels
const CODE_LOG_LIMIT = 60;    // de reservecode moet in een bericht passen
const PHOTO_MAX_SIDE = 1280;
const TABS = ["vandaag", "kalender", "hulp", "logboek"];
const TASK = new Map(TASKS.map((task) => [task.id, task]));

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);


// ---------------------------------------------------------------- 1. datums

const pad = (n) => String(n).padStart(2, "0");
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// Middaguur, zodat een zomeruurwissel nooit een dag opschuift.
const fromIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (iso, days) => { const date = fromIso(iso); date.setDate(date.getDate() + days); return toIso(date); };
const daysBetween = (later, earlier) => Math.round((fromIso(later) - fromIso(earlier)) / 864e5);
const monthOf = (iso) => Number(iso.slice(5, 7)) - 1;
const isIso = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const shortDate = (iso) => { const d = fromIso(iso); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
const capital = (word) => word[0].toUpperCase() + word.slice(1);

let today = toIso(new Date());

function relativeDay(days) {
  if (days < -1) return `${-days} dagen te laat`;
  if (days === -1) return "sinds gisteren";
  if (days === 0) return "vandaag";
  if (days === 1) return "morgen";
  return `over ${days} dagen`;
}

function currentSekki() {
  const d = fromIso(today);
  const key = (d.getMonth() + 1) * 100 + d.getDate();
  // Voor 5 januari loopt de winterzonnewende van december nog door.
  return SEKKI.findLast(([month, day]) => month * 100 + day <= key) ?? SEKKI.at(-1);
}


// ---------------------------------------------------------------- 2. opslag

// state is null tot de bonsai een naam heeft. Vorm:
//   { name, gender: "m"|"v"|"x", since: iso,
//     done: { [taak]: { d: iso, n?: dagen tot de volgende beurt } },
//     log:  [ { t: taak, d: iso, s: 1 als overgeslagen } ], nieuwste eerst }
let state = null;
let storageWorks = true;

const cleanName = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 24) : "");

// Alles wat uit opslag of uit een reservecode komt, gaat hierdoor.
function sanitise(raw) {
  const name = cleanName(raw?.name);
  if (!name) return null;
  const clean = {
    name,
    gender: Object.hasOwn(PRONOUNS, raw.gender) ? raw.gender : "m",
    since: isIso(raw.since) ? raw.since : today,
    done: {},
    log: [],
  };
  for (const { id } of TASKS) {
    const entry = raw.done?.[id];
    if (!entry || !isIso(entry.d)) continue;
    clean.done[id] = { d: entry.d };
    if (Number.isInteger(entry.n) && entry.n > 0 && entry.n < 60) clean.done[id].n = entry.n;
  }
  if (Array.isArray(raw.log)) {
    for (const entry of raw.log.slice(0, LOG_LIMIT)) {
      if (entry && TASK.has(entry.t) && isIso(entry.d)) clean.log.push({ t: entry.t, d: entry.d, s: entry.s ? 1 : 0 });
    }
  }
  return clean;
}

const local = {
  // Schrijft een proefwaarde en leest ze terug, zonder de echte gegevens aan te raken.
  works() {
    try {
      localStorage.setItem(`${KEY}-proef`, "1");
      const ok = localStorage.getItem(`${KEY}-proef`) === "1";
      localStorage.removeItem(`${KEY}-proef`);
      return ok;
    } catch { return false; }
  },
  read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  },
  // Leest terug wat er geschreven is: in een privévenster lukt schrijven soms "stil" niet.
  write(value) {
    try {
      const text = JSON.stringify(value);
      localStorage.setItem(KEY, text);
      return localStorage.getItem(KEY) === text;
    } catch { return false; }
  },
};

// IndexedDB: winkel "kv" houdt een tweede kopie van de stand, "photos" de foto's.
let dbPromise;
function openDb() {
  dbPromise ??= new Promise((resolve) => {
    const giveUp = setTimeout(() => resolve(null), 2000);
    const done = (db) => { clearTimeout(giveUp); resolve(db); };
    try {
      const request = indexedDB.open("bonsai-almanak", 2);
      request.onupgradeneeded = () => {
        for (const name of ["kv", "photos"]) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => done(request.result);
      request.onerror = () => done(null);
    } catch { done(null); }
  });
  return dbPromise;
}

// Voert één transactie uit. `work` krijgt de winkel en mag een functie teruggeven
// die het resultaat uitleest zodra de transactie rond is. Mislukt er iets: undefined.
async function withStore(name, mode, work) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(name, mode);
      const read = work(tx.objectStore(name));
      tx.oncomplete = () => resolve(read ? read() : true);
      tx.onerror = tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

function save() {
  storageWorks = local.write(state);
  withStore("kv", "readwrite", (store) => { store.put(state, KEY); });
}

async function loadState() {
  const fromLocal = sanitise(local.read());
  if (fromLocal) return fromLocal;
  // localStorage leeg: misschien staat de tweede kopie er nog.
  const mirror = await withStore("kv", "readonly", (store) => {
    const request = store.get(KEY);
    return () => request.result;
  });
  const restored = sanitise(mirror);
  if (restored) local.write(restored);
  return restored;
}

// Vraagt de browser om deze opslag niet op te ruimen bij plaatsgebrek.
function askToKeepStorage() {
  navigator.storage?.persist?.().catch(() => {});
}


// -------------------------------------------------------------- 3. planning

function dueDate(task) {
  const last = state.done[task.id];
  if (!last) return addDays(state.since, task.first);
  return addDays(last.d, last.n ?? task.every(monthOf(last.d)));
}

// Alle taken met het aantal dagen tot ze aan de beurt zijn, dringendste eerst.
function agenda() {
  return TASKS
    .map((task) => ({ task, days: daysBetween(dueDate(task), today) }))
    .sort((a, b) => a.days - b.days);
}

// Wat staat er per dag in een maand: verleden uit het logboek, toekomst vooruitgerekend.
function monthPlan(year, month) {
  const first = toIso(new Date(year, month, 1, 12));
  const last = toIso(new Date(year, month + 1, 0, 12));
  const plan = new Map();
  const mark = (iso, kanji) => {
    const list = plan.get(iso) ?? [];
    if (!list.includes(kanji)) plan.set(iso, [...list, kanji]);
  };

  for (const entry of state.log) {
    if (!entry.s && entry.d >= first && entry.d <= last && entry.d < today) mark(entry.d, TASK.get(entry.t).kanji);
  }
  if (last >= today) {
    for (const task of TASKS) {
      let iso = dueDate(task);
      if (iso < today) iso = today;
      while (iso <= last) {
        if (iso >= first) mark(iso, task.kanji);
        iso = addDays(iso, task.every(monthOf(iso)));
      }
    }
  }
  return plan;
}

// Onthoudt de laatste afgevinkte taak zolang de melding in beeld staat.
let undoable = null;

function complete(id, { skipped = false } = {}) {
  const task = TASK.get(id);
  undoable = { id, previous: state.done[id] };
  const entry = { d: today };
  if (skipped && task.recheck) entry.n = task.recheck(monthOf(today));
  state.done[id] = entry;
  state.log.unshift({ t: id, d: today, s: skipped ? 1 : 0 });
  state.log.length = Math.min(state.log.length, LOG_LIMIT);
  save();
  return daysBetween(dueDate(task), today);
}

function undoLast() {
  if (!undoable) return;
  if (undoable.previous) state.done[undoable.id] = undoable.previous;
  else delete state.done[undoable.id];
  state.log.shift();
  undoable = null;
  save();
}


// ----------------------------------------------------------------- 4. foto's

// [{ key: "JJJJ-MM-DDTuummss", url: "data:image/jpeg;base64,..." }], nieuwste eerst.
let photos = [];
const photoStoreKey = (key) => `${KEY}:${key}`;
const isJpegUrl = (value) => typeof value === "string" && value.startsWith("data:image/jpeg;base64,");

async function loadPhotos() {
  const rows = await withStore("photos", "readonly", (store) => {
    const keys = store.getAllKeys();
    const values = store.getAll();
    return () => keys.result.map((key, i) => [String(key), values.result[i]]);
  });
  const prefix = `${KEY}:`;
  return (rows ?? [])
    .filter(([key, url]) => key.startsWith(prefix) && isJpegUrl(url))
    .map(([key, url]) => ({ key: key.slice(prefix.length), url }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

// Verkleint een gekozen foto tot een JPEG van hooguit PHOTO_MAX_SIDE breed of hoog.
function shrink(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const finish = (result) => { URL.revokeObjectURL(objectUrl); resolve(result); };
    image.onload = () => {
      try {
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.8));
      } catch { finish(null); }
    };
    image.onerror = () => finish(null);
    image.src = objectUrl;
  });
}

async function addPhoto(file) {
  const url = await shrink(file);
  if (!url) return { error: "Die foto kon niet gelezen worden." };
  const now = new Date();
  const key = `${today}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const stored = await withStore("photos", "readwrite", (store) => { store.put(url, photoStoreKey(key)); });
  if (!stored) return { error: "Bewaren lukte niet. Is de opslag van de telefoon vol?" };
  const photo = { key, url };
  photos.unshift(photo);
  return { photo };
}

async function removePhoto(key) {
  await withStore("photos", "readwrite", (store) => { store.delete(photoStoreKey(key)); });
  photos = photos.filter((photo) => photo.key !== key);
}

function photoFile(photo) {
  const bytes = Uint8Array.from(atob(photo.url.split(",")[1]), (c) => c.charCodeAt(0));
  const slug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bonsai";
  return new File([bytes], `${slug}-${photo.key.slice(0, 10)}.jpg`, { type: "image/jpeg" });
}

// Deelt via het deelmenu van de telefoon; lukt dat niet, dan als gewone download.
// Geeft de zin terug die onder het fotodagboek komt te staan.
async function sendPhotos(list) {
  const files = list.map(photoFile);
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: state.name });
      return "Verstuurd of bewaard.";
    } catch (error) {
      if (error.name === "AbortError") return "";
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await sleep(300);
  }
  return files.length === 1 ? "Foto gedownload." : `${files.length} foto's gedownload.`;
}


// ------------------------------------------------------------ 5. reservecode

const CODE_PREFIX = "BONSAI1.";

function encodeBackup() {
  const json = JSON.stringify({ ...state, log: state.log.slice(0, CODE_LOG_LIMIT) });
  const binary = String.fromCharCode(...new TextEncoder().encode(json));
  return CODE_PREFIX + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBackup(text) {
  const match = /BONSAI1\.([A-Za-z0-9_-]+)/.exec(String(text).replace(/\s+/g, ""));
  if (!match) return null;
  try {
    const binary = atob(match[1].replaceAll("-", "+").replaceAll("_", "/"));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return sanitise(JSON.parse(json));
  } catch { return null; }
}


// --------------------------------------------------------------- 6. schermen

const ui = {
  tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "vandaag",
  step: "letter",              // welkom: letter -> name -> confirm
  draft: { name: "", gender: null },
  calendar: { year: fromIso(today).getFullYear(), month: fromIso(today).getMonth(), selected: today },
  openSymptom: -1,
  sheet: null,                 // { type, ...gegevens }
  photoForTask: false,
  deleteArmed: false,
  photoNote: "",
  backupNote: "",
  installPrompt: null,
};

const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const inChatApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|MicroMessenger|Line\/|Snapchat|TikTok|LinkedInApp/i.test(navigator.userAgent);
const iosSafariTab = navigator.standalone === false && !inChatApp;

// Vult {hij}, {hem}, {zijn} in. Een hoofdletter in de sleutel geeft een hoofdletter terug.
function say(text) {
  const words = PRONOUNS[state?.gender ?? "m"];
  return text.replace(/\{(\w+)\}/g, (whole, key) => {
    const word = words[key.toLowerCase()];
    if (!word) return whole;
    return key[0] === key[0].toUpperCase() ? capital(word) : word;
  });
}

const kanji = (char, cls = "jp") => `<span class="${cls}" lang="ja" aria-hidden="true">${char}</span>`;

const WARNINGS = {
  noStorage: `<p class="warn">Deze browser onthoudt niets. Waarschijnlijk een privévenster. Open de app in een gewoon venster.</p>`,
  chatApp: `<div class="tip"><b>Dit is de browser van een chat-app.</b>Die vergeet sneller en kan niets op het beginscherm zetten. Tik op ··· en kies "Openen in Safari" of "Openen in Chrome".</div>`,
  iosTab: `<div class="tip"><b>Eerst op het beginscherm zetten.</b>Tik op Deel en dan op "Zet op beginscherm". Open de app vanaf daar en kies dan pas de naam. De app op het beginscherm heeft een eigen geheugen, los van Safari.</div>`,
};

function viewWelcome() {
  if (ui.step === "letter") {
    return `
      ${kanji("祝", "big")}
      <div class="letter">
        <h1>${LETTER.greeting}</h1>
        ${LETTER.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        <p class="sig">${LETTER.closing}<br><strong>${LETTER.from}</strong></p>
        <button class="btn primary" data-action="to-name">Geef een naam</button>
      </div>`;
  }

  if (ui.step === "confirm") {
    const { name, gender } = ui.draft;
    const kind = gender === "x" ? "" : `Een ${PRONOUNS[gender].label}, voor altijd.`;
    return `
      ${kanji("命名", "big")}
      <div class="sure">
        <div class="q1">${esc(name)}.</div>
        <div class="q2">${kind || "Voor altijd."} Zeker?</div>
        <button class="btn primary" data-action="name-yes">Ja, ${esc(name)}</button>
        <button class="btn quiet" data-action="name-back">Wacht, toch niet</button>
      </div>`;
  }

  const genderButtons = Object.entries(PRONOUNS).map(([value, { label }]) =>
    `<button type="button" data-action="gender" data-value="${value}" aria-pressed="${ui.draft.gender === value}">${label}</button>`).join("");
  return `
    ${kanji("命名", "big")}
    <h1>Hoe gaat jullie bonsai heten?</h1>
    ${storageWorks ? "" : WARNINGS.noStorage}
    ${inChatApp ? WARNINGS.chatApp : ""}
    ${iosSafariTab ? WARNINGS.iosTab : ""}
    <form id="name-form" autocomplete="off" novalidate>
      <label class="sr-only" for="name-input">Naam van de bonsai</label>
      <input id="name-input" type="text" maxlength="24" enterkeyhint="done" autocapitalize="words" value="${esc(ui.draft.name)}">
      <div class="field-label" id="gender-label">Een hij of een zij?</div>
      <div class="segmented" role="group" aria-labelledby="gender-label">${genderButtons}</div>
      <button class="btn primary" type="submit">Dat wordt het</button>
      <p class="hint" id="name-hint">Denk even na. Wijzigen kan achteraf niet meer.</p>
    </form>
    ${ui.installPrompt && !standalone ? `<button class="btn quiet" data-action="install">Zet op het beginscherm</button>` : ""}
    <button class="link" data-action="restore">We hebben al een reservecode</button>`;
}

const TREE = `
  <svg class="tree" viewBox="0 0 120 130" aria-hidden="true">
    <g class="crown">
      <path d="M60 104C38 96 40 78 60 73S84 54 62 44" fill="none" stroke="var(--bark)" stroke-width="8" stroke-linecap="round"/>
      <path d="M52 78C42 72 36 66 30 62" fill="none" stroke="var(--bark)" stroke-width="3.5" stroke-linecap="round"/>
      <g class="leaves">
        <ellipse cx="60" cy="30" rx="27" ry="17"/><ellipse cx="38" cy="42" rx="17" ry="11"/>
        <ellipse cx="84" cy="40" rx="18" ry="11"/><ellipse cx="62" cy="14" rx="15" ry="9"/>
        <ellipse cx="26" cy="60" rx="10" ry="6"/>
      </g>
    </g>
    <path d="M78 100l7-12 6 7 5-3 4 8z" fill="var(--ink-2)" opacity=".55"/>
    <path d="M22 100h76c0 14-9 22-22 22H44c-13 0-22-8-22-22z" fill="var(--pot)"/>
    <rect x="18" y="97" width="84" height="7" rx="3.5" fill="var(--pot)"/>
  </svg>`;

function viewToday() {
  const list = agenda();
  const due = list.filter((item) => item.days <= 0);
  const later = list.filter((item) => item.days > 0);
  const month = monthOf(today);
  const year = fromIso(today).getFullYear();
  const [, , sekkiName, sekkiMeaning] = currentSekki();

  const waiting = due.length > 0 && due[0].days <= -2;
  let mood = "Heeft niets nodig. Laat {hem} maar doen.";
  if (waiting) mood = "Wacht al even op jullie.";
  else if (due.length === 1) mood = "Vraagt één ding vandaag.";
  else if (due.length > 1) mood = `Vraagt ${due.length} dingen vandaag.`;

  const daysHere = daysBetween(today, state.since);
  const settling = daysHere < SETTLE_DAYS ? `
    <div class="settle">
      <div><b>Dag ${daysHere + 1} bij jullie.</b> ${say(`{Hij} moet nog ${SETTLE_DAYS - daysHere} dagen wennen. Laat {hem} staan waar {hij} staat.`)} Niet verpotten, niet mesten, niet snoeien. Een paar blaadjes verliezen hoort erbij.</div>
      <div class="bar"><i style="width:${Math.max(4, Math.round((daysHere / SETTLE_DAYS) * 100))}%"></i></div>
    </div>` : "";

  const cards = due.map(({ task, days }) => `
    <article class="card" data-card="${task.id}">
      <div class="mark" lang="ja" aria-hidden="true">${task.kanji}</div>
      <div>
        <h3>${task.name}</h3>
        <div class="when">${relativeDay(days)}</div>
      </div>
      <button class="tip-button" data-action="tip" data-id="${task.id}" aria-label="Tip bij ${task.name.toLowerCase()}">Tip?</button>
      <p>${say(task.sub(month))}</p>
      <div class="actions">
        <button class="btn primary" data-action="done" data-id="${task.id}">${task.doneLabel ?? "Gedaan"}</button>
        <button class="btn quiet" data-action="skip" data-id="${task.id}">${task.skipLabel ?? "Sla over"}</button>
      </div>
    </article>`).join("");

  const rest = `
    <div class="rest">
      <b>Vrij vandaag, Wouter en Nona.</b>
      ${later.length ? `Eerstvolgende: ${later[0].task.name.toLowerCase()}, ${relativeDay(later[0].days)}.` : ""}
    </div>`;

  const chips = later.map(({ task, days }) => `
    <button class="chip" data-action="open-task" data-id="${task.id}">
      ${kanji(task.kanji)}<strong>${task.name}</strong><span>${relativeDay(days)}</span>
    </button>`).join("");

  let note = MONTH_NOTES[month];
  const repotYear = year >= FIRST_REPOT_YEAR && (year - FIRST_REPOT_YEAR) % 2 === 0;
  if (repotYear && (month === 3 || month === 4)) note += REPOT_NOTE;

  return `
    <header class="head">
      <div>
        <div class="meta"><span>${shortDate(today)}</span><span>${kanji(sekkiName)} ${sekkiMeaning}</span></div>
        <h1 class="name">${esc(state.name)}</h1>
        <p class="mood">${say(mood)}</p>
      </div>
      <div class="${waiting ? "tree-wrap waiting" : "tree-wrap"}">${TREE}</div>
    </header>
    ${storageWorks ? "" : WARNINGS.noStorage}
    ${inChatApp ? WARNINGS.chatApp : ""}
    ${settling}
    <section class="stack">
      <h2>Nu <span>${due.length || ""}</span></h2>
      <div class="stack">${cards || rest}</div>
    </section>
    ${later.length ? `<section class="stack"><h2>Straks</h2><div class="strip">${chips}</div></section>` : ""}
    <p class="note"><b>${capital(MONTHS[month])}.</b> ${say(note)}</p>`;
}

function viewCalendar() {
  const { year, month, selected } = ui.calendar;
  const plan = monthPlan(year, month);
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;   // week begint op maandag
  const dayCount = new Date(year, month + 1, 0).getDate();

  let cells = ["ma", "di", "wo", "do", "vr", "za", "zo"].map((d) => `<div class="weekday">${d}</div>`).join("");
  cells += `<div class="cell empty"></div>`.repeat(leading);
  for (let day = 1; day <= dayCount; day++) {
    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    const classes = ["cell", iso < today && "past", iso === today && "today", iso === selected && "selected"].filter(Boolean).join(" ");
    const marks = (plan.get(iso) ?? []).slice(0, 3).join("");
    cells += `<button class="${classes}" data-action="day" data-date="${iso}"><span class="day-number">${day}</span><span class="marks" lang="ja">${marks}</span></button>`;
  }

  let detail = "Tik op een dag.";
  if (selected.startsWith(`${year}-${pad(month + 1)}`)) {
    const names = (plan.get(selected) ?? []).map((char) => TASKS.find((task) => task.kanji === char).name.toLowerCase());
    const past = selected < today;
    if (names.length) detail = `${past ? "Gedaan: " : ""}${names.join(", ")}.`;
    else detail = past ? "Niets genoteerd." : "Niets te doen.";
    detail = `<b>${shortDate(selected)}.</b> ${detail}`;
  }

  return `
    <header class="title-row">
      <h1>${MONTHS[month]} ${year}</h1>
      <div class="month-nav">
        <button data-action="month" data-step="-1" aria-label="Vorige maand">‹</button>
        <button data-action="month" data-step="1" aria-label="Volgende maand">›</button>
      </div>
    </header>
    <div class="calendar">${cells}</div>
    <div class="day-detail">${detail}</div>
    <div class="legend">${TASKS.map((task) => `<span>${kanji(task.kanji)}${task.name.toLowerCase()}</span>`).join("")}</div>`;
}

function viewHelp() {
  const tiles = HOW_TILES.map(([id, char, label]) =>
    `<button class="how" data-action="tip" data-id="${id}">${kanji(char)}${label}</button>`).join("");

  const symptoms = SYMPTOMS.map((symptom, i) => `
    <button class="symptom${symptom.harmless ? " harmless" : ""}" data-action="symptom" data-index="${i}" aria-expanded="${i === ui.openSymptom}">
      <span class="symptom-head"><span>${symptom.see}</span><i aria-hidden="true">+</i></span>
      <span class="symptom-body">
        <b>${symptom.harmless ? "Niets aan de hand" : "Wat het is"}</b><span>${say(symptom.cause)}</span>
        <b>Wat jullie doen</b><span>${say(symptom.fix)}</span>
      </span>
    </button>`).join("");

  return `
    <header class="title-row"><h1>Hulp</h1></header>
    <section class="stack"><h2>Hoe doe je het</h2><div class="hows">${tiles}</div></section>
    <section class="stack">
      <h2>Er scheelt iets</h2>
      <p class="lede">Tik aan wat jullie zien.</p>
      <div class="stack">${symptoms}</div>
    </section>
    <p class="note">Komen jullie er niet uit? Stuur Vic en Julie een foto.</p>`;
}

function viewLog() {
  const daysHere = daysBetween(today, state.since);
  const since = `Bij Wouter en Nona sinds ${shortDate(state.since)}.${daysHere > 0 ? ` Dat is ${daysHere} ${daysHere === 1 ? "dag" : "dagen"}.` : ""}`;

  const shots = photos.map((photo) => `
    <button class="shot" data-action="photo" data-key="${photo.key}">
      <img alt="Foto van ${shortDate(photo.key.slice(0, 10))}" src="${photo.url}"><span>${shortDate(photo.key.slice(0, 10))}</span>
    </button>`).join("");
  const photoNote = ui.photoNote || (photos.length
    ? "De foto's staan alleen op deze telefoon en zitten niet in de reservecode. Exporteer ze af en toe."
    : "Eén foto per maand. De app vraagt erom.");

  const rows = state.log.slice(0, 12).map((entry) => {
    const task = TASK.get(entry.t);
    const text = entry.s ? (task.logSkip ?? `${task.name} <em>overgeslagen</em>`) : (task.logDone ?? task.name);
    return `<li>${kanji(task.kanji)}<span>${text}</span><time datetime="${entry.d}">${shortDate(entry.d)}</time></li>`;
  }).join("");

  return `
    <header class="plate">
      <h1>${esc(state.name)}</h1>
      <p>${since}</p>
    </header>
    <section class="stack">
      <h2>Fotodagboek <span>${photos.length || ""}</span></h2>
      <div class="shots">
        <button class="shot add" data-action="add-photo">${kanji("写")}Foto erbij</button>
        ${shots}
      </div>
      ${photos.length ? `<button class="btn quiet" data-action="export">Exporteer alle foto's</button>` : ""}
      <p class="fine">${esc(photoNote)}</p>
    </section>
    <section class="stack">
      <h2>Laatst gedaan</h2>
      <ul class="log">${rows || `<li class="empty">Nog leeg. De eerste beurt staat klaar bij Vandaag.</li>`}</ul>
    </section>
    <section class="backup">
      <b>Reservecode</b>
      <span>Alles staat op deze telefoon. Stuur de code af en toe naar elkaar. Raakt de telefoon ${esc(state.name)} kwijt, of wil de ander dezelfde stand, dan zet de code alles terug.</span>
      <div class="actions even">
        <button class="btn primary" data-action="copy">Kopieer code</button>
        <button class="btn quiet" data-action="restore">Code invoeren</button>
      </div>
      ${ui.backupNote ? `<span class="ok">${esc(ui.backupNote)}</span>` : ""}
    </section>
    ${ui.installPrompt && !standalone ? `<button class="btn quiet" data-action="install">Zet op het beginscherm</button>` : ""}`;
}

function viewSheet() {
  const sheet = ui.sheet;
  if (!sheet) return "";
  const wrap = (label, body) => `
    <div class="veil" data-action="close-veil">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <div class="grabber"></div>${body}
      </div>
    </div>`;
  const close = `<div class="actions single"><button class="btn quiet" data-action="close">Sluiten</button></div>`;

  if (sheet.type === "task") {
    const task = TASK.get(sheet.id);
    const days = daysBetween(dueDate(task), today);
    return wrap(task.name, `
      <div class="sheet-head">
        <div class="mark plain" lang="ja" aria-hidden="true">${task.kanji}</div>
        <div><h3>${task.name}</h3><div class="sheet-sub">${relativeDay(days)}, ${shortDate(addDays(today, days))}</div></div>
      </div>
      <p>${say(task.sub(monthOf(today)))}</p>
      <div class="actions">
        <button class="btn primary" data-action="done" data-id="${task.id}">Nu al gedaan</button>
        <button class="btn quiet" data-action="tip" data-id="${task.id}">Tip?</button>
      </div>${close}`);
  }

  if (sheet.type === "tip") {
    const tip = TIPS[sheet.id];
    return wrap(tip.title, `
      <h3>${tip.title}</h3>
      <div class="sheet-sub">${say(tip.when)}</div>
      <ol class="steps">${tip.steps.map((step) => `<li><span>${say(step)}</span></li>`).join("")}</ol>
      ${tip.note ? `<div class="aside">${say(tip.note)}</div>` : ""}${close}`);
  }

  if (sheet.type === "photo" || sheet.type === "photo-saved") {
    const photo = photos.find((item) => item.key === sheet.key);
    if (!photo) return "";
    const date = `${shortDate(photo.key.slice(0, 10))} ${photo.key.slice(0, 4)}`;
    if (sheet.type === "photo-saved") {
      return wrap("Foto bewaard", `
        <h3>Foto bewaard.</h3>
        <div class="sheet-sub">Stuur ook een update naar Vic en Julie, ze zijn benieuwd!</div>
        <img class="full" alt="De foto van ${date}" src="${photo.url}">
        <div class="actions">
          <button class="btn primary" data-action="share-photo">Doorsturen</button>
          <button class="btn quiet" data-action="close">Later</button>
        </div>`);
    }
    return wrap("Foto", `
      <h3>${date}</h3>
      <img class="full" alt="De foto van ${date}" src="${photo.url}">
      <div class="actions">
        <button class="btn primary" data-action="share-photo">Delen of bewaren</button>
        <button class="btn quiet" data-action="delete-photo">${ui.deleteArmed ? "Zeker wissen?" : "Wissen"}</button>
      </div>${close}`);
  }

  if (sheet.type === "restore") {
    return wrap("Code invoeren", `
      <h3>Code invoeren</h3>
      <p>Plak hier de reservecode. Ze begint met BONSAI1.${state ? " Dit vervangt de stand op deze telefoon." : ""}</p>
      <textarea id="code-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Reservecode"></textarea>
      <p class="hint error" id="code-error"></p>
      <div class="actions">
        <button class="btn primary" data-action="do-restore">Terugzetten</button>
        <button class="btn quiet" data-action="close">Sluiten</button>
      </div>`);
  }

  if (sheet.type === "code") {
    return wrap("Reservecode", `
      <h3>Reservecode</h3>
      <p>Kopiëren lukte niet vanzelf. Houd de tekst ingedrukt en kies Kopieer.</p>
      <textarea readonly aria-label="Reservecode">${esc(encodeBackup())}</textarea>${close}`);
  }
  return "";
}

function render() {
  today = toIso(new Date());
  const named = Boolean(state);
  const view = $("view");
  $("tabs").hidden = !named;
  $("test-badge").hidden = !TEST;
  document.title = named ? `${state.name} · bonsai-almanak` : "Bonsai-almanak";

  if (!named) {
    view.className = "scroll welcome";
    view.innerHTML = viewWelcome();
    return;
  }

  view.className = "scroll";
  view.innerHTML = { vandaag: viewToday, kalender: viewCalendar, hulp: viewHelp, logboek: viewLog }[ui.tab]();
  for (const tab of document.querySelectorAll(".tab")) {
    if (tab.dataset.tab === ui.tab) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  $("tab-dot").hidden = ui.tab === "vandaag" || !agenda().some((item) => item.days <= 0);
}

function showSheet(sheet) {
  ui.sheet = sheet;
  ui.deleteArmed = false;
  $("sheet-root").innerHTML = viewSheet();
  $("sheet-root").querySelector("textarea:not([readonly]), .btn")?.focus({ preventScroll: true });
}

let toastTimer;
function notify(text, { undo = false } = {}) {
  clearTimeout(toastTimer);
  if (!undo) undoable = null;
  $("toast-root").innerHTML = `
    <div class="toast" role="status">
      <span>${esc(text)}</span>
      ${undo ? `<button data-action="undo">Ongedaan</button>` : ""}
    </div>`;
  toastTimer = setTimeout(clearToast, 5000);
}
function clearToast() {
  clearTimeout(toastTimer);
  undoable = null;
  $("toast-root").innerHTML = "";
}


// -------------------------------------------------------------- 7. bediening

function goTo(tab) {
  ui.tab = TABS.includes(tab) ? tab : "vandaag";
  if (location.hash.slice(1) !== ui.tab) {
    try { history.replaceState(null, "", `#${ui.tab}`); } catch { /* in een ingesloten venster mag dit niet */ }
  }
  render();
  $("view").scrollTop = 0;
}

let stamping = false;
async function finishTask(id, { skipped = false } = {}) {
  if (stamping) return;
  const task = TASK.get(id);
  const card = document.querySelector(`[data-card="${id}"]`);
  showSheet(null);
  navigator.vibrate?.(12);
  // De stempel: eerst laten zien, dan pas de kaart weghalen.
  if (card && !skipped && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stamping = true;
    card.insertAdjacentHTML("beforeend", `<div class="stamp"><span lang="ja">済</span></div>`);
    await sleep(600);
    stamping = false;
  }
  const days = complete(id, { skipped });
  render();
  const lead = skipped ? (task.skipLabel ? "Goed." : "Overgeslagen.") : "Genoteerd.";
  notify(`${lead} Volgende keer ${relativeDay(days)}.`, { undo: true });
}

function choosePhoto(forTask) {
  ui.photoForTask = forTask;
  showSheet(null);
  $("camera").click();
}

const actions = {
  tab: (el) => goTo(el.dataset.tab),

  // Vandaag
  done: (el) => (el.dataset.id === "foto" ? choosePhoto(true) : finishTask(el.dataset.id)),
  skip: (el) => finishTask(el.dataset.id, { skipped: true }),
  tip: (el) => showSheet({ type: "tip", id: el.dataset.id }),
  "open-task": (el) => showSheet({ type: "task", id: el.dataset.id }),
  undo: () => { undoLast(); clearToast(); render(); },

  // Kalender
  day: (el) => { ui.calendar.selected = el.dataset.date; render(); },
  month: (el) => {
    const moved = new Date(ui.calendar.year, ui.calendar.month + Number(el.dataset.step), 1);
    ui.calendar.year = moved.getFullYear();
    ui.calendar.month = moved.getMonth();
    render();
  },

  // Hulp
  symptom: (el) => {
    const index = Number(el.dataset.index);
    ui.openSymptom = ui.openSymptom === index ? -1 : index;
    render();
  },

  // Fotodagboek
  "add-photo": () => choosePhoto(false),
  photo: (el) => showSheet({ type: "photo", key: el.dataset.key }),
  "share-photo": async () => {
    const photo = photos.find((item) => item.key === ui.sheet?.key);
    if (!photo) return;
    const message = await sendPhotos([photo]);
    showSheet(null);
    if (message) notify(message);
  },
  "delete-photo": async () => {
    if (!ui.deleteArmed) {
      ui.deleteArmed = true;
      $("sheet-root").querySelector('[data-action="delete-photo"]').textContent = "Zeker wissen?";
      return;
    }
    await removePhoto(ui.sheet.key);
    ui.photoNote = "";
    showSheet(null);
    render();
  },
  export: async () => {
    ui.photoNote = await sendPhotos([...photos].reverse());
    render();
  },

  // Reservecode
  copy: async () => {
    try {
      await navigator.clipboard.writeText(encodeBackup());
      ui.backupNote = "Gekopieerd. Plak ze nu in een bericht aan elkaar.";
      render();
    } catch {
      showSheet({ type: "code" });
    }
  },
  restore: () => showSheet({ type: "restore" }),
  "do-restore": () => {
    const incoming = decodeBackup($("code-input").value);
    const error = $("code-error");
    if (!incoming) {
      error.textContent = "Die code klopt niet. Plak ze volledig, van BONSAI1 tot het einde.";
      return;
    }
    if (state && state.name !== incoming.name) {
      error.textContent = `Deze code hoort bij ${incoming.name}, niet bij ${state.name}.`;
      return;
    }
    state = incoming;
    save();
    askToKeepStorage();
    showSheet(null);
    render();
    notify(`${state.name} is terug.`);
  },

  // Welkom
  "to-name": () => { ui.step = "name"; render(); $("view").scrollTop = 0; },
  gender: (el) => {
    ui.draft.gender = el.dataset.value;
    for (const button of el.parentElement.children) button.setAttribute("aria-pressed", String(button === el));
  },
  "name-back": () => { ui.step = "name"; render(); },
  "name-yes": () => {
    state = { name: ui.draft.name, gender: ui.draft.gender, since: today, done: {}, log: [] };
    save();
    askToKeepStorage();
    render();
  },

  // Overal
  close: () => showSheet(null),
  "close-veil": (el, event) => { if (event.target === el) showSheet(null); },
  install: async () => {
    await ui.installPrompt?.prompt();
    ui.installPrompt = null;
    render();
  },
};

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (el) actions[el.dataset.action]?.(el, event);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "name-form") return;
  event.preventDefault();
  const name = cleanName($("name-input").value);
  const hint = $("name-hint");
  hint.className = "hint error";
  if (!name) { hint.textContent = "Eerst een naam typen."; $("name-input").focus(); return; }
  if (!ui.draft.gender) { hint.textContent = "Kies nog: hij, zij of geen van beide."; return; }
  ui.draft.name = name;
  ui.step = "confirm";
  render();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "name-input") ui.draft.name = event.target.value;
});

$("camera").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;
  const { photo, error } = await addPhoto(file);
  if (error) { notify(error); return; }
  ui.photoNote = "";
  if (ui.photoForTask) {
    complete("foto");
    undoable = null;
    render();
    showSheet({ type: "photo-saved", key: photo.key });
  } else {
    render();
    notify("Foto bewaard in het dagboek.");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ui.sheet) showSheet(null);
});

window.addEventListener("hashchange", () => {
  const tab = location.hash.slice(1);
  if (state && TABS.includes(tab) && tab !== ui.tab) goTo(tab);
});

// De app kan dagen open blijven staan op het beginscherm: reken opnieuw bij terugkeer.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state && toIso(new Date()) !== today) render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  ui.installPrompt = event;
  if (state || ui.step === "letter") render();
});

// Een app zoomt niet: knijpen, dubbeltikken en het selectiemenu staan uit.
for (const type of ["gesturestart", "gesturechange", "gestureend", "dblclick"]) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
document.addEventListener("touchmove", (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", (event) => { if (!event.target.closest("input, textarea")) event.preventDefault(); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function start() {
  storageWorks = local.works();
  [state, photos] = await Promise.all([loadState(), loadPhotos()]);
  if (state) askToKeepStorage();
  render();
}
start();
