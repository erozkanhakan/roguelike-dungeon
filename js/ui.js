// ============================================================
// UI.JS - Menus, HUD, reward selection, screens
// ============================================================

const UI = {
    rewardChoices: [],
    selectedReward: 0,
    rewardActive: false,
    transitionAlpha: 0,
    transitionTarget: 0,
    messageText: '',
    messageTimer: 0,
    storyTexts: [],
    storyIndex: 0,
    storyActive: false,

    // ---- HUD ----
    drawHUD(ctx, player, gameState) {
        // HP Bar
        const hpBarX = 20;
        const hpBarY = 20;
        const hpBarW = 200;
        const hpBarH = 16;

        // HP background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(hpBarX - 2, hpBarY - 2, hpBarW + 4, hpBarH + 4);

        // HP fill
        const hpRatio = player.hp / player.maxHp;
        const hpGrad = ctx.createLinearGradient(hpBarX, hpBarY, hpBarX + hpBarW * hpRatio, hpBarY);
        hpGrad.addColorStop(0, '#ff3333');
        hpGrad.addColorStop(1, hpRatio > 0.5 ? '#ff6644' : '#ff2222');
        ctx.fillStyle = hpGrad;
        ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

        // HP border
        ctx.strokeStyle = '#886644';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX - 1, hpBarY - 1, hpBarW + 2, hpBarH + 2);

        // HP text
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpBarX + hpBarW / 2, hpBarY + 12);

        // Skill cooldown indicator
        if (player.elementType) {
            const skillX = 20;
            const skillY = 48;
            const skillSize = 36;
            const cdMax = player.skillMaxCooldown - player.skillCooldownReduction;
            const cdRatio = player.skillCooldown / Math.max(1, cdMax);

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(skillX - 2, skillY - 2, skillSize + 4, skillSize + 4);

            // Element color fill (shows cooldown)
            const elemColor = Rewards.getElementColor(player.elementType);
            ctx.fillStyle = cdRatio > 0 ? 'rgba(40, 40, 40, 0.8)' : elemColor;
            ctx.fillRect(skillX, skillY, skillSize, skillSize);

            // Cooldown overlay
            if (cdRatio > 0) {
                ctx.fillStyle = elemColor + '40';
                ctx.fillRect(skillX, skillY + skillSize * (1 - cdRatio), skillSize, skillSize * cdRatio);

                // Cooldown text
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '12px Georgia';
                ctx.textAlign = 'center';
                const cdSeconds = Math.ceil(player.skillCooldown / 60);
                ctx.fillText(cdSeconds + 's', skillX + skillSize / 2, skillY + skillSize / 2 + 4);
            } else {
                // Ready indicator
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px Georgia';
                ctx.textAlign = 'center';
                ctx.fillText('[L]', skillX + skillSize / 2, skillY + skillSize / 2 + 4);
            }

            // Border
            ctx.strokeStyle = player.skillCooldown <= 0 ? elemColor : '#555555';
            ctx.lineWidth = player.skillCooldown <= 0 ? 2 : 1;
            ctx.strokeRect(skillX - 1, skillY - 1, skillSize + 2, skillSize + 2);

            // Element name
            ctx.fillStyle = elemColor;
            ctx.font = '10px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText(Rewards.getElementName(player.elementType), skillX + skillSize + 8, skillY + 12);

            // Skill active indicator
            if (player.skillActive) {
                ctx.strokeStyle = elemColor;
                ctx.lineWidth = 2;
                ctx.shadowColor = elemColor;
                ctx.shadowBlur = 10;
                ctx.strokeRect(skillX - 3, skillY - 3, skillSize + 6, skillSize + 6);
                ctx.shadowBlur = 0;
            }
        }

        // Chapter / section info
        ctx.fillStyle = CONFIG.COLORS.GOLD;
        ctx.font = '14px Georgia';
        ctx.textAlign = 'right';
        ctx.fillText(`Chapter ${gameState.chapter}`, CONFIG.WIDTH - 20, 30);

        // Power charge indicator
        if (player.powerCharging) {
            const chargeRatio = Math.min(player.powerChargeTime / player.powerChargeMax, 1);
            const chargeBarX = CONFIG.WIDTH / 2 - 50;
            const chargeBarY = CONFIG.HEIGHT - 100;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(chargeBarX - 2, chargeBarY - 2, 104, 14);

            const cGrad = ctx.createLinearGradient(chargeBarX, chargeBarY, chargeBarX + 100, chargeBarY);
            cGrad.addColorStop(0, '#ffaa00');
            cGrad.addColorStop(1, chargeRatio >= 1 ? '#ffff00' : '#ffcc44');
            ctx.fillStyle = cGrad;
            ctx.fillRect(chargeBarX, chargeBarY, 100 * chargeRatio, 10);

            ctx.strokeStyle = CONFIG.COLORS.GOLD;
            ctx.strokeRect(chargeBarX - 1, chargeBarY - 1, 102, 12);

            if (chargeRatio >= 1) {
                ctx.fillStyle = '#ffff00';
                ctx.font = '10px Georgia';
                ctx.textAlign = 'center';
                ctx.fillText('MAX!', chargeBarX + 50, chargeBarY - 5);
            }
        }

        // Upgrades list
        if (player.upgrades.length > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(CONFIG.WIDTH - 160, 45, 150, player.upgrades.length * 18 + 10);

            ctx.font = '10px Georgia';
            ctx.textAlign = 'right';
            for (let i = 0; i < player.upgrades.length; i++) {
                const u = player.upgrades[i];
                ctx.fillStyle = u.color || '#cccccc';
                ctx.fillText(`${u.icon || '•'} ${u.name}`, CONFIG.WIDTH - 20, 62 + i * 18);
            }
        }

        // Message display
        if (this.messageTimer > 0) {
            this.messageTimer--;
            const alpha = Math.min(1, this.messageTimer / 30);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.font = '18px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText(this.messageText, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 100);
        }

        // Controls hint (first few seconds)
        if (gameState.totalTime < 600) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.max(0, 1 - gameState.totalTime / 600) + ')';
            ctx.font = '12px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('Arrow Keys / WASD: Move  |  Space: Jump  |  Z: Attack  |  X: Power Attack (hold)  |  C: Skill  |  Shift: Dodge', CONFIG.WIDTH / 2, CONFIG.HEIGHT - 20);
        }
    },

    showMessage(text, duration = 120) {
        this.messageText = text;
        this.messageTimer = duration;
    },

    // ---- TITLE SCREEN ----
    drawTitleScreen(ctx) {
        // Dark background
        ctx.fillStyle = '#0a0714';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        const time = Date.now() / 1000;

        // Title
        ctx.save();
        ctx.shadowColor = '#c4a24e';
        ctx.shadowBlur = 20;
        ctx.fillStyle = CONFIG.COLORS.GOLD;
        ctx.font = 'bold 52px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Lost in Pages', CONFIG.WIDTH / 2, 250);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.fillStyle = '#8a7a60';
        ctx.font = '18px Georgia';
        ctx.fillText('A Roguelike Library Adventure', CONFIG.WIDTH / 2, 290);

        // Girl silhouette (simple)
        const girlX = CONFIG.WIDTH / 2;
        const girlY = 420;
        ctx.fillStyle = '#1a1020';
        // Dress
        ctx.beginPath();
        ctx.moveTo(girlX, girlY - 30);
        ctx.lineTo(girlX + 18, girlY + 15);
        ctx.lineTo(girlX - 18, girlY + 15);
        ctx.closePath();
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(girlX, girlY - 38, 10, 0, Math.PI * 2);
        ctx.fill();
        // Hair
        ctx.fillRect(girlX - 12, girlY - 42, 24, 8);
        ctx.fillRect(girlX - 14, girlY - 38, 5, 20);
        ctx.fillRect(girlX + 9, girlY - 38, 5, 18);
        // Yoyo
        ctx.fillStyle = CONFIG.COLORS.GOLD;
        const yoyoX = girlX + 25 + Math.sin(time * 2) * 10;
        const yoyoY = girlY - 10;
        ctx.beginPath();
        ctx.arc(yoyoX, yoyoY, 5, 0, Math.PI * 2);
        ctx.fill();
        // String
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(girlX + 15, girlY - 18);
        ctx.lineTo(yoyoX, yoyoY);
        ctx.stroke();

        // Press start
        const blink = Math.sin(time * 3) > 0;
        if (blink) {
            ctx.fillStyle = '#e8e0d0';
            ctx.font = '20px Georgia';
            ctx.fillText('Press ENTER or SPACE to Start', CONFIG.WIDTH / 2, 540);
        }

        // Controls info
        ctx.fillStyle = '#6a5a40';
        ctx.font = '13px Georgia';
        ctx.fillText('Arrows / WASD: Move & Jump  |  Z: Quick Attack  |  X (hold): Power Attack  |  C: Skill  |  Shift: Dodge', CONFIG.WIDTH / 2, 620);
        ctx.fillText('Wall Jump: Jump toward wall  |  Rope: Move into rope + Up to grab, Space to launch', CONFIG.WIDTH / 2, 645);

        ctx.restore();
    },

    // ---- DEATH SCREEN ----
    drawDeathScreen(ctx, deathTimer) {
        const alpha = Math.min(0.85, deathTimer / 120);
        ctx.fillStyle = `rgba(10, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        if (deathTimer > 60) {
            ctx.fillStyle = '#ff3333';
            ctx.font = 'bold 48px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('FALLEN', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 30);

            ctx.fillStyle = '#aa6666';
            ctx.font = '18px Georgia';
            ctx.fillText('The nightmare consumes...', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 20);

            if (deathTimer > 120) {
                const blink = Math.sin(Date.now() / 500) > 0;
                if (blink) {
                    ctx.fillStyle = '#ff8888';
                    ctx.font = '16px Georgia';
                    ctx.fillText('Press ENTER to try again', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 80);
                }
            }
        }
    },

    // ---- REWARD SELECTION ----
    showRewards(choices) {
        this.rewardChoices = choices;
        this.selectedReward = 0;
        this.rewardActive = true;
    },

    updateRewardSelection() {
        if (!this.rewardActive) return null;

        if (Input.justPressed('ArrowLeft') || Input.justPressed('KeyA')) {
            this.selectedReward = Math.max(0, this.selectedReward - 1);
            Sound.play('select');
        }
        if (Input.justPressed('ArrowRight') || Input.justPressed('KeyD')) {
            this.selectedReward = Math.min(this.rewardChoices.length - 1, this.selectedReward + 1);
            Sound.play('select');
        }
        if (Input.justPressed('Enter') || Input.justPressed('Space')) {
            this.rewardActive = false;
            Sound.play('reward');
            return this.rewardChoices[this.selectedReward];
        }

        return null;
    },

    drawRewardScreen(ctx) {
        if (!this.rewardActive) return;

        // Overlay
        ctx.fillStyle = 'rgba(5, 2, 15, 0.88)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Title
        ctx.fillStyle = CONFIG.COLORS.GOLD;
        ctx.font = 'bold 32px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Choose Your Reward', CONFIG.WIDTH / 2, 140);

        ctx.fillStyle = '#8a7a60';
        ctx.font = '14px Georgia';
        ctx.fillText('← → to select, ENTER to confirm', CONFIG.WIDTH / 2, 175);

        // Draw reward cards
        const cardW = 220;
        const cardH = 280;
        const totalW = this.rewardChoices.length * (cardW + 30) - 30;
        const startX = CONFIG.WIDTH / 2 - totalW / 2;

        for (let i = 0; i < this.rewardChoices.length; i++) {
            const choice = this.rewardChoices[i];
            const cx = startX + i * (cardW + 30);
            const cy = 210;
            const selected = i === this.selectedReward;

            // Card background
            ctx.fillStyle = selected ? 'rgba(60, 40, 20, 0.95)' : 'rgba(30, 20, 10, 0.9)';
            ctx.fillRect(cx, cy, cardW, cardH);

            // Border
            ctx.strokeStyle = selected ? CONFIG.COLORS.GOLD : '#4a3a2a';
            ctx.lineWidth = selected ? 3 : 1;
            ctx.strokeRect(cx, cy, cardW, cardH);

            // Glow if selected
            if (selected) {
                ctx.shadowColor = CONFIG.COLORS.GOLD;
                ctx.shadowBlur = 15;
                ctx.strokeRect(cx, cy, cardW, cardH);
                ctx.shadowBlur = 0;
            }

            // Icon area
            ctx.fillStyle = choice.color || '#888888';
            ctx.font = '36px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText(choice.icon || '?', cx + cardW / 2, cy + 60);

            // Name
            ctx.fillStyle = selected ? '#ffffff' : '#cccccc';
            ctx.font = 'bold 16px Georgia';
            ctx.fillText(choice.name, cx + cardW / 2, cy + 110);

            // Element badge for element choices
            if (choice.type === 'element') {
                ctx.fillStyle = choice.color;
                ctx.font = '13px Georgia';
                ctx.fillText(`[ ${choice.element.toUpperCase()} ]`, cx + cardW / 2, cy + 135);
            }

            // Description (word wrap)
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '13px Georgia';
            const words = choice.description.split(' ');
            let line = '';
            let lineY = cy + 160;
            for (const word of words) {
                const testLine = line + word + ' ';
                if (ctx.measureText(testLine).width > cardW - 30) {
                    ctx.fillText(line.trim(), cx + cardW / 2, lineY);
                    line = word + ' ';
                    lineY += 18;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), cx + cardW / 2, lineY);

            // Selection arrow
            if (selected) {
                ctx.fillStyle = CONFIG.COLORS.GOLD;
                ctx.font = '20px Georgia';
                ctx.fillText('▼', cx + cardW / 2, cy - 8);
            }
        }
    },

    // ---- BOSS INTRO ----
    drawBossIntro(ctx, bossName, timer) {
        const progress = timer / 120;
        const alpha = progress < 0.5 ? progress * 2 : 2 - progress * 2;

        ctx.fillStyle = `rgba(10, 0, 0, ${alpha * 0.5})`;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Warning lines
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(0, CONFIG.HEIGHT / 2 - 45, CONFIG.WIDTH, 2);
        ctx.fillRect(0, CONFIG.HEIGHT / 2 + 35, CONFIG.WIDTH, 2);

        // Boss name
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 40px Georgia';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
        ctx.fillText(bossName, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 10);
        ctx.shadowBlur = 0;

        ctx.restore();
    },

    // ---- CHAPTER TRANSITION ----
    drawChapterTransition(ctx, chapter, timer) {
        const maxTime = 180;
        const progress = timer / maxTime;
        let alpha;
        if (progress < 0.3) alpha = progress / 0.3;
        else if (progress > 0.7) alpha = (1 - progress) / 0.3;
        else alpha = 1;

        ctx.fillStyle = `rgba(5, 2, 10, ${alpha})`;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.fillStyle = CONFIG.COLORS.GOLD;
        ctx.font = 'bold 36px Georgia';
        ctx.textAlign = 'center';

        const chapterNames = [
            '',
            'Chapter I: The Reading Room',
            'Chapter II: The Forbidden Archive',
            'Chapter III: The Heart of the Library'
        ];

        ctx.fillText(chapterNames[chapter] || `Chapter ${chapter}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 10);

        ctx.fillStyle = '#8a7a60';
        ctx.font = '16px Georgia';
        const subtexts = [
            '',
            'Where the pages whisper...',
            'Where knowledge becomes shadow...',
            'Where dreams and reality merge...'
        ];
        ctx.fillText(subtexts[chapter] || '', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 30);

        ctx.restore();
    },

    // ---- VICTORY / ENDING ----
    drawVictoryScreen(ctx, timer) {
        const alpha = Math.min(1, timer / 120);
        ctx.fillStyle = `rgba(5, 2, 10, ${alpha})`;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        if (timer < 180) return;

        ctx.save();
        const textAlpha = Math.min(1, (timer - 180) / 60);
        ctx.globalAlpha = textAlpha;

        // First part: awakening
        if (timer < 480) {
            ctx.fillStyle = '#e8e0d0';
            ctx.font = '20px Georgia';
            ctx.textAlign = 'center';

            const lines = [
                'The nightmare fades...',
                'Light floods through the library windows.',
                'A gentle hand shakes her shoulder.',
            ];

            const lineIndex = Math.min(Math.floor((timer - 180) / 100), lines.length - 1);
            for (let i = 0; i <= lineIndex; i++) {
                const la = Math.min(1, (timer - 180 - i * 100) / 60);
                ctx.globalAlpha = la;
                ctx.fillText(lines[i], CONFIG.WIDTH / 2, 250 + i * 40);
            }
        }
        // Second part: reveal
        else if (timer < 780) {
            ctx.fillStyle = '#e8e0d0';
            ctx.font = '20px Georgia';
            ctx.textAlign = 'center';

            const revealAlpha = Math.min(1, (timer - 480) / 60);
            ctx.globalAlpha = revealAlpha;

            ctx.fillText('"Wake up, dear. The library is closing."', CONFIG.WIDTH / 2, 280);

            if (timer > 600) {
                const a2 = Math.min(1, (timer - 600) / 60);
                ctx.globalAlpha = a2;
                ctx.fillStyle = '#aaa';
                ctx.font = '16px Georgia';
                ctx.fillText('She opens her eyes. The books stand still on their shelves.', CONFIG.WIDTH / 2, 340);
                ctx.fillText('No demons. No void. Just the warm evening light...', CONFIG.WIDTH / 2, 370);
                ctx.fillText('...and the yoyo still clutched in her hand.', CONFIG.WIDTH / 2, 400);
            }
        }
        // End
        else {
            const endAlpha = Math.min(1, (timer - 780) / 60);
            ctx.globalAlpha = endAlpha;

            ctx.fillStyle = CONFIG.COLORS.GOLD;
            ctx.font = 'bold 42px Georgia';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#c4a24e';
            ctx.shadowBlur = 15;
            ctx.fillText('The End', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 20);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#8a7a60';
            ctx.font = '16px Georgia';
            ctx.fillText('Thank you for playing Lost in Pages', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 30);

            if (timer > 900) {
                const blink = Math.sin(Date.now() / 500) > 0;
                if (blink) {
                    ctx.fillStyle = '#ccaa66';
                    ctx.font = '14px Georgia';
                    ctx.fillText('Press ENTER to return to the title', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 80);
                }
            }
        }

        ctx.restore();
    },

    // ---- EXIT ZONE INDICATOR ----
    drawExitZone(ctx, zone) {
        if (!zone) return;
        const sx = Camera.screenX(zone.x);
        const sy = Camera.screenY(zone.y);
        const time = Date.now() / 1000;

        // Glowing portal
        ctx.save();
        const pulse = 0.5 + Math.sin(time * 3) * 0.2;
        ctx.fillStyle = `rgba(200, 170, 80, ${pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx + zone.width / 2, sy + zone.height / 2, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(200, 170, 80, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx + zone.width / 2, sy + zone.height / 2, 30 + Math.sin(time * 2) * 5, 0, Math.PI * 2);
        ctx.stroke();

        // Arrow
        ctx.fillStyle = `rgba(200, 170, 80, ${pulse})`;
        ctx.font = '16px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('▶', sx + zone.width / 2, sy - 15 + Math.sin(time * 4) * 3);
        ctx.font = '11px Georgia';
        ctx.fillText('PROCEED', sx + zone.width / 2, sy - 28);

        ctx.restore();
    },

    // Screen transition
    drawTransition(ctx) {
        if (this.transitionAlpha > 0.01) {
            ctx.fillStyle = `rgba(5, 2, 10, ${this.transitionAlpha})`;
            ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        }
        // Smooth transition
        this.transitionAlpha += (this.transitionTarget - this.transitionAlpha) * 0.08;
    },

    fadeIn() { this.transitionTarget = 0; },
    fadeOut() { this.transitionTarget = 1; },
};
