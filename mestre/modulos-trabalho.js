/* Módulos de trabalho — escritório, sala administrativa, depósito e oficina.
   Mesmas medidas do kit (ver montador.js e modulos-estrutura.js): parede de
   62 linhas com o chão na linha 62, 1 linha ≈ 4,2 cm, mesa ≈ 20 linhas,
   armário alto ≈ 40, luz vindo de cima à direita. Tudo pintado em (rampa,
   nível): a cena acende e apaga depois, e o desgaste da sala (0–3) suja,
   enferruja e quebra as peças. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K, P = G.pincel;
  const CHAO = 61;                                   // última linha pintável da parede
  const MESA = 42;                                   // tampo de uma mesa de ~20 linhas

  /* ------------------------------------------------------------ opções comuns */
  const METAL_OU_MADEIRA = [['aco', 'Aço'], ['ferro_bege', 'Metal bege'], ['ferro_verde', 'Metal verde'], ['ferro_azul', 'Metal azul'],
    ['madeira', 'Madeira'], ['madeira_clara', 'Madeira clara'], ['madeira_escura', 'Madeira escura'], ['mdf', 'MDF branco']];
  const ehMadeira = r => r === 'mdf' || String(r).startsWith('madeira');

  /* ------------------------------------------------------------ tipo de interação que depende dos parâmetros
     O montador calcula a área clicável de cada objeto logo antes de ler
     `interacao.tipo`; a área guarda o objeto da vez e o tipo é lido dele. Sem
     objeto (listas, validadores) vale o tipo padrão. */
  function interacaoPorParametro(padrao, escolhe, dados, marca = 'discreta') {
    let atual = null;
    return {
      area: fn => o => { atual = o; return fn ? fn(o) : null; },
      interacao: {marca, get tipo() { return atual ? escolhe(atual) : padrao; }, dados: o => dados(o, escolhe(o))}
    };
  }

  /* ------------------------------------------------------------ desgaste */
  const semente = (o, i, sal) => hash2(i, sal, o.seed);
  /* Pintas de ferrugem (com escorrido a partir do desgaste 2). */
  function ferrugem(b, o, c, x, y, w, h, {min = 1, dens = 1} = {}) {
    const n = c.desgaste;
    if (n < min || w < 1 || h < 1) return;
    const qtd = Math.round(w * h / 70 * n * dens);
    for (let i = 0; i < qtd; i++) {
      const px = x + Math.floor(semente(o, i, 11) * w), py = y + Math.floor(semente(o, i, 12) * h);
      b.px(px, py, 'ferrugem', 2 + (semente(o, i, 13) > .5 ? 1 : 0));
      if (n >= 2 && semente(o, i, 14) > .55 && py + 1 < y + h) b.px(px, py + 1, 'ferrugem', 2);
      if (n >= 3 && semente(o, i, 15) > .6 && px + 1 < x + w) b.px(px + 1, py, 'ferrugem', 3);
    }
  }
  /* Riscos claros curtos (metal e plástico gastos). */
  function riscos(b, o, c, x, y, w, h, {min = 1} = {}) {
    if (c.desgaste < min || w < 4) return;
    for (let i = 0; i < c.desgaste * 2; i++) {
      const px = x + Math.floor(semente(o, i, 21) * (w - 3)), py = y + Math.floor(semente(o, i, 22) * h);
      b.shade(px, py, 2 + Math.floor(semente(o, i, 23) * 2), 1, 1);
    }
  }
  /* Encardido: manchas escuras em blocos de ~3 px. */
  function encardido(b, o, c, x, y, w, h, {forca = 1} = {}) {
    if (!c.desgaste) return;
    const lim = .8 - c.desgaste * .07 * forca;
    b.shadeFn(x, y, w, h, (xx, yy) => (G.valueNoise(xx / 2.6, yy / 2.6, o.seed + 5) > lim ? -1 : 0));
  }

  /* ------------------------------------------------------------ texto 3×5 com alguns glifos a mais (% ? , +) */
  const EXTRA3 = {'%': ['#.#', '..#', '.#.', '#..', '#.#'], '?': ['##.', '..#', '.#.', '...', '.#.'], ',': ['.', '.', '.', '#', '#'], '+': ['...', '.#.', '###', '.#.', '...'], '=': ['...', '###', '...', '###', '...']};
  const limpa3 = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function mede3(str) {
    let w = 0;
    for (const ch of limpa3(str)) w += ch === ' ' ? 3 : EXTRA3[ch] ? EXTRA3[ch][0].length + 1 : K.measure(ch, '3x5') + 1;
    return Math.max(0, w - 1);
  }
  function escreve3(b, x, y, str, ramp, lv, flags = 0) {
    let cx = x;
    for (const ch of limpa3(str)) {
      if (ch === ' ') { cx += 3; continue; }
      const g = EXTRA3[ch];
      if (g) { g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') b.px(cx + rx, y + ry, ramp, lv, flags); }); cx += g[0].length + 1; }
      else cx += b.text(cx, y, ch, ramp, lv, {font: '3x5', flags}) + 1;
    }
    return cx - x - 1;
  }
  /* Quebra em linhas que caibam na largura (palavras longas são cortadas). */
  function linhas3(str, largura, max) {
    const out = [];
    for (const palavra of limpa3(str).split(/\s+/).filter(Boolean)) {
      let pw = palavra;
      while (pw && mede3(pw) > largura) pw = pw.slice(0, -1);
      const tenta = out.length ? out[out.length - 1] + ' ' + pw : pw;
      if (out.length && mede3(tenta) <= largura) out[out.length - 1] = tenta; else out.push(pw);
    }
    return out.slice(0, max);
  }

  /* ------------------------------------------------------------ pequenos objetos */
  /* Caneca 3×3 com asa à esquerda; (x, y) = canto de cima. */
  function caneca(b, x, y, ramp = 'branco', lv = 4) {
    b.rect(x, y, 3, 3, ramp, lv); b.vline(x + 2, y, y + 2, ramp, lv + 1); b.hline(x, x + 2, y + 2, ramp, lv - 1);
    b.hline(x, x + 1, y, 'madeira_escura', 1); b.px(x + 2, y, ramp, lv + 2);
    b.px(x - 1, y + 1, ramp, lv - 1);
  }
  const postit = (b, x, y, ramp = 'amarelo_vivo') => { b.rect(x, y, 2, 2, ramp, 4); b.px(x + 1, y, ramp, 5); };
  /* Pilha de folhas apoiada na linha `base` (a pilha sobe). */
  function papeis(b, x, base, w, n, random, {torta = false} = {}) {
    for (let i = 0; i < n; i++) {
      const dx = torta ? Math.round(Math.sin(i * 1.7) * 1) : (random() < .3 ? 1 : 0), yy = base - i;
      b.hline(x + dx, x + dx + w - 1, yy, 'papel', i % 2 ? 3 : 4);
      b.px(x + dx + w - 1, yy, 'papel', 5);
    }
    const top = base - n + 1;
    b.hline(x + 1, x + w - 2, top, 'papel', 6);
  }
  /* Bolinha de papel amassado. */
  function bolinha(b, x, y) { b.px(x, y, 'papel', 5); b.px(x + 1, y, 'papel', 6); b.px(x, y + 1, 'papel', 3); b.px(x + 1, y + 1, 'papel', 4); }
  /* Lixeira de escritório (telinha), 6×7, com papel saindo. */
  function lixeira(b, x, y, cheia) {
    b.rect(x, y, 6, 7, 'plastico_preto', 3);
    for (let yy = y + 1; yy < y + 6; yy += 2) for (let xx = x + 1; xx < x + 5; xx += 2) b.px(xx, yy, 'plastico_preto', 1);
    b.hline(x, x + 5, y, 'plastico_preto', 5); b.vline(x + 5, y, y + 6, 'plastico_preto', 4); b.hline(x, x + 5, y + 6, 'plastico_preto', 1);
    if (cheia) { bolinha(b, x + 1, y - 1); b.px(x + 4, y - 1, 'papel', 4); b.px(x + 3, y - 2, 'papel', 5); }
  }
  /* Pasta-arquivo em pé (lombada) com etiqueta e furo. */
  function lombada(b, x, base, w, h, ramp, lv = 3) {
    b.rect(x, base - h + 1, w, h, ramp, lv);
    b.vline(x + w - 1, base - h + 1, base, ramp, lv + 1); b.vline(x, base - h + 1, base, ramp, lv - 1);
    b.hline(x, x + w - 1, base - h + 1, ramp, lv + 2);
    if (h >= 6 && w >= 2) {
      b.rect(x + (w > 2 ? 1 : 0), base - h + 3, Math.max(1, w - (w > 2 ? 2 : 1)), 2, 'papel', 5);
      if (h >= 8) b.px(x + Math.floor(w / 2), base - 2, 'carvao', 1);
    }
  }
  /* Cadeira de escritório vista de costas (encosto virado para a câmera):
     encosto arredondado, assento aparecendo dos lados, pistão e base em estrela. */
  function cadeiraEscritorio(b, cx, top, ramp, base = CHAO) {
    const x = cx - 5, bh = 9, PR = 'plastico_preto', sy = top + bh - 3;
    b.rect(cx - 7, sy, 14, 2, ramp, 2); b.hline(cx - 7, cx + 6, sy, ramp, 3); b.px(cx + 6, sy, ramp, 4); b.px(cx - 7, sy + 1, ramp, 1);
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < 10; xx++) {
      if ((yy === 0 || yy === bh - 1) && (xx === 0 || xx === 9)) continue;
      const nx = xx / 9 * 2 - 1, ny = yy / (bh - 1) * 2 - 1;
      let lv = Math.floor(2 + 3.2 * Math.max(0, Math.min(1, .55 + nx * .32 - ny * .42 - (nx * nx + ny * ny) * .18)) + bayer(x + xx, top + yy) * .8 - .4);
      if (xx === 0 || yy === bh - 1) lv = Math.min(lv, 2);
      if (yy === 0 && xx > 1 && xx < 9) lv = Math.max(lv, 4);
      b.px(x + xx, top + yy, ramp, lv);
    }
    b.hline(x + 2, x + 7, top + bh - 3, ramp, 2);                                         // costura do apoio lombar
    b.rect(cx - 2, top + bh, 4, 1, PR, 2); b.px(cx + 1, top + bh, PR, 3);                  // mecanismo
    for (let yy = top + bh + 1; yy <= base - 4; yy++) { b.px(cx - 1, yy, 'cromado', 3); b.px(cx, yy, 'cromado', 5); }
    b.hline(cx - 3, cx + 2, base - 3, PR, 3); b.hline(cx - 6, cx + 5, base - 2, PR, 2); b.hline(cx - 1, cx, base - 2, PR, 4);
    for (const rx of [cx - 7, cx - 1, cx + 5]) { b.rect(rx, base - 1, 2, 2, 'borracha', 1); b.px(rx + 1, base - 1, 'borracha', 3); }
    b.shade(cx - 8, base, 16, 1, -1, .5);
  }
  /* Telefone de mesa 11×7: base com teclado, fone deitado no gancho, fio enrolado à esquerda. */
  function telefoneMesa(b, x, y, ramp, {led = false} = {}) {
    b.hline(x + 1, x + 9, y + 3, ramp, 4); b.rect(x, y + 4, 11, 2, ramp, 3); b.hline(x, x + 10, y + 6, ramp, 1);
    b.vline(x + 10, y + 4, y + 5, ramp, 4); b.vline(x, y + 4, y + 5, ramp, 2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.px(x + 5 + i * 2, y + 4 + j, ramp, j ? 5 : 6);
    b.hline(x + 1, x + 3, y + 4, 'carvao', 1); b.px(x + 3, y + 4, 'vidro', 3);
    b.rect(x, y + 1, 3, 2, ramp, 3); b.hline(x, x + 2, y + 1, ramp, 5);                     // fone: escuta, cabo e bocal
    b.rect(x + 8, y + 1, 3, 2, ramp, 3); b.hline(x + 8, x + 10, y + 1, ramp, 5); b.px(x + 10, y + 2, ramp, 4);
    b.hline(x + 2, x + 8, y, ramp, 4); b.hline(x + 3, x + 7, y + 1, ramp, 2);
    b.px(x - 1, y + 4, ramp, 2); b.px(x - 2, y + 5, ramp, 3); b.px(x - 1, y + 6, ramp, 2);
    if (led) b.px(x + 9, y + 3, 'led', 5, EMISSIVE);
  }
  /* Vasinho com cacto (em cima de móveis). base = linha onde apoia. */
  function cacto(b, x, base, seed) {
    b.rect(x, base - 3, 5, 3, 'tijolo', 3); b.hline(x - 1, x + 5, base - 3, 'tijolo', 4); b.vline(x + 4, base - 2, base, 'tijolo', 4);
    b.rect(x + 1, base - 8, 3, 5, 'folha', 3); b.vline(x + 3, base - 8, base - 4, 'folha', 4); b.px(x + 2, base - 9, 'folha', 4);
    if (seed % 2) { b.px(x + 4, base - 6, 'folha', 3); b.px(x + 4, base - 7, 'folha', 4); } else { b.px(x, base - 5, 'folha', 2); b.px(x, base - 6, 'folha', 3); }
    b.px(x + 2, base - 10, 'rosa_vivo', 4);
  }

  /* ================================================================ ESCRITÓRIO */

  /* ------------------------------------------------------------ escrivaninha */
  const COMPUTADORES = [['crt', 'Computador antigo (tubo)'], ['monitor', 'Monitor e gabinete'], ['notebook', 'Notebook'], ['nenhum', 'Sem computador']];
  const ESTILO_TERMINAL = {crt: 'crt', monitor: 'moderno', notebook: 'notebook'};
  const topoEscrivaninha = p => ({crt: 25, monitor: 29, notebook: 33, nenhum: 33}[p.computador] ?? 29);
  /* Onde fica a tela de cada computador (u = coluna esquerda da peça). */
  const telaDe = (p, u) => ({crt: {x: u + 13, y: 27, w: 13, h: 8}, monitor: {x: u + 12, y: 30, w: 16, h: 9}, notebook: {x: u + 14, y: 34, w: 11, h: 7}}[p.computador] || null);
  const ARQUIVOS = {
    moderno: {usuario: 'recepcao', senha: 'cafe123', dica: 'Post-it embaixo do teclado: “o que acaba primeiro na copa + 123”.',
      arquivos: ['DOCUMENTOS/ESCALA_DE_FERIAS.TXT', 'JANEIRO — Souza', 'FEVEREIRO — Ramalho', 'MARÇO — Ramalho', 'ABRIL — Ramalho', '(o Ramalho nunca pediu férias)',
        '---', 'DOCUMENTOS/ATA_REUNIAO_14.TXT', 'Pauta: a copiadora.', 'Decidido: ninguém usa a copiadora depois das 18h.', 'Motivo: não consta em ata.',
        '---', 'EMAILS/RE_RE_RE_BARULHO_NO_FORRO.TXT', 'De: Manutenção', 'O barulho no forro não é rato.', 'Por favor, parem de deixar comida lá em cima.',
        '---', 'LIXEIRA/NAO_ABRIR.TXT !', 'eles contam quantos ficam depois do expediente'].join('\n')},
    crt: {usuario: '', senha: '', dica: '',
      arquivos: ['RH/FOLHA_03.TXT', 'FUNCIONÁRIOS ATIVOS: 12', 'CRACHÁS REGISTRADOS APÓS 22H: 13',
        '---', 'SISTEMA/LEIAME.TXT', 'Não desligue este computador.', 'Ele não desliga.',
        '---', 'PONTO/NOITE.TXT', '02:14 entrada — sem crachá', '02:15 entrada — sem crachá', '02:16 entrada — sem crachá', '02:17 saída — Souza'].join('\n')},
    notebook: {usuario: 'financeiro', senha: '1987', dica: 'Ano de fundação da empresa (está na placa da recepção).',
      arquivos: ['PLANILHAS/CONTAS_A_PAGAR.TXT', 'Luz: atrasada.', 'Água: atrasada.', 'Aluguel do subsolo: NÃO ATRASAR. Nunca.',
        '---', 'PESSOAL/CARTA_DE_DEMISSAO.TXT', 'Prezados, peço meu desligamento imediato.', 'Não é pelo salário. É pelo terceiro andar.', '(nunca enviada)',
        '---', 'FOTOS/FESTA_FIM_DE_ANO.TXT', 'foto 1: todos sorrindo.', 'foto 2: todos sorrindo, alguém a mais no fundo.', 'foto 3: arquivo apagado.'].join('\n')}
  };
  const escrivaninhaInt = interacaoPorParametro('terminal', o => o.p.computador === 'nenhum' ? 'recipiente' : 'terminal', (o, tipo) => tipo === 'recipiente' ? {
    titulo: 'Gavetas da escrivaninha', estilo: 'gaveteiro', tranca: 'nenhuma',
    compartimentos: ['Gaveta de cima | Clipes, um grampeador sem grampos e um vale-refeição vencido. | moedas*2',
      'Gaveta do meio | Formulários em branco, todos já carimbados: RECUSADO.',
      'Gaveta de baixo | Um par de sapatos sociais e uma escova de dentes num copo. Alguém dorme aqui.'].join('\n')
  } : {estilo: ESTILO_TERMINAL[o.p.computador] || 'moderno', ...ARQUIVOS[ESTILO_TERMINAL[o.p.computador] || 'moderno']});

  function telaEscrivaninha(b, o, c) {
    const s = telaDe(o.p, o.u);
    if (!s) return;
    const on = c.tela(o, 'tela') > 0, {x, y, w, h} = s, E = EMISSIVE;
    if (!on) {
      b.rect(x, y, w, h, 'vidro', 1);
      b.line(x + w - 5, y, x + w - 1, y + 4, 'vidro', 2); b.line(x + w - 3, y, x + w - 1, y + 2, 'vidro', 3);
    } else if (o.p.computador === 'crt') {
      b.rect(x, y, w, h, 'fosforo', 1, E);
      for (let i = 0; i < 3; i++) b.hline(x + 1, x + 2 + Math.floor(hash2(i, 3, o.seed) * (w - 4)), y + 1 + i * 2, 'fosforo', 4, E);
      b.px(x + 1, y + 6, 'fosforo', 5, E);
      for (let yy = y + 1; yy < y + h; yy += 2) b.shade(x, yy, w, 1, 1, .25);
    } else if (o.p.computador === 'monitor') {
      b.vgrad(x, y, w, h - 1, 'tela', 3, 2, E);
      for (let i = 0; i < 3; i++) b.rect(x + 1, y + 1 + i * 2, 2, 1, 'amarelo_vivo', 4 + (i === 0 ? 1 : 0), E);
      b.rect(x + 4, y + 1, w - 5, h - 3, 'branco', 6, E); b.hline(x + 4, x + w - 2, y + 1, 'azul_vivo', 4, E); b.px(x + w - 2, y + 1, 'vermelho', 4, E);
      b.hline(x + 5, x + 5 + Math.floor(3 + hash2(1, 1, o.seed) * 5), y + 3, 'tinta', 2, E);
      b.hline(x, x + w - 1, y + h - 1, 'tela', 1, E); b.px(x, y + h - 1, 'verde_vivo', 4, E); b.hline(x + w - 3, x + w - 2, y + h - 1, 'branco', 5, E);
    } else {
      b.rect(x, y, w, h, 'tela', 2, E); b.hline(x, x + w - 1, y, 'verde_vivo', 3, E);
      for (let yy = y + 2; yy < y + h; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx++) if ((xx - x) % 4 !== 0) b.px(xx, yy, 'branco', (xx - x) % 4 === 1 ? 5 : 4, E);
    }
    // Cantos arredondados do tubo.
    if (o.p.computador === 'crt') for (const [dx, dy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) b.px(x + dx, y + dy, 'plastico_bege', 2);
  }

  M.modulo({
    id: 'escrivaninha', nome: 'Escrivaninha', grupo: 'Escritório', camada: 'parede',
    w: 38, h: p => 62 - topoEscrivaninha(p),
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'computador', label: 'Computador', opcoes: COMPUTADORES, padrao: 'monitor'},
      {id: 'bagunca', label: 'Bagunça', opcoes: [['0', 'Arrumada'], ['1', 'Em uso'], ['2', 'Caótica']], padrao: '1'},
      {id: 'cadeira', label: 'Com cadeira', tipo: 'bool', padrao: true},
      {id: 'tela', label: 'Tela acesa', tipo: 'estado', padrao: true}
    ],
    interacao: escrivaninhaInt.interacao,
    area: escrivaninhaInt.area(),
    pinta(b, o, c) {
      const {u} = o, p = o.p, cor = p.cor, random = M.rngDe(o, 1), bag = Number(p.bagunca) || 0, comp = p.computador, E = EMISSIVE;
      const cadeiraCor = ['tecido_azul', 'couro_preto', 'tecido_cinza', 'tecido_vinho'][o.seed % 4];
      // Vão das pernas: fundo em sombra, painel de trás e o gaveteiro.
      b.shade(u + 13, 46, 22, 16, -2); b.shade(u + 13, 53, 22, 3, -1);
      b.rect(u + 13, 46, 22, 7, cor, 1); b.hline(u + 13, u + 34, 46, cor, 2);
      b.rect(u + 1, 46, 12, 16, cor, 3); b.vline(u + 1, 46, CHAO, cor, 2); b.vline(u + 12, 46, CHAO, cor, 4);
      for (let i = 0; i < 3; i++) {
        const yy = 46 + i * 5;
        b.bevel(u + 2, yy, 10, 5, cor, 3, 4, 1);
        b.hline(u + 5, u + 8, yy + 2, 'latao', 4); b.px(u + 8, yy + 2, 'latao', 6); b.hline(u + 5, u + 8, yy + 3, cor, 2);
      }
      b.hline(u + 1, u + 12, CHAO, cor, 1);
      b.rect(u + 35, 46, 2, 16, cor, 3); b.vline(u + 36, 46, CHAO, cor, 4); b.vline(u + 35, 46, CHAO, cor, 2);
      if (comp === 'monitor') {                                                          // gabinete no chão
        b.rect(u + 14, 50, 6, 12, 'plastico_preto', 2); b.hline(u + 14, u + 19, 50, 'plastico_preto', 4); b.vline(u + 19, 50, CHAO, 'plastico_preto', 3);
        b.hline(u + 15, u + 18, 52, 'plastico_preto', 1); b.hline(u + 15, u + 18, 54, 'plastico_preto', 1);
        b.px(u + 18, 57, c.energia ? 'neon_azul' : 'plastico_preto', c.energia ? 5 : 3, c.energia ? E : 0);
      }
      if (comp !== 'nenhum') { b.vline(u + 33, 47, 59, 'plastico_preto', 1); b.rect(u + 29, 60, 5, 2, 'branco', 3); b.hline(u + 29, u + 33, 60, 'branco', 4); b.px(u + 30, 60, 'led', 5, c.energia ? E : 0); }
      if (bag >= 1) lixeira(b, u + 21, 55, bag >= 2);
      // Tampo: face de cima clara e borda.
      b.hline(u, u + 37, 42, cor, 5); b.hline(u, u + 37, 43, cor, 4); b.hline(u, u + 37, 44, cor, 3); b.hline(u, u + 37, 45, cor, 1);
      for (let i = 0; i < 5; i++) b.hline(u + 2 + Math.floor(hash2(i, 7, o.seed) * 30), u + 5 + Math.floor(hash2(i, 7, o.seed) * 30), 43 - (i % 2), cor, 4 + (i % 2));
      b.px(u + 37, 44, cor, 4); b.px(u, 44, cor, 2);
      // Computador.
      if (comp === 'crt') {
        b.rect(u + 10, 38, 19, 5, 'plastico_bege', 4); b.hline(u + 10, u + 28, 38, 'plastico_bege', 5); b.hline(u + 10, u + 28, 42, 'plastico_bege', 2);
        b.vline(u + 28, 38, 42, 'plastico_bege', 5); b.vline(u + 10, 39, 42, 'plastico_bege', 3);
        b.hline(u + 13, u + 18, 40, 'carvao', 1); b.hline(u + 13, u + 18, 41, 'plastico_bege', 5);
        b.px(u + 25, 40, c.energia ? 'verde_vivo' : 'plastico_bege', c.energia ? 5 : 2, c.energia ? E : 0); b.rect(u + 26, 40, 1, 2, 'plastico_bege', 2);
        b.bevel(u + 11, 25, 17, 13, 'plastico_bege', 4, 5, 2);
        b.rect(u + 12, 26, 15, 10, 'plastico_bege', 3); b.hline(u + 12, u + 26, 26, 'plastico_bege', 2); b.vline(u + 26, 26, 35, 'plastico_bege', 5);
        b.hline(u + 13, u + 16, 36, 'plastico_bege', 2); b.px(u + 25, 36, c.tela(o, 'tela') ? 'verde_vivo' : 'laranja', 5, c.energia ? E : 0);
        b.hline(u + 10, u + 22, 43, 'plastico_bege', 3);
        for (let xx = u + 11; xx < u + 22; xx += 2) b.px(xx, 43, 'plastico_bege', 5);
      } else if (comp === 'monitor') {
        b.bevel(u + 11, 29, 18, 12, 'plastico_preto', 2, 4, 1);
        b.hline(u + 12, u + 27, 39, 'plastico_preto', 3); b.px(u + 26, 39, c.tela(o, 'tela') ? 'neon_azul' : 'laranja', 5, c.energia ? E : 0);
        b.rect(u + 19, 41, 2, 1, 'plastico_preto', 3); b.hline(u + 16, u + 23, 42, 'plastico_preto', 3); b.px(u + 23, 42, 'plastico_preto', 4);
        b.hline(u + 11, u + 20, 43, 'plastico_preto', 2);
        for (let xx = u + 12; xx < u + 20; xx += 2) b.px(xx, 43, 'plastico_preto', 4);
        b.px(u + 22, 43, 'plastico_preto', 4); b.px(u + 23, 43, 'plastico_preto', 2);
      } else if (comp === 'notebook') {
        b.rect(u + 13, 33, 13, 9, 'plastico_preto', 2); b.hline(u + 13, u + 25, 33, 'plastico_preto', 3); b.vline(u + 25, 33, 41, 'plastico_preto', 3);
        b.hline(u + 12, u + 26, 42, 'aluminio', 3); b.hline(u + 12, u + 26, 43, 'aluminio', 2);
        for (let xx = u + 14; xx < u + 25; xx += 2) b.px(xx, 42, 'aluminio', 1);
        b.px(u + 26, 42, 'aluminio', 5);
      } else {
        // Sem computador: máquina de escrever com uma folha pela metade.
        b.rect(u + 15, 32, 9, 6, 'papel', 5); b.vline(u + 23, 32, 37, 'papel', 4); b.hline(u + 15, u + 23, 32, 'papel', 6);
        for (let i = 0; i < 3; i++) b.hline(u + 16, u + 17 + Math.floor(hash2(i, 9, o.seed) * 5), 33 + i * 2, 'tinta', 2);
        b.rect(u + 11, 37, 17, 2, 'plastico_preto', 2); b.hline(u + 11, u + 27, 37, 'plastico_preto', 4);
        b.rect(u + 10, 37, 1, 2, 'plastico_preto', 3); b.rect(u + 28, 37, 1, 2, 'plastico_preto', 4); b.px(u + 9, 36, 'cromado', 5); b.px(u + 10, 36, 'cromado', 4);
        b.rect(u + 12, 39, 15, 3, 'ferro_verde', 3); b.hline(u + 12, u + 26, 39, 'ferro_verde', 5); b.vline(u + 26, 39, 41, 'ferro_verde', 4); b.vline(u + 12, 39, 41, 'ferro_verde', 2);
        for (let xx = u + 13; xx < u + 26; xx += 2) { b.px(xx, 40, 'papel', 4); b.px(xx + 1, 41, 'papel', 3); }
        b.hline(u + 11, u + 27, 42, 'ferro_verde', 1); b.hline(u + 16, u + 22, 42, 'papel', 3);
        papeis(b, u + 30, 42, 6, 2, random);
        b.rect(u + 4, 39, 3, 4, 'vermelho', 3); b.vline(u + 6, 39, 42, 'vermelho', 4);
        b.vline(u + 4, 36, 38, 'amarelo_vivo', 4); b.vline(u + 5, 37, 38, 'azul_vivo', 4); b.px(u + 6, 37, 'tinta', 2);
      }
      telaEscrivaninha(b, o, c);
      // O que conta a história de quem trabalha aqui.
      const sx = telaDe(p, u);
      if (bag === 0 || bag === 1) caneca(b, u + 31, 40, 'branco');
      if (bag === 0) { b.rect(u + 2, 38, 5, 5, 'madeira', 3); b.rect(u + 3, 39, 3, 3, 'ceu', 4); b.px(u + 4, 40, 'rosa', 4); b.px(u + 3, 41, 'folha', 3); }
      if (bag >= 1) papeis(b, u + 1, 42, 8, bag === 2 ? 6 : 3, random, {torta: bag === 2});
      if (bag >= 1 && sx) { postit(b, sx.x - 1 + (comp === 'crt' ? -1 : 0), sx.y + sx.h - (comp === 'monitor' ? 0 : 1)); if (bag >= 2) { postit(b, sx.x + sx.w - 1, sx.y - 2, 'rosa_vivo'); postit(b, sx.x + 3, sx.y - 2); } }
      if (bag >= 2) {
        caneca(b, u + 30, 40, 'vermelho'); caneca(b, u + 34, 40, 'branco', 3);
        b.rect(u + 9, 40, 4, 2, 'aluminio', 4); b.hline(u + 9, u + 12, 40, 'aluminio', 6);          // marmita
        bolinha(b, u + 27, 41); bolinha(b, u + 4, 60); b.hline(u + 25, u + 28, CHAO, 'papel', 5);
      }
      if (p.cadeira) cadeiraEscritorio(b, u + 29, 43, cadeiraCor);
      encardido(b, o, c, u + 1, 46, 12, 15);
      riscos(b, o, c, u, 42, 38, 2);
      P.contato(b, u + 1, 36);
    },
    anima(g, o, t, c) {
      const s = telaDe(o.p, o.u);
      if (!s || !c.tela(o, 'tela')) return;
      const pisca = Math.floor(t * 2 + (o.seed % 5)) % 2 === 0;
      if (o.p.computador === 'crt') { if (pisca) g.rect(s.x + 3, s.y + 6, 2, 1, g.color('fosforo', 6, 'day')); }
      else if (o.p.computador === 'monitor') {
        const n = Math.floor(t * 3 + o.seed) % 12, len = Math.min(n, 8);
        if (len) g.rect(s.x + 5, s.y + 5, len, 1, g.color('tinta', 2, 'day'));
        if (pisca) g.px(s.x + 5 + len, s.y + 5, g.color('tinta', 0, 'day'));
      } else { const k = Math.floor(t * 1.3 + o.seed) % 3; g.rect(s.x + 1 + k * 4, s.y + 4, 3, 1, g.color('amarelo_vivo', 5, 'day')); }
    },
    luzes(o, c) {
      const s = telaDe(o.p, o.u);
      if (!s || !c.tela(o, 'tela')) return [];
      const escuro = (c.preset?.ambient ?? 0) <= -1;                                    // de dia a tela quase não ilumina a sala
      return [{kind: 'point', X: c.wallX(s.x + s.w / 2), d: c.dParede - 22, h: c.hWall(s.y + s.h / 2), radius: o.p.computador === 'notebook' ? 72 : 92,
        strength: (escuro ? 1 : .45) * (o.p.computador === 'crt' ? 1.2 : 1.35), tint: 'screen', power: 1.6, layers: escuro ? ['wall', 'floor', 'front', 'side'] : ['floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ arquivo de aço */
  const GAVETAS_ARQUIVO = [
    'Gaveta A–F | Fichas de funcionários. A do Ramalho tem foto, mas o rosto foi recortado com estilete.',
    'Gaveta G–O | Notas fiscais de 1994 a 2003 e uma nota com a data de amanhã, já paga.',
    'Gaveta P–Z | Pastas suspensas vazias e um saquinho de balas de café. | moedas*1',
    'Gaveta de baixo | Um guarda-chuva quebrado, um crachá sem nome e uma chavinha com etiqueta: DIRETORIA. | chave=Gaveta do diretor'
  ];
  M.modulo({
    id: 'arquivo_aco', nome: 'Arquivo de aço', grupo: 'Escritório', camada: 'parede',
    w: 13, h: p => (p.gavetas === '3' ? 25 : 32) + 6,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'ferro_bege'},
      {id: 'gavetas', label: 'Gavetas', opcoes: [['3', 'Três'], ['4', 'Quatro']], padrao: '4'},
      {id: 'aberto', label: 'Gaveta puxada', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => {
      const n = o.p.gavetas === '3' ? 3 : 4, lista = GAVETAS_ARQUIVO.slice(0, n - 1).concat(GAVETAS_ARQUIVO[3]);
      return {titulo: 'Arquivo de aço', estilo: 'arquivo', tranca: 'nenhuma', compartimentos: lista.join('\n')};
    }},
    area: o => ({u: 0, v: 6, w: o.w, h: o.h - 6}),
    pinta(b, o, c) {
      const {u} = o, cor = o.p.cor, n = o.p.gavetas === '3' ? 3 : 4, top = CHAO - 3 - n * 7, aberto = c.estado(o, 'aberto');
      b.bevel(u, top, 13, CHAO - top + 1, cor, 3, 4, 1);
      b.hline(u, u + 12, top, cor, 5); b.hline(u + 1, u + 11, top + 1, cor, 4);
      b.px(u + 10, top + 1, 'cromado', 5);                                                 // fechadura
      for (let i = 0; i < n; i++) {
        const y0 = top + 2 + i * 7;
        b.hline(u + 1, u + 11, y0, cor, 1);
        b.bevel(u + 1, y0 + 1, 11, 6, cor, 3, 4, 2);
        b.frame(u + 4, y0 + 2, 5, 3, 'cromado', 3); b.hline(u + 5, u + 7, y0 + 3, 'papel', 5);
        b.hline(u + 4, u + 8, y0 + 5, 'cromado', 5); b.px(u + 4, y0 + 5, 'cromado', 3);
      }
      b.rect(u + 1, CHAO - 1, 11, 2, cor, 1);
      if (aberto) {
        const y0 = top + 2 + 7, fy = y0 + 3;                                              // a segunda gaveta, puxada
        b.rect(u + 1, y0, 11, fy - y0 + 1, 'carvao', 1);
        const pastas = ['papelao', 'ferro_verde', 'papelao', 'azul_vivo', 'papelao', 'vermelho', 'papelao', 'ferro_verde', 'papelao'];
        for (let i = 0; i < 9; i++) {
          const xx = u + 2 + i, alto = hash2(i, 4, o.seed) > .55 ? 0 : 1, r = pastas[(i + o.seed) % pastas.length];
          b.vline(xx, y0 + alto, fy, r, i % 2 ? 3 : 4); b.px(xx, y0 + alto, r, 5);
          if (hash2(i, 5, o.seed) > .72) b.px(xx, y0 + alto - 1, 'papel', 5);
        }
        b.vline(u + 1, y0, fy, cor, 4); b.vline(u + 11, y0, fy, cor, 5);
        b.rect(u - 1, fy, 15, 7, cor, 3); b.hline(u - 1, u + 13, fy, cor, 5); b.vline(u + 13, fy, fy + 6, cor, 4); b.vline(u - 1, fy + 1, fy + 6, cor, 2);
        b.frame(u + 4, fy + 1, 5, 3, 'cromado', 3); b.hline(u + 5, u + 7, fy + 2, 'papel', 5);
        b.hline(u + 3, u + 9, fy + 4, 'cromado', 5); b.px(u + 3, fy + 4, 'cromado', 3); b.hline(u - 1, u + 13, fy + 6, cor, 1);
        b.shade(u, fy + 7, 13, 1, -2); b.shade(u, fy + 8, 13, 1, -1);
      }
      // Em cima do arquivo.
      const tipo = o.seed % 3;
      if (tipo === 0) { cacto(b, u + 1, top - 1, o.seed); papeis(b, u + 7, top - 1, 5, 2, M.rngDe(o, 2)); }
      else if (tipo === 1) {
        b.rect(u + 2, top - 5, 9, 5, 'plastico_preto', 2); b.hline(u + 2, u + 10, top - 5, 'plastico_preto', 4); b.vline(u + 10, top - 5, top - 1, 'plastico_preto', 3);
        b.rect(u + 3, top - 4, 3, 3, 'plastico_preto', 1); for (let yy = top - 4; yy < top - 1; yy += 2) b.hline(u + 3, u + 5, yy, 'aco', 3);
        b.hline(u + 7, u + 9, top - 3, 'laranja', 3); b.px(u + 9, top - 4, 'cromado', 5);
        b.line(u + 9, top - 6, u + 12, top - 6 - 4, 'cromado', 4);
      } else {
        for (let i = 0; i < 3; i++) { const r = ['azul_vivo', 'vermelho', 'plastico_preto'][i]; b.rect(u + 1 + i % 2, top - 2 - i * 2, 9, 2, r, 3); b.hline(u + 1 + i % 2, u + 9 + i % 2, top - 2 - i * 2, r, 5); b.px(u + 9 + i % 2, top - 1 - i * 2, 'papel', 5); }
        caneca(b, u + 10, top - 3, 'amarelo_vivo', 4);
      }
      ferrugem(b, o, c, u + 1, top + 2, 11, CHAO - top - 3, {min: 2});
      riscos(b, o, c, u, top + 2, 13, CHAO - top - 3);
      if (c.desgaste >= 3) { b.shade(u + 2, top + 10, 4, 2, -1); b.px(u + 3, top + 12, cor, 1); }
      P.contato(b, u, 13);
    }
  });

  /* ------------------------------------------------------------ estante de pastas */
  M.modulo({
    id: 'estante_pastas', nome: 'Estante de pastas', grupo: 'Escritório', camada: 'parede',
    w: 26, h: 44,
    params: [{id: 'cor', label: 'Estrutura', opcoes: METAL_OU_MADEIRA, padrao: 'aco'}],
    interacao: {tipo: 'documento', marca: 'discreta', dados: () => ({
      papel: 'oficio', cabecalho: 'ARQUIVO GERAL', setor: 'Controle interno', titulo: 'Relatório de ocorrências — 3º trimestre', local: 'Arquivado em 12 de setembro',
      texto: 'Foram registradas 14 ocorrências no período: 9 lâmpadas queimadas no 3º andar, 3 queixas de ruído no forro e 2 funcionários que bateram o ponto de saída sem ter batido o de entrada.\n\nRecomenda-se não repor as lâmpadas do 3º andar. Elas duram menos a cada troca.',
      assinatura: 'Supervisão de Patrimônio', carimbo: 'ARQUIVADO'})},
    area: o => ({u: 0, v: 4, w: o.w, h: o.h - 4}),
    pinta(b, o, c) {
      const {u} = o, cor = o.p.cor, madeira = ehMadeira(cor), random = M.rngDe(o, 3), top = 22;
      const LOMBADAS = ['azul_vivo', 'vermelho', 'ferro_verde', 'plastico_preto', 'tecido_mostarda', 'azul_vivo', 'branco', 'vinho'];
      // Fundo: painel de madeira ou a parede na sombra.
      if (madeira) b.rect(u + 2, top + 2, 22, CHAO - top - 3, cor, 1); else b.shade(u + 2, top + 2, 22, CHAO - top - 3, -1);
      for (const [a, z, alto] of [[top + 2, top + 9, 8], [top + 12, top + 19, 8], [top + 22, top + 29, 8], [top + 32, top + 37, 6]]) {
        let x = u + 3;
        const faixa = Math.floor(random() * 4);
        while (x < u + 23) {
          const r = random();
          if (alto === 6 || (faixa === 0 && x > u + 13 && x < u + 19)) {                   // caixas-arquivo de papelão
            if (x + 5 > u + 23) break;
            b.rect(x, z - 5, 5, 6, 'papelao', 4); b.hline(x, x + 4, z - 5, 'papelao', 5); b.vline(x + 4, z - 5, z, 'papelao', 5); b.vline(x, z - 5, z, 'papelao', 3);
            b.rect(x + 1, z - 3, 3, 1, 'carvao', 1); b.hline(x + 1, x + 3, z - 1, 'papel', 5);
            x += 6; continue;
          }
          if (r < .08) { x += 2; continue; }
          if (r < .18 && x + 4 < u + 23) {                                                  // pasta caída
            const ramp = LOMBADAS[Math.floor(random() * LOMBADAS.length)];
            b.line(x, z, x + 3, z - alto + 2, ramp, 4); b.line(x + 1, z, x + 4, z - alto + 2, ramp, 3); b.line(x + 2, z, x + 4, z - 2, ramp, 2);
            x += 5; continue;
          }
          if (r < .26 && x + 5 < u + 23) { papeis(b, x, z, 5, 2 + Math.floor(random() * 3), random); x += 6; continue; }
          const w = random() < .7 ? 3 : 2, ramp = LOMBADAS[Math.floor(random() * LOMBADAS.length)];
          lombada(b, x, z, w, alto - Math.floor(random() * 2), ramp, 3);
          x += w;
        }
      }
      // Estrutura: laterais e prateleiras.
      for (const yy of [top, top + 10, top + 20, top + 30]) {
        if (madeira) { b.rect(u, yy, 26, 2, cor, 3); b.hline(u, u + 25, yy, cor, 5); b.hline(u + 2, u + 23, yy + 2, cor, 0); }
        else { b.hline(u, u + 25, yy, cor, 5); b.hline(u, u + 25, yy + 1, cor, 2); b.hline(u + 2, u + 23, yy + 2, 'carvao', 1); }
      }
      b.rect(u, CHAO - 1, 26, 2, cor, madeira ? 2 : 1);
      for (const [x, lit] of [[u, false], [u + 24, true]]) {
        if (madeira) { b.rect(x, top, 2, CHAO - top + 1, cor, lit ? 4 : 2); b.vline(x + (lit ? 1 : 0), top, CHAO, cor, lit ? 5 : 1); }
        else {
          b.rect(x, top, 2, CHAO - top + 1, cor, 3); b.vline(x + 1, top, CHAO, cor, lit ? 5 : 4); b.vline(x, top, CHAO, cor, lit ? 3 : 2);
          for (let yy = top + 3; yy < CHAO - 1; yy += 3) b.px(x + (lit ? 0 : 1), yy, 'carvao', 1);
        }
      }
      if (madeira) { b.hline(u, u + 25, top, cor, 5); b.hline(u - 1, u + 26, top, cor, 4); }
      // Em cima: caixa de papelão com etiqueta e um tubo de plantas enrolado.
      b.rect(u + 3, top - 5, 10, 5, 'papelao', 3); b.hline(u + 3, u + 12, top - 5, 'papelao', 5); b.vline(u + 12, top - 5, top - 1, 'papelao', 4);
      b.rect(u + 5, top - 3, 5, 2, 'papel', 5); b.hline(u + 6, u + 8, top - 2, 'tinta', 2);
      b.rect(u + 15, top - 2, 9, 2, 'papel', 4); b.hline(u + 15, u + 23, top - 2, 'papel', 5); b.vline(u + 15, top - 2, top - 1, 'papel', 3); b.px(u + 23, top - 1, 'azul_vivo', 3);
      encardido(b, o, c, u, top, 26, CHAO - top + 1, {forca: .6});
      if (!madeira) ferrugem(b, o, c, u, top, 26, CHAO - top, {min: 2, dens: .6});
      P.contato(b, u, 26);
    }
  });

  /* ------------------------------------------------------------ bebedouro */
  M.modulo({
    id: 'bebedouro', nome: 'Bebedouro', grupo: 'Escritório', camada: 'parede',
    w: p => p.tipo === 'coluna' ? 13 : 14, h: p => p.tipo === 'coluna' ? 26 : 34,
    params: [{id: 'tipo', label: 'Tipo', opcoes: [['galao', 'De galão'], ['coluna', 'De coluna (inox)']], padrao: 'galao'}],
    /* Água de verdade: bebedouro de pressão ou de galão. */
    interacao: o => (root.ClueTypes?.get('fonte_agua')
      ? {tipo: 'fonte_agua', marca: 'discreta', dados: {estilo: o?.p?.tipo === 'coluna' ? 'bebedouro' : 'bebedouro_galao', qualidade: 'potavel', altura: 'media',
        examinar: o?.p?.tipo === 'coluna'
          ? 'Colado na lateral, um papel com letra caprichada: “NÃO BEBER DEPOIS DAS 18H”. Ninguém sabe quem colou.'
          : 'No fundo do galão, uma coisinha branca gira devagar. Parece um dente de leite.',
        mensagem: o?.p?.tipo === 'coluna' ? 'Bebedouro de pressão, de inox. O jato sai forte demais.' : 'Bebedouro de galão. A água é gelada e tem um leve gosto de moeda.'}}
      : {tipo: 'exame', marca: 'discreta', dados: o?.p?.tipo === 'coluna'
        ? {texto: 'Bebedouro de pressão, de inox. O jato sai forte demais e molha a camisa de todo mundo.', detalhe: 'Colado na lateral, um papel com letra caprichada: “NÃO BEBER DEPOIS DAS 18H”. Ninguém sabe quem colou.', item: 'agua'}
        : {texto: 'Um bebedouro de galão. A água é gelada e tem um leve gosto de moeda.', detalhe: 'No fundo do galão, uma coisinha branca gira devagar. Parece um dente de leite.', item: 'agua'}}),
    pinta(b, o, c) {
      const {u} = o;
      if (o.p.tipo === 'coluna') {
        const top = 36;
        b.rect(u + 2, top + 4, 9, CHAO - top - 5, 'cromado', 3);                             // coluna escovada
        for (let xx = u + 3; xx < u + 10; xx++) if ((xx - u) % 2) b.vline(xx, top + 5, CHAO - 3, 'cromado', 4);
        b.vline(u + 2, top + 4, CHAO - 2, 'cromado', 2); b.vline(u + 10, top + 4, CHAO - 2, 'cromado', 5);
        b.hline(u + 1, u + 11, top + 1, 'cromado', 6); b.hline(u, u + 12, top + 2, 'cromado', 4);    // cuba vista de cima
        b.hline(u + 2, u + 10, top + 2, 'aco', 1); b.px(u + 6, top + 2, 'aco', 3);
        b.hline(u, u + 12, top + 3, 'cromado', 3); b.hline(u + 1, u + 11, top + 4, 'cromado', 1);
        b.px(u + 4, top + 1, 'cromado', 5); b.px(u + 5, top, 'cromado', 6); b.px(u + 6, top, 'cromado', 5); b.px(u + 7, top + 1, 'agua', 5);   // bica
        b.rect(u + 5, top + 7, 3, 3, 'plastico_preto', 2); b.px(u + 6, top + 8, 'azul_vivo', 4); b.px(u + 7, top + 7, 'plastico_preto', 4);
        for (let yy = CHAO - 8; yy < CHAO - 2; yy += 2) b.hline(u + 4, u + 8, yy, 'aco', 1);
        b.rect(u + 1, CHAO - 1, 11, 2, 'plastico_preto', 2); b.hline(u + 1, u + 11, CHAO - 1, 'plastico_preto', 3);
        b.rect(u + 11, top + 6, 2, 8, 'branco', 5); b.vline(u + 12, top + 6, top + 13, 'branco', 6); b.px(u + 11, top + 14, 'lencol', 3); b.px(u + 12, top + 14, 'lencol', 4);
        b.rect(u + 3, top + 12, 2, 3, 'papel', 5); b.px(u + 3, top + 13, 'tinta', 2);
        ferrugem(b, o, c, u + 2, top + 5, 9, CHAO - top - 7, {min: 3, dens: .5});
        P.contato(b, u + 1, 11);
        return;
      }
      // Galão (de ponta-cabeça) sobre o gabinete.
      const g = 28, linhas = [[3, 9], [2, 10], [1, 11], [1, 11], [1, 11], [1, 11], [1, 11], [1, 11], [1, 11], [2, 10], [4, 8]];
      linhas.forEach(([a, z], yy) => {
        for (let xx = a; xx <= z; xx++) {
          const ar = yy < 2;                                                                // bolha de ar no fundo (para cima)
          let lv = xx <= 2 ? 2 : xx >= 9 ? 4 : 3;
          if (yy === 3 || yy === 7) lv += 1;
          if (xx === 9 && yy > 1 && yy < 9) lv = 5;
          b.px(u + xx, g + yy, ar ? 'vidro' : 'agua', ar ? lv + 1 : lv);
        }
      });
      b.hline(u + 3, u + 9, g, 'vidro', 5); b.rect(u + 5, g + 11, 3, 2, 'agua', 3); b.px(u + 7, g + 11, 'agua', 5);
      b.px(u + 4, g + 5, 'agua', 6); b.px(u + 6, g + 8, 'agua', 6); b.px(u + 5, g + 6, 'papel', 6);
      // Gabinete.
      const t = g + 13;
      b.bevel(u, t, 12, CHAO - t + 1, 'branco', 4, 5, 2);
      b.hline(u, u + 11, t, 'branco', 6); b.hline(u + 1, u + 10, t + 1, 'branco', 5);
      b.inset(u + 2, t + 3, 8, 8, 'branco', 3, 4, 2);
      b.rect(u + 3, t + 4, 2, 2, 'vermelho', 3); b.px(u + 4, t + 4, 'vermelho', 5); b.rect(u + 7, t + 4, 2, 2, 'azul_vivo', 3); b.px(u + 8, t + 4, 'azul_vivo', 5);
      b.rect(u + 3, t + 8, 6, 2, 'plastico_preto', 2); b.hline(u + 3, u + 8, t + 8, 'plastico_preto', 4);
      for (let yy = t + 13; yy < CHAO - 3; yy += 2) b.hline(u + 3, u + 8, yy, 'branco', 3);
      b.rect(u + 1, CHAO - 1, 10, 2, 'plastico_preto', 2);
      b.rect(u + 12, t + 2, 2, 9, 'branco', 5); b.vline(u + 13, t + 2, t + 10, 'branco', 6); b.hline(u + 12, u + 13, t + 11, 'lencol', 3);   // copinhos
      encardido(b, o, c, u, t, 12, CHAO - t + 1, {forca: .7});
      if (c.desgaste >= 2) { b.px(u + 4, t + 7, 'sujeira', 3); b.px(u + 5, t + 10, 'sujeira', 2); }
      P.contato(b, u, 12);
    }
  });

  /* ------------------------------------------------------------ copiadora */
  M.modulo({
    id: 'copiadora', nome: 'Copiadora', grupo: 'Escritório', camada: 'parede', w: 22, h: 32,
    params: [{id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('copiadora') ? 'copiadora' : 'exame'),
      dados: o => (root.ClueTypes?.get?.('copiadora') ? {
        titulo: 'Copiadora',
        vidro: 'Ficou um original esquecido no vidro, de cabeça para baixo, com o canto dobrado de tanto passar por ali.',
        copia: 'A cópia sai riscada no meio, mas dá para ver o que era: uma mão espalmada contra o vidro. Uma mão de seis dedos.',
        bandeja: '', mostrador: 'PRONTA', atola: 'sim', quebrada: 'nao'
      } : {
        texto: 'A copiadora ronca baixinho. No visor: PAPEL PRESO — BANDEJA 2. Na bandeja de saída ficou uma cópia esquecida.',
        detalhe: 'Você puxa a folha amassada: é a cópia de uma mão espalmada contra o vidro. Uma mão de seis dedos.'})},
    area: o => ({u: 0, v: 2, w: o.w, h: o.h - 2}),
    pinta(b, o, c) {
      const {u} = o, top = 30, on = c.estado(o, 'ligada') && c.energia, E = EMISSIVE;
      // Alimentador de originais e tampa.
      b.line(u + 4, top + 3, u + 8, top, 'plastico_preto', 3); b.line(u + 5, top + 3, u + 9, top, 'papel', 5);
      b.rect(u + 3, top + 3, 16, 3, 'plastico_preto', 2); b.hline(u + 3, u + 18, top + 3, 'plastico_preto', 4); b.px(u + 18, top + 4, 'plastico_preto', 3);
      // Corpo do scanner com painel.
      b.bevel(u + 2, top + 6, 18, 7, 'plastico_bege', 4, 5, 2);
      b.hline(u + 2, u + 19, top + 6, 'plastico_bege', 6);
      b.rect(u + 12, top + 7, 7, 5, 'plastico_preto', 2); b.hline(u + 12, u + 18, top + 7, 'plastico_preto', 3);
      b.rect(u + 13, top + 8, 4, 2, on ? 'neon_verde' : 'vidro', on ? 3 : 1, on ? E : 0);
      if (on) b.hline(u + 13, u + 15, top + 8, 'neon_verde', 5, E);
      for (let i = 0; i < 3; i++) b.px(u + 13 + i * 2, top + 11, 'plastico_bege', 5);
      b.px(u + 18, top + 9, on ? 'verde_vivo' : 'plastico_preto', on ? 5 : 3, on ? E : 0);
      // Bandeja de saída com a cópia esquecida.
      b.rect(u, top + 13, 4, 1, 'plastico_bege', 5); b.hline(u, u + 3, top + 14, 'plastico_bege', 2); b.hline(u, u + 3, top + 12, 'papel', 6);
      // Gabinete com as bandejas de papel.
      b.bevel(u + 2, top + 13, 18, CHAO - top - 14, 'plastico_bege', 3, 4, 1);
      for (let i = 0; i < 3; i++) {
        const yy = top + 15 + i * 5;
        b.inset(u + 3, yy, 16, 4, 'plastico_bege', 4, 5, 2);
        b.hline(u + 8, u + 13, yy + 1, 'plastico_preto', 2); b.px(u + 16, yy + 2, 'plastico_bege', i === 1 ? 2 : 5);
      }
      b.rect(u + 11, top + 21, 4, 3, 'papel', 5); b.px(u + 12, top + 22, 'vermelho', 3); b.px(u + 13, top + 22, 'vermelho', 3);        // bilhete colado
      b.rect(u + 2, CHAO - 1, 18, 2, 'plastico_preto', 2);
      for (const rx of [u + 3, u + 17]) b.rect(rx, CHAO, 2, 1, 'borracha', 1);
      encardido(b, o, c, u + 2, top + 6, 18, CHAO - top - 6, {forca: .7});
      riscos(b, o, c, u + 2, top + 13, 18, CHAO - top - 14);
      P.contato(b, u + 2, 18);
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'ligada') || !c.energia) return;
      const {u} = o, top = 30;
      if (Math.floor(t * 2.4 + o.seed) % 2) g.px(u + 18, top + 11, g.color('laranja', 5, 'day'));
      const ciclo = (t + o.seed % 9) % 6;
      if (ciclo < 1.6) g.rect(u + 3 + Math.floor(ciclo / 1.6 * 15), top + 5, 1, 1, g.color('luz_fria', 6, 'day'));
    }
  });

  /* ------------------------------------------------------------ cofre */
  M.modulo({
    id: 'cofre', nome: 'Cofre', grupo: 'Escritório', camada: 'parede', w: 16, h: 20,
    params: [{id: 'cor', label: 'Cor', opcoes: [['aco', 'Aço'], ['ferro_verde', 'Verde antigo'], ['plastico_preto', 'Preto']], padrao: 'aco'}],
    interacao: {tipo: 'cofre', marca: 'discreta', dados: () => ({titulo: 'COFRE', codigo: '0317', dica: 'Etiqueta quase apagada: “o dia que fecharam o 3º andar”.',
      aberto: 'Maços de notas antigas presos com elástico, uma fita cassete sem etiqueta e um envelope pardo: “NÃO ABRIR ATÉ O CÉU ESCURECER”.'})},
    pinta(b, o, c) {
      const {u} = o, cor = o.p.cor, top = 42, E = 0;
      b.bevel(u, top, 16, 18, cor, 3, 5, 1);
      b.hline(u, u + 15, top, cor, 5); b.hline(u + 1, u + 14, top + 1, cor, 4);
      b.rect(u + 2, top + 2, 12, 14, cor, 1);                                               // fresta da porta
      b.bevel(u + 3, top + 3, 11, 12, cor, 3, 4, 2);
      for (const yy of [top + 5, top + 12]) { b.rect(u + 1, yy, 2, 2, 'cromado', 3); b.px(u + 2, yy, 'cromado', 5); }
      b.rect(u + 5, top + 4, 6, 2, 'latao', 3); b.hline(u + 5, u + 10, top + 4, 'latao', 5);
      const cx = u + 7, cy = top + 10;
      b.ellipse(cx, cy, 3.4, 3.4, 'carvao', 1);
      b.sphere(cx, cy, 2.6, 2.6, 'cromado', 2, 6);
      b.px(cx - 1, cy - 1, 'plastico_preto', 2); b.px(cx - 1, cy - 4, 'vermelho', 4);
      b.rect(u + 11, top + 7, 2, 7, 'cromado', 3); b.vline(u + 12, top + 7, top + 13, 'cromado', 5);             // alavanca
      b.rect(u + 10, top + 12, 4, 2, 'cromado', 4); b.hline(u + 10, u + 13, top + 12, 'cromado', 6); b.hline(u + 10, u + 13, top + 14, cor, 1);
      b.hline(u + 1, u + 14, top + 17, cor, 2);
      b.rect(u + 1, CHAO - 1, 3, 2, 'plastico_preto', 1); b.rect(u + 12, CHAO - 1, 3, 2, 'plastico_preto', 1); b.px(u + 14, CHAO - 1, 'plastico_preto', 3);
      b.shade(u + 4, CHAO - 1, 8, 2, -1);
      riscos(b, o, c, u + 3, top + 6, 10, 6);
      ferrugem(b, o, c, u + 1, top + 2, 14, 15, {min: 2, dens: .8});
      P.contato(b, u, 16);
    }
  });

  /* ------------------------------------------------------------ balcão da recepção */
  const balcaoInt = interacaoPorParametro('telefone', o => o.p.telefone ? 'telefone' : 'exame', (o, tipo) => tipo === 'telefone' ? {
    estilo: 'mesa', numero: '3321-0400', custo: 0, semResposta: 'Chama, chama… ninguém atende.',
    contatos: ['190 | Polícia. Qual é a emergência? … Alô? … Senhor, essa ligação está vindo de dentro do prédio.',
      '0800 | Central de atendimento. Sua ligação é muito importante para nós. Aguarde. Aguarde. Aguarde.',
      '4002 | (voz de criança) A moça da recepção foi embora mais cedo. Ela não vai voltar.'].join('\n'),
    recado: 'Portaria falando. Tem alguém subindo pela escada de serviço… e não é funcionário.'
  } : {
    texto: 'O balcão da recepção. O livro de visitas está aberto: a última assinatura está borrada, como se a pessoa tivesse assinado tremendo.',
    detalhe: 'Na última página, alguém escreveu o mesmo horário várias vezes, cada vez com mais força: 03:10.'
  });
  M.modulo({
    id: 'balcao_recepcao', nome: 'Balcão de recepção', grupo: 'Escritório', camada: 'parede', w: 50, h: 35,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_clara'},
      {id: 'placa', label: 'Letreiro', tipo: 'texto', padrao: 'RECEPCAO'},
      {id: 'telefone', label: 'Telefone no balcão', tipo: 'bool', padrao: true}
    ],
    interacao: balcaoInt.interacao,
    area: balcaoInt.area(o => ({u: 0, v: 3, w: o.w, h: o.h - 3})),
    pinta(b, o, c) {
      const {u} = o, p = o.p, cor = p.cor, seed = o.seed, t = 36;
      // Por trás: o monitor da recepcionista, visto de costas.
      b.rect(u + 28, 28, 9, 7, 'plastico_preto', 2); b.hline(u + 28, u + 36, 28, 'plastico_preto', 3); b.vline(u + 36, 28, 34, 'plastico_preto', 3);
      for (let yy = 30; yy < 34; yy += 2) b.hline(u + 30, u + 34, yy, 'plastico_preto', 1);
      b.rect(u + 31, 35, 3, 1, 'plastico_preto', 1);
      // Tampo alto e frente.
      b.rect(u, t, 50, 2, cor, 4); b.hline(u, u + 49, t, cor, 5); b.hline(u, u + 49, t + 2, cor, 2); b.hline(u + 1, u + 48, t + 3, cor, 1);
      P.veios(b, u + 1, t + 4, 48, 15, cor, 3, seed, {vertical: true});
      for (let xx = u + 1; xx < u + 49; xx += 8) b.vline(xx, t + 4, t + 18, cor, 2);
      b.vline(u + 48, t + 4, t + 18, cor, 4); b.vline(u + 1, t + 4, t + 18, cor, 1);
      b.rect(u + 1, t + 19, 48, 4, 'aco', 3); b.hline(u + 1, u + 48, t + 19, 'aco', 5); b.hline(u + 1, u + 48, t + 22, 'aco', 2);
      b.rect(u + 2, t + 23, 46, CHAO - t - 22, 'carvao', 1);
      const texto = String(p.placa || '').toUpperCase().replace(/[^A-Z0-9 .:\-\/!º]/g, '');
      if (texto) {
        let s = texto; while (s && K.measure(s, '3x5') > 44) s = s.slice(0, -1);
        const w = K.measure(s, '3x5');
        b.rect(u + 25 - Math.ceil(w / 2) - 2, t + 7, w + 4, 9, cor, 2);
        b.text(u + 25, t + 9, s, cor, 1, {font: '3x5', align: 'center'});
        b.text(u + 25, t + 9, s, 'latao', 5, {font: '3x5', align: 'center', shadow: {dx: 1, dy: 1, ramp: cor, level: 1}});
      }
      // Em cima do balcão.
      b.rect(u + 3, t - 3, 5, 3, 'ceramica', 3); b.hline(u + 2, u + 8, t - 3, 'ceramica', 5); b.vline(u + 7, t - 2, t - 1, 'ceramica', 4);
      P.moita(b, u + 5, t - 6, 3.5, 3, {seed: seed % 97 + 3, cachos: 9});
      b.rect(u + 12, t - 1, 5, 1, 'aco', 3); b.sphere(u + 14.5, t - 2, 2, 1.6, 'latao', 3, 6); b.px(u + 14, t - 4, 'latao', 5);   // campainha
      b.rect(u + 19, t - 1, 9, 1, 'papel', 5); b.hline(u + 19, u + 22, t - 2, 'papel', 6); b.hline(u + 24, u + 27, t - 2, 'papel', 5); b.px(u + 23, t - 1, 'tinta', 1);
      b.line(u + 25, t - 2, u + 27, t - 4, 'tinta', 2); b.px(u + 28, t, 'cromado', 4);                      // caneta presa na correntinha
      if (p.telefone) telefoneMesa(b, u + 39, t - 7, 'plastico_preto', {led: c.energia});
      else caneca(b, u + 41, t - 3, 'vermelho');
      riscos(b, o, c, u + 1, t + 4, 48, 14);
      encardido(b, o, c, u + 1, t + 19, 48, 4);
      if (c.desgaste >= 2) { b.px(u + 9, t + 16, 'rosa_vivo', 3); b.px(u + 10, t + 16, 'rosa_vivo', 4); }                   // chiclete
      P.contato(b, u, 50);
    },
    anima(g, o, t, c) {
      if (!o.p.telefone || !c.energia) return;
      if (Math.floor(t * 1.6 + o.seed) % 3 === 0) g.px(o.u + 48, 32, g.color('led', 5, 'day'));
    }
  });

  /* ------------------------------------------------------------ telefone de mesa */
  M.modulo({
    id: 'telefone_mesa', nome: 'Telefone de mesa', grupo: 'Escritório', camada: 'parede',
    w: 13, h: 7, v: MESA - 7, livreV: true, semSombra: true,
    params: [{id: 'cor', label: 'Cor', opcoes: [['plastico_bege', 'Bege'], ['plastico_preto', 'Preto'], ['vermelho', 'Vermelho']], padrao: 'plastico_bege'}],
    interacao: {tipo: 'telefone', marca: 'discreta', dados: o => ({
      estilo: 'mesa', numero: 'Ramal 214', custo: 0, semResposta: 'Chama, chama… ninguém atende.',
      contatos: ['9 | Linha externa. Tom de discagem… e, bem baixinho, alguém respirando.',
        '100 | Ramal da portaria: “Pois não? … Sala 214? Essa sala está vazia desde março.”',
        '303 | 3º andar. Um toque. A ligação cai. O telefone toca de volta logo depois.'].join('\n'),
      recado: 'Chefe? Sou eu. Não desce pro subsolo. Seja o que for que te disserem, não desce.'})},
    area: () => ({u: -2, v: -3, w: 17, h: 11}),
    pinta(b, o, c) { telefoneMesa(b, o.u + 2, o.v, o.p.cor, {led: false}); if (c.desgaste >= 2) b.shade(o.u + 3, o.v + 3, 3, 2, -1); },
    anima(g, o, t, c) {
      if (!c.energia) return;
      if (Math.floor(t * 1.5 + o.seed) % 2) g.px(o.u + 11, o.v + 3, g.color('led', 5, 'day'));
    }
  });

  /* ------------------------------------------------------------ cadeiras de espera */
  M.modulo({
    id: 'cadeiras_espera', nome: 'Cadeiras de espera', grupo: 'Escritório', camada: 'parede',
    w: p => (p.lugares === '4' ? 4 : 3) * 11 + 2, h: 20,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'plastico', padrao: 'azul_vivo'},
      {id: 'lugares', label: 'Lugares', opcoes: [['3', 'Três'], ['4', 'Quatro']], padrao: '3'}
    ],
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, n = o.p.lugares === '4' ? 4 : 3, top = 42, random = M.rngDe(o, 4);
      const faltando = c.desgaste >= 3 ? 1 + Math.floor(random() * (n - 1)) : -1;
      const revista = Math.floor(random() * n);
      // Barra e pés.
      b.rect(u, top + 11, w, 2, 'aco', 3); b.hline(u, u + w - 1, top + 11, 'aco', 5); b.hline(u, u + w - 1, top + 12, 'aco', 2);
      for (const lx of [u + 3, u + w - 5, ...(n === 4 ? [u + Math.floor(w / 2) - 1] : [])]) {
        b.rect(lx, top + 13, 2, CHAO - top - 13, 'aco', 3); b.vline(lx + 1, top + 13, CHAO - 1, 'aco', 5);
        b.rect(lx - 2, CHAO, 6, 1, 'aco', 2); b.hline(lx - 2, lx + 3, CHAO - 1, 'aco', 3); b.shade(lx - 3, CHAO, 8, 1, -1);
      }
      for (let i = 0; i < n; i++) {
        const x0 = u + 1 + i * 11;
        if (i === faltando) { b.rect(x0 + 4, top + 8, 3, 3, 'aco', 2); b.px(x0 + 6, top + 8, 'aco', 4); continue; }
        const perfil = [[2, 8], [1, 9], [1, 9], [1, 9], [1, 9], [1, 9], [2, 8], [3, 7]];
        perfil.forEach(([a, z], yy) => {
          for (let xx = a; xx <= z; xx++) {
            let lv = xx <= a ? 2 : xx >= z ? 4 : xx >= z - 2 ? 4 : 3;
            if (yy === 0) lv = xx >= z - 1 ? 6 : 5;
            else if (yy === 1 && xx > a) lv = Math.max(lv, 4);
            if (yy === 7) lv = 2;
            b.px(x0 + xx, top + yy, cor, lv);
          }
        });
        b.hline(x0, x0 + 10, top + 8, cor, 5); b.hline(x0, x0 + 10, top + 9, cor, 4); b.hline(x0 + 1, x0 + 9, top + 10, cor, 2); b.px(x0 + 10, top + 9, cor, 5);
        if (c.desgaste >= 2 && hash2(i, 31, o.seed) > .5) b.line(x0 + 4, top + 1, x0 + 6, top + 5, cor, 1);
        if (i === revista) { b.rect(x0 + 2, top + 7, 6, 2, 'papel', 5); b.rect(x0 + 2, top + 7, 3, 1, 'vermelho', 4); b.hline(x0 + 5, x0 + 7, top + 8, 'tinta', 3); }
      }
      if (n === 4 && faltando !== 3) { b.px(u + 36, top + 8, 'papel', 5); b.px(u + 37, top + 8, 'papel', 4); }
      riscos(b, o, c, u, top + 11, w, 2);
    }
  });

  /* ------------------------------------------------------------ quadro branco */
  M.modulo({
    id: 'quadro_branco', nome: 'Quadro branco', grupo: 'Escritório', camada: 'parede',
    w: 34, h: 22, v: 13, livreV: true, semSombra: true,
    params: [{id: 'texto', label: 'Escrito no quadro', tipo: 'texto', padrao: 'META: 120%'}],
    interacao: {tipo: 'bilhete', marca: 'discreta', dados: o => ({texto: `${o.p.texto || 'META: 120%'}\n\nEmbaixo, em letra menor: “quem bater a meta vai pra casa”. Alguém riscou “pra casa” e escreveu “embora”.`, papel: 'papel', tinta: 'vermelho'})},
    pinta(b, o, c) {
      const {u, v} = o, random = M.rngDe(o, 5);
      b.rect(u + 1, v + 1, 34, 20, 'carvao', 1);
      b.bevel(u, v, 34, 20, 'aluminio', 3, 5, 1);
      b.rect(u + 1, v + 1, 32, 18, 'branco', 6);
      b.hline(u + 1, u + 32, v + 1, 'branco', 7);
      for (const [a, len] of [[4, 5], [22, 7]]) for (let i = 0; i < len; i++) b.px(u + a + i, v + 16 - i, 'branco', 7);
      // Fantasmas de coisas apagadas.
      for (let i = 0; i < 3 + c.desgaste * 2; i++) { const x = u + 3 + Math.floor(random() * 24), y = v + 11 + Math.floor(random() * 6); b.hline(x, x + 2 + Math.floor(random() * 4), y, 'branco', 5); }
      let ls = linhas3(o.p.texto, 17, 2);
      const cabeEsquerda = ls.join(' ').length >= limpa3(o.p.texto).trim().length;
      if (!cabeEsquerda) ls = linhas3(o.p.texto, 29, 2);
      ls.forEach((l, i) => escreve3(b, u + 3, v + 3 + i * 7, l, i ? 'vermelho' : 'azul_vivo', 3));
      if (cabeEsquerda) {                                                                  // gráfico que sobe… e despenca no fim
        const gx = u + 21, gy = v + 17;
        b.vline(gx, gy - 7, gy, 'plastico_preto', 2); b.hline(gx, gx + 10, gy, 'plastico_preto', 2);
        b.line(gx + 1, gy - 1, gx + 4, gy - 3, 'verde_vivo', 3); b.line(gx + 4, gy - 3, gx + 7, gy - 6, 'verde_vivo', 3); b.line(gx + 7, gy - 6, gx + 10, gy - 1, 'vermelho', 3);
      } else for (let i = 0; i < 2; i++) b.hline(u + 3, u + 8 + Math.floor(random() * 14), v + 17 - i * 2, 'plastico_preto', 3);
      b.rect(u + 26, v - 3, 5, 5, 'papel', 5); b.hline(u + 27, u + 29, v - 1, 'tinta', 3); b.hline(u + 27, u + 28, v, 'tinta', 3); b.px(u + 28, v - 3, 'vermelho', 4);
      // Canaleta com pincéis e apagador.
      b.rect(u - 1, v + 20, 36, 2, 'aluminio', 3); b.hline(u - 1, u + 34, v + 20, 'aluminio', 5); b.hline(u - 1, u + 34, v + 21, 'aluminio', 2);
      b.rect(u + 5, v + 19, 3, 1, 'vermelho', 4); b.rect(u + 9, v + 19, 3, 1, 'azul_vivo', 4); b.px(u + 11, v + 19, 'plastico_preto', 2);
      b.rect(u + 24, v + 18, 5, 2, 'tecido_cinza', 2); b.hline(u + 24, u + 28, v + 18, 'plastico_preto', 3);
      if (c.desgaste >= 2) b.shadeFn(u + 1, v + 1, 32, 18, (x, y) => (G.valueNoise(x / 4, y / 3, o.seed) > .74 ? -1 : 0));
    }
  });

  /* ------------------------------------------------------------ quadro de cortiça */
  M.modulo({
    id: 'quadro_cortica', nome: 'Quadro de cortiça', grupo: 'Escritório', camada: 'parede',
    w: 30, h: 21, v: 13, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'bilhete', marca: 'discreta', dados: () => ({texto: 'Post-it preso com três tachinhas: “ARMÁRIO 4 — 1408. Não conta pro Souza.”', papel: 'amarelo', tinta: 'tinta'})},
    pinta(b, o, c) {
      const {u, v} = o, random = M.rngDe(o, 6), cor = 'madeira_clara';
      b.rect(u + 1, v + 1, 30, 20, 'carvao', 1);
      b.rect(u, v, 30, 20, cor, 3); b.hline(u, u + 29, v, cor, 5); b.vline(u + 29, v, v + 19, cor, 4); b.hline(u, u + 29, v + 19, cor, 1); b.vline(u, v, v + 19, cor, 2);
      b.rect(u + 2, v + 2, 26, 16, 'papelao', 3);
      for (let by = 0; by < 8; by++) for (let bx = 0; bx < 13; bx++) {
        const h = hash2(bx, by, o.seed + 9), x = u + 2 + bx * 2, y = v + 2 + by * 2;
        if (h > .82) b.px(x + (by % 2), y, 'papelao', 2); else if (h < .16) b.px(x, y + 1, 'papelao', 4);
      }
      b.hline(u + 2, u + 27, v + 2, 'papelao', 2); b.vline(u + 2, v + 2, v + 17, 'papelao', 2);
      P.folha(b, u + 4, v + 4, 7, 9, random, {alfinete: 'vermelho'});
      b.rect(u + 13, v + 3, 7, 8, 'branco', 6); b.rect(u + 14, v + 4, 5, 5, 'ceu', 3); b.rect(u + 14, v + 7, 5, 2, 'folha', 3); b.px(u + 16, v + 5, 'rosa', 4); b.px(u + 16, v + 6, 'carvao', 2);
      b.px(u + 16, v + 3, 'azul_vivo', 4); b.shade(u + 13, v + 11, 7, 1, -1);
      P.folha(b, u + 21, v + 5, 6, 7, random, {alfinete: 'verde_vivo'});
      b.rect(u + 5, v + 14, 4, 3, 'amarelo_vivo', 4); b.hline(u + 5, u + 8, v + 14, 'amarelo_vivo', 5); b.hline(u + 6, u + 7, v + 15, 'tinta', 2);
      b.px(u + 5, v + 14, 'vermelho', 4); b.px(u + 8, v + 14, 'vermelho', 4); b.px(u + 6, v + 16, 'vermelho', 4);
      b.rect(u + 13, v + 13, 6, 4, 'papel', 5); b.hline(u + 14, u + 17, v + 14, 'vermelho', 3); b.hline(u + 14, u + 16, v + 15, 'tinta', 3);
      // Linha vermelha ligando três tachinhas.
      b.line(u + 16, v + 3, u + 24, v + 5, 'vermelho', 3); b.line(u + 24, v + 5, u + 22, v + 15, 'vermelho', 3); b.px(u + 22, v + 15, 'amarelo_vivo', 4);
      if (c.desgaste >= 2) { b.shade(u + 4, v + 4, 7, 9, -1, .5); b.erase(u + 26, v + 17, 2, 1); }
    }
  });

  /* ------------------------------------------------------------ divisória de baia */
  M.modulo({
    id: 'divisoria', nome: 'Divisória de baia', grupo: 'Escritório', camada: 'parede',
    w: p => Math.max(30, Math.min(160, Math.round(Number(p.largura) || 70))), h: 36,
    params: [
      {id: 'cor', label: 'Tecido', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_cinza'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 160, padrao: 70}
    ],
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, top = 26, random = M.rngDe(o, 7);
      const n = Math.max(1, Math.round(w / 24)), passo = w / n;
      for (let i = 0; i < n; i++) {
        const x0 = u + Math.round(i * passo) + 1, x1 = u + Math.round((i + 1) * passo) - 2;
        b.rect(x0, top + 2, x1 - x0 + 1, 26, cor, 3);
        b.hline(x0, x1, top + 2, cor, 4); b.hline(x0, x1, top + 3, cor, 4); b.vline(x1, top + 2, top + 27, cor, 4); b.vline(x0, top + 2, top + 27, cor, 2);
        b.hline(x0, x1, top + 27, cor, 2);
        const pw = x1 - x0 + 1, sorte = hash2(i, 41, o.seed);
        if (sorte < .35 && pw > 12) P.folha(b, x0 + 3, top + 7, 7, 9, random, {alfinete: 'azul_vivo'});
        else if (sorte < .55 && pw > 12) { b.rect(x0 + 4, top + 6, 8, 6, 'branco', 6); b.rect(x0 + 5, top + 7, 6, 3, 'agua', 3); b.rect(x0 + 5, top + 9, 6, 1, 'amarelo_vivo', 4); b.px(x0 + 8, top + 6, 'vermelho', 4); }
        else if (sorte < .75 && pw > 14) {                                                   // casaco pendurado
          b.px(x0 + pw - 6, top + 4, 'cromado', 5);
          b.poly([[x0 + pw - 9, top + 5], [x0 + pw - 3, top + 5], [x0 + pw - 2, top + 17], [x0 + pw - 10, top + 17]], 'tecido_vinho', 3);
          b.vline(x0 + pw - 6, top + 6, top + 16, 'tecido_vinho', 2); b.line(x0 + pw - 3, top + 5, x0 + pw - 2, top + 16, 'tecido_vinho', 4);
        }
        if (hash2(i, 43, o.seed) > .6) postit(b, x0 + Math.floor(pw / 2), top + 19, hash2(i, 44, o.seed) > .5 ? 'amarelo_vivo' : 'rosa_vivo');
      }
      for (let i = 0; i <= n; i++) {
        const px = Math.min(u + w - 2, u + Math.round(i * passo) - (i ? 1 : 0));
        b.rect(px, top, 2, CHAO - top, 'aluminio', 3); b.vline(px + 1, top, CHAO - 1, 'aluminio', 5);
      }
      b.rect(u, top, w, 2, 'aluminio', 3); b.hline(u, u + w - 1, top, 'aluminio', 5); b.hline(u, u + w - 1, top + 2, 'aluminio', 1);
      b.rect(u, top + 28, w, 5, 'aluminio', 3); b.hline(u, u + w - 1, top + 28, 'aluminio', 5); b.hline(u, u + w - 1, top + 32, 'aluminio', 2);
      for (let x = u + 8; x < u + w - 6; x += 24) { b.rect(x, top + 29, 4, 3, 'branco', 4); b.px(x + 1, top + 30, 'carvao', 1); b.px(x + 2, top + 30, 'carvao', 1); }
      b.rect(u, CHAO - 1, w, 2, 'aluminio', 2);
      for (let x = u + 1; x < u + w; x += Math.max(8, Math.round(passo))) b.rect(x, CHAO, 3, 1, 'borracha', 1);
      const nome = hash2(3, 3, o.seed) > .4;
      if (nome) { b.rect(u + 4, top, 9, 2, 'branco', 5); b.hline(u + 5, u + 10, top + 1, 'tinta', 2); }
      encardido(b, o, c, u, top + 2, w, 26, {forca: .5});
      P.contato(b, u, w);
    }
  });

  /* ------------------------------------------------------------ mesa do chefe */
  M.modulo({
    id: 'mesa_chefe', nome: 'Mesa do chefe', grupo: 'Escritório', camada: 'parede', semInterruptor: true,
    w: 48, h: 33,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_escura'},
      {id: 'placa', label: 'Placa', tipo: 'texto', padrao: 'DIRETOR'},
      {id: 'luminaria', label: 'Luminária acesa', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({
      titulo: 'Gavetas do diretor', estilo: 'gaveteiro', tranca: 'chave', chave: 'Gaveta do diretor', trancado: 'Gaveta de baixo',
      compartimentos: ['Gaveta de cima | Canetas-tinteiro, cartões de visita e um calendário de mesa com o dia 17 de março circulado em vermelho.',
        'Gaveta do meio | Três caixas vazias de remédio para dormir. Um bilhete dobrado: “ELE SÓ ESCUTA QUANDO A LUZ APAGA”.',
        'Gaveta de baixo (trancada) | Plantas do prédio: o subsolo tem um andar a mais do que o elevador mostra. | chave=Subsolo'].join('\n')})},
    area: o => ({u: 0, v: 3, w: o.w, h: o.h - 3}),
    pinta(b, o, c) {
      const {u} = o, p = o.p, cor = p.cor, t = 40, acesa = c.lampada(o, 'luminaria') > 0, E = EMISSIVE;
      // Poltrona de couro atrás da mesa (só o encosto capitonê aparece).
      const px0 = u + 16, py0 = t - 12, CR = 'tecido_vinho';
      for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 15; xx++) {
        if ((yy === 0 && (xx < 2 || xx > 12)) || (yy === 1 && (xx === 0 || xx === 14))) continue;
        let lv = xx >= 12 ? 4 : xx <= 1 ? 2 : 3;
        if (yy <= 1) lv = xx >= 11 ? 5 : 4;
        if (xx === 0 || (yy === 0 && xx === 2)) lv = 1;
        b.px(px0 + xx, py0 + yy, CR, lv);
      }
      for (const [dx, dy] of [[4, 4], [8, 4], [12, 4], [6, 7], [10, 7], [4, 10], [8, 10], [12, 10]]) if (px0 + dx < px0 + 14) { b.px(px0 + dx - 1, py0 + dy, CR, 1); b.px(px0 + dx - 1, py0 + dy - 1, CR, 5); }
      b.vline(px0 + 14, py0 + 2, t - 1, CR, 5);
      // Tampo.
      b.hline(u, u + 47, t, cor, 5); b.hline(u, u + 47, t + 1, cor, 4); b.hline(u, u + 47, t + 2, cor, 3); b.hline(u, u + 47, t + 3, cor, 1);
      b.px(u + 47, t + 2, cor, 4);
      // Frente com três painéis e a placa.
      b.rect(u + 1, t + 4, 46, CHAO - t - 5, cor, 2);
      for (const [x, w] of [[u + 3, 12], [u + 17, 14], [u + 33, 12]]) {
        b.bevel(x, t + 6, w, 13, cor, 3, 4, 1); b.inset(x + 2, t + 8, w - 4, 9, cor, 3, 4, 1);
      }
      b.hline(u + 1, u + 46, t + 4, cor, 3); b.vline(u + 46, t + 4, CHAO - 2, cor, 3); b.vline(u + 1, t + 4, CHAO - 2, cor, 1);
      b.rect(u, CHAO - 1, 48, 2, cor, 1); b.hline(u, u + 47, CHAO - 1, cor, 3);
      const texto = linhas3(p.placa, 36, 1)[0] || '';
      if (texto) {
        const w = mede3(texto) + 6, x = u + 24 - Math.ceil(w / 2);
        b.bevel(x, t + 9, w, 9, 'latao', 3, 5, 1);
        escreve3(b, x + 3, t + 11, texto, 'madeira_escura', 1);
      }
      // Em cima: pasta de couro, papéis, porta-canetas e a luminária de banqueiro.
      b.rect(u + 12, t - 1, 20, 2, 'couro', 2); b.hline(u + 12, u + 31, t - 1, 'couro', 3);
      papeis(b, u + 14, t - 1, 9, 2, M.rngDe(o, 8));
      b.rect(u + 24, t - 2, 6, 2, 'vermelho', 3); b.hline(u + 24, u + 29, t - 2, 'vermelho', 4); b.px(u + 26, t - 1, 'papel', 5);
      b.rect(u + 4, t - 4, 3, 4, 'latao', 3); b.vline(u + 6, t - 4, t - 1, 'latao', 5); b.px(u + 4, t - 6, 'tinta', 2); b.line(u + 5, t - 5, u + 6, t - 7, 'plastico_preto', 3);
      b.rect(u + 8, t - 3, 4, 3, 'plastico_preto', 2); b.hline(u + 8, u + 11, t - 3, 'plastico_preto', 4);                // porta-retrato de costas
      const lx = u + 37;
      b.hline(lx + 1, lx + 7, t - 1, 'latao', 3); b.hline(lx + 2, lx + 6, t - 2, 'latao', 5);
      b.vline(lx + 4, t - 6, t - 3, 'latao', 4); b.px(lx + 5, t - 5, 'latao', 6);
      b.hline(lx + 1, lx + 7, t - 10, 'verde_vivo', 4); b.hline(lx, lx + 8, t - 9, 'verde_vivo', 3); b.hline(lx, lx + 8, t - 8, 'verde_vivo', 2);
      b.px(lx + 7, t - 10, 'verde_vivo', 6); b.px(lx + 8, t - 9, 'verde_vivo', 4);
      b.hline(lx + 1, lx + 7, t - 7, acesa ? 'luz_quente' : 'latao', acesa ? 6 : 2, acesa ? E : 0);
      if (acesa) { b.hline(lx + 2, lx + 6, t - 1, 'luz_quente', 4, E); b.px(lx + 4, t - 7, 'luz_quente', 7, E); }
      riscos(b, o, c, u, t, 48, 2);
      encardido(b, o, c, u + 1, t + 4, 46, CHAO - t - 5, {forca: .5});
      P.contato(b, u, 48);
    },
    luzes(o, c) {
      const k = c.lampada(o, 'luminaria');
      if (!k) return [];
      const escuro = (c.preset?.ambient ?? 0) <= -1;
      return [{kind: 'point', X: c.wallX(o.u + 41), d: c.dParede - 18, h: c.hWall(o.v + 7), radius: escuro ? 120 : 80, strength: (escuro ? 1.7 : .7) * k, tint: 'lamp', power: 1.6,
        depthScale: .7, heightScale: .9, layers: escuro ? ['wall', 'floor', 'front', 'side'] : ['floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ relógio de ponto */
  M.modulo({
    id: 'relogio_ponto', nome: 'Relógio de ponto', grupo: 'Escritório', camada: 'parede',
    w: 21, h: 21, v: 20, livreV: true, semSombra: true,
    params: [],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('relogio_ponto') ? 'relogio_ponto' : 'exame'),
      dados: () => (root.ClueTypes?.get?.('relogio_ponto') ? {
        titulo: 'Relógio de ponto', hora: '03:17', bater: 'sim', aviso: 'BATER O PONTO É OBRIGATÓRIO',
        cartoes: ['JUREMA S. | Limpeza | 05:02, 14:00 | A primeira a chegar, todo dia.',
          'ALTAIR R. | Protocolo | 07:58, 12:02, 13:01, 18:00',
          'M. CALDEIRA | Chefia | 09:30, 18:00',
          'SEM NOME | — | 03:10 | Um cartão a mais na divisória. Entrou e não marcou saída.'].join('\n')
      } : {texto: 'Relógio de ponto e os cartões dos funcionários. Todos marcaram a saída às 18h de ontem.',
        detalhe: 'Tem um cartão a mais, sem nome. Entrada: 03:10. Não marcou saída.'})},
    pinta(b, o, c) {
      const {u, v} = o;
      b.rect(u + 1, v + 1, 10, 15, 'carvao', 1);
      b.bevel(u, v, 10, 15, 'ferro_bege', 3, 5, 1);
      b.ellipse(u + 5, v + 5, 3.6, 3.6, 'cromado', 3);
      b.ellipse(u + 5, v + 5, 2.8, 2.8, 'papel', 6);
      b.px(u + 5, v + 2, 'tinta', 2); b.px(u + 7, v + 3, 'papel', 7);
      b.rect(u + 2, v + 10, 6, 1, 'carvao', 0); b.hline(u + 2, u + 7, v + 11, 'ferro_bege', 5);
      b.rect(u + 6, v + 12, 3, 2, 'papel', 4); b.px(u + 7, v + 12, 'tinta', 2);
      b.rect(u + 1, v + 12, 2, 2, 'vermelho', 3); b.px(u + 2, v + 12, 'vermelho', 5);
      // Porta-cartões com duas colunas de cartões.
      const rx = u + 12;
      b.rect(rx, v + 1, 9, 20, 'aco', 2); b.vline(rx + 8, v + 1, v + 20, 'aco', 4); b.hline(rx, rx + 8, v + 1, 'aco', 4);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const yy = v + 3 + i * 5, xx = rx + 1 + j * 4, tem = hash2(i, j, o.seed + 3) > .18 || (i === 3 && j === 1);
        if (tem) {
          const vermelho = i === 3 && j === 1;
          b.rect(xx, yy - 2, 3, 4, 'papel', 5); b.hline(xx, xx + 2, yy - 2, vermelho ? 'vermelho' : 'papel', vermelho ? 4 : 6); b.px(xx + 2, yy - 1, 'papel', 4);
        }
        b.hline(xx - 1, xx + 3, yy + 2, 'aco', 5); b.hline(xx - 1, xx + 3, yy + 3, 'aco', 1);
      }
      if (c.desgaste >= 2) { b.shade(u + 1, v + 1, 8, 13, -1, .35); ferrugem(b, o, c, rx, v + 1, 9, 19, {min: 2, dens: .6}); }
    },
    anima(g, o, t, c) {
      const stage = c.stage;
      const [hh, mm] = String(stage?.clock || '15:10').split(':').map(Number);
      const min = (hh % 12) * 60 + (mm || 0) + ((stage?.time || 0) - (stage?.clockSetAt || 0)) / 60;
      const cx = o.u + 5, cy = o.v + 5, cor = g.color('tinta', 1);
      const a = (min % 60) / 60 * Math.PI * 2, h = min / 720 * Math.PI * 2;
      g.line(cx, cy, cx + Math.round(Math.sin(a) * 2), cy - Math.round(Math.cos(a) * 2), cor);
      g.px(cx + Math.round(Math.sin(h)), cy - Math.round(Math.cos(h)), cor);
    }
  });

  /* ================================================================ DEPÓSITO */

  /* ------------------------------------------------------------ armários de metal */
  const ARMARIOS = [
    'Armário 1 — SOUZA | Uniforme dobrado, um desodorante vazio e uma foto 3x4 com os olhos riscados.',
    'Armário 2 — sem nome | Vazio. No fundo da porta, arranhões feitos de dentro para fora.',
    'Armário 3 — MARTA | Tênis de corrida, uma garrafinha e um terço enrolado no gancho. | agua',
    'Armário 4 — cadeado de segredo | Um macacão sujo de graxa, uma lanterna sem pilha e um crachá do subsolo. | chave=Crachá do subsolo',
    'Armário 5 — RAMALHO | Marmitas empilhadas, todas cheias, de dias diferentes.',
    'Armário 6 — nome riscado | Um rádio de pilha ligado baixinho, sintonizado em lugar nenhum. | bandage'
  ];
  const nPortas = p => ({3: 3, 4: 4, 6: 6}[p.portas] || 4);
  const colunasArmario = p => nPortas(p) === 6 ? 3 : nPortas(p);
  M.modulo({
    id: 'armario_metal', nome: 'Armários de metal', grupo: 'Depósito', camada: 'parede',
    w: p => colunasArmario(p) * 9 + 2, h: 42,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'ferro_azul'},
      {id: 'portas', label: 'Portas', opcoes: [['3', 'Três'], ['4', 'Quatro'], ['6', 'Seis (duas fileiras)']], padrao: '4'},
      {id: 'aberto', label: 'Uma porta aberta', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => {
      const n = nPortas(o.p), cadeado = Math.min(4, n);
      const lista = ARMARIOS.slice(0, n).map((l, i) => i + 1 === cadeado && cadeado !== 4 ? l.replace(/^Armário \d — [^|]*/, `Armário ${i + 1} — cadeado de segredo `) : l);
      if (n < 4) lista[cadeado - 1] = `Armário ${cadeado} — cadeado de segredo | ${ARMARIOS[3].split('|').slice(1).join('|').trim()}`;
      return {titulo: 'Armários dos funcionários', estilo: 'armario_metal', tranca: 'codigo', codigo: '1408', trancado: `Armário ${cadeado}`, compartimentos: lista.join('\n')};
    }},
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, n = nPortas(o.p), cols = colunasArmario(o.p), fileiras = n === 6 ? 2 : 1, top = 20;
      const aberto = c.estado(o, 'aberto'), cadeado = Math.min(4, n) - 1;
      b.rect(u, top, w, CHAO - top + 1, cor, 2);
      b.hline(u, u + w - 1, top, cor, 5); b.hline(u, u + w - 1, top + 1, cor, 4); b.vline(u + w - 1, top, CHAO, cor, 4); b.vline(u, top + 1, CHAO, cor, 1);
      b.rect(u + 1, CHAO - 3, w - 2, 4, cor, 1); b.hline(u + 1, u + w - 2, CHAO - 3, cor, 3);
      const alturaPorta = fileiras === 2 ? 17 : 35;
      for (let f = 0; f < fileiras; f++) for (let i = 0; i < cols; i++) {
        const idx = f * cols + i, x0 = u + 1 + i * 9, y0 = top + 2 + f * 18, y1 = y0 + alturaPorta - 1;
        if (aberto && idx === 1) {
          b.rect(x0, y0, 8, alturaPorta, 'carvao', 1);
          b.hline(x0, x0 + 7, y0 + 5, cor, 3); b.hline(x0, x0 + 7, y0 + 6, 'carvao', 0);
          b.sphere(x0 + 4, y0 + 3, 2.5, 2, 'amarelo_vivo', 2, 5); b.hline(x0 + 1, x0 + 7, y0 + 4, 'amarelo_vivo', 2);
          if (alturaPorta > 20) {
            b.px(x0 + 4, y0 + 8, 'cromado', 4);
            b.poly([[x0 + 1, y0 + 9], [x0 + 7, y0 + 9], [x0 + 8, y0 + 24], [x0, y0 + 24]], 'tecido_azul', 2);
            b.vline(x0 + 4, y0 + 10, y0 + 23, 'tecido_azul', 1); b.line(x0 + 6, y0 + 9, x0 + 7, y0 + 23, 'tecido_azul', 3);
            b.rect(x0 + 1, y1 - 3, 3, 4, 'couro_preto', 3); b.rect(x0 + 5, y1 - 3, 3, 4, 'couro_preto', 2); b.hline(x0 + 1, x0 + 7, y1 - 3, 'couro_preto', 4);
          } else { b.rect(x0 + 1, y0 + 9, 6, 5, 'tecido_azul', 2); b.hline(x0 + 1, x0 + 6, y0 + 9, 'tecido_azul', 3); }
          b.rect(x0 - 3, y0 - 1, 3, alturaPorta + 2, cor, 3); b.vline(x0 - 1, y0 - 1, y1 + 1, cor, 5); b.vline(x0 - 3, y0 - 1, y1 + 1, cor, 2);
          b.px(x0 - 2, y0 + 4, 'ceu', 4); b.px(x0 - 2, y0 + 5, 'rosa', 4);
          continue;
        }
        b.rect(x0, y0, 8, alturaPorta, cor, 3);
        b.hline(x0, x0 + 7, y0, cor, 4); b.vline(x0 + 7, y0, y1, cor, 4); b.vline(x0, y0, y1, cor, 2); b.hline(x0, x0 + 7, y1, cor, 2);
        for (let k = 0; k < (fileiras === 2 ? 2 : 3); k++) { b.hline(x0 + 2, x0 + 5, y0 + 2 + k * 2, cor, 1); b.hline(x0 + 2, x0 + 5, y0 + 3 + k * 2, cor, 4); }
        const py = y0 + (fileiras === 2 ? 6 : 9);
        b.rect(x0 + 2, py, 5, 3, 'cromado', 4); b.hline(x0 + 2, x0 + 6, py, 'cromado', 5); b.px(x0 + 4, py + 1, 'tinta', 1);
        b.text(x0 + 2, py + 4, String(idx + 1), cor, 5, {font: '3x5'});
        const hy = y0 + Math.floor(alturaPorta / 2) + (fileiras === 2 ? 1 : 2);
        b.rect(x0 + 5, hy, 2, 3, 'cromado', 3); b.px(x0 + 6, hy, 'cromado', 5);
        if (idx === cadeado) { b.rect(x0 + 4, hy + 3, 3, 3, 'latao', 3); b.px(x0 + 6, hy + 3, 'latao', 5); b.px(x0 + 5, hy + 4, 'carvao', 1); b.px(x0 + 4, hy + 2, 'aco', 4); b.px(x0 + 6, hy + 2, 'aco', 4); }
        if (hash2(idx, 51, o.seed) > .55 && alturaPorta > 20) { b.hline(x0 + 2, x0 + 5, y0 + 8 - 1, 'papel', 5); b.px(x0 + 3, y0 + 7, 'tinta', 2); }
        if (hash2(idx, 52, o.seed) > .8) { b.rect(x0 + 1, y1 - 7, 2, 2, ['vermelho', 'amarelo_vivo', 'verde_vivo'][idx % 3], 4); }
        if (c.desgaste >= 2 && hash2(idx, 53, o.seed) > .6) b.shade(x0 + 1, y0 + alturaPorta - 10, 3, 3, -1);
      }
      if (fileiras === 2) b.hline(u + 1, u + w - 2, top + 19, cor, 1);
      ferrugem(b, o, c, u + 1, top + 2, w - 2, CHAO - top - 5, {min: 1, dens: .7});
      riscos(b, o, c, u + 1, top + 2, w - 2, CHAO - top - 5);
      P.contato(b, u, w);
    }
  });

  /* ------------------------------------------------------------ prateleira industrial */
  const CONTEUDO_PRATELEIRA = {
    caixas: ['Caixa de cima | Notas fiscais molhadas, grudadas umas nas outras.', 'Caixa do meio | Lâmpadas fluorescentes novas, embrulhadas num jornal de 1989.', 'Caixa de baixo | Fusíveis antigos numa lata de biscoito. | fusivel'],
    pecas: ['Gavetinhas azuis | Parafusos, porcas e arruelas, separados com capricho.', 'Gavetinhas vermelhas | Fusíveis de cerâmica e um alicate. | fusivel', 'Prateleira de baixo | Um rolo de fio e uma luva só, da mão esquerda.'],
    latas: ['Latas de tinta | Tinta branca empedrada. Por dentro de uma tampa, um nome escrito com o dedo.', 'Latas sem rótulo | Querosene. O cheiro gruda na roupa.', 'Prateleira de baixo | Pincéis duros, lixa e uma bandagem ainda na embalagem. | bandage'],
    vazia: ['Prateleiras | Só poeira e as marcas retangulares de onde havia caixas. Levaram tudo com pressa.']
  };
  function caixaPapelao(b, x, base, w, h, seed, {etiqueta = true} = {}) {
    const y = base - h + 1, s = seed >>> 0;
    b.rect(x, y, w, h, 'papelao', 3);
    b.hline(x, x + w - 1, y, 'papelao', 5); b.vline(x + w - 1, y, base, 'papelao', 4); b.vline(x, y + 1, base, 'papelao', 2); b.hline(x, x + w - 1, base, 'papelao', 1);
    const mx = x + Math.floor(w / 2);
    if (h >= 4) { b.vline(mx, y, y + Math.min(2, h - 2), 'papelao', 5); b.px(mx, y + Math.min(3, h - 1), 'papelao', 4); }
    const tipo = s % 4;
    if (!etiqueta || w < 7 || h < 5) return;
    if (tipo === 0) { b.rect(x + w - 6, base - 3, 4, 2, 'papel', 5); b.hline(x + w - 6, x + w - 3, base - 2, 'papel', 4); }
    else if (tipo === 1) { b.hline(x + 1, x + Math.min(w - 2, 5), y + 3, 'tinta', 2); b.hline(x + 1, x + 3, y + 4, 'tinta', 2); }
    else if (tipo === 2 && w >= 9 && h >= 6) { const ax = x + w - 4; b.px(ax, y + 2, 'tinta', 2); b.vline(ax, y + 3, y + 4, 'tinta', 2); b.px(ax - 1, y + 3, 'tinta', 2); b.px(ax + 1, y + 3, 'tinta', 2); }
    else b.rect(x + 1, y + 2, 2, 2, 'vermelho', 3);
  }
  M.modulo({
    id: 'prateleira_industrial', nome: 'Prateleira industrial', grupo: 'Depósito', camada: 'parede', w: 40, h: 44,
    params: [{id: 'conteudo', label: 'Conteúdo', opcoes: [['caixas', 'Caixas'], ['pecas', 'Peças e gavetinhas'], ['latas', 'Latas de tinta'], ['vazia', 'Vazia']], padrao: 'caixas'}],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('estante_movel') ? 'estante_movel' : 'recipiente'),
      dados: o => {
        const linhas = (CONTEUDO_PRATELEIRA[o.p.conteudo] || CONTEUDO_PRATELEIRA.caixas).join('\n');
        return {titulo: 'Prateleira do depósito', estilo: root.ClueTypes?.get?.('estante_movel') ? 'industrial' : 'caixa',
          prateleiras: linhas, compartimentos: linhas, tranca: 'nenhuma',
          aviso: 'NÃO EMPILHAR ACIMA DA LINHA AMARELA'};
      }},
    pinta(b, o, c) {
      const {u} = o, top = 18, random = M.rngDe(o, 9), cont = o.p.conteudo, vigas = [top + 2, top + 14, top + 26, top + 38];
      b.shade(u + 2, top, 36, CHAO - top + 1, -1);
      const niveis = [[top + 4, top + 13], [top + 16, top + 25], [top + 28, top + 37], [top + 40, CHAO]];
      niveis.forEach(([a, z], nivel) => {
        const alto = z - a + 1;
        let x = u + 3;
        if (cont === 'vazia') {
          if (nivel === 2) { b.rect(u + 20, z - 1, 5, 2, 'tecido_mostarda', 3); b.px(u + 24, z - 1, 'tecido_mostarda', 5); }
          if (nivel === 3) caixaPapelao(b, u + 6, z, 9, 5, o.seed, {etiqueta: false});
          b.shade(u + 3, z, 34, 1, -1, .5);
          return;
        }
        while (x < u + 36) {
          if (cont === 'pecas' && nivel < 2) {
            const cor = nivel === 0 ? 'azul_vivo' : 'vermelho';
            if (x + 5 > u + 37) break;
            b.rect(x, z - 4, 5, 5, cor, 3); b.hline(x, x + 4, z - 4, cor, 5); b.vline(x + 4, z - 4, z, cor, 4);
            b.rect(x + 1, z - 2, 3, 2, cor, 2); b.px(x + 2, z - 3, 'papel', 5);
            x += 6; continue;
          }
          if (cont === 'pecas') {
            if (nivel === 2) { for (let i = 0; i < 3; i++) { b.rect(u + 4, z - 1 - i * 2, 16, 2, 'cromado', 3); b.hline(u + 4, u + 19, z - 1 - i * 2, 'cromado', 5); b.ellipse(u + 4, z - i * 2, 1, 1, 'aco', 1); } b.sphere(u + 28, z - 4, 5, 4, 'laranja', 2, 4); b.ellipse(u + 28, z - 4, 2, 1.6, 'carvao', 1); }
            else { b.sphere(u + 10, z - 3, 4, 3, 'borracha', 1, 3); b.ellipse(u + 10, z - 3, 1.5, 1, 'carvao', 0); caixaPapelao(b, u + 20, z, 12, 7, o.seed + 1); }
            break;
          }
          if (cont === 'latas') {
            if (x + 5 > u + 37) break;
            const cor = ['vermelho', 'azul_vivo', 'branco', 'verde_vivo', 'amarelo_vivo'][Math.floor(random() * 5)], hh = Math.min(alto - 1, 6);
            for (let k = 0; k < (alto >= 12 && random() < .4 ? 2 : 1); k++) {
              const bb = z - k * (hh + 1);
              b.rect(x, bb - hh + 1, 5, hh, 'aco', 3); b.vline(x + 3, bb - hh + 1, bb, 'aco', 5); b.vline(x, bb - hh + 1, bb, 'aco', 2);
              b.hline(x, x + 4, bb - hh + 1, 'aco', 5); b.rect(x, bb - hh + 3, 5, 3, cor, 3); b.px(x + 3, bb - hh + 3, cor, 5);
              if (random() < .4) b.vline(x + 1, bb - hh + 2, bb - hh + 4, cor, 4);
            }
            x += 6; continue;
          }
          const bw = 7 + Math.floor(random() * 6), bh = Math.min(alto - 1, 5 + Math.floor(random() * (alto - 5)));
          if (x + bw > u + 37) { if (u + 37 - x >= 5) caixaPapelao(b, x, z, u + 37 - x, Math.min(bh, 6), o.seed + nivel); break; }
          caixaPapelao(b, x, z, bw, bh, o.seed + nivel * 7 + x);
          x += bw + (random() < .3 ? 1 : 0);
        }
      });
      for (const y of vigas) { b.rect(u + 1, y, 38, 2, 'laranja', 3); b.hline(u + 1, u + 38, y, 'laranja', 5); b.hline(u + 1, u + 38, y + 1, 'laranja', 2); b.hline(u + 2, u + 37, y - 1, 'madeira_clara', 3); }
      for (const x of [u, u + 38]) {
        b.rect(x, top, 2, CHAO - top + 1, 'ferro_azul', 3); b.vline(x + 1, top, CHAO, 'ferro_azul', x === u ? 4 : 5); b.vline(x, top, CHAO, 'ferro_azul', 2);
        for (let y = top + 2; y < CHAO - 1; y += 3) b.px(x + (x === u ? 1 : 0), y, 'carvao', 1);
        b.rect(x - 1, CHAO, 4, 1, 'ferro_azul', 2);
      }
      encardido(b, o, c, u, top, 40, CHAO - top + 1, {forca: .7});
      ferrugem(b, o, c, u, top, 40, CHAO - top, {min: 2, dens: .5});
      P.contato(b, u, 40);
    }
  });

  /* ------------------------------------------------------------ caixas empilhadas */
  const CONTEUDO_CAIXAS = {
    papelao: ['Caixa de cima | Enfeites de Natal e um pisca-pisca que acende sozinho quando ninguém olha.', 'Caixa do meio | Pastas de 1998 amarradas com barbante.', 'Caixa de baixo | Copos descartáveis e um saco de açúcar empedrado. | moedas*1'],
    madeira: ['Caixote de cima | Palha e garrafas vazias, sem rótulo.', 'Caixote do meio | Uma tábua lisa e um rolo de esparadrapo. | splint', 'Caixote de baixo | Ferramentas enferrujadas enroladas num pano.'],
    plastico: ['Engradado de cima | Revistas velhas e um salgadinho vencido. | salgadinho', 'Engradado do meio | Batatas brotando no escuro.', 'Engradado de baixo | Garrafas de refrigerante, uma ainda cheia. | refrigerante']
  };
  const TAM_CAIXA = {papelao: [16, 9], madeira: [18, 10], plastico: [16, 8]};
  M.modulo({
    id: 'caixas', nome: 'Caixas empilhadas', grupo: 'Depósito', camada: 'parede',
    w: p => (TAM_CAIXA[p.tipo] || TAM_CAIXA.papelao)[0] + 2, h: p => (TAM_CAIXA[p.tipo] || TAM_CAIXA.papelao)[1] * (Number(p.pilha) || 2) + 1,
    params: [
      {id: 'pilha', label: 'Pilha', opcoes: [['1', 'Uma'], ['2', 'Duas'], ['3', 'Três']], padrao: '2'},
      {id: 'tipo', label: 'Tipo', opcoes: [['papelao', 'Papelão'], ['madeira', 'Caixote de madeira'], ['plastico', 'Engradado de plástico']], padrao: 'papelao'}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => {
      const n = Number(o.p.pilha) || 2, lista = CONTEUDO_CAIXAS[o.p.tipo] || CONTEUDO_CAIXAS.papelao;
      return {titulo: o.p.tipo === 'plastico' ? 'Engradados' : o.p.tipo === 'madeira' ? 'Caixotes' : 'Caixas de papelão', estilo: 'caixa', tranca: 'nenhuma', compartimentos: lista.slice(3 - n).join('\n')};
    }},
    pinta(b, o, c) {
      const {u} = o, tipo = o.p.tipo, n = Number(o.p.pilha) || 2, [bw, bh] = TAM_CAIXA[tipo] || TAM_CAIXA.papelao;
      const corPlastico = ['azul_vivo', 'vermelho', 'verde_vivo', 'amarelo_vivo'][o.seed % 4];
      for (let i = 0; i < n; i++) {
        const dx = i === 0 ? 1 : 1 + Math.round((hash2(i, 61, o.seed) - .5) * 3), base = CHAO - i * bh, y = base - bh + 1, x = u + dx;
        if (tipo === 'madeira') {
          b.rect(x, y, bw, bh, 'madeira_clara', 2);
          for (let k = 0; k < 3; k++) { const yy = y + 1 + k * 3; b.rect(x + 2, yy, bw - 4, 2, 'madeira_clara', 3 + (k === 0 ? 1 : 0)); b.hline(x + 2, x + bw - 3, yy, 'madeira_clara', 4); }
          b.rect(x, y, 2, bh, 'madeira_clara', 3); b.rect(x + bw - 2, y, 2, bh, 'madeira_clara', 4); b.vline(x + bw - 1, y, base, 'madeira_clara', 5);
          b.hline(x, x + bw - 1, y, 'madeira_clara', 5); b.hline(x, x + bw - 1, base, 'madeira_clara', 1);
          b.line(x + 2, base - 1, x + bw - 3, y + 1, 'madeira_clara', 3);
          for (const px of [x + 1, x + bw - 2]) { b.px(px, y + 2, 'aco', 4); b.px(px, base - 2, 'aco', 4); }
          if (i === 0) { b.rect(x + bw / 2 - 4, y + 3, 8, 5, 'madeira_clara', 3); b.text(x + bw / 2, y + 3, 'N7', 'carvao', 2, {font: '3x5', align: 'center'}); }
        } else if (tipo === 'plastico') {
          b.rect(x, y, bw, bh, corPlastico, 3);
          b.hline(x, x + bw - 1, y, corPlastico, 5); b.vline(x + bw - 1, y, base, corPlastico, 4); b.vline(x, y, base, corPlastico, 2); b.hline(x, x + bw - 1, base, corPlastico, 2);
          b.rect(x + 5, y + 1, 6, 2, 'carvao', 1);
          for (let xx = x + 2; xx < x + bw - 2; xx += 3) b.rect(xx, y + 4, 2, bh - 5, 'carvao', 1);
          const dentro = ['vidro', 'terra', 'papel'][(i + o.seed) % 3];
          for (let xx = x + 2; xx < x + bw - 2; xx += 3) b.px(xx + 1, y + 4, dentro, 4);
        } else {
          caixaPapelao(b, x, base, bw, bh, o.seed + i * 3);
          b.hline(x, x + bw - 1, y + 1, 'papelao', 4);
          if (c.desgaste >= 2 && i === n - 1) { b.shade(x + bw - 4, y, 4, 3, -1); b.px(x + bw - 1, y, 'papelao', 2); }
        }
      }
      encardido(b, o, c, u, CHAO - n * bh + 1, bw + 2, n * bh, {forca: .6});
      P.contato(b, u + 1, bw);
    }
  });

  /* ------------------------------------------------------------ palete */
  M.modulo({
    id: 'palete', nome: 'Palete', grupo: 'Depósito', camada: 'parede',
    w: 30, h: p => p.carga === 'vazio' ? 5 : p.carga === 'sacos' ? 17 : 22,
    params: [{id: 'carga', label: 'Carga', opcoes: [['sacos', 'Sacos'], ['caixas', 'Caixas embaladas'], ['vazio', 'Vazio']], padrao: 'sacos'}],
    pinta(b, o, c) {
      const {u} = o, W = 'madeira_clara', carga = o.p.carga;
      // Palete: tábuas de cima, blocos com os vãos do garfo e tábua de baixo.
      b.hline(u, u + 29, CHAO - 4, W, 5); b.hline(u, u + 29, CHAO - 3, W, 3);
      for (let x = u + 3; x < u + 29; x += 5) b.px(x, CHAO - 4, W, 4);
      b.rect(u + 1, CHAO - 2, 28, 2, 'carvao', 0);
      for (const x of [u, u + 13, u + 26]) { b.rect(x, CHAO - 2, 4, 2, W, 3); b.vline(x + 3, CHAO - 2, CHAO - 1, W, 4); b.px(x + 1, CHAO - 2, 'carvao', 2); }
      b.hline(u, u + 29, CHAO, W, 2);
      if (carga === 'sacos') {
        const saco = ['papel', 'lencol'][o.seed % 2];
        for (let camada = 0; camada < 3; camada++) {
          const y = CHAO - 8 - camada * 4, off = camada % 2 ? 5 : 0;
          for (let i = 0; i < 3; i++) {
            const x = u + off + i * 10 - (camada % 2 ? 0 : 0);
            if (x + 9 > u + 30) { b.rect(x, y, u + 30 - x, 4, saco, 3); b.hline(x, u + 29, y, saco, 4); continue; }
            b.rect(x, y + 1, 9, 3, saco, 3); b.hline(x + 1, x + 7, y, saco, 4); b.hline(x + 2, x + 6, y, saco, 5);
            b.vline(x, y + 1, y + 2, saco, 2); b.vline(x + 8, y + 1, y + 2, saco, 4); b.hline(x + 1, x + 7, y + 3, saco, 2);
            if ((i + camada + o.seed) % 3 === 0) b.hline(x + 3, x + 5, y + 2, saco === 'papel' ? 'vermelho' : 'verde_vivo', 3);
          }
        }
        if (c.desgaste >= 2) { b.px(u + 12, CHAO - 5, saco, 5); b.px(u + 13, CHAO - 5, saco, 4); b.px(u + 15, CHAO - 5, saco, 5); }
      } else if (carga === 'caixas') {
        for (let camada = 0; camada < 2; camada++) for (let i = 0; i < 3; i++) caixaPapelao(b, u + 1 + i * 9 + (camada ? 1 : 0), CHAO - 5 - camada * 8, 9, 8, o.seed + camada * 3 + i);
        for (let i = 0; i < 44; i += 6) for (let t = 0; t < 16; t++) { const x = u + 1 + i - t, y = CHAO - 20 + t; if (x >= u + 1 && x < u + 29 && bayer(x, y) < .5) b.px(x, y, 'vidro', 5); }
        b.hline(u + 1, u + 28, CHAO - 20, 'vidro', 5); b.rect(u + 11, CHAO - 14, 7, 4, 'papel', 6); b.hline(u + 12, u + 16, CHAO - 13, 'tinta', 2); b.hline(u + 12, u + 14, CHAO - 11, 'tinta', 2);
      }
      encardido(b, o, c, u, CHAO - 4, 30, 5);
      P.contato(b, u, 30, {alto: 2});
    }
  });

  /* ------------------------------------------------------------ tambores */
  M.modulo({
    id: 'tambor', nome: 'Tambores', grupo: 'Depósito', camada: 'parede',
    w: p => (Number(p.quantidade) || 1) * 15, h: 23,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'ferro_azul'},
      {id: 'quantidade', label: 'Quantidade', opcoes: [['1', 'Um'], ['2', 'Dois'], ['3', 'Três']], padrao: '2'}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Tambores de metal. Um deles está pela metade com um líquido escuro e grosso, que não cheira a óleo.',
      detalhe: 'Na tampa, alguém arranhou com a unha: NÃO É ÓLEO.'})},
    pinta(b, o, c) {
      const {u} = o, n = Number(o.p.quantidade) || 1, top = 40;
      for (let i = 0; i < n; i++) {
        const x = u + i * 15, cor = i === 2 ? 'vermelho' : i === 1 && o.p.cor !== 'ferro_verde' ? 'ferro_verde' : o.p.cor;
        const perfil = [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 4, 3, 2, 2];
        for (let xx = 0; xx < 14; xx++) for (let yy = top + 2; yy <= CHAO; yy++) b.px(x + xx, yy, cor, perfil[xx]);
        for (const r of [top + 8, top + 15]) { b.hline(x, x + 13, r, cor, 5); b.hline(x, x + 13, r + 1, cor, 2); b.px(x + 9, r, cor, 6); }
        b.hline(x + 1, x + 12, top, cor, 4); b.hline(x, x + 13, top + 1, cor, 5); b.hline(x + 2, x + 11, top + 2, cor, 3);
        b.px(x + 3, top + 1, 'cromado', 4); b.px(x + 10, top + 1, 'cromado', 5);
        b.hline(x, x + 13, CHAO, cor, 1);
        if (i === 0) {
          b.poly([[x + 7, top + 10], [x + 10.5, top + 13.5], [x + 7, top + 17], [x + 3.5, top + 13.5]], 'amarelo_vivo', 4);
          b.px(x + 7, top + 12, 'carvao', 1); b.px(x + 7, top + 13, 'carvao', 1); b.px(x + 6, top + 14, 'carvao', 1); b.px(x + 8, top + 14, 'carvao', 1);
        } else if (i === 1) { b.rect(x + 3, top + 10, 8, 4, 'papel', 5); b.hline(x + 4, x + 9, top + 11, 'tinta', 2); b.hline(x + 4, x + 7, top + 12, 'tinta', 3); }
        else { b.hline(x + 3, x + 10, top + 12, 'branco', 5); b.hline(x + 3, x + 10, top + 13, 'branco', 4); }
        if (c.desgaste >= 1) { b.vline(x + 4, top + 2, top + 5 + c.desgaste * 2, 'oleo', 2); b.px(x + 5, top + 2, 'oleo', 3); }
        ferrugem(b, o, c, x, top + 2, 14, CHAO - top - 2, {min: 1, dens: 1.2});
        if (c.desgaste >= 3 && i === n - 1) { b.shade(x + 9, top + 5, 3, 4, -2); b.px(x + 10, top + 6, cor, 5); }
      }
      if (c.desgaste >= 2) b.hline(u + 2, u + Math.min(n * 15 - 2, 12), CHAO, 'oleo', 2);
      P.contato(b, u, n * 15 - 1);
    }
  });

  /* ------------------------------------------------------------ paleteira manual */
  M.modulo({
    id: 'empilhadeira', nome: 'Paleteira manual', grupo: 'Depósito', camada: 'parede', w: 36, h: 33,
    params: [],
    pinta(b, o, c) {
      const {u} = o, R = 'vermelho';
      // Garfos rentes ao chão.
      b.rect(u + 11, CHAO - 4, 25, 3, R, 3); b.hline(u + 11, u + 35, CHAO - 4, R, 5); b.hline(u + 11, u + 35, CHAO - 2, R, 1);
      b.px(u + 35, CHAO - 3, R, 4);
      for (const x of [u + 31, u + 24]) { b.rect(x, CHAO - 1, 3, 2, 'borracha', 1); b.px(x + 2, CHAO - 1, 'borracha', 3); }
      // Corpo da bomba hidráulica.
      b.rect(u + 6, CHAO - 12, 8, 9, R, 3); b.hline(u + 6, u + 13, CHAO - 12, R, 5); b.vline(u + 13, CHAO - 12, CHAO - 4, R, 4); b.vline(u + 6, CHAO - 12, CHAO - 4, R, 2);
      b.rect(u + 8, CHAO - 18, 3, 6, 'cromado', 3); b.vline(u + 10, CHAO - 18, CHAO - 13, 'cromado', 5); b.hline(u + 7, u + 11, CHAO - 18, R, 4);
      b.px(u + 12, CHAO - 9, 'amarelo_vivo', 4); b.px(u + 12, CHAO - 8, 'carvao', 1);
      // Rodas de direção.
      b.ellipse(u + 9.5, CHAO - 2, 3.4, 3.4, 'carvao', 0);
      b.sphere(u + 9.5, CHAO - 2.5, 3, 3, 'borracha', 1, 4); b.rect(u + 9, CHAO - 3, 2, 2, 'aco', 4);
      // Timão e alça.
      for (let t = 0; t <= 13; t++) { const x = Math.round(u + 9 - t * .3), y = CHAO - 18 - t; b.px(x, y, R, 3); b.px(x + 1, y, R, 5); }
      const hx = u + 5, hy = CHAO - 32;
      b.hline(hx - 3, hx + 4, hy, 'plastico_preto', 4); b.hline(hx - 3, hx + 4, hy + 1, 'plastico_preto', 2);
      b.vline(hx - 3, hy + 1, hy + 3, 'plastico_preto', 2); b.vline(hx + 4, hy + 1, hy + 3, 'plastico_preto', 3);
      b.hline(hx - 2, hx + 3, hy + 3, R, 3); b.px(hx + 3, hy + 3, R, 5);
      b.px(hx + 1, hy + 2, 'cromado', 5);
      riscos(b, o, c, u + 11, CHAO - 4, 25, 2);
      ferrugem(b, o, c, u + 6, CHAO - 12, 30, 10, {min: 2, dens: .6});
      b.shade(u + 5, CHAO, 31, 1, -1, .6);
    }
  });

  /* ================================================================ OFICINA */

  /* ------------------------------------------------------------ bancada de ferramentas */
  M.modulo({
    id: 'bancada_ferramentas', nome: 'Bancada de ferramentas', grupo: 'Oficina', camada: 'parede', w: 46, h: 30,
    params: [{id: 'cor', label: 'Tampo', opcoes: METAL_OU_MADEIRA, padrao: 'madeira'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Bancada', estilo: 'bancada', tranca: 'nenhuma',
      compartimentos: ['Gaveta da bancada | Brocas, fita isolante e um fusível ainda na embalagem. | fusivel',
        'Caixa de ferramentas | Chave de roda, alicate, um rolo de esparadrapo e uma tala de madeira improvisada. | splint',
        'Na morsa | Um pedaço de metal preso e amassado até perder a forma. Parece ter sido uma fechadura.'].join('\n')})},
    area: o => ({u: 0, v: 3, w: o.w, h: o.h - 3}),
    pinta(b, o, c) {
      const {u} = o, cor = o.p.cor, madeira = ehMadeira(cor), t = 40, estrutura = madeira ? cor : 'aco';
      // Pés, travessa e prateleira de baixo.
      for (const x of [u + 1, u + 42]) { b.rect(x, t + 4, 3, CHAO - t - 3, estrutura, 3); b.vline(x + 2, t + 4, CHAO, estrutura, 4); b.vline(x, t + 4, CHAO, estrutura, 2); }
      b.rect(u + 1, 54, 44, 2, estrutura, 3); b.hline(u + 1, u + 44, 54, estrutura, 5); b.hline(u + 1, u + 44, 55, estrutura, 1);
      b.shade(u + 4, t + 4, 38, 10, -1);
      b.rect(u + 6, 47, 12, 7, 'vermelho', 3); b.hline(u + 6, u + 17, 47, 'vermelho', 5); b.vline(u + 17, 47, 53, 'vermelho', 4); b.hline(u + 6, u + 17, 50, 'vermelho', 2);
      b.rect(u + 10, 45, 4, 1, 'plastico_preto', 3); b.px(u + 10, 46, 'plastico_preto', 2); b.px(u + 13, 46, 'plastico_preto', 2); b.px(u + 11, 51, 'cromado', 5);
      b.rect(u + 22, 48, 5, 6, 'amarelo_vivo', 3); b.vline(u + 26, 48, 53, 'amarelo_vivo', 5); b.rect(u + 23, 46, 2, 2, 'amarelo_vivo', 4); b.px(u + 25, 50, 'plastico_preto', 2);
      b.poly([[u + 31, 53], [u + 39, 51], [u + 40, 54], [u + 30, 54]], 'tecido_azul', 3); b.px(u + 35, 52, 'oleo', 2);
      // Tampo.
      if (madeira) {
        P.veios(b, u, t, 46, 4, cor, 3, o.seed);
        b.hline(u, u + 45, t, cor, 5); b.hline(u, u + 45, t + 1, cor, 4); b.hline(u, u + 45, t + 3, cor, 1);
        for (let x = u + 6; x < u + 44; x += 8) b.vline(x, t + 2, t + 3, cor, 2);
      } else { b.rect(u, t, 46, 4, 'aco', 3); b.hline(u, u + 45, t, 'aco', 5); b.hline(u, u + 45, t + 1, 'aco', 4); b.hline(u, u + 45, t + 3, 'aco', 1); b.px(u + 2, t + 2, 'aco', 5); b.px(u + 43, t + 2, 'aco', 5); }
      b.rect(u + 29, t + 4, 12, 4, estrutura, 3); b.hline(u + 29, u + 40, t + 4, estrutura, 2); b.hline(u + 33, u + 36, t + 6, 'cromado', 5);
      // Morsa na ponta esquerda.
      b.rect(u + 2, t - 5, 8, 5, 'ferro_azul', 3); b.hline(u + 2, u + 9, t - 5, 'ferro_azul', 5); b.vline(u + 9, t - 5, t - 1, 'ferro_azul', 4);
      b.rect(u + 1, t - 7, 3, 2, 'aco', 4); b.rect(u + 7, t - 7, 3, 2, 'aco', 4); b.rect(u + 4, t - 8, 3, 3, 'ferrugem', 3); b.px(u + 5, t - 8, 'ferrugem', 5);
      b.hline(u - 2, u + 2, t - 3, 'cromado', 4); b.px(u - 2, t - 4, 'cromado', 5); b.px(u - 2, t - 2, 'cromado', 5);
      // Ferramentas em cima: martelo, chave inglesa, lata com chaves de fenda, fusível e mancha de óleo.
      b.hline(u + 13, u + 21, t - 1, 'madeira', 4); b.rect(u + 21, t - 3, 2, 3, 'aco', 4); b.px(u + 22, t - 3, 'aco', 6);
      b.hline(u + 25, u + 31, t - 1, 'cromado', 4); b.rect(u + 31, t - 2, 2, 2, 'cromado', 5); b.px(u + 25, t - 2, 'cromado', 3);
      b.rect(u + 36, t - 5, 4, 5, 'aco', 3); b.vline(u + 39, t - 5, t - 1, 'aco', 5); b.hline(u + 36, u + 39, t - 5, 'aco', 5);
      b.vline(u + 37, t - 9, t - 6, 'cromado', 4); b.rect(u + 36, t - 11, 2, 2, 'vermelho', 4); b.vline(u + 38, t - 8, t - 6, 'cromado', 5); b.rect(u + 38, t - 10, 2, 2, 'amarelo_vivo', 4);
      b.rect(u + 42, t - 2, 3, 2, 'branco', 5); b.px(u + 42, t - 2, 'latao', 4); b.px(u + 44, t - 2, 'latao', 4);
      if (c.desgaste >= 1) { b.hline(u + 15, u + 19, t + 1, 'oleo', 2); b.px(u + 17, t, 'oleo', 3); }
      riscos(b, o, c, u, t, 46, 3);
      ferrugem(b, o, c, u + 1, t + 4, 44, CHAO - t - 4, {min: 2, dens: .5});
      P.contato(b, u, 46);
    }
  });

  /* ------------------------------------------------------------ painel de ferramentas */
  M.modulo({
    id: 'painel_ferramentas', nome: 'Painel de ferramentas', grupo: 'Oficina', camada: 'parede',
    w: 36, h: 23, v: 14, livreV: true, semSombra: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, B = 'papelao';
      b.rect(u + 1, v + 1, 36, 23, 'carvao', 1);
      b.rect(u, v, 36, 23, B, 3); b.hline(u, u + 35, v, B, 4); b.vline(u + 35, v, v + 22, B, 4); b.hline(u, u + 35, v + 22, B, 1); b.vline(u, v, v + 22, B, 2);
      for (let y = v + 2; y < v + 22; y += 3) for (let x = u + 2; x < u + 35; x += 3) b.px(x, y, B, 1);
      const gancho = (x, y) => { b.px(x, y, 'cromado', 5); b.px(x, y + 1, 'cromado', 3); };
      // Silhuetas pintadas: cada ferramenta tem seu contorno. Uma está faltando.
      const contorno = (pts) => { for (let i = 0; i < pts.length; i++) b.line(pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], 'branco', 5); };
      contorno([[u + 27, v + 3], [u + 33, v + 3], [u + 33, v + 8], [u + 30, v + 8], [u + 30, v + 19], [u + 28, v + 19], [u + 28, v + 8], [u + 27, v + 8]]);
      gancho(u + 29, v + 2);
      // Martelo.
      gancho(u + 4, v + 2); b.rect(u + 2, v + 4, 6, 2, 'aco', 3); b.hline(u + 2, u + 7, v + 4, 'aco', 5); b.rect(u + 4, v + 6, 2, 9, 'madeira', 3); b.vline(u + 5, v + 6, v + 14, 'madeira', 4);
      // Chaves de boca.
      for (let i = 0; i < 3; i++) {
        const x = u + 10 + i * 3, len = 8 + i * 2;
        gancho(x, v + 2); b.vline(x, v + 4, v + 4 + len, 'cromado', 4); b.px(x - 1, v + 4, 'cromado', 3); b.px(x + 1, v + 4, 'cromado', 5); b.px(x - 1, v + 4 + len, 'cromado', 3); b.px(x + 1, v + 4 + len, 'cromado', 5);
      }
      // Chaves de fenda e alicate.
      for (const [x, cor] of [[u + 20, 'vermelho'], [u + 23, 'amarelo_vivo']]) { b.rect(x, v + 4, 2, 4, cor, 4); b.px(x + 1, v + 4, cor, 5); b.vline(x, v + 8, v + 13, 'cromado', 4); }
      gancho(u + 21, v + 3);
      b.line(u + 5, v + 17, u + 8, v + 21, 'vermelho', 4); b.line(u + 10, v + 17, u + 8, v + 21, 'vermelho', 3); b.px(u + 7, v + 16, 'aco', 5); b.px(u + 8, v + 15, 'aco', 4); gancho(u + 7, v + 14);
      // Trena e rolo de fita.
      b.sphere(u + 16.5, v + 19, 2.4, 2.4, 'amarelo_vivo', 3, 5); b.px(u + 16, v + 19, 'plastico_preto', 2); gancho(u + 16, v + 15);
      b.ellipse(u + 22.5, v + 19, 2.4, 2.4, 'plastico_preto', 2); b.ellipse(u + 22.5, v + 19, 1, 1, B, 3); b.px(u + 23, v + 17, 'plastico_preto', 4);
      if (c.desgaste >= 2) b.shadeFn(u, v, 36, 23, (x, y) => (G.valueNoise(x / 4, y / 4, o.seed) > .72 ? -1 : 0));
    }
  });

  /* ------------------------------------------------------------ pneus */
  M.modulo({
    id: 'pneus', nome: 'Pneus empilhados', grupo: 'Oficina', camada: 'parede',
    w: 19, h: p => (Number(p.pilha) || 3) * 5 + 3,
    params: [{id: 'pilha', label: 'Pilha', opcoes: [['2', 'Dois'], ['3', 'Três'], ['4', 'Quatro']], padrao: '3'}],
    pinta(b, o, c) {
      const {u} = o, n = Number(o.p.pilha) || 3, Rb = 'borracha';
      let topo = CHAO;
      for (let i = 0; i < n; i++) {
        const dx = Math.round((hash2(i, 71, o.seed) - .5) * 2), x = u + 1 + dx, base = CHAO - i * 5, y = base - 4;
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 17; xx++) {
          if ((yy === 0 || yy === 4) && (xx === 0 || xx === 16)) continue;
          let lv = yy === 0 ? 5 : yy === 4 ? 2 : 4;
          if (yy >= 1 && yy <= 3 && (xx + (yy === 2 ? 2 : 0)) % 4 === 0) lv = 2;
          if (xx >= 12 && yy < 4) lv += 1;
          if (xx <= 1) lv -= 1;
          b.px(x + xx, y + yy, Rb, Math.max(1, lv));
        }
        b.hline(x + 13, x + 14, y + 1, 'carvao', 5);
        topo = y;
      }
      const tx = u + 1 + Math.round((hash2(n - 1, 71, o.seed) - .5) * 2);
      b.hline(tx + 3, tx + 13, topo - 2, Rb, 4); b.hline(tx + 1, tx + 15, topo - 1, Rb, 5);
      b.hline(tx + 5, tx + 11, topo - 1, 'carvao', 0); b.hline(tx + 6, tx + 10, topo - 2, 'carvao', 1);
      b.px(tx + 13, topo - 2, Rb, 6);
      if (c.desgaste >= 2) b.hline(u + 2, u + 8, CHAO, 'agua', 2);
      P.contato(b, u + 1, 17, {alto: 2});
    }
  });

  /* ------------------------------------------------------------ compressor de ar */
  M.modulo({
    id: 'compressor', nome: 'Compressor de ar', grupo: 'Oficina', camada: 'parede', w: 30, h: 25,
    params: [{id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: false}],
    pinta(b, o, c) {
      const {u} = o, R = 'vermelho', ligado = c.estado(o, 'ligado') && c.energia;
      // Tanque deitado.
      const ty = 47;
      for (let yy = 0; yy < 10; yy++) {
        const lv = [4, 5, 5, 4, 4, 3, 3, 2, 2, 1][yy], enc = yy === 0 || yy === 9 ? 2 : yy === 1 || yy === 8 ? 1 : 0;
        b.hline(u + 2 + enc, u + 25 - enc, ty + yy, R, lv);
      }
      b.vline(u + 7, ty + 1, ty + 8, R, 2); b.vline(u + 20, ty + 1, ty + 8, R, 2); b.px(u + 23, ty + 1, R, 6);
      b.rect(u + 11, ty + 4, 6, 2, 'papel', 5); b.hline(u + 12, u + 15, ty + 5, 'tinta', 2);
      b.rect(u + 3, ty + 10, 3, 4, 'borracha', 2); b.hline(u + 2, u + 6, CHAO, 'borracha', 1);
      b.ellipse(u + 22, CHAO - 2, 3.2, 3.2, 'carvao', 0); b.sphere(u + 22, CHAO - 2.4, 2.8, 2.8, 'borracha', 1, 4); b.px(u + 22, CHAO - 3, 'aco', 5);
      // Motor, polia com proteção e cabeçote.
      b.rect(u + 4, ty - 8, 9, 8, 'ferro_azul', 3); b.hline(u + 4, u + 12, ty - 8, 'ferro_azul', 5); b.vline(u + 12, ty - 8, ty - 1, 'ferro_azul', 4);
      for (let x = u + 5; x < u + 12; x += 2) b.vline(x, ty - 7, ty - 2, 'ferro_azul', 2);
      b.rect(u + 13, ty - 7, 4, 7, R, 3); for (let y = ty - 6; y < ty; y += 2) b.hline(u + 13, u + 16, y, R, 1); b.hline(u + 13, u + 16, ty - 7, R, 5);
      b.rect(u + 17, ty - 9, 6, 9, 'aco', 3); for (let y = ty - 8; y < ty - 1; y += 2) b.hline(u + 17, u + 22, y, 'aco', 5); b.vline(u + 22, ty - 9, ty - 1, 'aco', 4);
      b.rect(u + 18, ty - 11, 4, 2, 'aco', 2); b.px(u + 21, ty - 11, 'aco', 4);
      // Manômetro, registro e alça com a mangueira enrolada.
      b.vline(u + 25, ty - 3, ty - 1, 'latao', 4);
      b.ellipse(u + 25, ty - 6, 2.6, 2.6, 'cromado', 3); b.ellipse(u + 25, ty - 6, 1.8, 1.8, 'papel', 6);
      if (!ligado) { b.px(u + 24, ty - 5, 'vermelho', 3); }
      b.rect(u + 26, ty - 14, 2, 14, 'aco', 3); b.vline(u + 27, ty - 14, ty - 1, 'aco', 5); b.rect(u + 24, ty - 15, 5, 2, 'plastico_preto', 2); b.hline(u + 24, u + 28, ty - 15, 'plastico_preto', 4);
      for (let k = 0; k < 3; k++) { b.ellipse(u + 27, ty - 7 + k, 3.4, 4.5, 'amarelo_vivo', 3 + (k === 0 ? 1 : 0)); b.ellipse(u + 27, ty - 7 + k, 2.4, 3.5, 'carvao', 0); }
      b.rect(u + 26, ty - 14, 2, 14, 'aco', 3); b.vline(u + 27, ty - 14, ty - 1, 'aco', 5);
      b.px(u + 29, ty + 1, 'amarelo_vivo', 3); b.vline(u + 29, ty + 2, CHAO - 3, 'amarelo_vivo', 2);
      b.rect(u + 9, ty - 10, 3, 2, 'plastico_preto', 2); b.px(ligado ? u + 11 : u + 9, ty - 10, ligado ? 'verde_vivo' : 'vermelho', 4);
      ferrugem(b, o, c, u + 2, ty, 24, 10, {min: 1, dens: .9});
      if (c.desgaste >= 2) b.hline(u + 8, u + 14, CHAO, 'oleo', 2);
      P.contato(b, u + 2, 26);
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'ligado') || !c.energia) return;
      const {u} = o, ty = 47, a = -2.4 + (Math.sin(t * .7) * .5 + .5) * 3.2 + Math.sin(t * 31) * .12;
      g.px(u + 25 + Math.round(Math.cos(a) * 1.4), ty - 6 + Math.round(Math.sin(a) * 1.4), g.color('vermelho', 3));
      const f = Math.floor(t * 14) % 2;
      g.rect(u + 13, ty - 6 + f, 4, 1, g.color('vermelho', 1)); g.rect(u + 13, ty - 4 + f, 4, 1, g.color('vermelho', 1));
      if (Math.floor(t * 18) % 2) g.rect(u + 4, ty - 8, 9, 1, g.color('ferro_azul', 4));
      const fase = (t * .8 + o.seed % 5) % 3;
      if (fase < 1) { const y = ty - 12 - Math.floor(fase * 5); g.px(u + 20 + (Math.floor(fase * 10) % 2), y, g.color('papel', 6)); }
    }
  });

  /* ------------------------------------------------------------ elevador automotivo */
  /* Sedã visto de lado (96 × 30), de frente para a direita; yb = linha de baixo dos pneus. */
  function carroLado(b, x0, yb, cor, seed, desgaste) {
    const y0 = yb - 29;
    const topo = [[0, 13], [3, 10], [26, 10], [36, 0], [60, 0], [72, 10], [90, 11], [95, 14]];
    const topY = X => { for (let i = 0; i + 1 < topo.length; i++) { const [a, ya] = topo[i], [z, yz] = topo[i + 1]; if (X >= a && X <= z) return ya + (yz - ya) * (X - a) / Math.max(1, z - a); } return 14; };
    const rodas = [18, 76];
    const baseY = X => {
      let y = X < 5 || X > 90 ? 21 : 22;
      for (const cx of rodas) { const dx = X + .5 - cx; if (Math.abs(dx) < 8) y = Math.min(y, 23 - Math.sqrt(64 - dx * dx)); }
      return y;
    };
    for (let X = 0; X < 96; X++) {
      const t = Math.round(topY(X)), bt = Math.floor(baseY(X));
      for (let Y = t; Y <= bt; Y++) {
        let r = cor, lv;
        if (Y < 10) {
          const tr = 26 + (36 - 26) * (10 - Y) / 10, fr = 72 - (72 - 60) * (10 - Y) / 10;
          const vidroAqui = Y >= 2 && X > tr + 1.5 && X < fr - 1.5 && !(X >= 49 && X <= 50);
          if (vidroAqui) { r = 'vidro'; lv = (X - Y * 1.2) % 14 < 3 ? 4 : 2; if (X > 50 && X < 53) lv = 1; }
          else lv = Y <= 1 ? 5 : X >= 49 && X <= 50 ? 1 : 3;
        } else {
          lv = Y === 10 ? 5 : Y <= 13 ? 4 : Y === 14 ? 5 : Y <= 19 ? 3 : Y <= 20 ? 2 : 1;
          if (X >= 93) lv += 1; else if (X <= 2) lv -= 1;
        }
        b.px(x0 + X, y0 + Y, r, Math.max(0, lv));
      }
    }
    for (const X of [34, 50, 66]) b.vline(x0 + X, y0 + 10, y0 + 20, cor, 1);
    b.hline(x0 + 38, x0 + 40, y0 + 13, 'cromado', 6); b.hline(x0 + 54, x0 + 56, y0 + 13, 'cromado', 6);
    b.rect(x0 + 69, y0 + 8, 3, 2, cor, 3); b.px(x0 + 71, y0 + 8, cor, 5);
    b.rect(x0, y0 + 12, 3, 3, 'vermelho', 4); b.px(x0 + 2, y0 + 12, 'vermelho', 6);
    b.rect(x0 + 93, y0 + 12, 3, 2, 'amarelo_vivo', 5); b.px(x0 + 95, y0 + 12, 'amarelo_vivo', 7); b.px(x0 + 92, y0 + 14, 'laranja', 4);
    b.rect(x0, y0 + 17, 5, 4, 'plastico_preto', 2); b.hline(x0, x0 + 4, y0 + 17, 'plastico_preto', 4);
    b.rect(x0 + 91, y0 + 17, 5, 4, 'plastico_preto', 2); b.hline(x0 + 91, x0 + 95, y0 + 17, 'plastico_preto', 4);
    for (const cx of rodas) {
      b.ellipse(x0 + cx, y0 + 22, 7.4, 7.4, 'carvao', 0);
      b.sphere(x0 + cx, y0 + 23.5, 6, 6, 'borracha', 1, 4);
      b.ellipse(x0 + cx, y0 + 23.5, 3.3, 3.3, 'cromado', 3); b.ellipse(x0 + cx, y0 + 23.5, 2, 2, 'aco', 2);
      b.px(x0 + cx + 1, y0 + 22, 'cromado', 6); b.px(x0 + cx, y0 + 23, 'cromado', 5);
    }
    if (desgaste >= 2) for (let i = 0; i < desgaste * 5; i++) b.px(x0 + 6 + Math.floor(hash2(i, 81, seed) * 84), y0 + 17 + Math.floor(hash2(i, 82, seed) * 5), 'ferrugem', 3);
  }
  M.modulo({
    id: 'elevador_carro', nome: 'Elevador automotivo', grupo: 'Oficina', camada: 'parede', w: 110, h: 58,
    params: [
      {id: 'carro', label: 'Com carro erguido', tipo: 'bool', padrao: true},
      {id: 'cor', label: 'Cor das colunas', tipo: 'cor', opcoes: 'viva', padrao: 'azul_vivo'}
    ],
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, top = 4, carro = !!o.p.carro, yb = 44;
      const braco = carro ? yb - 6 : CHAO - 6;
      const corCarro = ['aluminio', 'branco', 'vermelho', 'ferro_azul', 'ferro_verde', 'vinho'][o.seed % 6];
      // Travessa de cima com a placa.
      b.rect(u, top, w, 3, cor, 3); b.hline(u, u + w - 1, top, cor, 5); b.hline(u, u + w - 1, top + 2, cor, 1);
      b.vline(u + w / 2 - 12, top + 3, top + 3, 'cromado', 4); b.vline(u + w / 2 + 11, top + 3, top + 3, 'cromado', 4);
      b.bevel(u + w / 2 - 16, top + 3, 32, 8, 'amarelo_vivo', 4, 5, 2);
      b.text(u + w / 2, top + 5, 'CUIDADO', 'carvao', 1, {font: '3x5', align: 'center'});
      if (carro) carroLado(b, u + 7, yb, corCarro, o.seed, c.desgaste);
      // Colunas.
      for (const [x, lado] of [[u, 0], [u + w - 5, 1]]) {
        b.rect(x, top, 5, CHAO - top + 1, cor, 3); b.vline(x + 4, top, CHAO, cor, lado ? 5 : 4); b.vline(x, top, CHAO, cor, 2);
        b.rect(x + 1, top + 4, 3, CHAO - top - 12, cor, 2); b.vline(x + 3, top + 4, CHAO - 9, cor, 3);
        for (let y = CHAO - 8; y < CHAO - 1; y++) for (let xx = 0; xx < 5; xx++) b.px(x + xx, y, (xx + y) % 4 < 2 ? 'amarelo_vivo' : 'carvao', (xx + y) % 4 < 2 ? 4 : 1);
        b.rect(x - 1, CHAO - 1, 7, 2, 'aco', 2); b.hline(x - 1, x + 5, CHAO - 1, 'aco', 4);
        b.rect(x + (lado ? -1 : 1), braco - 3, 5, 6, cor, 4); b.hline(x + (lado ? -1 : 1), x + (lado ? 3 : 5), braco - 3, cor, 6);
      }
      // Braços com as sapatas de borracha.
      const alcance = carro ? 28 : 18;
      b.rect(u + 5, braco, alcance, 2, 'aco', 3); b.hline(u + 5, u + 4 + alcance, braco, 'aco', 5);
      b.rect(u + w - 5 - alcance, braco, alcance, 2, 'aco', 3); b.hline(u + w - 5 - alcance, u + w - 6, braco, 'aco', 5);
      for (const x of [u + 2 + alcance, u + w - 5 - alcance]) { b.rect(x, braco - 1, 4, 1, 'borracha', 3); b.px(x + 3, braco - 1, 'borracha', 5); }
      // Caixa de comando na coluna esquerda.
      b.rect(u + 1, top + 22, 5, 7, 'plastico_bege', 4); b.hline(u + 1, u + 5, top + 22, 'plastico_bege', 5);
      b.px(u + 2, top + 24, 'verde_vivo', 4); b.px(u + 4, top + 24, 'vermelho', 4); b.px(u + 3, top + 27, 'plastico_preto', 2);
      b.vline(u + 3, top + 29, CHAO - 9, 'plastico_preto', 1);
      if (carro) {
        b.rect(u + 48, CHAO - 2, 14, 3, 'plastico_preto', 2); b.hline(u + 48, u + 61, CHAO - 2, 'plastico_preto', 4); b.hline(u + 50, u + 59, CHAO - 1, 'oleo', 3);
        b.shade(u + 10, CHAO, 90, 1, -1, .5);
      }
      ferrugem(b, o, c, u, top, 5, CHAO - top, {min: 2, dens: .8}); ferrugem(b, o, c, u + w - 5, top, 5, CHAO - top, {min: 2, dens: .8});
      if (c.desgaste >= 1) b.hline(u + 30, u + 44, CHAO, 'oleo', 2);
      P.contato(b, u - 1, 7); P.contato(b, u + w - 6, 7);
    }
  });

  /* ================================================================ CAMADA DA FRENTE E CHÃO */

  /* ------------------------------------------------------------ mesa de escritório (frente) */
  M.modulo({
    id: 'mesa_escritorio_frente', nome: 'Mesa de escritório (frente)', grupo: 'Escritório', camada: 'frente', w: 92, h: 46,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'coisas', label: 'Com papéis, caneca e monitor', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const cor = o.p.cor, W = o.w;
      // Tampo visto de cima, borda e painel da frente.
      P.veios(b, 0, 18, W, 6, cor, 4, o.seed);
      b.hline(0, W - 1, 18, cor, 5); b.hline(0, W - 1, 23, cor, 3);
      b.hline(0, W - 1, 24, cor, 5); b.hline(0, W - 1, 25, cor, 3); b.hline(0, W - 1, 26, cor, 1);
      b.rect(1, 27, W - 2, 19, cor, 2); b.vline(W - 2, 27, 45, cor, 3); b.vline(1, 27, 45, cor, 1);
      for (const [x, pw] of [[4, 25], [33, 26], [63, 25]]) { b.bevel(x, 29, pw, 17, cor, 3, 4, 1); b.inset(x + 3, 32, pw - 6, 14, cor, 3, 4, 1); }
      if (o.p.coisas) {
        // Papéis.
        for (let i = 0; i < 3; i++) b.hline(8 + (i % 2), 26 + (i % 2), 19 - i, 'papel', 4 - (i % 2));
        b.rect(8, 13, 19, 4, 'papel', 6); b.hline(8, 26, 13, 'papel', 7); b.vline(26, 13, 16, 'papel', 5);
        for (let i = 0; i < 2; i++) b.hline(10, 14 + Math.floor(hash2(i, 91, o.seed) * 9), 14 + i * 2, 'tinta', 3);
        b.rect(21, 12, 2, 3, 'cromado', 4); b.px(22, 12, 'cromado', 6);
        // Caneca.
        b.rect(33, 11, 6, 8, 'branco', 4); b.vline(38, 11, 18, 'branco', 6); b.vline(33, 12, 18, 'branco', 3); b.hline(33, 38, 18, 'branco', 2);
        b.hline(34, 37, 11, 'madeira_escura', 1); b.px(38, 11, 'branco', 6);
        b.rect(31, 13, 2, 4, 'branco', 3); b.px(31, 13, 'branco', 4); b.rect(35, 14, 2, 2, 'vermelho', 4);
        b.hline(41, 44, 20, 'amarelo_vivo', 5); b.hline(41, 44, 21, 'amarelo_vivo', 4);
        // Monitor de costas, com a etiqueta de patrimônio.
        b.rect(53, 0, 22, 14, 'plastico_preto', 2); b.hline(53, 74, 0, 'plastico_preto', 4); b.vline(74, 0, 13, 'plastico_preto', 3); b.vline(53, 1, 13, 'plastico_preto', 1);
        b.rect(59, 2, 11, 9, 'plastico_preto', 3); b.hline(60, 68, 2, 'plastico_preto', 5); b.vline(69, 3, 10, 'plastico_preto', 4); b.hline(59, 69, 10, 'plastico_preto', 2);
        b.rect(62, 5, 4, 3, 'plastico_preto', 2); for (const [x, y] of [[62, 5], [65, 5], [62, 7], [65, 7]]) b.px(x, y, 'cromado', 3);
        b.hline(55, 57, 2, 'plastico_preto', 1); b.hline(55, 57, 4, 'plastico_preto', 1); b.hline(71, 73, 2, 'plastico_preto', 1); b.hline(71, 73, 4, 'plastico_preto', 1);
        b.rect(55, 10, 6, 3, 'papel', 5); for (let x = 56; x < 60; x += 2) b.vline(x, 11, 12, 'tinta', 1);
        b.rect(62, 14, 4, 5, 'plastico_preto', 2); b.vline(65, 14, 18, 'plastico_preto', 3);
        b.rect(57, 19, 14, 2, 'plastico_preto', 3); b.hline(57, 70, 19, 'plastico_preto', 4);
        b.vline(71, 20, 31, 'plastico_preto', 1); b.px(71, 32, 'plastico_preto', 2);
        // Porta-lápis.
        b.rect(81, 12, 5, 7, 'plastico_preto', 2); b.vline(85, 12, 18, 'plastico_preto', 3); b.hline(81, 85, 12, 'plastico_preto', 4);
        b.vline(82, 8, 11, 'amarelo_vivo', 4); b.vline(84, 9, 11, 'azul_vivo', 4); b.px(83, 10, 'vermelho', 4); b.px(82, 7, 'rosa', 4);
      }
      if (c.desgaste >= 1) { b.ellipse(48, 21, 2.5, 1.2, cor, 2); b.ellipse(48, 21, 1.5, .6, cor, 4); }
      riscos(b, o, c, 0, 19, W, 4);
      encardido(b, o, c, 1, 27, W - 2, 19, {forca: .5});
    },
    anima(g, o, t) {
      if (!o.p.coisas) return;
      const cor = g.color('papel', 6);
      for (let i = 0; i < 2; i++) {
        const f = (t * .6 + i * .5) % 1;
        if (f > .8) continue;
        g.px(35 + i + Math.round(Math.sin(t * 2 + i * 3) * .8), 10 - Math.floor(f * 7), cor);
      }
    }
  });

  /* ------------------------------------------------------------ caixas (frente) */
  M.modulo({
    id: 'caixas_frente', nome: 'Caixas (frente)', grupo: 'Depósito', camada: 'frente', w: 46, h: 34,
    params: [{id: 'tipo', label: 'Tipo', opcoes: [['papelao', 'Papelão'], ['madeira', 'Caixote de madeira']], padrao: 'papelao'}],
    pinta(b, o, c) {
      if (o.p.tipo === 'madeira') {
        const Wd = 'madeira_clara';
        b.rect(2, 12, 34, 22, Wd, 2);
        b.hline(2, 35, 12, Wd, 5); b.hline(2, 35, 13, Wd, 4); b.hline(2, 35, 14, Wd, 3);
        for (let k = 0; k < 4; k++) { const y = 16 + k * 5; b.rect(5, y, 28, 4, Wd, 3); b.hline(5, 32, y, Wd, 4); b.hline(5, 32, y + 3, Wd, 2); }
        b.rect(2, 12, 3, 22, Wd, 3); b.vline(4, 12, 33, Wd, 4); b.rect(33, 12, 3, 22, Wd, 4); b.vline(35, 12, 33, Wd, 5);
        b.line(5, 32, 32, 16, Wd, 3); b.line(5, 31, 32, 15, Wd, 4);
        for (const [x, y] of [[3, 17], [3, 30], [34, 17], [34, 30]]) b.px(x, y, 'aco', 5);
        b.text(19, 21, 'N7', 'carvao', 2, {font: '3x5', align: 'center'});
        // Caixote de cima com a tampa torta e palha escapando.
        b.rect(14, 2, 24, 10, Wd, 3); b.hline(14, 37, 7, Wd, 2); b.vline(37, 2, 11, Wd, 5); b.vline(14, 2, 11, Wd, 2);
        for (let i = 0; i < 9; i++) b.line(16 + i * 2, 2, 15 + i * 2 + (i % 3), -1 + (i % 2), 'amarelo', 4 + (i % 2));
        b.poly([[12, 3], [36, -1], [38, 1], [14, 5]], Wd, 4); b.line(12, 3, 36, -1, Wd, 5);
        b.line(44, 33, 39, 9, 'vermelho', 3); b.line(45, 33, 40, 9, 'vermelho', 4); b.px(39, 8, 'aco', 5); b.px(38, 9, 'aco', 4);
      } else {
        const Pp = 'papelao';
        b.rect(2, 14, 32, 20, Pp, 3);
        b.hline(2, 33, 14, Pp, 5); b.hline(2, 33, 15, Pp, 4); b.hline(2, 33, 16, Pp, 4); b.hline(2, 33, 17, Pp, 2);
        b.vline(33, 14, 33, Pp, 4); b.vline(2, 15, 33, Pp, 2);
        b.rect(17, 14, 3, 8, 'papel', 4); b.vline(19, 14, 21, 'papel', 5);
        b.text(19, 25, 'FRAGIL', 'vermelho', 3, {font: '3x5', align: 'center'});
        for (const x of [5, 9]) { b.px(x, 19, 'tinta', 2); b.vline(x, 20, 22, 'tinta', 2); b.px(x - 1, 20, 'tinta', 2); b.px(x + 1, 20, 'tinta', 2); }
        // Caixa de cima, aberta, com jornal amassado.
        b.rect(12, 4, 28, 10, Pp, 3); b.vline(39, 4, 13, Pp, 4); b.vline(12, 4, 13, Pp, 2); b.hline(12, 39, 13, Pp, 1);
        b.rect(13, 2, 26, 3, 'carvao', 1);
        b.poly([[12, 4], [5, 0], [6, 2], [13, 6]], Pp, 4); b.poly([[39, 4], [45, 1], [44, 3], [38, 6]], Pp, 5);
        for (const [x, y] of [[16, 1], [22, 2], [28, 0], [33, 2]]) { b.rect(x, y, 3, 2, 'papel', 5); b.px(x + 1, y, 'papel', 6); b.px(x, y + 1, 'tinta', 3); }
        b.rect(24, 7, 7, 4, 'papel', 5); b.hline(25, 29, 8, 'tinta', 2); b.hline(25, 27, 9, 'tinta', 2);
      }
      encardido(b, o, c, 0, 0, o.w, o.h, {forca: .5});
    }
  });

  /* ------------------------------------------------------------ carrinho de ferramentas (frente) */
  M.modulo({
    id: 'carrinho_ferramentas', nome: 'Carrinho de ferramentas', grupo: 'Oficina', camada: 'frente', w: 38, h: 46,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}],
    pinta(b, o, c) {
      const cor = o.p.cor;
      // Bandeja de cima com as ferramentas do dia.
      b.rect(0, 8, 33, 3, cor, 4); b.hline(0, 32, 8, cor, 6); b.hline(1, 31, 9, 'borracha', 3); b.hline(1, 31, 10, cor, 2);
      b.hline(3, 13, 8, 'cromado', 5); b.rect(13, 7, 2, 2, 'cromado', 4); b.px(3, 7, 'cromado', 3);
      b.rect(24, 0, 4, 8, 'azul_vivo', 3); b.vline(27, 0, 7, 'azul_vivo', 5); b.rect(24, 3, 4, 2, 'amarelo_vivo', 4); b.rect(25, -1, 2, 1, 'plastico_preto', 3);
      b.poly([[15, 8], [18, 4], [22, 5], [21, 8]], 'tecido_azul', 3); b.px(19, 5, 'tecido_azul', 4); b.px(20, 7, 'oleo', 2);
      // Gaveteiro.
      b.rect(0, 11, 33, 31, cor, 3); b.vline(32, 11, 41, cor, 4); b.vline(0, 11, 41, cor, 2);
      let y = 12;
      for (const alto of [4, 4, 5, 7, 9]) {
        b.hline(1, 31, y, cor, 4); b.hline(1, 31, y + alto - 1, cor, 1);
        b.hline(3, 29, y + 1, 'cromado', 5); b.hline(3, 29, y + 2, cor, 2);
        y += alto + 1;
      }
      b.px(29, 13, 'cromado', 6); b.rect(3, 23, 5, 2, 'branco', 5); b.px(4, 23, 'vermelho', 4);
      // Barra de empurrar e base com rodízios.
      b.rect(34, 10, 2, 16, 'cromado', 4); b.vline(35, 10, 25, 'cromado', 6); b.hline(32, 35, 10, 'cromado', 5); b.hline(32, 35, 25, 'cromado', 3);
      b.rect(0, 42, 33, 2, 'plastico_preto', 2); b.hline(0, 32, 42, 'plastico_preto', 4);
      for (const x of [2, 26]) { b.rect(x, 44, 5, 2, 'borracha', 2); b.px(x + 4, 44, 'borracha', 4); }
      riscos(b, o, c, 0, 11, 33, 30);
      ferrugem(b, o, c, 0, 34, 33, 8, {min: 2, dens: .7});
      if (c.desgaste >= 1) { b.px(8, 30, 'oleo', 2); b.px(9, 30, 'oleo', 3); b.px(9, 31, 'oleo', 2); }
    }
  });

  /* ------------------------------------------------------------ faixa de segurança (chão) */
  M.modulo({
    id: 'faixa_seguranca', nome: 'Faixa de segurança', grupo: 'Depósito', camada: 'chao',
    w: p => Math.max(40, Math.min(600, Math.round(Number(p.largura) || 200))), profundidade: () => [690, 736],
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 600, padrao: 200}],
    pintaChao(X, d, out, o) {
      if (o.desgaste && hash2(Math.floor(X / 5), Math.floor(d / 4), o.seed) < o.desgaste * .11) { out.l -= 1; return; }
      const borda = d - o.d0 < 4 || o.d1 - d < 4;
      const s = (((X - o.X0) + (d - o.d0) * 1.3) % 22 + 22) % 22;
      if (borda || s < 11) { out.r = 'amarelo_vivo'; out.l = borda ? 4 : 3; } else { out.r = 'carvao'; out.l = 1; }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
