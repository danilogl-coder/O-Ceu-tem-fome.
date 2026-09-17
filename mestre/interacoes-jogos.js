/* Interações de máquinas e minijogos das cenas montáveis — TV, telefone,
   computador, máquina de venda, fliperama e quadro de energia.

   Cada tipo desenha o próprio objeto em pixel art (arte em 2×2, texto 5×7),
   com a barra U.header no topo; Esc ou um clique fora do objeto fecha. O que
   precisa durar entre aberturas fica em sys.memory(clue.id): canal da TV,
   chamadas recentes, login, crédito da máquina, fichas e recordes do
   fliperama, disjuntores do quadro.

   As regras que não desenham nada (leitura dos campos, o puzzle do quadro, os
   dois jogos do fliperama) ficam em root.InteracoesJogos e rodam no Node, sem
   DOM: `document` só é tocado dentro das funções de desenho. */
(function (root) {
  'use strict';

  /* ================================================================ ajudantes puros */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const chaveDe = s => semAcento(s).trim().toLowerCase();
  const sementeDe = s => [...String(s ?? '')].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 7);
  /* Gerador determinístico cujo estado é um número (cabe na memória da sessão). */
  function passoAleatorio(estado) {
    let a = (estado + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return [((t ^ t >>> 14) >>> 0) / 4294967296, a];
  }
  function aleatorio(semente) {
    let s = (semente >>> 0) || 1;
    const next = () => { const [v, n] = passoAleatorio(s); s = n; return v; };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    return next;
  }
  const linhasDe = texto => String(texto ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const partesDe = linha => String(linha).split('|').map(p => p.trim());
  /* Campo de texto vazio (ou só espaços) cai no padrão. */
  const campo = (valor, padrao) => (typeof valor === 'string' && valor.trim() ? valor : padrao);
  const inteiro = (valor, padrao, min = -Infinity, max = Infinity) => {
    const m = String(valor ?? '').match(/-?\d+/);
    return m ? clamp(parseInt(m[0], 10), min, max) : padrao;
  };

  /* ---------------------------------------------------------------- TV */
  const TIPOS_CANAL = ['noticias', 'chuvisco', 'desenho', 'novela', 'propaganda', 'mensagem', 'futebol'];
  const APELIDOS_CANAL = {noticia: 'noticias', jornal: 'noticias', telejornal: 'noticias', estatica: 'chuvisco', chiado: 'chuvisco',
    'fora do ar': 'chuvisco', semsinal: 'chuvisco', desenhos: 'desenho', cartoon: 'desenho', infantil: 'desenho', novelas: 'novela',
    comercial: 'propaganda', anuncio: 'propaganda', propagandas: 'propaganda', mensagens: 'mensagem', transmissao: 'mensagem',
    aviso: 'mensagem', jogo: 'futebol', esporte: 'futebol', esportes: 'futebol'};
  const tipoCanal = s => { const k = chaveDe(s); return TIPOS_CANAL.includes(k) ? k : APELIDOS_CANAL[k] || null; };
  /* "NOME | tipo | texto", um canal por linha. */
  function parseCanais(texto) {
    return linhasDe(texto).slice(0, 99).map((linha, i) => {
      const p = partesDe(linha);
      let tipo = tipoCanal(p[1]), txt = p.length > 2 ? p.slice(2).join(' | ') : '';
      if (!tipo && p.length === 1) tipo = tipoCanal(p[0]);
      if (!tipo) { tipo = 'mensagem'; if (!txt) txt = p.length > 1 ? p[1] : p[0]; }
      return {nome: (p[0] || '').slice(0, 22) || `CANAL ${i + 1}`, tipo, texto: txt};
    });
  }
  /* "UNIÃO 2 x 1 ESTRELA" → times e gols. */
  function parsePlacar(texto) {
    const m = String(texto ?? '').match(/^\s*(.*?)\s+(\d{1,2})\s*[xX×-]\s*(\d{1,2})\s+(.*?)\s*$/);
    if (!m) return {casa: 'CASA', golsCasa: 0, golsFora: 0, fora: 'VISITANTE'};
    return {casa: m[1] || 'CASA', golsCasa: +m[2], golsFora: +m[3], fora: m[4] || 'VISITANTE'};
  }

  /* ---------------------------------------------------------------- telefone */
  const normalizarNumero = s => String(s ?? '').replace(/[^\d*#]/g, '');
  /* "NÚMERO | mensagem" ou "NÚMERO | Nome | mensagem", com ou sem traço. */
  function parseContatos(texto) {
    const lista = [];
    for (const linha of linhasDe(texto)) {
      const p = partesDe(linha);
      if (p.length < 2) continue;
      const digitos = normalizarNumero(p[0]);
      if (!digitos) continue;
      lista.push({numero: p[0], digitos, nome: p.length > 2 ? p[1] : '', mensagem: p.length > 2 ? p.slice(2).join(' | ') : p[1]});
    }
    return lista;
  }
  /* Iguais, ou um é o outro com código de área na frente. */
  function mesmoNumero(a, b) {
    a = normalizarNumero(a); b = normalizarNumero(b);
    if (!a || !b) return false;
    return a === b || (Math.min(a.length, b.length) >= 7 && (a.endsWith(b) || b.endsWith(a)));
  }
  const acharContato = (contatos, numero) => contatos.find(c => mesmoNumero(c.digitos, numero)) || null;
  function formatarNumero(s) {
    const d = normalizarNumero(s);
    if (/[*#]/.test(d) || d.length < 7) return d;
    if (d.length <= 9) return d.slice(0, d.length - 4) + '-' + d.slice(-4);
    if (d.length <= 11 && !d.startsWith('0')) return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    return d.slice(0, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7);
  }

  /* ---------------------------------------------------------------- itens e máquina */
  /* "refrigerante", "moedas*3", "chave=Porão". */
  function parseItem(s) {
    const raw = String(s ?? '').trim();
    if (!raw) return null;
    const eq = raw.indexOf('=');
    let id = eq >= 0 ? raw.slice(0, eq) : raw, qtd = 1;
    const nome = eq >= 0 ? raw.slice(eq + 1).trim() : '';
    const m = id.match(/^(.*?)\s*\*\s*(\d+)\s*$/);
    if (m) { id = m[1]; qtd = clamp(parseInt(m[2], 10), 1, 99); }
    id = chaveDe(id).replace(/\s+/g, '_');
    return id ? {id, qtd, dados: nome ? {nome} : null} : null;
  }
  const CODIGO = /^[A-Z]{0,1}\d{1,2}$|^[A-Z]$/;
  /* "CÓDIGO | NOME | PREÇO | item", um produto por linha. Sem código, recebe A1, A2… */
  function parseProdutos(texto, {colunas = 4, maximo = 16} = {}) {
    const lista = [], usados = new Set();
    for (const linha of linhasDe(texto)) {
      let p = partesDe(linha);
      const cod = semAcento(p[0]).toUpperCase().replace(/[\s-]+/g, '');
      if (!CODIGO.test(cod)) p = ['', ...p];
      const codigo = CODIGO.test(cod) && !usados.has(cod) ? cod : '';
      if (codigo) usados.add(codigo);
      lista.push({codigo, nome: (p[1] || 'Produto').slice(0, 18), preco: inteiro(p[2], 1, 0, 99), item: parseItem(p[3])});
      if (lista.length >= maximo) break;
    }
    let n = 0;
    for (const prod of lista) {
      if (prod.codigo) continue;
      let c;
      do { c = String.fromCharCode(65 + Math.floor(n / colunas)) + (n % colunas + 1); n++; } while (usados.has(c));
      prod.codigo = c; usados.add(c);
    }
    return lista;
  }
  const acharProduto = (produtos, codigo) => {
    const c = semAcento(codigo).toUpperCase().replace(/\s+/g, '');
    return produtos.find(p => p.codigo === c) || null;
  };

  /* ---------------------------------------------------------------- computador */
  /* Blocos "PASTA/NOME.TXT" + linhas, separados por "---"; " !" no fim do nome = corrompido. */
  function parseArquivos(texto) {
    const arquivos = [];
    for (const bloco of String(texto ?? '').split(/\r?\n[ \t]*-{3,}[ \t]*(?=\r?\n|$)/)) {
      const ls = bloco.split(/\r?\n/);
      while (ls.length && !ls[0].trim()) ls.shift();
      const cabeca = (ls.shift() || '').trim();
      if (!cabeca || /^-+$/.test(cabeca)) continue;
      const corrompido = /\s!$/.test(cabeca);
      const caminho = cabeca.replace(/\s+!$/, '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const barra = caminho.lastIndexOf('/');
      arquivos.push({
        pasta: (barra > 0 ? caminho.slice(0, barra) : '') || 'DOCUMENTOS',
        nome: (barra >= 0 ? caminho.slice(barra + 1) : caminho) || 'SEM_NOME.TXT',
        texto: ls.join('\n').replace(/\s+$/, ''), corrompido
      });
      if (arquivos.length >= 60) break;
    }
    return arquivos;
  }
  const pastasDe = arquivos => [...new Set(arquivos.map(a => a.pasta))];
  /* Senhas comparam sem acento, maiúsculas nem espaços nas pontas. */
  const senhaConfere = (digitada, senha) => chaveDe(digitada) === chaveDe(senha);

  /* ---------------------------------------------------------------- recordes */
  const iniciais = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  function parseRecordes(texto) {
    return linhasDe(texto).map(l => { const p = partesDe(l); return {nome: iniciais(p[0]) || '???', pontos: inteiro(p[1], 0, 0, 9999999)}; })
      .sort((a, b) => b.pontos - a.pontos).slice(0, 5);
  }
  /* Recordes da casa (campo) + os feitos na mesa (memória), os 5 maiores. */
  function tabelaRecordes(base, salvos) {
    const todos = [...(base || []), ...(Array.isArray(salvos) ? salvos : [])]
      .filter(r => r && Number.isFinite(r.pontos)).map((r, i) => ({nome: iniciais(r.nome) || '???', pontos: Math.max(0, Math.floor(r.pontos)), novo: !!r.novo, i}));
    return todos.sort((a, b) => b.pontos - a.pontos || a.i - b.i).slice(0, 5).map(({i, ...r}) => r);
  }
  const entraNoRecorde = (tabela, pontos) => pontos > 0 && (tabela.length < 5 || pontos > tabela[tabela.length - 1].pontos);

  /* ---------------------------------------------------------------- quadro de energia */
  const DIFICULDADES = ['facil', 'medio', 'dificil'];
  function normalizarDificuldade(d) {
    const k = chaveDe(d);
    if (DIFICULDADES.includes(k)) return k;
    return /^(dif|hard)/.test(k) ? 'dificil' : /^(fac|easy)/.test(k) ? 'facil' : 'medio';
  }
  const N_DISJUNTORES = 6;
  /* Quem um clique mexe: só o próprio (fácil) ou ele e os vizinhos (médio, difícil). */
  const afetados = (i, n, dificuldade) => normalizarDificuldade(dificuldade) === 'facil' ? [i] : [i - 1, i, i + 1].filter(j => j >= 0 && j < n);
  function alternarDisjuntor(disjuntores, i, dificuldade) {
    const out = [...(disjuntores || [])].map(Boolean);
    if (!(i >= 0 && i < out.length)) return out;
    for (const j of afetados(i, out.length, dificuldade)) out[j] = !out[j];
    return out;
  }
  /* Quais disjuntores clicar para ligar todos (cada um uma vez; a ordem não
     muda o resultado). Com vizinhos, eliminação de Gauss em GF(2); null se não
     houver solução (com 6 disjuntores sempre há). */
  function solucaoDisjuntores(disjuntores, dificuldade) {
    const d = [...(disjuntores || [])].map(Boolean), n = d.length;
    if (normalizarDificuldade(dificuldade) === 'facil') return d.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const M = Array.from({length: n}, (_, j) => [...Array.from({length: n}, (_, i) => (afetados(i, n, dificuldade).includes(j) ? 1 : 0)), d[j] ? 0 : 1]);
    const pivos = [];
    let linha = 0;
    for (let col = 0; col < n && linha < n; col++) {
      let p = -1;
      for (let k = linha; k < n; k++) if (M[k][col]) { p = k; break; }
      if (p < 0) continue;
      [M[linha], M[p]] = [M[p], M[linha]];
      for (let k = 0; k < n; k++) if (k !== linha && M[k][col]) for (let c = 0; c <= n; c++) M[k][c] ^= M[linha][c];
      pivos.push(col); linha++;
    }
    for (let k = linha; k < n; k++) if (M[k][n]) return null;
    const x = Array(n).fill(0);
    pivos.forEach((col, k) => { x[col] = M[k][n]; });
    return x.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  }
  /* O quadro ao abrir. Com energia: tudo ligado. Sem energia: embaralhado pela
     semente — no fácil, alavancas soltas desligadas; com vizinhos, cliques a
     partir do resolvido (sempre tem solução), pedindo pelo menos 3 cliques. */
  function painelInicial({semente = 1, dificuldade = 'medio', n = N_DISJUNTORES, ligado = false} = {}) {
    n = clamp(n | 0, 2, 12);
    const dif = normalizarDificuldade(dificuldade);
    if (ligado) return {disjuntores: Array(n).fill(true), geral: true};
    const r = aleatorio((sementeDe(dif) ^ Math.imul((semente >>> 0) || 1, 2654435761)) >>> 0);
    let melhor = null;
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      let d = Array(n).fill(true);
      if (dif === 'facil') d = d.map(() => r() > .55);
      else {
        const ordem = [...Array(n).keys()];
        for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
        for (const i of ordem.slice(0, 3 + Math.floor(r() * 2))) d = alternarDisjuntor(d, i, dif);
      }
      const sol = solucaoDisjuntores(d, dif);
      if (!sol || !sol.length || !d.some(Boolean)) continue;
      if (!melhor || sol.length > melhor.passos) melhor = {d, passos: sol.length};
      if (melhor.passos >= Math.min(3, n)) break;
    }
    return {disjuntores: melhor ? melhor.d : Array.from({length: n}, (_, i) => i % 2 === 1), geral: true};
  }
  const painelResolvido = p => !!p && p.geral !== false && Array.isArray(p.disjuntores) && p.disjuntores.length > 0 && p.disjuntores.every(Boolean);
  /* Passos para religar: índices de disjuntores e 'geral' se ele estiver
     desligado (no difícil o geral vem antes, com pouca carga). No difícil,
     espere a carga baixar entre um passo e outro. */
  function resolverPainel(painel, dificuldade) {
    const p = Array.isArray(painel) ? {disjuntores: painel, geral: true} : painel || {};
    const passos = [...(solucaoDisjuntores(p.disjuntores || [], dificuldade) || [])];
    if (p.geral === false) { if (normalizarDificuldade(dificuldade) === 'dificil') passos.unshift('geral'); else passos.push('geral'); }
    return passos;
  }
  /* Difícil: o amperímetro. Cada disjuntor ligado pesa CARGA.base; o que acabou
     de ligar soma um pico de CARGA.pico que cai pela metade a cada meiaVida.
     Passou de 1, desarma tudo. Um clique por vez nunca estoura; dois seguidos, sim. */
  const CARGA = {base: .07, pico: .14, meiaVida: .5, limite: 1};
  const cargaBase = p => (p && p.geral ? (p.disjuntores || []).filter(Boolean).length * CARGA.base : 0);
  const decairPico = (pico, dt) => pico * Math.pow(.5, Math.max(0, dt) / CARGA.meiaVida);
  function picoDaMudanca(antes, depois, picoAtual = 0) {
    if (!depois.geral) return 0;
    const ligavam = (antes.disjuntores || []).map(v => !!v && !!antes.geral);
    return picoAtual + (depois.disjuntores || []).filter((v, i) => v && !ligavam[i]).length * CARGA.pico;
  }
  const sobrecarga = (painel, pico) => cargaBase(painel) + pico > CARGA.limite + 1e-9;

  /* ================================================================ fliperama: regras dos jogos
     Tudo em pixels da tela do jogo (JOGO_W × JOGO_H), sem desenho. O estado é
     só números e listas; `eventos` junta os sons do passo para a interface tocar. */
  const JOGO_W = 104, JOGO_H = 78, JOGO_TOPO = 8;
  const sorteio = g => { const [v, n] = passoAleatorio(g.semente); g.semente = n; return v; };
  const sobrepoe = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  /* ---- CÉU INVASOR: ondas descendo do céu, três nuvens de escudo, a boca voadora. */
  const INV = {cols: 7, linhas: 4, cw: 11, ch: 8, sw: 7, sh: 5, naveY: 69, naveW: 9, naveH: 5, velNave: 64, velTiro: 125, velTiroInimigo: 44, recarga: .28};
  const NUVEM = ['...##..##...', '.##########.', '############', '############', '.##########.'];
  const PONTOS_LINHA = [30, 20, 20, 10];
  function iniciarInvasores(g) {
    g.nave = {x: Math.round(JOGO_W / 2 - INV.naveW / 2), invencivel: 1, morta: 0};
    g.escudos = [16, 46, 76].map(x => ({x: x - 6, y: 57, px: NUVEM.join('').split('').map(ch => (ch === '#' ? 1 : 0))}));
    g.tiro = null; g.recarga = 0;
    novaOnda(g);
  }
  function novaOnda(g) {
    g.inimigos = [];
    for (let l = 0; l < INV.linhas; l++) for (let c = 0; c < INV.cols; c++) g.inimigos.push({c, l, vivo: true});
    g.form = {x: 8, y: 13 + Math.min(10, (g.onda - 1) * 2), dir: 1, relogio: 0, quadro: 0};
    g.tirosInimigos = []; g.tiro = null;
    g.proximoTiroInimigo = 1.4; g.ovni = null; g.proximoOvni = 9 + sorteio(g) * 8;
    g.espera = 1.1;
  }
  function erodirEscudo(g, x, y) {
    for (const s of g.escudos) {
      const lx = Math.floor(x - s.x), ly = Math.floor(y - s.y);
      if (lx < 0 || ly < 0 || lx >= 12 || ly >= 5 || !s.px[ly * 12 + lx]) continue;
      s.px[ly * 12 + lx] = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]]) {
        const nx = lx + dx, ny = ly + dy;
        if (nx >= 0 && ny >= 0 && nx < 12 && ny < 5 && sorteio(g) < .45) s.px[ny * 12 + nx] = 0;
      }
      return true;
    }
    return false;
  }
  function passoInvasores(g, dt, ctl) {
    const nave = g.nave, vivos = g.inimigos.filter(e => e.vivo);
    // Nave.
    if (nave.morta > 0) {
      nave.morta -= dt;
      if (nave.morta <= 0 && g.vidas > 0) { nave.x = Math.round(JOGO_W / 2 - INV.naveW / 2); nave.invencivel = 1.6; }
    } else {
      nave.x = clamp(nave.x + ((ctl.dir ? 1 : 0) - (ctl.esq ? 1 : 0)) * INV.velNave * dt, 2, JOGO_W - 2 - INV.naveW);
      nave.invencivel = Math.max(0, nave.invencivel - dt);
      g.recarga -= dt;
      if (ctl.fogo && !g.tiro && g.recarga <= 0) { g.tiro = {x: Math.round(nave.x + 4), y: INV.naveY - 3}; g.recarga = INV.recarga; g.eventos.push('arcade_tiro'); }
    }
    // Tiro da nave.
    if (g.tiro) {
      g.tiro.y -= INV.velTiro * dt;
      const t = g.tiro;
      if (t.y < JOGO_TOPO) g.tiro = null;
      else if (erodirEscudo(g, t.x, t.y) || erodirEscudo(g, t.x, t.y + 2)) g.tiro = null;
      else {
        for (const e of vivos) {
          const ex = g.form.x + e.c * INV.cw, ey = g.form.y + e.l * INV.ch;
          if (!sobrepoe(t.x, t.y, 1, 3, ex, ey, INV.sw, INV.sh)) continue;
          e.vivo = false; g.tiro = null;
          g.pontos += PONTOS_LINHA[e.l] || 10;
          g.particulas.push({x: ex + 3, y: ey + 2, t: .3, dur: .3, tipo: 'inimigo'});
          g.eventos.push('arcade_explosao');
          break;
        }
        if (g.tiro && g.ovni && sobrepoe(t.x, t.y, 1, 3, g.ovni.x, 9, 11, 5)) {
          const valor = [50, 100, 150, 300][Math.floor(sorteio(g) * 4)];
          g.pontos += valor;
          g.particulas.push({x: g.ovni.x + 5, y: 11, t: 1, dur: 1, tipo: 'pontos', valor});
          g.eventos.push('arcade_explosao');
          g.ovni = null; g.tiro = null;
        }
      }
    }
    if (g.espera > 0) g.espera -= dt;
    else if (vivos.length) {
      // Formação: passos cada vez mais rápidos conforme sobram menos.
      const f = g.form;
      f.relogio += dt;
      const intervalo = Math.max(.045, .58 * vivos.length / (INV.cols * INV.linhas)) / (1 + (g.onda - 1) * .14);
      if (f.relogio >= intervalo) {
        f.relogio = 0; f.quadro ^= 1;
        const minC = Math.min(...vivos.map(e => e.c)), maxC = Math.max(...vivos.map(e => e.c));
        const esq = f.x + minC * INV.cw, dir = f.x + maxC * INV.cw + INV.sw;
        if ((f.dir > 0 && dir + 2 > JOGO_W - 2) || (f.dir < 0 && esq - 2 < 2)) { f.y += 3; f.dir = -f.dir; }
        else f.x += 2 * f.dir;
      }
      const maxL = Math.max(...vivos.map(e => e.l));
      if (f.y + maxL * INV.ch + INV.sh >= INV.naveY) { g.vidas = 0; g.fimEm = Math.min(g.fimEm ?? 1, 1); nave.morta = 1; g.particulas.push({x: nave.x + 4, y: INV.naveY + 2, t: .8, dur: .8, tipo: 'nave'}); g.eventos.push('arcade_explosao'); }
      // Tiros do céu: do invasor mais baixo de uma coluna sorteada.
      g.proximoTiroInimigo -= dt;
      if (g.proximoTiroInimigo <= 0 && nave.morta <= 0) {
        g.proximoTiroInimigo = (.5 + sorteio(g) * .9) / (1 + (g.onda - 1) * .18);
        if (g.tirosInimigos.length < 2 + Math.min(2, g.onda - 1)) {
          const colunas = [...new Set(vivos.map(e => e.c))];
          const c = colunas[Math.floor(sorteio(g) * colunas.length)];
          const baixo = vivos.filter(e => e.c === c).reduce((a, b) => (b.l > a.l ? b : a));
          g.tirosInimigos.push({x: f.x + c * INV.cw + 3, y: f.y + baixo.l * INV.ch + INV.sh});
        }
      }
      // A boca voadora atravessa lá em cima de vez em quando.
      g.proximoOvni -= dt;
      if (!g.ovni && g.proximoOvni <= 0) { const d = sorteio(g) < .5 ? 1 : -1; g.ovni = {x: d > 0 ? -11 : JOGO_W, dir: d}; g.proximoOvni = 14 + sorteio(g) * 9; }
    } else if (g.vidas > 0) {
      g.onda++; g.pontos += 100;
      g.aviso = {texto: `ONDA ${g.onda}`, t: 1.6};
      g.eventos.push('arcade');
      novaOnda(g);
    }
    if (g.ovni) { g.ovni.x += g.ovni.dir * 24 * dt; if (g.ovni.x < -12 || g.ovni.x > JOGO_W + 1) g.ovni = null; }
    // Tiros inimigos.
    for (const b of g.tirosInimigos) b.y += INV.velTiroInimigo * (1 + (g.onda - 1) * .08) * dt;
    g.tirosInimigos = g.tirosInimigos.filter(b => {
      if (b.y > JOGO_H) return false;
      if (erodirEscudo(g, b.x, b.y + 3)) return false;
      if (nave.morta <= 0 && nave.invencivel <= 0 && sobrepoe(b.x, b.y, 1, 3, nave.x, INV.naveY, INV.naveW, INV.naveH)) {
        g.vidas--; nave.morta = 1.3;
        g.particulas.push({x: nave.x + 4, y: INV.naveY + 2, t: .8, dur: .8, tipo: 'nave'});
        g.eventos.push('arcade_explosao');
        if (g.vidas <= 0) g.fimEm = 1.2;
        return false;
      }
      return true;
    });
    if (nave.morta > 0) g.tirosInimigos = g.tirosInimigos.filter(b => b.y < INV.naveY - 12);
  }

  /* ---- QUEBRA-BLOCOS: raquete, bolinha e cinco fileiras; blocos '2' aguentam dois toques. */
  const BLO = {cols: 8, linhas: 5, bw: 11, bh: 4, gap: 1, x0: 4, y0: 11, raqW: 18, raqY: 72, velRaq: 84};
  const NIVEIS = [
    ['11111111', '11111111', '11111111', '11111111', '11111111'],
    ['...22...', '..1111..', '.211112.', '11111111', '1.1..1.1'],
    ['2.2.2.2.', '.1.1.1.1', '22222222', '1.1.1.1.', '.1.1.1.1'],
    ['11222211', '1......1', '1.2222.1', '1......1', '11111111']
  ];
  function iniciarBlocos(g) {
    g.raquete = {x: Math.round(JOGO_W / 2 - BLO.raqW / 2)};
    novoNivel(g);
  }
  function novoNivel(g) {
    const padrao = NIVEIS[(g.onda - 1) % NIVEIS.length];
    g.blocos = [];
    padrao.forEach((row, l) => [...row].forEach((ch, c) => { if (ch !== '.') g.blocos.push({c, l, vida: ch === '2' ? 2 : 1}); }));
    g.velBola = Math.min(88, 58 + (g.onda - 1) * 6);
    prenderBola(g);
  }
  function prenderBola(g) { g.bola = {x: g.raquete.x + BLO.raqW / 2 - 1, y: BLO.raqY - 2, vx: 0, vy: 0, presa: true}; g.espera = .5; }
  const retanguloBloco = b => [BLO.x0 + b.c * (BLO.bw + BLO.gap), BLO.y0 + b.l * (BLO.bh + BLO.gap), BLO.bw, BLO.bh];
  function passoBlocos(g, dt, ctl) {
    const r = g.raquete, bola = g.bola;
    let mover = ((ctl.dir ? 1 : 0) - (ctl.esq ? 1 : 0)) * BLO.velRaq * dt;
    if (Number.isFinite(ctl.alvoX)) mover = clamp(ctl.alvoX - BLO.raqW / 2 - r.x, -BLO.velRaq * 2 * dt, BLO.velRaq * 2 * dt);
    r.x = clamp(r.x + mover, 1, JOGO_W - 1 - BLO.raqW);
    if (g.espera > 0) g.espera -= dt;
    if (bola.presa) {
      bola.x = r.x + BLO.raqW / 2 - 1; bola.y = BLO.raqY - 2;
      if (ctl.fogo && g.espera <= 0 && g.vidas > 0) {
        const lado = ctl.dir ? 1 : ctl.esq ? -1 : sorteio(g) < .5 ? -1 : 1;
        bola.presa = false; bola.vx = g.velBola * .5 * lado; bola.vy = -g.velBola * .866;
        g.eventos.push('arcade_tiro');
      }
      return;
    }
    bola.x += bola.vx * dt; bola.y += bola.vy * dt;
    if (bola.x < 1) { bola.x = 1; bola.vx = Math.abs(bola.vx); }
    if (bola.x > JOGO_W - 3) { bola.x = JOGO_W - 3; bola.vx = -Math.abs(bola.vx); }
    if (bola.y < JOGO_TOPO + 1) { bola.y = JOGO_TOPO + 1; bola.vy = Math.abs(bola.vy); }
    // Raquete: o ângulo depende de onde a bolinha bate.
    if (bola.vy > 0 && sobrepoe(bola.x, bola.y, 2, 2, r.x - 1, BLO.raqY, BLO.raqW + 2, 3)) {
      const u = clamp((bola.x + 1 - (r.x + BLO.raqW / 2)) / (BLO.raqW / 2 + 1), -1, 1), ang = u * 1.05;
      const vel = Math.hypot(bola.vx, bola.vy);
      bola.vx = vel * Math.sin(ang); bola.vy = -vel * Math.cos(ang); bola.y = BLO.raqY - 2;
      if (Math.abs(bola.vy) < vel * .35) bola.vy = -vel * .35;
      g.eventos.push('arcade_tiro');
    }
    // Um bloco por passo: reflete pelo eixo que entrou menos.
    for (const b of g.blocos) {
      const [bx, by, bw, bh] = retanguloBloco(b);
      if (!sobrepoe(bola.x, bola.y, 2, 2, bx, by, bw, bh)) continue;
      const penX = Math.min(bola.x + 2 - bx, bx + bw - bola.x), penY = Math.min(bola.y + 2 - by, by + bh - bola.y);
      if (penX < penY) bola.vx = bola.x + 1 < bx + bw / 2 ? -Math.abs(bola.vx) : Math.abs(bola.vx);
      else bola.vy = bola.y + 1 < by + bh / 2 ? -Math.abs(bola.vy) : Math.abs(bola.vy);
      b.vida--;
      if (b.vida <= 0) {
        g.pontos += (BLO.linhas - b.l) * 10;
        g.particulas.push({x: bx + bw / 2, y: by + 2, t: .35, dur: .35, tipo: 'bloco', l: b.l});
        g.eventos.push('arcade_explosao');
        const vel = Math.min(96, Math.hypot(bola.vx, bola.vy) + .8), k = vel / Math.max(1, Math.hypot(bola.vx, bola.vy));
        bola.vx *= k; bola.vy *= k;
      } else g.eventos.push('arcade_tiro');
      break;
    }
    g.blocos = g.blocos.filter(b => b.vida > 0);
    if (bola.y > JOGO_H) {
      g.vidas--;
      g.particulas.push({x: bola.x, y: JOGO_H - 2, t: .6, dur: .6, tipo: 'nave'});
      g.eventos.push('arcade_explosao');
      if (g.vidas <= 0) { g.fimEm = .9; bola.presa = true; bola.y = JOGO_H + 20; }
      else prenderBola(g);
    } else if (!g.blocos.length) {
      g.onda++; g.pontos += 200;
      g.aviso = {texto: `NÍVEL ${g.onda}`, t: 1.6};
      g.eventos.push('arcade');
      novoNivel(g);
    }
  }

  /* Uma partida nova. semente: mesma semente, mesma partida. */
  function novoJogo(tipo, semente = 1) {
    const g = {tipo: tipo === 'blocos' ? 'blocos' : 'invasores', semente: (semente >>> 0) || 1, t: 0, pontos: 0, vidas: 3, onda: 1,
      fim: false, fimEm: null, espera: 0, eventos: [], particulas: []};
    g.aviso = {texto: g.tipo === 'blocos' ? 'NÍVEL 1' : 'ONDA 1', t: 1.4};
    if (g.tipo === 'blocos') iniciarBlocos(g); else iniciarInvasores(g);
    return g;
  }
  /* Avança a partida. ctl: {esq, dir, fogo, alvoX}. Passos de no máximo 1/20 s. */
  function passoJogo(g, dt, ctl = {}) {
    if (!g || g.fim) return g;
    let resto = clamp(Number(dt) || 0, 0, .25);
    while (resto > 1e-6) {
      const h = Math.min(resto, 1 / 60);
      resto -= h;
      g.t += h;
      if (g.aviso) { g.aviso.t -= h; if (g.aviso.t <= 0) g.aviso = null; }
      for (const p of g.particulas) p.t -= h;
      g.particulas = g.particulas.filter(p => p.t > 0);
      if (g.fimEm !== null) {
        g.fimEm -= h;
        if (g.fimEm <= 0) { g.fim = true; g.eventos.push('arcade_fim'); break; }
        continue;
      }
      if (g.tipo === 'blocos') passoBlocos(g, h, ctl); else passoInvasores(g, h, ctl);
    }
    return g;
  }

  const InteracoesJogos = {
    // leitura dos campos
    parseCanais, parsePlacar, parseContatos, normalizarNumero, mesmoNumero, acharContato, formatarNumero,
    parseItem, parseProdutos, acharProduto, parseArquivos, pastasDe, senhaConfere, parseRecordes, tabelaRecordes, entraNoRecorde,
    // quadro de energia
    normalizarDificuldade, alternarDisjuntor, solucaoDisjuntores, painelInicial, painelResolvido, resolverPainel,
    CARGA, cargaBase, decairPico, picoDaMudanca, sobrecarga,
    // fliperama
    JOGO_W, JOGO_H, novoJogo, passoJogo
  };
  root.InteracoesJogos = InteracoesJogos;
  if (typeof module !== 'undefined' && module.exports) module.exports = InteracoesJogos;

  /* ================================================================ desenho (só no navegador) */
  const K = root.PixelKit, U = root.PixelUI, Tipos = root.ClueTypes;
  if (!K || !U || !Tipos) return;
  const {C, SW, SH} = U;
  const snap = U.snap;
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

  /* Cores das rampas em cache: a interface pede milhares por quadro. */
  const cores = new Map();
  const cor = (rampa, nivel) => {
    const k = rampa + ':' + nivel;
    let c = cores.get(k);
    if (!c) { c = C(rampa, clamp(Math.round(nivel), 0, 7)); cores.set(k, c); }
    return c;
  };
  const rgba = (rampa, nivel, alpha) => { const [r, g, b] = K.hexToRgb(cor(rampa, nivel)); return `rgba(${r},${g},${b},${alpha})`; };
  const ret = (ctx, x, y, w, h, rampa, nivel) => { ctx.fillStyle = cor(rampa, nivel); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  /* O sistema é opcional em quase tudo: som, aviso e memória nunca derrubam a interface. */
  const seguro = (fn, padrao) => { try { return fn(); } catch (e) { return padrao; } };
  const som = (sys, nome) => seguro(() => sys.sfx(nome));
  const avisar = (sys, titulo, sub, icone) => seguro(() => sys.toast(titulo, sub, icone));
  const salvar = sys => seguro(() => sys.emit('change'));
  const memoriaDe = (sys, clue) => seguro(() => sys.memory(clue.id), null) || {};
  const declarado = (sys, id) => seguro(() => (sys.stage?.scene?.props || []).some(p => p && p.id === id), false);
  const simulado = sys => !!sys && Object.prototype.hasOwnProperty.call(sys, 'hasProp');
  /* Energia da sala: se a cena tem o estado "energia", vale o que ele diz; senão há luz. */
  const temEnergia = sys => (declarado(sys, 'energia') ? !!seguro(() => sys.hasProp('energia'), true) : true);
  /* Liga/desliga que espelha um estado da cena (ex.: `tv1.ligada`). A cena aplica
     setProp alguns quadros depois; até lá vale o que a interface pediu. Se o
     estado não existe (ou não pega), fica só na memória da interação. */
  function estadoCena(sys, mem, id, chave, padrao) {
    const local = chave + 'SoNaMemoria';
    const existe = () => !!id && !mem[local] && (declarado(sys, id) || simulado(sys));
    const ler = () => (existe() ? !!seguro(() => sys.hasProp(id), false) : typeof mem[chave] === 'boolean' ? mem[chave] : padrao);
    const e = {visto: ler(), pedido: null, espera: 0};
    e.valor = e.visto;
    e.get = (dt = 0) => {
      const v = ler();
      if (e.pedido !== null) {
        if (v === e.pedido) { e.pedido = null; e.visto = v; }
        else if ((e.espera += dt) > 2.5) { mem[local] = true; mem[chave] = e.pedido; e.pedido = null; e.visto = e.valor; }
        return e.valor;
      }
      if (v !== e.visto) { e.visto = v; e.valor = v; }
      return e.valor;
    };
    e.set = on => {
      on = !!on; e.valor = on; mem[chave] = on;
      if (existe()) { e.pedido = on; e.espera = 0; seguro(() => sys.setProp(id, on)); } else e.visto = on;
    };
    return e;
  }
  /* Itens da bolsa. Sem bolsa (prévia): tudo grátis e nada é entregue. */
  const temBolsa = sys => !!sys?.itens && typeof sys.itens.contar === 'function';
  const contarItem = (sys, id) => (temBolsa(sys) ? seguro(() => Number(sys.itens.contar(id)) || 0, 0) : Infinity);
  const gastarItem = (sys, id, n = 1) => (temBolsa(sys) ? !!seguro(() => sys.itens.gastar(id, n), false) : true);
  const darItem = (sys, id, n = 1, dados = null) => (temBolsa(sys) && typeof sys.itens.dar === 'function' ? seguro(() => sys.itens.dar(id, n, dados), false) : false);

  /* Telas desenhadas em pixels de arte num canvas próprio e ampliadas 2×. */
  const superficies = new Map();
  function superficie(nome, w, h) {
    let s = superficies.get(nome);
    if (!s || s.c.width !== w || s.c.height !== h) {
      const c = root.document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      s = {c, g, img: null};
      superficies.set(nome, s);
    }
    return s;
  }
  const ampliar = (ctx, s, x, y, escala = 2) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(s.c, Math.round(x), Math.round(y), s.c.width * escala, s.c.height * escala); };

  /* ---- texto */
  const escreve = (ctx, str, x, y, color, opts = {}) => K.drawText(ctx, String(str ?? ''), Math.round(x), Math.round(y), {color, ...opts});
  function contorno(ctx, str, x, y, color, borda, opts = {}) {
    const s = opts.scale || 1;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1]]) K.drawText(ctx, String(str ?? ''), Math.round(x) + dx * s, Math.round(y) + dy * s, {...opts, color: borda});
    return K.drawText(ctx, String(str ?? ''), Math.round(x), Math.round(y), {...opts, color});
  }
  function cortar(str, largura, fonte = '5x7') {
    str = String(str ?? '');
    if (K.measure(str, fonte) <= largura) return str;
    while (str.length > 1 && K.measure(str + '...', fonte) > largura) str = str.slice(0, -1);
    return str.replace(/\s+$/, '') + '...';
  }
  /* Quebra em linhas com larguras parecidas ("NÃO OLHEM / PARA CIMA" em vez de "NÃO OLHEM PARA / CIMA"). */
  function quebra(str, largura, maxLinhas = 99) {
    const linhas = K.wrap(String(str ?? ''), largura);
    if (linhas.length !== 2 || String(str).includes('\n')) return linhas.slice(0, maxLinhas);
    const palavras = String(str).trim().split(/\s+/);
    let melhor = linhas, pior = Math.max(...linhas.map(l => K.measure(l)));
    for (let i = 1; i < palavras.length; i++) {
      const a = palavras.slice(0, i).join(' '), z = palavras.slice(i).join(' '), m = Math.max(K.measure(a), K.measure(z));
      if (m <= largura && m < pior) { pior = m; melhor = [a, z]; }
    }
    return melhor;
  }
  /* Texto na fonte 3×5 dentro de um buffer de arte (maiúsculas, sem acento). */
  const pequeno = str => semAcento(str).toUpperCase().replace(/[·•]/g, '-').replace(/[^A-Z0-9 .\-:/!º]/g, '');

  /* ---- vidro das telas: varredura, cantos pontilhados e o reflexo da luz de cima à direita */
  function vidro(ctx, x, y, w, h, {linhas = .16, reflexo = .06, vinheta = 1} = {}) {
    if (linhas) { ctx.fillStyle = `rgba(3,2,9,${linhas})`; for (let yy = y + 1; yy < y + h; yy += 2) ctx.fillRect(x, yy, w, 1); }
    if (vinheta) {
      // Bordas escurecendo em degraus de 2 px; nos cantos as faixas se somam.
      ctx.fillStyle = `rgba(2,1,6,${.11 * vinheta})`;
      for (let i = 0; i < 5; i++) {
        const k = i * 2, e = 2 + (4 - i) * 0;
        ctx.fillRect(x, y + k, w, e); ctx.fillRect(x, y + h - k - e, w, e);
        ctx.fillRect(x + k, y + 2 * (i + 1), e, h - 4 * (i + 1)); ctx.fillRect(x + w - k - e, y + 2 * (i + 1), e, h - 4 * (i + 1));
      }
    }
    if (reflexo) {
      // Reflexo da luz de cima à direita: uma faixa fina em diagonal.
      ctx.fillStyle = `rgba(255,250,240,${reflexo})`;
      const n = Math.min(18, Math.floor(h / 6));
      for (let i = 0; i < n; i++) { ctx.fillRect(x + w - 22 - i * 3, y + 6 + i * 2, 6, 2); }
      for (let i = 0; i < n / 2; i++) ctx.fillRect(x + w - 12 - i * 3, y + 6 + i * 2, 2, 2);
    }
  }
  /* Tela apagada: vidro escuro com o reflexo do quarto. */
  function telaApagada(ctx, x, y, w, h, rampa = 'preto') {
    ret(ctx, x, y, w, h, rampa, 1);
    ctx.fillStyle = rgba('carvao', 3, .22);
    ctx.fillRect(x + 4, y + 4, w - 8, 2); ctx.fillRect(x + w - 6, y + 6, 2, h - 12);
    vidro(ctx, x, y, w, h, {linhas: 0, reflexo: .04, vinheta: 1.2});
  }
  /* Brilho da tela na parede: retângulos concêntricos bem transparentes. */
  function brilho(ctx, x, y, w, h, color, forca = 1) {
    if (forca <= 0) return;
    const [r, g, b] = K.hexToRgb(color);
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = `rgba(${r},${g},${b},${.045 * forca})`;
      ctx.fillRect(x - i * 12, y - i * 9, w + i * 24, h + i * 18);
    }
  }
  /* Um botão da arte fica afundado por um instante depois do clique. */
  const apertar = (st, id, data = null) => { st.aperto = {id, data, t: .14}; };
  const apertado = (st, id, data = null) => !!st.aperto && st.aperto.t > 0 && st.aperto.id === id && (data === null || st.aperto.data === data);
  const passarAperto = (st, dt) => { if (st.aperto) st.aperto.t -= dt; };
  /* Caixa escura de aviso no meio de uma tela. */
  function caixaAviso(ctx, cx, cy, titulo, sub, {largura = 0, tremor = 0} = {}) {
    const w = snap(Math.max(largura, K.measure(titulo) + 40, K.measure(sub) + 28)), h = sub ? 38 : 26;
    const x = snap(cx - w / 2 + tremor), y = snap(cy - h / 2);
    U.frame(ctx, x, y, w, h, 'escuro');
    escreve(ctx, titulo, x + w / 2, y + 9, '#ffd18c', {align: 'center'});
    if (sub) escreve(ctx, sub, x + w / 2, y + 22, '#e8d9f0', {align: 'center'});
  }

  /* Papel de bloco (anotações, recordes): pautado, com a borda de cima clara. */
  function papelArt(w, h, rampa = 'papel', {pauta = true, margem = true, semente = 3} = {}) {
    return U.art(`jogos:papel:${w}:${h}:${rampa}:${pauta}:${margem}:${semente}`, w, h, b => {
      const r = K.rng(semente);
      b.rect(0, 0, w, h, rampa, rampa === 'amarelo' ? 5 : 6);
      b.speckle(0, 0, w, h, rampa, rampa === 'amarelo' ? 4 : 5, .05, r);
      if (pauta) for (let y = 12; y < h - 2; y += 6) b.hline(2, w - 3, y, 'ceu', 4);
      if (margem) b.vline(9, 0, h - 1, 'vermelho', 5);
      b.hline(0, w - 1, 0, rampa, 7); b.vline(w - 1, 0, h - 1, rampa, 7); b.hline(0, w - 1, h - 1, rampa, 3); b.vline(0, 1, h - 1, rampa, 4);
      for (let y = h - 5; y < h; y++) b.shade(w - (h - y) * 2, y, (h - y) * 2, 1, -1);
    });
  }

  /* ---- ícones novos (16×16), sem pisar nos que já existirem */
  const ICONES = {
    tv(b) {
      b.line(5, 1, 7, 4, 'metal', 4); b.line(11, 1, 9, 4, 'metal', 4);
      b.bevel(1, 4, 14, 11, 'madeira', 3, 5, 1); b.rect(2, 5, 9, 8, 'agua', 3); b.rect(3, 6, 4, 2, 'agua', 5);
      b.px(12, 6, 'metal', 5); b.px(12, 9, 'metal', 5); b.hline(12, 13, 12, 'vermelho', 4);
    },
    telefone(b) {
      b.rect(2, 3, 12, 3, 'vermelho', 3); b.hline(2, 13, 3, 'vermelho', 5); b.rect(1, 5, 3, 3, 'vermelho', 2); b.rect(12, 5, 3, 3, 'vermelho', 2);
      b.poly([[3, 15], [13, 15], [11, 8], [5, 8]], 'vermelho', 3); b.hline(5, 10, 8, 'vermelho', 5);
      b.ellipse(8, 11.5, 2.2, 2.2, 'papel', 5); b.px(8, 11, 'vermelho', 2);
    },
    maquina(b) {
      b.bevel(2, 1, 12, 15, 'vermelho', 3, 5, 1); b.rect(3, 3, 7, 11, 'agua', 1);
      for (let y = 4; y < 13; y += 3) { b.hline(4, 8, y, 'amarelo', 4); b.px(5, y + 1, 'folha', 4); b.px(7, y + 1, 'papel', 6); }
      b.rect(11, 4, 2, 2, 'fosforo', 5); b.rect(11, 8, 2, 4, 'metal', 4);
    },
    fliperama(b) {
      b.rect(3, 1, 10, 3, 'roxo', 5); b.bevel(2, 4, 12, 7, 'carvao', 2, 4, 1); b.rect(4, 5, 8, 5, 'azul', 1);
      b.px(6, 7, 'fosforo', 5); b.px(9, 6, 'vermelho', 5); b.poly([[1, 15], [15, 15], [14, 11], [2, 11]], 'roxo', 3);
      b.vline(5, 10, 12, 'metal', 5); b.px(5, 9, 'vermelho', 4); b.px(10, 12, 'amarelo', 5); b.px(12, 12, 'vermelho', 5);
    },
    raio(b) { b.poly([[9, 0], [3, 9], [7, 9], [5, 16], [13, 6], [9, 6], [11, 0]], 'amarelo', 5); b.line(9, 1, 5, 8, 'amarelo', 7); },
    moeda(b) { b.ellipse(8, 8, 6.5, 6.5, 'latao', 2); b.ellipse(8, 8, 5.5, 5.5, 'latao', 4); b.ellipse(7, 7, 3.2, 3.2, 'latao', 5); b.vline(8, 5, 10, 'latao', 2); b.px(10, 4, 'latao', 7); }
  };
  for (const [nome, pinta] of Object.entries(ICONES)) if (!U.ICONS[nome]) U.ICONS[nome] = pinta;

  /* ================================================================ TV */
  const TV_PADRAO = {
    estilo: 'tubo', marca: 'VISORAMA',
    canais: [
      'TV CIDADE | noticias | Luzes paradas sobre o bairro pela terceira noite · Prefeitura pede que ninguém saia depois das 22h · Previsão: céu limpo, limpo demais',
      'CANAL 4 | desenho | A Turma do Sol volta depois dos comerciais!',
      'NOVELA | novela | Você sabia o tempo todo? / Eu só sabia que o céu estava com fome. / E mesmo assim você ficou.',
      'SUPER 8 | propaganda | GUARANÁ ESTRELA · o sabor que caiu do céu!',
      'ESPORTE | futebol | UNIÃO 2 x 1 ESTRELA',
      '??? | mensagem | NÃO OLHEM PARA CIMA',
      'FORA DO AR | chuvisco |'
    ].join('\n')
  };
  const canaisDe = clue => { const lista = parseCanais(campo(clue.data?.canais, TV_PADRAO.canais)); return lista.length ? lista : parseCanais(TV_PADRAO.canais); };
  const TV_LAYOUT = {
    tubo: {tela: {x: 76, y: 70, w: 216, h: 160}, res: [108, 80], corpo: [56, 44, 370, 196]},
    plana: {tela: {x: 24, y: 38, w: 340, h: 190}, res: [170, 95], corpo: [20, 30, 452, 240]}
  };
  const hashN = (i, s = 0) => K.hash2(i, s, 911);

  /* ---- arte fixa */
  function tvParedeTubo() {
    return U.art('tv:parede:tubo', 240, 124, b => {
      for (let y = 0; y < 124; y++) for (let x = 0; x < 240; x++) {
        const faixa = x % 20 < 10, lx = (x % 20) - 9.5, ly = ((y + (Math.floor(x / 20) % 2) * 8) % 16) - 7.5;
        const r = Math.abs(lx) / 4 + Math.abs(ly) / 6;
        b.px(x, y, 'couro', (faixa ? 2 : 1) + (r < 1 && r > .55 ? 1 : 0));
      }
      // Foto do céu num porta-retrato à esquerda; calendário de 1987 à direita.
      b.bevel(4, 30, 20, 26, 'madeira', 3, 5, 1); b.rect(6, 32, 16, 22, 'papel', 5);
      b.vgrad(7, 33, 14, 14, 'ceuVermelho', 2, 5); b.rect(7, 47, 14, 6, 'preto', 2); b.px(12, 36, 'amarelo', 6); b.px(16, 38, 'amarelo', 6); b.px(10, 39, 'amarelo', 6);
      b.rect(217, 28, 18, 26, 'papel', 5); b.hline(217, 234, 28, 'papel', 7); b.rect(217, 28, 18, 7, 'vermelho', 3);
      b.text(226, 30, '1987', 'papel', 7, {font: '3x5', align: 'center'});
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) b.rect(219 + c * 4, 37 + r * 4, 2, 2, 'papel', 3);
      b.line(223, 45, 225, 47, 'vermelho', 3); b.line(225, 45, 223, 47, 'vermelho', 3);
      b.vline(226, 25, 27, 'metal', 4);
      // Rack de madeira.
      b.rect(0, 116, 240, 8, 'mogno', 3); b.hline(0, 239, 116, 'mogno', 5); b.hline(0, 239, 117, 'mogno', 4); b.hline(0, 239, 119, 'mogno', 1);
      for (let x = 30; x < 240; x += 60) b.rect(x, 121, 8, 2, 'latao', 4);
      b.shadeFn(0, 0, 240, 124, (x, y) => -Math.max(0, Math.hypot((x - 120) / 150, (y - 64) / 90) - .45) * 3.2);
    });
  }
  function tvCorpoTubo(marca) {
    return U.art('tv:corpo:tubo:' + marca, 240, 124, b => {
      const X0 = 28, Y0 = 16, X1 = 212, Y1 = 114;
      // Antena de coelho com as pontas de palha de aço.
      b.line(116, 13, 97, 0, 'metal', 5); b.line(117, 13, 98, 0, 'metal', 3);
      b.line(124, 13, 145, 1, 'metal', 5); b.line(123, 13, 144, 1, 'metal', 3);
      for (const [x, y] of [[97, 1], [145, 2]]) { b.ellipse(x, y, 2.4, 2, 'metal', 4); b.px(x + 1, y - 1, 'metal', 6); b.px(x - 1, y, 'metal', 2); }
      b.rect(111, 12, 18, 4, 'carvao', 2); b.hline(112, 127, 12, 'carvao', 5); b.px(120, 11, 'carvao', 4);
      // Madeira com veio.
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
        const veio = Math.sin(x * .7 + Math.sin(y * .13 + x * .02) * 2.4) + K.hash2(x >> 1, y >> 3, 5) * .5;
        b.px(x, y, 'madeira', veio > 1.05 ? 4 : veio < -1.1 ? 2 : 3);
      }
      b.hline(X0, X1 - 1, Y0, 'madeira', 5); b.hline(X0, X1 - 1, Y0 + 1, 'madeira', 4);
      b.vline(X1 - 1, Y0, Y1 - 1, 'madeira', 5); b.vline(X0, Y0, Y1 - 1, 'madeira', 1); b.hline(X0, X1 - 1, Y1 - 1, 'madeira', 1);
      for (const [x, y] of [[X0, Y0], [X0 + 1, Y0], [X0, Y0 + 1], [X1 - 1, Y0], [X1 - 2, Y0], [X1 - 1, Y0 + 1], [X0, Y1 - 1], [X1 - 1, Y1 - 1]]) b.erase(x, y, 1, 1);
      // Paninho de crochê e o vaso com uma rosa de plástico.
      for (let x = 50; x < 86; x++) { b.px(x, Y0 - 1, 'papel', x % 3 ? 6 : 4); b.px(x, Y0, 'papel', x % 3 ? 5 : 7); if (x % 4 < 2) b.px(x, Y0 + 1, 'papel', 5); if (x % 4 === 0) b.px(x, Y0 + 2, 'papel', 4); }
      b.rect(63, 9, 8, 6, 'agua', 3); b.vline(70, 9, 14, 'agua', 5); b.vline(63, 9, 14, 'agua', 2); b.hline(62, 71, 9, 'agua', 4); b.px(66, 11, 'agua', 6);
      b.line(67, 8, 66, 3, 'folha', 3); b.px(68, 5, 'folha', 5); b.px(65, 6, 'folha', 4);
      b.ellipse(66, 2.5, 2.5, 2.2, 'vermelho', 3); b.px(66, 2, 'vermelho', 5); b.px(67, 1, 'vermelho', 6);
      // Moldura escura do tubo e o buraco da tela (cantos arredondados).
      b.inset(34, 21, 116, 86, 'carvao', 2, 4, 1);
      b.rect(36, 23, 112, 82, 'preto', 2);
      b.erase(38, 24, 108, 80);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) for (const [x, y] of [[38 + i, 24 + j], [145 - i, 24 + j], [38 + i, 103 - j], [145 - i, 103 - j]]) b.px(x, y, 'preto', 2);
      // Placa de controles.
      b.inset(154, 21, 52, 86, 'metal', 3, 5, 1);
      for (let y = 23; y < 105; y += 2) b.hline(156, 203, y, 'metal', y % 4 === 1 ? 4 : 3);
      for (let y = 26; y < 42; y += 3) { b.hline(160, 199, y, 'preto', 1); b.hline(160, 199, y + 1, 'metal', 5); }
      b.text(180, 46, 'CANAL', 'preto', 2, {font: '3x5', align: 'center'});
      b.ellipse(180, 61, 10, 10, 'preto', 1); b.ellipse(180, 61, 9, 9, 'carvao', 3); b.ellipse(181, 60, 7, 7, 'carvao', 4);
      for (let a = 0; a < 12; a++) { const t = -2.36 + a * 4.71 / 11; b.px(180 + Math.cos(t - Math.PI / 2) * 12, 61 + Math.sin(t - Math.PI / 2) * 12, 'preto', 2); }
      b.text(180, 74, 'VOLUME', 'preto', 2, {font: '3x5', align: 'center'});
      b.ellipse(180, 86, 7, 7, 'preto', 1); b.ellipse(180, 86, 6, 6, 'carvao', 3); b.ellipse(181, 85, 4, 4, 'carvao', 4);
      b.bevel(160, 96, 22, 8, 'papel', 4, 6, 2); b.text(171, 98, 'LIGA', 'tinta', 1, {font: '3x5', align: 'center'});
      b.rect(191, 98, 5, 4, 'preto', 1);
      // Marca e pés.
      const mw = Math.max(24, K.measure(pequeno(marca), '3x5') + 8);
      b.bevel(Math.round(92 - mw / 2), 106, mw, 7, 'latao', 3, 5, 1); b.text(92, 107, pequeno(marca), 'latao', 1, {font: '3x5', align: 'center'});
      b.rect(40, 114, 8, 3, 'madeira', 1); b.rect(192, 114, 8, 3, 'madeira', 1);
    });
  }
  function tvParedePlana() {
    return U.art('tv:parede:plana', 240, 124, b => {
      b.rect(0, 0, 240, 112, 'azul', 1);
      for (let y = 0; y < 112; y += 4) for (let x = (y % 8) ? 2 : 0; x < 240; x += 4) b.px(x, y, 'azul', 2);
      // Painel de ripas atrás da TV.
      for (let x = 2; x < 192; x += 6) { b.rect(x, 0, 5, 112, 'madeira', 2); b.vline(x + 4, 0, 111, 'madeira', 3); b.vline(x + 5, 0, 111, 'madeira', 0); }
      // Rack claro.
      b.rect(0, 112, 240, 12, 'madeira', 4); b.hline(0, 239, 112, 'madeira', 6); b.hline(0, 239, 113, 'madeira', 5); b.hline(0, 239, 117, 'madeira', 2);
      for (let x = 20; x < 240; x += 80) b.rect(x, 120, 10, 1, 'madeira', 6);
      b.shadeFn(0, 0, 240, 112, (x, y) => -Math.max(0, Math.hypot((x - 98) / 160, (y - 56) / 80) - .5) * 2.6);
    });
  }
  function tvCorpoPlana(marca) {
    return U.art('tv:corpo:plana:' + marca, 240, 124, b => {
      b.rect(10, 6, 174, 102, 'preto', 2);
      b.hline(10, 183, 6, 'preto', 4); b.vline(183, 6, 107, 'preto', 4); b.vline(10, 6, 107, 'preto', 1); b.hline(10, 183, 107, 'preto', 1);
      b.erase(12, 8, 170, 95);
      b.rect(12, 103, 170, 4, 'preto', 3); b.hline(12, 181, 103, 'carvao', 3);
      b.text(97, 103, pequeno(marca), 'carvao', 5, {font: '3x5', align: 'center'});
      b.rect(88, 108, 18, 3, 'preto', 3); b.rect(80, 111, 34, 2, 'preto', 4); b.hline(80, 113, 111, 'carvao', 4);
      // Controle remoto de pé, na frente do rack.
      const rx = 196, ry = 26;
      b.rect(rx + 2, ry + 2, 36, 96, 'azul', 0);
      b.rect(rx, ry, 36, 96, 'carvao', 2);
      b.hline(rx + 1, rx + 34, ry, 'carvao', 4); b.vline(rx + 35, ry + 1, ry + 95, 'carvao', 4); b.vline(rx, ry + 1, ry + 95, 'carvao', 1);
      for (const [x, y] of [[rx, ry], [rx + 35, ry], [rx, ry + 95], [rx + 35, ry + 95]]) b.erase(x, y, 1, 1);
      b.rect(rx + 13, ry + 2, 10, 3, 'vermelho', 1); b.hline(rx + 14, rx + 21, ry + 2, 'vermelho', 3);
      b.text(rx + 18, ry + 88, 'VR', 'carvao', 5, {font: '3x5', align: 'center'});
    });
  }
  /* Botões do controle remoto: [id, dado, x, y, w, h, rótulo] em pixels de arte relativos ao controle. */
  const REMOTO = (() => {
    const bts = [['liga', null, 25, 7, 8, 7, ''], ['mudo', null, 3, 7, 8, 7, '']];
    for (let n = 1; n <= 9; n++) bts.push(['num', n, 3 + ((n - 1) % 3) * 11, 18 + Math.floor((n - 1) / 3) * 8, 9, 6, String(n)]);
    bts.push(['num', 10, 14, 42, 9, 6, '0']);
    bts.push(['canal+', null, 3, 53, 9, 9, ''], ['canal-', null, 3, 63, 9, 9, ''], ['vol+', null, 24, 53, 9, 9, '+'], ['vol-', null, 24, 63, 9, 9, '-']);
    return bts;
  })();
  /* Triângulo em degraus de 2 px (setas dos botões). */
  function triangulo(ctx, cx, cy, dir, tam, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < tam; i++) {
      const len = 2 + i * 4 - (i ? 0 : 0);
      if (dir === 'cima') ctx.fillRect(cx - 1 - i * 2, cy - tam + i * 2, len, 2);
      else if (dir === 'baixo') ctx.fillRect(cx - 1 - i * 2, cy + tam - 2 - i * 2, len, 2);
      else if (dir === 'esq') ctx.fillRect(cx - tam + i * 2, cy - 1 - i * 2, 2, len);
      else ctx.fillRect(cx + tam - 2 - i * 2, cy - 1 - i * 2, 2, len);
    }
  }

  /* ---- canais: fundo em pixels de arte (g) e letreiros em pixels de tela (ctx) */
  const px = (g, x, y, w, h, rampa, nivel) => { g.fillStyle = cor(rampa, nivel); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const letra3 = (g, str, x, y, rampa, nivel, align = 'left') => {
    const s = pequeno(str), w = K.measure(s, '3x5'), ox = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    g.fillStyle = cor(rampa, nivel); K.glyphs(s, ox, y, '3x5', (gx, gy) => g.fillRect(gx, gy, 1, 1));
    return w;
  };
  const angulos = new Map();
  function tabelaAngulos(w, h) {
    const k = w + 'x' + h;
    let a = angulos.get(k);
    if (!a) { a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = Math.atan2(y - h * .46, x - w / 2); angulos.set(k, a); }
    return a;
  }
  /* Polígono preenchido por linhas (sem antisserrilhado); devolve os trechos de cada linha. */
  function poligono(g, pts, rampa, nivel) {
    const ys = pts.map(p => p[1]), spans = [];
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(g.canvas.height - 1, Math.ceil(Math.max(...ys)));
    g.fillStyle = cor(rampa, nivel);
    for (let y = y0; y <= y1; y++) {
      const cy = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.round(xs[k]), z = Math.round(xs[k + 1]); if (z > a) { g.fillRect(a, y, z - a, 1); spans.push([y, a, z]); } }
    }
    return spans;
  }
  /* Silhueta de perfil (olhando para `dir`), com luz de recorte no rosto. */
  const PERFIL = [[-.55, 1.05], [-.95, .5], [-1, 0], [-.85, -.6], [-.45, -.95], [.15, -1], [.7, -.72], [.9, -.3], [.95, -.1], [1.22, .16], [.95, .3], [1.02, .45], [.93, .6], [.96, .76], [.7, .96], [.36, 1.02],
    [.36, 1.45], [1.6, 1.85], [2, 5], [-2.2, 5], [-2, 1.85], [-.5, 1.45]];
  function cabecaPerfil(g, cx, cy, r, dir, {coque = false, borda = 'fogo'} = {}) {
    const P = (lista) => lista.map(([x, y]) => [cx + x * r * dir, cy + y * r]);
    if (coque) {
      poligono(g, P([[-.9, -.2], [-1.25, .7], [-1.05, 1.25], [-.5, 1.2]]), 'preto', 1);
      poligono(g, P([[-1.5, -.55], [-1.3, -.95], [-.95, -1.05], [-.7, -.7], [-.9, -.3], [-1.3, -.25]]), 'preto', 1);
    }
    const spans = poligono(g, P(PERFIL), 'preto', 1), limite = cy + r * 1.5;
    const frente = new Map();
    for (const [y, a, z] of spans) { const f = dir > 0 ? z - 1 : a; const atual = frente.get(y); if (atual === undefined || (dir > 0 ? f > atual : f < atual)) frente.set(y, f); }
    g.fillStyle = cor(borda, 4);
    for (const [y, x] of frente) if (y < limite || y < limite + 2) g.fillRect(x, y, 1, 1);
  }
  const CANAIS = {
    noticias: {
      brilho: () => cor('agua', 4),
      fundo(g, w, h, t) {
        g.drawImage(U.art(`tv:noticias:${w}:${h}`, w, h, b => {
          b.vgrad(0, 0, w, h, 'azul', 1.2, 2.8);
          for (let x = 4; x < w * .4; x += 9) b.dither(x, 0, 3, Math.round(h * .74), 'azul', 3, .5);
          // Telão: a cidade debaixo do céu vermelho, com as três luzes paradas.
          const tx = Math.round(w * .44), ty = Math.round(h * .2), tw = Math.round(w * .5), th = Math.round(h * .46);
          b.rect(tx - 2, ty - 2, tw + 4, th + 4, 'azul', 0); b.frame(tx - 1, ty - 1, tw + 2, th + 2, 'agua', 3);
          b.vgrad(tx, ty, tw, th, 'ceuVermelho', 1, 4.5);
          for (let x = 0; x < tw;) {
            const bw = 3 + Math.floor(hashN(x, 3) * 6), bh = Math.round(th * (.18 + hashN(x, 4) * .38));
            b.rect(tx + x, ty + th - bh, Math.min(bw, tw - x), bh, 'preto', 2);
            for (let yy = ty + th - bh + 2; yy < ty + th - 1; yy += 3) for (let xx = tx + x + 1; xx < tx + x + bw - 1 && xx < tx + tw; xx += 2) if (hashN(xx * 7 + yy, 5) > .62) b.px(xx, yy, 'amarelo', 4);
            x += bw + 1;
          }
          for (const [ux, uy] of [[.35, .2], [.5, .12], [.63, .24]]) { b.px(tx + tw * ux, ty + th * uy, 'amarelo', 7); b.px(tx + tw * ux + 1, ty + th * uy, 'amarelo', 5); b.px(tx + tw * ux, ty + th * uy + 1, 'amarelo', 4); }
          const by = Math.round(h * .74);
          b.rect(0, by, w, h - by, 'azul', 1); b.hline(0, w - 1, by, 'agua', 5); b.hline(0, w - 1, by + 1, 'agua', 3);
        }), 0, 0);
        // Apresentador em silhueta, de terno e gravata, respirando devagar.
        const by = Math.round(h * .74), ax = Math.round(w * .25), r = Math.max(5, Math.round(h * .085));
        const hy = Math.round(h * .38) + (Math.sin(t * 1.4) > .7 ? 1 : 0);
        for (let y = hy - r; y < by; y++) {
          let half;
          if (y < hy + r) half = Math.sqrt(Math.max(0, 1 - Math.pow((y + .5 - hy) / r, 2))) * r * .82;
          else if (y < hy + r + 3) half = r * .42;
          else half = Math.min(r * 2.5, r * .9 + (y - hy - r - 3) * 1.6);
          const x0 = Math.round(ax - half), x1 = Math.round(ax + half);
          px(g, x0, y, x1 - x0, 1, 'preto', 1);
          px(g, x1 - 1, y, 1, 1, 'agua', 3);
          if (y > hy + r + 5 && half > 3) px(g, x0, y, 1, 1, 'azul', 2);
        }
        const gola = hy + r + 3;
        for (let i = 0; i < 4; i++) { px(g, ax - 3 + i, gola + i, 1, 1, 'papel', 6); px(g, ax + 2 - i, gola + i, 1, 1, 'papel', 6); }
        px(g, ax, gola + 1, 1, by - gola - 2, 'vermelho', 3); px(g, ax - 1, gola + 3, 3, by - gola - 5, 'vermelho', 3); px(g, ax - 1, gola + 1, 3, 2, 'vermelho', 4);
        px(g, ax + Math.round(r * 1.2), gola + 6, 1, by - gola - 6, 'preto', 0);
      },
      texto(ctx, X, Y, W, H, t, canal, st) {
        const partes = String(canal.texto || '').split('·').map(s => s.trim()).filter(Boolean);
        const manchete = partes[0] || canal.nome, fita = (partes.length ? partes : [canal.nome]).join('   ·   ');
        // Selo "ao vivo" e o logo do canal.
        if (Math.floor(t * 1.6) % 2 === 0) U.rect(ctx, X + 14, Y + 13, 6, 6, cor('vermelho', 5));
        contorno(ctx, 'AO VIVO', X + 24, Y + 12, cor('papel', 7), cor('preto', 0));
        const nome = cortar(canal.nome, 90), lw = K.measure(nome) + 14;
        ret(ctx, X + W - lw - 12, Y + 9, lw, 15, 'vermelho', 3); ret(ctx, X + W - lw - 12, Y + 9, lw, 2, 'vermelho', 5); ret(ctx, X + W - lw - 12, Y + 22, lw, 2, 'vermelho', 1);
        escreve(ctx, nome, X + W - 12 - lw / 2, Y + 13, cor('papel', 7), {align: 'center'});
        // Tarja de manchete e o letreiro correndo.
        const y1 = Y + H - 46;
        ret(ctx, X + 10, y1, W - 20, 17, 'papel', 6); ret(ctx, X + 10, y1 + 15, W - 20, 2, 'papel', 3);
        ret(ctx, X + 10, y1, 58, 17, 'vermelho', 3); ret(ctx, X + 10, y1, 58, 2, 'vermelho', 5);
        escreve(ctx, 'URGENTE', X + 39, y1 + 5, cor('papel', 7), {align: 'center'});
        escreve(ctx, cortar(manchete, W - 96), X + 74, y1 + 5, cor('tinta', 0));
        const y2 = Y + H - 27, xa = X + 10, wa = W - 20;
        ret(ctx, xa, y2, wa, 13, 'amarelo', 4); ret(ctx, xa, y2, wa, 1, 'amarelo', 6);
        const tw = K.measure(fita);
        ctx.save(); ctx.beginPath(); ctx.rect(xa + 36, y2, wa - 36, 13); ctx.clip();
        escreve(ctx, fita, xa + wa - (t * 36) % (tw + wa), y2 + 3, cor('preto', 1));
        ctx.restore();
        ret(ctx, xa, y2, 34, 13, 'preto', 2);
        escreve(ctx, st?.hora || '22:47', xa + 17, y2 + 3, cor('amarelo', 5), {align: 'center'});
      }
    },
    chuvisco: {
      brilho: () => cor('palido', 5),
      fundo(g, w, h, t) {
        const quadro = Math.floor(t * 24) % 6, off = Math.floor(hashN(Math.floor(t * 24), 8) * h);
        const arte = U.art(`tv:chuvisco:${w}:${h}:${quadro}`, w, h, b => {
          const r = K.rng(97 + quadro * 13);
          for (let y = 0; y < h; y++) {
            const faixa = r() < .08 ? 1 : 0;
            for (let x = 0; x < w; x++) { const v = r(); b.px(x, y, v < .08 ? 'carvao' : 'palido', v < .08 ? 1 : Math.min(7, Math.floor(v * v * 8) + faixa)); }
          }
        });
        g.drawImage(arte, 0, -off); g.drawImage(arte, 0, h - off);
        const faixa = Math.floor((t * 40) % (h + 20)) - 10;
        g.fillStyle = 'rgba(240,240,255,.18)'; g.fillRect(0, faixa, w, 6);
      },
      texto() {}
    },
    desenho: {
      brilho: () => cor('ceu', 5),
      fundo(g, w, h, t, canal) {
        g.drawImage(U.art(`tv:desenho:${w}:${h}`, w, h, b => { b.vgrad(0, 0, w, Math.round(h * .7), 'ceu', 4.2, 6.2); b.rect(0, Math.round(h * .7), w, h, 'folha', 5); }), 0, 0);
        const chao = Math.round(h * .74);
        // Sol sorridente — que de vez em quando mostra os dentes.
        const sx = w - 20, sy = 17, fome = (t % 9) > 8.3;
        for (let k = 0; k < 8; k++) { const a = t * .8 + k * Math.PI / 4; px(g, sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, 2, 2, 'amarelo', 6); }
        for (let y = -8; y <= 8; y++) { const hw = Math.round(Math.sqrt(64 - y * y)); px(g, sx - hw, sy + y, hw * 2, 1, 'amarelo', y < -3 ? 6 : 5); }
        px(g, sx - 4, sy - 3, 2, 2, fome ? 'vermelho' : 'madeira', fome ? 5 : 2); px(g, sx + 2, sy - 3, 2, 2, fome ? 'vermelho' : 'madeira', fome ? 5 : 2);
        if (fome) { px(g, sx - 5, sy + 1, 10, 5, 'vermelho', 1); for (let i = 0; i < 5; i++) { px(g, sx - 5 + i * 2, sy + 1, 1, 2, 'papel', 7); px(g, sx - 4 + i * 2, sy + 4, 1, 2, 'papel', 7); } }
        else { px(g, sx - 4, sy + 2, 8, 1, 'madeira', 2); px(g, sx - 5, sy + 1, 1, 1, 'madeira', 2); px(g, sx + 4, sy + 1, 1, 1, 'madeira', 2); }
        // Nuvens passando na frente.
        for (let i = 0; i < 3; i++) {
          const cx = ((i * 61 + 20 - t * (4 + i)) % (w + 40) + w + 40) % (w + 40) - 20, cy = 9 + i * 8;
          px(g, cx - 8, cy, 16, 4, 'papel', 7); px(g, cx - 4, cy - 3, 9, 3, 'papel', 7); px(g, cx - 8, cy + 3, 16, 1, 'ceu', 5); px(g, cx + 3, cy - 2, 3, 1, 'ceu', 6);
        }
        // Morros ao longe e o chão correndo.
        g.fillStyle = cor('folha', 3);
        for (let x = 0; x < w; x++) { const top = Math.round(h * .55 + Math.sin((x + t * 6) * .07) * 5 + Math.sin((x + t * 6) * .19) * 2); g.fillRect(x, top, 1, chao - top); }
        px(g, 0, chao, w, h - chao, 'folha', 5); px(g, 0, chao, w, 1, 'folha', 6);
        for (let i = 0; i < 14; i++) { const x = ((i * 23 - t * 22) % (w + 10) + w + 10) % (w + 10) - 5; px(g, x, chao + 3 + (i % 3) * 3, 1, 2, 'folha', 7); if (i % 4 === 0) px(g, x + 2, chao + 5, 2, 2, i % 8 ? 'rosa' : 'amarelo', 5); }
        // Pedra que vem vindo e a Bolinha pulando.
        const ciclo = 3.2, fase = (t % ciclo) / ciclo, cx = Math.round(w * .34);
        const rx = Math.round(w + 6 - fase * (w + 20));
        px(g, rx, chao - 4, 8, 4, 'metal', 3); px(g, rx + 1, chao - 5, 5, 1, 'metal', 5);
        const dist = (rx + 4) - cx, pulo = Math.abs(dist) < 14 ? Math.round(Math.cos(dist / 14 * Math.PI / 2) * 14) : 0;
        const by = chao - 12 - pulo + (pulo ? 0 : (Math.floor(t * 8) % 2));
        for (let y = 0; y < 11; y++) { const hw = Math.round(Math.sqrt(30.25 - Math.pow(y - 5, 2))); px(g, cx - hw, by + y, hw * 2, 1, 'fogo', y < 3 ? 5 : y > 8 ? 3 : 4); }
        px(g, cx + 1, by + 2, 3, 4, 'papel', 7); px(g, cx - 3, by + 2, 3, 4, 'papel', 7); px(g, cx + 2, by + 3, 1, 2, 'preto', 0); px(g, cx - 2, by + 3, 1, 2, 'preto', 0);
        px(g, cx - 1, by + 7, 3, 1, 'vermelho', 2);
        const passo = Math.floor(t * 8) % 2;
        if (!pulo) { px(g, cx - 3 + passo, by + 11, 2, 1, 'madeira', 1); px(g, cx + 2 - passo, by + 11, 2, 1, 'madeira', 1); }
      },
      texto(ctx, X, Y, W, H, t, canal) {
        if (!canal.texto) return;
        const linhas = K.wrap(canal.texto, W - 30).slice(0, 2);
        linhas.forEach((l, i) => contorno(ctx, l, X + W / 2, Y + H - 14 - (linhas.length - 1 - i) * 11, cor('papel', 7), cor('preto', 0), {align: 'center'}));
      }
    },
    novela: {
      brilho: () => cor('fogo', 4),
      fundo(g, w, h, t) {
        g.drawImage(U.art(`tv:novela:${w}:${h}`, w, h, b => {
          b.vgrad(0, 0, w, h, 'sepia', 2.6, 1.4);
          const jx = Math.round(w * .38), jw = Math.round(w * .26), jy = Math.round(h * .12), jh = Math.round(h * .5);
          b.rect(jx - 2, jy - 2, jw + 4, jh + 4, 'madeira', 2);
          b.vgrad(jx, jy, jw, jh, 'ceuVermelho', 5, 2);
          for (let y = jy + 1; y < jy + jh; y += 3) b.hline(jx, jx + jw - 1, y, 'madeira', 3);
          for (let i = 0; i < 5; i++) b.poly([[jx + jw + 4 + i * 9, jy + 6], [jx + jw + 8 + i * 9, jy + 6], [jx + jw + 22 + i * 9, h], [jx + jw + 16 + i * 9, h]], 'sepia', 3);
          b.rect(Math.round(w * .86), Math.round(h * .3), 2, Math.round(h * .7), 'madeira', 1);
          b.poly([[w * .8, h * .3], [w * .92, h * .3], [w * .89, h * .18], [w * .83, h * .18]], 'amarelo', 4);
        }), 0, 0);
        const plano = Math.floor(t / 4.2) % 3;
        if (plano === 0) {
          cabecaPerfil(g, Math.round(w * .3), Math.round(h * .5), Math.round(h * .11), 1);
          cabecaPerfil(g, Math.round(w * .7), Math.round(h * .52), Math.round(h * .1), -1, {coque: true, borda: 'rosa'});
        } else if (plano === 1) cabecaPerfil(g, Math.round(w * .32), Math.round(h * .44), Math.round(h * .24), 1);
        else cabecaPerfil(g, Math.round(w * .68), Math.round(h * .46), Math.round(h * .22), -1, {coque: true, borda: 'rosa'});
      },
      texto(ctx, X, Y, W, H, t, canal) {
        const falas = String(canal.texto || '').split('/').map(s => s.trim()).filter(Boolean);
        if (!falas.length) return;
        const fala = '— ' + falas[Math.floor(t / 4.2) % falas.length];
        const linhas = K.wrap(fala, W - 36).slice(0, 2);
        linhas.forEach((l, i) => contorno(ctx, l, X + W / 2, Y + H - 16 - (linhas.length - 1 - i) * 11, cor('amarelo', 6), cor('preto', 0), {align: 'center'}));
      }
    },
    propaganda: {
      brilho: () => cor('vermelho', 5),
      fundo(g, w, h, t) {
        const s = superficie('tv:raios', w, h), ang = tabelaAngulos(w, h);
        if (!s.img) s.img = s.g.createImageData(w, h);
        const data = s.img.data, A = K.hexToRgb(cor('vermelho', 3)), B = K.hexToRgb(cor('vermelho', 4)), G1 = K.hexToRgb(cor('amarelo', 5)), G2 = K.hexToRgb(cor('fogo', 4));
        const giro = t * .6, cy = h * .5;
        for (let i = 0, n = w * h; i < n; i++) {
          const x = i % w, y = (i / w) | 0, d = Math.hypot(x - w / 2, (y - cy) * 1.15);
          const v = (((ang[i] + giro) / (Math.PI * 2) * 14) % 2 + 2) % 2;
          const c = d < 17 ? G1 : d < 21 && K.bayer(x, y) < (21 - d) / 4 ? G2 : v < 1 ? A : B;
          data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255;
        }
        g.putImageData(s.img, 0, 0);
        // A lata girando: frente vermelha com a faixa e a estrela, costas de alumínio.
        const cx = Math.round(w / 2), lh = Math.round(h * .38), c = Math.cos(t * 2.3), lw = Math.max(2, Math.round(Math.abs(c) * 16));
        const x0 = cx - Math.round(lw / 2), y0 = Math.round(cy - lh / 2), frente = c > 0;
        px(g, x0 + 2, y0 + 3, lw, lh, 'vermelho', 1);
        for (let x = 0; x < lw; x++) {
          const u = lw > 1 ? x / (lw - 1) : .5, luz = u > .72 ? 1 : u < .22 ? -1 : 0;
          px(g, x0 + x, y0 + 1, 1, lh - 2, frente ? 'vermelho' : 'metal', (frente ? 4 : 4) + luz);
          if (frente) { const onda = Math.round(Math.sin(u * 5 + t * 2.3) * 1.5); px(g, x0 + x, Math.round(cy) - 2 + onda, 1, 3, 'papel', 7 - (luz < 0 ? 1 : 0)); }
        }
        if (frente && lw > 8) { const sx = cx + Math.round(Math.sin(t * 2.3) * lw * .3); px(g, sx - 1, y0 + 5, 3, 3, 'amarelo', 6); px(g, sx, y0 + 4, 1, 5, 'amarelo', 6); px(g, sx - 2, y0 + 6, 5, 1, 'amarelo', 6); }
        px(g, x0 + 1, y0 - 1, Math.max(1, lw - 2), 1, 'metal', 6); px(g, x0, y0, lw, 2, 'metal', 5); px(g, x0, y0 + lh - 2, lw, 2, 'metal', 3); px(g, x0 + 1, y0 + lh, Math.max(1, lw - 2), 1, 'metal', 2);
        for (let k = 0; k < 4; k++) {
          const f = (t * 1.5 + k * .25) % 1; if (f > .6) continue;
          const sx = cx + [-24, 22, -18, 28][k], sy = Math.round(cy) + [-12, -16, 12, 6][k], r = f < .3 ? 1 : 2;
          px(g, sx - r, sy, r * 2 + 1, 1, 'amarelo', 7); px(g, sx, sy - r, 1, r * 2 + 1, 'amarelo', 7);
        }
      },
      texto(ctx, X, Y, W, H, t, canal) {
        const partes = String(canal.texto || '').split('·').map(s => s.trim()).filter(Boolean);
        const produto = partes.length > 1 ? partes[0] : canal.nome, slogan = partes.length > 1 ? partes.slice(1).join(' ') : partes[0] || '';
        const big = K.measure(produto) * 2 <= W - 24;
        contorno(ctx, big ? produto : cortar(produto, W - 24), X + W / 2, Y + 12, cor('papel', 7), cor('vermelho', 1), {align: 'center', scale: big ? 2 : 1});
        if (slogan) {
          const pulo = Math.round(Math.abs(Math.sin(t * 3)) * 3), linhas = K.wrap(slogan, W - 28).slice(0, 2);
          linhas.forEach((l, i) => contorno(ctx, l, X + W / 2, Y + H - 18 - (linhas.length - 1 - i) * 11 - pulo, cor('amarelo', 6), cor('vermelho', 0), {align: 'center'}));
        }
      }
    },
    mensagem: {
      brilho: () => cor('vermelho', 3),
      fundo(g, w, h, t) {
        g.drawImage(U.art(`tv:mensagem:${w}:${h}`, w, h, b => {
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot((x - w / 2) / w, (y - h * .4) / h); b.px(x, y, 'vermelho', d < .16 ? 2 : d < .4 && K.bayer(x, y) < (.4 - d) * 4.5 ? 1 : 0); }
        }), 0, 0);
        // Um olho no céu que abre devagar e procura.
        const cx = Math.round(w / 2), cy = Math.round(h * .4), rx = Math.round(w * .24);
        const abre = clamp(.1 + .9 * (.5 + .5 * Math.sin(t * .55)), 0, 1), ry = Math.max(1, h * .15 * abre);
        for (let x = -rx; x <= rx; x++) {
          const u = x / rx, alto = Math.round(ry * (1 - u * u)), baixo = Math.round(ry * .8 * (1 - u * u));
          if (alto + baixo > 1) px(g, cx + x, cy - alto + 1, 1, alto + baixo - 1, 'vermelho', 1);
          px(g, cx + x, cy - alto, 1, 1, 'vermelho', 4); px(g, cx + x, cy + baixo, 1, 1, 'vermelho', 3);
          if (Math.abs(x) % 5 === 2 && Math.abs(u) < .8) px(g, cx + x + Math.sign(x), cy - alto - 2, 1, 2, 'vermelho', 3);
        }
        if (ry > 3) {
          const ir = Math.max(2, Math.min(Math.round(ry * .8), 7)), ox = Math.round(Math.sin(t * .9) * rx * .35);
          for (let y = -ir; y <= ir; y++) { const hw = Math.round(Math.sqrt(ir * ir - y * y)); px(g, cx + ox - hw, cy + y, hw * 2 + 1, 1, 'vermelho', Math.abs(y) > ir - 2 ? 3 : 5); }
          px(g, cx + ox, cy - ir + 1, 1, ir * 2 - 1, 'preto', 0); px(g, cx + ox - 1, cy - 2, 3, 5, 'preto', 0);
          px(g, cx + ox + 2, cy - ir + 2, 1, 1, 'fogo', 6);
        }
        const r = K.rng(Math.floor(t * 12) + 5);
        for (let i = 0; i < 26; i++) px(g, r() * w, r() * h, 1, 1, 'vermelho', 2 + Math.floor(r() * 2));
        // Rasgos de sinal.
        if ((t * 1.3) % 2 < .12) { const y = Math.floor(r() * (h - 10)), hh = 3 + Math.floor(r() * 8); g.drawImage(g.canvas, 0, y, w, hh, Math.round((r() - .5) * 14), y, w, hh); }
      },
      texto(ctx, X, Y, W, H, t, canal, st) {
        const msg = String(canal.texto || canal.nome), vistos = Math.floor((st?.desde ?? 99) * 14);
        const escala = K.wrap(msg, (W - 28) / 2).length <= 3 ? 2 : 1, linhas = quebra(msg, (W - 28) / escala, 6);
        const lh = escala === 2 ? 18 : 11, y0 = Math.round(Y + H * .74 - linhas.length * lh / 2);
        let resta = vistos;
        linhas.forEach((l, i) => {
          const parte = l.slice(0, Math.max(0, resta)); resta -= l.length + 1;
          if (!parte) return;
          const x = Math.round(X + W / 2 - K.measure(l) * escala / 2), tremor = Math.random() < .07 ? 2 : 0;
          if (tremor) escreve(ctx, parte, x - 2, y0 + i * lh, cor('vermelho', 5), {scale: escala});
          contorno(ctx, parte, x + tremor, y0 + i * lh, cor('papel', 7), cor('preto', 0), {scale: escala});
        });
        if (Math.floor(t * 2) % 2) escreve(ctx, 'SINAL INTERCEPTADO', X + 16, Y + 12, cor('vermelho', 5));
      }
    },
    futebol: {
      brilho: () => cor('folha', 4),
      fundo(g, w, h, t) {
        g.drawImage(U.art(`tv:futebol:${w}:${h}`, w, h, b => {
          b.rect(0, 0, w, 8, 'carvao', 2);
          const r = K.rng(33);
          for (let x = 0; x < w; x++) for (let y = 1; y < 7; y++) if (r() < .45) b.px(x, y, ['vermelho', 'azul', 'papel', 'amarelo', 'carvao'][Math.floor(r() * 5)], 2 + Math.floor(r() * 3));
          for (let x = 0; x < w; x++) b.vline(x, 8, h - 1, 'folha', Math.floor(x / 12) % 2 ? 3 : 4);
          const L = 4, T = 11, R = w - 5, B = h - 4, mx = Math.round(w / 2), my = Math.round((T + B) / 2);
          b.frame(L, T, R - L + 1, B - T + 1, 'papel', 6);
          b.vline(mx, T, B, 'papel', 6);
          for (let a = 0; a < 48; a++) { const u = a / 48 * Math.PI * 2; b.px(mx + Math.cos(u) * 11, my + Math.sin(u) * 11, 'papel', 6); }
          const aw = Math.round(w * .12), ah = Math.round((B - T) * .5);
          b.frame(L, my - ah / 2, aw, ah, 'papel', 6); b.frame(R - aw + 1, my - ah / 2, aw, ah, 'papel', 6);
          b.rect(L - 3, my - 5, 3, 10, 'papel', 7); b.rect(R + 1, my - 5, 3, 10, 'papel', 7);
        }), 0, 0);
        const T = 11, B = h - 4, bx = w / 2 + Math.sin(t * .37) * w * .34 + Math.sin(t * 1.3) * w * .05, by = (T + B) / 2 + Math.sin(t * .53 + 1) * (B - T) * .32;
        const time = (lado, rampa) => {
          const casa = [[.06, .5], [.2, .25], [.2, .75], [.22, .5], [.34, .15], [.36, .4], [.36, .6], [.34, .85], [.46, .35], [.46, .65]];
          casa.forEach(([ux, uy], i) => {
            const hx = lado > 0 ? ux * w : w - ux * w, hy = T + uy * (B - T);
            const k = i === 0 ? .05 : .28;
            const x = Math.round(hx + (bx - hx) * k + Math.sin(t * 1.7 + i * 1.3) * 2), y = Math.round(hy + (by - hy) * k + Math.cos(t * 1.3 + i) * 2);
            px(g, x, y + 3, 2, 1, 'folha', 2);
            px(g, x, y, 2, 3, i === 0 ? 'amarelo' : rampa, i === 0 ? 5 : 4); px(g, x, y + 2, 2, 1, i === 0 ? 'amarelo' : rampa, 2);
          });
        };
        time(1, 'vermelho'); time(-1, 'azul');
        px(g, bx + 1, by + 2, 1, 1, 'folha', 2); px(g, bx, by, 2, 2, 'papel', 7);
      },
      texto(ctx, X, Y, W, H, t, canal) {
        const p = parsePlacar(canal.texto), a = iniciais(p.casa) || 'CAS', b = iniciais(p.fora) || 'VIS';
        const min = 30 + Math.floor(t / 4) % 60, seg = Math.floor(t * 15) % 60;
        const txt = `${a} ${p.golsCasa} x ${p.golsFora} ${b}`, w = K.measure(txt) + 62;
        ret(ctx, X + 8, Y + 22, w, 15, 'preto', 1); ret(ctx, X + 8, Y + 22, w, 1, 'carvao', 4);
        ret(ctx, X + 12, Y + 26, 4, 7, 'vermelho', 4);
        escreve(ctx, txt, X + 20, Y + 26, cor('papel', 7));
        ret(ctx, X + 22 + K.measure(txt), Y + 26, 4, 7, 'azul', 4);
        escreve(ctx, `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`, X + w - 2, Y + 26, cor('amarelo', 5), {align: 'right'});
      }
    }
  };

  /* ---- interface */
  Tipos.register('tv', {
    label: 'TV', icon: 'tv', sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'estilo', label: 'Aparelho', kind: 'select', options: [['tubo', 'TV de tubo (madeira e botões)'], ['plana', 'TV de tela plana (com controle remoto)']]},
      {id: 'canais', label: 'Canais: NOME | tipo | texto, um por linha. Tipos: noticias, chuvisco, desenho, novela, propaganda, mensagem, futebol (novela: falas separadas por /; futebol: CASA 2 x 1 FORA)', kind: 'textarea', rows: 8},
      {id: 'marca', label: 'Marca na moldura', kind: 'text', placeholder: 'ex.: VISORAMA'}],
    defaults: {...TV_PADRAO},
    create(clue, sys) {
      const mem = memoriaDe(sys, clue), canais = canaisDe(clue);
      mem.canal = clamp(inteiro(mem.canal, 0), 0, canais.length - 1);
      mem.volume = clamp(inteiro(mem.volume, 6), 0, 10);
      const liga = estadoCena(sys, mem, clue.objeto ? `${clue.objeto}.ligada` : null, 'ligada', true);
      return {mem, liga, t: 0, troca: 0, osd: 2.2, volOsd: 0, anim: null, desde: 0, aperto: null, semLuz: 0, estavaLigada: liga.get()};
    },
    describe(st) {
      return {ligada: !!st.liga?.valor, canal: st.mem?.canal ?? 0, volume: st.mem?.volume ?? 0, trocando: st.troca > 0, semEnergia: st.semLuz > 0};
    },
    ligar(st, clue, sys, on) {
      // Sem energia o botão não faz nada: só o aviso.
      if (!temEnergia(sys)) { st.semLuz = 1.6; som(sys, 'erro'); return; }
      st.liga.set(on);
      st.anim = {tipo: on ? 'liga' : 'desliga', t: 0};
      if (on) { st.osd = 2.4; st.desde = 0; som(sys, 'tv_liga'); } else som(sys, 'desligar');
      salvar(sys);
    },
    trocar(st, clue, sys, canal) {
      const canais = canaisDe(clue), n = canais.length;
      if (!st.liga.get() || !temEnergia(sys)) { if (!temEnergia(sys)) st.semLuz = 1.6; return; }
      st.mem.canal = ((canal % n) + n) % n;
      st.troca = .22; st.osd = 2.4; st.desde = -.22;
      som(sys, 'tv_canal');
      if (canais[st.mem.canal].tipo === 'chuvisco') som(sys, 'estatica');
      if (canais[st.mem.canal].tipo === 'mensagem') som(sys, 'glitch');
      salvar(sys);
    },
    volume(st, sys, delta) {
      if (!st.liga.get() || !temEnergia(sys)) return;
      st.mem.volume = clamp(st.mem.volume + delta, 0, 10); st.volOsd = 1.6; som(sys, 'beep'); salvar(sys);
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = clamp(ui.dt || 0, 0, .1), estilo = chaveDe(d.estilo) === 'plana' ? 'plana' : 'tubo', L = TV_LAYOUT[estilo];
      const canais = canaisDe(clue), marca = campo(d.marca, TV_PADRAO.marca).slice(0, 14);
      st.t += dt; st.desde += dt; st.troca = Math.max(0, st.troca - dt); st.osd = Math.max(0, st.osd - dt); st.volOsd = Math.max(0, st.volOsd - dt); st.semLuz = Math.max(0, st.semLuz - dt);
      passarAperto(st, dt);
      st.mem.canal = clamp(inteiro(st.mem.canal, 0), 0, canais.length - 1);
      const energia = temEnergia(sys), querLigada = st.liga.get(dt), ligada = querLigada && energia;
      if (st.anim) { st.anim.t += dt; if (st.anim.t > .5) st.anim = null; }
      const canal = canais[st.mem.canal], tipo = CANAIS[canal.tipo] ? canal.tipo : 'mensagem', def = CANAIS[tipo];
      const {x: X, y: Y, w: W, h: H} = L.tela, [rw, rh] = L.res;
      U.blit(ctx, estilo === 'plana' ? tvParedePlana() : tvParedeTubo(), 0, 22);
      if (ligada) brilho(ctx, X, Y, W, H, st.troca > 0 ? cor('palido', 5) : def.brilho(), st.anim?.tipo === 'liga' ? st.anim.t * 2 : 1);
      ui.region('tv', ...L.corpo, {cursor: 'default', silent: true});
      // Tela.
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
      const desligando = st.anim?.tipo === 'desliga';
      if (ligada || desligando) {
        const s = superficie('tv:tela:' + estilo, rw, rh), mostrar = st.troca > 0 ? CANAIS.chuvisco : def;
        mostrar.fundo(s.g, rw, rh, st.t, canal, st);
        ampliar(ctx, s, X, Y);
        if (st.troca <= 0) mostrar.texto(ctx, X, Y, W, H, st.t, canal, st);
        if (st.osd > 0 && !desligando) {
          const num = String(st.mem.canal + 1).padStart(2, '0');
          if (estilo === 'tubo') { contorno(ctx, num, X + 14, Y + 12, cor('fosforo', 5), cor('preto', 0), {scale: 2}); contorno(ctx, canal.nome, X + 14, Y + 30, cor('fosforo', 5), cor('preto', 0)); }
          else { U.rect(ctx, X + W - 118, Y + 12, 106, 26, 'rgba(8,10,24,.72)'); escreve(ctx, num, X + W - 110, Y + 18, cor('papel', 7), {scale: 2}); escreve(ctx, cortar(canal.nome, 66), X + W - 84, Y + 21, cor('ceu', 6)); }
        }
        if (st.volOsd > 0) {
          const bx = X + W / 2 - 64, by = Y + H - 62;
          U.rect(ctx, bx - 6, by - 4, 140, 22, 'rgba(4,6,14,.7)');
          escreve(ctx, 'VOLUME', bx, by + 3, cor(estilo === 'tubo' ? 'fosforo' : 'papel', estilo === 'tubo' ? 5 : 7));
          for (let i = 0; i < 10; i++) U.rect(ctx, bx + 44 + i * 8, by + 1, 6, 12, i < st.mem.volume ? cor(estilo === 'tubo' ? 'fosforo' : 'agua', 5) : 'rgba(255,255,255,.12)');
        }
        if (st.anim) {
          const u = st.anim.t / .5;
          if (st.anim.tipo === 'liga') {
            const hh = Math.max(2, snap(H * ease((u - .25) / .75))), ww = snap(W * ease(u * 3));
            ctx.fillStyle = cor('preto', 0);
            ctx.fillRect(X, Y, W, (H - hh) / 2); ctx.fillRect(X, Y + (H + hh) / 2, W, (H - hh) / 2 + 1);
            if (u < .5) { ctx.fillRect(X, Y, (W - ww) / 2, H); ctx.fillRect(X + (W + ww) / 2, Y, (W - ww) / 2 + 1, H); U.rect(ctx, X + (W - ww) / 2, Y + H / 2 - 1, ww, 2, '#f4f8ff'); }
          } else {
            ret(ctx, X, Y, W, H, 'preto', 0);
            const hh = Math.max(2, snap(H * (1 - ease(u * 2.4)))), ww = u < .42 ? W : Math.max(2, snap(W * (1 - ease((u - .42) * 1.9))));
            if (u < .92) U.rect(ctx, X + (W - ww) / 2, Y + (H - hh) / 2, ww, hh, u < .42 ? cor('palido', 6) : '#f4f8ff');
          }
        }
        if (estilo === 'tubo') vidro(ctx, X, Y, W, H, {linhas: .2, reflexo: .05, vinheta: 1.3});
        else vidro(ctx, X, Y, W, H, {linhas: 0, reflexo: .035, vinheta: 0});
      } else {
        telaApagada(ctx, X, Y, W, H, estilo === 'tubo' ? 'preto' : 'preto');
        if (!energia || st.semLuz > 0) caixaAviso(ctx, X + W / 2, Y + H / 2, 'SEM ENERGIA', 'a tomada está sem força', {tremor: st.semLuz > 1.3 ? (Math.floor(st.t * 40) % 2 ? 3 : -3) : 0});
      }
      ctx.restore();
      // Corpo do aparelho e controles.
      if (estilo === 'tubo') {
        U.blit(ctx, tvCorpoTubo(marca), 0, 22);
        const n = Math.max(1, canais.length - 1), a = -2.36 + (st.mem.canal / n) * 4.71 - Math.PI / 2;
        for (let r = 4; r < 16; r += 2) U.rect(ctx, snap(360 + Math.cos(a) * r), snap(144 + Math.sin(a) * r), 2, 2, cor('papel', 7));
        const va = -2.36 + st.mem.volume / 10 * 4.71 - Math.PI / 2;
        for (let r = 2; r < 11; r += 2) U.rect(ctx, snap(360 + Math.cos(va) * r), snap(194 + Math.sin(va) * r), 2, 2, cor('papel', 6));
        const hMenos = ui.region('canal-', 330, 118, 30, 50), hMais = ui.region('canal+', 360, 118, 32, 50);
        const vMenos = ui.region('vol-', 336, 176, 24, 34), vMais = ui.region('vol+', 360, 176, 24, 34);
        const quente = id => ui.hover === id || apertado(st, id);
        triangulo(ctx, 328, 144, 'esq', 4, quente('canal-') ? '#ffd18c' : cor('preto', 2));
        triangulo(ctx, 392, 144, 'dir', 4, quente('canal+') ? '#ffd18c' : cor('preto', 2));
        if (hMenos || hMais) U.outline(ctx, 338, 122, 44, 44, '#ffd18c', 2);
        if (vMenos || vMais || apertado(st, 'vol-') || apertado(st, 'vol+')) {
          triangulo(ctx, 340, 194, 'esq', 3, quente('vol-') ? '#ffd18c' : cor('preto', 2));
          triangulo(ctx, 380, 194, 'dir', 3, quente('vol+') ? '#ffd18c' : cor('preto', 2));
        }
        const hLiga = ui.region('liga', 316, 210, 52, 22), baixo = apertado(st, 'liga');
        if (baixo) U.rect(ctx, 320, 212, 44, 16, 'rgba(20,10,20,.35)');
        if (hLiga) U.outline(ctx, 318, 212, 48, 20, '#ffd18c', 2);
        U.rect(ctx, 382, 218, 10, 8, ligada ? cor('vermelho', 6) : querLigada ? cor('vermelho', 2) : cor('preto', 2));
        if (ligada) { U.rect(ctx, 384, 218, 4, 2, '#fff2e8'); U.rect(ctx, 376, 214, 22, 16, 'rgba(255,90,60,.12)'); }
      } else {
        U.blit(ctx, tvCorpoPlana(marca), 0, 22);
        U.rect(ctx, 356, 230, 4, 2, ligada ? cor('agua', 6) : cor('vermelho', querLigada ? 3 : 4));
        const RX = 392, RY = 74;
        for (const [id, dado, bx, by, bw, bh, rot] of REMOTO) {
          const x = RX + bx * 2, y = RY + by * 2, w = bw * 2, h = bh * 2;
          const quente = ui.region(id, x, y, w, h, {data: dado}), baixo = apertado(st, id, dado) || (quente && ui.mouse.down) ? 2 : 0;
          const rampa = id === 'liga' ? 'vermelho' : 'carvao', base = id === 'liga' ? 3 : 4;
          U.rect(ctx, x, y + 2, w, h, cor('preto', 0));
          U.rect(ctx, x, y + baixo, w, h, cor(rampa, quente ? base + 1 : base));
          if (!baixo) U.rect(ctx, x, y, w, 2, cor(rampa, base + 2));
          const tx = x + w / 2, ty = y + baixo + h / 2;
          if (rot) escreve(ctx, rot, tx, ty - 3, cor('papel', 7), {align: 'center'});
          else if (id === 'liga') { U.outline(ctx, tx - 4, ty - 3, 8, 8, cor('papel', 7), 2); U.rect(ctx, tx - 2, ty - 5, 4, 4, cor(rampa, quente ? base + 1 : base)); U.rect(ctx, tx - 1, ty - 5, 2, 5, cor('papel', 7)); }
          else if (id === 'mudo') { U.rect(ctx, tx - 5, ty - 2, 4, 4, cor('papel', 6)); triangulo(ctx, tx + 1, ty, 'esq', 3, cor('papel', 6)); }
          else triangulo(ctx, tx, ty + (id === 'canal+' ? 2 : -1), id === 'canal+' ? 'cima' : 'baixo', 3, cor('papel', 7));
        }
        escreve(ctx, 'CH', RX + 16, RY + 146, cor('carvao', 6), {align: 'center'});
        escreve(ctx, 'VOL', RX + 56, RY + 146, cor('carvao', 6), {align: 'center'});
      }
      const dica = !energia ? 'sem energia na sala' : !querLigada ? 'aperte LIGA' : `canal ${st.mem.canal + 1} de ${canais.length} · setas trocam`;
      U.header(ctx, ui, clue.name, dica, 'tv');
    },
    action(id, st, clue, sys, info) {
      apertar(st, id, info?.data ?? null);
      if (id === 'liga') this.ligar(st, clue, sys, !st.liga.get());
      else if (id === 'canal+') this.trocar(st, clue, sys, st.mem.canal + 1);
      else if (id === 'canal-') this.trocar(st, clue, sys, st.mem.canal - 1);
      else if (id === 'num') this.trocar(st, clue, sys, Number(info?.data || 1) - 1);
      else if (id === 'vol+') this.volume(st, sys, 1);
      else if (id === 'vol-') this.volume(st, sys, -1);
      else if (id === 'mudo') { st.mem.volume = st.mem.volume ? 0 : 6; st.volOsd = 1.6; salvar(sys); }
    },
    wheel(delta, st, clue, sys) { this.trocar(st, clue, sys, st.mem.canal + (delta > 0 ? 1 : -1)); },
    key(e, st, clue, sys) {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowRight' || k === 'PageUp') { apertar(st, 'canal+'); this.trocar(st, clue, sys, st.mem.canal + 1); return true; }
      if (k === 'ArrowDown' || k === 'ArrowLeft' || k === 'PageDown') { apertar(st, 'canal-'); this.trocar(st, clue, sys, st.mem.canal - 1); return true; }
      if (/^[0-9]$/.test(k || '')) { this.trocar(st, clue, sys, (k === '0' ? 10 : Number(k)) - 1); return true; }
      if (k === '+' || k === '=') { this.volume(st, sys, 1); return true; }
      if (k === '-' || k === '_') { this.volume(st, sys, -1); return true; }
      if (k === 'Enter' || k === ' ') { apertar(st, 'liga'); this.ligar(st, clue, sys, !st.liga.get()); return true; }
      return false;
    }
  });

  /* ================================================================ telefone */
  const FONE_PADRAO = {
    estilo: 'mesa', numero: '3217-0317', custo: '',
    contatos: [
      '3217-1987 | Dona Cida | Ah, é você? Não liga mais pra cá. Eles escutam a linha. Olha pela janela e me diz: o céu ainda está vermelho?',
      '190 | Polícia | Polícia, qual a sua emergência? … Alô? A linha está cheia de chiado. Se estiver no bairro alto, fique dentro de casa.',
      '0800-555-0100 | Rádio Táxi | Rádio Táxi Estrela, boa noite. Nenhum carro sobe o morro depois das dez. Ordem da prefeitura.'
    ].join('\n'),
    semResposta: 'Chama, chama… ninguém atende.',
    recado: 'Não desliga. Eu sei onde vocês estão. Não subam para o terraço, não importa o que ouvirem lá em cima.'
  };
  const LETRAS_TECLA = {'1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': ''};
  const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  /* Posições em pixels de tela de cada aparelho. */
  const FONE_LAYOUT = {
    mesa: {corpo: [80, 70], visor: [140, 138, 128, 20], teclas: [140, 170, 36, 14, 46, 18], ligar: [282, 170, 34, 24], desligar: [282, 202, 34, 24],
      led: [108, 226], cartao: [156, 242, 96, 10], gancho: [92, 72, 224, 40], solto: [6, 102], notas: [352, 56], area: [60, 60, 280, 210]},
    parede: {corpo: [120, 50], visor: [164, 66, 80, 20], teclas: [160, 102, 26, 18, 32, 24], ligar: [160, 202, 38, 20], desligar: [206, 202, 38, 20],
      led: [228, 60], cartao: [164, 230, 80, 12], gancho: [118, 54, 34, 190], solto: [14, 120], notas: [312, 48], area: [100, 40, 190, 230]},
    orelhao: {corpo: [128, 58], visor: [144, 70, 76, 20], teclas: [144, 102, 24, 16, 30, 22], ligar: [144, 196, 36, 20], desligar: [188, 196, 36, 20],
      led: [216, 62], cartao: [144, 226, 88, 10], gancho: [98, 66, 30, 150], solto: [4, 136], moeda: [230, 64, 18, 40], devolver: [230, 194, 20, 34],
      notas: [372, 56], area: [24, 30, 340, 240]}
  };

  /* ---- arte */
  function foneFundo(estilo) {
    return U.art('fone:fundo:' + estilo, 240, 124, b => {
      if (estilo === 'mesa') {
        for (let y = 0; y < 124; y++) {
          const tabua = Math.floor(y / 15), junta = y % 15 === 14;
          for (let x = 0; x < 240; x++) {
            if (junta) { b.px(x, y, 'mogno', 1); continue; }
            const n = Math.sin(x / (8 + tabua * 1.3) + tabua * 2.1 + Math.sin(x / 21 + tabua) * 1.6) + K.hash2(x >> 2, y, tabua) * .5;
            b.px(x, y, 'mogno', n > 1.1 ? 4 : n < -1.05 ? 2 : 3);
          }
        }
        b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 190) / 190, (y + 10) / 130); return d < 1 ? (1 - d) * 1.4 - .2 : -.2 - (d - 1) * 2.2; });
        // Sombra do aparelho para baixo e para a esquerda.
        b.shadeFn(30, 30, 136, 94, (x, y) => (x > 34 && x < 162 && y > 36 && y < 124 && (y - 36) * .12 + 34 < x ? -1.6 : 0));
      } else if (estilo === 'parede') {
        for (let y = 0; y < 124; y++) for (let x = 0; x < 240; x++) {
          const gx = x % 12, gy = y % 12, junta = gx === 0 || gy === 0;
          b.px(x, y, 'agua', junta ? 3 : (gx === 11 || gy === 1) ? 5 : 4);
        }
        b.rect(0, 112, 240, 12, 'madeira', 3); b.hline(0, 239, 112, 'madeira', 5); b.hline(0, 239, 113, 'madeira', 4);
        b.shadeFn(0, 0, 240, 112, (x, y) => { const d = Math.hypot((x - 200) / 220, (y + 20) / 150); return d < 1 ? (1 - d) * 1.2 - .6 : -.6 - (d - 1) * 2; });
        b.shadeFn(52, 20, 90, 104, (x, y) => (x > 56 && x < 140 && y > 20 && y < 120 ? -1.3 : 0));
        // Quadro de cortiça para o bloco de recados.
        b.bevel(150, 18, 86, 90, 'madeira', 3, 5, 1); b.rect(153, 21, 80, 84, 'madeira', 4);
        const r = K.rng(8); for (let i = 0; i < 700; i++) b.px(153 + Math.floor(r() * 80), 21 + Math.floor(r() * 84), 'madeira', 3 + Math.floor(r() * 3));
      } else {
        // Rua de noite: muro, cartaz rasgado, calçada e a luz do poste vindo da direita.
        for (let y = 0; y < 106; y++) for (let x = 0; x < 240; x++) {
          const bloco = (Math.floor(y / 8) % 2 ? x + 10 : x) % 20, junta = y % 8 === 7 || bloco === 0;
          b.px(x, y, 'concreto', junta ? 1 : 2 + (K.hash2(x >> 2, y >> 2, 4) > .8 ? 1 : 0));
        }
        b.rect(190, 60, 34, 40, 'papel', 4); b.rect(192, 62, 30, 12, 'vermelho', 3); b.text(207, 65, 'SHOW', 'papel', 7, {font: '3x5', align: 'center'});
        for (let i = 0; i < 5; i++) b.hline(194, 218 - i * 3, 78 + i * 4, 'tinta', 3);
        for (let x = 190; x < 224; x += 3) b.erase(x, 99 - (x % 7 === 0 ? 3 : 1), 2, 3);
        b.rect(0, 106, 240, 18, 'concreto', 3); b.hline(0, 239, 106, 'concreto', 5); for (let x = 0; x < 240; x += 26) b.vline(x, 107, 123, 'concreto', 2);
        b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 250) / 170, (y + 10) / 120); return d < 1 ? (1 - d) * 2.4 - 1.2 : -1.2 - (d - 1) * 1.5; });
      }
    });
  }
  function foneCorpo(estilo) {
    return U.art('fone:corpo:' + estilo, estilo === 'mesa' ? 124 : estilo === 'parede' ? 76 : 240, estilo === 'mesa' ? 96 : estilo === 'parede' ? 104 : 124, b => {
      if (estilo === 'mesa') {
        // Deque de cima com o berço do fone.
        b.rect(8, 4, 108, 28, 'papel', 5); b.hline(9, 114, 4, 'papel', 7); b.vline(115, 5, 31, 'papel', 6); b.vline(8, 5, 31, 'papel', 3);
        for (const x of [14, 92]) { b.bevel(x, 8, 18, 14, 'papel', 4, 6, 2); b.rect(x + 6, 12, 6, 6, 'papel', 2); }
        // Frente inclinada.
        b.poly([[4, 30], [120, 30], [124, 92], [0, 92]], 'papel', 4);
        b.hline(4, 119, 30, 'papel', 6); b.line(120, 30, 123, 91, 'papel', 5); b.line(4, 30, 1, 91, 'papel', 3);
        b.shadeFn(0, 30, 124, 62, (x, y) => (y - 30) / 62 * -.9);
        b.rect(0, 92, 124, 4, 'papel', 2); b.hline(1, 122, 92, 'papel', 3);
        b.inset(28, 32, 68, 14, 'papel', 3, 5, 1);                       // moldura do visor
        for (let y = 50; y < 72; y += 3) for (let x = 8; x < 24; x += 3) b.px(x, y, 'papel', 2);
        b.text(16, 82, 'EM USO', 'papel', 2, {font: '3x5', align: 'center'});
        b.inset(36, 85, 52, 7, 'papel', 5, 7, 3);                       // cartão do número
      } else if (estilo === 'parede') {
        b.rect(12, 0, 62, 102, 'amarelo', 3);
        b.hline(13, 72, 0, 'amarelo', 5); b.vline(73, 1, 101, 'amarelo', 4); b.vline(12, 1, 101, 'amarelo', 2); b.hline(13, 72, 101, 'amarelo', 1);
        for (const [x, y] of [[12, 0], [73, 0], [12, 101], [73, 101]]) b.erase(x, y, 1, 1);
        b.rect(4, 6, 10, 90, 'amarelo', 2); b.rect(6, 8, 6, 3, 'amarelo', 4);  // canaleta do gancho
        b.inset(20, 6, 46, 16, 'amarelo', 2, 4, 1);
        b.inset(22, 89, 42, 9, 'papel', 5, 7, 3);
        for (let x = 26; x < 62; x += 3) b.vline(x, 1, 3, 'amarelo', 2);
      } else {
        // Concha do orelhão: casca laranja, o oco escuro, o poste.
        const cx = 96, cy = 60;
        for (let y = 0; y < 124; y++) for (let x = 0; x < 200; x++) {
          const dOut = Math.hypot((x + .5 - cx) / 84, (y + .5 - cy) / 74), dIn = Math.hypot((x + .5 - cx) / 74, (y + .5 - cy) / 65);
          if (y > 110) continue;
          if (dIn < 1) { const luz = clamp((x - cx) / 90 - (y - cy) / 120, -1, 1); b.px(x, y, 'carvao', Math.max(0, Math.floor(1.6 + luz * 1.2 + K.bayer(x, y) - .5))); }
          else if (dOut < 1) { const ang = Math.atan2(y - cy, x - cx), luz = Math.cos(ang + Math.PI / 4); b.px(x, y, 'fogo', clamp(Math.round(3.4 + luz * 1.3), 2, 5)); }
        }

        b.rect(88, 112, 16, 12, 'metal', 2); b.vline(103, 112, 123, 'metal', 4);
        b.rect(66, 3, 60, 8, 'azul', 3); b.hline(66, 125, 3, 'azul', 5); b.text(96, 5, 'TELEFONE PUBLICO', 'papel', 7, {font: '3x5', align: 'center'});
        // Caixa do aparelho.
        const X = 64, Y = 18;
        b.rect(X + 2, Y + 2, 64, 92, 'carvao', 0);
        b.bevel(X, Y, 64, 92, 'azul', 3, 5, 1);
        b.inset(X + 6, Y + 4, 42, 14, 'azul', 1, 4, 0);                  // visor
        b.bevel(X + 50, Y + 3, 10, 20, 'metal', 4, 6, 2); b.rect(X + 54, Y + 6, 2, 14, 'preto', 0); b.ellipse(X + 55, Y + 27, 3, 3, 'latao', 4); b.px(X + 56, Y + 26, 'latao', 6);
        b.inset(X + 5, Y + 20, 46, 46, 'metal', 3, 5, 1);                // placa do teclado
        b.inset(X + 50, Y + 66, 11, 18, 'preto', 1, 3, 0);               // devolução
        b.inset(X + 6, Y + 82, 42, 7, 'papel', 5, 7, 3);
        // Adesivo.
        b.rect(X + 50, Y + 34, 12, 14, 'amarelo', 5); b.text(X + 56, Y + 36, '190', 'vermelho', 3, {font: '3x5', align: 'center'}); b.hline(X + 51, X + 60, Y + 43, 'vermelho', 3);
      }
    });
  }
  /* Fone no gancho (horizontal na mesa, vertical nos outros) e fora dele (inclinado). */
  function foneMonofone(tipo) {
    if (tipo === 'deitado') return U.art('fone:monofone:deitado', 112, 20, b => {
      b.ellipse(12, 10, 11, 8, 'papel', 4); b.ellipse(99, 10, 11, 8, 'papel', 4);
      b.rect(12, 4, 88, 9, 'papel', 5); b.hline(12, 99, 4, 'papel', 7); b.hline(12, 99, 12, 'papel', 3);
      b.ellipse(12, 9, 9, 6, 'papel', 5); b.ellipse(99, 9, 9, 6, 'papel', 5); b.ellipse(13, 7, 5, 3, 'papel', 6); b.ellipse(100, 7, 5, 3, 'papel', 6);
      b.hline(4, 20, 17, 'papel', 2); b.hline(91, 107, 17, 'papel', 2);
    });
    if (tipo === 'pe') return U.art('fone:monofone:pe', 16, 96, b => {
      b.ellipse(8, 10, 7.5, 10, 'amarelo', 3); b.ellipse(8, 85, 7.5, 10, 'amarelo', 3);
      b.rect(3, 10, 9, 76, 'amarelo', 4); b.vline(11, 10, 85, 'amarelo', 5); b.vline(3, 10, 85, 'amarelo', 2);
      b.ellipse(9, 8, 4, 6, 'amarelo', 5); b.ellipse(9, 83, 4, 6, 'amarelo', 5);
    });
    if (tipo === 'publico') return U.art('fone:monofone:publico', 14, 78, b => {
      b.ellipse(7, 9, 6.5, 9, 'preto', 2); b.ellipse(7, 69, 6.5, 9, 'preto', 2);
      b.rect(3, 8, 8, 62, 'preto', 3); b.vline(10, 8, 69, 'preto', 4); b.vline(3, 8, 69, 'preto', 1);
      b.ellipse(8, 7, 3, 5, 'preto', 4); b.ellipse(8, 67, 3, 5, 'preto', 4);
    });
    return U.art('fone:monofone:solto:' + tipo, 60, 40, b => {
      const rampa = tipo === 'parede' ? 'amarelo' : tipo === 'orelhao' ? 'preto' : 'papel', base = tipo === 'orelhao' ? 3 : 4;
      for (let i = 0; i < 44; i++) { const x = 10 + i, y = 30 - i * .5; b.rect(x, y - 3, 1, 7, rampa, base); b.px(x, y - 3, rampa, base + 2); b.px(x, y + 3, rampa, base - 2); }
      b.ellipse(9, 30, 8, 7, rampa, base); b.ellipse(10, 28, 4, 3, rampa, base + 1);
      b.ellipse(52, 9, 8, 7, rampa, base); b.ellipse(53, 7, 4, 3, rampa, base + 1);
    });
  }
  /* Fio espiralado entre dois pontos (em pixels de tela). */
  function fioEspiral(ctx, x0, y0, x1, y1, rampa, nivel, {voltas = 14, raio = 4, t = 0, balanco = 0} = {}) {
    const n = Math.max(12, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let i = 0; i <= n; i++) {
      const u = i / n, cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * (18 + balanco * Math.sin(t * 6));
      const a = u * voltas * Math.PI * 2, ox = Math.cos(a) * raio, oy = Math.sin(a) * raio * .5;
      U.rect(ctx, snap(cx + ox), snap(cy + oy), 2, 2, cor(rampa, Math.sin(a) > 0 ? nivel + 1 : nivel - 1));
    }
  }

  /* ---- regras da ligação */
  const custoDe = clue => inteiro(clue.data?.custo, chaveDe(clue.data?.estilo) === 'orelhao' ? 1 : 0, 0, 20);
  function registrarChamada(st, sys, entrada) {
    const lista = Array.isArray(st.mem.recentes) ? st.mem.recentes : [];
    lista.unshift(entrada);
    st.mem.recentes = lista.slice(0, 6);
    salvar(sys);
  }

  Tipos.register('telefone', {
    label: 'Telefone', icon: 'telefone', sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'estilo', label: 'Aparelho', kind: 'select', options: [['mesa', 'Telefone de mesa'], ['parede', 'Telefone de parede'], ['orelhao', 'Orelhão (cobra moedas)']]},
      {id: 'numero', label: 'Número deste aparelho', kind: 'text'},
      {id: 'contatos', label: 'Contatos: NÚMERO | mensagem de quem atende (ou NÚMERO | Nome | mensagem), um por linha; com ou sem traço', kind: 'textarea', rows: 6},
      {id: 'semResposta', label: 'Número desconhecido: o que acontece (vazio = sinal de ocupado)', kind: 'text'},
      {id: 'custo', label: 'Moedas por ligação (vazio = 1 no orelhão, 0 nos outros)', kind: 'text'},
      {id: 'recado', label: 'Quando o telefone está tocando: o que dizem ao atender', kind: 'textarea'}],
    defaults: {...FONE_PADRAO},
    create(clue, sys) {
      const mem = memoriaDe(sys, clue);
      if (!Array.isArray(mem.recentes)) mem.recentes = [];
      const st = {mem, fase: mem.tocando ? 'tocando' : 'gancho', t: 0, faseT: 0, digitos: '', credito: 0, chamada: null, legenda: null, aperto: null, piscaVisor: 0, toque: 0, semBolsaAvisado: false};
      if (st.fase === 'tocando') { st.toque = 0; som(sys, 'telefone'); }
      return st;
    },
    wantsKeys: () => true,
    describe(st) { return {fase: st.fase, digitos: st.digitos, credito: st.credito, chamada: st.chamada ? {numero: st.chamada.numero, nome: st.chamada.nome, resultado: st.chamada.resultado} : null, legenda: st.legenda ? st.legenda.texto.slice(0, Math.floor(st.legenda.vistos)) : ''}; },
    ir(st, fase) { st.fase = fase; st.faseT = 0; },
    tirarDoGancho(st, sys) { if (st.fase === 'gancho') { this.ir(st, 'linha'); som(sys, 'fone'); } },
    desligar(st, clue, sys) {
      if (st.fase === 'gancho') return;
      if (st.credito > 0) {
        const n = st.credito; st.credito = 0;
        if (darItem(sys, 'moedas', n)) { som(sys, 'moeda'); avisar(sys, 'MOEDAS DEVOLVIDAS', `${n} ${n === 1 ? 'moeda voltou' : 'moedas voltaram'} para a bolsa`, 'moeda'); }
      }
      st.digitos = ''; st.chamada = null; st.legenda = null;
      this.ir(st, st.mem.tocando ? 'tocando' : 'gancho');
      som(sys, 'fone');
    },
    digitar(st, clue, sys, tecla) {
      if (!['gancho', 'linha'].includes(st.fase)) return;
      this.tirarDoGancho(st, sys);
      if (st.digitos.length < 15) st.digitos += tecla;
      apertar(st, 'tecla', tecla);
      som(sys, 'tecla');
    },
    ligar(st, clue, sys) {
      if (st.fase === 'tocando') { this.atender(st, clue, sys); return; }
      if (st.fase === 'gancho') { if (!st.digitos) { this.tirarDoGancho(st, sys); return; } this.tirarDoGancho(st, sys); }
      if (st.fase !== 'linha') return;
      const d = clue.data || {}, numero = normalizarNumero(st.digitos);
      if (!numero) { st.piscaVisor = 1; som(sys, 'erro'); return; }
      const custo = custoDe(clue);
      if (custo > 0 && temBolsa(sys) && st.credito < custo) { st.piscaVisor = 1.2; som(sys, 'erro'); return; }
      if (custo > 0 && !temBolsa(sys) && !st.semBolsaAvisado) { st.semBolsaAvisado = true; avisar(sys, 'LIGAÇÃO GRÁTIS', 'sem bolsa: o orelhão não cobra', 'telefone'); }
      const contato = acharContato(parseContatos(campo(d.contatos, FONE_PADRAO.contatos)), numero);
      const proprio = mesmoNumero(numero, campo(d.numero, FONE_PADRAO.numero));
      const semResposta = typeof d.semResposta === 'string' ? d.semResposta.trim() : FONE_PADRAO.semResposta;
      const resultado = contato ? 'atendeu' : proprio ? 'ocupado' : numero.length < 3 ? 'invalido' : semResposta ? 'sem resposta' : 'ocupado';
      st.chamada = {numero, nome: contato?.nome || '', mensagem: contato?.mensagem || '', resultado, toques: contato ? 2 : resultado === 'sem resposta' ? 4 : 0, custo};
      registrarChamada(st, sys, {numero: formatarNumero(numero), dir: 'saida', resultado: resultado === 'atendeu' ? 'atendida' : resultado, nome: contato?.nome || ''});
      this.ir(st, 'discando');
      som(sys, 'discagem');
    },
    atender(st, clue, sys) {
      if (st.fase !== 'tocando') return;
      const recado = campo(clue.data?.recado, FONE_PADRAO.recado);
      st.mem.tocando = false;
      registrarChamada(st, sys, {numero: 'desconhecido', dir: 'entrada', resultado: 'atendida', nome: ''});
      st.chamada = {numero: '', nome: '', mensagem: recado, resultado: 'recado', toques: 0, custo: 0};
      st.legenda = {nome: 'VOZ NA LINHA', texto: recado, vistos: 0, fim: 0};
      this.ir(st, 'conversa');
      som(sys, 'fone');
      salvar(sys);
    },
    colocarMoeda(st, clue, sys) {
      apertar(st, 'moeda');
      if (!temBolsa(sys)) { st.credito++; som(sys, 'moeda'); if (!st.semBolsaAvisado) { st.semBolsaAvisado = true; avisar(sys, 'MODO PRÉVIA', 'sem bolsa: a moeda é de mentira', 'moeda'); } return; }
      if (gastarItem(sys, 'moedas', 1)) { st.credito++; st.moedaCaindo = .35; som(sys, 'moeda'); }
      else { som(sys, 'erro'); avisar(sys, 'SEM MOEDAS', 'não há moedas na bolsa', 'moeda'); }
    },
    passo(st, clue, sys, dt) {
      st.t += dt; st.faseT += dt; st.piscaVisor = Math.max(0, st.piscaVisor - dt); st.moedaCaindo = Math.max(0, (st.moedaCaindo || 0) - dt);
      passarAperto(st, dt);
      const c = st.chamada;
      if (st.fase === 'discando' && st.faseT > .25 + (c?.numero.length || 0) * .09) {
        if (c.resultado === 'invalido') { st.legenda = {nome: 'GRAVAÇÃO', texto: 'O número discado não existe. Verifique e disque novamente.', vistos: 0, fim: 0, narrador: true}; this.ir(st, 'invalido'); som(sys, 'beep'); }
        else if (c.resultado === 'ocupado') { this.ir(st, 'ocupado'); som(sys, 'ocupado'); }
        else { this.ir(st, 'chamando'); st.toque = 0; som(sys, 'chamando'); }
      }
      if (st.fase === 'chamando') {
        if (Math.floor(st.faseT / 2.2) > st.toque) { st.toque++; if (st.toque < c.toques) som(sys, 'chamando'); }
        if (st.faseT > c.toques * 2.2 - .6) {
          if (c.resultado === 'atendeu') {
            if (c.custo > 0) st.credito = Math.max(0, st.credito - c.custo);
            st.legenda = {nome: (c.nome || 'ALGUÉM ATENDE').toUpperCase(), texto: c.mensagem, vistos: 0, fim: 0};
            this.ir(st, 'conversa'); som(sys, 'fone');
          } else {
            st.legenda = {nome: '', texto: campo(clue.data?.semResposta, FONE_PADRAO.semResposta), vistos: 0, fim: 0, narrador: true};
            this.ir(st, 'semresposta');
          }
        }
      }
      if (st.fase === 'ocupado' && Math.floor(st.faseT / 2.4) > Math.floor((st.faseT - dt) / 2.4)) som(sys, 'ocupado');
      if (st.fase === 'tocando' && Math.floor(st.faseT / 2) > Math.floor((st.faseT - dt) / 2)) som(sys, 'telefone');
      if (st.legenda) {
        const L = st.legenda;
        L.vistos = Math.min(L.texto.length, L.vistos + dt * 26);
        if (L.vistos >= L.texto.length) {
          L.fim += dt;
          if (L.fim > 2.4 && st.fase === 'conversa') { this.ir(st, 'encerrada'); som(sys, 'ocupado'); }
        }
      }
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = clamp(ui.dt || 0, 0, .1), estilo = ['parede', 'orelhao'].includes(chaveDe(d.estilo)) ? chaveDe(d.estilo) : 'mesa';
      const L = FONE_LAYOUT[estilo], custo = custoDe(clue), numeroProprio = campo(d.numero, FONE_PADRAO.numero);
      this.passo(st, clue, sys, dt);
      const noGancho = st.fase === 'gancho' || st.fase === 'tocando';
      const tremor = st.fase === 'tocando' && (st.faseT % 2) < 1.1 ? (Math.floor(st.t * 30) % 2 ? 2 : -2) : 0;
      U.blit(ctx, foneFundo(estilo), 0, 22);
      ui.region('aparelho', ...L.area, {cursor: 'default', silent: true});
      const [BX, BY] = L.corpo;
      // Corpo.
      if (estilo === 'orelhao') U.blit(ctx, foneCorpo('orelhao'), 0, 22);
      else U.blit(ctx, foneCorpo(estilo), BX, BY);
      // Fio e fone.
      const [gx, gy, gw, gh] = L.gancho;
      const quenteFone = ui.region('fone', gx, gy, gw, gh, {cursor: 'pointer'});
      if (estilo === 'mesa') {
        if (noGancho) {
          fioEspiral(ctx, BX + 16, BY + 34, BX - 10, BY + 150, 'papel', 3, {voltas: 12, raio: 4});
          U.blit(ctx, foneMonofone('deitado'), BX + 6, BY + 2 + tremor);
        } else {
          fioEspiral(ctx, BX + 16, BY + 60, L.solto[0] + 26, L.solto[1] + 60, 'papel', 3, {voltas: 10, raio: 4, t: st.t, balanco: 2});
          U.blit(ctx, foneMonofone('mesa'), L.solto[0], L.solto[1]);
          for (const x of [BX + 40, BX + 196]) U.rect(ctx, x, BY + 24, 12, 6, cor('papel', 6));
        }
      } else if (estilo === 'parede') {
        if (noGancho) {
          fioEspiral(ctx, BX + 14, BY + 190, BX + 40, BY + 214, 'amarelo', 3, {voltas: 8, raio: 5});
          U.blit(ctx, foneMonofone('pe'), BX - 4 + tremor, BY + 6);
        } else {
          fioEspiral(ctx, BX + 14, BY + 196, L.solto[0] + 26, L.solto[1] + 62, 'amarelo', 3, {voltas: 12, raio: 5, t: st.t, balanco: 3});
          U.blit(ctx, foneMonofone('parede'), L.solto[0], L.solto[1]);
          U.rect(ctx, BX + 12, BY + 18, 8, 6, cor('amarelo', 5));
        }
      } else {
        const cabo = (x0, y0, x1, y1) => { for (let i = 0; i <= 16; i++) { const u = i / 16, x = x0 + (x1 - x0) * u - Math.sin(u * Math.PI) * 10, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 14; U.rect(ctx, snap(x) - 2, snap(y) - 2, 6, 6, cor('metal', 2)); U.rect(ctx, snap(x) - 2, snap(y) - 2, 4, 2, cor('metal', i % 2 ? 5 : 4)); } };
        if (noGancho) { cabo(112, 210, 138, 238); U.blit(ctx, foneMonofone('publico'), 100 + tremor, 66); }
        else { cabo(L.solto[0] + 26, L.solto[1] + 60, 138, 238); U.blit(ctx, foneMonofone('orelhao'), L.solto[0], L.solto[1]); U.rect(ctx, 120, 80, 8, 6, cor('metal', 5)); }
      }
      if (quenteFone && noGancho) U.ants(ctx, gx, gy, gw, gh, ui.t);
      // Visor.
      const [vx, vy, vw, vh] = L.visor;
      U.rect(ctx, vx, vy, vw, vh, cor('fosforo', estilo === 'orelhao' ? 1 : 2));
      U.rect(ctx, vx, vy, vw, 2, cor('fosforo', 1));
      const lcd = cor('fosforo', 6), blink = Math.floor(st.t * 2.5) % 2 === 0;
      const linhaVisor = (() => {
        const c = st.chamada, seg = Math.floor(st.faseT);
        switch (st.fase) {
          case 'gancho': return custo > 0 && temBolsa(sys) ? (st.credito ? `CRÉDITO ${st.credito}` : 'INSIRA MOEDA') : formatarNumero(numeroProprio) || 'PRONTO';
          case 'linha': return st.piscaVisor > 0 ? (blink ? (custo > 0 && st.credito < custo ? 'INSIRA MOEDA' : 'DIGITE') : '') : st.digitos ? cortar(st.digitos, vw - 12) : custo > 0 && temBolsa(sys) ? `CRÉDITO ${st.credito}` : 'DIGITE';
          case 'discando': return 'DISCANDO' + '.'.repeat(Math.floor(st.faseT * 6) % 4);
          case 'chamando': return 'CHAMANDO' + '.'.repeat(Math.floor(st.faseT * 3) % 4);
          case 'conversa': return `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
          case 'ocupado': return blink ? 'OCUPADO' : '';
          case 'invalido': return 'INVÁLIDO';
          case 'semresposta': return 'SEM RESPOSTA';
          case 'encerrada': return 'ENCERRADA';
          case 'tocando': return blink ? 'CHAMADA' : '';
          default: return '';
        }
      })();
      escreve(ctx, linhaVisor, vx + vw / 2, vy + Math.floor((vh - 7) / 2) + 1, lcd, {align: 'center'});

      // Teclado.
      const [tx, ty, kw, kh, gxk, gyk] = L.teclas;
      TECLAS.forEach((tecla, i) => {
        const x = tx + (i % 3) * gxk, y = ty + Math.floor(i / 3) * gyk;
        const quente = ui.region('tecla', x, y, kw, kh, {data: tecla}), baixo = apertado(st, 'tecla', tecla) || (quente && ui.mouse.down) ? 2 : 0;
        const rampa = estilo === 'orelhao' ? 'metal' : estilo === 'parede' ? 'amarelo' : 'papel', base = estilo === 'orelhao' ? 5 : estilo === 'parede' ? 5 : 6;
        U.rect(ctx, x, y + 2, kw, kh, cor(rampa, base - 3));
        U.rect(ctx, x, y + baixo, kw, kh, cor(rampa, quente ? base + 1 : base));
        if (!baixo) U.rect(ctx, x, y + kh - 2, kw, 2, cor(rampa, base - 2));
        const letras = LETRAS_TECLA[tecla], cx = letras && kw >= 30 ? x + 9 : x + kw / 2;
        escreve(ctx, tecla === '*' ? '*' : tecla, cx, y + baixo + Math.floor((kh - 7) / 2), cor(estilo === 'orelhao' ? 'preto' : 'tinta', 1), {align: 'center'});
        if (letras && kw >= 30) K.drawText(ctx, letras, x + 16, y + baixo + Math.floor((kh - 5) / 2), {font: '3x5', color: cor(rampa, base - 3)});
      });
      // Ligar e desligar.
      const botao = (id, [x, y, w, h], rampa, desenho) => {
        const quente = ui.region(id, x, y, w, h), baixo = apertado(st, id) || (quente && ui.mouse.down) ? 2 : 0;
        U.rect(ctx, x, y + 2, w, h, cor(rampa, 1));
        U.rect(ctx, x, y + baixo, w, h, cor(rampa, quente ? 5 : 4)); if (!baixo) U.rect(ctx, x, y, w, 2, cor(rampa, 6));
        desenho(x + w / 2, y + baixo + h / 2);
      };
      const fonezinho = (cx, cy, virado) => {
        ctx.fillStyle = cor('papel', 7);
        ctx.fillRect(cx - 7, cy - 2 + (virado ? 2 : 0), 14, 3);
        ctx.fillRect(cx - 8, cy - 1 + (virado ? 3 : -1), 4, 4); ctx.fillRect(cx + 4, cy - 1 + (virado ? 3 : -1), 4, 4);
      };
      botao('ligar', L.ligar, 'verde', (cx, cy) => fonezinho(cx, cy, false));
      botao('desligar', L.desligar, 'vermelho', (cx, cy) => fonezinho(cx, cy, true));
      // Luz "em uso" e cartão com o número.
      const [lx, ly] = L.led;
      U.rect(ctx, lx, ly, 6, 4, !noGancho || (st.fase === 'tocando' && blink) ? cor('vermelho', 6) : cor('vermelho', 1));
      const [cx0, cy0, cw] = L.cartao;
      escreve(ctx, cortar((estilo === 'orelhao' ? 'Nº ' : '') + formatarNumero(numeroProprio), cw - 6), cx0 + cw / 2, cy0 + 2, cor('tinta', 1), {align: 'center'});
      // Orelhão: moedas.
      if (estilo === 'orelhao' && st.fase !== 'tocando') {
        const [mx, my, mw, mh] = L.moeda, [rx, ry, rw, rh] = L.devolver;
        if (ui.region('moeda', mx - 4, my - 4, mw + 8, mh + 8)) U.ants(ctx, mx - 2, my - 2, mw + 4, mh + 4, ui.t);
        if (st.moedaCaindo > 0) { const u = 1 - st.moedaCaindo / .35; U.rect(ctx, mx + 2, snap(my - 10 + u * 20), 12, 4, cor('latao', 5)); U.rect(ctx, mx + 2, snap(my - 10 + u * 20), 12, 2, cor('latao', 6)); }
        if (ui.region('devolver', rx - 2, ry - 2, rw + 4, rh + 4)) U.ants(ctx, rx - 2, ry - 2, rw + 4, rh + 4, ui.t);
        if (custo > 0) {
          const faltam = Math.max(0, custo - st.credito);
          U.frame(ctx, 342, 210, 132, 32, 'escuro');
          escreve(ctx, `${custo} ${custo === 1 ? 'moeda' : 'moedas'} por ligação`, 408, 216, '#ffd18c', {align: 'center'});
          escreve(ctx, temBolsa(sys) ? `bolsa: ${contarItem(sys, 'moedas')} · crédito: ${st.credito}` : 'prévia: grátis', 408, 228, faltam && st.fase === 'linha' ? '#ffb0a0' : '#e8d9f0', {align: 'center'});
        }
      }
      // Tocando: o sino e o botão de atender.
      if (st.fase === 'tocando') {
        if ((st.faseT % 2) < 1.1) {
          const k = Math.floor(st.t * 8) % 2;
          const lado = Math.floor(st.faseT / 2) % 2, tx0 = estilo === 'mesa' ? (lado ? 250 : 40) : estilo === 'parede' ? (lado ? 238 : 12) : (lado ? 262 : 30);
          contorno(ctx, 'TRIIIM', tx0 + k * 2, estilo === 'mesa' ? 40 : 84, cor('amarelo', 6), cor('vermelho', 1), {scale: 2});
        }
        const pulso = Math.floor(st.t * 3) % 2, ax = L.notas[0] + (estilo === 'orelhao' ? -4 : 6);
        ui.button(ctx, 'atender', ax, 214, 104, 26, 'ATENDER', {style: 'fosforo'});
        if (pulso) U.outline(ctx, ax - 4, 210, 112, 34, '#ffd18c', 2);
      }
      // Bloco com as chamadas recentes.
      const [nx, ny] = L.notas, nw = estilo === 'orelhao' ? 96 : 116, nh = estilo === 'orelhao' ? 140 : 150;
      {
        U.rect(ctx, nx + 4, ny + 4, nw, nh, 'rgba(10,4,12,.45)');
        U.blit(ctx, papelArt(nw / 2, nh / 2, estilo === 'mesa' ? 'amarelo' : 'papel', {margem: estilo !== 'orelhao'}), nx, ny);
        if (estilo === 'orelhao') { U.tape(ctx, nx + nw / 2 - 18, ny - 6, 36, 12); }
        else if (estilo === 'parede') U.pin(ctx, nx + nw / 2, ny + 4);
        escreve(ctx, nw < 110 ? 'LIGAÇÕES' : 'ÚLTIMAS LIGAÇÕES', nx + nw / 2 + (estilo === 'orelhao' ? 0 : 9), ny + 7, cor('tinta', 1), {align: 'center'});
        const lista = st.mem.recentes || [];
        if (!lista.length) U.hand(ctx, 'nenhuma ainda', nx + nw / 2 + 4, ny + 36, {color: cor('tinta', 3), width: nw - 16, seed: 4, align: 'center'});
        lista.slice(0, 6).forEach((r, i) => {
          const y = ny + 26 + i * 20, quente = r.dir === 'saida' && ui.region('recente', nx + 12, y - 2, nw - 16, 18, {data: i});
          if (quente) U.rect(ctx, nx + 12, y - 2, nw - 16, 18, 'rgba(255,220,120,.35)');
          const seta = r.dir === 'saida' ? 'cima' : 'baixo', corSeta = r.resultado === 'atendida' ? cor('verde', 3) : cor('vermelho', 3);
          triangulo(ctx, nx + 20, y + 4, seta, 3, corSeta);
          escreve(ctx, cortar(r.nome || r.numero || '?', nw - 44), nx + 28, y, cor('tinta', 1));
          K.drawText(ctx, pequeno(r.resultado === 'atendida' ? (r.dir === 'entrada' ? 'recebida' : 'atendeu') : r.resultado), nx + 28, y + 9, {font: '3x5', color: cor('tinta', 3)});
        });
      }
      // Legenda de quem fala.
      if (st.legenda) {
        const Lg = st.legenda, texto = Lg.texto.slice(0, Math.floor(Lg.vistos)), linhas = K.wrap(texto || ' ', 420).slice(-3);
        const h = 20 + Math.max(1, K.wrap(Lg.texto, 420).length > 3 ? 3 : K.wrap(Lg.texto, 420).length) * 11, y = SH - h - 8;
        U.frame(ctx, 20, y, 440, h, 'escuro');
        if (Lg.nome) escreve(ctx, Lg.nome, 32, y + 6, '#ffd18c');
        linhas.forEach((l, i) => escreve(ctx, l, 32, y + (Lg.nome ? 17 : 10) + i * 11, Lg.narrador ? '#b8c8ff' : '#ffe6f7'));
        if (Lg.vistos < Lg.texto.length && Math.floor(st.t * 5) % 2) U.rect(ctx, 32 + K.measure(linhas[linhas.length - 1] || ''), y + (Lg.nome ? 17 : 10) + (linhas.length - 1) * 11, 5, 7, '#ffe6f7');
        ui.region('legenda', 20, y, 440, h, {cursor: 'default', silent: true});
      }
      const dicas = {gancho: custo > 0 && temBolsa(sys) && !st.credito ? 'coloque uma moeda e digite o número' : 'tire o fone do gancho ou digite o número', linha: 'digite o número e aperte o botão verde · Enter liga',
        discando: 'discando…', chamando: 'chamando…', conversa: 'Esc desliga', ocupado: 'ocupado · desligue e tente de novo', invalido: 'desligue e tente de novo', semresposta: 'ninguém atende · Esc desliga',
        encerrada: 'a ligação caiu · Esc desliga', tocando: 'o telefone está tocando!'};
      U.header(ctx, ui, clue.name, dicas[st.fase] || '', 'telefone');
    },
    action(id, st, clue, sys, info) {
      if (id === 'tecla') this.digitar(st, clue, sys, String(info?.data ?? ''));
      else if (id === 'ligar') { apertar(st, 'ligar'); this.ligar(st, clue, sys); }
      else if (id === 'desligar') { apertar(st, 'desligar'); if (st.fase === 'tocando') return; this.desligar(st, clue, sys); }
      else if (id === 'fone') { if (st.fase === 'tocando') this.atender(st, clue, sys); else if (st.fase === 'gancho') this.tirarDoGancho(st, sys); else this.desligar(st, clue, sys); }
      else if (id === 'atender') this.atender(st, clue, sys);
      else if (id === 'moeda') this.colocarMoeda(st, clue, sys);
      else if (id === 'devolver') { if (st.credito > 0 && ['gancho', 'linha'].includes(st.fase)) { const n = st.credito; st.credito = 0; if (darItem(sys, 'moedas', n)) avisar(sys, 'MOEDAS DEVOLVIDAS', `${n} de volta para a bolsa`, 'moeda'); som(sys, 'moeda'); } }
      else if (id === 'recente') {
        const r = (st.mem.recentes || [])[info?.data];
        if (r && r.dir === 'saida' && ['gancho', 'linha'].includes(st.fase)) { this.tirarDoGancho(st, sys); st.digitos = normalizarNumero(r.numero); som(sys, 'tecla'); }
      }
    },
    key(e, st, clue, sys) {
      const k = e.key || '';
      if (/^[0-9*#]$/.test(k)) { this.digitar(st, clue, sys, k); return true; }
      if (k === 'Backspace') { if (st.fase === 'linha') { st.digitos = st.digitos.slice(0, -1); som(sys, 'tecla'); } return true; }
      if (k === 'Enter' || k === ' ') { apertar(st, 'ligar'); this.ligar(st, clue, sys); return true; }
      if (k === 'Escape' && st.fase !== 'gancho' && st.fase !== 'tocando') { this.desligar(st, clue, sys); return true; }
      return false;
    },
    onClose(st, clue, sys) {
      if (st.credito > 0) { const n = st.credito; st.credito = 0; darItem(sys, 'moedas', n); }
    }
  });

  /* ================================================================ terminal (computador genérico) */
  const TERM_PADRAO = {
    estilo: 'moderno', nome: 'RECEPÇÃO-01', usuario: 'Recepção', senha: '', dica: '', papelParede: 'azul',
    arquivos: [
      'DOCUMENTOS/AVISO.TXT', 'A partir de hoje ninguém sobe ao terraço depois das 22h.', 'Ordem da administração.', '---',
      'DOCUMENTOS/ESCALA.TXT', 'Plantão da noite', '', 'Segunda: Jorge', 'Terça: Cida', 'Quarta: ninguém quis.', '---',
      'PESSOAL/DIARIO.TXT !', 'Ele volta onde comeu.'
    ].join('\n')
  };
  const TERM_PELES = {
    crt: {vidro: [62, 38, 356, 192], fosforo: 'fosforo', liga: [390, 228, 34, 30]},
    caixa: {vidro: [62, 38, 356, 192], fosforo: 'ambar', liga: [390, 228, 34, 30]},
    moderno: {vidro: [20, 32, 440, 210], liga: [432, 244, 34, 22]},
    notebook: {vidro: [20, 32, 440, 210], liga: [432, 244, 34, 22]}
  };
  const pelesTerminal = d => { const e = chaveDe(d?.estilo); return TERM_PELES[e] ? e : 'moderno'; };
  function termMoldura(estilo, nome) {
    return U.art(`term:moldura:${estilo}:${nome}`, 240, 124, b => {
      const rotulo = pequeno(nome).slice(0, 18) || 'TERMINAL';
      if (estilo === 'crt' || estilo === 'caixa') {
        const casco = estilo === 'crt' ? 'papel' : 'metal', base = estilo === 'crt' ? 4 : 3;
        b.rect(0, 0, 240, 124, 'carvao', 1);
        b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 120) / 150, (y - 56) / 90); return d < 1 ? (1 - d) * 2 : 0; });
        b.rect(0, 116, 240, 8, 'mogno', 3); b.hline(0, 239, 116, 'mogno', 5);
        b.rect(14, 1, 212, 118, casco, base);
        b.hline(15, 224, 1, casco, base + 2); b.vline(225, 2, 117, casco, base + 1); b.hline(15, 224, 118, casco, base - 3); b.vline(14, 2, 117, casco, base - 1);
        b.grain(15, 2, 210, 116, -1, .03, K.rng(8));
        b.rect(24, 5, 192, 100, casco, base - 2); b.hline(24, 215, 5, casco, base - 3); b.vline(24, 5, 104, casco, base - 3); b.hline(25, 215, 104, casco, base + 1); b.vline(215, 6, 104, casco, base);
        b.erase(31, 8, 178, 96);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) for (const [x, y] of [[31 + i, 8 + j], [208 - i, 8 + j], [31 + i, 103 - j], [208 - i, 103 - j]]) b.px(x, y, casco, base - 2);
        b.inset(28, 107, 70, 9, casco, base - 1, base + 1, base - 2);
        b.text(63, 109, rotulo, estilo === 'crt' ? 'tinta' : 'ambar', estilo === 'crt' ? 2 : 4, {font: '3x5', align: 'center'});
        for (let x = 112; x < 160; x += 3) b.vline(x, 108, 114, casco, base - 2);
        b.ellipse(203, 111, 5, 5, casco, base - 3); b.ellipse(203, 111, 4, 4, casco, base + 1); b.px(204, 110, casco, base + 3);
      } else {
        const nb = estilo === 'notebook', casco = nb ? 'metal' : 'preto', base = nb ? 4 : 2;
        b.rect(0, 0, 240, 124, 'azul', 1);
        b.rect(4, 2, 232, 120, casco, base);
        b.hline(5, 234, 2, casco, base + 2); b.vline(235, 3, 121, casco, base + 1); b.vline(4, 3, 121, casco, base - 1); b.hline(5, 234, 121, casco, base - 2);
        b.erase(10, 5, 220, 105);
        b.rect(10, 110, 220, 1, casco, base - 1);
        b.text(120, 113, rotulo, casco, nb ? 2 : 4, {font: '3x5', align: 'center'});
        if (nb) { b.px(120, 3, 'preto', 1); b.px(121, 3, 'fosforo', 3); b.rect(0, 121, 240, 3, 'metal', 5); b.hline(0, 239, 121, 'metal', 6); }
      }
    });
  }
  function termPapelParede(tipo, w, h) {
    return U.art(`term:papel:${tipo}:${w}:${h}`, w, h, b => {
      if (tipo === 'verde') {
        b.vgrad(0, 0, w, h, 'ceu', 5.5, 3.5);
        b.ellipse(w * .78, h * .22, 9, 9, 'amarelo', 6);
        for (let x = 0; x < w; x++) { const t1 = Math.round(h * .58 + Math.sin(x / 26) * 8), t2 = Math.round(h * .74 + Math.sin(x / 17 + 2) * 5); b.vline(x, t1, h - 1, 'folha', 4); b.vline(x, t2, h - 1, 'folha', 5); b.px(x, t1, 'folha', 6); }
        for (let i = 0; i < 4; i++) { const cx = 20 + i * 52, cy = 14 + (i % 2) * 8; b.rect(cx - 8, cy, 16, 3, 'papel', 7); b.rect(cx - 4, cy - 2, 8, 2, 'papel', 7); }
      } else if (tipo === 'roxo') {
        b.vgrad(0, 0, w, Math.round(h * .62), 'roxo', 1, 4.5);
        const sx = w / 2, sy = h * .62, r = h * .3;
        for (let y = Math.round(sy - r); y < sy; y++) { if (Math.floor(y) % 4 === 0 && y > sy - r * .6) continue; const hw = Math.sqrt(Math.max(0, r * r - (y - sy) * (y - sy))); b.hline(Math.round(sx - hw), Math.round(sx + hw), y, 'fogo', y < sy - r * .5 ? 5 : 4); }
        b.rect(0, Math.round(h * .62), w, h, 'roxo', 1);
        for (let i = 0; i < 8; i++) b.hline(0, w - 1, Math.round(h * .62 + i * i * .6 + 1), 'rosa', 3);
        for (let i = -10; i <= 10; i++) b.line(sx + i * 3, h * .62, sx + i * 18, h, 'rosa', 3);
        for (let i = 0; i < 40; i++) b.px(Math.floor(K.hash2(i, 2, 9) * w), Math.floor(K.hash2(i, 3, 9) * h * .45), 'rosa', 6);
      } else {
        b.vgrad(0, 0, w, h, 'azul', 1, 3.2);
        for (let i = 0; i < 60; i++) b.px(Math.floor(K.hash2(i, 1, 4) * w), Math.floor(K.hash2(i, 2, 4) * h * .55), 'papel', K.hash2(i, 3, 4) > .7 ? 7 : 4);
        b.ellipse(w * .76, h * .24, 8, 8, 'papel', 6); b.ellipse(w * .76 + 3, h * .24 - 2, 7, 7, 'azul', 1);
        for (let x = 0; x < w; x++) { const top = Math.round(h * .6 + Math.sin(x / 13) * 5 + Math.sin(x / 5) * 1.5 - Math.abs(x - w * .3) * .06); b.vline(x, top, Math.round(h * .78), 'azul', 0); }
        b.rect(0, Math.round(h * .78), w, h, 'agua', 1);
        for (let y = Math.round(h * .8); y < h; y += 3) for (let x = (y * 7) % 11; x < w; x += 11) b.hline(x, x + 4, y, 'agua', 2);
        for (let y = Math.round(h * .8); y < h; y += 2) b.hline(Math.round(w * .76 - 4), Math.round(w * .76 + 4), y, 'papel', 5);
      }
    });
  }
  const TERM_ICONES = {
    pasta: b => { b.rect(1, 2, 7, 2, 'amarelo', 3); b.rect(1, 3, 14, 10, 'amarelo', 4); b.hline(1, 14, 3, 'amarelo', 6); b.hline(1, 14, 12, 'amarelo', 2); b.rect(2, 5, 12, 1, 'amarelo', 5); },
    txt: b => { b.rect(3, 0, 10, 14, 'papel', 7); b.frame(3, 0, 10, 14, 'papel', 3); b.rect(9, 0, 4, 4, 'papel', 4); for (let y = 5; y < 13; y += 2) b.hline(5, 10, y, 'azul', 3); },
    ruim: b => { b.rect(3, 0, 10, 14, 'papel', 6); b.frame(3, 0, 10, 14, 'papel', 3); b.line(4, 3, 12, 12, 'vermelho', 4); b.line(12, 3, 4, 12, 'vermelho', 4); },
    logo: b => { b.rect(1, 1, 6, 6, 'agua', 5); b.rect(9, 1, 6, 6, 'agua', 5); b.rect(1, 9, 6, 6, 'agua', 5); b.rect(9, 9, 6, 6, 'agua', 4); }
  };
  const termIcone = nome => U.art('term:icone:' + nome, 16, 14, TERM_ICONES[nome]);

  Tipos.register('terminal', {
    label: 'Computador', icon: 'computador', sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'estilo', label: 'Computador', kind: 'select', options: [['moderno', 'Moderno (área de trabalho)'], ['crt', 'Antigo (fósforo verde)'], ['notebook', 'Notebook'], ['caixa', 'Terminal de loja (âmbar)']]},
      {id: 'nome', label: 'Nome do computador', kind: 'text'},
      {id: 'usuario', label: 'Usuário', kind: 'text'},
      {id: 'senha', label: 'Senha (vazia = entra direto)', kind: 'text'},
      {id: 'dica', label: 'Dica da senha (aparece depois de errar)', kind: 'text'},
      {id: 'arquivos', label: 'Arquivos: PASTA/NOME.TXT na 1ª linha, depois o texto; uma linha --- separa arquivos; nome terminado em " !" = corrompido', kind: 'textarea', rows: 10},
      {id: 'papelParede', label: 'Papel de parede (moderno e notebook)', kind: 'select', options: [['azul', 'Azul (lago à noite)'], ['verde', 'Verde (colinas)'], ['roxo', 'Roxo (pôr do sol)']]}],
    defaults: {...TERM_PADRAO},
    create(clue, sys) {
      const mem = memoriaDe(sys, clue);
      if (!Array.isArray(mem.corrompidos)) mem.corrompidos = [];
      const ligado = mem.ligado !== false;
      const st = {mem, tela: ligado ? 'boot' : 'off', t: 0, entrada: '', erros: 0, msg: '', tremor: 0, sel: 0, selArq: 0, col: 0, janelas: [], menu: false, scroll: 0, maxScroll: 0, arquivo: null, glitch: 0};
      if (ligado && temEnergia(sys)) som(sys, 'boot');
      return st;
    },
    wantsKeys: st => st.tela !== 'off' && st.tela !== 'shutdown',
    describe(st) { return {tela: st.tela, logado: !!st.mem?.logado, entrada: st.entrada.length, janelas: (st.janelas || []).map(j => j.tipo + ':' + (j.pasta || j.arquivo?.nome)), arquivo: st.arquivo?.nome || null, scroll: st.scroll, erros: st.erros}; },
    ir(st, tela) { st.tela = tela; st.t = 0; st.menu = false; },
    dados(clue) {
      const d = clue.data || {}, arquivos = parseArquivos(campo(d.arquivos, TERM_PADRAO.arquivos));
      const lista = arquivos.length ? arquivos : parseArquivos(TERM_PADRAO.arquivos);
      return {d, arquivos: lista, pastas: pastasDe(lista), senha: typeof d.senha === 'string' ? d.senha.trim() : '', usuario: campo(d.usuario, TERM_PADRAO.usuario), nome: campo(d.nome, TERM_PADRAO.nome)};
    },
    ligar(st, sys) {
      if (!temEnergia(sys)) { st.tremor = .4; som(sys, 'erro'); return; }
      if (st.tela === 'off') { st.mem.ligado = true; this.ir(st, 'boot'); som(sys, 'boot'); salvar(sys); }
      else if (st.tela !== 'shutdown') { st.mem.ligado = false; this.ir(st, 'shutdown'); st.janelas = []; som(sys, 'desligar'); salvar(sys); }
    },
    entrar(st, clue, sys) {
      const {senha} = this.dados(clue);
      if (!senha || senhaConfere(st.entrada, senha)) {
        st.mem.logado = true; st.entrada = ''; st.msg = ''; this.ir(st, 'desk'); som(sys, 'beep');
        if (senha) avisar(sys, 'ACESSO LIBERADO', clue.name, 'computador');
        salvar(sys);
      } else { st.erros++; st.entrada = ''; st.msg = 'Senha incorreta'; st.tremor = .45; som(sys, 'erro'); }
    },
    abrirPasta(st, sys, pasta) { st.janelas = [{tipo: 'pasta', pasta}]; st.selArq = 0; st.col = 1; som(sys, 'clique'); },
    abrirArquivo(st, clue, sys, arq) {
      if (!arq) return;
      st.arquivo = arq; st.scroll = 0; st.glitch = arq.corrompido ? 3.2 : 0;
      st.janelas = st.janelas.filter(j => j.tipo === 'pasta').concat({tipo: 'arquivo', arquivo: arq});
      if (arq.corrompido) {
        som(sys, 'glitch');
        if (!st.mem.corrompidos.includes(arq.pasta + '/' + arq.nome)) { st.mem.corrompidos.push(arq.pasta + '/' + arq.nome); salvar(sys); }
      } else som(sys, 'tecla');
    },
    fecharJanela(st, sys) { if (!st.janelas.length) return false; const j = st.janelas.pop(); if (j.tipo === 'arquivo') { st.arquivo = null; st.glitch = 0; } som(sys, 'clique'); return true; },
    passo(st, clue, sys, dt) {
      st.t += dt; st.tremor = Math.max(0, st.tremor - dt); st.glitch = Math.max(0, st.glitch - dt);
      const {senha} = this.dados(clue);
      if (st.tela !== 'off' && !temEnergia(sys)) { this.ir(st, 'off'); st.janelas = []; }
      if (st.tela === 'boot' && st.t > 2.4) this.ir(st, st.mem.logado || !senha ? 'desk' : 'login');
      if (st.tela === 'shutdown' && st.t > .9) this.ir(st, 'off');
    },
    render(ctx, ui, st, clue, sys) {
      const dt = clamp(ui.dt || 0, 0, .1), pele = pelesTerminal(clue.data), P = TERM_PELES[pele], D = this.dados(clue);
      this.passo(st, clue, sys, dt);
      const [GX, GY, GW, GH] = P.vidro, energia = temEnergia(sys);
      ui.region('micro', 0, 24, SW, SH - 24, {cursor: 'default', silent: true});
      ctx.save(); ctx.beginPath(); ctx.rect(GX, GY, GW, GH); ctx.clip();
      if (st.tela === 'off') {
        telaApagada(ctx, GX, GY, GW, GH);
        ui.region('ligar', GX, GY, GW, GH);
        if (!energia) caixaAviso(ctx, GX + GW / 2, GY + GH / 2, 'SEM ENERGIA', 'o computador não liga', {tremor: st.tremor > 0 ? (Math.floor(st.t * 40) % 2 ? 3 : -3) : 0});
        else if (Math.floor(st.t * 1.2) % 2) escreve(ctx, 'aperte o botão para ligar', GX + GW / 2, GY + GH / 2 - 3, cor('carvao', 5), {align: 'center'});
      } else if (pele === 'crt' || pele === 'caixa') this.telaTexto(ctx, ui, st, clue, sys, D, P, GX, GY, GW, GH);
      else this.telaModerna(ctx, ui, st, clue, sys, D, P, GX, GY, GW, GH);
      ctx.restore();
      U.blit(ctx, termMoldura(pele, D.nome), 0, 22);
      // Botão de energia e luz.
      const [bx, by, bw, bh] = P.liga, quente = ui.region('energia', bx, by, bw, bh);
      if (quente) U.outline(ctx, bx, by, bw, bh, '#ffd18c', 2);
      const ledOn = st.tela !== 'off';
      if (pele === 'crt' || pele === 'caixa') U.rect(ctx, 380, 242, 4, 4, ledOn ? cor(P.fosforo, 6) : cor('preto', 3));
      else U.rect(ctx, 452, 250, 4, 2, ledOn ? cor('agua', 6) : cor('vermelho', 3));
      const dicas = {off: energia ? 'desligado · clique para ligar' : 'sem energia', boot: 'iniciando…', login: 'digite a senha e aperte Enter', desk: pele === 'crt' || pele === 'caixa' ? 'setas escolhem · Enter abre' : 'clique numa pasta', shutdown: ''};
      U.header(ctx, ui, clue.name, st.janelas.some(j => j.tipo === 'arquivo') ? 'role para ler · Esc fecha' : dicas[st.tela] || '', 'computador');
    },
    /* ---------- pele de fósforo (crt e caixa) */
    telaTexto(ctx, ui, st, clue, sys, D, P, GX, GY, GW, GH) {
      const F = P.fosforo, TX = GX + 18, TY = GY + 14, COLS = Math.floor((GW - 36) / 6), LH = 10, t = st.t;
      const glow = U.art(`term:vidro:${F}`, 178, 96, b => { for (let y = 0; y < 96; y++) for (let x = 0; x < 178; x++) { const dd = Math.hypot((x - 89) / 96, (y - 48) / 56); b.px(x, y, F, Math.max(0, Math.floor(1.5 - dd * 1.4 + K.bayer(x, y)))); } });
      U.blit(ctx, glow, GX, GY);
      const ox = st.tremor > 0 ? (Math.floor(t * 40) % 2 ? 4 : -4) : 0;
      const txt = (s, col, row, nivel = 5) => U.mono(ctx, String(s), TX + col * 6 + ox, TY + row * LH, {color: cor(F, nivel)});
      const inverso = (s, col, row) => { U.rect(ctx, TX + col * 6 - 2 + ox, TY + row * LH - 2, String(s).length * 6 + 4, LH, cor(F, 5)); txt(s, col, row, 0); };
      const clique = (id, s, col, row, data = null) => ui.region(id, TX + col * 6 - 3, TY + row * LH - 2, String(s).length * 6 + 6, LH + 1, {data});
      const up = s => semAcento(s).toUpperCase();
      if (st.tela === 'boot') {
        const linhas = [`${up(D.nome)} · BIOS 2.1`, '', 'MEMORIA ........ 640K  OK', 'DISCO .......... 20MB  OK', `VIDEO .......... ${F === 'ambar' ? 'AMBAR' : 'FOSFORO'}`, '', 'CARREGANDO SISTEMA'];
        const n = Math.floor(t / .28);
        linhas.slice(0, n).forEach((l, i) => txt(l, 0, i));
        if (n > linhas.length) txt('.'.repeat(Math.min(10, Math.floor((t - linhas.length * .28) * 8))), 19, linhas.length - 1);
        ui.region('pular', GX, GY, GW, GH, {cursor: 'default', silent: true});
      } else if (st.tela === 'login') {
        U.outline(ctx, TX + ox, TY + 2, COLS * 6 - 6, 34, cor(F, 4), 2);
        txt(up(D.nome), Math.floor((COLS - up(D.nome).length) / 2), 1);
        txt('ACESSO RESTRITO', Math.floor((COLS - 15) / 2), 2, 4);
        txt('USUARIO:', 8, 6); txt(up(D.usuario).slice(0, 24), 18, 6);
        txt('SENHA:', 8, 8); txt('*'.repeat(st.entrada.length) + (Math.floor(t * 2.5) % 2 ? '_' : ' '), 18, 8);
        ui.region('campo', TX + 17 * 6, TY + 8 * LH - 2, 24 * 6, LH + 2, {cursor: 'text'});
        (clique('entrar', '[ ENTRAR ]', 18, 11) ? inverso : txt)('[ ENTRAR ]', 18, 11);
        if (st.msg) txt(up(st.msg), 8, 13, Math.floor(t * 4) % 2 ? 6 : 4);
        if (st.erros >= 2 && D.d.dica) txt('DICA: ' + up(D.d.dica).slice(0, COLS - 14), 8, 14, 4);
      } else if (st.tela === 'desk' && !st.arquivo) {
        txt(up(D.nome), 0, 0); txt(seguro(() => sys.stage?.clock, '') || '03:17', COLS - 6, 0, 4);
        U.rect(ctx, TX, TY + LH + 1, COLS * 6 - 6, 2, cor(F, 3));
        txt('PASTAS', 1, 2, 4); txt('ARQUIVOS', 22, 2, 4);
        st.sel = clamp(st.sel, 0, D.pastas.length - 1);
        const dentro = D.arquivos.filter(a => a.pasta === D.pastas[st.sel]);
        st.selArq = clamp(st.selArq, 0, Math.max(0, dentro.length - 1));
        D.pastas.slice(0, 10).forEach((p, i) => { const s = (i === st.sel ? '> ' : '  ') + up(p).slice(0, 16); (clique('pasta', s, 1, 4 + i, i) || (st.col === 0 && i === st.sel) ? inverso : txt)(s, 1, 4 + i); });
        dentro.slice(0, 10).forEach((a, i) => { const ruim = st.mem.corrompidos.includes(a.pasta + '/' + a.nome), s = up(a.nome).slice(0, 22) + (ruim ? ' [ERRO]' : ''); (clique('arquivo', s, 22, 4 + i, i) || (st.col === 1 && i === st.selArq) ? inverso : txt)(s, 22, 4 + i); });
        U.rect(ctx, TX, TY + 14 * LH - 3, COLS * 6 - 6, 1, cor(F, 3));
        (clique('desligar', '[ DESLIGAR ]', 0, 15) ? inverso : txt)('[ DESLIGAR ]', 0, 15);
        txt('SETAS ESCOLHEM · ENTER ABRE', 17, 15, 3);
      } else if (st.arquivo) {
        const a = st.arquivo, corpo = U.wrapMono(a.texto, COLS - 2), rows = 12;
        st.maxScroll = Math.max(0, corpo.length - rows); st.scroll = clamp(st.scroll, 0, st.maxScroll);
        txt(up(`${a.pasta}/${a.nome}`).slice(0, COLS), 0, 0); U.rect(ctx, TX, TY + LH + 1, COLS * 6 - 6, 2, cor(F, 3));
        if (a.corrompido && st.glitch > 0) {
          const k = 1 - st.glitch / 3.2, r = K.rng(Math.floor(t * 20) + 3), lixo = '#@%&*=+<>$01/|';
          for (let row = 0; row < 12; row++) {
            let l = corpo[row % Math.max(1, corpo.length)] || '';
            if (row % 2 && k > .35) l = up(a.texto.split('\n')[0] || 'ERRO').repeat(3).slice(0, COLS - 2);
            l = [...l].map(ch => (r() < k * .55 ? lixo[Math.floor(r() * lixo.length)] : ch)).join('');
            U.mono(ctx, l, TX + (r() < k * .4 ? Math.round((r() - .5) * 24) : 0), TY + (2 + row) * LH, {color: r() < k * .3 ? cor('vermelho', 5) : cor(F, 5)});
          }
          if (Math.floor(t * 12) % 7 === 0) { ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = cor(F, 6); ctx.fillRect(GX, GY, GW, GH); ctx.restore(); }
        } else if (a.corrompido) {
          txt('ERRO DE LEITURA NO SETOR 0317', 0, 4, 6); txt('ARQUIVO CORROMPIDO.', 0, 6); if (Math.floor(t * 2) % 2) txt('_', 0, 8);
        } else corpo.slice(st.scroll, st.scroll + rows).forEach((l, i) => txt(l, 0, 2 + i));
        if (!a.corrompido || st.glitch <= 0) {
          (clique('voltar', '[ VOLTAR ]', 0, 15) ? inverso : txt)('[ VOLTAR ]', 0, 15);
          if (st.maxScroll && !a.corrompido) txt(`${st.scroll + 1}-${Math.min(corpo.length, st.scroll + rows)} DE ${corpo.length} · SETAS ROLAM`, 14, 15, 3);
        }
      } else if (st.tela === 'shutdown') {
        const u = clamp(st.t / .55, 0, 1), h = Math.max(2, snap(GH * Math.max(0, 1 - u * 3))), w = u < .33 ? GW : Math.max(4, snap(GW * Math.max(0, 1 - (u - .33) * 1.8)));
        ret(ctx, GX, GY, GW, GH, 'preto', 0);
        if (u < .92) U.rect(ctx, snap(GX + (GW - w) / 2), snap(GY + (GH - h) / 2), w, h, cor(F, u < .33 ? 4 : 6));
      }
      if (st.tela !== 'shutdown') vidro(ctx, GX, GY, GW, GH, {linhas: .22, reflexo: .05, vinheta: 1.4});
    },
    /* ---------- pele moderna (moderno e notebook) */
    telaModerna(ctx, ui, st, clue, sys, D, P, GX, GY, GW, GH) {
      const t = st.t, papel = ['azul', 'verde', 'roxo'].includes(chaveDe(D.d.papelParede)) ? chaveDe(D.d.papelParede) : 'azul';
      const hora = String(seguro(() => sys.stage?.clock, '') || '22:47').slice(0, 5);
      if (st.tela === 'boot' || st.tela === 'shutdown') {
        ret(ctx, GX, GY, GW, GH, 'preto', 0);
        ctx.drawImage(termIcone('logo'), GX + GW / 2 - 24, GY + GH / 2 - 44, 48, 48);
        for (let i = 0; i < 6; i++) { const a = t * 5 - i * .45, x = GX + GW / 2 + Math.cos(a) * 12, y = GY + GH / 2 + 30 + Math.sin(a) * 12; U.rect(ctx, snap(x), snap(y), 2, 2, i === 0 ? '#e8f4ff' : `rgba(232,244,255,${.8 - i * .13})`); }
        escreve(ctx, st.tela === 'boot' ? 'Iniciando…' : 'Desligando…', GX + GW / 2, GY + GH - 36, cor('ceu', 6), {align: 'center'});
        if (st.tela === 'boot') ui.region('pular', GX, GY, GW, GH, {cursor: 'default', silent: true});
        return;
      }
      U.blit(ctx, termPapelParede(papel, GW / 2, GH / 2), GX, GY);
      if (st.tela === 'login') {
        U.rect(ctx, GX, GY, GW, GH, 'rgba(6,8,20,.45)');
        contorno(ctx, hora, GX + 24, GY + GH - 50, cor('papel', 7), 'rgba(0,0,0,.4)', {scale: 3});
        escreve(ctx, 'quinta-feira', GX + 26, GY + GH - 22, cor('papel', 6));
        const cw = 170, ch = 118, cx = GX + GW / 2 - cw / 2 + (st.tremor > 0 ? (Math.floor(t * 40) % 2 ? 5 : -5) : 0), cy = GY + 36;
        U.rect(ctx, cx, cy, cw, ch, 'rgba(10,12,30,.72)'); U.outline(ctx, cx, cy, cw, ch, 'rgba(255,255,255,.18)', 1);
        const ax = cx + cw / 2, ay = cy + 26;
        for (let y = -16; y <= 16; y += 2) { const hw = Math.round(Math.sqrt(256 - y * y) / 2) * 2; U.rect(ctx, ax - hw, ay + y, hw * 2, 2, cor('agua', y < -6 ? 5 : 4)); }
        escreve(ctx, semAcento(D.usuario).charAt(0).toUpperCase() || '?', ax, ay - 6, cor('papel', 7), {align: 'center', scale: 2});
        escreve(ctx, cortar(D.usuario, cw - 20), ax, cy + 48, cor('papel', 7), {align: 'center'});
        const fx = cx + 16, fy = cy + 64, fw = cw - 52;
        U.rect(ctx, fx, fy, fw, 18, cor('papel', 7)); U.outline(ctx, fx, fy, fw, 18, st.msg ? cor('vermelho', 4) : cor('agua', 5), 2);
        ui.region('campo', fx, fy, fw, 18, {cursor: 'text'});
        if (st.entrada) for (let i = 0; i < Math.min(14, st.entrada.length); i++) U.rect(ctx, fx + 8 + i * 8, fy + 7, 4, 4, cor('tinta', 1));
        else escreve(ctx, 'Senha', fx + 7, fy + 6, cor('papel', 3));
        if (Math.floor(t * 2.5) % 2) U.rect(ctx, fx + 8 + Math.min(14, st.entrada.length) * 8, fy + 4, 2, 10, cor('tinta', 1));
        const quente = ui.region('entrar', fx + fw + 4, fy, 18, 18);
        U.rect(ctx, fx + fw + 4, fy, 18, 18, cor('agua', quente ? 5 : 4)); triangulo(ctx, fx + fw + 13, fy + 9, 'dir', 4, cor('papel', 7));
        if (st.msg) escreve(ctx, st.msg, ax, cy + 90, cor('vermelho', 5), {align: 'center'});
        if (st.erros >= 1 && D.d.dica) escreve(ctx, cortar('Dica: ' + D.d.dica, cw - 12), ax, cy + 102, cor('ceu', 6), {align: 'center'});
        return;
      }
      // Área de trabalho: ícones das pastas.
      const TB = 18;
      D.pastas.slice(0, 7).forEach((p, i) => {
        const x = GX + 14, y = GY + 10 + i * 26, quente = ui.region('pasta', x - 4, y - 2, 64, 24, {data: i});
        const aberta = st.janelas.some(j => j.tipo === 'pasta' && j.pasta === p);
        if (quente || aberta || (st.col === 0 && st.sel === i)) U.rect(ctx, x - 4, y - 2, 64, 24, quente ? 'rgba(180,220,255,.28)' : 'rgba(180,220,255,.16)');
        ctx.drawImage(termIcone('pasta'), x, y, 32, 14 * 2 - 8);
        contorno(ctx, cortar(p.split('/').pop(), 56), x + 44, y + 6, cor('papel', 7), 'rgba(0,0,0,.55)');
      });
      // Janelas.
      st.janelas.forEach((j, idx) => {
        const topo = idx === st.janelas.length - 1, arq = j.tipo === 'arquivo';
        const wx = GX + (arq ? 150 : 96), wy = GY + (arq ? 18 : 30), ww = arq ? 272 : 250, wh = arq ? GH - TB - 30 : 130;
        U.rect(ctx, wx + 4, wy + 4, ww, wh, 'rgba(2,4,12,.45)');
        U.rect(ctx, wx, wy, ww, wh, cor('papel', 7)); U.outline(ctx, wx, wy, ww, wh, cor('azul', 2), 1);
        U.rect(ctx, wx, wy, ww, 14, cor('azul', topo ? 3 : 2));
        escreve(ctx, cortar(arq ? `${j.arquivo.nome} — Bloco de notas` : j.pasta, ww - 30), wx + 6, wy + 4, cor('papel', 7));
        const fx = wx + ww - 14, quente = topo && ui.region('fecharJanela', fx - 2, wy, 16, 14);
        U.rect(ctx, fx, wy + 2, 11, 10, cor('vermelho', quente ? 5 : 3));
        for (let i = 0; i < 4; i++) { U.rect(ctx, fx + 3 + i, wy + 4 + i, 2, 1, cor('papel', 7)); U.rect(ctx, fx + 6 - i, wy + 4 + i, 2, 1, cor('papel', 7)); }
        if (topo) ui.region('janela', wx, wy + 14, ww, wh - 14, {cursor: 'default', silent: true});
        if (!arq) {
          const dentro = D.arquivos.filter(a => a.pasta === j.pasta);
          escreve(ctx, 'Nome', wx + 30, wy + 20, cor('papel', 3)); escreve(ctx, 'Tamanho', wx + ww - 60, wy + 20, cor('papel', 3));
          U.rect(ctx, wx + 6, wy + 30, ww - 12, 1, cor('papel', 5));
          dentro.slice(0, 8).forEach((a, i) => {
            const y = wy + 34 + i * 12, ruim = a.corrompido && st.mem.corrompidos.includes(a.pasta + '/' + a.nome);
            const q = topo && ui.region('arquivo', wx + 6, y - 1, ww - 12, 12, {data: i});
            if (q || (topo && st.col === 1 && st.selArq === i)) U.rect(ctx, wx + 6, y - 1, ww - 12, 12, q ? cor('ceu', 5) : cor('ceu', 6));
            ctx.drawImage(termIcone(ruim ? 'ruim' : 'txt'), wx + 10, y - 1, 16, 14 - 2);
            escreve(ctx, cortar(a.nome, ww - 110), wx + 30, y + 1, cor('tinta', 1));
            escreve(ctx, `${Math.max(1, Math.ceil(a.texto.length / 900))} KB`, wx + ww - 60, y + 1, cor('papel', 3));
          });
          if (!dentro.length) escreve(ctx, 'Esta pasta está vazia.', wx + ww / 2, wy + 60, cor('papel', 3), {align: 'center'});
          return;
        }
        const a = j.arquivo, area = {x: wx + 6, y: wy + 30, w: ww - 24, h: wh - 36};
        escreve(ctx, 'Arquivo   Editar   Exibir', wx + 6, wy + 18, cor('papel', 2));
        U.rect(ctx, wx, wy + 27, ww, 1, cor('papel', 5));
        const linhas = a.texto.split('\n').flatMap(l => (l ? K.wrap(l, area.w - 6) : [''])), rows = Math.floor(area.h / 11);
        st.maxScroll = Math.max(0, linhas.length - rows); st.scroll = clamp(st.scroll, 0, st.maxScroll);
        if (a.corrompido) {
          if (st.glitch <= 0) {
            U.frame(ctx, wx + 30, wy + 50, ww - 60, 64, 'escuro');
            ctx.drawImage(U.icon('alerta'), wx + 42, wy + 62, 16, 16);
            escreve(ctx, 'Não foi possível abrir', wx + 66, wy + 62, '#ffd18c');
            escreve(ctx, 'o arquivo está corrompido.', wx + 66, wy + 74, '#e8d9f0');
            ui.button(ctx, 'fecharJanela', wx + ww - 84, wy + 92, 40, 16, 'OK', {style: 'roxo'});
          } else K.wrap(a.texto || 'ELE VOLTA ONDE COMEU', area.w).slice(0, rows).forEach((l, i) => escreve(ctx, l, area.x + 4, area.y + 2 + i * 11, cor('tinta', 1)));
        } else {
          linhas.slice(st.scroll, st.scroll + rows).forEach((l, i) => escreve(ctx, l, area.x + 4, area.y + 2 + i * 11, cor('tinta', 1)));
          if (st.maxScroll) {
            const sx = wx + ww - 14, trilho = area.h - 24;
            U.rect(ctx, sx, area.y, 10, area.h, cor('papel', 5));
            ui.button(ctx, 'subir', sx, area.y, 10, 10, '', {style: 'papel'}); ui.button(ctx, 'descer', sx, area.y + area.h - 10, 10, 10, '', {style: 'papel'});
            triangulo(ctx, sx + 5, area.y + 6, 'cima', 2, cor('tinta', 1)); triangulo(ctx, sx + 5, area.y + area.h - 5, 'baixo', 2, cor('tinta', 1));
            U.rect(ctx, sx + 2, area.y + 12 + Math.round(trilho * st.scroll / st.maxScroll) - 1, 6, 12, cor('azul', 3));
          }
        }
      });
      // Barra de tarefas.
      const by = GY + GH - TB;
      U.rect(ctx, GX, by, GW, TB, 'rgba(8,10,26,.86)'); U.rect(ctx, GX, by, GW, 1, 'rgba(255,255,255,.12)');
      const qi = ui.region('iniciar', GX + 2, by + 1, 22, TB - 2);
      if (qi || st.menu) U.rect(ctx, GX + 2, by + 1, 22, TB - 2, 'rgba(255,255,255,.14)');
      ctx.drawImage(termIcone('logo'), GX + 5, by + 1, 16, 16);
      st.janelas.forEach((j, i) => { const x = GX + 32 + i * 96; U.rect(ctx, x, by + 2, 92, TB - 4, 'rgba(255,255,255,.1)'); U.rect(ctx, x, by + TB - 3, 92, 1, cor('agua', 5)); escreve(ctx, cortar(j.tipo === 'arquivo' ? j.arquivo.nome : j.pasta, 80), x + 6, by + 6, cor('papel', 6)); });
      escreve(ctx, hora, GX + GW - 8, by + 6, cor('papel', 7), {align: 'right'});
      for (let i = 0; i < 3; i++) U.rect(ctx, GX + GW - 56 + i * 4, by + 12 - i * 3, 2, 2 + i * 3, cor('papel', 6));
      if (st.menu) {
        const mx = GX + 2, my = by - 62;
        U.rect(ctx, mx, my, 120, 60, 'rgba(10,12,30,.94)'); U.outline(ctx, mx, my, 120, 60, 'rgba(255,255,255,.2)', 1);
        escreve(ctx, cortar(D.usuario, 100), mx + 10, my + 8, cor('papel', 7));
        ui.button(ctx, 'bloquear', mx + 8, my + 22, 104, 14, 'Bloquear', {style: 'roxo'});
        ui.button(ctx, 'desligar', mx + 8, my + 40, 104, 14, 'Desligar', {style: 'roxo'});
      }
      // Arquivo corrompido: a tela se rasga.
      if (st.glitch > 0) {
        const k = st.glitch / 3.2, r = K.rng(Math.floor(t * 24) + 9);
        for (let i = 0; i < 6; i++) { const y = GY + Math.floor(r() * GH), h = 4 + Math.floor(r() * 18), dx = Math.round((r() - .5) * 60 * k); seguro(() => ctx.drawImage(ctx.canvas, GX, y, GW, h, GX + dx, y, GW, h)); }
        for (let i = 0; i < 5; i++) U.rect(ctx, GX, GY + Math.floor(r() * GH), GW, 2 + Math.floor(r() * 6), r() < .5 ? 'rgba(255,40,80,.25)' : 'rgba(40,255,200,.18)');
        const lixo = '#@%&*=+<>$01/\\|';
        for (let row = 0; row < 6; row++) if (r() < k) escreve(ctx, [...Array(40)].map(() => lixo[Math.floor(r() * lixo.length)]).join(''), GX + r() * 200, GY + r() * GH, r() < .5 ? cor('vermelho', 5) : cor('agua', 6));
        if (st.glitch < 1.2 && st.glitch > .8) { U.rect(ctx, GX, GY, GW, GH, cor('azul', 3)); escreve(ctx, ':(', GX + 40, GY + 50, cor('papel', 7), {scale: 3}); escreve(ctx, 'ERRO FATAL 0x0317', GX + 40, GY + 90, cor('papel', 7)); escreve(ctx, 'ELE VOLTA ONDE COMEU', GX + 40, GY + 104, cor('papel', 6)); }
      }
    },
    action(id, st, clue, sys, info) {
      const D = this.dados(clue);
      if (id === 'energia' || (id === 'ligar' && st.tela === 'off')) { this.ligar(st, sys); return; }
      if (id === 'pular' && st.tela === 'boot') { st.t = 99; return; }
      if (id === 'entrar') { this.entrar(st, clue, sys); return; }
      if (id === 'desligar') { this.ligar(st, sys); return; }
      if (id === 'iniciar') { st.menu = !st.menu; return; }
      if (id === 'bloquear') { st.mem.logado = false; st.janelas = []; st.arquivo = null; this.ir(st, D.senha ? 'login' : 'desk'); salvar(sys); return; }
      if (st.menu && id !== 'iniciar') st.menu = false;
      if (id === 'pasta') { st.sel = info?.data ?? 0; st.col = 0; if (pelesTerminal(clue.data) === 'moderno' || pelesTerminal(clue.data) === 'notebook') this.abrirPasta(st, sys, D.pastas[st.sel]); else { st.selArq = 0; som(sys, 'tecla'); } return; }
      if (id === 'arquivo') {
        const pasta = st.janelas.find(j => j.tipo === 'pasta')?.pasta ?? D.pastas[st.sel];
        const dentro = D.arquivos.filter(a => a.pasta === pasta);
        st.selArq = info?.data ?? 0; st.col = 1;
        if (!st.janelas.length) st.janelas = [{tipo: 'pasta', pasta}];
        this.abrirArquivo(st, clue, sys, dentro[st.selArq]);
        return;
      }
      if (id === 'fecharJanela' || id === 'voltar') { this.fecharJanela(st, sys); if (!st.janelas.some(j => j.tipo === 'arquivo')) st.arquivo = null; return; }
      if (id === 'subir') st.scroll = Math.max(0, st.scroll - 1);
      if (id === 'descer') st.scroll = Math.min(st.maxScroll || 0, st.scroll + 1);
    },
    wheel(delta, st) { if (st.arquivo) st.scroll = clamp(st.scroll + Math.sign(delta), 0, st.maxScroll || 0); },
    key(e, st, clue, sys) {
      const k = e.key || '', D = this.dados(clue), texto = pelesTerminal(clue.data) === 'crt' || pelesTerminal(clue.data) === 'caixa';
      if (st.tela === 'off') { if (k === 'Enter') { this.ligar(st, sys); return true; } return false; }
      if (st.tela === 'boot') {
        if (k === 'Enter') { st.t = 99; return true; }
        if (k === 'Backspace') { st.entrada = st.entrada.slice(0, -1); return true; }
        if (k.length === 1 && st.entrada.length < 24) { st.entrada += k; som(sys, 'tecla'); return true; }
        return k !== 'Escape';
      }
      if (st.tela === 'login') {
        if (k === 'Enter') { this.entrar(st, clue, sys); return true; }
        if (k === 'Backspace') { st.entrada = st.entrada.slice(0, -1); som(sys, 'tecla'); return true; }
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && st.entrada.length < 24) { st.entrada += k; st.msg = ''; som(sys, 'tecla'); return true; }
        return k !== 'Escape';
      }
      if (st.tela !== 'desk') return false;
      if (st.arquivo) {
        if (k === 'Escape' || k === 'Backspace') { if (st.glitch <= 0) this.fecharJanela(st, sys); if (!st.janelas.some(j => j.tipo === 'arquivo')) st.arquivo = null; return true; }
        if (k === 'ArrowDown') { st.scroll = Math.min(st.maxScroll || 0, st.scroll + 1); return true; }
        if (k === 'ArrowUp') { st.scroll = Math.max(0, st.scroll - 1); return true; }
        if (k === 'PageDown') { st.scroll = Math.min(st.maxScroll || 0, st.scroll + 8); return true; }
        if (k === 'PageUp') { st.scroll = Math.max(0, st.scroll - 8); return true; }
        return true;
      }
      const pastaAtual = texto ? D.pastas[st.sel] : st.janelas.find(j => j.tipo === 'pasta')?.pasta;
      const dentro = D.arquivos.filter(a => a.pasta === pastaAtual);
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        const dir = k === 'ArrowDown' ? 1 : -1;
        if (st.col === 0 || !dentro.length) { st.sel = clamp(st.sel + dir, 0, D.pastas.length - 1); st.col = 0; if (!texto) this.abrirPasta(st, sys, D.pastas[st.sel]); st.col = 0; }
        else st.selArq = clamp(st.selArq + dir, 0, dentro.length - 1);
        som(sys, 'tecla'); return true;
      }
      if (k === 'ArrowRight' || k === 'Tab') { st.col = dentro.length ? 1 : 0; return true; }
      if (k === 'ArrowLeft') { st.col = 0; return true; }
      if (k === 'Enter') {
        if (st.col === 0) { if (!texto) this.abrirPasta(st, sys, D.pastas[st.sel]); st.col = D.arquivos.some(a => a.pasta === D.pastas[st.sel]) ? 1 : 0; }
        else { if (!st.janelas.length) st.janelas = [{tipo: 'pasta', pasta: pastaAtual}]; this.abrirArquivo(st, clue, sys, dentro[st.selArq]); }
        return true;
      }
      if (k === 'Escape' && !texto) return this.fecharJanela(st, sys);
      return false;
    }
  });

  /* ================================================================ máquina de venda */
  const MAQ_PRODUTOS = {
    refrigerante: 'A1 | Guaraná | 2 | refrigerante\nA2 | Cola | 2 | refrigerante\nA3 | Laranja | 2 | refrigerante\nA4 | Uva | 2 | refrigerante\nB1 | Água | 1 | agua\nB2 | Limão | 2 | refrigerante\nB3 | Água com gás | 1 | agua\nB4 | Guaraná zero | 2 | refrigerante\nC1 | Chocolate | 3 | chocolate\nC2 | Salgadinho | 2 | salgadinho\nC3 | Café gelado | 2 | cafe\nC4 | ??? | 1 |',
    salgadinho: 'A1 | Batata frita | 2 | salgadinho\nA2 | Milho | 2 | salgadinho\nA3 | Amendoim | 1 | salgadinho\nA4 | Torresmo | 2 | salgadinho\nB1 | Chocolate | 3 | chocolate\nB2 | Bala de goma | 1 | chocolate\nB3 | Paçoca | 1 | chocolate\nB4 | Wafer | 2 | chocolate\nC1 | Água | 1 | agua\nC2 | Fusível 10A | 5 | fusivel\nC3 | Pilhas | 3 |\nC4 | Chave perdida | 9 | chave=Chave do porão',
    cafe: '1 | Expresso | 1 | cafe\n2 | Café com leite | 2 | cafe\n3 | Cappuccino | 2 | cafe\n4 | Chocolate quente | 2 | chocolate\n5 | Chá de erva | 1 | agua\n6 | Água quente | 1 | agua'
  };
  const MAQ_TITULOS = {refrigerante: 'GELADINHO', salgadinho: 'BELISCOS', cafe: 'CAFÉ QUENTE'};
  const MAQ_PADRAO = {estilo: 'refrigerante', titulo: '', produtos: MAQ_PRODUTOS.refrigerante, enguica: '25'};
  const MAQ_CORES = {refrigerante: 'vermelho', salgadinho: 'azul', cafe: 'mogno'};
  const MX = 96, MY = 24, VIT = [108, 48, 156, 168], BANDEJA = [108, 224, 156, 36], VISOR = [276, 52, 52, 20], FENDA = [280, 80, 44, 24], TROCO = [280, 200, 32, 14], COPO_TROCO = [304, 226, 24, 22];
  const MAQ_TECLAS = [['A', 'B', 'C'], ['1', '2', '3'], ['D', '4', '<'], ['OK']];
  function tipoProduto(prod) {
    const id = prod.item?.id || '', n = chaveDe(prod.nome);
    if (id === 'agua' || /agua|cha\b/.test(n)) return 'garrafa';
    if (id === 'chocolate' || /chocolate|wafer|pacoca|bala/.test(n)) return 'barra';
    if (id === 'salgadinho' || /batata|milho|amendoim|torresmo|salgad/.test(n)) return 'pacote';
    if (id === 'cafe' || /cafe|cappuccino|leite/.test(n)) return 'copo';
    if (id === 'fusivel') return 'fusivel';
    if (id === 'chave') return 'chave';
    if (id === 'refrigerante' || /refri|cola|guarana|laranja|uva|limao|soda/.test(n)) return 'lata';
    return 'caixa';
  }
  function rampaProduto(prod) {
    const n = chaveDe(prod.nome);
    const mapa = [[/cola/, 'mogno'], [/guarana/, 'verde'], [/laranja|batata/, 'fogo'], [/uva|bala/, 'roxo'], [/limao|erva/, 'folha'], [/agua/, 'agua'], [/milho|amendoim|pacoca/, 'amarelo'], [/chocolate|wafer|cafe|cappuccino/, 'madeira'], [/torresmo/, 'vermelho'], [/leite/, 'papel']];
    for (const [re, r] of mapa) if (re.test(n)) return r;
    return ['vermelho', 'azul', 'verde', 'roxo', 'fogo', 'amarelo', 'rosa', 'agua'][sementeDe(prod.nome) % 8];
  }
  function spriteProduto(tipo, rampa) {
    return U.art(`maq:prod:${tipo}:${rampa}`, 14, 18, b => {
      if (tipo === 'lata') { b.rect(3, 2, 8, 15, rampa, 4); b.vline(10, 2, 16, rampa, 6); b.vline(3, 2, 16, rampa, 2); b.rect(3, 7, 8, 4, 'papel', 7); b.vline(10, 7, 10, 'papel', 7); b.rect(4, 1, 6, 2, 'metal', 5); b.rect(4, 17, 6, 1, 'metal', 3); b.px(6, 8, rampa, 5); }
      else if (tipo === 'garrafa') { b.rect(5, 0, 4, 2, 'azul', 4); b.rect(5, 2, 4, 3, 'agua', 5); b.rect(3, 5, 8, 12, 'agua', 4); b.vline(10, 5, 16, 'agua', 6); b.vline(3, 5, 16, 'agua', 3); b.rect(3, 9, 8, 4, rampa === 'agua' ? 'azul' : rampa, 4); b.px(9, 6, 'papel', 7); }
      else if (tipo === 'barra') { b.rect(1, 5, 12, 9, rampa, 3); b.hline(1, 12, 5, rampa, 5); b.hline(1, 12, 13, rampa, 1); b.rect(1, 5, 3, 9, 'latao', 5); b.rect(5, 8, 6, 3, 'papel', 6); }
      else if (tipo === 'pacote') { b.rect(2, 2, 10, 14, rampa, 4); for (let x = 2; x < 12; x += 2) { b.px(x, 1, rampa, 5); b.px(x + 1, 16, rampa, 3); } b.vline(11, 2, 15, rampa, 6); b.vline(2, 2, 15, rampa, 2); b.ellipse(7, 9, 3, 3, 'amarelo', 6); b.px(6, 8, 'papel', 7); }
      else if (tipo === 'copo') { b.poly([[2, 4], [12, 4], [10.5, 17], [3.5, 17]], 'papel', 6); b.rect(2, 4, 10, 2, 'madeira', 2); b.hline(3, 11, 4, 'madeira', 4); b.rect(4, 10, 6, 3, rampa, 3); b.vline(10, 6, 16, 'papel', 7); }
      else if (tipo === 'fusivel') { b.rect(4, 3, 6, 12, 'papel', 6); b.rect(3, 2, 8, 2, 'metal', 5); b.rect(3, 14, 8, 2, 'metal', 4); b.rect(5, 6, 4, 6, 'vermelho', 4); }
      else if (tipo === 'chave') { b.ellipse(5, 6, 3.5, 3.5, 'latao', 4); b.ellipse(5, 6, 1.5, 1.5, 'carvao', 1); b.line(7, 8, 12, 15, 'latao', 5); b.px(11, 12, 'latao', 3); b.px(9, 13, 'latao', 3); b.rect(1, 12, 5, 4, 'papel', 6); }
      else { b.bevel(2, 4, 10, 12, 'papel', 4, 6, 2); b.text(7, 7, '?', 'vermelho', 3, {font: '3x5', align: 'center'}); }
    });
  }
  function maqCorpo(estilo) {
    return U.art('maq:corpo:' + estilo, 120, 124, b => {
      const R = MAQ_CORES[estilo] || 'vermelho';
      b.rect(0, 0, 120, 120, R, 3);
      b.hline(0, 119, 0, R, 5); b.vline(119, 0, 119, R, 4); b.vline(0, 0, 119, R, 1); b.hline(0, 119, 119, R, 1);
      for (let y = 12; y < 118; y += 4) b.px(118, y, R, 5);
      b.rect(3, 2, 114, 9, 'metal', 2); b.rect(4, 3, 112, 7, 'papel', 6);
      b.inset(5, 11, 80, 87, 'metal', 2, 4, 1);
      b.rect(6, 12, 78, 85, 'carvao', 1);
      b.shadeFn(6, 12, 78, 85, (x, y) => (y < 16 ? 2 : 0) + (x > 76 ? 1 : 0));
      b.inset(5, 99, 80, 20, 'metal', 2, 4, 1); b.rect(6, 100, 78, 18, 'preto', 0);
      b.rect(8, 101, 74, 7, 'metal', 3); b.hline(8, 81, 101, 'metal', 5); b.text(45, 102, 'EMPURRE', 'metal', 1, {font: '3x5', align: 'center'});
      b.inset(88, 13, 30, 106, R, 2, 4, 1);
      b.inset(89, 14, 28, 12, 'preto', 1, 3, 0);
      b.bevel(91, 28, 24, 13, 'metal', 4, 6, 2); b.rect(101, 30, 3, 9, 'preto', 0); b.hline(101, 103, 30, 'metal', 2);
      b.text(103, 43, 'MOEDAS', 'papel', 6, {font: '3x5', align: 'center'});
      b.inset(89, 55, 28, 40, 'metal', 2, 4, 1);
      b.inset(103, 101, 14, 13, 'preto', 0, 2, 0);
      b.rect(0, 120, 120, 4, 'carvao', 1); b.rect(4, 120, 10, 4, 'carvao', 0); b.rect(106, 120, 10, 4, 'carvao', 0);
    });
  }
  function maqFundo() {
    return U.art('maq:fundo', 240, 124, b => {
      for (let y = 0; y < 104; y++) for (let x = 0; x < 240; x++) b.px(x, y, 'azul', y % 20 === 19 ? 0 : 1 + (K.hash2(x >> 3, y >> 2, 6) > .85 ? 1 : 0));
      b.rect(0, 104, 240, 20, 'concreto', 2); for (let x = 0; x < 240; x += 16) b.vline(x, 104, 123, 'concreto', 1); b.hline(0, 239, 104, 'concreto', 4);
      b.bevel(14, 22, 26, 34, 'papel', 5, 7, 3); b.text(27, 26, 'NAO', 'vermelho', 3, {font: '3x5', align: 'center'}); b.text(27, 33, 'CHUTE', 'vermelho', 3, {font: '3x5', align: 'center'}); b.text(27, 40, 'A', 'vermelho', 3, {font: '3x5', align: 'center'}); b.text(27, 47, 'MAQUINA', 'tinta', 2, {font: '3x5', align: 'center'});
      b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 110) / 150, (y - 60) / 90); return d < 1 ? (1 - d) * 1.4 - .4 : -.4 - (d - 1) * 2; });
    });
  }

  Tipos.register('maquina_venda', {
    label: 'Máquina de venda', icon: 'maquina', sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'estilo', label: 'Máquina', kind: 'select', options: [['refrigerante', 'Refrigerantes'], ['salgadinho', 'Salgadinhos e doces'], ['cafe', 'Café']]},
      {id: 'titulo', label: 'Letreiro (vazio = nome da máquina)', kind: 'text'},
      {id: 'produtos', label: 'Produtos: CÓDIGO | NOME | PREÇO em moedas | item (refrigerante, salgadinho, chocolate, agua, cafe, fusivel, chave=Nome; vazio = só narrativa), um por linha', kind: 'textarea', rows: 8},
      {id: 'enguica', label: 'Chance (0 a 100) de o produto enganchar na espiral', kind: 'text'}],
    defaults: {...MAQ_PADRAO},
    estilo: d => (['salgadinho', 'cafe'].includes(chaveDe(d?.estilo)) ? chaveDe(d.estilo) : 'refrigerante'),
    produtos(clue) {
      const d = clue.data || {}, estilo = this.estilo(d);
      const txt = !campo(d.produtos, '') || (d.produtos === MAQ_PADRAO.produtos && estilo !== 'refrigerante') ? MAQ_PRODUTOS[estilo] : d.produtos;
      const lista = parseProdutos(txt, {colunas: estilo === 'cafe' ? 2 : 4, maximo: estilo === 'cafe' ? 8 : 16});
      return lista.length ? lista : parseProdutos(MAQ_PRODUTOS[estilo]);
    },
    create(clue, sys) {
      const mem = memoriaDe(sys, clue);
      mem.credito = inteiro(mem.credito, 0, 0, 999); if (!Array.isArray(mem.bandeja)) mem.bandeja = []; mem.vendas = inteiro(mem.vendas, 0, 0);
      return {mem, t: 0, codigo: '', msg: '', msgT: 0, venda: null, tremor: 0, aperto: null, moedaT: 0, avisouPrevia: false, sacudidas: 0};
    },
    wantsKeys: () => true,
    describe(st) { return {credito: st.mem.credito, codigo: st.codigo, msg: st.msg, vendendo: st.venda ? st.venda.prod.codigo : null, preso: st.mem.preso || null, bandeja: (st.mem.bandeja || []).map(p => p.codigo)}; },
    mensagem(st, msg, t = 1.6) { st.msg = msg; st.msgT = t; },
    posicoes(produtos, estilo) {
      const cols = estilo === 'cafe' ? 2 : 4, usados = new Set(), pos = new Map();
      let linhas = estilo === 'cafe' ? 4 : 3;
      for (const p of produtos) { const m = p.codigo.match(/^([A-D])([1-4])$/); if (m && estilo !== 'cafe') { const l = m[1].charCodeAt(0) - 65, c = +m[2] - 1; if (!usados.has(l * cols + c)) { usados.add(l * cols + c); pos.set(p, [l, c]); linhas = Math.max(linhas, l + 1); } } }
      let livre = 0;
      for (const p of produtos) { if (pos.has(p)) continue; while (usados.has(livre)) livre++; if (livre >= cols * 4) break; usados.add(livre); pos.set(p, [Math.floor(livre / cols), livre % cols]); linhas = Math.max(linhas, Math.floor(livre / cols) + 1); }
      return {pos, cols, linhas: Math.min(4, linhas)};
    },
    moeda(st, clue, sys) {
      apertar(st, 'fenda');
      if (!temEnergia(sys)) { this.mensagem(st, ''); st.tremor = .2; som(sys, 'erro'); avisar(sys, 'SEM ENERGIA', 'a máquina devolve a moeda', 'maquina'); return; }
      if (!temBolsa(sys)) { st.mem.credito++; st.moedaT = .35; som(sys, 'moeda'); if (!st.avisouPrevia) { st.avisouPrevia = true; avisar(sys, 'MODO PRÉVIA', 'sem bolsa: moedas de mentira', 'moeda'); } salvar(sys); return; }
      if (gastarItem(sys, 'moedas', 1)) { st.mem.credito++; st.moedaT = .35; som(sys, 'moeda'); salvar(sys); }
      else { som(sys, 'erro'); avisar(sys, 'SEM MOEDAS', 'não há moedas na bolsa', 'moeda'); }
    },
    tecla(st, clue, sys, k) {
      apertar(st, 'tecla', k);
      if (!temEnergia(sys) || st.venda) return;
      som(sys, 'tecla');
      if (k === '<') { st.codigo = st.codigo.slice(0, -1); return; }
      if (k === 'OK') { this.comprar(st, clue, sys); return; }
      st.codigo = (st.codigo + k).slice(-3); st.msg = '';
    },
    comprar(st, clue, sys) {
      const produtos = this.produtos(clue), prod = acharProduto(produtos, st.codigo);
      if (!prod) { this.mensagem(st, st.codigo ? 'CÓDIGO?' : 'ESCOLHA'); st.codigo = ''; som(sys, 'erro'); return; }
      if (prod.preco > st.mem.credito) { this.mensagem(st, `FALTA ${prod.preco - st.mem.credito}`); som(sys, 'erro'); return; }
      st.mem.credito -= prod.preco;
      const r = aleatorio((sementeDe(clue.id) + st.mem.vendas * 7919) >>> 0);
      st.mem.vendas++;
      const chance = inteiro(clue.data?.enguica, 25, 0, 100) / 100;
      const empurra = st.mem.preso === prod.codigo;
      st.venda = {prod, t: 0, preso: !empurra && r() < chance, empurra};
      st.codigo = '';
      som(sys, 'maquina');
      salvar(sys);
    },
    sacudir(st, clue, sys) {
      st.tremor = .35; som(sys, 'maquina');
      if (!st.mem.preso) return;
      st.sacudidas++;
      const r = aleatorio((sementeDe(clue.id) + st.mem.vendas * 131 + st.sacudidas * 17) >>> 0);
      if (st.sacudidas >= 3 || r() < .4) {
        const prod = this.produtos(clue).find(p => p.codigo === st.mem.preso);
        st.mem.preso = null; st.sacudidas = 0;
        if (prod) st.venda = {prod, t: .9, preso: false, solto: true};
        salvar(sys);
      }
    },
    retirar(st, clue, sys) {
      const itens = st.mem.bandeja.splice(0);
      if (!itens.length) return;
      for (const p of itens) {
        const item = parseItem(p.item);
        if (!item) { avisar(sys, 'PEGOU', p.nome, 'maquina'); continue; }
        const onde = darItem(sys, item.id, item.qtd, item.dados);
        if (onde === 'bolsa') avisar(sys, 'NA BOLSA', p.nome, 'maquina');
        else if (onde === 'chao') avisar(sys, 'NÃO COUBE', `${p.nome} ficou no chão`, 'alerta');
        else avisar(sys, temBolsa(sys) ? 'NÃO DEU PARA PEGAR' : 'PEGOU (PRÉVIA)', temBolsa(sys) ? p.nome : `${p.nome} · sem bolsa, nada foi entregue`, 'maquina');
      }
      som(sys, 'clique'); salvar(sys);
    },
    troco(st, clue, sys) {
      apertar(st, 'troco');
      const n = st.mem.credito;
      if (!n) { som(sys, 'clique'); return; }
      st.mem.credito = 0;
      if (darItem(sys, 'moedas', n)) avisar(sys, 'TROCO', `${n} ${n === 1 ? 'moeda voltou' : 'moedas voltaram'} para a bolsa`, 'moeda');
      else if (!temBolsa(sys)) avisar(sys, 'TROCO (PRÉVIA)', 'sem bolsa: nada foi entregue', 'moeda');
      som(sys, 'moeda'); salvar(sys);
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = clamp(ui.dt || 0, 0, .1), estilo = this.estilo(d), produtos = this.produtos(clue), energia = temEnergia(sys);
      st.t += dt; st.tremor = Math.max(0, st.tremor - dt); st.msgT = Math.max(0, st.msgT - dt); st.moedaT = Math.max(0, st.moedaT - dt); passarAperto(st, dt);
      if (st.msgT <= 0 && st.msg && !['PRESO!', 'RETIRE'].includes(st.msg)) st.msg = '';
      // Venda em andamento: espiral girando, queda, bandeja.
      const v = st.venda;
      if (v) {
        const antes = v.t; v.t += dt;
        if (v.preso && v.t >= .9) { st.mem.preso = v.prod.codigo; st.venda = null; st.sacudidas = 0; this.mensagem(st, 'PRESO!', 99); som(sys, 'erro'); salvar(sys); }
        else if (!v.preso && antes < 1.25 && v.t >= 1.25) {
          som(sys, 'queda_produto');
          st.mem.bandeja.push({codigo: v.prod.codigo, nome: v.prod.nome, item: v.prod.item ? `${v.prod.item.id}${v.prod.item.qtd > 1 ? '*' + v.prod.item.qtd : ''}${v.prod.item.dados?.nome ? '=' + v.prod.item.dados.nome : ''}` : ''});
          if (v.empurra) { const p2 = produtos.find(p => p.codigo === st.mem.preso); if (p2) st.mem.bandeja.push({codigo: p2.codigo, nome: p2.nome, item: p2.item ? p2.item.id : ''}); st.mem.preso = null; }
          this.mensagem(st, 'RETIRE', 2.5); salvar(sys);
        }
        if (st.venda && st.venda.t > 1.5) st.venda = null;
      }
      const ox = st.tremor > 0 ? (Math.floor(st.t * 40) % 2 ? 4 : -4) : 0;
      U.blit(ctx, maqFundo(), 0, 22);
      ui.region('maquina', MX - 8, MY, 256, SH - MY, {cursor: 'default', silent: true});
      ctx.save(); ctx.translate(ox, 0);
      if (energia) brilho(ctx, MX, MY, 240, 240, cor(MAQ_CORES[estilo] === 'mogno' ? 'fogo' : 'agua', 4), .6);
      U.blit(ctx, maqCorpo(estilo), MX, MY);
      // Letreiro.
      const titulo = campo(d.titulo, MAQ_TITULOS[estilo]);
      U.rect(ctx, MX + 8, MY + 6, 224, 14, energia ? cor('amarelo', Math.floor(st.t * 3) % 7 ? 6 : 5) : cor('papel', 3));
      escreve(ctx, cortar(titulo.toUpperCase(), 210), MX + 120, MY + 9, energia ? cor(MAQ_CORES[estilo], 2) : cor('papel', 2), {align: 'center'});
      // Vitrine.
      const [vx, vy, vw, vh] = VIT;
      ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
      const {pos, cols, linhas} = this.posicoes(produtos, estilo), cw = vw / cols, ch = vh / linhas;
      for (let l = 1; l < linhas + 1; l++) { U.rect(ctx, vx, vy + l * ch - 6, vw, 4, cor('metal', 3)); U.rect(ctx, vx, vy + l * ch - 6, vw, 2, cor('metal', 5)); }
      for (const [prod, [l, c]] of pos) {
        const x = vx + c * cw, y = vy + l * ch, vendendo = v && v.prod === prod, preso = st.mem.preso === prod.codigo;
        const tipo = tipoProduto(prod), rampa = rampaProduto(prod), spr = spriteProduto(tipo, rampa);
        if (estilo === 'cafe') {
          const q = ui.region('produto', x + 2, y + 2, cw - 4, ch - 8, {data: prod.codigo});
          U.rect(ctx, x + 3, y + 3, cw - 6, ch - 10, q ? cor('madeira', 4) : cor('madeira', 3)); U.rect(ctx, x + 3, y + 3, cw - 6, 2, cor('madeira', 5));
          U.blit(ctx, spr, x + 5, y + Math.round((ch - 24) / 2), 1);
          const nome = K.wrap(prod.nome, cw - 30).slice(0, 2);
          nome.forEach((l, i) => escreve(ctx, cortar(l, cw - 28), x + 22, y + 7 + i * 9, cor('papel', 7)));
          escreve(ctx, `${prod.codigo} · ${prod.preco}`, x + 22, y + ch - 17, cor('amarelo', 6));
          continue;
        }
        // Espiral.
        const giro = vendendo ? Math.floor(v.t * 10) : 0;
        for (let i = 0; i < 5; i++) U.rect(ctx, snap(x + 6 + ((i * 7 + giro * 2) % 30)), y + ch - 14, 2, 6, cor('metal', i % 2 ? 5 : 3));
        let py = y + ch - 46, px0 = x + (cw - 28) / 2;
        if (vendendo) { if (v.t < .9) py += Math.round(v.t * 6); else { const u = (v.t - .9) / .35; py += 6 + Math.round(u * u * (vh - py + vy)); } }
        if (preso) { py += 6; px0 += Math.floor(st.t * 2) % 2 ? 2 : 0; }
        if (!(vendendo && v.t >= 1.25)) U.blit(ctx, spr, px0, py);
        if (preso) contorno(ctx, '!', x + cw - 10, y + 6, cor('amarelo', 6), cor('vermelho', 1), {scale: 2});
        U.rect(ctx, x + 6, y + ch - 8, 26, 8, cor('preto', 1));
        K.drawText(ctx, prod.codigo, x + 8, y + ch - 7, {font: '3x5', color: cor('papel', 7)});
        K.drawText(ctx, String(prod.preco), x + 30, y + ch - 7, {font: '3x5', color: cor('amarelo', 6), align: 'right'});
        ui.region('produto', x + 2, y + 2, cw - 4, ch - 4, {data: prod.codigo, cursor: 'pointer'});
      }
      if (!energia) U.rect(ctx, vx, vy, vw, vh, 'rgba(4,2,10,.55)');
      else { ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 16; i++) ctx.fillRect(vx + vw - 40 - i * 4, vy + 4 + i * 6, 10, 6); }
      ctx.restore();
      // Bandeja.
      const [bx, by, bw, bh] = BANDEJA, temAlgo = st.mem.bandeja.length > 0;
      if (temAlgo) {
        ctx.save(); ctx.beginPath(); ctx.rect(bx + 2, by + 16, bw - 4, bh - 18); ctx.clip();
        st.mem.bandeja.slice(0, 5).forEach((p, i) => { const pr = produtos.find(q => q.codigo === p.codigo) || {nome: p.nome, item: parseItem(p.item)}; U.blit(ctx, spriteProduto(tipoProduto(pr), rampaProduto(pr)), bx + 16 + i * 28, by + 14 + (i % 2) * 2); });
        ctx.restore();
      }
      const qb = ui.region('bandeja', bx, by, bw, bh, {cursor: temAlgo ? 'pointer' : 'default'});
      if (temAlgo && (qb || Math.floor(st.t * 2) % 2)) U.ants(ctx, bx, by, bw, bh, ui.t);
      // Visor, fenda, teclado, troco.
      const [dx, dy, dw, dh] = VISOR;
      U.rect(ctx, dx, dy, dw, dh, energia ? cor('fosforo', 1) : cor('preto', 1));
      if (energia) {
        const texto = st.msg ? (st.msg === 'PRESO!' || st.msg === 'RETIRE' ? (Math.floor(st.t * 3) % 2 ? st.msg : '') : st.msg) : st.codigo ? st.codigo : `$ ${st.mem.credito}`;
        escreve(ctx, texto, dx + dw / 2, dy + 7, cor('fosforo', 6), {align: 'center'});
      }
      const [fx, fy, fw, fh] = FENDA, qf = ui.region('fenda', fx, fy, fw, fh);
      if (qf) U.outline(ctx, fx, fy, fw, fh, '#ffd18c', 2);
      if (st.moedaT > 0) { const u = 1 - st.moedaT / .35; U.rect(ctx, fx + 16, snap(fy - 12 + u * 16), 12, 4, cor('latao', 5)); }
      MAQ_TECLAS.forEach((linha, r) => linha.forEach((k, c) => {
        const x = 276 + c * 18, y = 132 + r * 16, w = k === 'OK' ? 52 : 16, h = 14;
        const q = ui.region('tecla', x, y, w, h, {data: k}), baixo = apertado(st, 'tecla', k) || (q && ui.mouse.down) ? 2 : 0;
        U.rect(ctx, x, y + 2, w, h, cor('metal', 1));
        U.rect(ctx, x, y + baixo, w, h - 2 + (baixo ? 0 : 0), cor(k === 'OK' ? 'verde' : 'metal', q ? 5 : 4));
        escreve(ctx, k === '<' ? '<' : k, x + w / 2, y + baixo + 3, cor(k === 'OK' ? 'papel' : 'preto', k === 'OK' ? 7 : 1), {align: 'center'});
      }));
      const [tx, ty, tw, th] = TROCO, qt = ui.region('troco', tx, ty, tw, th), bt = apertado(st, 'troco') ? 2 : 0;
      U.rect(ctx, tx, ty + 2, tw, th, cor('metal', 1)); U.rect(ctx, tx, ty + bt, tw, th - 2, cor('metal', qt ? 6 : 5));
      K.drawText(ctx, 'TROCO', tx + tw / 2, ty + bt + 3, {font: '3x5', color: cor('preto', 1), align: 'center'});
      const [cx, cy] = COPO_TROCO;
      if (apertado(st, 'troco') || st.mem.credito === 0 && st.aperto?.id === 'troco') for (let i = 0; i < 3; i++) U.rect(ctx, cx + 4 + i * 5, cy + 12, 4, 4, cor('latao', 5));
      ctx.restore();
      // Painel lateral: bolsa, crédito e o botão de chacoalhar.
      U.frame(ctx, 352, 56, 116, 72, 'escuro');
      ctx.drawImage(U.icon('moeda'), 362, 66, 16, 16);
      escreve(ctx, temBolsa(sys) ? `na bolsa: ${contarItem(sys, 'moedas')}` : 'prévia: grátis', 382, 70, '#ffd18c');
      escreve(ctx, `crédito: ${st.mem.credito}`, 362, 88, '#e8d9f0');
      escreve(ctx, estilo === 'cafe' ? 'moeda · número · OK' : 'moeda · código · OK', 362, 104, '#b8a8c8');
      if (st.mem.preso) {
        const bx2 = 360, by2 = 150, pulso = Math.floor(st.t * 3) % 2;
        ui.button(ctx, 'sacudir', bx2, by2, 100, 24, 'CHACOALHAR', {style: 'roxo'});
        if (pulso) U.outline(ctx, bx2 - 4, by2 - 4, 108, 32, '#ffd18c', 2);
        escreve(ctx, 'o produto enganchou!', 410, 184, '#ffb0a0', {align: 'center'});
      }
      if (!energia) caixaAviso(ctx, MX + 90, 130, 'SEM ENERGIA', 'visor apagado');
      const dica = !energia ? 'sem energia: só dá para chacoalhar' : st.mem.preso ? 'o produto enganchou na espiral: chacoalhe' : temAlgo ? 'clique na bandeja para pegar' : st.mem.credito ? 'digite o código e aperte OK' : 'coloque uma moeda na fenda';
      U.header(ctx, ui, clue.name, dica, 'maquina');
    },
    action(id, st, clue, sys, info) {
      if (id === 'fenda') this.moeda(st, clue, sys);
      else if (id === 'tecla') this.tecla(st, clue, sys, String(info?.data || ''));
      else if (id === 'produto') { if (temEnergia(sys) && !st.venda) { st.codigo = String(info?.data || ''); som(sys, 'tecla'); } }
      else if (id === 'bandeja') this.retirar(st, clue, sys);
      else if (id === 'troco') this.troco(st, clue, sys);
      else if (id === 'sacudir') this.sacudir(st, clue, sys);
    },
    key(e, st, clue, sys) {
      const k = (e.key || '').toUpperCase();
      if (/^[A-D1-9]$/.test(k)) { this.tecla(st, clue, sys, k); return true; }
      if (e.key === 'Enter') { this.tecla(st, clue, sys, 'OK'); return true; }
      if (e.key === 'Backspace') { this.tecla(st, clue, sys, '<'); return true; }
      if (e.key === ' ') { this.sacudir(st, clue, sys); return true; }
      if (k === 'M') { this.moeda(st, clue, sys); return true; }
      return false;
    }
  });

  /* ================================================================ fliperama */
  const FLI_PADRAO = {jogo: 'invasores', titulo: '', preco: '1', recordes: 'ANA | 4200\nJOR | 3170\nCEU | 1987\nZEL | 900\nMIA | 450'};
  const FLI_TITULOS = {invasores: 'CÉU INVASOR', blocos: 'QUEBRA-CÉU'};
  const TELA_FL = {x: 136, y: 60, w: JOGO_W * 2, h: JOGO_H * 2};
  const PAUSADOS = new Map();              // partidas interrompidas ao fechar (só nesta página)
  let teclaSoltaFunciona = false;          // o sistema já mandou keyup alguma vez?
  const SPRITES = {
    inv0: ['..###..|.#####.|##.#.##|#######|.#...#.', '..###..|.#####.|##.#.##|#######|#.#.#.#'],
    inv1: ['.#...#.|#######|##.#.##|#######|#.....#', '.#...#.|#######|##.#.##|#######|.#...#.'],
    inv3: ['.#####.|#######|#.#.#.#|#######|##...##', '.#####.|#######|#.#.#.#|#######|.##.##.'],
    nave: ['....#....|...###...|.#######.|#########|##.###.##'],
    ovni: ['...#####...|.#########.|##.#.#.#.##|###########|.#.#...#.#.']
  };
  const spritePx = (g, nome, quadro, x, y, rampa, nivel) => {
    const linhas = SPRITES[nome][quadro % SPRITES[nome].length].split('|');
    g.fillStyle = cor(rampa, nivel);
    linhas.forEach((l, j) => { for (let i = 0; i < l.length; i++) if (l[i] === '#') g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); });
  };
  const texto3 = (g, str, x, y, rampa, nivel, align = 'left') => letra3(g, str, x, y, rampa, nivel, align);
  const texto5 = (g, str, x, y, rampa, nivel, align = 'left') => {
    const s = String(str), w = K.measure(s), ox = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    g.fillStyle = cor(rampa, nivel); K.glyphs(s, ox, y, '5x7', (gx, gy) => g.fillRect(gx, gy, 1, 1));
  };
  function fundoJogo(tipo) {
    return U.art('fl:fundo:' + tipo, JOGO_W, JOGO_H, b => {
      b.rect(0, 0, JOGO_W, JOGO_H, 'preto', 0);
      for (let y = 0; y < 22; y++) b.dither(0, y, JOGO_W, 1, tipo === 'blocos' ? 'roxo' : 'ceuVermelho', 1, (22 - y) / 26);
      const r = K.rng(tipo === 'blocos' ? 21 : 12);
      for (let i = 0; i < 40; i++) b.px(Math.floor(r() * JOGO_W), 8 + Math.floor(r() * 60), 'papel', r() < .3 ? 5 : 2);
      if (tipo !== 'blocos') for (let x = 0; x < JOGO_W;) { const w = 3 + Math.floor(r() * 5), h = 2 + Math.floor(r() * 4); b.rect(x, JOGO_H - h, w, h, 'carvao', 2); if (h > 2 && r() < .6) b.px(x + 1, JOGO_H - h + 1, 'amarelo', 4); x += w; }
      else { b.vline(0, 7, JOGO_H - 1, 'roxo', 3); b.vline(JOGO_W - 1, 7, JOGO_H - 1, 'roxo', 3); b.hline(0, JOGO_W - 1, 7, 'roxo', 3); }
    });
  }
  function fliGabinete() {
    return U.art('fl:gabinete', 240, 124, b => {
      b.rect(0, 0, 240, 104, 'roxo', 1);
      for (let x = 0; x < 240; x += 24) b.vline(x, 0, 103, 'roxo', 0);
      b.rect(0, 30, 240, 2, 'rosa', 3); b.rect(0, 31, 240, 1, 'rosa', 5);
      for (let y = 104; y < 124; y++) for (let x = 0; x < 240; x++) b.px(x, y, (Math.floor(x / 8) + Math.floor(y / 4)) % 2 ? 'carvao' : 'roxo', (Math.floor(x / 8) + Math.floor(y / 4)) % 2 ? 1 : 2);
      b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 120) / 130, (y - 60) / 80); return d < 1 ? (1 - d) * 1.6 : -(d - 1) * 1.5; });
      // Gabinete.
      b.rect(56, 0, 128, 104, 'carvao', 2);
      b.vline(183, 0, 103, 'carvao', 4); b.vline(56, 0, 103, 'carvao', 1);
      for (let y = 14; y < 100; y += 6) { b.line(57, y, 61, y + 4, 'roxo', 4); b.line(178, y + 3, 182, y + 7, 'roxo', 4); }
      b.rect(58, 0, 124, 13, 'preto', 1); b.rect(60, 1, 120, 11, 'roxo', 2);
      b.rect(62, 14, 116, 89, 'preto', 1); b.inset(64, 16, 112, 86, 'preto', 2, 3, 0);
      b.erase(68, 19, JOGO_W, JOGO_H);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) for (const [x, y] of [[68 + i, 19 + j], [171 - i, 19 + j], [68 + i, 96 - j], [171 - i, 96 - j]]) b.px(x, y, 'preto', 1);
      b.text(120, 98, '1 OU 2 JOGADORES', 'roxo', 4, {font: '3x5', align: 'center'});
      // Painel de controle.
      b.poly([[48, 103], [192, 103], [198, 124], [42, 124]], 'roxo', 3);
      b.hline(48, 191, 103, 'roxo', 5); b.hline(47, 192, 104, 'roxo', 4);
      for (let x = 50; x < 190; x += 12) b.line(x, 108, x + 8, 122, 'roxo', 2);
      b.ellipse(80, 113, 9, 4, 'preto', 1); b.ellipse(80, 112, 7, 3, 'carvao', 3);
      b.text(116, 116, 'START', 'amarelo', 5, {font: '3x5', align: 'center'});
      b.text(150, 116, 'FOGO', 'vermelho', 5, {font: '3x5', align: 'center'});
      b.bevel(173, 105, 14, 16, 'metal', 4, 6, 2); b.rect(179, 107, 2, 8, 'preto', 0); b.text(180, 116, '$', 'amarelo', 6, {font: '3x5', align: 'center'});
    });
  }

  Tipos.register('fliperama', {
    label: 'Fliperama', icon: 'fliperama', sound: 'arcade', categoria: 'interacao',
    fields: [
      {id: 'jogo', label: 'Jogo', kind: 'select', options: [['invasores', 'Céu Invasor (nave contra ondas que descem do céu)'], ['blocos', 'Quebra-blocos (raquete e bolinha)']]},
      {id: 'titulo', label: 'Título no letreiro (vazio = nome do jogo)', kind: 'text'},
      {id: 'preco', label: 'Moedas por ficha (0 = jogo livre)', kind: 'text'},
      {id: 'recordes', label: 'Recordes da casa: NOME | PONTOS, um por linha (até 5)', kind: 'textarea', rows: 5}],
    defaults: {...FLI_PADRAO},
    jogoDe: d => (chaveDe(d?.jogo) === 'blocos' ? 'blocos' : 'invasores'),
    create(clue, sys) {
      const mem = memoriaDe(sys, clue);
      mem.fichas = inteiro(mem.fichas, 0, 0, 99); if (!Array.isArray(mem.recordes)) mem.recordes = [];
      const st = {mem, tela: 'titulo', t: 0, telaT: 0, jogo: null, teclas: {esq: 0, dir: 0, fogo: 0}, nome: ['A', 'A', 'A'], cursor: 0, ultimo: null, aviso: 0, aperto: null};
      const pausado = PAUSADOS.get(clue.id);
      if (pausado && Date.now() - pausado.quando < 30 * 60 * 1000 && pausado.jogo.tipo === this.jogoDe(clue.data)) { st.jogo = pausado.jogo; st.tela = 'pausa'; }
      PAUSADOS.delete(clue.id);
      return st;
    },
    wantsKeys: st => st.tela !== 'desligado',
    describe(st) { return {tela: st.tela, fichas: st.mem.fichas, pontos: st.jogo?.pontos ?? 0, vidas: st.jogo?.vidas ?? 0, onda: st.jogo?.onda ?? 0, nome: st.nome.join(''), teclas: {...st.teclas}}; },
    ir(st, tela) { st.tela = tela; st.telaT = 0; },
    preco: clue => inteiro(clue.data?.preco, 1, 0, 99),
    tabela(clue, st) { return tabelaRecordes(parseRecordes(campo(clue.data?.recordes, FLI_PADRAO.recordes)), st.mem.recordes); },
    ficha(st, clue, sys) {
      apertar(st, 'fl_ficha');
      if (!temEnergia(sys)) { som(sys, 'erro'); return; }
      const preco = this.preco(clue);
      if (preco === 0) { som(sys, 'clique'); st.aviso = 1.2; return; }
      if (!temBolsa(sys)) { st.mem.fichas++; som(sys, 'moeda'); avisar(sys, 'MODO PRÉVIA', 'sem bolsa: ficha de mentira', 'moeda'); salvar(sys); return; }
      if (gastarItem(sys, 'moedas', preco)) { st.mem.fichas++; som(sys, 'moeda'); salvar(sys); }
      else { som(sys, 'erro'); avisar(sys, 'SEM MOEDAS', `a ficha custa ${preco} ${preco === 1 ? 'moeda' : 'moedas'}`, 'moeda'); }
    },
    start(st, clue, sys) {
      apertar(st, 'fl_start');
      if (st.tela === 'pausa') { this.ir(st, 'jogo'); som(sys, 'arcade'); return; }
      if (st.tela === 'fim') { this.ir(st, 'titulo'); return; }
      if (st.tela !== 'titulo') return;
      const livre = this.preco(clue) === 0;
      if (!livre && st.mem.fichas <= 0) { st.aviso = 1.4; som(sys, 'erro'); return; }
      if (!livre) st.mem.fichas--;
      st.mem.partidas = inteiro(st.mem.partidas, 0, 0) + 1;
      st.jogo = novoJogo(this.jogoDe(clue.data), (sementeDe(clue.id) + st.mem.partidas * 977) >>> 0);
      st.teclas = {esq: 0, dir: 0, fogo: 0};
      this.ir(st, 'jogo'); som(sys, 'arcade'); salvar(sys);
    },
    terminar(st, clue, sys) {
      const pontos = st.jogo?.pontos || 0;
      if (entraNoRecorde(this.tabela(clue, st), pontos)) { st.nome = ['A', 'A', 'A']; st.cursor = 0; this.ir(st, 'recorde'); som(sys, 'arcade'); }
      else this.ir(st, 'fim');
    },
    salvarRecorde(st, clue, sys) {
      const nome = st.nome.join(''), pontos = st.jogo?.pontos || 0;
      st.mem.recordes = tabelaRecordes([], [...st.mem.recordes, {nome, pontos}]).slice(0, 5);
      st.ultimo = {nome, pontos};
      avisar(sys, 'NOVO RECORDE', `${nome} · ${pontos} pontos`, 'fliperama');
      salvar(sys); this.ir(st, 'titulo'); st.telaT = 5.2;
    },
    segurar(st, direcao, e) {
      const local = !!e && e.target !== null && e.target !== undefined;
      st.teclas[direcao] = local && teclaSoltaFunciona ? .7 : .18;
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = clamp(ui.dt || 0, 0, .1), tipo = this.jogoDe(d), energia = temEnergia(sys), preco = this.preco(clue);
      st.t += dt; st.telaT += dt; st.aviso = Math.max(0, st.aviso - dt); passarAperto(st, dt);
      if (!energia && st.tela !== 'desligado') { if (st.tela === 'jogo') this.ir(st, 'pausa'); st.telaAntes = st.tela; this.ir(st, 'desligado'); }
      if (energia && st.tela === 'desligado') this.ir(st, st.telaAntes === 'pausa' || st.jogo && !st.jogo.fim && st.telaAntes !== 'titulo' ? 'pausa' : 'titulo');
      const segura = id => !!ui.mouse.down && ui.hover === id;
      const ctl = {esq: st.teclas.esq > 0 || segura('fl_esq'), dir: st.teclas.dir > 0 || segura('fl_dir'), fogo: st.teclas.fogo > 0 || segura('fl_fogo'), alvoX: null};
      if (tipo === 'blocos' && segura('fl_tela')) ctl.alvoX = (ui.mouse.x - TELA_FL.x) / 2;
      for (const k of ['esq', 'dir', 'fogo']) st.teclas[k] = Math.max(0, st.teclas[k] - dt);
      if (st.tela === 'jogo' && st.jogo) {
        passoJogo(st.jogo, dt, ctl);
        for (const ev of st.jogo.eventos.splice(0)) som(sys, ev);
        if (st.jogo.fim) this.terminar(st, clue, sys);
      }
      if (st.tela === 'fim' && st.telaT > 3.2) this.ir(st, 'titulo');
      const titulo = campo(d.titulo, FLI_TITULOS[tipo]);
      // Sala e gabinete.
      U.blit(ctx, fliGabinete(), 0, 22);
      ui.region('gabinete', 96, 22, 288, SH - 22, {cursor: 'default', silent: true});
      // Letreiro aceso.
      const acesa = energia && !(Math.floor(st.t * 7) % 23 === 0);
      if (acesa) brilho(ctx, 116, 24, 248, 26, cor('rosa', 5), .5);
      U.rect(ctx, 120, 24, 240, 22, acesa ? cor('roxo', 3) : cor('roxo', 1));
      const tit = K.measure(titulo) * 2 <= 220 ? {s: titulo, e: 2} : {s: cortar(titulo, 226), e: 1};
      contorno(ctx, tit.s, 240, tit.e === 2 ? 28 : 31, acesa ? cor('amarelo', 6) : cor('roxo', 4), acesa ? cor('vermelho', 2) : cor('roxo', 0), {scale: tit.e, align: 'center'});
      // Tela do jogo.
      const s = superficie('fl:tela', JOGO_W, JOGO_H), g = s.g;
      if (st.tela === 'desligado') g.clearRect(0, 0, JOGO_W, JOGO_H), px(g, 0, 0, JOGO_W, JOGO_H, 'preto', 0);
      else this.desenharTela(g, st, clue, tipo, titulo, preco);
      ampliar(ctx, s, TELA_FL.x, TELA_FL.y);
      if (energia) vidro(ctx, TELA_FL.x, TELA_FL.y, TELA_FL.w, TELA_FL.h, {linhas: .22, reflexo: .05, vinheta: 1.2});
      else { telaApagada(ctx, TELA_FL.x, TELA_FL.y, TELA_FL.w, TELA_FL.h); caixaAviso(ctx, 240, 138, 'SEM ENERGIA', 'o fliperama está apagado'); }
      ui.region('fl_tela', TELA_FL.x, TELA_FL.y, TELA_FL.w, TELA_FL.h, {cursor: tipo === 'blocos' && st.tela === 'jogo' ? 'pointer' : 'default', silent: true});
      // Controles na arte: manche, START, FOGO, fenda da ficha.
      const inclina = ctl.esq ? -1 : ctl.dir ? 1 : 0;
      const qE = ui.region('fl_esq', 124, 222, 36, 48, {silent: true}), qD = ui.region('fl_dir', 160, 222, 36, 48, {silent: true});
      for (let i = 0; i < 8; i++) U.rect(ctx, snap(158 + inclina * i * .8), 246 - i * 2, 4, 2, cor('metal', i % 2 ? 5 : 4));
      const bolaX = snap(160 + inclina * 7), bolaY = 226;
      for (let y = -6; y <= 6; y += 2) { const hw = Math.round(Math.sqrt(36 - y * y) / 2) * 2; U.rect(ctx, bolaX - hw, bolaY + y, hw * 2, 2, cor('vermelho', y < -2 ? 6 : 4)); }
      if (qE || qD) { triangulo(ctx, 132, 246, 'esq', 4, qE ? '#ffd18c' : cor('roxo', 5)); triangulo(ctx, 188, 246, 'dir', 4, qD ? '#ffd18c' : cor('roxo', 5)); }
      const botao = (id, cx, cy, r, rampa, pisca) => {
        const q = ui.region(id, cx - r - 4, cy - r - 4, r * 2 + 8, r * 2 + 8, {silent: id !== 'fl_ficha'}), baixo = apertado(st, id) || (q && ui.mouse.down) || (id === 'fl_fogo' && ctl.fogo) ? 2 : 0;
        for (let y = -r; y <= r; y += 2) { const hw = Math.round(Math.sqrt(r * r - y * y) * .6 / 2) * 2 + 2; U.rect(ctx, cx - hw, cy + y + (baixo ? 2 : 0) + 2, hw * 2, 2, cor(rampa, 1)); }
        for (let y = -r; y < r; y += 2) { const hw = Math.round(Math.sqrt(r * r - y * y) * .6 / 2) * 2 + 2; U.rect(ctx, cx - hw, cy + y + baixo, hw * 2, 2, cor(rampa, (pisca ? 6 : 4) + (y < -r / 2 ? 1 : 0) + (q ? 1 : 0))); }
      };
      const podeStart = st.tela === 'pausa' || (st.tela === 'titulo' && (preco === 0 || st.mem.fichas > 0));
      botao('fl_start', 232, 236, 7, 'amarelo', podeStart && Math.floor(st.t * 3) % 2 === 0);
      botao('fl_fogo', 300, 234, 9, 'vermelho', false);
      const qF = ui.region('fl_ficha', 344, 228, 34, 36);
      if (qF || apertado(st, 'fl_ficha')) U.outline(ctx, 344, 230, 32, 34, '#ffd18c', 2);
      // Paredes: recordes e a placa de preço.
      const tabela = this.tabela(clue, st);
      U.rect(ctx, 14, 60, 96, 132, 'rgba(8,2,12,.5)');
      U.blit(ctx, papelArt(46, 64, 'papel', {margem: false}), 10, 56); U.tape(ctx, 40, 50, 36, 12);
      escreve(ctx, 'RECORDES', 56, 66, cor('vermelho', 3), {align: 'center'});
      tabela.forEach((r, i) => {
        const novo = st.ultimo && r.nome === st.ultimo.nome && r.pontos === st.ultimo.pontos;
        escreve(ctx, `${i + 1}. ${r.nome}`, 18, 84 + i * 16, cor(novo ? 'vermelho' : 'tinta', novo ? 3 : 1));
        escreve(ctx, String(r.pontos), 98, 84 + i * 16, cor(novo ? 'vermelho' : 'tinta', novo ? 3 : 2), {align: 'right'});
      });
      U.frame(ctx, 384, 58, 88, 96, 'escuro');
      escreve(ctx, preco === 0 ? 'JOGO LIVRE' : `FICHA: ${preco}`, 428, 66, '#ffd18c', {align: 'center'});
      if (preco) ctx.drawImage(U.icon('moeda'), 420, 78, 16, 16);
      escreve(ctx, temBolsa(sys) ? `bolsa: ${contarItem(sys, 'moedas')}` : 'prévia', 428, 100, '#e8d9f0', {align: 'center'});
      escreve(ctx, `fichas: ${st.mem.fichas}`, 428, 114, st.aviso > 0 && Math.floor(st.t * 8) % 2 ? '#ff9a9a' : '#e8d9f0', {align: 'center'});
      escreve(ctx, preco ? 'clique na fenda' : 'aperte START', 428, 134, '#9d8db0', {align: 'center'});
      U.frame(ctx, 384, 164, 88, 60, 'escuro');
      ['setas: mover', 'espaço: fogo', 'enter: start'].forEach((l, i) => escreve(ctx, l, 428, 172 + i * 14, '#c9b8d8', {align: 'center'}));
      const dicas = {titulo: preco && !st.mem.fichas ? 'coloque uma ficha e aperte START' : 'aperte START', jogo: 'setas movem · espaço atira · Enter pausa', pausa: 'pausado · START continua', recorde: 'digite 3 letras e aperte Enter', fim: 'fim de jogo', desligado: 'sem energia'};
      U.header(ctx, ui, clue.name, dicas[st.tela] || '', 'fliperama');
    },
    desenharTela(g, st, clue, tipo, titulo, preco) {
      const t = st.t, j = st.jogo;
      g.drawImage(fundoJogo(tipo), 0, 0);
      for (let i = 0; i < 6; i++) if (Math.floor(t * 2 + i * 1.7) % 5 === 0) px(g, (i * 37) % JOGO_W, 10 + (i * 23) % 50, 1, 1, 'papel', 7);
      if (st.tela === 'titulo') {
        const modo = Math.floor(st.telaT / 5) % 2;
        if (modo === 0) {
          const w = K.measure(titulo);
          if (w <= JOGO_W - 4) { texto5(g, titulo, JOGO_W / 2 + 1, 12, 'vermelho', 2, 'center'); texto5(g, titulo, JOGO_W / 2, 11, 'amarelo', 6, 'center'); }
          else K.wrap(titulo, JOGO_W - 6).slice(0, 2).forEach((l, i) => texto5(g, l, JOGO_W / 2, 6 + i * 10, 'amarelo', 6, 'center'));
          if (tipo === 'invasores') ['inv0', 'inv1', 'inv3'].forEach((n, i) => spritePx(g, n, Math.floor(t * 2), 30 + i * 18, 28 + (Math.floor(t * 2 + i) % 2), ['rosa', 'roxo', 'fogo'][i], 5));
          else { ['vermelho', 'fogo', 'amarelo', 'folha', 'agua'].forEach((r, i) => px(g, 20 + i * 13, 28, 11, 4, r, 5)); px(g, 42, 44, 18, 3, 'ceu', 6); px(g, 50 + Math.round(Math.sin(t * 3) * 10), 36 - Math.abs(Math.round(Math.cos(t * 3) * 5)), 2, 2, 'papel', 7); }
          const pisca = Math.floor(t * 2.2) % 2 === 0 || st.aviso > 0 && Math.floor(t * 8) % 2;
          const msg = preco === 0 ? 'APERTE START' : st.mem.fichas > 0 ? 'APERTE START' : 'INSIRA FICHA';
          if (pisca) texto5(g, msg, JOGO_W / 2, 49, st.aviso > 0 ? 'vermelho' : 'papel', st.aviso > 0 ? 5 : 7, 'center');
          texto3(g, preco === 0 ? 'JOGO LIVRE' : `FICHAS ${st.mem.fichas}`, JOGO_W / 2, 68, 'agua', 5, 'center');
        } else {
          texto3(g, 'RECORDES', JOGO_W / 2, 6, 'amarelo', 6, 'center');
          this.tabela(clue, st).forEach((r, i) => {
            const novo = st.ultimo && r.nome === st.ultimo.nome && r.pontos === st.ultimo.pontos, rampa = novo && Math.floor(t * 4) % 2 ? 'amarelo' : ['vermelho', 'fogo', 'amarelo', 'folha', 'agua'][i];
            texto3(g, `${i + 1}`, 18, 18 + i * 10, rampa, 5); texto3(g, r.nome, 30, 18 + i * 10, rampa, 6); texto3(g, String(r.pontos), 86, 18 + i * 10, rampa, 6, 'right');
          });
        }
        return;
      }
      if (!j) return;
      // Partida.
      if (j.tipo === 'invasores') {
        for (const s of j.escudos) for (let k = 0; k < 60; k++) if (s.px[k]) px(g, s.x + (k % 12), s.y + Math.floor(k / 12), 1, 1, 'papel', Math.floor(k / 12) > 2 ? 5 : 7);
        const f = j.form;
        for (const e of j.inimigos) if (e.vivo) spritePx(g, e.l === 0 ? 'inv0' : e.l === 3 ? 'inv3' : 'inv1', f.quadro, f.x + e.c * INV.cw, f.y + e.l * INV.ch, ['rosa', 'roxo', 'roxo', 'fogo'][e.l], e.l === 0 ? 6 : 5);
        if (j.ovni) spritePx(g, 'ovni', 0, j.ovni.x, 9, 'vermelho', 5);
        if (j.nave.morta <= 0 && !(j.nave.invencivel > 0 && Math.floor(t * 12) % 2)) spritePx(g, 'nave', 0, j.nave.x, INV.naveY, 'agua', 6);
        if (j.tiro) px(g, j.tiro.x, j.tiro.y, 1, 3, 'amarelo', 7);
        for (const b of j.tirosInimigos) { px(g, b.x, b.y, 1, 1, 'vermelho', 6); px(g, b.x + (Math.floor(t * 12) % 2 ? 1 : -1), b.y + 1, 1, 1, 'vermelho', 6); px(g, b.x, b.y + 2, 1, 1, 'vermelho', 6); }
      } else {
        for (const b of j.blocos) {
          const [bx, by, bw, bh] = retanguloBloco(b), rampa = b.vida > 1 ? 'metal' : ['vermelho', 'fogo', 'amarelo', 'folha', 'agua'][b.l];
          px(g, bx, by, bw, bh, rampa, 4); px(g, bx, by, bw, 1, rampa, 6); px(g, bx, by + bh - 1, bw, 1, rampa, 2);
          if (b.vida > 1) px(g, bx + 4, by + 1, 3, 1, 'metal', 2);
        }
        px(g, j.raquete.x, BLO.raqY, BLO.raqW, 3, 'ceu', 6); px(g, j.raquete.x, BLO.raqY, 2, 3, 'vermelho', 5); px(g, j.raquete.x + BLO.raqW - 2, BLO.raqY, 2, 3, 'vermelho', 5); px(g, j.raquete.x + 2, BLO.raqY + 2, BLO.raqW - 4, 1, 'ceu', 4);
        if (j.bola.y < JOGO_H) px(g, j.bola.x, j.bola.y, 2, 2, 'papel', 7);
        if (j.bola.presa && j.vidas > 0 && Math.floor(t * 2) % 2) texto3(g, 'ESPACO LANCA', JOGO_W / 2, 58, 'papel', 6, 'center');
      }
      for (const p of j.particulas) {
        const u = 1 - p.t / p.dur;
        if (p.tipo === 'pontos') { texto3(g, String(p.valor), p.x, Math.round(p.y - u * 6), 'amarelo', 6, 'center'); continue; }
        const r = Math.round(1 + u * (p.tipo === 'nave' ? 6 : 3)), rampa = p.tipo === 'bloco' ? ['vermelho', 'fogo', 'amarelo', 'folha', 'agua'][p.l || 0] : 'fogo';
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; px(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1, 1, rampa, u < .5 ? 6 : 4); }
      }
      // Placar.
      px(g, 0, 0, JOGO_W, 7, 'preto', 0);
      texto3(g, String(j.pontos).padStart(5, '0'), 2, 1, 'papel', 7);
      texto3(g, `${j.tipo === 'blocos' ? 'NIV' : 'ONDA'} ${j.onda}`, JOGO_W / 2 + 4, 1, 'agua', 5, 'center');
      for (let i = 0; i < Math.max(0, j.vidas); i++) { if (j.tipo === 'invasores') spritePx(g, 'nave', 0, JOGO_W - 11 - i * 10, 1, 'agua', 5); else px(g, JOGO_W - 8 - i * 7, 3, 5, 2, 'ceu', 6); }
      if (j.aviso) texto5(g, j.aviso.texto, JOGO_W / 2, 34, 'amarelo', 6, 'center');
      if (st.tela === 'pausa') { px(g, 18, 28, JOGO_W - 36, 22, 'preto', 1); texto5(g, 'PAUSA', JOGO_W / 2, 31, 'amarelo', 6, 'center'); if (Math.floor(t * 2) % 2) texto3(g, 'APERTE START', JOGO_W / 2, 42, 'papel', 6, 'center'); }
      if (st.tela === 'fim') { px(g, 14, 24, JOGO_W - 28, 28, 'preto', 1); texto5(g, 'FIM DE JOGO', JOGO_W / 2, 28, 'vermelho', 5, 'center'); texto3(g, `${j.pontos} PONTOS`, JOGO_W / 2, 42, 'papel', 7, 'center'); }
      if (st.tela === 'recorde') {
        px(g, 6, 14, JOGO_W - 12, 54, 'preto', 1); px(g, 6, 14, JOGO_W - 12, 1, 'amarelo', 5);
        texto3(g, 'NOVO RECORDE!', JOGO_W / 2, 18, Math.floor(t * 4) % 2 ? 'amarelo' : 'fogo', 6, 'center');
        texto3(g, `${j.pontos} PONTOS`, JOGO_W / 2, 26, 'papel', 7, 'center');
        st.nome.forEach((ch, i) => {
          const x = JOGO_W / 2 - 16 + i * 12;
          texto5(g, ch, x + 3, 36, i === st.cursor ? 'amarelo' : 'papel', i === st.cursor ? 6 : 7, 'center');
          if (i === st.cursor && Math.floor(t * 3) % 2) px(g, x - 1, 45, 8, 1, 'amarelo', 6);
        });
        texto3(g, 'SETAS E ENTER', JOGO_W / 2, 52, 'agua', 5, 'center');
      }
    },
    letra(st, delta) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', i = A.indexOf(st.nome[st.cursor]); st.nome[st.cursor] = A[(i + delta + A.length) % A.length]; },
    action(id, st, clue, sys, info) {
      if (id === 'fl_ficha') { this.ficha(st, clue, sys); return; }
      if (id === 'fl_start') { if (st.tela === 'recorde') this.salvarRecorde(st, clue, sys); else this.start(st, clue, sys); return; }
      if (st.tela === 'recorde') {
        if (id === 'fl_esq') st.cursor = Math.max(0, st.cursor - 1);
        else if (id === 'fl_dir') st.cursor = Math.min(2, st.cursor + 1);
        else if (id === 'fl_fogo' || id === 'fl_tela') this.letra(st, 1);
        som(sys, 'tecla'); return;
      }
      if (id === 'fl_fogo') { apertar(st, 'fl_fogo'); if (st.tela === 'jogo') st.teclas.fogo = Math.max(st.teclas.fogo, .12); else if (st.tela === 'titulo' || st.tela === 'pausa') this.start(st, clue, sys); }
      if (id === 'fl_esq' && st.tela === 'jogo') st.teclas.esq = Math.max(st.teclas.esq, .12);
      if (id === 'fl_dir' && st.tela === 'jogo') st.teclas.dir = Math.max(st.teclas.dir, .12);
    },
    key(e, st, clue, sys) {
      const k = e.key || '', low = k.length === 1 ? k.toLowerCase() : k, code = e.code || '';
      if (st.tela === 'desligado') return false;
      if (st.tela === 'recorde') {
        if (/^[a-z0-9]$/i.test(k)) { st.nome[st.cursor] = semAcento(k).toUpperCase(); st.cursor = Math.min(2, st.cursor + 1); som(sys, 'tecla'); return true; }
        if (k === 'ArrowUp') { this.letra(st, 1); return true; }
        if (k === 'ArrowDown') { this.letra(st, -1); return true; }
        if (k === 'ArrowLeft' || k === 'Backspace') { st.cursor = Math.max(0, st.cursor - 1); return true; }
        if (k === 'ArrowRight') { st.cursor = Math.min(2, st.cursor + 1); return true; }
        if (k === 'Enter') { this.salvarRecorde(st, clue, sys); return true; }
        return k !== 'Escape';
      }
      const esq = k === 'ArrowLeft' || low === 'a' || code === 'KeyA', dir = k === 'ArrowRight' || low === 'd' || code === 'KeyD';
      const fogo = k === ' ' || k === 'Spacebar' || code === 'Space' || k === 'ArrowUp' || low === 'w' || code === 'KeyW';
      if (st.tela === 'jogo') {
        if (esq) { this.segurar(st, 'esq', e); st.teclas.dir = 0; return true; }
        if (dir) { this.segurar(st, 'dir', e); st.teclas.esq = 0; return true; }
        if (fogo) { this.segurar(st, 'fogo', e); return true; }
        if (k === 'Enter' || low === 'p') { this.ir(st, 'pausa'); return true; }
        if (k === 'ArrowDown') return true;
        return k !== 'Escape';
      }
      if (k === 'Enter' || fogo) { this.start(st, clue, sys); return true; }
      if (low === 'm' || k === '5') { this.ficha(st, clue, sys); return true; }
      if (esq || dir || k === 'ArrowDown') return true;
      return false;
    },
    keyup(e, st) {
      teclaSoltaFunciona = true;
      const k = e?.key || '', low = k.length === 1 ? k.toLowerCase() : k, code = e?.code || '';
      if (k === 'ArrowLeft' || low === 'a' || code === 'KeyA') st.teclas.esq = 0;
      if (k === 'ArrowRight' || low === 'd' || code === 'KeyD') st.teclas.dir = 0;
      if (k === ' ' || code === 'Space' || k === 'ArrowUp' || low === 'w' || code === 'KeyW') st.teclas.fogo = 0;
      return true;
    },
    onClose(st, clue) { if ((st.tela === 'jogo' || st.tela === 'pausa') && st.jogo && !st.jogo.fim) PAUSADOS.set(clue.id, {jogo: st.jogo, quando: Date.now()}); }
  });

  /* ================================================================ quadro de energia */
  const PAINEL_PADRAO = {dificuldade: 'medio', item: '', aviso: 'PERIGO · ALTA TENSÃO', circuitos: 'Luzes, Tomadas, Corredor, Elevador, Bomba, Portaria'};
  const DJ = {x0: 160, y: 142, w: 36, h: 70, gap: 6};
  const DICAS_PAINEL = {facil: 'Ligue todos os disjuntores e o geral.', medio: 'Cada disjuntor vira também os vizinhos.', dificil: 'Vira os vizinhos. Espere o ponteiro baixar!'};
  function painelFundo() {
    return U.art('painel:fundo', 240, 124, b => {
      for (let y = 0; y < 124; y++) for (let x = 0; x < 240; x++) b.px(x, y, 'concreto', y % 16 === 15 || (x + (Math.floor(y / 16) % 2) * 12) % 24 === 0 ? 1 : 2);
      b.speckle(0, 0, 240, 124, 'concreto', 3, .04, K.rng(5));
      b.rect(0, 8, 240, 3, 'metal', 3); b.hline(0, 239, 8, 'metal', 5); b.rect(226, 0, 3, 124, 'metal', 3); b.vline(228, 0, 123, 'metal', 5);
      for (const x of [40, 120, 200]) b.rect(x, 7, 4, 5, 'metal', 2);
      b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 150) / 150, (y - 50) / 100); return d < 1 ? (1 - d) * 1.2 - .5 : -.5 - (d - 1) * 2; });
    });
  }
  function painelCaixa(temItem) {
    return U.art('painel:caixa:' + temItem, 240, 124, b => {
      // Caixa aberta.
      b.rect(66, 3, 150, 118, 'metal', 1);
      b.bevel(66, 3, 146, 117, 'metal', 3, 5, 1);
      b.inset(72, 9, 134, 105, 'metal', 2, 4, 1);
      b.rect(73, 10, 132, 103, 'metal', 3);
      for (let y = 12; y < 112; y += 3) b.hline(74, 204, y, 'metal', 4);
      // Trilho dos disjuntores e régua de nomes.
      b.rect(76, 68, 126, 3, 'metal', 5); b.rect(76, 71, 126, 1, 'metal', 1);
      b.rect(76, 106, 126, 6, 'papel', 6); b.hline(76, 201, 106, 'papel', 7); b.hline(76, 201, 111, 'papel', 3);
      // Geral.
      b.bevel(78, 25, 28, 36, 'carvao', 3, 5, 1); b.text(92, 19, 'GERAL', 'papel', 7, {font: '3x5', align: 'center'});
      b.rect(86, 30, 12, 26, 'preto', 0);
      // Soquete do fusível ou lâmpada de rede.
      if (temItem) { b.bevel(114, 26, 24, 32, 'papel', 5, 7, 3); b.ellipse(126, 42, 8, 11, 'papel', 3); b.ellipse(126, 42, 6, 9, 'preto', 1); b.rect(124, 30, 4, 3, 'latao', 5); b.rect(124, 51, 4, 3, 'latao', 5); b.text(126, 19, 'FUSIVEL', 'papel', 7, {font: '3x5', align: 'center'}); }
      else { b.ellipse(126, 40, 9, 9, 'metal', 1); b.ellipse(126, 40, 7, 7, 'metal', 2); b.text(126, 19, 'REDE', 'papel', 7, {font: '3x5', align: 'center'}); }
      // Mostrador.
      b.bevel(146, 16, 54, 44, 'carvao', 2, 4, 1); b.rect(149, 19, 48, 38, 'papel', 7);
      for (let a = 0; a <= 12; a++) { const u = Math.PI + a / 12 * Math.PI, r0 = a % 3 ? 17 : 15; for (let r = r0; r <= 19; r++) b.px(173 + Math.cos(u) * r, 50 + Math.sin(u) * r, 'tinta', a % 3 ? 3 : 1); }
      // Porta aberta à esquerda, com o aviso.
      b.poly([[64, 3], [10, 12], [10, 114], [64, 121]], 'metal', 3);
      b.line(64, 3, 10, 12, 'metal', 5); b.line(10, 12, 10, 114, 'metal', 4); b.line(10, 114, 64, 121, 'metal', 1);
      b.poly([[60, 8], [15, 16], [15, 110], [60, 116]], 'metal', 2);
      for (const y of [18, 100]) { b.rect(62, y, 5, 10, 'metal', 5); b.px(64, y + 2, 'metal', 7); }
      b.poly([[37, 22], [51, 46], [23, 46]], 'amarelo', 5); b.poly([[37, 26], [48, 44], [26, 44]], 'amarelo', 4);
      b.poly([[38, 29], [33, 38], [37, 38], [35, 43], [41, 35], [37, 35], [39, 29]], 'preto', 1);
      b.rect(19, 54, 38, 46, 'papel', 6); b.hline(19, 56, 54, 'papel', 7); b.hline(19, 56, 99, 'papel', 3);
    });
  }
  const circuitosDe = d => { const nomes = String(campo(d?.circuitos, PAINEL_PADRAO.circuitos)).split(/[,;\n]/).map(s => s.trim()).filter(Boolean); const base = PAINEL_PADRAO.circuitos.split(',').map(s => s.trim()); return Array.from({length: N_DISJUNTORES}, (_, i) => nomes[i] || base[i]); };

  Tipos.register('painel_eletrico', {
    label: 'Quadro de energia', icon: 'raio', sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'dificuldade', label: 'Dificuldade', kind: 'select', options: [['facil', 'Fácil: cada alavanca é independente'], ['medio', 'Médio: cada disjuntor inverte os vizinhos'], ['dificil', 'Difícil: vizinhos + carga máxima (ligar rápido demais desarma tudo)']]},
      {id: 'item', label: 'Item exigido para religar (ex.: fusivel; vazio = nenhum)', kind: 'text'},
      {id: 'aviso', label: 'Aviso na tampa', kind: 'text'},
      {id: 'circuitos', label: 'Nomes dos 6 circuitos, separados por vírgula', kind: 'text'}],
    defaults: {...PAINEL_PADRAO},
    create(clue, sys) {
      const d = clue.data || {}, mem = memoriaDe(sys, clue), dif = normalizarDificuldade(d.dificuldade), item = parseItem(d.item)?.id || '';
      const energia = estadoCena(sys, mem, 'energia', 'energiaLigada', false);
      if (energia.get()) { mem.disjuntores = Array(N_DISJUNTORES).fill(true); mem.geral = true; mem.resolvido = true; if (item) mem.fusivel = true; }
      else if (!Array.isArray(mem.disjuntores) || mem.disjuntores.length !== N_DISJUNTORES || mem.resolvido || mem.dificuldade !== dif) {
        mem.semente = inteiro(mem.semente, 0, 0) + 1;
        const p = painelInicial({semente: (sementeDe(clue.id) + mem.semente * 101) >>> 0, dificuldade: dif});
        mem.disjuntores = p.disjuntores; mem.geral = true; mem.resolvido = false;
      }
      mem.dificuldade = dif; mem.geral = mem.geral !== false;
      return {mem, energia, t: 0, pico: 0, alavancas: mem.disjuntores.map(v => (v ? 1 : 0)), geralPos: mem.geral ? 1 : 0, ponteiro: 0, faiscas: [], religando: 0, tremor: 0, aviso: 0, aperto: null};
    },
    describe(st) { return {disjuntores: [...st.mem.disjuntores], geral: !!st.mem.geral, fusivel: !!st.mem.fusivel, energia: !!st.energia?.valor, carga: Math.round((cargaBase({disjuntores: st.mem.disjuntores, geral: st.mem.geral}) + st.pico) * 100) / 100, resolvido: !!st.mem.resolvido, dificuldade: st.mem.dificuldade}; },
    faiscar(st, x, y, n = 14) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90; st.faiscas.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: .4 + Math.random() * .3}); } },
    mexer(st, clue, sys, qual) {
      const dif = st.mem.dificuldade, antes = {disjuntores: [...st.mem.disjuntores], geral: !!st.mem.geral};
      const depois = qual === 'geral' ? {...antes, geral: !antes.geral} : {...antes, disjuntores: alternarDisjuntor(antes.disjuntores, qual, dif)};
      st.mem.disjuntores = depois.disjuntores; st.mem.geral = depois.geral;
      som(sys, 'disjuntor');
      if (dif === 'dificil') {
        st.pico = picoDaMudanca(antes, depois, st.pico);
        if (sobrecarga(depois, st.pico)) {
          st.mem.disjuntores = Array(N_DISJUNTORES).fill(false); st.mem.geral = false; st.pico = 0; st.tremor = .5; st.ponteiro = 1.25;
          this.faiscar(st, 348, 90, 26); som(sys, 'faisca'); avisar(sys, 'SOBRECARGA!', 'o quadro desarmou tudo', 'raio');
        }
      }
      this.verificar(st, clue, sys);
      salvar(sys);
    },
    verificar(st, clue, sys) {
      const item = parseItem(clue.data?.item)?.id || '';
      const ok = painelResolvido({disjuntores: st.mem.disjuntores, geral: st.mem.geral}) && (!item || st.mem.fusivel);
      if (ok && !st.energia.get() && st.religando <= 0) { st.religando = .5; this.faiscar(st, 240, 170, 20); som(sys, 'faisca'); }
      if (!ok && st.energia.get()) { st.energia.set(false); st.mem.resolvido = false; st.religando = 0; som(sys, 'desligar'); avisar(sys, 'ENERGIA CORTADA', 'a sala ficou no escuro', 'raio'); }
    },
    fusivel(st, clue, sys) {
      const item = parseItem(clue.data?.item);
      if (!item || st.mem.fusivel) return;
      const nome = item.id === 'fusivel' ? 'fusível' : item.id.replace(/_/g, ' ');
      if (!temBolsa(sys)) { st.mem.fusivel = true; som(sys, 'clique'); avisar(sys, 'ENCAIXADO (PRÉVIA)', `sem bolsa: ${nome} de mentira`, 'raio'); }
      else if (contarItem(sys, item.id) > 0 && gastarItem(sys, item.id, 1)) { st.mem.fusivel = true; som(sys, 'clique'); avisar(sys, 'ENCAIXADO', `o ${nome} entrou no soquete`, 'raio'); }
      else { st.aviso = 1.2; som(sys, 'erro'); avisar(sys, `FALTA UM ${nome.toUpperCase()}`, 'o soquete está vazio', 'alerta'); return; }
      this.verificar(st, clue, sys); salvar(sys);
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = clamp(ui.dt || 0, 0, .1), dif = st.mem.dificuldade, item = parseItem(d.item), nomes = circuitosDe(d);
      st.t += dt; st.tremor = Math.max(0, st.tremor - dt); st.aviso = Math.max(0, st.aviso - dt); passarAperto(st, dt);
      const ligada = st.energia.get(dt);
      if (st.religando > 0) {
        st.religando -= dt;
        if (st.religando <= 0) {
          const ok = painelResolvido({disjuntores: st.mem.disjuntores, geral: st.mem.geral}) && (!item || st.mem.fusivel);
          if (ok) { st.energia.set(true); st.mem.resolvido = true; som(sys, 'energia'); avisar(sys, 'ENERGIA RESTAURADA', 'as luzes voltaram', 'raio'); this.faiscar(st, 126 * 2, 40 * 2 + 22, 12); salvar(sys); }
        }
      }
      if (dif === 'dificil') st.pico = decairPico(st.pico, dt);
      st.mem.disjuntores.forEach((v, i) => { st.alavancas[i] += ((v ? 1 : 0) - st.alavancas[i]) * Math.min(1, dt * 22); });
      st.geralPos += ((st.mem.geral ? 1 : 0) - st.geralPos) * Math.min(1, dt * 18);
      const alvo = dif === 'dificil' ? (cargaBase({disjuntores: st.mem.disjuntores, geral: st.mem.geral}) + st.pico) / 1.25 : ligada ? .75 : 0;
      st.ponteiro += (clamp(alvo, 0, 1.02) - st.ponteiro) * Math.min(1, dt * 8);
      const ox = st.tremor > 0 ? (Math.floor(st.t * 40) % 2 ? 3 : -3) : 0;
      U.blit(ctx, painelFundo(), 0, 22);
      ctx.save(); ctx.translate(ox, 0);
      U.blit(ctx, painelCaixa(!!item), 0, 22);
      ui.region('quadro', 16, 26, 420, 244, {cursor: 'default', silent: true});
      // Aviso na tampa.
      const aviso = campo(d.aviso, PAINEL_PADRAO.aviso);
      K.wrap(aviso, 68).slice(0, 5).forEach((l, i) => escreve(ctx, l, 76, 136 + i * 11, cor('vermelho', 3), {align: 'center'}));
      // Geral.
      const gq = ui.region('geral', 156, 70, 56, 76), gy = snap(126 - st.geralPos * 30);
      U.rect(ctx, 172, 84, 24, 52, cor('preto', 0));
      U.rect(ctx, 174, gy, 20, 18, cor('vermelho', gq ? 5 : 4)); U.rect(ctx, 174, gy, 20, 4, cor('vermelho', 6)); U.rect(ctx, 174, gy + 14, 20, 4, cor('vermelho', 2));
      escreve(ctx, st.mem.geral ? 'LIGA' : 'DESL', 184, 150, cor(st.mem.geral ? 'verde' : 'vermelho', 5), {align: 'center'});
      if (gq) U.outline(ctx, 154, 68, 60, 92, '#ffd18c', 2);
      // Fusível ou lâmpada de rede.
      if (item) {
        const fq = !st.mem.fusivel && ui.region('fusivel', 226, 72, 52, 72);
        if (st.mem.fusivel) { U.rect(ctx, 244, 70, 16, 36, cor('papel', 7)); U.rect(ctx, 244, 70, 16, 6, cor('metal', 5)); U.rect(ctx, 244, 100, 16, 6, cor('metal', 4)); U.rect(ctx, 248, 82, 8, 12, cor('vermelho', ligada ? 5 : 3)); }
        else if (fq || st.aviso > 0 || Math.floor(st.t * 2) % 2) U.ants(ctx, 228, 72, 48, 64, ui.t, st.aviso > 0 ? ['#ff9a9a', '#3a0a12'] : ['#fff1b8', '#2a0d22']);
        if (!st.mem.fusivel) escreve(ctx, 'vazio', 252, 150, cor('amarelo', 6), {align: 'center'});
      } else {
        for (let y = -12; y <= 12; y += 2) { const hw = Math.round(Math.sqrt(144 - y * y) / 2) * 2; U.rect(ctx, 252 - hw, 102 + y, hw * 2, 2, ligada ? cor('verde', y < -4 ? 7 : 5) : cor('vermelho', 1)); }
        if (ligada) brilho(ctx, 240, 90, 24, 24, cor('verde', 5), .7);
      }
      // Mostrador: voltímetro (fácil, médio) ou amperímetro com zona vermelha (difícil).
      if (dif === 'dificil') for (let a = 0; a <= 10; a++) { const u = Math.PI + (1 / 1.25 + a / 10 * (1 - 1 / 1.25)) * Math.PI; U.rect(ctx, snap(346 + Math.cos(u) * 34), snap(122 + Math.sin(u) * 34), 4, 4, cor('vermelho', 4)); }
      const ang = Math.PI + clamp(st.ponteiro, 0, 1.02) * Math.PI + (st.tremor > 0 ? Math.sin(st.t * 60) * .05 : 0);
      for (let r = 0; r < 30; r += 2) U.rect(ctx, snap(346 + Math.cos(ang) * r), snap(122 + Math.sin(ang) * r), 2, 2, cor('vermelho', 3));
      U.rect(ctx, 344, 120, 4, 4, cor('carvao', 1));
      escreve(ctx, dif === 'dificil' ? 'A' : 'V', 346, 100, cor('tinta', 2), {align: 'center'});
      if (dif === 'dificil' && st.ponteiro > .8) escreve(ctx, 'CARGA!', 346, 128, Math.floor(st.t * 8) % 2 ? cor('vermelho', 4) : cor('vermelho', 2), {align: 'center'});
      // Disjuntores.
      for (let i = 0; i < N_DISJUNTORES; i++) {
        const x = DJ.x0 + i * (DJ.w + DJ.gap), y = DJ.y, on = st.mem.disjuntores[i], q = ui.region('disjuntor', x, y - 10, DJ.w, DJ.h + 10, {data: i});
        U.rect(ctx, x + 12, y - 10, 12, 6, on ? cor('verde', 6) : cor('vermelho', Math.floor(st.t * 2 + i) % 3 ? 4 : 3));
        U.rect(ctx, x + 2, y + 2, DJ.w, DJ.h, cor('metal', 1));
        U.rect(ctx, x, y, DJ.w, DJ.h, cor('papel', q ? 7 : 6)); U.rect(ctx, x, y, DJ.w, 2, cor('papel', 7)); U.rect(ctx, x + DJ.w - 2, y, 2, DJ.h, cor('papel', 7)); U.rect(ctx, x, y + DJ.h - 2, DJ.w, 2, cor('papel', 3));
        U.rect(ctx, x + 10, y + 12, 16, 44, cor('preto', 1));
        K.drawText(ctx, 'I', x + 5, y + 14, {font: '3x5', color: cor('tinta', 2)}); K.drawText(ctx, 'O', x + 3, y + 48, {font: '3x5', color: cor('tinta', 2)});
        const ly = snap(y + 38 - st.alavancas[i] * 24);
        U.rect(ctx, x + 11, ly, 14, 16, cor('carvao', q ? 5 : 4)); U.rect(ctx, x + 11, ly, 14, 3, cor('carvao', 6)); U.rect(ctx, x + 11, ly + 13, 14, 3, cor('carvao', 2));
        K.drawText(ctx, String(i + 1), x + 18, y + 60, {font: '3x5', color: cor('tinta', 3), align: 'center'});
        if (q) U.outline(ctx, x - 2, y - 12, DJ.w + 4, DJ.h + 14, '#ffd18c', 2);
        const rot = pequeno(nomes[i]).slice(0, 9);
        K.drawText(ctx, rot, x + DJ.w / 2, 236, {font: '3x5', color: cor('tinta', 1), align: 'center'});
      }
      // Dica do modo.
      U.rect(ctx, 164, 246, 240, 14, cor('amarelo', 5)); U.rect(ctx, 164, 246, 240, 2, cor('amarelo', 6));
      escreve(ctx, DICAS_PAINEL[dif], 284, 249, cor('preto', 1), {align: 'center'});
      ctx.restore();
      // Faíscas.
      st.faiscas = st.faiscas.filter(f => (f.t -= dt) > 0);
      for (const f of st.faiscas) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; U.rect(ctx, snap(f.x), snap(f.y), 2, 2, f.t > .25 ? '#fff6c8' : cor('fogo', 5)); }
      if (ligada && Math.floor(st.t * 10) % 37 === 0) this.faiscar(st, 252, 102, 1);
      // Estado da sala.
      U.frame(ctx, 440 - 12, 30, 48, 58, 'escuro');
      ctx.drawImage(U.icon(ligada ? 'raio' : 'alerta'), 444, 38, 16, 16);
      escreve(ctx, ligada ? 'LUZ' : 'SEM', 452, 60, ligada ? '#b8ffb0' : '#ff9a9a', {align: 'center'});
      escreve(ctx, ligada ? 'OK' : 'LUZ', 452, 71, ligada ? '#b8ffb0' : '#ff9a9a', {align: 'center'});
      const falta = item && !st.mem.fusivel;
      const dica = ligada ? 'energia ligada · desligar o geral corta a luz' : falta ? `encaixe um ${item.id === 'fusivel' ? 'fusível' : item.id} no soquete` : DICAS_PAINEL[dif].toLowerCase();
      U.header(ctx, ui, clue.name, dica, 'raio');
    },
    action(id, st, clue, sys, info) {
      if (st.religando > 0) return;
      if (id === 'disjuntor') this.mexer(st, clue, sys, Number(info?.data) || 0);
      else if (id === 'geral') this.mexer(st, clue, sys, 'geral');
      else if (id === 'fusivel') this.fusivel(st, clue, sys);
    },
    key(e, st, clue, sys) {
      const k = e.key || '';
      if (/^[1-6]$/.test(k)) { if (st.religando <= 0) this.mexer(st, clue, sys, Number(k) - 1); return true; }
      if (k === 'g' || k === 'G' || k === '0') { if (st.religando <= 0) this.mexer(st, clue, sys, 'geral'); return true; }
      if (k === 'f' || k === 'F') { this.fusivel(st, clue, sys); return true; }
      return false;
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);
