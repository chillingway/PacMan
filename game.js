const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const highScoreEl = document.querySelector("#highScore");
const levelEl = document.querySelector("#level");
const messageEl = document.querySelector("#message");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const mobileButtons = document.querySelectorAll("[data-dir]");

const tile = 8;
const cols = 28;
const rows = 36;
const directionVectors = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  none: { x: 0, y: 0 },
};
const opposite = { left: "right", right: "left", up: "down", down: "up", none: "none" };
const keyDirections = {
  ArrowLeft: "left",
  Left: "left",
  37: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  Right: "right",
  39: "right",
  d: "right",
  D: "right",
  ArrowUp: "up",
  Up: "up",
  38: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  Down: "down",
  40: "down",
  s: "down",
  S: "down",
};

const rawMaze = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "     #.## ###--### ##.#     ",
  "######.## #      # ##.######",
  "      .   #      #   .      ",
  "######.## #      # ##.######",
  "     #.## ######## ##.#     ",
  "     #.##          ##.#     ",
  "     #.## ######## ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o..##................##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
  "############################",
  "############################",
  "############################",
  "############################",
  "############################",
  "############################",
];

const colors = {
  blinky: "#ff3838",
  pinky: "#ff9ad5",
  inky: "#47e6ff",
  clyde: "#ffb347",
  frightened: "#264bff",
  flash: "#f4f4ff",
  eyes: "#d8f0ff",
};

const ghostHouseCenter = { x: 14, y: 14 };
const ghostHouseExit = { x: 14, y: 11 };
const ghostRespawnSeconds = 10;

let maze;
let pellets;
let pelletCount;
let score;
let highScore = Number(localStorage.getItem("pacHighScore") || 0);
let level;
let lives;
let running;
let readyTimer;
let modeTimer;
let modeIndex;
let ghostCombo;
let fruit;
let fruitSpawned;
let lastTime;
let audioContext;

let pacman;
let ghosts;

function makeMaze() {
  maze = rawMaze.map((line) => line.split(""));
  pellets = new Set();
  pelletCount = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = maze[y][x];
      if (cell === "." || cell === "o") {
        pellets.add(`${x},${y}`);
        pelletCount += 1;
      }
    }
  }
}

function centerOf(tileX, tileY) {
  return { x: tileX * tile + tile / 2, y: tileY * tile + tile / 2 };
}

function tileOf(actor) {
  return {
    x: Math.round((actor.x - tile / 2) / tile),
    y: Math.round((actor.y - tile / 2) / tile),
  };
}

function tileAtPoint(x, y) {
  return { x: Math.floor(x / tile), y: Math.floor(y / tile) };
}

function isWallTile(x, y) {
  if (x < 0 || x >= cols) return false;
  if (y < 0 || y >= rows) return true;
  return maze[y][x] === "#";
}

function isGateTile(x, y) {
  return y >= 0 && y < rows && x >= 0 && x < cols && maze[y][x] === "-";
}

function isBlockedTile(x, y, allowGate = false) {
  if (x < 0 || x >= cols) return false;
  if (y < 0 || y >= rows) return true;
  return isWallTile(x, y) || (!allowGate && isGateTile(x, y));
}

function canMove(actor, dir, allowGate = false) {
  if (dir === "none") return true;
  const vector = directionVectors[dir];
  const current = tileOf(actor);
  const nextX = current.x + vector.x;
  const nextY = current.y + vector.y;
  if (nextX < 0 || nextX >= cols) return current.y === 14;
  if (isWallTile(nextX, nextY)) return false;
  if (isGateTile(nextX, nextY) && !allowGate) return false;
  return true;
}

function aligned(actor) {
  const pos = tileOf(actor);
  const center = centerOf(pos.x, pos.y);
  return Math.abs(actor.x - center.x) < 1.4 && Math.abs(actor.y - center.y) < 1.4;
}

function snapToTile(actor) {
  const pos = tileOf(actor);
  const center = centerOf(pos.x, pos.y);
  actor.x = center.x;
  actor.y = center.y;
}

function nearTileCenter(actor, margin) {
  const pos = tileOf(actor);
  const center = centerOf(pos.x, pos.y);
  return Math.abs(actor.x - center.x) <= margin && Math.abs(actor.y - center.y) <= margin;
}

function snapToMovementLane(actor) {
  if (actor.dir === "left" || actor.dir === "right") {
    const pos = tileOf(actor);
    actor.y = centerOf(pos.x, pos.y).y;
  }
  if (actor.dir === "up" || actor.dir === "down") {
    const pos = tileOf(actor);
    actor.x = centerOf(pos.x, pos.y).x;
  }
}

