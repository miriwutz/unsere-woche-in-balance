// FINAL LEER – saubere Ausgangsversion für den Online-Start.
// Lou, Fina, Familienfarben, Fächer und Funktionen bleiben erhalten.



// FINAL LEER: Beim allerersten Start dieser leeren Ausgabe werden nur Inhalts-/Testdaten entfernt.
// Danach werden neue Einträge ganz normal dauerhaft gespeichert.
(function prepareFinalCleanStart(){
  const cleanVersion = "final-leer-v1";
  const markerKey = "balanceProd.cleanStartVersion";
  if (localStorage.getItem(markerKey) === cleanVersion) return;

  [
    "balanceProd.videos",
    "balanceProd.todos",
    "balanceProd.archive",
    "balanceProd.school"
  ].forEach(key => localStorage.removeItem(key));

  localStorage.setItem(markerKey, cleanVersion);
})();

const days = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

const state = {
  videos: JSON.parse(localStorage.getItem("balanceProd.videos") || "[]"),
  todos: JSON.parse(localStorage.getItem("balanceProd.todos") || "[]"),
  archive: JSON.parse(localStorage.getItem("balanceProd.archive") || "[]")
};

let cloudReady = false;
let cloudApplying = false;
let cloudSaveTimer = null;
let cloudUnsubscribe = null;

function saveLocal() {
  localStorage.setItem("balanceProd.videos", JSON.stringify(state.videos));
  localStorage.setItem("balanceProd.todos", JSON.stringify(state.todos));
  localStorage.setItem("balanceProd.archive", JSON.stringify(state.archive));
  localStorage.setItem("balanceProd.school", JSON.stringify(state.school));
  localStorage.setItem("balanceProd.familySettings", JSON.stringify(state.familySettings));
  localStorage.setItem("balanceProd.schoolYear", state.settings?.schoolYear || "2026-27");
}

function cloudPayload() {
  // JSON round-trip removes values Firestore cannot store (e.g. undefined).
  return JSON.parse(JSON.stringify({
    videos: state.videos,
    todos: state.todos,
    archive: state.archive,
    school: state.school,
    familySettings: state.familySettings,
    settings: state.settings || {}
  }));
}

function scheduleCloudSave() {
  if (!cloudReady || cloudApplying || !firebase.auth().currentUser) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      const payload = cloudPayload();
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await firebase.firestore().collection("families").doc("shared").set(payload);
    } catch (err) {
      console.error("Firestore save failed:", err);
    }
  }, 300);
}

function save() {
  saveLocal();
  scheduleCloudSave();
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}


const defaultFamilySettings = {
  a:{name:"Mama", color:"#c8897e"},
  b:{name:"Papa", color:"#c84d4d"},
  c:{name:"Lou", color:"#8f78b8"},
  d:{name:"Fina", color:"#d58c9b"}
};

state.familySettings = (() => {
  try {
    return JSON.parse(localStorage.getItem("balanceProd.familySettings")) || structuredClone(defaultFamilySettings);
  } catch {
    return structuredClone(defaultFamilySettings);
  }
})();

["a","b","c","d"].forEach(key => {
  state.familySettings[key] = state.familySettings[key] || {...defaultFamilySettings[key]};
  state.familySettings[key].name = state.familySettings[key].name || defaultFamilySettings[key].name;
  state.familySettings[key].color = state.familySettings[key].color || defaultFamilySettings[key].color;
});

function familyName(key){
  return state.familySettings[key]?.name || defaultFamilySettings[key]?.name || "";
}

function familyColor(key){
  return state.familySettings[key]?.color || defaultFamilySettings[key]?.color || "#aaa29c";
}

function selectedFamilyMembers() {
  return [...document.querySelectorAll('#familyOptions input[type="checkbox"]:checked')].map(x => x.value);
}

function setSelectedFamilyMembers(members = []) {
  document.querySelectorAll('#familyOptions input[type="checkbox"]').forEach(input => {
    input.checked = members.includes(input.value);
  });
}

function familyBorderStyle(members = []) {
  const valid = [...new Set(members)].filter(m => state.familySettings[m]);
  if (!valid.length) return "";

  if (valid.length === 1) {
    const color = familyColor(valid[0]);
    return `--family-border:${color}; --family-gradient:linear-gradient(${color}, ${color});`;
  }

  // Gemeinsame Aufgaben: ein weicher Farbrahmen aus genau den beteiligten Personenfarben.
  // Dadurch entsteht ein kleiner persönlicher "Regenbogen", ohne zusätzliche Farben zu erfinden.
  const colors = valid.map(m => familyColor(m));
  const stops = colors.map((color, i) => {
    const pos = colors.length === 1 ? 0 : Math.round((i / (colors.length - 1)) * 100);
    return `${color} ${pos}%`;
  }).join(", ");

  return `--family-border:transparent; --family-gradient:linear-gradient(110deg, ${stops});`;
}

