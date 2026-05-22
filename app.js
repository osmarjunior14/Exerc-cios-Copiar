const STORAGE_KEY = "plannum360.v1";
const LEGACY_KEYS = ["appdetreino.v2", "appdetreino.v1"];
const SESSION_ROLE_KEY = "plannum360.role";
const LEGACY_SESSION_ROLE_KEY = "appdetreino.role";
const CHANNEL_URL = "https://www.youtube.com/@fifteensecondsforfit";

const seedExercises = [
  { name: "Agachamento livre", group: "Pernas", videoUrl: CHANNEL_URL },
  { name: "Supino reto", group: "Peito", videoUrl: CHANNEL_URL },
  { name: "Remada curvada", group: "Costas", videoUrl: CHANNEL_URL },
  { name: "Desenvolvimento com halteres", group: "Ombros", videoUrl: CHANNEL_URL },
  { name: "Rosca direta", group: "Bíceps", videoUrl: CHANNEL_URL },
  { name: "Tríceps pulley", group: "Tríceps", videoUrl: CHANNEL_URL }
];

const templates = {
  upper: ["SUPINO", "REMADA", "DESENVOLVIMENTO", "PUXADA", "ROSCA", "TRICEPS"],
  lower: ["AGACHAMENTO", "AFUNDO", "CADEIRA", "PELVICA", "PANTURRILHA", "TORNOZELO"],
  full: ["AGACHAMENTO", "SUPINO", "REMADA", "DESENVOLVIMENTO", "ABDOMINAL"]
};

let favoriteFilter = false;
let timerId = null;
let timerRemaining = 0;
let selectedLoginRole = "teacher";
const state = loadState();

function defaultState() {
  return {
    student: {},
    anamnesis: {},
    assessments: [],
    exercises: seedExercises,
    favoriteExercises: [],
    plans: [],
    workouts: [],
    sessions: [],
    appointments: [],
    invoices: [],
    workoutProgress: {},
    settings: {}
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY)
    || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  return normalizeState(saved ? JSON.parse(saved) : defaultState());
}

