const days = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

const state = {
  videos: JSON.parse(localStorage.getItem("balanceProd.videos") || "[]"),
  todos: JSON.parse(localStorage.getItem("balanceProd.todos") || "[]"),
  archive: JSON.parse(localStorage.getItem("balanceProd.archive") || "[]"),
  shopping: JSON.parse(localStorage.getItem("balanceProd.shopping") || "[]"),
  recipes: JSON.parse(localStorage.getItem("balanceProd.recipes") || "[]"),
  meals: JSON.parse(localStorage.getItem("balanceProd.meals") || "{}"),
  recipeLinkFeedback: JSON.parse(localStorage.getItem("balanceProd.recipeLinkFeedback") || "{}"),
  timeTracking: JSON.parse(localStorage.getItem("balanceProd.timeTracking") || '{"entries":[],"active":[],"stopped":{},"deletedEntries":{}}'),
  trash: JSON.parse(localStorage.getItem("balanceProd.trash") || "[]"),

  workroom: JSON.parse(
    localStorage.getItem("balanceProd.workroom") ||
    '{"todos":[],"prints":[],"links":[],"substitutions":[]}'
  ),

  settings: {
    schoolYear: localStorage.getItem("balanceProd.schoolYear") || "2026-27",
    familyBorderWidth: localStorage.getItem("balanceProd.familyBorderWidth") || "3"
  }
};

state.timeTracking = state.timeTracking && typeof state.timeTracking === "object"
  ? state.timeTracking
  : {entries:[], active:[], stopped:{}, deletedEntries:{}};
state.timeTracking.entries = Array.isArray(state.timeTracking.entries) ? state.timeTracking.entries : [];
state.timeTracking.active = Array.isArray(state.timeTracking.active)
  ? state.timeTracking.active
  : (state.timeTracking.active && typeof state.timeTracking.active === "object" ? [state.timeTracking.active] : []);
state.timeTracking.stopped =
  state.timeTracking.stopped && typeof state.timeTracking.stopped === "object"
    ? state.timeTracking.stopped : {};
state.timeTracking.deletedEntries =
  state.timeTracking.deletedEntries && typeof state.timeTracking.deletedEntries === "object"
    ? state.timeTracking.deletedEntries : {};

state.recipes = Array.isArray(state.recipes) ? state.recipes : [];
state.meals = state.meals && typeof state.meals === "object" ? state.meals : {};
state.recipeLinkFeedback = state.recipeLinkFeedback && typeof state.recipeLinkFeedback === "object"
  ? state.recipeLinkFeedback : {};

let shoppingItems = state.shopping;
let cloudReady = false;
let cloudApplying = false;
let cloudSaveTimer = null;
let cloudUnsubscribe = null;

function saveLocal() {
  localStorage.setItem("balanceProd.videos", JSON.stringify(state.videos));
  localStorage.setItem("balanceProd.todos", JSON.stringify(state.todos));
  localStorage.setItem("balanceProd.archive", JSON.stringify(state.archive));
  localStorage.setItem("balanceProd.shopping", JSON.stringify(state.shopping));
  localStorage.setItem("balanceProd.recipes", JSON.stringify(state.recipes));
  localStorage.setItem("balanceProd.meals", JSON.stringify(state.meals));
  localStorage.setItem("balanceProd.recipeLinkFeedback", JSON.stringify(state.recipeLinkFeedback));
  localStorage.setItem("balanceProd.timeTracking", JSON.stringify(state.timeTracking));
  localStorage.setItem("balanceProd.trash", JSON.stringify(state.trash || []));
  localStorage.setItem("balanceProd.workroom", JSON.stringify(state.workroom));
  localStorage.setItem("balanceProd.school", JSON.stringify(state.school));
  localStorage.setItem("balanceProd.familySettings", JSON.stringify(state.familySettings));
  localStorage.setItem("balanceProd.schoolYear", state.settings?.schoolYear || "2026-27");
  localStorage.setItem("balanceProd.familyBorderWidth", state.settings?.familyBorderWidth || "3");
}

function cloudPayload() {
  // JSON round-trip removes values Firestore cannot store (e.g. undefined).
  return JSON.parse(JSON.stringify({
    videos: state.videos,
    todos: state.todos,
    trash: state.trash || [],
    archive: state.archive,
    shopping: state.shopping,
    recipes: state.recipes,
    meals: state.meals,
    recipeLinkFeedback: state.recipeLinkFeedback,
    workroom: state.workroom,
    school: state.school,
    familySettings: state.familySettings,
    settings: state.settings || {}
  }));
}

// ===== EINKAUF – eigener Firestore-Bereich =====

function shoppingCollection() {
  return firebase.firestore()
    .collection("families")
    .doc("shared")
    .collection("shoppingItems");
}

function scheduleCloudSave() {
  if (!cloudReady || cloudApplying || !firebase.auth().currentUser) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      const payload = cloudPayload();
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await firebase.firestore().collection("families").doc("shared").set(payload, { merge: true });
    } catch (err) {
      console.error("Firestore save failed:", err);
    }
  }, 300);
}

function save() {
  saveLocal();
  scheduleCloudSave();
}


function mergeByIdPreferNewer(localList = [], cloudList = []) {
  const map = new Map();
  [...(localList || []), ...(cloudList || [])].forEach(item => {
    if (!item?.id) return;
    const prev = map.get(item.id);
    const itemTs = Number(item.updatedAt || item.endedAt || item.createdAt || item.startedAt || 0);
    const prevTs = Number(prev?.updatedAt || prev?.endedAt || prev?.createdAt || prev?.startedAt || 0);
    if (!prev || itemTs >= prevTs) map.set(item.id, item);
  });
  return [...map.values()];
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
const borderWidth =
  state.settings?.familyBorderWidth ||
  document.querySelector("#familyBorderWidth")?.value ||
  "3";
  const valid = [...new Set(members)].filter(m => state.familySettings[m]);
  if (!valid.length) return "";

  if (valid.length === 1) {
    const color = familyColor(valid[0]);
return `--family-border:${color}; --family-gradient:linear-gradient(${color}, ${color}); --family-border-width:${borderWidth}px;`;
  }

  // Gemeinsame Aufgaben: ein weicher Farbrahmen aus genau den beteiligten Personenfarben.
  // Dadurch entsteht ein kleiner persönlicher "Regenbogen", ohne zusätzliche Farben zu erfinden.
  const colors = valid.map(m => familyColor(m));
  const stops = colors.map((color, i) => {
    const pos = colors.length === 1 ? 0 : Math.round((i / (colors.length - 1)) * 100);
    return `${color} ${pos}%`;
  }).join(", ");

 return `--family-border:transparent; --family-gradient:linear-gradient(110deg, ${stops}); --family-border-width:${borderWidth}px;`;
}
document.querySelector("#applyFamilyBorderWidth")?.addEventListener("click", () => {
  const width = document.querySelector("#familyBorderWidth")?.value || "3";

  state.settings = state.settings || {};
  state.settings.familyBorderWidth = width;

  document.documentElement.style.setProperty(
    "--family-border-width",
    `${width}px`
  );

  save();
  renderAll();
});

const familyBorderWidthSelect = document.querySelector("#familyBorderWidth");

