// ==========================================
// 1. 基本設定・Canvas・自機関連
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
  x: canvas.width / 2 - 15,
  y: 500,
  width: 25,
  height: 25,
  color: '#00f2fe'
};

const playerSpeed = 4;

let score = 0;
let bombCount = 1;
let shieldActive = false;
let shieldTimer = 0;
let isGameOver = false;

// ハイスコア
const hiScoreEl = document.getElementById('hi-score');
let highScore = Number(localStorage.getItem('highScore')) || 0;
let hiScoreSaved = false;
hiScoreEl.textContent = `ハイスコア: ${highScore}`;

// 開発者モード（無限シールド＋被弾カウント）
let devShield = false;
let devUsed = false;   // 一度でも使ったらハイスコアを更新しない
let hitCount = 0;
const devBtn = document.getElementById('dev-btn');

const toggleDev = () => {
  devShield = !devShield;
  if (devShield) { devUsed = true; hitCount = 0; }   // オンにするたび0から数える
  if (devBtn) devBtn.classList.toggle('on', devShield);
};

let ripples = [];

// 見た目は30pxのまま、弾との当たりだけ中心14px（東方式）
const playerHitbox = () => ({ x: player.x + 8, y: player.y + 8, width: 14, height: 14 });

const drawPlayer = () => {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  if (shieldActive) {
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 開発者シールド（黄色）
  if (devShield) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
};

// ==========================================
// 2. 入力管理
// ==========================================
const keys = {
  ArrowLeft: false,
  ArrowRight: false
};

const triggerBomb = () => {
  if (bombCount > 0 && !isGameOver) {
    bombCount--;
    enemyBullets = [];
    beams = [];
    ripples.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      radius: 10,
      maxRadius: Math.max(canvas.width, canvas.height),
      alpha: 1.0
    });
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
  if (e.key === 'ArrowRight') keys.ArrowRight = true;
  if (e.key === 'x' || e.key === 'X') {
    triggerBomb();
  }
  if ((e.key === 'r' || e.key === 'R') && isGameOver) resetGame();
  if ((e.key === 'c' || e.key === 'C') && !e.repeat) toggleDev();   // 長押しで連続切替しない
  if ((e.key === 't' || e.key === 'T') && devShield) gameTime = Math.max(gameTime, 75);   // 開発者モード：phase4へスキップ
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
  if (e.key === 'ArrowRight') keys.ArrowRight = false;
});

const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const bombBtn = document.getElementById('bomb-btn');

leftBtn.addEventListener('mousedown', () => keys.ArrowLeft = true);
leftBtn.addEventListener('mouseup', () => keys.ArrowLeft = false);
leftBtn.addEventListener('mouseleave', () => keys.ArrowLeft = false);

rightBtn.addEventListener('mousedown', () => keys.ArrowRight = true);
rightBtn.addEventListener('mouseup', () => keys.ArrowRight = false);
rightBtn.addEventListener('mouseleave', () => keys.ArrowRight = false);

if (bombBtn) {
  bombBtn.addEventListener('click', () => triggerBomb());
}

// 開発者モードボタン（クリックはスマホのタップでも発火する）
if (devBtn) {
  devBtn.addEventListener('click', () => {
    toggleDev();
    devBtn.blur();   // スペース/Enterで再度切り替わらないように
  });
}

leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
leftBtn.addEventListener('touchend', () => keys.ArrowLeft = false);
leftBtn.addEventListener('touchcancel', () => keys.ArrowLeft = false);

rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
rightBtn.addEventListener('touchend', () => keys.ArrowRight = false);
rightBtn.addEventListener('touchcancel', () => keys.ArrowRight = false);

// ゲームオーバー中にキャンバスをタップでリスタート（スマホ用）
canvas.addEventListener('pointerdown', () => { if (isGameOver) resetGame(); });

// ==========================================
// 3. 時間管理・フェーズ・敵データ
// ==========================================
let gameTime = 0;
let frameCounter = 0;

const updateTime = () => {
  if (isGameOver) return;
  frameCounter++;
  if (frameCounter >= 60) {
    gameTime++;
    score++; // 1秒ごとに+1
    frameCounter = 0;
  }
};