function normalizeState(data) {
  return {
    ...defaultState(),
    ...data,
    student: data.student || {},
    anamnesis: data.anamnesis || {},
    assessments: data.assessments || [],
    exercises: data.exercises?.length ? data.exercises : seedExercises,
    favoriteExercises: data.favoriteExercises || [],
    plans: data.plans || [],
    workouts: data.workouts || [],
    sessions: data.sessions || [],
    appointments: data.appointments || [],
    invoices: data.invoices || [],
    workoutProgress: data.workoutProgress || {},
    settings: data.settings || {}
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fillForm(form, data) {
  Object.entries(data || {}).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function h(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notify(message, type = "success") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 20);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function emptyState(message) {
  return `<div class="empty-state">${h(message)}</div>`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(value) {
  if (!value) return "Sem data";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ageFromBirthdate(value) {
  if (!value) return "";
  const birth = new Date(`${value}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthday = now.getMonth() > birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age > 0 ? age : "";
}

function formulaSex() {
  if (state.student.sex === "Masculino") return "male";
  if (state.student.sex === "Feminino") return "female";
  return "";
}

function num(value) {
  return Number(String(value || "").replace(",", "."));
}

function fixed(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function percent(value, total) {
  if (!value || !total) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function ageBand(age) {
  if (age < 30) return 0;
  if (age < 40) return 1;
  if (age < 50) return 2;
  if (age < 60) return 3;
  return 4;
}

function classifyBmi(value) {
  const bmi = num(value);
  if (!bmi) return { label: "Sem dados", tone: "neutral" };
  if (bmi < 18.5) return { label: "Magreza", tone: "attention" };
  if (bmi < 25) return { label: "Normal", tone: "positive" };
  if (bmi < 30) return { label: "Sobrepeso", tone: "attention" };
  if (bmi < 40) return { label: "Obesidade", tone: "danger" };
  return { label: "Obesidade grave", tone: "danger" };
}

function classifyBodyFat(value, sex, ageValue) {
  const bodyFat = num(value);
  const age = num(ageValue);
  if (!bodyFat || !sex || !age) return { label: "Sem dados", tone: "neutral" };
  const band = ageBand(age);
  const table = sex === "male"
    ? [
      ["Excelente", [11, 12, 14, 15, 16], "positive"],
      ["Bom", [13, 14, 16, 17, 18], "positive"],
      ["Média", [20, 21, 23, 24, 25], "neutral"],
      ["Alto", [23, 24, 26, 27, 28], "attention"]
    ]
    : [
      ["Excelente", [16, 17, 18, 19, 20], "positive"],
      ["Bom", [19, 20, 21, 22, 23], "positive"],
      ["Média", [28, 29, 30, 31, 32], "neutral"],
      ["Alto", [31, 32, 33, 34, 35], "attention"]
    ];
  const found = table.find(([, limits]) => bodyFat <= limits[band]);
  return found ? { label: found[0], tone: found[2] } : { label: "Muito alto", tone: "danger" };
}

function classifyWhr(value, sex) {
  const whr = num(value);
  if (!whr || !sex) return { label: "Sem dados", tone: "neutral" };
  const limit = sex === "male" ? 0.94 : 0.82;
  return whr < limit ? { label: "Ideal", tone: "positive" } : { label: "Acima do ideal", tone: "attention" };
}

function classifyWaistHeight(value) {
  const ratio = num(value);
  if (!ratio) return { label: "Sem dados", tone: "neutral" };
  if (ratio < 0.5) return { label: "Controlado", tone: "positive" };
  if (ratio < 0.6) return { label: "Atenção", tone: "attention" };
  return { label: "Alto", tone: "danger" };
}

function classifyConicity(value, sex, ageValue) {
  const conicity = num(value);
  const age = num(ageValue);
  if (!conicity || !sex) return { label: "Sem dados", tone: "neutral" };
  const limit = sex === "male" ? 1.25 : age >= 50 ? 1.22 : 1.18;
  return conicity < limit ? { label: "Ideal", tone: "positive" } : { label: "Acima do ideal", tone: "attention" };
}

function classifyItm(value) {
  const itm = num(value);
  if (!itm) return { label: "Sem dados", tone: "neutral" };
  if (itm < 101) return { label: "Baixo", tone: "attention" };
  if (itm < 104) return { label: "Normal", tone: "positive" };
  if (itm < 107) return { label: "Alto", tone: "positive" };
  return { label: "Muito alto", tone: "positive" };
}

function videoIdFromUrl(url = "") {
  const patterns = [/youtu\.be\/([^?&/]+)/, /v=([^?&]+)/, /shorts\/([^?&/]+)/, /embed\/([^?&/]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function youtubeEmbedUrl(videoId, { autoplay = false } = {}) {
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    modestbranding: "1"
  });
  if (autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
    params.set("loop", "1");
    params.set("playlist", videoId);
    params.set("controls", "0");
    params.set("disablekb", "1");
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function estimateOneRm(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!w || !r) return 0;
  return w * (1 + r / 30);
}

function suggestedLoad(testWeight, testReps, targetReps) {
  const oneRm = estimateOneRm(testWeight, testReps);
  const target = Number(targetReps);
  if (!oneRm || !target) return 0;
  return oneRm / (1 + target / 30);
}

function exerciseKey(exercise) {
  return exercise.videoUrl || exercise.name;
}

function isFavorite(exercise) {
  return state.favoriteExercises.includes(exerciseKey(exercise));
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });
}

function setupPrivacy() {
  const savedRole = sessionStorage.getItem(SESSION_ROLE_KEY) || sessionStorage.getItem(LEGACY_SESSION_ROLE_KEY);
  if (savedRole) {
    document.getElementById("loginScreen").hidden = true;
    applyRole(savedRole);
  } else {
    document.getElementById("loginScreen").hidden = false;
    applyRole("guest");
  }

  document.querySelectorAll("[data-login-role]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLoginRole = button.dataset.loginRole;
      document.querySelectorAll("[data-login-role]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      updateLoginMode();
    });
  });

  document.getElementById("loginApp").addEventListener("click", loginApp);
  document.getElementById("loginCode").addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginApp();
  });
  document.getElementById("loginEmail").addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginApp();
  });

  document.getElementById("logoutApp").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_ROLE_KEY);
    document.getElementById("loginScreen").hidden = false;
    applyRole("guest");
  });
  document.getElementById("lockApp").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_ROLE_KEY);
    document.getElementById("loginScreen").hidden = false;
    applyRole("guest");
  });
  updateLoginMode();
}

function loginApp() {
  const code = document.getElementById("loginCode").value;
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const teacherPin = state.settings.pin || "";
  const studentEmail = (state.student.email || "").trim().toLowerCase();
  const studentPassword = state.student.birthdate || "";
  const canEnter = selectedLoginRole === "teacher"
    ? !teacherPin || code === teacherPin
    : email && studentEmail && email === studentEmail && code === studentPassword;
  if (!canEnter) {
    notify(selectedLoginRole === "teacher" ? "PIN do professor incorreto." : "E-mail ou data de nascimento incorretos.", "error");
    return;
  }
  sessionStorage.setItem(SESSION_ROLE_KEY, selectedLoginRole);
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("loginCode").value = "";
  document.getElementById("loginEmail").value = "";
  applyRole(selectedLoginRole);
  notify(selectedLoginRole === "teacher" ? "Acesso do professor liberado." : "Bem-vindo à Área do aluno.");
}

function updateLoginMode() {
  const isStudent = selectedLoginRole === "student";
  document.getElementById("loginEmailLabel").hidden = !isStudent;
  document.getElementById("loginCodeLabel").childNodes[0].textContent = isStudent ? "Senha: data de nascimento" : "PIN do professor";
  document.getElementById("loginCode").type = isStudent ? "date" : "password";
  document.getElementById("loginCode").value = "";
  document.getElementById("loginCode").placeholder = isStudent ? "Data de nascimento" : "Opcional se não configurado";
  document.getElementById("loginHint").textContent = isStudent
    ? "Use o mesmo e-mail e a data de nascimento cadastrados pelo professor. Não há troca de senha nesta versão."
    : "Configure um PIN em Ajustes para proteger o acesso do professor.";
}

function applyRole(role) {
  document.body.dataset.role = role;
  document.querySelectorAll(".tab").forEach((tab) => {
    const roles = (tab.dataset.roles || "teacher").split(",");
    tab.hidden = role === "guest" || !roles.includes(role);
  });
  document.querySelector(".header-actions").hidden = role === "guest";
  if (role === "student") activateTab("studentApp");
  if (role === "teacher") activateTab("dashboard");
}

function activateTab(tabId) {
  document.querySelectorAll(".tab, .panel").forEach((el) => el.classList.remove("active"));
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const panel = document.getElementById(tabId);
  if (tab && !tab.hidden) tab.classList.add("active");
  if (panel) panel.classList.add("active");
  if (tabId === "studentApp") renderStudentWorkout();
  if (tabId === "reports") renderReport();
  renderDashboard();
}

function setupStudent() {
  const form = document.getElementById("studentForm");
  fillForm(form, state.student);
  document.getElementById("saveStudent").addEventListener("click", () => {
    state.student = formData(form);
    persist();
    renderDashboard();
    notify("Cadastro do aluno salvo.");
  });
}

function setupAnamnesis() {
  const form = document.getElementById("anamnesisForm");
  fillForm(form, state.anamnesis);
  document.getElementById("saveAnamnesis").addEventListener("click", () => {
    state.anamnesis = formData(form);
    persist();
    renderDashboard();
    notify("Anamnese salva.");
  });
}

function setupAssessment() {
  const form = document.getElementById("assessmentForm");
  form.elements.date.value = today();
  if (state.student.birthdate) form.elements.age.value = ageFromBirthdate(state.student.birthdate);
  if (formulaSex()) form.elements.formulaSex.value = formulaSex();
  const refreshAssessment = () => {
    const weight = num(form.elements.bodyWeight.value);
    const heightCm = num(form.elements.height.value);
    const height = heightCm / 100;
    const waist = num(form.elements.waist.value);
    const hip = num(form.elements.hip.value);
    const age = num(form.elements.age.value) || ageFromBirthdate(state.student.birthdate);
    const sex = form.elements.formulaSex.value || formulaSex();
    const rightArmFlexed = num(form.elements.rightArmFlexed.value);
    const rightArmRelaxed = num(form.elements.rightArmRelaxed.value);
    const leftArmFlexed = num(form.elements.leftArmFlexed.value);
    const leftArmRelaxed = num(form.elements.leftArmRelaxed.value);
    const skinfolds = ["skChest", "skMidaxillary", "skTriceps", "skSubscapular", "skAbdominal", "skSuprailiac", "skThigh"]
      .map((name) => num(form.elements[name].value))
      .filter(Boolean);
    const skinfoldSum = skinfolds.reduce((sum, value) => sum + value, 0);
    form.elements.skinfoldSum.value = skinfoldSum ? fixed(skinfoldSum, 1) : "";
    let density = 0;
    if (skinfolds.length === 7 && age && sex) {
      density = sex === "male"
        ? 1.112 - (0.00043499 * skinfoldSum) + (0.00000055 * skinfoldSum ** 2) - (0.00028826 * age)
        : 1.097 - (0.00046971 * skinfoldSum) + (0.00000056 * skinfoldSum ** 2) - (0.00012828 * age);
    }
    form.elements.bodyDensity.value = density ? fixed(density, 4) : "";
    if (density) form.elements.bodyFat.value = fixed((495 / density) - 450, 1);
    const bodyFat = num(form.elements.bodyFat.value);
    form.elements.bmi.value = weight && height ? (weight / (height * height)).toFixed(1) : "";
    form.elements.whr.value = waist && hip ? (waist / hip).toFixed(2) : "";
    form.elements.waistHeightRatio.value = waist && heightCm ? (waist / heightCm).toFixed(2) : "";
    const conicityIndex = weight && height && waist ? (waist / 100) / (0.109 * Math.sqrt(weight / height)) : 0;
    form.elements.conicityIndex.value = conicityIndex ? fixed(conicityIndex, 2) : "";
    form.elements.rightItm.value = rightArmFlexed && rightArmRelaxed ? fixed((rightArmFlexed * 100) / rightArmRelaxed, 1) : "";
    form.elements.leftItm.value = leftArmFlexed && leftArmRelaxed ? fixed((leftArmFlexed * 100) / leftArmRelaxed, 1) : "";
    const fatMass = weight && bodyFat ? weight * bodyFat / 100 : 0;
    const leanMass = weight && fatMass ? weight - fatMass : 0;
    const residualMass = weight && sex ? weight * (sex === "male" ? 0.241 : 0.209) : 0;
    const radius = num(form.elements.radiusDiameter.value) / 1000;
    const femur = num(form.elements.femurDiameter.value) / 1000;
    const boneMass = height && radius && femur ? 3.02 * ((height ** 2 * radius * femur * 400) ** 0.712) : 0;
    const muscleMass = weight && fatMass && residualMass && boneMass ? weight - fatMass - residualMass - boneMass : 0;
    form.elements.fatMass.value = fatMass ? fixed(fatMass, 1) : "";
    form.elements.leanMass.value = leanMass ? fixed(leanMass, 1) : "";
    form.elements.residualMass.value = residualMass ? fixed(residualMass, 1) : "";
    form.elements.boneMass.value = boneMass ? fixed(boneMass, 1) : "";
    form.elements.muscleMass.value = muscleMass > 0 ? fixed(muscleMass, 1) : "";
    renderAssessmentResults(formData(form));
    renderCompositionChart(formData(form));
    renderAssessmentRisks(formData(form));
    renderPerimetryBalance(formData(form));
  };
  [...form.elements].forEach((input) => input.addEventListener("input", refreshAssessment));
  [...form.elements].forEach((input) => input.addEventListener("change", refreshAssessment));
  document.getElementById("saveAssessment").addEventListener("click", () => {
    refreshAssessment();
    state.assessments.unshift({ id: crypto.randomUUID(), ...formData(form) });
    persist();
    renderAssessmentHistory();
    renderDashboard();
    notify("Avaliação física salva.");
  });
  refreshAssessment();
  renderAssessmentHistory();
}

function renderAssessmentResults(data = {}) {
  const container = document.getElementById("assessmentResults");
  const sex = data.formulaSex || formulaSex();
  const age = data.age || ageFromBirthdate(state.student.birthdate);
  const cards = [
    { label: "IMC", value: data.bmi || "-", hint: "kg/m²", status: classifyBmi(data.bmi) },
    { label: "Gordura", value: data.bodyFat ? `${data.bodyFat}%` : "-", hint: "Jackson-Pollock 7 dobras", status: classifyBodyFat(data.bodyFat, sex, age) },
    { label: "Massa gorda", value: data.fatMass ? `${data.fatMass} kg` : "-", hint: "PG" },
    { label: "Massa livre", value: data.leanMass ? `${data.leanMass} kg` : "-", hint: "PLG" },
    { label: "Massa muscular", value: data.muscleMass ? `${data.muscleMass} kg` : "-", hint: "estimada" },
    { label: "RCQ", value: data.whr || "-", hint: "cintura / quadril", status: classifyWhr(data.whr, sex) },
    { label: "RCE", value: data.waistHeightRatio || "-", hint: "cintura / estatura", status: classifyWaistHeight(data.waistHeightRatio) },
    { label: "Conicidade", value: data.conicityIndex || "-", hint: "IC", status: classifyConicity(data.conicityIndex, sex, age) },
    { label: "ITM direito", value: data.rightItm || "-", hint: "braço fletido / relaxado", status: classifyItm(data.rightItm) },
    { label: "ITM esquerdo", value: data.leftItm || "-", hint: "braço fletido / relaxado", status: classifyItm(data.leftItm) }
  ];
  container.innerHTML = cards.map(({ label, value, hint, status }) => `
    <article class="assessment-card">
      <span>${h(label)}</span>
      <strong>${h(value)}</strong>
      <small>${h(hint)}</small>
      ${status ? `<em class="assessment-status ${h(status.tone)}">${h(status.label)}</em>` : ""}
    </article>
  `).join("");
}

function renderCompositionChart(data = {}) {
  const container = document.getElementById("compositionChart");
  if (!container) return;
  const weight = num(data.bodyWeight);
  const fatMass = num(data.fatMass);
  const leanMass = num(data.leanMass);
  const muscleMass = num(data.muscleMass);
  const boneMass = num(data.boneMass);
  const residualMass = num(data.residualMass);
  if (!weight || (!fatMass && !leanMass)) {
    container.innerHTML = emptyState("Preencha peso e dobras para visualizar a composição.");
    return;
  }
  const detailedTotal = fatMass + muscleMass + boneMass + residualMass;
  const otherLeanMass = muscleMass ? Math.max(0, weight - detailedTotal) : leanMass;
  const segments = [
    { label: "Gordura", value: fatMass, color: "#df4b42" },
    { label: "Músculo", value: muscleMass, color: "#0b7ce8" },
    { label: "Ósseo", value: boneMass, color: "#0f9f8f" },
    { label: "Residual", value: residualMass, color: "#f59e0b" },
    { label: muscleMass ? "Outros" : "Massa livre", value: otherLeanMass, color: "#64748b" }
  ].filter((item) => item.value > 0);
  container.innerHTML = `
    <div class="stacked-bar" aria-label="Composição corporal estimada">
      ${segments.map((item) => `<span style="width:${percent(item.value, weight)}%;background:${item.color}"></span>`).join("")}
    </div>
    <div class="chart-legend">
      ${segments.map((item) => `
        <span><i style="background:${item.color}"></i>${h(item.label)} <strong>${fixed(item.value, 1)} kg</strong></span>
      `).join("")}
    </div>
  `;
}

function renderAssessmentRisks(data = {}) {
  const container = document.getElementById("assessmentRisks");
  if (!container) return;
  const sex = data.formulaSex || formulaSex();
  const age = data.age || ageFromBirthdate(state.student.birthdate);
  const items = [
    { label: "IMC", value: data.bmi || "-", detail: "18,5 a 24,9 como faixa normal", status: classifyBmi(data.bmi) },
    { label: "% Gordura", value: data.bodyFat ? `${data.bodyFat}%` : "-", detail: "Classificação por idade e sexo", status: classifyBodyFat(data.bodyFat, sex, age) },
    { label: "RCQ", value: data.whr || "-", detail: "Ideal: homem < 0,94 | mulher < 0,82", status: classifyWhr(data.whr, sex) },
    { label: "Conicidade", value: data.conicityIndex || "-", detail: "Ideal: homem < 1,25 | mulher < 1,18/1,22", status: classifyConicity(data.conicityIndex, sex, age) }
  ];
  container.innerHTML = items.map((item) => `
    <div class="risk-item">
      <div>
        <span>${h(item.label)}</span>
        <strong>${h(item.value)}</strong>
        <small>${h(item.detail)}</small>
      </div>
      <em class="assessment-status ${h(item.status.tone)}">${h(item.status.label)}</em>
    </div>
  `).join("");
}

function renderPerimetryBalance(data = {}) {
  const container = document.getElementById("perimetryBalance");
  if (!container) return;
  const pairs = [
    ["Braço fletido", num(data.rightArmFlexed), num(data.leftArmFlexed)],
    ["Braço relaxado", num(data.rightArmRelaxed), num(data.leftArmRelaxed)],
    ["Antebraço", num(data.rightForearm), num(data.leftForearm)],
    ["Punho", num(data.rightWrist), num(data.leftWrist)],
    ["Coxa proximal", num(data.rightThighProximal), num(data.leftThighProximal)],
    ["Coxa mesofemoral", num(data.rightThighMeso), num(data.leftThighMeso)],
    ["Coxa distal", num(data.rightThighDistal), num(data.leftThighDistal)],
    ["Perna", num(data.rightLeg), num(data.leftLeg)]
  ].filter(([, right, left]) => right || left);
  if (!pairs.length) {
    container.innerHTML = emptyState("Preencha perimetrias bilaterais para comparar simetria.");
    return;
  }
  const max = Math.max(...pairs.flatMap(([, right, left]) => [right, left]), 1);
  container.innerHTML = pairs.map(([label, right, left]) => {
    const delta = right && left ? Math.abs(right - left) : 0;
    return `
      <div class="balance-row">
        <div class="balance-label">
          <strong>${h(label)}</strong>
          <span>${right ? fixed(right, 1) : "-"} cm D / ${left ? fixed(left, 1) : "-"} cm E ${delta ? `| dif. ${fixed(delta, 1)} cm` : ""}</span>
        </div>
        <div class="balance-bars">
          <span class="right" style="width:${percent(right, max)}%"></span>
          <span class="left" style="width:${percent(left, max)}%"></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderAssessmentHistory() {
  const container = document.getElementById("assessmentHistory");
  container.innerHTML = "";
  if (!state.assessments.length) {
    container.innerHTML = emptyState("Nenhuma avaliação registrada ainda.");
    return;
  }
  state.assessments.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${shortDate(item.date)}</strong><span>Peso: ${h(item.bodyWeight || "-")} kg | Gordura: ${h(item.bodyFat || "-")}% | Massa magra: ${h(item.leanMass || "-")} kg | IMC: ${h(item.bmi || "-")}</span></div>`;
    container.appendChild(el);
  });
}

function setupPlanning() {
  const form = document.getElementById("planForm");
  form.elements.start.value = today();
  document.getElementById("savePlan").addEventListener("click", () => {
    state.plans.unshift({ id: crypto.randomUUID(), ...formData(form) });
    form.reset();
    form.elements.start.value = today();
    persist();
    renderPlanHistory();
    renderDashboard();
    notify("Bloco de periodização salvo.");
  });
  renderPlanHistory();
}

function renderPlanHistory() {
  const container = document.getElementById("planHistory");
  container.innerHTML = "";
  if (!state.plans.length) {
    container.innerHTML = emptyState("Nenhum bloco de periodização salvo.");
    return;
  }
  state.plans.forEach((plan) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${h(plan.name)}</strong><span>${h(plan.goal)} | ${shortDate(plan.start)} até ${shortDate(plan.end)} | ${h(plan.strategy)}</span></div>`;
    container.appendChild(el);
  });
}

async function hydrateExercisesFromJson() {
  try {
    const response = await fetch("data/exercises.json", { cache: "no-store" });
    if (!response.ok) return;
    const exercises = await response.json();
    if (!Array.isArray(exercises) || exercises.length === 0) return;
    const seedKeys = new Set(seedExercises.map((seed) => exerciseKey(seed)));
    const onlySeeds = state.exercises.every((exercise) => seedKeys.has(exerciseKey(exercise)));
    if (onlySeeds && exercises.length > 1) {
      state.exercises = exercises;
      persist();
      return;
    }
    state.exercises = state.exercises.filter((exercise) => !seedKeys.has(exerciseKey(exercise)));
    const known = new Set(state.exercises.map(exerciseKey));
    exercises.forEach((exercise) => {
      if (!known.has(exerciseKey(exercise))) state.exercises.push(exercise);
    });
    persist();
  } catch {
    // O app continua utilizável com os dados locais se for aberto sem servidor.
  }
}

function setupLibrary() {
  document.getElementById("addExercise").addEventListener("click", () => {
    document.getElementById("exerciseForm").classList.toggle("active");
  });
  document.getElementById("exerciseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.exercises.unshift({ id: crypto.randomUUID(), ...formData(event.currentTarget) });
    event.currentTarget.reset();
    persist();
    renderExercises();
    renderPrescriptionRows();
    notify("Exercício adicionado à biblioteca.");
  });
  document.getElementById("exerciseSearch").addEventListener("input", renderExercises);
  document.getElementById("exerciseGroupFilter").addEventListener("change", renderExercises);
  document.getElementById("favoriteOnly").addEventListener("click", (event) => {
    favoriteFilter = !favoriteFilter;
    event.currentTarget.classList.toggle("active", favoriteFilter);
    renderExercises();
  });
}

function renderGroupFilter() {
  const filter = document.getElementById("exerciseGroupFilter");
  const selected = filter.value;
  const groups = [...new Set(state.exercises.map((item) => item.group).filter(Boolean))].sort();
  filter.innerHTML = `<option value="">Todos os grupos</option>${groups.map((group) => `<option>${group}</option>`).join("")}`;
  filter.value = selected;
}

function renderExercises() {
  renderGroupFilter();
  const grid = document.getElementById("exerciseGrid");
  const template = document.getElementById("exerciseCardTemplate");
  const query = document.getElementById("exerciseSearch").value.toLowerCase();
  const group = document.getElementById("exerciseGroupFilter").value;
  grid.innerHTML = "";

  state.exercises
    .filter((exercise) => !group || exercise.group === group)
    .filter((exercise) => !favoriteFilter || isFavorite(exercise))
    .filter((exercise) => `${exercise.name} ${exercise.group} ${exercise.videoUrl}`.toLowerCase().includes(query))
    .forEach((exercise) => {
      const card = template.content.cloneNode(true);
      const videoId = videoIdFromUrl(exercise.videoUrl);
      const frame = card.querySelector(".video-frame");
      if (videoId) {
        frame.innerHTML = `<iframe title="${exercise.name}" src="${youtubeEmbedUrl(videoId)}" loading="lazy" allowfullscreen></iframe>`;
      }
      const favoriteButton = document.createElement("button");
      favoriteButton.className = `favorite-button ${isFavorite(exercise) ? "active" : ""}`;
      favoriteButton.type = "button";
      favoriteButton.title = "Favoritar exercício";
      favoriteButton.textContent = "★";
      favoriteButton.addEventListener("click", () => {
        const key = exerciseKey(exercise);
        state.favoriteExercises = isFavorite(exercise)
          ? state.favoriteExercises.filter((item) => item !== key)
          : [...state.favoriteExercises, key];
        persist();
        renderExercises();
      });
      card.querySelector(".exercise-body").prepend(favoriteButton);
      card.querySelector(".badge").textContent = exercise.group || "Sem grupo";
      card.querySelector("h3").textContent = exercise.name;
      card.querySelector("a").href = exercise.videoUrl || CHANNEL_URL;
      grid.appendChild(card);
    });
  renderDashboard();
}

function exerciseOptions(selected = "") {
  return state.exercises
    .map((exercise, index) => {
      const value = String(index);
      return `<option value="${value}" ${value === selected ? "selected" : ""}>${h(exercise.name)}</option>`;
    })
    .join("");
}

function prescriptionRowTemplate(row = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><select class="exercise-select">${exerciseOptions(row.exerciseIndex || "0")}</select></td>
    <td><input class="sets" type="number" min="1" value="${row.sets || 3}" /></td>
    <td><input class="reps" type="number" min="1" value="${row.reps || 10}" /></td>
    <td><input class="weight" type="number" min="0" step="0.5" value="${row.weight || ""}" /></td>
    <td><input class="rest" value="${row.rest || "60s"}" /></td>
    <td><input class="tempo" value="${row.tempo || "2-0-2"}" /></td>
    <td><input class="rpe" value="${row.rpe || "8"}" /></td>
    <td>
      <div class="test-fields">
        <input class="test-reps" type="number" min="1" placeholder="Reps feitas" value="${row.testReps || ""}" />
        <input class="test-weight" type="number" min="0" step="0.5" placeholder="Peso usado" value="${row.testWeight || ""}" />
      </div>
    </td>
    <td><div class="load-result">-</div></td>
    <td><textarea class="notes">${h(row.notes || "")}</textarea></td>
    <td><button class="icon-button" type="button" title="Remover">×</button></td>
  `;
  tr.querySelectorAll("input, textarea, select").forEach((input) => input.addEventListener("input", () => updateLoad(tr)));
  tr.querySelector(".icon-button").addEventListener("click", () => tr.remove());
  updateLoad(tr);
  return tr;
}

function updateLoad(tr) {
  const load = suggestedLoad(
    tr.querySelector(".test-weight").value,
    tr.querySelector(".test-reps").value,
    tr.querySelector(".reps").value
  );
  const result = tr.querySelector(".load-result");
  result.textContent = load ? `${load.toFixed(1)} kg` : "-";
  tr.querySelector(".weight").placeholder = load ? load.toFixed(1) : "";
}

function setupPrescription() {
  document.getElementById("workoutDate").value = today();
  document.getElementById("addPrescriptionRow").addEventListener("click", () => {
    document.getElementById("prescriptionRows").appendChild(prescriptionRowTemplate());
  });
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => applyWorkoutTemplate(button.dataset.template));
  });
  document.getElementById("saveWorkout").addEventListener("click", saveWorkout);
  document.getElementById("shareWorkout").addEventListener("click", copyWorkoutSummary);
  document.getElementById("printWorkout").addEventListener("click", () => window.print());
  renderPrescriptionRows();
  renderWorkoutHistory();
}

function renderPrescriptionRows(rows = [{}]) {
  const body = document.getElementById("prescriptionRows");
  body.innerHTML = "";
  rows.forEach((row) => body.appendChild(prescriptionRowTemplate(row)));
}

function findExerciseIndexByWords(words) {
  return state.exercises.findIndex((exercise) => {
    const name = exercise.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return words.some((word) => name.includes(word));
  });
}

function applyWorkoutTemplate(type) {
  const rows = templates[type].map((word, index) => {
    const found = findExerciseIndexByWords([word]);
    return {
      exerciseIndex: String(found >= 0 ? found : index),
      sets: index < 3 ? 4 : 3,
      reps: type === "lower" && index === 0 ? 8 : 10,
      rest: index < 2 ? "90s" : "60s",
      tempo: "2-0-2",
      rpe: index < 2 ? "8-9" : "7-8"
    };
  });
  renderPrescriptionRows(rows);
}

function collectWorkoutRows() {
  return [...document.querySelectorAll("#prescriptionRows tr")].map((tr) => {
    const exercise = state.exercises[Number(tr.querySelector(".exercise-select").value)] || {};
    return {
      exerciseIndex: tr.querySelector(".exercise-select").value,
      exerciseName: exercise.name,
      exerciseVideo: exercise.videoUrl,
      sets: tr.querySelector(".sets").value,
      reps: tr.querySelector(".reps").value,
      weight: tr.querySelector(".weight").value || tr.querySelector(".load-result").textContent.replace(" kg", ""),
      rest: tr.querySelector(".rest").value,
      tempo: tr.querySelector(".tempo").value,
      rpe: tr.querySelector(".rpe").value,
      testReps: tr.querySelector(".test-reps").value,
      testWeight: tr.querySelector(".test-weight").value,
      suggestedLoad: tr.querySelector(".load-result").textContent,
      notes: tr.querySelector(".notes").value
    };
  });
}

function currentWorkoutDraft() {
  return {
    name: document.getElementById("workoutName").value || "Treino sem nome",
    date: document.getElementById("workoutDate").value,
    focus: document.getElementById("workoutFocus").value,
    day: document.getElementById("workoutDay").value,
    method: document.getElementById("workoutMethod").value,
    intensity: document.getElementById("workoutIntensity").value,
    rows: collectWorkoutRows()
  };
}

function saveWorkout() {
  state.workouts.unshift({ id: crypto.randomUUID(), ...currentWorkoutDraft() });
  persist();
  renderWorkoutHistory();
  renderSessionWorkoutOptions();
  renderStudentWorkoutOptions();
  renderStudentWorkout();
  renderReport();
  renderDashboard();
  notify("Prescrição salva.");
}

function workoutSummary(workout = currentWorkoutDraft()) {
  const header = `${workout.name} (${workout.day || shortDate(workout.date)})`;
  const meta = [workout.focus, workout.method, workout.intensity].filter(Boolean).join(" | ");
  const rows = workout.rows.map((row, index) => {
    const load = row.weight && row.weight !== "-" ? `${row.weight} kg` : "carga a definir";
    return `${index + 1}. ${row.exerciseName}: ${row.sets}x${row.reps}, ${load}, intervalo ${row.rest}, tempo ${row.tempo}, RPE ${row.rpe}`;
  });
  const signature = state.settings.signature || state.settings.coachName || "";
  return [header, meta, ...rows, signature].filter(Boolean).join("\n");
}

async function copyWorkoutSummary() {
  const text = workoutSummary();
  await navigator.clipboard.writeText(text);
  notify("Resumo da prescrição copiado.");
}

function renderWorkoutHistory() {
  const container = document.getElementById("workoutHistory");
  container.innerHTML = "";
  if (!state.workouts.length) {
    container.innerHTML = emptyState("Nenhuma prescrição salva ainda.");
    return;
  }
  state.workouts.forEach((workout) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${h(workout.name)}</strong><span>${shortDate(workout.date)} | ${h(workout.day || "-")} | ${workout.rows.length} exercícios</span></div>`;
    const button = document.createElement("button");
    button.className = "ghost-button";
    button.type = "button";
    button.textContent = "Carregar";
    button.addEventListener("click", () => loadWorkout(workout));
    const cloneButton = document.createElement("button");
    cloneButton.className = "ghost-button";
    cloneButton.type = "button";
    cloneButton.textContent = "Clonar";
    cloneButton.addEventListener("click", () => {
      state.workouts.unshift({ ...workout, id: crypto.randomUUID(), name: `${workout.name} - cópia`, date: today() });
      persist();
      renderWorkoutHistory();
      renderSessionWorkoutOptions();
      renderStudentWorkoutOptions();
      renderDashboard();
      notify("Treino clonado.");
    });
    el.appendChild(button);
    el.appendChild(cloneButton);
    container.appendChild(el);
  });
}

function loadWorkout(workout) {
  document.getElementById("workoutName").value = workout.name || "";
  document.getElementById("workoutDate").value = workout.date || today();
  document.getElementById("workoutFocus").value = workout.focus || "";
  document.getElementById("workoutDay").value = workout.day || "Segunda";
  document.getElementById("workoutMethod").value = workout.method || "";
  document.getElementById("workoutIntensity").value = workout.intensity || "";
  renderPrescriptionRows(workout.rows || [{}]);
}

function setupStudentApp() {
  document.getElementById("studentWorkoutSelect").addEventListener("change", renderStudentWorkout);
  document.getElementById("startStudentWorkout").addEventListener("click", () => {
    const workout = selectedStudentWorkout();
    if (!workout) return;
    state.workoutProgress[workout.id] = {
      ...(state.workoutProgress[workout.id] || {}),
      startedAt: new Date().toISOString()
    };
    persist();
    renderStudentWorkout();
  });
  document.getElementById("finishStudentWorkout").addEventListener("click", finishStudentWorkout);
  document.getElementById("resetStudentWorkout").addEventListener("click", () => {
    const workout = selectedStudentWorkout();
    if (!workout) return;
    state.workoutProgress[workout.id] = { sets: {}, exercises: {}, collapsed: {} };
    persist();
    renderStudentWorkout();
  });
  document.getElementById("expandAllExercises").addEventListener("click", () => setAllExerciseCardsCollapsed(false));
  document.getElementById("collapseAllExercises").addEventListener("click", () => setAllExerciseCardsCollapsed(true));
  document.querySelectorAll("[data-rest]").forEach((button) => {
    button.addEventListener("click", () => startTimer(Number(button.dataset.rest)));
  });
  document.getElementById("stopTimer").addEventListener("click", stopTimer);
  renderStudentWorkoutOptions();
  renderStudentWorkout();
}

function selectedStudentWorkout() {
  const id = document.getElementById("studentWorkoutSelect").value;
  return state.workouts.find((workout) => workout.id === id) || state.workouts[0];
}

function renderStudentWorkoutOptions() {
  const select = document.getElementById("studentWorkoutSelect");
  if (!select) return;
  select.innerHTML = state.workouts.length
    ? state.workouts.map((workout) => `<option value="${workout.id}">${workout.name} - ${workout.day || shortDate(workout.date)}</option>`).join("")
    : `<option value="">Nenhum treino prescrito</option>`;
}

function renderStudentWorkout() {
  const workout = selectedStudentWorkout();
  const title = document.getElementById("studentAppTitle");
  const subtitle = document.getElementById("studentAppSubtitle");
  const list = document.getElementById("studentWorkoutCards");
  if (!workout) {
    title.textContent = "Nenhum treino disponível";
    subtitle.textContent = "Salve uma prescrição para liberar a execução mobile.";
    list.innerHTML = "";
    return;
  }
  title.textContent = workout.name;
  subtitle.textContent = [workout.day, workout.focus, workout.method, workout.intensity].filter(Boolean).join(" | ");
  const progress = state.workoutProgress[workout.id] || { sets: {} };
  list.innerHTML = workout.rows.map((row, index) => studentExerciseCard(workout, row, index, progress)).join("");
  renderWorkoutProgress(workout, progress);
  list.querySelectorAll("[data-exercise-key]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.exerciseKey;
      state.workoutProgress[workout.id] = state.workoutProgress[workout.id] || { sets: {}, exercises: {}, collapsed: {} };
      state.workoutProgress[workout.id].exercises = state.workoutProgress[workout.id].exercises || {};
      state.workoutProgress[workout.id].exercises[key] = checkbox.checked;
      persist();
      renderWorkoutProgress(workout, state.workoutProgress[workout.id]);
    });
  });
  list.querySelectorAll("[data-set-key]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.setKey;
      state.workoutProgress[workout.id] = state.workoutProgress[workout.id] || { sets: {}, exercises: {}, collapsed: {} };
      state.workoutProgress[workout.id].sets = state.workoutProgress[workout.id].sets || {};
      state.workoutProgress[workout.id].sets[key] = checkbox.checked;
      persist();
      renderWorkoutProgress(workout, state.workoutProgress[workout.id]);
    });
  });
  list.querySelectorAll("[data-toggle-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleExercise;
      state.workoutProgress[workout.id] = state.workoutProgress[workout.id] || { sets: {}, exercises: {}, collapsed: {} };
      state.workoutProgress[workout.id].collapsed = state.workoutProgress[workout.id].collapsed || {};
      state.workoutProgress[workout.id].collapsed[key] = !state.workoutProgress[workout.id].collapsed[key];
      persist();
      renderStudentWorkout();
    });
  });
}

