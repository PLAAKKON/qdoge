const GAME_TURNS = 5;
const TURN_DURATION = 10;
const MAX_BLADE_LENGTH = 100;
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
  localBendStrength: 0,
  localBendVelocity: 0,
  localBendCenter: 0.45,
  localBendWidth: 0.24,
  bladeTwist: 0,
  bladeTwistVelocity: 0,
  cells: [],
  selectedCellIndex: 0,
  activeCellIndex: 0,
  score: 0,
  finalScore: 0,
  hallRecorded: false,
  endScreenShown: false,
  lastTimestamp: 0,
  sunAngleDeg: INITIAL_SUN_ANGLE_DEG,
  actualHeight: 0,
  straightness: 1,
  isGameEnded: false,
  gameEndTime: 0,
  lastSunAlignmentMessage: 0,
  showingPerfectSunMessage: false,
  perfectSunMessageTime: 0,
  lastSunAlignment: 0,
  finalMaxHeight: 0,
  finalEffectiveHeight: 0,
  finalStraightness: 0,
  perfectAlignmentBonus: 0,
  maxPerfectAlignmentBonus: 0,
  sunDirection: -1,
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
const hallOfFameListEl = document.getElementById("hallOfFameList");
const clearHallBtn = document.getElementById("clearHallBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const dpr = Math.min(window.devicePixelRatio || 1, 2);

function installLayoutFixes() {
  if (document.getElementById("grassblade-layout-fixes")) return;

  const style = document.createElement("style");
  style.id = "grassblade-layout-fixes";

  style.textContent = `
    .mouse-control-panel,
    .mouse-panel,
    .control-panel,
    .pointer-control,
    .touch-control,
    .joystick-panel,
    .slider-panel,
    .bottom-control,
    .bottom-controls,
    #mouseControlPanel,
    #mouseControls,
    #pointerControl,
    #touchControl,
    #joystickPanel,
    #sliderPanel {
      display:none !important;
      visibility:hidden !important;
      pointer-events:none !important;
    }

    html,
    body {
      margin:0;
      padding:0;
      width:100%;
      height:100%;
      overflow:hidden;
    }

    body {
      overscroll-behavior:none;
      touch-action:manipulation;
    }

    #grassCanvas {
      width:100% !important;
      height:100% !important;
      display:block !important;
      background:transparent !important;
      touch-action:manipulation !important;
    }

    /* Overlay fills screen but keeps tiny safety padding */
    .overlay-message{
      width:100vw !important;
      max-width:100vw !important;
      padding:6px !important;
      box-sizing:border-box !important;
      overflow:hidden !important;
    }

    /* Start screen uses almost full mobile width */
    .start-screen-inner{
      width:calc(100vw - 12px) !important;
      max-width:560px !important;
      margin:0 auto !important;
      padding:10px !important;
      box-sizing:border-box !important;
      overflow:hidden !important;
    }

    .hero-copy,
    .start-actions,
    .start-tip,
    .start-description,
    .hall-of-fame-display{
      width:100% !important;
      max-width:100% !important;
      box-sizing:border-box !important;
      overflow-wrap:anywhere !important;
      word-break:break-word !important;
    }

    /* GRASSBLADE title fix */
    .hero-copy h1{
      margin:0 0 10px 0 !important;
      font-size:clamp(1.8rem,9.2vw,4.8rem) !important;
      line-height:0.95 !important;
      max-width:100% !important;
      white-space:nowrap !important;
      overflow-wrap:normal !important;
      word-break:normal !important;
    }

    .start-actions{
      display:flex !important;
      flex-wrap:wrap !important;
      justify-content:center !important;
      gap:8px !important;
      width:100% !important;
    }

    .btn{
      padding:10px 14px !important;
      font-size:clamp(.8rem,3.5vw,1.1rem) !important;
      white-space:normal !important;
      max-width:100% !important;
      box-sizing:border-box !important;
    }

    .hall-panel{
      max-width:calc(100vw - 12px) !important;
      overflow:auto !important;
    }
	
	body.ios-fake-fullscreen {
  position:fixed;
  inset:0;
  width:100vw;
  height:100dvh;
  overflow:hidden;
}

body.ios-fake-fullscreen #gameContainer{
  position:fixed !important;
  inset:0 !important;
  width:100vw !important;
  height:100dvh !important;
  z-index:9999 !important;
}

body.ios-fake-fullscreen #grassCanvas{
  width:100vw !important;
  height:100dvh !important;
}
  `;

  document.head.appendChild(style);
}

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

function constrainSunToNorthernHemisphere(angleDeg) {
  let angle = angleDeg % 360;
  if (angle < 0) angle += 360;
  if (angle > 90 && angle < 270) {
    if (angle < 180) {
      angle = 90;
    } else {
      angle = 270;
    }
  }
  return angle;
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
        5 turns. 10 seconds each. Position cells toward sunlight for maximum growth.
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
  state.localBendStrength = 0;
  state.localBendVelocity = 0;
  state.localBendCenter = 0.45;
  state.localBendWidth = 0.24;
  state.bladeTwist = 0;
  state.bladeTwistVelocity = 0;
  state.selectedCellIndex = 0;
  state.activeCellIndex = 0;
  state.score = 0;
  state.finalScore = 0;
  state.hallRecorded = false;
  state.endScreenShown = false;
  state.sunAngleDeg = getNextSunAngle();
  state.actualHeight = 0;
  state.straightness = 1;
  state.isGameEnded = false;
  state.gameEndTime = 0;
  state.lastSunAlignmentMessage = 0;
  state.showingPerfectSunMessage = false;
  state.perfectSunMessageTime = 0;
  state.lastSunAlignment = 0;
  state.finalMaxHeight = 0;
  state.finalEffectiveHeight = 0;
  state.finalStraightness = 0;
  state.perfectAlignmentBonus = 0;
  state.maxPerfectAlignmentBonus = 0;
  state.sunDirection = Math.random() < 0.5 ? -1 : 1;
  state.lastTimestamp = performance.now();

  generateCellLattice();
  state.selectedCellIndex = getInitialActiveCellIndex();
  state.activeCellIndex = state.selectedCellIndex;

  setOverlay("");
}

function generateCellLattice() {
  state.cells = [];

  for (let row = 0; row < CELL_ROWS; row++) {
    const progress = (row + 0.5) / CELL_ROWS;

    for (let col = 0; col < CELL_COLUMNS; col++) {

      const center=(CELL_COLUMNS-1)/2;
      const normalizedCol=(col-center)/center;

      const offsetFromCenter=
        clamp(normalizedCol,-1,1);

      const baseQuality=
        0.68+
        (1-Math.abs(offsetFromCenter))*0.18+
        progress*0.08;

      state.cells.push({

        row,
        col,
        progress,

        positionAlongBlade:progress,
        offsetFromCenter,

        quality:clamp(
          baseQuality,
          0.55,
          1
        ),

        energy:0,
        size:1.15+progress*0.2,
        division:0,

        isStrong:
          baseQuality>0.82,

        // uusi
        leafOpened:false
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
  const animatedScore = getAnimatedFinalScore();
  const hallOfFameScores = loadHallOfFame();
  const isHighScore = hallOfFameScores.length < 3 || state.finalScore >= hallOfFameScores[hallOfFameScores.length - 1];
  const rankIndex = hallOfFameScores.findIndex(score => state.finalScore >= score);
  const rank = rankIndex === -1 ? hallOfFameScores.length + 1 : rankIndex + 1;

  let rankText = "";
  if (isHighScore && rank <= 3) {
    rankText = `🏆 HIGHSCORE #${rank}!`;
  }

  let hallOfFameHtml = '<div class="hall-of-fame-display"><h3>TOP SCORES</h3><ol>';
  for (let i = 0; i < 3; i++) {
    const score = hallOfFameScores[i] ?? 0;
    const highlight = score === animatedScore ? ' class="highlighted-score"' : "";
    hallOfFameHtml += `<li${highlight}>${(score).toLocaleString()} cm</li>`;
  }
  hallOfFameHtml += '</ol></div>';

  overlayMessage.hidden = false;
  overlayMessage.className = "overlay-message start-screen";
  overlayMessage.innerHTML = `
    <div class="start-screen-inner" style="max-height:90vh; overflow-y:auto; width:min(92vw,560px); box-sizing:border-box; padding:18px;">
      <div class="hero-copy">
        <h1 style="font-size:clamp(2rem,7vw,4rem); margin:0 0 8px; color:#ffd700;">HARVEST COMPLETE</h1>
        <div class="final-score-display">
          <div class="final-score-value" style="font-size:3.5rem; color:#ffd700;">${animatedScore.toLocaleString()}</div>
          <div class="final-score-label" style="color:#86c85b;">centimeters</div>
          ${rankText ? `<div class="rank-text" style="color:#ffd700; font-size:1.3rem; margin-top:8px;">${rankText}</div>` : ""}
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
  state.isGameEnded = true;
  state.gameEndTime = performance.now() / 1000;

  const bounds = canvas.getBoundingClientRect();
  const measuredHeight = calculateEffectiveBladeHeight(bounds.width, bounds.height);

  const straightnessFactor = clamp(
    1 - Math.abs(state.bladeAngle) * 0.35,
    0,
    1
  );

  state.finalScore = Math.floor(measuredHeight * straightnessFactor);
  state.score = state.finalScore;

  if (!state.hallRecorded) {
    recordHallOfFame(state.finalScore);
    state.hallRecorded = true;
  }
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
  let localBend = 0;
  const active = getActiveCell();

  if (active) {
    const center = state.localBendCenter ?? active.positionAlongBlade;
    const radius = state.localBendWidth ?? 0.24;
    const distance = progress - center;

    const radiusInfluence = smootherstep(
      clamp(1 - Math.abs(distance) / radius, 0, 1)
    );

    const aboveCarry =
      progress >= center
        ? smootherstep(
            clamp((progress - center) / radius, 0, 1)
          )
        : 0;

    const belowSoftness =
      progress < center
        ? smootherstep(
            clamp(1 - Math.abs(distance) / radius, 0, 1)
          ) * 0.18
        : 0;

    localBend =
      state.localBendStrength *
      (
        radiusInfluence * 0.55 +
        aboveCarry * 0.45 +
        belowSoftness
      );
  }

  return (
    state.bladeAngle +
    localTwist +
    localBend +
    cell.offsetFromCenter * 0.42
  );
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
  if (absOffset >= 0.75) {
    baseTwistDeg = 40;
  } else if (absOffset >= 0.25) {
    baseTwistDeg = 30;
  }
  const direction = cell.offsetFromCenter < 0 ? -1 : 1;
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
  const longitudinalDistance = Math.abs(cell.positionAlongBlade - active.positionAlongBlade);
  const lateralDistance = Math.abs(cell.offsetFromCenter - active.offsetFromCenter) * 0.55;
  const distance = Math.sqrt(longitudinalDistance * longitudinalDistance + lateralDistance * lateralDistance);
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
    x, y, progress: 0, angle: localAngle, width: 34, twist: 0,
  });

  for (let i = 1; i <= BLADE_SEGMENTS; i++) {
    const progress = i / BLADE_SEGMENTS;
    const prevProgress = (i - 1) / BLADE_SEGMENTS;

    const twist = getLocalTwist(progress);
    const prevTwist = getLocalTwist(prevProgress);
    const twistDelta = (twist - prevTwist) * TWIST_VISUAL_STRENGTH;

    const gravitySag = Math.sin(progress * Math.PI) * Math.abs(state.bladeAngle) * 0.01;
    const naturalCurve = getNaturalCurve(progress);
    const growthCurve = getGrowthWeightedCurve(progress);

    const active = getActiveCell();
    let localBend = 0;

    if (active) {
      const center = state.localBendCenter ?? active.positionAlongBlade;
      const radius = state.localBendWidth ?? 0.24;
      const distance = progress - center;

      const radiusInfluence = smootherstep(clamp(1 - Math.abs(distance) / radius, 0, 1));
      
      const aboveCarry = progress >= center
          ? smootherstep(clamp((progress - center) / radius, 0, 1))
          : 0;

      const belowSoftness = progress < center
          ? smootherstep(clamp(1 - Math.abs(distance) / radius, 0, 1)) * 0.18
          : 0;

      localBend =
        state.localBendStrength *
        (
          radiusInfluence * 0.055 + 
          aboveCarry * 0.045 +
          belowSoftness * 0.035
        );
    }

    localAngle += twistDelta + naturalCurve + growthCurve + localBend - gravitySag;

    x += Math.sin(localAngle) * segmentLength;
    y -= Math.cos(localAngle) * segmentLength;

    const baseWidth = lerp(38, 7.5, progress);
    const twistNarrowing = 1 - Math.abs(Math.sin(twist)) * 0.18;
    const width = Math.max(1.8, baseWidth * twistNarrowing);

    points.push({
      x, y, progress, angle: localAngle, width, twist,
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

function calculateBladeStraightness() {
  let leftCells = 0;
  let rightCells = 0;

  for (const cell of state.cells) {
    if (cell.offsetFromCenter < -0.1) {
      leftCells++;
    } else if (cell.offsetFromCenter > 0.1) {
      rightCells++;
    }
  }

  const total = leftCells + rightCells;
  if (total === 0) return 1;

  const ratio = Math.min(leftCells, rightCells) / Math.max(leftCells, rightCells);
  return ratio;
}

function calculateEffectiveBladeHeight(w, h) {
  const baseX = w * 0.5;
  const baseY = h * 0.92;
  const lengthPx = 130 + state.bladeLength * 26;
  const path = getBladePath(baseX, baseY, lengthPx);
  
  if (path.length === 0) return 0;
  
  const tip = path[path.length - 1];
  const groundY = baseY;
  
  const heightPx = Math.max(0, groundY - tip.y);
  return Math.round(heightPx * 0.15);
}

function calculateFinalScore(w, h) {
  const maxHeight = state.actualHeight;
  const effectiveHeight = calculateEffectiveBladeHeight(w, h);
  const baseScore = Math.max(0, effectiveHeight);
  const straightnessBonus = state.straightness * state.straightness * (maxHeight * 0.1);
  const totalScore = Math.floor(baseScore + straightnessBonus);
  
  return totalScore;
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
  const directBend = activeCell.offsetFromCenter;
  const activeStrength = clamp(0.5 + activeCell.energy * 0.08, 0.5, 1.6);

  const rootControl = activeCell.positionAlongBlade < 0.3 
    ? clamp(1.05 - activeCell.positionAlongBlade * 3.0, 0, 1.0) 
    : 0; 

  const targetAngle = clamp(
    directBend * 1.05 * activeStrength * rootControl,
    -1.35,
    1.35
  );

  state.localBendCenter = activeCell.positionAlongBlade;
  state.localBendWidth = lerp(0.34, 0.16, activeCell.positionAlongBlade);

  const sunAlignment = getLightExposure(
    activeCell,
    activeCell.positionAlongBlade,
    sunAngleRad
  );

  const targetTwist = (getCellTwistDegrees(activeCell) * Math.PI) / 180;

  const surfaceNormal = getSurfaceNormal(activeCell, activeCell.positionAlongBlade);
  const phototropicTorque =
    normalizeAngle(sunAngleRad - surfaceNormal) *
    sunAlignment *
    activeCell.quality *
    0.5;

  state.bladeTwistVelocity += phototropicTorque * 0.0045;
  state.bladeTwistVelocity += (targetTwist - state.bladeTwist) * 0.05;

  const centerStability = clamp(1 - Math.abs(activeCell.offsetFromCenter) * 0.35, 0.2, 1);

  const vigor = clamp(
    activeCell.quality * 0.45 +
      sunAlignment * 1.8 +
      sunAlignment * sunAlignment * 0.8 +
      centerStability * 0.16 +
      activeCell.energy * 0.035,
    0.12,
    2.4
  );

  const twistPenalty = Math.max(0, Math.abs(state.bladeTwist) - 3.5) * 0.12;
  const tiltPenalty = Math.max(0, Math.abs(state.bladeAngle) - 1.1) * 0.35;
  const growth = clamp(0.11 + vigor * 0.61 - tiltPenalty - twistPenalty, 0.025, 1.475);

  const growthScale = clamp(15 + sunAlignment * 15, 15, 30);

  return {
    targetAngle,
    growth,
    sunAlignment,
    cell: activeCell,
    growthScale,
    targetTwist,
    localBendTarget: clamp(directBend * activeStrength * 1.15, -1.2, 1.2),
  };
}

function updateCellGrowth(dt) {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;
  const active = getActiveCell();

  if (!active) return 0;

  let totalActivation = 0;

  for (const cell of state.cells) {
    const exposure = getLightExposure(
      cell,
      cell.positionAlongBlade,
      sunAngleRad
    );

    const activeInfluence = getActiveInfluence(cell);

    const passivePhotosynthesis =
      exposure * cell.quality * 0.006 * dt;

    const activeGrowth =
      exposure *
      cell.quality *
      smootherstep(activeInfluence) *
      0.575 *
      dt;

    const sunHitBonus =
      exposure * exposure * 0.008 * dt;

    cell.energy +=
      passivePhotosynthesis +
      activeGrowth +
      sunHitBonus;

    cell.energy = clamp(cell.energy, 0, 4.5);

    cell.size = clamp(
      cell.size + activeGrowth * 0.12 + sunHitBonus * 0.04,
      0.78,
      1.45
    );

    cell.division = clamp(
      cell.division + activeGrowth * 0.08,
      0,
      1
    );

    // Kun lehti avautuu ensimmäisen kerran, anna +10 cm
    if ((cell.energy / 4.5) > 0.65 && !cell.leafOpened) {
      cell.leafOpened = true;

      state.bladeLength = clamp(
        state.bladeLength + 10 / 26,
        0,
        MAX_BLADE_LENGTH
      );

      navigator.vibrate?.(25);
    }

    totalActivation += activeGrowth;
  }

  active.energy = clamp(active.energy + 0.09 * dt, 0, 4.5);
  active.size = clamp(active.size + 0.06 * dt, 0.78, 1.55);

  return totalActivation;
}

function updateSunAlignmentMessages(params, currentTime) {
  if (params.sunAlignment > 0.95) {
    if (!state.lastPerfectAlignmentStart) {
      state.lastPerfectAlignmentStart = currentTime;
    }
    const perfectDuration = currentTime - state.lastPerfectAlignmentStart;
    if (perfectDuration > 0.5 && perfectDuration < TURN_DURATION - 0.1) {
      state.perfectAlignmentBonus += state.finalMaxHeight * 0.05;
      state.lastPerfectAlignmentStart = currentTime;
    }
  } else {
    state.lastPerfectAlignmentStart = null;
  }
  
  if (params.sunAlignment > 0.92) {
    if (currentTime - state.lastSunAlignmentMessage > 1.0) {
      state.lastSunAlignmentMessage = currentTime;
      if (params.sunAlignment > 0.92) {
        state.showingPerfectSunMessage = true;
        state.perfectSunMessageTime = currentTime;
      }
    }
  }
}

function getScoringAnimationProgress() {
  if (!state.isGameEnded) return 0;
  const elapsed = performance.now() / 1000 - state.gameEndTime;
  const duration = 3.5;
  const progress = Math.min(elapsed / duration, 1);
  return smootherstep(progress);
}

function getAnimatedFinalScore() {
  const progress = getScoringAnimationProgress();
  const animatedScore = Math.floor(state.finalScore * progress);
  return Math.min(animatedScore, state.finalScore);
}

function updateGame(dt) {
  if (state.isGameEnded) {
    const animProgress = getScoringAnimationProgress();

    if (animProgress >= 1 && !state.endScreenShown) {
      state.endScreenShown = true;
      showEndScreen();
    }
    return;
  }

  if (!state.running) return;

  state.turnTime += dt;
  state.activeCellIndex = state.selectedCellIndex;

  const params = getGrowthParameters();
  const currentTime = performance.now() / 1000;
  
  updateSunAlignmentMessages(params, currentTime);
  const activationGrowth = updateCellGrowth(dt);

  state.bladeAngularVelocity +=
    (params.targetAngle - state.bladeAngle) * 0.72 * dt;

  state.bladeAngularVelocity *= 0.9;
  state.bladeAngle += state.bladeAngularVelocity * dt;

  state.localBendVelocity +=
    ((params.localBendTarget || 0) - state.localBendStrength) * 2.4 * dt;

  state.localBendVelocity *= 0.86;
  state.localBendStrength += state.localBendVelocity * dt;
  state.localBendStrength = clamp(state.localBendStrength, -1.4, 1.4);

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

  state.straightness = calculateBladeStraightness();
  state.actualHeight = Math.round((130 + state.bladeLength * 26) * 0.15);

  const leafCount = state.cells.filter(c => (c.energy / 4.5) > 0.65).length;
  const leafBonusScore = leafCount * 10; 

  const heightBonus = state.actualHeight * 1.2;
  const straightnessBonus = state.straightness * state.straightness * 200;
  const straightnessPenalty = Math.max(0, 1 - state.straightness) * 80;
  const activeEnergy = params.cell ? params.cell.energy : 0;
  const sunBonus = params.sunAlignment * params.sunAlignment * 250;
  const stabilityBonus = Math.max(0, 1 - Math.abs(state.bladeAngle) * 0.35) * 40;
  const activeBonus = activeEnergy * 16;

  state.score = Math.floor(
    heightBonus + 
    leafBonusScore + 
    straightnessBonus - 
    straightnessPenalty + 
    sunBonus + 
    stabilityBonus + 
    activeBonus
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

function getNextSunAngle() {
  const minDistance = 30;

  function randomPlayableAngle() {
    return Math.random() < 0.5
      ? 300 + Math.random() * 60
      : Math.random() * 60;
  }

  function angularDistance(a, b) {
    const diff = Math.abs(a - b) % 360;
    return Math.min(diff, 360 - diff);
  }

  let nextAngle = randomPlayableAngle();

  for (let i = 0; i < 24; i++) {
    if (angularDistance(nextAngle, state.sunAngleDeg) >= minDistance) {
      return nextAngle;
    }
    nextAngle = randomPlayableAngle();
  }

  return nextAngle;
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

  state.sunAngleDeg = getNextSunAngle();
  state.selectedCellIndex = chooseNextSuggestedCell();
  state.activeCellIndex = state.selectedCellIndex;
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

    if (distance < bestDistance && distance < 46) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function handleCanvasPointer(event) {
  if (!state.running) return;

  event.preventDefault?.();
  const rect = canvas.getBoundingClientRect();

  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  const zoom = 1.0 - (state.bladeLength / MAX_BLADE_LENGTH) * 0.4;
  const zoomCenterX = rect.width * 0.5;
  const zoomCenterY = rect.height * 0.92;

  x = zoomCenterX + (x - zoomCenterX) / zoom;
  y = zoomCenterY + (y - zoomCenterY) / zoom;

  state.selectedCellIndex = pickClosestCell(x, y, rect.width, rect.height);
  state.activeCellIndex = state.selectedCellIndex;
}

function handleKeyboard(event) {
  if (!state.running || state.cells.length === 0) return;

  if (event.key === "ArrowLeft") {
    moveSelectionSide(-1);
    event.preventDefault();

  } else if (event.key === "ArrowRight") {
    moveSelectionSide(1);
    event.preventDefault();

  } else if (event.key === "ArrowUp") {
    moveSelectionByRow(1);
    event.preventDefault();

  } else if (event.key === "ArrowDown") {
    moveSelectionByRow(-1);
    event.preventDefault();
  }
}

function moveSelectionByRow(direction) {
  const current = state.cells[state.selectedCellIndex];
  if (!current) return;

  let bestIndex = state.selectedCellIndex;
  let bestScore = Infinity;

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];

    if (direction > 0 && cell.row <= current.row) continue;
    if (direction < 0 && cell.row >= current.row) continue;

    const rowDistance = Math.abs(cell.row - current.row);
    const colDistance = Math.abs(cell.col - current.col);
    const score = rowDistance * 10 + colDistance;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  state.selectedCellIndex = bestIndex;
  state.activeCellIndex = bestIndex;
  navigator.vibrate?.(10);
}

function moveSelectionSide(direction) {
  const current = state.cells[state.selectedCellIndex];
  if (!current) return;

  let bestIndex = state.selectedCellIndex;
  let bestScore = Infinity;

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];

    if (cell.row !== current.row) continue;
    if (direction > 0 && cell.col <= current.col) continue;
    if (direction < 0 && cell.col >= current.col) continue;

    const distance = Math.abs(cell.col - current.col);

    if (distance < bestScore) {
      bestScore = distance;
      bestIndex = i;
    }
  }

  state.selectedCellIndex = bestIndex;
  state.activeCellIndex = bestIndex;
  navigator.vibrate?.(10);
}

function cycleRowCell(direction = 1) {
  const current = state.cells[state.selectedCellIndex];
  if (!current) return;

  const rowCells = state.cells
    .map((cell, index) => ({ cell, index }))
    .filter(x => x.cell.row === current.row)
    .sort((a, b) => a.cell.col - b.cell.col);

  const currentPos = rowCells.findIndex(
    x => x.index === state.selectedCellIndex
  );

  if (currentPos === -1) return;

  const nextPos =
    (currentPos + direction + rowCells.length) % rowCells.length;

  state.selectedCellIndex = rowCells[nextPos].index;
  state.activeCellIndex = state.selectedCellIndex;

  navigator.vibrate?.(10);
}

function drawBackground(w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#8fd3ff");
  sky.addColorStop(0.48, "#d9f4ff");
  sky.addColorStop(1, "#f4fff1");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#9fd687";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.64);

  for (let x = 0; x <= w; x += 36) {
    ctx.lineTo(
      x,
      h * 0.64 + Math.sin(x * 0.012) * 18 + Math.cos(x * 0.006) * 12
    );
  }

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const ground = ctx.createLinearGradient(0, h * 0.62, 0, h);
  ground.addColorStop(0, "#7bd96b");
  ground.addColorStop(0.45, "#65bd56");
  ground.addColorStop(1, "#3f7f36");

  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  drawMeadowGrass(w, h);
  drawFlowerMeadow(w, h);
  drawButterflies(w, h);
  drawBee(w, h);
}

function drawMeadowGrass(w, h) {
  ctx.save();
  const startY = h * 0.66;
  const bladeCount = Math.floor(w / 9);

  for (let i = 0; i < bladeCount; i++) {
    const x = (i * 17) % w;
    const y = startY + ((i * 23) % Math.max(1, h * 0.32));
    const height = 12 + ((i * 11) % 28);
    const sway = Math.sin(performance.now() * 0.0012 + i) * 3;

    ctx.strokeStyle = i % 3 === 0
      ? "rgba(38, 118, 45, 0.55)"
      : "rgba(71, 150, 55, 0.46)";

    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + sway,
      y - height * 0.55,
      x + sway * 1.8,
      y - height
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlowerMeadow(w, h) {
  const flowerCount = Math.floor(clamp(w / 10, 36, 110));
  const colors = [
    "#ff6ba8",
    "#ffd84d",
    "#7bcfff",
    "#ff8f8f",
    "#bb88ff",
    "#ffffff"
  ];

  ctx.save();

  for (let i = 0; i < flowerCount; i++) {
    const x = (i * 113) % w;
    const baseY = h * 0.72 + ((i * 37) % Math.max(1, h * 0.24));
    const stemHeight = 18 + ((i * 7) % 30);
    const flowerSize = 3.5 + ((i * 5) % 5);
    const sway = Math.sin(performance.now() * 0.0015 + i * 0.6) * 2.2;

    ctx.strokeStyle = "rgba(37, 128, 48, 0.82)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(
      x + sway,
      baseY - stemHeight * 0.55,
      x + sway * 1.5,
      baseY - stemHeight
    );
    ctx.stroke();

    ctx.fillStyle = "rgba(70, 175, 73, 0.82)";
    ctx.beginPath();
    ctx.ellipse(
      x - 4,
      baseY - stemHeight * 0.46,
      5,
      2.5,
      -0.55,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      x + 5,
      baseY - stemHeight * 0.62,
      5,
      2.5,
      0.55,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const flowerX = x + sway * 1.5;
    const flowerY = baseY - stemHeight;

    for (let p = 0; p < 6; p++) {
      const angle = p * Math.PI / 3;
      ctx.fillStyle = colors[(i + p) % colors.length];

      ctx.beginPath();
      ctx.arc(
        flowerX + Math.cos(angle) * flowerSize,
        flowerY + Math.sin(angle) * flowerSize,
        flowerSize,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = "#ffef62";
    ctx.beginPath();
    ctx.arc(flowerX, flowerY, flowerSize * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawButterflies(w, h) {
  const t = performance.now() * 0.001;
  const butterflies = [
    { x: 0.18, y: 0.75, colorA: "#ff7ae8", colorB: "#ffd1f4", speed: 0.85 },
    { x: 0.43, y: 0.78, colorA: "#79a8ff", colorB: "#c9ddff", speed: 1.10 },
    { x: 0.64, y: 0.72, colorA: "#ffb347", colorB: "#ffe0a8", speed: 0.95 }
  ];

  for (let i = 0; i < butterflies.length; i++) {
    const b = butterflies[i];

    const x =
      w * b.x +
      Math.sin(t * b.speed + i * 1.7) * w * 0.06;

    const y =
      h * b.y +
      Math.cos(t * b.speed * 1.7 + i) * h * 0.025;

    const flap =
      7 +
      Math.sin(t * 18 + i * 2.1) * 6;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.8 + i) * 0.22);

    ctx.fillStyle = b.colorA;
    ctx.beginPath();
    ctx.ellipse(-7, 0, 10, Math.max(3, flap), 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.colorB;
    ctx.beginPath();
    ctx.ellipse(7, 0, 10, Math.max(3, flap), -0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(34, 28, 30, 0.95)";
    ctx.fillRect(-1.2, -7, 2.4, 14);

    ctx.strokeStyle = "rgba(34, 28, 30, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-4, -12);
    ctx.moveTo(0, -7);
    ctx.lineTo(4, -12);
    ctx.stroke();

    ctx.restore();
  }
}

function drawBee(w, h) {
  const t = performance.now() * 0.001;

  const x =
    w * 0.85 +
    Math.cos(t * 1.15) * w * 0.09 +
    Math.sin(t * 2.2) * w * 0.025;

  const y =
    h * 0.65 +
    Math.sin(t * 1.55) * h * 0.055;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.4) * 0.18);

  ctx.fillStyle = "rgba(255, 230, 80, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 25, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const wingFlap = Math.sin(t * 28) * 2.5;

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.strokeStyle = "rgba(170, 210, 220, 0.55)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.ellipse(-8, -10, 8, 4 + wingFlap, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(8, -10, 8, 4 - wingFlap, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffd000";
  ctx.strokeStyle = "rgba(45, 35, 20, 0.85)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(20, 20, 20, 0.9)";
  ctx.lineWidth = 2;

  for (let stripeX = -8; stripeX <= 8; stripeX += 6) {
    ctx.beginPath();
    ctx.moveTo(stripeX, -8);
    ctx.lineTo(stripeX, 8);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(35, 30, 22, 0.95)";
  ctx.beginPath();
  ctx.arc(14, -1, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(16, -3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(30, 25, 20, 0.9)";
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-22, -3);
  ctx.lineTo(-22, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
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

function drawBlade(w, h) {
  const baseX = w * 0.5;
  const baseY = h * 0.92;
  const lengthPx = 130 + state.bladeLength * 26;
  const path = getBladePath(baseX, baseY, lengthPx);

  drawBladeShadow(path, w, h);
  drawBladeSilhouette(path);
  drawCellsOnBlade(path);
  drawBladeVeins(path);
}

function drawBladeShadow(path, w, h) {
  if (!path || path.length < 2) return;

  const groundY = h * 0.92;
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  const shadowDirX = -Math.sin(sunAngleRad);
  const shadowDirY = 0.22;
  const projected = path.map((p) => {
    const heightAboveGround = Math.max(0, groundY - p.y);
    const projection = heightAboveGround * 0.58;
    return {
      x: p.x + shadowDirX * projection,
      y: groundY + shadowDirY * projection,
      width: Math.max(3, p.width * (0.3 + p.progress * 0.35)),
      angle: p.angle,
      progress: p.progress,
    };
  });

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = "blur(2.2px)";
  ctx.strokeStyle = "rgba(29, 70, 28, 0.24)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 1; i < projected.length; i++) {
    const a = projected[i - 1];
    const b = projected[i];
    ctx.lineWidth = lerp(a.width, b.width, 0.5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const base = path[0];
  ctx.filter = "blur(3px)";
  ctx.fillStyle = "rgba(25, 60, 24, 0.26)";
  ctx.beginPath();
  ctx.ellipse(base.x + shadowDirX * 14, groundY + 3, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

function drawSprout(ctx, cellWidth, cellHeight, cellColor, i) {
    ctx.save();
    const side = (i % 2 === 0) ? 1 : -1; 
    ctx.translate(side * cellWidth * 0.5, 0);
    ctx.rotate(side * -Math.PI / 6); 
    
    ctx.fillStyle = "#86c85b";
    ctx.strokeStyle = "#1a3d12";
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 15, -20, side * 45, 0);
    ctx.quadraticCurveTo(side * 15, 20, 0, 0);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(side * 35, 0);
    ctx.stroke();
    ctx.restore();
}

function drawCellsOnBlade(path) {
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  ctx.save();
  ctx.strokeStyle = "rgba(165, 210, 120, 0.15)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < state.cells.length - 1; i++) {
    const cell1 = state.cells[i];
    const cell2 = state.cells[i + 1];
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

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const pos = getCellScreenPosition(cell, path);
    const exposure = getLightExposure(cell, cell.positionAlongBlade, sunAngleRad);
    const activeInfluence = getActiveInfluence(cell);
    const isSelected = state.selectedCellIndex === i;
    const isActive = state.activeCellIndex === i;

    const energyLevel = cell.energy / 4.5;
    const saturation = cell.isStrong ? 98 : 76;
    const energyEffect = energyLevel * 15;
    const twistBoost = Math.abs(cell.offsetFromCenter) * 16;
    const lightness = clamp(
      42 + exposure * 28 + energyEffect + activeInfluence * 12 + twistBoost,
      38,
      94
    );

    const hueShift = (cell.offsetFromCenter * 3 + cell.progress * 2) % 20;
    const cellColor = `hsl(${92 + hueShift}, ${saturation}%, ${lightness}%)`;

    const rowHeight = (130 + state.bladeLength * 26) / CELL_ROWS * 0.82;
    const cellWidth = Math.max(13.5, pos.width * 0.54 * cell.size * (0.92 + pos.visibleSide * 0.38));
    const cellHeight = Math.max(14.2, rowHeight * cell.size * (0.92 + exposure * 0.16));

    const cellTwistContribution = (getCellTwistDegrees(cell) * Math.PI) / 180;
    const twistIntensity = Math.abs(cellTwistContribution);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.angle + Math.PI / 2 + pos.twist * 1.2 + cell.offsetFromCenter * 0.24);

    if (energyLevel > 0.6) {
      const glowPulse = Math.sin(performance.now() * 0.008) * 5;
      ctx.shadowColor = energyLevel > 0.9 ? "#fffb00" : "#ccff00";
      ctx.shadowBlur = (10 + glowPulse) * energyLevel;
    } else {
      ctx.shadowColor = `rgba(92, 180, 50, ${0.4 * exposure})`;
      ctx.shadowBlur = 4;
    }

    ctx.fillStyle = cellColor;
    ctx.strokeStyle = `rgba(21, 64, 25, ${isActive ? 0.95 : 0.75})`;
    ctx.lineWidth = isActive ? 2.2 : 1.4;

    drawRoundedCell(0, 0, cellWidth, cellHeight, 3.2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (energyLevel > 0.65) {
      drawSprout(ctx, cellWidth, cellHeight, cellColor, i);
    }

    ctx.fillStyle = `rgba(255,255,255,${0.18 + exposure * 0.24})`;
    drawRoundedCell(-cellWidth * 0.18, -cellHeight * 0.24, cellWidth * 0.52, cellHeight * 0.38, 2.6);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${0.08 + exposure * 0.12})`;
    ctx.beginPath();
    ctx.arc(-cellWidth * 0.28, cellHeight * 0.18, cellWidth * 0.12, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected || isActive) {
      ctx.strokeStyle = isActive ? "rgba(100, 200, 255, 0.95)" : "rgba(150, 220, 255, 0.78)";
      ctx.lineWidth = isActive ? 2.6 : 1.9;
      drawRoundedCell(0, 0, cellWidth + 3.2, cellHeight + 3.2, 3.2);
      ctx.stroke();

      if (isActive) {
        ctx.strokeStyle = "rgba(100, 200, 255, 0.45)";
        ctx.lineWidth = 5;
        ctx.shadowColor = "rgba(100, 200, 255, 0.6)";
        ctx.shadowBlur = 8;
        drawRoundedCell(0, 0, cellWidth + 8, cellHeight + 8, 4);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const twistIndicatorRadius = cellWidth * 0.6 + twistIntensity * 12;
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 + twistIntensity * 0.5})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, twistIndicatorRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

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

function drawGlassPanel(x, y, width, height, radius = 12) {
  ctx.save();
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "rgba(248, 255, 248, 0.72)");
  gradient.addColorStop(1, "rgba(216, 244, 209, 0.50)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
  ctx.lineWidth = 1.4;
  ctx.shadowColor = "rgba(35, 86, 35, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSunDirectionHud(w, h, params, active) {
  const size = clamp(w * 0.15, 118, 178);
  const x = w - size - w * 0.025;
  const y = h * 0.035;
  const cx = x + size * 0.5;
  const cy = y + size * 0.55;
  const r = size * 0.29;
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  drawGlassPanel(x, y, size, size, 16);

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(28, 54, 43, 0.92)";
  ctx.font = "800 13px Manrope, sans-serif";
  ctx.fillText("SUN DIRECTION", cx, y + 24);

  ctx.strokeStyle = "rgba(33, 63, 51, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(28, 54, 43, 0.86)";
  ctx.font = "700 12px Manrope, sans-serif";
  ctx.fillText("N", cx, cy - r - 7);
  ctx.fillText("S", cx, cy + r + 15);
  ctx.fillText("W", cx - r - 13, cy + 4);
  ctx.fillText("E", cx + r + 13, cy + 4);

  const arrowX = cx + Math.sin(sunAngleRad) * r;
  const arrowY = cy - Math.cos(sunAngleRad) * r;
  ctx.strokeStyle = "#ffd51f";
  ctx.fillStyle = "#ffd51f";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(arrowX, arrowY);
  ctx.stroke();

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(sunAngleRad);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-5, 4);
  ctx.lineTo(5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.shadowColor = "rgba(255, 220, 66, 0.8)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(arrowX, arrowY, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#fff36d";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSideInfoHud(w, h, params, active) {
  const x = w - clamp(w * 0.13, 108, 150) - w * 0.025;
  const y = h * 0.28;
  const width = clamp(w * 0.13, 108, 150);
  const height = 132;

  drawGlassPanel(x, y, width, height, 14);

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(28, 54, 43, 0.82)";
  ctx.font = "800 12px Manrope, sans-serif";
  ctx.fillText("ANGLE", x + width / 2, y + 27);
  ctx.fillStyle = "rgba(23, 45, 34, 0.96)";
  ctx.font = "800 24px Manrope, sans-serif";
  ctx.fillText(`${Math.round((state.bladeAngle * 180) / Math.PI)}°`, x + width / 2, y + 57);

  ctx.strokeStyle = "rgba(50, 98, 60, 0.18)";
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 75);
  ctx.lineTo(x + width - 18, y + 75);
  ctx.stroke();

  ctx.fillStyle = "rgba(28, 54, 43, 0.82)";
  ctx.font = "800 12px Manrope, sans-serif";
  ctx.fillText("HEIGHT", x + width / 2, y + 97);
  ctx.fillStyle = "rgba(23, 45, 34, 0.96)";
  ctx.font = "800 24px Manrope, sans-serif";
  ctx.fillText(`${state.actualHeight}cm`, x + width / 2, y + 123);
  ctx.restore();
}

function drawHud(w, h) {
  const params = getGrowthParameters();
  const active = getActiveCell();
  const pad = w * 0.025;
  const panelW = clamp(w * 0.22, 250, 370);
  const panelH = 72;
  const x = pad;
  const y = h * 0.035;

  drawGlassPanel(x, y, panelW, panelH, 14);

  ctx.save();
  const colW = panelW / 3;
  const labels = ["TIME", "MONTH", "SCORE"];
  const values = [
    `${Math.max(0, Math.ceil(TURN_DURATION - state.turnTime))}s`,
    `${state.turn}/${GAME_TURNS}`,
    state.score.toLocaleString(),
  ];

  ctx.textAlign = "center";
  for (let i = 0; i < 3; i++) {
    const cx = x + colW * (i + 0.5);
    ctx.fillStyle = "rgba(28, 54, 43, 0.78)";
    ctx.font = "800 12px Manrope, sans-serif";
    ctx.fillText(labels[i], cx, y + 24);
    ctx.fillStyle = i === 2 ? "#f2a900" : "rgba(20, 38, 31, 0.96)";
    ctx.font = "800 26px Manrope, sans-serif";
    ctx.fillText(values[i], cx, y + 54);

    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(x + colW * i, y + 16);
      ctx.lineTo(x + colW * i, y + panelH - 16);
      ctx.stroke();
    }
  }
  ctx.restore();

  drawSunDirectionHud(w, h, params, active);
  drawSideInfoHud(w, h, params, active);
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
  const hudSize = clamp(w * 0.12, 118, 150);
  const hudMargin = w * 0.025;
  const hudX = hudMargin;
  const hudY = h - hudSize - h * 0.06;
  const cornerRadius = 12;
  const sunAngleRad = (state.sunAngleDeg * Math.PI) / 180;

  ctx.save();
  drawGlassPanel(hudX, hudY, hudSize, hudSize, cornerRadius);

  const hudCenterX = hudX + hudSize * 0.5;
  const hudCenterY = hudY + hudSize * 0.5;

  const rayLength = hudSize * 0.78;
  ctx.save();
  ctx.translate(hudCenterX, hudCenterY);
  ctx.rotate(sunAngleRad);
  ctx.strokeStyle = "rgba(255, 214, 45, 0.78)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -rayLength * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 235, 76, 0.92)";
  ctx.shadowColor = "rgba(255, 220, 66, 0.72)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, -rayLength * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(hudCenterX, hudCenterY);
  ctx.rotate(state.bladeAngle);

  const bladeWidth = hudSize * 0.52;
  const bladeLength = hudSize * 0.72;

  const bladeGradientTopDown = ctx.createLinearGradient(0, -bladeLength * 0.5, 0, bladeLength * 0.5);
  bladeGradientTopDown.addColorStop(0, "rgba(86, 148, 52, 0.70)");
  bladeGradientTopDown.addColorStop(0.5, "rgba(108, 180, 66, 0.92)");
  bladeGradientTopDown.addColorStop(1, "rgba(133, 200, 78, 0.72)");

  ctx.fillStyle = bladeGradientTopDown;
  ctx.beginPath();
  ctx.moveTo(-bladeWidth * 0.5, -bladeLength * 0.5);
  ctx.lineTo(bladeWidth * 0.5, -bladeLength * 0.5);
  ctx.lineTo(bladeWidth * 0.48, bladeLength * 0.5);
  ctx.lineTo(-bladeWidth * 0.48, bladeLength * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(30, 60, 30, 0.50)";
  ctx.lineWidth = 1;
  for (let stripe = 0; stripe < 4; stripe++) {
    const stripeX = (stripe - 1.5) * (bladeWidth * 0.18);
    ctx.beginPath();
    for (let i = 0; i <= bladeLength; i += 3) {
      const yy = -bladeLength * 0.5 + i;
      const progress = i / bladeLength;
      const twistShift = Math.sin(state.bladeTwist * progress) * bladeWidth * 0.12;
      if (i === 0) ctx.moveTo(stripeX + twistShift, yy);
      else ctx.lineTo(stripeX + twistShift, yy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const cellY = -bladeLength * 0.5 + cell.positionAlongBlade * bladeLength;
    const cellX = cell.offsetFromCenter * bladeWidth * 0.4;
    const cellRadius = cell.size * 3.2 + 1.4;
    const isActive = state.activeCellIndex === i;

    if (isActive) {
      ctx.fillStyle = "rgba(255, 238, 72, 0.80)";
      ctx.beginPath();
      ctx.arc(cellX, cellY, cellRadius + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const cellOpacity = 0.35 + Math.min(cell.energy / 4.5, 1) * 0.55;
    ctx.fillStyle = `hsla(92, 85%, 55%, ${cellOpacity})`;
    ctx.beginPath();
    ctx.arc(cellX, cellY, cellRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(36, 72, 47, 0.34)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, bladeWidth * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(28, 54, 43, 0.88)";
  ctx.font = "800 12px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(getGrowthParameters().sunAlignment * 100)}% sun`, hudX + hudSize / 2, hudY + hudSize - 10);
  ctx.restore();
}

function drawSunAlignmentMessages(w, h, params) {
  const currentTime = performance.now() / 1000;
  
  if (params.sunAlignment > 0.92) {
    const timeSinceMessage = currentTime - state.perfectSunMessageTime;
    if (timeSinceMessage < 2.0) {
      const alpha = 1 - Math.min(timeSinceMessage / 2.0, 1) * 0.5;
      const pulse = 1 + Math.sin(timeSinceMessage * 6) * 0.1;
      
      ctx.save();
      ctx.font = "900 3rem Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
      ctx.shadowColor = `rgba(255, 165, 0, ${alpha * 0.8})`;
      ctx.shadowBlur = 20 * pulse;
      ctx.fillText("🌞 PERFECT POSITION TOWARDS SUN 🌞", w * 0.5, h * 0.3);
      ctx.font = "700 1.5rem Manrope, sans-serif";
      ctx.fillStyle = `rgba(150, 220, 100, ${alpha * 0.9})`;
      ctx.shadowBlur = 12 * pulse;
      ctx.fillText("⚡ MAXIMUM GROWTH RATE ⚡", w * 0.5, h * 0.38);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  } 
  else if (params.sunAlignment > 0.65) {
    const timeSinceMessage = currentTime - state.lastSunAlignmentMessage;
    if (timeSinceMessage < 1.2) {
      const alpha = Math.max(0, 1 - timeSinceMessage / 1.2);
      ctx.save();
      ctx.font = "800 2.2rem Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 180, 80, ${alpha * 0.9})`;
      ctx.shadowColor = `rgba(255, 140, 0, ${alpha * 0.7})`;
      ctx.shadowBlur = 15;
      ctx.fillText("↻ TURNING TOWARDS SUN ↻", w * 0.5, h * 0.3);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}

function drawEndGameAnimation(w, h) {
  if (!state.isGameEnded) return;

  const animProgress = getScoringAnimationProgress();
  const animatedScore = getAnimatedFinalScore();

  const titleFont = Math.max(24, Math.min(52, w * 0.085));
  const scoreFont = Math.max(42, Math.min(72, w * 0.14));
  const labelFont = Math.max(16, Math.min(24, w * 0.045));

  const centerX = w * 0.5;
  const centerY = h * 0.5;

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * animProgress})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  if (animProgress > 0.1) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const scale = 0.85 + animProgress * 0.25;

    ctx.save();
    ctx.translate(centerX, centerY - 95);
    ctx.scale(scale, scale);

    ctx.font = `900 ${titleFont}px Manrope, sans-serif`;
    ctx.fillStyle = "rgba(255, 215, 0, 1)";
    ctx.shadowColor = "rgba(255, 140, 0, 0.8)";
    ctx.shadowBlur = 24;
    ctx.fillText("HARVEST", 0, -titleFont * 0.42);
    ctx.fillText("COMPLETE", 0, titleFont * 0.62);

    ctx.restore();

    ctx.font = `800 ${scoreFont}px Manrope, sans-serif`;
    ctx.fillStyle = "rgba(200, 255, 100, 1)";
    ctx.shadowColor = "rgba(100, 200, 50, 0.6)";
    ctx.shadowBlur = 24;
    ctx.fillText(animatedScore.toLocaleString(), centerX, centerY + 20);

    ctx.font = `700 ${labelFont}px Manrope, sans-serif`;
    ctx.fillStyle = "rgba(150, 220, 100, 0.9)";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillText("CENTIMETERS", centerX, centerY + 75);

    ctx.restore();
  }
}

function drawCountdownMessage(w, h) {
  if (!state.running || state.isGameEnded || state.turn !== GAME_TURNS) return;
  
  const timeLeft = TURN_DURATION - state.turnTime;
  
  if (timeLeft < 5 && timeLeft > 0) {
    const pulse = 0.5 + Math.sin(timeLeft * Math.PI * 4) * 0.5;
    const alphaIntensity = 0.6 + pulse * 0.4;
    
    ctx.save();
    ctx.font = "800 2rem Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(200, 255, 150, ${alphaIntensity})`;
    ctx.shadowColor = `rgba(100, 200, 100, ${alphaIntensity * 0.8})`;
    ctx.shadowBlur = 15;
    
    ctx.fillText("📏 STRAIGHTEN FOR MEASUREMENT 📏", w * 0.5, h * 0.25);
    
    ctx.font = "700 1.3rem Manrope, sans-serif";
    ctx.fillStyle = `rgba(255, 200, 100, ${alphaIntensity})`;
    ctx.shadowColor = `rgba(255, 150, 0, ${alphaIntensity * 0.8})`;
    ctx.fillText(`${Math.ceil(timeLeft)}s`, w * 0.5, h * 0.35);
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function draw() {
  ensureCanvasSize();

  const bounds = canvas.getBoundingClientRect();
  const w = bounds.width;
  const h = bounds.height;

  ctx.clearRect(0, 0, w, h);

  drawBackground(w, h);
  drawSunArc(w, h);

  const zoom = 1.0 - (state.bladeLength / MAX_BLADE_LENGTH) * 0.4;
  const zoomCenterX = w * 0.5;
  const zoomCenterY = h * 0.92;

  ctx.save();
  ctx.translate(zoomCenterX, zoomCenterY);
  ctx.scale(zoom, zoom);
  ctx.translate(-zoomCenterX, -zoomCenterY);

  drawCenterLine(w, h);
  drawBlade(w, h);
  drawGridLines(w, h);

  ctx.restore();

  if (state.running || state.isGameEnded) {
    if (state.running) {
      const params = getGrowthParameters();
      drawHud(w, h);
      drawTopDownHUD(w, h);
      drawSunAlignmentMessages(w, h, params);
      drawCountdownMessage(w, h);
    }
  }
  
  if (state.isGameEnded) {
    if (state.finalMaxHeight === 0 && state.finalEffectiveHeight === 0) {
      state.finalMaxHeight = state.actualHeight;
      state.finalEffectiveHeight = calculateEffectiveBladeHeight(w, h);
      state.finalStraightness = state.straightness;
      
      const finalScore = Math.floor(
        state.finalEffectiveHeight + 
        (state.finalStraightness * state.finalStraightness * (state.finalMaxHeight * 0.1)) +
        Math.min(state.perfectAlignmentBonus, state.finalMaxHeight * 0.05)
      );
      if (!state.hallRecorded) {
        recordHallOfFame(finalScore);
        state.hallRecorded = true;
      }
    }
    drawEndGameAnimation(w, h);
  }
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTimestamp) / 1000 || 0);
  state.lastTimestamp = timestamp;

  updateGame(dt);
  draw();

  window.requestAnimationFrame(loop);
}

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener("touchstart", (e) => {
  if (!state.running) return;

  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  if (!state.running) return;

  const t = e.changedTouches[0];

  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  const tapDuration =
    Date.now() - touchStartTime;

  const TAP_LIMIT = 14;
  const SWIPE_LIMIT = 28;

  // NAPAUTUS
  if (
    absX < TAP_LIMIT &&
    absY < TAP_LIMIT &&
    tapDuration < 220
  ) {
    cycleRowCell(1);
    return;
  }

  // VAAKA
  if (
    absX > SWIPE_LIMIT &&
    absX > absY
  ) {
    if (dx > 0) {
      moveSelectionSide(1);
    } else {
      moveSelectionSide(-1);
    }
    return;
  }

  // PYSTY
  if (
    absY > SWIPE_LIMIT &&
    absY > absX
  ) {
    if (dy < 0) {
      moveSelectionByRow(1);
    } else {
      moveSelectionByRow(-1);
    }

    return;
  }
}, { passive:true });

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function toggleFullscreen() {
  const container = document.getElementById("gameContainer") || canvas.parentElement;

  // iPhone / iOS fallback
  if (isIOS()) {
  document.body.classList.toggle("ios-fake-fullscreen");

  setTimeout(() => {
    ensureCanvasSize();
    draw();
  }, 120);

  return;
}

  const fullscreenElement =
    document.fullscreenElement ||
    document.webkitFullscreenElement;

  if (!fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function clearHallOfFame() {
  saveHallOfFame([]);
  renderHallOfFame([]);
}

function init() {
  installLayoutFixes();
  setStartMode(true);
  renderHallOfFame();
  showStartScreen();
  ensureCanvasSize();

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

  canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  handleCanvasPointer(event);
});
  
  canvas.addEventListener("pointermove", (event) => {
    if ((event.buttons || event.pointerType === "touch" || event.pointerType === "pen") && state.running) {
      handleCanvasPointer(event);
    }
  });
  
  window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    ensureCanvasSize();
    draw();
  }, 250);
});

  window.addEventListener("keydown", handleKeyboard);
  if (resetBtn) resetBtn.addEventListener("click", startGame);
  if (hallBtn) hallBtn.addEventListener("click", () => toggleHallPanel());
  if (clearHallBtn) clearHallBtn.addEventListener("click", clearHallOfFame);

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", toggleFullscreen);
    fullscreenBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      toggleFullscreen();
    }, { passive: false });
  }

  window.requestAnimationFrame((timestamp) => {
    state.lastTimestamp = timestamp;
    loop(timestamp);
  });
}

window.addEventListener("load", init);