function moveActor(actor, dir, distance, allowGate = false) {
  if (dir === "none") return;
  const vector = directionVectors[dir];
  const pos = tileOf(actor);
  const center = centerOf(pos.x, pos.y);
  const axis = vector.x ? "x" : "y";
  const next = actor[axis] + vector[axis] * distance;
  const centerValue = center[axis];
  const movingPastCenter =
    (vector[axis] < 0 && next <= centerValue) || (vector[axis] > 0 && next >= centerValue);

  snapToMovementLane(actor);

  if (!canMove(actor, dir, allowGate)) {
    if (movingPastCenter || Math.abs(actor[axis] - centerValue) <= distance + 0.05) {
      actor.x = center.x;
      actor.y = center.y;
      actor.dir = "none";
      return;
    }
    actor[axis] = next;
    return;
  }

  let nextX = actor.x + vector.x * distance;
  let nextY = actor.y + vector.y * distance;
  if (nextX < -tile / 2) nextX = cols * tile + tile / 2;
  if (nextX > cols * tile + tile / 2) nextX = -tile / 2;

  const nextTile = tileAtPoint(nextX, nextY);
  if (isBlockedTile(nextTile.x, nextTile.y, allowGate)) {
    const stop = centerOf(nextTile.x - vector.x, nextTile.y - vector.y);
    actor.x = stop.x;
    actor.y = stop.y;
    actor.dir = "none";
    return;
  }

  actor.x = nextX;
  actor.y = nextY;
}

function resetActors() {
  pacman = {
    ...centerOf(14, 22),
    dir: "none",
    wantedDir: "left",
    speed: 76 + Math.min(18, (level - 1) * 2.2),
    mouth: 0,
    stepTarget: null,
    queuedDir: null,
  };
  ghosts = [
    makeGhost("blinky", "Blinky", 13, 11, "left", colors.blinky, { x: 25, y: 0 }),
    makeGhost("pinky", "Pinky", 14, 14, "up", colors.pinky, { x: 2, y: 0 }),
    makeGhost("inky", "Inky", 12, 14, "up", colors.inky, { x: 27, y: 35 }),
    makeGhost("clyde", "Clyde", 15, 14, "up", colors.clyde, { x: 0, y: 35 }),
  ];
  readyTimer = 1.6;
  ghostCombo = 0;
  setMessage("READY!");
}

function makeGhost(id, name, x, y, dir, color, scatterTarget) {
  return {
    id,
    name,
    ...centerOf(x, y),
    start: centerOf(x, y),
    dir,
    color,
    scatterTarget,
    mode: id === "blinky" ? "scatter" : "house",
    releaseTimer: { blinky: 0, pinky: 0.8, inky: 1.8, clyde: 3 }[id],
    respawnTimer: 0,
    eaten: false,
  };
}

function startGame() {
  score = 0;
  level = 1;
  lives = 3;
  fruit = null;
  fruitSpawned = 0;
  modeIndex = 0;
  modeTimer = scatterDuration();
  running = true;
  makeMaze();
  resetActors();
  updateHud();
}

function nextLevel() {
  level += 1;
  fruit = null;
  fruitSpawned = 0;
  modeIndex = 0;
  modeTimer = scatterDuration();
  makeMaze();
  resetActors();
  updateHud();
}

function restartRound() {
  lives -= 1;
  if (lives <= 0) {
    running = false;
    setMessage("GAME OVER");
    updateHud();
    return;
  }
  resetActors();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  levelEl.textContent = level;
}

function addScore(points) {
  score += points;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("pacHighScore", String(highScore));
  }
  updateHud();
}

function setMessage(text) {
  messageEl.textContent = text;
}

function scatterDuration() {
  return Math.max(4, 7 - Math.floor((level - 1) / 2));
}

function chaseDuration() {
  return 20;
}

function frightenedDuration() {
  return Math.max(4.4, (7 - (level - 1) * 0.55) * 2);
}

function globalGhostMode() {
  return modeIndex % 2 === 0 ? "scatter" : "chase";
}

function fruitForLevel() {
  if (level === 1) return { label: "cherry", points: 100, color: "#ff3154" };
  if (level === 2) return { label: "strawberry", points: 300, color: "#ff5f93" };
  if (level <= 4) return { label: "orange", points: 500, color: "#ff9d2d" };
  if (level <= 6) return { label: "apple", points: 700, color: "#f24848" };
  if (level <= 8) return { label: "pineapple", points: 1000, color: "#ffd94a" };
  return { label: "key", points: 2000, color: "#7df7ff" };
}

