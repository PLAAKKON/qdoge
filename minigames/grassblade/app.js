const GRID_COLS = 40;
const GRID_ROWS = 25;
const CELL_COUNT = GRID_COLS * GRID_ROWS;
const REAL_BLADES_PER_SIM_BLADE = 100;
const GAME_DURATION_SECONDS = 75;
const SIM_MONTHS_TOTAL = 4;
const MAX_HEIGHT_CM = 22;
const SUN_RADIUS_CELLS = 14;
const SHADE_STEPS = 6;
const SHADE_HEIGHT_STEP = 0.05;
const SHADE_PENALTY_PER_BLOCKER = 0.15;
const SOFT_SHADOW_STRENGTH = 0.9;
const LIGHT_GROWTH_THRESHOLD = 0.2;
const NO_LIGHT_THRESHOLD = 0.1;
const GROWTH_RATE_PER_SEC = 0.3;
const NO_SUN_DECAY_RATE_PER_SEC = GROWTH_RATE_PER_SEC * 0.1;
const DARKEN_FULL_SECONDS = 10;
const MAX_DARKNESS = 0.8;
const STARVE_SECONDS_FOR_DORMANCY = 3;
const RECHARGE_LIGHT_SECONDS = 1;
const SUN_MOVE_SMOOTH_SECONDS = 0.22;
const GRASS_BEND_LAG_SECONDS = 0.42;
const SUN_VISIT_RADIUS_CELLS = 1.2;
const FULL_BRIGHT_HOLD_SECONDS = 5;
const HUD_SECTOR_COLS = 6;
const HUD_SECTOR_ROWS = 3;
const HUD_SECTOR_COUNT = HUD_SECTOR_COLS * HUD_SECTOR_ROWS;
const HUD_MAX_AGE_SECONDS = 10;
const VIEW_ANGLE_DEG = 60;
const CROWN_BONUS_POINTS = 1000;
const HALL_OF_FAME_KEY = "grassbattle.hallOfFame.v1";
let hallOfFameMemoryCache = [];

const state = {
  heights: new Float32Array(CELL_COUNT),
  lights: new Float32Array(CELL_COUNT),
  darkness: new Float32Array(CELL_COUNT),
  noLightTime: new Float32Array(CELL_COUNT),
  rechargeLightTime: new Float32Array(CELL_COUNT),
  dormant: new Uint8Array(CELL_COUNT),
  shadowed: new Uint8Array(CELL_COUNT),
  poseBaseX: new Float32Array(CELL_COUNT),
  poseBaseY: new Float32Array(CELL_COUNT),
  poseCtrlX: new Float32Array(CELL_COUNT),
  poseCtrlY: new Float32Array(CELL_COUNT),
  poseTipX: new Float32Array(CELL_COUNT),
  poseTipY: new Float32Array(CELL_COUNT),
  fullBrightHold: new Float32Array(CELL_COUNT),
  sunDwellTime: new Float32Array(CELL_COUNT),
  sunBlessTimer: new Float32Array(CELL_COUNT),
  fieldSectorAge: new Float32Array(HUD_SECTOR_COUNT),
  controlSectorAge: new Float32Array(HUD_SECTOR_COUNT),
  sectorSunDwell: new Float32Array(HUD_SECTOR_COUNT),
  sectorCrownEarned: new Uint8Array(HUD_SECTOR_COUNT),
  sectorStoneActive: new Uint8Array(HUD_SECTOR_COUNT),
  sectorStoneDrop: new Float32Array(HUD_SECTOR_COUNT),
  sectorStoneRot: new Float32Array(HUD_SECTOR_COUNT),
  decorations: [],
  running: false,
  decorating: false,
  selectedDecoration: "flower",
  elapsed: 0,
  visualTime: 0,
  score: 0,
  sunX: 0.72,
  sunY: 0.28,
  sunTargetX: 0.72,
  sunTargetY: 0.28,
  bendX: 0.8,
  bendY: -0.6,
  postRunLockedState: false,
  waitingForStartKey: false,
  rawScore: 0,
  finalScore: 0,
  displayScore: 0,
  stoneCount: 0,
  crownBonusTotal: 0,
  crownBonusFinal: 0,
  scoreBeforePenalty: 0,
  stonePenaltyTotal: 0,
  animBaseScore: 0,
  animCrownBonus: 0,
  animStonePenalty: 0,
  scoreAnimActive: false,
  scoreAnimPhase: "idle",
  scoreAnimTimer: 0,
  scoreCardVisible: true,
  scoreCardHideTimer: 0,
  hallRecordedForRun: false,
  lastTimestamp: 0,
  overlayHideTimer: null,
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
const sunPad = document.getElementById("sunPad");
const sunControlTitle = document.getElementById("sunControlTitle");
const decoratePanel = document.getElementById("decoratePanel");
const screenshotBtn = document.getElementById("screenshotBtn");
const shareBtn = document.getElementById("shareBtn");
const hallOfFameListEl = document.getElementById("hallOfFameList");
const clearHallBtn = document.getElementById("clearHallBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const menuToggleBtn = document.getElementById("menuToggleBtn");

function setStartMode(active) {
  document.body.classList.toggle("start-mode", active);
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
      return [...hallOfFameMemoryCache];
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeHallOfFame(parsed);
    hallOfFameMemoryCache = normalized;
    return normalized;
  } catch {
    return [...hallOfFameMemoryCache];
  }
}

function saveHallOfFame(scores) {
  const normalized = normalizeHallOfFame(scores);
  hallOfFameMemoryCache = normalized;
  try {
    localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify(normalized));
  } catch {
    // localStorage can fail on some mobile/private browsing contexts.
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

function getHallOfFameSummary() {
  const scores = loadHallOfFame();
  const top3 = [scores[0] ?? 0, scores[1] ?? 0, scores[2] ?? 0];
  return `Top 3: ${top3[0].toLocaleString()} cm • ${top3[1].toLocaleString()} cm • ${top3[2].toLocaleString()} cm`;
}

function idx(x, y) {
  return y * GRID_COLS + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function cellNoise01(x, y, salt) {
  // Deterministic tiny hash for per-cell visual variation.
  let n = (x * 374761393 + y * 668265263 + salt * 69069) >>> 0;
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n & 0xffff) / 0xffff;
}

function seedField() {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const i = idx(x, y);
      // Use uniform seeding across depth to avoid a hard-looking horizontal seam.
      state.heights[i] = 0.13 + Math.random() * 0.06;
      state.lights[i] = 1;
      state.darkness[i] = 0;
      state.noLightTime[i] = 0;
      state.rechargeLightTime[i] = 0;
      state.dormant[i] = 0;
      state.fullBrightHold[i] = 0;
      state.sunDwellTime[i] = 0;
      state.sunBlessTimer[i] = 0;
    }
  }

  for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
    state.fieldSectorAge[i] = HUD_MAX_AGE_SECONDS;
    state.controlSectorAge[i] = HUD_MAX_AGE_SECONDS;
    state.sectorSunDwell[i] = 0;
    state.sectorCrownEarned[i] = 0;
    state.sectorStoneActive[i] = 0;
    state.sectorStoneDrop[i] = 0;
    state.sectorStoneRot[i] = 0;
  }
}

function updateSectorStones(dt) {
  for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
    const shouldHaveStone = state.fieldSectorAge[i] >= HUD_MAX_AGE_SECONDS;
    if (shouldHaveStone) {
      if (!state.sectorStoneActive[i]) {
        state.sectorStoneActive[i] = 1;
        state.sectorStoneDrop[i] = 0;
        state.sectorStoneRot[i] = (cellNoise01(i, 0, 41) - 0.5) * 0.36;
      }
      state.sectorStoneDrop[i] = Math.min(1, state.sectorStoneDrop[i] + dt * 1.25);
    } else {
      state.sectorStoneActive[i] = 0;
      state.sectorStoneDrop[i] = 0;
      state.sectorStoneRot[i] = 0;
    }
  }
}

function resizeCanvas() {
  ensureCanvasSize();
  draw();
}

