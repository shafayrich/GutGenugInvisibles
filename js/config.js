'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Game Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  CANVAS: { WIDTH: 960, HEIGHT: 620 },

  // Playable arena bounds (inside the canvas)
  ARENA: { X: 40, Y: 90, W: 880, H: 480 },

  // Timing (milliseconds)
  WAVE_TRANSITION_MS: 3500,
  BOSS_INTRO_MS: 2800,
  WAVE_CLEAR_MS: 2000,

  PLAYER_RADIUS: 18,

  // localStorage key for save data
  SAVE_KEY: 'gutgenug_invincibles_save',

  // ---------------------------------------------------------------------------
  // PLAYABLE CHARACTERS
  // ---------------------------------------------------------------------------
  CHARACTERS: {
    mark: {
      id: 'mark',
      name: 'Mark Grayson',
      subtitle: 'Invincible',
      color: '#1A6BFF',
      accentColor: '#FFD700',
      hp: 150,
      atk: 28,
      speed: 265,        // pixels per second
      attackRange: 65,   // pixels
      attackInterval: 480, // ms between auto-attacks
      isRanged: false,
      special: {
        id: 'flyingPunch',
        name: 'Flying Punch',
        desc: 'Dash to the nearest enemy dealing massive damage to all in range.',
        cooldown: 5000
      },
      description: 'The hero Invincible. Balanced fighter with a devastating flying punch.'
    },

    omniman: {
      id: 'omniman',
      name: 'Nolan Grayson',
      subtitle: 'Omni-Man',
      color: '#CC1111',
      accentColor: '#000080',
      hp: 220,
      atk: 50,
      speed: 225,
      attackRange: 70,
      attackInterval: 680,
      isRanged: false,
      special: {
        id: 'sonicBoom',
        name: 'Sonic Boom',
        desc: 'Unleash a shockwave that strikes all enemies in a wide cone.',
        cooldown: 4200
      },
      description: "Mark's father and Viltrumite warrior. Immense power, Sonic Boom."
    },

    eve: {
      id: 'eve',
      name: 'Samantha Eve Wilkins',
      subtitle: 'Atom Eve',
      color: '#FF69B4',
      accentColor: '#FF1493',
      hp: 120,
      atk: 22,
      speed: 245,
      attackRange: 320,
      attackInterval: 400,
      isRanged: true,
      projectileColor: '#FF69B4',
      projectileSpeed: 420,
      special: {
        id: 'matterShield',
        name: 'Matter Shield',
        desc: 'Become invulnerable and slowly regenerate health for 3 s.',
        cooldown: 7000
      },
      description: 'Reality-altering hero. Ranged attacks and a life-saving shield.'
    },

    allen: {
      id: 'allen',
      name: 'Allen',
      subtitle: 'The Alien',
      color: '#00CED1',
      accentColor: '#FF8C00',
      hp: 280,
      atk: 32,
      speed: 205,
      attackRange: 62,
      attackInterval: 600,
      isRanged: false,
      special: {
        id: 'alienRage',
        name: 'Alien Rage',
        desc: 'Double damage and knockback for 5 seconds.',
        cooldown: 6000
      },
      description: 'Friendly alien powerhouse. Alien Rage doubles damage output.'
    },

    battlebeast: {
      id: 'battlebeast',
      name: 'Battle Beast',
      subtitle: 'The Savage',
      color: '#8B4513',
      accentColor: '#DAA520',
      hp: 360,
      atk: 55,
      speed: 190,
      attackRange: 75,
      attackInterval: 800,
      isRanged: false,
      special: {
        id: 'berserker',
        name: 'Berserker Mode',
        desc: 'Attack speed triples for 4 seconds. Unstoppable.',
        cooldown: 7500
      },
      description: 'Ferocious warrior. Berserker Mode triples attack speed.'
    },

    cecil: {
      id: 'cecil',
      name: 'Cecil Stedman',
      subtitle: 'Director of the GDA',
      color: '#708090',
      accentColor: '#2F4F4F',
      hp: 55,
      atk: 9,
      speed: 315,
      attackRange: 290,
      attackInterval: 300,
      isRanged: true,
      projectileColor: '#C0C0C0',
      projectileSpeed: 500,
      isTroll: true,
      special: {
        id: 'teleport',
        name: 'Tactical Teleport',
        desc: 'Instantly teleport to a random safe position in the arena.',
        cooldown: 2000
      },
      description: '⚠️ TROLL CHARACTER: Fragile GDA director with a pistol. Teleports.'
    },

    homelander: {
      id: 'homelander',
      name: 'John',
      subtitle: 'Homelander',
      color: '#0047AB',
      accentColor: '#FFD700',
      hp: 200,
      atk: 44,
      speed: 255,
      attackRange: 310,
      attackInterval: 350,
      isRanged: true,
      projectileColor: '#FF4500',
      projectileSpeed: 500,
      isEasterEgg: true,
      special: {
        id: 'laserEyes',
        name: 'Laser Eyes',
        desc: 'Sweep laser beams across all enemies dealing massive damage.',
        cooldown: 5500
      },
      description: '🌟 EASTER EGG (The Boys). Laser Eye sweep obliterates all enemies.'
    },

    soldierboy: {
      id: 'soldierboy',
      name: 'Benjamin',
      subtitle: 'Soldier Boy',
      color: '#4B5320',
      accentColor: '#B8860B',
      hp: 175,
      atk: 38,
      speed: 240,
      attackRange: 255,
      attackInterval: 380,
      isRanged: true,
      projectileColor: '#B8860B',
      projectileSpeed: 480,
      isEasterEgg: true,
      special: {
        id: 'nuclearBlast',
        name: 'Nuclear Blast',
        desc: 'Massive explosion that destroys everything in range.',
        cooldown: 9000
      },
      description: '🌟 EASTER EGG (The Boys). Nuclear Blast clears the entire arena.'
    }
  },

  // ---------------------------------------------------------------------------
  // ENEMY TYPES
  // ---------------------------------------------------------------------------
  ENEMIES: {
    reaniman: {
      id: 'reaniman',
      name: 'Reaniman',
      color: '#4A7C59',
      borderColor: '#2D4A35',
      symbol: '☠',
      hp: 45,
      atk: 6,
      speed: 78,
      radius: 16,
      score: 10,
      type: 'melee',
      attackInterval: 1000,
      attackRange: 24,
      knockbackResistance: 0
    },

    flaxan: {
      id: 'flaxan',
      name: 'Flaxan',
      color: '#9ACD32',
      borderColor: '#6B8E23',
      symbol: '👽',
      hp: 70,
      atk: 10,
      speed: 105,
      radius: 16,
      score: 15,
      type: 'ranged',
      attackInterval: 1900,
      attackRange: 290,
      preferredDist: 200,
      projectileColor: '#ADFF2F',
      projectileSpeed: 320,
      knockbackResistance: 0
    },

    maulerTwin: {
      id: 'maulerTwin',
      name: 'Mauler Twin',
      color: '#4169E1',
      borderColor: '#1E3A8A',
      symbol: '⚡',
      hp: 600,
      atk: 26,
      speed: 125,
      radius: 30,
      score: 300,
      type: 'boss',
      attackInterval: 1100,
      attackRange: 46,
      isBoss: true,
      knockbackResistance: 0.7,
      // Mauler twins also occasionally shoot energy blasts
      canShoot: true,
      shootInterval: 3500,
      projectileColor: '#4169E1',
      projectileSpeed: 280
    },

    viltramite: {
      id: 'viltramite',
      name: 'Viltramite',
      color: '#9932CC',
      borderColor: '#6A0DAD',
      symbol: '⚔',
      hp: 200,
      atk: 20,
      speed: 188,
      radius: 20,
      score: 80,
      type: 'melee',
      attackInterval: 750,
      attackRange: 28,
      knockbackResistance: 0.4
    },

    conquest: {
      id: 'conquest',
      name: 'Conquest',
      color: '#B22222',
      borderColor: '#7B0F0F',
      symbol: '👑',
      hp: 1200,
      atk: 32,
      speed: 140,
      radius: 42,
      score: 1000,
      type: 'boss',
      attackInterval: 850,
      attackRange: 58,
      isBoss: true,
      knockbackResistance: 0.85,
      // Enters invulnerable rage at 50 % HP
      rageThreshold: 0.5,
      rageSpeedMult: 1.6,
      rageAtkMult: 1.5
    },

    angstromLevy: {
      id: 'angstromLevy',
      name: 'Angstrom Levy',
      color: '#228B22',
      borderColor: '#145214',
      symbol: '🌀',
      hp: 850,
      atk: 18,
      speed: 95,
      radius: 38,
      score: 800,
      type: 'boss',
      attackInterval: 1050,
      attackRange: 310,
      isBoss: true,
      knockbackResistance: 0.75,
      canTeleport: true,
      teleportInterval: 4500,
      projectileColor: '#7CFC00',
      projectileSpeed: 290
    },

    invincibleClone: {
      id: 'invincibleClone',
      name: 'Evil Invincible',
      color: '#FF4500',
      borderColor: '#CC2200',
      symbol: '🔴',
      hp: 250,
      atk: 26,
      speed: 225,
      radius: 18,
      score: 120,
      type: 'melee',
      attackInterval: 580,
      attackRange: 28,
      knockbackResistance: 0.3
    },

    thragg: {
      id: 'thragg',
      name: 'Grand Regent Thragg',
      color: '#DAA520',
      borderColor: '#8B6914',
      symbol: '👁',
      hp: 3000,
      atk: 48,
      speed: 165,
      radius: 52,
      score: 3000,
      type: 'boss',
      attackInterval: 650,
      attackRange: 70,
      isBoss: true,
      isFinalBoss: true,
      knockbackResistance: 0.95,
      canSummon: true,
      summonInterval: 8000,
      summonType: 'viltramite',
      summonCount: 2
    }
  }
};
