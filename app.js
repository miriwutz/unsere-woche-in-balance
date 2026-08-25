/* =========================================================
   V146 – GELD-HISTORIE KOMPAKT
   - "Letzte Zahlungen" standardmäßig eingeklappt
   - nur tatsächlich erhaltene Taschengeld-/Jausenzahlungen anzeigen
   - keine Änderung an Zahlungs- oder Sync-Logik
   ========================================================= */

/* =========================================================
   V145 – MEIN GELD LIVE-ANZEIGE
   - offenes Lou/Fina-Geldfenster aktualisiert sich bei Cloud-Änderungen sofort
   - gilt für Taschengeld/Jausengeld, Zahlstatus, Monatsübersicht,
     Geliehenes, Sparziel/Sparstand und Edelsteine
   - keine Änderung an Geld-/Edelstein-Daten oder Merge-Logik
   ========================================================= */

/* =========================================================
   V144 – KINDER-ROUTINEN LIVE-ANZEIGE
   - offene Lou/Fina-Routinen werden bei Cloud-Änderungen sofort neu gerendert
   - keine Änderung an Routine-Daten, Merge-Logik oder Optik
   ========================================================= */

/* =========================================================
   V143 – PINNWAND-TON ZUVERLÄSSIGER
   - AudioContext wird bei normalen Benutzeraktionen erneut aktiviert
   - kein wiederholter Extra-Klick auf "Benachrichtigungen aktiv" nötig
   - keine Änderung am Pinnwand-Sync
   ========================================================= */

/* =========================================================
   V142 – ROUTINEN SORTIEREN NUR AM PC
   - Mama/Lou/Fina: Reihenfolge per Maus innerhalb eines Tagesbereichs verschiebbar
   - Handy/Tablet: keine Drag-Funktion, Reihenfolge wird nur übernommen
   - keine Änderung an Sync- oder Routinen-Inhalten
   ========================================================= */

/* =========================================================
   V140 – SYNC-FIX "FÜR EUCH"
   - Lou/Fina-Schulaufgaben bekommen echte Löschmarker
   - bestehende tombstone-fähige Schul-Merge-Logik wird verwendet
   - neue Schulaufgaben/Links erhalten Zeitstempel
   - keine optischen Änderungen
   ========================================================= */

/* =========================================================
   V139 – SYNC-HÄRTUNG
   - Einkauf: shoppingItems-Collection ist einzige Cloud-Wahrheit
   - Einmalige Einkaufsmigration kann gelöschte Listen nicht neu beleben
   - Schule: ID-Listen werden elementweise statt komplett überschrieben
   - persönliche familySettings werden gezielter zusammengeführt
   - keine optischen Änderungen
   ========================================================= */

// Stabilitätsmodus: alte Service Worker automatisch entfernen.
// LocalStorage und App-Daten werden dabei NICHT berührt.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .catch(err => console.warn("Service-Worker-Bereinigung beim Start:", err));
}

const days = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

let onlineRecipeCategoryFilter = "all";

let collectionSearchState = {
  todos:"",
  schoolTodos:"",
  exercises:"",
  onlineRecipes:"",
  workroomLinks:""
};

let schoolTodoArchiveLimit = 15;
let exerciseArchiveLimit = 15;
let exerciseArchiveGroupLimit = 6;
let onlineRecipeGroupLimit = 8;

function collectionSearchNormalize(value){
  return String(value || "")
    .toLocaleLowerCase("de-AT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .trim();
}

function collectionSearchMatches(query, values){
  const q = collectionSearchNormalize(query);
  if(!q) return true;
  return values.some(value => collectionSearchNormalize(value).includes(q));
}

function ensureCollectionSearchBar({
  anchor,
  id,
  placeholder="Suchen …",
  value="",
  visible=true,
  onInput
}){
  if(!anchor) return null;

  let bar=document.querySelector(`#${id}`);
  if(!bar){
    bar=document.createElement("div");
    bar.id=id;
    bar.className="collection-search-bar";
    bar.innerHTML=`
      <label class="collection-search-shell">
        <span class="collection-search-icon" aria-hidden="true"></span>
        <input type="search" autocomplete="off">
        <button type="button" class="collection-search-clear" aria-label="Suche löschen" title="Suche löschen">×</button>
      </label>
      <span class="collection-search-count" aria-live="polite"></span>
    `;
    anchor.insertAdjacentElement("beforebegin",bar);

    const input=bar.querySelector("input");
    const clear=bar.querySelector(".collection-search-clear");

    input.addEventListener("input",()=>{
      if(typeof bar._collectionOnInput==="function") bar._collectionOnInput(input.value);
      clear.classList.toggle("hidden",!input.value);
    });
    clear.addEventListener("click",()=>{
      input.value="";
      clear.classList.add("hidden");
      if(typeof bar._collectionOnInput==="function") bar._collectionOnInput("");
      input.focus();
    });
  }

  bar.classList.toggle("hidden",!visible);
  const input=bar.querySelector("input");
  if(input){
    input.placeholder=placeholder;
    if(document.activeElement!==input && input.value!==String(value||"")){
      input.value=String(value||"");
    }
  }
  bar.querySelector(".collection-search-clear")?.classList.toggle("hidden",!String(value||""));
  bar._collectionOnInput=onInput;
  return bar;
}

function updateCollectionSearchCount(bar, shown, total, noun="Einträge"){
  const count=bar?.querySelector(".collection-search-count");
  if(!count) return;
  const s=Number(shown||0);
  const t=Number(total||0);
  count.textContent = `${s} von ${t} ${noun}`;
}

function ensureCollectionMoreButton(anchor,id,remaining,onClick,label="Weitere anzeigen"){
  if(!anchor) return null;
  let btn=document.querySelector(`#${id}`);
  if(remaining<=0){
    btn?.remove();
    return null;
  }
  if(!btn){
    btn=document.createElement("button");
    btn.id=id;
    btn.type="button";
    btn.className="secondary-btn collection-more-btn";
    anchor.insertAdjacentElement("afterend",btn);
  }
  btn.textContent=`${label} (${remaining})`;
  btn.onclick=onClick;
  return btn;
}


const onlineRecipeCategoryMeta = [
  ["breakfast","🥣 Frühstück & Morgenideen"],
  ["spread","🥖 Aufstriche & Dips"],
  ["soup","🍲 Suppen & Eintöpfe"],
  ["main","🍝 Hauptgerichte"],
  ["small","🥙 Kleine Sachen & Jause"],
  ["salad","🥗 Salate & Frisches"],
  ["sweet","🍓 Süßes & Backen"],
  ["drink","🥤 Getränke & Smoothies"],
  ["other","✨ Sonstiges"]
];

/* =========================================================
   START-SICHERHEIT – beschädigtes LocalStorage darf die App
   nicht mehr am Laden hindern.

   Wenn ein JSON-Eintrag unlesbar ist:
   1. Die App startet mit einem sicheren Standardwert weiter.
   2. Der beschädigte Rohwert wird EINMAL als .corruptBackup
      gesichert, damit nichts still verloren geht.
   3. Der eigentliche Key wird hier NICHT gelöscht.
   ========================================================= */
function safeLocalJson(key, fallback) {
  let raw = null;

  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.warn(`LocalStorage konnte nicht gelesen werden: ${key}`, err);
    return typeof structuredClone === "function"
      ? structuredClone(fallback)
      : JSON.parse(JSON.stringify(fallback));
  }

  if (raw == null || raw === "") {
    return typeof structuredClone === "function"
      ? structuredClone(fallback)
      : JSON.parse(JSON.stringify(fallback));
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Beschädigter LocalStorage-Eintrag: ${key}. App startet mit Standardwert weiter.`, err);

    try {
      const backupKey = `${key}.corruptBackup`;
      if (localStorage.getItem(backupKey) == null) {
        localStorage.setItem(backupKey, raw);
      }
    } catch (backupErr) {
      console.warn(`Defekter Wert für ${key} konnte nicht zusätzlich gesichert werden.`, backupErr);
    }

    return typeof structuredClone === "function"
      ? structuredClone(fallback)
      : JSON.parse(JSON.stringify(fallback));
  }
}

const state = {
  videos: safeLocalJson("balanceProd.videos", []),
  todos: safeLocalJson("balanceProd.todos", []),
  archive: safeLocalJson("balanceProd.archive", []),
  shopping: safeLocalJson("balanceProd.shopping", []),
  shoppingPromos: safeLocalJson("balanceProd.shoppingPromos", []),
  recipes: safeLocalJson("balanceProd.recipes", []),
  meals: safeLocalJson("balanceProd.meals", {}),
  pinboard: safeLocalJson("balanceProd.pinboard", []),
  familyQuestions: safeLocalJson("balanceProd.familyQuestions", []),
  recipeLinkFeedback: safeLocalJson("balanceProd.recipeLinkFeedback", {}),
  timeTracking: safeLocalJson(
    "balanceProd.timeTracking",
    {entries:[], active:[], stopped:{}, deletedEntries:{}}
  ),
  trash: safeLocalJson("balanceProd.trash", []),
  todoTombstones: safeLocalJson("balanceProd.todoTombstones", {}),
  videoTombstones: safeLocalJson("balanceProd.videoTombstones", {}),
  archiveTombstones: safeLocalJson("balanceProd.archiveTombstones", {}),
  recipeTombstones: safeLocalJson("balanceProd.recipeTombstones", {}),
  pinboardTombstones: safeLocalJson("balanceProd.pinboardTombstones", {}),
  trashTombstones: safeLocalJson("balanceProd.trashTombstones", {}),

  workroom: safeLocalJson(
    "balanceProd.workroom",
    {
      todos:[],
      prints:[],
      links:[],
      substitutions:[],
      routines:{items:[],completions:{}},
      plans:{week:[],year:[]}
    }
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


["videoTombstones","archiveTombstones","recipeTombstones","pinboardTombstones","trashTombstones"].forEach(key => {
  state[key] = state[key] && typeof state[key] === "object" ? state[key] : {};
});

state.shoppingPromos = Array.isArray(state.shoppingPromos) ? state.shoppingPromos : [];
state.recipes = Array.isArray(state.recipes) ? state.recipes : [];
state.meals = state.meals && typeof state.meals === "object" ? state.meals : {};
state.pinboard = Array.isArray(state.pinboard) ? state.pinboard : [];
state.familyQuestions = Array.isArray(state.familyQuestions) ? state.familyQuestions : [];

/* V29 – Familienfragen robust lokal sichern.
   Der zweite Key verhindert, dass ein älterer Cloud-/App-Stand die Fragen
   beim Versionswechsel versehentlich auf [] zurücksetzt. */
try {
  const backupQuestions = JSON.parse(
    localStorage.getItem("balanceProd.familyQuestions.backup") || "[]"
  );
  if (Array.isArray(backupQuestions) && backupQuestions.length) {
    const byId = new Map();
    [...backupQuestions, ...state.familyQuestions].forEach(q => {
      if (!q || !q.id) return;
      const old = byId.get(q.id);
      const oldTs = Number(old?.updatedAt || old?.createdAt || 0);
      const newTs = Number(q.updatedAt || q.createdAt || 0);
      if (!old || newTs >= oldTs) byId.set(q.id, q);
    });
    state.familyQuestions = [...byId.values()];
  }
} catch (err) {
  console.warn("Familienfragen-Backup konnte nicht gelesen werden:", err);
}

function persistFamilyQuestionsNow(){
  try {
    const json = JSON.stringify(state.familyQuestions || []);
    localStorage.setItem("balanceProd.familyQuestions", json);
    localStorage.setItem("balanceProd.familyQuestions.backup", json);
  } catch (err) {
    console.warn("Familienfragen konnten lokal nicht gespeichert werden:", err);
  }
}
state.recipeLinkFeedback = state.recipeLinkFeedback && typeof state.recipeLinkFeedback === "object"
  ? state.recipeLinkFeedback : {};

let shoppingItems = state.shopping;
let cloudReady = false;
let cloudApplying = false;
let cloudSaveTimer = null;
let cloudUnsubscribe = null;

/* CODE-AUDIT: frühere, überschriebene Definition von saveLocal entfernt. */
/* CODE-AUDIT: frühere, überschriebene Definition von cloudPayload entfernt. */
// ===== EINKAUF – eigener Firestore-Bereich =====

function shoppingCollection() {
  return firebase.firestore()
    .collection("families")
    .doc("shared")
    .collection("shoppingItems");
}



const DEVICE_ID_KEY = "balanceProd.deviceId";
const DEVICE_NAME_KEY = "balanceProd.deviceName";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function inferDeviceName() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|SM-T|SM-X/i.test(ua)) return "Tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "Tablet";
  if (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1) return "Tablet";
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return "Handy";
  return "PC";
}

function getDeviceName() {
  const inferred = inferDeviceName();
  const saved = localStorage.getItem(DEVICE_NAME_KEY);

  // Automatisch gesetzte Standardnamen dürfen sich korrigieren
  // (z. B. Tablet war zuvor fälschlich als PC erkannt).
  if (!saved || ["PC","Tablet","Handy"].includes(saved)) {
    localStorage.setItem(DEVICE_NAME_KEY, inferred);
    return inferred;
  }

  return saved;
}

function firestoreMillisValue(value) {
  return value?.toMillis?.() ||
    Number(value?.seconds || 0) * 1000 ||
    Number(value || 0) ||
    0;
}

function currentCloudVersion(data) {
  return firestoreMillisValue(data?.updatedAt);
}

let lastAcknowledgedSyncToken = "";

async function acknowledgeCloudSnapshot(data, snapshotMeta = null) {
  if (!firebase.auth().currentUser) return;
  if (snapshotMeta?.hasPendingWrites) return;

  const token = String(data?.syncToken || "");
  if (!token || token === lastAcknowledgedSyncToken) return;

  // Vor dem Schreiben setzen: der eigene ACK-Schreibvorgang erzeugt selbst
  // wieder einen Firestore-Snapshot und darf keine Endlosschleife starten.
  lastAcknowledgedSyncToken = token;

  try {
    const ref = firebase.firestore().collection("families").doc("shared");
    await ref.set({
      deviceAcks: {
        [getDeviceId()]: {
          name: getDeviceName(),
          seenAt: firebase.firestore.FieldValue.serverTimestamp(),
          token
        }
      }
    }, { merge: true });
  } catch (err) {
    lastAcknowledgedSyncToken = "";
    console.warn("Gerätebestätigung konnte nicht gespeichert werden:", err);
  }
}

function renderDeviceAcks(data) {
  const el = ensureSyncStatusUI();
  if (!el) return;
  const ackWrap = el.querySelector(".sync-device-acks");
  if (!ackWrap) return;

  const token = String(data?.syncToken || "");
  const ackMap = data?.deviceAcks && typeof data.deviceAcks === "object"
    ? data.deviceAcks
    : {};

  const now = Date.now();
  const selfId = getDeviceId();
  const selfName = getDeviceName();

  const activeOthers = Object.entries(ackMap)
    .map(([id, x]) => ({
      id,
      name: x?.name || "Gerät",
      seen: firestoreMillisValue(x?.seenAt),
      token: String(x?.token || "")
    }))
    .filter(x => x.id !== selfId && x.seen && now - x.seen < 15 * 60 * 1000);

  if (!activeOthers.length) {
    ackWrap.textContent = "";
    return;
  }

  const labels = activeOthers
    .sort((x,y) => y.seen - x.seen)
    .map(x => {
      const label = x.name === selfName ? "anderes Gerät" : x.name;
      return `${label} ${token && x.token === token ? "✓" : "…"}`;
    });

  ackWrap.textContent = labels.length ? " · " + labels.join(" · ") : "";
}

function ensureSyncStatusUI() {
  let el = document.querySelector("#syncStatus");
  if (el) return el;

  el = document.createElement("div");
  el.id = "syncStatus";
  el.className = "sync-status";
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<span class="sync-main"></span><span class="sync-device-acks"></span>`;

  const preferredHost =
    document.querySelector(".top-actions") ||
    document.querySelector(".week-actions") ||
    document.querySelector("nav") ||
    document.querySelector("header") ||
    document.body;

  preferredHost.appendChild(el);

  if (!document.querySelector("#syncStatusStyle")) {
    const style = document.createElement("style");
    style.id = "syncStatusStyle";
    style.textContent = `
      .sync-status{
        display:inline-flex;
        align-items:center;
        gap:5px;
        margin-left:8px;
        padding:4px 8px;
        border-radius:999px;
        font-size:11px;
        line-height:1;
        white-space:nowrap;
        color:#817a73;
        background:rgba(255,255,255,.48);
        border:1px solid rgba(120,110,100,.12);
        opacity:.86;
        vertical-align:middle;
      }
      .sync-status[data-state="synced"]{color:#718071}
      .sync-status[data-state="syncing"],
      .sync-status[data-state="waiting"]{color:#8a806f}
      .sync-status[data-state="offline"],
      .sync-status[data-state="error"]{color:#9a6e67}
      .sync-device-acks{
        font-weight:500;
        opacity:.78;
      }
      @media (max-width:700px){
        .sync-status{
          font-size:10px;
          padding:4px 7px;
          margin-left:4px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  return el;
}

function updateSyncStatus(stateName) {
  const el = ensureSyncStatusUI();
  if (!el) return;
  const states = {
    synced:  ["✓", "Cloud gespeichert"],
    syncing: ["↻", "wird synchronisiert"],
    waiting: ["…", "wartet auf Sync"],
    offline: ["○", "offline"],
    error:   ["!", "Sync-Fehler"]
  };
  const [icon, text] = states[stateName] || states.waiting;
  el.dataset.state = stateName;
  const main = el.querySelector(".sync-main");
  if (main) main.textContent = `${icon} ${text}`;
  else el.textContent = `${icon} ${text}`;
  el.title =
    stateName === "synced" ? "Diese Änderung wurde in der Cloud gespeichert. Gerätebestätigungen stehen rechts daneben." :
    stateName === "syncing" ? "Änderungen werden gerade gespeichert." :
    stateName === "offline" ? "Keine Internetverbindung. Änderungen bleiben lokal erhalten und werden später synchronisiert." :
    stateName === "error" ? "Die letzte Cloud-Synchronisierung ist fehlgeschlagen." :
    "Cloud-Synchronisierung ist noch nicht bereit.";
}

window.addEventListener("online", () => {
  updateSyncStatus("syncing");
  scheduleCloudSave();
});
window.addEventListener("offline", () => updateSyncStatus("offline"));

document.addEventListener("DOMContentLoaded", () => {
  updateSyncStatus(navigator.onLine ? "waiting" : "offline");
});

function scheduleCloudSave() {
  if (!cloudReady || cloudApplying || !firebase.auth().currentUser) {
    updateSyncStatus(navigator.onLine ? "waiting" : "offline");
    return;
  }
  updateSyncStatus("syncing");
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      const payload = cloudPayload();
      const syncToken = `${Date.now()}-${getDeviceId()}-${Math.random().toString(36).slice(2,8)}`;
      payload.syncToken = syncToken;
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await firebase.firestore().collection("families").doc("shared").set(payload, { merge: true });
      updateSyncStatus("synced");
    } catch (err) {
      console.error("Firestore save failed:", err);
      updateSyncStatus(navigator.onLine ? "error" : "offline");
    }
  }, 300);
}


// ===== Robuster To-do-Geräte-Sync =====
let todoSyncFingerprints = new Map();

function todoSyncFingerprint(item) {
  if (!item || typeof item !== "object") return "";
  const copy = {...item};
  delete copy.updatedAt;
  delete copy.syncRev;
  return JSON.stringify(copy);
}

function refreshTodoSyncFingerprints() {
  todoSyncFingerprints = new Map(
    (state.todos || [])
      .filter(item => item?.id)
      .map(item => [item.id, todoSyncFingerprint(item)])
  );
}

function touchChangedTodosBeforeSave() {
  const now = Date.now();

  (state.todos || []).forEach(item => {
    if (!item?.id) return;
    const fingerprint = todoSyncFingerprint(item);
    const previous = todoSyncFingerprints.get(item.id);

    if (previous === undefined || previous !== fingerprint) {
      item.syncRev = Math.max(0, Number(item.syncRev || 0)) + 1;
      item.updatedAt = now;
    }
  });

  refreshTodoSyncFingerprints();
}

function mergeTodosByRevision(localValue, cloudValue) {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(cloudValue) ? cloudValue : [];
  const map = new Map();

  local.forEach(item => {
    if (item?.id) map.set(item.id, item);
  });

  remote.forEach(remoteItem => {
    if (!remoteItem?.id) return;
    const localItem = map.get(remoteItem.id);

    if (!localItem) {
      map.set(remoteItem.id, remoteItem);
      return;
    }

    const localRev = Number(localItem.syncRev || 0);
    const remoteRev = Number(remoteItem.syncRev || 0);

    if (remoteRev > localRev) {
      map.set(remoteItem.id, remoteItem);
      return;
    }
    if (localRev > remoteRev) return;

    const localTs = itemTimestamp(localItem);
    const remoteTs = itemTimestamp(remoteItem);
    if (remoteTs > localTs) map.set(remoteItem.id, remoteItem);
  });

  return [...map.values()];
}

refreshTodoSyncFingerprints();

function save() {
  touchChangedTodosBeforeSave();
  saveLocal();
  scheduleCloudSave();
}




// =========================================================
// PINNWAND – flüchtige Familiennachrichten
// =========================================================
const PINBOARD_DEVICE_KEY = "balanceProd.pinboardDeviceEnabled";

function pinboardDeviceEnabled() {
  return localStorage.getItem(PINBOARD_DEVICE_KEY) === "1";
}

function setPinboardDeviceEnabled(value) {
  localStorage.setItem(PINBOARD_DEVICE_KEY, value ? "1" : "0");
}

function updatePinboardDeviceStatus() {
  const btn = document.querySelector("#enablePinboardNotifications");
  const status = document.querySelector("#pinboardDeviceStatus");
  if (!btn || !status) return;

  const enabled = pinboardDeviceEnabled();
  const notificationSupported = "Notification" in window;
  const permission = notificationSupported ? Notification.permission : "unsupported";

  if (enabled && (permission === "granted" || permission === "unsupported")) {
    btn.textContent = "Benachrichtigungen aktiv";
    status.textContent = permission === "unsupported"
      ? "🔊 Ton auf diesem Gerät aktiviert"
      : "🔔 Ton & Benachrichtigung aktiviert";
    status.dataset.state = "granted";
    return;
  }

  if (permission === "denied") {
    btn.textContent = "Ton aktivieren";
    status.textContent = "🔊 Ton möglich · System-Benachrichtigungen blockiert";
    status.dataset.state = "denied";
    return;
  }

  btn.textContent = "Benachrichtigungen aktivieren";
  status.textContent = "Noch nicht aktiviert";
  status.dataset.state = "default";
}

async function enablePinboardOnThisDevice() {
  try {
    // Der Klick selbst entsperrt Audio auf iPhone/iPad/Android.
    pinboardAudioContext =
      pinboardAudioContext ||
      new (window.AudioContext || window.webkitAudioContext)();

    if (pinboardAudioContext.state === "suspended") {
      await pinboardAudioContext.resume();
    }

    // Mini-stummer Impuls hält das AudioContext-Unlock auf mobilen Browsern stabiler.
    const osc = pinboardAudioContext.createOscillator();
    const gain = pinboardAudioContext.createGain();
    gain.gain.value = 0.00001;
    osc.connect(gain);
    gain.connect(pinboardAudioContext.destination);
    osc.start();
    osc.stop(pinboardAudioContext.currentTime + 0.03);

    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Pinnwand Notification-Permission:", err);
      }
    }

    setPinboardDeviceEnabled(true);
    updatePinboardDeviceStatus();

    // Sofort hörbarer Bestätigungston: wenn der kommt, ist das Gerät entsperrt.
    await playPinboardSound(document.querySelector("#pinboardSound")?.value || "letter");
    return true;
  } catch (err) {
    console.warn("Pinnwand konnte auf diesem Gerät nicht aktiviert werden:", err);
    setPinboardDeviceEnabled(false);
    updatePinboardDeviceStatus();
    return false;
  }
}

const PINBOARD_VOLUME_KEY = "balanceProd.pinboardVolume";

function getPinboardVolumeSetting() {
  return localStorage.getItem(PINBOARD_VOLUME_KEY) || "loud";
}

function setPinboardVolumeSetting(value) {
  localStorage.setItem(PINBOARD_VOLUME_KEY, value || "loud");
}

function pinboardVolumeGain() {
  return {
    soft: 0.22,
    normal: 0.48,
    loud: 0.88,
    max: 1.65
  }[getPinboardVolumeSetting()] || 0.88;
}

const pinboardSeenIds = new Set();
let pinboardCloudInitialized = false;
let pinboardAudioContext = null;

/* V143 – Pinnwand-Ton auf mobilen Browsern zuverlässiger aktiv halten.
   Wenn Benachrichtigungen auf diesem Gerät aktiviert sind, wird der
   AudioContext bei normalen Benutzeraktionen erneut aufgenommen.
   So ist kein wiederholter Klick auf "Benachrichtigungen aktiv" nötig. */
async function keepPinboardAudioReady(){
  if(!pinboardDeviceEnabled()) return false;
  try{
    pinboardAudioContext =
      pinboardAudioContext ||
      new (window.AudioContext || window.webkitAudioContext)();

    if(pinboardAudioContext.state === "suspended"){
      await pinboardAudioContext.resume();
    }

    return pinboardAudioContext.state === "running";
  }catch(err){
    console.warn("Pinnwand-Audio konnte nicht erneut aktiviert werden:", err);
    return false;
  }
}

["pointerdown","touchstart","keydown"].forEach(type=>{
  document.addEventListener(type,()=>{
    keepPinboardAudioReady();
  },{passive:true});
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState === "visible"){
    keepPinboardAudioReady();
  }
});

window.addEventListener("focus",()=>{
  keepPinboardAudioReady();
});

function pinboardRecipientName(key) {
  if (key === "all") return "Alle";
  return familyName(key) || "Familie";
}

function pinboardSoundLabel(sound) {
  return {
    letter: "💌 Briefchen",
    sparkle: "✨ Funkeln",
    bubble: "🫧 Blubb"
  }[sound] || "💌 Briefchen";
}

async function playPinboardSound(sound = "letter") {
  try {
    pinboardAudioContext =
      pinboardAudioContext ||
      new (window.AudioContext || window.webkitAudioContext)();

    if (pinboardAudioContext.state === "suspended") {
      await keepPinboardAudioReady();
    }

    const ctx = pinboardAudioContext;
    if (!ctx || ctx.state !== "running") return false;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(12, now);
    compressor.ratio.setValueAtTime(6, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.18, now);
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const volumeGain = pinboardVolumeGain();
    const isSuperLoud = getPinboardVolumeSetting() === "max";
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(volumeGain, now + 0.01);

    function note(freq, start, duration, type = "sine", gainValue = 0.7, endFreq = null) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + start + duration);
      }
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.03);
    }

    function pattern(offset = 0) {
      if (sound === "sparkle") {
        note(1180, offset + 0.00, 0.18, "triangle", 0.98);
        note(1540, offset + 0.10, 0.22, "triangle", 0.92);
        note(1980, offset + 0.22, 0.30, "sine", 0.88);
      } else if (sound === "bubble") {
        note(330, offset + 0.00, 0.20, "triangle", 1.0, 180);
        note(520, offset + 0.15, 0.18, "triangle", 0.86, 260);
        note(760, offset + 0.27, 0.13, "sine", 0.62, 430);
      } else {
        note(820, offset + 0.00, 0.18, "square", 0.78);
        note(1180, offset + 0.16, 0.26, "triangle", 1.0);
        note(1640, offset + 0.28, 0.20, "sine", 0.62);
      }
    }

    pattern(0);

    // Super laut wiederholt den kurzen Hinweis einmal.
    // Das ist auf kleinen Handy-/Tablet-Lautsprechern deutlich besser wahrnehmbar
    // als nur den Pegel immer weiter zu übersteuern.
    if (isSuperLoud) {
      pattern(0.52);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.10);
    } else {
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    }

    return true;
  } catch (err) {
    console.warn("Pinnwand-Ton konnte nicht abgespielt werden:", err);
    return false;
  }
}

function renderPinboard() {
  const list = document.querySelector("#pinboardList");
  const badge = document.querySelector("#pinboardBadge");
  const countText = document.querySelector("#pinboardCountText");
  if (!list) return;

  state.pinboard = Array.isArray(state.pinboard) ? state.pinboard : [];
  const messages = state.pinboard
    .slice()
    .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  if (badge) {
    badge.textContent = String(messages.length);
    badge.classList.toggle("hidden", messages.length === 0);
  }

  if (countText) {
    countText.textContent =
      messages.length === 0 ? "Keine Nachrichten" :
      messages.length === 1 ? "1 Nachricht" :
      `${messages.length} Nachrichten`;
  }

  if (!messages.length) {
    list.innerHTML = `<div class="pinboard-empty">Die Pinnwand ist gerade leer.</div>`;
    return;
  }

  list.innerHTML = messages.map(message => `
    <article class="pinboard-note" data-id="${message.id}">
      <div class="pinboard-note-top">
        <span class="pinboard-note-recipient">💌 ${escapeHtml(pinboardRecipientName(message.recipient))}</span>
        <span class="pinboard-note-sound">${escapeHtml(pinboardSoundLabel(message.sound))}</span>
        <button type="button" class="pinboard-note-x" data-id="${message.id}" title="Nachricht löschen">×</button>
      </div>
      <div class="pinboard-note-text">${escapeHtml(message.text || "")}</div>
      <button type="button" class="pinboard-read-delete" data-id="${message.id}">
        ✓ Gelesen & löschen
      </button>
    </article>
  `).join("");

  list.querySelectorAll(".pinboard-read-delete, .pinboard-note-x").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      markListItemDeleted("pinboardTombstones", id);
      state.pinboard = state.pinboard.filter(message => message.id !== id);
      save();
      persistTopLevelDeletionImmediately("pinboard");
      renderPinboard();
    });
  });
}

function handleIncomingPinboard(cloudMessages) {
  const incoming = Array.isArray(cloudMessages) ? cloudMessages : [];

  if (!pinboardCloudInitialized) {
    incoming.forEach(message => message?.id && pinboardSeenIds.add(message.id));
    pinboardCloudInitialized = true;
    return;
  }

  const fresh = incoming.filter(message =>
    message?.id && !pinboardSeenIds.has(message.id)
  );

  incoming.forEach(message => message?.id && pinboardSeenIds.add(message.id));

  if (fresh.length) {
    const newest = fresh
      .slice()
      .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

    if (pinboardDeviceEnabled()) {
      const messageText = String(newest?.text || "").trim();
      const shortText = messageText.length > 110
        ? `${messageText.slice(0, 107)}…`
        : messageText;

      setTimeout(() => {
        playPinboardSound(newest?.sound || "letter");
      }, 80);

      // Sichtbarer Hinweis innerhalb der App: Quelle und Inhalt sind sofort klar.
      showMotivation(
        shortText
          ? `💌 Pinnwand-Nachricht: ${shortText}`
          : "💌 Neue Nachricht auf der Pinnwand"
      );

      // Solange die Seite geöffnet ist, zusätzlich eine normale Systemmeldung.
      // Echte Push-Nachrichten bei geschlossener App kommen später mit dem Service Worker.
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("💌 Pinnwand-Nachricht", {
            body: shortText || "Neue Nachricht auf der Pinnwand",
            tag: `pinboard-${newest?.id || Date.now()}`
          });
        } catch (err) {
          console.warn("Pinnwand-Systembenachrichtigung:", err);
        }
      }
    }
  }
}

function openPinboard() {
  renderPinboard();
  const volume = document.querySelector("#pinboardVolume");
  if (volume) volume.value = getPinboardVolumeSetting();
  updatePinboardDeviceStatus();
  document.querySelector("#pinboardDialog")?.showModal();
}

document.querySelector("#enablePinboardNotifications")?.addEventListener("click", async () => {
  await enablePinboardOnThisDevice();
});

document.querySelector("#pinboardVolume")?.addEventListener("change", e => {
  setPinboardVolumeSetting(e.currentTarget.value || "loud");
});

document.querySelector("#testPinboardSoundBtn")?.addEventListener("click", async () => {
  if (!pinboardDeviceEnabled()) {
    await enablePinboardOnThisDevice();
    return;
  }
  const sound = document.querySelector("#pinboardSound")?.value || "letter";
  await playPinboardSound(sound);
});

document.querySelector("#openPinboardBtn")?.addEventListener("click", openPinboard);
document.querySelector("#closePinboardBtn")?.addEventListener("click", () => {
  document.querySelector("#pinboardDialog")?.close();
});

document.querySelector("#pinboardDialog")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

document.querySelector("#sendPinboardBtn")?.addEventListener("click", async () => {
  const volumeValue = document.querySelector("#pinboardVolume")?.value || getPinboardVolumeSetting();
  setPinboardVolumeSetting(volumeValue);

  const recipient = document.querySelector("#pinboardRecipient")?.value || "all";
  const textInput = document.querySelector("#pinboardMessage");
  const sound = document.querySelector("#pinboardSound")?.value || "letter";
  const text = textInput?.value.trim() || "";

  if (!text) {
    textInput?.focus();
    return;
  }

  const message = {
    id: uid(),
    recipient,
    text,
    sound,
    createdAt: Date.now()
  };

  state.pinboard.push(message);

  // Der Sender bekommt nicht gleich seinen eigenen Cloud-Echo-Ton.
  pinboardSeenIds.add(message.id);

  save();
  renderPinboard();

  if (textInput) textInput.value = "";
  showMotivation("💌 Nachricht an die Pinnwand geheftet.");
});

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

// ===== To-do-Löschstatus: robuste Synchronisation über mehrere Geräte =====
function normalizeTodoTombstone(rec) {
  if (!rec || typeof rec !== "object") return {deletedAt:0, restoredAt:0};
  return {
    deletedAt: Number(rec.deletedAt || 0),
    restoredAt: Number(rec.restoredAt || 0)
  };
}

function tombstoneVersion(rec) {
  const r = normalizeTodoTombstone(rec);
  return Math.max(r.deletedAt, r.restoredAt);
}

function mergeTodoTombstones(localMap, cloudMap) {
  const local = localMap && typeof localMap === "object" ? localMap : {};
  const remote = cloudMap && typeof cloudMap === "object" ? cloudMap : {};
  const merged = {};
  new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(id => {
    const a = normalizeTodoTombstone(local[id]);
    const b = normalizeTodoTombstone(remote[id]);
    merged[id] = tombstoneVersion(b) > tombstoneVersion(a) ? b : a;
  });
  return merged;
}

function markTodoDeleted(id) {
  if (!id) return;
  state.todoTombstones = state.todoTombstones && typeof state.todoTombstones === "object"
    ? state.todoTombstones : {};
  const prev = normalizeTodoTombstone(state.todoTombstones[id]);
  state.todoTombstones[id] = {...prev, deletedAt:Date.now()};
}

async function persistTodoDeletionImmediately(id) {
  if (!id || !cloudReady || cloudApplying || !window.firebase?.firestore) return;

  try {
    const rec = normalizeTodoTombstone(state.todoTombstones?.[id]);
    const payload = {
      todos: (state.todos || []).filter(item => item?.id !== id),
      todoTombstones: {
        [id]: rec
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await firebase.firestore()
      .collection("families")
      .doc("shared")
      .set(payload, { merge: true });
  } catch (err) {
    console.error("To-do-Löschung konnte nicht sofort in der Cloud bestätigt werden:", err);
    // Der normale save()-Weg versucht es zusätzlich erneut.
  }
}

function markTodoRestored(id) {
  if (!id) return;
  state.todoTombstones = state.todoTombstones && typeof state.todoTombstones === "object"
    ? state.todoTombstones : {};
  const prev = normalizeTodoTombstone(state.todoTombstones[id]);
  state.todoTombstones[id] = {...prev, restoredAt:Date.now()};
}

function isTodoTombstoned(id) {
  const rec = normalizeTodoTombstone(state.todoTombstones?.[id]);
  return rec.deletedAt > rec.restoredAt;
}


function mergeSimpleTombstones(localValue, remoteValue) {
  const local = localValue && typeof localValue === "object" ? localValue : {};
  const remote = remoteValue && typeof remoteValue === "object" ? remoteValue : {};
  const merged = {...local};
  Object.entries(remote).forEach(([id, ts]) => {
    if (Number(ts || 0) > Number(merged[id] || 0)) merged[id] = Number(ts || 0);
  });
  return merged;
}

function persistentItemTimestamp(item) {
  if (!item || typeof item !== "object") return 0;
  const lastDone = item.lastDone ? Date.parse(item.lastDone) : 0;
  return Number(item.updatedAt || item.completedAt || item.createdAt || item.deletedAt || lastDone || 0) || 0;
}

function mergePersistentListWithTombstones(localValue, remoteValue, tombstones, idKey = "id") {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const byId = new Map();

  local.forEach(item => {
    const id = item?.[idKey];
    if (id) byId.set(id, item);
  });

  remote.forEach(remoteItem => {
    const id = remoteItem?.[idKey];
    if (!id) return;
    const localItem = byId.get(id);
    if (!localItem || persistentItemTimestamp(remoteItem) >= persistentItemTimestamp(localItem)) {
      byId.set(id, remoteItem);
    }
  });

  return [...byId.values()].filter(item => {
    const id = item?.[idKey];
    if (!id) return true;
    const deletedAt = Number(tombstones?.[id] || 0);
    return !deletedAt || persistentItemTimestamp(item) > deletedAt;
  });
}

function markListItemDeleted(tombstoneKey, id) {
  if (!id) return;
  state[tombstoneKey] = state[tombstoneKey] && typeof state[tombstoneKey] === "object" ? state[tombstoneKey] : {};
  state[tombstoneKey][id] = Date.now();
}

async function persistTopLevelDeletionImmediately(kind) {
  if (!cloudReady || cloudApplying || !window.firebase?.firestore) return;
  const cfg = {
    videos: {listKey:"videos", tombstoneKey:"videoTombstones"},
    archive: {listKey:"archive", tombstoneKey:"archiveTombstones"},
    recipes: {listKey:"recipes", tombstoneKey:"recipeTombstones"},
    pinboard: {listKey:"pinboard", tombstoneKey:"pinboardTombstones"},
    trash: {listKey:"trash", tombstoneKey:"trashTombstones"}
  }[kind];
  if (!cfg) return;

  try {
    const syncToken = `${Date.now()}-${getDeviceId()}-${Math.random().toString(36).slice(2,8)}`;
    await firebase.firestore().collection("families").doc("shared").update({
      [cfg.listKey]: state[cfg.listKey] || [],
      [cfg.tombstoneKey]: state[cfg.tombstoneKey] || {},
      syncToken,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(`${kind}-Löschung konnte nicht sofort synchronisiert werden:`, err);
  }
}

function ensureQuickLinkTombstones() {
  state.familySettings = state.familySettings || {};
  state.familySettings.quickLinkTombstones =
    state.familySettings.quickLinkTombstones && typeof state.familySettings.quickLinkTombstones === "object"
      ? state.familySettings.quickLinkTombstones
      : {};
  return state.familySettings.quickLinkTombstones;
}

async function persistQuickLinksDeletionImmediately() {
  if (!cloudReady || cloudApplying || !window.firebase?.firestore) return;
  try {
    const syncToken = `${Date.now()}-${getDeviceId()}-${Math.random().toString(36).slice(2,8)}`;
    await firebase.firestore().collection("families").doc("shared").update({
      "familySettings.quickLinks": state.familySettings.quickLinks || [],
      "familySettings.quickLinkTombstones": ensureQuickLinkTombstones(),
      syncToken,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Schnellzugriff-Löschung konnte nicht sofort synchronisiert werden:", err);
  }
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}


const defaultFamilySettings = {
  a:{name:"Mama", color:"#c8897e"},
  b:{name:"Papa", color:"#ad7468"},
  c:{name:"Lou", color:"#8f78b8", icon:"⭐", taskIcon:"🌙"},
  d:{name:"Fina", color:"#d58c9b", icon:"🌙", taskIcon:"⭐"}
};


function familySettingTimestamp(entry) {
  return Number(entry?.updatedAt || 0);
}

function mergeFamilyMemberSetting(localEntry, cloudEntry, fallback = {}) {
  const local = localEntry && typeof localEntry === "object" ? localEntry : {};
  const cloud = cloudEntry && typeof cloudEntry === "object" ? cloudEntry : {};

  const localTs = familySettingTimestamp(local);
  const cloudTs = familySettingTimestamp(cloud);

  if (localTs > cloudTs) return {...fallback, ...cloud, ...local};
  if (cloudTs > localTs) return {...fallback, ...local, ...cloud};

  /* Alte Daten ohne Zeitstempel: lokal hat Vorrang, damit eine gerade
     gewählte Farbe beim nächsten Cloud-Snapshot nicht zurückspringt. */
  return {...fallback, ...cloud, ...local};
}

function persistFamilySettingsImmediately() {
  try {
    localStorage.setItem(
      "balanceProd.familySettings",
      JSON.stringify(state.familySettings || {})
    );
  } catch (err) {
    console.warn("Individuelle Einstellungen konnten lokal nicht sofort gespeichert werden:", err);
  }
}


state.familySettings = (() => {
  try {
    return JSON.parse(localStorage.getItem("balanceProd.familySettings")) || structuredClone(defaultFamilySettings);
  } catch {
    return structuredClone(defaultFamilySettings);
  }
})();

const DEFAULT_GENERAL_COLOR = "#9b9871";

function normalizeFamilyColorEntry(value, fallback) {
  if (typeof value === "string") {
    return {
      color: /^#[0-9a-f]{6}$/i.test(value) ? value : fallback,
      updatedAt: 0
    };
  }

  const raw = value && typeof value === "object" ? value : {};
  return {
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color || ""))
      ? String(raw.color)
      : fallback,
    updatedAt: Number(raw.updatedAt || 0)
  };
}

function normalizeFamilyColors(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    a: normalizeFamilyColorEntry(raw.a, state.familySettings?.a?.color || defaultFamilySettings.a.color),
    b: normalizeFamilyColorEntry(raw.b, state.familySettings?.b?.color || defaultFamilySettings.b.color),
    c: normalizeFamilyColorEntry(raw.c, state.familySettings?.c?.color || defaultFamilySettings.c.color),
    d: normalizeFamilyColorEntry(raw.d, state.familySettings?.d?.color || defaultFamilySettings.d.color),
    general: normalizeFamilyColorEntry(raw.general, DEFAULT_GENERAL_COLOR)
  };
}

function loadFamilyColorsLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem("balanceProd.familyColors") || "null");
    return normalizeFamilyColors(raw);
  } catch {
    return normalizeFamilyColors(null);
  }
}

state.familyColors = loadFamilyColorsLocal();

function persistFamilyColorsImmediately() {
  try {
    localStorage.setItem(
      "balanceProd.familyColors",
      JSON.stringify(state.familyColors || {})
    );
  } catch (err) {
    console.warn("Farbauswahl konnte lokal nicht sofort gespeichert werden:", err);
  }
}

function mergeFamilyColorEntry(localEntry, cloudEntry, fallback) {
  const local = normalizeFamilyColorEntry(localEntry, fallback);
  const cloud = normalizeFamilyColorEntry(cloudEntry, fallback);

  if (local.updatedAt > cloud.updatedAt) return local;
  if (cloud.updatedAt > local.updatedAt) return cloud;

  /* Bei alten/gleich alten Daten gewinnt lokal. */
  return local;
}

function mergeFamilyColors(localValue, cloudValue) {
  const local = normalizeFamilyColors(localValue);
  const cloud = normalizeFamilyColors(cloudValue);

  return {
    a: mergeFamilyColorEntry(local.a, cloud.a, defaultFamilySettings.a.color),
    b: mergeFamilyColorEntry(local.b, cloud.b, defaultFamilySettings.b.color),
    c: mergeFamilyColorEntry(local.c, cloud.c, defaultFamilySettings.c.color),
    d: mergeFamilyColorEntry(local.d, cloud.d, defaultFamilySettings.d.color),
    general: mergeFamilyColorEntry(local.general, cloud.general, DEFAULT_GENERAL_COLOR)
  };
}

function syncLegacyFamilyColorsFromDedicatedStore() {
  ["a","b","c","d"].forEach(key => {
    state.familySettings[key] = state.familySettings[key] || {...defaultFamilySettings[key]};
    state.familySettings[key].color = state.familyColors?.[key]?.color || defaultFamilySettings[key].color;
  });
}

syncLegacyFamilyColorsFromDedicatedStore();


["a","b","c","d"].forEach(key => {
  state.familySettings[key] = state.familySettings[key] || {...defaultFamilySettings[key]};
  state.familySettings[key].name = state.familySettings[key].name || defaultFamilySettings[key].name;
  state.familySettings[key].color = state.familySettings[key].color || defaultFamilySettings[key].color;
  state.familySettings[key].icon = state.familySettings[key].icon || defaultFamilySettings[key].icon || "⭐";
  state.familySettings[key].taskIcon = state.familySettings[key].taskIcon || defaultFamilySettings[key].taskIcon || state.familySettings[key].icon || "⭐";
});

const defaultQuickLinks=[
{id:"ql-webuntis",label:"WebUntis",url:"https://gymkatzelsdorf.webuntis.com/today"},
{id:"ql-eduflow",label:"EduFlow",url:"https://www.eduflow.at/EduFlow/"},
{id:"ql-schoolfox1",label:"SchoolFox 1",url:"https://my.schoolfox.app/#/home"},
{id:"ql-schoolfox2",label:"SchoolFox 2",url:"https://my.schoolfox.app/#/home"},
{id:"ql-teams",label:"Teams",url:"https://teams.microsoft.com"}];
if(!Array.isArray(state.familySettings.quickLinks)) state.familySettings.quickLinks=defaultQuickLinks.map(x=>({...x}));
ensureQuickLinkTombstones();
let editingQuickLinkId=null;
function normalizeExternalUrl(v){const s=String(v||"").trim();return !s?"":(/^https?:\/\//i.test(s)?s:`https://${s}`);}
function resetQuickLinkEditor(){
 editingQuickLinkId=null;
 const a=document.querySelector("#quickLinkLabel"),b=document.querySelector("#quickLinkUrl");
 if(a)a.value="";if(b)b.value="";
 const c=document.querySelector("#saveQuickLinkBtn");if(c)c.textContent="+ Link";
 document.querySelector("#cancelQuickLinkEditBtn")?.classList.add("hidden");
}
function renderQuickLinks(){
 const defaultQuickLinks = [
   {id:"default-webuntis",label:"WebUntis",url:"https://webuntis.com/"},
   {id:"default-eduflow",label:"EduFlow",url:"https://eduflow.com/"},
   {id:"default-schoolfox1",label:"SchoolFox 1",url:"https://schoolfox.app/"},
   {id:"default-schoolfox2",label:"SchoolFox 2",url:"https://schoolfox.app/"},
   {id:"default-teams",label:"Teams",url:"https://teams.microsoft.com/"}
 ];
 if (!Array.isArray(state.familySettings.quickLinks) || state.familySettings.quickLinks.length === 0) {
   state.familySettings.quickLinks = defaultQuickLinks.map(x => ({...x}));
   save();
 }
 const links=state.familySettings.quickLinks;
 const row=document.querySelector("#quickLinksRow");
 if(row)row.innerHTML=links.map(x=>`<a href="${escapeHtml(normalizeExternalUrl(x.url))}" target="_blank" rel="noopener" class="quick-link">${escapeHtml(x.label||"Link")}</a>`).join("");
 const list=document.querySelector("#quickLinksManageList");
 if(list)list.innerHTML=links.map(x=>`<div class="quick-link-manage-row"><span><strong>${escapeHtml(x.label||"Link")}</strong><small>${escapeHtml(x.url||"")}</small></span><button type="button" class="quick-link-edit" data-id="${x.id}">✎</button><button type="button" class="quick-link-remove" data-id="${x.id}">×</button></div>`).join("");
 document.querySelectorAll(".quick-link-edit").forEach(btn=>btn.onclick=()=>{const x=links.find(v=>v.id===btn.dataset.id);if(!x)return;editingQuickLinkId=x.id;document.querySelector("#quickLinkLabel").value=x.label||"";document.querySelector("#quickLinkUrl").value=x.url||"";document.querySelector("#saveQuickLinkBtn").textContent="Speichern";document.querySelector("#cancelQuickLinkEditBtn")?.classList.remove("hidden");});
 document.querySelectorAll(".quick-link-remove").forEach(btn=>btn.onclick=()=>{
   const link=links.find(v=>v.id===btn.dataset.id);
   if(!link)return;
   if(!window.confirm(`"${link.label || "Link"}" wirklich aus dem Schnellzugriff löschen?`))return;
   const id=btn.dataset.id;
   ensureQuickLinkTombstones()[id]=Date.now();
   state.familySettings.quickLinks=links.filter(v=>v.id!==id);
   save();
   persistQuickLinksDeletionImmediately();
   renderQuickLinks();
 });
}
document.querySelector("#saveQuickLinkBtn")?.addEventListener("click",()=>{const label=document.querySelector("#quickLinkLabel")?.value.trim()||"";const url=normalizeExternalUrl(document.querySelector("#quickLinkUrl")?.value||"");if(!label||!url)return;if(editingQuickLinkId){const x=state.familySettings.quickLinks.find(v=>v.id===editingQuickLinkId);if(x){x.label=label;x.url=url;x.updatedAt=Date.now();}}else state.familySettings.quickLinks.push({id:uid(),label,url,createdAt:Date.now(),updatedAt:Date.now()});save();resetQuickLinkEditor();renderQuickLinks();});
document.querySelector("#cancelQuickLinkEditBtn")?.addEventListener("click",resetQuickLinkEditor);



// V33 – frühere sehr kräftige Papa-Rottöne einmalig in ein ruhigeres
// Vintage-Terrakotta überführen. Eigene andere Farbwahlen bleiben unangetastet.
try {
  const oldPapaReds = new Set(["#c84d4d","#ff0000","#e60000","#ef3f3f"]);
  const currentPapaColor = String(state.familySettings?.b?.color || "").toLowerCase();
  if (oldPapaReds.has(currentPapaColor)) {
    state.familySettings.b.color = "#ad7468";
    localStorage.setItem("balanceProd.familySettings", JSON.stringify(state.familySettings));
  }
} catch (err) {
  console.warn("Papa-Farbmigration nicht möglich:", err);
}

function familyName(key){
  return state.familySettings[key]?.name || defaultFamilySettings[key]?.name || "";
}

function familyColor(key){
  if (state.familyColors?.[key]?.color) return state.familyColors[key].color;
  return state.familySettings[key]?.color || defaultFamilySettings[key]?.color || "#aaa29c";
}

function generalColor(){
  return state.familyColors?.general?.color || DEFAULT_GENERAL_COLOR;
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


function familyQuestionThankYouMessage() {
  const messages = [
    "💛 RIESENDANKE! Du hast mir damit wirklich geholfen.",
    "🌷 Tausend Dank – genau solche kleinen Hilfen machen den Alltag leichter.",
    "✨ Danke, dass du das übernommen hast. Das bedeutet mir wirklich viel.",
    "🌿 RIESENDANKE! Schön, dass wir uns aufeinander verlassen können.",
    "💫 Danke! Damit hast du gerade ein Stück Last von jemand anderem übernommen.",
    "🌼 Ganz großes Danke – solche Gefallen sind alles andere als selbstverständlich.",
    "🫶 Danke, dass du dich darum gekümmert hast. Das war richtig lieb.",
    "💛 Wirklich: Danke. Genau so fühlt sich Familie an."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function showFamilyQuestionThanks() {
  const toast = document.querySelector("#motivationToast");
  if (toast) toast.classList.add("family-thanks");
  showMotivation(familyQuestionThankYouMessage());
  window.setTimeout(() => toast?.classList.remove("family-thanks"), 7200);
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
    "1":{name:"Lou",tasks:[],links:[],interestLinks:[],timetableUrl:"",timetableByYear:{}},
    "2":{name:"Fina",tasks:[],links:[],interestLinks:[],timetableUrl:"",timetableByYear:{}}
  }
};
["1","2"].forEach(id=>{
  state.school.children[id]=state.school.children[id]||{name:(id === "1" ? "Lou" : "Fina"),tasks:[],links:[]};
  state.school.children[id].tasks=Array.isArray(state.school.children[id].tasks)?state.school.children[id].tasks:[];
  state.school.children[id].links=Array.isArray(state.school.children[id].links)?state.school.children[id].links:[];
  state.school.children[id].interestLinks=Array.isArray(state.school.children[id].interestLinks)?state.school.children[id].interestLinks:[];
  state.school.children[id].deletedTaskIds=Array.isArray(state.school.children[id].deletedTaskIds)?state.school.children[id].deletedTaskIds:[];
  state.school.children[id].deletedLinkIds=Array.isArray(state.school.children[id].deletedLinkIds)?state.school.children[id].deletedLinkIds:[];
  state.school.children[id].spotifyUrl=typeof state.school.children[id].spotifyUrl==="string"?state.school.children[id].spotifyUrl:"";
  state.school.children[id].interestLinks.forEach(link=>{
    if(!["gut","mittel","schlecht"].includes(link.rating)) link.rating="mittel";
    if(link && link.category==="lernen") link.category="lesen";
  });
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
      category: video.category || "other",
      rating: null,
      favorite: false,
      lastDone: null
    };
    state.archive.push(entry);
  }

  entry.title = video.title || entry.title;
  entry.thumbnail = entry.thumbnail || video.thumbnail || thumbnailFor(video.url);
  entry.category = video.category || entry.category || "other";
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



function normalizedFamilyMembers(todo) {
  const order = ["a","b","c","d"];
  return [...new Set(
    (Array.isArray(todo?.family) ? todo.family : [])
      .filter(x => state.familySettings?.[x])
  )].sort((x,y) => order.indexOf(x) - order.indexOf(y));
}

function todoGroupKey(todo) {
  const members = normalizedFamilyMembers(todo);
  if (members.length === 0) return "general";
  if (members.length === 1) return members[0];
  return `shared:${members.join("+")}`;
}

function isSharedGroupKey(key) {
  return String(key || "").startsWith("shared:");
}

function membersFromGroupKey(key) {
  if (!isSharedGroupKey(key)) return [];
  return String(key).slice(7).split("+").filter(Boolean);
}

function todoGroupLabel(key) {
  if (["a","b","c","d"].includes(key)) return familyName(key);
  if (key === "general") return "Allgemein";

  if (isSharedGroupKey(key)) {
    const members = membersFromGroupKey(key);
    const all = ["a","b","c","d"].filter(k => state.familySettings?.[k]);

    if (members.length === all.length && all.every(k => members.includes(k))) return "Alle";
    return members.map(k => familyName(k) || k).join(" + ");
  }

  return "Allgemein";
}


function familySelectionLabel(todo) {
  const members = normalizedFamilyMembers(todo);

  if (!members.length) return "Allgemein";
  if (members.length === 1) return familyName(members[0]) || "";

  const allFamilyKeys = ["a","b","c","d"].filter(key => state.familySettings?.[key]);
  if (members.length === allFamilyKeys.length && allFamilyKeys.every(key => members.includes(key))) {
    return "Alle";
  }

  return members.map(member => familyName(member) || member).join(" + ");
}

function todoGroupOrder(key) {
  if (["a","b","c","d"].includes(key)) return {a:1,b:2,c:3,d:4}[key];
  if (isSharedGroupKey(key)) return 5;
  if (key === "general") return 6;
  return 9;
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
  return isSharedGroupKey(key) ? "person-group-shared" : `person-group-${key}`;
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


function weekHolidayLabel(date) {
  const holiday = typeof austrianPublicHoliday === "function" ? austrianPublicHoliday(date) : "";
  return holiday || "";
}

const expandedWeekTodoDays = new Set();


function alignWeekBands(grid){
  if(!grid) return;

  const days = [...grid.querySelectorAll(".day")];
  if(!days.length) return;

  /* MOBILE:
     In der einspaltigen Handyansicht ist die Desktop-Höhensynchronisierung
     kontraproduktiv: jedes Tagesfenster bekommt sonst die größten Bandhöhen
     der gesamten Woche und wird unnötig riesig.
     Am Handy immer natürliche Inhaltshöhen verwenden. */
  if (window.matchMedia("(max-width: 700px)").matches) {
    const mobileBands = [
      ".week-day-topband",
      ".week-band-meal",
      ".week-band-events",
      ".week-band-school",
      ".week-band-todos",
      ".week-band-videos"
    ];

    days.forEach(day => {
      day.style.removeProperty("min-height");
      day.style.removeProperty("height");
      mobileBands.forEach(selector => {
        const node = day.querySelector(selector);
        if (!node) return;
        node.style.removeProperty("min-height");
        node.style.removeProperty("height");
      });
    });
    return;
  }

  const bands = [
    ".week-day-topband",
    ".week-band-meal",
    ".week-band-events",
    ".week-band-school",
    ".week-band-todos",
    ".week-band-videos"
  ];

  bands.forEach(selector => {
    const nodes = days.map(day => day.querySelector(selector)).filter(Boolean);
    if(!nodes.length) return;

    // Topband ist immer vorhanden; alle anderen Bänder nur dann,
    // wenn mindestens ein Tag in der Woche dort echten Inhalt hat.
    const alwaysVisible = selector === ".week-day-topband";
    const hasWeekContent = alwaysVisible || nodes.some(node =>
      [...node.children].some(child =>
        !child.classList.contains("hidden") &&
        (child.textContent.trim() || child.querySelector("img,button,input,a,details"))
      )
    );

    nodes.forEach(node => {
      node.style.removeProperty("min-height");
      node.classList.toggle("week-band-unused", !hasWeekContent);
    });

    if(!hasWeekContent) return;

    // Erst natürliche Höhen messen, dann exakt die größte Wochenhöhe
    // auf alle sieben Tage übertragen.
    const maxHeight = Math.ceil(Math.max(...nodes.map(node => node.scrollHeight)));
    nodes.forEach(node => {
      node.style.minHeight = `${maxHeight}px`;
    });
  });
}

function renderWeek() {
  weekLabel();
  const grid = document.querySelector("#weekGrid");
  grid.innerHTML = "";
  const weekKey = currentWeekKey();

  const weekDates = days.map((_, i) => dayDate(currentWeekMonday, i));

  // Mehrtägige Termine bekommen innerhalb der sichtbaren Woche feste Spuren.
  // Dadurch bleibt derselbe Termin von Montag bis Sonntag immer auf derselben Höhe.
  const weekStartKey = dateKey(weekDates[0]);
  const weekEndKey = dateKey(weekDates[weekDates.length - 1]);
  const multiDayEventsThisWeek = (state.todos || [])
    .filter(t => {
      if (!t || t.type !== "event" || (t.recurrence || "none") !== "none") return false;
      const start = t.date || "";
      const end = t.endDate || start;
      if (!start || end <= start || start > weekEndKey || end < weekStartKey) return false;

      // Ein echter Mehrtagestermin bleibt in jeder Woche ein Band.
      // Beispiel Sa–Di:
      // - erste Woche: Sa–So als Band
      // - nächste Woche: Mo–Di als Band
      return true;
    })
    .slice()
    .sort((a,b) => {
      const aStart = parseLocalDate(a.date);
      const aEnd = parseLocalDate(a.endDate || a.date);
      const bStart = parseLocalDate(b.date);
      const bEnd = parseLocalDate(b.endDate || b.date);
      const aDays = aStart && aEnd ? Math.round((aEnd - aStart) / 86400000) + 1 : 1;
      const bDays = bStart && bEnd ? Math.round((bEnd - bStart) / 86400000) + 1 : 1;
      return bDays - aDays ||
        String(a.date || "").localeCompare(String(b.date || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""));
    });

  // Längere Termine bleiben bevorzugt oben.
  // Nicht überlappende Mehrtagestermine dürfen aber dieselbe Spur teilen.
  // Beispiel: Twingo Mo–Di und Fina Mi–Sa können in derselben Zeile stehen.
  const multiDayTracks = [];
  const multiDayTrackById = new Map();

  const visibleRangeFor = item => ({
    start: item.date < weekStartKey ? weekStartKey : item.date,
    end: (item.endDate || item.date) > weekEndKey
      ? weekEndKey
      : (item.endDate || item.date)
  });

  multiDayEventsThisWeek.forEach(item => {
    const range = visibleRangeFor(item);
    let targetTrack = -1;

    for (let track = 0; track < multiDayTracks.length; track++) {
      const overlaps = multiDayTracks[track].some(existing => {
        const other = visibleRangeFor(existing);
        return !(range.end < other.start || range.start > other.end);
      });
      if (!overlaps) {
        targetTrack = track;
        break;
      }
    }

    if (targetTrack < 0) {
      targetTrack = multiDayTracks.length;
      multiDayTracks.push([]);
    }

    multiDayTracks[targetTrack].push(item);
    multiDayTrackById.set(item.id, targetTrack);
  });

  const multiDayTrackCount = multiDayTracks.length;

  // Handy-Hochformat: Mehrtagestermine nur EINMAL oberhalb der gestapelten Tage.
  // Die normalen Desktop-/Tablet-Leisten bleiben davon unberührt.
  let mobileMultiSummary = document.querySelector("#mobileMultidaySummary");
  if (!mobileMultiSummary) {
    mobileMultiSummary = document.createElement("div");
    mobileMultiSummary.id = "mobileMultidaySummary";
    mobileMultiSummary.className = "mobile-multiday-summary";
    grid.parentElement?.insertBefore(mobileMultiSummary, grid);
  }

  const mobileDayShort = iso => {
    const d = parseLocalDate(iso);
    if (!d) return "";
    return ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()];
  };

  mobileMultiSummary.innerHTML = multiDayEventsThisWeek.map(item => {
    const groupKey = todoGroupKey(item);
    const accent = isSharedGroupKey(groupKey)
      ? "#b58fa7"
      : (groupKey === "general" ? generalColor() : (familyColor(groupKey) || "#a99f99"));

    const person =
      groupKey === "general"
        ? ""
        : familySelectionLabel(item);

    const visibleStart = item.date < weekStartKey ? weekStartKey : item.date;
    const visibleEnd = (item.endDate || item.date) > weekEndKey
      ? weekEndKey
      : (item.endDate || item.date);

    const range = visibleStart === visibleEnd
      ? mobileDayShort(visibleStart)
      : `${mobileDayShort(visibleStart)}–${mobileDayShort(visibleEnd)}`;

    return `<div class="mobile-multiday-item" style="--mobile-multi-accent:${accent}">
      <span class="mobile-multiday-dot" aria-hidden="true"></span>
      ${person ? `<span class="mobile-multiday-person">${escapeHtml(person)}</span>` : ""}
      <span class="mobile-multiday-title">${item.superImportant ? "★ " : ""}${escapeHtml(item.text || "")}</span>
      <span class="mobile-multiday-range">${range}</span>
    </div>`;
  }).join("");

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
    if (weekHolidayLabel(date)) dayEl.classList.add("is-holiday");
    if (date.getDay() === 0 || date.getDay() === 6) dayEl.classList.add("is-weekend");

    const dateLabel = date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});

    // Übungen/Videos gehören nicht mehr auf die Familien-Startseite.
    // Sie werden ab jetzt über Werkraum → Routinen → Meine Woche geführt.
    const videos = [];
    const occurrences = state.todos.filter(t => occursOnDate(t, date));
 const todos = occurrences.filter(t =>
  (t.type || "todo") === "todo" &&
  t.priority !== "weekplan" &&
  !isOccurrenceDone(t, date)
);
    const weekplanTodos=occurrences.filter(t=>(t.type||"todo")==="todo"&&t.priority==="weekplan"&&!isOccurrenceDone(t,date));
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
            <button class="text-btn rate-btn ${ratingFor(v.url) === "super" ? "selected" : ""}" data-id="${v.id}" data-rating="super" title="Gut" aria-label="Gut">😊</button>
            <button class="text-btn rate-btn ${ratingFor(v.url) === "okay" ? "selected" : ""}" data-id="${v.id}" data-rating="okay" title="Mittel" aria-label="Mittel">🙂</button>
            <button class="text-btn rate-btn ${ratingFor(v.url) === "nope" ? "selected" : ""}" data-id="${v.id}" data-rating="nope" title="Schlecht" aria-label="Schlecht">😕</button>
          </div>` : ""}
      </div>
    `).join("");

    const todoLimit = 4;
    const todoDayKey = dateKey(date);
    const sortedTodos = [...todos].sort((a,b) =>
      Number(!!b.superImportant) - Number(!!a.superImportant) ||
      Number(a.createdAt || 0) - Number(b.createdAt || 0)
    );
    const todoExpanded = expandedWeekTodoDays.has(todoDayKey);
    const visibleTodos = todoExpanded ? sortedTodos : sortedTodos.slice(0, todoLimit);
    const hiddenTodoCount = Math.max(0, sortedTodos.length - todoLimit);

    const todoHtml = todos.length ? `
      <div class="day-todos">
        ${groupTodosByPerson(visibleTodos).map(([groupKey, groupItems]) => `
          <div class="person-todo-group grouped-family-block ${groupAccentClass(groupKey)}"
               style="${isSharedGroupKey(groupKey)
                 ? `--group-border:${sharedGroupGradient(groupItems)}`
                 : `--group-border:${groupKey === "general" ? generalColor() : (familyColor(groupKey) || "#c8c0ba")}`}">
            <div class="person-todo-group-title">
              <span>${todoGroupLabel(groupKey)}</span>
              ${groupItems.some(isNewEntry) ? `<span class="new-entry-badge group-new-badge">NEU</span>` : ""}
            </div>
            ${groupItems.map(t => `
              <div class="todo-mini-wrap">
                <label class="todo-mini grouped-todo-row ${t.superImportant ? "super-important" : ""} ${t.priority==="important"?"priority-important":""} ${t.priority==="low"?"priority-low":""}">
                  <input class="check mini-todo-check" data-id="${t.id}" data-date="${dateKey(date)}" type="checkbox" ${isOccurrenceDone(t, date) ? "checked":""}>
                  <span>
                    ${t.superImportant ? `<span class="tiny-star">★</span>` : ''}
                    ${t.priority==="important"?`<span class="priority-mark" title="Wichtig">◆</span>`:""}
                    ${escapeHtml(t.text)}
                  </span>
                </label>
                ${(!t.recurrence || t.recurrence === "none") && date < new Date(new Date().setHours(0,0,0,0))
                  ? `<button type="button" class="roll-todo-today" data-id="${t.id}" title="Auf heute verschieben" aria-label="Auf heute verschieben">→</button>`
                  : ""}
              </div>
            `).join("")}
          </div>
        `).join("")}
        ${hiddenTodoCount > 0 ? `
          <button type="button" class="week-more-todos" data-date="${todoDayKey}">
            ${todoExpanded ? "Weniger anzeigen" : `+ ${hiddenTodoCount} weitere`}
          </button>` : ""}
      </div>
    ` : "";

const weekplanHtml=weekplanTodos.length?`<div class="weekplan-quiet-list">${weekplanTodos.map(t=>`<button type="button" class="weekplan-quiet-item" data-id="${t.id}" data-date="${dateKey(date)}">${escapeHtml(t.text)}</button>`).join("")}</div>`:"";

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
  } else {
    displayTime = "";
  }

  const groupKey = todoGroupKey(t);
  return `
    <div class="person-todo-group grouped-family-block event-person-block ${groupAccentClass(groupKey)}"
         style="${isSharedGroupKey(groupKey)
           ? `--group-border:${sharedGroupGradient([t])}`
           : `--group-border:${groupKey === "general" ? generalColor() : (familyColor(groupKey) || "#c8c0ba")}`}">
      <div class="person-todo-group-title">
        <span>${familySelectionLabel(t)}</span>
        ${isNewEntry(t) ? `<span class="new-entry-badge group-new-badge">NEU</span>` : ""}
      </div>
      <div class="event-mini event-display grouped-todo-row ${t.superImportant ? "super-important" : ""}">
        <span class="event-symbol">${eventMeta.icon}</span>
        <span class="event-copy">
          ${displayTime ? `<strong class="event-time">${escapeHtml(displayTime)}</strong>` : ""}
          ${eventMeta.label ? `<span class="event-kind">${eventMeta.label}</span>` : ""}
          ${t.superImportant ? `<span class="tiny-star">★</span>` : ""}
          <span class="event-title">${escapeHtml(t.text)}</span>
        </span>
      </div>
    </div>`;
};

const quietBottomCategories = new Set(["birthday","nameday","anniversary"]);
const quietBottomEvents = events
  .filter(t => quietBottomCategories.has(t.eventCategory || "normal"))
  .sort((a,b) => (a.time || "").localeCompare(b.time || ""));

const visibleEvents = events
  .filter(t => !quietBottomCategories.has(t.eventCategory || "normal"));

const orderedEvents = [...visibleEvents].sort((a,b) => {
  const aStart = a.date || "";
  const bStart = b.date || "";
  const aEnd = a.endDate || aStart;
  const bEnd = b.endDate || bStart;
  const aMulti = aEnd > aStart ? 0 : 1;
  const bMulti = bEnd > bStart ? 0 : 1;
  return aMulti - bMulti ||
    String(a.time || "99:99").localeCompare(String(b.time || "99:99")) ||
    String(a.id).localeCompare(String(b.id));
});

const multiDayEvents = orderedEvents.filter(t => multiDayTrackById.has(t.id));
const singleDayEvents = orderedEvents.filter(t => !multiDayTrackById.has(t.id));

const multiDayLaneHtml = multiDayTrackCount
  ? `<div class="multiday-event-lanes">
      ${Array.from({length:multiDayTrackCount}, (_,track) => {
        const currentKey = dateKey(date);
        const item = (multiDayTracks[track] || []).find(candidate => {
          const range = visibleRangeFor(candidate);
          return currentKey >= range.start && currentKey <= range.end;
        });

        if (!item) {
          return `<div class="multiday-event-lane multiday-event-placeholder" data-track="${track}" aria-hidden="true"></div>`;
        }

        const visibleStart = item.date < weekStartKey ? weekStartKey : item.date;
        const visibleEnd = (item.endDate || item.date) > weekEndKey
          ? weekEndKey
          : (item.endDate || item.date);

        const activeToday = true;

        const isStart = currentKey === visibleStart;
        const isEnd = currentKey === visibleEnd;
        const groupKey = todoGroupKey(item);

        const members = [...new Set(
          (Array.isArray(item.family) ? item.family : [])
            .filter(member => state.familySettings?.[member])
        )];
        const memberColors = members.map(member => familyColor(member)).filter(Boolean);

        const accent =
          memberColors[0] ||
          (groupKey === "general" ? generalColor() : "#a99f99");

        // Bei mehreren Personen bleibt die frühere Farbmischung erhalten,
        // nur bewusst etwas heller und ruhiger als bei den normalen Karten.
        const singleStrength = members.length === 1 && members[0] === "c" ? 32 : 22;
        const softStops = memberColors.length > 1
          ? memberColors.map((color, i) => {
              const pos = Math.round((i / (memberColors.length - 1)) * 100);
              return `color-mix(in srgb, ${color} 18%, #fffdfb) ${pos}%`;
            }).join(", ")
          : `color-mix(in srgb, ${accent} ${singleStrength}%, #fffdfb) 0%, color-mix(in srgb, ${accent} ${singleStrength}%, #fffdfb) 100%`;

        const personBackground = memberColors.length > 1
          ? `linear-gradient(110deg, ${memberColors.map((color, i) => {
              const pos = Math.round((i / (memberColors.length - 1)) * 100);
              return `${color} ${pos}%`;
            }).join(", ")})`
          : accent;

        const multiBackground = `linear-gradient(110deg, ${softStops})`;

        const personLabel =
          groupKey === "general"
            ? ""
            : familySelectionLabel(item);

        const visibleStartIndex = weekDates.findIndex(d => dateKey(d) === visibleStart);
        const visibleEndIndex = weekDates.findIndex(d => dateKey(d) === visibleEnd);
        const visibleSpan = Math.max(1, visibleEndIndex - visibleStartIndex + 1);
        const visibleCenter = (visibleStartIndex + visibleEndIndex) / 2;
        const visibleCenterIndex = Math.floor(visibleCenter);
        const centerOffset = visibleCenter - visibleCenterIndex;
        const showLabel = index === visibleCenterIndex;

        // Uhrzeit nur dort zeigen, wo der echte Start in dieser Woche liegt.
        // Bei Sa–Di steht 16:00 also in der Sa–So-Woche, nicht nochmals am Montag.
        const startTime = item.date >= weekStartKey && item.date <= weekEndKey && item.time
          ? `${escapeHtml(item.time)} `
          : "";
        const endTime = (item.endDate || item.date) >= weekStartKey &&
                        (item.endDate || item.date) <= weekEndKey &&
                        item.endTime
          ? ` · bis ${escapeHtml(item.endTime)}`
          : "";

        return `<div class="multiday-event-lane" data-track="${track}">
          <div
            class="multiday-continuous-segment ${isStart ? "is-start" : ""} ${isEnd ? "is-end" : ""}"
            style="--multi-accent:${accent};--multi-bg:${multiBackground};--multi-person-bg:${personBackground};--multi-span:${visibleSpan};--multi-center-offset:${centerOffset}">
            ${showLabel
              ? `<span class="multiday-continuous-label multiday-center-label">
                   ${personLabel ? `<span class="multiday-person"><i></i>${escapeHtml(personLabel)}</span><span class="multiday-sep">·</span>` : ""}
                   <span class="multiday-title">${startTime}${item.superImportant ? "★ " : ""}${escapeHtml(item.text)}${endTime}</span>
                 </span>`
              : `<span class="multiday-continuous-fill" aria-hidden="true"></span>`}
          </div>
        </div>`;
      }).join("")}
    </div>`
  : "";

const singleEventHtml = singleDayEvents
  .map(t => `<div class="single-event-lane">${renderEventCard(t)}</div>`)
  .join("");

const eventHtml = (multiDayLaneHtml || singleEventHtml) ? `
  <div class="day-events">
    ${multiDayLaneHtml}
    ${singleEventHtml}
  </div>
` : "";


    const schoolTasksForDate = [];
    ["1","2"].forEach(childId => {
      const child = state.school.children[childId];
      child.tasks.forEach(task => {
        if (task.due === dateKey(date) && !task.done) {
          schoolTasksForDate.push({...task, childId, childName: child.name});
        }
      });
    });

    const mealsForDay = activeMealsForDate(dateKey(date));
    const mealHtml = mealsForDay.length ? `
      <details class="day-meal-compact">
        <summary class="day-meal-vintage-toggle" title="${mealsForDay.length} ${mealsForDay.length===1 ? "Gericht" : "Gerichte"} geplant">
          <span class="vintage-cloche" aria-hidden="true"><i></i></span>
          ${mealsForDay.length > 1 ? `<span class="day-meal-count">${mealsForDay.length}</span>` : ""}
        </summary>
        <div class="day-meal-popover">
          ${mealsForDay.map(meal=>{
            const recipe=resolveMealRecipe(meal.recipeId,meal.label);
            const title=recipe?.title || meal.label || "Rezept";
            if(recipe) return `<button type="button" class="day-meal-list-item day-meal-recipe" data-recipe-id="${recipe.id}">${escapeHtml(title)}</button>`;
            if(meal.url) return `<a class="day-meal-list-item" href="${escapeHtml(meal.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
            return `<span class="day-meal-list-item">${escapeHtml(title)}</span>`;
          }).join("")}
        </div>
      </details>` : "";

    const schoolHtml = schoolTasksForDate.length ? `
      <div class="day-school">
        <div class="day-todos-title">Schule</div>
        ${schoolTasksForDate.map(t => `
          <label class="school-week-item child-${t.childId} ${t.done ? "done" : ""}">
            <button class="school-week-check child-symbol-check ${t.done ? "done" : ""}" data-child="${t.childId}" data-id="${t.id}" type="button" aria-label="${t.done ? "Erledigt" : "Als erledigt markieren"}"><span class="child-symbol-glyph">${schoolTaskIcon(t,t.childId)}</span>${t.done ? `<span class="child-symbol-done">✓</span>` : ""}</button>
            <span class="school-week-copy">
              <strong>${escapeHtml(t.childName)}</strong> · ${escapeHtml(t.text)}
              ${t.subject ? ` <small>${escapeHtml(t.subject)}</small>` : ""}
              ${t.done ? `<em class="school-week-done">✓ erledigt</em>` : ""}
            </span>
          </label>
        `).join("")}
      </div>
    ` : "";

    const quietBottomHtml = quietBottomEvents.length ? `
      <div class="day-quiet-events">
        ${quietBottomEvents.map(t => {
          const meta = {
            birthday:{icon:"🎂",label:"Geburtstag"},
            nameday:{icon:"🌷",label:"Namenstag"},
            anniversary:{icon:"♡",label:"Jahrestag"}
          }[t.eventCategory] || {icon:"♡",label:""};
          return `<div class="day-quiet-event">
            <span aria-hidden="true">${meta.icon}</span>
            <span>${escapeHtml(t.text || meta.label)}</span>
          </div>`;
        }).join("")}
      </div>` : "";

    const dayTopHtml = `
      <h3>${day}<span class="day-date">${dateLabel}</span></h3>
      ${(() => {
        const holiday = weekHolidayLabel(date);
        return holiday ? `<div class="week-holiday-label">✦ ${escapeHtml(holiday)}</div>` : "";
      })()}
      ${(() => {
        const currentKey = dateKey(date);
        const items = multiDayEventsThisWeek.filter(item => {
          const start = item.date || "";
          const end = item.endDate || start;
          return currentKey >= start && currentKey <= end;
        });
        if (!items.length) return "";

        return `<div class="mobile-day-multiday-notes">
          ${items.map(item => {
            const end = item.endDate || item.date;
            const person = todoGroupKey(item) === "general" ? "" : familySelectionLabel(item);
            const endDate = parseLocalDate(end);
            const endLabel = endDate
              ? `${["So","Mo","Di","Mi","Do","Fr","Sa"][endDate.getDay()]} ${String(endDate.getDate()).padStart(2,"0")}.${String(endDate.getMonth()+1).padStart(2,"0")}.`
              : "";
            return `<div class="mobile-day-multiday-note">
              <span aria-hidden="true">↔</span>
              ${person ? `<span class="mobile-day-multiday-person">${escapeHtml(person)}</span><span>·</span>` : ""}
              <span class="mobile-day-multiday-text">${item.superImportant ? "★ " : ""}${escapeHtml(item.text || "")}</span>
              ${endLabel ? `<span class="mobile-day-multiday-until">· bis ${escapeHtml(endLabel)}</span>` : ""}
            </div>`;
          }).join("")}
        </div>`;
      })()}
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
    `;

    dayEl.innerHTML = `
      <div class="week-day-topband">${dayTopHtml}</div>

      <div class="week-band week-band-meal">
        ${mealHtml || ""}
      </div>

      <div class="week-band week-band-events">
        ${eventHtml || ""}
      </div>

      <div class="week-band week-band-school">
        ${schoolHtml || ""}
      </div>

      <div class="week-band week-band-todos">
        ${todoHtml || ""}
      </div>

      <div class="week-band week-band-videos">
        ${videoHtml
          ? `<div class="day-bottom-slot">
               <details class="day-video-details">
                 <summary>▷ Übung${videos.length === 1 ? "" : "en"} <span>${videos.length}</span></summary>
                 <div class="day-video-details-content">${videoHtml}</div>
               </details>
             </div>`
          : ""}
      </div>

      ${(weekplanHtml || quietBottomHtml) ? `
        <div class="day-bottom-stack">
          ${weekplanHtml ? `<div class="weekplan-bottom-slot">${weekplanHtml}</div>` : ""}
          ${quietBottomHtml || (weekplanHtml ? `<div class="day-quiet-events day-quiet-placeholder" aria-hidden="true"></div>` : "")}
        </div>
      ` : ""}
    `;
    grid.appendChild(dayEl);
  });

  // V33: gemeinsame Wochenbänder erst NACH dem Rendern messen.
  alignWeekBands(grid);

  /* MOBILE V95:
     Wenn die aktuell laufende Woche geöffnet wird, soll der heutige Tag
     tatsächlich im sichtbaren Bereich landen. Nur einmal pro Seitenaufruf/
     Woche automatisch springen, damit spätere Änderungen nicht ständig
     zurück zum heutigen Tag ziehen. */
  if (window.matchMedia("(max-width: 700px)").matches) {
    const shownWeekKey = dateKey(currentWeekMonday);
    if (
      shownWeekKey === currentWeekKey() &&
      window.__mobileTodayShownWeek !== shownWeekKey
    ) {
      window.__mobileTodayShownWeek = shownWeekKey;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const todayCard = grid.querySelector(".day.today");
          if (todayCard) {
            todayCard.scrollIntoView({
              block: "start",
              inline: "nearest",
              behavior: "auto"
            });
          }
        }, 80);
      });
    }
  }

  document.querySelectorAll(".day-meal-recipe").forEach(btn => btn.addEventListener("click", () => {
    const byId = state.recipes.find(r => r.id === btn.dataset.recipeId);
    const recipe = resolveMealRecipe(btn.dataset.recipeId, byId?.title || "");
    if (!recipe) return;
    if (normalizedRecipeSource(recipe) === "external") {
      const url = recipe.webUrl || recipe.youtubeUrl;
      if (url) window.open(url, "_blank", "noopener");
      return;
    }
    showRecipeDetail(recipe);
  }));

  document.querySelectorAll(".day-meal-rate").forEach(btn => btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    const url = btn.dataset.url || "";
    if (!url) return;

    const current = state.recipeLinkFeedback[url] || {};
    const next = btn.dataset.rating || "";
    state.recipeLinkFeedback[url] = {
      ...current,
      rating: current.rating === next ? "" : next,
      timesUsed: Number(current.timesUsed || 0),
      hidden: false,
      hiddenAt: 0,
      updatedAt: Date.now()
    };

    save();
    renderWeek();
    renderRecipeLinkTracker();
  }));

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

    // Geräte-Sync: Statusänderungen müssen eine neue Version bekommen.
    // Sonst kann ein anderes Gerät seinen alten lokalen Stand behalten.
    const now = Date.now();
    item.updatedAt = now;

    if (!item.recurrence || item.recurrence === "none") {
      item.completedAt = e.target.checked ? now : null;
    }
    save();
    renderAll();

    if (!wasDone && e.target.checked) showMotivation(todoMotivationalMessage());
  }));

  document.querySelectorAll(".weekplan-quiet-item").forEach(btn=>btn.addEventListener("click",()=>{
    const item=state.todos.find(t=>t.id===btn.dataset.id);
    const d=parseLocalDate(btn.dataset.date);
    if(!item||!d)return;
    btn.classList.add("is-finishing");
    setOccurrenceDone(item,d,true);
    item.updatedAt=Date.now();
    save();
    setTimeout(()=>{renderWeek();renderTodos();},420);
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

  document.querySelectorAll(".week-more-todos").forEach(btn => btn.addEventListener("click", e => {
    const key = e.currentTarget.dataset.date;
    if (!key) return;
    if (expandedWeekTodoDays.has(key)) expandedWeekTodoDays.delete(key);
    else expandedWeekTodoDays.add(key);
    renderWeek();
  }));

  document.querySelectorAll(".school-week-check").forEach(el => el.addEventListener("click", e => {
    if (e.__schoolWeekHandled) return;
    e.__schoolWeekHandled = true;
    e.preventDefault();
    e.stopPropagation();

    const childId = e.currentTarget.dataset.child;
    const taskId = e.currentTarget.dataset.id;
    const child = state.school.children[childId];
    const task = child?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const wasDone = !!task.done;
    task.done = !task.done;

    save();
    renderAll();

    if (!wasDone && task.done) {
      showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(child)));
    }
  }));

  document.querySelectorAll(".remove-week-video").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    markListItemDeleted("videoTombstones", id);
    state.videos = state.videos.filter(v => v.id !== id);
    save();
    persistTopLevelDeletionImmediately("videos");
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
      super: "✦ Als „Gut“ gespeichert.",
      okay: "○ Als „Mittel“ gespeichert.",
      nope: "— Als „Schlecht“ gespeichert."
    };

    save();
    renderAll();
    showMotivation(ratingText[rating]);
  }));
}

let todoFilter = null;
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

  const generalInput = document.querySelector("#familyColorGeneral");
  if (generalInput && document.activeElement !== generalInput) {
    generalInput.value = generalColor();
  }

  document.documentElement.style.setProperty("--family-a-color", familyColor("a"));
  document.documentElement.style.setProperty("--family-b-color", familyColor("b"));
  document.documentElement.style.setProperty("--family-c-color", familyColor("c"));
  document.documentElement.style.setProperty("--family-d-color", familyColor("d"));
  document.documentElement.style.setProperty("--family-general-color", generalColor());
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
        state.familySettings[key].updatedAt = Date.now();
        persistFamilySettingsImmediately();
        save();
        renderAll();
      });
    }

    if (colorInput && !colorInput.dataset.bound) {
      colorInput.dataset.bound = "1";

      /* WICHTIG:
         Während der Farbwähler offen ist NICHT renderAll() aufrufen.
         Das bisherige Rendern bei jedem "input" konnte das aktive
         <input type="color"> ersetzen und damit die endgültige Auswahl
         wieder verlieren. */
      colorInput.addEventListener("input", () => {
        state.familyColors[key].color = colorInput.value;
        state.familySettings[key].color = colorInput.value;
        applyFamilyVisuals();
      });

      colorInput.addEventListener("change", () => {
        const now = Date.now();
        state.familyColors[key] = {
          color: colorInput.value,
          updatedAt: now
        };
        state.familySettings[key].color = colorInput.value;
        state.familySettings[key].updatedAt = now;

        persistFamilyColorsImmediately();
        persistFamilySettingsImmediately();
        save();

        /* Erst NACH dem abgeschlossenen Farbwähler neu rendern. */
        renderAll();
        applyFamilyVisuals();
      });
    }
  });

  const generalInput = document.querySelector("#familyColorGeneral");
  if (generalInput && !generalInput.dataset.bound) {
    generalInput.dataset.bound = "1";

    generalInput.addEventListener("input", () => {
      state.familyColors.general.color = generalInput.value;
      applyFamilyVisuals();
    });

    generalInput.addEventListener("change", () => {
      state.familyColors.general = {
        color: generalInput.value,
        updatedAt: Date.now()
      };
      persistFamilyColorsImmediately();
      save();
      renderAll();
      applyFamilyVisuals();
    });
  }
}
function isNewEntry(item) {
  if (!item.createdAt) return false;

  const threeDays = 24 * 60 * 60 * 1000;
  return Date.now() - item.createdAt < threeDays;
}
const expandedTodoGroups = new Set();

function ensureTodoTrashUI() {
  const todoView =
    document.querySelector('[data-view-panel="todos"]') ||
    document.querySelector("#todoList")?.closest("section") ||
    document.querySelector("#todoList")?.parentElement;

  if (!todoView) return null;

  let wrap = document.querySelector("#todoTrashWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "todoTrashWrap";
    wrap.className = "todo-trash-wrap";
    wrap.innerHTML = `
      <details id="todoTrashDetails" class="todo-trash-details">
        <summary>🗑️ Papierkorb <span id="todoTrashCount"></span></summary>
        <div id="todoTrashList" class="todo-trash-list"></div>
      </details>
    `;
    todoView.appendChild(wrap);
  }
  return wrap;
}

function renderTodoTrash() {
  pruneTrash();
  const wrap = ensureTodoTrashUI();
  if (!wrap) return;

  const host = wrap.querySelector("#todoTrashList");
  const count = wrap.querySelector("#todoTrashCount");
  if (!host) return;

  const rows = (state.trash || [])
    .filter(rec => rec.kind === "todo")
    .sort((a,b) => Number(b.deletedAt || 0) - Number(a.deletedAt || 0));

  if (count) count.textContent = rows.length ? `(${rows.length})` : "";

  host.innerHTML = rows.length
    ? rows.map(rec => {
        const x = rec.item || {};
        const remainingMs = Math.max(0, TRASH_KEEP_MS - (Date.now() - Number(rec.deletedAt || 0)));
        const hours = Math.max(1, Math.ceil(remainingMs / 3600000));
        const days = Math.ceil(hours / 24);
        const remaining = days >= 2 ? `noch ${days} Tage` : (days === 1 ? "noch 1 Tag" : `noch ${hours} Std.`);
        const typeLabel = (x.type === "event") ? "Termin" : "To-do";
        return `
          <div class="todo-trash-row">
            <div class="todo-trash-copy">
              <strong>${escapeHtml(x.text || typeLabel)}</strong>
              <small>${typeLabel} · ${remaining}</small>
            </div>
            <div class="todo-trash-actions">
              <button type="button" class="todo-trash-restore" data-id="${rec.trashId}" title="Wiederherstellen">↩</button>
              <button type="button" class="todo-trash-delete" data-id="${rec.trashId}" title="Endgültig löschen">×</button>
            </div>
          </div>`;
      }).join("")
    : `<div class="overview-empty">Papierkorb ist leer.</div>`;

  host.querySelectorAll(".todo-trash-restore").forEach(btn => {
    btn.addEventListener("click", () => {
      restoreTrashEntry(btn.dataset.id);
      renderTodoTrash();
    });
  });

  host.querySelectorAll(".todo-trash-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      markListItemDeleted("trashTombstones", id);
      state.trash = (state.trash || []).filter(x => x.trashId !== id);
      save();
      persistTopLevelDeletionImmediately("trash");
      renderTodoTrash();
    });
  });
}


(function hideLegacyOverviewTrash() {
  ["trashList","emptyTrashBtn"].forEach(id => {
    const el = document.querySelector("#" + id);
    if (!el) return;
    const section = el.closest("section, .overview-card, .card, details, .panel");
    if (section) section.style.display = "none";
    else el.style.display = "none";
  });
})();

(function ensureTodoTrashStyle() {
  if (document.querySelector("#todoTrashStyle")) return;
  const style = document.createElement("style");
  style.id = "todoTrashStyle";
  style.textContent = `
    .todo-trash-wrap{
      margin-top:18px;
    }
    .todo-trash-details{
      border-top:1px solid rgba(120,110,100,.18);
      padding-top:10px;
    }
    .todo-trash-details > summary{
      cursor:pointer;
      list-style:none;
      display:inline-flex;
      align-items:center;
      gap:6px;
      font-size:.88rem;
      font-weight:650;
      color:#746f69;
      user-select:none;
    }
    .todo-trash-details > summary::-webkit-details-marker{display:none}
    .todo-trash-list{
      display:grid;
      gap:7px;
      margin-top:9px;
    }
    .todo-trash-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:8px 10px;
      border:1px solid rgba(130,120,110,.14);
      border-radius:10px;
      background:rgba(250,248,245,.72);
    }
    .todo-trash-copy{
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width:0;
    }
    .todo-trash-copy strong{
      font-size:.88rem;
      font-weight:650;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .todo-trash-copy small{
      font-size:.72rem;
      color:#8a837c;
    }
    .todo-trash-actions{
      display:flex;
      gap:5px;
      flex:0 0 auto;
    }
    .todo-trash-actions button{
      border:0;
      background:transparent;
      cursor:pointer;
      font-size:1rem;
      padding:3px 5px;
      opacity:.76;
    }
    .todo-trash-actions button:hover{opacity:1}
  `;
  document.head.appendChild(style);
})();

function renderTodos() {
  const list = document.querySelector("#todoList");
  renderTodoTrash();

  /* V118: Suche in ALLEN To-do-/Termin-Ansichten verfügbar */
  const todoSearchVisible = true;

  const todoSearchPlaceholders = {
    all: "Alle Einträge suchen …",
    todo: "To-dos suchen …",
    event: "Termine suchen …",
    work: "Arbeit suchen …",
    private: "Privates suchen …",
    week: "Wochenplan-To-dos suchen …",
    newest: "Neueste Einträge suchen …",
    done: "Fertige To-dos suchen …"
  };

  const todoSearchBar = ensureCollectionSearchBar({
    anchor:list,
    id:"todoCollectionSearch",
    placeholder: todoSearchPlaceholders[todoFilter] || "To-dos & Termine suchen …",
    value:collectionSearchState.todos,
    visible:todoSearchVisible,
    onInput:value=>{
      collectionSearchState.todos=value;
      expandedTodoGroups.clear();
      renderTodos();
    }
  });

  if (!todoFilter) {
    if (list) {
      list.innerHTML = "";
      list.classList.add("todo-list-collapsed");
    }
    return;
  }

  list?.classList.remove("todo-list-collapsed");
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
    if (todoFilter === "weekplan") {
      todos = todos.filter(t =>
        (t.type || "todo") === "todo" &&
        t.priority === "weekplan"
      );
    }
    if (todoFilter === "latest") {
      todos = todos.filter(t => isNewEntry(t));
    }
  }

  if(todoSearchVisible){
    const totalBeforeSearch=todos.length;
    todos=todos.filter(t=>collectionSearchMatches(collectionSearchState.todos,[
      t.text,
      t.day,
      t.date,
      t.time,
      t.area,
      t.priority,
      t.eventCategory,
      Array.isArray(t.family) ? t.family.join(" ") : t.family,
      t.recurrence,
      t.type
    ]));

    const noun = todoFilter === "event"
      ? "Termine"
      : (todoFilter === "all" ? "Einträge" : "To-dos");

    updateCollectionSearchCount(
      todoSearchBar,
      todos.length,
      totalBeforeSearch,
      noun
    );
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
    important:"Wichtig", medium:"Mittel", low:"Kann warten", weekplan:"Wochenplan",
    work:"Arbeit", private:"Privat",
    today:"Heute", week:"Diese Woche", month:"Diesen Monat", later:"Irgendwann",
    todo:"To-do", event:"Termin"
  };

  const grouped = groupTodosByPerson(todos);
  list.innerHTML = grouped.map(([groupKey, groupItems]) => `
    <section class="todo-person-section grouped-family-section ${groupAccentClass(groupKey)}"
      style="${isSharedGroupKey(groupKey)
        ? `--group-border:${sharedGroupGradient(groupItems)}`
        : `--group-border:${groupKey === "general" ? generalColor() : (familyColor(groupKey) || "#c8c0ba")}`}">
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
document.querySelector("#eventPlingEnabled").checked = !!item.plingEnabled;
document.querySelector("#eventPlingMinutes").value = String(
  [5,10,15,20,30,45,60,90,120].includes(Number(item.plingMinutes))
    ? Number(item.plingMinutes)
    : 15
);
    
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
    markTodoDeleted(id);
    state.todos=state.todos.filter(t=>t.id!==id);
    if(editingTodoId===id)resetTodoEditor();
    save();
    persistTodoDeletionImmediately(id);
    renderAll();
    showUndo("To-do gelöscht",()=>restoreTrashEntry(trashId));
  }));
}

let archiveFilter = "all";
let archiveCategoryFilter = "all";

function renderArchive() {
  const list = document.querySelector("#archiveList");
  if(!list) return;

  const exerciseSearchBar=ensureCollectionSearchBar({
    anchor:list,
    id:"exerciseArchiveSearch",
    placeholder:"Übungen & Videos suchen …",
    value:collectionSearchState.exercises,
    visible:true,
    onInput:value=>{
      collectionSearchState.exercises=value;
      exerciseArchiveLimit=15;
      exerciseArchiveGroupLimit=6;
      renderArchive();
    }
  });

  let items = [...state.archive];

  // Zuerst den Hauptfilter anwenden.
  if (archiveFilter === "favorite") {
    items = items.filter(x => x.favorite);
  } else if (archiveFilter === "wanted") {
    items = getMostWantedEntries();
  } else if (["super","okay","nope"].includes(archiveFilter)) {
    items = items.filter(x => x.rating === archiveFilter);
  }

  // Kategorie IMMER zuletzt anwenden.
  // Vorher wurde sie bei "Most wanted" versehentlich wieder verworfen.
  if(archiveCategoryFilter!=="all"){
    items=items.filter(x=>(x.category||"other")===archiveCategoryFilter);
  }

  const totalBeforeSearch=items.length;
  items=items.filter(x=>collectionSearchMatches(collectionSearchState.exercises,[
    x.title,
    x.category,
    x.url,
    x.rating
  ]));
  updateCollectionSearchCount(exerciseSearchBar,items.length,totalBeforeSearch,"Übungen");

  const byNewest = arr => arr.sort((a,b) => new Date(b.lastDone || 0) - new Date(a.lastDone || 0));

  if (!items.length) {
    list.className = "archive-grid";
    list.innerHTML = '<div class="empty">Hier gibt es noch keine passenden Übungen.</div>';
    document.querySelector("#exerciseArchiveMore")?.remove();
    return;
  }

  if (archiveFilter === "all") {
    const groups = [
      ["unrated","☆ Noch bewerten", byNewest(items.filter(x => !x.rating))],
      ["super","✦ Gut", byNewest(items.filter(x => x.rating === "super"))],
      ["okay","○ Mittel", byNewest(items.filter(x => x.rating === "okay"))],
      ["nope","— Schlecht", byNewest(items.filter(x => x.rating === "nope"))]
    ];

    list.className = "archive-columns";
    list.innerHTML = groups.map(([key,label,group]) => {
      const shown=group.slice(0,exerciseArchiveGroupLimit);
      const remaining=Math.max(0,group.length-shown.length);
      return `
      <section class="archive-column ${key}">
        <div class="archive-column-head">${label}<span>${group.length}</span></div>
        <div class="archive-column-list">
          ${shown.length ? shown.map(archiveCardHtml).join("") : '<div class="column-empty">Noch keine Übungen</div>'}
        </div>
        ${remaining ? `<button type="button" class="secondary-btn archive-column-more" data-more="${remaining}">Weitere anzeigen (${remaining})</button>` : ""}
      </section>`;
    }).join("");

    list.querySelectorAll(".archive-column-more").forEach(btn=>{
      btn.addEventListener("click",()=>{
        exerciseArchiveGroupLimit+=6;
        renderArchive();
      });
    });
    document.querySelector("#exerciseArchiveMore")?.remove();
  } else {
    if (archiveFilter !== "wanted") byNewest(items);
    const shown=items.slice(0,exerciseArchiveLimit);
    list.className = "archive-grid";
    list.innerHTML = shown.map(archiveCardHtml).join("");
    ensureCollectionMoreButton(
      list,
      "exerciseArchiveMore",
      Math.max(0,items.length-shown.length),
      ()=>{
        exerciseArchiveLimit+=15;
        renderArchive();
      }
    );
  }

  bindArchiveButtons();
}


function archiveCardHtml(a) {
  const ratingLabel = {super:"✦ Gut", okay:"○ Mittel", nope:"— Schlecht"};
  const categoryLabel=({yoga:"Yoga",meditation:"Meditation",pain:"Schmerz",sport:"Sport",other:"Sonstiges"})[a.category||"other"];
  return `
    <article class="archive-card">
      ${a.thumbnail ? `
        <a class="archive-thumb-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(a.title)} öffnen">
          <img class="archive-thumb" src="${escapeHtml(a.thumbnail)}" alt="">
          <span class="archive-thumb-play">▶</span>
        </a>` : ""}

      <div class="archive-content">
        <div class="archive-title-row">
          <h3>${escapeHtml(a.title)}</h3>
          ${isMostWanted(a.url) ? '<span class="most-wanted-badge" title="Wird häufig genutzt">✦ Most wanted</span>' : ''}
        </div>

        <div class="archive-meta">
          <span>${ratingLabel[a.rating] || "☆ Noch nicht bewertet"}</span>
          <span>${escapeHtml(categoryLabel)}</span>
          <span>${a.timesDone || 0}× gemacht</span>
        </div>

        <div class="archive-actions">
          <button type="button" class="archive-action favorite-btn ${a.favorite?"active":""}" data-id="${a.id}">
            ${a.favorite ? "♥ Favorit" : "♡ Favorit"}
          </button>
          <button type="button" class="archive-action replan-btn" data-id="${a.id}">＋ Einplanen</button>
          <a class="archive-action archive-open-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">Video öffnen ↗</a>
          <button type="button" class="archive-action archive-delete-action delete-exercise-btn" data-id="${a.id}" title="Aus der Übersicht löschen">Löschen</button>
        </div>
      </div>
    </article>`;
}

document.querySelector("#archiveCategoryFilter")?.addEventListener("change",e=>{
  archiveCategoryFilter=e.currentTarget.value||"all";
  exerciseArchiveLimit=15;
  exerciseArchiveGroupLimit=6;
  renderArchive();
});

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
    const part=document.querySelector("#replanPart"); if(part) part.value="morning";
    document.querySelector("#replanDialog").showModal();
  }));

  document.querySelectorAll(".delete-exercise-btn").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const item = state.archive.find(a => a.id === id);
    if (!item) return;

    const shouldDelete = confirm(`„${item.title}“ wirklich aus Meine Übungen löschen?`);
    if (!shouldDelete) return;

    markListItemDeleted("archiveTombstones", id);
    state.archive = state.archive.filter(a => a.id !== id);
    save();
    persistTopLevelDeletionImmediately("archive");
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
const timetablePastelPalette = [
  "#f6e2df", "#e6efd9", "#e4e1f3", "#dcecf0",
  "#f4ead7", "#eadff0", "#dcebdc", "#f3dfe8",
  "#e8e3d5", "#dce6f2", "#f1e4cf", "#e3ece5"
];

const defaultPersonalTimetableSubjects = {
  mama: ["TW","GU","Deutsch","Mathematik","Sachunterricht","GLZ"],
  "1": ["Deutsch","Mathematik","Englisch","Biologie","Geografie","Geschichte","Physik","Chemie","Informatik","Religion","Bewegung & Sport","Werken"],
  "2": ["GU","Deutsch","Mathematik","Sachunterricht","REL","Bewegung & Sport","Werken"]
};

function ensurePersonalTimetableSubjects() {
  state.familySettings = state.familySettings || {};
  state.familySettings.timetableSubjects =
    state.familySettings.timetableSubjects &&
    typeof state.familySettings.timetableSubjects === "object"
      ? state.familySettings.timetableSubjects
      : {};

  ["mama","1","2"].forEach((id, personIndex) => {
    const current = state.familySettings.timetableSubjects[id];

    if (!Array.isArray(current) || !current.length) {
      const names = defaultPersonalTimetableSubjects[id] || [];
      state.familySettings.timetableSubjects[id] = names.map((name, index) => ({
        id: `subject-${id}-${index}-${String(name).toLowerCase().replace(/[^a-z0-9äöüß]+/gi,"-")}`,
        name,
        color: timetablePastelPalette[(index + personIndex * 2) % timetablePastelPalette.length]
      }));
      return;
    }

    state.familySettings.timetableSubjects[id] = current
      .map((entry, index) => {
        if (typeof entry === "string") {
          return {
            id: `subject-${id}-${index}-${entry.toLowerCase().replace(/[^a-z0-9äöüß]+/gi,"-")}`,
            name: entry.trim(),
            color: timetablePastelPalette[(index + personIndex * 2) % timetablePastelPalette.length]
          };
        }

        return {
          id: String(entry?.id || `subject-${id}-${index}`),
          name: String(entry?.name || "").trim(),
          color: /^#[0-9a-f]{6}$/i.test(String(entry?.color || ""))
            ? entry.color
            : timetablePastelPalette[(index + personIndex * 2) % timetablePastelPalette.length]
        };
      })
      .filter(entry => entry.name);
  });

  return state.familySettings.timetableSubjects;
}

function personalTimetableSubjectEntries(id) {
  const all = ensurePersonalTimetableSubjects();
  return Array.isArray(all[id]) ? all[id] : [];
}

function timetableSubjectColor(id, subject) {
  const name = String(subject || "").trim();
  if (!name) return "";
  return personalTimetableSubjectEntries(id)
    .find(entry => entry.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de"))
    ?.color || "";
}

function subjectOptionsFor(id){
  if (["mama","1","2"].includes(String(id))) {
    const names = personalTimetableSubjectEntries(String(id))
      .map(entry => entry.name)
      .filter(Boolean);
    return ["", ...new Set(names), "Anderes"];
  }

  return ["","Deutsch","Mathematik","Englisch","Biologie","Geografie","Geschichte","Physik","Chemie","Informatik","Religion","Bewegung & Sport","Werken","Anderes"];
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
                                            data-row="${r}"
                                            style="${current && timetableSubjectColor(id,current) ? `background:${timetableSubjectColor(id,current)};` : ""}">
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
                select.style.background = "";
            } else {
                custom.classList.add("hidden");
                custom.value = "";
                select.style.background = timetableSubjectColor(id, select.value) || "";
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
function timetableSubjectDisplay(subject,id){
  const s=String(subject||"").trim();
  if(!s) return "";

  const icon=String(id)==="2" ? schoolTimetableSubjectIcon(s) : "";
  return `${icon}<span class="tt-subject-label">${escapeHtml(s)}</span>`;
}

function timetableSubjectCellStyle(subject,id){
  const s=String(subject||"").trim();
  if(!s) return "";
  const color=timetableSubjectColor(String(id),s);
  return color ? ` style="--tt-cell-bg:${escapeHtml(color)}"` : "";
}

function showManualTimetable(id){
  localStorage.setItem("balanceProd.lastTimetablePerson", String(id));
 const c=timetablePerson(id),t=ensureManualTimetable(c),
    d=document.querySelector("#manualTimetableDialog"),
    title=document.querySelector("#manualTimetableDialogTitle"),
    out=document.querySelector("#manualTimetableDisplay");
  if(!d||!out)return;

  title.textContent=`${c.name||id} – Stundenplan`;

  let subtitle = d.querySelector(".tt-person-subtitle");
  if (!subtitle) {
    subtitle = document.createElement("div");
    subtitle.className = "tt-person-subtitle";
    title.insertAdjacentElement("afterend", subtitle);
  }
  subtitle.textContent =
    id === "1" ? "Hier siehst du Lou's Woche im Überblick." :
    id === "2" ? "Hier siehst du Fina's Woche im Überblick." :
    "Hier ist Mamas Woche auf einen Blick.";

  /* V51: In der linken Personenleiste nur die aktuell gewählte Person markieren. */
  d.querySelectorAll(".timetable-switch").forEach(btn => {
    const active = btn.dataset.person === String(id);
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  const dialogCard = d.querySelector(".timetable-dialog-card") || d.querySelector(".dialog-card");
  if (dialogCard) {
    dialogCard.classList.remove("tt-person-lou","tt-person-fina","tt-person-mama");
    dialogCard.classList.add(id === "1" ? "tt-person-lou" : id === "2" ? "tt-person-fina" : "tt-person-mama");
  }

out.innerHTML=`<div class="tt-table-wrap"><table class="tt-table tt-view-table ${id === "mama" ? "tt-mama" : id === "1" ? "tt-lou" : "tt-fina"}">
    <thead><tr><th>Zeit</th>${manualTimetableDayNames.map(x=>`<th>${x}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="tt-home-row tt-home-row-top"><th>⌂ Zu Hause bis</th>${manualTimetableDayKeys.map(day=>`<td>${escapeHtml(t.homeBy[day]||"–")}</td>`).join("")}</tr>
      ${t.times.map((tm,r)=>`<tr><th>${escapeHtml(tm.from)}–${escapeHtml(tm.to)}</th>${manualTimetableDayKeys.map(day=>{const subject=t.subjects[day][r]||"";return `<td class="tt-subject-display ${subject ? "has-subject" : "is-empty"}"${timetableSubjectCellStyle(subject,id)}>${timetableSubjectDisplay(subject,id)}</td>`;}).join("")}</tr>`).join("")}
    </tbody>
  </table></div>`;
  d.showModal();

  /* V100 – Stundenplanansicht:
     Am Handy beim Öffnen automatisch den aktuellen Wochentag zeigen.
     Gilt identisch für Mama, Lou und Fina, weil alle drei dieselbe
     showManualTimetable()-Ansicht verwenden.
     Samstag/Sonntag: Montag zeigen, da der Stundenplan nur Mo–Fr enthält. */
  if (window.matchMedia("(max-width: 700px)").matches) {
    requestAnimationFrame(() => {
      const wrap = out.querySelector(".tt-table-wrap");
      const table = out.querySelector(".tt-view-table");
      if (!wrap || !table) return;

      const jsDay = new Date().getDay(); // So=0, Mo=1 ... Sa=6
      const timetableDayIndex =
        jsDay >= 1 && jsDay <= 5
          ? jsDay - 1
          : 0; // Wochenende -> Montag

      /* Spalte 1 ist "Zeit", danach Mo–Fr. */
      const targetHeader =
        table.querySelector(`thead th:nth-child(${timetableDayIndex + 2})`);

      if (!targetHeader) return;

      /* Die Zeitspalte links als Orientierung sichtbar lassen. */
      const firstHeader = table.querySelector("thead th:first-child");
      const firstColumnWidth = firstHeader?.offsetWidth || 70;
      const targetLeft = Math.max(
        0,
        targetHeader.offsetLeft - firstColumnWidth - 6
      );

      wrap.scrollLeft = targetLeft;
    });
  }
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


function youtubeVideoId(url){
  try{
    const u=new URL(url);
    const host=u.hostname.replace(/^www\./,"").toLowerCase();
    if(host==="youtu.be"){
      return u.pathname.split("/").filter(Boolean)[0] || "";
    }
    if(host==="youtube.com" || host==="m.youtube.com"){
      if(u.pathname==="/watch") return u.searchParams.get("v") || "";
      const parts=u.pathname.split("/").filter(Boolean);
      const idx=parts.findIndex(x=>["shorts","embed","live"].includes(x));
      if(idx>=0 && parts[idx+1]) return parts[idx+1];
    }
  }catch(e){}
  return "";
}

function youtubeThumbUrl(url){
  const id=youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg` : "";
}

function renderSchool(){
  ["1","2"].forEach(id=>{
    const c=state.school.children[id], n=document.querySelector(`#schoolName${id}`);
    if(n && document.activeElement!==n)n.value=c.name||(id === "1" ? "Lou" : "Fina");
    const te=document.querySelector(`#schoolTasks${id}`),
          le=document.querySelector(`#schoolLinks${id}`),
          fe=document.querySelector(`#schoolFinds${id}`);
    if(!te||!le)return;
    ensureManualTimetable(c);
    const manualViewBtn = document.querySelector(`#manualTimetableViewBtn${id}`);
    if (manualViewBtn) manualViewBtn.classList.toggle("hidden", !hasManualTimetable(c));
    const tasks=[...c.tasks].sort((a,b)=>(a.done-b.done)||((a.due||"9999").localeCompare(b.due||"9999")));
    te.innerHTML=tasks.length?tasks.map(t=>`<div class="school-task ${t.done?"done":""}">
      <button class="school-check child-symbol-check ${t.done?"done":""}" data-child="${id}" data-id="${t.id}" type="button" aria-label="${t.done ? "Erledigt" : "Als erledigt markieren"}"><span class="child-symbol-glyph">${schoolTaskIcon(t,id)}</span>${t.done ? `<span class="child-symbol-done">✓</span>` : ""}</button>
      <div><div class="school-task-text">${escapeHtml(t.text)}</div><div class="school-meta"><span>${{homework:"☀ Hausübung",test:"✎ Test",bring:"♥ Mitbringen",appointment:"○ Termin",other:"✦ Schule"}[t.type] || "✦ Schule"}</span>${t.subject?`<span>${escapeHtml(t.subject)}</span>`:""}${t.due?`<span>bis ${parseLocalDate(t.due).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"})}</span>`:""}</div></div>
      <button class="school-del" data-kind="task" data-child="${id}" data-id="${t.id}">×</button></div>`).join(""):'<div class="school-empty">Gerade ist hier nichts offen. 🌿</div>';
    le.innerHTML=c.links.length?c.links.map(x=>`<div class="school-link"><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.name)}</a><button class="school-del" data-kind="link" data-child="${id}" data-id="${x.id}">×</button></div>`).join(""):'<span class="school-empty-inline">Noch keine Lernlinks hinterlegt.</span>';
    if(fe){
      const categoryMeta={
        ideen:["✨","Ideen"],
        lesen:["📖","Lesen"],
        musik:["🎧","Musik & Video"],
        hobby:["♡","Hobby"],
        sport:["🩰","Sport"],
        sonstiges:["🌿","Sonstiges"]
      };
      const ratingMeta={
        gut:["♡","Gut",0],
        mittel:["○","Mittel",1],
        schlecht:["–","Schlecht",2]
      };
      const searchEl=document.querySelector(`#schoolFindSearch${id}`);
      const filterEl=document.querySelector(`#schoolFindFilter${id}`);
      const q=(searchEl?.value||"").trim().toLowerCase();
      const categoryFilter=filterEl?.value || "all";
      const allFinds=Array.isArray(c.interestLinks)?c.interestLinks:[];
      const finds=allFinds.filter(x=>{
        if(categoryFilter!=="all" && (x.category||"sonstiges")!==categoryFilter) return false;
        if(!q) return true;
        let domain="";
        try{ domain=new URL(x.url).hostname.replace(/^www\./,""); }catch{}
        const category=(categoryMeta[x.category||"sonstiges"]||categoryMeta.sonstiges)[1];
        const rating=(ratingMeta[x.rating||"mittel"]||ratingMeta.mittel)[1];
        return [x.name,domain,category,rating].join(" ").toLowerCase().includes(q);
      });
      fe.innerHTML=finds.length
        ? Object.entries(
            finds.reduce((groups,x)=>{
              const key=x.category || "sonstiges";
              (groups[key] ||= []).push(x);
              return groups;
            },{})
          ).map(([category,items])=>{
            const meta=categoryMeta[category] || categoryMeta.sonstiges;
            items=[...items].sort((a,b)=>{
              const ar=(ratingMeta[a.rating||"mittel"]||ratingMeta.mittel)[2];
              const br=(ratingMeta[b.rating||"mittel"]||ratingMeta.mittel)[2];
              return ar-br || (b.createdAt||0)-(a.createdAt||0);
            });
            return `<section class="school-find-group">
              <div class="school-find-group-title"><span>${meta[0]}</span><strong>${meta[1]}</strong></div>
              <div class="school-find-group-items">
                ${items.map(x=>{
                  const thumb=youtubeThumbUrl(x.url);
                  let domain="";
                  try{domain=new URL(x.url).hostname.replace(/^www\./,"")}catch{}
                  const rm=ratingMeta[x.rating||"mittel"]||ratingMeta.mittel;
                  const displayName=(x.name||"").trim() || domain || "Fundstück";
                  return `<div class="school-find ${thumb ? "school-find-youtube" : ""}" data-rating="${escapeHtml(x.rating||"mittel")}">
                    <a href="${escapeHtml(x.url)}" target="_blank" rel="noopener" class="school-find-main">
                      <span class="school-find-copy">
                        <span class="school-find-name">${escapeHtml(displayName)}</span>
                        <span class="school-find-subline">
                          <span class="school-find-rating rating-${escapeHtml(x.rating||"mittel")}">${rm[0]} ${rm[1]}</span>
                          ${domain ? `<span class="school-find-domain">${escapeHtml(domain)}</span>` : ""}
                        </span>
                      </span>
                      ${thumb ? `<span class="school-find-thumb-wrap">
                        <img class="school-find-thumb"
                             src="${escapeHtml(thumb)}"
                             alt=""
                             loading="lazy"
                             referrerpolicy="no-referrer">
                        <span class="school-find-play">▶</span>
                      </span>` : ""}
                    </a>
                    <div class="school-find-actions">
                      <button class="school-find-edit" data-child="${id}" data-id="${x.id}" type="button" aria-label="Fundstück bearbeiten">✎</button>
                      <button class="school-del" data-kind="find" data-child="${id}" data-id="${x.id}" aria-label="Fundstück löschen">×</button>
                    </div>
                  </div>
                  <div class="school-find-editor hidden" data-child="${id}" data-id="${x.id}">
                    <input class="school-find-edit-name" value="${escapeHtml(x.name||"")}" placeholder="Titel – optional">
                    <input class="school-find-edit-url" value="${escapeHtml(x.url||"")}" placeholder="Link">
                    <select class="school-find-edit-category">
                      ${Object.entries(categoryMeta).map(([key,val])=>`<option value="${key}" ${key===(x.category||"sonstiges")?"selected":""}>${val[0]} ${val[1]}</option>`).join("")}
                    </select>
                    <select class="school-find-edit-rating">
                      <option value="gut" ${x.rating==="gut"?"selected":""}>♡ Gut</option>
                      <option value="mittel" ${(x.rating||"mittel")==="mittel"?"selected":""}>○ Mittel</option>
                      <option value="schlecht" ${x.rating==="schlecht"?"selected":""}>– Schlecht</option>
                    </select>
                    <button class="secondary-btn school-find-save-edit" data-child="${id}" data-id="${x.id}" type="button">Speichern</button>
                    <button class="school-find-cancel-edit" data-child="${id}" data-id="${x.id}" type="button">×</button>
                  </div>`;
                }).join("")}
              </div>
            </section>`;
          }).join("")
        : `<div class="school-finds-empty">${q ? "Dazu wurde nichts gefunden." : "Noch nichts gesammelt. Wenn dir etwas gefällt, kannst du es hier für später merken. ✨"}</div>`;
    }
    const spotifyInput=document.querySelector(`#schoolSpotifyUrl${id}`);
    const spotifyOpen=document.querySelector(`#schoolSpotifyOpen${id}`);
    const spotifyEdit=document.querySelector(`#schoolSpotifyEdit${id}`);
    if(spotifyInput && document.activeElement!==spotifyInput) spotifyInput.value=c.spotifyUrl||"";
    if(spotifyOpen){
      if(c.spotifyUrl){
        spotifyOpen.href=c.spotifyUrl;
        spotifyOpen.classList.remove("hidden");
        if(spotifyEdit) spotifyEdit.textContent="ändern";
      }else{
        spotifyOpen.removeAttribute("href");
        spotifyOpen.classList.add("hidden");
        if(spotifyEdit) spotifyEdit.textContent="+ Spotify-Link";
      }
    }
    const ti=document.querySelector(`#timetableUrl${id}`),to=document.querySelector(`#timetableOpen${id}`);
    if(ti && document.activeElement!==ti) ti.value=c.timetableUrl||"";
    if(to){
      if(c.timetableUrl){to.href=c.timetableUrl;to.classList.remove("hidden");}
      else{to.removeAttribute("href");to.classList.add("hidden");}
    }
  });
  document.querySelectorAll(".school-check").forEach(x=>x.addEventListener("click",e=>{
    const c=state.school.children[e.currentTarget.dataset.child],t=c.tasks.find(z=>z.id===e.currentTarget.dataset.id); if(!t)return;
    const was=t.done;
    t.done=!t.done;
    save();
    renderAll();
    if(!was && t.done) showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(c)));
  }));
  document.querySelectorAll(".school-del").forEach(x=>x.addEventListener("click",e=>{
    const d=e.currentTarget.dataset,c=state.school.children[d.child];

    if(d.kind==="task"){
      c.deletedTaskIds=Array.isArray(c.deletedTaskIds)?c.deletedTaskIds:[];
      if(!c.deletedTaskIds.includes(d.id)) c.deletedTaskIds.push(d.id);
      c.tasks=c.tasks.filter(z=>z.id!==d.id);
    }else if(d.kind==="find"){
      c.interestLinks=(c.interestLinks||[]).filter(z=>z.id!==d.id);
    }else{
      c.deletedLinkIds=Array.isArray(c.deletedLinkIds)?c.deletedLinkIds:[];
      if(!c.deletedLinkIds.includes(d.id)) c.deletedLinkIds.push(d.id);
      c.links=c.links.filter(z=>z.id!==d.id);
    }

    save();
    renderSchool();
  }));
}
function addSchoolTask(id){
  const t=document.querySelector(`#schoolTask${id}`);
  const s=document.querySelector(`#schoolSubject${id}`);
  const so=document.querySelector(`#schoolSubjectOther${id}`);
  const d=document.querySelector(`#schoolDue${id}`);
  const y=document.querySelector(`#schoolType${id}`);
  const iconSelect=document.querySelector(`#schoolTaskIcon${id}`);
  if(!t.value.trim())return;

  const subject = s.value === "other" ? so.value.trim() : s.value;
  const taskIcon = iconSelect?.value || schoolTaskDefaultIcon(id);

  state.school.children[id].tasks.push({
    id:uid(),
    text:t.value.trim(),
    subject,
    due:d.value,
    type:y.value,
    icon:taskIcon,
    done:false,
    createdAt:Date.now(),
    updatedAt:Date.now()
  });

  t.value="";
  s.value="";
  so.value="";
  so.classList.add("hidden");
  d.value="";
  y.value="homework";
  if(iconSelect){
    const defaultIcon=schoolTaskDefaultIcon(id);
    iconSelect.innerHTML=schoolTaskIconOptions(defaultIcon);
    iconSelect.value=defaultIcon;
    delete iconSelect.dataset.userChanged;
  }
  save();
  renderSchool();
}
function addSchoolLink(id){
  const n=document.querySelector(`#schoolLinkName${id}`),u=document.querySelector(`#schoolLinkUrl${id}`);let url=u.value.trim();
  if(!n.value.trim()||!url)return;if(!/^https?:\/\//i.test(url))url="https://"+url;
  state.school.children[id].links.push({id:uid(),name:n.value.trim(),url,createdAt:Date.now(),updatedAt:Date.now()});n.value="";u.value="";save();renderSchool();
}

function addSchoolFind(id){
  const n=document.querySelector(`#schoolFindName${id}`);
  const u=document.querySelector(`#schoolFindUrl${id}`);
  const c=document.querySelector(`#schoolFindCategory${id}`);
  const r=document.querySelector(`#schoolFindRating${id}`);
  if(!n || !u) return;

  let url=u.value.trim();
  const name=n.value.trim();
  if(!url) return;
  if(!/^https?:\/\//i.test(url)) url="https://"+url;

  const child=state.school.children[id];
  child.interestLinks=Array.isArray(child.interestLinks)?child.interestLinks:[];
  child.interestLinks.push({
    id:uid(),
    name,
    url,
    category:c?.value || "sonstiges",
    rating:r?.value || "mittel",
    createdAt:Date.now()
  });

  n.value="";
  u.value="";
  if(c) c.value="ideen";
  if(r) r.value="mittel";
  save();
  renderSchool();
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
document.querySelectorAll(".add-school-find").forEach(b=>b.addEventListener("click",e=>addSchoolFind(e.currentTarget.dataset.child)));
document.querySelectorAll(".school-find-search").forEach(input=>input.addEventListener("input",e=>{
  const id=e.currentTarget.dataset.child;
  renderSchool();
  const restored=document.querySelector(`#schoolFindSearch${id}`);
  if(restored){restored.focus();restored.setSelectionRange(restored.value.length,restored.value.length);}
}));
document.querySelectorAll(".school-find-filter").forEach(select=>select.addEventListener("change",e=>{
  const id=e.currentTarget.dataset.child;
  const value=e.currentTarget.value;
  renderSchool();
  const restored=document.querySelector(`#schoolFindFilter${id}`);
  if(restored) restored.value=value;
}));

document.addEventListener("click",e=>{
  const edit=e.target.closest(".school-find-edit");
  if(edit){
    const editor=document.querySelector(`.school-find-editor[data-child="${edit.dataset.child}"][data-id="${edit.dataset.id}"]`);
    document.querySelectorAll(".school-find-editor").forEach(x=>{ if(x!==editor) x.classList.add("hidden"); });
    editor?.classList.toggle("hidden");
    return;
  }

  const cancel=e.target.closest(".school-find-cancel-edit");
  if(cancel){
    document.querySelector(`.school-find-editor[data-child="${cancel.dataset.child}"][data-id="${cancel.dataset.id}"]`)?.classList.add("hidden");
    return;
  }

  const saveBtn=e.target.closest(".school-find-save-edit");
  if(saveBtn){
    const id=saveBtn.dataset.child;
    const findId=saveBtn.dataset.id;
    const editor=document.querySelector(`.school-find-editor[data-child="${id}"][data-id="${findId}"]`);
    const item=state.school.children[id]?.interestLinks?.find(x=>x.id===findId);
    if(!editor || !item) return;

    let url=(editor.querySelector(".school-find-edit-url")?.value||"").trim();
    if(!url) return;
    if(!/^https?:\/\//i.test(url)) url="https://"+url;

    item.name=(editor.querySelector(".school-find-edit-name")?.value||"").trim();
    item.url=url;
    item.category=editor.querySelector(".school-find-edit-category")?.value || "sonstiges";
    item.rating=editor.querySelector(".school-find-edit-rating")?.value || "mittel";
    item.updatedAt=Date.now();
    save();
    renderSchool();
  }
});

document.querySelectorAll(".school-spotify-edit").forEach(b=>b.addEventListener("click",e=>{
  const id=e.currentTarget.id.replace("schoolSpotifyEdit","");
  document.querySelector(`#schoolSpotifyEditor${id}`)?.classList.toggle("hidden");
  document.querySelector(`#schoolSpotifyUrl${id}`)?.focus();
}));
document.querySelectorAll(".school-spotify-cancel").forEach(b=>b.addEventListener("click",e=>{
  document.querySelector(`#schoolSpotifyEditor${e.currentTarget.dataset.child}`)?.classList.add("hidden");
}));
document.querySelectorAll(".save-school-spotify").forEach(b=>b.addEventListener("click",e=>{
  const id=e.currentTarget.dataset.child;
  const input=document.querySelector(`#schoolSpotifyUrl${id}`);
  let url=(input?.value||"").trim();
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  state.school.children[id].spotifyUrl=url;
  save();
  renderSchool();
  document.querySelector(`#schoolSpotifyEditor${id}`)?.classList.add("hidden");
}));
["1","2"].forEach(id=>document.querySelector(`#schoolName${id}`)?.addEventListener("change",e=>{state.school.children[id].name=e.currentTarget.value.trim()||(id === "1" ? "Lou" : "Fina");save();}));

document.querySelectorAll(".save-timetable").forEach(b=>b.addEventListener("click",e=>{
  const id=e.currentTarget.dataset.child,input=document.querySelector(`#timetableUrl${id}`);
  let url=input.value.trim();
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  state.school.children[id].timetableUrl=url;
  save();renderSchool();
}));

/* CODE-AUDIT: frühere, überschriebene Definition von bindSchoolYearSetting entfernt. */

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
    const person = btn.dataset.person;
    if (!["1","2","mama"].includes(person)) return;
    localStorage.setItem("balanceProd.lastTimetablePerson", person);
    showManualTimetable(person);
  });
});
// Stundenplan-Auswahl auf der Wochenplan-Seite
const familyTimetableDialog = document.querySelector("#familyTimetableDialog");

document.querySelector("#openFamilyTimetableBtn")?.addEventListener("click", () => {
  const lastPerson = localStorage.getItem("balanceProd.lastTimetablePerson") || "1";
  showManualTimetable(["1","2","mama"].includes(lastPerson) ? lastPerson : "1");
});

document.querySelector("#closeFamilyTimetableDialog")?.addEventListener("click", () => {
  familyTimetableDialog?.close();
});




// ===== WERKRAUM – ROUTINEN =====

// Routinen standardmäßig geschlossen – analog zu den anderen Klappbereichen.
document.querySelector("#toggleRoutinePanelBtn")?.addEventListener("click",()=>{
  const btn=document.querySelector("#toggleRoutinePanelBtn");
  const body=document.querySelector("#workroomRoutineBody");
  if(!btn || !body) return;
  const open=body.classList.toggle("hidden")===false;
  btn.setAttribute("aria-expanded",String(open));
  btn.classList.toggle("open",open);
  if(open) renderRoutines();
});


document.querySelectorAll(".routine-idea-check").forEach(btn=>btn.addEventListener("click",e=>{
  e.preventDefault();
  e.stopPropagation();

  const ideaKey=btn.dataset.routineIdeaCheck;
  if(!ideaKey) return;

  const routines=ensureWorkroomRoutines();
  const storageKey=routineIdeaCheckKey(ideaKey);
  routines.inspirationChecks[storageKey]=!routines.inspirationChecks[storageKey];

  save();
  renderRoutineIdeaChecks();
  renderRoutineAreaTasks();
}));

(function scheduleRoutineIdeaDailyReset(){
  const now=new Date();
  const next=new Date(now);
  next.setHours(3,0,0,0);
  if(next<=now) next.setDate(next.getDate()+1);
  window.setTimeout(()=>{
    cleanupRoutineIdeaChecks();
    save();
    renderRoutineIdeaChecks();
    scheduleRoutineIdeaDailyReset();
  },Math.max(1000,next-now));
})()

document.addEventListener("click",e=>{
  const row=e.target.closest(".routine-step");
  if(row){
    e.preventDefault();
    e.stopPropagation();
    const routines=ensureWorkroomRoutines();
    const key=`${routineDayKey()}__step__${row.dataset.routineCard}__${row.dataset.routineStep}`;
    routines.inspirationChecks[key]=!routines.inspirationChecks[key];
    cleanupRoutineIdeaChecks();
    save();
    renderRoutineIdeaChecks();
    return;
  }

  const quality=e.target.closest(".routine-quality-cloud button[data-quality]");
  if(quality){
    e.preventDefault();
    e.stopPropagation();
    const group=quality.closest(".routine-quality-cloud");
    const routines=ensureWorkroomRoutines();
    const key=`${routineDayKey()}__quality__${group.dataset.routineQualityCard}`;
    routines.inspirationChecks[key]=routines.inspirationChecks[key]===quality.dataset.quality ? "" : quality.dataset.quality;
    cleanupRoutineIdeaChecks();
    save();
    renderRoutineIdeaChecks();
  }
});
;



let activeRoutineWeekOffset = 0;
let editingRoutineId = null;

const routineCategoryMeta = {
  none:["","Kein Video"],
  yoga:["◌","Yoga"],
  meditation:["◇","Meditation"],
  pain:["∿","Schmerz"],
  sport:["△","Sport"],
  other:["·","Sonstiges"]
};

function ensureWorkroomRoutines(){
  state.workroom = normalizeWorkroom(state.workroom);
  state.workroom.routines = state.workroom.routines || {items:[],completions:{}};
  state.workroom.routines.items = Array.isArray(state.workroom.routines.items) ? state.workroom.routines.items : [];
  state.workroom.routines.completions = state.workroom.routines.completions && typeof state.workroom.routines.completions==="object"
    ? state.workroom.routines.completions
    : {};
  state.workroom.routines.inspirationChecks = state.workroom.routines.inspirationChecks && typeof state.workroom.routines.inspirationChecks==="object"
    ? state.workroom.routines.inspirationChecks
    : {};
  state.workroom.routines.tombstones = state.workroom.routines.tombstones && typeof state.workroom.routines.tombstones==="object"
    ? state.workroom.routines.tombstones
    : {};
  return state.workroom.routines;
}

function tombstoneRoutineItem(id){
  if(!id) return;
  const routines=ensureWorkroomRoutines();
  routines.tombstones=routines.tombstones||{};
  routines.tombstones[id]=Date.now();
}

function routineWeekKey(offset=0){
  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+Number(offset||0)*7);
  return dateKey(monday);
}

function routineDayKey(now=new Date()){
  const shifted=new Date(now);
  shifted.setHours(shifted.getHours()-3);
  return dateKey(shifted);
}
function routineIdeaCheckKey(ideaKey,offset=activeRoutineWeekOffset){
  if(Number(offset||0)!==0) return `${routineWeekKey(offset)}__${ideaKey}`;
  return `${routineDayKey()}__${ideaKey}`;
}
function cleanupRoutineIdeaChecks(){
  const routines=ensureWorkroomRoutines();
  const keepPrefix=`${routineDayKey()}__`;
  Object.keys(routines.inspirationChecks||{}).forEach(key=>{
    if(/^\d{4}-\d{2}-\d{2}__/.test(key) && !key.startsWith(keepPrefix)){
      delete routines.inspirationChecks[key];
    }
  });
}

function renderRoutineIdeaChecks(){
  const routines=ensureWorkroomRoutines();
  cleanupRoutineIdeaChecks();
  document.querySelectorAll(".routine-idea-card").forEach(card=>{
    const key=card.dataset.routineIdea;
    if(!key) return;
    const checked=!!routines.inspirationChecks[routineIdeaCheckKey(key)];
    card.classList.toggle("is-checked",checked);
    const btn=card.querySelector(".routine-idea-check");
    if(btn){
      btn.dataset.checked=checked?"1":"0";
      btn.setAttribute("aria-pressed",String(checked));
      btn.title=checked?"Für heute erledigt":"Für heute abhaken";
    }
  });

  document.querySelectorAll(".routine-step").forEach(row=>{
    const card=row.dataset.routineCard;
    const step=row.dataset.routineStep;
    const checked=!!routines.inspirationChecks[`${routineDayKey()}__step__${card}__${step}`];
    row.classList.toggle("is-checked",checked);
    row.setAttribute("aria-pressed",String(checked));
    const mark=row.querySelector(".routine-step-mark");
    if(mark) mark.textContent=checked?"✓":"◇";
  });

  document.querySelectorAll(".routine-quality-cloud").forEach(group=>{
    const card=group.dataset.routineQualityCard;
    const selected=routines.inspirationChecks[`${routineDayKey()}__quality__${card}`] || "";
    group.querySelectorAll("button[data-quality]").forEach(btn=>{
      const active=btn.dataset.quality===selected;
      btn.classList.toggle("is-selected",active);
      btn.setAttribute("aria-pressed",String(active));
    });
  });
}

function routineAppliesToWeek(item,weekKey){
  return !!item.sticky || item.weekKey===weekKey;
}

function routineAppliesToDate(item,date){
  if(item.day==="daily" || !item.day) return true;
  const names=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  return names[date.getDay()]===item.day;
}

function routineCompletionKey(itemId,date){
  return `${itemId}__${dateKey(date)}`;
}

function routineCompletion(itemId,date){
  return ensureWorkroomRoutines().completions[routineCompletionKey(itemId,date)] || null;
}

function setRoutineCompletion(itemId,date,patch){
  const routines=ensureWorkroomRoutines();
  const key=routineCompletionKey(itemId,date);
  const current=routines.completions[key] || {};
  routines.completions[key]={...current,...patch,updatedAt:Date.now()};
}

function routineVideoTitle(item){
  return item.title || "Routinevideo";
}

function routineArchiveFromItem(item,rating,{countDone=false}={}){
  if(!item.url) return null;
  if(!Array.isArray(state.archive)) state.archive=[];
  let normalizedItemUrl="";
  try{ normalizedItemUrl=normalizeUrl(item.url); }catch{ normalizedItemUrl=String(item.url||"").trim(); }
  let entry=state.archive.find(a=>{
    try{return normalizeUrl(a.url)===normalizedItemUrl;}catch{return String(a.url||"").trim()===normalizedItemUrl;}
  });
  if(!entry){
    entry={
      id:uid(),
      title:routineVideoTitle(item),
      url:item.url,
      thumbnail:thumbnailFor(item.url),
      timesDone:0,
      rating:null,
      favorite:false,
      lastDone:null,
      category:item.category || "other",
      createdAt:Date.now(),
      updatedAt:Date.now()
    };
    state.archive.push(entry);
  }
  entry.title=routineVideoTitle(item);
  entry.thumbnail=entry.thumbnail || thumbnailFor(item.url);
  entry.category=item.category || entry.category || "other";
  entry.planned=false;
  if(rating) entry.rating=rating;
  if(countDone){
    entry.timesDone=(entry.timesDone||0)+1;
    entry.lastDone=new Date().toISOString();
  }
  entry.updatedAt=Date.now();
  return entry;
}

function resetRoutineEditor(){
  editingRoutineId=null;
  const ids=["routineTitle","routineUrl"];
  ids.forEach(id=>{const el=document.querySelector(`#${id}`);if(el)el.value="";});
  const part=document.querySelector("#routinePart"); if(part) part.value="morning";
  const cat=document.querySelector("#routineCategory"); if(cat) cat.value="none";
  const day=document.querySelector("#routineDay"); if(day) day.value="daily";
  const sticky=document.querySelector("#routineSticky"); if(sticky) sticky.checked=false;
  const saveBtn=document.querySelector("#saveRoutineBtn"); if(saveBtn) saveBtn.textContent="+ Routinepunkt";
  document.querySelector("#cancelRoutineEditBtn")?.classList.add("hidden");
}



function routineAreaDate(item,offset=activeRoutineWeekOffset){
  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+Number(offset||0)*7);

  if(item?.day && item.day!=="daily"){
    const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
    const di=names.indexOf(item.day);
    const date=new Date(monday);
    if(di>=0) date.setDate(monday.getDate()+di);
    return date;
  }

  // Bei einer täglichen Routine in der aktuellen Woche ist "heute"
  // der relevante Abschluss-Tag; in einer Zukunftswoche nehmen wir Montag.
  if(Number(offset||0)===0) return new Date();
  return new Date(monday);
}

function renderRoutineAreaTasks(){
  const routines=ensureWorkroomRoutines();
  const weekKey=routineWeekKey(activeRoutineWeekOffset);
  const partLabel={morning:"Morgen",school:"Schulalltag",afterschool:"Nach der Schule",evening:"Abend",other:"Sonstiges"};

  document.querySelectorAll("[data-routine-area-tasks]").forEach(host=>{
    const part=host.dataset.routineAreaTasks;
    const today=new Date();
    const todayWeekKey=dateKey(getMonday(today));
    const items=routines.items
      .filter(item=>(item.part||"morning")===part)
      // Oben wird ausgeführt, nicht geplant: nur HEUTE fällige Punkte.
      .filter(item=>activeRoutineWeekOffset===0)
      .filter(item=>routineAppliesToWeek(item,todayWeekKey))
      .filter(item=>routineAppliesToDate(item,today))
      // Erledigte Tagesdurchführungen verschwinden oben,
      // die Wochenplanung unten bleibt dabei unangetastet.
      .filter(item=>{
        const c=routineCompletion(item.id,today);
        if(!c?.done) return true;
        if(item.url && !c.rating) return true; // wartet noch auf Bewertung
        return false;
      })
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    if(!items.length){
      host.innerHTML="";
      host.classList.add("hidden");
      return;
    }

    host.classList.remove("hidden");
    host.innerHTML=`
      <div class="routine-area-task-head">
        <span>Heute</span>
      </div>
      <div class="routine-area-task-list">
        ${items.map(item=>{
          const thumb=item.url ? thumbnailFor(item.url) : "";
          const category=routineCategoryMeta[item.category||"none"]||routineCategoryMeta.other;
          const completionDate=new Date();
          const completion=routineCompletion(item.id,completionDate);
          const awaiting=!!(item.url && completion?.done && !completion?.rating);

          return `<div class="routine-area-task ${awaiting?"awaiting-rating":""}" data-routine-area-id="${item.id}">
            <button class="routine-area-check" type="button" data-id="${item.id}" aria-label="${item.url?"Video erledigen und bewerten":"Routinepunkt erledigen"}"><span>${awaiting?"✓":"◇"}</span></button>
            ${thumb?`<a class="routine-area-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"><span>▶</span></a>`:""}
            <div class="routine-area-task-copy">
              <strong>${escapeHtml(item.title||"Routinepunkt")}</strong>
              <small>${item.day==="daily"||!item.day?"täglich":escapeHtml(item.day)}${item.url?` · ${category[1]}`:""}</small>
            </div>
            <div class="routine-area-task-actions">
              ${item.url?`<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Video</a>`:""}
              <button class="routine-area-edit" data-id="${item.id}" type="button" title="Bearbeiten" aria-label="Bearbeiten"><svg class="routine-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l3.5-.8L18 8.7a1.7 1.7 0 0 0 0-2.4l-.3-.3a1.7 1.7 0 0 0-2.4 0L5.8 15.5z"/><path d="M13.8 7.5l2.7 2.7"/></svg></button>
              <button class="routine-area-delete" data-id="${item.id}" type="button" title="Löschen" aria-label="Löschen"><svg class="routine-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"/><path d="M9.2 7V5h5.6v2"/><path d="M7.5 7l.8 11h7.4l.8-11"/><path d="M10.3 10.2v4.9M13.7 10.2v4.9"/></svg></button>
            </div>
            ${awaiting?`<div class="routine-area-rating">
              <span class="routine-rating-label">Wie war es?</span>
              <button type="button" data-rating="super" data-id="${item.id}" data-date="${dateKey(completionDate)}">✦ Gut</button>
              <button type="button" data-rating="okay" data-id="${item.id}" data-date="${dateKey(completionDate)}">○ Mittel</button>
              <button type="button" data-rating="nope" data-id="${item.id}" data-date="${dateKey(completionDate)}">— Schlecht</button>
            </div>`:""}
          </div>`;
        }).join("")}
      </div>`;
  });

  document.querySelectorAll(".routine-area-check").forEach(btn=>btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();

    const item=ensureWorkroomRoutines().items.find(x=>x.id===btn.dataset.id);
    if(!item) return;

    const date=new Date();
    const current=routineCompletion(item.id,date);

    if(item.url){
      // 1. Klick = erledigt und Bewertung dauerhaft sichtbar.
      // Ein weiterer Klick nimmt den Status wieder zurück.
      const willAwait=!(current?.done && !current?.rating);
      setRoutineCompletion(item.id,date,{
        done:willAwait,
        rating:null,
        archived:!!current?.archived
      });
      save();
      renderRoutineAreaTasks();
    }else{
      // Nur die heutige Durchführung erledigen.
      // Der Plan selbst bleibt unten in der Wochenübersicht erhalten.
      setRoutineCompletion(item.id,date,{done:true});
      save();
      renderRoutineAreaTasks();
      renderRoutines();
      renderWorkroomWeekOverview(activeWorkroomWeekOffset);
    }
  }));

  // Bearbeiten muss direkt hier gebunden werden, weil die alte untere
  // Routinenliste bei normalen Bereichen leer ist.
  document.querySelectorAll(".routine-area-edit").forEach(btn=>btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();

    const item=ensureWorkroomRoutines().items.find(x=>x.id===btn.dataset.id);
    if(!item) return;

    editingRoutineId=item.id;
    document.querySelector("#routinePart").value=item.part||"morning";
    document.querySelector("#routineTitle").value=item.title||"";
    document.querySelector("#routineUrl").value=item.url||"";
    document.querySelector("#routineCategory").value=item.category||"none";
    document.querySelector("#routineDay").value=item.day||"daily";
    document.querySelector("#routineSticky").checked=!!item.sticky;

    const saveBtn=document.querySelector("#saveRoutineBtn");
    if(saveBtn) saveBtn.textContent="Änderung speichern";

    document.querySelector(".routine-add-grid")?.scrollIntoView({behavior:"smooth",block:"center"});
    document.querySelector("#routineTitle")?.focus();
  }));

  // Löschen direkt im Bereich; bei aus dem Überblick eingeplanten Videos
  // wird der Archiv-Eintrag wieder freigegeben.
  document.querySelectorAll(".routine-area-delete").forEach(btn=>btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();

    const routines=ensureWorkroomRoutines();
    const item=routines.items.find(x=>x.id===btn.dataset.id);
    if(!item) return;

    if(item.sourceArchiveId){
      const archived=state.archive.find(x=>x.id===item.sourceArchiveId);
      if(archived){
        archived.planned=false;
        archived.updatedAt=Date.now();
      }
    }else if(item.url){
      const archived=state.archive.find(x=>{
        try{return normalizeUrl(x.url)===normalizeUrl(item.url);}
        catch{return String(x.url||"").trim()===String(item.url||"").trim();}
      });
      if(archived){
        archived.planned=false;
        archived.updatedAt=Date.now();
      }
    }

    tombstoneRoutineItem(item.id);
    routines.items=routines.items.filter(x=>x.id!==item.id);
    Object.keys(routines.completions||{}).forEach(key=>{
      if(key.startsWith(`${item.id}__`)) delete routines.completions[key];
    });

    save();
    renderRoutines();
    renderArchive();
  }));
}

function renderRoutines(){
  const list=document.querySelector("#routineList");
  if(!list) return;

  const routines=ensureWorkroomRoutines();
  const weekKey=routineWeekKey(activeRoutineWeekOffset);
  const weekNames={0:"dieser Woche",1:"nächster Woche",2:"in +2 Wochen",3:"in +3 Wochen",4:"in +4 Wochen"};
  const tabNames={0:"Diese Woche",1:"Nächste Woche",2:"+2 Wochen",3:"+3 Wochen",4:"+4 Wochen"};

  const weekLabel=document.querySelector("#routineWeekLabel");
  if(weekLabel) weekLabel.textContent=`Planung ${weekNames[activeRoutineWeekOffset] || `in +${activeRoutineWeekOffset} Wochen`}`;

  const editingHint=document.querySelector("#routineEditingWeekHint");
  if(editingHint) editingHint.innerHTML=`Du bearbeitest gerade: <strong>${tabNames[activeRoutineWeekOffset] || `+${activeRoutineWeekOffset} Wochen`}</strong>`;

  document.querySelectorAll(".routine-week-btn").forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.routineWeek||0)===activeRoutineWeekOffset);
  });

  renderRoutineIdeaChecks();
  renderRoutineAreaTasks();

  const items=routines.items
    .filter(item=>routineAppliesToWeek(item,weekKey))
    .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

  const count=document.querySelector("#routinePlanningCount");
  if(count) count.textContent=`${items.length} ${items.length===1?"Punkt":"Punkte"}`;

  if(!items.length){
    list.innerHTML=`<div class="workroom-empty">Für ${weekNames[activeRoutineWeekOffset] || "diese Woche"} ist noch nichts geplant.</div>`;
    return;
  }

  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+activeRoutineWeekOffset*7);
  const dayNames=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  const partLabel={morning:"Morgens",school:"Schulalltag",afterschool:"Nach der Schule",evening:"Abends",other:"Sonstiges"};

  const cardHtml=(item,occurrenceDate=null)=>{
    const cat=routineCategoryMeta[item.category||"none"] || routineCategoryMeta.other;
    const thumb=item.url ? thumbnailFor(item.url) : "";
    const completion=occurrenceDate ? routineCompletion(item.id,occurrenceDate) : null;
    const doneClass=completion?.done ? "is-completed" : "";
    return `<div class="routine-week-plan-card ${doneClass}" data-id="${item.id}">
      ${thumb?`<a class="routine-week-plan-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"><span>▶</span></a>`:""}
      <div class="routine-week-plan-copy">
        <strong>${escapeHtml(item.title||"Routinepunkt")}</strong>
        <small>${partLabel[item.part||"morning"]}${item.url?` · ${cat[1]}`:""}${item.sticky?" · jede Woche":""}${completion?.done?" · heute erledigt":""}</small>
      </div>
      <div class="routine-week-plan-actions">
        <button class="routine-edit-btn" data-id="${item.id}" type="button" title="Bearbeiten" aria-label="Bearbeiten"><svg class="routine-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l3.5-.8L18 8.7a1.7 1.7 0 0 0 0-2.4l-.3-.3a1.7 1.7 0 0 0-2.4 0L5.8 15.5z"/><path d="M13.8 7.5l2.7 2.7"/></svg></button>
        <button class="routine-delete-btn" data-id="${item.id}" type="button" title="Aus Planung entfernen" aria-label="Aus Planung entfernen"><svg class="routine-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"/><path d="M9.2 7V5h5.6v2"/><path d="M7.5 7l.8 11h7.4l.8-11"/><path d="M10.3 10.2v4.9M13.7 10.2v4.9"/></svg></button>
      </div>
    </div>`;
  };

  const dailyItems=items.filter(item=>item.day==="daily" || !item.day);

  list.innerHTML=`
    ${dailyItems.length?`
      <div class="routine-week-daily">
        <span class="routine-week-daily-label">Täglich</span>
        <div class="routine-week-daily-items">${dailyItems.map(item=>cardHtml(item,activeRoutineWeekOffset===0?new Date():null)).join("")}</div>
      </div>`:""}
    <div class="routine-week-grid">
      ${dayNames.map((day,i)=>{
        const d=new Date(monday);
        d.setDate(monday.getDate()+i);
        const dayItems=items.filter(item=>item.day===day);
        return `<section class="routine-week-day ${dateKey(d)===dateKey(new Date())?"is-today":""}">
          <header>
            <strong>${day}</strong>
            <span>${d.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"})}</span>
          </header>
          <div class="routine-week-day-items">
            ${dayItems.length?dayItems.map(item=>cardHtml(item,d)).join(""):'<span class="routine-week-day-empty routine-moon-empty">☾ <small>✦</small></span>'}
          </div>
        </section>`;
      }).join("")}
    </div>`;

  document.querySelectorAll("#routineList .routine-edit-btn").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.preventDefault();
    e.stopPropagation();
    const item=routines.items.find(x=>x.id===btn.dataset.id);
    if(!item) return;
    editingRoutineId=item.id;
    document.querySelector("#routinePart").value=item.part||"morning";
    document.querySelector("#routineTitle").value=item.title||"";
    document.querySelector("#routineUrl").value=item.url||"";
    document.querySelector("#routineCategory").value=item.category||"none";
    document.querySelector("#routineDay").value=item.day||"daily";
    document.querySelector("#routineSticky").checked=!!item.sticky;
    const saveBtn=document.querySelector("#saveRoutineBtn");
    if(saveBtn) saveBtn.textContent="Änderung speichern";
    document.querySelector("#cancelRoutineEditBtn")?.classList.remove("hidden");
    document.querySelector(".routine-add-grid")?.scrollIntoView({behavior:"smooth",block:"center"});
    document.querySelector("#routineTitle")?.focus();
  }));

  document.querySelectorAll("#routineList .routine-delete-btn").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.preventDefault();
    e.stopPropagation();
    const doomed=routines.items.find(x=>x.id===btn.dataset.id);
    if(!doomed) return;

    // Nur die Planung entfernen. Ein Archivvideo bleibt im Überblick erhalten.
    tombstoneRoutineItem(btn.dataset.id);
    routines.items=routines.items.filter(x=>x.id!==btn.dataset.id);
    Object.keys(routines.completions||{}).forEach(key=>{
      if(key.startsWith(`${btn.dataset.id}__`)) delete routines.completions[key];
    });

    save();
    renderRoutines();
    renderWorkroomWeekOverview(activeWorkroomWeekOffset);
    renderArchive();
  }));
}

function saveRoutineFromForm(){
  const routines=ensureWorkroomRoutines();
  const title=(document.querySelector("#routineTitle")?.value||"").trim();
  let url=(document.querySelector("#routineUrl")?.value||"").trim();
  if(!title && !url) return;
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;

  const payload={
    part:document.querySelector("#routinePart")?.value || "morning",
    title:title || "Routinevideo",
    url,
    category:url ? (document.querySelector("#routineCategory")?.value || "other") : "none",
    day:document.querySelector("#routineDay")?.value || "daily",
    sticky:!!document.querySelector("#routineSticky")?.checked,
    weekKey:routineWeekKey(activeRoutineWeekOffset),
    updatedAt:Date.now()
  };

  if(editingRoutineId){
    const item=routines.items.find(x=>x.id===editingRoutineId);
    if(item) Object.assign(item,payload);
  }else{
    routines.items.push({
      id:uid(),
      ...payload,
      createdAt:Date.now(),
      order:routines.items.length
    });
  }

  save();
  resetRoutineEditor();
  renderRoutines();
  renderWorkroomWeekOverview(activeWorkroomWeekOffset);
}

document.querySelector("#saveRoutineBtn")?.addEventListener("click",saveRoutineFromForm);
document.querySelector("#cancelRoutineEditBtn")?.addEventListener("click",resetRoutineEditor);
document.querySelectorAll(".routine-week-btn").forEach(btn=>btn.addEventListener("click",()=>{
  activeRoutineWeekOffset=Number(btn.dataset.routineWeek||0);
  resetRoutineEditor();
  renderRoutines();
}));


// ===== WERKRAUM – Meine Woche =====

const workroomWeekDialog = document.querySelector("#workroomWeekDialog");
let activeWorkroomWeekOffset = 0;

function workroomWeekPersonalIcon(){
  // Eigenes Zeichen für Mama. Falls bereits eines gespeichert ist, wird es verwendet.
  // Bei älteren Daten ohne bewusst gewähltes Zeichen bleibt der ruhige Werkraum-Stern.
  const stored=state.familySettings.a?.icon;
  return stored && stored !== "⭐" ? stored : "✦";
}

function workroomWeekEntriesForDate(date){
  return (state.todos || [])
    .filter(t => !t.archived)
    .filter(t => occursOnDate(t,date))
    .filter(t => Array.isArray(t.family) && t.family.includes("a"))
    .filter(t => (t.type || "todo") !== "todo" || !isOccurrenceDone(t,date))
    .sort((a,b)=>{
      const ae=(a.type||"todo")==="event" ? 0 : 1;
      const be=(b.type||"todo")==="event" ? 0 : 1;
      if(ae!==be) return ae-be;
      if(ae===0) return String(a.time||"99:99").localeCompare(String(b.time||"99:99"));
      return Number(!!b.superImportant)-Number(!!a.superImportant);
    });
}

function renderWorkroomWeekOverview(weekOffset=0){
  const list=document.querySelector("#workroomWeekList");
  if(!list) return;

  activeWorkroomWeekOffset=weekOffset;
  const icon=workroomWeekPersonalIcon();
  const heroIcon=document.querySelector("#workroomWeekHeroIcon");
  const buttonIcon=document.querySelector("#workroomWeekIcon");
  if(heroIcon) heroIcon.textContent=icon;
  if(buttonIcon) buttonIcon.textContent=icon;

  document.querySelectorAll(".workroom-week-tab").forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.weekOffset||0)===weekOffset);
  });

  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+weekOffset*7);

  const today=new Date();
  today.setHours(0,0,0,0);

  const cards=[];
  days.forEach((dayName,index)=>{
    const date=dayDate(monday,index);
    const check=new Date(date);
    check.setHours(0,0,0,0);

    // Vergangene Tage sind in der Schnellansicht nicht mehr relevant.
    if(check<today) return;

    const entries=workroomWeekEntriesForDate(date);
    // Routinen werden ausschließlich direkt in den vier
    // Routinenbereichen angezeigt und dort erledigt/bewertet.
    // "Meine Woche" bleibt dadurch frei für echte Termine und To-dos.
    const routineItems=[];
    const isToday=check.getTime()===today.getTime();

    if(!entries.length && !routineItems.length && !(weekOffset===0 && isToday)) return;
    cards.push({dayName,date,entries,routineItems,isToday});
  });

  if(!cards.length){
    list.innerHTML=`
      <div class="workroom-week-empty">
        <span>${icon}</span>
        <strong>Hier ist gerade nichts eingetragen.</strong>
        <small>Eine angenehm freie Woche.</small>
      </div>`;
    return;
  }

  list.innerHTML=cards.map(day=>{
    const dateLabel=day.date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});
    return `
      <section class="workroom-week-day ${day.isToday?"is-today":""}">
        <header class="workroom-week-day-head">
          <div>
            <strong>${day.dayName}</strong>
            <span>${dateLabel}</span>
          </div>
          
        </header>

        <div class="workroom-week-items">
          ${day.entries.length ? day.entries.map(t=>{
            const isEvent=(t.type||"todo")==="event";
            let time="";
            if(isEvent){
              if(t.time&&t.endTime) time=`${t.time}–${t.endTime}`;
              else if(t.time) time=t.time;
              else if(t.endTime) time=`bis ${t.endTime}`;
            }

            return `
              <div class="workroom-week-item ${isEvent?"event":"todo"}">
                <span class="workroom-week-item-symbol">${isEvent?"✦":t.superImportant?"★":icon}</span>
                <div>
                  <span class="workroom-week-item-meta">${isEvent?"Termin":"To-do"}</span>
                  <strong>${escapeHtml(t.text||"")}</strong>
                  ${time?`<small>${escapeHtml(time)}</small>`:""}
                </div>
              </div>`;
          }).join("") : ""}

          ${day.routineItems?.length ? `
            <div class="workroom-week-routine-block">
              ${["morning","school","afterschool","evening","other"].map(part=>{
                const group=day.routineItems.filter(x=>(x.part||"morning")===part);
                if(!group.length) return "";
                const label={
                  morning:"🌿 Morgenroutine",
                  school:"☀️ Schulalltag",
                  afterschool:"🍃 Nach der Schule",
                  evening:"🌙 Abendroutine",
                  other:"Routine"
                }[part];
                return `<section class="workroom-week-routine-group">
                  <span class="workroom-week-routine-label">${label}</span>
                  ${group.map(item=>{
                    const completion=routineCompletion(item.id,day.date);
                    const done=!!completion?.done;
                    const category=routineCategoryMeta[item.category||"none"]||routineCategoryMeta.other;
                    const routineThumb=item.url ? thumbnailFor(item.url) : "";
                    return `<div class="workroom-week-routine-item ${done?"done":""} ${routineThumb?"has-thumb":""}" data-routine-id="${item.id}" data-date="${dateKey(day.date)}">
                      <button class="routine-week-check" type="button" data-id="${item.id}" data-date="${dateKey(day.date)}" data-done="${done?"1":"0"}" aria-pressed="${done?"true":"false"}" aria-label="${done?"Routinepunkt wieder öffnen":"Routinepunkt abhaken"}"><span aria-hidden="true">${done?"✓":""}</span></button>
                      ${routineThumb?`<a class="routine-week-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" aria-label="Video öffnen">
                        <img src="${escapeHtml(routineThumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        <span>▶</span>
                      </a>`:""}
                      <div class="routine-week-copy">
                        <strong>${escapeHtml(item.title||"Routinepunkt")}</strong>
                        ${item.url?`<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${category[0]} ${category[1]} · Video öffnen</a>`:""}
                      </div>
                      ${done && item.url && !completion?.rating ? `
                        <div class="routine-week-rating" aria-label="Video bewerten">
                          <button type="button" data-rating="super" data-id="${item.id}" data-date="${dateKey(day.date)}">✦ <span>Gut</span></button>
                          <button type="button" data-rating="okay" data-id="${item.id}" data-date="${dateKey(day.date)}">○ <span>Mittel</span></button>
                          <button type="button" data-rating="nope" data-id="${item.id}" data-date="${dateKey(day.date)}">— <span>Schlecht</span></button>
                        </div>`:""}
                      ${done && completion?.rating ? `<span class="routine-rated-mark">${{super:"✦ Gut",okay:"○ Mittel",nope:"— Schlecht"}[completion.rating]||""}</span>`:""}
                    </div>`;
                  }).join("")}
                </section>`;
              }).join("")}
            </div>`:""}

          ${!day.entries.length && !day.routineItems?.length ? `<div class="workroom-week-today-empty">Heute ist nichts eingetragen. 🌿</div>`:""}
        </div>
      </section>`;
  }).join("");

  document.querySelectorAll(".routine-week-check").forEach(btn=>btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    if(btn.dataset.busy==="1") return;
    btn.dataset.busy="1";

    const item=ensureWorkroomRoutines().items.find(x=>x.id===btn.dataset.id);
    const date=parseLocalDate(btn.dataset.date);
    if(!item || !date){ btn.dataset.busy="0"; return; }

    const current=routineCompletion(item.id,date);
    const willBeDone=!current?.done;

    if(willBeDone){
      // Zuerst nur den Routinepunkt abschließen.
      // Bei einem Video bleibt die Zeile anschließend für die Bewertung stehen.
      setRoutineCompletion(item.id,date,{
        done:true,
        rating:null,
        archived:!!current?.archived
      });
    }else{
      setRoutineCompletion(item.id,date,{
        done:false,
        rating:null,
        archived:!!current?.archived
      });
    }

    save();
    renderWorkroomWeekOverview(activeWorkroomWeekOffset);
  }));

  // Bewertungsbuttons werden delegiert gebunden; dadurch bleiben sie auch
  // nach jedem Neurendern zuverlässig klickbar.
;

  const todayCard=list.querySelector(".workroom-week-day.is-today");
  if(todayCard) requestAnimationFrame(()=>todayCard.scrollIntoView({block:"nearest"}));
}


document.addEventListener("click",e=>{
  const btn=e.target.closest(".routine-week-rating button[data-rating], .routine-area-rating button[data-rating]");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const item=ensureWorkroomRoutines().items.find(x=>x.id===btn.dataset.id);
  const date=parseLocalDate(btn.dataset.date);
  if(!item || !date) return;

  const rating=btn.dataset.rating;
  btn.closest(".routine-week-rating")?.querySelectorAll("button").forEach(x=>x.classList.toggle("is-selected",x===btn));

  const current=routineCompletion(item.id,date);
  const entry=routineArchiveFromItem(item,rating,{countDone:!current?.archived});
  if(!entry) return;

  entry.planned=false;
  entry.updatedAt=Date.now();

  // Die konkrete Durchführung ist erledigt; die Wochenplanung bleibt bestehen.
  setRoutineCompletion(item.id,date,{done:true,rating,archived:true});

  // Direkt lokal sichern, bevor ein Cloud-Zyklus dazwischenfunken kann.
  localStorage.setItem("balanceProd.archive",JSON.stringify(state.archive));
  localStorage.setItem("balanceProd.workroom",JSON.stringify(state.workroom));
  save();

  // Nach der Bewertung sofort weg aus der Routine und zurück in den Überblick.
  renderArchive();
  renderRoutines();
  renderWorkroomWeekOverview(activeWorkroomWeekOffset);
});

document.querySelector("#openWorkroomWeekBtn")?.addEventListener("click",()=>{
  renderWorkroomWeekOverview(0);
  workroomWeekDialog?.showModal();
});

document.querySelector("#closeWorkroomWeekBtn")?.addEventListener("click",()=>{
  workroomWeekDialog?.close();
});

document.querySelectorAll(".workroom-week-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    renderWorkroomWeekOverview(Number(btn.dataset.weekOffset||0));
  });
});


// ===== KINDER – Meine Woche =====

let activeChildWeekId = null;
let activeChildWeekOffset = 0;
const childWeekDialog = document.querySelector("#childWeekDialog");

function childWeekFamilyKey(id){
  return id === "1" ? "c" : "d";
}

function childWeekTodoRelevant(todo,id){
  const family=Array.isArray(todo.family) ? todo.family : [];
  return family.includes(childWeekFamilyKey(id));
}

function childWeekSchoolTasksForDate(id,date){
  const key=dateKey(date);
  return (state.school.children[id]?.tasks || [])
    .filter(t => !t.done)
    .filter(t => String(t.due || "") === key)
    .map(t => ({
      kind:"school",
      text:t.text || "",
      subject:t.subject || "",
      schoolType:t.type || "",
      icon:schoolTaskIcon(t,id)
    }));
}

function childWeekTodosForDate(id,date){
  return (state.todos || [])
    .filter(t => !t.archived)
    .filter(t => occursOnDate(t,date))
    .filter(t => childWeekTodoRelevant(t,id))
    .filter(t => (t.type || "todo") !== "todo" || !isOccurrenceDone(t,date))
    .map(t => ({
      kind:(t.type || "todo") === "event" ? "event" : "todo",
      text:t.text || "",
      time:t.time || "",
      endTime:t.endTime || "",
      important:!!t.superImportant
    }));
}

function childWeekTypeLabel(item){
  if(item.kind === "school"){
    const map={homework:"Hausübung",test:"Test",bring:"Mitbringen"};
    return map[item.schoolType] || "Schule";
  }
  return item.kind === "event" ? "Termin" : "To-do";
}

function renderChildWeekOverview(id,weekOffset=0){
  const list=document.querySelector("#childWeekList");
  const title=document.querySelector("#childWeekTitle");
  const subtitle=document.querySelector("#childWeekSubtitle");
  const image=document.querySelector("#childWeekImage");
  const icon=document.querySelector("#childWeekIcon");
  if(!list) return;

  const child=state.school.children[id];
  const name=child?.name || (id === "1" ? "Lou" : "Fina");
  const personalIcon=schoolChildDefaultIcon(id);

  if(title) title.textContent=`${name}s Woche`;
  if(subtitle) subtitle.textContent=weekOffset===0 ? "Das ist diese Woche wichtig." : "Ein Blick nach vorne.";
  if(icon) icon.textContent=personalIcon;
  if(image){
    image.src=id === "1" ? "./lou-stundenplan.png?v=105" : "./fina-stundenplan.png?v=105";
    image.alt="";
  }

  document.querySelector("#childWeekDialog")?.setAttribute("data-child",id);
  document.querySelectorAll(".child-week-tab").forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.weekOffset||0)===weekOffset);
  });

  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+weekOffset*7);

  const today=new Date();
  today.setHours(0,0,0,0);

  const dayCards=[];

  days.forEach((dayName,index)=>{
    const date=dayDate(monday,index);
    const check=new Date(date);
    check.setHours(0,0,0,0);

    const todoItems=childWeekTodosForDate(id,date);
    const schoolItems=childWeekSchoolTasksForDate(id,date);
    const items=[...todoItems,...schoolItems].sort((a,b)=>{
      const order={event:0,school:1,todo:2};
      const kindDiff=(order[a.kind]??9)-(order[b.kind]??9);
      if(kindDiff) return kindDiff;
      if(a.kind==="event") return String(a.time||"99:99").localeCompare(String(b.time||"99:99"));
      return 0;
    });

    const isToday=check.getTime()===today.getTime();

    // Wie bei Papa: leere Tage ausblenden, aber "Heute" in der aktuellen Woche zeigen.
    if(!items.length && !(weekOffset===0 && isToday)) return;

    dayCards.push({dayName,date,items,isToday});
  });

  if(!dayCards.length){
    list.innerHTML=`
      <div class="child-week-empty">
        <span>${personalIcon}</span>
        <strong>Hier ist gerade nichts eingetragen.</strong>
        <small>Sieht nach einer ziemlich freien Woche aus.</small>
      </div>`;
    return;
  }

  list.innerHTML=dayCards.map(day=>{
    const dateLabel=day.date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});
    return `
      <section class="child-week-day ${day.isToday?"is-today":""}">
        <header class="child-week-day-head">
          <div>
            <strong>${day.dayName}</strong>
            <span>${dateLabel}</span>
          </div>
          
        </header>
        <div class="child-week-items">
          ${day.items.length ? day.items.map(item=>{
            let time="";
            if(item.kind==="event"){
              if(item.time && item.endTime) time=`${item.time}–${item.endTime}`;
              else if(item.time) time=item.time;
              else if(item.endTime) time=`bis ${item.endTime}`;
            }
            return `
              <div class="child-week-item kind-${item.kind}">
                <span class="child-week-item-symbol">${item.kind==="school" ? item.icon : item.kind==="event" ? "✦" : item.important ? "★" : "○"}</span>
                <div class="child-week-item-copy">
                  <span class="child-week-item-meta">
                    ${escapeHtml(childWeekTypeLabel(item))}
                    ${item.kind==="school" && item.subject ? ` · ${escapeHtml(item.subject)}` : ""}
                  </span>
                  <strong>${escapeHtml(item.text)}</strong>
                  ${time ? `<small>${escapeHtml(time)}</small>` : ""}
                </div>
              </div>`;
          }).join("") : `<div class="child-week-today-empty">Heute ist nichts eingetragen. 🌿</div>`}
        </div>
      </section>`;
  }).join("");

  const todayCard=list.querySelector(".child-week-day.is-today");
  if(todayCard) requestAnimationFrame(()=>todayCard.scrollIntoView({block:"nearest"}));
}

function openChildWeekOverview(id){
  if(!["1","2"].includes(String(id))) return;
  activeChildWeekId=String(id);
  activeChildWeekOffset=0;
  renderChildWeekOverview(activeChildWeekId,0);
  childWeekDialog?.showModal();
}

document.querySelector("#closeChildWeekBtn")?.addEventListener("click",()=>{
  childWeekDialog?.close();
});

document.querySelectorAll(".child-week-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(!activeChildWeekId) return;
    activeChildWeekOffset=Number(btn.dataset.weekOffset||0);
    renderChildWeekOverview(activeChildWeekId,activeChildWeekOffset);
  });
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
  // Termine bleiben sichtbar. In Papas Schnellansicht erscheinen bei To-dos
  // ausschließlich offene Aufgaben – erledigte niemals, auch nicht am Erledigungstag.
  if ((t.type || "todo") !== "todo") return true;
  return !t.done;
}

function renderPapaOverview(weekOffset = 0) {
  const list = document.querySelector("#papaOverviewList");
  if (!list) return;

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + (weekOffset * 7));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekEntries = [];

  days.forEach((dayName, index) => {
    const date = dayDate(monday, index);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // In Papas Schnellansicht brauchen wir Vergangenes nicht mehr.
    if (checkDate < today) return;

    const entries = state.todos
      .filter(t => !t.archived)
      .filter(t => occursOnDate(t, date))
      .filter(papaEntryIsRelevant)
      .filter(t => (t.type || "todo") !== "todo" || !isOccurrenceDone(t, date))
      .sort((a,b) => {
        // Termine zuerst, danach To-dos; Termine nach Uhrzeit.
        const aEvent = a.type === "event" ? 0 : 1;
        const bEvent = b.type === "event" ? 0 : 1;
        if (aEvent !== bEvent) return aEvent - bEvent;
        if (aEvent === 0) return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
        return Number(!!b.superImportant) - Number(!!a.superImportant);
      });

    const isToday = checkDate.getTime() === today.getTime();

    // Heute wird in "Diese Woche" immer gezeigt, auch wenn nichts eingetragen ist.
    if (!entries.length && !(weekOffset === 0 && isToday)) return;

    weekEntries.push({
      dayName,
      date,
      entries,
      isToday
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
      <section class="papa-overview-day ${day.isToday ? "is-today" : ""}">
        <div class="papa-overview-day-head">
          <div class="papa-overview-day-title">
            <strong>${day.dayName}</strong>
            <span>${dateLabel}</span>
          </div>
          ${day.isToday ? `<span class="papa-today-badge">Heute</span>` : ""}
        </div>

        <div class="papa-overview-day-entries">
          ${day.entries.length ? day.entries.map(t => {
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
                  <span class="papa-overview-symbol" aria-hidden="true">✦</span>
                  <span class="papa-overview-entry-text">
                    ${time ? `<strong class="papa-overview-time">${escapeHtml(time)}</strong>` : ""}
                    <span>${escapeHtml(t.text || "")}</span>
                  </span>
                </div>
              `;
            }

            return `
              <div class="papa-overview-entry todo">
                <span class="papa-overview-symbol" aria-hidden="true">${t.superImportant ? "★" : "☐"}</span>
                <span class="papa-overview-entry-text">
                  <span>${escapeHtml(t.text || "")}</span>
                </span>
              </div>
            `;
          }).join("") : `
            <div class="papa-overview-today-empty">Heute ist nichts eingetragen.</div>
          `}
        </div>
      </section>
    `;
  }).join("");

  // Beim Öffnen steht der aktuelle Tag sofort im sichtbaren Bereich.
  const todaySection = list.querySelector(".papa-overview-day.is-today");
  if (todaySection) {
    requestAnimationFrame(() => todaySection.scrollIntoView({block:"nearest"}));
  }
}

document.addEventListener("click", (event) => {
  const papaBtn = event.target.closest("#openPapaOverviewBtn");
  if (!papaBtn) return;

  event.preventDefault();
  setRandomPapaQuote();
  document.querySelectorAll(".papa-tab").forEach(btn =>
    btn.classList.toggle("active", Number(btn.dataset.weekOffset || 0) === 0)
  );
  renderPapaOverview(0);

  if (papaOverviewDialog && !papaOverviewDialog.open) {
    papaOverviewDialog.showModal();
  }
});

document.querySelector("#closePapaOverviewBtn")?.addEventListener("click", () => {
  papaOverviewDialog?.close();
});

papaOverviewDialog?.addEventListener("click", (event) => {
  if (event.target === papaOverviewDialog) {
    papaOverviewDialog.close();
  }
});

document.querySelectorAll(".papa-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const offset = Number(btn.dataset.weekOffset || 0);
    document.querySelectorAll(".papa-tab").forEach(b=>b.classList.toggle("active",b===btn));
    renderPapaOverview(offset);
  });
});

document.querySelectorAll(".family-timetable-person").forEach(btn => {
  btn.addEventListener("click", () => {
    const person = btn.dataset.person;
    if (!["1","2","mama"].includes(person)) return;
    familyTimetableDialog?.close();
    showManualTimetable(person);
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
let lastTimeTrackingCloudFingerprint = "";

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
  // NIE wegen eines gleichzeitig eintreffenden Snapshots überspringen.
  // Start/Stop muss immer in die Cloud geschrieben werden.
  if (!firebase.auth().currentUser) return;

  const ref = timeTrackingDoc();
  const localSnapshot = normalizeTimeTrackingData(state.timeTracking);

  try {
    const merged = await firebase.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const remote = snap.exists ? (snap.data()?.timeTracking || {}) : {};
      const next = mergeTimeTrackingData(remote, localSnapshot);

      tx.set(ref, {
        timeTracking: next,
        timeTrackingRevision: firebase.firestore.FieldValue.increment(1),
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
      lastTimeTrackingCloudFingerprint = JSON.stringify(remoteTimeTracking);
      writeTimeTrackingLocalOnly();
      renderTimeTracking();
    } finally {
      timeTrackingCloudApplying = false;
    }
  } catch (err) {
    console.warn("Zeittracking-Aktualisierung konnte nicht geladen werden:", err);
  }
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
    lastTimeTrackingCloudFingerprint = remoteTimeTracking ? JSON.stringify(remoteTimeTracking) : "";
    writeTimeTrackingLocalOnly();

    // Falls bisher nur lokale Zeitdaten vorhanden waren, einmalig ins
    // gemeinsame Familien-Dokument übernehmen.
    if (!remoteTimeTracking && (initial.active.length || initial.entries.length)) {
      await ref.set({
        timeTracking: initial,
        timeTrackingRevision: firebase.firestore.FieldValue.increment(1),
        timeTrackingUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Zeittracking-Migration konnte nicht abgeschlossen werden:", err);
  }

  timeTrackingUnsubscribe = ref.onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data() || {};
    const remoteTimeTracking = data.timeTracking;
    if (!remoteTimeTracking) return;

    const fingerprint = JSON.stringify(remoteTimeTracking);
    if (fingerprint === lastTimeTrackingCloudFingerprint) return;
    lastTimeTrackingCloudFingerprint = fingerprint;

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

  /* Einmaliger Abgleich nach dem Start.
     Danach ist onSnapshot die Hauptsynchronisation. */
  await refreshTimeTrackingFromCloud();
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

const TRASH_KEEP_MS = 24 * 60 * 60 * 1000;
let undoTimer = null, lastUndoAction = null;

function pruneTrash(){
  const cutoff=Date.now()-TRASH_KEEP_MS;
  const before=state.trash||[];
  const removed=before.filter(x=>Number(x.deletedAt||0)<cutoff);
  removed.forEach(x=>x?.trashId && markListItemDeleted("trashTombstones",x.trashId));
  state.trash=before.filter(x=>Number(x.deletedAt||0)>=cutoff);
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
  if(rec.kind==="todo"){
    markTodoRestored(item.id);
    item.updatedAt = Date.now();
    if(!state.todos.some(x=>x.id===item.id))state.todos.push(item);
  }
  if(rec.kind==="time"){
    delete state.timeTracking.deletedEntries?.[item.id];
    if(!state.timeTracking.entries.some(x=>x.id===item.id))state.timeTracking.entries.push(item);
    saveTimeTrackingImmediately();
  }
  state.trash=state.trash.filter(x=>x.trashId!==id); save(); renderAll(); renderTodoTrash();
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
  host.querySelectorAll(".trash-delete").forEach(b=>b.onclick=()=>{
    const id=b.dataset.id;
    markListItemDeleted("trashTombstones",id);
    state.trash=state.trash.filter(x=>x.trashId!==id);
    save();
    persistTopLevelDeletionImmediately("trash");
    renderTrash();
  });
  const empty=document.querySelector("#emptyTrashBtn"); if(empty)empty.disabled=!rows.length;
}


// =========================================================
// FAMILIENFRAGEN – kleine offene Fragen oben im Wochenplan
// =========================================================
function familyQuestionRecipientLabel(key){
  if(key === "shared") return "Alle";
  return familyName(key) || "";
}

function familyQuestionRecipientColor(key){
  if(key === "shared") return "#b89a77";
  return familyColor(key);
}

let editingFamilyQuestionId = null;

function resetFamilyQuestionEditor(){
  editingFamilyQuestionId = null;
  const input = document.querySelector("#familyQuestionText");
  const to = document.querySelector("#familyQuestionTo");
  const add = document.querySelector("#addFamilyQuestionBtn");
  const cancel = document.querySelector("#cancelFamilyQuestionEditBtn");
  if(input) input.value = "";
  if(to) to.value = "shared";
  if(add) add.textContent = "+ Frage";
  cancel?.classList.add("hidden");
}

function renderFamilyQuestions(){
  const open = (state.familyQuestions || [])
    .filter(q => !q.done && !q.deleted)
    .sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  const select = document.querySelector("#familyQuestionTo");
  if(select){
    const current = select.value || "shared";
    select.innerHTML = `
      <option value="shared">Alle</option>
      <option value="a">${escapeHtml(familyName("a") || "Mama")}</option>
      <option value="b">${escapeHtml(familyName("b") || "Papa")}</option>
      <option value="c">${escapeHtml(familyName("c") || "Lou")}</option>
      <option value="d">${escapeHtml(familyName("d") || "Fina")}</option>
    `;
    select.value = [...select.options].some(o => o.value === current) ? current : "shared";
  }

  const strip = document.querySelector("#weekFamilyQuestions");
  if(strip){
    if(!open.length){
      strip.classList.add("hidden");
      strip.innerHTML = "";
      strip.style.removeProperty("--question-cols");
      strip.style.removeProperty("--question-sign-width");
      delete strip.dataset.questionCount;
    }else{
      const visible = open.slice(0,6);
      const cols = visible.length <= 2 ? visible.length : Math.min(3, visible.length);
      const signWidth =
        visible.length <= 1 ? 285 :
        visible.length === 2 ? 430 :
        visible.length === 3 ? 585 : 650;
      strip.style.setProperty("--question-cols", cols);
      strip.style.setProperty("--question-sign-width", signWidth + "px");
      strip.dataset.questionCount = String(visible.length);
      strip.classList.remove("hidden");
      strip.innerHTML = `
        <div class="week-family-question-items">
          ${visible.map(q => `
            <div class="week-family-question">
              <button type="button" class="week-family-question-mark family-question-done"
                      data-question-id="${q.id}"
                      title="Frage erledigt"
                      aria-label="Frage erledigt">?</button>
              <span class="week-family-question-copy">
                <strong>${escapeHtml(q.text)}</strong>
                <small>→ ${escapeHtml(familyQuestionRecipientLabel(q.to))}</small>
              </span>
            </div>
          `).join("")}
          ${open.length > 6 ? `<span class="week-family-question-more">+${open.length-6}</span>` : ""}
        </div>
      `;
    }
  }

  const list = document.querySelector("#familyQuestionList");
  const existing=document.querySelector("#familyQuestionExisting");
  const existingLabel=document.querySelector("#familyQuestionExistingLabel");
  if(existingLabel)existingLabel.textContent=`Offene Fragen (${open.length})`;
  if(existing)existing.classList.toggle("hidden",open.length===0);
  if(list){
    list.innerHTML = open.length ? open.map(q => `
      <div class="family-question-list-item" style="--question-color:${familyQuestionRecipientColor(q.to)}">
        <span class="family-question-list-dot"></span>
        <span class="family-question-list-copy">
          <strong>${escapeHtml(q.text)}</strong>
          <small>an ${escapeHtml(familyQuestionRecipientLabel(q.to))}</small>
        </span>
        <button type="button" class="family-question-edit"
                data-question-id="${q.id}">✎</button>
        <button type="button" class="family-question-done"
                data-question-id="${q.id}">✓ Fertig</button>
        <button type="button" class="family-question-delete"
                data-question-id="${q.id}"
                aria-label="Frage löschen">×</button>
      </div>
    `).join("") : "";
  }


  document.querySelectorAll(".family-question-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = state.familyQuestions.find(x => x.id === btn.dataset.questionId);
      if(!q) return;
      editingFamilyQuestionId = q.id;
      const input = document.querySelector("#familyQuestionText");
      const to = document.querySelector("#familyQuestionTo");
      const add = document.querySelector("#addFamilyQuestionBtn");
      const cancel = document.querySelector("#cancelFamilyQuestionEditBtn");
      if(input) input.value = q.text || "";
      if(to) to.value = q.to || "shared";
      if(add) add.textContent = "Änderung speichern";
      cancel?.classList.remove("hidden");
      document.querySelector(".family-question-card")?.setAttribute("open", "");
      input?.focus();
    });
  });

  document.querySelectorAll(".family-question-done").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = state.familyQuestions.find(x => x.id === btn.dataset.questionId);
      if(!q) return;
      q.done = true;
      q.updatedAt = Date.now();
      persistFamilyQuestionsNow();
      save();
      renderFamilyQuestions();
      showFamilyQuestionThanks();
    });
  });

  document.querySelectorAll(".family-question-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = state.familyQuestions.find(x => x.id === btn.dataset.questionId);
      if(!q) return;
      q.deleted = true;
      q.updatedAt = Date.now();
      persistFamilyQuestionsNow();
      save();
      renderFamilyQuestions();
    });
  });
}

function addFamilyQuestion(){
  const input = document.querySelector("#familyQuestionText");
  const to = document.querySelector("#familyQuestionTo");
  const text = input?.value.trim();
  if(!text) return;

  if(editingFamilyQuestionId){
    const q = state.familyQuestions.find(x => x.id === editingFamilyQuestionId);
    if(q){
      q.text = text;
      q.to = to?.value || "shared";
      q.updatedAt = Date.now();
    }
  }else{
    state.familyQuestions.push({
      id: uid(),
      text,
      to: to?.value || "shared",
      done:false,
      deleted:false,
      createdAt:Date.now(),
      updatedAt:Date.now()
    });
  }

  persistFamilyQuestionsNow();
  save();
  resetFamilyQuestionEditor();
  renderFamilyQuestions();
  input.focus();
}

document.querySelector("#addFamilyQuestionBtn")?.addEventListener("click", addFamilyQuestion);
document.querySelector("#cancelFamilyQuestionEditBtn")?.addEventListener("click", resetFamilyQuestionEditor);
document.querySelector("#familyQuestionText")?.addEventListener("keydown", e => {
  if(e.key === "Enter"){
    e.preventDefault();
    addFamilyQuestion();
  }
});

/* CODE-AUDIT: frühere, überschriebene Definition von renderAll entfernt. */
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
  const targetView = btn.dataset.view;

  // V32: Eine im Wochenplan gewählte alte/zukünftige Woche ist nur dort gültig.
  // Beim Wechsel auf Schule, Einkauf, To-dos, Werkraum oder Überblick wird
  // sofort wieder die echte aktuelle Kalenderwoche zur gemeinsamen Basis.
  if (targetView !== "week") {
    currentWeekMonday = getMonday(new Date());
  }

  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.querySelector(`#${targetView}`)?.classList.add("active");

  // Auch beim Zurückkehren in den Wochenplan nach einem Tabwechsel
  // wird deshalb die aktuelle Woche dargestellt.
  if (targetView === "week") renderWeek();
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
function workroomDragEnabled() {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch (_) {
    return true;
  }
}

function touchWorkroomTodo(item) {
  if (!item) return;
  item.updatedAt = Date.now();
}

function tombstoneWorkroomTodo(id) {
  if (!id) return;
  state.workroom = normalizeWorkroom(state.workroom);
  state.workroom.todoTombstones = state.workroom.todoTombstones || {};
  state.workroom.todoTombstones[id] = Date.now();
}

function renderSchoolWorkTodos() {
  // Datensicherheits-Hydration: vorhandene lokale Werkraumdaten haben Vorrang,
  // falls der In-Memory-State durch einen unvollständigen Cloudstand leerer ist.
  try {
    const localWorkroom = JSON.parse(localStorage.getItem("balanceProd.workroom") || "null");
    if (localWorkroom && typeof localWorkroom === "object") {
      const localNorm = normalizeWorkroom(localWorkroom);
      const stateNorm = normalizeWorkroom(state.workroom);
      const localCount =
        localNorm.todos.length + localNorm.prints.length + localNorm.links.length + localNorm.shopping.length;
      const stateCount =
        stateNorm.todos.length + stateNorm.prints.length + stateNorm.links.length + stateNorm.shopping.length;
      if (localCount > stateCount) state.workroom = localNorm;
    }
  } catch (err) {
    console.warn("Werkraum-Lokaldaten konnten nicht gelesen werden:", err);
  }

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
  const allArchivedTodos = state.workroom.todos
    .filter(t =>
      t.done &&
      t.completedAt &&
      t.completedAt <= oneMinuteAgo
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const schoolArchiveSearchBar=ensureCollectionSearchBar({
    anchor:archive,
    id:"schoolTodoArchiveSearch",
    placeholder:"Erledigte Schul-To-dos suchen …",
    value:collectionSearchState.schoolTodos,
    visible:true,
    onInput:value=>{
      collectionSearchState.schoolTodos=value;
      schoolTodoArchiveLimit=15;
      renderSchoolWorkTodos();
    }
  });

  const matchedArchivedTodos=allArchivedTodos.filter(t=>
    collectionSearchMatches(collectionSearchState.schoolTodos,[t.text,t.type,t.link])
  );
  const archivedTodos=matchedArchivedTodos.slice(0,schoolTodoArchiveLimit);
  updateCollectionSearchCount(
    schoolArchiveSearchBar,
    matchedArchivedTodos.length,
    allArchivedTodos.length,
    "To-dos"
  );

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
  : `<div class="workroom-empty">${
      allArchivedTodos.length && collectionSearchState.schoolTodos
        ? "Keine erledigten Schul-To-dos passen zur Suche."
        : "Noch keine erledigten Schul-To-dos."
    }</div>`;

ensureCollectionMoreButton(
  archive,
  "schoolTodoArchiveMore",
  Math.max(0,matchedArchivedTodos.length-archivedTodos.length),
  ()=>{
    schoolTodoArchiveLimit+=15;
    renderSchoolWorkTodos();
  }
);

/* GENAU HIER EINFÜGEN */
document.querySelectorAll(".workroom-archive-delete").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;

    tombstoneWorkroomTodo(id);
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
    print: "🖨 Drucken",
    ask: "💬 Nachfragen"
  };

  list.innerHTML = todos.map(t => `
<div
  class="workroom-todo-row ${t.done ? "done" : ""} ${t.type === "ask" ? "workroom-todo-ask" : ""} ${t.important ? "workroom-todo-important" : ""}"
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
    class="workroom-important-btn ${t.important ? "active" : ""}"
    type="button"
    data-id="${t.id}"
    title="${t.important ? "Wichtig-Markierung entfernen" : "Als wichtig markieren"}"
    aria-pressed="${t.important ? "true" : "false"}">★ Wichtig</button>

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
    touchWorkroomTodo(item);

    save();
    renderSchoolWorkTodos();
    if (item.done) {
  setTimeout(() => {
    renderSchoolWorkTodos();
  }, 61000);
}
  });
});

/* V102 – NUR HANDY:
   Schul-To-do durch Tippen auf den Aufgabentext abhaken.
   Aktionen rechts (Stern, Bearbeiten, Löschen, Pfeile, Links) bleiben
   vollständig getrennte Klickziele und lösen das Abhaken NICHT aus. */
if (window.matchMedia("(max-width: 700px)").matches) {
  document.querySelectorAll(".workroom-todo-content").forEach(content => {
    content.setAttribute("role", "button");
    content.setAttribute("tabindex", "0");
    content.setAttribute("aria-label", "Schul-To-do als erledigt markieren");

    const toggleMobileSchoolTodo = () => {
      const row = content.closest(".workroom-todo-row");
      const id = row?.dataset.id;
      const item = state.workroom.todos.find(t => t.id === id);
      if (!item) return;

      item.done = !item.done;
      item.completedAt = item.done ? Date.now() : null;
      touchWorkroomTodo(item);

      save();
      renderSchoolWorkTodos();

      if (item.done) {
        setTimeout(() => {
          renderSchoolWorkTodos();
        }, 61000);
      }
    };

    content.addEventListener("click", e => {
      e.preventDefault();
      toggleMobileSchoolTodo();
    });

    content.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggleMobileSchoolTodo();
    });
  });
}
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

  const reorderAt = Date.now();
  sorted.forEach((todo, i) => {
    todo.order = i;
    todo.updatedAt = reorderAt;
  });

  state.workroom.todos = sorted;

  save();
  renderSchoolWorkTodos();
}


  document.querySelectorAll(".workroom-todo-delete").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;

    tombstoneWorkroomTodo(id);
    state.workroom.todos = state.workroom.todos.filter(t => t.id !== id);

    save();
    renderSchoolWorkTodos();
  });
});

document.querySelectorAll(".workroom-important-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    const item = state.workroom.todos.find(t => t.id === id);
    if (!item) return;

    item.important = !item.important;
    touchWorkroomTodo(item);
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

if (todoList && typeof Sortable !== "undefined" && workroomDragEnabled()) {
  new Sortable(todoList, {
    animation: 180,
    filter: ".workroom-todo-check,.workroom-todo-actions,.workroom-todo-actions *,input,button,a,select,textarea",
    preventOnFilter: false,
    ghostClass: "workroom-sort-ghost",
    chosenClass: "workroom-sort-chosen",
    dragClass: "workroom-sort-drag",
    delay: 0,
    forceFallback: false,
    
    onEnd: function () {
      const ids = [...todoList.querySelectorAll(".workroom-todo-row")]
        .map(row => row.dataset.id);

      const reorderAt = Date.now();
      ids.forEach((id, index) => {
        const todo = state.workroom.todos.find(t => t.id === id);
        if (todo) {
          todo.order = index;
          todo.updatedAt = reorderAt;
        }
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

  const reorderAt = Date.now();
  sorted.forEach((todo, i) => {
    todo.order = i;
    todo.updatedAt = reorderAt;
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
      touchWorkroomTodo(item);
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
      important: false,
      order: state.workroom.todos.length,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
// WERKRAUM – EINKAUF
// =============================

const WORKROOM_STORE_LABELS = {
  action: "Action",
  tedi: "TEDi",
  hardware: "Baumarkt",
  paper: "Papierhandlung",
  other: "Sonstiges"
};

function workroomShoppingStoreLabel(item) {
  if (!item) return "";
  if (item.store === "other" && item.storeOther) return item.storeOther;
  return WORKROOM_STORE_LABELS[item.store] || item.storeOther || "";
}

function parseWorkroomPrice(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function formatWorkroomPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("de-AT", {style:"currency", currency:"EUR"});
}

function renderWorkroomShopping() {
  const list = document.querySelector("#workroomShoppingList");
  const archive = document.querySelector("#workroomShoppingArchive");
  if (!list || !archive) return;

  state.workroom = normalizeWorkroom(state.workroom);
  const items = [...state.workroom.shopping];

  const active = items
    .filter(x => !x.done)
    .sort((a,b) =>
      String(workroomShoppingStoreLabel(a)).localeCompare(String(workroomShoppingStoreLabel(b)), "de") ||
      Number(a.order ?? 0) - Number(b.order ?? 0) ||
      String(a.name || "").localeCompare(String(b.name || ""), "de")
    );

  if (!active.length) {
    list.innerHTML = `<div class="workroom-empty">Noch nichts für den Werkraum einzukaufen.</div>`;
  } else {
    const grouped = new Map();
    active.forEach(item => {
      const label = workroomShoppingStoreLabel(item) || "Ohne Geschäft";
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(item);
    });

    list.innerHTML = [...grouped.entries()].map(([store, rows]) => `
      <section class="workroom-shopping-store-group">
        <div class="workroom-shopping-store-head">
          <strong>${escapeHtml(store)}</strong>
          <span>${rows.length} ${rows.length === 1 ? "Artikel" : "Artikel"}</span>
        </div>
        <div class="workroom-shopping-store-items">
          ${rows.map(item => `
            <div class="workroom-shopping-row" data-id="${item.id}">
              <input class="workroom-shopping-check" type="checkbox" data-id="${item.id}">
              <div class="workroom-shopping-copy">
                <strong>${escapeHtml(item.name || "")}</strong>
                <div class="workroom-shopping-meta">
                  ${item.qty ? `<span>${escapeHtml(item.qty)}</span>` : ""}
                  ${Number.isFinite(Number(item.price)) ? `<span>${escapeHtml(formatWorkroomPrice(item.price))}</span>` : ""}
                  ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">🔗 Produkt</a>` : ""}
                </div>
              </div>
              <div class="workroom-shopping-actions">
                <button type="button" class="workroom-shopping-edit" data-id="${item.id}" title="Bearbeiten">✎</button>
                <button type="button" class="workroom-shopping-delete" data-id="${item.id}" title="Löschen">×</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  const priced = active.filter(x => Number.isFinite(Number(x.price)));
  const total = priced.reduce((sum,x) => sum + Number(x.price || 0), 0);
  const totalEl = document.querySelector("#workroomShoppingTotal");
  if (totalEl) {
    totalEl.textContent = `Aktiv: ${active.length} ${active.length === 1 ? "Artikel" : "Artikel"}${priced.length ? ` · ${formatWorkroomPrice(total)}` : ""}`;
  }

  const storeTotals = document.querySelector("#workroomShoppingStoreTotals");
  if (storeTotals) {
    const sums = new Map();
    active.forEach(x => {
      if (!Number.isFinite(Number(x.price))) return;
      const store = workroomShoppingStoreLabel(x) || "Ohne Geschäft";
      sums.set(store, (sums.get(store) || 0) + Number(x.price || 0));
    });
    storeTotals.innerHTML = [...sums.entries()]
      .map(([store,sum]) => `<span>${escapeHtml(store)}: ${escapeHtml(formatWorkroomPrice(sum))}</span>`)
      .join("");
  }

  const q = (document.querySelector("#workroomShoppingArchiveSearch")?.value || "").trim().toLowerCase();
  const storeFilter = document.querySelector("#workroomShoppingArchiveStore")?.value || "all";
  const archived = items
    .filter(x => x.done)
    .filter(x => !q || [x.name, x.qty, x.storeOther, workroomShoppingStoreLabel(x)]
      .some(v => String(v || "").toLowerCase().includes(q)))
    .filter(x => storeFilter === "all" || x.store === storeFilter)
    .sort((a,b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));

  archive.innerHTML = archived.length ? archived.map(item => `
    <div class="workroom-shopping-archive-item">
      <div>
        <strong>${escapeHtml(item.name || "")}</strong>
        <span>
          ${item.qty ? `${escapeHtml(item.qty)} · ` : ""}
          ${escapeHtml(workroomShoppingStoreLabel(item) || "ohne Geschäft")}
          ${Number.isFinite(Number(item.price)) ? ` · ${escapeHtml(formatWorkroomPrice(item.price))}` : ""}
        </span>
      </div>
      <div class="workroom-shopping-archive-actions">
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="Produkt öffnen">🔗</a>` : ""}
        <button type="button" class="workroom-shopping-restore" data-id="${item.id}" title="Wieder auf Einkaufsliste">↩</button>
        <button type="button" class="workroom-shopping-archive-delete" data-id="${item.id}" title="Endgültig löschen">×</button>
      </div>
    </div>
  `).join("") : `<div class="workroom-empty">Keine passenden Archivartikel gefunden.</div>`;

  document.querySelectorAll(".workroom-shopping-check").forEach(box => {
    box.addEventListener("change", e => {
      const item = state.workroom.shopping.find(x => x.id === e.currentTarget.dataset.id);
      if (!item) return;
      item.done = true;
      item.completedAt = Date.now();
      item.updatedAt = Date.now();
      save();
      renderWorkroomShopping();
      showMotivation("Einkauf erledigt ✓");
    });
  });

  document.querySelectorAll(".workroom-shopping-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      state.workroom.shoppingTombstones = state.workroom.shoppingTombstones || {};
      state.workroom.shoppingTombstones[id] = Date.now();
      state.workroom.shopping = state.workroom.shopping.filter(x => x.id !== id);
      save();
      persistWorkroomListDeletionImmediately("shopping", id);
      renderWorkroomShopping();
    });
  });

  document.querySelectorAll(".workroom-shopping-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      const item = state.workroom.shopping.find(x => x.id === e.currentTarget.dataset.id);
      if (!item) return;

      document.querySelector("#workroomShoppingName").value = item.name || "";
      document.querySelector("#workroomShoppingQty").value = item.qty || "";
      document.querySelector("#workroomShoppingPrice").value =
        Number.isFinite(Number(item.price)) ? String(item.price).replace(".", ",") : "";
      document.querySelector("#workroomShoppingUrl").value = item.url || "";
      document.querySelector("#workroomShoppingStore").value = item.store || "";
      const other = document.querySelector("#workroomShoppingStoreOther");
      if (other) {
        other.value = item.storeOther || "";
        other.classList.toggle("hidden", item.store !== "other");
      }

      const add = document.querySelector("#addWorkroomShoppingBtn");
      if (add) {
        add.dataset.editId = item.id;
        add.textContent = "Änderung speichern";
      }
    });
  });

  document.querySelectorAll(".workroom-shopping-restore").forEach(btn => {
    btn.addEventListener("click", e => {
      const item = state.workroom.shopping.find(x => x.id === e.currentTarget.dataset.id);
      if (!item) return;
      item.done = false;
      item.completedAt = null;
      item.updatedAt = Date.now();
      item.order = state.workroom.shopping.filter(x => !x.done).length;
      save();
      renderWorkroomShopping();
      showMotivation("Wieder auf der Einkaufsliste ✓");
    });
  });

  document.querySelectorAll(".workroom-shopping-archive-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      state.workroom.shoppingTombstones = state.workroom.shoppingTombstones || {};
      state.workroom.shoppingTombstones[id] = Date.now();
      state.workroom.shopping = state.workroom.shopping.filter(x => x.id !== id);
      save();
      persistWorkroomListDeletionImmediately("shopping", id);
      renderWorkroomShopping();
    });
  });
}

document.querySelector("#workroomShoppingStore")?.addEventListener("change", e => {
  const other = document.querySelector("#workroomShoppingStoreOther");
  if (!other) return;
  const show = e.currentTarget.value === "other";
  other.classList.toggle("hidden", !show);
  if (show) other.focus();
});

document.querySelector("#workroomShoppingArchiveSearch")?.addEventListener("input", renderWorkroomShopping);
document.querySelector("#workroomShoppingArchiveStore")?.addEventListener("change", renderWorkroomShopping);

document.querySelector("#addWorkroomShoppingBtn")?.addEventListener("click", () => {
  state.workroom = normalizeWorkroom(state.workroom);

  const nameInput = document.querySelector("#workroomShoppingName");
  const qtyInput = document.querySelector("#workroomShoppingQty");
  const priceInput = document.querySelector("#workroomShoppingPrice");
  const urlInput = document.querySelector("#workroomShoppingUrl");
  const storeInput = document.querySelector("#workroomShoppingStore");
  const otherInput = document.querySelector("#workroomShoppingStoreOther");
  const button = document.querySelector("#addWorkroomShoppingBtn");

  const name = nameInput?.value.trim() || "";
  if (!name) return;

  const price = parseWorkroomPrice(priceInput?.value || "");
  const store = storeInput?.value || "";
  const storeOther = store === "other" ? (otherInput?.value.trim() || "") : "";
  const editId = button?.dataset.editId;

  if (editId) {
    const item = state.workroom.shopping.find(x => x.id === editId);
    if (item) {
      item.name = name;
      item.qty = qtyInput?.value.trim() || "";
      item.price = price;
      item.url = urlInput?.value.trim() || "";
      item.store = store;
      item.storeOther = storeOther;
      item.updatedAt = Date.now();
    }
    delete button.dataset.editId;
    button.textContent = "+ Eintragen";
    showMotivation("Einkaufsartikel geändert ✓");
  } else {
    state.workroom.shopping.push({
      id: uid(),
      name,
      qty: qtyInput?.value.trim() || "",
      price,
      url: urlInput?.value.trim() || "",
      store,
      storeOther,
      done: false,
      completedAt: null,
      order: state.workroom.shopping.filter(x => !x.done).length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showMotivation("Einkaufsartikel hinzugefügt ✓");
  }

  if (nameInput) nameInput.value = "";
  if (qtyInput) qtyInput.value = "";
  if (priceInput) priceInput.value = "";
  if (urlInput) urlInput.value = "";
  if (storeInput) storeInput.value = "";
  if (otherInput) {
    otherInput.value = "";
    otherInput.classList.add("hidden");
  }

  save();
  renderWorkroomShopping();
});

// =============================
// WERKRAUM – DRUCKLISTE
// =============================

const SCHOOL_PRINT_EMAIL_KEY = "balanceProd.schoolPrintEmail";

function getSchoolPrintEmail(){
  return String(localStorage.getItem(SCHOOL_PRINT_EMAIL_KEY) || "").trim();
}

function syncSchoolPrintEmailUI(){
  const input=document.querySelector("#schoolPrintEmail");
  if(input && document.activeElement!==input) input.value=getSchoolPrintEmail();
}

function setSchoolPrintEmailPanel(open=true){
  const panel=document.querySelector("#schoolPrintEmailPanel");
  const toggle=document.querySelector("#toggleSchoolPrintEmail");
  if(!panel) return;

  panel.classList.toggle("hidden",!open);
  toggle?.setAttribute("aria-expanded",open ? "true" : "false");

  if(open){
    syncSchoolPrintEmailUI();
    window.setTimeout(()=>document.querySelector("#schoolPrintEmail")?.focus(),0);
  }
}

function showSchoolPrintEmail(){
  setSchoolPrintEmailPanel(true);
}

function renderSchoolPrints() {
  // Datensicherheits-Hydration: vorhandene lokale Werkraumdaten haben Vorrang,
  // falls der In-Memory-State durch einen unvollständigen Cloudstand leerer ist.
  try {
    const localWorkroom = JSON.parse(localStorage.getItem("balanceProd.workroom") || "null");
    if (localWorkroom && typeof localWorkroom === "object") {
      const localNorm = normalizeWorkroom(localWorkroom);
      const stateNorm = normalizeWorkroom(state.workroom);
      const localCount =
        localNorm.todos.length + localNorm.prints.length + localNorm.links.length + localNorm.shopping.length;
      const stateCount =
        stateNorm.todos.length + stateNorm.prints.length + stateNorm.links.length + stateNorm.shopping.length;
      if (localCount > stateCount) state.workroom = localNorm;
    }
  } catch (err) {
    console.warn("Werkraum-Lokaldaten konnten nicht gelesen werden:", err);
  }

  const list = document.querySelector("#schoolPrintList");
  if (!list) return;

  state.workroom = normalizeWorkroom(state.workroom);
  syncSchoolPrintEmailUI();

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
        class="workroom-todo-row school-print-row ${p.done ? "done" : ""} ${p.mailOrder ? "school-print-row-mail" : ""}"
        data-print-id="${p.id}">

        <input
          class="workroom-print-check"
          type="checkbox"
          data-id="${p.id}"
          title="Erledigt"
          aria-label="${escapeHtml(p.text)} als erledigt markieren"
          ${p.done ? "checked" : ""}>

        <div class="workroom-todo-content">
          <span class="workroom-todo-text">${escapeHtml(p.text)}</span>
          ${p.mailOrder
            ? `<span class="school-print-mail-badge">✉ per E-Mail bestellen</span>`
            : ""}
        </div>

        <div class="workroom-todo-actions">
          ${p.url
            ? `<a class="workroom-todo-link school-print-action"
                  href="${escapeHtml(p.url)}"
                  target="_blank"
                  rel="noopener"
                  title="Datei oder Link öffnen"
                  aria-label="Datei oder Link öffnen">↗</a>`
            : ""}

          <button
            class="workroom-print-mail-order school-print-action ${p.mailOrder ? "active" : ""}"
            type="button"
            data-id="${p.id}"
            title="${p.mailOrder ? "Nicht per E-Mail bestellen" : "Per E-Mail bestellen"}"
            aria-label="${p.mailOrder ? "Nicht per E-Mail bestellen" : "Per E-Mail bestellen"}"
            aria-pressed="${p.mailOrder ? "true" : "false"}">✉</button>

          <button
            class="workroom-print-edit school-print-action"
            type="button"
            data-id="${p.id}"
            title="Bearbeiten"
            aria-label="Bearbeiten">✎</button>

          <button
            class="workroom-print-delete school-print-action"
            type="button"
            data-id="${p.id}"
            title="Löschen"
            aria-label="Löschen">×</button>

          <span class="school-print-touch-move" aria-label="Auf dem Tablet verschieben">
            <button class="workroom-print-move-up"
                    type="button"
                    data-id="${p.id}"
                    title="Nach oben"
                    aria-label="Nach oben">↑</button>
            <button class="workroom-print-move-down"
                    type="button"
                    data-id="${p.id}"
                    title="Nach unten"
                    aria-label="Nach unten">↓</button>
          </span>

          <span
            class="workroom-drag-handle school-print-drag"
            title="Ziehen zum Verschieben"
            aria-label="Ziehen zum Verschieben">⠿</span>
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
      item.updatedAt = Date.now();

      save();
      renderSchoolPrints();

      if (item.done) {
        setTimeout(() => {
          const currentItem = state.workroom.prints.find(p => p.id === id);
          if (!currentItem || !currentItem.done) return;

          state.workroom.printTombstones = state.workroom.printTombstones || {};
          state.workroom.printTombstones[id] = Date.now();
          state.workroom.prints =
            state.workroom.prints.filter(p => p.id !== id);

          save();
          persistWorkroomListDeletionImmediately("prints", id);
          renderSchoolPrints();
        }, 60000);
      }
    });
  });

  // The envelope in each row means ONE thing only:
  // include/exclude this print job in the e-mail order.
  document.querySelectorAll(".workroom-print-mail-order").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      const item = state.workroom.prints.find(p => p.id === id);
      if (!item) return;

      item.mailOrder = !item.mailOrder;
      item.updatedAt = Date.now();
      save();
      renderSchoolPrints();
    });
  });

  document.querySelectorAll(".workroom-print-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      state.workroom.printTombstones = state.workroom.printTombstones || {};
      state.workroom.printTombstones[id] = Date.now();
      state.workroom.prints = state.workroom.prints.filter(p => p.id !== id);
      save();
      persistWorkroomListDeletionImmediately("prints", id);
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

  function moveSchoolPrintByStep(id, delta) {
    const ordered=[...state.workroom.prints].sort((a,b)=>(a.order??0)-(b.order??0));
    const index=ordered.findIndex(p=>p.id===id);
    const target=index+delta;
    if(index<0 || target<0 || target>=ordered.length) return;

    [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
    ordered.forEach((item,order)=>{ item.order=order; item.updatedAt=Date.now(); });
    state.workroom.prints=ordered;
    save();
    renderSchoolPrints();
  }

  document.querySelectorAll(".workroom-print-move-up").forEach(btn=>{
    btn.addEventListener("click",e=>moveSchoolPrintByStep(e.currentTarget.dataset.id,-1));
  });

  document.querySelectorAll(".workroom-print-move-down").forEach(btn=>{
    btn.addEventListener("click",e=>moveSchoolPrintByStep(e.currentTarget.dataset.id,1));
  });

  // Desktop: drag handle; Tablet/Touch: arrow buttons.
  if (typeof Sortable !== "undefined") {
    const printList = document.querySelector("#schoolPrintList");

    if (printList) {
      new Sortable(printList, {
        animation: 150,
        handle: ".workroom-drag-handle",
        draggable: ".workroom-todo-row",
        filter: ".workroom-print-check,.workroom-todo-actions button,.workroom-todo-actions a",
        preventOnFilter: false,
        ghostClass: "workroom-sort-ghost",
        chosenClass: "workroom-sort-chosen",
        dragClass: "workroom-sort-drag",

        onEnd: () => {
          const ids = [...printList.querySelectorAll(".workroom-todo-row")]
            .map(row => row.dataset.printId);

          ids.forEach((id, index) => {
            const item = state.workroom.prints.find(p => p.id === id);
            if (item) {
              item.order = index;
              item.updatedAt = Date.now();
            }
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
      item.updatedAt = Date.now();
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
      mailOrder: false,
      order: state.workroom.prints.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  textInput.value = "";
  if (linkInput) linkInput.value = "";

  save();
  renderSchoolPrints();
});

document.querySelector("#toggleSchoolPrintEmail")?.addEventListener("click", e=>{
  e.stopPropagation();
  const panel=document.querySelector("#schoolPrintEmailPanel");
  const willOpen=!!panel?.classList.contains("hidden");
  setSchoolPrintEmailPanel(willOpen);
});

document.querySelector("#saveSchoolPrintEmailBtn")?.addEventListener("click",()=>{
  const input=document.querySelector("#schoolPrintEmail");
  const value=String(input?.value || "").trim();
  if(value && !/^\S+@\S+\.\S+$/.test(value)){
    showMotivation("Bitte eine gültige E-Mail-Adresse eintragen.");
    input?.focus();
    return;
  }
  if(value) localStorage.setItem(SCHOOL_PRINT_EMAIL_KEY,value);
  else localStorage.removeItem(SCHOOL_PRINT_EMAIL_KEY);
  syncSchoolPrintEmailUI();
  showMotivation(value ? "Druck-E-Mail gespeichert." : "Druck-E-Mail entfernt.");
  setSchoolPrintEmailPanel(true);
});

// =============================
// WERKRAUM – LINKSAMMLUNG
// =============================

let activeWorkroomLinkCategory = "all";
let activeWorkroomLinkUse = "all";
let activeWorkroomLinkImportant = false;
let activeWorkroomLinkSort = "manual";
let workroomLinkPage = 1;
const WORKROOM_LINKS_PER_PAGE = 20; // 2 Spalten × höchstens 10 Zeilen


function normalizedWorkroomLinkUrl(url){
  try{
    const u=new URL(String(url||"").trim());
    u.hash="";
    if(u.pathname.length>1) u.pathname=u.pathname.replace(/\/+$/,"");
    return u.toString().toLowerCase();
  }catch{
    return String(url||"").trim().replace(/\/+$/,"").toLowerCase();
  }
}

function cleanupDuplicateWorkroomLinks(){
  state.workroom=normalizeWorkroom(state.workroom);

  const seen=new Set();
  const cleaned=[];

  // Newest copy wins when the same exact destination was accidentally stored twice.
  [...state.workroom.links]
    .sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0))
    .forEach(link=>{
      const key=normalizedWorkroomLinkUrl(link.url);
      if(key && seen.has(key)) return;
      if(key) seen.add(key);
      cleaned.push(link);
    });

  if(cleaned.length!==state.workroom.links.length){
    state.workroom.links=cleaned;
    save();
  }
}

function ensureWorkroomLinkOrder(){
  state.workroom=normalizeWorkroom(state.workroom);

  const hasMissing=state.workroom.links.some(link=>!Number.isFinite(Number(link.order)));
  if(!hasMissing) return;

  // Preserve the currently familiar newest-first order once, then user order takes over.
  const initial=[...state.workroom.links].sort((a,b)=>{
    if(!!b.important!==!!a.important) return Number(!!b.important)-Number(!!a.important);
    return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);
  });

  initial.forEach((link,index)=>link.order=index);
  state.workroom.links=initial;
  save();
}

function workroomLinkEffectiveCategory(link){
  // Alte Daten werden weiterhin sinnvoll einsortiert.
  if(link.category==="current" || link.category==="private") return "other";
  if(link.use==="bureaucracy" && (link.category==="other" || !link.category)) return "bureaucracy";
  return link.category || "other";
}

function workroomLinkEffectiveUse(link){
  // Frühere doppelte Kategorien "Aktuell/Privat" werden als Zeitraum verstanden.
  if(link.category==="current") return "current";
  if(link.category==="private") return "private";
  // Bürokratie gehört jetzt zu MABÜ, nicht mehr zum Zeitraum.
  if(link.use==="bureaucracy") return "soon";
  return link.use || "soon";
}

function workroomLinkMatchesSort(link, sortKey){
  if(sortKey==="soon") return workroomLinkEffectiveUse(link)==="soon";
  if(sortKey==="year") return workroomLinkEffectiveUse(link)==="year";
  if(sortKey==="current") return workroomLinkEffectiveUse(link)==="current";
  if(sortKey==="later") return workroomLinkEffectiveUse(link)==="later";
  if(sortKey==="private") return workroomLinkEffectiveUse(link)==="private";
  return false;
}

function renderWorkroomLinks() {
  try {
    const localWorkroom = JSON.parse(localStorage.getItem("balanceProd.workroom") || "null");
    if (localWorkroom && typeof localWorkroom === "object") {
      const localNorm = normalizeWorkroom(localWorkroom);
      const stateNorm = normalizeWorkroom(state.workroom);
      const localCount =
        localNorm.todos.length + localNorm.prints.length + localNorm.links.length + localNorm.shopping.length;
      const stateCount =
        stateNorm.todos.length + stateNorm.prints.length + stateNorm.links.length + stateNorm.shopping.length;
      if (localCount > stateCount) state.workroom = localNorm;
    }
  } catch (err) {
    console.warn("Werkraum-Lokaldaten konnten nicht gelesen werden:", err);
  }

  const list = document.querySelector("#workroomLinkList");
  const pager = document.querySelector("#workroomLinkPager");
  const pageLabel = document.querySelector("#workroomLinkPageLabel");
  const prevBtn = document.querySelector("#workroomLinkPrevPage");
  const nextBtn = document.querySelector("#workroomLinkNextPage");
  if (!list) return;

  state.workroom = normalizeWorkroom(state.workroom);
  cleanupDuplicateWorkroomLinks();
  ensureWorkroomLinkOrder();

  const useLabels = {
    soon: "Demnächst",
    current: "📌 Aktuell",
    year: "🗓 Jahresplanung",
    later: "🌙 Später vorgemerkt",
    private: "♡ Privat"
  };

  const workroomLinkSearchBar=ensureCollectionSearchBar({
    anchor:list,
    id:"workroomLinkSearchBar",
    placeholder:"Fundstücke suchen …",
    value:collectionSearchState.workroomLinks,
    visible:true,
    onInput:value=>{
      collectionSearchState.workroomLinks=value;
      workroomLinkPage=1;
      renderWorkroomLinks();
    }
  });

  const allWorkroomLinks=[...state.workroom.links];

  let links = allWorkroomLinks
    .filter(link =>
      activeWorkroomLinkCategory === "all" ||
      workroomLinkEffectiveCategory(link) === activeWorkroomLinkCategory
    )
    .filter(link =>
      activeWorkroomLinkUse === "all" ||
      workroomLinkEffectiveUse(link) === activeWorkroomLinkUse
    )
    .filter(link =>
      !activeWorkroomLinkImportant || !!link.important
    )
    .filter(link =>
      collectionSearchMatches(collectionSearchState.workroomLinks,[
        link.title,
        link.note,
        link.url,
        workroomLinkEffectiveCategory(link),
        workroomLinkEffectiveUse(link)
      ])
    )
    .sort((a,b)=>Number(a.order??999999)-Number(b.order??999999));

  updateCollectionSearchCount(
    workroomLinkSearchBar,
    links.length,
    allWorkroomLinks.length,
    links.length===1 ? "Link" : "Links"
  );

  // Sortierung ist nur eine Ansicht. Die manuelle Reihenfolge in state bleibt unverändert.
  // Gewählte Gruppe zuerst; danach werden auch die übrigen Gruppen sauber gebündelt.
  // Innerhalb jeder Gruppe bleibt die eigene Reihenfolge erhalten.
  if(activeWorkroomLinkSort !== "manual"){
    const baseOrder = ["soon","year","private","current","later"];
    const groupOrder = [
      activeWorkroomLinkSort,
      ...baseOrder.filter(key => key !== activeWorkroomLinkSort)
    ];

    // Sortiert wird hier ausschließlich nach Zeitraum.
    // Bürokratie ist eine MABÜ-Kategorie und bleibt davon unabhängig.
    const groupKey = link => workroomLinkEffectiveUse(link);

    const rank = new Map(groupOrder.map((key,index) => [key,index]));

    links = links
      .map((link,index) => ({ link, index }))
      .sort((a,b) => {
        const aSelected = workroomLinkMatchesSort(a.link, activeWorkroomLinkSort) ? 0 : 1;
        const bSelected = workroomLinkMatchesSort(b.link, activeWorkroomLinkSort) ? 0 : 1;
        if(aSelected !== bSelected) return aSelected - bSelected;

        const aRank = rank.get(groupKey(a.link)) ?? groupOrder.length;
        const bRank = rank.get(groupKey(b.link)) ?? groupOrder.length;
        if(aRank !== bRank) return aRank - bRank;

        return a.index - b.index;
      })
      .map(entry => entry.link);
  }

  const totalPages=Math.max(1,Math.ceil(links.length/WORKROOM_LINKS_PER_PAGE));
  workroomLinkPage=Math.min(Math.max(1,workroomLinkPage),totalPages);
  const start=(workroomLinkPage-1)*WORKROOM_LINKS_PER_PAGE;
  const pageLinks=links.slice(start,start+WORKROOM_LINKS_PER_PAGE);

  if (!links.length) {
    list.innerHTML =
      `<div class="workroom-empty">Keine Links passen zu diesem Filter.</div>`;
    pager?.classList.add("hidden");
    return;
  }

  list.innerHTML = pageLinks.map((link,pageIndex) => {
    const effectiveUse=workroomLinkEffectiveUse(link);
    const visualColumn=pageIndex < 10 ? 1 : 2;
    const visualRow=(pageIndex % 10) + 1;
    return `
    <div class="workroom-link-item ${link.important ? "workroom-link-item-important" : ""} ${effectiveUse === "private" ? "workroom-link-item-private" : ""}"
         style="grid-column:${visualColumn};grid-row:${visualRow}"
         data-category="${escapeHtml(workroomLinkEffectiveCategory(link))}"
         data-id="${link.id}">
      <span class="workroom-link-drag-handle"
            title="Ziehen zum Verschieben"
            aria-label="Ziehen zum Verschieben">⠿</span>

      <div class="workroom-link-main">
        <div class="workroom-link-texts">
          <a
            href="${escapeHtml(link.url)}"
            target="_blank"
            rel="noopener"
            class="workroom-link-title">
            ${link.important ? `<span class="workroom-link-star" title="Wichtig">★</span>` : ""}
            ${escapeHtml(link.title)}
          </a>

          ${link.note
            ? `<span class="workroom-link-note">${escapeHtml(link.note)}</span>`
            : ""}

        </div>
      </div>

      <div class="workroom-link-actions">
        <span class="workroom-link-use">${useLabels[effectiveUse] || "Demnächst"}</span>
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

        <span class="workroom-link-touch-move" aria-label="Auf dem Tablet verschieben">
          <button class="workroom-link-move-up"
                  type="button"
                  data-id="${link.id}"
                  title="Nach oben">↑</button>
          <button class="workroom-link-move-down"
                  type="button"
                  data-id="${link.id}"
                  title="Nach unten">↓</button>
        </span>
      </div>
    </div>`;
  }).join("");

  if(pager){
    pager.classList.toggle("hidden",links.length===0);
    if(pageLabel) pageLabel.textContent=`Seite ${workroomLinkPage} von ${totalPages} · ${links.length} ${links.length===1 ? "Link" : "Links"}`;
    if(prevBtn) prevBtn.disabled=workroomLinkPage<=1;
    if(nextBtn) nextBtn.disabled=workroomLinkPage>=totalPages;
  }

  list.querySelectorAll(".workroom-link-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      state.workroom.linkTombstones = state.workroom.linkTombstones || {};
      state.workroom.linkTombstones[id] = Date.now();
      state.workroom.links = state.workroom.links.filter(link => link.id !== id);
      [...state.workroom.links]
        .sort((a,b)=>Number(a.order??999999)-Number(b.order??999999))
        .forEach((link,index)=>{
          link.order=index;
          link.updatedAt=Date.now();
        });
      save();
      persistWorkroomListDeletionImmediately("links", id);
      renderWorkroomLinks();
      renderRoutines();
    });
  });

  list.querySelectorAll(".workroom-link-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      const link = state.workroom.links.find(link => link.id === id);
      if (!link) return;

      document.querySelector("#workroomLinkTitle").value = link.title || "";
      document.querySelector("#workroomLinkNote").value = link.note || "";
      document.querySelector("#workroomLinkUrl").value = link.url || "";

      const cat=document.querySelector("#workroomLinkCategory");
      const use=document.querySelector("#workroomLinkUse");
      if(cat) cat.value=workroomLinkEffectiveCategory(link);
      if(use) use.value=workroomLinkEffectiveUse(link);
      document.querySelector("#workroomLinkImportant").checked = !!link.important;

      const addBtn = document.querySelector("#addWorkroomLinkBtn");
      addBtn.dataset.editId = link.id;
      addBtn.textContent = "Änderung speichern";
    });
  });

  function moveWorkroomLinkByStep(id, delta){
    if(activeWorkroomLinkSort!=="manual"){
      showMotivation("Zum Verschieben zuerst auf „Eigene Reihenfolge“ zurückgehen.");
      return;
    }

    const all=[...state.workroom.links]
      .sort((a,b)=>Number(a.order??999999)-Number(b.order??999999));

    const index=all.findIndex(link=>link.id===id);
    const target=index+delta;
    if(index<0 || target<0 || target>=all.length) return;

    [all[index],all[target]]=[all[target],all[index]];
    all.forEach((link,order)=>{ link.order=order; link.updatedAt=Date.now(); });
    state.workroom.links=all;
    save();
    renderWorkroomLinks();
  }

  list.querySelectorAll(".workroom-link-move-up").forEach(btn=>{
    btn.addEventListener("click",e=>{
      moveWorkroomLinkByStep(e.currentTarget.dataset.id,-1);
    });
  });

  list.querySelectorAll(".workroom-link-move-down").forEach(btn=>{
    btn.addEventListener("click",e=>{
      moveWorkroomLinkByStep(e.currentTarget.dataset.id,1);
    });
  });

  // Manuelles Ziehen ist nur in der eigenen Reihenfolge sinnvoll.
  if(typeof Sortable!=="undefined" && activeWorkroomLinkSort==="manual"){
    new Sortable(list,{
      animation:160,
      handle:".workroom-link-drag-handle",
      draggable:".workroom-link-item",
      ghostClass:"workroom-sort-ghost",
      chosenClass:"workroom-sort-chosen",
      dragClass:"workroom-sort-drag",
      filter:".workroom-link-actions,.workroom-link-actions *,a,button,input,select,textarea",
      preventOnFilter:false,

      onEnd:()=>{
        const visibleIds=[...list.querySelectorAll(".workroom-link-item")].map(row=>row.dataset.id);
        const all=[...state.workroom.links]
          .sort((a,b)=>Number(a.order??999999)-Number(b.order??999999));

        // Nur die Slots dieser Seite werden verschoben; alle anderen Seiten bleiben stabil.
        const visibleSet=new Set(visibleIds);
        const slots=[];
        all.forEach((item,index)=>{
          if(visibleSet.has(item.id)) slots.push(index);
        });

        visibleIds.forEach((id,i)=>{
          const replacement=state.workroom.links.find(link=>link.id===id);
          if(replacement && slots[i]!==undefined) all[slots[i]]=replacement;
        });

        all.forEach((link,index)=>{ link.order=index; link.updatedAt=Date.now(); });
        state.workroom.links=all;
        save();
        renderWorkroomLinks();
      }
    });
  }
}

// Link speichern / bearbeiten
document.querySelector("#addWorkroomLinkBtn")?.addEventListener("click", () => {
  const titleInput = document.querySelector("#workroomLinkTitle");
  const noteInput = document.querySelector("#workroomLinkNote");
  const urlInput = document.querySelector("#workroomLinkUrl");
  const categoryInput = document.querySelector("#workroomLinkCategory");
  const useInput = document.querySelector("#workroomLinkUse");
  const importantInput = document.querySelector("#workroomLinkImportant");
  const button = document.querySelector("#addWorkroomLinkBtn");

  const title = titleInput?.value.trim() || "";
  const note = noteInput?.value.trim() || "";
  let url = urlInput?.value.trim() || "";
  const category = categoryInput?.value || "other";
  const use = useInput?.value || "soon";
  const important = !!importantInput?.checked;

  if (!title || !url) return;

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const editId = button?.dataset.editId;

  if (editId) {
    const item = state.workroom.links.find(link => link.id === editId);

    if (item) {
      item.title = title;
      item.note = note;
      item.url = url;
      item.category = category;
      item.use = use;
      item.important = important;
      item.updatedAt = Date.now();
    }

    delete button.dataset.editId;
    button.textContent = "+ Speichern";
  } else {
    const duplicate=state.workroom.links.find(link=>
      normalizedWorkroomLinkUrl(link.url)===normalizedWorkroomLinkUrl(url)
    );

    if(duplicate){
      showMotivation("Dieser Link ist bereits gespeichert.");
      return;
    }

    // New links always go to the top.
    state.workroom.links.forEach(link=>{
      link.order=(Number(link.order)||0)+1;
    });

    state.workroom.links.unshift({
      id: uid(),
      title,
      note,
      url,
      category,
      use,
      important,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  if (titleInput) titleInput.value = "";
  if (noteInput) noteInput.value = "";
  if (urlInput) urlInput.value = "";
  if (categoryInput) categoryInput.value = "wood";
  if (useInput) useInput.value = "soon";
  if (importantInput) importantInput.checked = false;

  save();
  workroomLinkPage = 1;
  renderWorkroomLinks();
  renderRoutines();
});

// Kategorie-Filter
document.querySelector("#workroomLinkCategoryFilter")?.addEventListener("change", e => {
  activeWorkroomLinkCategory = e.currentTarget.value || "all";
  workroomLinkPage = 1;
  renderWorkroomLinks();
  renderRoutines();
});

// Zeitraum-Filter
document.querySelector("#workroomLinkUseFilterSelect")?.addEventListener("change", e => {
  activeWorkroomLinkUse = e.currentTarget.value || "all";
  workroomLinkPage = 1;
  renderWorkroomLinks();
  renderRoutines();
});

// Wichtig-Filter
document.querySelector("#workroomLinkImportantFilter")?.addEventListener("click", e => {
  activeWorkroomLinkImportant = !activeWorkroomLinkImportant;
  workroomLinkPage = 1;
  e.currentTarget.classList.toggle("active", activeWorkroomLinkImportant);
  e.currentTarget.setAttribute("aria-pressed", activeWorkroomLinkImportant ? "true" : "false");
  renderWorkroomLinks();
  renderRoutines();
});

document.querySelector("#workroomLinkSortSelect")?.addEventListener("change", e => {
  activeWorkroomLinkSort = e.currentTarget.value || "manual";
  workroomLinkPage = 1;

  const reset=document.querySelector("#resetWorkroomLinkSort");
  reset?.classList.toggle("hidden",activeWorkroomLinkSort==="manual");

  renderWorkroomLinks();
});

document.querySelector("#resetWorkroomLinkSort")?.addEventListener("click", () => {
  activeWorkroomLinkSort = "manual";
  workroomLinkPage = 1;

  const select=document.querySelector("#workroomLinkSortSelect");
  if(select) select.value="manual";

  document.querySelector("#resetWorkroomLinkSort")?.classList.add("hidden");
  renderWorkroomLinks();
});

document.querySelector("#workroomLinkPrevPage")?.addEventListener("click", () => {
  if(workroomLinkPage>1){
    workroomLinkPage--;
    renderWorkroomLinks();
  }
});

document.querySelector("#workroomLinkNextPage")?.addEventListener("click", () => {
  workroomLinkPage++;
  renderWorkroomLinks();
});

// Der frühere Startseiten-Button "#addVideoBtn" wurde bewusst entfernt.
// Videos werden jetzt über Werkraum → Routinen gepflegt.
// Deshalb darf hier kein Listener mehr auf ein nicht vorhandenes Element gesetzt werden.

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
  document.querySelector("#entryType").value = window.matchMedia("(max-width:700px)").matches ? "event" : "todo";
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
  document.querySelector("#eventPlingEnabled").checked = false;
  document.querySelector("#eventPlingMinutes").value = "15";
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


function updateWeeklyEventDateHint() {
  const recurrence = document.querySelector("#recurrence");
  const type = document.querySelector("#entryType");
  const input = document.querySelector("#eventDate");
  if (!recurrence || !type || !input) return;

  const weeklyEvent = type.value === "event" && recurrence.value === "weekly";
  const field = input.closest("label, .field, .form-field");
  if (field) {
    const ownTextNodes = [...field.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
    if (ownTextNodes.length) {
      ownTextNodes[0].nodeValue = weeklyEvent
        ? "Startdatum (bestimmt den Wochentag) "
        : "Startdatum ";
    }
  }
  input.title = weeklyEvent
    ? "Das Datum legt fest, an welchem Wochentag der Termin wöchentlich wiederholt wird und ab wann er beginnt."
    : "";
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
  document.querySelector("#eventCategoryTopField")?.classList.toggle("hidden", !isEvent);
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
  updateWeeklyEventDateHint();
}

if (window.matchMedia("(max-width:700px)").matches && !editingTodoId) {
  const mobileType = document.querySelector("#entryType");
  if (mobileType) mobileType.value = "event";
  updateEntryTypeUI();
}

document.querySelector("#entryType").addEventListener("change", updateEntryTypeUI);
document.querySelector("#recurrence").addEventListener("change", updateEntryTypeUI);
document.querySelector("#todoPeriod").addEventListener("change", updateEntryTypeUI);
document.querySelector("#eventCategory").addEventListener("change", updateEntryTypeUI);
document.querySelector("#todoPriority")?.addEventListener("change",()=>{if(document.querySelector("#todoPriority").value==="weekplan"){document.querySelector("#todoPeriod").value="week";document.querySelector("#recurrence").value="weekly";updateEntryTypeUI();}});

document.querySelector("#cancelTodoEditBtn").addEventListener("click", resetTodoEditor);

document.querySelector("#addTodoBtn").addEventListener("click", () => {
  const textInput = document.querySelector("#todoText");
  const text = textInput.value.trim();
  const type = document.querySelector("#entryType").value;

  if (!text) {
    alert(type === "event"
      ? "Bitte zuerst den Termin eintragen."
      : "Bitte zuerst die Aufgabe eintragen.");
    textInput.focus();
    return;
  }

  const period = document.querySelector("#todoPeriod").value;
  const todayDate = new Date();
  const selectedDay = period === "today"
    ? weekdayNameForDate(todayDate)
    : document.querySelector("#todoDay").value;
  const selectedFamily = selectedFamilyMembers();
  const selectedPriority=document.querySelector("#todoPriority").value;
  let recurrence=document.querySelector("#recurrence").value;
  if(type==="todo"&&selectedPriority==="weekplan")recurrence="weekly";
 const eventDate = document.querySelector("#eventDate").value;
const eventEndDate = document.querySelector("#eventEndDate")?.value || "";
const eventTime = document.querySelector("#eventTime").value;
const eventEndTime = document.querySelector("#eventEndTime")?.value || "";
  const eventCategory = document.querySelector("#eventCategory")?.value || "normal";
  const plingEnabled = type === "event"
    ? !!document.querySelector("#eventPlingEnabled")?.checked
    : false;
  const plingMinutesRaw = Number(document.querySelector("#eventPlingMinutes")?.value || 15);
  const plingMinutes = [5,10,15,20,30,45,60,90,120].includes(plingMinutesRaw)
    ? plingMinutesRaw
    : 15;
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

  if(type==="todo"&&selectedPriority==="weekplan"&&!selectedDay){alert("Für einen Wochenplan-Eintrag bitte einen Wochentag auswählen.");return;}

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
    item.priority = selectedPriority;
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
    item.plingEnabled = type === "event" ? plingEnabled : false;
    item.plingMinutes = type === "event" ? plingMinutes : 15;
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
      priority: selectedPriority,
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
      plingEnabled: type === "event" ? plingEnabled : false,
      plingMinutes: type === "event" ? plingMinutes : 15,
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
  const next = btn.dataset.filter;
  const isAlreadyOpen = todoFilter === next && btn.classList.contains("active");

  document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));

  if (isAlreadyOpen) {
    todoFilter = null;
  } else {
    todoFilter = next;
    btn.classList.add("active");
  }

  renderTodos();
}));

document.querySelectorAll(".archive-filter").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".archive-filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  archiveFilter = btn.dataset.archive;
  renderArchive();
}));


const recipePlanDialog = document.querySelector("#recipePlanDialog");
const closeRecipePlanDialogBtn = document.querySelector("#closeRecipePlanDialogBtn");
const cancelRecipePlanBtn = document.querySelector("#cancelRecipePlanBtn");
const confirmRecipePlanBtn = document.querySelector("#confirmRecipePlanBtn");

function closeRecipePlanDialog() {
  replanRecipeLink = null;
  if (recipePlanDialog?.open) recipePlanDialog.close();
}
closeRecipePlanDialogBtn?.addEventListener("click", closeRecipePlanDialog);
cancelRecipePlanBtn?.addEventListener("click", closeRecipePlanDialog);
recipePlanDialog?.addEventListener("click", e => {
  if (e.target === recipePlanDialog) closeRecipePlanDialog();
});

confirmRecipePlanBtn?.addEventListener("click", () => {
  if (!replanRecipeLink?.url) return closeRecipePlanDialog();

  const weeksAhead = Number(document.querySelector("#recipePlanWeek")?.value || 0);
  const day = document.querySelector("#recipePlanDay")?.value || "Montag";
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weeksAhead * 7);
  const target = new Date(monday);
  target.setDate(monday.getDate() + Math.max(0, WEEK_DAYS.indexOf(day)));
  const key = dateKey(target);
  const planned = {...replanRecipeLink};

  const list = normalizeMealEntries(state.meals?.[key]);
  list.push({
    id:uid(), label:planned.label || "Rezept", recipeId:planned.recipeId || "",
    url:planned.url || "", deleted:false, updatedAt:Date.now()
  });
  state.meals[key] = list;
  save();
  closeRecipePlanDialog();
  renderMealPlan();
  renderWeek();
  showMotivation(`${planned.label || "Rezept"} ist am ${day} im Essensplan.`);
});

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
  const weeksAhead = Number(document.querySelector("#replanWeek").value || 0);
  const day = document.querySelector("#replanDay").value;


  const item = state.archive.find(a => a.id === replanArchiveId);
  if (!item) {
    closeReplanDialog();
    return;
  }

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weeksAhead * 7);

  const routines=ensureWorkroomRoutines();
  const part=document.querySelector("#replanPart")?.value || "morning";
  const weekKey=dateKey(monday);

  const alreadyPlanned=routines.items.some(existing=>{
    if(existing.weekKey!==weekKey || existing.day!==day || (existing.part||"morning")!==part) return false;
    if(existing.sourceArchiveId && existing.sourceArchiveId===item.id) return true;
    if(!existing.url || !item.url) return false;
    try{return normalizeUrl(existing.url)===normalizeUrl(item.url);}
    catch{return String(existing.url).trim()===String(item.url).trim();}
  });

  if(alreadyPlanned){
    showMotivation(`${item.title || "Übung"} ist dort bereits eingeplant.`);
    return;
  }

  routines.items.push({
    id:uid(),
    title:item.title || "Routinevideo",
    url:item.url,
    category:item.category || "other",
    part,
    day,
    sticky:false,
    weekKey,
    sourceArchiveId:item.id,
    createdAt:Date.now(),
    updatedAt:Date.now(),
    order:routines.items.length
  });

  // Wiederverwenden ist eine Planung, kein Verschieben:
  // Das Video bleibt in "Unser Überblick" sichtbar und kann mehrfach geplant werden.
  item.updatedAt=Date.now();

  save();
  replanArchiveId = null;
  replanDialog.close();

  // Direkt die Routinen öffnen und auf die geplante Woche springen.
  activeRoutineWeekOffset=weeksAhead;
  const body=document.querySelector("#workroomRoutineBody");
  const toggle=document.querySelector("#toggleRoutinePanelBtn");
  body?.classList.remove("hidden");
  toggle?.classList.add("open");
  toggle?.setAttribute("aria-expanded","true");

  renderRoutines();
  renderArchive();

  document.querySelector('[data-view="workroom"]')?.click();
  document.querySelector(".workroom-routine-card")?.scrollIntoView({behavior:"smooth",block:"start"});
  showMotivation(`${item.title || "Übung"} ist für ${weeksAhead===0?"diese Woche":weeksAhead===1?"nächste Woche":`in ${weeksAhead} Wochen`} am ${day} eingeplant.`);
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

    // Auch eingeplante VIDEOS aus den Routinen entfernen.
    // Reine Routinepunkte wie "Wasser trinken" bleiben selbstverständlich bestehen.
    const routines=ensureWorkroomRoutines();
    const removedIds=new Set(
      routines.items.filter(item=>!!item.url).map(item=>item.id)
    );
    routines.items=routines.items.filter(item=>!item.url);

    Object.keys(routines.completions||{}).forEach(key=>{
      const itemId=String(key).split("__")[0];
      if(removedIds.has(itemId)) delete routines.completions[key];
    });

    save();
    renderAll();
    showMotivation("Alle Übungen und eingeplanten Videos wurden gelöscht.");
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


// =========================================================
// DATENSICHERHEIT V8 – Cloud darf lokale Daten nicht still löschen
// =========================================================

const AUTO_SAFETY_PREFIX = "balanceProd.autoSafety.";
const AUTO_SAFETY_SLOTS = 5;
let lastAutoSafetyAt = 0;

function makeLocalSafetySnapshot(reason = "auto", force = false) {
  try {
    const now = Date.now();
    if (!force && now - lastAutoSafetyAt < 60_000) return;
    lastAutoSafetyAt = now;

    const payload = {
      savedAt: now,
      reason,
      videos: state.videos,
      todos: state.todos,
      trash: state.trash || [],
      todoTombstones: state.todoTombstones || {},
      videoTombstones: state.videoTombstones || {},
      archiveTombstones: state.archiveTombstones || {},
      recipeTombstones: state.recipeTombstones || {},
      pinboardTombstones: state.pinboardTombstones || {},
      trashTombstones: state.trashTombstones || {},
      archive: state.archive,
        recipes: state.recipes,
      meals: state.meals,
      pinboard: state.pinboard,
      recipeLinkFeedback: state.recipeLinkFeedback,
      workroom: state.workroom,
      school: state.school,
      familySettings: state.familySettings,
      settings: state.settings || {}
    };

    for (let i = AUTO_SAFETY_SLOTS; i >= 2; i--) {
      const prev = localStorage.getItem(AUTO_SAFETY_PREFIX + (i - 1));
      if (prev) localStorage.setItem(AUTO_SAFETY_PREFIX + i, prev);
    }
    localStorage.setItem(AUTO_SAFETY_PREFIX + "1", JSON.stringify(payload));
  } catch (err) {
    console.warn("Automatische Datensicherung konnte nicht erstellt werden:", err);
  }
}

function itemTimestamp(item) {
  if (!item || typeof item !== "object") return 0;
  return Number(item.updatedAt || item.completedAt || item.createdAt || 0) || 0;
}

function guardedMergeById(localValue, cloudValue, sectionName = "Daten") {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(cloudValue) ? cloudValue : [];

  if (!local.length) return remote;
  if (!remote.length) {
    console.warn(`Cloud-Sicherheitsblock: ${sectionName} wäre von ${local.length} auf 0 gefallen – lokale Daten bleiben erhalten.`);
    return local;
  }

  const result = [...local];
  const localById = new Map(local.filter(x => x?.id).map(x => [x.id, x]));
  const newestLocalTs = local.reduce((m, x) => Math.max(m, itemTimestamp(x)), 0);

  for (const remoteItem of remote) {
    if (!remoteItem?.id) continue;
    const localItem = localById.get(remoteItem.id);

    if (localItem) {
      const newer = itemTimestamp(remoteItem) > itemTimestamp(localItem) ? remoteItem : localItem;
      const index = result.findIndex(x => x?.id === remoteItem.id);
      if (index >= 0) result[index] = newer;
      continue;
    }

    const remoteTs = itemTimestamp(remoteItem);
    if (remoteTs && remoteTs > newestLocalTs) {
      result.push(remoteItem);
    } else {
      console.warn(`Cloud-Sicherheitsblock: älterer/nicht datierbarer Cloud-Eintrag in ${sectionName} nicht automatisch zurückgeholt:`, remoteItem);
    }
  }

  return result;
}

function mergeWorkroomTodoTombstones(localValue, remoteValue) {
  const local = localValue && typeof localValue === "object" ? localValue : {};
  const remote = remoteValue && typeof remoteValue === "object" ? remoteValue : {};
  const merged = {...local};

  Object.entries(remote).forEach(([id, ts]) => {
    const remoteTs = Number(ts || 0);
    const localTs = Number(merged[id] || 0);
    if (remoteTs > localTs) merged[id] = remoteTs;
  });

  return merged;
}

function mergeWorkroomTodosSafely(localValue, remoteValue, tombstones) {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const merged = new Map();

  local.forEach(item => {
    if (item?.id) merged.set(item.id, item);
  });

  remote.forEach(remoteItem => {
    if (!remoteItem?.id) return;
    const localItem = merged.get(remoteItem.id);

    if (!localItem) {
      merged.set(remoteItem.id, remoteItem);
      return;
    }

    const localTs = itemTimestamp(localItem);
    const remoteTs = itemTimestamp(remoteItem);

    if (remoteTs >= localTs) merged.set(remoteItem.id, remoteItem);
  });

  return [...merged.values()].filter(item => {
    const deletedAt = Number(tombstones?.[item.id] || 0);
    return !deletedAt || itemTimestamp(item) > deletedAt;
  });
}

function mergeRoutineObjectMaps(localValue, remoteValue) {
  return {
    ...(localValue && typeof localValue === "object" ? localValue : {}),
    ...(remoteValue && typeof remoteValue === "object" ? remoteValue : {})
  };
}

function mergeWorkroomRoutinesSafely(localValue, remoteValue) {
  const local = localValue && typeof localValue === "object" ? localValue : {};
  const remote = remoteValue && typeof remoteValue === "object" ? remoteValue : {};

  const tombstones = mergeWorkroomTodoTombstones(local.tombstones, remote.tombstones);
  const byId = new Map();

  (Array.isArray(local.items) ? local.items : []).forEach(item=>{
    if(item?.id) byId.set(item.id,item);
  });

  (Array.isArray(remote.items) ? remote.items : []).forEach(remoteItem=>{
    if(!remoteItem?.id) return;
    const localItem=byId.get(remoteItem.id);
    if(!localItem || itemTimestamp(remoteItem)>=itemTimestamp(localItem)){
      byId.set(remoteItem.id,remoteItem);
    }
  });

  const items=[...byId.values()].filter(item=>{
    const deletedAt=Number(tombstones[item.id]||0);
    return !deletedAt || itemTimestamp(item)>deletedAt;
  });

  return {
    ...local,
    ...remote,
    items,
    tombstones,
    completions:mergeRoutineObjectMaps(local.completions,remote.completions),
    inspirationChecks:mergeRoutineObjectMaps(local.inspirationChecks,remote.inspirationChecks)
  };
}

async function persistWorkroomListDeletionImmediately(kind, id) {
  if (!id || !cloudReady || cloudApplying || !window.firebase?.firestore) return;

  const configs = {
    prints: { listKey: "prints", tombstoneKey: "printTombstones" },
    links: { listKey: "links", tombstoneKey: "linkTombstones" },
    substitutions: { listKey: "substitutions", tombstoneKey: "substitutionTombstones" },
    shopping: { listKey: "shopping", tombstoneKey: "shoppingTombstones" }
  };
  const cfg = configs[kind];
  if (!cfg) return;

  try {
    const syncToken = `${Date.now()}-${getDeviceId()}-${Math.random().toString(36).slice(2,8)}`;
    await firebase.firestore().collection("families").doc("shared").update({
      [`workroom.${cfg.listKey}`]: state.workroom[cfg.listKey] || [],
      [`workroom.${cfg.tombstoneKey}`]: state.workroom[cfg.tombstoneKey] || {},
      syncToken,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(`Werkraum-${kind}-Löschung konnte nicht sofort synchronisiert werden:`, err);
  }
}

function mergeWorkroomListWithTombstones(localValue, remoteValue, tombstones) {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const byId = new Map();

  local.forEach(item => {
    if(item?.id) byId.set(item.id, item);
  });

  remote.forEach(remoteItem => {
    if(!remoteItem?.id) return;
    const localItem = byId.get(remoteItem.id);
    if(!localItem || itemTimestamp(remoteItem) >= itemTimestamp(localItem)){
      byId.set(remoteItem.id, remoteItem);
    }
  });

  return [...byId.values()].filter(item => {
    const deletedAt = Number(tombstones?.[item.id] || 0);
    return !deletedAt || itemTimestamp(item) > deletedAt;
  });
}

function guardedWorkroomMerge(localValue, cloudValue) {
  const local = normalizeWorkroom(localValue);
  const remote = normalizeWorkroom(cloudValue);

  const todoTombstones = mergeWorkroomTodoTombstones(
    local.todoTombstones,
    remote.todoTombstones
  );
  const printTombstones = mergeWorkroomTodoTombstones(
    local.printTombstones,
    remote.printTombstones
  );
  const linkTombstones = mergeWorkroomTodoTombstones(
    local.linkTombstones,
    remote.linkTombstones
  );
  const substitutionTombstones = mergeWorkroomTodoTombstones(
    local.substitutionTombstones,
    remote.substitutionTombstones
  );
  const shoppingTombstones = mergeWorkroomTodoTombstones(
    local.shoppingTombstones,
    remote.shoppingTombstones
  );

  return {
    ...local,
    ...remote,
    todoTombstones,
    printTombstones,
    linkTombstones,
    substitutionTombstones,
    shoppingTombstones,
    todos: mergeWorkroomTodosSafely(local.todos, remote.todos, todoTombstones),
    prints: mergeWorkroomListWithTombstones(local.prints, remote.prints, printTombstones),
    links: mergeWorkroomListWithTombstones(local.links, remote.links, linkTombstones),
    substitutions: mergeWorkroomListWithTombstones(local.substitutions, remote.substitutions, substitutionTombstones),
    shopping: mergeWorkroomListWithTombstones(local.shopping, remote.shopping, shoppingTombstones),
    routines: mergeWorkroomRoutinesSafely(local.routines, remote.routines),
    plans: {
      ...(local.plans || {}),
      ...(remote.plans || {}),
      week: guardedMergeById(local.plans?.week, remote.plans?.week, "Werkraum-Wochenplanung"),
      year: guardedMergeById(local.plans?.year, remote.plans?.year, "Werkraum-Jahresplanung")
    }
  };
}

function mergeSchoolArraySafely(localValue, cloudValue) {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(cloudValue) ? cloudValue : [];

  /* Bei Listen mit IDs nie mehr den kompletten Geräte-Stand überschreiben. */
  if ([...local, ...remote].some(item => item && typeof item === "object" && item.id)) {
    const map = new Map();
    local.forEach(item => { if (item?.id) map.set(item.id, item); });
    remote.forEach(item => {
      if (!item?.id) return;
      const old = map.get(item.id);
      if (!old || itemTimestamp(item) >= itemTimestamp(old)) map.set(item.id, item);
    });
    return [...map.values()];
  }

  /* Primitive/alte Listen ohne IDs: Cloud nur übernehmen, wenn lokal nichts da ist.
     Das ist absichtlich konservativ, damit kein vorhandener Geräte-Stand verloren geht. */
  return local.length ? local : remote;
}

function mergeSchoolObjectSafely(localValue, cloudValue) {
  if (Array.isArray(localValue) || Array.isArray(cloudValue)) {
    return mergeSchoolArraySafely(localValue, cloudValue);
  }

  const local = localValue && typeof localValue === "object" ? localValue : {};
  const remote = cloudValue && typeof cloudValue === "object" ? cloudValue : {};
  const result = {...local};

  Object.keys(remote).forEach(key => {
    const a = local[key];
    const b = remote[key];

    if (Array.isArray(a) || Array.isArray(b)) {
      result[key] = mergeSchoolArraySafely(a, b);
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      result[key] = mergeSchoolObjectSafely(a, b);
    } else if (a === undefined || a === null || a === "") {
      result[key] = b;
    } else if (b === undefined || b === null || b === "") {
      result[key] = a;
    } else {
      /* Für einzelne Werte bleibt der Cloud-Stand maßgeblich wie bisher.
         Listen werden jetzt aber nicht mehr als Ganzes überschrieben. */
      result[key] = b;
    }
  });

  return result;
}

function mergeSchoolSafely(localSchool, cloudSchool) {
  if (!cloudSchool || typeof cloudSchool !== "object") return localSchool;
  return mergeSchoolObjectSafely(localSchool, cloudSchool);
}

/* CODE-AUDIT: frühere, überschriebene Definition von applyCloudData entfernt. */
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

const SHOPPING_COLLECTION_MIGRATION_KEY = "balanceProd.shoppingCollectionMigrated.v1";

async function migrateShoppingToCollection() {
  /* Einmalige Altbestandsmigration.
     Nach erfolgreicher Prüfung wird sie auf DIESEM Gerät dauerhaft als erledigt
     markiert. So kann eine später bewusst geleerte Einkaufsliste nicht aus einem
     alten state.shopping wiederauferstehen. */
  if (localStorage.getItem(SHOPPING_COLLECTION_MIGRATION_KEY) === "1") return;

  const snapshot = await shoppingCollection().get();

  if (!snapshot.empty) {
    localStorage.setItem(SHOPPING_COLLECTION_MIGRATION_KEY, "1");
    return;
  }

  if (!shoppingItems.length) {
    localStorage.setItem(SHOPPING_COLLECTION_MIGRATION_KEY, "1");
    return;
  }

  const batch = firebase.firestore().batch();

  shoppingItems.forEach(item => {
    if (!item?.id) return;
    const { id, ...data } = item;
    batch.set(shoppingCollection().doc(id), data);
  });

  await batch.commit();
  localStorage.setItem(SHOPPING_COLLECTION_MIGRATION_KEY, "1");
}

function startCloudSync() {
  if (cloudUnsubscribe) cloudUnsubscribe();

  const ref = firebase.firestore().collection("families").doc("shared");
  let firstSnapshot = true;
  let lastAppliedSyncToken = "";

  cloudUnsubscribe = ref.onSnapshot(async snap => {
    if (!snap.exists) {
      if (firstSnapshot) {
        cloudReady = true;
        updateSyncStatus(navigator.onLine ? "synced" : "offline");
        firstSnapshot = false;
        scheduleCloudSave();
      }
      return;
    }

    const cloudData = snap.data();
    const token = String(cloudData?.syncToken || "");

    // Gerätebestätigungen werden in dasselbe Firestore-Dokument geschrieben.
    // Sie verändern den syncToken NICHT. Solche ACK-Snapshots dürfen deshalb
    // NICHT die ganze App neu rendern – sonst verschwinden Klicks unter der Maus.
    const isAckOnlySnapshot =
      !firstSnapshot &&
      token &&
      token === lastAppliedSyncToken;

    if (!isAckOnlySnapshot) {
      applyCloudData(cloudData);
      lastAppliedSyncToken = token;
    }

    cloudReady = true;
    updateSyncStatus(navigator.onLine ? "synced" : "offline");
    renderDeviceAcks(cloudData);
    acknowledgeCloudSnapshot(cloudData, snap.metadata);

    if (firstSnapshot) {
      firstSnapshot = false;
    }
  }, err => {
    console.error("Firestore listener failed:", err);
    updateSyncStatus(navigator.onLine ? "error" : "offline");
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


// Rezept-Status muss initialisiert sein, bevor Firebase den ersten renderAll-Aufruf auslösen kann.
let activeRecipeDifficulty = "all";
let activeRecipeCategory = "all";
let recipeCategoryTouched = false;
let recipeKidsOnly = false;
let recipeSelfCookOnly = false;
let recipeHealthyOnly = false;
let recipeFavoriteOnly = false;
let activeRecipeSearch = "";
let mealPlanWeekOffset = 0;
let recipePage = 0;
const RECIPE_PAGE_SIZE = 20;
let activeRecipeLetter = "all";
let editingRecipeId = null;

// Wochentage müssen vor dem ersten möglichen renderAll-Aufruf initialisiert sein.
const WEEK_DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

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
showLoginGate(true);
  }
});

/* Zeittracking-Fallback ohne Dauer-Polling:
   - onSnapshot liefert Live-Änderungen
   - wenn Handy/Tablet nach Pause wieder aktiv wird, einmal frisch laden
   - ebenso nach Wiederherstellung der Internetverbindung / BFCache-Rückkehr */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshTimeTrackingFromCloud();
});

window.addEventListener("pageshow", () => {
  if (!document.hidden) refreshTimeTrackingFromCloud();
});

window.addEventListener("online", () => {
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


function formatPromoDate(value){
  if(!value) return "";
  const d = new Date(value + "T12:00:00");
  if(Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("de-AT",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}

function promoEndDate(promo){
  const candidates=[promo?.validTo,promo?.collectTo]
    .filter(Boolean)
    .map(v=>new Date(v+"T23:59:59"))
    .filter(d=>!Number.isNaN(d.getTime()));
  if(!candidates.length) return null;
  return new Date(Math.max(...candidates.map(d=>d.getTime())));
}

function cleanupExpiredShoppingPromos(){
  const now=new Date();
  let changed=false;
  (state.shoppingPromos||[]).forEach(promo=>{
    if(promo?.deleted) return;
    const end=promoEndDate(promo);
    if(end && end < now){
      promo.deleted=true;
      promo.expiredAt=Date.now();
      promo.updatedAt=Date.now();
      changed=true;
    }
  });
  if(changed) save();
  return changed;
}

function shoppingStoreMark(shop){
  const key=String(shop||"").trim().toLowerCase();
  const clsMap={
    "billa":"billa",
    "spar":"spar",
    "bipa":"bipa",
    "dm":"dm",
    "lidl":"lidl",
    "hofer":"hofer",
    "penny":"penny",
    "müller":"mueller",
    "mueller":"mueller"
  };
  const cls=clsMap[key]||"other";
  const accessible=String(shop||"Geschäft").trim() || "Geschäft";

  if(cls==="billa"){
    return `<span class="promo-store-mark promo-store-billa" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-billa">BILLA</span></span>`;
  }
  if(cls==="bipa"){
    return `<span class="promo-store-mark promo-store-bipa" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-bipa">BIPA</span></span>`;
  }
  if(cls==="spar"){
    return `<span class="promo-store-mark promo-store-spar" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-spar-tree"></span></span>`;
  }
  if(cls==="dm"){
    return `<span class="promo-store-mark promo-store-dm" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-word">dm</span></span>`;
  }
  if(cls==="lidl"){
    return `<span class="promo-store-mark promo-store-lidl" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-word">Lidl</span></span>`;
  }
  if(cls==="hofer"){
    return `<span class="promo-store-mark promo-store-hofer" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-word">H</span></span>`;
  }
  if(cls==="penny"){
    return `<span class="promo-store-mark promo-store-penny" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-word">PENNY</span></span>`;
  }
  if(cls==="mueller"){
    return `<span class="promo-store-mark promo-store-mueller" role="img" aria-label="${escapeHtml(accessible)}"><span class="promo-logo-word">M</span></span>`;
  }
  return `<span class="promo-store-mark promo-store-other" role="img" aria-label="${escapeHtml(accessible)}">✦</span>`;
}

function renderManualShoppingPromos(){
  const box = document.querySelector("#manualPromoDisplay");
  if(!box) return;

  cleanupExpiredShoppingPromos();

  const promos = (state.shoppingPromos || [])
    .filter(x => !x.deleted)
    .sort((a,b) => {
      const aEnd=promoEndDate(a)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bEnd=promoEndDate(b)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aEnd-bEnd || Number(b.updatedAt || b.createdAt || 0)-Number(a.updatedAt || a.createdAt || 0);
    });

  if(!promos.length){
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="manual-promo-display-head">
      <span>✂</span>
      <strong>Gemerkte Rabatte</strong>
    </div>
    <div class="manual-promo-cards">
      ${promos.map(p => {
        const valid = p.validFrom || p.validTo
          ? `Gültig ${p.validFrom ? formatPromoDate(p.validFrom) : "…"}${p.validTo ? " – " + formatPromoDate(p.validTo) : ""}`
          : "";
        const collect = p.collectFrom || p.collectTo
          ? `Sammeln ${p.collectFrom ? formatPromoDate(p.collectFrom) : "…"}${p.collectTo ? " – " + formatPromoDate(p.collectTo) : ""}`
          : "";
        return `
          <div class="manual-promo-card">
            <div class="manual-promo-card-top">
              ${shoppingStoreMark(p.shop)}
              <div class="manual-promo-card-title">
                <span class="manual-promo-shop">${escapeHtml(p.shop || "")}</span>
                <strong>${escapeHtml(p.title || "Rabatt")}</strong>
              </div>
              <div class="manual-promo-actions">
                <button type="button" class="manual-promo-edit" data-promo-id="${p.id}" aria-label="Rabatt bearbeiten">✎</button>
                <button type="button" class="manual-promo-delete" data-promo-id="${p.id}" aria-label="Rabatt löschen">×</button>
              </div>
            </div>
            ${valid ? `<div class="manual-promo-line manual-promo-valid">${escapeHtml(valid)}</div>` : ""}
            ${collect ? `<div class="manual-promo-line manual-promo-collect">${escapeHtml(collect)}</div>` : ""}
            ${p.note ? `<div class="manual-promo-note">${escapeHtml(p.note)}</div>` : ""}
          </div>`;
      }).join("")}
    </div>
  `;

  box.querySelectorAll(".manual-promo-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = state.shoppingPromos.find(x => x.id === btn.dataset.promoId);
      if(!item) return;
      item.deleted = true;
      item.updatedAt = Date.now();
      save();
      renderManualShoppingPromos();
    });
  });

  box.querySelectorAll(".manual-promo-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = state.shoppingPromos.find(x => x.id === btn.dataset.promoId && !x.deleted);
      if(!item) return;

      document.querySelector("#manualPromoEditId").value = item.id;
      document.querySelector("#manualPromoShop").value = item.shop || "";
      document.querySelector("#manualPromoTitle").value = item.title || "";
      document.querySelector("#manualPromoValidFrom").value = item.validFrom || "";
      document.querySelector("#manualPromoValidTo").value = item.validTo || "";
      document.querySelector("#manualPromoCollectFrom").value = item.collectFrom || "";
      document.querySelector("#manualPromoCollectTo").value = item.collectTo || "";
      document.querySelector("#manualPromoNote").value = item.note || "";

      const details = document.querySelector("#manualPromoDetails");
      details?.setAttribute("open","");
      const saveBtn = document.querySelector("#addManualPromoBtn");
      if(saveBtn) saveBtn.textContent = "Änderung speichern";
      document.querySelector("#cancelManualPromoEditBtn")?.classList.remove("hidden");
      details?.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  });
}

function resetManualPromoEditor(){
  ["manualPromoTitle","manualPromoCollectFrom","manualPromoCollectTo",
   "manualPromoValidFrom","manualPromoValidTo","manualPromoNote","manualPromoEditId"].forEach(id => {
    const el=document.querySelector("#"+id);
    if(el) el.value="";
  });
  const shopEl=document.querySelector("#manualPromoShop");
  if(shopEl) shopEl.value="";
  const saveBtn=document.querySelector("#addManualPromoBtn");
  if(saveBtn) saveBtn.textContent="+ Rabatt merken";
  document.querySelector("#cancelManualPromoEditBtn")?.classList.add("hidden");
}

function addManualShoppingPromo(){
  const shop = document.querySelector("#manualPromoShop")?.value.trim() || "";
  const title = document.querySelector("#manualPromoTitle")?.value.trim() || "";
  const collectFrom = document.querySelector("#manualPromoCollectFrom")?.value || "";
  const collectTo = document.querySelector("#manualPromoCollectTo")?.value || "";
  const validFrom = document.querySelector("#manualPromoValidFrom")?.value || "";
  const validTo = document.querySelector("#manualPromoValidTo")?.value || "";
  const note = document.querySelector("#manualPromoNote")?.value.trim() || "";
  const editId = document.querySelector("#manualPromoEditId")?.value || "";

  if(!shop || !title){
    alert("Bitte mindestens Geschäft und Aktion eintragen.");
    return;
  }

  if(editId){
    const item = state.shoppingPromos.find(x => x.id === editId && !x.deleted);
    if(item){
      Object.assign(item,{shop,title,collectFrom,collectTo,validFrom,validTo,note,updatedAt:Date.now()});
    }
  }else{
    state.shoppingPromos.push({
      id:uid(), shop,title,collectFrom,collectTo,validFrom,validTo,note,
      createdAt:Date.now(), updatedAt:Date.now(), deleted:false
    });
  }

  save();
  renderManualShoppingPromos();
  resetManualPromoEditor();
  document.querySelector("#manualPromoDetails")?.removeAttribute("open");
}

document.querySelector("#addManualPromoBtn")?.addEventListener("click", addManualShoppingPromo);
document.querySelector("#cancelManualPromoEditBtn")?.addEventListener("click", () => {
  resetManualPromoEditor();
  document.querySelector("#manualPromoDetails")?.removeAttribute("open");
});

(function scheduleShoppingPromoCleanup(){
  window.setInterval(()=>{
    const changed=cleanupExpiredShoppingPromos();
    if(changed) renderManualShoppingPromos();
  },60*60*1000);
})();

function renderShopping() {
  renderManualShoppingPromos();
  const list = document.querySelector("#shoppingList");
  if (!list) return;

  if (!shoppingItems.length) {
    list.innerHTML = `<div class="workroom-empty">Noch nichts auf der Einkaufsliste.</div>`;
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


// ===== EINKAUF – app-eigene Vorschläge =====
const SHOPPING_SUGGESTION_KEY = "balanceProd.shoppingSuggestionHistory";

function loadShoppingSuggestionHistory(){
  try{
    const raw=JSON.parse(localStorage.getItem(SHOPPING_SUGGESTION_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  }catch(e){
    return [];
  }
}

function saveShoppingSuggestionHistory(list){
  localStorage.setItem(SHOPPING_SUGGESTION_KEY, JSON.stringify(list.slice(0,250)));
}

function rememberShoppingSuggestion(item){
  const name=String(item?.name || "").trim();
  if(!name) return;

  const history=loadShoppingSuggestionHistory();
  const key=name.toLocaleLowerCase("de-AT");
  const existing=history.find(x => String(x.name || "").toLocaleLowerCase("de-AT") === key);

  if(existing){
    existing.name=name;
    existing.category=item.category || existing.category || "other";
    existing.when=item.when || existing.when || "now";
    existing.store=item.store || existing.store || "";
    existing.count=Number(existing.count || 0)+1;
    existing.lastUsed=Date.now();
  }else{
    history.push({
      name,
      category:item.category || "other",
      when:item.when || "now",
      store:item.store || "",
      count:1,
      lastUsed:Date.now()
    });
  }

  history.sort((a,b) =>
    Number(b.count || 0)-Number(a.count || 0) ||
    Number(b.lastUsed || 0)-Number(a.lastUsed || 0)
  );
  saveShoppingSuggestionHistory(history);
}

function shoppingSuggestionPool(){
  const history=loadShoppingSuggestionHistory();

  // Noch aktive Einträge dürfen ebenfalls vorgeschlagen werden.
  (shoppingItems || []).forEach(item => {
    const key=String(item?.name || "").trim().toLocaleLowerCase("de-AT");
    if(!key) return;
    if(!history.some(x => String(x.name || "").trim().toLocaleLowerCase("de-AT") === key)){
      history.push({
        name:item.name,
        category:item.category || "other",
        when:item.when || "now",
        store:item.store || "",
        count:1,
        lastUsed:Number(item.createdAt || Date.now())
      });
    }
  });

  return history;
}

function hideShoppingSuggestions(){
  document.querySelector("#shoppingSuggestions")?.classList.add("hidden");
}

function renderShoppingSuggestions(query=""){
  const popup=document.querySelector("#shoppingSuggestions");
  const input=document.querySelector("#shoppingItemInput");
  if(!popup || !input) return;

  const q=String(query || "").trim().toLocaleLowerCase("de-AT");
  if(q.length < 1){
    hideShoppingSuggestions();
    return;
  }

  const matches=shoppingSuggestionPool()
    .filter(x => String(x.name || "").toLocaleLowerCase("de-AT").includes(q))
    .sort((a,b) => {
      const an=String(a.name || "").toLocaleLowerCase("de-AT");
      const bn=String(b.name || "").toLocaleLowerCase("de-AT");
      const aStarts=an.startsWith(q) ? 0 : 1;
      const bStarts=bn.startsWith(q) ? 0 : 1;
      return aStarts-bStarts ||
        Number(b.count || 0)-Number(a.count || 0) ||
        Number(b.lastUsed || 0)-Number(a.lastUsed || 0);
    })
    .slice(0,6);

  if(!matches.length){
    hideShoppingSuggestions();
    return;
  }

  popup.innerHTML=matches.map((x,i)=>`
    <button type="button"
            class="shopping-suggestion-item"
            data-suggestion-index="${i}"
            role="option">
      <span class="shopping-suggestion-name">${escapeHtml(x.name)}</span>
      <span class="shopping-suggestion-meta">
        ${shoppingCategories[x.category]?.icon || "📦"}
        ${escapeHtml(shoppingCategories[x.category]?.label || "Sonstiges")}
        ${x.store ? ` · ${escapeHtml(x.store)}` : ""}
      </span>
    </button>
  `).join("");
  popup.classList.remove("hidden");

  popup.querySelectorAll(".shopping-suggestion-item").forEach(btn=>{
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", ()=>{
      const suggestion=matches[Number(btn.dataset.suggestionIndex)];
      if(!suggestion) return;

      input.value=suggestion.name || "";

      const category=document.querySelector("#shoppingCategory");
      const when=document.querySelector("#shoppingWhen");
      const store=document.querySelector("#shoppingSaleStore");

      if(category && suggestion.category) category.value=suggestion.category;
      if(when && suggestion.when) when.value=suggestion.when;
      if(store) store.value=suggestion.store || "";

      hideShoppingSuggestions();
      input.focus();
    });
  });
}

const shoppingSuggestInput=document.querySelector("#shoppingItemInput");
shoppingSuggestInput?.addEventListener("input", e => {
  renderShoppingSuggestions(e.currentTarget.value);
});
shoppingSuggestInput?.addEventListener("focus", e => {
  if(e.currentTarget.value.trim()) renderShoppingSuggestions(e.currentTarget.value);
});
shoppingSuggestInput?.addEventListener("keydown", e => {
  if(e.key === "Escape") hideShoppingSuggestions();
});
document.addEventListener("click", e => {
  if(!e.target.closest?.(".shopping-suggest-wrap")) hideShoppingSuggestions();
});

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
rememberShoppingSuggestion(newItem);
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
renderAll();
// Werkraum-Faltlogik: der ältere doppelte Handler wurde entfernt.

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

// ===== EINKAUF – REZEPTKARTEN =====
// Rezept-Statusvariablen wurden aus Sicherheitsgründen vor die Auth-Initialisierung verschoben.



function recipeSelfCook(recipe) {
  // Alte Kinderrezepte hatten "Das kannst du selbst kochen" noch an recipe.kids gekoppelt.
  // Bis sie einmal bearbeitet werden, bleibt dieses Verhalten erhalten.
  return typeof recipe?.selfCook === "boolean" ? recipe.selfCook : !!recipe?.kids;
}

function recipeBeakerKitchen(recipe) {
  return !!recipe?.beakerKitchen;
}

function recipeMeasureType(line, allowBeakers = false) {
  const value = String(line || "").toLowerCase();

  if (/\btopfenbecher\b/.test(value)) return {type:"topfen", label:"Topfenbecher"};
  if (/\bjoghurtbecher\b/.test(value)) return {type:"yogurt", label:"Joghurtbecher"};
  if (/\b(esslöffel|el)\b/.test(value)) return {type:"tbsp", label:"Esslöffel"};
  if (/\b(teelöffel|tl)\b/.test(value)) return {type:"tsp", label:"Teelöffel"};
  if (/\bprise\b/.test(value)) return {type:"salt", label:"Prise"};
  if (/\b(ei|eier)\b/.test(value)) return {type:"egg", label:"Ei"};
  if (/\b(ml|milliliter)\b/.test(value)) return {type:"liquid", label:"Flüssigkeit"};

  if (allowBeakers && /\bbecher\b/.test(value)) {
    let color = "neutral";
    if (/gelb/.test(value)) color = "yellow";
    else if (/grün|gruen/.test(value)) color = "green";
    else if (/orange/.test(value)) color = "orange";
    else if (/rot/.test(value)) color = "red";
    else if (/blau/.test(value)) color = "blue";
    return {type:"beaker", color, label:"Becher"};
  }

  return null;
}


function measureSvgHtml(type, color = "neutral", title = "") {
  const palette = {
    blue:   { fill:"#2e95d7", stroke:"#176a9e" },
    red:    { fill:"#ef4c52", stroke:"#b9272d" },
    green:  { fill:"#56b85c", stroke:"#2e7d33" },
    yellow: { fill:"#f5cf3e", stroke:"#b78e12" },
    orange: { fill:"#f29a42", stroke:"#b8641e" },
    purple: { fill:"#a76bd8", stroke:"#7243a0" },
    neutral:{ fill:"#f8f7f2", stroke:"#68736e" }
  };
  const p = palette[color] || palette.neutral;
  const label = escapeHtml(title || "Maß");

  const common = `viewBox="0 0 64 48" role="img" aria-label="${label}" focusable="false"`;

  if (type === "beaker") {
    return `<svg class="measure-svg measure-svg-cup" ${common}>
      <path d="M15 10h34l-3.2 29c-.4 3.5-3 5.8-6.2 5.8H24.4c-3.2 0-5.8-2.3-6.2-5.8L15 10Z"
        fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
      <path d="M14 10h36" fill="none" stroke="${p.stroke}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M23 15v21" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  if (type === "yogurt") {
    return `<svg class="measure-svg measure-svg-yogurt" ${common}>
      <path d="M19 8h26l-3 32c-.3 3-2.5 5-5.3 5H27.3c-2.8 0-5-2-5.3-5L19 8Z"
        fill="#fbfbf8" stroke="#68736e" stroke-width="1.8"/>
      <path d="M17 8h30" stroke="#68736e" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 13h20" stroke="#d8dfda" stroke-width="2"/>
      <path d="M25 18v19" stroke="#eef1ed" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  if (type === "topfen") {
    return `<svg class="measure-svg measure-svg-topfen" ${common}>
      <path d="M12 17h40l-3.8 22c-.5 2.7-2.8 4.7-5.6 4.7H21.4c-2.8 0-5.1-2-5.6-4.7L12 17Z"
        fill="#fbfbf8" stroke="#68736e" stroke-width="1.7"/>
      <rect x="9" y="11" width="46" height="8" rx="2.5"
        fill="#ffffff" stroke="#68736e" stroke-width="1.7"/>
      <path d="M15 15h34" stroke="#d7ded9" stroke-width="1.4"/>
    </svg>`;
  }

  if (type === "tbsp") {
    return `<svg class="measure-svg measure-svg-tbsp" ${common}>
      <ellipse cx="15" cy="24" rx="11" ry="8"
        fill="#f5f6f3" stroke="#68736e" stroke-width="1.9"/>
      <path d="M26 24H59" stroke="#68736e" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M8 20c3-2 8-2 12 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
    </svg>`;
  }

  if (type === "tsp") {
    return `<svg class="measure-svg measure-svg-tsp" ${common}>
      <ellipse cx="13" cy="24" rx="7.5" ry="5.3"
        fill="#f5f6f3" stroke="#68736e" stroke-width="1.7"/>
      <path d="M20.5 24H49" stroke="#68736e" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M9 21.5c2-1 5-1 7 0" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
    </svg>`;
  }

  if (type === "salt") {
    return `<svg class="measure-svg measure-svg-salt" ${common}>
      <path d="M22 15h20l2.5 24c.3 3-1.7 5-4.6 5H24.1c-2.9 0-4.9-2-4.6-5L22 15Z"
        fill="#fbfbf8" stroke="#68736e" stroke-width="1.7"/>
      <rect x="21" y="9" width="22" height="8" rx="2.8"
        fill="#dce2de" stroke="#68736e" stroke-width="1.6"/>
      <circle cx="26" cy="13" r="1.2" fill="#68736e"/>
      <circle cx="32" cy="12" r="1.2" fill="#68736e"/>
      <circle cx="38" cy="13" r="1.2" fill="#68736e"/>
      <circle cx="29" cy="8" r="1.15" fill="#8b938f"/>
      <circle cx="35" cy="6.5" r="1.15" fill="#8b938f"/>
      <circle cx="41" cy="8.5" r="1.15" fill="#8b938f"/>
      <circle cx="24" cy="6" r="1.05" fill="#8b938f"/>
    </svg>`;
  }

  return "";
}

function recipeMeasureIconHtml(line, recipe) {
  const measure = recipeMeasureType(line, recipeBeakerKitchen(recipe));
  if (!measure) return "";
  if (measure.type === "egg" || measure.type === "liquid") return "";
  return `<span class="recipe-measure-icon recipe-measure-svg-wrap" title="${escapeHtml(measure.label)}">
    ${measureSvgHtml(measure.type, measure.color || "neutral", measure.label)}
  </span>`;
}


function normalizedBeakerMappings(recipe) {
  const rows = Array.isArray(recipe?.beakerMappings) ? recipe.beakerMappings : [];
  // V38 accepts old V37 rows and new grouped rows.
  return rows.map(row => {
    if (Array.isArray(row?.measures)) return row;
    return {
      ingredient: row?.ingredient || "",
      measures: [{
        amount: row?.amount || "",
        unit: row?.unit || "cup",
        color: row?.color || "blue"
      }]
    };
  });
}

function normalizeIngredientKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[0-9]+([.,][0-9]+)?/g, " ")
    .replace(/\b(g|kg|gramm|gram|ml|milliliter|l|liter|el|tl|esslöffel|teelöffel|becher|topfenbecher|joghurtbecher|prise|stück|stk)\b/g, " ")
    .replace(/\b(blau(?:er|e|es|en)?|rot(?:er|e|es|en)?|grün(?:er|e|es|en)?|gruen(?:er|e|es|en)?|gelb(?:er|e|es|en)?|orange(?:r|e|s|n)?|lila)\b/g, " ")
    .replace(/[^a-zäöüß]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientDisplayName(line) {
  return normalizeIngredientKey(line) || String(line || "").trim();
}

function childMeasureIconHtml(mapping) {
  const unit = mapping?.unit || "cup";
  const color = mapping?.color || "blue";
  const type = {
    cup:"beaker",
    quark:"topfen",
    yogurt:"yogurt",
    tbsp:"tbsp",
    tsp:"tsp",
    pinch:"salt"
  }[unit] || "beaker";
  const title = {
    cup:"Becher", quark:"Topfenbecher", yogurt:"Joghurtbecher",
    tbsp:"Esslöffel", tsp:"Teelöffel", pinch:"Prise"
  }[unit] || "Maß";
  return `<span class="recipe-measure-icon recipe-measure-svg-wrap" title="${title}">
    ${measureSvgHtml(type, color, title)}
  </span>`;
}

function childMeasureCompactHtml(mapping) {
  const amount = String(mapping?.amount || "").trim();
  return `<span class="recipe-child-measure-part">
    ${amount ? `<b class="recipe-child-amount">${escapeHtml(amount)}</b>` : ""}
    ${childMeasureIconHtml(mapping)}
  </span>`;
}

function isAlreadyChildMeasureLine(line) {
  return /\b(topfenbecher|joghurtbecher|becher|esslöffel|el|teelöffel|tl|prise)\b/i.test(String(line || ""));
}

function childIngredientReplacementHtml(line, recipe) {
  const mappings = normalizedBeakerMappings(recipe);
  if (!mappings.length || isAlreadyChildMeasureLine(line)) return "";

  const lineKey = normalizeIngredientKey(line);
  if (!lineKey) return "";

  const match = mappings.find(m => {
    const mapKey = normalizeIngredientKey(m.ingredient);
    return mapKey && (mapKey === lineKey || lineKey.includes(mapKey) || mapKey.includes(lineKey));
  });
  if (!match) return "";

  const measures = Array.isArray(match.measures) ? match.measures.filter(Boolean) : [];
  if (!measures.length) return "";

  return `
    <span class="recipe-child-measure-row">
      <span class="recipe-child-measures">
        ${measures.map(childMeasureCompactHtml).join('<span class="recipe-child-plus">+</span>')}
      </span>
      <span class="recipe-child-measure-ingredient">${escapeHtml(ingredientDisplayName(line))}</span>
    </span>
  `;
}

function recipeLeadingAmount(line) {
  const m = String(line || "").trim().match(/^([0-9]+(?:[.,][0-9]+)?|[¼½¾⅓⅔])/);
  return m ? m[1] : "";
}

function automaticChildIngredientName(line) {
  return String(line || "")
    .replace(/^\s*([0-9]+(?:[.,][0-9]+)?|[¼½¾⅓⅔])\s*/i, "")
    .replace(/^\s*(g|kg|gramm|gram|ml|milliliter|l|liter|stück|stk\.?|prise)\b\.?\s*/i, "")
    .replace(/\b(blau(?:er|e|es|en)?|rot(?:er|e|es|en)?|grün(?:er|e|es|en)?|gruen(?:er|e|es|en)?|gelb(?:er|e|s|en)?|orange(?:r|e|s|n)?|lila)\b/gi, "")
    .replace(/\b(topfenbecher|joghurtbecher|becher|esslöffel|el|teelöffel|tl)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function automaticChildMeasureHtml(line, recipe) {
  const measure = recipeMeasureType(line, recipeBeakerKitchen(recipe));
  if (!measure) return "";
  if (["liquid","egg"].includes(measure.type)) return "";

  const amount = recipeLeadingAmount(line);
  const ingredient = automaticChildIngredientName(line);
  if (!ingredient) return "";

  const mapping = {
    unit:
      measure.type === "beaker" ? "cup" :
      measure.type === "topfen" ? "quark" :
      measure.type === "yogurt" ? "yogurt" :
      measure.type === "tbsp" ? "tbsp" :
      measure.type === "tsp" ? "tsp" :
      measure.type === "salt" ? "pinch" : "cup",
    color: measure.color || "blue",
    amount
  };

  return `
    <span class="recipe-child-measure-row recipe-child-auto-measure">
      <span class="recipe-child-measures">${childMeasureCompactHtml(mapping)}</span>
      <span class="recipe-child-measure-ingredient">${escapeHtml(ingredient)}</span>
    </span>
  `;
}

function recipeIngredientHtml(line, recipe) {
  const manualChild = childIngredientReplacementHtml(line, recipe);
  const automaticChild = manualChild ? "" : automaticChildMeasureHtml(line, recipe);
  const childView = manualChild || automaticChild;

  return `
    <span class="recipe-adult-ingredient">
      <span class="recipe-ingredient-text">${escapeHtml(line)}</span>
    </span>
    ${childView ? `<span class="recipe-child-ingredient">${childView}</span>` : ""}
  `;
}

function normalizedRecipeSource(recipe) {
  if (!recipe) return "internal";
  if (recipe.sourceType === "external" || recipe.sourceType === "internal") return recipe.sourceType;
  const hasOwnContent =
    normalizedRecipeLines(recipe.ingredients).length ||
    normalizedRecipeLines(recipe.steps).length;
  return !hasOwnContent && (recipe.webUrl || recipe.youtubeUrl) ? "external" : "internal";
}

function recipeRatingLabel(value) {
  return {good:"😊 Gut", medium:"🙂 Mittel", bad:"😕 Schlecht"}[value] || "";
}

function updateRecipeSourceForm() {
  // Es werden nur eigene Rezepte erfasst. Alte Daten bleiben kompatibel.
}

function resetRecipeForm() {
  ["#recipeTitle","#recipeTime","#recipeIngredients","#recipeSteps","#recipeWebUrl","#recipeYoutubeUrl","#recipeBakeTime","#recipeTemperature","#recipeServings"]
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

  const rating = document.querySelector("#recipeRating");
  if (rating) rating.value = "";

  const kids = document.querySelector("#recipeKids");
  if (kids) kids.checked = false;

  const selfCook = document.querySelector("#recipeSelfCook");
  if (selfCook) selfCook.checked = false;

  const beakerKitchen = document.querySelector("#recipeBeakerKitchen");
  if (beakerKitchen) beakerKitchen.checked = false;
  setRecipeBeakerMappings([]);
  updateBeakerMappingVisibility();

  const healthy = document.querySelector("#recipeHealthy");
  if (healthy) healthy.checked = false;

  const favorite = document.querySelector("#recipeFavorite");
  if (favorite) favorite.checked = false;

  updateRecipeSourceForm();
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
  document.querySelector("#recipeRating").value = recipe.rating || "";
  document.querySelector("#recipeKids").checked = !!recipe.kids;
  document.querySelector("#recipeSelfCook").checked = recipeSelfCook(recipe);
  document.querySelector("#recipeBeakerKitchen").checked = recipeBeakerKitchen(recipe);
  setRecipeBeakerMappings(recipe.beakerMappings || []);
  updateBeakerMappingVisibility();
  document.querySelector("#recipeHealthy").checked = !!recipe.healthy;
  document.querySelector("#recipeFavorite").checked = !!recipe.favorite;
  document.querySelector("#recipeTime").value = recipe.time || "";
  document.querySelector("#recipeBakeTime").value = recipe.bakeTime || "";
  document.querySelector("#recipeTemperature").value = recipe.temperature || "";
  document.querySelector("#recipeServings").value = recipe.servings || "";
  document.querySelector("#recipeIngredients").value = normalizedRecipeLines(recipe.ingredients).join("\n");
  document.querySelector("#recipeSteps").value = normalizedRecipeLines(recipe.steps).join("\n");
  updateRecipeSourceForm();

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


function recipeContentScore(recipe) {
  if (!recipe) return -1;
  const ingredients = normalizedRecipeLines(recipe.ingredients).length;
  const steps = normalizedRecipeLines(recipe.steps).length;
  const mappings = Array.isArray(recipe.beakerMappings) ? recipe.beakerMappings.length : 0;
  const extras =
    (recipe.webUrl ? 1 : 0) +
    (recipe.youtubeUrl ? 1 : 0) +
    (recipe.time ? 1 : 0) +
    (recipe.bakeTime ? 1 : 0) +
    (recipe.temperature ? 1 : 0);
  return ingredients * 10 + steps * 12 + mappings * 4 + extras;
}

function recipeByTitle(title) {
  const q = String(title || "").trim().toLowerCase();
  if (!q) return null;

  const matches = (state.recipes || []).filter(r =>
    String(r.title || "").trim().toLowerCase() === q
  );

  if (!matches.length) return null;

  return matches.sort((a,b) => {
    const scoreDiff = recipeContentScore(b) - recipeContentScore(a);
    if (scoreDiff) return scoreDiff;
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  })[0];
}

function resolveMealRecipe(recipeId, label) {
  const byId = recipeId
    ? (state.recipes || []).find(r => r.id === recipeId)
    : null;

  const title = String(label || byId?.title || "").trim();
  const richestByTitle = title ? recipeByTitle(title) : null;

  if (!byId) return richestByTitle;
  if (!richestByTitle) return byId;

  return recipeContentScore(richestByTitle) > recipeContentScore(byId)
    ? richestByTitle
    : byId;
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

// Wochenplan/Essensplan öffnen immer die vollständigste aktuelle Rezeptversion,
 // falls ältere Dubletten mit demselben Titel noch im Datenbestand vorhanden sind.
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

  const external = normalizedRecipeSource(recipe) === "external";
  const startInChildMode = !external && recipeSelfCook(recipe);

  body.classList.toggle("recipe-detail-child-mode", startInChildMode);

  const ingredientLines = normalizedRecipeLines(recipe.ingredients);
  const stepLines = normalizedRecipeLines(recipe.steps);

  body.innerHTML = `
    <article class="recipe-card recipe-detail-mirror-card
      ${recipeCategoryClass(recipe.category || "main")}
      ${recipe.kids ? "recipe-card-kids" : ""}
      ${recipeSelfCook(recipe) ? "recipe-card-selfcook" : ""}
      ${startInChildMode ? "recipe-child-mode" : ""}"
      data-recipe-id="${recipe.id}">

      <header class="recipe-card-head">
        <div class="recipe-time-mark">
          <span class="recipe-clock">${external ? "🔗" : "◔"}</span>
          <span>${external ? "Link" : escapeHtml(recipe.time || "–")}</span>
        </div>

        <div class="recipe-title-wrap">
          <span class="recipe-ribbon">${external ? "LINK" : "REZEPT"}</span>
          <div class="recipe-title-button recipe-detail-title-static">${escapeHtml(recipe.title || "Rezept")}</div>

          <div class="recipe-badges">
            <span>${escapeHtml(recipeCategoryLabel(recipe.category || "main"))}</span>
            <span>${escapeHtml(recipeDifficultyLabel(recipe.difficulty))}</span>
            ${recipe.favorite ? `<span class="recipe-favorite-badge">★ Lieblingsrezept</span>` : ""}
            ${recipe.kids ? `<span class="recipe-kids-badge">🧒 Kindergericht</span>` : ""}
            ${recipeSelfCook(recipe) ? `
              <button type="button"
                class="recipe-selfcook-toggle recipe-detail-selfcook-toggle"
                data-id="${recipe.id}"
                aria-pressed="${startInChildMode ? "true" : "false"}">
                ${startInChildMode ? "🌈 Kinderansicht aktiv" : "👧 Das kannst du selbst kochen!"}
              </button>` : ""}
            ${recipeBeakerKitchen(recipe) ? `<span class="recipe-beaker-badge">🥣 Becherküche</span>` : ""}
            ${recipe.healthy ? `<span class="recipe-healthy-badge">🌿 Gesund & bunt</span>` : ""}
          </div>
        </div>

        <div class="recipe-card-top-controls">
          <button type="button"
            class="recipe-favorite-btn recipe-detail-favorite ${recipe.favorite ? "active" : ""}"
            data-id="${recipe.id}" title="Lieblingsrezept">${recipe.favorite ? "★" : "☆"}</button>

          <div class="recipe-rating-buttons" aria-label="Rezept bewerten">
            <button type="button" class="recipe-rating-btn recipe-detail-rating ${recipe.rating === "good" ? "active" : ""}" data-rating="good" title="Gut">😊</button>
            <button type="button" class="recipe-rating-btn recipe-detail-rating ${recipe.rating === "medium" ? "active" : ""}" data-rating="medium" title="Mittel">🙂</button>
            <button type="button" class="recipe-rating-btn recipe-detail-rating ${recipe.rating === "bad" ? "active" : ""}" data-rating="bad" title="Schlecht">😕</button>
          </div>

          ${!external ? `<button class="recipe-print recipe-detail-inline-print" type="button" title="Rezept drucken">🖨</button>` : ""}
          <button class="recipe-edit recipe-detail-inline-edit" type="button" title="Rezept bearbeiten">✎</button>
          <button class="recipe-detail-inline-close" type="button" title="Schließen">×</button>
        </div>

        <div class="recipe-tools">${escapeHtml(recipeCardMark(recipe))}</div>
      </header>

      ${recipeSelfCook(recipe)
        ? `<div class="recipe-child-illustration recipe-view-switch"
              data-recipe-view-switch="detail"
              role="button"
              tabindex="0"
              title="Links auf Lou klicken: Lou-Ansicht · rechts: Kinderansicht">
              <img src="./cooking-kids-tight.png?v=50" alt="Zwei Mädchen beim Kochen">
           </div>`
        : ""}

      ${external ? `
        <div class="recipe-card-body recipe-external-body">
          <div class="recipe-external-copy">
            <strong>🔗 Internetrezept</strong>
            <span>Bezeichnung und Link.</span>
          </div>
          ${recipe.webUrl ? `<a class="recipe-external-open" href="${escapeHtml(recipe.webUrl)}" target="_blank" rel="noopener">Rezept öffnen ↗</a>` : ""}
          ${recipe.youtubeUrl ? `<a class="recipe-external-open" href="${escapeHtml(recipe.youtubeUrl)}" target="_blank" rel="noopener">Video öffnen ▶</a>` : ""}
        </div>
      ` : `
        <div class="recipe-card-body">
          <section class="recipe-column">
            <h4>ZUTATEN</h4>
            <ul>
              ${ingredientLines.map((x,i) => `
                <li class="recipe-child-checkable" data-kind="ingredient" data-index="${i}" tabindex="0">
                  ${recipeIngredientHtml(x, recipe)}
                </li>
              `).join("")}
            </ul>
          </section>

          <section class="recipe-column">
            <h4>ZUBEREITUNG</h4>
            <div class="recipe-prep-lines">
              ${stepLines.map((x,i) => `
                <div class="recipe-prep-line recipe-child-checkable" data-kind="step" data-index="${i}" tabindex="0">
                  <span class="recipe-child-step-number">${i+1}</span>
                  <span>${escapeHtml(x)}</span>
                </div>
              `).join("")}
            </div>
          </section>
        </div>

        <div class="recipe-detail-links">
          ${recipe.webUrl ? `<a href="${escapeHtml(recipe.webUrl)}" target="_blank" rel="noopener">↗ Quelle öffnen</a>` : ""}
          ${recipe.youtubeUrl ? `<a href="${escapeHtml(recipe.youtubeUrl)}" target="_blank" rel="noopener">▶ YouTube öffnen</a>` : ""}
        </div>
      `}
    </article>
  `;

  const card = body.querySelector(".recipe-detail-mirror-card");

  body.querySelectorAll(".recipe-detail-selfcook-toggle").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const active = card?.classList.toggle("recipe-child-mode");
      if (!active) card?.classList.remove("recipe-lou-mode");
      body.classList.toggle("recipe-detail-child-mode", !!active);
      if (!active) body.classList.remove("recipe-detail-lou-mode");
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.textContent = active
        ? (card?.classList.contains("recipe-lou-mode") ? "✨ Lou-Ansicht aktiv" : "🌈 Kinderansicht aktiv")
        : "👧 Das kannst du selbst kochen!";
    });
  });


  body.querySelectorAll(".recipe-view-switch").forEach(illustration => {
    const setRecipeViewFromPointer = (clientX) => {
      if (!card?.classList.contains("recipe-child-mode")) return;
      const rect=illustration.getBoundingClientRect();
      const relativeX=clientX-rect.left;
      const louMode=relativeX < rect.width * 0.50;

      card.classList.toggle("recipe-lou-mode", louMode);
      body.classList.toggle("recipe-detail-lou-mode", louMode);
      illustration.dataset.activeRecipeView = louMode ? "lou" : "kids";

      const toggle=body.querySelector(".recipe-detail-selfcook-toggle");
      if(toggle) toggle.textContent=louMode ? "✨ Lou-Ansicht aktiv" : "🌈 Kinderansicht aktiv";
    };

    illustration.addEventListener("click", e => {
      e.stopPropagation();
      setRecipeViewFromPointer(e.clientX);
    });

    illustration.addEventListener("keydown", e => {
      if(e.key==="l" || e.key==="L"){
        e.preventDefault();
        card?.classList.add("recipe-lou-mode");
        body.classList.add("recipe-detail-lou-mode");
        const toggle=body.querySelector(".recipe-detail-selfcook-toggle");
        if(toggle) toggle.textContent="✨ Lou-Ansicht aktiv";
      }
      if(e.key==="k" || e.key==="K"){
        e.preventDefault();
        card?.classList.remove("recipe-lou-mode");
        body.classList.remove("recipe-detail-lou-mode");
        const toggle=body.querySelector(".recipe-detail-selfcook-toggle");
        if(toggle) toggle.textContent="🌈 Kinderansicht aktiv";
      }
    });
  });

  body.querySelectorAll(".recipe-child-checkable").forEach(line => {
    const toggleDone = () => {
      // In beiden Ansichten nutzbar:
      // Eltern = schlicht durchgestrichen, Kinder = Regenbogenstil per CSS.
      line.classList.toggle("recipe-child-done");
    };
    line.addEventListener("click", e => {
      if (e.target.closest("button,a,input,select")) return;
      toggleDone();
    });
    line.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleDone();
      }
    });
  });

  body.querySelector(".recipe-detail-inline-close")?.addEventListener("click", () => dialog.close());

  body.querySelector(".recipe-detail-inline-print")?.addEventListener("click", () => {
    printRecipe(recipe);
  });

  body.querySelector(".recipe-detail-inline-edit")?.addEventListener("click", () => {
    dialog.close();
    startRecipeEdit(recipe);
  });

  body.querySelector(".recipe-detail-favorite")?.addEventListener("click", e => {
    recipe.favorite = !recipe.favorite;
    e.currentTarget.classList.toggle("active", recipe.favorite);
    e.currentTarget.textContent = recipe.favorite ? "★" : "☆";
    save();
    renderRecipes();
  });

  body.querySelectorAll(".recipe-detail-rating").forEach(btn => {
    btn.addEventListener("click", () => {
      const rating = btn.dataset.rating || "";
      recipe.rating = recipe.rating === rating ? "" : rating;
      save();
      body.querySelectorAll(".recipe-detail-rating").forEach(b => {
        b.classList.toggle("active", b.dataset.rating === recipe.rating);
      });
      renderRecipes();
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
      const matchesSelfCook = !recipeSelfCookOnly || recipeSelfCook(r);
      const matchesHealthy = !recipeHealthyOnly || !!r.healthy;
      const matchesFavorite = !recipeFavoriteOnly || !!r.favorite;
      const haystack = [
        r.title,
        ...(Array.isArray(r.ingredients) ? r.ingredients : [])
      ].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const firstLetter = String(r.title || "").trim().charAt(0).toLocaleUpperCase("de-DE");
      const matchesLetter = activeRecipeLetter === "all" || firstLetter === activeRecipeLetter;
      return matchesCategory && matchesDifficulty && matchesKids && matchesSelfCook && matchesHealthy &&
        matchesFavorite && matchesSearch && matchesLetter;
    })
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de", {sensitivity:"base"}));

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
    <article class="recipe-card ${recipeCategoryClass(r.category || "main")} ${r.kids ? "recipe-card-kids" : ""} ${recipeSelfCook(r) ? "recipe-card-selfcook" : ""}" id="recipe-${r.id}">
      <header class="recipe-card-head">
        <div class="recipe-time-mark"><span class="recipe-clock">◔</span><span>${escapeHtml(r.time || "–")}</span></div>
        <div class="recipe-title-wrap">
          <span class="recipe-ribbon">REZEPT</span>
          <button type="button" class="recipe-title-button" data-recipe-id="${r.id}">
            ${escapeHtml(r.title)}
          </button>
          <div class="recipe-badges">
            <span>${escapeHtml(recipeCategoryLabel(r.category || "main"))}</span>
            <span>${escapeHtml(recipeDifficultyLabel(r.difficulty))}</span>
            ${r.favorite ? `<span class="recipe-favorite-badge">★ Lieblingsrezept</span>` : ""}
            ${r.kids ? `<span class="recipe-kids-badge">🧒 Kindergericht</span>` : ""}
            ${recipeSelfCook(r) ? `<button type="button" class="recipe-selfcook-toggle" data-id="${r.id}" aria-pressed="false">👧 Das kannst du selbst kochen!</button>` : ""}
            ${recipeBeakerKitchen(r) ? `<span class="recipe-beaker-badge">🥣 Becherküche</span>` : ""}
            ${r.healthy ? `<span class="recipe-healthy-badge">🌿 Gesund & bunt</span>` : ""}
          </div>
        </div>
        <div class="recipe-card-top-controls">
          <button type="button" class="recipe-favorite-btn ${r.favorite ? "active" : ""}" data-id="${r.id}" title="Lieblingsrezept">${r.favorite ? "★" : "☆"}</button>
          <div class="recipe-rating-buttons" aria-label="Rezept bewerten">
            <button type="button" class="recipe-rating-btn ${r.rating === "good" ? "active" : ""}" data-id="${r.id}" data-rating="good" title="Gut">😊</button>
            <button type="button" class="recipe-rating-btn ${r.rating === "medium" ? "active" : ""}" data-id="${r.id}" data-rating="medium" title="Mittel">🙂</button>
            <button type="button" class="recipe-rating-btn ${r.rating === "bad" ? "active" : ""}" data-id="${r.id}" data-rating="bad" title="Schlecht">😕</button>
          </div>
          ${normalizedRecipeSource(r) === "internal" ? `<button class="recipe-print" data-id="${r.id}" type="button" title="Rezept drucken" aria-label="Rezept drucken">🖨</button>` : ""}
          <button class="recipe-edit" data-id="${r.id}" type="button" title="Rezept bearbeiten">✎</button>
          <button class="recipe-delete" data-id="${r.id}" type="button" title="Rezept löschen">×</button>
        </div>
        <div class="recipe-tools">${escapeHtml(recipeCardMark(r))}</div>
      </header>
      ${recipeSelfCook(r) ? `<div class="recipe-child-illustration recipe-view-switch"
            data-recipe-view-switch="card"
            role="button"
            tabindex="0"
            title="Links auf Lou klicken: Lou-Ansicht · rechts: Kinderansicht">
            <img src="./cooking-kids-tight.png?v=50" alt="Zwei Mädchen beim Kochen">
          </div>` : ""}
      ${normalizedRecipeSource(r) === "external" ? `
        <div class="recipe-card-body recipe-external-body">
          <div class="recipe-external-copy">
            <strong>🔗 Internetrezept</strong>
            <span>Bezeichnung und Link – ohne unnötige Rezeptfelder.</span>
          </div>
          ${r.webUrl ? `<a class="recipe-external-open" href="${escapeHtml(r.webUrl)}" target="_blank" rel="noopener">Rezept öffnen ↗</a>` : ""}
          ${r.youtubeUrl ? `<a class="recipe-external-open" href="${escapeHtml(r.youtubeUrl)}" target="_blank" rel="noopener">Video öffnen ▶</a>` : ""}
        </div>` : `
        <div class="recipe-card-body">
          <section class="recipe-column">
            <h4>ZUTATEN</h4>
            <ul>${normalizedRecipeLines(r.ingredients).map((x,i) => `<li class="recipe-child-checkable" data-kind="ingredient" data-index="${i}" tabindex="0">${recipeIngredientHtml(x, r)}</li>`).join("")}</ul>
          </section>
          <section class="recipe-column">
            <h4>ZUBEREITUNG</h4>
            <div class="recipe-prep-lines">${normalizedRecipeLines(r.steps).map((x,i) => `<div class="recipe-prep-line recipe-child-checkable" data-kind="step" data-index="${i}" tabindex="0"><span class="recipe-child-step-number">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join("")}</div>
          </section>
        </div>`}

      <footer class="recipe-card-footer">
        <div class="recipe-card-status">
          <button type="button" class="recipe-favorite-btn ${r.favorite ? "active" : ""}" data-id="${r.id}" title="Lieblingsrezept">${r.favorite ? "★" : "☆"} Favorit</button>
          <div class="recipe-rating-buttons" aria-label="Rezept bewerten">
            <button type="button" class="recipe-rating-btn ${r.rating === "good" ? "active" : ""}" data-id="${r.id}" data-rating="good" title="Gut">😊</button>
            <button type="button" class="recipe-rating-btn ${r.rating === "medium" ? "active" : ""}" data-id="${r.id}" data-rating="medium" title="Mittel">🙂</button>
            <button type="button" class="recipe-rating-btn ${r.rating === "bad" ? "active" : ""}" data-id="${r.id}" data-rating="bad" title="Schlecht">😕</button>
          </div>
          ${r.rating ? `<span class="recipe-rating-label">${recipeRatingLabel(r.rating)}</span>` : ""}
        </div>
        <div class="recipe-card-actions">
          ${normalizedRecipeSource(r) === "internal" ? `<button class="recipe-print" data-id="${r.id}" type="button" title="Rezept drucken" aria-label="Rezept drucken">🖨</button>` : ""}
          <button class="recipe-edit" data-id="${r.id}" type="button" title="Rezept bearbeiten">✎</button>
          <button class="recipe-delete" data-id="${r.id}" type="button" title="Rezept löschen">×</button>
        </div>
      </footer>
    </article>
  `).join("");

  host.querySelectorAll(".recipe-selfcook-toggle").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const card = btn.closest(".recipe-card");
      if (!card) return;
      const active = card.classList.toggle("recipe-child-mode");
      if (!active) card.classList.remove("recipe-lou-mode");
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.textContent = active
        ? (card.classList.contains("recipe-lou-mode") ? "✨ Lou-Ansicht aktiv" : "🌈 Kinderansicht aktiv")
        : "👧 Das kannst du selbst kochen!";
    });
  });


  host.querySelectorAll(".recipe-view-switch").forEach(illustration => {
    illustration.addEventListener("click", e => {
      e.stopPropagation();
      const card=illustration.closest(".recipe-card");
      if(!card?.classList.contains("recipe-child-mode")) return;

      const rect=illustration.getBoundingClientRect();
      const louMode=(e.clientX-rect.left) < rect.width * 0.50;
      card.classList.toggle("recipe-lou-mode", louMode);
      illustration.dataset.activeRecipeView = louMode ? "lou" : "kids";

      const toggle=card.querySelector(".recipe-selfcook-toggle");
      if(toggle) toggle.textContent=louMode ? "✨ Lou-Ansicht aktiv" : "🌈 Kinderansicht aktiv";
    });

    illustration.addEventListener("keydown", e => {
      const card=illustration.closest(".recipe-card");
      if(!card?.classList.contains("recipe-child-mode")) return;
      if(e.key==="l" || e.key==="L"){
        e.preventDefault();
        card.classList.add("recipe-lou-mode");
        const toggle=card.querySelector(".recipe-selfcook-toggle");
        if(toggle) toggle.textContent="✨ Lou-Ansicht aktiv";
      }
      if(e.key==="k" || e.key==="K"){
        e.preventDefault();
        card.classList.remove("recipe-lou-mode");
        const toggle=card.querySelector(".recipe-selfcook-toggle");
        if(toggle) toggle.textContent="🌈 Kinderansicht aktiv";
      }
    });
  });

  host.querySelectorAll(".recipe-child-checkable").forEach(line => {
    const toggleDone = () => {
      line.classList.toggle("recipe-child-done");
    };
    line.addEventListener("click", e => {
      if (e.target.closest("button,a,input,select")) return;
      toggleDone();
    });
    line.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleDone();
      }
    });
  });

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


  host.querySelectorAll(".recipe-favorite-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.id);
      if (!recipe) return;
      recipe.favorite = !recipe.favorite;
      recipe.updatedAt = Date.now();
      save();
      renderRecipes();
      renderMealPlan();
    });
  });

  host.querySelectorAll(".recipe-rating-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipe = state.recipes.find(r => r.id === btn.dataset.id);
      if (!recipe) return;
      const next = btn.dataset.rating || "";
      recipe.rating = recipe.rating === next ? "" : next;
      recipe.updatedAt = Date.now();
      save();
      renderRecipes();
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

  const query = activeRecipeSearch.trim().toLowerCase();
  const filtered = (Array.isArray(state.recipes) ? state.recipes : [])
    .filter(r => {
      const matchesCategory = activeRecipeCategory === "all" || (r.category || "main") === activeRecipeCategory;
      const matchesDifficulty = activeRecipeDifficulty === "all" || r.difficulty === activeRecipeDifficulty;
      const matchesKids = !recipeKidsOnly || !!r.kids;
      const matchesSelfCook = !recipeSelfCookOnly || recipeSelfCook(r);
      const matchesHealthy = !recipeHealthyOnly || !!r.healthy;
      const matchesFavorite = !recipeFavoriteOnly || !!r.favorite;
      const haystack = [r.title, ...(Array.isArray(r.ingredients) ? r.ingredients : [])].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesDifficulty && matchesKids && matchesSelfCook && matchesHealthy &&
        matchesFavorite && matchesSearch;
    })
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de", {sensitivity:"base"}));

  const countEl = document.querySelector("#recipeLibraryCount");
  if (countEl) {
    countEl.textContent = String(filtered.length);
    countEl.title = `${filtered.length} ${filtered.length === 1 ? "Rezept" : "Rezepte"}`;
  }

  if (!filtered.length) {
    activeRecipeLetter = "all";
    host.innerHTML = '<span class="recipe-toc-empty">Keine passenden Rezepte.</span>';
    return;
  }

  const counts = new Map();
  filtered.forEach(r => {
    const letter = String(r.title || "").trim().charAt(0).toLocaleUpperCase("de-DE") || "#";
    counts.set(letter, (counts.get(letter) || 0) + 1);
  });
  const letters = [...counts.keys()].sort((a,b) => a.localeCompare(b, "de", {sensitivity:"base"}));
  if (activeRecipeLetter !== "all" && !counts.has(activeRecipeLetter)) activeRecipeLetter = "all";

  host.innerHTML = `
    <button type="button" class="recipe-alpha-chip ${activeRecipeLetter === "all" ? "active" : ""}" data-letter="all">
      <span>Alle</span><b>${filtered.length}</b>
    </button>
    ${letters.map(letter => `
      <button type="button" class="recipe-alpha-chip ${activeRecipeLetter === letter ? "active" : ""}" data-letter="${escapeHtml(letter)}">
        <span>${escapeHtml(letter)}</span><b>${counts.get(letter)}</b>
      </button>`).join("")}
  `;

  host.querySelectorAll(".recipe-alpha-chip").forEach(btn => btn.addEventListener("click", () => {
    activeRecipeLetter = btn.dataset.letter || "all";
    recipePage = 0;
    renderRecipes();
    const details = document.querySelector("#recipeAlphaDetails");
    if (details?.open) details.open = false;
    requestAnimationFrame(() => document.querySelector("#recipeList")?.scrollIntoView({behavior:"smooth", block:"start"}));
  }));
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
      id: "",
      label: /^https?:\/\//i.test(entry.trim()) ? "" : entry.trim(),
      recipeId: "",
      url: /^https?:\/\//i.test(entry.trim()) ? entry.trim() : "",
      deleted: false,
      updatedAt: 0
    };
  }

  if (typeof entry !== "object" || Array.isArray(entry)) return null;

  let label = String(entry.label || "").trim();
  let url = String(entry.url || "").trim();

  if (/^https?:\/\//i.test(label) && !url) {
    url = label;
    label = "";
  }

  return {
    id: String(entry.id || ""),
    label,
    recipeId: String(entry.recipeId || ""),
    url,
    deleted: !!entry.deleted,
    updatedAt: Number(entry.updatedAt) || 0
  };
}

function normalizeMealEntries(value) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  return source
    .map(normalizeMealEntry)
    .filter(Boolean)
    .map((entry,index) => ({
      ...entry,
      id: entry.id || `legacy-${index}-${entry.recipeId || entry.url || entry.label || "meal"}`
    }));
}

function activeMealsForDate(key) {
  return normalizeMealEntries(state.meals?.[key]).filter(entry => !entry.deleted);
}

function mergeMeals(localMeals, cloudMeals) {
  const local = localMeals && typeof localMeals === "object" ? localMeals : {};
  const cloud = cloudMeals && typeof cloudMeals === "object" ? cloudMeals : {};
  const merged = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  keys.forEach(key => {
    const lList = normalizeMealEntries(local[key]);
    const cList = normalizeMealEntries(cloud[key]);
    const byId = new Map();

    [...cList, ...lList].forEach(entry => {
      const identity = entry.id || `${entry.recipeId}|${entry.url}|${entry.label}`;
      const prev = byId.get(identity);
      if (!prev || Number(entry.updatedAt || 0) >= Number(prev.updatedAt || 0)) {
        byId.set(identity, entry);
      }
    });

    merged[key] = [...byId.values()];
  });

  return merged;
}


let editingMealRef = null;

function ensureMealEditDialog() {
  let dialog = document.querySelector("#mealEditDialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "mealEditDialog";
  dialog.className = "meal-edit-dialog";
  dialog.innerHTML = `
    <div class="dialog-card meal-edit-card">
      <div class="dialog-head">
        <div>
          <p class="small-label">ESSENSPLAN</p>
          <h2>Gericht bearbeiten</h2>
        </div>
        <button type="button" class="icon-btn" id="closeMealEditDialogBtn" aria-label="Schließen">×</button>
      </div>

      <div class="meal-edit-fields">
        <label>
          <span>Name</span>
          <input id="mealEditLabel" type="text" autocomplete="on">
        </label>

        <label>
          <span>Link – optional</span>
          <input id="mealEditUrl" type="url" autocomplete="url" placeholder="https://…">
        </label>

        <label>
          <span>Kategorie</span>
          <select id="mealEditCategory">
            ${onlineRecipeCategoryMeta.map(([value,label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
        </label>

        <label>
          <span>Nach dem Kochen bewerten</span>
          <select id="mealEditRating">
            <option value="">Noch nicht bewertet</option>
            <option value="love">💛 Sehr gern wieder</option>
            <option value="okay">🙂 Passt gut</option>
            <option value="no">🌿 Eher nicht nochmal</option>
          </select>
        </label>
      </div>

      <p class="meal-edit-hint">Die Bewertung kannst du jederzeit später ergänzen. Mit einem Link erscheint das Rezept auch im Online-Rezeptbuch unter „Unser Überblick“.</p>

      <div class="dialog-actions">
        <button type="button" class="secondary-btn" id="cancelMealEditBtn">Abbrechen</button>
        <button type="button" class="primary-btn" id="saveMealEditBtn">Speichern</button>
      </div>
    </div>`;

  document.body.appendChild(dialog);

  const close = () => {
    editingMealRef = null;
    if (dialog.open) dialog.close();
  };

  dialog.querySelector("#closeMealEditDialogBtn")?.addEventListener("click", close);
  dialog.querySelector("#cancelMealEditBtn")?.addEventListener("click", close);
  dialog.addEventListener("click", e => {
    if (e.target === dialog) close();
  });

  dialog.querySelector("#saveMealEditBtn")?.addEventListener("click", () => {
    if (!editingMealRef) return close();

    const {dateKey: key, mealId} = editingMealRef;
    const list = normalizeMealEntries(state.meals?.[key]);
    const meal = list.find(x => x.id === mealId);
    if (!meal) return close();

    const oldUrl = String(meal.url || "").trim();
    const label = document.querySelector("#mealEditLabel")?.value.trim() || "";
    const url = normalizeExternalUrl(document.querySelector("#mealEditUrl")?.value || "");
    const category = document.querySelector("#mealEditCategory")?.value || "other";
    const rating = document.querySelector("#mealEditRating")?.value || "";

    if (!label && !url) return;

    meal.label = label || "Rezept";
    meal.url = url;
    meal.updatedAt = Date.now();

    const linkedRecipe = meal.recipeId
      ? (state.recipes || []).find(r => r.id === meal.recipeId)
      : null;

    if (linkedRecipe) {
      linkedRecipe.title = meal.label;
      linkedRecipe.category = category;
      if (url) linkedRecipe.webUrl = url;
      linkedRecipe.updatedAt = Date.now();
    }

    if (oldUrl && oldUrl !== url && state.recipeLinkFeedback?.[oldUrl]) {
      const oldFeedback = state.recipeLinkFeedback[oldUrl];
      if (url) state.recipeLinkFeedback[url] = {...oldFeedback};
      delete state.recipeLinkFeedback[oldUrl];
    }

    if (url) {
      const current = state.recipeLinkFeedback[url] || {};
      state.recipeLinkFeedback[url] = {
        ...current,
        category,
        rating,
        hidden:false,
        hiddenAt:0,
        updatedAt:Date.now()
      };
    }

    state.meals[key] = list;
    save();
    close();
    renderMealPlan();
    renderWeek();
    renderRecipeLinkTracker();
  });

  return dialog;
}

function openMealEditDialog(key, mealId) {
  const list = normalizeMealEntries(state.meals?.[key]);
  const meal = list.find(x => x.id === mealId);
  if (!meal) return;

  const linkedRecipe = meal.recipeId
    ? (state.recipes || []).find(r => r.id === meal.recipeId)
    : null;

  const currentUrl = String(meal.url || linkedRecipe?.webUrl || linkedRecipe?.youtubeUrl || "").trim();
  const feedback = currentUrl ? (state.recipeLinkFeedback?.[currentUrl] || {}) : {};

  editingMealRef = {dateKey:key, mealId};

  const dialog = ensureMealEditDialog();
  dialog.querySelector("#mealEditLabel").value = linkedRecipe?.title || meal.label || "";
  dialog.querySelector("#mealEditUrl").value = currentUrl;
  dialog.querySelector("#mealEditCategory").value =
    feedback.category || linkedRecipe?.category || "other";
  dialog.querySelector("#mealEditRating").value = feedback.rating || "";

  dialog.showModal();
}

function renderMealPlan() {
  const host = document.querySelector("#mealPlanGrid");
  if (!host) return;

  const monday = mealPlanMonday(mealPlanWeekOffset);
  const recipes = (state.recipes || [])
    .slice()
    .sort((a,b) => String(a.title || "").localeCompare(String(b.title || ""), "de"));

  host.innerHTML = WEEK_DAYS.map((dayName,index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate()+index);
    const key = dateKey(date);
    const meals = activeMealsForDate(key);

    const rows = meals.map(meal => {
      const matched = resolveMealRecipe(meal.recipeId, meal.label);
      return `<div class="meal-plan-entry" data-date="${key}" data-meal-id="${escapeHtml(meal.id)}">
        <div class="meal-plan-entry-main">
          <span class="meal-plan-entry-mark" aria-hidden="true"></span>
          <span class="meal-plan-entry-title">${escapeHtml(matched?.title || meal.label || "Rezept")}</span>
          ${matched ? `<button type="button" class="meal-plan-open" data-recipe-id="${matched.id}" title="Rezept öffnen">↗</button>`
            : meal.url ? `<a class="meal-plan-open" href="${escapeHtml(meal.url)}" target="_blank" rel="noopener" title="Link öffnen">↗</a>` : ""}
          <button type="button" class="meal-plan-edit" data-date="${key}" data-meal-id="${escapeHtml(meal.id)}" title="Gericht bearbeiten">✎</button>
          <button type="button" class="meal-plan-remove" data-date="${key}" data-meal-id="${escapeHtml(meal.id)}" title="Aus diesem Tag entfernen">×</button>
        </div>
      </div>`;
    }).join("");

    return `<div class="meal-plan-day">
      <div class="meal-plan-day-head">
        <span class="meal-plan-day-name">${escapeHtml(dayName)}</span>
        <span class="meal-plan-date">${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</span>
      </div>
      <div class="meal-plan-entries">${rows || `<div class="meal-plan-empty">Noch nichts geplant</div>`}</div>
      <div class="meal-plan-add-wrap">
        <div class="meal-plan-add-row">
          <input type="text" class="meal-plan-add-input" data-date="${key}" autocomplete="off" placeholder="Gericht oder Rezept …">
          <button type="button" class="meal-plan-add-btn" data-date="${key}" title="Zum Essensplan hinzufügen">＋</button>
        </div>
        <div class="meal-plan-autocomplete hidden" data-date="${key}"></div>
      </div>
    </div>`;
  }).join("");

  function addMeal(key, data) {
    const list=normalizeMealEntries(state.meals?.[key]);
    const now=Date.now();
    const entry={
      id:uid(),
      label:String(data.label||"").trim(),
      recipeId:String(data.recipeId||""),
      url:String(data.url||"").trim(),
      deleted:false,
      updatedAt:now
    };
    if(!entry.label && !entry.url) return;
    list.push(entry);
    state.meals[key]=list;
    save();
    renderMealPlan();
    renderWeek();
  }

  host.querySelectorAll(".meal-plan-add-input").forEach(input=>{
    const popup=host.querySelector(`.meal-plan-autocomplete[data-date="${CSS.escape(input.dataset.date)}"]`);

    const showSuggestions=()=>{
      const q=input.value.trim().toLowerCase();
      if(!q){ popup?.classList.add("hidden"); if(popup) popup.innerHTML=""; return; }
      const matches=recipes.filter(r=>String(r.title||"").toLowerCase().includes(q)).slice(0,6);
      if(!matches.length){ popup?.classList.add("hidden"); if(popup) popup.innerHTML=""; return; }
      popup.innerHTML=matches.map(r=>`<button type="button" class="meal-plan-autocomplete-item" data-id="${r.id}">
        <strong>${escapeHtml(r.title||"")}</strong><span>${escapeHtml(recipeCategoryLabel(r.category||"main"))}</span>
      </button>`).join("");
      popup.classList.remove("hidden");
      popup.querySelectorAll(".meal-plan-autocomplete-item").forEach(btn=>{
        btn.addEventListener("mousedown",e=>e.preventDefault());
        btn.addEventListener("click",()=>{
          const recipe=state.recipes.find(r=>r.id===btn.dataset.id);
          if(!recipe) return;
          addMeal(input.dataset.date,{
            label:recipe.title,
            recipeId:recipe.id,
            url:normalizedRecipeSource(recipe)==="external" ? (recipe.webUrl||recipe.youtubeUrl||"") : ""
          });
        });
      });
    };

    const commitMealInput = () => {
      const value=input.value.trim();
      if(!value) return;
      const recipe=recipeByTitle(value);
      addMeal(input.dataset.date,{
        label:recipe?.title || (/^https?:\/\//i.test(value) ? "Rezeptlink" : value),
        recipeId:recipe?.id || "",
        url:recipe && normalizedRecipeSource(recipe)==="external"
          ? (recipe.webUrl||recipe.youtubeUrl||"")
          : (/^https?:\/\//i.test(value) ? value : "")
      });
    };

    input.addEventListener("input",showSuggestions);
    input.addEventListener("focus",showSuggestions);
    input.addEventListener("blur",()=>setTimeout(()=>popup?.classList.add("hidden"),160));
    input.addEventListener("keydown",e=>{
      if(e.key!=="Enter") return;
      e.preventDefault();
      commitMealInput();
    });

    host.querySelector(`.meal-plan-add-btn[data-date="${CSS.escape(input.dataset.date)}"]`)
      ?.addEventListener("click", commitMealInput);
  });

  host.querySelectorAll(".meal-plan-open[data-recipe-id]").forEach(btn=>btn.addEventListener("click",()=>{
    const recipe=state.recipes.find(r=>r.id===btn.dataset.recipeId);
    if(recipe) showRecipeDetail(recipe);
  }));

  host.querySelectorAll(".meal-plan-edit").forEach(btn=>btn.addEventListener("click",()=>{
    openMealEditDialog(btn.dataset.date, btn.dataset.mealId);
  }));

  host.querySelectorAll(".meal-plan-remove").forEach(btn=>btn.addEventListener("click",()=>{
    const key=btn.dataset.date;
    const id=btn.dataset.mealId;
    const list=normalizeMealEntries(state.meals?.[key]);
    const item=list.find(x=>x.id===id);
    if(item){ item.deleted=true; item.updatedAt=Date.now(); }
    state.meals[key]=list;
    save();
    renderMealPlan();
    renderWeek();
  }));

  document.querySelector("#mealPlanThisWeekBtn")?.classList.toggle("active", mealPlanWeekOffset===0);
  document.querySelector("#mealPlanNextWeekBtn")?.classList.toggle("active", mealPlanWeekOffset===1);
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
  const id = pendingRecipeDeleteId;
  markListItemDeleted("recipeTombstones", id);
  state.recipes = state.recipes.filter(r => r.id !== id);
  pendingRecipeDeleteId = null;
  save();
  persistTopLevelDeletionImmediately("recipes");
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
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
  renderRecipeSearchSuggestions();
});


document.querySelector("#recipeCategoryFilter")?.addEventListener("change", e => {
  recipeCategoryTouched = true;
  activeRecipeCategory = e.currentTarget.value || "all";
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeDifficultyFilter")?.addEventListener("change", e => {
  activeRecipeDifficulty = e.currentTarget.value || "all";
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
});
document.querySelector("#recipeKidsOnlyFilter")?.addEventListener("change", e => {
  recipeKidsOnly = !!e.currentTarget.checked;
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeSelfCookOnlyFilter")?.addEventListener("change", e => {
  recipeSelfCookOnly = !!e.currentTarget.checked;
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeHealthyOnlyFilter")?.addEventListener("change", e => {
  recipeHealthyOnly = !!e.currentTarget.checked;
  activeRecipeLetter = "all";
  recipePage = 0;
  renderRecipes();
});

document.querySelector("#recipeFavoriteOnlyFilter")?.addEventListener("change", e => {
  recipeFavoriteOnly = !!e.currentTarget.checked;
  activeRecipeLetter = "all";
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
document.querySelector("#saveRecipeBtn")?.addEventListener("click", () => {
  const title = document.querySelector("#recipeTitle")?.value.trim() || "";
  if (!title) return showMotivation("Bitte zuerst einen Rezeptnamen eintragen.");

  const existingRecipe = editingRecipeId ? state.recipes.find(r => r.id === editingRecipeId) : null;
  const sourceType = "internal";
  const webUrl = existingRecipe?.webUrl || "";
  const youtubeUrl = existingRecipe?.youtubeUrl || "";

  const recipeData = {
    title,
    sourceType,
    rating: document.querySelector("#recipeRating")?.value || "",
    favorite: !!document.querySelector("#recipeFavorite")?.checked,
    category: document.querySelector("#recipeCategory")?.value || "main",
    cardMark: document.querySelector("#recipeCardMark")?.value || "⌁",
    difficulty: document.querySelector("#recipeDifficulty")?.value || "medium",
    kids: !!document.querySelector("#recipeKids")?.checked,
    selfCook: !!document.querySelector("#recipeSelfCook")?.checked,
    beakerKitchen: !!document.querySelector("#recipeBeakerKitchen")?.checked,
      beakerMappings: readRecipeBeakerMappings(),
    healthy: !!document.querySelector("#recipeHealthy")?.checked,
    time: document.querySelector("#recipeTime")?.value.trim() || "",
    bakeTime: document.querySelector("#recipeBakeTime")?.value.trim() || "",
    temperature: document.querySelector("#recipeTemperature")?.value.trim() || "",
    servings: document.querySelector("#recipeServings")?.value.trim() || "",
    ingredients: recipeLines(document.querySelector("#recipeIngredients")?.value),
    steps: recipeLines(document.querySelector("#recipeSteps")?.value),
    webUrl,
    youtubeUrl
  };

  if (editingRecipeId) {
    const recipe = state.recipes.find(r => r.id === editingRecipeId);
    if (recipe) {
      Object.assign(recipe, recipeData, {updatedAt: Date.now()});

      // Bereits verknüpfte Essensplan-Einträge behalten die Verbindung,
      // bekommen aber automatisch den neuen Rezeptnamen.
      Object.keys(state.meals || {}).forEach(key => {
        const meals = normalizeMealEntries(state.meals[key]);
        meals.forEach(meal => {
          if (meal.recipeId === recipe.id) {
            meal.label = recipe.title;
            meal.updatedAt = Date.now();
          }
        });
        state.meals[key] = meals;
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


// ===== AUS DEM LETZTEN VOLLSTÄNDIGEN ZWEIG ZURÜCKGEHOLTE FUNKTIONEN =====
function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}


function austrianPublicHoliday(date) {
  const year = date.getFullYear();
  const key = dateKey(date);
  const fixed = {
    [`${year}-01-01`]: "Neujahr",
    [`${year}-01-06`]: "Heilige Drei Könige",
    [`${year}-05-01`]: "Staatsfeiertag",
    [`${year}-08-15`]: "Mariä Himmelfahrt",
    [`${year}-10-26`]: "Nationalfeiertag",
    [`${year}-11-01`]: "Allerheiligen",
    [`${year}-12-08`]: "Mariä Empfängnis",
    [`${year}-12-25`]: "Christtag",
    [`${year}-12-26`]: "Stephanitag"
  };
  if (fixed[key]) return fixed[key];

  const easter = easterSunday(year);
  const moving = new Map([
    [dateKey(addDays(easter, 1)), "Ostermontag"],
    [dateKey(addDays(easter, 39)), "Christi Himmelfahrt"],
    [dateKey(addDays(easter, 50)), "Pfingstmontag"],
    [dateKey(addDays(easter, 60)), "Fronleichnam"]
  ]);
  return moving.get(key) || "";
}


function clampWorkroomPage(page, totalItems) {
  const maxPage = Math.max(0, Math.ceil(totalItems / WORKROOM_PAGE_SIZE) - 1);
  return Math.min(Math.max(0, page), maxPage);
}


function closeFamilyTimetableEditorDialog() {
  document.querySelector("#manualTimetableWrapmama")?.classList.add("hidden");
  document.querySelector("#familyTimetableDialog .family-timetable-buttons")?.classList.remove("hidden");
  familyTimetableDialog?.close();
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
        category:recipe.category || "other",
        sourceUpdatedAt:Number(recipe.updatedAt || recipe.createdAt || 0)
      };

      const previous = map.get(key);
      if (!previous || candidate.sourceUpdatedAt >= Number(previous.sourceUpdatedAt || 0)) {
        map.set(key, candidate);
      }
    });
  });

  Object.values(state.meals || {}).forEach(dayValue => {
    normalizeMealEntries(dayValue).filter(meal => !meal.deleted).forEach(meal => {
      if (!meal.url) return;
      const key = String(meal.url).trim();
      if (!key) return;

      const linkedRecipe = meal.recipeId
        ? (state.recipes || []).find(r => r.id === meal.recipeId)
        : null;

      const candidate = {
        url:key,
        label:meal.label || linkedRecipe?.title || "Rezeptlink",
        source:"Essensplan",
        recipeId:meal.recipeId || "",
        category:linkedRecipe?.category || "other",
        sourceUpdatedAt:Number(meal.updatedAt || linkedRecipe?.updatedAt || linkedRecipe?.createdAt || 0)
      };

      const previous = map.get(key);
      if (!previous || candidate.sourceUpdatedAt >= Number(previous.sourceUpdatedAt || 0)) map.set(key,candidate);
    });
  });

  return [...map.values()]
    .filter(item => {
      const feedback = state.recipeLinkFeedback?.[item.url] || {};
      const hiddenAt = Number(feedback.hiddenAt || 0);

      // × räumt den aktuellen Fund nur aus der Übersicht.
      // Wird der Link später im Essensplan/Rezept neu gespeichert,
      // ist sourceUpdatedAt neuer und er darf wieder erscheinen.
      const feedbackWasReactivated =
        feedback.hidden === false &&
        Number(feedback.updatedAt || 0) > hiddenAt;

      return !hiddenAt ||
        feedbackWasReactivated ||
        Number(item.sourceUpdatedAt || 0) > hiddenAt;
    })
    .sort((a,b) => String(a.label).localeCompare(String(b.label), "de"));
}


function easterSunday(year) {
  // Gregorianischer Osteralgorithmus (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 12, 0, 0, 0);
}

/* CODE-AUDIT: frühere, überschriebene Definition von ensureMobileWeekActionCircleStyles entfernt. */

function ensureRecipeCardMarkPicker() {
  if (document.querySelector("#recipeCardMark")) return;

  const category = document.querySelector("#recipeCategory");
  if (!category) return;

  const wrapper = document.createElement("label");
  wrapper.className = "recipe-card-mark-field";
  wrapper.innerHTML = `
    <span>Kartenzeichen</span>
    <select id="recipeCardMark">
      <optgroup label="Ruhig & geschmackvoll">
        <option value="⌁">⌁ Feine Linie</option>
        <option value="✦">✦ Stern</option>
        <option value="☾">☾ Mond</option>
        <option value="♡">♡ Herz</option>
        <option value="❋">❋ Blüte</option>
        <option value="◌">◌ Kreis</option>
        <option value="≈">≈ Welle</option>
        <option value="∞">∞ Unendlich</option>
      </optgroup>
      <optgroup label="Cool">
        <option value="⚡︎">⚡ Blitz</option>
        <option value="★">★ Star</option>
        <option value="☻">☻ Smiley</option>
        <option value="♬">♬ Musik</option>
        <option value="✌︎">✌ Peace</option>
        <option value="✪">✪ Cool Star</option>
      </optgroup>
    </select>
  `;

  // Direkt hinter der Kategorie – so gehört es logisch zur Rezeptgestaltung.
  const parent = category.closest("label") || category.parentElement;
  if (parent?.parentElement) {
    parent.insertAdjacentElement("afterend", wrapper);
  } else {
    category.insertAdjacentElement("afterend", wrapper);
  }
}


function ensureRecipeCardMarkStyles() {
  if (document.querySelector("#recipeCardMarkStyles")) return;

  const style = document.createElement("style");
  style.id = "recipeCardMarkStyles";
  style.textContent = `
    .recipe-card-mark-field{
      display:grid;
      gap:5px;
      min-width:145px;
      color:#786f69;
      font-size:.7rem;
    }

    .recipe-card-mark-field select{
      width:100%;
      min-height:38px;
      border:1px solid var(--line, #e7ddd7);
      border-radius:12px;
      background:#fffdfb;
      color:var(--ink, #514944);
      padding:8px 10px;
      font:inherit;
    }

    .recipe-tools,
    .recipe-detail-utensil{
      font-family:Georgia, "Times New Roman", serif !important;
      font-size:1.45rem !important;
      line-height:1 !important;
      letter-spacing:0 !important;
      opacity:.74;
      transform:none !important;
    }

    .recipe-detail-utensil{
      display:grid;
      place-items:center;
      min-width:32px;
      min-height:32px;
    }

    @media(max-width:700px){
      .recipe-card-mark-field{
        min-width:0;
      }
    }
  `;
  document.head.appendChild(style);
}

/* CODE-AUDIT: frühere, überschriebene Definition von ensureRecipeFormAndMobileActionStyles entfernt. */

function firstWeekdayOfMonth(year, monthIndex, weekday) {
  const d = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const shift = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + shift);
  return d;
}


function generatedNoeSchoolYear(startYear) {
  const nextYear = startYear + 1;
  const start = firstWeekdayOfMonth(startYear, 8, 1); // erster Montag im September
  const julyFirstSaturday = firstWeekdayOfMonth(nextYear, 6, 6);
  const end = addDays(julyFirstSaturday, -1);
  const easter = easterSunday(nextYear);
  const semesterStart = firstWeekdayOfMonth(nextYear, 1, 1); // erster Montag im Februar

  return {
    label: `${startYear}/${String(nextYear).slice(-2)}`,
    start: dateKey(start),
    end: dateKey(end),
    generated: true,
    freeRanges: [
      [`${startYear}-10-26`, `${startYear}-11-02`],
      [`${startYear}-11-15`, `${startYear}-11-15`], // Hl. Leopold, NÖ
      [`${startYear}-12-08`, `${startYear}-12-08`],
      [`${startYear}-12-24`, `${nextYear}-01-06`],
      [dateKey(semesterStart), dateKey(addDays(semesterStart, 5))],
      [dateKey(addDays(easter, -8)), dateKey(addDays(easter, 1))],
      [`${nextYear}-05-01`, `${nextYear}-05-01`],
      [dateKey(addDays(easter, 39)), dateKey(addDays(easter, 39))],
      [dateKey(addDays(easter, 48)), dateKey(addDays(easter, 50))],
      [dateKey(addDays(easter, 60)), dateKey(addDays(easter, 60))]
    ]
  };
}

/* CODE-AUDIT: frühere, überschriebene Definition von makeLocalSafetyBackup entfernt. */

function mergeSchool(localSchool, cloudSchool) {
  if (!localSchool?.children) return cloudSchool?.children ? cloudSchool : localSchool;
  if (!cloudSchool?.children) return localSchool;

  const merged = structuredClone(localSchool);

  ["1","2"].forEach(id => {
    const l = localSchool.children[id] || {};
    const c = cloudSchool.children[id] || {};

    const deletedTaskIds = [...new Set([
      ...(Array.isArray(l.deletedTaskIds) ? l.deletedTaskIds : []),
      ...(Array.isArray(c.deletedTaskIds) ? c.deletedTaskIds : [])
    ])];

    const deletedLinkIds = [...new Set([
      ...(Array.isArray(l.deletedLinkIds) ? l.deletedLinkIds : []),
      ...(Array.isArray(c.deletedLinkIds) ? c.deletedLinkIds : [])
    ])];

    merged.children[id] = {
      ...c,
      ...l,
      name: l.name || c.name || (id === "1" ? "Lou" : "Fina"),
      deletedTaskIds,
      deletedLinkIds,
      tasks: mergeByIdPreferNewer(l.tasks, c.tasks)
        .filter(task => !deletedTaskIds.includes(task.id)),
      links: mergeByIdPreferNewer(l.links, c.links)
        .filter(link => !deletedLinkIds.includes(link.id)),
      interestLinks: mergeByIdPreferNewer(l.interestLinks, c.interestLinks),
      timetableUrl: l.timetableUrl || c.timetableUrl || "",
      manualTimetable: l.manualTimetable || c.manualTimetable || null,
      timetableByYear: {
        ...(c.timetableByYear || {}),
        ...(l.timetableByYear || {})
      }
    };
  });

  return merged;
}


function nonEmptyWorkroomScore(w) {
  if (!w || typeof w !== "object") return 0;
  return ["todos","prints","links","substitutions"].reduce(
    (sum, key) => sum + (Array.isArray(w[key]) ? w[key].length : 0), 0
  );
}

/* CODE-AUDIT: frühere, überschriebene Definition von normalizeRecipeFlagLayout entfernt. */

function normalizeWorkroom(w) {
  const src = w && typeof w === "object" ? w : {};
  return {
    todos: Array.isArray(src.todos) ? src.todos : [],
    todoTombstones: src.todoTombstones && typeof src.todoTombstones === "object"
      ? src.todoTombstones
      : {},
    printTombstones: src.printTombstones && typeof src.printTombstones === "object"
      ? src.printTombstones
      : {},
    linkTombstones: src.linkTombstones && typeof src.linkTombstones === "object"
      ? src.linkTombstones
      : {},
    substitutionTombstones: src.substitutionTombstones && typeof src.substitutionTombstones === "object"
      ? src.substitutionTombstones
      : {},
    shoppingTombstones: src.shoppingTombstones && typeof src.shoppingTombstones === "object"
      ? src.shoppingTombstones
      : {},
    prints: Array.isArray(src.prints) ? src.prints : [],
    links: Array.isArray(src.links) ? src.links : [],
    interestLinks: Array.isArray(src.interestLinks) ? src.interestLinks : [],
    shopping: Array.isArray(src.shopping) ? src.shopping : [],
    substitutions: Array.isArray(src.substitutions) ? src.substitutions : [],
    routines: src.routines && typeof src.routines === "object"
      ? {
          items: Array.isArray(src.routines.items) ? src.routines.items : [],
          completions: src.routines.completions && typeof src.routines.completions === "object"
            ? src.routines.completions
            : {},
          inspirationChecks: src.routines.inspirationChecks && typeof src.routines.inspirationChecks === "object"
            ? src.routines.inspirationChecks
            : {},
          tombstones: src.routines.tombstones && typeof src.routines.tombstones === "object"
            ? src.routines.tombstones
            : {}
        }
      : {items:[], completions:{}, inspirationChecks:{}, tombstones:{}},
    plans: src.plans && typeof src.plans === "object"
      ? src.plans
      : {week:[], year:[]}
  };
}


function openFamilyTimetableChooser(mode = "view") {
  familyTimetableMode = mode;
  document.querySelector("#manualTimetableWrapmama")?.classList.add("hidden");
  document.querySelector("#familyTimetableDialog .family-timetable-buttons")?.classList.remove("hidden");

  const title = document.querySelector("#familyTimetableDialogTitle");
  if (title) {
    title.textContent = mode === "edit"
      ? "Welchen Stundenplan bearbeiten?"
      : "Welchen Stundenplan ansehen?";
  }

  familyTimetableDialog?.showModal();
}


function openMamaTimetableEditorDirect() {
  familyTimetableMode = "edit";

  const title = document.querySelector("#familyTimetableDialogTitle");
  if (title) title.textContent = "Mama – Stundenplan bearbeiten";

  const chooserButtons = document.querySelector("#familyTimetableDialog .family-timetable-buttons");
  if (chooserButtons) chooserButtons.classList.add("hidden");

  familyTimetableDialog?.showModal();
  renderTTMatrix("mama");
  document.querySelector("#manualTimetableWrapmama")?.classList.remove("hidden");
}


function openRecipeReuseDialog(link) {
  const dialog = document.querySelector("#recipePlanDialog");
  if (!dialog || !link?.url) return;

  replanRecipeLink = {
    url:String(link.url || "").trim(),
    label:String(link.label || "Rezept").trim(),
    recipeId:String(link.recipeId || "")
  };

  const name = document.querySelector("#recipePlanRecipeName");
  const week = document.querySelector("#recipePlanWeek");
  const day = document.querySelector("#recipePlanDay");
  if (name) name.textContent = replanRecipeLink.label || "Rezept";
  if (week) week.value = "0";
  if (day) day.value = "Montag";
  dialog.showModal();
}

function populateSchoolYearSelect(select) {
  if (!select) return;
  const selectedKey = state.settings.schoolYear || "2026-27";
  const nowYear = new Date().getFullYear();
  const selectedStart = Number(selectedKey.slice(0, 4)) || nowYear;
  const first = Math.min(nowYear - 1, selectedStart);
  const last = Math.max(nowYear + 8, selectedStart + 2);

  const keys = [];
  for (let y = first; y <= last; y++) keys.push(schoolYearKey(y));

  select.innerHTML = keys.map(key => {
    const sy = schoolYearConfig(key);
    return `<option value="${key}">${escapeHtml(sy.label)}</option>`;
  }).join("");
  select.value = selectedKey;
}


function recipeCardMark(recipe) {
  return recipe?.cardMark || "⌁";
}


function recipeFeedbackLabel(value) {
  return {
    love: "💛 Sehr gern wieder",
    okay: "🙂 Passt gut",
    no: "🌿 Eher nicht nochmal"
  }[value] || "Noch offen";
}



function onlineRecipeCategoryKey(link) {
  const feedback = state.recipeLinkFeedback?.[link.url] || {};
  const key = feedback.category || link.category || "other";
  return onlineRecipeCategoryMeta.some(([value]) => value === key) ? key : "other";
}

function renderRecipeLinkTracker() {
  const host = document.querySelector("#recipeLinkTrackerList");
  if (!host) return;

  const onlineRecipeSearchBar=ensureCollectionSearchBar({
    anchor:host,
    id:"onlineRecipeSearchBar",
    placeholder:"Online-Rezepte suchen …",
    value:collectionSearchState.onlineRecipes,
    visible:true,
    onInput:value=>{
      collectionSearchState.onlineRecipes=value;
      onlineRecipeGroupLimit=8;
      renderRecipeLinkTracker();
    }
  });

  const allLinks = collectInternetRecipeLinks();
  const categoryLinks = onlineRecipeCategoryFilter === "all"
    ? allLinks
    : allLinks.filter(link => onlineRecipeCategoryKey(link) === onlineRecipeCategoryFilter);
  const links = categoryLinks.filter(link =>
    collectionSearchMatches(collectionSearchState.onlineRecipes,[
      link.label,
      link.source,
      link.url,
      onlineRecipeCategoryKey(link)
    ])
  );

  updateCollectionSearchCount(
    onlineRecipeSearchBar,
    links.length,
    categoryLinks.length,
    "Rezepte"
  );

  if (!allLinks.length) {
    host.innerHTML = `<div class="overview-empty">Noch keine Internetrezepte hinterlegt. Sobald eine Rezeptkarte oder ein Essensplan-Eintrag einen Web-/YouTube-Link hat, erscheint er hier zum Bewerten.</div>`;
    return;
  }

  const groups = [
    {key:"love", title:"💛 Sehr gern wieder", hint:"Favoriten für den Essensplan"},
    {key:"okay", title:"🙂 Passt gut", hint:"Kann gern wiederkommen"},
    {key:"unrated", title:"○ Noch nicht bewertet", hint:"Erst noch ausprobieren"},
    {key:"no", title:"🌿 Eher nicht nochmal", hint:"Bleibt der Vollständigkeit halber hier"}
  ];

  const grouped = {
    love:[],
    okay:[],
    unrated:[],
    no:[]
  };

  links.forEach(link => {
    const feedback = state.recipeLinkFeedback[link.url] || {};
    const rating = ["love","okay","no"].includes(feedback.rating) ? feedback.rating : "unrated";
    grouped[rating].push(link);
  });

  Object.values(grouped).forEach(list => {
    list.sort((a,b) => {
      const aFeedback = state.recipeLinkFeedback[a.url] || {};
      const bFeedback = state.recipeLinkFeedback[b.url] || {};
      return Number(bFeedback.timesUsed || 0) - Number(aFeedback.timesUsed || 0) ||
        String(a.label || "").localeCompare(String(b.label || ""), "de", {sensitivity:"base"});
    });
  });

  const rowHtml = link => {
    const feedback = state.recipeLinkFeedback[link.url] || {};
    return `
      <article class="recipe-link-track-row">
        <div class="recipe-link-track-main">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>
          <span>${escapeHtml(link.source)}${feedback.timesUsed ? ` · ${feedback.timesUsed}× gekocht` : ""}</span>
        </div>

        <label class="recipe-link-category-wrap">
          <span>Kategorie</span>
          <select class="recipe-link-category" data-url="${escapeHtml(link.url)}">
            ${onlineRecipeCategoryMeta.map(([value,label]) =>
              `<option value="${value}"${onlineRecipeCategoryKey(link) === value ? " selected" : ""}>${label}</option>`
            ).join("")}
          </select>
        </label>

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
  };

  const filterBar = `
    <div class="online-recipe-filterbar">
      <label>
        <span>Kategorie</span>
        <select id="onlineRecipeCategoryFilter">
          <option value="all"${onlineRecipeCategoryFilter === "all" ? " selected" : ""}>Alle Rezeptideen</option>
          ${onlineRecipeCategoryMeta.map(([value,label]) =>
            `<option value="${value}"${onlineRecipeCategoryFilter === value ? " selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </label>
      <span class="online-recipe-filter-count">${links.length} von ${allLinks.length}</span>
    </div>`;

  const groupHtml = groups.map(group => {
    const items = grouped[group.key];
    if (!items.length) return "";
    const shown=items.slice(0,onlineRecipeGroupLimit);
    const remaining=Math.max(0,items.length-shown.length);

    return `
      <section class="online-recipe-group" data-group="${group.key}">
        <div class="online-recipe-group-head">
          <div>
            <strong>${group.title}</strong>
            <span>${group.hint}</span>
          </div>
          <b>${items.length}</b>
        </div>
        <div class="online-recipe-group-list">
          ${shown.map(rowHtml).join("")}
        </div>
        ${remaining ? `<button type="button" class="secondary-btn online-recipe-more" data-more="${remaining}">Weitere anzeigen (${remaining})</button>` : ""}
      </section>
    `;
  }).join("");

  host.innerHTML = filterBar + (
    groupHtml ||
    `<div class="overview-empty">In dieser Kategorie sind noch keine Internetrezepte gespeichert.</div>`
  );

  host.querySelector("#onlineRecipeCategoryFilter")?.addEventListener("change", e => {
    onlineRecipeCategoryFilter = e.currentTarget.value || "all";
    onlineRecipeGroupLimit=8;
    renderRecipeLinkTracker();
  });

  host.querySelectorAll(".online-recipe-more").forEach(btn=>{
    btn.addEventListener("click",()=>{
      onlineRecipeGroupLimit+=8;
      renderRecipeLinkTracker();
    });
  });

  host.querySelectorAll(".recipe-link-category").forEach(select => {
    select.addEventListener("change", e => {
      const url = e.currentTarget.dataset.url || "";
      if (!url) return;
      const current = state.recipeLinkFeedback[url] || {};
      state.recipeLinkFeedback[url] = {
        ...current,
        category:e.currentTarget.value || "other",
        hidden:false,
        hiddenAt:0,
        updatedAt:Date.now()
      };
      save();
      renderRecipeLinkTracker();
    });
  });

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
        hidden: false,
        hiddenAt: 0,
        updatedAt: Date.now()
      };
      save();
      renderRecipeLinkTracker();
      renderWeek();
    });
  });

  host.querySelectorAll(".recipe-link-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      const current = state.recipeLinkFeedback[url] || {};
      const now = Date.now();

      state.recipeLinkFeedback[url] = {
        ...current,
        hidden:true,
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


function renderSubstitutions() {
  const host = document.querySelector("#substitutionList");
  if (!host) return;

  state.workroom.substitutions = Array.isArray(state.workroom.substitutions)
    ? state.workroom.substitutions
    : [];

  const items = [...state.workroom.substitutions]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  if (!items.length) {
    host.innerHTML = `<div class="workroom-empty substitution-empty">Noch keine Supplierungen eingetragen.</div>`;
    return;
  }

  const totalHours = items.reduce((sum, item) => sum + (Number(item.hours) || 1), 0);

  host.innerHTML = `
    <div class="substitution-summary">
      <span>Für die Abrechnung</span>
      <strong>${String(totalHours).replace(".", ",")} Std.</strong>
    </div>
    <div class="substitution-grid">
      ${items.map(item => {
        const dateLabel = item.date
          ? parseLocalDate(item.date)?.toLocaleDateString("de-AT", {
              weekday:"short", day:"2-digit", month:"2-digit"
            }) || item.date
          : "";
        const hours = Number(item.hours) || 1;

        return `
          <div class="substitution-item">
            <div class="substitution-item-main">
              <div class="substitution-topline">
                <strong>${escapeHtml(dateLabel)}</strong>
                <span class="substitution-hours">${String(hours).replace(".", ",")} Std.</span>
              </div>
              <span>${escapeHtml(item.className || "")}${item.className && item.subject ? " · " : ""}${escapeHtml(item.subject || "")}</span>
              ${item.forWhom ? `<small>für ${escapeHtml(item.forWhom)}</small>` : ""}
              ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
            </div>
            <button type="button" class="substitution-delete" data-id="${item.id}" title="Löschen" aria-label="Supplierung löschen">×</button>
          </div>
        `;
      }).join("")}
    </div>
  `;

  host.querySelectorAll(".substitution-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      state.workroom.substitutionTombstones = state.workroom.substitutionTombstones || {};
      state.workroom.substitutionTombstones[id] = Date.now();
      state.workroom.substitutions = state.workroom.substitutions
        .filter(item => item.id !== id);
      save();
      persistWorkroomListDeletionImmediately("substitutions", id);
      renderSubstitutions();
    });
  });
}


function renderWorkroomPager(listElement, totalItems, currentPage, onChange, showSingle = false) {
  if (!listElement) return;

  const old = listElement.parentElement?.querySelector(
    `.workroom-pager[data-for="${listElement.id}"]`
  );
  if (old) old.remove();

  const totalPages = Math.max(1, Math.ceil(totalItems / WORKROOM_PAGE_SIZE));
  if (totalItems === 0) return;
  if (totalPages <= 1 && !showSingle) return;

  const pager = document.createElement("div");
  pager.className = "workroom-pager";
  pager.dataset.for = listElement.id;

  const buttons = [];
  for (let i = 0; i < totalPages; i++) {
    const near = Math.abs(i - currentPage) <= 2;
    const edge = i === 0 || i === totalPages - 1;
    if (totalPages <= 7 || near || edge) {
      buttons.push(`<button type="button" class="workroom-page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i + 1}</button>`);
    }
  }

  pager.innerHTML = `
    <button type="button" class="workroom-page-btn" data-page="${currentPage - 1}" ${currentPage <= 0 ? "disabled" : ""}>‹</button>
    ${buttons.join("")}
    <button type="button" class="workroom-page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages - 1 ? "disabled" : ""}>›</button>
  `;

  listElement.insertAdjacentElement("afterend", pager);

  pager.querySelectorAll(".workroom-page-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const next = Number(btn.dataset.page);
      if (!Number.isFinite(next) || next < 0 || next >= totalPages) return;
      onChange(next);
    });
  });
}


function schoolYearConfig(key) {
  if (NOE_SCHOOL_YEARS[key]?.start) return NOE_SCHOOL_YEARS[key];
  const startYear = Number(String(key || "").slice(0, 4));
  return Number.isFinite(startYear) ? generatedNoeSchoolYear(startYear) : NOE_SCHOOL_YEARS["2026-27"];
}


function schoolYearKey(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/* CODE-AUDIT: frühere, überschriebene Definition von snapshotPersistentState entfernt. */

function updateSchoolYearTexts() {
  const sy = activeSchoolYear();
  const recurrenceOption = document.querySelector('#recurrence option[value="schoolyear-noe"]');
  const hint = document.querySelector("#schoolHolidayHint");

  if (recurrenceOption) recurrenceOption.textContent = `Schuljahr NÖ ${sy.label}`;
  if (hint) {
    hint.textContent = sy.generated
      ? `🎒 Schuljahr NÖ ${sy.label} – automatisch weitergeführt. Ferien werden nach dem üblichen NÖ-Rhythmus berechnet; abweichende oder schulautonome Tage bitte prüfen.`
      : `🎒 Wöchentlich im Schuljahr NÖ ${sy.label} – Ferien und offizielle schulfreie Tage werden ausgelassen.`;
  }
}


function workroomPageSlice(items, page) {
  const start = page * WORKROOM_PAGE_SIZE;
  return items.slice(start, start + WORKROOM_PAGE_SIZE);
}

function bindSchoolYearSetting(){
  const select = document.querySelector("#schoolYearSelect");
  if (!select) return;

  populateSchoolYearSelect(select);
  updateSchoolYearTexts();

  if (!select.dataset.bound) {
    select.dataset.bound = "1";
    select.addEventListener("change", () => {
      state.settings.schoolYear = select.value;
      localStorage.setItem("balanceProd.schoolYear", select.value);
      updateSchoolYearTexts();
      if (typeof updateSchoolyearNoeUI === "function") updateSchoolyearNoeUI();
      renderAll();
      const sy = activeSchoolYear();
      showMotivation(`Schuljahr ${sy.label} ist jetzt ausgewählt.`);
    });
  }
}

function snapshotPersistentState() {
  return {
    savedAt: Date.now(),
    videos: state.videos,
    todos: state.todos,
    archive: state.archive,
    shopping: state.shopping,
    shoppingPromos: state.shoppingPromos || [],
    recipes: state.recipes,
    meals: state.meals,
    pinboard: state.pinboard,
    familyQuestions: state.familyQuestions || [],
    timeTracking: state.timeTracking,
    trash: state.trash || [],
    todoTombstones: state.todoTombstones || {},
    videoTombstones: state.videoTombstones || {},
    archiveTombstones: state.archiveTombstones || {},
    recipeTombstones: state.recipeTombstones || {},
    pinboardTombstones: state.pinboardTombstones || {},
    trashTombstones: state.trashTombstones || {},
    recipeLinkFeedback: state.recipeLinkFeedback,
    workroom: state.workroom,
    school: state.school,
    familySettings: state.familySettings,
    familyColors: state.familyColors || {},
    settings: state.settings || {}
  };
}
function makeLocalSafetyBackup() {
  try {
    const current = JSON.stringify(snapshotPersistentState());
    const last = localStorage.getItem("balanceProd.safetyBackup.1");
    if (last !== current) {
      localStorage.setItem("balanceProd.safetyBackup.3", localStorage.getItem("balanceProd.safetyBackup.2") || "");
      localStorage.setItem("balanceProd.safetyBackup.2", localStorage.getItem("balanceProd.safetyBackup.1") || "");
      localStorage.setItem("balanceProd.safetyBackup.1", current);
    }
  } catch (err) {
    console.warn("Lokales Sicherheitsbackup fehlgeschlagen:", err);
  }
}
function saveLocal() {
  try { makeLocalSafetySnapshot("vor-lokal-speichern"); } catch (_) {}
  try {
    if (typeof makeLocalSafetyBackup === "function") makeLocalSafetyBackup();
  } catch (_) {}

  localStorage.setItem("balanceProd.videos", JSON.stringify(state.videos));
  localStorage.setItem("balanceProd.todos", JSON.stringify(state.todos));
  localStorage.setItem("balanceProd.archive", JSON.stringify(state.archive));
  localStorage.setItem("balanceProd.shopping", JSON.stringify(state.shopping));
  localStorage.setItem("balanceProd.shoppingPromos", JSON.stringify(state.shoppingPromos || []));
  localStorage.setItem("balanceProd.recipes", JSON.stringify(state.recipes));
  localStorage.setItem("balanceProd.meals", JSON.stringify(state.meals));
  localStorage.setItem("balanceProd.pinboard", JSON.stringify(state.pinboard));
  persistFamilyQuestionsNow();
  localStorage.setItem("balanceProd.recipeLinkFeedback", JSON.stringify(state.recipeLinkFeedback));
  localStorage.setItem("balanceProd.timeTracking", JSON.stringify(state.timeTracking));
  localStorage.setItem("balanceProd.trash", JSON.stringify(state.trash || []));
  localStorage.setItem("balanceProd.todoTombstones", JSON.stringify(state.todoTombstones || {}));
  localStorage.setItem("balanceProd.videoTombstones", JSON.stringify(state.videoTombstones || {}));
  localStorage.setItem("balanceProd.archiveTombstones", JSON.stringify(state.archiveTombstones || {}));
  localStorage.setItem("balanceProd.recipeTombstones", JSON.stringify(state.recipeTombstones || {}));
  localStorage.setItem("balanceProd.pinboardTombstones", JSON.stringify(state.pinboardTombstones || {}));
  localStorage.setItem("balanceProd.trashTombstones", JSON.stringify(state.trashTombstones || {}));
  localStorage.setItem("balanceProd.workroom", JSON.stringify(state.workroom));
  localStorage.setItem("balanceProd.school", JSON.stringify(state.school));
  localStorage.setItem("balanceProd.familySettings", JSON.stringify(state.familySettings));
  localStorage.setItem("balanceProd.familyColors", JSON.stringify(state.familyColors || {}));
  localStorage.setItem("balanceProd.schoolYear", state.settings?.schoolYear || "2026-27");
  localStorage.setItem("balanceProd.familyBorderWidth", state.settings?.familyBorderWidth || "3");
}

function cloudPayload() {
  return JSON.parse(JSON.stringify({
    videos: state.videos,
    todos: state.todos,
    trash: state.trash || [],
    todoTombstones: state.todoTombstones || {},
    videoTombstones: state.videoTombstones || {},
    archiveTombstones: state.archiveTombstones || {},
    recipeTombstones: state.recipeTombstones || {},
    pinboardTombstones: state.pinboardTombstones || {},
    trashTombstones: state.trashTombstones || {},
    archive: state.archive,
    shopping: state.shopping,
    shoppingPromos: state.shoppingPromos || [],
    recipes: state.recipes,
    meals: state.meals,
    pinboard: state.pinboard,
    familyQuestions: state.familyQuestions || [],
    recipeLinkFeedback: state.recipeLinkFeedback,
    workroom: state.workroom,
    school: state.school,
    familySettings: state.familySettings,
    familyColors: state.familyColors || {},
    settings: state.settings || {}
  }));
}


function mergeRecipeLinkFeedback(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" ? localValue : {};
  const remote = cloudValue && typeof cloudValue === "object" ? cloudValue : {};
  const merged = {};

  new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(url => {
    const a = local[url];
    const b = remote[url];

    if (!a) {
      merged[url] = b;
      return;
    }
    if (!b) {
      merged[url] = a;
      return;
    }

    const aTs = Number(a.updatedAt || a.lastUsed || 0);
    const bTs = Number(b.updatedAt || b.lastUsed || 0);

    if (bTs > aTs) merged[url] = {...a, ...b};
    else if (aTs > bTs) merged[url] = {...b, ...a};
    else merged[url] = {...b, ...a};
  });

  return merged;
}

/* =========================================================
   SYNC-FIX – Rabatte & Pickerl
   Jeder Rabatt bleibt über seine ID eindeutig.
   Bei derselben ID gewinnt die neuere Version (updatedAt/createdAt).
   Gelöschte Rabatte bleiben als deleted:true erhalten und können deshalb
   auf einem zweiten Gerät nicht wieder auferstehen.
   ========================================================= */
function mergeShoppingPromosByRevision(localValue, cloudValue) {
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(cloudValue) ? cloudValue : [];
  const byId = new Map();
  const withoutId = [];

  function promoTimestamp(item) {
    if (!item || typeof item !== "object") return 0;
    return Number(
      item.updatedAt ||
      item.expiredAt ||
      item.createdAt ||
      0
    ) || 0;
  }

  function take(item) {
    if (!item || typeof item !== "object") return;

    if (!item.id) {
      withoutId.push(item);
      return;
    }

    const previous = byId.get(item.id);
    if (!previous || promoTimestamp(item) >= promoTimestamp(previous)) {
      byId.set(item.id, item);
    }
  }

  local.forEach(take);
  remote.forEach(take);

  return [...byId.values(), ...withoutId];
}

function mergeFamilySettingsSection(localValue, cloudValue) {
  if (localValue == null) return cloudValue;
  if (cloudValue == null) return localValue;

  if (Array.isArray(localValue) || Array.isArray(cloudValue)) {
    const a = Array.isArray(localValue) ? localValue : [];
    const b = Array.isArray(cloudValue) ? cloudValue : [];
    if ([...a,...b].some(item => item && typeof item === "object" && item.id)) {
      return guardedMergeById(a,b,"Familieneinstellungen");
    }
    return a.length ? a : b;
  }

  if (typeof localValue === "object" && typeof cloudValue === "object") {
    const localTs = Number(localValue.updatedAt || 0);
    const cloudTs = Number(cloudValue.updatedAt || 0);
    if (localTs || cloudTs) return cloudTs > localTs ? cloudValue : localValue;

    const out = {...localValue};
    Object.keys(cloudValue).forEach(key => {
      if (!(key in out)) out[key] = cloudValue[key];
      else if (
        out[key] && cloudValue[key] &&
        typeof out[key] === "object" &&
        typeof cloudValue[key] === "object"
      ) out[key] = mergeFamilySettingsSection(out[key], cloudValue[key]);
    });
    return out;
  }

  return localValue;
}

function applyCloudData(data) {
  cloudApplying = true;
  try {
    makeLocalSafetySnapshot("vor-cloud-apply", true);

    state.todoTombstones = mergeTodoTombstones(
      state.todoTombstones,
      data.todoTombstones
    );

    state.videoTombstones = mergeSimpleTombstones(state.videoTombstones, data.videoTombstones);
    state.archiveTombstones = mergeSimpleTombstones(state.archiveTombstones, data.archiveTombstones);
    state.recipeTombstones = mergeSimpleTombstones(state.recipeTombstones, data.recipeTombstones);
    state.pinboardTombstones = mergeSimpleTombstones(state.pinboardTombstones, data.pinboardTombstones);
    state.trashTombstones = mergeSimpleTombstones(state.trashTombstones, data.trashTombstones);

    state.videos = mergePersistentListWithTombstones(
      state.videos, data.videos, state.videoTombstones
    );

    state.todos = mergeTodosByRevision(state.todos, data.todos)
      .filter(item => !isTodoTombstoned(item?.id));

    state.trash = mergePersistentListWithTombstones(
      state.trash, data.trash, state.trashTombstones, "trashId"
    );
    state.archive = mergePersistentListWithTombstones(
      state.archive, data.archive, state.archiveTombstones
    );
    /* Einkauf selbst wird ausschließlich über /shoppingItems synchronisiert.
       NICHT mehr aus dem großen Familien-Dokument zurückholen. */
    shoppingItems = state.shopping;

    /* Rabatte wurden bisher zwar in die Cloud GESCHRIEBEN,
       beim Cloud-Einlesen aber vollständig vergessen. */
    state.shoppingPromos = mergeShoppingPromosByRevision(
      state.shoppingPromos,
      data.shoppingPromos
    );

    state.recipes = mergePersistentListWithTombstones(
      state.recipes, data.recipes, state.recipeTombstones
    );

    if (data.meals && typeof data.meals === "object") {
      state.meals = mergeMeals(state.meals, data.meals);
    }

    if (Array.isArray(data.pinboard)) {
      const mergedPinboard = mergePersistentListWithTombstones(
        state.pinboard, data.pinboard, state.pinboardTombstones
      );
      handleIncomingPinboard(mergedPinboard);
      state.pinboard = mergedPinboard;
    }

    if (Array.isArray(data.familyQuestions)) {
      state.familyQuestions = guardedMergeById(
        state.familyQuestions,
        data.familyQuestions,
        "Familienfragen"
      );
      persistFamilyQuestionsNow();
    }

    if (data.recipeLinkFeedback && typeof data.recipeLinkFeedback === "object") {
      state.recipeLinkFeedback = mergeRecipeLinkFeedback(
        state.recipeLinkFeedback,
        data.recipeLinkFeedback
      );
    }

    state.workroom = guardedWorkroomMerge(state.workroom, data.workroom);
    /* Schule: vorhandene tombstone-fähige Merge-Logik verwenden.
       Dadurch können unter "Für euch" gelöschte Lou/Fina-Aufgaben
       nicht beim nächsten Cloud-Reload wieder auftauchen. */
    state.school = mergeSchool(state.school, data.school);

    const localFamilySettings = state.familySettings || {};
    const cloudFamilySettings = data.familySettings || {};

    /* Farben separat und revisionssicher zusammenführen.
       Dadurch können ältere familySettings aus der Cloud die neue
       Farbauswahl nicht mehr überschreiben. */
    state.familyColors = mergeFamilyColors(
      state.familyColors,
      data.familyColors
    );
    const quickLinkTombstones = mergeSimpleTombstones(
      localFamilySettings.quickLinkTombstones,
      cloudFamilySettings.quickLinkTombstones
    );
    const quickLinks = mergePersistentListWithTombstones(
      localFamilySettings.quickLinks,
      cloudFamilySettings.quickLinks,
      quickLinkTombstones
    );

    const mergedFamilySettingsBase = {
      ...cloudFamilySettings,
      ...localFamilySettings,
      timetableSubjects: mergeFamilySettingsSection(
        localFamilySettings.timetableSubjects,
        cloudFamilySettings.timetableSubjects
      ),
      personalDailyFocus: mergeFamilySettingsSection(
        localFamilySettings.personalDailyFocus,
        cloudFamilySettings.personalDailyFocus
      ),
      childDailyFocusSelections: mergeFamilySettingsSection(
        localFamilySettings.childDailyFocusSelections,
        cloudFamilySettings.childDailyFocusSelections
      ),
      myWeekAppearance: mergeFamilySettingsSection(
        localFamilySettings.myWeekAppearance,
        cloudFamilySettings.myWeekAppearance
      )
    };

    state.familySettings = {
      ...mergedFamilySettingsBase,

      /* Namen/Farben je Person nach Änderungszeit zusammenführen.
         So kann ein älterer Cloud-Stand eine neue lokale Farbauswahl
         nach Neuladen nicht mehr zurücksetzen. */
      a: mergeFamilyMemberSetting(
        localFamilySettings.a,
        cloudFamilySettings.a,
        defaultFamilySettings.a
      ),
      b: mergeFamilyMemberSetting(
        localFamilySettings.b,
        cloudFamilySettings.b,
        defaultFamilySettings.b
      ),
      c: mergeFamilyMemberSetting(
        localFamilySettings.c,
        cloudFamilySettings.c,
        defaultFamilySettings.c
      ),
      d: mergeFamilyMemberSetting(
        localFamilySettings.d,
        cloudFamilySettings.d,
        defaultFamilySettings.d
      ),

      childRoutinePlans: {
        "1": mergeChildRoutineStore(
          localFamilySettings.childRoutinePlans?.["1"],
          cloudFamilySettings.childRoutinePlans?.["1"]
        ),
        "2": mergeChildRoutineStore(
          localFamilySettings.childRoutinePlans?.["2"],
          cloudFamilySettings.childRoutinePlans?.["2"]
        )
      },

      childMoney: {
        "1": mergeChildMoneyStore(
          localFamilySettings.childMoney?.["1"],
          cloudFamilySettings.childMoney?.["1"]
        ),
        "2": mergeChildMoneyStore(
          localFamilySettings.childMoney?.["2"],
          cloudFamilySettings.childMoney?.["2"]
        )
      },

      quickLinks,
      quickLinkTombstones
    };

    syncLegacyFamilyColorsFromDedicatedStore();
    persistFamilyColorsImmediately();

    state.settings = {
      ...(data.settings || {}),
      ...(state.settings || {})
    };

    refreshTodoSyncFingerprints();
    saveLocal();
    renderAll();

    /* V144 – Kinder-Routinen: bereits geöffnetes Dialogfenster live aktualisieren.
       renderAll() aktualisiert die Hauptansicht, aber nicht den dynamisch erzeugten
       childRoutineDialog. Dadurch waren Cloud-Häkchen erst nach der nächsten lokalen
       Aktion sichtbar. Nur bei offenem Dialog neu rendern. */
    const openChildRoutineDialog=document.querySelector("#childRoutineDialog");
    if(openChildRoutineDialog?.open && ["1","2"].includes(String(activeChildRoutineId))){
      renderChildRoutineDialog();
    }

    /* V145 – Mein Geld: bereits geöffnetes Lou/Fina-Geldfenster live aktualisieren.
       Gilt gemeinsam für Taschengeld/Jausengeld, Zahlstatus, Monatsübersicht,
       Geliehenes, Sparziel/Sparstand und Edelsteine.
       Nur Darstellung; Geld-/Edelstein-Daten und Merge-Logik bleiben unverändert. */
    const openChildMoneyDialog=document.querySelector("#childMoneyDialog");
    if(openChildMoneyDialog?.open && ["1","2"].includes(String(activeChildMoneyId))){
      renderChildMoneyDialog();
    }
  } finally {
    cloudApplying = false;
  }
}

const substitutionDialogRestored = document.querySelector("#substitutionDialog");
document.querySelector("#openSubstitutionBtn")?.addEventListener("click", () => {
  const dateInput = document.querySelector("#substitutionDate");
  if (dateInput && !dateInput.value) dateInput.value = dateKey(new Date());
  substitutionDialogRestored?.showModal();
  setTimeout(() => dateInput?.showPicker?.(), 80);
});
document.querySelector("#closeSubstitutionDialogBtn")?.addEventListener("click", () => {
  substitutionDialogRestored?.close();
});
document.querySelector("#saveSubstitutionBtn")?.addEventListener("click", () => {
  const date = document.querySelector("#substitutionDate")?.value || "";
  const className = document.querySelector("#substitutionClass")?.value.trim() || "";
  const subject = document.querySelector("#substitutionSubject")?.value.trim() || "";
  const forWhom = document.querySelector("#substitutionForWhom")?.value.trim() || "";
  const note = document.querySelector("#substitutionNote")?.value.trim() || "";
  const hours = Number(document.querySelector("#substitutionHours")?.value || 1) || 1;
  if (!date) return;

  state.workroom.substitutions = Array.isArray(state.workroom.substitutions) ? state.workroom.substitutions : [];
  state.workroom.substitutions.push({id:uid(), date, className, subject, forWhom, note, hours, createdAt:Date.now(), updatedAt:Date.now()});
  save();
  renderSubstitutions();
  substitutionDialogRestored?.close();
});

function openMamaTimetableEditorDirectRestored() {
  const title = document.querySelector("#familyTimetableDialogTitle");
  if (title) title.textContent = "Mama – Stundenplan bearbeiten";
  const chooserButtons = document.querySelector("#familyTimetableDialog .family-timetable-buttons");
  if (chooserButtons) chooserButtons.classList.add("hidden");
  familyTimetableDialog?.showModal();
  renderTTMatrix("mama");
  document.querySelector("#manualTimetableWrapmama")?.classList.remove("hidden");
}
document.querySelector("#openWorkTimetableBtn")?.addEventListener("click", openMamaTimetableEditorDirectRestored);

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
  renderWorkroomShopping();
  renderWorkroomLinks();
  renderRoutines();
  renderRecipes();
  renderMealPlan();
  renderPinboard();
  renderSubstitutions();
  renderShopping();
  renderFamilyQuestions();

  // Punkt 2f:
  // Dies ist die tatsächlich wirksame (spätere) renderAll()-Definition.
  // Schnellzugriff hier rendern, damit die gespeicherten/Standard-Buttons
  // beim Laden und nach jedem Gesamtrender zuverlässig erscheinen.
  renderQuickLinks();
}


// PLING – Termin-Erinnerung + Gerätestatus + Systemhinweis
// Kostenlos: kein Blaze, kein Firebase Storage, kein Bezahl-Dienst.
// WICHTIG: Exakte Erinnerungen bei vollständig geschlossener Web-App
// benötigen echten Web-Push von einem Server. Diese Version erinnert
// zuverlässig, solange die Seite läuft, und holt beim Zurückkehren
// versäumte Erinnerungen vor Terminbeginn nach.
// =========================================================
(function setupPlingReminder(){

  const DEVICE_KEY = "balanceProd.plingDeviceEnabled";
  const VOLUME_KEY = "balanceProd.plingVolume";
  const SOUND_KEY = "balanceProd.plingSound";
  const FIRED_KEY = "balanceProd.plingFired";

  let audioContext = null;
  let audioUnlocked = false;

  function notificationSupported(){
    return "Notification" in window;
  }

  function serviceWorkerSupported(){
    return "serviceWorker" in navigator;
  }

  async function ensureServiceWorker(){
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (Array.isArray(regs)) await Promise.all(regs.map(r => r.unregister()));
    } catch (err) {
      console.warn("Service-Worker-Bereinigung:", err);
    }
    return null;
  }

  function deviceNotificationsEnabled(){
    return localStorage.getItem(DEVICE_KEY) === "1";
  }

  function setDeviceNotificationsEnabled(value){
    localStorage.setItem(DEVICE_KEY, value ? "1" : "0");
  }

  function permissionState(){
    if (!notificationSupported()) return "unsupported";
    return Notification.permission;
  }

  function updateDeviceStatus(){
    const status = document.querySelector("#plingDeviceStatus");
    const enableBtn = document.querySelector("#enablePlingNotifications");
    if (!status || !enableBtn) return;

    const permission = permissionState();
    const enabled = deviceNotificationsEnabled();

    if (permission === "unsupported") {
      status.textContent = "🔕 System-Benachrichtigungen sind in diesem Browser nicht verfügbar.";
      status.dataset.state = "unsupported";
      enableBtn.textContent = "Nicht verfügbar";
      enableBtn.disabled = true;
      return;
    }

    enableBtn.disabled = false;

    if (permission === "granted" && enabled) {
      if (audioUnlocked) {
        status.textContent = "🔔 Benachrichtigung & Ton auf diesem Gerät bereit.";
        status.dataset.state = "granted";
        enableBtn.textContent = "Benachrichtigungen aktiv";
      } else {
        // Mobile Browser dürfen Audio nach Reload/Standby trotz gespeicherter
        // Benachrichtigungsfreigabe bis zur nächsten Nutzeraktion blockieren.
        status.textContent = "🔔 Benachrichtigungen erlaubt · Ton einmal aktivieren.";
        status.dataset.state = "default";
        enableBtn.textContent = "Ton aktivieren";
      }
      return;
    }

    if (permission === "denied") {
      status.textContent = "🔕 Benachrichtigungen sind auf diesem Gerät blockiert.";
      status.dataset.state = "denied";
      enableBtn.textContent = "In Browser-Einstellungen erlauben";
      return;
    }

    if (permission === "granted" && !enabled) {
      status.textContent = "🔔 Browser erlaubt Benachrichtigungen – für dieses Gerät noch nicht aktiviert.";
      status.dataset.state = "default";
      enableBtn.textContent = "Auf diesem Gerät aktivieren";
      return;
    }

    status.textContent = "🔔 Benachrichtigungen auf diesem Gerät noch nicht eingerichtet.";
    status.dataset.state = "default";
    enableBtn.textContent = "Benachrichtigungen aktivieren";
  }

  async function enableNotificationsOnThisDevice(){
    if (!notificationSupported()) {
      updateDeviceStatus();
      return false;
    }

    try {
      let permission = Notification.permission;

      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }

      if (permission === "granted") {
        setDeviceNotificationsEnabled(true);
        await ensureServiceWorker();
        updateDeviceStatus();
        return true;
      }

      setDeviceNotificationsEnabled(false);
      updateDeviceStatus();
      return false;
    } catch (err) {
      console.warn("Benachrichtigungsfreigabe fehlgeschlagen:", err);
      setDeviceNotificationsEnabled(false);
      updateDeviceStatus();
      return false;
    }
  }

  function currentPlingVolume(){
    const saved = localStorage.getItem(VOLUME_KEY) || "loud";
    return ["soft","medium","loud","extra","super"].includes(saved) ? saved : "loud";
  }

  function currentPlingSound(){
    const saved = localStorage.getItem(SOUND_KEY) || "pling";
    return ["pling","peng","elf","bowl","boing"].includes(saved) ? saved : "pling";
  }

  function plingMasterGain(){
    return {
      soft: 0.18,
      medium: 0.34,
      loud: 0.58,
      extra: 0.82,
      super: 1.0
    }[currentPlingVolume()] || 0.58;
  }

  const volumeSelect = document.querySelector("#plingVolume");
  if (volumeSelect) {
    volumeSelect.value = currentPlingVolume();
    volumeSelect.addEventListener("change", () => {
      localStorage.setItem(VOLUME_KEY, volumeSelect.value);
      showMotivation(`🔔 Lautstärke auf diesem Gerät: ${volumeSelect.options[volumeSelect.selectedIndex].text}`);
    });
  }

  const soundSelect = document.querySelector("#plingSound");
  if (soundSelect) {
    soundSelect.value = currentPlingSound();
    soundSelect.addEventListener("change", () => {
      localStorage.setItem(SOUND_KEY, soundSelect.value);
      showMotivation(`♪ Erinnerungston: ${soundSelect.options[soundSelect.selectedIndex].text}`);
    });
  }

  async function unlockAudio(){
    try {
      audioContext =
        audioContext ||
        new (window.AudioContext || window.webkitAudioContext)();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      audioUnlocked = audioContext.state === "running";
      return audioUnlocked;
    } catch (_) {
      audioUnlocked = false;
      return false;
    }
  }

  async function playPling(){
    try {
      const ready = await unlockAudio();
      if (!audioContext || !ready) return false;

      const now = audioContext.currentTime;
      const master = audioContext.createGain();
      const level = plingMasterGain();
      const sound = currentPlingSound();

      master.connect(audioContext.destination);

      function tone(freq, start, stop, options = {}) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = options.type || "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        if (options.endFreq) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.endFreq),
            now + stop
          );
        }

        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(
          options.gain ?? 0.85,
          now + start + (options.attack ?? 0.012)
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + stop);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now + start);
        osc.stop(now + stop + 0.04);
      }

      function noiseBurst(start, duration, gainLevel = 0.7) {
        const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
        const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
          const fade = 1 - i / length;
          data[i] = (Math.random() * 2 - 1) * fade;
        }

        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1250, now + start);
        filter.Q.setValueAtTime(0.7, now + start);

        gain.gain.setValueAtTime(gainLevel, now + start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start(now + start);
      }

      const totalDuration =
        sound === "bowl" ? 2.8 :
        sound === "elf" ? 1.65 :
        sound === "peng" ? 0.65 :
        sound === "boing" ? 0.95 : 0.72;

      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(level, now + 0.012);
      master.gain.setValueAtTime(level, now + Math.min(0.35, totalDuration * 0.35));
      master.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

      if (sound === "pling") {
        tone(880, 0.00, 0.28, {gain:0.82});
        tone(1175,0.18, 0.62, {gain:0.78});

      } else if (sound === "peng") {
        // Heller, trockener PENG-Impuls mit scharfem Attack.
        noiseBurst(0.00, 0.070, 0.88);
        tone(1650, 0.000, 0.070, {type:"square", gain:0.50, endFreq:720});
        tone(980,  0.006, 0.115, {type:"triangle", gain:0.72, endFreq:520});
        tone(360,  0.018, 0.190, {type:"triangle", gain:0.42, endFreq:220});

      } else if (sound === "elf") {
        tone(1319,0.00,0.42,{gain:0.48});
        tone(1760,0.15,0.60,{gain:0.42});
        tone(2093,0.31,0.78,{gain:0.38});
        tone(2637,0.50,1.00,{gain:0.30});
        tone(2093,0.76,1.24,{gain:0.26});
        tone(3136,0.94,1.48,{gain:0.20});

      } else if (sound === "bowl") {
        // Wärmere, schwebendere Klangschale mit langen Obertönen.
        tone(174.6, 0.00, 2.75, {gain:0.74, attack:0.035});
        tone(349.2, 0.01, 2.55, {gain:0.30, attack:0.028});
        tone(523.3, 0.04, 2.20, {gain:0.20, attack:0.025});
        tone(698.5, 0.10, 1.90, {gain:0.14, attack:0.02});
        tone(1046.5,0.22, 1.55, {gain:0.08, attack:0.018});

      } else if (sound === "boing") {
        tone(520,0.00,0.52,{gain:0.82,endFreq:170});
        tone(260,0.16,0.78,{gain:0.58,endFreq:105});
      }

      return true;
    } catch (err) {
      console.warn("Erinnerungston konnte nicht abgespielt werden:", err);
      return false;
    }
  }

  async function showSystemNotification(title, body, tag){
    if (
      !notificationSupported() ||
      Notification.permission !== "granted" ||
      !deviceNotificationsEnabled()
    ) {
      return false;
    }

    try {
      const registration = await ensureServiceWorker();

      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          tag,
          renotify: true,
          silent: false,
          data: { url: location.href }
        });
        return true;
      }

      new Notification(title, { body, tag });
      return true;
    } catch (err) {
      console.warn("System-Benachrichtigung fehlgeschlagen:", err);
      return false;
    }
  }

  function readFired(){
    try {
      const parsed = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function hasFired(key){
    return !!readFired()[key];
  }

  function markFired(key){
    const fired = readFired();
    fired[key] = Date.now();

    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    Object.keys(fired).forEach(k => {
      if (Number(fired[k]) < cutoff) delete fired[k];
    });

    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  }

  function eventStartForOccurrence(item, now){
    if (
      !item ||
      item.type !== "event" ||
      !item.plingEnabled ||
      !item.time
    ) {
      return null;
    }

    const today = new Date(now);
    today.setHours(12,0,0,0);

    if (!occursOnDate(item, today)) return null;

    // Ein einmaliger mehrtägiger Termin soll nur am tatsächlichen Starttag plingen.
    if (
      (item.recurrence || "none") === "none" &&
      item.date &&
      item.date !== dateKey(today)
    ) {
      return null;
    }

    const [h,m] = String(item.time).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

    const start = new Date(now);
    start.setHours(h,m,0,0);
    return start;
  }

  async function fireReminder(item, minutes, start, key){
    markFired(key);

    // In-App-Ton als Ergänzung.
    await playPling();

    const whenText =
      minutes === 60 ? "in 1 Stunde" :
      minutes === 90 ? "in 1½ Stunden" :
      minutes === 120 ? "in 2 Stunden" :
      `in ${minutes} Minuten`;
    const body = `${item.text} · ${whenText}`;

    // Sichtbarer Hinweis innerhalb der App: Quelle sofort erkennbar.
    showMotivation(`⏰ Terminerinnerung: ${body}`);

    // System-Benachrichtigung für dieses freigegebene Gerät.
    await showSystemNotification(
      "⏰ Terminerinnerung",
      body,
      `pling-${key}`
    );
  }

  async function checkPlings(){
    const now = new Date();

    for (const item of state.todos) {
      const start = eventStartForOccurrence(item, now);
      if (!start) continue;

      const configuredMinutes = Number(item.plingMinutes);
      const minutes = [5,10,15,20,30,45,60,90,120].includes(configuredMinutes)
        ? configuredMinutes
        : 15;

      const remindAt = new Date(start.getTime() - minutes * 60000);
      const key = `${item.id}::${dateKey(now)}::${minutes}`;

      // Ab Erinnerungszeit bis zum Termin selbst auslösen.
      // Dadurch geht eine Erinnerung nicht verloren, wenn ein Hintergrund-Tab
      // vom Browser kurz pausiert wurde.
      if (
        now >= remindAt &&
        now < start &&
        !hasFired(key)
      ) {
        await fireReminder(item, minutes, start, key);
      }
    }
  }

  async function runTestPling(){
    // Test-Klick ist eine echte Nutzeraktion: Audio hier direkt freischalten.
    const sounded = await playPling();

    // Falls Benachrichtigungen noch nicht freigegeben sind, darf der Test-Klick
    // selbst die Browser-Abfrage auslösen.
    if (
      notificationSupported() &&
      Notification.permission !== "granted"
    ) {
      await enableNotificationsOnThisDevice();
    }

    let systemShown = false;

    if (
      notificationSupported() &&
      Notification.permission === "granted" &&
      deviceNotificationsEnabled()
    ) {
      systemShown = await showSystemNotification(
        "Test-Pling",
        "🔔 Benachrichtigungen funktionieren auf diesem Gerät.",
        `pling-test-${Date.now()}`
      );
    }

    updateDeviceStatus();

    if (sounded && systemShown) {
      showMotivation("🔔 Test erfolgreich – Pling und System-Benachrichtigung funktionieren.");
      return;
    }

    if (sounded && !systemShown) {
      showMotivation("🔔 Pling hörbar. Die System-Benachrichtigung ist auf diesem Gerät noch nicht freigegeben.");
      return;
    }

    if (!sounded && systemShown) {
      showMotivation("🔔 System-Benachrichtigung funktioniert. Der Browser blockiert derzeit den Ton.");
      return;
    }

    const permission = permissionState();
    if (permission === "denied") {
      showMotivation("🔕 Benachrichtigungen sind im Browser für diese Seite blockiert.");
    } else {
      showMotivation("🔕 Test fehlgeschlagen – bitte Medienlautstärke und Browser-Berechtigung dieses Geräts prüfen.");
    }
  }

  document.querySelector("#enablePlingNotifications")?.addEventListener("click", async () => {
    await unlockAudio();
    await enableNotificationsOnThisDevice();
    updateDeviceStatus();
    checkPlings();
  });

  document.querySelector("#testPlingBtn")?.addEventListener("click", async () => {
    await runTestPling();
  });

  ["pointerdown","keydown","touchstart"].forEach(evt => {
    document.addEventListener(evt, unlockAudio, {
      once:true,
      passive:true
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateDeviceStatus();
      checkPlings();
    }
  });

  window.addEventListener("focus", () => {
    updateDeviceStatus();
    checkPlings();
  });

  window.addEventListener("online", updateDeviceStatus);

  ensureServiceWorker();
  updateDeviceStatus();

  setInterval(checkPlings, 20000);
  setTimeout(checkPlings, 1000);

})();




// ===== NOTFALL-HILFE: lokale Sicherheitsbackups prüfen/wiederherstellen =====
window.balanceDataSafety = {
  listBackups() {
    return [1,2,3].map(n => {
      const raw = localStorage.getItem(`balanceProd.safetyBackup.${n}`);
      if (!raw) return null;
      try {
        const data = JSON.parse(raw);
        return {
          slot:n,
          savedAt:data.savedAt ? new Date(data.savedAt).toLocaleString("de-AT") : "unbekannt",
          workroomTodos:data.workroom?.todos?.length || 0,
          workroomPrints:data.workroom?.prints?.length || 0,
          workroomLinks:data.workroom?.links?.length || 0,
          school1:data.school?.children?.["1"]?.tasks?.length || 0,
          school2:data.school?.children?.["2"]?.tasks?.length || 0
        };
      } catch {
        return {slot:n, error:true};
      }
    }).filter(Boolean);
  },
  restoreBackup(slot=1) {
    const raw = localStorage.getItem(`balanceProd.safetyBackup.${slot}`);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.workroom) state.workroom = normalizeWorkroom(data.workroom);
    if (data.school?.children) state.school = data.school;
    if (Array.isArray(data.recipes)) state.recipes = data.recipes;
    if (data.meals && typeof data.meals === "object") state.meals = data.meals;
    saveLocal();
    renderAll();
    return true;
  }
};


// =============================
// WERKRAUM – BEREICHE AUF/ZU
// Handler VOR dem ersten renderAll registrieren.
// So funktionieren die drei Bereiche auch dann, wenn ein späterer Render einmal scheitert.
// =============================
document.addEventListener("click", e => {
  const head = e.target.closest(".workroom-fold-head");
  if (!head) return;

  // Bedienelemente im Kopf behalten ihre eigene Funktion.
  if (e.target.closest("button,a,input,select,textarea")) return;

  const card = head.closest(".workroom-fold-card");
  if (!card) return;

  const wasOpen = card.classList.contains("open");

  // Immer nur EIN Werkraum-Bereich offen.
  // Klick auf Drucken schließt z.B. die komplette Linksammlung.
  document.querySelectorAll(".workroom-fold-card.open").forEach(otherCard => {
    otherCard.classList.remove("open");
  });

  if (!wasOpen) card.classList.add("open");
});

restoreTimeTrackingFromLocal();
renderAll();


function ensureMobileWeekActionCircleStyles() {
  if (document.querySelector("#mobileWeekActionCircleFix")) return;

  const style = document.createElement("style");
  style.id = "mobileWeekActionCircleFix";
  style.textContent = `
    @media (max-width:600px){
      .week-head-actions{
        display:flex !important;
        flex-wrap:nowrap !important;
        justify-content:flex-end !important;
        align-items:center !important;
        gap:7px !important;
      }

      #openPinboardBtn,
      #openPapaOverviewBtn,
      #addVideoBtn,
      #openFamilyTimetableBtn,
      #printWeekBtn{
        box-sizing:border-box !important;
        flex:0 0 42px !important;
        width:42px !important;
        min-width:42px !important;
        max-width:42px !important;
        height:42px !important;
        min-height:42px !important;
        max-height:42px !important;
        padding:0 !important;
        margin:0 !important;
        border-radius:50% !important;
        display:grid !important;
        place-items:center !important;
        align-items:center !important;
        justify-content:center !important;
        line-height:1 !important;
        overflow:visible !important;
        white-space:nowrap !important;
      }

      #openPinboardBtn .pinboard-label{
        display:none !important;
      }

      #openPinboardBtn{
        font-size:0 !important;
      }
      #openPinboardBtn .pinboard-icon{
        display:block !important;
        width:auto !important;
        height:auto !important;
        margin:0 !important;
        padding:0 !important;
        font-size:1rem !important;
        line-height:1 !important;
        transform:none !important;
      }

      #openPapaOverviewBtn{
        font-size:0 !important;
      }
      #openPapaOverviewBtn::before{
        content:"♡";
        display:block;
        font-size:1rem !important;
        line-height:1 !important;
      }

      #addVideoBtn{
        font-size:0 !important;
      }
      #addVideoBtn::before{
        content:"+";
        display:block;
        font-size:1.15rem !important;
        line-height:1 !important;
      }

      #openFamilyTimetableBtn,
      #printWeekBtn{
        font-size:.9rem !important;
        line-height:1 !important;
      }

      #openPinboardBtn .pinboard-badge{
        position:absolute !important;
        top:-3px !important;
        right:-3px !important;
        margin:0 !important;
      }
    }

    .recipe-link-times{
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
    }

    .recipe-link-reuse{
      border:1px solid rgba(143,165,157,.26);
      border-radius:999px;
      background:#edf4f1;
      color:#506963;
      padding:6px 9px;
      cursor:pointer;
      font-size:.66rem;
    }

    .recipe-link-reuse:hover{
      background:#dfece8;
    }
  `;
  document.head.appendChild(style);
}

ensureMobileWeekActionCircleStyles();



document.addEventListener("DOMContentLoaded", () => {
  ensureRecipeCardMarkPicker();
  ensureRecipeCardMarkStyles();
});




function ensureRecipeFormAndMobileActionStyles() {
  if (document.querySelector("#recipeFormAndMobileActionStyles")) return;

  const style = document.createElement("style");
  style.id = "recipeFormAndMobileActionStyles";
  style.textContent = `
    /* =========================================================
       REZEPTFORMULAR – klarere Gruppen
       ========================================================= */
    #recipeForm{
      display:grid !important;
      grid-template-columns:1.2fr .75fr .75fr;
      gap:10px 12px !important;
      align-items:start !important;
    }

    #recipeTitle{
      grid-column:1 !important;
    }

    #recipeCategory{
      grid-column:2 !important;
    }

    #recipeDifficulty{
      grid-column:3 !important;
    }

    /* Kinder + Gesund sauber in einer gemeinsamen Zeile */
    #recipeKids,
    #recipeHealthy{
      width:auto !important;
      margin:0 !important;
    }

    #recipeKidsLabel,
    #recipeHealthyLabel{
      display:inline-flex !important;
      align-items:center !important;
      gap:7px !important;
      min-height:38px;
      padding:8px 10px;
      border:1px solid rgba(216,205,198,.55);
      border-radius:12px;
      background:#fffdfb;
      white-space:nowrap;
    }

    .recipe-flags-row{
      grid-column:1 / -1;
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      align-items:center;
    }

    #recipeTime{
      grid-column:2 !important;
    }

    #recipeIngredients{
      grid-column:3 !important;
      min-height:108px !important;
    }

    #recipeSteps{
      grid-column:1 / 3 !important;
      min-height:108px !important;
    }

    #recipeWebUrl{
      grid-column:3 !important;
    }

    #recipeYoutubeUrl{
      grid-column:3 !important;
    }

    .recipe-card-mark-field{
      grid-column:1 / 3 !important;
      min-width:0 !important;
      align-self:end;
    }

    #saveRecipeBtn{
      grid-column:3 !important;
      justify-self:end;
      align-self:end;
    }

    /* =========================================================
       MOBILE WOCHENPLAN-AKTIONEN – wirklich schön rund und mittig
       ========================================================= */
    @media(max-width:600px){
      .week-head-actions{
        width:100% !important;
        display:flex !important;
        justify-content:center !important;
        align-items:center !important;
        gap:10px !important;
        flex-wrap:nowrap !important;
        margin-top:10px !important;
      }

      #openPinboardBtn,
      #openPapaOverviewBtn,
      #addVideoBtn,
      #openFamilyTimetableBtn,
      #printWeekBtn{
        position:relative !important;
        flex:0 0 44px !important;
        width:44px !important;
        min-width:44px !important;
        max-width:44px !important;
        height:44px !important;
        min-height:44px !important;
        max-height:44px !important;
        aspect-ratio:1/1 !important;
        border-radius:999px !important;
        padding:0 !important;
        margin:0 !important;
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        line-height:1 !important;
        overflow:visible !important;
        box-sizing:border-box !important;
      }

      #openPinboardBtn{
        font-size:0 !important;
      }
      #openPinboardBtn .pinboard-label{
        display:none !important;
      }
      #openPinboardBtn .pinboard-icon{
        font-size:1rem !important;
        line-height:1 !important;
        width:auto !important;
        height:auto !important;
        margin:0 !important;
        padding:0 !important;
        transform:none !important;
      }

      #openPapaOverviewBtn{
        font-size:0 !important;
      }
      #openPapaOverviewBtn::before{
        content:"♡";
        font-size:1.05rem !important;
        line-height:1 !important;
        display:block;
      }

      #addVideoBtn{
        font-size:0 !important;
      }
      #addVideoBtn::before{
        content:"+";
        font-size:1.2rem !important;
        line-height:1 !important;
        display:block;
      }

      #openFamilyTimetableBtn,
      #printWeekBtn{
        font-size:.95rem !important;
        line-height:1 !important;
      }

      #openPinboardBtn .pinboard-badge{
        position:absolute !important;
        top:-4px !important;
        right:-4px !important;
      }
    }

    @media(max-width:850px){
      #recipeForm{
        grid-template-columns:1fr 1fr !important;
      }

      #recipeTitle,
      #recipeSteps,
      .recipe-card-mark-field{
        grid-column:1 / -1 !important;
      }

      #recipeCategory{
        grid-column:1 !important;
      }

      #recipeDifficulty{
        grid-column:2 !important;
      }

      #recipeTime{
        grid-column:1 !important;
      }

      #recipeIngredients{
        grid-column:2 !important;
      }

      #recipeWebUrl,
      #recipeYoutubeUrl{
        grid-column:auto !important;
      }

      #saveRecipeBtn{
        grid-column:1 / -1 !important;
        justify-self:end;
      }
    }

    @media(max-width:560px){
      #recipeForm{
        grid-template-columns:1fr !important;
      }

      #recipeTitle,
      #recipeCategory,
      #recipeDifficulty,
      #recipeTime,
      #recipeIngredients,
      #recipeSteps,
      #recipeWebUrl,
      #recipeYoutubeUrl,
      .recipe-card-mark-field,
      #saveRecipeBtn{
        grid-column:1 !important;
      }

      .recipe-flags-row{
        grid-column:1 !important;
      }

      #saveRecipeBtn{
        width:100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function normalizeRecipeFlagLayout() {
  const kids = document.querySelector("#recipeKids");
  const healthy = document.querySelector("#recipeHealthy");
  if (!kids || !healthy) return;

  const kidsLabel = kids.closest("label");
  const healthyLabel = healthy.closest("label");
  if (!kidsLabel || !healthyLabel) return;

  kidsLabel.id = "recipeKidsLabel";
  healthyLabel.id = "recipeHealthyLabel";

  if (kidsLabel.parentElement?.classList.contains("recipe-flags-row")) return;

  const row = document.createElement("div");
  row.className = "recipe-flags-row";
  kidsLabel.parentElement.insertBefore(row, kidsLabel);
  row.appendChild(kidsLabel);
  row.appendChild(healthyLabel);
}

ensureRecipeFormAndMobileActionStyles();
normalizeRecipeFlagLayout();

document.addEventListener("DOMContentLoaded", () => {
  ensureRecipeFormAndMobileActionStyles();
  normalizeRecipeFlagLayout();
  updateRecipeSourceForm();
});


// Werkraum-Faltkarten: Inhalte nach dem Öffnen aktualisieren,
// ohne den Auf-/Zu-Zustand nochmals anzufassen.
document.addEventListener("click", (e) => {
  const head = e.target.closest(".workroom-fold-head");
  if (!head) return;
  setTimeout(() => {
    const card = head.closest(".workroom-fold-card");
    if (!card?.classList.contains("open")) return;
    renderSchoolWorkTodos();
    renderSchoolPrints();
    renderWorkroomLinks();
    renderRoutines();
  }, 0);
});
/* V36: Becherküche => Selbst-kochen automatisch */
document.addEventListener("change", (event) => {
  if (event.target?.id === "recipeBeakerKitchen" && event.target.checked) {
    const selfCook = document.querySelector("#recipeSelfCook");
    if (selfCook && !selfCook.checked) {
      selfCook.checked = true;
      selfCook.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
});

/* =========================================================
   V36 – manuelle Becherküche-Zuordnung
   Erwachsenen-Zutat bleibt unverändert; Kindermaß wird separat
   am Rezept unter beakerMappings gespeichert.
   ========================================================= */
function recipeMeasureEditorTemplate(value = {}) {
  const amount=String(value.amount || "");
  const unit=String(value.unit || "cup");
  const color=String(value.color || "blue");
  const esc=(s)=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  const unitOptions=[
    ["cup","Becher"],
    ["quark","Topfenbecher"],
    ["yogurt","Joghurtbecher"],
    ["tbsp","EL"],
    ["tsp","TL"],
    ["pinch","Prise"]
  ];
  const colorOptions=[
    ["blue","Blau"],["red","Rot"],["green","Grün"],
    ["yellow","Gelb"],["orange","Orange"],["purple","Lila"]
  ];

  return `
    <span class="beaker-measure-editor">
      <label class="beaker-editor-field beaker-editor-amount">
        <span>Menge</span>
        <input class="beaker-map-amount" type="text" inputmode="decimal" placeholder="1" value="${esc(amount)}">
      </label>
      <label class="beaker-editor-field beaker-editor-unit">
        <span>Maß</span>
        <select class="beaker-map-unit">
          ${unitOptions.map(([v,l])=>`<option value="${v}" ${unit===v?"selected":""}>${l}</option>`).join("")}
        </select>
      </label>
      <label class="beaker-editor-field beaker-editor-color ${unit==="cup"?"":"hidden"}">
        <span>Farbe</span>
        <select class="beaker-map-color">
          ${colorOptions.map(([v,l])=>`<option value="${v}" ${color===v?"selected":""}>${l}</option>`).join("")}
        </select>
      </label>
      <button class="beaker-measure-remove" type="button" title="Dieses Maß entfernen" aria-label="Dieses Maß entfernen">×</button>
    </span>`;
}

function recipeBeakerRowTemplate(value = {}) {
  const ingredient = String(value.ingredient || "");
  const measures = Array.isArray(value.measures)
    ? value.measures
    : [{amount:value.amount || "", unit:value.unit || "cup", color:value.color || "blue"}];
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  return `
    <div class="beaker-map-row">
      <div class="beaker-map-source">
        <strong class="beaker-map-ingredient-label">${esc(ingredient)}</strong>
        <input class="beaker-map-ingredient" type="hidden" value="${esc(ingredient)}">
      </div>
      <span class="beaker-map-arrow">→</span>
      <div class="beaker-measures">
        ${measures.map(recipeMeasureEditorTemplate).join('<span class="beaker-editor-plus">+</span>')}
        <button class="beaker-add-measure" type="button">+ weiteres Maß</button>
      </div>
      <button class="beaker-map-remove" type="button" title="Zuordnung entfernen">×</button>
    </div>`;
}

function addRecipeBeakerRow(value = {}) {
  const host = document.querySelector("#recipeBeakerRows");
  if (!host) return;
  host.insertAdjacentHTML("beforeend", recipeBeakerRowTemplate(value));
}

function readRecipeBeakerMappings() {
  return [...document.querySelectorAll(".beaker-map-row")].map(row => ({
    ingredient: row.querySelector(".beaker-map-ingredient")?.value.trim() || "",
    measures: [...row.querySelectorAll(".beaker-measure-editor")].map(m => ({
      amount: m.querySelector(".beaker-map-amount")?.value.trim() || "",
      unit: m.querySelector(".beaker-map-unit")?.value || "cup",
      color: m.querySelector(".beaker-map-color")?.value || "blue"
    })).filter(x => x.amount || x.unit)
  })).filter(x => x.ingredient || x.measures.length);
}

function setRecipeBeakerMappings(rows = []) {
  const host = document.querySelector("#recipeBeakerRows");
  if (!host) return;
  host.innerHTML = "";
  const normalized = (Array.isArray(rows) ? rows : []).map(row => Array.isArray(row?.measures) ? row : ({
    ingredient: row?.ingredient || "",
    measures: [{amount:row?.amount || "", unit:row?.unit || "cup", color:row?.color || "blue"}]
  }));
  normalized.forEach(addRecipeBeakerRow);
}

function syncRecipeBeakerMappingsFromIngredients({preserve=true}={}){
  const host=document.querySelector("#recipeBeakerRows");
  if(!host) return;

  const lines=recipeLines(document.querySelector("#recipeIngredients")?.value);
  const existing=preserve ? readRecipeBeakerMappings() : [];
  const existingByKey=new Map(
    existing.map(row=>[normalizeIngredientKey(row.ingredient),row])
  );

  const rows=[];
  const seen=new Set();

  lines.forEach(line=>{
    const display=automaticChildIngredientName(line) || ingredientDisplayName(line) || String(line||"").trim();
    const key=normalizeIngredientKey(display);
    if(!key || seen.has(key)) return;
    seen.add(key);

    const old=existingByKey.get(key);
    rows.push(old ? {...old,ingredient:display} : {
      ingredient:display,
      measures:[{amount:"",unit:"cup",color:"blue"}]
    });
  });

  setRecipeBeakerMappings(rows);

  if(!rows.length){
    host.innerHTML='<div class="beaker-empty-note">Trage zuerst oben die Zutaten ein – sie erscheinen hier automatisch.</div>';
  }
}


function updateBeakerMappingVisibility() {
  const checked=!!document.querySelector("#recipeBeakerKitchen")?.checked;
  document.querySelector("#recipeBeakerMapping")?.classList.toggle("hidden",!checked);
  if(checked) syncRecipeBeakerMappingsFromIngredients({preserve:true});
}
document.addEventListener("click", e => {
  if (e.target?.id === "syncRecipeBeakerRows") syncRecipeBeakerMappingsFromIngredients({preserve:true});
  if (e.target?.classList?.contains("beaker-map-remove")) e.target.closest(".beaker-map-row")?.remove();
  if (e.target?.classList?.contains("beaker-add-measure")) {
    const host = e.target.closest(".beaker-measures");
    const btn = e.target;
    const plus = document.createElement("span");
    plus.className = "beaker-editor-plus";
    plus.textContent = "+";
    btn.before(plus);
    btn.insertAdjacentHTML("beforebegin", recipeMeasureEditorTemplate());
  }
  if (e.target?.classList?.contains("beaker-measure-remove")) {
    const editor = e.target.closest(".beaker-measure-editor");
    const wrap = e.target.closest(".beaker-measures");
    editor?.previousElementSibling?.classList?.contains("beaker-editor-plus") && editor.previousElementSibling.remove();
    editor?.remove();
    if (wrap && !wrap.querySelector(".beaker-measure-editor")) {
      wrap.querySelector(".beaker-add-measure")?.insertAdjacentHTML("beforebegin", recipeMeasureEditorTemplate());
    }
  }
});
document.addEventListener("change", e => {
  if (e.target?.id === "recipeBeakerKitchen") {
    const selfCook=document.querySelector("#recipeSelfCook");
    if(e.target.checked && selfCook && !selfCook.checked){
      selfCook.checked=true;
    }
    updateBeakerMappingVisibility();
  }
  if (e.target?.classList?.contains("beaker-map-unit")) {
    const editor = e.target.closest(".beaker-measure-editor");
    editor?.querySelector(".beaker-editor-color")?.classList.toggle("hidden", e.target.value !== "cup");
  }
});
document.addEventListener("input", e=>{
  if(e.target?.id==="recipeIngredients" && document.querySelector("#recipeBeakerKitchen")?.checked){
    window.clearTimeout(window.__beakerIngredientSyncTimer);
    window.__beakerIngredientSyncTimer=window.setTimeout(
      ()=>syncRecipeBeakerMappingsFromIngredients({preserve:true}),
      180
    );
  }
});

/* V36: beim Öffnen/Bearbeiten vorhandene Mappingdaten nachladen, sofern das
   bestehende Editiersystem die aktuelle Rezept-ID am Formular hinterlegt. */
document.addEventListener("click", () => {
  setTimeout(updateBeakerMappingVisibility, 0);
});

// ===== Persönliche Kinderansicht Schule =====
const schoolChildQuotes = {
  "1": [
    "Du musst nicht alles auf einmal können.",
    "Kleine Schritte bringen dich richtig weit.",
    "Du kannst mehr, als du gerade denkst.",
    "Dein Tempo ist völlig okay.",
    "Heute ist ein guter Tag, um etwas zu schaffen.",
    "Nicht perfekt. Einfach anfangen.",
    "Du musst niemandem etwas beweisen – nur dir selbst treu bleiben.",
    "Was heute schwer ist, kann morgen schon leichter sein."
  ],
  "2": [
    "Du kannst das! 🌟",
    "Jeder kleine Schritt zählt.",
    "Probieren macht dich stärker.",
    "Heute wartet etwas Cooles auf dich.",
    "Fehler? Egal. Weiter geht’s!",
    "Du wächst mit jeder Aufgabe ein Stück.",
    "Mut heißt auch: einfach einmal anfangen.",
    "Du hast schon so viel geschafft – das hier schaffst du auch."
  ]
};

const schoolChildIcons = [
  "🌙","⭐","✨","💫","☀️","🌈","🌸","🌼","🌻","🍄","🌿","🍀","🌱","🐚",
  "🦋","🐞","🐝","🐾","🐈","🐕","🐇","🦊","🐼","🐨","🦄","🐴","🐎","🐬",
  "🐳","🦜","🦉","🐢","🐸","🐙","🐧","🦦","🦥","🦔","🐿️","💩"
];

/* Für "Mein Zeichen": zusätzlich ruhigere, edlere Symbole.
   Die normalen Aufgabenzeichen bleiben unverändert. */
const schoolPersonalIcons = [
  "🌙","⭐","✨","💫","☀️","🌈","🌸","🌼","🌻","🍄","🌿","🍀","🌱","🐚",
  "🦋","🐞","🐝","🐾","🐈","🐕","🐇","🦊","🐼","🐨","🦄","🐴","🐎","🐬",
  "🐳","🦜","🦉","🐢","🐸","🐙","🐧","🦦","🦥","🦔","🐿️",
  "☾","✧","✦","❈","❉","✾","❀","⚘","☼","❂","⊙","∞","🪷",
  "__flower_of_life__","__moon_stars__","__meditation__"
];

function schoolPersonalIconMarkup(icon){
  if(icon==="__flower_of_life__"){
    return `<span class="school-personal-svg-icon school-flower-life" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <g fill="none" stroke="currentColor" stroke-width="1.35">
          <circle cx="32" cy="32" r="10"/>
          <circle cx="22" cy="32" r="10"/>
          <circle cx="42" cy="32" r="10"/>
          <circle cx="27" cy="23.34" r="10"/>
          <circle cx="37" cy="23.34" r="10"/>
          <circle cx="27" cy="40.66" r="10"/>
          <circle cx="37" cy="40.66" r="10"/>
          <circle cx="32" cy="32" r="28"/>
        </g>
      </svg>
    </span>`;
  }

  if(icon==="__moon_stars__"){
    return `<span class="school-personal-svg-icon school-moon-stars" aria-hidden="true">
      <svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">
          <path d="M31 13c-7.8 3.1-12.4 11-10.8 19.2 1.8 9.2 10.7 15.1 19.9 13.3 3.2-.6 6.1-2.1 8.4-4.2-8.6 1.1-16.6-4.7-18.2-13.2-1-5.2-.7-10.2.7-15.1z"/>
          <path d="M48 13v9M43.5 17.5h9"/>
          <path d="M49 33v6M46 36h6"/>
          <path d="M15 18v5M12.5 20.5h5"/>
          <path d="M13.5 40.5l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"/>
        </g>
      </svg>
    </span>`;
  }

  if(icon==="__meditation__"){
    return `<span class="school-personal-svg-icon school-meditation" aria-hidden="true">
      <svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="32" cy="14" r="5.2"/>
          <path d="M24.5 25c2.3-4.1 5-6.1 7.5-6.1s5.2 2 7.5 6.1"/>
          <path d="M32 20v15"/>
          <path d="M23 28l9 7 9-7"/>
          <path d="M19 37c4.5-1 8.8.5 13 5.7 4.2-5.2 8.5-6.7 13-5.7"/>
          <path d="M17 45c4.6 5 9.6 7.3 15 7.3S42.4 50 47 45"/>
          <path d="M15 48c5.8 1.2 11.5.5 17-2.1 5.5 2.6 11.2 3.3 17 2.1"/>
          <path d="M23 54h18"/>
        </g>
      </svg>
    </span>`;
  }

  return escapeHtml(icon || "✦");
}

function schoolPersonalIconLabel(icon){
  if(icon==="__flower_of_life__") return "Blume des Lebens";
  if(icon==="__moon_stars__") return "Mond und Sterne";
  if(icon==="__meditation__") return "Meditation";
  return `Zeichen ${icon}`;
}


function schoolChildDefaultIcon(id){
  return id === "1" ? (state.familySettings.c?.icon || "⭐") : (state.familySettings.d?.icon || "🌙");
}


function schoolTimetableSubjectIcon(subject){
  const s=String(subject||"").trim().toLowerCase();
  if(!s) return "";

  const svg=(cls,body)=>`
    <span class="tt-subject-symbol ${cls}" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">${body}</svg>
    </span>`;

  if(s==="gu" || s.includes("grund")) return svg("tt-symbol-gu",`
    <path d="M4.5 5.5h5.1c1.5 0 2.4.6 2.4 1.9v11c0-1.2-.9-1.9-2.4-1.9H4.5z"/>
    <path d="M19.5 5.5h-5.1c-1.5 0-2.4.6-2.4 1.9v11c0-1.2.9-1.9 2.4-1.9h5.1z"/>
  `);

  if(s==="rel" || s.includes("relig")) return svg("tt-symbol-rel",`
    <path d="M12 3.8v16.4"/>
    <path d="M7.8 8.2h8.4"/>
  `);

  if(s.includes("turn") || s.includes("sport") || s==="bu" || s==="bsp") return svg("tt-symbol-sport",`
    <circle cx="13.8" cy="4.9" r="1.8"/>
    <path d="M11.8 8.1l-2.6 3.6 3.2 2.2 1.7 5.2"/>
    <path d="M11.8 8.1l4.1 2.1 2.7-.8"/>
    <path d="M12.4 13.9l-4.7 4.6"/>
  `);

  if(s.includes("werk") || s==="tec" || s==="tex") return svg("tt-symbol-werken",`
    <path d="M14.6 5.1l4.3 4.3"/>
    <path d="M13.2 6.5l2.8-2.8 4.3 4.3-2.8 2.8"/>
    <path d="M14.8 9.2L6.2 17.8"/>
    <path d="M5.1 16.7l2.2 2.2"/>
  `);

  return svg("tt-symbol-default",`<circle cx="12" cy="12" r="2.2"/>`);
}

function schoolTaskDefaultIcon(id){
  const key=schoolMemberKey(id);
  return state.familySettings[key]?.taskIcon || (id === "1" ? "🌙" : "⭐");
}

function schoolTaskLegacyIcon(childId){
  return childId === "1" ? "🌙" : "⭐";
}

function schoolTaskIcon(task, childId){
  // Bereits vorhandene Aufgaben ohne eigenes gespeichertes Zeichen bleiben stabil.
  // Die untere Auswahl bestimmt nur das Standardzeichen für NEU angelegte Aufgaben.
  return task?.icon || schoolTaskLegacyIcon(childId);
}

function schoolTaskIconOptions(selected){
  const value = selected || "⭐";
  return schoolChildIcons.map(icon =>
    `<option value="${icon}" ${icon === value ? "selected" : ""}>${icon}</option>`
  ).join("");
}
let activeSchoolChild = null;
function schoolMemberKey(id){ return id === "1" ? "c" : "d"; }
function renderSchoolChildDashboard(id){
  activeSchoolChild = id;
  closeAllSchoolDashboardPanels("1");
  closeAllSchoolDashboardPanels("2");
  const chooser=document.querySelector("#schoolChildChooser"), dash=document.querySelector("#schoolChildDashboard");
  if(!chooser||!dash)return;
  chooser.classList.add("hidden"); dash.classList.remove("hidden");
  document.querySelectorAll(".school-card").forEach(card=>card.classList.add("hidden"));
  document.querySelector(`.school-card-child-${id}`)?.classList.remove("hidden");
  dash.dataset.child=id;
  const child=state.school.children[id];
  const key=schoolMemberKey(id), icon=state.familySettings[key]?.icon || (id==="1"?"⭐":"🌙");
  const banner=document.querySelector("#schoolMotivationBanner");
  if(banner){
    const childName=child?.name || (id==="1"?"Lou":"Fina");
    const quotes=schoolChildQuotes[id] || [];
    const quoteText=quotes.length ? quotes[Math.floor(Date.now()/86400000)%quotes.length] : "Du kannst das.";
    const imageSrc=id==="1"?"./lou-stundenplan.png?v=105":"./fina-stundenplan.png?v=105";

    banner.innerHTML=`
      <div class="school-hero-v4-copy">
        <button type="button"
                class="school-hero-v4-icon"
                data-school-timetable-link="${id}"
                title="${childName} – Stundenplan ansehen"
                aria-label="${childName} – Stundenplan ansehen">${schoolPersonalIconMarkup(icon)}</button>
        <div class="school-hero-v4-text">
          <span>Hey ${escapeHtml(childName)}!</span>
          <strong>${escapeHtml(quoteText)}</strong>
          <small>Tippe auf dein Zeichen für deinen Stundenplan.</small>
        </div>
      </div>
      <div class="school-hero-v4-image">
        <img src="${imageSrc}" alt="">
      </div>
    `;
  }
  const host=document.querySelector("#schoolIconChoices");
  if(host){
    host.innerHTML=schoolPersonalIcons.map(x=>
      `<button type="button"
               class="school-icon-choice ${x===icon?"active":""}"
               data-icon="${x}"
               aria-label="${escapeHtml(schoolPersonalIconLabel(x))}"
               title="${escapeHtml(schoolPersonalIconLabel(x))}">
         ${schoolPersonalIconMarkup(x)}
       </button>`
    ).join("");
  }

  if(host && host.dataset.dragScrollBound!=="1"){
    host.dataset.dragScrollBound="1";

    let down=false;
    let startX=0;
    let startScroll=0;
    let moved=false;
    let pressedChoice=null;

    host.addEventListener("pointerdown",e=>{
      if(e.button!==0) return;

      down=true;
      moved=false;
      startX=e.clientX;
      startScroll=host.scrollLeft;

      // Das beim Drücken gewählte Zeichen merken.
      // Pointer-Capture kann später e.target auf den Container umleiten.
      pressedChoice=e.target.closest(".school-icon-choice");

      host.setPointerCapture?.(e.pointerId);
      host.classList.add("is-dragging");
    });

    host.addEventListener("pointermove",e=>{
      if(!down) return;
      const dx=e.clientX-startX;

      if(Math.abs(dx)>10) moved=true;
      host.scrollLeft=startScroll-dx;
    });

    host.addEventListener("pointerup",e=>{
      if(!down) return;

      const wasMoved=moved;
      const choice=pressedChoice;

      down=false;
      moved=false;
      pressedChoice=null;

      host.releasePointerCapture?.(e.pointerId);
      host.classList.remove("is-dragging");

      // Nur ein echtes Antippen/Klicken wählt ein Zeichen.
      if(wasMoved || !choice || !activeSchoolChild) return;

      const childId=activeSchoolChild;
      const key=schoolMemberKey(childId);

      // Persönliches Zeichen: ausschließlich Banner/Stundenplan-Link.
      state.familySettings[key].icon=choice.dataset.icon;
      save();
      renderSchoolChildDashboard(childId);
    });

    host.addEventListener("pointercancel",e=>{
      if(!down) return;
      down=false;
      moved=false;
      pressedChoice=null;
      host.releasePointerCapture?.(e.pointerId);
      host.classList.remove("is-dragging");
    });

    // Nach pointerup nichts ein zweites Mal über einen Click-Handler ausführen.
    host.addEventListener("click",e=>{
      if(e.target.closest(".school-icon-choice")) e.preventDefault();
    });
  }

  // Aufgaben-Zeichen ist unabhängig vom persönlichen Header-Zeichen.
  const taskIconSelect=document.querySelector(`#schoolTaskIcon${id}`);
  if(taskIconSelect){
    const taskDefault=schoolTaskDefaultIcon(id);
    taskIconSelect.innerHTML=schoolTaskIconOptions(taskDefault);
    taskIconSelect.value=taskDefault;
  }
}
function closeSchoolChildDashboard(){
  activeSchoolChild=null;
  document.querySelector("#schoolChildChooser")?.classList.remove("hidden");
  document.querySelector("#schoolChildDashboard")?.classList.add("hidden");
}
document.querySelectorAll("[data-open-school-child]").forEach(b=>b.addEventListener("click",()=>renderSchoolChildDashboard(b.dataset.openSchoolChild)));
document.querySelector("#backToSchoolChooser")?.addEventListener("click",closeSchoolChildDashboard);

document.querySelector("#schoolMotivationBanner")?.addEventListener("click", e => {
  const btn=e.target.closest("[data-school-timetable-link]");
  if(!btn) return;
  const childId=btn.dataset.schoolTimetableLink || activeSchoolChild;
  if(!childId) return;
  showManualTimetable(childId);
});


// Kinder-Dashboard-Kacheln

function closeAllSchoolDashboardPanels(id){
  document.querySelector(`#schoolLinksPanel${id}`)?.classList.add("hidden");
  document.querySelector(`#schoolFindsPanel${id}`)?.classList.add("hidden");

  const timetable = document.querySelector(`#schoolTimetableManage${id}`);
  timetable?.classList.remove("is-open");
  timetable?.classList.add("hidden");

  document.querySelector(`#manualTimetableWrap${id}`)?.classList.add("hidden");
}

document.querySelectorAll("[data-school-panel='links']").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.child;
    closeAllSchoolDashboardPanels(id);
    document.querySelector(`#schoolLinksPanel${id}`)?.classList.remove("hidden");
  });
});

document.querySelectorAll("[data-close-school-panel='links']").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.child;
    document.querySelector(`#schoolLinksPanel${id}`)?.classList.add("hidden");
  });
});

document.querySelectorAll("[data-school-panel='finds']").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.child;
    closeAllSchoolDashboardPanels(id);
    document.querySelector(`#schoolFindsPanel${id}`)?.classList.remove("hidden");
  });
});

document.querySelectorAll("[data-close-school-panel='finds']").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.child;
    document.querySelector(`#schoolFindsPanel${id}`)?.classList.add("hidden");
  });
});


document.querySelectorAll("[data-close-school-timetable]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.closeSchoolTimetable;
    const manage=document.querySelector(`#schoolTimetableManage${id}`);
    manage?.classList.remove("is-open");
    manage?.classList.add("hidden");
    document.querySelector(`#manualTimetableWrap${id}`)?.classList.add("hidden");
  });
});

document.querySelectorAll("[data-school-open-timetable]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.schoolOpenTimetable;
    closeAllSchoolDashboardPanels(id);
    const manage=document.querySelector(`#schoolTimetableManage${id}`);
    manage?.classList.remove("hidden");
    manage?.classList.add("is-open");
    openManualTimetableEditor(id);
    requestAnimationFrame(() => {
      document.querySelector(`#manualTimetableWrap${id}`)?.scrollIntoView({behavior:"smooth",block:"start"});
    });
  });
});

document.querySelectorAll("[data-school-open-week]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id=btn.dataset.schoolOpenWeek;
    openChildWeekOverview(id);
  });
});



// Wenn "Schule" in der Hauptnavigation angeklickt wird, immer auf die
// Kinder-Auswahlseite zurückkehren. So ist die Navigation jederzeit klar.
document.querySelector('.tab[data-view="school"]')?.addEventListener("click", () => {
  closeSchoolChildDashboard();
});

// Aufgaben-Zeichen-Auswahl: vollständig unabhängig vom persönlichen Zeichen.
["1","2"].forEach(id => {
  const select=document.querySelector(`#schoolTaskIcon${id}`);
  if(!select) return;
  const taskDefault=schoolTaskDefaultIcon(id);
  select.innerHTML=schoolTaskIconOptions(taskDefault);
  select.value=taskDefault;
  select.addEventListener("change", () => {
    const key=schoolMemberKey(id);
    state.familySettings[key].taskIcon=select.value;
    save();
  });
});





// V18 delegated school-week-check:
// Sicherheitsnetz für neu gerenderte Wochenplan-Aufgaben.
document.addEventListener("click", e => {
  const el = e.target.closest?.(".school-week-check");
  if (!el) return;

  // Wenn bereits ein direkter Handler reagiert hat, nicht doppelt toggeln.
  if (e.__schoolWeekHandled) return;
  e.__schoolWeekHandled = true;

  const childId = el.dataset.child;
  const taskId = el.dataset.id;
  const child = state.school?.children?.[childId];
  const task = child?.tasks?.find?.(t => t.id === taskId);
  if (!task) return;

  e.preventDefault();
  e.stopPropagation();

  const wasDone = !!task.done;
  task.done = !task.done;
  save();
  renderAll();

  if (!wasDone && task.done) {
    showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(child)));
  }
}, true);

window.addEventListener("pagehide", persistFamilyQuestionsNow);
window.addEventListener("beforeunload", persistFamilyQuestionsNow);

/* ===== Layout-Korrektur: To-do-Felder + Rezept-Kartenzeichen ===== */
function normalizePlanningFormLayout() {
  const priority = document.querySelector("#todoPriority")?.closest("label");
  const area = document.querySelector("#todoArea")?.closest("label");

  if (priority && area) {
    let quickRow = document.querySelector(".todo-quick-meta-row");
    if (!quickRow) {
      quickRow = document.createElement("div");
      quickRow.className = "todo-quick-meta-row";
    }

    [priority, area].forEach(label => quickRow.appendChild(label));

    const oldDetails = document.querySelector(".todo-more-settings");
    const topRow = document.querySelector(".entry-top-row");

    if (oldDetails) {
      const hint = oldDetails.querySelector("#schoolHolidayHint")?.closest(".recurrence-row")
        || oldDetails.querySelector("#schoolHolidayHint");
      const schoolFields = oldDetails.querySelector("#schoolyearScheduleFields");

      if (hint) oldDetails.parentElement?.insertBefore(hint, oldDetails);
      if (schoolFields) oldDetails.parentElement?.insertBefore(schoolFields, oldDetails);
      oldDetails.remove();
    }

    if (topRow && quickRow.parentElement !== topRow) {
      topRow.appendChild(quickRow);
    }
  }

  const cardMark = document.querySelector("#recipeCardMark")?.closest("label");
  const metaGrid = document.querySelector("#recipeForm .recipe-v19-meta-grid");
  const tempLabel = document.querySelector("#recipeTemperature")?.closest("label");

  if (cardMark && metaGrid) {
    cardMark.classList.add("recipe-meta-mark");
    if (tempLabel?.parentElement === metaGrid) {
      tempLabel.insertAdjacentElement("afterend", cardMark);
    } else {
      metaGrid.appendChild(cardMark);
    }
  }
}

normalizePlanningFormLayout();

function debugFamilyCombinationLabels() {
  return [
    ["Mama + Papa", familySelectionLabel({family:["a","b"]})],
    ["Mama + Lou", familySelectionLabel({family:["a","c"]})],
    ["Mama + Fina", familySelectionLabel({family:["a","d"]})],
    ["Papa + Lou", familySelectionLabel({family:["b","c"]})],
    ["Papa + Fina", familySelectionLabel({family:["b","d"]})],
    ["Lou + Fina", familySelectionLabel({family:["c","d"]})],
    ["Mama + Papa + Lou", familySelectionLabel({family:["a","b","c"]})],
    ["Mama + Papa + Fina", familySelectionLabel({family:["a","b","d"]})],
    ["Mama + Lou + Fina", familySelectionLabel({family:["a","c","d"]})],
    ["Papa + Lou + Fina", familySelectionLabel({family:["b","c","d"]})],
    ["Alle", familySelectionLabel({family:["a","b","c","d"]})]
  ];
}

/* =========================================================
   V54 – persönliche Wochenansichten exakt auf Papa-Breite
   Papa, Lou, Fina und "Mein Plan" bekommen dieselbe Dialogbreite.
   ========================================================= */
function ensurePersonalWeekDialogWidthStyle() {
  if (document.querySelector("#personalWeekDialogWidthStyle")) return;

  const style = document.createElement("style");
  style.id = "personalWeekDialogWidthStyle";
  style.textContent = `
    :root{
      --personal-week-dialog-width: 700px;
    }

    /* Papa = Referenz */
    #papaOverviewDialog,
    /* Lou + Fina teilen sich diesen Dialog */
    #childWeekDialog,
    /* Mein Plan / Werkraum */
    #workroomWeekDialog{
      width:min(var(--personal-week-dialog-width), calc(100vw - 32px)) !important;
      max-width:min(var(--personal-week-dialog-width), calc(100vw - 32px)) !important;
      box-sizing:border-box !important;
    }

    /* Unterschiedliche bisherige Innenkarten dürfen die Breite nicht wieder verändern. */
    #papaOverviewDialog > *,
    #childWeekDialog > *,
    #workroomWeekDialog > *{
      width:100% !important;
      max-width:100% !important;
      box-sizing:border-box !important;
    }

    /* vorhandene Card-Klassen ebenfalls eindeutig auf die Dialogbreite zwingen */
    #papaOverviewDialog .dialog-card,
    #papaOverviewDialog .papa-overview-card,
    #childWeekDialog .dialog-card,
    #childWeekDialog .child-week-card,
    #workroomWeekDialog .dialog-card,
    #workroomWeekDialog .workroom-week-card{
      width:100% !important;
      max-width:100% !important;
      box-sizing:border-box !important;
    }

    @media (max-width:700px){
      #papaOverviewDialog,
      #childWeekDialog,
      #workroomWeekDialog{
        width:calc(100vw - 18px) !important;
        max-width:calc(100vw - 18px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensurePersonalWeekDialogWidthStyle();

/* =========================================================
   V55 – zusätzliche Tagesqualitäten
   ========================================================= */
function ensureAdditionalRoutineQualities() {
  const extras = [
    ["gelassenheit", "Gelassenheit"],
    ["vertrauen", "Vertrauen"],
    ["praesenz", "Präsenz"]
  ];

  document.querySelectorAll(".routine-quality-cloud").forEach(group => {
    const existing = new Set(
      [...group.querySelectorAll("button[data-quality]")]
        .map(btn => String(btn.dataset.quality || "").trim())
    );

    extras.forEach(([value, label]) => {
      if (existing.has(value)) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.quality = value;
      btn.textContent = label;
      btn.setAttribute("aria-pressed", "false");
      group.appendChild(btn);
    });
  });
}

ensureAdditionalRoutineQualities();

/* Falls der Routinenbereich später neu aufgebaut/geöffnet wird, sicherstellen,
   dass die zusätzlichen Qualitäten weiterhin vorhanden sind. */
document.querySelector("#toggleRoutinePanelBtn")?.addEventListener("click", () => {
  setTimeout(() => {
    ensureAdditionalRoutineQualities();
    renderRoutineIdeaChecks();
  }, 0);
});

/* =========================================================
   V56 – persönliche Wochenfenster WIRKLICH identisch
   Grund: die bestehende CSS-Datei enthält für Papa spätere,
   spezifischere !important-Regeln (780x720), während Kinder/
   Werkraum auf andere Größen gesetzt sind. Inline-!important
   am echten Dialogelement gewinnt zuverlässig gegen alle diese Regeln.
   ========================================================= */
function normalizePersonalWeekDialogs() {
  const ids = [
    "papaOverviewDialog",
    "childWeekDialog",
    "workroomWeekDialog"
  ];

  ids.forEach(id => {
    const dialog = document.getElementById(id);
    if (!dialog) return;

    const set = (prop, value) =>
      dialog.style.setProperty(prop, value, "important");

    /* Papa ist die Referenz: bestehende finale Papa-Größe = 780 x 720. */
    set("width", "min(780px, 92vw)");
    set("max-width", "780px");
    set("height", "min(720px, 86vh)");
    set("max-height", "min(720px, 86vh)");

    /* Alle drei exakt an dieselbe Bildschirmposition. */
    set("position", "fixed");
    set("top", "50%");
    set("left", "50%");
    set("right", "auto");
    set("bottom", "auto");
    set("inset", "50% auto auto 50%");
    set("transform", "translate(-50%, -50%)");
    set("margin", "0");

    set("box-sizing", "border-box");
    set("overflow", "hidden");
  });

  /* Die beiden Shell-Dialoge müssen die volle identische Außenhöhe nutzen. */
  [
    ["childWeekDialog", ".child-week-shell"],
    ["workroomWeekDialog", ".workroom-week-shell"]
  ].forEach(([id, selector]) => {
    const dialog = document.getElementById(id);
    const shell = dialog?.querySelector(selector);
    if (!shell) return;

    shell.style.setProperty("width", "100%", "important");
    shell.style.setProperty("max-width", "100%", "important");
    shell.style.setProperty("height", "100%", "important");
    shell.style.setProperty("max-height", "100%", "important");
    shell.style.setProperty("box-sizing", "border-box", "important");
  });
}

normalizePersonalWeekDialogs();

/* Auch direkt vor jedem Öffnen erneut anwenden, falls andere Renderlogik
   vorher Inline-Werte verändert haben sollte. */
document.addEventListener("click", event => {
  if (
    event.target.closest(
      "#openPapaOverviewBtn, #openWorkroomWeekBtn, .open-child-week, [data-open-child-week]"
    )
  ) {
    normalizePersonalWeekDialogs();
    requestAnimationFrame(normalizePersonalWeekDialogs);
  }
}, true);

/* showModal() kann Browser-Dialogpositionierung neu initialisieren.
   Deshalb nach dem Öffnen noch einmal festziehen. */
["papaOverviewDialog","childWeekDialog","workroomWeekDialog"].forEach(id => {
  const dialog = document.getElementById(id);
  if (!dialog) return;

  const observer = new MutationObserver(() => {
    if (dialog.open) {
      normalizePersonalWeekDialogs();
    }
  });
  observer.observe(dialog, {attributes:true, attributeFilter:["open"]});
});

window.addEventListener("resize", normalizePersonalWeekDialogs);

/* =========================================================
   V57 – responsive gemeinsame Größe für alle 4 Wochenfenster
   Desktop/Tablet: Papa-Referenz bis 780x720.
   Handy: alle vier identisch, nahezu bildschirmfüllend.
   ========================================================= */
function normalizePersonalWeekDialogsResponsive() {
  const dialogs = [
    document.getElementById("papaOverviewDialog"),
    document.getElementById("childWeekDialog"),
    document.getElementById("workroomWeekDialog")
  ].filter(Boolean);

  const mobile = window.matchMedia("(max-width: 600px)").matches;

  dialogs.forEach(dialog => {
    const set = (prop, value) =>
      dialog.style.setProperty(prop, value, "important");

    set("position", "fixed");
    set("left", "50%");
    set("right", "auto");
    set("bottom", "auto");
    set("margin", "0");
    set("box-sizing", "border-box");
    set("overflow", "hidden");

    if (mobile) {
      /* Handy: identische Außenmaße mit kleinem sicheren Rand. */
      set("top", "50%");
      set("inset", "50% auto auto 50%");
      set("transform", "translate(-50%, -50%)");
      set("width", "calc(100vw - 16px)");
      set("max-width", "calc(100vw - 16px)");
      set("height", "calc(100dvh - 16px)");
      set("max-height", "calc(100dvh - 16px)");
      set("border-radius", "18px");
    } else {
      /* PC + Tablet: gemeinsame Papa-Referenz, aber nie größer als Viewport. */
      set("top", "50%");
      set("inset", "50% auto auto 50%");
      set("transform", "translate(-50%, -50%)");
      set("width", "min(780px, calc(100vw - 32px))");
      set("max-width", "min(780px, calc(100vw - 32px))");
      set("height", "min(720px, calc(100dvh - 32px))");
      set("max-height", "min(720px, calc(100dvh - 32px))");
    }
  });

  [
    ["childWeekDialog", ".child-week-shell"],
    ["workroomWeekDialog", ".workroom-week-shell"]
  ].forEach(([id, selector]) => {
    const shell = document.getElementById(id)?.querySelector(selector);
    if (!shell) return;
    shell.style.setProperty("width", "100%", "important");
    shell.style.setProperty("max-width", "100%", "important");
    shell.style.setProperty("height", "100%", "important");
    shell.style.setProperty("max-height", "100%", "important");
    shell.style.setProperty("box-sizing", "border-box", "important");
  });
}

/* V57 ist die finale Geometrie und überschreibt V56 bewusst. */
normalizePersonalWeekDialogsResponsive();

document.addEventListener("click", event => {
  if (
    event.target.closest(
      "#openPapaOverviewBtn, #openWorkroomWeekBtn, .open-child-week, [data-open-child-week]"
    )
  ) {
    normalizePersonalWeekDialogsResponsive();
    requestAnimationFrame(normalizePersonalWeekDialogsResponsive);
  }
}, true);

["papaOverviewDialog","childWeekDialog","workroomWeekDialog"].forEach(id => {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  const observer = new MutationObserver(() => {
    if (dialog.open) {
      normalizePersonalWeekDialogsResponsive();
      requestAnimationFrame(normalizePersonalWeekDialogsResponsive);
    }
  });
  observer.observe(dialog, {attributes:true, attributeFilter:["open"]});
});

window.addEventListener("resize", normalizePersonalWeekDialogsResponsive);
window.addEventListener("orientationchange", () => {
  setTimeout(normalizePersonalWeekDialogsResponsive, 50);
});

/* =========================================================
   V58 – Schnellzugriffe + Unsere Farben nach "Unser Überblick"
   Die ORIGINALEN DOM-Blöcke werden verschoben, nicht kopiert.
   Dadurch bleiben bestehende Events, Sync und Bearbeiten-Funktionen erhalten.
   ========================================================= */
function movePlanningToolsToOverview() {
  const overview = document.querySelector("#archive");
  if (!overview) return;

  const quickLinks =
    document.querySelector("#quickLinksRow")?.closest(".quick-links.card, .quick-links");

  const familySettings =
    document.querySelector("#familyColorA")?.closest("details.family-settings, .family-settings");

  if (!quickLinks && !familySettings) return;

  let host = overview.querySelector("#overviewTopTools");
  if (!host) {
    host = document.createElement("div");
    host.id = "overviewTopTools";
    host.className = "overview-top-tools";

    const head = overview.querySelector(".overview-page-head, .section-head");
    if (head) head.insertAdjacentElement("afterend", host);
    else overview.prepend(host);
  }

  /* Reihenfolge: Schnellzugriffe zuerst, darunter Unsere Farben. */
  if (quickLinks && quickLinks.parentElement !== host) host.appendChild(quickLinks);
  if (familySettings && familySettings.parentElement !== host) host.appendChild(familySettings);

  if (!document.querySelector("#overviewTopToolsStyle")) {
    const style = document.createElement("style");
    style.id = "overviewTopToolsStyle";
    style.textContent = `
      #overviewTopTools{
        display:grid;
        gap:10px;
        margin:0 0 14px;
      }

      #overviewTopTools > .quick-links,
      #overviewTopTools > .family-settings{
        width:100%;
        max-width:none;
        box-sizing:border-box;
        margin:0;
      }

      #overviewTopTools .quick-links{
        order:1;
      }

      #overviewTopTools .family-settings{
        order:2;
      }

      @media(max-width:700px){
        #overviewTopTools{
          gap:8px;
          margin-bottom:10px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/* Direkt beim Start und nochmals nach dem ersten Rendern.
   So funktioniert es auch, wenn einzelne Bereiche erst kurz später initialisiert werden. */
movePlanningToolsToOverview();
requestAnimationFrame(movePlanningToolsToOverview);
setTimeout(movePlanningToolsToOverview, 100);

/* =========================================================
   V59 – "Unsere Farben" -> "Individuelle Einstellungen"
   + individuelle Stundenplanfächer für Mama, Lou und Fina
   ========================================================= */
function personalTimetablePersonLabel(id) {
  if (id === "mama") return familyName("a") || "Mama";
  if (id === "1") return familyName("c") || "Lou";
  if (id === "2") return familyName("d") || "Fina";
  return id;
}

function renderPersonalTimetableSubjectSettings() {
  ensurePersonalTimetableSubjects();

  const details =
    document.querySelector("#familyColorA")?.closest("details.family-settings, .family-settings");

  if (!details) return;

  const summary = details.querySelector("summary");
  if (summary) {
    const textNodes = [...summary.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    const target = textNodes.find(node => /Unsere Farben/i.test(node.textContent || ""));
    if (target) {
      target.textContent = target.textContent.replace(/Unsere Farben/i, "Individuelle Einstellungen");
    } else if (/Unsere Farben/i.test(summary.textContent || "")) {
      summary.innerHTML = summary.innerHTML.replace(/Unsere Farben/i, "Individuelle Einstellungen");
    }
  }

  let host = details.querySelector("#personalTimetableSubjectSettings");
  if (!host) {
    host = document.createElement("section");
    host.id = "personalTimetableSubjectSettings";
    host.className = "personal-timetable-subject-settings";
    details.appendChild(host);
  }

  host.innerHTML = `
    <div class="personal-subject-settings-head">
      <strong>Stundenplanfächer</strong>
      <small>Mama, Lou und Fina können hier ihre Fächer und eine sanfte Farbe dafür festlegen.</small>
    </div>

    <div class="personal-subject-person-tabs">
      ${["mama","1","2"].map((id,index) => `
        <button type="button"
                class="personal-subject-person-tab ${index===0 ? "active" : ""}"
                data-person="${id}">
          ${escapeHtml(personalTimetablePersonLabel(id))}
        </button>
      `).join("")}
    </div>

    ${["mama","1","2"].map((id,index) => `
      <div class="personal-subject-person-panel ${index===0 ? "" : "hidden"}" data-person-panel="${id}">
        <div class="personal-subject-list">
          ${personalTimetableSubjectEntries(id).map(entry => `
            <div class="personal-subject-row" data-subject-id="${escapeHtml(entry.id)}">
              <input class="personal-subject-name"
                     type="text"
                     value="${escapeHtml(entry.name)}"
                     aria-label="Fachname">
              <input class="personal-subject-color"
                     type="color"
                     value="${escapeHtml(entry.color)}"
                     aria-label="Farbe für ${escapeHtml(entry.name)}">
              <button type="button"
                      class="personal-subject-delete"
                      data-subject-id="${escapeHtml(entry.id)}"
                      title="Fach entfernen">×</button>
            </div>
          `).join("")}
        </div>

        <div class="personal-subject-add-row">
          <input type="text"
                 class="personal-subject-new-name"
                 data-person="${id}"
                 placeholder="Neues Fach …">
          <input type="color"
                 class="personal-subject-new-color"
                 data-person="${id}"
                 value="${timetablePastelPalette[(index*3+6)%timetablePastelPalette.length]}">
          <button type="button"
                  class="personal-subject-add"
                  data-person="${id}">+ Fach</button>
        </div>
      </div>
    `).join("")}
  `;

  host.querySelectorAll(".personal-subject-person-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const person=btn.dataset.person;
      host.querySelectorAll(".personal-subject-person-tab")
        .forEach(x => x.classList.toggle("active", x===btn));
      host.querySelectorAll(".personal-subject-person-panel")
        .forEach(panel => panel.classList.toggle("hidden", panel.dataset.personPanel!==person));
    });
  });

  host.querySelectorAll(".personal-subject-row").forEach(row => {
    const panel=row.closest("[data-person-panel]");
    const person=panel?.dataset.personPanel;
    const id=row.dataset.subjectId;
    const name=row.querySelector(".personal-subject-name");
    const color=row.querySelector(".personal-subject-color");

    const commit=()=>{
      const entry=personalTimetableSubjectEntries(person).find(x=>x.id===id);
      if(!entry) return;

      const nextName=String(name?.value||"").trim();
      if(!nextName){
        name.value=entry.name;
        return;
      }

      entry.name=nextName;
      entry.color=String(color?.value||entry.color);
      save();
      renderTTMatrix(person);
    };

    name?.addEventListener("change",commit);
    color?.addEventListener("input",()=>{
      const entry=personalTimetableSubjectEntries(person).find(x=>x.id===id);
      if(!entry) return;
      entry.color=color.value;
      row.style.setProperty("--subject-preview",color.value);
      save();
      renderTTMatrix(person);
    });

    row.querySelector(".personal-subject-delete")?.addEventListener("click",()=>{
      const list=personalTimetableSubjectEntries(person);
      const index=list.findIndex(x=>x.id===id);
      if(index<0) return;

      const removed=list[index];
      if(!confirm(`Fach „${removed.name}“ aus der Auswahl entfernen? Bereits eingetragene Stunden bleiben erhalten.`)) return;

      list.splice(index,1);
      save();
      renderPersonalTimetableSubjectSettings();
      renderTTMatrix(person);
    });
  });

  host.querySelectorAll(".personal-subject-add").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const person=btn.dataset.person;
      const panel=host.querySelector(`[data-person-panel="${person}"]`);
      const nameInput=panel?.querySelector(".personal-subject-new-name");
      const colorInput=panel?.querySelector(".personal-subject-new-color");
      const name=String(nameInput?.value||"").trim();
      if(!name) return;

      const list=personalTimetableSubjectEntries(person);
      if(list.some(x=>x.name.toLocaleLowerCase("de")===name.toLocaleLowerCase("de"))){
        showMotivation(`${name} ist bereits vorhanden.`);
        return;
      }

      list.push({
        id:uid(),
        name,
        color:String(colorInput?.value||timetablePastelPalette[list.length%timetablePastelPalette.length])
      });

      save();
      renderPersonalTimetableSubjectSettings();
      renderTTMatrix(person);

      const nextPanel=document.querySelector(`[data-person-panel="${person}"]`);
      document.querySelectorAll(".personal-subject-person-tab").forEach(tab =>
        tab.classList.toggle("active", tab.dataset.person===person)
      );
      document.querySelectorAll(".personal-subject-person-panel").forEach(panel2 =>
        panel2.classList.toggle("hidden", panel2.dataset.personPanel!==person)
      );
      nextPanel?.querySelector(".personal-subject-new-name")?.focus();
    });
  });
}

function ensurePersonalTimetableSubjectStyle() {
  if(document.querySelector("#personalTimetableSubjectStyle")) return;

  const style=document.createElement("style");
  style.id="personalTimetableSubjectStyle";
  style.textContent=`
    .personal-timetable-subject-settings{
      margin:12px 14px 14px;
      padding:14px;
      border:1px solid rgba(119,103,91,.16);
      border-radius:16px;
      background:rgba(255,253,249,.72);
    }
    .personal-subject-settings-head{
      display:grid;
      gap:3px;
      margin-bottom:11px;
    }
    .personal-subject-settings-head strong{
      font-family:Georgia,serif;
      color:#51443d;
      font-size:1rem;
    }
    .personal-subject-settings-head small{
      color:#8b7d75;
      font-size:.72rem;
    }
    .personal-subject-person-tabs{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-bottom:10px;
    }
    .personal-subject-person-tab{
      border:1px solid rgba(120,105,92,.18);
      background:#fffdf9;
      border-radius:999px;
      padding:6px 12px;
      color:#65564e;
      cursor:pointer;
    }
    .personal-subject-person-tab.active{
      background:#f1eee6;
      border-color:#c9bea8;
      font-weight:600;
    }
    .personal-subject-person-panel.hidden{display:none!important;}
    .personal-subject-list{
      display:grid;
      gap:6px;
    }
    .personal-subject-row,
    .personal-subject-add-row{
      display:grid;
      grid-template-columns:minmax(150px,1fr) 46px 36px;
      gap:7px;
      align-items:center;
    }
    .personal-subject-name,
    .personal-subject-new-name{
      min-width:0;
      border:1px solid rgba(126,112,99,.18);
      border-radius:10px;
      padding:7px 9px;
      background:#fffdfa;
    }
    .personal-subject-color,
    .personal-subject-new-color{
      width:42px;
      height:34px;
      padding:3px;
      border:1px solid rgba(126,112,99,.18);
      border-radius:9px;
      background:#fffdfa;
      cursor:pointer;
    }
    .personal-subject-delete{
      width:34px;
      height:34px;
      border:0;
      border-radius:50%;
      background:transparent;
      color:#9b8278;
      cursor:pointer;
    }
    .personal-subject-add-row{
      grid-template-columns:minmax(150px,1fr) 46px auto;
      margin-top:9px;
      padding-top:9px;
      border-top:1px dashed rgba(126,112,99,.17);
    }
    .personal-subject-add{
      white-space:nowrap;
      border:1px solid #c9bea8;
      border-radius:999px;
      padding:7px 12px;
      background:#f6f3e9;
      color:#5d554a;
      cursor:pointer;
    }

    .tt-subject-cell{
      transition:background-color .15s ease;
    }
    .tt-subject-pastel{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:4px;
      width:calc(100% - 6px);
      min-height:28px;
      box-sizing:border-box;
      margin:3px;
      padding:4px 7px;
      border-radius:8px;
      background:var(--tt-subject-bg,transparent);
    }

    @media(max-width:700px){
      .personal-timetable-subject-settings{
        margin:8px;
        padding:10px;
      }
      .personal-subject-row,
      .personal-subject-add-row{
        grid-template-columns:minmax(0,1fr) 42px 34px;
      }
      .personal-subject-add-row{
        grid-template-columns:minmax(0,1fr) 42px auto;
      }
    }
  `;
  document.head.appendChild(style);
}

ensurePersonalTimetableSubjectStyle();
ensurePersonalTimetableSubjects();

/* Sobald die bereits verschobenen Einstellungen existieren, umbenennen und erweitern. */
function initIndividualSettingsPanel(){
  renderPersonalTimetableSubjectSettings();
}
initIndividualSettingsPanel();
requestAnimationFrame(initIndividualSettingsPanel);
setTimeout(initIndividualSettingsPanel,120);

/* Nach Namensänderungen die Personen-Tabs ebenfalls aktualisieren. */
document.addEventListener("change",event=>{
  if(event.target?.matches?.("#familyNameA,#familyNameC,#familyNameD")){
    setTimeout(renderPersonalTimetableSubjectSettings,0);
  }
});

/* =========================================================
   V60 – "Meine Woche" personalisieren
   Header-Verlauf + Termin + To-do + aktueller Tag
   ========================================================= */
const myWeekPastelGradients = [
  ["Rosé & Salbei", "linear-gradient(120deg,#f8e5e7 0%,#f7eddf 52%,#e6f0e4 100%)"],
  ["Flieder & Creme", "linear-gradient(120deg,#eee7f7 0%,#fbf1e3 52%,#e8f1e4 100%)"],
  ["Pfirsich & Mint", "linear-gradient(120deg,#fae8dc 0%,#f8f0dc 50%,#e2f0e8 100%)"],
  ["Puderrosa & Himmel", "linear-gradient(120deg,#f6e2ea 0%,#f3ebdf 50%,#e3edf5 100%)"],
  ["Vanille & Salbei", "linear-gradient(120deg,#faf1d9 0%,#f3eee4 50%,#dfead9 100%)"],
  ["Lavendel & Rosé", "linear-gradient(120deg,#e9e3f4 0%,#f5e5eb 52%,#f6eedf 100%)"],
  ["Apricot & Flieder", "linear-gradient(120deg,#f8e3d6 0%,#f5ebdf 48%,#e9e3f4 100%)"],
  ["Meergrün & Creme", "linear-gradient(120deg,#dfeee9 0%,#f7f0df 52%,#eee4ef 100%)"],
  ["Altrosa & Eukalyptus", "linear-gradient(120deg,#efdfe1 0%,#f5eadf 50%,#dfe9df 100%)"],
  ["Mondlicht", "linear-gradient(120deg,#ece8f2 0%,#f8f2e7 48%,#e5eee8 100%)"]
];

const myWeekPastelColors = [
  "#f4dfdf","#f2e5d4","#eee3f2","#e3edf3","#e1ecdf",
  "#f4e2ea","#e4eee9","#f1ead7","#e8e2f0","#dfe9e2"
];

function ensureMyWeekPersonalization(){
  state.familySettings = state.familySettings || {};
  state.familySettings.myWeekAppearance =
    state.familySettings.myWeekAppearance &&
    typeof state.familySettings.myWeekAppearance === "object"
      ? state.familySettings.myWeekAppearance
      : {};

  const defaults = {
    mama:{gradient:0,event:"#f2e5d4",todo:"#e1ecdf",today:"#f4dfdf"},
    "1":{gradient:1,event:"#f2e5d4",todo:"#e3edf3",today:"#eee3f2"},
    "2":{gradient:2,event:"#f2e5d4",todo:"#e1ecdf",today:"#f4dfdf"}
  };

  ["mama","1","2"].forEach(id=>{
    const current=state.familySettings.myWeekAppearance[id] || {};
    const d=defaults[id];
    state.familySettings.myWeekAppearance[id]={
      gradient:Number.isInteger(Number(current.gradient))
        ? Math.max(0,Math.min(myWeekPastelGradients.length-1,Number(current.gradient)))
        : d.gradient,
      event:/^#[0-9a-f]{6}$/i.test(String(current.event||"")) ? current.event : d.event,
      todo:/^#[0-9a-f]{6}$/i.test(String(current.todo||"")) ? current.todo : d.todo,
      today:/^#[0-9a-f]{6}$/i.test(String(current.today||"")) ? current.today : d.today
    };
  });
  return state.familySettings.myWeekAppearance;
}

function myWeekAppearanceFor(id){
  return ensureMyWeekPersonalization()[String(id)] || ensureMyWeekPersonalization().mama;
}

function renderMyWeekAppearanceSettings(){
  const root=document.querySelector("#personalTimetableSubjectSettings");
  if(!root) return;

  let section=document.querySelector("#myWeekAppearanceSettings");
  if(!section){
    section=document.createElement("section");
    section.id="myWeekAppearanceSettings";
    section.className="my-week-appearance-settings";
    root.insertAdjacentElement("afterend",section);
  }

  ensureMyWeekPersonalization();

  section.innerHTML=`
    <div class="personal-subject-settings-head">
      <strong>Meine Woche</strong>
      <small>Header, Termine, To-dos und den aktuellen Tag persönlich gestalten.</small>
    </div>

    <div class="my-week-person-tabs">
      ${["mama","1","2"].map((id,index)=>`
        <button type="button"
                class="my-week-person-tab ${index===0?"active":""}"
                data-my-week-person="${id}">
          ${escapeHtml(personalTimetablePersonLabel(id))}
        </button>
      `).join("")}
    </div>

    ${["mama","1","2"].map((id,index)=>{
      const value=myWeekAppearanceFor(id);
      return `
        <div class="my-week-person-panel ${index===0?"":"hidden"}"
             data-my-week-panel="${id}">
          <label class="my-week-setting-label">Header</label>
          <div class="my-week-gradient-grid">
            ${myWeekPastelGradients.map(([name,gradient],i)=>`
              <button type="button"
                      class="my-week-gradient-swatch ${value.gradient===i?"selected":""}"
                      data-gradient="${i}"
                      title="${escapeHtml(name)}"
                      style="background:${gradient}">
                <span>${escapeHtml(name)}</span>
              </button>
            `).join("")}
          </div>

          <div class="my-week-color-row">
            ${[
              ["event","Termine"],
              ["todo","To-dos"],
              ["today","Aktueller Tag"]
            ].map(([key,label])=>`
              <label class="my-week-color-control">
                <span>${label}</span>
                <span class="my-week-color-picker-wrap">
                  <input type="color"
                         data-my-week-color="${key}"
                         value="${escapeHtml(value[key])}">
                  <span class="my-week-color-preview"
                        style="background:${escapeHtml(value[key])}"></span>
                </span>
              </label>
            `).join("")}
          </div>

          <div class="my-week-preset-colors" aria-label="Pastellfarben">
            ${myWeekPastelColors.map(color=>`
              <button type="button"
                      class="my-week-preset-color"
                      data-preset-color="${color}"
                      style="background:${color}"
                      title="${color}"></button>
            `).join("")}
            <small>Pastellton anklicken und danach Termine, To-dos oder aktuellen Tag wählen.</small>
          </div>
        </div>
      `;
    }).join("")}
  `;

  section.querySelectorAll(".my-week-person-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.myWeekPerson;
      section.querySelectorAll(".my-week-person-tab").forEach(x=>
        x.classList.toggle("active",x===btn)
      );
      section.querySelectorAll(".my-week-person-panel").forEach(panel=>
        panel.classList.toggle("hidden",panel.dataset.myWeekPanel!==id)
      );
    });
  });

  section.querySelectorAll(".my-week-person-panel").forEach(panel=>{
    const id=panel.dataset.myWeekPanel;

    panel.querySelectorAll(".my-week-gradient-swatch").forEach(btn=>{
      btn.addEventListener("click",()=>{
        myWeekAppearanceFor(id).gradient=Number(btn.dataset.gradient);
        save();
        panel.querySelectorAll(".my-week-gradient-swatch")
          .forEach(x=>x.classList.toggle("selected",x===btn));
        applyMyWeekAppearance();
      });
    });

    let chosenPreset=null;
    panel.querySelectorAll(".my-week-preset-color").forEach(btn=>{
      btn.addEventListener("click",()=>{
        chosenPreset=btn.dataset.presetColor;
        panel.querySelectorAll(".my-week-preset-color")
          .forEach(x=>x.classList.toggle("selected",x===btn));
      });
    });

    panel.querySelectorAll("[data-my-week-color]").forEach(input=>{
      input.addEventListener("input",()=>{
        const key=input.dataset.myWeekColor;
        myWeekAppearanceFor(id)[key]=input.value;
        input.parentElement?.querySelector(".my-week-color-preview")
          ?.style.setProperty("background",input.value);
        save();
        applyMyWeekAppearance();
      });

      input.closest(".my-week-color-control")?.addEventListener("click",event=>{
        if(!chosenPreset || event.target===input) return;
        const key=input.dataset.myWeekColor;
        input.value=chosenPreset;
        myWeekAppearanceFor(id)[key]=chosenPreset;
        input.parentElement?.querySelector(".my-week-color-preview")
          ?.style.setProperty("background",chosenPreset);
        save();
        applyMyWeekAppearance();
      });
    });
  });
}

function inferMyWeekPersonFromOpenView(){
  /* bekannte persönliche Wochenfenster anhand vorhandener Texte/IDs erkennen */
  const dialogs=[...document.querySelectorAll('[role="dialog"], .modal, .overlay, .week-modal, .person-week-modal')]
    .filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width>250 && r.height>180 && getComputedStyle(el).display!=="none";
    });

  for(const dialog of dialogs.reverse()){
    const text=(dialog.textContent||"").toLocaleLowerCase("de");
    if(text.includes("lous woche")) return {id:"1",root:dialog};
    if(text.includes("finas woche")) return {id:"2",root:dialog};
    if(text.includes("was steht für mich an?") || text.includes("meine woche")) return {id:"mama",root:dialog};
  }
  return null;
}

function applyMyWeekAppearance(){
  const found=inferMyWeekPersonFromOpenView();
  if(!found) return;

  const {id,root}=found;
  const appearance=myWeekAppearanceFor(id);
  const gradient=myWeekPastelGradients[appearance.gradient]?.[1] || myWeekPastelGradients[0][1];

  root.style.setProperty("--my-week-header",gradient);
  root.style.setProperty("--my-week-event",appearance.event);
  root.style.setProperty("--my-week-todo",appearance.todo);
  root.style.setProperty("--my-week-today",appearance.today);
  root.classList.add("personalized-my-week");

  /* Header robust finden: oberster größerer Bereich vor den Wochen-Tabs */
  const candidates=[...root.querySelectorAll("header, .modal-header, .week-header, .person-week-header, section, div")];
  const header=candidates.find(el=>{
    const t=(el.textContent||"").toLocaleLowerCase("de");
    const r=el.getBoundingClientRect();
    return r.height>=70 && r.height<=220 &&
      (t.includes("lous woche") || t.includes("finas woche") ||
       t.includes("was steht für mich an?"));
  });
  if(header) header.classList.add("personalized-my-week-header");

  /* Karten semantisch färben, ohne deren Größe/Layout anzutasten */
  [...root.querySelectorAll("*")].forEach(el=>{
    const direct=[...el.childNodes]
      .filter(n=>n.nodeType===Node.TEXT_NODE)
      .map(n=>n.textContent.trim().toLocaleLowerCase("de"))
      .filter(Boolean)
      .join(" ");

    if(direct==="termin") el.closest("article, li, .card, [class*='item']")?.classList.add("personalized-my-week-event");
    if(direct==="to-do" || direct==="todo") el.closest("article, li, .card, [class*='item']")?.classList.add("personalized-my-week-todo");
  });

  /* Aktuellen Tag über das echte heutige Datum markieren */
  const today=new Date();
  const dd=String(today.getDate()).padStart(2,"0")+".";
  const mm=String(today.getMonth()+1).padStart(2,"0")+".";
  const token=dd+mm;

  [...root.querySelectorAll("article, section, li, div")].forEach(el=>{
    const text=(el.textContent||"");
    const r=el.getBoundingClientRect();
    if(text.includes(token) && r.width>180 && r.height>55 && r.height<500){
      el.classList.add("personalized-my-week-today");
    }
  });
}

function ensureMyWeekAppearanceStyle(){
  if(document.querySelector("#myWeekAppearanceStyle")) return;
  const style=document.createElement("style");
  style.id="myWeekAppearanceStyle";
  style.textContent=`
    .my-week-appearance-settings{
      margin:12px 14px 14px;
      padding:14px;
      border:1px solid rgba(119,103,91,.16);
      border-radius:16px;
      background:rgba(255,253,249,.72);
    }
    .my-week-person-tabs{
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      margin:10px 0 12px;
    }
    .my-week-person-tab{
      border:1px solid rgba(120,105,92,.18);
      background:#fffdf9;
      border-radius:999px;
      padding:6px 12px;
      color:#65564e;
      cursor:pointer;
    }
    .my-week-person-tab.active{
      background:#f1eee6;
      border-color:#c9bea8;
      font-weight:600;
    }
    .my-week-person-panel.hidden{display:none!important;}
    .my-week-setting-label{
      display:block;
      margin-bottom:7px;
      font-size:.76rem;
      color:#6f6259;
      font-weight:600;
    }
    .my-week-gradient-grid{
      display:grid;
      grid-template-columns:repeat(5,minmax(90px,1fr));
      gap:7px;
    }
    .my-week-gradient-swatch{
      min-height:54px;
      border:2px solid transparent;
      border-radius:12px;
      padding:7px;
      cursor:pointer;
      box-shadow:inset 0 0 0 1px rgba(110,95,83,.12);
    }
    .my-week-gradient-swatch.selected{
      border-color:#9d846f;
      box-shadow:0 0 0 2px rgba(157,132,111,.12);
    }
    .my-week-gradient-swatch span{
      display:inline-block;
      padding:2px 5px;
      border-radius:6px;
      background:rgba(255,255,255,.68);
      color:#5f534b;
      font-size:.65rem;
    }
    .my-week-color-row{
      display:grid;
      grid-template-columns:repeat(3,minmax(120px,1fr));
      gap:8px;
      margin-top:12px;
    }
    .my-week-color-control{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      padding:8px 10px;
      border:1px solid rgba(120,105,92,.15);
      border-radius:11px;
      background:#fffdfa;
      color:#665950;
      font-size:.75rem;
      cursor:pointer;
    }
    .my-week-color-picker-wrap{
      position:relative;
      width:32px;
      height:26px;
    }
    .my-week-color-picker-wrap input{
      position:absolute;
      inset:0;
      opacity:0;
      width:100%;
      height:100%;
      cursor:pointer;
    }
    .my-week-color-preview{
      display:block;
      width:30px;
      height:24px;
      border-radius:8px;
      border:1px solid rgba(90,75,65,.14);
    }
    .my-week-preset-colors{
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:6px;
      margin-top:9px;
    }
    .my-week-preset-color{
      width:24px;
      height:24px;
      border-radius:50%;
      border:2px solid #fff;
      outline:1px solid rgba(100,85,75,.13);
      cursor:pointer;
    }
    .my-week-preset-color.selected{
      outline:2px solid #9d846f;
    }
    .my-week-preset-colors small{
      margin-left:4px;
      color:#93857b;
      font-size:.66rem;
    }

    .personalized-my-week .personalized-my-week-header{
      background:var(--my-week-header)!important;
    }
    .personalized-my-week .personalized-my-week-event{
      background:var(--my-week-event)!important;
    }
    .personalized-my-week .personalized-my-week-todo{
      background:var(--my-week-todo)!important;
    }
    .personalized-my-week .personalized-my-week-today{
      border-color:color-mix(in srgb,var(--my-week-today) 70%,#b99c91)!important;
      box-shadow:inset 0 0 0 9999px color-mix(in srgb,var(--my-week-today) 16%,transparent);
    }

    @media(max-width:850px){
      .my-week-gradient-grid{grid-template-columns:repeat(2,minmax(100px,1fr));}
      .my-week-color-row{grid-template-columns:1fr;}
    }
  `;
  document.head.appendChild(style);
}

ensureMyWeekAppearanceStyle();
ensureMyWeekPersonalization();
renderMyWeekAppearanceSettings();
requestAnimationFrame(()=>{
  renderMyWeekAppearanceSettings();
  applyMyWeekAppearance();
});
setTimeout(()=>{
  renderMyWeekAppearanceSettings();
  applyMyWeekAppearance();
},180);

/* Beim Neu-Rendern persönlicher Wochenansichten automatisch anwenden.
   Stabilität: NICHT mehr den gesamten document.body beobachten,
   sondern ausschließlich die drei Wochenfenster, in denen diese
   Darstellung überhaupt gebraucht wird. */
const myWeekAppearanceObserver=new MutationObserver(()=>{
  requestAnimationFrame(applyMyWeekAppearance);
});
[
  document.getElementById("papaOverviewDialog"),
  document.getElementById("childWeekDialog"),
  document.getElementById("workroomWeekDialog")
].filter(Boolean).forEach(dialog=>{
  myWeekAppearanceObserver.observe(dialog,{childList:true,subtree:true});
});

/* =========================================================
   V61 – Routinentexte individuell bearbeiten
   Mama: wirkt sofort auf die vorhandenen vier Routinen.
   Lou + Fina: gleiche Datenstruktur schon vorbereitet für ihre
   späteren persönlichen Routinen.
   ========================================================= */

const personalRoutineAreaMeta = [
  ["morning","Morgens"],
  ["school","Schulalltag"],
  ["afterschool","Nach der Schule"],
  ["evening","Abends"]
];

const defaultPersonalRoutineSentences = {
  morning: [
    {step:"breath", text:"3 ruhige Atemzüge – Ausatmen länger als Einatmen."},
    {step:"body", text:"Kurz in den Körper spüren: Wo halte ich gerade Spannung? → bewusst lösen."},
    {step:"quote", text:"„Nicht alles muss heute genau geplant sein.“"},
    {step:"orientation", text:"Was muss ich heute alles schaffen? → Wie möchte ich heute durch diesen Tag gehen?"}
  ],
  school: [
    {step:"arrival", text:"Vor Schule / Klasse: bewusst einatmen · lang ausatmen · Schultern und Kiefer lösen."},
    {step:"lesson", text:"Vor der nächsten Stunde: Füße spüren · ausatmen · „Wo ist gerade meine Aufmerksamkeit?“"},
    {step:"focus", text:"Where focus goes, energy flows."},
    {step:"stress", text:"Wenn etwas stresst: Daumen nacheinander an die Finger tippen: „Frieden beginnt in mir.“ Erst danach reagieren."},
    {step:"decision", text:"Bei Entscheidungen: „Dient das meiner Vision von mir selbst?“"}
  ],
  afterschool: [
    {step:"bodyscan", text:"Kurz hinsetzen oder hinlegen. Kleiner Bodyscan: Gesicht → Schultern → Bauch → Hände → Beine."},
    {step:"release", text:"Spannung bewusst lockerlassen. 3–5 Atemzüge mit besonders langer Ausatmung."},
    {step:"close", text:"„Der Schultag ist vorbei. Ich muss ihn nicht im Körper mit nach Hause nehmen.“"}
  ],
  evening: [
    {step:"noeval", text:"Keine Tagesbewertung und keine lange Reflexion."},
    {step:"enough", text:"Was darf für heute genug sein?"},
    {step:"relax", text:"Den Körper Stück für Stück entspannen oder einen kurzen Bodyscan machen."},
    {step:"close", text:"„Alles ist in mir.“"}
  ]
};

const defaultLouRoutineSentences = {
  morning: [
    {step:"breath", text:"3 ruhige Atemzüge – tief einatmen und langsam ausatmen."},
    {step:"water", text:"Ein Glas Wasser trinken."},
    {step:"face", text:"Gesicht waschen und mich frisch machen."},
    {step:"hair", text:"Haare in Ruhe richten – ohne Stress."},
    {step:"room", text:"Bett kurz machen und 2 Minuten aufräumen."},
    {step:"start", text:"Was tut mir heute gut? Eine Sache bewusst wählen."}
  ],
  school: [
    {step:"posture", text:"Kurz aufrichten: Schultern locker, Kiefer entspannt."},
    {step:"water", text:"Zwischendurch Wasser trinken."},
    {step:"pause", text:"Vor einer stressigen Stunde einmal tief ein- und langsam ausatmen."},
    {step:"focus", text:"Handy weg, wenn ich mich konzentrieren möchte."}
  ],
  afterschool: [
    {step:"reset", text:"Jacke, Tasche und Schuhe gleich an ihren Platz."},
    {step:"fresh", text:"Hände waschen, Wasser trinken und kurz durchatmen."},
    {step:"room", text:"5 Minuten Zimmer-Reset: herumliegende Dinge wegräumen."},
    {step:"move", text:"Kurz bewegen, spazieren oder mich strecken."},
    {step:"prep", text:"Für morgen nur das vorbereiten, was mir wirklich hilft."}
  ],
  evening: [
    {step:"wash", text:"Abendroutine in Ruhe: Gesicht waschen und Zähne putzen."},
    {step:"room", text:"2-Minuten-Aufräumen, damit morgen ruhiger beginnt."},
    {step:"phone", text:"Handy rechtzeitig weglegen."},
    {step:"water", text:"Wasser für morgen bereitstellen."},
    {step:"close", text:"Ein schöner Gedanke für heute – dann ist der Tag genug."}
  ]
};


const defaultFinaRoutineSentences = {
  morning: [
    {step:"breath", text:"3 ruhige Atemzüge – tief einatmen und langsam ausatmen."},
    {step:"water", text:"Ein Glas Wasser trinken."},
    {step:"wash", text:"Gesicht waschen und Zähne putzen."},
    {step:"dress", text:"In Ruhe anziehen und schauen, ob alles für die Schule da ist."},
    {step:"room", text:"Bettdecke richten und 2 Dinge wegräumen."},
    {step:"start", text:"Was möchte ich heute Schönes erleben?"}
  ],
  school: [
    {step:"arrival", text:"Vor dem Start einmal tief durchatmen und die Schultern locker lassen."},
    {step:"water", text:"In der Pause etwas trinken."},
    {step:"pause", text:"Wenn mir etwas zu viel wird: kurz Füße spüren und langsam ausatmen."},
    {step:"kind", text:"Freundlich mit mir selbst reden, auch wenn etwas noch nicht klappt."},
    {step:"ask", text:"Wenn ich etwas nicht verstehe, darf ich nachfragen."}
  ],
  afterschool: [
    {step:"home", text:"Schuhe, Jacke und Schultasche an ihren Platz."},
    {step:"snack", text:"Etwas trinken und eine kleine Pause machen."},
    {step:"reset", text:"5 Minuten Zimmer-Reset: Spielsachen und Kleidung wegräumen."},
    {step:"move", text:"Kurz rausgehen, tanzen, hüpfen oder mich bewegen."},
    {step:"schoolbag", text:"Schultasche für morgen kurz kontrollieren."}
  ],
  evening: [
    {step:"wash", text:"Zähne putzen, Gesicht waschen und Schlafsachen anziehen."},
    {step:"room", text:"2 Minuten aufräumen, damit es morgen gemütlich ist."},
    {step:"prepare", text:"Kleidung oder wichtige Sachen für morgen bereitlegen."},
    {step:"quiet", text:"Etwas Ruhiges machen: lesen, kuscheln oder Musik hören."},
    {step:"close", text:"An eine schöne Sache von heute denken – dann darf der Tag fertig sein."}
  ]
};

function ensureFinaRoutineStarterPack(){
  state.familySettings = state.familySettings || {};
  state.familySettings.routineStarterVersions =
    state.familySettings.routineStarterVersions &&
    typeof state.familySettings.routineStarterVersions === "object"
      ? state.familySettings.routineStarterVersions
      : {};

  if(Number(state.familySettings.routineStarterVersions.fina || 0) >= 1) return;

  ensurePersonalRoutineSentences();
  state.familySettings.personalRoutineSentences["2"] =
    cloneRoutineSet(defaultFinaRoutineSentences);

  state.familySettings.routineStarterVersions.fina = 1;
  persistFamilySettingsImmediately?.();
  save();
}

function cloneRoutineSet(source){
  return Object.fromEntries(
    Object.entries(source).map(([area,rows])=>[
      area,
      rows.map(row=>({...row}))
    ])
  );
}


function clonePersonalRoutineDefaults(){
  return Object.fromEntries(
    Object.entries(defaultPersonalRoutineSentences).map(([area,rows])=>[
      area,
      rows.map(row=>({...row}))
    ])
  );
}

function ensurePersonalRoutineSentences(){
  state.familySettings = state.familySettings || {};
  state.familySettings.personalRoutineSentences =
    state.familySettings.personalRoutineSentences &&
    typeof state.familySettings.personalRoutineSentences === "object"
      ? state.familySettings.personalRoutineSentences
      : {};

  ["mama","1","2"].forEach(id=>{
    const current=state.familySettings.personalRoutineSentences[id];

    if(!current || typeof current!=="object"){
      state.familySettings.personalRoutineSentences[id] =
        id==="1"
          ? cloneRoutineSet(defaultLouRoutineSentences)
          : id==="2"
            ? cloneRoutineSet(defaultFinaRoutineSentences)
            : clonePersonalRoutineDefaults();
      return;
    }

    personalRoutineAreaMeta.forEach(([area])=>{
      const defaults = id==="1"
        ? (defaultLouRoutineSentences[area] || defaultPersonalRoutineSentences[area])
        : id==="2"
          ? (defaultFinaRoutineSentences[area] || defaultPersonalRoutineSentences[area])
          : defaultPersonalRoutineSentences[area];
      const existing=Array.isArray(current[area]) ? current[area] : [];

      /* V142: vorhandene Reihenfolge erhalten.
         Fehlende Standardpunkte werden nur ergänzt; eigene Punkte bleiben ebenfalls erhalten. */
      const byDefaultStep=new Map(defaults.map(def=>[def.step,def]));
      const normalized=[];
      const seen=new Set();

      existing.forEach(row=>{
        const step=String(row?.step||"").trim();
        if(!step || seen.has(step)) return;
        seen.add(step);

        const def=byDefaultStep.get(step);
        normalized.push({
          step,
          text:String(row?.text ?? def?.text ?? "").trim()
        });
      });

      defaults.forEach(def=>{
        if(seen.has(def.step)) return;
        seen.add(def.step);
        normalized.push({
          step:def.step,
          text:String(def.text)
        });
      });

      current[area]=normalized;
    });
  });

  return state.familySettings.personalRoutineSentences;
}

function personalRoutineSentencesFor(id){
  return ensurePersonalRoutineSentences()[String(id)] || ensurePersonalRoutineSentences().mama;
}

function applyMamaRoutineSentences(){
  const data=personalRoutineSentencesFor("mama");

  Object.entries(data).forEach(([area,rows])=>{
    rows.forEach(row=>{
      const button=document.querySelector(
        `.routine-step[data-routine-card="${CSS.escape(area)}"][data-routine-step="${CSS.escape(row.step)}"]`
      );
      if(!button) return;

      const textSpan=button.querySelector(":scope > span:last-child");
      if(!textSpan) return;

      /* Nur Text ersetzen; Markierung links bleibt vollständig erhalten. */
      const nextText=String(row.text||"").trim();
      if(textSpan.textContent!==nextText){
        textSpan.textContent=nextText;
      }
    });
  });
}

function personalRoutineDesktopDragEnabled(){
  return !!window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
}

function enablePersonalRoutineDesktopDrag(section){
  if(!section || !personalRoutineDesktopDragEnabled()) return;

  let draggedRow=null;

  const renumber=(body)=>{
    body?.querySelectorAll(":scope > .personal-routine-sentence-row").forEach((row,index)=>{
      const number=row.querySelector(".personal-routine-sentence-number");
      if(number) number.textContent=String(index+1);
    });
  };

  const saveOrder=(body)=>{
    if(!body) return;
    const panel=body.closest("[data-routine-person-panel]");
    const areaDetails=body.closest(".personal-routine-area");
    const firstRow=body.querySelector(":scope > .personal-routine-sentence-row");
    const id=panel?.dataset.routinePersonPanel;
    const area=firstRow?.dataset.area ||
      areaDetails?.querySelector(".personal-routine-sentence-row")?.dataset.area;
    if(!id || !area) return;

    const current=personalRoutineSentencesFor(id)[area] || [];
    const byStep=new Map(current.map(row=>[String(row.step),row]));
    const ordered=[...body.querySelectorAll(":scope > .personal-routine-sentence-row")]
      .map(row=>byStep.get(String(row.dataset.step||"")))
      .filter(Boolean);

    if(ordered.length!==current.length) return;

    ensurePersonalRoutineSentences()[id][area]=ordered;
    persistFamilySettingsImmediately?.();
    save();
  };

  section.querySelectorAll(".personal-routine-sentence-row").forEach(row=>{
    row.draggable=true;
    row.classList.add("desktop-routine-draggable");

    row.addEventListener("dragstart",event=>{
      if(event.target.closest("textarea,button,input,select,a")){
        event.preventDefault();
        return;
      }
      draggedRow=row;
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed="move";
      try{ event.dataTransfer.setData("text/plain",row.dataset.step||""); }catch(_){}
    });

    row.addEventListener("dragend",()=>{
      if(!draggedRow) return;
      const body=draggedRow.closest(".personal-routine-area-body");
      draggedRow.classList.remove("is-dragging");
      draggedRow=null;
      renumber(body);
      saveOrder(body);
    });
  });

  section.querySelectorAll(".personal-routine-area-body").forEach(body=>{
    body.addEventListener("dragover",event=>{
      if(!draggedRow) return;
      if(draggedRow.closest(".personal-routine-area-body")!==body) return;

      event.preventDefault();
      event.dataTransfer.dropEffect="move";

      const rows=[...body.querySelectorAll(":scope > .personal-routine-sentence-row:not(.is-dragging)")];
      const next=rows.find(row=>{
        const rect=row.getBoundingClientRect();
        return event.clientY < rect.top + rect.height/2;
      });

      if(next) body.insertBefore(draggedRow,next);
      else{
        const addButton=body.querySelector(":scope > .personal-routine-add-one");
        body.insertBefore(draggedRow,addButton || null);
      }
      renumber(body);
    });

    body.addEventListener("drop",event=>{
      if(!draggedRow) return;
      if(draggedRow.closest(".personal-routine-area-body")!==body) return;
      event.preventDefault();
      renumber(body);
      saveOrder(body);
    });
  });
}

function renderPersonalRoutineSentenceSettings(){
  ensurePersonalRoutineSentences();

  const anchor=document.querySelector("#myWeekAppearanceSettings");
  if(!anchor) return;

  let section=document.querySelector("#personalRoutineSentenceSettings");
  if(!section){
    section=document.createElement("section");
    section.id="personalRoutineSentenceSettings";
    section.className="personal-routine-sentence-settings";
    anchor.insertAdjacentElement("afterend",section);
  }

  section.innerHTML=`
    <div class="personal-subject-settings-head">
      <strong>Routinen</strong>
      <small>Die Sätze deiner vier Routinen persönlich formulieren. Bei Mama werden Änderungen sofort in den vorhandenen Routinen sichtbar; Lou und Fina sind bereits für ihre späteren Routinen vorbereitet.</small>
    </div>

    <div class="personal-routine-person-tabs">
      ${["mama","1","2"].map((id,index)=>`
        <button type="button"
                class="personal-routine-person-tab ${index===0?"active":""}"
                data-routine-person="${id}">
          ${escapeHtml(personalTimetablePersonLabel(id))}
        </button>
      `).join("")}
    </div>

    ${["mama","1","2"].map((id,index)=>{
      const data=personalRoutineSentencesFor(id);

      return `
        <div class="personal-routine-person-panel ${index===0?"":"hidden"}"
             data-routine-person-panel="${id}">
          ${personalRoutineAreaMeta.map(([area,label])=>`
            <details class="personal-routine-area" ${area==="morning"?"open":""}>
              <summary>
                <strong>${escapeHtml(label)}</strong>
                <span>${data[area].length} ${data[area].length===1?"Satz":"Sätze"}</span>
              </summary>

              <div class="personal-routine-area-body">
                ${data[area].map((row,rowIndex)=>`
                  <div class="personal-routine-sentence-row"
                       data-area="${area}"
                       data-step="${escapeHtml(row.step)}">
                    <span class="personal-routine-sentence-number">${rowIndex+1}</span>
                    <textarea rows="2"
                              class="personal-routine-sentence-input"
                              aria-label="${escapeHtml(label)} – Satz ${rowIndex+1}">${escapeHtml(row.text)}</textarea>
                    <button type="button"
                            class="personal-routine-reset-one"
                            title="Auf ursprünglichen Satz zurücksetzen">↶</button>
                    <button type="button"
                            class="personal-routine-delete-one"
                            title="Routinepunkt löschen">×</button>
                  </div>
                `).join("")}
                <button type="button"
                        class="personal-routine-add-one"
                        data-add-routine-area="${area}">
                  + Routinepunkt
                </button>
              </div>
            </details>
          `).join("")}

          <div class="personal-routine-panel-actions">
            <button type="button"
                    class="personal-routine-reset-all"
                    data-person="${id}">
              Ursprüngliche Sätze wiederherstellen
            </button>
          </div>
        </div>
      `;
    }).join("")}
  `;

  enablePersonalRoutineDesktopDrag(section);

  section.querySelectorAll(".personal-routine-person-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.routinePerson;
      section.querySelectorAll(".personal-routine-person-tab").forEach(x=>
        x.classList.toggle("active",x===btn)
      );
      section.querySelectorAll(".personal-routine-person-panel").forEach(panel=>
        panel.classList.toggle("hidden",panel.dataset.routinePersonPanel!==id)
      );
    });
  });

  section.querySelectorAll(".personal-routine-sentence-input").forEach(input=>{
    input.addEventListener("change",()=>{
      const panel=input.closest("[data-routine-person-panel]");
      const row=input.closest(".personal-routine-sentence-row");
      const id=panel?.dataset.routinePersonPanel;
      const area=row?.dataset.area;
      const step=row?.dataset.step;
      if(!id || !area || !step) return;

      const target=personalRoutineSentencesFor(id)[area]
        ?.find(x=>x.step===step);
      if(!target) return;

      const value=input.value.trim();
      if(!value){
        input.value=target.text;
        return;
      }

      target.text=value;
      save();

      if(id==="mama") applyMamaRoutineSentences();
      if(id==="1" || id==="2"){
        if(document.querySelector("#childRoutineDialog")?.open &&
           activeChildRoutineId===id) renderChildRoutineDialog();
      }
    });
  });


  section.querySelectorAll(".personal-routine-add-one").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const panel=btn.closest("[data-routine-person-panel]");
      const id=panel?.dataset.routinePersonPanel;
      const area=btn.dataset.addRoutineArea;
      if(!id || !area) return;

      const list=personalRoutineSentencesFor(id)[area] || [];
      const step=`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      list.push({
        step,
        text:"Neuer Routinepunkt"
      });

      save();
      renderPersonalRoutineSentenceSettings();

      const newSection=document.querySelector("#personalRoutineSentenceSettings");
      newSection?.querySelectorAll(".personal-routine-person-tab").forEach(tab=>
        tab.classList.toggle("active",tab.dataset.routinePerson===id)
      );
      newSection?.querySelectorAll(".personal-routine-person-panel").forEach(p=>
        p.classList.toggle("hidden",p.dataset.routinePersonPanel!==id)
      );

      const newRow=newSection?.querySelector(
        `[data-routine-person-panel="${id}"] .personal-routine-sentence-row[data-step="${CSS.escape(step)}"]`
      );
      const input=newRow?.querySelector(".personal-routine-sentence-input");
      if(input){
        input.focus();
        input.select();
      }
    });
  });

  section.querySelectorAll(".personal-routine-delete-one").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const panel=btn.closest("[data-routine-person-panel]");
      const row=btn.closest(".personal-routine-sentence-row");
      const id=panel?.dataset.routinePersonPanel;
      const area=row?.dataset.area;
      const step=row?.dataset.step;
      if(!id || !area || !step) return;

      const list=personalRoutineSentencesFor(id)[area] || [];
      const target=list.find(x=>x.step===step);
      if(!target) return;

      if(!confirm(`Routinepunkt „${target.text}“ löschen?`)) return;

      const index=list.findIndex(x=>x.step===step);
      if(index>=0) list.splice(index,1);

      save();
      renderPersonalRoutineSentenceSettings();

      const newSection=document.querySelector("#personalRoutineSentenceSettings");
      newSection?.querySelectorAll(".personal-routine-person-tab").forEach(tab=>
        tab.classList.toggle("active",tab.dataset.routinePerson===id)
      );
      newSection?.querySelectorAll(".personal-routine-person-panel").forEach(p=>
        p.classList.toggle("hidden",p.dataset.routinePersonPanel!==id)
      );

      if(id==="mama") applyMamaRoutineSentences();
      if((id==="1" || id==="2") &&
         document.querySelector("#childRoutineDialog")?.open &&
         activeChildRoutineId===id) renderChildRoutineDialog();
    });
  });

  section.querySelectorAll(".personal-routine-reset-one").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const panel=btn.closest("[data-routine-person-panel]");
      const row=btn.closest(".personal-routine-sentence-row");
      const id=panel?.dataset.routinePersonPanel;
      const area=row?.dataset.area;
      const step=row?.dataset.step;
      if(!id || !area || !step) return;

      const original=defaultPersonalRoutineSentences[area]
        ?.find(x=>x.step===step);
      const target=personalRoutineSentencesFor(id)[area]
        ?.find(x=>x.step===step);
      if(!original || !target) return;

      target.text=original.text;
      const input=row.querySelector(".personal-routine-sentence-input");
      if(input) input.value=original.text;

      save();
      if(id==="mama") applyMamaRoutineSentences();
      if((id==="1" || id==="2") &&
         document.querySelector("#childRoutineDialog")?.open &&
         activeChildRoutineId===id) renderChildRoutineDialog();
    });
  });

  section.querySelectorAll(".personal-routine-reset-all").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.person;
      if(!id) return;

      if(!confirm(`Die Routinen-Sätze von ${personalTimetablePersonLabel(id)} auf die ursprüngliche Version zurücksetzen?`)) return;

      ensurePersonalRoutineSentences()[id] =
        id==="1"
          ? cloneRoutineSet(defaultLouRoutineSentences)
          : id==="2"
            ? cloneRoutineSet(defaultFinaRoutineSentences)
            : clonePersonalRoutineDefaults();
      save();
      renderPersonalRoutineSentenceSettings();
      if(id==="mama") applyMamaRoutineSentences();
      if((id==="1" || id==="2") &&
         document.querySelector("#childRoutineDialog")?.open &&
         activeChildRoutineId===id) renderChildRoutineDialog();

      /* Nach Neurendern wieder dieselbe Person öffnen. */
      const newSection=document.querySelector("#personalRoutineSentenceSettings");
      newSection?.querySelectorAll(".personal-routine-person-tab").forEach(tab=>
        tab.classList.toggle("active",tab.dataset.routinePerson===id)
      );
      newSection?.querySelectorAll(".personal-routine-person-panel").forEach(panel=>
        panel.classList.toggle("hidden",panel.dataset.routinePersonPanel!==id)
      );
    });
  });
}

function ensurePersonalRoutineSentenceStyle(){
  if(document.querySelector("#personalRoutineSentenceStyle")) return;

  const style=document.createElement("style");
  style.id="personalRoutineSentenceStyle";
  style.textContent=`
    .personal-routine-sentence-settings{
      margin:12px 14px 14px;
      padding:14px;
      border:1px solid rgba(119,103,91,.16);
      border-radius:16px;
      background:rgba(255,253,249,.72);
    }
    .personal-routine-person-tabs{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin:10px 0 12px;
    }
    .personal-routine-person-tab{
      border:1px solid rgba(120,105,92,.18);
      background:#fffdf9;
      border-radius:999px;
      padding:6px 12px;
      color:#65564e;
      cursor:pointer;
    }
    .personal-routine-person-tab.active{
      background:#f1eee6;
      border-color:#c9bea8;
      font-weight:600;
    }
    .personal-routine-person-panel.hidden{display:none!important;}

    .personal-routine-area{
      border:1px solid rgba(120,105,92,.14);
      border-radius:12px;
      background:#fffdfa;
      overflow:hidden;
      margin-bottom:7px;
    }
    .personal-routine-area summary{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      padding:9px 11px;
      cursor:pointer;
      color:#5e5048;
    }
    .personal-routine-area summary strong{
      font-family:Georgia,serif;
      font-size:.9rem;
    }
    .personal-routine-area summary span{
      color:#9a8a80;
      font-size:.68rem;
    }
    .personal-routine-area-body{
      display:grid;
      gap:6px;
      padding:0 9px 9px;
    }
    .v146-payment-history{
      margin:0;
    }
    .v146-payment-history > summary{
      cursor:pointer;
      list-style:none;
      font-weight:700;
      padding:2px 0 8px;
    }
    .v146-payment-history > summary::-webkit-details-marker{
      display:none;
    }
    .v146-payment-history > summary::before{
      content:"▸";
      display:inline-block;
      width:18px;
      color:var(--muted);
    }
    .v146-payment-history[open] > summary::before{
      content:"▾";
    }
    .v146-payment-history-body{
      padding-top:2px;
    }

    .personal-routine-sentence-row{
      display:grid;
      grid-template-columns:24px minmax(0,1fr) 34px;
      gap:6px;
      align-items:center;
    }
    @media (hover:hover) and (pointer:fine){
      .personal-routine-sentence-row.desktop-routine-draggable{
        cursor:grab;
      }
      .personal-routine-sentence-row.desktop-routine-draggable:active{
        cursor:grabbing;
      }
      .personal-routine-sentence-row.desktop-routine-draggable.is-dragging{
        opacity:.48;
      }
      .personal-routine-sentence-row.desktop-routine-draggable textarea{
        cursor:text;
      }
      .personal-routine-sentence-row.desktop-routine-draggable button{
        cursor:pointer;
      }
    }
    .personal-routine-sentence-number{
      display:grid;
      place-items:center;
      width:22px;
      height:22px;
      border-radius:50%;
      background:#f2eee4;
      color:#8c7a6e;
      font-size:.65rem;
    }
    .personal-routine-sentence-input{
      width:100%;
      min-height:46px;
      resize:vertical;
      box-sizing:border-box;
      border:1px solid rgba(120,105,92,.15);
      border-radius:9px;
      background:#fff;
      color:#554942;
      padding:7px 9px;
      font:inherit;
      font-size:.75rem;
      line-height:1.35;
    }
    .personal-routine-reset-one{
      width:32px;
      height:32px;
      border:1px solid rgba(120,105,92,.14);
      border-radius:50%;
      background:#faf7f0;
      color:#927d70;
      cursor:pointer;
    }
    .personal-routine-panel-actions{
      display:flex;
      justify-content:flex-end;
      margin-top:9px;
    }
    .personal-routine-reset-all{
      border:1px solid rgba(145,120,105,.20);
      border-radius:999px;
      background:#faf6ef;
      color:#7b665b;
      padding:7px 11px;
      font-size:.7rem;
      cursor:pointer;
    }

    @media(max-width:700px){
      .personal-routine-sentence-settings{
        margin:8px;
        padding:10px;
      }
      .personal-routine-sentence-row{
        grid-template-columns:22px minmax(0,1fr) 32px;
      }
    }
  `;
  document.head.appendChild(style);
}

ensurePersonalRoutineSentenceStyle();
ensurePersonalRoutineSentences();
ensureFinaRoutineStarterPack();
renderPersonalRoutineSentenceSettings();
applyMamaRoutineSentences();

requestAnimationFrame(()=>{
  renderPersonalRoutineSentenceSettings();
  applyMamaRoutineSentences();
});

setTimeout(()=>{
  renderPersonalRoutineSentenceSettings();
  applyMamaRoutineSentences();
},220);

/* Falls die Mama-Routinen später neu gerendert werden:
   nur den tatsächlichen Routinenbereich beobachten – nicht die ganze Seite. */
const personalRoutineSentenceObserver=new MutationObserver(()=>{
  requestAnimationFrame(applyMamaRoutineSentences);
});
const personalRoutineObserveRoot =
  document.querySelector("#workroomRoutineBody") ||
  document.querySelector(".workroom-routine-card");
if(personalRoutineObserveRoot){
  personalRoutineSentenceObserver.observe(
    personalRoutineObserveRoot,
    {childList:true,subtree:true}
  );
}

document.addEventListener("DOMContentLoaded", () => {
  /* Nach Aufbau der Seite nochmals aus dem tatsächlich gespeicherten
     state anwenden – HTML-Defaultfarben dürfen nie sichtbar zurückgewinnen. */
  requestAnimationFrame(() => {
    applyFamilyVisuals();
  });
});

/* =========================================================
   V62 – Lou/Fina: eigene Routinen
   - Kindansicht nur ansehen + abhaken
   - Bearbeiten ausschließlich über Unser Überblick
   - Von Haus aus leer
   - getrennt gespeichert/synchronisiert
   ========================================================= */

const childRoutineDefaultAreas = {
  morning:"Morgens",
  school:"Schule",
  afterschool:"Nach der Schule",
  evening:"Abends"
};

let activeChildRoutineId = "1";
let activeChildRoutineWeekOffset = 0;
let activeChildRoutineEditorId = "1";
let activeChildRoutineEditorWeekOffset = 0;
let editingChildRoutineItemId = null;

function freshChildRoutineStore(){
  return {
    items:[],
    completions:{},
    tombstones:{},
    areaLabels:{...childRoutineDefaultAreas},
    updatedAt:0
  };
}

function normalizeChildRoutineStore(value){
  const raw=value && typeof value==="object" ? value : {};
  return {
    items:Array.isArray(raw.items) ? raw.items.map(item=>({...item,category:item?.category||"none"})) : [],
    completions:raw.completions && typeof raw.completions==="object" ? raw.completions : {},
    tombstones:raw.tombstones && typeof raw.tombstones==="object" ? raw.tombstones : {},
    areaLabels:{...childRoutineDefaultAreas,...(raw.areaLabels||{})},
    updatedAt:Number(raw.updatedAt||0)
  };
}

function ensureChildRoutinePlans(){
  state.familySettings = state.familySettings || {};
  state.familySettings.childRoutinePlans =
    state.familySettings.childRoutinePlans &&
    typeof state.familySettings.childRoutinePlans==="object"
      ? state.familySettings.childRoutinePlans
      : {};

  ["1","2"].forEach(id=>{
    state.familySettings.childRoutinePlans[id] =
      normalizeChildRoutineStore(state.familySettings.childRoutinePlans[id]);
  });

  return state.familySettings.childRoutinePlans;
}

function childRoutineStore(id){
  return ensureChildRoutinePlans()[String(id)] || freshChildRoutineStore();
}

function childRoutineTouch(id){
  const store=childRoutineStore(id);
  store.updatedAt=Date.now();
  persistFamilySettingsImmediately?.();
  save();
}

function mergeChildRoutineStore(localValue,cloudValue){
  const local=normalizeChildRoutineStore(localValue);
  const cloud=normalizeChildRoutineStore(cloudValue);

  const tombstones={...(cloud.tombstones||{}),...(local.tombstones||{})};
  const byId=new Map();

  [...cloud.items,...local.items].forEach(item=>{
    if(!item?.id) return;
    const tomb=Number(tombstones[item.id]||0);
    const ts=Number(item.updatedAt||item.createdAt||0);
    if(tomb && tomb>=ts) return;

    const old=byId.get(item.id);
    if(!old || Number(item.updatedAt||0)>=Number(old.updatedAt||0)){
      byId.set(item.id,{...item});
    }
  });

  const completions={...(cloud.completions||{})};
  Object.entries(local.completions||{}).forEach(([key,value])=>{
    const old=completions[key];
    if(!old || Number(value?.updatedAt||0)>=Number(old?.updatedAt||0)){
      completions[key]=value;
    }
  });

  return {
    items:[...byId.values()],
    completions,
    tombstones,
    areaLabels:{
      ...childRoutineDefaultAreas,
      ...(cloud.updatedAt>local.updatedAt ? local.areaLabels : cloud.areaLabels),
      ...(local.updatedAt>=cloud.updatedAt ? local.areaLabels : cloud.areaLabels)
    },
    updatedAt:Math.max(local.updatedAt,cloud.updatedAt)
  };
}

function childRoutineWeekKey(offset=0){
  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+Number(offset||0)*7);
  return dateKey(monday);
}

function childRoutineAppliesToWeek(item,weekKey){
  return !!item.sticky || item.weekKey===weekKey;
}

function childRoutineAppliesToDate(item,date){
  if(!item.day || item.day==="daily") return true;
  const names=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  return names[date.getDay()]===item.day;
}

function childRoutineCompletionKey(itemId,date){
  return `${itemId}__${dateKey(date)}`;
}

function childRoutineCompletion(id,itemId,date){
  return childRoutineStore(id).completions[childRoutineCompletionKey(itemId,date)] || null;
}

function setChildRoutineCompletion(id,itemId,date,done){
  const store=childRoutineStore(id);
  store.completions[childRoutineCompletionKey(itemId,date)]={
    done:!!done,
    updatedAt:Date.now()
  };
  childRoutineTouch(id);
}


function childRoutineFixedItems(id){
  const data=personalRoutineSentencesFor(String(id));
  const result=[];

  Object.entries(data||{}).forEach(([part,rows])=>{
    (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
      const text=String(row?.text||"").trim();
      if(!text) return;
      result.push({
        id:`fixed__${id}__${part}__${String(row?.step||index)}`,
        part,
        title:text,
        url:"",
        day:"daily",
        sticky:true,
        isFixedSentence:true,
        order:index
      });
    });
  });
  return result;
}

function childRoutinePersonName(id){
  return id==="1" ? (familyName("c")||"Lou") : (familyName("d")||"Fina");
}

function childRoutineTitle(id){
  return id==="2" ? "Meine Tageshelfer" : "Meine Routinen";
}

function childRoutineSubtitle(id){
  return id==="2"
    ? "Kleine Dinge, die mir morgens, in der Schule und abends guttun."
    : "Was mir hilft, ruhig und klar durch meinen Tag zu gehen.";
}

function childRoutineSymbol(part){
  return {
    morning:"❧",
    school:"☼",
    afterschool:"❉",
    evening:"☾✦"
  }[part] || "✦";
}

function childRoutineMondayForOffset(offset=0){
  const monday=getMonday(new Date());
  monday.setDate(monday.getDate()+Number(offset||0)*7);
  monday.setHours(12,0,0,0);
  return monday;
}

function ensureChildRoutineDialog(){
  let dialog=document.querySelector("#childRoutineDialog");
  if(dialog) return dialog;

  dialog=document.createElement("dialog");
  dialog.id="childRoutineDialog";
  dialog.className="child-routine-dialog";
  dialog.innerHTML=`
    <div class="child-routine-shell">
      <header class="child-routine-hero">
        <div>
          <span class="child-routine-kicker">MEIN TAG</span>
          <h2 id="childRoutineDialogTitle">Meine Routinen</h2>
          <p id="childRoutineDialogSubtitle"></p>
        </div>
        <div class="child-routine-hero-mark" id="childRoutinePersonalSign" aria-hidden="true"></div>
        <button id="closeChildRoutineDialog" class="child-routine-close" type="button" aria-label="Schließen">×</button>
      </header>

      <div class="child-routine-week-tabs">
        <button type="button" data-child-routine-week="0" class="active">Diese Woche</button>
        <button type="button" data-child-routine-week="1">Nächste Woche</button>
        <button type="button" data-child-routine-week="2">+2 Wochen</button>
        <button type="button" data-child-routine-week="3">+3 Wochen</button>
        <button type="button" data-child-routine-week="4">+4 Wochen</button>
      </div>

      <div id="childRoutineAreaCards" class="child-routine-area-cards"></div>

      <section class="child-routine-week-plan">
        <div class="child-routine-week-plan-head">
          <span>Meine Woche</span>
          <small id="childRoutineWeekLabel"></small>
        </div>
        <div id="childRoutineWeekGrid" class="child-routine-week-grid"></div>
      </section>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.querySelector("#closeChildRoutineDialog")?.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{
    if(e.target===dialog) dialog.close();
  });

  dialog.querySelectorAll("[data-child-routine-week]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      activeChildRoutineWeekOffset=Number(btn.dataset.childRoutineWeek||0);
      renderChildRoutineDialog();
    });
  });

  dialog.addEventListener("change",e=>{
    const checkbox=e.target.closest("[data-child-routine-check]");
    if(!checkbox) return;
    const itemId=checkbox.dataset.childRoutineCheck;
    const date=new Date(`${checkbox.dataset.date}T12:00:00`);
    setChildRoutineCompletion(activeChildRoutineId,itemId,date,checkbox.checked);
    renderChildRoutineDialog();
  });

  return dialog;
}

function renderChildRoutineDialog(){
  const dialog=ensureChildRoutineDialog();
  const id=activeChildRoutineId;
  const store=childRoutineStore(id);
  const weekKey=childRoutineWeekKey(activeChildRoutineWeekOffset);
  const labels=store.areaLabels||childRoutineDefaultAreas;

  dialog.dataset.child=id;
  dialog.querySelector("#childRoutineDialogTitle").textContent=childRoutineTitle(id);
  dialog.querySelector("#childRoutineDialogSubtitle").textContent=childRoutineSubtitle(id);

  const routinePersonalSign=dialog.querySelector("#childRoutinePersonalSign");
  if(routinePersonalSign){
    const memberKey=schoolMemberKey(id);
    const selectedIcon=state.familySettings[memberKey]?.icon || (id==="1"?"⭐":"🌙");
    routinePersonalSign.innerHTML=schoolPersonalIconMarkup(selectedIcon);
    routinePersonalSign.setAttribute("title",schoolPersonalIconLabel(selectedIcon));
  }

  dialog.querySelectorAll("[data-child-routine-week]").forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.childRoutineWeek||0)===activeChildRoutineWeekOffset);
  });

  const plannedWeekItems=store.items
    .filter(item=>childRoutineAppliesToWeek(item,weekKey))
    .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

  /* Feste persönliche Routinen aus "Unser Überblick → Routinen"
     stehen zusätzlich zu den wochenweise geplanten Punkten in der Kinderansicht. */
  const weekItems=[
    ...childRoutineFixedItems(id),
    ...plannedWeekItems
  ];

  const areaHost=dialog.querySelector("#childRoutineAreaCards");
  areaHost.innerHTML=Object.keys(childRoutineDefaultAreas).map(part=>{
    const items=weekItems.filter(item=>(item.part||"morning")===part);
    return `
      <article class="child-routine-area-card">
        <div class="child-routine-area-title">
          <span class="child-routine-area-symbol">${childRoutineSymbol(part)}</span>
          <strong>${escapeHtml(labels[part]||childRoutineDefaultAreas[part])}</strong>
        </div>
        ${items.length
          ? `<div class="child-routine-area-list">
              ${items.map(item=>`
                <div class="child-routine-area-line">
                  <span>◇</span>
                  ${item.url
                    ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>`
                    : `<span>${escapeHtml(item.title)}</span>`}
                </div>
              `).join("")}
            </div>`
          : `<div class="child-routine-empty-area">☾ <span>✦</span></div>`
        }
      </article>`;
  }).join("");

  const monday=childRoutineMondayForOffset(activeChildRoutineWeekOffset);
  const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  const grid=dialog.querySelector("#childRoutineWeekGrid");

  grid.innerHTML=names.map((name,index)=>{
    const date=new Date(monday);
    date.setDate(monday.getDate()+index);
    const dayItems=weekItems.filter(item=>childRoutineAppliesToDate(item,date));

    return `<section class="child-routine-day ${dateKey(date)===dateKey(new Date())?"is-today":""}">
      <div class="child-routine-day-head">
        <strong>${name}</strong>
        <small>${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</small>
      </div>
      <div class="child-routine-day-body">
        ${dayItems.length
          ? dayItems.map(item=>{
              const done=!!childRoutineCompletion(id,item.id,date)?.done;
              return `<label class="child-routine-day-item ${done?"is-done":""}">
                <input type="checkbox"
                       data-child-routine-check="${escapeHtml(item.id)}"
                       data-date="${dateKey(date)}"
                       ${done?"checked":""}>
                <span class="child-routine-day-item-symbol">${childRoutineSymbol(item.part||"morning")}</span>
                <span>${escapeHtml(item.title)}${item.url?`<small class="child-routine-video-topic">${escapeHtml(childRoutineVideoCategoryLabel(id,item.category||"none"))}</small>`:""}</span>
              </label>`;
            }).join("")
          : `<div class="child-routine-day-empty" aria-label="Nichts geplant">☾ <span>✦</span></div>`
        }
      </div>
    </section>`;
  }).join("");

  const label=dialog.querySelector("#childRoutineWeekLabel");
  if(label){
    label.textContent=
      activeChildRoutineWeekOffset===0 ? "Diese Woche" :
      activeChildRoutineWeekOffset===1 ? "Nächste Woche" :
      `+${activeChildRoutineWeekOffset} Wochen`;
  }
}

document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-school-open-routines]");
  if(!btn) return;
  activeChildRoutineId=String(btn.dataset.schoolOpenRoutines||"1");
  activeChildRoutineWeekOffset=0;
  renderChildRoutineDialog();
  ensureChildRoutineDialog().showModal();
});

/* =========================================================
   Unser Überblick – Kinder-Routinen bearbeiten
   ========================================================= */

function childRoutineVideoCategories(id){
  return String(id)==="1"
    ? [
        ["none","Kein Video"],
        ["clean","Clean Girl & Selfcare"],
        ["hair","Frisuren & Haare"],
        ["food","Essen & Snacks"],
        ["movement","Bewegung & Fitness"],
        ["calm","Entspannung & Selfcare"],
        ["focus","Lernen & Fokus"],
        ["reset","Ordnung & Reset"],
        ["other","Sonstiges"]
      ]
    : [
        ["none","Kein Video"],
        ["move","Bewegung & Tanz"],
        ["creative","Basteln & Kreativzeit"],
        ["calm","Kinder-Yoga & Entspannung"],
        ["ready","Fertigmachen & Haare"],
        ["food","Essen & Snacks"],
        ["tidy","Aufräumen & Zimmer"],
        ["learn","Lesen & Lernen"],
        ["other","Sonstiges"]
      ];
}
function childRoutineVideoCategoryLabel(id,key){
  return (childRoutineVideoCategories(id).find(row=>row[0]===key)||["","Sonstiges"])[1];
}

function ensureChildRoutineOverviewEditor(){
  const anchor=document.querySelector("#personalRoutineSentenceSettings");
  if(!anchor) return null;

  let section=document.querySelector("#childRoutineOverviewEditor");
  if(!section){
    section=document.createElement("section");
    section.id="childRoutineOverviewEditor";
    section.className="child-routine-overview-editor";
    anchor.insertAdjacentElement("afterend",section);
  }
  return section;
}

function resetChildRoutineEditorForm(section){
  editingChildRoutineItemId=null;
  const title=section.querySelector("#childRoutineEditorTitle");
  const url=section.querySelector("#childRoutineEditorUrl");
  const part=section.querySelector("#childRoutineEditorPart");
  const day=section.querySelector("#childRoutineEditorDay");
  const category=section.querySelector("#childRoutineEditorCategory");
  const sticky=section.querySelector("#childRoutineEditorSticky");
  if(title) title.value="";
  if(url) url.value="";
  if(part) part.value="morning";
  if(day) day.value="daily";
  if(category) category.value="none";
  if(sticky) sticky.checked=false;
  const saveBtn=section.querySelector("#saveChildRoutineEditorItem");
  if(saveBtn) saveBtn.textContent="+ Routinepunkt";
  section.querySelector("#cancelChildRoutineEditorEdit")?.classList.add("hidden");
}

function renderChildRoutineOverviewEditor(){
  const section=ensureChildRoutineOverviewEditor();
  if(!section) return;

  ensureChildRoutinePlans();

  const id=activeChildRoutineEditorId;
  const store=childRoutineStore(id);
  const weekKey=childRoutineWeekKey(activeChildRoutineEditorWeekOffset);
  const items=store.items
    .filter(item=>childRoutineAppliesToWeek(item,weekKey))
    .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

  section.innerHTML=`
    <div class="personal-subject-settings-head">
      <strong>Routinen planen</strong>
      <small>Lou und Fina sehen ihre Routinen nur in ihrem Bereich. Bearbeitet und geplant wird hier.</small>
    </div>

    <div class="child-routine-editor-person-tabs">
      ${["1","2"].map(child=>`
        <button type="button"
                data-child-routine-editor-person="${child}"
                class="${id===child?"active":""}">
          ${escapeHtml(childRoutinePersonName(child))}
        </button>
      `).join("")}
    </div>

    <div class="child-routine-editor-week-tabs">
      ${[0,1,2,3,4].map(offset=>`
        <button type="button"
                data-child-routine-editor-week="${offset}"
                class="${activeChildRoutineEditorWeekOffset===offset?"active":""}">
          ${offset===0?"Diese Woche":offset===1?"Nächste Woche":`+${offset} Wochen`}
        </button>
      `).join("")}
    </div>

    <div class="child-routine-editor-form">
      <label>Bereich
        <select id="childRoutineEditorPart">
          ${Object.entries(store.areaLabels||childRoutineDefaultAreas).map(([key,label])=>
            `<option value="${key}">${escapeHtml(label)}</option>`
          ).join("")}
        </select>
      </label>
      <label class="child-routine-editor-title-field">Punkt
        <input id="childRoutineEditorTitle" type="text" placeholder="z. B. 5 Minuten lesen, Atemübung …">
      </label>
      <label>Link – optional
        <input id="childRoutineEditorUrl" type="url" placeholder="https://…">
      </label>
      <label>Video-Thema
        <select id="childRoutineEditorCategory">
          ${childRoutineVideoCategories(id).map(([value,label])=>
            `<option value="${value}">${escapeHtml(label)}</option>`
          ).join("")}
        </select>
      </label>
      <label>Tag
        <select id="childRoutineEditorDay">
          <option value="daily">Täglich</option>
          ${["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]
            .map(day=>`<option value="${day}">${day}</option>`).join("")}
        </select>
      </label>
      <label class="child-routine-editor-sticky">
        <input id="childRoutineEditorSticky" type="checkbox">
        <span>Bleibt jede Woche</span>
      </label>
      <button id="saveChildRoutineEditorItem" class="secondary-btn" type="button">+ Routinepunkt</button>
      <button id="cancelChildRoutineEditorEdit" class="text-btn hidden" type="button">Abbrechen</button>
    </div>

    <div class="child-routine-editor-list">
      ${items.length
        ? items.map(item=>`
          <div class="child-routine-editor-row">
            <span class="child-routine-editor-row-symbol">${childRoutineSymbol(item.part||"morning")}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>
                ${escapeHtml(store.areaLabels[item.part]||childRoutineDefaultAreas[item.part]||"")}
                · ${item.day==="daily"?"täglich":escapeHtml(item.day)}
                ${item.url?` · ${escapeHtml(childRoutineVideoCategoryLabel(id,item.category||"none"))}`:""}
                ${item.sticky?" · jede Woche":""}
              </small>
            </div>
            <button type="button" data-edit-child-routine="${escapeHtml(item.id)}" title="Bearbeiten">✎</button>
            <button type="button" data-delete-child-routine="${escapeHtml(item.id)}" title="Löschen">×</button>
          </div>
        `).join("")
        : `<div class="child-routine-editor-empty">Noch nichts geplant. Die Kinderansicht startet bewusst leer.</div>`
      }
    </div>
  `;

  section.querySelectorAll("[data-child-routine-editor-person]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      activeChildRoutineEditorId=btn.dataset.childRoutineEditorPerson;
      activeChildRoutineEditorWeekOffset=0;
      editingChildRoutineItemId=null;
      renderChildRoutineOverviewEditor();
    });
  });

  section.querySelectorAll("[data-child-routine-editor-week]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      activeChildRoutineEditorWeekOffset=Number(btn.dataset.childRoutineEditorWeek||0);
      editingChildRoutineItemId=null;
      renderChildRoutineOverviewEditor();
    });
  });

  section.querySelector("#saveChildRoutineEditorItem")?.addEventListener("click",()=>{
    const title=section.querySelector("#childRoutineEditorTitle")?.value.trim()||"";
    if(!title){
      showMotivation("Bitte zuerst einen Routinepunkt eintragen.");
      return;
    }

    const store=childRoutineStore(activeChildRoutineEditorId);
    const now=Date.now();
    const data={
      part:section.querySelector("#childRoutineEditorPart")?.value||"morning",
      title,
      url:section.querySelector("#childRoutineEditorUrl")?.value.trim()||"",
      category:section.querySelector("#childRoutineEditorCategory")?.value||"none",
      day:section.querySelector("#childRoutineEditorDay")?.value||"daily",
      sticky:!!section.querySelector("#childRoutineEditorSticky")?.checked,
      weekKey:childRoutineWeekKey(activeChildRoutineEditorWeekOffset),
      updatedAt:now
    };

    if(editingChildRoutineItemId){
      const item=store.items.find(x=>x.id===editingChildRoutineItemId);
      if(item) Object.assign(item,data);
    }else{
      store.items.push({
        id:uid(),
        ...data,
        createdAt:now,
        order:store.items.length
      });
    }

    childRoutineTouch(activeChildRoutineEditorId);
    editingChildRoutineItemId=null;
    renderChildRoutineOverviewEditor();
  });

  section.querySelector("#cancelChildRoutineEditorEdit")?.addEventListener("click",()=>{
    editingChildRoutineItemId=null;
    renderChildRoutineOverviewEditor();
  });

  section.querySelectorAll("[data-edit-child-routine]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const item=childRoutineStore(activeChildRoutineEditorId).items
        .find(x=>x.id===btn.dataset.editChildRoutine);
      if(!item) return;
      editingChildRoutineItemId=item.id;
      section.querySelector("#childRoutineEditorPart").value=item.part||"morning";
      section.querySelector("#childRoutineEditorTitle").value=item.title||"";
      section.querySelector("#childRoutineEditorUrl").value=item.url||"";
      section.querySelector("#childRoutineEditorCategory").value=item.category||"none";
      section.querySelector("#childRoutineEditorDay").value=item.day||"daily";
      section.querySelector("#childRoutineEditorSticky").checked=!!item.sticky;
      section.querySelector("#saveChildRoutineEditorItem").textContent="Änderung speichern";
      section.querySelector("#cancelChildRoutineEditorEdit").classList.remove("hidden");
      section.querySelector("#childRoutineEditorTitle")?.focus();
    });
  });

  section.querySelectorAll("[data-delete-child-routine]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const store=childRoutineStore(activeChildRoutineEditorId);
      const id=btn.dataset.deleteChildRoutine;
      const item=store.items.find(x=>x.id===id);
      if(!item) return;
      store.tombstones[id]=Date.now();
      store.items=store.items.filter(x=>x.id!==id);
      Object.keys(store.completions||{}).forEach(key=>{
        if(key.startsWith(`${id}__`)) delete store.completions[key];
      });
      childRoutineTouch(activeChildRoutineEditorId);
      renderChildRoutineOverviewEditor();
    });
  });
}

ensureChildRoutinePlans();
renderChildRoutineOverviewEditor();
requestAnimationFrame(renderChildRoutineOverviewEditor);
setTimeout(renderChildRoutineOverviewEditor,220);



/* =========================================================
   V64 – Tagesausrichtung / Qualitäten pro Person
   Mama: „Welche Qualität möchte ich heute leben?“
   Lou:  „Wie möchte ich heute durch meinen Tag gehen?“
   Fina: „Wie möchte ich heute sein?“
   Komplett ausblendbar; Begriffe frei änderbar/löschbar/ergänzbar.
   ========================================================= */

const defaultPersonalDailyFocus = {
  mama:{
    enabled:true,
    question:"Welche Qualität möchte ich heute leben?",
    qualities:["Ruhe","Leichtigkeit","Klarheit","Geduld","Mut","Freundlichkeit","Gelassenheit","Vertrauen","Präsenz"]
  },
  "1":{
    enabled:true,
    question:"Wie möchte ich heute durch meinen Tag gehen?",
    qualities:["ruhig","mutig","konzentriert","freundlich","selbstbewusst","geduldig","gelassen","neugierig","gut zu mir"]
  },
  "2":{
    enabled:true,
    question:"Wie möchte ich heute sein?",
    qualities:["fröhlich","mutig","ruhig","freundlich","aufmerksam","geduldig","hilfsbereit","neugierig","stark"]
  }
};

function ensurePersonalDailyFocus(){
  state.familySettings=state.familySettings||{};
  state.familySettings.personalDailyFocus=
    state.familySettings.personalDailyFocus && typeof state.familySettings.personalDailyFocus==="object"
      ? state.familySettings.personalDailyFocus : {};

  ["mama","1","2"].forEach(id=>{
    const def=defaultPersonalDailyFocus[id];
    const cur=state.familySettings.personalDailyFocus[id];
    if(!cur || typeof cur!=="object"){
      state.familySettings.personalDailyFocus[id]={...def,qualities:[...def.qualities]};
      return;
    }
    if(typeof cur.enabled!=="boolean") cur.enabled=def.enabled;
    if(!String(cur.question||"").trim()) cur.question=def.question;
    if(!Array.isArray(cur.qualities)) cur.qualities=[...def.qualities];
    cur.qualities=cur.qualities.map(x=>String(x||"").trim()).filter(Boolean);
  });
  return state.familySettings.personalDailyFocus;
}

function personalDailyFocusFor(id){
  return ensurePersonalDailyFocus()[String(id)] || ensurePersonalDailyFocus().mama;
}

function applyMamaDailyFocus(){
  const cfg=personalDailyFocusFor("mama");
  const block=document.querySelector('.routine-quality-block');
  if(!block) return;
  block.style.display=cfg.enabled?"":"none";
  const title=block.querySelector('.routine-quality-title');
  if(title) title.textContent=cfg.question;
  const cloud=block.querySelector('.routine-quality-cloud');
  if(cloud){
    cloud.innerHTML=cfg.qualities.map(q=>`<button type="button" data-quality="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
    if(typeof syncRoutineInspirationChecks==="function") syncRoutineInspirationChecks();
  }
}

function dailyFocusEditorMarkup(id){
  const cfg=personalDailyFocusFor(id);
  return `
    <div class="personal-daily-focus-settings" data-daily-focus-editor="${id}">
      <div class="personal-daily-focus-head">
        <div>
          <strong>Tagesausrichtung</strong>
          <small>Optional – ausgeschaltet erscheint dieser Bereich in „Meine Routinen“ gar nicht.</small>
        </div>
        <label class="personal-daily-focus-toggle">
          <input type="checkbox" data-daily-focus-enabled ${cfg.enabled?"checked":""}>
          <span>Anzeigen</span>
        </label>
      </div>
      <label class="personal-daily-focus-question">
        <span>Frage</span>
        <input type="text" data-daily-focus-question value="${escapeHtml(cfg.question)}">
      </label>
      <div class="personal-daily-focus-quality-list">
        ${cfg.qualities.map((q,i)=>`
          <div class="personal-daily-focus-quality-row" data-quality-index="${i}">
            <input type="text" value="${escapeHtml(q)}" aria-label="Qualität ${i+1}">
            <button type="button" data-delete-daily-quality title="Qualität löschen">×</button>
          </div>`).join("")}
      </div>
      <button type="button" class="personal-daily-focus-add" data-add-daily-quality>+ Qualität hinzufügen</button>
    </div>`;
}

function bindDailyFocusEditor(panel,id){
  const editor=panel.querySelector(`[data-daily-focus-editor="${id}"]`);
  if(!editor) return;
  const cfg=personalDailyFocusFor(id);
  const refresh=()=>{
    save();
    if(id==="mama") applyMamaDailyFocus();
    if((id==="1"||id==="2") && document.querySelector("#childRoutineDialog")?.open && activeChildRoutineId===id){
      renderChildRoutineDialog();
    }
  };
  editor.querySelector('[data-daily-focus-enabled]')?.addEventListener('change',e=>{
    cfg.enabled=!!e.target.checked; refresh();
  });
  editor.querySelector('[data-daily-focus-question]')?.addEventListener('change',e=>{
    const v=e.target.value.trim(); cfg.question=v||defaultPersonalDailyFocus[id].question; e.target.value=cfg.question; refresh();
  });
  editor.querySelectorAll('.personal-daily-focus-quality-row input').forEach(input=>{
    input.addEventListener('change',()=>{
      const row=input.closest('[data-quality-index]');
      const i=Number(row?.dataset.qualityIndex);
      const v=input.value.trim();
      if(!Number.isFinite(i)) return;
      if(!v){ input.value=cfg.qualities[i]||""; return; }
      cfg.qualities[i]=v; refresh();
    });
  });
  editor.querySelectorAll('[data-delete-daily-quality]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const row=btn.closest('[data-quality-index]');
      const i=Number(row?.dataset.qualityIndex);
      if(!Number.isFinite(i)) return;
      cfg.qualities.splice(i,1); save(); renderPersonalRoutineSentenceSettings();
      const s=document.querySelector('#personalRoutineSentenceSettings');
      s?.querySelectorAll('.personal-routine-person-tab').forEach(t=>t.classList.toggle('active',t.dataset.routinePerson===id));
      s?.querySelectorAll('.personal-routine-person-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.routinePersonPanel!==id));
      if(id==="mama") applyMamaDailyFocus();
    });
  });
  editor.querySelector('[data-add-daily-quality]')?.addEventListener('click',()=>{
    cfg.qualities.push(id==="2"?"neue Stärke":"neue Qualität"); save(); renderPersonalRoutineSentenceSettings();
    const s=document.querySelector('#personalRoutineSentenceSettings');
    s?.querySelectorAll('.personal-routine-person-tab').forEach(t=>t.classList.toggle('active',t.dataset.routinePerson===id));
    s?.querySelectorAll('.personal-routine-person-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.routinePersonPanel!==id));
  });
}

const _renderPersonalRoutineSentenceSettingsV64=renderPersonalRoutineSentenceSettings;
renderPersonalRoutineSentenceSettings=function(){
  _renderPersonalRoutineSentenceSettingsV64();
  ensurePersonalDailyFocus();
  document.querySelectorAll('#personalRoutineSentenceSettings [data-routine-person-panel]').forEach(panel=>{
    const id=panel.dataset.routinePersonPanel;
    if(!panel.querySelector('[data-daily-focus-editor]')){
      panel.insertAdjacentHTML('afterbegin',dailyFocusEditorMarkup(id));
      bindDailyFocusEditor(panel,id);
    }
  });
  applyMamaDailyFocus();
};

const _renderChildRoutineDialogV64=renderChildRoutineDialog;
renderChildRoutineDialog=function(){
  _renderChildRoutineDialogV64();
  const dialog=document.querySelector('#childRoutineDialog');
  if(!dialog) return;
  const id=activeChildRoutineId;
  const cfg=personalDailyFocusFor(id);
  let focus=dialog.querySelector('.child-routine-daily-focus');
  if(!cfg.enabled){ focus?.remove(); return; }
  if(!focus){
    focus=document.createElement('section');
    focus.className='child-routine-daily-focus';
    dialog.querySelector('.child-routine-area-cards')?.insertAdjacentElement('beforebegin',focus);
  }
  focus.innerHTML=`
    <div class="child-routine-daily-focus-question">${escapeHtml(cfg.question)}</div>
    <div class="child-routine-daily-focus-chips">
      ${cfg.qualities.map(q=>`<button type="button" data-child-daily-quality="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
    </div>`;

  const dayKey=`childDailyFocus__${id}__${dateKey(new Date())}`;
  const selected=String(state.familySettings?.childDailyFocusSelections?.[dayKey]||"");
  focus.querySelectorAll('[data-child-daily-quality]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.childDailyQuality===selected);
    btn.addEventListener('click',()=>{
      state.familySettings.childDailyFocusSelections=state.familySettings.childDailyFocusSelections||{};
      state.familySettings.childDailyFocusSelections[dayKey]=
        state.familySettings.childDailyFocusSelections[dayKey]===btn.dataset.childDailyQuality ? "" : btn.dataset.childDailyQuality;
      save(); renderChildRoutineDialog();
    });
  });
};

/* Alte Tagesmarkierungen nach 03:00 Uhr nicht weiterführen. */
function cleanupChildDailyFocusSelections(){
  ensurePersonalDailyFocus();
  const map=state.familySettings.childDailyFocusSelections||{};
  const now=new Date();
  const logical=new Date(now);
  if(now.getHours()<3) logical.setDate(logical.getDate()-1);
  const keep=dateKey(logical);
  Object.keys(map).forEach(k=>{ if(!k.endsWith(`__${keep}`)) delete map[k]; });
}

ensurePersonalDailyFocus();
cleanupChildDailyFocusSelections();
setTimeout(()=>{
  renderPersonalRoutineSentenceSettings();
  applyMamaDailyFocus();
},0);

/* =========================================================
   V64 – Kinder-Routinen: gleiche Zeichenlogik + kompakte Bedienung
   Änderungen gelten für Lou UND Fina.
   ========================================================= */
(function(){
  function childSelectedIcon(id){
    const memberKey=schoolMemberKey(String(id));
    return state.familySettings?.[memberKey]?.icon || (String(id)==="1"?"⭐":"🌙");
  }

  function refreshChildRoutineSigns(){
    ["1","2"].forEach(id=>{
      const icon=childSelectedIcon(id);
      document.querySelectorAll(`[data-school-open-routines="${id}"] .school-routine-symbol`).forEach(el=>{
        el.innerHTML=schoolPersonalIconMarkup(icon);
        el.setAttribute("title",schoolPersonalIconLabel(icon));
      });
    });
    const dialog=document.querySelector("#childRoutineDialog");
    if(dialog?.open){
      const id=String(dialog.dataset.child||activeChildRoutineId||"1");
      const mark=dialog.querySelector("#childRoutinePersonalSign");
      if(mark){
        const icon=childSelectedIcon(id);
        mark.innerHTML=schoolPersonalIconMarkup(icon);
        mark.setAttribute("title",schoolPersonalIconLabel(icon));
      }
    }
  }

  window.refreshChildRoutineSigns=refreshChildRoutineSigns;
  refreshChildRoutineSigns();
  requestAnimationFrame(refreshChildRoutineSigns);
  setTimeout(refreshChildRoutineSigns,250);

  /* Nach einer Zeichenwahl beide Stellen sofort synchronisieren. */
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-school-icon], .school-icon-option, .school-sign-option, [data-personal-icon]")){
      setTimeout(refreshChildRoutineSigns,0);
      setTimeout(refreshChildRoutineSigns,120);
    }
  });

  /* Kinderansicht bewusst neu rendern:
     - vier feste Bereiche = heutige Routinen, dort direkt abhaken
     - Bereiche lassen sich einzeln ein-/ausklappen
     - Wochenraster zeigt NUR zusätzlich geplante Wochenpunkte
       und wiederholt nicht sämtliche festen Routinen an jedem Tag. */
  const originalRenderChildRoutineDialog=window.renderChildRoutineDialog || renderChildRoutineDialog;
  renderChildRoutineDialog=function(){
    const dialog=ensureChildRoutineDialog();
    const id=activeChildRoutineId;
    const store=childRoutineStore(id);
    const weekKey=childRoutineWeekKey(activeChildRoutineWeekOffset);
    const labels=store.areaLabels||childRoutineDefaultAreas;

    dialog.dataset.child=id;
    dialog.querySelector("#childRoutineDialogTitle").textContent=childRoutineTitle(id);
    dialog.querySelector("#childRoutineDialogSubtitle").textContent=childRoutineSubtitle(id);
    refreshChildRoutineSigns();

    dialog.querySelectorAll("[data-child-routine-week]").forEach(btn=>{
      btn.classList.toggle("active",Number(btn.dataset.childRoutineWeek||0)===activeChildRoutineWeekOffset);
    });

    const fixedItems=childRoutineFixedItems(id);
    const plannedWeekItems=store.items
      .filter(item=>childRoutineAppliesToWeek(item,weekKey))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    const today=new Date();
    today.setHours(12,0,0,0);
    const areaHost=dialog.querySelector("#childRoutineAreaCards");
    areaHost.innerHTML=Object.keys(childRoutineDefaultAreas).map(part=>{
      const items=fixedItems.filter(item=>(item.part||"morning")===part);
      return `
        <details class="child-routine-area-card" open>
          <summary class="child-routine-area-title">
            <span class="child-routine-area-symbol">${childRoutineSymbol(part)}</span>
            <strong>${escapeHtml(labels[part]||childRoutineDefaultAreas[part])}</strong>
            <span class="child-routine-area-chevron" aria-hidden="true">⌄</span>
          </summary>
          ${items.length
            ? `<div class="child-routine-area-list">
                ${items.map(item=>{
                  const done=!!childRoutineCompletion(id,item.id,today)?.done;
                  return `<label class="child-routine-area-line ${done?"is-done":""}">
                    <input type="checkbox"
                           data-child-routine-check="${escapeHtml(item.id)}"
                           data-date="${dateKey(today)}"
                           ${done?"checked":""}>
                    <span class="child-routine-area-checkmark" aria-hidden="true"></span>
                    <span>${escapeHtml(item.title)}</span>
                  </label>`;
                }).join("")}
              </div>`
            : `<div class="child-routine-empty-area">☾ <span>✦</span></div>`
          }
        </details>`;
    }).join("");

    const monday=childRoutineMondayForOffset(activeChildRoutineWeekOffset);
    const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
    const grid=dialog.querySelector("#childRoutineWeekGrid");
    grid.innerHTML=names.map((name,index)=>{
      const date=new Date(monday);
      date.setDate(monday.getDate()+index);
      const dayItems=plannedWeekItems.filter(item=>childRoutineAppliesToDate(item,date));
      return `<section class="child-routine-day ${dateKey(date)===dateKey(new Date())?"is-today":""}">
        <div class="child-routine-day-head">
          <strong>${name}</strong>
          <small>${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</small>
        </div>
        <div class="child-routine-day-body">
          ${dayItems.length
            ? dayItems.map(item=>{
                const done=!!childRoutineCompletion(id,item.id,date)?.done;
                return `<label class="child-routine-day-item ${done?"is-done":""}">
                  <input type="checkbox" data-child-routine-check="${escapeHtml(item.id)}" data-date="${dateKey(date)}" ${done?"checked":""}>
                  <span class="child-routine-day-item-symbol">${childRoutineSymbol(item.part||"morning")}</span>
                  <span>${escapeHtml(item.title)}</span>
                </label>`;
              }).join("")
            : `<div class="child-routine-day-empty" aria-label="Nichts geplant">☾ <span>✦</span></div>`
          }
        </div>
      </section>`;
    }).join("");

    const label=dialog.querySelector("#childRoutineWeekLabel");
    if(label){
      label.textContent=activeChildRoutineWeekOffset===0?"Diese Woche":activeChildRoutineWeekOffset===1?"Nächste Woche":`+${activeChildRoutineWeekOffset} Wochen`;
    }
    if(typeof renderChildDailyFocusInDialog==="function") renderChildDailyFocusInDialog();
  };
  window.renderChildRoutineDialog=renderChildRoutineDialog;

  /* Editor im Überblick an Mamas Wochenplanung angleichen:
     Woche wird ausschließlich über die Reiter gewählt – kein doppeltes Wochenfeld. */
  const oldOverviewRender=window.renderChildRoutineOverviewEditor || renderChildRoutineOverviewEditor;
  renderChildRoutineOverviewEditor=function(){
    oldOverviewRender();
    const section=document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;
    const weekField=section.querySelector("#childRoutineEditorWeek")?.closest("label");
    if(weekField) weekField.remove();
    const hint=section.querySelector(".personal-subject-settings-head small");
    if(hint) hint.textContent="Zusätzliche Punkte für die gewählte Woche planen. Die festen Routinen darüber bleiben davon unabhängig.";
    const title=section.querySelector(".personal-subject-settings-head strong");
    if(title) title.textContent="Wochenplanung";
  };
  window.renderChildRoutineOverviewEditor=renderChildRoutineOverviewEditor;
  renderChildRoutineOverviewEditor();

  /* Der vorhandene Speichercode darf trotz entferntem Wochen-Select weiterlaufen:
     er verwendet bereits activeChildRoutineEditorWeekOffset als Fallback. */
  setTimeout(refreshChildRoutineSigns,400);
})();

/* =========================================================
   V65 – Kinder-Routinen konsolidiert
   Lou + Fina: gleicher Grundaufbau, nur altersgerechte Inhalte/Themen verschieden.
   ========================================================= */
(function(){

  /* ---------- 1) Starterdaten einmal sauber vereinheitlichen ---------- */
  function migrateChildRoutineStarterPacks(){
    state.familySettings = state.familySettings || {};
    state.familySettings.routineStarterVersions =
      state.familySettings.routineStarterVersions &&
      typeof state.familySettings.routineStarterVersions === "object"
        ? state.familySettings.routineStarterVersions
        : {};

    ensurePersonalRoutineSentences();

    const migrateOne=(id, source, versionKey, targetVersion)=>{
      if(Number(state.familySettings.routineStarterVersions[versionKey]||0) >= targetVersion) return;

      const current=personalRoutineSentencesFor(id);
      const custom={};

      Object.entries(current||{}).forEach(([area,rows])=>{
        custom[area]=(Array.isArray(rows)?rows:[])
          .filter(row=>String(row?.step||"").startsWith("custom-"))
          .map(row=>({...row}));
      });

      const fresh=cloneRoutineSet(source);
      Object.keys(fresh).forEach(area=>{
        fresh[area].push(...(custom[area]||[]));
      });

      state.familySettings.personalRoutineSentences[id]=fresh;
      state.familySettings.routineStarterVersions[versionKey]=targetVersion;
    };

    migrateOne("1", defaultLouRoutineSentences, "lou", 2);
    migrateOne("2", defaultFinaRoutineSentences, "fina", 2);

    persistFamilySettingsImmediately?.();
    save();
  }

  migrateChildRoutineStarterPacks();

  /* ---------- 2) Persönliches Zeichen an ALLEN drei Stellen ---------- */
  function currentChildPersonalIcon(id){
    const key=schoolMemberKey(String(id));
    return state.familySettings?.[key]?.icon || (String(id)==="1" ? "⭐" : "🌙");
  }

  function syncChildPersonalSigns(){
    ["1","2"].forEach(id=>{
      const icon=currentChildPersonalIcon(id);
      const markup=schoolPersonalIconMarkup(icon);
      const label=schoolPersonalIconLabel(icon);

      /* Routinen-Kachel */
      document.querySelectorAll(`[data-school-open-routines="${id}"] .school-routine-symbol`)
        .forEach(el=>{
          el.innerHTML=markup;
          el.title=label;
        });

      /* großes Zeichen im Kinder-Header */
      document.querySelectorAll(`[data-school-timetable-link="${id}"]`)
        .forEach(el=>{
          el.innerHTML=markup;
          el.title=label;
          el.setAttribute("aria-label",`${childRoutinePersonName(id)} – Stundenplan ansehen`);
        });
    });

    /* Zeichen im geöffneten Routinenfenster */
    const dialog=document.querySelector("#childRoutineDialog");
    if(dialog?.open){
      const id=String(dialog.dataset.child||activeChildRoutineId||"1");
      const mark=dialog.querySelector("#childRoutinePersonalSign");
      if(mark){
        const icon=currentChildPersonalIcon(id);
        mark.innerHTML=schoolPersonalIconMarkup(icon);
        mark.title=schoolPersonalIconLabel(icon);
      }
    }
  }

  window.syncChildPersonalSigns=syncChildPersonalSigns;

  /* renderSchoolChildDashboard erzeugt die Kacheln neu -> danach erneut einsetzen */
  const renderSchoolChildDashboardBeforeV65=renderSchoolChildDashboard;
  renderSchoolChildDashboard=function(id){
    const result=renderSchoolChildDashboardBeforeV65(id);
    requestAnimationFrame(syncChildPersonalSigns);
    return result;
  };

  /* Die Auswahl läuft über pointerup, deshalb dort unabhängig vom Click synchronisieren. */
  document.addEventListener("pointerup",e=>{
    if(e.target.closest?.(".school-icon-choice")){
      requestAnimationFrame(syncChildPersonalSigns);
      setTimeout(syncChildPersonalSigns,80);
    }
  },true);

  document.addEventListener("click",e=>{
    if(e.target.closest?.(".school-icon-choice")){
      requestAnimationFrame(syncChildPersonalSigns);
      setTimeout(syncChildPersonalSigns,80);
    }
  },true);

  syncChildPersonalSigns();
  requestAnimationFrame(syncChildPersonalSigns);

  /* ---------- 3) Kinder-Routinenfenster für BEIDE exakt gleich aufbauen ---------- */
  const renderChildRoutineDialogBeforeV65=renderChildRoutineDialog;

  renderChildRoutineDialog=function(){
    renderChildRoutineDialogBeforeV65();

    const dialog=ensureChildRoutineDialog();
    const id=String(activeChildRoutineId||"1");
    dialog.dataset.child=id;

    syncChildPersonalSigns();

    /* Einheitliche Erklärung: Wochenpunkte werden bewusst im Überblick bearbeitet. */
    let note=dialog.querySelector("#childRoutinePlanningNote");
    if(!note){
      note=document.createElement("div");
      note.id="childRoutinePlanningNote";
      note.className="child-routine-planning-note";
      const plan=dialog.querySelector(".child-routine-week-plan");
      plan?.insertAdjacentElement("beforebegin",note);
    }

    note.innerHTML=`
      <span>Wochenpunkte planst du unter <strong>Unser Überblick → Routinen</strong>.</span>
      <button type="button" id="openChildRoutinePlanningFromDialog">Planung öffnen</button>
    `;

    note.querySelector("#openChildRoutinePlanningFromDialog")?.addEventListener("click",()=>{
      dialog.close();

      document.querySelector('[data-view="archive"]')?.click();

      setTimeout(()=>{
        const settings=document.querySelector("#personalRoutineSentenceSettings")?.closest("details");
        if(settings) settings.open=true;

        activeChildRoutineEditorId=id;
        activeChildRoutineEditorWeekOffset=activeChildRoutineWeekOffset;
        editingChildRoutineItemId=null;
        renderChildRoutineOverviewEditor();

        document.querySelector("#childRoutineOverviewEditor")
          ?.scrollIntoView({behavior:"smooth",block:"center"});
      },80);
    });
  };

  window.renderChildRoutineDialog=renderChildRoutineDialog;

  /* ---------- 4) Wochenplanung im Überblick: BEIDE gleiche Bedienung ---------- */
  const renderChildRoutineOverviewEditorBeforeV65=renderChildRoutineOverviewEditor;

  renderChildRoutineOverviewEditor=function(){
    renderChildRoutineOverviewEditorBeforeV65();

    const section=document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;

    const id=String(activeChildRoutineEditorId||"1");

    section.dataset.child=id;

    /* Eindeutig sichtbare Struktur wie bei Mamas Planung */
    const heading=section.querySelector(".personal-subject-settings-head");
    if(heading){
      heading.innerHTML=`
        <strong>Wochenplanung – ${escapeHtml(childRoutinePersonName(id))}</strong>
        <small>
          Woche oben wählen, Punkt eintragen und mit „+ Routinepunkt“ speichern.
          Feste Routinen werden darüber separat bearbeitet.
        </small>
      `;
    }

    /* Woche ausschließlich über die Reiter – exakt gleich für Lou/Fina */
    section.querySelector("#childRoutineEditorWeek")?.closest("label")?.remove();

    /* Einheitliche Reihenfolge und Beschriftung */
    const form=section.querySelector(".child-routine-editor-form");
    if(form){
      form.classList.add("child-routine-editor-form-unified");
    }

    const categoryLabel=section.querySelector("#childRoutineEditorCategory")?.closest("label");
    if(categoryLabel){
      categoryLabel.childNodes[0].textContent="Video-Thema ";
    }

    /* Bei keinem Link ist die Kategorie optisch optional, aber auswählbar. */
    const url=section.querySelector("#childRoutineEditorUrl");
    const category=section.querySelector("#childRoutineEditorCategory");
    const updateVideoTopicState=()=>{
      if(!category) return;
      category.closest("label")?.classList.toggle("is-muted",!String(url?.value||"").trim());
    };
    url?.addEventListener("input",updateVideoTopicState);
    updateVideoTopicState();
  };

  window.renderChildRoutineOverviewEditor=renderChildRoutineOverviewEditor;

  /* initial sauber neu rendern */
  renderPersonalRoutineSentenceSettings();
  renderChildRoutineOverviewEditor();
  syncChildPersonalSigns();

})();


/* =========================================================
   V66 – Routinenlogik final
   Unser Überblick = planen/bearbeiten
   Lou + Fina = ansehen + abhaken
   ========================================================= */
(function(){
  /* Kinderfenster bewusst frei von Bearbeitungs-/Planungszugängen halten. */
  const renderChildRoutineDialogBeforeV66 = renderChildRoutineDialog;

  renderChildRoutineDialog = function(){
    renderChildRoutineDialogBeforeV66();

    const dialog = ensureChildRoutineDialog();
    if(!dialog) return;

    /* Frühere Hinweise/Buttons zur Bearbeitung im Überblick aus dem
       Kinderfenster entfernen. Die Wochenreiter + Wochenansicht bleiben. */
    dialog.querySelector("#childRoutinePlanningNote")?.remove();
    dialog.querySelector("#openChildRoutinePlanningFromDialog")?.remove();

    /* In der Kinderansicht gibt es keine Editier-/Löschfunktionen. */
    dialog.querySelectorAll(
      ".routine-edit-btn, .routine-delete-btn, [data-child-routine-edit], [data-child-routine-delete]"
    ).forEach(el=>el.remove());

    /* Wochenpunkte bleiben anklickbar/abhakbar. */
    dialog.querySelectorAll("input[data-child-routine-check]").forEach(input=>{
      input.disabled = false;
    });
  };
  window.renderChildRoutineDialog = renderChildRoutineDialog;

  /* Im Überblick klar benennen, dass HIER geplant und bearbeitet wird. */
  const renderChildRoutineOverviewEditorBeforeV66 = renderChildRoutineOverviewEditor;

  renderChildRoutineOverviewEditor = function(){
    renderChildRoutineOverviewEditorBeforeV66();

    const section = document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;

    const id = String(activeChildRoutineEditorId || "1");
    const heading = section.querySelector(".personal-subject-settings-head");
    if(heading){
      heading.innerHTML = `
        <strong>Wochenplanung – ${escapeHtml(childRoutinePersonName(id))}</strong>
        <small>
          Hier planst und bearbeitest du die Wochenpunkte. Lou und Fina sehen
          ihre Einteilung anschließend in „Meine Routinen“ und können sie dort abhaken.
        </small>
      `;
    }

    /* Keine doppelte Wochenauswahl: ausschließlich die vorhandenen Reiter. */
    section.querySelector("#childRoutineEditorWeek")?.closest("label")?.remove();
  };
  window.renderChildRoutineOverviewEditor = renderChildRoutineOverviewEditor;

  renderChildRoutineOverviewEditor();
})();

/* =========================================================
   V67 – Kinder-Routinen: Wochenplan-Zugang + Zeichen stabil
   ========================================================= */
(function(){
  function v67CurrentChildIcon(id){
    const key=schoolMemberKey(String(id));
    return state.familySettings?.[key]?.icon || (String(id)==="1" ? "⭐" : "🌙");
  }

  function v67ApplyRoutineSigns(){
    ["1","2"].forEach(id=>{
      const icon=v67CurrentChildIcon(id);
      const markup=schoolPersonalIconMarkup(icon);
      const label=schoolPersonalIconLabel(icon);

      document.querySelectorAll(`[data-school-open-routines="${id}"] .school-routine-symbol`).forEach(el=>{
        el.innerHTML=markup;
        el.title=label;
      });
      document.querySelectorAll(`[data-school-timetable-link="${id}"]`).forEach(el=>{
        el.innerHTML=markup;
        el.title=label;
      });
    });

    const dialog=document.querySelector("#childRoutineDialog");
    if(dialog?.open || dialog?.matches?.(":modal")){
      const id=String(dialog.dataset.child || activeChildRoutineId || "1");
      const mark=dialog.querySelector("#childRoutinePersonalSign");
      if(mark){
        const icon=v67CurrentChildIcon(id);
        mark.innerHTML=schoolPersonalIconMarkup(icon);
        mark.title=schoolPersonalIconLabel(icon);
      }
    }
  }

  const beforeV67=renderChildRoutineDialog;
  renderChildRoutineDialog=function(){
    beforeV67();
    const dialog=ensureChildRoutineDialog();
    if(!dialog) return;

    requestAnimationFrame(v67ApplyRoutineSigns);

    /* Der Wochenplan bleibt unten sichtbar; daneben gibt es wieder einen klaren
       Zugang zur Eingabe im Überblick. */
    const head=dialog.querySelector(".child-routine-week-plan-head");
    if(head){
      let action=head.querySelector("#openChildRoutinePlanningV67");
      if(!action){
        action=document.createElement("button");
        action.type="button";
        action.id="openChildRoutinePlanningV67";
        action.className="child-routine-plan-link";
        action.textContent="Wochenplanung bearbeiten";
        head.appendChild(action);
      }
      action.onclick=()=>{
        const id=String(activeChildRoutineId||"1");
        const offset=Number(activeChildRoutineWeekOffset||0);
        dialog.close();
        document.querySelector('[data-view="archive"]')?.click();
        setTimeout(()=>{
          const details=document.querySelector("#personalRoutineSentenceSettings")?.closest("details");
          if(details) details.open=true;
          activeChildRoutineEditorId=id;
          activeChildRoutineEditorWeekOffset=offset;
          editingChildRoutineItemId=null;
          renderChildRoutineOverviewEditor();
          document.querySelector("#childRoutineOverviewEditor")?.scrollIntoView({behavior:"smooth",block:"center"});
        },90);
      };
    }
  };
  window.renderChildRoutineDialog=renderChildRoutineDialog;

  document.addEventListener("click",e=>{
    if(e.target.closest?.(".school-icon-choice")){
      requestAnimationFrame(v67ApplyRoutineSigns);
      setTimeout(v67ApplyRoutineSigns,120);
    }
  },true);

  requestAnimationFrame(v67ApplyRoutineSigns);
})();

/* =========================================================
   V68 – Wochenplanung im Überblick vollständig
   - sichtbare 7-Tage-Wochenansicht direkt unter dem Editor
   - Rückweg zur richtigen Kinderseite
   - Lou/Fina exakt gleiche Struktur
   ========================================================= */
(function(){

  function childRoutineOverviewWeekLabel(offset){
    return offset===0 ? "Diese Woche"
      : offset===1 ? "Nächste Woche"
      : `+${offset} Wochen`;
  }

  function childRoutineOverviewMonday(offset){
    const monday=getMonday(new Date());
    monday.setDate(monday.getDate()+Number(offset||0)*7);
    monday.setHours(12,0,0,0);
    return monday;
  }

  function childRoutineOverviewPreviewHtml(id,offset){
    const store=childRoutineStore(id);
    const weekKey=childRoutineWeekKey(offset);
    const planned=store.items
      .filter(item=>childRoutineAppliesToWeek(item,weekKey))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    const monday=childRoutineOverviewMonday(offset);
    const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
    const partLabels=store.areaLabels||childRoutineDefaultAreas;

    const days=names.map((name,index)=>{
      const date=new Date(monday);
      date.setDate(monday.getDate()+index);

      const items=planned.filter(item=>childRoutineAppliesToDate(item,date));

      return `
        <section class="child-routine-overview-day ${dateKey(date)===dateKey(new Date())?"is-today":""}">
          <header>
            <strong>${name}</strong>
            <small>${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</small>
          </header>
          <div class="child-routine-overview-day-body">
            ${items.length ? items.map(item=>`
              <div class="child-routine-overview-preview-item"
                   data-preview-routine-id="${escapeHtml(item.id)}">
                <span class="child-routine-overview-preview-symbol">${childRoutineSymbol(item.part||"morning")}</span>
                <div>
                  <strong>${escapeHtml(item.title||"Routinepunkt")}</strong>
                  <small>
                    ${escapeHtml(partLabels[item.part]||childRoutineDefaultAreas[item.part]||"")}
                    ${item.url?` · ${escapeHtml(childRoutineVideoCategoryLabel(id,item.category||"none"))}`:""}
                    ${item.sticky?" · jede Woche":""}
                  </small>
                </div>
              </div>
            `).join("") : `
              <div class="child-routine-overview-empty" aria-label="Nichts geplant">
                <span>☾</span><small>✦</small>
              </div>
            `}
          </div>
        </section>
      `;
    }).join("");

    return `
      <section class="child-routine-overview-week-preview">
        <div class="child-routine-overview-week-preview-head">
          <div>
            <strong>Wochenansicht – ${escapeHtml(childRoutinePersonName(id))}</strong>
            <small>${childRoutineOverviewWeekLabel(offset)}</small>
          </div>
          <span class="child-routine-overview-preview-hint">
            So erscheint die Einteilung anschließend bei ${escapeHtml(childRoutinePersonName(id))}.
          </span>
        </div>
        <div class="child-routine-overview-week-grid">
          ${days}
        </div>
      </section>
    `;
  }

  function openCorrectChildPageFromRoutineOverview(id){
    /* Zurück in "Für euch" */
    document.querySelector('[data-view="school"]')?.click();

    setTimeout(()=>{
      /* direkt die zuvor bearbeitete Kinderseite öffnen */
      renderSchoolChildDashboard(String(id));

      /* möglichst oben beim Kinderbereich landen */
      document.querySelector("#schoolChildDashboard")
        ?.scrollIntoView({behavior:"smooth",block:"start"});
    },60);
  }

  const renderBeforeV68=renderChildRoutineOverviewEditor;

  renderChildRoutineOverviewEditor=function(){
    renderBeforeV68();

    const section=document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;

    const id=String(activeChildRoutineEditorId||"1");
    const offset=Number(activeChildRoutineEditorWeekOffset||0);

    section.dataset.child=id;

    /* Kopfbereich: eindeutiger Rückweg */
    const head=section.querySelector(".personal-subject-settings-head");
    if(head){
      head.classList.add("child-routine-overview-head-v68");

      let back=head.querySelector("#backToChildFromRoutineOverview");
      if(!back){
        back=document.createElement("button");
        back.type="button";
        back.id="backToChildFromRoutineOverview";
        back.className="child-routine-back-to-child";
        head.appendChild(back);
      }
      back.textContent=`← Zurück zu ${childRoutinePersonName(id)}`;
      back.onclick=()=>openCorrectChildPageFromRoutineOverview(id);
    }

    /* Wochenreiter klar mit der sichtbaren Vorschau koppeln */
    const weekTabs=section.querySelector(".child-routine-editor-week-tabs");
    if(weekTabs){
      weekTabs.setAttribute("aria-label","Woche auswählen");
    }

    /* Vorschau immer NACH gespeicherten Punkten anzeigen.
       Dadurch sieht man direkt nach +Routinepunkt, wo der Eintrag gelandet ist. */
    section.querySelector("#childRoutineOverviewWeekPreview")?.remove();

    const preview=document.createElement("div");
    preview.id="childRoutineOverviewWeekPreview";
    preview.innerHTML=childRoutineOverviewPreviewHtml(id,offset);

    const list=section.querySelector(".child-routine-editor-list");
    if(list){
      list.insertAdjacentElement("afterend",preview);
    }else{
      section.appendChild(preview);
    }

    /* Die ausgewählte Woche zusätzlich unmittelbar über der Vorschau sichtbar. */
    section.querySelectorAll("[data-child-routine-editor-week]").forEach(btn=>{
      btn.setAttribute(
        "aria-current",
        Number(btn.dataset.childRoutineEditorWeek||0)===offset ? "true" : "false"
      );
    });
  };

  window.renderChildRoutineOverviewEditor=renderChildRoutineOverviewEditor;

  /* initial ebenfalls mit vollständiger Woche rendern */
  renderChildRoutineOverviewEditor();

})();

/* =========================================================
   V69 – Kinder-Wochenplanung robust
   1) Wochenansicht nach Reload immer vorhanden
   2) oben nur tägliche Wiederholungen
   3) einzelne Wochentage ausschließlich in der Wochenansicht
   4) verlinkte Routinepunkte sind anklickbar
   ========================================================= */
(function(){

  function v69WeekLabel(offset){
    return offset===0 ? "Diese Woche"
      : offset===1 ? "Nächste Woche"
      : `+${offset} Wochen`;
  }

  function v69Monday(offset){
    const monday=getMonday(new Date());
    monday.setDate(monday.getDate()+Number(offset||0)*7);
    monday.setHours(12,0,0,0);
    return monday;
  }

  function v69PartLabel(store,item){
    const labels=store.areaLabels||childRoutineDefaultAreas;
    return labels[item.part]||childRoutineDefaultAreas[item.part]||"";
  }

  function v69ItemTopic(id,item){
    return item.url
      ? childRoutineVideoCategoryLabel(id,item.category||"none")
      : "";
  }

  function v69OpenLink(url,event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if(!url) return;
    window.open(url,"_blank","noopener,noreferrer");
  }
  window.v69OpenChildRoutineLink=v69OpenLink;

  /* -------- Kinderansicht: Links in der Wochenansicht wirklich anklickbar -------- */
  const renderChildBeforeV69=renderChildRoutineDialog;

  renderChildRoutineDialog=function(){
    renderChildBeforeV69();

    const dialog=ensureChildRoutineDialog();
    if(!dialog) return;

    const id=String(activeChildRoutineId||"1");
    const store=childRoutineStore(id);
    const weekKey=childRoutineWeekKey(activeChildRoutineWeekOffset);
    const planned=store.items
      .filter(item=>childRoutineAppliesToWeek(item,weekKey))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    const monday=v69Monday(activeChildRoutineWeekOffset);
    const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
    const grid=dialog.querySelector("#childRoutineWeekGrid");

    if(grid){
      grid.innerHTML=names.map((name,index)=>{
        const date=new Date(monday);
        date.setDate(monday.getDate()+index);
        const dayItems=planned.filter(item=>childRoutineAppliesToDate(item,date));

        return `<section class="child-routine-day ${dateKey(date)===dateKey(new Date())?"is-today":""}">
          <div class="child-routine-day-head">
            <strong>${name}</strong>
            <small>${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</small>
          </div>
          <div class="child-routine-day-body">
            ${dayItems.length ? dayItems.map(item=>{
              const done=!!childRoutineCompletion(id,item.id,date)?.done;
              return `<div class="child-routine-day-item ${done?"is-done":""}">
                <input type="checkbox"
                       data-child-routine-check="${escapeHtml(item.id)}"
                       data-date="${dateKey(date)}"
                       ${done?"checked":""}>
                <span class="child-routine-day-item-symbol">${childRoutineSymbol(item.part||"morning")}</span>
                <div class="child-routine-day-item-copy">
                  ${item.url
                    ? `<a class="child-routine-item-link"
                          href="${escapeHtml(item.url)}"
                          target="_blank"
                          rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
                    : `<span>${escapeHtml(item.title)}</span>`}
                  ${item.url
                    ? `<small class="child-routine-video-topic">${escapeHtml(v69ItemTopic(id,item))}</small>`
                    : ""}
                </div>
              </div>`;
            }).join("") : `<div class="child-routine-day-empty" aria-label="Nichts geplant">☾ <span>✦</span></div>`}
          </div>
        </section>`;
      }).join("");
    }

    dialog.querySelectorAll(".child-routine-item-link").forEach(a=>{
      a.addEventListener("click",e=>e.stopPropagation());
    });
  };
  window.renderChildRoutineDialog=renderChildRoutineDialog;

  /* -------- Überblick: vollständige Wochenansicht + klare Trennung -------- */
  const renderOverviewBeforeV69=renderChildRoutineOverviewEditor;

  renderChildRoutineOverviewEditor=function(){
    renderOverviewBeforeV69();

    const section=document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;

    const id=String(activeChildRoutineEditorId||"1");
    const offset=Number(activeChildRoutineEditorWeekOffset||0);
    const store=childRoutineStore(id);
    const weekKey=childRoutineWeekKey(offset);
    const planned=store.items
      .filter(item=>childRoutineAppliesToWeek(item,weekKey))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    section.dataset.child=id;

    /* Überschrift/Rückweg auch nach einem Reload zuverlässig setzen */
    const head=section.querySelector(".personal-subject-settings-head");
    if(head){
      head.classList.add("child-routine-overview-head-v69");

      let title=head.querySelector(".v69-overview-title");
      if(!title){
        head.innerHTML=`
          <div class="v69-overview-copy">
            <strong class="v69-overview-title"></strong>
            <small>
              Hier planst du die zusätzlichen Wochenpunkte. Tägliche Wiederholungen
              bleiben oben sichtbar; einzelne Tage erscheinen nur in der Wochenansicht.
            </small>
          </div>
          <button type="button" id="backToChildFromRoutineOverview" class="child-routine-back-to-child"></button>
        `;
      }
      head.querySelector(".v69-overview-title").textContent=`Wochenplanung – ${childRoutinePersonName(id)}`;
      const back=head.querySelector("#backToChildFromRoutineOverview");
      if(back){
        back.textContent=`← Zurück zu ${childRoutinePersonName(id)}`;
        back.onclick=()=>{
          document.querySelector('[data-view="school"]')?.click();
          setTimeout(()=>{
            renderSchoolChildDashboard(id);
            document.querySelector("#schoolChildDashboard")?.scrollIntoView({behavior:"smooth",block:"start"});
          },70);
        };
      }
    }

    /* Liste über der Woche: NUR tägliche Wiederholungen.
       Einzelne Montag/Mittwoch/Samstag-Punkte gehören ausschließlich ins Raster. */
    const list=section.querySelector(".child-routine-editor-list");
    if(list){
      const daily=planned.filter(item=>(item.day||"daily")==="daily");

      list.innerHTML=daily.length ? `
        <div class="v69-daily-heading">
          <strong>Tägliche Wiederholungen</strong>
          <small>Diese Punkte gelten an jedem Tag der gewählten Woche.</small>
        </div>
        ${daily.map(item=>`
          <div class="child-routine-editor-row" data-routine-id="${escapeHtml(item.id)}">
            <span class="child-routine-editor-row-symbol">${childRoutineSymbol(item.part||"morning")}</span>
            <div>
              ${item.url
                ? `<a class="v69-overview-item-link"
                      href="${escapeHtml(item.url)}"
                      target="_blank"
                      rel="noopener noreferrer"><strong>${escapeHtml(item.title)}</strong></a>`
                : `<strong>${escapeHtml(item.title)}</strong>`}
              <small>
                ${escapeHtml(v69PartLabel(store,item))}
                ${item.url?` · ${escapeHtml(v69ItemTopic(id,item))}`:""}
                ${item.sticky?" · jede Woche":""}
              </small>
            </div>
            <button type="button" data-v69-edit="${escapeHtml(item.id)}" title="Bearbeiten">✎</button>
            <button type="button" data-v69-delete="${escapeHtml(item.id)}" title="Löschen">×</button>
          </div>
        `).join("")}
      ` : `
        <div class="v69-daily-empty">
          <strong>Keine täglichen Wiederholungen</strong>
          <small>Einzelne Wochentage siehst du direkt unten in der Wochenansicht.</small>
        </div>
      `;
    }

    /* Alte Vorschau sicher entfernen und IMMER frisch neu aufbauen. */
    section.querySelector("#childRoutineOverviewWeekPreview")?.remove();

    const monday=v69Monday(offset);
    const names=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

    const preview=document.createElement("section");
    preview.id="childRoutineOverviewWeekPreview";
    preview.className="child-routine-overview-week-preview v69-week-preview";
    preview.innerHTML=`
      <div class="child-routine-overview-week-preview-head">
        <div>
          <strong>Wochenansicht – ${escapeHtml(childRoutinePersonName(id))}</strong>
          <small>${v69WeekLabel(offset)}</small>
        </div>
        <span class="child-routine-overview-preview-hint">
          Genau so erscheint die Einteilung bei ${escapeHtml(childRoutinePersonName(id))}.
        </span>
      </div>

      <div class="child-routine-overview-week-grid">
        ${names.map((name,index)=>{
          const date=new Date(monday);
          date.setDate(monday.getDate()+index);
          const dayItems=planned.filter(item=>childRoutineAppliesToDate(item,date));

          return `<section class="child-routine-overview-day ${dateKey(date)===dateKey(new Date())?"is-today":""}">
            <header>
              <strong>${name}</strong>
              <small>${String(date.getDate()).padStart(2,"0")}.${String(date.getMonth()+1).padStart(2,"0")}.</small>
            </header>
            <div class="child-routine-overview-day-body">
              ${dayItems.length ? dayItems.map(item=>`
                <div class="child-routine-overview-preview-item" data-preview-routine-id="${escapeHtml(item.id)}">
                  <span class="child-routine-overview-preview-symbol">${childRoutineSymbol(item.part||"morning")}</span>
                  <div class="v69-preview-copy">
                    ${item.url
                      ? `<a class="v69-overview-item-link"
                            href="${escapeHtml(item.url)}"
                            target="_blank"
                            rel="noopener noreferrer"><strong>${escapeHtml(item.title||"Routinepunkt")}</strong></a>`
                      : `<strong>${escapeHtml(item.title||"Routinepunkt")}</strong>`}
                    <small>
                      ${escapeHtml(v69PartLabel(store,item))}
                      ${item.url?` · ${escapeHtml(v69ItemTopic(id,item))}`:""}
                      ${item.sticky?" · jede Woche":""}
                    </small>
                  </div>
                  <div class="v69-preview-actions">
                    <button type="button" data-v69-edit="${escapeHtml(item.id)}" title="Bearbeiten">✎</button>
                    <button type="button" data-v69-delete="${escapeHtml(item.id)}" title="Löschen">×</button>
                  </div>
                </div>
              `).join("") : `
                <div class="child-routine-overview-empty" aria-label="Nichts geplant">
                  <span>☾</span><small>✦</small>
                </div>
              `}
            </div>
          </section>`;
        }).join("")}
      </div>
    `;

    (list||section).insertAdjacentElement("afterend",preview);

    /* Link-Klick darf nie den Edit-/Checkbox-Klick auslösen. */
    section.querySelectorAll(".v69-overview-item-link").forEach(a=>{
      a.addEventListener("click",e=>e.stopPropagation());
    });

    /* Editieren aus täglicher Liste UND direkt aus dem Wochenraster */
    section.querySelectorAll("[data-v69-edit]").forEach(btn=>{
      btn.onclick=()=>{
        const item=store.items.find(x=>x.id===btn.dataset.v69Edit);
        if(!item) return;

        editingChildRoutineItemId=item.id;
        section.querySelector("#childRoutineEditorPart").value=item.part||"morning";
        section.querySelector("#childRoutineEditorTitle").value=item.title||"";
        section.querySelector("#childRoutineEditorUrl").value=item.url||"";
        const cat=section.querySelector("#childRoutineEditorCategory");
        if(cat) cat.value=item.category||"none";
        section.querySelector("#childRoutineEditorDay").value=item.day||"daily";
        section.querySelector("#childRoutineEditorSticky").checked=!!item.sticky;

        const saveBtn=section.querySelector("#saveChildRoutineEditorItem");
        if(saveBtn) saveBtn.textContent="Änderung speichern";
        section.querySelector("#cancelChildRoutineEditorEdit")?.classList.remove("hidden");
        section.querySelector("#childRoutineEditorTitle")?.focus();
      };
    });

    /* Löschen ebenfalls direkt aus der Wochenansicht */
    section.querySelectorAll("[data-v69-delete]").forEach(btn=>{
      btn.onclick=()=>{
        const itemId=btn.dataset.v69Delete;
        const item=store.items.find(x=>x.id===itemId);
        if(!item) return;
        if(!confirm(`Routinepunkt „${item.title||"Routinepunkt"}“ löschen?`)) return;

        store.tombstones[itemId]=Date.now();
        store.items=store.items.filter(x=>x.id!==itemId);
        Object.keys(store.completions||{}).forEach(key=>{
          if(key.startsWith(`${itemId}__`)) delete store.completions[key];
        });

        childRoutineTouch(id);
        renderChildRoutineOverviewEditor();
      };
    });

    /* aktuelle Woche sichtbar markieren */
    section.querySelectorAll("[data-child-routine-editor-week]").forEach(btn=>{
      btn.classList.toggle("active",Number(btn.dataset.childRoutineEditorWeek||0)===offset);
      btn.setAttribute("aria-current",
        Number(btn.dataset.childRoutineEditorWeek||0)===offset ? "true" : "false"
      );
    });
  };

  window.renderChildRoutineOverviewEditor=renderChildRoutineOverviewEditor;

  /* -------- Reload-Bug:
     Manche View-Renderer bauen den Basisblock NACH unserem ersten Render erneut auf.
     Beobachter setzt dann automatisch die vollständige Wochenansicht wieder ein. -------- */
  let v69RepairQueued=false;

  function v69RepairOverviewIfNeeded(){
    const section=document.querySelector("#childRoutineOverviewEditor");
    if(!section) return;

    if(!section.querySelector("#childRoutineOverviewWeekPreview")){
      if(v69RepairQueued) return;
      v69RepairQueued=true;
      requestAnimationFrame(()=>{
        v69RepairQueued=false;
        if(document.querySelector("#childRoutineOverviewEditor") &&
           !document.querySelector("#childRoutineOverviewWeekPreview")){
          renderChildRoutineOverviewEditor();
        }
      });
    }
  }

  /* Reload-Reparatur nur dort beobachten, wo die Wochenplanung lebt.
     Ein globaler body-Observer war hier unnötig teuer. */
  const v69Observer=new MutationObserver(v69RepairOverviewIfNeeded);
  const v69ObserveRoot =
    document.querySelector("#archive") ||
    document.querySelector(".family-settings");
  if(v69ObserveRoot){
    v69Observer.observe(v69ObserveRoot,{childList:true,subtree:true});
  }

  window.addEventListener("pageshow",()=>{
    setTimeout(v69RepairOverviewIfNeeded,50);
    setTimeout(v69RepairOverviewIfNeeded,250);
  });

  document.addEventListener("click",e=>{
    if(e.target.closest('[data-view="archive"]')){
      setTimeout(v69RepairOverviewIfNeeded,80);
      setTimeout(v69RepairOverviewIfNeeded,300);
    }
  },true);

  setTimeout(v69RepairOverviewIfNeeded,60);
  setTimeout(v69RepairOverviewIfNeeded,280);

})();

/* =========================================================
   V70 – Drei getrennte Videoarchive: Mama / Lou / Fina
   - Kindervideo abhaken -> bewerten -> persönliches Archiv
   - pro Person eigenes Archiv
   - Archivvideo wieder in die jeweilige Wochenplanung einplanen
   ========================================================= */
(function(){

  let activeRoutineArchiveOwner = "mama";

  function v70ArchiveOwner(entry){
    return String(entry?.owner || "mama");
  }

  function v70ArchiveOwnerName(owner){
    if(owner==="1") return familyName("c") || "Lou";
    if(owner==="2") return familyName("d") || "Fina";
    return familyName("a") || "Mama";
  }

  function v70ArchiveCategories(owner){
    if(owner==="1" || owner==="2"){
      return childRoutineVideoCategories(owner);
    }
    return [
      ["all","Alle Kategorien"],
      ["yoga","Yoga"],
      ["meditation","Meditation"],
      ["pain","Schmerz"],
      ["sport","Sport"],
      ["other","Sonstiges"]
    ];
  }

  function v70CategoryLabel(owner,key){
    if(owner==="1" || owner==="2"){
      return childRoutineVideoCategoryLabel(owner,key);
    }
    return ({
      yoga:"Yoga",
      meditation:"Meditation",
      pain:"Schmerz",
      sport:"Sport",
      other:"Sonstiges",
      none:"Sonstiges"
    })[key||"other"] || "Sonstiges";
  }

  function v70NormalizeUrl(url){
    try{return normalizeUrl(url);}
    catch{return String(url||"").trim();}
  }

  function childArchiveFromRoutineItem(owner,item,rating,date){
    if(!item?.url) return null;
    if(!Array.isArray(state.archive)) state.archive=[];

    const normalized=v70NormalizeUrl(item.url);

    let entry=state.archive.find(a=>
      v70ArchiveOwner(a)===String(owner) &&
      v70NormalizeUrl(a.url)===normalized
    );

    if(!entry){
      entry={
        id:uid(),
        owner:String(owner),
        title:item.title || "Routinevideo",
        url:item.url,
        thumbnail:thumbnailFor(item.url),
        timesDone:0,
        rating:null,
        favorite:false,
        lastDone:null,
        category:item.category || "other",
        createdAt:Date.now(),
        updatedAt:Date.now()
      };
      state.archive.push(entry);
    }

    entry.owner=String(owner);
    entry.title=item.title || entry.title || "Routinevideo";
    entry.url=item.url;
    entry.thumbnail=entry.thumbnail || thumbnailFor(item.url);
    entry.category=item.category || entry.category || "other";
    entry.rating=rating || entry.rating || null;
    entry.timesDone=(entry.timesDone||0)+1;
    entry.lastDone=(date instanceof Date ? date : new Date()).toISOString();
    entry.planned=false;
    entry.updatedAt=Date.now();

    return entry;
  }

  /* ---------- Kind: nach dem Abhaken Bewertung anbieten ---------- */
  const renderChildRoutineDialogBeforeV70=renderChildRoutineDialog;

  renderChildRoutineDialog=function(){
    renderChildRoutineDialogBeforeV70();

    const dialog=ensureChildRoutineDialog();
    if(!dialog) return;

    const owner=String(activeChildRoutineId||"1");
    const store=childRoutineStore(owner);

    dialog.querySelectorAll(".child-routine-day-item").forEach(row=>{
      const checkbox=row.querySelector("[data-child-routine-check]");
      if(!checkbox) return;

      const item=store.items.find(x=>x.id===checkbox.dataset.childRoutineCheck);
      if(!item?.url) return;

      const date=parseLocalDate(checkbox.dataset.date);
      if(!date) return;

      const completion=childRoutineCompletion(owner,item.id,date);

      row.querySelector(".child-routine-rating")?.remove();

      if(completion?.done && !completion?.rating){
        const rating=document.createElement("div");
        rating.className="child-routine-rating";
        rating.innerHTML=`
          <span>Wie war es?</span>
          <button type="button"
                  data-child-video-rating="super"
                  data-child-owner="${owner}"
                  data-child-item="${escapeHtml(item.id)}"
                  data-child-date="${escapeHtml(dateKey(date))}">✦ Gut</button>
          <button type="button"
                  data-child-video-rating="okay"
                  data-child-owner="${owner}"
                  data-child-item="${escapeHtml(item.id)}"
                  data-child-date="${escapeHtml(dateKey(date))}">○ Mittel</button>
          <button type="button"
                  data-child-video-rating="nope"
                  data-child-owner="${owner}"
                  data-child-item="${escapeHtml(item.id)}"
                  data-child-date="${escapeHtml(dateKey(date))}">— Schlecht</button>
        `;
        row.appendChild(rating);
      }
    });
  };
  window.renderChildRoutineDialog=renderChildRoutineDialog;

  document.addEventListener("click",e=>{
    const btn=e.target.closest("[data-child-video-rating]");
    if(!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const owner=String(btn.dataset.childOwner||"");
    const store=childRoutineStore(owner);
    const item=store.items.find(x=>x.id===btn.dataset.childItem);
    const date=parseLocalDate(btn.dataset.childDate);

    if(!item || !date) return;

    const current=childRoutineCompletion(owner,item.id,date);
    const rating=btn.dataset.childVideoRating;

    childArchiveFromRoutineItem(owner,item,rating,date);
    setChildRoutineCompletion(owner,item.id,date,true);

    store.completions[childRoutineCompletionKey(item.id,date)]={
      ...(current||{}),
      done:true,
      rating,
      archived:true,
      updatedAt:Date.now()
    };
    store.updatedAt=Date.now();

    try{
      localStorage.setItem("balanceProd.archive",JSON.stringify(state.archive));
      persistFamilySettingsImmediately?.();
    }catch{}

    save();
    renderChildRoutineDialog();

    if(document.querySelector("#archiveList")){
      renderArchive();
    }

    showMotivation(`${item.title || "Video"} wurde bewertet und in ${v70ArchiveOwnerName(owner)}s Archiv gespeichert.`);
  });

  /* ---------- Archiv: Personenumschalter einsetzen ---------- */
  function v70EnsureArchiveOwnerTabs(){
    const card=document.querySelector(".exercise-overview-card");
    if(!card) return null;

    let tabs=card.querySelector("#routineArchiveOwnerTabs");
    if(!tabs){
      tabs=document.createElement("div");
      tabs.id="routineArchiveOwnerTabs";
      tabs.className="routine-archive-owner-tabs";

      const filterRow=card.querySelector(".exercise-filter-row");
      filterRow?.insertAdjacentElement("beforebegin",tabs);
    }

    tabs.innerHTML=["mama","1","2"].map(owner=>`
      <button type="button"
              data-routine-archive-owner="${owner}"
              class="${activeRoutineArchiveOwner===owner?"active":""}">
        ${escapeHtml(v70ArchiveOwnerName(owner))}
      </button>
    `).join("");

    tabs.querySelectorAll("[data-routine-archive-owner]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        activeRoutineArchiveOwner=String(btn.dataset.routineArchiveOwner);
        archiveFilter="all";
        archiveCategoryFilter="all";
        renderArchive();
      });
    });

    return tabs;
  }

  function v70RefreshArchiveCategoryOptions(){
    const select=document.querySelector("#archiveCategoryFilter");
    if(!select) return;

    const categories=v70ArchiveCategories(activeRoutineArchiveOwner);
    const rows=categories[0]?.[0]==="all"
      ? categories
      : [["all","Alle Kategorien"],...categories.filter(([key])=>key!=="none")];

    select.innerHTML=rows.map(([key,label])=>
      `<option value="${escapeHtml(key)}"${archiveCategoryFilter===key?" selected":""}>${escapeHtml(label)}</option>`
    ).join("");
  }

  function v70ArchiveCardHtml(a){
    const owner=v70ArchiveOwner(a);
    const ratingLabel={super:"✦ Gut",okay:"○ Mittel",nope:"— Schlecht"};

    return `
      <article class="archive-card ${a.thumbnail ? "has-thumb" : "no-thumb"}">
        ${a.thumbnail ? `
          <a class="archive-thumb-link"
             href="${escapeHtml(a.url)}"
             target="_blank"
             rel="noopener"
             aria-label="${escapeHtml(a.title)} öffnen">
            <img class="archive-thumb" src="${escapeHtml(a.thumbnail)}" alt="">
            <span class="archive-thumb-play">▶</span>
          </a>` : ""}

        <div class="archive-content">
          <div class="archive-title-row">
            <h3>${escapeHtml(a.title)}</h3>
            ${isMostWanted(a.url) ? '<span class="most-wanted-badge" title="Wird häufig genutzt">✦ Most wanted</span>' : ''}
          </div>

          <div class="archive-meta">
            <span>${ratingLabel[a.rating] || "☆ Noch nicht bewertet"}</span>
            <span>${escapeHtml(v70CategoryLabel(owner,a.category||"other"))}</span>
            <span>${a.timesDone || 0}× gemacht</span>
          </div>

          <div class="archive-actions">
            <button type="button"
                    class="archive-action favorite-btn ${a.favorite?"active":""}"
                    data-id="${a.id}">
              ${a.favorite ? "♥ Favorit" : "♡ Favorit"}
            </button>
            <button type="button"
                    class="archive-action replan-btn"
                    data-id="${a.id}">
              ＋ Einplanen
            </button>
            <a class="archive-action archive-open-link"
               href="${escapeHtml(a.url)}"
               target="_blank"
               rel="noopener">
              Video öffnen ↗
            </a>
            <button type="button"
                    class="archive-action archive-delete-action delete-exercise-btn"
                    data-id="${a.id}">
              Löschen
            </button>
          </div>
        </div>
      </article>
    `;
  }

  renderArchive=function(){
    const list=document.querySelector("#archiveList");
    if(!list) return;

    v70EnsureArchiveOwnerTabs();
    v70RefreshArchiveCategoryOptions();

    document.querySelectorAll("[data-routine-archive-owner]").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.routineArchiveOwner===activeRoutineArchiveOwner);
    });

    let items=(state.archive||[])
      .filter(a=>v70ArchiveOwner(a)===activeRoutineArchiveOwner);

    if(archiveFilter==="favorite"){
      items=items.filter(x=>x.favorite);
    }else if(archiveFilter==="wanted"){
      const wantedIds=new Set(
        getMostWantedEntries()
          .filter(x=>v70ArchiveOwner(x)===activeRoutineArchiveOwner)
          .map(x=>x.id)
      );
      items=items.filter(x=>wantedIds.has(x.id));
    }else if(["super","okay","nope"].includes(archiveFilter)){
      items=items.filter(x=>x.rating===archiveFilter);
    }

    if(archiveCategoryFilter!=="all"){
      items=items.filter(x=>(x.category||"other")===archiveCategoryFilter);
    }

    const byNewest=arr=>arr.sort((a,b)=>new Date(b.lastDone||0)-new Date(a.lastDone||0));

    if(!items.length){
      list.className="archive-grid";
      list.innerHTML=`<div class="empty">
        ${escapeHtml(v70ArchiveOwnerName(activeRoutineArchiveOwner))} hat hier noch keine passenden Videos.
      </div>`;
      bindArchiveButtons();
      return;
    }

    if(archiveFilter==="all"){
      const groups=[
        ["unrated","☆ Noch bewerten",byNewest(items.filter(x=>!x.rating))],
        ["super","✦ Gut",byNewest(items.filter(x=>x.rating==="super"))],
        ["okay","○ Mittel",byNewest(items.filter(x=>x.rating==="okay"))],
        ["nope","— Schlecht",byNewest(items.filter(x=>x.rating==="nope"))]
      ];

      list.className="archive-columns";
      list.innerHTML=groups.map(([key,label,group])=>`
        <section class="archive-column ${key}">
          <div class="archive-column-head">${label}<span>${group.length}</span></div>
          <div class="archive-column-list">
            ${group.length
              ? group.map(v70ArchiveCardHtml).join("")
              : '<div class="column-empty">Noch keine Übungen</div>'}
          </div>
        </section>
      `).join("");
    }else{
      if(archiveFilter!=="wanted") byNewest(items);
      list.className="archive-grid";
      list.innerHTML=items.map(v70ArchiveCardHtml).join("");
    }

    bindArchiveButtons();
  };
  window.renderArchive=renderArchive;

  bindArchiveButtons=function(){
    document.querySelectorAll(".favorite-btn").forEach(btn=>{
      btn.onclick=()=>{
        const item=state.archive.find(a=>a.id===btn.dataset.id);
        if(!item) return;
        item.favorite=!item.favorite;
        item.updatedAt=Date.now();
        save();
        renderArchive();
      };
    });

    document.querySelectorAll(".replan-btn").forEach(btn=>{
      btn.onclick=()=>{
        const item=state.archive.find(a=>a.id===btn.dataset.id);
        if(!item) return;

        replanArchiveId=item.id;
        activeRoutineArchiveOwner=v70ArchiveOwner(item);

        const title=document.querySelector("#replanTitle");
        if(title) title.textContent=item.title || "Wieder einplanen";

        const week=document.querySelector("#replanWeek");
        if(week) week.value="0";

        const day=document.querySelector("#replanDay");
        if(day) day.value="Montag";

        const part=document.querySelector("#replanPart");
        if(part) part.value="morning";

        document.querySelector("#replanDialog")?.showModal();
      };
    });

    document.querySelectorAll(".delete-exercise-btn").forEach(btn=>{
      btn.onclick=()=>{
        const item=state.archive.find(a=>a.id===btn.dataset.id);
        if(!item) return;
        if(!confirm(`„${item.title}“ wirklich aus ${v70ArchiveOwnerName(v70ArchiveOwner(item))}s Archiv löschen?`)) return;

        markListItemDeleted("archiveTombstones",item.id);
        state.archive=state.archive.filter(a=>a.id!==item.id);
        save();
        persistTopLevelDeletionImmediately("archive");
        renderArchive();
      };
    });
  };
  window.bindArchiveButtons=bindArchiveButtons;

  /* ---------- Replan-Dialog: Kinder ins Kinder-System, Mama wie bisher ---------- */
  const confirm=document.querySelector("#confirmReplanBtn");
  if(confirm){
    confirm.addEventListener("click",e=>{
      const item=state.archive.find(a=>a.id===replanArchiveId);
      if(!item) return;

      const owner=v70ArchiveOwner(item);
      if(owner==="mama") return; // alter Mama-Handler darf normal weiterlaufen

      e.preventDefault();
      e.stopImmediatePropagation();

      const weeksAhead=Number(document.querySelector("#replanWeek")?.value||0);
      const day=document.querySelector("#replanDay")?.value||"Montag";
      const part=document.querySelector("#replanPart")?.value||"morning";
      const store=childRoutineStore(owner);
      const weekKey=childRoutineWeekKey(weeksAhead);

      const already=store.items.some(existing=>{
        if(existing.weekKey!==weekKey ||
           existing.day!==day ||
           (existing.part||"morning")!==part) return false;

        if(existing.sourceArchiveId===item.id) return true;
        return existing.url &&
          v70NormalizeUrl(existing.url)===v70NormalizeUrl(item.url);
      });

      if(already){
        showMotivation(`${item.title || "Video"} ist dort bereits eingeplant.`);
        return;
      }

      store.items.push({
        id:uid(),
        title:item.title || "Routinevideo",
        url:item.url,
        category:item.category || "other",
        part,
        day,
        sticky:false,
        weekKey,
        sourceArchiveId:item.id,
        createdAt:Date.now(),
        updatedAt:Date.now(),
        order:store.items.length
      });
      store.updatedAt=Date.now();

      item.updatedAt=Date.now();
      persistFamilySettingsImmediately?.();
      save();

      replanArchiveId=null;
      document.querySelector("#replanDialog")?.close();

      activeChildRoutineEditorId=owner;
      activeChildRoutineEditorWeekOffset=weeksAhead;
      renderChildRoutineOverviewEditor();
      renderArchive();

      showMotivation(
        `${item.title || "Video"} ist für ${v70ArchiveOwnerName(owner)} am ${day} eingeplant.`
      );
    },true);
  }

  /* ---------- "Alle Übungen löschen" nur für das ausgewählte Archiv ---------- */
  const deleteAll=document.querySelector("#deleteAllExercisesBtn");
  if(deleteAll){
    deleteAll.addEventListener("click",e=>{
      e.preventDefault();
      e.stopImmediatePropagation();

      const owner=activeRoutineArchiveOwner;
      const ownItems=(state.archive||[]).filter(a=>v70ArchiveOwner(a)===owner);

      if(!ownItems.length){
        showMotivation(`${v70ArchiveOwnerName(owner)}s Archiv ist bereits leer.`);
        return;
      }

      if(!confirm(`Wirklich alle Videos aus ${v70ArchiveOwnerName(owner)}s Archiv löschen?`)) return;

      const ids=new Set(ownItems.map(x=>x.id));
      ownItems.forEach(x=>markListItemDeleted("archiveTombstones",x.id));
      state.archive=(state.archive||[]).filter(a=>!ids.has(a.id));

      save();
      persistTopLevelDeletionImmediately("archive");
      renderArchive();
    },true);
  }

  /* Bei alten Archivdaten ohne owner handelt es sich um Mamas bisheriges Archiv. */
  (state.archive||[]).forEach(entry=>{
    if(!entry.owner) entry.owner="mama";
  });

  renderArchive();

})();

/* =========================================================
   V75 – Kinder-Routinen beim Öffnen geschlossen
   - Lou + Fina identisch
   - beim ersten Öffnen alle vier Bereiche geschlossen
   - danach bleibt der aktuelle Auf-/Zu-Zustand beim Abhaken erhalten
   ========================================================= */
(function(){
  let v75FreshRoutineOpen = false;

  /* Capture läuft vor dem bestehenden Öffnen-Handler. */
  document.addEventListener("click", e=>{
    if(e.target.closest?.("[data-school-open-routines]")){
      v75FreshRoutineOpen = true;
    }
  }, true);

  const renderChildRoutineDialogBeforeV75 = renderChildRoutineDialog;

  renderChildRoutineDialog = function(){
    const dialog = document.querySelector("#childRoutineDialog");

    /* Zustand vor einem normalen Re-Render merken. */
    const openIndexes = [];
    if(dialog && !v75FreshRoutineOpen){
      dialog.querySelectorAll("#childRoutineAreaCards details.child-routine-area-card")
        .forEach((details,index)=>{
          if(details.open) openIndexes.push(index);
        });
    }

    renderChildRoutineDialogBeforeV75();

    const currentDialog = document.querySelector("#childRoutineDialog");
    const cards = currentDialog
      ? [...currentDialog.querySelectorAll("#childRoutineAreaCards details.child-routine-area-card")]
      : [];

    cards.forEach((details,index)=>{
      details.dataset.routineAreaIndex = String(index);

      /* Beim Öffnen immer geschlossen.
         Bei späteren Re-Renders den momentanen Zustand behalten. */
      details.open = v75FreshRoutineOpen ? false : openIndexes.includes(index);
    });

    v75FreshRoutineOpen = false;
  };

  window.renderChildRoutineDialog = renderChildRoutineDialog;
})();

/* =========================================================
   V79 – Individuelle Einstellungen: ruhiger, editierbar erkennbar
   ========================================================= */
(function(){
  function v79StyleFamilySettingsSummary(){
    const summary=document.querySelector(".family-settings > summary");
    if(!summary || summary.dataset.v79Styled==="1") return;

    summary.dataset.v79Styled="1";
    summary.innerHTML=`
      <span class="family-settings-edit-icon" aria-hidden="true">✎</span>
      <span class="family-settings-summary-copy">
        <small>PERSONALISIEREN</small>
        <strong>Individuelle Einstellungen</strong>
      </span>
      <span class="family-settings-summary-chevron" aria-hidden="true">›</span>
    `;
  }

  /* Summary existiert bereits statisch im HTML. Spätere Schritte verschieben
     nur denselben DOM-Knoten; ein permanenter body-Observer ist nicht nötig. */
  v79StyleFamilySettingsSummary();
})();



/* V80 – Individuelle Einstellungen sinnvoll gliedern */
(function(){
  function setupSettings(){
    const root=document.querySelector(".family-settings");
    if(!root || root.dataset.v80==="1") return;
    root.dataset.v80="1";

    const findHeading = txt => [...root.querySelectorAll("h2,h3,h4")].find(x => x.textContent.trim().includes(txt));

    function wrapFromHeading(heading, title, kicker, cls){
      if(!heading || heading.closest(".settings-v80-group")) return;
      const box=document.createElement("details");
      box.className="settings-v80-group "+cls;
      const sum=document.createElement("summary");
      sum.innerHTML=`<span class="settings-v80-arrow">›</span><span><small>${kicker}</small><strong>${title}</strong></span>`;
      box.appendChild(sum);

      const parent=heading.parentElement;
      parent.insertBefore(box,heading);
      box.appendChild(heading);

      let n=box.nextSibling;
      while(n){
        const next=n.nextSibling;
        if(n.nodeType===1 && (n.matches("h2,h3,h4") || n.classList?.contains("settings-v80-group"))) break;
        box.appendChild(n); n=next;
      }
      return box;
    }

    const routineHeading=findHeading("Routinen");
    const timetableHeading=findHeading("Stundenplan");
    const weekHeading=findHeading("Meine Woche");

    wrapFromHeading(timetableHeading,"Schule & Stundenplan","SCHULE","settings-school");
    wrapFromHeading(weekHeading,"Meine Woche","ANSICHT","settings-week");

    if(routineHeading){
      const box=wrapFromHeading(routineHeading,"Routinen","ALLTAG","settings-routines");
      if(box){
        /* Tagesroutinen + Wochenplanung bleiben bewusst im selben offenen Block:
           So sieht man feste Punkte und Wochenpunkte gleichzeitig. */
        box.classList.add("settings-routines-together");
      }
    }

    /* Alles standardmäßig geschlossen. */
    root.querySelectorAll(":scope > .settings-v80-group").forEach(d=>d.open=false);
  }

  /* V82 übernimmt danach die endgültige Gruppierung.
     Ein permanenter body-Observer aus V80 erzeugt nur unnötige Arbeit. */
  setupSettings();
})();


/* =========================================================
   V82 – Individuelle Einstellungen: 4 saubere Hauptgruppen
   Familie & Farben / Schule & Stundenplan / Meine Woche / Routinen
   Alle beim Öffnen standardmäßig geschlossen.
   Routinen bleiben IN EINEM gemeinsamen Block:
   Tagesroutinen + Wochenplanung gleichzeitig sichtbar.
   ========================================================= */
(function(){

  function v82UnwrapOldGroups(root){
    root.querySelectorAll(":scope > .settings-v80-group").forEach(old=>{
      const parent=old.parentNode;
      while(old.firstChild){
        if(old.firstChild.tagName==="SUMMARY"){
          old.firstChild.remove();
          continue;
        }
        parent.insertBefore(old.firstChild,old);
      }
      old.remove();
    });
  }

  function v82CreateGroup(id,kicker,title){
    const details=document.createElement("details");
    details.id=id;
    details.className="settings-main-group";
    details.innerHTML=`
      <summary>
        <span class="settings-main-arrow" aria-hidden="true">›</span>
        <span class="settings-main-title">
          <small>${kicker}</small>
          <strong>${title}</strong>
        </span>
      </summary>
      <div class="settings-main-body"></div>
    `;
    return details;
  }

  function v82Move(node,body){
    if(node && node.parentElement!==body) body.appendChild(node);
  }

  function v82BuildSettingsGroups(){
    const root=document.querySelector("details.family-settings");
    if(!root) return;

    /* Alte V80-Struktur einmal sauber entfernen. */
    v82UnwrapOldGroups(root);

    let family=root.querySelector("#settingsGroupFamily");
    let school=root.querySelector("#settingsGroupSchool");
    let week=root.querySelector("#settingsGroupWeek");
    let routines=root.querySelector("#settingsGroupRoutines");

    if(!family){
      family=v82CreateGroup("settingsGroupFamily","GRUNDLAGEN","Familie & Farben");
      root.appendChild(family);
    }
    if(!school){
      school=v82CreateGroup("settingsGroupSchool","SCHULE","Schule & Stundenplan");
      root.appendChild(school);
    }
    if(!week){
      week=v82CreateGroup("settingsGroupWeek","ANSICHT","Meine Woche");
      root.appendChild(week);
    }
    if(!routines){
      routines=v82CreateGroup("settingsGroupRoutines","ALLTAG","Routinen");
      root.appendChild(routines);
    }

    const familyBody=family.querySelector(".settings-main-body");
    const schoolBody=school.querySelector(".settings-main-body");
    const weekBody=week.querySelector(".settings-main-body");
    const routinesBody=routines.querySelector(".settings-main-body");

    /* 1. Familie & Farben */
    v82Move(root.querySelector(":scope > .family-settings-hint"),familyBody);
    v82Move(root.querySelector(":scope > .schoolyear-setting"),familyBody);
    v82Move(root.querySelector(":scope > .family-settings-grid"),familyBody);

    /* Falls V80 die Basis bereits in eine Gruppe gezogen hatte, dort finden. */
    v82Move(root.querySelector(".family-settings-hint"),familyBody);
    v82Move(root.querySelector(".schoolyear-setting"),familyBody);
    v82Move(root.querySelector(".family-settings-grid"),familyBody);

    /* 2. Schule & Stundenplan */
    v82Move(document.querySelector("#personalTimetableSubjectSettings"),schoolBody);

    /* 3. Meine Woche */
    v82Move(document.querySelector("#myWeekAppearanceSettings"),weekBody);

    /* 4. Routinen:
       Wochenplanung zuerst, darunter die festen Tagesroutinen.
       So steht die Wochenplanung direkt VOR den Tageskarten. */
    v82Move(document.querySelector("#childRoutineOverviewEditor"),routinesBody);
    v82Move(document.querySelector("#personalRoutineSentenceSettings"),routinesBody);

    /* Reihenfolge im Hauptbereich festhalten. */
    [family,school,week,routines].forEach(group=>{
      if(group.parentElement!==root) root.appendChild(group);
    });

    root.dataset.v82Grouped="1";
  }

  function v82CloseInnerGroups(){
    const root=document.querySelector("details.family-settings");
    if(!root) return;
    root.querySelectorAll(":scope > .settings-main-group").forEach(d=>d.open=false);
  }

  function v82Setup(){
    v82BuildSettingsGroups();

    const root=document.querySelector("details.family-settings");
    if(!root || root.dataset.v82Listener==="1") return;
    root.dataset.v82Listener="1";

    root.addEventListener("toggle",()=>{
      /* Jedes neue Öffnen beginnt ruhig mit allen vier Hauptgruppen geschlossen. */
      if(root.open){
        v82BuildSettingsGroups();
        v82CloseInnerGroups();
      }
    });
  }

  v82Setup();

  /* Stabilität: kein body-weiter MutationObserver mehr.
     Initialisierung einmal direkt und einmal verzögert reicht; beim Öffnen
     der Einstellungen läuft v82Setup über den vorhandenen toggle-Handler. */
  setTimeout(v82Setup,80);
  setTimeout(v82Setup,260);
})();


/* =========================================================
   V86 – Familie & Farben kompakt + Rahmen sofort anwenden
   ========================================================= */
(function(){
  const border=document.querySelector("#familyBorderWidth");
  const apply=document.querySelector("#applyFamilyBorderWidth");
  if(border && apply && border.dataset.v86Auto!=="1"){
    border.dataset.v86Auto="1";
    border.addEventListener("change",()=>apply.click());
  }
})();


/* =========================================================
   V86 – Einstellungen als echtes Accordion
   - innerhalb "Individuelle Einstellungen" immer nur EIN Bereich offen
   - Pfeile links bleiben echte, sichtbare Öffnungszeichen
   ========================================================= */
(function(){
  function setupSingleOpenSettingsAccordion(){
    const root=document.querySelector("details.family-settings");
    if(!root || root.dataset.v86Accordion==="1") return;
    root.dataset.v86Accordion="1";

    root.addEventListener("toggle", e=>{
      const opened=e.target;
      if(
        !(opened instanceof HTMLDetailsElement) ||
        !opened.classList.contains("settings-main-group") ||
        !opened.open
      ) return;

      root.querySelectorAll(":scope > .settings-main-group").forEach(other=>{
        if(other!==opened) other.open=false;
      });
    }, true);
  }

  setupSingleOpenSettingsAccordion();
  document.addEventListener("click",e=>{
    if(e.target.closest?.(".family-settings > summary")){
      setTimeout(setupSingleOpenSettingsAccordion,0);
    }
  },true);
})();


/* =========================================================
   V88 – Unser Überblick: EIN einziges, robustes Klappsystem
   Die drei Hauptkarten besitzen ihre echten Buttons direkt in index.html.
   Keine MutationObserver, keine nachträglich erzeugten Pfeile.
   ========================================================= */
(function(){
  const configs={
    time:{selector:".time-tracker-card", label:"Zeit im Blick"},
    recipes:{selector:".recipe-link-tracker-card", label:"Online-Rezepte"},
    archive:{selector:".exercise-overview-card", label:"Übungen & Videos"}
  };

  function setOverviewCollapsed(key, collapsed){
    const cfg=configs[key];
    if(!cfg) return;
    const card=document.querySelector(cfg.selector);
    if(!card) return;
    const btn=card.querySelector(`.overview-collapse-toggle[data-overview-collapse="${key}"]`);
    card.classList.toggle("overview-card-collapsed", !!collapsed);
    if(btn){
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", `${cfg.label} ${collapsed ? "öffnen" : "schließen"}`);
      const arrow=btn.querySelector(".overview-collapse-arrow");
      if(arrow) arrow.textContent=collapsed ? "▸" : "▾";
    }
  }

  function placeTimeCardAtTop(){
    const overview=document.querySelector("#archive");
    const time=document.querySelector(".time-tracker-card");
    const tools=document.querySelector("#overviewTopTools");
    if(overview && time && tools && tools.parentElement===overview && time.nextElementSibling!==tools){
      overview.insertBefore(time,tools);
    }
  }

  function closeOverviewCards(){
    placeTimeCardAtTop();
    Object.keys(configs).forEach(key=>setOverviewCollapsed(key,true));
  }

  document.addEventListener("click", e=>{
    const btn=e.target.closest?.(".overview-collapse-toggle[data-overview-collapse]");
    if(btn){
      e.preventDefault();
      const key=btn.dataset.overviewCollapse;
      const cfg=configs[key];
      const card=cfg ? document.querySelector(cfg.selector) : null;
      if(card) setOverviewCollapsed(key,!card.classList.contains("overview-card-collapsed"));
      return;
    }

    if(e.target.closest?.('[data-view="archive"]')){
      requestAnimationFrame(closeOverviewCards);
    }
  }, true);

  document.addEventListener("DOMContentLoaded", closeOverviewCards, {once:true});
  closeOverviewCards();
})();


/* =========================================================
   STABILITÄTS-AUDIT PUNKT 2
   Body-weite MutationObserver wurden auf die tatsächlich
   betroffenen Bereiche begrenzt bzw. entfernt.
   Funktional notwendige, gezielte Dialog-Observer bleiben erhalten.
   ========================================================= */

/* =========================================================
   STABILITÄTS-AUDIT PUNKT 3
   12-Sekunden-Firestore-Polling entfernt.
   Live-Sync bleibt über onSnapshot; gezielter Pull nur noch
   bei Start, Rückkehr zur App und Wiederherstellung des Netzes.
   ========================================================= */

/* =========================================================
   V89 – UNSER ÜBERBLICK
   Klappsystem nach dem bewährten Werkraum-Prinzip
   ========================================================= */
(function () {
  const archive = document.querySelector("#archive");
  if (!archive || archive.dataset.v89OverviewFold === "1") return;
  archive.dataset.v89OverviewFold = "1";

  const cards = [
    {
      el: archive.querySelector(".time-tracker-card"),
      headSelector: ":scope > .overview-card-head"
    },
    {
      el: archive.querySelector(".recipe-link-tracker-card"),
      headSelector: ":scope > .overview-card-head"
    },
    {
      el: archive.querySelector(".exercise-overview-card"),
      headSelector: ":scope > .section-head"
    }
  ].filter(x => x.el);

  const settings = archive.querySelector("details.family-settings");

  function prepareCard(item) {
    const card = item.el;
    const head = card.querySelector(item.headSelector);
    if (!head) return;

    card.classList.add("overview-workroom-card");
    head.classList.add("workroom-fold-head", "overview-workroom-head");

    head.querySelectorAll(".overview-collapse-toggle").forEach(btn => {
      btn.hidden = true;
      btn.setAttribute("aria-hidden", "true");
      btn.tabIndex = -1;
    });

    const textBlock = head.querySelector(":scope > div");
    if (textBlock && !textBlock.querySelector(":scope > .workroom-fold-arrow")) {
      const arrow = document.createElement("span");
      arrow.className = "workroom-fold-arrow overview-workroom-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "▾";
      textBlock.prepend(arrow);
    }

    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", "false");
  }

  cards.forEach(prepareCard);

  function setCardOpen(card, open) {
    card.classList.toggle("open", !!open);
    const head = card.querySelector(":scope > .overview-workroom-head");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
    card.classList.toggle("overview-card-collapsed", !open);
  }

  function closeAllExcept(except = null) {
    cards.forEach(({ el }) => {
      if (el !== except) setCardOpen(el, false);
    });

    if (settings && settings !== except) {
      settings.open = false;
    }
  }

  function toggleCard(card) {
    const willOpen = !card.classList.contains("open");
    closeAllExcept(willOpen ? card : null);
    setCardOpen(card, willOpen);
  }

  function handleHead(head) {
    const card = head.closest(".overview-workroom-card");
    if (!card) return;
    toggleCard(card);
  }

  archive.addEventListener("click", e => {
    const head = e.target.closest(".overview-workroom-head");
    if (!head || !archive.contains(head)) return;
    if (e.target.closest("button,a,input,select,textarea")) return;

    e.preventDefault();
    handleHead(head);
  });

  archive.addEventListener("keydown", e => {
    const head = e.target.closest(".overview-workroom-head");
    if (!head || !archive.contains(head)) return;
    if (e.key !== "Enter" && e.key !== " ") return;

    e.preventDefault();
    handleHead(head);
  });

  if (settings) {
    settings.addEventListener("toggle", () => {
      if (settings.open) {
        cards.forEach(({ el }) => setCardOpen(el, false));
      }
    });
  }

  cards.forEach(({ el }) => setCardOpen(el, false));
  if (settings) settings.open = false;

  document.addEventListener("click", e => {
    if (!e.target.closest?.('[data-view="archive"]')) return;
    requestAnimationFrame(() => {
      cards.forEach(({ el }) => setCardOpen(el, false));
      if (settings) settings.open = false;
    });
  }, true);
})();

/* =========================================================
   SYNC-AUDIT SCHRITT 1 – RABATTE & PICKERL
   Cloud-Schreiben: vorhanden
   Cloud-Einlesen: ergänzt
   Konfliktauflösung: ID + updatedAt
   Löschen: deleted:true bleibt synchronisierbar
   ========================================================= */


/* =========================================================
   MOBILE V94 – Wochenkopf endgültig kompakt
   Nur drei klare Zeichen:
   Papa = Bogen, Pinnwand = Brief, Stundenplan = Raster.
   ========================================================= */
function ensureMobileWeekHeaderV94(){
  document.querySelector("#mobileWeekHeaderV94")?.remove();

  const style = document.createElement("style");
  style.id = "mobileWeekHeaderV94";
  style.textContent = `
    @media(max-width:700px){
      .week-head-actions{
        width:100% !important;
        max-width:100% !important;
        min-width:0 !important;
        display:flex !important;
        align-items:center !important;
        justify-content:flex-end !important;
        gap:8px !important;
        flex-wrap:nowrap !important;
        margin:0 !important;
      }

      /* Am Handy nur die drei wirklich benötigten Wochenkopf-Aktionen. */
      #addVideoBtn,
      #printWeekBtn{
        display:none !important;
      }

      #openPapaOverviewBtn,
      #openPinboardBtn,
      #openFamilyTimetableBtn{
        position:relative !important;
        flex:0 0 38px !important;
        width:38px !important;
        min-width:38px !important;
        max-width:38px !important;
        height:38px !important;
        min-height:38px !important;
        max-height:38px !important;
        padding:0 !important;
        margin:0 !important;
        border-radius:50% !important;
        display:grid !important;
        place-items:center !important;
        overflow:visible !important;
        box-sizing:border-box !important;
        font-size:0 !important;
        line-height:1 !important;
        background:rgba(255,253,250,.15) !important;
        border:1px solid rgba(133,139,98,.48) !important;
        color:#a7ad79 !important;
        box-shadow:none !important;
      }

      /* Papa: vorhandenen SVG-Bogen verwenden, Text komplett weg. */
      #openPapaOverviewBtn::before{
        content:none !important;
        display:none !important;
      }
      #openPapaOverviewBtn .papa-week-label,
      #openPapaOverviewBtn .papa-week-heart{
        display:none !important;
      }
      #openPapaOverviewBtn .papa-week-bow{
        display:grid !important;
        place-items:center !important;
        width:24px !important;
        height:18px !important;
        margin:0 !important;
        color:#a7ad79 !important;
      }
      #openPapaOverviewBtn .papa-week-bow svg{
        width:24px !important;
        height:18px !important;
      }

      /* Pinnwand: nur ein ruhiger Brief. */
      #openPinboardBtn .pinboard-label,
      #openPinboardBtn .pinboard-icon{
        display:none !important;
      }
      #openPinboardBtn::before{
        content:"✉" !important;
        display:block !important;
        font-family:Georgia,"Times New Roman",serif !important;
        font-size:1.13rem !important;
        line-height:1 !important;
        color:#a7ad79 !important;
      }
      #openPinboardBtn .pinboard-badge{
        top:-4px !important;
        right:-4px !important;
      }

      /* Stundenplan: nur ein Linien-Raster, kein Text/Emoji. */
      #openFamilyTimetableBtn{
        color:transparent !important;
      }
      #openFamilyTimetableBtn::before{
        content:"▦" !important;
        display:block !important;
        font-family:Georgia,"Times New Roman",serif !important;
        font-size:1.22rem !important;
        line-height:1 !important;
        color:#a7ad79 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureMobileWeekHeaderV94();
window.addEventListener("resize", () => {
  if (window.matchMedia("(max-width: 700px)").matches) {
    ensureMobileWeekHeaderV94();
  }
});


/* =========================================================
   V114 – PC-Struktur zuverlässig
   - Schnellzugriff als ORIGINAL-DOM-Block ganz nach oben
   - Zeit im Blick bleibt danach im Überblick
   - Individuelle Einstellungen bleiben separat darunter
   - wird nach älteren V58/V88-Umsortierungen erneut sauber gesetzt
   ========================================================= */
(function(){
  function v114ArrangeOverview(){
    const overview=document.querySelector("#archive");
    if(!overview) return;

    const quickLinks=document.querySelector("#quickLinksRow")
      ?.closest(".quick-links.card, .quick-links");
    const pageHead=overview.querySelector(".overview-page-head");
    const time=overview.querySelector(".time-tracker-card");
    const tools=overview.querySelector("#overviewTopTools");
    const familySettings=document.querySelector("#familyColorA")
      ?.closest("details.family-settings, .family-settings");

    /* Schnellzugriff ist allein ganz oben – nicht zusammen mit Einstellungen. */
    if(quickLinks && quickLinks.parentElement!==overview){
      overview.insertBefore(quickLinks, overview.firstElementChild);
    }else if(quickLinks && overview.firstElementChild!==quickLinks){
      overview.insertBefore(quickLinks, overview.firstElementChild);
    }

    /* Danach Seitenüberschrift und anschließend Zeit im Blick. */
    if(pageHead && quickLinks && pageHead.previousElementSibling!==quickLinks){
      quickLinks.insertAdjacentElement("afterend",pageHead);
    }
    if(time && pageHead && time.previousElementSibling!==pageHead){
      pageHead.insertAdjacentElement("afterend",time);
    }

    /* Individuelle Einstellungen bleiben unter Zeit im Blick. */
    if(tools && familySettings && familySettings.parentElement!==tools){
      tools.appendChild(familySettings);
    }
    if(tools && time && tools.previousElementSibling!==time){
      time.insertAdjacentElement("afterend",tools);
    }
  }

  v114ArrangeOverview();
  requestAnimationFrame(v114ArrangeOverview);
  setTimeout(v114ArrangeOverview,120);
  setTimeout(v114ArrangeOverview,420);

  /* V88 ordnet beim Öffnen noch einmal um – danach setzen wir unsere
     gewünschte endgültige Reihenfolge erneut. */
  document.addEventListener("click",e=>{
    if(e.target.closest?.('[data-view="archive"]')){
      requestAnimationFrame(()=>requestAnimationFrame(v114ArrangeOverview));
      setTimeout(v114ArrangeOverview,80);
    }
  });
})();

/* =========================================================
   V119 – MEIN GELD: Lou & Fina
   ========================================================= */
let activeChildMoneyId = "1";
function moneyWeekKey(date=new Date()){const d=new Date(date);const day=(d.getDay()+6)%7;d.setHours(12,0,0,0);d.setDate(d.getDate()-day);return dateKey(d);}
function moneyWeekLabel(key){const a=new Date(key+"T12:00:00"),b=new Date(a);b.setDate(a.getDate()+6);const f=d=>`${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.`;return `${f(a)}–${f(b)}`;}
function moneyNumber(v){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:0;}
function moneyEuro(v){return `${moneyNumber(v).toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;}

function normalizeChildMoneyStore(raw){
  raw=raw&&typeof raw==="object"?raw:{};
  const w=raw.weekly&&typeof raw.weekly==="object"?raw.weekly:{};
  const savings=raw.savings&&typeof raw.savings==="object"?raw.savings:{};
  const gems=raw.gems&&typeof raw.gems==="object"?raw.gems:{};
  return {
    weekly:{
      pocketAmount:moneyNumber(w.pocketAmount),
      snackAmount:moneyNumber(w.snackAmount),
      pocketFrequency:w.pocketFrequency==="monthly"?"monthly":"weekly",
      snackFrequency:w.snackFrequency==="monthly"?"monthly":"weekly",
      payments:w.payments&&typeof w.payments==="object"?w.payments:{}
    },
    loans:Array.isArray(raw.loans)?raw.loans:[],
    savings:{goal:String(savings.goal||""),target:moneyNumber(savings.target),balance:moneyNumber(savings.balance),history:Array.isArray(savings.history)?savings.history:[]},
    gems:{count:Math.max(0,Number(gems.count||0)),rewardTitle:String(gems.rewardTitle||"Eis geht immer!"),rewardText:String(gems.rewardText||"Gemeinsam Eis essen"),rewardCost:Math.max(1,Number(gems.rewardCost||6)),history:Array.isArray(gems.history)?gems.history:[]},
    updatedAt:Number(raw.updatedAt||0)
  };
}
function ensureChildMoney(){state.familySettings=state.familySettings||{};state.familySettings.childMoney=state.familySettings.childMoney&&typeof state.familySettings.childMoney==="object"?state.familySettings.childMoney:{};["1","2"].forEach(id=>state.familySettings.childMoney[id]=normalizeChildMoneyStore(state.familySettings.childMoney[id]));return state.familySettings.childMoney;}
function childMoneyStore(id){return ensureChildMoney()[String(id)];}
function moneyPersonName(id){return ({mama:"Mama",papa:"Papa","1":"Lou","2":"Fina"})[String(id)]||String(id);}
function moneyTouch(id){childMoneyStore(id).updatedAt=Date.now();save();}
function mergeChildMoneyStore(localValue,cloudValue){const a=normalizeChildMoneyStore(localValue),b=normalizeChildMoneyStore(cloudValue);if(!a.updatedAt)return b;if(!b.updatedAt)return a;return b.updatedAt>a.updatedAt?b:a;}
function moneyMonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function moneyMonthLabel(k){const [y,m]=k.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("de-AT",{month:"long",year:"numeric"});}
function moneyPeriodKey(kind,store,date=new Date()){
  const freq=kind==="pocket"?store.weekly.pocketFrequency:store.weekly.snackFrequency;
  return freq==="monthly" ? `M:${moneyMonthKey(date)}` : `W:${moneyWeekKey(date)}`;
}
function moneyPeriodLabel(kind,store,date=new Date()){
  const freq=kind==="pocket"?store.weekly.pocketFrequency:store.weekly.snackFrequency;
  return freq==="monthly" ? moneyMonthLabel(moneyMonthKey(date)) : moneyWeekLabel(moneyWeekKey(date));
}
function moneyPaymentAt(store,kind,date=new Date()){
  const key=moneyPeriodKey(kind,store,date);
  if(store.weekly.payments[key]) return store.weekly.payments[key];
  /* Rückwärtskompatibilität: alte Wochenstände lagen direkt unter YYYY-MM-DD */
  if(key.startsWith("W:")){
    const legacy=key.slice(2);
    return store.weekly.payments[legacy] || null;
  }
  return null;
}
function setMoneyPayment(store,kind,paid,date=new Date()){
  const key=moneyPeriodKey(kind,store,date);
  store.weekly.payments[key]={paid:!!paid,paidAt:paid?Date.now():0,updatedAt:Date.now()};
}
function clearMoneyPayment(store,kind,date=new Date()){
  const key=moneyPeriodKey(kind,store,date);
  delete store.weekly.payments[key];
  if(key.startsWith("W:")) delete store.weekly.payments[key.slice(2)];
}
let activeMoneyMonth=moneyMonthKey();

const MONEY_QUOTES=["Ich wähle, was mir wirklich wichtig ist.","Nicht alles, was mir gefällt, muss mir gehören.","Weniger Dinge – mehr Platz für Wichtiges.","Ich kaufe nicht einfach – ich entscheide.","Ich überlege: Brauche ich das wirklich?","Was ich habe, darf genug sein.","Ich spare für Dinge, die mir wirklich wichtig sind.","Viele Kleinigkeiten machen nicht lange glücklich.","Lieber etwas Besonderes als ganz viel Kleinkram.","Ich passe gut auf mein Geld und meine Sachen auf.","Ich darf etwas schön finden, ohne es zu kaufen.","Mein Geld gibt mir Möglichkeiten – ich entscheide, wofür."];
const GEM_QUOTES=["Wenn jeder ein bisschen mithilft, bleibt mehr Zeit füreinander.","Was du für uns tust, sehen wir.","Zusammen geht vieles leichter.","Kleine Hilfe. Große Wirkung für uns alle."];

const GEM_APPRECIATION_PRESETS=[
  {cost:5,title:"Nur ich & du! 💛",text:"Mini-Date mit Mama oder Papa · ca. 30–45 Min."},
  {cost:6,title:"Eis geht immer! 🍦",text:"Gemeinsam ein Eis essen gehen"},
  {cost:8,title:"Heute bestimme ICH! 🎲",text:"Kleiner Wunschabend · Spiel oder gemeinsame Beschäftigung aussuchen"},
  {cost:10,title:"Sofa, Snacks & mein Film! 🍿",text:"Wunsch-Filmabend mit Snacks"},
  {cost:12,title:"Küchenchaos erlaubt! 🧁",text:"Gemeinsam backen oder kochen · du suchst aus"},
  {cost:15,title:"Schnapp dir mich! 💛",text:"Großes Mama-/Papa-Date · kleine Unternehmung · ca. 2–3 Std."},
  {cost:18,title:"Heute bin ich Familienboss! 👑",text:"Familienunternehmung für einen halben Tag aussuchen"},
  {cost:20,title:"Ab ins Kino! 🎬",text:"Gemeinsamer Kinobesuch · du suchst den Film mit aus"},
  {cost:25,title:"Überrasch mich! ✨",text:"Mama/Papa planen einen besonderen Überraschungsausflug"}
];

function ensureChildMoneyDialog(){
  let d=document.querySelector("#childMoneyDialog"); if(d)return d;
  d=document.createElement("dialog"); d.id="childMoneyDialog"; d.className="child-money-dialog child-money-v121";
  d.innerHTML=`<div class="child-money-shell">
    <div class="child-money-head"><div><p class="small-label">MEIN GELD</p><h2 id="childMoneyTitle"></h2><p>Dein Überblick für Geld, Sparziele und Wertschätzungszeichen.</p></div><button class="child-money-close" type="button">×</button></div>
    <div id="moneyQuote" class="v121-quote"></div>

    <section class="child-money-card">
      <div class="child-money-section-head"><div><strong>Diese Woche</strong><small id="childMoneyWeekLabel"></small></div><span class="money-star">✦</span></div>
      <div class="child-money-pay-row">
        <div><strong>Taschengeld</strong>
          <select id="childPocketFrequency" class="money-frequency" aria-label="Rhythmus Taschengeld">
            <option value="weekly">wöchentlich</option>
            <option value="monthly">monatlich</option>
          </select>
        </div>
        <label><input id="childPocketAmount" inputmode="decimal"> €</label><button data-money-pay="pocket"></button>
      </div>
      <div class="child-money-pay-row">
        <div><strong>Jausengeld</strong>
          <select id="childSnackFrequency" class="money-frequency" aria-label="Rhythmus Jausengeld">
            <option value="weekly">wöchentlich</option>
            <option value="monthly">monatlich</option>
          </select>
        </div>
        <label><input id="childSnackAmount" inputmode="decimal"> €</label><button data-money-pay="snack"></button>
      </div>
      <div class="v121-monthbar"><button type="button" data-month="-1">‹</button><strong id="moneyMonthTitle"></strong><button type="button" data-month="1">›</button></div>
      <div id="moneyMonthHistory"></div>
    </section>

    <section class="child-money-card">
      <div class="child-money-section-head"><div><strong>Geliehen</strong><small>Von wem – an wen – und was ist noch offen?</small></div><button id="childMoneyAddLoan" type="button">+ Eintragen</button></div>
      <form id="childMoneyLoanForm" class="child-money-loan-form hidden"><label>Von<select id="childMoneyFrom"><option value="mama">Mama</option><option value="papa">Papa</option><option value="1">Lou</option><option value="2">Fina</option></select></label><span class="money-arrow">→</span><label>An<select id="childMoneyTo"><option value="1">Lou</option><option value="2">Fina</option><option value="mama">Mama</option><option value="papa">Papa</option></select></label><label>Betrag<input id="childMoneyLoanAmount" inputmode="decimal" required></label><label class="money-note">Notiz<input id="childMoneyLoanNote" placeholder="optional"></label><button type="submit">Speichern</button></form>
      <div id="childMoneyOpenLoans"></div>
    </section>

    <section class="child-money-card">
      <div class="child-money-section-head"><div><strong>Mein Sparziel</strong><small>Ich spare für etwas, das mir wirklich wichtig ist.</small></div><span>🌱</span></div>
      <div class="v121-save-grid"><label>Ziel<input id="savingGoal" placeholder="z. B. etwas Besonderes"></label><label>Zielbetrag<input id="savingTarget" inputmode="decimal" placeholder="0"> €</label></div>
      <div class="v121-save-progress">
        <div class="v122-save-orb" aria-hidden="true"><i id="savingFill"></i><span>✦</span></div>
        <div class="v122-save-copy">
          <strong id="savingStatus"></strong>
          <div class="v122-save-track"><i id="savingTrackFill"></i></div>
          <small id="savingText"></small>
        </div>
      </div>
      <div class="v121-save-actions"><input id="savingAmount" inputmode="decimal" placeholder="Betrag"><button type="button" data-save="plus">+ Sparen</button><button type="button" data-save="minus">− Entnehmen</button></div>
    </section>

    <details class="child-money-card v121-gems v140-gems-collapse">
      <summary class="v140-gems-summary">
        <span class="v140-gems-arrow" aria-hidden="true">▸</span>
        <span class="v140-gems-summary-text">✨ Zusammen geht vieles leichter.</span>
        <span class="v140-gems-summary-icons" aria-hidden="true">💎🌈</span>
      </summary>
      <div class="v140-gems-body">
        <div class="child-money-section-head"><div><strong>Meine Edelsteine 💎</strong><small>Besondere Extras für unser Familienleben.</small></div><strong id="gemCount"></strong></div>
        <div class="v121-gem-explain v128-gem-explain">
          <div class="v128-gem-explain-main">
            <span class="v128-gem-explain-icon" aria-hidden="true">💎</span>
            <div>
              <strong>Besondere Beiträge zu unserem Familienleben</strong>
              <span>Du bekommst Edelsteine, wenn du von dir aus hilfst, jemanden unterstützt oder mithilfst, dass es für uns alle leichter wird.</span>
            </div>
          </div>
          <div class="v128-gem-explain-note">😉 Nicht für jeden Handgriff – sondern für die kleinen Extras, die richtig guttun.</div>
        </div>
        <div id="gemQuote" class="v121-gem-quote"></div>
        <div class="v124-appreciation-picker">
          <label>Wertschätzungszeichen
            <select id="gemPresetSelect" aria-label="Wertschätzungszeichen auswählen"></select>
          </label>
          <div id="gemPresetHint" class="v125-appreciation-subtitle"></div>
        </div>
        <div class="v121-gem-grid">
          <div><div id="gemDots" class="v121-gem-dots"></div><div class="v121-gem-bar"><i id="gemFill"></i></div></div>
          <div class="v121-reward">
            <label>Titel<input id="gemRewardTitle"></label>
            <label>Was genau?<input id="gemRewardText"></label>
            <label>Edelsteine<input id="gemRewardCost" type="number" min="1"></label>
          </div>
        </div>
        <div class="v121-gem-actions"><input id="gemWhy" placeholder="Wofür? (optional)"><button type="button" data-gem="plus">+ 💎</button><button type="button" data-gem="minus">− 💎</button><button type="button" id="gemRedeem">Einlösen</button></div>
      </div>
    </details>

    <details class="child-money-history"><summary><span>Historie</span><small>Bezahlt, gespart & zurückgegeben</small></summary><div id="childMoneyWeeklyHistory"></div><div id="childMoneyLoanHistory"></div><div id="savingHistory"></div><div id="gemHistory"></div></details>
  </div>`;
  document.body.appendChild(d);
  d.querySelector(".child-money-close").onclick=()=>d.close();
  d.addEventListener("click",e=>{if(e.target===d)d.close();});
  d.querySelector("#childMoneyAddLoan").onclick=()=>d.querySelector("#childMoneyLoanForm").classList.toggle("hidden");
  d.querySelectorAll("[data-money-pay]").forEach(b=>b.onclick=()=>{
    const s=childMoneyStore(activeChildMoneyId),k=b.dataset.moneyPay;
    const old=moneyPaymentAt(s,k,new Date());
    setMoneyPayment(s,k,!old?.paid,new Date());
    moneyTouch(activeChildMoneyId);renderChildMoneyDialog();
  });
  d.querySelector("#childPocketAmount").onchange=e=>{childMoneyStore(activeChildMoneyId).weekly.pocketAmount=moneyNumber(e.target.value);moneyTouch(activeChildMoneyId);renderChildMoneyDialog();};
  d.querySelector("#childSnackAmount").onchange=e=>{childMoneyStore(activeChildMoneyId).weekly.snackAmount=moneyNumber(e.target.value);moneyTouch(activeChildMoneyId);renderChildMoneyDialog();};
  d.querySelector("#childPocketFrequency").onchange=e=>{
    const s=childMoneyStore(activeChildMoneyId);
    s.weekly.pocketFrequency=e.target.value==="monthly"?"monthly":"weekly";
    moneyTouch(activeChildMoneyId);renderChildMoneyDialog();
  };
  d.querySelector("#childSnackFrequency").onchange=e=>{
    const s=childMoneyStore(activeChildMoneyId);
    s.weekly.snackFrequency=e.target.value==="monthly"?"monthly":"weekly";
    moneyTouch(activeChildMoneyId);renderChildMoneyDialog();
  };
  d.querySelectorAll("[data-month]").forEach(b=>b.onclick=()=>{const [y,m]=activeMoneyMonth.split("-").map(Number),x=new Date(y,m-1+Number(b.dataset.month),1);activeMoneyMonth=moneyMonthKey(x);renderChildMoneyDialog();});
  d.querySelector("#childMoneyLoanForm").onsubmit=e=>{e.preventDefault();const f=d.querySelector("#childMoneyFrom").value,t=d.querySelector("#childMoneyTo").value,a=moneyNumber(d.querySelector("#childMoneyLoanAmount").value),n=d.querySelector("#childMoneyLoanNote").value.trim();if(!a||f===t)return;const now=Date.now();childMoneyStore(activeChildMoneyId).loans.unshift({id:`money-${now}-${Math.random().toString(36).slice(2,7)}`,from:f,to:t,amount:a,note:n,createdAt:now,updatedAt:now,done:false,doneAt:0});d.querySelector("#childMoneyLoanAmount").value="";d.querySelector("#childMoneyLoanNote").value="";d.querySelector("#childMoneyLoanForm").classList.add("hidden");moneyTouch(activeChildMoneyId);renderChildMoneyDialog();};
  ["savingGoal","savingTarget"].forEach(id=>d.querySelector("#"+id).onchange=e=>{const s=childMoneyStore(activeChildMoneyId);if(id==="savingGoal")s.savings.goal=e.target.value.trim();else s.savings.target=moneyNumber(e.target.value);moneyTouch(activeChildMoneyId);renderChildMoneyDialog();});
  d.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>{const s=childMoneyStore(activeChildMoneyId),a=moneyNumber(d.querySelector("#savingAmount").value);if(!a)return;const delta=b.dataset.save==="minus"?-a:a;s.savings.balance=Math.max(0,Math.round((s.savings.balance+delta)*100)/100);s.savings.history.unshift({id:`save-${Date.now()}`,amount:delta,at:Date.now()});d.querySelector("#savingAmount").value="";moneyTouch(activeChildMoneyId);renderChildMoneyDialog();});
  ["gemRewardTitle","gemRewardText","gemRewardCost"].forEach(id=>d.querySelector("#"+id).onchange=e=>{const g=childMoneyStore(activeChildMoneyId).gems;if(id==="gemRewardTitle")g.rewardTitle=e.target.value.trim();if(id==="gemRewardText")g.rewardText=e.target.value.trim();if(id==="gemRewardCost")g.rewardCost=Math.max(1,Number(e.target.value||1));moneyTouch(activeChildMoneyId);renderChildMoneyDialog();});
  d.querySelector("#gemPresetSelect").onchange=e=>{
    const idx=Number(e.target.value);
    const preset=GEM_APPRECIATION_PRESETS[idx];
    if(!preset) return;
    const g=childMoneyStore(activeChildMoneyId).gems;
    g.rewardTitle=preset.title;
    g.rewardText=preset.text;
    g.rewardCost=preset.cost;
    moneyTouch(activeChildMoneyId);
    renderChildMoneyDialog();
  };
  d.querySelectorAll("[data-gem]").forEach(b=>b.onclick=()=>{const g=childMoneyStore(activeChildMoneyId).gems,plus=b.dataset.gem==="plus",why=d.querySelector("#gemWhy").value.trim();if(!plus&&g.count<=0)return;g.count+=plus?1:-1;g.history.unshift({id:`gem-${Date.now()}`,delta:plus?1:-1,why:why||(plus?"Besonderes Extra":"zurückgenommen"),at:Date.now()});d.querySelector("#gemWhy").value="";moneyTouch(activeChildMoneyId);renderChildMoneyDialog();});
  d.querySelector("#gemRedeem").onclick=()=>{const g=childMoneyStore(activeChildMoneyId).gems;if(g.count<g.rewardCost)return;g.count-=g.rewardCost;g.history.unshift({id:`gem-${Date.now()}`,delta:-g.rewardCost,why:`Wertschätzungszeichen eingelöst: ${g.rewardTitle}`,at:Date.now()});moneyTouch(activeChildMoneyId);renderChildMoneyDialog();};
  d.addEventListener("click",e=>{
    const b=e.target.closest("[data-money-loan-done]");
    if(b){
      const x=childMoneyStore(activeChildMoneyId).loans.find(v=>v.id===b.dataset.moneyLoanDone);
      if(!x)return;
      x.done=true;x.doneAt=Date.now();x.updatedAt=Date.now();
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }
    const del=e.target.closest("[data-saving-delete]");
    if(del){
      const s=childMoneyStore(activeChildMoneyId);
      const x=s.savings.history.find(v=>v.id===del.dataset.savingDelete);
      if(!x)return;
      if(!confirm("Diese Sparbewegung wirklich löschen?")) return;
      s.savings.balance=Math.max(0,Math.round((s.savings.balance-Number(x.amount||0))*100)/100);
      s.savings.history=s.savings.history.filter(v=>v.id!==x.id);
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }

    const reopen=e.target.closest("[data-loan-reopen]");
    if(reopen){
      const s=childMoneyStore(activeChildMoneyId);
      const x=s.loans.find(v=>v.id===reopen.dataset.loanReopen);
      if(!x)return;
      x.done=false;x.doneAt=0;x.updatedAt=Date.now();
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }

    const loanDel=e.target.closest("[data-loan-delete]");
    if(loanDel){
      const s=childMoneyStore(activeChildMoneyId);
      const x=s.loans.find(v=>v.id===loanDel.dataset.loanDelete);
      if(!x)return;
      if(!confirm("Diesen geliehenen Geld-Eintrag wirklich löschen?")) return;
      s.loans=s.loans.filter(v=>v.id!==x.id);
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }

    const gemDel=e.target.closest("[data-gem-history-delete]");
    if(gemDel){
      const s=childMoneyStore(activeChildMoneyId),g=s.gems;
      const x=g.history.find(v=>v.id===gemDel.dataset.gemHistoryDelete);
      if(!x)return;
      if(!confirm("Diesen Edelstein-Eintrag wirklich löschen?")) return;
      g.count=Math.max(0,Number(g.count||0)-Number(x.delta||0));
      g.history=g.history.filter(v=>v.id!==x.id);
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }

    const paymentDel=e.target.closest("[data-payment-delete-kind]");
    if(paymentDel){
      const s=childMoneyStore(activeChildMoneyId);
      const kind=paymentDel.dataset.paymentDeleteKind;
      const when=new Date(paymentDel.dataset.paymentDeleteDate+"T12:00:00");
      if(!confirm("Diese Zahlung wieder auf offen setzen?")) return;
      clearMoneyPayment(s,kind,when);
      moneyTouch(activeChildMoneyId);renderChildMoneyDialog();return;
    }
  });
  return d;
}
function renderChildMoneyDialog(){
  const d=ensureChildMoneyDialog(),s=childMoneyStore(activeChildMoneyId),w=moneyWeekKey();
  d.querySelector("#childMoneyTitle").textContent=moneyPersonName(activeChildMoneyId);
  d.querySelector("#childMoneyWeekLabel").textContent=moneyWeekLabel(w);
  d.querySelector("#childPocketAmount").value=s.weekly.pocketAmount||"";
  d.querySelector("#childSnackAmount").value=s.weekly.snackAmount||"";
  d.querySelector("#childPocketFrequency").value=s.weekly.pocketFrequency||"weekly";
  d.querySelector("#childSnackFrequency").value=s.weekly.snackFrequency||"weekly";
  ["pocket","snack"].forEach(k=>{
    const b=d.querySelector(`[data-money-pay="${k}"]`);
    const pay=moneyPaymentAt(s,k,new Date());
    const ok=!!pay?.paid;
    b.classList.toggle("is-paid",ok);
    b.textContent=ok?"✓ erhalten":"○ noch offen";
    b.title=moneyPeriodLabel(k,s,new Date());
  });
  d.querySelector("#moneyQuote").textContent="✦ "+MONEY_QUOTES[(new Date().getDate()+Number(activeChildMoneyId))%MONEY_QUOTES.length];

  d.querySelector("#moneyMonthTitle").textContent=moneyMonthLabel(activeMoneyMonth);
  const [yy,mm]=activeMoneyMonth.split("-").map(Number); let monthRows=[];
  for(let day=1;day<=31;day++){
    const dt=new Date(yy,mm-1,day,12);
    if(dt.getMonth()!==mm-1) break;
    if(dt.getDay()===1){
      const k=moneyWeekKey(dt);
      const pocket=s.weekly.pocketFrequency==="monthly"
        ? (moneyMonthKey(dt)===activeMoneyMonth?moneyPaymentAt(s,"pocket",dt):null)
        : moneyPaymentAt(s,"pocket",dt);
      const snack=s.weekly.snackFrequency==="monthly"
        ? (moneyMonthKey(dt)===activeMoneyMonth?moneyPaymentAt(s,"snack",dt):null)
        : moneyPaymentAt(s,"snack",dt);
      const dateKeyForButton=dateKey(dt);
      const pocketText=s.weekly.pocketFrequency==="monthly"
        ? `${pocket?.paid?"✓":"○"} Taschengeld · monatlich`
        : `${pocket?.paid?"✓":"○"} Taschengeld`;
      const snackText=s.weekly.snackFrequency==="monthly"
        ? `${snack?.paid?"✓":"○"} Jause · monatlich`
        : `${snack?.paid?"✓":"○"} Jause`;
      const pocketDelete=pocket?.paid?`<button class="v123-history-x" type="button" data-payment-delete-kind="pocket" data-payment-delete-date="${dateKeyForButton}" title="Zahlung wieder auf offen setzen">×</button>`:"";
      const snackDelete=snack?.paid?`<button class="v123-history-x" type="button" data-payment-delete-kind="snack" data-payment-delete-date="${dateKeyForButton}" title="Zahlung wieder auf offen setzen">×</button>`:"";
      monthRows.push(`<div class="child-money-history-row"><span>${moneyWeekLabel(k)}</span><span class="${pocket?.paid?"is-paid":""}">${pocketText}${pocketDelete}</span><span class="${snack?.paid?"is-paid":""}">${snackText}${snackDelete}</span></div>`);
      if(s.weekly.pocketFrequency==="monthly" || s.weekly.snackFrequency==="monthly") break;
    }
  }
  d.querySelector("#moneyMonthHistory").innerHTML=monthRows.join("");

  const open=s.loans.filter(x=>!x.done); d.querySelector("#childMoneyOpenLoans").innerHTML=open.length?open.map(x=>`<div class="child-money-loan-row"><span><strong>${escapeHtml(moneyPersonName(x.from))}</strong> → <strong>${escapeHtml(moneyPersonName(x.to))}</strong>${x.note?`<small>${escapeHtml(x.note)}</small>`:""}</span><b>${moneyEuro(x.amount)}</b><button data-money-loan-done="${escapeHtml(x.id)}">✓ zurück</button></div>`).join(""):`<div class="child-money-empty">Alles ausgeglichen. ✦</div>`;

  d.querySelector("#savingGoal").value=s.savings.goal||"";d.querySelector("#savingTarget").value=s.savings.target||"";
  const sp=s.savings.target?Math.min(100,Math.round(s.savings.balance/s.savings.target*100)):0;
  d.querySelector("#savingFill").style.height=sp+"%";
  d.querySelector("#savingTrackFill").style.width=sp+"%";
  d.querySelector("#savingStatus").textContent=s.savings.target?`${moneyEuro(s.savings.balance)} von ${moneyEuro(s.savings.target)} · ${sp}%`:`${moneyEuro(s.savings.balance)} gespart`;
  d.querySelector("#savingText").textContent=sp>=100?"Geschafft! ✨ Du hast für etwas gespart, das dir wirklich wichtig war.":sp>=50?"Mehr als die Hälfte geschafft – dein Ziel kommt näher. ✨":"Jeder gesparte Euro bringt dich deinem Wunsch ein Stück näher.";

  const g=s.gems,cost=Math.max(1,g.rewardCost),gp=Math.min(100,Math.round(g.count/cost*100));
  d.querySelector("#gemCount").textContent=`${g.count} 💎`;
  d.querySelector("#gemQuote").textContent="✨ "+GEM_QUOTES[(new Date().getDate()+Number(activeChildMoneyId))%GEM_QUOTES.length];
  const presetSelect=d.querySelector("#gemPresetSelect");
  presetSelect.innerHTML=`<option value="">Wertschätzungszeichen auswählen …</option>`+GEM_APPRECIATION_PRESETS.map((x,i)=>`<option value="${i}">${x.cost} 💎 · ${escapeHtml(x.title)}</option>`).join("");
  const presetIndex=GEM_APPRECIATION_PRESETS.findIndex(x=>x.cost===cost&&x.title===g.rewardTitle&&x.text===g.rewardText);
  presetSelect.value=presetIndex>=0?String(presetIndex):"";
  const hint=d.querySelector("#gemPresetHint");
  if(hint){
    hint.textContent=presetIndex>=0 ? GEM_APPRECIATION_PRESETS[presetIndex].text : (g.rewardText||"");
  }
  d.querySelector("#gemRewardTitle").value=g.rewardTitle;
  d.querySelector("#gemRewardText").value=g.rewardText;
  d.querySelector("#gemRewardCost").value=cost;d.querySelector("#gemDots").innerHTML=Array.from({length:cost},(_,i)=>`<span class="${i<g.count?"on":""}">◆</span>`).join("");d.querySelector("#gemFill").style.width=gp+"%";const rb=d.querySelector("#gemRedeem");rb.disabled=g.count<cost;rb.textContent=g.count>=cost?`🎉 ${g.rewardTitle} einlösen`:`Noch ${Math.max(0,cost-g.count)} 💎`;

  let rows=[];const cur=new Date(w+"T12:00:00");
  for(let i=0;i<8;i++){
    const z=new Date(cur);z.setDate(cur.getDate()-7*i);
    const k=moneyWeekKey(z);
    const qp=moneyPaymentAt(s,"pocket",z), qs=moneyPaymentAt(s,"snack",z);
    const zKey=dateKey(z);
    const pDel=qp?.paid?`<button class="v123-history-x" type="button" data-payment-delete-kind="pocket" data-payment-delete-date="${zKey}" title="Zahlung wieder auf offen setzen">×</button>`:"";
    const sDel=qs?.paid?`<button class="v123-history-x" type="button" data-payment-delete-kind="snack" data-payment-delete-date="${zKey}" title="Zahlung wieder auf offen setzen">×</button>`:"";
    rows.push(`<div class="child-money-history-row"><span>${moneyWeekLabel(k)}</span><span class="${qp?.paid?"is-paid":""}">${qp?.paid?"✓":"○"} Taschengeld${s.weekly.pocketFrequency==="monthly"?" · Monat":""}${pDel}</span><span class="${qs?.paid?"is-paid":""}">${qs?.paid?"✓":"○"} Jause${s.weekly.snackFrequency==="monthly"?" · Monat":""}${sDel}</span></div>`);
  }
  /* V146 – Historie kompakt:
     Nur Wochen mit tatsächlich verbuchter Zahlung anzeigen und standardmäßig einklappen.
     Zahlungs-/Sync-Logik bleibt unverändert. */
  const paidRows=rows.filter(row=>row.includes("✓"));
  d.querySelector("#childMoneyWeeklyHistory").innerHTML=`
    <details class="v146-payment-history">
      <summary>Letzte Zahlungen</summary>
      <div class="v146-payment-history-body">
        ${paidRows.length?paidRows.join(""):`<div class="child-money-empty">Noch keine Zahlungen.</div>`}
      </div>
    </details>`;
  const done=s.loans.filter(x=>x.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));{
    const visibleDone=done.slice(0,20);
    const olderDone=done.slice(20);
    const row=x=>`<div class="child-money-history-row v123-loan-history-row"><span>✓ ${escapeHtml(moneyPersonName(x.from))} → ${escapeHtml(moneyPersonName(x.to))}</span><b>${moneyEuro(x.amount)}</b><small>${new Date(x.doneAt).toLocaleDateString("de-AT")}</small><span class="v123-history-actions"><button type="button" data-loan-reopen="${escapeHtml(x.id)}" title="Wieder als offen anzeigen">↩</button><button type="button" data-loan-delete="${escapeHtml(x.id)}" title="Eintrag löschen">×</button></span></div>`;
    d.querySelector("#childMoneyLoanHistory").innerHTML=`<h4>Zurückbezahlt</h4>${visibleDone.length?visibleDone.map(row).join(""):`<div class="child-money-empty">Noch keine erledigten Einträge.</div>`}${olderDone.length?`<details class="v126-older-history"><summary>${olderDone.length} ältere Einträge anzeigen</summary>${olderDone.map(row).join("")}</details>`:""}`;
  }
  {
    const savingRow=x=>`<div class="child-money-history-row v122-saving-history-row"><span>${x.amount>=0?"+":"−"} ${moneyEuro(Math.abs(x.amount))}</span><small>${new Date(x.at).toLocaleDateString("de-AT")}</small><button type="button" data-saving-delete="${escapeHtml(x.id)}" title="Sparbewegung löschen">×</button></div>`;
    const visibleSaving=s.savings.history.slice(0,20);
    const olderSaving=s.savings.history.slice(20);
    d.querySelector("#savingHistory").innerHTML=`<h4>Sparen</h4>${visibleSaving.length?visibleSaving.map(savingRow).join(""):`<div class="child-money-empty">Noch keine Sparbewegung.</div>`}${olderSaving.length?`<details class="v126-older-history"><summary>${olderSaving.length} ältere Einträge anzeigen</summary>${olderSaving.map(savingRow).join("")}</details>`:""}`;
  }
  const gemHistoryHost=d.querySelector("#gemHistory");
  if(gemHistoryHost) gemHistoryHost.innerHTML="";
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-school-open-money]");if(!b)return;activeChildMoneyId=String(b.dataset.schoolOpenMoney||"1");activeMoneyMonth=moneyMonthKey();renderChildMoneyDialog();const d=ensureChildMoneyDialog();typeof d.showModal==="function"?d.showModal():d.setAttribute("open","");});


// V138 – nur Handy: Das eigentliche Texteingabefeld klar als TERMIN markieren.
(function(){
  const field=document.querySelector("#todoText");
  if(!field) return;
  const desktopPlaceholder=field.getAttribute("placeholder") || "";
  const setMobileTerminPlaceholder=()=>{
    field.setAttribute("placeholder", window.matchMedia("(max-width:700px)").matches ? "TERMIN HIER EINGEBEN …" : desktopPlaceholder);
  };
  setMobileTerminPlaceholder();
  window.addEventListener("resize", setMobileTerminPlaceholder);
})();
