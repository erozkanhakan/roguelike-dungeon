// ============================================================
// ENEMIES.JS - Void creatures and Infernal bosses
// ============================================================

// ---- BASE ENEMY ----
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = 0;
        this.vy = 0;
        this.width = 30;
        this.height = 30;
        this.hp = 30;
        this.maxHp = 30;
        this.damage = 10;
        this.speed = 1.5;
        this.dead = false;
        this.deathTimer = 0;
        this.hitFlash = 0;
        this.facing = -1;
        this.aggroRange = 300;
        this.attackRange = 40;
        this.attackTimer = 0;
        this.attackCooldown = 60;
        this.state = 'patrol'; // patrol, chase, attack, hurt
        this.patrolDir = Math.random() > 0.5 ? 1 : -1;
        this.patrolTimer = 0;
        this.patrolDuration = 120 + Math.random() * 120;
        this.animTimer = 0;
        this.startX = x;
        this.patrolRange = 150;
        this.hitList = []; // track which attacks already hit
    }

    update(player, platforms) {
        if (this.dead) {
            this.deathTimer++;
            this.vy += 0.3;
            this.y += this.vy;
            return;
        }

        this.animTimer++;
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.attackTimer > 0) this.attackTimer--;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // State machine
        if (distance < this.aggroRange && !player.dead) {
            this.state = 'chase';
            this.facing = dx > 0 ? 1 : -1;

            if (distance < this.attackRange && this.attackTimer <= 0) {
                this.state = 'attack';
                this.attackTimer = this.attackCooldown;
            }
        } else {
            this.state = 'patrol';
        }

        // Movement
        switch (this.state) {
            case 'patrol':
                this.patrolTimer++;
                if (this.patrolTimer > this.patrolDuration || Math.abs(this.x - this.startX) > this.patrolRange) {
                    this.patrolDir *= -1;
                    this.patrolTimer = 0;
                }
                this.vx = this.patrolDir * this.speed * 0.5;
                this.facing = this.patrolDir;
                break;
            case 'chase':
                this.vx = Math.sign(dx) * this.speed;
                break;
            case 'attack':
                this.vx *= 0.5;
                break;
        }

        // Gravity
        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;

        // Collisions
        Physics.resolveCollisions(this, platforms);
    }

    takeDamage(amount, knockbackDir = 0) {
        if (this.dead) return;
        this.hp -= amount;
        this.hitFlash = 8;
        this.vx = knockbackDir * 5;
        this.vy = -3;
        Sound.play('enemyHit');

        Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
            8, CONFIG.COLORS.VOID_GLOW, { speed: 3, life: 20, size: 3 });

        if (this.hp <= 0) {
            this.dead = true;
            this.deathTimer = 0;
            Sound.play('enemyDie');
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                20, CONFIG.COLORS.VOID_PURPLE, { speed: 5, life: 30, size: 4, glow: true });
        }
    }

    draw(ctx) {
        if (this.dead && this.deathTimer > 30) return;

        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        if (sx + this.width < -50 || sx > CONFIG.WIDTH + 50) return;

        ctx.save();

        if (this.dead) {
            ctx.globalAlpha = 1 - this.deathTimer / 30;
        }

        if (this.hitFlash > 0) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 10;
        }

        this.drawEntity(ctx, sx, sy);

        ctx.shadowBlur = 0;

        // HP bar
        if (!this.dead && this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(sx, sy - 8, this.width, 4);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(sx, sy - 8, this.width * (this.hp / this.maxHp), 4);
        }

        ctx.restore();
    }

    drawEntity(ctx, sx, sy) {
        // Override in subclasses — fallback: try sprite, then colored rect
        ctx.fillStyle = CONFIG.COLORS.VOID_PURPLE;
        ctx.fillRect(sx, sy, this.width, this.height);
    }

    // Helper: draw a sprite-based enemy with 2-frame walk animation
    drawSpriteEntity(ctx, sx, sy, spriteKey, scale = 1) {
        const frameIdx = (Math.floor(this.animTimer / 15) % 2) + 1;
        const sprite = SpriteLoader.get(spriteKey + '_' + frameIdx);

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const drawW = sprite.naturalWidth * scale;
            const drawH = sprite.naturalHeight * scale;
            const drawX = sx + this.width / 2 - drawW / 2;
            const drawY = sy + this.height - drawH;

            if (this.facing > 0) {
                ctx.save();
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, 0, 0, drawW, drawH);
                ctx.restore();
            } else {
                ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
            }
            return true;
        }
        return false;
    }
}