if (familyBorderWidthSelect) {
  const savedBorderWidth =
    state.settings?.familyBorderWidth || "3";

  familyBorderWidthSelect.value = savedBorderWidth;

  document.documentElement.style.setProperty(
    "--family-border-width",
    `${savedBorderWidth}px`
  );
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

function noeSchoolFreeLabel(date) {
  const key = dateKey(date);
  const range = activeSchoolYear().freeRanges.find(([start,end]) =>
    isDateInRange(key, start, end)
  );
  if (!range) return "";

  const [start, end] = range;
  // Mehrtägige Bereiche sind Ferienblöcke; einzelne Tage werden neutral als schulfrei markiert.
  return start === end ? "Schulfrei" : "Ferien";
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
  const startKey = item.date;
  const endKey = item.endDate || item.date;

  return key >= startKey && key <= endKey;
}

  if (item.type !== "event" && recurrence === "none") {
    // "Heute"-To-dos aus älteren Versionen hatten teilweise weder day noch weekKey.
    // In diesem Fall ordnen wir sie sicher ihrem Erstellungstag zu, statt sie
    // aus dem Wochenplan verschwinden zu lassen.
    // "Heute" ist bewusst dynamisch: solange das To-do offen ist, gehört es
    // auf den tatsächlichen heutigen Kalendertag – unabhängig davon, wann es
    // ursprünglich angelegt wurde. So bleiben alte unerledigte Heute-To-dos
    // nicht am gestrigen Tag hängen.
    if (item.period === "today") {
      return key === dateKey(new Date());
    }

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
if (recurrence === "yearly") {
  return date.getMonth() === anchor.getMonth()
    && date.getDate() === anchor.getDate();
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
     yearly: "Jährlich",
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
let replanMode = "exercise";
let replanRecipeLink = null;

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


(function ensureSchoolFreeWeekStyle(){
  if (document.querySelector("#schoolFreeWeekStyle")) return;
  const style = document.createElement("style");
  style.id = "schoolFreeWeekStyle";
  style.textContent = `
    .day-school-free{
      color:#78805d !important;
      font-size:.58rem !important;
      letter-spacing:.02em;
    }
    .day-school-free-label{
      display:inline-flex;
      align-items:center;
      gap:3px;
      padding:3px 6px;
      border-radius:999px;
      background:rgba(226,232,210,.62);
      border:1px solid rgba(146,157,109,.18);
      color:#79815d;
      font-weight:650;
      white-space:nowrap;
    }
  `;
  document.head.appendChild(style);
})();

function renderWeek() {
  weekLabel();
  const grid = document.querySelector("#weekGrid");
  grid.innerHTML = "";
  const weekKey = currentWeekKey();

  // Mehrtägige Termine bekommen wochenweit feste Zeilen (Lanes).
  // Dadurch steht z. B. „Urlaub“ an jedem betroffenen Tag exakt auf derselben Höhe.
  const weekStartKey = dateKey(currentWeekMonday);
  const weekEndKey = dateKey(dayDate(currentWeekMonday, 6));
  const multiDayEventLanes = state.todos
    .filter(t => !t.archived && t.type === "event" && (t.recurrence || "none") === "none")
    .filter(t => t.date && (t.endDate || t.date) > t.date)
    .filter(t => t.date <= weekEndKey && (t.endDate || t.date) >= weekStartKey)
    .sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "") || String(a.id).localeCompare(String(b.id)));

  days.forEach((day, index) => {
    const dayEl = document.createElement("article");
    dayEl.className = "day";

    const date = dayDate(currentWeekMonday, index);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate < today) dayEl.classList.add("past-day");
    if (compareDate.getTime() === today.getTime()) dayEl.classList.add("today");

    const dateLabel = date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});

    const videos = state.videos.filter(v => v.day === day && v.weekKey === weekKey);
    const occurrences = state.todos.filter(t => occursOnDate(t, date));
 const todos = occurrences.filter(t =>
  (t.type || "todo") === "todo" &&
  !isOccurrenceDone(t, date)
);
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
              <div class="todo-mini-wrap">
                <label class="todo-mini grouped-todo-row ${t.superImportant ? "super-important" : ""}">
                  <input class="check mini-todo-check" data-id="${t.id}" data-date="${dateKey(date)}" type="checkbox" ${isOccurrenceDone(t, date) ? "checked":""}>
                  <span>
                    ${t.superImportant ? `<span class="tiny-star">★</span>` : ''}
                    ${escapeHtml(t.text)}
                    ${isNewEntry(t) ? `<span class="new-entry-badge">NEU</span>` : ""}
                  </span>
                </label>
                ${(!t.recurrence || t.recurrence === "none") && date < new Date(new Date().setHours(0,0,0,0))
                  ? `<button type="button" class="roll-todo-today" data-id="${t.id}" title="Auf heute verschieben" aria-label="Auf heute verschieben">→</button>`
                  : ""}
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    ` : "";

const renderEventCard = (t) => {
  const eventCategory = t.eventCategory || "normal";
  const eventMeta = {
    normal:      { icon: "✦", label: "" },
    birthday:    { icon: "🎂", label: "Geburtstag" },
    nameday:     { icon: "🌷", label: "Namenstag" },
    anniversary: { icon: "♡", label: "Jahrestag" },
    holiday:     { icon: "✦", label: "Feiertag" }
  }[eventCategory] || { icon: "✦", label: "" };

  const currentKey = dateKey(date);
  const startKey = t.date || "";
  const endKey = t.endDate || startKey;
  let displayTime = "";
  if ((t.recurrence || "none") === "schoolyear-noe") {
    if (t.time) displayTime = t.time + (t.endTime ? "–" + t.endTime : "");
  } else if (startKey === endKey) {
    if (t.time) displayTime = t.time + (t.endTime ? "–" + t.endTime : "");
  } else if (currentKey === startKey) {
    displayTime = t.time || "";
  } else if (currentKey === endKey) {
    displayTime = t.endTime ? "bis " + t.endTime : "";
  }

  const groupKey = todoGroupKey(t);
  return `
    <div class="person-todo-group grouped-family-block event-person-block ${groupAccentClass(groupKey)}"
         style="${groupKey === "shared"
           ? `--group-border:${sharedGroupGradient([t])}`
           : `--group-border:${familyColor(groupKey) || "#c8c0ba"}`}">
      <div class="person-todo-group-title">${todoGroupLabel(groupKey)}</div>
      <div class="event-mini event-display grouped-todo-row ${t.superImportant ? "super-important" : ""}">
        <span class="event-symbol">${eventMeta.icon}</span>
        <span class="event-copy">
          ${displayTime ? `<strong>${escapeHtml(displayTime)}</strong>` : ""}
          ${eventMeta.label ? `<span class="event-kind">${eventMeta.label}</span>` : ""}
          ${t.superImportant ? `<span class="tiny-star">★</span>` : ""}
          ${escapeHtml(t.text)}
          ${isNewEntry(t) ? `<span class="new-entry-badge">NEU</span>` : ""}
        </span>
      </div>
    </div>`;
};

const multiDayIds = new Set(multiDayEventLanes.map(t => t.id));
const singleDayEvents = events
  .filter(t => !multiDayIds.has(t.id))
  .sort((a,b) => (a.time || "").localeCompare(b.time || ""));

const eventHtml = (events.length || multiDayEventLanes.length) ? `
  <div class="day-events">
    <div class="day-todos-title">Termine</div>
    <div class="multiday-event-lanes">
      ${multiDayEventLanes.map(t => occursOnDate(t, date)
        ? `<div class="multiday-event-lane">${renderEventCard(t)}</div>`
        : `<div class="multiday-event-lane multiday-event-placeholder" aria-hidden="true"></div>`
      ).join("")}
    </div>
    ${singleDayEvents.map(t => renderEventCard(t)).join("")}
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

    // Essen bewusst ganz unten im Tag, direkt vor dem Übungsbereich.
    const mealStored = normalizeMealEntry(state.meals?.[dateKey(date)]);
    const mealLabel = mealStored?.label || "";
    const mealUrl = mealStored?.url || "";

    const mealRecipe = mealStored?.recipeId
      ? state.recipes.find(r => r.id === mealStored.recipeId)
      : recipeByTitle(mealLabel);

    const mealHtml = mealLabel ? (
      mealRecipe ? `
        <button type="button"
                class="day-meal has-recipe"
                data-recipe-id="${mealRecipe.id}">
          <span class="day-meal-label">ESSEN</span>
          <strong>${escapeHtml(mealLabel)}</strong>
          <span class="day-meal-open">Rezept ↗</span>
        </button>
      ` : mealUrl ? `
        <a class="day-meal has-link"
           href="${escapeHtml(mealUrl)}"
           target="_blank"
           rel="noopener">
          <span class="day-meal-label">ESSEN</span>
          <strong>${escapeHtml(mealLabel)}</strong>
          <span class="day-meal-open">Öffnen ↗</span>
        </a>
      ` : `
        <div class="day-meal">
          <span class="day-meal-label">ESSEN</span>
          <strong>${escapeHtml(mealLabel)}</strong>
        </div>
      `
    ) : "";

    dayEl.innerHTML = `
      <h3>${day}<span class="day-date">${dateLabel}</span></h3>
      ${(() => {
        const schoolFree = noeSchoolFreeLabel(date);
        if (schoolFree) {
          return `<div class="day-home-times day-school-free" aria-label="${schoolFree}">
            <span class="day-school-free-label">🌿 ${schoolFree}</span>
          </div>`;
        }

        const rows = ["1","2"].map(cid => {
          const tm = homeByForDate(cid, date);
          const child = state.school.children[cid];
          if (!tm || !child) return "";
          return `<span class="day-home-person"><span>${escapeHtml(child.name)}</span><strong>${escapeHtml(tm)}</strong></span>`;
        }).filter(Boolean);
        return rows.length ? `<div class="day-home-times" aria-label="Zu Hause bis">${rows.join("")}</div>` : "";
      })()}
      ${eventHtml}
      ${schoolHtml}${todoHtml}
      ${mealHtml}
      ${videoHtml
        ? `<div class="day-bottom-slot">
             <details class="day-video-details">
               <summary>▷ Übung${videos.length === 1 ? "" : "en"} <span>${videos.length}</span></summary>
               <div class="day-video-details-content">${videoHtml}</div>
             </details>
           </div>`
        : ""}
    `;
    grid.appendChild(dayEl);
  });

  document.querySelectorAll(".day-meal.has-recipe").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.recipeId);
      if (recipe) showRecipeDetail(recipe);
    });
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
if (!item.recurrence || item.recurrence === "none") {
  item.completedAt = e.target.checked ? Date.now() : null;
}
    save();
    renderAll();

    if (!wasDone && e.target.checked) showMotivation(todoMotivationalMessage());
  }));

  document.querySelectorAll(".roll-todo-today").forEach(btn => btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    const item = state.todos.find(t => t.id === e.currentTarget.dataset.id);
    if (!item) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const dayNames = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
    const monday = getMonday(today);

    item.period = "week";
    item.day = dayNames[today.getDay()];
    item.weekKey = dateKey(monday);
    item.anchorDate = dateKey(today);
    item.done = false;
    item.completedAt = null;
    item.updatedAt = Date.now();

    save();
    renderAll();
    showMotivation("Auf heute verschoben ✓");
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
function isNewEntry(item) {
  if (!item.createdAt) return false;

  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return Date.now() - item.createdAt < threeDays;
}
const expandedTodoGroups = new Set();
function renderTodos() {
  const list = document.querySelector("#todoList");
  let todos = state.todos.filter(t => !t.archived);

  if (todoFilter === "done") {
    todos = todos.filter(t =>
      (t.type || "todo") === "todo" &&
      (!t.recurrence || t.recurrence === "none") &&
      !!t.done
    );
  } else {
    // Erledigte normale To-dos werden in "Fertige To-dos" gesammelt.
    // Im Wochenplan bleiben sie trotzdem sichtbar und nur blasser.
    todos = todos.filter(t =>
      !(
        (t.type || "todo") === "todo" &&
        (!t.recurrence || t.recurrence === "none") &&
        !!t.done
      )
    );

    if (todoFilter === "work" || todoFilter === "private") {
      todos = todos.filter(t => t.area === todoFilter);
    }
    if (todoFilter === "todo" || todoFilter === "event") {
      todos = todos.filter(t => (t.type || "todo") === todoFilter);
    }
    if (todoFilter === "latest") {
      todos = todos.filter(t => isNewEntry(t));
    }
  }

todos.sort((a, b) => {
  // Im Reiter „Fertige To-dos“ steht das zuletzt Erledigte immer ganz oben.
  if (todoFilter === "done") {
    return (b.completedAt ?? 0) - (a.completedAt ?? 0);
  }

  const now = new Date();

  const weekdayOrder = {
    Montag: 1,
    Dienstag: 2,
    Mittwoch: 3,
    Donnerstag: 4,
    Freitag: 5,
    Samstag: 6,
    Sonntag: 7
  };

  function sortInfo(item) {
    const type = item.type || "todo";

    if (type === "todo") {
      if (item.period === "today") {
        return { rank: 1, sub: 0, time: 0 };
      }

      if (item.period === "week") {
        return {
          rank: 2,
          sub: weekdayOrder[item.day] || 99,
          time: 0
        };
      }

      if (item.period === "month") {
        return { rank: 4, sub: 0, time: 0 };
      }

      if (item.period === "later") {
        return { rank: 5, sub: 0, time: 0 };
      }

      return { rank: 5, sub: 0, time: 0 };
    }

    if (type === "event") {
      if (!item.date) {
        return {
          rank: 5,
          sub: 0,
          time: Number.MAX_SAFE_INTEGER
        };
      }

      const d = new Date(
        item.date + "T" + (item.time || "23:59")
      );

      if (d >= now) {
        return {
          rank: 3,
          sub: 0,
          time: d.getTime()
        };
      }

      return {
        rank: 6,
        sub: 0,
        time: -d.getTime()
      };
    }

    return { rank: 5, sub: 0, time: 0 };
  }

  const aa = sortInfo(a);
  const bb = sortInfo(b);

  if (aa.rank !== bb.rank) {
    return aa.rank - bb.rank;
  }

  if (aa.sub !== bb.sub) {
    return aa.sub - bb.sub;
  }

  return aa.time - bb.time;
});
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
       ${groupItems.map((t, index) => `
         <div class="todo-card grouped-main-todo ${index >= 6 && !expandedTodoGroups.has(groupKey) ? "todo-extra hidden" : (index >= 6 ? "todo-extra" : "")} ${t.superImportant ? "super-important" : ""} ${(t.recurrence || t.recurrence === "none") && t.done ? "done":""}">
            <div class="todo-main">
              ${(!t.recurrence || t.recurrence === "none")
                ? `<input class="check todo-check" data-id="${t.id}" type="checkbox" ${t.done ? "checked":""}>`
                : `<span class="series-icon" title="Wiederkehrender Eintrag">↻</span>`}
              <div>
                <div class="todo-text">
                  ${t.superImportant ? '<span class="super-star">★</span> ' : ''}
                 ${escapeHtml(t.text)}
${isNewEntry(t) ? `<span class="new-entry-badge">NEU</span>` : ""}
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
        ${groupItems.length > 6 ? `
<button
  class="secondary-btn show-more-todos"
  type="button"
  data-group="${groupKey}"
  data-expanded="${expandedTodoGroups.has(groupKey) ? "true" : "false"}">
  ${expandedTodoGroups.has(groupKey)
    ? "Weniger anzeigen"
    : `Weitere anzeigen (${groupItems.length - 6})`}
</button>
` : ""}
      </div>
    </section>
  `).join("");
document.querySelectorAll(".show-more-todos").forEach(btn => {
  btn.addEventListener("click", () => {
    const container = btn.closest(".todo-person-items");
    if (!container) return;

    const extraItems = container.querySelectorAll(".todo-extra");
    const isExpanded = btn.dataset.expanded === "true";
const groupKey = btn.dataset.group;

if (isExpanded) {
  expandedTodoGroups.delete(groupKey);
} else {
  expandedTodoGroups.add(groupKey);
}
    extraItems.forEach(item => {
      item.classList.toggle("hidden", isExpanded);
    });

    btn.dataset.expanded = isExpanded ? "false" : "true";
    btn.textContent = isExpanded
      ? `Weitere anzeigen (${extraItems.length})`
      : "Weniger anzeigen";
  });
});
  document.querySelectorAll(".todo-check").forEach(el => el.addEventListener("change", e => {
    const item = state.todos.find(t => t.id === e.target.dataset.id);
    if (!item) return;
    const wasDone = !!item.done;
    item.done = e.target.checked;
    item.updatedAt = Date.now();
    if (item.done) {
  item.completedAt = Date.now();
} else {
  item.completedAt = null;
}
    save();
    renderAll();
    if (!wasDone && item.done) {
      showMotivation(todoMotivationalMessage());
      const id=item.id;
      showUndo("To-do erledigt",()=>{const x=state.todos.find(t=>t.id===id);if(!x)return;x.done=false;x.completedAt=null;x.updatedAt=Date.now();save();renderAll();});
    }
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
    const editMonday = getMonday(new Date());
    const itemMonday = item.weekKey ? parseLocalDate(item.weekKey) : null;
    const editOffset = itemMonday ? Math.max(0, Math.round((itemMonday - editMonday) / 604800000)) : 0;
    document.querySelector("#todoWeekOffset").value = String(Math.min(2, editOffset));
    document.querySelector("#todoDay").value = item.day || "";
  document.querySelector("#eventDate").value = item.date || "";
document.querySelector("#eventEndDate").value = item.endDate || "";
document.querySelector("#eventTime").value = item.time || "";
document.querySelector("#eventEndTime").value = item.endTime || "";
document.querySelector("#eventCategory").value = item.eventCategory || "normal";
    
document.querySelector("#recurrence").value = item.recurrence || "none";
    setSelectedFamilyMembers(item.family || []);
    updateEntryTypeUI();
    updateSchoolyearNoeUI();

    document.querySelector("#addTodoBtn").textContent = "Änderungen speichern";
    document.querySelector("#cancelTodoEditBtn").classList.remove("hidden");
    document.querySelector("#todoText").focus();
    window.scrollTo({top: document.querySelector(".todo-form").offsetTop - 20, behavior:"smooth"});
  }));

  document.querySelectorAll(".delete-todo").forEach(el => el.addEventListener("click", e => {
    const id=e.currentTarget.dataset.id, item=state.todos.find(t=>t.id===id); if(!item)return;
    const trashId=trashItem("todo",item);
    state.todos=state.todos.filter(t=>t.id!==id);
    if(editingTodoId===id)resetTodoEditor();
    save();renderAll();showUndo("To-do gelöscht",()=>restoreTrashEntry(trashId));
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
  if(id==="mama"){
    return [
      "",
      "TW",
      "GLZ",
      "Anderes"
    ];
  }

  if(id==="2"){
    return ["","GU","REL","Bewegung & Sport","Werken","Anderes"];
  }

  const sel=document.querySelector("#schoolSubject1");
const v=sel
  ? [...sel.options]
      .map(o => o.value)
      .filter(Boolean)
      .filter(v => v !== "Sachunterricht")
  : [];

  return v.length
    ? ["",...new Set(v),"Anderes"]
    : ["","Deutsch","Mathematik","Englisch","Biologie","Geografie","Geschichte","Physik","Chemie","Informatik","Religion","Bewegung & Sport","Werken","Anderes"];
}
function timetablePerson(id) {
  if (id === "mama") {
    state.school.mama = state.school.mama || {
      name: familyName("a") || "Mama",
      timetableByYear: {}
    };

    state.school.mama.name = familyName("a") || "Mama";
    return state.school.mama;
  }

  return state.school.children[id];
}
function ensureManualTimetable(c){
  c.timetableByYear = c.timetableByYear || {};
  const y = state.settings?.schoolYear || "2026-27";

  if (!c.timetableByYear[y]) {
    const times = defaultLessonTimes.map(x => ({
      from: x[0],
      to: x[1]
    }));

    c.timetableByYear[y] = {
      times,
      subjects: Object.fromEntries(
        manualTimetableDayKeys.map(d => [d, Array(times.length).fill("")])
      ),
      homeBy: Object.fromEntries(
        manualTimetableDayKeys.map(d => [d, ""])
      )
    };
  }

  const t = c.timetableByYear[y];

  // Falls später Stunden hinzugefügt oder entfernt werden,
  // die Fächerlisten automatisch auf dieselbe Länge bringen.
  manualTimetableDayKeys.forEach(day => {
    if (!Array.isArray(t.subjects[day])) {
      t.subjects[day] = [];
    }

    while (t.subjects[day].length < t.times.length) {
      t.subjects[day].push("");
    }

    if (t.subjects[day].length > t.times.length) {
      t.subjects[day] = t.subjects[day].slice(0, t.times.length);
    }
  });

  return t;
}
function hasManualTimetable(c){const t=ensureManualTimetable(c);return manualTimetableDayKeys.some(d=>t.subjects[d].some(Boolean)||t.homeBy[d])}
function ttOpts(id,cur){return subjectOptionsFor(id).map(v=>`<option value="${escapeHtml(v)}" ${v===cur?"selected":""}>${escapeHtml(v||"–")}</option>`).join("")}
function renderTTMatrix(id) {
    const c = timetablePerson(id);
    const t = ensureManualTimetable(c);
    const h = document.querySelector(`#ttMatrix${id}`);

    if (!h) return;

    h.innerHTML = `
        <div class="tt-table-wrap">
            <table class="tt-table ${id === "mama" ? "tt-mama" : ""}">
                <thead>
                    <tr>
                        <th>Zeit</th>
                        ${manualTimetableDayNames.map(x => `<th>${x}</th>`).join("")}
                    </tr>
                </thead>

                <tbody>
                    <tr class="tt-home-row tt-home-row-top">
                        <th>⌂ Zu Hause bis</th>
                        ${manualTimetableDayKeys.map(d => `
                            <td>
                                <input
                                    class="tt-home-input"
                                    data-child="${id}"
                                    data-day="${d}"
                                    value="${escapeHtml(t.homeBy[d] || "")}"
                                    placeholder="13:30">
                            </td>
                        `).join("")}
                    </tr>

                    ${t.times.map((tm, r) => `
                        <tr>
                            <th>
                                <input
                                    class="tt-time-text"
                                    data-child="${id}"
                                    data-row="${r}"
                                    data-part="from"
                                    value="${escapeHtml(tm.from)}">
                                –
                                <input
                                    class="tt-time-text"
                                    data-child="${id}"
                                    data-row="${r}"
                                    data-part="to"
                                    value="${escapeHtml(tm.to)}">
                            </th>

                            ${manualTimetableDayKeys.map(day => {
                                const current = t.subjects[day][r] || "";
                                const options = subjectOptionsFor(id);
                                const isCustom =
                                    current !== "" &&
                                    !options.includes(current);

                                return `
                                    <td>
                                        <select
                                            class="tt-subject-cell"
                                            data-child="${id}"
                                            data-day="${day}"
                                            data-row="${r}">
                                            ${ttOpts(
                                                id,
                                                isCustom ? "Anderes" : current
                                            )}
                                        </select>

                                        <input
                                            class="tt-custom-subject ${isCustom ? "" : "hidden"}"
                                            data-child="${id}"
                                            data-day="${day}"
                                            data-row="${r}"
                                            value="${isCustom ? escapeHtml(current) : ""}"
                                            placeholder="Fach eingeben">
                                    </td>
                                `;
                            }).join("")}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    h.querySelectorAll(".tt-subject-cell").forEach(select => {
        select.addEventListener("change", () => {
            const cell = select.closest("td");
            const custom = cell.querySelector(".tt-custom-subject");

            if (select.value === "Anderes") {
                custom.classList.remove("hidden");
                custom.focus();
            } else {
                custom.classList.add("hidden");
                custom.value = "";
            }
        });
    });
}
function openManualTimetableEditor(id){renderTTMatrix(id);document.querySelector(`#manualTimetableWrap${id}`)?.classList.remove("hidden")}
function closeManualTimetableEditor(id){document.querySelector(`#manualTimetableWrap${id}`)?.classList.add("hidden")}
function saveTTMatrix(id) {
  const c = timetablePerson(id);
  const t = ensureManualTimetable(c);

  document
    .querySelectorAll(`.tt-time-text[data-child="${id}"]`)
    .forEach(x => {
      t.times[+x.dataset.row][x.dataset.part] = x.value.trim();
    });

  document
    .querySelectorAll(`.tt-subject-cell[data-child="${id}"]`)
    .forEach(select => {
      const day = select.dataset.day;
      const row = +select.dataset.row;

      if (select.value === "Anderes") {
        const customInput =
          select.closest("td")?.querySelector(".tt-custom-subject");

        t.subjects[day][row] =
          (customInput?.value || "").trim();
      } else {
        t.subjects[day][row] = select.value;
      }
    });

  document
    .querySelectorAll(`.tt-home-input[data-child="${id}"]`)
    .forEach(x => {
      t.homeBy[x.dataset.day] = x.value.trim();
    });

  save();
  renderAll();
  closeManualTimetableEditor(id);
}
function showManualTimetable(id){
 const c=timetablePerson(id),t=ensureManualTimetable(c),
    d=document.querySelector("#manualTimetableDialog"),
    title=document.querySelector("#manualTimetableDialogTitle"),
    out=document.querySelector("#manualTimetableDisplay");
  if(!d||!out)return;

  title.textContent=`${c.name||id} – Stundenplan`;
out.innerHTML=`<div class="tt-table-wrap"><table class="tt-table tt-view-table ${id === "mama" ? "tt-mama" : ""}">
    <thead><tr><th>Zeit</th>${manualTimetableDayNames.map(x=>`<th>${x}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="tt-home-row tt-home-row-top"><th>⌂ Zu Hause bis</th>${manualTimetableDayKeys.map(day=>`<td>${escapeHtml(t.homeBy[day]||"–")}</td>`).join("")}</tr>
      ${t.times.map((tm,r)=>`<tr><th>${escapeHtml(tm.from)}–${escapeHtml(tm.to)}</th>${manualTimetableDayKeys.map(day=>`<td>${escapeHtml(t.subjects[day][r]||"")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table></div>`;
  d.showModal();
}
function bindManualTimetableControls(){document.querySelectorAll(".save-tt-matrix").forEach(b=>{if(b.dataset.bound)return;b.dataset.bound="1";b.addEventListener("click",e=>saveTTMatrix(e.currentTarget.dataset.child))})}
document.querySelectorAll(".add-tt-row").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.child;
    const c = timetablePerson(id);
    const t = ensureManualTimetable(c);

    const last = t.times[t.times.length - 1];
    t.times.push({
      from: last ? last.to : "",
      to: ""
    });

    manualTimetableDayKeys.forEach(day => {
      t.subjects[day].push("");
    });

    save();
    renderTTMatrix(id);
  });
});

document.querySelectorAll(".remove-tt-row").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.child;
    const c = timetablePerson(id);
    const t = ensureManualTimetable(c);

    if (t.times.length <= 1) return;

    t.times.pop();

    manualTimetableDayKeys.forEach(day => {
      t.subjects[day].pop();
    });

    save();
    renderTTMatrix(id);
  });
});
function homeByForDate(id,date){const c=timetablePerson(id);if(!c)return"";const t=ensureManualTimetable(c),day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];return t.homeBy[day]||""}

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
document.querySelectorAll(".timetable-switch").forEach(btn => {
  btn.addEventListener("click", () => {
    showManualTimetable(btn.dataset.person);
  });
});
// Stundenplan-Auswahl auf der Wochenplan-Seite
const familyTimetableDialog = document.querySelector("#familyTimetableDialog");

document.querySelector("#openFamilyTimetableBtn")?.addEventListener("click", () => {
  document.querySelector("#manualTimetableWrapmama")?.classList.add("hidden");
  familyTimetableDialog?.showModal();
});

document.querySelector("#closeFamilyTimetableDialog")?.addEventListener("click", () => {
  familyTimetableDialog?.close();
});

// ===== PAPA – Alles auf einen Blick =====

const papaQuotes = [
  `🌿 „Der Feige stirbt schon vielmal, eh’ er stirbt, die Tapfern kosten einmal nur den Tod.“ — Shakespeare`,
  `🌿 Ich kann mein Leben nicht dadurch schützen, dass ich es vorsorglich mit Angst verbringe.`,
  `🌿 Wachsamkeit ist wertvoll, wenn sie mir dient. Dauerwachsamkeit darf ich auf ihren Nutzen prüfen.`,
  `🌿 Nicht jede denkbare Gefahr verdient meine dauernde Aufmerksamkeit.`,
  `🌿 Wie viel zusätzliche Sicherheit bekomme ich tatsächlich für die Energie, die ich gerade investiere?`,
  `🌿Wenn eine Strategie mich niemals „genug“ sagen lässt, lohnt es sich, nicht nur die Gefahr, sondern auch die Strategie zu überprüfen.`,
  `🌿 Gesundheit ist kostbar. Aber auch die Zeit, in der ich gesund bin, ist kostbar.`,
  `🌿 Ich möchte meine Gesundheit schützen, ohne dafür mein gegenwärtiges Leben zu opfern.`,
  `✦ Eine Möglichkeit ist noch kein Ereignis.`,
  `✦ Mein Warnsystem darf mich informieren. Es muss nicht mein Leben führen.`,
  `✦ Mehr Kontrolle bedeutet nicht automatisch mehr Sicherheit.`,
  `✦ Ich darf zwischen sinnvoller Vorsorge und endloser Rückversicherung unterscheiden.`,
  `✦ Die erste vernünftige Kontrolle kann sehr wertvoll sein. Die hundertste muss deshalb nicht hundertmal wertvoller sein.`,
  `⚖️ Was kostet mich meine Wachsamkeit – und welchen messbaren Nutzen bekomme ich dafür zurück?`,
  `🌿 Mein Ziel ist nicht möglichst wenig Angst, sondern ein möglichst vernünftiger Umgang mit tatsächlichen Risiken.`,
  `🌿 Absolute Sicherheit ist kein realistisches Ziel. Angemessene Vorsorge ist eines.`,
  `🌿 Ich muss nicht jede Gefahr ausschließen, bevor ich leben darf.`,
  `🌿 Wenn ich heute keine konkreten Hinweise auf Gefahr habe, darf auch das eine relevante Information sein.`,
  `🌿 Nicht kontrollierbar bedeutet nicht automatisch ausgeliefert.`,
  `🌿 Ich bin verletzlich – aber ich bin nicht wehrlos.`,
  `🌿 Früher konnte Wachsamkeit notwendig sein. Heute darf ich neu berechnen, wie viel davon ich tatsächlich brauche.`,
  `❤️ Eine Strategie, die früher geschützt hat, muss heute nicht mehr denselben Nutzen haben.`,
  `❤️ Ich darf meinem Warnsystem die Gegenwart zeigen, statt ihm die Vergangenheit vorzuwerfen.`,
  `❤️ Nicht alles im Blick zu behalten ist nicht dasselbe wie verantwortungslos zu sein.`,
  `❤️ Ich kann aufmerksam sein, ohne ständig Alarmbereitschaft zu halten.`,
  `❤️ Wenn etwas wirklich zu tun ist, möchte ich handeln. Wenn nichts zu tun ist, möchte ich nicht künstlich eine Aufgabe erzeugen.`,
  `❤️ Die Frage lautet nicht nur: „Was könnte passieren?“ Sondern auch: „Wie wahrscheinlich ist es, und was ist jetzt sinnvoll zu tun?“`,
  `✦ Wenn ich meine gesamte Lebensqualität für die Vermeidung eines möglichen Verlustes ausgebe, gehört auch dieser Preis in meine Rechnung.`,
  `❤️ Gesundheit soll meinem Leben dienen – mein Leben muss nicht vollständig der Überwachung meiner Gesundheit dienen.`,
  `✦ Ich brauche keine Garantie für die Zukunft, um eine vernünftige Entscheidung für heute treffen zu können.`
];

function setRandomPapaQuote() {
  const quote = document.querySelector("#papaQuote");
  if (!quote) return;

  quote.textContent =
    papaQuotes[Math.floor(Math.random() * papaQuotes.length)];
}

const papaOverviewDialog = document.querySelector("#papaOverviewDialog");

function papaEntryIsRelevant(t) {
  const family = Array.isArray(t.family) ? t.family : [];

  // Alles anzeigen, bei dem Papa beteiligt ist.
  return family.includes("b");
}

function papaTodoIsVisible(t) {
  if ((t.type || "todo") !== "todo") return true;

  // Wiederkehrende To-dos werden wie im normalen Wochenplan behandelt.
  if (t.recurrence && t.recurrence !== "none") return true;

  if (!t.done) return true;
  if (!t.completedAt) return true;

  // Erledigte To-dos am Erledigungstag noch anzeigen.
  const completedDay = new Date(t.completedAt);
  completedDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return completedDay.getTime() === today.getTime();
}

function renderPapaOverview(weekOffset = 0) {
  const list = document.querySelector("#papaOverviewList");
  if (!list) return;

  const monday = new Date(currentWeekMonday);
  monday.setDate(monday.getDate() + (weekOffset * 7));

  const weekEntries = [];

  days.forEach((dayName, index) => {
    const date = dayDate(monday, index);
    const today = new Date();
today.setHours(0, 0, 0, 0);

const checkDate = new Date(date);
checkDate.setHours(0, 0, 0, 0);

if (checkDate < today) return;

    const entries = state.todos
      .filter(t => occursOnDate(t, date))
      .filter(papaEntryIsRelevant)
      .filter(papaTodoIsVisible);

    if (!entries.length) return;

    weekEntries.push({
      dayName,
      date,
      entries
    });
  });

  if (!weekEntries.length) {
    list.innerHTML = `
      <div class="papa-overview-empty">
        In dieser Woche ist für Papa nichts eingetragen.
      </div>
    `;
    return;
  }

  list.innerHTML = weekEntries.map(day => {
    const dateLabel = day.date.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit"
    });

return `
  <section class="papa-overview-day">

    <div class="papa-overview-day-head">
      <strong>${day.dayName}</strong>
      <span> · ${dateLabel}</span>
    </div>

    <div class="papa-overview-day-entries">
      ${day.entries.map(t => {
        const isEvent = t.type === "event";

        let time = "";

        if (isEvent) {
          if (t.time && t.endTime) {
            time = `${t.time}–${t.endTime}`;
          } else if (t.time) {
            time = t.time;
          } else if (t.endTime) {
            time = `bis ${t.endTime}`;
          }
        }

        if (isEvent) {
          return `
            <div class="papa-overview-entry event">
              <span class="papa-overview-symbol">✦</span>

              <span class="papa-overview-entry-text">
                ${time ? `<strong>${escapeHtml(time)}</strong> ` : ""}
                ${escapeHtml(t.text || "")}
              </span>
            </div>
          `;
        }

        return `
          <div class="papa-overview-entry todo">
            <span class="papa-overview-symbol">☐</span>

            <span class="papa-overview-entry-text">
              ${escapeHtml(t.text || "")}
            </span>
          </div>
        `;
      }).join("")}
    </div>

  </section>
`;
  }).join("");
}

document.querySelector("#openPapaOverviewBtn")?.addEventListener("click", () => {
  setRandomPapaQuote();
  renderPapaOverview(0);
  papaOverviewDialog?.showModal();
});

document.querySelector("#closePapaOverviewBtn")?.addEventListener("click", () => {
  papaOverviewDialog?.close();
});

document.querySelectorAll(".papa-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const offset = Number(btn.dataset.weekOffset || 0);
    renderPapaOverview(offset);
  });
});

document.querySelectorAll(".family-timetable-person").forEach(btn => {
  btn.addEventListener("click", () => {
    const person = btn.dataset.person;

           
 if (person === "1" || person === "2") {
    familyTimetableDialog?.close();
    showManualTimetable(person);
    return;
}

       if (person === "mama") {
  renderTTMatrix("mama");
  document.querySelector("#manualTimetableWrapmama")?.classList.remove("hidden");
  return;
}
  });
});
const manualTimetableDialog = document.querySelector("#manualTimetableDialog");
document.querySelector("#closeManualTimetableDialog")?.addEventListener("click", () => manualTimetableDialog?.close());
document.querySelector("#closeManualTimetableDialog2")?.addEventListener("click", () => manualTimetableDialog?.close());

function timeCategoryLabel(key) {
  return {
    pc: "🖥 PC & Büro",
    prep: "✂ Vorbereitung",
    household: "🏡 Haushalt",
    cook: "🍳 Kochen",
    shopping: "🛒 Einkaufen",
    repair: "🔧 Reparaturen",
    garden: "🌿 Garten & draußen",
    sport: "🏃 Sport & Bewegung",
    help: "🤝 Helfen & Unterstützen",
    school: "✏ Lernen & Schule",
    organize: "🗂 Organisieren", // Altbestand lesbar
    errands: "🛒 Einkaufen",    // Altbestand sinnvoll umbenannt
    other: "✨ Sonstiges"
  }[key] || "✨ Sonstiges";
}

function formatMinutes(total) {
  const mins = Math.max(0, Math.round(Number(total) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} Min.`;
  if (!m) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

function weekStartForDate(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d;
}


const TIME_TRACKING_LOCAL_KEY = "balanceProd.timeTracking";

let timeTrackingUnsubscribe = null;
let timeTrackingCloudSaveTimer = null;
let timeTrackingCloudApplying = false;
let timeTrackingPollTimer = null;

function writeTimeTrackingLocalOnly() {
  try {
    localStorage.setItem(TIME_TRACKING_LOCAL_KEY, JSON.stringify(state.timeTracking));
  } catch (err) {
    console.warn("Zeitdaten konnten lokal nicht gespeichert werden:", err);
  }
}

function timeTrackingDoc() {
  // Zeittracking liegt absichtlich im bereits funktionierenden gemeinsamen
  // Familien-Dokument. So benutzen PC und Tablet exakt denselben Firestore-Pfad.
  return firebase.firestore()
    .collection("families")
    .doc("shared");
}

function normalizeTimeTrackingData(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    entries: Array.isArray(source.entries) ? source.entries : [],
    active: Array.isArray(source.active)
      ? source.active
      : (source.active && typeof source.active === "object" ? [source.active] : []),
    stopped: source.stopped && typeof source.stopped === "object" ? source.stopped : {},
    deletedEntries:
      source.deletedEntries && typeof source.deletedEntries === "object"
        ? source.deletedEntries
        : {}
  };
}

function mergeStoppedMaps(a, b) {
  const result = {...(a || {})};
  Object.entries(b || {}).forEach(([id, ts]) => {
    result[id] = Math.max(Number(result[id] || 0), Number(ts || 0));
  });
  return result;
}

function mergeTimeDeletionMaps(a, b) {
  const result = {...(a || {})};
  Object.entries(b || {}).forEach(([id, ts]) => {
    result[id] = Math.max(Number(result[id] || 0), Number(ts || 0));
  });
  return result;
}

function mergeTimeTrackingData(a, b) {
  const A = normalizeTimeTrackingData(a);
  const B = normalizeTimeTrackingData(b);

  const stopped = mergeStoppedMaps(A.stopped, B.stopped);
  const deletedEntries = mergeTimeDeletionMaps(A.deletedEntries, B.deletedEntries);

  // Zuerst nach ID zusammenführen, danach echte Löschungen anwenden.
  const mergedEntries = mergeByIdPreferNewer(A.entries, B.entries);
  const entries = mergedEntries.filter(entry => {
    if (!entry?.id) return true;
    const deletedAt = Number(deletedEntries[entry.id] || 0);
    const entryUpdatedAt = Number(entry.updatedAt || entry.endedAt || entry.createdAt || 0);

    // Eine neuere Löschmarke gewinnt gegen einen alten Datensatz auf einem anderen Gerät.
    return !(deletedAt && deletedAt >= entryUpdatedAt);
  });

  const finishedIds = new Set(entries.map(entry => entry?.id).filter(Boolean));
  const activeMap = new Map();

  [...A.active, ...B.active].forEach(timer => {
    if (!timer?.id || finishedIds.has(timer.id)) return;

    // Auch ein bereits gelöschter fertiger Eintrag soll nicht durch einen
    // alten Active-Stand wieder auferstehen.
    if (deletedEntries[timer.id]) return;

    const stoppedAt = Number(stopped[timer.id] || 0);
    if (stoppedAt && stoppedAt >= Number(timer.startedAt || 0)) return;

    const prev = activeMap.get(timer.id);
    if (!prev || Number(timer.startedAt || 0) >= Number(prev.startedAt || 0)) {
      activeMap.set(timer.id, timer);
    }
  });

  return {
    entries,
    active:[...activeMap.values()],
    stopped,
    deletedEntries
  };
}

async function saveTimeTrackingToCloudNow() {
  if (timeTrackingCloudApplying || !firebase.auth().currentUser) return;

  const ref = timeTrackingDoc();
  const localSnapshot = normalizeTimeTrackingData(state.timeTracking);

  try {
    const merged = await firebase.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const remote = snap.exists ? (snap.data()?.timeTracking || {}) : {};
      const next = mergeTimeTrackingData(remote, localSnapshot);

      tx.set(ref, {
        timeTracking: next,
        timeTrackingUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return next;
    });

    state.timeTracking = mergeTimeTrackingData(state.timeTracking, merged);
    writeTimeTrackingLocalOnly();
  } catch (err) {
    console.error("Zeittracking-Synchronisation fehlgeschlagen:", err);
  }
}

function scheduleTimeTrackingCloudSave() {
  if (!firebase.auth().currentUser) return;
  clearTimeout(timeTrackingCloudSaveTimer);
  timeTrackingCloudSaveTimer = setTimeout(saveTimeTrackingToCloudNow, 120);
}

function saveTimeTrackingImmediately() {
  writeTimeTrackingLocalOnly();

  // Für laufende Timer ist Geräte-Synchronität wichtiger als Debouncing:
  // sofort in die Cloud schreiben. Der kurze Debounce bleibt als Fallback.
  if (firebase.auth().currentUser) {
    saveTimeTrackingToCloudNow();
    scheduleTimeTrackingCloudSave();
  }
}

async function refreshTimeTrackingFromCloud() {
  if (!firebase.auth().currentUser) return;

  try {
    const snap = await timeTrackingDoc().get();
    if (!snap.exists) return;

    timeTrackingCloudApplying = true;
    try {
      const remoteTimeTracking = snap.data()?.timeTracking;
      if (!remoteTimeTracking) return;
      state.timeTracking = mergeTimeTrackingData(state.timeTracking, remoteTimeTracking);
      writeTimeTrackingLocalOnly();
      renderTimeTracking();
    } finally {
      timeTrackingCloudApplying = false;
    }
  } catch (err) {
    console.warn("Zeittracking-Aktualisierung konnte nicht geladen werden:", err);
  }
}

function startTimeTrackingPollFallback() {
  if (timeTrackingPollTimer) clearInterval(timeTrackingPollTimer);

  // onSnapshot bleibt die Hauptsynchronisation.
  // Der Pull hilft besonders auf Tablets, wenn der Browser Listener pausiert.
  timeTrackingPollTimer = setInterval(() => {
    if (!document.hidden) refreshTimeTrackingFromCloud();
  }, 12000);
}

async function startTimeTrackingSync() {
  if (timeTrackingUnsubscribe) {
    timeTrackingUnsubscribe();
    timeTrackingUnsubscribe = null;
  }

  const ref = timeTrackingDoc();

  try {
    const own = await ref.get();
    const remoteTimeTracking = own.exists ? own.data()?.timeTracking : null;
    const initial = mergeTimeTrackingData(state.timeTracking, remoteTimeTracking);

    state.timeTracking = initial;
    writeTimeTrackingLocalOnly();

    // Falls bisher nur lokale Zeitdaten vorhanden waren, einmalig ins
    // gemeinsame Familien-Dokument übernehmen.
    if (!remoteTimeTracking && (initial.active.length || initial.entries.length)) {
      await ref.set({
        timeTracking: initial,
        timeTrackingUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Zeittracking-Migration konnte nicht abgeschlossen werden:", err);
  }

  timeTrackingUnsubscribe = ref.onSnapshot(snap => {
    if (!snap.exists) return;
    const remoteTimeTracking = snap.data()?.timeTracking;
    if (!remoteTimeTracking) return;

    timeTrackingCloudApplying = true;
    try {
      state.timeTracking = mergeTimeTrackingData(state.timeTracking, remoteTimeTracking);
      writeTimeTrackingLocalOnly();
      renderTimeTracking();
    } finally {
      timeTrackingCloudApplying = false;
    }
  }, err => {
    console.error("Zeittracking Live-Sync fehlgeschlagen:", err);
  });

  await refreshTimeTrackingFromCloud();
  startTimeTrackingPollFallback();
}

function restoreTimeTrackingFromLocal() {
  try {
    const raw = localStorage.getItem(TIME_TRACKING_LOCAL_KEY);
    if (!raw) return;
    const local = JSON.parse(raw);
    if (!local || typeof local !== "object") return;

    const localEntries = Array.isArray(local.entries) ? local.entries : [];
    state.timeTracking.entries = mergeByIdPreferNewer(
      state.timeTracking.entries,
      localEntries
    );

    const localStopped =
      local.stopped && typeof local.stopped === "object" ? local.stopped : {};
    const currentStopped =
      state.timeTracking.stopped && typeof state.timeTracking.stopped === "object"
        ? state.timeTracking.stopped
        : {};

    state.timeTracking.stopped = {
      ...localStopped,
      ...currentStopped
    };

    const localActive = Array.isArray(local.active)
      ? local.active
      : (local.active && typeof local.active === "object" ? [local.active] : []);
    const currentActive = Array.isArray(state.timeTracking.active) ? state.timeTracking.active : [];

    const stopped = state.timeTracking.stopped || {};
    const activeMap = new Map();

    [...currentActive, ...localActive].forEach(timer => {
      if (!timer?.id) return;

      const stoppedAt = Number(stopped[timer.id] || 0);
      if (stoppedAt && stoppedAt >= Number(timer.startedAt || 0)) return;

      const prev = activeMap.get(timer.id);
      if (!prev || Number(timer.startedAt || 0) >= Number(prev.startedAt || 0)) {
        activeMap.set(timer.id, timer);
      }
    });

    state.timeTracking.active = [...activeMap.values()];
  } catch (err) {
    console.warn("Lokale Zeitdaten konnten nicht wiederhergestellt werden:", err);
  }
}

function formatElapsedWithSeconds(startedAt, nowOverride = Date.now()) {
  const seconds = Math.max(0, Math.floor((Number(nowOverride) - Number(startedAt || nowOverride)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

let liveTimeTicker = null;

const TIME_TRACKING_MAX_MS = 5 * 60 * 60 * 1000;

function startLiveTimeTicker() {
  clearInterval(liveTimeTicker);
  const activeTimers = Array.isArray(state.timeTracking.active) ? state.timeTracking.active : [];
  if (!activeTimers.length) return;

  liveTimeTicker = setInterval(() => {
    const now = Date.now();

    document.querySelectorAll(".active-time-elapsed").forEach(el => {
      const startedAt = Number(el.dataset.startedAt || now);
      const cappedNow = Math.min(now, startedAt + TIME_TRACKING_MAX_MS);
      el.textContent = formatElapsedWithSeconds(startedAt, cappedNow);
    });

    const expired = (state.timeTracking.active || []).filter(timer =>
      now - Number(timer.startedAt || now) >= TIME_TRACKING_MAX_MS
    );

    expired.forEach(timer => {
      stopTimeTracking(timer.id, Number(timer.startedAt) + TIME_TRACKING_MAX_MS);
    });
  }, 1000);
}

function trackingPersonColor(key) {
  const source = familyColor(key) || "#aaa29c";

  const hex = String(source).trim().replace("#","");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#d7d2ce";

  let r = parseInt(hex.slice(0,2),16);
  let g = parseInt(hex.slice(2,4),16);
  let b = parseInt(hex.slice(4,6),16);

  // Etwas entsättigen → rauchiger.
  const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
  const desaturate = 0.34;
  r = Math.round(r * (1 - desaturate) + gray * desaturate);
  g = Math.round(g * (1 - desaturate) + gray * desaturate);
  b = Math.round(b * (1 - desaturate) + gray * desaturate);

  // Deutlich aufhellen, damit die kräftigeren To-do-Farben im Tracking ruhiger wirken.
  const lighten = 0.62;
  r = Math.round(r * (1 - lighten) + 255 * lighten);
  g = Math.round(g * (1 - lighten) + 255 * lighten);
  b = Math.round(b * (1 - lighten) + 255 * lighten);

  return "#" + [r,g,b]
    .map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,"0"))
    .join("");
}


function hexToRgb(hex) {
  const clean = String(hex || "").replace("#","").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return {r:180,g:180,b:180};
  return {
    r:parseInt(clean.slice(0,2),16),
    g:parseInt(clean.slice(2,4),16),
    b:parseInt(clean.slice(4,6),16)
  };
}

function rgbToHex({r,g,b}) {
  return "#" + [r,g,b]
    .map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0"))
    .join("");
}

function mixHex(a, b, weightB = .5) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const w = Math.max(0,Math.min(1,Number(weightB || 0)));
  return rgbToHex({
    r:A.r*(1-w)+B.r*w,
    g:A.g*(1-w)+B.g*w,
    b:A.b*(1-w)+B.b*w
  });
}

function timeRingSegmentColor(personKey, categoryColor) {
  const person = familyColor(personKey) || "#aaa29c";
  const blended = mixHex(categoryColor || "#d6d0c8", person, .72);
  return mixHex(blended, "#ffffff", .18);
}

function renderTimeTracking() {
  const list = document.querySelector("#timeLogList");
  const activeBox = document.querySelector("#activeTimeTracker");
  const weekChips = document.querySelector("#timeSummaryChips");
  const todayChips = document.querySelector("#timeTodayChips");
  const donutLegend = document.querySelector("#timeDonutLegend");
  const donutTotal = document.querySelector("#timeDonutTotal");
  if (!list || !activeBox || !weekChips || !todayChips) return;

  const activeTimers = Array.isArray(state.timeTracking.active) ? state.timeTracking.active : [];

  if (activeTimers.length) {
    activeBox.classList.remove("hidden");
    activeBox.innerHTML = activeTimers.map(active => `
      <div class="active-time-item" data-id="${active.id}" style="--person-color:${escapeHtml(trackingPersonColor(active.person))}">
        <div>
          <span class="active-time-person">
            <span class="time-person-dot" style="background:${escapeHtml(trackingPersonColor(active.person))}"></span>
            ${escapeHtml(familyName(active.person))}
          </span>
          <strong>${escapeHtml(timeCategoryLabel(active.category))}</strong>
          <small>${escapeHtml(active.note || "")}</small>
        </div>
        <div class="active-time-right">
          <span class="active-time-elapsed" data-started-at="${active.startedAt}">${formatElapsedWithSeconds(active.startedAt)}</span>
          <button class="secondary-btn stop-time-track-btn" data-id="${active.id}" type="button">■ Stoppen</button>
        </div>
      </div>
    `).join("");

    activeBox.querySelectorAll(".stop-time-track-btn").forEach(btn => {
      btn.addEventListener("click", () => stopTimeTracking(btn.dataset.id));
    });
  } else {
    activeBox.classList.add("hidden");
    activeBox.innerHTML = "";
  }

  const weekStart = weekStartForDate();
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const weekEntries = state.timeTracking.entries.filter(entry =>
    Number(entry.endedAt || entry.createdAt || 0) >= weekStart.getTime()
  );
  const todayEntries = state.timeTracking.entries.filter(entry =>
    Number(entry.endedAt || entry.createdAt || 0) >= todayStart.getTime()
  );

  function totalsByPersonAndCategory(entries) {
    const totals = {};
    entries.forEach(entry => {
      const person = entry.person || "a";
      totals[person] = totals[person] || {};
      totals[person][entry.category] =
        (totals[person][entry.category] || 0) + Number(entry.minutes || 0);
    });
    return totals;
  }

  function renderPersonSummary(host, entries) {
    const totals = totalsByPersonAndCategory(entries);
    const people = ["a","b","c","d"];

    const html = people.map(person => {
      const categoryTotals = totals[person] || {};
      const pairs = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1]);
      if (!pairs.length) return "";

      const personTotal = pairs.reduce((sum, [,minutes]) => sum + minutes, 0);

      return `
        <div class="time-person-summary">
          <div class="time-person-summary-head">
            <span class="time-person-dot" style="background:${escapeHtml(trackingPersonColor(person))}"></span>
            <strong>${escapeHtml(familyName(person))}</strong>
            <span>${formatMinutes(personTotal)}</span>
          </div>
          <div class="time-summary-chips-inner">
            ${pairs.map(([category, minutes]) => `
              <span class="time-summary-chip">
                ${escapeHtml(timeCategoryLabel(category))}
                <strong>${formatMinutes(minutes)}</strong>
              </span>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    host.innerHTML = html || `<span class="time-summary-empty">Noch keine Zeiten.</span>`;
  }

  renderPersonSummary(weekChips, weekEntries);
  renderPersonSummary(todayChips, todayEntries);

  // FESTE LOGIK DES DIAGRAMMS:
  // Ringposition = Person: Mama außen -> Papa -> Lou -> Fina innen.
  // Farbe innerhalb eines Rings = gewählter Bereich/Kategorie.
  // Dieselbe Kategorie hat bei ALLEN Personen exakt dieselbe Farbe.
  const categoryPalette = {
    pc: "#5F9296",
    prep: "#7892BF",
    household: "#7F9E6D",
    cook: "#C8795C",
    shopping: "#D29B2F",
    repair: "#A46F89",
    garden: "#557F66",
    sport: "#736DB0",
    help: "#C99224",
    school: "#8E73AB",
    organize: "#91857D",
    errands: "#D29B2F",
    other: "#82766F"
  };

  const weekTotals = totalsByPersonAndCategory(weekEntries);
  const people = [
    {key:"a", ring:"#timeRingMama"},
    {key:"b", ring:"#timeRingPapa"},
    {key:"c", ring:"#timeRingLou"},
    {key:"d", ring:"#timeRingFina"}
  ];

  let grandTotal = 0;
  const legendParts = [];

  people.forEach(personInfo => {
    const categoryTotals = weekTotals[personInfo.key] || {};
    const pairs = Object.entries(categoryTotals)
      .filter(([,minutes]) => Number(minutes) > 0)
      .sort((a,b) => b[1] - a[1]);

    const personTotal = pairs.reduce((sum,[,minutes]) => sum + Number(minutes), 0);
    grandTotal += personTotal;

    const ring = document.querySelector(personInfo.ring);

    if (ring) {
      if (!personTotal) {
        ring.style.background = "rgba(229,226,220,.48)";
      } else {
        let cursor = 0;
        const segments = [];

        pairs.forEach(([category, minutes]) => {
          const start = cursor;
          const end = cursor + (Number(minutes) / personTotal) * 100;
          cursor = end;
          // Der Ring selbst gehört bereits eindeutig einer Person.
          // Die Segmentfarbe zeigt deshalb ausschließlich den gewählten Bereich.
          const color = categoryPalette[category] || "#b8ada5";
          segments.push(`${color} ${start}% ${end}%`);
        });

        ring.style.background = `conic-gradient(${segments.join(",")})`;
      }
    }

    if (personTotal) {
      legendParts.push(`
        <div class="time-person-legend">
          <div class="time-person-legend-head">
            <span class="time-person-dot" style="background:${escapeHtml(trackingPersonColor(personInfo.key))}"></span>
            <strong>${escapeHtml(familyName(personInfo.key))}</strong>
            <span>${formatMinutes(personTotal)}</span>
          </div>
          ${pairs.map(([category,minutes]) => `
            <div class="time-donut-legend-row">
              <span class="time-donut-dot" style="background:${categoryPalette[category] || "#b8ada5"}"></span>
              <span>${escapeHtml(timeCategoryLabel(category))}</span>
              <strong>${formatMinutes(minutes)}</strong>
            </div>
          `).join("")}
        </div>
      `);
    }
  });

  if (donutTotal) donutTotal.textContent = formatMinutes(grandTotal);
  if (donutLegend) {
    donutLegend.innerHTML = legendParts.join("") ||
      `<span class="time-summary-empty">Noch keine Verteilung.</span>`;
  }

  const formatTimeLogDate = entry => {
    const ts = Number(entry.endedAt || entry.createdAt || entry.startedAt || 0);
    if (!ts) return "–";
    return new Date(ts).toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  };

  const entries = state.timeTracking.entries
    .slice()
    .sort((a,b) => Number(b.endedAt || b.createdAt || 0) - Number(a.endedAt || a.createdAt || 0))
    .slice(0, 20);

  list.innerHTML = entries.length ? entries.map(entry => `
    <div class="time-log-row" style="--person-color:${escapeHtml(trackingPersonColor(entry.person))}">
      <time class="time-log-date" datetime="${new Date(Number(entry.endedAt || entry.createdAt || entry.startedAt || Date.now())).toISOString()}">${formatTimeLogDate(entry)}</time>
      <span class="time-log-person">
        <span class="time-person-dot" style="background:${escapeHtml(trackingPersonColor(entry.person))}"></span>
        ${escapeHtml(familyName(entry.person))}
      </span>
      <span class="time-log-category">${escapeHtml(timeCategoryLabel(entry.category))}</span>
      <span class="time-log-note">${escapeHtml(entry.note || "")}</span>
      <strong class="time-log-duration">${formatMinutes(entry.minutes)}</strong>
      <button type="button" class="time-log-edit" data-id="${entry.id}" title="Eintrag korrigieren">✎</button>
      <button type="button" class="time-log-delete" data-id="${entry.id}" title="Eintrag löschen">×</button>
    </div>
  `).join("") : `<div class="overview-empty">Noch keine Zeiten eingetragen.</div>`;


  list.querySelectorAll(".time-log-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const entry = state.timeTracking.entries.find(item => item.id === id);
      if (!entry) return;

      // Falls bereits ein Editor offen ist, zuerst schließen.
      list.querySelectorAll(".time-log-edit-panel").forEach(panel => panel.remove());

      const row = btn.closest(".time-log-row");
      if (!row) return;

      const panel = document.createElement("div");
      panel.className = "time-log-edit-panel";

      const categoryOptions = [
        ["pc","🖥 PC & Büro"],
        ["prep","✂ Vorbereitung"],
        ["household","🏡 Haushalt"],
        ["cook","🍳 Kochen"],
        ["shopping","🛒 Einkaufen"],
        ["repair","🔧 Reparaturen"],
        ["garden","🌿 Garten & draußen"],
        ["sport","🏃 Sport & Bewegung"],
        ["help","🤝 Helfen & Unterstützen"],
        ["school","✏ Lernen & Schule"],
        ["other","✨ Sonstiges"]
      ];

      panel.innerHTML = `
        <label>
          Für wen?
          <select class="time-edit-person">
            <option value="a"${entry.person === "a" ? " selected" : ""}>Mama</option>
            <option value="b"${entry.person === "b" ? " selected" : ""}>Papa</option>
            <option value="c"${entry.person === "c" ? " selected" : ""}>Lou</option>
            <option value="d"${entry.person === "d" ? " selected" : ""}>Fina</option>
          </select>
        </label>

        <label>
          Bereich
          <select class="time-edit-category">
            ${categoryOptions.map(([value,label]) =>
              `<option value="${value}"${entry.category === value ? " selected" : ""}>${label}</option>`
            ).join("")}
          </select>
        </label>

        <label class="time-edit-note-wrap">
          Notiz
          <input class="time-edit-note" type="text" value="${escapeHtml(entry.note || "")}">
        </label>

        <label>
          Stunden
          <input class="time-edit-hours" type="number" min="0" max="5" value="${Math.floor(Number(entry.minutes || 0) / 60)}">
        </label>

        <label>
          Minuten
          <input class="time-edit-minutes" type="number" min="0" max="59" value="${Number(entry.minutes || 0) % 60}">
        </label>

        <div class="time-edit-actions">
          <button type="button" class="secondary-btn time-edit-cancel">Abbrechen</button>
          <button type="button" class="primary-btn time-edit-save">Speichern</button>
        </div>
      `;

      row.insertAdjacentElement("afterend", panel);

      panel.querySelector(".time-edit-cancel")?.addEventListener("click", () => panel.remove());

      panel.querySelector(".time-edit-save")?.addEventListener("click", () => {
        const hours = Math.max(0, Math.min(5, Math.round(Number(panel.querySelector(".time-edit-hours")?.value || 0))));
        const minutesPart = Math.max(0, Math.min(59, Math.round(Number(panel.querySelector(".time-edit-minutes")?.value || 0))));
        const totalMinutes = Math.min(300, hours * 60 + minutesPart);

        if (!totalMinutes) {
          panel.querySelector(".time-edit-minutes")?.focus();
          return;
        }

        const editedAt = Date.now();
        entry.person = panel.querySelector(".time-edit-person")?.value || entry.person;
        entry.category = panel.querySelector(".time-edit-category")?.value || entry.category;
        entry.note = panel.querySelector(".time-edit-note")?.value.trim() || "";
        entry.minutes = totalMinutes;
        entry.endedAt = editedAt;
        entry.startedAt = editedAt - totalMinutes * 60000;
        entry.updatedAt = editedAt;

        saveTimeTrackingImmediately();
        renderTimeTracking();
      });
    });
  });

  list.querySelectorAll(".time-log-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (!id) return;

      const now = Date.now();

      state.timeTracking.deletedEntries =
        state.timeTracking.deletedEntries && typeof state.timeTracking.deletedEntries === "object"
          ? state.timeTracking.deletedEntries
          : {};

      const entryToDelete=state.timeTracking.entries.find(entry=>entry.id===id);
      const trashId=entryToDelete?trashItem("time",entryToDelete):null;
      state.timeTracking.deletedEntries[id]=now;
      state.timeTracking.entries=state.timeTracking.entries.filter(entry=>entry.id!==id);
      save();saveTimeTrackingImmediately();renderTimeTracking();renderTrash();
      if(trashId)showUndo("Zeiteintrag gelöscht",()=>restoreTrashEntry(trashId));
    });
  });

  startLiveTimeTicker();
}

function startTimeTracking() {
  const person = document.querySelector("#timeTrackPerson")?.value || "a";
  const category = document.querySelector("#timeTrackCategory")?.value || "pc";
  const note = document.querySelector("#timeTrackNote")?.value.trim() || "";

  state.timeTracking.active = Array.isArray(state.timeTracking.active) ? state.timeTracking.active : [];
  state.timeTracking.stopped =
    state.timeTracking.stopped && typeof state.timeTracking.stopped === "object"
      ? state.timeTracking.stopped
      : {};

  state.timeTracking.active.push({
    id: uid(),
    person,
    category,
    note,
    startedAt: Date.now()
  });

  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}

function stopTimeTracking(timerId, endedAtOverride = null) {
  state.timeTracking.active = Array.isArray(state.timeTracking.active) ? state.timeTracking.active : [];
  const active = state.timeTracking.active.find(timer => timer.id === timerId);
  if (!active) return;

  const endedAt = endedAtOverride == null ? Date.now() : Number(endedAtOverride);
  const minutes = Math.max(1, Math.min(300, Math.round((endedAt - Number(active.startedAt || endedAt)) / 60000)));

  state.timeTracking.entries.push({
    id: active.id || uid(),
    person: active.person,
    category: active.category,
    note: active.note || "",
    startedAt: active.startedAt,
    endedAt,
    createdAt: endedAt,
    updatedAt: endedAt,
    minutes
  });

  state.timeTracking.stopped =
    state.timeTracking.stopped && typeof state.timeTracking.stopped === "object"
      ? state.timeTracking.stopped
      : {};
  state.timeTracking.stopped[timerId] = endedAt;

  state.timeTracking.active = state.timeTracking.active.filter(timer => timer.id !== timerId);

  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}

function addManualTimeEntry() {
  const hoursInput = document.querySelector("#manualTimeHours");
  const minutesInput = document.querySelector("#manualTimeMinutes");
  const hours = Math.max(0, Math.round(Number(hoursInput?.value || 0)));
  const mins = Math.max(0, Math.round(Number(minutesInput?.value || 0)));
  const totalMinutes = hours * 60 + mins;

  if (!totalMinutes) {
    (minutesInput || hoursInput)?.focus();
    return;
  }

  const now = Date.now();
  state.timeTracking.entries.push({
    id: uid(),
    person: document.querySelector("#timeTrackPerson")?.value || "a",
    category: document.querySelector("#timeTrackCategory")?.value || "pc",
    note: document.querySelector("#timeTrackNote")?.value.trim() || "",
    startedAt: now - totalMinutes * 60000,
    endedAt: now,
    createdAt: now,
    updatedAt: now,
    minutes: totalMinutes
  });

  if (hoursInput) hoursInput.value = "";
  if (minutesInput) minutesInput.value = "";

  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}




document.querySelector("#startTimeTrackBtn")?.addEventListener("click", startTimeTracking);
document.querySelector("#addManualTimeBtn")?.addEventListener("click", addManualTimeEntry);

document.querySelector("#printWeekBtn")?.addEventListener("click",()=>window.print());

const TRASH_KEEP_MS = 3 * 24 * 60 * 60 * 1000;
let undoTimer = null, lastUndoAction = null;

function pruneTrash(){
  const cutoff=Date.now()-TRASH_KEEP_MS;
  state.trash=(state.trash||[]).filter(x=>Number(x.deletedAt||0)>=cutoff);
}
function trashItem(kind,item){
  if(!item)return null; pruneTrash();
  const rec={trashId:uid(),kind,item:JSON.parse(JSON.stringify(item)),deletedAt:Date.now()};
  state.trash=state.trash||[]; state.trash.unshift(rec); return rec.trashId;
}
function showUndo(message,fn){
  lastUndoAction=fn; clearTimeout(undoTimer);
  let bar=document.querySelector("#undoBar");
  if(!bar){bar=document.createElement("div");bar.id="undoBar";bar.className="undo-bar";document.body.appendChild(bar);}
  bar.innerHTML=`<span>${escapeHtml(message)}</span><button type="button" id="undoNowBtn">↩ Rückgängig</button>`;
  bar.classList.add("show");
  bar.querySelector("#undoNowBtn")?.addEventListener("click",()=>{const a=lastUndoAction;lastUndoAction=null;clearTimeout(undoTimer);bar.classList.remove("show");if(a)a();});
  undoTimer=setTimeout(()=>{lastUndoAction=null;bar.classList.remove("show");},7000);
}
function restoreTrashEntry(id){
  const rec=(state.trash||[]).find(x=>x.trashId===id); if(!rec)return;
  const item=JSON.parse(JSON.stringify(rec.item));
  if(rec.kind==="todo"){if(!state.todos.some(x=>x.id===item.id))state.todos.push(item);}
  if(rec.kind==="time"){
    delete state.timeTracking.deletedEntries?.[item.id];
    if(!state.timeTracking.entries.some(x=>x.id===item.id))state.timeTracking.entries.push(item);
    saveTimeTrackingImmediately();
  }
  state.trash=state.trash.filter(x=>x.trashId!==id); save(); renderAll();
}
function renderTrash(){
  pruneTrash(); const host=document.querySelector("#trashList"); if(!host)return;
  const rows=state.trash||[];
  host.innerHTML=rows.length?rows.map(rec=>{
    const x=rec.item||{};
    const label=rec.kind==="time"?`${familyName(x.person)} · ${timeCategoryLabel(x.category)}${x.note?" · "+x.note:""}`:(x.text||"To-do");
    const days=Math.max(0,Math.ceil((TRASH_KEEP_MS-(Date.now()-Number(rec.deletedAt||0)))/86400000));
    return `<div class="trash-row"><span><strong>${escapeHtml(label)}</strong><small>noch ${days} Tag${days===1?"":"e"}</small></span><button class="trash-restore" data-id="${rec.trashId}" title="Wiederherstellen">↩</button><button class="trash-delete" data-id="${rec.trashId}" title="Endgültig löschen">×</button></div>`;
  }).join(""):`<div class="overview-empty">Papierkorb ist leer.</div>`;
  host.querySelectorAll(".trash-restore").forEach(b=>b.onclick=()=>restoreTrashEntry(b.dataset.id));
  host.querySelectorAll(".trash-delete").forEach(b=>b.onclick=()=>{state.trash=state.trash.filter(x=>x.trashId!==b.dataset.id);save();renderTrash();});
  const empty=document.querySelector("#emptyTrashBtn"); if(empty)empty.disabled=!rows.length;
}

function collectInternetRecipeLinks() {
  const map = new Map();

  (state.recipes || []).forEach(recipe => {
    const urls = [recipe.webUrl, recipe.youtubeUrl].filter(Boolean);
    urls.forEach(url => {
      const key = String(url).trim();
      if (!key) return;

      const candidate = {
        url:key,
        label:recipe.title || "Rezept",
        source:"Rezeptkarte",
        recipeId:recipe.id || "",
        sourceUpdatedAt:Number(recipe.updatedAt || recipe.createdAt || 0)
      };

      const previous = map.get(key);
      if (!previous || candidate.sourceUpdatedAt >= Number(previous.sourceUpdatedAt || 0)) {
        map.set(key, candidate);
      }
    });
  });

  Object.values(state.meals || {}).forEach(meal => {
    if (!meal || typeof meal !== "object" || !meal.url) return;
    const key = String(meal.url).trim();
    if (!key) return;

    const candidate = {
      url:key,
      label:meal.label || "Rezeptlink",
      source:"Essensplan",
      recipeId:meal.recipeId || "",
      sourceUpdatedAt:Number(meal.updatedAt || 0)
    };

    const previous = map.get(key);
    if (!previous || candidate.sourceUpdatedAt >= Number(previous.sourceUpdatedAt || 0)) {
      map.set(key, candidate);
    }
  });

  return [...map.values()]
    .filter(item => {
      const feedback = state.recipeLinkFeedback?.[item.url] || {};
      const hiddenAt = Number(feedback.hiddenAt || 0);

      // × räumt den aktuellen Fund nur aus der Übersicht.
      // Wird der Link später im Essensplan/Rezept neu gespeichert,
      // ist sourceUpdatedAt neuer und er darf wieder erscheinen.
      return !hiddenAt || Number(item.sourceUpdatedAt || 0) > hiddenAt;
    })
    .sort((a,b) => String(a.label).localeCompare(String(b.label), "de"));
}

function recipeFeedbackLabel(value) {
  return {
    love: "💛 Sehr gern wieder",
    okay: "🙂 Passt gut",
    no: "🌿 Eher nicht nochmal"
  }[value] || "Noch offen";
}

function renderRecipeLinkTracker() {
  const host = document.querySelector("#recipeLinkTrackerList");
  if (!host) return;

  const links = collectInternetRecipeLinks();

  if (!links.length) {
    host.innerHTML = `<div class="overview-empty">Noch keine Internetrezepte hinterlegt. Sobald eine Rezeptkarte oder ein Essensplan-Eintrag einen Web-/YouTube-Link hat, erscheint er hier zum Bewerten.</div>`;
    return;
  }

  host.innerHTML = links.map(link => {
    const feedback = state.recipeLinkFeedback[link.url] || {};
    return `
      <article class="recipe-link-track-row">
        <div class="recipe-link-track-main">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>
          <span>${escapeHtml(link.source)}</span>
        </div>

        <div class="recipe-link-times">
          <button type="button" class="recipe-link-used" data-url="${escapeHtml(link.url)}">
            ✓ gekocht ${feedback.timesUsed ? `(${feedback.timesUsed}×)` : ""}
          </button>
          <button type="button"
                  class="recipe-link-reuse"
                  data-url="${escapeHtml(link.url)}"
                  data-label="${escapeHtml(link.label)}"
                  data-recipe-id="${escapeHtml(link.recipeId || "")}">
            ↻ Wiederverwenden
          </button>
        </div>

        <div class="recipe-link-rating">
          <button type="button" class="recipe-link-rate ${feedback.rating === "love" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="love">💛 Sehr gern wieder</button>
          <button type="button" class="recipe-link-rate ${feedback.rating === "okay" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="okay">🙂 Passt gut</button>
          <button type="button" class="recipe-link-rate ${feedback.rating === "no" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="no">🌿 Eher nicht</button>
          <button type="button" class="recipe-link-remove" data-url="${escapeHtml(link.url)}" title="Aus Übersicht entfernen">×</button>
        </div>
      </article>
    `;
  }).join("");

  host.querySelectorAll(".recipe-link-used").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      const current = state.recipeLinkFeedback[url] || {};
      state.recipeLinkFeedback[url] = {
        ...current,
        timesUsed: Number(current.timesUsed || 0) + 1,
        lastUsed: Date.now(),
        updatedAt: Date.now()
      };
      save();
      renderRecipeLinkTracker();
    });
  });

  host.querySelectorAll(".recipe-link-rate").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      const current = state.recipeLinkFeedback[url] || {};
      state.recipeLinkFeedback[url] = {
        ...current,
        rating: btn.dataset.rating,
        updatedAt: Date.now()
      };
      save();
      renderRecipeLinkTracker();
    });
  });

  host.querySelectorAll(".recipe-link-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      const current = state.recipeLinkFeedback[url] || {};
      const now = Date.now();

      state.recipeLinkFeedback[url] = {
        ...current,
        hidden:false,
        hiddenAt:now,
        updatedAt:now
      };

      save();
      renderRecipeLinkTracker();
    });
  });

  host.querySelectorAll(".recipe-link-reuse").forEach(btn => {
    btn.addEventListener("click", () => {
      openRecipeReuseDialog({
        url:btn.dataset.url || "",
        label:btn.dataset.label || "Rezept",
        recipeId:btn.dataset.recipeId || ""
      });
    });
  });
}

