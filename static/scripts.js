// static/scripts.js  —  Scan2Stitch (with login flow)

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Login / Auth flow
// ═══════════════════════════════════════════════════════════════════════════

const loginSection     = document.getElementById("loginSection");
const returningSection = document.getElementById("returningSection");
const measureSection   = document.getElementById("measureSection");
const statusSection    = document.getElementById("statusSection");

const nameInput    = document.getElementById("nameInput");
const pinInput     = document.getElementById("pinInput");
const pinToggleBtn = document.getElementById("pinToggleBtn");
const loginBtn     = document.getElementById("loginBtn");
const loginError   = document.getElementById("loginError");

const welcomeBackMsg    = document.getElementById("welcomeBackMsg");
const returningSubMsg   = document.getElementById("returningSubMsg");
const prevMeasurements  = document.getElementById("prevMeasurementsTable");
const newMeasurementBtn = document.getElementById("newMeasurementBtn");
const logoutBtn         = document.getElementById("logoutBtn");
const backToHistoryBtn  = document.getElementById("backToHistoryBtn");
const activeUserBadge   = document.getElementById("activeUserBadge");

// Current logged-in user state
let currentUser     = null;  // { name, is_new_user }
let historyRecords  = [];    // returned from /api/login

// ── PIN toggle ───────────────────────────────────────────────────────────
pinToggleBtn.addEventListener("click", () => {
  const isHidden = pinInput.type === "password";
  pinInput.type       = isHidden ? "text" : "password";
  pinToggleBtn.textContent = isHidden ? "🙈" : "👁";
});

// ── Login submit ─────────────────────────────────────────────────────────
loginBtn.addEventListener("click", doLogin);
pinInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") pinInput.focus(); });

async function doLogin() {
  const name = nameInput.value.trim();
  const pin  = pinInput.value.trim();

  loginError.classList.add("hidden");

  if (!name) { showLoginError("Naam bharna zaroori hai."); return; }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showLoginError("PIN sirf 4 numbers ka hona chahiye."); return;
  }

  loginBtn.disabled    = true;
  loginBtn.textContent = "Check ho raha hai…";

  try {
    const resp = await fetch("/api/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, pin }),
    });
    const data = await resp.json();

    if (!data.success) {
      showLoginError(data.error || "Kuch gadbad ho gayi.");
      return;
    }

    currentUser    = { name: data.user_name, is_new_user: data.is_new_user };
    historyRecords = data.history || [];

    if (data.is_new_user) {
      // Naya user — seedha camera flow pe bhejo
      loginSection.classList.add("hidden");
      startMeasureFlow();
    } else {
      // Purana user — history dikhao
      loginSection.classList.add("hidden");
      showReturningUser();
    }

  } catch (err) {
    showLoginError("Network error. Dobara koshish karein.");
  } finally {
    loginBtn.disabled    = false;
    loginBtn.textContent = "Aage Badhein →";
  }
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

