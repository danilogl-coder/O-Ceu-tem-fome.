/* Interações de comida e água — as coisas que matam a fome e a sede no cenário.

   Cinco tipos de pista, cada um com a SUA interface em pixel art (nada de
   reaproveitar a “caixa” de recipiente para o que não é caixa):

   - fonte_agua  bebedouro de pressão, bebedouro de galão, torneira de parede,
                 pia de cozinha, pia de banheiro, filtro de barro, chafariz,
                 bica de bambu, poço de manivela, córrego, cocho, chuveiro,
                 mangueira e vaso sanitário. Cada estilo é desenhado como o
                 objeto que é, em close-up, com os botões grandes de ação ao
                 lado (Beber, Encher garrafa, Lavar o rosto, Dar descarga…) e
                 as partes clicáveis no próprio desenho (torneira, manivela,
                 descarga, armário embaixo da pia).
   - cozinha     fogão, fogareiro, chapa, fogueira, cafeteira, micro-ondas,
                 sanduicheira, chaleira e bancada: caderno de receitas à
                 esquerda, a estação em close-up no meio, a barra de ponto
                 (CRU → NO PONTO → QUEIMADO) e a bandeja de ingredientes da
                 bolsa embaixo.
   - servir      garrafa térmica, bule, jarra, panela e máquina de café.
   - vendedor    carrinho de pipoca, carrinho de coco, estufa de lanchonete,
                 balcão de padaria, mesa do cafezinho e ambulante.
   - arvore_fruta  sem tela cheia: o personagem estica o braço e colhe.

   A lógica de comida (efeitos, receitas, preparo) mora em `comidas.js`; aqui
   fica o que se vê, o que se ouve e o que o clique faz. */