function studentExerciseCard(workout, row, index, progress) {
  const videoId = videoIdFromUrl(row.exerciseVideo);
  const sets = Math.max(1, Number(row.sets) || 1);
  const exerciseDone = progress.exercises?.[String(index)] ? "checked" : "";
  const collapsed = progress.collapsed?.[String(index)];
  const checks = Array.from({ length: sets }, (_, setIndex) => {
    const key = `${index}-${setIndex}`;
    const checked = progress.sets?.[key] ? "checked" : "";
    return `<label class="set-check"><input data-set-key="${key}" type="checkbox" ${checked} /><span>${setIndex + 1}</span></label>`;
  }).join("");
  return `
    <article class="student-exercise-card ${collapsed ? "collapsed" : ""}">
      <div class="student-exercise-header">
        <label class="exercise-done">
          <input data-exercise-key="${index}" type="checkbox" ${exerciseDone} />
          <span></span>
        </label>
        <div>
          <small>Exercício ${index + 1}</small>
          <h3>${h(row.exerciseName)}</h3>
        </div>
        <button class="ghost-icon-button" data-toggle-exercise="${index}" type="button" title="${collapsed ? "Expandir" : "Recolher"}">${collapsed ? "⌄" : "⌃"}</button>
      </div>
      <div class="student-exercise-media">
        ${videoId ? `<iframe title="${h(row.exerciseName)}" src="${youtubeEmbedUrl(videoId, { autoplay: true })}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` : ""}
      </div>
      <div class="student-exercise-content">
        <div class="student-prescription">
          <span class="chip">${h(row.sets)} séries</span>
          <span class="chip">${h(row.reps)} reps</span>
          <span class="chip">${h(row.weight || row.suggestedLoad || "-")} kg</span>
          <span class="chip">${h(row.rest || "-")} descanso</span>
          <span class="chip">Tempo ${h(row.tempo || "-")}</span>
          <span class="chip">RPE ${h(row.rpe || "-")}</span>
        </div>
        <p>${h(row.notes || "Execute com controle e registre qualquer desconforto no feedback.")}</p>
        <div class="set-checks">${checks}</div>
      </div>
    </article>
  `;
}

function renderWorkoutProgress(workout, progress = { sets: {} }) {
  const totalSets = workout.rows.reduce((sum, row) => sum + (Number(row.sets) || 1), 0);
  const completedSets = Object.values(progress.sets || {}).filter(Boolean).length;
  const percent = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;
  document.getElementById("workoutProgressText").textContent = `${percent}%`;
  document.getElementById("workoutProgressBar").style.width = `${percent}%`;
}

function setAllExerciseCardsCollapsed(collapsed) {
  const workout = selectedStudentWorkout();
  if (!workout) return;
  state.workoutProgress[workout.id] = state.workoutProgress[workout.id] || { sets: {}, exercises: {}, collapsed: {} };
  state.workoutProgress[workout.id].collapsed = {};
  workout.rows.forEach((_, index) => {
    state.workoutProgress[workout.id].collapsed[String(index)] = collapsed;
  });
  persist();
  renderStudentWorkout();
}

function finishStudentWorkout() {
  const workout = selectedStudentWorkout();
  if (!workout) return;
  const form = document.getElementById("studentFeedbackForm");
  const progress = state.workoutProgress[workout.id] || { sets: {} };
  const completedSets = Object.values(progress.sets || {}).filter(Boolean).length;
  const totalSets = workout.rows.reduce((sum, row) => sum + (Number(row.sets) || 1), 0);
  state.sessions.unshift({
    id: crypto.randomUUID(),
    date: today(),
    workoutId: workout.id,
    status: completedSets >= totalSets ? "Concluído" : completedSets > 0 ? "Parcial" : "Não realizado",
    completedSets,
    totalSets,
    ...formData(form)
  });
  state.workoutProgress[workout.id] = {
    ...progress,
    finishedAt: new Date().toISOString()
  };
  form.reset();
  persist();
  renderSessionHistory();
  renderDashboard();
  renderReport();
  notify("Treino finalizado e feedback salvo.");
}

function startTimer(seconds) {
  stopTimer();
  timerRemaining = seconds;
  renderTimer();
  timerId = setInterval(() => {
    timerRemaining -= 1;
    renderTimer();
    if (timerRemaining <= 0) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  if (timerRemaining <= 0) timerRemaining = 0;
  renderTimer();
}

function renderTimer() {
  const minutes = String(Math.floor(timerRemaining / 60)).padStart(2, "0");
  const seconds = String(timerRemaining % 60).padStart(2, "0");
  document.getElementById("timerDisplay").textContent = `${minutes}:${seconds}`;
}

function setupFollowup() {
  const form = document.getElementById("sessionForm");
  form.elements.date.value = today();
  document.getElementById("saveSession").addEventListener("click", () => {
    state.sessions.unshift({ id: crypto.randomUUID(), ...formData(form) });
    persist();
    renderSessionHistory();
    renderReport();
    renderDashboard();
    notify("Execução registrada.");
  });
  renderSessionWorkoutOptions();
  renderSessionHistory();
}

function renderSessionWorkoutOptions() {
  const select = document.getElementById("sessionWorkout");
  select.innerHTML = state.workouts.length
    ? state.workouts.map((workout) => `<option value="${workout.id}">${workout.name} - ${shortDate(workout.date)}</option>`).join("")
    : `<option value="">Nenhuma prescrição salva</option>`;
}

function renderSessionHistory() {
  const container = document.getElementById("sessionHistory");
  container.innerHTML = "";
  if (!state.sessions.length) {
    container.innerHTML = emptyState("Nenhuma execução registrada ainda.");
    return;
  }
  state.sessions.forEach((session) => {
    const workout = state.workouts.find((item) => item.id === session.workoutId);
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${shortDate(session.date)} - ${h(session.status)}</strong><span>${h(workout?.name || "Treino")} | RPE ${h(session.rpe || "-")} | Dor: ${h(session.pain || "-")}</span><small>${h(session.nextAdjustment || session.feedback || "")}</small></div>`;
    container.appendChild(el);
  });
}