function ensureCanvasSize() {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.floor(bounds.width * dpr);
  const nextHeight = Math.floor(bounds.height * dpr);
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return false;
  }
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

function sunVector() {
  const cx = 0.5;
  const cy = 0.5;
  const dx = state.sunX - cx;
  const dy = state.sunY - cy;
  const len = Math.hypot(dx, dy) || 1;
  return {
    dx: dx / len,
    dy: dy / len,
    elevation: clamp(1 - Math.hypot(dx, dy) * 1.5, 0.12, 1),
  };
}

function updateSunMotion(dt, trackAges = true, trackBend = true) {
  const sunAlpha = clamp(dt / SUN_MOVE_SMOOTH_SECONDS, 0, 1);
  state.sunX += (state.sunTargetX - state.sunX) * sunAlpha;
  state.sunY += (state.sunTargetY - state.sunY) * sunAlpha;

  if (trackBend) {
    const sun = sunVector();
    const bendAlpha = clamp(dt / GRASS_BEND_LAG_SECONDS, 0, 1);
    state.bendX += (sun.dx - state.bendX) * bendAlpha;
    state.bendY += (sun.dy - state.bendY) * bendAlpha;
  }

  if (trackAges) {
    for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
      state.fieldSectorAge[i] = Math.min(HUD_MAX_AGE_SECONDS, state.fieldSectorAge[i] + dt);
      state.controlSectorAge[i] = Math.min(HUD_MAX_AGE_SECONDS, state.controlSectorAge[i] + dt);
      state.sectorSunDwell[i] = Math.max(0, state.sectorSunDwell[i] - dt * 0.4);
    }

    const fieldSector = sectorIndexFromUV(state.sunX, state.sunY);
    state.fieldSectorAge[fieldSector] = 0;
    state.sectorSunDwell[fieldSector] = Math.min(1.6, state.sectorSunDwell[fieldSector] + dt);
    if (state.sectorSunDwell[fieldSector] >= 1 && !state.sectorCrownEarned[fieldSector]) {
      state.sectorCrownEarned[fieldSector] = 1;
    }

    const controlSector = sectorIndexFromUV(state.sunTargetX, state.sunTargetY);
    state.controlSectorAge[controlSector] = 0;
  }
}

function sectorIndexFromUV(u, v) {
  const sx = clamp(Math.floor(u * HUD_SECTOR_COLS), 0, HUD_SECTOR_COLS - 1);
  const sy = clamp(Math.floor(v * HUD_SECTOR_ROWS), 0, HUD_SECTOR_ROWS - 1);
  return sy * HUD_SECTOR_COLS + sx;
}

function updateLighting() {
  const sun = sunVector();
  const sunGround = getSunGroundFieldUV();
  const sunGX = sunGround.u * (GRID_COLS - 1);
  const sunGY = sunGround.v * (GRID_ROWS - 1);

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const currentIdx = idx(x, y);
      const currentHeight = state.heights[currentIdx];
      const dx = x - sunGX;
      const dy = y - sunGY;
      const dist = Math.hypot(dx, dy);

      // Light field around the movable sun point.
      const baseLight = clamp(1 - dist / SUN_RADIUS_CELLS, 0, 1);
      let shade = 0;

      // Sample a few cells toward the sun and accumulate blockers.
      for (let i = 1; i <= SHADE_STEPS; i++) {
        const sx = Math.round(x + sun.dx * i);
        const sy = Math.round(y + sun.dy * i);
        if (sx < 0 || sy < 0 || sx >= GRID_COLS || sy >= GRID_ROWS) {
          break;
        }

        const blockerHeight = state.heights[idx(sx, sy)];
        if (blockerHeight > currentHeight + i * SHADE_HEIGHT_STEP) {
          shade += SHADE_PENALTY_PER_BLOCKER;
        }
      }

      shade = clamp(shade, 0, 0.95);
      const effectiveLight = clamp(
        baseLight * (1 - shade) * Math.exp(-shade * SOFT_SHADOW_STRENGTH),
        0,
        1
      );

      if (dist <= SUN_VISIT_RADIUS_CELLS) {
        state.fullBrightHold[currentIdx] = FULL_BRIGHT_HOLD_SECONDS;
      }

      state.lights[currentIdx] = effectiveLight;
      state.shadowed[currentIdx] = shade > 0.02 ? 1 : 0;
    }
  }
}

function getFieldProjection(w, h) {
  const angleRad = (VIEW_ANGLE_DEG * Math.PI) / 180;
  const foreshorten = Math.cos(angleRad);
  const left = w * 0.05;
  const width = w * 0.9;
  const top = h * 0.53;
  const projectedHeight = h - top;
  return {
    left,
    top,
    width,
    height: projectedHeight,
    right: left + width,
    bottom: top + projectedHeight,
    foreshorten,
  };
}

function fieldToScreen(u, v, w, h) {
  const field = getFieldProjection(w, h);
  return {
    x: field.left + u * field.width,
    y: field.top + v * field.height,
  };
}

function fieldToCell(u, v) {
  const x = clamp(Math.floor(u * GRID_COLS), 0, GRID_COLS - 1);
  const y = clamp(Math.floor(v * GRID_ROWS), 0, GRID_ROWS - 1);
  return { x, y, index: idx(x, y) };
}

function getSunGroundFieldUV() {
  return {
    u: clamp(state.sunX, 0, 1),
    v: clamp(state.sunY, 0, 1),
  };
}

function getSunVisualPlacement(w, h) {
  const field = getFieldProjection(w, h);
  const ground = getSunGroundFieldUV();
  const groundX = field.left + ground.u * field.width;
  const groundY = field.top + ground.v * field.height;
  const sunHeightPx = 52 - ground.v * 14;

  return {
    groundX,
    groundY,
    sunX: groundX,
    sunY: groundY - sunHeightPx,
    depth: ground.v,
  };
}

function screenToField(nx, ny, w, h) {
  const field = getFieldProjection(w, h);
  const px = nx * w;
  const py = ny * h;
  const u = (px - field.left) / field.width;
  const v = (py - field.top) / field.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }
  return { u, v };
}

function grow(dt) {
  let points = 0;

  // Sun dwell tracking: which cells the sun is currently over.
  const sunGround = getSunGroundFieldUV();
  const sunGX = sunGround.u * (GRID_COLS - 1);
  const sunGY = sunGround.v * (GRID_ROWS - 1);

  for (let i = 0; i < CELL_COUNT; i++) {
    const cx = i % GRID_COLS;
    const cy = Math.floor(i / GRID_COLS);
    const distToSun = Math.hypot(cx - sunGX, cy - sunGY);

    if (distToSun <= SUN_VISIT_RADIUS_CELLS) {
      state.sunDwellTime[i] = Math.min(state.sunDwellTime[i] + dt, 2);
      if (state.sunDwellTime[i] >= 1 && state.sunBlessTimer[i] <= 0) {
        state.sunBlessTimer[i] = 15;
      }
    } else {
      state.sunDwellTime[i] = Math.max(0, state.sunDwellTime[i] - dt * 0.5);
    }
    if (state.sunBlessTimer[i] > 0) {
      state.sunBlessTimer[i] = Math.max(0, state.sunBlessTimer[i] - dt);
    }

    const height = state.heights[i];
    const effectiveLight = state.lights[i];
    const isBrightHold = state.fullBrightHold[i] > 0;
    const hasLight = effectiveLight >= NO_LIGHT_THRESHOLD;
    let next = height;
    let canGrow = true;

    if (isBrightHold) {
      state.fullBrightHold[i] = Math.max(0, state.fullBrightHold[i] - dt);
    }

    if (isBrightHold) {
      state.darkness[i] = 0;
      state.noLightTime[i] = 0;
      state.rechargeLightTime[i] = 0;
      state.dormant[i] = 0;
    } else if (!hasLight) {
      state.noLightTime[i] += dt;
      state.rechargeLightTime[i] = 0;
      // No sun: grass slowly dies at 1/10 of base growth speed (after 5s grace).
      if (state.noLightTime[i] >= 5) next -= NO_SUN_DECAY_RATE_PER_SEC * dt;
      if (state.noLightTime[i] >= STARVE_SECONDS_FOR_DORMANCY) {
        state.dormant[i] = 1;
      }
      state.darkness[i] = clamp(state.darkness[i] + (MAX_DARKNESS / DARKEN_FULL_SECONDS) * dt, 0, MAX_DARKNESS);
    } else {
      // Light recovery snaps the blade back to fresh light-green.
      state.darkness[i] = 0;
      if (state.dormant[i]) {
        state.rechargeLightTime[i] += dt;
        if (state.rechargeLightTime[i] >= RECHARGE_LIGHT_SECONDS) {
          state.dormant[i] = 0;
          state.noLightTime[i] = 0;
          state.rechargeLightTime[i] = 0;
        }
      } else {
        state.noLightTime[i] = 0;
        state.rechargeLightTime[i] = 0;
      }
    }

    if (state.dormant[i]) {
      canGrow = false;
    }

    const blessedRate = state.sunBlessTimer[i] > 0 ? GROWTH_RATE_PER_SEC * 1.1 : GROWTH_RATE_PER_SEC;
    if (canGrow && effectiveLight > LIGHT_GROWTH_THRESHOLD) {
      next += effectiveLight * blessedRate * dt;
    }

    next = clamp(next, 0, 1);
    state.heights[i] = next;
    points += next * MAX_HEIGHT_CM * REAL_BLADES_PER_SIM_BLADE;
  }

  state.rawScore = Math.floor(points);
  state.crownBonusTotal = 0;
  for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
    if (state.sectorCrownEarned[i]) {
      state.crownBonusTotal += CROWN_BONUS_POINTS;
    }
  }

  state.score = state.rawScore + state.crownBonusTotal;
  state.displayScore = state.score;
}

