// WICHTIGES PROJEKT-PRINZIP:
// Die App muss vollständig kostenlos nutzbar bleiben.
// Keine Funktionen einbauen, die Blaze/Billing, Firebase Storage oder andere kostenpflichtige Dienste voraussetzen.

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

const WEEK_DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

const state = {
  videos: JSON.parse(localStorage.getItem("balanceProd.videos") || "[]"),
  todos: JSON.parse(localStorage.getItem("balanceProd.todos") || "[]"),
  archive: JSON.parse(localStorage.getItem("balanceProd.archive") || "[]"),
  shopping: JSON.parse(localStorage.getItem("balanceProd.shopping") || "[]"),
  recipes: JSON.parse(localStorage.getItem("balanceProd.recipes") || "[]"),
  meals: JSON.parse(localStorage.getItem("balanceProd.meals") || "{}"),
  pinboard: JSON.parse(localStorage.getItem("balanceProd.pinboard") || "[]"),
  timeTracking: JSON.parse(localStorage.getItem("balanceProd.timeTracking") || '{"entries":[],"active":null}'),
  recipeLinkFeedback: JSON.parse(localStorage.getItem("balanceProd.recipeLinkFeedback") || "{}"),

  workroom: JSON.parse(
    localStorage.getItem("balanceProd.workroom") ||
    '{"todos":[],"prints":[],"links":[],"substitutions":[],"plans":{"week":[],"year":[]}}'
  ),

  settings: {
    schoolYear: localStorage.getItem("balanceProd.schoolYear") || "2026-27",
    familyBorderWidth: localStorage.getItem("balanceProd.familyBorderWidth") || "3"
  }
};

// Werkraum-Daten aus älteren Versionen sicher ergänzen.
state.workroom = state.workroom || {};
state.workroom.todos = Array.isArray(state.workroom.todos) ? state.workroom.todos : [];
state.workroom.prints = Array.isArray(state.workroom.prints) ? state.workroom.prints : [];
state.workroom.links = Array.isArray(state.workroom.links) ? state.workroom.links : [];
state.workroom.substitutions = Array.isArray(state.workroom.substitutions) ? state.workroom.substitutions : [];
state.recipes = Array.isArray(state.recipes) ? state.recipes : [];
state.meals = state.meals && typeof state.meals === "object" ? state.meals : {};
state.pinboard = Array.isArray(state.pinboard) ? state.pinboard : [];
state.timeTracking = state.timeTracking && typeof state.timeTracking === "object"
  ? state.timeTracking
  : {entries:[], active:null};
state.timeTracking.entries = Array.isArray(state.timeTracking.entries) ? state.timeTracking.entries : [];
state.timeTracking.active = state.timeTracking.active && typeof state.timeTracking.active === "object"
  ? state.timeTracking.active
  : null;
state.recipeLinkFeedback = state.recipeLinkFeedback && typeof state.recipeLinkFeedback === "object"
  ? state.recipeLinkFeedback
  : {};

let shoppingItems = state.shopping;
let cloudReady = false;
let cloudApplying = false;
let cloudSaveTimer = null;
let cloudUnsubscribe = null;


