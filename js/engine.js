// ============================================================
// ENGINE.JS - Core game engine: config, input, physics, camera,
//             particles, rendering pipeline
// ============================================================

// ---- CONFIGURATION ----
const CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    TILE: 48,
    GRAVITY: 0.65,
    MAX_FALL_SPEED: 14,
    FRICTION: 0.82,

    PLAYER: {
        SPEED: 4.5,
        JUMP_FORCE: -13,
        WALL_JUMP_FORCE_X: 8,
        WALL_JUMP_FORCE_Y: -11,
        WIDTH: 28,
        HEIGHT: 44,
        WALL_SLIDE_SPEED: 1.8,
        COYOTE_TIME: 8,
        JUMP_BUFFER: 8,
    },

    COLORS: {
        VOID_PURPLE: '#6b2fa0',
        VOID_DARK: '#2a1040',
        VOID_GLOW: '#9b4fd0',
        WOOD_DARK: '#3d2517',
        WOOD_MID: '#5c3a1e',
        WOOD_LIGHT: '#7a5230',
        BOOK_COLORS: ['#8b1a1a', '#1a3c6b', '#2d5a1e', '#6b4a1a', '#4a1a5c', '#1a5a5a', '#6b5a1a', '#3a1a1a'],
        GOLD: '#c4a24e',
        SUNLIGHT: 'rgba(255, 220, 150, 0.08)',
        BG_DARK: '#0e0b14',
        BG_MID: '#1a1422',
        BG_LIGHT: '#251e30',
    }
};

// ---- INPUT SYSTEM ----
const Input = {
    keys: {},
    keysJustPressed: {},
    keysReleased: {},
    _prevKeys: {},

    init() {
        window.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            e.preventDefault();
            this.keys[e.code] = false;
            this.keysReleased[e.code] = true;
        });
    },

    update() {
        for (let key in this.keys) {
            this.keysJustPressed[key] = this.keys[key] && !this._prevKeys[key];
        }
        this._prevKeys = { ...this.keys };
    },

    endFrame() {
        this.keysReleased = {};
    },

    isDown(code) { return !!this.keys[code]; },
    justPressed(code) { return !!this.keysJustPressed[code]; },
    justReleased(code) { return !!this.keysReleased[code]; },

    get left() { return this.isDown('ArrowLeft') || this.isDown('KeyA'); },
    get right() { return this.isDown('ArrowRight') || this.isDown('KeyD'); },
    get up() { return this.isDown('ArrowUp') || this.isDown('KeyW'); },
    get down() { return this.isDown('ArrowDown') || this.isDown('KeyS'); },
    get jump() { return this.justPressed('Space') || this.justPressed('ArrowUp') || this.justPressed('KeyW'); },
    get attack() { return this.justPressed('KeyJ') || this.justPressed('KeyZ'); },
    get powerAttack() { return this.isDown('KeyK') || this.isDown('KeyX'); },
    get powerAttackRelease() { return this.justReleased('KeyK') || this.justReleased('KeyX'); },
    get skill() { return this.justPressed('KeyL') || this.justPressed('KeyC'); },
    get dodge() { return this.justPressed('ShiftLeft') || this.justPressed('ShiftRight'); },
    get facing() { return this.left ? -1 : this.right ? 1 : 0; },
};

// ---- CAMERA ----
const Camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    shakeX: 0, shakeY: 0,
    shakeDuration: 0,
    shakeIntensity: 0,
    bounds: { minX: 0, minY: 0, maxX: 5000, maxY: CONFIG.HEIGHT },

    follow(target, levelWidth, levelHeight) {
        this.targetX = target.x + target.width / 2 - CONFIG.WIDTH / 2;
        this.targetY = target.y + target.height / 2 - CONFIG.HEIGHT / 2 + 30;

        // Faster follow for both axes - responsive for vertical movement
        this.x += (this.targetX - this.x) * 0.1;
        this.y += (this.targetY - this.y) * 0.1;

        this.x = Math.max(0, Math.min(this.x, Math.max(0, levelWidth - CONFIG.WIDTH)));
        this.y = Math.max(-100, Math.min(this.y, Math.max(0, levelHeight - CONFIG.HEIGHT)));

        if (this.shakeDuration > 0) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeDuration--;
            this.shakeIntensity *= 0.95;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    },

    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    },

    screenX(worldX) { return worldX - this.x + this.shakeX; },
    screenY(worldY) { return worldY - this.y + this.shakeY; },

    reset() {
        this.x = 0; this.y = 0;
        this.targetX = 0; this.targetY = 0;
        this.shakeX = 0; this.shakeY = 0;
        this.shakeDuration = 0;
    }
};

