const GAME_TURNS = 5;
const TURN_DURATION = 5;
const MAX_BLADE_LENGTH = 18;
const INITIAL_SUN_ANGLE_DEG = 45;
const SUN_DEGREES_PER_TURN = 20;
const HALL_OF_FAME_KEY = "grassblade.hallOfFame.v1";

const BLADE_SEGMENTS = 22;
const CELL_ROWS = 18;
const CELL_COLUMNS = 5;
const ACTIVE_CELL_GROWTH_RADIUS = 0.22;
const BASE_SEGMENT_CURVE = 0.012;
const TWIST_VISUAL_STRENGTH = 1.25;
const MAX_BLADE_TWIST = 6.28 * 2;

const state = {
  running: false,
  turn: 0,
  turnTime: 0,
  bladeLength: 5.2,
  bladeAngle: 0,
  bladeAngularVelocity: 0,
  bladeTwist: 0,
  bladeTwistVelocity: 0,
  cells: [],
  selectedCellIndex: 0,
  activeCellIndex: 0,
  score: 0,
  finalScore: 0,
  hallRecorded: false,
  lastTimestamp: 0,
  sunAngleDeg: INITIAL_SUN_ANGLE_DEG,
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smootherstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function normalizeHallOfFame(scores) {
  if (!Array.isArray(scores)) return [];
  return scores
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.floor(n))
    .sort((a, b) => b - a)
    .slice(0, 3);
}

