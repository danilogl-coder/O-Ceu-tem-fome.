/* Interações de móveis e máquinas — a interface própria de cada coisa.

   Antes, muita coisa emprestava a interface de outra: a prateleira abria um
   armário de portas, a prateleira industrial e o móvel velho abriam uma caixa
   de papelão, a caixa registradora abria um gaveteiro, e copiadora, relógio de
   ponto, leito, monitor, negatoscópio e jukebox só tinham a lupa do `exame`.
   Aqui cada uma ganha o seu close-up, com a sua animação e o que dá para fazer
   nela:

   - estante_movel     estante de livros, prateleira de parede, prateleira
                       industrial, prateleira de garrafas e gôndola de mercado:
                       cada prateleira é revistada por vez, com o que estava
                       ali desarrumando.
   - copiadora         tampa que levanta, varredura verde passando sob o vidro,
                       painel com número de cópias, folha saindo — e atolando.
   - relogio_ponto     cartões nas divisórias, o cartão puxado e lido de perto,
                       a batida com carimbo e hora.
   - caixa_registradora teclas, bobina impressa, gaveta que salta com o tlim,
                       notas e moedas em compartimentos.
   - leito_hospitalar  manivela que levanta a cabeceira, prontuário na grade,
                       colchão e travesseiro revistados, embaixo da cama.
   - monitor_cardiaco  traçado que corre, BPM/SpO2/PA, alarme que pisca e o
                       botão de silenciar.
   - negatoscopio      luz fria que acende piscando, as chapas trocadas no
                       clipe e a lupa que acha o que estava escrito.
   - jukebox           neon, lista de músicas com código, moeda, o braço que
                       pega o disco e o disco girando.

   O que precisa durar entre aberturas fica em sys.memory(clue.id). As regras
   sem desenho (leitura dos campos do mestre) ficam em root.InteracoesMoveis e
   rodam no Node: `document` só é tocado dentro das funções de desenho. */
