// ===== CONFIGURACIÓN =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE = 20;
const ROWS = 19, COLS = 19; // ¡AHORA ES 19x19! (tu mapa es 19x19, no 21x19)
let score = 0, dotsLeft = 0, gameOver = false, won = false;
let timer = 240;

// ===== MAPA CORREGIDO (19x19) =====
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

// Contar bolitas
dotsLeft = MAP.flat().filter(c => c === 2 || c === 3).length;

// ===== JUGADOR (en píxeles) =====
const player = {
  x: 9 * TILE + 10,  // centro de la celda (9, 11)
  y: 11 * TILE + 10,
  dir: null,
  nextDir: null,
  speed: 2.8, // píxeles por frame
  radius: 8,
  mouth: 0.2,
  mouthDir: 1
};

// ===== FANTASMAS =====
class Ghost {
  constructor(cx, cy, color, role) {
    this.cx = cx; this.cy = cy;
    this.x = cx * TILE + 10;
    this.y = cy * TILE + 10;
    this.color = color;
    this.role = role;
    this.speed = 2.2;
    this.target = { x: this.x, y: this.y };
    this.fleeing = false;
    this.home = { cx, cy };
  }

  reset() {
    this.cx = this.home.cx; this.cy = this.home.cy;
    this.x = this.cx * TILE + 10;
    this.y = this.cy * TILE + 10;
    this.fleeing = false;
  }

  isValid(cx, cy) {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
    return MAP[cy][cx] !== 1;
  }

  predictPlayer(steps = 5) {
    let px = player.x, py = player.y;
    let dir = player.dir || player.nextDir;
    if (!dir) return { x: px, y: py };
    const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
    const [dx, dy] = dirs[dir];
    for (let i = 0; i < steps; i++) {
      px += dx * player.speed;
      py += dy * player.speed;
      const cx = (px / TILE) | 0;
      const cy = (py / TILE) | 0;
      if (!this.isValid(cx, cy)) break;
    }
    return { x: px, y: py };
  }

  findPath(tx, ty) {
    const open = [];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    const start = `${this.cx},${this.cy}`;
    const goal = `${tx|0},${ty|0}`;
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
    return path.map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x: x * TILE + 10, y: y * TILE + 10 };
    });
  }

  update() {
    if (this.fleeing) {
      this.target = { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
    } else {
      switch (this.role) {
        case 'chaser':
          const future = this.predictPlayer(5);
          this.target = future;
          break;
        case 'blocker':
          const power = this.getNearestPower();
          this.target = power ? { x: power.x * TILE + 10, y: power.y * TILE + 10 } : this.predictPlayer(2);
          break;
        case 'ambusher':
          this.target = this.findBestAmbush();
          break;
        case 'patroller':
          this.target = this.findRichestZone();
          break;
      }
    }

    const path = this.findPath(this.target.x / TILE, this.target.y / TILE);
    if (path.length > 1) {
      const next = path[1];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      }
    }

    // Actualizar celda
    this.cx = (this.x / TILE) | 0;
    this.cy = (this.y / TILE) | 0;
  }

  getNearestPower() {
    let best = null, dist = 999;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === 3) {
          const d = Math.hypot(x - this.cx, y - this.cy);
          if (d < dist) { dist = d; best = { x, y }; }
        }
      }
    }
    return best;
  }

  findRichestZone() {
    let best = null, count = 0;
    for (let y = 1; y < ROWS-1; y++) {
      for (let x = 1; x < COLS-1; x++) {
        if (MAP[y][x] === 2) {
          let local = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (MAP[y+dy]?.[x+dx] === 2) local++;
          }
          if (local > count) { count = local; best = { x: x * TILE + 10, y: y * TILE + 10 }; }
        }
      }
    }
    return best || { x: 9 * TILE + 10, y: 9 * TILE + 10 };
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
          if (count >= 3 && count > exits) { exits = count; best = { x: x * TILE + 10, y: y * TILE + 10 }; }
        }
      }
    }
    return best || { x: 9 * TILE + 10, y: 9 * TILE + 10 };
  }
}

// Fantasmas
const ghosts = [
  new Ghost(9, 9, '#f00', 'chaser'),
  new Ghost(8, 9, '#ffb8ff', 'blocker'),
  new Ghost(10, 9, '#00ffff', 'ambusher'),
  new Ghost(9, 10, '#ffb851', 'patroller')
];

// ===== INPUT =====
const keys = {};
window.addEventListener('keydown', e => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (map[e.key]) {
    e.preventDefault();
    keys[map[e.key]] = true;
  }
});

