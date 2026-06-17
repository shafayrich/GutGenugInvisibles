'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Main Game Class
// ---------------------------------------------------------------------------

const STATES = {
  TITLE:     'title',
  CHAR_SEL:  'characterSelect',
  BOSS_INTRO:'bossIntro',
  PLAYING:   'playing',
  WAVE_CLEAR:'waveClear',
  PAUSED:    'paused',
  GAME_OVER: 'gameOver',
  VICTORY:   'victory'
};

class Game {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.W        = CONFIG.CANVAS.WIDTH;
    this.H        = CONFIG.CANVAS.HEIGHT;
    this.arena    = CONFIG.ARENA;

    // Input state
    this.keys      = {};
    this.mouseX    = this.W / 2;
    this.mouseY    = this.H / 2;
    this._justPressed = {};

    // Attach input handlers
    this._bindInput();

    // Game state
    this.state      = STATES.TITLE;
    this.player     = null;
    this.enemies    = [];
    this.projectiles= [];
    this.effects    = [];
    this.waveManager= new WaveManager();

    this.currentWave = 1;
    this.currentPhase= 0;
    this.score       = 0;
    this.highScore   = 0;

    // Spawn queue: enemies to place during transition into arena
    this._spawnQueue  = [];
    this._spawnTimer  = 0;   // ms between each enemy spawn
    this._spawnDelay  = 250; // ms

    // Transition timer (wave clear, boss intro)
    this._transTimer  = 0;
    this._transMsg    = '';
    this._transSub    = '';

    // Character select state
    this._charIds     = Object.keys(CONFIG.CHARACTERS);
    this._selectedIdx = 0;

    // Save data
    this._save = this._loadSave();

    // Elapsed time for animations
    this._elapsed = 0;

    // Boss HP bar info
    this._bossEnemy   = null;

    // Phase label for wave 50
    this._phaseLabel  = null;