function setupSchedule() {
  const form = document.getElementById("appointmentForm");
  form.elements.date.value = today();
  document.getElementById("saveAppointment").addEventListener("click", () => {
    state.appointments.push({ id: crypto.randomUUID(), ...formData(form) });
    state.appointments.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    form.reset();
    form.elements.date.value = today();
    persist();
    renderAppointmentHistory();
    renderDashboard();
    notify("Compromisso salvo.");
  });
  renderAppointmentHistory();
}

function renderAppointmentHistory() {
  const container = document.getElementById("appointmentHistory");
  container.innerHTML = "";
  if (!state.appointments.length) {
    container.innerHTML = emptyState("Nenhum compromisso agendado.");
    return;
  }
  state.appointments.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${shortDate(item.date)} ${h(item.time || "")} - ${h(item.type)}</strong><span>${h(item.status)} | ${h(item.description || "Sem descrição")}</span></div>`;
    container.appendChild(el);
  });
}

function setupFinance() {
  const form = document.getElementById("invoiceForm");
  form.elements.dueDate.value = today();
  document.getElementById("saveInvoice").addEventListener("click", () => {
    state.invoices.unshift({ id: crypto.randomUUID(), ...formData(form) });
    form.reset();
    form.elements.dueDate.value = today();
    persist();
    renderInvoiceHistory();
    renderDashboard();
    notify("Cobrança salva.");
  });
  renderInvoiceHistory();
}

function renderInvoiceHistory() {
  const container = document.getElementById("invoiceHistory");
  container.innerHTML = "";
  if (!state.invoices.length) {
    container.innerHTML = emptyState("Nenhuma cobrança cadastrada.");
    return;
  }
  state.invoices.forEach((item) => {
    const amount = Number(item.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${h(item.plan || "Plano")} - ${amount}</strong><span>Vence ${shortDate(item.dueDate)} | ${h(item.status)} | ${h(item.method || "Sem forma definida")}</span></div>`;
    container.appendChild(el);
  });
}