function escapeHtml(text="") {
  return String(text).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function motivationalMessage() {
  const messages = [
    "High Five für dich! 🙌",
    "Du warst heute ein echter Bewegungsheld!",
    "Deine Superkraft wächst mit jeder Bewegung.",
    "Heute hast du deinem Körper ein Lächeln geschenkt.",
    "Weiter geht's – mit Freude!",
    "Bewegung macht den Tag bunter.",
    "Du sammelst gerade Bewegungsschätze. ✨",
    "Das war richtig stark!",
    "Dein Körper und dein Kopf freuen sich gemeinsam.",
    "Jede Bewegung ist ein kleiner Erfolg. Danke, dass du so gut auf dich achtest. 💚",
    "Schön, dass du heute wieder dabei warst.",
    "Vielleicht fühlt sich dein Körper jetzt ein bisschen wohler.",
    "Nimm dieses gute Gefühl mit in deinen Tag.",
    "Du bist genau richtig – und Bewegung tut einfach gut.",
    "Heute hast du dir selbst etwas Gutes geschenkt.",
    "Mach weiter in deinem eigenen Tempo.",
    "Jeder Tag ist eine neue Gelegenheit, dich zu bewegen.",
    "Dein Körper begleitet dich jeden Tag – schön, wenn du ihn verwöhnst.",
    "Bis zum nächsten Bewegungsabenteuer! 🌟"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}


function todoMotivationalMessage() {
  const messages = [
    "🌸 Wunderbar – du hast diese Aufgabe geschafft.",
    "💛 Danke, dass du dir die Zeit dafür genommen hast.",
    "🌿 Richtig schön – diese Aufgabe ist erledigt.",
    "✨ Das hast du großartig gemacht.",
    "🌞 Danke, dass du drangeblieben bist.",
    "🌈 Wieder eine Aufgabe geschafft – klasse!",
    "🍀 Prima! Du bist einen Schritt weiter.",
    "🌼 Diese Aufgabe kannst du jetzt abhaken.",
    "🌻 Gut gemacht – dein Einsatz zählt.",
    "🦋 Das war eine schöne Leistung.",
    "🌿 Deine Mühe ist wertvoll.",
    "🌸 Jeder erledigte Schritt macht einen Unterschied.",
    "✨ Das war Zeit, die gut investiert war.",
    "🌞 Du kannst zufrieden auf diesen Moment schauen."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

let motivationTimer;

function showMotivation(message) {
  const toast = document.querySelector("#motivationToast");
  const text = document.querySelector("#motivationText");
  const icon = document.querySelector("#motivationIcon");
  if (!toast || !text || !icon) return;

  const icons = ["✨","🌿","⭐","🙌","💚"];
  clearTimeout(motivationTimer);

  icon.textContent = icons[Math.floor(Math.random() * icons.length)];
  text.textContent = message;
  toast.classList.add("show");

  motivationTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 7000);
}


// Offizielle schulfreie Zeiten Niederösterreich, Schuljahr 2026/27.
// Schulautonome Tage sind nicht enthalten, weil sie je Schule unterschiedlich sind.
const NOE_SCHOOL_YEARS = {
  "2026-27":{
    label:"2026/27",
    start:"2026-09-07",
    end:"2027-07-02",
    freeRanges:[
      ["2026-10-26","2026-10-31"],
      ["2026-11-01","2026-11-02"],
      ["2026-11-15","2026-11-15"],
      ["2026-12-08","2026-12-08"],
      ["2026-12-24","2027-01-06"],
      ["2027-02-01","2027-02-06"],
      ["2027-03-20","2027-03-29"],
      ["2027-05-01","2027-05-01"],
      ["2027-05-06","2027-05-06"],
      ["2027-05-15","2027-05-17"],
      ["2027-05-27","2027-05-27"]
    ]
  },
  "2027-28":{
    label:"2027/28", start:null, end:null, freeRanges:[]
  },
  "2028-29":{
    label:"2028/29", start:null, end:null, freeRanges:[]
  }
};

state.settings = state.settings || {};
state.settings.schoolYear = localStorage.getItem("balanceProd.schoolYear") || "2026-27";

function activeSchoolYear(){
  return NOE_SCHOOL_YEARS[state.settings.schoolYear] || NOE_SCHOOL_YEARS["2026-27"];
}

function parseLocalDate(key) {
  if (!key) return null;
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / ms);
}

function isDateInRange(dateKeyValue, startKey, endKey) {
  return dateKeyValue >= startKey && dateKeyValue <= endKey;
}

function isNoeSchoolFree(date) {
  const key = dateKey(date);
  return activeSchoolYear().freeRanges.some(([start,end]) =>
    isDateInRange(key, start, end)
  );
}

function weekdayNameForDate(date) {
  return days[(date.getDay() + 6) % 7];
}

function dateForWeekday(monday, dayName) {
  const idx = days.indexOf(dayName);
  if (idx < 0) return null;
  return dayDate(monday, idx);
}

function occurrenceKey(item, date) {
  return `${item.id}::${dateKey(date)}`;
}

function isOccurrenceDone(item, date) {
  if (item.recurrence && item.recurrence !== "none") {
    return Array.isArray(item.completedOccurrences) &&
      item.completedOccurrences.includes(dateKey(date));
  }
  return !!item.done;
}

function setOccurrenceDone(item, date, done) {
  if (item.recurrence && item.recurrence !== "none") {
    item.completedOccurrences = Array.isArray(item.completedOccurrences) ? item.completedOccurrences : [];
    const key = dateKey(date);
    const has = item.completedOccurrences.includes(key);

    if (done && !has) item.completedOccurrences.push(key);
    if (!done && has) item.completedOccurrences = item.completedOccurrences.filter(x => x !== key);
  } else {
    item.done = done;
  }
}

function itemAnchorDate(item) {
  if (item.type === "event" && item.date) return parseLocalDate(item.date);

  if (item.anchorDate) return parseLocalDate(item.anchorDate);

  if (item.weekKey && item.day) {
    const monday = parseLocalDate(item.weekKey);
    return dateForWeekday(monday, item.day);
  }

  return null;
}

function occursOnDate(item, date) {
  if (item.archived) return false;

  const key = dateKey(date);
  const recurrence = item.recurrence || "none";
  const anchor = itemAnchorDate(item);

  if (item.type === "event" && recurrence === "none") {
    return item.date === key;
  }

  if (item.type !== "event" && recurrence === "none") {
    return item.weekKey === dateKey(getMonday(date)) && item.day === weekdayNameForDate(date);
  }

  if (!anchor || date < anchor) return false;

  if (recurrence === "weekly") {
    return daysBetween(anchor, date) % 7 === 0;
  }

  if (recurrence === "biweekly") {
    return daysBetween(anchor, date) % 14 === 0;
  }

  if (recurrence === "monthly") {
    return date.getDate() === anchor.getDate();
  }

  if (recurrence === "schoolyear-noe") {
    const sy = activeSchoolYear();
    if (!sy.start || !sy.end) return false;
    if (key < sy.start || key > sy.end) return false;
    if (date.getDay() !== anchor.getDay()) return false;
    if (isNoeSchoolFree(date)) return false;
    return true;
  }

  return false;
}

function recurrenceLabel(value) {
  const labels = {
    none: "Einmalig",
    weekly: "Wöchentlich",
    biweekly: "Alle 2 Wochen",
    monthly: "Monatlich",
    "schoolyear-noe": "Schuljahr NÖ"
  };
  return labels[value || "none"];
}

function getMonday(date) {
  const d = new Date(date);
  d.setHours(12,0,0,0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function dayDate(monday, index) {
  const d = new Date(monday);
  d.setDate(monday.getDate() + index);
  return d;
}

function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./,"").replace(/^m\./,"");

    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (["shorts","embed","live"].includes(parts[0])) return parts[1] || null;
    }
  } catch (_) {
    const match = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : null;
  }
  return null;
}

function thumbnailFor(url) {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : "";
}

async function fetchYouTubeTitle(url) {
  if (!extractYouTubeId(url)) return "";
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(endpoint);
    if (!response.ok) return "";
    const data = await response.json();
    return data.title || "";
  } catch (_) {
    return "";
  }
}

state.school = (() => {
  try { return JSON.parse(localStorage.getItem("balanceProd.school")) || null; } catch { return null; }
})() || {
  children:{
    "1":{name:"Lou",tasks:[],links:[],timetableUrl:"",timetableByYear:{}},
    "2":{name:"Fina",tasks:[],links:[],timetableUrl:"",timetableByYear:{}}
  }
};
["1","2"].forEach(id=>{
  state.school.children[id]=state.school.children[id]||{name:(id === "1" ? "Lou" : "Fina"),tasks:[],links:[]};
  state.school.children[id].tasks=Array.isArray(state.school.children[id].tasks)?state.school.children[id].tasks:[];
  state.school.children[id].links=Array.isArray(state.school.children[id].links)?state.school.children[id].links:[];
});


if (state.school.children["1"].name === "Kind 1") state.school.children["1"].name = "Lou";
if (state.school.children["2"].name === "Kind 2") state.school.children["2"].name = "Fina";

let currentWeekMonday = getMonday(new Date());
let detectedVideoTitle = "";
let replanArchiveId = null;

function currentWeekKey() {
  return dateKey(currentWeekMonday);
}

function migrateOldData() {
  const thisWeek = dateKey(getMonday(new Date()));
  let changed = false;

  state.videos.forEach(v => {
    if (!v.weekKey) {
      v.weekKey = thisWeek;
      changed = true;
    }
    if (!v.thumbnail) {
      v.thumbnail = thumbnailFor(v.url);
      changed = true;
    }
  });

  state.todos.forEach(t => {
    if (t.day && !t.weekKey) {
      t.weekKey = thisWeek;
      changed = true;
    }
    if (!Array.isArray(t.family)) {
      t.family = [];
      changed = true;
    }
    if (!t.type) {
      t.type = "todo";
      changed = true;
    }
    if (!t.recurrence) {
      t.recurrence = "none";
      changed = true;
    }
    if (typeof t.superImportant !== "boolean") {
      t.superImportant = false;
      changed = true;
    }
    if (!Array.isArray(t.completedOccurrences)) {
      t.completedOccurrences = [];
      changed = true;
    }
    if (!t.anchorDate && t.weekKey && t.day) {
      const mon = parseLocalDate(t.weekKey);
      const anchor = dateForWeekday(mon, t.day);
      if (anchor) {
        t.anchorDate = dateKey(anchor);
        changed = true;
      }
    }
  });

  state.archive.forEach((a, i) => {
    if (!a.thumbnail) {
      a.thumbnail = thumbnailFor(a.url);
      changed = true;
    }
    if (!a.lastDone && (Number(a.timesDone) || 0) > 0) {
      a.lastDone = new Date(Date.now() - i * 1000).toISOString();
      changed = true;
    }
    a.timesDone = Number(a.timesDone) || 0;
  });

  // Einmalige Korrektur für die Testphase:
  // Ein offensichtlich fälschlich höherer Zähler aus älteren Versionen wird
  // auf die aktuell sichtbaren erledigten Planungen begrenzt, mindestens jedoch 1,
  // falls bereits eine Bewertung existiert.
  

  if (changed) save();
}

function weekLabel() {
  const sunday = dayDate(currentWeekMonday, 6);
  const fmt = d => d.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});
  const nowKey = dateKey(getMonday(new Date()));
  document.querySelector("#weekTitle").textContent = `${fmt(currentWeekMonday)} – ${fmt(sunday)}`;

  const todayBtn = document.querySelector("#todayWeekBtn");
  todayBtn.style.visibility = currentWeekKey() === nowKey ? "hidden" : "visible";
}

function archiveEntryFor(url) {
  return state.archive.find(a => a.url === url);
}

function ensureArchiveEntry(video) {
  let entry = archiveEntryFor(video.url);

  if (!entry) {
    entry = {
      id: uid(),
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail || thumbnailFor(video.url),
      rating: null,
      favorite: false,
      lastDone: null
    };
    state.archive.push(entry);
  }

  entry.title = video.title || entry.title;
  entry.thumbnail = entry.thumbnail || video.thumbnail || thumbnailFor(video.url);
  return entry;
}

