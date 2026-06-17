'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Entity Classes
// ---------------------------------------------------------------------------

// ── BASE ENTITY ─────────────────────────────────────────────────────────────
class Entity {
  constructor(x, y, radius, cfg) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.hp     = cfg.hp;
    this.maxHp  = cfg.hp;
    this.atk    = cfg.atk;
    this.speed  = cfg.speed;
    this.vx = 0; this.vy = 0;
    this.dead   = false;
    this.color  = cfg.color  || '#FFF';
    this.borderColor = cfg.borderColor || '#000';
    // Brief flash when hit
    this._hitFlash = 0;      // countdown in ms
    this._hitFlashDur = 120;
    // Knockback velocity
    this._kbVx = 0; this._kbVy = 0;
  }

  update(dt) {
    // Knockback friction
    this._kbVx *= Math.pow(0.02, dt);
    this._kbVy *= Math.pow(0.02, dt);
    this.x += (this.vx + this._kbVx) * dt;
    this.y += (this.vy + this._kbVy) * dt;
    if (this._hitFlash > 0) this._hitFlash -= dt * 1000;
  }

  takeDamage(amount, srcX, srcY, knockback = 280) {
    this.hp -= amount;
    this._hitFlash = this._hitFlashDur;
    if (srcX !== undefined) {
      const n = Utils.normalise(this.x - srcX, this.y - srcY);
      const res = (this.knockbackResistance || 0);
      this._kbVx += n.x * knockback * (1 - res);
      this._kbVy += n.y * knockback * (1 - res);
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  distTo(other) { return Utils.dist(this.x, this.y, other.x, other.y); }
  overlaps(other) { return this.distTo(other) < this.radius + other.radius; }

  /** Draw a small HP bar above the entity. */
  _drawHpBar(ctx, w = null, yOffset = null) {
    const bw = w || this.radius * 2.6;
    const bh = 5;
    const bx = this.x - bw / 2;
    const by = this.y - this.radius - (yOffset || 14);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, bw, bh);
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = pct > 0.5 ? '#2ECC71' : pct > 0.25 ? '#F39C12' : '#E74C3C';
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  }
}

// ── PLAYER ──────────────────────────────────────────────────────────────────
class Player extends Entity {
  constructor(x, y, charCfg) {
    super(x, y, CONFIG.PLAYER_RADIUS, {
      hp: charCfg.hp,
      atk: charCfg.atk,
      speed: charCfg.speed,
      color: charCfg.color,
      borderColor: charCfg.accentColor
    });
    this.cfg           = charCfg;
    this.attackRange   = charCfg.attackRange;
    this.attackInterval= charCfg.attackInterval;
    this.isRanged      = charCfg.isRanged;
    this.specialCooldown     = 0;     // remaining ms
    this.specialMaxCooldown  = charCfg.special.cooldown;
    this._attackTimer  = 0;           // ms until next auto-attack

    // Status effects
    this.invincible    = false;
    this._invTimer     = 0;
    this.rageActive    = false;
    this._rageTimer    = 0;
    this.berserkerActive = false;
    this._berserkerTimer = 0;

    this._iframes      = 0;   // invincibility frames after taking damage (ms)
    this.score         = 0;

    this.knockbackResistance = 0;
  }

  get currentAtk() {
    let a = this.atk;
    if (this.rageActive) a *= 2;
    return a;
  }

  get currentAtkInterval() {
    let i = this.attackInterval;
    if (this.berserkerActive) i /= 3;
    return i;
  }