function renderAll() {
  pruneTrash();
  renderTrash();
  bindManualTimetableControls();
  bindSchoolYearSetting();
  applyFamilyVisuals();
  bindFamilySettings();
  renderWeek();
  renderTodos();
  renderArchive();
  renderTimeTracking();
  renderRecipeLinkTracker();
  renderSchool();
  renderSchoolWorkTodos();
  renderSchoolPrints();
  renderWorkroomLinks();
  renderRecipes();
  renderMealPlan();
  renderShopping();
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
function renderSchoolWorkTodos() {
   const list = document.querySelector("#schoolWorkTodoList");
  if (!list) return;

const oneMinuteAgo = Date.now() - 60000;

const todos = [...state.workroom.todos]
  .filter(t => {
    if (!t.done) return true;
    if (!t.completedAt) return true;

    return t.completedAt > oneMinuteAgo;
  })
  
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

if (!todos.length) {
  list.innerHTML = `<div class="workroom-empty">Im Moment ist alles erledigt. ✨</div>`;
}

const archive = document.querySelector("#schoolWorkTodoArchive");

if (archive) {
  const archivedTodos = state.workroom.todos
    .filter(t =>
      t.done &&
      t.completedAt &&
      t.completedAt <= oneMinuteAgo
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

archive.innerHTML = archivedTodos.length
  ? archivedTodos.map(t => `
      <div class="workroom-archive-item">
        <span>✓ ${escapeHtml(t.text)}</span>

        <button
          type="button"
          class="workroom-archive-delete"
          data-id="${t.id}"
          title="Endgültig löschen"
          aria-label="Erledigtes Schul-To-do löschen"
        >×</button>
      </div>
    `).join("")
  : `<div class="workroom-empty">Noch keine erledigten Schul-To-dos.</div>`;

/* GENAU HIER EINFÜGEN */
document.querySelectorAll(".workroom-archive-delete").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;

    state.workroom.todos =
      state.workroom.todos.filter(t => t.id !== id);

    save();
    renderSchoolWorkTodos();
  });
});
  }