// ---- VOID WISP (ground patrol mob) ----
class VoidWisp extends Enemy {
    constructor(x, y) {
        super(x, y, 'wisp');
        this.width = 30;
        this.height = 30;
        this.hp = 20;
        this.maxHp = 20;
        this.damage = 8;
        this.speed = 1.2;
        this.aggroRange = 250;
        this.spriteScale = 0.50; // %33 + %25 küçültme
    }

    drawEntity(ctx, sx, sy) {
        // Try sprite first (mob1) with scale
        if (this.drawSpriteEntity(ctx, sx, sy, 'mob1', this.spriteScale)) return;

        // Fallback: procedural
        ctx.fillStyle = CONFIG.COLORS.VOID_GLOW;
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + this.height / 2, this.width * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---- VOID CRAWLER (ground enemy) ----
class VoidCrawler extends Enemy {
    constructor(x, y) {
        super(x, y, 'crawler');
        this.width = 36;
        this.height = 24;
        this.hp = 35;
        this.maxHp = 35;
        this.damage = 12;
        this.speed = 2;
        this.aggroRange = 280;
        this.legAnim = 0;
    }

    update(player, platforms) {
        super.update(player, platforms);
        if (!this.dead && this.state === 'chase') {
            this.legAnim += 0.3;
        }
    }

    drawEntity(ctx, sx, sy) {
        // Try sprite first (mob2)
        if (this.drawSpriteEntity(ctx, sx, sy, 'mob2', 0.75)) return;

        // Fallback: procedural
        const f = this.facing;
        ctx.fillStyle = CONFIG.COLORS.VOID_DARK;
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CONFIG.COLORS.VOID_PURPLE;
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height / 2 - 3, this.width / 3, this.height / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4488';
        const eyeX = f > 0 ? sx + this.width - 10 : sx + 4;
        ctx.fillRect(eyeX, sy + 6, 4, 4);
        ctx.fillRect(eyeX + 6, sy + 6, 4, 4);
    }
}

// ---- VOID SHADE (tall, slow, dangerous) ----
class VoidShade extends Enemy {
    constructor(x, y) {
        super(x, y, 'shade');
        this.width = 28;
        this.height = 50;
        this.hp = 50;
        this.maxHp = 50;
        this.damage = 18;
        this.speed = 0.8;
        this.aggroRange = 350;
        this.attackRange = 60;
        this.attackCooldown = 90;
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;
        const sway = Math.sin(time * 1.5) * 3;

        // Shadow/cloak body
        ctx.fillStyle = CONFIG.COLORS.VOID_DARK;
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy);
        ctx.lineTo(sx + this.width + sway, sy + this.height);
        ctx.lineTo(sx - sway, sy + this.height);
        ctx.closePath();
        ctx.fill();

        // Inner void
        ctx.fillStyle = '#15082a';
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy + 8);
        ctx.lineTo(sx + this.width - 4 + sway * 0.5, sy + this.height - 5);
        ctx.lineTo(sx + 4 - sway * 0.5, sy + this.height - 5);
        ctx.closePath();
        ctx.fill();

        // Eyes (glowing)
        ctx.fillStyle = `rgba(255, 50, 100, ${0.7 + Math.sin(time * 3) * 0.3})`;
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 10;
        ctx.fillRect(sx + 8, sy + 12, 4, 6);
        ctx.fillRect(sx + 16, sy + 12, 4, 6);
        ctx.shadowBlur = 0;

        // Floating particles
        for (let i = 0; i < 3; i++) {
            const px = sx + this.width / 2 + Math.sin(time * 2 + i * 2) * 15;
            const py = sy + this.height - 10 + Math.cos(time * 1.5 + i * 2) * 5;
            ctx.fillStyle = `rgba(100, 40, 160, ${0.4 + Math.sin(time * 3 + i) * 0.2})`;
            ctx.fillRect(px, py, 3, 3);
        }
    }
}

// ---- BOSS BASE ----
class Boss extends Enemy {
    constructor(x, y, type, chapter, bossNum) {
        super(x, y, type);
        this.isBoss = true;
        this.chapter = chapter;
        this.bossNum = bossNum;
        this.phase = 1;
        this.maxPhases = 2;
        this.phaseTimer = 0;
        this.patterns = [];
        this.currentPattern = 0;
        this.patternTimer = 0;
        this.introTimer = 120;
        this.defeated = false;
        this.projectiles = [];
    }

