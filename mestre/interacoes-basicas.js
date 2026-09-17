/* Interações básicas — as três interações que móveis e objetos das cenas
   genéricas abrem quando alguém clica neles:

   - exame        examinar de perto: a pintura do objeto ampliada sobre um
                  fundo, um cartão com o nome e a descrição; clicar no objeto
                  revela o detalhe (escrita à mão) e, uma vez, um item.
   - recipiente   gavetas, armários, geladeira, caixas, lixeira, caçamba,
                  sofá, cama, duto, bolsa e bancada. A arte muda com o estilo;
                  cada compartimento abre de verdade (a gaveta desliza, a
                  porta gira, a tampa levanta) e o que tem dentro aparece num
                  painel ao lado, com os itens para pegar. Pode ter tranca de
                  chave ou de código (teclado numérico).
   - interruptor  sem interface: o clique na cena alterna um estado (as luzes
                  da sala ou um estado do próprio objeto). A placa grande só
                  aparece quando o mestre abre pelo painel.

   Formatos que o mestre escreve:
     compartimentos   Nome | o que tem dentro | itens      (uma linha cada)
     itens            moedas*3, chave=Porão, bandage

   Progresso (compartimentos abertos, itens pegos, tranca aberta, detalhe
   examinado) fica em sys.memory(clue.id) e viaja com a sessão. */