    this.lastTime = 0;
  }

  // ── SAVE / LOAD ──────────────────────────────────────────────────────────
  _loadSave() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return { gameCompleted: false, highScore: 0, unlockedEggs: [] };
  }

  _writeSave() {
    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(this._save));
    } catch (_) { /* ignore */ }
  }

  _isCharLocked(charId) {
    const cfg = CONFIG.CHARACTERS[charId];
    if (!cfg.isEasterEgg) return false;
    return !this._save.gameCompleted && !this._save.unlockedEggs.includes(charId);
  }

  // ── INPUT ────────────────────────────────────────────────────────────────
  _bindInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (!this._justPressed[e.code]) this._justPressed[e.code] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (this.W / r.width);
      this.mouseY = (e.clientY - r.top)  * (this.H / r.height);
    });
    this.canvas.addEventListener('click', e => {
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (this.W / r.width);
      const my = (e.clientY - r.top)  * (this.H / r.height);
      this._handleClick(mx, my);
    });
  }

  _consumeJustPressed(code) {
    const v = this._justPressed[code];
    this._justPressed[code] = false;
    return v;
  }

  // ── GAME LOOP ────────────────────────────────────────────────────────────
  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(ts) {
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this._elapsed += dt * 1000;
    this._update(dt);
    this._render();
    this._justPressed = {};
    requestAnimationFrame(t => this._loop(t));
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  _update(dt) {
    switch (this.state) {
      case STATES.TITLE:      this._updateTitle(dt);     break;
      case STATES.CHAR_SEL:   this._updateCharSel(dt);   break;
      case STATES.BOSS_INTRO: this._updateBossIntro(dt); break;
      case STATES.PLAYING:    this._updatePlaying(dt);   break;
      case STATES.WAVE_CLEAR: this._updateWaveClear(dt); break;
      case STATES.PAUSED:     this._updatePaused(dt);    break;
      case STATES.GAME_OVER:  this._updateGameOver(dt);  break;
      case STATES.VICTORY:    this._updateVictory(dt);   break;
    }
  }

  _updateTitle(dt) {
    if (this._consumeJustPressed('Enter') || this._consumeJustPressed('Space')) {
      this.state = STATES.CHAR_SEL;
    }
  }

  _updateCharSel(dt) {
    const count = this._charIds.length;
    if (this._consumeJustPressed('ArrowRight') || this._consumeJustPressed('KeyD')) {
      this._selectedIdx = (this._selectedIdx + 1) % count;
    }
    if (this._consumeJustPressed('ArrowLeft') || this._consumeJustPressed('KeyA')) {
      this._selectedIdx = (this._selectedIdx - 1 + count) % count;
    }
    if (this._consumeJustPressed('Enter') || this._consumeJustPressed('Space')) {
      const id = this._charIds[this._selectedIdx];
      if (this._isCharLocked(id)) {
        // Flash locked message
        this.effects.push(new Effect('text', {
          x: this.W / 2, y: this.H * 0.82,
          text: '🔒 Complete the game first!',
          color: '#FF4444', size: 22, life: 1800
        }));
        return;
      }
      this._startGame(id);
    }
    if (this._consumeJustPressed('Escape')) {
      this.state = STATES.TITLE;
    }
  }

  _updateBossIntro(dt) {
    this._transTimer -= dt * 1000;
    if (this._transTimer <= 0) {
      this._spawnWaveEnemies();
      this.state = STATES.PLAYING;
    }
  }

  _updatePlaying(dt) {
    if (this._consumeJustPressed('KeyP') || this._consumeJustPressed('Escape')) {
      this.state = STATES.PAUSED;
      return;
    }

    // Special ability
    if (this._consumeJustPressed('KeyE') || this._consumeJustPressed('ShiftLeft') || this._consumeJustPressed('ShiftRight')) {
      const result = this.player.useSpecial(this.enemies, this.arena, this);
      if (result) this._handleSpecialResult(result);
    }

    // Update player
    this.player.update(dt, this.keys, this.mouseX, this.mouseY, this.arena);

    // Auto-attack
    const attackResult = this.player.tryAttack(this.enemies);
    if (attackResult) {
      if (attackResult.type === 'projectile') {
        this.projectiles.push(attackResult.proj);
      } else if (attackResult.type === 'melee') {
        // Melee swing effect
        this.effects.push(new Effect('meleeSwing', {
          x: this.player.x, y: this.player.y,
          r: this.player.attackRange,
          color: this.player.cfg.color,
          life: 200
        }));
      }
    }

    // Spawn queue
    if (this._spawnQueue.length > 0) {
      this._spawnTimer -= dt * 1000;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = this._spawnDelay;
        const item = this._spawnQueue.shift();
        this.enemies.push(this._createEnemy(item.type, item.scale));
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      const evts = e.update(dt, this.player, this.arena);
      if (evts) {
        for (const evt of evts) {
          if (evt.type === 'projectile') this.projectiles.push(evt.proj);
          if (evt.type === 'teleportEffect') {
            this.effects.push(new Effect('teleport', { x: evt.x, y: evt.y, color: '#7CFC00', life: 500 }));
          }
          if (evt.type === 'summon') {
            for (let i = 0; i < evt.count; i++) {
              this.enemies.push(this._createEnemy(evt.enemyType, this.waveManager.scaleFactor(this.currentWave)));
            }
          }
        }
      }
    }

    // Update projectiles
    for (const p of this.projectiles) {
      p.update(dt, this.player, this.enemies, this.arena);
    }

    // Update effects
    for (const ef of this.effects) ef.update(dt);

    // Collect score / remove dead enemies
    this.enemies = this.enemies.filter(e => {
      if (e.dead) { this.score += e.score; return false; }
      return true;
    });
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.effects     = this.effects.filter(ef => !ef.dead);

    // Update boss reference
    this._bossEnemy = this.enemies.find(e => e.isBoss) || null;

    // Player dead?
    if (this.player.dead) {
      this._endGame(false);
      return;
    }

    // Check wave completion
    if (this.enemies.length === 0 && this._spawnQueue.length === 0) {
      this._onWaveComplete();
    }
  }

  _updateWaveClear(dt) {
    this._transTimer -= dt * 1000;
    if (this._transTimer <= 0) {
      this._advanceToNextWave();
    }
  }

  _updatePaused(dt) {
    if (this._consumeJustPressed('KeyP') || this._consumeJustPressed('Escape')) {
      this.state = STATES.PLAYING;
    }
  }

  _updateGameOver(dt) {
    if (this._consumeJustPressed('Enter') || this._consumeJustPressed('Space')) {
      this._goToTitle();
    }
  }

  _updateVictory(dt) {
    if (this._consumeJustPressed('Enter') || this._consumeJustPressed('Space')) {
      this._goToTitle();
    }
  }

  // ── GAME FLOW ─────────────────────────────────────────────────────────────
  _startGame(charId) {
    const cfg = CONFIG.CHARACTERS[charId];
    const cx  = this.arena.X + this.arena.W / 2;
    const cy  = this.arena.Y + this.arena.H / 2;
    this.player      = new Player(cx, cy, cfg);
    this.enemies     = [];
    this.projectiles = [];
    this.effects     = [];
    this.currentWave = 1;
    this.currentPhase= 0;
    this.score       = 0;
    this._bossEnemy  = null;

    this._loadWave(1, 0);
  }

  _loadWave(waveNum, phaseIndex) {
    this.currentWave  = waveNum;
    this.currentPhase = phaseIndex;
    const def = this.waveManager.getDef(waveNum);
    if (!def) return;

    this._phaseLabel  = this.waveManager.phaseLabel(waveNum, phaseIndex);

    // Build spawn queue
    const spawnList = this.waveManager.buildSpawnList(waveNum, phaseIndex);
    const scale     = def.scaleFactor || 1;
    this._spawnQueue = [];
    for (const item of spawnList) {
      for (let i = 0; i < item.count; i++) {
        this._spawnQueue.push({ type: item.type, scale });
      }
    }
    // Shuffle so enemy types interleave
    this._shuffle(this._spawnQueue);
    this._spawnTimer = 0;

    // Show boss intro or jump straight to playing
    const showIntro = def.isBossWave || def.title;
    if (showIntro) {
      this._transMsg   = def.title   || `Wave ${waveNum}`;
      this._transSub   = def.subtitle || '';
      if (def.isFinalWave && phaseIndex > 0) {
        this._transMsg = this._phaseLabel;
        this._transSub = '';
      }
      this._transTimer = def.isBossWave ? CONFIG.BOSS_INTRO_MS : 1800;
      this.state = STATES.BOSS_INTRO;
    } else {
      this._spawnWaveEnemies();
      this.state = STATES.PLAYING;
    }
  }

  _spawnWaveEnemies() {
    // Enemies will be dribbled in from _spawnQueue during _updatePlaying
  }

  _onWaveComplete() {
    if (this.currentWave === 50) {
      // Check if there are more phases
      const def = this.waveManager.getDef(50);
      if (this.currentPhase + 1 < def.phases.length) {
        // Next phase
        this._transMsg   = '✅  Phase Complete!';
        this._transSub   = def.phases[this.currentPhase + 1].label;
        this._transTimer = 2200;
        this.state = STATES.WAVE_CLEAR;
        return;
      }
      // Final phase beaten!
      this._endGame(true);
      return;
    }

    this._transMsg   = `✅  Wave ${this.currentWave} Clear!`;
    this._transSub   = this.currentWave < 50 ? `Next: Wave ${this.currentWave + 1}` : '';
    this._transTimer = CONFIG.WAVE_CLEAR_MS;
    this.state = STATES.WAVE_CLEAR;
  }

  _advanceToNextWave() {
    if (this.currentWave === 50) {
      this._loadWave(50, this.currentPhase + 1);
    } else {
      this._loadWave(this.currentWave + 1, 0);
    }
  }

  _endGame(won) {
    if (this.score > this._save.highScore) {
      this._save.highScore = this.score;
    }
    this.highScore = this._save.highScore;

    if (won) {
      this._save.gameCompleted = true;
      this._writeSave();
      this.state = STATES.VICTORY;
    } else {
      this._writeSave();
      this.state = STATES.GAME_OVER;
    }
  }

  _goToTitle() {
    this.state   = STATES.TITLE;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.player  = null;
  }

  // ── ENEMY FACTORY ─────────────────────────────────────────────────────────
  _createEnemy(typeId, scaleFactor = 1) {
    const cfg = CONFIG.ENEMIES[typeId];
    if (!cfg) throw new Error(`Unknown enemy type: ${typeId}`);

    // Spawn on arena edge
    const edgePts = Utils.arenaEdgePoints(this.arena, 16);
    const spawnPt = Utils.pick(edgePts);
    // Push a bit inside to avoid out-of-bounds clamping on first frame
    const margin = cfg.radius + 4;
    const sx = Utils.clamp(spawnPt.x, this.arena.X + margin, this.arena.X + this.arena.W - margin);
    const sy = Utils.clamp(spawnPt.y, this.arena.Y + margin, this.arena.Y + this.arena.H - margin);

    return new Enemy(sx, sy, cfg, scaleFactor);
  }

  // ── SPECIAL RESULT HANDLER ────────────────────────────────────────────────
  _handleSpecialResult(result) {
    if (!result) return;
    const { id } = result;

    if (id === 'flyingPunch' && result.effect) {
      this.effects.push(new Effect('explosion', { ...result.effect, life: 500 }));
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '💥 FLYING PUNCH!', color: '#FFD700', size: 20, life: 1000
      }));
    }
    if (id === 'sonicBoom') {
      this.effects.push(new Effect('explosion', {
        x: this.player.x, y: this.player.y, r: 200, color: '#CC1111', life: 400
      }));
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '🌊 SONIC BOOM!', color: '#CC1111', size: 20, life: 1000
      }));
    }
    if (id === 'matterShield') {
      this.effects.push(new Effect('shield', {
        x: this.player.x, y: this.player.y, color: '#FF69B4', life: 3000
      }));
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '🛡 MATTER SHIELD!', color: '#FF69B4', size: 20, life: 1000
      }));
    }
    if (id === 'alienRage') {
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '😤 ALIEN RAGE!', color: '#FF8C00', size: 20, life: 1000
      }));
    }
    if (id === 'berserker') {
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '⚔️ BERSERKER!', color: '#DAA520', size: 20, life: 1000
      }));
    }
    if (id === 'teleport') {
      this.effects.push(new Effect('teleport', {
        x: this.player.x, y: this.player.y, color: '#708090', life: 400
      }));
    }
    if (id === 'laserEyes') {
      this.effects.push(new Effect('explosion', {
        x: this.player.x, y: this.player.y, r: 350, color: '#FF4500', life: 600
      }));
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '🔴 LASER EYES!', color: '#FF4500', size: 22, life: 1000
      }));
    }
    if (id === 'nuclearBlast' && result.effect) {
      this.effects.push(new Effect('explosion', { ...result.effect, life: 800 }));
      this.effects.push(new Effect('text', {
        x: this.player.x, y: this.player.y - 30,
        text: '☢️ NUCLEAR BLAST!', color: '#FF6600', size: 22, life: 1200
      }));
    }
  }

  // ── CLICK HANDLER ─────────────────────────────────────────────────────────
  _handleClick(mx, my) {
    switch (this.state) {
      case STATES.TITLE:
        this.state = STATES.CHAR_SEL;
        break;

      case STATES.CHAR_SEL:
        // Click on character card
        this._charIds.forEach((id, i) => {
          const pos = this._charCardPos(i);
          if (mx >= pos.x && mx <= pos.x + pos.w &&
              my >= pos.y && my <= pos.y + pos.h) {
            this._selectedIdx = i;
          }
        });
        // Check select button
        const selBtn = this._selectBtnRect();
        if (mx >= selBtn.x && mx <= selBtn.x + selBtn.w &&
            my >= selBtn.y && my <= selBtn.y + selBtn.h) {
          const id = this._charIds[this._selectedIdx];
          if (!this._isCharLocked(id)) {
            this._startGame(id);
          } else {
            this.effects.push(new Effect('text', {
              x: this.W / 2, y: this.H * 0.82,
              text: '🔒 Complete the game first!',
              color: '#FF4444', size: 22, life: 1800
            }));
          }
        }
        break;

      case STATES.PLAYING:
        // Click triggers special
        const spResult = this.player.useSpecial(this.enemies, this.arena, this);
        if (spResult) this._handleSpecialResult(spResult);
        break;

      case STATES.GAME_OVER:
      case STATES.VICTORY:
        this._goToTitle();
        break;
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Background
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, this.W, this.H);

    switch (this.state) {
      case STATES.TITLE:      this._renderTitle(ctx);     break;
      case STATES.CHAR_SEL:   this._renderCharSel(ctx);   break;
      case STATES.BOSS_INTRO: this._renderBossIntro(ctx); break;
      case STATES.PLAYING:    this._renderPlaying(ctx);   break;
      case STATES.WAVE_CLEAR: this._renderWaveClear(ctx); break;
      case STATES.PAUSED:     this._renderPaused(ctx);    break;
      case STATES.GAME_OVER:  this._renderGameOver(ctx);  break;
      case STATES.VICTORY:    this._renderVictory(ctx);   break;
    }

    // Update effects for char select / title
    if (this.state === STATES.CHAR_SEL || this.state === STATES.TITLE) {
      this.effects = this.effects.filter(e => !e.dead);
      for (const e of this.effects) e.draw(ctx);
    }
  }

  // ── TITLE SCREEN ──────────────────────────────────────────────────────────
  _renderTitle(ctx) {
    const cx = this.W / 2, cy = this.H / 2;

    // Animated background circles
    const t = this._elapsed / 1000;
    const colors = ['#1A6BFF33', '#CC111133', '#FF69B433', '#00CED133'];
    for (let i = 0; i < 8; i++) {
      const angle = (t * 0.3 + i * Math.PI / 4);
      const r = 180 + Math.sin(t * 0.5 + i) * 40;
      const x = cx + Math.cos(angle) * 220;
      const y = cy + Math.sin(angle) * 120;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    }

    // Title
    ctx.save();
    ctx.shadowColor = '#1A6BFF';
    ctx.shadowBlur  = 30;
    ctx.font        = 'bold 62px Arial';
    ctx.fillStyle   = '#FFFFFF';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('INVINCIBLES', cx, cy - 90);
    ctx.restore();

    ctx.font        = '24px Arial';
    ctx.fillStyle   = '#AAAACC';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('A GutGenug Wave Survival Game', cx, cy - 45);

    // Character silhouettes row
    const chars = ['mark', 'omniman', 'eve', 'allen', 'battlebeast', 'cecil'];
    chars.forEach((id, i) => {
      const cfg = CONFIG.CHARACTERS[id];
      const x = cx - (chars.length - 1) * 55 + i * 110;
      const y = cy + 30;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color;
      ctx.fill();
      ctx.strokeStyle = cfg.accentColor;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.fillStyle    = '#FFF';
      ctx.font         = 'bold 14px Arial';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.name[0], x, y);
    });

    // Blink prompt
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.font      = '22px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('[ PRESS ENTER or CLICK TO START ]', cx, cy + 100);
    }

    // High score
    if (this._save.highScore > 0) {
      ctx.font      = '16px Arial';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'center';
      ctx.fillText(`High Score: ${this._save.highScore.toLocaleString()}`, cx, cy + 140);
    }

    if (this._save.gameCompleted) {
      ctx.font      = '14px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText('🌟 Easter Egg characters unlocked! (Homelander & Soldier Boy)', cx, cy + 168);
    }

    // Controls hint
    ctx.font      = '13px Arial';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText('WASD/Arrows: Move  |  E/Shift/Click: Special Ability  |  P: Pause', cx, this.H - 18);
  }

  // ── CHARACTER SELECT ──────────────────────────────────────────────────────
  _renderCharSel(ctx) {
    ctx.font      = 'bold 34px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT YOUR CHARACTER', this.W / 2, 38);

    this._charIds.forEach((id, i) => {
      const cfg = CONFIG.CHARACTERS[id];
      const pos  = this._charCardPos(i);
      const sel  = i === this._selectedIdx;
      const locked = this._isCharLocked(id);

      // Card background
      Utils.roundRect(ctx, pos.x, pos.y, pos.w, pos.h, 10);
      ctx.fillStyle = sel
        ? (locked ? '#3A1A1A' : '#1A2A3A')
        : (locked ? '#1A1010' : '#111827');
      ctx.fill();
      ctx.strokeStyle = sel
        ? (locked ? '#FF4444' : cfg.color)
        : '#333';
      ctx.lineWidth   = sel ? 3 : 1;
      ctx.stroke();

      // Character circle
      const cr = pos.w * 0.22;
      const cx = pos.x + pos.w / 2;
      const cy = pos.y + cr + 16;

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = locked ? '#333' : cfg.color;
      ctx.fill();
      ctx.strokeStyle = locked ? '#555' : cfg.accentColor;
      ctx.lineWidth   = 2;
      ctx.stroke();

      if (locked) {
        ctx.fillStyle    = '#888';
        ctx.font         = `bold ${cr}px Arial`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', cx, cy);
      } else {
        ctx.fillStyle    = '#FFF';
        ctx.font         = `bold ${cr * 0.9}px Arial`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.name[0].toUpperCase(), cx, cy);
      }

      // Easter egg badge
      if (cfg.isEasterEgg) {
        ctx.fillStyle    = '#FFD700';
        ctx.font         = '11px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌟 EASTER EGG', cx, cy + cr + 8);
      }

      // Troll badge
      if (cfg.isTroll) {
        ctx.fillStyle    = '#FF4444';
        ctx.font         = '11px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ TROLL', cx, cy + cr + 8);
      }

      // Name
      ctx.fillStyle    = locked ? '#666' : '#FFF';
      ctx.font         = `bold 11px Arial`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.subtitle || cfg.name, cx, pos.y + pos.h - 52);

      // Stats (only if selected)
      if (sel && !locked) {
        const statY = pos.y + pos.h - 38;
        ctx.font      = '10px Arial';
        ctx.fillStyle = '#AAA';
        ctx.fillText(`HP:${cfg.hp}  ATK:${cfg.atk}  SPD:${Math.round(cfg.speed/10)*10}`, cx, statY);
      }

      // Locked reason
      if (locked) {
        ctx.fillStyle    = '#FF4444';
        ctx.font         = '9px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Complete game to unlock', cx, pos.y + pos.h - 12);
      }
    });

    // Detail panel for selected character
    const selId  = this._charIds[this._selectedIdx];
    const selCfg = CONFIG.CHARACTERS[selId];
    const panelX = 20, panelY = 428, panelW = this.W - 40, panelH = 108;
    Utils.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.strokeStyle = selCfg.color;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.fillStyle    = '#FFF';
    ctx.font         = 'bold 15px Arial';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${selCfg.name} — ${selCfg.subtitle}`, panelX + 12, panelY + 10);

    ctx.fillStyle    = '#CCC';
    ctx.font         = '13px Arial';
    ctx.fillText(selCfg.description, panelX + 12, panelY + 32);

    ctx.fillStyle    = '#FFD700';
    ctx.font         = 'bold 12px Arial';
    ctx.fillText(`⚡ ${selCfg.special.name}: ${selCfg.special.desc}`, panelX + 12, panelY + 55);

    ctx.fillStyle    = '#888';
    ctx.font         = '11px Arial';
    ctx.fillText(
      `HP: ${selCfg.hp}  |  ATK: ${selCfg.atk}  |  Speed: ${selCfg.speed} px/s  |  Range: ${selCfg.attackRange}px  |  Cooldown: ${selCfg.special.cooldown / 1000}s`,
      panelX + 12, panelY + 75
    );

    // Select button
    const btn = this._selectBtnRect();
    Utils.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fillStyle = this._isCharLocked(selId) ? '#331111' : '#1A6BFF';
    ctx.fill();
    ctx.strokeStyle = this._isCharLocked(selId) ? '#FF4444' : '#FFF';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.fillStyle    = '#FFF';
    ctx.font         = 'bold 16px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this._isCharLocked(selId) ? '🔒 LOCKED' : '▶ SELECT (ENTER)',
      btn.x + btn.w / 2, btn.y + btn.h / 2
    );

    ctx.fillStyle    = '#555';
    ctx.font         = '12px Arial';
    ctx.textAlign    = 'center';
    ctx.fillText('← / → to browse  |  ESC to return', this.W / 2, 548);
  }

  _charCardPos(i) {
    const cols   = 4;
    const count  = this._charIds.length;
    const rows   = Math.ceil(count / cols);
    const cardW  = 195, cardH = 148;
    const padX   = 12, padY  = 8;
    const totalW = cols * cardW + (cols - 1) * padX;
    const startX = (this.W - totalW) / 2;
    const startY = 68;
    const col    = i % cols;
    const row    = Math.floor(i / cols);
    return {
      x: startX + col * (cardW + padX),
      y: startY + row * (cardH + padY),
      w: cardW, h: cardH
    };
  }

  _selectBtnRect() {
    return { x: this.W / 2 - 140, y: 385, w: 280, h: 32 };
  }

  // ── BOSS INTRO ────────────────────────────────────────────────────────────
  _renderBossIntro(ctx) {
    const pct = 1 - this._transTimer / (CONFIG.BOSS_INTRO_MS);
    const alpha = Math.min(1, pct * 3);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Dramatic overlay
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.W, this.H);

    const cx = this.W / 2, cy = this.H / 2;

    ctx.save();
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur  = 40;
    ctx.font        = 'bold 46px Arial';
    ctx.fillStyle   = '#FFFFFF';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(this._transMsg, cx, cy - 20);
    ctx.restore();

    if (this._transSub) {
      ctx.font        = '22px Arial';
      ctx.fillStyle   = '#AAAACC';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(this._transSub, cx, cy + 30);
    }

    ctx.font        = '16px Arial';
    ctx.fillStyle   = '#666';
    ctx.textAlign   = 'center';
    ctx.fillText(`Wave ${this.currentWave}`, cx, cy + 75);

    ctx.restore();
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  _renderPlaying(ctx) {
    this._drawArena(ctx);
    for (const ef of this.effects) ef.draw(ctx);
    for (const e  of this.enemies) e.draw(ctx);
    for (const p  of this.projectiles) p.draw(ctx);
    this.player.draw(ctx);
    this._drawHUD(ctx);
    if (this._bossEnemy) this._drawBossBar(ctx, this._bossEnemy);
  }

  _renderWaveClear(ctx) {
    this._renderPlaying(ctx);
    const alpha = Math.min(1, (CONFIG.WAVE_CLEAR_MS - this._transTimer) / 400);
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle   = 'rgba(0,20,0,0.75)';
    ctx.fillRect(this.W / 2 - 260, this.H / 2 - 55, 520, 110);
    ctx.globalAlpha = alpha;
    ctx.font        = 'bold 38px Arial';
    ctx.fillStyle   = '#2ECC71';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(this._transMsg, this.W / 2, this.H / 2 - 12);
    ctx.font        = '20px Arial';
    ctx.fillStyle   = '#AAA';
    ctx.fillText(this._transSub, this.W / 2, this.H / 2 + 26);
    ctx.restore();
  }

  _renderPaused(ctx) {
    this._renderPlaying(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.font      = 'bold 50px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', this.W / 2, this.H / 2 - 20);
    ctx.font      = '20px Arial';
    ctx.fillStyle = '#888';
    ctx.fillText('Press P or ESC to resume', this.W / 2, this.H / 2 + 36);
  }

  _renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.W, this.H);
    const cx = this.W / 2, cy = this.H / 2;

    ctx.save();
    ctx.shadowColor = '#E74C3C'; ctx.shadowBlur = 30;
    ctx.font        = 'bold 64px Arial';
    ctx.fillStyle   = '#E74C3C';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', cx, cy - 80);
    ctx.restore();

    ctx.font      = '28px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`You reached Wave ${this.currentWave}`, cx, cy - 20);
    ctx.fillText(`Score: ${this.score.toLocaleString()}`, cx, cy + 20);
    ctx.font      = '18px Arial';
    ctx.fillStyle = '#888';
    ctx.fillText(`Best: ${this._save.highScore.toLocaleString()}`, cx, cy + 58);
    ctx.font      = '20px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('[ ENTER / CLICK to return to title ]', cx, cy + 110);
  }

  _renderVictory(ctx) {
    const t = this._elapsed / 1000;
    // Colourful bg
    for (let i = 0; i < 10; i++) {
      const a = (t * 0.4 + i * Math.PI * 0.2);
      ctx.beginPath();
      ctx.arc(
        this.W / 2 + Math.cos(a) * 250,
        this.H / 2 + Math.sin(a) * 150,
        80, 0, Math.PI * 2
      );
      ctx.fillStyle = `hsla(${(t * 60 + i * 36) % 360},70%,50%,0.15)`;
      ctx.fill();
    }

    const cx = this.W / 2, cy = this.H / 2;

    ctx.save();
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 50;
    ctx.font        = 'bold 62px Arial';
    ctx.fillStyle   = '#FFD700';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆  VICTORY!', cx, cy - 100);
    ctx.restore();

    ctx.font      = '26px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('You defeated Grand Regent Thragg!', cx, cy - 42);
    ctx.fillText(`Final Score: ${this.score.toLocaleString()}`, cx, cy + 2);

    ctx.font      = '20px Arial';
    ctx.fillStyle = '#2ECC71';
    ctx.fillText('🌟 Homelander & Soldier Boy UNLOCKED!', cx, cy + 50);
    ctx.font      = '15px Arial';
    ctx.fillStyle = '#AAAACC';
    ctx.fillText('Easter egg characters are now available in character select.', cx, cy + 80);

    ctx.font      = '20px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('[ ENTER / CLICK to return to title ]', cx, cy + 130);
  }

  // ── ARENA & HUD ───────────────────────────────────────────────────────────
  _drawArena(ctx) {
    const a = this.arena;
    // Floor
    ctx.fillStyle = '#0F1120';
    ctx.fillRect(a.X, a.Y, a.W, a.H);

    // Grid lines
    ctx.strokeStyle = '#1A1E35';
    ctx.lineWidth   = 1;
    const step = 60;
    for (let x = a.X; x <= a.X + a.W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, a.Y); ctx.lineTo(x, a.Y + a.H); ctx.stroke();
    }
    for (let y = a.Y; y <= a.Y + a.H; y += step) {
      ctx.beginPath(); ctx.moveTo(a.X, y); ctx.lineTo(a.X + a.W, y); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#334';
    ctx.lineWidth   = 3;
    ctx.strokeRect(a.X, a.Y, a.W, a.H);
  }

  _drawHUD(ctx) {
    const p = this.player;
    const a = this.arena;

    // ── Top bar ────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, this.W, a.Y - 2);

    // Wave info
    const def  = this.waveManager.getDef(this.currentWave);
    const waveTxt = this.currentWave < 50
      ? `Wave ${this.currentWave} / 50`
      : `Wave 50 — ${this._phaseLabel || 'Final Gauntlet'}`;
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(waveTxt, this.W / 2, 30);

    // Score
    ctx.font      = '16px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${this.score.toLocaleString()}`, this.W - 14, 28);

    // Character name
    ctx.font      = '14px Arial';
    ctx.fillStyle = p.cfg.color;
    ctx.textAlign = 'left';
    ctx.fillText(p.cfg.name, 14, 20);

    // Enemy count
    const remaining = this.enemies.length + this._spawnQueue.length;
    ctx.font      = '14px Arial';
    ctx.fillStyle = '#E74C3C';
    ctx.textAlign = 'left';
    ctx.fillText(`Enemies: ${remaining}`, 14, 42);

    // ── Bottom HUD ─────────────────────────────────────────────────────────
    const hudY = a.Y + a.H + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, hudY, this.W, this.H - hudY);

    // HP bar
    const hpBarW = 220, hpBarH = 16;
    const hpBarX = 14, hpBarY = hudY + 8;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    const hpPct   = p.hp / p.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#2ECC71' : hpPct > 0.25 ? '#F39C12' : '#E74C3C';
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.font         = 'bold 11px Arial';
    ctx.fillStyle    = '#FFF';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP  ${Math.ceil(p.hp)} / ${p.maxHp}`, hpBarX + 4, hpBarY + hpBarH / 2);

    // Special ability cooldown bar
    const spBarW = 180, spBarH = 14;
    const spBarX = 14, spBarY = hudY + 30;
    const spPct  = Math.max(0, 1 - p.specialCooldown / p.specialMaxCooldown);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(spBarX, spBarY, spBarW, spBarH);
    ctx.fillStyle = spPct >= 1 ? '#FFD700' : p.cfg.color;
    ctx.fillRect(spBarX, spBarY, spBarW * spPct, spBarH);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.strokeRect(spBarX, spBarY, spBarW, spBarH);
    ctx.font         = 'bold 10px Arial';
    ctx.fillStyle    = '#FFF';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    const cdTxt = spPct >= 1 ? 'READY!' : `${(p.specialCooldown / 1000).toFixed(1)}s`;
    ctx.fillText(`⚡ ${p.cfg.special.name}  ${cdTxt}`, spBarX + 4, spBarY + spBarH / 2);

    // Status effects
    let statusX = 248;
    if (p.invincible) {
      ctx.fillStyle = '#FF69B4';
      ctx.font      = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🛡 SHIELD ${(p._invTimer / 1000).toFixed(1)}s`, statusX, hudY + 16);
      statusX += 130;
    }
    if (p.rageActive) {
      ctx.fillStyle = '#FF8C00';
      ctx.font      = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`😤 RAGE ${(p._rageTimer / 1000).toFixed(1)}s`, statusX, hudY + 16);
      statusX += 120;
    }
    if (p.berserkerActive) {
      ctx.fillStyle = '#DAA520';
      ctx.font      = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚔️ BSRK ${(p._berserkerTimer / 1000).toFixed(1)}s`, statusX, hudY + 16);
    }

    // Controls reminder
    ctx.font      = '11px Arial';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('WASD: Move  |  E/Shift/Click: Special  |  P: Pause', this.W - 10, this.H - 4);
  }

  _drawBossBar(ctx, boss) {
    const bw = 360, bh = 20;
    const bx = this.W / 2 - bw / 2, by = 56;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(bx, by, bw, bh);
    const pct = boss.hp / boss.maxHp;
    const color = boss._enraged ? '#FF4500' : '#E74C3C';
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.font      = 'bold 12px Arial';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${boss.typeCfg.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}${boss._enraged ? '  🔥 ENRAGED' : ''}`,
      this.W / 2, by + bh / 2
    );
  }

  // ── UTILITIES ─────────────────────────────────────────────────────────────
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