const typeLabels = {
    draw: "✏️ Vorzeichnen",
    prepare: "🛠 Vorbereiten",
    create: "📄 Erstellen",
    print: "🖨 Drucken"
  };

  list.innerHTML = todos.map(t => `
<div
  class="workroom-todo-row ${t.done ? "done" : ""}"
  data-id="${t.id}">

  <input
    class="workroom-todo-check"
    type="checkbox"
    data-id="${t.id}"
    ${t.done ? "checked" : ""}>

 <div class="workroom-todo-content">
  <span class="workroom-todo-text">${escapeHtml(t.text)}</span>
</div>

<div class="workroom-todo-actions">

  ${t.type
    ? `<span class="workroom-todo-type">${typeLabels[t.type] || ""}</span>`
    : ""}

  ${t.url
    ? `<a class="workroom-todo-link"
        href="${escapeHtml(t.url)}"
        target="_blank"
        rel="noopener"
        title="Link öffnen">🔗</a>`
    : ""}
          <button
  class="workroom-todo-edit"
  type="button"
  data-id="${t.id}"
  title="Bearbeiten">✎</button>

<button
  class="workroom-todo-delete"
  type="button"
  data-id="${t.id}"
  title="Löschen">×</button>

<div class="workroom-move-controls">
  <button
    class="workroom-move-btn workroom-move-top"
    type="button"
    data-id="${t.id}"
    title="Ganz nach oben">⇈</button>

  <button
    class="workroom-move-btn workroom-move-up"
    type="button"
    data-id="${t.id}"
    title="Eine Position nach oben">↑</button>

  <button
    class="workroom-move-btn workroom-move-down"
    type="button"
    data-id="${t.id}"
    title="Eine Position nach unten">↓</button>

  <span
    class="workroom-drag-handle"
    title="Ziehen"
    aria-label="Ziehen">⋮⋮</span>
</div>
      </div>
    </div>
  `).join("");