function loadHallOfFame() {
  try {
    const raw = localStorage.getItem(HALL_OF_FAME_KEY);
    return raw ? normalizeHallOfFame(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveHallOfFame(scores) {
  const normalized = normalizeHallOfFame(scores);
  try {
    localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify(normalized));
  } catch {}
  return normalized;
}

function renderHallOfFame(scores = loadHallOfFame()) {
  if (!hallOfFameListEl) return;
  hallOfFameListEl.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const li = document.createElement("li");
    li.textContent = `${(scores[i] ?? 0).toLocaleString()} cm`;
    hallOfFameListEl.appendChild(li);
  }
}

function recordHallOfFame(score) {
  if (!Number.isFinite(score) || score < 0) return;
  const next = saveHallOfFame([...loadHallOfFame(), Math.floor(score)]);
  renderHallOfFame(next);
}

function ensureCanvasSize() {
  const bounds = canvas.getBoundingClientRect();
  const nextWidth = Math.floor(bounds.width * dpr);
  const nextHeight = Math.floor(bounds.height * dpr);

  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setOverlay(message, modifier = "") {
  if (!message) {
    overlayMessage.hidden = true;
    overlayMessage.className = "overlay-message";
    overlayMessage.innerHTML = "";
    return;
  }

  overlayMessage.hidden = false;
  overlayMessage.className = `overlay-message ${modifier}`.trim();

  if (modifier === "start-screen" && typeof message === "object") {
    overlayMessage.innerHTML = message.html;
  } else {
    overlayMessage.textContent = message;
  }
}

function setStartMode(active) {
  document.body.classList.toggle("start-mode", active);
  if (!active) {
    overlayMessage.hidden = true;
    overlayMessage.className = "overlay-message";
    overlayMessage.innerHTML = "";
  }
}

function showStartScreen(message = "") {
  setStartMode(true);

  const extraCopy = message
    ? `<div class="start-summary">${message}</div>`
    : "";

  overlayMessage.hidden = false;
  overlayMessage.className = "overlay-message start-screen";
  overlayMessage.innerHTML = `
    <div class="start-screen-inner">
      <div class="hero-copy">
        <h1>GRASSBLADE</h1>
        <p class="hero-tagline">GROW FROM CELLS. FOLLOW THE SUN.</p>
        <p class="start-description">
          Select one cell each turn. That cell becomes active and growth concentrates around it.
          Cells stay inside the blade and keep their own biological position.
        </p>
        ${extraCopy}
      </div>
      <div class="start-actions">
        <button id="newGameBtn" class="btn btn-primary">NEW GAME</button>
        <button id="highscoresBtn" class="btn btn-secondary">HIGH SCORES</button>
        <button id="settingsBtn" class="btn btn-secondary">SETTINGS</button>
      </div>
      <div class="start-tip">
        5 turns. 5 seconds per turn. Pick the best cell for sunlight.
      </div>
    </div>
  `;

  document.getElementById("newGameBtn").addEventListener("click", startGame);
  document.getElementById("highscoresBtn").addEventListener("click", () => toggleHallPanel(true));
  document.getElementById("settingsBtn").addEventListener("click", showSettings);
}

function toggleHallPanel(visible = null) {
  hallPanel.hidden = visible === null ? !hallPanel.hidden : !visible;
  if (!hallPanel.hidden) renderHallOfFame();
}

function showSettings() {
  setOverlay(
    {
      html: `
        <div class="start-screen-inner">
          <div class="hero-copy">
            <h1>SETTINGS</h1>
            <p class="start-description">Settings are coming soon.</p>
            <button id="backBtn" class="btn btn-primary">BACK</button>
          </div>
        </div>
      `,
    },
    "start-screen"
  );

  document.getElementById("backBtn").addEventListener("click", () => showStartScreen());
}

function startGame() {
  setStartMode(false);
  toggleHallPanel(false);

  state.running = true;
  state.turn = 1;
  state.turnTime = 0;
  state.bladeLength = 5.2;
  state.bladeAngle = 0;
  state.bladeAngularVelocity = 0;
  state.bladeTwist = 0;
  state.bladeTwistVelocity = 0;
  state.selectedCellIndex = 0;
  state.activeCellIndex = 0;
  state.score = 0;
  state.finalScore = 0;
  state.hallRecorded = false;
  state.sunAngleDeg = INITIAL_SUN_ANGLE_DEG;
  state.lastTimestamp = performance.now();

  generateCellLattice();
  state.selectedCellIndex = getInitialActiveCellIndex();
  state.activeCellIndex = state.selectedCellIndex;

  setOverlay("");
}

function generateCellLattice() {
  state.cells = [];

  // Every row keeps 5 selectable cells so the twist logic is clear:
  // left edge = strong left twist, inner left = mild left twist,
  // center = straight, inner right = mild right twist, right edge = strong right twist.
  for (let row = 0; row < CELL_ROWS; row++) {
    const progress = (row + 0.5) / CELL_ROWS;
    const usableColumns = CELL_COLUMNS;

    for (let col = 0; col < usableColumns; col++) {
      const center = (usableColumns - 1) / 2;
      const normalizedCol = (col - center) / center;

      const offsetFromCenter = clamp(normalizedCol, -1, 1);

      const baseQuality =
        0.68 +
        (1 - Math.abs(offsetFromCenter)) * 0.18 +
        progress * 0.08;

      state.cells.push({
        row,
        col,
        progress,
        positionAlongBlade: progress,
        offsetFromCenter,
        quality: clamp(baseQuality, 0.55, 1),
        energy: 0,
        size: 1.15 + progress * 0.2,
        division: 0,
        isStrong: baseQuality > 0.82,
      });
    }
  }
}

function getInitialActiveCellIndex() {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const d =
      Math.abs(cell.positionAlongBlade - 0.45) +
      Math.abs(cell.offsetFromCenter) * 0.4;

    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function showEndScreen() {
  const hallOfFameScores = loadHallOfFame();
  const isHighScore = hallOfFameScores.length < 3 || state.finalScore >= hallOfFameScores[hallOfFameScores.length - 1];
  const rank = hallOfFameScores.findIndex(score => state.finalScore >= score) + 1;

  let rankText = "";
  if (isHighScore && rank <= 3) {
    rankText = `🏆 HIGHSCORE #${rank}!`;
  }

  let hallOfFameHtml = '<div class="hall-of-fame-display"><h3>TOP SCORES</h3><ol>';
  for (let i = 0; i < 3; i++) {
    const score = hallOfFameScores[i] ?? 0;
    const highlight = score === state.finalScore ? ' class="highlighted-score"' : "";
    hallOfFameHtml += `<li${highlight}>${(score).toLocaleString()} cm</li>`;
  }
  hallOfFameHtml += '</ol></div>';

  overlayMessage.hidden = false;
  overlayMessage.className = "overlay-message start-screen";
  overlayMessage.innerHTML = `
    <div class="start-screen-inner" style="max-height:90vh; overflow-y:auto; width:min(92vw,560px); box-sizing:border-box; padding:18px;">
      <div class="hero-copy">
        <h1 style="font-size:clamp(2rem,7vw,4rem); margin:0 0 8px;">GAME OVER</h1>
        <div class="final-score-display">
          <div class="final-score-value">${state.finalScore.toLocaleString()}</div>
          <div class="final-score-label">cm</div>
          ${rankText ? `<div class="rank-text">${rankText}</div>` : ""}
        </div>
        ${hallOfFameHtml}
      </div>
      <div class="start-actions">
        <button id="newGameBtn" class="btn btn-primary">START NEW GAME</button>
        <button id="highscoresBtn" class="btn btn-secondary">HIGH SCORES</button>
        <button id="settingsBtn" class="btn btn-secondary">MENU</button>
      </div>
    </div>
  `;

  document.getElementById("newGameBtn").addEventListener("click", startGame);
  document.getElementById("highscoresBtn").addEventListener("click", () => toggleHallPanel(true));
  document.getElementById("settingsBtn").addEventListener("click", () => showStartScreen());
  setStartMode(true);
}

function endGame() {
  state.running = false;
  state.finalScore = Math.max(0, Math.floor(state.score));

  if (!state.hallRecorded) {
    recordHallOfFame(state.finalScore);
    state.hallRecorded = true;
  }

  showEndScreen();
}

function getLocalTwist(progress) {
  const tipBias = progress * progress;
  return state.bladeTwist * tipBias;
}

function getNaturalCurve(progress) {
  return Math.sin(progress * Math.PI) * BASE_SEGMENT_CURVE;
}

function getSurfaceNormal(cell, progress) {
  const localTwist = getLocalTwist(progress);
  return state.bladeAngle + localTwist + cell.offsetFromCenter * 0.42;
}

function getLightExposure(cell, progress, sunAngleRad) {
  const surfaceNormal = getSurfaceNormal(cell, progress);
  const incidence = Math.cos(normalizeAngle(sunAngleRad - surfaceNormal));
  return clamp(incidence, 0, 1);
}

function getActiveCell() {
  return state.cells[state.activeCellIndex] || state.cells[0] || null;
}


function getCellTwistDegrees(cell) {
  if (!cell) return 0;

  const absOffset = Math.abs(cell.offsetFromCenter);
  let baseTwistDeg = 0;

  // With 5 cells across:
  // outer cells = 40°, inner side cells = 30°, center = 0°.
  if (absOffset >= 0.75) {
    baseTwistDeg = 40;
  } else if (absOffset >= 0.25) {
    baseTwistDeg = 30;
  }

  const direction = cell.offsetFromCenter < 0 ? -1 : 1;

  // Growth near the base twists less. Growth near the tip twists more.
  const heightMultiplier = 0.35 + cell.positionAlongBlade * 0.65;

  return baseTwistDeg * direction * heightMultiplier;
}

function getSunIncidenceDegrees(cell) {
  if (!cell) return 0;

  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const surfaceNormal = getSurfaceNormal(cell, cell.positionAlongBlade);
  return Math.round(Math.abs(normalizeAngle(sunAngleRad - surfaceNormal) * 180 / Math.PI));
}

function getActiveInfluence(cell) {
  const active = getActiveCell();
  if (!active) return 0;

  const longitudinalDistance =
    Math.abs(cell.positionAlongBlade - active.positionAlongBlade);

  const lateralDistance =
    Math.abs(cell.offsetFromCenter - active.offsetFromCenter) * 0.55;

  const distance =
    Math.sqrt(longitudinalDistance * longitudinalDistance + lateralDistance * lateralDistance);

  return clamp(1 - distance / ACTIVE_CELL_GROWTH_RADIUS, 0, 1);
}

function getGrowthWeightedCurve(progress) {
  let influence = 0;

  for (const cell of state.cells) {
    const distance = Math.abs(cell.positionAlongBlade - progress);
    const local = clamp(1 - distance / 0.18, 0, 1);
    influence += local * cell.energy * 0.005;
  }

  return influence;
}

function getBladePath(baseX, baseY, lengthPx) {
  const points = [];
  let x = baseX;
  let y = baseY;
  let localAngle = state.bladeAngle;
  const segmentLength = lengthPx / BLADE_SEGMENTS;

  points.push({
    x,
    y,
    progress: 0,
    angle: localAngle,
    width: 34,
    twist: 0,
  });

  for (let i = 1; i <= BLADE_SEGMENTS; i++) {
    const progress = i / BLADE_SEGMENTS;
    const prevProgress = (i - 1) / BLADE_SEGMENTS;

    const twist = getLocalTwist(progress);
    const prevTwist = getLocalTwist(prevProgress);
    const twistDelta = (twist - prevTwist) * TWIST_VISUAL_STRENGTH;

    const gravitySag =
      Math.sin(progress * Math.PI) *
      Math.abs(state.bladeAngle) *
      0.01;

    const naturalCurve = getNaturalCurve(progress);
    const growthCurve = getGrowthWeightedCurve(progress);

    localAngle += twistDelta + naturalCurve + growthCurve - gravitySag;

    x += Math.sin(localAngle) * segmentLength;
    y -= Math.cos(localAngle) * segmentLength;

    const baseWidth = lerp(38, 7.5, progress);
    const twistNarrowing = 1 - Math.abs(Math.sin(twist)) * 0.18;
    const width = Math.max(1.8, baseWidth * twistNarrowing);

    points.push({
      x,
      y,
      progress,
      angle: localAngle,
      width,
      twist,
    });
  }

  return points;
}

function sampleBladePath(points, progress) {
  const p = clamp(progress, 0, 1);
  const scaled = p * (points.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;

  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];

  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    angle: lerp(a.angle, b.angle, t),
    width: lerp(a.width, b.width, t),
    twist: lerp(a.twist, b.twist, t),
    progress: p,
  };
}

function getGrowthParameters() {
  const activeCell = getActiveCell();

  if (!activeCell) {
    return {
      targetAngle: 0,
      growth: 0.1,
      sunAlignment: 0,
      cell: null,
      growthScale: 10,
      targetTwist: 0,
    };
  }

  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  const inverseBend = -activeCell.offsetFromCenter;
  const activeStrength = clamp(0.5 + activeCell.energy * 0.08, 0.5, 1.6);
  const targetAngle = clamp(inverseBend * 1.05 * activeStrength, -1.35, 1.35);

  const sunAlignment = getLightExposure(
    activeCell,
    activeCell.positionAlongBlade,
    sunAngleRad
  );

  // Twist based on the selected cell:
  // outer side cell = 40° / 360°, inner side cell = 30° / 360°, center = 0°.
  // The selected growth height amplifies the twist toward the tip.
  const targetTwist = (getCellTwistDegrees(activeCell) * Math.PI) / 180;

  // Phototropic component (sun direction influence)
  const surfaceNormal = getSurfaceNormal(activeCell, activeCell.positionAlongBlade);
  const phototropicTorque =
    normalizeAngle(sunAngleRad - surfaceNormal) *
    sunAlignment *
    activeCell.quality *
    0.5;

  // Combine lateral twist and phototropic effects
  state.bladeTwistVelocity += phototropicTorque * 0.007;
  state.bladeTwistVelocity += (targetTwist - state.bladeTwist) * 0.05;

  const centerStability = clamp(
    1 - Math.abs(activeCell.offsetFromCenter) * 0.35,
    0.2,
    1
  );

  const vigor = clamp(
    activeCell.quality * 0.45 +
      sunAlignment * 0.85 +
      centerStability * 0.16 +
      activeCell.energy * 0.035,
    0.12,
    1.85
  );

  const twistPenalty = Math.max(0, Math.abs(state.bladeTwist) - 3.5) * 0.12;
  const tiltPenalty = Math.max(0, Math.abs(state.bladeAngle) - 1.1) * 0.35;
  const growth = clamp(0.22 + vigor * 1.22 - tiltPenalty - twistPenalty, 0.05, 2.55);

  const growthScale = clamp(10 + sunAlignment * 10, 10, 20);

  return {
    targetAngle,
    growth,
    sunAlignment,
    cell: activeCell,
    growthScale,
    targetTwist,
  };
}

function updateCellGrowth(dt) {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const active = getActiveCell();
  if (!active) return 0;

  let totalActivation = 0;

  for (const cell of state.cells) {
    const exposure = getLightExposure(cell, cell.positionAlongBlade, sunAngleRad);
    const activeInfluence = getActiveInfluence(cell);

    const passivePhotosynthesis = exposure * cell.quality * 0.012 * dt;
    const activeGrowth =
      exposure *
      cell.quality *
      smootherstep(activeInfluence) *
      1.15 *
      dt;

    cell.energy += passivePhotosynthesis + activeGrowth;
    cell.energy = clamp(cell.energy, 0, 4.5);

    cell.size = clamp(
      cell.size + activeGrowth * 0.24,
      0.78,
      1.45
    );

    cell.division = clamp(
      cell.division + activeGrowth * 0.16,
      0,
      1
    );

    totalActivation += activeGrowth;
  }

  active.energy = clamp(active.energy + 0.18 * dt, 0, 4.5);
  active.size = clamp(active.size + 0.12 * dt, 0.78, 1.55);

  return totalActivation;
}

function updateGame(dt) {
  if (!state.running) return;

  state.turnTime += dt;

  state.activeCellIndex = state.selectedCellIndex;

  const params = getGrowthParameters();
  const activationGrowth = updateCellGrowth(dt);

  state.bladeAngularVelocity +=
    (params.targetAngle - state.bladeAngle) * 1.12 * dt;

  state.bladeAngularVelocity *= 0.91;
  state.bladeAngle += state.bladeAngularVelocity * dt;

  state.bladeTwist += state.bladeTwistVelocity * dt;
  state.bladeTwist = clamp(state.bladeTwist, -MAX_BLADE_TWIST, MAX_BLADE_TWIST);
  state.bladeTwistVelocity *= 0.9;

  const instability = Math.max(0, Math.abs(state.bladeAngle) - 1.15) * 0.22;
  const twistInstability = Math.max(0, Math.abs(state.bladeTwist) - 4.0) * 0.08;

  state.bladeLength = clamp(
    state.bladeLength +
      (params.growth + activationGrowth * 0.42 - instability - twistInstability) *
        dt,
    0,
    MAX_BLADE_LENGTH
  );

  const activeEnergy = params.cell ? params.cell.energy : 0;
  const sunBonus = params.sunAlignment * 260;
  const stabilityBonus = Math.max(0, 1 - Math.abs(state.bladeAngle) * 0.35) * 40;
  const activeBonus = activeEnergy * 16;

  state.score = Math.floor(
    state.bladeLength * 120 + sunBonus + stabilityBonus + activeBonus
  );

  if (timeLeftEl) {
    timeLeftEl.textContent = `0:${Math.max(0, Math.ceil(TURN_DURATION - state.turnTime))
      .toString()
      .padStart(2, "0")}`;
  }

  if (scoreEl) {
    scoreEl.textContent = state.score.toLocaleString();
  }

  if (monthEl) {
    monthEl.textContent = `${state.turn}/${GAME_TURNS}`;
  }

  if (state.turnTime >= TURN_DURATION) {
    state.turnTime -= TURN_DURATION;
    advanceTurn();
  }
}

function chooseNextSuggestedCell() {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  let bestIndex = state.selectedCellIndex;
  let bestScore = -Infinity;

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const exposure = getLightExposure(cell, cell.positionAlongBlade, sunAngleRad);
    const notOvergrown = 1 - clamp(cell.energy / 4.5, 0, 1) * 0.45;
    const score =
      exposure * 1.2 +
      cell.quality * 0.5 +
      notOvergrown +
      cell.positionAlongBlade * 0.12;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function advanceTurn() {
  if (state.turn >= GAME_TURNS) {
    endGame();
    return;
  }

  state.turn += 1;

  if (Math.abs(state.bladeAngle) > 1.25) {
    state.bladeLength = clamp(state.bladeLength - 0.35, 0, MAX_BLADE_LENGTH);
  }

  if (Math.abs(state.bladeTwist) > 1.55) {
    state.bladeLength = clamp(state.bladeLength - 0.15, 0, MAX_BLADE_LENGTH);
  }

  state.sunAngleDeg += SUN_DEGREES_PER_TURN;

  // Solut eivät vaihdu eivätkä hypi.
  // Uuden vuoron alussa vain ehdotetaan seuraavaa hyvää solua.
  state.selectedCellIndex = chooseNextSuggestedCell();
  state.activeCellIndex = state.selectedCellIndex;
}

function pickClosestCell(positionX, positionY, width, height) {
  if (state.cells.length === 0) return 0;

  const baseX = width * 0.5;
  const baseY = height * 0.92;
  const lengthPx = 130 + state.bladeLength * 26;
  const path = getBladePath(baseX, baseY, lengthPx);

  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const pos = getCellScreenPosition(cell, path);

    const dx = pos.x - positionX;
    const dy = pos.y - positionY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < bestDistance && distance < 28) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function handleCanvasPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (!state.running) {
    startGame();
    return;
  }

  state.selectedCellIndex = pickClosestCell(x, y, rect.width, rect.height);
  state.activeCellIndex = state.selectedCellIndex;
}

function handleKeyboard(event) {
  if (!state.running || state.cells.length === 0) return;

  if (event.key === "ArrowLeft") {
    state.selectedCellIndex = Math.max(0, state.selectedCellIndex - 1);
    state.activeCellIndex = state.selectedCellIndex;
    event.preventDefault();
  } else if (event.key === "ArrowRight") {
    state.selectedCellIndex = Math.min(state.cells.length - 1, state.selectedCellIndex + 1);
    state.activeCellIndex = state.selectedCellIndex;
    event.preventDefault();
  } else if (event.key === "ArrowUp") {
    const current = state.cells[state.selectedCellIndex];
    if (!current) return;

    let bestIndex = state.selectedCellIndex;
    let bestDistance = Infinity;

    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (cell.positionAlongBlade <= current.positionAlongBlade) continue;

      const d =
        Math.abs(cell.offsetFromCenter - current.offsetFromCenter) +
        Math.abs(cell.positionAlongBlade - current.positionAlongBlade) * 2;

      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    state.selectedCellIndex = bestIndex;
    state.activeCellIndex = bestIndex;
    event.preventDefault();
  } else if (event.key === "ArrowDown") {
    const current = state.cells[state.selectedCellIndex];
    if (!current) return;

    let bestIndex = state.selectedCellIndex;
    let bestDistance = Infinity;

    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (cell.positionAlongBlade >= current.positionAlongBlade) continue;

      const d =
        Math.abs(cell.offsetFromCenter - current.offsetFromCenter) +
        Math.abs(cell.positionAlongBlade - current.positionAlongBlade) * 2;

      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    state.selectedCellIndex = bestIndex;
    state.activeCellIndex = bestIndex;
    event.preventDefault();
  }
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
}

function drawSunArc(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.18;
  const r = w * 0.42;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.2, Math.PI * 0.8, false);
  ctx.stroke();
  ctx.restore();

  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const sunX = cx + r * Math.sin(sunAngleRad);
  const sunY = cy - r * Math.cos(sunAngleRad);

  const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 58);
  sunGradient.addColorStop(0, "#fff8c8");
  sunGradient.addColorStop(0.42, "#ffe88d");
  sunGradient.addColorStop(1, "rgba(255, 183, 64, 0.05)");

  ctx.fillStyle = sunGradient;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffec8b";
  ctx.shadowColor = "rgba(255,220,110,0.55)";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCenterLine(w, h) {
  const baseX = w * 0.5;
  const groundY = h * 0.92;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(baseX, groundY);
  ctx.lineTo(baseX, h * 0.24);
  ctx.stroke();
  ctx.restore();
}

function getBladeEdges(path) {
  const leftEdge = [];
  const rightEdge = [];

  for (const p of path) {
    const normalX = -Math.cos(p.angle);
    const normalY = -Math.sin(p.angle);

    const halfWidth = p.width * 0.5;
    const surfaceFold = Math.sin(p.twist) * halfWidth * 0.95;

    leftEdge.push({
      x: p.x + normalX * (halfWidth + surfaceFold),
      y: p.y + normalY * (halfWidth + surfaceFold),
    });

    rightEdge.push({
      x: p.x - normalX * (halfWidth - surfaceFold),
      y: p.y - normalY * (halfWidth - surfaceFold),
    });
  }

  return { leftEdge, rightEdge };
}

function drawBladeSilhouette(path) {
  const { leftEdge, rightEdge } = getBladeEdges(path);
  const base = path[0];
  const tip = path[path.length - 1];

  const bladeGradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
  bladeGradient.addColorStop(0, "rgba(37,83,35,0.72)");
  bladeGradient.addColorStop(0.45, "rgba(86,148,52,0.46)");
  bladeGradient.addColorStop(1, "rgba(185,239,114,0.36)");

  ctx.fillStyle = bladeGradient;
  ctx.strokeStyle = "rgba(22, 61, 25, 0.96)";
  ctx.lineWidth = 2.0;

  ctx.beginPath();
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (let i = 1; i < leftEdge.length; i++) {
    ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  }
  for (let i = rightEdge.length - 1; i >= 0; i--) {
    ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw twist spiral stripes for visual feedback
  ctx.save();
  ctx.strokeStyle = "rgba(0, 30, 0, 0.45)";
  ctx.lineWidth = 1.2;
  const spiralStripes = 6;
  for (let stripe = 0; stripe < spiralStripes; stripe++) {
    const stripeProgress = stripe / spiralStripes;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const progress = i / path.length;
      const twistPhase = (stripeProgress * Math.PI * 2 + state.bladeTwist * 1.5);
      const offset = Math.sin(twistPhase + progress * Math.PI * 4) * p.width * 0.35;
      const normalX = -Math.cos(p.angle);
      const normalY = -Math.sin(p.angle);
      const x = p.x + normalX * offset;
      const y = p.y + normalY * offset;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function getCellScreenPosition(cell, path) {
  const sample = sampleBladePath(path, cell.positionAlongBlade);

  const normalX = -Math.cos(sample.angle);
  const normalY = -Math.sin(sample.angle);

  const maxOffset = sample.width * 0.46;
  const twistVisibility = Math.max(0.55, Math.cos(sample.twist) * 0.9);
  const sideOffset = cell.offsetFromCenter * maxOffset * twistVisibility;

  return {
    x: sample.x + normalX * sideOffset,
    y: sample.y + normalY * sideOffset,
    angle: sample.angle,
    width: sample.width,
    twist: sample.twist,
    visibleSide: twistVisibility,
  };
}

function drawBlade(w, h) {
  const baseX = w * 0.5;
  const baseY = h * 0.92;
  const lengthPx = 130 + state.bladeLength * 26;
  const path = getBladePath(baseX, baseY, lengthPx);

  drawBladeSilhouette(path);
  drawCellsOnBlade(path);
  drawBladeVeins(path);
}

function drawBladeVeins(path) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y - 7);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRoundedCell(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x - w / 2 + radius, y - h / 2);
  ctx.lineTo(x + w / 2 - radius, y - h / 2);
  ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + radius);
  ctx.lineTo(x + w / 2, y + h / 2 - radius);
  ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - radius, y + h / 2);
  ctx.lineTo(x - w / 2 + radius, y + h / 2);
  ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - radius);
  ctx.lineTo(x - w / 2, y - h / 2 + radius);
  ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + radius, y - h / 2);
  ctx.closePath();
}