(function (root) {
  'use strict';

  /* ================================================================ ajudantes puros */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const chave = s => semAcento(s).trim().toLowerCase();
  const sementeDe = s => [...String(s ?? '')].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 7);
  const linhasDe = texto => String(texto ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const partesDe = linha => String(linha).split('|').map(p => p.trim());
  const campo = (valor, padrao) => (typeof valor === 'string' && valor.trim() ? valor.trim() : padrao);
  const inteiro = (valor, padrao, min = -Infinity, max = Infinity) => {
    const m = String(valor ?? '').match(/-?\d+/);
    return m ? clamp(parseInt(m[0], 10), min, max) : padrao;
  };
  const escolha = (valor, lista, padrao) => (lista.includes(chave(valor)) ? chave(valor) : padrao);
  /* Chave única por linha, para a memória (a mesma linha repetida ganha #1, #2…). */
  function comChaves(lista, nomeDe) {
    const vistos = Object.create(null);
    return lista.map((item, i) => {
      const base = chave(nomeDe(item, i)) || '#';
      const n = vistos[base] = (vistos[base] ?? -1) + 1;
      return {...item, key: `${base}#${n}`};
    });
  }
  /* Itens de um trecho "moedas*3, chave=Porão": usa o leitor das interações
     básicas quando ele está carregado (mesmos apelidos), senão um simples. */
  function parseItens(texto) {
    const IB = root.InteracoesBasicas;
    if (IB?.parseItens) return IB.parseItens(texto);
    const out = [], vistos = Object.create(null);
    for (const bruto of String(texto ?? '').split(/[,;\n]/)) {
      let tok = bruto.trim(), nome = null, qtd = 1, m;
      if (!tok) continue;
      const eq = tok.indexOf('=');
      if (eq >= 0) { nome = tok.slice(eq + 1).trim() || null; tok = tok.slice(0, eq).trim(); }
      if ((m = tok.match(/^(.*?)\s*(?:\*|×|\bx)\s*(\d+)$/i))) { tok = m[1]; qtd = Number(m[2]); }
      const id = chave(tok).replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!id) continue;
      const base = id + (nome ? '=' + chave(nome) : '');
      const n = vistos[base] = (vistos[base] ?? -1) + 1;
      out.push({id, qtd: clamp(Math.floor(qtd) || 1, 1, 99), dados: nome ? {nome} : null, key: `${base}#${n}`});
    }
    return out;
  }
  const nomeItem = it => (root.InteracoesBasicas?.nomeItem ? root.InteracoesBasicas.nomeItem(it) : String(it?.id ?? ''));

  /* "Nome | o que tem | itens" — as prateleiras, o que há na cama, na gaveta. */
  function parseCompartimentos(texto) {
    const IB = root.InteracoesBasicas;
    if (IB?.parseCompartimentos) return IB.parseCompartimentos(texto);
    return comChaves(linhasDe(texto).map(l => {
      const p = partesDe(l);
      return {nome: p[0] || '', texto: p.length > 2 ? p.slice(1, -1).join(' | ') : (p[1] || ''), itens: parseItens(p.length > 2 ? p[p.length - 1] : '')};
    }), c => c.nome);
  }

  /* --------------------------------------------------- leitores de cada tipo */
  /* Prateleiras: "Nome | o que tem | itens" (uma por linha). */
  const parsePrateleiras = texto => parseCompartimentos(texto).slice(0, 6);

  /* Cartões de ponto: "Nome | Função | 07:58 entrou, 12:02 saiu | observação" —
     as batidas são todos os "HH:MM" da linha, na ordem. */
  function parseCartoes(texto) {
    return comChaves(linhasDe(texto).slice(0, 12).map((linha, i) => {
      const p = partesDe(linha);
      const nome = p[0] || `FUNCIONÁRIO ${i + 1}`;
      const resto = p.slice(1).join(' | ');
      const batidas = [...resto.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map(m => `${String(+m[1]).padStart(2, '0')}:${m[2]}`).slice(0, 8);
      const semHoras = p.slice(1).filter(s => s && !/^\s*[\d:,\s–-]+$/.test(s) && !/^\d{1,2}:\d{2}/.test(s));
      return {nome: nome.slice(0, 22), funcao: (semHoras[0] || '').slice(0, 26), nota: semHoras.slice(1).join(' · '), batidas};
    }), c => c.nome);
  }
  /* Chapas do negatoscópio: "Rótulo | tipo | o que se vê com a lupa". */
  const TIPOS_CHAPA = ['torax', 'cranio', 'mao', 'perna', 'bacia'];
  const APELIDOS_CHAPA = {peito: 'torax', pulmao: 'torax', costela: 'torax', costelas: 'torax', toraxica: 'torax',
    cabeca: 'cranio', craneo: 'cranio', radiografia: 'torax', punho: 'mao', braco: 'mao', antebraco: 'mao',
    perna: 'perna', joelho: 'perna', tornozelo: 'perna', femur: 'perna', quadril: 'bacia', pelve: 'bacia'};
  function parseChapas(texto) {
    return comChaves(linhasDe(texto).slice(0, 6).map((linha, i) => {
      const p = partesDe(linha);
      let tipo = null, rotulo = p[0] || `CHAPA ${i + 1}`, achado = '';
      for (let k = 1; k < p.length; k++) {
        const c = chave(p[k]);
        if (!tipo && (TIPOS_CHAPA.includes(c) || APELIDOS_CHAPA[c])) tipo = TIPOS_CHAPA.includes(c) ? c : APELIDOS_CHAPA[c];
        else achado = achado ? `${achado} ${p[k]}` : p[k];
      }
      return {rotulo: rotulo.slice(0, 24), tipo: tipo || TIPOS_CHAPA[i % TIPOS_CHAPA.length], achado};
    }), c => c.rotulo);
  }
  /* Músicas da jukebox: "Título | Artista | som do ambiente". */
  function parseMusicas(texto) {
    return comChaves(linhasDe(texto).slice(0, 12).map((linha, i) => {
      const p = partesDe(linha);
      return {titulo: (p[0] || `FAIXA ${i + 1}`).slice(0, 24), artista: (p[1] || '').slice(0, 22), som: chave(p[2] || ''),
        codigo: `${'ABCDEFGH'[Math.floor(i / 2)] || 'A'}${i % 2 + 1}`};
    }), m => m.titulo);
  }
  /* Linhas impressas na bobina da registradora: "Item | 3,50". */
  function parseBobina(texto) {
    return linhasDe(texto).slice(0, 10).map(linha => {
      const p = partesDe(linha);
      return {item: (p[0] || '').slice(0, 18).toUpperCase(), valor: (p[1] || '').slice(0, 8)};
    });
  }
  /* Traçados do monitor: um ciclo de alturas (−1 a 1), amostrado em 60 passos. */
  const RITMOS = {
    normal: {bpm: 78, label: 'SINUSAL'},
    taqui: {bpm: 138, label: 'TAQUICARDIA'},
    bradi: {bpm: 44, label: 'BRADICARDIA'},
    arritmia: {bpm: 96, label: 'ARRITMIA'},
    assistolia: {bpm: 0, label: 'ASSISTOLIA'},
    desligado: {bpm: 0, label: '—'}
  };
  /* Um batimento em 60 amostras: onda P, complexo QRS e onda T. As amostras são
     dadas por índice (e não por fração) para que o pico do R caia exatamente
     num pixel da tela — senão o traçado sai sem bico. */
  function ondaCardiaca(tipo = 'normal') {
    const n = 60, out = new Array(n).fill(0);
    if (tipo === 'assistolia' || tipo === 'desligado') return out;
    const bico = (arr, de, valores) => valores.forEach((v, k) => { if (de + k < n) arr[de + k] = v; });
    for (let i = 6; i <= 12; i++) out[i] = Math.sin((i - 6) / 6 * Math.PI) * .18;          // P
    bico(out, 14, [-.06, -.22, .30, 1, .40, -.30, -.12, -.02]);                            // QRS
    for (let i = 26; i <= 40; i++) out[i] = Math.sin((i - 26) / 14 * Math.PI) * .30;        // T
    if (tipo === 'arritmia') {
      // Uma extrassístole no fim do ciclo: larga, feia e fora do compasso.
      bico(out, 45, [.10, .35, .82, .30, -.34, -.14, -.04]);
      for (let i = 0; i <= 5; i++) out[i] = -.04;
    }
    return out;
  }

  const api = {parsePrateleiras, parseCartoes, parseChapas, parseMusicas, parseBobina, parseCompartimentos, parseItens,
    ondaCardiaca, RITMOS, TIPOS_CHAPA, comChaves, campo, inteiro, escolha, sementeDe};
  root.InteracoesMoveis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  const K = root.PixelKit, U = root.PixelUI, Tipos = root.ClueTypes;
  if (!K || !U || !Tipos || !root.document) return;

  /* ================================================================ desenho comum */
  const {C, SW, SH} = U;
  const snap = U.snap;
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeIO = u => { u = clamp(u, 0, 1); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const toward = (v, alvo, vel, dt) => (v < alvo ? Math.min(alvo, v + vel * dt) : Math.max(alvo, v - vel * dt));
  const TXT = {titulo: '#ffd18c', dica: '#c99cc7', claro: '#ffe6f7', sombra: '#07030a'};
  const CHAO_Y = 244, CENTRO = 240;
  const PAINEL = {x: 246, y: 32, w: 226, h: 220};

  /* Luz em degraus limpos (o mesmo truque das interações básicas). */
  const faixas = v => { const i = Math.floor(v), f = v - i; return i + (f < .38 ? 0 : f > .62 ? 1 : (f - .38) / .24); };
  /* Veios de madeira em blocos, nunca chuvisco. */
  function veios(b, x, y, w, h, ramp, base, seed = 1, forca = 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const n = Math.sin((xx - x) / (6 + seed % 5) + yy * 1.3 + seed) * .9 + K.hash2(xx >> 2, yy, seed) * .9 * forca;
      if (n > 1.3) b.px(xx, yy, ramp, base + 1); else if (n < -1.15) b.px(xx, yy, ramp, base - 1);
    }
  }
  /* Riscos e arranhados de metal velho. */
  function riscos(b, x, y, w, h, ramp, base, seed = 1, n = 10) {
    const R = K.rng(seed);
    for (let i = 0; i < n; i++) {
      const xx = x + Math.floor(R() * w), yy = y + Math.floor(R() * h), l = 2 + Math.floor(R() * 7);
      for (let k = 0; k < l && xx + k < x + w; k++) b.px(xx + k, yy + (R() < .3 ? 1 : 0), ramp, base + (R() < .5 ? 1 : -1));
    }
  }
  /* Contorno escuro de 1 px em volta do que foi pintado. */
  function contorno(b, ramp = 'roxo', level = 0) {
    const W = b.width, H = b.height, cheio = Uint8Array.from(b.ramp, r => (r ? 1 : 0)), id = b.rid(ramp);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (cheio[y * W + x]) continue;
      if ((x > 0 && cheio[y * W + x - 1]) || (x < W - 1 && cheio[y * W + x + 1]) || (y > 0 && cheio[(y - 1) * W + x]) || (y < H - 1 && cheio[(y + 1) * W + x])) b.px(x, y, id, level);
    }
  }
  const cortar = (str, maxW) => {
    let s = String(str ?? '');
    if (K.measure(s) <= maxW) return s;
    while (s.length > 1 && K.measure(s + '…') > maxW) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  };
  /* Sombra de contato no chão, em faixas de 2 px. */
  function sombraChao(ctx, x, y, w, h = 8, alfa = .5) {
    ctx.save(); ctx.globalAlpha = alfa; ctx.fillStyle = '#07030a';
    for (let j = 0; j < h; j += 2) { const r = j / h, dx = Math.round(r * w * .12 / 2) * 2; ctx.fillRect(snap(x + dx), snap(y + j), snap(w - dx * 2), 2); ctx.globalAlpha = alfa * (1 - r); }
    ctx.restore();
  }

  /* ------------------------------------------------------------ fundos */
  /* Cada interface nasce num lugar: a sala, o depósito, o corredor do hospital,
     o salão. São chapas de 240×124 pintadas uma vez e guardadas. */
  const FUNDOS = {
    sala(b, W, H, R) {
      b.rect(0, 0, W, H, 'madeira', 2);
      for (let x = 0; x < W; x += 12) { b.vline(x, 0, H - 1, 'madeira', 1); b.vline(x + 1, 0, H - 1, 'madeira', 3); }
      b.speckle(0, 0, W, H, 'madeira', 3, .03, R);
      b.rect(0, H - 34, W, 6, 'mogno', 3); b.hline(0, W - 1, H - 34, 'mogno', 5); b.hline(0, W - 1, H - 29, 'mogno', 1);
      b.rect(0, H - 28, W, 28, 'mogno', 2); veios(b, 0, H - 28, W, 28, 'mogno', 2, 4);
      for (let x = 3; x < W; x += 29) { b.vline(x, H - 25, H - 5, 'mogno', 1); b.vline(x + 1, H - 25, H - 5, 'mogno', 3); }
    },
    deposito(b, W, H, R) {
      b.rect(0, 0, W, H, 'metal', 2);
      for (let y = 0; y < H; y += 9) b.hline(0, W - 1, y, 'metal', 1);
      for (let y = 0; y < H; y += 9) for (let x = (y / 9 % 2) * 15; x < W; x += 30) b.vline(x, y, Math.min(H - 1, y + 8), 'metal', 1);
      b.speckle(0, 0, W, H, 'metal', 3, .04, R);
      b.speckle(0, 0, W, H, 'ambar', 1, .015, R);
      b.rect(0, H - 16, W, 16, 'carvao', 2); b.hline(0, W - 1, H - 16, 'carvao', 0); b.speckle(0, H - 16, W, 16, 'carvao', 3, .05, R);
      for (let x = 0; x < W; x += 4) b.px(x + (x / 4 % 2), H - 13, 'ambar', 3);
    },
    hospital(b, W, H, R) {
      // Azulejo branco em cima, barrado verde de repartição embaixo.
      b.rect(0, 0, W, H, 'verde', 2);
      b.rect(0, 0, W, H - 46, 'palido', 4);
      for (let y = 0; y < H - 46; y += 15) for (let x = 0; x < W; x += 15) { b.px(x + 1, y + 1, 'palido', 5); b.px(x + 13, y + 13, 'palido', 3); }
      for (let x = 0; x < W; x += 15) b.vline(x, 0, H - 47, 'verde', 3);
      for (let y = 0; y < H - 46; y += 15) b.hline(0, W - 1, y, 'verde', 3);
      b.rect(0, H - 48, W, 4, 'verde', 4); b.hline(0, W - 1, H - 48, 'verde', 5); b.hline(0, W - 1, H - 45, 'verde', 1);
      b.rect(0, H - 44, W, 26, 'verde', 2); b.speckle(0, H - 44, W, 26, 'verde', 3, .03, R);
      for (let x = 0; x < W; x += 15) b.vline(x, H - 44, H - 19, 'verde', 1);
      for (let y = H - 44; y < H - 18; y += 13) b.hline(0, W - 1, y, 'verde', 1);
      // Rodapé e piso de vinílico claro.
      b.rect(0, H - 20, W, 3, 'verde', 1); b.hline(0, W - 1, H - 20, 'verde', 3);
      b.rect(0, H - 17, W, 17, 'palido', 2);
      for (let y = H - 14; y < H; y += 6) b.hline(0, W - 1, y, 'verde', 2);
    },
    salao(b, W, H, R) {
      b.rect(0, 0, W, H, 'roxo', 1);
      for (let x = 0; x < W; x += 8) b.vline(x, 0, H - 26, 'roxo', 2);
      b.speckle(0, 0, W, H - 26, 'roxo', 2, .04, R);
      b.rect(0, H - 28, W, 3, 'latao', 3); b.hline(0, W - 1, H - 28, 'latao', 5);
      for (let y = H - 25; y < H; y += 6) for (let x = ((y - H + 25) / 6 % 2) * 6; x < W; x += 12) { b.rect(x, y, 6, 6, 'carvao', 2); b.rect(x + 6, y, 6, 6, 'papel', 2); }
      b.shadeFn(0, H - 25, W, 25, (x, y) => -(y - H + 25) / 60);
    },
    escritorio(b, W, H, R) {
      b.rect(0, 0, W, H, 'papelVelho', 2);
      b.speckle(0, 0, W, H, 'papelVelho', 3, .04, R);
      b.rect(0, H - 40, W, 3, 'mogno', 4); b.hline(0, W - 1, H - 40, 'mogno', 5);
      b.rect(0, H - 37, W, 37, 'mogno', 2); veios(b, 0, H - 37, W, 37, 'mogno', 2, 7);
      for (let x = 5; x < W; x += 34) { b.vline(x, H - 34, H - 4, 'mogno', 1); b.vline(x + 1, H - 34, H - 4, 'mogno', 3); }
    },
    rua(b, W, H, R) {
      b.rect(0, 0, W, H, 'ceu', 1);
      b.vgrad(0, 0, W, H - 40, 'ceu', 2, 0);
      b.rect(0, H - 44, W, 4, 'sepia', 2); b.hline(0, W - 1, H - 44, 'sepia', 3);
      b.rect(0, H - 40, W, 40, 'carvao', 3); b.speckle(0, H - 40, W, 40, 'carvao', 4, .06, R);
      for (let x = 0; x < W; x += 21) b.vline(x, H - 40, H - 1, 'carvao', 2);
      for (let y = H - 34; y < H; y += 12) b.hline(0, W - 1, y, 'carvao', 2);
    }
  };
  const fundoArt = tipo => U.art('im:fundo:' + tipo, 240, 124, b => {
    const W = 240, H = 124, R = K.rng(sementeDe(tipo));
    (FUNDOS[tipo] || FUNDOS.sala)(b, W, H, R);
    b.shadeFn(0, 0, W, H, (x, y) => faixas((.70 - Math.hypot((x - 132) / 150, (y - 46) / 108)) * 2.2));
  });

  /* ------------------------------------------------------------ ícones 16×16 */
  const ICONES = {
    estante(b) {
      b.rect(1, 1, 14, 14, 'madeira', 2); b.frame(1, 1, 14, 14, 'madeira', 4); b.hline(2, 13, 6, 'madeira', 4); b.hline(2, 13, 11, 'madeira', 4);
      for (const [x, h, r] of [[3, 4, 'vermelho'], [5, 3, 'azul'], [7, 4, 'verde'], [9, 3, 'latao'], [11, 4, 'roxo']]) b.rect(x, 6 - h, 2, h, r, 3);
      for (const [x, h, r] of [[3, 4, 'ambar'], [6, 3, 'agua'], [9, 4, 'vermelho']]) b.rect(x, 11 - h, 2, h, r, 3);
      b.hline(2, 13, 14, 'madeira', 0);
    },
    copiadora(b) {
      b.rect(1, 5, 14, 9, 'palido', 3); b.hline(1, 14, 5, 'palido', 4); b.hline(1, 14, 13, 'palido', 1);
      b.rect(2, 3, 12, 2, 'palido', 2); b.hline(2, 13, 3, 'palido', 4);
      b.rect(3, 4, 10, 1, 'fosforo', 5, K.EMISSIVE);
      b.rect(2, 8, 6, 4, 'papel', 6); b.hline(2, 7, 8, 'papel', 4);
      b.rect(10, 8, 4, 2, 'carvao', 2); b.px(11, 9, 'vermelho', 4); b.px(13, 9, 'verde', 4);
    },
    relogio_ponto(b) {
      b.rect(2, 1, 12, 13, 'metal', 3); b.frame(2, 1, 12, 13, 'metal', 5); b.hline(3, 12, 13, 'metal', 1);
      b.rect(4, 3, 8, 4, 'carvao', 1); b.text(8, 4, '317', 'fosforo', 5, {font: '3x5', align: 'center', flags: K.EMISSIVE});
      b.rect(4, 9, 8, 2, 'carvao', 0); b.rect(5, 9, 6, 2, 'papel', 5);
      b.px(3, 11, 'latao', 4); b.px(12, 11, 'latao', 4);
    },
    registradora(b) {
      b.rect(1, 6, 14, 8, 'latao', 3); b.hline(1, 14, 6, 'latao', 5); b.hline(1, 14, 13, 'latao', 1);
      b.rect(3, 2, 10, 4, 'latao', 4); b.rect(4, 3, 8, 2, 'carvao', 1); b.text(8, 3, '99', 'fosforo', 5, {font: '3x5', align: 'center', flags: K.EMISSIVE});
      for (let x = 2; x < 14; x += 3) { b.px(x, 8, 'papel', 5); b.px(x, 10, 'papel', 4); }
      b.rect(2, 12, 12, 2, 'latao', 5); b.hline(3, 12, 12, 'latao', 6);
    },
    leito(b) {
      b.rect(1, 6, 14, 4, 'palido', 4); b.hline(1, 14, 6, 'palido', 5); b.hline(1, 14, 9, 'palido', 2);
      b.rect(2, 4, 5, 2, 'papel', 6); b.hline(2, 6, 4, 'papel', 7);
      b.vline(1, 3, 13, 'metal', 4); b.vline(14, 5, 13, 'metal', 4);
      b.hline(1, 4, 3, 'metal', 5); b.hline(11, 14, 5, 'metal', 5);
      b.hline(2, 13, 10, 'metal', 2);
    },
    monitor(b) {
      b.rect(1, 2, 14, 10, 'carvao', 2); b.frame(1, 2, 14, 10, 'carvao', 4);
      b.rect(3, 4, 10, 6, 'preto', 0);
      b.hline(3, 5, 8, 'fosforo', 5, K.EMISSIVE); b.px(6, 6, 'fosforo', 5, K.EMISSIVE); b.px(7, 4, 'fosforo', 5, K.EMISSIVE); b.px(8, 9, 'fosforo', 5, K.EMISSIVE); b.hline(9, 12, 8, 'fosforo', 5, K.EMISSIVE);
      b.px(13, 3, 'vermelho', 5, K.EMISSIVE); b.rect(5, 13, 6, 2, 'carvao', 3);
    },
    negatoscopio(b) {
      b.rect(1, 2, 14, 11, 'metal', 4); b.frame(1, 2, 14, 11, 'metal', 2);
      b.rect(3, 4, 10, 7, 'palido', 6, K.EMISSIVE);
      b.ellipse(8, 8, 3, 3.4, 'ceu', 2); b.ellipse(8, 8, 1.6, 2, 'ceu', 1);
      b.vline(8, 5, 10, 'palido', 3); b.px(5, 3, 'metal', 5); b.px(10, 3, 'metal', 5);
    },
    jukebox(b) {
      b.poly([[3, 4], [5, 1], [10, 1], [12, 4], [12, 14], [3, 14]], 'mogno', 3);
      b.poly([[4, 5], [6, 2], [9, 2], [11, 5], [11, 9], [4, 9]], 'rosa', 3, K.EMISSIVE);
      b.ellipse(7.5, 6, 2.6, 2.6, 'carvao', 1); b.ellipse(7.5, 6, .8, .8, 'latao', 5);
      b.rect(4, 10, 8, 3, 'papel', 5); b.hline(5, 10, 11, 'tinta', 2);
      b.px(3, 2, 'rosa', 5, K.EMISSIVE); b.px(12, 2, 'rosa', 5, K.EMISSIVE);
    }
  };
  for (const [nome, pintar] of Object.entries(ICONES)) if (!U.ICONS[nome]) U.ICONS[nome] = pintar;

  /* ------------------------------------------------------------ papel e etiquetas */
  const papelArt = (w, h, seed = 1) => U.art(`im:papel:${w}x${h}:${seed % 5}`, Math.max(6, w), Math.max(6, h), b => {
    const R = K.rng(seed + 3);
    b.rect(0, 0, b.width, b.height, 'papel', 5); b.speckle(0, 0, b.width, b.height, 'papel', 6, .05, R); b.speckle(0, 0, b.width, b.height, 'papel', 4, .02, R);
    b.hline(0, b.width - 1, 0, 'papel', 6); b.vline(b.width - 1, 0, b.height - 1, 'papel', 6);
    b.hline(0, b.width - 1, b.height - 1, 'papel', 2); b.vline(0, 1, b.height - 1, 'papel', 4);
  });
  /* Etiqueta de papel com um nome. */
  function etiqueta(ctx, str, cx, cy, maxW, estado = 'normal') {
    const s = cortar(str, Math.max(10, maxW - 10));
    const tw = K.measure(s), w = snap(tw + 11), h = 14, x = snap(clamp(cx - w / 2, 4, SW - w - 6)), y = snap(cy - h / 2);
    const [fundo, borda, tinta] = {
      normal: [C('papel', 6), C('papel', 2), C('tinta', 1)],
      hover: [C('papel', 7), '#ffd18c', C('tinta', 0)],
      foco: [C('amarelo', 5), C('amarelo', 1), C('tinta', 0)],
      apagado: [C('papel', 3), C('papel', 1), C('tinta', 3)]
    }[estado] || [];
    U.rect(ctx, x + 2, y + 2, w, h, '#07030a88');
    U.rect(ctx, x, y, w, h, fundo);
    U.outline(ctx, x, y, w, h, borda, 1);
    U.rect(ctx, x + 1, y + h - 2, w - 2, 1, estado === 'foco' ? C('amarelo', 3) : C('papel', 4));
    K.drawText(ctx, s, x + Math.floor((w - tw) / 2), y + 4, {color: tinta});
    return {x, y, w, h};
  }

  /* ------------------------------------------------------------ itens */
  const spritesItem = new Map();
  const RESERVA_IM = {
    generico(b) {
      b.rect(2, 5, 12, 9, 'sepia', 4); b.hline(2, 13, 5, 'sepia', 5); b.vline(13, 6, 13, 'sepia', 3); b.hline(2, 13, 13, 'sepia', 2);
      b.poly([[2, 5], [5, 2], [15, 2], [13, 5]], 'sepia', 5);
      b.vline(8, 5, 13, 'vermelho', 3); b.hline(2, 13, 9, 'vermelho', 3); b.px(8, 9, 'vermelho', 5);
    }
  };
  /* O desenho do item na bolsa (ITEM_DEFS, 16 px por quadrado) ou uma caixinha. */
  function spriteItem(id) {
    const def = root.ITEM_DEFS?.[id], k = (def ? 'def:' : 'res:') + id;
    let c = spritesItem.get(k);
    if (c) return c;
    if (def && Array.isArray(def.grid) && def.grid.length) {
      c = root.document.createElement('canvas');
      c.width = Math.max(1, ...def.grid.map(r => r.length)); c.height = def.grid.length;
      const g = c.getContext('2d');
      def.grid.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
          const ch = row[x]; let run = 1;
          while (row[x + run] === ch) run++;
          if (ch !== '.' && def.palette?.[ch]) { g.fillStyle = def.palette[ch]; g.fillRect(x, y, run, 1); }
          x += run;
        }
      });
    } else c = U.art('im:item:generico', 16, 16, b => { RESERVA_IM.generico(b); contorno(b); });
    spritesItem.set(k, c);
    return c;
  }
  /* Entrega um item à bolsa. 'bolsa' | 'chao' (contam como pego) | false | 'sem'. */
  function entregar(sys, it, titulo = 'PEGOU') {
    const nome = nomeItem(it), bolsa = sys.itens;
    if (!bolsa || typeof bolsa.dar !== 'function') { sys.toast(titulo, `${nome} · prévia sem bolsa`, 'alerta'); sys.sfx('erro'); return 'sem'; }
    let r = false;
    try { r = bolsa.dar(it.id, it.qtd, it.dados ? {...it.dados} : null); } catch (erro) { console.error('Bolsa recusou o item:', erro); r = false; }
    if (!r) { sys.toast('BOLSA CHEIA', `${nome} não coube`, 'alerta'); sys.sfx('erro'); return false; }
    if (r === 'chao') { sys.toast('CAIU NO CHÃO', `A bolsa está cheia: ${nome}`, 'alerta'); sys.sfx('objeto'); return 'chao'; }
    sys.toast(titulo, nome, 'bolsa');
    sys.sfx('objeto');
    return 'bolsa';
  }

  /* ------------------------------------------------------------ painel de conteúdo */
  /* O painel de papel à direita: o nome do que foi aberto, o que há dentro e os
     itens para pegar (um clique cada). Usado pela estante, pelo leito, pela
     gaveta da registradora e pela bandeja da copiadora. */
  function painelConteudo(ctx, ui, st, sys, o) {
    const {px, py, w, nome, texto, itens, vazio = 'Nada aqui.', seed = 3, dono = 'item', rodape = 0} = o;
    const corpo = String(texto || '').trim();
    const linhas = corpo ? K.wrap(corpo, w - 34).slice(0, 9) : [];
    // A folha cresce com o que há nela: nada de meio palmo de papel em branco.
    let alt = 28 + (linhas.length ? linhas.length * 12 + 6 : 16);
    const larguras = itens.map(it => { const c = spriteItem(it.id); const s2 = (c.width * 2 <= 34 && c.height * 2 <= 34) ? 2 : 1; return [c, s2, c.width * s2, c.height * s2]; });
    let filas = 0, linhaW = 0, filaH = 0;
    for (const [, , iw, ih] of larguras) {
      if (!filas || linhaW + iw + 8 > w - 22) { filas++; linhaW = 0; filaH = 0; }
      linhaW += iw + 10; filaH = Math.max(filaH, ih);
    }
    if (itens.length) alt += 18 + filas * 38;
    const h = clamp(snap(alt + 12 + rodape), 76, o.h);
    U.rect(ctx, px + 5, py + 5, w, h, '#05020899');
    U.blit(ctx, papelArt(Math.ceil(w / 2), Math.ceil(h / 2), seed), px, py);
    for (const [x, y] of [[px + 6, py + 6], [px + w - 10, py + 6]]) { U.rect(ctx, x, y, 4, 4, C('metal', 4)); U.rect(ctx, x, y, 2, 2, C('metal', 6)); }
    U.text(ctx, cortar(String(nome || '').toUpperCase(), w - 34), px + 12, py + 11, {color: C('tinta', 1), bold: true});
    U.rect(ctx, px + 12, py + 22, w - 24, 1, C('tinta', 3));
    let y = py + 28;
    if (linhas.length) { U.hand(ctx, linhas.join('\n'), px + 13, y, {color: C('tinta', 2), width: w - 26, lineHeight: 12, seed}); y += linhas.length * 12 + 6; }
    else { K.drawText(ctx, vazio, px + 13, y, {color: C('papel', 2)}); y += 16; }
    st.itensRegioes = [];
    if (itens.length) {
      U.rect(ctx, px + 12, y, w - 24, 1, C('papel', 2)); y += 6;
      K.drawText(ctx, 'PARA PEGAR', px + 13, y, {color: C('verde', 2)}); y += 12;
      let x = px + 12;
      for (const it of itens) {
        const [c, , iw, ih] = larguras[itens.indexOf(it)];
        if (x + iw + 8 > px + w - 10) { x = px + 12; y += 38; }
        if (y + ih > py + h - 8) break;
        const tremendo = st.itemShake?.key === it.key && st.itemShake.t > 0;
        const dx = tremendo ? Math.round(Math.sin(st.itemShake.t * 60) * 1.4) * 2 : 0;
        const hot = ui.hover === dono && ui.hoverData === it.key;
        U.rect(ctx, x + dx + 2, y + 2, iw, ih, '#07030a55');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(c, snap(x + dx), snap(y - (hot ? 2 : 0)), iw, ih);
        if (hot) U.ants(ctx, x + dx - 3, y - 5, iw + 6, ih + 6, ui.t);
        st.itensRegioes.push([snap(x + dx) - 4, snap(y) - 4, iw + 8, ih + 8, it.key]);
        x += iw + 10;
      }
    }
    for (const [rx, ry, rw, rh, k] of st.itensRegioes) ui.region(dono, rx, ry, rw, rh, {data: k, silent: true});
    return h;
  }

  /* ------------------------------------------------------------ sons novos */
  /* Os nomes entram na lista do painel do mestre; os embutidos continuam valendo. */
  const SONS = {
    carimbo: ({click, noise, tone}) => { click(240, .05, .3, 0, 'lowpass'); noise({freq: 1800, q: .8, duration: .07, gain: .25}); tone(90, .12, .16, .02, 'triangle'); },
    tlim: ({tone, click}) => { click(2600, .02, .18); tone(2093, .5, .10, .01, 'sine'); tone(3136, .42, .06, .015, 'sine'); tone(1568, .6, .05, .02, 'triangle'); },
    varredura: ({tone, noise}) => { tone(210, .9, .05, 0, 'sawtooth', 320); noise({type: 'bandpass', freq: 900, q: 2, duration: .9, gain: .07, attack: .1}); },
    papel_saindo: ({noise}) => { noise({freq: 2600, q: .6, duration: .34, gain: .13, attack: .05}); noise({freq: 1500, q: .9, duration: .2, gain: .08, when: .16}); },
    atolou: ({noise, tone}) => { noise({freq: 700, q: 1.4, duration: .3, gain: .18}); tone(150, .3, .12, .05, 'square', 90); },
    reator: ({tone, noise, click}) => { for (let i = 0; i < 4; i++) { click(3400, .02, .12, i * .09); noise({freq: 5200, q: .5, duration: .05, gain: .1, when: i * .09}); } tone(120, 1.2, .05, .36, 'sawtooth'); },
    disco: ({click, noise, tone}) => { click(420, .05, .16); noise({freq: 1200, q: 1.2, duration: .28, gain: .12, when: .06}); click(300, .06, .2, .3); tone(64, .5, .1, .32, 'triangle'); },
    bipe_cardiaco: ({tone}) => { tone(1046, .07, .07, 0, 'sine'); tone(1568, .05, .03, .01, 'sine'); },
    manivela: ({click, noise}) => { for (let i = 0; i < 5; i++) click(520 + i * 40, .03, .1, i * .07, 'bandpass'); noise({freq: 900, q: 1.6, duration: .34, gain: .07}); }
  };
  const ROTULOS_SOM = {carimbo: 'Carimbo do ponto', tlim: 'Tlim da gaveta', varredura: 'Copiadora varrendo', papel_saindo: 'Folha saindo',
    atolou: 'Papel atolando', reator: 'Lâmpada fria acendendo', disco: 'Disco caindo na vitrola', bipe_cardiaco: 'Bipe do monitor', manivela: 'Manivela'};
  if (root.MapAmbience?.registrar) for (const [nome, tocar] of Object.entries(SONS)) root.MapAmbience.registrar(nome, ROTULOS_SOM[nome], tocar);

  /* ================================================================ estante_movel
     Estante de livros, prateleira de parede, prateleira industrial, prateleira
     de garrafas e gôndola de mercado. Cada prateleira se revista por vez: o que
     estava ali sai do lugar, levanta poeira e o painel mostra o que se achou. */
  const ESTANTES = {
    livros: {nome: 'prateleira', fundo: 'sala', som: 'papel', madeira: true, cornija: true, costas: 'madeira',
      poste: 6, tabua: 4, dica: 'clique numa prateleira para revistar'},
    parede: {nome: 'prateleira', fundo: 'sala', som: 'papel', madeira: true, cornija: false, costas: 'nenhuma',
      poste: 0, tabua: 4, alto: 76, dica: 'clique na prateleira para revistar'},
    industrial: {nome: 'prateleira', fundo: 'deposito', som: 'gaveta_metal', madeira: false, cornija: false, costas: 'nenhuma',
      poste: 6, tabua: 3, dica: 'clique numa prateleira para revistar'},
    bar: {nome: 'prateleira', fundo: 'salao', som: 'objeto', madeira: true, cornija: true, costas: 'espelho',
      poste: 5, tabua: 3, dica: 'clique numa prateleira de garrafas'},
    gondola: {nome: 'prateleira', fundo: 'deposito', som: 'objeto', madeira: false, cornija: false, costas: 'chapa',
      poste: 4, tabua: 3, preco: true, dica: 'clique numa prateleira do mercado'}
  };
  const OPCOES_ESTANTE = [['livros', 'Estante de livros'], ['parede', 'Prateleira de parede'], ['industrial', 'Prateleira industrial'],
    ['bar', 'Prateleira de garrafas'], ['gondola', 'Gôndola de mercado']];

  const geoEstante = (estilo, n) => {
    const E = ESTANTES[estilo] || ESTANTES.livros;
    const alt = clamp(Math.floor(96 / Math.max(1, n)), 13, 27);
    const topo = E.cornija ? 8 : E.poste ? 4 : 0, base = E.poste ? 7 : 9;
    return {E, n, alt, topo, base, w: 108, h: topo + n * alt + base, vao: alt - E.tabua};
  };

  /* Livros: alturas e larguras variadas, um tombado, um deitado em cima. */
  function livros(b, x, y, w, h, R, mexido) {
    const cores = ['vermelho', 'azul', 'verde', 'mogno', 'roxo', 'latao', 'couro', 'ambar'];
    let px = x + 1;
    const tombou = mexido ? 2 + Math.floor(R() * 3) : -1;
    let i = 0;
    while (px < x + w - 4) {
      const lw = 2 + Math.floor(R() * 3), lh = Math.max(6, h - 1 - Math.floor(R() * Math.max(1, h * .28)));
      const cor = cores[Math.floor(R() * cores.length)], nivel = 2 + Math.floor(R() * 3);
      const ly = y + h - lh;
      if (i === tombou) {  // um caiu de lado e encostou no vizinho
        b.poly([[px, y + h], [px + lh, y + h], [px + lh, y + h - lw], [px, y + h - lw]], cor, nivel);
        b.hline(px, px + lh - 1, y + h - lw, cor, nivel + 2);
        px += lh + 1; i++; continue;
      }
      b.rect(px, ly, lw, lh, cor, nivel);
      b.vline(px, ly, y + h - 1, cor, nivel + 1);
      b.vline(px + lw - 1, ly, y + h - 1, cor, Math.max(0, nivel - 1));
      b.hline(px, px + lw - 1, ly, cor, nivel + 2);
      if (lw >= 3 && lh > 8) { b.hline(px + 1, px + lw - 2, ly + 2, 'latao', 4); b.hline(px + 1, px + lw - 2, ly + 4, 'latao', 3); }
      if (lh > 11) b.hline(px + 1, px + lw - 2, y + h - 4, 'latao', 3);
      px += lw + (R() < .18 ? 1 : 0);
      i++;
    }
    // Uma pilha deitada no canto direito, se sobrou espaço.
    if (px < x + w - 9 && h > 9) {
      let ly = y + h - 1;
      for (let k = 0; k < 3 && ly > y + 2; k++) {
        const lw = 7 + Math.floor(R() * 2), nivel = 2 + Math.floor(R() * 3), cor = cores[Math.floor(R() * cores.length)];
        const ox = px + (mexido && k === 2 ? 2 : 0);
        b.rect(ox, ly - 1, lw, 2, cor, nivel); b.hline(ox, ox + lw - 1, ly - 1, cor, nivel + 2); b.hline(ox, ox + lw - 1, ly, cor, Math.max(0, nivel - 1));
        b.vline(ox + lw - 1, ly - 1, ly, 'papel', 4);
        ly -= 2;
      }
    }
  }
  /* Caixas de papelão, latas e um rolo de fita: o depósito. */
  function caixasLatas(b, x, y, w, h, R, mexido) {
    let px = x + 1;
    while (px < x + w - 6) {
      const tipo = R();
      if (tipo < .5) {  // caixa
        const cw = Math.min(x + w - px - 1, 10 + Math.floor(R() * 8)), ch = Math.min(h - 1, 7 + Math.floor(R() * 5));
        const ty = y + h - ch - (mexido && R() < .3 ? 1 : 0);
        b.rect(px, ty, cw, ch, 'sepia', 3);
        for (let xx = px; xx < px + cw; xx += 2) b.vline(xx, ty, ty + ch - 1, 'sepia', 2);
        b.hline(px, px + cw - 1, ty, 'sepia', 5); b.vline(px + cw - 1, ty, y + h - 1, 'sepia', 2); b.hline(px, px + cw - 1, y + h - 1, 'sepia', 1);
        b.vline(px + Math.floor(cw / 2), ty, y + h - 1, 'papelVelho', 4);
        if (ch > 8) { b.rect(px + 2, ty + 3, Math.max(3, cw - 7), 3, 'papel', 5); b.hline(px + 3, px + cw - 6, ty + 4, 'tinta', 2); }
        px += cw + 2;
      } else if (tipo < .8) {  // lata
        const cw = 6, ch = Math.min(h - 1, 8 + Math.floor(R() * 3)), ty = y + h - ch;
        const cor = ['verde', 'vermelho', 'azul', 'ambar'][Math.floor(R() * 4)];
        b.rect(px, ty, cw, ch, 'metal', 3); b.vline(px, ty, y + h - 1, 'metal', 1); b.vline(px + cw - 1, ty, y + h - 1, 'metal', 5);
        b.hline(px, px + cw - 1, ty, 'metal', 5); b.hline(px, px + cw - 1, ty + 1, 'metal', 2);
        b.rect(px, ty + 3, cw, Math.max(2, ch - 6), cor, 3); b.hline(px, px + cw - 1, ty + 3, cor, 4); b.px(px + cw - 2, ty + 4, cor, 5);
        px += cw + 2;
      } else {  // rolo de fio
        const r = Math.min(4, Math.floor(h / 2) - 1), cy = y + h - r - 1;
        b.ellipse(px + r, cy, r, r, 'ambar', 3); b.ellipse(px + r, cy, r - 1, r - 1, 'ambar', 4); b.ellipse(px + r, cy, 1.4, 1.4, 'carvao', 1);
        b.px(px + r - 1, cy - r + 1, 'ambar', 5);
        px += r * 2 + 3;
      }
    }
  }
  /* Garrafas do bar: gargalos de alturas diferentes, vidro colorido, rótulos. */
  function garrafas(b, x, y, w, h, R, mexido) {
    let px = x + 2;
    const cores = ['verde', 'ambar', 'agua', 'vermelho', 'roxo', 'folha', 'latao'];
    while (px < x + w - 5) {
      const cor = cores[Math.floor(R() * cores.length)], gw = 4 + (R() < .35 ? 1 : 0);
      const gh = Math.max(8, h - 1 - Math.floor(R() * Math.max(1, h * .22)));
      const ty = y + h - gh, pescoco = Math.max(2, Math.floor(gh * .34)), nv = 3 + Math.floor(R() * 2);
      const cai = mexido && R() < .18 ? 1 : 0, cx = px + Math.floor(gw / 2);
      // Corpo: vidro escuro nas bordas, claro no meio, brilho fino à direita.
      b.rect(px, ty + pescoco - cai, gw, gh - pescoco + cai, cor, nv);
      b.vline(px, ty + pescoco, y + h - 1, cor, Math.max(0, nv - 2));
      b.vline(px + gw - 1, ty + pescoco, y + h - 1, cor, Math.max(0, nv - 1));
      b.vline(px + gw - 2, ty + pescoco + 1, y + h - 2, cor, nv + 2);
      b.hline(px, px + gw - 1, y + h - 1, cor, Math.max(0, nv - 3));
      // Ombro e gargalo.
      b.px(px, ty + pescoco, cor, Math.max(0, nv - 2)); b.px(px + gw - 1, ty + pescoco, cor, Math.max(0, nv - 2));
      b.rect(cx - 1 + cai, ty + 1, 2, pescoco, cor, nv); b.vline(cx + cai, ty + 1, ty + pescoco, cor, nv + 2);
      b.rect(cx - 1 + cai, ty, 2, 1, ['latao', 'vermelho', 'verde'][Math.floor(R() * 3)], 4);
      // Rótulo, na altura que o vidro deixa.
      const ry = ty + pescoco + 1 + Math.floor(R() * Math.max(1, (gh - pescoco) / 1.8));
      if (gh - pescoco > 5 && R() < .78 && ry + 2 < y + h - 1) {
        b.rect(px, ry, gw, 3, 'papel', 5); b.hline(px, px + gw - 1, ry, 'papel', 6); b.hline(px, px + gw - 1, ry + 2, 'papel', 3);
        b.hline(px + 1, px + gw - 2, ry + 1, ['vermelho', 'tinta', 'verde', 'latao'][Math.floor(R() * 4)], 3);
      }
      px += gw + 1 + (R() < .3 ? 1 : 0);
    }
  }
  /* Gôndola: fileiras iguais do mesmo produto, com um vão de falta. */
  function produtos(b, x, y, w, h, R, mexido) {
    const cores = ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'rosa', 'ambar', 'agua'];
    let px = x + 1, bloco = 0;
    while (px < x + w - 6) {
      const cor = cores[(Math.floor(R() * cores.length) + bloco * 3) % cores.length];
      const cw = 5 + Math.floor(R() * 3), ch = clamp(h - 1 - Math.floor(R() * 3), 6, h - 1);
      const lata = R() < .35;
      const n = 2 + Math.floor(R() * 4), falta = mexido ? Math.floor(R() * n) : (R() < .25 ? Math.floor(R() * n) : -1);
      for (let i = 0; i < n && px < x + w - cw; i++) {
        if (i === falta) { px += cw + 1; continue; }
        const ty = y + h - ch;
        if (lata) {
          b.rect(px, ty, cw, ch, 'metal', 3); b.vline(px, ty, y + h - 1, 'metal', 1); b.vline(px + cw - 1, ty, y + h - 1, 'metal', 5);
          b.hline(px, px + cw - 1, ty, 'metal', 5); b.hline(px, px + cw - 1, ty + 1, 'metal', 2); b.hline(px, px + cw - 1, y + h - 1, 'metal', 1);
          b.rect(px, ty + 3, cw, Math.max(2, ch - 6), cor, 3); b.hline(px, px + cw - 1, ty + 3, cor, 4); b.vline(px + cw - 2, ty + 4, y + h - 4, cor, 5);
        } else {
          b.rect(px, ty, cw, ch, cor, 3); b.vline(px, ty, y + h - 1, cor, 2); b.vline(px + cw - 2, ty, y + h - 1, cor, 5); b.vline(px + cw - 1, ty, y + h - 1, cor, 1);
          b.hline(px, px + cw - 1, ty, cor, 5); b.hline(px, px + cw - 1, y + h - 1, cor, 1);
          b.rect(px + 1, ty + 2, cw - 3, 2, 'papel', 5);
          if (ch > 9) { b.hline(px + 1, px + cw - 3, ty + 6, cor, 5); b.hline(px + 1, px + cw - 3, ty + 8, cor, 1); }
        }
        px += cw + 1;
      }
      px += 2; bloco++;
    }
  }
  /* Prateleira de casa: vaso, rádio, planta, revistas. */
  function bugigangas(b, x, y, w, h, R, mexido) {
    let px = x + 2;
    const peca = ['vaso', 'radio', 'planta', 'revistas', 'retrato'];
    while (px < x + w - 10) {
      const t = peca[Math.floor(R() * peca.length)], base = y + h - 1;
      if (t === 'vaso') {
        const vh = Math.min(h - 1, 7 + Math.floor(R() * 3));
        b.poly([[px + 1, base - vh], [px + 6, base - vh], [px + 7, base], [px, base]], 'mogno', 3);
        b.vline(px + 6, base - vh, base, 'mogno', 4); b.hline(px + 1, px + 6, base - vh, 'mogno', 5);
        b.rect(px + 1, base - vh - 2, 6, 2, 'folha', 3); b.px(px + 3, base - vh - 3, 'folha', 4); b.px(px + 5, base - vh - 3, 'folha', 2);
        px += 10;
      } else if (t === 'radio') {
        const rh = Math.min(h - 1, 8);
        b.rect(px, base - rh, 13, rh, 'sepia', 3); b.hline(px, px + 12, base - rh, 'sepia', 5); b.vline(px + 12, base - rh, base, 'sepia', 2);
        b.rect(px + 1, base - rh + 2, 7, rh - 4, 'carvao', 2);
        for (let yy = base - rh + 3; yy < base - 2; yy += 2) b.hline(px + 2, px + 7, yy, 'carvao', 3);
        b.ellipse(px + 10, base - rh + 4, 1.6, 1.6, 'latao', 4); b.px(px + 10, base - rh + 3, 'latao', 6);
        b.vline(px + 11, base - rh - 3, base - rh, 'metal', 4);
        px += 16;
      } else if (t === 'planta') {
        b.rect(px + 1, base - 4, 6, 4, 'vermelho', 2); b.hline(px + 1, px + 6, base - 4, 'vermelho', 4);
        for (let k = 0; k < 5; k++) { const a = -1.4 + k * .6, l = 3 + Math.floor(R() * Math.max(1, h - 7)); b.line(px + 4, base - 5, px + 4 + Math.round(Math.cos(a) * l), base - 5 - Math.round(Math.abs(Math.sin(a)) * l + 1), 'folha', 2 + (k % 3)); }
        px += 11;
      } else if (t === 'revistas') {
        let ly = base;
        for (let k = 0; k < 3 && ly > base - h + 2; k++) { const ox = mexido && k === 2 ? 2 : 0; b.rect(px + ox, ly - 1, 9, 2, ['papel', 'ceu', 'amarelo'][k], 4); b.hline(px + ox, px + ox + 8, ly - 1, ['papel', 'ceu', 'amarelo'][k], 5); ly -= 2; }
        px += 12;
      } else {
        const rh = Math.min(h - 1, 8);
        b.rect(px, base - rh, 9, rh, 'latao', 3); b.rect(px + 1, base - rh + 1, 7, rh - 2, 'sepia', 2);
        b.ellipse(px + 4, base - rh + 4, 2, 2.4, 'pele', 3); b.hline(px, px + 8, base - rh, 'latao', 5);
        px += 12;
      }
    }
  }
  const PINTA_CONTEUDO = {livros, industrial: caixasLatas, bar: garrafas, gondola: produtos, parede: bugigangas};

  const conteudoArt = (estilo, w, h, seed, mexido) => U.art(`im:estante:cont:${estilo}:${w}x${h}:${seed % 977}:${mexido}`, w, h, b => {
    if (w < 6 || h < 5) return;
    (PINTA_CONTEUDO[estilo] || livros)(b, 0, 0, w, h, K.rng(seed + (mexido ? 991 : 0)), mexido);
    // Sombra de contato de tudo que está na tábua.
    for (let x = 0; x < w; x++) if (b.rampAt(x, h - 2)) b.px(x, h - 1, 'carvao', 1);
  });

  const corpoEstante = (estilo, n, alt) => U.art(`im:estante:corpo:${estilo}:${n}:${alt}`, 108, geoEstante(estilo, n).h, b => {
    const G = geoEstante(estilo, n), E = G.E, W = 108, H = G.h, R = K.rng(sementeDe(estilo) + n);
    const ip = E.poste;
    // Costas.
    if (E.costas === 'madeira') {
      b.rect(ip, 0, W - ip * 2, H, 'mogno', 1);
      for (let x = ip; x < W - ip; x += 9) b.vline(x, 0, H - 1, 'mogno', 0);
      veios(b, ip, 0, W - ip * 2, H, 'mogno', 1, 5, .6);
    } else if (E.costas === 'espelho') {
      b.rect(ip, 0, W - ip * 2, H, 'azul', 1);
      b.vgrad(ip, 0, W - ip * 2, H, 'azul', 1, 0);
      for (let k = 0; k < 4; k++) { const x = ip + 12 + k * 24; b.line(x, 3 + k, x + 6, 9 + k, 'azul', 3); b.line(x + 1, 3 + k, x + 7, 9 + k, 'azul', 2); }
      b.speckle(ip, 0, W - ip * 2, H, 'carvao', 0, .09, R);
      b.shadeFn(ip, 0, W - ip * 2, H, (x, y) => -1 + Math.max(0, 1 - y / 10) * .6);
    } else if (E.costas === 'chapa') {
      b.rect(ip, 0, W - ip * 2, H, 'metal', 2);
      for (let y = 3; y < H - 3; y += 6) for (let x = ip + 4; x < W - ip - 3; x += 6) { b.px(x, y, 'metal', 0); b.px(x + 1, y, 'metal', 3); }
      b.shadeFn(ip, 0, W - ip * 2, H, (x, y) => -.35 + Math.max(0, 1 - y / 14) * .4);
    } else if (ip) {
      // Estante aberta: o vão é escuro, com o pé-direito escurecendo no fundo.
      b.rect(ip, 0, W - ip * 2, H, 'carvao', 2);
      b.shadeFn(ip, 0, W - ip * 2, H, (x, y) => -1.1 + Math.max(0, 1 - Math.abs(x - W / 2) / (W / 2)) * .35);
    }
    // Postes laterais.
    if (ip) for (const lado of [0, 1]) {
      const x = lado ? W - ip : 0;
      if (E.madeira) {
        b.rect(x, 0, ip, H, 'madeira', 3); veios(b, x, 0, ip, H, 'madeira', 3, 7 + lado);
        b.vline(lado ? W - 1 : 0, 0, H - 1, 'madeira', lado ? 1 : 4);
        b.vline(lado ? W - ip : ip - 1, 0, H - 1, 'madeira', lado ? 5 : 1);
      } else {
        b.rect(x, 0, ip, H, 'metal', 3); riscos(b, x, 0, ip, H, 'metal', 3, 11 + lado, 6);
        b.vline(lado ? W - 1 : 0, 0, H - 1, 'metal', lado ? 1 : 5);
        b.vline(lado ? W - ip : ip - 1, 0, H - 1, 'metal', lado ? 5 : 1);
        for (let y = 4; y < H - 4; y += 5) { b.rect(x + 2, y, 2, 2, 'metal', 0); b.px(x + 2, y, 'metal', 1); }
      }
    }
    // Cornija e base.
    if (E.cornija) {
      b.rect(0, 0, W, G.topo, E.madeira ? 'madeira' : 'metal', 4);
      b.hline(0, W - 1, 0, E.madeira ? 'madeira' : 'metal', 5); b.hline(0, W - 1, G.topo - 1, E.madeira ? 'madeira' : 'metal', 1);
      b.rect(2, 2, W - 4, 2, E.madeira ? 'madeira' : 'metal', 5);
    } else if (G.topo >= 4 && ip) { b.rect(ip - 1, 0, W - (ip - 1) * 2, G.topo, E.madeira ? 'madeira' : 'metal', 4); b.hline(ip - 1, W - ip, 0, E.madeira ? 'madeira' : 'metal', 5); }
    // Tábuas.
    for (let i = 0; i < n; i++) {
      const y = G.topo + i * G.alt + G.vao;
      const r = E.madeira ? 'madeira' : 'metal', nv = E.madeira ? 4 : 4;
      b.rect(ip - 1, y, W - (ip - 1) * 2, E.tabua, r, nv);
      b.hline(ip - 1, W - ip, y, r, nv + 1);
      b.hline(ip - 1, W - ip, y + E.tabua - 1, r, Math.max(0, nv - 3));
      if (E.madeira) veios(b, ip, y, W - ip * 2, E.tabua, r, nv, 3 + i);
      else for (let x = ip + 2; x < W - ip - 2; x += 4) b.px(x, y + 1, r, nv + 1);
    }
    // Mãos-francesas: só a prateleira de parede, que não tem laterais.
    if (!ip) for (let i = 0; i < n; i++) {
      const y = G.topo + i * G.alt + G.vao + E.tabua;
      for (const x of [10, W - 18]) {
        b.poly([[x, y], [x + 8, y], [x, y + 8]], 'metal', 2);
        b.vline(x, y, y + 8, 'metal', 4); b.line(x + 8, y, x, y + 8, 'metal', 0);
        b.px(x + 1, y + 1, 'metal', 5); b.px(x + 2, y + 2, 'metal', 4);
        b.rect(x - 1, y, 3, 2, 'metal', 3);
      }
    }
    // Base (a prateleira de parede não tem: só as mãos-francesas).
    if (G.base >= 4 && ip) {
      const y = H - G.base;
      b.rect(0, y, W, G.base, E.madeira ? 'madeira' : 'metal', 2);
      b.hline(0, W - 1, y, E.madeira ? 'madeira' : 'metal', 4); b.hline(0, W - 1, H - 1, E.madeira ? 'madeira' : 'metal', 0);
      if (!E.madeira) for (const x of [3, W - 8]) { b.rect(x, H - 3, 5, 3, 'metal', 1); b.hline(x, x + 4, H - 3, 'metal', 3); }
    }
    b.shadeFn(0, 0, W, H, (x, y) => faixas((.5 - Math.hypot((x - 84) / 150, (y - 12) / 150)) * 1.6));
    contorno(b, 'carvao', 0);
  });

  /* A etiqueta de preço da gôndola: um trilho branco com o preço em números. */
  function trilhoPreco(ctx, clueId, i, x, y, w) {
    const R = K.rng(sementeDe(clueId) + i * 17);
    U.rect(ctx, x, y, w, 10, C('papel', 4));
    U.rect(ctx, x, y, w, 2, C('papel', 6)); U.rect(ctx, x, y + 8, w, 2, C('papel', 1));
    let px = x + 5;
    while (px < x + w - 30) {
      const v = (1 + Math.floor(R() * 12)) + ',' + String(Math.floor(R() * 10) * 10).padStart(2, '0');
      K.drawText(ctx, v, px, y + 2, {color: C('vermelho', 2)});
      const larg = K.measure(v);
      U.rect(ctx, px + larg + 5, y + 2, 1, 6, C('papel', 2));
      px += larg + 12;
    }
  }

  Tipos.register('estante_movel', {
    label: 'Estante / prateleira', icon: 'estante', sound: 'papel', categoria: 'interacao', veil: .62,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'estilo', label: 'Que prateleira é', kind: 'select', options: OPCOES_ESTANTE},
      {id: 'prateleiras', label: 'Prateleiras, de cima para baixo: Nome | o que tem | itens (uma por linha)', kind: 'textarea', rows: 6},
      {id: 'vazio', label: 'Texto quando a prateleira não tem nada', kind: 'text'},
      {id: 'aviso', label: 'Aviso colado na estante (vazio = nenhum)', kind: 'text'}],
    defaults: {
      titulo: '', estilo: 'livros',
      prateleiras: 'Prateleira de cima | Livros de capa dura, todos com o mesmo brasão na lombada. Um está de cabeça para baixo.\n' +
        'Prateleira do meio | Pastas de plástico e uma caixa de sapato sem tampa. | moedas*3\n' +
        'Prateleira de baixo | Revistas velhas empilhadas até encostar na tábua de cima. | bandage',
      vazio: 'Só poeira e a marca de onde alguma coisa ficou muito tempo.', aviso: ''},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!Array.isArray(mem.revistadas)) mem.revistadas = [];
      if (!mem.pegos || typeof mem.pegos !== 'object' || Array.isArray(mem.pegos)) mem.pegos = {};
      const st = {mem, foco: -1, slide: 0, poeira: [], itensRegioes: [], itemShake: null, brilho: 0, tip: null};
      this.preparar(st, clue);
      return st;
    },
    preparar(st, clue) {
      const d = clue.data || {}, txt = String(d.prateleiras ?? ''), estilo = escolha(d.estilo, Object.keys(ESTANTES), 'livros');
      if (st.txt === txt && st.estilo === estilo && st.G) return st.comps;
      let comps = parsePrateleiras(txt);
      if (!comps.length) comps = [{nome: '', texto: '', itens: [], key: '##0'}];
      Object.assign(st, {txt, estilo, comps, G: geoEstante(estilo, comps.length)});
      if (st.foco >= comps.length) st.foco = -1;
      return comps;
    },
    nomePrateleira(st, i) { return st.comps[i]?.nome || (st.comps.length === 1 ? 'A prateleira' : `Prateleira ${i + 1}`); },
    restantes(st, i) {
      const c = st.comps[i];
      if (!c) return [];
      const pegos = st.mem.pegos[c.key] || [];
      return c.itens.filter(it => !pegos.includes(it.key));
    },
    describe: st => ({estilo: st.estilo, foco: st.foco, prateleiras: st.comps?.length || 0,
      revistadas: [...(st.mem?.revistadas || [])], pegos: JSON.parse(JSON.stringify(st.mem?.pegos || {}))}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t;
      const comps = this.preparar(st, clue), G = st.G, E = G.E, mem = st.mem;
      const aberto = st.foco >= 0 && st.foco < comps.length;
      st.slide = toward(st.slide, aberto ? 1 : 0, 1 / .3, dt);
      st.brilho = toward(st.brilho, aberto ? 1 : 0, 1 / .25, dt);
      if (st.itemShake) st.itemShake.t -= dt;
      st.tip = null;
      U.blit(ctx, fundoArt(E.fundo), 0, 22);
      const e = easeIO(st.slide), cx = CENTRO + (118 - CENTRO) * e;
      const ox = snap(cx - G.w), oy = snap(CHAO_Y - G.h * 2 - (E.alto || 0));
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      if (E.alto) { ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#07030a'; ctx.fillRect(ox + 8, oy + G.h * 2, G.w * 2 - 16, 10); ctx.restore(); }
      else sombraChao(ctx, ox + 8, CHAO_Y - 2, G.w * 2 - 16, 10, .5);
      U.blit(ctx, corpoEstante(st.estilo, comps.length, G.alt), ox, oy);
      // O que está em cada prateleira, e a faixa clicável.
      const ip = E.poste, iw = G.w - ip * 2, trilhos = [];
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i], vy = G.topo + i * G.alt, mexido = mem.revistadas.includes(c.key);
        const ch = Math.max(5, G.vao - 1);
        const arte = conteudoArt(st.estilo, iw - 2, ch, sementeDe(clue.id + '|' + c.key), mexido);
        U.blit(ctx, arte, X(ip + 1), Y(vy + G.vao - ch));
        const rx = X(ip), ry = Y(vy), rw = iw * 2, rh = G.vao * 2 + 2;
        const hot = ui.region('prateleira', rx, ry, rw, rh, {data: i, silent: true});
        if (E.preco) trilhos.push([i, X(ip - 1), Y(vy + G.vao), iw * 2 + 4]);
        if (st.foco === i) {
          // A prateleira aberta recebe uma luz quente e a borda marcada.
          ctx.save(); ctx.globalAlpha = .13 + Math.sin(t * 2.4) * .04; ctx.fillStyle = '#ffd9a0'; ctx.fillRect(rx, ry, rw, rh); ctx.restore();
          U.outline(ctx, rx - 2, ry - 2, rw + 4, rh + 4, '#ffd18c', 2);
        } else if (hot) U.ants(ctx, rx - 2, ry - 2, rw + 4, rh + 4, t);
        if (hot && st.foco !== i) st.tip = {texto: this.nomePrateleira(st, i), x: rx + rw / 2, y: ry - 16};
        // O nome só aparece ao passar o ponteiro: com a prateleira aberta, quem
        // diz o nome é o painel — e a etiqueta não briga com o trilho de preço.
        if (hot && st.foco !== i) {
          const nome = c.nome || (comps.length > 1 ? `Prateleira ${i + 1}` : '');
          if (nome) etiqueta(ctx, nome, rx + rw / 2, ry + rh + (E.preco ? 18 : 8), rw, 'hover');
        }
        if (mexido && st.foco !== i && !hot) { ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = '#07030a'; ctx.fillRect(rx, ry, rw, rh); ctx.restore(); }
      }
      // Os trilhos de preço vêm por cima: são a frente da tábua.
      for (const [i, tx, ty, tw] of trilhos) trilhoPreco(ctx, clue.id, i, tx, ty, tw);
      // Poeira levantada quando uma prateleira é mexida.
      st.poeira = st.poeira.filter(p => (p.t += dt) < 1.1);
      for (const p of st.poeira) {
        const u = p.t / 1.1;
        ctx.save(); ctx.globalAlpha = (1 - u) * .5; ctx.fillStyle = '#e8d8b8';
        ctx.fillRect(snap(p.x + p.vx * p.t * 40), snap(p.y - ease(u) * 22 + Math.sin(p.t * 5 + p.f) * 3), 2, 2);
        ctx.restore();
      }
      // Aviso colado na lateral.
      const aviso = String(d.aviso || '').trim();
      if (aviso && !aberto) {
        const lin = K.wrap(aviso, 82).slice(0, 4), aw = 96, ah = lin.length * 12 + 20;
        const ax = snap(clamp(ox + G.w * 2 + 12, 8, SW - aw - 8)), ay = snap(clamp(oy + 20, 30, SH - ah - 10));
        U.rect(ctx, ax + 3, ay + 3, aw, ah, '#05020888');
        U.blit(ctx, papelArt(aw / 2, Math.ceil(ah / 2), 7), ax, ay);
        U.tape(ctx, ax + aw / 2 - 16, ay - 5, 32, 10);
        U.hand(ctx, lin.join('\n'), ax + 8, ay + 8, {color: C('tinta', 2), width: aw - 12, lineHeight: 12, seed: 4});
      }
      // Painel da prateleira aberta.
      if (aberto || st.slide > 0) {
        const px = snap(PAINEL.x + (1 - e) * (SW - PAINEL.x + 12));
        const i = clamp(st.foco < 0 ? 0 : st.foco, 0, comps.length - 1), c = comps[i];
        const alt = painelConteudo(ctx, ui, st, sys, {px, py: PAINEL.y, w: PAINEL.w, h: PAINEL.h, nome: this.nomePrateleira(st, i),
          texto: c.texto, itens: this.restantes(st, i), vazio: campo(d.vazio, this.defaults.vazio), seed: sementeDe(c.key), rodape: 24});
        ui.button(ctx, 'fechar_prat', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'VOLTAR', {style: 'papel'});
      }
      if (st.tip && ui.mouse.x >= 0) U.tooltip(ctx, st.tip.texto, st.tip.x, st.tip.y);
      const titulo = campo(d.titulo, clue.name);
      const dica = aberto ? (this.restantes(st, st.foco).length ? 'clique nos itens para pegar' : 'clique noutra prateleira') : E.dica;
      U.header(ctx, ui, titulo, dica, 'estante');
    },
    abrir(i, st, clue, sys) {
      const comps = st.comps, c = comps[i];
      if (!c) return;
      if (st.foco === i) { st.foco = -1; sys.sfx('clique'); return; }
      st.foco = i;
      if (!st.mem.revistadas.includes(c.key)) {
        st.mem.revistadas.push(c.key);
        const G = st.G, y = CHAO_Y - (G.h - G.topo - i * G.alt - G.vao) * 2;
        for (let k = 0; k < 9; k++) st.poeira.push({x: 240 + (k - 4) * 14, y, t: 0, vx: (k % 3 - 1) * .5, f: k});
      }
      sys.sfx(st.E?.som || ESTANTES[st.estilo]?.som || 'papel');
      sys.emit('change');
    },
    pegar(key, st, clue, sys) {
      const i = st.foco, c = st.comps[i];
      if (!c) return;
      const it = c.itens.find(x => x.key === key), pegos = st.mem.pegos[c.key] ||= [];
      if (!it || pegos.includes(key)) return;
      const r = entregar(sys, it, 'PEGOU');
      if (r === 'bolsa' || r === 'chao') { pegos.push(key); sys.emit('change'); }
      else st.itemShake = {key, t: .35};
    },
    action(id, st, clue, sys, info = {}) {
      this.preparar(st, clue);
      if (id === 'prateleira') this.abrir(Number(info.data), st, clue, sys);
      else if (id === 'item') this.pegar(String(info.data), st, clue, sys);
      else if (id === 'fechar_prat') { st.foco = -1; sys.sfx('clique'); }
    },
    key(e, st) {
      if (e.key === 'Escape' && st.foco >= 0) { st.foco = -1; return true; }
      if (e.key === 'ArrowDown') { st.foco = clamp(st.foco + 1, 0, (st.comps?.length || 1) - 1); return true; }
      if (e.key === 'ArrowUp') { st.foco = clamp(st.foco - 1, 0, (st.comps?.length || 1) - 1); return true; }
      return false;
    },
    rotuloAcao: 'Revistar'
  });

  /* ================================================================ copiadora
     A tampa levanta e mostra o que ficou no vidro; a varredura verde passa por
     baixo; o painel conta as cópias; a folha sai na bandeja — e às vezes atola,
     e aí é abrir a portinhola da frente. */
  const DUR_COPIA = {fecha: .35, varre: 1.15, sai: .55};

  const corpoCopiadora = () => U.art('im:copiadora:corpo', 128, 92, b => {
    // Gabinete: bege de escritório, dois gavetões de papel e a portinhola.
    b.rect(4, 46, 120, 42, 'papelVelho', 3); b.hline(4, 123, 46, 'papelVelho', 4); b.vline(123, 46, 87, 'papelVelho', 1); b.vline(4, 47, 87, 'papelVelho', 4);
    b.speckle(6, 48, 116, 38, 'papelVelho', 2, .03, K.rng(5));
    for (const y of [52, 66]) {
      b.rect(10, y, 108, 12, 'papelVelho', 3); b.hline(10, 117, y, 'papelVelho', 5); b.hline(10, 117, y + 11, 'papelVelho', 1);
      b.rect(48, y + 4, 34, 4, 'carvao', 2); b.hline(48, 81, y + 4, 'carvao', 1); b.hline(48, 81, y + 7, 'papelVelho', 4);
      b.rect(14, y + 3, 12, 6, 'papelVelho', 4); b.frame(14, y + 3, 12, 6, 'papelVelho', 1); b.text(20, y + 4, 'A4', 'carvao', 2, {font: '3x5', align: 'center'});
    }
    b.rect(10, 80, 108, 8, 'papelVelho', 2); b.hline(10, 117, 80, 'papelVelho', 4);
    b.rect(52, 82, 24, 4, 'papelVelho', 4); b.hline(52, 75, 82, 'papelVelho', 5); b.hline(52, 75, 85, 'papelVelho', 1);
    b.rect(10, 88, 12, 3, 'carvao', 2); b.rect(106, 88, 12, 3, 'carvao', 2);
    // Faixa do painel, larga, na frente do scanner.
    b.rect(2, 34, 124, 12, 'papelVelho', 4); b.hline(2, 125, 34, 'papelVelho', 5); b.hline(2, 125, 45, 'papelVelho', 1);
    b.rect(6, 36, 60, 8, 'carvao', 0); b.frame(6, 36, 60, 8, 'papelVelho', 1);
    // Bloco do scanner.
    b.rect(2, 12, 124, 22, 'papelVelho', 4); b.hline(2, 125, 12, 'papelVelho', 6); b.vline(125, 12, 33, 'papelVelho', 2); b.vline(2, 13, 33, 'papelVelho', 5);
    // Vidro fundo, com a moldura preta.
    b.rect(8, 15, 92, 18, 'carvao', 1); b.frame(8, 15, 92, 18, 'carvao', 3); b.hline(9, 99, 16, 'carvao', 0);
    b.rect(104, 15, 18, 18, 'papelVelho', 3); b.frame(104, 15, 18, 18, 'papelVelho', 1);
    for (let y = 18; y < 31; y += 3) b.hline(106, 119, y, 'papelVelho', 2);
    // Boca de saída, logo abaixo do painel.
    b.rect(2, 44, 12, 3, 'carvao', 1); b.hline(2, 13, 44, 'carvao', 3);
    b.shadeFn(0, 0, 128, 92, (x, y) => faixas((.5 - Math.hypot((x - 96) / 160, (y - 10) / 160)) * 1.5));
    contorno(b, 'carvao', 0);
  });
  /* A tampa: chapa bege com dobradiças atrás e borracha branca por baixo. */
  const tampaCopiadora = () => U.art('im:copiadora:tampa', 98, 22, b => {
    b.rect(0, 0, 98, 18, 'papelVelho', 4); b.hline(0, 97, 0, 'papelVelho', 6); b.hline(0, 97, 17, 'papelVelho', 1);
    b.rect(3, 3, 92, 12, 'papelVelho', 3); b.hline(3, 94, 3, 'papelVelho', 2); b.hline(3, 94, 14, 'papelVelho', 5);
    b.rect(0, 18, 98, 4, 'papel', 5); b.hline(0, 97, 21, 'papel', 2);
    for (const x of [18, 74]) { b.rect(x, 0, 8, 3, 'carvao', 3); b.hline(x + 1, x + 6, 0, 'carvao', 4); }
    b.rect(44, 15, 10, 3, 'carvao', 3); b.hline(44, 53, 15, 'carvao', 4);
    contorno(b, 'carvao', 0);
  });
  /* A bandeja de saída: uma língua de plástico bege presa na lateral esquerda. */
  const bandejaArt = () => U.art('im:copiadora:bandeja', 30, 16, b => {
    b.poly([[0, 2], [28, 0], [28, 11], [0, 13]], 'papelVelho', 3);
    b.line(0, 2, 28, 0, 'papelVelho', 5); b.line(0, 13, 28, 11, 'papelVelho', 1);
    b.rect(0, 2, 3, 11, 'papelVelho', 4); b.vline(0, 2, 13, 'papelVelho', 5);
    for (let x = 6; x < 26; x += 6) b.line(x, 1 + Math.floor(x / 14), x, 12 - Math.floor(x / 14), 'papelVelho', 2);
    b.poly([[22, 12], [28, 11], [28, 15], [22, 15]], 'papelVelho', 1);
    contorno(b, 'carvao', 0);
  });
  /* A folha copiada, com o carimbo do texto em miniatura. */
  const folhaArt = (seed, linhas) => U.art(`im:copiadora:folha:${seed % 97}:${linhas}`, 26, 18, b => {
    b.rect(0, 0, 26, 18, 'papel', 6); b.hline(0, 25, 0, 'papel', 7); b.hline(0, 25, 17, 'papel', 3); b.vline(25, 0, 17, 'papel', 4);
    const R = K.rng(seed);
    for (let i = 0; i < Math.min(linhas, 7); i++) b.hline(3, 3 + Math.floor(8 + R() * 13), 3 + i * 2, 'carvao', 2);
    b.speckle(1, 1, 24, 16, 'carvao', 3, .02, R);
  });

  Tipos.register('copiadora', {
    label: 'Copiadora', icon: 'copiadora', sound: 'maquina', categoria: 'interacao', veil: .66,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'vidro', label: 'O que ficou esquecido no vidro (vazio = nada)', kind: 'textarea', rows: 3},
      {id: 'copia', label: 'O que sai impresso na cópia', kind: 'textarea', rows: 3},
      {id: 'bandeja', label: 'O que está na bandeja de saída (itens: moedas*2, chave=Cópias)', kind: 'text'},
      {id: 'mostrador', label: 'Recado no mostrador quando está parada', kind: 'text'},
      {id: 'atola', label: 'Atola o papel', kind: 'select', options: [['nao', 'Não'], ['sim', 'Sim, na segunda cópia'], ['sempre', 'Sim, sempre']]},
      {id: 'quebrada', label: 'Fora de serviço (não copia)', kind: 'select', options: [['nao', 'Funciona'], ['sim', 'Fora de serviço']]}],
    defaults: {titulo: '', vidro: 'Alguém copiou um documento e esqueceu o original no vidro. Está de cabeça para baixo.',
      copia: 'A cópia sai com uma faixa preta atravessada: o vidro está riscado bem no meio da folha.',
      bandeja: '', mostrador: 'PRONTA', atola: 'sim', quebrada: 'nao'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (typeof mem.copias !== 'number') mem.copias = 0;
      if (!Array.isArray(mem.pegos)) mem.pegos = [];
      return {mem, tampa: mem.tampa ? 1 : 0, pedido: clamp(inteiro(mem.pedido, 1), 1, 9), fase: null, fx: 0, folhas: clamp(mem.copias, 0, 6),
        varre: 0, lampada: 0, tremor: 0, leu: !!mem.leu, itensRegioes: [], itemShake: null, painel: null};
    },
    itens(clue, st) { return parseItens(clue.data?.bandeja).filter(it => !(st.mem.pegos || []).includes(it.key)); },
    quebrada: clue => chave(clue?.data?.quebrada) === 'sim',
    describe: st => ({tampa: +st.tampa.toFixed(2), pedido: st.pedido, fase: st.fase?.nome || null, copias: st.mem?.copias || 0,
      atolada: !!st.mem?.atolada, painel: st.painel, leu: !!st.mem?.leu}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t, mem = st.mem;
      const quebrada = this.quebrada(clue);
      st.tampa = toward(st.tampa, mem.tampa ? 1 : 0, 1 / .45, dt);
      st.tremor = Math.max(0, st.tremor - dt);
      if (st.itemShake) st.itemShake.t -= dt;
      // Máquina do ciclo de cópia.
      if (st.fase) {
        st.fase.t += dt;
        const f = st.fase;
        if (f.nome === 'fecha' && f.t >= DUR_COPIA.fecha) { st.fase = {nome: 'varre', t: 0, n: f.n}; sys.sfx('varredura'); }
        else if (f.nome === 'varre' && f.t >= DUR_COPIA.varre) {
          const atola = chave(d.atola) === 'sempre' || (chave(d.atola) === 'sim' && f.n === 2 && !mem.limpou);
          if (atola) { st.fase = null; mem.atolada = true; st.tremor = .5; sys.sfx('atolou'); sys.toast('PAPEL ATOLADO', 'Abra a portinhola da frente', 'alerta'); sys.emit('change'); }
          else { st.fase = {nome: 'sai', t: 0, n: f.n}; sys.sfx('papel_saindo'); }
        } else if (f.nome === 'sai' && f.t >= DUR_COPIA.sai) {
          mem.copias = clamp((mem.copias || 0) + 1, 0, 99); st.folhas = clamp(st.folhas + 1, 0, 6);
          if (f.n < st.pedido) { st.fase = {nome: 'varre', t: 0, n: f.n + 1}; sys.sfx('varredura'); }
          else { st.fase = null; sys.sfx('clique'); }
          sys.emit('change');
        }
      }
      st.lampada = toward(st.lampada, mem.atolada ? 1 : 0, 6, dt);
      U.blit(ctx, fundoArt('escritorio'), 0, 22);
      const G = {w: 128, h: 92};
      const tremor = st.tremor > 0 ? Math.round(Math.sin(st.tremor * 80) * 1.5) * 2 : 0;
      const e = easeIO(st.painel ? 1 : 0);
      const cx = CENTRO + (176 - CENTRO) * e;
      const ox = snap(cx - G.w + tremor), oy = snap(CHAO_Y - G.h * 2);
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      sombraChao(ctx, ox + 12, CHAO_Y - 2, G.w * 2 - 24, 10, .5);
      U.blit(ctx, corpoCopiadora(), ox, oy);
      U.blit(ctx, bandejaArt(), X(-28), Y(44));
      // O que está no vidro (só se vê com a tampa levantada).
      const aberta = st.tampa;
      const vidro = String(d.vidro || '').trim();
      if (aberta > .1 && vidro) {
        ctx.save(); ctx.globalAlpha = Math.min(1, aberta * 1.6);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(folhaArt(sementeDe(clue.id), 6), 0, 0, 26, 18, snap(X(22)), snap(Y(17)), 120, 60);
        ctx.restore();
      }
      // A varredura: uma barra verde correndo por baixo do vidro.
      if (st.fase?.nome === 'varre') {
        const u = st.fase.t / DUR_COPIA.varre, bx = X(9) + Math.round(u * 89) * 2;
        ctx.save(); ctx.globalAlpha = .35; U.rect(ctx, bx - 10, Y(16), 24, 34, '#4fe08a'); ctx.restore();
        U.rect(ctx, bx, Y(16), 4, 34, '#d8ffe0');
        ctx.save(); ctx.globalAlpha = .5; U.rect(ctx, X(9), Y(16), 182, 2, '#4fe08a'); ctx.restore();
      }
      // A tampa: fechada cobre o vidro inteiro; aberta encosta para trás.
      {
        const u = easeIO(aberta), th = Math.round(22 - u * 16);
        const ty = Y(13) - Math.round(u * 5) * 2;
        ctx.save(); ctx.globalAlpha = .6 + (1 - u) * .4;
        U.rect(ctx, X(5) + 3, ty + 3, 196, th * 2, '#07030a55');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tampaCopiadora(), 0, 0, 98, 22, snap(X(5)), snap(ty), 196, th * 2);
        ctx.restore();
        const hotT = ui.region('tampa', X(5), ty - 4, 196, th * 2 + 10, {silent: true});
        if (hotT && !st.fase) { U.ants(ctx, X(5) - 2, ty - 6, 200, th * 2 + 14, t); st.dicaTampa = true; }
      }
      // Painel: mostrador largo, contagem e botões.
      {
        const mx = X(6), my = Y(36), mw = 120;
        const txt = quebrada ? 'FORA DE SERVICO' : mem.atolada ? 'PAPEL ATOLADO' : st.fase ? `COPIANDO ${st.fase.n}/${st.pedido}` : (semAcento(campo(d.mostrador, 'PRONTA')).toUpperCase().slice(0, 18));
        const ruim = mem.atolada || quebrada;
        U.rect(ctx, mx, my, mw, 16, ruim ? '#2a060c' : '#05120b');
        K.drawText(ctx, cortar(txt, mw - 8), mx + mw / 2, my + 3, {color: ruim ? C('vermelho', 5) : C('fosforo', 5), align: 'center'});
        if (st.fase) { const p = clamp((st.fase.n - 1 + st.fase.t / DUR_COPIA.varre) / st.pedido, 0, 1); U.rect(ctx, mx + 3, my + 12, Math.round((mw - 6) * p / 2) * 2, 2, C('fosforo', 4)); }
        // Lâmpada de aviso, ao lado do mostrador.
        const lx = X(70), ly = Y(37);
        U.rect(ctx, lx + 1, ly + 1, 8, 8, '#07030a66');
        U.rect(ctx, lx, ly, 8, 8, st.lampada > .5 && Math.floor(t * 4) % 2 ? C('vermelho', 6) : C('vermelho', 1));
        U.rect(ctx, lx, ly, 8, 2, st.lampada > .5 && Math.floor(t * 4) % 2 ? C('vermelho', 7) : C('vermelho', 2));
        // Botões − / valor / + e o COPIAR.
        ui.button(ctx, 'menos', X(76), Y(35), 16, 16, '-', {style: 'metal', disabled: !!st.fase});
        U.rect(ctx, X(85), Y(35), 16, 16, C('carvao', 1));
        K.drawText(ctx, String(st.pedido), X(85) + 8, Y(35) + 5, {color: C('fosforo', 5), align: 'center'});
        ui.button(ctx, 'mais', X(94), Y(35), 16, 16, '+', {style: 'metal', disabled: !!st.fase});
        ui.button(ctx, 'copiar', X(103), Y(16), 38, 34, st.fase ? '…' : 'COPIAR', {style: 'fosforo', disabled: !!st.fase || quebrada || !!mem.atolada});
      }
      // Portinhola: pisca quando atolou.
      {
        const py = Y(80);
        const hot = ui.region('portinhola', X(10), py - 2, 216, 22, {silent: true});
        if (mem.atolada) {
          U.outline(ctx, X(10) - 2, py - 4, 220, 26, Math.floor(t * 3) % 2 ? '#ffb45a' : C('vermelho', 3), 2);
          U.rect(ctx, X(52), py - 8, 30, 10, C('papel', 5)); U.rect(ctx, X(55), py - 12, 20, 6, C('papel', 4));
          U.rect(ctx, X(58), py - 6, 14, 2, C('papel', 2)); U.rect(ctx, X(56), py - 10, 4, 2, C('papel', 6));
        } else if (hot) U.ants(ctx, X(10) - 2, py - 4, 220, 26, t);
      }
      // Bandeja de saída: as folhas empilhadas e a que está saindo.
      {
        const bx = X(-26), by = Y(46);
        for (let i = 0; i < st.folhas; i++) U.blit(ctx, folhaArt(sementeDe(clue.id) + i, 5), bx + (i % 2) * 2, by - 6 - i * 3);
        if (st.fase?.nome === 'sai') {
          const u = ease(st.fase.t / DUR_COPIA.sai);
          U.blit(ctx, folhaArt(sementeDe(clue.id) + st.fase.n, 5), snap(X(4) - u * 56), snap(by - 6 - st.folhas * 3));
        }
        const temFolha = st.folhas > 0;
        const hot = ui.region('folha', bx - 6, by - 12 - st.folhas * 3, 72, 34 + st.folhas * 3, {silent: true});
        if (temFolha && hot) { U.ants(ctx, bx - 8, by - 14 - st.folhas * 3, 76, 38 + st.folhas * 3, t); U.tooltip(ctx, 'ler a cópia', bx + 30, by - 28 - st.folhas * 3); }
      }
      // Painel lateral: a cópia lida e o que veio na bandeja.
      if (st.painel === 'copia') {
        const px = PAINEL.x;
        const alt = painelConteudo(ctx, ui, st, sys, {px, py: PAINEL.y, w: PAINEL.w, h: PAINEL.h, nome: 'A cópia',
          texto: campo(d.copia, this.defaults.copia), itens: this.itens(clue, st), vazio: 'A folha saiu em branco.', seed: sementeDe(clue.id), rodape: 24});
        ui.button(ctx, 'fechar_painel', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'VOLTAR', {style: 'papel'});
      }
      const titulo = campo(d.titulo, clue.name);
      const dica = quebrada ? 'fora de serviço' : mem.atolada ? 'papel atolado · abra a portinhola' : st.fase ? 'copiando…' :
        mem.tampa ? 'a tampa está levantada · clique para fechar' : st.folhas ? 'clique nas folhas para ler a cópia' : 'levante a tampa ou aperte COPIAR';
      U.header(ctx, ui, titulo, dica, 'copiadora');
    },
    pegar(key, st, clue, sys) {
      const it = this.itens(clue, st).find(x => x.key === key);
      if (!it) return;
      const r = entregar(sys, it, 'PEGOU');
      if (r === 'bolsa' || r === 'chao') { (st.mem.pegos ||= []).push(key); sys.emit('change'); }
      else st.itemShake = {key, t: .35};
    },
    action(id, st, clue, sys, info = {}) {
      const mem = st.mem, d = clue.data || {};
      switch (id) {
        case 'tampa':
          if (st.fase) return;
          mem.tampa = !mem.tampa; sys.sfx(mem.tampa ? 'armario' : 'porta_fechar'); sys.emit('change'); break;
        case 'mais': if (!st.fase) { st.pedido = clamp(st.pedido + 1, 1, 9); mem.pedido = st.pedido; sys.sfx('tecla'); } break;
        case 'menos': if (!st.fase) { st.pedido = clamp(st.pedido - 1, 1, 9); mem.pedido = st.pedido; sys.sfx('tecla'); } break;
        case 'copiar':
          if (st.fase || this.quebrada(clue)) { sys.sfx('erro'); return; }
          if (mem.atolada) { sys.sfx('erro'); sys.toast('ATOLADA', 'Tire o papel preso primeiro', 'alerta'); return; }
          if (mem.tampa) { mem.tampa = false; st.fase = {nome: 'fecha', t: 0, n: 1}; sys.sfx('porta_fechar'); }
          else { st.fase = {nome: 'varre', t: 0, n: 1}; sys.sfx('varredura'); }
          sys.emit('change');
          break;
        case 'portinhola':
          if (mem.atolada) { mem.atolada = false; mem.limpou = true; st.tremor = .25; sys.sfx('papel'); sys.toast('DESATOLOU', 'Uma folha amassada sai pela metade', 'check'); sys.emit('change'); }
          else sys.sfx('clique');
          break;
        case 'folha':
          if (!st.folhas) { sys.sfx('erro'); return; }
          st.painel = st.painel === 'copia' ? null : 'copia';
          if (st.painel) { mem.leu = true; sys.sfx('papel'); sys.emit('change'); } else sys.sfx('clique');
          break;
        case 'fechar_painel': st.painel = null; sys.sfx('clique'); break;
        case 'item': this.pegar(String(info.data), st, clue, sys); break;
      }
    },
    key(e, st, clue, sys) {
      if (e.key === 'Escape' && st.painel) { st.painel = null; return true; }
      if (e.key === 'Enter' || e.key === ' ') { this.action('copiar', st, clue, sys); return true; }
      return false;
    },
    rotuloAcao: 'Usar a copiadora'
  });

  /* ================================================================ relogio_ponto
     O relógio na parede do corredor, com as divisórias dos cartões dos dois
     lados. Puxar um cartão mostra as batidas de perto; enfiá-lo na boca do
     relógio imprime a hora de agora, com o barulho do carimbo. */
  const corpoPonto = () => U.art('im:ponto:corpo', 44, 74, b => {
    // Caixa de esmalte creme com bordas de metal.
    b.rect(2, 4, 40, 68, 'papelVelho', 4); b.hline(2, 41, 4, 'papelVelho', 6); b.vline(41, 4, 71, 'papelVelho', 2); b.vline(2, 5, 71, 'papelVelho', 5);
    b.hline(2, 41, 71, 'papelVelho', 1);
    b.rect(0, 0, 44, 6, 'metal', 3); b.hline(0, 43, 0, 'metal', 5); b.hline(0, 43, 5, 'metal', 1);
    b.rect(4, 6, 36, 2, 'metal', 2);
    // Janela do mostrador.
    b.rect(6, 11, 32, 14, 'carvao', 0); b.frame(6, 11, 32, 14, 'metal', 4); b.hline(7, 37, 12, 'carvao', 1);
    // Chapa gravada.
    b.rect(6, 28, 32, 9, 'metal', 3); b.frame(6, 28, 32, 9, 'metal', 5);
    b.text(22, 30, 'PONTO', 'metal', 1, {font: '3x5', align: 'center'});
    // Boca do cartão.
    b.rect(8, 44, 28, 6, 'carvao', 1); b.hline(8, 35, 44, 'carvao', 3); b.hline(8, 35, 49, 'papelVelho', 5);
    b.rect(10, 45, 24, 3, 'preto', 0);
    // Alavanca do carimbo, à direita.
    b.rect(38, 50, 5, 3, 'metal', 4); b.rect(40, 52, 3, 10, 'metal', 3); b.px(41, 53, 'metal', 5);
    b.ellipse(41.5, 63, 2.6, 2.6, 'vermelho', 3); b.px(40, 62, 'vermelho', 5);
    // Plaquinha de instruções e dois parafusos.
    b.rect(8, 54, 24, 8, 'papel', 5); b.hline(9, 30, 56, 'tinta', 2); b.hline(9, 27, 58, 'tinta', 2); b.hline(9, 29, 60, 'tinta', 2);
    for (const [x, y] of [[5, 8], [38, 8], [5, 68], [38, 68]]) { b.ellipse(x, y, 1.4, 1.4, 'metal', 4); b.px(x, y, 'metal', 1); }
    b.shadeFn(0, 0, 44, 74, (x, y) => faixas((.5 - Math.hypot((x - 34) / 60, (y - 8) / 90)) * 1.6));
    contorno(b, 'carvao', 0);
  });
  /* Uma divisória de cartões: chapa de metal com bolsos. */
  const rackPonto = (linhas) => U.art('im:ponto:rack:' + linhas, 40, linhas * 22 + 4, b => {
    const H = linhas * 22 + 4;
    b.rect(0, 0, 40, H, 'metal', 2); b.hline(0, 39, 0, 'metal', 4); b.vline(39, 0, H - 1, 'metal', 1); b.vline(0, 1, H - 1, 'metal', 3);
    riscos(b, 2, 2, 36, H - 4, 'metal', 2, 13, 8);
    for (let i = 0; i < linhas; i++) {
      const y = 2 + i * 22 + 10;
      b.rect(1, y, 38, 11, 'metal', 3); b.hline(1, 38, y, 'metal', 5); b.hline(1, 38, y + 10, 'metal', 0);
      b.rect(3, y + 2, 34, 2, 'metal', 1);
    }
    contorno(b, 'carvao', 0);
  });
  /* O cartão de ponto guardado no bolso: só a parte de cima aparece. */
  const cartaoArt = (seed, marcado) => U.art(`im:ponto:cartao:${seed % 89}:${marcado}`, 34, 16, b => {
    b.rect(0, 0, 34, 16, 'papel', 5); b.hline(0, 33, 0, 'papel', 7); b.vline(33, 0, 15, 'papel', 3); b.vline(0, 1, 15, 'papel', 6);
    b.rect(0, 0, 34, 3, marcado ? 'vermelho' : 'azul', 3); b.hline(0, 33, 0, marcado ? 'vermelho' : 'azul', 4);
    const R = K.rng(seed);
    b.hline(2, 31, 4, 'tinta', 4);
    for (let y = 12; y < 15; y += 2) b.hline(3, 3 + Math.floor(8 + R() * 14), y, 'tinta', 4);
    b.rect(2, 5, 30, 6, 'papel', 6); b.hline(2, 31, 11, 'papel', 3);
    b.px(31, 2, 'papel', 7);
    if (marcado) { b.rect(23, 12, 9, 3, 'vermelho', 4); b.hline(23, 31, 12, 'vermelho', 5); }
    contorno(b, 'carvao', 0);
  });

  Tipos.register('relogio_ponto', {
    label: 'Relógio de ponto', icon: 'relogio_ponto', sound: 'maquina', categoria: 'interacao', veil: .66,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'hora', label: 'Hora no mostrador (HH:MM)', kind: 'text', placeholder: '03:17'},
      {id: 'cartoes', label: 'Cartões: Nome | Função | 07:58 entrou, 12:02 saiu | observação (um por linha)', kind: 'textarea', rows: 6},
      {id: 'bater', label: 'Deixa bater o ponto', kind: 'select', options: [['sim', 'Sim'], ['nao', 'Não (só olhar)']]},
      {id: 'aviso', label: 'Aviso colado ao lado', kind: 'text'}],
    defaults: {titulo: '', hora: '03:17',
      cartoes: 'JUREMA S. | Limpeza | 05:02 entrou, 14:00 saiu | Sempre a primeira a chegar.\n' +
        'ALTAIR R. | Protocolo | 07:58, 12:02, 13:01, 17:44\n' +
        'M. CALDEIRA | Gabinete | 09:30, 18:12 | Duas batidas no mesmo minuto no dia 12.\n' +
        'ANEXO — MANUT. | — | 03:17 | Só uma batida, e sempre na mesma hora.',
      bater: 'sim', aviso: 'BATER O PONTO É OBRIGATÓRIO'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!mem.extras || typeof mem.extras !== 'object' || Array.isArray(mem.extras)) mem.extras = {};
      if (!Array.isArray(mem.lidos)) mem.lidos = [];
      const st = {mem, foco: -1, puxa: 0, tremor: 0, carimbo: null, cartoes: []};
      this.preparar(st, clue);
      return st;
    },
    preparar(st, clue) {
      const txt = String(clue.data?.cartoes ?? '');
      if (st.txt === txt && st.cartoes.length) return st.cartoes;
      st.txt = txt;
      st.cartoes = parseCartoes(txt);
      if (!st.cartoes.length) st.cartoes = [{nome: 'SEM NOME', funcao: '', nota: '', batidas: [], key: '#0'}];
      if (st.foco >= st.cartoes.length) st.foco = -1;
      return st.cartoes;
    },
    batidasDe(st, c) { return [...c.batidas, ...(st.mem.extras[c.key] || [])]; },
    describe: st => ({foco: st.foco, puxa: +st.puxa.toFixed(2), cartoes: st.cartoes?.length || 0,
      extras: JSON.parse(JSON.stringify(st.mem?.extras || {})), lidos: [...(st.mem?.lidos || [])]}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t;
      const cartoes = this.preparar(st, clue);
      const aberto = st.foco >= 0;
      st.puxa = toward(st.puxa, aberto ? 1 : 0, 1 / .3, dt);
      st.tremor = Math.max(0, st.tremor - dt);
      if (st.carimbo) { st.carimbo.t += dt; if (st.carimbo.t > 1.1) st.carimbo = null; }
      U.blit(ctx, fundoArt('escritorio'), 0, 22);
      const e = easeIO(st.puxa);
      // O conjunto: divisória esquerda, relógio, divisória direita.
      const linhas = Math.max(2, Math.ceil(cartoes.length / 2));
      const largura = 40 + 44 + 40, cx = CENTRO + (112 - CENTRO) * e;
      const tremor = st.tremor > 0 ? Math.round(Math.sin(st.tremor * 90) * 1.5) * 2 : 0;
      const ox = snap(cx - largura + tremor), oy = 46;
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      const rack = rackPonto(linhas);
      U.rect(ctx, X(0) + 4, Y(4) + 4, 80, rack.height * 2, '#05020866');
      U.rect(ctx, X(84) + 4, Y(4) + 4, 80, rack.height * 2, '#05020866');
      U.blit(ctx, rack, X(0), Y(4));
      U.blit(ctx, rack, X(84), Y(4));
      // Os cartões nos bolsos.
      st.pos = [];
      for (let i = 0; i < cartoes.length; i++) {
        const lado = i % 2, fila = Math.floor(i / 2);
        const bx = X(lado ? 87 : 3), by = Y(7 + fila * 22);
        const marcado = (st.mem.extras[cartoes[i].key] || []).length > 0;
        const hot = ui.region('cartao', bx - 2, by - 4, 72, 34, {data: i, silent: true});
        const sobe = (hot ? 3 : 0) + (st.foco === i ? 5 : 0);
        st.pos.push([bx, by]);
        if (st.foco === i && st.puxa > .04) continue;   // esse está na mão
        U.rect(ctx, bx + 3, by - sobe * 2 + 3, 68, 32, '#07030a66');
        U.blit(ctx, cartaoArt(sementeDe(cartoes[i].key), marcado), bx, by - sobe * 2);
        K.drawText(ctx, cortar(cartoes[i].nome, 62), bx + 34, by - sobe * 2 + 11, {color: C('tinta', 1), align: 'center'});
        if (hot) U.ants(ctx, bx - 3, by - sobe * 2 - 3, 74, 38, t);
      }
      // O relógio.
      const rx = X(42), ry = Y(0);
      U.rect(ctx, rx + 4, ry + 4, 88, 148, '#05020899');
      U.blit(ctx, corpoPonto(), rx, ry);
      // Mostrador aceso.
      {
        const hora = (String(d.hora || '').match(/\d{1,2}:\d{2}/) || ['03:17'])[0];
        const mx = rx + 12, my = ry + 22;
        U.rect(ctx, mx, my, 64, 28, '#09060a');
        const piscando = Math.floor(t * 2) % 2;
        K.drawText(ctx, hora.replace(':', piscando ? ':' : ' '), mx + 32, my + 4, {color: C('ambar', 5), align: 'center', scale: 2});
        K.drawText(ctx, 'PONTO', mx + 32, my + 20, {color: C('ambar', 2), align: 'center'});
        ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#ffb45a'; ctx.fillRect(mx - 4, my - 4, 72, 36); ctx.restore();
      }
      // A boca do cartão: brilha quando há um cartão na mão e dá para bater.
      const podeBater = chave(d.bater) !== 'nao' && aberto && st.puxa > .9;
      {
        const bx = rx + 16, by = ry + 88;
        const hot = ui.region('boca', bx - 6, by - 8, 68, 26, {silent: true});
        if (podeBater) { U.ants(ctx, bx - 8, by - 10, 72, 30, t); if (hot) U.tooltip(ctx, 'bater o ponto', bx + 28, by - 26); }
        // O cartão entrando e o carimbo descendo.
        if (st.carimbo) {
          const u = clamp(st.carimbo.t / .45, 0, 1), volta = clamp((st.carimbo.t - .55) / .5, 0, 1);
          const cy = by - 34 + Math.round(u * 16) * 2 - Math.round(volta * 16) * 2;
          U.blit(ctx, cartaoArt(sementeDe(st.carimbo.key), true), bx, cy);
          if (st.carimbo.t > .45 && st.carimbo.t < .62) { U.rect(ctx, bx + 46, by - 12, 14, 12, C('vermelho', 4)); U.rect(ctx, bx + 46, by - 12, 14, 3, C('vermelho', 6)); }
        }
      }
      // Aviso ao lado.
      const aviso = String(d.aviso || '').trim();
      if (aviso && !aberto) {
        const lin = K.wrap(aviso, 82).slice(0, 4), aw = 96, ah = lin.length * 12 + 20;
        const ax = snap(clamp(X(largura) + 16, 8, SW - aw - 8)), ay = 60;
        U.rect(ctx, ax + 3, ay + 3, aw, ah, '#05020888');
        U.blit(ctx, papelArt(aw / 2, Math.ceil(ah / 2), 5), ax, ay);
        U.tape(ctx, ax + aw / 2 - 16, ay - 5, 32, 10);
        U.hand(ctx, lin.join('\n'), ax + 8, ay + 8, {color: C('tinta', 2), width: aw - 12, lineHeight: 12, seed: 6});
      }
      // O cartão puxado, de perto.
      if (aberto || st.puxa > 0) {
        const c = cartoes[clamp(st.foco < 0 ? 0 : st.foco, 0, cartoes.length - 1)];
        const px = snap(PAINEL.x + (1 - e) * (SW - PAINEL.x + 20)), py = PAINEL.y;
        const batidas = this.batidasDe(st, c), novas = (st.mem.extras[c.key] || []).length;
        const alt = snap(clamp(72 + Math.ceil(batidas.length / 2) * 14 + (c.nota ? K.wrap(c.nota, PAINEL.w - 34).length * 12 + 8 : 0) + 26, 110, PAINEL.h));
        U.rect(ctx, px + 5, py + 5, PAINEL.w, alt, '#05020899');
        U.blit(ctx, papelArt(Math.ceil(PAINEL.w / 2), Math.ceil(alt / 2), sementeDe(c.key)), px, py);
        // Tarja de cima e o nome.
        U.rect(ctx, px, py, PAINEL.w, 8, novas ? C('vermelho', 3) : C('azul', 3));
        U.rect(ctx, px, py, PAINEL.w, 2, novas ? C('vermelho', 5) : C('azul', 4));
        U.text(ctx, cortar(c.nome.toUpperCase(), PAINEL.w - 24), px + 12, py + 14, {color: C('tinta', 1), bold: true});
        if (c.funcao) K.drawText(ctx, cortar(c.funcao, PAINEL.w - 24), px + 12, py + 26, {color: C('papel', 1)});
        U.rect(ctx, px + 12, py + 36, PAINEL.w - 24, 1, C('tinta', 3));
        K.drawText(ctx, 'ENTRADA', px + 22, py + 42, {color: C('papel', 2)});
        K.drawText(ctx, 'SAÍDA', px + 122, py + 42, {color: C('papel', 2)});
        let y = py + 54;
        for (let i = 0; i < batidas.length; i += 2) {
          const nova = i >= c.batidas.length;
          U.rect(ctx, px + 16, y - 2, PAINEL.w - 32, 1, C('papel', 3));
          K.drawText(ctx, batidas[i], px + 22, y, {color: nova ? C('vermelho', 2) : C('tinta', 1)});
          if (batidas[i + 1]) K.drawText(ctx, batidas[i + 1], px + 122, y, {color: nova ? C('vermelho', 2) : C('tinta', 1)});
          if (nova && st.carimbo && st.carimbo.t > .5) { ctx.save(); ctx.globalAlpha = clamp((st.carimbo.t - .5) * 4, 0, 1); U.stamp(ctx, 'BATIDO', px + 150, y - 6, {scale: 1, seed: 4}); ctx.restore(); }
          y += 14;
        }
        if (!batidas.length) { K.drawText(ctx, 'Nenhuma batida neste cartão.', px + 22, y, {color: C('papel', 1)}); y += 16; }
        if (c.nota) { y += 6; y += U.hand(ctx, c.nota, px + 16, y, {color: C('vermelho', 3), width: PAINEL.w - 34, lineHeight: 12, seed: 8}) * 12; }
        ui.button(ctx, 'guardar', px + PAINEL.w - 78, py + alt - 26, 66, 18, 'GUARDAR', {style: 'papel'});
        if (chave(d.bater) !== 'nao') ui.button(ctx, 'bater', px + 12, py + alt - 26, 84, 18, 'BATER', {style: 'papel', disabled: !!st.carimbo});
      }
      const titulo = campo(d.titulo, clue.name);
      const dica = st.carimbo ? 'batendo…' : aberto ? (chave(d.bater) === 'nao' ? 'clique em GUARDAR para devolver' : 'BATER imprime a hora de agora') : 'clique num cartão para puxar';
      U.header(ctx, ui, titulo, dica, 'relogio_ponto');
    },
    bater(st, clue, sys) {
      const c = st.cartoes[st.foco];
      if (!c || st.carimbo) return;
      if (chave(clue.data?.bater) === 'nao') { sys.sfx('erro'); return; }
      const hora = (String(clue.data?.hora || '').match(/\d{1,2}:\d{2}/) || ['03:17'])[0];
      (st.mem.extras[c.key] ||= []).push(hora);
      st.carimbo = {t: 0, key: c.key};
      st.tremor = .3;
      sys.sfx('carimbo');
      sys.toast('PONTO BATIDO', `${c.nome} · ${hora}`, 'relogio_ponto');
      sys.emit('change');
    },
    action(id, st, clue, sys, info = {}) {
      this.preparar(st, clue);
      switch (id) {
        case 'cartao': {
          const i = Number(info.data);
          if (st.foco === i) { st.foco = -1; sys.sfx('papel'); return; }
          st.foco = i;
          const c = st.cartoes[i];
          if (c && !st.mem.lidos.includes(c.key)) { st.mem.lidos.push(c.key); sys.emit('change'); }
          sys.sfx('papel');
          break;
        }
        case 'guardar': st.foco = -1; sys.sfx('papel'); break;
        case 'bater': case 'boca': if (st.foco >= 0) this.bater(st, clue, sys); else sys.sfx('clique'); break;
      }
    },
    key(e, st, clue, sys) {
      if (e.key === 'Escape' && st.foco >= 0) { st.foco = -1; return true; }
      if ((e.key === 'Enter' || e.key === ' ') && st.foco >= 0) { this.bater(st, clue, sys); return true; }
      return false;
    },
    rotuloAcao: 'Ver o relógio de ponto'
  });

  /* ================================================================ caixa_registradora
     Teclas que afundam, bobina impressa com as últimas vendas, e a gaveta que
     salta com o tlim mostrando os cofrinhos de moeda e as divisões das notas. */
  const TECLAS_REG = [['7', 0, 0], ['8', 1, 0], ['9', 2, 0], ['4', 0, 1], ['5', 1, 1], ['6', 2, 1],
    ['1', 0, 2], ['2', 1, 2], ['3', 2, 2], ['0', 0, 3], ['00', 1, 3], ['<', 2, 3]];

  const corpoRegistradora = () => U.art('im:registradora:corpo', 112, 74, b => {
    // Corpo de latão com painéis esmaltados.
    b.rect(4, 26, 104, 44, 'latao', 3); b.hline(4, 107, 26, 'latao', 5); b.vline(107, 26, 69, 'latao', 1); b.vline(4, 27, 69, 'latao', 4);
    b.hline(4, 107, 69, 'latao', 0);
    b.rect(8, 30, 96, 36, 'vermelho', 1); b.frame(8, 30, 96, 36, 'latao', 4);
    // Arabescos gravados nos cantos.
    for (const [x, y, fx, fy] of [[10, 32, 1, 1], [101, 32, -1, 1], [10, 63, 1, -1], [101, 63, -1, -1]]) {
      for (let i = 0; i < 5; i++) b.px(x + i * fx, y + Math.round(Math.sin(i / 2) * 2) * fy, 'latao', 5);
      b.px(x + fx, y + 2 * fy, 'latao', 4);
    }
    // Torre do mostrador.
    b.rect(16, 2, 80, 24, 'latao', 3); b.hline(16, 95, 2, 'latao', 5); b.vline(95, 2, 25, 'latao', 1); b.vline(16, 3, 25, 'latao', 4);
    b.rect(20, 6, 72, 16, 'carvao', 0); b.frame(20, 6, 72, 16, 'latao', 4);
    b.hline(21, 91, 7, 'carvao', 1);
    b.poly([[16, 2], [26, -2], [86, -2], [96, 2]], 'latao', 4); b.hline(26, 85, -2, 'latao', 6);
    // Base larga e pés.
    b.rect(2, 66, 108, 6, 'latao', 2); b.hline(2, 109, 66, 'latao', 4); b.hline(2, 109, 71, 'latao', 0);
    b.rect(8, 72, 12, 2, 'carvao', 2); b.rect(92, 72, 12, 2, 'carvao', 2);
    // Eixo da bobina, à direita da torre.
    b.rect(96, 8, 12, 12, 'metal', 3); b.ellipse(102, 14, 5, 5, 'papel', 5); b.ellipse(102, 14, 1.6, 1.6, 'metal', 2);
    b.hline(96, 107, 8, 'metal', 5);
    b.shadeFn(0, 0, 112, 74, (x, y) => faixas((.45 - Math.hypot((x - 84) / 130, (y - 6) / 130)) * 1.5));
    contorno(b, 'carvao', 0);
  });
  /* A gaveta, vista de cima e de frente ao sair: cofrinhos de moeda atrás e as
     divisões de nota na frente. */
  const gavetaArt = () => U.art('im:registradora:gaveta', 100, 30, b => {
    b.poly([[0, 0], [100, 0], [96, 24], [4, 24]], 'madeira', 3);
    b.hline(0, 99, 0, 'madeira', 5); b.line(0, 0, 4, 24, 'madeira', 4); b.line(100, 0, 96, 24, 'madeira', 1);
    b.poly([[3, 2], [97, 2], [94, 13], [6, 13]], 'madeira', 1);
    // Cofrinhos de moeda (fundo).
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 18;
      b.poly([[x, 3], [x + 15, 3], [x + 14, 12], [x + 1, 12]], 'madeira', 2);
      b.hline(x, x + 14, 3, 'madeira', 0); b.hline(x + 1, x + 13, 12, 'madeira', 4);
    }
    // Divisões de nota (frente).
    b.poly([[5, 14], [95, 14], [92, 23], [8, 23]], 'madeira', 2);
    for (let i = 0; i < 4; i++) { const x = 9 + i * 22; b.line(x, 14, x - 1, 23, 'madeira', 4); }
    b.rect(2, 23, 96, 4, 'madeira', 4); b.hline(2, 97, 23, 'madeira', 5); b.hline(2, 97, 26, 'madeira', 0);
    b.rect(42, 27, 16, 3, 'latao', 4); b.hline(42, 57, 27, 'latao', 6);
    contorno(b, 'carvao', 0);
  });
  /* Uma nota dobrada e um montinho de moedas para dentro da gaveta. */
  const dinheiroArt = seed => U.art('im:registradora:dinheiro:' + (seed % 53), 100, 26, b => {
    const R = K.rng(seed);
    for (let i = 0; i < 5; i++) {
      const x = 9 + i * 18, n = Math.floor(R() * 4);
      for (let k = 0; k < n; k++) { b.ellipse(x + 6, 10 - k * 2, 4, 1.6, 'latao', 2); b.ellipse(x + 6, 9 - k * 2, 4, 1.6, 'latao', k === n - 1 ? 5 : 4); }
    }
    for (let i = 0; i < 4; i++) {
      if (R() < .2) continue;
      const x = 11 + i * 22, cor = ['verde', 'azul', 'vermelho', 'roxo'][i % 4];
      for (let k = 0; k < 1 + Math.floor(R() * 2); k++) {
        b.rect(x + k, 15 + k, 17, 7, cor, 2); b.hline(x + k, x + 16 + k, 15 + k, cor, 4); b.hline(x + k, x + 16 + k, 21 + k, cor, 0);
        b.ellipse(x + 8 + k, 18 + k, 3, 2, cor, 3); b.px(x + 7 + k, 17 + k, cor, 5);
      }
    }
  });

  Tipos.register('caixa_registradora', {
    label: 'Caixa registradora', icon: 'registradora', sound: 'maquina', categoria: 'interacao', veil: .66,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'mostrador', label: 'Valor no mostrador quando fechada', kind: 'text', placeholder: '0,00'},
      {id: 'bobina', label: 'Bobina, últimas vendas: Item | valor (uma por linha)', kind: 'textarea', rows: 5},
      {id: 'gaveta', label: 'O que há na gaveta (itens: moedas*12, chave=Cofre)', kind: 'text'},
      {id: 'texto', label: 'O que se vê na gaveta aberta', kind: 'textarea', rows: 2},
      {id: 'tranca', label: 'Tranca da gaveta', kind: 'select', options: [['nenhuma', 'Abre sozinha'], ['chave', 'Precisa de chave'], ['travada', 'Emperrada (não abre)']]},
      {id: 'chave', label: 'Nome da chave exigida (vazio = qualquer)', kind: 'text'},
      {id: 'mensagem', label: 'Aviso quando não abre', kind: 'text'}],
    defaults: {titulo: '', mostrador: '0,00',
      bobina: 'CAFE | 2,00\nPAO NA CHAPA | 3,50\nREFRIGERANTE | 5,00\nSEM VENDA | ---\nSEM VENDA | ---',
      gaveta: 'moedas*9', texto: 'Notas amassadas de pé na divisão errada e um bilhete dobrado embaixo da bandeja.',
      tranca: 'nenhuma', chave: '', mensagem: 'A gaveta não cede. Alguém forçou antes.'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!Array.isArray(mem.pegos)) mem.pegos = [];
      return {mem, digitado: '', gaveta: mem.gaveta ? 1 : 0, press: {}, tremor: 0, tlim: 0, bobina: !!mem.bobina,
        itensRegioes: [], itemShake: null};
    },
    itens(clue, st) { return parseItens(clue.data?.gaveta).filter(it => !(st.mem.pegos || []).includes(it.key)); },
    describe: st => ({digitado: st.digitado, gaveta: +st.gaveta.toFixed(2), aberta: !!st.mem?.gaveta, bobina: !!st.bobina,
      pegos: [...(st.mem?.pegos || [])]}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t, mem = st.mem;
      st.gaveta = toward(st.gaveta, mem.gaveta ? 1 : 0, 1 / .34, dt);
      st.tremor = Math.max(0, st.tremor - dt);
      st.tlim = Math.max(0, st.tlim - dt);
      if (st.itemShake) st.itemShake.t -= dt;
      for (const k in st.press) st.press[k] = Math.max(0, st.press[k] - dt);
      U.blit(ctx, fundoArt('escritorio'), 0, 22);
      const painel = st.bobina || (mem.gaveta && this.itens(clue, st).length >= 0 && st.gaveta > .9);
      const e = easeIO(painel ? 1 : 0);
      const G = {w: 112, h: 74};
      const cx = CENTRO + (128 - CENTRO) * e;
      const tremor = st.tremor > 0 ? Math.round(Math.sin(st.tremor * 80) * 1.5) * 2 : 0;
      const ox = snap(cx - G.w + tremor), oy = 58;
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      // O balcão onde ela está.
      {
        const by = Y(71);
        U.rect(ctx, 0, by, SW, 6, C('mogno', 4));
        U.rect(ctx, 0, by, SW, 2, C('mogno', 5));
        U.rect(ctx, 0, by + 6, SW, SH - by - 6, C('mogno', 2));
        for (let x = 0; x < SW; x += 46) U.rect(ctx, x, by + 6, 2, SH - by - 6, C('mogno', 1));
        ctx.save(); ctx.globalAlpha = .4; ctx.fillStyle = '#07030a';
        ctx.fillRect(snap(ox + 8), by - 4, G.w * 2 - 16, 4); ctx.restore();
      }
      // A gaveta saltada (por baixo da máquina, vindo para a frente).
      if (st.gaveta > .01) {
        const u = ease(st.gaveta), gy = Y(60) + Math.round(u * 13) * 2;
        U.rect(ctx, X(6) + 4, gy + 4, 200, 60, '#05020899');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(gavetaArt(), 0, 0, 100, 30, snap(X(6)), snap(gy), 200, 60);
        if (u > .5) {
          ctx.save(); ctx.globalAlpha = clamp((u - .5) * 4, 0, 1);
          ctx.drawImage(dinheiroArt(sementeDe(clue.id)), 0, 0, 100, 26, snap(X(6)), snap(gy + 4), 200, 52);
          ctx.restore();
        }
      }
      U.blit(ctx, corpoRegistradora(), ox, oy);
      // Mostrador: o valor digitado em placas brancas, ou a etiqueta SEM VENDA.
      {
        const mx = X(20), my = Y(6), mw = 144;
        U.rect(ctx, mx, my, mw, 32, '#0a0710');
        const val = st.digitado ? this.formatar(st.digitado) : (mem.gaveta ? 'SEM VENDA' : campo(d.mostrador, '0,00'));
        // Plaquinhas brancas atrás do vidro.
        const tw = K.measure(val, '5x7') * 2;
        K.drawText(ctx, val, mx + mw / 2, my + 10, {color: C('papel', 6), align: 'center', scale: 2});
        U.rect(ctx, mx + (mw - tw) / 2 - 6, my + 24, tw + 12, 2, C('papel', 2));
        ctx.save(); ctx.globalAlpha = .1; ctx.fillStyle = '#a6d8ec'; ctx.fillRect(mx, my, mw, 12); ctx.restore();
      }
      // Bobina: a fita de papel descendo da direita.
      {
        const bx = X(99), by = Y(20);
        const linhas = parseBobina(d.bobina);
        const alt = clamp(linhas.length * 8 + 10, 22, 60);
        U.rect(ctx, bx + 2, by + 2, 26, alt, '#07030a55');
        U.rect(ctx, bx, by, 26, alt, C('papel', 5));
        U.rect(ctx, bx, by, 26, 2, C('papel', 6)); U.rect(ctx, bx, by + alt - 2, 26, 2, C('papel', 2));
        for (let i = 0; i < linhas.length && i * 8 + 6 < alt; i++) {
          U.rect(ctx, bx + 3, by + 5 + i * 8, 14 + (i % 3) * 3, 1, C('tinta', 2));
          U.rect(ctx, bx + 20, by + 5 + i * 8, 4, 1, C('tinta', 2));
        }
        const hot = ui.region('bobina', bx - 4, by - 4, 34, alt + 10, {silent: true});
        if (hot) { U.ants(ctx, bx - 5, by - 5, 36, alt + 12, t); U.tooltip(ctx, 'ler a bobina', bx + 13, by - 22); }
      }
      // O teclado: teclas redondas que afundam.
      for (const [rot, col, fila] of TECLAS_REG) {
        const kx = X(14 + col * 14), ky = Y(34 + fila * 8), press = st.press['t' + rot] > 0;
        const hot = ui.region('tecla', kx - 2, ky - 2, 24, 16, {data: rot, silent: true});
        U.rect(ctx, kx + 2, ky + 2 + (press ? 2 : 0), 20, 12, '#07030a66');
        U.rect(ctx, kx, ky + (press ? 2 : 0), 20, 12, hot ? C('papel', 6) : C('papel', 5));
        U.rect(ctx, kx, ky + (press ? 2 : 0), 20, 2, C('papel', 7));
        U.rect(ctx, kx, ky + 10 + (press ? 2 : 0), 20, 2, C('papel', 2));
        K.drawText(ctx, rot, kx + 10, ky + 3 + (press ? 2 : 0), {color: C('tinta', 1), align: 'center'});
      }
      // A tecla grande da direita.
      {
        const kx = X(58), ky = Y(34), press = st.press.total > 0;
        const hot = ui.region('total', kx - 2, ky - 2, 74, 44, {silent: true});
        U.rect(ctx, kx + 3, ky + 3 + (press ? 2 : 0), 70, 40, '#07030a77');
        U.rect(ctx, kx, ky + (press ? 2 : 0), 70, 40, hot ? C('vermelho', 4) : C('vermelho', 3));
        U.rect(ctx, kx, ky + (press ? 2 : 0), 70, 3, C('vermelho', 5));
        U.rect(ctx, kx, ky + 37 + (press ? 2 : 0), 70, 3, C('vermelho', 1));
        K.drawText(ctx, mem.gaveta ? 'FECHAR' : 'ABRIR', kx + 35, ky + 10 + (press ? 2 : 0), {color: C('papel', 6), align: 'center'});
        K.drawText(ctx, 'GAVETA', kx + 35, ky + 24 + (press ? 2 : 0), {color: C('papel', 4), align: 'center'});
        if (st.tlim > 0) { ctx.save(); ctx.globalAlpha = st.tlim * 1.6; U.outline(ctx, kx - 4, ky - 4, 78, 48, '#ffe6a0', 2); ctx.restore(); }
      }
      // Painel: bobina lida ou o que há na gaveta.
      if (painel) {
        const px = snap(PAINEL.x + (1 - e) * (SW - PAINEL.x + 20));
        if (st.bobina) {
          const linhas = parseBobina(d.bobina);
          const alt = snap(clamp(56 + linhas.length * 13 + 26, 110, PAINEL.h));
          U.rect(ctx, px + 5, PAINEL.y + 5, PAINEL.w, alt, '#05020899');
          U.blit(ctx, papelArt(Math.ceil(PAINEL.w / 2), Math.ceil(alt / 2), 3), px, PAINEL.y);
          for (let i = 0; i < 12; i++) U.rect(ctx, px + 8 + i * 18, PAINEL.y, 10, 2, C('papel', 2));
          U.text(ctx, 'BOBINA', px + 14, PAINEL.y + 12, {color: C('tinta', 1), bold: true});
          U.rect(ctx, px + 14, PAINEL.y + 24, PAINEL.w - 28, 1, C('tinta', 3));
          let y = PAINEL.y + 32;
          for (const l of linhas) {
            K.drawText(ctx, cortar(l.item, PAINEL.w - 90), px + 16, y, {color: C('tinta', 1)});
            K.drawText(ctx, l.valor, px + PAINEL.w - 18, y, {color: C('tinta', 1), align: 'right'});
            y += 13;
          }
          if (!linhas.length) K.drawText(ctx, 'A bobina saiu em branco.', px + 16, y, {color: C('papel', 1)});
          ui.button(ctx, 'fechar_painel', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'VOLTAR', {style: 'papel'});
        } else {
          const alt = painelConteudo(ctx, ui, st, sys, {px, py: PAINEL.y, w: PAINEL.w, h: PAINEL.h, nome: 'Na gaveta',
            texto: campo(d.texto, this.defaults.texto), itens: this.itens(clue, st), vazio: 'A gaveta está limpa: nem uma moeda.', seed: sementeDe(clue.id), rodape: 24});
          ui.button(ctx, 'fechar_gaveta', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'FECHAR', {style: 'papel'});
        }
      }
      const titulo = campo(d.titulo, clue.name);
      const dica = st.bobina ? 'as últimas vendas do dia' : mem.gaveta ? 'clique no dinheiro para pegar' :
        st.digitado ? 'aperte ABRIR GAVETA' : 'digite um valor ou abra a gaveta';
      U.header(ctx, ui, titulo, dica, 'registradora');
    },
    formatar(digitos) {
      const s = String(digitos || '0').replace(/\D/g, '').slice(-7) || '0';
      const n = s.padStart(3, '0');
      return `${n.slice(0, -2).replace(/^0+(?=\d)/, '')},${n.slice(-2)}`;
    },
    abrirGaveta(st, clue, sys) {
      const mem = st.mem, tr = chave(clue.data?.tranca);
      if (mem.gaveta) { mem.gaveta = false; st.digitado = ''; sys.sfx('gaveta'); sys.emit('change'); return; }
      if (tr === 'travada') { st.tremor = .4; sys.sfx('tranca'); sys.toast('EMPERRADA', campo(clue.data?.mensagem, this.defaults.mensagem), 'alerta'); return; }
      if (tr === 'chave' && !mem.destrancada) {
        const nome = String(clue.data?.chave || '').trim(), bolsa = sys.itens;
        let tem = false;
        try { tem = !bolsa ? true : (typeof bolsa.temChave === 'function' ? (!!bolsa.temChave(nome) || (!nome && (bolsa.contar?.('chave') || 0) > 0)) : (bolsa.contar?.('chave') || 0) > 0); } catch (erro) { console.error(erro); }
        if (!tem) { st.tremor = .4; sys.sfx('tranca'); sys.toast('TRANCADA', nome ? `Falta a chave: ${nome}` : 'Precisa de uma chave', 'cadeado'); return; }
        mem.destrancada = true; sys.sfx('destranca');
      }
      mem.gaveta = true; st.tlim = .5; st.tremor = .22;
      sys.sfx('tlim');
      sys.emit('change');
    },
    pegar(key, st, clue, sys) {
      const it = this.itens(clue, st).find(x => x.key === key);
      if (!it) return;
      const r = entregar(sys, it, 'PEGOU');
      if (r === 'bolsa' || r === 'chao') { (st.mem.pegos ||= []).push(key); sys.emit('change'); }
      else st.itemShake = {key, t: .35};
    },
    tecla(k, st, sys) {
      st.press['t' + k] = .12;
      if (k === '<') st.digitado = st.digitado.slice(0, -1);
      else if (k === '00') st.digitado = (st.digitado + '00').slice(-7);
      else st.digitado = (st.digitado + k).slice(-7);
      sys.sfx('tecla');
    },
    action(id, st, clue, sys, info = {}) {
      switch (id) {
        case 'tecla': this.tecla(String(info.data), st, sys); break;
        case 'total': st.press.total = .16; st.bobina = false; this.abrirGaveta(st, clue, sys); break;
        case 'bobina': st.bobina = !st.bobina; sys.sfx('papel'); if (st.bobina) { st.mem.bobina = true; sys.emit('change'); } break;
        case 'fechar_painel': st.bobina = false; sys.sfx('clique'); break;
        case 'fechar_gaveta': this.abrirGaveta(st, clue, sys); break;
        case 'item': this.pegar(String(info.data), st, clue, sys); break;
      }
    },
    wantsKeys: () => true,
    key(e, st, clue, sys) {
      if (/^\d$/.test(e.key)) { this.tecla(e.key, st, sys); return true; }
      if (e.key === 'Backspace') { this.tecla('<', st, sys); return true; }
      if (e.key === 'Enter') { this.abrirGaveta(st, clue, sys); return true; }
      if (e.key === 'Escape' && st.bobina) { st.bobina = false; return true; }
      return false;
    },
    rotuloAcao: 'Mexer na registradora'
  });

  /* ================================================================ leito_hospitalar
     O leito com a manivela que levanta a cabeceira, o prontuário pendurado na
     grade dos pés, o colchão que se revista e o escuro debaixo da cama. */
  const ALTURAS_LEITO = 4;   // 0 = deitado, 3 = quase sentado

  const armacaoLeito = () => U.art('im:leito:armacao', 150, 66, b => {
    // Grades de cabeceira e dos pés, tubo esmaltado.
    for (const [x0, alto] of [[4, 26], [136, 18]]) {
      b.rect(x0, 40 - alto, 4, alto + 14, 'palido', 3); b.vline(x0, 40 - alto, 53, 'palido', 4); b.vline(x0 + 3, 40 - alto, 53, 'palido', 1);
      b.rect(x0 + 6, 40 - alto, 4, alto + 14, 'palido', 3); b.vline(x0 + 6, 40 - alto, 53, 'palido', 4); b.vline(x0 + 9, 40 - alto, 53, 'palido', 1);
      b.rect(x0, 40 - alto, 10, 3, 'palido', 4); b.hline(x0, x0 + 9, 40 - alto, 'palido', 5);
      for (let y = 44 - alto; y < 36; y += 6) b.rect(x0 + 2, y, 6, 2, 'palido', 2);
    }
    // Estrado.
    b.rect(8, 40, 134, 5, 'palido', 3); b.hline(8, 141, 40, 'palido', 5); b.hline(8, 141, 44, 'palido', 1);
    b.rect(10, 45, 130, 3, 'palido', 1);
    // Rodinhas.
    for (const x of [10, 44, 100, 134]) {
      b.rect(x, 53, 4, 4, 'palido', 2);
      b.ellipse(x + 2, 59, 3.4, 3.4, 'carvao', 2); b.ellipse(x + 2, 59, 1.6, 1.6, 'palido', 3); b.px(x + 1, 57, 'carvao', 4);
    }
    // Manivela nos pés.
    b.rect(141, 44, 6, 3, 'metal', 3);
    b.shadeFn(0, 0, 150, 66, (x, y) => faixas((.5 - Math.hypot((x - 110) / 170, (y - 6) / 150)) * 1.4));
    contorno(b, 'carvao', 0);
  });
  /* Grade lateral levantada: tubo com barrinhas. */
  const gradeLeito = () => U.art('im:leito:grade', 76, 20, b => {
    b.rect(0, 0, 76, 3, 'palido', 4); b.hline(0, 75, 0, 'palido', 5); b.hline(0, 75, 2, 'palido', 1);
    b.rect(0, 16, 76, 3, 'palido', 3); b.hline(0, 75, 18, 'palido', 1);
    for (let x = 3; x < 74; x += 9) { b.rect(x, 3, 3, 13, 'palido', 3); b.vline(x, 3, 15, 'palido', 4); b.vline(x + 2, 3, 15, 'palido', 1); }
    b.rect(0, 0, 3, 19, 'palido', 4); b.rect(73, 0, 3, 19, 'palido', 2);
    contorno(b, 'carvao', 0);
  });
  /* Colchão e lençol, com a parte da cabeceira que sobe. */
  const colchaoArt = (mexido) => U.art('im:leito:colchao:' + mexido, 122, 16, b => {
    b.rect(0, 2, 122, 14, 'papel', 4); b.hline(0, 121, 2, 'papel', 6); b.hline(0, 121, 15, 'papel', 2);
    b.rect(0, 2, 122, 3, 'papel', 5);
    // Lençol dobrado por cima, com vincos.
    b.rect(36, 5, 84, 9, 'papel', 6); b.hline(36, 119, 5, 'papel', 7); b.hline(36, 119, 13, 'papel', 4);
    const R = K.rng(mexido ? 31 : 7);
    for (let i = 0; i < (mexido ? 10 : 5); i++) { const x = 40 + Math.floor(R() * 74); b.vline(x, 6, 12, 'papel', 4); b.vline(x + 1, 7, 11, 'papel', 7); }
    if (mexido) { b.poly([[52, 5], [74, 3], [88, 6], [70, 8]], 'papel', 7); b.line(52, 5, 70, 8, 'papel', 3); }
    // Listra azul de hospital.
    b.hline(36, 119, 9, 'agua', 3); b.hline(36, 119, 10, 'agua', 2);
    contorno(b, 'carvao', 0);
  });
  const travesseiroArt = (mexido) => U.art('im:leito:travesseiro:' + mexido, 34, 16, b => {
    // Fronha de hospital: quase retangular, cantos redondos e um vinco no meio.
    b.rect(2, 3, 30, 11, 'papel', 5);
    b.rect(3, 2, 28, 13, 'papel', 5);
    b.hline(3, 30, 2, 'papel', 7); b.hline(2, 31, 3, 'papel', 6);
    b.hline(3, 30, 14, 'papel', 3); b.hline(2, 31, 13, 'papel', 4);
    b.vline(2, 4, 12, 'papel', 4); b.vline(31, 4, 12, 'papel', 4);
    b.rect(5, 5, 24, 5, 'papel', 6);
    b.line(8, 11, 26, 10, 'papel', 3); b.line(9, 12, 25, 11, 'papel', 4);
    if (mexido) { b.line(6, 6, 16, 9, 'papel', 4); b.line(17, 5, 27, 8, 'papel', 4); b.px(20, 3, 'papel', 3); }
    else b.hline(6, 27, 8, 'papel', 7);
    b.rect(28, 4, 3, 9, 'papel', 4);
    contorno(b, 'carvao', 0);
  });
  /* Prancheta do prontuário pendurada na grade dos pés. */
  const pranchetaArt = () => U.art('im:leito:prancheta', 22, 28, b => {
    b.rect(0, 2, 22, 26, 'mogno', 3); b.hline(0, 21, 2, 'mogno', 5); b.vline(21, 2, 27, 'mogno', 1); b.hline(0, 21, 27, 'mogno', 1);
    b.rect(2, 5, 18, 21, 'papel', 6); b.hline(2, 19, 5, 'papel', 7);
    for (let y = 8; y < 24; y += 3) b.hline(4, 4 + Math.floor(6 + (y % 5) * 2), y, 'tinta', 3);
    b.rect(6, 0, 10, 5, 'metal', 4); b.hline(6, 15, 0, 'metal', 6); b.hline(6, 15, 4, 'metal', 1);
    contorno(b, 'carvao', 0);
  });

  Tipos.register('leito_hospitalar', {
    label: 'Leito hospitalar', icon: 'leito', sound: 'objeto', categoria: 'interacao', veil: .66,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'paciente', label: 'Nome na ficha (vazio = leito vago)', kind: 'text'},
      {id: 'prontuario', label: 'O que está escrito no prontuário', kind: 'textarea', rows: 4},
      {id: 'colchao', label: 'Colchão e travesseiro: o que se acha | itens', kind: 'text'},
      {id: 'embaixo', label: 'Debaixo da cama: o que se acha | itens', kind: 'text'},
      {id: 'grade', label: 'Grade lateral', kind: 'select', options: [['levantada', 'Levantada'], ['baixada', 'Baixada']]},
      {id: 'cabeceira', label: 'Cabeceira levantada (0 a 3)', kind: 'text', placeholder: '0'}],
    defaults: {titulo: '', paciente: '',
      prontuario: 'Folha de evolução preenchida até as 02:40 e depois nada. A última linha, em outra letra: “paciente saiu acompanhado — anexo”.',
      colchao: 'O colchão está frio e o vinco no meio não é de quem deitou: é de quem sentou na beirada a noite toda. | moedas*2',
      embaixo: 'Poeira levantada por um pé que arrastou alguma coisa para fora. Ficou um chinelo e uma tampa de frasco. | bandage',
      grade: 'levantada', cabeceira: '0'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!Array.isArray(mem.pegos) && typeof mem.pegos !== 'object') mem.pegos = {};
      if (!mem.pegos || Array.isArray(mem.pegos)) mem.pegos = {};
      const base = clamp(inteiro(clue.data?.cabeceira, 0, 0, ALTURAS_LEITO - 1), 0, ALTURAS_LEITO - 1);
      if (typeof mem.cabeceira !== 'number') mem.cabeceira = base;
      return {mem, cab: mem.cabeceira, painel: null, gira: 0, itensRegioes: [], itemShake: null};
    },
    parte(clue, id) {
      const txt = String(clue.data?.[id] ?? '');
      const c = parseCompartimentos(txt)[0];
      const nomes = {colchao: 'O colchão', embaixo: 'Debaixo da cama'};
      if (!c) return {nome: nomes[id], texto: '', itens: [], key: id};
      // Uma linha só: o "nome" vira o texto quando não há segundo campo.
      const texto = c.texto || c.nome, itens = c.itens;
      return {nome: nomes[id], texto: c.texto ? `${c.nome} ${c.texto}`.trim() : texto, itens, key: id};
    },
    restantes(st, clue, id) {
      const p = this.parte(clue, id), pegos = st.mem.pegos[id] || [];
      return p.itens.filter(it => !pegos.includes(it.key));
    },
    describe: st => ({cabeceira: st.mem?.cabeceira ?? 0, painel: st.painel, pegos: JSON.parse(JSON.stringify(st.mem?.pegos || {})),
      leu: !!st.mem?.leu, mexeu: !!st.mem?.mexeu}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t, mem = st.mem;
      st.cab = toward(st.cab, mem.cabeceira, 2.4, dt);
      st.gira = Math.max(0, st.gira - dt);
      if (st.itemShake) st.itemShake.t -= dt;
      U.blit(ctx, fundoArt('hospital'), 0, 22);
      const e = easeIO(st.painel ? 1 : 0);
      const G = {w: 150, h: 66};
      const cx = CENTRO + (166 - CENTRO) * e;
      const ox = snap(cx - G.w), oy = snap(CHAO_Y - G.h * 2 - 6);
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      // Régua de gases e a luz de cabeceira, na parede atrás da cama.
      {
        const rx = snap(ox + 8), ry = 74;
        U.rect(ctx, rx + 3, ry + 3, 150, 22, '#05020844');
        U.rect(ctx, rx, ry, 150, 22, C('palido', 3));
        U.rect(ctx, rx, ry, 150, 3, C('palido', 4)); U.rect(ctx, rx, ry + 19, 150, 3, C('palido', 1));
        for (let i = 0; i < 3; i++) {
          const gx = rx + 14 + i * 26, cor = ['verde', 'amarelo', 'agua'][i];
          U.rect(ctx, gx, ry + 6, 12, 12, C(cor, 2)); U.rect(ctx, gx, ry + 6, 12, 3, C(cor, 4));
          U.rect(ctx, gx + 4, ry + 10, 4, 4, C('carvao', 1));
        }
        for (let i = 0; i < 2; i++) { const tx = rx + 96 + i * 20; U.rect(ctx, tx, ry + 7, 10, 10, C('palido', 1)); U.rect(ctx, tx + 2, ry + 9, 6, 6, C('carvao', 2)); }
        U.rect(ctx, rx + 134, ry + 6, 12, 12, C('ambar', 4));
        ctx.save(); ctx.globalAlpha = .14; ctx.fillStyle = '#ffd36b'; ctx.fillRect(rx + 122, ry - 6, 36, 40); ctx.restore();
      }
      sombraChao(ctx, ox + 16, CHAO_Y - 4, G.w * 2 - 32, 10, .45);
      U.blit(ctx, armacaoLeito(), ox, oy);
      // Debaixo da cama: uma faixa escura clicável.
      {
        const bx = X(14), by = Y(48), bw = 240, bh = 16;
        const hot = ui.region('embaixo', bx, by, bw, bh, {silent: true});
        ctx.save(); ctx.globalAlpha = .72; ctx.fillStyle = '#08060e'; ctx.fillRect(bx, by, bw, bh); ctx.restore();
        for (let x = 0; x < bw; x += 26) U.rect(ctx, bx + x, by + bh - 4, 12, 2, '#120d18');
        if (this.restantes(st, clue, 'embaixo').length) { const f = (t * 1.2) % 2; if (f < 1) { const s = Math.round((f < .5 ? f : 1 - f) * 6); U.rect(ctx, bx + 120, by + 7, 2, 2, '#ffe6a0'); U.rect(ctx, bx + 120 - s, by + 7, s * 2 + 2, 2, '#ffd36b66'); } }
        if (hot) { U.ants(ctx, bx - 2, by - 2, bw + 4, bh + 4, t); U.tooltip(ctx, 'olhar embaixo', bx + bw / 2, by - 18); }
      }
      // Colchão, com a cabeceira levantada em degraus.
      {
        const ang = st.cab / (ALTURAS_LEITO - 1);
        const cy = Y(30);
        U.blit(ctx, colchaoArt(!!mem.mexeu), X(14), cy);
        // A cabeceira sobe: uma rampa de degraus de 2 px, do encosto até o meio da cama.
        const passos = 16, larg = 8, sobe = Math.round(ang * 19) * 2;
        for (let i = 0; i < passos && sobe; i++) {
          const x = X(14) + i * larg, alto = Math.round(sobe * (passos - i) / passos / 2) * 2;
          if (alto <= 0) continue;
          U.rect(ctx, x, cy - alto, larg, alto + 4, C('papel', 4));
          U.rect(ctx, x, cy - alto, larg, 2, C('papel', 6));
          U.rect(ctx, x, cy - alto + 2, larg, 2, C('papel', 5));
          if (i > 3 && i < 13) U.rect(ctx, x, cy - alto + 8, larg, 2, C('agua', 3));
        }
        if (sobe) { ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#07030a'; ctx.fillRect(snap(X(19)), snap(cy - sobe - 4), 64, 6); ctx.restore(); }
        U.blit(ctx, travesseiroArt(!!mem.mexeu), X(19), cy - sobe - (sobe ? 26 : 14));
        const hot = ui.region('colchao', X(14), cy - sobe - 26, 244, 46 + sobe, {silent: true});
        if (hot) { U.ants(ctx, X(14) - 2, cy - sobe - 28, 248, 50 + sobe, t); U.tooltip(ctx, 'revistar o colchão', X(14) + 122, cy - sobe - 44); }
      }
      // Grade lateral.
      if (chave(d.grade) !== 'baixada') U.blit(ctx, gradeLeito(), X(36), Y(24));
      // Manivela dos pés: gira ao clicar.
      {
        const mx = X(144), my = Y(46), fase = st.gira > 0 ? (1 - st.gira / .4) * Math.PI * 2 : 0;
        const hot = ui.region('manivela', mx - 12, my - 12, 36, 36, {silent: true});
        U.rect(ctx, mx - 2, my, 8, 4, C('metal', 3));
        const hx = mx + 2 + Math.round(Math.cos(fase) * 5) * 2, hy = my + 2 + Math.round(Math.sin(fase) * 5) * 2;
        U.rect(ctx, mx + 2, my + 2, hx - mx, 2, C('metal', 4));
        U.rect(ctx, hx - 2, hy - 2, 6, 6, C('metal', 5)); U.rect(ctx, hx - 2, hy - 2, 6, 2, C('metal', 6));
        if (hot) { U.ants(ctx, mx - 12, my - 12, 36, 36, t); U.tooltip(ctx, mem.cabeceira >= ALTURAS_LEITO - 1 ? 'abaixar a cabeceira' : 'levantar a cabeceira', mx + 6, my - 30); }
      }
      // Prontuário pendurado na grade dos pés.
      {
        const px = X(132), py = Y(16);
        const hot = ui.region('prontuario', px - 4, py - 4, 52, 64, {silent: true});
        U.rect(ctx, px + 3, py + 3, 44, 56, '#05020866');
        U.blit(ctx, pranchetaArt(), px, py);
        const nome = String(d.paciente || '').trim();
        K.drawText(ctx, cortar(nome || 'LEITO VAGO', 116), px + 22, py + 62, {color: nome ? '#ffd18c' : C('agua', 4), align: 'center'});
        if (hot) U.ants(ctx, px - 5, py - 5, 54, 66, t);
        if (!mem.leu) { const f = (t * 1.1) % 1.8; if (f < 1) { const s = Math.round((f < .5 ? f : 1 - f) * 8); U.rect(ctx, px + 40, py - 2, 2, 2, '#fff6c9'); U.rect(ctx, px + 40 - s, py - 2, s * 2 + 2, 2, '#ffd36b'); } }
      }
      // Painel.
      if (st.painel) {
        const px = snap(PAINEL.x + (1 - e) * (SW - PAINEL.x + 20));
        if (st.painel === 'prontuario') {
          const nome = String(d.paciente || '').trim();
          const texto = campo(d.prontuario, this.defaults.prontuario);
          const linhas = K.wrap(texto, PAINEL.w - 34).slice(0, 9);
          const alt = snap(clamp(56 + linhas.length * 12 + 30, 110, PAINEL.h));
          U.rect(ctx, px + 5, PAINEL.y + 5, PAINEL.w, alt, '#05020899');
          U.blit(ctx, papelArt(Math.ceil(PAINEL.w / 2), Math.ceil(alt / 2), 9), px, PAINEL.y);
          U.rect(ctx, px, PAINEL.y, PAINEL.w, 6, C('agua', 3)); U.rect(ctx, px, PAINEL.y, PAINEL.w, 2, C('agua', 4));
          U.text(ctx, 'PRONTUÁRIO', px + 12, PAINEL.y + 12, {color: C('tinta', 1), bold: true});
          K.drawText(ctx, cortar(nome || 'Leito vago', PAINEL.w - 24), px + 12, PAINEL.y + 24, {color: nome ? C('tinta', 2) : C('papel', 1)});
          U.rect(ctx, px + 12, PAINEL.y + 34, PAINEL.w - 24, 1, C('tinta', 3));
          U.hand(ctx, linhas.join('\n'), px + 14, PAINEL.y + 42, {color: C('tinta', 2), width: PAINEL.w - 26, lineHeight: 12, seed: 5});
          ui.button(ctx, 'fechar_painel', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'VOLTAR', {style: 'papel'});
        } else {
          const p = this.parte(clue, st.painel);
          const alt = painelConteudo(ctx, ui, st, sys, {px, py: PAINEL.y, w: PAINEL.w, h: PAINEL.h, nome: p.nome,
            texto: p.texto, itens: this.restantes(st, clue, st.painel), vazio: 'Nada — só o cheiro de desinfetante.', seed: sementeDe(p.key), rodape: 24});
          ui.button(ctx, 'fechar_painel', px + PAINEL.w - 78, PAINEL.y + alt - 26, 66, 18, 'VOLTAR', {style: 'papel'});
        }
      }
      const titulo = campo(d.titulo, clue.name);
      const dica = st.painel === 'prontuario' ? 'a letra muda na última linha' : st.painel ? 'clique no que achou para pegar' :
        'manivela, prontuário, colchão ou embaixo da cama';
      U.header(ctx, ui, titulo, dica, 'leito');
    },
    pegar(key, st, clue, sys) {
      const id = st.painel;
      if (id !== 'colchao' && id !== 'embaixo') return;
      const it = this.restantes(st, clue, id).find(x => x.key === key);
      if (!it) return;
      const r = entregar(sys, it, 'ACHOU');
      if (r === 'bolsa' || r === 'chao') { (st.mem.pegos[id] ||= []).push(key); sys.emit('change'); }
      else st.itemShake = {key, t: .35};
    },
    action(id, st, clue, sys, info = {}) {
      const mem = st.mem;
      switch (id) {
        case 'manivela':
          mem.cabeceira = mem.cabeceira >= ALTURAS_LEITO - 1 ? 0 : mem.cabeceira + 1;
          st.gira = .4; sys.sfx('manivela'); sys.emit('change'); break;
        case 'prontuario': st.painel = st.painel === 'prontuario' ? null : 'prontuario'; if (st.painel) { mem.leu = true; sys.sfx('papel'); sys.emit('change'); } else sys.sfx('clique'); break;
        case 'colchao': st.painel = st.painel === 'colchao' ? null : 'colchao'; if (st.painel) { mem.mexeu = true; sys.sfx('objeto'); sys.emit('change'); } else sys.sfx('clique'); break;
        case 'embaixo': st.painel = st.painel === 'embaixo' ? null : 'embaixo'; sys.sfx(st.painel ? 'objeto' : 'clique'); break;
        case 'fechar_painel': st.painel = null; sys.sfx('clique'); break;
        case 'item': this.pegar(String(info.data), st, clue, sys); break;
      }
    },
    key(e, st) { if (e.key === 'Escape' && st.painel) { st.painel = null; return true; } return false; },
    rotuloAcao: 'Examinar o leito'
  });

  /* ================================================================ monitor_cardiaco
     O traçado corre e apaga como no monitor de verdade (uma barra que varre a
     tela), os números têm cada um a sua cor, e o alarme pisca até alguém
     apertar SILENCIAR. */
  const COLS_ECG = 60;

  const caixaMonitor = () => U.art('im:monitor:caixa', 100, 104, b => {
    // Pedestal com rodinhas.
    b.rect(46, 66, 8, 26, 'metal', 3); b.vline(46, 66, 91, 'metal', 5); b.vline(53, 66, 91, 'metal', 1);
    b.rect(30, 90, 40, 4, 'metal', 3); b.hline(30, 69, 90, 'metal', 5); b.hline(30, 69, 93, 'metal', 1);
    for (const x of [30, 48, 64]) { b.rect(x, 94, 5, 4, 'metal', 2); b.ellipse(x + 2, 99, 3, 3, 'carvao', 2); b.px(x + 1, 97, 'carvao', 4); }
    // Caixa do monitor.
    b.rect(2, 2, 96, 64, 'carvao', 3); b.hline(2, 97, 2, 'carvao', 5); b.vline(97, 2, 65, 'carvao', 1); b.vline(2, 3, 65, 'carvao', 4);
    b.hline(2, 97, 65, 'carvao', 1);
    riscos(b, 4, 4, 92, 60, 'carvao', 3, 17, 8);
    // Moldura da tela.
    b.rect(5, 6, 90, 44, 'carvao', 1); b.frame(5, 6, 90, 44, 'carvao', 0);
    b.rect(7, 8, 86, 40, 'preto', 0);
    // Alça em cima e a lâmpada do alarme.
    b.rect(38, -1, 24, 4, 'carvao', 4); b.hline(38, 61, -1, 'carvao', 5);
    b.ellipse(89, 4, 3, 3, 'carvao', 0);
    // Grade do alto-falante.
    for (let x = 8; x < 26; x += 3) b.vline(x, 54, 62, 'carvao', 1);
    b.shadeFn(0, 0, 100, 104, (x, y) => faixas((.45 - Math.hypot((x - 76) / 120, (y - 4) / 130)) * 1.4));
    contorno(b, 'carvao', 0);
  });

  Tipos.register('monitor_cardiaco', {
    label: 'Monitor cardíaco', icon: 'monitor', sound: 'beep', categoria: 'interacao', veil: .74,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'paciente', label: 'Nome no alto da tela', kind: 'text'},
      {id: 'ritmo', label: 'Ritmo', kind: 'select', options: [['normal', 'Sinusal'], ['taqui', 'Taquicardia'], ['bradi', 'Bradicardia'],
        ['arritmia', 'Arritmia'], ['assistolia', 'Assistolia (linha reta)'], ['desligado', 'Desligado']]},
      {id: 'bpm', label: 'Batimentos por minuto (vazio = do ritmo)', kind: 'text'},
      {id: 'spo2', label: 'Saturação (SpO₂)', kind: 'text', placeholder: '97'},
      {id: 'pressao', label: 'Pressão', kind: 'text', placeholder: '12/8'},
      {id: 'alarme', label: 'Alarme tocando', kind: 'select', options: [['nao', 'Não'], ['sim', 'Sim']]},
      {id: 'nota', label: 'Recado na tela (vazio = nenhum)', kind: 'text'}],
    defaults: {titulo: '', paciente: 'LEITO 14', ritmo: 'normal', bpm: '', spo2: '97', pressao: '12/8', alarme: 'nao', nota: ''},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      const ritmo = escolha(clue.data?.ritmo, Object.keys(RITMOS), 'normal');
      return {mem, ritmo, onda: ondaCardiaca(ritmo), buf: new Array(COLS_ECG).fill(0), cabeca: 0, fase: 0,
        ligado: mem.desligado ? false : ritmo !== 'desligado', congelado: !!mem.congelado, silencio: mem.silencio || 0,
        bateu: 0, press: {}, alarmeT: 0};
    },
    bpmDe(clue, st) {
      const d = clue.data || {};
      const n = inteiro(d.bpm, 0, 0, 260);
      return n || RITMOS[st.ritmo]?.bpm || 0;
    },
    alarmando(clue, st) {
      if (!st.ligado) return false;
      if (st.silencio > 0) return false;
      if (chave(clue.data?.alarme) === 'sim') return true;
      const bpm = this.bpmDe(clue, st);
      return st.ritmo === 'assistolia' || bpm >= 130 || (bpm > 0 && bpm <= 45);
    },
    describe: st => ({ritmo: st.ritmo, ligado: !!st.ligado, congelado: !!st.congelado, silencio: +Number(st.silencio || 0).toFixed(1),
      cabeca: Math.round(st.cabeca)}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t;
      const ritmo = escolha(d.ritmo, Object.keys(RITMOS), 'normal');
      if (ritmo !== st.ritmo) { st.ritmo = ritmo; st.onda = ondaCardiaca(ritmo); }
      const bpm = this.bpmDe(clue, st);
      if (st.silencio > 0) st.silencio = Math.max(0, st.silencio - dt);
      for (const k in st.press) st.press[k] = Math.max(0, st.press[k] - dt);
      // A varredura: a cabeça anda e escreve a onda no lugar por onde passa.
      if (st.ligado && !st.congelado) {
        const ciclos = Math.max(.35, bpm / 60);           // batimentos por segundo
        const passo = COLS_ECG * ciclos * dt;
        const antes = st.fase;
        st.fase = (st.fase + ciclos * dt) % 1;
        if (st.fase < antes) { st.bateu = .14; if (st.ritmo !== 'assistolia') sys.sfx('bipe_cardiaco'); }
        for (let i = 0; i < Math.ceil(passo); i++) {
          st.cabeca = (st.cabeca + passo / Math.ceil(passo)) % COLS_ECG;
          const idx = Math.floor((st.fase - (Math.ceil(passo) - i - 1) / COLS_ECG / Math.max(.001, ciclos) * ciclos + 1) % 1 * st.onda.length);
          st.buf[Math.floor(st.cabeca)] = st.onda[clamp(idx, 0, st.onda.length - 1)] || 0;
        }
      }
      st.bateu = Math.max(0, st.bateu - dt);
      const alarme = this.alarmando(clue, st);
      if (alarme) { st.alarmeT += dt; if (st.alarmeT > 2) { st.alarmeT = 0; sys.sfx('alarme'); } } else st.alarmeT = 0;
      U.blit(ctx, fundoArt('hospital'), 0, 22);
      const G = {w: 100, h: 104};
      const ox = snap(CENTRO - G.w), oy = snap(CHAO_Y - G.h * 2 + 8);
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      sombraChao(ctx, ox + 56, CHAO_Y + 2, 88, 8, .45);
      U.blit(ctx, caixaMonitor(), ox, oy);
      // A tela.
      const sx = X(7), sy = Y(8), sw = 172, sh = 80;
      if (!st.ligado) {
        U.rect(ctx, sx, sy, sw, sh, '#05040a');
        K.drawText(ctx, 'SEM SINAL', sx + sw / 2, sy + sh / 2 - 4, {color: C('carvao', 4), align: 'center'});
      } else {
        U.rect(ctx, sx, sy, sw, sh, '#04090a');
        // Grade da tela.
        ctx.save(); ctx.globalAlpha = .18;
        for (let x = sx; x < sx + sw; x += 20) U.rect(ctx, x, sy, 2, sh, '#1a5a3a');
        for (let y = sy; y < sy + sh; y += 16) U.rect(ctx, sx, y, sw, 2, '#1a5a3a');
        ctx.restore();
        // Cabeçalho da tela.
        K.drawText(ctx, cortar(semAcento(campo(d.paciente, 'LEITO')).toUpperCase(), 84), sx + 4, sy + 3, {color: C('fosforo', 3)});
        K.drawText(ctx, semAcento(RITMOS[st.ritmo]?.label || ''), sx + sw - 4, sy + 3, {color: alarme ? C('vermelho', 5) : C('fosforo', 3), align: 'right'});
        // O traçado, numa faixa de 60 colunas.
        const tx = sx + 4, ty = sy + 14, th = 40, tw = COLS_ECG * 2;
        let ant = null;
        for (let i = 0; i < COLS_ECG; i++) {
          const dist = (Math.floor(st.cabeca) - i + COLS_ECG) % COLS_ECG;
          if (!st.congelado && dist > COLS_ECG - 4) { ant = null; continue; }   // a barra que apaga
          const y = ty + th / 2 - Math.round(st.buf[i] * th * .46 / 2) * 2;
          const cor = dist < 3 ? '#d8ffe0' : C('fosforo', 4);
          if (ant !== null) { const y0 = Math.min(ant, y), y1 = Math.max(ant, y); U.rect(ctx, tx + i * 2, y0, 2, Math.max(2, y1 - y0)); ctx.fillStyle = cor; ctx.fillRect(snap(tx + i * 2), snap(y0), 2, Math.max(2, y1 - y0 + 2)); }
          else { ctx.fillStyle = cor; ctx.fillRect(snap(tx + i * 2), snap(y), 2, 2); }
          ant = y;
        }
        // Números, na coluna da direita: cada grandeza na sua cor.
        const nx = sx + 130;
        U.rect(ctx, nx - 6, sy + 10, 2, sh - 20, '#1a5a3a');
        const cor3 = ['#4fe08a', '#7fd8ff', '#ffd36b'];
        const linhas = [['BPM', st.ritmo === 'assistolia' ? '0' : String(bpm || '--'), 12],
          ['SPO2', semAcento(campo(d.spo2, '--')), 38], ['PA', semAcento(campo(d.pressao, '--')), 58]];
        linhas.forEach(([rot, val, y0], i) => {
          K.drawText(ctx, rot, nx, sy + y0, {color: cor3[i]});
          K.drawText(ctx, val, nx, sy + y0 + 8, {color: cor3[i], scale: i === 0 ? 2 : 1});
        });
        // Coração piscando junto com o batimento, ao lado do BPM.
        if (st.bateu > 0 && st.ritmo !== 'assistolia') {
          const hx = nx + 26, hy = sy + 11;
          ctx.fillStyle = '#4fe08a';
          for (const [dx, dy, w] of [[0, 2, 2], [2, 0, 4], [6, 0, 2], [0, 4, 8], [2, 6, 4], [3, 8, 2]]) ctx.fillRect(hx + dx, hy + dy, w, 2);
        }
        if (String(d.nota || '').trim()) K.drawText(ctx, cortar(String(d.nota).trim(), sw - 10), sx + 4, sy + sh - 10, {color: C('ambar', 4)});
      }
      // Lâmpada do alarme.
      {
        const lx = X(84), ly = Y(1);
        const aceso = alarme && Math.floor(t * 4) % 2;
        U.rect(ctx, lx, ly, 10, 8, aceso ? C('vermelho', 6) : st.silencio > 0 ? C('ambar', 3) : C('vermelho', 1));
        U.rect(ctx, lx, ly, 10, 2, aceso ? C('vermelho', 7) : st.silencio > 0 ? C('ambar', 4) : C('vermelho', 2));
        if (aceso) { ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#ff6a5a'; ctx.fillRect(lx - 14, ly - 10, 38, 30); ctx.restore(); }
      }
      // Botões.
      const by = Y(53);
      ui.button(ctx, 'silenciar', X(20), by, 52, 18, st.silencio > 0 ? 'MUDO' : 'ALARME', {style: 'metal', disabled: !st.ligado});
      ui.button(ctx, 'congelar', X(48), by, 52, 18, st.congelado ? 'SEGUIR' : 'PARAR', {style: 'metal', disabled: !st.ligado});
      ui.button(ctx, 'ligar', X(76), by, 52, 18, st.ligado ? 'DESLIGA' : 'LIGA', {style: st.ligado ? 'metal' : 'fosforo'});
      const titulo = campo(d.titulo, clue.name);
      const dica = !st.ligado ? 'desligado · aperte LIGA' : alarme ? 'alarme tocando · SILENCIAR segura um pouco' :
        st.congelado ? 'traçado congelado' : st.silencio > 0 ? `silenciado (${Math.ceil(st.silencio)}s)` : `${RITMOS[st.ritmo]?.label.toLowerCase()} · ${bpm || 0} bpm`;
      U.header(ctx, ui, titulo, dica, 'monitor');
    },
    action(id, st, clue, sys) {
      switch (id) {
        case 'silenciar':
          if (!st.ligado) return;
          st.silencio = st.silencio > 0 ? 0 : 30; st.mem.silencio = st.silencio;
          sys.sfx('tecla'); sys.emit('change'); break;
        case 'congelar':
          if (!st.ligado) return;
          st.congelado = !st.congelado; st.mem.congelado = st.congelado; sys.sfx('tecla'); sys.emit('change'); break;
        case 'ligar':
          st.ligado = !st.ligado; st.mem.desligado = !st.ligado;
          if (!st.ligado) st.buf.fill(0);
          sys.sfx(st.ligado ? 'boot' : 'desligar'); sys.emit('change'); break;
      }
    },
    key(e, st, clue, sys) {
      if (e.key === ' ' || e.key === 'Enter') { this.action('silenciar', st, clue, sys); return true; }
      return false;
    },
    rotuloAcao: 'Ver o monitor'
  });

  /* ================================================================ negatoscopio
     A caixa de luz da parede: o reator pisca ao acender, as chapas se trocam no
     clipe e a lupa encontra o que estava escondido no cinza do filme. */
  /* Uma chapa de raio X, desenhada na hora: fundo escuro e osso claro. */
  function pintarChapa(b, tipo, W, H, seed) {
    const R = K.rng(seed);
    b.rect(0, 0, W, H, 'azul', 1);
    b.vgrad(0, 0, W, H, 'azul', 1, 0);
    const cx = W / 2, osso = (x, y, rx, ry, n = 5) => b.ellipse(x, y, rx, ry, 'palido', n);
    if (tipo === 'torax') {
      // Campos pulmonares escuros, coração, costelas e coluna.
      b.ellipse(cx - 12, H * .55, 11, 17, 'azul', 0); b.ellipse(cx + 12, H * .55, 11, 17, 'azul', 0);
      b.ellipse(cx + 3, H * .66, 10, 11, 'palido', 2);
      for (let i = 0; i < 7; i++) {
        const y = H * .24 + i * (H * .075);
        for (const s of [-1, 1]) for (let a = 0; a < 26; a++) {
          const u = a / 25, x = cx + s * (4 + u * 22), yy = y + Math.sin(u * 1.5) * 9 + u * 3;
          b.px(Math.round(x), Math.round(yy), 'palido', 4); b.px(Math.round(x), Math.round(yy + 1), 'palido', 3);
        }
      }
      b.rect(cx - 3, H * .18, 6, H * .74, 'palido', 3);
      for (let y = H * .2; y < H * .9; y += 5) b.hline(cx - 4, cx + 3, y, 'palido', 5);
      for (const s of [-1, 1]) { b.line(cx + s * 4, H * .18, cx + s * 26, H * .22, 'palido', 6); b.line(cx + s * 4, H * .19, cx + s * 26, H * .23, 'palido', 5); }
      b.ellipse(cx, H * .12, 8, 5, 'palido', 2);
      b.hline(4, W - 5, H - 6, 'palido', 3);
    } else if (tipo === 'cranio') {
      osso(cx, H * .44, 22, 24, 3); b.ellipse(cx, H * .44, 19, 21, 'azul', 0); b.ellipse(cx, H * .44, 17, 19, 'palido', 2);
      b.ellipse(cx - 8, H * .46, 5, 6, 'azul', 0); b.ellipse(cx + 8, H * .46, 5, 6, 'azul', 0);
      b.ellipse(cx, H * .58, 4, 4, 'azul', 0);
      b.poly([[cx - 13, H * .66], [cx + 13, H * .66], [cx + 9, H * .84], [cx - 9, H * .84]], 'palido', 4);
      for (let i = 0; i < 9; i++) { const x = cx - 10 + i * 2.5; b.rect(Math.round(x), Math.round(H * .74), 2, 4, 'palido', 6); }
      b.ellipse(cx, H * .3, 14, 5, 'palido', 5);
    } else if (tipo === 'mao') {
      b.poly([[cx - 12, H * .78], [cx + 12, H * .78], [cx + 9, H * .94], [cx - 9, H * .94]], 'palido', 4);
      for (let d = 0; d < 5; d++) {
        const ang = -1.9 + d * .42, comp = d === 0 ? H * .3 : H * .46 - Math.abs(d - 2.4) * 5;
        let x = cx + (d - 2) * 6, y = H * .76;
        for (let f = 0; f < 3; f++) {
          const l = comp / 3, nx = x + Math.cos(ang) * l, ny = y - Math.abs(Math.sin(ang)) * l - l * .5;
          b.line(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), 'palido', 5);
          b.line(Math.round(x + 1), Math.round(y), Math.round(nx + 1), Math.round(ny), 'palido', 4);
          b.ellipse(Math.round(nx), Math.round(ny), 1.6, 1.6, 'palido', 6);
          x = nx; y = ny;
        }
      }
      b.ellipse(cx, H * .88, 13, 6, 'palido', 5);
    } else if (tipo === 'perna') {
      b.rect(cx - 5, H * .08, 10, H * .42, 'palido', 5); b.ellipse(cx, H * .08, 8, 6, 'palido', 6);
      b.rect(cx - 6, H * .5, 12, 8, 'palido', 4); b.ellipse(cx - 3, H * .54, 5, 5, 'palido', 6);
      b.rect(cx - 5, H * .58, 8, H * .34, 'palido', 5); b.rect(cx + 3, H * .6, 3, H * .3, 'palido', 4);
      b.ellipse(cx, H * .93, 9, 5, 'palido', 6);
      // A fratura: um traço escuro atravessando o osso.
      const fy = H * .3;
      for (let i = 0; i < 11; i++) b.px(Math.round(cx - 5 + i), Math.round(fy + Math.sin(i) * 1.6), 'azul', 0);
      b.px(Math.round(cx - 5), Math.round(fy - 1), 'azul', 0); b.px(Math.round(cx + 5), Math.round(fy + 2), 'azul', 0);
    } else {
      b.poly([[cx - 26, H * .34], [cx - 8, H * .3], [cx + 8, H * .3], [cx + 26, H * .34], [cx + 20, H * .62], [cx - 20, H * .62]], 'palido', 4);
      b.ellipse(cx, H * .44, 13, 11, 'azul', 0);
      b.ellipse(cx - 20, H * .62, 7, 7, 'palido', 6); b.ellipse(cx + 20, H * .62, 7, 7, 'palido', 6);
      b.rect(cx - 3, H * .22, 6, H * .24, 'palido', 3);
      b.rect(cx - 24, H * .68, 6, H * .26, 'palido', 5); b.rect(cx + 18, H * .68, 6, H * .26, 'palido', 5);
    }
    // Grão do filme, em blocos discretos, e o canto queimado.
    for (let i = 0; i < 26; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * H); b.rect(x, y, 2, 2, 'azul', 2); }
    b.rect(0, 0, 3, H, 'azul', 0); b.rect(W - 3, 0, 3, H, 'azul', 0);
  }
  const chapaArt = (tipo, w, h, seed) => U.art(`im:nega:chapa:${tipo}:${w}x${h}:${seed % 83}`, w, h, b => pintarChapa(b, tipo, w, h, seed));

  const caixaNegato = () => U.art('im:nega:caixa', 120, 82, b => {
    b.rect(0, 0, 120, 82, 'metal', 3); b.hline(0, 119, 0, 'metal', 5); b.vline(119, 0, 81, 'metal', 1); b.vline(0, 1, 81, 'metal', 4);
    b.hline(0, 119, 81, 'metal', 1);
    riscos(b, 2, 2, 116, 78, 'metal', 3, 23, 10);
    b.rect(5, 5, 102, 70, 'carvao', 1); b.frame(5, 5, 102, 70, 'metal', 1);
    // Clipes de mola no alto.
    for (const x of [26, 76]) { b.rect(x, 0, 14, 7, 'metal', 4); b.hline(x, x + 13, 0, 'metal', 6); b.hline(x + 2, x + 11, 6, 'metal', 1); b.rect(x + 5, 2, 4, 3, 'metal', 2); }
    // Interruptor na lateral direita.
    b.rect(109, 26, 9, 22, 'metal', 2); b.frame(109, 26, 9, 22, 'metal', 4);
    b.rect(111, 30, 5, 6, 'palido', 4); b.rect(111, 38, 5, 6, 'carvao', 2);
    // Plaquinha embaixo.
    b.rect(8, 76, 34, 5, 'metal', 4); b.text(25, 77, 'RAIO X', 'carvao', 1, {font: '3x5', align: 'center'});
    b.shadeFn(0, 0, 120, 82, (x, y) => faixas((.45 - Math.hypot((x - 96) / 140, (y - 6) / 140)) * 1.4));
    contorno(b, 'carvao', 0);
  });

  Tipos.register('negatoscopio', {
    label: 'Negatoscópio', icon: 'negatoscopio', sound: 'interruptor', categoria: 'interacao', veil: .74,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'chapas', label: 'Chapas: Rótulo | tórax/crânio/mão/perna/bacia | o que a lupa acha (uma por linha)', kind: 'textarea', rows: 5},
      {id: 'aceso', label: 'Começa aceso', kind: 'select', options: [['nao', 'Apagado'], ['sim', 'Aceso']]},
      {id: 'laudo', label: 'Laudo datilografado preso no canto', kind: 'textarea', rows: 3}],
    defaults: {titulo: '',
      chapas: 'TÓRAX — 12/03 | torax | Uma sombra redonda no pulmão direito que não estava na chapa de antes.\n' +
        'PERNA D. — 12/03 | perna | A fratura é antiga: já tem calo ósseo. Não foi de ontem.\n' +
        'CRÂNIO — S/DATA | cranio | Sem nome, sem data, só um número escrito a lápis no canto: 0317.',
      aceso: 'nao', laudo: 'LAUDO PROVISÓRIO — aguardando assinatura do plantonista. Campo do nome em branco.'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!Array.isArray(mem.achados)) mem.achados = [];
      const st = {mem, chapas: [], foco: inteiro(mem.foco, 0, 0, 5), luz: chave(clue.data?.aceso) === 'sim' ? 1 : 0,
        aceso: chave(clue.data?.aceso) === 'sim', piscando: 0, lupa: !!mem.lupa, troca: 0};
      if (typeof mem.aceso === 'boolean') { st.aceso = mem.aceso; st.luz = mem.aceso ? 1 : 0; }
      this.preparar(st, clue);
      return st;
    },
    preparar(st, clue) {
      const txt = String(clue.data?.chapas ?? '');
      if (st.txt === txt && st.chapas.length) return st.chapas;
      st.txt = txt;
      st.chapas = parseChapas(txt);
      if (!st.chapas.length) st.chapas = [{rotulo: 'SEM CHAPA', tipo: 'torax', achado: '', key: '#0'}];
      st.foco = clamp(st.foco, 0, st.chapas.length - 1);
      return st.chapas;
    },
    describe: st => ({foco: st.foco, aceso: !!st.aceso, lupa: !!st.lupa, chapas: st.chapas?.length || 0, achados: [...(st.mem?.achados || [])]}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t;
      const chapas = this.preparar(st, clue);
      // O reator pisca duas vezes antes de firmar.
      if (st.piscando > 0) { st.piscando -= dt; st.luz = st.piscando > 0 ? (Math.floor(st.piscando * 14) % 2 ? .9 : .1) : 1; }
      else st.luz = toward(st.luz, st.aceso ? 1 : 0, 1 / .3, dt);
      st.troca = Math.max(0, st.troca - dt);
      U.blit(ctx, fundoArt('hospital'), 0, 22);
      const G = {w: 120, h: 82};
      const ox = snap(CENTRO - G.w), oy = 52;
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      U.rect(ctx, ox + 6, oy + 6, G.w * 2, G.h * 2, '#05020899');
      U.blit(ctx, caixaNegato(), ox, oy);
      const px = X(6), py = Y(6), pw = 200, ph = 136;
      // A luz do painel.
      U.rect(ctx, px, py, pw, ph, st.luz > .5 ? '#f2f3f5' : '#14121c');
      const chapa = chapas[clamp(st.foco, 0, chapas.length - 1)];
      const desenhar = g => {
        if (st.luz > .05) {
          g.imageSmoothingEnabled = false;
          const arte = chapaArt(chapa.tipo, 78, 62, sementeDe(chapa.key));
          const sobe = st.troca > 0 ? Math.round(ease(1 - st.troca / .35) * 0) : 0;
          g.drawImage(arte, 0, 0, 78, 62, snap(px + 22), snap(py + 6 - sobe), 156, 112);
        }
      };
      ctx.save();
      ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      if (st.luz > .05) {
        ctx.globalAlpha = clamp(st.luz, 0, 1);
        desenhar(ctx);
        ctx.globalAlpha = 1;
        // Rótulo revelado pela luz, no canto do filme.
        K.drawText(ctx, cortar(semAcento(chapa.rotulo), 150), px + pw / 2, py + ph - 14, {color: '#16233a', align: 'center'});
      } else {
        // Apagado: o vulto do filme e o reflexo do vidro, para não virar um buraco.
        ctx.globalAlpha = .3; desenhar(ctx); ctx.globalAlpha = 1;
        ctx.globalAlpha = .08; ctx.fillStyle = '#a6c6e0';
        for (let i = 0; i < 26; i++) ctx.fillRect(snap(px + 16 + i * 4), snap(py + 8 + i * 4), 22, 4);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (st.luz > .5) { ctx.save(); ctx.globalAlpha = .10 + Math.sin(t * 9) * .012; ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 16, py - 14, pw + 32, ph + 28); ctx.restore(); }
      // Interruptor.
      {
        const bx = X(109), by = Y(26);
        const hot = ui.region('luz', bx - 4, by - 4, 26, 52, {silent: true});
        U.rect(ctx, bx + 4, by + (st.aceso ? 4 : 16), 10, 12, st.aceso ? C('palido', 5) : C('carvao', 3));
        U.rect(ctx, bx + 4, by + (st.aceso ? 4 : 16), 10, 3, st.aceso ? C('palido', 6) : C('carvao', 4));
        if (hot) { U.ants(ctx, bx - 5, by - 5, 28, 54, t); U.tooltip(ctx, st.aceso ? 'apagar' : 'acender', bx + 10, by - 24); }
      }
      // As outras chapas, encostadas numa prateleira à esquerda.
      {
        const rx = 26, ry0 = 62;
        U.rect(ctx, rx - 10, ry0 - 8, 68, chapas.length * 36 + 12, '#07030a44');
        for (let i = 0; i < chapas.length; i++) {
          const cy2 = ry0 + i * 36, sel = i === st.foco;
          const hot = ui.region('chapa', rx - 4, cy2 - 4, 56, 36, {data: i, silent: true});
          U.rect(ctx, rx + 3, cy2 + 3, 48, 28, '#07030a77');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(chapaArt(chapas[i].tipo, 78, 62, sementeDe(chapas[i].key)), 0, 0, 78, 62, snap(rx + (sel || hot ? 3 : 0)), snap(cy2), 48, 28);
          U.outline(ctx, rx + (sel || hot ? 3 : 0), cy2, 48, 28, sel ? '#ffd18c' : hot ? '#c05aa8' : C('metal', 1), 2);
          if (hot) st.tip = {texto: chapas[i].rotulo, x: rx + 24, y: cy2 - 20};
        }
        U.rect(ctx, rx - 10, ry0 + chapas.length * 36 - 2, 68, 4, C('metal', 3));
        U.rect(ctx, rx - 10, ry0 + chapas.length * 36 - 2, 68, 2, C('metal', 5));
      }
      // Laudo preso no canto.
      const laudo = String(d.laudo || '').trim();
      if (laudo) {
        const lin = K.wrap(laudo, 100).slice(0, 6), lw = 112, lh = lin.length * 11 + 14;
        const lx = snap(clamp(X(G.w) + 18, 8, SW - lw - 8)), ly = 66;
        U.rect(ctx, lx + 3, ly + 3, lw, lh, '#05020888');
        U.blit(ctx, papelArt(lw / 2, Math.ceil(lh / 2), 11), lx, ly);
        U.tape(ctx, lx + lw / 2 - 16, ly - 5, 32, 10);
        lin.forEach((l, i) => K.drawText(ctx, l, lx + 7, ly + 8 + i * 11, {color: C('tinta', 1)}));
      }
      // Lupa: segue o ponteiro sobre o filme e revela o que estava no cinza.
      const dentro = ui.mouse.x >= px && ui.mouse.x < px + pw && ui.mouse.y >= py && ui.mouse.y < py + ph;
      if (st.lupa && st.luz > .5 && dentro) {
        U.lens(ctx, g => { g.fillStyle = '#f2f3f5'; g.fillRect(px, py, pw, ph); desenhar(g); }, ui.mouse.x, ui.mouse.y, {r: 34, zoom: 2});
        if (chapa.achado && !st.mem.achados.includes(chapa.key)) { st.mem.achados.push(chapa.key); sys.sfx('lupa'); sys.emit('change'); }
      }
      ui.button(ctx, 'lupa', X(G.w) + 18, 176, 66, 20, st.lupa ? 'LARGAR' : 'LUPA', {style: 'metal', disabled: !st.aceso});
      // O que a lupa achou.
      if (chapa.achado && st.mem.achados.includes(chapa.key)) {
        const lin = K.wrap(chapa.achado, 200).slice(0, 3), bw = 216, bh = lin.length * 12 + 14;
        const bx = snap(240 - bw / 2), by = SH - bh - 6;
        U.rect(ctx, bx + 3, by + 3, bw, bh, '#05020899');
        U.rect(ctx, bx, by, bw, bh, '#1c0f22'); U.outline(ctx, bx, by, bw, bh, '#c05aa8', 2);
        U.hand(ctx, lin.join('\n'), bx + 8, by + 6, {color: '#ffd8ef', width: bw - 14, lineHeight: 12, seed: 3});
      }
      if (st.tip && ui.mouse.x >= 0) { U.tooltip(ctx, st.tip.texto, st.tip.x, st.tip.y); st.tip = null; }
      const titulo = campo(d.titulo, clue.name);
      const dica = !st.aceso ? 'apagado · aperte o interruptor' : st.lupa ? 'passe a lupa pelo filme' : 'troque a chapa ou pegue a LUPA';
      U.header(ctx, ui, titulo, dica, 'negatoscopio');
    },
    action(id, st, clue, sys, info = {}) {
      this.preparar(st, clue);
      switch (id) {
        case 'luz':
          st.aceso = !st.aceso; st.mem.aceso = st.aceso;
          if (st.aceso) { st.piscando = .55; sys.sfx('reator'); } else { st.lupa = false; st.mem.lupa = false; sys.sfx('interruptor'); }
          sys.emit('change'); break;
        case 'chapa': {
          const i = clamp(Number(info.data), 0, st.chapas.length - 1);
          if (i === st.foco) return;
          st.foco = i; st.mem.foco = i; st.troca = .35; sys.sfx('papel'); sys.emit('change'); break;
        }
        case 'lupa':
          if (!st.aceso) { sys.sfx('erro'); return; }
          st.lupa = !st.lupa; st.mem.lupa = st.lupa; sys.sfx(st.lupa ? 'lupa' : 'clique'); sys.emit('change'); break;
      }
    },
    key(e, st, clue, sys) {
      if (e.key === 'ArrowRight') { this.action('chapa', st, clue, sys, {data: clamp(st.foco + 1, 0, st.chapas.length - 1)}); return true; }
      if (e.key === 'ArrowLeft') { this.action('chapa', st, clue, sys, {data: clamp(st.foco - 1, 0, st.chapas.length - 1)}); return true; }
      if (e.key === ' ' || e.key === 'Enter') { this.action('luz', st, clue, sys); return true; }
      return false;
    },
    rotuloAcao: 'Ver as chapas'
  });

  /* ================================================================ jukebox
     O arco de neon, o vidro com a pilha de discos e o braço mecânico que vai
     buscar o disco escolhido, a lista de faixas com código e a moeda que some
     na boca do lado. */
  const FASES_JUKE = {braco: .55, pega: .35, leva: .6};
  const TOTAL_JUKE = FASES_JUKE.braco + FASES_JUKE.pega + FASES_JUKE.leva;

  const corpoJukebox = () => U.art('im:juke:corpo', 116, 124, b => {
    // Arco de madeira com a cúpula.
    b.poly([[6, 30], [20, 8], [96, 8], [110, 30], [110, 122], [6, 122]], 'mogno', 3);
    veios(b, 8, 12, 100, 108, 'mogno', 3, 9, .7);
    b.poly([[20, 8], [96, 8], [110, 30], [104, 30], [92, 13], [24, 13], [12, 30], [6, 30]], 'mogno', 5);
    b.hline(24, 91, 8, 'mogno', 6);
    // Tubos de neon acompanhando o arco (acesos pelo desenho da interface).
    b.poly([[12, 30], [24, 14], [92, 14], [104, 30], [100, 30], [90, 18], [26, 18], [16, 30]], 'roxo', 2);
    b.vline(9, 32, 118, 'roxo', 2); b.vline(107, 32, 118, 'roxo', 2);
    // Vidro da mecânica.
    b.rect(16, 32, 84, 40, 'carvao', 1); b.frame(16, 32, 84, 40, 'latao', 4);
    b.rect(18, 34, 80, 36, 'preto', 0);
    // Painel das faixas.
    b.rect(14, 76, 88, 28, 'carvao', 2); b.frame(14, 76, 88, 28, 'latao', 3);
    // Grade do alto-falante e a boca da moeda.
    b.rect(14, 106, 68, 14, 'mogno', 1);
    for (let x = 16; x < 80; x += 3) b.vline(x, 108, 118, 'mogno', 0);
    for (let y = 108; y < 119; y += 3) b.hline(16, 79, y, 'mogno', 2);
    b.rect(86, 106, 16, 14, 'latao', 3); b.hline(86, 101, 106, 'latao', 5);
    b.rect(90, 109, 8, 2, 'carvao', 0); b.hline(90, 97, 108, 'latao', 1);
    b.text(94, 113, '1', 'latao', 5, {font: '3x5', align: 'center'});
    // Pés.
    b.rect(10, 122, 14, 2, 'carvao', 2); b.rect(92, 122, 14, 2, 'carvao', 2);
    b.shadeFn(0, 0, 116, 124, (x, y) => faixas((.45 - Math.hypot((x - 90) / 150, (y - 10) / 170)) * 1.5));
    contorno(b, 'carvao', 0);
  });

  Tipos.register('jukebox', {
    label: 'Jukebox', icon: 'jukebox', sound: 'moeda', categoria: 'interacao', veil: .7,
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'musicas', label: 'Músicas: Título | Artista | som do ambiente (uma por linha)', kind: 'textarea', rows: 6},
      {id: 'preco', label: 'Preço por música (em moedas)', kind: 'text', placeholder: '1'},
      {id: 'creditos', label: 'Créditos que já estão na máquina', kind: 'text', placeholder: '0'},
      {id: 'ligada', label: 'Ligada', kind: 'select', options: [['sim', 'Ligada'], ['nao', 'Muda (fora de serviço)']]},
      {id: 'aviso', label: 'Papel colado no vidro', kind: 'text'}],
    defaults: {titulo: '',
      musicas: 'NOITE DE ABRIL | Trio Serrano\nCARTA QUE NÃO MANDEI | Nilza do Vale\nO ÚLTIMO ÔNIBUS | Os Aurélios\nCHOVE NA AVENIDA | Trio Serrano\nSÓ VOLTO DE MANHÃ | Vilma Prado\nBAILE DO ANEXO | desconhecido',
      preco: '1', creditos: '0', ligada: 'sim', aviso: ''},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (typeof mem.creditos !== 'number') mem.creditos = inteiro(clue.data?.creditos, 0, 0, 99);
      if (!Array.isArray(mem.tocadas)) mem.tocadas = [];
      const st = {mem, musicas: [], sel: inteiro(mem.sel, 0, 0, 11), toca: null, giro: 0, neon: 0, moeda: null, tocando: null};
      this.preparar(st, clue);
      return st;
    },
    preparar(st, clue) {
      const txt = String(clue.data?.musicas ?? '');
      if (st.txt === txt && st.musicas.length) return st.musicas;
      st.txt = txt;
      st.musicas = parseMusicas(txt);
      if (!st.musicas.length) st.musicas = [{titulo: 'SEM DISCO', artista: '', som: '', codigo: 'A1', key: '#0'}];
      st.sel = clamp(st.sel, 0, st.musicas.length - 1);
      return st.musicas;
    },
    ligada: clue => chave(clue?.data?.ligada) !== 'nao',
    preco: clue => clamp(inteiro(clue?.data?.preco, 1, 0, 9), 0, 9),
    describe: st => ({sel: st.sel, creditos: st.mem?.creditos ?? 0, tocando: st.tocando, fase: st.toca ? +st.toca.t.toFixed(2) : null,
      musicas: st.musicas?.length || 0, tocadas: [...(st.mem?.tocadas || [])]}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t, mem = st.mem;
      const musicas = this.preparar(st, clue), ligada = this.ligada(clue), preco = this.preco(clue);
      st.neon = toward(st.neon, ligada ? 1 : 0, 1 / .6, dt);
      if (st.toca) {
        st.toca.t += dt;
        if (st.toca.t >= TOTAL_JUKE && !st.toca.pronto) {
          st.toca.pronto = true;
          st.tocando = st.toca.i;
          const m = musicas[st.toca.i];
          if (m) { if (m.som && root.MapAmbience?.temSom?.(m.som)) sys.sfx(m.som); sys.toast('TOCANDO', `${m.titulo}${m.artista ? ' · ' + m.artista : ''}`, 'jukebox'); }
        }
      }
      if (st.tocando != null) st.giro = (st.giro + dt * 2.2) % 1;
      if (st.moeda) { st.moeda.t += dt; if (st.moeda.t > .5) st.moeda = null; }
      U.blit(ctx, fundoArt('salao'), 0, 22);
      const G = {w: 116, h: 124};
      const ox = snap(CENTRO - G.w), oy = snap(CHAO_Y - G.h * 2 + 6);
      const X = a => ox + a * 2, Y = a => oy + a * 2;
      sombraChao(ctx, ox + 14, CHAO_Y + 2, G.w * 2 - 28, 10, .5);
      // O brilho do neon derramado na parede, por trás.
      if (st.neon > .05) {
        ctx.save(); ctx.globalAlpha = .1 * st.neon + Math.sin(t * 2.1) * .015;
        ctx.fillStyle = '#f3b4e8'; ctx.fillRect(ox - 24, oy - 10, G.w * 2 + 48, 120); ctx.restore();
      }
      U.blit(ctx, corpoJukebox(), ox, oy);
      // Neon aceso por cima do arco.
      if (st.neon > .05) {
        const pulso = .7 + Math.sin(t * 1.7) * .2 + (st.tocando != null ? Math.sin(t * 6) * .12 : 0);
        ctx.save(); ctx.globalAlpha = clamp(st.neon * pulso, 0, 1);
        const pontos = [[12, 30], [16, 24], [22, 17], [30, 14], [58, 14], [86, 14], [94, 17], [100, 24], [104, 30]];
        for (let i = 0; i < pontos.length - 1; i++) {
          const [x0, y0] = pontos[i], [x1, y1] = pontos[i + 1], passos = 10;
          for (let k = 0; k <= passos; k++) {
            const x = X(x0 + (x1 - x0) * k / passos), y = Y(y0 + (y1 - y0) * k / passos);
            U.rect(ctx, x, y, 4, 4, i % 2 ? '#ff9ae0' : '#8fd8ff');
          }
        }
        for (const lx of [X(9), X(105)]) for (let y = Y(32); y < Y(118); y += 6) U.rect(ctx, lx, y, 4, 4, Math.floor((y + t * 40) / 12) % 2 ? '#ff9ae0' : '#8fd8ff');
        ctx.restore();
      }
      // O vidro: pilha de discos, prato e braço.
      {
        const gx = X(18), gy = Y(34), gw = 160, gh = 72;
        U.rect(ctx, gx, gy, gw, gh, ligada ? '#120a1c' : '#08060e');
        // Pilha de discos de canto, à esquerda.
        for (let i = 0; i < 10; i++) {
          const x = gx + 10 + i * 6, falta = st.toca && st.toca.t > FASES_JUKE.braco && i === st.toca.i % 10;
          if (falta) continue;
          U.rect(ctx, x, gy + 16, 4, 40, C('carvao', 2));
          U.rect(ctx, x, gy + 16, 2, 40, C('carvao', 3));
          U.rect(ctx, x, gy + 32, 4, 6, C('vermelho', 2));
        }
        // Prato, à direita: base escura com o eixo no meio.
        const px2 = gx + 118, py2 = gy + 38;
        U.rect(ctx, px2 - 26, py2 + 8, 52, 8, C('carvao', 3));
        U.rect(ctx, px2 - 26, py2 + 8, 52, 2, C('carvao', 4));
        U.rect(ctx, px2 - 24, py2 - 2, 48, 12, C('carvao', 2));
        U.rect(ctx, px2 - 2, py2 - 8, 4, 8, C('metal', 4));
        // O disco tocando: elipse achatada com o selo e um brilho girando.
        if (st.tocando != null) {
          const rx = 24, ry = 7;
          for (let yy = -ry; yy <= ry; yy += 2) {
            const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2)) / 2) * 2;
            U.rect(ctx, px2 - half, py2 + yy, half * 2, 2, yy < -2 ? C('carvao', 2) : C('preto', 1));
          }
          const g2 = Math.round(Math.cos(st.giro * Math.PI * 2) * rx * .7 / 2) * 2;
          U.rect(ctx, px2 + g2 - 2, py2 - 4, 2, 8, C('carvao', 4));
          U.rect(ctx, px2 - 8, py2 - 3, 16, 6, C('vermelho', 3));
          U.rect(ctx, px2 - 8, py2 - 3, 16, 2, C('vermelho', 4));
          U.rect(ctx, px2 - 1, py2 - 1, 2, 2, C('carvao', 0));
          // Agulha no braço do toca-discos.
          U.rect(ctx, px2 + 22, py2 - 12, 4, 4, C('metal', 4));
          U.rect(ctx, px2 + 10, py2 - 10, 14, 2, C('metal', 5));
          U.rect(ctx, px2 + 8, py2 - 8, 4, 4, C('metal', 3));
        }
        // O braço mecânico: sobe e some quando o disco já está no prato.
        if (st.toca) {
          const u = st.toca.t;
          const alvoX = gx + 10 + (st.toca.i % 10) * 6;
          let bx = px2, disco = null, sobe = 0;
          if (u < FASES_JUKE.braco) bx = px2 + (alvoX - px2) * ease(u / FASES_JUKE.braco);
          else if (u < FASES_JUKE.braco + FASES_JUKE.pega) { bx = alvoX; disco = clamp((u - FASES_JUKE.braco) / FASES_JUKE.pega, 0, 1); }
          else if (u < TOTAL_JUKE) { const k = clamp((u - FASES_JUKE.braco - FASES_JUKE.pega) / FASES_JUKE.leva, 0, 1); bx = alvoX + (px2 - alvoX) * easeIO(k); disco = 1; }
          else { bx = px2; sobe = Math.min(26, (u - TOTAL_JUKE) * 60); }
          U.rect(ctx, gx + 4, gy + 6, gw - 8, 4, C('metal', 3));
          U.rect(ctx, gx + 4, gy + 6, gw - 8, 2, C('metal', 5));
          if (sobe < 24) {
            U.rect(ctx, snap(bx) - 4, gy + 6, 12, Math.max(4, 22 - sobe), C('metal', 4));
            U.rect(ctx, snap(bx) - 4, gy + 6, 12, 3, C('metal', 6));
            if (sobe < 14) U.rect(ctx, snap(bx) - 6, gy + 26 - sobe, 16, 5, C('metal', 2));
            if (disco != null && sobe <= 0) { U.rect(ctx, snap(bx) - 8, gy + 30, 20, 26, C('carvao', 1)); U.rect(ctx, snap(bx) - 6, gy + 40, 16, 6, C('vermelho', 2)); }
          }
        } else {
          U.rect(ctx, gx + 4, gy + 6, gw - 8, 4, C('metal', 3));
          U.rect(ctx, gx + 4, gy + 6, gw - 8, 2, C('metal', 5));
        }
        // Papel colado no vidro.
        const aviso = String(d.aviso || '').trim();
        if (aviso) {
          const lin = K.wrap(aviso, 84).slice(0, 3), aw = 96, ah = lin.length * 11 + 12;
          U.rect(ctx, gx + 6, gy + gh - ah - 6, aw, ah, C('papel', 5));
          U.tape(ctx, gx + 6 + aw / 2 - 14, gy + gh - ah - 10, 28, 8);
          U.hand(ctx, lin.join('\n'), gx + 12, gy + gh - ah - 1, {color: C('tinta', 2), width: aw - 10, seed: 2});
        }
        if (!ligada) K.drawText(ctx, 'FORA DE SERVICO', gx + gw / 2, gy + gh / 2 - 4, {color: C('vermelho', 3), align: 'center'});
      }
      // Lista de faixas.
      {
        const lx = X(16), ly = Y(78), lw = 168, lh = 48;
        U.rect(ctx, lx, ly, lw, lh, C('carvao', 1));
        const cols = musicas.length > 4 ? 2 : 1, porCol = Math.ceil(musicas.length / cols);
        const passo = clamp(Math.floor((lh - 4) / porCol), 10, 16);
        for (let i = 0; i < musicas.length; i++) {
          const col = Math.floor(i / porCol), fila = i % porCol;
          const bw = lw / cols - 4, bx = lx + 2 + col * (lw / cols), by = ly + 2 + fila * passo;
          if (by + 10 > ly + lh) continue;
          const hot = ui.region('faixa', bx, by, bw, 10, {data: i, silent: true});
          const sel = i === st.sel;
          U.rect(ctx, bx, by, bw, 10, sel ? C('amarelo', 4) : hot ? C('papel', 6) : C('papel', 5));
          U.rect(ctx, bx, by, 14, 10, sel ? C('vermelho', 3) : C('carvao', 2));
          K.drawText(ctx, musicas[i].codigo, bx + 7, by + 2, {color: C('papel', 6), align: 'center'});
          K.drawText(ctx, cortar(musicas[i].titulo, bw - 20), bx + 17, by + 2, {color: C('tinta', 1)});
          if (st.tocando === i) U.outline(ctx, bx - 1, by - 1, bw + 2, 12, Math.floor(t * 4) % 2 ? '#ffd18c' : '#ff9ae0', 1);
        }
      }
      // Moeda caindo na boca.
      if (st.moeda) {
        const u = st.moeda.t / .5;
        U.rect(ctx, X(92), Y(100) + Math.round(u * 8) * 2, 6, 6, C('latao', u > .6 ? 2 : 5));
      }
      // Créditos e botões.
      {
        const cx2 = X(G.w) + 16;
        U.rect(ctx, cx2, 76, 100, 34, '#1a0b20'); U.outline(ctx, cx2, 76, 100, 34, '#7a3a6c', 2);
        K.drawText(ctx, 'CRÉDITOS', cx2 + 50, 81, {color: '#c99cc7', align: 'center'});
        K.drawText(ctx, String(mem.creditos), cx2 + 50, 92, {color: mem.creditos ? '#4fe08a' : '#8a5a78', align: 'center', scale: 2});
        ui.button(ctx, 'moeda', cx2, 118, 100, 20, `MOEDA (${preco})`, {style: 'roxo', disabled: !ligada});
        ui.button(ctx, 'tocar', cx2, 144, 100, 22, st.toca && !st.toca.pronto ? '…' : 'TOCAR', {style: 'fosforo', disabled: !ligada || !mem.creditos || !!(st.toca && !st.toca.pronto)});
        const m = musicas[st.sel];
        if (m) {
          U.rect(ctx, cx2, 172, 100, 38, '#140619'); U.outline(ctx, cx2, 172, 100, 38, '#522045', 2);
          K.drawText(ctx, cortar(m.titulo, 92), cx2 + 50, 178, {color: '#ffd18c', align: 'center'});
          if (m.artista) K.drawText(ctx, cortar(m.artista, 92), cx2 + 50, 190, {color: '#c99cc7', align: 'center'});
          K.drawText(ctx, m.codigo, cx2 + 50, 200, {color: '#8fd8ff', align: 'center'});
        }
      }
      const titulo = campo(d.titulo, clue.name);
      const dica = !ligada ? 'muda · ninguém consertou' : st.toca && !st.toca.pronto ? 'o braço foi buscar o disco…' :
        st.tocando != null ? 'tocando' : mem.creditos ? 'escolha a faixa e aperte TOCAR' : 'ponha uma moeda';
      U.header(ctx, ui, titulo, dica, 'jukebox');
    },
    porMoeda(st, clue, sys) {
      const preco = this.preco(clue), bolsa = sys.itens;
      if (!this.ligada(clue)) { sys.sfx('erro'); return; }
      if (preco > 0) {
        let tem = 0;
        try { tem = bolsa?.contar ? bolsa.contar('moedas') : preco; } catch (erro) { console.error(erro); }
        if (tem < preco) { sys.sfx('erro'); sys.toast('SEM TROCADO', `Faltam moedas (${preco})`, 'alerta'); return; }
        try { bolsa?.gastar?.('moedas', preco); } catch (erro) { console.error(erro); }
      }
      st.mem.creditos = clamp((st.mem.creditos || 0) + 1, 0, 99);
      st.moeda = {t: 0};
      sys.sfx('moeda');
      sys.emit('change');
    },
    tocar(st, clue, sys) {
      const mem = st.mem;
      if (!this.ligada(clue) || (st.toca && !st.toca.pronto)) { sys.sfx('erro'); return; }
      if (!mem.creditos) { sys.sfx('erro'); sys.toast('SEM CRÉDITO', 'Ponha uma moeda primeiro', 'alerta'); return; }
      mem.creditos--;
      const m = st.musicas[st.sel];
      if (m && !mem.tocadas.includes(m.key)) mem.tocadas.push(m.key);
      st.tocando = null;
      st.toca = {t: 0, i: st.sel, pronto: false};
      sys.sfx('disco');
      sys.emit('change');
    },
    action(id, st, clue, sys, info = {}) {
      this.preparar(st, clue);
      switch (id) {
        case 'faixa': st.sel = clamp(Number(info.data), 0, st.musicas.length - 1); st.mem.sel = st.sel; sys.sfx('clique'); break;
        case 'moeda': this.porMoeda(st, clue, sys); break;
        case 'tocar': this.tocar(st, clue, sys); break;
      }
    },
    key(e, st, clue, sys) {
      if (e.key === 'ArrowDown') { st.sel = clamp(st.sel + 1, 0, st.musicas.length - 1); return true; }
      if (e.key === 'ArrowUp') { st.sel = clamp(st.sel - 1, 0, st.musicas.length - 1); return true; }
      if (e.key === 'Enter') { this.tocar(st, clue, sys); return true; }
      return false;
    },
    rotuloAcao: 'Escolher uma música'
  });
})(typeof window !== 'undefined' ? window : globalThis);
