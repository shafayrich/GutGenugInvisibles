'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Wave Definitions & Wave Manager
//
// Wave structure per entry in WAVE_DEFS:
//   wave         : 1-50
//   title        : optional announcement text (shown as boss intro / milestone)
//   subtitle     : optional second line
//   isBossWave   : bool
//   enemies      : Array<{ type: string, count: number }>
//   scaleFactor  : HP/ATK multiplier for enemies this wave (defaults to 1)
// ---------------------------------------------------------------------------

function _buildWaveDefs() {
  const defs = [];

  for (let w = 1; w <= 50; w++) {
    const scale = 1 + (w - 1) * 0.06; // enemy stats ramp 6 % per wave

    // ── Waves 1–9: Reanimen only ─────────────────────────────────────────
    if (w <= 9) {
      defs.push({
        wave: w,
        title: w === 1 ? '🧟 The Reanimen Rise…' : null,
        subtitle: w === 1 ? 'Survive the undead hordes!' : null,
        isBossWave: false,
        scaleFactor: scale,
        enemies: [
          { type: 'reaniman', count: 4 + w }
        ]
      });
      continue;
    }

    // ── Wave 10: Flaxan Invasion announcement ────────────────────────────
    if (w === 10) {
      defs.push({
        wave: 10,
        title: '⚠️  FLAXAN INVASION BEGINS!',
        subtitle: 'Aliens from another dimension have arrived.',
        isBossWave: false,
        scaleFactor: scale,
        enemies: [
          { type: 'reaniman', count: 8 },
          { type: 'flaxan',   count: 4 }
        ]
      });
      continue;
    }

    // ── Waves 11–19: Reanimen + Flaxans ─────────────────────────────────
    if (w <= 19) {
      const flaxCount = Math.floor((w - 10) * 1.5) + 5;
      defs.push({
        wave: w,
        title: null,
        isBossWave: false,
        scaleFactor: scale,
        enemies: [
          { type: 'reaniman', count: 6 + w },
          { type: 'flaxan',   count: flaxCount }
        ]
      });
      continue;
    }

    // ── Wave 20: MAULER TWINS BOSS FIGHT ────────────────────────────────
    if (w === 20) {
      defs.push({
        wave: 20,
        title: '⚡  MAULER TWINS',
        subtitle: 'Clone scientists with lethal technology!',
        isBossWave: true,
        scaleFactor: scale,
        enemies: [
          { type: 'maulerTwin', count: 2 },
          { type: 'reaniman',   count: 8 }
        ]
      });
      continue;
    }

    // ── Waves 21–29: Reanimen + Flaxans + occasional Mauler Twins ───────
    if (w <= 29) {
      const hasMaulers = Math.random() < 0.35; // 35 % chance per wave
      const ens = [
        { type: 'reaniman', count: 10 + w },
        { type: 'flaxan',   count: 8 + Math.floor((w - 20) * 1.2) }
      ];
      if (hasMaulers) ens.push({ type: 'maulerTwin', count: 1 });
      defs.push({
        wave: w,
        title: hasMaulers ? '⚡ A Mauler Twin is back!' : null,
        isBossWave: false,
        scaleFactor: scale,
        enemies: ens
      });
      continue;
    }

    // ── Wave 30: CONQUEST BOSS FIGHT ────────────────────────────────────
    if (w === 30) {
      defs.push({
        wave: 30,
        title: '👑  CONQUEST',
        subtitle: 'Viltrumite conqueror — enters enraged state at 50 % HP!',
        isBossWave: true,
        scaleFactor: scale,
        enemies: [
          { type: 'conquest', count: 1 },
          { type: 'flaxan',   count: 10 }
        ]
      });
      continue;
    }

    // ── Waves 31–39: All previous + 1-3 Viltramites ─────────────────────
    if (w <= 39) {
      const vCount = Utils.randInt(1, 3);
      defs.push({
        wave: w,
        title: w === 31 ? '⚔️  Viltramites Join the Invasion!' : null,
        subtitle: w === 31 ? 'Members of the Viltrumite Empire are here.' : null,
        isBossWave: false,
        scaleFactor: scale,
        enemies: [
          { type: 'reaniman',  count: 12 + w },
          { type: 'flaxan',    count: 10 + Math.floor((w - 30) * 1.5) },
          { type: 'viltramite', count: vCount }
        ]
      });
      continue;
    }

    // ── Wave 40: ANGSTROM LEVY BOSS ──────────────────────────────────────
    if (w === 40) {
      defs.push({
        wave: 40,
        title: '🌀  ANGSTROM LEVY',
        subtitle: 'Interdimensional villain + corrupted Invincible clones!',
        isBossWave: true,
        scaleFactor: scale,
        enemies: [
          { type: 'angstromLevy',    count: 1 },
          { type: 'invincibleClone', count: Utils.randInt(1, 2) }
        ]
      });
      continue;
    }

    // ── Waves 41–49: Everything (no Mauler Twins) + a few Invincibles ────
    if (w <= 49) {
      const invCount = Utils.randInt(1, 3);
      defs.push({
        wave: w,
        title: null,
        isBossWave: false,
        scaleFactor: scale,
        enemies: [
          { type: 'reaniman',        count: 14 + w },
          { type: 'flaxan',          count: 12 + Math.floor((w - 40) * 1.8) },
          { type: 'viltramite',      count: Utils.randInt(2, 5) },
          { type: 'invincibleClone', count: invCount }
        ]
      });
      continue;
    }

    // ── Wave 50: THE FINAL GAUNTLET ──────────────────────────────────────
    // Bosses appear sequentially — Wave 50 is split into phases handled by WaveManager
    if (w === 50) {
      defs.push({
        wave: 50,
        title: '💀  THE FINAL GAUNTLET',
        subtitle: 'All bosses — then Grand Regent Thragg!',
        isBossWave: true,
        isFinalWave: true,
        scaleFactor: scale,
        // Phase list: clear each phase before next spawns
        phases: [
          { label: 'Phase 1 — Conquest Returns',        enemies: [{ type: 'conquest', count: 1 }, { type: 'viltramite', count: 4 }] },
          { label: 'Phase 2 — Angstrom Levy Returns',   enemies: [{ type: 'angstromLevy', count: 1 }, { type: 'invincibleClone', count: 2 }] },
          { label: 'Phase 3 — Mauler Twins Return',     enemies: [{ type: 'maulerTwin', count: 2 }, { type: 'flaxan', count: 8 }] },
          { label: 'FINAL PHASE — GRAND REGENT THRAGG', enemies: [{ type: 'thragg', count: 1 }] }
        ],
        enemies: [] // Populated dynamically from phases
      });
    }
  }

  return defs;
}

