// ============================================================
// LEVELS.JS - Multi-floor level generation - open, playable layout
// ============================================================

const LevelGenerator = {
    generate(chapter, section) {
        switch (section) {
            case 0: return this.generateFromPNG(chapter);
            case 1: return this.generateBossArena(chapter, 1);
            case 2: return this.generateExploration(chapter, 2);
            case 3: return this.generateBossArena(chapter, 2);
            default: return this.generateExploration(chapter, 1);
        }
    },

    // --- PNG-based level generation ---
    // Extracts collision rectangles from a pre-loaded PNG image
    generateFromPNG(chapter) {
        const img = SpriteLoader.get('level_chapter1');
        if (!img || !img.complete || img.naturalWidth === 0) {
            console.warn('Level PNG not loaded yet, falling back to procedural');
            return this.generateExploration(chapter, 1);
        }

        // Use cached collision data if available
        if (this._cachedPNGLevel) {
            return this._cachedPNGLevel;
        }

        const TILE_SIZE = 32;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        // Scale down aggressively for fast pixel reading
        const gridW = Math.ceil(imgW / TILE_SIZE);
        const gridH = Math.ceil(imgH / TILE_SIZE);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = gridW;
        offCanvas.height = gridH;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0, gridW, gridH);
        const imageData = offCtx.getImageData(0, 0, gridW, gridH);
        const pixels = imageData.data;

        // Build grid: each pixel in the tiny canvas = one tile
        const grid = new Uint8Array(gridW * gridH);
        for (let i = 0; i < gridW * gridH; i++) {
            if (pixels[i * 4 + 3] > 128) {
                grid[i] = 1;
            }
        }

        // Merge into rectangles: horizontal runs first, then merge vertically
        const platforms = [];
        const used = new Uint8Array(gridW * gridH);

        for (let gy = 0; gy < gridH; gy++) {
            let gx = 0;
            while (gx < gridW) {
                if (grid[gy * gridW + gx] && !used[gy * gridW + gx]) {
                    // Find horizontal run
                    let runEnd = gx;
                    while (runEnd < gridW && grid[gy * gridW + runEnd] && !used[gy * gridW + runEnd]) {
                        runEnd++;
                    }
                    const runW = runEnd - gx;

                    // Extend vertically: check rows below with same x range
                    let runH = 1;
                    let canExtend = true;
                    while (canExtend && gy + runH < gridH) {
                        for (let cx = gx; cx < gx + runW; cx++) {
                            if (!grid[(gy + runH) * gridW + cx] || used[(gy + runH) * gridW + cx]) {
                                canExtend = false;
                                break;
                            }
                        }
                        if (canExtend) runH++;
                    }

                    // Mark used
                    for (let ry = gy; ry < gy + runH; ry++) {
                        for (let rx = gx; rx < gx + runW; rx++) {
                            used[ry * gridW + rx] = 1;
                        }
                    }

                    platforms.push({
                        x: gx * TILE_SIZE,
                        y: gy * TILE_SIZE,
                        width: runW * TILE_SIZE,
                        height: runH * TILE_SIZE,
                        type: 'png',
                    });

                    gx = runEnd;
                } else {
                    gx++;
                }
            }
        }

        console.log(`PNG level: ${imgW}x${imgH}, grid ${gridW}x${gridH}, ${platforms.length} collision rects`);

        // Find a spawn point: scan top-left area for open space above solid ground
        let spawnX = 100;
        let spawnY = 200;
        for (let sy = 0; sy < gridH - 2; sy++) {
            for (let sx = 0; sx < Math.min(gridW, Math.ceil(600 / TILE_SIZE)); sx++) {
                // Need empty space with solid below (ground)
                if (!grid[sy * gridW + sx] && !grid[sy * gridW + sx] &&
                    sy + 1 < gridH && grid[(sy + 1) * gridW + sx]) {
                    // Check enough headroom (at least 6 tiles = 48px above)
                    let hasRoom = true;
                    for (let above = 1; above <= 6; above++) {
                        if (sy - above >= 0 && grid[(sy - above) * gridW + sx]) {
                            hasRoom = false;
                            break;
                        }
                    }
                    if (hasRoom) {
                        spawnX = sx * TILE_SIZE;
                        spawnY = sy * TILE_SIZE - CONFIG.PLAYER.HEIGHT;
                        // Break out of both loops
                        sy = gridH;
                        break;
                    }
                }
            }
        }

        const level = {
            platforms: platforms,
            enemies: [],
            ropes: [],
            width: imgW,
            height: imgH,
            spawnX: spawnX,
            spawnY: spawnY,
            exitX: imgW - 150,
            exitY: imgH - 100,
            exitZone: null,
            chapter: chapter,
            isPNGLevel: true,
        };

        this._cachedPNGLevel = level;
        return level;
    },

    _cachedPNGLevel: null,

    generateExploration(chapter, part) {
        const T = CONFIG.TILE;
        const FLOOR_H = 280;          // height per floor (roomy)
        const FLOOR_W = 1600;         // all floors same width for simplicity
        const FLOOR_COUNT = 6 + chapter; // 7-9 floors
        const TOTAL_H = FLOOR_COUNT * FLOOR_H + 100;

        const level = {
            platforms: [],
            enemies: [],
            ropes: [],
            width: FLOOR_W + 100,
            height: TOTAL_H,
            spawnX: 80,
            spawnY: FLOOR_H - 100,
            exitX: 0,
            exitY: 0,
            exitZone: null,
            chapter: chapter,
        };

        // Build each floor: simple open rooms connected by 2 passages each
        for (let i = 0; i < FLOOR_COUNT; i++) {
            const fy = i * FLOOR_H;           // top of this floor
            const groundY = fy + FLOOR_H - 40; // walkable ground
            const ceilY = fy;                  // ceiling

            // --- Pick 2 connection points to NEXT floor ---
            // These are wide holes in the ground where player drops to next floor
            const holeW = 160;
            // Left hole around 25% and right hole around 75%
            const hole1X = Math.round(FLOOR_W * 0.2 + randomRange(-80, 80));
            const hole2X = Math.round(FLOOR_W * 0.7 + randomRange(-80, 80));

            // --- GROUND: 3 segments with 2 holes ---
            if (i < FLOOR_COUNT - 1) {
                // Left ground segment
                if (hole1X > 30) {
                    level.platforms.push({ x: 0, y: groundY, width: hole1X, height: T, type: 'bookshelf' });
                }
                // Middle ground segment (between holes)
                const midStart = hole1X + holeW;
                const midEnd = hole2X;
                if (midEnd - midStart > 30) {
                    level.platforms.push({ x: midStart, y: groundY, width: midEnd - midStart, height: T, type: 'bookshelf' });
                }
                // Right ground segment
                const rightStart = hole2X + holeW;
                if (FLOOR_W - rightStart > 30) {
                    level.platforms.push({ x: rightStart, y: groundY, width: FLOOR_W - rightStart, height: T, type: 'bookshelf' });
                }
            } else {
                // Last floor: solid ground, no holes
                level.platforms.push({ x: 0, y: groundY, width: FLOOR_W, height: T, type: 'bookshelf' });
            }

            // --- CEILING: holes matching the floor ABOVE ---
            // First floor has solid ceiling (it's the top)
            if (i === 0) {
                level.platforms.push({ x: 0, y: ceilY, width: FLOOR_W, height: 20, type: 'bookshelf' });
            }
            // Other floors: ceiling is the ground of the floor above, already placed with holes

            // --- SIDE WALLS ---
            level.platforms.push({ x: -20, y: fy, width: 24, height: FLOOR_H, type: 'bookshelf' });
            level.platforms.push({ x: FLOOR_W - 4, y: fy, width: 24, height: FLOOR_H, type: 'bookshelf' });

            // --- CONNECTION FEATURES in the holes ---
            if (i < FLOOR_COUNT - 1) {
                const nextGroundY = (i + 1) * FLOOR_H + FLOOR_H - 40;

                // Hole 1: wall-jump shaft on every other floor, otherwise open drop
                if (i % 3 === 0) {
                    // Wall-jump shaft: two narrow walls inside the hole
                    const shaftL = hole1X + 10;
                    const shaftR = hole1X + holeW - 30;
                    level.platforms.push({ x: shaftL, y: groundY, width: 18, height: FLOOR_H, type: 'bookshelf' });
                    level.platforms.push({ x: shaftR, y: groundY, width: 18, height: FLOOR_H, type: 'bookshelf' });
                } else if (i % 3 === 1) {
                    // Rope descent
                    level.ropes.push({
                        x: hole1X + holeW / 2,
                        topY: groundY - 60,
                        bottomY: groundY + FLOOR_H - 20,
                    });
                } else {
                    // Open drop with a small landing platform midway
                    level.platforms.push({
                        x: hole1X + 30, y: groundY + FLOOR_H / 2,
                        width: holeW - 60, height: 16,
                        type: 'books', seed: i * 50 + 1,
                    });
                }

                // Hole 2: alternate type from hole 1
                if (i % 3 === 1) {
                    // Wall-jump shaft
                    const shaftL = hole2X + 10;
                    const shaftR = hole2X + holeW - 30;
                    level.platforms.push({ x: shaftL, y: groundY, width: 18, height: FLOOR_H, type: 'bookshelf' });
                    level.platforms.push({ x: shaftR, y: groundY, width: 18, height: FLOOR_H, type: 'bookshelf' });
                } else if (i % 3 === 2) {
                    // Rope
                    level.ropes.push({
                        x: hole2X + holeW / 2,
                        topY: groundY - 60,
                        bottomY: groundY + FLOOR_H - 20,
                    });
                } else {
                    // Open drop with landing
                    level.platforms.push({
                        x: hole2X + 30, y: groundY + FLOOR_H / 2,
                        width: holeW - 60, height: 16,
                        type: 'books', seed: i * 50 + 2,
                    });
                }
            }

            // --- INTERIOR PLATFORMS (bookshelves, desks for verticality) ---
            // 3-5 platforms per floor, avoid blocking the holes
            const platCount = randomInt(3, 5);
            for (let p = 0; p < platCount; p++) {
                let px, py, pw;
                let tries = 0;
                do {
                    px = 60 + Math.random() * (FLOOR_W - 250);
                    py = groundY - randomRange(70, 180);
                    pw = randomRange(80, 200);
                    tries++;
                } while (tries < 10 && i < FLOOR_COUNT - 1 && (
                    this.overlapsHole(px, pw, hole1X, holeW) ||
                    this.overlapsHole(px, pw, hole2X, holeW)
                ));

                level.platforms.push({
                    x: px, y: py, width: pw, height: 18,
                    type: randomChoice(['bookshelf', 'books', 'books', 'desk']),
                    seed: i * 20 + p,
                });
            }

            // --- ENEMIES: at least 1 per 2 platforms, more on later chapters ---
            const enemyCount = Math.max(2, platCount - 1) + (chapter - 1);
            const usedPositions = [];
            for (let e = 0; e < enemyCount; e++) {
                // Place on ground or on interior platforms
                let ex, ey;
                if (e < 2) {
                    // Ground enemies
                    ex = 100 + (e + 1) * (FLOOR_W / 3) + randomRange(-80, 80);
                    ey = groundY - 50;
                    // Make sure not in a hole
                    if (i < FLOOR_COUNT - 1) {
                        if (ex > hole1X - 20 && ex < hole1X + holeW + 20) ex = hole1X - 60;
                        if (ex > hole2X - 20 && ex < hole2X + holeW + 20) ex = hole2X + holeW + 40;
                    }
                } else {
                    // Platform enemies
                    const plats = level.platforms.filter(pl =>
                        pl.y > fy && pl.y < groundY && pl.height < 30 && pl.width > 60
                    );
                    if (plats.length > 0) {
                        const pl = plats[e % plats.length];
                        ex = pl.x + pl.width / 2 + randomRange(-20, 20);
                        ey = pl.y - 50;
                    } else {
                        ex = 200 + Math.random() * (FLOOR_W - 400);
                        ey = groundY - 50;
                    }
                }

                // Avoid stacking enemies
                const tooClose = usedPositions.some(pos => Math.abs(pos - ex) < 120);
                if (!tooClose) {
                    usedPositions.push(ex);
                    level.enemies.push({
                        type: this.pickEnemy(chapter),
                        x: clamp(ex, 40, FLOOR_W - 60),
                        y: ey,
                    });
                }
            }

            // --- Extra rope on wider floors for fun traversal ---
            if (i % 2 === 0 && i > 0) {
                const ropeX = FLOOR_W / 2 + randomRange(-200, 200);
                // Only if not near a hole
                if (i >= FLOOR_COUNT - 1 || (
                    Math.abs(ropeX - hole1X - holeW / 2) > 120 &&
                    Math.abs(ropeX - hole2X - holeW / 2) > 120
                )) {
                    level.ropes.push({
                        x: ropeX,
                        topY: fy + 30,
                        bottomY: groundY - 20,
                    });
                }
            }
        }

        // --- EXIT on last floor ---
        const lastGroundY = (FLOOR_COUNT - 1) * FLOOR_H + FLOOR_H - 40;
        level.exitX = FLOOR_W - 150;
        level.exitY = lastGroundY - 50;
        level.exitZone = {
            x: FLOOR_W - 170,
            y: lastGroundY - 80,
            width: 60,
            height: 80,
        };

        return level;
    },

    // Check if a platform at px with width pw overlaps a hole
    overlapsHole(px, pw, holeX, holeW) {
        return px < holeX + holeW + 20 && px + pw > holeX - 20;
    },

    generateBossArena(chapter, bossNum) {
        const T = CONFIG.TILE;
        const arenaW = 1000;
        const arenaH = 400;
        const groundY = arenaH - 50;

        const level = {
            platforms: [],
            enemies: [],
            ropes: [],
            width: arenaW,
            height: arenaH + 50,
            // Player spawns on ground level, left side
            spawnX: 80,
            spawnY: groundY - CONFIG.PLAYER.HEIGHT - 2,
            exitX: arenaW - 200,
            exitY: groundY - 50,
            exitZone: null,
            chapter: chapter,
            isBossArena: true,
            bossNum: bossNum,
        };

        // Solid ground - full width
        level.platforms.push({ x: 0, y: groundY, width: arenaW, height: T * 2, type: 'bookshelf' });
        // Left wall
        level.platforms.push({ x: -T, y: 0, width: T, height: arenaH + 100, type: 'bookshelf' });
        // Right wall
        level.platforms.push({ x: arenaW, y: 0, width: T, height: arenaH + 100, type: 'bookshelf' });
        // Ceiling
        level.platforms.push({ x: 0, y: 0, width: arenaW, height: 20, type: 'bookshelf' });

        // A few elevated platforms for dodging - NOT blocking ground access
        level.platforms.push({ x: 100, y: groundY - 130, width: 140, height: 20, type: 'bookshelf' });
        level.platforms.push({ x: 430, y: groundY - 160, width: 140, height: 20, type: 'bookshelf' });
        level.platforms.push({ x: 760, y: groundY - 130, width: 140, height: 20, type: 'bookshelf' });

        // Boss spawns on ground, right side
        level.bossSpawn = { x: arenaW - 250, y: groundY - 80 };

        return level;
    },

    pickEnemy(chapter) {
        if (chapter === 1) return randomChoice(['wisp', 'wisp', 'crawler']);
        if (chapter === 2) return randomChoice(['wisp', 'crawler', 'crawler', 'shade']);
        return randomChoice(['crawler', 'shade', 'shade', 'wisp']);
    }
};

