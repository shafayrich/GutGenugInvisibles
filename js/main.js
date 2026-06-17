'use strict';

// ---------------------------------------------------------------------------
// GutGenug Invincibles — Entry Point
// ---------------------------------------------------------------------------

(function () {
  const canvas = document.getElementById('gameCanvas');
  canvas.width  = CONFIG.CANVAS.WIDTH;
  canvas.height = CONFIG.CANVAS.HEIGHT;

  // Scale canvas to fit viewport while maintaining aspect ratio
  function resize() {
    const ratio = CONFIG.CANVAS.WIDTH / CONFIG.CANVAS.HEIGHT;
    const maxW  = Math.min(window.innerWidth  - 20, CONFIG.CANVAS.WIDTH);
    const maxH  = Math.min(window.innerHeight - 20, CONFIG.CANVAS.HEIGHT);
    let w = maxW, h = maxW / ratio;
    if (h > maxH) { h = maxH; w = maxH * ratio; }
    canvas.style.width  = `${Math.floor(w)}px`;
    canvas.style.height = `${Math.floor(h)}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  const game = new Game(canvas);
  game.start();
})();