document.querySelectorAll(".workroom-todo-check").forEach(box => {
  box.addEventListener("change", e => {
    const item = state.workroom.todos.find(t => t.id === e.currentTarget.dataset.id);
    if (!item) return;

    item.done = e.currentTarget.checked;

    if (item.done) {
      item.completedAt = Date.now();
    } else {
      item.completedAt = null;
    }

    save();
    renderSchoolWorkTodos();
    if (item.done) {
  setTimeout(() => {
    renderSchoolWorkTodos();
  }, 61000);
}
  });
});
    function moveSchoolWorkTodo(id, direction) {
  const sorted = [...state.workroom.todos]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const index = sorted.findIndex(t => t.id === id);
  if (index === -1) return;

  let newIndex = index;

  if (direction === "top") newIndex = 0;
  if (direction === "up") newIndex = Math.max(0, index - 1);
  if (direction === "down") newIndex = Math.min(sorted.length - 1, index + 1);

  if (newIndex === index) return;

  const [moved] = sorted.splice(index, 1);
  sorted.splice(newIndex, 0, moved);

  sorted.forEach((todo, i) => {
    todo.order = i;
  });

  state.workroom.todos = sorted;

  save();
  renderSchoolWorkTodos();
}


  document.querySelectorAll(".workroom-todo-delete").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;

    state.workroom.todos = state.workroom.todos.filter(t => t.id !== id);

    save();
    renderSchoolWorkTodos();
  });
});

document.querySelectorAll(".workroom-todo-edit").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const item = state.workroom.todos.find(t => t.id === id);
    if (!item) return;

    document.querySelector("#schoolWorkTodoInput").value = item.text || "";
    document.querySelector("#schoolWorkTodoType").value = item.type || "";
    document.querySelector("#schoolWorkTodoLink").value = item.url || "";

    document.querySelector("#addSchoolWorkTodoBtn").dataset.editId = item.id;
    document.querySelector("#addSchoolWorkTodoBtn").textContent = "Änderung speichern";
  });
});
// Schul-To-dos per Maus oder Touch sortieren
const todoList = document.querySelector("#schoolWorkTodoList");

if (todoList && typeof Sortable !== "undefined") {
  new Sortable(todoList, {
    animation: 180,
    handle: ".workroom-drag-handle",
    ghostClass: "workroom-sort-ghost",
    chosenClass: "workroom-sort-chosen",
    dragClass: "workroom-sort-drag",
delay: 0,
delayOnTouchOnly: false,
touchStartThreshold: 5,

forceFallback: false,
    
    onEnd: function () {
      const ids = [...todoList.querySelectorAll(".workroom-todo-row")]
        .map(row => row.dataset.id);

      ids.forEach((id, index) => {
        const todo = state.workroom.todos.find(t => t.id === id);
        if (todo) todo.order = index;
      });

      save();
      renderSchoolWorkTodos();
    }
  });
}
}


// Werkraum: Schul-To-dos mit Pfeilen verschieben
document.addEventListener("click", e => {
  const btn = e.target.closest(".workroom-move-btn");
  if (!btn) return;

  const id = btn.dataset.id;

  const sorted = [...state.workroom.todos]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const index = sorted.findIndex(t => t.id === id);
  if (index === -1) return;

  let newIndex = index;

  if (btn.classList.contains("workroom-move-top")) {
    newIndex = 0;
  } else if (btn.classList.contains("workroom-move-up")) {
    newIndex = Math.max(0, index - 1);
  } else if (btn.classList.contains("workroom-move-down")) {
    newIndex = Math.min(sorted.length - 1, index + 1);
  } else if (btn.classList.contains("workroom-move-bottom")) {
    newIndex = sorted.length - 1;
  } else {
    return;
  }

  if (newIndex === index) return;

  const [moved] = sorted.splice(index, 1);
  sorted.splice(newIndex, 0, moved);

  sorted.forEach((todo, i) => {
    todo.order = i;
  });

  state.workroom.todos = sorted;

  save();
  renderSchoolWorkTodos();
});

document.querySelector("#addSchoolWorkTodoBtn")?.addEventListener("click", () => {
  const textInput = document.querySelector("#schoolWorkTodoInput");
  const typeInput = document.querySelector("#schoolWorkTodoType");
  const linkInput = document.querySelector("#schoolWorkTodoLink");
  const button = document.querySelector("#addSchoolWorkTodoBtn");

  const text = textInput.value.trim();
  if (!text) return;

  const url = linkInput.value.trim();
  const editId = button.dataset.editId;

  if (editId) {
    const item = state.workroom.todos.find(t => t.id === editId);

    if (item) {
      item.text = text;
      item.type = typeInput.value || "";
      item.url = url;
    }

    delete button.dataset.editId;
    button.textContent = "+ Eintragen";

    showMotivation("Schul-To-do geändert ✓");

  } else {
    state.workroom.todos.push({
      id: uid(),
      text,
      type: typeInput.value || "",
      url,
      order: state.workroom.todos.length,
      done: false,
      createdAt: Date.now()
    });

    showMotivation("Schul-To-do hinzugefügt ✓");
  }

  textInput.value = "";
  typeInput.value = "";
  linkInput.value = "";

  save();
  renderSchoolWorkTodos();
});

// =============================
// WERKRAUM – DRUCKLISTE
// =============================

function renderSchoolPrints() {
  const list = document.querySelector("#schoolPrintList");

  if (!list) return;

const now = Date.now();

state.workroom.prints = state.workroom.prints.filter(p => {
  if (!p.done || !p.completedAt) return true;

  return now - p.completedAt < 60000;
});
  
const prints = [...state.workroom.prints]
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  
  if (!prints.length) {
    list.innerHTML =
      `<div class="workroom-empty">Im Moment steht nichts auf der Druckliste.</div>`;
  } else {
    list.innerHTML = prints.map(p => `
      <div
        class="workroom-todo-row ${p.done ? "done" : ""}"
        data-print-id="${p.id}">

        <input
          class="workroom-print-check"
          type="checkbox"
          data-id="${p.id}"
          ${p.done ? "checked" : ""}>

        <div class="workroom-todo-content">
          <span class="workroom-todo-text">${escapeHtml(p.text)}</span>
        </div>

        <div class="workroom-todo-actions">

          ${p.url
            ? `<a class="workroom-todo-link"
                  href="${escapeHtml(p.url)}"
                  target="_blank"
                  rel="noopener"
                  title="Link öffnen">🔗</a>`
            : ""}

          <button
            class="workroom-print-edit"
            type="button"
            data-id="${p.id}"
            title="Bearbeiten">✎</button>

          <button
            class="workroom-print-delete"
            type="button"
            data-id="${p.id}"
            title="Löschen">×</button>

          <div class="workroom-move-controls">

            <button
              class="workroom-print-move-btn workroom-print-move-top"
              type="button"
              data-id="${p.id}"
              title="Ganz nach oben">⇈</button>

            <button
              class="workroom-print-move-btn workroom-print-move-up"
              type="button"
              data-id="${p.id}"
              title="Eine Position nach oben">↑</button>

            <button
              class="workroom-print-move-btn workroom-print-move-down"
              type="button"
              data-id="${p.id}"
              title="Eine Position nach unten">↓</button>

                  <span
              class="workroom-drag-handle"
              title="Ziehen"
              aria-label="Ziehen">⋮⋮</span>

          </div>
        </div>
      </div>
    `).join("");
  }

 document.querySelectorAll(".workroom-print-check").forEach(box => {
  box.addEventListener("change", e => {
    const id = e.currentTarget.dataset.id;
    const item = state.workroom.prints.find(p => p.id === id);

    if (!item) return;

    item.done = e.currentTarget.checked;
    item.completedAt = item.done ? Date.now() : null;

    save();
    renderSchoolPrints();

    if (item.done) {
      setTimeout(() => {
        const currentItem = state.workroom.prints.find(p => p.id === id);

        if (!currentItem || !currentItem.done) return;

        state.workroom.prints =
          state.workroom.prints.filter(p => p.id !== id);

        save();
        renderSchoolPrints();
      }, 60000);
    }
  });
});

  document.querySelectorAll(".workroom-print-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;

      state.workroom.prints =
        state.workroom.prints.filter(p => p.id !== id);

      save();
      renderSchoolPrints();
    });
  });

  document.querySelectorAll(".workroom-print-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      const item = state.workroom.prints.find(p => p.id === id);

      if (!item) return;

      document.querySelector("#schoolPrintInput").value = item.text || "";
      document.querySelector("#schoolPrintLink").value = item.url || "";

      const addBtn = document.querySelector("#addSchoolPrintBtn");
      addBtn.dataset.editId = item.id;
      addBtn.textContent = "Änderung speichern";
    });
  });

  document.querySelectorAll(".workroom-print-move-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;

      const sorted = [...state.workroom.prints]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const index = sorted.findIndex(p => p.id === id);
      if (index === -1) return;

      let newIndex = index;

      if (e.currentTarget.classList.contains("workroom-print-move-top")) {
        newIndex = 0;
      } else if (e.currentTarget.classList.contains("workroom-print-move-up")) {
        newIndex = Math.max(0, index - 1);
      } else if (e.currentTarget.classList.contains("workroom-print-move-down")) {
        newIndex = Math.min(sorted.length - 1, index + 1);
      } else if (e.currentTarget.classList.contains("workroom-print-move-bottom")) {
        newIndex = sorted.length - 1;
      }

      const [moved] = sorted.splice(index, 1);
      sorted.splice(newIndex, 0, moved);

      sorted.forEach((p, i) => {
        p.order = i;
      });

      state.workroom.prints = sorted;

      save();
      renderSchoolPrints();
    });
  });

  if (typeof Sortable !== "undefined") {
    const printList = document.querySelector("#schoolPrintList");

    if (printList) {
      new Sortable(printList, {
        animation: 150,
        handle: ".workroom-drag-handle",
        draggable: ".workroom-todo-row",

        onEnd: () => {
          const ids = [...printList.querySelectorAll(".workroom-todo-row")]
            .map(row => row.dataset.printId);

          ids.forEach((id, index) => {
            const item = state.workroom.prints.find(p => p.id === id);
            if (item) item.order = index;
          });

          save();
          renderSchoolPrints();
        }
      });
    }
  }
}


// Druckauftrag hinzufügen / bearbeiten
document.querySelector("#addSchoolPrintBtn")?.addEventListener("click", () => {
  const textInput = document.querySelector("#schoolPrintInput");
  const linkInput = document.querySelector("#schoolPrintLink");
  const button = document.querySelector("#addSchoolPrintBtn");

  const text = textInput.value.trim();
  if (!text) return;

  const url = linkInput?.value.trim() || "";
  const editId = button.dataset.editId;

  if (editId) {
    const item = state.workroom.prints.find(p => p.id === editId);

    if (item) {
      item.text = text;
      item.url = url;
    }

    delete button.dataset.editId;
    button.textContent = "+ Eintragen";

  } else {
    state.workroom.prints.push({
      id: uid(),
      text,
      url,
      done: false,
      completedAt: null,
      order: state.workroom.prints.length,
      createdAt: Date.now()
    });
  }

  textInput.value = "";
  if (linkInput) linkInput.value = "";

  save();
  renderSchoolPrints();
});

// =============================
// WERKRAUM – LINKSAMMLUNG
// =============================

let activeWorkroomLinkCategory = "all";

function renderWorkroomLinks() {
  const list = document.querySelector("#workroomLinkList");
  if (!list) return;

  const categoryLabels = {
    wood: "🪵 Holz",
    paper: "📄 Papier",
    free: "✂️ Freies Arbeiten",
    experiment: "🧪 Experimentieren",
    other: "✨ Sonstiges"
  };

  const links = [...state.workroom.links]
    .filter(link =>
      activeWorkroomLinkCategory === "all" ||
      link.category === activeWorkroomLinkCategory
    );

  if (!links.length) {
    list.innerHTML =
      `<div class="workroom-empty">Noch keine Links in dieser Kategorie gespeichert.</div>`;
    return;
  }

  list.innerHTML = links.map(link => `
    <div class="workroom-link-item" data-id="${link.id}">

 <div class="workroom-link-main">

  <div class="workroom-link-texts">
    <a
      href="${escapeHtml(link.url)}"
      target="_blank"
      rel="noopener"
      class="workroom-link-title">
      ${escapeHtml(link.title)}
    </a>

    ${link.note
      ? `<div class="workroom-link-note">${escapeHtml(link.note)}</div>`
      : ""}
  </div>

  <span class="workroom-link-category">
    ${categoryLabels[link.category] || "✨ Sonstiges"}
  </span>

</div>

      <div class="workroom-link-actions">
        <button
          class="workroom-link-edit"
          type="button"
          data-id="${link.id}"
          title="Bearbeiten">✎</button>

        <button
          class="workroom-link-delete"
          type="button"
          data-id="${link.id}"
          title="Löschen">×</button>
      </div>

    </div>
  `).join("");

  document.querySelectorAll(".workroom-link-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;

      state.workroom.links =
        state.workroom.links.filter(link => link.id !== id);

      save();
      renderWorkroomLinks();
    });
  });

  document.querySelectorAll(".workroom-link-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      const link = state.workroom.links.find(link => link.id === id);

      if (!link) return;

      document.querySelector("#workroomLinkTitle").value = link.title || "";
      document.querySelector("#workroomLinkNote").value = link.note || "";
      document.querySelector("#workroomLinkUrl").value = link.url || "";
      document.querySelector("#workroomLinkCategory").value =
        link.category || "other";

      const addBtn = document.querySelector("#addWorkroomLinkBtn");

      addBtn.dataset.editId = link.id;
      addBtn.textContent = "Änderung speichern";
    });
  });
}


// Link speichern / bearbeiten
document.querySelector("#addWorkroomLinkBtn")?.addEventListener("click", () => {

  const titleInput = document.querySelector("#workroomLinkTitle");
  const noteInput = document.querySelector("#workroomLinkNote");
  const urlInput = document.querySelector("#workroomLinkUrl");
  const categoryInput = document.querySelector("#workroomLinkCategory");
  const button = document.querySelector("#addWorkroomLinkBtn");

  const title = titleInput.value.trim();
  const note = noteInput.value.trim();
  let url = urlInput.value.trim();
  const category = categoryInput.value || "other";

  if (!title || !url) return;

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const editId = button.dataset.editId;

  if (editId) {
    const item =
      state.workroom.links.find(link => link.id === editId);

    if (item) {
      item.title = title;
      item.note = note;
      item.url = url;
      item.category = category;
    }

    delete button.dataset.editId;
    button.textContent = "+ Speichern";

  } else {
    state.workroom.links.push({
      id: uid(),
      title,
      note,
      url,
      category,
      createdAt: Date.now()
    });
  }

  titleInput.value = "";
  noteInput.value = "";
  urlInput.value = "";
  categoryInput.value = "wood";

  save();
  renderWorkroomLinks();
});


// Kategorien filtern
document.querySelectorAll(".workroom-link-filter").forEach(btn => {

  btn.addEventListener("click", e => {

    activeWorkroomLinkCategory =
      e.currentTarget.dataset.category || "all";

    document.querySelectorAll(".workroom-link-filter")
      .forEach(filter =>
        filter.classList.toggle(
          "active",
          filter === e.currentTarget
        )
      );

    renderWorkroomLinks();
  });
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
  document.querySelector("#todoWeekOffset").value = "0";
  document.querySelector("#todoDay").value = "";
  document.querySelector("#eventDate").value = "";
  document.querySelector("#eventEndDate").value = "";
  document.querySelector("#eventTime").value = "";
  document.querySelector("#eventEndTime").value = "";
  document.querySelector("#eventCategory").value = "normal";
  document.querySelector("#recurrence").value = "none";
  setSelectedFamilyMembers([]);
  updateEntryTypeUI();
  document.querySelector("#addTodoBtn").textContent = "To-do hinzufügen";
  document.querySelector("#cancelTodoEditBtn").classList.add("hidden");
}



function firstSchoolYearDateForWeekday(dayName) {
  const sy = activeSchoolYear();
  if (!sy?.start || !dayName) return null;

  const targetNames = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  const target = targetNames.indexOf(dayName);
  if (target < 0) return null;

  const d = parseLocalDate(sy.start);
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === target) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}

function ensureSchoolyearNoeScheduleRow() {
  let row = document.querySelector("#schoolyearNoeScheduleRow");
  if (row) return row;

  const hint = document.querySelector("#schoolHolidayHint");
  const recurrence = document.querySelector("#recurrence");
  const host = hint?.parentElement || recurrence?.parentElement;
  if (!host) return null;

  row = document.createElement("div");
  row.id = "schoolyearNoeScheduleRow";
  row.className = "schoolyear-noe-schedule-row hidden";
  row.style.cssText = [
    "display:grid",
    "grid-template-columns:minmax(170px,1fr) minmax(140px,.7fr) minmax(140px,.7fr)",
    "gap:10px",
    "max-width:560px",
    "margin-top:10px",
    "padding:10px 12px",
    "border:1px solid rgba(137,151,103,.28)",
    "border-radius:14px",
    "background:rgba(241,245,235,.72)"
  ].join(";");

  row.innerHTML = `
    <label style="display:grid;gap:5px">
      <span>Wochentag</span>
      <select id="schoolyearNoeDay">
        <option value="">Bitte wählen</option>
        <option>Montag</option>
        <option>Dienstag</option>
        <option>Mittwoch</option>
        <option>Donnerstag</option>
        <option>Freitag</option>
        <option>Samstag</option>
        <option>Sonntag</option>
      </select>
    </label>
    <label style="display:grid;gap:5px">
      <span>Von</span>
      <input id="schoolyearNoeTime" type="time">
    </label>
    <label style="display:grid;gap:5px">
      <span>Bis</span>
      <input id="schoolyearNoeEndTime" type="time">
    </label>
  `;

  if (hint) hint.insertAdjacentElement("afterend", row);
  else host.appendChild(row);

  row.querySelector("#schoolyearNoeDay")?.addEventListener("change", e => {
    const hiddenDay = document.querySelector("#todoDay");
    if (hiddenDay) hiddenDay.value = e.target.value;
  });

  row.querySelector("#schoolyearNoeTime")?.addEventListener("change", e => {
    const hiddenTime = document.querySelector("#eventTime");
    if (hiddenTime) hiddenTime.value = e.target.value;
  });

  row.querySelector("#schoolyearNoeEndTime")?.addEventListener("change", e => {
    const hiddenEndTime = document.querySelector("#eventEndTime");
    if (hiddenEndTime) hiddenEndTime.value = e.target.value;
  });

  return row;
}

