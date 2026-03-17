// ============================================================
// PLAYER.JS - Player character: girl with yoyo, all mechanics
// ============================================================

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER.WIDTH;
        this.height = CONFIG.PLAYER.HEIGHT;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1; // 1 right, -1 left
        this.hp = 100;
        this.maxHp = 100;

        // States
        this.onGround = false;
        this.onWallLeft = false;
        this.onWallRight = false;
        this.wallSliding = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.wallJumpUsed = false;
        this.invincibleTimer = 0;
        this.dead = false;
        this.deathTimer = 0;

        // Rope
        this.onRope = false;
        this.ropeRef = null;
        this.ropeSwingAngle = 0;
        this.ropeSwingSpeed = 0;
        this.ropeY = 0;

        // Animation
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle'; // idle, run, jump, fall, wallSlide, attack, powerCharge, powerAttack, skill, hurt, ropeSwing
        this.prevState = 'idle';

        // Yoyo quick attack
        this.attacking = false;
        this.attackTimer = 0;
        this.attackDuration = 18;
        this.attackCooldown = 0;
        this.attackDamage = 15;
        this.attackRange = 70;
        this.yoyoExtend = 0;
        this.attackHitbox = null;

        // Power attack
        this.powerCharging = false;
        this.powerChargeTime = 0;
        this.powerChargeMax = 60;
        this.powerAttacking = false;
        this.powerAttackTimer = 0;
        this.powerAttackDuration = 25;
        this.powerDamage = 40;
        this.powerRange = 120;
        this.powerHitbox = null;

        // Elemental skill
        this.elementType = null; // 'fire', 'ice', 'lightning', 'void'
        this.skillCooldown = 0;
        this.skillMaxCooldown = 1200; // 20 seconds at 60fps
        this.skillActive = false;
        this.skillTimer = 0;
        this.skillDuration = 120; // 2 seconds
        this.skillDamage = 30;
        this.skillAoeRadius = 150;
        this.skillProjectiles = [];
        this.skillCooldownReduction = 0;
        this.skillDamageBonus = 0;
        this.skillAoeBonus = 0;

        // Dodge roll
        this.dodging = false;
        this.dodgeTimer = 0;
        this.dodgeDuration = 20; // ~0.33 seconds
        this.dodgeCooldown = 0;
        this.dodgeCooldownMax = 30; // 0.5s cooldown
        this.dodgeSpeed = 8; // fast roll speed
        this.dodgeDirection = 1;

        // Upgrades collected
        this.upgrades = [];

        // Sketch/draw properties
        this.hairFlow = 0;
        this.skirtFlow = 0;
        this.blinkTimer = 0;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.hp = this.maxHp;
        this.dead = false;
        this.deathTimer = 0;
        this.invincibleTimer = 0;
        this.attacking = false;
        this.powerCharging = false;
        this.powerAttacking = false;
        this.skillActive = false;
        this.skillCooldown = 0;
        this.onRope = false;
        this.ropeRef = null;
        this.elementType = null;
        this.upgrades = [];
        this.skillCooldownReduction = 0;
        this.skillDamageBonus = 0;
        this.skillAoeBonus = 0;
        this.attackDamage = 15;
        this.powerDamage = 40;
        this.skillDamage = 30;
        this.skillAoeRadius = 150;
        this.maxHp = 100;
        this.skillProjectiles = [];
        this.dodging = false;
        this.dodgeTimer = 0;
        this.dodgeCooldown = 0;
    }

    update(platforms, ropes) {
        if (this.dead) {
            this.deathTimer++;
            return;
        }

        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.dodgeCooldown > 0) this.dodgeCooldown--;

        // Dodge roll
        if (Input.dodge && !this.dodging && this.dodgeCooldown <= 0 && this.onGround &&
            !this.attacking && !this.powerAttacking && !this.powerCharging) {
            this.dodging = true;
            this.dodgeTimer = this.dodgeDuration;
            this.dodgeDirection = this.facing;
            this.dodgeCooldown = this.dodgeCooldownMax;
            this.invincibleTimer = this.dodgeDuration; // i-frames during roll
            this.attacking = false;
            Sound.play('dodge');
            Particles.burst(this.x + this.width / 2, this.y + this.height, 6, '#aaa', { speed: 2, life: 12, size: 2 });
        }

        if (this.dodging) {
            this.dodgeTimer--;
            this.vx = this.dodgeSpeed * this.dodgeDirection;
            // Apply gravity and collisions but override horizontal movement
            this.vy += CONFIG.GRAVITY;
            if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;
            const result = Physics.resolveCollisions(this, platforms);
            this.onGround = result.onGround;
            this.onWallLeft = result.onWallLeft;
            this.onWallRight = result.onWallRight;
            if (this.dodgeTimer <= 0) {
                this.dodging = false;
                this.vx *= 0.3; // slow down after roll
            }
            this.updateAnimState();
            return; // Skip normal movement during dodge
        }

        // Rope mechanic
        if (this.onRope) {
            this.updateRope(ropes, platforms);
            return;
        }

        // Check for rope grab - press Space when overlapping/near a rope
        if (Input.justPressed('Space') && !this.onRope) {
            for (const rope of ropes) {
                const playerCX = this.x + this.width / 2;
                const playerCY = this.y + this.height / 2;
                if (Math.abs(playerCX - rope.x) < 30 &&
                    playerCY > rope.topY - 10 &&
                    playerCY < rope.bottomY + 10) {
                    this.grabRope(rope);
                    break;
                }
            }
        }

        // Horizontal movement
        if (!this.attacking && !this.powerAttacking && !this.powerCharging) {
            if (Input.left) {
                this.vx = -CONFIG.PLAYER.SPEED;
                this.facing = -1;
            } else if (Input.right) {
                this.vx = CONFIG.PLAYER.SPEED;
                this.facing = 1;
            } else {
                this.vx *= CONFIG.FRICTION;
                if (Math.abs(this.vx) < 0.2) this.vx = 0;
            }
        }

        // Wall sliding
        this.wallSliding = false;
        if (!this.onGround && this.vy > 0) {
            if ((this.onWallLeft && Input.left) || (this.onWallRight && Input.right)) {
                this.wallSliding = true;
                this.vy = Math.min(this.vy, CONFIG.PLAYER.WALL_SLIDE_SPEED);
                this.wallJumpUsed = false;
            }
        }

        // Coyote time
        if (this.onGround) {
            this.coyoteTimer = CONFIG.PLAYER.COYOTE_TIME;
            this.wallJumpUsed = false;
        } else {
            this.coyoteTimer--;
        }

        // Jump buffer
        if (Input.jump) this.jumpBufferTimer = CONFIG.PLAYER.JUMP_BUFFER;
        else this.jumpBufferTimer--;

        // Jump
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.powerCharging) {
            this.vy = CONFIG.PLAYER.JUMP_FORCE;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.onGround = false;
            Sound.play('jump');
            Particles.burst(this.x + this.width / 2, this.y + this.height, 5, '#aaa', { speed: 2, life: 15, size: 2 });
        }

        // Wall jump - can wall jump repeatedly (needed for wall-jump shafts)
        // Reset wall jump when touching a new wall
        if (this.onWallLeft || this.onWallRight) {
            this.wallJumpUsed = false;
        }

        if (Input.jump && !this.onGround && this.coyoteTimer <= 0 && !this.wallJumpUsed) {
            if (this.onWallLeft || this.onWallRight) {
                const dir = this.onWallLeft ? 1 : -1;
                this.vx = CONFIG.PLAYER.WALL_JUMP_FORCE_X * dir;
                this.vy = CONFIG.PLAYER.WALL_JUMP_FORCE_Y;
                this.facing = dir;
                this.wallJumpUsed = true; // Prevents double-jump on same wall
                Sound.play('wallJump');
                const wx = this.onWallLeft ? this.x : this.x + this.width;
                Particles.burst(wx, this.y + this.height / 2, 8, '#aaa', { speed: 3, life: 20 });
            }
        }

        // Gravity
        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_FALL_SPEED) this.vy = CONFIG.MAX_FALL_SPEED;

        // Resolve collisions
        const result = Physics.resolveCollisions(this, platforms);
        this.onGround = result.onGround;
        this.onWallLeft = result.onWallLeft;
        this.onWallRight = result.onWallRight;

        // Combat
        this.updateCombat();

        // Skill cooldown
        if (this.skillCooldown > 0) this.skillCooldown--;
        this.updateSkill();

        // Update state for animation
        this.updateAnimState();

        // No infinite fall death - levels are enclosed with floors
    }

    grabRope(rope) {
        this.onRope = true;
        this.ropeRef = rope;
        this.ropeSwingAngle = 0;
        this.ropeSwingSpeed = 0; // no initial momentum
        this.ropeY = clamp(this.y + this.height / 2, rope.topY + 20, rope.bottomY - 10);
        this.ropeClimbSpeed = 0;
        this.ropePumpCount = 0;
        this.ropePumpDir = 0;
        this.ropePumpTimer = 0;
        this.ropeGrabFrame = true; // prevent immediate release
        this.vx = 0;
        this.vy = 0;
        Sound.play('rope');
    }

    updateRope(ropes, platforms) {
        if (!this.ropeRef) { this.onRope = false; return; }

        const rope = this.ropeRef;
        const totalRopeLen = rope.bottomY - rope.topY;

        // --- Climbing up/down the rope (Up/Down keys) ---
        const climbSpeed = 2.5;
        if (Input.up) {
            this.ropeClimbSpeed = -climbSpeed;
        } else if (Input.down) {
            this.ropeClimbSpeed = climbSpeed;
        } else {
            this.ropeClimbSpeed *= 0.7;
        }
        this.ropeY += this.ropeClimbSpeed;
        this.ropeY = clamp(this.ropeY, rope.topY + 20, rope.bottomY - 10);

        // --- Rope length and position ratio ---
        const ropeLen = this.ropeY - rope.topY;
        const posRatio = ropeLen / totalRopeLen; // 0 = top, 1 = bottom

        // --- Swing capacity based on position on rope (smooth interpolation) ---
        // Top 10% = 0, then linearly ramps to 1.0 at bottom
        let swingMultiplier;
        if (posRatio < 0.10) {
            swingMultiplier = 0;
        } else {
            swingMultiplier = (posRatio - 0.10) / 0.90; // 0 at 10%, 1 at 100%
        }

        // --- Realistic pendulum physics ---
        // gravity/length gives angular acceleration; stronger gravity = more realistic
        const normalizedLen = Math.max(ropeLen / 100, 0.5);
        const gravity = 0.0008;
        const angularAccel = -(gravity / normalizedLen) * Math.sin(this.ropeSwingAngle) * swingMultiplier;
        this.ropeSwingSpeed += angularAccel;

        // --- Player input: Left/Right to swing ---
        const currentDir = Input.left ? -1 : Input.right ? 1 : 0;

        if (currentDir !== 0 && swingMultiplier > 0) {
            // Direction change = pump
            if (currentDir !== this.ropePumpDir && this.ropePumpDir !== 0) {
                this.ropePumpCount = Math.min(this.ropePumpCount + 1, 5);
            }
            this.ropePumpDir = currentDir;

            // Pump force scaled by position on rope
            const pumpStrength = Math.min(this.ropePumpCount / 3, 1);
            const basePump = (0.0003 + pumpStrength * 0.001) * swingMultiplier;

            const inSync = (currentDir > 0 && this.ropeSwingSpeed > 0) ||
                           (currentDir < 0 && this.ropeSwingSpeed < 0);
            const syncBonus = inSync ? 1.5 : 0.8;

            this.ropeSwingSpeed += currentDir * basePump * syncBonus;
        } else {
            if (!this.ropePumpTimer) this.ropePumpTimer = 0;
            this.ropePumpTimer++;
            if (this.ropePumpTimer > 40) {
                this.ropePumpCount = Math.max(0, this.ropePumpCount - 1);
                this.ropePumpTimer = 0;
            }
        }

        if (currentDir !== 0) this.ropePumpTimer = 0;

        // Max angle: ~85 degrees at full swing capacity
        const maxAngle = (Math.PI * 0.47) * swingMultiplier;

        // Natural damping: ~10-15% energy loss per swing (realistic friction)
        // Near top of rope, damp much harder so it doesn't drift
        const dampFactor = swingMultiplier < 0.05 ? 0.9 : 0.985;
        this.ropeSwingSpeed *= dampFactor;

        // Update angle
        this.ropeSwingAngle += this.ropeSwingSpeed;
        this.ropeSwingAngle = clamp(this.ropeSwingAngle, -maxAngle, maxAngle);

        // Soft bounce at limits (not hard stop)
        if (maxAngle > 0.01 && Math.abs(this.ropeSwingAngle) >= maxAngle - 0.01) {
            this.ropeSwingSpeed *= -0.3;
        }

        // --- Calculate player world position ---
        let newX = rope.x + Math.sin(this.ropeSwingAngle) * ropeLen - this.width / 2;
        let newY = rope.topY + Math.cos(this.ropeSwingAngle) * ropeLen - this.height / 2;

        // Prevent going above anchor point
        if (newY < rope.topY) {
            newY = rope.topY;
            this.ropeSwingSpeed *= 0.3;
        }

        // Platform collision check
        if (platforms) {
            const playerRect = { x: newX, y: newY, width: this.width, height: this.height };
            for (const plat of platforms) {
                if (Physics.rectOverlap(playerRect, plat)) {
                    this.ropeSwingSpeed *= -0.2;
                    this.ropeSwingAngle -= this.ropeSwingSpeed * 2;
                    this.ropeSwingAngle = clamp(this.ropeSwingAngle, -maxAngle, maxAngle);
                    newX = rope.x + Math.sin(this.ropeSwingAngle) * ropeLen - this.width / 2;
                    newY = rope.topY + Math.cos(this.ropeSwingAngle) * ropeLen - this.height / 2;
                    break;
                }
            }
        }

        this.x = newX;
        this.y = newY;

        // Face the swing direction
        if (Math.abs(this.ropeSwingSpeed) > 0.002) {
            this.facing = this.ropeSwingSpeed > 0 ? 1 : -1;
        }

        // --- Jump off rope with momentum transfer (Space again to release) ---
        // Skip first frame to prevent grab+release in same frame
        if (!this.ropeGrabFrame && Input.justPressed('Space')) {
            this.onRope = false;
            this.ropeRef = null;

            // Calculate tangential velocity from swing
            // Tangential velocity = angular_speed * rope_length
            const tangentialSpeed = this.ropeSwingSpeed * ropeLen;

            // Convert to world velocity: tangent is perpendicular to rope
            // At angle θ, tangent direction is (cos(θ), -sin(θ)) for counter-clockwise
            const cosA = Math.cos(this.ropeSwingAngle);
            const sinA = Math.sin(this.ropeSwingAngle);

            // Horizontal: tangential * cos(angle) - reduced launch
            this.vx = tangentialSpeed * cosA * 0.6;
            // Vertical: jump force + reduced upward component
            this.vy = CONFIG.PLAYER.JUMP_FORCE * 0.7 + tangentialSpeed * (-sinA) * 0.3;

            // Clamp to reasonable values - no crazy launches
            this.vx = clamp(this.vx, -10, 10);
            this.vy = clamp(this.vy, CONFIG.PLAYER.JUMP_FORCE, 3);

            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            Sound.play('jump');

            // Launch particles
            Particles.burst(
                this.x + this.width / 2, this.y + this.height / 2,
                8, '#ddc080',
                { speed: Math.abs(this.vx) * 0.5 + 2, life: 20, size: 3 }
            );
        }

        // Clear grab frame flag after first frame
        this.ropeGrabFrame = false;

        this.state = 'ropeSwing';
    }

    updateCombat() {
        // Quick attack
        if (Input.attack && !this.attacking && !this.powerAttacking && !this.powerCharging && this.attackCooldown <= 0) {
            this.attacking = true;
            this.attackTimer = this.attackDuration;
            this.yoyoExtend = 0;
            this.attackCooldown = 8;
            Sound.play('attack');
        }

        if (this.attacking) {
            this.attackTimer--;
            // Yoyo extends out and back
            const progress = 1 - (this.attackTimer / this.attackDuration);
            if (progress < 0.5) {
                this.yoyoExtend = (progress / 0.5) * this.attackRange;
            } else {
                this.yoyoExtend = ((1 - progress) / 0.5) * this.attackRange;
            }

            this.attackHitbox = {
                x: this.facing > 0 ? this.x + this.width : this.x - this.yoyoExtend,
                y: this.y + 10,
                width: this.yoyoExtend,
                height: 24,
                damage: this.attackDamage,
                type: 'quick'
            };

            if (this.attackTimer <= 0) {
                this.attacking = false;
                this.attackHitbox = null;
                this.yoyoExtend = 0;
            }
        }

        // Power attack (hold and release)
        if (Input.powerAttack && !this.attacking && !this.powerAttacking) {
            if (!this.powerCharging) {
                this.powerCharging = true;
                this.powerChargeTime = 0;
            }
            this.powerChargeTime++;
            if (this.powerChargeTime < this.powerChargeMax) {
                if (this.powerChargeTime % 5 === 0) Sound.play('charge');
                Particles.burst(
                    this.x + this.width / 2 + this.facing * 15,
                    this.y + this.height / 2,
                    1, CONFIG.COLORS.GOLD,
                    { speed: 1, life: 15, size: 3, glow: true }
                );
            }
        }

        if (Input.powerAttackRelease && this.powerCharging) {
            this.powerCharging = false;
            if (this.powerChargeTime >= 20) {
                this.powerAttacking = true;
                this.powerAttackTimer = this.powerAttackDuration;
                const chargeRatio = Math.min(this.powerChargeTime / this.powerChargeMax, 1);
                this.powerDamageActual = this.powerDamage * (0.5 + chargeRatio * 0.5);
                this.powerRangeActual = this.powerRange * (0.6 + chargeRatio * 0.4);
                Sound.play('powerAttack');
                Camera.shake(4 + chargeRatio * 6, 10);
                // No forward lunge — stay in place for kiting
            }
            this.powerChargeTime = 0;
        }

        if (this.powerAttacking) {
            this.powerAttackTimer--;
            const progress = 1 - (this.powerAttackTimer / this.powerAttackDuration);

            this.powerHitbox = {
                x: this.facing > 0 ? this.x + this.width - 10 : this.x - this.powerRangeActual + 10,
                y: this.y - 10,
                width: this.powerRangeActual,
                height: this.height + 20,
                damage: this.powerDamageActual,
                type: 'power'
            };

            // Power attack particles
            if (this.powerAttackTimer % 2 === 0) {
                Particles.burst(
                    this.x + this.width / 2 + this.facing * this.powerRangeActual * progress,
                    this.y + this.height / 2,
                    3, CONFIG.COLORS.GOLD,
                    { speed: 4, life: 20, size: 4, glow: true }
                );
            }

            if (this.powerAttackTimer <= 0) {
                this.powerAttacking = false;
                this.powerHitbox = null;
            }
        }
    }

    useSkill() {
        if (!this.elementType || this.skillCooldown > 0 || this.skillActive) return;
        this.skillActive = true;
        this.skillTimer = this.skillDuration;
        this.skillCooldown = this.skillMaxCooldown - this.skillCooldownReduction;
        Sound.play('skill');
        Camera.shake(8, 20);
    }

    updateSkill() {
        if (Input.skill && this.elementType && this.skillCooldown <= 0 && !this.skillActive) {
            this.useSkill();
        }

        if (!this.skillActive) {
            this.skillProjectiles = [];
            return;
        }

        this.skillTimer--;
        const totalDamage = this.skillDamage + this.skillDamageBonus;
        const totalAoe = this.skillAoeRadius + this.skillAoeBonus;

        // Generate elemental projectiles/effects
        if (this.skillTimer % 6 === 0) {
            switch (this.elementType) {
                case 'lightning':
                    // Lightning bolts from above
                    for (let i = 0; i < 3; i++) {
                        this.skillProjectiles.push({
                            x: this.x + this.width / 2 + randomRange(-totalAoe, totalAoe),
                            y: this.y - 200,
                            targetY: this.y + this.height + 50,
                            width: 8, height: 200,
                            damage: totalDamage / 2,
                            life: 12,
                            type: 'lightning'
                        });
                    }
                    Camera.shake(3, 5);
                    break;

                case 'fire':
                    // Fire burst outward
                    for (let i = 0; i < 4; i++) {
                        const angle = (Math.PI * 2 / 4) * i + randomRange(-0.3, 0.3);
                        this.skillProjectiles.push({
                            x: this.x + this.width / 2,
                            y: this.y + this.height / 2,
                            vx: Math.cos(angle) * 6,
                            vy: Math.sin(angle) * 6,
                            width: 16, height: 16,
                            damage: totalDamage / 3,
                            life: 30,
                            type: 'fire'
                        });
                    }
                    break;

                case 'ice':
                    // Ice shards radiate
                    for (let i = 0; i < 5; i++) {
                        const angle = randomRange(0, Math.PI * 2);
                        this.skillProjectiles.push({
                            x: this.x + this.width / 2,
                            y: this.y + this.height / 2,
                            vx: Math.cos(angle) * 4,
                            vy: Math.sin(angle) * 4 - 2,
                            width: 10, height: 10,
                            damage: totalDamage / 4,
                            life: 40,
                            type: 'ice'
                        });
                    }
                    break;

                case 'void':
                    // Void pulse expanding ring
                    this.skillProjectiles.push({
                        x: this.x + this.width / 2,
                        y: this.y + this.height / 2,
                        radius: 10,
                        maxRadius: totalAoe,
                        damage: totalDamage / 3,
                        life: 25,
                        type: 'void'
                    });
                    break;
            }
        }

        // Update skill projectiles
        for (let i = this.skillProjectiles.length - 1; i >= 0; i--) {
            const p = this.skillProjectiles[i];
            p.life--;
            if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; }
            if (p.radius !== undefined) { p.radius += (p.maxRadius - p.radius) * 0.15; }
            if (p.life <= 0) this.skillProjectiles.splice(i, 1);
        }

        if (this.skillTimer <= 0) {
            this.skillActive = false;
            this.skillProjectiles = [];
        }
    }

    takeDamage(amount) {
        if (this.invincibleTimer > 0 || this.dead) return;
        this.hp -= amount;
        this.invincibleTimer = 60;
        Sound.play('hit');
        Camera.shake(6, 15);

        Particles.burst(this.x + this.width / 2, this.y + this.height / 2, 15, '#ff4444', { speed: 4, life: 25, size: 3 });

        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 0;
            Sound.play('death');
            Camera.shake(10, 30);
            Particles.burst(this.x + this.width / 2, this.y + this.height / 2, 40, '#ff2222', { speed: 6, life: 40, size: 4, glow: true });
        }
    }

    getHitboxes() {
        const hitboxes = [];
        if (this.attackHitbox) hitboxes.push(this.attackHitbox);
        if (this.powerHitbox) hitboxes.push(this.powerHitbox);
        return hitboxes;
    }

    updateAnimState() {
        this.prevState = this.state;

        if (this.onRope) { this.state = 'ropeSwing'; return; }
        if (this.dead) { this.state = 'dead'; return; }
        if (this.dodging) { this.state = 'dodge'; return; }
        if (this.skillActive) { this.state = 'skill'; return; }
        if (this.powerAttacking) { this.state = 'powerAttack'; return; }
        if (this.powerCharging) { this.state = 'powerCharge'; return; }
        if (this.attacking) { this.state = 'attack'; return; }
        if (this.invincibleTimer > 50) { this.state = 'hurt'; return; }
        if (this.wallSliding) { this.state = 'wallSlide'; return; }
        if (!this.onGround) {
            this.state = this.vy < 0 ? 'jump' : 'fall';
            return;
        }
        if (Math.abs(this.vx) > 0.5) { this.state = 'run'; return; }
        this.state = 'idle';
    }

    draw(ctx) {
        if (this.dead && this.deathTimer > 60) return;

        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        // Invincibility flash
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 3) % 2 === 0) return;

        // Update animation frame timer
        this.animTimer++;

        // --- Determine which sprite to use ---
        let spriteName = 'idle_1';
        let animSpeed = 20; // frames per sprite swap

        if (this.dodging) {
            const progress = 1 - (this.dodgeTimer / this.dodgeDuration);
            const frameIdx = Math.min(3, Math.floor(progress * 4));
            spriteName = 'dodge_' + (frameIdx + 1);
        } else if (this.powerAttacking) {
            spriteName = 'power_release';
        } else if (this.powerCharging) {
            spriteName = 'power_charge';
        } else if (this.attacking) {
            spriteName = 'attack';
        } else if (this.state === 'jump') {
            spriteName = 'jump';
        } else if (this.state === 'fall' || this.state === 'wallSlide') {
            spriteName = 'fall';
        } else if (this.state === 'run') {
            animSpeed = 10;
            spriteName = (Math.floor(this.animTimer / animSpeed) % 2 === 0) ? 'run_1' : 'run_2';
        } else if (this.state === 'ropeSwing') {
            spriteName = 'idle_1'; // on rope uses idle pose
        } else {
            // idle
            animSpeed = 30;
            spriteName = (Math.floor(this.animTimer / animSpeed) % 2 === 0) ? 'idle_1' : 'idle_2';
        }

        const sprite = SpriteLoader.get(spriteName);

        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx + this.width / 2, sy + this.height + 2, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            // --- SPRITE RENDERING ---
            const imgW = sprite.naturalWidth;
            const imgH = sprite.naturalHeight;

            // Scale sprite to fit player hitbox height, maintain aspect ratio
            const scale = this.height / imgH;
            const drawW = imgW * scale;
            const drawH = this.height;

            // For wide sprites (power_release), character body is on the left ~1/3
            const isWide = (spriteName === 'power_release');

            // Center the sprite on the player hitbox
            let drawX, drawY;
            if (isWide) {
                // Character is on left portion of sprite; align left side with player
                drawX = sx - drawW * 0.05; // slight offset so character aligns
                drawY = sy + this.height - drawH;
            } else {
                // Center sprite over hitbox
                drawX = sx + this.width / 2 - drawW / 2;
                drawY = sy + this.height - drawH;
            }

            // Flip for facing direction
            if (this.facing < 0) {
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, 0, 0, drawW, drawH);
            } else {
                ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
            }
        }

        // Skill aura (drawn around player position)
        if (this.skillActive && this.elementType) {
            ctx.restore();
            ctx.save();
            if (this.facing < 0) {
                ctx.translate(sx + this.width, sy);
                ctx.scale(-1, 1);
            } else {
                ctx.translate(sx, sy);
            }
            this.drawSkillAura(ctx);
        }

        ctx.restore();

        // Draw skill projectiles (not affected by character flip)
        this.drawSkillProjectiles(ctx);
    }

    drawYoyo(ctx) {
        const extend = this.attacking ? this.yoyoExtend : this.powerRangeActual || 0;
        const yoX = 24 + extend;
        const yoY = 18;

        // String
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(22, 18);
        ctx.lineTo(yoX, yoY);
        ctx.stroke();

        const ispower = this.powerAttacking;
        const size = ispower ? 8 : 5;

        if (ispower) {
            // Fire trail behind the yoyo
            const time = Date.now() / 1000;
            for (let i = 3; i >= 0; i--) {
                const trailX = yoX - i * 8;
                const flicker = Math.sin(time * 20 + i * 2) * 3;
                ctx.fillStyle = `rgba(255, ${120 + i * 30}, 20, ${0.6 - i * 0.12})`;
                ctx.beginPath();
                ctx.arc(trailX, yoY + flicker, size - i, 0, Math.PI * 2);
                ctx.fill();
            }
            // Fire glow
            ctx.fillStyle = 'rgba(255, 100, 20, 0.35)';
            ctx.beginPath();
            ctx.arc(yoX, yoY, size + 10, 0, Math.PI * 2);
            ctx.fill();
            // Fire core
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(yoX, yoY, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(yoX, yoY, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Normal yoyo (red)
            ctx.fillStyle = '#cc2222';
            ctx.beginPath();
            ctx.arc(yoX, yoY, size, 0, Math.PI * 2);
            ctx.fill();
            // Shine
            ctx.fillStyle = '#ff6666';
            ctx.beginPath();
            ctx.arc(yoX - 1, yoY - 1, size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawSkillAura(ctx) {
        const time = Date.now() / 1000;
        const cx = this.width / 2;
        const cy = this.height / 2;

        switch (this.elementType) {
            case 'lightning':
                ctx.strokeStyle = `rgba(120, 180, 255, ${0.5 + Math.sin(time * 15) * 0.3})`;
                ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    let px = cx, py = cy - 10;
                    ctx.moveTo(px, py);
                    for (let j = 0; j < 5; j++) {
                        px += randomRange(-8, 8);
                        py += randomRange(3, 8);
                        ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                }
                break;
            case 'fire':
                for (let i = 0; i < 6; i++) {
                    const angle = time * 3 + i * 1.05;
                    const r = 15 + Math.sin(time * 5 + i) * 5;
                    const fx = cx + Math.cos(angle) * r;
                    const fy = cy + Math.sin(angle) * r;
                    ctx.fillStyle = `rgba(255, ${100 + i * 20}, 30, 0.6)`;
                    ctx.fillRect(fx - 2, fy - 2, 4, 4);
                }
                break;
            case 'ice':
                ctx.fillStyle = `rgba(150, 220, 255, ${0.2 + Math.sin(time * 4) * 0.1})`;
                ctx.beginPath();
                ctx.arc(cx, cy, 20, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'void':
                ctx.fillStyle = `rgba(100, 30, 160, ${0.3 + Math.sin(time * 6) * 0.15})`;
                ctx.beginPath();
                ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    drawSkillProjectiles(ctx) {
        for (const p of this.skillProjectiles) {
            const sx = Camera.screenX(p.x);
            const sy = Camera.screenY(p.y);
            const alpha = p.life / 40;

            ctx.save();
            ctx.globalAlpha = Math.min(1, alpha + 0.3);

            switch (p.type) {
                case 'lightning':
                    // Lightning bolt
                    ctx.strokeStyle = `rgba(120, 180, 255, ${alpha})`;
                    ctx.shadowColor = '#88bbff';
                    ctx.shadowBlur = 15;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    let lx = sx;
                    let ly = sy;
                    ctx.moveTo(lx, ly);
                    const targetY = Camera.screenY(p.targetY);
                    const segments = 8;
                    for (let i = 1; i <= segments; i++) {
                        lx = sx + randomRange(-15, 15);
                        ly = sy + (targetY - sy) * (i / segments);
                        ctx.lineTo(lx, ly);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    break;

                case 'fire':
                    ctx.fillStyle = `rgba(255, ${80 + Math.random() * 80}, 20, ${alpha})`;
                    ctx.shadowColor = '#ff4400';
                    ctx.shadowBlur = 10;
                    ctx.fillRect(sx - p.width / 2, sy - p.height / 2, p.width, p.height);
                    ctx.shadowBlur = 0;
                    // Trail
                    Particles.burst(p.x, p.y, 1, '#ff6600', { speed: 1, life: 10, size: 3 });
                    break;

                case 'ice':
                    ctx.fillStyle = `rgba(180, 230, 255, ${alpha})`;
                    ctx.shadowColor = '#aaddff';
                    ctx.shadowBlur = 8;
                    // Diamond shape
                    ctx.beginPath();
                    ctx.moveTo(sx, sy - p.height / 2);
                    ctx.lineTo(sx + p.width / 2, sy);
                    ctx.lineTo(sx, sy + p.height / 2);
                    ctx.lineTo(sx - p.width / 2, sy);
                    ctx.closePath();
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;

                case 'void':
                    ctx.strokeStyle = `rgba(140, 60, 200, ${alpha})`;
                    ctx.shadowColor = '#8833cc';
                    ctx.shadowBlur = 12;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = `rgba(80, 20, 140, ${alpha * 0.2})`;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    break;
            }

            ctx.restore();
        }
    }
}
