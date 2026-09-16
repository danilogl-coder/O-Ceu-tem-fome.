/* Campo de ruínas — the game's original test backdrop, kept as a scene so the
   master can switch to it (and so the old look is never lost). Flat scene: no
   perspective room, no side walls, endless in both directions. */
(function (root) {
  'use strict';
  const {SceneLibrary} = root;
  function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function drawBack(ctx, camera) {
    rect(ctx, 0, 0, 480, 270, '#202b28');
    rect(ctx, 0, 0, 480, 136, '#2a3530');
    rect(ctx, 0, 136, 480, 66, '#26312c');
    for (let i = -2; i < 11; i++) {
      const x = i * 70 - ((camera * .15) % 70);
      rect(ctx, x, 64 + (i % 3) * 9, 26, 145, '#25302b');
      rect(ctx, x + 5, 55 + (i % 3) * 9, 16, 24, '#25302b');
      rect(ctx, x + 10, 99, 5, 53, '#2c3931');
    }
    for (let i = -1; i < 9; i++) {
      const x = i * 91 - ((camera * .35) % 91);
      rect(ctx, x, 183, 72, 35, '#303c30'); rect(ctx, x + 4, 178, 64, 5, '#394635');
      rect(ctx, x + 23, 184, 1, 15, '#253127'); rect(ctx, x + 49, 200, 1, 15, '#253127');
      rect(ctx, x + 1, 199, 69, 1, '#253127');
    }
    rect(ctx, 0, 218, 480, 11, '#38412f'); rect(ctx, 0, 228, 480, 3, '#a1a270');
    rect(ctx, 0, 231, 480, 5, '#626b49'); rect(ctx, 0, 236, 480, 34, '#313827');
    for (let i = -1; i < 25; i++) {
      const x = i * 25 - (camera % 25); rect(ctx, x, 242, 13, 2, '#3d4530'); rect(ctx, x + 10, 258, 9, 2, '#434b32');
    }
  }
  SceneLibrary.register({
    id: 'campo',
    name: 'Campo de ruínas',
    subtitle: 'Cena de teste original',
    tags: ['exterior', 'teste'],
    kind: 'flat',
    drawBack,
    spawns: [{id: 'centro', label: 'Centro', x: 240, facing: 1}],
    presets: [{id: 'padrao', label: 'Crepúsculo', variant: 'day', ambient: 0}]
  });
})(typeof window !== 'undefined' ? window : globalThis);
