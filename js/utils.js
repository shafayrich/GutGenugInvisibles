'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Math / Collision Utilities
// ---------------------------------------------------------------------------

const Utils = {
  /** Clamp a value between min and max. */
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  /** Linear interpolation. */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Euclidean distance between two points. */
  dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** Distance squared (cheaper comparison). */
  dist2(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  },

  /** Normalise a vector, returns {x, y}. Returns {0,0} for zero-length. */
  normalise(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  },

  /** Random float in [min, max). */
  rand(min, max) {
    return min + Math.random() * (max - min);
  },

  /** Random integer in [min, max] inclusive. */
  randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  },

  /** Pick a random element from an array. */
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /** Angle in radians from (x1,y1) to (x2,y2). */
  angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  /** Draw a rounded rectangle path. */
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  /**
   * Constrain a circle (cx, cy, r) to stay within a rectangle.
   * Returns clamped {x, y}.
   */
  constrainToRect(cx, cy, r, rx, ry, rw, rh) {
    return {
      x: Utils.clamp(cx, rx + r, rx + rw - r),
      y: Utils.clamp(cy, ry + r, ry + rh - r)
    };
  },

  /** Return spawn points around the edges of the arena. */
  arenaEdgePoints(arena, count) {
    const pts = [];
    const perimeter = 2 * (arena.W + arena.H);
    const step = perimeter / count;
    for (let i = 0; i < count; i++) {
      const d = i * step;
      let x, y;
      if (d < arena.W) {
        x = arena.X + d;
        y = arena.Y;
      } else if (d < arena.W + arena.H) {
        x = arena.X + arena.W;
        y = arena.Y + (d - arena.W);
      } else if (d < 2 * arena.W + arena.H) {
        x = arena.X + arena.W - (d - arena.W - arena.H);
        y = arena.Y + arena.H;
      } else {
        x = arena.X;
        y = arena.Y + arena.H - (d - 2 * arena.W - arena.H);
      }
      pts.push({ x, y });
    }
    return pts;
  }
};
