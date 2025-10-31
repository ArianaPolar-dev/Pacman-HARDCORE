// ===== CONFIGURACIÓN =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE = 20;
const ROWS = 21, COLS = 19;
let score = 0, dotsLeft = 244, gameOver = false, won = false;
let timer = 240; // 4 minutos
let timerInterval;

// ===== MAPA (1=pared, 2=punto, 3=power, 0=vacío) =====
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,0,1,1,0,1,2,1,1,1,1],
  [2,2,2,2,2,2,0,1,0,0,0,1,0,2,2,2,2,2,2],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// ===== JUGADOR =====
const player = {
  x: 9, y: 15, // centro abajo
  dir: null,
  nextDir: null,
  speed: 0.14,
  radius: 0.4,
  mouth: 0.2,
  mouthDir: 1
};

// ===== FANTASMAS (IA DEMONÍACA) =====
class Ghost {
  constructor(x, y, color, role) {
    this.x = x; this.y = y;
    this.color = color;
    this.role = role;
    this.speed = 0.11;
    this.target = { x, y };
    this.path = [];
    this.scatter = false;
    this.fleeing = false;
    this.home = { x, y };
  }

  reset() { this.x = this.home.x; this.y = this.home.y; this.fleeing = false; }

  // A* Pathfinding
  findPath(targetX, targetY) {
    const open = [];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    const start = `${this.x|0},${this.y|0}`;
    const goal = `${targetX|0},${targetY|0}`;
    gScore[start] = 0;
    open.push({ pos: start, f: this.heuristic(start, goal) });

    while (open.length) {
      open.sort((a,b) => a.f - b.f);
      const current = open.shift().pos;
      if (current === goal) return this.reconstruct(cameFrom, current);
      closed.add(current);

      const [cx, cy] = current.split(',').map(Number);
      for (let [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
        const nx = cx + dx, ny = cy + dy;
        const pos = `${nx},${ny}`;
        if (closed.has(pos) || !this.isValid(nx, ny)) continue;
        const tentative = gScore[current] + 1;
        if (!(pos in gScore) || tentative < gScore[pos]) {
          cameFrom[pos] = current;
          gScore[pos] = tentative;
          open.push({ pos, f: tentative + this.heuristic(pos, goal) });
        }
      }
    }
    return [];
  }

  heuristic(a, b) {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  reconstruct(cameFrom, current) {
    const path = [current];
    while (cameFrom[current]) {
      current = cameFrom[current];
      path.unshift(current);
    }
    return path.map(p => ({ x: +p.split(',')[0], y: +p.split(',')[1] }));
  }

  isValid(x, y) {
    x = x|0; y = y|0;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    return MAP[y][x] !== 1;
  }

  predictPlayer(steps = 5) {
    let px = player.x, py = player.y;
    let dir = player.dir || player.nextDir;
    if (!dir) return { x: px, y: py };
    const dirs = { 'up': [0,-1], 'down': [0,1], 'left': [-1,0], 'right': [1,0] };
    const [dx, dy] = dirs[dir] || [0,0];
    for (let i = 0; i < steps; i++) {
      const nx = px + dx * player.speed * 3;
      const ny = py + dy * player.speed * 3;
      if (this.isValid(nx, ny)) { px = nx; py = ny; }
      else break;
    }
    return { x: px, y: py };
  }

  getNearestPower() {
    let best = null, dist = 999;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === 3) {
          const d = Math.hypot(x - this.x, y - this.y);
          if (d < dist) { dist = d; best = { x, y }; }
        }
      }
    }
    return best;
  }

  getChokepointTo(target) {
    const path = this.findPath(target.x, target.y);
    return path.length > 3 ? path[2] : target;
  }

  findRichestZone() {
    let best = null, count = 0;
    for (let y = 1; y < ROWS-1; y++) {
      for (let x = 1; x < COLS-1; x++) {
        if (MAP[y][x] === 2) {
          let local = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (MAP[y+dy]?.[x+dx] === 2) local++;
            }
          }
          if (local > count) { count = local; best = { x, y }; }
        }
      }
    }
    return best || { x: 9, y: 9 };
  }

  findBestAmbush() {
    let best = null, exits = 0;
    for (let y = 1; y < ROWS-1; y++) {
      for (let x = 1; x < COLS-1; x++) {
        if (MAP[y][x] !== 1) {
          let count = 0;
          for (let [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
            if (this.isValid(x+dx, y+dy)) count++;
          }
          if (count >= 3 && count > exits) { exits = count; best = { x, y }; }
        }
      }
    }
    return best || { x: 9, y: 9 };
  }

  update(ghosts) {
    if (this.fleeing) {
      this.target = { x: Math.random() * COLS, y: Math.random() * ROWS };
    } else {
      switch (this.role) {
        case 'chaser':
          const future = this.predictPlayer(5);
          this.target = future;
          break;
        case 'blocker':
          const power = this.getNearestPower();
          this.target = power ? this.getChokepointTo(power) : this.predictPlayer(2);
          break;
        case 'ambusher':
          this.target = this.findBestAmbush();
          break;
        case 'patroller':
          this.target = this.findRichestZone();
          break;
      }
    }

    this.path = this.findPath(this.target.x, this.target.y);
    if (this.path.length > 1) {
      const next = this.path[1];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.1) {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      }
    }
  }
}