const enemyTypes = {
  T1: { color: '#ff4d4d', width: 40, height: 40 },
  T2: { color: '#ffa500', width: 40, height: 40 },
  T3: { color: '#ffeb3b', width: 40, height: 40 },
  T4: { color: '#4caf50', width: 40, height: 40 },
  T5: { color: '#00bcd4', width: 40, height: 40 },
  T6: { color: '#9c27b0', width: 40, height: 40 },
  T7: { color: '#ffffff', width: 40, height: 40 }
};

const BEAM_WARMUP = 35;   // 予備線の長さ（30F = 0.5秒）

// フェーズの切り替わり秒数はここだけで管理（25 / 50 / 75秒）
const getPhase = () => gameTime < 25 ? 1 : gameTime < 50 ? 2 : gameTime < 75 ? 3 : 4;

// フェーズ表示（エレベーター風）。変わったときだけDOMを触る
const phaseEls = document.querySelectorAll('.phase');
let currentPhase = 0;
const updatePhaseUI = () => {
  const p = getPhase();
  if (p === currentPhase) return;
  currentPhase = p;
  phaseEls.forEach(el => el.classList.toggle('active', Number(el.dataset.phase) === p));
};

const getSpawnConfig = () => {
  switch (getPhase()) {
    case 1: return { pool: ['T1', 'T2'], maxEnemies: 2 };
    case 2: return { pool: ['T1', 'T2', 'T3', 'T4'], maxEnemies: 3 };
    case 3: return { pool: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], maxEnemies: 4 };
    default: return { pool: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], maxEnemies: 5 };
  }
};

// ==========================================
// 4. 管理用変数・スポーン関数
// ==========================================
let enemies = [];
let spawnTimer = 0;
const spawnInterval = 90;
let enemyBullets = [];
let beams = []; // T5, T6のビーム用

let items = [];
let itemTimer = 0;
let shieldItemTimer = 0;
let bombItemTimer = 0;

const spawnEnemy = () => {
  const config = getSpawnConfig();
  if (enemies.length >= config.maxEnemies) return;

  const currentPool = [...config.pool];

  const randomTypeKey = currentPool[Math.floor(Math.random() * currentPool.length)];
  const typeData = enemyTypes[randomTypeKey];

  enemies.push({
    x: Math.random() * (canvas.width - typeData.width),
    y: -typeData.height,
    targetY: 80 + Math.random() * 60,
    width: typeData.width,
    height: typeData.height,
    color: typeData.color,
    type: randomTypeKey,
    state: 'entering',
    shootTimer: 0,
    actionCounter: 0,
    subTimer: 0
  });
};

const checkCollision = (rect1, rect2) => {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
};

// 自機狙い弾ヘルパー。f=進行方向のズレ、p=横ズレ（角度に合わせて並びごと回る）
const fireAimed = (enemy, size, speed, offsets = [{ p: 0, f: 0 }]) => {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height;
  const angle = Math.atan2(
    player.y + player.height / 2 - cy,
    player.x + player.width / 2 - cx
  );
  const c = Math.cos(angle), s = Math.sin(angle);
  offsets.forEach(({ p, f }) => {
    enemyBullets.push({
      x: cx + c * f - s * p - size / 2,
      y: cy + s * f + c * p - size / 2,
      width: size, height: size,
      speedX: c * speed, speedY: s * speed,
      color: enemy.color
    });
  });
};

// ビーム判定：自機中心をビーム座標系に直して「長さ方向」「横ズレ」で見る
const beamHitsPlayer = (b) => {
  const px = player.x + player.width / 2 - b.ox;
  const py = player.y + player.height / 2 - b.oy;
  const s = Math.sin(b.angle), c = Math.cos(b.angle);
  const along = px * s + py * c;
  const perp = px * c - py * s;
  return along >= 0 && along <= b.length && Math.abs(perp) < b.width / 2 + 7;
};

