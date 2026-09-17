/* Computador do Jorge — um desktop de escritor: o papel de parede é a capa
   do livro, e na área de trabalho estão as pastas da investigação.

   PUBLISHER   os e-mails com a editora (ler um deles mexe na CAM 04)
   GRÁFICAS    a anotação digitalizada de Jorge e a lista das três gráficas
   LIVRO       MANUSCRITO_FINAL_REAL.docx e BACKUP_ANTIGO_2019.docx — a frase
               adulterada já está nos dois, e o histórico de versões jura que
               ela sempre esteve lá
   Lixeira     um rascunho que Jorge não mandou

   Janelas empilhadas: clique no ícone, clique no arquivo; o X ou Esc fecha
   a janela de cima. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, Caso = root.JorgeCaso;
  const {SW, SH} = U, {C, art} = Caso;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GX = 20, GY = 34, GW = 440, GH = 214;              // the glass
  const BAR = 14;                                          // taskbar

  /* ------------------------------------------------------------ content */
  const DEFAULT_EMAILS = [
    '05/04/2026 | Frase diferente na nova tiragem | Jorge (enviado)',
    'Oi. Na nova impressão, a página 113 tem uma frase que eu não escrevi: “Ele ergueu os olhos. O céu estava faminto.” No meu livro está “Ele ergueu os olhos para o céu.” Podem conferir o arquivo que foi para a gráfica?',
    '---',
    '08/04/2026 | Re: Frase diferente na nova tiragem | Publisher · Editorial',
    'Jorge, identificamos inconsistências menores entre o manuscrito enviado e os arquivos enviados para impressão. Estamos verificando.\n\nAtenciosamente,\nDepartamento Editorial',
    '---',
    '22/04/2026 | Re: Re: Frase diferente | Publisher · Editorial',
    'Jorge,\n\nNão encontramos nenhuma alteração registrada em nosso sistema.\n\nDepartamento Editorial',
    '---',
    '06/05/2026 | Verificação concluída | Publisher · Editorial',
    'Jorge,\n\nOs arquivos enviados para impressão possuem a mesma assinatura digital dos arquivos originais.\n\nConsideramos o assunto encerrado.\n\nDepartamento Editorial',
    '---',
    '02/09/2026 | Contato com as gráficas | Publisher · Jurídico',
    'Jorge, recomendamos novamente que pare de entrar em contato diretamente com nossas gráficas parceiras.\n\nDepartamento Jurídico'
  ].join('\n');
  const DEFAULT_NOTE = 'MESMA ALTERAÇÃO\n3 GRÁFICAS\n3 SERVIDORES DIFERENTES\nNENHUMA REVISÃO REGISTRADA\n\nNão está entrando na gráfica.\n\nEstá chegando antes.';
  const DEFAULT_GRAFICAS = 'GRÁFICAS DA NOVA TIRAGEM\n\nGráfica Aurora ...... servidor próprio\nGráfica Paralelo .... servidor alugado\nGráfica Norte ....... servidor da cooperativa\n\nRevisões registradas: nenhuma\nArquivo recebido: idêntico nas três\nFrase da p. 113: alterada nas três';
  const DEFAULT_RASCUNHO = 'Eu sei o que eu escrevi.\nEu lembro de cada vírgula daquela página.\n\nVocês podem comparar assinaturas digitais o quanto quiserem.\n\n(não enviado)';
  const DEFAULTS = {
    emails: DEFAULT_EMAILS, anotacao: DEFAULT_NOTE, graficas: DEFAULT_GRAFICAS, lixeira: DEFAULT_RASCUNHO,
    nome: 'JORGE-PC', usuario: 'JORGE',
    pastas: 'PUBLISHER\nGRÁFICAS\nLIVRO\nLixeira',
    arquivos: 'anotacao_graficas.jpg | 15/08/2026 | 812 KB\ngraficas.txt | 14/08/2026 | 1 KB\nMANUSCRITO_FINAL_REAL.docx | 19/11/2019 | 1,2 MB\nBACKUP_ANTIGO_2019.docx | 19/11/2019 | 1,2 MB\nrascunho_resposta.txt | 03/09/2026 | 1 KB',
    criado: '03/02/2017 02:14', backup: '19/11/2019 23:58',
    versoes: '37 | 1',
    historicoManuscrito: 'v37 - 19/11/2019\nv36 - 02/11/2019\nv1 - 03/02/2017',
    historicoBackup: 'v1 - 19/11/2019',
    busca: 'O céu estava faminto',
    encontrada: 'encontrada em {n} de {n}',
    historico: 'Nenhuma alteração.\nNenhum usuário desconhecido.\nNenhuma modificação.',
    status: 'Página 113 de 302 · 86.412 palavras',
    dica: 'A frase está aqui. Ele jurava que tinha conferido este arquivo.',
    semEnergia: 'SEM ENERGIA',
    avisoPublisher: 'A Publisher não acha alteração',
    avisoGraficas: 'Três gráficas, a mesma alteração',
    avisoManuscrito: 'A frase já está no arquivo original'
  };
  const field = (d, k) => (typeof d[k] === 'string' ? d[k] : DEFAULTS[k]);
  const row = (d, k, i) => Caso.lines(field(d, k))[i] ?? Caso.lines(DEFAULTS[k])[i] ?? '';
  function parseEmails(text) {
    return String(text || '').split(/\n\s*---\s*\n?/).map(block => {
      const lines = block.replace(/^\n+/, '').split('\n');
      const [date = '', subject = '', from = ''] = (lines.shift() || '').split('|').map(s => s.trim());
      return {date, subject, from, body: lines.join('\n').trim()};
    }).filter(m => m.subject);
  }
  /* The four places on the desktop. The keys stay the same; names, files,
     dates and sizes come from the fields. */
  function folders(d) {
    const file = i => { const [name, date = '', size = ''] = Caso.pipes(row(d, 'arquivos', i)); return {name: name || Caso.pipes(Caso.lines(DEFAULTS.arquivos)[i])[0], date, size}; };
    const versions = Caso.pipes(field(d, 'versoes')).map(v => Math.max(1, parseInt(v, 10) || 1));
    return {
      PUBLISHER: {icon: 'mail', label: row(d, 'pastas', 0), files: parseEmails(field(d, 'emails')).map((m, i) => ({kind: 'mail', index: i, name: m.subject, date: m.date, size: '4 KB'}))},
      'GRÁFICAS': {icon: 'pasta', label: row(d, 'pastas', 1), files: [
        {kind: 'img', ...file(0)},
        {kind: 'txt', ...file(1), text: field(d, 'graficas')}]},
      LIVRO: {icon: 'pasta', label: row(d, 'pastas', 2), files: [
        {kind: 'doc', ...file(2), created: field(d, 'criado'), versions: versions[0] || 37, history: field(d, 'historicoManuscrito')},
        {kind: 'doc', ...file(3), created: field(d, 'backup'), versions: versions[1] || 1, history: field(d, 'historicoBackup')}]},
      Lixeira: {icon: 'lixeira', label: row(d, 'pastas', 3), files: [{kind: 'txt', ...file(4), text: field(d, 'lixeira')}]}
    };
  }

  /* ------------------------------------------------------------ art */
  function bezelArt(name) {
    return art('pc:moldura:' + name, 240, 124, b => {
      b.rect(0, 0, 240, 124, 'carvao', 2);
      b.hline(0, 239, 0, 'carvao', 4); b.vline(239, 0, 123, 'carvao', 3); b.hline(0, 239, 123, 'carvao', 0); b.vline(0, 0, 123, 'carvao', 1);
      b.inset(8, 4, 224, 109, 'carvao', 1, 3, 0);
      b.erase(GX / 2, (GY - 22) / 2, GW / 2, GH / 2);
      b.text(120, 116, Caso.tiny(name), 'carvao', 4, {font: '3x5', align: 'center'});
      b.rect(222, 117, 3, 2, 'verde', 5, K.EMISSIVE);
      for (let x = 20; x < 60; x += 3) b.px(x, 118, 'carvao', 0);
    });
  }
  function wallpaperArt(title) {
    return art('pc:papel-de-parede:' + title, GW / 2, GH / 2, b => {
      const W = GW / 2, H = GH / 2;
      b.vgrad(0, 0, W, H - 20, 'ceu', 1, 3.6);
      for (let i = 0; i < 70; i++) { const r = K.hash2(i, 1, 4), q = K.hash2(i, 2, 4); b.px(Math.floor(r * W), Math.floor(q * (H - 34)), 'papel', q < .3 ? 5 : 3); }
      b.ellipse(W - 40, 22, 9, 9, 'papel', 5); b.ellipse(W - 36, 19, 8, 8, 'ceu', 1);
      for (let x = 0; x < W; x++) { const top = H - 34 + Math.round(Math.sin(x / 19) * 4 + Math.sin(x / 7) * 1.2 + (x - W / 2) * (x - W / 2) * .0004); b.vline(x, top, H - 1, 'carvao', 1); }
      const fx = 70, fy = H - 44;
      b.vline(fx, fy + 2, fy + 9, 'carvao', 0); b.rect(fx - 1, fy, 3, 3, 'carvao', 0); b.px(fx - 1, fy + 4, 'carvao', 0); b.px(fx + 1, fy + 3, 'carvao', 0); b.line(fx, fy + 9, fx - 2, fy + 12, 'carvao', 0); b.line(fx, fy + 9, fx + 2, fy + 12, 'carvao', 0);
      b.text(W - 12, H - 24, title, 'ouro', 3, {font: '3x5', align: 'right'});
    });
  }
  const ICON_PAINT = {
    pasta(b) { b.rect(1, 4, 9, 3, 'amarelo', 3); b.rect(1, 6, 18, 12, 'amarelo', 3); b.hline(1, 18, 6, 'amarelo', 5); b.hline(1, 18, 17, 'amarelo', 1); b.rect(2, 8, 16, 1, 'amarelo', 4); },
    mail(b) { this.pasta(b); b.rect(6, 9, 10, 7, 'papel', 5); b.line(6, 9, 11, 13, 'papel', 2); b.line(15, 9, 11, 13, 'papel', 2); },
    lixeira(b) { b.rect(4, 6, 12, 12, 'metal', 3); b.hline(3, 16, 5, 'metal', 5); b.rect(8, 3, 4, 2, 'metal', 4); for (let x = 6; x < 15; x += 3) b.vline(x, 8, 16, 'metal', 1); b.rect(6, 4, 8, 2, 'papel', 5); },
    doc(b) { b.rect(4, 1, 12, 17, 'papel', 5); b.rect(4, 1, 12, 17, 'papel', 5); b.hline(4, 15, 1, 'papel', 6); for (let y = 5; y < 16; y += 2) b.hline(6, 13, y, 'tinta', 3); b.rect(4, 13, 5, 5, 'tela', 3); },
    img(b) { b.rect(2, 3, 16, 13, 'papel', 5); b.rect(3, 4, 14, 11, 'azul', 2); b.poly([[3, 14], [8, 8], [13, 14]], 'verde', 3); b.px(13, 6, 'amarelo', 5); },
    txt(b) { b.rect(4, 1, 12, 17, 'branco', 4); for (let y = 4; y < 16; y += 2) b.hline(6, 13, y, 'grafite', 2); },
    mailItem(b) { b.rect(1, 3, 16, 11, 'papel', 5); b.frame(1, 3, 16, 11, 'papel', 2); b.line(1, 3, 9, 9, 'papel', 2); b.line(16, 3, 9, 9, 'papel', 2); }
  };
  const icon = (name, dim = '') => art('pc:icone:' + name + dim, 20, 20, b => { ICON_PAINT[name].call(ICON_PAINT, b); if (dim) b.shade(0, 0, 20, 20, -1); });
  function noteArt(text) {
    return art('pc:anotacao:' + text.length + ':' + text.slice(0, 12), 150, 86, b => {
      b.rect(0, 0, 150, 86, 'papel', 4);
      for (let y = 8; y < 86; y += 6) b.hline(0, 149, y, 'azul', 4);
      b.vline(14, 0, 85, 'vermelho', 4);
      for (let i = 0; i < 5; i++) b.ellipse(6, 10 + i * 17, 2, 2, 'carvao', 1);
      b.speckle(0, 0, 150, 86, 'papel', 3, .03, K.rng(5));
      b.shadeFn(0, 0, 150, 86, (x, y) => (x > 140 ? -(x - 140) / 6 : 0) + (y < 3 ? -1 : 0));
    });
  }

  /* ------------------------------------------------------------ chrome */
  function windowFrame(ctx, ui, w, title, active) {
    const {x, y, width, height} = w;
    U.rect(ctx, x + 4, y + 4, width, height, '#02030a88');
    U.rect(ctx, x, y, width, height, C('papel', 4));
    U.rect(ctx, x, y, width, 14, active ? C('tela', 2) : C('grafite', 1));
    U.rect(ctx, x, y, width, 1, active ? C('tela', 3) : C('grafite', 2));
    U.rect(ctx, x, y + 13, width, 1, C('carvao', 1));
    U.outline(ctx, x, y, width, height, C('carvao', 1), 1);
    K.drawText(ctx, title, x + 6, y + 4, {color: active ? '#e8f4ff' : C('papel', 2)});
    const cx = x + width - 14, hot = active && ui.region('fecharJanela', cx - 2, y, 16, 14);
    U.rect(ctx, cx, y + 2, 11, 10, hot ? C('vermelho', 4) : C('vermelho', 2));
    ctx.fillStyle = '#ffe8e0';
    for (let i = 0; i < 4; i++) { ctx.fillRect(cx + 3 + i, y + 4 + i, 1, 1); ctx.fillRect(cx + 6 - i, y + 4 + i, 1, 1); ctx.fillRect(cx + 4 + i, y + 4 + i, 1, 1); ctx.fillRect(cx + 7 - i, y + 4 + i, 1, 1); }
  }
  // The small 3×5 font has no parentheses nor middle dot.
  const small = str => String(str).replace(/·/g, '-').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  const text = (ctx, str, x, y, color = C('tinta', 1), opts = {}) => K.drawText(ctx, opts.font === '3x5' ? small(str) : str, x, y, {color, ...opts});
  function clip(str, width, font = '5x7') {
    str = String(str);
    if (K.measure(str, font) <= width) return str;
    while (str.length > 1 && K.measure(str + '...', font) > width) str = str.slice(0, -1);
    return str + '...';
  }

  /* ------------------------------------------------------------ type */
  ClueTypes.register('pc', {
    label: 'Computador do escritor', icon: 'computador', sound: 'boot',
    fields: [
      {id: 'nome', label: 'Nome do computador (tela de início e moldura)', kind: 'text'},
      {id: 'usuario', label: 'Usuário na barra de tarefas', kind: 'text'},
      {id: 'pastas', label: 'Nomes das pastas (4 linhas: e-mails, gráficas, livro, lixeira)', kind: 'textarea', rows: 4},
      {id: 'emails', label: 'E-mails (DATA | ASSUNTO | REMETENTE, depois o texto; --- entre e-mails; “enviado” no remetente = e-mail do próprio Jorge)', kind: 'textarea', rows: 10},
      {id: 'arquivos', label: 'Arquivos (NOME | DATA | TAMANHO, 5 linhas: imagem, texto e manuscrito da pasta das gráficas e do livro, backup, rascunho da lixeira)', kind: 'textarea', rows: 5},
      {id: 'anotacao', label: 'Anotação digitalizada (a última linha vem circulada)', kind: 'textarea', rows: 6},
      {id: 'graficas', label: 'Arquivo de texto da pasta das gráficas', kind: 'textarea', rows: 5},
      {id: 'lixeira', label: 'Rascunho na lixeira', kind: 'textarea', rows: 5},
      {id: 'criado', label: 'Manuscrito: criado em', kind: 'text'},
      {id: 'backup', label: 'Backup: criado em', kind: 'text'},
      {id: 'versoes', label: 'Número de versões (manuscrito | backup)', kind: 'text'},
      {id: 'historicoManuscrito', label: 'HISTÓRICO do manuscrito (uma versão por linha)', kind: 'textarea', rows: 3},
      {id: 'historicoBackup', label: 'HISTÓRICO do backup (uma versão por linha)', kind: 'textarea', rows: 2},
      {id: 'busca', label: 'Trecho procurado no HISTÓRICO', kind: 'text'},
      {id: 'encontrada', label: 'Resultado da busca ({n} = número de versões)', kind: 'text'},
      {id: 'historico', label: 'Conclusão do HISTÓRICO (uma frase por linha)', kind: 'textarea', rows: 3},
      {id: 'status', label: 'Barra de status do documento', kind: 'text'},
      {id: 'dica', label: 'Texto ao lado do documento', kind: 'text'},
      {id: 'semEnergia', label: 'Tela quando falta energia', kind: 'text'},
      {id: 'avisoPublisher', label: 'Aviso DESCOBERTA ao ler um e-mail da editora', kind: 'text'},
      {id: 'avisoGraficas', label: 'Aviso DESCOBERTA ao ver a anotação', kind: 'text'},
      {id: 'avisoManuscrito', label: 'Aviso DESCOBERTA ao abrir o manuscrito', kind: 'text'}],
    defaults: {...DEFAULTS},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      mem.lidos ??= {};
      return {mem, windows: [], t: 0, boot: mem.ligado ? 1 : 0};
    },
    top: st => st.windows[st.windows.length - 1] || null,
    open(st, win, sys) {
      const n = st.windows.length;
      st.windows.push({x: 84 + n * 12, y: 42 + n * 8, width: 364 - n * 8, height: 186 - n * 6, t: 0, scroll: 0, sel: 0, panel: null, ...win});
      Caso.sfx(sys, 'pagina');
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, dt = ui.dt;
      st.t += dt; st.boot = Math.min(1, st.boot + dt / .9);
      if (st.boot >= 1 && !st.mem.ligado) { st.mem.ligado = true; }
      const off = sys.stage.scene?.props.some(p => p.id === 'pc') && (!sys.hasProp('pc') || sys.stage.activeLayers?.()?.preset?.pcOff);
      if (off) {
        st.boot = 0;
        U.rect(ctx, GX, GY, GW, GH, '#020306');
        for (let i = 0; i < 30; i++) U.rect(ctx, GX + 40 + i * 2, GY + 20 + i, 2, 50 - i, '#ffffff08');
        U.blit(ctx, bezelArt(field(d, 'nome')), 0, 22);
        if (sys.stage.activeLayers?.()?.preset?.pcOff) K.drawText(ctx, field(d, 'semEnergia'), SW / 2, GY + GH / 2 - 4, {color: '#6b7a8c', align: 'center'});
        else ui.button(ctx, 'ligarPC', SW / 2 - 50, GY + GH / 2 - 10, 100, 20, 'LIGAR', {style: 'roxo'});
        U.header(ctx, ui, clue.name, 'desligado', 'computador');
        return;
      }
      ctx.save(); ctx.beginPath(); ctx.rect(GX, GY, GW, GH); ctx.clip();
      U.blit(ctx, wallpaperArt(Caso.tiny(Caso.book(sys).subtitulo)), GX, GY);
      if (st.boot < 1) {
        U.rect(ctx, GX, GY, GW, GH, '#02040c');
        text(ctx, field(d, 'nome'), SW / 2, GY + 90, '#9fb6d9', {align: 'center'});
        U.rect(ctx, SW / 2 - 40, GY + 106, 80, 4, C('carvao', 3)); U.rect(ctx, SW / 2 - 40, GY + 106, Math.round(80 * st.boot), 4, C('tela', 4));
      } else {
        const F = folders(d);
        // Desktop icons.
        Object.entries(F).forEach(([id, f], i) => {
          const x = GX + 10, y = GY + 10 + i * 46, hot = !st.windows.length && ui.region('pasta', x - 4, y - 2, 60, 42, {data: id}) || ui.hover === 'pasta' && ui.hoverData === id;
          if (hot) U.rect(ctx, x - 4, y - 2, 60, 42, '#6fb0e033');
          U.blit(ctx, icon(f.icon), x + 12, y);
          text(ctx, f.label, x + 26, y + 30, '#eef6ff', {align: 'center', shadow: {color: '#02030a', dx: 1, dy: 1}});
          if (st.windows.length) ui.region('pasta', x - 4, y - 2, 60, 42, {data: id});
        });
        st.windows.forEach((w, i) => this.drawWindow(ctx, ui, st, w, i === st.windows.length - 1, clue, sys, F));
        // Taskbar.
        U.rect(ctx, GX, GY + GH - BAR, GW, BAR, C('carvao', 2)); U.rect(ctx, GX, GY + GH - BAR, GW, 1, C('carvao', 4));
        text(ctx, clip(field(d, 'usuario'), 40), GX + 8, GY + GH - 10, '#9fd0ff');
        st.windows.forEach((w, i) => { const bx = GX + 50 + i * 86; U.rect(ctx, bx, GY + GH - 12, 82, 10, i === st.windows.length - 1 ? C('tela', 2) : C('carvao', 3)); text(ctx, clip(w.title, 76, '3x5'), bx + 3, GY + GH - 10, '#dfe8f0', {font: '3x5'}); });
        const [hh, mm] = String(sys.stage.clock || '00:00').split(':').map(Number);
        const minutes = (hh * 60 + mm + Math.floor((sys.stage.time - (sys.stage.clockSetAt || 0)) / 60)) % 1440;
        text(ctx, String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'), GX + GW - 8, GY + GH - 10, '#dfe8f0', {align: 'right'});
      }
      // LCD glare.
      ctx.fillStyle = '#ffffff08'; for (let i = 0; i < 40; i++) ctx.fillRect(GX + 300 + i * 2, GY, 2, GH);
      ctx.restore();
      U.blit(ctx, bezelArt(field(d, 'nome')), 0, 22);
      const top = this.top(st);
      U.header(ctx, ui, clue.name, top ? `${top.title} · Esc fecha a janela` : 'clique numa pasta', 'computador');
    },
    drawWindow(ctx, ui, st, w, active, clue, sys, F) {
      w.t += ui.dt;
      windowFrame(ctx, ui, w, w.title, active);
      const x = w.x, y = w.y + 14, width = w.width, height = w.height - 14;
      if (active) ui.region('janela', w.x, w.y, w.width, w.height, {cursor: 'default', silent: true});
      if (w.kind === 'pasta') this.folderView(ctx, ui, st, w, active, F, x, y, width, height);
      else if (w.kind === 'mail') this.mailView(ctx, ui, st, w, active, clue, sys, x, y, width, height);
      else if (w.kind === 'doc') this.docView(ctx, ui, st, w, active, clue, sys, x, y, width, height);
      else if (w.kind === 'img') this.imgView(ctx, ui, st, w, active, clue, sys, x, y, width, height);
      else this.txtView(ctx, ui, st, w, active, x, y, width, height);
    },
    folderView(ctx, ui, st, w, active, F, x, y, width, height) {
      const f = F[w.folder];
      U.rect(ctx, x + 1, y, width - 2, 12, C('papel', 3));
      text(ctx, 'Nome', x + 26, y + 3, C('grafite', 2), {font: '3x5'}); text(ctx, 'Modificado', x + width - 110, y + 3, C('grafite', 2), {font: '3x5'}); text(ctx, 'Tamanho', x + width - 44, y + 3, C('grafite', 2), {font: '3x5'});
      f.files.forEach((file, i) => {
        const ry = y + 16 + i * 20, hot = active && ui.region('arquivo', x + 2, ry - 2, width - 4, 19, {data: i});
        if (hot) U.rect(ctx, x + 2, ry - 2, width - 4, 19, C('tela', 4));
        U.blit(ctx, icon(file.kind === 'mail' ? 'mailItem' : file.kind), x + 6, ry - 3, 1);
        text(ctx, clip(file.name, width - 170), x + 28, ry + 3, hot ? '#02040c' : C('tinta', 1));
        text(ctx, file.date, x + width - 110, ry + 3, C('grafite', 2));
        text(ctx, file.size, x + width - 44, ry + 3, C('grafite', 2));
      });
      if (!f.files.length) text(ctx, 'Esta pasta está vazia.', x + width / 2, y + 60, C('grafite', 2), {align: 'center'});
    },
    mailView(ctx, ui, st, w, active, clue, sys, x, y, width, height) {
      const mails = parseEmails(field(clue.data, 'emails')), LW = 132;
      U.rect(ctx, x + 1, y, LW, height - 1, C('papel', 3));
      mails.forEach((m, i) => {
        const ry = y + 2 + i * 26, sel = w.sel === i, hot = active && ui.region('email', x + 2, ry, LW - 2, 25, {data: i});
        U.rect(ctx, x + 2, ry, LW - 2, 25, sel ? C('tela', 3) : hot ? C('papel', 5) : C('papel', 3));
        U.rect(ctx, x + 2, ry + 25, LW - 2, 1, C('papel', 2));
        const unread = !st.mem.lidos[i] && !m.from.includes('enviado');
        if (unread) U.rect(ctx, x + 5, ry + 5, 3, 3, C('tela', 4));
        text(ctx, clip(m.from, LW - 16, '3x5'), x + 11, ry + 3, sel ? '#dbe9ff' : C('grafite', 2), {font: '3x5'});
        text(ctx, clip(m.subject, LW - 14), x + 11, ry + 10, sel ? '#ffffff' : C('tinta', 1));
        text(ctx, m.date, x + LW - 4, ry + 18, sel ? '#b9d4ff' : C('grafite', 3), {font: '3x5', align: 'right'});
      });
      const m = mails[w.sel];
      if (!m) return;
      const MX = x + LW + 10, MW = width - LW - 20;
      text(ctx, clip(m.subject, MW), MX, y + 6, C('tinta', 1), {});
      text(ctx, 'De: ' + m.from, MX, y + 18, C('grafite', 2), {font: '3x5'});
      text(ctx, 'Data: ' + m.date, MX, y + 25, C('grafite', 2), {font: '3x5'});
      U.rect(ctx, MX, y + 33, MW, 1, C('papel', 2));
      const lines = K.wrap(m.body, MW), rows = Math.floor((height - 44) / 10);
      w.max = Math.max(0, lines.length - rows); w.scroll = clamp(w.scroll, 0, w.max);
      lines.slice(w.scroll, w.scroll + rows).forEach((line, i) => text(ctx, line, MX, y + 39 + i * 10));
      if (!st.mem.lidos[w.sel] && w.readT !== undefined) {
        w.readT += ui.dt;
        if (w.readT > .6) {
          st.mem.lidos[w.sel] = Date.now();
          if (!m.from.includes('enviado')) { Caso.discover(sys, 'publisher', {text: field(clue.data, 'avisoPublisher')}); Caso.trigger(sys, 'publisher'); }
          sys.emit('change');
        }
      }
    },
    docView(ctx, ui, st, w, active, clue, sys, x, y, width, height) {
      const file = w.file, livro = Caso.book(sys);
      // Toolbar.
      U.rect(ctx, x + 1, y, width - 2, 13, C('papel', 3));
      ['B', 'I', 'U'].forEach((ch, i) => { U.rect(ctx, x + 6 + i * 13, y + 2, 11, 9, C('papel', 5)); text(ctx, ch, x + 9 + i * 13, y + 3, C('carvao', 2)); });
      text(ctx, 'Times 12', x + 50, y + 3, C('grafite', 2), {font: '3x5'});
      // The page.
      const PX = x + 8, PY = y + 16, PW = 206, PH = height - 30;
      U.rect(ctx, x + 1, y + 13, width - 2, height - 14, C('grafite', 3));
      U.rect(ctx, PX + 2, PY + 2, PW, PH, '#00000033');
      U.rect(ctx, PX, PY, PW, PH, '#fbfbf6');
      const d = clue.data, p = Caso.page(Caso.pageNumber(livro, 'frase'), {alterada: true, livro});
      const lines = Caso.layout(p.text, PW - 20);
      let ty = PY + 8;
      const found = [];
      for (const line of lines) {
        if (!line.text) { ty += 5; continue; }
        if (ty > PY + PH - 12) break;
        text(ctx, line.text, PX + 10, ty, '#1b1b22');
        for (const m of p.marks) {
          const a = Math.max(m.start, line.start), bEnd = Math.min(m.end, line.start + line.text.length);
          if (bEnd > a) found.push([PX + 10 + K.measure(line.text.slice(0, a - line.start)), ty, K.measure(line.text.slice(a - line.start, bEnd - line.start))]);
        }
        ty += 10;
      }
      if (w.panel === 'historico') for (const [fx, fy, fw] of found) { ctx.save(); ctx.globalAlpha = .35; U.rect(ctx, fx - 1, fy - 1, fw + 2, 9, C('amarelo', 4)); ctx.restore(); }
      // Status bar.
      U.rect(ctx, x + 1, y + height - 12, width - 2, 11, C('papel', 3));
      text(ctx, field(d, 'status'), x + 6, y + height - 9, C('grafite', 2), {font: '3x5'});
      // Side panel.
      const SX = PX + PW + 8, SWd = width - (SX - x) - 6;
      ui.button(ctx, 'painel:props', SX, y + 17, SWd, 14, 'PROPRIEDADES', {style: w.panel === 'props' ? 'roxo' : 'papel'});
      ui.button(ctx, 'painel:historico', SX, y + 35, SWd, 14, 'HISTÓRICO', {style: w.panel === 'historico' ? 'roxo' : 'papel'});
      const py = y + 56;
      // A light pane under the two buttons, so the small print reads.
      U.rect(ctx, SX - 3, py - 4, SWd + 6, y + height - 16 - (py - 4), C('papel', 4));
      if (w.panel === 'props') {
        const rows = [['Criado em', file.created], ['Modificado', file.date], ['Autor', livro.autor], ['Tamanho', file.size], ['Versões', String(file.versions)]];
        rows.forEach(([k, v], i) => { text(ctx, k, SX, py + i * 18, C('grafite', 2), {font: '3x5'}); text(ctx, clip(v, SWd), SX, py + 7 + i * 18, C('tinta', 1)); });
      } else if (w.panel === 'historico') {
        const n = file.versions;
        text(ctx, 'procurar:', SX, py, C('grafite', 2), {font: '3x5'});
        U.rect(ctx, SX, py + 7, SWd, 11, '#ffffff'); U.outline(ctx, SX, py + 7, SWd, 11, C('grafite', 3), 1);
        const search = field(d, 'busca').trim();
        if (search) text(ctx, clip(`"${search}"`, SWd - 4), SX + 2, py + 9, C('tinta', 1));
        text(ctx, clip(Caso.fill(field(d, 'encontrada'), {n}), SWd), SX, py + 24, C('vermelho', 3));
        const list = Caso.lines(file.history).filter(Boolean).slice(0, 6);
        list.forEach((row, i) => { U.rect(ctx, SX, py + 34 + i * 10, SWd, 9, i % 2 ? C('papel', 5) : C('papel', 3)); text(ctx, clip(row, SWd - 4, '3x5'), SX + 2, py + 36 + i * 10, C('tinta', 1), {font: '3x5'}); });
        const yy = py + 38 + list.length * 10;
        let ly = yy;
        for (const s of Caso.lines(field(d, 'historico')).filter(Boolean)) for (const line of K.wrap(small(s), SWd, '3x5')) { text(ctx, line, SX, ly, C('grafite', 1), {font: '3x5'}); ly += 7; }
      } else {
        K.wrap(field(d, 'dica'), SWd).forEach((line, i) => text(ctx, line, SX, py + i * 10, C('grafite', 2)));
      }
      w.seen = (w.seen || 0) + ui.dt;
      if (w.seen > 1.2 && !st.mem['doc:' + file.name]) { st.mem['doc:' + file.name] = Date.now(); Caso.discover(sys, 'manuscrito', {text: field(d, 'avisoManuscrito')}); sys.emit('change'); }
    },
    imgView(ctx, ui, st, w, active, clue, sys, x, y, width, height) {
      U.rect(ctx, x + 1, y, width - 2, height - 1, C('carvao', 2));
      const nx = x + Math.round((width - 300) / 2), ny = y + 4;
      U.blit(ctx, noteArt(field(clue.data, 'anotacao')), nx, ny);
      const lines = String(field(clue.data, 'anotacao')).split('\n');
      // Rules every 12 px from ny + 16: each line's feet rest just above one.
      let ty = ny + 9, last = null;
      lines.forEach((line, i) => {
        if (!line.trim()) { ty += 12; return; }
        const caps = line === line.toUpperCase();
        U.hand(ctx, line, nx + 36, ty, {color: caps ? C('carvao', 2) : C('tinta', 2), width: 260, seed: 11 + i});
        last = {line, y: ty};
        ty += 12;
      });
      if (last) {
        // The last line circled over and over.
        const cx = nx + 36 + K.measure(last.line) / 2 + 3, cy = last.y + 4, rx = K.measure(last.line) / 2 + 12, ry = 10;
        ctx.fillStyle = C('vermelho', 3);
        for (let loop = 0; loop < 4; loop++) for (let a = 0; a < 140; a++) {
          const t = a / 140 * Math.PI * 2 + loop * .7, wob = 1 + Math.sin(t * 3 + loop) * .06 + loop * .05;
          ctx.fillRect(Math.round(cx + Math.cos(t) * rx * wob), Math.round(cy + Math.sin(t) * ry * wob), 1, 1);
        }
      }
      w.seen = (w.seen || 0) + ui.dt;
      if (w.seen > 1.2 && !st.mem.anotacao) { st.mem.anotacao = Date.now(); Caso.discover(sys, 'graficas', {text: field(clue.data, 'avisoGraficas')}); sys.emit('change'); }
    },
    txtView(ctx, ui, st, w, active, x, y, width, height) {
      U.rect(ctx, x + 1, y, width - 2, height - 1, '#fdfdf8');
      const lines = U.wrapMono(w.file.text, Math.floor((width - 16) / 6));
      lines.slice(0, Math.floor((height - 8) / 10)).forEach((line, i) => U.mono(ctx, line, x + 8, y + 6 + i * 10, {color: '#1b1b22'}));
    },
    action(id, st, clue, sys, info) {
      const F = folders(clue.data), top = this.top(st);
      if (id === 'ligarPC') { sys.setProp('pc', true); st.boot = 0; sys.sfx('boot'); return; }
      if (id === 'fecharJanela') { st.windows.pop(); Caso.sfx(sys, 'camera'); return; }
      if (id === 'pasta') {
        const f = F[info.data];
        if (top && top.folder === info.data) return;
        st.windows = [];
        this.open(st, info.data === 'PUBLISHER' ? {kind: 'mail', folder: info.data, title: `${f.label} · e-mails`, sel: 0, readT: 0} : {kind: 'pasta', folder: info.data, title: f.label});
        return;
      }
      if (id === 'arquivo' && top?.kind === 'pasta') {
        const file = F[top.folder].files[info.data];
        if (!file) return;
        this.open(st, {kind: file.kind, file, title: file.name});
        return;
      }
      if (id === 'email' && top?.kind === 'mail') { top.sel = info.data; top.scroll = 0; top.readT = 0; sys.sfx('tecla'); return; }
      const m = /^painel:(\w+)$/.exec(id);
      if (m && top?.kind === 'doc') { top.panel = top.panel === m[1] ? null : m[1]; sys.sfx('clique'); }
    },
    wheel(delta, st) { const top = this.top(st); if (top?.kind === 'mail') top.scroll = clamp(top.scroll + Math.sign(delta), 0, top.max || 0); },
    key(e, st, clue, sys) {
      const top = this.top(st);
      if (e.key === 'Escape' && top) { st.windows.pop(); return true; }
      if (top?.kind === 'mail') {
        const n = parseEmails(field(clue.data, 'emails')).length;
        if (e.key === 'ArrowDown') { top.sel = Math.min(n - 1, top.sel + 1); top.readT = 0; top.scroll = 0; return true; }
        if (e.key === 'ArrowUp') { top.sel = Math.max(0, top.sel - 1); top.readT = 0; top.scroll = 0; return true; }
      }
      return false;
    },
    describe: st => ({windows: st.windows.map(w => w.title), lidos: Object.keys(st.mem.lidos).length})
  });
  root.PistaPC = {parseEmails, folders, DEFAULTS};
})(typeof window !== 'undefined' ? window : globalThis);