function snapshotPersistentState() {
  return {
    savedAt: Date.now(),
    videos: state.videos,
    todos: state.todos,
    archive: state.archive,
    shopping: state.shopping,
    recipes: state.recipes,
    meals: state.meals,
    pinboard: state.pinboard,
    timeTracking: state.timeTracking,
    recipeLinkFeedback: state.recipeLinkFeedback,
    workroom: state.workroom,
    school: state.school,
    familySettings: state.familySettings,
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
  makeLocalSafetyBackup();
  localStorage.setItem("balanceProd.videos", JSON.stringify(state.videos));
  localStorage.setItem("balanceProd.todos", JSON.stringify(state.todos));
  localStorage.setItem("balanceProd.archive", JSON.stringify(state.archive));
  localStorage.setItem("balanceProd.shopping", JSON.stringify(state.shopping));
  localStorage.setItem("balanceProd.recipes", JSON.stringify(state.recipes));
  localStorage.setItem("balanceProd.meals", JSON.stringify(state.meals));
  localStorage.setItem("balanceProd.pinboard", JSON.stringify(state.pinboard));
  localStorage.setItem("balanceProd.timeTracking", JSON.stringify(state.timeTracking));
  localStorage.setItem("balanceProd.recipeLinkFeedback", JSON.stringify(state.recipeLinkFeedback));
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
    archive: state.archive,
    shopping: state.shopping,
    recipes: state.recipes,
    meals: state.meals,
    pinboard: state.pinboard,
    timeTracking: state.timeTracking,
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
      await pinboardAudioContext.resume();
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
      state.pinboard = state.pinboard.filter(message => message.id !== btn.dataset.id);
      save();
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
      setTimeout(() => {
        playPinboardSound(newest?.sound || "letter");
      }, 80);
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

function schoolYearKey(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function firstWeekdayOfMonth(year, monthIndex, weekday) {
  const d = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const shift = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + shift);
  return d;
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

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
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

function schoolYearConfig(key) {
  if (NOE_SCHOOL_YEARS[key]?.start) return NOE_SCHOOL_YEARS[key];
  const startYear = Number(String(key || "").slice(0, 4));
  return Number.isFinite(startYear) ? generatedNoeSchoolYear(startYear) : NOE_SCHOOL_YEARS["2026-27"];
}

function activeSchoolYear(){
  return schoolYearConfig(state.settings.schoolYear || "2026-27");
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
  return WEEK_DAYS[(date.getDay() + 6) % 7];
}

function dateForWeekday(monday, dayName) {
  const idx = WEEK_DAYS.indexOf(dayName);
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
  state.school.children[id].deletedTaskIds=Array.isArray(state.school.children[id].deletedTaskIds)?state.school.children[id].deletedTaskIds:[];
  state.school.children[id].deletedLinkIds=Array.isArray(state.school.children[id].deletedLinkIds)?state.school.children[id].deletedLinkIds:[];
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

  WEEK_DAYS.forEach((day, index) => {
    const dayEl = document.createElement("article");
    dayEl.className = "day";

const date = dayDate(currentWeekMonday, index);

const today = new Date();
today.setHours(0, 0, 0, 0);

const compareDate = new Date(date);
compareDate.setHours(0, 0, 0, 0);

if (compareDate.getTime() === today.getTime()) {
  dayEl.classList.add("today");
}

const dateLabel = date.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"});
    const holidayName = austrianPublicHoliday(date);
    const holidayHtml = holidayName
      ? `<div class="day-holiday" title="Gesetzlicher Feiertag in Österreich">✦ ${escapeHtml(holidayName)}</div>`
      : "";

    const videos = state.videos.filter(v => v.day === day && v.weekKey === weekKey);
    const occurrences = state.todos.filter(t => occursOnDate(t, date));
 const todos = occurrences.filter(t => {
  if ((t.type || "todo") !== "todo") return false;

  // Wiederkehrende To-dos werden weiterhin über ihre einzelnen Vorkommen behandelt
  if (t.recurrence && t.recurrence !== "none") return true;

  // Nicht erledigt → ganz normal anzeigen
  if (!t.done) return true;

  // Alte erledigte To-dos ohne completedAt vorerst weiterhin anzeigen
  if (!t.completedAt) return true;

  // Erledigt: nur am Tag der Erledigung noch anzeigen
  const completedDay = new Date(t.completedAt);
  completedDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return completedDay.getTime() === today.getTime();
});
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
               <span>
  ${t.superImportant ? `<span class="tiny-star">★</span>` : ''}
  ${escapeHtml(t.text)}
  ${isNewEntry(t) ? `<span class="new-entry-badge">NEU</span>` : ""}
</span>
              </label>
            `).join("")}
          </div>
        `).join("")}
      </div>
    ` : "";

const eventHtml = events.length ? `
  <div class="day-events">
    <div class="day-todos-title">Termine</div>

    ${groupTodosByPerson(events).map(([groupKey, groupItems]) => `
      <div class="person-todo-group grouped-family-block ${groupAccentClass(groupKey)}"
           style="${groupKey === "shared"
             ? `--group-border:${sharedGroupGradient(groupItems)}`
             : `--group-border:${familyColor(groupKey) || "#c8c0ba"}`}">

        <div class="person-todo-group-title">${todoGroupLabel(groupKey)}</div>

        ${groupItems
          .sort((a,b) => (a.time || "").localeCompare(b.time || ""))
          .map(t => {
            const eventCategory = t.eventCategory || "normal";

            const eventMeta = {
              normal:      { icon: "✦", label: "" },
              birthday:    { icon: "🎂", label: "Geburtstag" },
              nameday:     { icon: "🌷", label: "Namenstag" },
              anniversary: { icon: "♡", label: "Jahrestag" },
              holiday:     { icon: "✦", label: "Feiertag" }
            }[eventCategory] || { icon: "✦", label: "" };

            const eventIcon = eventMeta.icon;
            const eventLabel = eventMeta.label;

            const currentKey = dateKey(date);
            const startKey = t.date || "";
            const endKey = t.endDate || startKey;

            let displayTime = "";

            if (startKey === endKey) {
              if (t.time) {
                displayTime = t.time + (t.endTime ? "–" + t.endTime : "");
              }
            } else if (currentKey === startKey) {
              displayTime = t.time || "";
            } else if (currentKey === endKey) {
              displayTime = t.endTime ? "bis " + t.endTime : "";
            }

            return `
              <div class="event-mini event-display grouped-todo-row ${t.superImportant ? "super-important" : ""}">
                <span class="event-symbol">${eventIcon}</span>
                <span class="event-copy">
                  ${displayTime ? `<strong>${escapeHtml(displayTime)}</strong>` : ""}
                  ${eventLabel ? `<span class="event-kind">${eventLabel}</span>` : ""}
                  ${t.superImportant ? `<span class="tiny-star">★</span>` : ""}
                 ${escapeHtml(t.text)}
${isNewEntry(t) ? `<span class="new-entry-badge">NEU</span>` : ""}
                </span>
              </div>
            `;
          }).join("")}

      </div>
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

    // Essen bewusst ganz unten im Tag, direkt vor dem Video.
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
      ${holidayHtml}
      ${(() => { const rows=["1","2"].map(cid=>{const tm=homeByForDate(cid,date),c=state.school.children[cid];return tm?`<span><b>${escapeHtml(c.name)}</b> <strong class="home-by-time">${escapeHtml(tm)}</strong></span>`:""}).filter(Boolean);return rows.length?`<div class="home-by-strip home-by-top"><span class="home-by-label">⌂ zu Hause bis</span>${rows.join("")}</div>`:"";})()}
      ${schoolHtml}
      ${eventHtml}
      ${todoHtml}
      ${mealHtml}
      ${videoHtml}
    `;
    grid.appendChild(dayEl);
  });

  // Am Handy direkt den heutigen Tag zeigen, wenn die aktuelle Woche geöffnet ist.
  if (
    window.matchMedia("(max-width:760px)").matches &&
    currentWeekKey() === dateKey(getMonday(new Date()))
  ) {
    requestAnimationFrame(() => {
      const todayCard = grid.querySelector(".day.today");
      if (todayCard) {
        todayCard.scrollIntoView({behavior:"auto", block:"start", inline:"nearest"});
      }
    });
  }

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

  document.querySelectorAll(".school-week-check").forEach(el => el.addEventListener("change", e => {
    const childId = e.currentTarget.dataset.child;
    const taskId = e.currentTarget.dataset.id;
    const child = state.school.children[childId];
    const task = child?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const wasDone = !!task.done;
    task.done = e.currentTarget.checked;
    task.updatedAt = Date.now();

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
 
  if (todoFilter === "work" || todoFilter === "private") todos = todos.filter(t => t.area === todoFilter);
  if (todoFilter === "todo" || todoFilter === "event") todos = todos.filter(t => (t.type || "todo") === todoFilter);
  if (todoFilter === "latest") {
  todos = todos.filter(t => isNewEntry(t));
}
todos.sort((a, b) => {
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
                  ${t.plingEnabled ? `<span class="pill pling-pill" title="Erinnerung aktiviert">🔔 ${Number(t.plingMinutes) || 15} Min.</span>` : ""}
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
    if (item.done) {
  item.completedAt = Date.now();
} else {
  item.completedAt = null;
}
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
document.querySelector("#eventEndDate").value = item.endDate || "";
document.querySelector("#eventTime").value = item.time || "";
document.querySelector("#eventEndTime").value = item.endTime || "";

const plingEnabled = document.querySelector("#eventPlingEnabled");
const plingMinutes = document.querySelector("#eventPlingMinutes");

if (plingEnabled) plingEnabled.checked = !!item.plingEnabled;
if (plingMinutes) plingMinutes.value = String(item.plingMinutes || 15);

document.querySelector("#eventCategory").value = item.eventCategory || "normal";
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


// =========================================================
// UNSER ÜBERBLICK – Zeit im Blick & Online-Rezepte
// =========================================================
function timeCategoryLabel(key) {
  return {
    pc: "🖥 PC & Büro",
    prep: "✂ Vorbereitung",
    household: "🏡 Haushalt",
    repair: "🔧 Reparaturen",
    organize: "🗂 Organisieren",
    errands: "🛒 Erledigungen",
    garden: "🌿 Garten & draußen",
    help: "🤝 Helfen & Unterstützen",
    school: "✏ Lernen & Schule",
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

function saveTimeTrackingImmediately() {
  try {
    localStorage.setItem(TIME_TRACKING_LOCAL_KEY, JSON.stringify(state.timeTracking));
  } catch (err) {
    console.warn("Zeitdaten konnten lokal nicht gespeichert werden:", err);
  }
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

    // Eine lokal laufende Stoppuhr niemals durch einen leeren Cloud-Stand verlieren.
    if (local.active && typeof local.active === "object") {
      if (!state.timeTracking.active ||
          Number(local.active.startedAt || 0) >= Number(state.timeTracking.active.startedAt || 0)) {
        state.timeTracking.active = local.active;
      }
    }
  } catch (err) {
    console.warn("Lokale Zeitdaten konnten nicht wiederhergestellt werden:", err);
  }
}

function formatElapsedWithSeconds(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - Number(startedAt || Date.now())) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

let liveTimeTicker = null;

function startLiveTimeTicker() {
  clearInterval(liveTimeTicker);
  if (!state.timeTracking.active) return;

  liveTimeTicker = setInterval(() => {
    const el = document.querySelector("#activeTimeElapsed");
    if (el && state.timeTracking.active) {
      el.textContent = formatElapsedWithSeconds(state.timeTracking.active.startedAt);
    }
  }, 1000);
}

function renderTimeTracking() {
  const list = document.querySelector("#timeLogList");
  const activeBox = document.querySelector("#activeTimeTracker");
  const chips = document.querySelector("#timeSummaryChips");
  if (!list || !activeBox || !chips) return;

  const active = state.timeTracking.active;

  if (active) {
    activeBox.classList.remove("hidden");
    activeBox.innerHTML = `
      <div>
        <span class="active-time-person">${escapeHtml(familyName(active.person))}</span>
        <strong>${escapeHtml(timeCategoryLabel(active.category))}</strong>
        <small>${escapeHtml(active.note || "")}</small>
      </div>
      <div class="active-time-right">
        <span id="activeTimeElapsed" class="active-time-elapsed">${formatElapsedWithSeconds(active.startedAt)}</span>
        <button id="stopTimeTrackBtn" class="secondary-btn" type="button">■ Stoppen</button>
      </div>
    `;
    activeBox.querySelector("#stopTimeTrackBtn")?.addEventListener("click", stopTimeTracking);
  } else {
    activeBox.classList.add("hidden");
    activeBox.innerHTML = "";
  }

  const weekStart = weekStartForDate();
  const weekEntries = state.timeTracking.entries.filter(entry =>
    Number(entry.endedAt || entry.createdAt || 0) >= weekStart.getTime()
  );

  const totals = {};
  weekEntries.forEach(entry => {
    totals[entry.category] = (totals[entry.category] || 0) + Number(entry.minutes || 0);
  });

  chips.innerHTML = Object.entries(totals)
    .sort((a,b) => b[1] - a[1])
    .map(([category, minutes]) => `
      <span class="time-summary-chip">
        ${escapeHtml(timeCategoryLabel(category))}
        <strong>${formatMinutes(minutes)}</strong>
      </span>
    `).join("") || `<span class="time-summary-empty">Noch keine Zeiten diese Woche.</span>`;

  const entries = state.timeTracking.entries
    .slice()
    .sort((a,b) => Number(b.endedAt || b.createdAt || 0) - Number(a.endedAt || a.createdAt || 0))
    .slice(0, 14);

  list.innerHTML = entries.length ? entries.map(entry => `
    <div class="time-log-row">
      <span class="time-log-person">${escapeHtml(familyName(entry.person))}</span>
      <span class="time-log-category">${escapeHtml(timeCategoryLabel(entry.category))}</span>
      <span class="time-log-note">${escapeHtml(entry.note || "")}</span>
      <strong>${formatMinutes(entry.minutes)}</strong>
      <button type="button" class="time-log-delete" data-id="${entry.id}" title="Eintrag löschen">×</button>
    </div>
  `).join("") : `<div class="overview-empty">Noch keine Zeiten eingetragen.</div>`;

  list.querySelectorAll(".time-log-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      state.timeTracking.entries = state.timeTracking.entries.filter(entry => entry.id !== btn.dataset.id);
      saveTimeTrackingImmediately();
      save();
      renderTimeTracking();
    });
  });

  startLiveTimeTicker();
}

function startTimeTracking() {
  if (state.timeTracking.active) {
    showMotivation("Es läuft bereits eine Zeit.");
    return;
  }

  state.timeTracking.active = {
    id: uid(),
    person: document.querySelector("#timeTrackPerson")?.value || "a",
    category: document.querySelector("#timeTrackCategory")?.value || "pc",
    note: document.querySelector("#timeTrackNote")?.value.trim() || "",
    startedAt: Date.now()
  };

  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}

function stopTimeTracking() {
  const active = state.timeTracking.active;
  if (!active) return;

  const endedAt = Date.now();
  const minutes = Math.max(1, Math.round((endedAt - Number(active.startedAt || endedAt)) / 60000));

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

  state.timeTracking.active = null;
  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}

function addManualTimeEntry() {
  const minutesInput = document.querySelector("#manualTimeMinutes");
  const minutes = Math.round(Number(minutesInput?.value || 0));
  if (!minutes || minutes < 1) {
    minutesInput?.focus();
    return;
  }

  const now = Date.now();
  state.timeTracking.entries.push({
    id: uid(),
    person: document.querySelector("#timeTrackPerson")?.value || "a",
    category: document.querySelector("#timeTrackCategory")?.value || "pc",
    note: document.querySelector("#timeTrackNote")?.value.trim() || "",
    startedAt: now - minutes * 60000,
    endedAt: now,
    createdAt: now,
    updatedAt: now,
    minutes
  });

  if (minutesInput) minutesInput.value = "";
  saveTimeTrackingImmediately();
  save();
  renderTimeTracking();
}

function collectInternetRecipeLinks() {
  const map = new Map();

  (state.recipes || []).forEach(recipe => {
    const urls = [recipe.webUrl, recipe.youtubeUrl].filter(Boolean);
    urls.forEach(url => {
      const key = String(url).trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          url:key,
          label:recipe.title || "Rezept",
          source:"Rezeptkarte"
        });
      }
    });
  });

  Object.values(state.meals || {}).forEach(meal => {
    if (!meal || typeof meal !== "object" || !meal.url) return;
    const key = String(meal.url).trim();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        url:key,
        label:meal.label || "Rezeptlink",
        source:"Essensplan"
      });
    }
  });

  return [...map.values()].sort((a,b) => String(a.label).localeCompare(String(b.label), "de"));
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
    host.innerHTML = `<div class="overview-empty">Noch keine Internetrezepte hinterlegt.</div>`;
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
        </div>

        <div class="recipe-link-rating">
          <button type="button" class="recipe-link-rate ${feedback.rating === "love" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="love">💛 Sehr gern wieder</button>
          <button type="button" class="recipe-link-rate ${feedback.rating === "okay" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="okay">🙂 Passt gut</button>
          <button type="button" class="recipe-link-rate ${feedback.rating === "no" ? "active" : ""}" data-url="${escapeHtml(link.url)}" data-rating="no">🌿 Eher nicht</button>
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
}

document.querySelector("#startTimeTrackBtn")?.addEventListener("click", startTimeTracking);
document.querySelector("#addManualTimeBtn")?.addEventListener("click", addManualTimeEntry);

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
      ["super","💛 Sehr gern", byNewest(items.filter(x => x.rating === "super"))],
      ["okay","🙂 Passt gut", byNewest(items.filter(x => x.rating === "okay"))],
      ["nope","🌿 Eher nicht", byNewest(items.filter(x => x.rating === "nope"))]
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
  const ratingLabel = {super:"💛 Sehr gern", okay:"🙂 Passt gut", nope:"🌿 Eher nicht"};
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
function closeManualTimetableEditor(id){
  document.querySelector(`#manualTimetableWrap${id}`)?.classList.add("hidden");
  if (id === "mama" && familyTimetableDialog?.open) {
    document.querySelector("#familyTimetableDialog .family-timetable-buttons")?.classList.remove("hidden");
    familyTimetableDialog.close();
  }
}
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
    const deletedTaskIds = new Set(c.deletedTaskIds || []);
    const deletedLinkIds = new Set(c.deletedLinkIds || []);
    const tasks=[...c.tasks]
      .filter(t => !deletedTaskIds.has(t.id))
      .sort((a,b)=>(a.done-b.done)||((a.due||"9999").localeCompare(b.due||"9999")));
    te.innerHTML=tasks.length?tasks.map(t=>`<div class="school-task ${t.done?"done":""}">
      <input class="check school-check" data-child="${id}" data-id="${t.id}" type="checkbox" ${t.done?"checked":""}>
      <div><div class="school-task-text">${escapeHtml(t.text)}</div><div class="school-meta"><span>${{homework:"☀ Hausübung",test:"✎ Test",bring:"♥ Mitbringen",appointment:"○ Termin",other:"✦ Schule"}[t.type] || "✦ Schule"}</span>${t.subject?`<span>${escapeHtml(t.subject)}</span>`:""}${t.due?`<span>bis ${parseLocalDate(t.due).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"})}</span>`:""}</div></div>
      <button class="school-del" data-kind="task" data-child="${id}" data-id="${t.id}">×</button></div>`).join(""):'<div class="school-empty">Gerade ist hier nichts offen. 🌿</div>';
    const visibleLinks = c.links.filter(x => !deletedLinkIds.has(x.id));
    le.innerHTML=visibleLinks.length?visibleLinks.map(x=>`<div class="school-link"><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.name)}</a><button class="school-del" data-kind="link" data-child="${id}" data-id="${x.id}">×</button></div>`).join(""):'<span class="school-empty-inline">Noch keine Lernlinks hinterlegt.</span>';
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
    t.updatedAt = Date.now();
    save();
    renderAll();
    if(!was && t.done) showMotivation(schoolMotivationalMessage(childHasNoOpenHomework(c)));
  }));
  document.querySelectorAll(".school-del").forEach(x=>x.addEventListener("click",e=>{
    const d=e.currentTarget.dataset,c=state.school.children[d.child];

    if(d.kind==="task"){
      c.deletedTaskIds = Array.isArray(c.deletedTaskIds) ? c.deletedTaskIds : [];
      if(!c.deletedTaskIds.includes(d.id)) c.deletedTaskIds.push(d.id);
      c.tasks = c.tasks.filter(z=>z.id!==d.id);
    } else {
      c.deletedLinkIds = Array.isArray(c.deletedLinkIds) ? c.deletedLinkIds : [];
      if(!c.deletedLinkIds.includes(d.id)) c.deletedLinkIds.push(d.id);
      c.links = c.links.filter(z=>z.id!==d.id);
    }

    c.updatedAt = Date.now();
    save();
    renderAll();
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
    done:false,
    createdAt: Date.now(),
    updatedAt: Date.now()
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
  state.school.children[id].links.push({id:uid(),name:n.value.trim(),url,createdAt:Date.now(),updatedAt:Date.now()});n.value="";u.value="";save();renderAll();
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
      renderAll();

      const sy = activeSchoolYear();
      showMotivation(`Schuljahr ${sy.label} ist jetzt ausgewählt.`);
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
let familyTimetableMode = "view";

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

document.querySelector("#openFamilyTimetableBtn")?.addEventListener("click", () => {
  openFamilyTimetableChooser("view");
});

document.querySelector("#openSchoolTimetableEditorBtn")?.addEventListener("click", () => {
  openFamilyTimetableChooser("edit");
});

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

document.querySelector("#openWorkTimetableBtn")?.addEventListener("click", openMamaTimetableEditorDirect);

function closeFamilyTimetableEditorDialog() {
  document.querySelector("#manualTimetableWrapmama")?.classList.add("hidden");
  document.querySelector("#familyTimetableDialog .family-timetable-buttons")?.classList.remove("hidden");
  familyTimetableDialog?.close();
}

document.querySelector("#closeFamilyTimetableDialog")?.addEventListener("click", closeFamilyTimetableEditorDialog);

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

const undatedTodos = state.todos
  .filter(t =>
    (t.type || "todo") === "todo" &&
    papaEntryIsRelevant(t) &&
    papaTodoIsVisible(t) &&
    (!t.day || t.day === "") &&
    t.weekKey === dateKey(monday)
  );

  WEEK_DAYS.forEach((dayName, index) => {
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

if (undatedTodos.length) {
  weekEntries.unshift({
    dayName: "Diese Woche",
    date: monday,
    entries: undatedTodos
  });
}
  
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
${(() => {
  const events = day.entries.filter(t => t.type === "event");
  const todos = day.entries.filter(t => t.type !== "event");

  const renderEvent = t => {
    let time = "";

    if (t.time && t.endTime) {
      time = `${t.time}–${t.endTime}`;
    } else if (t.time) {
      time = t.time;
    } else if (t.endTime) {
      time = `bis ${t.endTime}`;
    }

    return `
      <div class="papa-overview-entry event">
        <span class="papa-overview-symbol">✦</span>
        <span class="papa-overview-entry-text">
          ${time ? `<strong>${escapeHtml(time)}</strong> ` : ""}
          ${escapeHtml(t.text || "")}
        </span>
      </div>
    `;
  };

  const renderTodo = t => `
    <div class="papa-overview-entry todo">
      <span class="papa-overview-symbol">☐</span>
      <span class="papa-overview-entry-text">
        ${escapeHtml(t.text || "")}
      </span>
    </div>
  `;

  return `
    ${events.length ? `
      <div class="papa-overview-group">
        <div class="papa-overview-group-label">Termine</div>
        ${events.map(renderEvent).join("")}
      </div>
    ` : ""}

    ${todos.length ? `
      <div class="papa-overview-group">
        <div class="papa-overview-group-label">To-dos</div>
        ${todos.map(renderTodo).join("")}
      </div>
    ` : ""}
  `;
})()}

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

    if (familyTimetableMode === "view") {
      familyTimetableDialog?.close();
      showManualTimetable(person);
      return;
    }

    if (person === "1" || person === "2") {
      familyTimetableDialog?.close();
      openManualTimetableEditor(person);
      return;
    }

    if (person === "mama") {
      renderTTMatrix("mama");
      document.querySelector("#manualTimetableWrapmama")?.classList.remove("hidden");
    }
  });
});
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
  renderSchoolWorkTodos();
  renderSchoolPrints();
  renderWorkroomLinks();
  renderRecipes();
  renderMealPlan();
  renderPinboard();
  renderSubstitutions();
  renderShopping();

  // Defensive Aktualisierung: wenn Einkauf sichtbar ist, Rezeptkarten immer neu aufbauen.
  if (document.querySelector("#shopping")?.classList.contains("active")) {
    renderRecipes();
    renderMealPlan();
  }
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

  // Der Rezeptbereich wird beim Öffnen von Einkauf immer aus dem aktuellen State neu aufgebaut.
  // So bleiben gespeicherte Rezepte nach Login/Cloud-Sync zuverlässig sichtbar.
  if (btn.dataset.view === "shopping") {
    const categoryFilter = document.querySelector("#recipeCategoryFilter");
    if (!recipeCategoryTouched && categoryFilter) {
      activeRecipeCategory = "all";
      categoryFilter.value = "all";
    }
    renderRecipes();
    renderMealPlan();
  }
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

// ===== EINKAUF – REZEPTKARTEN =====
let activeRecipeDifficulty = "all";
let activeRecipeCategory = "all";
let recipeCategoryTouched = false;
let recipeKidsOnly = false;
let recipeHealthyOnly = false;
let activeRecipeSearch = "";
let mealPlanWeekOffset = 0;
let recipePage = 0;
const RECIPE_PAGE_SIZE = 10;
let editingRecipeId = null;

function resetRecipeForm() {
  ["#recipeTitle","#recipeTime","#recipeIngredients","#recipeSteps","#recipeWebUrl","#recipeYoutubeUrl"]
    .forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.value = "";
    });

  const category = document.querySelector("#recipeCategory");
  if (category) category.value = "main";

  const difficulty = document.querySelector("#recipeDifficulty");
  if (difficulty) difficulty.value = "medium";

  const kids = document.querySelector("#recipeKids");
  if (kids) kids.checked = false;

  const healthy = document.querySelector("#recipeHealthy");
  if (healthy) healthy.checked = false;

  editingRecipeId = null;

  const saveBtn = document.querySelector("#saveRecipeBtn");
  if (saveBtn) saveBtn.textContent = "Rezept speichern";

  document.querySelector("#cancelRecipeEditBtn")?.classList.add("hidden");
}

function startRecipeEdit(recipe) {
  if (!recipe) return;

  editingRecipeId = recipe.id;

  document.querySelector("#recipeTitle").value = recipe.title || "";
  document.querySelector("#recipeCategory").value = recipe.category || "main";
  document.querySelector("#recipeDifficulty").value = recipe.difficulty || "medium";
  document.querySelector("#recipeKids").checked = !!recipe.kids;
  document.querySelector("#recipeHealthy").checked = !!recipe.healthy;
  document.querySelector("#recipeTime").value = recipe.time || "";
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
      <div class="recipe-detail-utensil">⌁</div>
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
      const haystack = [
        r.title,
        ...(Array.isArray(r.ingredients) ? r.ingredients : [])
      ].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesDifficulty && matchesKids && matchesHealthy && matchesSearch;
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
        <div class="recipe-time-mark"><span class="recipe-clock">◔</span><span>${escapeHtml(r.time || "–")}</span></div>
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
          </div>
        </div>
        <div class="recipe-tools">⌁</div>
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

  host.innerHTML = WEEK_DAYS.map((dayName, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = dateKey(date);

    const stored = normalizeMealEntry ? normalizeMealEntry(state.meals?.[key]) : state.meals?.[key];
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
      delete state.meals[key];
    } else {
      state.meals[key] = {
        label: matched ? matched.title : label,
        recipeId: matched ? matched.id : "",
        url,
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

  const recipeData = {
    title,
    category: document.querySelector("#recipeCategory")?.value || "main",
    difficulty: document.querySelector("#recipeDifficulty")?.value || "medium",
    kids: !!document.querySelector("#recipeKids")?.checked,
    healthy: !!document.querySelector("#recipeHealthy")?.checked,
    time: document.querySelector("#recipeTime")?.value.trim() || "",
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


const WORKROOM_PAGE_SIZE = 10;
let schoolWorkTodoPage = 0;
let schoolPrintPage = 0;
let workroomLinkPage = 0;

function clampWorkroomPage(page, totalItems) {
  const maxPage = Math.max(0, Math.ceil(totalItems / WORKROOM_PAGE_SIZE) - 1);
  return Math.min(Math.max(0, page), maxPage);
}

function workroomPageSlice(items, page) {
  const start = page * WORKROOM_PAGE_SIZE;
  return items.slice(start, start + WORKROOM_PAGE_SIZE);
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

function renderSchoolWorkTodos() {
  const list = document.querySelector("#schoolWorkTodoList");
  if (!list) return;

  const archiveCutoff = Date.now() - 3 * 60 * 1000;

  const todos = [...state.workroom.todos]
    .filter(t => {
      if (!t.done) return true;
      if (!t.completedAt) return true;
      return t.completedAt > archiveCutoff;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  schoolWorkTodoPage = clampWorkroomPage(schoolWorkTodoPage, todos.length);
  const visibleTodos = workroomPageSlice(todos, schoolWorkTodoPage);

  const archive = document.querySelector("#schoolWorkTodoArchive");

  if (archive) {
    const archivedTodos = state.workroom.todos
      .filter(t =>
        t.done &&
        t.completedAt &&
        t.completedAt <= archiveCutoff
      )
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

    if (archivedTodos.length) {
      const groups = archivedTodos.reduce((acc, t) => {
        const label = new Date(t.completedAt).toLocaleDateString("de-AT", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
        (acc[label] ||= []).push(t);
        return acc;
      }, {});

      archive.innerHTML = Object.entries(groups).map(([dateLabel, items]) => `
        <div class="workroom-archive-group">
          <div class="workroom-archive-date">${escapeHtml(dateLabel)}</div>
          ${items.map(t => `
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
          `).join("")}
        </div>
      `).join("");
    } else {
      archive.innerHTML = `<div class="workroom-empty">Noch keine erledigten Schul-To-dos.</div>`;
    }

    archive.querySelectorAll(".workroom-archive-delete").forEach(btn => {
      btn.addEventListener("click", e => {
        const id = e.currentTarget.dataset.id;

        state.workroom.todos =
          state.workroom.todos.filter(t => t.id !== id);

        save();
        renderSchoolWorkTodos();
      });
    });
  }

  if (!todos.length) {
    list.innerHTML =
      `<div class="workroom-empty">Im Moment ist alles erledigt. ✨</div>`;
    return;
  }

  const typeLabels = {
    draw: "✏️ Vorzeichnen",
    prepare: "🛠 Vorbereiten",
    create: "📄 Erstellen",
    print: "🖨 Drucken",
    ask: "💬 Nachfragen"
  };

  list.innerHTML = visibleTodos.map(t => `
    <div
      class="workroom-todo-row ${t.done ? "done" : ""} ${t.type === "ask" ? "workroom-todo-ask" : ""}"
      data-id="${t.id}">

      <input
        class="workroom-todo-check"
        type="checkbox"
        data-id="${t.id}"
        ${t.done ? "checked" : ""}>

      <div class="workroom-todo-content">
        <span class="workroom-todo-text">
          ${escapeHtml(t.text)}
        </span>
      </div>

      <div class="workroom-todo-actions">

        ${t.type
          ? `<span class="workroom-todo-type">
               ${typeLabels[t.type] || ""}
             </span>`
          : ""}

        ${t.url
          ? `<a
               class="workroom-todo-link"
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

  renderWorkroomPager(
    list,
    todos.length,
    schoolWorkTodoPage,
    page => {
      schoolWorkTodoPage = page;
      renderSchoolWorkTodos();
    }
  );

  document.querySelectorAll(".workroom-todo-check").forEach(box => {
    box.addEventListener("change", e => {
      const item = state.workroom.todos.find(
        t => t.id === e.currentTarget.dataset.id
      );

      if (!item) return;

      item.done = e.currentTarget.checked;
      item.completedAt = item.done ? Date.now() : null;

      save();
      renderSchoolWorkTodos();

      if (item.done) {
        setTimeout(() => {
          renderSchoolWorkTodos();
        }, 181000);
      }
    });
  });

  document.querySelectorAll(".workroom-todo-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;

      state.workroom.todos =
        state.workroom.todos.filter(t => t.id !== id);

      save();
      renderSchoolWorkTodos();
    });
  });

  document.querySelectorAll(".workroom-todo-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.dataset.id;
      const item = state.workroom.todos.find(t => t.id === id);

      if (!item) return;

      document.querySelector("#schoolWorkTodoInput").value =
        item.text || "";

      document.querySelector("#schoolWorkTodoType").value =
        item.type || "";

      document.querySelector("#schoolWorkTodoLink").value =
        item.url || "";

      const addBtn =
        document.querySelector("#addSchoolWorkTodoBtn");

      addBtn.dataset.editId = item.id;
      addBtn.textContent = "Änderung speichern";
    });
  });

  const todoList =
    document.querySelector("#schoolWorkTodoList");

  if (todoList && typeof Sortable !== "undefined") {
    new Sortable(todoList, {
      animation: 180,
      draggable: ".workroom-todo-row",
      filter: "input, button, a, select, textarea, .workroom-todo-actions, .workroom-drag-handle",
      preventOnFilter: false,
      ghostClass: "workroom-sort-ghost",
      chosenClass: "workroom-sort-chosen",
      dragClass: "workroom-sort-drag",
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      forceFallback: false,

      onEnd: function () {
        const ids = [
          ...todoList.querySelectorAll(".workroom-todo-row")
        ].map(row => row.dataset.id);

        const sortedAll = [...state.workroom.todos]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const startIndex = schoolWorkTodoPage * WORKROOM_PAGE_SIZE;
        const visibleIdSet = new Set(ids);
        const unaffected = sortedAll.filter(t => !visibleIdSet.has(t.id));
        const moved = ids.map(id => state.workroom.todos.find(t => t.id === id)).filter(Boolean);

        const rebuilt = [
          ...unaffected.slice(0, startIndex),
          ...moved,
          ...unaffected.slice(startIndex)
        ];

        rebuilt.forEach((todo, index) => { todo.order = index; });
        state.workroom.todos = rebuilt;

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
      item.updatedAt = Date.now();
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

schoolPrintPage = clampWorkroomPage(schoolPrintPage, prints.length);
const visiblePrints = workroomPageSlice(prints, schoolPrintPage);
  
  if (!prints.length) {
    list.innerHTML =
      `<div class="workroom-empty">Im Moment steht nichts auf der Druckliste.</div>`;
  } else {
    list.innerHTML = visiblePrints.map(p => `
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

  renderWorkroomPager(
    list,
    prints.length,
    schoolPrintPage,
    page => {
      schoolPrintPage = page;
      renderSchoolPrints();
    }
  );

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
        draggable: ".workroom-todo-row",
        filter: "input, button, a, select, textarea, .workroom-todo-actions, .workroom-drag-handle",
        preventOnFilter: false,
        delay: 180,
        delayOnTouchOnly: true,
        touchStartThreshold: 6,

        onEnd: () => {
          const ids = [...printList.querySelectorAll(".workroom-todo-row")]
            .map(row => row.dataset.printId);

          const sortedAll = [...state.workroom.prints]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          const startIndex = schoolPrintPage * WORKROOM_PAGE_SIZE;
          const visibleIdSet = new Set(ids);
          const unaffected = sortedAll.filter(p => !visibleIdSet.has(p.id));
          const moved = ids.map(id => state.workroom.prints.find(p => p.id === id)).filter(Boolean);

          const rebuilt = [
            ...unaffected.slice(0, startIndex),
            ...moved,
            ...unaffected.slice(startIndex)
          ];

          rebuilt.forEach((item, index) => { item.order = index; });
          state.workroom.prints = rebuilt;

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
let activeWorkroomLinkUse = "all";
let workroomImportantOnly = false;

function renderWorkroomLinks() {
  const list = document.querySelector("#workroomLinkList");
  if (!list) return;

  // Ältere Links bekommen einmalig eine stabile Reihenfolge.
  let orderChanged = false;
  state.workroom.links.forEach((link, index) => {
    if (!Number.isFinite(Number(link.order))) {
      link.order = index;
      orderChanged = true;
    }
  });
  if (orderChanged) save();

  const categoryLabels = {
    wood: "🪵 Holz",
    paper: "📄 Papier",
    free: "✂️ Freies Arbeiten",
    experiment: "🧪 Experimentieren",
    documents: "📎 Unterlagen & Belege",
    bureaucracy: "🗂 Bürokratie",
    current: "📌 Aktuell",
    other: "✨ Sonstiges"
  };

  const useLabels = {
    soon: "Demnächst",
    current: "📌 Aktuell",
    bureaucracy: "🗂 Bürokratie",
    year: "🗓 Jahresplanung",
    later: "🌙 Später vorgemerkt"
  };

  const useRank = { current: 0, soon: 1, bureaucracy: 2, year: 3, later: 4 };

  const links = [...state.workroom.links]
    .sort((a, b) => {
      const importantDiff = Number(!!b.important) - Number(!!a.important);
      if (importantDiff) return importantDiff;

      if (activeWorkroomLinkUse === "all") {
        const rankDiff = (useRank[a.use || "soon"] ?? 0) - (useRank[b.use || "soon"] ?? 0);
        if (rankDiff) return rankDiff;
      }

      return (Number(a.order) || 0) - (Number(b.order) || 0);
    })
    .filter(link =>
      (activeWorkroomLinkCategory === "all" ||
       link.category === activeWorkroomLinkCategory) &&
      (activeWorkroomLinkUse === "all" ||
       (link.use || "soon") === activeWorkroomLinkUse) &&
      (!workroomImportantOnly || !!link.important)
    );

  workroomLinkPage = clampWorkroomPage(workroomLinkPage, links.length);
  const visibleLinks = workroomPageSlice(links, workroomLinkPage);

  if (!links.length) {
    list.innerHTML =
      `<div class="workroom-empty">Noch keine Links in dieser Kategorie gespeichert.</div>`;
    return;
  }

  list.innerHTML = visibleLinks.map(link => `
    <div class="workroom-link-item ${link.important ? "workroom-link-important" : ""} ${(link.use || "soon") === "later" ? "workroom-link-later" : ""}" data-id="${link.id}">

 <div class="workroom-link-main">

  <div class="workroom-link-texts">
    ${link.url ? `
      <a
        href="${escapeHtml(link.url)}"
        target="_blank"
        rel="noopener"
        class="workroom-link-title">
        ${escapeHtml(link.title)}
      </a>
    ` : `
      <span class="workroom-link-title workroom-link-title-static">
        ${escapeHtml(link.title)}
      </span>
    `}

    ${link.note
      ? `<div class="workroom-link-note">${escapeHtml(link.note)}</div>`
      : ""}
  </div>

  <div class="workroom-link-badges">
    ${link.important ? `<span class="workroom-link-important-badge">⭐ Wichtig</span>` : ""}
    <span class="workroom-link-use">
      ${useLabels[link.use || "soon"]}
    </span>
    <span class="workroom-link-category">
      ${categoryLabels[link.category] || "✨ Sonstiges"}
    </span>
  </div>

</div>

      <div class="workroom-link-actions">
        <span
          class="workroom-link-drag-handle"
          title="Link verschieben"
          aria-label="Link verschieben">⋮⋮</span>

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

  renderWorkroomPager(
    list,
    links.length,
    workroomLinkPage,
    page => {
      workroomLinkPage = page;
      renderWorkroomLinks();
    },
    true
  );

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
      document.querySelector("#workroomLinkUse").value =
        link.use || "soon";
      const importantInput = document.querySelector("#workroomLinkImportant");
      if (importantInput) importantInput.checked = !!link.important;

      const addBtn = document.querySelector("#addWorkroomLinkBtn");

      addBtn.dataset.editId = link.id;
      addBtn.textContent = "Änderung speichern";
    });
  });

  if (typeof Sortable !== "undefined") {
    new Sortable(list, {
      animation: 180,
      draggable: ".workroom-link-item",
      filter: "a, button, input, select, textarea",
      preventOnFilter: false,
      ghostClass: "workroom-sort-ghost",
      chosenClass: "workroom-sort-chosen",
      dragClass: "workroom-sort-drag",
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,

      onEnd: function () {
        const draggedIds = [...list.querySelectorAll(".workroom-link-item")]
          .map(row => row.dataset.id);

        const allSorted = [...state.workroom.links]
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

        // Beim Kategorie-Filter nur die sichtbaren Plätze neu belegen.
        const visibleSlots = [];
        allSorted.forEach((link, index) => {
          if (
            (activeWorkroomLinkCategory === "all" ||
             link.category === activeWorkroomLinkCategory) &&
            (activeWorkroomLinkUse === "all" ||
             (link.use || "soon") === activeWorkroomLinkUse)
          ) {
            visibleSlots.push(index);
          }
        });

        const byId = new Map(state.workroom.links.map(link => [link.id, link]));

        draggedIds.forEach((id, index) => {
          const slot = visibleSlots[index];
          if (slot !== undefined && byId.has(id)) {
            allSorted[slot] = byId.get(id);
          }
        });

        allSorted.forEach((link, index) => {
          link.order = index;
        });

        state.workroom.links = allSorted;
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

  const title = titleInput.value.trim();
  const note = noteInput.value.trim();
  let url = urlInput.value.trim();
  const category = categoryInput.value || "other";
  const use = useInput?.value || "soon";
  const important = !!importantInput?.checked;

  if (!title) {
    titleInput.focus();
    return;
  }

  if (url && !/^https?:\/\//i.test(url)) {
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
      item.use = use;
      item.important = important;
      item.updatedAt = Date.now();
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
      use,
      important,
      order: state.workroom.links.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  titleInput.value = "";
  noteInput.value = "";
  urlInput.value = "";
  categoryInput.value = "wood";
  if (useInput) useInput.value = "soon";
  if (importantInput) importantInput.checked = false;

  save();
  renderWorkroomLinks();
});


// Kategorien filtern – kompakt per Dropdown
document.querySelector("#workroomLinkCategoryFilter")?.addEventListener("change", e => {
  activeWorkroomLinkCategory = e.currentTarget.value || "all";
  workroomLinkPage = 0;
  renderWorkroomLinks();
});

document.querySelectorAll(".workroom-link-use-filter").forEach(btn => {
  btn.addEventListener("click", e => {
    activeWorkroomLinkUse = e.currentTarget.dataset.use || "soon";
    workroomLinkPage = 0;

    document.querySelectorAll(".workroom-link-use-filter").forEach(filter =>
      filter.classList.toggle("active", filter === e.currentTarget)
    );

    renderWorkroomLinks();
  });
});

document.querySelector("#workroomLinkUseFilterSelect")?.addEventListener("change", e => {
  activeWorkroomLinkUse = e.currentTarget.value || "all";
  workroomLinkPage = 1;
  renderWorkroomLinks();
});

document.querySelector("#workroomLinkImportantFilter")?.addEventListener("click", e => {
  workroomImportantOnly = !workroomImportantOnly;
  workroomLinkPage = 0;
  e.currentTarget.classList.toggle("active", workroomImportantOnly);
  renderWorkroomLinks();
});



// =========================================================
// WERKRAUM – SUPPLIERUNGEN
// =========================================================
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
      state.workroom.substitutions = state.workroom.substitutions
        .filter(item => item.id !== btn.dataset.id);
      save();
      renderSubstitutions();
    });
  });
}

const substitutionDialog = document.querySelector("#substitutionDialog");

document.querySelector("#openSubstitutionBtn")?.addEventListener("click", () => {
  const dateInput = document.querySelector("#substitutionDate");
  if (dateInput && !dateInput.value) dateInput.value = dateKey(new Date());
  substitutionDialog?.showModal();
  setTimeout(() => dateInput?.showPicker?.(), 80);
});

document.querySelector("#closeSubstitutionDialogBtn")?.addEventListener("click", () => {
  substitutionDialog?.close();
});

document.querySelector("#saveSubstitutionBtn")?.addEventListener("click", () => {
  const date = document.querySelector("#substitutionDate")?.value || "";
  const className = document.querySelector("#substitutionClass")?.value.trim() || "";
  const subject = document.querySelector("#substitutionSubject")?.value.trim() || "";
  const forWhom = document.querySelector("#substitutionForWhom")?.value.trim() || "";
  const hours = Number(document.querySelector("#substitutionHours")?.value || 1);
  const note = document.querySelector("#substitutionNote")?.value.trim() || "";

  if (!date || !className || !subject) {
    showMotivation("Bitte Tag, Klasse und Supplierfach eintragen.");
    return;
  }

  state.workroom.substitutions.push({
    id: uid(),
    date,
    className,
    subject,
    forWhom,
    hours: Number.isFinite(hours) && hours > 0 ? hours : 1,
    note,
    createdAt: Date.now()
  });

  ["#substitutionClass","#substitutionSubject","#substitutionForWhom","#substitutionNote"]
    .forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.value = "";
    });

  const hoursInput = document.querySelector("#substitutionHours");
  if (hoursInput) hoursInput.value = "1";

  save();
  renderSubstitutions();
  substitutionDialog?.close();
  showMotivation("Supplierung gespeichert.");
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
  document.querySelector("#eventEndDate").value = "";
  document.querySelector("#eventTime").value = "";
document.querySelector("#eventEndTime").value = "";

const plingEnabled = document.querySelector("#eventPlingEnabled");
const plingMinutes = document.querySelector("#eventPlingMinutes");

if (plingEnabled) plingEnabled.checked = false;
if (plingMinutes) plingMinutes.value = "15";

document.querySelector("#eventCategory").value = "normal";
  document.querySelector("#recurrence").value = "none";
  setSelectedFamilyMembers([]);
  updateEntryTypeUI();
  document.querySelector("#addTodoBtn").textContent = "To-do hinzufügen";
  document.querySelector("#cancelTodoEditBtn").classList.add("hidden");
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

  if (todoDayField) {
    todoDayField.classList.toggle("hidden", isEvent || period !== "week");
  }
}

document.querySelector("#entryType").addEventListener("change", updateEntryTypeUI);
document.querySelector("#recurrence").addEventListener("change", updateEntryTypeUI);
document.querySelector("#eventCategory").addEventListener("change", updateEntryTypeUI);

document.querySelector("#cancelTodoEditBtn").addEventListener("click", resetTodoEditor);

document.querySelector("#addTodoBtn").addEventListener("click", () => {
  const text = document.querySelector("#todoText").value.trim();
  if (!text) return;

  const type = document.querySelector("#entryType").value;
  const selectedDay = document.querySelector("#todoDay").value;
  const selectedFamily = selectedFamilyMembers();
  const recurrence = document.querySelector("#recurrence").value;
 const eventDate = document.querySelector("#eventDate").value;
const eventEndDate = document.querySelector("#eventEndDate")?.value || "";
const eventTime = document.querySelector("#eventTime").value;
const eventEndTime = document.querySelector("#eventEndTime")?.value || "";

const plingEnabled =
  type === "event" &&
  !!document.querySelector("#eventPlingEnabled")?.checked;

const plingMinutes =
  Number(document.querySelector("#eventPlingMinutes")?.value || 15);

const eventCategory = document.querySelector("#eventCategory")?.value || "normal";
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
    item.endDate = type === "event" ? eventEndDate : null;
item.endTime = type === "event" ? eventEndTime : "";
item.plingEnabled = type === "event" ? plingEnabled : false;
item.plingMinutes = type === "event" ? plingMinutes : 15;
item.eventCategory = type === "event" ? eventCategory : "normal";
    item.recurrence = recurrence;
    item.anchorDate = anchorDate;
    item.completedOccurrences = Array.isArray(item.completedOccurrences) ? item.completedOccurrences : [];

    resetTodoEditor();
  } else {
    state.todos.push({
      id: uid(),
      createdAt: Date.now(),
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
      endDate: type === "event" ? eventEndDate : null,
endTime: type === "event" ? eventEndTime : "",
plingEnabled: type === "event" ? plingEnabled : false,
plingMinutes: type === "event" ? plingMinutes : 15,
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


function nonEmptyWorkroomScore(w) {
  if (!w || typeof w !== "object") return 0;
  return ["todos","prints","links","substitutions"].reduce(
    (sum, key) => sum + (Array.isArray(w[key]) ? w[key].length : 0), 0
  );
}

function normalizeWorkroom(w) {
  const src = w && typeof w === "object" ? w : {};
  return {
    todos: Array.isArray(src.todos) ? src.todos : [],
    prints: Array.isArray(src.prints) ? src.prints : [],
    links: Array.isArray(src.links) ? src.links : [],
    substitutions: Array.isArray(src.substitutions) ? src.substitutions : [],
    plans: src.plans && typeof src.plans === "object"
      ? src.plans
      : {week:[], year:[]}
  };
}

function mergeByIdPreferNewer(localList, cloudList) {
  const local = Array.isArray(localList) ? localList : [];
  const cloud = Array.isArray(cloudList) ? cloudList : [];
  const map = new Map();

  [...cloud, ...local].forEach(item => {
    if (!item || !item.id) return;
    const previous = map.get(item.id);
    if (!previous) {
      map.set(item.id, item);
      return;
    }
    const prevTime = Number(previous.updatedAt || previous.createdAt || 0);
    const itemTime = Number(item.updatedAt || item.createdAt || 0);
    if (itemTime >= prevTime) map.set(item.id, item);
  });

  return [...map.values()];
}

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
      timetableUrl: l.timetableUrl || c.timetableUrl || "",
      manualTimetable: l.manualTimetable || c.manualTimetable || null
    };
  });

  return merged;
}

function applyCloudData(data) {
  cloudApplying = true;
  try {
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.todos = Array.isArray(data.todos) ? data.todos : [];
    state.archive = Array.isArray(data.archive) ? data.archive : [];
    state.shopping = Array.isArray(data.shopping)
  ? data.shopping
  : (Array.isArray(state.shopping) ? state.shopping : []);

shoppingItems = state.shopping;
    
    const localRecipes = Array.isArray(state.recipes) ? state.recipes : [];
    const cloudRecipes = Array.isArray(data.recipes) ? data.recipes : null;

    // Ältere Cloud-Stände hatten teilweise noch keine Rezeptdaten.
    // Eine leere Cloud-Liste darf deshalb vorhandene lokale Rezepte nicht löschen.
    state.recipes = cloudRecipes && cloudRecipes.length
      ? cloudRecipes
      : localRecipes;
    state.meals = mergeMeals(
      state.meals,
      data.meals && typeof data.meals === "object" ? data.meals : {}
    );
    if (Array.isArray(data.pinboard)) {
      handleIncomingPinboard(data.pinboard);
      state.pinboard = data.pinboard;
    }
    if (data.timeTracking && typeof data.timeTracking === "object") {
      const cloudEntries = Array.isArray(data.timeTracking.entries) ? data.timeTracking.entries : [];
      const localActive = state.timeTracking.active;
      const cloudActive = data.timeTracking.active && typeof data.timeTracking.active === "object"
        ? data.timeTracking.active
        : null;

      let active = localActive || cloudActive || null;
      if (localActive && cloudActive) {
        active = Number(localActive.startedAt || 0) >= Number(cloudActive.startedAt || 0)
          ? localActive
          : cloudActive;
      }

      state.timeTracking = {
        entries: mergeByIdPreferNewer(state.timeTracking.entries, cloudEntries),
        active
      };
      saveTimeTrackingImmediately();
    }
    if (data.recipeLinkFeedback && typeof data.recipeLinkFeedback === "object") {
      state.recipeLinkFeedback = {
        ...state.recipeLinkFeedback,
        ...data.recipeLinkFeedback
      };
    }
    const localWorkroom = normalizeWorkroom(state.workroom);
    const cloudWorkroom = normalizeWorkroom(data.workroom);

    // Sicherheitsregel:
    // Ein leerer Cloud-Stand darf vorhandene lokale Werkraumdaten niemals löschen.
    if (nonEmptyWorkroomScore(localWorkroom) > 0 && nonEmptyWorkroomScore(cloudWorkroom) === 0) {
      state.workroom = localWorkroom;
    } else if (nonEmptyWorkroomScore(localWorkroom) === 0) {
      state.workroom = cloudWorkroom;
    } else {
      state.workroom = {
        todos: mergeByIdPreferNewer(localWorkroom.todos, cloudWorkroom.todos),
        prints: mergeByIdPreferNewer(localWorkroom.prints, cloudWorkroom.prints),
        links: mergeByIdPreferNewer(localWorkroom.links, cloudWorkroom.links),
        substitutions: mergeByIdPreferNewer(localWorkroom.substitutions, cloudWorkroom.substitutions),
        plans: localWorkroom.plans || cloudWorkroom.plans || {week:[], year:[]}
      };
    }
    if (data.school?.children) {
      state.school = mergeSchool(state.school, data.school);
    }
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
    
    await migrateShoppingToCollection();
startShoppingSync();
    
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
// =========================================================
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
    if (!serviceWorkerSupported()) return null;

    try {
      await navigator.serviceWorker.register("./sw.js");
      const registration = await navigator.serviceWorker.ready;
      return registration;
    } catch (err) {
      console.warn("Service Worker konnte nicht registriert werden:", err);
      return null;
    }
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
      status.textContent = "🔔 Dieses Gerät ist für Benachrichtigungen aktiviert.";
      status.dataset.state = "granted";
      enableBtn.textContent = "Benachrichtigungen aktiv";
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

    const body = `${item.text} · in ${minutes} Minuten`;

    // Sichtbarer Hinweis innerhalb der App.
    showMotivation(`🔔 ${body}`);

    // System-Benachrichtigung für dieses freigegebene Gerät.
    await showSystemNotification(
      "Unsere Woche in Balance",
      body,
      `pling-${key}`
    );
  }

  async function checkPlings(){
    const now = new Date();

    for (const item of state.todos) {
      const start = eventStartForOccurrence(item, now);
      if (!start) continue;

      const minutes = [5,15,30].includes(Number(item.plingMinutes))
        ? Number(item.plingMinutes)
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

  const card = head.closest(".workroom-fold-card");
  if (!card) return;

  const wasOpen = card.classList.contains("open");

  document.querySelectorAll(".workroom-fold-card").forEach(otherCard => {
    otherCard.classList.remove("open");
  });

  if (!wasOpen) card.classList.add("open");
});

restoreTimeTrackingFromLocal();
renderAll();