// Fantasmas
const ghosts = [
  new Ghost(9, 9, '#f00', 'chaser'),    // Blaze
  new Ghost(8, 9, '#ffb8ff', 'blocker'), // Shade
  new Ghost(10, 9, '#00ffff', 'ambusher'), // Inky
  new Ghost(9, 10, '#ffb851', 'patroller') // Clyde
];
ghosts.forEach(g => g.home = { x: g.x, y: g.y });

// ===== INPUT =====
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    keys[e.key.replace('Arrow', '').toLowerCase()] = true;
  }
});

// ===== COLISIÓN =====
function eatDot(x, y) {
  x = x|0; y = y|0;
  if (MAP[y][x] === 2) {
    MAP[y][x] = 0;
    score += 10;
    dotsLeft--;
    document.getElementById('score').textContent = score;
    document.getElementById('dots').textContent = dotsLeft;
    if (dotsLeft % 50 === 0 && dotsLeft > 0) {
      ghosts.forEach(g => g.speed *= 1.15);
    }
  } else if (MAP[y][x] === 3) {
    MAP[y][x] = 0;
    score += 50;
    ghosts.forEach(g => { g.fleeing = true; setTimeout(() => g.fleeing = false, 8000); });
  }
}

// ===== LOOP PRINCIPAL =====
function update() {
  if (gameOver || won) return;

  // Timer
  if (timer <= 0) { gameOver = true; return; }
  timer -= 1/60;
  document.getElementById('timer').textContent = Math.ceil(timer);

  // Input
  const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  let intended = null;
  if (keys.up) intended = 'up';
  else if (keys.down) intended = 'down';
  else if (keys.left) intended = 'left';
  else if (keys.right) intended = 'right';

  if (intended) {
    const [dx, dy] = dirs[intended];
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    if (MAP[ny|0][nx|0] !== 1) {
      player.dir = intended;
    }
    player.nextDir = intended;
  }

  // Movimiento
  if (player.dir) {
    const [dx, dy] = dirs[player.dir];
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    if (MAP[ny|0][nx|0] !== 1) {
      player.x = nx; player.y = ny;
    } else if (player.nextDir && player.nextDir !== player.dir) {
      const [dx2, dy2] = dirs[player.nextDir];
      const nx2 = player.x + dx2 * player.speed;
      const ny2 = player.y + dy2 * player.speed;
      if (MAP[ny2|0][nx2|0] !== 1) {
        player.dir = player.nextDir;
      }
    }
  }

  // Comer
  eatDot(player.x, player.y);

  // Fantasmas
  ghosts.forEach(g => g.update(ghosts));
  ghosts.forEach(g => {
    if (Math.hypot(g.x - player.x, g.y - player.y) < 0.7) {
      if (g.fleeing) {
        score += 200;
        g.reset();
      } else {
        gameOver = true;
      }
    }
  });

  // Ganar
  if (dotsLeft === 0) {
    won = true;
    const name = prompt("¡ERES EL PRIMER HUMANO EN COMPLETAR PAC-MAN HELL!\n\nIngresa tu nombre para la eternidad:");
    if (name) saveFirstWinner(name);
    showWinner();
  }

  render();
  requestAnimationFrame(update);
}

// ===== RENDER =====
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mapa
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const val = MAP[y][x];
      const px = x * TILE + 10, py = y * TILE + 10;
      if (val === 1) {
        ctx.fillStyle = '#00f';
        ctx.fillRect(px, py, TILE, TILE);
      } else if (val === 2) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px + 10, py + 10, 2, 0, Math.PI*2);
        ctx.fill();
      } else if (val === 3) {
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(px + 10, py + 10, 5, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Jugador
  ctx.save();
  ctx.translate(player.x * TILE + 10, player.y * TILE + 10);
  const angle = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 }[player.dir] || 0;
  ctx.rotate(angle);
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(0, 0, TILE * player.radius, player.mouth, Math.PI*2 - player.mouth);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.restore();
  player.mouth += 0.05 * player.mouthDir;
  if (player.mouth > 0.7 || player.mouth < 0.2) player.mouthDir *= -1;

  // Fantasmas
  ghosts.forEach(g => {
    ctx.fillStyle = g.fleeing ? '#00f' : g.color;
    const px = g.x * TILE + 10, py = g.y * TILE + 10;
    ctx.beginPath();
    ctx.arc(px, py, TILE * 0.4, 0, Math.PI*2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px - 5, py - 3, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 5, py - 3, 3, 0, Math.PI*2); ctx.fill();
  });
}

// ===== PRIMER GANADOR =====
function saveFirstWinner(name) {
  const key = 'PACMAN_HELL_FIRST';
  if (!localStorage.getItem(key)) {
    const data = { name, date: new Date().toLocaleString(), score };
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  return false;
}

function showWinner() {
  const data = JSON.parse(localStorage.getItem('PACMAN_HELL_FIRST'));
  if (data) {
    const el = document.getElementById('winner');
    el.innerHTML = `
      <div>PRIMER GANADOR MUNDIAL</div>
      <div style="font-size:48px;color:gold;margin:10px 0;">${data.name}</div>
      <div>Completado: ${data.date}</div>
      <div>Puntaje: ${data.score}</div>
    `;
  }
}

// ===== INICIO =====
function start() {
  timerInterval = setInterval(() => {
    timer--;
    document.getElementById('timer').textContent = Math.ceil(timer);
    if (timer <= 0) gameOver = true;
  }, 1000);
  update();
}

// Mostrar ganador previo
showWinner();
setTimeout(start, 1000);