function setupReports() {
  document.getElementById("copyReport").addEventListener("click", async () => {
    await navigator.clipboard.writeText(buildReport());
    notify("Relatório copiado.");
  });
  renderReport();
}

function buildReport() {
  const lastAssessment = state.assessments[0] || {};
  const previousAssessment = state.assessments[1] || {};
  const lastWorkout = state.workouts[0];
  const done = state.sessions.filter((session) => session.status === "Concluído").length;
  const adherence = state.sessions.length ? Math.round((done / state.sessions.length) * 100) : 0;
  const weightDelta = lastAssessment.bodyWeight && previousAssessment.bodyWeight
    ? `${(Number(lastAssessment.bodyWeight) - Number(previousAssessment.bodyWeight)).toFixed(1)} kg desde a avaliação anterior`
    : "Sem comparação suficiente";
  const nextAppointment = state.appointments.find((item) => item.status !== "Concluído");
  const openInvoices = state.invoices.filter((item) => item.status !== "Pago" && item.status !== "Cancelado");
  return [
    `Relatório do aluno: ${state.student.name || "Aluno"}`,
    `Objetivo: ${state.student.goal || "-"}`,
    `Plano: ${state.student.planName || "-"}`,
    "",
    "Evolução física",
    `Último peso: ${lastAssessment.bodyWeight || "-"} kg`,
    `IMC: ${lastAssessment.bmi || "-"} | RCQ: ${lastAssessment.whr || "-"} | IC: ${lastAssessment.conicityIndex || "-"}`,
    `Gordura: ${lastAssessment.bodyFat || "-"}% | Massa gorda: ${lastAssessment.fatMass || "-"} kg | Massa muscular: ${lastAssessment.muscleMass || "-"} kg`,
    `Variação: ${weightDelta}`,
    "",
    "Treino e aderência",
    `Prescrições salvas: ${state.workouts.length}`,
    `Aderência registrada: ${adherence}%`,
    `Último treino: ${lastWorkout ? `${lastWorkout.name} (${lastWorkout.rows.length} exercícios)` : "-"}`,
    "",
    "Alertas e ajustes",
    `Anamnese/PAR-Q: ${state.anamnesis.parq || "-"}`,
    `Alertas: ${state.anamnesis.alerts || "-"}`,
    `Último feedback: ${state.sessions[0]?.feedback || "-"}`,
    `Próximo ajuste: ${state.sessions[0]?.nextAdjustment || "-"}`,
    "",
    "Agenda e financeiro",
    `Próximo compromisso: ${nextAppointment ? `${shortDate(nextAppointment.date)} - ${nextAppointment.type}` : "-"}`,
    `Cobranças em aberto: ${openInvoices.length}`,
    "",
    state.settings.signature || state.settings.coachName || ""
  ].join("\n");
}

