/* Mesa — the desk seen from the chair. Everything on it can be touched:
   the telephone, the lamp (it really switches the scene's lamp), the
   keyboard (a post-it hides under it), the computer, the document on the
   blotter, three drawers (the right one locked) and a big emergency button
   under a flip cover with a label that says NÃO APERTE. Pressing it sounds
   the alarm and cuts to the rocket cinematic. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, {paperArt, shadow, clamp, ease, seedOf} = root.PistaPapel;
  const {C, SW, SH} = U;
  const OX = 0, OY = 22;                                   // desk art origin on screen
  const sx = x => OX + x * 2, sy = y => OY + y * 2;
  const ITEMS = {
    telefone: [8, 8, 40, 32], canetas: [52, 2, 12, 22], pastas: [4, 46, 42, 26], envelope: [8, 76, 36, 20],
    monitor: [62, 0, 56, 48], gabinete: [56, 46, 68, 14], teclado: [58, 64, 62, 20], postit: [72, 68, 34, 18],
    mouse: [128, 68, 20, 24], caneca: [148, 60, 16, 16], tapete: [44, 88, 100, 18], oficio: [70, 89, 44, 16],
    luminaria: [160, 0, 44, 42], chaves: [140, 44, 20, 10], placa: [136, 94, 30, 12], caixa: [166, 44, 72, 62]
  };
  const LABELS = {telefone: 'Telefone', monitor: 'Computador', teclado: 'Teclado', postit: 'Post-it', oficio: 'Documento', caneca: 'Café',
    chaves: 'Molho de chaves', envelope: 'Envelope lacrado', gaveta0: 'Gaveta da esquerda', gaveta1: 'Gaveta do meio', gaveta2: 'Gaveta da direita',
    tampa: 'Tampa de proteção', botao: 'NÃO APERTE', placa: 'Plaquinha', pastas: 'Pastas', canetas: 'Porta-canetas', mouse: 'Mouse'};

  /* ------------------------------------------------------------ art */
  function deskArt(lampOn, screenOn) {
    return U.art(`mesa:tampo:${lampOn}:${screenOn}`, 240, 124, b => {
      const random = K.rng(12);
      b.rect(0, 0, 240, 106, 'mogno', 3);
      for (let y = 0; y < 106; y++) {
        const plank = Math.floor((y + 3) / 13), seam = (y + 3) % 13 === 0;
        for (let x = 0; x < 240; x++) {
          if (seam) { b.px(x, y, 'mogno', 1); continue; }
          const n = Math.sin(x / (9 + plank * 1.7) + plank * 3.1 + Math.sin(x / 23 + plank) * 1.8) + K.hash2(x >> 2, y, plank) * .6;
          if (n > 1.15) b.px(x, y, 'mogno', 4); else if (n < -1.1) b.px(x, y, 'mogno', 2);
        }
        if (!seam && K.hash2(plank, 1, 3) > .5) for (let x = (K.hash2(plank, 2, 3) * 200) | 0, i = 0; i < 6; i++) b.px(x + i, y, 'mogno', 2);
      }
      b.grain(0, 0, 240, 106, 1, .03, random);
      // Light: the lamp pool, the monitor's glow, darker far edge and corners.
      b.shadeFn(0, 0, 240, 106, (x, y) => {
        let v = 0;
        if (lampOn) { const d = Math.hypot((x - 182) / 96, (y - 40) / 66); if (d < 1) v += (1 - d) * 2.2; }
        else v -= .8;
        if (screenOn) { const d = Math.hypot((x - 90) / 52, (y - 52) / 26); if (d < 1) v += (1 - d) * (lampOn ? .6 : 1.4); }
        v -= Math.max(0, (8 - y) / 8) * 1.2;
        v -= Math.max(0, Math.hypot((x - 120) / 130, (y - 53) / 70) - .8) * 3;
        return v;
      });
      // Apron with the three drawers.
      b.rect(0, 106, 240, 18, 'mogno', 2); b.hline(0, 239, 106, 'mogno', 5); b.hline(0, 239, 107, 'mogno', 1);
      for (let i = 0; i < 3; i++) {
        const x = 8 + i * 78;
        b.inset(x, 109, 68, 13, 'mogno', 2, 4, 1); b.bevel(x + 2, 111, 64, 9, 'mogno', 3, 4, 1);
      }
      b.shade(0, 106, 240, 18, lampOn ? 0 : -1);
    });
  }
  const objectArt = (name, w, h, lampOn, paint) => U.art(`mesa:${name}:${lampOn}`, w, h, paint, {ambient: lampOn ? 0 : -1});
  const PAINT = {
    telefone(b) {
      b.shade(0, 0, 40, 32, 0);
      b.poly([[4, 30], [36, 30], [33, 12], [7, 12]], 'carvao', 2); b.hline(7, 32, 12, 'carvao', 4); b.line(36, 30, 33, 12, 'carvao', 1);
      b.ellipse(20, 23, 8, 6, 'carvao', 1); b.ellipse(20, 23, 7, 5, 'papel', 4);
      for (let i = 0; i < 10; i++) { const t = -2.3 + i * .48; b.px(20 + Math.cos(t) * 5, 23 + Math.sin(t) * 3.6, 'carvao', 1); }
      b.ellipse(20, 23, 2, 1.5, 'carvao', 3); b.px(26, 26, 'metal', 5);
    },
    fone(b) {
      b.rect(6, 6, 28, 5, 'carvao', 3); b.hline(6, 33, 6, 'carvao', 5); b.hline(6, 33, 10, 'carvao', 1);
      b.ellipse(6, 9, 5, 4, 'carvao', 2); b.ellipse(34, 9, 5, 4, 'carvao', 2); b.px(4, 7, 'carvao', 5); b.px(32, 7, 'carvao', 5);
    },
    canetas(b) {
      b.line(3, 9, 1, 0, 'azul', 4); b.line(6, 9, 7, 1, 'vermelho', 4); b.line(8, 9, 11, 2, 'amarelo', 4); b.px(11, 1, 'grafite', 1);
      b.rect(1, 8, 10, 14, 'carvao', 2); b.hline(1, 10, 8, 'carvao', 4); b.vline(10, 9, 21, 'carvao', 3); b.vline(1, 9, 21, 'carvao', 1);
    },
    pastas(b) {
      b.rect(2, 4, 38, 22, 'couro', 2); b.frame(2, 4, 38, 22, 'couro', 1); b.hline(3, 38, 5, 'couro', 4);
      b.rect(0, 0, 36, 22, 'verde', 3); b.hline(0, 35, 0, 'verde', 5); b.vline(35, 1, 21, 'verde', 2); b.hline(0, 35, 21, 'verde', 1);
      b.rect(6, 3, 26, 3, 'papel', 5); b.rect(3, 8, 31, 9, 'papel', 5); b.frame(3, 8, 31, 9, 'papel', 3);
      b.text(19, 10, 'PROC 87', 'tinta', 2, {font: '3x5', align: 'center'});
    },
    envelope(b) {
      b.rect(0, 0, 36, 20, 'papelVelho', 5); b.frame(0, 0, 36, 20, 'papelVelho', 3);
      b.line(0, 0, 18, 11, 'papelVelho', 3); b.line(35, 0, 18, 11, 'papelVelho', 3);
      b.ellipse(18, 11, 3, 3, 'vermelho', 3); b.px(17, 10, 'vermelho', 5);
    },
    monitor(b, on) {
      b.poly([[5, 0], [51, 0], [56, 6], [0, 6]], 'papel', 5);
      for (let x = 12; x < 44; x += 4) b.hline(x, x + 2, 2, 'papel', 3);
      b.bevel(0, 6, 56, 42, 'papel', 4, 5, 2);
      b.inset(4, 9, 48, 32, 'papel', 3, 5, 1);
      b.rect(6, 11, 44, 28, on ? 'fosforo' : 'preto', on ? 1 : 1);
      for (const [x, y] of [[6, 11], [49, 11], [6, 38], [49, 38]]) b.px(x, y, 'papel', 2);
      if (!on) { b.line(12, 36, 26, 14, 'preto', 3); b.line(15, 36, 29, 14, 'preto', 2); }
      else { b.shadeFn(6, 11, 44, 28, (x, y) => -Math.max(0, Math.hypot((x - 28) / 22, (y - 25) / 14) - .7) * 2.5); }
      b.rect(8, 42, 14, 3, 'papel', 3); b.hline(9, 20, 43, 'azul', 3);
      b.px(48, 43, on ? 'fosforo' : 'grafite', on ? 5 : 2); b.rect(42, 42, 3, 3, 'papel', 3);
    },
    gabinete(b) {
      b.poly([[2, 0], [66, 0], [68, 3], [0, 3]], 'papel', 5);
      b.bevel(0, 3, 68, 11, 'papel', 4, 5, 2);
      b.inset(6, 6, 22, 5, 'papel', 3, 5, 1); b.hline(8, 25, 8, 'preto', 1); b.px(24, 9, 'papel', 6);
      b.inset(32, 6, 22, 5, 'papel', 3, 5, 1); b.hline(34, 51, 8, 'preto', 1);
      b.rect(58, 6, 4, 3, 'vermelho', 3); b.px(63, 10, 'fosforo', 5); b.px(60, 10, 'ambar', 4);
    },
    teclado(b) {
      b.poly([[3, 0], [59, 0], [62, 20], [0, 20]], 'papel', 3);
      b.hline(3, 58, 0, 'papel', 5); b.hline(0, 61, 19, 'papel', 1);
      for (let row = 0; row < 5; row++) {
        const y = 2 + row * 3, inset = 3 - row * .5, keys = row === 4 ? 0 : 14;
        for (let k = 0; k < keys; k++) { const x = Math.round(inset + 3 + k * 4); b.rect(x, y, 3, 2, 'papel', 5); b.hline(x, x + 2, y + 2, 'papel', 2); }
        if (row === 4) { b.rect(18, y, 26, 2, 'papel', 5); b.hline(18, 43, y + 2, 'papel', 2); }
      }
    },
    mouse(b) {
      b.rect(0, 0, 20, 24, 'azul', 2); b.frame(0, 0, 20, 24, 'azul', 1); b.hline(1, 18, 1, 'azul', 3);
      b.ellipse(10, 12, 4.5, 6.5, 'papel', 4); b.ellipse(9, 10, 3, 4, 'papel', 5); b.vline(10, 6, 10, 'papel', 2); b.hline(6, 14, 10, 'papel', 3);
    },
    caneca(b) {
      b.ellipse(7, 8, 7, 7, 'papel', 3); b.ellipse(7, 8, 6, 6, 'papel', 5); b.ellipse(7, 8, 4.5, 4.5, 'madeira', 1); b.px(5, 6, 'madeira', 3);
      b.frame(13, 5, 3, 6, 'papel', 4); b.px(3, 12, 'vermelho', 3); b.px(4, 13, 'vermelho', 3);
    },
    tapete(b) {
      b.rect(0, 0, 100, 18, 'couro', 2); b.hline(0, 99, 0, 'couro', 4); b.hline(0, 99, 17, 'couro', 0);
      for (let x = 3; x < 97; x += 3) { b.px(x, 2, 'couro', 4); b.px(x, 15, 'couro', 4); }
      for (let y = 3; y < 15; y += 3) { b.px(2, y, 'couro', 4); b.px(97, y, 'couro', 4); }
      for (const [x, y] of [[0, 0], [96, 0], [0, 14], [96, 14]]) { b.rect(x, y, 4, 4, 'latao', 3); b.px(x + (x ? 3 : 0), y + (y ? 3 : 0), 'latao', 5); }
    },
    oficio(b) {
      b.rect(1, 1, 44, 16, 'mogno', 0);
      b.rect(0, 0, 44, 16, 'papel', 6); b.hline(0, 43, 0, 'papel', 7); b.vline(43, 0, 15, 'papel', 4);
      b.rect(3, 2, 4, 4, 'azul', 2); b.hline(9, 30, 3, 'tinta', 2); b.hline(9, 22, 5, 'tinta', 3);
      for (let y = 8; y < 15; y += 2) b.hline(3, 20 + (y * 7) % 18, y, 'tinta', 4);
      b.frame(30, 10, 11, 4, 'vermelho', 3);
    },
    luminaria(b, on) {
      b.ellipse(22, 37, 12, 4, 'latao', 2); b.ellipse(22, 36, 11, 3, 'latao', 4); b.hline(14, 30, 35, 'latao', 5);
      b.rect(21, 18, 3, 18, 'latao', 3); b.vline(21, 18, 35, 'latao', 5);
      for (let y = 4; y < 18; y++) {
        const half = 20 - Math.max(0, 6 - y) * 1.2;
        for (let x = Math.round(22 - half); x <= Math.round(22 + half); x++) {
          const t = (x - (22 - half)) / (half * 2);
          b.px(x, y, 'verde', clamp(Math.round(2 + (t > .55 ? 2 : t > .25 ? 1 : 0) + (y < 7 ? 1 : 0) - (y > 15 ? 1 : 0)), 0, 6));
        }
      }
      b.hline(4, 40, 17, 'latao', 4); b.hline(4, 40, 18, on ? 'amarelo' : 'latao', on ? 6 : 1);
      if (on) b.hline(6, 38, 19, 'amarelo', 4);
      b.vline(36, 18, 25, 'latao', 4); b.ellipse(36, 26, 1.4, 1.4, 'latao', 5);
    },
    chaves(b) {
      b.ellipse(5, 5, 4, 4, 'latao', 4); b.ellipse(5, 5, 2.5, 2.5, 'mogno', 3);
      b.line(8, 6, 17, 8, 'metal', 4); b.px(15, 9, 'metal', 3); b.px(13, 9, 'metal', 3);
      b.line(6, 8, 13, 9, 'latao', 5); b.px(11, 10, 'latao', 3);
    },
    placa(b) {
      b.rect(0, 2, 30, 10, 'mogno', 1); b.rect(0, 0, 30, 9, 'mogno', 4); b.hline(0, 29, 0, 'mogno', 5);
      b.rect(2, 2, 26, 5, 'latao', 4); b.hline(2, 27, 2, 'latao', 6);
    },
    caixa(b) {
      b.rect(0, 0, 72, 62, 'amarelo', 4);
      for (let y = 0; y < 62; y++) for (let x = 0; x < 72; x++) {
        const border = x < 5 || y < 5 || x > 66 || y > 56;
        if (border && ((x + y) % 10) < 5) b.px(x, y, 'preto', 1);
      }
      b.frame(0, 0, 72, 62, 'amarelo', 2); b.hline(1, 70, 1, 'amarelo', 6);
      b.bevel(6, 6, 60, 50, 'metal', 2, 4, 1);
      b.ellipse(36, 26, 17, 15, 'preto', 1); b.ellipse(36, 26, 15, 13, 'metal', 1);
      for (const [x, y] of [[9, 9], [62, 9], [9, 52], [62, 52]]) { b.ellipse(x, y, 1.6, 1.6, 'metal', 5); b.px(x, y, 'metal', 1); }
      b.rect(5, 43, 62, 12, 'preto', 1); b.frame(5, 43, 62, 12, 'metal', 3); b.hline(6, 65, 44, 'preto', 3);
    }
  };

  /* ------------------------------------------------------------ interface */
  ClueTypes.register('mesa', {
    label: 'Mesa', icon: 'mesa', sound: 'gaveta',
    fields: [
      {id: 'postit', label: 'Post-it embaixo do teclado', kind: 'text'},
      {id: 'gaveta1', label: 'Gaveta da esquerda', kind: 'textarea'},
      {id: 'gaveta2', label: 'Gaveta do meio', kind: 'textarea'},
      {id: 'gaveta3', label: 'Gaveta da direita (trancada)', kind: 'textarea'},
      {id: 'chaveGaveta', label: 'Objeto da cena que destranca a gaveta', kind: 'prop'},
      {id: 'telefone', label: 'Ao atender o telefone', kind: 'text'},
      {id: 'papel', label: 'Pista aberta pelo papel da mesa', kind: 'clue'},
      {id: 'computador', label: 'Pista aberta pelo computador', kind: 'clue'},
      {id: 'botao', label: 'Botão NÃO APERTE', kind: 'select', options: [['sim', 'Na mesa'], ['nao', 'Sem botão']]}],
    defaults: {postit: '', gaveta1: '', gaveta2: '', gaveta3: '', chaveGaveta: 'chaves', telefone: '', papel: 'oficio', computador: 'computador', botao: 'sim'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      mem.tampa ??= 'fechada'; mem.apertos ??= 0; mem.gavetas ??= {};
      return {mem, lift: mem.teclado ? 1 : 0, cover: mem.tampa === 'aberta' ? 1 : 0, drawer: null, drawerT: 0, phone: null, alarm: null, press: 0, caption: null};
    },
    wantsKeys: () => false,
    get clickOutsideCloses() { return false; },
    render(ctx, ui, st, clue, sys, entry) {
      const d = clue.data, dt = ui.dt, t = ui.t;
      const lampOn = sys.hasProp('luminaria') && !sys.stage.activeLayers?.()?.preset?.lampOff, screenOn = sys.hasProp('monitor') || !sys.stage.scene?.props.some(p => p.id === 'monitor');
      st.lift += ((st.mem.teclado ? 1 : 0) - st.lift) * Math.min(1, dt * 12);
      st.cover += ((st.mem.tampa === 'aberta' ? 1 : 0) - st.cover) * Math.min(1, dt * 14);
      st.press = Math.max(0, st.press - dt * 2.5);
      const hover = ui.hover, alarm = st.alarm;
      U.blit(ctx, deskArt(lampOn, screenOn), OX, OY);
      const put = (name, paintName = name, extra = null) => {
        const [x, y, w, h] = ITEMS[name];
        U.blit(ctx, objectArt(paintName + (extra ?? ''), w, h, lampOn, b => PAINT[paintName](b, extra)), sx(x), sy(y));
      };
      const zone = (id, name, opts) => { const [x, y, w, h] = ITEMS[name]; return ui.region(id, sx(x), sy(y), w * 2, h * 2, opts); };
      // Far row: telephone, pens, computer, lamp.
      const phoneUp = !!st.phone;
      put('telefone');
      if (!phoneUp) U.blit(ctx, objectArt('fone', 40, 16, lampOn, PAINT.fone), sx(8), sy(4));
      zone('telefone', 'telefone');
      put('canetas'); put('pastas');
      put('monitor', 'monitor', screenOn ? 1 : 0);
      if (screenOn) {
        // What the screen shows from the chair: the terminal waiting.
        const logged = sys.memory(d.computador || 'computador').logado;
        const lines = logged ? ['C:\\> DIR', 'INTERDIC  <DIR>', 'OBRAS     <DIR>', 'PESSOAL   <DIR>', 'C:\\> _'] : ['PREFEITURA', 'MUNICIPAL', '', 'USUARIO:', 'SENHA: _'];
        lines.forEach((line, i) => K.drawText(ctx, line.replace('_', Math.floor(t * 2) % 2 ? '_' : ' '), sx(62 + 8), sy(0 + 12) + i * 8, {font: '3x5', color: i === lines.length - 1 ? C('fosforo', 6) : C('fosforo', 4)}));
        for (let y = sy(11); y < sy(39); y += 2) U.rect(ctx, sx(68), y, 88, 1, '#01080533');
      }
      zone('monitor', 'monitor');
      put('gabinete');
      // Post-it under the keyboard, then the keyboard (lifted when clicked).
      if (d.postit) {
        const [px, py] = ITEMS.postit;
        U.rect(ctx, sx(px) + 2, sy(py) + 2, 68, 36, '#1a0a0a66');
        U.blit(ctx, paperArt('amarelo', 34, 18, 2), sx(px), sy(py));
        U.hand(ctx, d.postit, sx(px) + 34, sy(py) + 14, {color: C('tinta', 2), width: 68, seed: 4, align: 'center'});
        if (st.lift > .5) zone('postit', 'postit');
      }
      {
        const [kx, ky] = ITEMS.teclado, lift = Math.round(st.lift * 16) * 2;
        if (st.lift > .02) U.rect(ctx, sx(kx) + 6, sy(ky) + 6 - lift / 2, 124, 40, '#0a040466');
        U.blit(ctx, objectArt('teclado', 62, 20, lampOn, PAINT.teclado), sx(kx), sy(ky) - lift);
        ui.region('teclado', sx(kx), sy(ky) - lift, 124, 40);
      }
      put('mouse'); zone('mouse', 'mouse', {cursor: 'default', silent: true});
      U.rect(ctx, sx(120), sy(60), 2, 2, C('papel', 3)); for (let i = 0; i < 8; i++) U.rect(ctx, sx(122 + i), sy(60 + i * 1.2), 2, 2, C('grafite', 2));
      put('tapete');
      if (d.papel && (sys.clue(d.papel) || d.papel === 'oficio')) { put('oficio'); zone('oficio', 'oficio'); }
      put('luminaria', 'luminaria', lampOn ? 1 : 0);
      ui.region('luminaria', sx(160), sy(0), 88, 84);
      if (sys.hasProp('cafe')) {
        put('caneca'); zone('caneca', 'caneca');
        const [cx, cy] = ITEMS.caneca;
        for (let i = 0; i < 3; i++) { const age = (t * .6 + i / 3) % 1; if (age < .8) U.rect(ctx, sx(cx + 5 + i * 2) + Math.round(Math.sin(t * 3 + i) * 2), sy(cy + 4) - Math.round(age * 24 / 2) * 2, 2, 2, '#f4ead6aa'); }
      }
      if (sys.hasProp('envelope') && sys.clue('envelope')) { put('envelope'); zone('envelope', 'envelope'); }
      if (sys.hasProp('chaves')) { put('chaves'); zone('chaves', 'chaves'); }
      put('placa'); K.drawText(ctx, 'SECRETARIA', sx(136) + 30, sy(94) + 5, {font: '3x5', color: C('mogno', 1), align: 'center'});
      zone('placa', 'placa', {cursor: 'default', silent: true});
      if (d.botao !== 'nao') this.drawButton(ctx, ui, st, clue, sys, lampOn);
      // Drawer handles.
      for (let i = 0; i < 3; i++) {
        const x = sx(8 + i * 78), y = sy(109), on = ui.region('gaveta' + i, x, y, 136, 26);
        U.rect(ctx, x + 52, y + 10, 32, 6, C('latao', on ? 5 : 3)); U.rect(ctx, x + 52, y + 14, 32, 2, C('latao', 1));
        if (i === 2 && !this.unlocked(st, clue, sys)) { U.rect(ctx, x + 64, y + 2, 8, 6, C('latao', 2)); U.rect(ctx, x + 67, y + 3, 2, 4, C('preto', 0)); }
      }
      // Hover label.
      const label = hover && (hover.startsWith('gaveta') ? LABELS[hover] : hover === 'luminaria' ? (lampOn ? 'Apagar a luminária' : 'Acender a luminária') : LABELS[hover]);
      if (label && !st.drawer && !alarm && ui.mouse.x >= 0) U.tooltip(ctx, label, ui.mouse.x, ui.mouse.y - 22);
      if (st.phone) this.drawPhone(ctx, ui, st, clue, sys);
      if (st.drawer !== null) this.drawDrawer(ctx, ui, st, clue, sys);
      if (st.caption) {
        st.caption.t += dt;
        const lines = K.wrap(st.caption.text, 220), w = 240, h = lines.length * 10 + 14, x = U.snap(SW / 2 - w / 2), y = SH - h - 44;
        U.frame(ctx, x, y, w, h, 'escuro');
        lines.forEach((line, i) => K.drawText(ctx, line, SW / 2, y + 8 + i * 10, {color: '#ffe6f7', align: 'center'}));
        if (st.caption.t > 3.5) st.caption = null;
      }
      if (alarm) this.drawAlarm(ctx, ui, st, clue, sys);
      U.header(ctx, ui, clue.name, alarm ? 'ALERTA' : 'clique nos objetos da mesa', 'mesa');
    },
    unlocked(st, clue, sys) { const key = clue.data.chaveGaveta; return !key || sys.hasProp(key) || !!st.mem.gavetas.destrancada; },
    drawButton(ctx, ui, st, clue, sys, lampOn) {
      const [bx, by] = ITEMS.caixa, X = sx(bx), Y = sy(by), t = ui.t;
      U.blit(ctx, objectArt('caixa', 72, 62, lampOn, PAINT.caixa), X, Y);
      // Beacon on the corner of the box.
      const flashing = !!st.alarm && Math.floor(t * 8) % 2 === 0;
      U.rect(ctx, X + 128, Y - 10, 12, 12, flashing ? C('vermelho', 6) : C('vermelho', 2)); U.rect(ctx, X + 128, Y + 2, 12, 4, C('metal', 2)); U.rect(ctx, X + 130, Y - 8, 4, 4, flashing ? '#fff2e0' : C('vermelho', 4));
      // The red mushroom button.
      const cx = X + 72, cy = Y + 52, down = st.press > 0 || !!st.alarm ? 4 : 0;
      const hotButton = st.cover > .9 && !st.alarm && ui.region('botao', cx - 30, cy - 30, 60, 56);
      for (let yy = -24; yy <= 24; yy += 2) for (let xx = -26; xx <= 26; xx += 2) {
        const r = Math.hypot(xx / 26, yy / 22);
        if (r > 1) continue;
        const lit = clamp(Math.round(4.6 - r * 2.2 - (xx + yy) / 26 + (hotButton ? 1 : 0) - (down ? 1 : 0)), 1, 6);
        U.rect(ctx, cx + xx, cy + yy + down, 2, 2, C('vermelho', lit));
      }
      U.rect(ctx, cx - 12, cy - 16 + down, 8, 4, '#ffd9c8'); U.rect(ctx, cx - 16, cy - 12 + down, 4, 4, '#ffb59a');
      // Label, the part everyone reads.
      K.drawText(ctx, 'NÃO APERTE', X + 72, Y + 92, {color: Math.floor(t * 1.5) % 2 && !st.alarm ? '#ffd257' : '#fff4d8', scale: 2, align: 'center', shadow: {color: '#1a0406', dx: 1, dy: 1}});
      // Tally of past presses, scratched into the plate.
      for (let i = 0; i < Math.min(9, st.mem.apertos); i++) U.rect(ctx, X + 14 + i * 5, Y + 18, 2, 10 + (i % 5 === 4 ? 2 : 0), '#2a2410');
      // Flip cover: hinged at the top, clear plastic.
      const u = ease(st.cover);
      if (u < .98) {
        const h = Math.round((1 - u) * 60 / 2) * 2, top = Y + 12;
        const hot = !st.alarm && ui.region('tampa', X + 26, top, 92, Math.max(h, 12) + 12);
        ctx.save(); ctx.globalAlpha = .42;
        U.rect(ctx, X + 30, top + 4, 84, h, hot ? '#cfefff' : '#a9d6ea');
        ctx.globalAlpha = .75;
        for (let i = 0; i < h; i += 2) if (i % 14 < 4) U.rect(ctx, X + 36 + i / 2, top + 6 + i, 2, 2, '#ffffff');
        ctx.restore();
        U.outline(ctx, X + 30, top + 4, 84, h, hot ? '#ffffff' : '#d8f2ff', 2);
        if (st.mem.apertos > 0 && h > 30) {   // somebody left a note on the cover
          U.blit(ctx, paperArt('amarelo', 26, 16, 7), X + 56, top + 10);
          U.hand(ctx, 'SÉRIO.', X + 82, top + 20, {color: C('vermelho', 3), width: 50, seed: 2, align: 'center'});
        }
      } else {
        // Open: the cover stands up behind the button, seen edge-on.
        ctx.save(); ctx.globalAlpha = .5; U.rect(ctx, X + 30, Y - 4, 84, 12, '#a9d6ea'); ctx.restore();
        U.outline(ctx, X + 30, Y - 4, 84, 12, '#d8f2ff', 2);
        ui.region('tampa', X + 30, Y - 6, 84, 16);
      }
      U.rect(ctx, X + 30, Y + 12, 84, 4, C('metal', 4)); U.rect(ctx, X + 30, Y + 14, 84, 2, C('metal', 1));
    },
    drawPhone(ctx, ui, st, clue, sys) {
      st.phone.t += ui.dt;
      const text = clue.data.telefone || 'Sinal de linha.', shown = text.slice(0, Math.floor(st.phone.t * 24));
      // Handset lifted toward the viewer, cord curling back to the base.
      const hx = sx(20), hy = sy(40);
      for (let i = 0; i < 18; i++) U.rect(ctx, sx(18) + Math.round(Math.sin(i * 1.3) * 6), sy(26) + i * 4, 4, 2, C('carvao', i % 2 ? 2 : 4));
      U.blit(ctx, objectArt('fone', 40, 16, true, PAINT.fone), hx, hy + 60);
      const lines = K.wrap(shown, 170), w = 196, h = Math.max(1, lines.length) * 10 + 16;
      U.frame(ctx, 96, 58, w, h, 'escuro');
      lines.forEach((line, i) => K.drawText(ctx, line, 106, 66 + i * 10, {color: '#d9f0ff'}));
      if (Math.floor(st.phone.t * 3) % 2) U.rect(ctx, 106 + K.measure(lines.at(-1) || ''), 66 + (lines.length - 1) * 10, 5, 7, '#d9f0ff');
      ui.region('desligar', 96, 58, w, h);
    },
    drawDrawer(ctx, ui, st, clue, sys) {
      st.drawerT = Math.min(1, st.drawerT + ui.dt / .28);
      const i = st.drawer, u = ease(st.drawerT), locked = i === 2 && !this.unlocked(st, clue, sys);
      const W = 360, H = 150, X = 60, Y = U.snap(SH - u * (H + 12));
      U.veil(ctx, .45 * u);
      U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
      const box = U.art('gaveta:' + i + ':' + locked, W / 2, H / 2, b => {
        b.rect(0, 0, W / 2, H / 2, 'mogno', 3); b.inset(4, 4, W / 2 - 8, H / 2 - 12, 'mogno', 1, 3, 0);
        b.rect(0, H / 2 - 10, W / 2, 10, 'mogno', 4); b.hline(0, W / 2 - 1, H / 2 - 10, 'mogno', 5);
        b.grain(4, 4, W / 2 - 8, H / 2 - 12, 1, .06, K.rng(i + 3));
        if (locked) return;
        const random = K.rng(40 + i);
        if (i === 0) {
          for (let k = 0; k < 9; k++) { const x = 20 + random() * 60, y = 12 + random() * 40; b.frame(x, y, 3, 6, 'metal', 5); }
          for (let k = 0; k < 3; k++) { b.rect(96 + k * 16, 16, 8, 14, 'madeira', 4); b.rect(94 + k * 16, 30, 12, 6, k === 1 ? 'azul' : 'vermelho', 3); }
          for (let a = 0; a < 26; a++) { const tt = a / 26 * Math.PI * 2; b.ellipse(56 + Math.cos(tt) * 16, 44 + Math.sin(tt) * 9, 1.4, 1.4, 'vermelho', 3 + (a % 3 === 0 ? 1 : 0)); }
          b.vline(56, 53, 60, 'latao', 4); b.hline(54, 58, 55, 'latao', 4);
        } else if (i === 1) {
          b.rect(24, 16, 20, 18, 'latao', 3); b.bevel(24, 16, 20, 18, 'latao', 3, 5, 1); b.frame(27, 6, 10, 14, 'metal', 4); b.erase(28, 7, 8, 9); b.rect(28, 7, 8, 9, 'mogno', 1); b.px(34, 24, 'preto', 0);
          b.rect(60, 20, 40, 26, 'papel', 5); b.frame(60, 20, 40, 26, 'papel', 3);
          for (let y = 26; y < 44; y += 4) b.hline(64, 94, y, 'tinta', 4);
        } else {
          b.rect(20, 20, 46, 12, 'metal', 3); b.hline(20, 65, 20, 'metal', 5); b.ellipse(66, 26, 5, 7, 'metal', 4); b.ellipse(66, 26, 3, 5, 'amarelo', 5);
          for (let k = 0; k < 3; k++) { b.rect(24 + k * 8, 40, 6, 12, 'vermelho', 3); b.hline(24 + k * 8, 29 + k * 8, 40, 'metal', 5); }
          b.rect(84, 14, 70, 44, 'azul', 3); b.frame(84, 14, 70, 44, 'azul', 1);
          for (let y = 18; y < 56; y += 6) b.hline(88, 150, y, 'azul', 5); for (let x = 90; x < 150; x += 10) b.vline(x, 16, 56, 'azul', 5);
          b.line(96, 50, 140, 22, 'vermelho', 4); b.ellipse(140, 22, 3, 3, 'vermelho', 4);
        }
      });
      U.blit(ctx, box, X, Y);
      const text = locked ? 'Trancada. A fechadura é pequena, de gaveta.' : (clue.data['gaveta' + (i + 1)] || 'Vazia.');
      const lines = K.wrap(text, 150), tw = 170, th = lines.length * 11 + 18;
      const TX = X + W - tw - 20, TY = Y + 18;
      U.rect(ctx, TX + 4, TY + 4, tw, th, '#05020888');
      U.blit(ctx, paperArt('velho', tw / 2, Math.ceil(th / 2), 2), TX, TY);
      lines.forEach((line, k) => K.drawText(ctx, line, TX + 10, TY + 10 + k * 11, {color: C('tinta', 1)}));
      if (locked) { U.rect(ctx, X + 80, Y + 50, 28, 36, C('latao', 3)); U.outline(ctx, X + 80, Y + 50, 28, 36, C('latao', 1), 2); U.rect(ctx, X + 92, Y + 60, 4, 14, C('preto', 0)); }
      ui.region('gavetaPainel', X, Y, W, H, {cursor: 'default', silent: true});
      ui.button(ctx, 'fecharGaveta', X + W - 96, Y + H - 30, 80, 20, 'FECHAR', {style: 'papel'});
    },
    drawAlarm(ctx, ui, st, clue, sys) {
      const A = st.alarm; A.t += ui.dt;
      const t = A.t, on = Math.floor(t * 6) % 2 === 0;
      ctx.save(); ctx.globalAlpha = on ? .38 : .16; ctx.fillStyle = '#d0101a'; ctx.fillRect(0, 22, SW, SH - 22); ctx.restore();
      // Rotating beacon sweep.
      const [bx, by] = ITEMS.caixa, cx = sx(bx) + 134, cy = sy(by) - 4, ang = t * 7;
      ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = '#ff3a2a';
      for (let r = 10; r < 520; r += 6) for (let k = -3; k <= 3; k++) {
        const a = ang + k * .03 * (1 + r / 200);
        ctx.fillRect(U.snap(cx + Math.cos(a) * r), U.snap(cy + Math.sin(a) * r * .6), 4, 4);
      }
      ctx.restore();
      const count = Math.max(1, 3 - Math.floor(t / .85));
      U.frame(ctx, 104, 70, 272, 104, 'escuro');
      U.rect(ctx, 108, 74, 264, 18, on ? '#8a0a12' : '#4a060c');
      K.drawText(ctx, 'ALERTA · LANÇAMENTO AUTORIZADO', SW / 2, 80, {color: '#ffe0d0', align: 'center'});
      K.drawText(ctx, String(count), SW / 2, 102, {color: on ? '#ffd257' : '#ff7a50', scale: 6, align: 'center'});
      if (A.abort) K.drawText(ctx, 'NÃO É POSSÍVEL ABORTAR', SW / 2, 152, {color: '#ffb0a0', align: 'center'});
      else ui.button(ctx, 'abortar', SW / 2 - 50, 150, 100, 18, 'ABORTAR', {style: 'roxo'});
      if (t >= 2.55 && !A.fired) {
        A.fired = true;
        st.mem.apertos++; st.mem.tampa = 'fechada';
        sys.emit('change');
        sys.playCinematic('foguete', {onEnd: () => {}});
      }
    },
    action(id, st, clue, sys, info) {
      const d = clue.data;
      if (st.alarm) { if (id === 'abortar') { st.alarm.abort = true; sys.sfx('erro'); } return; }
      if (st.drawer !== null) {
        if (id === 'fecharGaveta' || id.startsWith('gaveta') && id !== 'gavetaPainel') { st.drawer = null; sys.sfx('gaveta'); }
        return;
      }
      if (st.phone && id !== 'telefone') { st.phone = null; sys.sfx('fone'); return; }
      switch (id) {
        case 'telefone': st.phone = st.phone ? null : {t: 0}; sys.sfx(st.phone ? 'telefone' : 'fone'); break;
        case 'monitor': sys.pushById(d.computador || 'computador', {type: 'computador', name: 'Computador', data: {}}); break;
        case 'teclado': st.mem.teclado = !st.mem.teclado; sys.sfx('teclado'); sys.emit('change'); break;
        case 'postit': sys.push(root.normalize({id: clue.id + ':postit', inline: true, type: 'bilhete', name: 'Post-it', data: {texto: d.postit, papel: 'amarelo', tinta: 'tinta'}})); break;
        case 'oficio': sys.pushById(d.papel || 'oficio'); break;
        case 'envelope': sys.pushById('envelope'); break;
        case 'chaves': sys.pushById('chaves', {type: 'objeto', name: 'Molho de chaves', data: {arte: 'chaves', texto: 'Um molho de chaves.'}}); break;
        case 'luminaria': sys.setProp('luminaria', !sys.hasProp('luminaria')); sys.sfx('interruptor'); break;
        case 'caneca': st.caption = {text: 'O café ainda está quente. Alguém saiu daqui há pouco.', t: 0}; break;
        case 'gaveta0': case 'gaveta1': case 'gaveta2': {
          const i = Number(id.slice(-1));
          st.drawer = i; st.drawerT = 0;
          if (i === 2 && !this.unlocked(st, clue, sys)) sys.sfx('tranca');
          else { sys.sfx('gaveta'); if (i === 2 && d.chaveGaveta && sys.hasProp(d.chaveGaveta) && !st.mem.gavetas.destrancada) { st.mem.gavetas.destrancada = true; sys.toast('DESTRANCADA', 'Uma das chaves do molho serviu', 'chave' in U.ICONS ? 'chave' : 'cadeado'); } }
          break;
        }
        case 'tampa': st.mem.tampa = st.mem.tampa === 'aberta' ? 'fechada' : 'aberta'; sys.sfx('tampa'); break;
        case 'botao': st.press = 1; st.alarm = {t: 0}; sys.sfx('botao'); sys.sfx('alarme'); sys.emit('alarm'); break;
      }
    },
    key(e, st) {
      if (st.drawer !== null && e.key === 'Escape') { st.drawer = null; return true; }
      if (st.phone && e.key === 'Escape') { st.phone = null; return true; }
      if (st.alarm) return true;
      return false;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