    update(player, platforms) {
        if (this.introTimer > 0) {
            this.introTimer--;
            return;
        }

        if (this.dead) {
            this.deathTimer++;
            return;
        }

        this.animTimer++;
        if (this.hitFlash > 0) this.hitFlash--;

        // Phase transition
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.phaseTimer = 60;
            Camera.shake(10, 30);
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                30, '#ff4444', { speed: 6, life: 40, size: 5, glow: true });
        }

        if (this.phaseTimer > 0) {
            this.phaseTimer--;
            return;
        }

        this.updateBoss(player, platforms);

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx || 0;
            p.y += p.vy || 0;
            p.life--;
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    updateBoss(player, platforms) {
        // Override in subclasses
    }

    takeDamage(amount, knockbackDir = 0) {
        if (this.dead || this.introTimer > 0 || this.phaseTimer > 0) return;
        this.hp -= amount;
        this.hitFlash = 10;
        Sound.play('enemyHit');

        Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
            12, '#ff6644', { speed: 4, life: 25, size: 4 });

        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.defeated = true;
            this.deathTimer = 0;
            Sound.play('enemyDie');
            Camera.shake(15, 40);
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                50, CONFIG.COLORS.VOID_PURPLE, { speed: 8, life: 50, size: 5, glow: true });
        }
    }

    drawBossHealthBar(ctx) {
        if (this.dead || this.introTimer > 0) return;
        const barW = 400;
        const barH = 12;
        const barX = CONFIG.WIDTH / 2 - barW / 2;
        const barY = CONFIG.HEIGHT - 60;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

        // HP
        const hpRatio = this.hp / this.maxHp;
        const grad = ctx.createLinearGradient(barX, barY, barX + barW * hpRatio, barY);
        grad.addColorStop(0, '#ff2222');
        grad.addColorStop(1, '#ff6644');
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // Border
        ctx.strokeStyle = CONFIG.COLORS.GOLD;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // Name
        ctx.fillStyle = CONFIG.COLORS.GOLD;
        ctx.font = '14px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(this.bossName || 'BOSS', CONFIG.WIDTH / 2, barY - 8);
    }

    drawProjectiles(ctx) {
        for (const p of this.projectiles) {
            const sx = Camera.screenX(p.x);
            const sy = Camera.screenY(p.y);
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life / 10);
            ctx.fillStyle = p.color || '#ff4466';
            ctx.shadowColor = p.color || '#ff4466';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(sx, sy, p.radius || 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}

// ---- BOSS 1-1: Infernal Librarian ----
class InfernalLibrarian extends Boss {
    constructor(x, y) {
        super(x, y, 'infernal_librarian', 1, 1);
        this.width = 50;
        this.height = 70;
        this.hp = 200;
        this.maxHp = 200;
        this.damage = 15;
        this.speed = 1.5;
        this.bossName = 'INFERNAL LIBRARIAN';
        this.attackTimer = 0;
        this.bookThrowTimer = 0;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        this.facing = dx > 0 ? 1 : -1;
        const distance = Math.abs(dx);

        this.attackTimer++;

        // Chase
        if (distance > 100) {
            this.vx = Math.sign(dx) * this.speed * (this.phase === 2 ? 1.5 : 1);
        } else {
            this.vx *= 0.8;
        }

        // Gravity + collisions
        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;
        Physics.resolveCollisions(this, platforms);

        // Book throw attack
        const throwInterval = this.phase === 2 ? 60 : 90;
        if (this.attackTimer % throwInterval === 0) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            const speed = this.phase === 2 ? 5 : 3.5;
            this.projectiles.push({
                x: this.x + this.width / 2,
                y: this.y + 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 8,
                damage: 12,
                life: 120,
                color: '#ff6633'
            });
            // In phase 2, throw extra
            if (this.phase === 2) {
                this.projectiles.push({
                    x: this.x + this.width / 2,
                    y: this.y + 20,
                    vx: Math.cos(angle + 0.3) * speed,
                    vy: Math.sin(angle + 0.3) * speed,
                    radius: 6,
                    damage: 10,
                    life: 100,
                    color: '#ff4422'
                });
            }
        }

        // Slam attack (phase 2)
        if (this.phase === 2 && this.attackTimer % 180 === 0 && distance < 200) {
            Camera.shake(8, 15);
            Particles.burst(this.x + this.width / 2, this.y + this.height,
                15, '#ff4444', { speed: 5, life: 20, spread: 40 });
        }
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Robe body
        ctx.fillStyle = '#2a0a0a';
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy + 5);
        ctx.lineTo(sx + this.width + 5, sy + this.height);
        ctx.lineTo(sx - 5, sy + this.height);
        ctx.closePath();
        ctx.fill();

        // Inner robe
        ctx.fillStyle = '#4a1a1a';
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy + 15);
        ctx.lineTo(sx + this.width - 5, sy + this.height - 5);
        ctx.lineTo(sx + 5, sy + this.height - 5);
        ctx.closePath();
        ctx.fill();

        // Hood
        ctx.fillStyle = '#1a0505';
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + 15, 18, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        const eyeGlow = 0.7 + Math.sin(time * 4) * 0.3;
        ctx.fillStyle = `rgba(255, 60, 30, ${eyeGlow})`;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 15;
        ctx.fillRect(sx + 18, sy + 12, 5, 4);
        ctx.fillRect(sx + 28, sy + 12, 5, 4);
        ctx.shadowBlur = 0;

        // Floating books around
        for (let i = 0; i < 3; i++) {
            const angle = time * 1.5 + i * (Math.PI * 2 / 3);
            const bx = sx + this.width / 2 + Math.cos(angle) * 30;
            const by = sy + 30 + Math.sin(angle) * 15;
            ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[i];
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(angle * 0.5);
            ctx.fillRect(-6, -4, 12, 8);
            ctx.fillStyle = 'rgba(240, 230, 210, 0.5)';
            ctx.fillRect(-5, -3, 10, 6);
            ctx.restore();
        }

        // Fire particles
        if (this.phase === 2) {
            for (let i = 0; i < 5; i++) {
                const fx = sx + this.width / 2 + Math.sin(time * 3 + i) * 20;
                const fy = sy + 5 + Math.cos(time * 4 + i * 1.5) * 10;
                ctx.fillStyle = `rgba(255, ${80 + i * 30}, 20, ${0.6 + Math.sin(time * 5 + i) * 0.3})`;
                ctx.fillRect(fx - 2, fy - 2, 4, 4);
            }
        }
    }
}