function drawCellsOnBlade(path) {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  // First pass: Draw cell interconnections (veins between cells)
  ctx.save();
  ctx.strokeStyle = "rgba(165, 210, 120, 0.15)";
  ctx.lineWidth = 0.8;

  for (let i = 0; i < state.cells.length - 1; i++) {
    const cell1 = state.cells[i];
    const cell2 = state.cells[i + 1];

    // Connect to nearby cells
    if (Math.abs(cell1.row - cell2.row) <= 1 && Math.abs(cell1.col - cell2.col) <= 1) {
      const pos1 = getCellScreenPosition(cell1, path);
      const pos2 = getCellScreenPosition(cell2, path);

      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Second pass: Draw cells with improved appearance
  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const pos = getCellScreenPosition(cell, path);
    const exposure = getLightExposure(cell, cell.positionAlongBlade, sunAngleRad);
    const activeInfluence = getActiveInfluence(cell);
    const isSelected = state.selectedCellIndex === i;
    const isActive = state.activeCellIndex === i;

    // More natural color variation with twist influence
    const saturation = cell.isStrong ? 98 : 76;
    const energyEffect = Math.min(cell.energy / 4.5, 1) * 12;
    const twistBoost = Math.abs(cell.offsetFromCenter) * 16; // Outer cells appear more vibrant
    const lightness = clamp(
      42 + exposure * 26 + energyEffect + activeInfluence * 12 + twistBoost,
      38,
      88
    );

    // Add slight hue shift for more naturalness
    const hueShift = (cell.offsetFromCenter * 3 + cell.progress * 2) % 20;
    const cellColor = `hsl(${92 + hueShift}, ${saturation}%, ${lightness}%)`;

    const rowHeight =
      (130 + state.bladeLength * 26) / CELL_ROWS * 0.82;

    const cellWidth =
      Math.max(13.5, pos.width * 0.54 * cell.size * (0.92 + pos.visibleSide * 0.38));

    const cellHeight =
      Math.max(14.2, rowHeight * cell.size * (0.92 + exposure * 0.16));

    // Calculate twist contribution of this cell for visual feedback
    const cellTwistContribution = (getCellTwistDegrees(cell) * Math.PI) / 180;
    const twistIntensity = Math.abs(cellTwistContribution);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    ctx.rotate(
      pos.angle +
      Math.PI / 2 +
      pos.twist * 1.2 +
      cell.offsetFromCenter * 0.24
    );

    // Draw main cell body with vibrant appearance
    ctx.fillStyle = cellColor;
    ctx.strokeStyle = `rgba(21, 64, 25, ${isActive ? 0.95 : 0.75})`;
    ctx.lineWidth = isActive ? 2.2 : 1.4;
    ctx.shadowColor = `rgba(92, 180, 50, ${0.4 * exposure})`;
    ctx.shadowBlur = 4;

    // Draw rounded cell with more organic shape
    drawRoundedCell(0, 0, cellWidth, cellHeight, 3.2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Add prominent inner shading for depth and shine
    ctx.fillStyle = `rgba(255,255,255,${0.18 + exposure * 0.24})`;
    drawRoundedCell(-cellWidth * 0.18, -cellHeight * 0.24, cellWidth * 0.52, cellHeight * 0.38, 2.6);
    ctx.fill();

    // Add color variation spots
    ctx.fillStyle = `rgba(255,255,255,${0.08 + exposure * 0.12})`;
    ctx.beginPath();
    ctx.arc(-cellWidth * 0.28, cellHeight * 0.18, cellWidth * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${0.06 + exposure * 0.1})`;
    ctx.beginPath();
    ctx.arc(cellWidth * 0.22, -cellHeight * 0.16, cellWidth * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Active/Selected highlights with glow
    if (isSelected || isActive) {
      ctx.strokeStyle = isActive
        ? "rgba(100, 200, 255, 0.95)"
        : "rgba(150, 220, 255, 0.78)";
      ctx.lineWidth = isActive ? 2.6 : 1.9;
      drawRoundedCell(0, 0, cellWidth + 3.2, cellHeight + 3.2, 3.2);
      ctx.stroke();

      // Add prominent glow for active cell
      if (isActive) {
        ctx.strokeStyle = "rgba(100, 200, 255, 0.45)";
        ctx.lineWidth = 5;
        ctx.shadowColor = "rgba(100, 200, 255, 0.6)";
        ctx.shadowBlur = 8;
        drawRoundedCell(0, 0, cellWidth + 8, cellHeight + 8, 4);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Visual indicator for twist magnitude - more prominent
        const twistIndicatorRadius = cellWidth * 0.6 + twistIntensity * 12;
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 + twistIntensity * 0.5})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, twistIndicatorRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Add subtle cell division lines for more detail
    if (cell.division > 0.3) {
      ctx.strokeStyle = `rgba(165, 210, 120, ${cell.division * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-cellWidth * 0.35, 0);
      ctx.lineTo(cellWidth * 0.35, 0);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawHud(w, h) {
  const params = getGrowthParameters();
  const active = getActiveCell();

  // Draw labels and values at top left - ENLARGED
  const labelStyle = "600 13px Manrope, sans-serif";
  const valueStyle = "700 22px Manrope, sans-serif";
  const labelColor = "rgba(32, 52, 36, 0.8)";
  const valueColor = "rgba(15, 34, 18, 0.98)";
  const padding = w * 0.02;
  let x = padding;
  const yLabel = h * 0.032;
  const yValue = h * 0.07;
  const colSpacing = w * 0.15;

  // TIME column
  ctx.fillStyle = labelColor;
  ctx.font = labelStyle;
  ctx.textAlign = "left";
  ctx.fillText("TIME", x, yLabel);
  ctx.fillStyle = valueColor;
  ctx.font = valueStyle;
  ctx.fillText(`${Math.max(0, Math.ceil(TURN_DURATION - state.turnTime))}s`, x, yValue);

  // MONTH column
  x += colSpacing;
  ctx.fillStyle = labelColor;
  ctx.font = labelStyle;
  ctx.fillText("MONTH", x, yLabel);
  ctx.fillStyle = valueColor;
  ctx.font = valueStyle;
  ctx.fillText(`${state.turn}/${GAME_TURNS}`, x, yValue);

  // Right side - SCORE (highlighted)
  let xRight = w - padding;
  ctx.textAlign = "right";
  ctx.fillStyle = labelColor;
  ctx.font = labelStyle;
  ctx.fillText("SCORE", xRight, yLabel);
  ctx.fillStyle = "#d88e40";
  ctx.font = "700 22px Manrope, sans-serif";
  ctx.fillText(`${state.score.toLocaleString()}`, xRight, yValue);

  // Additional info right side
  ctx.fillStyle = valueColor;
  ctx.font = "600 11px Manrope, sans-serif";
  const sunDeg = getSunIncidenceDegrees(active);
  const twistDeg = Math.round((state.bladeTwist * 180) / Math.PI);
  ctx.fillText(`Sun ${Math.round(params.sunAlignment * 100)}% Ray ${sunDeg}° Twist ${twistDeg}°`, xRight, h * 0.085);

  // Help text at bottom
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 11px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "Pick green cells. Edge cells twist the blade.",
    w * 0.5,
    h * 0.88
  );
}

function drawSunRays(w, h) {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const baseX = w * 0.5;
  const baseY = h * 0.92;

  // Draw 3-4 sun rays from sky down through the grass
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 200, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  const raySpacing = Math.PI / 12; // Spread rays around sun direction
  for (let i = -1; i <= 1; i++) {
    const angle = sunAngleRad + (i * raySpacing);
    const rayLength = h * 1.8;

    // Find sun position in sky
    const sunArcCy = h * 0.18;
    const sunArcR = w * 0.42;
    const sunX = w * 0.5 + sunArcR * Math.sin(angle);
    const sunY = sunArcCy - sunArcR * Math.cos(angle);

    // Extend downward
    const downDist = rayLength;
    const rayEndX = sunX + Math.sin(angle) * downDist;
    const rayEndY = sunY + Math.cos(angle) * downDist;

    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(rayEndX, rayEndY);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawSunIndicator(w, h) {
  const centerX = w * 0.5;
  const centerY = h * 0.24;
  const radius = w * 0.18;

  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const sunX = centerX + radius * Math.sin(sunAngleRad);
  const sunY = centerY - radius * Math.cos(sunAngleRad);

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

function drawTopDownHUD(w, h) {
  const hudSize = 160;
  const hudMargin = 12;
  const hudX = hudMargin;
  const hudY = h - hudSize - hudMargin - 60;

  ctx.save();

  // Draw HUD background with subtle border
  ctx.fillStyle = "rgba(15, 34, 18, 0.92)";
  ctx.fillRect(hudX, hudY, hudSize, hudSize);

  ctx.strokeStyle = "rgba(134, 200, 91, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(hudX, hudY, hudSize, hudSize);

  // Add corner decorations
  const cornerSize = 8;
  ctx.fillStyle = "rgba(134, 200, 91, 0.4)";
  // Top-left corner
  ctx.fillRect(hudX, hudY, cornerSize, 2);
  ctx.fillRect(hudX, hudY, 2, cornerSize);
  // Bottom-right corner
  ctx.fillRect(hudX + hudSize - cornerSize, hudY + hudSize - 2, cornerSize, 2);
  ctx.fillRect(hudX + hudSize - 2, hudY + hudSize - cornerSize, 2, cornerSize);

  // Set up top-down view transform (center of HUD)
  const hudCenterX = hudX + hudSize * 0.5;
  const hudCenterY = hudY + hudSize * 0.5;

  ctx.translate(hudCenterX, hudCenterY);
  ctx.rotate(state.bladeAngle);

  // Draw blade cross-section from above
  const bladeWidth = hudSize * 0.52;
  const bladeLength = hudSize * 0.72;

  // Gradient for blade
  const bladeGradientTopDown = ctx.createLinearGradient(0, -bladeLength * 0.5, 0, bladeLength * 0.5);
  bladeGradientTopDown.addColorStop(0, "rgba(86, 148, 52, 0.8)");
  bladeGradientTopDown.addColorStop(0.5, "rgba(108, 180, 66, 0.95)");
  bladeGradientTopDown.addColorStop(1, "rgba(133, 200, 78, 0.8)");

  ctx.fillStyle = bladeGradientTopDown;
  ctx.beginPath();
  ctx.moveTo(-bladeWidth * 0.5, -bladeLength * 0.5);
  ctx.lineTo(bladeWidth * 0.5, -bladeLength * 0.5);
  ctx.lineTo(bladeWidth * 0.48, bladeLength * 0.5);
  ctx.lineTo(-bladeWidth * 0.48, bladeLength * 0.5);
  ctx.closePath();
  ctx.fill();

  // Add spiral twist visualization - dark stripes following twist
  const twistStripes = 4;
  const twistPerStripe = (state.bladeTwist / twistStripes) * 0.3;
  ctx.strokeStyle = "rgba(30, 60, 30, 0.6)";
  ctx.lineWidth = 1;
  for (let stripe = 0; stripe < twistStripes; stripe++) {
    const stripeX = (stripe - twistStripes * 0.5) * (bladeWidth * 0.18);
    ctx.beginPath();
    for (let i = 0; i <= bladeLength; i += 3) {
      const y = -bladeLength * 0.5 + i;
      const progress = i / bladeLength;
      const twistShift = Math.sin(state.bladeTwist * progress) * bladeWidth * 0.12;
      ctx.lineTo(stripeX + twistShift, y);
    }
    ctx.stroke();
  }

  // Draw cells from top-down perspective with interconnection
  const cellConnections = [];

  // Draw cell interconnection lines first
  ctx.strokeStyle = "rgba(165, 210, 120, 0.25)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < state.cells.length; i++) {
    const cell1 = state.cells[i];
    const cellY1 = -bladeLength * 0.5 + (cell1.positionAlongBlade * bladeLength);
    const cellX1 = cell1.offsetFromCenter * bladeWidth * 0.4;

    for (let j = i + 1; j < Math.min(i + 3, state.cells.length); j++) {
      const cell2 = state.cells[j];
      const cellY2 = -bladeLength * 0.5 + (cell2.positionAlongBlade * bladeLength);
      const cellX2 = cell2.offsetFromCenter * bladeWidth * 0.4;

      const distance = Math.sqrt((cellX2 - cellX1) ** 2 + (cellY2 - cellY1) ** 2);
      if (distance < bladeWidth * 0.35) {
        ctx.beginPath();
        ctx.moveTo(cellX1, cellY1);
        ctx.lineTo(cellX2, cellY2);
        ctx.stroke();
      }
    }
  }

  // Draw cells
  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const cellY = -bladeLength * 0.5 + (cell.positionAlongBlade * bladeLength);
    const cellX = cell.offsetFromCenter * bladeWidth * 0.4;

    const cellRadius = (cell.size * 4.0) + 1.8;
    const isSelected = state.selectedCellIndex === i;
    const isActive = state.activeCellIndex === i;

    if (isActive) {
      ctx.fillStyle = "rgba(255, 238, 72, 0.85)";
      ctx.beginPath();
      ctx.arc(cellX, cellY, cellRadius + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 238, 72, 0.4)";
      ctx.beginPath();
      ctx.arc(cellX, cellY, cellRadius + 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (isSelected) {
      ctx.fillStyle = "rgba(255, 255, 160, 0.6)";
      ctx.beginPath();
      ctx.arc(cellX, cellY, cellRadius + 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cell color based on energy
    const energyHue = cell.energy > 2 ? 92 : 88;
    const cellOpacity = 0.3 + Math.min(cell.energy / 4.5, 1) * 0.6;
    ctx.fillStyle = `hsla(${energyHue}, 85%, 55%, ${cellOpacity})`;
    ctx.beginPath();
    ctx.arc(cellX, cellY, cellRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cell highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(cellX - cellRadius * 0.35, cellY - cellRadius * 0.35, cellRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw rotation indicator ring
  ctx.strokeStyle = "rgba(165, 210, 120, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, bladeWidth * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  // Draw sun rays in top-down view
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  ctx.strokeStyle = "rgba(255, 255, 150, 0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  for (let i = -1; i <= 1; i++) {
    const angle = sunAngleRad + (i * Math.PI / 18);
    const rayLength = bladeWidth * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(angle) * rayLength, Math.cos(angle) * rayLength);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.restore();

  // Draw rotation angle indicator at bottom of HUD
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "700 12px Manrope, sans-serif";
  ctx.textAlign = "center";
  const twistDeg = Math.round((state.bladeTwist * 180) / Math.PI);
  ctx.fillText(`TWIST ${twistDeg}°`, hudCenterX, hudY + hudSize + 16);

  // Draw mini compass rose
  const compassRadius = 10;
  const compassX = hudX + hudSize - 16;
  const compassY = hudY + 16;

  ctx.strokeStyle = "rgba(134, 200, 91, 0.6)";
  ctx.lineWidth = 1.2;

  // Circle
  ctx.beginPath();
  ctx.arc(compassX, compassY, compassRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(compassX - compassRadius, compassY);
  ctx.lineTo(compassX + compassRadius, compassY);
  ctx.moveTo(compassX, compassY - compassRadius);
  ctx.lineTo(compassX, compassY + compassRadius);
  ctx.stroke();

  // Cardinal directions
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "600 10px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const directions = [
    { text: "N", x: 0, y: -compassRadius - 7 },
    { text: "E", x: compassRadius + 7, y: 0 },
    { text: "S", x: 0, y: compassRadius + 7 },
    { text: "W", x: -compassRadius - 7, y: 0 },
  ];

  for (const dir of directions) {
    ctx.fillText(dir.text, compassX + dir.x, compassY + dir.y);
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
  drawSunRays(w, h);
  drawCenterLine(w, h);
  drawSunIndicator(w, h);
  drawBlade(w, h);
  drawGridLines(w, h);

  if (state.running) {
    drawHud(w, h);
    drawTopDownHUD(w, h);
  }
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
  setStartMode(true);
  renderHallOfFame();
  showStartScreen();
  ensureCanvasSize();

  // Hide HTML score elements to make room for blade
  if (timeLeftEl) {
    timeLeftEl.style.display = "none";
    timeLeftEl.textContent = "0:05";
  }
  if (scoreEl) scoreEl.style.display = "none";
  if (monthEl) {
    monthEl.style.display = "none";
    monthEl.textContent = `0/${GAME_TURNS}`;
  }

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

  window.addEventListener("keydown", handleKeyboard);

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