(function (root) {
  'use strict';

  /* ================================================================ dados
     Funções puras: rodam no Node (testes) e no navegador. */
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const chave = s => semAcento(s).trim().toLowerCase();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inteiro = (v, padrao, min = -Infinity, max = Infinity) => {
    const n = Math.round(Number(String(v ?? '').replace(',', '.')));
    return Number.isFinite(n) ? clamp(n, min, max) : padrao;
  };
  const texto = (v, padrao = '') => (typeof v === 'string' && v.trim() ? v : padrao);

  /* ---- fontes de água ----
     `anim` é o estilo do pedido de consumo que `consumo.js` sabe animar. */
  const FONTES = {
    bebedouro: {nome: 'Bebedouro', anim: 'bebedouro', altura: 'media', qualidade: 'potavel', som: 'bebedouro', eletrica: true,
      acoes: ['beber', 'encher'], texto: 'Bebedouro de pressão, de inox. O jato sai forte.'},
    bebedouro_galao: {nome: 'Bebedouro de galão', anim: 'torneira', altura: 'media', qualidade: 'potavel', som: 'galao', eletrica: true,
      acoes: ['beber', 'encher'], texto: 'Galão de vinte litros e um copinho de plástico.'},
    torneira: {nome: 'Torneira', anim: 'torneira', altura: 'baixa', qualidade: 'potavel', som: 'torneira',
      acoes: ['beber', 'encher', 'rosto'], texto: 'Torneira de parede, dessas de mangueira.'},
    pia: {nome: 'Pia', anim: 'torneira', altura: 'media', qualidade: 'potavel', som: 'torneira',
      acoes: ['beber', 'encher', 'rosto', 'armario'], texto: 'A torneira range ao abrir; a água sai limpa.'},
    filtro_barro: {nome: 'Filtro de barro', anim: 'torneira', altura: 'baixa', qualidade: 'potavel', som: 'filtro',
      acoes: ['beber', 'encher'], texto: 'Filtro de barro, daqueles de vela. A água sai fresca.'},
    chafariz: {nome: 'Chafariz', anim: 'maos', altura: 'media', qualidade: 'duvidosa', som: 'chafariz',
      acoes: ['beber', 'encher', 'rosto'], texto: 'Água correndo em círculo desde sempre, com moedas no fundo.'},
    bica: {nome: 'Bica', anim: 'maos', altura: 'media', qualidade: 'potavel', som: 'bica',
      acoes: ['beber', 'encher', 'rosto'], texto: 'Água de nascente escorrendo por um bambu.'},
    poco: {nome: 'Poço', anim: 'balde', altura: 'media', qualidade: 'duvidosa', som: 'poco', balde: true,
      acoes: ['balde', 'beber', 'encher'], texto: 'Poço fundo, de manivela. Lá embaixo, um espelho preto.'},
    corrego: {nome: 'Córrego', anim: 'maos', altura: 'chao', qualidade: 'duvidosa', som: 'corrego',
      acoes: ['beber', 'encher', 'rosto'], texto: 'Água correndo entre as pedras.'},
    cocho: {nome: 'Cocho', anim: 'maos', altura: 'baixa', qualidade: 'contaminada', som: 'cocho',
      acoes: ['beber', 'encher'], texto: 'Água parada, verde de limo. O gado bebe.'},
    chuveiro: {nome: 'Chuveiro', anim: 'maos', altura: 'alta', qualidade: 'duvidosa', som: 'chuveiro',
      acoes: ['beber', 'cabeca'], texto: 'Chuveiro elétrico velho. A água sai morna, com gosto de cano.'},
    mangueira: {nome: 'Mangueira', anim: 'torneira', altura: 'baixa', qualidade: 'duvidosa', som: 'mangueira',
      acoes: ['beber', 'encher', 'rosto'], texto: 'Mangueira de quintal, quente do sol.'},
    privada: {nome: 'Vaso sanitário', anim: 'privada', altura: 'chao', qualidade: 'contaminada', som: 'descarga', privada: true,
      acoes: ['beber', 'descarga', 'caixa'], texto: 'A água da caixa é a menos pior. Ainda assim é a privada.'}
  };
  const ESTILOS_FONTE = Object.keys(FONTES);
  const fonteDe = estilo => FONTES[chave(estilo)] || FONTES.torneira;

  /* Ações de uma fonte, já filtradas pelo estado (garrafa na bolsa, balde no
     poço, armário embaixo da pia). A primeira é a que ↑/W confirma. */
  function acoesDaFonte(data = {}, {temGarrafa = true, mem = {}, secou = false} = {}) {
    const F = fonteDe(data.estilo), out = [];
    const add = (id, rotulo, icone, extra = {}) => out.push({id, rotulo, icone, ...extra});
    for (const id of F.acoes) {
      if (id === 'beber') {
        if (secou) continue;
        if (F.privada) add('beber', 'Beber da privada', 'gole', {perigo: true, confirmar: 'Tem certeza?'});
        else if (F.balde && !mem.balde) continue;
        else add('beber', 'Beber', 'gole');
      } else if (id === 'encher') {
        if (secou || !temGarrafa) continue;
        if (F.balde && !mem.balde) continue;
        add('encher', 'Encher garrafa', 'garrafa');
      } else if (id === 'balde') {
        add(mem.balde ? 'soltar' : 'balde', mem.balde ? 'Soltar o balde' : 'Puxar o balde', 'balde');
      } else if (id === 'rosto') { if (!secou) add('rosto', 'Lavar o rosto', 'rosto'); }
      else if (id === 'cabeca') { if (!secou) add('cabeca', 'Molhar a cabeça', 'cabeca'); }
      else if (id === 'copo') { if (!secou) add('copo', 'Encher um copo', 'copo'); }
      else if (id === 'descarga') add('descarga', 'Dar descarga', 'descarga');
      else if (id === 'armario') { if (texto(data.armario)) add('armario', texto(data.armarioNome, 'Abrir o armário'), 'armario'); }
      else if (id === 'caixa') { if (texto(data.armario)) add('armario', texto(data.armarioNome, 'Abrir a caixa acoplada'), 'armario'); }
    }
    if (texto(data.examinar)) add('olhar', 'Olhar de perto', 'lupa');
    return out;
  }
  /* Quantos goles a fonte ainda dá (vazio = infinita). */
  function golesDaFonte(data = {}, mem = {}) {
    const limite = inteiro(data.goles, 0, 0, 999);
    if (!limite) return {infinita: true, restam: Infinity, secou: false};
    const bebidos = inteiro(mem.bebidos, 0, 0, 999);
    return {infinita: false, restam: Math.max(0, limite - bebidos), secou: bebidos >= limite};
  }

  /* ---- vendedores ---- */
  const VENDEDORES = {
    pipoqueiro: {nome: 'Carrinho de pipoca', titulo: 'PIPOCA', som: 'carrinho',
      produtos: 'Pipoca salgada | 2 | pipoca\nPipoca doce | 3 | pipoca\nÁgua | 2 | agua'},
    coco: {nome: 'Carrinho de coco', titulo: 'ÁGUA DE COCO', som: 'facao',
      produtos: 'Água de coco | 3 | agua_coco\nRefrigerante | 3 | refrigerante'},
    estufa: {nome: 'Estufa de lanchonete', titulo: 'LANCHES', som: 'estufa',
      produtos: 'Coxinha | 3 | coxinha\nPão de queijo | 2 | pao_queijo\nMisto quente | 4 | misto_quente\nCafé | 1 | cafe'},
    padaria: {nome: 'Balcão de padaria', titulo: 'PADARIA', som: 'padaria',
      produtos: 'Pão francês | 1 | pao_frances\nPão de forma | 4 | pao_forma\nLeite | 3 | leite\nManteiga | 3 | manteiga'},
    cafezinho: {nome: 'Mesa do cafezinho', titulo: 'CAFEZINHO', som: 'termica',
      produtos: 'Cafezinho | 1 | cafe_coado\nCafé com leite | 2 | cafe_leite\nPão na chapa | 3 | pao_chapa'},
    ambulante: {nome: 'Ambulante', titulo: 'GELADO', som: 'isopor',
      produtos: 'Água | 1 | agua\nRefrigerante | 2 | refrigerante\nSuco | 2 | suco\nPaçoca | 1 | pacoca'}
  };
  const ESTILOS_VENDEDOR = Object.keys(VENDEDORES);
  const vendedorDe = estilo => VENDEDORES[chave(estilo)] || VENDEDORES.estufa;

  /* “Coxinha | 3 | coxinha | 2” → {nome, preco, item, estoque}. */
  function parseProdutos(txt) {
    const out = [];
    for (const linha of String(txt ?? '').split(/\r?\n/)) {
      const l = linha.trim();
      if (!l || l.startsWith('#')) continue;
      const partes = l.split('|').map(s => s.trim());
      const nome = partes[0];
      if (!nome) continue;
      const preco = inteiro(partes[1], 1, 0, 99);
      const item = partes[2] ? parseItem(partes[2]) : null;
      const estoque = partes[3] ? inteiro(partes[3], 0, 0, 99) : 0;
      out.push({nome, preco, item, estoque, key: `${chave(nome)}#${out.length}`});
    }
    return out;
  }
  /* “moedas*3”, “chave=Porão”, “pipoca” → {id, qtd, dados}. */
  function parseItem(txt) {
    let tok = String(txt ?? '').trim(), dados = null, qtd = 1, m;
    if (!tok) return null;
    const eq = tok.indexOf('=');
    if (eq >= 0) { const nome = tok.slice(eq + 1).trim(); tok = tok.slice(0, eq).trim(); if (nome) dados = {nome, name: nome}; }
    if ((m = tok.match(/^(.*?)\s*(?:\*|×|\bx)\s*(\d+)$/i))) { tok = m[1]; qtd = inteiro(m[2], 1, 1, 99); }
    const id = chave(tok).replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    return id ? {id, qtd, dados} : null;
  }

  /* ---- árvores frutíferas ---- */
  const FRUTAS = {goiaba: 'Goiaba', banana: 'Banana', laranja: 'Laranja', manga: 'Manga'};
  /* Quantas frutas maduras restam: cada colheita volta depois de `rebrota`
     minutos. Conta tanto o tempo de jogo quanto um pulo do relógio do mestre. */
  function frutasMaduras(data = {}, mem = {}, agora = 0, hora = null) {
    const total = inteiro(data.quantidade, 4, 0, 99), rebrota = inteiro(data.rebrota, 0, 0, 9999);
    const lista = Array.isArray(mem.colhidas) ? mem.colhidas : [];
    if (!rebrota) return {total, maduras: Math.max(0, total - lista.length), voltam: null};
    const vivas = [];
    for (const c of lista) {
      const real = Number.isFinite(c?.t) ? c.t : 0;
      let passou = agora - real;
      if (passou < 0) passou = agora;                       // o relógio recomeçou (recarregou a página)
      if (Number.isFinite(hora) && Number.isFinite(c?.hora)) passou = Math.max(passou, (hora - c.hora + 1440) % 1440);
      if (passou < rebrota) vivas.push({...c, falta: rebrota - passou});
    }
    mem.colhidas = vivas;
    return {total, maduras: Math.max(0, total - vivas.length), voltam: vivas.length ? Math.ceil(Math.min(...vivas.map(v => v.falta))) : null};
  }

  const api = {FONTES, ESTILOS_FONTE, fonteDe, acoesDaFonte, golesDaFonte, VENDEDORES, ESTILOS_VENDEDOR, vendedorDe,
    parseProdutos, parseItem, FRUTAS, frutasMaduras};
  root.InteracoesComida = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ================================================================ desenho (só no navegador) */
  const K = root.PixelKit, U = root.PixelUI, Tipos = root.ClueTypes;
  if (!K || !U || !Tipos || !root.document) return;
  const {C, SW, SH} = U, snap = U.snap;
  const Comida = () => root.Comida;

  /* Cores das rampas em cache: a interface pede milhares por quadro. */
  const cores = new Map();
  function cor(rampa, nivel) {
    const k = rampa + ':' + nivel;
    let c = cores.get(k);
    if (!c) { c = C(rampa, clamp(Math.round(nivel), 0, 7)); cores.set(k, c); }
    return c;
  }
  const ret = (ctx, x, y, w, h, rampa, nivel) => { ctx.fillStyle = cor(rampa, nivel); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const rgba = (rampa, nivel, alpha) => { const [r, g, b] = K.hexToRgb(cor(rampa, nivel)); return `rgba(${r},${g},${b},${alpha})`; };
  const arte = (nome, w, h, pinta) => U.art('ic:' + nome, w, h, pinta);
  const seguro = (fn, padrao) => { try { return fn(); } catch (e) { console.error(e); return padrao; } };
  const som = (sys, nome) => seguro(() => sys?.sfx?.(nome));
  const avisar = (sys, t, s, i) => seguro(() => sys?.toast?.(t, s, i));
  const memoriaDe = (sys, clue) => seguro(() => sys.memory(clue.id), null) || {};
  const declarado = (sys, id) => seguro(() => (sys?.stage?.scene?.props || []).some(p => p && p.id === id), false);
  const temEnergia = sys => (declarado(sys, 'energia') ? !!seguro(() => sys.hasProp('energia'), true) : true);
  const temBolsa = sys => !!sys?.itens && typeof sys.itens.contar === 'function';
  const escreve = (ctx, s, x, y, color, opts = {}) => K.drawText(ctx, String(s ?? ''), Math.round(x), Math.round(y), {color, ...opts});
  function cortar(str, largura, fonte = '5x7') {
    str = String(str ?? '');
    if (K.measure(str, fonte) <= largura) return str;
    while (str.length > 1 && K.measure(str + '…', fonte) > largura) str = str.slice(0, -1);
    return str.replace(/\s+$/, '') + '…';
  }
  const pequeno = s => semAcento(s).toUpperCase().replace(/[·•]/g, '-').replace(/[^A-Z0-9 .\-:/!]/g, '');
  const TXT = {titulo: '#ffd18c', dica: '#c99cc7', claro: '#ffe6f7', sombra: '#07030a'};

  /* ------------------------------------------------------------ ícones 16×16 dos botões */
  const ICONES = {
    gole(b) { b.poly([[4, 3], [12, 3], [11, 12], [5, 12]], 'palido', 5); b.rect(5, 5, 6, 6, 'agua', 4); b.hline(5, 10, 5, 'agua', 6); b.px(10, 6, 'palido', 7); b.hline(3, 12, 3, 'palido', 6); b.px(8, 0, 'agua', 5); b.px(8, 1, 'agua', 6); b.hline(4, 11, 13, 'palido', 2); },
    garrafa(b) { b.rect(6, 1, 4, 2, 'azul', 3); b.rect(5, 3, 6, 2, 'ceu', 4); b.rect(4, 5, 8, 9, 'ceu', 3); b.rect(5, 8, 6, 5, 'agua', 4); b.vline(10, 6, 12, 'ceu', 6); b.hline(5, 10, 8, 'agua', 6); b.hline(4, 11, 14, 'ceu', 1); b.px(3, 3, 'agua', 5); b.px(2, 5, 'agua', 4); },
    rosto(b) { b.ellipse(8, 8, 5, 5.6, 'pele', 3); b.px(6, 7, 'preto', 1); b.px(10, 7, 'preto', 1); b.hline(6, 9, 11, 'pele', 1); b.px(3, 3, 'agua', 5); b.px(12, 4, 'agua', 5); b.px(2, 9, 'agua', 4); b.px(13, 10, 'agua', 4); b.px(5, 1, 'agua', 6); },
    cabeca(b) { b.rect(3, 1, 10, 2, 'metal', 4); b.hline(3, 12, 1, 'metal', 6); for (let x = 4; x < 12; x += 2) { b.vline(x, 3, 5 + (x % 3), 'agua', 5); b.px(x, 7 + (x % 2), 'agua', 4); } b.ellipse(8, 12, 4, 3.4, 'pele', 3); b.px(6, 12, 'preto', 1); b.px(10, 12, 'preto', 1); },
    balde(b) { b.hline(4, 11, 1, 'metal', 5); b.px(3, 2, 'metal', 4); b.px(12, 2, 'metal', 4); b.poly([[3, 4], [12, 4], [11, 14], [4, 14]], 'metal', 3); b.hline(3, 12, 4, 'metal', 5); b.rect(5, 7, 6, 6, 'agua', 4); b.hline(5, 10, 7, 'agua', 6); b.vline(11, 5, 13, 'metal', 4); },
    descarga(b) { b.rect(2, 2, 12, 6, 'palido', 5); b.hline(2, 13, 2, 'palido', 6); b.hline(2, 13, 7, 'palido', 2); b.rect(10, 4, 4, 2, 'metal', 5); b.px(13, 5, 'metal', 6); for (let i = 0; i < 4; i++) { b.px(6 + i, 9 + i, 'agua', 5); b.px(9 - i, 10 + i, 'agua', 4); } b.ellipse(8, 13, 4, 2, 'agua', 3); },
    armario(b) { b.rect(1, 2, 14, 12, 'madeira', 3); b.hline(1, 14, 2, 'madeira', 5); b.vline(14, 3, 13, 'madeira', 4); b.hline(1, 14, 13, 'madeira', 1); b.vline(8, 3, 12, 'madeira', 1); b.px(7, 8, 'latao', 5); b.px(9, 8, 'latao', 5); b.rect(3, 4, 4, 3, 'madeira', 2); b.rect(10, 4, 4, 3, 'madeira', 2); },
    copo(b) { b.poly([[4, 2], [12, 2], [11, 14], [5, 14]], 'palido', 6); b.rect(5, 7, 6, 6, 'agua', 4); b.hline(5, 10, 7, 'agua', 6); b.vline(10, 3, 13, 'palido', 7); b.hline(4, 11, 2, 'palido', 7); },
    panela(b) { b.ellipse(8, 7, 6, 2.4, 'metal', 4); b.rect(2, 7, 12, 6, 'metal', 3); b.ellipse(8, 12.6, 6, 2, 'metal', 2); b.hline(2, 13, 7, 'metal', 5); b.vline(13, 8, 12, 'metal', 4); b.rect(0, 8, 2, 2, 'preto', 1); b.rect(14, 8, 2, 2, 'preto', 1); b.px(5, 4, 'palido', 5); b.px(9, 3, 'palido', 5); b.px(6, 2, 'palido', 4); },
    fogo(b) { b.poly([[8, 1], [11, 6], [10, 9], [12, 8], [11, 13], [5, 13], [4, 8], [6, 9], [5, 5]], 'fogo', 4); b.poly([[8, 5], [10, 9], [9, 12], [7, 12], [6, 9]], 'fogo', 5); b.px(8, 10, 'amarelo', 6); b.px(8, 11, 'amarelo', 6); },
    fruta(b) { b.sphere(6, 9, 4.4, 4.4, 'folha', 2, 5); b.sphere(11, 6, 3, 3, 'vermelho', 2, 5); b.px(6, 4, 'madeira', 2); b.line(6, 4, 9, 2, 'madeira', 3); b.poly([[9, 2], [13, 0], [12, 3]], 'folha', 4); },
    carrinho(b) { b.rect(1, 4, 14, 7, 'vermelho', 3); b.hline(1, 14, 4, 'vermelho', 5); b.rect(3, 6, 10, 4, 'papel', 6); b.hline(1, 14, 10, 'vermelho', 1); b.ellipse(4, 13, 2, 2, 'preto', 1); b.ellipse(12, 13, 2, 2, 'preto', 1); b.px(4, 13, 'metal', 4); b.px(12, 13, 'metal', 4); b.vline(15, 1, 4, 'metal', 4); b.hline(12, 15, 1, 'amarelo', 5); },
    termica(b) { b.rect(5, 3, 6, 11, 'vermelho', 3); b.vline(10, 4, 13, 'vermelho', 5); b.vline(5, 4, 13, 'vermelho', 1); b.rect(4, 1, 8, 2, 'preto', 2); b.hline(4, 11, 1, 'preto', 3); b.px(8, 0, 'metal', 5); b.rect(11, 6, 3, 4, 'preto', 2); b.hline(5, 10, 8, 'papel', 6); b.hline(5, 10, 14, 'preto', 1); },
    comida(b) { b.ellipse(8, 9, 6.6, 4, 'palido', 5); b.ellipse(8, 8.4, 5.2, 3, 'papel', 6); b.ellipse(7, 8, 2.6, 1.8, 'ambar', 4); b.px(8, 7, 'amarelo', 6); b.hline(2, 13, 12, 'palido', 2); b.vline(13, 2, 7, 'metal', 5); b.px(13, 1, 'metal', 6); b.px(12, 3, 'metal', 4); },
    agua(b) { b.poly([[8, 1], [12, 8], [12, 11], [8, 15], [4, 11], [4, 8]], 'agua', 4); b.poly([[8, 4], [11, 9], [8, 13], [5, 9]], 'agua', 5); b.px(6, 10, 'agua', 7); b.px(6, 9, 'agua', 6); },
    moeda(b) { b.ellipse(8, 8, 6.5, 6.5, 'latao', 2); b.ellipse(8, 8, 5.5, 5.5, 'latao', 4); b.ellipse(7, 7, 3.2, 3.2, 'latao', 5); b.vline(8, 5, 10, 'latao', 2); b.px(10, 4, 'latao', 7); }
  };
  for (const [nome, pinta] of Object.entries(ICONES)) if (!U.ICONS[nome]) U.ICONS[nome] = pinta;
  const icone = nome => (U.ICONS[nome] ? nome : 'objeto');

  /* ------------------------------------------------------------ sons */
  const SONS = [
    ['torneira', 'Torneira', ({noise, click}) => { click(900, .03, .12); noise({type: 'bandpass', freq: 1400, to: 900, q: .8, duration: 1.1, gain: .14, attack: .06}); noise({type: 'lowpass', freq: 600, duration: .9, gain: .07, attack: .1, when: .1}); }],
    ['bebedouro', 'Bebedouro', ({noise, click, tone}) => { click(1800, .02, .1); noise({type: 'bandpass', freq: 2200, to: 1500, q: 1.4, duration: 1, gain: .12, attack: .04}); tone(240, .3, .02, .05, 'sine', 380); }],
    ['galao', 'Galão de água', ({noise, tone}) => { noise({type: 'bandpass', freq: 900, to: 500, q: 1, duration: .8, gain: .12, attack: .05}); for (let i = 0; i < 3; i++) tone(180 + i * 60, .12, .05, .25 + i * .18, 'sine', 90); }],
    ['filtro', 'Filtro de barro', ({noise, click}) => { click(1200, .02, .08); noise({type: 'bandpass', freq: 800, to: 600, q: 1.2, duration: .7, gain: .1, attack: .08}); }],
    ['chafariz', 'Chafariz', ({noise}) => { noise({type: 'bandpass', freq: 1800, q: .5, duration: 1.6, gain: .13, attack: .3}); noise({type: 'lowpass', freq: 700, duration: 1.6, gain: .08, attack: .4}); }],
    ['bica', 'Bica de bambu', ({noise}) => { noise({type: 'bandpass', freq: 1500, to: 1100, q: .7, duration: 1.4, gain: .12, attack: .2}); }],
    ['corrego', 'Córrego', ({noise}) => { noise({type: 'bandpass', freq: 1200, q: .4, duration: 1.8, gain: .1, attack: .5}); }],
    ['cocho', 'Água parada', ({noise, tone}) => { noise({type: 'lowpass', freq: 400, duration: .6, gain: .12, attack: .1}); tone(120, .2, .04, .1, 'sine', 90); }],
    ['chuveiro', 'Chuveiro', ({noise}) => { noise({type: 'highpass', freq: 2600, q: .4, duration: 1.5, gain: .12, attack: .15}); noise({type: 'bandpass', freq: 1200, q: .6, duration: 1.5, gain: .08, attack: .2}); }],
    ['mangueira', 'Mangueira', ({noise}) => { noise({type: 'bandpass', freq: 1700, to: 2100, q: 1.1, duration: 1.2, gain: .13, attack: .1}); }],
    ['poco', 'Manivela do poço', ({noise, click, tone}) => { for (let i = 0; i < 7; i++) { click(320 + (i % 2) * 160, .05, .16, i * .22, 'bandpass'); tone(90 + (i % 3) * 20, .1, .05, i * .22, 'triangle'); } noise({type: 'lowpass', freq: 500, duration: .4, gain: .2, attack: .01, when: 1.6}); }],
    ['balde_agua', 'Balde na água', ({noise, click}) => { noise({type: 'lowpass', freq: 700, to: 300, duration: .5, gain: .3, attack: .01}); click(1400, .04, .1, .02); }],
    ['fritura', 'Chiado de fritura', ({noise}) => { noise({type: 'highpass', freq: 3200, q: .3, duration: 1.1, gain: .1, attack: .05}); noise({type: 'bandpass', freq: 1800, q: .5, duration: 1, gain: .06, attack: .1}); }],
    ['borbulhar', 'Borbulhando', ({tone, noise}) => { for (let i = 0; i < 6; i++) tone(160 + Math.random() * 180, .09, .05, i * .14, 'sine', 320); noise({type: 'lowpass', freq: 500, duration: .9, gain: .05, attack: .2}); }],
    ['micro_zumbido', 'Micro-ondas', ({hold, noise}) => { hold(118, 1.4, .05, 0, 'sawtooth', 500); hold(236, 1.4, .012, 0, 'square', 700); noise({type: 'lowpass', freq: 300, duration: 1.4, gain: .06, attack: .3}); }],
    ['micro_plim', 'Plim do micro-ondas', ({tone}) => { tone(1568, .35, .09); tone(2093, .3, .03, .01); tone(1568, .4, .06, .32); }],
    ['cafeteira', 'Cafeteira gorgolejando', ({tone, noise}) => { for (let i = 0; i < 5; i++) { tone(120 + (i % 3) * 40, .18, .05, i * .3, 'triangle', 200); noise({type: 'bandpass', freq: 900, q: 1, duration: .2, gain: .05, when: i * .3 + .05}); } }],
    ['sanduicheira', 'Sanduicheira', ({click, noise}) => { click(700, .06, .3, 0, 'lowpass'); click(2400, .03, .12, .04); noise({type: 'highpass', freq: 3000, duration: .8, gain: .07, attack: .2, when: .1}); }],
    ['fosforo', 'Fósforo', ({noise, click}) => { noise({type: 'bandpass', freq: 3800, to: 2000, q: .8, duration: .22, gain: .3, attack: .004}); click(1200, .05, .1, .02); noise({type: 'lowpass', freq: 900, duration: .5, gain: .05, attack: .1, when: .2}); }],
    ['gas', 'Chama de gás', ({click, noise}) => { for (let i = 0; i < 3; i++) click(2200, .02, .18, i * .05); noise({type: 'bandpass', freq: 700, q: .5, duration: .9, gain: .08, attack: .08, when: .12}); }],
    ['fogueira', 'Fogueira', ({noise, click}) => { noise({type: 'lowpass', freq: 500, duration: 1.4, gain: .1, attack: .3}); for (let i = 0; i < 5; i++) click(2600 + Math.random() * 1500, .02, .08, Math.random() * 1.2); }],
    ['pipoca_estouro', 'Pipoca estourando', ({click}) => { for (let i = 0; i < 9; i++) click(1600 + Math.random() * 2200, .02, .1 + Math.random() * .12, Math.random() * .9, 'bandpass'); }],
    ['tampa', 'Tampa de panela', ({click, tone}) => { click(1800, .04, .2); tone(520, .25, .05, 0, 'triangle'); tone(780, .18, .02, .01); }],
    ['pim', 'No ponto', ({tone}) => { tone(1320, .12, .07); tone(1976, .18, .05, .06); }],
    ['queimou', 'Queimou', ({noise, tone}) => { noise({type: 'highpass', freq: 2200, duration: .7, gain: .12, attack: .02}); tone(180, .4, .07, 0, 'square', 90); tone(140, .5, .05, .12, 'sawtooth', 70); }],
    ['servir_copo', 'Servindo', ({noise, tone}) => { noise({type: 'bandpass', freq: 1100, to: 1700, q: 2.2, duration: .8, gain: .14, attack: .06}); tone(300, .5, .03, 0, 'sine', 520); }],
    ['termica', 'Bomba da térmica', ({click, noise}) => { for (const w of [0, .28]) { click(420, .07, .22, w, 'lowpass'); noise({type: 'bandpass', freq: 1500, to: 900, q: 1.5, duration: .3, gain: .12, attack: .02, when: w + .03}); } }],
    ['carrinho', 'Carrinho de pipoca', ({tone, noise}) => { tone(880, .12, .05, 0, 'square'); tone(1174, .12, .05, .12, 'square'); tone(1568, .2, .05, .24, 'square'); noise({type: 'bandpass', freq: 2400, q: .8, duration: .5, gain: .05, attack: .2}); }],
    ['facao', 'Facão no coco', ({click, noise}) => { for (let i = 0; i < 3; i++) { click(900 - i * 120, .05, .3, i * .18, 'lowpass'); noise({type: 'bandpass', freq: 2200, q: 1.5, duration: .1, gain: .12, when: i * .18}); } }],
    ['estufa', 'Estufa', ({hold, click}) => { hold(60, .9, .04, 0, 'sawtooth', 300); click(1800, .03, .1, .1); }],
    ['padaria', 'Padaria', ({tone}) => { tone(1046, .16, .06); tone(1318, .22, .05, .14); }],
    ['isopor', 'Isopor no gelo', ({noise}) => { noise({type: 'highpass', freq: 3600, q: .4, duration: .5, gain: .14, attack: .01}); noise({type: 'bandpass', freq: 1200, q: .6, duration: .3, gain: .08, attack: .02, when: .1}); }],
    ['caderno', 'Folheando o caderno', ({noise}) => { noise({type: 'bandpass', freq: 2600, q: .6, duration: .18, gain: .14, attack: .01}); noise({type: 'bandpass', freq: 1900, q: .8, duration: .12, gain: .08, attack: .01, when: .08}); }],
    ['galho', 'Galho', ({click, noise}) => { click(1400, .05, .18); noise({type: 'bandpass', freq: 2800, q: .6, duration: .4, gain: .1, attack: .02, when: .04}); }]
  ];
  if (root.MapAmbience?.registrar) for (const [nome, rotulo, fn] of SONS) root.MapAmbience.registrar(nome, rotulo, fn);

  /* ------------------------------------------------------------ close-up: moldura comum
     A cena do objeto ocupa 152×100 pixels de arte (304×200 na tela) à
     esquerda; os botões grandes de ação ficam na coluna da direita. */
  const CENA = {x: 10, y: 32, aw: 152, ah: 100, w: 304, h: 200};
  const BOT = {x: 322, w: 150, y: 44, h: 40, gap: 9};
  const AX = a => CENA.x + a * 2, AY = a => CENA.y + a * 2;

  /* ---- fundos ---- */
  function azulejos(b, x, y, w, h, {rampa = 'palido', base = 5, tam = 8, junta = 3, faixa = null, seed = 3} = {}) {
    b.rect(x, y, w, h, rampa, base);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const lx = (xx - x) % tam, ly = (yy - y) % tam;
      if (lx === 0 || ly === 0) b.px(xx, yy, rampa, junta);
      else if (lx === 1 || ly === 1) b.px(xx, yy, rampa, base + 1);
      else if (lx === tam - 1 || ly === tam - 1) b.px(xx, yy, rampa, base - 1);
      else if (K.hash2(xx >> 1, yy >> 1, seed) > .93) b.px(xx, yy, rampa, base + 1);
    }
    if (faixa !== null) { b.rect(x, faixa, w, 8, 'azul', 3); for (let xx = x; xx < x + w; xx += 8) { b.vline(xx, faixa, faixa + 7, 'azul', 2); b.px(xx + 4, faixa + 3, 'azul', 5); b.px(xx + 3, faixa + 4, 'azul', 5); } b.hline(x, x + w - 1, faixa, 'azul', 4); b.hline(x, x + w - 1, faixa + 7, 'azul', 1); }
  }
  function reboco(b, x, y, w, h, {rampa = 'papelVelho', base = 4, seed = 7, manchas = 1} = {}) {
    b.rect(x, y, w, h, rampa, base);
    const r = K.rng(seed);
    b.speckle(x, y, w, h, rampa, base + 1, .05, r); b.speckle(x, y, w, h, rampa, base - 1, .04, r);
    for (let i = 0; i < manchas * 3; i++) {
      const cx = x + Math.floor(r() * w), cy = y + Math.floor(r() * h), rx = 5 + r() * 12, ry = 4 + r() * 9;
      b.shadeFn(cx - rx, cy - ry, rx * 2, ry * 2, (u, v) => (Math.hypot((u - cx) / rx, (v - cy) / ry) < .9 ? -1 : 0));
    }
  }
  function ladrilho(b, x, y, w, h, {rampa = 'concreto', base = 3, tam = 10, seed = 5} = {}) {
    b.rect(x, y, w, h, rampa, base);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const l = yy - y, esc = 1 + l / h * .6;
      if ((xx + (l >> 1) * 3) % Math.round(tam * esc) === 0 || l % 6 === 0) b.px(xx, yy, rampa, base - 2);
      else if (K.hash2(xx, yy, seed) > .95) b.px(xx, yy, rampa, base + 1);
    }
    b.shadeFn(x, y, w, h, (u, v) => (v - y) / h * -.8);
  }
  function ceuFundo(b, x, y, w, h, {noite = false} = {}) {
    for (let yy = y; yy < y + h; yy++) {
      const t = (yy - y) / h;
      for (let xx = x; xx < x + w; xx++) b.px(xx, yy, noite ? 'azul' : 'ceu', Math.floor((noite ? .6 : 1.6) + t * 2.6 + K.bayer(xx, yy)));
    }
  }
  function grama(b, x, y, w, h, {seed = 11} = {}) {
    b.rect(x, y, w, h, 'grama', 3);
    const r = K.rng(seed);
    b.speckle(x, y, w, h, 'grama', 2, .2, r); b.speckle(x, y, w, h, 'grama', 4, .12, r);
    for (let i = 0; i < w / 3; i++) { const gx = x + Math.floor(r() * w), gy = y + Math.floor(r() * h); b.vline(gx, gy, gy + 1 + Math.floor(r() * 2), 'grama', 4); }
    b.shadeFn(x, y, w, h, (u, v) => (v - y) / h * -.7);
  }
  function terra(b, x, y, w, h, {seed = 13} = {}) {
    b.rect(x, y, w, h, 'sepia', 2);
    const r = K.rng(seed);
    b.speckle(x, y, w, h, 'sepia', 1, .18, r); b.speckle(x, y, w, h, 'sepia', 3, .1, r);
    for (let i = 0; i < w / 10; i++) { const gx = x + Math.floor(r() * w), gy = y + Math.floor(r() * h); b.ellipse(gx, gy, 1 + r() * 2, 1, 'concreto', 2); }
  }
  /* Sombra de contato: escurece o chão embaixo de um objeto. */
  const contato = (b, x, y, w, h = 3) => b.shadeFn(x, y, w, h, (u, v) => -1.2 + (v - y) / h * 1.1);

  /* ---- água animada (desenhada por quadro, em pixels de tela) ---- */
  function jato(ctx, x0, y0, x1, y1, t, {grossura = 2, cor: c = null, gotas = true} = {}) {
    const col = c || rgba('agua', 5, .9), col2 = rgba('agua', 7, .8);
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u * u + Math.sin(u * Math.PI) * -(y1 - y0) * .12;
      const j = Math.sin(t * 16 + u * 7) * 1;
      ctx.fillStyle = i % 3 === Math.floor(t * 12) % 3 ? col2 : col;
      ctx.fillRect(snap(x + j), snap(y), grossura, 2);
    }
    if (gotas) for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i * .37) % 1;
      ctx.fillStyle = rgba('agua', 6, .8);
      ctx.fillRect(snap(x1 + Math.sin(i * 2 + t * 3) * 8), snap(y1 - 4 + ph * 6), 2, 2);
    }
  }
  function pingando(ctx, x, y, alvoY, t, {periodo = 1.6} = {}) {
    const ph = (t % periodo) / periodo;
    ctx.fillStyle = rgba('agua', 6, .85);
    if (ph < .7) { const py = y + (alvoY - y) * (ph / .7) * (ph / .7); ctx.fillRect(snap(x), snap(py), 2, ph < .12 ? 2 : 4); }
    else { const k = (ph - .7) / .3; ctx.fillStyle = rgba('agua', 5, .5 * (1 - k)); ctx.fillRect(snap(x - 4 - k * 6), snap(alvoY), snap(8 + k * 12), 2); }
  }
  function vaporSobe(ctx, x, y, t, {n = 3, alt = 22, largura = 10, cor: c = null, forca = 1} = {}) {
    for (let i = 0; i < n; i++) {
      const ph = ((t * .55 + i / n) % 1), yy = y - ph * alt, k = Math.sin(ph * Math.PI);
      ctx.fillStyle = c || `rgba(226,214,236,${(.3 * k * forca).toFixed(3)})`;
      const w = 2 + Math.round(k * 2) * 2;
      ctx.fillRect(snap(x + Math.sin(ph * 5 + i) * largura), snap(yy), w, 2);
    }
  }
  function bolhas(ctx, x, y, w, t, forca) {
    if (forca <= 0) return;
    for (let i = 0; i < Math.round(3 + forca * 7); i++) {
      const ph = ((t * (.8 + forca) + i * .29) % 1), bx = x + ((i * 37) % w), by = y - ph * 8;
      ctx.fillStyle = rgba('agua', 7, .5 + forca * .3);
      ctx.fillRect(snap(bx), snap(by), 2, 2);
    }
  }

  /* ------------------------------------------------------------ close-up de cada fonte
     Cada estilo é o objeto que ele é: 152×100 pixels de arte, parede/chão de
     fundo, o móvel no meio e as partes clicáveis marcadas por `zonas`. */
  const ZONAS_FONTE = {};      // estilo → [{id, x, y, w, h}] em pixels de arte
  const zonas = (estilo, lista) => { ZONAS_FONTE[estilo] = lista; };

  function bancada(b, x, w, y, {rampa = 'concreto', base = 4} = {}) {
    b.rect(x, y, w, 4, rampa, base); b.hline(x, x + w - 1, y, rampa, base + 2); b.hline(x, x + w - 1, y + 3, rampa, base - 2);
    for (let i = 0; i < w; i += 3) if (K.hash2(x + i, y, 5) > .6) b.px(x + i, y + 1, rampa, base + 1);
  }
  function portasArmario(b, x, y, w, h, {rampa = 'madeira', base = 3, aberto = false, puxador = 'metal'} = {}) {
    if (aberto) {
      b.rect(x, y, w, h, 'preto', 1);
      for (let i = 0; i < 3; i++) b.hline(x + 2, x + w - 3, y + 4 + i * 8, rampa, 2);
      b.rect(x - 6, y, 6, h, rampa, base - 1); b.vline(x - 6, y, y + h - 1, rampa, base + 1);
      b.rect(x + w, y, 6, h, rampa, base + 1); b.vline(x + w + 5, y, y + h - 1, rampa, base - 1);
      return;
    }
    const meio = x + Math.floor(w / 2);
    b.rect(x, y, w, h, rampa, base);
    b.hline(x, x + w - 1, y, rampa, base + 2); b.vline(x + w - 1, y, y + h - 1, rampa, base + 1);
    b.vline(x, y, y + h - 1, rampa, base - 1); b.hline(x, x + w - 1, y + h - 1, rampa, base - 2);
    b.vline(meio, y, y + h - 1, rampa, base - 2); b.vline(meio + 1, y, y + h - 1, rampa, base + 1);
    b.inset(x + 3, y + 3, Math.floor(w / 2) - 6, h - 6, rampa, base, base + 1, base - 2);
    b.inset(meio + 4, y + 3, Math.floor(w / 2) - 7, h - 6, rampa, base, base + 1, base - 2);
    b.vline(meio - 3, y + Math.floor(h / 2) - 2, y + Math.floor(h / 2) + 2, puxador, 5);
    b.vline(meio + 4, y + Math.floor(h / 2) - 2, y + Math.floor(h / 2) + 2, puxador, 5);
  }
  function torneiraCromada(b, x, y, {alt = 10, bico = 6, lado = 1} = {}) {
    b.rect(x - 2, y + alt - 3, 5, 3, 'metal', 3); b.hline(x - 2, x + 2, y + alt - 3, 'metal', 5);
    b.vline(x, y + 1, y + alt - 1, 'metal', 4); b.vline(x + 1, y + 1, y + alt - 1, 'metal', 5); b.vline(x - 1, y + 1, y + alt - 1, 'metal', 2);
    for (let i = 0; i <= bico; i++) b.px(x + lado * i, y + (i < 2 ? 0 : 1), 'metal', i > bico - 3 ? 4 : 5);
    b.px(x + lado * bico, y + 2, 'metal', 3); b.px(x + lado * bico, y + 3, 'metal', 2);
    b.rect(x - 5, y + alt - 6, 3, 2, 'metal', 4); b.px(x - 6, y + alt - 6, 'metal', 5);
    b.rect(x + 3, y + alt - 6, 3, 2, 'metal', 4); b.px(x + 6, y + alt - 6, 'metal', 5);
  }

  /* Pedra: bloco irregular com o topo iluminado e a base na sombra. */
  function pedra(b, cx, cy, r, {rampa = 'concreto', base = 3, seed = 1} = {}) {
    const n = 7, pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, k = .68 + K.hash2(i, seed, 3) * .5;
      pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * .8]);
    }
    b.poly(pts, rampa, base);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (b.rampAt(x, y) !== b.rid(rampa)) continue;
      const nx = (x - cx) / r, ny = (y - cy) / r;
      const lit = .5 + nx * .3 - ny * .55;
      b.px(x, y, rampa, base + (lit > .95 ? 2 : lit > .66 ? 1 : lit < .24 ? -1 : 0));
    }
    b.line(cx - r * .3, cy - r * .2, cx + r * .1, cy + r * .4, rampa, base - 2);
  }
  const PINTA_FONTE = {
    /* Pia: de banheiro (cuba redonda, espelho, sifão) ou de cozinha (cuba de
       inox, louça, esponja). As duas com armário embaixo. */
    pia(b, e) {
      const coz = !!e.cozinha, cx = 74;
      azulejos(b, 0, 0, 152, 72, {rampa: coz ? 'papel' : 'palido', base: coz ? 6 : 5, tam: 8, faixa: coz ? null : 30, seed: coz ? 4 : 3});
      ladrilho(b, 0, 72, 152, 28, {rampa: coz ? 'sepia' : 'concreto', base: coz ? 3 : 4, tam: 12});
      if (!coz) {
        b.rect(38, 2, 76, 32, 'metal', 3); b.frame(38, 2, 76, 32, 'metal', 5); b.hline(38, 113, 33, 'metal', 1);
        azulejos(b, 40, 4, 72, 28, {rampa: 'palido', base: 6, tam: 7, seed: 12});
        b.shadeFn(40, 4, 72, 28, (x, y) => (y - 4) / 28 * -.8 + .3);
        for (let i = 0; i < 3; i++) b.poly([[46 + i * 24, 4], [56 + i * 24, 4], [44 + i * 24, 31], [34 + i * 24, 31]], 'palido', 7);
        /* o reflexo: cabeça, cabelo e ombros, recortados dentro do espelho */
        const mx = 76;
        for (let y = 7; y <= 32; y++) for (let x = 42; x <= 110; x++) {
          const dxh = (x - mx) / 8.5, dyh = (y - 18) / 9.5, dxo = (x - mx) / 21, dyo = (y - 45) / 17;
          if (dxh * dxh + dyh * dyh <= 1) {
            const cabelo = y < 15 + Math.abs(x - mx) * .22;
            b.px(x, y, cabelo ? 'carvao' : 'pele', cabelo ? 2 : 3);
          } else if (y >= 27 && dxo * dxo + dyo * dyo <= 1) b.px(x, y, 'azul', 2);
        }
        for (let x = mx - 7; x <= mx + 7; x++) b.px(x, 15 + Math.round(Math.abs(x - mx) * .22), 'carvao', 3);
        b.px(mx - 4, 19, 'preto', 1); b.px(mx + 3, 19, 'preto', 1);
        b.px(mx - 4, 18, 'carvao', 2); b.px(mx + 3, 18, 'carvao', 2);
        b.hline(mx - 2, mx + 1, 24, 'sepia', 2); b.px(mx, 21, 'pele', 2);
        b.dither(40, 4, 22, 28, 'palido', 7, .16, K.rng(21));
        b.frame(39, 3, 74, 30, 'metal', 6);
      } else {
        b.rect(92, 0, 58, 28, 'madeira', 3); portasArmario(b, 92, 0, 58, 28, {rampa: 'madeira', base: 3});
        b.rect(6, 14, 44, 3, 'madeira', 3); b.hline(6, 49, 14, 'madeira', 5); b.shade(6, 17, 44, 3, -1, .6);
        for (let i = 0; i < 4; i++) { const px = 10 + i * 10, r = ['vermelho', 'amarelo', 'folha', 'ambar'][i]; b.rect(px, 6, 7, 8, r, 3); b.hline(px, px + 6, 6, r, 5); b.vline(px + 6, 7, 13, r, 4); b.hline(px, px + 6, 5, 'metal', 4); }
      }
      // bancada com frente e cuba embutida
      const topo = 46;
      b.rect(10, topo, 132, 4, coz ? 'concreto' : 'palido', coz ? 3 : 6);
      b.hline(10, 141, topo, coz ? 'concreto' : 'palido', coz ? 5 : 7);
      b.rect(10, topo + 4, 132, 3, coz ? 'concreto' : 'palido', coz ? 2 : 4);
      b.hline(10, 141, topo + 6, coz ? 'concreto' : 'palido', coz ? 1 : 3);
      if (coz) for (let i = 0; i < 132; i += 3) if (K.hash2(i, topo, 5) > .55) b.px(10 + i, topo + 1, 'concreto', 5);
      if (coz) {
        b.rect(cx - 26, topo - 8, 52, 12, 'metal', 4); b.hline(cx - 26, cx + 25, topo - 8, 'metal', 6);
        b.rect(cx - 24, topo - 6, 48, 9, 'metal', 2); b.hline(cx - 24, cx + 23, topo - 6, 'metal', 1);
        b.vline(cx - 24, topo - 6, topo + 2, 'metal', 1); b.vline(cx + 23, topo - 6, topo + 2, 'metal', 5);
        b.ellipse(cx + 12, topo - 1, 3, 1.4, 'metal', 0);
        b.rect(cx - 22, topo - 5, 12, 7, 'palido', 5); b.hline(cx - 22, cx - 11, topo - 5, 'palido', 7); b.hline(cx - 22, cx - 11, topo - 3, 'palido', 3);
        b.rect(cx - 20, topo - 8, 9, 4, 'palido', 6); b.hline(cx - 20, cx - 12, topo - 8, 'palido', 7);
        b.rect(cx + 2, topo - 4, 8, 4, 'amarelo', 4); b.hline(cx + 2, cx + 9, topo - 4, 'amarelo', 6); b.rect(cx + 2, topo - 2, 8, 2, 'folha', 3);
        b.rect(108, topo - 10, 10, 10, 'ceu', 3); b.hline(108, 117, topo - 10, 'ceu', 5); b.rect(110, topo - 8, 6, 5, 'folha', 3);
      } else {
        b.ellipse(cx, topo, 29, 10, 'palido', 7);
        b.ellipse(cx, topo + 1, 26, 9, 'palido', 5);
        b.ellipse(cx, topo + 2, 23, 7.5, 'palido', 2);
        b.ellipse(cx, topo + 3, 19, 6, 'palido', 1);
        for (let i = -18; i <= 18; i++) b.px(cx + i, topo + 5 - Math.round(Math.abs(i) / 8), 'palido', 3);
        b.ellipse(cx, topo + 4, 3.4, 1.6, 'metal', 2); b.px(cx, topo + 4, 'preto', 1);
        b.hline(cx - 27, cx + 26, topo - 5, 'palido', 7);
        b.rect(cx + 32, topo - 4, 12, 5, 'papel', 6); b.hline(cx + 32, cx + 43, topo - 4, 'papel', 7); b.hline(cx + 32, cx + 43, topo, 'papel', 3);
        b.rect(16, topo - 22, 14, 22, 'ceu', 3); b.hline(16, 29, topo - 22, 'ceu', 5); b.vline(29, topo - 21, topo - 1, 'ceu', 2);
        for (let y = topo - 20; y < topo - 2; y += 4) b.hline(17, 28, y, 'ceu', 4);
      }
      torneiraCromada(b, cx, topo - 16, {alt: 16, bico: 6, lado: coz ? -1 : 1});
      if (e.armario) portasArmario(b, 16, topo + 7, 120, 25, {rampa: 'madeira', base: coz ? 4 : 3, aberto: e.aberto});
      else {
        b.rect(cx - 8, topo + 7, 16, 22, 'palido', 5); b.vline(cx - 8, topo + 7, topo + 28, 'palido', 3); b.vline(cx + 7, topo + 7, topo + 28, 'palido', 7);
        b.rect(cx - 3, topo + 7, 6, 8, 'metal', 3); b.ellipse(cx, topo + 16, 5, 3.4, 'metal', 4); b.px(cx + 3, topo + 15, 'metal', 6); b.vline(cx, topo + 19, topo + 28, 'metal', 3);
      }
      contato(b, 16, 78, 120, 4);
      if (e.aberto && e.armario) {
        const dx = e.comItens ? 30 : 0; // com itens dentro, a tralha fica à direita deles
        if (!e.comItens) {
          // frasco de produto de limpeza
          b.rect(24, topo + 14, 9, 13, 'ambar', 3); b.hline(24, 32, topo + 14, 'ambar', 5); b.vline(32, topo + 15, topo + 26, 'ambar', 1);
          b.rect(27, topo + 10, 3, 4, 'ambar', 2); b.rect(26, topo + 9, 5, 2, 'carvao', 3);
          b.rect(25, topo + 18, 7, 5, 'papel', 6); b.hline(25, 31, topo + 18, 'papel', 7);
          // pilha de panos dobrados
          for (let i = 0; i < 3; i++) { const yy = topo + 23 - i * 4; b.rect(40, yy, 16, 4, i === 1 ? 'azul' : 'papel', i === 1 ? 3 : 5); b.hline(40, 55, yy, i === 1 ? 'azul' : 'papel', i === 1 ? 5 : 7); }
        }
        // balde
        b.poly([[64 + dx, topo + 16], [80 + dx, topo + 16], [77 + dx, topo + 27], [67 + dx, topo + 27]], 'azul', 3);
        b.hline(64 + dx, 79 + dx, topo + 16, 'azul', 5);
        b.line(64 + dx, topo + 15, 72 + dx, topo + 10, 'metal', 4); b.line(72 + dx, topo + 10, 80 + dx, topo + 15, 'metal', 4);
        // rolo de papel
        b.rect(90 + dx, topo + 15, 14, 12, 'papel', 6); b.hline(90 + dx, 103 + dx, topo + 15, 'papel', 7); b.vline(103 + dx, topo + 16, topo + 26, 'papel', 3);
        b.ellipse(97 + dx, topo + 21, 3, 3, 'papel', 3); b.ellipse(97 + dx, topo + 21, 1.6, 1.6, 'sepia', 2);
      }
    },
    /* Bebedouro de pressão: coluna de inox, cuba, jatinho e copinhos. */
    bebedouro(b, e) {
      azulejos(b, 0, 0, 152, 72, {rampa: 'palido', base: 5, tam: 8, faixa: 38});
      ladrilho(b, 0, 72, 152, 28, {rampa: 'concreto', base: 4, tam: 12});
      b.rect(110, 10, 16, 40, 'palido', 7); b.frame(110, 10, 16, 40, 'palido', 3); b.rect(112, 12, 12, 32, 'ceu', 2);
      for (let i = 0; i < 5; i++) { b.poly([[113, 14 + i * 6], [123, 14 + i * 6], [122, 20 + i * 6], [114, 20 + i * 6]], 'papel', 6); b.hline(113, 123, 14 + i * 6, 'papel', 7); b.hline(114, 122, 19 + i * 6, 'papel', 3); }
      b.hline(110, 125, 50, 'palido', 2);
      const x0 = 50, w = 46;
      b.rect(x0 + 4, 40, w - 8, 38, 'metal', 3);
      for (let i = 0; i < w - 8; i += 2) b.vline(x0 + 4 + i, 40, 77, 'metal', 4);
      b.vline(x0 + 4, 40, 77, 'metal', 1); b.vline(x0 + 5, 40, 77, 'metal', 2); b.vline(x0 + w - 5, 40, 77, 'metal', 6); b.vline(x0 + w - 6, 40, 77, 'metal', 5);
      b.rect(x0, 26, w, 14, 'metal', 4); b.hline(x0, x0 + w - 1, 26, 'metal', 6); b.hline(x0, x0 + w - 1, 39, 'metal', 1);
      b.vline(x0, 26, 39, 'metal', 2); b.vline(x0 + w - 1, 26, 39, 'metal', 5);
      b.ellipse(x0 + w / 2, 31, 17, 5, 'metal', 2); b.ellipse(x0 + w / 2, 31, 15, 4, 'metal', 1);
      b.ellipse(x0 + w / 2, 32, 4, 1.4, 'preto', 1);
      for (let i = 0; i < 7; i++) b.vline(x0 + 8 + i * 5, 29, 33, 'metal', 3);
      b.rect(x0 + w / 2 - 3, 18, 6, 8, 'metal', 5); b.px(x0 + w / 2 + 2, 18, 'metal', 6); b.px(x0 + w / 2 - 3, 25, 'metal', 2);
      b.rect(x0 + w / 2 - 1, 15, 2, 4, 'metal', 4);
      b.rect(x0 + w - 14, 20, 8, 4, 'preto', 2); b.hline(x0 + w - 14, x0 + w - 7, 20, 'metal', 5); b.px(x0 + w - 8, 21, 'vermelho', 4);
      b.rect(x0 + 8, 46, 16, 6, 'azul', 3); b.hline(x0 + 8, x0 + 23, 46, 'azul', 5); b.text(x0 + 16, 47, 'AGUA', 'palido', 7, {font: '3x5', align: 'center'});
      b.rect(x0 + 6, 62, w - 12, 3, 'metal', 2); b.hline(x0 + 6, x0 + w - 7, 62, 'metal', 5);
      b.rect(x0 + 8, 78, w - 16, 2, 'preto', 1);
      contato(b, x0, 76, w, 4);
      b.ellipse(x0 + w / 2 + 20, 84, 12, 4, 'agua', 2);
    },
    /* Bebedouro de galão: garrafão azul, duas torneiras e a bandeja. */
    bebedouro_galao(b, e) {
      azulejos(b, 0, 0, 152, 72, {rampa: 'papel', base: 5, tam: 8, seed: 6});
      ladrilho(b, 0, 72, 152, 28, {rampa: 'sepia', base: 3, tam: 12});
      contato(b, 50, 74, 52, 4);
      const x0 = 54, w = 44;
      b.rect(x0 + 6, 6, 32, 30, 'ceu', 3); b.rect(x0 + 8, 4, 28, 3, 'ceu', 4);
      b.rect(x0 + 16, 1, 12, 4, 'azul', 3); b.hline(x0 + 16, x0 + 27, 1, 'azul', 5);
      b.rect(x0 + 8, 10, 28, 24, 'agua', 4); b.hline(x0 + 8, x0 + 35, 10, 'agua', 6);
      b.vline(x0 + 34, 10, 33, 'agua', 6); b.vline(x0 + 9, 10, 33, 'agua', 2);
      b.rect(x0 + 12, 14, 6, 14, 'agua', 6); b.px(x0 + 30, 18, 'agua', 7);
      b.hline(x0 + 6, x0 + 37, 36, 'ceu', 2);
      b.rect(x0, 36, w, 40, 'papel', 6); b.hline(x0, x0 + w - 1, 36, 'papel', 7); b.vline(x0, 36, 75, 'papel', 4); b.vline(x0 + w - 1, 36, 75, 'papel', 7);
      b.rect(x0 + 4, 44, w - 8, 14, 'papel', 4); b.frame(x0 + 4, 44, w - 8, 14, 'papel', 3);
      b.rect(x0 + 9, 48, 8, 4, 'azul', 3); b.hline(x0 + 9, x0 + 16, 48, 'azul', 5); b.vline(x0 + 12, 52, 55, 'azul', 4);
      b.rect(x0 + 27, 48, 8, 4, 'palido', 5); b.hline(x0 + 27, x0 + 34, 48, 'palido', 6); b.vline(x0 + 30, 52, 55, 'palido', 4);
      b.rect(x0 + 6, 60, w - 12, 6, 'metal', 2); b.hline(x0 + 6, x0 + w - 7, 60, 'metal', 4);
      for (let i = 0; i < 6; i++) b.vline(x0 + 8 + i * 5, 61, 64, 'metal', 1);
      b.px(x0 + w - 8, 40, 'fosforo', 5, K.EMISSIVE);
      b.rect(x0 + 4, 76, w - 8, 2, 'preto', 1);
      b.rect(110, 64, 22, 12, 'madeira', 3); b.hline(110, 131, 64, 'madeira', 5); b.hline(110, 131, 75, 'madeira', 1);
      for (let i = 0; i < 3; i++) { b.poly([[112 + i * 7, 56], [119 + i * 7, 56], [118 + i * 7, 64], [113 + i * 7, 64]], 'papel', 6); b.hline(112 + i * 7, 119 + i * 7, 56, 'papel', 7); }
    },
    /* Torneira de parede, de quintal: registro, mangueira e a poça. */
    torneira(b, e) {
      reboco(b, 0, 0, 152, 66, {rampa: 'papelVelho', base: 4, seed: 9, manchas: 2});
      for (let y = 0; y < 66; y += 11) { b.hline(0, 151, y, 'papelVelho', 2); b.hline(0, 151, y + 1, 'papelVelho', 5); }
      for (let x = 0; x < 152; x += 22) for (let y = 0; y < 66; y += 11) b.vline(x + ((y / 11) % 2 ? 11 : 0), y, y + 10, 'papelVelho', 2);
      terra(b, 0, 66, 152, 34, {seed: 4});
      const x = 70, y = 26;
      b.shadeFn(x - 14, y + 6, 28, 40, (u, v) => -.7);
      b.rect(x - 3, y + 4, 7, 7, 'latao', 3); b.hline(x - 3, x + 3, y + 4, 'latao', 5); b.vline(x + 3, y + 5, y + 10, 'latao', 4);
      b.rect(x - 1, y + 11, 4, 5, 'latao', 4); b.vline(x + 2, y + 11, y + 15, 'latao', 5);
      b.rect(x - 2, y + 16, 6, 3, 'latao', 3); b.px(x - 2, y + 19, 'latao', 2); b.px(x + 2, y + 19, 'latao', 2);
      b.rect(x - 7, y - 2, 15, 5, 'latao', 4); b.hline(x - 7, x + 7, y - 2, 'latao', 6); b.hline(x - 6, x + 6, y + 2, 'latao', 2);
      b.ellipse(x, y - 5, 7, 3, 'vermelho', 3); b.ellipse(x, y - 6, 6, 2.4, 'vermelho', 4); b.px(x + 3, y - 7, 'vermelho', 5);
      b.vline(x, y - 8, y - 4, 'metal', 4);
      b.rect(x + 8, y + 8, 4, 4, 'verde', 3); b.line(x + 12, y + 10, x + 40, y + 30, 'verde', 2); b.line(x + 12, y + 11, x + 40, y + 31, 'verde', 3);
      b.line(x + 40, y + 30, x + 56, y + 40, 'verde', 2);
      b.rect(x - 12, 62, 24, 4, 'concreto', 3); b.hline(x - 12, x + 11, 62, 'concreto', 5);
      b.ellipse(x + 2, 84, 20, 6, 'agua', 2); b.ellipse(x, 83, 13, 4, 'agua', 3);
      for (let i = 0; i < 16; i++) { const gx = 6 + i * 9; b.px(gx, 64 + (i % 3), 'folha', 2); b.px(gx + 1, 65 + (i % 2), 'folha', 1); }
      b.rect(112, 44, 28, 22, 'madeira', 2); b.hline(112, 139, 44, 'madeira', 4); b.rect(116, 48, 20, 14, 'preto', 1); b.hline(116, 135, 48, 'preto', 0);
    },
    /* Filtro de barro em cima do móvel, com torneirinha e copo. */
    filtro_barro(b, e) {
      azulejos(b, 0, 0, 152, 66, {rampa: 'papel', base: 5, tam: 8, seed: 8});
      ladrilho(b, 0, 66, 152, 34, {rampa: 'sepia', base: 3, tam: 12});
      b.rect(10, 64, 132, 6, 'madeira', 3); b.hline(10, 141, 64, 'madeira', 5); b.hline(10, 141, 69, 'madeira', 1);
      portasArmario(b, 14, 70, 124, 24, {rampa: 'madeira', base: 2});
      const cx = 66;
      contato(b, cx - 20, 62, 40, 3);
      b.ellipse(cx, 60, 20, 6, 'ambar', 2);
      b.rect(cx - 20, 38, 40, 22, 'ambar', 3);
      for (let i = 0; i < 40; i++) { const t = i / 39; b.vline(cx - 20 + i, 38, 59, 'ambar', t < .18 ? 1 : t < .34 ? 2 : t > .86 ? 4 : t > .7 ? 5 : 3); }
      b.ellipse(cx, 38, 20, 6, 'ambar', 4); b.ellipse(cx, 37, 18, 5, 'ambar', 5);
      b.ellipse(cx, 35, 14, 4.4, 'ambar', 4); b.ellipse(cx, 33, 12, 3.6, 'ambar', 5); b.ellipse(cx, 31, 5, 2, 'ambar', 6);
      b.rect(cx - 22, 47, 44, 4, 'ambar', 2); b.hline(cx - 22, cx + 21, 47, 'ambar', 5); b.hline(cx - 22, cx + 21, 50, 'ambar', 1);
      for (let i = 0; i < 6; i++) b.px(cx - 16 + i * 7, 43 + (i % 2), 'ambar', 2);
      b.rect(cx - 2, 52, 5, 4, 'palido', 5); b.hline(cx - 2, cx + 2, 52, 'palido', 7); b.rect(cx - 4, 56, 9, 3, 'palido', 6); b.vline(cx, 59, 61, 'palido', 4);
      b.rect(cx + 30, 52, 12, 12, 'palido', 6); b.hline(cx + 30, cx + 41, 52, 'palido', 7); b.rect(cx + 31, 56, 10, 7, 'agua', 4); b.hline(cx + 31, cx + 40, 56, 'agua', 6);
      b.rect(10, 18, 24, 30, 'papel', 5); b.frame(10, 18, 24, 30, 'papel', 2); b.text(22, 26, 'AGUA', 'tinta', 1, {font: '3x5', align: 'center'}); b.text(22, 34, 'FRIA', 'tinta', 1, {font: '3x5', align: 'center'});
    },
    /* Chafariz de praça. */
    chafariz(b, e) {
      ceuFundo(b, 0, 0, 152, 46);
      for (let i = 0; i < 5; i++) { const cx = 14 + i * 34, r = 9 + (i % 3) * 3; b.sphere(cx, 42 - r / 2, r, r * .8, 'folha', 1, 3); b.rect(cx - 1, 42, 3, 8, 'madeira', 2); }
      b.rect(0, 46, 152, 12, 'concreto', 3); b.hline(0, 151, 46, 'concreto', 5);
      ladrilho(b, 0, 56, 152, 44, {rampa: 'concreto', base: 4, tam: 14, seed: 2});
      const cx = 74, cy = 74;
      contato(b, cx - 40, 86, 80, 4);
      b.ellipse(cx, cy, 44, 16, 'concreto', 2);
      b.ellipse(cx, cy, 41, 14, 'concreto', 5);
      b.ellipse(cx, cy + 1, 36, 11, 'agua', 2);
      b.ellipse(cx, cy + 1, 34, 10, 'agua', 3);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; b.px(cx + Math.cos(a) * 26, cy + 1 + Math.sin(a) * 7, 'latao', 3); }
      b.ellipse(cx, cy - 2, 14, 5, 'concreto', 4); b.rect(cx - 5, cy - 18, 10, 16, 'concreto', 4);
      b.vline(cx - 5, cy - 18, cy - 3, 'concreto', 2); b.vline(cx + 4, cy - 18, cy - 3, 'concreto', 6);
      b.ellipse(cx, cy - 20, 12, 4, 'concreto', 5); b.ellipse(cx, cy - 21, 10, 3, 'concreto', 6);
      b.rect(cx - 2, cy - 26, 4, 6, 'concreto', 4); b.ellipse(cx, cy - 27, 4, 2, 'concreto', 6);
      b.speckle(cx - 36, cy - 2, 72, 10, 'folha', 1, .05, K.rng(4));
    },
    /* Bica de bambu saindo da pedra. */
    bica(b, e) {
      ceuFundo(b, 0, 0, 152, 26);
      b.rect(0, 18, 152, 82, 'concreto', 2);
      for (let i = 0; i < 16; i++) pedra(b, (i * 43) % 150, 20 + ((i * 37) % 56), 9 + (i % 4) * 5, {seed: i + 1, base: 2 + (i % 3)});
      b.shadeFn(0, 18, 152, 82, (x, y) => (y - 18) / 82 * -1.2 + .25);
      grama(b, 0, 84, 152, 16, {seed: 6});
      for (let i = 0; i < 9; i++) { const fx = 8 + i * 17; for (let k = 0; k < 5; k++) b.px(fx + (k % 3), 88 - k * 3 - (i % 2), 'grama', 4); }
      const x0 = 44, y0 = 40;
      b.rect(x0, y0, 48, 6, 'grama', 3); b.hline(x0, x0 + 47, y0, 'grama', 5); b.hline(x0, x0 + 47, y0 + 5, 'grama', 1);
      for (const nx of [x0 + 14, x0 + 32]) { b.vline(nx, y0, y0 + 5, 'grama', 2); b.vline(nx + 1, y0, y0 + 5, 'grama', 4); }
      b.rect(x0 + 46, y0 + 1, 4, 5, 'grama', 2); b.px(x0 + 49, y0 + 3, 'grama', 1);
      b.ellipse(98, 80, 24, 8, 'concreto', 1); b.ellipse(98, 79, 20, 6, 'agua', 3); b.ellipse(98, 79, 16, 4, 'agua', 4); b.ellipse(96, 78, 8, 2, 'agua', 5);
      b.speckle(78, 74, 40, 8, 'folha', 2, .05, K.rng(3));
    },
    /* Poço de manivela, com balde em cima ou lá embaixo. */
    poco(b, e) {
      ceuFundo(b, 0, 0, 152, 40);
      grama(b, 0, 40, 152, 60, {seed: 8});
      const cx = 74;
      contato(b, cx - 32, 84, 64, 5);
      b.ellipse(cx, 60, 32, 12, 'concreto', 2);
      b.rect(cx - 32, 60, 64, 26, 'concreto', 3);
      b.ellipse(cx, 86, 32, 10, 'concreto', 2);
      for (let y = 60; y < 86; y += 6) for (let x = cx - 32; x < cx + 32; x += 11) {
        const off = ((y - 60) / 6) % 2 ? 5 : 0;
        b.rect(x + off, y, 10, 5, 'concreto', 3 + ((x + y) % 3 === 0 ? 1 : -1));
        b.hline(x + off, x + off + 9, y, 'concreto', 5); b.vline(x + off, y, y + 4, 'concreto', 1);
      }
      b.ellipse(cx, 58, 28, 10, 'concreto', 5); b.ellipse(cx, 59, 24, 8, 'preto', 1);
      if (!e.balde) { b.ellipse(cx, 62, 18, 6, 'preto', 0); b.ellipse(cx + 2, 62, 8, 3, 'agua', 1); }
      b.speckle(cx - 30, 56, 60, 6, 'folha', 2, .1, K.rng(5));
      for (const px of [cx - 26, cx + 22]) { b.rect(px, 16, 5, 44, 'madeira', 3); b.vline(px, 16, 59, 'madeira', 1); b.vline(px + 4, 16, 59, 'madeira', 5); }
      b.poly([[cx - 36, 16], [cx + 34, 16], [cx + 24, 8], [cx - 26, 8]], 'madeira', 4);
      b.hline(cx - 36, cx + 33, 16, 'madeira', 5); b.hline(cx - 26, cx + 23, 8, 'madeira', 6);
      b.rect(cx - 22, 24, 44, 5, 'madeira', 2); b.hline(cx - 22, cx + 21, 24, 'madeira', 4);
      b.rect(cx + 22, 26, 8, 2, 'metal', 4); b.rect(cx + 28, 26, 2, 8, 'metal', 5); b.rect(cx + 24, 32, 6, 2, 'metal', 3); b.px(cx + 30, 33, 'madeira', 4);
      const cordaFim = e.balde ? 34 : 56;
      b.vline(cx, 29, cordaFim, 'papelVelho', 3); b.vline(cx + 1, 29, cordaFim, 'papelVelho', 2);
      if (e.balde) {
        b.poly([[cx - 8, 34], [cx + 8, 34], [cx + 6, 48], [cx - 6, 48]], 'metal', 3);
        b.hline(cx - 8, cx + 7, 34, 'metal', 5); b.vline(cx + 6, 35, 47, 'metal', 4); b.vline(cx - 7, 35, 47, 'metal', 1);
        b.rect(cx - 6, 36, 12, 5, 'agua', 4); b.hline(cx - 6, cx + 5, 36, 'agua', 6);
        for (let i = 0; i < 5; i++) b.px(cx - 6 + i * 3, 30 + (i % 2), 'metal', 4);
      }
    },
    /* Córrego entre pedras. */
    corrego(b, e) {
      grama(b, 0, 0, 152, 34, {seed: 3});
      b.rect(0, 30, 152, 44, 'agua', 2);
      for (let y = 30; y < 74; y++) for (let x = 0; x < 152; x++) {
        const n = Math.sin((x + y * 2) / 7) + Math.sin((x - y) / 4) * .6;
        b.px(x, y, 'agua', 2 + (n > .8 ? 2 : n > .1 ? 1 : 0));
      }
      for (let i = 0; i < 12; i++) pedra(b, (i * 47) % 148, 28 + ((i * 31) % 44), 5 + (i % 4) * 3, {seed: i + 5, base: 3});
      grama(b, 0, 70, 152, 30, {seed: 9});
      for (let i = 0; i < 10; i++) { const fx = 6 + i * 16; for (let k = 0; k < 5; k++) b.px(fx + (k % 2), 74 - k * 3, 'grama', 4); }
      b.shadeFn(0, 30, 152, 44, (x, y) => (Math.sin(x / 9) > .7 ? .6 : 0));
    },
    /* Cocho do gado: água parada, verde de limo. */
    cocho(b, e) {
      ceuFundo(b, 0, 0, 152, 24);
      for (let i = 0; i < 4; i++) { b.rect(8 + i * 42, 8, 5, 36, 'madeira', 2); b.hline(8 + i * 42, 12 + i * 42, 8, 'madeira', 4); b.vline(12 + i * 42, 9, 43, 'madeira', 1); }
      for (const y of [16, 26, 36]) { b.hline(0, 151, y, 'madeira', 3); b.hline(0, 151, y + 1, 'madeira', 1); for (let x = 4; x < 152; x += 14) b.px(x, y - 1, 'madeira', 4); }
      grama(b, 0, 40, 152, 60, {seed: 12});
      terra(b, 16, 78, 120, 20, {seed: 5});
      const cx = 74, topo = 48;
      contato(b, cx - 44, 88, 88, 5);
      b.ellipse(cx, topo, 46, 11, 'madeira', 4);
      b.ellipse(cx, topo, 42, 9, 'verde', 1);
      b.ellipse(cx, topo + 1, 40, 8, 'verde', 2);
      b.speckle(cx - 40, topo - 6, 80, 13, 'verde', 3, .12, K.rng(7));
      b.speckle(cx - 40, topo - 6, 80, 13, 'folha', 1, .07, K.rng(8));
      for (let i = 0; i < 5; i++) { const px = cx - 30 + i * 15; b.ellipse(px, topo + (i % 2 ? -2 : 2), 4, 1.6, 'verde', 4); }
      b.rect(cx - 46, topo, 92, 22, 'madeira', 3);
      for (let y = topo; y < topo + 22; y += 6) { b.hline(cx - 46, cx + 45, y, 'madeira', 4); b.hline(cx - 46, cx + 45, y + 1, 'madeira', 2); }
      b.vline(cx - 46, topo, topo + 21, 'madeira', 1); b.vline(cx + 45, topo, topo + 21, 'madeira', 5);
      b.ellipse(cx, topo + 22, 46, 6, 'madeira', 2);
      for (const px of [cx - 38, cx + 30]) { b.rect(px, topo + 20, 8, 18, 'madeira', 2); b.vline(px, topo + 20, topo + 37, 'madeira', 1); b.vline(px + 7, topo + 20, topo + 37, 'madeira', 4); }
      for (let i = 0; i < 6; i++) { const px = cx - 34 + i * 13; b.px(px, topo - 4 + (i % 3), 'sepia', 3); b.px(px + 1, topo - 3 + (i % 2), 'sepia', 2); }
      for (const [px, py] of [[cx - 30, 40], [cx + 26, 36], [cx + 8, 42]]) { b.px(px, py, 'preto', 2); b.px(px + 1, py, 'preto', 1); }
    },
    /* Chuveiro elétrico: caixa branca, registro e o ralo. */
    chuveiro(b, e) {
      azulejos(b, 0, 0, 152, 80, {rampa: 'palido', base: 5, tam: 8, seed: 5, faixa: 44});
      ladrilho(b, 0, 80, 152, 20, {rampa: 'palido', base: 3, tam: 10});
      const cx = 74;
      b.rect(cx - 2, 0, 5, 8, 'metal', 3); b.vline(cx + 2, 0, 7, 'metal', 5);
      b.bevel(cx - 17, 8, 34, 15, 'palido', 6, 7, 3);
      b.rect(cx - 13, 11, 26, 4, 'palido', 4); b.hline(cx - 13, cx + 12, 11, 'palido', 2); b.hline(cx - 13, cx + 12, 14, 'palido', 7);
      b.rect(cx + 4, 17, 11, 4, 'preto', 2); b.hline(cx + 4, cx + 14, 17, 'preto', 3); b.px(cx + 13, 18, 'vermelho', 4); b.px(cx + 6, 18, 'palido', 6);
      b.text(cx - 6, 17, '4400W', 'palido', 2, {font: '3x5'});
      b.poly([[cx - 14, 23], [cx + 14, 23], [cx + 10, 31], [cx - 10, 31]], 'palido', 5);
      b.hline(cx - 14, cx + 13, 23, 'palido', 7); b.vline(cx + 13, 24, 30, 'palido', 6); b.vline(cx - 13, 24, 30, 'palido', 3);
      b.hline(cx - 10, cx + 9, 31, 'palido', 2);
      for (let i = 0; i < 9; i++) b.px(cx - 8 + i * 2, 31, 'preto', 1);
      b.line(cx - 2, 2, cx - 18, 0, 'preto', 2); b.line(cx + 2, 3, cx + 20, 1, 'vermelho', 2);
      b.rect(cx + 24, 34, 10, 9, 'metal', 4); b.hline(cx + 24, cx + 33, 34, 'metal', 6); b.ellipse(cx + 29, 31, 6, 3, 'metal', 5); b.px(cx + 32, 30, 'metal', 6);
      b.vline(cx + 28, 43, 79, 'metal', 3); b.vline(cx + 29, 43, 79, 'metal', 5); b.rect(cx + 26, 78, 6, 2, 'metal', 2);
      b.rect(0, 0, 14, 84, 'ceu', 2); b.vline(13, 0, 83, 'ceu', 4); b.vline(0, 0, 83, 'ceu', 1);
      for (let y = 0; y < 84; y += 7) b.hline(1, 12, y, 'ceu', 3);
      for (let y = 4; y < 84; y += 14) { b.px(3, y, 'ceu', 5); b.px(9, y + 6, 'ceu', 5); }
      b.ellipse(cx, 90, 11, 4, 'metal', 2); b.ellipse(cx, 90, 8, 3, 'preto', 1);
      for (let i = 0; i < 4; i++) b.hline(cx - 6, cx + 5, 89 + i, 'metal', 3);
      b.ellipse(cx - 4, 92, 22, 6, 'agua', 2);
      b.rect(116, 60, 18, 5, 'metal', 4); b.rect(118, 65, 14, 16, 'papel', 5); b.hline(118, 131, 65, 'papel', 7); b.hline(118, 131, 80, 'papel', 3);
    },
    /* Mangueira enrolada no gancho. */
    mangueira(b, e) {
      reboco(b, 0, 0, 152, 70, {rampa: 'papelVelho', base: 4, seed: 4, manchas: 1});
      for (let y = 0; y < 70; y += 12) b.hline(0, 151, y, 'papelVelho', 3);
      terra(b, 0, 70, 152, 30, {seed: 7});
      const cx = 64, cy = 40;
      b.rect(cx - 3, 12, 7, 5, 'metal', 4); b.hline(cx - 3, cx + 3, 12, 'metal', 6); b.px(cx + 4, 16, 'metal', 3);
      b.shadeFn(cx - 30, 18, 60, 44, (x, y) => -.6);
      for (let i = 0; i < 4; i++) {
        const r = 24 - i * 5;
        for (let a = 0; a < 90; a++) {
          const ang = a / 90 * Math.PI * 2, px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r * .86;
          const lit = Math.sin(ang) < -.2 ? 4 : Math.cos(ang) > .4 ? 3 : 2;
          b.px(px, py, 'verde', lit); b.px(px, py + 1, 'verde', lit - 1); b.px(px, py + 2, 'verde', 1);
        }
      }
      b.ellipse(cx, cy, 5, 4, 'papelVelho', 4);
      b.line(cx + 24, cy + 6, cx + 46, 76, 'verde', 3); b.line(cx + 25, cy + 7, cx + 47, 77, 'verde', 2); b.line(cx + 26, cy + 8, cx + 48, 78, 'verde', 1);
      b.rect(cx + 46, 74, 12, 5, 'latao', 4); b.hline(cx + 46, cx + 57, 74, 'latao', 6); b.px(cx + 58, 76, 'latao', 3);
      b.rect(cx - 52, 28, 7, 7, 'latao', 3); b.hline(cx - 52, cx - 46, 28, 'latao', 5); b.rect(cx - 50, 35, 3, 7, 'latao', 4);
      b.ellipse(cx - 49, 25, 6, 2.4, 'vermelho', 3); b.px(cx - 46, 24, 'vermelho', 5);
      b.line(cx - 46, 42, cx - 24, 48, 'verde', 3); b.line(cx - 46, 43, cx - 24, 49, 'verde', 2);
      b.ellipse(cx + 54, 86, 16, 5, 'agua', 2); b.ellipse(cx + 52, 85, 10, 3, 'agua', 3);
    },
    /* Vaso sanitário com caixa acoplada. */
    privada(b, e) {
      azulejos(b, 0, 0, 152, 76, {rampa: 'papel', base: 4, tam: 8, seed: 11, faixa: 30});
      ladrilho(b, 0, 76, 152, 24, {rampa: 'palido', base: 3, tam: 10});
      const cx = 74;
      contato(b, cx - 20, 88, 40, 4);
      b.rect(cx - 22, 20, 44, 22, 'palido', 6); b.hline(cx - 22, cx + 21, 20, 'palido', 7); b.vline(cx + 21, 20, 41, 'palido', 5); b.vline(cx - 22, 20, 41, 'palido', 4);
      b.rect(cx - 24, 16, 48, 5, 'palido', 7); b.hline(cx - 24, cx + 23, 16, 'palido', 7); b.hline(cx - 24, cx + 23, 20, 'palido', 3);
      b.rect(cx + 8, 17, 10, 3, 'metal', 5); b.hline(cx + 8, cx + 17, 17, 'metal', 6);
      if (e.tampaAberta) {
        b.poly([[cx - 18, 44], [cx + 18, 44], [cx + 16, 48], [cx - 16, 48]], 'palido', 4);
        b.rect(cx - 17, 42, 34, 3, 'palido', 5);
      }
      b.ellipse(cx, 52, 19, 8, 'palido', 6); b.ellipse(cx, 52, 16, 6, 'palido', 3);
      b.ellipse(cx, 53, 13, 5, 'agua', 3); b.ellipse(cx, 53, 11, 4, 'agua', 4);
      b.hline(cx - 18, cx + 17, 46, 'palido', 7);
      b.poly([[cx - 16, 56], [cx + 16, 56], [cx + 11, 86], [cx - 11, 86]], 'palido', 5);
      b.vline(cx - 15, 57, 85, 'palido', 3); b.vline(cx + 15, 57, 85, 'palido', 7);
      b.ellipse(cx, 88, 12, 3, 'palido', 4);
      b.shadeFn(cx - 16, 56, 32, 32, (x, y) => (x - cx) / 16 * .7 - .2);
      b.rect(cx + 30, 40, 12, 3, 'metal', 4); b.ellipse(cx + 36, 46, 6, 5, 'papel', 6); b.ellipse(cx + 36, 46, 2, 2, 'papelVelho', 3);
      b.rect(cx + 32, 50, 8, 10, 'papel', 7); b.hline(cx + 32, cx + 39, 60, 'papel', 4);
      b.rect(cx - 46, 62, 10, 22, 'metal', 2); b.hline(cx - 46, cx - 37, 62, 'metal', 4); b.rect(cx - 44, 64, 6, 6, 'preto', 1);
      b.px(cx - 30, 30, 'preto', 2); b.px(cx - 29, 30, 'preto', 1);
    }
  };
  zonas('pia', [{id: 'beber', x: 56, y: 30, w: 36, h: 24}, {id: 'armario', x: 22, y: 54, w: 104, h: 22}]);
  zonas('bebedouro', [{id: 'beber', x: 55, y: 20, w: 42, h: 20}, {id: 'copo', x: 112, y: 14, w: 14, h: 34}]);
  zonas('bebedouro_galao', [{id: 'beber', x: 58, y: 44, w: 40, h: 16}, {id: 'copo', x: 110, y: 56, w: 24, h: 20}]);
  zonas('torneira', [{id: 'beber', x: 62, y: 20, w: 26, h: 28}]);
  zonas('filtro_barro', [{id: 'beber', x: 58, y: 50, w: 20, h: 14}, {id: 'copo', x: 94, y: 52, w: 14, h: 14}]);
  zonas('chafariz', [{id: 'beber', x: 56, y: 46, w: 36, h: 30}]);
  zonas('bica', [{id: 'beber', x: 46, y: 38, w: 48, h: 12}]);
  zonas('poco', [{id: 'balde', x: 92, y: 22, w: 20, h: 16}, {id: 'beber', x: 56, y: 32, w: 36, h: 24}]);
  zonas('corrego', [{id: 'beber', x: 30, y: 34, w: 90, h: 34}]);
  zonas('cocho', [{id: 'beber', x: 34, y: 52, w: 80, h: 18}]);
  zonas('chuveiro', [{id: 'beber', x: 60, y: 10, w: 30, h: 16}, {id: 'cabeca', x: 60, y: 26, w: 30, h: 20}]);
  zonas('mangueira', [{id: 'beber', x: 100, y: 66, w: 30, h: 14}, {id: 'encher', x: 48, y: 20, w: 44, h: 40}]);
  zonas('privada', [{id: 'descarga', x: 50, y: 14, w: 48, h: 10}, {id: 'beber', x: 55, y: 44, w: 38, h: 16}]);

  /* ------------------------------------------------------------ peças comuns das interfaces */
  /* Botão grande com ícone: o que as fontes, o servir e a árvore usam. */
  function botaoAcao(ctx, ui, id, x, y, w, h, acao, {sel = false, t = 0, desligado = false} = {}) {
    const hover = !desligado && ui.region('acao', x, y, w, h, {data: id, silent: true});
    const perigo = !!acao.perigo || !!acao.confirmando;
    const base = perigo ? 'vermelho' : 'roxo';
    const face = desligado ? cor('carvao', 2) : hover ? cor(base, perigo ? 3 : 3) : cor(base, perigo ? 2 : 1);
    const borda = desligado ? cor('carvao', 4) : sel || hover ? '#ffd18c' : perigo ? cor('vermelho', 4) : '#a44590';
    U.rect(ctx, x + 3, y + 3, w, h, '#07030acc');
    U.rect(ctx, x, y, w, h, face);
    U.outline(ctx, x, y, w, h, borda, 2);
    if (sel && !desligado) { const p = (Math.sin(t * 6) * .5 + .5) * 2; U.outline(ctx, x - 2 - p, y - 2 - p, w + 4 + p * 2, h + 4 + p * 2, '#ffd18c88', 2); }
    ctx.drawImage(U.icon(icone(acao.icone)), x + 7, y + Math.round((h - 24) / 2), 24, 24);
    const rot = acao.confirmando ? acao.confirmar || 'Tem certeza?' : acao.rotulo;
    const linhas = K.wrap(rot, w - 44).slice(0, 2);
    linhas.forEach((l, i) => escreve(ctx, l, x + 38, y + Math.round((h - linhas.length * 11) / 2) + i * 11 + 2,
      desligado ? '#7a6a80' : acao.confirmando ? '#ffd9c8' : '#ffe6f7'));
    if (sel && !desligado) { ctx.fillStyle = '#ffd18c'; for (let i = 0; i < 3; i++) ctx.fillRect(x + w - 12 + (2 - i), y + h / 2 - 4 + i * 2, 2 + i * 4, 2); }
    return hover;
  }
  /* Faixa de texto embaixo da cena (a fala do objeto, o aviso do mestre). */
  function faixaTexto(ctx, str, {y = 238, x = 10, w = 462, cor: c = TXT.claro} = {}) {
    if (!str) return;
    const linhas = K.wrap(String(str), w - 16).slice(0, 2);
    const h = linhas.length * 11 + 8;
    U.rect(ctx, x + 3, y + 3, w, h, '#07030a99');
    U.rect(ctx, x, y, w, h, '#1b0a20e8');
    U.outline(ctx, x, y, w, h, '#4d2a52', 2);
    linhas.forEach((l, i) => escreve(ctx, l, x + 8, y + 4 + i * 11, c));
  }
  /* A moldura da cena de close-up, com sombra e borda. */
  function molduraCena(ctx, canvas) {
    U.rect(ctx, CENA.x + 4, CENA.y + 4, CENA.w, CENA.h, '#05020899');
    U.blit(ctx, canvas, CENA.x, CENA.y);
    U.outline(ctx, CENA.x - 2, CENA.y - 2, CENA.w + 4, CENA.h + 4, '#2c1430', 2);
  }
  /* Itens desenhados dentro de um móvel aberto (armário da pia, caixa
     acoplada, bandeja da estufa): devolve as regiões clicáveis. */
  const spriteItem = id => {
    const d = root.ITEM_DEFS?.[id];
    if (!d?.grid) return null;
    return U.art('ic:item:' + id, Math.max(...d.grid.map(r => r.length)), d.grid.length, b => {
      d.grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.' && d.palette[ch]) b.px(x, y, 0, 0); } });
    });
  };
  const spritesItens = new Map();
  function itemCanvas(id) {
    if (spritesItens.has(id)) return spritesItens.get(id);
    const d = root.ITEM_DEFS?.[id];
    let c = null;
    if (d?.grid) {
      c = root.document.createElement('canvas');
      c.width = Math.max(1, ...d.grid.map(r => r.length)); c.height = d.grid.length;
      const g = c.getContext('2d');
      d.grid.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
          const ch = row[x]; let run = 1;
          while (row[x + run] === ch) run++;
          if (ch !== '.' && d.palette?.[ch]) { g.fillStyle = d.palette[ch]; g.fillRect(x, y, run, 1); }
          x += run;
        }
      });
    }
    spritesItens.set(id, c);
    return c;
  }
  function desenharItens(ctx, ui, lista, x, y, w, {escala = 2, t = 0, prefixo = 'item'} = {}) {
    const regioes = [];
    let px = x;
    for (const it of lista) {
      const c = itemCanvas(it.id);
      const iw = (c ? c.width : 16) * escala, ih = (c ? c.height : 16) * escala;
      if (px + iw > x + w) break;
      const hot = ui.region(prefixo, px - 3, y - 3, iw + 6, ih + 6, {data: it.key || it.id, silent: true});
      if (c) { ctx.imageSmoothingEnabled = false; ctx.save(); ctx.globalAlpha = .45; ctx.drawImage(c, snap(px + 3), snap(y + 4), iw, ih); ctx.restore(); ctx.drawImage(c, snap(px), snap(y + (hot ? -2 : 0)), iw, ih); }
      if (hot) U.ants(ctx, px - 4, y - 4, iw + 8, ih + 8, t);
      if ((it.qtd || 1) > 1) { U.rect(ctx, px + iw - 10, y + ih - 9, 10, 9, '#140619dd'); escreve(ctx, String(it.qtd), px + iw - 8, y + ih - 8, '#ffd18c'); }
      regioes.push({it, x: px, y, w: iw, h: ih});
      px += iw + 10;
    }
    return regioes;
  }
  /* Entrega um item para a bolsa, com aviso. */
  function entregar(sys, id, qtd = 1, dados = null, titulo = 'PEGOU') {
    const d = root.ITEM_DEFS?.[id];
    const nome = (dados?.nome && id === 'chave' ? `Chave: ${dados.nome}` : d?.label || id) + (qtd > 1 ? ` (${qtd})` : '');
    if (!temBolsa(sys)) { avisar(sys, titulo, `${nome} · prévia sem bolsa`, 'alerta'); return 'sem'; }
    const r = seguro(() => sys.itens.dar(id, qtd, dados), false);
    if (!r) { avisar(sys, 'BOLSA CHEIA', `${nome} não coube`, 'alerta'); som(sys, 'erro'); return false; }
    if (r === 'chao') { avisar(sys, 'CAIU NO CHÃO', `A bolsa está cheia: ${nome}`, 'alerta'); som(sys, 'objeto'); return 'chao'; }
    avisar(sys, titulo, nome, d?.kind === 'food' || d?.kind === 'ingredient' ? 'comida' : 'bolsa');
    som(sys, 'objeto');
    return 'bolsa';
  }
  /* Leva o personagem até o objeto antes de agir (ou age logo, se já está perto). */
  function aproximar(clue, sys, depois) {
    const x = seguro(() => sys.stage?.anchorWorldX?.(clue.anchor), null);
    const pos = sys.exploracao?.personagem;
    if (!Number.isFinite(x) || !pos || !Number.isFinite(pos.x)) { depois(x ?? null); return true; }
    const r = seguro(() => sys.exploracao?.alcance?.(clue), null);
    const perto = r ? pos.x >= r.x0 - 20 && pos.x <= r.x1 + 20 : Math.abs(pos.x - x) < 50;
    if (perto) { depois(x); return true; }
    const alvo = r ? clamp(pos.x, r.x0 + 8, r.x1 - 8) : x;
    if (sys.consumo?.irAte) { sys.consumo.irAte(alvo, () => depois(x)); return true; }
    if (sys.exploracao?.andarAte) { sys.exploracao.andarAte(alvo, () => depois(x), 6); return true; }
    depois(x);
    return true;
  }
  /* Dispara um pedido de consumo (com animação, quando `consumo.js` está ligado). */
  function pedir(sys, pedido) {
    const C = Comida();
    if (!C) return 'Sem comidas.';
    const r = C.iniciarPedido(pedido, {consumo: sys.consumo, toast: (a, b, c) => avisar(sys, a, b, c), necessidades: sys.necessidades, itens: sys.itens});
    if (r !== true) avisar(sys, 'AGORA NÃO', r, 'alerta');
    return r;
  }

  /* ------------------------------------------------------------ água animada por estilo */
  const ANIMA_FONTE = {
    pia(ctx, st, t, e) { const x = AX(74), y = AY(42); if (st.aguaT > 0) jato(ctx, x + 10, y + 4, x + 10, AY(50), t, {grossura: 3}); else pingando(ctx, x + 10, y + 6, AY(50), t, {periodo: 2.2}); },
    torneira(ctx, st, t) { const x = AX(74), y = AY(46); if (st.aguaT > 0) jato(ctx, x + 2, y, x + 2, AY(78), t, {grossura: 3}); else pingando(ctx, x + 2, y, AY(80), t, {periodo: 2.6}); },
    mangueira(ctx, st, t) { const x = AX(124), y = AY(76); if (st.aguaT > 0) jato(ctx, x, y, x + 16, AY(84), t, {grossura: 3}); else pingando(ctx, x, y, AY(84), t, {periodo: 3}); },
    bebedouro(ctx, st, t) {
      const x = AX(76), y = AY(24);
      if (st.aguaT > 0) { for (let i = 0; i <= 10; i++) { const u = i / 10, px = x + u * 14, py = y - Math.sin(u * Math.PI) * 10 + u * u * 8; ctx.fillStyle = rgba('agua', i % 2 ? 6 : 5, .9); ctx.fillRect(snap(px), snap(py), 2, 2); } }
      else pingando(ctx, x, y + 4, AY(30), t, {periodo: 3.4});
    },
    bebedouro_galao(ctx, st, t) {
      const x = AX(66), y = AY(30);
      for (let i = 0; i < 3; i++) { const ph = ((t * .4 + i * .33) % 1); ctx.fillStyle = rgba('agua', 7, .6); ctx.fillRect(snap(x + i * 12), snap(y - ph * 30), 2, 2); }
      if (st.aguaT > 0) jato(ctx, AX(66), AY(52), AX(66), AY(60), t, {grossura: 2});
    },
    filtro_barro(ctx, st, t) { const x = AX(66), y = AY(59); if (st.aguaT > 0) jato(ctx, x, y, x, AY(63), t, {grossura: 2}); else pingando(ctx, x, y, AY(64), t, {periodo: 3.8}); },
    chafariz(ctx, st, t) {
      const cx = AX(74), cy = AY(52);
      for (const dir of [-1, 1]) for (let i = 0; i <= 9; i++) {
        const u = i / 9, px = cx + dir * u * 26, py = cy - Math.sin(u * Math.PI) * 14 + u * u * 22;
        ctx.fillStyle = rgba('agua', i % 3 ? 5 : 7, .85);
        ctx.fillRect(snap(px + Math.sin(t * 9 + i) * 1), snap(py), 2, 2);
      }
      for (let i = 0; i < 4; i++) { const ph = (t * .5 + i * .25) % 1; ctx.fillStyle = rgba('agua', 6, .3 * (1 - ph)); ctx.fillRect(snap(cx - 20 - ph * 30), snap(AY(76) + i * 2), snap(40 + ph * 60), 2); }
    },
    bica(ctx, st, t) {
      const x = AX(92), y = AY(45);
      jato(ctx, x, y, x + 6, AY(74), t, {grossura: 3});
      for (let i = 0; i < 3; i++) { const ph = (t * .8 + i * .33) % 1; ctx.fillStyle = rgba('agua', 6, .35 * (1 - ph)); ctx.fillRect(snap(AX(96) - ph * 22), snap(AY(76) + i * 2), snap(ph * 44), 2); }
    },
    poco(ctx, st, t, e) {
      const cx = AX(74);
      if (st.baldeT > 0) { const k = 1 - st.baldeT / 1.8; ctx.fillStyle = cor('papelVelho', 3); ctx.fillRect(snap(cx), snap(AY(29)), 2, snap((e.balde ? 8 + k * 20 : 28 - k * 20))); }
      if (e.balde) { const b = Math.sin(t * 2) * 2; ctx.fillStyle = rgba('agua', 6, .5); ctx.fillRect(snap(cx - 10 + b), snap(AY(37)), 20, 2); }
    },
    corrego(ctx, st, t) {
      for (let i = 0; i < 16; i++) {
        const y = AY(32) + (i % 8) * 10, x = (AX(0) + ((i * 53 + t * 40) % 300));
        ctx.fillStyle = rgba('agua', 6, .35);
        ctx.fillRect(snap(x), snap(y), snap(10 + (i % 3) * 6), 2);
      }
    },
    cocho(ctx, st, t) {
      for (let i = 0; i < 3; i++) { const ph = (t * .3 + i * .4) % 1; ctx.fillStyle = rgba('verde', 4, .25); ctx.fillRect(snap(AX(40) + ph * 60), snap(AY(56) + i * 4), 12, 2); }
      const fx = AX(74) + Math.sin(t * 3) * 30, fy = AY(44) + Math.cos(t * 4.3) * 8;
      ctx.fillStyle = cor('preto', 2); ctx.fillRect(snap(fx), snap(fy), 2, 2);
    },
    chuveiro(ctx, st, t) {
      const cx = AX(74), y = AY(23);
      if (st.aguaT > 0) {
        for (let i = 0; i < 22; i++) { const u = (i % 11) / 10, ph = ((t * 2.2 + i * .13) % 1); ctx.fillStyle = rgba('agua', i % 3 ? 5 : 7, .8); ctx.fillRect(snap(cx - 18 + u * 36), snap(y + ph * 60), 2, 4); }
        vaporSobe(ctx, cx, AY(84), t, {n: 3, alt: 30, largura: 14, forca: .8});
      } else pingando(ctx, cx, y, AY(86), t, {periodo: 2.8});
    },
    privada(ctx, st, t) {
      const cx = AX(74);
      if (st.descargaT > 0) {
        const k = 1 - st.descargaT / 2.2;
        for (let i = 0; i < 10; i++) { const a = k * 12 + i * .7, r = 18 - k * 12; ctx.fillStyle = rgba('agua', i % 2 ? 5 : 6, .8); ctx.fillRect(snap(cx + Math.cos(a) * r), snap(AY(53) + Math.sin(a) * r * .38), 2, 2); }
      } else { const w = Math.sin(t * 1.4) * 2; ctx.fillStyle = rgba('agua', 5, .35); ctx.fillRect(snap(cx - 10 + w), snap(AY(52)), 20, 2); }
    }
  };

  /* ------------------------------------------------------------ tipo fonte_agua */
  const OPCOES_FONTE = [['bebedouro', 'Bebedouro de pressão'], ['bebedouro_galao', 'Bebedouro de galão'], ['torneira', 'Torneira de parede'],
    ['pia', 'Pia'], ['filtro_barro', 'Filtro de barro'], ['chafariz', 'Chafariz'], ['bica', 'Bica'], ['poco', 'Poço'], ['corrego', 'Córrego'],
    ['cocho', 'Cocho'], ['chuveiro', 'Chuveiro'], ['mangueira', 'Mangueira'], ['privada', 'Vaso sanitário (privada)']];
  const dadosFonte = clue => {
    const d = clue.data || {}, F = fonteDe(d.estilo);
    return {...d, estilo: FONTES[chave(d.estilo)] ? chave(d.estilo) : 'torneira',
      qualidade: Comida()?.QUALIDADES_AGUA.includes(chave(d.qualidade)) ? chave(d.qualidade) : F.qualidade,
      altura: ['chao', 'baixa', 'media', 'alta'].includes(chave(d.altura)) ? chave(d.altura) : F.altura};
  };
  /* Uma pia de cozinha e uma de banheiro são a mesma pista, com desenhos
     diferentes: o mestre escolhe, ou o nome da pista decide. */
  function piaDeCozinha(clue, d) {
    const m = chave(d.movel || '');
    if (m === 'cozinha') return true;
    if (m === 'banheiro') return false;
    return /cozinha|copa|louca|pratos/.test(chave(`${clue.name} ${clue.note || ''}`));
  }
  function itensDoArmario(d) {
    const txt = texto(d.armario);
    if (!txt) return {texto: '', itens: []};
    const partes = txt.split('|').map(s => s.trim());
    const listaTxt = partes.length > 1 ? partes[partes.length - 1] : '';
    const IB = root.InteracoesBasicas;
    const itens = IB?.parseItens ? IB.parseItens(listaTxt) : listaTxt.split(/[,;]/).map(s => parseItem(s)).filter(Boolean).map((it, i) => ({id: it.id, qtd: it.qtd, dados: it.dados, key: `${it.id}#${i}`}));
    return {texto: partes.length > 1 ? partes.slice(0, -1).join(' | ') : partes[0], itens};
  }

  Tipos.register('fonte_agua', {
    label: 'Fonte de água', icon: 'gole', sound: 'clique', categoria: 'interacao', veil: .72,
    fields: [
      {id: 'estilo', label: 'O que é', kind: 'select', options: OPCOES_FONTE},
      {id: 'qualidade', label: 'Qualidade da água', kind: 'select', options: [['potavel', 'Potável'], ['fervida', 'Fervida (potável)'], ['duvidosa', 'Duvidosa (dor de barriga)'], ['contaminada', 'Contaminada (infecção)']]},
      {id: 'altura', label: 'Altura (como ele se abaixa)', kind: 'select', options: [['chao', 'No chão'], ['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']]},
      {id: 'movel', label: 'Desenho da pia', kind: 'select', options: [['auto', 'Automático (pelo nome)'], ['banheiro', 'Pia de banheiro'], ['cozinha', 'Pia de cozinha']]},
      {id: 'goles', label: 'Goles até secar (vazio = nunca seca)', kind: 'text', placeholder: 'ex.: 3'},
      {id: 'armario', label: 'Armário embaixo / caixa acoplada: texto | itens', kind: 'textarea', rows: 2, placeholder: 'Produtos de limpeza e um balde. | bandage'},
      {id: 'armarioNome', label: 'Nome do compartimento', kind: 'text', placeholder: 'Abrir o armário'},
      {id: 'examinar', label: 'Detalhe ao olhar de perto', kind: 'textarea', rows: 2},
      {id: 'mensagem', label: 'Mensagem (o que se vê ao chegar perto)', kind: 'text'}],
    defaults: {estilo: 'torneira', qualidade: 'potavel', altura: 'media', movel: 'auto', goles: '', armario: '', armarioNome: '', examinar: '', mensagem: ''},
    rotuloAcao: clue => (chave(clue?.data?.estilo) === 'privada' ? 'Olhar a privada' : 'Beber'),
    /* Perto: age. Longe: anda até lá e age. Sem escolha nenhuma: bebe direto. */
    activate(clue, sys, info = {}) {
      const d = dadosFonte(clue), F = fonteDe(d.estilo), mem = memoriaDe(sys, clue);
      const {secou} = golesDaFonte(d, mem);
      const acoes = acoesDaFonte(d, {temGarrafa: Comida()?.temGarrafaParaEncher(sys.itens), mem, secou});
      return aproximar(clue, sys, () => {
        if (acoes.length === 1 && acoes[0].id === 'beber' && !F.privada) { this.executar('beber', null, clue, sys, {direto: true}); return; }
        if (!acoes.length) { avisar(sys, 'SECOU', texto(d.mensagem, 'Não sai mais uma gota.'), 'agua'); return; }
        sys.open(clue, {source: info.source === 'jogadores' ? 'jogadores' : 'cena'});
      });
    },
    create(clue, sys) {
      const mem = memoriaDe(sys, clue);
      if (!Array.isArray(mem.pegos)) mem.pegos = [];
      return {mem, sel: 0, t: 0, aguaT: 0, baldeT: 0, descargaT: 0, confirmando: null, aviso: '', avisoT: 0};
    },
    describe: st => ({sel: st.sel, balde: !!st.mem?.balde, armario: !!st.mem?.armario, bebidos: st.mem?.bebidos || 0, pegos: [...(st.mem?.pegos || [])]}),
    acoes(clue, sys, st) {
      const d = dadosFonte(clue), {secou} = golesDaFonte(d, st.mem);
      const lista = acoesDaFonte(d, {temGarrafa: Comida()?.temGarrafaParaEncher(sys.itens), mem: st.mem, secou});
      if (st.mem.armario) for (const a of lista) if (a.id === 'armario') a.rotulo = 'Fechar o armário';
      return lista.map(a => (st.confirmando === a.id ? {...a, confirmando: true} : a));
    },
    render(ctx, ui, st, clue, sys) {
      const dt = clamp(ui.dt || 0, 0, .1), d = dadosFonte(clue), F = fonteDe(d.estilo);
      st.t += dt;
      for (const k of ['aguaT', 'baldeT', 'descargaT', 'avisoT']) st[k] = Math.max(0, st[k] - dt);
      if (!st.avisoT) st.aviso = '';
      const acoes = this.acoes(clue, sys, st);
      st.sel = clamp(st.sel, 0, Math.max(0, acoes.length - 1));
      const coz = piaDeCozinha(clue, d);
      const arm = itensDoArmario(d);
      const dentro = arm.itens.filter(it => !st.mem.pegos.includes(it.key));
      const est = {cozinha: coz, armario: !!texto(d.armario) || (d.estilo === 'pia' && !coz), aberto: !!st.mem.armario, balde: !!st.mem.balde,
        comItens: !!st.mem.armario && dentro.length > 0, tampaAberta: true};
      const chaveArte = `fonte:${d.estilo}:${coz ? 'c' : 'b'}:${est.armario ? 'a' : 'p'}:${est.aberto ? 1 : 0}:${est.balde ? 1 : 0}:${est.comItens ? 'i' : 'v'}`;
      const canvas = arte(chaveArte, CENA.aw, CENA.ah, b => (PINTA_FONTE[d.estilo] || PINTA_FONTE.torneira)(b, est));
      molduraCena(ctx, canvas);
      seguro(() => ANIMA_FONTE[d.estilo]?.(ctx, st, ui.t, est));
      // itens dentro do armário aberto
      if (st.mem.armario && arm.itens.length) {
        const livres = dentro;
        if (livres.length) desenharItens(ctx, ui, livres.map(it => ({id: it.id, qtd: it.qtd, key: it.key})), AX(28), AY(58), 200, {escala: 1, t: ui.t, prefixo: 'pegar'});
        else escreve(ctx, 'vazio', AX(30), AY(64), '#c99cc7');
      }
      // partes clicáveis do próprio objeto
      for (const z of ZONAS_FONTE[d.estilo] || []) {
        if (!acoes.some(a => a.id === z.id)) continue;
        const hot = ui.region('acao', AX(z.x), AY(z.y), z.w * 2, z.h * 2, {data: z.id, cursor: 'pointer', silent: true});
        if (hot) { U.ants(ctx, AX(z.x), AY(z.y), z.w * 2, z.h * 2, ui.t); const a = acoes.find(x => x.id === z.id); U.tooltip(ctx, a.confirmando ? a.confirmar || 'Tem certeza?' : a.rotulo, AX(z.x) + z.w, AY(z.y) - 6); }
      }
      // botões
      acoes.forEach((a, i) => { const y = BOT.y + i * (BOT.h + BOT.gap); if (y + BOT.h < 236) botaoAcao(ctx, ui, a.id, BOT.x, y, BOT.w, BOT.h, a, {sel: i === st.sel, t: ui.t}); });
      if (!acoes.length) { U.rect(ctx, BOT.x, BOT.y, BOT.w, 36, '#1b0a20e8'); escreve(ctx, 'Secou.', BOT.x + 10, BOT.y + 12, TXT.dica); }
      // estado da fonte
      const {infinita, restam} = golesDaFonte(d, st.mem);
      if (!infinita) { U.rect(ctx, BOT.x, 218, BOT.w, 14, '#140619cc'); escreve(ctx, restam > 0 ? `ainda dá ${restam} ${restam === 1 ? 'gole' : 'goles'}` : 'secou', BOT.x + 8, 221, TXT.dica); }
      faixaTexto(ctx, st.aviso || texto(d.mensagem, F.texto));
      U.header(ctx, ui, clue.name, st.confirmando ? 'clique de novo para confirmar' : 'clique no objeto ou no botão · W confirma · Esc fecha', 'gole');
    },
    /* ---- o que cada botão faz ---- */
    executar(id, st, clue, sys, {direto = false} = {}) {
      const C = Comida();
      const d = dadosFonte(clue), F = fonteDe(d.estilo), mem = st ? st.mem : memoriaDe(sys, clue);
      const alvoX = seguro(() => sys.stage?.anchorWorldX?.(clue.anchor), null);
      const info = {alvoX: Number.isFinite(alvoX) ? alvoX : undefined, altura: d.altura, qualidade: d.qualidade};
      const fecha = () => { if (!direto) seguro(() => sys.close()); };
      const {secou, infinita} = golesDaFonte(d, mem);
      if (id === 'beber') {
        if (F.privada && st && st.confirmando !== 'beber') { st.confirmando = 'beber'; som(sys, 'clique'); return; }
        if (st) st.confirmando = null;
        if (secou) { avisar(sys, 'SECOU', 'Não sai mais água.', 'agua'); return; }
        const pode = sys.necessidades?.podeBeber?.();
        if (pode && pode.ok === false) { avisar(sys, 'AGORA NÃO', pode.motivo || '', 'alerta'); return; }
        som(sys, F.som);
        const pedido = {tipo: 'fonte', estilo: F.anim, rotulo: F.privada ? 'Bebendo da privada' : `Bebendo ${F.nome.toLowerCase().startsWith('a') ? 'na ' : 'no '}${F.nome.toLowerCase()}`,
          ...info, goles: F.privada ? 1 : 3, cor: d.qualidade === 'contaminada' ? '#6a7a3a' : d.qualidade === 'duvidosa' ? '#8aa06a' : '#5aa8e0', cor2: '#e6f6ff',
          aoConfirmar: () => {
            mem.bebidos = (mem.bebidos || 0) + 1;
            const e = C.beberDaFonte(d.qualidade, {necessidades: sys.necessidades, minutos: sys.minutos, exploracao: sys.exploracao}, {privada: F.privada, mem});
            seguro(() => sys.emit('change'));
            mem.ultimaMensagem = e.mensagem;
            return true;
          },
          aoTerminar: r => { if (r !== 'cancelado') avisar(sys, F.privada ? 'BEBEU DA PRIVADA' : 'BEBEU', texto(d.mensagem, mem.ultimaMensagem || 'Água.'), 'agua'); }};
        fecha();
        pedir(sys, pedido);
        return;
      }
      if (id === 'encher') {
        if (secou) { avisar(sys, 'SECOU', 'Não sai mais água.', 'agua'); return; }
        if (!C.temGarrafaParaEncher(sys.itens)) { avisar(sys, 'SEM GARRAFA', 'Nenhuma garrafa vazia na bolsa.', 'garrafa'); som(sys, 'erro'); return; }
        som(sys, F.som);
        const pedido = {tipo: 'encher', estilo: 'garrafa', rotulo: 'Enchendo a garrafa', ...info, cor: '#5aa8e0', cor2: '#2f62bf',
          aoConfirmar: () => { const r = C.encherGarrafa(sys.itens, d.qualidade); if (!r.ok) { avisar(sys, 'SEM GARRAFA', r.motivo || '', 'garrafa'); return false; } mem.bebidos = (mem.bebidos || 0); seguro(() => sys.emit('change')); return true; },
          aoTerminar: r => { if (r !== 'cancelado') avisar(sys, 'GARRAFA CHEIA', d.qualidade === 'potavel' || d.qualidade === 'fervida' ? 'Três goles de água boa.' : 'Três goles — dessa água.', 'garrafa'); }};
        fecha();
        pedir(sys, pedido);
        return;
      }
      if (id === 'rosto' || id === 'cabeca') {
        som(sys, F.som);
        if (st) st.aguaT = 1.6;
        const molhar = () => {
          seguro(() => sys.necessidades?.curar?.('moleza'));
          avisar(sys, id === 'rosto' ? 'LAVOU O ROSTO' : 'MOLHOU A CABEÇA', 'A água fria acorda.', 'rosto');
        };
        if (id === 'cabeca') { molhar(); if (st) { st.aviso = 'Água escorrendo pelo pescoço. Melhorou.'; st.avisoT = 3; } return; }
        const pedido = {tipo: 'fonte', estilo: 'maos', rotulo: 'Lavando o rosto', ...info, goles: 1, cor: '#5aa8e0', cor2: '#e6f6ff',
          aoConfirmar: () => true, aoTerminar: r => { if (r !== 'cancelado') molhar(); }};
        fecha();
        pedir(sys, pedido);
        return;
      }
      if (id === 'balde' || id === 'soltar') {
        mem.balde = id === 'balde';
        if (st) st.baldeT = 1.8;
        som(sys, id === 'balde' ? 'poco' : 'balde_agua');
        if (st) { st.aviso = id === 'balde' ? 'O balde sobe pingando, com um cheiro de terra molhada.' : 'A corda corre e o balde some lá embaixo.'; st.avisoT = 4; }
        seguro(() => sys.emit('change'));
        return;
      }
      if (id === 'descarga') {
        som(sys, 'descarga');
        if (st) { st.descargaT = 2.2; st.aviso = 'A água roda e some. A caixa começa a encher de novo.'; st.avisoT = 4; }
        return;
      }
      if (id === 'armario') {
        mem.armario = !mem.armario;
        som(sys, mem.armario ? 'armario' : 'fechar');
        seguro(() => sys.emit('change'));
        return;
      }
      if (id === 'olhar') {
        const t = texto(d.examinar);
        if (!t) return;
        seguro(() => sys.push(root.normalize({id: `${clue.id}:olhar`, inline: true, name: clue.name, type: 'exame', marker: 'discreta', conclusions: [],
          data: {texto: t, detalhe: '', item: '', fundo: 'escuro'}})));
      }
    },
    action(id, st, clue, sys, info = {}) {
      if (id === 'acao') { const alvo = String(info.data); if (st.confirmando && st.confirmando !== alvo) st.confirmando = null; this.executar(alvo, st, clue, sys); return; }
      if (id === 'pegar') {
        const arm = itensDoArmario(dadosFonte(clue)), it = arm.itens.find(x => x.key === String(info.data));
        if (!it || st.mem.pegos.includes(it.key)) return;
        const r = entregar(sys, it.id, it.qtd, it.dados);
        if (r) { st.mem.pegos.push(it.key); seguro(() => sys.emit('change')); }
      }
    },
    key(e, st, clue, sys) {
      const acoes = this.acoes(clue, sys, st);
      if (!acoes.length) return false;
      const k = e.key, code = e.code;
      if (k === 'ArrowUp' || code === 'KeyW' || k === 'Enter' || k === ' ' || code === 'Space' || code === 'KeyE') { this.executar(acoes[clamp(st.sel, 0, acoes.length - 1)].id, st, clue, sys); return true; }
      if (k === 'ArrowDown' || code === 'KeyS' || k === 'ArrowRight' || code === 'KeyD') { st.sel = (st.sel + 1) % acoes.length; st.confirmando = null; som(sys, 'clique'); return true; }
      if (k === 'ArrowLeft' || code === 'KeyA') { st.sel = (st.sel + acoes.length - 1) % acoes.length; st.confirmando = null; som(sys, 'clique'); return true; }
      if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; if (i < acoes.length) { st.sel = i; this.executar(acoes[i].id, st, clue, sys); } return true; }
      return false;
    }
  });

  /* ================================================================ cozinha
     Caderno de receitas à esquerda, a estação em close-up no meio, a barra de
     ponto embaixo dela e a bandeja de ingredientes da bolsa no rodapé. */
  const COZ = {
    caderno: {x: 6, y: 28, w: 128, h: 184},
    est: {x: 140, y: 28, w: 200, h: 162, aw: 100, ah: 81},
    barra: {x: 148, y: 158, w: 184, h: 16},
    painel: {x: 346, y: 28, w: 128, h: 184},
    bandeja: {x: 6, y: 218, w: 468, h: 48}
  };
  const EX = a => COZ.est.x + a * 2, EY = a => COZ.est.y + a * 2;
  /* pinta um retângulo em pixels de arte dentro da estação */
  const ep = (ctx, x, y, w, h, rampa, nivel) => ret(ctx, EX(x), EY(y), w * 2, h * 2, rampa, nivel);

  /* ---- arte das estações (o aparelho, sem chama nem comida) ---- */
  const ESTACAO_ARTE = {
    fogao(b) {
      azulejos(b, 0, 0, 100, 20, {rampa: 'papel', base: 5, tam: 7, seed: 9});
      b.rect(0, 20, 100, 8, 'concreto', 3); b.hline(0, 99, 20, 'concreto', 5); b.hline(0, 99, 27, 'concreto', 1);
      b.rect(0, 28, 100, 53, 'palido', 6);
      b.hline(0, 99, 28, 'palido', 7); b.shadeFn(0, 28, 100, 53, (x, y) => (y - 28) / 53 * -.8);
      for (const [bx, by, r] of [[30, 38, 9], [70, 38, 9], [26, 58, 13], [72, 58, 13]]) {
        b.ellipse(bx, by, r + 2, (r + 2) * .55, 'palido', 4);
        b.ellipse(bx, by, r, r * .5, 'carvao', 2);
        b.ellipse(bx, by, r * .45, r * .25, 'carvao', 4); b.ellipse(bx, by, r * .3, r * .16, 'carvao', 1);
        for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2; b.line(bx + Math.cos(ang) * r * .4, by + Math.sin(ang) * r * .22, bx + Math.cos(ang) * r, by + Math.sin(ang) * r * .52, 'carvao', 3); }
      }
      b.rect(0, 70, 100, 11, 'palido', 5); b.hline(0, 99, 70, 'palido', 7); b.hline(0, 99, 80, 'palido', 2);
      for (let i = 0; i < 4; i++) { const kx = 14 + i * 24; b.ellipse(kx, 76, 5, 4, 'carvao', 3); b.ellipse(kx, 75, 4, 3, 'carvao', 5); b.vline(kx, 72, 75, 'carvao', 1); b.ellipse(kx, 78, 6, 1.6, 'palido', 3); }
      b.rect(88, 30, 10, 14, 'vermelho', 3); b.hline(88, 97, 30, 'vermelho', 5);
    },
    fogareiro(b) {
      b.rect(0, 0, 100, 46, 'carvao', 2); b.speckle(0, 0, 100, 46, 'carvao', 1, .1, K.rng(3));
      b.rect(0, 46, 100, 35, 'madeira', 3);
      for (let y = 46; y < 81; y += 7) { b.hline(0, 99, y, 'madeira', 1); veiosMadeira(b, 0, y + 1, 100, 6, 'madeira', 3, y); }
      b.rect(14, 34, 22, 26, 'azul', 3); b.ellipse(25, 34, 11, 4, 'azul', 5); b.ellipse(25, 60, 11, 3, 'azul', 1);
      b.rect(20, 28, 10, 7, 'metal', 4); b.ellipse(25, 28, 5, 2, 'metal', 5); b.rect(18, 24, 14, 4, 'metal', 3);
      b.rect(16, 42, 18, 6, 'papel', 5); b.text(25, 43, 'GAS', 'vermelho', 3, {font: '3x5', align: 'center'});
      b.rect(34, 30, 20, 3, 'metal', 3); b.vline(54, 30, 34, 'metal', 4);
      b.ellipse(66, 42, 18, 7, 'metal', 2); b.ellipse(66, 41, 15, 5.4, 'metal', 4);
      b.ellipse(66, 40, 8, 3, 'carvao', 3); b.ellipse(66, 40, 5, 2, 'carvao', 1);
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; b.line(66 + Math.cos(ang) * 6, 40 + Math.sin(ang) * 2.4, 66 + Math.cos(ang) * 15, 41 + Math.sin(ang) * 5, 'metal', 3); }
      for (const [lx, ly] of [[52, 48], [80, 48], [66, 52]]) { b.rect(lx, ly, 3, 10, 'metal', 3); b.vline(lx, ly, ly + 9, 'metal', 1); }
      b.ellipse(66, 62, 20, 5, 'metal', 1);
      b.rect(48, 30, 6, 4, 'vermelho', 3); b.ellipse(51, 29, 3, 1.6, 'vermelho', 5);
    },
    chapa(b) {
      azulejos(b, 0, 0, 100, 16, {rampa: 'papel', base: 5, tam: 7, seed: 6});
      b.rect(0, 16, 100, 6, 'metal', 5); b.hline(0, 99, 16, 'metal', 6); b.hline(0, 99, 21, 'metal', 2);
      for (let x = 2; x < 100; x += 9) b.vline(x, 17, 20, 'metal', 4);
      b.rect(0, 22, 100, 40, 'metal', 2);
      for (let y = 22; y < 62; y++) for (let x = 0; x < 100; x++) {
        const t = (y - 22) / 40;
        b.px(x, y, 'metal', t < .2 ? 4 : t < .45 ? 3 : t < .8 ? 2 : 1);
      }
      /* chapa usada: brilho do óleo em cima, tostado no meio, marcas da espátula */
      b.hline(4, 95, 24, 'metal', 6); b.hline(6, 92, 25, 'metal', 5);
      for (let i = 0; i < 5; i++) b.hline(8 + (i % 2) * 6, 88 - (i % 3) * 7, 30 + i * 6, 'metal', 4);
      /* o meio da chapa é mais escuro de tanto uso, com marcas fracas da espátula */
      b.shadeFn(6, 26, 88, 32, (x, y) => { const d = Math.hypot((x - 50) / 42, (y - 43) / 15); return d < 1 ? -(1 - d) * 1.5 : 0; });
      b.speckle(16, 32, 68, 20, 'ambar', 1, .045, K.rng(11));
      for (let i = 0; i < 3; i++) b.hline(26 + i * 7, 60 + i * 8, 37 + i * 6, 'ambar', 1);
      b.speckle(6, 26, 88, 32, 'metal', 5, .012, K.rng(7));
      b.rect(0, 62, 100, 5, 'metal', 1); b.hline(0, 99, 62, 'metal', 3); b.rect(4, 63, 92, 3, 'ambar', 1);
      b.rect(0, 67, 100, 14, 'metal', 4); b.hline(0, 99, 67, 'metal', 6); b.hline(0, 99, 80, 'metal', 2);
      for (let i = 0; i < 3; i++) { const kx = 22 + i * 28; b.ellipse(kx, 74, 6, 5, 'carvao', 3); b.ellipse(kx, 73, 5, 4, 'carvao', 5); b.vline(kx, 70, 73, 'vermelho', 4); b.ellipse(kx, 77, 7, 1.6, 'metal', 2); }
      b.rect(72, 22, 24, 3, 'metal', 5); b.hline(72, 95, 22, 'metal', 6);
      b.rect(80, 25, 4, 14, 'madeira', 3); b.px(80, 39, 'madeira', 1); b.rect(76, 24, 12, 2, 'metal', 5);
      b.rect(6, 4, 14, 9, 'papel', 6); b.hline(6, 19, 4, 'papel', 7); b.hline(6, 19, 12, 'papel', 3); b.text(13, 6, 'PAO', 'madeira', 2, {font: '3x5', align: 'center'});
    },
    fogueira(b) {
      b.rect(0, 0, 100, 40, 'azul', 0); b.speckle(0, 0, 100, 34, 'papel', 6, .02, K.rng(8));
      terra(b, 0, 34, 100, 47, {seed: 6});
      b.shadeFn(0, 34, 100, 47, (x, y) => -.5 + (y - 34) / 47 * .3);
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; pedra(b, 50 + Math.cos(a) * 30, 58 + Math.sin(a) * 13, 7 + (i % 3) * 2, {seed: i + 2, base: 2}); }
      for (const [x0, y0, x1, y1] of [[36, 60, 64, 52], [38, 54, 62, 62], [44, 64, 58, 50]]) {
        b.line(x0, y0, x1, y1, 'madeira', 2); b.line(x0, y0 + 1, x1, y1 + 1, 'madeira', 1); b.line(x0, y0 - 1, x1, y1 - 1, 'madeira', 3);
      }
      b.ellipse(50, 58, 14, 5, 'carvao', 1); b.speckle(38, 54, 24, 8, 'fogo', 2, .18, K.rng(4));
      for (const [lx, ly] of [[26, 40], [74, 40]]) { b.line(lx, ly, 50, 30, 'metal', 3); b.line(lx + 1, ly, 51, 30, 'metal', 2); }
      b.rect(40, 28, 22, 2, 'metal', 4); b.hline(40, 61, 28, 'metal', 5);
      b.vline(50, 22, 28, 'metal', 3); b.rect(46, 20, 9, 3, 'metal', 4);
    },
    cafeteira(b) {
      azulejos(b, 0, 0, 100, 34, {rampa: 'papel', base: 5, tam: 7, seed: 4});
      b.rect(0, 34, 100, 6, 'concreto', 4); b.hline(0, 99, 34, 'concreto', 6); b.hline(0, 99, 39, 'concreto', 2);
      b.rect(0, 40, 100, 41, 'madeira', 2); portasArmario(b, 4, 44, 92, 34, {rampa: 'madeira', base: 2});
      const x0 = 30;
      b.rect(x0, 2, 40, 12, 'carvao', 3); b.hline(x0, x0 + 39, 2, 'carvao', 5); b.vline(x0 + 39, 3, 13, 'carvao', 4);
      b.rect(x0 + 4, 4, 32, 8, 'ceu', 2); b.hline(x0 + 4, x0 + 35, 4, 'ceu', 4);
      b.rect(x0 + 4, 7, 32, 5, 'agua', 3); b.hline(x0 + 4, x0 + 35, 7, 'agua', 5);
      b.rect(x0 + 2, 14, 36, 4, 'carvao', 2); b.hline(x0 + 2, x0 + 37, 14, 'carvao', 4);
      b.poly([[x0 + 10, 18], [x0 + 30, 18], [x0 + 26, 25], [x0 + 14, 25]], 'papel', 4);
      b.hline(x0 + 10, x0 + 29, 18, 'papel', 6); b.poly([[x0 + 12, 19], [x0 + 28, 19], [x0 + 25, 24], [x0 + 15, 24]], 'carvao', 1);
      b.rect(x0, 25, 40, 3, 'carvao', 3); b.hline(x0, x0 + 39, 25, 'carvao', 5);
      b.vline(x0 + 2, 14, 32, 'carvao', 2); b.vline(x0 + 37, 14, 32, 'carvao', 4);
      b.rect(x0 + 6, 46, 28, 4, 'carvao', 4); b.hline(x0 + 6, x0 + 33, 46, 'carvao', 6);
      b.rect(x0 + 2, 50, 36, 2, 'carvao', 2);
      b.rect(x0 + 8, 44, 4, 3, 'fosforo', 4, K.EMISSIVE);
      b.rect(74, 36, 18, 10, 'papel', 5); b.hline(74, 91, 36, 'papel', 7);
      for (let i = 0; i < 3; i++) { b.rect(76 + i * 6, 30, 5, 6, 'palido', 6); b.hline(76 + i * 6, 80 + i * 6, 30, 'palido', 7); }
    },
    micro_ondas(b) {
      azulejos(b, 0, 0, 100, 14, {rampa: 'papel', base: 5, tam: 7, seed: 2});
      b.rect(0, 14, 100, 4, 'concreto', 4); b.rect(0, 18, 100, 63, 'madeira', 2);
      const x0 = 6, y0 = 8, w = 88, h = 56;
      b.rect(x0, y0, w, h, 'carvao', 3); b.hline(x0, x0 + w - 1, y0, 'carvao', 5); b.vline(x0 + w - 1, y0, y0 + h - 1, 'carvao', 4); b.hline(x0, x0 + w - 1, y0 + h - 1, 'carvao', 1);
      b.vline(x0, y0, y0 + h - 1, 'carvao', 2);
      // porta com janela
      b.rect(x0 + 3, y0 + 4, 60, h - 9, 'carvao', 2); b.frame(x0 + 3, y0 + 4, 60, h - 9, 'carvao', 5);
      b.rect(x0 + 7, y0 + 8, 52, h - 17, 'carvao', 1);
      b.frame(x0 + 7, y0 + 8, 52, h - 17, 'carvao', 0);
      for (let yy = y0 + 9; yy < y0 + h - 10; yy += 3) for (let xx = x0 + 8; xx < x0 + 58; xx += 3) b.px(xx, yy, 'carvao', 3);
      // prato giratório lá dentro
      b.ellipse(x0 + 33, y0 + h - 16, 20, 5, 'palido', 2); b.ellipse(x0 + 33, y0 + h - 17, 17, 4, 'palido', 3);
      b.shadeFn(x0 + 7, y0 + 8, 52, h - 17, (x, y) => ((y - y0 - 8) / (h - 17)) * -.8 + .2);
      // painel
      b.rect(x0 + 66, y0 + 6, 20, 11, 'preto', 0); b.frame(x0 + 66, y0 + 6, 20, 11, 'carvao', 4);
      b.text(x0 + 76, y0 + 9, '00:00', 'fosforo', 5, {font: '3x5', align: 'center', flags: K.EMISSIVE});
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { b.rect(x0 + 67 + j * 7, y0 + 22 + i * 7, 5, 5, 'carvao', 4); b.hline(x0 + 67 + j * 7, x0 + 71 + j * 7, y0 + 22 + i * 7, 'carvao', 6); b.hline(x0 + 67 + j * 7, x0 + 71 + j * 7, y0 + 26 + i * 7, 'carvao', 1); }
      b.rect(x0 + 64, y0 + 4, 2, h - 9, 'carvao', 5);
      b.rect(x0 + 59, y0 + 18, 4, 22, 'metal', 4); b.vline(x0 + 62, y0 + 18, y0 + 39, 'metal', 6); b.vline(x0 + 59, y0 + 18, y0 + 39, 'metal', 2);
      b.rect(x0 + 8, y0 + h - 7, 52, 3, 'carvao', 2);
    },
    sanduicheira(b) {
      azulejos(b, 0, 0, 100, 24, {rampa: 'papel', base: 5, tam: 7, seed: 5});
      b.rect(0, 24, 100, 8, 'concreto', 4); b.hline(0, 99, 24, 'concreto', 6);
      b.rect(0, 32, 100, 49, 'madeira', 2); portasArmario(b, 6, 40, 88, 36, {rampa: 'madeira', base: 2});
      // tampa levantada, inclinada para trás
      b.poly([[24, 4], [78, 4], [82, 22], [20, 22]], 'carvao', 4);
      b.hline(24, 77, 4, 'carvao', 6); b.hline(20, 81, 22, 'carvao', 2);
      b.poly([[28, 8], [74, 8], [77, 20], [25, 20]], 'metal', 3);
      for (let x = 28; x < 76; x += 5) b.line(x, 8, x - 2, 20, 'metal', 2);
      b.ellipse(51, 14, 22, 5, 'metal', 4);
      b.rect(46, 1, 10, 4, 'carvao', 5); b.hline(46, 55, 1, 'carvao', 6);
      // base com as chapas
      b.rect(16, 26, 70, 8, 'carvao', 3); b.hline(16, 85, 26, 'carvao', 5); b.hline(16, 85, 33, 'carvao', 1);
      b.ellipse(51, 28, 30, 4, 'carvao', 4);
      b.rect(20, 27, 62, 5, 'metal', 3);
      for (let x = 22; x < 80; x += 5) b.vline(x, 27, 31, 'metal', 2);
      b.ellipse(51, 29, 28, 3, 'metal', 4);
      b.rect(12, 34, 78, 5, 'carvao', 2); b.hline(12, 89, 34, 'carvao', 4); b.hline(12, 89, 38, 'carvao', 1);
      b.rect(70, 22, 12, 4, 'carvao', 5); b.px(74, 23, 'vermelho', 5, K.EMISSIVE); b.px(78, 23, 'fosforo', 5, K.EMISSIVE);
      b.line(90, 36, 99, 46, 'carvao', 2); b.line(90, 37, 99, 47, 'carvao', 1);
    },
    chaleira(b) {
      azulejos(b, 0, 0, 100, 30, {rampa: 'papel', base: 5, tam: 7, seed: 7});
      b.rect(0, 30, 100, 6, 'concreto', 4); b.hline(0, 99, 30, 'concreto', 6); b.hline(0, 99, 35, 'concreto', 2);
      b.rect(0, 36, 100, 45, 'madeira', 2); portasArmario(b, 4, 42, 92, 36, {rampa: 'madeira', base: 2});
      const cx = 38;
      b.ellipse(cx, 36, 20, 5, 'carvao', 3); b.ellipse(cx, 35, 17, 4, 'carvao', 5);
      b.rect(cx - 16, 12, 32, 22, 'palido', 6); b.ellipse(cx, 12, 16, 5, 'palido', 7); b.ellipse(cx, 34, 16, 4, 'palido', 4);
      b.vline(cx - 16, 13, 33, 'palido', 3); b.vline(cx + 15, 13, 33, 'palido', 7);
      b.rect(cx + 6, 16, 8, 16, 'ceu', 2); b.frame(cx + 6, 16, 8, 16, 'palido', 3);
      b.rect(cx + 7, 22, 6, 9, 'agua', 4); b.hline(cx + 7, cx + 12, 22, 'agua', 6);
      b.poly([[cx - 16, 16], [cx - 22, 20], [cx - 22, 30], [cx - 16, 30]], 'palido', 5);
      b.rect(cx - 6, 6, 12, 7, 'palido', 5); b.ellipse(cx, 6, 6, 2, 'palido', 7);
      b.rect(cx + 14, 18, 3, 6, 'carvao', 3); b.px(cx + 15, 20, 'fosforo', 5, K.EMISSIVE);
      b.rect(72, 46, 20, 16, 'palido', 6); b.ellipse(82, 46, 10, 3, 'palido', 7); b.ellipse(82, 62, 10, 3, 'palido', 4);
      b.rect(74, 48, 16, 8, 'papel', 4); b.rect(76, 40, 12, 7, 'papelVelho', 4); b.hline(76, 87, 40, 'papelVelho', 6);
    },
    bancada(b) {
      azulejos(b, 0, 0, 100, 30, {rampa: 'papel', base: 5, tam: 7, seed: 3});
      b.rect(0, 30, 100, 7, 'concreto', 4); b.hline(0, 99, 30, 'concreto', 6); b.hline(0, 99, 36, 'concreto', 2);
      for (let i = 0; i < 100; i += 3) if (K.hash2(i, 31, 5) > .5) b.px(i, 32, 'concreto', 5);
      b.rect(0, 37, 100, 44, 'madeira', 2); portasArmario(b, 4, 42, 92, 36, {rampa: 'madeira', base: 2});
      b.rect(10, 18, 26, 12, 'madeira', 4); b.hline(10, 35, 18, 'madeira', 5); b.px(36, 22, 'madeira', 3);
      // pote de vidro com açúcar e uma caneca, do lado da tábua
      b.rect(60, 16, 12, 14, 'ceu', 4); b.vline(60, 17, 29, 'ceu', 6); b.vline(71, 17, 29, 'ceu', 2);
      b.rect(61, 21, 10, 9, 'papel', 6); b.speckle(61, 21, 10, 9, 'papel', 7, .3, K.rng(13)); b.hline(61, 70, 21, 'papel', 7);
      b.rect(59, 12, 14, 4, 'metal', 4); b.hline(59, 72, 12, 'metal', 6); b.hline(59, 72, 15, 'metal', 2);
      b.rect(77, 20, 10, 10, 'palido', 6); b.hline(77, 86, 20, 'palido', 7); b.hline(77, 86, 29, 'palido', 3);
      b.ellipse(82, 20, 5, 2, 'sepia', 2); b.ellipse(82, 20, 3, 1, 'sepia', 3);
      b.vline(88, 22, 27, 'palido', 5); b.px(87, 21, 'palido', 6); b.px(87, 28, 'palido', 4);
      b.rect(44, 22, 4, 8, 'metal', 4); b.ellipse(46, 21, 3, 2, 'metal', 5);
    }
  };
  function veiosMadeira(b, x, y, w, h, rampa, base, seed) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const n = Math.sin((xx - x) / 7 + yy * 1.3 + seed) * .9 + K.hash2(xx >> 2, yy, seed) * .8;
      if (n > 1.2) b.px(xx, yy, rampa, base + 1); else if (n < -1.1) b.px(xx, yy, rampa, base - 1);
    }
  }
  /* Onde a panela fica e onde a chama aparece, por estação. */
  const ESTACAO_POS = {
    fogao: {vas: [50, 52], fogo: [50, 56], escala: 1},
    fogareiro: {vas: [66, 38], fogo: [66, 42], escala: 1},
    chapa: {vas: [50, 44], fogo: null, escala: 1},
    fogueira: {vas: [50, 30], fogo: [50, 56], escala: 1},
    cafeteira: {vas: [50, 44], fogo: null, escala: 1},
    micro_ondas: {vas: [38, 44], fogo: null, escala: 1},
    sanduicheira: {vas: [50, 42], fogo: null, escala: 1},
    chaleira: {vas: [38, 24], fogo: null, escala: 1},
    bancada: {vas: [50, 24], fogo: null, escala: 1}
  };

  /* ---- panelas, conteúdo e fogo (desenhados por quadro, em pixels de arte) ---- */
  function eElipse(ctx, cx, cy, rx, ry, rampa, nivel, alpha = 1) {
    ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = cor(rampa, nivel);
    for (let y = -Math.ceil(ry); y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) * (y / ry))));
      if (w > 0) ctx.fillRect(EX(cx - w), EY(cy + y), w * 4, 2);
    }
    ctx.restore();
  }
  const COR_COMIDA = {
    ovo: [['papel', 7], ['papel', 6], ['papel', 7], ['ambar', 4], ['ambar', 2], ['carvao', 1]],
    pao: [['ambar', 5], ['ambar', 4], ['ambar', 3], ['madeira', 2], ['madeira', 1], ['carvao', 1]],
    misto: [['ambar', 5], ['ambar', 4], ['ambar', 3], ['madeira', 2], ['madeira', 1], ['carvao', 1]],
    agua: [['agua', 3], ['agua', 4], ['agua', 5], ['agua', 5], ['agua', 6], ['carvao', 2]],
    leite: [['papel', 6], ['papel', 7], ['papel', 7], ['ambar', 5], ['ambar', 3], ['carvao', 2]],
    miojo: [['amarelo', 3], ['amarelo', 4], ['amarelo', 5], ['amarelo', 3], ['madeira', 2], ['carvao', 1]],
    marmita: [['papel', 4], ['papel', 5], ['papel', 6], ['ambar', 4], ['madeira', 2], ['carvao', 1]],
    pipoca: [['amarelo', 4], ['papel', 5], ['papel', 7], ['papel', 6], ['madeira', 2], ['carvao', 1]],
    cha: [['agua', 4], ['folha', 3], ['folha', 2], ['verde', 2], ['verde', 1], ['carvao', 2]],
    cafe: [['ambar', 2], ['madeira', 2], ['mogno', 2], ['mogno', 1], ['carvao', 2], ['carvao', 1]],
    soro: [['agua', 4], ['agua', 5], ['agua', 6], ['agua', 6], ['agua', 6], ['agua', 6]]
  };
  const corDoEstagio = (conteudo, est) => (COR_COMIDA[conteudo] || COR_COMIDA.agua)[clamp(est, 0, 5)];
  /* O que está dentro da panela/prato, por conteúdo e estágio. */
  function desenharConteudo(ctx, conteudo, cx, cy, est, p, t, {raio = 15} = {}) {
    const [rampa, nivel] = corDoEstagio(conteudo, est);
    const base = String(conteudo || '').replace(/2$/, '');
    if (base === 'agua' || base === 'cha' || base === 'soro' || base === 'cafe') {
      eElipse(ctx, cx, cy, raio, raio * .42, rampa, nivel);
      eElipse(ctx, cx, cy - 1, raio * .7, raio * .28, rampa, Math.min(7, nivel + 1));
      if (est >= 1 && base !== 'soro') bolhas(ctx, EX(cx - raio * .7), EY(cy), raio * 1.4 * 2, t, clamp((est - .5) / 3, 0, 1));
      if (base === 'soro') for (let i = 0; i < 4; i++) { const a = t * 6 + i * 1.6; ep(ctx, cx + Math.cos(a) * raio * .5, cy + Math.sin(a) * raio * .2, 1, 1, 'papel', 7); }
      return;
    }
    if (base === 'leite') {
      eElipse(ctx, cx, cy, raio, raio * .42, rampa, nivel);
      if (est >= 2) { eElipse(ctx, cx, cy - 1 - (est - 2), raio * (1 + (est - 2) * .06), raio * .34, 'papel', 7); for (let i = 0; i < 6; i++) ep(ctx, cx - raio + i * raio * .35, cy - 2 - (est - 2), 2, 1, 'papel', 6); }
      return;
    }
    if (base === 'ovo') {
      eElipse(ctx, cx, cy, raio * .8, raio * .38, rampa, nivel);
      eElipse(ctx, cx + 1, cy - 1, raio * .28, raio * .2, 'amarelo', est >= 4 ? 2 : est >= 3 ? 3 : 5);
      if (est >= 2) for (let i = 0; i < 5; i++) ep(ctx, cx - raio * .7 + i * raio * .3, cy + raio * .3, 2, 1, 'ambar', est >= 3 ? 2 : 4);
      return;
    }
    if (base === 'pao' || base === 'misto') {
      const w = raio * 1.3, h = raio * .5;
      ep(ctx, cx - w / 2, cy - h, w, h, rampa, nivel);
      ep(ctx, cx - w / 2, cy - h, w, 1, rampa, Math.min(7, nivel + 1));
      for (let i = 0; i < 3; i++) ep(ctx, cx - w / 2 + 2 + i * (w / 3), cy - h + 1, w / 5, h - 2, rampa, Math.max(0, nivel - 1));
      if (base === 'misto' && est >= 2) { ep(ctx, cx - w / 2 - 1, cy - 1, 3, 2, 'amarelo', 5); ep(ctx, cx + w / 2 - 2, cy - 1, 3, 2, 'amarelo', 4); }
      return;
    }
    if (base === 'miojo' || base === 'miojo_copo') {
      eElipse(ctx, cx, cy, raio * .9, raio * .38, 'amarelo', est >= 4 ? 2 : 3);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + (est >= 2 ? Math.sin(t * 2 + i) * .3 : 0), rr = raio * (est >= 2 ? .7 : .45);
        ep(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .35, 3, 1, rampa, nivel);
      }
      return;
    }
    if (base === 'marmita') {
      ep(ctx, cx - raio, cy - 4, raio * 2, 6, 'palido', 4);
      ep(ctx, cx - raio + 1, cy - 3, raio * .8, 4, rampa, nivel);
      ep(ctx, cx + 1, cy - 3, raio * .9, 4, 'madeira', est >= 3 ? 1 : 2);
      if (est >= 3) for (let i = 0; i < 4; i++) ep(ctx, cx - raio + 2 + i * 7, cy - 6 - (i % 2), 2, 1, 'madeira', 2);
      return;
    }
    if (base === 'pipoca') {
      const n = Math.round(clamp(est, 0, 4) * 6);
      eElipse(ctx, cx, cy, raio * .8, raio * .3, 'amarelo', 3);
      for (let i = 0; i < n; i++) {
        const a = (i * 2.4) % (Math.PI * 2), rr = raio * (.2 + (i % 5) * .16);
        const py = cy - (i % 4) - (est >= 2 ? Math.abs(Math.sin(t * 6 + i)) * 3 : 0);
        ep(ctx, cx + Math.cos(a) * rr, py, 2, 2, rampa, nivel);
      }
      return;
    }
    eElipse(ctx, cx, cy, raio * .8, raio * .35, rampa, nivel);
  }
  /* A panela/frigideira/copo em que a receita acontece. */
  function desenharVasilha(ctx, vasilha, cx, cy, {conteudo, est, p, t, tampada}) {
    const c = raio => desenharConteudo(ctx, conteudo, cx, cy - 2, est, p, t, {raio});
    if (vasilha === 'frigideira') {
      ep(ctx, cx + 16, cy - 5, 18, 3, 'carvao', 2); ep(ctx, cx + 16, cy - 5, 18, 1, 'carvao', 4);
      eElipse(ctx, cx, cy, 19, 7, 'metal', 2);
      eElipse(ctx, cx, cy - 1, 17, 6, 'carvao', 2);
      eElipse(ctx, cx, cy - 1, 15, 5, 'carvao', 1);
      c(13);
      eElipse(ctx, cx, cy - 3, 19, 6.4, 'metal', 4, .0001);
      ctx.fillStyle = cor('metal', 5); ctx.fillRect(EX(cx - 19), EY(cy - 4), 76, 2);
      return;
    }
    if (vasilha === 'panela') {
      ep(ctx, cx - 20, cy - 14, 40, 15, 'metal', 3);
      ep(ctx, cx - 20, cy - 14, 40, 2, 'metal', 5); ep(ctx, cx - 20, cy - 2, 40, 2, 'metal', 1);
      ep(ctx, cx - 22, cy - 12, 3, 4, 'carvao', 2); ep(ctx, cx + 19, cy - 12, 3, 4, 'carvao', 2);
      eElipse(ctx, cx, cy - 14, 20, 5, 'metal', 4);
      eElipse(ctx, cx, cy - 14, 17, 4, 'carvao', 1);
      c(15);
      if (tampada) { eElipse(ctx, cx, cy - 16, 21, 5.5, 'metal', 5); ep(ctx, cx - 2, cy - 20, 4, 3, 'carvao', 3); }
      return;
    }
    if (vasilha === 'leiteira') {
      ep(ctx, cx - 12, cy - 16, 24, 17, 'metal', 4);
      ep(ctx, cx - 12, cy - 16, 24, 2, 'metal', 6); ep(ctx, cx - 12, cy - 2, 24, 2, 'metal', 2);
      ep(ctx, cx + 12, cy - 14, 14, 2, 'carvao', 2); ep(ctx, cx + 24, cy - 16, 3, 5, 'carvao', 3);
      eElipse(ctx, cx, cy - 16, 12, 4, 'metal', 5); eElipse(ctx, cx, cy - 16, 10, 3, 'carvao', 1);
      c(9);
      return;
    }
    if (vasilha === 'copo') {
      ep(ctx, cx - 7, cy - 18, 14, 18, 'palido', 6);
      ep(ctx, cx - 7, cy - 18, 14, 1, 'palido', 7); ep(ctx, cx + 5, cy - 17, 2, 16, 'palido', 7);
      desenharConteudo(ctx, conteudo, cx, cy - 6, est, p, t, {raio: 6});
      return;
    }
    if (vasilha === 'caneca') {
      ep(ctx, cx - 8, cy - 16, 16, 16, 'papel', 6); ep(ctx, cx + 8, cy - 12, 4, 2, 'papel', 5); ep(ctx, cx + 10, cy - 10, 2, 5, 'papel', 5); ep(ctx, cx + 8, cy - 5, 4, 2, 'papel', 5);
      eElipse(ctx, cx, cy - 16, 8, 3, 'papel', 7);
      desenharConteudo(ctx, conteudo, cx, cy - 14, est, p, t, {raio: 7});
      return;
    }
    if (vasilha === 'prato') { eElipse(ctx, cx, cy, 20, 6, 'palido', 5); eElipse(ctx, cx, cy - 1, 17, 5, 'palido', 7); c(14); return; }
    if (vasilha === 'saco') {
      ep(ctx, cx - 12, cy - 18, 24, 18, 'papel', 5); ep(ctx, cx - 12, cy - 18, 24, 2, 'papel', 6);
      for (let i = 0; i < 4; i++) ep(ctx, cx - 10, cy - 15 + i * 4, 20, 1, 'papel', 3);
      ep(ctx, cx - 6, cy - 10, 12, 6, 'vermelho', 3);
      if (est >= 2) { ep(ctx, cx - 13, cy - 21 - est, 26, 4 + est, 'papel', 6); }
      return;
    }
    if (vasilha === 'jarra') {
      ep(ctx, cx - 11, cy - 16, 22, 16, 'ceu', 2); ep(ctx, cx + 11, cy - 13, 3, 8, 'ceu', 3);
      const alt = Math.round(clamp(p, 0, 1) * 11);
      if (alt) { const [r, n] = corDoEstagio('cafe', est); ep(ctx, cx - 10, cy - 1 - alt, 20, alt, r, n); }
      ep(ctx, cx - 11, cy - 16, 22, 1, 'ceu', 5);
      return;
    }
    if (vasilha === 'chaleira') { desenharConteudo(ctx, conteudo, cx, cy, est, p, t, {raio: 9}); return; }
    if (vasilha === 'sanduicheira') { desenharConteudo(ctx, conteudo, cx, cy, est, p, t, {raio: 12}); return; }
    c(12);
  }
  /* Chama de gás (azul) ou de lenha (laranja), pelo nível. */
  function desenharFogo(ctx, cx, cy, nivel, t, tipo = 'gas') {
    const forca = {baixo: .6, medio: 1, alto: 1.5}[nivel] || 1;
    const n = Math.round(6 + forca * 5);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, r = 9 * forca * (tipo === 'lenha' ? 1.3 : 1);
      const alt = (2 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 4) * forca;
      const x = cx + Math.cos(a) * r * .7, y = cy + Math.sin(a) * r * .22;
      for (let k = 0; k < alt; k++) {
        const nivelCor = k > alt - 2 ? 5 : k > alt * .5 ? 4 : 3;
        ep(ctx, x, y - k, 1, 1, tipo === 'lenha' ? 'fogo' : 'azul', tipo === 'lenha' ? nivelCor : nivelCor + 1);
      }
    }
    if (tipo === 'lenha') for (let i = 0; i < 4; i++) { const ph = (t * .8 + i * .25) % 1; ep(ctx, cx + Math.sin(t * 3 + i) * 8, cy - 8 - ph * 16, 1, 1, 'fogo', 5); }
  }

  /* Línguas de chama lambendo a borda da panela (desenhadas por cima dela). */
  function desenharFogoBorda(ctx, cx, cy, nivel, t, tipo = 'gas') {
    const forca = {baixo: .6, medio: 1, alto: 1.5}[nivel] || 1;
    for (const lado of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = cx + lado * (13 + i * 3), alt = (2 + Math.abs(Math.sin(t * 8 + i * 2 + lado)) * 4) * forca;
      for (let k = 0; k < alt; k++) ep(ctx, x, cy - k, 1, 1, tipo === 'lenha' ? 'fogo' : 'azul', k > alt - 2 ? 6 : 4);
    }
  }

  /* ---- caderno de receitas, barra de ponto, painel de passos e bandeja ---- */
  const folhaCaderno = () => arte('caderno', 64, 92, b => {
    b.rect(0, 0, 64, 92, 'papel', 6); b.speckle(0, 0, 64, 92, 'papel', 5, .05, K.rng(3));
    b.hline(0, 63, 0, 'papel', 7); b.vline(63, 0, 91, 'papel', 4); b.hline(0, 63, 91, 'papel', 3);
    for (let y = 12; y < 90; y += 5) b.hline(4, 61, y, 'ceu', 4);
    b.vline(7, 0, 91, 'vermelho', 4);
    for (let i = 0; i < 6; i++) { b.ellipse(3 + i * 11, 2, 2, 2, 'metal', 4); b.px(3 + i * 11, 1, 'metal', 6); b.px(3 + i * 11, 3, 'papel', 3); }
    b.shadeFn(0, 0, 64, 92, (x, y) => (x < 10 ? -.7 : 0));
  });
  function desenharCaderno(ctx, ui, st, sys, lista, faltas) {
    const {x, y, w, h} = COZ.caderno;
    U.rect(ctx, x + 4, y + 4, w, h, '#05020899');
    U.blit(ctx, folhaCaderno(), x, y);
    U.hand(ctx, 'Receitas', x + 16, y + 8, {color: C('tinta', 1), width: w - 24, scale: 1, seed: 3});
    U.rect(ctx, x + 16, y + 20, 84, 1, C('tinta', 3));
    lista.forEach((id, i) => {
      const R = Comida().RECEITAS[id], fy = y + 26 + i * 17;
      if (fy + 16 > y + h) return;
      const falta = faltas[id] || [];
      const sel = st.sel === id;
      const hot = ui.region('receita', x + 10, fy - 2, w - 16, 16, {data: id, silent: true});
      if (sel) { U.rect(ctx, x + 10, fy - 2, w - 18, 16, '#ffe07a66'); U.rect(ctx, x + 10, fy + 12, w - 18, 2, '#e8c05a88'); }
      else if (hot) U.rect(ctx, x + 10, fy - 2, w - 18, 16, '#ffffff22');
      const ic = itemCanvas(R.item || 'garrafa_agua');
      if (ic) { ctx.imageSmoothingEnabled = false; ctx.save(); if (falta.length) ctx.globalAlpha = .45; ctx.drawImage(ic, x + 12, fy - 1, Math.min(14, ic.width), Math.min(14, ic.height)); ctx.restore(); }
      escreve(ctx, cortar(R.nome, w - 46), x + 30, fy, falta.length ? C('tinta', 3) : C('tinta', 1));
      if (falta.length) escreve(ctx, cortar('falta ' + falta.map(f => f.texto.toLowerCase()).join(', '), w - 46), x + 30, fy + 8, C('vermelho', 3));
      else escreve(ctx, `${Comida().modoDa(id, st.estacao)?.passos.length || 0} passos`, x + 30, fy + 8, C('tinta', 3));
    });
    if (!lista.length) escreve(ctx, 'Nada para fazer aqui.', x + 14, y + 30, C('tinta', 2));
  }
  const ICONE_ZONA = {cru: 'gota', ponto: 'estrela', queimado: 'chama'};
  function desenharBarra(ctx, st, passo, p, t) {
    const {x, y, w, h} = COZ.barra;
    const [a, bq] = passo.janela;
    // faixa escura sobre a arte da estação
    U.rect(ctx, x - 8, y - 16, w + 16, h + 34, '#0a0410cc');
    U.outline(ctx, x - 8, y - 16, w + 16, h + 34, '#2c1430', 2);
    U.rect(ctx, x, y, w, h, '#170a1c');
    const zonas = [[0, a - .15, 'azul', 2], [a - .15, a, 'amarelo', 2], [a, bq, 'verde', 4], [bq, bq + .1, 'ambar', 3], [bq + .1, 1, 'vermelho', 3]];
    for (const [z0, z1, r, n] of zonas) ret(ctx, x + 2 + z0 * (w - 4), y + 2, (z1 - z0) * (w - 4), h - 4, r, n);
    for (let i = 0; i < w - 4; i += 4) ret(ctx, x + 2 + i, y + 2, 2, 1, 'preto', 1);
    U.outline(ctx, x, y, w, h, '#4d2a52', 2);
    // ícones e texto das zonas
    const cxPonto = clamp(x + 2 + (a + bq) / 2 * (w - 4), x + 60, x + w - 56);
    ctx.drawImage(U.icon('gole'), x + 2, y - 14, 12, 12);
    ctx.drawImage(U.icon('comida'), snap(cxPonto - 22), y - 14, 12, 12);
    ctx.drawImage(U.icon('fogo'), x + w - 14, y - 14, 12, 12);
    escreve(ctx, 'CRU', x + 16, y - 11, cor('azul', 5));
    escreve(ctx, 'PONTO', cxPonto - 8, y - 11, cor('verde', 6));
    escreve(ctx, 'QUEIMA', x + w - 16, y - 11, cor('vermelho', 5), {align: 'right'});
    const mx = x + 2 + clamp(p, 0, 1) * (w - 4);
    const zona = Comida().zonaDe(passo, p);
    ctx.fillStyle = '#07030a'; ctx.fillRect(snap(mx - 4), y - 4, 8, h + 8);
    ctx.fillStyle = zona === 'ponto' ? '#b5ffc6' : zona === 'queimado' || zona === 'queimando' ? '#ff8a6a' : '#ffe6f7';
    ctx.fillRect(snap(mx - 2), y - 4, 4, h + 8);
    if (zona === 'ponto') { const k = (Math.sin(t * 9) * .5 + .5); ctx.fillStyle = `rgba(181,255,198,${(.3 + k * .5).toFixed(2)})`; ctx.fillRect(snap(mx - 6), y - 6, 12, h + 12); }
    const rot = {cru: 'CRU', quase: 'QUASE LÁ', ponto: 'NO PONTO!', passou: 'PASSANDO', queimando: 'QUEIMANDO!', queimado: 'QUEIMOU'}[zona];
    escreve(ctx, rot, x + w / 2, y + h + 4, zona === 'ponto' ? '#b5ffc6' : zona === 'cru' || zona === 'quase' ? '#9fb2e8' : '#ff8a6a', {align: 'center'});
  }
  function desenharPainel(ctx, ui, st, sys, preparo, {energia}) {
    const {x, y, w, h} = COZ.painel;
    U.frame(ctx, x, y, w, h, 'escuro');
    const C2 = Comida();
    if (!preparo) {
      const R = st.sel ? C2.RECEITAS[st.sel] : null;
      escreve(ctx, 'RECEITA', x + 10, y + 8, TXT.titulo);
      if (!R) { escreve(ctx, 'Escolha no caderno.', x + 10, y + 24, TXT.dica); return; }
      escreve(ctx, cortar(R.nome, w - 20), x + 10, y + 22, TXT.claro);
      const modo = C2.modoDa(st.sel, st.estacao);
      escreve(ctx, 'leva', x + 10, y + 38, TXT.dica);
      let iy = y + 50;
      for (const ing of modo.ingredientes) {
        const id = ing.id || (ing.um ? ing.um[0] : ing.agua || ing.garrafa ? 'garrafa_agua' : null);
        const rot = ing.agua ? 'água' : ing.garrafa ? 'garrafa com água' : ing.um ? ing.um.map(i => C2.rotuloDe(i).toLowerCase()).join(' ou ') : C2.rotuloDe(ing.id).toLowerCase();
        const ic = id ? itemCanvas(id) : null;
        if (ic) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ic, x + 10, iy - 2, Math.min(12, ic.width), Math.min(12, ic.height)); }
        escreve(ctx, cortar(rot, w - 34), x + 26, iy, TXT.claro);
        iy += 14;
      }
      const faltas = st.faltas?.[st.sel] || [];
      const passos = modo.passos.length;
      escreve(ctx, `${passos} passos`, x + 10, iy + 4, TXT.dica);
      const bh = 40, by = y + h - bh - 8;
      const podeComecar = !faltas.length;
      ui.button(ctx, 'comecar', x + 8, by, w - 16, bh, podeComecar ? 'COMEÇAR' : 'FALTA COISA', {style: podeComecar ? 'fosforo' : 'roxo', disabled: !podeComecar});
      if (!podeComecar) escreve(ctx, cortar(faltas.map(f => f.texto).join(', '), w - 20), x + 10, by - 12, C('vermelho', 4));
      return;
    }
    // preparo em andamento
    escreve(ctx, 'PASSO A PASSO', x + 10, y + 8, TXT.titulo);
    preparo.passos.forEach((p, i) => {
      const py = y + 24 + i * 15;
      const feito = i < preparo.i, agora = i === preparo.i && !preparo.fim;
      U.rect(ctx, x + 8, py - 2, 14, 13, agora ? '#5a1e50' : '#1b0a20');
      if (feito) { ctx.drawImage(U.icon('check'), x + 8, py - 3, 14, 14); }
      else escreve(ctx, String(i + 1), x + 13, py + 1, agora ? TXT.titulo : TXT.dica);
      escreve(ctx, cortar(p.rotulo || p.verbo, w - 40), x + 26, py + 1, feito ? '#8f7a95' : agora ? TXT.claro : TXT.dica);
    });
    const E = C2.ESTACOES[preparo.estacao];
    let by = y + h - 56;
    if (E?.niveis) {
      const rot = E.rotulosNivel || {baixo: 'BAIXO', medio: 'MÉDIO', alto: 'ALTO'};
      escreve(ctx, 'FOGO', x + 10, by - 26, TXT.dica);
      C2.NIVEIS.forEach((n, i) => {
        const bx = x + 8 + i * 38, sel = preparo.nivel === n;
        const hot = ui.region('nivel', bx, by - 16, 36, 16, {data: n, silent: true});
        U.rect(ctx, bx, by - 16, 36, 16, sel ? cor('fogo', 3) : hot ? '#48163f' : '#230c28');
        U.outline(ctx, bx, by - 16, 36, 16, sel ? '#ffd18c' : '#a44590', 2);
        escreve(ctx, rot[n], bx + 18, by - 12, sel ? '#fff8d8' : '#f3b4e8', {align: 'center'});
      });
    }
    const passo = C2.passoAtual(preparo);
    if (passo && !preparo.fim) {
      const ativo = preparo.fase === 'espera' || preparo.fase === 'cozinhando';
      const verbo = passo.verbo;
      const linhas = K.wrap(verbo, 110);
      const escala = linhas.length > 1 || K.measure(verbo) > 56 ? 1 : 2;
      const zona = passo.tipo === 'cozinhar' ? C2.zonaDe(passo, preparo.p) : null;
      const pulsa = zona === 'ponto';
      U.rect(ctx, x + 8, by + 4, w - 16, 44, ativo ? (pulsa ? cor('verde', 3) : cor('vermelho', 2)) : '#1b0a20');
      U.outline(ctx, x + 8, by + 4, w - 16, 44, ativo ? (pulsa ? '#b5ffc6' : '#ffd18c') : '#4d2a52', 2);
      if (ativo) ui.region('verbo', x + 8, by + 4, w - 16, 44, {silent: true});
      linhas.slice(0, 2).forEach((l, i) => escreve(ctx, l, x + w / 2, by + 4 + (linhas.length > 1 ? 10 + i * 12 : 15), ativo ? '#fff8e6' : '#7a6a80', {align: 'center', scale: escala}));
    }
  }
  function desenharBandeja(ctx, ui, st, sys, lista, t) {
    const {x, y, w, h} = COZ.bandeja;
    U.rect(ctx, x + 3, y + 3, w, h, '#05020899');
    U.blit(ctx, arte('bandeja', w / 2, h / 2, b => {
      b.rect(0, 0, w / 2, h / 2, 'madeira', 3);
      veiosMadeira(b, 0, 0, w / 2, h / 2, 'madeira', 3, 7);
      b.frame(0, 0, w / 2, h / 2, 'madeira', 5); b.frame(1, 1, w / 2 - 2, h / 2 - 2, 'madeira', 1);
      b.hline(2, w / 2 - 3, 2, 'madeira', 4);
    }), x, y);
    escreve(ctx, 'NA BOLSA', x + 8, y + 4, TXT.dica);
    let px = x + 8;
    for (const it of lista) {
      const c = itemCanvas(it.id);
      if (!c) continue;
      const esc = c.height <= 16 && c.width <= 16 ? 2 : 1;
      const iw = c.width * esc, ih = c.height * esc;
      if (px + iw > x + w - 8) break;
      const hot = ui.region('ingrediente', px - 2, y + 14, iw + 4, ih + 4, {data: it.id, silent: true});
      ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.globalAlpha = it.usado ? 1 : .55; ctx.drawImage(c, snap(px), snap(y + 14 + (hot ? -2 : 0)), iw, ih); ctx.restore();
      if (it.usado) U.outline(ctx, px - 3, y + 13, iw + 6, ih + 6, '#ffd18c', 1);
      U.rect(ctx, px + iw - 9, y + 14 + ih - 9, 10, 9, '#140619dd');
      escreve(ctx, String(it.qtd > 99 ? '∞' : it.qtd), px + iw - 7, y + 15 + ih - 9, it.qtd ? '#ffd18c' : '#a8748f');
      if (hot) U.tooltip(ctx, `${Comida().rotuloDe(it.id)} · ${it.qtd}`, px + iw / 2, y - 12);
      px += iw + 8;
    }
    if (!lista.length) escreve(ctx, 'A bolsa está sem ingredientes para esta estação.', x + 8, y + 22, TXT.dica);
  }
  /* Cartão do resultado: o prato grande, as estrelas e o que fazer com ele. */
  function desenharResultado(ctx, ui, st, res, t) {
    const w = 268, h = 176, x = snap(240 - w / 2), y = snap(128 - h / 2);
    U.veil(ctx, .45);
    U.frame(ctx, x, y, w, h, 'madeira');
    escreve(ctx, res.titulo.toUpperCase(), x + w / 2, y + 10, TXT.titulo, {align: 'center'});
    const item = res.item || 'garrafa_agua';
    const c = itemCanvas(item);
    if (c) { const esc = c.width <= 16 && c.height <= 16 ? 4 : 3; ctx.imageSmoothingEnabled = false; ctx.save(); ctx.globalAlpha = .4; ctx.drawImage(c, snap(x + 30 + 4), snap(y + 34 + 5), c.width * esc, c.height * esc); ctx.restore(); ctx.drawImage(c, snap(x + 30), snap(y + 34), c.width * esc, c.height * esc); }
    const nome = res.item ? Comida().rotuloDe(res.item) : 'Água fervida';
    escreve(ctx, cortar(nome, 140), x + 110, y + 36, TXT.claro);
    // estrelas
    for (let i = 0; i < 3; i++) {
      const cheia = i < (res.qualidade || 0), sx = x + 110 + i * 16, sy = y + 50;
      ctx.fillStyle = cheia ? '#ffd23a' : '#4d2a52';
      for (const [dx, dy, ww, hh] of [[5, 0, 2, 12], [0, 4, 12, 3], [1, 8, 3, 4], [8, 8, 3, 4], [2, 3, 8, 6]]) ctx.fillRect(sx + dx, sy + dy, ww, hh);
      if (cheia) { ctx.fillStyle = '#fff8d8'; ctx.fillRect(sx + 4, sy + 4, 3, 3); }
    }
    const linhas = K.wrap(res.texto || '', 150).slice(0, 3);
    linhas.forEach((l, i) => escreve(ctx, l, x + 110, y + 70 + i * 11, TXT.dica));
    if (res.rende > 1) escreve(ctx, `Rendeu ${res.rende}.`, x + 110, y + 70 + linhas.length * 11, TXT.claro);
    const bw = (w - 32) / 3;
    if (res.item) {
      ui.button(ctx, 'comer', x + 10, y + h - 44, bw, 34, 'COMER AGORA', {style: 'fosforo'});
      ui.button(ctx, 'guardar', x + 16 + bw, y + h - 44, bw, 34, 'GUARDAR', {style: 'papel'});
      ui.button(ctx, 'denovo', x + 22 + bw * 2, y + h - 44, bw, 34, 'DE NOVO', {style: 'roxo'});
    } else {
      ui.button(ctx, 'guardar', x + 10, y + h - 44, bw * 1.5, 34, 'PEGAR A GARRAFA', {style: 'papel'});
      ui.button(ctx, 'denovo', x + 20 + bw * 1.5, y + h - 44, bw * 1.5, 34, 'DE NOVO', {style: 'roxo'});
    }
  }

  /* ------------------------------------------------------------ tipo cozinha */
  const OPCOES_ESTACAO = [['fogao', 'Fogão'], ['fogareiro', 'Fogareiro'], ['chapa', 'Chapa'], ['fogueira', 'Fogueira'],
    ['cafeteira', 'Cafeteira'], ['micro_ondas', 'Micro-ondas'], ['sanduicheira', 'Sanduicheira'], ['chaleira', 'Chaleira'], ['bancada', 'Bancada (sem fogo)']];
  const estacaoDaClue = clue => (Comida()?.ESTACOES[chave(clue?.data?.estacao)] ? chave(clue.data.estacao) : 'fogao');
  const SOM_AMBIENTE = {fogao: 'fritura', fogareiro: 'fritura', chapa: 'fritura', fogueira: 'fogueira', cafeteira: 'cafeteira',
    micro_ondas: 'micro_zumbido', sanduicheira: 'sanduicheira', chaleira: 'borbulhar', bancada: null};
  const SOM_ACAO = {agua: 'torneira', po: 'pacote', ovo: 'tampa', manteiga: 'pacote', montar: 'pacote', leite: 'servir_copo', milho: 'pacote',
    tampar: 'tampa', tampa: 'tampa', saco: 'pacote', copo: 'servir_copo', sal: 'pacote', acucar: 'pacote', misturar: 'servir_copo',
    coar: 'servir_copo', despejar: 'servir_copo', engarrafar: 'encher_garrafa', fechar: 'sanduicheira', oleo: 'servir_copo'};

  Tipos.register('cozinha', {
    label: 'Cozinha (fogão, chapa, micro-ondas)', icon: 'panela', sound: 'clique', categoria: 'interacao', veil: .8, clickOutsideCloses: false,
    fields: [
      {id: 'estacao', label: 'Estação', kind: 'select', options: OPCOES_ESTACAO},
      {id: 'receitas', label: 'Receitas (vazio = todas as da estação)', kind: 'text', placeholder: 'ex.: cafe_coado, miojo_pronto'},
      {id: 'tranquilo', label: 'Modo tranquilo (não queima)', kind: 'select', options: [['nao', 'Não'], ['sim', 'Sim']]},
      {id: 'mensagem', label: 'Mensagem no rodapé', kind: 'text'}],
    defaults: {estacao: 'fogao', receitas: '', tranquilo: 'nao', mensagem: ''},
    rotuloAcao: 'Cozinhar',
    activate(clue, sys, info = {}) {
      return aproximar(clue, sys, () => sys.open(clue, {source: info.source === 'jogadores' ? 'jogadores' : 'cena'}));
    },
    create(clue, sys) {
      const C2 = Comida(), mem = memoriaDe(sys, clue);
      const estacao = estacaoDaClue(clue);
      const lista = C2 ? C2.receitasDoCampo(estacao, clue.data?.receitas) : [];
      return {mem, estacao, lista, sel: lista.includes(mem.ultima) ? mem.ultima : lista[0] || null,
        preparo: null, res: null, resolvido: false, faltas: {}, faltasT: 0, t: 0, ambT: 0, fumaca: 0, alerta: 0, aviso: '', avisoT: 0, anim: 0};
    },
    describe: st => ({estacao: st.estacao, sel: st.sel, passo: st.preparo?.i ?? null, fase: st.preparo?.fase || null,
      p: st.preparo ? +st.preparo.p.toFixed(2) : null, nivel: st.preparo?.nivel || null, res: st.res ? {item: st.res.item, q: st.res.qualidade} : null}),
    atualizarFaltas(st, sys, energia) {
      const C2 = Comida();
      st.faltas = {};
      for (const id of st.lista) st.faltas[id] = C2.faltando(id, st.estacao, sys.itens, {energia});
    },
    render(ctx, ui, st, clue, sys) {
      const C2 = Comida(), dt = clamp(ui.dt || 0, 0, .1), energia = temEnergia(sys);
      st.t += dt; st.anim += dt;
      st.avisoT = Math.max(0, st.avisoT - dt); if (!st.avisoT) st.aviso = '';
      st.fumaca = Math.max(0, st.fumaca - dt * .5); st.alerta = Math.max(0, st.alerta - dt * .7);
      if ((st.faltasT -= dt) <= 0) { st.faltasT = .3; this.atualizarFaltas(st, sys, energia); }
      // fundo
      U.rect(ctx, 0, 22, SW, SH - 22, '#120716');
      for (let i = 0; i < SW; i += 8) U.rect(ctx, i, 22, 4, SH - 22, '#150a1a');
      // preparo andando
      if (st.preparo && !st.res) {
        for (const ev of C2.passoPreparo(st.preparo, dt, {energia})) {
          if (ev.tipo === 'pim') som(sys, 'pim');
          else if (ev.tipo === 'fumaca') st.fumaca = 1;
          else if (ev.tipo === 'alerta') { st.alerta = 1; som(sys, 'queimou'); }
          else if (ev.tipo === 'queimou') { som(sys, 'queimou'); st.fumaca = 1; }
          else if (ev.tipo === 'semEnergia') { st.aviso = 'Sem energia: nada cozinha.'; st.avisoT = 1; }
          else if (ev.tipo === 'fim') this.finalizar(st, sys);
        }
        const passo = C2.passoAtual(st.preparo);
        if (passo?.tipo === 'cozinhar' && st.preparo.fase === 'cozinhando' && (st.preparo.aceso || passo.semFogo)) {
          if ((st.ambT -= dt) <= 0) { st.ambT = .95; const s = passo.conteudo === 'pipoca' && st.preparo.p > .3 ? 'pipoca_estouro' : SOM_AMBIENTE[st.estacao]; if (s) som(sys, s); }
        }
      }
      // estação
      const pos = ESTACAO_POS[st.estacao] || ESTACAO_POS.fogao;
      const base = arte('estacao:' + st.estacao, COZ.est.aw, COZ.est.ah, b => (ESTACAO_ARTE[st.estacao] || ESTACAO_ARTE.fogao)(b));
      U.rect(ctx, COZ.est.x + 4, COZ.est.y + 4, COZ.est.w, COZ.est.h, '#05020899');
      U.blit(ctx, base, COZ.est.x, COZ.est.y);
      U.outline(ctx, COZ.est.x - 2, COZ.est.y - 2, COZ.est.w + 4, COZ.est.h + 4, '#2c1430', 2);
      const prep = st.preparo, passo = prep ? C2.passoAtual(prep) : null;
      const conteudo = passo?.conteudo || prep?.passos.find(p => p.tipo === 'cozinhar')?.conteudo || 'agua';
      const est = passo?.tipo === 'cozinhar' ? C2.estagioDe(passo, prep.p) : (prep && prep.i > 0 ? 1 : 0);
      if (prep) {
        if (prep.aceso && pos.fogo) desenharFogo(ctx, pos.fogo[0], pos.fogo[1], prep.nivel || 'medio', ui.t, st.estacao === 'fogueira' ? 'lenha' : 'gas');
        desenharVasilha(ctx, prep.vasilha, pos.vas[0], pos.vas[1], {conteudo, est, p: prep.p, t: ui.t, tampada: prep.passos.slice(0, prep.i).some(x => x.anim === 'tampar')});
        if (prep.aceso && pos.fogo) desenharFogoBorda(ctx, pos.vas[0], pos.vas[1] + 1, prep.nivel || 'medio', ui.t, st.estacao === 'fogueira' ? 'lenha' : 'gas');
        if (est >= 2) vaporSobe(ctx, EX(pos.vas[0]), EY(pos.vas[1] - 16), ui.t, {n: 3, alt: 26, largura: 8, forca: clamp((est - 1) / 2, 0, 1)});
        if (st.fumaca > 0) vaporSobe(ctx, EX(pos.vas[0] + 4), EY(pos.vas[1] - 18), ui.t * 1.4, {n: 4, alt: 34, largura: 12, cor: `rgba(40,34,44,${(.5 * st.fumaca).toFixed(2)})`});
        if (st.alerta > 0 && Math.floor(ui.t * 6) % 2) { escreve(ctx, '!', EX(pos.vas[0]), EY(pos.vas[1] - 30), '#ff8a6a', {align: 'center', scale: 3}); }
      } else if (st.estacao === 'fogueira') desenharFogo(ctx, ESTACAO_POS.fogueira.fogo[0], ESTACAO_POS.fogueira.fogo[1], 'medio', ui.t, 'lenha');
      // barra de ponto
      if (passo?.tipo === 'cozinhar') desenharBarra(ctx, st, passo, prep.p, ui.t);
      else { U.rect(ctx, COZ.est.x, 196, COZ.est.w, 16, '#170a1ccc'); U.outline(ctx, COZ.est.x, 196, COZ.est.w, 16, '#2c1430', 2); escreve(ctx, prep ? 'siga o passo do lado' : 'escolha uma receita no caderno', COZ.est.x + COZ.est.w / 2, 200, TXT.dica, {align: 'center'}); }
      // caderno, painel e bandeja
      desenharCaderno(ctx, ui, st, sys, st.lista, st.faltas);
      desenharPainel(ctx, ui, st, sys, prep, {energia});
      desenharBandeja(ctx, ui, st, sys, this.bandeja(st, sys), ui.t);
      if (st.res) desenharResultado(ctx, ui, st, st.res, ui.t);
      if (st.aviso && !st.res) faixaTexto(ctx, st.aviso, {y: 194, x: COZ.est.x, w: COZ.est.w, cor: '#ffd18c'});
      const E = C2.ESTACOES[st.estacao];
      const dica = st.res ? 'o que fazer com isso?' : prep ? (passo?.tipo === 'cozinhar' ? 'aperte o verbo no ponto certo' : 'aperte o verbo grande') : `${E?.nome || ''}${E?.eletrica && !energia ? ' · sem energia' : ''}`;
      U.header(ctx, ui, clue.name, dica, 'panela');
    },
    bandeja(st, sys) {
      const C2 = Comida(), out = [], vistos = new Set();
      const usados = new Set();
      for (const id of st.lista) {
        const modo = C2.modoDa(id, st.estacao);
        for (const ing of modo?.ingredientes || []) {
          const ids = ing.um || (ing.id ? [ing.id] : ing.agua || ing.garrafa ? ['garrafa_agua'] : []);
          for (const i of ids) { if (id === st.sel) usados.add(i); if (!vistos.has(i)) { vistos.add(i); out.push(i); } }
        }
      }
      return out.map(id => ({id, qtd: temBolsa(sys) ? C2.usosDe(sys.itens, id) : 99, usado: usados.has(id)})).filter(x => x.qtd > 0 || x.usado);
    },
    comecar(st, clue, sys) {
      const C2 = Comida();
      if (!st.sel || st.preparo) return;
      const faltas = C2.faltando(st.sel, st.estacao, sys.itens, {energia: temEnergia(sys)});
      if (faltas.length) { st.aviso = 'Falta ' + faltas.map(f => f.texto.toLowerCase()).join(', ') + '.'; st.avisoT = 3; som(sys, 'erro'); return; }
      const usado = C2.gastarIngredientes(st.sel, st.estacao, sys.itens);
      if (!usado.ok) { st.aviso = usado.motivo || 'Não deu.'; st.avisoT = 3; som(sys, 'erro'); return; }
      st.preparo = C2.novoPreparo(st.sel, st.estacao, {tranquilo: chave(clue.data?.tranquilo) === 'sim', ingredientes: usado});
      st.res = null; st.resolvido = false; st.mem.ultima = st.sel;
      som(sys, 'caderno');
      seguro(() => sys.emit('change'));
    },
    verbo(st, clue, sys) {
      const C2 = Comida();
      if (!st.preparo || st.res) return;
      const passo = C2.passoAtual(st.preparo);
      const ev = C2.agirPreparo(st.preparo, 'verbo');
      if (!ev) return;
      if (ev.tipo === 'acao') som(sys, SOM_ACAO[ev.anim] || 'clique');
      else if (ev.tipo === 'acendeu') som(sys, ev.eletrico ? 'beep' : st.estacao === 'fogueira' ? 'fosforo' : 'gas');
      else if (ev.tipo === 'pronto') { som(sys, ev.zona === 'ponto' ? 'pim' : ev.nota === 1 ? 'erro' : 'clique'); st.aviso = st.preparo.notas.at(-1)?.texto || ''; st.avisoT = 2.4; }
      if (st.preparo.fim) this.finalizar(st, sys);
      seguro(() => sys.emit('change'));
    },
    finalizar(st, sys) {
      const C2 = Comida();
      if (!st.preparo || st.res) return;
      st.res = C2.resultadoPreparo(st.preparo);
      st.resolvido = false;
      som(sys, st.res.gororoba || st.res.seca ? 'queimou' : st.estacao === 'micro_ondas' ? 'micro_plim' : 'pim');
      seguro(() => sys.emit('change'));
    },
    resolver(st, sys, como) {
      const C2 = Comida();
      if (!st.res || st.resolvido) return;
      const ctx = {itens: sys.itens, necessidades: sys.necessidades, consumo: sys.consumo, toast: (a, b, c) => avisar(sys, a, b, c), sfx: n => som(sys, n), minutos: sys.minutos};
      if (st.res.efeito === 'ferver') {
        C2.aplicarFervura(st.res, ctx);
        avisar(sys, st.res.seca ? 'SECOU' : 'ÁGUA FERVIDA', st.res.texto, 'garrafa');
      } else if (como === 'comer') {
        const dados = C2.dadosDoPrato(st.res.item, st.res.qualidade);
        if (st.res.rende > 1) for (let i = 1; i < st.res.rende; i++) sys.itens?.dar?.(st.res.item, 1, dados);
        seguro(() => sys.close());
        C2.consumirPronto(st.res.item, dados, ctx);
      } else {
        const n = C2.guardarResultado(st.res, ctx);
        avisar(sys, n ? 'NA BOLSA' : 'NÃO COUBE', n ? `${C2.rotuloDe(st.res.item)}${n > 1 ? ` (${n})` : ''}` : 'A bolsa está cheia.', 'comida');
      }
      st.resolvido = true; st.res = null; st.preparo = null;
      seguro(() => sys.emit('change'));
    },
    onClose(st, clue, sys) {
      if (st.res && !st.resolvido) this.resolver(st, sys, 'guardar');
      else if (st.preparo && !st.preparo.fim) { avisar(sys, 'LARGOU O PREPARO', 'Os ingredientes se perderam.', 'alerta'); st.preparo = null; }
    },
    action(id, st, clue, sys, info = {}) {
      if (id === 'receita') { st.sel = String(info.data); som(sys, 'caderno'); return; }
      if (id === 'comecar') { this.comecar(st, clue, sys); return; }
      if (id === 'verbo') { this.verbo(st, clue, sys); return; }
      if (id === 'nivel') { Comida().agirPreparo(st.preparo, 'nivel', String(info.data)); som(sys, 'clique'); return; }
      if (id === 'comer') { this.resolver(st, sys, 'comer'); return; }
      if (id === 'guardar') { this.resolver(st, sys, 'guardar'); return; }
      if (id === 'denovo') { st.res = null; st.resolvido = false; st.preparo = null; this.comecar(st, clue, sys); return; }
    },
    key(e, st, clue, sys) {
      const k = e.key, code = e.code;
      if (st.res) {
        if (k === 'Enter' || k === ' ' || code === 'Space') { this.resolver(st, sys, 'guardar'); return true; }
        return false;
      }
      if (st.preparo) {
        if (k === 'Enter' || k === ' ' || code === 'Space' || code === 'KeyW' || k === 'ArrowUp') { this.verbo(st, clue, sys); return true; }
        if (/^[123]$/.test(k)) { Comida().agirPreparo(st.preparo, 'nivel', Comida().NIVEIS[Number(k) - 1]); som(sys, 'clique'); return true; }
        return false;
      }
      if (!st.lista.length) return false;
      const i = st.lista.indexOf(st.sel);
      if (k === 'ArrowDown' || code === 'KeyS') { st.sel = st.lista[(i + 1) % st.lista.length]; som(sys, 'caderno'); return true; }
      if (k === 'ArrowUp' || code === 'KeyW') { st.sel = st.lista[(i + st.lista.length - 1) % st.lista.length]; som(sys, 'caderno'); return true; }
      if (k === 'Enter' || k === ' ' || code === 'Space') { this.comecar(st, clue, sys); return true; }
      return false;
    }
  });

  /* ================================================================ servir
     Garrafa térmica, bule, jarra, panela pronta e máquina de café: um clique
     serve uma dose — para beber na hora ou para guardar na bolsa. */
  const SERVIR = {
    garrafa_termica: {nome: 'Garrafa térmica', som: 'termica', texto: 'Garrafa térmica de bomba. Duas bombadas enchem um copinho.'},
    bule: {nome: 'Bule', som: 'servir_copo', texto: 'Bule de porcelana, ainda quente no fundo.'},
    jarra: {nome: 'Jarra', som: 'servir_copo', texto: 'Jarra suando de gelada, com um copo do lado.'},
    panela: {nome: 'Panela', som: 'tampa', texto: 'Panela no fogo baixo, com a concha encostada na borda.'},
    maquina: {nome: 'Máquina de café', som: 'cafeteira', texto: 'Máquina de café do balcão. Aperta e sai.', eletrica: true}
  };
  const servirDe = estilo => SERVIR[chave(estilo)] || SERVIR.garrafa_termica;
  const PINTA_SERVIR = {
    garrafa_termica(b, e) {
      azulejos(b, 0, 0, 152, 62, {rampa: 'papel', base: 5, tam: 8, seed: 3});
      b.rect(0, 62, 152, 8, 'concreto', 4); b.hline(0, 151, 62, 'concreto', 6); b.hline(0, 151, 69, 'concreto', 2);
      b.rect(0, 70, 152, 30, 'madeira', 2); portasArmario(b, 8, 74, 136, 26, {rampa: 'madeira', base: 2});
      const cx = 66;
      contato(b, cx - 20, 60, 40, 4);
      b.ellipse(cx, 60, 18, 5, 'vermelho', 1);
      b.rect(cx - 17, 18, 34, 42, 'vermelho', 3);
      for (let i = 0; i < 34; i++) { const t = i / 33; b.vline(cx - 17 + i, 18, 59, 'vermelho', t < .2 ? 1 : t < .35 ? 2 : t > .85 ? 5 : t > .7 ? 4 : 3); }
      b.ellipse(cx, 18, 17, 5, 'vermelho', 4); b.ellipse(cx, 59, 17, 5, 'vermelho', 1);
      b.rect(cx - 18, 30, 36, 12, 'papel', 6); b.hline(cx - 18, cx + 17, 30, 'papel', 7); b.hline(cx - 18, cx + 17, 41, 'papel', 3);
      b.text(cx, 33, 'CAFE', 'mogno', 2, {font: '3x5', align: 'center'});
      b.rect(cx - 12, 8, 24, 10, 'carvao', 3); b.hline(cx - 12, cx + 11, 8, 'carvao', 5); b.ellipse(cx, 8, 12, 3, 'carvao', 4);
      b.rect(cx - 6, 2, 12, 7, 'carvao', 4); b.ellipse(cx, 2, 6, 2, 'carvao', 6);
      b.poly([[cx + 17, 24], [cx + 26, 28], [cx + 26, 44], [cx + 17, 48]], 'carvao', 2); b.vline(cx + 25, 29, 43, 'carvao', 4);
      b.rect(cx + 34, 44, 14, 16, 'palido', 6); b.ellipse(cx + 41, 44, 7, 2.4, 'palido', 7); b.rect(cx + 35, 50, 12, 9, 'madeira', 2);
      for (let i = 0; i < 3; i++) { b.poly([[100 + i * 12, 50], [110 + i * 12, 50], [109 + i * 12, 60], [101 + i * 12, 60]], 'papel', 6); b.hline(100 + i * 12, 110 + i * 12, 50, 'papel', 7); }
    },
    bule(b, e) {
      azulejos(b, 0, 0, 152, 62, {rampa: 'papel', base: 5, tam: 8, seed: 7});
      b.rect(0, 62, 152, 8, 'concreto', 4); b.rect(0, 70, 152, 30, 'madeira', 2); portasArmario(b, 8, 74, 136, 26, {rampa: 'madeira', base: 2});
      const cx = 70;
      contato(b, cx - 24, 60, 48, 4);
      b.ellipse(cx, 58, 24, 7, 'palido', 2);
      b.rect(cx - 22, 34, 44, 24, 'palido', 5);
      b.ellipse(cx, 34, 22, 7, 'palido', 6); b.ellipse(cx, 58, 22, 7, 'palido', 3);
      for (let i = 0; i < 44; i++) { const t = i / 43; if (t < .18) b.vline(cx - 22 + i, 34, 57, 'palido', 3); else if (t > .82) b.vline(cx - 22 + i, 34, 57, 'palido', 7); }
      b.rect(cx - 12, 26, 24, 8, 'palido', 6); b.ellipse(cx, 26, 12, 4, 'palido', 7);
      b.rect(cx - 3, 20, 6, 6, 'palido', 5); b.ellipse(cx, 20, 4, 2, 'latao', 4);
      b.poly([[cx - 22, 38], [cx - 34, 44], [cx - 32, 52], [cx - 22, 50]], 'palido', 4); b.vline(cx - 33, 45, 51, 'palido', 6);
      b.poly([[cx + 22, 36], [cx + 34, 30], [cx + 36, 34], [cx + 24, 42]], 'palido', 6);
      for (const [fx, fy] of [[cx - 10, 42], [cx + 4, 46], [cx + 12, 40]]) { b.ellipse(fx, fy, 3, 3, 'azul', 3); b.ellipse(fx, fy, 1.4, 1.4, 'azul', 5); }
      b.rect(112, 46, 16, 14, 'palido', 6); b.ellipse(120, 46, 8, 2.6, 'palido', 7); b.rect(113, 52, 14, 7, 'madeira', 2);
    },
    jarra(b, e) {
      azulejos(b, 0, 0, 152, 62, {rampa: 'papel', base: 5, tam: 8, seed: 9});
      b.rect(0, 62, 152, 8, 'concreto', 4); b.rect(0, 70, 152, 30, 'madeira', 2); portasArmario(b, 8, 74, 136, 26, {rampa: 'madeira', base: 2});
      const cx = 68;
      contato(b, cx - 20, 60, 40, 4);
      b.rect(cx - 18, 24, 36, 36, 'ceu', 2);
      b.ellipse(cx, 24, 18, 5, 'ceu', 4); b.ellipse(cx, 60, 18, 5, 'ceu', 1);
      b.rect(cx - 16, 34, 32, 25, 'ambar', 3); b.hline(cx - 16, cx + 15, 34, 'ambar', 5);
      b.vline(cx + 15, 25, 59, 'ceu', 5); b.vline(cx - 17, 25, 59, 'ceu', 3);
      b.poly([[cx + 18, 30], [cx + 30, 34], [cx + 30, 48], [cx + 18, 52]], 'ceu', 3); b.vline(cx + 29, 35, 47, 'ceu', 5);
      b.poly([[cx - 18, 24], [cx - 26, 22], [cx - 24, 28], [cx - 18, 28]], 'ceu', 4);
      for (const [fx, fy] of [[cx - 8, 40], [cx + 6, 44]]) { b.ellipse(fx, fy, 3, 2, 'ambar', 5); }
      b.rect(108, 44, 16, 16, 'palido', 6); b.ellipse(116, 44, 8, 2.6, 'palido', 7); b.rect(109, 50, 14, 9, 'ambar', 3);
    },
    panela(b, e) {
      azulejos(b, 0, 0, 152, 56, {rampa: 'papel', base: 5, tam: 8, seed: 5});
      b.rect(0, 56, 152, 8, 'concreto', 4); b.rect(0, 64, 152, 36, 'madeira', 2); portasArmario(b, 8, 70, 136, 30, {rampa: 'madeira', base: 2});
      const cx = 72;
      contato(b, cx - 30, 56, 60, 4);
      b.rect(cx - 28, 30, 56, 26, 'metal', 3);
      for (let i = 0; i < 56; i++) { const t = i / 55; b.vline(cx - 28 + i, 30, 55, 'metal', t < .18 ? 1 : t < .32 ? 2 : t > .84 ? 5 : t > .7 ? 4 : 3); }
      b.ellipse(cx, 30, 28, 8, 'metal', 4); b.ellipse(cx, 30, 25, 6.6, 'carvao', 1);
      b.ellipse(cx, 29, 22, 5.6, 'madeira', 2); b.ellipse(cx, 28, 18, 4, 'madeira', 3);
      for (const [fx, fy] of [[cx - 10, 28], [cx + 8, 30], [cx + 2, 26]]) b.ellipse(fx, fy, 3, 1.4, 'ambar', 3);
      b.rect(cx - 34, 36, 7, 4, 'carvao', 2); b.rect(cx + 27, 36, 7, 4, 'carvao', 2);
      b.ellipse(cx + 40, 20, 12, 4, 'metal', 5); b.rect(cx + 38, 20, 4, 4, 'carvao', 3);
      b.rect(110, 44, 18, 12, 'palido', 5); b.ellipse(119, 44, 9, 3, 'palido', 7);
    },
    maquina(b, e) {
      azulejos(b, 0, 0, 152, 60, {rampa: 'papel', base: 5, tam: 8, seed: 11});
      b.rect(0, 60, 152, 8, 'concreto', 4); b.rect(0, 68, 152, 32, 'madeira', 2); portasArmario(b, 8, 72, 136, 28, {rampa: 'madeira', base: 2});
      const cx = 70;
      contato(b, cx - 28, 60, 56, 4);
      b.rect(cx - 28, 14, 56, 46, 'metal', 4);
      b.hline(cx - 28, cx + 27, 14, 'metal', 6); b.vline(cx + 27, 14, 59, 'metal', 5); b.vline(cx - 28, 14, 59, 'metal', 2);
      b.rect(cx - 24, 18, 48, 10, 'vermelho', 3); b.hline(cx - 24, cx + 23, 18, 'vermelho', 5);
      b.text(cx, 21, 'CAFE', 'papel', 7, {font: '3x5', align: 'center'});
      b.rect(cx - 22, 32, 44, 16, 'carvao', 2); b.frame(cx - 22, 32, 44, 16, 'metal', 3);
      b.rect(cx - 6, 30, 12, 6, 'metal', 3); b.rect(cx - 3, 36, 6, 4, 'metal', 5); b.px(cx, 40, 'carvao', 1);
      b.poly([[cx - 6, 44], [cx + 6, 44], [cx + 5, 52], [cx - 5, 52]], 'palido', 6); b.hline(cx - 6, cx + 5, 44, 'palido', 7);
      b.rect(cx - 20, 52, 40, 4, 'metal', 2); for (let i = 0; i < 8; i++) b.vline(cx - 18 + i * 5, 53, 55, 'metal', 1);
      for (let i = 0; i < 3; i++) { b.rect(cx + 6 + i * 6, 34, 4, 4, 'carvao', 4); b.px(cx + 7 + i * 6, 34, 'fosforo', 5, K.EMISSIVE); }
      for (let i = 0; i < 4; i++) { b.rect(cx - 24 + i * 6, 8, 5, 6, 'palido', 6); b.hline(cx - 24 + i * 6, cx - 20 + i * 6, 8, 'palido', 7); }
    }
  };
  Tipos.register('servir', {
    label: 'Servir (térmica, bule, jarra)', icon: 'termica', sound: 'clique', categoria: 'interacao', veil: .72,
    fields: [
      {id: 'estilo', label: 'O que é', kind: 'select', options: [['garrafa_termica', 'Garrafa térmica'], ['bule', 'Bule'], ['jarra', 'Jarra'], ['panela', 'Panela pronta'], ['maquina', 'Máquina de café']]},
      {id: 'item', label: 'O que sai', kind: 'text', placeholder: 'cafe_coado'},
      {id: 'doses', label: 'Doses', kind: 'text', placeholder: '8'},
      {id: 'carga', label: 'Reabastecer: mude este número', kind: 'text', placeholder: '1'},
      {id: 'mensagem', label: 'Mensagem', kind: 'text'}],
    defaults: {estilo: 'garrafa_termica', item: 'cafe_coado', doses: '8', carga: '1', mensagem: ''},
    rotuloAcao: clue => `Servir ${Comida()?.rotuloDe(chave(clue?.data?.item) || 'cafe_coado').toLowerCase() || ''}`.trim(),
    dados(clue) {
      const d = clue.data || {};
      const item = root.ITEM_DEFS?.[chave(d.item)] ? chave(d.item) : 'cafe_coado';
      return {...d, estilo: SERVIR[chave(d.estilo)] ? chave(d.estilo) : 'garrafa_termica', item, doses: inteiro(d.doses, 8, 0, 99), carga: String(d.carga ?? '1')};
    },
    restantes(clue, mem) {
      const d = this.dados(clue);
      if (mem.carga !== d.carga) { mem.carga = d.carga; mem.servidas = 0; }
      return Math.max(0, d.doses - inteiro(mem.servidas, 0, 0, 99));
    },
    activate(clue, sys, info = {}) { return aproximar(clue, sys, () => sys.open(clue, {source: info.source === 'jogadores' ? 'jogadores' : 'cena'})); },
    create(clue, sys) { const mem = memoriaDe(sys, clue); return {mem, sel: 0, t: 0, servindoT: 0, aviso: '', avisoT: 0}; },
    describe: st => ({servidas: st.mem?.servidas || 0, sel: st.sel}),
    acoes(clue, sys, st) {
      const d = this.dados(clue), C2 = Comida();
      const resta = this.restantes(clue, st.mem);
      const verbo = C2?.verbo(d.item) || 'Beber';
      if (!resta) return [];
      return [{id: 'beber', rotulo: `${verbo} agora`, icone: C2?.consumoDe(d.item)?.tipo === 'comer' ? 'comida' : 'gole'},
        {id: 'guardar', rotulo: 'Servir e guardar', icone: 'copo'}];
    },
    render(ctx, ui, st, clue, sys) {
      const dt = clamp(ui.dt || 0, 0, .1), d = this.dados(clue), S = servirDe(d.estilo);
      st.t += dt; st.servindoT = Math.max(0, st.servindoT - dt); st.avisoT = Math.max(0, st.avisoT - dt);
      if (!st.avisoT) st.aviso = '';
      const resta = this.restantes(clue, st.mem);
      const acoes = this.acoes(clue, sys, st);
      st.sel = clamp(st.sel, 0, Math.max(0, acoes.length - 1));
      const canvas = arte('servir:' + d.estilo, CENA.aw, CENA.ah, b => (PINTA_SERVIR[d.estilo] || PINTA_SERVIR.garrafa_termica)(b, {}));
      molduraCena(ctx, canvas);
      if (st.servindoT > 0) jato(ctx, AX(86), AY(46), AX(92), AY(56), ui.t, {grossura: 2, cor: rgba('madeira', 3, .9), gotas: false});
      if (resta > 0 && (d.item === 'cafe_coado' || d.item === 'cafe_leite' || d.item === 'cha_boldo')) vaporSobe(ctx, AX(70), AY(16), ui.t, {n: 2, alt: 18, largura: 6, forca: .5});
      const hot = ui.region('acao', AX(46), AY(10), 60 * 2, 54 * 2, {data: acoes[0]?.id || 'beber', cursor: 'pointer', silent: true});
      if (hot && acoes.length) U.ants(ctx, AX(46), AY(10), 120, 108, ui.t);
      acoes.forEach((a, i) => { const y = BOT.y + i * (BOT.h + BOT.gap); botaoAcao(ctx, ui, a.id, BOT.x, y, BOT.w, BOT.h, a, {sel: i === st.sel, t: ui.t}); });
      // medidor de doses
      const my = BOT.y + 2 * (BOT.h + BOT.gap) + 8;
      U.rect(ctx, BOT.x, my, BOT.w, 30, '#1b0a20e8'); U.outline(ctx, BOT.x, my, BOT.w, 30, '#4d2a52', 2);
      escreve(ctx, resta ? `${resta} ${resta === 1 ? 'dose' : 'doses'}` : 'vazia', BOT.x + 8, my + 4, resta ? TXT.claro : '#ff8a6a');
      const total = Math.max(1, this.dados(clue).doses);
      U.rect(ctx, BOT.x + 8, my + 18, BOT.w - 16, 6, '#0a0410');
      ret(ctx, BOT.x + 8, my + 18, (BOT.w - 16) * clamp(resta / total, 0, 1), 6, 'ambar', 4);
      escreve(ctx, Comida()?.rotuloDe(d.item) || '', BOT.x + BOT.w - 8, my + 4, TXT.dica, {align: 'right'});
      faixaTexto(ctx, st.aviso || texto(d.mensagem, resta ? S.texto : `${S.nome}: acabou. Alguém precisa encher de novo.`));
      U.header(ctx, ui, clue.name, resta ? 'W confirma · Esc fecha' : 'acabou', 'termica');
    },
    servir(id, st, clue, sys) {
      const C2 = Comida(), d = this.dados(clue), S = servirDe(d.estilo);
      const resta = this.restantes(clue, st.mem);
      if (!resta) { avisar(sys, 'VAZIA', `${S.nome} não tem mais nada.`, 'termica'); som(sys, 'erro'); return; }
      if (S.eletrica && !temEnergia(sys)) { st.aviso = 'Sem energia: a máquina não liga.'; st.avisoT = 3; som(sys, 'erro'); return; }
      const gastar = () => { st.mem.servidas = inteiro(st.mem.servidas, 0, 0, 99) + 1; seguro(() => sys.emit('change')); };
      som(sys, S.som);
      st.servindoT = 1.2;
      if (id === 'guardar') {
        const r = entregar(sys, d.item, 1, null, 'SERVIU');
        if (r) gastar();
        return;
      }
      const pode = C2.consumoDe(d.item)?.tipo === 'beber' ? sys.necessidades?.podeBeber?.() : sys.necessidades?.podeComer?.();
      if (pode && pode.ok === false) { avisar(sys, 'AGORA NÃO', pode.motivo || '', 'alerta'); return; }
      gastar();
      seguro(() => sys.close());
      C2.consumirPronto(d.item, null, {necessidades: sys.necessidades, consumo: sys.consumo, itens: sys.itens, toast: (a, b, c) => avisar(sys, a, b, c), minutos: sys.minutos},
        {alvoX: seguro(() => sys.stage?.anchorWorldX?.(clue.anchor), undefined)});
    },
    action(id, st, clue, sys, info = {}) { if (id === 'acao') this.servir(String(info.data), st, clue, sys); },
    key(e, st, clue, sys) {
      const acoes = this.acoes(clue, sys, st);
      if (!acoes.length) return false;
      const k = e.key, code = e.code;
      if (k === 'ArrowUp' || code === 'KeyW' || k === 'Enter' || k === ' ' || code === 'Space') { this.servir(acoes[st.sel]?.id || 'beber', st, clue, sys); return true; }
      if (k === 'ArrowDown' || code === 'KeyS' || k === 'ArrowRight' || code === 'KeyD') { st.sel = (st.sel + 1) % acoes.length; return true; }
      if (k === 'ArrowLeft' || code === 'KeyA') { st.sel = (st.sel + acoes.length - 1) % acoes.length; return true; }
      return false;
    }
  });

  /* ================================================================ vendedor
     Carrinho de pipoca, carrinho de coco, estufa de lanchonete, balcão de
     padaria, mesa do cafezinho e ambulante: cada um com o seu balcão desenhado
     e os produtos em cima, com o preço em moedas. */
  const PINTA_VENDEDOR = {
    pipoqueiro(b) {
      ceuFundo(b, 0, 0, 152, 54, {noite: true});
      ladrilho(b, 0, 54, 152, 46, {rampa: 'concreto', base: 3, tam: 14});
      const cx = 76;
      contato(b, cx - 40, 84, 80, 5);
      b.rect(cx - 36, 44, 72, 40, 'vermelho', 3);
      b.hline(cx - 36, cx + 35, 44, 'vermelho', 5); b.vline(cx + 35, 44, 83, 'vermelho', 2); b.vline(cx - 36, 44, 83, 'vermelho', 1);
      b.rect(cx - 32, 56, 64, 12, 'papel', 6); b.hline(cx - 32, cx + 31, 56, 'papel', 7);
      b.text(cx, 59, 'PIPOCA', 'vermelho', 2, {font: '3x5', align: 'center'});
      for (let i = 0; i < 6; i++) { b.rect(cx - 36 + i * 12, 70, 6, 12, 'papel', 5); b.rect(cx - 30 + i * 12, 70, 6, 12, 'vermelho', 4); }
      b.rect(cx - 34, 20, 68, 24, 'ceu', 2); b.frame(cx - 34, 20, 68, 24, 'metal', 4);
      b.rect(cx - 30, 24, 60, 18, 'papel', 7); b.speckle(cx - 30, 24, 60, 18, 'papel', 5, .25, K.rng(4));
      for (let i = 0; i < 26; i++) { const px = cx - 28 + (i * 7) % 56, py = 26 + ((i * 11) % 14); b.ellipse(px, py, 2.4, 2, 'papel', 7); b.px(px, py, 'amarelo', 5); }
      b.rect(cx - 6, 8, 12, 12, 'metal', 3); b.rect(cx - 10, 4, 20, 5, 'metal', 4); b.px(cx, 2, 'metal', 5);
      b.ellipse(cx - 26, 88, 8, 8, 'carvao', 1); b.ellipse(cx - 26, 88, 4, 4, 'metal', 3);
      b.ellipse(cx + 26, 88, 8, 8, 'carvao', 1); b.ellipse(cx + 26, 88, 4, 4, 'metal', 3);
      for (let i = 0; i < 9; i++) { b.px(cx - 40 + i * 10, 14 + (i % 3) * 3, 'amarelo', 5, K.EMISSIVE); }
    },
    coco(b) {
      ceuFundo(b, 0, 0, 152, 50);
      ladrilho(b, 0, 50, 152, 50, {rampa: 'concreto', base: 4, tam: 14});
      const cx = 74;
      contato(b, cx - 38, 84, 76, 5);
      b.rect(cx - 36, 46, 72, 38, 'verde', 3); b.hline(cx - 36, cx + 35, 46, 'verde', 5); b.vline(cx - 36, 46, 83, 'verde', 1);
      b.rect(cx - 32, 56, 64, 12, 'papel', 6); b.text(cx, 59, 'COCO GELADO', 'verde', 2, {font: '3x5', align: 'center'});
      b.poly([[cx - 44, 30], [cx + 44, 30], [cx + 38, 36], [cx - 38, 36]], 'amarelo', 4);
      for (let i = 0; i < 8; i++) b.vline(cx - 40 + i * 11, 30, 35, 'amarelo', 2);
      b.vline(cx, 12, 30, 'metal', 4); b.vline(cx + 1, 12, 30, 'metal', 2);
      for (let i = 0; i < 7; i++) { const px = cx - 30 + (i % 4) * 16, py = 38 + Math.floor(i / 4) * 10; b.sphere(px, py, 8, 7, 'verde', 1, 4); b.px(px - 2, py - 4, 'verde', 5); }
      b.rect(cx + 26, 26, 4, 14, 'metal', 4); b.rect(cx + 24, 24, 10, 3, 'madeira', 3);
      b.ellipse(cx - 24, 88, 8, 8, 'carvao', 1); b.ellipse(cx + 24, 88, 8, 8, 'carvao', 1);
    },
    estufa(b) {
      reboco(b, 0, 0, 152, 48, {rampa: 'papelVelho', base: 3, seed: 6, manchas: 1});
      b.rect(0, 48, 152, 6, 'madeira', 3); b.hline(0, 151, 48, 'madeira', 5);
      b.rect(0, 54, 152, 46, 'madeira', 2);
      for (let x = 0; x < 152; x += 18) b.vline(x, 54, 99, 'madeira', 1);
      const cx = 76;
      b.rect(cx - 44, 14, 88, 34, 'metal', 4); b.hline(cx - 44, cx + 43, 14, 'metal', 6); b.hline(cx - 44, cx + 43, 47, 'metal', 2);
      b.rect(cx - 41, 17, 82, 28, 'ceu', 2);
      b.hline(cx - 41, cx + 40, 17, 'ceu', 5);
      for (const y of [26, 36]) { b.hline(cx - 40, cx + 39, y, 'metal', 5); b.hline(cx - 40, cx + 39, y + 1, 'metal', 2); }
      for (let i = 0; i < 5; i++) { b.ellipse(cx - 32 + i * 16, 23, 5, 3.4, 'ambar', 4); b.px(cx - 33 + i * 16, 21, 'ambar', 6); }
      for (let i = 0; i < 5; i++) { b.ellipse(cx - 30 + i * 15, 33, 5, 3, 'ambar', 3); }
      for (let i = 0; i < 4; i++) { b.rect(cx - 28 + i * 18, 40, 10, 4, 'ambar', 5); }
      b.rect(cx - 44, 8, 88, 6, 'vermelho', 3); b.hline(cx - 44, cx + 43, 8, 'vermelho', 5);
      b.text(cx, 9, 'LANCHES', 'papel', 7, {font: '3x5', align: 'center'});
      for (let i = 0; i < 6; i++) b.px(cx - 40 + i * 16, 16, 'amarelo', 6, K.EMISSIVE);
      b.rect(cx - 50, 50, 100, 4, 'concreto', 4); b.hline(cx - 50, cx + 49, 50, 'concreto', 6);
    },
    padaria(b) {
      reboco(b, 0, 0, 152, 40, {rampa: 'papel', base: 4, seed: 3, manchas: 0});
      b.rect(0, 0, 152, 12, 'madeira', 3); b.hline(0, 151, 12, 'madeira', 1);
      b.text(76, 3, 'PADARIA', 'papel', 7, {font: '3x5', align: 'center'});
      for (let i = 0; i < 3; i++) { b.rect(10 + i * 48, 16, 40, 22, 'madeira', 2); b.hline(10 + i * 48, 49 + i * 48, 16, 'madeira', 4); for (let k = 0; k < 6; k++) { b.ellipse(16 + i * 48 + (k % 3) * 12, 22 + Math.floor(k / 3) * 9, 5, 3.4, 'ambar', 4); b.px(14 + i * 48 + (k % 3) * 12, 20 + Math.floor(k / 3) * 9, 'ambar', 6); } }
      b.rect(0, 40, 152, 8, 'concreto', 4); b.hline(0, 151, 40, 'concreto', 6); b.hline(0, 151, 47, 'concreto', 2);
      b.rect(0, 48, 152, 52, 'madeira', 3);
      for (let y = 48; y < 100; y += 8) { b.hline(0, 151, y, 'madeira', 1); veiosMadeira(b, 0, y + 1, 152, 7, 'madeira', 3, y); }
      for (let i = 0; i < 4; i++) { b.rect(16 + i * 34, 52, 24, 12, 'madeira', 2); b.hline(16 + i * 34, 39 + i * 34, 52, 'madeira', 4); for (let k = 0; k < 3; k++) b.ellipse(21 + i * 34 + k * 7, 56, 3.4, 2.4, 'ambar', 5); }
      b.rect(120, 36, 22, 12, 'metal', 3); b.rect(122, 38, 18, 8, 'carvao', 1); b.text(131, 40, '00', 'fosforo', 5, {font: '3x5', align: 'center'});
    },
    cafezinho(b) {
      azulejos(b, 0, 0, 152, 54, {rampa: 'papel', base: 5, tam: 8, seed: 12});
      b.rect(0, 54, 152, 6, 'concreto', 4); b.hline(0, 151, 54, 'concreto', 6);
      b.rect(0, 60, 152, 40, 'madeira', 2); portasArmario(b, 6, 64, 140, 36, {rampa: 'madeira', base: 2});
      b.rect(10, 20, 30, 34, 'vermelho', 3); b.ellipse(25, 20, 15, 4, 'vermelho', 4); b.rect(8, 12, 34, 9, 'carvao', 3);
      b.rect(12, 30, 26, 10, 'papel', 6); b.text(25, 33, 'CAFE', 'vermelho', 2, {font: '3x5', align: 'center'});
      b.rect(52, 30, 24, 24, 'palido', 5); b.ellipse(64, 30, 12, 4, 'palido', 6); b.rect(54, 34, 20, 16, 'madeira', 2);
      for (let i = 0; i < 5; i++) { const px = 86 + (i % 3) * 14, py = 40 + Math.floor(i / 3) * 12; b.rect(px, py, 10, 10, 'palido', 6); b.ellipse(px + 5, py, 5, 2, 'palido', 7); b.rect(px + 1, py + 3, 8, 5, 'madeira', 2); }
      b.rect(96, 16, 40, 16, 'papel', 5); b.frame(96, 16, 40, 16, 'papel', 2);
      b.text(116, 19, 'CAFE 1', 'tinta', 1, {font: '3x5', align: 'center'}); b.text(116, 26, 'C/LEITE 2', 'tinta', 1, {font: '3x5', align: 'center'});
    },
    ambulante(b) {
      ceuFundo(b, 0, 0, 152, 56);
      ladrilho(b, 0, 56, 152, 44, {rampa: 'concreto', base: 3, tam: 16});
      const cx = 74;
      contato(b, cx - 34, 86, 68, 5);
      b.rect(cx - 32, 50, 64, 36, 'palido', 6);
      b.hline(cx - 32, cx + 31, 50, 'palido', 7); b.vline(cx - 32, 50, 85, 'palido', 4); b.vline(cx + 31, 50, 85, 'palido', 7);
      b.rect(cx - 34, 44, 68, 7, 'palido', 5); b.hline(cx - 34, cx + 33, 44, 'palido', 7); b.hline(cx - 34, cx + 33, 50, 'palido', 3);
      b.rect(cx - 8, 40, 16, 5, 'carvao', 3); b.hline(cx - 8, cx + 7, 40, 'carvao', 5);
      b.rect(cx - 28, 58, 56, 12, 'azul', 3); b.hline(cx - 28, cx + 27, 58, 'azul', 5);
      b.text(cx, 61, 'GELADO', 'papel', 7, {font: '3x5', align: 'center'});
      for (let i = 0; i < 4; i++) { const px = cx - 24 + i * 14; b.rect(px, 30, 9, 14, 'vermelho', 3); b.hline(px, px + 8, 30, 'metal', 5); b.vline(px + 7, 31, 43, 'vermelho', 5); }
      b.speckle(cx - 30, 28, 60, 6, 'ceu', 5, .3, K.rng(9));
      b.rect(cx - 44, 60, 10, 26, 'madeira', 2); b.rect(cx + 34, 60, 10, 26, 'madeira', 2);
    }
  };
  Tipos.register('vendedor', {
    label: 'Vendedor (carrinho, estufa, banca)', icon: 'carrinho', sound: 'clique', categoria: 'interacao', veil: .74,
    fields: [
      {id: 'estilo', label: 'O que é', kind: 'select', options: [['pipoqueiro', 'Carrinho de pipoca'], ['coco', 'Carrinho de coco'], ['estufa', 'Estufa de lanchonete'], ['padaria', 'Balcão de padaria'], ['cafezinho', 'Mesa do cafezinho'], ['ambulante', 'Ambulante']]},
      {id: 'titulo', label: 'Letreiro', kind: 'text'},
      {id: 'produtos', label: 'Produtos: NOME | PREÇO em moedas | item [| estoque]', kind: 'textarea', rows: 5},
      {id: 'aberto', label: 'Aberto', kind: 'select', options: [['sim', 'Sim'], ['nao', 'Fechado']]},
      {id: 'mensagem', label: 'Fala do vendedor', kind: 'text'}],
    defaults: {estilo: 'pipoqueiro', titulo: '', produtos: VENDEDORES.pipoqueiro.produtos, aberto: 'sim', mensagem: ''},
    rotuloAcao: 'Comprar',
    dados(clue) {
      const d = clue.data || {}, estilo = VENDEDORES[chave(d.estilo)] ? chave(d.estilo) : 'estufa';
      const V = VENDEDORES[estilo];
      const lista = parseProdutos(texto(d.produtos, V.produtos));
      return {...d, estilo, V, produtos: lista.length ? lista : parseProdutos(V.produtos), titulo: texto(d.titulo, V.titulo), aberto: chave(d.aberto) !== 'nao'};
    },
    activate(clue, sys, info = {}) { return aproximar(clue, sys, () => sys.open(clue, {source: info.source === 'jogadores' ? 'jogadores' : 'cena'})); },
    create(clue, sys) { const mem = memoriaDe(sys, clue); if (!mem.vendidos || typeof mem.vendidos !== 'object') mem.vendidos = {}; return {mem, t: 0, sel: 0, tremor: 0, msg: '', msgT: 0, voo: []}; },
    describe: st => ({vendidos: {...(st.mem?.vendidos || {})}, sel: st.sel}),
    render(ctx, ui, st, clue, sys) {
      const dt = clamp(ui.dt || 0, 0, .1), d = this.dados(clue);
      st.t += dt; st.tremor = Math.max(0, st.tremor - dt); st.msgT = Math.max(0, st.msgT - dt);
      if (!st.msgT) st.msg = '';
      const canvas = arte('vend:' + d.estilo, CENA.aw, CENA.ah, b => (PINTA_VENDEDOR[d.estilo] || PINTA_VENDEDOR.estufa)(b));
      const tremor = st.tremor > 0 ? (Math.floor(st.t * 40) % 2 ? 3 : -3) : 0;
      ctx.save(); ctx.translate(tremor, 0);
      molduraCena(ctx, canvas);
      if (!d.aberto) {
        U.rect(ctx, CENA.x, CENA.y, CENA.w, CENA.h, '#0a0410bb');
        const lw = 150;
        U.rect(ctx, CENA.x + (CENA.w - lw) / 2, CENA.y + 80, lw, 34, '#1b0a20'); U.outline(ctx, CENA.x + (CENA.w - lw) / 2, CENA.y + 80, lw, 34, '#a44590', 2);
        escreve(ctx, 'FECHADO', CENA.x + CENA.w / 2, CENA.y + 92, '#ffd18c', {align: 'center', scale: 2});
      }
      // letreiro
      const tit = pequeno(d.titulo).slice(0, 22);
      U.rect(ctx, CENA.x + 6, CENA.y + 4, K.measure(tit) + 14, 16, '#140619dd');
      escreve(ctx, tit, CENA.x + 13, CENA.y + 8, '#ffd18c');
      ctx.restore();
      // produtos
      const px = 322, pw = 150;
      escreve(ctx, 'CARDÁPIO', px, 34, TXT.titulo);
      const moedas = temBolsa(sys) ? seguro(() => sys.itens.contar('moedas'), 0) : 99;
      d.produtos.slice(0, 5).forEach((prod, i) => {
        const y = 46 + i * 34;
        const vendido = prod.estoque > 0 && (st.mem.vendidos[prod.key] || 0) >= prod.estoque;
        const podePagar = moedas >= prod.preco && d.aberto && !vendido;
        const hot = !vendido && d.aberto && ui.region('comprar', px, y, pw, 30, {data: prod.key, silent: true});
        U.rect(ctx, px + 2, y + 2, pw, 30, '#07030a99');
        U.rect(ctx, px, y, pw, 30, hot ? '#48163f' : '#230c28');
        U.outline(ctx, px, y, pw, 30, i === st.sel ? '#ffd18c' : podePagar ? '#a44590' : '#5a3b58', 2);
        const c = prod.item ? itemCanvas(prod.item.id) : null;
        if (c) { ctx.imageSmoothingEnabled = false; ctx.save(); if (!podePagar) ctx.globalAlpha = .5; ctx.drawImage(c, px + 6, y + Math.round((30 - Math.min(26, c.height)) / 2), Math.min(26, c.width), Math.min(26, c.height)); ctx.restore(); }
        escreve(ctx, cortar(prod.nome, pw - 62), px + 34, y + 6, vendido ? '#7a6a80' : '#ffe6f7');
        ctx.drawImage(U.icon('moeda'), px + 34, y + 16, 10, 10);
        escreve(ctx, vendido ? 'acabou' : String(prod.preco), px + 47, y + 18, vendido ? '#7a6a80' : podePagar ? '#ffd18c' : '#ff8a6a');
      });
      // moedas na bolsa
      U.rect(ctx, px, 222, pw, 16, '#140619cc');
      ctx.drawImage(U.icon('moeda'), px + 4, 223, 12, 12);
      escreve(ctx, temBolsa(sys) ? `${moedas} ${moedas === 1 ? 'moeda' : 'moedas'}` : 'prévia sem bolsa', px + 20, 226, '#ffd18c');
      // itens voando para a bolsa
      st.voo = st.voo.filter(v => (v.t += dt) < .7);
      for (const v of st.voo) { const u = v.t / .7, c = itemCanvas(v.id); if (!c) continue; ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.drawImage(c, snap(v.x + u * 40), snap(v.y - u * 60), c.width * 2, c.height * 2); ctx.restore(); }
      faixaTexto(ctx, st.msg || texto(d.mensagem, d.aberto ? `${d.V.nome}. Escolha e pague em moedas.` : 'Fechado. Volte amanhã.'));
      U.header(ctx, ui, clue.name, d.aberto ? 'clique no produto · Esc fecha' : 'fechado', 'carrinho');
    },
    comprar(st, clue, sys, key) {
      const d = this.dados(clue), prod = d.produtos.find(p => p.key === key);
      if (!prod || !d.aberto) return;
      if (prod.estoque > 0 && (st.mem.vendidos[prod.key] || 0) >= prod.estoque) { st.msg = 'Esse acabou.'; st.msgT = 2; som(sys, 'erro'); return; }
      const moedas = temBolsa(sys) ? seguro(() => sys.itens.contar('moedas'), 0) : 99;
      if (moedas < prod.preco) { st.msg = `Faltam ${prod.preco - moedas} ${prod.preco - moedas === 1 ? 'moeda' : 'moedas'}.`; st.msgT = 2.4; st.tremor = .35; som(sys, 'erro'); return; }
      if (temBolsa(sys) && !seguro(() => sys.itens.gastar('moedas', prod.preco), false)) { st.msg = 'Sem moedas.'; st.msgT = 2; som(sys, 'erro'); return; }
      som(sys, 'moeda');
      if (prod.item) {
        const r = entregar(sys, prod.item.id, prod.item.qtd, prod.item.dados, 'COMPROU');
        if (r === false) { if (temBolsa(sys)) seguro(() => sys.itens.dar('moedas', prod.preco)); return; }
        st.voo.push({id: prod.item.id, x: 360, y: 120, t: 0});
      } else avisar(sys, 'COMPROU', prod.nome, 'carrinho');
      st.mem.vendidos[prod.key] = (st.mem.vendidos[prod.key] || 0) + 1;
      st.msg = `${prod.nome}: ${prod.preco} ${prod.preco === 1 ? 'moeda' : 'moedas'}.`;
      st.msgT = 2.4;
      som(sys, d.V.som);
      seguro(() => sys.emit('change'));
    },
    action(id, st, clue, sys, info = {}) { if (id === 'comprar') { const d = this.dados(clue); st.sel = d.produtos.findIndex(p => p.key === String(info.data)); this.comprar(st, clue, sys, String(info.data)); } },
    key(e, st, clue, sys) {
      const d = this.dados(clue), n = Math.min(5, d.produtos.length);
      if (!n) return false;
      const k = e.key, code = e.code;
      if (k === 'ArrowDown' || code === 'KeyS') { st.sel = (st.sel + 1) % n; som(sys, 'clique'); return true; }
      if (k === 'ArrowUp' || code === 'KeyW') { st.sel = (st.sel + n - 1) % n; som(sys, 'clique'); return true; }
      if (k === 'Enter' || k === ' ' || code === 'Space') { this.comprar(st, clue, sys, d.produtos[st.sel]?.key); return true; }
      if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; if (i < n) { st.sel = i; this.comprar(st, clue, sys, d.produtos[i].key); } return true; }
      return false;
    }
  });

  /* ================================================================ árvore frutífera
     Sem tela cheia: o personagem estica o braço e colhe. O cartão só aparece
     quando o mestre abre pelo painel (ou quando não há mais fruta madura). */
  Tipos.register('arvore_fruta', {
    label: 'Árvore frutífera', icon: 'fruta', sound: 'clique', categoria: 'interacao', veil: .5,
    fields: [
      {id: 'fruta', label: 'Fruta', kind: 'select', options: [['goiaba', 'Goiaba'], ['banana', 'Banana'], ['laranja', 'Laranja'], ['manga', 'Manga']]},
      {id: 'quantidade', label: 'Frutas maduras', kind: 'text', placeholder: '4'},
      {id: 'rebrota', label: 'Rebrota em (minutos; vazio = não rebrota)', kind: 'text', placeholder: '30'},
      {id: 'altura', label: 'Altura', kind: 'select', options: [['alto', 'No alto (estica o braço)'], ['baixo', 'Baixo (agacha)']]},
      {id: 'mensagem', label: 'Mensagem', kind: 'text'}],
    defaults: {fruta: 'goiaba', quantidade: '4', rebrota: '30', altura: 'alto', mensagem: ''},
    rotuloAcao: clue => `Colher ${FRUTAS[chave(clue?.data?.fruta)] ? FRUTAS[chave(clue.data.fruta)].toLowerCase() : 'fruta'}`,
    dados(clue) {
      const d = clue.data || {};
      return {...d, fruta: FRUTAS[chave(d.fruta)] ? chave(d.fruta) : 'goiaba', quantidade: inteiro(d.quantidade, 4, 0, 99),
        rebrota: inteiro(d.rebrota, 0, 0, 9999), altura: chave(d.altura) === 'baixo' ? 'baixo' : 'alto'};
    },
    relogio(sys) {
      const C2 = Comida();
      return {agora: C2 ? C2.minutos({minutos: sys?.minutos, exploracao: sys?.exploracao, necessidades: sys?.necessidades}) : Date.now() / 60000,
        hora: horaDaCena(sys)};
    },
    estado(clue, sys, mem) {
      const d = this.dados(clue), {agora, hora} = this.relogio(sys);
      return {...frutasMaduras(d, mem, agora, hora), d, agora, hora};
    },
    activate(clue, sys, info = {}) {
      const C2 = Comida(), mem = memoriaDe(sys, clue);
      if (!Array.isArray(mem.colhidas)) mem.colhidas = [];
      return aproximar(clue, sys, () => {
        const e = this.estado(clue, sys, mem), nome = FRUTAS[e.d.fruta];
        if (!e.maduras) {
          avisar(sys, 'NADA MADURO', e.voltam ? `Volta a dar em uns ${e.voltam} min.` : `Não sobrou nenhuma ${nome.toLowerCase()} madura.`, 'fruta');
          som(sys, 'folhas');
          return;
        }
        som(sys, 'galho');
        const alvoX = seguro(() => sys.stage?.anchorWorldX?.(clue.anchor), undefined);
        const cores = {goiaba: ['#a6c84a', '#f06a82'], banana: ['#f6cf3a', '#c8921e'], laranja: ['#f28a1c', '#4c9a3a'], manga: ['#f08a2a', '#7aa83a']}[e.d.fruta];
        const pedido = {tipo: 'colher', estilo: e.d.altura, rotulo: `Colhendo ${nome.toLowerCase()}`, alvoX, cor: cores[0], cor2: cores[1],
          aoConfirmar: () => {
            const r = seguro(() => (temBolsa(sys) ? sys.itens.dar(e.d.fruta, 1) : 'sem'), false);
            if (!r) { avisar(sys, 'BOLSA CHEIA', `A ${nome.toLowerCase()} não coube`, 'alerta'); return false; }
            mem.colhidas.push({t: e.agora, hora: e.hora});
            seguro(() => sys.emit('change'));
            return true;
          },
          aoTerminar: r => { if (r !== 'cancelado') avisar(sys, 'COLHEU', texto(e.d.mensagem, `Uma ${nome.toLowerCase()} madura.`), 'fruta'); }};
        pedir(sys, pedido);
      });
    },
    create(clue, sys) { const mem = memoriaDe(sys, clue); if (!Array.isArray(mem.colhidas)) mem.colhidas = []; return {mem, t: 0}; },
    describe(st) { return {colhidas: (st.mem?.colhidas || []).length}; },
    render(ctx, ui, st, clue, sys) {
      const e = this.estado(clue, sys, st.mem), nome = FRUTAS[e.d.fruta];
      const w = 260, h = 132, x = snap(240 - w / 2), y = snap(120 - h / 2);
      U.frame(ctx, x, y, w, h, 'madeira');
      escreve(ctx, clue.name.toUpperCase(), x + 14, y + 10, TXT.titulo);
      const c = itemCanvas(e.d.fruta);
      if (c) { ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x + 16, y + 28, c.width * 3, c.height * 3); }
      escreve(ctx, e.maduras ? `${e.maduras} ${e.maduras === 1 ? 'madura' : 'maduras'}` : 'nenhuma madura', x + 80, y + 32, e.maduras ? TXT.claro : '#ff8a6a');
      escreve(ctx, e.d.rebrota ? `rebrota em ${e.d.rebrota} min` : 'não rebrota', x + 80, y + 46, TXT.dica);
      if (e.voltam) escreve(ctx, `a próxima em ~${e.voltam} min`, x + 80, y + 58, TXT.dica);
      const linhas = K.wrap(texto(e.d.mensagem, `${nome} madura, no ponto de comer.`), w - 96).slice(0, 2);
      linhas.forEach((l, i) => escreve(ctx, l, x + 80, y + 72 + i * 11, TXT.claro));
      ui.button(ctx, 'colher', x + 14, y + h - 40, 120, 30, e.maduras ? 'COLHER' : 'NÃO TEM', {style: e.maduras ? 'fosforo' : 'roxo', disabled: !e.maduras});
      ui.button(ctx, 'rebrotar', x + 142, y + h - 40, 104, 30, 'REBROTAR', {style: 'papel'});
      U.header(ctx, ui, clue.name, 'a árvore normalmente é colhida direto na cena', 'fruta');
    },
    action(id, st, clue, sys) {
      if (id === 'colher') { seguro(() => sys.close()); this.activate(clue, sys, {source: 'mestre'}); }
      if (id === 'rebrotar') { st.mem.colhidas = []; som(sys, 'folhas'); avisar(sys, 'REBROTOU', 'A árvore está cheia de novo.', 'fruta'); seguro(() => sys.emit('change')); }
    },
    key(e, st, clue, sys) { if (e.key === 'Enter' || e.key === ' ') { this.action('colher', st, clue, sys); return true; } return false; }
  });
  /* A hora do relógio da cena em minutos (o mestre mudando a luz adianta o dia). */
  function horaDaCena(sys) {
    const c = sys?.stage?.state?.clock || sys?.stage?.clock;
    const m = /^(\d{1,2}):(\d{2})/.exec(String(c || ''));
    return m ? (Number(m[1]) % 24) * 60 + Number(m[2]) : null;
  }
})(typeof window !== 'undefined' ? window : globalThis);