// ---- REWARD / UPGRADE SYSTEM ----
const Rewards = {
    elements: ['fire', 'ice', 'lightning', 'void'],

    generateElementChoice() {
        const shuffled = [...this.elements].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3).map(elem => ({
            type: 'element',
            element: elem,
            name: this.getElementName(elem),
            description: this.getElementDescription(elem),
            icon: this.getElementIcon(elem),
            color: this.getElementColor(elem),
        }));
    },

    generateUpgradeChoices(player, chapter, bossNum) {
        const pool = this.getUpgradePool(player, chapter, bossNum);
        const shuffled = pool.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(3, shuffled.length));
    },

    getUpgradePool(player, chapter, bossNum) {
        const pool = [];

        if (player.elementType) {
            pool.push({
                type: 'skill_damage', name: 'Amplified Power',
                description: `+15 ${player.elementType} skill damage`,
                icon: '\u2694', color: this.getElementColor(player.elementType),
                apply: (p) => { p.skillDamageBonus += 15; }
            });
            pool.push({
                type: 'skill_aoe', name: 'Expanded Reach',
                description: '+40 skill area of effect',
                icon: '\u25CE', color: this.getElementColor(player.elementType),
                apply: (p) => { p.skillAoeBonus += 40; }
            });
            pool.push({
                type: 'skill_cooldown', name: 'Quick Recovery',
                description: '-3s skill cooldown',
                icon: '\u27F3', color: '#44aaff',
                apply: (p) => { p.skillCooldownReduction += 180; }
            });
        }

        pool.push({
            type: 'attack_damage', name: 'Sharpened Yoyo',
            description: '+8 quick attack damage',
            icon: '\u2726', color: CONFIG.COLORS.GOLD,
            apply: (p) => { p.attackDamage += 8; }
        });
        pool.push({
            type: 'power_damage', name: 'Crushing Blow',
            description: '+15 power attack damage',
            icon: '\u2B50', color: '#ff8844',
            apply: (p) => { p.powerDamage += 15; }
        });
        pool.push({
            type: 'max_hp', name: 'Vitality',
            description: '+25 max HP',
            icon: '\u2665', color: '#ff4444',
            apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.hp + 25, p.maxHp); }
        });
        pool.push({
            type: 'heal', name: 'Restoration',
            description: 'Heal 40 HP',
            icon: '\u271A', color: '#44ff44',
            apply: (p) => { p.hp = Math.min(p.hp + 40, p.maxHp); }
        });

        if (chapter >= 2) {
            pool.push({
                type: 'attack_range', name: 'Extended String',
                description: '+20 yoyo attack range',
                icon: '\u2194', color: '#aaaaff',
                apply: (p) => { p.attackRange += 20; }
            });
        }
        if (chapter >= 3) {
            pool.push({
                type: 'skill_duration', name: 'Prolonged Fury',
                description: '+1s skill duration',
                icon: '\u23F1', color: '#ffaa44',
                apply: (p) => { p.skillDuration += 60; }
            });
        }

        return pool;
    },

    getElementName(elem) {
        return { fire: 'Inferno', ice: 'Frostbite', lightning: 'Thunderstrike', void: 'Void Pulse' }[elem] || elem;
    },
    getElementDescription(elem) {
        return {
            fire: 'Unleash burning flames in all directions',
            ice: 'Launch freezing ice shards that pierce enemies',
            lightning: 'Call down devastating lightning bolts',
            void: 'Release expanding void energy rings',
        }[elem] || '';
    },
    getElementIcon(elem) {
        return { fire: '\uD83D\uDD25', ice: '\u2744', lightning: '\u26A1', void: '\uD83C\uDF00' }[elem] || '?';
    },
    getElementColor(elem) {
        return { fire: '#ff6622', ice: '#66ccff', lightning: '#ffdd44', void: '#aa44ff' }[elem] || '#ffffff';
    }
};
