/* Câmeras do Jorge — o monitor de segurança, no espírito de Five Nights at
   Freddy's: imagem esverdeada com chiado, varredura lenta, relógio, REC
   piscando e o mapa do prédio com os botões das câmeras.

   CAM 01 corredor · CAM 02 porta da frente · CAM 03 depósito ·
   CAM 04 sala das caixas de livros · CAM 05 exterior do prédio ·
   CAM 06 impressora/copiadora.

   A CAM 04 muda conforme a investigação avança (objetos cam_caixa,
   cam_livro, cam_aberto, ligados por caso-jorge.js ou pelo mestre).
   Depois que alguém lê a folha da impressora, aparece uma CAM 07 que Jorge
   nunca instalou: o próprio escritório, ao vivo. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, Caso = root.JorgeCaso;
  const {SW, SH} = U, {C, art} = Caso;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RW = 280, RH = 124, VIEW = 240, FY = 22;

  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sm = t => t * t * (3 - 2 * t);
    const a = K.hash2(xi, yi, seed), b = K.hash2(xi + 1, yi, seed), c = K.hash2(xi, yi + 1, seed), d = K.hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /* One-point perspective box: floor, ceiling, two walls and the far wall.
     Each painter gets world-ish coordinates: u across (−1..1), z depth,
     h height on the walls (1 = ceiling, negative = toward the floor). */
  function tunnel(b, {vpx = RW / 2, vpy, floorH, ceilH, wallW, far, floor, ceil, wall, end}) {
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const dx = x + .5 - vpx;
      const zf = y + .5 > vpy ? floorH / (y + .5 - vpy) : Infinity;
      const zc = y + .5 < vpy ? ceilH / (vpy - y - .5) : Infinity;
      const zw = Math.abs(dx) > .01 ? wallW / Math.abs(dx) : Infinity;
      const z = Math.min(zf, zc, zw);
      if (z > far) { end(x, y, dx * far / wallW, (vpy - y - .5) * far / ceilH); continue; }
      if (z === zf) floor(x, y, dx * z / wallW, z);
      else if (z === zc) ceil(x, y, dx * z / wallW, z);
      else wall(x, y, dx < 0 ? -1 : 1, z, (vpy - y - .5) * z / ceilH);
    }
  }
  const fog = (level, z, k = 2.6) => Math.max(0, Math.round(level - z / k));

  /* ------------------------------------------------------------ rooms */
  const ROOMS = {
    1: {nome: 'CORREDOR', paint(b) {
      tunnel(b, {vpy: 50, floorH: 74, ceilH: 58, wallW: 104, far: 9,
        floor: (x, y, u, z) => {
          const check = (Math.floor(u * 2.4 + 10) + Math.floor(z * 1.9)) & 1;
          let lv = check ? 5 : 1;
          const pool = Math.max(0, 1 - Math.hypot(u * .8, (z - 4.2) * .7));
          lv = Math.round(lv * (.45 + pool * .6)) - Math.floor(z / 4);
          b.px(x, y, 'xadrez', clamp(lv, 0, 6));
        },
        ceil: (x, y, u, z) => {
          const panel = [2, 4.2, 6.4].some(c => Math.abs(z - c) < .22) && Math.abs(u) < .22;
          b.px(x, y, panel ? 'branco' : 'concreto', panel ? (Math.abs(z - 4.2) < .3 ? 2 : 5) : fog(2, z, 3));
        },
        wall: (x, y, side, z, h) => {
          let ramp = 'petroleo', lv = 3;
          if (h < -.55) { ramp = 'nogueira'; lv = 2; if (h > -.62) lv = 4; }
          else if ((z * 6) % 1 < .12) lv = 2;
          const door = side < 0 ? (z > 1.7 && z < 2.3) || (z > 5 && z < 5.4) : (z > 3.1 && z < 3.7);
          if (door && h < .35) { ramp = 'nogueira'; lv = (z * 20) % 1 < .15 ? 1 : 3; if (h > .28) lv = 4; }
          if (side > 0 && z > 1.9 && z < 2.5 && h > -.2 && h < .5 && !door) { ramp = 'vermelho'; lv = h > .3 ? 4 : 2; }
          if (side < 0 && z > 3.2 && z < 3.34 && h > -1 && h < -.6) { ramp = 'vermelho'; lv = 3; }
          const pool = Math.max(0, 1 - Math.abs(z - 4.2) * .5);
          b.px(x, y, ramp, fog(lv + pool * 1.5, z, 2.4));
        },
        end: (x, y, u, h) => {
          const door = Math.abs(u) < .32 && h < .3;
          b.px(x, y, door ? 'nogueira' : 'petroleo', door ? (Math.abs(u) < .22 && h > -.1 && h < .22 ? 4 : 1) : 1);
        }});
      b.text(RW / 2 + 26, 36, '12', 'branco', 3, {font: '3x5'});
    }},
    2: {nome: 'PORTA DA FRENTE', paint(b, level, rain, words = {}) {
      const random = K.rng(22);
      b.rect(0, 0, RW, 104, 'papelVelho', 2);
      for (let x = 0; x < RW; x++) for (let y = 0; y < 104; y++) if ((x % 16) === 0) b.px(x, y, 'papelVelho', 1);
      b.rect(0, 96, RW, 8, 'nogueira', 2); b.hline(0, RW - 1, 96, 'nogueira', 4);
      // Floor tiles, the light from the glass reaching into the hall.
      for (let y = 104; y < RH; y++) for (let x = 0; x < RW; x++) {
        const t = (y - 104) / 20, check = (Math.floor((x - 140) / (14 + t * 10) + 20) + Math.floor(y / 5)) & 1;
        let lv = check ? 3 : 2;
        if (Math.abs(x - 140 - (y - 104) * .6) < 18 + t * 12) lv += 2;
        b.px(x, y, 'xadrez', lv);
      }
      // The door.
      b.rect(106, 16, 68, 82, 'nogueira', 1); b.rect(110, 20, 60, 78, 'nogueira', 3);
      b.vline(110, 20, 97, 'nogueira', 2); b.vline(169, 20, 97, 'nogueira', 4);
      for (let y = 26; y < 58; y++) for (let x = 118; x < 162; x++) {
        const n = valueNoise(x / 3, y / 3, 4);
        b.px(x, y, 'branco', clamp(Math.round(3.2 + n * 2 - Math.hypot((x - 140) / 30, (y - 40) / 22) * 1.4), 1, 5));
      }
      b.frame(117, 25, 46, 34, 'nogueira', 2);
      b.inset(118, 64, 44, 28, 'nogueira', 3, 4, 1);
      b.rect(134, 70, 12, 3, 'metal', 4); b.hline(134, 145, 70, 'metal', 5);
      b.ellipse(162, 62, 2, 2, 'ouro', 4); b.px(161, 61, 'ouro', 5);
      b.line(158, 46, 164, 60, 'metal', 4);
      // Doormat and the mail pushed through the slot.
      b.rect(116, 104, 48, 8, 'kraft', 2); b.frame(116, 104, 48, 8, 'kraft', 1);
      b.text(140, 106, Caso.tiny(words.tapete ?? 'BEM VINDO'), 'kraft', 4, {font: '3x5', align: 'center'});
      for (const [x, y, w] of [[128, 99, 8], [140, 101, 7], [150, 98, 9]]) { b.rect(x, y, w, 4, 'papel', 4); b.hline(x, x + w - 1, y, 'papel', 5); }
      // Coat hooks and a small table.
      b.hline(196, 236, 38, 'nogueira', 3);
      for (const x of [202, 216, 230]) b.px(x, 39, 'metal', 5);
      b.poly([[199, 40], [210, 40], [213, 82], [196, 82]], 'couro', 3); b.vline(205, 42, 80, 'couro', 2);
      b.rect(36, 70, 40, 3, 'nogueira', 4); b.vline(40, 73, 96, 'nogueira', 2); b.vline(72, 73, 96, 'nogueira', 3);
      b.rect(46, 60, 10, 10, 'ceu', 2); b.rect(49, 56, 4, 4, 'papel', 4);
      b.speckle(0, 0, RW, 96, 'papelVelho', 3, .02, random);
    }},
    3: {nome: 'DEPÓSITO', paint(b) {
      tunnel(b, {vpy: 46, floorH: 78, ceilH: 52, wallW: 96, far: 3.2,
        floor: (x, y, u, z) => {
          let lv = 3 + (valueNoise(u * 6, z * 3, 7) > .7 ? -1 : 0);
          lv += Math.max(0, 1.6 - Math.hypot(u * 1.4, (z - 1.8) * 1.2) * 1.8);
          if (Math.hypot(u * 3, (z - 2.4) * 4) < .3) lv = 1;
          b.px(x, y, 'concreto', fog(lv, z, 3));
        },
        ceil: (x, y, u, z) => b.px(x, y, 'concreto', fog(1.5, z, 2)),
        wall: (x, y, side, z, h) => {
          let ramp = 'concreto', lv = 2;
          const shelf = [-1.05, -.55, -.05, .45].some(s => Math.abs(h - s) < .05);
          if (shelf) { ramp = 'metal'; lv = 4; }
          else if (h > -1.35 && h < .6) {
            const slot = Math.floor(z * 5 + (side > 0 ? 2 : 0)), row = Math.floor((h + 1.35) / .5);
            const kind = K.hash2(slot, row, side > 0 ? 3 : 4);
            const fill = ((h + 1.35) % .5) / .5;
            if (kind < .55 && fill > .18 && fill < .85 && (z * 5) % 1 > .15) {
              ramp = kind < .2 ? 'kraft' : kind < .35 ? 'vermelho' : kind < .45 ? 'azul' : 'amarelo';
              lv = 2 + (fill > .6 ? 1 : 0);
            }
          }
          if ((z * 5) % 1 < .06 && h < .6 && h > -1.35) { ramp = 'metal'; lv = 3; }
          b.px(x, y, ramp, fog(lv + Math.max(0, 1 - Math.abs(z - 1.8)), z, 2.5));
        },
        end: (x, y, u, h) => b.px(x, y, 'concreto', Math.abs(u) < .5 && h < -.2 && h > -1.4 ? 1 : 2)});
      // Hanging bulb, mop bucket and a ladder.
      b.vline(140, 0, 16, 'carvao', 2); b.ellipse(140, 19, 3, 3, 'lampada', 5);
      b.rect(196, 96, 22, 18, 'amarelo', 3); b.hline(196, 217, 96, 'amarelo', 5); b.rect(198, 98, 18, 3, 'concreto', 1);
      b.line(206, 60, 212, 98, 'nogueira', 3); b.line(207, 60, 213, 98, 'nogueira', 4);
      b.line(64, 30, 50, 110, 'metal', 3); b.line(76, 30, 70, 110, 'metal', 3);
      for (let i = 0; i < 7; i++) b.line(63 - i * 1.8, 38 + i * 11, 75 - i * .8, 38 + i * 11, 'metal', 4);
    }},
    4: {nome: 'SALA DAS CAIXAS', paint(b, level = 0) {
      // A high corner view: block wall at the back, concrete floor.
      for (let y = 0; y < 44; y++) for (let x = 0; x < RW; x++) {
        const row = Math.floor(y / 6), off = row % 2 ? 9 : 0, mortar = y % 6 === 5 || (x + off) % 18 === 0;
        b.px(x, y, 'concreto', mortar ? 1 : 2 + (K.hash2(Math.floor((x + off) / 18), row, 3) > .7 ? 1 : 0));
      }
      b.rect(180, 6, 50, 12, 'ceu', 1); b.frame(180, 6, 50, 12, 'metal', 3); for (let x = 190; x < 230; x += 10) b.vline(x, 6, 17, 'metal', 3);
      for (let y = 44; y < RH; y++) for (let x = 0; x < RW; x++) {
        const n = valueNoise(x / 14, y / 5, 9);
        let lv = 3 + (n > .66 ? -1 : n < .25 ? 1 : 0);
        if ((x - (y - 44) * .9) % 46 < 1) lv = 2;
        b.px(x, y, 'concreto', lv);
      }
      b.shade(0, 44, RW, 3, -1);
      const box = (x, y, w, h, d, {open = false, label = true} = {}) => {
        b.poly([[x, y], [x + w, y], [x + w + d, y - d * .6], [x + d, y - d * .6]], 'kraft', 4);       // top
        b.rect(x, y, w, h, 'kraft', 3);                                                              // front
        b.poly([[x + w, y], [x + w + d, y - d * .6], [x + w + d, y + h - d * .6], [x + w, y + h]], 'kraft', 2);
        b.hline(x, x + w, y, 'kraft', 5); b.vline(x, y, y + h - 1, 'kraft', 1);
        b.line(x + w / 2, y, x + w / 2 + d, y - d * .6, 'kraft', 5);
        if (label) { b.rect(x + 4, y + 5, w - 8, 6, 'papel', 4); b.hline(x + 6, x + w - 7, y + 7, 'carvao', 3); b.text(x + w - 3, y + h - 7, '50', 'carvao', 2, {font: '3x5', align: 'right'}); }
        if (open) {
          b.poly([[x, y], [x - 4, y - 12], [x + w / 2 - 2, y - 14], [x + w / 2, y]], 'kraft', 5);
          b.poly([[x + w, y], [x + w + 6, y - 13], [x + w / 2 + 4, y - 15], [x + w / 2, y]], 'kraft', 3);
          for (let i = 0; i < 5; i++) { b.rect(x + 3 + i * 6, y - 5, 5, 5, 'carvao', 2); b.hline(x + 3 + i * 6, x + 7 + i * 6, y - 5, 'vermelho', 3); }
        }
      };
      box(20, 62, 40, 22, 12); box(20, 84, 40, 22, 12); box(24, 40, 40, 22, 12);
      box(96, 70, 40, 22, 12); box(96, 92, 40, 22, 12, {open: false});
      box(100, 48, 40, 22, 12, {open: level >= 1});
      box(172, 76, 40, 22, 12); box(214, 76, 40, 22, 12); box(190, 98, 40, 22, 12);
      // Hand truck.
      b.line(250, 50, 262, 112, 'metal', 4); b.line(254, 50, 266, 112, 'metal', 3); b.rect(252, 110, 20, 3, 'metal', 4); b.ellipse(266, 116, 4, 4, 'carvao', 2);
      if (level >= 2) {
        const bx = 150, by = 110;
        if (level >= 3) {
          b.shade(bx - 15, by + 2, 30, 4, -1);
          b.poly([[bx - 15, by], [bx, by + 5], [bx, by - 4], [bx - 14, by - 9]], 'papel', 5);
          b.poly([[bx, by + 5], [bx + 15, by], [bx + 14, by - 9], [bx, by - 4]], 'papel', 4);
          for (let i = 0; i < 4; i++) { b.line(bx - 12, by - 6 + i * 3, bx - 3, by - 3 + i * 3, 'carvao', 3); b.line(bx + 3, by - 3 + i * 3, bx + 12, by - 6 + i * 3, 'carvao', 3); }
          b.vline(bx, by - 4, by + 5, 'carvao', 1);
        } else { b.shade(bx - 12, by + 2, 26, 3, -1); b.poly([[bx - 13, by - 3], [bx + 9, by - 7], [bx + 13, by + 1], [bx - 9, by + 5]], 'carvao', 2); b.line(bx - 13, by - 3, bx + 9, by - 7, 'vermelho', 3); b.line(bx + 9, by - 7, bx + 13, by + 1, 'papel', 4); }
      }
    }},
    5: {nome: 'EXTERIOR DO PRÉDIO', paint(b, level, rain) {
      b.vgrad(0, 0, RW, 30, 'ceu', 0, 1.6);
      // Building facade on the left, Jorge's window lit behind the blinds.
      b.rect(0, 0, 150, 84, 'tijolo', 2);
      for (let y = 0; y < 84; y++) for (let x = 0; x < 150; x++) if (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0) b.px(x, y, 'tijolo', 1);
      for (const [wx, wy, lit] of [[16, 14, false], [58, 14, false], [100, 14, true], [16, 46, false], [100, 46, false]]) {
        b.rect(wx, wy, 30, 20, lit ? 'lampada' : 'ceu', lit ? 3 : 1); b.frame(wx - 1, wy - 1, 32, 22, 'concreto', 3);
        if (lit) for (let y = wy + 1; y < wy + 20; y += 3) b.hline(wx, wx + 29, y, 'lampada', 1);
      }
      b.rect(56, 50, 34, 34, 'nogueira', 1); b.rect(52, 46, 42, 5, 'vermelho', 2); b.rect(60, 56, 26, 28, 'nogueira', 2); b.px(82, 70, 'ouro', 4);
      // Sidewalk, street with lane marks in perspective, the lamp and a car.
      b.rect(0, 84, RW, 10, 'concreto', 3); b.hline(0, RW - 1, 84, 'concreto', 4); b.hline(0, RW - 1, 93, 'concreto', 1);
      for (let y = 94; y < RH; y++) for (let x = 0; x < RW; x++) {
        let lv = 1 + (valueNoise(x / 9, y / 3, 3) > .62 ? 1 : 0);
        const cone = Math.max(0, 1 - Math.hypot((x - 214) / 50, (y - 104) / 16));
        lv += Math.round(cone * 3);
        if (Math.abs(y - 110) < 1 && (x % 30) < 16) lv = 4;
        b.px(x, y, 'concreto', lv);
      }
      for (let y = 30; y < 94; y++) for (let x = 150; x < RW; x++) { const cone = Math.max(0, 1 - Math.hypot((x - 214) / (6 + (y - 30) * .7), 1)) * (y > 34 ? 1 : 0); if (K.bayer(x, y) < cone * .35) b.px(x, y, 'lampada', 1); }
      b.vline(236, 22, 93, 'metal', 2); b.hline(214, 236, 22, 'metal', 2); b.rect(208, 22, 10, 4, 'metal', 3); b.hline(209, 216, 26, 'lampada', 5);
      b.rect(150, 58, 130, 26, 'folha', 0);
      for (let x = 150; x < RW; x++) { const top = 52 + Math.round(valueNoise(x / 7, 1, 8) * 12); b.vline(x, top, 83, 'folha', 1); }
      b.poly([[30, 104], [44, 96], [84, 96], [100, 104], [104, 114], [26, 114]], 'azul', 2);
      b.poly([[46, 97], [82, 97], [94, 104], [36, 104]], 'ceu', 1); b.ellipse(40, 115, 5, 4, 'carvao', 1); b.ellipse(92, 115, 5, 4, 'carvao', 1);
      b.hline(28, 102, 106, 'azul', 3);
    }},
    6: {nome: 'COPIADORA', paint(b) {
      b.rect(0, 0, RW, 70, 'papelVelho', 2);
      for (let x = 0; x < RW; x += 20) b.vline(x, 0, 69, 'papelVelho', 1);
      for (let y = 70; y < RH; y++) for (let x = 0; x < RW; x++) b.px(x, y, 'xadrez', ((Math.floor(x / 12) + Math.floor(y / 6)) & 1) ? 3 : 2);
      b.rect(0, 66, RW, 4, 'nogueira', 3);
      // Bulletin board and clock.
      b.bevel(24, 12, 50, 30, 'cortica', 3, 4, 1);
      for (const [x, y] of [[28, 16], [42, 18], [56, 15], [32, 28], [50, 30]]) { b.rect(x, y, 10, 8, 'papel', 4); b.hline(x + 1, x + 7, y + 3, 'carvao', 3); }
      b.ellipse(220, 20, 9, 9, 'papel', 4); b.ellipse(220, 20, 8, 8, 'papel', 5); b.line(220, 20, 220, 14, 'carvao', 1); b.line(220, 20, 224, 22, 'carvao', 1);
      // The copier.
      b.rect(110, 34, 70, 60, 'plastico', 3); b.hline(110, 179, 34, 'plastico', 5); b.vline(179, 34, 93, 'plastico', 2); b.vline(110, 34, 93, 'plastico', 4);
      b.rect(106, 26, 78, 9, 'plastico', 4); b.hline(106, 183, 26, 'plastico', 5);
      b.rect(114, 38, 30, 10, 'carvao', 2); b.rect(116, 40, 14, 6, 'cctv', 1);
      for (let i = 0; i < 3; i++) { b.rect(114, 54 + i * 12, 62, 9, 'plastico', 2); b.hline(114, 175, 54 + i * 12, 'plastico', 4); b.rect(138, 57 + i * 12, 14, 2, 'plastico', 1); }
      b.rect(184, 50, 16, 4, 'papel', 5); b.hline(184, 199, 53, 'papel', 3);
      b.rect(112, 94, 66, 14, 'carvao', 1);
      // Paper reams and a guillotine on a table.
      for (let i = 0; i < 5; i++) { b.rect(28, 96 - i * 5, 28, 5, 'papel', 4); b.hline(28, 55, 96 - i * 5, 'papel', 5); b.rect(38, 97 - i * 5, 8, 3, 'azul', 3); }
      b.rect(212, 78, 56, 4, 'nogueira', 4); b.vline(216, 82, 110, 'nogueira', 2); b.vline(264, 82, 110, 'nogueira', 2);
      b.rect(222, 72, 34, 6, 'metal', 3); b.line(224, 72, 256, 58, 'metal', 4); b.ellipse(256, 58, 2, 2, 'vermelho', 3);
    }}
  };
  const roomArt = (n, level, rain, words = {}) => art(`cam:${n}:${n === 4 ? level : 0}:${n === 5 && rain ? 1 : 0}:${n === 2 ? words.tapete : ''}`, RW, RH, b => ROOMS[n].paint(b, level, rain, words), {variant: 'cftv'});
  const DEFAULTS = {
    cam07: 'depois', rotulo: 'VIGIA 6',
    cameras: [1, 2, 3, 4, 5, 6].map(n => ROOMS[n].nome).concat('ESCRITÓRIO').join('\n'),
    mapa: 'MAPA\nVOCÊ\nRUA', tapete: 'BEM VINDO',
    semSinal: 'SEM SINAL', naoCadastrada: 'câmera não cadastrada', desligado: 'MONITOR DESLIGADO',
    adesivo: 'NÃO DESLIGAR\nAS CÂMERAS'
  };
  const field = (d, k) => (typeof d[k] === 'string' ? d[k] : DEFAULTS[k]);
  const row = (d, k, i) => Caso.lines(field(d, k))[i] ?? '';
  // Capitals that fit a width in the 3×5 font.
  const fit = (str, width) => { let s = Caso.tiny(str); while (s.length > 1 && K.measure(s, '3x5') > width) s = s.slice(0, -1); return s; };

  /* ------------------------------------------------------------ overlays */
  let vignette = null, snap = null;
  function vignetteCanvas() {
    if (vignette || !root.document) return vignette;
    vignette = root.document.createElement('canvas'); vignette.width = SW; vignette.height = SH - FY;
    const g = vignette.getContext('2d');
    for (let y = 0; y < SH - FY; y += 2) for (let x = 0; x < SW; x += 2) {
      const nx = x / SW * 2 - 1, ny = y / (SH - FY) * 2 - 1, d = Math.hypot(nx * .92, ny) - .72;
      if (d > 0 && K.bayer(x >> 1, y >> 1) < d * 1.8) { g.fillStyle = '#010503'; g.fillRect(x, y, 2, 2); }
      if (y % 4 === 0) { g.fillStyle = '#00000024'; g.fillRect(x, y, 2, 1); }
    }
    return vignette;
  }
  const MAP = {x: 322, y: 150, w: 150, h: 112};
  const MAP_ROOMS = [
    {id: 3, r: [0, 0, 64, 30], label: 'DEPOSITO'}, {id: 4, r: [64, 0, 86, 30], label: 'CAIXAS'},
    {id: 0, r: [0, 30, 30, 32], label: 'VC'}, {id: 1, r: [30, 30, 84, 32], label: 'CORREDOR'}, {id: 6, r: [114, 30, 36, 32], label: 'COPIAS'},
    {id: 2, r: [46, 62, 44, 22], label: 'PORTA'}
  ];
  const BUTTONS = {1: [66, 50], 2: [60, 70], 3: [22, 12], 4: [100, 12], 5: [104, 92], 6: [124, 46], 7: [4, 46]};

  ClueTypes.register('cameras', {
    label: 'Câmeras de segurança', icon: 'computador', sound: 'estatica',
    veil: 1,
    fields: [
      {id: 'cam07', label: 'CAM 07 (o próprio escritório)', kind: 'select', options: [['depois', 'Depois da folha da impressora'], ['sempre', 'Sempre'], ['nunca', 'Nunca']]},
      {id: 'rotulo', label: 'Nome do sistema no canto', kind: 'text'},
      {id: 'cameras', label: 'Nome de cada câmera (7 linhas: CAM 01 a CAM 07)', kind: 'textarea', rows: 7},
      {id: 'mapa', label: 'Palavras do mapa (3 linhas: título, onde você está, a rua)', kind: 'textarea', rows: 3},
      {id: 'tapete', label: 'Tapete na porta da frente (CAM 02)', kind: 'text'},
      {id: 'naoCadastrada', label: 'Aviso piscando na CAM 07', kind: 'text'},
      {id: 'semSinal', label: 'CAM 07 sem imagem', kind: 'text'},
      {id: 'desligado', label: 'Tela do monitor desligado', kind: 'text'},
      {id: 'adesivo', label: 'Adesivo na mesa, na cena (2 linhas)', kind: 'textarea', rows: 2}],
    defaults: {...DEFAULTS},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      mem.cam ??= 1; mem.vistos ??= {};
      const stage = sys.stage; stage.jorge = stage.jorge || {}; stage.jorge.cam = mem.cam;
      return {mem, t: 0, burst: .45, glitch: 0, watch: 0};
    },
    cam07(clue, sys) {
      const mode = clue.data.cam07 || 'depois';
      return mode === 'sempre' || (mode === 'depois' && !!Caso.mem(sys).cam07);
    },
    select(st, n, sys) {
      if (st.mem.cam === n) return;
      st.mem.cam = n; st.burst = .38; st.watch = 0;
      sys.stage.jorge = sys.stage.jorge || {}; sys.stage.jorge.cam = n;
      Caso.sfx(sys, 'camera');
      sys.emit('change');
    },
    render(ctx, ui, st, clue, sys) {
      const dt = ui.dt, t = (st.t += dt), P = sys.stage.state?.props || new Set();
      const level = P.has('cam_aberto') ? 3 : P.has('cam_livro') ? 2 : P.has('cam_caixa') ? 1 : 0;
      const cam = st.mem.cam === 7 && !this.cam07(clue, sys) ? 1 : st.mem.cam;
      if (sys.stage.scene?.props.some(p => p.id === 'monitor_cameras') && !P.has('monitor_cameras')) {
        // The monitor was switched off in the scene.
        U.rect(ctx, 0, FY, SW, SH - FY, '#020305');
        for (let i = 0; i < 40; i++) U.rect(ctx, 60 + i * 2, 70 + i, 2, 60 - i, '#ffffff08');
        K.drawText(ctx, field(clue.data, 'desligado'), SW / 2, 120, {color: '#6fa987', align: 'center', scale: 2});
        ui.button(ctx, 'ligarMonitor', SW / 2 - 50, 150, 100, 20, 'LIGAR', {style: 'roxo'});
        U.header(ctx, ui, clue.name, 'o monitor está desligado', 'computador');
        return;
      }
      ctx.save(); ctx.beginPath(); ctx.rect(0, FY, SW, SH - FY); ctx.clip();
      U.rect(ctx, 0, FY, SW, SH - FY, '#010403');
      if (cam === 7) this.office(ctx, t, sys, clue);
      else {
        const feed = roomArt(cam, level, sys.stage.state?.weather === 'chuva', {tapete: field(clue.data, 'tapete')});
        const pan = Math.round((Math.sin(t * .22 + cam * 1.7) * .5 + .5) * (RW - VIEW));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(feed, pan, 0, VIEW, RH, 0, FY, VIEW * 2, RH * 2);
        this.live(ctx, cam, t, pan, P, sys, level);
      }
      // A new change in CAM 04 tears the signal the first time it is seen.
      if (cam === 4) {
        st.watch += dt;
        if ((st.mem.vistos[4] || 0) < level) { if (st.watch < .05) { st.glitch = .9; Caso.sfx(sys, 'estatica'); } if (st.watch > 1.5) { st.mem.vistos[4] = level; sys.emit('change'); } }
      }
      const vg = vignetteCanvas(); if (vg) ctx.drawImage(vg, 0, FY);
      // Static: always a little, a burst when switching.
      st.burst = Math.max(0, st.burst - dt); st.glitch = Math.max(0, st.glitch - dt);
      const amount = 260 + st.burst * 5200 + st.glitch * 2400;
      for (let i = 0; i < amount; i++) {
        const x = (Math.random() * SW) & ~1, y = FY + ((Math.random() * (SH - FY)) & ~1), v = Math.random();
        ctx.fillStyle = v < .5 ? '#d8ffe414' : v < .8 ? '#9fe0b026' : '#02100840';
        ctx.fillRect(x, y, 2, 2);
      }
      if (st.burst > .2) { ctx.fillStyle = '#b7f2c7' + Math.round(st.burst * 60).toString(16).padStart(2, '0'); ctx.fillRect(0, FY, SW, SH - FY); }
      const roll = FY + ((t * 38) % (SH - FY + 40)) - 20;
      ctx.fillStyle = '#b7f2c70c'; ctx.fillRect(0, U.snap(roll), SW, 14);
      if (st.glitch > 0 || Math.random() < .015) {
        const gy = FY + Math.floor(Math.random() * (SH - FY - 10)), gh = 4 + Math.floor(Math.random() * 12);
        ctx.drawImage(ctx.canvas, 0, gy, SW, gh, Math.round((Math.random() - .5) * 24), gy, SW, gh);
      }
      ctx.restore();
      this.hud(ctx, ui, st, clue, sys, cam, t);
      U.header(ctx, ui, clue.name, 'clique nas câmeras do mapa · 1 a ' + (this.cam07(clue, sys) ? 7 : 6), 'computador');
    },
    /* Things that move inside the feeds. */
    live(ctx, cam, t, pan, P, sys, level) {
      const px = (x, y, w, h, color) => { const sx = (x - pan) * 2; if (sx + w * 2 < 0 || sx > SW) return; ctx.fillStyle = color; ctx.fillRect(sx, FY + y * 2, w * 2, h * 2); };
      const green = l => C('cctv', l);
      if (cam === 1) {
        // The middle fluorescent can't make up its mind.
        const on = Math.sin(t * 11) + Math.sin(t * 5.3 + 2) > -.6 && (t % 7) < 6.6;
        if (on) { px(RW / 2 - 6, 18, 12, 1, green(5)); ctx.fillStyle = '#b7f2c714'; ctx.fillRect((RW / 2 - 40 - pan) * 2, FY + 40 * 2, 160, 120); }
      }
      if (cam === 3) { const k = .6 + Math.sin(t * 2.1) * .2; ctx.fillStyle = `rgba(183,242,199,${(k * .08).toFixed(3)})`; ctx.fillRect((100 - pan) * 2, FY + 20, 160, 200); }
      if (cam === 5 && sys.stage.state?.weather === 'chuva') for (let i = 0; i < 70; i++) { const x = (i * 37.3 + t * 30) % RW, y = (i * 23.7 + t * 90) % RH; px(x, y, 1, 2, green(3)); }
      if (cam === 5 && Math.sin(t * .9) > .96) px(214, 22, 10, 4, green(6));
      if (cam === 6) {
        const job = sys.stage.jorge?.impressao, printing = job && sys.stage.time - job.inicio < job.duracao;
        if (printing || P.has('pagina')) { px(116, 40, 14, 6, green(printing && Math.floor(t * 6) % 2 ? 6 : 4)); if (printing) px(184, 50, Math.floor(((t * 3) % 1) * 16), 1, green(6)); }
        else if (Math.floor(t) % 3 === 0) px(128, 44, 1, 1, green(5));
      }
    },
    /* CAM 07: the office itself, as the players see it right now. */
    office(ctx, t, sys, clue) {
      const J = sys.jorge;
      if (J) J.wantFrame = true;
      const frame = J?.frame;
      if (!frame) { K.drawText(ctx, field(clue?.data || {}, 'semSinal'), SW / 2, SH / 2, {color: C('cctv', 5), align: 'center', scale: 2}); return; }
      ctx.save(); ctx.imageSmoothingEnabled = false;
      // Framed a little to the left, so the middle of the room is not under the map.
      const zoom = 1.18, w = SW * zoom, h = SH * zoom;
      ctx.drawImage(frame, (SW - w) / 2 - 56 + Math.sin(t * .2) * 8, FY + (SH - FY - h) / 2 + 10, w, h);
      ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#3f8f63'; ctx.fillRect(0, FY, SW, SH - FY);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#9cc7ab'; ctx.fillRect(0, FY, SW, SH - FY);
      ctx.restore();
    },
    hud(ctx, ui, st, clue, sys, cam, t) {
      const d = clue.data, room = row(d, 'cameras', cam - 1);
      K.drawText(ctx, `CAM ${String(cam).padStart(2, '0')}`, 14, FY + 10, {color: '#e6ffee', scale: 2, shadow: {color: '#020a05', dx: 1, dy: 1}});
      K.drawText(ctx, room, 14, FY + 28, {color: '#b7f2c7', shadow: {color: '#020a05', dx: 1, dy: 1}});
      if (Math.floor(t * 1.4) % 2 === 0) { U.rect(ctx, SW - 58, FY + 12, 8, 8, '#e8373a'); }
      K.drawText(ctx, 'REC', SW - 46, FY + 13, {color: '#ffd9d0'});
      const [hh, mm] = String(sys.stage.clock || '00:00').split(':').map(Number);
      const secs = hh * 3600 + mm * 60 + Math.floor(sys.stage.time - (sys.stage.clockSetAt || 0));
      const stamp = [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, secs % 60].map(v => String(v).padStart(2, '0')).join(':');
      K.drawText(ctx, stamp, SW - 14, FY + 28, {color: '#b7f2c7', align: 'right', shadow: {color: '#020a05', dx: 1, dy: 1}});
      K.drawText(ctx, Caso.tiny(field(d, 'rotulo')), 14, SH - 14, {font: '3x5', color: '#6fa987'});
      if (cam === 7) K.drawText(ctx, field(d, 'naoCadastrada'), 14, SH - 26, {color: Math.floor(t * 2) % 2 ? '#ff9c8a' : '#b7f2c7'});
      // The map.
      const M = MAP;
      ctx.fillStyle = '#01080488'; ctx.fillRect(M.x - 6, M.y - 12, M.w + 12, M.h + 16);
      K.drawText(ctx, fit(row(d, 'mapa', 0), M.w), M.x, M.y - 9, {font: '3x5', color: '#6fa987'});
      for (const r of MAP_ROOMS) {
        const [x, y, w, h] = r.r;
        U.outline(ctx, M.x + x, M.y + y, w, h, r.id === cam ? '#e6ffee' : '#5f9f7b', 1);
        if (r.id === 0) {
          K.drawText(ctx, fit(row(d, 'mapa', 1), w - 2), M.x + x + w / 2, M.y + y + 12, {font: '3x5', color: '#b7f2c7', align: 'center'});
          if (Math.floor(t * 2) % 2) U.rect(ctx, M.x + x + w / 2 - 2, M.y + y + 21, 4, 4, '#e6ffee');
        }
      }
      U.rect(ctx, M.x, M.y + 90, M.w, 1, '#5f9f7b'); K.drawText(ctx, fit(row(d, 'mapa', 2), M.w - 8), M.x + 4, M.y + 94, {font: '3x5', color: '#5f9f7b'});
      const list = this.cam07(clue, sys) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
      for (const n of list) {
        const [bx, by] = BUTTONS[n], x = M.x + bx, y = M.y + by, sel = n === cam;
        const hot = ui.region('cam', x - 2, y - 2, 26, 16, {data: n});
        const blink = sel && Math.floor(t * 3) % 2;
        U.rect(ctx, x, y, 22, 12, sel ? (blink ? '#e6ffee' : '#9fe0b0') : hot ? '#2f6f4a' : '#0b2a17');
        U.outline(ctx, x, y, 22, 12, n === 7 ? '#ff9c8a' : sel ? '#e6ffee' : '#7fc49b', 1);
        K.drawText(ctx, String(n).padStart(2, '0'), x + 11, y + 3, {color: sel ? '#04200f' : n === 7 ? '#ffb4a6' : '#d9ffe6', align: 'center'});
      }
    },
    action(id, st, clue, sys, info) {
      if (id === 'cam') this.select(st, info.data, sys);
      if (id === 'ligarMonitor') { sys.setProp('monitor_cameras', true); st.burst = .6; Caso.sfx(sys, 'estatica'); }
    },
    key(e, st, clue, sys) {
      const max = this.cam07(clue, sys) ? 7 : 6;
      const d = /^[1-7]$/.test(e.key) ? Number(e.key) : null;
      if (d && d <= max) { this.select(st, d, sys); return true; }
      if (e.key === 'ArrowRight') { this.select(st, st.mem.cam % max + 1, sys); return true; }
      if (e.key === 'ArrowLeft') { this.select(st, (st.mem.cam + max - 2) % max + 1, sys); return true; }
      return false;
    },
    // Digits and arrows are handled in key(); other letters still reach the master's shortcuts.
    wantsKeys: () => false,
    describe: st => ({cam: st.mem.cam, vistos: {...st.mem.vistos}})
  });

  /* CAM 07 needs the office picture before the interface is drawn over it:
     the clue system draws its markers right after the scene and the
     character, so that is where the frame is copied. */
  if (Caso && !Caso.captureInstalled) {
    Caso.captureInstalled = true;
    const attach = Caso.attach.bind(Caso);
    Caso.attach = sys => {
      attach(sys);
      if (!sys || sys.jorgeCapture) return sys;
      sys.jorgeCapture = true;
      const draw = sys.drawMarkers.bind(sys);
      sys.drawMarkers = (ctx, camera) => {
        const J = sys.jorge;
        if (J?.wantFrame && root.document && ctx?.canvas) {
          J.wantFrame = false;
          if (!J.frame) { J.frame = root.document.createElement('canvas'); J.frame.width = SW; J.frame.height = SH; }
          J.frame.getContext('2d').drawImage(ctx.canvas, 0, 0);
        }
        return draw(ctx, camera);
      };
      return sys;
    };
  }
  root.PistaCameras = {ROOMS, roomArt};
})(typeof window !== 'undefined' ? window : globalThis);