function getStoneCount() {
  let stoneCount = 0;
  for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
    if (state.fieldSectorAge[i] >= HUD_MAX_AGE_SECONDS) {
      stoneCount++;
    }
  }
  return stoneCount;
}

function getCrownBonusAfterStones() {
  let bonus = 0;
  for (let i = 0; i < HUD_SECTOR_COUNT; i++) {
    const hasStone = state.fieldSectorAge[i] >= HUD_MAX_AGE_SECONDS;
    if (state.sectorCrownEarned[i] && !hasStone) {
      bonus += CROWN_BONUS_POINTS;
    }
  }
  return bonus;
}

function updateEndScoreAnimation(dt) {
  if (!state.scoreAnimActive) {
    return;
  }

  state.scoreAnimTimer += dt;

  // Safety net: never allow score animation to get stuck.
  if (state.scoreAnimTimer > 8) {
    state.animBaseScore = state.rawScore;
    state.animCrownBonus = state.crownBonusTotal;
    state.animStonePenalty = state.stonePenaltyTotal;
    state.displayScore = state.finalScore;
    state.score = state.finalScore;
    state.scoreAnimActive = false;
    state.scoreAnimPhase = "idle";
    showOverlayTopHint(`Final score ${state.finalScore.toLocaleString()} cm`, 1800);
    setOverlay("");
    return;
  }

  if (state.scoreAnimPhase === "count-up") {
    const phaseDuration = 1.2;
    const t = clamp(state.scoreAnimTimer / phaseDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2.2);
    state.animBaseScore = Math.floor(state.rawScore * eased);
    state.animCrownBonus = Math.floor(state.crownBonusTotal * eased);
    state.animStonePenalty = 0;
    state.displayScore = state.animBaseScore + state.animCrownBonus;
    if (t >= 1) {
      if (state.stonePenaltyTotal > 0) {
        state.scoreAnimPhase = "deduct";
        state.scoreAnimTimer = 0;
        showOverlayTopHint(`Applying stone penalty (${state.stoneCount}/18 sectors)`, 1600);
      } else {
        state.animBaseScore = state.rawScore;
        state.animCrownBonus = state.crownBonusTotal;
        state.displayScore = state.finalScore;
        state.score = state.finalScore;
        state.scoreAnimActive = false;
        state.scoreAnimPhase = "idle";
        showOverlayTopHint(`Final score ${state.finalScore.toLocaleString()} cm`, 1800);
        setOverlay("");
      }
    }
    return;
  }

  if (state.scoreAnimPhase === "deduct") {
    const phaseDuration = 1.05;
    const t = clamp(state.scoreAnimTimer / phaseDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2.4);
    state.animBaseScore = state.rawScore;
    state.animCrownBonus = state.crownBonusTotal;
    state.animStonePenalty = Math.floor(state.stonePenaltyTotal * eased);
    state.displayScore = Math.max(0, state.scoreBeforePenalty - state.animStonePenalty);
    if (t >= 1) {
      state.animStonePenalty = state.stonePenaltyTotal;
      state.displayScore = state.finalScore;
      state.score = state.finalScore;
      state.scoreAnimActive = false;
      state.scoreAnimPhase = "idle";
      showOverlayTopHint(`Final score ${state.finalScore.toLocaleString()} cm`, 1800);
      setOverlay("");
    }
  }
}

function drawScoreBreakdownCard(w, h) {
  if (!state.postRunLockedState || state.decorating || !state.scoreCardVisible) {
    return;
  }

  const cardW = Math.min(420, w * 0.76);
  const cardH = Math.min(280, h * 0.5);
  const x = (w - cardW) * 0.5;
  const finalNorm = clamp(state.finalScore / 2500000, 0, 1);
  const dropOffset = finalNorm * Math.min(h * 0.28, 180);
  const y = h * 0.18 + dropOffset;
  const phasePulse = state.scoreAnimActive ? Math.sin(state.visualTime * 9) * 0.02 : 0;

  ctx.save();
  ctx.translate(x + cardW * 0.5, y + cardH * 0.5);
  ctx.scale(1 + phasePulse, 1 + phasePulse);
  ctx.translate(-(x + cardW * 0.5), -(y + cardH * 0.5));

  ctx.fillStyle = "rgba(22, 40, 24, 0.62)";
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 8, cardW, cardH, 24);
  ctx.fill();

  const cardGrad = ctx.createLinearGradient(x, y, x, y + cardH);
  cardGrad.addColorStop(0, "rgba(244, 253, 230, 0.96)");
  cardGrad.addColorStop(1, "rgba(220, 241, 208, 0.94)");
  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = "rgba(84, 120, 54, 0.68)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(48, 74, 35, 0.95)";
  ctx.font = "800 24px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Score Breakdown", x + cardW * 0.5, y + 36);

  const rows = [
    { label: "Growth Score", value: state.animBaseScore, color: "#396e29", prefix: "+" },
    { label: "Crown Bonus", value: state.animCrownBonus, color: "#2f8f3a", prefix: "+" },
    { label: "Stone Penalty", value: state.animStonePenalty, color: "#a94433", prefix: "-" },
  ];

  ctx.textAlign = "left";
  ctx.font = "700 16px Manrope, sans-serif";
  let rowY = y + 76;
  for (const row of rows) {
    ctx.fillStyle = "rgba(56, 78, 43, 0.92)";
    ctx.fillText(row.label, x + 26, rowY);
    ctx.fillStyle = row.color;
    ctx.textAlign = "right";
    ctx.fillText(`${row.prefix}${Math.floor(row.value).toLocaleString()}`, x + cardW - 26, rowY);
    ctx.textAlign = "left";
    rowY += 34;
  }

  const finalY = y + cardH - 44;
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.fillRect(x + 22, finalY - 26, cardW - 44, 34);
  ctx.fillStyle = "rgba(38, 70, 31, 0.96)";
  ctx.font = "800 18px Manrope, sans-serif";
  ctx.fillText("Final Score", x + 30, finalY - 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "#1f5e21";
  ctx.font = "900 22px Manrope, sans-serif";
  ctx.fillText(Math.floor(state.displayScore).toLocaleString(), x + cardW - 30, finalY - 2);
  ctx.textAlign = "left";

  ctx.restore();
}