function getMostWantedEntries() {
  const eligible = state.archive
    .filter(a => (Number(a.timesDone) || 0) >= 2)
    .sort((a,b) => (Number(b.timesDone) || 0) - (Number(a.timesDone) || 0));

  if (!eligible.length) return [];

  const targetCount = Math.max(1, Math.ceil(eligible.length * 0.30));
  const cutoffIndex = Math.min(targetCount - 1, eligible.length - 1);
  const cutoffCount = Number(eligible[cutoffIndex].timesDone) || 0;

  return eligible.filter(a => (Number(a.timesDone) || 0) >= cutoffCount);
}

function isMostWanted(url) {
  const entry = archiveEntryFor(url);
  if (!entry || (Number(entry.timesDone) || 0) < 2) return false;
  return getMostWantedEntries().some(a => a.url === url);
}

function ratingFor(url) {
  return archiveEntryFor(url)?.rating || null;
}



const familyNames = {a:"",b:"",c:"",d:""};

function todoGroupKey(todo) {
  const members = Array.isArray(todo.family) ? todo.family.filter(x => state.familySettings[x]) : [];
  if (members.length === 0) return "general";
  if (members.length === 1) return members[0];
  return "shared";
}

function todoGroupLabel(key) {
  if (["a","b","c","d"].includes(key)) return familyName(key);
  return {
    shared:"Gemeinsam",
    general:"Allgemein"
  }[key] || "Allgemein";
}

function todoGroupOrder(key) {
  return {a:1,b:2,c:3,d:4,shared:5,general:6}[key] || 9;
}

function groupTodosByPerson(todos) {
  const map = new Map();
  todos.forEach(todo => {
    const key = todoGroupKey(todo);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(todo);
  });
  return [...map.entries()].sort((a,b)=>todoGroupOrder(a[0])-todoGroupOrder(b[0]));
}

function groupAccentClass(key) {
  return `person-group-${key}`;
}

function sharedGroupGradient(items = []) {
  const members = [...new Set(
    items.flatMap(t => Array.isArray(t.family) ? t.family : [])
  )].filter(m => state.familySettings[m]);

  if (!members.length) return "";
  const colors = members.map(m => familyColor(m));
  if (colors.length === 1) return colors[0];

  return `linear-gradient(110deg, ${colors.map((c,i) => {
    const pos = Math.round((i / (colors.length - 1)) * 100);
    return `${c} ${pos}%`;
  }).join(", ")})`;
}

function renderWeek() {
  weekLabel();
  const grid = document.querySelector("#weekGrid");
  grid.innerHTML = "";
  const weekKey = currentWeekKey();

  days.forEach((day, index) => {
    const dayEl = document.createElement("article");
    dayEl.className = "day";

    const date = dayDate(currentWeekMonday, index);
    const dateLabel = date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});

    const videos = state.videos.filter(v => v.day === day && v.weekKey === weekKey);
    const occurrences = state.todos.filter(t => occursOnDate(t, date));
    const todos = occurrences.filter(t => (t.type || "todo") === "todo");
    const events = occurrences.filter(t => t.type === "event");

    const videoHtml = videos.map(v => `
      <div class="video-item ${v.done ? "done":""}">
        <button type="button" class="remove-week-video" data-id="${v.id}" title="Aus dieser Woche entfernen" aria-label="Übung aus dieser Woche entfernen">×</button>
        <div class="video-card">
          <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(v.title)} öffnen">
            ${v.thumbnail ? `<img class="video-thumb" src="${escapeHtml(v.thumbnail)}" alt="">` : `<div class="video-thumb"></div>`}
          </a>
          <div class="video-info">
            <a class="video-title" href="${escapeHtml(v.url)}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a>
            <div class="video-source">
              YouTube ${isMostWanted(v.url) ? '<span class="most-wanted-badge" title="Most wanted">🔥 Most wanted</span>' : ''}
              
            </div>
          </div>
          <div class="video-check-wrap">
            <input class="check video-check" data-id="${v.id}" type="checkbox" ${v.done ? "checked":""} aria-label="Übung erledigt">
          </div>
        </div>
        ${v.done ? `
          <div class="video-rating" aria-label="Übung bewerten">
            <button class="text-btn rate-btn ${ratingFor(v.url) === "super" ? "selected" : ""}" data-id="${v.id}" data-rating="super" title="Super" aria-label="Super">😊</button>
            <button class="text-btn rate-btn ${ratingFor(v.url) === "okay" ? "selected" : ""}" data-id="${v.id}" data-rating="okay" title="Okay" aria-label="Okay">🙂</button>
            <button class="text-btn rate-btn ${ratingFor(v.url) === "nope" ? "selected" : ""}" data-id="${v.id}" data-rating="nope" title="Nicht meins" aria-label="Nicht meins">😕</button>
          </div>` : ""}
      </div>
    `).join("");

    const todoHtml = todos.length ? `
      <div class="day-todos">
        <div class="day-todos-title">To-dos</div>
        ${groupTodosByPerson(todos).map(([groupKey, groupItems]) => `
          <div class="person-todo-group grouped-family-block ${groupAccentClass(groupKey)}"
               style="${groupKey === "shared"
                 ? `--group-border:${sharedGroupGradient(groupItems)}`
                 : `--group-border:${familyColor(groupKey) || "#c8c0ba"}`}">
            <div class="person-todo-group-title">${todoGroupLabel(groupKey)}</div>
            ${groupItems.map(t => `
              <label class="todo-mini grouped-todo-row ${t.superImportant ? "super-important" : ""}">
                <input class="check mini-todo-check" data-id="${t.id}" data-date="${dateKey(date)}" type="checkbox" ${isOccurrenceDone(t, date) ? "checked":""}>
                <span>${t.superImportant ? '<span class="tiny-star">★</span> ' : ''}${escapeHtml(t.text)}</span>
              </label>
            `).join("")}
          </div>
        `).join("")}
      </div>
    ` : "";

    const eventHtml = events.length ? `
      <div class="day-events">
        <div class="day-todos-title">Termine</div>
        ${events
          .sort((a,b) => (a.time || "").localeCompare(b.time || ""))
          .map(t => `
            <label class="event-mini family-frame ${t.superImportant ? "super-important" : ""}" style="${familyBorderStyle(t.family || [])}">
              <input class="check mini-todo-check" data-id="${t.id}" data-date="${dateKey(date)}" type="checkbox" ${isOccurrenceDone(t, date) ? "checked":""}>
              <span>
                ${t.time ? `<strong>${escapeHtml(t.time)}</strong> · ` : ""}
                ${t.superImportant ? '<span class="tiny-star">★</span> ' : ''}
                ${escapeHtml(t.text)}
              </span>
            </label>
          `).join("")}
      </div>
    ` : "";


    const schoolTasksForDate = [];
    ["1","2"].forEach(childId => {
      const child = state.school.children[childId];
      child.tasks.forEach(task => {
        if (task.due === dateKey(date)) {
          schoolTasksForDate.push({...task, childId, childName: child.name});
        }
      });
    });

    const schoolHtml = schoolTasksForDate.length ? `
      <div class="day-school">
        <div class="day-todos-title">Schule</div>
        ${schoolTasksForDate.map(t => `
          <label class="school-week-item child-${t.childId} ${t.done ? "done" : ""}">
            <input class="check school-week-check" data-child="${t.childId}" data-id="${t.id}" type="checkbox" ${t.done ? "checked" : ""}>
            <span class="school-child-badge child-${t.childId}">${t.childId === "1" ? "L" : "F"}</span>
            <span class="school-week-copy">
              <strong>${escapeHtml(t.childName)}</strong> · ${escapeHtml(t.text)}
              ${t.subject ? ` <small>${escapeHtml(t.subject)}</small>` : ""}
              ${t.done ? `<em class="school-week-done">✓ erledigt</em>` : ""}
            </span>
          </label>
        `).join("")}
      </div>
    ` : "";

    dayEl.innerHTML = `
      <h3>${day}<span class="day-date">${dateLabel}</span></h3>
      ${(() => { const rows=["1","2"].map(cid=>{const tm=homeByForDate(cid,date),c=state.school.children[cid];return tm?`<span><b>${escapeHtml(c.name)}</b> ${escapeHtml(tm)}</span>`:""}).filter(Boolean);return rows.length?`<div class="home-by-strip home-by-top"><span class="home-by-label">⌂ zu Hause bis</span>${rows.join("")}</div>`:"";})()}
      ${videoHtml || '<div class="empty print-hide-empty">Heute ist noch Platz für etwas Schönes.</div>'}
      ${eventHtml}
      ${schoolHtml}${todoHtml}
    `;
    grid.appendChild(dayEl);
  });

  document.querySelectorAll(".video-check").forEach(el => el.addEventListener("change", e => {
    const item = state.videos.find(v => v.id === e.target.dataset.id);
    if (!item) return;

    const wasDone = !!item.done;
    item.done = e.target.checked;

    if (!wasDone && item.done) {
      const archived = ensureArchiveEntry(item);
      archived.timesDone = (Number(archived.timesDone) || 0) + 1;
      archived.lastDone = new Date().toISOString();
      showMotivation(motivationalMessage());
    }

    save();
    renderAll();
  }));

  document.querySelectorAll(".mini-todo-check").forEach(el => el.addEventListener("change", e => {
    const item = state.todos.find(t => t.id === e.target.dataset.id);
    const occDate = parseLocalDate(e.target.dataset.date);
    if (!item || !occDate) return;

    const wasDone = isOccurrenceDone(item, occDate);
    setOccurrenceDone(item, occDate, e.target.checked);

    save();
    renderAll();

    if (!wasDone && e.target.checked) showMotivation(todoMotivationalMessage());
  }));

  document.querySelectorAll(".school-week-check").forEach(el => el.addEventListener("change", e => {
    const childId = e.currentTarget.dataset.child;
    const taskId = e.currentTarget.dataset.id;
    const child = state.school.children[childId];
    const task = child?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const wasDone = !!task.done;
    task.done = e.currentTarget.checked;

    save();
    renderAll();

    if (!wasDone && task.done) {
      showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(child)));
    }
  }));

  document.querySelectorAll(".remove-week-video").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    state.videos = state.videos.filter(v => v.id !== id);
    save();
    renderAll();
  }));

  document.querySelectorAll(".rate-btn").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const rating = e.currentTarget.dataset.rating;
    const video = state.videos.find(v => v.id === id);
    if (!video) return;

    const archived = ensureArchiveEntry(video);
    archived.rating = rating;

    const ratingText = {
      super: "Als „Super“ gespeichert 😊",
      okay: "Als „Okay“ gespeichert 🙂",
      nope: "Als „Nicht meins“ gespeichert 😕"
    };

    save();
    renderAll();
    showMotivation(ratingText[rating]);
  }));
}