(function (root) {
  'use strict';

  /* ================================================================ dados
     Funções puras: rodam no Node (testes) e no navegador. */
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normal = s => semAcento(s).trim().toLowerCase().replace(/\s+/g, ' ');
  /* Itens que as cenas genéricas conhecem (alguns ainda não existem na bolsa). */
  const ITENS_CONHECIDOS = ['moedas', 'refrigerante', 'salgadinho', 'chocolate', 'agua', 'cafe', 'fusivel', 'chave', 'bandage', 'splint', 'antibiotic'];
  /* O mestre escreve como fala: plural, acento, nome em português. */
  const APELIDOS = {
    moeda: 'moedas', dinheiro_trocado: 'moedas', trocado: 'moedas',
    refri: 'refrigerante', refrigerantes: 'refrigerante', lata_de_refrigerante: 'refrigerante',
    salgadinhos: 'salgadinho', chocolates: 'chocolate', barra_de_chocolate: 'chocolate',
    aguas: 'agua', garrafa_de_agua: 'agua', cafes: 'cafe', copo_de_cafe: 'cafe',
    fusiveis: 'fusivel', chaves: 'chave',
    bandagem: 'bandage', bandagens: 'bandage', bandages: 'bandage', atadura: 'bandage', ataduras: 'bandage', curativo: 'bandage', curativos: 'bandage',
    tala: 'splint', talas: 'splint', splints: 'splint',
    antibiotico: 'antibiotic', antibioticos: 'antibiotic', antibiotics: 'antibiotic'
  };
  const NOMES_ITENS = {moedas: 'Moedas', refrigerante: 'Refrigerante', salgadinho: 'Salgadinho', chocolate: 'Chocolate', agua: 'Água', cafe: 'Café',
    fusivel: 'Fusível', chave: 'Chave', bandage: 'Bandagem', splint: 'Tala', antibiotic: 'Antibiótico'};

  /* "Garrafa de Água" → "agua" (apelidos) · "lanterna" → "lanterna". */
  function idItem(nome) {
    const s = normal(nome).replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '');
    return APELIDOS[s] || s;
  }
  /* "moedas*3, chave=Porão, bandage" →
     [{id: 'moedas', qtd: 3, dados: null, key}, {id: 'chave', qtd: 1, dados: {nome: 'Porão'}, key}, …]
     Aceita também "moedas x3", "3 moedas", "3x moedas", ";" e quebras de linha. A chave
     `key` identifica o item dentro da lista (o mesmo id repetido ganha #1, #2…) e é o
     que a memória guarda como pego. */
  function parseItens(texto) {
    const out = [], vistos = Object.create(null);
    for (const bruto of String(texto ?? '').split(/[,;\n]/)) {
      let tok = bruto.trim(), nome = null, qtd = 1, m;
      if (!tok) continue;
      const eq = tok.indexOf('=');
      if (eq >= 0) { nome = tok.slice(eq + 1).trim() || null; tok = tok.slice(0, eq).trim(); }
      if ((m = tok.match(/^(.*?)\s*(?:\*|×|\bx)\s*(\d+)$/i))) { tok = m[1]; qtd = Number(m[2]); }
      else if ((m = tok.match(/^(\d+)\s*(?:\*|×|x)?\s+(\S.*)$/i)) || (m = tok.match(/^(\d+)\s*(?:\*|×|x)\s*(\S.*)$/i))) { qtd = Number(m[1]); tok = m[2]; }
      const id = idItem(tok);
      if (!id) continue;
      qtd = Math.max(1, Math.min(99, Math.floor(qtd) || 1));
      const base = id + (nome ? '=' + normal(nome) : '');
      const n = vistos[base] = (vistos[base] ?? -1) + 1;
      out.push({id, qtd, dados: nome ? {nome} : null, key: `${base}#${n}`});
    }
    return out;
  }
  // Um trecho que só tem itens conhecidos ("moedas*2, bandage") e nenhuma frase.
  function pareceItens(texto) {
    const toks = String(texto ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (!toks.length) return false;
    const conhecidos = new Set([...ITENS_CONHECIDOS, ...Object.keys(root.ITEM_DEFS || {})]);
    const itens = parseItens(texto);
    return itens.length === toks.length && itens.every(it => conhecidos.has(it.id));
  }
  /* "Gaveta de cima | Canetas e um recibo. | moedas*2" (uma linha por compartimento) →
     [{nome, texto, itens, key}]. Tolerante: sem "|", uma linha curta é só o nome e
     uma frase é só o texto; com dois campos, o segundo vira itens quando só tem
     itens conhecidos; "\n" escrito no texto quebra a linha. */
  function parseCompartimentos(texto) {
    const out = [], vistos = Object.create(null);
    for (const bruto of String(texto ?? '').split(/\r?\n/)) {
      const linha = bruto.trim();
      if (!linha) continue;
      const partes = linha.split('|').map(s => s.trim());
      let nome = '', desc = '', itens = '';
      if (partes.length === 1) {
        if (linha.length <= 32 && !/[.!?…:;"”)]$/.test(linha)) nome = linha; else desc = linha;
      } else if (partes.length === 2) {
        nome = partes[0];
        if (pareceItens(partes[1])) itens = partes[1]; else desc = partes[1];
      } else {
        nome = partes[0]; itens = partes[partes.length - 1]; desc = partes.slice(1, -1).filter(Boolean).join(' | ');
      }
      desc = desc.replace(/\\n/g, '\n');
      const base = normal(nome) || '#';
      const n = vistos[base] = (vistos[base] ?? -1) + 1;
      out.push({nome, texto: desc, itens: parseItens(itens), key: `${base}#${n}`});
    }
    return out;
  }
  /* Nome de um item para avisos e etiquetas: "Moedas (3)", "Chave: Porão". */
  function nomeItem(it) {
    if (!it) return '';
    const def = root.ITEM_DEFS?.[it.id];
    let base = def?.label || NOMES_ITENS[it.id] || String(it.id || 'item').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
    if (it.dados?.nome) base = it.id === 'chave' ? `Chave: ${it.dados.nome}` : String(it.dados.nome);
    return it.qtd > 1 ? `${base} (${it.qtd})` : base;
  }
  /* O estado que um interruptor alterna: o alvo, se a cena o conhece; senão o
     estado do próprio objeto ("ligada" → "tv3.ligada"). */
  function alvoInterruptor(clue, sys) {
    const alvo = String(clue?.data?.alvo ?? '').trim() || 'luzes';
    const props = sys?.stage?.scene?.props;
    const conhecido = Array.isArray(props) && props.some(p => p && p.id === alvo);
    if (conhecido || !clue?.objeto || alvo.startsWith(clue.objeto + '.')) return alvo;
    return `${clue.objeto}.${alvo}`;
  }
  /* Dígitos do código de uma tranca (vazio cai no padrão 0000). */
  const codigoTranca = valor => (String(valor ?? '').replace(/\D/g, '') || '0000').slice(0, 8);

  const api = {parseCompartimentos, parseItens, idItem, nomeItem, alvoInterruptor, codigoTranca, ITENS_CONHECIDOS};
  root.InteracoesBasicas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  const K = root.PixelKit, U = root.PixelUI, ClueTypes = root.ClueTypes;
  if (!K || !U || !ClueTypes || !root.document) return;

  /* ================================================================ desenho comum */
  const {C, SW, SH} = U;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeIO = u => { u = clamp(u, 0, 1); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const snap = U.snap;
  const seedOf = str => [...String(str)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const toward = (v, alvo, vel, dt) => v < alvo ? Math.min(alvo, v + vel * dt) : Math.max(alvo, v - vel * dt);
  const TXT = {titulo: '#ffd18c', dica: '#c99cc7', claro: '#ffe6f7', sombra: '#07030a'};

  /* Contorno escuro de 1 px em volta do que foi pintado (como os itens da bolsa). */
  function contorno(b, ramp = 'roxo', level = 0) {
    const W = b.width, H = b.height, cheio = Uint8Array.from(b.ramp, r => r ? 1 : 0), id = b.rid(ramp);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (cheio[y * W + x]) continue;
      if ((x > 0 && cheio[y * W + x - 1]) || (x < W - 1 && cheio[y * W + x + 1]) || (y > 0 && cheio[(y - 1) * W + x]) || (y < H - 1 && cheio[(y + 1) * W + x])) b.px(x, y, id, level);
    }
  }
  /* Luz em degraus limpos: pontilhado só numa faixa estreita entre um nível e outro. */
  const faixas = v => { const i = Math.floor(v), f = v - i; return i + (f < .38 ? 0 : f > .62 ? 1 : (f - .38) / .24); };
  /* Veios de madeira: faixas horizontais onduladas, em blocos. */
  function veios(b, x, y, w, h, ramp, base, seed = 1, forca = 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const n = Math.sin((xx - x) / (6 + seed % 5) + yy * 1.3 + seed) * .9 + K.hash2(xx >> 2, yy, seed) * .9 * forca;
      if (n > 1.3) b.px(xx, yy, ramp, base + 1); else if (n < -1.15) b.px(xx, yy, ramp, base - 1);
    }
  }

  /* ------------------------------------------------------------ ícones novos (16×16) */
  const ICONES = {
    gaveta(b) {
      b.rect(2, 3, 12, 11, 'madeira', 2); b.hline(1, 14, 2, 'madeira', 5); b.hline(1, 14, 3, 'madeira', 3);
      b.bevel(3, 4, 10, 3, 'madeira', 4, 5, 2); b.px(8, 5, 'latao', 5);
      b.rect(3, 8, 10, 2, 'madeira', 0); b.rect(4, 8, 8, 2, 'papel', 5); b.px(6, 8, 'vermelho', 4);
      b.bevel(2, 10, 12, 4, 'madeira', 4, 5, 2); b.px(8, 11, 'latao', 5); b.hline(2, 13, 14, 'madeira', 0);
    },
    interruptor(b) {
      b.bevel(4, 1, 8, 14, 'papel', 5, 6, 3); b.rect(6, 5, 4, 6, 'papel', 2);
      b.rect(7, 3, 2, 4, 'metal', 5); b.rect(6, 2, 4, 2, 'metal', 6); b.px(8, 13, 'latao', 4); b.px(8, 2, 'amarelo', 6);
    },
    chave(b) {
      b.ellipse(4.5, 4.5, 3.5, 3.5, 'latao', 3); b.ellipse(4.5, 4.5, 1.5, 1.5, 'roxo', 1); b.px(3, 2, 'latao', 6);
      for (let i = 0; i < 8; i++) { b.px(7 + i, 7 + i, 'latao', 4); b.px(6 + i, 7 + i, 'latao', 2); }
      b.px(12, 14, 'latao', 3); b.px(13, 13, 'latao', 3); b.px(10, 12, 'latao', 3); b.px(11, 11, 'latao', 5);
    },
    bolsa(b) {
      for (let i = 0; i < 6; i++) b.px(5 + i, 2 + (i === 0 || i === 5 ? 1 : 0), 'madeira', 5);
      b.px(5, 4, 'madeira', 4); b.px(10, 4, 'madeira', 4);
      b.rect(2, 5, 12, 9, 'madeira', 3); b.hline(2, 13, 5, 'madeira', 5); b.vline(13, 6, 13, 'madeira', 4); b.hline(2, 13, 13, 'madeira', 1);
      b.rect(2, 5, 12, 4, 'madeira', 4); b.hline(2, 13, 9, 'madeira', 1); b.rect(7, 8, 2, 3, 'latao', 5);
    }
  };
  for (const [nome, pintar] of Object.entries(ICONES)) if (!U.ICONS[nome]) U.ICONS[nome] = pintar;
  const icone = nome => U.ICONS[nome] ? nome : 'objeto';

  /* ------------------------------------------------------------ itens */
  /* Desenhos de reserva, 16×16 como os da bolsa, para itens que ainda não
     existem em ITEM_DEFS. */
  const RESERVA = {
    moedas(b) {
      for (let k = 0; k < 3; k++) { const y = 12 - k * 2; b.ellipse(6.5, y + 1, 5, 2, 'latao', 2); b.ellipse(6.5, y, 5, 2, 'latao', k === 2 ? 5 : 4); }
      b.hline(4, 8, 8, 'latao', 6); b.px(6, 7, 'latao', 3);
      b.ellipse(12.5, 8, 2.4, 4.4, 'latao', 3); b.vline(13, 5, 11, 'latao', 5); b.px(12, 8, 'latao', 6);
    },
    refrigerante(b) {
      b.rect(5, 3, 7, 11, 'vermelho', 3); b.vline(11, 4, 13, 'vermelho', 5); b.vline(5, 4, 13, 'vermelho', 2);
      for (let x = 5; x < 12; x++) b.px(x, 8 + Math.round(Math.sin(x * .9) * 1), 'papel', 6);
      b.hline(5, 11, 2, 'metal', 4); b.hline(6, 10, 1, 'metal', 5); b.px(9, 1, 'metal', 6); b.hline(5, 11, 14, 'metal', 3);
      b.vline(10, 4, 6, 'vermelho', 6);
    },
    salgadinho(b) {
      b.poly([[3, 3], [13, 3], [14, 14], [2, 14]], 'amarelo', 4);
      for (let x = 3; x < 14; x += 2) b.px(x, 2, 'amarelo', 5);
      b.hline(3, 12, 4, 'amarelo', 2); b.vline(13, 5, 13, 'amarelo', 5);
      b.ellipse(8, 9, 3.5, 2.5, 'vermelho', 3); b.px(7, 8, 'ambar', 5); b.px(9, 10, 'ambar', 5); b.hline(4, 12, 13, 'amarelo', 2);
    },
    chocolate(b) {
      b.poly([[2, 11], [10, 3], [14, 7], [6, 15]], 'vermelho', 2);
      b.poly([[8, 5], [10, 3], [14, 7], [12, 9]], 'latao', 5);
      b.line(3, 11, 10, 4, 'vermelho', 4); b.line(6, 13, 11, 8, 'mogno', 3); b.px(12, 5, 'latao', 6); b.px(6, 11, 'papel', 6);
    },
    agua(b) {
      b.rect(6, 1, 4, 2, 'azul', 3); b.hline(6, 9, 1, 'azul', 4);
      b.rect(6, 3, 4, 2, 'agua', 4); b.rect(4, 5, 8, 10, 'agua', 3); b.vline(11, 6, 14, 'agua', 4); b.vline(4, 6, 14, 'agua', 2);
      b.rect(4, 8, 8, 3, 'ceu', 5); b.hline(4, 11, 8, 'azul', 3); b.vline(6, 5, 13, 'agua', 6);
    },
    cafe(b) {
      b.hline(3, 12, 3, 'papel', 6); b.rect(3, 4, 10, 2, 'papel', 4);
      b.poly([[4, 6], [12, 6], [11, 15], [5, 15]], 'papel', 5); b.vline(11, 6, 14, 'papel', 6);
      b.rect(4, 9, 8, 3, 'madeira', 3); b.hline(4, 11, 9, 'madeira', 4);
      b.px(7, 1, 'papel', 6); b.px(9, 0, 'papel', 6);
    },
    fusivel(b) {
      b.rect(2, 6, 3, 5, 'metal', 4); b.vline(2, 6, 10, 'metal', 2); b.hline(2, 4, 6, 'metal', 6);
      b.rect(11, 6, 3, 5, 'metal', 4); b.vline(11, 6, 10, 'metal', 2); b.hline(11, 13, 6, 'metal', 6);
      b.rect(5, 6, 6, 5, 'ceu', 4); b.hline(5, 10, 6, 'ceu', 5); b.hline(5, 10, 10, 'ceu', 2);
      b.hline(5, 10, 8, 'latao', 5); b.px(7, 7, 'ceu', 6);
    },
    chave(b) {
      b.ellipse(5, 5, 4, 4, 'latao', 3); b.ellipse(5, 5, 1.6, 1.6, 'latao', 0); b.erase(4, 4, 2, 2); b.px(3, 2, 'latao', 6); b.px(2, 4, 'latao', 5);
      for (let i = 0; i < 7; i++) { b.px(8 + i, 8 + i, 'latao', 4); b.px(8 + i, 7 + i, 'latao', 5); }
      b.px(11, 13, 'latao', 3); b.px(12, 14, 'latao', 3); b.px(13, 12, 'latao', 3); b.px(9, 11, 'latao', 3);
    },
    bandage(b) {
      b.ellipse(7, 9, 5, 5, 'papel', 5); b.ellipse(7, 9, 3, 3, 'papel', 4); b.ellipse(7, 9, 1.2, 1.2, 'papel', 2);
      b.rect(10, 11, 5, 3, 'papel', 6); b.hline(10, 14, 13, 'papel', 4); b.px(6, 5, 'papel', 7);
    },
    splint(b) {
      b.rect(2, 4, 12, 3, 'madeira', 4); b.hline(2, 13, 4, 'madeira', 5); b.rect(2, 9, 12, 3, 'madeira', 4); b.hline(2, 13, 9, 'madeira', 5);
      b.rect(5, 3, 2, 10, 'papel', 6); b.rect(10, 3, 2, 10, 'papel', 6);
    },
    antibiotic(b) {
      b.rect(5, 2, 6, 3, 'papel', 6); b.hline(5, 10, 4, 'papel', 4);
      b.rect(4, 5, 8, 10, 'ambar', 3); b.vline(11, 6, 14, 'ambar', 4); b.rect(4, 8, 8, 4, 'papel', 6); b.hline(5, 10, 10, 'vermelho', 3); b.vline(6, 5, 7, 'ambar', 5);
    },
    generico(b) {
      b.rect(2, 5, 12, 9, 'sepia', 4); b.hline(2, 13, 5, 'sepia', 5); b.vline(13, 6, 13, 'sepia', 3); b.hline(2, 13, 13, 'sepia', 2);
      b.poly([[2, 5], [5, 2], [15, 2], [13, 5]], 'sepia', 5);
      b.vline(8, 5, 13, 'vermelho', 3); b.hline(2, 13, 9, 'vermelho', 3); b.line(8, 5, 11, 2, 'vermelho', 3); b.px(8, 9, 'vermelho', 5);
    }
  };
  const sprites = new Map();
  /* Sprite de um item: o desenho da bolsa (ITEM_DEFS, 16 px por quadrado) ou a reserva. */
  function spriteItem(id) {
    const def = root.ITEM_DEFS?.[id], chave = (def ? 'def:' : 'res:') + id;
    let c = sprites.get(chave);
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
    } else c = U.art('ib:item:' + (RESERVA[id] ? id : 'generico'), 16, 16, b => { (RESERVA[id] || RESERVA.generico)(b); contorno(b); });
    sprites.set(chave, c);
    return c;
  }
  const conhecido = id => !!(root.ITEM_DEFS?.[id] || RESERVA[id]);
  /* Maior escala inteira (1 ou 2) que cabe no espaço. */
  const escalaItem = (c, maxW, maxH) => (c.width * 2 <= maxW && c.height * 2 <= maxH ? 2 : 1);

  /* Silhueta (para sombras projetadas) de um canvas qualquer. */
  const silhuetas = new WeakMap();
  function silhueta(canvas, cor = '#07030c') {
    let s = silhuetas.get(canvas);
    if (s) return s;
    s = root.document.createElement('canvas'); s.width = canvas.width; s.height = canvas.height;
    const g = s.getContext('2d'); g.drawImage(canvas, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = cor; g.fillRect(0, 0, s.width, s.height);
    silhuetas.set(canvas, s);
    return s;
  }
  function comSombra(ctx, canvas, x, y, escala, {dx = 4, dy = 4, alfa = .5} = {}) {
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.globalAlpha = alfa; ctx.drawImage(silhueta(canvas), snap(x + dx), snap(y + dy), canvas.width * escala, canvas.height * escala); ctx.restore();
    ctx.drawImage(canvas, snap(x), snap(y), canvas.width * escala, canvas.height * escala);
  }

  /* Dá um item da lista à bolsa. Devolve 'bolsa' | 'chao' (os dois contam como
     pego) | false (bolsa cheia) | 'sem' (prévia sem bolsa: nada é entregue). */
  function entregar(sys, it, titulo = 'PEGOU') {
    const nome = nomeItem(it);
    const bolsa = sys.itens;
    if (!bolsa || typeof bolsa.dar !== 'function') { sys.toast(titulo, `${nome} · prévia sem bolsa`, 'alerta'); sys.sfx('erro'); return 'sem'; }
    let r = false;
    try { r = bolsa.dar(it.id, it.qtd, it.dados ? {...it.dados} : null); } catch (erro) { console.error('Bolsa recusou o item:', erro); r = false; }
    if (!r) { sys.toast('BOLSA CHEIA', `${nome} não coube`, 'alerta'); sys.sfx('erro'); return false; }
    if (r === 'chao') { sys.toast('CAIU NO CHÃO', `A bolsa está cheia: ${nome}`, 'alerta'); sys.sfx('objeto'); return 'chao'; }
    sys.toast(titulo, nome, it.id === 'chave' ? icone('chave') : icone('bolsa'));
    sys.sfx(titulo === 'ENCONTROU' ? 'pista' : 'objeto');
    return 'bolsa';
  }

  /* ------------------------------------------------------------ papel e etiquetas */
  function papel(kind, w, h, seed = 1) {
    w = Math.max(6, Math.round(w)); h = Math.max(6, Math.round(h));
    if (root.PistaPapel?.paperArt) return root.PistaPapel.paperArt(kind, w, h, seed);
    return U.art(`ib:papel:${w}:${h}`, w, h, b => {
      b.rect(0, 0, w, h, 'papel', 5); b.speckle(0, 0, w, h, 'papel', 6, .04, K.rng(seed));
      b.hline(0, w - 1, 0, 'papel', 6); b.vline(w - 1, 0, h - 1, 'papel', 6); b.hline(0, w - 1, h - 1, 'papel', 3); b.vline(0, 1, h - 1, 'papel', 4);
    });
  }
  function cortar(str, maxW) {
    let s = String(str ?? '');
    if (K.measure(s) <= maxW) return s;
    while (s.length > 1 && K.measure(s + '…') > maxW) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }
  /* Etiqueta de papel com um nome (compartimentos, itens). */
  function etiqueta(ctx, str, cx, cy, maxW, estado = 'normal') {
    const s = cortar(str, Math.max(10, maxW - 10));
    const tw = K.measure(s), w = snap(tw + 11), h = 14, x = snap(clamp(cx - w / 2, 4, SW - w - 6)), y = snap(cy - h / 2);
    const [fundo, borda, tinta] = {
      normal: [C('papel', 6), C('papel', 2), C('tinta', 1)],
      hover: [C('papel', 7), '#ffd18c', C('tinta', 0)],
      foco: [C('amarelo', 5), C('amarelo', 1), C('tinta', 0)],
      apagado: [C('papel', 4), C('papel', 1), C('tinta', 2)]
    }[estado] || [];
    U.rect(ctx, x + 2, y + 2, w, h, '#07030a88');
    U.rect(ctx, x, y, w, h, fundo);
    U.outline(ctx, x, y, w, h, borda, 1);
    U.rect(ctx, x + 1, y + h - 2, w - 2, 1, estado === 'foco' ? C('amarelo', 3) : C('papel', 4));
    K.drawText(ctx, s, x + Math.floor((w - tw) / 2), y + 4, {color: tinta});
    return {x, y, w, h, cortado: s !== String(str)};
  }
  /* Sombra de contato no chão, em faixas de 2 px. */
  function sombraChao(ctx, x, y, w, h = 8, alfa = .5) {
    ctx.save(); ctx.globalAlpha = alfa; ctx.fillStyle = '#07030a';
    for (let j = 0; j < h; j += 2) {
      const k = Math.abs(j + 1 - h / 2) / (h / 2), inset = snap(w * .06 * k * k + (k > .6 ? 4 : 0));
      ctx.fillRect(snap(x + inset), snap(y + j), Math.max(2, snap(w - inset * 2)), 2);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ dobradiças
     Portas e tampas giram de verdade: a face é amostrada coluna a coluna (ou
     linha a linha) na largura projetada. Cada textura é pintada como aparece
     na tela no seu estado visível (a frente fechada, o avesso aberto); a borda
     da textura encostada na dobradiça fica do lado da dobradiça. Blit em 2×. */
  const GRAU = Math.PI / 180;
  /* Porta de eixo vertical vista de frente. hx: coluna de arte da dobradiça
     (a borda); dir +1 = fechada ela fica à direita do eixo. ang 0…1 → 0…abre°.
     Devolve o retângulo projetado em pixels de tela. */
  function portaVertical(ctx, F, {frente, verso, hx, y, w, h, ang, dir = 1, abre = 110, borda = null}) {
    const th = ang * abre * GRAU, c = Math.cos(th), pw = Math.round(Math.abs(c) * w);
    const face = c >= 0 ? frente : verso, lado = c >= 0 ? dir : -dir;
    const cresce = Math.round(Math.sin(th) * 2 * Math.min(1, (1 - ang) * 5));
    ctx.imageSmoothingEnabled = false;
    let x0 = Infinity, x1 = -Infinity;
    for (let k = 0; k < pw; k++) {
      const q = Math.min(w - 1, Math.floor(k / pw * w)), src = lado > 0 ? q : w - 1 - q;
      const col = lado > 0 ? hx + k : hx - 1 - k, e = Math.round(cresce * k / Math.max(1, pw));
      const sx = F.X(col), sy = F.Y(y - e);
      ctx.drawImage(face, src, 0, 1, h, sx, sy, 2, (h + e * 2) * 2);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx + 2);
    }
    // A espessura da folha aparece na borda livre enquanto ela gira.
    if (borda && Math.sin(th) > .15) {
      const e = cresce, col = lado > 0 ? hx + pw : hx - 1 - pw;
      U.rect(ctx, F.X(col), F.Y(y - e), 2, (h + e * 2) * 2, borda);
      x0 = Math.min(x0, F.X(col)); x1 = Math.max(x1, F.X(col) + 2);
    }
    if (c >= 0 && c < .98) { ctx.save(); ctx.globalAlpha = (1 - c) * .45; U.rect(ctx, x0, F.Y(y - cresce), x1 - x0, (h + cresce * 2) * 2, '#0a0510'); ctx.restore(); }
    return pw ? {x: x0, y: F.Y(y - cresce), w: x1 - x0, h: (h + cresce * 2) * 2} : null;
  }
  /* Tampa de eixo horizontal numa vista de cima inclinada (3/4). hy: linha
     da dobradiça; L: comprimento em linhas quando fechada; tras = dobradiça
     no fundo (fechada ela desce na tela). Quem abre para trás mostra o avesso
     depois de ~45°; quem abre para a frente mostra a face de cima. */
  function tampaHorizontal(ctx, F, {frente, verso, x, hy, w, L, ang, abre = 110, tras = true, altura = 1.15}) {
    const th = ang * abre * GRAU;
    const ext = tras ? L * (Math.cos(th) - altura * Math.sin(th)) : -L * (Math.cos(th) + altura * Math.sin(th));
    const ve = tras ? Math.sin(45 * GRAU - th) >= 0 : Math.sin(45 * GRAU + th) >= 0;
    const face = ve ? frente : verso, n = Math.round(Math.abs(ext)), sinal = ext >= 0 ? 1 : -1;
    ctx.imageSmoothingEnabled = false;
    for (let k = 0; k < n; k++) {
      const q = Math.min(face.height - 1, Math.floor(k / n * face.height)), src = sinal > 0 ? q : face.height - 1 - q;
      const row = sinal > 0 ? hy + k : hy - 1 - k;
      ctx.drawImage(face, 0, src, w, 1, F.X(x), F.Y(row), w * 2, 2);
    }
    if (!ve || (Math.abs(ext) < L * .98)) { ctx.save(); ctx.globalAlpha = ve ? (1 - Math.abs(ext) / L) * .35 : .18; U.rect(ctx, F.X(x), F.Y(sinal > 0 ? hy : hy - n), w * 2, n * 2, '#0a0510'); ctx.restore(); }
    return {y0: sinal > 0 ? hy : hy - n, y1: sinal > 0 ? hy + n : hy, n};
  }

  /* ------------------------------------------------------------ fundos (240×124 em 2×) */
  function fundoArt(tipo) {
    return U.art('ib:fundo:' + tipo, 240, 124, b => {
      const R = K.rng(seedOf(tipo));
      if (tipo === 'rua') {
        b.rect(0, 0, 240, 84, 'vermelho', 1);
        for (let row = 0; row * 5 < 84; row++) {
          const y = row * 5, off = row % 2 ? 6 : 0;
          b.hline(0, 239, y, 'concreto', 1);
          for (let x = -off; x < 240; x += 12) { b.vline(x, y, y + 4, 'concreto', 1); if (K.hash2(x, row, 3) > .7) b.rect(x + 1, y + 1, 11, 4, 'vermelho', 2); else if (K.hash2(x, row, 4) > .85) b.rect(x + 1, y + 1, 11, 4, 'mogno', 2); }
        }
        b.rect(196, 0, 5, 84, 'metal', 2); b.vline(200, 0, 83, 'metal', 4); for (let y = 10; y < 84; y += 22) b.rect(195, y, 7, 2, 'metal', 3);
        b.rect(0, 84, 240, 5, 'concreto', 3); b.hline(0, 239, 84, 'concreto', 5); b.hline(0, 239, 88, 'concreto', 1);
        b.rect(0, 89, 240, 35, 'carvao', 2); b.speckle(0, 89, 240, 35, 'carvao', 3, .08, R); b.speckle(0, 89, 240, 35, 'carvao', 1, .05, R);
        b.ellipse(40, 112, 30, 5, 'agua', 1); b.ellipse(38, 111, 22, 3, 'carvao', 3); b.hline(24, 40, 111, 'agua', 2);
        b.shadeFn(0, 0, 240, 124, (x, y) => faixas((.55 - Math.hypot((x - 110) / 150, (y - 30) / 120)) * 2.4));
        return;
      }
      if (tipo === 'parede') {
        b.rect(0, 0, 240, 112, 'concreto', 3); b.speckle(0, 0, 240, 112, 'concreto', 2, .05, R); b.speckle(0, 0, 240, 112, 'concreto', 4, .03, R);
        for (let x = 0; x < 240; x++) { const drip = Math.floor(K.hash2(x >> 2, 1, 9) * 30); if (drip > 22) b.vline(x, 0, drip - 12, 'concreto', 2); }
        b.rect(0, 12, 240, 5, 'metal', 2); b.hline(0, 239, 12, 'metal', 4); b.hline(0, 239, 16, 'metal', 1); for (let x = 20; x < 240; x += 60) b.rect(x, 10, 3, 9, 'metal', 3);
        b.rect(0, 108, 240, 4, 'madeira', 2); b.hline(0, 239, 108, 'madeira', 4);
        b.rect(0, 112, 240, 12, 'madeira', 1); for (let x = 0; x < 240; x += 26) b.vline(x, 112, 123, 'madeira', 0);
        b.shadeFn(0, 0, 240, 124, (x, y) => faixas((.5 - Math.hypot((x - 130) / 160, (y - 40) / 110)) * 2.6));
        return;
      }
      // Sala: papel de parede listrado, lambri, rodapé e piso de tábuas. 'chao' sobe o piso (objetos vistos de cima).
      const piso = tipo === 'chao' ? 58 : 104, lambri = piso - 28;
      b.rect(0, 0, 240, piso, 'sepia', 2);
      for (let x = 0; x < 240; x += 14) { b.rect(x + 5, 0, 4, lambri, 'sepia', 3); b.vline(x + 4, 0, lambri, 'sepia', 1); }
      for (let y = 6; y < lambri - 3; y += 12) for (let x = 0; x < 240; x += 14) { const cx = x + (y % 24 === 6 ? 12 : 5); b.px(cx, y, 'sepia', 4); b.px(cx - 1, y + 1, 'sepia', 4); b.px(cx + 1, y + 1, 'sepia', 4); b.px(cx, y + 2, 'sepia', 4); }
      b.rect(0, lambri, 240, piso - lambri, 'madeira', 2); b.hline(0, 239, lambri, 'madeira', 4); b.hline(0, 239, lambri + 1, 'madeira', 5); b.hline(0, 239, lambri + 2, 'madeira', 1);
      for (let x = 4; x < 240; x += 34) { b.inset(x, lambri + 6, 28, piso - lambri - 12, 'madeira', 2, 3, 1); }
      b.rect(0, piso - 3, 240, 3, 'madeira', 3); b.hline(0, 239, piso - 3, 'madeira', 5);
      b.rect(0, piso, 240, 124 - piso, 'madeira', 3);
      for (let y = piso, i = 0; y < 124; i++) {
        const hgt = 5 + Math.floor(i / 3);
        b.hline(0, 239, y, 'madeira', 1);
        const off = Math.floor(K.hash2(i, 5, 2) * 60);
        for (let x = off; x < 240; x += 58 + (i % 3) * 7) b.vline(x, y, Math.min(123, y + hgt - 1), 'madeira', 1);
        veios(b, 0, y + 1, 240, hgt - 1, 'madeira', 3, i + 3, .8);
        y += hgt;
      }
      b.shadeFn(0, 0, 240, 124, (x, y) => faixas((.5 - Math.hypot((x - 100) / 160, (y - 40) / 120)) * 2.2));
    });
  }

  /* ================================================================ recipiente */
  const ESTILOS = {};
  const PAINEL = {x: 244, y: 30, w: 228, h: 228};
  const CHAO_Y = 242, CENTRO = 240, COLUNA = 124;
  const DUR = {chave: .85, codigo: .75};

  const trancaDe = d => (d?.tranca === 'chave' || d?.tranca === 'codigo') ? d.tranca : 'nenhuma';
  const trancado = (st, clue) => trancaDe(clue.data) !== 'nenhuma' && !st.mem.destrancado;
  /* Compartimentos do texto (até o máximo do estilo) e a geometria do móvel. */
  function preparar(st, clue) {
    const d = clue.data || {};
    const txt = String(d.compartimentos ?? ''), estilo = ESTILOS[d.estilo] ? d.estilo : 'gaveteiro';
    if (st.txt === txt && st.estilo === estilo && st.G) return st.comps;
    const E = ESTILOS[estilo];
    let comps = parseCompartimentos(txt).slice(0, E.max);
    if (!comps.length) comps = [{nome: '', texto: '', itens: [], key: '##0'}];
    Object.assign(st, {txt, estilo, E, comps});
    try { st.G = E.geo(comps.length, comps); } catch (erro) { console.error(erro); st.G = ESTILOS.gaveteiro.geo(comps.length, comps); st.E = ESTILOS.gaveteiro; }
    if (st.foco >= comps.length) st.foco = -1;
    return comps;
  }
  const nomeParte = (st, i) => st.comps[i]?.nome || st.G.partes[i]?.nome || (st.comps.length === 1 ? st.E.unica : `${st.E.parte} ${i + 1}`);
  const restantes = (st, i) => {
    const c = st.comps[i];
    if (!c) return [];
    const pegos = st.mem.pegos[c.key] || [];
    return c.itens.filter(it => !pegos.includes(it.key));
  };
  // A peça aberta agora (uma de cada vez) — gaveta puxada, almofada levantada, bolso aberto.
  const abertaAgora = (st, i) => !!st.comps[i] && st.mem.aberto === st.comps[i].key;
  function painelAlvo(st, clue) {
    if ((trancado(st, clue) && trancaDe(clue.data) === 'codigo') || st.destrancar?.tipo === 'codigo') return 'teclado';
    if (st.foco >= 0 && st.foco < st.comps.length && (!st.E.capa || st.mem.tampa)) return 'parte';
    return null;
  }

  /* ------------------------------------------------------------ interior do painel */
  const MATERIAIS = {
    madeira: {ramp: 'madeira', f: 2, textura: 'veio'},
    mogno: {ramp: 'mogno', f: 2, textura: 'veio'},
    metal: {ramp: 'metal', f: 2, textura: 'risco'},
    azul: {ramp: 'azul', f: 1, textura: 'risco'},
    verde: {ramp: 'verde', f: 1, textura: 'risco'},
    geladeira: {ramp: 'palido', f: 5, textura: 'vidro'},
    congelador: {ramp: 'ceu', f: 3, textura: 'gelo'},
    papelao: {ramp: 'sepia', f: 3, textura: 'ondulado'},
    lixo: {ramp: 'preto', f: 2, textura: 'dobra'},
    tecido: {ramp: 'vermelho', f: 1, textura: 'trama'},
    colchao: {ramp: 'papel', f: 3, textura: 'trama'},
    forro: {ramp: 'roxo', f: 1, textura: 'trama'},
    escuro: {ramp: 'carvao', f: 1, textura: 'poeira'}
  };
  function interiorArt(mat, w, h) {
    const M = MATERIAIS[mat] || MATERIAIS.madeira;
    return U.art(`ib:interior:${mat}:${w}x${h}`, w, h, b => {
      const {ramp, f} = M, R = K.rng(seedOf(mat) + w);
      b.rect(0, 0, w, h, ramp, f);
      const fx = 7, fy = 9, fw = w - 14, fh = h - 15;
      if (M.textura === 'veio') veios(b, fx, fy, fw, fh, ramp, f, 3);
      else if (M.textura === 'risco') { b.speckle(fx, fy, fw, fh, ramp, f + 1, .05, R); for (let i = 0; i < 9; i++) { const x = fx + R() * fw, y = fy + R() * fh; b.line(x, y, x + 3 + R() * 8, y + R() * 3 - 1, ramp, f + 2); } }
      else if (M.textura === 'vidro') { for (let y = fy; y < fy + fh; y++) b.hline(fx, fx + fw - 1, y, ramp, f + (y < fy + 10 ? 2 : y < fy + 30 ? 1 : 0)); b.hline(fx, fx + fw - 1, fy + 38, 'ceu', 6); b.hline(fx, fx + fw - 1, fy + 39, 'ceu', 4); b.hline(fx, fx + fw - 1, fy + 76, 'ceu', 6); b.hline(fx, fx + fw - 1, fy + 77, 'ceu', 4); }
      else if (M.textura === 'gelo') { b.speckle(fx, fy, fw, fh, 'ceu', 5, .12, R); b.speckle(fx, fy, fw, fh, 'palido', 6, .05, R); }
      else if (M.textura === 'ondulado') { for (let x = fx; x < fx + fw; x += 3) b.vline(x, fy, fy + fh - 1, ramp, f + 1); b.speckle(fx, fy, fw, fh, ramp, f - 1, .03, R); }
      else if (M.textura === 'dobra') { for (let i = 0; i < 14; i++) { const x = fx + R() * fw, y = fy + R() * fh, l = 6 + R() * 14; for (let k = 0; k < l; k++) b.px(x + k, y + Math.sin(k / 3 + i) * 2, ramp, k % 5 ? f + 2 : f + 3); } }
      else if (M.textura === 'trama') { for (let y = fy; y < fy + fh; y += 2) for (let x = fx + (y / 2 % 2) * 2; x < fx + fw; x += 4) b.rect(x, y, 2, 2, ramp, f + 1); }
      else if (M.textura === 'poeira') { b.speckle(fx, fy, fw, fh, ramp, f + 1, .06, R); b.speckle(fx, fy, fw, fh, ramp, f + 2, .015, R); }
      // Paredes do compartimento vistas de cima: fundo e esquerda recebem a luz (vem de cima à direita).
      b.poly([[0, 0], [w, 0], [w - fx, fy], [fx, fy]], ramp, f + 2);
      b.poly([[0, 0], [fx, fy], [fx, h - 6], [0, h]], ramp, f + 1);
      b.poly([[w, 0], [w, h], [w - fx, h - 6], [w - fx, fy]], ramp, Math.max(0, f - 1));
      b.poly([[0, h], [fx, h - 6], [w - fx, h - 6], [w, h]], ramp, f);
      b.hline(0, w - 1, 0, ramp, f + 3); b.vline(w - 1, 0, h - 1, ramp, f + 2); b.hline(0, w - 1, h - 1, ramp, Math.max(0, f - 2)); b.vline(0, 0, h - 1, ramp, Math.max(0, f - 1));
      b.shadeFn(fx, fy, fw, fh, (x, y) => -Math.max(0, 1 - (y - fy) / 10) * .9 - Math.max(0, 1 - (w - fx - x) / 12) * .8);
    });
  }

  /* ------------------------------------------------------------ peças comuns */
  // Cadeado de latão (12×10 corpo + alça), desenhado em tela.
  const cadeadoCorpo = () => U.art('ib:cadeado:corpo', 12, 11, b => {
    b.rect(0, 0, 12, 11, 'latao', 3); b.hline(0, 11, 0, 'latao', 5); b.vline(11, 1, 10, 'latao', 4); b.hline(0, 11, 10, 'latao', 1); b.vline(0, 1, 10, 'latao', 2);
    b.hline(1, 10, 1, 'latao', 4); b.ellipse(6, 4.5, 1.6, 1.6, 'preto', 0); b.vline(6, 5, 7, 'preto', 0); b.px(9, 2, 'latao', 6);
    contorno(b);
  });
  const cadeadoAlca = () => U.art('ib:cadeado:alca', 10, 9, b => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 10; x++) {
      const dx = x - 4.5, r = y < 5 ? Math.hypot(dx, (y - 4.5) * 1.1) : Math.abs(dx);
      if ((y < 5 && r > 2.6 && r < 4.8) || (y >= 5 && (x === 1 || x === 2 || x === 7 || x === 8))) b.px(x, y, 'metal', x > 5 ? 5 : 3);
    }
    contorno(b);
  });
  const travaDigital = aberta => U.art('ib:trava:' + aberta, 14, 18, b => {
    b.bevel(0, 0, 14, 18, 'metal', 2, 4, 1); b.inset(2, 2, 10, 4, 'fosforo', 1, 2, 0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.rect(3 + c * 3, 8 + r * 3, 2, 2, 'metal', 5);
    b.px(11, 15, aberta ? 'verde' : 'vermelho', 5, K.EMISSIVE);
    contorno(b);
  });

  /* Itens pequenos (1×) dentro do móvel aberto: dá para pegar direto dali. */
  function miudos(F, i, x, y, w, h, {clicavel = true} = {}) {
    const itens = F.itens(i);
    if (!itens.length) return;
    const lista = itens.map(it => ({it, c: spriteItem(it.id)}));
    const larg = lista.reduce((a, o) => a + o.c.width + 4, -4);
    let cx = snap(x + Math.max(2, (w - larg) / 2));
    for (const {it, c} of lista) {
      if (cx + c.width > x + w) break;
      const iy = snap(y + h - c.height - 2);
      comSombra(F.ctx, c, cx, iy, 1, {dx: 2, dy: 2, alfa: .5});
      if (clicavel) {
        // A região entra depois do móvel inteiro (render), para o item ficar por cima da gaveta/prateleira.
        const data = `${i}|${it.key}`, hot = F.ui.hover === 'item' && F.ui.hoverData === data;
        F.itensRegioes.push([cx - 2, iy - 2, c.width + 4, c.height + 4, data]);
        if (hot) { U.ants(F.ctx, cx - 4, iy - 4, c.width + 8, c.height + 8, F.t); F.st.tip = {texto: 'Pegar: ' + nomeItem(it), x: cx + c.width / 2, y: iy - 20}; }
      }
      cx += c.width + 4;
    }
  }
  function rotuloParte(F, i, cx, cy, maxW) {
    const {st, ui} = F, nome = nomeParte(st, i);
    const hover = (ui.hover === 'parte' || ui.hover === 'interior') && ui.hoverData === i;
    const visto = st.mem.abertos.includes(st.comps[i]?.key) && !restantes(st, i).length && st.foco !== i;
    const r = etiqueta(F.ctx, nome, cx, cy, maxW, st.foco === i ? 'foco' : hover ? 'hover' : visto ? 'apagado' : 'normal');
    if (hover && r.cortado) st.tip = {texto: nome, x: cx, y: r.y - 18};
    return r;
  }

  /* ------------------------------------------------------------ gavetas (gaveteiro, arquivo, bancada) */
  const portaEtiqueta = h => clamp(Math.floor(h * .28), 1, Math.max(1, h - 8));
  function frenteArt(tipo, w, h) {
    return U.art(`ib:frente:${tipo}:${w}x${h}`, w, h, b => {
      if (tipo === 'metal') {
        b.bevel(0, 0, w, h, 'metal', 3, 5, 1); b.hline(1, w - 2, 1, 'metal', 4);
        const lw = Math.min(w - 10, 40), lx = Math.floor((w - lw) / 2), ly = portaEtiqueta(h), lh = Math.min(7, h - 3);
        b.inset(lx, ly, lw, lh, 'metal', 2, 5, 1); b.rect(lx + 1, ly + 1, lw - 2, lh - 2, 'papel', 5);
        if (h >= ly + lh + 4) { const hy = ly + lh + 2, cx = Math.floor(w / 2); b.rect(cx - 8, hy, 16, 2, 'preto', 2); b.hline(cx - 9, cx + 8, hy - 1, 'metal', 6); b.px(cx - 9, hy, 'metal', 2); b.px(cx + 8, hy, 'metal', 4); }
        b.speckle(1, 2, w - 2, h - 3, 'metal', 4, .025, K.rng(w * h));
        return;
      }
      if (tipo === 'compensado') {
        b.bevel(0, 0, w, h, 'madeira', 4, 5, 2); veios(b, 1, 1, w - 2, h - 2, 'madeira', 4, w, .7);
        const hx = Math.floor(w / 2);
        b.rect(hx - 6, 2, 12, 2, 'metal', 4); b.hline(hx - 6, hx + 5, 2, 'metal', 6); b.px(hx - 6, 4, 'metal', 2); b.px(hx + 5, 4, 'metal', 2);
        return;
      }
      b.bevel(0, 0, w, h, 'madeira', 3, 5, 1);
      if (h >= 10) { b.inset(3, 2, w - 6, h - 4, 'madeira', 4, 5, 2); veios(b, 4, 3, w - 8, h - 6, 'madeira', 4, w + h); }
      else veios(b, 1, 1, w - 2, h - 2, 'madeira', 3, w + h);
      const ky = Math.floor(h / 2);
      for (const kx of [7, w - 8]) { b.ellipse(kx + .5, ky + .5, 2.2, 2.2, 'latao', 2); b.px(kx + 1, ky - 1, 'latao', 6); b.px(kx, ky, 'latao', 4); }
    });
  }
  function dentroGavetaArt(tipo, w, D, seed) {
    return U.art(`ib:dentro:${tipo}:${w}x${D}:${seed % 4}`, w, D, b => {
      const ramp = tipo === 'metal' ? 'metal' : 'madeira', R = K.rng(seed * 7 + w);
      b.rect(0, 0, w, D, ramp, 1);
      b.hline(0, w - 1, 0, ramp, 0);
      b.rect(0, 0, 2, D, ramp, 3); b.rect(w - 2, 0, 2, D, ramp, 2);
      if (tipo === 'metal') {
        // Pastas suspensas com as abas coloridas.
        const cores = ['amarelo', 'verde', 'azul', 'vermelho', 'papel'];
        for (let x = 4, k = 0; x < w - 8; x += 6 + (k % 3), k++) {
          const c = cores[(k + seed) % cores.length], top = 2 + (k % 2);
          b.rect(x, top + 2, 5, D - top - 4, c, 3); b.hline(x, x + 4, top + 2, c, 5);
          if (k % 3 === 0) b.rect(x + 1, top, 3, 2, c, 4);
        }
        b.hline(2, w - 3, D - 3, ramp, 4);
        return;
      }
      veios(b, 2, 1, w - 4, D - 3, ramp, 1, seed, .6);
      // Bagunça: papéis, lápis, clipes, uma borracha.
      for (let k = 0; k < 2; k++) { const px = 4 + Math.floor(R() * (w - 26)), py = 1 + Math.floor(R() * Math.max(1, D - 12)); b.rect(px, py, 16, 9, 'papel', 5); b.hline(px, px + 15, py, 'papel', 6); for (let l = py + 2; l < py + 8; l += 2) b.hline(px + 2, px + 10 + (l % 4), l, 'tinta', 3); }
      for (let k = 0; k < 2; k++) { const px = 6 + Math.floor(R() * (w - 22)), py = 2 + Math.floor(R() * Math.max(1, D - 6)); b.line(px, py, px + 11, py + 2, k ? 'amarelo' : 'vermelho', 4); b.px(px + 11, py + 2, 'grafite', 1); }
      for (let k = 0; k < 3; k++) { const px = 4 + Math.floor(R() * (w - 8)), py = 2 + Math.floor(R() * Math.max(1, D - 5)); b.frame(px, py, 2, 4, 'metal', 5); }
      b.hline(2, w - 3, D - 2, ramp, 3); b.hline(2, w - 3, D - 1, ramp, 2);
    });
  }
  /* Uma gaveta: interior revelado acima da frente, que desce ao ser puxada. */
  function gaveta(F, i, p, frente, dentro) {
    const {ctx} = F, u = F.aberto(i), dy = Math.round(p.D * u);
    const x = F.X(p.x), y = F.Y(p.y), w = p.w * 2, h = p.h * 2;
    if (dy > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, dy * 2); ctx.clip();
      const iy = y + dy * 2 - p.D * 2;
      U.blit(ctx, dentro, x, iy);
      if (u > .9) miudos(F, i, x + 8, iy, w - 16, p.D * 2 - 2);
      ctx.restore();
      if (u > .9) F.interior(i, x, y, w, dy * 2);
    }
    U.blit(ctx, frente, x, y + dy * 2);
    if (dy > 0) { ctx.save(); ctx.globalAlpha = .45 * u; U.rect(ctx, x + 2, y + dy * 2 + h, w, 6, '#07030a'); ctx.restore(); }
    F.parte(i, x, y + dy * 2, w, h);
    return {x, y: y + dy * 2, w, h};
  }

  /* Fechadas primeiro; as abertas por cima, de baixo para cima (a de cima cobre a de baixo). */
  function desenharGavetas(F, frente, dentro, largRotulo, posRotulo = null) {
    const ordem = F.G.partes.map((p, i) => i);
    const uma = i => {
      const p = F.G.partes[i], r = gaveta(F, i, p, frente(p, i), dentro(p, i));
      const [cx, cy] = posRotulo ? posRotulo(r, p) : [r.x + r.w / 2, r.y + r.h / 2];
      F.rotulo(i, cx, cy, largRotulo(r, p));
    };
    for (const i of ordem) if (F.aberto(i) <= 0) uma(i);
    for (const i of ordem.slice().reverse()) if (F.aberto(i) > 0) uma(i);
  }

  ESTILOS.gaveteiro = {
    nome: 'Gaveteiro', fundo: 'sala', max: 6, som: 'gaveta', material: 'madeira', parte: 'Gaveta', unica: 'Gaveta', fisico: true,
    geo(n) {
      const N = clamp(n, 1, 6), W = 84, topo = 12, H = 98;
      const y0 = topo + 5, y1 = H - 7, area = y1 - y0, gap = 2;
      const hd = Math.floor((area - gap * (N - 1)) / N), sobra = area - (hd * N + gap * (N - 1));
      const partes = [];
      for (let i = 0; i < N; i++) partes.push({x: 5, y: y0 + Math.floor(sobra / 2) + i * (hd + gap), w: W - 10, h: hd, D: clamp(Math.round(hd * .5), 5, 12)});
      return {w: W, h: H, base: H, partes, tranca: {x: W + 3, y: y0 + 6, barra: [y0 - 1, y1 + 1]}};
    },
    corpo: G => U.art(`ib:gaveteiro:corpo:${G.h}`, G.w + 4, G.h, b => {
      const W = G.w, H = G.h, o = 2, top = 12;
      // Em cima: paninho de crochê, porta-retrato e um vasinho.
      for (let x = 10; x < 40; x++) { b.px(x, top - 1, 'papel', (x % 3) ? 6 : 4); if (x % 4 === 1) b.px(x, top, 'papel', 5); }
      b.rect(15, 0, 14, 11, 'madeira', 4); b.hline(15, 28, 0, 'madeira', 6); b.vline(28, 1, 10, 'madeira', 5); b.vline(15, 1, 10, 'madeira', 2);
      b.rect(17, 2, 10, 7, 'sepia', 4); b.ellipse(22, 5, 2, 2.2, 'sepia', 2); b.rect(19, 7, 6, 2, 'sepia', 2); b.px(18, 2, 'sepia', 6);
      b.line(22, 10, 25, 11, 'madeira', 2);
      b.rect(58, 5, 9, 7, 'ceuVermelho', 3); b.hline(57, 67, 5, 'ceuVermelho', 5); b.vline(66, 6, 11, 'ceuVermelho', 4); b.hline(58, 66, 11, 'ceuVermelho', 1);
      b.ellipse(62, 3, 3, 2.5, 'folha', 3); b.px(60, 1, 'folha', 5); b.px(64, 0, 'folha', 4); b.px(62, 2, 'folha', 5); b.vline(61, 1, 4, 'folha', 2);
      b.rect(0, top, W + 4, 4, 'madeira', 4); b.hline(0, W + 3, top, 'madeira', 6); b.hline(0, W + 3, top + 3, 'madeira', 2); b.vline(W + 3, top, top + 3, 'madeira', 5);
      veios(b, 1, top + 1, W + 2, 2, 'madeira', 4, 11);
      b.rect(o, top + 4, W, H - top - 10, 'madeira', 3);
      b.rect(o, top + 4, 4, H - top - 10, 'madeira', 2); b.rect(o + W - 4, top + 4, 4, H - top - 10, 'madeira', 4); b.vline(o + W - 1, top + 4, H - 7, 'madeira', 5);
      b.rect(o + 4, top + 5, W - 8, H - top - 11, 'madeira', 0);
      b.rect(o, H - 6, W, 6, 'madeira', 1); b.rect(o + 6, H - 6, W - 12, 3, 'madeira', 2); b.hline(o, o + W - 1, H - 6, 'madeira', 3);
      b.bevel(o, H - 6, 7, 6, 'madeira', 3, 4, 1); b.bevel(o + W - 7, H - 6, 7, 6, 'madeira', 3, 5, 1);
    }),
    desenhar(F) {
      const {ctx, G} = F, frente = p => frenteArt('madeira', p.w, p.h), dentro = (p, i) => dentroGavetaArt('madeira', p.w, p.D, i + 1);
      sombraChao(ctx, F.X(-3), F.Y(G.h) - 8, (G.w + 6) * 2, 12);
      U.blit(ctx, this.corpo(G), F.X(-2), F.Y(0));
      desenharGavetas(F, frente, dentro, r => r.w - 36, r => [r.x + r.w / 2, r.y + Math.max(r.h / 2, r.h * .64)]);
    }
  };

  /* ------------------------------------------------------------ enchimentos (a bagunça de cada zona) */
  function enchimentoArt(tipo, w, h, seed) {
    return U.art(`ib:ench:${tipo}:${w}x${h}:${seed % 36}`, w, h, b => {
      const R = K.rng(seed * 13 + w * 7 + h), chao = h - 1;
      if (tipo === 'louca') {
        // Cada prateleira ganha dois grupos (um em cada ponta), escolhidos pela semente.
        const grupos = [
          x => { if (h < 12) return 0; b.rect(x, chao - 9, 7, 9, 'ceu', 4); b.vline(x + 6, chao - 8, chao, 'ceu', 5); b.rect(x + 1, chao - 5, 5, 5, 'ambar', 3); b.rect(x, chao - 11, 7, 2, 'latao', 4); b.px(x + 1, chao - 8, 'ceu', 6);
            b.rect(x + 9, chao - 6, 5, 6, 'ceu', 4); b.rect(x + 10, chao - 4, 3, 4, 'vermelho', 3); b.rect(x + 9, chao - 7, 5, 1, 'latao', 4); return 15; },
          x => { for (let k = 0; k < Math.min(4, Math.floor(h / 3)); k++) b.ellipse(x + 7, chao - 1 - k * 2, 7, 1.6, 'papel', k % 2 ? 4 : 6); return 15; },
          x => { if (h < 13) return 0; b.rect(x, chao - 12, 8, 12, 'sepia', 4); b.hline(x, x + 7, chao - 12, 'sepia', 5); b.vline(x + 7, chao - 11, chao, 'sepia', 5); b.text(x + 1, chao - 8, 'SAL', 'vermelho', 3, {font: '3x5'}); return 10; },
          x => { for (let k = 0; k < 3; k++) { const cx = x + k * 5; b.rect(cx, chao - 4, 4, 4, 'papel', 6); b.vline(cx + 3, chao - 3, chao, 'papel', 4); b.px(cx + 4, chao - 3, 'papel', 5); } return 16; },
          x => { if (h < 16) return 0; b.rect(x + 1, chao - 14, 4, 14, 'verde', 3); b.rect(x + 2, chao - 17, 2, 3, 'verde', 4); b.vline(x + 4, chao - 13, chao, 'verde', 5); b.rect(x + 1, chao - 9, 4, 4, 'papel', 6);
            b.rect(x + 7, chao - 7, 5, 7, 'vermelho', 3); b.vline(x + 11, chao - 6, chao, 'vermelho', 5); b.hline(x + 7, x + 11, chao - 7, 'metal', 5); return 13; },
          x => { if (h < 9) return 0; b.ellipse(x + 7, chao - 3, 7, 3, 'metal', 4); b.rect(x, chao - 3, 15, 3, 'metal', 3); b.hline(x, x + 14, chao - 5, 'metal', 6); return 15; }
        ];
        const a = seed % grupos.length, c = (seed * 7 + 3) % grupos.length, dir = c === a ? (c + 1) % grupos.length : c;
        grupos[a](2);
        const x2 = w - 17; grupos[dir](x2);
      } else if (tipo === 'vestiario') {
        b.rect(3, chao - 5, 12, 5, 'papel', 6); b.hline(3, 14, chao - 5, 'papel', 7); b.hline(3, 14, chao - 2, 'agua', 4);
        if (h >= 12) { b.rect(w - 14, chao - 8, 11, 8, 'vermelho', 3); b.hline(w - 14, w - 4, chao - 8, 'vermelho', 5); b.rect(w - 11, chao - 10, 5, 2, 'metal', 4); }
      } else if (tipo === 'jaqueta') {
        const cx = Math.floor(w / 2);
        b.hline(2, w - 3, 1, 'metal', 5); b.rect(cx - 1, 0, 2, 3, 'metal', 6);
        const alt = Math.min(h - 8, 34);
        b.poly([[cx - 9, 4], [cx + 9, 4], [cx + 11, 4 + alt], [cx - 11, 4 + alt]], 'mogno', 3);
        b.poly([[cx - 9, 4], [cx - 13, 6], [cx - 14, 4 + alt * .8], [cx - 10, 4 + alt * .8]], 'mogno', 2);
        b.poly([[cx + 9, 4], [cx + 13, 6], [cx + 14, 4 + alt * .8], [cx + 10, 4 + alt * .8]], 'mogno', 4);
        b.vline(cx, 5, 4 + alt, 'mogno', 1); b.poly([[cx - 4, 4], [cx, 10], [cx + 4, 4]], 'mogno', 5);
        if (h >= 20) { b.rect(3, chao - 6, 9, 6, 'preto', 3); b.rect(w - 12, chao - 6, 9, 6, 'preto', 3); b.hline(3, 11, chao - 6, 'preto', 4); b.hline(w - 12, w - 4, chao - 6, 'preto', 4); }
      } else if (tipo === 'roupas') {
        b.hline(1, w - 2, 1, 'metal', 5); b.hline(1, w - 2, 2, 'metal', 2);
        const cores = ['azul', 'vermelho', 'papel', 'verde', 'carvao', 'rosa', 'ambar'], alt = Math.min(h - 4, 40);
        for (let x = 3, k = 0; x < w - 8; k++) {
          const cw = 7 + Math.floor(R() * 4), c = cores[(k + seed) % cores.length], len = Math.floor(alt * (.6 + R() * .4));
          b.line(x + cw / 2, 2, x + cw / 2 - 1, 4, 'metal', 5);
          b.rect(x, 5, cw, len, c, 3); b.vline(x + cw - 1, 5, 4 + len, c, 4); b.vline(x, 5, 4 + len, c, 2); b.hline(x, x + cw - 1, 5, c, 5);
          if (c !== 'papel' && len > 12) b.vline(x + Math.floor(cw / 2), 6, 4 + len, c, 2);
          x += cw + 1;
        }
      } else if (tipo === 'dobradas') {
        for (let s = 0; s < 2; s++) {
          const x = s ? w - 18 : 2, cores = s ? ['azul', 'papel', 'vermelho'] : ['verde', 'rosa', 'carvao'];
          for (let k = 0; k < Math.min(3, Math.floor(h / 4)); k++) { const y = chao - 3 - k * 3; b.rect(x, y, 16, 3, cores[k], 3); b.hline(x, x + 15, y, cores[k], 5); }
        }
      } else if (tipo === 'gavetinha') {
        b.bevel(1, 1, w - 2, h - 2, 'mogno', 3, 5, 1); b.rect(Math.floor(w / 2) - 5, Math.floor(h / 2) - 1, 10, 2, 'latao', 4); b.hline(Math.floor(w / 2) - 5, Math.floor(w / 2) + 4, Math.floor(h / 2) - 1, 'latao', 6);
      }
    });
  }

  /* Móveis de porta: corpo com o interior, zonas visíveis quando abre, folhas por cima. */
  function comPortas(F, {corpo, corpoX = 0, frente, verso, borda, zona}) {
    const {ctx, G} = F, ang = F.capa, aberto = F.mem.tampa && F.st.capa >= 1;
    U.blit(ctx, corpo, F.X(corpoX), F.Y(0));
    if (F.st.capa > 0) G.partes.forEach((p, i) => {
      zona(p, i);
      if (aberto && !p.naPorta) {
        miudos(F, i, F.X(p.x + (p.miudoX ?? 12)), F.Y(p.y), (p.w - (p.miudoX ?? 12) * 2) * 2, p.h * 2);
        F.parte(i, F.X(p.x), F.Y(p.y), p.w * 2, p.h * 2);
        F.rotulo(i, F.X(p.x + p.w / 2), F.Y(p.y) + (p.rotuloY ?? 9), p.w * 2 - 8);
      }
    });
    const rects = G.portas.map((p, k) => portaVertical(ctx, F, {frente: frente(p, k), verso: verso(p, k), hx: p.hx, y: p.y, w: p.w, h: p.h, ang, dir: p.dir, abre: p.abre || 110, borda}));
    if (!aberto) { const x0 = Math.min(...G.portas.map(p => p.dir > 0 ? p.hx : p.hx - p.w)), x1 = Math.max(...G.portas.map(p => p.dir > 0 ? p.hx + p.w : p.hx)); F.capaRegiao(F.X(x0), F.Y(G.portas[0].y), (x1 - x0) * 2, G.portas[0].h * 2); }
    else rects.forEach(r => r && F.capaRegiao(r.x, r.y, r.w, r.h));
    return rects;
  }
  /* Zonas empilhadas na vertical, com tábuas entre elas; pesos definem a altura. */
  function empilhar(x, w, y0, y1, pesos, esp = 2) {
    const total = pesos.reduce((a, b) => a + b, 0), livre = y1 - y0 - esp * (pesos.length - 1), out = [];
    let y = y0;
    pesos.forEach((p, i) => { const h = i === pesos.length - 1 ? y1 - y : Math.max(6, Math.round(livre * p / total)); out.push({x, y, w, h}); y += h + esp; });
    return out;
  }
  function portaMadeira(ramp, w, h, lado, {espelho = false} = {}) {
    return U.art(`ib:porta:${ramp}:${w}x${h}:${lado}:${espelho}`, w, h, b => {
      b.bevel(0, 0, w, h, ramp, 3, 5, 1);
      veios(b, 1, 1, w - 2, h - 2, ramp, 3, w + (lado === 'e' ? 1 : 2), .5);
      const pw = w - 10, h1 = Math.floor((h - 15) * .42), h2 = h - 15 - h1;
      if (espelho) {
        b.inset(5, 5, pw, h - 10, ramp, 3, 4, 1); b.rect(6, 6, pw - 2, h - 12, 'ceu', 3);
        b.shadeFn(6, 6, pw - 2, h - 12, (x, y) => faixas((y - 6) / (h - 12) * -1.5 + .8));
        for (let k = 0; k < 3; k++) b.line(8 + k * 7, 30 + k * 4, 8 + k * 7 + 10, 14 + k * 4, 'ceu', 5);
      } else {
        b.inset(5, 5, pw, h1, ramp, 3, 4, 1); b.bevel(7, 7, pw - 4, h1 - 4, ramp, 4, 5, 2); veios(b, 8, 8, pw - 6, h1 - 6, ramp, 4, w * 3, .6);
        b.inset(5, 10 + h1, pw, h2, ramp, 3, 4, 1); b.bevel(7, 12 + h1, pw - 4, h2 - 4, ramp, 4, 5, 2); veios(b, 8, 13 + h1, pw - 6, h2 - 6, ramp, 4, w * 5, .6);
      }
      const kx = lado === 'e' ? w - 4 : 3, ky = Math.floor(h * .5);
      b.ellipse(kx + .5, ky + .5, 2, 2, 'latao', 2); b.px(kx + 1, ky - 1, 'latao', 6); b.px(kx, ky, 'latao', 4);
    });
  }
  /* Avesso de uma folha de madeira, como aparece aberta: dobradiças do lado do eixo. */
  function versoMadeira(ramp, w, h, dobradicaDireita, {bilhete = false, gravatas = false} = {}) {
    return U.art(`ib:verso:${ramp}:${w}x${h}:${dobradicaDireita}:${bilhete}:${gravatas}`, w, h, b => {
      b.rect(0, 0, w, h, ramp, 2); b.frame(0, 0, w, h, ramp, 1);
      b.rect(2, Math.floor(h * .2), w - 4, 3, ramp, 3); b.rect(2, Math.floor(h * .75), w - 4, 3, ramp, 3);
      const hx = dobradicaDireita ? w - 2 : 0;
      for (const y of [6, h - 12]) { b.rect(hx, y, 2, 6, 'metal', 4); b.px(hx, y + 1, 'metal', 6); }
      if (gravatas && w >= 16) {
        const y0 = Math.floor(h * .2) + 4;
        b.hline(4, w - 5, y0, 'metal', 5);
        ['vermelho', 'azul', 'amarelo', 'verde'].forEach((c, k) => { const x = 7 + k * Math.floor((w - 14) / 4); b.px(x + 1, y0 + 1, c, 4); b.rect(x, y0 + 2, 3, 16 + (k % 2) * 3, c, 3); b.vline(x + 2, y0 + 2, y0 + 17 + (k % 2) * 3, c, 5); b.px(x + 1, y0 + 18 + (k % 2) * 3, c, 2); });
      }
      if (bilhete && w >= 12) { const bx = Math.floor(w / 2) - 5; b.rect(bx, 12, 10, 12, 'papel', 6); for (let y = 14; y < 23; y += 2) b.hline(bx + 1, bx + 7, y, 'tinta', 3); b.rect(bx + 3, 11, 4, 2, 'amarelo', 5); }
    });
  }

  /* ------------------------------------------------------------ arquivo de aço */
  ESTILOS.arquivo = {
    nome: 'Arquivo', fundo: 'sala', max: 5, som: 'gaveta_metal', material: 'metal', parte: 'Gaveta', unica: 'Gaveta', fisico: true,
    geo(n) {
      const N = clamp(n, 1, 5), W = 58, topo = 9, H = 106, y0 = topo + 5, y1 = H - 7, area = y1 - y0, gap = 3;
      const hd = Math.floor((area - gap * (N - 1)) / N), sobra = area - (hd * N + gap * (N - 1)), partes = [];
      for (let i = 0; i < N; i++) partes.push({x: 4, y: y0 + Math.floor(sobra / 2) + i * (hd + gap), w: W - 8, h: hd, D: clamp(Math.round(hd * .3), 4, 9)});
      return {w: W, h: H, base: H, partes, tranca: {x: W + 3, y: y0 + 6, barra: [y0 - 1, y1 + 1]}};
    },
    corpo: G => U.art(`ib:arquivo:corpo:${G.h}`, G.w, G.h, b => {
      const W = G.w, H = G.h, topo = 9;
      b.rect(6, 4, 26, 5, 'papel', 5); b.hline(6, 31, 4, 'papel', 6); for (let y = 5; y < 9; y += 2) b.hline(6, 31, y, 'papel', 3);
      b.rect(5, 2, 24, 2, 'verde', 3); b.hline(5, 28, 2, 'verde', 5); b.rect(9, 0, 22, 2, 'ambar', 4);
      b.rect(38, 2, 8, 7, 'vermelho', 3); b.vline(45, 2, 8, 'vermelho', 5); b.hline(38, 45, 2, 'vermelho', 5); b.frame(46, 4, 3, 4, 'vermelho', 2); b.hline(39, 44, 3, 'madeira', 1);
      b.rect(0, topo, W, 4, 'metal', 4); b.hline(0, W - 1, topo, 'metal', 6); b.hline(0, W - 1, topo + 3, 'metal', 2);
      b.rect(0, topo + 4, W, H - topo - 4, 'metal', 3); b.rect(0, topo + 4, 3, H - topo - 4, 'metal', 2); b.rect(W - 3, topo + 4, 3, H - topo - 4, 'metal', 4); b.vline(W - 1, topo, H - 1, 'metal', 5);
      b.rect(3, topo + 4, W - 6, H - topo - 11, 'metal', 0);
      b.rect(0, H - 7, W, 7, 'metal', 1); b.hline(0, W - 1, H - 7, 'metal', 3); b.rect(4, H - 4, W - 8, 2, 'preto', 2);
      b.ellipse(W - 9, topo + 1.5, 1.8, 1.4, 'metal', 6); b.px(W - 9, topo + 1, 'preto', 1);
      b.speckle(0, topo, W, H - topo, 'metal', 4, .015, K.rng(9));
    }),
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(-2), F.Y(G.h) - 8, (G.w + 4) * 2, 12);
      U.blit(ctx, this.corpo(G), F.X(0), F.Y(0));
      desenharGavetas(F, p => frenteArt('metal', p.w, p.h), (p, i) => dentroGavetaArt('metal', p.w, p.D, i + 1), r => Math.min(r.w - 10, 84),
        (r, p) => [r.x + r.w / 2, r.y + portaEtiqueta(p.h) * 2 + Math.min(7, p.h - 3)]);
    }
  };

  /* ------------------------------------------------------------ bancada de ferramentas */
  ESTILOS.bancada = {
    nome: 'Bancada', fundo: 'sala', max: 6, som: 'gaveta', material: 'madeira', parte: 'Gaveta', unica: 'Gaveta', fisico: true,
    geo(n) {
      const N = clamp(n, 1, 6), cols = N <= 3 ? N : N === 4 ? 2 : 3, rows = Math.ceil(N / cols), W = 108, topo = 36, gy0 = topo + 7, dh = rows === 1 ? 17 : 13, gap = 2;
      const gw = Math.floor((W - 10 - gap * (cols - 1)) / cols), sobra = W - 10 - (gw * cols + gap * (cols - 1)), partes = [];
      for (let i = 0; i < N; i++) { const c = i % cols, r = Math.floor(i / cols); partes.push({x: 5 + Math.floor(sobra / 2) + c * (gw + gap), y: gy0 + r * (dh + gap), w: gw, h: dh, D: clamp(Math.round(dh * .5), 5, 9)}); }
      const gy1 = gy0 + rows * (dh + gap) - gap, H = gy1 + 30;
      return {w: W, h: H, base: H, partes, topo, gy0, gy1, tranca: {x: W + 3, y: gy0 + 5, barra: [gy0 - 1, gy1 + 1]}};
    },
    corpo: G => U.art(`ib:bancada:corpo:${G.h}`, G.w + 4, G.h, b => {
      const W = G.w, H = G.h, o = 2, topo = G.topo;
      // Painel perfurado com as ferramentas.
      b.rect(12, 0, W - 20, 27, 'sepia', 3); b.frame(12, 0, W - 20, 27, 'madeira', 2); b.hline(12, W - 9, 0, 'madeira', 4);
      for (let y = 3; y < 26; y += 4) for (let x = 15; x < W - 9; x += 4) b.px(x, y, 'sepia', 1);
      b.rect(22, 5, 2, 18, 'madeira', 4); b.vline(23, 5, 22, 'madeira', 5); b.rect(17, 3, 12, 4, 'metal', 3); b.hline(17, 28, 3, 'metal', 5); b.rect(17, 3, 2, 4, 'metal', 2);
      b.line(36, 5, 42, 22, 'metal', 4); b.line(37, 5, 43, 22, 'metal', 5); b.ellipse(35.5, 5, 3, 3, 'metal', 4); b.rect(35, 2, 2, 3, 'sepia', 3);
      b.poly([[50, 5], [70, 5], [70, 11], [50, 18]], 'metal', 4); b.hline(50, 70, 5, 'metal', 6); for (let x = 51; x < 69; x += 2) b.px(x, 18 - Math.floor((x - 50) * .6), 'metal', 2);
      b.rect(70, 4, 7, 9, 'madeira', 4); b.rect(72, 6, 3, 5, 'sepia', 3);
      b.rect(83, 4, 3, 7, 'vermelho', 3); b.vline(84, 11, 21, 'metal', 5); b.rect(89, 4, 3, 7, 'amarelo', 4); b.vline(90, 11, 19, 'metal', 5);
      b.ellipse(62, 22, 3, 3, 'amarelo', 4); b.px(62, 22, 'preto', 1);
      // Tampo grosso e o que ficou em cima.
      b.rect(10, topo - 7, 14, 5, 'azul', 3); b.hline(10, 23, topo - 7, 'azul', 4); b.rect(14, topo - 2, 6, 2, 'metal', 2); b.rect(6, topo - 5, 4, 2, 'metal', 5); b.rect(24, topo - 6, 5, 3, 'azul', 2);
      b.rect(84, topo - 9, 8, 9, 'vermelho', 3); b.vline(91, topo - 8, topo - 1, 'vermelho', 5); b.hline(84, 91, topo - 9, 'metal', 5); b.line(86, topo - 9, 84, topo - 14, 'amarelo', 4); b.line(89, topo - 9, 91, topo - 13, 'metal', 5);
      b.ellipse(62, topo - 1, 6, 1.5, 'papel', 4); b.px(58, topo - 2, 'metal', 5); b.px(65, topo - 2, 'metal', 5);
      b.rect(0, topo, W + 4, 6, 'madeira', 4); b.hline(0, W + 3, topo, 'madeira', 6); b.hline(0, W + 3, topo + 1, 'madeira', 5); b.hline(0, W + 3, topo + 5, 'madeira', 2); veios(b, 0, topo + 2, W + 4, 3, 'madeira', 4, 17);
      b.rect(o, topo + 6, W, G.gy1 - topo - 4, 'madeira', 2); b.rect(o + 3, G.gy0 - 1, W - 6, G.gy1 - G.gy0 + 2, 'madeira', 0);
      // Pernas, prateleira de baixo com um caixote e uma lata de tinta.
      const py = G.gy1 + 2;
      b.rect(o, py, 6, H - py, 'madeira', 3); b.vline(o + 5, py, H - 1, 'madeira', 4); b.vline(o, py, H - 1, 'madeira', 2);
      b.rect(o + W - 6, py, 6, H - py, 'madeira', 3); b.vline(o + W - 1, py, H - 1, 'madeira', 5); b.vline(o + W - 6, py, H - 1, 'madeira', 2);
      b.rect(o + 6, H - 9, W - 12, 3, 'madeira', 4); b.hline(o + 6, o + W - 7, H - 9, 'madeira', 5); b.hline(o + 6, o + W - 7, H - 7, 'madeira', 2);
      b.rect(o + 12, H - 21, 24, 12, 'sepia', 4); for (let y = H - 20; y < H - 9; y += 4) b.hline(o + 12, o + 35, y, 'sepia', 2); b.hline(o + 12, o + 35, H - 21, 'sepia', 5); b.vline(o + 35, H - 21, H - 10, 'sepia', 5);
      b.rect(o + W - 30, H - 19, 12, 10, 'azul', 3); b.hline(o + W - 30, o + W - 19, H - 19, 'metal', 5); b.vline(o + W - 19, H - 18, H - 10, 'azul', 4); b.rect(o + W - 28, H - 16, 8, 4, 'papel', 6); b.line(o + W - 29, H - 20, o + W - 24, H - 23, 'metal', 4);
    }),
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(-2), F.Y(G.h) - 8, (G.w + 4) * 2, 12);
      U.blit(ctx, this.corpo(G), F.X(-2), F.Y(0));
      desenharGavetas(F, p => frenteArt('compensado', p.w, p.h), (p, i) => dentroGavetaArt('madeira', p.w, p.D, i + 5), r => r.w - 6, r => [r.x + r.w / 2, r.y + Math.round(r.h * .62)]);
    }
  };

  /* ------------------------------------------------------------ armário de madeira (duas portas) */
  ESTILOS.armario = {
    nome: 'Armário', fundo: 'sala', max: 5, som: 'armario', material: 'madeira', parte: 'Prateleira', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique nas portas para abrir', dica: 'clique numa prateleira',
    geo(n) {
      const N = clamp(n, 1, 5), W = 80, H = 106;
      const partes = empilhar(5, W - 10, 9, H - 10, Array(N).fill(1)).map(z => ({...z, enchimento: 'louca', miudoX: 20}));
      return {w: W, h: H, base: H, partes, portas: [{hx: 4, dir: 1, w: 36, y: 8, h: 89}, {hx: 76, dir: -1, w: 36, y: 8, h: 89}], tranca: {x: 40, y: 52}};
    },
    corpo(G) {
      return U.art(`ib:armario:corpo:${G.partes.map(p => p.y).join(',')}`, G.w + 4, G.h, b => {
        const W = G.w, H = G.h, o = 2;
        b.rect(0, 0, W + 4, 5, 'madeira', 4); b.hline(0, W + 3, 0, 'madeira', 6); b.hline(0, W + 3, 4, 'madeira', 2); b.vline(W + 3, 0, 4, 'madeira', 5);
        b.rect(o + 1, 5, W - 2, 2, 'madeira', 3); b.hline(o + 1, o + W - 2, 6, 'madeira', 1);
        b.rect(o, 7, W, H - 15, 'madeira', 3); b.rect(o, 7, 3, H - 15, 'madeira', 2); b.rect(o + W - 3, 7, 3, H - 15, 'madeira', 4);
        b.rect(o + 4, 8, W - 8, H - 17, 'madeira', 1);
        for (let x = o + 12; x < o + W - 5; x += 12) b.vline(x, 8, H - 10, 'madeira', 0);
        for (const p of G.partes) {
          b.shade(o + 4, p.y, W - 8, 3, -1, .6);
          if (p.y > 9) { b.rect(o + 4, p.y - 2, W - 8, 2, 'madeira', 4); b.hline(o + 4, o + W - 5, p.y - 2, 'madeira', 5); }
        }
        b.rect(o, H - 8, W, 8, 'madeira', 2); b.hline(o, o + W - 1, H - 8, 'madeira', 4); b.rect(o + 8, H - 5, W - 16, 3, 'madeira', 1);
        b.bevel(o, H - 8, 8, 8, 'madeira', 3, 4, 1); b.bevel(o + W - 8, H - 8, 8, 8, 'madeira', 3, 5, 1);
      });
    },
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(-3), F.Y(G.h) - 8, (G.w + 6) * 2, 12);
      comPortas(F, {corpo: this.corpo(G), corpoX: -2, borda: C('madeira', 5),
        frente: p => portaMadeira('madeira', p.w, p.h, p.dir > 0 ? 'e' : 'd'),
        verso: p => versoMadeira('madeira', p.w, p.h, p.dir > 0, {bilhete: p.dir > 0}),
        zona: (p, i) => U.blit(ctx, enchimentoArt('louca', p.w, p.h, F.seed + i), F.X(p.x), F.Y(p.y))});
    }
  };

  /* ------------------------------------------------------------ armário de metal (vestiário) */
  ESTILOS.armario_metal = {
    nome: 'Armário de metal', fundo: 'sala', max: 4, som: 'armario', material: 'azul', parte: 'Parte', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique na porta para abrir', dica: 'clique numa parte do armário',
    geo(n) {
      const N = clamp(n, 1, 4), W = 46, H = 108;
      const pesos = N === 1 ? [1] : [.9, ...Array(N - 1).fill(N === 2 ? 3 : 1.6)];
      const partes = empilhar(4, W - 8, 6, H - 8, pesos).map((z, i) => ({...z, tipo: z.h >= 34 ? 'jaqueta' : 'vestiario', miudoX: 4}));
      return {w: W, h: H, base: H, partes, portas: [{hx: 3, dir: 1, w: 40, y: 3, h: 99}], tranca: {x: 38, y: 54}};
    },
    corpo(G) {
      return U.art(`ib:armetal:corpo:${G.partes.map(p => p.y).join(',')}`, G.w, G.h, b => {
        const W = G.w, H = G.h;
        b.rect(0, 0, W, H - 5, 'azul', 3); b.hline(0, W - 1, 0, 'azul', 5); b.vline(W - 1, 0, H - 6, 'azul', 4); b.vline(0, 0, H - 6, 'azul', 2);
        b.rect(3, 4, W - 6, H - 11, 'azul', 1); for (let y = 8; y < H - 10; y += 3) b.hline(5, W - 6, y, 'azul', 0);
        for (const p of G.partes) { b.shade(3, p.y, W - 6, 3, -1, .6); if (p.y > 6) { b.rect(3, p.y - 2, W - 6, 2, 'azul', 4); b.hline(3, W - 4, p.y - 2, 'azul', 5); } }
        b.rect(0, H - 5, W, 5, 'azul', 1); b.rect(2, H - 5, 5, 5, 'metal', 2); b.rect(W - 7, H - 5, 5, 5, 'metal', 3);
      });
    },
    frente: (w, h) => U.art(`ib:armetal:porta:${w}x${h}`, w, h, b => {
      b.bevel(0, 0, w, h, 'azul', 3, 5, 1);
      for (let k = 0; k < 6; k++) { const y = 7 + k * 3; b.rect(9, y, w - 18, 2, 'preto', 1); b.hline(9, w - 10, y - 1, 'azul', 5); }
      b.rect(14, 29, 12, 7, 'latao', 4); b.frame(14, 29, 12, 7, 'latao', 2); b.text(20, 30, '07', 'preto', 1, {font: '3x5', align: 'center'});
      b.rect(w - 9, 44, 5, 16, 'preto', 1); b.rect(w - 8, 46, 3, 10, 'metal', 5); b.px(w - 7, 57, 'metal', 2);
      b.ellipse(12, 76, 5, 5, 'amarelo', 5); b.px(10, 75, 'preto', 1); b.px(14, 75, 'preto', 1); b.hline(10, 14, 78, 'preto', 1);
      b.rect(24, 70, 10, 5, 'vermelho', 4); b.hline(24, 33, 72, 'papel', 6);
      for (let k = 0; k < 7; k++) { const x = 4 + Math.floor(K.hash2(k, 1, 7) * (w - 10)), y = 38 + Math.floor(K.hash2(k, 2, 7) * 50); b.line(x, y, x + 4, y + 1, 'azul', 5); }
      b.speckle(1, h - 12, w - 2, 11, 'ambar', 2, .12, K.rng(4)); b.speckle(1, h - 6, w - 2, 5, 'ambar', 3, .1, K.rng(5));
    }),
    verso: (w, h) => U.art(`ib:armetal:verso:${w}x${h}`, w, h, b => {
      b.rect(0, 0, w, h, 'azul', 2); b.frame(0, 0, w, h, 'azul', 1); b.frame(3, 3, w - 6, h - 6, 'azul', 3);
      b.rect(8, 8, w - 16, 18, 'metal', 2); b.rect(9, 9, w - 18, 16, 'ceu', 4); b.line(11, 22, 18, 11, 'ceu', 6); b.line(14, 23, 21, 12, 'ceu', 5);
      b.rect(10, 34, 14, 11, 'papel', 6); b.rect(11, 35, 12, 8, 'sepia', 3); b.ellipse(15, 38, 2, 2, 'sepia', 5); b.ellipse(20, 39, 2, 2, 'sepia', 5); b.rect(15, 33, 5, 2, 'amarelo', 5);
      for (const y of [8, h - 14]) { b.rect(w - 2, y, 2, 7, 'metal', 4); b.px(w - 2, y + 1, 'metal', 6); }
    }),
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(-2), F.Y(G.h) - 8, (G.w + 4) * 2, 12);
      comPortas(F, {corpo: this.corpo(G), borda: C('azul', 4),
        frente: p => this.frente(p.w, p.h), verso: p => this.verso(p.w, p.h),
        zona: (p, i) => U.blit(ctx, enchimentoArt(p.tipo, p.w, p.h, F.seed + i), F.X(p.x), F.Y(p.y))});
    }
  };

  /* Tipo de uma zona pelo nome que o mestre deu ("Congelador", "Embaixo do sofá"…). */
  function tipoPorNome(nome, regras) { const s = normal(nome); for (const [t, re] of Object.entries(regras)) if (re.test(s)) return t; return null; }

  /* ------------------------------------------------------------ guarda-roupa */
  const TIPOS_GUARDA = {topo: /maleiro|em cima|topo|alto|mala/, cabide: /cabide|pendura|casaco|terno|vestido|camisa|jaqueta|roupa|bolso|cabideiro/, gaveta: /gaveta/, prateleira: /prateleira|dobrad|pilha/};
  ESTILOS.guarda_roupa = {
    nome: 'Guarda-roupa', fundo: 'sala', max: 5, som: 'armario', material: 'mogno', parte: 'Parte', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique nas portas para abrir', dica: 'clique numa parte do guarda-roupa',
    geo(n, comps) {
      const N = clamp(n, 1, 5), W = 96, H = 108;
      const padrao = [['cabide'], ['topo', 'cabide'], ['topo', 'cabide', 'gaveta'], ['topo', 'cabide', 'prateleira', 'gaveta'], ['topo', 'cabide', 'prateleira', 'gaveta', 'gaveta']][N - 1];
      const tipos = comps.slice(0, N).map((c, i) => tipoPorNome(c.nome, TIPOS_GUARDA) || padrao[i]);
      const pesos = tipos.map(t => t === 'cabide' ? 3.4 : t === 'gaveta' ? .75 : t === 'topo' ? 1 : 1);
      const partes = empilhar(5, W - 10, 10, H - 9, pesos).map((z, i) => ({...z, tipo: tipos[i], miudoX: 8, rotuloY: tipos[i] === 'cabide' ? 22 : tipos[i] === 'gaveta' ? z.h : 9}));
      return {w: W, h: H, base: H, partes, portas: [{hx: 4, dir: 1, w: 44, y: 9, h: 91, abre: 100}, {hx: 92, dir: -1, w: 44, y: 9, h: 91, abre: 100}], tranca: {x: 48, y: 56}};
    },
    corpo(G) {
      return U.art(`ib:guarda:corpo:${G.partes.map(p => p.y).join(',')}`, G.w + 4, G.h, b => {
        const W = G.w, H = G.h, o = 2;
        b.rect(0, 0, W + 4, 6, 'mogno', 4); b.hline(0, W + 3, 0, 'mogno', 6); b.hline(0, W + 3, 5, 'mogno', 2); b.vline(W + 3, 0, 5, 'mogno', 5);
        for (let x = 6; x < W; x += 8) { b.px(x, 2, 'mogno', 2); b.px(x + 1, 3, 'mogno', 5); }
        b.rect(o + 1, 6, W - 2, 2, 'mogno', 3); b.hline(o + 1, o + W - 2, 7, 'mogno', 1);
        b.rect(o, 8, W, H - 15, 'mogno', 3); b.rect(o, 8, 3, H - 15, 'mogno', 2); b.rect(o + W - 3, 8, 3, H - 15, 'mogno', 4);
        b.rect(o + 4, 9, W - 8, H - 17, 'mogno', 1); b.vline(o + Math.floor(W / 2), 9, H - 9, 'mogno', 0);
        for (const p of G.partes) {
          b.shade(o + 4, p.y, W - 8, 3, -1, .6);
          if (p.y > 10) { b.rect(o + 4, p.y - 2, W - 8, 2, 'mogno', 4); b.hline(o + 4, o + W - 5, p.y - 2, 'mogno', 5); }
        }
        b.rect(o, H - 7, W, 7, 'mogno', 2); b.hline(o, o + W - 1, H - 7, 'mogno', 4); b.rect(o + 8, H - 4, W - 16, 2, 'mogno', 1);
        b.bevel(o, H - 7, 8, 7, 'mogno', 3, 4, 1); b.bevel(o + W - 8, H - 7, 8, 7, 'mogno', 3, 5, 1);
      });
    },
    zonaArt(tipo, w, h, seed) {
      if (tipo === 'cabide') return enchimentoArt('roupas', w, h, seed);
      if (tipo === 'prateleira') return enchimentoArt('dobradas', w, h, seed);
      if (tipo === 'gaveta') return enchimentoArt('gavetinha', w, h, seed);
      return U.art(`ib:guarda:mala:${w}x${h}`, w, h, b => {
        const chao = h - 1, mh = Math.min(h - 2, 12);
        b.rect(4, chao - mh + 1, 34, mh, 'sepia', 3); b.hline(4, 37, chao - mh + 1, 'sepia', 5); b.vline(37, chao - mh + 2, chao, 'sepia', 4); b.vline(4, chao - mh + 2, chao, 'sepia', 2);
        b.vline(12, chao - mh + 1, chao, 'madeira', 2); b.vline(30, chao - mh + 1, chao, 'madeira', 2); b.rect(18, chao - mh - 1, 8, 2, 'madeira', 3); b.px(21, chao - mh + 3, 'latao', 5);
        if (h >= 10) { b.ellipse(w - 14, chao - 4, 9, 4.5, 'rosa', 3); b.hline(w - 22, w - 6, chao - 6, 'rosa', 5); b.hline(w - 20, w - 8, chao - 3, 'papel', 6); }
      });
    },
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(-3), F.Y(G.h) - 8, (G.w + 6) * 2, 12);
      comPortas(F, {corpo: this.corpo(G), corpoX: -2, borda: C('mogno', 5),
        frente: p => portaMadeira('mogno', p.w, p.h, p.dir > 0 ? 'e' : 'd', {espelho: p.dir < 0}),
        verso: p => versoMadeira('mogno', p.w, p.h, p.dir > 0, {gravatas: p.dir > 0}),
        zona: (p, i) => {
          const foco = F.st.foco === i && p.tipo === 'gaveta' ? 3 : 0;
          if (foco) { U.rect(ctx, F.X(p.x + 1), F.Y(p.y), (p.w - 2) * 2, foco * 2, C('mogno', 0)); }
          U.blit(ctx, this.zonaArt(p.tipo, p.w, p.h, F.seed + i), F.X(p.x), F.Y(p.y + foco));
        }});
    }
  };

  /* ------------------------------------------------------------ geladeira */
  const TIPOS_GELADEIRA = {congelador: /congel|freezer|gelo|sorvete/, porta: /porta/, gaveta: /gaveta|legume|verdura|fruta|salada/, prateleira: /prateleira/};
  ESTILOS.geladeira = {
    nome: 'Geladeira', fundo: 'sala', max: 5, som: 'geladeira', material: 'geladeira', parte: 'Prateleira', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique na porta para abrir', dica: 'clique numa prateleira',
    geo(n, comps) {
      const N = clamp(n, 1, 5), W = 56, H = 110;
      const padrao = [['prateleira'], ['congelador', 'prateleira'], ['congelador', 'prateleira', 'gaveta'], ['congelador', 'prateleira', 'prateleira', 'gaveta'], ['congelador', 'prateleira', 'prateleira', 'gaveta', 'porta']][N - 1];
      const tipos = comps.slice(0, N).map((c, i) => tipoPorNome(c.nome, TIPOS_GELADEIRA) || padrao[i]);
      const dentro = tipos.map((t, i) => ({t, i})).filter(o => o.t !== 'porta');
      const ordem = [...dentro.filter(o => o.t === 'congelador'), ...dentro.filter(o => o.t === 'prateleira'), ...dentro.filter(o => o.t === 'gaveta')];
      const zonas = ordem.length ? empilhar(5, W - 10, 6, H - 13, ordem.map(o => o.t === 'congelador' ? 1.15 : o.t === 'gaveta' ? .85 : 1), 2) : [];
      const partes = Array(N);
      ordem.forEach((o, k) => { partes[o.i] = {...zonas[k], tipo: o.t, material: o.t === 'congelador' ? 'congelador' : 'geladeira', miudoX: 6}; });
      const naPorta = tipos.map((t, i) => t === 'porta' ? i : -1).filter(i => i >= 0);
      naPorta.forEach((i, k) => { partes[i] = {tipo: 'porta', x: 56, y: 12 + k * Math.floor(84 / naPorta.length), w: 18, h: Math.floor(84 / naPorta.length), material: 'geladeira', naPorta: true}; });
      return {w: W, h: H, base: H, partes, portas: [{hx: 54, dir: -1, w: 52, y: 1, h: 101, abre: 105}], tranca: {x: 9, y: 52}};
    },
    corpo(G) {
      return U.art(`ib:geladeira:corpo:${G.partes.map(p => p.y + p.tipo).join(',')}`, G.w, G.h, b => {
        const W = G.w, H = G.h;
        b.rect(0, 0, W, H - 6, 'palido', 5); b.vline(0, 1, H - 7, 'palido', 3); b.vline(1, 1, H - 7, 'palido', 4); b.vline(W - 1, 1, H - 7, 'palido', 6);
        for (const [x, y] of [[0, 0], [W - 1, 0], [0, 1], [W - 1, 1], [1, 0], [W - 2, 0]]) b.erase(x, y, 1, 1);
        b.rect(3, 3, W - 6, H - 13, 'palido', 6);
        b.shadeFn(3, 3, W - 6, H - 13, (x, y) => faixas(.6 - (y - 3) / (H - 13) * 1.4));
        b.rect(3, 3, 2, H - 13, 'palido', 4); b.rect(W - 5, 3, 2, H - 13, 'palido', 5);
        b.rect(Math.floor(W / 2) - 4, 3, 8, 2, 'amarelo', 6, K.EMISSIVE);
        for (const p of G.partes) {
          if (!p || p.naPorta) continue;
          if (p.tipo === 'congelador') { b.rect(p.x, p.y, p.w, p.h, 'ceu', 4); b.frame(p.x, p.y, p.w, p.h, 'ceu', 5); b.hline(p.x, p.x + p.w - 1, p.y + p.h - 1, 'palido', 3); b.speckle(p.x + 1, p.y + 1, p.w - 2, 3, 'palido', 6, .5, K.rng(3)); }
          if (p.y > 6) { b.hline(5, W - 6, p.y - 2, 'ceu', 6); b.hline(5, W - 6, p.y - 1, 'ceu', 4); }
        }
        b.rect(0, H - 6, W, 6, 'palido', 3); for (let x = 6; x < W - 6; x += 3) b.vline(x, H - 5, H - 3, 'preto', 2);
        b.rect(3, H - 2, 6, 2, 'preto', 2); b.rect(W - 9, H - 2, 6, 2, 'preto', 2);
      });
    },
    zonaArt(tipo, w, h, seed) {
      return U.art(`ib:geladeira:zona:${tipo}:${w}x${h}:${seed % 6}`, w, h, b => {
        const chao = h - 1;
        if (tipo === 'congelador') {
          b.rect(2, chao - 6, 12, 6, 'ceu', 5); for (let x = 3; x < 13; x += 3) b.rect(x, chao - 5, 2, 4, 'palido', 6);
          b.rect(w - 14, chao - 8, 10, 8, 'vermelho', 4); b.hline(w - 14, w - 5, chao - 8, 'papel', 6); b.text(w - 13, chao - 6, 'SOR', 'papel', 6, {font: '3x5'});
          return;
        }
        if (tipo === 'gaveta') {
          b.rect(1, 1, w - 2, h - 2, 'ceu', 5); b.hline(1, w - 2, 1, 'palido', 6);
          for (let k = 0; k < 4; k++) b.ellipse(8 + k * 9, chao - 4, 3.5, 3, k % 2 ? 'vermelho' : 'folha', 4);
          b.ellipse(w - 9, chao - 5, 6, 4, 'folha', 3); b.px(w - 10, chao - 7, 'folha', 5);
          b.hline(1, w - 2, Math.floor(h * .55), 'palido', 6); b.rect(Math.floor(w / 2) - 5, Math.floor(h * .55) + 1, 10, 2, 'palido', 4);
          return;
        }
        const grupos = [
          x => { b.rect(x, chao - 12, 7, 12, 'papel', 6); b.poly([[x, chao - 12], [x + 3.5, chao - 15], [x + 7, chao - 12]], 'papel', 5); b.rect(x, chao - 8, 7, 4, 'azul', 4); b.vline(x + 6, chao - 11, chao, 'papel', 7); },
          x => { b.poly([[x, chao], [x + 12, chao], [x + 12, chao - 5]], 'amarelo', 5); b.px(x + 7, chao - 2, 'amarelo', 3); b.px(x + 10, chao - 1, 'amarelo', 3); },
          x => { b.ellipse(x + 6, chao - 3, 6, 3.5, 'vermelho', 3); b.rect(x, chao - 6, 13, 2, 'vermelho', 5); },
          x => { for (let k = 0; k < 3; k++) b.ellipse(x + 2 + k * 4, chao - 2, 1.8, 2.2, 'papel', 6); b.rect(x, chao - 1, 13, 2, 'sepia', 4); },
          x => { b.rect(x + 1, chao - 9, 10, 9, 'metal', 4); b.hline(x, x + 11, chao - 9, 'metal', 6); b.rect(x + 4, chao - 11, 4, 2, 'metal', 5); b.vline(x + 10, chao - 8, chao, 'metal', 5); }
        ];
        if (h < 9) { grupos[1](2); return; }
        grupos[seed % grupos.length](2); grupos[(seed + 2) % grupos.length](w - 15);
      });
    },
    versoArt: (w, h) => U.art(`ib:geladeira:verso:${w}x${h}`, w, h, b => {
      b.rect(0, 0, w, h, 'palido', 6); b.frame(0, 0, w, h, 'palido', 3); b.frame(1, 1, w - 2, h - 2, 'preto', 3);
      for (const y of [22, 52, 82]) {
        b.rect(3, y, w - 6, 7, 'palido', 4); b.hline(3, w - 4, y, 'palido', 7); b.hline(3, w - 4, y + 6, 'palido', 2);
        const cores = y === 22 ? null : y === 52 ? ['vermelho', 'papel', 'ambar'] : ['verde', 'agua', 'papel'];
        if (!cores) { for (let x = 5; x < w - 6; x += 5) b.ellipse(x + 2, y - 2, 2, 2.4, 'papel', 7); continue; }
        cores.forEach((c, k) => { const x = 5 + k * Math.floor((w - 10) / 3); b.rect(x, y - 13, 5, 13, c, 4); b.rect(x + 1, y - 16, 3, 3, c, 3); b.vline(x + 4, y - 12, y - 1, c, 6); });
      }
      for (const y of [8, h - 16]) { b.rect(0, y, 2, 8, 'metal', 5); }
    }),
    frenteArt: (w, h) => U.art(`ib:geladeira:porta:${w}x${h}`, w, h, b => {
      b.rect(0, 0, w, h, 'palido', 5); b.hline(0, w - 1, 0, 'palido', 6); b.vline(w - 1, 0, h - 1, 'palido', 4); b.hline(0, w - 1, h - 1, 'palido', 3); b.vline(0, 0, h - 1, 'palido', 6);
      b.text(Math.floor(w / 2) + 3, 4, 'Gelamar', 'metal', 3, {align: 'center'}); b.hline(12, w - 10, 13, 'palido', 4);
      b.rect(3, 30, 3, 42, 'metal', 4); b.vline(5, 30, 71, 'metal', 6); b.vline(3, 31, 71, 'metal', 2); b.rect(2, 29, 5, 2, 'metal', 5); b.rect(2, 71, 5, 2, 'metal', 3);
      b.rect(26, 26, 13, 13, 'amarelo', 5); b.hline(26, 38, 26, 'amarelo', 4); for (let y = 30; y < 38; y += 2) b.hline(28, 35 - (y % 4), y, 'tinta', 3); b.ellipse(32.5, 26.5, 1.8, 1.8, 'vermelho', 4);
      b.rect(15, 48, 26, 22, 'papel', 7); b.poly([[18, 60], [28, 52], [38, 60]], 'vermelho', 4); b.rect(20, 60, 16, 8, 'amarelo', 5); b.rect(26, 63, 4, 5, 'azul', 3); b.ellipse(38, 51, 2, 2, 'amarelo', 6); b.line(16, 69, 40, 69, 'folha', 4);
      b.ellipse(28, 48, 1.8, 1.8, 'azul', 4); b.ellipse(44, 20, 2, 2, 'verde', 4); b.ellipse(14, 84, 2.2, 2.2, 'vermelho', 4); b.rect(40, 80, 7, 9, 'papel', 6); b.hline(41, 45, 83, 'tinta', 3); b.hline(41, 44, 85, 'tinta', 3);
    }),
    desenhar(F) {
      const {ctx, G, st} = F;
      sombraChao(ctx, F.X(-2), F.Y(G.h) - 8, (G.w + 4) * 2, 12);
      if (st.capa > 0) {
        // A luz de dentro no chão.
        ctx.save(); ctx.globalAlpha = .16 * F.capa; ctx.fillStyle = '#dff6ff';
        for (let j = 0; j < 14; j += 2) ctx.fillRect(F.X(2 - j), F.Y(G.h) + j - 2, (G.w - 4 + j * 2) * 2, 2);
        ctx.restore();
      }
      const rects = comPortas(F, {corpo: this.corpo(G), borda: C('palido', 4),
        frente: p => this.frenteArt(p.w, p.h), verso: p => this.versoArt(p.w, p.h),
        zona: (p, i) => { if (!p.naPorta) U.blit(ctx, this.zonaArt(p.tipo, p.w, p.h, F.seed + i), F.X(p.x), F.Y(p.y)); }});
      // Compartimentos na porta aberta: as prateleirinhas do avesso.
      const aberto = F.mem.tampa && st.capa >= 1, r = rects[0];
      if (aberto && r) G.partes.forEach((p, i) => {
        if (!p.naPorta) return;
        const x = r.x, y = F.Y(p.y), w = r.w, h = p.h * 2;
        miudos(F, i, x, y, w, h);
        F.parte(i, x, y, w, h);
        F.rotulo(i, x + w / 2, y + 10, 90);
      });
    }
  };

  /* Aba de papelão (eixo na profundidade) numa vista de cima inclinada: gira para
     o lado e sobe; cada coluna levanta conforme a distância até o eixo. */
  function abaLateral(ctx, F, {frente, verso, hx, y, h, L, ang, dir, abre = 115, sobe = .55}) {
    const th = ang * abre * GRAU, c = Math.cos(th), s = Math.sin(th);
    const pw = Math.round(Math.abs(c) * L), face = c >= 0 ? frente : verso, lado = c >= 0 ? dir : -dir;
    ctx.imageSmoothingEnabled = false;
    for (let k = 0; k < pw; k++) {
      const q = Math.min(L - 1, Math.floor(k / pw * L)), src = lado > 0 ? q : L - 1 - q;
      const off = Math.round((k + .5) / pw * L * s * sobe), col = lado > 0 ? hx + k : hx - 1 - k;
      ctx.drawImage(face, src, 0, 1, h, F.X(col), F.Y(y - off), 2, h * 2);
    }
    if (pw < 2 && s > .6) { const off = Math.round(L * s * sobe); U.rect(ctx, F.X(lado > 0 ? hx : hx - 1), F.Y(y - off), 2, (h + off) * 2, C('sepia', 5)); }
  }
  /* Zonas em grade dentro de uma abertura. */
  function grade(ab, n, pad = 2) {
    const cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), out = [];
    const cw = Math.floor((ab.w - pad * (cols + 1)) / cols), ch = Math.floor((ab.h - pad * (rows + 1)) / rows);
    for (let i = 0; i < n; i++) out.push({x: ab.x + pad + (i % cols) * (cw + pad), y: ab.y + pad + Math.floor(i / cols) * (ch + pad), w: cw, h: ch});
    return out;
  }
  /* Zonas de vista de cima: o conteúdo (itens) fica no chão da zona; rótulo em cima. */
  function zonasDeCima(F, aberto, {rotuloY = 8, deslocY = 0} = {}) {
    if (!aberto) return;
    F.G.partes.forEach((p, i) => {
      const x = F.X(p.x), y = F.Y(p.y + deslocY), w = p.w * 2, h = p.h * 2;
      miudos(F, i, x + 2, y + 14, w - 4, h - 14);
      F.parte(i, x, y, w, h);
      F.rotulo(i, x + w / 2, y + rotuloY, Math.max(50, w + 6));
    });
  }

  /* ------------------------------------------------------------ caixa de papelão */
  ESTILOS.caixa = {
    nome: 'Caixa', fundo: 'chao', chaoY: 236, max: 6, som: 'papel', material: 'papelao', parte: 'Canto', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique na caixa para abrir', dica: 'clique numa parte da caixa',
    geo(n) {
      const N = clamp(n, 1, 6), W = 84, topo = 4, fundoAb = 50, H = fundoAb + 28;
      const ab = {x: 4, y: topo, w: W - 8, h: fundoAb - topo};
      return {w: W, h: H, base: H, ab, fundoAb, partes: grade(ab, N, 2), tranca: {x: W / 2, y: fundoAb + 12}, ext: [19, 19]};
    },
    corpo(G) {
      return U.art(`ib:caixa:corpo:${G.partes.length}`, G.w, G.h, b => {
        const W = G.w, H = G.h, ab = G.ab, f = G.fundoAb, R = K.rng(8);
        // Por dentro: papelão escuro, jornal amassado, flocos de isopor.
        b.rect(ab.x, ab.y, ab.w, ab.h, 'sepia', 2);
        b.rect(ab.x, ab.y, ab.w, 5, 'sepia', 3); b.hline(ab.x, ab.x + ab.w - 1, ab.y + 5, 'sepia', 1);
        b.rect(ab.x, ab.y, 3, ab.h, 'sepia', 3); b.rect(ab.x + ab.w - 3, ab.y, 3, ab.h, 'sepia', 1);
        for (let k = 0; k < 7; k++) { const x = ab.x + 4 + R() * (ab.w - 18), y = ab.y + 8 + R() * (ab.h - 16); b.ellipse(x + 5, y + 3, 6, 3.5, 'papel', 4 + (k % 2)); for (let l = 0; l < 3; l++) b.hline(x + 1, x + 6 + l, y + 1 + l * 2, 'grafite', 3); }
        b.speckle(ab.x + 3, ab.y + 6, ab.w - 6, ab.h - 8, 'papel', 6, .025, R);
        // Borda de cima e a frente.
        b.frame(ab.x - 4, ab.y - 4, ab.w + 8, ab.h + 8, 'sepia', 4); b.frame(ab.x - 3, ab.y - 3, ab.w + 6, ab.h + 6, 'sepia', 5); b.frame(ab.x - 2, ab.y - 2, ab.w + 4, ab.h + 4, 'sepia', 4); b.frame(ab.x - 1, ab.y - 1, ab.w + 2, ab.h + 2, 'sepia', 3);
        b.rect(0, f + 4, W, H - f - 4, 'sepia', 4);
        for (let x = 1; x < W; x += 3) b.vline(x, f + 5, H - 2, 'sepia', 5);
        b.hline(0, W - 1, f + 4, 'sepia', 6); b.vline(W - 1, f + 4, H - 1, 'sepia', 5); b.vline(0, f + 4, H - 1, 'sepia', 3); b.hline(0, W - 1, H - 1, 'sepia', 2);
        b.text(16, f + 10, 'FRAGIL', 'vermelho', 3, {font: '3x5'});
        b.poly([[48, f + 18], [53, f + 10], [58, f + 18]], 'vermelho', 3); b.rect(52, f + 18, 2, 4, 'vermelho', 3);
        for (const x of [66, 72]) { b.vline(x, f + 11, f + 20, 'vermelho', 3); b.px(x - 1, f + 12, 'vermelho', 3); b.px(x + 1, f + 12, 'vermelho', 3); }
        b.text(12, f + 17, 'CX 12', 'grafite', 2, {font: '3x5'}); b.rect(10, f + 23, 30, 1, 'grafite', 2);
      });
    },
    aba(tipo, w, h) {
      return U.art(`ib:caixa:aba:${tipo}:${w}x${h}`, w, h, b => {
        const verso = tipo.endsWith('v');
        b.rect(0, 0, w, h, 'sepia', verso ? 5 : 4);
        if (!verso) { for (let x = 1; x < w; x += 3) b.vline(x, 0, h - 1, 'sepia', 5); b.speckle(0, 0, w, h, 'sepia', 3, .03, K.rng(w + h)); }
        else b.speckle(0, 0, w, h, 'sepia', 6, .05, K.rng(w * h));
        b.frame(0, 0, w, h, 'sepia', verso ? 3 : 2);
      });
    },
    desenhar(F) {
      const {ctx, G, st} = F, ab = G.ab, u = F.capa, aberto = F.mem.tampa && st.capa >= 1;
      sombraChao(ctx, F.X(-4), F.Y(G.h) - 8, (G.w + 8) * 2, 14);
      U.blit(ctx, this.corpo(G), F.X(0), F.Y(0));
      zonasDeCima(F, aberto);
      const meia = Math.ceil(ab.h / 2), lado = Math.floor(ab.w / 2);
      const uT = clamp(u / .6, 0, 1), uL = clamp((u - .3) / .7, 0, 1);
      const abaT = this.aba('t', ab.w, meia), abaTv = this.aba('tv', ab.w, meia);
      // Aba de trás (abre para trás), laterais, aba da frente (dobra sobre a frente).
      if (uT > 0) tampaHorizontal(ctx, F, {frente: abaT, verso: abaTv, x: ab.x, hy: ab.y, w: ab.w, L: meia, ang: ease(uT), abre: 100, tras: true});
      abaLateral(ctx, F, {frente: this.aba('l', lado, ab.h), verso: this.aba('lv', lado, ab.h), hx: ab.x, y: ab.y, h: ab.h, L: lado, ang: ease(uL), dir: 1});
      abaLateral(ctx, F, {frente: this.aba('l', lado, ab.h), verso: this.aba('lv', lado, ab.h), hx: ab.x + ab.w, y: ab.y, h: ab.h, L: lado, ang: ease(uL), dir: -1});
      if (uT <= 0) U.blit(ctx, abaT, F.X(ab.x), F.Y(ab.y));
      tampaHorizontal(ctx, F, {frente: abaT, verso: abaTv, x: ab.x, hy: ab.y + ab.h, w: ab.w, L: meia, ang: ease(uT), abre: 165, tras: false});
      if (u <= 0) {
        // Fita adesiva no meio, descendo pela frente.
        ctx.save(); ctx.globalAlpha = .75;
        U.rect(ctx, F.X(G.w / 2 - 5), F.Y(ab.y - 4), 20, (G.fundoAb - ab.y + 12) * 2, '#d9c48c');
        ctx.globalAlpha = .45; U.rect(ctx, F.X(G.w / 2 - 5), F.Y(ab.y - 4), 4, (G.fundoAb - ab.y + 12) * 2, '#fff4d0');
        ctx.restore();
      }
      if (!aberto) F.capaRegiao(F.X(0), F.Y(0), G.w * 2, G.h * 2);
      else F.capaRegiao(F.X(0), F.Y(G.fundoAb + 4), G.w * 2, (G.h - G.fundoAb - 4) * 2);
    }
  };

  /* ------------------------------------------------------------ lixeira */
  ESTILOS.lixeira = {
    nome: 'Lixeira', fundo: 'chao', chaoY: 238, max: 3, som: 'tampa', material: 'lixo', parte: 'Canto', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique na tampa para abrir', dica: 'clique numa parte da lixeira',
    geo(n) {
      const N = clamp(n, 1, 3), W = 76, H = 100, aro = {cx: 38, cy: 26, rx: 34, ry: 13};
      const x0 = 10, x1 = 66, w = Math.floor((x1 - x0 - 2 * (N - 1)) / N), partes = [];
      for (let i = 0; i < N; i++) partes.push({x: x0 + i * (w + 2), y: aro.cy - 11, w, h: 22});
      return {w: W, h: H, base: H, aro, partes, tranca: {x: 38, y: 46}};
    },
    corpo(G) {
      return U.art('ib:lixeira:corpo', G.w, G.h, b => {
        const {cx, cy, rx, ry} = G.aro, H = G.h;
        for (let y = cy; y < H - 3; y++) {
          const t = (y - cy) / (H - 3 - cy), half = rx - t * 5;
          for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
            const nx = (x - cx) / half, costela = Math.round((x - cx + 60) / 7) % 2 === 0 && Math.abs(((x - cx + 60) / 7) % 1 - .5) > .35;
            let lv = nx > .35 && nx < .75 ? 5 : nx > -.2 ? 4 : nx > -.7 ? 3 : 2;
            if (costela) lv += nx > 0 ? 1 : -1;
            b.px(x, y, 'metal', clamp(lv, 1, 6));
          }
        }
        for (let x = 0; x < G.w; x++) { const dx = (x - cx) / (rx - 5); if (Math.abs(dx) <= 1) { const yb = Math.round(H - 4 + Math.sqrt(1 - dx * dx) * 3); b.vline(x, yb - 3, yb, 'metal', 2); } }
        b.rect(24, 56, 28, 12, 'papel', 5); b.frame(24, 56, 28, 12, 'papel', 3); b.text(38, 59, 'LIXO', 'verde', 3, {font: '3x5', align: 'center'});
        b.shade(8, 72, 10, 8, -1); b.px(12, 74, 'metal', 6);
        // Aro e o saco de lixo preto por dentro, com a bagunça.
        b.ellipse(cx, cy, rx, ry, 'metal', 5); b.ellipse(cx, cy + 1, rx - 1, ry - 1, 'metal', 3);
        b.ellipse(cx, cy + 1, rx - 3, ry - 3, 'preto', 3);
        b.ellipse(cx, cy + 2, rx - 6, ry - 5, 'preto', 1);
        for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; b.ellipse(cx + Math.cos(t) * (rx - 3), cy + 1 + Math.sin(t) * (ry - 3), 2.5, 1.6, 'preto', a % 2 ? 4 : 3); }
        b.ellipse(cx - 16, cy + 2, 6, 3.5, 'papel', 5); b.hline(cx - 20, cx - 13, cy + 1, 'grafite', 3); b.px(cx - 18, cy + 3, 'grafite', 3);
        b.poly([[cx + 8, cy + 5], [cx + 16, cy - 1], [cx + 18, cy + 1], [cx + 11, cy + 6]], 'amarelo', 5); b.px(cx + 14, cy + 2, 'amarelo', 2);
        b.rect(cx - 4, cy - 3, 6, 4, 'vermelho', 4); b.hline(cx - 4, cx + 1, cy - 3, 'metal', 5);
        b.ellipse(cx + 22, cy - 2, 4, 2, 'agua', 4);
      });
    },
    tampa: aberta => U.art('ib:lixeira:tampa:' + aberta, 72, aberta ? 16 : 32, b => {
      if (aberta) {
        b.ellipse(36, 8, 34, 5, 'metal', 3); b.ellipse(36, 7, 32, 4, 'metal', 4); b.hline(6, 66, 7, 'metal', 5);
        b.rect(30, 0, 12, 3, 'metal', 5); b.rect(32, 3, 8, 2, 'metal', 2);
      } else {
        b.ellipse(36, 20, 35, 13, 'metal', 2);
        for (let y = 6; y < 34; y++) for (let x = 0; x < 72; x++) { const nx = (x - 36) / 35, ny = (y - 18) / 12; if (nx * nx + ny * ny <= 1) b.px(x, y, 'metal', nx > .2 && ny < -.1 ? 6 : nx > -.3 && ny < .4 ? 5 : 4); }
        b.ellipse(36, 20, 35, 13, 'metal', 2); b.ellipse(36, 18, 34, 12, 'metal', 4); b.ellipse(36, 17, 26, 8, 'metal', 5);
        b.rect(28, 7, 16, 4, 'metal', 6); b.rect(28, 11, 16, 2, 'metal', 2); b.rect(29, 5, 14, 2, 'metal', 4);
      }
      contorno(b, 'carvao', 0);
    }),
    desenhar(F) {
      const {ctx, G, st} = F, u = F.capa, aberto = F.mem.tampa && st.capa >= 1, {cy, ry} = G.aro;
      sombraChao(ctx, F.X(-2), F.Y(G.h) - 10, (G.w + 4) * 2, 14);
      const tampa = () => {
        if (u >= .98) { U.blit(ctx, this.tampa(true), F.X(2), F.Y(cy - ry - 14)); return; }
        const c = this.tampa(false), hh = snap(c.height * 2 * (1 - u * .72)), dy = snap(-u * 22);
        ctx.drawImage(c, F.X(2), F.Y(cy - 20) + dy + (c.height * 2 - hh), c.width * 2, hh);
      };
      if (u > .5) tampa();
      U.blit(ctx, this.corpo(G), F.X(0), F.Y(0));
      zonasDeCima(F, aberto, {rotuloY: 6});
      if (u <= .5) tampa();
      if (!aberto) F.capaRegiao(F.X(0), F.Y(cy - 20), G.w * 2, 40 * 2);
      else F.capaRegiao(F.X(2), F.Y(cy - ry - 14), 72 * 2, 14 * 2);
    }
  };

  /* ------------------------------------------------------------ caçamba */
  ESTILOS.cacamba = {
    nome: 'Caçamba', fundo: 'rua', chaoY: 244, max: 4, som: 'tampa', material: 'lixo', parte: 'Canto', unica: 'Dentro', capa: true, fisico: false,
    dicaCapa: 'clique nas tampas para abrir', dica: 'clique numa parte da caçamba',
    geo(n) {
      const N = clamp(n, 1, 4), W = 108, H = 88, dob = 22, frente = 44;
      const ab = {x: 6, y: dob, w: W - 12, h: frente - dob - 1};
      const w = Math.floor((ab.w - 2 * (N + 1)) / N), partes = [];
      for (let i = 0; i < N; i++) partes.push({x: ab.x + 2 + i * (w + 2), y: ab.y + 1, w, h: ab.h - 2});
      return {w: W, h: H, base: H, ab, dob, frente, partes, tranca: {x: W / 2, y: frente + 8}};
    },
    corpo(G) {
      return U.art(`ib:cacamba:corpo:${G.partes.length}`, G.w, G.h, b => {
        const W = G.w, H = G.h, f = G.frente, ab = G.ab, R = K.rng(12);
        // Dentro: parede do fundo iluminada, sacos pretos, papelão, jornal.
        b.rect(ab.x, ab.y, ab.w, ab.h, 'verde', 1); b.rect(ab.x, ab.y, ab.w, 5, 'verde', 2); b.hline(ab.x, ab.x + ab.w - 1, ab.y + 5, 'verde', 0);
        for (let k = 0; k < 9; k++) { const x = ab.x + 6 + (k * 11 + R() * 6) % (ab.w - 14), y = ab.y + 8 + R() * (ab.h - 12); b.sphere(x, y, 6 + R() * 3, 4 + R() * 2, 'preto', 2, 5); b.px(x + 2, y - 2, 'preto', 6); }
        b.rect(ab.x + 30, ab.y + 6, 16, 10, 'sepia', 4); b.hline(ab.x + 30, ab.x + 45, ab.y + 6, 'sepia', 5); b.line(ab.x + 30, ab.y + 6, ab.x + 36, ab.y + 2, 'sepia', 5);
        b.line(ab.x + 62, ab.y + 3, ab.x + 74, ab.y + 12, 'madeira', 4); b.line(ab.x + 63, ab.y + 3, ab.x + 75, ab.y + 12, 'madeira', 2);
        b.rect(ab.x + 10, ab.y + 14, 12, 6, 'papel', 5); b.hline(ab.x + 11, ab.x + 19, ab.y + 16, 'grafite', 3);
        // Aro de cima (espessura) e a frente afunilada, com nervuras.
        b.rect(ab.x - 4, ab.y - 3, ab.w + 8, 3, 'verde', 5); b.hline(ab.x - 4, ab.x + ab.w + 3, ab.y - 3, 'verde', 6);
        b.rect(ab.x - 4, ab.y, 4, ab.h, 'verde', 4); b.rect(ab.x + ab.w, ab.y, 4, ab.h, 'verde', 3);
        b.poly([[1, f], [W - 1, f], [W - 5, H - 12], [5, H - 12]], 'verde', 3);
        b.rect(1, f - 1, W - 2, 4, 'verde', 5); b.hline(1, W - 2, f - 1, 'verde', 6); b.hline(1, W - 2, f + 3, 'verde', 1);
        for (let x = 12; x < W - 6; x += 14) { b.vline(x, f + 4, H - 13, 'verde', 5); b.vline(x + 1, f + 4, H - 13, 'verde', 2); }
        b.rect(8, f + 18, 12, 6, 'verde', 1); b.rect(W - 20, f + 18, 12, 6, 'verde', 1);
        b.text(W / 2, f + 8, 'NAO JOGUE', 'papel', 5, {font: '3x5', align: 'center'}); b.text(W / 2, f + 15, 'ENTULHO', 'papel', 5, {font: '3x5', align: 'center'});
        b.text(W / 2, f + 25, '07', 'amarelo', 5, {font: '3x5', align: 'center'});
        for (const x of [9, 24, 83, 99]) { for (let y = f + 3; y < f + 3 + 4 + R() * 14; y++) if (K.hash2(x, y, 3) > .3) b.px(x + (y % 3 === 0 ? 1 : 0), y, 'ambar', 2); }
        b.rect(5, H - 12, W - 10, 2, 'verde', 1);
        for (const x of [16, W - 16]) { b.ellipse(x, H - 6, 6, 6, 'preto', 2); b.ellipse(x, H - 6, 3, 3, 'metal', 4); b.px(x + 1, H - 7, 'metal', 6); b.rect(x - 3, H - 13, 6, 3, 'metal', 2); }
      });
    },
    tampaArt: (tipo, w, h) => U.art(`ib:cacamba:tampa:${tipo}:${w}x${h}`, w, h, b => {
      if (tipo === 'v') { b.rect(0, 0, w, h, 'preto', 2); for (let y = 2; y < h; y += 4) b.hline(1, w - 2, y, 'preto', 1); for (let x = 4; x < w; x += 8) b.vline(x, 0, h - 1, 'preto', 3); b.speckle(0, 0, w, h, 'verde', 1, .05, K.rng(2)); b.frame(0, 0, w, h, 'preto', 4); return; }
      b.rect(0, 0, w, h, 'preto', 3); for (let y = 3; y < h - 4; y += 4) { b.hline(1, w - 2, y, 'preto', 4); b.hline(1, w - 2, y + 1, 'preto', 2); }
      b.rect(0, h - 4, w, 4, 'preto', 4); b.hline(0, w - 1, h - 4, 'preto', 5); b.rect(Math.floor(w / 2) - 6, h - 3, 12, 2, 'preto', 1);
      b.speckle(0, 0, w, h, 'concreto', 3, .02, K.rng(w)); b.vline(w - 1, 0, h - 1, 'preto', 5); b.vline(0, 0, h - 1, 'preto', 1);
    }),
    desenhar(F) {
      const {ctx, G, st} = F, u = F.capa, aberto = F.mem.tampa && st.capa >= 1, ab = G.ab;
      sombraChao(ctx, F.X(-3), F.Y(G.h) - 12, (G.w + 6) * 2, 14);
      U.blit(ctx, this.corpo(G), F.X(0), F.Y(0));
      zonasDeCima(F, aberto, {rotuloY: 4});
      const L = ab.h + 1, meia = Math.floor(ab.w / 2);
      [[ab.x, meia, 0], [ab.x + meia, ab.w - meia, .12]].forEach(([x, w, atraso]) => {
        const a = clamp((u - atraso) / (1 - atraso), 0, 1);
        tampaHorizontal(ctx, F, {frente: this.tampaArt('f', w, L), verso: this.tampaArt('v', w, L), x, hy: ab.y - 1, w, L, ang: ease(a), abre: 112, tras: true});
      });
      if (!aberto) F.capaRegiao(F.X(0), F.Y(ab.y - 4), G.w * 2, (ab.h + 8) * 2);
      else F.capaRegiao(F.X(ab.x), F.Y(ab.y - 30), ab.w * 2, 26 * 2);
    }
  };

  /* Tipos pelo nome, sem repetir as peças únicas (cama: um colchão, um travesseiro). */
  function tiposUnicos(comps, N, regras, livres, repetem) {
    const tipos = comps.slice(0, N).map(c => tipoPorNome(c.nome, regras));
    tipos.forEach((t, i) => { if (t && !repetem.includes(t) && tipos.indexOf(t) !== i) tipos[i] = null; });
    tipos.forEach((t, i) => { if (!t) tipos[i] = livres.find(x => repetem.includes(x) || !tipos.includes(x)) || repetem[0]; });
    return tipos;
  }
  /* Área escura embaixo de um móvel: acende (lanterna) quando aberta. */
  function embaixo(F, i, p) {
    const {ctx} = F, u = F.aberto(i), x = F.X(p.x), y = F.Y(p.y), w = p.w * 2, h = p.h * 2;
    if (u > 0) {
      ctx.save(); ctx.globalAlpha = .55 * u; U.rect(ctx, x + 4, y + 2, w - 8, h - 4, C('madeira', 3));
      ctx.globalAlpha = .35 * u; U.rect(ctx, x + 12, y + 4, w - 24, h - 8, C('amarelo', 4)); ctx.restore();
      for (let k = 0; k < 3; k++) U.rect(ctx, snap(x + 10 + k * w / 3), y + h - 6, 6, 4, C('carvao', 4));
      if (u > .9) { miudos(F, i, x + 4, y, w - 8, h); F.interior(i, x, y, w, h); }
    }
    F.parte(i, x, y, w, h);
    F.rotulo(i, x + w / 2, y + (u > .9 && F.itens(i).length ? 8 : h / 2), Math.max(60, w));
  }

  /* ------------------------------------------------------------ sofá */
  const TIPOS_SOFA = {embaixo: /embaixo|debaixo|sob |chao|atras/};
  ESTILOS.sofa = {
    nome: 'Sofá', fundo: 'sala', max: 4, som: 'objeto', material: 'tecido', parte: 'Almofada', unica: 'Almofada', fisico: true, dica: 'clique numa almofada para levantar',
    geo(n, comps) {
      const N = clamp(n, 1, 4), W = 108, H = 66, tipos = comps.slice(0, N).map(c => tipoPorNome(c.nome, TIPOS_SOFA) || 'almofada');
      const nA = tipos.filter(t => t === 'almofada').length, nE = N - nA;
      const cw = nA ? Math.floor((84 - (nA - 1)) / nA) : 0, uw = nE ? Math.floor((80 - 2 * (nE - 1)) / nE) : 0;
      let a = 0, e = 0;
      const partes = tipos.map(t => t === 'almofada' ? {tipo: t, x: 12 + (a++) * (cw + 1), y: 28, w: cw, h: 12, D: 12, material: 'tecido'} : {tipo: t, x: 14 + (e++) * (uw + 2), y: 50, w: uw, h: 14, material: 'escuro'});
      return {w: W, h: H, base: H, partes, nA, tranca: {x: W / 2, y: 44}};
    },
    corpo: () => U.art('ib:sofa:corpo', 108, 66, b => {
      b.rect(8, 6, 92, 24, 'vermelho', 3); b.rect(8, 6, 92, 4, 'vermelho', 4); b.hline(9, 98, 6, 'vermelho', 5); b.vline(99, 7, 29, 'vermelho', 4);
      for (const y of [14, 22]) for (let x = 14 + (y === 22 ? 6 : 0); x < 96; x += 12) { b.px(x, y, 'vermelho', 1); b.px(x - 1, y - 1, 'vermelho', 2); b.px(x + 1, y + 1, 'vermelho', 4); }
      for (const [x0, lv] of [[0, 2], [96, 4]]) { b.rect(x0, 20, 12, 28, 'vermelho', lv + 1); b.ellipse(x0 + 6, 21, 6, 4, 'vermelho', lv + 2); b.hline(x0 + 2, x0 + 9, 18, 'vermelho', lv + 3); b.vline(x0 + (x0 ? 11 : 0), 20, 47, 'vermelho', lv); }
      b.rect(12, 28, 84, 12, 'vermelho', 1); b.speckle(13, 30, 82, 9, 'papel', 5, .04, K.rng(3)); b.px(40, 36, 'latao', 5); b.px(41, 36, 'latao', 3); b.line(70, 37, 76, 36, 'preto', 3);
      b.rect(4, 40, 100, 9, 'vermelho', 2); b.hline(4, 103, 40, 'vermelho', 4); b.hline(4, 103, 48, 'vermelho', 1);
      b.rect(12, 49, 84, 15, 'preto', 1); b.rect(14, 60, 18, 3, 'carvao', 2);
      for (const x of [9, 95]) { b.poly([[x, 49], [x + 4, 49], [x + 3, 65], [x + 1, 65]], 'madeira', 4); b.vline(x + 3, 49, 64, 'madeira', 5); }
    }),
    almofada: w => U.art('ib:sofa:almofada:' + w, w, 14, b => {
      b.rect(0, 0, w, 12, 'vermelho', 3); b.rect(0, 0, w, 4, 'vermelho', 4); b.hline(1, w - 2, 0, 'vermelho', 5); b.hline(0, w - 1, 4, 'vermelho', 5);
      b.hline(0, w - 1, 11, 'vermelho', 2); b.vline(w - 1, 1, 10, 'vermelho', 4); b.vline(0, 1, 10, 'vermelho', 2);
      for (let x = Math.floor(w * .3); x < w * .7; x++) b.px(x, 1, 'vermelho', 4);
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, 11], [w - 1, 11]]) b.erase(x, y, 1, 1);
      b.rect(1, 12, w - 2, 2, 'vermelho', 1);
    }),
    desenhar(F) {
      const {ctx, G} = F;
      sombraChao(ctx, F.X(0), F.Y(G.h) - 10, G.w * 2, 12);
      U.blit(ctx, this.corpo(), F.X(0), F.Y(0));
      if (!G.nA) for (const x of [12, 55]) U.blit(ctx, this.almofada(41), F.X(x), F.Y(28));
      G.partes.forEach((p, i) => { if (p.tipo === 'embaixo') embaixo(F, i, p); });
      const ordem = G.partes.map((p, i) => i).filter(i => G.partes[i].tipo === 'almofada').sort((a, b) => F.aberto(a) - F.aberto(b));
      for (const i of ordem) {
        const p = G.partes[i], u = F.aberto(i), lift = Math.round(p.D * u), x = F.X(p.x), w = p.w * 2;
        if (u > .9) { miudos(F, i, x + 4, F.Y(p.y), w - 8, p.h * 2); F.interior(i, x, F.Y(p.y), w, p.h * 2); }
        const art = this.almofada(p.w);
        ctx.drawImage(art, 0, 0, p.w, lift > 0 ? 14 : 12, x, F.Y(p.y - lift), w, (lift > 0 ? 14 : 12) * 2);
        F.parte(i, x, F.Y(p.y - lift), w, 24);
        F.rotulo(i, x + w / 2, F.Y(p.y - lift) + 15, w + 2);
      }
    }
  };

  /* ------------------------------------------------------------ cama */
  const TIPOS_CAMA = {travesseiro: /travesseiro|fronha|almofada/, colchao: /colch|lencol|cobert/, embaixo: /embaixo|debaixo|chao|sob /};
  ESTILOS.cama = {
    nome: 'Cama', fundo: 'sala', max: 4, som: 'objeto', material: 'colchao', parte: 'Parte', unica: 'Colchão', fisico: true, dica: 'clique no colchão, no travesseiro ou embaixo da cama',
    geo(n, comps) {
      const N = clamp(n, 1, 4), W = 112, H = 66, tipos = tiposUnicos(comps, N, TIPOS_CAMA, ['colchao', 'travesseiro', 'embaixo'], ['embaixo']);
      const nE = tipos.filter(t => t === 'embaixo').length, uw = nE ? Math.floor((86 - 2 * (nE - 1)) / nE) : 0;
      let e = 0;
      const partes = tipos.map(t => t === 'colchao' ? {tipo: t, x: 42, y: 27, w: 58, h: 13, nome: 'Colchão', material: 'colchao'}
        : t === 'travesseiro' ? {tipo: t, x: 12, y: 17, w: 26, h: 11, nome: 'Travesseiro', material: 'colchao'}
        : {tipo: t, x: 12 + (e++) * (uw + 2), y: 49, w: uw, h: 15, nome: 'Embaixo da cama', material: 'escuro'});
      return {w: W, h: H, base: H, partes, tipos, tranca: {x: 56, y: 44}};
    },
    corpo: () => U.art('ib:cama:corpo', 112, 66, b => {
      b.rect(0, 6, 10, 50, 'madeira', 3); b.ellipse(5, 7, 5, 5, 'madeira', 4); b.vline(9, 6, 55, 'madeira', 4); b.inset(2, 14, 6, 30, 'madeira', 3, 4, 2);
      b.rect(102, 24, 10, 32, 'madeira', 3); b.ellipse(107, 25, 5, 4, 'madeira', 4); b.vline(111, 24, 55, 'madeira', 5);
      b.rect(10, 34, 92, 6, 'madeira', 2); for (let x = 14; x < 100; x += 7) b.vline(x, 34, 39, 'madeira', 0);
      b.rect(8, 40, 96, 8, 'madeira', 3); b.hline(8, 103, 40, 'madeira', 5); b.hline(8, 103, 47, 'madeira', 1); veios(b, 8, 41, 96, 6, 'madeira', 3, 21);
      b.rect(10, 48, 92, 16, 'preto', 1); b.rect(72, 56, 20, 8, 'sepia', 2); b.hline(72, 91, 56, 'sepia', 3); b.rect(20, 61, 12, 3, 'rosa', 2);
      b.rect(1, 56, 7, 10, 'madeira', 2); b.rect(104, 56, 7, 10, 'madeira', 3);
    }),
    tampo: () => U.art('ib:cama:tampo', 92, 24, b => {
      b.rect(0, 10, 92, 12, 'papel', 5); b.hline(0, 91, 10, 'papel', 6); b.hline(0, 91, 21, 'papel', 3);
      for (let x = 3; x < 92; x += 6) { b.px(x, 14, 'papel', 3); b.px(x + 3, 18, 'papel', 3); }
      b.poly([[30, 6], [92, 6], [92, 23], [26, 23]], 'azul', 3); b.hline(30, 91, 6, 'azul', 5); b.hline(30, 91, 7, 'azul', 4);
      for (let k = 0; k < 5; k++) b.line(40 + k * 11, 9, 34 + k * 11, 22, 'azul', 2);
      b.vline(26, 12, 23, 'azul', 1); b.hline(26, 91, 23, 'azul', 2);
    }),
    travesseiro: () => U.art('ib:cama:travesseiro', 26, 12, b => { b.ellipse(13, 6, 13, 5.5, 'papel', 5); b.ellipse(14, 5, 11, 4, 'papel', 6); b.line(6, 7, 20, 6, 'papel', 4); b.px(20, 3, 'papel', 7); contorno(b, 'papel', 2); }),
    desenhar(F) {
      const {ctx, G} = F, idx = t => G.tipos.indexOf(t);
      sombraChao(ctx, F.X(0), F.Y(G.h) - 10, G.w * 2, 12);
      U.blit(ctx, this.corpo(), F.X(0), F.Y(0));
      G.partes.forEach((p, i) => { if (p.tipo === 'embaixo') embaixo(F, i, p); });
      const iC = idx('colchao'), iT = idx('travesseiro'), uC = iC >= 0 ? F.aberto(iC) : 0, uT = iT >= 0 ? F.aberto(iT) : 0;
      const tilt = k => Math.round(14 * uC * k / 91);
      if (uC > .9) { const p = G.partes[iC]; miudos(F, iC, F.X(p.x + 6), F.Y(p.y), (p.w - 8) * 2, p.h * 2); F.interior(iC, F.X(p.x), F.Y(p.y - 10), p.w * 2, (p.h + 10) * 2); }
      const tampo = this.tampo();
      ctx.imageSmoothingEnabled = false;
      for (let k = 0; k < 92; k++) ctx.drawImage(tampo, k, 0, 1, 24, F.X(10 + k), F.Y(17 - tilt(k)), 2, 48);
      if (uT > .9) { const p = G.partes[iT]; miudos(F, iT, F.X(p.x), F.Y(p.y + 1), p.w * 2, p.h * 2); F.interior(iT, F.X(p.x), F.Y(p.y), p.w * 2, p.h * 2); }
      const ly = Math.round(9 * uT) + tilt(14);
      U.blit(ctx, this.travesseiro(), F.X(12), F.Y(17 - ly));
      if (iT >= 0) { const p = G.partes[iT]; F.parte(iT, F.X(p.x), F.Y(p.y - ly), p.w * 2, p.h * 2); }
      if (iC >= 0) { const p = G.partes[iC]; F.parte(iC, F.X(p.x), F.Y(p.y - tilt(60)), p.w * 2, p.h * 2); F.rotulo(iC, F.X(p.x + p.w / 2), F.Y(p.y + 6 - tilt(60)), 110); }
      if (iT >= 0) { const p = G.partes[iT]; F.rotulo(iT, F.X(p.x + p.w / 2), F.Y(p.y - ly) + 8, 96); }
    }
  };

  /* ------------------------------------------------------------ duto de ventilação */
  ESTILOS.duto = {
    nome: 'Duto', fundo: 'parede', chaoY: 204, max: 3, som: 'gaveta_metal', material: 'escuro', parte: 'Parte', unica: 'Dentro do duto', capa: true, fisico: false,
    dicaCapa: 'clique na grade para tirar', dica: 'clique numa parte do duto',
    geo(n) {
      const N = clamp(n, 1, 3), W = 92, H = 68;
      const zonas = {1: [{x: 16, y: 30, w: 60, h: 28}], 2: [{x: 10, y: 36, w: 44, h: 22}, {x: 32, y: 12, w: 30, h: 22}], 3: [{x: 8, y: 36, w: 36, h: 22}, {x: 30, y: 12, w: 32, h: 22}, {x: 48, y: 36, w: 36, h: 22}]}[N];
      return {w: W, h: H, base: H, ab: {x: 6, y: 6, w: 80, h: 56}, partes: zonas, tranca: {x: W / 2, y: H - 2}};
    },
    corpo: () => U.art('ib:duto:corpo', 92, 68, b => {
      const ax = 6, ay = 6, aw = 80, ah = 56, cx = 40, cy = 25;
      for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
        const dx = (x + .5 - cx) / 40, dy = (y + .5 - cy) / (y < cy ? 25 : 31), t = Math.max(Math.abs(dx), Math.abs(dy));
        const face = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'cima' : 'chao') : (dx < 0 ? 'esq' : 'dir');
        let lv = Math.floor(t * 4.2) + (face === 'cima' || face === 'esq' ? 0 : face === 'dir' ? -1 : 0) - 1;
        if ([.52, .7, .86].some(s => Math.abs(t - s) < .012)) lv += 1;
        b.px(ax + x, ay + y, t < .28 ? 'preto' : 'metal', t < .28 ? 0 : clamp(lv, 0, 4));
      }
      b.speckle(ax + 8, ay + 38, aw - 16, 16, 'concreto', 3, .07, K.rng(4)); b.speckle(ax + 20, ay + 34, aw - 40, 6, 'concreto', 2, .08, K.rng(5));
      for (let k = 0; k < 4; k++) b.line(ax, ay + k * 3, ax + 12 - k * 3, ay, 'papel', 4);
      b.line(ax, ay, ax + 10, ay + 9, 'papel', 3); b.rect(ax + 52, ay + 46, 7, 4, 'papel', 4); b.px(ax + 53, ay + 47, 'tinta', 3);
      b.frame(0, 0, 92, 68, 'metal', 2); b.frame(1, 1, 90, 66, 'metal', 4); b.frame(2, 2, 88, 64, 'metal', 3); b.frame(3, 3, 86, 62, 'metal', 3); b.frame(4, 4, 84, 60, 'metal', 2); b.frame(5, 5, 82, 58, 'metal', 1);
      b.hline(1, 90, 1, 'metal', 5); b.vline(90, 1, 66, 'metal', 5);
      for (const [x, y] of [[3, 3], [88, 3], [3, 64], [88, 64]]) b.px(x, y, 'preto', 0);
    }),
    grade: comParafuso => U.art('ib:duto:grade:' + comParafuso, 92, 68, b => {
      b.bevel(0, 0, 92, 68, 'metal', 3, 5, 1); b.inset(5, 5, 82, 58, 'metal', 2, 4, 1);
      for (let y = 7; y < 60; y += 5) { b.rect(6, y, 80, 3, 'metal', 4); b.hline(6, 85, y, 'metal', 6); b.hline(6, 85, y + 3, 'metal', 1); b.hline(6, 85, y + 4, 'preto', 1); }
      b.speckle(1, 1, 90, 66, 'concreto', 2, .015, K.rng(7));
      if (comParafuso) for (const [x, y] of [[3, 3], [88, 3], [3, 64], [88, 64]]) { b.ellipse(x + .5, y + .5, 2, 2, 'latao', 4); b.px(x, y, 'latao', 1); b.px(x + 1, y, 'latao', 1); }
    }),
    desenhar(F) {
      const {ctx, G, st} = F, u = F.capa, aberto = F.mem.tampa && st.capa >= 1;
      U.blit(ctx, this.corpo(), F.X(0), F.Y(0));
      zonasDeCima(F, aberto);
      const solta = clamp((u - .25) / .75, 0, 1), dy = Math.round(ease(solta) * (G.h + 26));
      if (u > 0 && u < .7) for (const [x, y] of [[3, 3], [88, 3], [3, 64], [88, 64]]) { const q = clamp((u - .1) / .5, 0, 1); U.rect(ctx, F.X(x) + (x > 40 ? 4 : -4) * q, F.Y(y) + snap(q * q * 90), 4, 4, C('latao', 4)); }
      U.blit(ctx, this.grade(u <= .08), F.X(0), F.Y(dy));
      if (!aberto) F.capaRegiao(F.X(0), F.Y(0), G.w * 2, G.h * 2);
      else F.capaRegiao(F.X(0), Math.min(SH - 26, F.Y(dy)), G.w * 2, 26);
    }
  };

  /* ------------------------------------------------------------ bolsa */
  const TIPOS_BOLSA = {frente: /frente|frontal|ziper/, lateral: /lado|lateral/, principal: /principal|dentro|interno|interior|grande|meio|centro/};
  ESTILOS.bolsa = {
    nome: 'Bolsa', fundo: 'sala', max: 4, som: 'objeto', material: 'forro', parte: 'Bolso', unica: 'Dentro da bolsa', fisico: true, dica: 'clique num bolso para abrir',
    geo(n, comps) {
      const N = clamp(n, 1, 4), W = 104, H = 80, tipos = tiposUnicos(comps, N, TIPOS_BOLSA, ['principal', 'frente', 'lateral'], ['lateral']);
      let nl = 0;
      const partes = tipos.map(t => t === 'principal' ? {tipo: t, x: 12, y: 22, w: 80, h: 28, nome: 'Dentro da bolsa'}
        : t === 'frente' ? {tipo: t, x: 24, y: 52, w: 56, h: 20, nome: 'Bolso da frente'}
        : (nl++ % 2 === 0 ? {tipo: t, x: 0, y: 38, w: 12, h: 34, lado: -1, nome: 'Bolso lateral'} : {tipo: t, x: 92, y: 38, w: 12, h: 34, lado: 1, nome: 'Bolso lateral'}));
      return {w: W, h: H, base: H, partes, tipos, tranca: {x: 52, y: 47}};
    },
    corpo: () => U.art('ib:bolsa:corpo', 104, 80, b => {
      for (let t = 0; t <= 60; t++) { const q = t / 60, x = 30 + 44 * q, y = 23 - 20 * Math.sin(Math.PI * q); b.rect(x, y, 2, 3, 'madeira', q > .5 ? 5 : 4); b.px(x, y + 2, 'madeira', 2); }
      b.poly([[12, 22], [92, 22], [98, 78], [6, 78]], 'madeira', 3);
      b.shadeFn(6, 22, 92, 57, x => faixas((x - 52) / 46 * 1.2));
      b.rect(14, 22, 76, 5, 'roxo', 1); b.hline(14, 89, 22, 'madeira', 5);
      b.rect(6, 74, 92, 4, 'madeira', 2); for (let x = 10; x < 96; x += 4) b.px(x, 73, 'madeira', 5);
      b.rect(24, 52, 56, 21, 'madeira', 4); b.frame(24, 52, 56, 21, 'madeira', 2); for (let x = 26; x < 78; x += 3) { b.px(x, 54, 'madeira', 6); b.px(x, 70, 'madeira', 6); }
      for (let x = 25; x < 79; x += 2) b.px(x, 52, 'metal', 5); b.rect(74, 51, 3, 5, 'metal', 6);
      b.poly([[0, 40], [12, 38], [12, 72], [2, 72]], 'madeira', 2); b.hline(0, 11, 39, 'madeira', 4);
      b.poly([[92, 38], [104, 40], [102, 72], [92, 72]], 'madeira', 4); b.hline(92, 103, 39, 'madeira', 6);
    }),
    aba: verso => U.art('ib:bolsa:aba:' + verso, 80, 28, b => {
      b.rect(0, 0, 80, 26, 'madeira', verso ? 2 : 4); b.ellipse(40, 22, 40, 6, 'madeira', verso ? 2 : 4);
      for (const [x, y] of [[0, 25], [79, 25], [0, 24], [79, 24], [1, 25], [78, 25]]) b.erase(x, y, 1, 1);
      if (verso) { b.speckle(0, 0, 80, 28, 'madeira', 3, .08, K.rng(3)); return; }
      b.hline(0, 79, 0, 'madeira', 6); for (let x = 3; x < 78; x += 3) b.px(x, 3, 'madeira', 6);
      b.rect(36, 0, 8, 22, 'madeira', 2); b.vline(43, 0, 21, 'madeira', 3);
      b.frame(34, 18, 12, 8, 'latao', 4); b.hline(34, 45, 18, 'latao', 6); b.vline(40, 19, 24, 'latao', 3);
    }),
    desenhar(F) {
      const {ctx, G} = F, iP = G.tipos.indexOf('principal'), iF = G.tipos.indexOf('frente');
      sombraChao(ctx, F.X(4), F.Y(G.h) - 8, (G.w - 8) * 2, 12);
      U.blit(ctx, this.corpo(), F.X(0), F.Y(0));
      G.partes.forEach((p, i) => {
        if (p.tipo !== 'lateral') return;
        const u = F.aberto(i), x = F.X(p.x), y = F.Y(p.y);
        if (u > 0) { U.rect(ctx, x + 2, y - 2, 20, snap(8 * u), C('roxo', 1)); if (u > .9) { miudos(F, i, x - 12, y - 34, 48, 34); F.interior(i, x - 12, y - 34, 48, 34); } }
        F.parte(i, x, y, p.w * 2, p.h * 2);
        F.rotulo(i, x + p.w, y + p.h + 20, 90);
      });
      if (iF >= 0) {
        const p = G.partes[iF], u = F.aberto(iF), abre = snap(20 * u);
        if (abre > 0) { U.rect(ctx, F.X(p.x + 1), F.Y(p.y) + 2, (p.w - 2) * 2, abre, C('roxo', 1)); U.rect(ctx, F.X(p.x + 1), F.Y(p.y) + abre, (p.w - 2) * 2, 2, C('metal', 5)); if (u > .9) { miudos(F, iF, F.X(p.x + 4), F.Y(p.y) - 6, (p.w - 8) * 2, abre + 4); F.interior(iF, F.X(p.x), F.Y(p.y), p.w * 2, abre + 2); } }
        F.parte(iF, F.X(p.x), F.Y(p.y) + abre, p.w * 2, p.h * 2 - abre);
        F.rotulo(iF, F.X(p.x + p.w / 2), F.Y(p.y) + 24 + abre / 2, 110);
      }
      if (iP >= 0) {
        const p = G.partes[iP], u = F.aberto(iP);
        if (u > .9) { miudos(F, iP, F.X(18), F.Y(16), 136, 26); F.interior(iP, F.X(14), F.Y(10), 152, 30); }
        tampaHorizontal(ctx, F, {frente: this.aba(false), verso: this.aba(true), x: 12, hy: 22, w: 80, L: 28, ang: u, abre: 125, tras: true});
        F.parte(iP, F.X(12), u > .5 ? F.Y(-8) : F.Y(22), 160, u > .5 ? 60 : 56);
        F.rotulo(iP, F.X(52), u > .5 ? F.Y(-2) : F.Y(34), 120);
      } else U.blit(ctx, this.aba(false), F.X(12), F.Y(22));
    }
  };

  /* ------------------------------------------------------------ teclado numérico */
  const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
  const tecladoArt = () => U.art('ib:teclado:caixa', 70, 88, b => {
    b.rect(0, 0, 70, 88, 'metal', 3); b.hline(0, 69, 0, 'metal', 5); b.vline(69, 1, 87, 'metal', 4); b.hline(0, 69, 87, 'metal', 1); b.vline(0, 1, 87, 'metal', 2);
    b.hline(1, 68, 1, 'metal', 4); b.speckle(2, 2, 66, 84, 'metal', 4, .03, K.rng(5)); b.speckle(2, 2, 66, 84, 'metal', 2, .02, K.rng(6));
    b.inset(5, 5, 60, 16, 'metal', 1, 5, 0); b.rect(6, 6, 58, 14, 'fosforo', 1);
    b.inset(6, 24, 58, 60, 'metal', 2, 4, 1);
    for (const [x, y] of [[2, 2], [66, 2], [2, 84], [66, 84]]) { b.px(x, y, 'metal', 6); b.px(x + 1, y + 1, 'metal', 1); }
    b.text(35, 22, 'SEGURANCA', 'metal', 1, {font: '3x5', align: 'center'});
  });
  function desenharTeclado(ctx, ui, st, clue, sys, px, py, vivo) {
    const d = clue.data, code = codigoTranca(d.codigo), W = PAINEL.w, t = ui.t;
    const ok = st.destrancar?.tipo === 'codigo' || !trancado(st, clue);
    const tremor = st.keyShake > 0 ? Math.round(Math.sin(st.keyShake * 90) * 2) * 2 : 0;
    const DW = 140, DH = 176, dx = snap(px + (W - DW) / 2 + tremor), dy = snap(py + 2);
    // A placa na parede com o teclado.
    U.rect(ctx, dx + 6, dy + 6, DW, DH, '#05020899');
    U.blit(ctx, tecladoArt(), dx, dy);
    ui.region('painel', px, py, W, PAINEL.h, {cursor: 'default', silent: true});
    // Visor.
    const erro = st.erroT > 0, pisca = Math.floor(t * 6) % 2;
    let visor = st.digitado.padEnd(code.length, '_');
    if (ok) visor = 'ABERTO'; else if (erro) visor = pisca ? 'ERRO' : '';
    const vx = dx + 12, vy = dy + 12, vw = 116, vh = 28;
    if (!ok && !erro) for (let k = 0; k < 3; k++) U.rect(ctx, vx + 4, vy + 6 + k * 7, vw - 8, 1, '#08401c55');
    const escala = K.measure(visor) * 2 <= vw - 12 ? 2 : 1;
    K.drawText(ctx, visor, vx + vw / 2, vy + (escala === 2 ? 7 : 10), {color: ok ? C('fosforo', 7) : erro ? C('vermelho', 5) : C('fosforo', 6), scale: escala, align: 'center'});
    // LED: vermelho piscando trancado, verde aberto.
    U.rect(ctx, dx + DW - 16, dy + 44, 6, 6, ok ? C('verde', 6) : pisca || st.piscar > 0 ? C('vermelho', 5) : C('vermelho', 2));
    // Teclas.
    const bw = 34, bh = 22, gx = 7, gy = 6, tx0 = dx + Math.floor((DW - (bw * 3 + gx * 2)) / 2), ty0 = dy + 56;
    TECLAS.forEach((k, j) => {
      const x = tx0 + (j % 3) * (bw + gx), y = ty0 + Math.floor(j / 3) * (bh + gy);
      const hot = vivo && !ok && ui.region('tecla', x, y, bw, bh, {data: k, silent: true});
      const down = (st.press[k] || 0) > 0 || (hot && ui.mouse.down);
      const oy = down ? 2 : 0;
      if (!down) U.rect(ctx, x, y + bh, bw, 2, C('carvao', 0));
      U.rect(ctx, x, y + oy, bw, bh, hot ? C('carvao', 5) : C('carvao', 4));
      U.rect(ctx, x, y + oy, bw, 2, C('carvao', 6)); U.rect(ctx, x + bw - 2, y + oy, 2, bh, C('carvao', 5)); U.rect(ctx, x, y + oy + bh - 2, bw, 2, C('carvao', 2));
      if (hot) U.outline(ctx, x - 2, y + oy - 2, bw + 4, bh + 4, '#ffd18c', 2);
      const cor = k === 'OK' ? C('verde', 6) : k === '<' ? C('amarelo', 5) : C('papel', 7);
      if (k === '<') { ctx.fillStyle = cor; for (let i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * 2, y + oy + 10 - i, 2, 1 + i * 2); ctx.fillRect(x + 20, y + oy + 9, 6, 3); }
      else K.drawText(ctx, k, x + bw / 2, y + oy + 7, {color: cor, align: 'center'});
    });
    // A etiqueta da tranca, com a dica.
    const dica = String(d.dica || '').trim();
    const ty = dy + DH + 8, tw = 196, linhas = dica ? K.wrap(dica, tw - 24).length : 0;
    if (dica) {
      const th = Math.min(PAINEL.h - (ty - py) - 2, linhas * 11 + 12);
      const tx = snap(px + (W - tw) / 2);
      U.rect(ctx, tx + 4, ty + 4, tw, th, '#05020888');
      U.blit(ctx, papel('velho', tw / 2, Math.ceil(th / 2), 3), tx, ty);
      U.hand(ctx, dica, tx + 10, ty + 6, {color: C('tinta', 2), width: tw - 12, seed: 5, maxLines: Math.max(1, Math.floor((th - 6) / 11))});
      for (let i = 0; i < 6; i++) U.rect(ctx, tx + tw / 2 - 1, ty - 8 + i, 2, 1, C('papel', 3));
    }
  }

  /* ------------------------------------------------------------ painel do compartimento */
  function desenharConteudo(ctx, ui, st, clue, sys, i, px, py, vivo) {
    const comp = st.comps[i];
    if (!comp) return;
    const W = PAINEL.w, H = PAINEL.h, parte = st.G.partes[i] || {}, t = ui.t;
    U.rect(ctx, px + 6, py + 6, W, H, '#05020899');
    U.blit(ctx, interiorArt(parte.material || st.E.material, W / 2, H / 2), px, py);
    ui.region('painel', px, py, W, H, {cursor: 'default', silent: true});
    // Etiqueta com o nome do compartimento.
    const nome = nomeParte(st, i), tn = cortar(nome, W - 44), tw = snap(K.measure(tn) + 20);
    U.rect(ctx, px + 12, py + 12, tw, 17, '#07030a99');
    U.rect(ctx, px + 10, py + 10, tw, 17, C('amarelo', 5)); U.outline(ctx, px + 10, py + 10, tw, 17, C('amarelo', 1), 1);
    U.rect(ctx, px + 11, py + 25, tw - 2, 1, C('amarelo', 3));
    U.text(ctx, tn, px + 20, py + 15, {color: C('tinta', 0), bold: true});
    U.rect(ctx, px + 14, py + 17, 3, 3, C('amarelo', 2));
    // Texto num papel.
    const itens = restantes(st, i);
    const texto = comp.texto || (itens.length ? '' : String(clue.data.vazio || '').trim() || 'Vazio.');
    const pegoTudo = !comp.texto && !itens.length && comp.itens.length;
    const areaItens = itens.length ? 64 : 0, base = py + H - 30 - areaItens;
    let notaFim = py + 34;
    if (texto) {
      const nw = W - 28, linhas = K.wrap(pegoTudo ? 'Você já pegou tudo o que tinha aqui.' : texto, nw - 20), lh = 10;
      const cabe = Math.max(2, Math.floor((base - (py + 36) - 14) / lh));
      st.maxScroll = Math.max(0, linhas.length - cabe); st.scroll = clamp(st.scroll, 0, st.maxScroll);
      const mostra = linhas.slice(st.scroll, st.scroll + cabe), nh = mostra.length * lh + 14;
      const nx = px + 14, ny = snap(itens.length ? py + 36 : Math.max(py + 36, py + (H - 30 - nh) / 2 - 4));
      U.rect(ctx, nx + 4, ny + 4, nw, nh, '#05020888');
      U.blit(ctx, papel('velho', nw / 2, Math.ceil(nh / 2), 2 + i), nx, ny);
      mostra.forEach((l, k) => K.drawText(ctx, l, nx + 10, ny + 8 + k * lh, {color: C('tinta', 1)}));
      if (st.maxScroll) {
        const sx = nx + nw - 10;
        if (st.scroll > 0) { ui.region('subir', sx - 6, ny, 16, 14, {silent: true}); ctx.fillStyle = C('tinta', 2); for (let k = 0; k < 3; k++) ctx.fillRect(sx - k, ny + 4 + k, 1 + k * 2, 1); }
        if (st.scroll < st.maxScroll) { ui.region('descer', sx - 6, ny + nh - 14, 16, 14, {silent: true}); ctx.fillStyle = C('tinta', 2); for (let k = 0; k < 3; k++) ctx.fillRect(sx - k, ny + nh - 5 - k, 1 + k * 2, 1); }
      }
      notaFim = ny + nh;
    }
    // Itens: em cima do fundo do compartimento, com sombra; clique pega.
    if (itens.length) {
      const lista = itens.map(it => { const c = spriteItem(it.id), s = escalaItem(c, 100, 36); return {it, c, s, w: Math.max(c.width * s, 44), rot: cortar(nomeItem(it), 70)}; });
      const linhas = [[]];
      let larg = 0;
      for (const o of lista) {
        const ow = Math.max(o.w, K.measure(o.rot) + 4);
        if (larg + ow > W - 24 && linhas.at(-1).length) { linhas.push([]); larg = 0; }
        linhas.at(-1).push(o); larg += ow + 8; o.ow = ow;
      }
      const rows = linhas.slice(0, 2), rowH = rows.length > 1 ? 30 : 60;
      rows.forEach((row, r) => {
        const total = row.reduce((a, o) => a + o.ow + 8, -8);
        let x = snap(px + (W - total) / 2);
        const ybase = py + H - 34 - (rows.length - 1 - r) * rowH;
        for (const o of row) {
          const s = rows.length > 1 ? 1 : o.s, iw = o.c.width * s, ih = o.c.height * s;
          const ix = snap(x + (o.ow - iw) / 2), iy = snap(ybase - (rows.length > 1 ? 10 : 14) - ih);
          const tremendo = st.itemShake?.key === o.it.key && st.itemShake.t > 0 ? Math.round(Math.sin(st.itemShake.t * 80)) * 2 : 0;
          const hot = vivo && ui.region('item', ix - 4, iy - 4, iw + 8, ih + 18, {data: `${i}|${o.it.key}`, silent: true});
          const bob = hot ? -2 : 0;
          comSombra(ctx, o.c, ix + tremendo, iy + bob, s, {dx: 3, dy: hot ? 5 : 3, alfa: .5});
          if (hot) U.ants(ctx, ix - 4, iy - 4, iw + 8, ih + 8, t);
          if (rows.length === 1 || hot) {
            const lw = snap(K.measure(o.rot) + 6), lx = snap(ix + iw / 2 - lw / 2), ly = iy + ih + 4;
            U.rect(ctx, lx, ly, lw, 10, hot ? '#2a0d30ee' : '#0a0610cc');
            K.drawText(ctx, o.rot, lx + 3, ly + 2, {color: hot ? '#ffd18c' : TXT.claro});
          }
          x += o.ow + 8;
        }
      });
      if (linhas.length > 2) K.drawText(ctx, `+${linhas.slice(2).flat().length} itens embaixo`, px + 14, py + H - 20, {color: TXT.claro, shadow: {color: TXT.sombra, dx: 1, dy: 1}});
    }
    ui.button(ctx, 'fecharParte', px + W - 82, py + H - 26, 70, 18, st.E.fisico ? 'FECHAR' : 'VOLTAR', {style: 'papel'});
  }

  /* ------------------------------------------------------------ tranca no móvel */
  function desenharTranca(F) {
    const {ctx, G, st, clue, ui} = F, tr = G.tranca, des = st.destrancar;
    if (!tr || (!F.fechado && !des)) return;
    const x = F.X(tr.x), y = F.Y(tr.y);
    if (F.tranca === 'codigo') {
      const aberta = des?.tipo === 'codigo';
      U.rect(ctx, x - 12, y - 16, 28, 36, '#07030a66');
      U.blit(ctx, travaDigital(aberta), x - 14, y - 18);
      if (!aberta && Math.floor(F.t * 2) % 2) U.rect(ctx, x + 6, y + 10, 2, 2, C('vermelho', 6));
      if (F.fechado && !des && ui.region('cadeado', x - 16, y - 20, 32, 40, {silent: true})) U.ants(ctx, x - 18, y - 22, 36, 44, F.t);
      return;
    }
    const u = des?.tipo === 'chave' ? clamp(des.t / DUR.chave, 0, 1) : 0;
    const cai = u > .68 ? ease((u - .68) / .32) : 0;
    ctx.save();
    if (cai) ctx.globalAlpha = 1 - cai;
    if (tr.barra) {
      const [a, b2] = tr.barra;
      U.rect(ctx, x - 4, F.Y(a), 8, (b2 - a) * 2, C('metal', 2)); U.rect(ctx, x - 4, F.Y(a), 2, (b2 - a) * 2, C('metal', 4)); U.rect(ctx, x + 2, F.Y(a), 2, (b2 - a) * 2, C('metal', 1));
      for (const yy of [F.Y(a) + 4, F.Y(b2) - 8]) U.rect(ctx, x - 6, yy, 12, 4, C('metal', 3));
    }
    const by = y + snap(cai * 36), sobe = u > .5 ? 6 : 0;
    U.blit(ctx, cadeadoAlca(), x - 10, by - 14 - sobe);
    U.blit(ctx, cadeadoCorpo(), x - 12, by);
    if (u > 0 && u < .7) {
      const k = spriteItem('chave'), entra = ease(u / .3);
      ctx.save(); ctx.globalAlpha = Math.min(1, u * 6);
      if (u < .38) ctx.drawImage(k, snap(x + 26 - entra * 20), snap(by + 2 - 6), 16, 16);
      else { U.rect(ctx, x - 1, by + 2, 2, 12, C('latao', 5)); U.rect(ctx, x - 4, by - 2, 8, 6, C('latao', 4)); }
      ctx.restore();
    }
    ctx.restore();
    if (F.fechado && !des) {
      if (ui.region('cadeado', x - 16, by - 22, 32, 48, {silent: true})) U.ants(ctx, x - 18, by - 24, 36, 52, F.t);
      const dica = String(clue.data.dica || '').trim();
      if (dica) {
        const tw = 100, linhas = K.wrap(dica, tw - 22).slice(0, 5), th = linhas.length * 11 + 12;
        let tx = snap(Math.max(F.X(G.w) + 14, x + 18));
        if (tx + tw > SW - 6) tx = snap(F.X(0) - tw - 14);
        const ty = snap(clamp(by + 10, 30, SH - th - 8));
        ctx.fillStyle = C('papel', 3);
        const x0 = x + 2, y0 = by + 18, x1 = tx + (tx > x ? 6 : tw - 6), y1 = ty + 6;
        for (let s = 0; s <= 24; s++) { const q = s / 24; ctx.fillRect(snap(x0 + (x1 - x0) * q), snap(y0 + (y1 - y0) * q + Math.sin(q * Math.PI) * 6), 2, 2); }
        U.rect(ctx, tx + 4, ty + 4, tw, th, '#05020888');
        U.blit(ctx, papel('velho', tw / 2, Math.ceil(th / 2), 7), tx, ty);
        U.rect(ctx, tx + (tx > x ? 4 : tw - 8), ty + 4, 4, 4, C('papel', 2));
        U.hand(ctx, linhas.join('\n'), tx + 10, ty + 7, {color: C('tinta', 2), width: tw - 12, seed: 9});
      }
    }
  }

  /* ------------------------------------------------------------ o tipo */
  const OPCOES_ESTILO = [['gaveteiro', 'Gaveteiro (gavetas)'], ['arquivo', 'Arquivo de aço'], ['bancada', 'Bancada com gavetas'], ['armario', 'Armário de madeira'],
    ['armario_metal', 'Armário de metal (vestiário)'], ['guarda_roupa', 'Guarda-roupa'], ['geladeira', 'Geladeira'], ['caixa', 'Caixa de papelão'],
    ['lixeira', 'Lixeira'], ['cacamba', 'Caçamba de lixo'], ['sofa', 'Sofá (almofadas)'], ['cama', 'Cama (colchão, travesseiro)'], ['duto', 'Duto de ventilação'], ['bolsa', 'Bolsa (bolsos)']];

  ClueTypes.register('recipiente', {
    label: 'Recipiente (gavetas, armário…)', icon: icone('gaveta'), sound: 'clique', categoria: 'interacao',
    fields: [
      {id: 'titulo', label: 'Título (vazio = nome da pista)', kind: 'text'},
      {id: 'estilo', label: 'Estilo', kind: 'select', options: OPCOES_ESTILO},
      {id: 'compartimentos', label: 'Compartimentos: Nome | o que tem dentro | itens (um por linha; itens: moedas*3, chave=Porão, bandage)', kind: 'textarea', rows: 6},
      {id: 'tranca', label: 'Tranca', kind: 'select', options: [['nenhuma', 'Sem tranca'], ['chave', 'Chave'], ['codigo', 'Código (teclado numérico)']]},
      {id: 'chave', label: 'Nome da chave exigida (vazio = qualquer chave)', kind: 'text', placeholder: 'ex.: Porão'},
      {id: 'codigo', label: 'Código (só dígitos)', kind: 'text', placeholder: 'ex.: 0317'},
      {id: 'dica', label: 'Dica na etiqueta da tranca', kind: 'text'},
      {id: 'vazio', label: 'Texto quando não há nada', kind: 'text'}],
    defaults: {
      titulo: '', estilo: 'gaveteiro',
      compartimentos: 'Gaveta de cima | Canetas sem tinta, clipes e um recibo amassado de uma lanchonete. | moedas*2\nGaveta do meio | Pastas vazias. Numa delas, alguém escreveu PORÃO a lápis e depois apagou.\nGaveta de baixo | Um rolo de fita crepe e uma bandagem ainda na embalagem. | bandage',
      tranca: 'nenhuma', chave: '', codigo: '0000', dica: '', vazio: 'Vazio.'
    },
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      if (!Array.isArray(mem.abertos)) mem.abertos = [];
      if (!mem.pegos || typeof mem.pegos !== 'object' || Array.isArray(mem.pegos)) mem.pegos = {};
      const st = {mem, anim: {}, capa: mem.tampa ? 1 : 0, foco: -1, slide: 0, shake: 0, keyShake: 0, erroT: 0, piscar: 0, digitado: '', press: {}, conferirEm: 0,
        destrancar: null, voando: [], scroll: 0, maxScroll: 0, itemShake: null, painel: null, tip: null};
      preparar(st, clue);
      if (mem.aberto && !st.comps.some(c => c.key === mem.aberto)) mem.aberto = null;
      for (const c of st.comps) st.anim[c.key] = st.E.fisico && mem.aberto === c.key ? 1 : 0;
      if (st.E.fisico && mem.aberto) st.foco = st.comps.findIndex(c => c.key === mem.aberto);
      else if (st.E.capa && mem.tampa && st.comps.length === 1) st.foco = 0;
      st.slide = painelAlvo(st, clue) ? 1 : 0;
      if (st.slide) st.painel = {tipo: painelAlvo(st, clue), foco: st.foco};
      return st;
    },
    wantsKeys: (st, clue) => trancado(st, clue) && trancaDe(clue.data) === 'codigo' && !st.destrancar,
    describe: st => ({estilo: st.estilo, foco: st.foco, tampa: !!st.mem?.tampa, aberto: st.mem?.aberto || null, abertos: [...(st.mem?.abertos || [])], pegos: JSON.parse(JSON.stringify(st.mem?.pegos || {})),
      destrancado: !!st.mem?.destrancado, digitado: st.digitado, painel: st.slide > 0 ? st.painel?.tipo || null : null, compartimentos: st.comps?.length || 0}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt, t = ui.t;
      const comps = preparar(st, clue), E = st.E, G = st.G, mem = st.mem;
      // Animações.
      for (const c of comps) st.anim[c.key] = toward(st.anim[c.key] ?? 0, E.fisico && mem.aberto === c.key ? 1 : 0, 1 / .3, dt);
      st.capa = toward(st.capa, mem.tampa ? 1 : 0, 1 / .5, dt);
      for (const k of ['shake', 'keyShake', 'erroT', 'piscar']) st[k] = Math.max(0, st[k] - dt);
      for (const k in st.press) st.press[k] = Math.max(0, st.press[k] - dt);
      if (st.itemShake) st.itemShake.t -= dt;
      if (st.conferirEm > 0) { st.conferirEm -= dt; if (st.conferirEm <= 0) this.conferir(st, clue, sys); }
      if (st.destrancar) { st.destrancar.t += dt; if (st.destrancar.t >= DUR[st.destrancar.tipo]) this.concluir(st, clue, sys); }
      const alvo = painelAlvo(st, clue);
      if (alvo) st.painel = {tipo: alvo, foco: st.foco};
      st.slide = toward(st.slide, alvo ? 1 : 0, 1 / .32, dt);
      st.tip = null;
      // Fundo e móvel.
      U.blit(ctx, fundoArt(E.fundo), 0, 22);
      // Quanto o móvel aberto ocupa além do corpo (portas, abas), para caber ao lado do painel.
      const [eL, eR] = G.ext || (G.portas ? [
        Math.max(0, ...G.portas.filter(p => p.dir > 0).map(p => -Math.cos((p.abre || 110) * GRAU) * p.w)),
        Math.max(0, ...G.portas.filter(p => p.dir < 0).map(p => -Math.cos((p.abre || 110) * GRAU) * p.w))] : [0, 0]);
      const minC = 8 + G.w + eL * 2, maxC = PAINEL.x - 8 - G.w - eR * 2;
      const e = easeIO(st.slide), cx = CENTRO + (Math.max(minC, Math.min(maxC, COLUNA)) - CENTRO) * e;
      const tremor = st.shake > 0 ? Math.round(Math.sin(st.shake * 70) * 1.5) * 2 : 0;
      const ox = snap(cx - G.w + (eL - eR) * easeIO(st.capa) + tremor), oy = snap((E.chaoY ?? CHAO_Y) - G.base * 2);
      const F = {ctx, ui, t, dt, st, clue, sys, E, G, comps, n: comps.length, mem, ox, oy, fechado: trancado(st, clue), tranca: trancaDe(d),
        X: a => ox + a * 2, Y: a => oy + a * 2,
        aberto: i => ease(st.anim[comps[i]?.key] ?? 0), capa: easeIO(st.capa), seed: seedOf(clue.id),
        itens: i => restantes(st, i),
        parte: (i, x, y, w, h) => ui.region('parte', x, y, w, h, {data: i, silent: true}),
        interior: (i, x, y, w, h) => ui.region('interior', x, y, w, h, {data: i, silent: true}),
        capaRegiao: (x, y, w, h) => ui.region('capa', x, y, w, h, {silent: true}),
        rotulo: (i, x, y, maxW) => rotuloParte(F, i, x, y, maxW),
        miudos: (i, x, y, w, h, o) => miudos(F, i, x, y, w, h, o)};
      ui.region('movel', F.X(-4), F.Y(-2), (G.w + 8) * 2, (G.h + 4) * 2, {cursor: 'default', silent: true});
      F.itensRegioes = [];
      try { E.desenhar(F); } catch (erro) { console.error('Recipiente: estilo falhou', erro); }
      for (const [x, y, w, h, data] of F.itensRegioes) ui.region('item', x, y, w, h, {data, silent: true});
      desenharTranca(F);
      // Itens voando para a bolsa.
      st.voando = st.voando.filter(v => (v.t += dt) < .6);
      for (const v of st.voando) {
        const u = v.t / .6;
        ctx.save(); ctx.globalAlpha = 1 - u * u;
        const s = u < .5 ? 2 : 1;
        ctx.drawImage(v.c, snap(v.x - v.c.width * s / 2 + u * 30), snap(v.y - v.c.height * s / 2 - ease(u) * 50), v.c.width * s, v.c.height * s);
        ctx.restore();
      }
      // Painel.
      if (st.painel && st.slide > 0) {
        const px = snap(PAINEL.x + (1 - e) * (SW - PAINEL.x + 12)), vivo = st.slide >= 1;
        if (st.painel.tipo === 'teclado') desenharTeclado(ctx, ui, st, clue, sys, px, PAINEL.y, vivo);
        else desenharConteudo(ctx, ui, st, clue, sys, st.painel.foco, px, PAINEL.y, vivo);
      }
      if (st.tip && ui.mouse.x >= 0) U.tooltip(ctx, st.tip.texto, st.tip.x, st.tip.y);
      const titulo = String(d.titulo || '').trim() || clue.name;
      let dica = '';
      if (st.destrancar) dica = 'destrancando…';
      else if (F.fechado) dica = F.tranca === 'codigo' ? 'trancado · digite o código' : 'trancado · clique para usar a chave';
      else if (E.capa && !mem.tampa) dica = E.dicaCapa || 'clique para abrir';
      else if (st.slide > .5 && st.painel?.tipo === 'parte') dica = restantes(st, st.painel.foco).length ? 'clique nos itens para pegar' : '';
      else dica = E.dica || 'clique num compartimento para abrir';
      U.header(ctx, ui, titulo, dica, icone('gaveta'));
    },
    somAbrir: (E, p) => p?.som || E.som,
    clicarParte(i, st, clue, sys) {
      const E = st.E, mem = st.mem, c = st.comps[i];
      if (!c || st.destrancar) return;
      if (trancado(st, clue)) { this.tentarAbrir(st, clue, sys, i); return; }
      if (E.capa && !mem.tampa) { this.alternarCapa(st, clue, sys); return; }
      const p = st.G.partes[i];
      if (!mem.abertos.includes(c.key)) mem.abertos.push(c.key);
      if (!E.fisico) {
        if (st.foco === i) st.foco = -1; else { st.foco = i; st.scroll = 0; }
        sys.sfx('clique');
      } else if (mem.aberto !== c.key) { mem.aberto = c.key; st.foco = i; st.scroll = 0; sys.sfx(this.somAbrir(E, p)); }
      else if (st.foco !== i) { st.foco = i; st.scroll = 0; sys.sfx('clique'); }
      else { mem.aberto = null; st.foco = -1; sys.sfx(this.somAbrir(E, p)); }
      sys.emit('change');
    },
    alternarCapa(st, clue, sys) {
      if (st.destrancar) return;
      if (trancado(st, clue)) { this.tentarAbrir(st, clue, sys, null); return; }
      const mem = st.mem;
      mem.tampa = !mem.tampa;
      if (mem.tampa) {
        if (st.comps.length === 1) { st.foco = 0; st.scroll = 0; if (!mem.abertos.includes(st.comps[0].key)) mem.abertos.push(st.comps[0].key); }
      } else st.foco = -1;
      sys.sfx(st.E.som);
      sys.emit('change');
    },
    tentarAbrir(st, clue, sys, alvo) {
      if (trancaDe(clue.data) === 'codigo') { st.keyShake = .4; st.piscar = .8; st.shake = .3; sys.sfx('tranca'); return; }
      const nome = String(clue.data.chave || '').trim(), bolsa = sys.itens;
      let tem = false;
      try {
        if (!bolsa) tem = true;
        else if (typeof bolsa.temChave === 'function') tem = !!bolsa.temChave(nome) || (!nome && (bolsa.contar?.('chave') || 0) > 0);
        else tem = (bolsa.contar?.('chave') || 0) > 0;
      } catch (erro) { console.error(erro); tem = false; }
      if (tem) { st.destrancar = {tipo: 'chave', t: 0, alvo, previa: !bolsa}; sys.sfx('destranca'); }
      else { st.shake = .45; sys.sfx('tranca'); sys.toast('TRANCADO', nome ? `Falta a chave: ${nome}` : 'Precisa de uma chave', 'cadeado'); }
    },
    concluir(st, clue, sys) {
      const des = st.destrancar;
      st.destrancar = null; st.mem.destrancado = true; st.digitado = '';
      const nome = String(clue.data.chave || '').trim();
      if (des.tipo === 'chave') sys.toast('DESTRANCADO', des.previa ? 'Prévia sem bolsa' : nome ? `Chave: ${nome}` : 'A chave serviu', icone('chave'));
      else sys.toast('DESTRANCADO', 'Código certo', 'cadeado');
      sys.emit('change');
      if (des.tipo === 'chave') {
        if (st.E.capa) { if (!st.mem.tampa) this.alternarCapa(st, clue, sys); }
        else if (des.alvo != null) this.clicarParte(des.alvo, st, clue, sys);
      }
    },
    tecla(k, st, clue, sys) {
      if (!trancado(st, clue) || trancaDe(clue.data) !== 'codigo' || st.destrancar) return;
      const code = codigoTranca(clue.data.codigo);
      st.press[k] = .14; st.erroT = 0;
      if (k === '<') { st.digitado = st.digitado.slice(0, -1); st.conferirEm = 0; sys.sfx('tecla'); return; }
      if (k === 'OK') { if (st.digitado) this.conferir(st, clue, sys); else sys.sfx('erro'); return; }
      if (!/^\d$/.test(k) || st.conferirEm > 0) return;
      if (st.digitado.length >= code.length) st.digitado = '';
      st.digitado += k; sys.sfx('tecla');
      if (st.digitado.length === code.length) st.conferirEm = .3;
    },
    conferir(st, clue, sys) {
      st.conferirEm = 0;
      if (!trancado(st, clue) || st.destrancar) return;
      if (st.digitado === codigoTranca(clue.data.codigo)) { st.destrancar = {tipo: 'codigo', t: 0}; sys.sfx('destranca'); }
      else { st.keyShake = .4; st.erroT = .9; st.digitado = ''; sys.sfx('erro'); }
    },
    pegar(i, key, st, clue, sys, info) {
      const c = st.comps[i];
      if (!c || trancado(st, clue) || (st.E.capa && !st.mem.tampa)) return;
      const it = c.itens.find(x => x.key === key), pegos = st.mem.pegos[c.key] ||= [];
      if (!it || pegos.includes(key)) return;
      const r = entregar(sys, it, 'PEGOU');
      if (r === 'bolsa' || r === 'chao') {
        pegos.push(key);
        st.voando.push({c: spriteItem(it.id), x: info?.x ?? SW / 2, y: info?.y ?? SH / 2, t: 0});
        sys.emit('change');
      } else st.itemShake = {key, t: .35};
    },
    action(id, st, clue, sys, info = {}) {
      preparar(st, clue);
      const dado = info.data;
      switch (id) {
        case 'parte': this.clicarParte(Number(dado), st, clue, sys); break;
        case 'interior': if (st.foco !== Number(dado)) { st.foco = Number(dado); st.scroll = 0; sys.sfx('clique'); } break;
        case 'capa': this.alternarCapa(st, clue, sys); break;
        case 'cadeado': if (trancaDe(clue.data) === 'codigo') { st.keyShake = .4; st.piscar = .8; sys.sfx('tranca'); } else this.tentarAbrir(st, clue, sys, null); break;
        case 'item': { const s = String(dado), k = s.indexOf('|'); this.pegar(Number(s.slice(0, k)), s.slice(k + 1), st, clue, sys, info); break; }
        case 'tecla': this.tecla(String(dado), st, clue, sys); break;
        case 'fecharParte': {
          const c = st.comps[st.foco];
          if (c && st.E.fisico && st.mem.aberto === c.key) { st.mem.aberto = null; sys.sfx(this.somAbrir(st.E, st.G.partes[st.foco])); sys.emit('change'); }
          st.foco = -1;
          break;
        }
        case 'subir': st.scroll = Math.max(0, st.scroll - 1); break;
        case 'descer': st.scroll = Math.min(st.maxScroll, st.scroll + 1); break;
      }
    },
    wheel(delta, st) { st.scroll = clamp(st.scroll + Math.sign(delta), 0, st.maxScroll || 0); },
    key(e, st, clue, sys) {
      preparar(st, clue);
      if (trancado(st, clue) && trancaDe(clue.data) === 'codigo' && !st.destrancar) {
        if (/^\d$/.test(e.key)) { this.tecla(e.key, st, clue, sys); return true; }
        if (e.key === 'Backspace' || e.key === 'Delete') { this.tecla('<', st, clue, sys); return true; }
        if (e.key === 'Enter') { this.tecla('OK', st, clue, sys); return true; }
      }
      if (st.foco >= 0) {
        if (e.key === 'Escape') { st.foco = -1; return true; }
        if (e.key === 'ArrowDown') { st.scroll = Math.min(st.maxScroll || 0, st.scroll + 1); return true; }
        if (e.key === 'ArrowUp') { st.scroll = Math.max(0, st.scroll - 1); return true; }
      }
      return false;
    }
  });

  /* ================================================================ exame */
  const FUNDOS_EXAME = [['mesa', 'Feltro da mesa'], ['madeira', 'Tampo de madeira'], ['escuro', 'Veludo escuro']];
  const fundoExame = tipo => U.art('ib:exame:fundo:' + tipo, 218, 113, b => {
    const W = 218, H = 113, R = K.rng(seedOf(tipo));
    if (tipo === 'madeira') {
      b.rect(0, 0, W, H, 'madeira', 3);
      for (let y = 0, i = 0; y < H; y += 14, i++) { b.hline(0, W - 1, y, 'madeira', 1); veios(b, 0, y + 1, W, 13, 'madeira', 3, i + 2, 1); for (let x = (i * 53) % 90; x < W; x += 90) b.vline(x, y, Math.min(H - 1, y + 13), 'madeira', 1); }
    } else if (tipo === 'escuro') {
      b.rect(0, 0, W, H, 'roxo', 1); b.speckle(0, 0, W, H, 'roxo', 2, .06, R);
      for (let x = 0; x < W; x += 9) b.vline(x, 0, H - 1, 'roxo', 0);
    } else {
      b.rect(0, 0, W, H, 'feltro', 2); b.speckle(0, 0, W, H, 'feltro', 3, .08, R);
      for (let x = 3; x < W - 3; x += 3) { b.px(x, 3, 'feltro', 5); b.px(x, H - 4, 'feltro', 1); }
      for (let y = 3; y < H - 3; y += 3) { b.px(3, y, 'feltro', 5); b.px(W - 4, y, 'feltro', 1); }
    }
    b.shadeFn(0, 0, W, H, (x, y) => faixas((.62 - Math.hypot((x - 64) / 130, (y - 56) / 90)) * 2.4));
  });
  /* Desenho de reserva quando a cena não manda a pintura do objeto: uma caixinha
     de madeira entreaberta, com cantoneiras e etiqueta. */
  const reservaExame = () => U.art('ib:exame:reserva', 64, 58, b => {
    b.rect(6, 28, 52, 26, 'mogno', 3); veios(b, 7, 29, 50, 24, 'mogno', 3, 5); b.hline(6, 57, 28, 'mogno', 5); b.vline(57, 28, 53, 'mogno', 4); b.vline(6, 28, 53, 'mogno', 2); b.hline(6, 57, 53, 'mogno', 1);
    b.rect(6, 26, 52, 2, 'preto', 0); b.hline(14, 50, 27, 'amarelo', 6, K.EMISSIVE);
    b.poly([[12, 10], [62, 10], [58, 22], [6, 22]], 'mogno', 4); veios(b, 10, 12, 48, 9, 'mogno', 4, 8); b.hline(12, 61, 10, 'mogno', 6);
    b.rect(6, 22, 52, 4, 'mogno', 5); b.hline(6, 57, 25, 'mogno', 2);
    for (const [x, y] of [[6, 46], [52, 46], [6, 28], [52, 28]]) { b.rect(x, y, 6, 2, 'latao', 4); b.rect(x + (x > 30 ? 4 : 0), y + (y > 40 ? -4 : 0), 2, 6, 'latao', 4); }
    b.rect(28, 34, 8, 11, 'latao', 4); b.hline(28, 35, 34, 'latao', 6); b.ellipse(32, 38, 1.4, 1.4, 'preto', 0); b.vline(32, 39, 42, 'preto', 0);
    b.line(55, 34, 58, 44, 'papel', 3); b.rect(52, 44, 11, 13, 'papel', 6); b.hline(52, 62, 44, 'papel', 7); b.px(57, 46, 'mogno', 1); b.hline(54, 60, 50, 'tinta', 3); b.hline(54, 58, 53, 'tinta', 3);
    contorno(b, 'carvao', 0);
  });

  ClueTypes.register('exame', {
    label: 'Examinar de perto', icon: 'lupa', sound: 'objeto', categoria: 'interacao',
    fields: [
      {id: 'texto', label: 'Descrição', kind: 'textarea'},
      {id: 'detalhe', label: 'Detalhe (aparece à mão quando clicam no objeto)', kind: 'textarea'},
      {id: 'item', label: 'Item achado uma vez ao examinar (ex.: moedas*2 ou chave=Depósito)', kind: 'text'},
      {id: 'fundo', label: 'Fundo', kind: 'select', options: FUNDOS_EXAME}],
    defaults: {texto: 'Parece comum à primeira vista. Mas algo nele chama a atenção.', detalhe: '', item: '', fundo: 'mesa'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      let arte = null;
      try { const a = sys.arteObjeto?.(clue); if (a?.canvas?.width) arte = {canvas: a.canvas, w: a.w || a.canvas.width, h: a.h || a.canvas.height}; } catch (erro) { console.error('arteObjeto falhou:', erro); }
      // O brilho nasce no pixel pintado mais alto e à direita.
      let brilho = arte ? [arte.w - 1, 0] : [58, 11];
      if (arte) try {
        const g = arte.canvas.getContext('2d'), px = g.getImageData(0, 0, arte.w, arte.h).data;
        let melhor = -Infinity;
        for (let y = 0; y < arte.h; y++) for (let x = 0; x < arte.w; x++) if (px[(y * arte.w + x) * 4 + 3] > 0 && x - y * 1.5 > melhor) { melhor = x - y * 1.5; brilho = [x, y]; }
      } catch (erro) { /* canvas sem leitura: fica no canto */ }
      return {mem, arte, brilho, scroll: 0, maxScroll: 0};
    },
    itens: (clue, st) => parseItens(clue.data.item).filter(it => !(st.mem.itensPegos || []).includes(it.key)),
    pendente(clue, st) { return (!!String(clue.data.detalhe || '').trim() && !st.mem.examinado) || (!st.mem.pego && this.itens(clue, st).length > 0); },
    describe: st => ({examinado: !!st.mem?.examinado, pego: !!st.mem?.pego, arte: !!st.arte, scroll: st.scroll}),
    render(ctx, ui, st, clue, sys, entry) {
      const d = clue.data || {}, t = ui.t, seed = seedOf(clue.id);
      const X = 22, Y = 32, W = 436, H = 226;
      U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
      U.blit(ctx, fundoExame(FUNDOS_EXAME.some(f => f[0] === d.fundo) ? d.fundo : 'mesa'), X, Y);
      // O objeto ampliado, com sombra.
      const src = st.arte ? st.arte.canvas : reservaExame(), aw = st.arte ? st.arte.w : 64, ah = st.arte ? st.arte.h : 58;
      let s = clamp(Math.floor(Math.min(200 / aw, 180 / ah)), 2, 6);
      if (aw * s > 232 || ah * s > 212) s = 1;
      const ow = aw * s, oh = ah * s, cx = 146, cy = 146;
      const ox = snap(cx - ow / 2), oy = snap(cy - oh / 2 + Math.round(Math.max(0, .25 - entry.age) * 24));
      const pendente = this.pendente(clue, st);
      const hot = ui.region('objeto', ox - 8, oy - 8, ow + 16, oh + 16, {cursor: pendente ? 'lupa' : 'default', silent: true});
      ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.globalAlpha = .45; ctx.drawImage(silhueta(src), ox + 8, oy + 8, ow, oh); ctx.restore();
      ctx.drawImage(src, 0, 0, aw, ah, ox, oy, ow, oh);
      if (hot && pendente) U.ants(ctx, ox - 6, oy - 6, ow + 12, oh + 12, t);
      if (!st.mem.pego && this.itens(clue, st).length) {
        const fase = (t * 1.1) % 1.6;
        if (fase < 1) {
          const tam = Math.round((fase < .5 ? fase : 1 - fase) * 10), bx = snap(ox + st.brilho[0] * s + s / 2), by = snap(oy + st.brilho[1] * s + s / 2);
          ctx.fillStyle = '#fff6c9'; ctx.fillRect(bx, by - tam * 2, 2, tam * 4 + 2); ctx.fillRect(bx - tam * 2, by, tam * 4 + 2, 2);
          ctx.fillStyle = '#ffd36b'; ctx.fillRect(bx, by, 2, 2);
        }
      }
      // Cartão com o nome, a descrição, o detalhe e o que foi achado.
      const TX = 262, TY = 46, TW = 186, iw = TW - 26;
      const texto = String(d.texto || '').trim() || this.defaults.texto, detalhe = String(d.detalhe || '').trim();
      const linhas = K.wrap(texto, iw), det = st.mem.examinado && detalhe ? K.wrap(detalhe, iw - 8).length : 0;
      const achados = parseItens(d.item).filter(it => (st.mem.itensPegos || []).includes(it.key));
      const hc = linhas.length * 11 + (det ? 8 + det * 12 : 0) + (achados.length ? 10 + achados.length * 20 : 0);
      const maxBody = 250 - (TY + 34) - 8, vis = Math.min(hc, maxBody), TH = snap(34 + vis + 12);
      st.maxScroll = Math.max(0, Math.ceil((hc - maxBody) / 11)); st.scroll = clamp(st.scroll, 0, st.maxScroll);
      U.rect(ctx, TX + 4, TY + 4, TW, TH, '#05020899');
      U.blit(ctx, papel('velho', TW / 2, TH / 2, seed % 5), TX, TY);
      U.rect(ctx, TX - 10, TY + 16, 12, 2, C('papel', 3));
      U.text(ctx, cortar(clue.name.toUpperCase(), iw), TX + 12, TY + 12, {color: C('tinta', 1), bold: true});
      U.rect(ctx, TX + 12, TY + 23, TW - 24, 1, C('tinta', 3));
      ctx.save(); ctx.beginPath(); ctx.rect(TX, TY + 29, TW, vis + 6); ctx.clip();
      let y = TY + 32 - st.scroll * 11;
      linhas.forEach(l => { K.drawText(ctx, l, TX + 12, y, {color: C('tinta', 1)}); y += 11; });
      if (det) { y += 8; U.hand(ctx, detalhe, TX + 14, y, {color: C('vermelho', 3), width: iw, lineHeight: 12, seed}); y += det * 12; }
      if (achados.length) {
        y += 10;
        for (const it of achados) { const c = spriteItem(it.id); ctx.drawImage(c, TX + 12, y, Math.min(16, c.width), Math.min(16, c.height)); K.drawText(ctx, 'Achou: ' + cortar(nomeItem(it), iw - 60), TX + 34, y + 5, {color: C('verde', 2)}); y += 20; }
      }
      ctx.restore();
      if (st.maxScroll) {
        const sx = TX + TW - 10;
        if (st.scroll > 0) { ui.region('subir', sx - 6, TY + 26, 16, 14, {silent: true}); ctx.fillStyle = C('tinta', 2); for (let k = 0; k < 3; k++) ctx.fillRect(sx - k, TY + 30 + k, 1 + k * 2, 1); }
        if (st.scroll < st.maxScroll) { ui.region('descer', sx - 6, TY + TH - 16, 16, 14, {silent: true}); ctx.fillStyle = C('tinta', 2); for (let k = 0; k < 3; k++) ctx.fillRect(sx - k, TY + TH - 8 - k, 1 + k * 2, 1); }
      }
      U.header(ctx, ui, clue.name, pendente ? 'clique no objeto para examinar de perto' : st.maxScroll ? 'role para ler tudo' : '', 'lupa');
    },
    action(id, st, clue, sys) {
      if (id === 'subir') st.scroll = Math.max(0, st.scroll - 1);
      if (id === 'descer') st.scroll = Math.min(st.maxScroll, st.scroll + 1);
      if (id !== 'objeto' || !this.pendente(clue, st)) return;
      if (String(clue.data.detalhe || '').trim() && !st.mem.examinado) { st.mem.examinado = true; sys.sfx('lupa'); }
      const pegos = st.mem.itensPegos ||= [];
      for (const it of this.itens(clue, st)) {
        const r = entregar(sys, it, 'ENCONTROU');
        if (r === 'bolsa' || r === 'chao') pegos.push(it.key);
      }
      if (!this.itens(clue, st).length && parseItens(clue.data.item).length) st.mem.pego = true;
      sys.emit('change');
    },
    wheel(delta, st) { st.scroll = clamp(st.scroll + Math.sign(delta), 0, st.maxScroll); },
    key(e, st) {
      if (e.key === 'ArrowDown') { st.scroll = Math.min(st.maxScroll, st.scroll + 1); return true; }
      if (e.key === 'ArrowUp') { st.scroll = Math.max(0, st.scroll - 1); return true; }
      return false;
    }
  });

  /* ================================================================ interruptor */
  const paredeInterruptor = aceso => U.art('ib:interruptor:parede:' + aceso, 110, 108, b => {
    b.rect(0, 0, 110, 108, aceso ? 'papelVelho' : 'carvao', aceso ? 4 : 2);
    for (let x = 0; x < 110; x += 11) b.vline(x, 0, 107, aceso ? 'papelVelho' : 'carvao', aceso ? 3 : 1);
    b.speckle(0, 0, 110, 108, aceso ? 'papelVelho' : 'carvao', aceso ? 5 : 3, .03, K.rng(3));
    b.shadeFn(0, 0, 110, 108, (x, y) => faixas((aceso ? .7 : .45) - Math.hypot((x - 62) / 90, (y - 40) / 80) * 2));
  });
  const placaInterruptor = () => U.art('ib:interruptor:placa', 40, 62, b => {
    b.rect(0, 0, 40, 62, 'papel', 5); b.hline(1, 38, 0, 'papel', 6); b.vline(39, 1, 60, 'papel', 6); b.hline(1, 38, 61, 'papel', 3); b.vline(0, 1, 60, 'papel', 4);
    for (const [x, y] of [[0, 0], [39, 0], [0, 61], [39, 61]]) b.erase(x, y, 1, 1);
    b.inset(3, 3, 34, 56, 'papel', 5, 6, 4);
    for (const y of [7, 54]) { b.ellipse(20, y, 2.4, 2.4, 'latao', 4); b.hline(18, 22, y, 'latao', 1); b.px(21, y - 2, 'latao', 6); }
    b.inset(16, 19, 8, 24, 'papel', 1, 4, 0); b.rect(17, 20, 6, 22, 'preto', 1);
    b.text(20, 13, 'LIGA', 'papel', 3, {font: '3x5', align: 'center'}); b.text(20, 45, 'DESL', 'papel', 3, {font: '3x5', align: 'center'});
  });
  ClueTypes.register('interruptor', {
    label: 'Interruptor', icon: icone('interruptor'), sound: 'clique', categoria: 'interacao', veil: .5,
    fields: [
      {id: 'alvo', label: 'Estado que alterna (luzes, energia ou um estado do objeto, ex.: ligada)', kind: 'text'},
      {id: 'som', label: 'Som ao clicar', kind: 'text'}],
    defaults: {alvo: 'luzes', som: 'interruptor'},
    /* O clique na cena: alterna e pronto, sem abrir interface. */
    activate(clue, sys) {
      const id = alvoInterruptor(clue, sys);
      try { sys.setProp(id, !sys.hasProp(id)); } catch (erro) { console.error('Interruptor falhou:', erro); }
      sys.sfx(String(clue?.data?.som ?? '').trim() || 'interruptor');
      return true;
    },
    create(clue, sys) { const id = alvoInterruptor(clue, sys); return {id, alav: sys.hasProp(id) ? 1 : 0}; },
    describe: st => ({alvo: st.id, alavanca: +st.alav.toFixed(2)}),
    render(ctx, ui, st, clue, sys) {
      const id = alvoInterruptor(clue, sys), on = !!sys.hasProp(id), t = ui.t;
      st.id = id; st.alav = toward(st.alav, on ? 1 : 0, 7, ui.dt);
      const PX = 130, PY = 36;
      U.rect(ctx, PX + 6, PY + 6, 220, 216, '#05020899');
      U.blit(ctx, paredeInterruptor(on), PX, PY);
      U.outline(ctx, PX, PY, 220, 216, on ? C('papelVelho', 2) : C('carvao', 0), 2);
      const bx = 200, by = 72, hot = ui.region('placa', bx - 8, by - 8, 96, 140, {silent: true});
      U.rect(ctx, bx + 6, by + 6, 80, 124, '#07030a66');
      U.blit(ctx, placaInterruptor(), bx, by);
      if (hot) U.outline(ctx, bx - 4, by - 4, 88, 132, '#ffd18c', 2);
      // A alavanca: aponta para cima (ligado) ou para baixo; no meio do caminho, vira para quem olha.
      const px = bx + 40, py = by + 62, k = st.alav * 2 - 1, len = Math.round(Math.abs(k) * 15) * 2, dir = k >= 0 ? -1 : 1;
      for (let j = 0; j < len; j += 2) { const yy = py + dir * j - (dir < 0 ? 2 : 0); U.rect(ctx, px - 4, yy, 8, 2, C('metal', 4)); U.rect(ctx, px - 4, yy, 2, 2, C('metal', 2)); U.rect(ctx, px + 2, yy, 2, 2, C('metal', 6)); }
      const kx = px, ky = py + dir * len, r = 6 + Math.round((1 - Math.abs(k)) * 2);
      for (let yy = -r; yy < r; yy += 2) for (let xx = -r; xx < r; xx += 2) { const dd = Math.hypot(xx + 1, yy + 1); if (dd <= r) U.rect(ctx, kx + xx, ky + yy, 2, 2, dd > r - 2 ? C('metal', 2) : xx + yy < -4 ? C('metal', 7) : C('metal', 5)); }
      if (!on) { ctx.save(); ctx.globalAlpha = .55 + Math.sin(t * 3) * .25; U.rect(ctx, bx + 38, by + 104, 4, 4, C('fosforo', 6)); ctx.restore(); }
      // Etiqueta: o que este interruptor controla.
      const prop = sys.stage?.scene?.props?.find?.(p => p && p.id === id);
      const nome = cortar(prop?.label || id, 180), estado = on ? 'LIGADO' : 'DESLIGADO';
      const tw = snap(Math.max(K.measure(nome), K.measure(estado)) + 24), tx = snap(240 - tw / 2), ty = 214;
      U.rect(ctx, tx + 3, ty + 3, tw, 30, '#05020899');
      U.blit(ctx, papel('papel', tw / 2, 15, 4), tx, ty);
      K.drawText(ctx, nome, 240, ty + 6, {color: C('tinta', 1), align: 'center'});
      K.drawText(ctx, estado, 240, ty + 18, {color: on ? C('verde', 2) : C('vermelho', 2), align: 'center'});
      U.header(ctx, ui, clue.name, on ? 'ligado · clique na placa para desligar' : 'desligado · clique na placa para ligar', icone('interruptor'));
    },
    action(id, st, clue, sys) { if (id === 'placa') this.activate(clue, sys); },
    key(e, st, clue, sys) { if (e.key === 'Enter' || e.key === ' ') { this.activate(clue, sys); return true; } return false; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
