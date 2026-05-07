const GAME_TURNS = 16;
const TURN_DURATION = 5;
const TOTAL_MONTHS = 4;
const MAX_BLADE_LENGTH = 18;
const SUN_ANGLE_DEG = 42;
const SUN_ANGLE_RAD = (SUN_ANGLE_DEG * Math.PI) / 180;
const HALL_OF_FAME_KEY = "grassblade.hallOfFame.v1";
const CELL_OFFSETS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];

const state = {
  running: false,
  turn: 0,
  turnTime: 0,
  bladeLength: 5.2,
  bladeAngle: 0,
  bladeAngularVelocity: 0,
  selectedOffset: 0,
  currentOptions: [],
  idealOffset: 0,
  score: 0,
  month: 0,
  finalScore: 0,
  hallRecorded: false,
  lastTimestamp: 0,
};

const canvas = document.getElementById("grassCanvas");
const ctx = canvas.getContext("2d");
const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const monthEl = document.getElementById("month");
const overlayMessage = document.getElementById("overlayMessage");
const resetBtn = document.getElementById("resetBtn");
const scoreBtn = document.getElementById("scoreBtn");
const hallBtn = document.getElementById("hallBtn");
const hallPanel = document.getElementById("hallPanel");
const decorateBtn = document.getElementById("decorateBtn");
const screenshotBtn = document.getElementById("screenshotBtn");
const shareBtn = document.getElementById("shareBtn");
const hallOfFameListEl = document.getElementById("hallOfFameList");
const clearHallBtn = document.getElementById("clearHallBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const menuToggleBtn = document.getElementById("menuToggleBtn");

const dpr = Math.min(window.devicePixelRatio || 1, 2);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function normalizeHallOfFame(scores) {
  if (!Array.isArray(scores)) {
    return [];
  }
  return scores
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.floor(n))
    .sort((a, b) => b - a)
    .slice(0, 3);
}

function loadHallOfFame() {
  try {
    const raw = localStorage.getItem(HALL_OF_FAME_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return normalizeHallOfFame(parsed);
  } catch {
    return [];
  }
}

function saveHallOfFame(scores) {
  const normalized = normalizeHallOfFame(scores);
  try {
    localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore private mode failures.
  }
  return normalized;
}

function renderHallOfFame(scores = loadHallOfFame()) {
  if (!hallOfFameListEl) {
    return;
  }
  hallOfFameListEl.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const li = document.createElement("li");
    const value = scores[i] ?? 0;
    li.textContent = `${value.toLocaleString()} cm`;
    hallOfFameListEl.appendChild(li);
  }
}

function recordHallOfFame(score) {
  if (!Number.isFinite(score) || score < 0) {
    return;
  }
  const next = saveHallOfFame([...loadHallOfFame(), Math.floor(score)]);
  renderHallOfFame(next);
}