let todoFilter = "all";
let editingTodoId = null;


function applyFamilyVisuals(){
  const map = {a:"A",b:"B",c:"C",d:"D"};
  Object.entries(map).forEach(([key,suffix]) => {
    const chip = document.querySelector(`.family-${key}`);
    if (chip) {
      chip.style.setProperty("--member-color", familyColor(key));
      const span = chip.querySelector("span");
      if (span) span.textContent = familyName(key);
    }

    const nameInput = document.querySelector(`#familyName${suffix}`);
    const colorInput = document.querySelector(`#familyColor${suffix}`);
    if (nameInput && document.activeElement !== nameInput) nameInput.value = familyName(key);
    if (colorInput && document.activeElement !== colorInput) colorInput.value = familyColor(key);
  });

  document.documentElement.style.setProperty("--family-a-color", familyColor("a"));
  document.documentElement.style.setProperty("--family-b-color", familyColor("b"));
  document.documentElement.style.setProperty("--family-c-color", familyColor("c"));
  document.documentElement.style.setProperty("--family-d-color", familyColor("d"));
}

function bindFamilySettings(){
  const map = {A:"a",B:"b",C:"c",D:"d"};
  Object.entries(map).forEach(([suffix,key]) => {
    const nameInput = document.querySelector(`#familyName${suffix}`);
    const colorInput = document.querySelector(`#familyColor${suffix}`);

    if (nameInput && !nameInput.dataset.bound) {
      nameInput.dataset.bound = "1";
      nameInput.addEventListener("change", () => {
        state.familySettings[key].name = nameInput.value.trim() || defaultFamilySettings[key].name;
        save();
        renderAll();
      });
    }

    if (colorInput && !colorInput.dataset.bound) {
      colorInput.dataset.bound = "1";
      colorInput.addEventListener("input", () => {
        state.familySettings[key].color = colorInput.value;
        save();
        renderAll();
      });
    }
  });
}