function drawSkyAndGround(w, h) {
  const field = getFieldProjection(w, h);
  const horizonY = field.top;

  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 20);
  sky.addColorStop(0, "#7fc1f2");
  sky.addColorStop(0.55, "#b7dcf5");
  sky.addColorStop(1, "#edf7ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, field.top + 6);

  // Soft white haze near horizon to create a clear summer-day depth.
  const haze = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY + 20);
  haze.addColorStop(0, "rgba(255, 255, 255, 0)");
  haze.addColorStop(1, "rgba(255, 249, 233, 0.42)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - 60, w, 90);

  function drawCloud(cx, cy, scale, alpha) {
    const base = `rgba(236, 245, 252, ${(alpha * 0.62).toFixed(3)})`;
    const top = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

    // Soft lower body/shadow for volume.
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(cx - 34 * scale, cy + 8 * scale, 34 * scale, 13 * scale, 0.04, 0, Math.PI * 2);
    ctx.ellipse(cx + 2 * scale, cy + 11 * scale, 50 * scale, 15 * scale, -0.03, 0, Math.PI * 2);
    ctx.ellipse(cx + 46 * scale, cy + 7 * scale, 30 * scale, 12 * scale, 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Brighter upper lobes.
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(cx - 28 * scale, cy + 1 * scale, 30 * scale, 14 * scale, 0.05, 0, Math.PI * 2);
    ctx.ellipse(cx + 2 * scale, cy - 8 * scale, 33 * scale, 18 * scale, -0.03, 0, Math.PI * 2);
    ctx.ellipse(cx + 26 * scale, cy - 4 * scale, 27 * scale, 14 * scale, 0.04, 0, Math.PI * 2);
    ctx.ellipse(cx + 50 * scale, cy + 2 * scale, 21 * scale, 11 * scale, -0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCloud(w * 0.2, horizonY * 0.32, 0.72, 0.72);
  drawCloud(w * 0.75, horizonY * 0.24, 0.94, 0.74);
  drawCloud(w * 0.55, horizonY * 0.46, 1.15, 0.66);
  drawCloud(w * 0.88, horizonY * 0.5, 0.78, 0.62);
  drawCloud(w * 0.35, horizonY * 0.58, 1.02, 0.6);

  const ground = ctx.createLinearGradient(0, field.top, 0, h);
  ground.addColorStop(0, "#8cc767");
  ground.addColorStop(1, "#4f944a");
  ctx.fillStyle = ground;
  ctx.fillRect(0, field.top, w, h - field.top);

  ctx.strokeStyle = "rgba(49, 86, 41, 0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(field.left, field.top, field.width, field.height);
}

function drawGrassField(w, h) {
  const field = getFieldProjection(w, h);
  const cellW = field.width / GRID_COLS;
  const cellH = field.height / GRID_ROWS;
  const sun = sunVector();
  const bendX = state.bendX;
  const bendY = state.bendY;
  const bendLen = Math.hypot(bendX, bendY) || 1;
  const bendDirX = bendX / bendLen;
  const bendDirY = bendY / bendLen;
  const breeze = Math.sin(state.visualTime * 1.8);
  const shadowReach = 0.4 + (1 - sun.elevation) * 1.35;
  const drawShadows = !state.decorating;
  const drawSiblingBlades = !state.decorating;
  const useDecorTrim = state.decorating && state.postRunLockedState;
  // Ceiling for decorate mow-trim: relative to each blade's own base so it works for all rows
  const naturalLen = cellH * (15 * field.foreshorten + 8.5) * 1.025;
  const naturalUpright = naturalLen * 0.825; // at sun.elevation ~0.5
  const trimWaveAmp = 22;
  const trimWaveFreq = 0.018;
  const trimWaveSpeed = 0.55;

  for (let y = 0; y < GRID_ROWS; y++) {
    const depth = (y + 0.5) / GRID_ROWS;
    const sy = field.top + depth * field.height;
    for (let x = 0; x < GRID_COLS; x++) {
      const i = idx(x, y);
      const hNorm = state.heights[i];
      const light = state.lights[i];
      const darkness = state.darkness[i];
      const sectorX = clamp(Math.floor((x / GRID_COLS) * HUD_SECTOR_COLS), 0, HUD_SECTOR_COLS - 1);
      const sectorY = clamp(Math.floor((y / GRID_ROWS) * HUD_SECTOR_ROWS), 0, HUD_SECTOR_ROWS - 1);
      const sectorIdx = sectorY * HUD_SECTOR_COLS + sectorX;
      const sectorAge = state.fieldSectorAge[sectorIdx];
      const stoneImpact = state.sectorStoneActive[sectorIdx]
        ? easeOutCubic(state.sectorStoneDrop[sectorIdx])
        : 0;
      const stoneLeanDir = (cellNoise01(sectorX, sectorY, 37) - 0.5) * 2;
      const n1 = cellNoise01(x, y, 1);
      const n2 = cellNoise01(x, y, 2);
      const n3 = cellNoise01(x, y, 3);

      const growthRatio = hNorm;
      const len = growthRatio * cellH * (15 * field.foreshorten + 8.5) * (0.85 + n1 * 0.35) * (1 - stoneImpact * 0.34);
      const sxJitter = (n1 - 0.5) * cellW * 0.85;
      const syJitter = (n2 - 0.5) * cellH * 0.7;
      const sx = field.left + (x + 0.5) * cellW + sxJitter;
      const syLocal = Math.min(sy + syJitter, field.bottom - 1);
      const upright = len * (0.7 + 0.25 * sun.elevation) * (1 - stoneImpact * 0.22);
      const towardSun = len * (0.15 + growthRatio * 0.225 + (1 - light) * 0.1);
      const naturalPhase = Math.sin(x * 0.19 + y * 0.11 + state.visualTime * 2.3 + n3 * 1.6);
      const gust = naturalPhase * len * 0.07 + breeze * len * 0.035;
      const tipX = sx + bendDirX * towardSun + gust + stoneLeanDir * len * stoneImpact * 0.25;
      const rawTipY = syLocal - upright + Math.abs(bendDirY) * towardSun * 0.12 + len * stoneImpact * 0.28;
      // Trim ceiling: base is where a max-height blade tip would naturally be,
      // offset by a slow sine wave → smooth mow-line silhouette
      const trimY = syLocal - naturalUpright * 0.95
        + Math.sin(sx * trimWaveFreq + state.visualTime * trimWaveSpeed) * trimWaveAmp;
      const tipY = useDecorTrim ? Math.max(rawTipY, trimY) : rawTipY;
      const controlX = sx + (tipX - sx) * 0.45 + bendDirX * len * 0.1;
      // When a blade is trimmed, scale its control point to match the shorter height
      const controlY = useDecorTrim && tipY > rawTipY
        ? syLocal - (syLocal - tipY) * 0.52
        : syLocal - upright * 0.52 + len * stoneImpact * 0.12;

      if (drawShadows && ((x + y) % 3) === 0) {
        const shadowLen = len * shadowReach;
        const shadowX = clamp(sx + sun.dx * shadowLen, field.left, field.right);
        const shadowY = clamp(syLocal + sun.dy * shadowLen * field.foreshorten, field.top, field.bottom);
        const shadowAlpha = clamp(0.06 + (1 - light) * 0.18 + growthRatio * 0.08, 0.04, 0.26);
        ctx.strokeStyle = `rgba(35, 56, 29, ${shadowAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.8 + growthRatio * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, syLocal + 0.9);
        ctx.quadraticCurveTo((sx + shadowX) * 0.5, syLocal + 1.4, shadowX, shadowY + 1.5);
        ctx.stroke();
      }

      // Grass hue follows Field Visit Age; only orange/red-age sectors are darkened.
      const visitAgeShade = sectorAge >= 5 ? clamp((sectorAge - 5) / 5, 0, 1) : 0;
      const visitMul = 1 - visitAgeShade * 0.28;
      const darkMul = (1 - darkness * 0.55) * visitMul;
      const isBlessed = state.sunBlessTimer[i] > 0;
      const blessStrength = isBlessed ? clamp(state.sunBlessTimer[i] / 2, 0, 1) : 0;
      const g = Math.floor((90 + light * 96 + naturalPhase * 6) * darkMul * (1 + blessStrength * 0.45));
      const r = Math.floor((30 + light * 28 + naturalPhase * 3) * (1 - darkness * 0.42) * visitMul * (1 - blessStrength * 0.5));
      const b = Math.floor((24 + light * 18) * (1 - darkness * 0.48) * visitMul * (1 + blessStrength * 0.2));

      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 0.95 + growthRatio * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx, syLocal + 1);
      ctx.quadraticCurveTo(controlX, controlY, tipX, tipY);
      ctx.stroke();

      state.poseBaseX[i] = sx;
      state.poseBaseY[i] = syLocal + 1;
      state.poseCtrlX[i] = controlX;
      state.poseCtrlY[i] = controlY;
      state.poseTipX[i] = tipX;
      state.poseTipY[i] = tipY;

      // Sparse sibling blades create a denser, less "comb-like" tuft look with minimal overhead.
      if (drawSiblingBlades && n2 > 0.66) {
        const siblingLen = len * (0.68 + n3 * 0.16);
        const siblingBaseX = sx + (n3 - 0.5) * cellW * 0.55;
        const siblingBaseY = syLocal + (n1 - 0.5) * cellH * 0.35;
        const siblingTipX = siblingBaseX + bendDirX * towardSun * 0.58 + gust * 0.72;
        const siblingTipY = siblingBaseY - siblingLen;
        const siblingCtrlX = siblingBaseX + (siblingTipX - siblingBaseX) * 0.43;
        const siblingCtrlY = siblingBaseY - siblingLen * 0.56;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.92)`;
        ctx.lineWidth = 0.7 + growthRatio * 0.4;
        ctx.beginPath();
        ctx.moveTo(siblingBaseX, siblingBaseY + 0.8);
        ctx.quadraticCurveTo(siblingCtrlX, siblingCtrlY, siblingTipX, siblingTipY);
        ctx.stroke();
      }
    }
  }

}

function ageToHudStroke(ageSec) {
  const step = Math.round(clamp(ageSec, 0, HUD_MAX_AGE_SECONDS));
  const t = step / HUD_MAX_AGE_SECONDS;
  const r = Math.floor(72 + t * 150);
  const g = Math.floor(232 - t * 170);
  const b = Math.floor(86 - t * 32);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawMiniHud(w) {
  const panelW = 176;
  const panelH = 72;
  const margin = 12;
  const x0 = w - panelW - margin;
  const y0 = margin;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 4;

  ctx.fillStyle = "#7ddd50";
  ctx.font = "11px Manrope, sans-serif";
  ctx.fillText("Field Visit Age", x0 + 10, y0 + 16);

  const drawGrid = (baseX, baseY, ages) => {
    const cw = 24;
    const ch = 12;
    for (let sy = 0; sy < HUD_SECTOR_ROWS; sy++) {
      for (let sx = 0; sx < HUD_SECTOR_COLS; sx++) {
        const i = sy * HUD_SECTOR_COLS + sx;
        const px = baseX + sx * (cw + 2);
        const py = baseY + sy * (ch + 2);
        const age = ages[i];
        const freshness = 1 - clamp(age / HUD_MAX_AGE_SECONDS, 0, 1);
        ctx.fillStyle = `rgba(124, 210, 108, ${(0.12 + freshness * 0.26).toFixed(3)})`;
        ctx.fillRect(px, py, cw, ch);
        ctx.strokeStyle = ageToHudStroke(age);
        ctx.lineWidth = 1.4;
        ctx.strokeRect(px, py, cw, ch);

        if (state.sectorCrownEarned[i]) {
          const cx = px + cw - 7;
          const cy = py + 3;
          ctx.fillStyle = "rgba(255, 219, 91, 0.95)";
          ctx.beginPath();
          ctx.moveTo(cx - 4, cy + 5);
          ctx.lineTo(cx - 4, cy + 1.5);
          ctx.lineTo(cx - 2.4, cy - 1.8);
          ctx.lineTo(cx - 0.7, cy + 1.2);
          ctx.lineTo(cx + 0.7, cy - 2.2);
          ctx.lineTo(cx + 2.4, cy + 1.2);
          ctx.lineTo(cx + 4, cy - 1.8);
          ctx.lineTo(cx + 4, cy + 5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(109, 75, 7, 0.75)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  };

  drawGrid(x0 + 10, y0 + 22, state.fieldSectorAge);
  ctx.restore();
}

function drawGrassHeightHud() {
  const panelX = 12;
  const panelY = 12;
  const panelW = 176;
  const panelH = 72;
  const plotX = panelX + 10;
  const plotY = panelY + 24;
  const plotW = panelW - 20;
  const plotH = panelH - 34;
  const rows = 3;
  const cols = HUD_SECTOR_COLS;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 4;

  ctx.fillStyle = "#7ddd50";
  ctx.font = "11px Manrope, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Grass Height", panelX + 10, panelY + 16);

  const monthVal = ((state.elapsed / GAME_DURATION_SECONDS) * SIM_MONTHS_TOTAL).toFixed(1);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(125, 221, 80, 0.85)";
  ctx.fillText(`Mo ${monthVal}`, panelX + panelW - 10, panelY + 16);
  ctx.textAlign = "left";

  for (let r = 0; r < rows; r++) {
    const bandY = plotY + (plotH / rows) * r;
    const bandH = plotH / rows;
    const yStart = Math.floor((r * GRID_ROWS) / rows);
    const yEnd = Math.floor(((r + 1) * GRID_ROWS) / rows);
    const points = [];

    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 4;

    for (let c = 0; c < cols; c++) {
      const xStart = Math.floor((c * GRID_COLS) / cols);
      const xEnd = Math.floor(((c + 1) * GRID_COLS) / cols);
      let sum = 0;
      let count = 0;

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          sum += state.heights[idx(x, y)];
          count++;
        }
      }

      const avg = count > 0 ? sum / count : 0;
      const px = plotX + (c / (cols - 1)) * plotW;
      const py = bandY + bandH - 3 - avg * (bandH - 8);
      points.push({ x: px, y: py });
    }

    ctx.strokeStyle = "rgba(100, 230, 60, 0.95)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    for (const p of points) {
      ctx.fillStyle = "rgba(120, 240, 70, 0.97)";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawDecorations(w, h) {
  function ensureDecorationAnchor(deco) {
    if (Number.isInteger(deco.cellIndex)) {
      return;
    }

    const u = typeof deco.u === "number" ? deco.u : 0.5;
    const v = typeof deco.v === "number" ? deco.v : 0.5;
    const cell = fieldToCell(u, v);
    deco.cellIndex = cell.index;
    deco.stemT = deco.type === "flower" ? 0.82 : deco.type === "daisy" ? 0.62 : 0.9;
    deco.side = cellNoise01(cell.x, cell.y, 7) > 0.5 ? 1 : -1;
  }

  for (const deco of state.decorations) {
    ensureDecorationAnchor(deco);

    const i = deco.cellIndex;
    if (i < 0 || i >= CELL_COUNT) {
      continue;
    }

    const bx = state.poseBaseX[i];
    const by = state.poseBaseY[i];
    const cx = state.poseCtrlX[i];
    const cy = state.poseCtrlY[i];
    const tx = state.poseTipX[i];
    const ty = state.poseTipY[i];
    const stemT = clamp(deco.stemT ?? 0.82, 0.35, 0.98);
    const omt = 1 - stemT;

    const x = omt * omt * bx + 2 * omt * stemT * cx + stemT * stemT * tx;
    const y = omt * omt * by + 2 * omt * stemT * cy + stemT * stemT * ty;

    const dx = 2 * omt * (cx - bx) + 2 * stemT * (tx - cx);
    const dy = 2 * omt * (cy - by) + 2 * stemT * (ty - cy);
    const tangentLen = Math.hypot(dx, dy) || 1;
    const nx = (-dy / tangentLen) * (deco.side || 1);
    const ny = dx / tangentLen;

    const attachX = x + nx * 1.6;
    const attachY = y + ny * 1.6;

    if (deco.type === "flower") {
      ctx.fillStyle = "#f7f0cf";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.arc(attachX + Math.cos(a) * 4.2, attachY + Math.sin(a) * 4.2, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ff932e";
      ctx.beginPath();
      ctx.arc(attachX, attachY, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (deco.type === "butterfly") {
      ctx.fillStyle = "#de8b3f";
      ctx.beginPath();
      ctx.ellipse(attachX - 3.8, attachY, 4.6, 3, 0.5, 0, Math.PI * 2);
      ctx.ellipse(attachX + 3.8, attachY, 4.6, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#563724";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(attachX, attachY - 4);
      ctx.lineTo(attachX, attachY + 4);
      ctx.stroke();
    } else if (deco.type === "daisy") {
      ctx.fillStyle = "#f7a8c4";
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.arc(attachX + Math.cos(a) * 3.8, attachY + Math.sin(a) * 3.8, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe033";
      ctx.beginPath();
      ctx.arc(attachX, attachY, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSunIndicator(w, h) {
  // In decorate mode or score phase, keep sun logic active but hide visual indicator and target ring.
  if (state.decorating || state.postRunLockedState) {
    return;
  }

  const placement = getSunVisualPlacement(w, h);
  const x = placement.sunX;
  const y = placement.sunY;
  const sunRadius = 9 + placement.depth * 14;
  const glowRadius = sunRadius * 2.8;

  // Target point on the lawn where sunlight hits.
  ctx.strokeStyle = "rgba(42, 54, 37, 0.8)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(placement.groundX, placement.groundY, 8, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createRadialGradient(x, y, sunRadius * 0.25, x, y, glowRadius);
  grad.addColorStop(0, "rgba(255, 243, 177, 0.95)");
  grad.addColorStop(0.45, "rgba(245, 201, 110, 0.88)");
  grad.addColorStop(1, "rgba(245, 201, 110, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f0c765";
  ctx.beginPath();
  ctx.arc(x, y, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 249, 221, 0.72)";
  ctx.beginPath();
  ctx.arc(x - sunRadius * 0.22, y - sunRadius * 0.24, sunRadius * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function drawFieldStones(w, h) {
  const field = getFieldProjection(w, h);
  ctx.save();
  for (let sy = 0; sy < HUD_SECTOR_ROWS; sy++) {
    for (let sx = 0; sx < HUD_SECTOR_COLS; sx++) {
      const i = sy * HUD_SECTOR_COLS + sx;
      if (!state.sectorStoneActive[i]) continue;

      // Deterministic jitter within sector so stone doesn't sit dead center.
      const jx = (cellNoise01(sx, sy, 11) - 0.5) * 0.55;
      const jy = (cellNoise01(sx, sy, 13) - 0.5) * 0.4;
      const u = (sx + 0.5 + jx) / HUD_SECTOR_COLS;
      const v = (sy + 0.78 + jy) / HUD_SECTOR_ROWS;
      const px = field.left + u * field.width;
      const targetY = field.top + v * field.height;
      const depth = v;
      const rw = 5 + depth * 9;   // wider at front
      const rh = rw * 0.62;
      const dropT = easeOutCubic(state.sectorStoneDrop[i]);
      const fallFrom = field.height * (0.82 + (1 - v) * 0.55);
      const bounce = state.sectorStoneDrop[i] > 0.74
        ? Math.sin((state.sectorStoneDrop[i] - 0.74) * Math.PI * 8) * (1 - state.sectorStoneDrop[i]) * 20
        : 0;
      const py = targetY - (1 - dropT) * fallFrom + bounce;
      const rot = state.sectorStoneRot[i];

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);

      // Shadow under stone
      ctx.fillStyle = `rgba(40, 50, 30, ${(0.09 + dropT * 0.21).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(rw * 0.2, rh * 0.68, rw * 0.98, rh * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Irregular rock silhouette inspired by natural flat field stones.
      const grad = ctx.createLinearGradient(-rw, -rh, rw, rh);
      grad.addColorStop(0, "rgba(164, 163, 156, 0.96)");
      grad.addColorStop(0.45, "rgba(128, 127, 121, 0.97)");
      grad.addColorStop(1, "rgba(82, 82, 78, 0.98)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-rw * 0.96, -rh * 0.08);
      ctx.quadraticCurveTo(-rw * 0.82, -rh * 0.66, -rw * 0.24, -rh * 0.78);
      ctx.quadraticCurveTo(rw * 0.42, -rh * 0.9, rw * 0.9, -rh * 0.26);
      ctx.quadraticCurveTo(rw * 1.04, rh * 0.18, rw * 0.52, rh * 0.62);
      ctx.quadraticCurveTo(-rw * 0.22, rh * 0.86, -rw * 0.88, rh * 0.4);
      ctx.closePath();
      ctx.fill();

      // Rim/sharp edge
      ctx.strokeStyle = "rgba(57, 55, 52, 0.7)";
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Soft mineral highlight.
      ctx.fillStyle = "rgba(220, 218, 208, 0.32)";
      ctx.beginPath();
      ctx.ellipse(-rw * 0.22, -rh * 0.16, rw * 0.36, rh * 0.2, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Dry grass strands on top (from reference-photo look).
      ctx.strokeStyle = "rgba(122, 108, 86, 0.62)";
      ctx.lineWidth = 0.8;
      for (let s = 0; s < 5; s++) {
        const sn = cellNoise01(sx * 17 + s, sy * 19 + s, 61);
        const x0 = -rw * 0.75 + sn * rw * 1.5;
        const y0 = -rh * (0.42 + sn * 0.28);
        const x1 = x0 + rw * (0.45 + sn * 0.3);
        const y1 = y0 + rh * (0.3 + sn * 0.35);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Tiny speckles to avoid a plastic look.
      for (let s = 0; s < 5; s++) {
        const sn = cellNoise01(sx * 7 + s, sy * 9 + s, 23);
        const sxp = (sn - 0.5) * rw * 1.45;
        const syp = (cellNoise01(sx * 11 + s, sy * 13 + s, 29) - 0.5) * rh * 1.3;
        ctx.fillStyle = `rgba(70, 67, 60, ${(0.12 + sn * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sxp, syp, 0.45 + sn * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
  ctx.restore();
}

function drawTimeScore(w) {
  const timeLeft = Math.max(0, GAME_DURATION_SECONDS - state.elapsed);
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = Math.floor(timeLeft % 60).toString().padStart(2, "0");
  const timeStr = `${mins}:${secs}`;
  const scoreStr = Math.floor(state.displayScore).toLocaleString();

  const panelW = 260;
  const panelH = 68;
  const panelX = (w - panelW) / 2;
  const panelY = 10;
  const midX = panelX + panelW / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 8;
  ctx.textAlign = "center";

  // TIME
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "bold 11px Manrope, sans-serif";
  ctx.fillText("TIME", panelX + panelW / 4, panelY + 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Manrope, sans-serif";
  ctx.fillText(timeStr, panelX + panelW / 4, panelY + 54);

  // SCORE
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "bold 11px Manrope, sans-serif";
  ctx.fillText("SCORE", panelX + (panelW * 3) / 4, panelY + 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Manrope, sans-serif";
  ctx.fillText(scoreStr, panelX + (panelW * 3) / 4, panelY + 54);

  ctx.textAlign = "left";
  ctx.restore();
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  // Clear in backing-store pixels to avoid compositing artifacts/stale frame strips.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  drawSkyAndGround(w, h);
  drawFieldStones(w, h);
  drawGrassField(w, h);
  drawScoreBreakdownCard(w, h);
  drawDecorations(w, h);
  drawSunIndicator(w, h);
  drawGrassHeightHud();
  drawMiniHud(w);
  drawTimeScore(w);
}

function setOverlay(text) {
  if (state.overlayHideTimer) {
    clearTimeout(state.overlayHideTimer);
    state.overlayHideTimer = null;
  }

  if (!text) {
    overlayMessage.hidden = true;
    overlayMessage.textContent = "";
    overlayMessage.classList.remove("top-hint");
    overlayMessage.classList.add("is-hidden");
    return;
  }

  overlayMessage.classList.remove("top-hint");
  overlayMessage.classList.remove("is-hidden");
  overlayMessage.hidden = false;
  overlayMessage.textContent = text;
}

function showOverlayTopHint(text, durationMs = 2000) {
  if (state.overlayHideTimer) {
    clearTimeout(state.overlayHideTimer);
  }
  overlayMessage.hidden = false;
  overlayMessage.classList.remove("is-hidden");
  overlayMessage.textContent = text;
  overlayMessage.classList.add("top-hint");
  state.overlayHideTimer = setTimeout(() => {
    overlayMessage.classList.remove("top-hint");
    overlayMessage.classList.add("is-hidden");
    overlayMessage.hidden = true;
    overlayMessage.textContent = "";
    state.overlayHideTimer = null;
  }, durationMs);
}

function updateHud() {
  const timeLeft = Math.max(0, GAME_DURATION_SECONDS - state.elapsed);
  const mins = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(timeLeft % 60)
    .toString()
    .padStart(2, "0");

  timeLeftEl.textContent = `${mins}:${secs}`;
  scoreEl.textContent = Math.floor(state.displayScore).toLocaleString();
  monthEl.textContent = ((state.elapsed / GAME_DURATION_SECONDS) * SIM_MONTHS_TOTAL).toFixed(1);
}

function updateSunControlTitle() {
  if (!sunControlTitle) {
    return;
  }
  sunControlTitle.textContent = "Sun Direction";
}

function stopRun() {
  state.running = false;
  state.postRunLockedState = true;
  state.stoneCount = getStoneCount();
  state.crownBonusFinal = getCrownBonusAfterStones();
  state.finalScore = Math.max(
    0,
    Math.floor(state.rawScore * (1 - state.stoneCount / HUD_SECTOR_COUNT)) + state.crownBonusFinal
  );
  state.scoreBeforePenalty = state.rawScore + state.crownBonusTotal;
  state.stonePenaltyTotal = Math.max(0, state.scoreBeforePenalty - state.finalScore);
  state.score = state.finalScore;
  state.displayScore = 0;
  state.animBaseScore = 0;
  state.animCrownBonus = 0;
  state.animStonePenalty = 0;
  state.scoreAnimActive = true;
  state.scoreAnimPhase = "count-up";
  state.scoreAnimTimer = 0;
  state.scoreCardVisible = true;
  state.scoreCardHideTimer = 0;
  decorateBtn.disabled = false;
  if (!state.hallRecordedForRun) {
    recordHallOfFame(state.finalScore);
    state.hallRecordedForRun = true;
  }
  setOverlay("");
  showOverlayTopHint("Scoring in progress...", 1200);
}

function showStartPage() {
  state.running = false;
  state.postRunLockedState = false;
  state.decorating = false;
  state.waitingForStartKey = true;
  state.elapsed = 0;
  state.score = 0;
  state.rawScore = 0;
  state.finalScore = 0;
  state.displayScore = 0;
  state.stoneCount = 0;
  state.crownBonusTotal = 0;
  state.crownBonusFinal = 0;
  state.scoreBeforePenalty = 0;
  state.stonePenaltyTotal = 0;
  state.animBaseScore = 0;
  state.animCrownBonus = 0;
  state.animStonePenalty = 0;
  state.scoreAnimActive = false;
  state.scoreAnimPhase = "idle";
  state.scoreAnimTimer = 0;
  state.scoreCardVisible = true;
  state.scoreCardHideTimer = 0;
  state.hallRecordedForRun = false;
  state.decorations = [];
  state.lastTimestamp = 0;

  // Randomize sun start on start page too, so each run preview is a little different.
  state.sunTargetX = 0.1 + Math.random() * 0.8;
  state.sunTargetY = 0.1 + Math.random() * 0.8;
  state.sunX = state.sunTargetX;
  state.sunY = state.sunTargetY;
  sunPad.style.setProperty("--sun-x", `${(state.sunTargetX * 100).toFixed(1)}%`);
  sunPad.style.setProperty("--sun-y", `${(state.sunTargetY * 100).toFixed(1)}%`);

  decorateBtn.disabled = true;
  decoratePanel.hidden = true;
  if (hallPanel) hallPanel.hidden = true;
  updateSunControlTitle();
  seedField();
  updateLighting();
  setStartMode(true);
  overlayMessage.classList.add("start-screen");
  updateHud();
  renderHallOfFame();
  setOverlay(`GRASS BATTLE\nv0.1 beta\nPress any key to start game.\n${getHallOfFameSummary()}`);
  draw();
}

function tick(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
  state.lastTimestamp = timestamp;
  state.visualTime += dt;
  ensureCanvasSize();

  // Post-run lock freezes simulation metrics, but sun movement may still bend grass visually.
  updateSunMotion(dt, !state.postRunLockedState, true);
  updateSectorStones(dt);

  if (state.decorating && !state.postRunLockedState) {
    updateLighting();
  }

  if (state.running) {
    state.elapsed = clamp(state.elapsed + dt, 0, GAME_DURATION_SECONDS);
    updateLighting();
    grow(dt);
    if (state.elapsed >= GAME_DURATION_SECONDS) {
      stopRun();
    }
  } else if (state.postRunLockedState) {
    updateEndScoreAnimation(dt);
    if (state.scoreCardVisible) {
      state.scoreCardHideTimer += dt;
      if (state.scoreCardHideTimer >= 8) {
        state.scoreCardVisible = false;
      }
    }
  }

  updateHud();
  draw();
  requestAnimationFrame(tick);
}

function startRun() {
  state.waitingForStartKey = false;
  setStartMode(false);
  overlayMessage.classList.remove("start-screen");
  // Randomize sun start for each run.
  state.sunTargetX = 0.1 + Math.random() * 0.8;
  state.sunTargetY = 0.1 + Math.random() * 0.8;
  state.sunX = state.sunTargetX;
  state.sunY = state.sunTargetY;
  sunPad.style.setProperty("--sun-x", `${(state.sunTargetX * 100).toFixed(1)}%`);
  sunPad.style.setProperty("--sun-y", `${(state.sunTargetY * 100).toFixed(1)}%`);

  state.running = true;
  state.postRunLockedState = false;
  state.decorating = false;
  state.elapsed = 0;
  state.score = 0;
  state.rawScore = 0;
  state.finalScore = 0;
  state.displayScore = 0;
  state.stoneCount = 0;
  state.crownBonusTotal = 0;
  state.crownBonusFinal = 0;
  state.scoreBeforePenalty = 0;
  state.stonePenaltyTotal = 0;
  state.animBaseScore = 0;
  state.animCrownBonus = 0;
  state.animStonePenalty = 0;
  state.scoreAnimActive = false;
  state.scoreAnimPhase = "idle";
  state.scoreAnimTimer = 0;
  state.scoreCardVisible = true;
  state.scoreCardHideTimer = 0;
  state.hallRecordedForRun = false;
  state.decorations = [];
  decorateBtn.disabled = true;
  decoratePanel.hidden = true;
  if (hallPanel) hallPanel.hidden = true;
  updateSunControlTitle();
  setOverlay("");
}

function reset() {
  state.running = false;
  state.postRunLockedState = false;
  state.decorating = false;
  state.elapsed = 0;
  state.visualTime = 0;
  state.score = 0;
  state.rawScore = 0;
  state.finalScore = 0;
  state.displayScore = 0;
  state.stoneCount = 0;
  state.crownBonusTotal = 0;
  state.crownBonusFinal = 0;
  state.scoreBeforePenalty = 0;
  state.stonePenaltyTotal = 0;
  state.animBaseScore = 0;
  state.animCrownBonus = 0;
  state.animStonePenalty = 0;
  state.scoreAnimActive = false;
  state.scoreAnimPhase = "idle";
  state.scoreAnimTimer = 0;
  state.scoreCardVisible = true;
  state.scoreCardHideTimer = 0;
  state.hallRecordedForRun = false;
  state.decorations = [];
  state.lastTimestamp = 0;
  // Randomize sun start on reset as well.
  state.sunTargetX = 0.1 + Math.random() * 0.8;
  state.sunTargetY = 0.1 + Math.random() * 0.8;
  state.sunX = state.sunTargetX;
  state.sunY = state.sunTargetY;
  sunPad.style.setProperty("--sun-x", `${(state.sunTargetX * 100).toFixed(1)}%`);
  sunPad.style.setProperty("--sun-y", `${(state.sunTargetY * 100).toFixed(1)}%`);

  decorateBtn.disabled = true;
  decoratePanel.hidden = true;
  if (hallPanel) hallPanel.hidden = true;
  updateSunControlTitle();
  seedField();
  updateLighting();
  setStartMode(true);
  overlayMessage.classList.add("start-screen");
  updateHud();
  renderHallOfFame();
  setOverlay(`GRASS BATTLE\nv0.1 beta\nPress any key to start game.\n${getHallOfFameSummary()}`);
  state.waitingForStartKey = true;
  draw();
}

function getNormalizedPointer(e, element) {
  const rect = element.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

function applySunFromEvent(e) {
  const p = getNormalizedPointer(e, sunPad);
  state.sunTargetX = p.x;
  state.sunTargetY = p.y;
  sunPad.style.setProperty("--sun-x", `${(p.x * 100).toFixed(1)}%`);
  sunPad.style.setProperty("--sun-y", `${(p.y * 100).toFixed(1)}%`);
}

function placeDecoration(e) {
  if (!state.decorating) {
    return;
  }
  if (typeof e.preventDefault === "function") {
    e.preventDefault();
  }
  const p = getNormalizedPointer(e, canvas);
  const fieldPoint = screenToField(p.x, p.y, canvas.clientWidth, canvas.clientHeight);
  if (!fieldPoint) {
    return;
  }
  addDecoration(fieldPoint.u, fieldPoint.v, state.selectedDecoration);
}

function addDecoration(u, v, type) {
  const cell = fieldToCell(u, v);
  state.decorations.push({
    cellIndex: cell.index,
    stemT: type === "flower" ? 0.82 : type === "daisy" ? 0.62 : 0.9,
    side: cellNoise01(cell.x, cell.y, 7) > 0.5 ? 1 : -1,
    type,
  });
}

const DECORATION_CYCLE = ["flower", "daisy", "butterfly"];

function decorationIcon(type) {
  if (type === "flower") return "🌼";
  if (type === "daisy") return "🌸";
  return "🦋";
}

function updateDecorateButtonLabel() {
  decorateBtn.textContent = `Decorate ${decorationIcon(state.selectedDecoration)} ▸`;
}

function setDecorationType(type) {
  state.selectedDecoration = type;
  document.querySelectorAll(".swatch").forEach((el) => {
    const active = el.dataset.type === type;
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateDecorateButtonLabel();
}

function cycleDecorationType() {
  const currentIndex = DECORATION_CYCLE.indexOf(state.selectedDecoration);
  const nextIndex = (currentIndex + 1) % DECORATION_CYCLE.length;
  setDecorationType(DECORATION_CYCLE[nextIndex]);
}

function selectDecorationButton(button) {
  setDecorationType(button.dataset.type);
}

async function saveScreenshot() {
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `grassbattle-${Date.now()}.png`;
  link.click();
}

async function shareScreenshot() {
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "grassbattle.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "My Grass Battle",
        text: `I grew ${state.score.toLocaleString()} cm of grass in Grass Battle!`,
      });
      return;
    } catch {
      // User likely canceled share sheet.
    }
  }

  await saveScreenshot();
}

function bindControls() {
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function updateFullscreenBtn() {
    if (fullscreenBtn) {
      fullscreenBtn.textContent = isFullscreen() ? "\u2715" : "\u26f6";
      fullscreenBtn.title = isFullscreen() ? "Exit full screen" : "Full screen";
    }
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
      } else {
        const el = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
      }
    });
  }

  const onFullscreenChange = () => {
    const fs = isFullscreen();
    document.body.classList.toggle("fullscreen-mode", fs);
    updateFullscreenBtn();
    resizeCanvas();
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  const tryStartFromStartPage = () => {
    if (!state.waitingForStartKey) {
      return;
    }
    startRun();
  };

  resetBtn.addEventListener("click", reset);

  if (scoreBtn) {
    scoreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.scoreCardVisible = !state.scoreCardVisible;
    });
  }

  if (hallBtn) {
    hallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (hallPanel) hallPanel.hidden = !hallPanel.hidden;
    });
  }

  if (clearHallBtn) {
    clearHallBtn.addEventListener("click", () => {
      saveHallOfFame([]);
      renderHallOfFame([]);
      showOverlayTopHint("Hall of Fame cleared", 1200);
    });
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const controls = menuToggleBtn.closest(".controls");
      controls.classList.toggle("collapsed");
      menuToggleBtn.textContent = controls.classList.contains("collapsed") ? "▴" : "▾";
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.repeat) {
      return;
    }
    tryStartFromStartPage();
  });

  document.addEventListener("pointerdown", (e) => {
    if (typeof e.button === "number" && e.button !== 0) {
      return;
    }
    tryStartFromStartPage();
  });

  document.addEventListener("touchstart", () => {
    tryStartFromStartPage();
  }, { passive: true });

  decorateBtn.addEventListener("click", () => {
    state.decorating = true;
    decoratePanel.hidden = false;
    cycleDecorationType();
    state.sunTargetX = 0.5;
    state.sunTargetY = 0.5;
    state.sunX = 0.5;
    state.sunY = 0.5;
    state.bendX = 0;
    state.bendY = 0;
    sunPad.style.setProperty("--sun-x", "50.0%");
    sunPad.style.setProperty("--sun-y", "50.0%");
    updateSunControlTitle();
    // Keep decorate view clean for screenshots: no stage overlay text/border.
    setOverlay("");
  });

  const onPadMove = (e) => {
    e.preventDefault();
    applySunFromEvent(e);
  };
  sunPad.addEventListener("pointerdown", onPadMove);
  sunPad.addEventListener("pointermove", (e) => {
    if (e.buttons > 0 || e.pressure > 0) {
      onPadMove(e);
    }
  });
  sunPad.addEventListener("touchstart", onPadMove, { passive: false });
  sunPad.addEventListener("touchmove", onPadMove, { passive: false });

  canvas.addEventListener("pointerdown", placeDecoration);
  canvas.addEventListener("click", (e) => {
    placeDecoration(e);
    // Hide all bottom panels when tapping the game field
    if (!state.decorating) {
      if (hallPanel) hallPanel.hidden = true;
      decoratePanel.hidden = true;
    }
  });
  canvas.addEventListener("touchstart", placeDecoration, { passive: false });

  document.querySelectorAll(".swatch").forEach((button) => {
    button.addEventListener("click", () => selectDecorationButton(button));
  });

  const flowerSwatch = document.querySelector('.swatch[data-type="flower"]');
  if (flowerSwatch) {
    flowerSwatch.addEventListener("dblclick", () => {
      const sunGround = getSunGroundFieldUV();
      addDecoration(sunGround.u, clamp(sunGround.v + 0.05, 0.02, 0.98), "flower");
      selectDecorationButton(flowerSwatch);
    });
  }

  screenshotBtn.addEventListener("click", saveScreenshot);
  shareBtn.addEventListener("click", shareScreenshot);
}

function init() {
  renderHallOfFame();
  bindControls();
  setDecorationType("flower");
  updateSunControlTitle();
  seedField();
  updateLighting();
  resizeCanvas();
  showStartPage();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

init();