  update(dt, keys, mouseX, mouseY, arena) {
    // Movement
    let mx = 0, my = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) mx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) mx += 1;
    if (keys['ArrowUp']    || keys['KeyW']) my -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) my += 1;
    const mv = Utils.normalise(mx, my);
    this.vx = mv.x * this.speed;
    this.vy = mv.y * this.speed;

    super.update(dt);

    // Clamp to arena
    const c = Utils.constrainToRect(this.x, this.y, this.radius,
                                    arena.X, arena.Y, arena.W, arena.H);
    this.x = c.x; this.y = c.y;

    // Timers
    if (this._attackTimer > 0) this._attackTimer -= dt * 1000;
    if (this.specialCooldown > 0) this.specialCooldown -= dt * 1000;
    if (this._iframes > 0) this._iframes -= dt * 1000;

    // Status effects
    if (this.invincible) {
      this._invTimer -= dt * 1000;
      this.heal(15 * dt); // regen during shield
      if (this._invTimer <= 0) this.invincible = false;
    }
    if (this.rageActive) {
      this._rageTimer -= dt * 1000;
      if (this._rageTimer <= 0) this.rageActive = false;
    }
    if (this.berserkerActive) {
      this._berserkerTimer -= dt * 1000;
      if (this._berserkerTimer <= 0) this.berserkerActive = false;
    }

    return null; // no self-generated events
  }

  /** Called by Game when player takes a hit. */
  receiveDamage(amount, srcX, srcY) {
    if (this.invincible || this._iframes > 0) return;
    super.takeDamage(amount, srcX, srcY, 200);
    this._iframes = 350; // brief invincibility after hit
  }

  /** Try to auto-attack; returns array of Projectile or null (melee). */
  tryAttack(enemies) {
    if (this._attackTimer > 0 || enemies.length === 0) return null;
    this._attackTimer = this.currentAtkInterval;

    // Find nearest enemy in range
    let nearest = null, nearestDist = Infinity;
    for (const e of enemies) {
      const d = this.distTo(e);
      if (d < this.attackRange + e.radius && d < nearestDist) {
        nearest = e; nearestDist = d;
      }
    }
    if (!nearest) return null;

    if (!this.isRanged) {
      // Melee AoE around player
      const hits = [];
      for (const e of enemies) {
        if (this.distTo(e) < this.attackRange + e.radius) {
          hits.push(e);
          e.takeDamage(this.currentAtk, this.x, this.y, 250);
        }
      }
      return { type: 'melee', hits };
    } else {
      // Fire projectile toward nearest enemy
      const a = Utils.angle(this.x, this.y, nearest.x, nearest.y);
      return {
        type: 'projectile',
        proj: new Projectile(
          this.x, this.y,
          Math.cos(a) * (this.cfg.projectileSpeed || 400),
          Math.sin(a) * (this.cfg.projectileSpeed || 400),
          this.currentAtk,
          this.cfg.projectileColor || '#FFF',
          'enemy',
          6
        )
      };
    }
  }

  useSpecial(enemies, arena, game) {
    if (this.specialCooldown > 0) return null;
    this.specialCooldown = this.specialMaxCooldown;
    return this._doSpecial(enemies, arena, game);
  }

  _doSpecial(enemies, arena, game) {
    const id = this.cfg.special.id;

    if (id === 'flyingPunch') {
      // Dash to nearest enemy, damage all in wide radius
      let nearest = null, nd = Infinity;
      for (const e of enemies) {
        const d = this.distTo(e);
        if (d < nd) { nearest = e; nd = d; }
      }
      if (nearest) { this.x = nearest.x; this.y = nearest.y - this.radius - nearest.radius - 2; }
      const hits = [];
      for (const e of enemies) {
        if (this.distTo(e) < 110) {
          e.takeDamage(this.currentAtk * 4, this.x, this.y, 400);
          hits.push(e);
        }
      }
      return { type: 'special', id, effect: { x: this.x, y: this.y, r: 110, color: this.cfg.color } };
    }

    if (id === 'sonicBoom') {
      // Wide cone in direction of nearest enemy
      let nearest = null, nd = Infinity;
      for (const e of enemies) {
        const d = this.distTo(e);
        if (d < nd) { nearest = e; nd = d; }
      }
      const aimX = nearest ? nearest.x : this.x + 1;
      const aimY = nearest ? nearest.y : this.y;
      const angle = Utils.angle(this.x, this.y, aimX, aimY);
      const spread = Math.PI / 2.5;
      for (const e of enemies) {
        const ea = Utils.angle(this.x, this.y, e.x, e.y);
        let diff = ea - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < spread / 2 && this.distTo(e) < 380) {
          e.takeDamage(this.currentAtk * 3, this.x, this.y, 350);
        }
      }
      return { type: 'special', id, angle, color: this.cfg.color };
    }

    if (id === 'matterShield') {
      this.invincible = true;
      this._invTimer = 3000;
      return { type: 'special', id, color: this.cfg.color };
    }

    if (id === 'alienRage') {
      this.rageActive = true;
      this._rageTimer = 5000;
      return { type: 'special', id, color: this.cfg.accentColor };
    }

    if (id === 'berserker') {
      this.berserkerActive = true;
      this._berserkerTimer = 4000;
      return { type: 'special', id, color: this.cfg.accentColor };
    }

    if (id === 'teleport') {
      // Teleport to a random safe spot
      const margin = 30;
      this.x = Utils.rand(arena.X + margin, arena.X + arena.W - margin);
      this.y = Utils.rand(arena.Y + margin, arena.Y + arena.H - margin);
      return { type: 'special', id, color: this.cfg.color };
    }

    if (id === 'laserEyes') {
      // Hit ALL enemies
      for (const e of enemies) {
        e.takeDamage(this.currentAtk * 5, this.x, this.y, 300);
      }
      return { type: 'special', id, color: '#FF4500' };
    }

    if (id === 'nuclearBlast') {
      // Massive AoE
      for (const e of enemies) {
        if (this.distTo(e) < 300) {
          e.takeDamage(this.currentAtk * 6, this.x, this.y, 500);
        }
      }
      return { type: 'special', id, effect: { x: this.x, y: this.y, r: 300, color: '#FF6600' } };
    }

    return null;
  }

  draw(ctx) {
    const isFlashing = this._hitFlash > 0;
    const glowColor  = this.invincible ? '#FFD700' : (this.rageActive ? this.cfg.accentColor : null);

    // Glow effect for active buffs
    if (glowColor) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 18;
    }

    // Body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = isFlashing ? '#FFFFFF' : this.color;
    ctx.fill();
    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth   = 3;
    ctx.stroke();

    if (glowColor) ctx.restore();

    // Symbol — first letter of name
    ctx.fillStyle   = '#FFF';
    ctx.font        = `bold ${this.radius}px Arial`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(this.cfg.name[0].toUpperCase(), this.x, this.y);

    // HP bar (only if damaged)
    if (this.hp < this.maxHp) this._drawHpBar(ctx, this.radius * 3, 18);
  }
}