function renderTodos() {
  const list = document.querySelector("#todoList");
  let todos = state.todos.filter(t => !t.archived);
  if (todoFilter === "work" || todoFilter === "private") todos = todos.filter(t => t.area === todoFilter);
  if (todoFilter === "todo" || todoFilter === "event") todos = todos.filter(t => (t.type || "todo") === todoFilter);

  if (!todos.length) {
    list.innerHTML = '<div class="empty">Hier ist gerade angenehm wenig los.</div>';
    return;
  }

  const labels = {
    important:"Wichtig", medium:"Mittel", low:"Kann warten",
    work:"Arbeit", private:"Privat",
    today:"Heute", week:"Diese Woche", month:"Diesen Monat", later:"Irgendwann",
    todo:"To-do", event:"Termin"
  };

  const grouped = groupTodosByPerson(todos);
  list.innerHTML = grouped.map(([groupKey, groupItems]) => `
    <section class="todo-person-section grouped-family-section ${groupAccentClass(groupKey)}"
      style="${groupKey === "shared"
        ? `--group-border:${sharedGroupGradient(groupItems)}`
        : `--group-border:${familyColor(groupKey) || "#c8c0ba"}`}">
      <div class="todo-person-heading">
        <span>${todoGroupLabel(groupKey)}</span>
        <small>${groupItems.length} ${groupItems.length === 1 ? "Eintrag" : "Einträge"}</small>
      </div>
      <div class="todo-person-items">
        ${groupItems.map(t => `
          <div class="todo-card grouped-main-todo ${t.superImportant ? "super-important" : ""} ${(!t.recurrence || t.recurrence === "none") && t.done ? "done":""}">
            <div class="todo-main">
              ${(!t.recurrence || t.recurrence === "none")
                ? `<input class="check todo-check" data-id="${t.id}" type="checkbox" ${t.done ? "checked":""}>`
                : `<span class="series-icon" title="Wiederkehrender Eintrag">↻</span>`}
              <div>
                <div class="todo-text">
                  ${t.superImportant ? '<span class="super-star">★</span> ' : ''}
                  ${escapeHtml(t.text)}
                </div>
                <div class="todo-meta">
                  <span class="pill entry-type ${t.type === "event" ? "event-pill" : ""}">${labels[t.type || "todo"]}</span>
                  <span class="pill ${t.priority}">${labels[t.priority]}</span>
                  <span class="pill ${t.area}">${labels[t.area]}</span>
                  ${t.type === "event" && t.date ? `<span class="pill">${new Date(t.date + "T12:00:00").toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit",year:"numeric"})}${t.time ? " · " + escapeHtml(t.time) : ""}</span>` : ""}
                  ${t.type !== "event" && t.period ? `<span class="pill">${labels[t.period]}</span>` : ""}
                  ${t.day ? `<span class="pill">${t.day}</span>` : ""}
                  ${t.recurrence && t.recurrence !== "none" ? `<span class="pill repeat-pill">↻ ${recurrenceLabel(t.recurrence)}</span>` : ""}
                  ${t.superImportant ? `<span class="pill super-pill">⭐ Superwichtig</span>` : ""}
                </div>
              </div>
            </div>
            <div class="todo-actions">
              <button class="text-btn edit-todo" data-id="${t.id}" title="Bearbeiten">✎</button>
              <button class="text-btn delete-todo" data-id="${t.id}" title="Löschen">×</button>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");

  document.querySelectorAll(".todo-check").forEach(el => el.addEventListener("change", e => {
    const item = state.todos.find(t => t.id === e.target.dataset.id);
    if (!item) return;
    const wasDone = !!item.done;
    item.done = e.target.checked;
    save();
    renderAll();
    if (!wasDone && item.done) showMotivation(todoMotivationalMessage());
  }));

  document.querySelectorAll(".edit-todo").forEach(el => el.addEventListener("click", e => {
    const item = state.todos.find(t => t.id === e.currentTarget.dataset.id);
    if (!item) return;

    editingTodoId = item.id;
    document.querySelector("#entryType").value = item.type || "todo";
    document.querySelector("#superImportant").checked = !!item.superImportant;
    document.querySelector("#todoText").value = item.text;
    document.querySelector("#todoPriority").value = item.priority;
    document.querySelector("#todoArea").value = item.area;
    document.querySelector("#todoPeriod").value = item.period;
    document.querySelector("#todoDay").value = item.day || "";
    document.querySelector("#eventDate").value = item.date || "";
    document.querySelector("#eventTime").value = item.time || "";
    document.querySelector("#recurrence").value = item.recurrence || "none";
    setSelectedFamilyMembers(item.family || []);
    updateEntryTypeUI();

    document.querySelector("#addTodoBtn").textContent = "Änderungen speichern";
    document.querySelector("#cancelTodoEditBtn").classList.remove("hidden");
    document.querySelector("#todoText").focus();
    window.scrollTo({top: document.querySelector(".todo-form").offsetTop - 20, behavior:"smooth"});
  }));

  document.querySelectorAll(".delete-todo").forEach(el => el.addEventListener("click", e => {
    state.todos = state.todos.filter(t => t.id !== e.currentTarget.dataset.id);
    if (editingTodoId === e.currentTarget.dataset.id) resetTodoEditor();
    save();
    renderAll();
  }));
}

let archiveFilter = "all";

function renderArchive() {
  const list = document.querySelector("#archiveList");
  let items = [...state.archive];

  if (archiveFilter === "favorite") items = items.filter(x => x.favorite);
  if (archiveFilter === "wanted") items = getMostWantedEntries();
  if (["super","okay","nope"].includes(archiveFilter)) items = items.filter(x => x.rating === archiveFilter);

  const byNewest = arr => arr.sort((a,b) => new Date(b.lastDone || 0) - new Date(a.lastDone || 0));

  if (!items.length) {
    list.className = "archive-grid";
    list.innerHTML = '<div class="empty">Hier gibt es noch keine passenden Übungen.</div>';
    return;
  }

  if (archiveFilter === "all") {
    const groups = [
      ["super","😊 Super", byNewest(items.filter(x => x.rating === "super"))],
      ["okay","🙂 Okay", byNewest(items.filter(x => x.rating === "okay"))],
      ["nope","😕 Nicht meins", byNewest(items.filter(x => x.rating === "nope"))]
    ];

    list.className = "archive-columns";
    list.innerHTML = groups.map(([key,label,group]) => `
      <section class="archive-column ${key}">
        <div class="archive-column-head">${label}<span>${group.length}</span></div>
        <div class="archive-column-list">
          ${group.length ? group.map(archiveCardHtml).join("") : '<div class="column-empty">Noch keine Übungen</div>'}
        </div>
      </section>
    `).join("");
  } else {
    if (archiveFilter !== "wanted") byNewest(items);
    list.className = "archive-grid";
    list.innerHTML = items.map(archiveCardHtml).join("");
  }

  bindArchiveButtons();
}

function archiveCardHtml(a) {
  const ratingLabel = {super:"😊 Super", okay:"🙂 Okay", nope:"😕 Nicht meins"};
  return `
    <article class="archive-card">
      ${a.thumbnail ? `<img class="archive-thumb" src="${escapeHtml(a.thumbnail)}" alt="">` : ""}
      <div class="archive-content">
        <h3>${escapeHtml(a.title)}</h3>
        <p>${ratingLabel[a.rating] || "Noch nicht bewertet"} · <strong>${a.timesDone || 0}× gemacht</strong>${isMostWanted(a.url) ? ' <span class="most-wanted-badge" title="Dynamisch Most wanted">🔥 Most wanted</span>' : ''}</p>
        <div class="archive-actions">
          <button type="button" class="text-btn favorite-btn" data-id="${a.id}">${a.favorite ? "♥ Favorit" : "♡ Favorit"}</button>
          <button type="button" class="text-btn replan-btn" data-id="${a.id}">+ Einplanen</button>
          <button type="button" class="text-btn delete-exercise-btn" data-id="${a.id}">Löschen</button>
          <a class="video-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">YouTube öffnen</a>
        </div>
      </div>
    </article>`;
}

function bindArchiveButtons() {
  document.querySelectorAll(".favorite-btn").forEach(btn => btn.addEventListener("click", e => {
    const item = state.archive.find(a => a.id === e.currentTarget.dataset.id);
    if (!item) return;
    item.favorite = !item.favorite;
    save();
    renderArchive();
  }));

  document.querySelectorAll(".replan-btn").forEach(btn => btn.addEventListener("click", e => {
    const item = state.archive.find(a => a.id === e.currentTarget.dataset.id);
    if (!item) return;
    replanArchiveId = item.id;
    document.querySelector("#replanTitle").textContent = item.title;
    document.querySelector("#replanWeek").value = "0";
    document.querySelector("#replanDay").value = "Montag";
    document.querySelector("#replanDialog").showModal();
  }));

  document.querySelectorAll(".delete-exercise-btn").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const item = state.archive.find(a => a.id === id);
    if (!item) return;

    const shouldDelete = confirm(`„${item.title}“ wirklich aus Meine Übungen löschen?`);
    if (!shouldDelete) return;

    state.archive = state.archive.filter(a => a.id !== id);
    save();
    renderAll();
  }));
}


