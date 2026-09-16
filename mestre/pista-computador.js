/* Computador — the office terminal, 1987. Power it on and it boots; the
   system asks for a user and a password (typed on the real keyboard, by the
   master or by the players through their window); inside, folders and text
   files written by the master. A file marked with "!" is corrupted: opening
   it tears the screen apart. The power button turns the tube off with the
   collapsing line old CRTs made.

   Files come from one text field:
     PASTA/NOME.TXT        first line: the path (add " !" for a corrupted file)
     linhas do arquivo…
     ---                   separates files */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, {clamp, ease} = root.PistaPapel;
  const {C, SW, SH} = U;
  const GX = 62, GY = 38, GW = 356, GH = 192;                 // the glass, in screen pixels
  const TX = GX + 18, TY = GY + 14, COLS = Math.floor((GW - 36) / 6), ROWS = 16, LH = 10;
  const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');

  function parseFiles(text) {
    const files = [];
    for (const block of String(text || '').split(/\n\s*---\s*\n?/)) {
      const lines = block.replace(/^\n+/, '').split('\n');
      const head = (lines.shift() || '').trim();
      if (!head) continue;
      const glitch = /\s!$/.test(head), path = head.replace(/\s*!$/, '');
      const slash = path.lastIndexOf('/');
      files.push({folder: slash > 0 ? path.slice(0, slash) : 'DOCS', name: slash > 0 ? path.slice(slash + 1) : path, text: lines.join('\n'), glitch});
    }
    return files;
  }
  const folders = files => [...new Set(files.map(f => f.folder))];

  function bezelArt() {
    return U.art('crt:moldura', 240, 124, b => {
      // Wall behind, lit by the tube.
      b.rect(0, 0, 240, 124, 'carvao', 1);
      b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 120) / 150, (y - 56) / 90); return d < 1 ? (1 - d) * 2.2 : 0; });
      b.rect(0, 116, 240, 8, 'mogno', 3); b.hline(0, 239, 116, 'mogno', 5); b.speckle(0, 117, 240, 7, 'mogno', 2, .2, K.rng(3));
      // Case.
      b.rect(14, 1, 212, 118, 'papel', 4);
      b.hline(15, 224, 1, 'papel', 6); b.vline(225, 2, 117, 'papel', 2); b.hline(15, 224, 118, 'papel', 1); b.vline(14, 2, 117, 'papel', 5);
      for (const [x, y] of [[14, 1], [225, 1], [14, 118], [225, 118]]) b.erase(x, y, 1, 1);
      b.grain(15, 2, 210, 116, -1, .03, K.rng(8));
      // Recess around the glass.
      b.rect(24, 5, 192, 100, 'papel', 2); b.hline(24, 215, 5, 'papel', 1); b.vline(24, 5, 104, 'papel', 1); b.hline(25, 215, 104, 'papel', 5); b.vline(215, 6, 104, 'papel', 4);
      b.erase(31, 8, 178, 96);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {           // rounded glass corners
        for (const [x, y] of [[31 + i, 8 + j], [208 - i, 8 + j], [31 + i, 103 - j], [208 - i, 103 - j]]) b.px(x, y, 'papel', 2);
      }
      // Controls panel.
      b.rect(28, 107, 64, 8, 'papel', 3); b.frame(28, 107, 64, 8, 'papel', 2);
      b.text(60, 109, 'SISTEMA MUNICIPAL', 'tinta', 2, {font: '3x5', align: 'center'});
      for (let x = 112; x < 150; x += 3) b.vline(x, 108, 114, 'papel', 2);
      b.ellipse(164, 111, 3, 3, 'papel', 2); b.px(164, 110, 'papel', 5); b.ellipse(176, 111, 3, 3, 'papel', 2); b.px(176, 110, 'papel', 5);
      b.ellipse(204, 111, 5, 5, 'papel', 1); b.ellipse(204, 111, 4, 4, 'papel', 5);
    });
  }
  function glassArt(on) {
    return U.art('crt:vidro:' + on, 178, 96, b => {
      for (let y = 0; y < 96; y++) for (let x = 0; x < 178; x++) {
        const d = Math.hypot((x - 89) / 96, (y - 48) / 56);
        const level = on ? 1.6 - d * 1.5 : 1.2 - d * 1.3;
        b.px(x, y, on ? 'fosforo' : 'preto', Math.max(0, Math.floor(level + K.bayer(x, y))));
      }
      if (!on) for (let i = 0; i < 40; i++) { b.line(20 + i, 6, 6 + i, 40, 'preto', i % 9 < 3 ? 3 : 2); if (i > 6) break; }
    });
  }

  ClueTypes.register('computador', {
    label: 'Computador', icon: 'computador', sound: 'boot',
    fields: [
      {id: 'usuario', label: 'Usuário', kind: 'text'},
      {id: 'senha', label: 'Senha (vazio = sem senha)', kind: 'text'},
      {id: 'dica', label: 'Dica depois de 3 erros', kind: 'text'},
      {id: 'arquivos', label: 'Arquivos (PASTA/NOME.TXT, texto, --- entre arquivos; " !" = corrompido)', kind: 'textarea', rows: 10}],
    defaults: {usuario: 'USUARIO', senha: '', dica: '', arquivos: 'DOCS/LEIA.TXT\nNada aqui ainda.'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      const powered = mem.ligado ?? true;
      return {mem, screen: powered ? 'boot' : 'off', t: 0, input: '', errors: 0, msg: '', col: 0, row: 0, fileRow: 0, file: null, scroll: 0};
    },
    wantsKeys: st => ['boot', 'login', 'shell', 'file'].includes(st.screen),
    go(st, screen) { st.screen = screen; st.t = 0; },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, dt = ui.dt, t = (st.t += dt);
      U.blit(ctx, bezelArt(), 0, 22);
      const on = !['off'].includes(st.screen);
      U.blit(ctx, glassArt(on && st.screen !== 'shutdown'), GX, GY);
      ctx.save(); ctx.beginPath(); ctx.rect(GX, GY, GW, GH); ctx.clip();
      const files = parseFiles(d.arquivos), dirs = folders(files);
      const text = (str, col, row, color = C('fosforo', 5)) => U.mono(ctx, str, TX + col * 6, TY + row * LH, {color});
      const click = (id, str, col, row, data = null) => ui.region(id, TX + col * 6 - 3, TY + row * LH - 2, String(str).length * 6 + 6, LH + 1, {data, cursor: 'pointer'});
      const inverse = (str, col, row) => { U.rect(ctx, TX + col * 6 - 2, TY + row * LH - 2, String(str).length * 6 + 4, LH, C('fosforo', 5)); text(str, col, row, C('fosforo', 0)); };
      switch (st.screen) {
        case 'off': {
          ui.region('ligar', GX, GY, GW, GH, {cursor: 'pointer'});
          if (Math.floor(t * 1.2) % 2) K.drawText(ctx, 'aperte o botão para ligar', SW / 2, GY + GH / 2, {color: C('preto', 4), align: 'center'});
          break;
        }
        case 'boot': {
          const lines = ['CPD · PREFEITURA MUNICIPAL     BIOS 1.02', '', 'MEMORIA .......... 640K  OK', 'DISCO RIGIDO ..... 20MB  OK', 'VIDEO ............ FOSFORO', '', 'CARREGANDO SISTEMA MUNICIPAL'];
          const shown = Math.floor(t / .32);
          lines.slice(0, shown).forEach((line, i) => text(line, 0, i));
          if (shown > lines.length) text('.'.repeat(Math.min(12, Math.floor((t - lines.length * .32) * 6))), 29, lines.length - 1);
          if (shown === 1 && !st.beeped) { st.beeped = true; sys.sfx('beep'); }
          if (t > lines.length * .32 + 1.4) this.go(st, st.mem.logado || !d.senha ? 'shell' : 'login');
          ui.region('pular', GX, GY, GW, GH, {cursor: 'default', silent: true});
          break;
        }
        case 'login': {
          U.outline(ctx, TX, TY + 2, COLS * 6 - 6, 34, C('fosforo', 4), 2);
          text('SISTEMA MUNICIPAL DE PROCESSOS', Math.floor((COLS - 30) / 2), 1);
          text('PREFEITURA  ·  CPD  ·  1987', Math.floor((COLS - 27) / 2), 2, C('fosforo', 4));
          text('USUARIO:', 6, 6); text(plain(d.usuario) || 'USUARIO', 16, 6);
          text('SENHA:', 6, 8); text('*'.repeat(st.input.length) + (Math.floor(t * 2.5) % 2 ? '_' : ' '), 16, 8);
          ui.region('campo', TX + 15 * 6, TY + 8 * LH - 2, 18 * 6, LH + 2, {cursor: 'text'});
          const hot = click('entrar', '[ ENTRAR ]', 16, 11);
          (hot ? inverse : text)('[ ENTRAR ]', 16, 11);
          if (st.msg) text(st.msg, 6, 13, Math.floor(t * 4) % 2 ? C('fosforo', 6) : C('fosforo', 4));
          if (st.errors >= 3 && d.dica) text('DICA: ' + d.dica, 6, 14, C('fosforo', 4));
          text('digite a senha e aperte Enter', 6, 15, C('fosforo', 3));
          break;
        }
        case 'shell': {
          text('SISTEMA MUNICIPAL', 0, 0); text('15/09/87  03:17', COLS - 16, 0, C('fosforo', 4));
          U.rect(ctx, TX, TY + LH + 1, COLS * 6 - 6, 2, C('fosforo', 3));
          text('PASTAS', 1, 2, C('fosforo', 4)); text('ARQUIVOS', 22, 2, C('fosforo', 4));
          st.row = clamp(st.row, 0, Math.max(0, dirs.length - 1));
          const inDir = files.filter(f => f.folder === dirs[st.row]);
          st.fileRow = clamp(st.fileRow, 0, Math.max(0, inDir.length - 1));
          dirs.forEach((dir, i) => {
            const label = (i === st.row ? '> ' : '  ') + dir.slice(0, 16);
            const hot = click('pasta', label, 1, 4 + i, i);
            (hot || (st.col === 0 && i === st.row) ? inverse : text)(label, 1, 4 + i);
          });
          inDir.forEach((f, i) => {
            const label = f.name.slice(0, 24) + (f.glitch && st.mem.corrompido ? ' [ERRO]' : '');
            const hot = click('arquivo', label, 22, 4 + i, i);
            (hot || (st.col === 1 && i === st.fileRow) ? inverse : text)(label, 22, 4 + i);
          });
          if (!inDir.length) text('(vazia)', 22, 4, C('fosforo', 3));
          U.rect(ctx, TX, TY + 14 * LH - 3, COLS * 6 - 6, 1, C('fosforo', 3));
          const hot = click('desligar', '[ DESLIGAR ]', 0, 15);
          (hot ? inverse : text)('[ DESLIGAR ]', 0, 15);
          text('setas escolhem · Enter abre', 17, 15, C('fosforo', 3));
          break;
        }
        case 'file': {
          const f = st.file;
          text(`${f.folder}/${f.name}`, 0, 0); U.rect(ctx, TX, TY + LH + 1, COLS * 6 - 6, 2, C('fosforo', 3));
          const body = U.wrapMono(f.text, COLS - 2), rows = 12;
          st.maxScroll = Math.max(0, body.length - rows); st.scroll = clamp(st.scroll, 0, st.maxScroll);
          if (f.glitch) this.glitch(ctx, ui, st, sys, body, text);
          else body.slice(st.scroll, st.scroll + rows).forEach((line, i) => text(line, 0, 2 + i));
          if (!f.glitch || st.t > 4.2) {
            const hot = click('voltar', '[ VOLTAR ]', 0, 15);
            (hot ? inverse : text)('[ VOLTAR ]', 0, 15);
            if (st.maxScroll && !f.glitch) text(`${st.scroll + 1}-${Math.min(body.length, st.scroll + rows)} de ${body.length} · setas rolam`, 14, 15, C('fosforo', 3));
          }
          break;
        }
        case 'shutdown': {
          const u = clamp(t / .55, 0, 1);
          const h = Math.max(2, U.snap(GH * Math.max(0, 1 - u * 3))), w = u < .33 ? GW : Math.max(4, U.snap(GW * Math.max(0, 1 - (u - .33) * 1.8)));
          if (u < .92) {
            U.rect(ctx, U.snap(GX + (GW - w) / 2), U.snap(GY + (GH - h) / 2), w, h, u < .33 ? C('fosforo', 4) : C('fosforo', 6));
            if (u > .7) U.rect(ctx, SW / 2 - 3, GY + GH / 2 - 3, 6, 6, '#e8fff0');
          }
          if (t > .9) this.go(st, 'off');
          break;
        }
      }
      if (on && st.screen !== 'shutdown') {
        ctx.fillStyle = '#01080540';
        for (let y = GY; y < GY + GH; y += 2) ctx.fillRect(GX, y, GW, 1);
        if (Math.random() < .04) { ctx.fillStyle = '#b5ffc60a'; ctx.fillRect(GX, GY, GW, GH); }
        ctx.fillStyle = '#ffffff0d'; for (let i = 0; i < 26; i++) ctx.fillRect(GX + 12 + i * 2, GY + 8 + i, 2, 30 - i);
      }
      ctx.restore();
      // Power LED and button on the case.
      U.rect(ctx, 382, 22 + 220, 4, 4, on ? C('fosforo', 5) : C('preto', 3));
      ui.region('energia', 394, 22 + 208, 28, 28);
      if (ui.hover === 'energia') U.outline(ctx, 396, 22 + 210, 24, 24, '#ffd18c', 2);
      U.header(ctx, ui, clue.name, {off: 'desligado', boot: 'iniciando…', login: 'digite a senha', shell: 'escolha uma pasta', file: 'Esc volta', shutdown: ''}[st.screen] || '', 'computador');
    },
    glitch(ctx, ui, st, sys, body, text) {
      const t = st.t;
      if (!st.glitchSound) { st.glitchSound = true; setTimeout(() => sys.sfx('glitch'), 700); }
      if (t < .8) { body.slice(0, 12).forEach((line, i) => text(line, 0, 2 + i)); return; }
      if (t < 3.4) {
        const k = (t - .8) / 2.6, random = K.rng(Math.floor(t * 20));
        const junk = '#@%&*=+<>$01/\\|';
        for (let row = 0; row < 13; row++) {
          const src = body[row % Math.max(1, body.length)] || 'ELE VOLTA ONDE COMEU';
          let line = row % 2 && k > .4 ? 'ELE VOLTA ONDE COMEU ELE VOLTA ONDE COMEU' : src;
          line = [...line].map(ch => random() < k * .5 ? junk[Math.floor(random() * junk.length)] : ch).join('');
          const shift = random() < k * .4 ? Math.round((random() - .5) * 20) : 0;
          U.mono(ctx, line, TX + shift * 3, TY + (2 + row) * LH, {color: random() < k * .3 ? C('vermelho', 4) : C('fosforo', 5)});
        }
        if (random() < k * .5) { ctx.fillStyle = random() < .5 ? '#b5ffc630' : '#ff304018'; ctx.fillRect(GX, GY + random() * GH, GW, 6 + random() * 30); }
        if (Math.floor(t * 12) % 7 === 0) { ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#b5ffc6'; ctx.fillRect(GX, GY, GW, GH); ctx.restore(); }
        return;
      }
      st.mem.corrompido = true;
      text('ERRO DE LEITURA NO SETOR 0317', 0, 4, C('fosforo', 6));
      text('ARQUIVO CORROMPIDO.', 0, 6);
      if (Math.floor(t * 2) % 2) text('_', 0, 8);
    },
    open(st, file, sys) { st.file = file; st.scroll = 0; st.glitchSound = false; this.go(st, 'file'); sys.sfx(file.glitch ? 'beep' : 'tecla'); },
    submit(st, clue, sys) {
      if (plain(st.input) === plain(clue.data.senha)) { st.mem.logado = true; st.msg = ''; sys.sfx('beep'); this.go(st, 'shell'); sys.toast('ACESSO LIBERADO', clue.name, 'computador'); sys.emit('change'); }
      else { st.errors++; st.input = ''; st.msg = `SENHA INCORRETA  (${st.errors})`; sys.sfx('erro'); }
    },
    action(id, st, clue, sys, info) {
      const files = parseFiles(clue.data.arquivos), dirs = folders(files);
      if (id === 'energia') {
        if (st.screen === 'off') { st.mem.ligado = true; this.go(st, 'boot'); st.beeped = false; sys.sfx('boot'); }
        else if (st.screen !== 'shutdown') { st.mem.ligado = false; this.go(st, 'shutdown'); sys.sfx('desligar'); }
        return;
      }
      if (id === 'ligar' && st.screen === 'off') { st.mem.ligado = true; this.go(st, 'boot'); st.beeped = false; sys.sfx('boot'); }
      if (id === 'entrar') this.submit(st, clue, sys);
      if (id === 'pasta') { st.row = info.data; st.col = 0; st.fileRow = 0; sys.sfx('tecla'); }
      if (id === 'arquivo') { const inDir = files.filter(f => f.folder === dirs[st.row]); st.fileRow = info.data; st.col = 1; if (inDir[info.data]) this.open(st, inDir[info.data], sys); }
      if (id === 'voltar') this.go(st, 'shell');
      if (id === 'desligar') { st.mem.ligado = false; this.go(st, 'shutdown'); sys.sfx('desligar'); }
    },
    wheel(delta, st) { if (st.screen === 'file') st.scroll = clamp(st.scroll + Math.sign(delta), 0, st.maxScroll || 0); },
    key(e, st, clue, sys) {
      const files = parseFiles(clue.data.arquivos), dirs = folders(files);
      if (st.screen === 'login') {
        if (e.key === 'Enter') { this.submit(st, clue, sys); return true; }
        if (e.key === 'Backspace') { st.input = st.input.slice(0, -1); sys.sfx('tecla'); return true; }
        if (e.key && e.key.length === 1 && st.input.length < 18) { st.input += e.key; st.msg = ''; sys.sfx('tecla'); return true; }
        return e.key !== 'Escape';
      }
      if (st.screen === 'shell') {
        const inDir = files.filter(f => f.folder === dirs[st.row]);
        if (e.key === 'ArrowDown') { if (st.col === 0) { st.row = Math.min(dirs.length - 1, st.row + 1); st.fileRow = 0; } else st.fileRow = Math.min(inDir.length - 1, st.fileRow + 1); sys.sfx('tecla'); return true; }
        if (e.key === 'ArrowUp') { if (st.col === 0) { st.row = Math.max(0, st.row - 1); st.fileRow = 0; } else st.fileRow = Math.max(0, st.fileRow - 1); sys.sfx('tecla'); return true; }
        if (e.key === 'ArrowRight' || e.key === 'Tab') { st.col = inDir.length ? 1 : 0; return true; }
        if (e.key === 'ArrowLeft') { st.col = 0; return true; }
        if (e.key === 'Enter') { if (st.col === 0) st.col = inDir.length ? 1 : 0; else if (inDir[st.fileRow]) this.open(st, inDir[st.fileRow], sys); return true; }
        return false;
      }
      if (st.screen === 'file') {
        if (e.key === 'Escape' || e.key === 'Backspace') { if (!st.file.glitch || st.t > 3.4) this.go(st, 'shell'); return true; }
        if (e.key === 'ArrowDown') { st.scroll = Math.min(st.maxScroll || 0, st.scroll + 1); return true; }
        if (e.key === 'ArrowUp') { st.scroll = Math.max(0, st.scroll - 1); return true; }
        return true;
      }
      if (st.screen === 'boot') {
        // Type-ahead, like a real terminal: what is typed while it boots waits for the prompt.
        if (e.key === 'Enter') { st.t = 99; return true; }
        if (e.key === 'Backspace') { st.input = st.input.slice(0, -1); return true; }
        if (e.key?.length === 1 && st.input.length < 18) { st.input += e.key; sys.sfx('tecla'); return true; }
        return e.key !== 'Escape';
      }
      return false;
    }
  });
  root.PistaComputador = {parseFiles};
})(typeof window !== 'undefined' ? window : globalThis);