// ── ENEMY ───────────────────────────────────────────────────────────────────
class Enemy extends Entity {
  constructor(x, y, typeCfg, scaleFactor = 1) {
    super(x, y, typeCfg.radius, {
      hp:  Math.round(typeCfg.hp  * scaleFactor),
      atk: Math.round(typeCfg.atk * scaleFactor),
      speed: typeCfg.speed,
      color: typeCfg.color,
      borderColor: typeCfg.borderColor
    });
    this.typeCfg  = typeCfg;
    this.isBoss   = typeCfg.isBoss   || false;
    this.isFinalBoss = typeCfg.isFinalBoss || false;
    this.type     = typeCfg.type;
    this.score    = typeCfg.score;
    this.attackInterval = typeCfg.attackInterval;
    this.attackRange    = typeCfg.attackRange;
    this._attackTimer   = 0;
    this.knockbackResistance = typeCfg.knockbackResistance || 0;

    // Ranged
    this._preferredDist = typeCfg.preferredDist || 0;

    // Mauler / Angstrom can shoot
    this._shootTimer = 0;
    this._canShoot   = typeCfg.canShoot || typeCfg.type === 'ranged';
    this._shootInterval = typeCfg.shootInterval || typeCfg.attackInterval || 2000;

    // Angstrom teleport
    this._teleportTimer = typeCfg.canTeleport ? typeCfg.teleportInterval : Infinity;

    // Conquest rage
    this._enraged    = false;
    this._rageThreshold = typeCfg.rageThreshold || 0;

    // Thragg summon
    this._summonTimer = typeCfg.canSummon ? typeCfg.summonInterval : Infinity;

    // Intro dash (boss)
    this._introDone  = !this.isBoss;
  }

  update(dt, player, arena) {
    if (this.dead) return null;

    // Conquest rage check
    if (this._rageThreshold > 0 && !this._enraged && this.hp / this.maxHp < this._rageThreshold) {
      this._enraged = true;
      this.speed *= this.typeCfg.rageSpeedMult || 1.6;
      this.atk   = Math.round(this.atk * (this.typeCfg.rageAtkMult || 1.5));
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const n = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };

    // AI movement
    if (this._preferredDist > 0) {
      // Ranged: keep preferred distance
      if (dist > this._preferredDist + 20) {
        this.vx = n.x * this.speed;
        this.vy = n.y * this.speed;
      } else if (dist < this._preferredDist - 20) {
        this.vx = -n.x * this.speed;
        this.vy = -n.y * this.speed;
      } else {
        // Strafe
        this.vx = -n.y * this.speed * 0.5;
        this.vy =  n.x * this.speed * 0.5;
      }
    } else {
      // Melee / boss: walk toward player
      this.vx = n.x * this.speed;
      this.vy = n.y * this.speed;
    }

    super.update(dt);

    // Stay inside arena
    const c = Utils.constrainToRect(this.x, this.y, this.radius,
                                    arena.X, arena.Y, arena.W, arena.H);
    this.x = c.x; this.y = c.y;

    // Timers
    if (this._attackTimer > 0) this._attackTimer -= dt * 1000;
    if (this._teleportTimer !== Infinity) this._teleportTimer -= dt * 1000;
    if (this._summonTimer   !== Infinity) this._summonTimer   -= dt * 1000;
    if (this._shootTimer > 0) this._shootTimer -= dt * 1000;

    // Melee attack
    if (dist < this.attackRange + player.radius && this._attackTimer <= 0) {
      this._attackTimer = this.attackInterval;
      player.receiveDamage(this.atk, this.x, this.y);
    }

    // Events to return
    const events = [];

    // Ranged / boss projectile
    if (this._canShoot && this._shootTimer <= 0) {
      this._shootTimer = this._shootInterval;
      const projColor = this.typeCfg.projectileColor || this.color;
      const spd = this.typeCfg.projectileSpeed || 280;
      events.push({
        type: 'projectile',
        proj: new Projectile(
          this.x, this.y,
          n.x * spd, n.y * spd,
          this.atk,
          projColor,
          'player',
          5
        )
      });
    }

    // Angstrom Levy teleport
    if (this._teleportTimer <= 0) {
      this._teleportTimer = this.typeCfg.teleportInterval;
      const margin = 50;
      this.x = Utils.rand(arena.X + margin, arena.X + arena.W - margin);
      this.y = Utils.rand(arena.Y + margin, arena.Y + arena.H - margin);
      events.push({ type: 'teleportEffect', x: this.x, y: this.y });
    }

    // Thragg summon
    if (this._summonTimer <= 0 && this.typeCfg.canSummon) {
      this._summonTimer = this.typeCfg.summonInterval;
      events.push({
        type: 'summon',
        enemyType: this.typeCfg.summonType,
        count: this.typeCfg.summonCount
      });
    }

    return events.length > 0 ? events : null;
  }