function update(dt) {
  if (!running) return;
  if (readyTimer > 0) {
    readyTimer -= dt;
    if (readyTimer <= 0) setMessage("GO!");
    return;
  }

  updateMode(dt);
  updatePacman(dt);
  updateGhosts(dt);
  updateFruit(dt);
  checkCollisions();
}

function updateMode(dt) {
  if (ghosts.some((ghost) => ghost.mode === "frightened")) return;
  modeTimer -= dt;
  if (modeTimer > 0) return;
  modeIndex += 1;
  modeTimer = globalGhostMode() === "scatter" ? scatterDuration() : chaseDuration();
  for (const ghost of ghosts) {
    if (ghost.mode !== "house" && ghost.mode !== "eaten" && ghost.mode !== "respawning") ghost.dir = opposite[ghost.dir];
  }
}

function updatePacman(dt) {
  const step = pacman.speed * dt;
  if (!pacman.stepTarget) {
    snapToTile(pacman);
    eatPellet();
    if (pacman.queuedDir) {
      const nextDir = pacman.queuedDir;
      pacman.queuedDir = null;
      requestPacmanStep(nextDir);
    }
    pacman.mouth += dt * 11;
    return;
  }

  const vector = directionVectors[pacman.dir];
  const axis = vector.x ? "x" : "y";
  const before = Math.abs(pacman.stepTarget[axis] - pacman[axis]);
  moveActor(pacman, pacman.dir, step);
  const after = Math.abs(pacman.stepTarget[axis] - pacman[axis]);
  if (after <= 0.2 || after > before) {
    pacman.x = pacman.stepTarget.x;
    pacman.y = pacman.stepTarget.y;
    pacman.stepTarget = null;
    pacman.dir = "none";
    eatPellet();
    if (pacman.queuedDir) {
      const nextDir = pacman.queuedDir;
      pacman.queuedDir = null;
      requestPacmanStep(nextDir);
    }
  }
  pacman.mouth += dt * 11;
}

function eatPellet() {
  const pos = tileOf(pacman);
  const key = `${pos.x},${pos.y}`;
  if (!pellets.has(key)) return;
  const cell = maze[pos.y][pos.x];
  pellets.delete(key);
  pelletCount -= 1;
  if (cell === "o") {
    addScore(50);
    triggerFrightened();
    playTone(150, 0.09, "square", 0.05);
  } else {
    addScore(10);
    playTone(520 + (score % 4) * 80, 0.025, "square", 0.025);
  }
  if (pelletCount === 0) nextLevel();
}

function triggerFrightened() {
  ghostCombo = 0;
  for (const ghost of ghosts) {
    if (ghost.mode === "eaten" || ghost.mode === "house" || ghost.mode === "respawning") continue;
    ghost.mode = "frightened";
    ghost.frightenedTimer = frightenedDuration();
    ghost.dir = opposite[ghost.dir];
  }
}

function updateGhosts(dt) {
  for (const ghost of ghosts) {
    if (ghost.mode === "house") {
      ghost.releaseTimer -= dt;
      ghost.y += Math.sin(performance.now() / 170 + ghost.x) * dt * 10;
      if (ghost.releaseTimer <= 0) {
        ghost.mode = globalGhostMode();
        ghost.x = centerOf(14, 11).x;
        ghost.y = centerOf(14, 11).y;
        ghost.dir = "left";
      }
      continue;
    }
    if (ghost.mode === "respawning") {
      ghost.respawnTimer -= dt;
      const house = centerOf(ghostHouseCenter.x, ghostHouseCenter.y);
      ghost.x = house.x;
      ghost.y = house.y + Math.sin(performance.now() / 170 + ghost.x) * 2;
      if (ghost.respawnTimer <= 0) {
        const exit = centerOf(ghostHouseExit.x, ghostHouseExit.y);
        ghost.mode = globalGhostMode();
        ghost.x = exit.x;
        ghost.y = exit.y;
        ghost.dir = "left";
        ghost.eaten = false;
      }
      continue;
    }
    if (ghost.mode === "frightened") {
      ghost.frightenedTimer -= dt;
      if (ghost.frightenedTimer <= 0) ghost.mode = globalGhostMode();
    }
    if (aligned(ghost) || ghost.dir === "none") {
      snapToTile(ghost);
      ghost.dir = chooseGhostDirection(ghost);
    }
    const speed = ghostSpeed(ghost);
    moveActor(ghost, ghost.dir, speed * dt, ghost.mode === "eaten");
  }
}

function ghostSpeed(ghost) {
  if (ghost.mode === "eaten") return Math.max(118, pacman.speed * 1.35);
  if (ghost.mode === "frightened") return Math.max(46, pacman.speed * 0.68);
  return Math.max(62, pacman.speed * 0.9);
}

