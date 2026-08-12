const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameRunning = false;
let score = 0;
let phase = 1;
let lives = 3;
let gameSpeed = 2.8;
let combo = 1;
let comboTimer = 0;
let phaseTransitionLock = false;
let bossTriggered = false;

const stars = [];
let enemies = [];
let asteroids = [];
let explosions = [];
let lifeBonuses = [];
let powerUps = [];
let bosses = [];

let shakeFrames = 0;
let shakePower = 0;

const phaseToast = document.getElementById('phaseToast');
const scoreDisplay = document.getElementById('scoreDisplay');
const phaseDisplay = document.getElementById('phaseDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const weaponDisplay = document.getElementById('weaponDisplay');
const shieldDisplay = document.getElementById('shieldDisplay');

const player = {
    x: 0,
    y: 0,
    width: 48,
    height: 56,
    speed: 8,
    color: '#59c7ff',
    lasers: [],
    lastShot: 0,
    shootDelay: 280,
    moveLeft: false,
    moveRight: false,
    firing: false,
    weaponMode: 'normal',
    weaponExpiresAt: 0,
    shieldExpiresAt: 0,
    invulnerableUntil: 0
};

const audioSystem = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    sequenceStep: 0,
    noteIntervalId: null,
    initialized: false,
    muted: false
};

function setupCanvas() {
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        player.x = Math.min(
            Math.max(player.x || canvas.width / 2, player.width / 2),
            canvas.width - player.width / 2
        );
        player.y = canvas.height - 100;

        if (stars.length === 0) {
            createStarfield(160);
        }
    }

    window.addEventListener('resize', resize);
    resize();
}

function createStarfield(amount) {
    stars.length = 0;
    for (let i = 0; i < amount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2.2 + 0.3,
            speed: 0.3 + Math.random() * 2.6,
            alpha: 0.35 + Math.random() * 0.65
        });
    }
}

function createEnemy() {
    const size = 30 + Math.random() * 18;
    return {
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speed: 1.1 + Math.random() * (gameSpeed * 0.7),
        color: `hsl(${Math.random() * 45 + 330}, 100%, 62%)`,
        health: Math.max(1, Math.floor(phase / 2) + 1)
    };
}

function createAsteroid() {
    const size = 34 + Math.random() * 44;
    const points = [];
    const pointCount = 8;
    const radius = size / 2;

    for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const distance = radius * (0.72 + Math.random() * 0.28);
        points.push({
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance
        });
    }

    return {
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speed: 1 + Math.random() * (gameSpeed * 0.65),
        color: '#746b87',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.08,
        points
    };
}

function createLifeBonus() {
    return {
        x: Math.random() * (canvas.width - 30),
        y: -30,
        width: 30,
        height: 30,
        speed: 2 + Math.random() * 1.8
    };
}

function createPowerUp(type) {
    return {
        type,
        x: Math.random() * (canvas.width - 34),
        y: -34,
        width: 34,
        height: 34,
        speed: 2 + Math.random() * 1.6,
        pulse: Math.random() * Math.PI * 2
    };
}

function createBoss() {
    const width = Math.min(250, 160 + phase * 12);
    const height = Math.min(160, 96 + phase * 6);
    const maxHealth = 220 + phase * 90;

    return {
        x: canvas.width / 2 - width / 2,
        y: -height - 20,
        width,
        height,
        targetY: 70,
        speed: 1.4 + phase * 0.16,
        dir: 1,
        health: maxHealth,
        maxHealth,
        shotTimer: 0,
        patternTimer: 0,
        rage: false
    };
}

