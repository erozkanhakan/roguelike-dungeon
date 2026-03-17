// ============================================================
// MAIN.JS - Game initialization, state management, main loop
// ============================================================

const Game = {
    state: 'menu', // menu, chapterIntro, playing, bossIntro, bossFight, reward, death, victory
    chapter: 1,
    section: 0, // 0=explore1, 1=boss1, 2=explore2, 3=boss2
    totalTime: 0,

    player: null,
    enemies: [],
    boss: null,
    level: null,
    stateTimer: 0,

    init() {
        Renderer.init();
        Input.init();
        Sound.init();
        SpriteLoader.init();

        this.player = new Player(100, 400);
        this.state = 'menu';
    },

    startNewGame() {
        this.chapter = 1;
        this.section = 0;
        this.totalTime = 0;
        this.player.reset(100, 400);
        Particles.clear();
        Camera.reset();
        this.loadSection();
        this.state = 'chapterIntro';
        this.stateTimer = 0;
        Sound.resume();
    },

    loadSection() {
        const levelData = LevelGenerator.generate(this.chapter, this.section);
        this.level = levelData;

        // Reset player position
        this.player.x = levelData.spawnX;
        this.player.y = levelData.spawnY;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onRope = false;
        this.player.ropeRef = null;

        // Spawn enemies
        this.enemies = [];
        if (levelData.enemies) {
            for (const e of levelData.enemies) {
                this.enemies.push(createEnemy(e.type, e.x, e.y));
            }
        }

        // Spawn boss
        this.boss = null;
        if (levelData.isBossArena) {
            this.boss = createBoss(this.chapter, levelData.bossNum, levelData.bossSpawn.x, levelData.bossSpawn.y);
        }

        Camera.reset();
        Camera.x = this.player.x - CONFIG.WIDTH / 2;
        Camera.y = this.player.y - CONFIG.HEIGHT / 2;
        Particles.clear();

        UI.fadeIn();
    },

    nextSection() {
        this.section++;

        if (this.section > 3) {
            // Chapter complete
            this.chapter++;
            this.section = 0;

            if (this.chapter > 3) {
                // Game complete!
                this.state = 'victory';
                this.stateTimer = 0;
                return;
            }

            this.state = 'chapterIntro';
            this.stateTimer = 0;
            this.loadSection();
            return;
        }

        // Boss section
        if (this.section === 1 || this.section === 3) {
            this.loadSection();
            this.state = 'bossIntro';
            this.stateTimer = 0;
            Sound.play('bossAppear');
        } else {
            this.loadSection();
            this.state = 'playing';
        }
    },

    update() {
        Input.update();
        this.totalTime++;

        switch (this.state) {
            case 'menu':
                if (Input.justPressed('Enter') || Input.justPressed('Space')) {
                    this.startNewGame();
                }
                break;

            case 'chapterIntro':
                this.stateTimer++;
                if (this.stateTimer > 180) {
                    this.state = (this.section === 1 || this.section === 3) ? 'bossIntro' : 'playing';
                    this.stateTimer = 0;
                    if (this.state === 'bossIntro') Sound.play('bossAppear');
                }
                break;

            case 'playing':
                this.updateGameplay();
                break;

            case 'bossIntro':
                this.stateTimer++;
                if (this.stateTimer > 120) {
                    this.state = 'bossFight';
                    this.stateTimer = 0;
                }
                break;

            case 'bossFight':
                this.updateBossFight();
                break;

            case 'reward':
                const choice = UI.updateRewardSelection();
                if (choice) {
                    this.applyReward(choice);
                    // Move to next section
                    this.nextSection();
                }
                break;

            case 'death':
                this.stateTimer++;
                if (this.stateTimer > 120 && (Input.justPressed('Enter') || Input.justPressed('Space'))) {
                    this.startNewGame();
                }
                break;

            case 'victory':
                this.stateTimer++;
                if (this.stateTimer > 900 && (Input.justPressed('Enter') || Input.justPressed('Space'))) {
                    this.state = 'menu';
                }
                break;
        }

        Input.endFrame();
    },

    updateGameplay() {
        if (!this.level) return;

        // Update player
        this.player.update(this.level.platforms, this.level.ropes || []);

        // Check death
        if (this.player.dead) {
            if (this.player.deathTimer > 30) {
                this.state = 'death';
                this.stateTimer = 0;
            }
            Particles.update();
            Camera.follow(this.player, this.level.width, this.level.height);
            return;
        }

        // Update enemies
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                enemy.update(this.player, this.level.platforms);

                // Enemy damages player on contact
                if (!this.player.dead && this.player.invincibleTimer <= 0 &&
                    Physics.rectOverlap(this.player, enemy)) {
                    this.player.takeDamage(enemy.damage);
                }
            }
        }

        // Player attacks hit enemies
        this.checkPlayerAttacks(this.enemies);

        // Remove dead enemies that finished death animation
        this.enemies = this.enemies.filter(e => !e.dead || e.deathTimer < 30);

        // Check exit zone
        if (this.level.exitZone && Physics.rectOverlap(this.player, this.level.exitZone)) {
            this.nextSection();
        }

        Particles.update();
        Camera.follow(this.player, this.level.width, this.level.height);
    },

    updateBossFight() {
        if (!this.level || !this.boss) return;

        // Update player
        this.player.update(this.level.platforms, this.level.ropes || []);

        // Check death
        if (this.player.dead) {
            if (this.player.deathTimer > 30) {
                this.state = 'death';
                this.stateTimer = 0;
            }
            Particles.update();
            Camera.follow(this.player, this.level.width, this.level.height);
            return;
        }

        // Update boss
        this.boss.update(this.player, this.level.platforms);

        // Boss projectiles hit player
        if (!this.player.dead) {
            for (const proj of this.boss.projectiles) {
                const projRect = {
                    x: proj.x - (proj.radius || 6),
                    y: proj.y - (proj.radius || 6),
                    width: (proj.radius || 6) * 2,
                    height: (proj.radius || 6) * 2,
                };
                if (Physics.rectOverlap(this.player, projRect)) {
                    this.player.takeDamage(proj.damage || 10);
                    proj.life = 0;
                }
            }

            // Boss body damages player
            if (this.player.invincibleTimer <= 0 && Physics.rectOverlap(this.player, this.boss)) {
                this.player.takeDamage(this.boss.damage);
            }
        }

        // Player attacks hit boss
        this.checkPlayerAttacks([this.boss]);

        // Player skill projectiles hit boss
        for (const sp of this.player.skillProjectiles) {
            if (sp.type === 'void') {
                // Void pulse - area damage
                const d = dist(sp.x, sp.y, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2);
                if (d < (sp.radius || 10) + Math.max(this.boss.width, this.boss.height) / 2) {
                    if (!sp.hitBoss) {
                        this.boss.takeDamage(sp.damage || 10, 0);
                        sp.hitBoss = true;
                    }
                }
            } else {
                const spRect = {
                    x: sp.x - (sp.width || 10) / 2,
                    y: sp.y - (sp.height || 10) / 2,
                    width: sp.width || 10,
                    height: sp.height || 10,
                };
                if (Physics.rectOverlap(spRect, this.boss)) {
                    if (!sp.hitBoss) {
                        this.boss.takeDamage(sp.damage || 10, 0);
                        sp.hitBoss = true;
                    }
                }
            }
        }

        // Boss defeated
        if (this.boss.dead && this.boss.deathTimer > 60) {
            // Show reward
            let choices;
            if (this.chapter === 1 && this.level.bossNum === 1 && !this.player.elementType) {
                // First boss: choose element
                choices = Rewards.generateElementChoice();
            } else {
                choices = Rewards.generateUpgradeChoices(this.player, this.chapter, this.level.bossNum);
            }
            UI.showRewards(choices);
            this.state = 'reward';
        }

        Particles.update();
        Camera.follow(this.player, this.level.width, this.level.height);
    },

    checkPlayerAttacks(targets) {
        const hitboxes = this.player.getHitboxes();

        for (const hb of hitboxes) {
            for (const target of targets) {
                if (target.dead) continue;

                // Use unique key for attack instance to prevent multi-hit
                const attackKey = hb.type + '_' + (this.player.attacking ? this.player.attackTimer : this.player.powerAttackTimer);

                if (Physics.rectOverlap(hb, target) && !target.hitList.includes(attackKey)) {
                    target.hitList.push(attackKey);
                    const kbDir = this.player.facing;
                    target.takeDamage(hb.damage, kbDir);

                    // Particles at hit point
                    const hitX = (hb.x + hb.width / 2 + target.x + target.width / 2) / 2;
                    const hitY = (hb.y + hb.height / 2 + target.y + target.height / 2) / 2;
                    Particles.burst(hitX, hitY, 10, CONFIG.COLORS.GOLD, { speed: 4, life: 15, size: 3 });

                    // Cleanup old hitList entries
                    if (target.hitList.length > 20) target.hitList = target.hitList.slice(-10);
                }
            }
        }

        // Skill projectiles hit enemies
        for (const sp of this.player.skillProjectiles) {
            for (const target of targets) {
                if (target.dead) continue;

                let hits = false;
                if (sp.type === 'void') {
                    const d = dist(sp.x, sp.y, target.x + target.width / 2, target.y + target.height / 2);
                    hits = d < (sp.radius || 10) + Math.max(target.width, target.height) / 2;
                } else {
                    const spRect = {
                        x: sp.x - (sp.width || 10) / 2,
                        y: sp.y - (sp.height || 10) / 2,
                        width: sp.width || 10,
                        height: sp.height || 10,
                    };
                    hits = Physics.rectOverlap(spRect, target);
                }

                const spKey = 'skill_' + sp.type + '_' + sp.life;
                if (hits && !target.hitList.includes(spKey)) {
                    target.hitList.push(spKey);
                    target.takeDamage(sp.damage || 10, this.player.facing);
                }
            }
        }
    },

    applyReward(choice) {
        if (choice.type === 'element') {
            this.player.elementType = choice.element;
            this.player.upgrades.push({
                name: choice.name,
                icon: choice.icon,
                color: choice.color,
            });
            UI.showMessage(`${choice.name} awakened!`, 120);
        } else if (choice.apply) {
            choice.apply(this.player);
            this.player.upgrades.push({
                name: choice.name,
                icon: choice.icon,
                color: choice.color,
            });
            UI.showMessage(`${choice.name} acquired!`, 120);
        }

        // Heal partially after boss
        this.player.hp = Math.min(this.player.hp + 30, this.player.maxHp);
    },

    draw() {
        const ctx = Renderer.ctx;
        Renderer.clear();

        switch (this.state) {
            case 'menu':
                UI.drawTitleScreen(ctx);
                break;

            case 'chapterIntro':
                Renderer.drawBackground(this.chapter, this.level ? this.level.width : CONFIG.WIDTH);
                UI.drawChapterTransition(ctx, this.chapter, this.stateTimer);
                break;

            case 'playing':
            case 'bossFight':
                this.drawGameWorld(ctx);
                break;

            case 'bossIntro':
                this.drawGameWorld(ctx);
                if (this.boss) {
                    UI.drawBossIntro(ctx, this.boss.bossName, this.stateTimer);
                }
                break;

            case 'reward':
                this.drawGameWorld(ctx);
                UI.drawRewardScreen(ctx);
                break;

            case 'death':
                this.drawGameWorld(ctx);
                UI.drawDeathScreen(ctx, this.stateTimer);
                break;

            case 'victory':
                UI.drawVictoryScreen(ctx, this.stateTimer);
                break;
        }

        UI.drawTransition(ctx);
    },

    drawGameWorld(ctx) {
        if (!this.level) return;

        // Background
        Renderer.drawBackground(this.chapter, this.level.width);

        // Ropes (behind platforms)
        if (this.level.ropes) {
            for (const rope of this.level.ropes) {
                Renderer.drawRope(ctx, rope, this.player);
            }
        }

        // Platforms
        for (const p of this.level.platforms) {
            Renderer.drawPlatform(ctx, p);
        }

        // Exit zone
        if (this.level.exitZone && this.state === 'playing') {
            UI.drawExitZone(ctx, this.level.exitZone);
        }

        // Enemies
        for (const enemy of this.enemies) {
            enemy.draw(ctx);
        }

        // Boss
        if (this.boss) {
            this.boss.draw(ctx);
            this.boss.drawProjectiles(ctx);
        }

        // Player
        this.player.draw(ctx);

        // Particles
        Particles.draw(ctx);

        // Foreground elements (Hollow Knight style depth)
        Renderer.drawForeground(ctx, this.level.width);

        // Boss HP bar
        if (this.boss && this.state === 'bossFight') {
            this.boss.drawBossHealthBar(ctx);
        }

        // HUD
        UI.drawHUD(ctx, this.player, this);
    }
};

// ---- GAME LOOP ----
let lastTime = 0;
let accumulator = 0;
const FIXED_DT = 1000 / 60;

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    accumulator += delta;

    // Fixed timestep updates
    while (accumulator >= FIXED_DT) {
        Game.update();
        accumulator -= FIXED_DT;
    }

    Game.draw();
    requestAnimationFrame(gameLoop);
}

// ---- START ----
window.addEventListener('load', () => {
    Game.init();
    requestAnimationFrame(gameLoop);
});