function ensureCanvasSize() {
  const bounds = canvas.getBoundingClientRect();
  const nextWidth = Math.floor(bounds.width * dpr);
  const nextHeight = Math.floor(bounds.height * dpr);
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setOverlay(message, modifier = "") {
  if (!message) {
    overlayMessage.hidden = true;
    overlayMessage.className = "overlay-message";
    return;
  }
  overlayMessage.hidden = false;
  overlayMessage.textContent = message;
  overlayMessage.className = `overlay-message ${modifier}`.trim();
}

function showStartScreen() {
  setOverlay(
    "GrassBlade\n\nTap to start\n\nChoose the chlorophyll drop every 5 seconds.\nAim slightly toward the sun for stronger growth.",
    "start-screen"
  );
}

function generateTurnOptions() {
  const ideal = clamp(Math.sin(SUN_ANGLE_RAD) * 0.78 + (Math.random() * 2 - 1) * 0.24, -0.82, 0.82);
  state.idealOffset = ideal;
  state.currentOptions = CELL_OFFSETS.map((offset) => {
    const closeness = clamp(1 - Math.abs(offset - ideal) / 1.25, 0, 1);
    const noise = (Math.random() - 0.5) * 0.16;
    const score = clamp(0.45 + closeness * 0.4 + noise, 0.2, 1);
    return {
      offset,
      score,
      closeness,
      isOptimal: Math.abs(offset - ideal) < 0.18,
    };
  });
  const fallback = state.currentOptions.reduce((best, option) => {
    return Math.abs(option.offset - state.selectedOffset) < Math.abs(best.offset - state.selectedOffset)
      ? option
      : best;
  }, state.currentOptions[0]);
  state.selectedOffset = fallback.offset;
}

function getOptionForOffset(offset) {
  return state.currentOptions.find((option) => option.offset === offset) || state.currentOptions[3];
}

function getGrowthParameters() {
  const option = getOptionForOffset(state.selectedOffset);
  const baseTarget = state.selectedOffset * 0.92 + state.idealOffset * 0.28;
  const targetAngle = clamp(baseTarget, -1.35, 1.35);
  const directionalAlignment = clamp(1 - Math.abs(state.selectedOffset - state.idealOffset) * 0.95, 0, 1);
  const stability = clamp(1 - Math.abs(state.selectedOffset) * 0.42, 0.18, 1);
  let vigor = clamp(option.score * 0.84 + stability * 0.25, 0.22, 1);
  if (Math.abs(state.selectedOffset) > 0.78) {
    vigor *= 0.72;
  }
  const tiltPenalty = Math.max(0, Math.abs(state.bladeAngle) - 1.05) * 0.18;
  const growth = clamp(0.8 + vigor * 0.95 - tiltPenalty * 0.25, 0.18, 2.2);
  return { targetAngle, growth, stability, directionalAlignment, option };
}

function updateGame(dt) {
  if (!state.running) {
    return;
  }

  state.turnTime += dt;
  const params = getGrowthParameters();
  state.bladeAngularVelocity += (params.targetAngle - state.bladeAngle) * 1.14 * dt;
  state.bladeAngularVelocity *= 0.92;
  state.bladeAngle += state.bladeAngularVelocity * dt;

  const drift = Math.sin(state.bladeAngle * 0.8) * 0.1;
  state.bladeLength = clamp(state.bladeLength + (params.growth - drift) * dt, 0, MAX_BLADE_LENGTH);

  const angleBonus = Math.max(0, 0.48 - Math.abs(state.bladeAngle - SUN_ANGLE_RAD)) * 210;
  state.score = Math.floor(state.bladeLength * 110 + angleBonus + params.directionalAlignment * 32);
  state.month = clamp(
    ((state.turn - 1 + state.turnTime / TURN_DURATION) / GAME_TURNS) * TOTAL_MONTHS,
    0,
    TOTAL_MONTHS
  );

  if (state.turnTime >= TURN_DURATION) {
    state.turnTime -= TURN_DURATION;
    advanceTurn();
  }
}

function advanceTurn() {
  if (state.turn >= GAME_TURNS) {
    endGame();
    return;
  }
  state.turn += 1;
  if (Math.abs(state.bladeAngle) > 1.3) {
    state.bladeLength = clamp(state.bladeLength - 0.6, 0, MAX_BLADE_LENGTH);
  }
  generateTurnOptions();
}

function startGame() {
  state.running = true;
  state.turn = 1;
  state.turnTime = 0;
  state.bladeLength = 5.2;
  state.bladeAngle = 0;
  state.bladeAngularVelocity = 0;
  state.selectedOffset = 0;
  state.score = 0;
  state.month = 0;
  state.finalScore = 0;
  state.hallRecorded = false;
  state.lastTimestamp = performance.now();
  generateTurnOptions();
  setOverlay("");
}

function endGame() {
  state.running = false;
  state.finalScore = Math.max(0, Math.floor(state.score));
  if (!state.hallRecorded) {
    recordHallOfFame(state.finalScore);
    state.hallRecorded = true;
  }
  setOverlay(
    `Game over\n\nFinal score ${state.finalScore.toLocaleString()} cm\n\nTap to play again`,
    "start-screen"
  );
}

function pickClosestOffset(positionX, width) {
  const normalized = clamp((positionX - width * 0.5) / (width * 0.36), -1, 1);
  let best = state.currentOptions[0];
  for (const option of state.currentOptions) {
    if (Math.abs(option.offset - normalized) < Math.abs(best.offset - normalized)) {
      best = option;
    }
  }
  return best.offset;
}

function handleCanvasPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (!state.running) {
    startGame();
    return;
  }
  state.selectedOffset = pickClosestOffset(x, rect.width);
}

