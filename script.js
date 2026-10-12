// ==========================================
// 1. 基本設定・Canvas・自機関連
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
  x: canvas.width / 2 - 15,
  y: 500,
  width: 30,
  height: 30,
  color: '#00f2fe'
};

const playerSpeed = 4;

let score = 0;
let bombCount = 1;
let shieldActive = false;
let shieldTimer = 0;
let isGameOver = false;

let ripples = [];

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

leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
leftBtn.addEventListener('touchend', () => keys.ArrowLeft = false);

rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
rightBtn.addEventListener('touchend', () => keys.ArrowRight = false);

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

const getSpawnConfig = () => {
  if (gameTime < 25) {
    return { pool: ['T1', 'T2'], maxEnemies: 2 };
  } else if (gameTime < 50) {
    return { pool: ['T1', 'T2', 'T3', 'T4'], maxEnemies: 3 };
  } else if (gameTime < 100) {
    return { pool: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], maxEnemies: 4 };
  } else {
    return { pool: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], maxEnemies: 5 };
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

const spawnEnemy = () => {
  const config = getSpawnConfig();
  if (enemies.length >= config.maxEnemies) return;

  let currentPool = [...config.pool];
  const hasT7 = enemies.some(enemy => enemy.type === 'T7');
  if (hasT7) {
    currentPool = currentPool.filter(type => type !== 'T7');
  }

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
    if (itemTimer >= 240) {
      items.push({ x: Math.random() * (canvas.width - 20), y: -20, width: 20, height: 20, type: 'point', speed: 2, color: '#gold' });
      itemTimer = 0;
    }

    shieldItemTimer++;
    if (shieldItemTimer >= 1200) {
      items.push({ x: Math.random() * (canvas.width - 24), y: -24, width: 24, height: 24, type: 'shield', speed: 1.5, color: '#00ffcc' });
      shieldItemTimer = 0;
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
              x: enemy.x + enemy.width/2 - 4, y: enemy.y + enemy.height,
              width: 8, height: 8, speedX: Math.cos(angle) * 3, speedY: Math.sin(angle) * 3,
              color: enemy.color
            });
            if (enemy.actionCounter >= 5) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T2: 横3つの球を垂直発射
        // ----------------------------------------
        else if (enemy.type === 'T2') {
          if (enemy.shootTimer >= 60) {
            enemy.shootTimer = 0;
            const size = 8;
            const spacing = size * 1.5;
            for (let k = -1; k <= 1; k++) {
              enemyBullets.push({
                x: enemy.x + enemy.width/2 - size/2 + k * spacing, y: enemy.y + enemy.height,
                width: size, height: size, speedX: 0, speedY: 3,
                color: enemy.color
              });
            }
            enemy.actionCounter++;
            if (enemy.actionCounter >= 3) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T3: 2.5倍の大きさ、スピード0.75、1秒間隔で2個
        // ----------------------------------------
        else if (enemy.type === 'T3') {
          if (enemy.shootTimer >= 60) {
            enemy.shootTimer = 0;
            enemyBullets.push({
              x: enemy.x + enemy.width/2 - 10, y: enemy.y + enemy.height,
              width: 20, height: 20, speedX: 0, speedY: 0.75,
              color: enemy.color
            });
            enemy.actionCounter++;
            if (enemy.actionCounter >= 2) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T4: 逆三角形、スピード1.75、0.75秒(45F)間隔で3セット
        // ----------------------------------------
        else if (enemy.type === 'T4') {
          if (enemy.shootTimer >= 45) {
            enemy.shootTimer = 0;
            const ex = enemy.x + enemy.width/2;
            const ey = enemy.y + enemy.height;
            // 逆三角形の配置（上2個、下1個などスケッチ準拠）
            const offsets = [{dx: -10, dy: 0}, {dx: 10, dy: 0}, {dx: 0, dy: 15}];
            offsets.forEach(off => {
              enemyBullets.push({
                x: ex + off.dx - 4, y: ey + off.dy,
                width: 8, height: 8, speedX: 0, speedY: 1.75 * 3,
                color: enemy.color
              });
            });
            enemy.actionCounter++;
            if (enemy.actionCounter >= 3) enemy.state = 'leaving';
          }
        }
        // ----------------------------------------
        // T5: 球2個分の太さのビームを1.5秒(90F)照射
        // ----------------------------------------
        else if (enemy.type === 'T5') {
          if (enemy.actionCounter === 0) {
            beams.push({
              x: enemy.x + enemy.width/2 - 8, y: enemy.y + enemy.height,
              width: 16, height: canvas.height - (enemy.y + enemy.height),
              color: enemy.color, life: 90
            });
            enemy.actionCounter = 1;
          }
          enemy.subTimer++;
          if (enemy.subTimer >= 90) enemy.state = 'leaving';
        }
        // ----------------------------------------
        // T6: 間30°で二方向ビームを2秒(120F)照射
        // ----------------------------------------
        else if (enemy.type === 'T6') {
          if (enemy.actionCounter === 0) {
            const width = 12;
            beams.push({ x: enemy.x + enemy.width/2 - 20, y: enemy.y + enemy.height, width: width, height: canvas.height, color: enemy.color, life: 120, angle: -0.26 });
            beams.push({ x: enemy.x + enemy.width/2 + 20, y: enemy.y + enemy.height, width: width, height: canvas.height, color: enemy.color, life: 120, angle: 0.26 });
            enemy.actionCounter = 1;
          }
          enemy.subTimer++;
          if (enemy.subTimer >= 120) enemy.state = 'leaving';
        }
        // ----------------------------------------
        // T7: 台風のように弧を描く球を4個ずつ0.3s間隔で5秒間
        // ----------------------------------------
        else if (enemy.type === 'T7') {
          enemy.subTimer++;
          if (enemy.shootTimer >= 18) {
            enemy.shootTimer = 0;
            for (let k = 0; k < 4; k++) {
              const baseAngle = (Math.PI / 2) + (k * 0.3) - 0.45;
              enemyBullets.push({
                x: enemy.x + enemy.width/2, y: enemy.y + enemy.height,
                width: 8, height: 8,
                speedX: Math.cos(baseAngle) * 2.5,
                speedY: Math.sin(baseAngle) * 2.5,
                curve: 0.04, // 弧を描くための曲率
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

  // アイテム処理
  for (let i = items.length - 1; i >= 0; i--) {
    let item = items[i];
    if (!isGameOver) item.y += item.speed;

    if (item.y > canvas.height) {
      items.splice(i, 1);
      continue;
    }

    if (checkCollision(player, item)) {
      if (item.type === 'point') score += 15;
      else if (item.type === 'shield') { shieldActive = true; shieldTimer = 600; }
      items.splice(i, 1);
      continue;
    }

    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.width, item.height);
  }

  // ビームの描画・判定
  for (let i = beams.length - 1; i >= 0; i--) {
    let b = beams[i];
    if (!isGameOver) b.life--;

    if (b.life <= 0) {
      beams.splice(i, 1);
      continue;
    }

    if (!isGameOver && checkCollision(player, b)) {
      if (shieldActive) {
        shieldActive = false;
        beams.splice(i, 1);
        continue;
      } else {
        isGameOver = true;
      }
    }

    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.globalAlpha = 1.0;
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

    if (!isGameOver && checkCollision(player, bullet)) {
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

  if (isGameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4d4d';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }

  requestAnimationFrame(updateGame);
};

requestAnimationFrame(updateGame);