function chooseGhostDirection(ghost) {
  const pos = tileOf(ghost);
  if (ghost.mode === "eaten" && Math.abs(pos.x - 14) <= 1 && Math.abs(pos.y - 14) <= 2) {
    ghost.mode = globalGhostMode();
    ghost.eaten = false;
  }
  const options = ["up", "left", "down", "right"].filter((dir) => {
    if (dir === opposite[ghost.dir] && ghost.mode !== "eaten") return false;
    return canMove(ghost, dir, ghost.mode === "eaten");
  });
  if (!options.length) return opposite[ghost.dir];
  if (ghost.mode === "frightened") return options[Math.floor(Math.random() * options.length)];
  const target = ghost.mode === "eaten" ? { x: 14, y: 14 } : ghostTarget(ghost);
  return options
    .map((dir) => {
      const vector = directionVectors[dir];
      const nx = pos.x + vector.x;
      const ny = pos.y + vector.y;
      return { dir, distance: Math.hypot(target.x - nx, target.y - ny) };
    })
    .sort((a, b) => a.distance - b.distance)[0].dir;
}

function ghostTarget(ghost) {
  if (ghost.mode === "scatter") return ghost.scatterTarget;
  const pacTile = tileOf(pacman);
  const pacVector = directionVectors[pacman.dir === "none" ? pacman.wantedDir : pacman.dir];
  if (ghost.id === "blinky") return pacTile;
  if (ghost.id === "pinky") return { x: pacTile.x + pacVector.x * 4, y: pacTile.y + pacVector.y * 4 };
  if (ghost.id === "inky") {
    const blinky = ghosts.find((item) => item.id === "blinky");
    const ahead = { x: pacTile.x + pacVector.x * 2, y: pacTile.y + pacVector.y * 2 };
    const blinkyTile = tileOf(blinky);
    return { x: ahead.x * 2 - blinkyTile.x, y: ahead.y * 2 - blinkyTile.y };
  }
  if (ghost.id === "clyde") {
    const dist = Math.hypot(ghost.x - pacman.x, ghost.y - pacman.y) / tile;
    return dist > 8 ? pacTile : ghost.scatterTarget;
  }
  return pacTile;
}

function updateFruit(dt) {
  if (pelletCount <= 170 && fruitSpawned === 0) spawnFruit();
  if (pelletCount <= 70 && fruitSpawned === 1) spawnFruit();
  if (!fruit) return;
  fruit.timer -= dt;
  if (fruit.timer <= 0) {
    fruit = null;
    return;
  }
  if (Math.hypot(pacman.x - fruit.x, pacman.y - fruit.y) < 8) {
    addScore(fruit.points);
    setMessage(`${fruit.label.toUpperCase()} ${fruit.points}`);
    playTone(840, 0.12, "triangle", 0.055);
    fruit = null;
  }
}

function spawnFruit() {
  const fruitData = fruitForLevel();
  fruit = { ...fruitData, ...centerOf(14, 20), timer: 9 };
  fruitSpawned += 1;
}

function checkCollisions() {
  for (const ghost of ghosts) {
    if (ghost.mode === "house" || ghost.mode === "eaten" || ghost.mode === "respawning") continue;
    const distance = Math.hypot(pacman.x - ghost.x, pacman.y - ghost.y);
    if (distance > 6) continue;
    if (ghost.mode === "frightened") {
      const points = [200, 400, 800, 1600][Math.min(3, ghostCombo)];
      ghostCombo += 1;
      const house = centerOf(ghostHouseCenter.x, ghostHouseCenter.y);
      ghost.mode = "respawning";
      ghost.eaten = true;
      ghost.respawnTimer = ghostRespawnSeconds;
      ghost.x = house.x;
      ghost.y = house.y;
      ghost.dir = "up";
      addScore(points);
      setMessage(`${ghost.name.toUpperCase()} ${points}`);
      playTone(220, 0.14, "sawtooth", 0.06);
    } else {
      setMessage("PAC-MAN CAUGHT!");
      playDeath();
      restartRound();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawPellets();
  drawFruit();
  drawLives();
  for (const ghost of ghosts) drawGhost(ghost);
  drawPacman();
}

function drawMaze() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#1537ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#476bff";
  ctx.shadowBlur = 3;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (maze[y][x] !== "#") continue;
      const px = x * tile;
      const py = y * tile;
      ctx.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3);
    }
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f2adff";
  ctx.fillRect(13 * tile, 12 * tile + 3, 2 * tile, 2);
}