function drawBackground(w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#bde6ff");
  sky.addColorStop(0.55, "#d9f1ef");
  sky.addColorStop(1, "#f3f7f1");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const ground = ctx.createLinearGradient(0, h * 0.45, 0, h);
  ground.addColorStop(0, "#8dc269");
  ground.addColorStop(1, "#4a7b42");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  const horizon = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.5);
  horizon.addColorStop(0, "rgba(255,255,255,0.72)");
  horizon.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.42, w, h * 0.08);
}

function drawSunArc(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.12;
  const r = w * 0.38;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 0.65, false);
  ctx.stroke();
  ctx.restore();

  const sunX = cx + r * Math.sin(SUN_ANGLE_RAD);
  const sunY = cy - r * Math.cos(SUN_ANGLE_RAD);
  const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 48);
  sunGradient.addColorStop(0, "#fff8c8");
  sunGradient.addColorStop(0.4, "#ffe88d");
  sunGradient.addColorStop(1, "rgba(255, 183, 64, 0.05)");
  ctx.fillStyle = sunGradient;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffec8b";
  ctx.shadowColor = "rgba(255,220,110,0.45)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 12px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SUN", sunX, sunY - 32);
}

function drawCenterLine(w, h) {
  const baseX = w * 0.5;
  const groundY = h * 0.92;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(baseX, groundY);
  ctx.lineTo(baseX, h * 0.24);
  ctx.stroke();
  ctx.restore();
}

function drawBlade(w, h) {
  const baseX = w * 0.5;
  const baseY = h * 0.92;
  const lengthPx = 60 + state.bladeLength * 16;
  const angle = state.bladeAngle;

  const tipX = baseX + Math.sin(angle) * lengthPx;
  const tipY = baseY - Math.cos(angle) * lengthPx;
  const controlX1 = baseX + Math.sin(angle) * (lengthPx * 0.3) - Math.cos(angle) * 14;
  const controlY1 = baseY - Math.cos(angle) * (lengthPx * 0.32) - Math.sin(angle) * 12;
  const controlX2 = baseX + Math.sin(angle) * (lengthPx * 0.65) - Math.cos(angle) * 10;
  const controlY2 = baseY - Math.cos(angle) * (lengthPx * 0.63) - Math.sin(angle) * 6;

  const glow = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
  glow.addColorStop(0, "rgba(173,255,168,0.2)");
  glow.addColorStop(1, "rgba(212,255,182,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.bezierCurveTo(controlX1 - 8, controlY1, controlX2 - 10, controlY2, tipX - 4, tipY);
  ctx.lineTo(tipX + 4, tipY);
  ctx.bezierCurveTo(controlX2 + 10, controlY2, controlX1 + 8, controlY1, baseX + 6, baseY);
  ctx.closePath();
  ctx.fill();

  const bladeGradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
  bladeGradient.addColorStop(0, "#5a8c45");
  bladeGradient.addColorStop(0.45, "#7fbd53");
  bladeGradient.addColorStop(1, "#c5f18d");
  ctx.fillStyle = bladeGradient;
  ctx.strokeStyle = "rgba(33, 66, 31, 0.96)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.bezierCurveTo(controlX1 - 8, controlY1, controlX2 - 10, controlY2, tipX - 4, tipY);
  ctx.lineTo(tipX + 4, tipY);
  ctx.bezierCurveTo(controlX2 + 10, controlY2, controlX1 + 8, controlY1, baseX + 6, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseX - 2, baseY - 8);
  ctx.lineTo(tipX - 2, tipY);
  ctx.stroke();
}

function drawDropOptions(w, h) {
  const zoneY = h * 0.68;
  const radius = 16;
  const centerX = w * 0.5;
  const step = w * 0.096;

  for (const option of state.currentOptions) {
    const x = centerX + option.offset * (w * 0.35);
    const strength = clamp(option.closeness * 0.98 + option.score * 0.12, 0, 1);
    const color = option.isOptimal ? "#ffd16f" : `rgba(${Math.floor(68 + 140 * option.score)}, ${Math.floor(166 + 70 * option.score)}, 92, 0.95)`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, zoneY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.floor((option.offset + 1) * 3 + 1)), x, zoneY + 5);

    ctx.strokeStyle = state.selectedOffset === option.offset ? "#ffffff" : "rgba(255,255,255,0.36)";
    ctx.lineWidth = state.selectedOffset === option.offset ? 3 : 1.5;
    ctx.stroke();
  }

  const idealX = centerX + state.idealOffset * (w * 0.35);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(idealX, zoneY - 28);
  ctx.lineTo(idealX, zoneY + 28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 12px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Optimal zone", idealX, zoneY - 38);
}