// アイテム描画：丸＋白フチ＋文字で、四角い弾と区別
const drawItem = (item) => {
  const cx = item.x + item.width / 2, cy = item.y + item.height / 2;
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.arc(cx, cy, item.width / 2 + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText({ point: 'P', shield: 'S', bomb: 'B' }[item.type], cx, cy + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
};

const resetGame = () => {
  score = 0; bombCount = 1;
  shieldActive = false; shieldTimer = 0;
  isGameOver = false;
  gameTime = 0; frameCounter = 0;
  enemies = []; enemyBullets = []; beams = []; items = []; ripples = [];
  spawnTimer = 0; itemTimer = 0; shieldItemTimer = 0; bombItemTimer = 0;
  player.x = canvas.width / 2 - player.width / 2;
  hiScoreSaved = false;
  hitCount = 0; devUsed = false; devShield = false;
  if (devBtn) devBtn.classList.remove('on');
};

// ==========================================
// 5. メインループ
// ==========================================
const updateGame = () => {
  if (!isGameOver) {
    updateTime();

    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnEnemy();
      spawnTimer = 0;
    }

    itemTimer++;
    if (itemTimer >= 300) {
      items.push({ x: Math.random() * (canvas.width - 20), y: -20, width: 20, height: 20, type: 'point', speed: 2, color: '#ff4d4d' });
      itemTimer = 0;
    }

    shieldItemTimer++;
    if (shieldItemTimer >= 600) {
      items.push({ x: Math.random() * (canvas.width - 24), y: -24, width: 24, height: 24, type: 'shield', speed: 1.5, color: '#00bcd4' });
      shieldItemTimer = 0;
    }

    bombItemTimer++;
    if (bombItemTimer >= 1000) {
      items.push({ x: Math.random() * (canvas.width - 24), y: -24, width: 24, height: 24, type: 'bomb', speed: 1.5, color: '#ff69b4' });
      bombItemTimer = 0;
    }

    if (shieldActive) {
      shieldTimer--;
      if (shieldTimer <= 0) shieldActive = false;
    }

    if (keys.ArrowLeft) player.x -= playerSpeed;
    if (keys.ArrowRight) player.x += playerSpeed;
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 敵の挙動・攻撃パターン管理
  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];

    if (!isGameOver) {
      if (enemy.state === 'entering') {
        enemy.y += 2;
        if (enemy.y >= enemy.targetY) {
          enemy.y = enemy.targetY;
          enemy.state = 'shooting';
        }
      } else if (enemy.state === 'shooting') {
        enemy.shootTimer++;

        // ----------------------------------------
        // T1: 自機狙いを0.3秒(18F)間隔で5個
        // ----------------------------------------
        if (enemy.type === 'T1') {
          if (enemy.shootTimer >= 18) {
            enemy.shootTimer = 0;
            enemy.actionCounter++;
            const angle = Math.atan2((player.y + player.height/2) - (enemy.y + enemy.height), (player.x + player.width/2) - (enemy.x + enemy.width/2));
            enemyBullets.push({
              x: enemy.x + enemy.width/2 - 5, y: enemy.y + enemy.height,
              width: 10, height: 10, speedX: Math.cos(angle) * 3, speedY: Math.sin(angle) * 3,
              color: enemy.color
            });
            if (enemy.actionCounter >= 5) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T2: 自機狙いの横3連を1.5秒(90F)間隔で3セット
        // ----------------------------------------
        else if (enemy.type === 'T2') {
          if (enemy.shootTimer >= 90) {
            enemy.shootTimer = 0;
            fireAimed(enemy, 10, 3, [{ p: -15, f: 0 }, { p: 0, f: 0 }, { p: 15, f: 0 }]);
            enemy.actionCounter++;
            if (enemy.actionCounter >= 3) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T3: 大玉・自機狙い・1.5秒(90F)間隔で2個
        // ----------------------------------------
        else if (enemy.type === 'T3') {
          if (enemy.shootTimer >= 90) {
            enemy.shootTimer = 0;
            fireAimed(enemy, 70, 2);
            enemy.actionCounter++;
            if (enemy.actionCounter >= 2) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T4: 自機狙い・逆三角形（上2個・下1個）・高速・0.75秒(45F)間隔で3セット
        // ----------------------------------------
        else if (enemy.type === 'T4') {
          if (enemy.shootTimer >= 45) {
            enemy.shootTimer = 0;
            fireAimed(enemy, 10, 5.25, [{ p: -12, f: 0 }, { p: 12, f: 0 }, { p: 0, f: 15 }]);
            enemy.actionCounter++;
            if (enemy.actionCounter >= 3) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T5: 垂直ビームを1.5秒(90F)照射
        // ----------------------------------------
        else if (enemy.type === 'T5') {
          if (enemy.actionCounter === 0) {
            beams.push({
              ox: enemy.x + enemy.width / 2, oy: enemy.y + enemy.height,
              angle: 0, width: 65, length: 800,
              color: enemy.color, life: 90, warmup: BEAM_WARMUP
            });
            enemy.actionCounter = 1;
          }
          enemy.subTimer++;
          if (enemy.subTimer >= 90 + BEAM_WARMUP) enemy.state = 'leaving';
        }
        // ----------------------------------------
        // T6: 同じ起点から±0.26radで開く二方向ビームを2秒(120F)照射
        // ----------------------------------------
        else if (enemy.type === 'T6') {
          if (enemy.actionCounter === 0) {
            const ox = enemy.x + enemy.width / 2, oy = enemy.y + enemy.height;
            [-0.26, 0.26].forEach(a => beams.push({
              ox, oy, angle: a, width: 10, length: 800,
              color: enemy.color, life: 120, warmup: BEAM_WARMUP
            }));
            enemy.actionCounter = 1;
          }
          enemy.subTimer++;
          if (enemy.subTimer >= 120 + BEAM_WARMUP) enemy.state = 'leaving';
        }
        // ----------------------------------------
        // T7: 台風のように弧を描く球を4個ずつ0.3s間隔で5秒間
        // ----------------------------------------
        else if (enemy.type === 'T7') {
          enemy.subTimer++;
          if (enemy.shootTimer >= 18) {
            enemy.shootTimer = 0;
            for (let k = 0; k < 4; k++) {
              const sweep = Math.sin(enemy.subTimer * 0.04) * 0.8; // 発射方向を左右に揺らす
              const baseAngle = Math.PI / 2 + sweep + (k - 1.5) * 0.3;
              enemyBullets.push({
                x: enemy.x + enemy.width / 2 - 5, y: enemy.y + enemy.height,
                width: 10, height: 10,
                speedX: Math.cos(baseAngle) * 3,
                speedY: Math.sin(baseAngle) * 3,
                curve: 0.006, // 旋回半径 ≒ 速度/curve = 500px
                color: enemy.color
              });
            }
            enemy.actionCounter++;
          }
          if (enemy.subTimer >= 300) { // 5秒 = 300F
            enemy.state = 'leaving';
          }
        }

      } else if (enemy.state === 'leaving') {
        enemy.y -= 3;
        if (enemy.y < -enemy.height) {
          enemies.splice(i, 1);
          continue;
        }
      }
    }

    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  }

  // アイテム処理（拾いやすいよう判定は見た目の自機サイズ）
  for (let i = items.length - 1; i >= 0; i--) {
    let item = items[i];
    if (!isGameOver) item.y += item.speed;

    if (item.y > canvas.height) {
      items.splice(i, 1);
      continue;
    }

    if (!isGameOver && checkCollision(player, item)) {
      if (item.type === 'point') score += 15;
      else if (item.type === 'shield') { shieldActive = true; shieldTimer = 600; }
      else if (item.type === 'bomb') bombCount = Math.min(3, bombCount + 1);
      items.splice(i, 1);
      continue;
    }

    drawItem(item);
  }

  // ビームの描画・判定
  for (let i = beams.length - 1; i >= 0; i--) {
    let b = beams[i];

    if (b.warmup > 0) {
      if (!isGameOver) b.warmup--;
      ctx.save();
      ctx.translate(b.ox, b.oy);
      ctx.rotate(-b.angle);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(-b.width / 2, 0, b.width, b.length);       // 危険範囲を薄く塗る
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-b.width / 2, 0, b.width, b.length);      // 縁だけくっきり
      ctx.restore();
      continue;   // 準備中は寿命も判定も進めない
    }

    if (!isGameOver) b.life--;

    if (b.life <= 0) {
      beams.splice(i, 1);
      continue;
    }

    if (!isGameOver) {
      const hit = beamHitsPlayer(b);
      if (devShield) {
        // 開発者モード：触れた瞬間だけ被弾を数える（ビームは消えない）
        if (hit && !b.wasHit) hitCount++;
        b.wasHit = hit;
      } else if (hit) {
        if (shieldActive) {
          shieldActive = false;
          beams.splice(i, 1);
          continue;
        } else {
          isGameOver = true;
        }
      }
    }

    ctx.save();
    ctx.translate(b.ox, b.oy);
    ctx.rotate(-b.angle);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.width / 2, 0, b.width, b.length);
    ctx.restore();
  }

  // 弾の移動・描画・カーブ処理（T7用）
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let bullet = enemyBullets[i];
    if (!isGameOver) {
      bullet.x += bullet.speedX;
      bullet.y += bullet.speedY;
      // 弧を描くカーブ効果
      if (bullet.curve) {
        let tempX = bullet.speedX;
        bullet.speedX = tempX * Math.cos(bullet.curve) - bullet.speedY * Math.sin(bullet.curve);
        bullet.speedY = tempX * Math.sin(bullet.curve) + bullet.speedY * Math.cos(bullet.curve);
      }
    }

    if (bullet.y > canvas.height || bullet.y < -50 || bullet.x < -50 || bullet.x > canvas.width + 50) {
      enemyBullets.splice(i, 1);
      continue;
    }

    if (!isGameOver && checkCollision(playerHitbox(), bullet)) {
      if (devShield) {
        hitCount++;
        enemyBullets.splice(i, 1);
        continue;
      }
      if (shieldActive) {
        shieldActive = false;
        enemyBullets.splice(i, 1);
        continue;
      } else {
        isGameOver = true;
      }
    }

    ctx.fillStyle = bullet.color;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }

  // 波紋エフェクト
  for (let i = ripples.length - 1; i >= 0; i--) {
    let r = ripples[i];
    r.radius += 10;
    r.alpha -= 0.03;

    if (r.alpha <= 0 || r.radius >= r.maxRadius) {
      ripples.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ハイスコア更新（開発者モードを使った回は更新しない）
  if (!devUsed && score > highScore) {
    highScore = score;
    hiScoreEl.textContent = `ハイスコア: ${highScore}`;
  }
  if (isGameOver && !hiScoreSaved) {
    localStorage.setItem('highScore', highScore);
    hiScoreSaved = true;   // 毎フレーム書き込まないためのフラグ
  }

  updatePhaseUI();
  drawPlayer();

  // UI描画
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`SCORE: ${score}`, 10, 25);
  ctx.fillText(`BOMB: ${bombCount}/3`, 10, 45);
  if (shieldActive) {
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`SHIELD: ${Math.ceil(shieldTimer / 60)}s`, 10, 65);
  }
  // 開発者モード：被弾数（他のUIより大きく赤で）
  if (devShield) {
    ctx.fillStyle = '#ff3b3b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`被弾: ${hitCount}`, 10, 95);
    ctx.font = '14px sans-serif';
  }

  if (isGameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4d4d';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.font = '14px sans-serif';
    ctx.fillText('R / タップでリスタート', canvas.width / 2, canvas.height / 2 + 30);
    ctx.textAlign = 'left';
  }
};

// ==========================================
// 6. 60fps固定ループ（120/144Hz環境でも速くならない）
// ==========================================
const FRAME = 1000 / 60;
let lastTime = 0;
const loop = (now) => {
  requestAnimationFrame(loop);
  const delta = now - lastTime;
  if (delta < FRAME) return;
  lastTime = now - (delta % FRAME);
  updateGame();
};
requestAnimationFrame(loop);