function drawPellets() {
  ctx.fillStyle = "#f7e6bb";
  for (const key of pellets) {
    const [x, y] = key.split(",").map(Number);
    const cell = maze[y][x];
    const center = centerOf(x, y);
    ctx.beginPath();
    ctx.arc(center.x, center.y, cell === "o" ? 3 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFruit() {
  if (!fruit) return;
  ctx.fillStyle = fruit.color;
  ctx.beginPath();
  ctx.arc(fruit.x, fruit.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#71ff82";
  ctx.fillRect(fruit.x + 1, fruit.y - 6, 3, 2);
}

function drawLives() {
  for (let i = 0; i < lives; i += 1) {
    drawPacShape(12 + i * 14, 278, "right", 4, 0.35);
  }
}

function drawPacman() {
  const mouth = 0.18 + Math.abs(Math.sin(pacman.mouth)) * 0.22;
  drawPacShape(pacman.x, pacman.y, pacman.dir === "none" ? pacman.wantedDir : pacman.dir, 3.6, mouth);
}

function drawPacShape(x, y, dir, radius, mouth) {
  const angles = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: Math.PI * 1.5,
    none: 0,
  };
  const facing = angles[dir] || 0;
  ctx.fillStyle = "#ffd629";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, facing + mouth, facing + Math.PI * 2 - mouth);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(ghost) {
  let bodyColor = ghost.color;
  if (ghost.mode === "frightened") {
    bodyColor = ghost.frightenedTimer < 1.5 && Math.floor(performance.now() / 140) % 2 === 0 ? colors.flash : colors.frightened;
  }
  if (ghost.mode === "eaten") bodyColor = "transparent";
  const x = ghost.x;
  const y = ghost.y;
  if (bodyColor !== "transparent") {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(x, y - 1, 6, Math.PI, 0);
    ctx.lineTo(x + 6, y + 6);
    for (let i = 0; i < 3; i += 1) {
      ctx.lineTo(x + 3 - i * 4, y + (i % 2 === 0 ? 3 : 6));
    }
    ctx.lineTo(x - 6, y + 6);
    ctx.closePath();
    ctx.fill();
  }
  const vector = directionVectors[ghost.dir];
  ctx.fillStyle = colors.eyes;
  ctx.beginPath();
  ctx.arc(x - 2.5, y - 1.5, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 2.5, y - 1.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#142040";
  ctx.beginPath();
  ctx.arc(x - 2.5 + vector.x, y - 1.5 + vector.y, 0.8, 0, Math.PI * 2);
  ctx.arc(x + 2.5 + vector.x, y - 1.5 + vector.y, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || audioContext) return;
  audioContext = new AudioContextClass();
}

function playTone(freq, duration, type, volume) {
  ensureAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playDeath() {
  playTone(420, 0.08, "sawtooth", 0.06);
  window.setTimeout(() => playTone(260, 0.12, "sawtooth", 0.06), 90);
  window.setTimeout(() => playTone(140, 0.2, "sawtooth", 0.05), 220);
}

function loop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setDirection(dir) {
  if (!running) startGame();
  requestPacmanStep(dir);
}

function requestPacmanStep(dir) {
  pacman.wantedDir = dir;
  if (pacman.stepTarget) {
    pacman.queuedDir = dir;
    return;
  }
  snapToTile(pacman);
  if (!canMove(pacman, dir)) {
    pacman.dir = "none";
    pacman.queuedDir = null;
    return;
  }
  const vector = directionVectors[dir];
  const pos = tileOf(pacman);
  const targetTile = { x: pos.x + vector.x, y: pos.y + vector.y };
  pacman.dir = dir;
  pacman.stepTarget = centerOf(targetTile.x, targetTile.y);
}

function directionFromKey(event) {
  return keyDirections[event.key] || keyDirections[event.code] || keyDirections[event.keyCode];
}

function handleKeydown(event) {
  const direction = directionFromKey(event);
  if (direction) {
    event.preventDefault();
    canvas.focus();
    setDirection(direction);
    return;
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (!running) startGame();
  }
}

document.addEventListener("keydown", handleKeydown, { capture: true });
window.addEventListener("click", () => canvas.focus());

for (const button of mobileButtons) {
  button.addEventListener("click", () => {
    canvas.focus();
    setDirection(button.dataset.dir);
  });
}

startButton.addEventListener("click", () => {
  canvas.focus();
  startGame();
});

restartButton.addEventListener("click", () => {
  canvas.focus();
  startGame();
});

function boot() {
  highScoreEl.textContent = highScore;
  startGame();
  running = false;
  setMessage("PRESS START");
  canvas.focus();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

boot();