function schoolMotivationalMessage(allHomeworkDone = false) {
  if (allHomeworkDone) return "💛 Wunderbar – deine Hausaufgaben sind geschafft.";
  const messages = [
    "🌸 Danke, dass du dir Zeit zum Lernen genommen hast.",
    "🌿 Du bist drangeblieben – das ist wertvoll.",
    "🌞 Heute hast du wieder etwas Neues gelernt.",
    "☀ Jede erledigte Aufgabe ist ein kleiner Schritt nach vorn.",
    "✨ Gut gemacht – jetzt darf dein Kopf eine Pause machen.",
    "🌈 Schön, dass du dein Bestes gegeben hast.",
    "🍀 Lernen braucht Zeit – und heute hast du sie dir genommen."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function childHasNoOpenHomework(child) {
  const homework = child.tasks.filter(t => t.type === "homework");
  return homework.length > 0 && homework.every(t => t.done);
}




const manualTimetableDayKeys=["Mon","Tue","Wed","Thu","Fri"],manualTimetableDayNames=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const defaultLessonTimes=[["07:45","08:35"],["08:35","09:25"],["09:45","10:35"],["10:35","11:25"],["11:35","12:25"],["12:25","13:15"]];
function subjectOptionsFor(id){
 if(id==="2")return ["","GU","REL","Bewegung & Sport","Werken","Anderes"];
 const sel=document.querySelector("#schoolSubject1"),v=sel?[...sel.options].map(o=>o.value).filter(Boolean):[];
 return v.length?["",...new Set(v),"Anderes"]:["","Deutsch","Mathematik","Englisch","Biologie","Geografie","Geschichte","Physik","Chemie","Informatik","Religion","Bewegung & Sport","Werken","Musik","Kunst","Anderes"];
}
function ensureManualTimetable(c){
 c.timetableByYear=c.timetableByYear||{};const y=state.settings?.schoolYear||"2026-27";
 if(!c.timetableByYear[y])c.timetableByYear[y]={times:defaultLessonTimes.map(x=>({from:x[0],to:x[1]})),subjects:Object.fromEntries(manualTimetableDayKeys.map(d=>[d,Array(6).fill("")])),homeBy:Object.fromEntries(manualTimetableDayKeys.map(d=>[d,""]))};
 return c.timetableByYear[y];
}
function hasManualTimetable(c){const t=ensureManualTimetable(c);return manualTimetableDayKeys.some(d=>t.subjects[d].some(Boolean)||t.homeBy[d])}
function ttOpts(id,cur){return subjectOptionsFor(id).map(v=>`<option value="${escapeHtml(v)}" ${v===cur?"selected":""}>${escapeHtml(v||"–")}</option>`).join("")}
function renderTTMatrix(id){
  const c=state.school.children[id],t=ensureManualTimetable(c),h=document.querySelector(`#ttMatrix${id}`);
  if(!h)return;
  h.innerHTML=`<div class="tt-table-wrap"><table class="tt-table">
    <thead><tr><th>Zeit</th>${manualTimetableDayNames.map(x=>`<th>${x}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="tt-home-row tt-home-row-top"><th>⌂ Zu Hause bis</th>${manualTimetableDayKeys.map(d=>`<td><input class="tt-home-input" data-child="${id}" data-day="${d}" value="${escapeHtml(t.homeBy[d]||"")}" placeholder="13:30"></td>`).join("")}</tr>
      ${t.times.map((tm,r)=>`<tr><th class="tt-time-cell"><input class="tt-time-text" data-child="${id}" data-row="${r}" data-part="from" value="${escapeHtml(tm.from)}"><span>–</span><input class="tt-time-text" data-child="${id}" data-row="${r}" data-part="to" value="${escapeHtml(tm.to)}"></th>${manualTimetableDayKeys.map(d=>`<td><select class="tt-subject-cell" data-child="${id}" data-day="${d}" data-row="${r}">${ttOpts(id,t.subjects[d][r]||"")}</select></td>`).join("")}</tr>`).join("")}
    </tbody>
  </table></div>`;
}
function openManualTimetableEditor(id){renderTTMatrix(id);document.querySelector(`#manualTimetableWrap${id}`)?.classList.remove("hidden")}
function closeManualTimetableEditor(id){document.querySelector(`#manualTimetableWrap${id}`)?.classList.add("hidden")}
function saveTTMatrix(id){const c=state.school.children[id],t=ensureManualTimetable(c);document.querySelectorAll(`.tt-time-text[data-child="${id}"]`).forEach(x=>t.times[+x.dataset.row][x.dataset.part]=x.value.trim());document.querySelectorAll(`.tt-subject-cell[data-child="${id}"]`).forEach(x=>t.subjects[x.dataset.day][+x.dataset.row]=x.value);document.querySelectorAll(`.tt-home-input[data-child="${id}"]`).forEach(x=>t.homeBy[x.dataset.day]=x.value.trim());save();renderAll();closeManualTimetableEditor(id);showMotivation("Stundenplan gespeichert ✨")}
function showManualTimetable(id){
  const c=state.school.children[id],t=ensureManualTimetable(c),
    d=document.querySelector("#manualTimetableDialog"),
    title=document.querySelector("#manualTimetableDialogTitle"),
    out=document.querySelector("#manualTimetableDisplay");
  if(!d||!out)return;

  title.textContent=`${c.name||id} – Stundenplan`;
  out.innerHTML=`<div class="tt-table-wrap"><table class="tt-table tt-view-table">
    <thead><tr><th>Zeit</th>${manualTimetableDayNames.map(x=>`<th>${x}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="tt-home-row tt-home-row-top"><th>⌂ Zu Hause bis</th>${manualTimetableDayKeys.map(day=>`<td>${escapeHtml(t.homeBy[day]||"–")}</td>`).join("")}</tr>
      ${t.times.map((tm,r)=>`<tr><th>${escapeHtml(tm.from)}–${escapeHtml(tm.to)}</th>${manualTimetableDayKeys.map(day=>`<td>${escapeHtml(t.subjects[day][r]||"")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table></div>`;
  d.showModal();
}
function bindManualTimetableControls(){document.querySelectorAll(".save-tt-matrix").forEach(b=>{if(b.dataset.bound)return;b.dataset.bound="1";b.addEventListener("click",e=>saveTTMatrix(e.currentTarget.dataset.child))})}
function homeByForDate(id,date){const c=state.school.children[id];if(!c)return"";const t=ensureManualTimetable(c),day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];return t.homeBy[day]||""}

function renderSchool(){
  ["1","2"].forEach(id=>{
    const c=state.school.children[id], n=document.querySelector(`#schoolName${id}`);
    if(n && document.activeElement!==n)n.value=c.name||(id === "1" ? "Lou" : "Fina");
    const te=document.querySelector(`#schoolTasks${id}`), le=document.querySelector(`#schoolLinks${id}`);
    if(!te||!le)return;
    ensureManualTimetable(c);
    const manualViewBtn = document.querySelector(`#manualTimetableViewBtn${id}`);
    if (manualViewBtn) manualViewBtn.classList.toggle("hidden", !hasManualTimetable(c));
    const tasks=[...c.tasks].sort((a,b)=>(a.done-b.done)||((a.due||"9999").localeCompare(b.due||"9999")));
    te.innerHTML=tasks.length?tasks.map(t=>`<div class="school-task ${t.done?"done":""}">
      <input class="check school-check" data-child="${id}" data-id="${t.id}" type="checkbox" ${t.done?"checked":""}>
      <div><div class="school-task-text">${escapeHtml(t.text)}</div><div class="school-meta"><span>${{homework:"☀ Hausübung",test:"✎ Test",bring:"♥ Mitbringen",appointment:"○ Termin",other:"✦ Schule"}[t.type] || "✦ Schule"}</span>${t.subject?`<span>${escapeHtml(t.subject)}</span>`:""}${t.due?`<span>bis ${parseLocalDate(t.due).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"})}</span>`:""}</div></div>
      <button class="school-del" data-kind="task" data-child="${id}" data-id="${t.id}">×</button></div>`).join(""):'<div class="school-empty">Gerade ist hier nichts offen. 🌿</div>';
    le.innerHTML=c.links.length?c.links.map(x=>`<div class="school-link"><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.name)}</a><button class="school-del" data-kind="link" data-child="${id}" data-id="${x.id}">×</button></div>`).join(""):'<span class="school-empty-inline">Noch keine Lernlinks hinterlegt.</span>';
    const ti=document.querySelector(`#timetableUrl${id}`),to=document.querySelector(`#timetableOpen${id}`);
    if(ti && document.activeElement!==ti) ti.value=c.timetableUrl||"";
    if(to){
      if(c.timetableUrl){to.href=c.timetableUrl;to.classList.remove("hidden");}
      else{to.removeAttribute("href");to.classList.add("hidden");}
    }
  });
  document.querySelectorAll(".school-check").forEach(x=>x.addEventListener("change",e=>{
    const c=state.school.children[e.currentTarget.dataset.child],t=c.tasks.find(z=>z.id===e.currentTarget.dataset.id); if(!t)return;
    const was=t.done;
    t.done=e.currentTarget.checked;
    save();
    renderAll();
    if(!was && t.done) showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(c)));
  }));
  document.querySelectorAll(".school-del").forEach(x=>x.addEventListener("click",e=>{
    const d=e.currentTarget.dataset,c=state.school.children[d.child];
    if(d.kind==="task")c.tasks=c.tasks.filter(z=>z.id!==d.id);else c.links=c.links.filter(z=>z.id!==d.id);
    save();renderSchool();
  }));
}
function addSchoolTask(id){
  const t=document.querySelector(`#schoolTask${id}`);
  const s=document.querySelector(`#schoolSubject${id}`);
  const so=document.querySelector(`#schoolSubjectOther${id}`);
  const d=document.querySelector(`#schoolDue${id}`);
  const y=document.querySelector(`#schoolType${id}`);
  if(!t.value.trim())return;

  const subject = s.value === "other" ? so.value.trim() : s.value;

  state.school.children[id].tasks.push({
    id:uid(),
    text:t.value.trim(),
    subject,
    due:d.value,
    type:y.value,
    done:false
  });

  t.value="";
  s.value="";
  so.value="";
  so.classList.add("hidden");
  d.value="";
  y.value="homework";
  save();
  renderSchool();
}
function addSchoolLink(id){
  const n=document.querySelector(`#schoolLinkName${id}`),u=document.querySelector(`#schoolLinkUrl${id}`);let url=u.value.trim();
  if(!n.value.trim()||!url)return;if(!/^https?:\/\//i.test(url))url="https://"+url;
  state.school.children[id].links.push({id:uid(),name:n.value.trim(),url});n.value="";u.value="";save();renderSchool();
}

["1","2"].forEach(id=>{
  const select=document.querySelector(`#schoolSubject${id}`);
  const other=document.querySelector(`#schoolSubjectOther${id}`);
  if(select && other) select.addEventListener("change", ()=>{
    other.classList.toggle("hidden", select.value !== "other");
    if(select.value === "other") other.focus();
  });
});

document.querySelectorAll(".add-school-task").forEach(b=>b.addEventListener("click",e=>addSchoolTask(e.currentTarget.dataset.child)));
document.querySelectorAll(".add-school-link").forEach(b=>b.addEventListener("click",e=>addSchoolLink(e.currentTarget.dataset.child)));
["1","2"].forEach(id=>document.querySelector(`#schoolName${id}`)?.addEventListener("change",e=>{state.school.children[id].name=e.currentTarget.value.trim()||(id === "1" ? "Lou" : "Fina");save();}));

document.querySelectorAll(".save-timetable").forEach(b=>b.addEventListener("click",e=>{
  const id=e.currentTarget.dataset.child,input=document.querySelector(`#timetableUrl${id}`);
  let url=input.value.trim();
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  state.school.children[id].timetableUrl=url;
  save();renderSchool();
}));


function bindSchoolYearSetting(){
  const select = document.querySelector("#schoolYearSelect");
  if (!select) return;
  if (document.activeElement !== select) select.value = state.settings.schoolYear || "2026-27";
  if (!select.dataset.bound) {
    select.dataset.bound = "1";
    select.addEventListener("change", () => {
      state.settings.schoolYear = select.value;
      localStorage.setItem("balanceProd.schoolYear", select.value);
      renderAll();

      const sy = activeSchoolYear();
      if (!sy.start) {
        showMotivation("Für dieses Schuljahr sind die NÖ-Ferien noch nicht hinterlegt.");
      } else {
        showMotivation(`Schuljahr ${sy.label} ist jetzt ausgewählt.`);
      }
    });
  }
}


document.querySelectorAll(".toggle-manual-timetable").forEach(btn => btn.addEventListener("click", e => {
  openManualTimetableEditor(e.currentTarget.dataset.child);
}));

document.querySelectorAll(".close-manual-timetable").forEach(btn => btn.addEventListener("click", e => {
  closeManualTimetableEditor(e.currentTarget.dataset.child);
}));


document.querySelectorAll(".timetable-view-btn").forEach(btn => btn.addEventListener("click", e => {
  showManualTimetable(e.currentTarget.dataset.child);
}));

const manualTimetableDialog = document.querySelector("#manualTimetableDialog");
document.querySelector("#closeManualTimetableDialog")?.addEventListener("click", () => manualTimetableDialog?.close());
document.querySelector("#closeManualTimetableDialog2")?.addEventListener("click", () => manualTimetableDialog?.close());

document.querySelector("#printWeekBtn")?.addEventListener("click",()=>window.print());
function renderAll() {
  bindManualTimetableControls();
  bindSchoolYearSetting();
  applyFamilyVisuals();
  bindFamilySettings();
  renderWeek();
  renderTodos();
  renderArchive();
  renderSchool();
}

async function updateVideoPreview() {
  const urlInput = document.querySelector("#videoUrl");
  const preview = document.querySelector("#videoPreview");
  const manualTitle = document.querySelector("#videoTitle");
  const url = urlInput.value.trim();
  const id = extractYouTubeId(url);

  detectedVideoTitle = "";

  if (!id) {
    preview.className = "video-preview empty-preview";
    preview.innerHTML = `
      <div class="preview-placeholder">▶</div>
      <div>
        <strong>Vorschau</strong>
        <p>Füge einen gültigen YouTube-Link ein.</p>
      </div>`;
    return;
  }

  const thumb = thumbnailFor(url);
  preview.className = "video-preview preview-loading";
  preview.innerHTML = `
    <img src="${escapeHtml(thumb)}" alt="">
    <div>
      <strong>Titel wird geladen …</strong>
      <p>YouTube-Vorschau</p>
    </div>`;

  const title = await fetchYouTubeTitle(url);
  detectedVideoTitle = title;

  preview.className = "video-preview";
  preview.innerHTML = `
    <img src="${escapeHtml(thumb)}" alt="">
    <div>
      <strong>${escapeHtml(title || manualTitle.value.trim() || "YouTube-Übung")}</strong>
      <p>${title ? "Titel automatisch erkannt" : "Titel konnte nicht automatisch geladen werden."}</p>
    </div>`;
}

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.querySelector(`#${btn.dataset.view}`).classList.add("active");
}));