// ── Returning user screen ─────────────────────────────────────────────────
function showReturningUser() {
  returningSection.classList.remove("hidden");
  measureSection.classList.add("hidden");
  statusSection.classList.add("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("warningsSection").classList.add("hidden");

  welcomeBackMsg.textContent  = `Wapas aaiye, ${currentUser.name}! 👋`;
  returningSubMsg.textContent = historyRecords.length
    ? `Aapki ${historyRecords.length} measurement${historyRecords.length > 1 ? "s" : ""} pehle se saved hain.`
    : "Aapka koi record nahi mila. Nayi measurement lein!";

  renderHistoryTable();
}

function renderHistoryTable() {
  if (!historyRecords.length) {
    prevMeasurements.innerHTML = `<p class="no-history">Koi measurement record nahi mila.</p>`;
    return;
  }

  const headers = ["Date", "Height", "Shoulder", "Chest", "Waist", "Hip", "Inseam", "Sleeve", "Torso"];
  const keys    = ["created_at", "height_cm", "shoulder", "chest", "waist", "hip", "inseam", "sleeve", "torso"];

  let html = `<table class="prev-table"><thead><tr>`;
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += `</tr></thead><tbody>`;

  historyRecords.forEach(row => {
    html += `<tr>`;
    keys.forEach(k => {
      if (k === "created_at") {
        const d = new Date(row[k]);
        const label = isNaN(d) ? row[k] : d.toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric"
        });
        html += `<td>${label}</td>`;
      } else {
        const val = row[k] != null ? `${row[k]} cm` : "—";
        html += `<td class="val-cell">${val}</td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  prevMeasurements.innerHTML = html;
}

// ── New measurement from returning screen ─────────────────────────────────
newMeasurementBtn.addEventListener("click", () => {
  returningSection.classList.add("hidden");
  startMeasureFlow();
});

// ── Back to history (from camera) ─────────────────────────────────────────
backToHistoryBtn.addEventListener("click", () => {
  // Camera band karo
  if (videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

  // State reset karo
  resetCaptureState();

  measureSection.classList.add("hidden");
  statusSection.classList.add("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("warningsSection").classList.add("hidden");

  if (currentUser && !currentUser.is_new_user) {
    showReturningUser();
  } else {
    // Naya user tha — login pe wapas
    loginSection.classList.remove("hidden");
    currentUser = null;
  }
});

// ── Logout ────────────────────────────────────────────────────────────────
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  currentUser   = null;
  historyRecords = [];
  nameInput.value = "";
  pinInput.value  = "";
  returningSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  loginError.classList.add("hidden");
});

// ── Start measure flow ────────────────────────────────────────────────────
function startMeasureFlow() {
  resetCaptureState();
  measureSection.classList.remove("hidden");
  statusSection.classList.remove("hidden");

  if (currentUser) {
    activeUserBadge.textContent = `👤 ${currentUser.name}`;
  }

  // Back button — returning user ko history dikhao, new user ko hide karo
  backToHistoryBtn.style.display = (currentUser && !currentUser.is_new_user) ? "" : "none";

  initCamera();
}

function resetCaptureState() {
  frontImageData = null;
  sideImageData  = null;
  backImageData  = null;
  poseQualityOk  = false;
  currentStep    = "front";
  cancelCountdown();

  // Buttons reset
  if (captureFrontBtn) {
    captureFrontBtn.disabled = false;
    captureFrontBtn.classList.remove("success");
  }
  if (captureSideBtn) {
    captureSideBtn.disabled = true;
    captureSideBtn.classList.remove("success");
  }
  if (captureBackBtn) {
    captureBackBtn.disabled = true;
    captureBackBtn.classList.remove("success");
  }
  if (submitBtn) submitBtn.disabled = true;

  updateSteps();
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Camera & Pose flow (original, mostly unchanged)
// ═══════════════════════════════════════════════════════════════════════════

const videoEl       = document.getElementById("liveVideo");
const overlayCanvas = document.getElementById("overlayCanvas");
const snapCanvas    = document.getElementById("snapshotCanvas");
const overlayCtx    = overlayCanvas.getContext("2d");
const snapCtx       = snapCanvas.getContext("2d");

const captureFrontBtn = document.getElementById("captureFrontBtn");
const captureSideBtn  = document.getElementById("captureSideBtn");
const captureBackBtn  = document.getElementById("captureBackBtn");
const submitBtn       = document.getElementById("submitBtn");
const statusMessage   = document.getElementById("statusMessage");
const poseHint        = document.getElementById("poseHint");
const resultsSection  = document.getElementById("resultsSection");
const heightInput     = document.getElementById("heightInput");
const anglesUsed      = document.getElementById("anglesUsed");

const shoulderValue = document.getElementById("shoulderValue");
const chestValue    = document.getElementById("chestValue");
const waistValue    = document.getElementById("waistValue");
const hipValue      = document.getElementById("hipValue");
const inseamValue   = document.getElementById("inseamValue");
const sleeveValue   = document.getElementById("sleeveValue");
const torsoValue    = document.getElementById("torsoValue");
const debugBlock    = document.getElementById("debugBlock");
const warningsBlock = document.getElementById("warningsBlock");

let frontImageData = null;
let sideImageData  = null;
let backImageData  = null;
let poseQualityOk  = false;
let animFrameId    = null;
let currentStep    = "front";

let userInteracted = false;
document.addEventListener("click", () => {
  if (!userInteracted) {
    userInteracted = true;
    Voice.sayNow(MSG.welcome);
  }
}, { once: true });

// ── Countdown state ───────────────────────────────────────────────────────
let countdownActive = false;
let countdownVal    = 0;
let countdownTimer  = null;
let announcedPose   = false;
const COUNTDOWN_SEC = 5;

// ── MediaPipe Pose ─────────────────────────────────────────────────────────
const mpPose = window.Pose
  ? new window.Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
  : null;

if (mpPose) {
  mpPose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  mpPose.onResults(onPoseResults);
}

// ── Camera init ───────────────────────────────────────────────────────────
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
      audio: false,
    });
    videoEl.srcObject = stream;
    videoEl.addEventListener("loadeddata", () => {
      overlayCanvas.width  = videoEl.videoWidth;
      overlayCanvas.height = videoEl.videoHeight;
      startPoseLoop();
    });
    setStatus("Camera ready. Stand fully in frame.");
    if (userInteracted) Voice.say(MSG.cameraReady);
  } catch (err) {
    setStatus(`Camera error: ${err.message}`);
  }
}

// ── Pose loop ─────────────────────────────────────────────────────────────
function startPoseLoop() {
  async function loop() {
    if (mpPose && !videoEl.paused && videoEl.readyState >= 2)
      await mpPose.send({ image: videoEl });
    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

// ── Countdown helpers ─────────────────────────────────────────────────────
async function startCountdown(onComplete) {
  if (countdownActive) return;
  countdownActive = true;
  countdownVal    = COUNTDOWN_SEC;
  drawCountdown(countdownVal);

  if (userInteracted) await Voice.sayNow(MSG.poseGood);
  if (!countdownActive) return;

  countdownTimer = setInterval(() => {
    countdownVal--;
    if (countdownVal <= 0) {
      clearInterval(countdownTimer);
      countdownTimer  = null;
      countdownActive = false;
      announcedPose   = false;
      drawCountdown(null);
      onComplete();
    } else {
      drawCountdown(countdownVal);
      if (userInteracted) Voice.sayNow(String(countdownVal));
    }
  }, 1000);
}

function cancelCountdown() {
  if (!countdownActive) return;
  clearInterval(countdownTimer);
  countdownTimer  = null;
  countdownActive = false;
  countdownVal    = 0;
  announcedPose   = false;
  drawCountdown(null);
}

function drawCountdown(n) {
  const W = overlayCanvas.width, H = overlayCanvas.height;
  if (n === null) return;
  const size = Math.min(W, H) * 0.38;
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.arc(W / 2, H / 2, size * 0.62, 0, Math.PI * 2);
  overlayCtx.fillStyle = "rgba(0,0,0,0.45)";
  overlayCtx.fill();
  overlayCtx.beginPath();
  overlayCtx.arc(W / 2, H / 2, size * 0.62, -Math.PI / 2,
    -Math.PI / 2 + (Math.PI * 2 * (n / COUNTDOWN_SEC)), false);
  overlayCtx.strokeStyle = n <= 1 ? "#ff5252" : n <= 2 ? "#ffeb3b" : "#00e676";
  overlayCtx.lineWidth   = size * 0.08;
  overlayCtx.stroke();
  overlayCtx.font         = `bold ${size}px sans-serif`;
  overlayCtx.fillStyle    = "#ffffff";
  overlayCtx.textAlign    = "center";
  overlayCtx.textBaseline = "middle";
  overlayCtx.shadowColor  = "rgba(0,0,0,0.6)";
  overlayCtx.shadowBlur   = 12;
  overlayCtx.fillText(String(n), W / 2, H / 2);
  overlayCtx.restore();
}

// ── Pose result handler ───────────────────────────────────────────────────
function onPoseResults(results) {
  overlayCanvas.width  = videoEl.videoWidth;
  overlayCanvas.height = videoEl.videoHeight;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!results.poseLandmarks) {
    setPoseHint("⚠ Step back — full body visible karo.", false);
    poseQualityOk = false;
    cancelCountdown();
    return;
  }

  drawSkeleton(results.poseLandmarks, overlayCtx, overlayCanvas.width, overlayCanvas.height);

  if (countdownActive) { drawCountdown(countdownVal); return; }

  if (currentStep === "back") {
    setPoseHint("✓ Hold still — back photo countdown shuru hoga!", true);
    poseQualityOk = true;
    if (!backImageData && !countdownActive) {
      startCountdown(() => { if (!backImageData) captureBackBtn.click(); });
    }
    return;
  }

  if (currentStep !== "front" && currentStep !== "side") return;

  const quality = checkPoseQuality(results.poseLandmarks);
  poseQualityOk = quality.ok;
  setPoseHint(quality.message, quality.ok);

  const targetData = currentStep === "front" ? frontImageData : sideImageData;
  const targetBtn  = currentStep === "front" ? captureFrontBtn : captureSideBtn;

  if (quality.ok && !targetData && !countdownActive) {
    startCountdown(() => {
      const stillOk = currentStep === "front" ? !frontImageData : !sideImageData;
      if (stillOk) targetBtn.click();
    });
  } else if (!quality.ok) {
    cancelCountdown();
  }
}

// ── Skeleton drawing ──────────────────────────────────────────────────────
function drawSkeleton(landmarks, ctx, W, H) {
  const GOOD = "#00e676", WARN = "#ff9800";
  const connections = [
    [11,12],[11,13],[13,15],[12,14],[14,16],
    [11,23],[12,24],[23,24],
    [23,25],[25,27],[27,29],[24,26],[26,28],[28,30],
  ];
  ctx.lineWidth = 2;
  for (const [a, b] of connections) {
    const pA = landmarks[a], pB = landmarks[b];
    if (!pA || !pB) continue;
    const vis = pA.visibility > 0.5 && pB.visibility > 0.5;
    ctx.strokeStyle = vis ? GOOD : WARN;
    ctx.globalAlpha = vis ? 0.85 : 0.35;
    ctx.beginPath();
    ctx.moveTo(pA.x * W, pA.y * H);
    ctx.lineTo(pB.x * W, pB.y * H);
    ctx.stroke();
  }
  for (let i = 11; i <= 32; i++) {
    const lm = landmarks[i];
    if (!lm) continue;
    const vis = lm.visibility > 0.5;
    ctx.globalAlpha = vis ? 1 : 0.3;
    ctx.fillStyle   = vis ? GOOD : WARN;
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

// ── Pose quality check ────────────────────────────────────────────────────
function checkPoseQuality(landmarks) {
  const required = [0, 11, 12, 23, 24, 27, 28];
  if (!required.every(i => landmarks[i] && landmarks[i].visibility > 0.55))
    return { ok: false, message: "⚠ Step back — head to feet should be in frame." };
  const ls = landmarks[11], rs = landmarks[12];
  const lh = landmarks[23], rh = landmarks[24];
  if (Math.abs(ls.y - rs.y) / Math.max(Math.abs(ls.x - rs.x), 0.01) > 0.15)
    return { ok: false, message: "⚠ Shoulders tilted — stand straight." };
  if (Math.abs(lh.y - rh.y) / Math.max(Math.abs(lh.x - rh.x), 0.01) > 0.15)
    return { ok: false, message: "⚠ Hips tilted — stand straight." };
  const midX = (ls.x + rs.x + lh.x + rh.x) / 4;
  if (midX < 0.25 || midX > 0.75)
    return { ok: false, message: "⚠ Centre mein aao." };
  return { ok: true, message: `✓ Perfect! ${COUNTDOWN_SEC} second mein capture hoga...` };
}

// ── Snapshot ──────────────────────────────────────────────────────────────
function captureSnapshot() {
  snapCanvas.width  = videoEl.videoWidth;
  snapCanvas.height = videoEl.videoHeight;
  snapCtx.drawImage(videoEl, 0, 0, snapCanvas.width, snapCanvas.height);
  return snapCanvas.toDataURL("image/jpeg", 0.92);
}

// ── Step indicator ────────────────────────────────────────────────────────
function updateSteps() {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    const steps    = ["front", "side", "back"];
    const stepDone = { front: !!frontImageData, side: !!sideImageData, back: !!backImageData };
    dot.classList.toggle("done",   stepDone[steps[i]]);
    dot.classList.toggle("active", currentStep === steps[i] && !stepDone[steps[i]]);
  });
}

// ── FRONT capture ─────────────────────────────────────────────────────────
captureFrontBtn.addEventListener("click", () => {
  if (mpPose && !poseQualityOk) { setPoseHint("Pehle sahi pose lo.", false); return; }
  if (frontImageData) return;
  cancelCountdown();
  frontImageData = captureSnapshot();
  captureFrontBtn.classList.add("success");
  captureSideBtn.disabled = false;
  currentStep = "side";
  setStatus("Front ✓ — Ab 90° side mein ghoom jao.");
  if (userInteracted) Voice.say(MSG.frontCaptured);
  updateSteps();
});

// ── SIDE capture ──────────────────────────────────────────────────────────
captureSideBtn.addEventListener("click", () => {
  if (sideImageData) return;
  cancelCountdown();
  sideImageData = captureSnapshot();
  captureSideBtn.classList.add("success");
  captureBackBtn.disabled = false;
  currentStep = "back";
  setStatus("Side ✓ — Ab peeche ghoom jao.");
  if (userInteracted) Voice.say(MSG.sideReady);
  updateSteps();
});

// ── BACK capture ──────────────────────────────────────────────────────────
captureBackBtn.addEventListener("click", () => {
  if (backImageData) return;
  cancelCountdown();
  backImageData = captureSnapshot();
  captureBackBtn.classList.add("success");
  submitBtn.disabled = false;
  currentStep = "done";
  setStatus("Back ✓ — Teeno photos ho gaye! Calculate dabao.");
  if (userInteracted) Voice.say("Back photo captured. All three photos done. Tap calculate whenever you are ready.");
  updateSteps();
});

// ── Calculate ─────────────────────────────────────────────────────────────
submitBtn.addEventListener("click", async () => {
  const heightCm = Number(heightInput.value);
  if (!heightCm || heightCm < 100 || heightCm > 230) {
    alert("Height 100–230 cm ke beech honi chahiye.");
    return;
  }
  if (!frontImageData || !sideImageData) {
    alert("Pehle front aur side photos lo.");
    return;
  }
  setStatus("Calculating measurements…");
  Voice.say(MSG.sideCaptured);
  submitBtn.disabled = true;

  try {
    const body = { heightCm, frontImage: frontImageData, sideImage: sideImageData };
    if (backImageData) body.backImage = backImageData;

    const resp   = await fetch("/api/measure", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const result = await resp.json();
    if (!result.success) throw new Error(result.error || "Unknown error.");

    const d = result.measurements;
    shoulderValue.textContent = d.shoulder_width_cm      ?? "--";
    chestValue.textContent    = d.chest_circumference_cm ?? "--";
    waistValue.textContent    = d.waist_circumference_cm ?? "--";
    hipValue.textContent      = d.hip_circumference_cm   ?? "--";
    inseamValue.textContent   = d.inseam_cm              ?? "--";
    sleeveValue.textContent   = d.sleeve_length_cm       ?? "--";
    torsoValue.textContent    = d.torso_length_cm        ?? "--";
    debugBlock.textContent    = JSON.stringify(d.debug, null, 2);
    if (anglesUsed) anglesUsed.textContent = `${d.angles_used} angles used`;

    warningsBlock.innerHTML = "";
    if (d.pose_warnings?.length) {
      d.pose_warnings.forEach(w => {
        const li = document.createElement("li");
        li.textContent = w;
        warningsBlock.appendChild(li);
      });
      warningsBlock.parentElement.classList.remove("hidden");
    } else {
      warningsBlock.parentElement.classList.add("hidden");
    }

    resultsSection.classList.remove("hidden");
    if (typeof drawBodyVisual === "function") drawBodyVisual(d);
    speakMeasurements(d);
    setStatus("Measurements ready!");

    // History refresh karo agar returning user hai
    if (currentUser && !currentUser.is_new_user) {
      try {
        const hr = await fetch("/api/history");
        const hd = await hr.json();
        if (hd.success) historyRecords = hd.history;
      } catch (_) {}
    }

  } catch (err) {
    setStatus(`Error: ${err.message}`);
    Voice.sayNow(MSG.calcError);
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(msg)         { statusMessage.textContent = msg; }
function setPoseHint(msg, good) {
  poseHint.textContent = msg;
  poseHint.style.color = good ? "#2e7d32" : "#e65100";
}

// ── Initial state — login screen dikhao ──────────────────────────────────
// (Camera aur steps baad mein, login ke baad)
updateSteps();