function updateSchoolyearNoeUI() {
  const recurrenceEl = document.querySelector("#recurrence");
  const typeEl = document.querySelector("#entryType");
  if (!recurrenceEl || !typeEl) return;

  const isSchoolyear = typeEl.value === "event" && recurrenceEl.value === "schoolyear-noe";
  const row = ensureSchoolyearNoeScheduleRow();

  const fieldBox = el => el ? (el.closest("label") || el.closest(".field") || el.parentElement) : null;
  const eventDate = document.querySelector("#eventDate");
  const eventEndDate = document.querySelector("#eventEndDate");
  const eventTime = document.querySelector("#eventTime");
  const eventEndTime = document.querySelector("#eventEndTime");

  [eventDate, eventEndDate, eventTime, eventEndTime].forEach(el => {
    const box = fieldBox(el);
    if (box) box.style.display = isSchoolyear ? "none" : "";
  });

  if (row) {
    row.classList.toggle("hidden", !isSchoolyear);
    row.style.display = isSchoolyear ? "grid" : "none";

    if (isSchoolyear) {
      const daySelect = row.querySelector("#schoolyearNoeDay");
      const timeInput = row.querySelector("#schoolyearNoeTime");
      const endTimeInput = row.querySelector("#schoolyearNoeEndTime");
      const currentDay = document.querySelector("#todoDay")?.value || "";
      const currentTime = document.querySelector("#eventTime")?.value || "";
      const currentEndTime = document.querySelector("#eventEndTime")?.value || "";
      if (daySelect && document.activeElement !== daySelect) daySelect.value = currentDay;
      if (timeInput && document.activeElement !== timeInput) timeInput.value = currentTime;
      if (endTimeInput && document.activeElement !== endTimeInput) endTimeInput.value = currentEndTime;
    }
  }
}

function updateEntryTypeUI() {
  const type = document.querySelector("#entryType").value;
  const isEvent = type === "event";
const eventCategory = document.querySelector("#eventCategory")?.value || "normal";
const recurrenceSelect = document.querySelector("#recurrence");

if (
  isEvent &&
  ["birthday", "nameday", "anniversary", "holiday"].includes(eventCategory)
) {
  recurrenceSelect.value = "yearly";
}
  document.querySelector("#eventFields").classList.toggle("hidden", !isEvent);
  document.querySelector("#entryTextLabel").textContent = isEvent ? "Termin" : "Aufgabe";
  document.querySelector("#todoText").placeholder = isEvent
    ? "z. B. Musikschule, Elternabend, Training"
    : "z. B. Elternbrief fertigstellen";

  // Button passend zur gewählten Art beschriften
  const addBtn = document.querySelector("#addTodoBtn");
  if (addBtn) {
    addBtn.textContent = isEvent ? "Termin hinzufügen" : "To-do hinzufügen";
  }
const periodField = document.querySelector("#todoPeriod")?.closest("label, .field, .form-field");

if (periodField) {
  periodField.classList.toggle("hidden", isEvent);
}
 
const priorityField = document.querySelector("#todoPriority")?.closest("label, .field, .form-field");
const areaField = document.querySelector("#todoArea")?.closest("label, .field, .form-field");

if (priorityField) {
  priorityField.classList.toggle("hidden", isEvent);
}

if (areaField) {
  areaField.classList.toggle("hidden", isEvent);
}

const recurrence = document.querySelector("#recurrence").value;

  document.querySelector("#schoolHolidayHint").classList.toggle(
    "hidden",
    recurrence !== "schoolyear-noe"
  );

  // Wochentag bei To-dos nur für "Diese Woche" anzeigen
  const period = document.querySelector("#todoPeriod")?.value;
  const todoDayField = document.querySelector("#todoDay")?.closest("label, .field, .form-field");
  const todoWeekField = document.querySelector("#todoWeekOffset")?.closest("label, .field, .form-field");
  const primaryRow = document.querySelector(".todo-primary-row");

  if (todoDayField) {
    todoDayField.classList.toggle("hidden", isEvent || period !== "week");
  }
  if (todoWeekField) {
    todoWeekField.classList.toggle("hidden", isEvent || period !== "week");
  }
  if (primaryRow) {
    primaryRow.classList.toggle("event-mode", isEvent);
  }

  updateSchoolyearNoeUI();
}

document.querySelector("#entryType").addEventListener("change", updateEntryTypeUI);
document.querySelector("#recurrence").addEventListener("change", updateEntryTypeUI);
document.querySelector("#todoPeriod").addEventListener("change", updateEntryTypeUI);
document.querySelector("#eventCategory").addEventListener("change", updateEntryTypeUI);

document.querySelector("#cancelTodoEditBtn").addEventListener("click", resetTodoEditor);

document.querySelector("#addTodoBtn").addEventListener("click", () => {
  const text = document.querySelector("#todoText").value.trim();
  if (!text) return;

  const type = document.querySelector("#entryType").value;
  const period = document.querySelector("#todoPeriod").value;
  const todayDate = new Date();
  const selectedDay = period === "today"
    ? weekdayNameForDate(todayDate)
    : document.querySelector("#todoDay").value;
  const selectedFamily = selectedFamilyMembers();
  const recurrence = document.querySelector("#recurrence").value;
 const eventDate = document.querySelector("#eventDate").value;
const eventEndDate = document.querySelector("#eventEndDate")?.value || "";
const eventTime = document.querySelector("#eventTime").value;
const eventEndTime = document.querySelector("#eventEndTime")?.value || "";
  const eventCategory = document.querySelector("#eventCategory")?.value || "normal";
  const superImportant = document.querySelector("#superImportant").checked;

  const weekOffset = Number(document.querySelector("#todoWeekOffset")?.value || 0);
  const activeMonday = period === "today" ? getMonday(todayDate) : getMonday(new Date());
  if (period !== "today") activeMonday.setDate(activeMonday.getDate() + weekOffset * 7);
  const selectedTodoDate = period === "today"
    ? todayDate
    : (selectedDay ? dateForWeekday(activeMonday, selectedDay) : null);
  const newWeekKey = selectedDay ? dateKey(activeMonday) : null;
  const schoolyearAnchor = recurrence === "schoolyear-noe"
    ? firstSchoolYearDateForWeekday(selectedDay)
    : null;

  const anchorDate = type === "event"
    ? (recurrence === "schoolyear-noe" ? (schoolyearAnchor ? dateKey(schoolyearAnchor) : null) : eventDate)
    : (selectedTodoDate ? dateKey(selectedTodoDate) : null);

  if (type === "event" && recurrence !== "schoolyear-noe" && !eventDate) {
    alert("Bitte für den Termin ein Datum auswählen.");
    return;
  }

  if (type === "event" && recurrence === "schoolyear-noe" && !selectedDay) {
    alert("Bitte für den Termin im Schuljahr NÖ einen Wochentag auswählen.");
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
    item.period = period;
    item.day = selectedDay;
    item.family = selectedFamily;
    item.weekKey = type === "event" ? null : newWeekKey;
    item.date = type === "event" && recurrence !== "schoolyear-noe" ? eventDate : null;
    item.time = type === "event" ? eventTime : "";
    item.endDate = type === "event" ? eventEndDate : null;
item.endTime = type === "event" ? eventEndTime : "";
    item.eventCategory = type === "event" ? eventCategory : "normal";
    item.recurrence = recurrence;
    item.anchorDate = anchorDate;
    item.completedOccurrences = Array.isArray(item.completedOccurrences) ? item.completedOccurrences : [];
    item.updatedAt = Date.now();

    resetTodoEditor();
  } else {
    state.todos.push({
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type,
      superImportant,
      text,
      priority: document.querySelector("#todoPriority").value,
      area: document.querySelector("#todoArea").value,
      period,
      day: selectedDay,
      family: selectedFamily,
      weekKey: type === "event" ? null : newWeekKey,
      date: type === "event" && recurrence !== "schoolyear-noe" ? eventDate : null,
      time: type === "event" ? eventTime : "",
      endDate: type === "event" ? eventEndDate : null,
endTime: type === "event" ? eventEndTime : "",
      eventCategory: type === "event" ? eventCategory : "normal",
      recurrence,
      anchorDate,
      completedOccurrences: [],
      done: false,
      archived: false
    });
showMotivation(type === "event" ? "Termin hinzugefügt ✓" : "To-do hinzugefügt ✓");
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


function openRecipeReuseDialog(link) {
  if (!link?.url) return;

  replanMode = "recipe";
  replanArchiveId = null;
  replanRecipeLink = {
    url:link.url,
    label:link.label || "Rezept",
    recipeId:link.recipeId || ""
  };

  const dialog = document.querySelector("#replanDialog");
  if (!dialog) return;

  const smallLabel = dialog.querySelector(".small-label");
  if (smallLabel) smallLabel.textContent = "REZEPT EINPLANEN";

  const title = document.querySelector("#replanTitle");
  if (title) title.textContent = replanRecipeLink.label;

  const week = document.querySelector("#replanWeek");
  const day = document.querySelector("#replanDay");
  if (week) week.value = "0";
  if (day) day.value = "Montag";

  dialog.showModal();
}

const replanDialog = document.querySelector("#replanDialog");
const closeReplanDialogBtn = document.querySelector("#closeReplanDialogBtn");
const cancelReplanBtn = document.querySelector("#cancelReplanBtn");
const confirmReplanBtn = document.querySelector("#confirmReplanBtn");

function closeReplanDialog() {
  replanArchiveId = null;
  replanRecipeLink = null;
  replanMode = "exercise";

  const smallLabel = replanDialog?.querySelector(".small-label");
  if (smallLabel) smallLabel.textContent = "ÜBUNG EINPLANEN";

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
  const weeksAhead = Number(document.querySelector("#replanWeek")?.value || 0);
  const day = document.querySelector("#replanDay")?.value || "Montag";
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weeksAhead * 7);

  if (replanMode === "recipe") {
    const link = replanRecipeLink;
    if (!link?.url) {
      closeReplanDialog();
      return;
    }

    const dayIndex = days.indexOf(day);
    const targetDate = dayDate(monday, dayIndex >= 0 ? dayIndex : 0);
    const key = dateKey(targetDate);

    state.meals = state.meals && typeof state.meals === "object" ? state.meals : {};
    state.meals[key] = {
      label:link.label || "Rezept",
      recipeId:link.recipeId || "",
      url:link.url,
      deleted:false,
      updatedAt:Date.now()
    };

    const feedback = state.recipeLinkFeedback[link.url] || {};
    state.recipeLinkFeedback[link.url] = {
      ...feedback,
      hidden:false,
      hiddenAt:0,
      updatedAt:Date.now()
    };

    save();
    currentWeekMonday = monday;
    closeReplanDialog();
    renderAll();
    document.querySelector('[data-view="week"]')?.click();
    showMotivation("Rezept eingeplant ✓");
    return;
  }

  const item = state.archive.find(a => a.id === replanArchiveId);
  if (!item) {
    closeReplanDialog();
    return;
  }

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



const workroomCalmQuotes = [
  'In Ruhe entsteht oft das Klarste.',
  'Nicht alles muss heute fertig werden.',
  'Gut vorbereitet darf sich leicht anfühlen.',
  'Ein kleiner Schritt reicht für den Anfang.',
  'Ordnung darf entlasten, nicht antreiben.',
  'Ideen brauchen manchmal ein wenig Raum.',
  'Ich muss nicht schneller sein als mein eigener Rhythmus.',
  'Was wirklich wichtig ist, darf sichtbar werden.',
  'Vorbereitung soll mir dienen – nicht umgekehrt.',
  'Auch im Schulalltag darf Platz für Ruhe bleiben.',
  'Meine Gründe reichen für meine Entscheidung. Sie müssen niemand anderen überzeugen.',
  'Ich kann deine Entscheidung stehen lassen. Lass bitte auch meine stehen.',
  'Ich glaube nicht, dass wir uns gegenseitig überzeugen müssen.',
  'Das ist eine Entscheidung, keine Einladung zur Debatte.',
  'Dass ich meine Gründe nicht diskutieren möchte, heißt nicht, dass ich keine habe.',
  'Ich muss meine Überzeugung nicht verteidigen, um nach ihr handeln zu können.',
  'Ich sehe das anders, aber wir müssen uns darüber nicht einigen.',
];

let workroomQuoteTimer = null;

function setWorkroomCalmQuote(forceNext = false) {
  const el = document.querySelector("#workroomCalmQuote");
  if (!el) return;

  let current = Number(el.dataset.quoteIndex || -1);
  let next = Math.floor(Math.random() * workroomCalmQuotes.length);

  if (forceNext && workroomCalmQuotes.length > 1 && next === current) {
    next = (next + 1) % workroomCalmQuotes.length;
  }

  el.classList.add("changing");
  window.setTimeout(() => {
    el.textContent = workroomCalmQuotes[next];
    el.dataset.quoteIndex = String(next);
    window.setTimeout(() => {
      el.classList.remove("changing");
    }, 180);
  }, 850);
}

function initWorkroomCalmHeader() {
  const el = document.querySelector("#workroomCalmQuote");
  if (!el) return;

  setWorkroomCalmQuote(false);

  if (workroomQuoteTimer) clearInterval(workroomQuoteTimer);
  workroomQuoteTimer = setInterval(() => {
    const workroomView = document.querySelector("#workroom");
    if (workroomView?.classList.contains("active")) {
      setWorkroomCalmQuote(true);
    }
  }, 24000);
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


function firestoreMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mergeCloudTodosWithoutLosingNewLocal(cloudTodos, cloudUpdatedAt) {
  const remote = Array.isArray(cloudTodos) ? cloudTodos : [];
  const local = Array.isArray(state.todos) ? state.todos : [];
  const cutoff = firestoreMillis(cloudUpdatedAt);

  // Nur lokale Einträge behalten, die NACH dem letzten bekannten Cloud-Stand
  // erzeugt/geändert wurden. So verschwinden Offline-Eingaben beim Reload nicht.
  const unsyncedLocal = local.filter(t => {
    const ts = Number(t.updatedAt || t.createdAt || 0);
    return ts && ts > cutoff;
  });

  return mergeByIdPreferNewer(remote, unsyncedLocal);
}

function applyCloudData(data) {
  cloudApplying = true;
  try {
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.todos = mergeCloudTodosWithoutLosingNewLocal(data.todos, data.updatedAt);
  state.trash = Array.isArray(data.trash) ? data.trash : (state.trash || []);
    state.archive = Array.isArray(data.archive) ? data.archive : [];
    state.shopping = Array.isArray(data.shopping)
  ? data.shopping
  : (Array.isArray(state.shopping) ? state.shopping : []);

shoppingItems = state.shopping;

    const localRecipes = Array.isArray(state.recipes) ? state.recipes : [];
    const cloudRecipes = Array.isArray(data.recipes) ? data.recipes : [];

    // Sicherheitsregel: ein leerer/alter Cloud-Stand darf lokale Rezepte nicht löschen.
    state.recipes = cloudRecipes.length
      ? mergeByIdPreferNewer(localRecipes, cloudRecipes)
      : localRecipes;

    if (data.meals && typeof data.meals === "object") {
      state.meals = mergeMeals(state.meals, data.meals);
    }

    if (data.recipeLinkFeedback && typeof data.recipeLinkFeedback === "object") {
      state.recipeLinkFeedback = {
        ...(data.recipeLinkFeedback || {}),
        ...(state.recipeLinkFeedback || {})
      };
    }

    state.workroom = data.workroom && typeof data.workroom === "object"
  ? {
      todos: Array.isArray(data.workroom.todos) ? data.workroom.todos : [],
      prints: Array.isArray(data.workroom.prints) ? data.workroom.prints : [],
      links: Array.isArray(data.workroom.links) ? data.workroom.links : [],
      substitutions: Array.isArray(data.workroom.substitutions) ? data.workroom.substitutions : []
    }
  : state.workroom;
    if (data.school?.children) state.school = data.school;
    if (data.familySettings) state.familySettings = data.familySettings;
    state.settings = {...(state.settings || {}), ...(data.settings || {})};
    saveLocal();
    renderAll();
  } finally {
    cloudApplying = false;
  }
}

// ===== EINKAUF – eigene Live-Synchronisation =====

let shoppingUnsubscribe = null;

function startShoppingSync() {
  if (shoppingUnsubscribe) shoppingUnsubscribe();

  shoppingUnsubscribe = shoppingCollection().onSnapshot(snapshot => {
    const items = [];

    snapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });

    shoppingItems = items;
    state.shopping = items;

    saveLocal();
    renderShopping();
  }, err => {
    console.error("Shopping sync failed:", err);
  });
}

// ===== EINKAUF – vorhandene Liste einmalig übernehmen =====

async function migrateShoppingToCollection() {
  const snapshot = await shoppingCollection().get();

  // Wenn im neuen Einkaufsbereich schon Artikel liegen,
  // wird nichts mehr übernommen.
  if (!snapshot.empty) return;

  // Wenn die alte Liste leer ist, gibt es nichts zu übertragen.
  if (!shoppingItems.length) return;

  const batch = firebase.firestore().batch();

  shoppingItems.forEach(item => {
    const { id, ...data } = item;
    batch.set(shoppingCollection().doc(id), data);
  });

  await batch.commit();
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

firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    setLoginMessage("");
    showLoginGate(false);
    startCloudSync();
    await startTimeTrackingSync();
    
    await migrateShoppingToCollection();
startShoppingSync();
    
  } else {
    cloudReady = false;
    if (cloudUnsubscribe) {
      cloudUnsubscribe();
      cloudUnsubscribe = null;
    }
        if (timeTrackingUnsubscribe) {
      timeTrackingUnsubscribe();
      timeTrackingUnsubscribe = null;
    }
    if (timeTrackingPollTimer) {
      clearInterval(timeTrackingPollTimer);
      timeTrackingPollTimer = null;
    }
showLoginGate(true);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshTimeTrackingFromCloud();
});

restoreTimeTrackingFromLocal();
setRandomDailySubtitle();
initWorkroomCalmHeader();
updateEntryTypeUI();
migrateOldData();

document.addEventListener("click", (e) => {
  if (e.target?.id === "closeManualTimetableDialog" || e.target?.id === "closeManualTimetableDialog2") {
    document.querySelector("#manualTimetableDialog")?.close();
  }
});

// ==============================
// EINKAUF – Grundfunktion
// ==============================

const shoppingCategories = {
  fruit: {
    label: "Obst & Gemüse",
    icon: "🥕",
    order: 1
  },
  bakery: {
    label: "Brot & Gebäck",
    icon: "🥐",
    order: 2
  },
  cooling: {
    label: "Milch & Kühlung",
    icon: "🥛",
    order: 3
  },
  frozen: {
    label: "Tiefgekühltes",
    icon: "🧊",
    order: 4
  },
  pantry: {
    label: "Vorrat & Beilagen",
    icon: "🍝",
    order: 5
  },
  seasoning: {
    label: "Öle, Essig & Würzen",
    icon: "🫙",
    order: 6
  },
  breakfast: {
    label: "Frühstück & Aufstriche",
    icon: "🥣",
    order: 7
  },
  baking: {
    label: "Backen",
    icon: "🧁",
    order: 8
  },
  snacks: {
    label: "Süßes & Snacks",
    icon: "🍫",
    order: 9
  },
  drinks: {
    label: "Getränke",
    icon: "🥤",
    order: 10
  },
  beauty: {
    label: "Pflege & Schönheit",
    icon: "🧴",
    order: 11
  },
  cleaning: {
    label: "Putzen & Waschen",
    icon: "🧽",
    order: 12
  },
  household: {
    label: "Haushalt",
    icon: "🏠",
    order: 13
  },
  textile: {
  label: "Textil",
  icon: "🧺",
  order: 14
},
  other: {
    label: "Sonstiges",
    icon: "📦",
    order: 15
  }
};

function renderShoppingGroup(title, items, muted = false) {
  if (!items.length) return "";

  const grouped = {};

  items.forEach(item => {
    const category = item.category || "other";

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(item);
  });

const categoryKeys = Object.keys(grouped).sort((a, b) => {
  const orderA = shoppingCategories[a]?.order || 99;
  const orderB = shoppingCategories[b]?.order || 99;

  return orderA - orderB;
});

return `
  <section class="shopping-section ${muted ? "shopping-section-muted" : ""}">
    <h3 class="shopping-section-title">${title}</h3>

    ${categoryKeys.map(categoryKey => {
      return `
        <div class="shopping-category-items">
       ${grouped[categoryKey].map(item => `
  <div class="shopping-item ${item.done ? "shopping-item-done" : ""}" data-id="${item.id}">

    <input
      class="shopping-check"
      type="checkbox"
      data-id="${item.id}"
      ${item.done ? "checked" : ""}
      aria-label="${escapeHtml(item.name)} gekauft"
    >

    <span class="shopping-item-name">
      ${escapeHtml(item.name)}

      ${
        item.createdAt &&
        Date.now() - item.createdAt < 2 * 60 * 60 * 1000
          ? `<span class="shopping-new">NEU</span>`
          : ""
      }

      ${
        item.store
          ? `<span class="shopping-tag">${escapeHtml(item.store)}</span>`
          : ""
      }
    </span>

    <button
      class="shopping-delete"
      type="button"
      data-id="${item.id}"
      aria-label="${escapeHtml(item.name)} löschen"
      title="Löschen"
    >×</button>

      </div>
    `).join("")}
  </div>
`;
}).join("")}

  </section>
`;
}
function renderShopping() {
  const list = document.querySelector("#shoppingList");
  if (!list) return;

  if (!shoppingItems.length) {
    list.innerHTML = `
      <div class="workroom-empty">
        Noch nichts auf der Einkaufsliste.
      </div>
    `;
    return;
  }

  const nowItems =
    shoppingItems.filter(item => item.when === "now");

  const laterItems =
    shoppingItems.filter(item => item.when === "later");

  const saleItems =
    shoppingItems.filter(item => item.when === "sale");

  list.innerHTML = `
    ${renderShoppingGroup("Jetzt einkaufen", nowItems)}
    ${renderShoppingGroup("Später kaufen", laterItems, true)}
    ${renderShoppingGroup("Erst in Aktion kaufen", saleItems, true)}
  `;

  // Artikel abhaken
  document.querySelectorAll(".shopping-check").forEach(check => {
    check.addEventListener("change", e => {
      const id = e.currentTarget.dataset.id;
      const item = shoppingItems.find(item => item.id === id);

      if (!item) return;

      item.done = e.currentTarget.checked;

      state.shopping = shoppingItems;
saveLocal();

shoppingCollection()
  .doc(id)
  .set({ done: item.done }, { merge: true })
  .catch(err => {
    console.error("Shopping item update failed:", err);
  });
      
      // Sofort neu zeichnen:
      // erledigter Artikel wird heller/durchgestrichen
      renderShopping();

      // Nach 10 Sekunden aus der Liste entfernen
      if (item.done) {
        setTimeout(() => {
          const currentItem =
            shoppingItems.find(item => item.id === id);

          if (!currentItem || !currentItem.done) return;

          const index =
            shoppingItems.findIndex(item => item.id === id);

          if (index !== -1) {
            shoppingItems.splice(index, 1);
state.shopping = shoppingItems;
saveLocal();
renderShopping();

shoppingCollection()
  .doc(id)
  .delete()
  .catch(err => {
    console.error("Shopping item auto-delete failed:", err);
  });
          }
        }, 10000);
      }
    });
  });

// Artikel bewusst löschen
document.querySelectorAll(".shopping-delete").forEach(button => {
  button.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;

    const index =
      shoppingItems.findIndex(item => item.id === id);

    if (index === -1) return;

    shoppingItems.splice(index, 1);
    state.shopping = shoppingItems;
    saveLocal();
    renderShopping();

    shoppingCollection()
      .doc(id)
      .delete()
      .catch(err => {
        console.error("Shopping item delete failed:", err);
      });
  });
});
}