  draw(ctx) {
    const flashing = this._hitFlash > 0;

    // Boss glow
    if (this.isBoss) {
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = this._enraged ? 30 : 15;
    }

    // Body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = flashing ? '#FFFFFF' : this.color;
    ctx.fill();
    ctx.strokeStyle = flashing ? '#FFD700' : this.borderColor;
    ctx.lineWidth   = this.isBoss ? 4 : 2;
    ctx.stroke();

    if (this.isBoss) ctx.restore();

    // Symbol
    ctx.fillStyle    = '#FFF';
    ctx.font         = `${Math.round(this.radius * 0.85)}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.typeCfg.symbol || '?', this.x, this.y);

    // HP bar for non-boss enemies
    if (!this.isBoss) this._drawHpBar(ctx);
  }
}

// ── PROJECTILE ───────────────────────────────────────────────────────────────
class Projectile {
  constructor(x, y, vx, vy, damage, color, hitsTag, radius = 5) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.damage   = damage;
    this.color    = color;
    this.hitsTag  = hitsTag; // 'enemy' | 'player'
    this.radius   = radius;
    this.dead     = false;
    this._life    = 4000; // ms
  }

  update(dt, player, enemies, arena) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this._life -= dt * 1000;

    // Out of arena or expired
    if (this._life <= 0 ||
        this.x < arena.X - 20 || this.x > arena.X + arena.W + 20 ||
        this.y < arena.Y - 20 || this.y > arena.Y + arena.H + 20) {
      this.dead = true;
      return;
    }

    // Hit check
    if (this.hitsTag === 'enemy') {
      for (const e of enemies) {
        if (!e.dead && Utils.dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
          e.takeDamage(this.damage, this.x, this.y, 200);
          this.dead = true;
          return;
        }
      }
    } else {
      if (Utils.dist(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
        player.receiveDamage(this.damage, this.x, this.y);
        this.dead = true;
      }
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    // Trail glow
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 6;
    ctx.fill();
    ctx.restore();
  }
}

// ── VISUAL EFFECT ────────────────────────────────────────────────────────────
class Effect {
  constructor(type, data) {
    this.type = type;
    this.data = data;
    this.life = data.life || 600; // ms
    this.maxLife = this.life;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt * 1000;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = 1 - this.life / this.maxLife;
    const alpha = 1 - t;

    ctx.save();
    ctx.globalAlpha = alpha;

    switch (this.type) {
      case 'meleeSwing': {
        const { x, y, r, color } = this.data;
        ctx.beginPath();
        ctx.arc(x, y, r * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = color || '#FFD700';
        ctx.lineWidth   = 4;
        ctx.stroke();
        break;
      }
      case 'explosion': {
        const { x, y, r, color } = this.data;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * (0.5 + t * 0.5));
        gradient.addColorStop(0, color || '#FFA500');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(x, y, r * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        break;
      }
      case 'teleport': {
        const { x, y, color } = this.data;
        const r = 35 * (0.5 + t * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = color || '#7F00FF';
        ctx.lineWidth   = 3;
        ctx.stroke();
        break;
      }
      case 'shield': {
        const { x, y, color } = this.data;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.PLAYER_RADIUS + 12 + t * 8, 0, Math.PI * 2);
        ctx.strokeStyle = color || '#FFD700';
        ctx.lineWidth   = 3;
        ctx.stroke();
        break;
      }
      case 'text': {
        const { x, y, text, color, size } = this.data;
        ctx.font         = `bold ${size || 18}px Arial`;
        ctx.fillStyle    = color || '#FFF';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - t * 40);
        break;
      }
    }

    ctx.restore();
  }
}