// ---- PARTICLE SYSTEM ----
class Particle {
    constructor(x, y, vx, vy, life, color, size, gravity = 0, fadeOut = true, glow = false) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
        this.gravity = gravity;
        this.fadeOut = fadeOut;
        this.glow = glow;
        this.dead = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.98;
        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        const alpha = this.fadeOut ? this.life / this.maxLife : 1;
        ctx.globalAlpha = alpha;
        if (this.glow) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.size * 3;
        }
        ctx.fillStyle = this.color;
        ctx.fillRect(
            Camera.screenX(this.x) - this.size / 2,
            Camera.screenY(this.y) - this.size / 2,
            this.size, this.size
        );
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

const Particles = {
    list: [],

    add(p) { this.list.push(p); },

    burst(x, y, count, color, opts = {}) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (opts.speed || 3) * (0.3 + Math.random() * 0.7);
            this.list.push(new Particle(
                x + (Math.random() - 0.5) * (opts.spread || 8),
                y + (Math.random() - 0.5) * (opts.spread || 8),
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                opts.life || (20 + Math.random() * 30),
                color,
                opts.size || (2 + Math.random() * 3),
                opts.gravity || 0.05,
                opts.fadeOut !== false,
                opts.glow || false
            ));
        }
    },

    update() {
        for (let i = this.list.length - 1; i >= 0; i--) {
            this.list[i].update();
            if (this.list[i].dead) this.list.splice(i, 1);
        }
    },

    draw(ctx) {
        this.list.forEach(p => p.draw(ctx));
    },

    clear() { this.list = []; }
};

// ---- COLLISION DETECTION ----
const Physics = {
    rectOverlap(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    },

    resolveCollisions(entity, platforms) {
        let onGround = false;
        let onWallLeft = false;
        let onWallRight = false;

        // Horizontal
        entity.x += entity.vx;
        for (const p of platforms) {
            if (this.rectOverlap(entity, p)) {
                if (entity.vx > 0) {
                    entity.x = p.x - entity.width;
                    onWallRight = true;
                } else if (entity.vx < 0) {
                    entity.x = p.x + p.width;
                    onWallLeft = true;
                }
                entity.vx = 0;
            }
        }

        // Vertical
        entity.y += entity.vy;
        for (const p of platforms) {
            if (this.rectOverlap(entity, p)) {
                if (entity.vy > 0) {
                    entity.y = p.y - entity.height;
                    onGround = true;
                } else if (entity.vy < 0) {
                    entity.y = p.y + p.height;
                }
                entity.vy = 0;
            }
        }

        return { onGround, onWallLeft, onWallRight };
    }
};