document.querySelector("#addShoppingItemBtn")
  ?.addEventListener("click", () => {

    const input =
      document.querySelector("#shoppingItemInput");

    const category =
      document.querySelector("#shoppingCategory");

    const when =
      document.querySelector("#shoppingWhen");

    const store =
      document.querySelector("#shoppingSaleStore");

    const name = input?.value.trim();

    if (!name) return;

const newItem = {
  id: uid(),
  name,
  category: category?.value || "other",
  when: when?.value || "now",
  store: store?.value || "",
  createdAt: Date.now()
};

shoppingItems.push(newItem);
state.shopping = shoppingItems;
saveLocal();

shoppingCollection()
  .doc(newItem.id)
  .set({
    name: newItem.name,
    category: newItem.category,
    when: newItem.when,
    store: newItem.store,
    createdAt: newItem.createdAt
  })
  .catch(err => {
    console.error("Shopping item save failed:", err);
  });
    
  input.value = "";
category.value = "";
when.value = "now";
store.value = "";

    renderShopping();
  });
// ===== EINKAUF – REZEPTKARTEN =====
let activeRecipeDifficulty = "all";
let activeRecipeCategory = "all";
let recipeCategoryTouched = false;
let recipeKidsOnly = false;
let recipeHealthyOnly = false;
let recipeFavoriteOnly = false;
let activeRecipeSearch = "";
let mealPlanWeekOffset = 0;
let recipePage = 0;
const RECIPE_PAGE_SIZE = 10;
let editingRecipeId = null;

function resetRecipeForm() {
  ["#recipeTitle","#recipeTime","#recipeIngredients","#recipeSteps","#recipeWebUrl","#recipeYoutubeUrl","#recipeBakeTime","#recipeTemperature"]
    .forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.value = "";
    });

  const category = document.querySelector("#recipeCategory");
  if (category) category.value = "main";

  ensureRecipeCardMarkPicker();
  const cardMark = document.querySelector("#recipeCardMark");
  if (cardMark) cardMark.value = "⌁";

  const difficulty = document.querySelector("#recipeDifficulty");
  if (difficulty) difficulty.value = "medium";

  const kids = document.querySelector("#recipeKids");
  if (kids) kids.checked = false;

  const healthy = document.querySelector("#recipeHealthy");
  if (healthy) healthy.checked = false;

  const favorite = document.querySelector("#recipeFavorite");
  if (favorite) favorite.checked = false;
  syncRecipeFavoriteToggleVisual();

  editingRecipeId = null;

  const saveBtn = document.querySelector("#saveRecipeBtn");
  if (saveBtn) saveBtn.textContent = "Rezept speichern";

  document.querySelector("#cancelRecipeEditBtn")?.classList.add("hidden");
}

function startRecipeEdit(recipe) {
  if (!recipe) return;

  editingRecipeId = recipe.id;

  ensureRecipeCardMarkPicker();
  document.querySelector("#recipeTitle").value = recipe.title || "";
  document.querySelector("#recipeCategory").value = recipe.category || "main";
  const cardMark = document.querySelector("#recipeCardMark");
  if (cardMark) cardMark.value = recipeCardMark(recipe);
  document.querySelector("#recipeDifficulty").value = recipe.difficulty || "medium";
  document.querySelector("#recipeKids").checked = !!recipe.kids;
  document.querySelector("#recipeHealthy").checked = !!recipe.healthy;
  document.querySelector("#recipeFavorite").checked = !!recipe.favorite;
  syncRecipeFavoriteToggleVisual();
  document.querySelector("#recipeTime").value = recipe.time || "";
  document.querySelector("#recipeBakeTime").value = recipe.bakeTime || "";
  document.querySelector("#recipeTemperature").value = recipe.temperature || "";
  document.querySelector("#recipeIngredients").value = normalizedRecipeLines(recipe.ingredients).join("\n");
  document.querySelector("#recipeSteps").value = normalizedRecipeLines(recipe.steps).join("\n");
  document.querySelector("#recipeWebUrl").value = recipe.webUrl || "";
  document.querySelector("#recipeYoutubeUrl").value = recipe.youtubeUrl || "";

  document.querySelector("#recipeForm")?.classList.remove("hidden");

  const saveBtn = document.querySelector("#saveRecipeBtn");
  if (saveBtn) saveBtn.textContent = "Änderungen speichern";

  document.querySelector("#cancelRecipeEditBtn")?.classList.remove("hidden");
  document.querySelector("#recipeForm")?.scrollIntoView({behavior:"smooth", block:"start"});
}

function recipeDifficultyLabel(value) {
  return {easy:"Einfach", medium:"Mittel", advanced:"Etwas aufwendiger"}[value] || "Mittel";
}

function recipeCategoryLabel(value) {
  return {
    breakfast: "🥣 Frühstück & Morgenideen",
    spread: "🥖 Aufstriche & Dips",
    soup: "🍲 Suppen & Eintöpfe",
    main: "🍝 Hauptgerichte",
    small: "🥙 Kleine Sachen & Jause",
    salad: "🥗 Salate & Frisches",
    sweet: "🍓 Süßes & Backen",
    drink: "🥤 Getränke & Smoothies",
    other: "✨ Sonstiges"
  }[value] || "🍝 Hauptgerichte";
}

function recipeCategoryClass(value) {
  const key = ["breakfast","spread","soup","main","small","salad","sweet","drink","other"]
    .includes(value) ? value : "main";
  return `recipe-category-${key}`;
}

function recipeLines(value) {
  const source = Array.isArray(value) ? value.join("\n") : String(value || "");
  return source
    .replace(/\\n/g, "\n")
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizedRecipeLines(value) {
  return recipeLines(value);
}


function recipeByTitle(title) {
  const q = String(title || "").trim().toLowerCase();
  if (!q) return null;
  return (state.recipes || []).find(r =>
    String(r.title || "").trim().toLowerCase() === q
  ) || null;
}

function recipeLinkTarget(recipe) {
  if (!recipe) return "";
  return recipe.webUrl || recipe.youtubeUrl || "";
}

let activeRecipeDetailId = null;

function printRecipe(recipe) {
  if (!recipe) return;

  const category = recipeCategoryLabel(recipe.category || "main");
  const ingredients = normalizedRecipeLines(recipe.ingredients);
  const steps = normalizedRecipeLines(recipe.steps);

  const printWindow = window.open("", "_blank", "width=820,height=950");
  if (!printWindow) {
    showMotivation("Druckfenster konnte nicht geöffnet werden.");
    return;
  }

  const safeTitle = escapeHtml(recipe.title || "Rezept");
  const kidBadge = recipe.kids ? `<span class="print-badge kids">🧒 Kinderrezept</span>` : "";
  const healthyBadge = recipe.healthy ? `<span class="print-badge healthy">🌿 Gesund & bunt</span>` : "";
  const time = recipe.time ? `<span class="print-badge">◔ ${escapeHtml(recipe.time)}</span>` : "";

  printWindow.document.write(`
    <!doctype html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <title>${safeTitle}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #424745;
          font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
          background: white;
        }
        .sheet {
          border: 1px solid #c9d9d5;
          border-radius: 18px;
          overflow: hidden;
        }
        .head {
          padding: 24px 28px 20px;
          text-align: center;
          background: #c6ddd8;
        }
        .eyebrow {
          font-size: 10px;
          letter-spacing: .18em;
          color: #6f7d79;
        }
        h1 {
          margin: 8px 0 12px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px;
          font-weight: 500;
        }
        .badges {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .print-badge {
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.72);
          font-size: 11px;
        }
        .kids { background: #fff0ba; }
        .healthy { background: #e2efe3; }
        .content {
          display: grid;
          grid-template-columns: 1fr 1.25fr;
        }
        section {
          padding: 24px 26px 30px;
          min-height: 360px;
        }
        section + section { border-left: 1px solid #dce6e3; }
        h2 {
          margin: 0 0 14px;
          padding-bottom: 7px;
          border-bottom: 2px solid #d3e3df;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        ul {
          margin: 0;
          padding-left: 20px;
        }
        li, .step {
          margin-bottom: 9px;
          font-size: 14px;
          line-height: 1.5;
        }
        .footer {
          padding: 10px;
          text-align: center;
          background: #d8e8e4;
          color: white;
        }
        .links {
          padding: 12px 26px 18px;
          font-size: 11px;
          color: #71807c;
        }
        @media print {
          .sheet { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <header class="head">
          <div class="eyebrow">REZEPT</div>
          <h1>${safeTitle}</h1>
          <div class="badges">
            <span class="print-badge">${escapeHtml(category)}</span>
            <span class="print-badge">${escapeHtml(recipeDifficultyLabel(recipe.difficulty))}</span>
            ${time}${kidBadge}${healthyBadge}
          </div>
        </header>
        <div class="content">
          <section>
            <h2>Zutaten</h2>
            <ul>${ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section>
            <h2>Zubereitung</h2>
            ${steps.map(step => `<div class="step">${escapeHtml(step)}</div>`).join("")}
          </section>
        </div>
        ${(recipe.webUrl || recipe.youtubeUrl) ? `
          <div class="links">
            ${recipe.webUrl ? `Online-Rezept: ${escapeHtml(recipe.webUrl)}<br>` : ""}
            ${recipe.youtubeUrl ? `YouTube: ${escapeHtml(recipe.youtubeUrl)}` : ""}
          </div>` : ""}
        <footer class="footer">♡</footer>
      </main>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function showRecipeDetail(recipeOrTitle) {
  const recipe = typeof recipeOrTitle === "string"
    ? recipeByTitle(recipeOrTitle)
    : recipeOrTitle;

  if (!recipe) return false;
  activeRecipeDetailId = recipe.id;

  const dialog = document.querySelector("#recipeDetailDialog");
  const title = document.querySelector("#recipeDetailTitle");
  const body = document.querySelector("#recipeDetailBody");
  if (!dialog || !title || !body) return false;

  title.textContent = recipe.title || "Rezept";

  body.innerHTML = `
    <div class="recipe-detail-banner ${recipeCategoryClass(recipe.category || "main")} ${recipe.kids ? "recipe-detail-kids" : ""}">
      <div class="recipe-detail-time">
        <span class="recipe-detail-clock">◔</span>
        <span>${escapeHtml(recipe.time || "–")}</span>
        ${(recipe.bakeTime || recipe.temperature) ? `
          <small class="recipe-bake-meta">
            ${recipe.bakeTime ? `♨ ${escapeHtml(recipe.bakeTime)}` : ""}
            ${recipe.temperature ? ` · ${escapeHtml(recipe.temperature)}` : ""}
          </small>
        ` : ""}
      </div>
      <div class="recipe-detail-center">
        <span class="recipe-detail-ribbon">REZEPT</span>
        <div class="recipe-detail-tags">
          <span>${escapeHtml(recipeCategoryLabel(recipe.category || "main"))}</span>
          <span>${escapeHtml(recipeDifficultyLabel(recipe.difficulty))}</span>
          ${recipe.kids ? `<span class="recipe-kids-badge">🧒 Das kannst du selbst kochen!</span>` : ""}
          ${recipe.healthy ? `<span class="recipe-healthy-badge">🌿 Gesund & bunt</span>` : ""}
        </div>
      </div>
      <div class="recipe-detail-utensil">${escapeHtml(recipeCardMark(recipe))}</div>
    </div>

    <div class="recipe-detail-grid">
      <section>
        <h3>Zutaten</h3>
        <div class="recipe-cook-checklist">
          ${normalizedRecipeLines(recipe.ingredients).map(x => `
            <button type="button" class="recipe-cook-line">
              <span class="recipe-cook-dot">○</span>
              <span>${escapeHtml(x)}</span>
            </button>
          `).join("")}
        </div>
      </section>
      <section>
        <h3>Zubereitung</h3>
        <div class="recipe-cook-checklist">
          ${normalizedRecipeLines(recipe.steps).map(x => `
            <button type="button" class="recipe-cook-line">
              <span class="recipe-cook-dot">○</span>
              <span>${escapeHtml(x)}</span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>

    <div class="recipe-detail-links">
      ${recipe.webUrl ? `<a href="${escapeHtml(recipe.webUrl)}" target="_blank" rel="noopener">↗ Onlinerezept öffnen</a>` : ""}
      ${recipe.youtubeUrl ? `<a href="${escapeHtml(recipe.youtubeUrl)}" target="_blank" rel="noopener">▶ YouTube öffnen</a>` : ""}
    </div>
  `;

  body.querySelectorAll(".recipe-cook-line").forEach(line => {
    line.addEventListener("click", () => {
      const done = line.classList.toggle("done");
      const dot = line.querySelector(".recipe-cook-dot");
      if (dot) dot.textContent = done ? "✓" : "○";
    });
  });

  dialog.showModal();
  return true;
}

function renderRecipePager(totalItems) {
  const host = document.querySelector("#recipePager");
  if (!host) return;

  const totalPages = Math.ceil(totalItems / RECIPE_PAGE_SIZE);
  recipePage = Math.min(recipePage, Math.max(0, totalPages - 1));

  if (totalPages <= 1) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = `
    <button type="button" class="recipe-page-btn" data-page="${recipePage - 1}" ${recipePage <= 0 ? "disabled" : ""}>‹</button>
    ${Array.from({length: totalPages}, (_, i) =>
      `<button type="button" class="recipe-page-btn ${i === recipePage ? "active" : ""}" data-page="${i}">${i + 1}</button>`
    ).join("")}
    <button type="button" class="recipe-page-btn" data-page="${recipePage + 1}" ${recipePage >= totalPages - 1 ? "disabled" : ""}>›</button>
  `;

  host.querySelectorAll(".recipe-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const next = Number(btn.dataset.page);
      if (!Number.isFinite(next) || next < 0 || next >= totalPages) return;
      recipePage = next;
      renderRecipes();
      document.querySelector("#recipeList")?.scrollIntoView({behavior:"smooth", block:"start"});
    });
  });
}

function renderRecipes() {
  const host = document.querySelector("#recipeList");
  if (!host) return;
  state.recipes = Array.isArray(state.recipes) ? state.recipes : [];

  const query = activeRecipeSearch.trim().toLowerCase();

  const recipes = state.recipes
    .filter(r => {
      const matchesCategory =
        activeRecipeCategory === "all" || (r.category || "main") === activeRecipeCategory;
      const matchesDifficulty =
        activeRecipeDifficulty === "all" || r.difficulty === activeRecipeDifficulty;
      const matchesKids = !recipeKidsOnly || !!r.kids;
      const matchesHealthy = !recipeHealthyOnly || !!r.healthy;
      const matchesFavorite = !recipeFavoriteOnly || !!r.favorite;
      const haystack = [
        r.title,
        ...(Array.isArray(r.ingredients) ? r.ingredients : [])
      ].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesDifficulty && matchesKids && matchesHealthy && matchesFavorite && matchesSearch;
    })
    .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

  recipePage = Math.min(
    recipePage,
    Math.max(0, Math.ceil(recipes.length / RECIPE_PAGE_SIZE) - 1)
  );
  const visibleRecipes = recipes.slice(
    recipePage * RECIPE_PAGE_SIZE,
    recipePage * RECIPE_PAGE_SIZE + RECIPE_PAGE_SIZE
  );

  if (!recipes.length) {
    host.innerHTML = `<div class="workroom-empty">Keine passenden Rezepte gefunden.</div>`;
    renderRecipePager(0);
    renderRecipeSearchSuggestions();
    renderRecipeToc();
    return;
  }

  host.innerHTML = visibleRecipes.map(r => `
    <article class="recipe-card ${recipeCategoryClass(r.category || "main")} ${r.kids ? "recipe-card-kids" : ""}" id="recipe-${r.id}">
      <header class="recipe-card-head">
        <div class="recipe-time-mark">
          <span class="recipe-clock">◔</span>
          <span>${escapeHtml(r.time || "–")}</span>
          ${(r.bakeTime || r.temperature) ? `
            <small class="recipe-bake-meta">
              ${r.bakeTime ? `♨ ${escapeHtml(r.bakeTime)}` : ""}
              ${r.temperature ? ` · ${escapeHtml(r.temperature)}` : ""}
            </small>
          ` : ""}
        </div>
        <div class="recipe-title-wrap">
          <span class="recipe-ribbon">REZEPT</span>
          <button type="button" class="recipe-title-button" data-recipe-id="${r.id}">
            ${escapeHtml(r.title)}
          </button>
          <div class="recipe-badges">
            <span>${escapeHtml(recipeCategoryLabel(r.category || "main"))}</span>
            <span>${escapeHtml(recipeDifficultyLabel(r.difficulty))}</span>
            ${r.kids ? `<span class="recipe-kids-badge">🧒 Das kannst du selbst kochen!</span>` : ""}
            ${r.healthy ? `<span class="recipe-healthy-badge">🌿 Gesund & bunt</span>` : ""}
            ${r.favorite ? `<span class="recipe-favorite-badge">★ Lieblingsrezept</span>` : ""}
          </div>
        </div>
        <div class="recipe-tools">${escapeHtml(recipeCardMark(r))}</div>
      </header>
      <div class="recipe-card-body">
        <section class="recipe-column">
          <h4>ZUTATEN</h4>
          <ul>${normalizedRecipeLines(r.ingredients).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
        </section>
        <section class="recipe-column">
          <h4>ZUBEREITUNG</h4>
          <div class="recipe-prep-lines">${normalizedRecipeLines(r.steps).map(x => `<div class="recipe-prep-line">${escapeHtml(x)}</div>`).join("")}</div>
        </section>
      </div>
      <footer class="recipe-card-footer">
        <div class="recipe-links">
          ${r.webUrl ? `<a href="${escapeHtml(r.webUrl)}" target="_blank" rel="noopener">↗ Onlinerezept</a>` : ""}
          ${r.youtubeUrl ? `<a href="${escapeHtml(r.youtubeUrl)}" target="_blank" rel="noopener">▶ YouTube</a>` : ""}
        </div>
        <div class="recipe-card-actions">
          <button class="recipe-print" data-id="${r.id}" type="button" title="Rezept drucken" aria-label="Rezept drucken">🖨</button>
          <button class="recipe-edit" data-id="${r.id}" type="button" title="Rezept bearbeiten">✎</button>
          <button class="recipe-delete" data-id="${r.id}" type="button" title="Rezept löschen">×</button>
        </div>
      </footer>
    </article>
  `).join("");

  host.querySelectorAll(".recipe-delete").forEach(btn => btn.addEventListener("click", () => {
    const recipe = state.recipes.find(r => r.id === btn.dataset.id);
    if (!recipe) return;

    pendingRecipeDeleteId = recipe.id;
    const text = document.querySelector("#recipeDeleteText");
    if (text) text.textContent = `„${recipe.title || "Dieses Rezept"}“ wird dauerhaft aus deinen Rezeptkarten entfernt.`;
    document.querySelector("#recipeDeleteDialog")?.showModal();
  }));

  host.querySelectorAll(".recipe-print").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.id);
      if (recipe) printRecipe(recipe);
    });
  });

  host.querySelectorAll(".recipe-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.id);
      if (recipe) startRecipeEdit(recipe);
    });
  });

  host.querySelectorAll(".recipe-title-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.recipeId);
      if (recipe) showRecipeDetail(recipe);
    });
  });

  renderRecipePager(recipes.length);
  renderRecipeSearchSuggestions();
  renderRecipeToc();
}