// ---- BOSS 1-2: Tome Golem ----
class TomeGolem extends Boss {
    constructor(x, y) {
        super(x, y, 'tome_golem', 1, 2);
        this.width = 64;
        this.height = 80;
        this.hp = 300;
        this.maxHp = 300;
        this.damage = 20;
        this.speed = 1;
        this.bossName = 'TOME GOLEM';
        this.slamTimer = 0;
        this.isSlam = false;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        this.facing = dx > 0 ? 1 : -1;

        this.attackTimer++;

        if (!this.isSlam) {
            this.vx = Math.sign(dx) * this.speed * (this.phase === 2 ? 1.3 : 1);
        }

        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;
        Physics.resolveCollisions(this, platforms);

        // Ground slam
        const slamInterval = this.phase === 2 ? 100 : 150;
        if (this.attackTimer % slamInterval === 0) {
            this.isSlam = true;
            this.slamTimer = 30;
            this.vy = -8;
        }

        if (this.isSlam) {
            this.slamTimer--;
            if (this.slamTimer <= 0) {
                this.isSlam = false;
                Camera.shake(12, 20);
                // Shockwave projectiles
                for (let dir = -1; dir <= 1; dir += 2) {
                    for (let i = 0; i < (this.phase === 2 ? 3 : 2); i++) {
                        this.projectiles.push({
                            x: this.x + this.width / 2,
                            y: this.y + this.height - 10,
                            vx: dir * (3 + i * 1.5),
                            vy: -1,
                            radius: 10,
                            damage: 15,
                            life: 60,
                            color: '#aa6633'
                        });
                    }
                }
            }
        }
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Body made of stacked books
        for (let i = 0; i < 5; i++) {
            const rowY = sy + i * 16;
            const rowW = this.width - i * 3;
            const rowX = sx + (this.width - rowW) / 2 + Math.sin(time + i) * 2;
            const colorIdx = i % CONFIG.COLORS.BOOK_COLORS.length;
            ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[colorIdx];
            ctx.fillRect(rowX, rowY, rowW, 15);
            ctx.fillStyle = 'rgba(240, 230, 210, 0.3)';
            ctx.fillRect(rowX + 2, rowY + 2, rowW - 4, 11);
        }

        // Arms (books)
        const armAnim = Math.sin(time * 2) * 5;
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(sx - 15, sy + 20 + armAnim, 18, 12);
        ctx.fillRect(sx + this.width - 3, sy + 20 - armAnim, 18, 12);

        // Face area
        ctx.fillStyle = '#1a0808';
        ctx.fillRect(sx + 15, sy + 4, 34, 18);

        // Glowing eyes
        ctx.fillStyle = `rgba(255, 80, 30, ${0.8 + Math.sin(time * 3) * 0.2})`;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 12;
        ctx.fillRect(sx + 20, sy + 8, 8, 8);
        ctx.fillRect(sx + 36, sy + 8, 8, 8);
        ctx.shadowBlur = 0;

        // Dust when walking
        if (Math.abs(this.vx) > 0.3 && this.animTimer % 10 === 0) {
            Particles.burst(this.x + this.width / 2, this.y + this.height, 3, '#886644', { speed: 1, life: 15 });
        }
    }
}