function drawHud(w, h) {
  ctx.fillStyle = "rgba(15, 34, 18, 0.9)";
  ctx.font = "700 18px Manrope, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Turn ${state.turn}/${GAME_TURNS}`, w * 0.06, h * 0.06);
  ctx.fillText(`Next drop in ${Math.max(0, Math.ceil(TURN_DURATION - state.turnTime))}s`, w * 0.06, h * 0.11);

  ctx.textAlign = "right";
  ctx.fillText(`Score ${state.score.toLocaleString()} cm`, w * 0.94, h * 0.06);
  ctx.fillText(`Month ${state.month.toFixed(1)}`, w * 0.94, h * 0.11);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 12px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Tap a drop position along the base line", w * 0.5, h * 0.88);
  ctx.fillText("Center = steady growth | Right = sunward momentum | Far side = riskier but stronger pull", w * 0.5, h * 0.92);
}

function drawSunIndicator(w, h) {
  const centerX = w * 0.5;
  const centerY = h * 0.24;
  const radius = w * 0.18;
  const sunX = centerX + radius * Math.sin(SUN_ANGLE_RAD);
  const sunY = centerY - radius * Math.cos(SUN_ANGLE_RAD);

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.moveTo(centerX, h * 0.44);
  ctx.lineTo(sunX, sunY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,236,138,0.95)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 13px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Sun direction", sunX, sunY - 20);
}

function drawGridLines(w, h) {
  const centerX = w * 0.5;
  const baseY = h * 0.92;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const x = centerX + i * (w * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, baseY - 22);
    ctx.lineTo(x, baseY + 26);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  ensureCanvasSize();
  const bounds = canvas.getBoundingClientRect();
  const w = bounds.width;
  const h = bounds.height;

  ctx.clearRect(0, 0, w, h);
  drawBackground(w, h);
  drawSunArc(w, h);
  drawCenterLine(w, h);
  drawSunIndicator(w, h);
  drawBlade(w, h);
  drawGridLines(w, h);
  drawDropOptions(w, h);
  drawHud(w, h);
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTimestamp) / 1000 || 0);
  state.lastTimestamp = timestamp;
  updateGame(dt);
  draw();
  window.requestAnimationFrame(loop);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.parentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function clearHallOfFame() {
  saveHallOfFame([]);
  renderHallOfFame([]);
}

function init() {
  renderHallOfFame();
  showStartScreen();
  ensureCanvasSize();
  window.addEventListener("resize", () => {
    ensureCanvasSize();
    draw();
  });

  canvas.addEventListener("pointerdown", handleCanvasPointer);
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons && state.running) {
      handleCanvasPointer(event);
    }
  });

  resetBtn.addEventListener("click", () => {
    startGame();
    hallPanel.hidden = true;
  });
  hallBtn.addEventListener("click", () => {
    hallPanel.hidden = !hallPanel.hidden;
  });
  clearHallBtn.addEventListener("click", clearHallOfFame);
  scoreBtn.addEventListener("click", () => {
    setOverlay(`Current score ${state.score.toLocaleString()} cm\n\nTap to continue`, "start-screen");
  });
  fullscreenBtn.addEventListener("click", toggleFullscreen);
  menuToggleBtn.addEventListener("click", () => {
    hallPanel.hidden = !hallPanel.hidden;
  });

  decorateBtn.disabled = true;
  screenshotBtn.disabled = true;
  shareBtn.disabled = true;

  window.requestAnimationFrame((timestamp) => {
    state.lastTimestamp = timestamp;
    loop(timestamp);
  });
}

window.addEventListener("load", init);