document.querySelector("#prevWeekBtn").addEventListener("click", () => {
  currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
  renderWeek();
});

document.querySelector("#nextWeekBtn").addEventListener("click", () => {
  currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
  renderWeek();
});

document.querySelector("#todayWeekBtn").addEventListener("click", () => {
  currentWeekMonday = getMonday(new Date());
  renderWeek();
});

document.querySelector("#addVideoBtn").addEventListener("click", () => {
  detectedVideoTitle = "";
  document.querySelector("#videoPreview").className = "video-preview empty-preview";
  document.querySelector("#videoPreview").innerHTML = `
    <div class="preview-placeholder">▶</div>
    <div>
      <strong>Vorschau</strong>
      <p>Füge einen YouTube-Link ein. Titel und Bild erscheinen automatisch.</p>
    </div>`;
  document.querySelector("#videoDialog").showModal();
});

document.querySelector("#closeVideoDialogBtn").addEventListener("click", () => {
  document.querySelector("#videoDialog").close();
});

document.querySelector("#cancelVideoBtn").addEventListener("click", () => {
  document.querySelector("#videoDialog").close();
});

let previewTimer;
document.querySelector("#videoUrl").addEventListener("input", () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updateVideoPreview, 450);
});

document.querySelector("#videoTitle").addEventListener("input", () => {
  if (!detectedVideoTitle && extractYouTubeId(document.querySelector("#videoUrl").value)) {
    updateVideoPreview();
  }
});

document.querySelector("#saveVideoBtn").addEventListener("click", async () => {
  const url = document.querySelector("#videoUrl").value.trim();
  const manualTitle = document.querySelector("#videoTitle").value.trim();
  const day = document.querySelector("#videoDay").value;
  const id = extractYouTubeId(url);

  if (!id) {
    alert("Bitte einen gültigen YouTube-Link eintragen.");
    return;
  }

  if (!detectedVideoTitle) {
    detectedVideoTitle = await fetchYouTubeTitle(url);
  }

  const title = detectedVideoTitle || manualTitle || "YouTube-Übung";

  state.videos.push({
    id:uid(),
    title,
    url,
    thumbnail:thumbnailFor(url),
    day,
    weekKey:currentWeekKey(),
    done:false,
    rating:null,
  });

  save();
  document.querySelector("#videoTitle").value = "";
  document.querySelector("#videoUrl").value = "";
  detectedVideoTitle = "";
  document.querySelector("#videoDialog").close();
  renderAll();
});

function resetTodoEditor() {
  editingTodoId = null;
  document.querySelector("#entryType").value = "todo";
  document.querySelector("#superImportant").checked = false;
  document.querySelector("#todoText").value = "";
  document.querySelector("#todoPriority").value = "medium";
  document.querySelector("#todoArea").value = "work";
  document.querySelector("#todoPeriod").value = "week";
  document.querySelector("#todoDay").value = "";
  document.querySelector("#eventDate").value = "";
  document.querySelector("#eventTime").value = "";
  document.querySelector("#recurrence").value = "none";
  setSelectedFamilyMembers([]);
  updateEntryTypeUI();
  document.querySelector("#addTodoBtn").textContent = "To-do hinzufügen";
  document.querySelector("#cancelTodoEditBtn").classList.add("hidden");
}


function updateEntryTypeUI() {
  const type = document.querySelector("#entryType").value;
  const isEvent = type === "event";

  document.querySelector("#eventFields").classList.toggle("hidden", !isEvent);
  document.querySelector("#entryTextLabel").textContent = isEvent ? "Termin" : "Aufgabe";
  document.querySelector("#todoText").placeholder = isEvent
    ? "z. B. Musikschule, Elternabend, Training"
    : "z. B. Elternbrief fertigstellen";

  const recurrence = document.querySelector("#recurrence").value;
  document.querySelector("#schoolHolidayHint").classList.toggle("hidden", recurrence !== "schoolyear-noe");
}

document.querySelector("#entryType").addEventListener("change", updateEntryTypeUI);
document.querySelector("#recurrence").addEventListener("change", updateEntryTypeUI);

document.querySelector("#cancelTodoEditBtn").addEventListener("click", resetTodoEditor);