// ---------------------------------------------------------------------------
// WAVE MANAGER
// ---------------------------------------------------------------------------
class WaveManager {
  constructor() {
    this._defs = _buildWaveDefs();
    this.currentWave   = 0;
    this.phase         = 0;   // for wave 50 phases
    this._currentDef   = null;
    this.complete      = false; // all 50 waves done
  }

  /** Get the definition for a given wave number (1-50). */
  getDef(waveNum) {
    return this._defs.find(d => d.wave === waveNum) || null;
  }

  /** Build the enemy spawn list for the current wave/phase. */
  buildSpawnList(waveNum, phaseIndex = 0) {
    const def = this.getDef(waveNum);
    if (!def) return [];

    if (def.isFinalWave) {
      const phase = def.phases[phaseIndex];
      if (!phase) return [];
      return phase.enemies.map(e => ({ ...e }));
    }

    return def.enemies.map(e => ({ ...e }));
  }

  /** Advance to the next wave / phase. Returns updated wave number. */
  advance(currentWave, currentPhase, isFinal) {
    if (isFinal) {
      // Wave 50 — move to next phase
      const def = this.getDef(50);
      if (currentPhase + 1 < def.phases.length) {
        return { wave: 50, phase: currentPhase + 1, done: false };
      }
      return { wave: 50, phase: currentPhase, done: true };
    }
    if (currentWave >= 50) {
      return { wave: 50, phase: 0, done: true };
    }
    return { wave: currentWave + 1, phase: 0, done: false };
  }

  /** How many total enemies spawn in a wave (for progress tracking). */
  totalEnemyCount(waveNum, phaseIndex = 0) {
    return this.buildSpawnList(waveNum, phaseIndex)
               .reduce((s, e) => s + e.count, 0);
  }

  /** Phase label for wave 50. */
  phaseLabel(waveNum, phaseIndex) {
    if (waveNum !== 50) return null;
    const def = this.getDef(50);
    return def && def.phases[phaseIndex] ? def.phases[phaseIndex].label : null;
  }

  /** Scale factor for a wave. */
  scaleFactor(waveNum) {
    const def = this.getDef(waveNum);
    return def ? (def.scaleFactor || 1) : 1;
  }
}