function renderRecipeSearchSuggestions() {
  const list = document.querySelector("#recipeSearchSuggestions");
  const popup = document.querySelector("#recipeAutocomplete");
  const input = document.querySelector("#recipeSearch");
  const recipes = (state.recipes || [])
    .slice()
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de"));

  if (list) {
    list.innerHTML = recipes
      .map(r => `<option value="${escapeHtml(r.title || "")}"></option>`)
      .join("");
  }

  if (!popup || !input) return;
  const q = (input.value || "").trim().toLowerCase();

  if (!q) {
    popup.classList.add("hidden");
    popup.innerHTML = "";
    return;
  }

  const matches = recipes
    .filter(r => String(r.title || "").toLowerCase().includes(q))
    .slice(0, 7);

  if (!matches.length) {
    popup.classList.add("hidden");
    popup.innerHTML = "";
    return;
  }

  popup.innerHTML = matches.map(r =>
    `<button type="button" class="recipe-autocomplete-item" data-title="${escapeHtml(r.title || "")}">
       ${escapeHtml(r.title || "")}
     </button>`
  ).join("");
  popup.classList.remove("hidden");

  popup.querySelectorAll(".recipe-autocomplete-item").forEach(btn => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.title || "";
      activeRecipeSearch = input.value;
      popup.classList.add("hidden");
      renderRecipes();
    });
  });
}

function renderRecipeToc() {
  const host = document.querySelector("#recipeTocList");
  if (!host) return;

  const recipes = (state.recipes || [])
    .slice()
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de"));

  if (!recipes.length) {
    host.innerHTML = `<span class="recipe-toc-empty">Noch keine Rezepte.</span>`;
    return;
  }

  host.innerHTML = recipes
    .map(r => `<button type="button" class="recipe-toc-link" data-id="${r.id}" data-title="${escapeHtml(r.title || "")}">${escapeHtml(r.title || "Ohne Titel")}</button>`)
    .join("");

  host.querySelectorAll(".recipe-toc-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const search = document.querySelector("#recipeSearch");
      if (search) search.value = btn.dataset.title || "";
      activeRecipeSearch = btn.dataset.title || "";
      renderRecipes();
      requestAnimationFrame(() => {
        const card = document.querySelector(`#recipe-${CSS.escape(btn.dataset.id)}`);
        if (card) card.scrollIntoView({behavior:"smooth", block:"start"});
      });
    });
  });
}

function mealPlanMonday(offset = 0) {
  const monday = new Date(currentWeekMonday);
  monday.setDate(monday.getDate() + offset * 7);
  return monday;
}


function normalizeMealEntry(entry) {
  if (!entry) return null;

  if (typeof entry === "string") {
    return {
      label: /^https?:\/\//i.test(entry.trim()) ? "" : entry.trim(),
      recipeId: "",
      url: /^https?:\/\//i.test(entry.trim()) ? entry.trim() : "",
      updatedAt: 0
    };
  }

  if (typeof entry !== "object") return null;

  let label = String(entry.label || "").trim();
  let url = String(entry.url || "").trim();

  if (/^https?:\/\//i.test(label) && !url) {
    url = label;
    label = "";
  }

  return {
    label,
    recipeId: String(entry.recipeId || ""),
    url,
    deleted: entry.deleted === true,
    updatedAt: Number(entry.updatedAt) || 0
  };
}

function mergeMeals(localMeals, cloudMeals) {
  const local = localMeals && typeof localMeals === "object" ? localMeals : {};
  const cloud = cloudMeals && typeof cloudMeals === "object" ? cloudMeals : {};
  const merged = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  keys.forEach(key => {
    const l = normalizeMealEntry(local[key]);
    const c = normalizeMealEntry(cloud[key]);

    if (!l && !c) return;
    if (!l) { merged[key] = c; return; }
    if (!c) { merged[key] = l; return; }

    // Neue Einträge tragen updatedAt. Dann gewinnt immer die neuere Fassung.
    if (l.updatedAt || c.updatedAt) {
      merged[key] = l.updatedAt >= c.updatedAt ? l : c;
      return;
    }

    // Migration alter Daten: die vollständigere Fassung behalten.
    const localScore = Number(!!l.label) * 3 + Number(!!l.recipeId) * 2 + Number(!!l.url);
    const cloudScore = Number(!!c.label) * 3 + Number(!!c.recipeId) * 2 + Number(!!c.url);
    merged[key] = localScore >= cloudScore ? l : c;
  });

  return merged;
}

function renderMealPlan() {
  const host = document.querySelector("#mealPlanGrid");
  if (!host) return;

  const monday = mealPlanMonday(mealPlanWeekOffset);
  const recipes = (state.recipes || [])
    .slice()
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de"));

  const isUrl = value => /^https?:\/\//i.test(String(value || "").trim());

  host.innerHTML = days.map((dayName, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = dateKey(date);

    const storedRaw = normalizeMealEntry ? normalizeMealEntry(state.meals?.[key]) : state.meals?.[key];
    const stored = storedRaw?.deleted === true ? null : storedRaw;
    const value = typeof stored === "string" ? stored : (stored?.label || "");
    const customUrl = typeof stored === "object" ? (stored?.url || "") : "";
    const recipeId = typeof stored === "object" ? (stored?.recipeId || "") : "";

    const matched = recipeId
      ? recipes.find(r => r.id === recipeId)
      : recipeByTitle(value);

    return `
      <div class="meal-plan-day">
        <div class="meal-plan-day-head">
          <span class="meal-plan-day-name">${escapeHtml(dayName)}</span>
          <span class="meal-plan-date">${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</span>
        </div>

        <div class="meal-plan-input-wrap">
          <div class="meal-plan-name-wrap">
            <input type="text"
                   class="meal-plan-input"
                   data-date="${key}"
                   value="${escapeHtml(value)}"
                   autocomplete="off"
                   placeholder="Bezeichnung, z. B. Pommes">
            <div class="meal-plan-autocomplete hidden" data-date="${key}"></div>
          </div>

          <button type="button"
                  class="meal-plan-link-toggle ${customUrl ? "active" : ""}"
                  data-date="${key}"
                  title="Link hinterlegen">🔗</button>

          ${matched ? `
            <button type="button"
                    class="meal-plan-recipe-btn"
                    data-recipe-id="${matched.id}"
                    title="Rezept öffnen">↗</button>
          ` : customUrl ? `
            <a class="meal-plan-recipe-btn"
               href="${escapeHtml(customUrl)}"
               target="_blank"
               rel="noopener"
               title="Link öffnen">↗</a>
          ` : ""}
        </div>

        <div class="meal-plan-url-row ${customUrl ? "" : "hidden"}" data-date="${key}">
          <input type="url"
                 class="meal-plan-url-input"
                 data-date="${key}"
                 value="${escapeHtml(customUrl)}"
                 placeholder="Link einfügen, z. B. https://…">
        </div>
      </div>
    `;
  }).join("");

  function persistMealForDate(key, {refresh = false, cloud = true} = {}) {
    const esc = CSS.escape(key);
    const labelInput = host.querySelector(`.meal-plan-input[data-date="${esc}"]`);
    const urlInput = host.querySelector(`.meal-plan-url-input[data-date="${esc}"]`);

    let label = labelInput?.value.trim() || "";
    let url = urlInput?.value.trim() || "";

    if (isUrl(label) && !url) {
      url = label;
      label = "";
      if (labelInput) labelInput.value = "";
      if (urlInput) urlInput.value = url;
    }

    const matched = recipeByTitle(label);
    state.meals = state.meals && typeof state.meals === "object" ? state.meals : {};

    if (!label && !url) {
      // Wichtig für mehrere Geräte:
      // Nicht einfach den Schlüssel entfernen. Sonst kann ein anderes Gerät
      // mit dem alten Eintrag ("Pommes") ihn beim nächsten Merge zurückbringen.
      // Stattdessen speichern wir eine Löschmarke mit Zeitstempel.
      state.meals[key] = {
        label: "",
        recipeId: "",
        url: "",
        deleted: true,
        updatedAt: Date.now()
      };
    } else {
      state.meals[key] = {
        label: matched ? matched.title : label,
        recipeId: matched ? matched.id : "",
        url,
        deleted: false,
        updatedAt: Date.now()
      };
    }

    // Beim Tippen NICHT in die Cloud schreiben:
    // der Firestore-Rückkanal würde renderAll() auslösen und dem Textfeld
    // nach jedem Buchstaben den Fokus nehmen.
    if (cloud) {
      save();
    } else {
      saveLocal();
    }

    renderWeek();
    if (refresh) renderMealPlan();
  }

  function showMealSuggestions(input) {
    const key = input.dataset.date;
    const popup = host.querySelector(`.meal-plan-autocomplete[data-date="${CSS.escape(key)}"]`);
    if (!popup) return;

    const q = input.value.trim().toLowerCase();
    if (!q) {
      popup.innerHTML = "";
      popup.classList.add("hidden");
      return;
    }

    const matches = recipes
      .filter(r => String(r.title || "").toLowerCase().includes(q))
      .slice(0, 6);

    if (!matches.length) {
      popup.innerHTML = "";
      popup.classList.add("hidden");
      return;
    }

    popup.innerHTML = matches.map(r => `
      <button type="button"
              class="meal-plan-autocomplete-item"
              data-title="${escapeHtml(r.title || "")}"
              data-recipe-id="${r.id}">
        <strong>${escapeHtml(r.title || "")}</strong>
        <span>${escapeHtml(recipeCategoryLabel(r.category || "main"))}</span>
      </button>
    `).join("");
    popup.classList.remove("hidden");

    popup.querySelectorAll(".meal-plan-autocomplete-item").forEach(btn => {
      btn.addEventListener("mousedown", e => e.preventDefault());
      btn.addEventListener("click", () => {
        input.value = btn.dataset.title || "";
        popup.classList.add("hidden");
        persistMealForDate(key, {refresh:true, cloud:true});
      });
    });
  }

  host.querySelectorAll(".meal-plan-input").forEach(input => {
    input.addEventListener("input", () => {
      // lokal sichern, Fokus behalten, Vorschläge offen lassen
      persistMealForDate(input.dataset.date, {cloud:false});
      showMealSuggestions(input);
    });

    input.addEventListener("focus", () => showMealSuggestions(input));

    input.addEventListener("blur", () => {
      // Beim Verlassen erst gemeinsam synchronisieren.
      persistMealForDate(input.dataset.date, {cloud:true});
      setTimeout(() => {
        const popup = host.querySelector(`.meal-plan-autocomplete[data-date="${CSS.escape(input.dataset.date)}"]`);
        popup?.classList.add("hidden");
      }, 160);
    });

    input.addEventListener("change", () => {
      persistMealForDate(input.dataset.date, {cloud:true});
    });
  });

  host.querySelectorAll(".meal-plan-url-input").forEach(input => {
    input.addEventListener("input", () => {
      persistMealForDate(input.dataset.date, {cloud:false});
    });
    input.addEventListener("blur", () => {
      persistMealForDate(input.dataset.date, {cloud:true});
    });
    input.addEventListener("change", () => {
      persistMealForDate(input.dataset.date, {cloud:true});
    });
  });

  host.querySelectorAll(".meal-plan-link-toggle").forEach(btn => {
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", () => {
      const row = host.querySelector(`.meal-plan-url-row[data-date="${CSS.escape(btn.dataset.date)}"]`);
      row?.classList.toggle("hidden");
      if (row && !row.classList.contains("hidden")) row.querySelector("input")?.focus();
    });
  });

  host.querySelectorAll(".meal-plan-recipe-btn[data-recipe-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const recipe = state.recipes.find(r => r.id === btn.dataset.recipeId);
      if (recipe) showRecipeDetail(recipe);
    });
  });

  document.querySelector("#mealPlanThisWeekBtn")?.classList.toggle("active", mealPlanWeekOffset === 0);
  document.querySelector("#mealPlanNextWeekBtn")?.classList.toggle("active", mealPlanWeekOffset === 1);
}

function closeRecipeDetailDialog() {
  const dialog = document.querySelector("#recipeDetailDialog");
  if (dialog?.open) dialog.close();
  activeRecipeDetailId = null;
}

document.querySelector("#printRecipeDetailBtn")?.addEventListener("click", () => {
  const recipe = state.recipes.find(r => r.id === activeRecipeDetailId);
  if (recipe) printRecipe(recipe);
});

document.querySelector("#closeRecipeDetailBtn")?.addEventListener("click", closeRecipeDetailDialog);

document.querySelector("#recipeDetailDialog")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) closeRecipeDetailDialog();
});

document.querySelector("#cancelRecipeDeleteBtn")?.addEventListener("click", () => {
  pendingRecipeDeleteId = null;
  document.querySelector("#recipeDeleteDialog")?.close();
});

document.querySelector("#confirmRecipeDeleteBtn")?.addEventListener("click", () => {
  if (!pendingRecipeDeleteId) return;
  state.recipes = state.recipes.filter(r => r.id !== pendingRecipeDeleteId);
  pendingRecipeDeleteId = null;
  save();
  renderRecipes();
  renderMealPlan();
  document.querySelector("#recipeDeleteDialog")?.close();
  showMotivation("Rezept gelöscht.");
});

document.querySelector("#toggleRecipeFormBtn")?.addEventListener("click", () => {
  document.querySelector("#recipeForm")?.classList.toggle("hidden");
});
document.querySelector("#recipeSearch")?.addEventListener("input", e => {
  activeRecipeSearch = e.currentTarget.value || "";
  recipePage = 0;
  renderRecipes();
  renderRecipeSearchSuggestions();
});

document.querySelector("#recipeCategoryFilter")?.addEventListener("change", e => {
  recipeCategoryTouched = true;
  activeRecipeCategory = e.currentTarget.value || "all";
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeDifficultyFilter")?.addEventListener("change", e => {
  activeRecipeDifficulty = e.currentTarget.value || "all";
  recipePage = 0;
  renderRecipes();
});
document.querySelector("#recipeKidsOnlyFilter")?.addEventListener("change", e => {
  recipeKidsOnly = !!e.currentTarget.checked;
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeHealthyOnlyFilter")?.addEventListener("change", e => {
  recipeHealthyOnly = !!e.currentTarget.checked;
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeFavoriteOnlyFilter")?.addEventListener("change", e => {
  recipeFavoriteOnly = !!e.currentTarget.checked;
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#mealPlanThisWeekBtn")?.addEventListener("click", () => {
  mealPlanWeekOffset = 0;
  renderMealPlan();
});

document.querySelector("#mealPlanNextWeekBtn")?.addEventListener("click", () => {
  mealPlanWeekOffset = 1;
  renderMealPlan();
});
function syncRecipeFavoriteToggleVisual() {
  const label = document.querySelector(".recipe-favorite-toggle");
  const input = document.querySelector("#recipeFavorite");
  if (!label || !input) return;
  label.classList.toggle("is-favorite", !!input.checked);

  const text = label.querySelector("span");
  if (text) text.textContent = input.checked ? "★ Favorit" : "☆ Favorit";
}

document.querySelector("#recipeFavorite")?.addEventListener("change", syncRecipeFavoriteToggleVisual);
syncRecipeFavoriteToggleVisual();

document.querySelector("#saveRecipeBtn")?.addEventListener("click", () => {
  const title = document.querySelector("#recipeTitle")?.value.trim() || "";
  if (!title) return showMotivation("Bitte zuerst einen Rezeptnamen eintragen.");

  const recipeData = {
    title,
    category: document.querySelector("#recipeCategory")?.value || "main",
    cardMark: document.querySelector("#recipeCardMark")?.value || "⌁",
    difficulty: document.querySelector("#recipeDifficulty")?.value || "medium",
    kids: !!document.querySelector("#recipeKids")?.checked,
    healthy: !!document.querySelector("#recipeHealthy")?.checked,
    favorite: !!document.querySelector("#recipeFavorite")?.checked,
    time: document.querySelector("#recipeTime")?.value.trim() || "",
    bakeTime: document.querySelector("#recipeBakeTime")?.value.trim() || "",
    temperature: document.querySelector("#recipeTemperature")?.value.trim() || "",
    ingredients: recipeLines(document.querySelector("#recipeIngredients")?.value),
    steps: recipeLines(document.querySelector("#recipeSteps")?.value),
    webUrl: document.querySelector("#recipeWebUrl")?.value.trim() || "",
    youtubeUrl: document.querySelector("#recipeYoutubeUrl")?.value.trim() || ""
  };

  if (editingRecipeId) {
    const recipe = state.recipes.find(r => r.id === editingRecipeId);
    if (recipe) {
      Object.assign(recipe, recipeData, {updatedAt: Date.now()});

      // Bereits verknüpfte Essensplan-Einträge behalten die Verbindung,
      // bekommen aber automatisch den neuen Rezeptnamen.
      Object.keys(state.meals || {}).forEach(key => {
        const meal = state.meals[key];
        if (meal && typeof meal === "object" && meal.recipeId === recipe.id) {
          meal.label = recipe.title;
        }
      });
    }
  } else {
    state.recipes.push({
      id: uid(),
      ...recipeData,
      createdAt: Date.now()
    });
  }

  const wasEditing = !!editingRecipeId;
  save();
  renderRecipes();
  renderMealPlan();
  renderWeek();
  resetRecipeForm();
  document.querySelector("#recipeForm")?.classList.add("hidden");
  showMotivation(wasEditing ? "Rezept geändert." : "Rezept gespeichert.");
});

document.querySelector("#cancelRecipeEditBtn")?.addEventListener("click", () => {
  resetRecipeForm();
  document.querySelector("#recipeForm")?.classList.add("hidden");
});


renderAll();
// =============================
// WERKRAUM – BEREICHE AUF/ZU
// =============================

document.addEventListener("click", e => {
  const head = e.target.closest(".workroom-fold-head");
  if (!head) return;

  const card = head.closest(".workroom-fold-card");
  if (!card) return;

  document.querySelectorAll(".workroom-fold-card").forEach(otherCard => {
    otherCard.classList.remove("open");
  });

  card.classList.add("open");
});

/* --- Multi-day event horizontal alignment --- */
function alignMultiDayEventRows() {
  const week = document.querySelector(".week-grid, #weekGrid, .weekGrid, .weekly-grid");
  if (!week) return;

  const cards = [...week.querySelectorAll(
    ".event-card, .calendar-event, .appointment-card, .week-event, [data-event-id], [data-event-key]"
  )].filter(el => el.offsetParent !== null);

  cards.forEach(el => {
    if (el.dataset.multiAlignAdded) {
      el.style.transform = el.dataset.multiAlignBaseTransform || "";
      delete el.dataset.multiAlignAdded;
    }
  });

  const keyFor = el => {
    const explicit = el.dataset.eventId || el.dataset.eventKey || el.dataset.seriesId || "";
    if (explicit) return "id:" + explicit;
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".new-badge,.badge,.person-label,.event-person").forEach(n => n.remove());
    return "txt:" + clone.textContent.replace(/\bNEU\b/gi,"").replace(/\s+/g," ").trim().toLowerCase();
  };

  const groups = new Map();
  cards.forEach(el => {
    const key = keyFor(el);
    if (!key || key === "txt:") return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  });

  groups.forEach(group => {
    if (group.length < 2) return;
    const tops = group.map(el => el.getBoundingClientRect().top);
    const targetTop = Math.max(...tops);
    group.forEach((el, i) => {
      const dy = Math.round(targetTop - tops[i]);
      if (dy > 0) {
        el.dataset.multiAlignBaseTransform = el.style.transform || "";
        el.dataset.multiAlignAdded = "1";
        el.style.transform = `${el.style.transform || ""} translateY(${dy}px)`.trim();
      }
    });
  });
}

function scheduleMultiDayAlignment() {
  requestAnimationFrame(() => requestAnimationFrame(alignMultiDayEventRows));
}
window.addEventListener("load", scheduleMultiDayAlignment);
window.addEventListener("resize", scheduleMultiDayAlignment);
document.addEventListener("click", e => {
  if (e.target.closest("button, input, select, .week-nav, .week-navigation")) {
    setTimeout(scheduleMultiDayAlignment, 80);
  }
});


document.querySelector("#emptyTrashBtn")?.addEventListener("click",()=>{
  if(!(state.trash||[]).length)return;
  if(!confirm("Papierkorb wirklich endgültig leeren?"))return;
  state.trash=[];save();renderTrash();
});