document.querySelector("#addTodoBtn").addEventListener("click", () => {
  const text = document.querySelector("#todoText").value.trim();
  if (!text) return;

  const type = document.querySelector("#entryType").value;
  const selectedDay = document.querySelector("#todoDay").value;
  const selectedFamily = selectedFamilyMembers();
  const recurrence = document.querySelector("#recurrence").value;
  const eventDate = document.querySelector("#eventDate").value;
  const eventTime = document.querySelector("#eventTime").value;
  const superImportant = document.querySelector("#superImportant").checked;

  const activeMonday = new Date(currentWeekMonday);
  const selectedTodoDate = selectedDay ? dateForWeekday(activeMonday, selectedDay) : null;
  const newWeekKey = selectedDay ? dateKey(activeMonday) : null;
  const anchorDate = type === "event"
    ? eventDate
    : (selectedTodoDate ? dateKey(selectedTodoDate) : null);

  if (type === "event" && !eventDate) {
    alert("Bitte für den Termin ein Datum auswählen.");
    return;
  }

  if (recurrence === "schoolyear-noe" && !anchorDate) {
    alert("Für eine Wiederholung im Schuljahr brauche ich einen Wochentag bzw. ein Datum.");
    return;
  }

  if (editingTodoId) {
    const item = state.todos.find(t => t.id === editingTodoId);
    if (!item) return;

    item.type = type;
    item.superImportant = superImportant;
    item.text = text;
    item.priority = document.querySelector("#todoPriority").value;
    item.area = document.querySelector("#todoArea").value;
    item.period = document.querySelector("#todoPeriod").value;
    item.day = selectedDay;
    item.family = selectedFamily;
    item.weekKey = type === "event" ? null : newWeekKey;
    item.date = type === "event" ? eventDate : null;
    item.time = type === "event" ? eventTime : "";
    item.recurrence = recurrence;
    item.anchorDate = anchorDate;
    item.completedOccurrences = Array.isArray(item.completedOccurrences) ? item.completedOccurrences : [];

    resetTodoEditor();
  } else {
    state.todos.push({
      id: uid(),
      type,
      superImportant,
      text,
      priority: document.querySelector("#todoPriority").value,
      area: document.querySelector("#todoArea").value,
      period: document.querySelector("#todoPeriod").value,
      day: selectedDay,
      family: selectedFamily,
      weekKey: type === "event" ? null : newWeekKey,
      date: type === "event" ? eventDate : null,
      time: type === "event" ? eventTime : "",
      recurrence,
      anchorDate,
      completedOccurrences: [],
      done: false,
      archived: false
    });

    resetTodoEditor();
  }

  save();
  renderAll();
});

document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  todoFilter = btn.dataset.filter;
  renderTodos();
}));

document.querySelectorAll(".archive-filter").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".archive-filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  archiveFilter = btn.dataset.archive;
  renderArchive();
}));


const replanDialog = document.querySelector("#replanDialog");
const closeReplanDialogBtn = document.querySelector("#closeReplanDialogBtn");
const cancelReplanBtn = document.querySelector("#cancelReplanBtn");
const confirmReplanBtn = document.querySelector("#confirmReplanBtn");

function closeReplanDialog() {
  replanArchiveId = null;
  if (replanDialog && replanDialog.open) replanDialog.close();
}

if (closeReplanDialogBtn) closeReplanDialogBtn.addEventListener("click", closeReplanDialog);
if (cancelReplanBtn) cancelReplanBtn.addEventListener("click", closeReplanDialog);

if (replanDialog) {
  replanDialog.addEventListener("click", e => {
    if (e.target === replanDialog) closeReplanDialog();
  });
}

if (confirmReplanBtn) confirmReplanBtn.addEventListener("click", () => {
  const item = state.archive.find(a => a.id === replanArchiveId);
  if (!item) {
    closeReplanDialog();
    return;
  }

  const weeksAhead = Number(document.querySelector("#replanWeek").value || 0);
  const day = document.querySelector("#replanDay").value;
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weeksAhead * 7);

  state.videos.push({
    id:uid(),
    title:item.title,
    url:item.url,
    thumbnail:item.thumbnail || thumbnailFor(item.url),
    day,
    weekKey:dateKey(monday),
    done:false,
    rating:null,
  });

  save();
  replanArchiveId = null;
  replanDialog.close();
  currentWeekMonday = monday;
  renderAll();
  document.querySelector('[data-view="week"]').click();
});

const deleteAllExercisesBtn = document.querySelector("#deleteAllExercisesBtn");

if (deleteAllExercisesBtn) {
  deleteAllExercisesBtn.addEventListener("click", () => {
    if (!state.archive.length && !state.videos.length) {
      showMotivation("Es gibt gerade keine Übungen zu löschen.");
      return;
    }

    const shouldDelete = confirm(
      "Wirklich alle Übungen löschen? Dadurch werden sowohl die Übungsbibliothek als auch alle eingeplanten Videos aus den Wochen entfernt."
    );
    if (!shouldDelete) return;

    state.archive = [];
    state.videos = [];
    save();
    renderAll();
    showMotivation("Alle Übungen wurden gelöscht.");
  });
}


function setRandomDailySubtitle() {
  const subtitles = [
    "🌞 Heute ist ein guter Tag für kleine Schritte.",
    "🌸 Plane nur das, was dir wirklich guttut.",
    "🌿 Weniger Hektik. Mehr Leben.",
    "💛 Jeder kleine Schritt ist wertvoll.",
    "🍀 Auch freie Zeit gehört zu einem guten Plan.",
    "🌈 Eine gute Woche beginnt mit einem ruhigen Moment.",
    "✨ Lass heute Platz für schöne Überraschungen."
  ];

  const el = document.querySelector("#dailySubtitle");
  if (!el) return;

  let index = Math.floor(Math.random() * subtitles.length);

  // Wenn möglich, nicht zweimal direkt hintereinander denselben Satz zeigen.
  const lastIndex = Number(sessionStorage.getItem("myWeek.lastSubtitleIndex"));
  if (subtitles.length > 1 && Number.isInteger(lastIndex) && index === lastIndex) {
    index = (index + 1) % subtitles.length;
  }

  el.textContent = subtitles[index];
  sessionStorage.setItem("myWeek.lastSubtitleIndex", String(index));
}


function setLoginMessage(message="") {
  const el = document.querySelector("#loginError");
  if (el) el.textContent = message;
}

function showLoginGate(show) {
  document.querySelector("#loginGate")?.classList.toggle("hidden", !show);
  document.querySelector("#logoutBtn")?.classList.toggle("hidden", show);
}

function applyCloudData(data) {
  cloudApplying = true;
  try {
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.todos = Array.isArray(data.todos) ? data.todos : [];
    state.archive = Array.isArray(data.archive) ? data.archive : [];
    if (data.school?.children) state.school = data.school;
    if (data.familySettings) state.familySettings = data.familySettings;
    state.settings = {...(state.settings || {}), ...(data.settings || {})};
    saveLocal();
    renderAll();
  } finally {
    cloudApplying = false;
  }
}

function startCloudSync() {
  if (cloudUnsubscribe) cloudUnsubscribe();

  const ref = firebase.firestore().collection("families").doc("shared");
  let firstSnapshot = true;

  cloudUnsubscribe = ref.onSnapshot(async snap => {
    if (!snap.exists) {
      if (firstSnapshot) {
        cloudReady = true;
        firstSnapshot = false;
        // First family login: create the shared document from the clean local state.
        scheduleCloudSave();
      }
      return;
    }

    applyCloudData(snap.data());
    cloudReady = true;
    firstSnapshot = false;
  }, err => {
    console.error("Firestore sync failed:", err);
    cloudReady = false;
    setLoginMessage("Die Verbindung zur gemeinsamen Familienwoche ist fehlgeschlagen.");
  });
}

document.querySelector("#familyLoginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  setLoginMessage("");
  const email = document.querySelector("#familyLoginEmail")?.value.trim();
  const password = document.querySelector("#familyLoginPassword")?.value || "";

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error("Login failed:", err);
    const friendly = {
      "auth/invalid-credential":"E-Mail oder Passwort stimmt nicht.",
      "auth/invalid-email":"Bitte prüfe die E-Mail-Adresse.",
      "auth/too-many-requests":"Zu viele Versuche. Bitte später noch einmal probieren."
    };
    setLoginMessage(friendly[err.code] || "Anmeldung nicht möglich. Bitte Zugangsdaten prüfen.");
  }
});

document.querySelector("#logoutBtn")?.addEventListener("click", () => firebase.auth().signOut());

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    setLoginMessage("");
    showLoginGate(false);
    startCloudSync();
  } else {
    cloudReady = false;
    if (cloudUnsubscribe) {
      cloudUnsubscribe();
      cloudUnsubscribe = null;
    }
    showLoginGate(true);
  }
});

setRandomDailySubtitle();
updateEntryTypeUI();
migrateOldData();
renderAll();



document.addEventListener("click", (e) => {
  if (e.target?.id === "closeManualTimetableDialog" || e.target?.id === "closeManualTimetableDialog2") {
    document.querySelector("#manualTimetableDialog")?.close();
  }
});