// ---- RENDERER ----
const Renderer = {
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        const aspect = CONFIG.WIDTH / CONFIG.HEIGHT;
        let w = window.innerWidth;
        let h = window.innerHeight;
        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }
        this.canvas.width = CONFIG.WIDTH;
        this.canvas.height = CONFIG.HEIGHT;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    },

    clear() {
        this.ctx.fillStyle = CONFIG.COLORS.BG_DARK;
        this.ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    },

    // Draw parallax background layers
    drawBackground(chapter, levelWidth) {
        const ctx = this.ctx;
        const cx = Camera.x;

        // Layer 0: Deep background - dark library walls
        ctx.fillStyle = CONFIG.COLORS.BG_DARK;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Gradient atmosphere
        const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
        grad.addColorStop(0, 'rgba(30, 20, 40, 1)');
        grad.addColorStop(0.5, 'rgba(20, 15, 30, 1)');
        grad.addColorStop(1, 'rgba(10, 8, 18, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Layer 1: Far bookshelves (0.1 parallax)
        this.drawFarBookshelves(ctx, cx * 0.1, chapter);

        // Layer 2: Mid bookshelves and windows (0.3 parallax)
        this.drawMidLayer(ctx, cx * 0.3, chapter);

        // Layer 3: Sunlight beams (0.2 parallax)
        this.drawSunbeams(ctx, cx * 0.2, chapter);

        // Layer 4: Atmospheric dust particles
        this.drawDust(ctx, cx * 0.15);
    },

    drawFarBookshelves(ctx, offsetX, chapter) {
        ctx.save();
        // Far away tall bookshelves
        for (let i = 0; i < 12; i++) {
            const x = i * 200 - (offsetX % 200) - 100;
            const h = 400 + Math.sin(i * 1.7) * 100;

            // Shelf frame
            ctx.fillStyle = 'rgba(35, 22, 15, 0.6)';
            ctx.fillRect(x, CONFIG.HEIGHT - h, 80, h);

            // Shelf divisions
            for (let s = 0; s < 5; s++) {
                const sy = CONFIG.HEIGHT - h + s * (h / 5);
                ctx.fillStyle = 'rgba(45, 30, 20, 0.5)';
                ctx.fillRect(x, sy, 80, 3);

                // Tiny books
                for (let b = 0; b < 6; b++) {
                    const bx = x + 5 + b * 12;
                    const bh = 15 + Math.sin(i * 3 + b * 2) * 8;
                    const colorIdx = (i + b + s) % CONFIG.COLORS.BOOK_COLORS.length;
                    ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx] + '40';
                    ctx.fillRect(bx, sy + (h / 5) - bh - 3, 10, bh);
                }
            }
        }
        ctx.restore();
    },

    drawMidLayer(ctx, offsetX, chapter) {
        ctx.save();
        // Mid-distance decorative elements
        for (let i = 0; i < 8; i++) {
            const x = i * 320 - (offsetX % 320) - 160;

            // Arched window frames
            if (i % 3 === 0) {
                ctx.fillStyle = 'rgba(50, 35, 25, 0.7)';
                ctx.fillRect(x + 40, CONFIG.HEIGHT - 350, 100, 250);

                // Window light
                const wGrad = ctx.createRadialGradient(x + 90, CONFIG.HEIGHT - 300, 5, x + 90, CONFIG.HEIGHT - 300, 80);
                wGrad.addColorStop(0, 'rgba(255, 220, 150, 0.12)');
                wGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
                ctx.fillStyle = wGrad;
                ctx.fillRect(x + 20, CONFIG.HEIGHT - 380, 140, 300);
            }

            // Globe or telescope silhouette
            if (i % 4 === 2) {
                ctx.fillStyle = 'rgba(40, 28, 18, 0.5)';
                // Telescope stand
                ctx.fillRect(x + 60, CONFIG.HEIGHT - 180, 4, 80);
                ctx.fillRect(x + 50, CONFIG.HEIGHT - 100, 24, 4);
                // Telescope tube
                ctx.save();
                ctx.translate(x + 62, CONFIG.HEIGHT - 180);
                ctx.rotate(-0.4);
                ctx.fillRect(-3, -40, 6, 50);
                ctx.fillRect(-6, -45, 12, 8);
                ctx.restore();
            }

            // Bookshelves mid
            const h = 250 + Math.sin(i * 2.3) * 80;
            ctx.fillStyle = 'rgba(45, 28, 18, 0.5)';
            ctx.fillRect(x + 150, CONFIG.HEIGHT - h, 60, h);

            for (let s = 0; s < 4; s++) {
                const sy = CONFIG.HEIGHT - h + s * (h / 4);
                ctx.fillStyle = 'rgba(55, 38, 25, 0.4)';
                ctx.fillRect(x + 150, sy, 60, 2);
                for (let b = 0; b < 4; b++) {
                    const bx = x + 153 + b * 14;
                    const bh = 20 + Math.sin(i * 2 + b * 3 + s) * 10;
                    const colorIdx = (i + b + s + 3) % CONFIG.COLORS.BOOK_COLORS.length;
                    ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx] + '55';
                    ctx.fillRect(bx, sy + (h / 4) - bh - 2, 11, bh);
                }
            }
        }
        ctx.restore();
    },

    drawSunbeams(ctx, offsetX, chapter) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < 5; i++) {
            const x = i * 400 - (offsetX % 400) + 100;
            const grad = ctx.createLinearGradient(x, 0, x + 150, CONFIG.HEIGHT);
            const intensity = 0.04 + Math.sin(Date.now() / 3000 + i) * 0.02;
            grad.addColorStop(0, `rgba(255, 220, 150, ${intensity})`);
            grad.addColorStop(0.5, `rgba(255, 200, 120, ${intensity * 0.5})`);
            grad.addColorStop(1, `rgba(255, 180, 100, 0)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 60, 0);
            ctx.lineTo(x + 180, CONFIG.HEIGHT);
            ctx.lineTo(x + 80, CONFIG.HEIGHT);
            ctx.closePath();
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    },

    drawDust(ctx, offsetX) {
        ctx.save();
        const time = Date.now() / 1000;
        for (let i = 0; i < 40; i++) {
            const seed = i * 137.508;
            const x = ((seed * 7.3 + time * 8 + offsetX * 0.3) % (CONFIG.WIDTH + 100)) - 50;
            const y = ((seed * 3.7 + Math.sin(time + seed) * 30) % CONFIG.HEIGHT);
            const alpha = 0.15 + Math.sin(time * 0.5 + seed) * 0.1;
            const size = 1 + Math.sin(seed) * 0.5;

            ctx.fillStyle = `rgba(255, 220, 180, ${alpha})`;
            ctx.fillRect(x, y, size, size);
        }
        ctx.restore();
    },

    // Draw foreground parallax elements (Hollow Knight style)
    drawForeground(ctx, levelWidth) {
        const cx = Camera.x;
        ctx.save();

        // Foreground bookshelf edges (1.2 parallax - moves faster = closer)
        const fgOffset = cx * 1.15;
        for (let i = 0; i < 6; i++) {
            const x = i * 450 - (fgOffset % 450) - 100;

            // Dark bookshelf edge
            ctx.fillStyle = 'rgba(20, 12, 8, 0.85)';
            ctx.fillRect(x, CONFIG.HEIGHT - 500, 35, 500);

            // Book spines on foreground shelf
            for (let b = 0; b < 3; b++) {
                const by = CONFIG.HEIGHT - 480 + b * 100;
                const colorIdx = (i + b) % CONFIG.COLORS.BOOK_COLORS.length;
                ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx] + '90';
                ctx.fillRect(x + 3, by, 28, 25 + Math.sin(i + b) * 10);
            }

            // Dark shadow gradient from edge
            const sg = ctx.createLinearGradient(x + 35, 0, x + 120, 0);
            sg.addColorStop(0, 'rgba(10, 6, 4, 0.4)');
            sg.addColorStop(1, 'rgba(10, 6, 4, 0)');
            ctx.fillStyle = sg;
            ctx.fillRect(x + 35, CONFIG.HEIGHT - 500, 85, 500);
        }

        // Floating dust motes in foreground
        const time = Date.now() / 1000;
        for (let i = 0; i < 15; i++) {
            const seed = i * 97.3;
            const x = ((seed * 5.1 + time * 15) % (CONFIG.WIDTH + 200)) - 100;
            const y = ((seed * 2.3 + Math.sin(time * 0.7 + seed) * 50) % CONFIG.HEIGHT);
            const alpha = 0.2 + Math.sin(time * 0.3 + seed) * 0.15;
            const size = 2 + Math.sin(seed) * 1;

            ctx.fillStyle = `rgba(255, 230, 190, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    // Draw a platform styled as bookshelf
    drawPlatform(ctx, p) {
        const sx = Camera.screenX(p.x);
        const sy = Camera.screenY(p.y);

        if (sx + p.width < -50 || sx > CONFIG.WIDTH + 50) return;
        if (sy + p.height < -50 || sy > CONFIG.HEIGHT + 50) return;

        if (p.type === 'bookshelf') {
            this.drawBookshelfPlatform(ctx, sx, sy, p.width, p.height);
        } else if (p.type === 'books') {
            this.drawBooksPlatform(ctx, sx, sy, p.width, p.height, p.seed || 0);
        } else if (p.type === 'desk') {
            this.drawDeskPlatform(ctx, sx, sy, p.width, p.height);
        } else {
            this.drawBookshelfPlatform(ctx, sx, sy, p.width, p.height);
        }
    },

    drawBookshelfPlatform(ctx, x, y, w, h) {
        // Main wood body
        ctx.fillStyle = CONFIG.COLORS.WOOD_MID;
        ctx.fillRect(x, y, w, h);

        // Top edge (lighter)
        ctx.fillStyle = CONFIG.COLORS.WOOD_LIGHT;
        ctx.fillRect(x, y, w, 4);

        // Bottom shadow
        ctx.fillStyle = CONFIG.COLORS.WOOD_DARK;
        ctx.fillRect(x, y + h - 3, w, 3);

        // Side edges
        ctx.fillStyle = CONFIG.COLORS.WOOD_DARK;
        ctx.fillRect(x, y, 3, h);
        ctx.fillRect(x + w - 3, y, 3, h);

        // Books on top decorative (if tall enough)
        if (h >= 24) {
            const bookCount = Math.floor(w / 16);
            for (let i = 0; i < bookCount; i++) {
                const bx = x + 5 + i * (w / bookCount);
                const bh = 8 + (Math.sin(x + i * 3) * 4);
                const colorIdx = Math.abs(Math.floor(x / 10 + i)) % CONFIG.COLORS.BOOK_COLORS.length;
                ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx];
                ctx.fillRect(bx, y + 5, Math.min(12, w / bookCount - 2), bh);
            }
        }

        // Wood grain lines
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const ly = y + h * 0.3 + i * (h * 0.2);
            ctx.beginPath();
            ctx.moveTo(x + 4, ly);
            ctx.lineTo(x + w - 4, ly);
            ctx.stroke();
        }
    },

    drawBooksPlatform(ctx, x, y, w, h, seed) {
        // Stack of books as small platform
        const bookCount = Math.max(2, Math.floor(w / 20));
        for (let i = 0; i < bookCount; i++) {
            const bw = w / bookCount + (Math.sin(seed + i) * 4);
            const bx = x + i * (w / bookCount);
            const colorIdx = Math.abs(Math.floor(seed + i * 2)) % CONFIG.COLORS.BOOK_COLORS.length;

            ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx];
            ctx.fillRect(bx, y + i * 2, bw, h - i * 2);

            // Book edge
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(bx, y + i * 2, bw, 2);

            // Pages visible
            ctx.fillStyle = 'rgba(240, 230, 210, 0.3)';
            ctx.fillRect(bx + 2, y + i * 2 + 3, bw - 4, h - i * 2 - 5);
        }
    },

    drawDeskPlatform(ctx, x, y, w, h) {
        // Desk top
        ctx.fillStyle = '#5a3d25';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#6b4a30';
        ctx.fillRect(x, y, w, 5);
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(x, y + h - 3, w, 3);

        // Desk legs
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(x + 5, y + h, 8, 30);
        ctx.fillRect(x + w - 13, y + h, 8, 30);
    },

    // Draw rope - curves when player is swinging on it
    drawRope(ctx, rope, player) {
        const sx = Camera.screenX(rope.x);
        const sy1 = Camera.screenY(rope.topY);
        const ropeLen = rope.bottomY - rope.topY;

        // Check if player is on this rope
        const playerOnThis = player && player.onRope && player.ropeRef === rope;
        const swingAngle = playerOnThis ? player.ropeSwingAngle : 0;
        const gripY = playerOnThis ? player.ropeY : 0;

        // Idle sway when no one is on the rope
        const time = Date.now() / 1000;
        const idleSway = playerOnThis ? 0 : Math.sin(time * 1.5 + rope.x * 0.1) * 0.12;

        ctx.save();

        // --- Draw rope hanging from top anchor, bottom is FREE ---
        ctx.strokeStyle = '#8a7a60';
        ctx.lineWidth = 3;

        if (playerOnThis) {
            // Player on rope: TAUT straight lines (rope is under tension)
            // Use player's actual position (not ropeY param) so rope stays aligned during swing
            const gripScreenX = Camera.screenX(player.x + player.width / 2);
            const gripScreenY = Camera.screenY(player.y + player.height * 0.3);

            // Upper portion: straight taut line from anchor to grip
            ctx.beginPath();
            ctx.moveTo(sx, sy1);
            ctx.lineTo(gripScreenX, gripScreenY);
            ctx.stroke();

            // Lower portion: hangs straight down from grip point
            const gripWorldY = player.y + player.height * 0.3;
            const lowerLen = rope.bottomY - player.ropeY;
            const endScreenX = gripScreenX;
            const endScreenY = gripScreenY + lowerLen;

            ctx.beginPath();
            ctx.moveTo(gripScreenX, gripScreenY);
            ctx.lineTo(endScreenX, endScreenY);
            ctx.stroke();

            // Frayed rope end
            ctx.strokeStyle = '#6a5a40';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(endScreenX, endScreenY);
                ctx.lineTo(endScreenX + (i - 1) * 3, endScreenY + 8 + i * 2);
                ctx.stroke();
            }

            // Knots along upper taut rope
            ctx.fillStyle = '#6a5a40';
            for (let t = 0.25; t <= 0.75; t += 0.25) {
                const kx = sx + (gripScreenX - sx) * t;
                const ky = sy1 + (gripScreenY - sy1) * t;
                ctx.beginPath();
                ctx.arc(kx, ky, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // No one on rope: hangs from top only, bottom swings free
            const angle = idleSway;
            // The whole rope swings as one piece from the top anchor
            // Bottom end = pendulum tip, moves most
            const endWorldX = rope.x + Math.sin(angle) * ropeLen;
            const endWorldY = rope.topY + Math.cos(angle) * ropeLen;
            const endScreenX = Camera.screenX(endWorldX);
            const endScreenY = Camera.screenY(endWorldY);

            // Draw rope as segments from anchor to free end
            ctx.beginPath();
            ctx.moveTo(sx, sy1);
            const segments = 8;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                // Each point swings proportionally - more at bottom
                const pointAngle = angle * t;
                const pointLen = ropeLen * t;
                const px = Camera.screenX(rope.x + Math.sin(pointAngle) * pointLen);
                const py = Camera.screenY(rope.topY + Math.cos(pointAngle) * pointLen);
                ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Frayed rope end (clearly free/untied)
            ctx.strokeStyle = '#7a6a50';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(endScreenX, endScreenY);
                ctx.lineTo(endScreenX + (i - 1) * 3, endScreenY + 8 + i * 2);
                ctx.stroke();
            }

            // Knots along rope
            ctx.fillStyle = '#6a5a40';
            for (let t = 0.25; t < 0.85; t += 0.3) {
                const pointAngle = angle * t;
                const pointLen = ropeLen * t;
                const kx = Camera.screenX(rope.x + Math.sin(pointAngle) * pointLen);
                const ky = Camera.screenY(rope.topY + Math.cos(pointAngle) * pointLen);
                ctx.beginPath();
                ctx.arc(kx, ky, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Anchor point at top (hook/bracket)
        ctx.fillStyle = '#5a4a30';
        ctx.beginPath();
        ctx.arc(sx, sy1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a3a20';
        ctx.fillRect(sx - 8, sy1 - 3, 16, 6);

        // Glow indicator for grab area (subtle pulsing)
        if (!playerOnThis) {
            const glowY = Camera.screenY(rope.topY + ropeLen * 0.4);
            const pulse = 0.08 + Math.sin(time * 2) * 0.04;
            ctx.fillStyle = `rgba(200, 180, 140, ${pulse})`;
            ctx.beginPath();
            ctx.arc(sx, glowY, 28, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
};

// ---- SOUND MANAGER (Web Audio API - simple beep/noise synth) ----
const Sound = {
    ctx: null,
    enabled: true,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    play(type) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        switch (type) {
            case 'jump': this._beep(440, 0.06, 'square', 0.15); break;
            case 'attack': this._noise(0.06, 800, 0.2); break;
            case 'powerAttack': this._beep(220, 0.15, 'sawtooth', 0.2); this._noise(0.1, 400, 0.15); break;
            case 'hit': this._beep(150, 0.1, 'square', 0.2); this._noise(0.08, 600, 0.25); break;
            case 'enemyHit': this._beep(300, 0.05, 'square', 0.1); break;
            case 'enemyDie': this._beep(200, 0.2, 'sawtooth', 0.15); this._beep(150, 0.3, 'sawtooth', 0.1); break;
            case 'skill': this._beep(523, 0.3, 'sine', 0.2); this._beep(659, 0.3, 'sine', 0.15); break;
            case 'reward': this._beep(523, 0.15, 'sine', 0.15); this._beep(659, 0.15, 'sine', 0.15); this._beep(784, 0.2, 'sine', 0.15); break;
            case 'death': this._beep(200, 0.4, 'sawtooth', 0.2); this._beep(150, 0.5, 'sawtooth', 0.15); break;
            case 'bossAppear': this._beep(100, 0.5, 'sawtooth', 0.25); this._noise(0.3, 200, 0.2); break;
            case 'wallJump': this._beep(520, 0.05, 'square', 0.1); break;
            case 'rope': this._beep(350, 0.04, 'sine', 0.08); break;
            case 'dodge': this._beep(300, 0.08, 'sine', 0.12); this._noise(0.06, 100, 0.08); break;
            case 'charge': this._beep(200 + Math.random() * 100, 0.04, 'sine', 0.05); break;
            case 'select': this._beep(600, 0.05, 'sine', 0.1); break;
        }
    },

    _beep(freq, duration, type, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    _noise(duration, filterFreq, volume) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
    }
};

// ---- SPRITE LOADER ----
const SpriteLoader = {
    images: {},
    loaded: false,
    totalCount: 0,
    loadedCount: 0,

    load(name, path) {
        this.totalCount++;
        const img = new Image();
        img.onload = () => {
            this.loadedCount++;
            if (this.loadedCount >= this.totalCount) this.loaded = true;
        };
        img.onerror = () => {
            console.warn('Failed to load sprite:', path);
            this.loadedCount++;
            if (this.loadedCount >= this.totalCount) this.loaded = true;
        };
        img.src = path;
        this.images[name] = img;
    },

    get(name) {
        return this.images[name] || null;
    },

    init() {
        const base = 'assets/player/';
        this.load('idle_1', base + 'idle_1.png');
        this.load('idle_2', base + 'idle_2.png');
        this.load('run_1', base + 'run_1.png');
        this.load('run_2', base + 'run_2.png');
        this.load('jump', base + 'jump_1.png');
        this.load('fall', base + 'jump_2 (fall).png');
        this.load('attack', base + 'attack yoyo.png');
        this.load('power_charge', base + 'power attack_cast.png');
        this.load('power_release', base + 'power attack_throw.png');
        this.load('dodge_1', base + 'dodge roll_1.png');
        this.load('dodge_2', base + 'dodge roll_2.png');
        this.load('dodge_3', base + 'dodge roll_3.png');
        this.load('dodge_4', base + 'dodge roll_4.png');
    }
};

// ---- UTILITY FUNCTIONS ----
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function randomRange(min, max) { return min + Math.random() * (max - min); }
function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