// ===== COLISIÓN Y COMER =====
function eatDot(px, py) {
  const cx = (px / TILE) | 0;
  const cy = (py / TILE) | 0;
  if (MAP[cy] && MAP[cy][cx] === 2) {
    MAP[cy][cx] = 0;
    score += 10;
    dotsLeft--;
    document.getElementById('score').textContent = score;
    document.getElementById('dots').textContent = dotsLeft;
    if (dotsLeft % 50 === 0 && dotsLeft > 0) {
      ghosts.forEach(g => g.speed *= 1.15);
    }
  } else if (MAP[cy] && MAP[cy][cx] === 3) {
    MAP[cy][cx] = 0;
    score += 50;
    ghosts.forEach(g => {
      g.fleeing = true;
      setTimeout(() => g.fleeing = false, 8000);
    });
  }
}

// ===== LOOP =====
function update() {
  if (gameOver || won) return;

  timer -= 1/60;
  document.getElementById('timer').textContent = Math.max(0, Math.ceil(timer));
  if (timer <= 0) { gameOver = true; return; }

  // Input
  const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  let intended = null;
  for (let d of ['up','down','left','right']) if (keys[d]) { intended = d; break; }

  if (intended) {
    const [dx, dy] = dirs[intended];
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    const cx = (nx / TILE) | 0;
    const cy = (ny / TILE) | 0;
    if (MAP[cy] && MAP[cy][cx] !== 1) {
      player.dir = intended;
    }
    player.nextDir = intended;
  }

  // Movimiento
  if (player.dir) {
    const [dx, dy] = dirs[player.dir];
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    const cx = (nx / TILE) | 0;
    const cy = (ny / TILE) | 0;
    if (MAP[cy] && MAP[cy][cx] !== 1) {
      player.x = nx; player.y = ny;
    } else if (player.nextDir && player.nextDir !== player.dir) {
      const [dx2, dy2] = dirs[player.nextDir];
      const nx2 = player.x + dx2 * player.speed;
      const ny2 = player.y + dy2 * player.speed;
      const cx2 = (nx2 / TILE) | 0;
      const cy2 = (ny2 / TILE) | 0;
      if (MAP[cy2] && MAP[cy2][cx2] !== 1) {
        player.dir = player.nextDir;
      }
    }
  }

  eatDot(player.x, player.y);

  ghosts.forEach(g => g.update());
  ghosts.forEach(g => {
    if (Math.hypot(g.x - player.x, g.y - player.y) < 16) {
      if (g.fleeing) {
        score += 200;
        g.reset();
      } else {
        gameOver = true;
      }
    }
  });

  if (dotsLeft === 0) {
    won = true;
    const name = prompt("¡ERES EL PRIMERO EN COMPLETAR PAC-MAN HELL!\nIngresa tu nombre:");
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
      const px = x * TILE, py = y * TILE;
      if (val === 1) {
        ctx.fillStyle = '#00f';
        ctx.fillRect(px, py, TILE, TILE);
      } else if (val === 2) {
        ctx.fillStyle = '#ffb';
        ctx.beginPath();
        ctx.arc(px + 10, py + 10, 3, 0, Math.PI*2);
        ctx.fill();
      } else if (val === 3) {
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(px + 10, py + 10, 6, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Pac-Man
  ctx.save();
  ctx.translate(player.x, player.y);
  const angle = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 }[player.dir] || 0;
  ctx.rotate(angle);
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, player.mouth, Math.PI*2 - player.mouth);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.restore();
  player.mouth += 0.08 * player.mouthDir;
  if (player.mouth > 0.7 || player.mouth < 0.2) player.mouthDir *= -1;

  // Fantasmas
  ghosts.forEach(g => {
    ctx.fillStyle = g.fleeing ? '#00f' : g.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 8, 0, Math.PI*2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(g.x - 4, g.y - 2, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(g.x + 4, g.y - 2, 2.5, 0, Math.PI*2); ctx.fill();
  });
}

// ===== GANADOR =====
function saveFirstWinner(name) {
  if (!localStorage.getItem('PACMAN_HELL_FIRST')) {
    localStorage.setItem('PACMAN_HELL_FIRST', JSON.stringify({ name, date: new Date().toLocaleString(), score }));
  }
}

function showWinner() {
  const data = JSON.parse(localStorage.getItem('PACMAN_HELL_FIRST') || 'null');
  if (data) {
    document.getElementById('winner').innerHTML = `
      <div style="color:gold;font-size:28px;">PRIMER GANADOR: ${data.name}</div>
      <div>${data.date} | Puntos: ${data.score}</div>
    `;
  }
}

// ===== INICIO =====
showWinner();
setTimeout(() => {
  requestAnimationFrame(update);
  setInterval(() => {
    timer = Math.max(0, timer - 1);
    document.getElementById('timer').textContent = Math.ceil(timer);
  }, 1000);
}, 500);