function createExplosion(x, y, size) {
    return {
        x,
        y,
        life: 26,
        particles: Array(18).fill().map(() => ({
            speed: Math.random() * 4 + 1,
            angle: Math.random() * Math.PI * 2,
            size: 1 + Math.random() * 2.2,
            color: `hsl(${Math.random() * 45 + 12}, 100%, 55%)`
        })),
        radius: Math.max(20, size)
    };
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#030c16');
    sky.addColorStop(0.45, '#07182b');
    sky.addColorStop(1, '#02060d');

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glowA = ctx.createRadialGradient(canvas.width * 0.2, canvas.height * 0.25, 10, canvas.width * 0.2, canvas.height * 0.25, 320);
    glowA.addColorStop(0, 'rgba(115, 230, 255, 0.22)');
    glowA.addColorStop(1, 'rgba(115, 230, 255, 0)');

    const glowB = ctx.createRadialGradient(canvas.width * 0.8, canvas.height * 0.15, 10, canvas.width * 0.8, canvas.height * 0.15, 280);
    glowB.addColorStop(0, 'rgba(255, 196, 122, 0.2)');
    glowB.addColorStop(1, 'rgba(255, 196, 122, 0)');

    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStarfield() {
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.y += star.speed * (0.5 + gameSpeed * 0.25);
        if (star.y > canvas.height + 2) {
            star.y = -2;
            star.x = Math.random() * canvas.width;
        }

        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#e6f7ff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPlanet() {
    const gradient = ctx.createRadialGradient(
        canvas.width * 0.72,
        canvas.height * 1.05,
        70,
        canvas.width * 0.72,
        canvas.height * 1.05,
        360
    );
    gradient.addColorStop(0, 'rgba(255, 184, 96, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 184, 96, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.72, canvas.height * 1.05, 360, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);

    const invulnerable = Date.now() < player.invulnerableUntil;
    if (invulnerable && Math.floor(Date.now() / 70) % 2 === 0) {
        ctx.globalAlpha = 0.35;
    }

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.lineTo(0, player.height * 0.25);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c6ecff';
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 2);
    ctx.fill();

    if (gameRunning) {
        ctx.fillStyle = '#ff9f4a';
        ctx.beginPath();
        ctx.moveTo(-8, player.height / 2 - 2);
        ctx.lineTo(0, player.height / 2 + 16 + Math.random() * 8);
        ctx.lineTo(8, player.height / 2 - 2);
        ctx.closePath();
        ctx.fill();
    }

    if (Date.now() < player.shieldExpiresAt) {
        ctx.strokeStyle = 'rgba(120, 242, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(player.width, player.height) * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawLaser(laser) {
    ctx.save();
    ctx.fillStyle = laser.isEnemy ? '#ff5d7d' : '#ffd166';
    ctx.shadowColor = laser.isEnemy ? '#ff5d7d' : '#ffd166';
    ctx.shadowBlur = 8;
    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
    ctx.restore();
}

function drawEnemy(enemy) {
    ctx.save();
    ctx.fillStyle = enemy.color;

    ctx.beginPath();
    ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
    ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
    ctx.lineTo(enemy.x, enemy.y + enemy.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#82d8ff';
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height * 0.38, enemy.width * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawAsteroid(asteroid) {
    ctx.save();
    ctx.translate(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
    ctx.rotate(asteroid.rotation);

    ctx.fillStyle = asteroid.color;
    ctx.beginPath();
    asteroid.points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawLifeBonus(bonus) {
    const x = bonus.x + bonus.width / 2;
    const y = bonus.y + bonus.height / 2;
    const size = bonus.width / 2;

    ctx.save();
    ctx.fillStyle = '#ff4d6d';

    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.bezierCurveTo(x + size, y - size / 2, x + size, y + size / 2, x, y + size);
    ctx.bezierCurveTo(x - size, y + size / 2, x - size, y - size / 2, x, y - size / 2);
    ctx.fill();

    ctx.restore();
}

function drawPowerUp(powerUp) {
    powerUp.pulse += 0.12;
    const pulseSize = 1 + Math.sin(powerUp.pulse) * 0.06;
    const cx = powerUp.x + powerUp.width / 2;
    const cy = powerUp.y + powerUp.height / 2;

    const style = {
        triple: { fill: '#6df5aa', label: '3X' },
        shield: { fill: '#76f1ff', label: 'S' },
        pierce: { fill: '#ffcf5e', label: 'P' }
    }[powerUp.type];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulseSize, pulseSize);

    ctx.fillStyle = style.fill;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, powerUp.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#021018';
    ctx.font = '700 14px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, 0, 1);

    ctx.restore();
}

function drawBoss(boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    ctx.fillStyle = boss.rage ? '#ff5f7a' : '#c46bff';
    ctx.beginPath();
    ctx.moveTo(boss.width * 0.5, 0);
    ctx.lineTo(boss.width, boss.height * 0.48);
    ctx.lineTo(boss.width * 0.82, boss.height);
    ctx.lineTo(boss.width * 0.18, boss.height);
    ctx.lineTo(0, boss.height * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#8be6ff';
    ctx.beginPath();
    ctx.arc(boss.width * 0.5, boss.height * 0.45, boss.width * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBossUI() {
    if (bosses.length === 0) {
        return;
    }

    const boss = bosses[0];
    const ratio = Math.max(0, boss.health / boss.maxHealth);
    const barWidth = Math.min(canvas.width - 40, 520);
    const barX = (canvas.width - barWidth) / 2;
    const barY = 108;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 24, 0.75)';
    ctx.fillRect(barX, barY, barWidth, 16);

    ctx.fillStyle = '#ff5f7a';
    ctx.fillRect(barX, barY, barWidth * ratio, 16);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(barX, barY, barWidth, 16);

    ctx.fillStyle = '#ffe0ea';
    ctx.font = '700 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(`CHEFAO DA FASE ${phase}`, canvas.width / 2, barY - 8);
    ctx.restore();
}

function drawExplosion(explosion) {
    ctx.save();
    ctx.translate(explosion.x, explosion.y);

    for (let i = 0; i < explosion.particles.length; i++) {
        const particle = explosion.particles[i];
        const lifeProgress = 1 - explosion.life / 26;
        const travel = particle.speed * 24 * lifeProgress;

        ctx.globalAlpha = Math.max(0, explosion.life / 26);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(
            Math.cos(particle.angle) * travel,
            Math.sin(particle.angle) * travel,
            particle.size,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}

function applyScreenShake() {
    if (shakeFrames <= 0) {
        return;
    }

    const dx = (Math.random() - 0.5) * shakePower;
    const dy = (Math.random() - 0.5) * shakePower;
    ctx.translate(dx, dy);

    shakeFrames--;
    shakePower *= 0.9;
}

function requiredScoreForBoss() {
    return phase * 220;
}

function spawnEnemies() {
    if (bosses.length > 0) {
        if (Math.random() < 0.012 && enemies.length < Math.min(5, 2 + phase)) {
            enemies.push(createEnemy());
        }
        return;
    }

    const chance = Math.min(0.038, 0.018 + phase * 0.0028);
    if (Math.random() < chance && enemies.length < 4 + phase) {
        enemies.push(createEnemy());
    }
}

function spawnAsteroids() {
    if (bosses.length > 0) {
        return;
    }

    const chance = Math.min(0.026, 0.01 + phase * 0.0015);
    if (Math.random() < chance && asteroids.length < 2 + Math.floor(phase * 0.7)) {
        asteroids.push(createAsteroid());
    }
}

function spawnLifeBonus() {
    if (Math.random() < 0.0024 && lifeBonuses.length < 1 && lives < 5) {
        lifeBonuses.push(createLifeBonus());
    }
}

function spawnPowerUps() {
    if (powerUps.length >= 2 || bosses.length > 0) {
        return;
    }

    if (Math.random() < 0.0028) {
        const roll = Math.random();
        if (roll < 0.34) {
            powerUps.push(createPowerUp('triple'));
        } else if (roll < 0.67) {
            powerUps.push(createPowerUp('shield'));
        } else {
            powerUps.push(createPowerUp('pierce'));
        }
    }
}

function spawnBossIfNeeded() {
    if (bossTriggered || phaseTransitionLock || bosses.length > 0) {
        return;
    }

    if (score >= requiredScoreForBoss()) {
        bossTriggered = true;
        enemies = [];
        asteroids = [];
        bosses.push(createBoss());
        showToast(`CHEFAO DA FASE ${phase}!`);
        playSfx('alert');
        resetMusicPulse();
    }
}

function updatePlayerBuffs() {
    const now = Date.now();

    if (player.weaponMode !== 'normal' && now >= player.weaponExpiresAt) {
        player.weaponMode = 'normal';
        player.weaponExpiresAt = 0;
    }

    if (now >= player.shieldExpiresAt) {
        player.shieldExpiresAt = 0;
    }
}

function updatePlayer() {
    updatePlayerBuffs();

    if (player.moveLeft && player.x > player.width / 2) {
        player.x -= player.speed;
    }

    if (player.moveRight && player.x < canvas.width - player.width / 2) {
        player.x += player.speed;
    }

    if (player.firing) {
        shootLaser();
    }

    for (let i = player.lasers.length - 1; i >= 0; i--) {
        const laser = player.lasers[i];
        laser.y += laser.isEnemy ? laser.speed : -laser.speed;
        laser.x += laser.vx || 0;

        if (
            laser.y < -30 ||
            laser.y > canvas.height + 30 ||
            laser.x < -30 ||
            laser.x > canvas.width + 30
        ) {
            player.lasers.splice(i, 1);
        }
    }

    if (combo > 1) {
        comboTimer--;
        if (comboTimer <= 0) {
            combo = 1;
            comboTimer = 0;
            updateUI();
        }
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.y += enemy.speed;

        if (enemy.y > canvas.height + enemy.height) {
            enemies.splice(i, 1);
            continue;
        }

        const fireChance = Math.min(0.024, 0.0038 + phase * 0.0017);
        if (phase >= 2 && Math.random() < fireChance) {
            player.lasers.push({
                x: enemy.x + enemy.width / 2 - 2,
                y: enemy.y + enemy.height,
                width: 4,
                height: 12,
                speed: 7,
                vx: (Math.random() - 0.5) * 1.2,
                isEnemy: true
            });
        }
    }
}

function updateBosses() {
    for (let i = bosses.length - 1; i >= 0; i--) {
        const boss = bosses[i];

        if (boss.y < boss.targetY) {
            boss.y += boss.speed;
        } else {
            boss.x += boss.dir * (2 + phase * 0.08);
            if (boss.x < 10 || boss.x + boss.width > canvas.width - 10) {
                boss.dir *= -1;
            }

            boss.patternTimer++;
            if (boss.patternTimer > 120) {
                boss.patternTimer = 0;
                boss.dir *= -1;
            }
        }

        if (!boss.rage && boss.health < boss.maxHealth * 0.45) {
            boss.rage = true;
            playSfx('alert');
            showToast('CHEFAO EM MODO FURIA!');
            resetMusicPulse();
        }

        const fireDelay = boss.rage ? 36 : 54;
        boss.shotTimer++;
        if (boss.y >= boss.targetY && boss.shotTimer >= fireDelay) {
            boss.shotTimer = 0;

            const shotCount = boss.rage ? 5 : 3;
            for (let n = 0; n < shotCount; n++) {
                const spread = (n - (shotCount - 1) / 2) * 1.25;
                player.lasers.push({
                    x: boss.x + boss.width / 2 - 3,
                    y: boss.y + boss.height - 2,
                    width: 6,
                    height: 14,
                    speed: boss.rage ? 8 : 7,
                    vx: spread,
                    isEnemy: true
                });
            }
            playSfx('enemyShot');
        }
    }
}

function updateAsteroids() {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        asteroid.y += asteroid.speed;
        asteroid.rotation += asteroid.rotationSpeed;

        if (asteroid.y > canvas.height + asteroid.height) {
            asteroids.splice(i, 1);
        }
    }
}

function updateLifeBonuses() {
    for (let i = lifeBonuses.length - 1; i >= 0; i--) {
        const bonus = lifeBonuses[i];
        bonus.y += bonus.speed;
        if (bonus.y > canvas.height + bonus.height) {
            lifeBonuses.splice(i, 1);
        }
    }
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.y += powerUp.speed;
        if (powerUp.y > canvas.height + powerUp.height) {
            powerUps.splice(i, 1);
        }
    }
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].life--;
        if (explosions[i].life <= 0) {
            explosions.splice(i, 1);
        }
    }
}

function getRect(obj, centered) {
    if (centered) {
        return {
            x: obj.x - obj.width / 2,
            y: obj.y - obj.height / 2,
            width: obj.width,
            height: obj.height
        };
    }

    return {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height
    };
}

function intersects(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function registerKill(basePoints) {
    combo = Math.min(8, combo + 1);
    comboTimer = 200;
    addScore(basePoints * combo);
    playSfx('hit');
}

function consumeLaserOrPierce(laserIndex) {
    const laser = player.lasers[laserIndex];
    if (!laser) {
        return true;
    }

    if (!laser.isEnemy && laser.pierce && laser.pierce > 0) {
        laser.pierce--;
        if (laser.pierce <= 0) {
            player.lasers.splice(laserIndex, 1);
            return true;
        }
        return false;
    }

    player.lasers.splice(laserIndex, 1);
    return true;
}

function applyPowerUp(type) {
    const now = Date.now();

    if (type === 'triple') {
        player.weaponMode = 'triple';
        player.weaponExpiresAt = now + 10000;
        showToast('TIRO TRIPLO ATIVO');
    } else if (type === 'shield') {
        player.shieldExpiresAt = now + 10000;
        showToast('ESCUDO ATIVO');
    } else if (type === 'pierce') {
        player.weaponMode = 'pierce';
        player.weaponExpiresAt = now + 8000;
        showToast('LASER PERFURANTE');
    }

    playSfx('powerup');
    updateUI();
}

function takeDamage() {
    const now = Date.now();

    if (now < player.invulnerableUntil) {
        return;
    }

    if (now < player.shieldExpiresAt) {
        player.shieldExpiresAt = 0;
        player.invulnerableUntil = now + 900;
        showToast('ESCUDO QUEBRADO');
        playSfx('shieldBreak');
        updateUI();
        return;
    }

    lives--;
    combo = 1;
    comboTimer = 0;
    player.invulnerableUntil = now + 1200;

    explosions.push(createExplosion(player.x, player.y, 40));
    shakeFrames = 8;
    shakePower = 7;
    playSfx('damage');

    updateUI();

    if (lives <= 0) {
        gameOver();
    }
}

function checkCollisions() {
    const playerRect = getRect(player, true);

    for (let i = player.lasers.length - 1; i >= 0; i--) {
        const laser = player.lasers[i];
        const laserRect = getRect(laser, false);

        if (laser.isEnemy) {
            if (intersects(laserRect, playerRect)) {
                player.lasers.splice(i, 1);
                takeDamage();
            }
            continue;
        }

        let laserDone = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (intersects(laserRect, getRect(enemy, false))) {
                enemy.health--;
                laserDone = consumeLaserOrPierce(i);

                if (enemy.health <= 0) {
                    enemies.splice(j, 1);
                    registerKill(12);
                    explosions.push(createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width));
                    shakeFrames = 4;
                    shakePower = 4;
                } else {
                    playSfx('tick');
                }
                break;
            }
        }

        if (laserDone) {
            continue;
        }

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            if (intersects(laserRect, getRect(asteroid, false))) {
                laserDone = consumeLaserOrPierce(i);
                asteroids.splice(j, 1);
                registerKill(7);
                explosions.push(createExplosion(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2, asteroid.width));
                shakeFrames = 2;
                shakePower = 3;
                break;
            }
        }

        if (laserDone) {
            continue;
        }

        for (let j = bosses.length - 1; j >= 0; j--) {
            const boss = bosses[j];
            if (intersects(laserRect, getRect(boss, false))) {
                boss.health -= player.weaponMode === 'pierce' ? 7 : 5;
                consumeLaserOrPierce(i);
                playSfx('tick');

                if (boss.health <= 0) {
                    bosses.splice(j, 1);
                    explosions.push(createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width));
                    addScore(phase * 160);
                    shakeFrames = 14;
                    shakePower = 10;
                    playSfx('bossDown');
                    onBossDefeated();
                }
                break;
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        if (intersects(playerRect, getRect(enemies[i], false))) {
            explosions.push(createExplosion(enemies[i].x + enemies[i].width / 2, enemies[i].y + enemies[i].height / 2, enemies[i].width));
            enemies.splice(i, 1);
            takeDamage();
        }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
        if (intersects(playerRect, getRect(asteroids[i], false))) {
            explosions.push(createExplosion(asteroids[i].x + asteroids[i].width / 2, asteroids[i].y + asteroids[i].height / 2, asteroids[i].width));
            asteroids.splice(i, 1);
            takeDamage();
        }
    }

    for (let i = bosses.length - 1; i >= 0; i--) {
        if (intersects(playerRect, getRect(bosses[i], false))) {
            takeDamage();
        }
    }

    for (let i = lifeBonuses.length - 1; i >= 0; i--) {
        const bonus = lifeBonuses[i];
        if (intersects(playerRect, getRect(bonus, false))) {
            lifeBonuses.splice(i, 1);
            lives = Math.min(5, lives + 1);
            explosions.push(createExplosion(bonus.x + bonus.width / 2, bonus.y + bonus.height / 2, 24));
            playSfx('heal');
            updateUI();
        }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (intersects(playerRect, getRect(powerUp, false))) {
            powerUps.splice(i, 1);
            applyPowerUp(powerUp.type);
        }
    }
}

function addScore(points) {
    score += points;
    updateUI();
}

function onBossDefeated() {
    if (phaseTransitionLock) {
        return;
    }

    phaseTransitionLock = true;
    showToast(`FASE ${phase} COMPLETA`);

    window.setTimeout(() => {
        nextPhase();
    }, 1300);
}

function nextPhase() {
    phase++;
    gameSpeed += 0.35;
    player.shootDelay = Math.max(120, player.shootDelay - 16);
    player.speed = Math.min(12, player.speed + 0.35);

    const colors = ['#59c7ff', '#64f09c', '#ffc164', '#ff7a94', '#b68dff'];
    player.color = colors[(phase - 1) % colors.length];

    enemies = [];
    asteroids = [];
    bosses = [];
    combo = 1;
    comboTimer = 0;
    bossTriggered = false;
    phaseTransitionLock = false;

    showToast(`FASE ${phase} - META ${requiredScoreForBoss()} PTS`);
    resetMusicPulse();
    updateUI();
}

function showToast(message) {
    phaseToast.textContent = message;
    phaseToast.classList.add('show');

    window.setTimeout(() => {
        phaseToast.classList.remove('show');
    }, 1350);
}

function updateUI() {
    const now = Date.now();
    scoreDisplay.textContent = score;
    phaseDisplay.textContent = phase;
    livesDisplay.textContent = lives;
    comboDisplay.textContent = `x${combo}`;

    if (player.weaponMode === 'normal') {
        weaponDisplay.textContent = 'Padrao';
    } else if (player.weaponMode === 'triple') {
        weaponDisplay.textContent = `Triplo ${Math.max(0, Math.ceil((player.weaponExpiresAt - now) / 1000))}s`;
    } else {
        weaponDisplay.textContent = `Perfur. ${Math.max(0, Math.ceil((player.weaponExpiresAt - now) / 1000))}s`;
    }

    shieldDisplay.textContent = now < player.shieldExpiresAt
        ? `On ${Math.max(0, Math.ceil((player.shieldExpiresAt - now) / 1000))}s`
        : 'Off';
}

function gameOver() {
    gameRunning = false;
    player.firing = false;
    document.getElementById('finalScore').textContent = `Pontuacao: ${score}`;
    document.getElementById('gameOverScreen').style.display = 'flex';
    playSfx('gameOver');
    resetMusicPulse();
}

function resetGame() {
    score = 0;
    phase = 1;
    lives = 3;
    gameSpeed = 2.8;
    combo = 1;
    comboTimer = 0;
    phaseTransitionLock = false;
    bossTriggered = false;

    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.color = '#59c7ff';
    player.speed = 8;
    player.shootDelay = 280;
    player.lasers = [];
    player.lastShot = 0;
    player.moveLeft = false;
    player.moveRight = false;
    player.firing = false;
    player.weaponMode = 'normal';
    player.weaponExpiresAt = 0;
    player.shieldExpiresAt = 0;
    player.invulnerableUntil = 0;

    enemies = [];
    asteroids = [];
    explosions = [];
    lifeBonuses = [];
    powerUps = [];
    bosses = [];
    shakeFrames = 0;
    shakePower = 0;

    showToast(`FASE ${phase} - META ${requiredScoreForBoss()} PTS`);
    updateUI();
}

function pushPlayerLaser(vx, width, height, speed, pierce) {
    player.lasers.push({
        x: player.x - width / 2,
        y: player.y - player.height / 2 - 12,
        width,
        height,
        speed,
        vx,
        pierce,
        isEnemy: false
    });
}

function shootLaser() {
    const now = Date.now();
    if (now - player.lastShot < player.shootDelay) {
        return;
    }

    if (player.weaponMode === 'triple') {
        pushPlayerLaser(-1.5, 4, 12, 11, 0);
        pushPlayerLaser(0, 4, 12, 11, 0);
        pushPlayerLaser(1.5, 4, 12, 11, 0);
    } else if (player.weaponMode === 'pierce') {
        pushPlayerLaser(0, 6, 15, 12, 3);
    } else {
        pushPlayerLaser(0, 4, 12, 11, 0);
    }

    player.lastShot = now;
    playSfx('shoot');
}

function gameLoop() {
    if (!gameRunning) {
        return;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyScreenShake();

    drawBackground();
    drawStarfield();
    drawPlanet();

    updatePlayer();
    updateEnemies();
    updateBosses();
    updateAsteroids();
    updateLifeBonuses();
    updatePowerUps();
    updateExplosions();
    checkCollisions();

    spawnEnemies();
    spawnAsteroids();
    spawnLifeBonus();
    spawnPowerUps();
    spawnBossIfNeeded();

    drawPlayer();
    player.lasers.forEach(drawLaser);
    enemies.forEach(drawEnemy);
    asteroids.forEach(drawAsteroid);
    lifeBonuses.forEach(drawLifeBonus);
    powerUps.forEach(drawPowerUp);
    bosses.forEach(drawBoss);
    explosions.forEach(drawExplosion);
    drawBossUI();

    ctx.restore();

    updateUI();
    requestAnimationFrame(gameLoop);
}

function setButtonActive(button, active) {
    if (!button) {
        return;
    }

    if (active) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}

function initAudio() {
    if (audioSystem.initialized) {
        if (audioSystem.ctx.state === 'suspended') {
            audioSystem.ctx.resume();
        }
        return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        return;
    }

    const ctxAudio = new AudioContextClass();
    const masterGain = ctxAudio.createGain();
    const musicGain = ctxAudio.createGain();
    const sfxGain = ctxAudio.createGain();

    masterGain.gain.value = 0.9;
    musicGain.gain.value = 0.22;
    sfxGain.gain.value = 0.34;

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctxAudio.destination);

    audioSystem.ctx = ctxAudio;
    audioSystem.masterGain = masterGain;
    audioSystem.musicGain = musicGain;
    audioSystem.sfxGain = sfxGain;
    audioSystem.sequenceStep = 0;
    audioSystem.initialized = true;

    resetMusicPulse();
}

function playTone(freq, duration, type, gainNode, volume) {
    if (!audioSystem.initialized || audioSystem.muted) {
        return;
    }

    const t = audioSystem.ctx.currentTime;
    const osc = audioSystem.ctx.createOscillator();
    const gain = audioSystem.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(gainNode);

    osc.start(t);
    osc.stop(t + duration + 0.02);
}

function playSfx(kind) {
    if (!audioSystem.initialized || audioSystem.muted) {
        return;
    }

    if (kind === 'shoot') {
        playTone(560, 0.08, 'square', audioSystem.sfxGain, 0.05);
    } else if (kind === 'enemyShot') {
        playTone(210, 0.09, 'triangle', audioSystem.sfxGain, 0.06);
    } else if (kind === 'tick') {
        playTone(220, 0.05, 'sine', audioSystem.sfxGain, 0.035);
    } else if (kind === 'hit') {
        playTone(130, 0.13, 'sawtooth', audioSystem.sfxGain, 0.08);
    } else if (kind === 'damage') {
        playTone(95, 0.26, 'sawtooth', audioSystem.sfxGain, 0.14);
    } else if (kind === 'shieldBreak') {
        playTone(280, 0.2, 'triangle', audioSystem.sfxGain, 0.12);
    } else if (kind === 'powerup') {
        playTone(440, 0.09, 'square', audioSystem.sfxGain, 0.07);
        playTone(660, 0.12, 'triangle', audioSystem.sfxGain, 0.06);
    } else if (kind === 'heal') {
        playTone(380, 0.1, 'sine', audioSystem.sfxGain, 0.07);
        playTone(520, 0.14, 'sine', audioSystem.sfxGain, 0.06);
    } else if (kind === 'bossDown') {
        playTone(180, 0.28, 'sawtooth', audioSystem.sfxGain, 0.13);
        playTone(120, 0.35, 'triangle', audioSystem.sfxGain, 0.12);
    } else if (kind === 'alert') {
        playTone(240, 0.14, 'square', audioSystem.sfxGain, 0.08);
    } else if (kind === 'gameOver') {
        playTone(170, 0.3, 'triangle', audioSystem.sfxGain, 0.1);
        playTone(130, 0.42, 'sine', audioSystem.sfxGain, 0.1);
    }
}

function playMusicStep() {
    if (!audioSystem.initialized || audioSystem.muted) {
        return;
    }

    const normalScale = [220, 262, 294, 330, 349, 392, 440];
    const bossScale = [130, 146, 174, 196, 220, 246, 261];
    const isBossTime = bosses.length > 0;

    const scale = isBossTime ? bossScale : normalScale;
    const interval = Math.max(190, 360 - phase * 16 - (isBossTime ? 80 : 0));

    if (audioSystem.noteIntervalId) {
        clearInterval(audioSystem.noteIntervalId);
        audioSystem.noteIntervalId = null;
    }

    audioSystem.noteIntervalId = window.setInterval(() => {
        if (!gameRunning) {
            return;
        }

        const idx = (audioSystem.sequenceStep + phase) % scale.length;
        const baseFreq = scale[idx] * (isBossTime ? 1 : 1 + (phase % 4) * 0.06);
        const noteType = isBossTime ? 'sawtooth' : 'triangle';

        playTone(baseFreq, 0.16, noteType, audioSystem.musicGain, isBossTime ? 0.06 : 0.045);
        if (!isBossTime && audioSystem.sequenceStep % 2 === 0) {
            playTone(baseFreq * 0.5, 0.14, 'sine', audioSystem.musicGain, 0.03);
        }

        audioSystem.sequenceStep++;
    }, interval);
}

function resetMusicPulse() {
    if (!audioSystem.initialized) {
        return;
    }

    playMusicStep();
}

function toggleMute() {
    if (!audioSystem.initialized) {
        return;
    }

    audioSystem.muted = !audioSystem.muted;
    const value = audioSystem.muted ? 0 : 0.9;
    audioSystem.masterGain.gain.value = value;
    showToast(audioSystem.muted ? 'AUDIO: OFF' : 'AUDIO: ON');
}

function setupControls() {
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');
    const fireButton = document.getElementById('fireButton');

    const pressLeft = (active) => {
        player.moveLeft = active;
        if (active) {
            player.moveRight = false;
            setButtonActive(rightButton, false);
        }
        setButtonActive(leftButton, active);
    };

    const pressRight = (active) => {
        player.moveRight = active;
        if (active) {
            player.moveLeft = false;
            setButtonActive(leftButton, false);
        }
        setButtonActive(rightButton, active);
    };

    const pressFire = (active) => {
        player.firing = active;
        setButtonActive(fireButton, active);
        if (active) {
            shootLaser();
        }
    };

    leftButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudio();
        pressLeft(true);
    });
    leftButton.addEventListener('pointerup', (e) => {
        e.preventDefault();
        pressLeft(false);
    });
    leftButton.addEventListener('pointercancel', () => pressLeft(false));
    leftButton.addEventListener('pointerleave', () => pressLeft(false));

    rightButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudio();
        pressRight(true);
    });
    rightButton.addEventListener('pointerup', (e) => {
        e.preventDefault();
        pressRight(false);
    });
    rightButton.addEventListener('pointercancel', () => pressRight(false));
    rightButton.addEventListener('pointerleave', () => pressRight(false));

    fireButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudio();
        pressFire(true);
    });
    fireButton.addEventListener('pointerup', (e) => {
        e.preventDefault();
        pressFire(false);
    });
    fireButton.addEventListener('pointercancel', () => pressFire(false));
    fireButton.addEventListener('pointerleave', () => pressFire(false));

    document.addEventListener('keydown', (e) => {
        if (!gameRunning) {
            return;
        }

        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
            pressLeft(true);
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
            pressRight(true);
        } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
            e.preventDefault();
            pressFire(true);
        } else if (e.key.toLowerCase() === 'm') {
            toggleMute();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
            pressLeft(false);
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
            pressRight(false);
        } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
            pressFire(false);
        }
    });

    window.addEventListener('blur', () => {
        pressLeft(false);
        pressRight(false);
        pressFire(false);
    });
}

function setupMenu() {
    document.getElementById('startButton').addEventListener('click', () => {
        initAudio();
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('instructionsScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        resetGame();
        gameRunning = true;
        resetMusicPulse();
        gameLoop();
    });

    document.getElementById('instructionsButton').addEventListener('click', () => {
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('instructionsScreen').style.display = 'flex';
    });

    document.getElementById('backButton').addEventListener('click', () => {
        document.getElementById('instructionsScreen').style.display = 'none';
        document.getElementById('menuScreen').style.display = 'flex';
    });

    document.getElementById('restartButton').addEventListener('click', () => {
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('menuScreen').style.display = 'flex';
    });
}

function initGame() {
    setupCanvas();
    setupControls();
    setupMenu();
    resetGame();
}

document.addEventListener('DOMContentLoaded', initGame);