// ---- BOSS 2-1: Void Scholar ----
class VoidScholar extends Boss {
    constructor(x, y) {
        super(x, y, 'void_scholar', 2, 1);
        this.width = 44;
        this.height = 60;
        this.hp = 350;
        this.maxHp = 350;
        this.damage = 18;
        this.speed = 2;
        this.bossName = 'VOID SCHOLAR';
        this.teleportTimer = 0;
        this.orbTimer = 0;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        this.facing = dx > 0 ? 1 : -1;
        this.attackTimer++;

        // Float movement
        this.vy = Math.sin(this.animTimer * 0.03) * 1.5;
        this.vx = Math.sign(dx) * this.speed * 0.5;

        this.x += this.vx;
        this.y += this.vy;

        // Teleport
        const teleInterval = this.phase === 2 ? 120 : 180;
        if (this.attackTimer % teleInterval === 0) {
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                20, CONFIG.COLORS.VOID_GLOW, { speed: 5, life: 20, glow: true });
            this.x = player.x + (Math.random() > 0.5 ? 1 : -1) * 200;
            this.y = player.y - 50;
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                20, CONFIG.COLORS.VOID_GLOW, { speed: 5, life: 20, glow: true });
        }

        // Void orbs
        const orbInterval = this.phase === 2 ? 40 : 70;
        if (this.attackTimer % orbInterval === 0) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.projectiles.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                radius: 10,
                damage: 14,
                life: 90,
                color: CONFIG.COLORS.VOID_GLOW
            });
        }

        // Phase 2: spiral attack
        if (this.phase === 2 && this.attackTimer % 200 === 0) {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                this.projectiles.push({
                    x: this.x + this.width / 2,
                    y: this.y + this.height / 2,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    radius: 7,
                    damage: 12,
                    life: 80,
                    color: '#8844cc'
                });
            }
        }
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Floating robe
        ctx.fillStyle = '#1a0a30';
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy);
        ctx.quadraticCurveTo(sx + this.width + 10, sy + this.height * 0.7, sx + this.width, sy + this.height);
        ctx.lineTo(sx, sy + this.height);
        ctx.quadraticCurveTo(sx - 10, sy + this.height * 0.7, sx + this.width / 2, sy);
        ctx.fill();

        // Inner glow
        const glowGrad = ctx.createRadialGradient(
            sx + this.width / 2, sy + this.height / 2, 5,
            sx + this.width / 2, sy + this.height / 2, 25
        );
        glowGrad.addColorStop(0, `rgba(140, 60, 200, ${0.4 + Math.sin(time * 3) * 0.2})`);
        glowGrad.addColorStop(1, 'rgba(140, 60, 200, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(sx, sy, this.width, this.height);

        // Face
        ctx.fillStyle = '#0a0515';
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + 15, 14, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = `rgba(200, 100, 255, ${0.8 + Math.sin(time * 5) * 0.2})`;
        ctx.shadowColor = '#cc66ff';
        ctx.shadowBlur = 12;
        ctx.fillRect(sx + 14, sy + 12, 5, 5);
        ctx.fillRect(sx + 26, sy + 12, 5, 5);
        ctx.shadowBlur = 0;

        // Floating rune circles
        for (let i = 0; i < 3; i++) {
            const angle = time + i * (Math.PI * 2 / 3);
            const r = 35;
            const rx = sx + this.width / 2 + Math.cos(angle) * r;
            const ry = sy + this.height / 2 + Math.sin(angle) * r;
            ctx.strokeStyle = `rgba(160, 80, 220, ${0.3 + Math.sin(time * 2 + i) * 0.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(rx, ry, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// ---- BOSS 2-2: Bookwyrm ----
class Bookwyrm extends Boss {
    constructor(x, y) {
        super(x, y, 'bookwyrm', 2, 2);
        this.width = 80;
        this.height = 50;
        this.hp = 400;
        this.maxHp = 400;
        this.damage = 22;
        this.speed = 3;
        this.bossName = 'THE BOOKWYRM';
        this.segments = [];
        for (let i = 0; i < 6; i++) {
            this.segments.push({ x: x - i * 20, y: y });
        }
        this.chargeDir = 0;
        this.isCharging = false;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.facing = dx > 0 ? 1 : -1;
        this.attackTimer++;

        if (!this.isCharging) {
            // Sinusoidal movement
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * 0.15;
            this.vy += Math.sin(angle) * 0.1;
            this.vx = clamp(this.vx, -this.speed, this.speed);
            this.vy = clamp(this.vy, -2, 2);
            this.vy += Math.sin(this.animTimer * 0.05) * 0.3;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Update segments to follow head
        for (let i = 0; i < this.segments.length; i++) {
            const target = i === 0 ? this : this.segments[i - 1];
            const sdx = target.x - this.segments[i].x;
            const sdy = target.y - this.segments[i].y;
            this.segments[i].x += sdx * 0.3;
            this.segments[i].y += sdy * 0.3;
        }

        // Charge attack
        const chargeInterval = this.phase === 2 ? 120 : 180;
        if (this.attackTimer % chargeInterval === 0 && !this.isCharging) {
            this.isCharging = true;
            this.chargeDir = Math.atan2(dy, dx);
            this.vx = Math.cos(this.chargeDir) * 10;
            this.vy = Math.sin(this.chargeDir) * 6;
            Camera.shake(5, 10);
            setTimeout(() => { this.isCharging = false; }, 500);
        }

        // Spit projectiles
        if (this.attackTimer % (this.phase === 2 ? 50 : 80) === 0) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.projectiles.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                vx: Math.cos(angle) * 5,
                vy: Math.sin(angle) * 5,
                radius: 8,
                damage: 14,
                life: 80,
                color: '#886633'
            });
        }
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Draw segments (tail to head)
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            const ssx = Camera.screenX(seg.x);
            const ssy = Camera.screenY(seg.y);
            const size = 18 - i * 1.5;

            ctx.fillStyle = `rgb(${60 + i * 10}, ${30 + i * 5}, ${15 + i * 5})`;
            ctx.beginPath();
            ctx.arc(ssx + 10, ssy + 10, size, 0, Math.PI * 2);
            ctx.fill();

            // Book page texture
            ctx.fillStyle = 'rgba(240, 230, 210, 0.2)';
            ctx.fillRect(ssx + 5, ssy + 5, size, size * 0.6);
        }

        // Head
        ctx.fillStyle = '#5a3020';
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Book cover pattern on head
        ctx.fillStyle = CONFIG.COLORS.BOOK_COLORS[2];
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2 - 5, this.height / 2 - 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeDir = this.facing > 0 ? 1 : 0;
        ctx.fillStyle = `rgba(255, 200, 50, ${0.8 + Math.sin(time * 4) * 0.2})`;
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx + 25 + eyeDir * 15, sy + 15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + 40 + eyeDir * 15, sy + 15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pupils
        ctx.fillStyle = '#220a00';
        ctx.beginPath();
        ctx.arc(sx + 25 + eyeDir * 15, sy + 15, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + 40 + eyeDir * 15, sy + 15, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth / teeth
        ctx.fillStyle = '#1a0a05';
        ctx.fillRect(sx + 20, sy + 30, 40, 10);
        ctx.fillStyle = '#f0e8d0';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(sx + 22 + i * 8, sy + 30, 3, 5);
        }
    }
}

// ---- BOSS 3-1: The Archivist ----
class TheArchivist extends Boss {
    constructor(x, y) {
        super(x, y, 'archivist', 3, 1);
        this.width = 56;
        this.height = 72;
        this.hp = 500;
        this.maxHp = 500;
        this.damage = 25;
        this.speed = 2.5;
        this.bossName = 'THE ARCHIVIST';
        this.shieldActive = false;
        this.shieldTimer = 0;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.facing = dx > 0 ? 1 : -1;
        this.attackTimer++;

        // Movement
        this.vx = Math.sign(dx) * this.speed;
        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;
        Physics.resolveCollisions(this, platforms);

        // Shield phase
        if (this.attackTimer % 240 === 0) {
            this.shieldActive = true;
            this.shieldTimer = 90;
        }
        if (this.shieldTimer > 0) {
            this.shieldTimer--;
            if (this.shieldTimer <= 0) this.shieldActive = false;
        }

        // Multi-attack pattern
        if (this.attackTimer % 60 === 0) {
            const patterns = this.phase === 2 ? 3 : 2;
            const pattern = this.attackTimer % (60 * patterns) / 60;

            if (pattern === 0) {
                // Aimed shot
                const angle = Math.atan2(dy, dx);
                for (let i = 0; i < (this.phase === 2 ? 3 : 1); i++) {
                    this.projectiles.push({
                        x: this.x + this.width / 2,
                        y: this.y + 20,
                        vx: Math.cos(angle + (i - 1) * 0.2) * 5,
                        vy: Math.sin(angle + (i - 1) * 0.2) * 5,
                        radius: 8,
                        damage: 16,
                        life: 100,
                        color: '#cc33ff'
                    });
                }
            } else if (pattern === 1) {
                // Ring attack
                for (let i = 0; i < 12; i++) {
                    const angle = (Math.PI * 2 / 12) * i;
                    this.projectiles.push({
                        x: this.x + this.width / 2,
                        y: this.y + this.height / 2,
                        vx: Math.cos(angle) * 3,
                        vy: Math.sin(angle) * 3,
                        radius: 6,
                        damage: 12,
                        life: 80,
                        color: '#9944cc'
                    });
                }
            } else if (pattern === 2) {
                // Summon void tendrils from ground
                for (let i = 0; i < 3; i++) {
                    this.projectiles.push({
                        x: player.x + randomRange(-100, 100),
                        y: player.y + 100,
                        vx: 0,
                        vy: -6,
                        radius: 10,
                        damage: 18,
                        life: 50,
                        color: '#6622aa'
                    });
                }
            }
        }
    }

    takeDamage(amount, knockbackDir) {
        if (this.shieldActive) {
            amount *= 0.2;
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2,
                5, '#88aaff', { speed: 3, life: 15 });
        }
        super.takeDamage(amount, knockbackDir);
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Tall robed figure
        ctx.fillStyle = '#0a0020';
        ctx.beginPath();
        ctx.moveTo(sx + this.width / 2, sy);
        ctx.lineTo(sx + this.width + 8, sy + this.height);
        ctx.lineTo(sx - 8, sy + this.height);
        ctx.closePath();
        ctx.fill();

        // Shoulder plates (book covers)
        ctx.fillStyle = '#3a1a50';
        ctx.fillRect(sx - 5, sy + 15, 18, 12);
        ctx.fillRect(sx + this.width - 13, sy + 15, 18, 12);

        // Face
        ctx.fillStyle = '#050010';
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + 14, 16, 0, Math.PI * 2);
        ctx.fill();

        // Three eyes
        for (let i = 0; i < 3; i++) {
            const ex = sx + 16 + i * 10;
            const ey = sy + 10 + (i === 1 ? -3 : 0);
            ctx.fillStyle = `rgba(200, 50, 255, ${0.8 + Math.sin(time * 4 + i) * 0.2})`;
            ctx.shadowColor = '#cc33ff';
            ctx.shadowBlur = 10;
            ctx.fillRect(ex, ey, 5, 5);
        }
        ctx.shadowBlur = 0;

        // Staff
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(sx + this.width + 2, sy - 10, 4, this.height + 20);
        // Orb on staff
        ctx.fillStyle = `rgba(200, 100, 255, ${0.6 + Math.sin(time * 3) * 0.3})`;
        ctx.shadowColor = '#cc66ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sx + this.width + 4, sy - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shield visual
        if (this.shieldActive) {
            ctx.strokeStyle = `rgba(100, 150, 255, ${0.5 + Math.sin(time * 8) * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx + this.width / 2, sy + this.height / 2, 45, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// ---- BOSS 3-2 (FINAL): The Dreamer's Nightmare ----
class DreamersNightmare extends Boss {
    constructor(x, y) {
        super(x, y, 'dreamer', 3, 2);
        this.width = 90;
        this.height = 100;
        this.hp = 600;
        this.maxHp = 600;
        this.damage = 28;
        this.speed = 1.5;
        this.bossName = 'THE DREAMER\'S NIGHTMARE';
        this.maxPhases = 3;
        this.summonTimer = 0;
        this.laserAngle = 0;
        this.laserActive = false;
    }

    updateBoss(player, platforms) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.facing = dx > 0 ? 1 : -1;
        this.attackTimer++;

        // Phase 3
        if (this.hp <= this.maxHp * 0.3 && this.phase === 2) {
            this.phase = 3;
            this.phaseTimer = 90;
            Camera.shake(15, 40);
        }

        // Float movement
        this.vy = Math.sin(this.animTimer * 0.02) * 2;
        this.vx = Math.sign(dx) * this.speed * (this.phase >= 2 ? 1.3 : 1);
        this.x += this.vx;
        this.y += this.vy;

        // Attack patterns based on phase
        const interval = Math.max(30, 80 - this.phase * 15);

        if (this.attackTimer % interval === 0) {
            const angle = Math.atan2(dy, dx);

            // Void bolts
            const boltCount = this.phase + 1;
            for (let i = 0; i < boltCount; i++) {
                const spread = (i - (boltCount - 1) / 2) * 0.15;
                this.projectiles.push({
                    x: this.x + this.width / 2,
                    y: this.y + this.height / 2,
                    vx: Math.cos(angle + spread) * 4.5,
                    vy: Math.sin(angle + spread) * 4.5,
                    radius: 8,
                    damage: 16,
                    life: 90,
                    color: '#aa44ff'
                });
            }
        }

        // Void rain (phase 2+)
        if (this.phase >= 2 && this.attackTimer % 45 === 0) {
            this.projectiles.push({
                x: player.x + randomRange(-120, 120),
                y: this.y - 150,
                vx: 0,
                vy: 5,
                radius: 6,
                damage: 14,
                life: 80,
                color: '#7733aa'
            });
        }

        // Laser sweep (phase 3)
        if (this.phase === 3 && this.attackTimer % 300 === 0) {
            this.laserActive = true;
            this.laserAngle = Math.atan2(dy, dx);
            setTimeout(() => { this.laserActive = false; }, 2000);
        }
        if (this.laserActive) {
            this.laserAngle += 0.02;
            if (this.attackTimer % 3 === 0) {
                this.projectiles.push({
                    x: this.x + this.width / 2 + Math.cos(this.laserAngle) * 40,
                    y: this.y + this.height / 2 + Math.sin(this.laserAngle) * 40,
                    vx: Math.cos(this.laserAngle) * 8,
                    vy: Math.sin(this.laserAngle) * 8,
                    radius: 5,
                    damage: 10,
                    life: 40,
                    color: '#ff33ff'
                });
            }
        }
    }

    drawEntity(ctx, sx, sy) {
        const time = Date.now() / 1000;

        // Massive void entity
        // Outer aura
        const auraSize = 60 + Math.sin(time * 2) * 10;
        ctx.fillStyle = `rgba(60, 20, 100, ${0.3 + Math.sin(time * 1.5) * 0.1})`;
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + this.height / 2, auraSize, 0, Math.PI * 2);
        ctx.fill();

        // Body - amorphous void shape
        ctx.fillStyle = '#0a0020';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const r = 40 + Math.sin(time * 2 + i * 0.8) * 8;
            const px = sx + this.width / 2 + Math.cos(angle) * r;
            const py = sy + this.height / 2 + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner core
        ctx.fillStyle = `rgba(100, 30, 180, ${0.5 + Math.sin(time * 3) * 0.2})`;
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + this.height / 2, 25, 0, Math.PI * 2);
        ctx.fill();

        // Central eye
        ctx.fillStyle = '#ff0066';
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(sx + this.width / 2, sy + this.height / 2 - 5, 12, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#1a0010';
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height / 2 - 5, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Tentacles
        ctx.strokeStyle = '#2a0a40';
        ctx.lineWidth = 4;
        for (let i = 0; i < 6; i++) {
            const baseAngle = (Math.PI * 2 / 6) * i + Math.PI / 2;
            ctx.beginPath();
            let px = sx + this.width / 2;
            let py = sy + this.height / 2;
            ctx.moveTo(px, py);
            for (let j = 1; j <= 4; j++) {
                px += Math.cos(baseAngle + Math.sin(time * 2 + i + j * 0.5) * 0.5) * 15;
                py += Math.sin(baseAngle + Math.cos(time * 1.5 + i + j * 0.3) * 0.3) * 15;
                ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Void particles swirling
        for (let i = 0; i < 8; i++) {
            const angle = time * 1.5 + i * (Math.PI / 4);
            const r = 50 + Math.sin(time * 3 + i) * 10;
            const px = sx + this.width / 2 + Math.cos(angle) * r;
            const py = sy + this.height / 2 + Math.sin(angle) * r;
            ctx.fillStyle = `rgba(160, 60, 220, ${0.5 + Math.sin(time * 4 + i) * 0.3})`;
            ctx.fillRect(px - 2, py - 2, 4, 4);
        }

        // Phase 3 - reality cracks
        if (this.phase === 3) {
            ctx.strokeStyle = `rgba(255, 50, 150, ${0.4 + Math.sin(time * 6) * 0.3})`;
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                const startX = sx + randomRange(0, this.width);
                const startY = sy + randomRange(0, this.height);
                ctx.moveTo(startX, startY);
                for (let j = 0; j < 3; j++) {
                    ctx.lineTo(startX + randomRange(-30, 30), startY + randomRange(-30, 30));
                }
                ctx.stroke();
            }
        }
    }
}

// Factory function to create enemies
function createEnemy(type, x, y) {
    switch (type) {
        case 'wisp': return new VoidWisp(x, y);
        case 'crawler': return new VoidCrawler(x, y);
        case 'shade': return new VoidShade(x, y);
        default: return new VoidWisp(x, y);
    }
}

function createBoss(chapter, bossNum, x, y) {
    if (chapter === 1 && bossNum === 1) return new InfernalLibrarian(x, y);
    if (chapter === 1 && bossNum === 2) return new TomeGolem(x, y);
    if (chapter === 2 && bossNum === 1) return new VoidScholar(x, y);
    if (chapter === 2 && bossNum === 2) return new Bookwyrm(x, y);
    if (chapter === 3 && bossNum === 1) return new TheArchivist(x, y);
    if (chapter === 3 && bossNum === 2) return new DreamersNightmare(x, y);
    return new InfernalLibrarian(x, y);
}