function renderReport() {
  const preview = document.getElementById("reportPreview");
  if (!preview) return;
  const report = buildReport();
  preview.textContent = report;
  const phone = (state.settings.whatsapp || state.student.phone || "").replace(/\D/g, "");
  const link = document.getElementById("whatsappReport");
  link.href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(report)}` : `https://wa.me/?text=${encodeURIComponent(report)}`;
}

function setupSettings() {
  const form = document.getElementById("settingsForm");
  fillForm(form, state.settings);
  document.getElementById("saveSettings").addEventListener("click", () => {
    state.settings = formData(form);
    persist();
    notify("Ajustes salvos.");
  });
  document.getElementById("clearData").addEventListener("click", () => {
    if (!confirm("Apagar todos os dados locais deste navegador?")) return;
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_ROLE_KEY);
    location.reload();
  });
}

function setupDataPortability() {
  document.getElementById("refreshDashboard").addEventListener("click", renderDashboard);
  document.getElementById("exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plannum360-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importData").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Object.assign(state, normalizeState(JSON.parse(await file.text())));
    persist();
    location.reload();
  });
}

function renderDashboard() {
  const lastAssessment = state.assessments[0] || {};
  const done = state.sessions.filter((session) => session.status === "Concluído").length;
  const adherence = state.sessions.length ? Math.round((done / state.sessions.length) * 100) : 0;
  const openInvoices = state.invoices.filter((item) => item.status !== "Pago" && item.status !== "Cancelado");
  const pendingAppointments = state.appointments.filter((item) => item.status !== "Concluído");
  const metrics = [
    ["Aluno", state.student.name || "Não cadastrado", state.student.level || "Sem nível"],
    ["Treinos", state.workouts.length, `${state.workouts.reduce((sum, workout) => sum + workout.rows.length, 0)} exercícios prescritos`],
    ["Biblioteca", state.exercises.length, `${state.favoriteExercises.length} favoritos`],
    ["Aderência", `${adherence}%`, `${state.sessions.length} registros de execução`],
    ["Último peso", lastAssessment.bodyWeight ? `${lastAssessment.bodyWeight} kg` : "-", shortDate(lastAssessment.date)],
    ["Próxima avaliação", state.student.nextAssessment ? shortDate(state.student.nextAssessment) : "-", "Defina no cadastro"],
    ["Agenda", pendingAppointments.length, pendingAppointments[0] ? `${shortDate(pendingAppointments[0].date)} - ${pendingAppointments[0].type}` : "Sem pendências"],
    ["Financeiro", openInvoices.length, openInvoices[0] ? `${openInvoices[0].status} em ${shortDate(openInvoices[0].dueDate)}` : "Tudo certo"]
  ];
  document.getElementById("metricGrid").innerHTML = metrics.map(([label, value, hint]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `).join("");
  renderNextActions();
  renderWeightChart();
}

function renderNextActions() {
  const actions = [];
  if (!state.student.name) actions.push("Cadastrar dados do aluno.");
  if (!Object.keys(state.anamnesis).length) actions.push("Preencher anamnese antes da primeira prescrição.");
  if (!state.assessments.length) actions.push("Registrar avaliação física inicial.");
  if (!state.plans.length) actions.push("Criar bloco de periodização.");
  if (!state.workouts.length) actions.push("Salvar a primeira prescrição de treino.");
  if (!state.appointments.length) actions.push("Agendar check-in, reavaliação ou troca de treino.");
  if (!state.invoices.length) actions.push("Cadastrar plano/cobrança se você for controlar pagamento por aqui.");
  if (state.student.nextAssessment) actions.push(`Reavaliação programada para ${shortDate(state.student.nextAssessment)}.`);
  if (!actions.length) actions.push("Fluxo principal completo. Acompanhe execução e ajuste carga semanalmente.");
  document.getElementById("nextActions").innerHTML = actions.map((action) => `<div class="history-item"><span>${action}</span></div>`).join("");
}

function renderWeightChart() {
  const chart = document.getElementById("weightChart");
  const points = [...state.assessments].reverse().filter((item) => Number(item.bodyWeight)).slice(-8);
  if (!points.length) {
    chart.innerHTML = `<span>Nenhuma avaliação com peso registrada.</span>`;
    return;
  }
  const values = points.map((item) => Number(item.bodyWeight));
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  chart.innerHTML = points.map((item) => {
    const value = Number(item.bodyWeight);
    const height = Math.max(14, ((value - min) / (max - min || 1)) * 170);
    return `<div class="bar" style="height:${height}px"><span>${value}kg</span></div>`;
  }).join("");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

setupTabs();
setupPrivacy();
setupStudent();
setupAnamnesis();
setupAssessment();
setupPlanning();
setupLibrary();
setupPrescription();
setupStudentApp();
setupFollowup();
setupSchedule();
setupFinance();
setupReports();
setupSettings();
setupDataPortability();
await hydrateExercisesFromJson();
renderExercises();
renderStudentWorkoutOptions();
renderStudentWorkout();
renderDashboard();
