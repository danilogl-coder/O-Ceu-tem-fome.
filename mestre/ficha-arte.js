/* A arte da ficha — cartas de tarô, ícones e o d20, tudo em pixel art por
   código, desenhado uma vez e guardado em cache.

   A ficha roda num quadro de 960×540 com pixel de arte 2×2, ou seja uma
   grade de arte de 480×270: é o tamanho em que a fonte 5×7 ainda cabe
   ~96 caracteres por linha sem deixar de parecer pixel grosso.

   Cada atributo é uma CARTA de 48×80 pixels de arte, na proporção 1:1,67
   do tarô, com a estrutura de Marselha: numeral em cima, ilustração no
   meio, pontos de valor e faixa com o nome embaixo. A regra que vale para
   toda carta pequena: ela tem de ser reconhecível só pela silhueta. Por
   isso cada ilustração é uma forma fechada em três tons, e nada mais.

   As cores vêm do naipe de cada atributo — ouro para TAUMATURGIA, azul
   para COSMO, vermelho para SENSO, verde para SUBSTÂNCIA, âmbar para
   MÁQUINA — sobre a moldura roxa dos HUDs do jogo. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  if (!K || !U) return;
  const C = U.C, art = U.art, rnd = (a, b, s = 0) => K.hash2(Math.floor(a), Math.floor(b), s);

  /* -------------------------------------------------------------- paleta */
  /* O baralho do jogo usa NOVE cores e nada mais: seis da moldura magenta,
     que são as mesmas em todo naipe, e três do naipe. É essa restrição que
     dá coesão — a mesma disciplina das paletas de 16 cores. Os tons foram
     tirados das cartas de verdade, pixel a pixel.

     Em cada naipe: 0 preto · 1 fundo · 2 meio · 3 vivo · 4 brilho. */
  const MOLDURA = {
    preto: '#000008', quase: '#080000',
    escura: '#631763', media: '#8b378f', viva: '#97479b', luz: '#b367b7'
  };
  const NAIPE = {
    tmg: ['#000008', '#150019', '#631763', '#c05ac0', '#f7c8f7'],
    csm: ['#000008', '#080f1b', '#1b3767', '#6b97eb', '#c2d8fb'],
    sns: ['#000008', '#230000', '#b30000', '#ff4b4b', '#ffb0b0'],
    sbt: ['#000008', '#03190a', '#177a2b', '#4bff6b', '#c0ffcc'],
    mqn: ['#000008', '#1c1200', '#8a5e0c', '#f0bb2a', '#ffe9a8'],
    /* DOLORA e AMAZONA são os dois Arquétipos que perícia nenhuma
       alcança, e precisam de cor própria na carta. Dolora é o lilás
       cinzento do que ficou e não vai embora; Amazona é o rosa leitoso do
       que ainda está se formando. As duas ficam nos vãos que sobravam da
       roda de matizes — entre o azul e o magenta, e entre o verde e o
       azul — que é o que as mantém distinguíveis das outras quatro. */
    dol: ['#000008', '#16111d', '#5e4f7a', '#b7a4de', '#eee6fb'],
    ama: ['#000008', '#1c0e14', '#8a3a58', '#e07a9a', '#ffd2e2'],
    /* Só para os ícones: a cera da vela é osso, não ouro. */
    osso: ['#000008', '#2a2018', '#8a7a62', '#d8c8a8', '#fff4dc']
  };
  /* A chama entra como quatro cores a mais na paleta do ícone da vela. */
  const CHAMA = ['#3a1a00', '#b05a08', '#ffb020', '#fff0b0'];
  /* Um plotador de verdade: matriz de índices de cor, sem meio-tom e sem
     suavização. Pintar assim é o que deixa cada pixel sob controle. */
  class Pintor {
    constructor(w, h, cores) { this.w = w; this.h = h; this.cores = cores; this.buf = new Int8Array(w * h).fill(-1); }
    dentro(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    /* Uma origem deslocada deixa centrar o desenho sem mexer no desenho. */
    deslocar(dx, dy) { this.ox = dx; this.oy = dy; return this; }
    px(x, y, c) { x = Math.round(x + (this.ox || 0)); y = Math.round(y + (this.oy || 0)); if (this.dentro(x, y) && c >= 0) this.buf[y * this.w + x] = c; }
    apagar(x, y) { x = Math.round(x + (this.ox || 0)); y = Math.round(y + (this.oy || 0)); if (this.dentro(x, y)) this.buf[y * this.w + x] = -1; }
    em(x, y) { return this.dentro(x, y) ? this.buf[y * this.w + x] : -1; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
    moldura(x, y, w, h, c) { this.hline(x, x + w - 1, y, c); this.hline(x, x + w - 1, y + h - 1, c); this.vline(x, y, y + h - 1, c); this.vline(x + w - 1, y, y + h - 1, c); }
    hline(x0, x1, y, c) { if (x1 < x0) [x0, x1] = [x1, x0]; for (let x = x0; x <= x1; x++) this.px(x, y, c); }
    vline(x, y0, y1, c) { if (y1 < y0) [y0, y1] = [y1, y0]; for (let y = y0; y <= y1; y++) this.px(x, y, c); }
    /* Linha de Bresenham: segmentos de comprimento parelho, sem degrau solto. */
    linha(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    /* Traco com espessura de verdade. Uma linha de 1 px na tela grande vira
       1/fator de pixel na reducao: some, ou pior, vira chuvisco. Aqui a
       espessura vem em pixels da tela grande -- passe F para um traco de
       exatamente um pixel no resultado. Foi esta correcao que tirou a
       sujeira de todas as cinco figuras. */
    traco(x0, y0, x1, y1, c, esp = 1) {
      const r = Math.max(.5, esp / 2);
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(.4, r * .6)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        this.elipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
      }
    }
    /* Ponto redondo, diametro em pixels da tela grande. */
    ponto(x, y, d, c) { const r = Math.max(.5, d / 2); this.elipse(x, y, r, r, c); }
    /* Anel: a elipse vazada, com espessura que sobrevive a reducao. Os
       angulos abrem so um pedaco -- arco quebrado le melhor que circulo. */
    anel(cx0, cy0, rx, ry, c, esp = 1, a0 = 0, a1 = Math.PI * 2) {
      const n = Math.max(28, Math.ceil((rx + ry) * 1.8));
      for (let i = 0; i <= n; i++) {
        const t = a0 + (a1 - a0) * (i / n);
        this.ponto(cx0 + Math.cos(t) * rx, cy0 + Math.sin(t) * ry, esp, c);
      }
    }
    /* Capsula: retangulo de pontas redondas. E a forma de todo dedo, todo
       osso e todo cabo -- desenhar dedo com rect da canto quadrado. */
    capsula(x0, y0, x1, y1, larg, c) { this.traco(x0, y0, x1, y1, c, larg); }
    /* Cava: apaga ao longo de um traco grosso. O vao entre dois dedos tem
       de ser VAZIO, e nao preto pintado, senao a luz de borda nao acha a
       silhueta e os quatro dedos voltam a ser um bloco so. */
    cavar(x0, y0, x1, y1, esp = 1) {
      const r = Math.max(.5, esp / 2);
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(.4, r * .6)));
      for (let i = 0; i <= n; i++) {
        const t = i / n, ax = x0 + (x1 - x0) * t, ay = y0 + (y1 - y0) * t;
        for (let y = Math.floor(ay - r); y <= Math.ceil(ay + r); y++)
          for (let x = Math.floor(ax - r); x <= Math.ceil(ax + r); x++)
            if (((x - ax) / r) ** 2 + ((y - ay) / r) ** 2 <= 1) this.apagar(x, y);
      }
    }
    elipse(cx0, cy0, rx, ry, c, cheia = true) {
      for (let y = Math.floor(cy0 - ry); y <= Math.ceil(cy0 + ry); y++)
        for (let x = Math.floor(cx0 - rx); x <= Math.ceil(cx0 + rx); x++) {
          const d = ((x - cx0) / rx) ** 2 + ((y - cy0) / ry) ** 2;
          if (cheia ? d <= 1 : d <= 1 && d > .58) this.px(x, y, c);
        }
    }
    poly(pts, c) {
      let miny = Infinity, maxy = -Infinity;
      for (const [, y] of pts) { miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      for (let y = Math.floor(miny); y <= Math.ceil(maxy); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
          if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) this.hline(Math.round(xs[i]), Math.round(xs[i + 1]), y, c);
      }
    }
    /* Contorno escuro só onde a silhueta encosta no vazio: o contorno
       seletivo é o que separa a figura do fundo sem engessá-la. */
    contornar(c, alvo = null, esp = 1) {
      const copia = Int8Array.from(this.buf), passo = Math.max(1, Math.round(esp));
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (copia[y * this.w + x] !== -1) continue;
        let toca = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (let k = 1; k <= passo && !toca; k++) {
            const nx = x + dx * k, ny = y + dy * k;
            const v = this.dentro(nx, ny) ? copia[ny * this.w + nx] : -1;
            if (v !== -1 && (alvo === null || v >= alvo)) toca = true;
          }
          if (toca) break;
        }
        if (toca) this.px(x, y, c);
      }
    }
    /* Luz de borda: um pixel claro na aresta que olha para a fonte de luz
       (cima à esquerda), só onde já existe corpo. */
    contraluz(c, dx = -1, dy = -1, esp = 1) {
      const copia = Int8Array.from(this.buf), passo = Math.max(1, Math.round(esp));
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const v = copia[y * this.w + x];
        if (v === -1 || v === 0) continue;
        for (let k = 1; k <= passo; k++) {
          const nx = x + dx * k, ny = y + dy * k;
          const viz = this.dentro(nx, ny) ? copia[ny * this.w + nx] : -1;
          if (viz === -1) { this.px(x, y, c); break; }
        }
      }
    }
    /* Xadrez de 50% e 25%: gradiente onde não cabe mais um tom. */
    dither(x, y, w, h, c, densidade = .5, bloco = 1) {
      const b = Math.max(1, Math.round(bloco));
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const u = Math.floor(i / b), v = Math.floor(j / b);
        const q = densidade >= .5 ? ((u + v) % 2 === 0) : ((u % 2 === 0) && (v % 2 === 0));
        if (q) this.px(x + i, y + j, c);
      }
    }
    /* Ruído controlado: nunca uniforme, sempre mais denso onde já é escuro. */
    grao(x, y, w, h, c, densidade, semente) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
        if (rnd(x + i, y + j, semente) < densidade) this.px(x + i, y + j, c);
    }
    /* Volume de verdade: pega tudo que está na cor `base` e reparte em
       três tons por uma luz que vem de cima à esquerda. O terminador ganha
       uma onda para nunca ficar paralelo à silhueta — é isso que separa um
       corpo de um adesivo. `cx`,`cy` é o centro da forma. */
    sombrear(base, claro, escuro, {cx = this.w / 2, cy = this.h / 2, ang = -.72, onda = 2.2, freq = .26, corte = 0, largura = 3.4} = {}) {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const copia = Int8Array.from(this.buf);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (copia[y * this.w + x] !== base) continue;
        const d = (x - cx) * ux + (y - cy) * uy + Math.sin((x * .7 + y) * freq) * onda;
        if (d < corte - largura) this.px(x, y, claro);
        else if (d > corte + largura * 1.12) this.px(x, y, escuro);
      }
    }
    /* Oclusão de contato: escurece um pixel onde a forma encosta em outra. */
    oclusao(base, escuro, vizinho, esp = 1) {
      const copia = Int8Array.from(this.buf), passo = Math.max(1, Math.round(esp));
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (copia[y * this.w + x] !== base) continue;
        let achou = false;
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) {
          for (let k = 1; k <= passo && !achou; k++) {
            const nx = x + dx * k, ny = y + dy * k;
            const v = this.dentro(nx, ny) ? copia[ny * this.w + nx] : -1;
            if (v === vizinho) achou = true;
          }
          if (achou) break;
        }
        if (achou) this.px(x, y, escuro);
      }
    }
    /* Tira os pixels soltos: um pixel sem vizinho da mesma cor some. */
    limpar() {
      const copia = Int8Array.from(this.buf);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const v = copia[y * this.w + x];
        if (v === -1) continue;
        let iguais = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (this.dentro(x + dx, y + dy) && copia[(y + dy) * this.w + x + dx] === v) iguais++;
        if (iguais === 0) this.px(x, y, this.em(x + 1, y) >= 0 ? this.em(x + 1, y) : this.em(x - 1, y));
      }
    }
    /* -------------------------------------------------- reduzir sem borrar
       Desenhar grande e diminuir é o jeito de ganhar detalhe — desde que a
       redução NÃO faça média de cor, senão vira borrão e inventa tons que
       não existem na paleta. Aqui cada pixel de destino recebe a cor que
       MAIS aparece no bloco de origem, com três correções:

         · o centro do bloco pesa mais, então linha fina de 1 px em alta não
           desaparece na redução;
         · empate vai para o tom mais claro, porque sobre fundo quase preto
           é a luz que carrega a silhueta (um contorno escuro perdido não
           faz falta, um brilho perdido apaga a forma);
         · o vazio só vence se for maioria folgada, senão a figura come
           buraco na borda.

       O resultado é um desenho de 50×78 com o cuidado de um de 150×234, e
       nenhuma cor fora das nove. */
    reduzir(fator, {limiarVazio = .74, brilho = .45, raridade = .9} = {}) {
      const w = Math.round(this.w / fator), h = Math.round(this.h / fator);
      const fora = new Pintor(w, h, this.cores);
      const meio = (fator - 1) / 2, area = fator * fator;
      const maxI = Math.max(1, this.cores.length - 1);
      /* Quanto mais rara a cor no desenho inteiro, mais ela vale no voto.
         Um traço fino escuro dentro de uma área cheia é detalhe de
         propósito, não ruído — sem isso a maioria simples o engole e a
         redução entrega uma figura mais pobre do que a original. */
      const total = new Map();
      for (const v of this.buf) if (v !== -1) total.set(v, (total.get(v) || 0) + 1);
      const maior = Math.max(1, ...total.values());
      const raro = v => 1 + raridade * (1 - Math.sqrt((total.get(v) || 1) / maior));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const voto = new Map();
        let vazio = 0;
        for (let j = 0; j < fator; j++) for (let i = 0; i < fator; i++) {
          const v = this.em(x * fator + i, y * fator + j);
          if (v === -1) { vazio++; continue; }
          const d = Math.hypot(i - meio, j - meio);
          const centro = 1 + (1 - Math.min(1, d / (meio + .6))) * 1.4;
          const luz = 1 + (v / maxI) * brilho;
          voto.set(v, (voto.get(v) || 0) + centro * luz * raro(v));
        }
        if (vazio / area > limiarVazio || !voto.size) continue;
        let melhor = -1, nota = -1;
        for (const [v, k] of voto) if (k > nota + 1e-9 || (Math.abs(k - nota) < 1e-9 && v > melhor)) { melhor = v; nota = k; }
        fora.px(x, y, melhor);
      }
      return fora;
    }
    /* Cola outro pintor por cima, respeitando o vazio. */
    colar(outro, x, y) {
      for (let j = 0; j < outro.h; j++) for (let i = 0; i < outro.w; i++) {
        const v = outro.em(i, j);
        if (v !== -1) this.px(x + i, y + j, v);
      }
    }
    paraCanvas() {
      const c = root.document.createElement('canvas');
      c.width = this.w; c.height = this.h;
      const g = c.getContext('2d'), img = g.createImageData(this.w, this.h), d = img.data;
      for (let i = 0; i < this.buf.length; i++) {
        const v = this.buf[i];
        if (v < 0) continue;
        const hex = this.cores[Math.min(v, this.cores.length - 1)];
        d[i * 4] = parseInt(hex.slice(1, 3), 16);
        d[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
        d[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
        d[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    }
  }
  /* Desenha a figura numa tela três vezes maior e traz de volta: é onde
     nascem as curvas boas e os detalhes que não cabem direto em 44×47. */
  function emAlta(w, h, cores, fator, fn, folga = 1, depois = null) {
    const grande = new Pintor(w * fator, h * fator, cores);
    // `folga` encolhe o desenho dentro da tela grande e o recentra, para a
    // figura não encostar na moldura — respiro é parte da composição.
    const F = fator * folga;
    grande.deslocar((w * fator - w * F) / 2, (h * fator - h * F) / 2);
    fn(grande, F);
    grande.deslocar(0, 0);
    const pequeno = grande.reduzir(fator);
    pequeno.limpar();
    /* O que é fino demais para sobreviver à redução é desenhado AQUI, no
       tamanho final, com cada pixel na mão. Vem depois do `limpar` de
       propósito: um brilho de um pixel só é cisco para ele, e detalhe para
       quem o pôs ali. */
    if (depois) depois(pequeno);
    return pequeno;
  }

  const cacheP = new Map();
  /* Desenha uma vez e guarda: `cores` é a paleta e `fn(p)` pinta. */
  function pintar(chave, w, h, cores, fn) {
    let c = cacheP.get(chave);
    if (c) return c;
    const p = new Pintor(w, h, cores);
    fn(p, cores);
    c = p.paraCanvas();
    cacheP.set(chave, c);
    if (cacheP.size > 420) cacheP.delete(cacheP.keys().next().value);
    return c;
  }
  /* A paleta de uma carta: as seis da moldura e as cinco do naipe. */
  const paletaDe = atr => [MOLDURA.preto, MOLDURA.quase, MOLDURA.escura, MOLDURA.media, MOLDURA.viva, MOLDURA.luz,
    ...(NAIPE[atr] || NAIPE.csm)];
  /* Índices, com nome, para o desenho ficar legível. */
  const M = {PRETO: 0, QUASE: 1, ESCURA: 2, MEDIA: 3, VIVA: 4, LUZ: 5};
  const N = {PRETO: 6, FUNDO: 7, MEIO: 8, VIVO: 9, BRILHO: 10};
  /* O ícone da ficha, para os avisos do jogo: a carta com o olho. */
  U.ICONS.ficha = b => {
    b.rect(2, 1, 12, 14, 'carvao', 0); b.frame(2, 1, 12, 14, 'roxo', 4);
    b.ellipse(8, 7, 4, 2.6, 'roxo', 6); b.ellipse(8, 7, 1.6, 1.6, 'preto', 0);
    b.px(7, 6, 'papel', 7);
    for (let i = 0; i < 3; i++) b.px(5 + i * 3, 12, 'roxo', 5);
  };

  /* Medidas da carta. A proporção 50:78 é a mesma 1:1,56 das cartas do
     baralho, e o período 7 do ornamento fecha exato nos dois lados. */
  const CARTA = {w: 50, h: 78, topo: 13, faixa: 11, arte: {x: 3, y: 14, w: 44, h: 47}};

  /* ------------------------------------------------------------- moldura */
  /* Três pixels de magenta com o canto comido, o ornamento repetido nas
     bordas com período 7 e os quatro cantos desenhados à mão. Uma carta de
     verdade tem defeito: três pixels tortos, sempre os mesmos por carta. */
  function molduraCarta(p, semente) {
    const {w, h} = CARTA;
    p.rect(0, 0, w, h, M.PRETO);
    p.rect(2, 2, w - 4, h - 4, M.ESCURA);
    p.rect(3, 3, w - 6, h - 6, M.VIVA);
    p.rect(4, 4, w - 8, h - 8, M.MEDIA);
    p.rect(5, 5, w - 10, h - 10, N.PRETO);
    // Cantos redondos: dois pixels comidos e um degrau, como carta impressa.
    for (const [cx0, cy0, sx, sy] of [[0, 0, 1, 1], [w - 1, 0, -1, 1], [0, h - 1, 1, -1], [w - 1, h - 1, -1, -1]]) {
      p.apagar(cx0, cy0); p.apagar(cx0 + sx, cy0); p.apagar(cx0, cy0 + sy);
      p.px(cx0 + sx * 2, cy0, M.PRETO); p.px(cx0, cy0 + sy * 2, M.PRETO);
      p.px(cx0 + sx, cy0 + sy, M.PRETO);
      p.px(cx0 + sx * 2, cy0 + sy, M.ESCURA); p.px(cx0 + sx, cy0 + sy * 2, M.ESCURA);
      p.px(cx0 + sx * 2, cy0 + sy * 2, M.VIVA);
      // O ornamento de canto: um colchete de três braços, à mão.
      const bx = cx0 + sx * 5, by = cy0 + sy * 5;
      p.px(bx, by, M.LUZ); p.px(bx + sx, by, M.LUZ); p.px(bx, by + sy, M.LUZ);
      p.px(bx + sx * 2, by, M.VIVA); p.px(bx, by + sy * 2, M.VIVA);
      p.px(bx + sx * 3, by, M.MEDIA); p.px(bx, by + sy * 3, M.MEDIA);
      p.px(bx + sx * 2, by + sy * 2, M.ESCURA);
    }
    // O motivo repetido: período 7, dois pixels de conteúdo e um de folga.
    for (let x = 10; x < w - 10; x += 7) {
      p.px(x, 1, M.LUZ); p.px(x + 1, 1, M.MEDIA);
      p.px(x, h - 2, M.LUZ); p.px(x + 1, h - 2, M.MEDIA);
    }
    for (let y = 12; y < h - 12; y += 7) {
      p.px(1, y, M.LUZ); p.px(1, y + 1, M.MEDIA);
      p.px(w - 2, y, M.LUZ); p.px(w - 2, y + 1, M.MEDIA);
    }
    // Os defeitos de propósito: a impressão nunca sai perfeita.
    for (let i = 0; i < 3; i++) {
      const lado = rnd(i, semente, 91);
      const x = 6 + Math.floor(rnd(i, semente, 92) * (w - 12));
      const y = 6 + Math.floor(rnd(i, semente, 93) * (h - 12));
      if (lado < .5) p.px(x, lado < .25 ? 2 : h - 3, M.ESCURA);
      else p.px(lado < .75 ? 2 : w - 3, y, M.ESCURA);
    }
  }

  /* A janela da arte, em nomes curtos: é dentro dela que tudo acontece. */
  const AX = CARTA.arte.x, AY = CARTA.arte.y, AW = CARTA.arte.w, AH = CARTA.arte.h;
  const cxA = AX + AW / 2;

  /* -------------------------------------------------------------- figuras
     A regra das cinco, na ordem em que se desenha:
       1. a silhueta inteira num tom só — o que não lê em silhueta não lê;
       2. o volume de UMA luz só, de cima à esquerda, terminador ondulado;
       3. os vãos cavados DEPOIS do volume, senão ganham sombra e somem;
       4. a gravura — dobras, veias, nervuras — no tom escuro, espessura F;
       5. a luz de borda por último, numa camada à parte, para não acender
          o que está atrás dela;
       6. no máximo quatro acentos, e cada um com corpo: acento fino demais
          não é acento, é sujeira.
     Nada mais fino que F. Abaixo disso a redução come ou deixa cisco — foi
     o erro que deixava as cinco figuras chuviscadas.

     E a regra dura da paleta: sobre o breu da janela, o tom FUNDO de cada
     naipe é quase preto. Ele serve de sombra DENTRO de uma forma acesa e
     nunca de traço solto no escuro — raiz, arco ou cinta desenhada em
     fundo simplesmente não existe na carta.

     Daí a escada de tons destas cinco, que é a da arte clara sobre breu e
     não a da arte escura sobre papel: a silhueta nasce em VIVO, o BRILHO é
     a faixa estreita que a luz pega, o MEIO é a sombra e o FUNDO só aparece
     no contato — gravura e vão. Pintar a silhueta em meio, como se pinta no
     claro, faz a figura afundar no preto da janela. */
  /* ----------------------------------------------------------- o compasso
     As figuras das cartas se mexem. Cada uma tem um ciclo de dezesseis
     quadros, desenhados sob demanda e guardados: o primeiro custa o
     pipeline inteiro (3× e redução), os quinze seguintes custam um
     `drawImage`. Como nascem espalhados ao longo do primeiro ciclo, um por
     vez, ninguém vê a conta.

     A regra do movimento numa arte de 44×47 é: pouco, e nunca tudo junto.
     O que se mexe é o que está VIVO na figura — a chama, a pálpebra, a
     batida, a seiva, o reflexo correndo no metal. A silhueta fica parada,
     porque silhueta que treme a um pixel não respira: pisca. */
  const QUADROS = 16;
  const TAU = Math.PI * 2;
  /* Um pico curto no ciclo, com subida e descida suaves: serve de batida
     do coração, de piscada e de relance de luz. Dá a volta certa no 1. */
  const pico = (f, centro, largura) => {
    const d = Math.abs(((f - centro) % 1 + 1.5) % 1 - .5);
    return d >= largura ? 0 : Math.cos(d / largura * Math.PI) * .5 + .5;
  };
  /* Onda de 0 a 1 que fecha exata no fim do ciclo. */
  const vai = (f, atraso = 0) => Math.sin((f - atraso) * TAU) * .5 + .5;

  const FIGURAS = {
    /* TAUMATURGIA · a mão aberta com o olho na palma, contra a auréola.
       Uma mão tem de ler como mão à distância de um braço: por isso os
       dedos são cápsulas separadas por vão vazio de um pixel cheio, e o
       polegar sai para fora — é ele que diz mão, e não pé. */
    tmg(p, F, f = 0) {
      const cx = 22 * F, u = F;
      // 1. A auréola: um disco de luz fraca — no magenta da moldura, que já
      //    está na paleta — e nove raios que nascem FORA da silhueta. Raio
      //    que cruza dedo vira risco, e foi isso que sujava a carta antes.
      //    Ela PULSA: uma onda corre de um raio ao outro em vez de todos
      //    crescerem juntos, e um relance de luz dá a volta no anel.
      const hy = 21 * F, resp = 1 + (vai(f) - .5) * .05;
      p.anel(cx, hy, 13.6 * resp * F, 12.2 * resp * F, M.ESCURA, 4.4 * u);
      p.anel(cx, hy, 15.4 * resp * F, 13.8 * resp * F, M.MEDIA, 1.2 * u, Math.PI * .96, Math.PI * 2.04);
      const relance = Math.PI * .96 + f * Math.PI * 1.08;
      p.anel(cx, hy, 15.4 * resp * F, 13.8 * resp * F, M.LUZ, 1.8 * u, relance, relance + Math.PI * .15);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 1.02 + (i / 8) * Math.PI * .96, longo = i % 2 === 0;
        const o = vai(f, i / 9 * .85);
        const r0 = 1.12 * resp, r1 = ((longo ? 1.31 : 1.18) + o * .16) * resp;
        p.traco(cx + Math.cos(a) * 15.4 * F * r0, hy + Math.sin(a) * 13.8 * F * r0,
                cx + Math.cos(a) * 15.4 * F * r1, hy + Math.sin(a) * 13.8 * F * r1,
                o > .8 ? N.VIVO : longo ? N.VIVO : N.MEIO, (longo ? 1.9 : 1.4) * u);
      }
      // 2. A mão, numa camada só dela: assim a luz de borda não acende a auréola.
      const H = new Pintor(p.w, p.h, p.cores);
      const dedos = [[-7.3, 10.6, 3.5], [-2.45, 6.4, 3.7], [2.45, 7.6, 3.7], [7.3, 12, 3.3]];
      for (const [dx, topo, larg] of dedos)
        H.capsula(cx + dx * F, topo * F, cx + dx * F, 25 * F, larg * F, N.VIVO);
      H.capsula(cx - 8.6 * F, 26.4 * F, cx - 14 * F, 32.4 * F, 4.4 * F, N.VIVO);
      H.poly([[cx - 9.6 * F, 21 * F], [cx + 9.6 * F, 21 * F], [cx + 8.8 * F, 34 * F],
              [cx + 5.6 * F, 39 * F], [cx + 5.6 * F, 47 * F], [cx - 5.6 * F, 47 * F],
              [cx - 5.6 * F, 39 * F], [cx - 8.8 * F, 34 * F]], N.VIVO);
      H.elipse(cx, 23 * F, 9.6 * F, 5.4 * F, N.VIVO);
      // 3. O volume, de uma luz só.
      H.sombrear(N.VIVO, N.BRILHO, N.MEIO,
        {cx: cx - 5 * F, cy: 30 * F, ang: .86, onda: 1.8 * F, freq: .08 / F, largura: 8.2 * F, corte: -3.4 * F});
      // 4. Os vãos entre os dedos: vazios de verdade, não preto pintado.
      for (let i = 0; i < 3; i++) {
        const x = cx + (dedos[i][0] + dedos[i + 1][0]) / 2 * F;
        H.cavar(x, Math.min(dedos[i][1], dedos[i + 1][1]) * F - F, x, 23.6 * F, 1.2 * u);
      }
      // 5. A gravura: os nós dos dedos e as duas linhas da palma.
      for (const [dx, topo, larg] of dedos) {
        const x = cx + dx * F;
        H.traco(x - larg * .34 * F, (topo + 4.6) * F, x + larg * .34 * F, (topo + 4.9) * F, N.MEIO, 1.05 * u);
        H.traco(x - larg * .3 * F, (topo + 10.2) * F, x + larg * .3 * F, (topo + 10.5) * F, N.MEIO, 1.05 * u);
      }
      H.traco(cx - 7.4 * F, 27.4 * F, cx + 2.6 * F, 26 * F, N.MEIO, 1.05 * u);
      H.traco(cx - 6 * F, 36.4 * F, cx + 4.4 * F, 34.8 * F, N.MEIO, 1.05 * u);
      // 6. A luz de borda, só na mão, e a oclusão onde o polegar encosta.
      H.contraluz(N.BRILHO, -1, -1, Math.max(1, Math.round(u * .8)));
      p.colar(H, 0, 0);
      /* O OLHO NA PALMA — o assunto da carta — não é desenhado aqui: ele é
         fino demais para atravessar a redução de 3 para 1, e sai em
         `FINOS.tmg`, no tamanho final. Veja lá o porquê. */
    },
    /* COSMO · o olho que é um sistema: íris de órbitas, estrelas com corpo
       e o poço afundando embaixo. Nenhuma estrela de um pixel só — na
       redução, um pixel solto vira cisco, nunca vira estrela. */
    csm(p, F, f = 0) {
      const W = 44 * F, cx = 22 * F, cy = 21 * F, u = F;
      const q = Math.round(f * QUADROS) % QUADROS;
      // As estrelas CINTILAM: uma de cada vez acende, em ordem espalhada.
      for (let i = 0; i < 16; i++) {
        const x = 2 * F + rnd(i, 3, 11) * (W - 4 * F);
        const y = 1 * F + rnd(i, 7, 12) * 31 * F;
        if (Math.hypot((x - cx) / (20 * F), (y - cy) / (13 * F)) < 1.12) continue;
        const acesa = (i * 5 + q) % 13 < 2;
        if (rnd(i, 1, 13) > .68 || acesa) {
          const r = acesa ? 1.3 : 1;
          p.traco(x - 2.4 * r * F, y, x + 2.4 * r * F, y, N.FUNDO, .95 * u);
          p.traco(x, y - 2.4 * r * F, x, y + 2.4 * r * F, N.FUNDO, .95 * u);
          p.ponto(x, y, 2.1 * r * u, N.VIVO);
          p.ponto(x, y, 1.1 * r * u, N.BRILHO);
        } else p.ponto(x, y, 1.3 * u, N.MEIO);
      }
      /* O olho PISCA. A pálpebra fecha a amêndoa inteira por dois quadros:
         é o movimento mais barato e o mais assustador dos cinco, porque a
         carta passa a ter um tempo próprio que não é o do jogador. */
      const ab = 1 - pico(f, .88, .085) * .93;
      const H = 10.4 * ab, ir = Math.min(1, ab * 1.4);
      const amendoa = (r, c) => p.poly([[cx - 19.4 * r * F, cy], [cx - 9 * r * F, cy - H * r * F],
        [cx + 9 * r * F, cy - H * r * F], [cx + 19.4 * r * F, cy],
        [cx + 9 * r * F, cy + H * r * F], [cx - 9 * r * F, cy + H * r * F]], c);
      amendoa(1, N.FUNDO); amendoa(.93, N.MEIO);
      if (ir > .3) {
        // A íris GIRA: um décimo de volta por ciclo, que fecha exato no fim.
        p.elipse(cx, cy, 8.6 * ir * F, 8.6 * ir * F, N.FUNDO);
        p.anel(cx, cy, 8 * ir * F, 8 * ir * F, N.VIVO, 1.7 * u);
        for (let i = 0; i < 10; i++) {
          const t = i / 10 * TAU + .3 + f * TAU / 10;
          p.traco(cx + Math.cos(t) * 4.4 * ir * F, cy + Math.sin(t) * 4.4 * ir * F,
                  cx + Math.cos(t) * 7.2 * ir * F, cy + Math.sin(t) * 7.2 * ir * F, N.MEIO, u);
        }
        p.anel(cx, cy, 5.6 * ir * F, 5.6 * ir * F, N.VIVO, 1.05 * u);
        p.elipse(cx, cy, 4 * ir * F, 4 * ir * F, N.PRETO);
        p.anel(cx, cy, 4 * ir * F, 4 * ir * F, N.BRILHO, 1.05 * u);
        p.elipse(cx, cy, 2.2 * ir * F, 2.2 * ir * F, N.PRETO);
        p.ponto(cx - 1.3 * F, cy - 1.3 * ir * F, 1.8 * u, N.BRILHO);
        // A lua pequena ORBITA: é ela que dá escala — e tempo — ao sistema.
        const ma = -.9 + f * TAU;
        const mx = cx + Math.cos(ma) * 6.8 * F, my = cy + Math.sin(ma) * 6.8 * ir * F;
        p.ponto(mx, my, 2.4 * u, N.BRILHO);
        p.ponto(mx + .6 * F, my - .5 * F, 1.4 * u, N.FUNDO);
      } else {
        p.traco(cx - 16 * F, cy, cx + 16 * F, cy, N.VIVO, 1.4 * u);
      }
      // A pálpebra: a luz só na aresta de cima, que é a que olha para a luz.
      p.traco(cx - 19.4 * F, cy, cx - 9 * F, cy - H * F, N.BRILHO, 1.2 * u);
      p.traco(cx - 9 * F, cy - H * F, cx + 9 * F, cy - H * F, N.BRILHO, 1.2 * u);
      p.traco(cx + 9 * F, cy - H * F, cx + 19.4 * F, cy, N.VIVO, 1.05 * u);
      p.traco(cx - 19.4 * F, cy, cx - 9 * F, cy + H * F, N.FUNDO, 1.05 * u);
      p.traco(cx + 9 * F, cy + H * F, cx + 19.4 * F, cy, N.FUNDO, 1.05 * u);
      // Os cílios: descem junto com a pálpebra, senão ficam boiando.
      for (const [dx, alt] of [[-12.6, 2.6], [-7.2, 4], [-1, 4.8], [5.2, 3.8], [10.8, 2.4]]) {
        const x = cx + dx * F, topo = cy - H * F + Math.abs(dx) * .1 * F;
        p.traco(x, topo + 1.6 * F, x + dx * .16 * F, topo - alt * F, N.MEIO, 1.7 * u);
        p.traco(x, topo + 1.6 * F, x + dx * .16 * F, topo - alt * F, N.VIVO, 1.05 * u);
      }
      // O poço AFUNDA: cada arco desce e sobe com um atraso, como onda.
      for (let i = 0; i < 3; i++) {
        const o = (vai(f, i * .17) - .5) * 1.1 * F;
        p.anel(cx, (34.6 + i * 3.4) * F + o, (15.4 - i * 4.2) * F, 3.2 * F,
               i === 0 ? N.VIVO : N.MEIO, (1.9 - i * .3) * u, 0, Math.PI);
      }
      p.traco(cx - 15.4 * F, 34.6 * F, cx + 15.4 * F, 34.6 * F, N.VIVO, 1.4 * u);
      p.ponto(cx - 15.4 * F, 34.6 * F, 2 * u, N.BRILHO);
      p.ponto(cx + 15.4 * F, 34.6 * F, 2 * u, N.BRILHO);
    },
    /* SENSO · o coração coroado de espinhos, com a vela acesa em cima.
       A coroa é um anel trançado de verdade — passa por diante embaixo e
       por trás em cima — e não uma fila de tracinhos que some na redução. */
    sns(p, F, f = 0) {
      const cx = 22 * F, cy = 26 * F, u = F;
      const q = Math.round(f * QUADROS) % QUADROS;
      /* O coração BATE, e bate como coração: duas pancadas, a segunda mais
         fraca, e depois o silêncio do resto do ciclo. Um pulso senoidal
         parelho pareceria respiração, não batimento. */
      const bat = Math.max(pico(f, .02, .075), .58 * pico(f, .17, .055));
      const e = 1 + .075 * bat;
      const X = d => cx + d * e * F, Y = d => cy + d * e * F;
      const C = new Pintor(p.w, p.h, p.cores);
      C.elipse(X(-6.6), Y(-6.4), 8.6 * e * F, 8 * e * F, N.VIVO);
      C.elipse(X(6.6), Y(-6.8), 8.6 * e * F, 8 * e * F, N.VIVO);
      C.poly([[X(-14.8), Y(-4.6)], [X(14.8), Y(-5)], [X(1), Y(16.2)]], N.VIVO);
      C.sombrear(N.VIVO, N.BRILHO, N.MEIO,
        {cx: X(-4.6), cy: Y(-6), ang: .72, onda: 2.6 * F, freq: .1 / F, largura: 7.4 * F, corte: -1.4 * F});
      // O sulco entre os ventrículos e as veias, gravados por cima.
      C.traco(X(-.4), Y(-13.6), X(.8), Y(-2.4), N.MEIO, 1.4 * u);
      for (const [x0, y0, x1, y1, x2, y2] of [
        [-8, -8.6, -11.4, -1.6, -12.6, 3.2], [-8, -8.6, -4.6, -1, -5.4, 4],
        [7.2, -9.4, 10.6, -2.4, 11.4, 2.2], [7.2, -9.4, 4, -.6, 4.8, 4.6]]) {
        C.traco(X(x0), Y(y0), X(x1), Y(y1), N.MEIO, 1.2 * u);
        C.traco(X(x1), Y(y1), X(x2), Y(y2), N.MEIO, .95 * u);
      }
      C.contraluz(N.BRILHO, -1, -1, Math.max(1, Math.round(u * .8)));
      p.colar(C, 0, 0);
      // A coroa: anel trançado, claro onde passa no breu e escuro no corpo.
      // Ela NÃO se mexe: é a coisa parada que faz a batida ser visível.
      const ax = 15 * F, ay = 7.2 * F, ay0 = cy - 1.6 * F;
      p.anel(cx, ay0, ax, ay, N.PRETO, 2.6 * u, .1, Math.PI - .1);
      p.anel(cx, ay0, ax, ay, N.MEIO, 1.3 * u, .1, Math.PI - .1);
      p.anel(cx, ay0, ax, ay, N.PRETO, 2.4 * u, Math.PI + .1, Math.PI * 2 - .1);
      p.anel(cx, ay0, ax, ay, N.VIVO, 1.25 * u, Math.PI + .1, Math.PI * 2 - .1);
      const luz = Math.floor(f * 5) % 5;
      for (let i = 0; i < 5; i++) {                       // os espinhos
        const a = -Math.PI * .92 + i / 4 * Math.PI * .84;
        const x = cx + Math.cos(a) * ax, y = ay0 + Math.sin(a) * ay;
        const sg = i % 2 ? 1 : -1, comp = i === 2 ? 6.4 : 5;
        const tx = x + Math.cos(a) * comp * F * 1.2 + sg * 1.6 * F;
        const ty = y + Math.sin(a) * comp * F - 3 * F;
        p.traco(x, y, tx, ty, N.PRETO, 2.1 * u);
        p.traco(x, y, tx, ty, N.VIVO, 1.1 * u);
        p.ponto(tx, ty, (i === luz ? 2.2 : 1.4) * u, N.BRILHO);
      }
      // As gotas ESCORREM: a conta desce pelo fio e recomeça, cada uma no
      // seu tempo — três gotas caindo juntas viram um pente.
      [[-8.4, 5.6, 4.6], [1.2, 12.4, 4.2], [8.6, 3.4, 3.8]].forEach(([dx, dy, comp], j) => {
        const cai = (f + j / 3) % 1;
        const x = cx + dx * F, y0 = cy + dy * F;
        p.traco(x, y0, x, y0 + comp * F, N.MEIO, 1.6 * u);
        const by = y0 + (.8 + cai * comp) * F;
        p.ponto(x, by, (2.7 - cai * 1) * u, N.VIVO);
        p.ponto(x - .6 * F, by - .5 * F, 1.2 * u, N.BRILHO);
      });
      // A vela em cima: a vontade que não apaga — e a chama TREME, com a
      // brasa subindo. Quatro formas, nunca duas iguais seguidas.
      const vx = cx - .6 * F;
      p.rect(vx - 1.9 * F, 3.6 * F, 3.8 * F, 6.6 * F, N.FUNDO);
      p.traco(vx - 1.9 * F, 3.6 * F, vx - 1.9 * F, 10.2 * F, N.MEIO, 1.1 * u);
      p.traco(vx + 1.7 * F, 4.2 * F, vx + 1.7 * F, 10.2 * F, N.PRETO, 1.05 * u);
      p.traco(vx - 1.9 * F, 3.6 * F, vx + 1.9 * F, 3.6 * F, N.MEIO, 1.1 * u);
      p.traco(vx, 2.2 * F, vx, 3.8 * F, N.PRETO, 1.1 * u);
      const ct = [0, .45, -.3, .2][q % 4], cl = [0, -.25, .3, -.12][q % 4];
      p.poly([[vx + cl * F, (-.5 + ct) * F], [vx + (1.8 + cl * .4) * F, 1.7 * F],
              [vx, 3.4 * F], [vx - (1.8 - cl * .4) * F, 1.7 * F]], N.VIVO);
      p.poly([[vx + cl * F, (.9 + ct * .6) * F], [vx + .9 * F, 1.9 * F],
              [vx, 2.8 * F], [vx - .9 * F, 1.9 * F]], N.BRILHO);
      const brasa = (f * 2) % 1;
      if (brasa < .7) p.ponto(vx + (1.4 + brasa * 1.6) * F, (-1 - brasa * 3.4) * F,
                              (1.6 - brasa) * u, brasa < .35 ? N.VIVO : N.MEIO);
    },
    /* SUBSTÂNCIA · a coluna que virou planta: osso e mato na mesma coisa.
       Os brotos saem PRESOS na coluna — folha solta no breu vira sujeira. */
    sbt(p, F, f = 0) {
      const cx = 22 * F, u = F;
      /* A planta BALANÇA e a coluna tem SEIVA: um brilho desce de vértebra
         em vértebra, como impulso. A folha de cima e os brotos de baixo
         vão em contrafase — folhagem inteira indo para o mesmo lado ao
         mesmo tempo parece bandeira, não planta. */
      const balanco = Math.sin(f * TAU) * 1.5 * F, lx = cx + balanco;
      // 1. A folha do topo. Aqui vale a regra dura das cores escuras: sobre
      //    breu, um verde-fundo NÃO aparece — a folha tem de ser clara ou
      //    não existe. Por isso ela é meio e vivo, e o escuro só grava.
      p.poly([[lx, .6 * F], [lx + 10.2 * F, 5.4 * F], [lx + 6 * F, 13.6 * F],
              [lx - 5.8 * F, 13.6 * F], [lx - 10.2 * F, 5.4 * F]], N.VIVO);
      p.sombrear(N.VIVO, N.BRILHO, N.MEIO,
        {cx: lx - 4.6 * F, cy: 5 * F, ang: .72, onda: 1.8 * F, freq: .13 / F, largura: 7.4 * F, corte: -1.6 * F});
      for (let i = 0; i < 4; i++) {                       // as nervuras
        const y = (4.2 + i * 2.3) * F, comp = (7.4 - i * 1.1) * F;
        p.traco(lx, y, lx - comp, y + 3.2 * F, N.PRETO, 1.05 * u);
        p.traco(lx, y, lx + comp, y + 3.2 * F, N.PRETO, 1.05 * u);
      }
      p.traco(lx + .6 * F, 1.4 * F, lx + .6 * F, 13.6 * F, N.PRETO, 1.5 * u);
      p.traco(lx - .8 * F, 2 * F, lx - .8 * F, 13 * F, N.BRILHO, 1.05 * u);
      // 2. A coluna: nove vértebras com curva de verdade, e o disco entre elas.
      const vert = [];
      for (let i = 0; i < 9; i++) {
        const y = (16.4 + i * 2.9) * F, curva = Math.sin(i * .62) * 1.8 * F;
        vert.push([cx + curva - balanco * (1 - i / 9) * .5, y, (3.4 + (i % 2) * .9) * F]);
      }
      for (const [i, comp] of [[1, 10.4], [4, 8.6]]) {    // dois pares de folhas
        const [x, y] = vert[i];
        for (const sg of [-1, 1]) {
          const tx = x + sg * comp * F - balanco * .7, ty = y - 3.4 * F;
          p.traco(x + sg * 2.4 * F, y + .4 * F, tx, ty, N.PRETO, 2.8 * u);
          p.traco(x + sg * 2.4 * F, y + .4 * F, tx, ty, N.MEIO, 1.6 * u);
          p.elipse(tx + sg * 1.9 * F, ty - 1.3 * F, 4 * F, 2.5 * F, N.PRETO);
          p.elipse(tx + sg * 1.8 * F, ty - 1.4 * F, 3.3 * F, 1.9 * F, N.VIVO);
          p.traco(tx + sg * .2 * F, ty - .4 * F, tx + sg * 4.4 * F, ty - 2.2 * F, N.MEIO, 1.05 * u);
          p.ponto(tx + sg * 1.2 * F, ty - 2.5 * F, 1.4 * u, N.BRILHO);
        }
      }
      const seiva = Math.floor(((f * 2) % 1) * 11) - 1;   // o impulso descendo
      vert.forEach(([x, y, lg], i) => {                   // o osso, por cima
        p.elipse(x, y, lg, 1.7 * F, N.PRETO);
        p.elipse(x, y, lg - .6 * F, 1.2 * F, N.VIVO);
        p.traco(x - lg * .72, y + .45 * F, x + lg * .72, y + .45 * F, N.MEIO, 1.05 * u);
        if (i === seiva) {
          p.elipse(x, y, lg - .6 * F, 1.2 * F, N.BRILHO);
          p.anel(x, y, lg + .4 * F, 2.1 * F, N.VIVO, 1.05 * u);
        } else p.ponto(x - lg * .44, y - .9 * F, 1.5 * u, N.BRILHO);
      });
      // 3. A raiz: cinco braços de comprimentos diferentes, com nó na ponta.
      const bx = vert[8][0], by = vert[8][1] + 1.4 * F;
      for (const [dx, dy, esp] of [[-9.6, 3.4, 2.2], [-4.6, 5, 1.9], [.6, 5.8, 2.4], [4.4, 4.6, 1.9], [9, 3, 2.2]]) {
        const px1 = bx + dx * .5 * F, py1 = by + dy * .5 * F;
        const px2 = cx + dx * F + balanco * .3, py2 = by + dy * F;
        p.traco(bx, by, px1, py1, N.PRETO, (esp + .9) * u);
        p.traco(px1, py1, px2, py2, N.PRETO, (esp * .8 + .9) * u);
        p.traco(bx, by, px1, py1, N.MEIO, esp * u);
        p.traco(px1, py1, px2, py2, N.MEIO, esp * .8 * u);
        p.ponto(px2, py2, 2.2 * u, seiva >= 9 ? N.BRILHO : N.VIVO);
      }
      p.traco(bx - 1.1 * F, by - .4 * F, bx - 1.1 * F, by + 2.2 * F, N.VIVO, 1.05 * u);
    },
    /* MÁQUINA · o punho de metal que sobe: a carne que virou ferramenta.
       O que faz ler punho, e não bloco, são três coisas: os quatro nós no
       alto, o vão vazio entre os dedos e o polegar atravessado na frente. */
    mqn(p, F, f = 0) {
      const cx = 22 * F, u = F;
      /* O punho não se mexe — ele é a carta da força parada. O que se mexe
         é a LUZ: um reflexo atravessa o metal da esquerda para a direita,
         acendendo o nó, o rebite e a cinta por onde passa. Metal que não
         reflete nada é plástico. */
      const gx = cx + (-15 + f * 31) * F;
      const tranco = pico(f, .5, .07);                     // o aperto do punho
      const perto = (x, r = 3.8) => Math.abs(x - gx) < r * F || tranco > .5;
      const G = new Pintor(p.w, p.h, p.cores);
      // 1. A silhueta inteira: antebraço, bloco do punho e os quatro nós.
      G.poly([[cx - 6.4 * F, 29.4 * F], [cx + 6.4 * F, 29.4 * F],
              [cx + 8.6 * F, 47 * F], [cx - 8.6 * F, 47 * F]], N.VIVO);
      G.poly([[cx - 12.4 * F, 15 * F], [cx + 12.4 * F, 15 * F], [cx + 12.8 * F, 24 * F],
              [cx + 9.4 * F, 30.2 * F], [cx - 9.4 * F, 30.2 * F], [cx - 12.8 * F, 24 * F]], N.VIVO);
      G.elipse(cx, 15.4 * F, 12.4 * F, 4.2 * F, N.VIVO);
      for (let i = 0; i < 4; i++)
        G.elipse(cx + (-9 + i * 6) * F, 13.4 * F, 3.4 * F, 3.2 * F, N.VIVO);
      // 2. O volume, de uma luz só.
      G.sombrear(N.VIVO, N.BRILHO, N.MEIO,
        {cx: cx - 2.4 * F, cy: 22 * F, ang: .72, onda: 2.2 * F, freq: .11 / F, largura: 6.2 * F, corte: -1 * F});
      // 3. Os vãos entre os dedos, cavados depois do volume.
      for (let i = 0; i < 3; i++) {
        const x = cx + (-6 + i * 6) * F;
        G.cavar(x, 11 * F, x, 24.6 * F, 1.25 * u);
      }
      G.contraluz(N.BRILHO, -1, -1, Math.max(1, Math.round(u * .8)));
      p.colar(G, 0, 0);
      // 4. Os nós ganham topo de luz, e a dobra dos dedos atravessa por cima.
      for (let i = 0; i < 4; i++) {
        const x = cx + (-9 + i * 6) * F, aceso = perto(x, 4.4);
        p.anel(x, 13.6 * F, 3 * F, 2.8 * F, aceso ? N.BRILHO : N.VIVO,
               (aceso ? 1.6 : 1.2) * u, Math.PI * 1.08, Math.PI * 1.92);
        p.ponto(x - .9 * F, 11.6 * F, (aceso ? 2.4 : 1.7) * u, N.BRILHO);
      }
      // O reflexo em si, riscando o bloco — só enquanto está dentro dele.
      if (Math.abs(gx - cx) < 9.6 * F) {
        p.traco(gx - 1.6 * F, 16.4 * F, gx + 1.6 * F, 26.4 * F, N.BRILHO, 1.6 * u);
        p.traco(gx + 1.2 * F, 16.4 * F, gx + 4.4 * F, 26.4 * F, N.VIVO, 1.05 * u);
      }
      p.traco(cx - 11.6 * F, 21.6 * F, cx + 11.6 * F, 21.2 * F, N.PRETO, 1.15 * u);
      p.traco(cx - 11.2 * F, 22.6 * F, cx + 11.2 * F, 22.2 * F, N.VIVO, 1.05 * u);
      // 5. O polegar atravessado na frente.
      p.poly([[cx - 13 * F, 22.6 * F], [cx - 3.4 * F, 20.2 * F], [cx - 2 * F, 25.4 * F],
              [cx - 12 * F, 28.4 * F]], N.VIVO);
      p.poly([[cx - 12.6 * F, 24.6 * F], [cx - 3.2 * F, 22.2 * F], [cx - 2.4 * F, 25.2 * F],
              [cx - 12 * F, 28.2 * F]], N.MEIO);
      p.traco(cx - 13 * F, 22.6 * F, cx - 3.4 * F, 20.2 * F, N.BRILHO, 1.2 * u);
      p.traco(cx - 12.6 * F, 23.4 * F, cx - 11.8 * F, 28.2 * F, N.VIVO, 1.05 * u);
      p.traco(cx - 3.4 * F, 20.2 * F, cx - 2 * F, 25.4 * F, N.PRETO, 1.5 * u);
      p.traco(cx - 12 * F, 28.4 * F, cx - 2 * F, 25.4 * F, N.FUNDO, 1.3 * u);
      p.ponto(cx - 8.6 * F, 22.6 * F, 1.7 * u, N.VIVO);
      // 6. O pulso e uma cinta, com folga desigual e os rebites.
      for (const [y, alt, meia, reb] of [[30, 2.9, 9.4, 4], [38.6, 2.5, 7.9, 3]]) {
        p.rect(cx - meia * F, y * F, meia * 2 * F, alt * F, N.PRETO);
        p.rect(cx - (meia - .8) * F, (y + .55) * F, (meia - .8) * 2 * F, (alt - 1.1) * F, N.MEIO);
        p.traco(cx - (meia - .8) * F, (y + .55) * F, cx + (meia - .8) * F, (y + .55) * F, N.VIVO, 1.05 * u);
        p.traco(cx - (meia - .8) * F, (y + alt - .8) * F, cx + (meia - .8) * F, (y + alt - .8) * F, N.FUNDO, 1.05 * u);
        for (let i = 0; i < reb; i++) {
          const x = cx + (-(reb - 1) * 1.7 + i * 3.4) * F, aceso = perto(x, 3);
          p.ponto(x, (y + alt / 2) * F, (aceso ? 2.4 : 2) * u, aceso ? N.BRILHO : N.VIVO);
          p.ponto(x - .5 * F, (y + alt / 2 - .5) * F, 1.1 * u, N.BRILHO);
        }
      }
      // 7. Os rasgos do metal no antebraço: gravura, não faísca solta.
      for (const [y0, y1, dx] of [[33.6, 37.4, -3.6], [42.2, 45.6, 2.4]]) {
        p.traco(cx + dx * F, y0 * F, cx + (dx + .8) * F, y1 * F, N.PRETO, 1.5 * u);
        p.traco(cx + (dx - 1.1) * F, y0 * F, cx + (dx - .3) * F, y1 * F,
                perto(cx + dx * F, 3) ? N.BRILHO : N.VIVO, 1.05 * u);
      }
      // 8. As brasas do pulso SOBEM. É a única coisa que sai da silhueta, e
      //    é o que diz que a coisa está quente por dentro.
      for (let j = 0; j < 3; j++) {
        const sobe = (f * 1.5 + j / 3) % 1;
        const bx = cx + (j % 2 ? 11.4 : -11.8) * F + Math.sin(sobe * 5 + j) * 1.4 * F;
        const by = (32 - sobe * 20) * F;
        p.ponto(bx, by, (1.9 - sobe * 1) * u, sobe < .4 ? N.BRILHO : sobe < .75 ? N.VIVO : N.MEIO);
      }
    }
  };

  /* ------------------------------------------------------------- naipes */
  /* Sete por sete, forma cheia: em carta pequena o naipe se diferencia pela
     cor tanto quanto pela forma. */
  const NAIPES = {
    tmg(p, o) { p.poly([[3, 0], [6, 3], [3, 6], [0, 3]], o + 2); p.poly([[3, 1], [5, 3], [3, 5], [1, 3]], o + 3); p.px(3, 3, o + 4); },
    csm(p, o) { p.elipse(3, 3, 3.4, 3.4, o + 2); p.elipse(3, 3, 1.8, 1.8, o + 3); p.px(3, 3, o); p.px(2, 2, o + 4); },
    sns(p, o) { p.elipse(3, 3, 3, 3, o + 2); p.elipse(3, 3, 1.6, 1.6, o + 3); for (const [x, y] of [[3, 0], [3, 6], [0, 3], [6, 3]]) p.px(x, y, o + 3); },
    sbt(p, o) { p.poly([[3, 0], [6, 3], [5, 6], [1, 6], [0, 3]], o + 2); p.poly([[3, 1], [5, 3], [4, 5], [2, 5]], o + 3); p.vline(3, 2, 6, o + 1); },
    mqn(p, o) { p.rect(1, 1, 5, 5, o + 2); p.rect(2, 2, 3, 3, o + 3); p.px(3, 3, o); for (const [x, y] of [[0, 3], [6, 3], [3, 0], [3, 6]]) p.px(x, y, o + 2); }
  };
  const naipe = atr => pintar('fa2:naipe:' + atr, 7, 7, paletaDe(atr), p => (NAIPES[atr] || NAIPES.csm)(p, N.PRETO));

  /* -------------------------------------------------------------- carta */
  /* ============================================ O QUE É FINO DEMAIS PARA REDUZIR

     Desenhar três vezes maior e reduzir é o que dá curva boa e volume — e é
     péssimo para o que é MIÚDO. A redução escolhe a cor por voto, e o voto
     pesa a cor RARA e a cor CLARA. Numa carta em que o preto só aparece no
     olho, o preto é raro: ele ganha de tudo. O contorno do olho engordava
     por cima da íris, a pupila colava na pálpebra, e o que sobrava era um
     borrão preto tapando justamente o assunto da carta.

     Então o olho é desenhado AQUI, no tamanho final, pixel a pixel. É o
     mesmo motivo pelo qual as estrelas de COSMO têm corpo em vez de um
     pixel só: no tamanho em que a carta é vista, um pixel não é detalhe, é
     a forma inteira.

     O olho PISCA — a pálpebra fecha em dois quadros do ciclo, e é isso que
     faz a carta parecer que está olhando de volta. Três desenhos dão conta:
     aberto, meio e fechado. */
  const OLHO_TMG = {x: 16, y: 27, meioY: 28, fechadoY: 30};
  /* O contorno é um anel FECHADO, e não uma borda aqui e ali: a íris é da
     mesma cor da palma, então é só o contorno que diz onde o olho começa.
     Um anel aberto vira pixel solto, que é o que se via antes. A luz vem de
     cima e da esquerda, como no resto da mão — por isso essa metade do anel
     é brilho e a outra é preto. */
  /* Sete linhas, e não seis: com seis, a pupila cabia deitada — dois pixels
     de altura — e o olho ficava com cara de sonolento. Com sete ela é
     3-5-3 e volta a ser redonda, que é o que o desenho grande sempre teve. */
  const OLHO_ABERTO = [
    '...IIIIKKK...',
    '.IIVVVVVVVKK.',
    '.IVVIKKKVVVK.',
    'IVVVKKKKKVVVK',
    '.KVVVKKKVVVK.',
    '.KKVVVVVVVKK.',
    '...KKKKKKK...'
  ];
  const OLHO_MEIO = [
    '...IIIIKKK...',
    '.IVVIKKKVVVK.',
    '.KVVKKKKKVVK.',
    '...KKKKKKK...'
  ];
  const OLHO_FECHADO = [
    '.IIIIIIIIIII.',
    '.KKKKKKKKKKK.'
  ];
  const FINOS = {
    tmg(p, f = 0) {
      const ab = 1 - pico(f, .93, .08) * .94;
      /* O ciclo tem 16 quadros, e a piscada cai em dois deles: o penúltimo
         fecha a pálpebra até a metade (ab ≈ .79) e o último fecha de vez.
         O corte do "aberto" está em .85 por isso — em .72, o meio-fechado
         nunca aparecia e a piscada virava um pisca-pisca de um quadro só. */
      const arte = ab >= .85 ? OLHO_ABERTO : ab >= .3 ? OLHO_MEIO : OLHO_FECHADO;
      const y0 = ab >= .85 ? OLHO_TMG.y : ab >= .3 ? OLHO_TMG.meioY : OLHO_TMG.fechadoY;
      const tom = {K: N.PRETO, V: N.VIVO, I: N.BRILHO, M: N.MEIO};
      arte.forEach((linha, j) => {
        for (let i = 0; i < linha.length; i++) {
          const c = tom[linha[i]];
          if (c !== undefined) p.px(OLHO_TMG.x + i, y0 + j, c);
        }
      });
    }
  };

  const NOME_BAIXO = {tmg: 'O MILAGRE', csm: 'A MENTE', sns: 'A VONTADE', sbt: 'O CORPO', mqn: 'A FORÇA'};
  const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  /* Texto dentro do desenho, com a fonte 3×5 do jogo, plotado pixel a pixel. */
  function textoPx(p, str, x, y, cor, align = 'left') {
    const w = K.measure(semAcento(str), '3x5');
    const ox = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    K.glyphs(semAcento(str), ox, y, '3x5', (gx, gy) => p.px(gx, gy, cor));
    return w;
  }

  /* A figura de UM quadro do ciclo, guardada à parte. O caro aqui é o
     pipeline de 3× e redução, e ele roda uma vez por quadro por naipe:
     dezesseis quadros vezes cinco naipes são oitenta desenhos, que nascem
     espalhados ao longo do primeiro ciclo — um a cada ~80 ms — e nunca
     mais. Depois disso a carta animada custa um `drawImage` por quadro,
     igual à carta parada de antes. */
  const cacheF = new Map();
  /* O orçamento: UM quadro novo por quadro de tela. Sem isso, quando os
     cinco naipes pedem um quadro inédito no mesmo instante, a conta dos
     cinco cai junta e o quadro estoura os 16 ms. Com ele, a carta mostra o
     vizinho mais próximo que já existe e pega o quadro certo no seguinte —
     ninguém enxerga, e o primeiro ciclo nunca engasga. */
  let orcamento = 1;
  function novoQuadro() { orcamento = 1; }
  /* Quantos quadros de figura já nasceram, e o botão de esquecer todos:
     é por aqui que o teste confere que o orçamento está sendo respeitado. */
  function figurasProntas() { return cacheF.size; }
  function esquecerFiguras() { cacheF.clear(); cacheP.clear(); }
  function quadroDisponivel(atr, q) {
    if (cacheF.has(atr + ':' + q) || orcamento > 0) return q;
    for (let d = 1; d <= QUADROS; d++) {
      const antes = (q - d + QUADROS) % QUADROS, depois = (q + d) % QUADROS;
      if (cacheF.has(atr + ':' + antes)) return antes;
      if (cacheF.has(atr + ':' + depois)) return depois;
    }
    return q;
  }
  function figuraDe(atr, q = 0) {
    const chave = atr + ':' + q;
    let fig = cacheF.get(chave);
    if (!fig) {
      orcamento--;
      const f = (((q % QUADROS) + QUADROS) % QUADROS) / QUADROS;
      fig = emAlta(AW, AH, paletaDe(atr), 3, (g, F) => (FIGURAS[atr] || FIGURAS.csm)(g, F, f), .88,
        FINOS[atr] ? p => FINOS[atr](p, f) : null);
      cacheF.set(chave, fig);
    }
    return fig;
  }
  function carta(atr, sigla = '', quadro = 0) {
    const q = quadroDisponivel(atr, ((Math.round(quadro) % QUADROS) + QUADROS) % QUADROS);
    const {w, h, topo, faixa} = CARTA;
    return pintar(`fa3:carta:${atr}:${sigla}:${q}`, w, h, paletaDe(atr), p => {
      molduraCarta(p, atr.charCodeAt(0) + atr.length);
      // A janela da arte, no breu do naipe com um gradiente de baixo.
      p.rect(AX + 1, AY, AW - 2, AH, N.PRETO);
      p.dither(AX + 1, AY + AH - 16, AW - 2, 8, N.FUNDO, .25);
      p.dither(AX + 1, AY + AH - 8, AW - 2, 5, N.FUNDO, .5);
      p.rect(AX + 1, AY + AH - 3, AW - 2, 3, N.FUNDO);
      // Faixa de cima: o quadrinho do numeral, o nome do naipe, o do naipe.
      p.rect(6, 6, 8, 8, N.PRETO); p.moldura(6, 6, 8, 8, M.VIVA);
      p.px(6, 6, M.LUZ); p.px(13, 13, M.ESCURA);
      p.rect(w - 14, 6, 8, 8, N.PRETO); p.moldura(w - 14, 6, 8, 8, M.VIVA);
      p.px(w - 14, 6, M.LUZ); p.px(w - 7, 13, M.ESCURA);
      p.hline(16, w - 17, 6, M.ESCURA); p.hline(16, w - 17, 13, M.ESCURA);
      // A figura: desenhada três vezes maior e trazida de volta com o
      // filtro de maioria, que guarda o detalhe sem borrar nem inventar cor.
      p.colar(figuraDe(atr, q), AX, AY);
      // A faixa do nome embaixo, com as pontas chanfradas.
      const fy = h - faixa - 2;
      p.rect(5, fy, w - 10, 8, N.MEIO);
      p.hline(5, w - 6, fy, N.VIVO);
      p.hline(5, w - 6, fy + 7, N.PRETO);
      for (const [dx, sx] of [[5, 1], [w - 6, -1]]) {
        p.px(dx, fy, N.PRETO); p.px(dx, fy + 7, N.PRETO);
        p.px(dx + sx, fy, N.MEIO);
      }
      p.limpar();
    });
  }
  /* O verso: o olho no meio do ornamento, como no baralho de verdade. */
  function cartaVirada() {
    const {w, h} = CARTA;
    return pintar('fa2:carta:verso', w, h, paletaDe('tmg'), p => {
      molduraCarta(p, 7);
      p.rect(AX + 1, AY - 8, AW - 2, AH + 16, M.PRETO);
      // A trama: dois X cruzados e o losango repetido, espelhados no eixo.
      for (let y = AY - 8; y < AY + AH + 8; y++) {
        for (let x = AX + 1; x < AX + AW - 1; x++) {
          const u = x - AX, v = y - (AY - 8);
          if ((u + v) % 8 === 0 || (u - v + 64) % 8 === 0) p.px(x, y, M.ESCURA);
          if ((u + v) % 16 === 0 && (u - v + 64) % 16 === 0) p.px(x, y, M.MEDIA);
        }
      }
      const cy = AY + AH / 2 - 1;
      // A amêndoa do olho, chapada, com a íris e o brilho de um pixel.
      p.poly([[cxA - 18, cy], [cxA - 8, cy - 9], [cxA + 8, cy - 9], [cxA + 18, cy],
              [cxA + 8, cy + 9], [cxA - 8, cy + 9]], M.PRETO);
      p.poly([[cxA - 16, cy], [cxA - 7, cy - 7], [cxA + 7, cy - 7], [cxA + 16, cy],
              [cxA + 7, cy + 7], [cxA - 7, cy + 7]], M.VIVA);
      p.poly([[cxA - 13, cy], [cxA - 6, cy - 5], [cxA + 6, cy - 5], [cxA + 13, cy],
              [cxA + 6, cy + 5], [cxA - 6, cy + 5]], M.ESCURA);
      p.elipse(cxA, cy, 5, 5, M.LUZ);
      p.elipse(cxA, cy, 3.2, 3.2, M.PRETO);
      p.px(cxA - 2, cy - 2, M.LUZ);
      p.linha(cxA - 18, cy, cxA - 8, cy - 9, M.LUZ);
      p.linha(cxA - 8, cy - 9, cxA + 8, cy - 9, M.LUZ);
      p.limpar();
    });
  }

  /* -------------------------------------------------------------- ícones */
  /* VITALIDADE · a caixa torácica. Coração lê como plataforma; costela lê
     como corpo que pode quebrar. Cinco estágios de estrago. */
  function iconeVida(ferido = 0) {
    const f = Math.max(0, Math.min(4, Math.round(ferido)));
    /* Este vai desenhado no tamanho final, e não em alta: num ícone de 24×24
       as costelas ficam a três pixels uma da outra, e arco reduzido nessa
       distância vira mingau. Aqui o traço de um pixel é o traço certo. */
    return pintar('fa3:vida:' + f, 24, 24, paletaDe('sns'), p => {
      p.rect(9, 2, 6, 3, N.VIVO); p.hline(9, 14, 2, N.BRILHO);  // clavícula
      p.px(9, 4, N.MEIO); p.px(14, 4, N.MEIO);
      p.rect(10, 5, 4, 16, N.VIVO);                             // esterno
      p.vline(10, 5, 20, N.BRILHO); p.vline(13, 6, 20, N.MEIO);
      for (let i = 0; i < 5; i++) {
        const y = 6 + i * 3, larg = 8 - Math.abs(i - 1);
        const quebrada = f > 0 && i >= 5 - f;
        for (const s of [-1, 1]) {
          const x1 = 12 + s * 2, x2 = 12 + s * larg;
          p.linha(x1, y, x2, y + 2, quebrada ? N.FUNDO : N.VIVO);
          p.linha(x1, y + 1, x2, y + 3, quebrada ? N.PRETO : N.MEIO);
          if (!quebrada) {
            p.linha(x1, y, Math.round((x1 + x2) / 2), y + 1, N.BRILHO);
            p.px(x2, y + 2, N.BRILHO);
          }
          if (quebrada && s > 0) {
            p.apagar(12 + Math.round(larg / 2) + 1, y + 1);
            p.apagar(12 + Math.round(larg / 2) + 2, y + 2);
          }
        }
      }
      // O que bate dentro: acende enquanto há corpo e apaga quando acaba.
      p.elipse(12, 12, 3, 3.4, N.PRETO);
      p.elipse(12, 12, 2.2, 2.6, f > 2 ? N.MEIO : f > 1 ? N.VIVO : N.BRILHO);
      if (f <= 1) { p.px(11, 11, N.BRILHO); p.px(12, 11, N.BRILHO); }
      p.limpar();
    });
  }
  /* SANIDADE · a vela. A chama encolhe em quatro estágios, e no último
     sobra a fumaça. Dois quadros de tremor por estágio. */
  function iconeVela(estagio = 0, fase = 0) {
    const e = Math.max(0, Math.min(3, estagio)), f = fase ? 1 : 0;
    // Cinco de osso (0-4) e quatro de chama (5-8): a cera não é dourada.
    const cores = [...NAIPE.osso, ...CHAMA];
    const O = {PRETO: 0, FUNDO: 1, MEIO: 2, VIVO: 3, BRILHO: 4};
    const F = {BRASA: 5, FUNDO: 6, VIVO: 7, BRILHO: 8};
    return pintar(`fa3:vela:${e}:${f}`, 24, 24, cores, p => {
      // O corpo de cera: cilindro de três tons, luz vindo de cima à esquerda.
      p.rect(8, 12, 8, 11, O.MEIO);
      p.vline(8, 12, 22, O.VIVO); p.vline(9, 13, 22, O.VIVO);
      p.vline(14, 13, 22, O.FUNDO); p.vline(15, 12, 22, O.FUNDO);
      p.hline(8, 15, 12, O.VIVO);                    // o topo, o mais claro
      p.hline(8, 15, 11, O.MEIO);
      p.px(8, 15, O.BRILHO); p.px(9, 14, O.BRILHO);  // especular de 1 px
      // Cera escorrida: gotas de comprimentos diferentes, nunca simétricas.
      for (const [x, y, n] of [[10, 14, 4], [13, 16, 3], [8, 18, 2]]) {
        for (let i = 0; i < n; i++) p.px(x, y + i, O.FUNDO);
        p.px(x, y + n, O.MEIO);
      }
      p.hline(7, 16, 23, O.FUNDO);                   // a sombra no castiçal
      p.vline(12, 9, 11, O.PRETO);                   // o pavio
      if (e >= 3) {                                   // apagada: só a fumaça
        p.px(12, 10, F.BRASA);
        for (let i = 0; i < 9; i++) {
          const x = 12 + Math.round(Math.sin(i * .75 + f * .9) * 2.6);
          p.px(x, 9 - i, i < 2 ? F.FUNDO : O.FUNDO);
          if (i % 3 === 1) p.px(x + 1, 9 - i, O.PRETO);
        }
        p.limpar(); return;
      }
      const alt = [9, 6, 4][e], lg = [3, 2.2, 1.4][e], osc = f ? 1 : 0;
      // A chama: gota com o bico soprado, três tons e o miolo claro.
      p.poly([[12 + osc, 11 - alt], [12 + lg, 11 - alt * .45], [12, 12], [12 - lg, 11 - alt * .45]], F.FUNDO);
      p.poly([[12 + osc, 12 - alt], [12 + lg * .6, 11 - alt * .45], [12, 11], [12 - lg * .6, 11 - alt * .45]], F.VIVO);
      p.px(12, 11 - Math.round(alt * .35), F.BRILHO);
      if (e === 0) { p.px(12 + osc, 10 - alt, F.VIVO); p.px(12 + osc, 9 - alt, F.FUNDO); }
      p.px(12, 11, F.BRASA);
      // A luz da chama caindo na cera.
      p.px(11, 12, F.FUNDO); p.px(12, 12, F.VIVO); p.px(13, 12, F.FUNDO);
      p.limpar();
    });
  }
  /* CORRUPÇÃO · a espiral que se come. Os buracos crescem com o nível: o
     ícone literalmente se desintegra. */
  function iconeCorrupcao(nivel = 0) {
    const n = Math.max(0, Math.min(4, nivel));
    return pintar('fa2:corr:' + n, 24, 24, paletaDe('tmg'), p => {
      for (let i = 0; i < 150; i++) {
        const t = i / 150, a = t * Math.PI * 6.2, r = 1.2 + t * 9.6;
        const x = Math.round(12 + Math.cos(a) * r), y = Math.round(12 + Math.sin(a) * r);
        if (n && rnd(x, y, 21) < n * .16) continue;
        p.px(x, y, t > .74 ? N.FUNDO : t > .4 ? N.MEIO : N.VIVO);
      }
      p.px(12, 12, N.BRILHO);
      p.px(11, 11, N.VIVO);
      if (n >= 3) for (let i = 0; i < 12; i++)
        p.px(2 + Math.floor(rnd(i, 5, 22) * 20), 2 + Math.floor(rnd(i, 9, 23) * 20), N.FUNDO);
      p.limpar();
    });
  }
  /* A lua mordida da marca, para o cabeçalho. */
  function luaMordida(vermelha = false) {
    return pintar('fa2:lua:' + (vermelha ? 1 : 0), 14, 14, paletaDe(vermelha ? 'sns' : 'csm'), p => {
      p.elipse(7, 7, 6, 6, N.MEIO);
      p.elipse(6, 6, 5, 5, N.VIVO);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (Math.hypot(x - 10.5, y - 4.5) < 5.8) p.apagar(x, y);
      p.px(4, 9, N.BRILHO); p.px(5, 4, N.BRILHO);
      p.limpar();
    });
  }

  /* --------------------------------------------------------------- d20 */
  /* O icosaedro de frente lê como hexágono. A silhueta fica parada e só a
     distribuição de claro e escuro nas sete faces muda — cinco poses bastam
     para o olho ler rotação. Cada face é uma cor chapada. */
  const POSES = [
    [3, 2, 1, 4], [2, 3, 1, 4], [1, 3, 2, 4], [2, 1, 3, 4], [3, 1, 2, 4]
  ];
  function dadoFace(pose, atr = 'csm') {
    const t = POSES[pose % POSES.length];
    return pintar(`fa3:d20:${pose}:${atr}`, 28, 28, paletaDe(atr), p => {
      p.colar(emAlta(28, 28, paletaDe(atr), 3, (g, F) => {
        const c = 14 * F, r = 13.6 * F, u = F;
        const V = [0, 1, 2, 3, 4, 5].map(i => {
          const a = (i * 60 - 90) * Math.PI / 180;
          return [c + Math.cos(a) * r, c + Math.sin(a) * r];
        });
        // O triângulo do meio, de ponta para baixo: é onde mora o número.
        const T = [[c - 7.6 * F, c - 4.6 * F], [c + 7.6 * F, c - 4.6 * F], [c, c + 8.4 * F]];
        g.poly([V[5], V[0], V[1], T[1], T[0]], N.PRETO + t[0]);
        g.poly([V[1], V[2], V[3], T[2], T[1]], N.PRETO + t[1]);
        g.poly([V[3], V[4], V[5], T[0], T[2]], N.PRETO + t[2]);
        g.poly(T, N.PRETO + t[3]);
        // As arestas de dentro, escuras; a do lado da luz ganha um fio claro.
        const canto = [5, 1, 3];
        for (let i = 0; i < 3; i++) {
          g.traco(T[i][0], T[i][1], T[(i + 1) % 3][0], T[(i + 1) % 3][1], N.PRETO, 1.2 * u);
          g.traco(T[i][0], T[i][1], V[canto[i]][0], V[canto[i]][1], N.PRETO, 1.2 * u);
        }
        g.traco(T[0][0], T[0][1], T[1][0], T[1][1], N.BRILHO, .9 * u);
        // A silhueta se sustenta por luz: o contorno é claro, nunca preto.
        for (let i = 0; i < 6; i++) {
          const claro = i === 5 || i === 0;
          g.traco(V[i][0], V[i][1], V[(i + 1) % 6][0], V[(i + 1) % 6][1],
                  claro ? N.BRILHO : N.VIVO, 1.3 * u);
        }
        for (const [vx, vy] of V) g.ponto(vx, vy, 1.8 * u, N.BRILHO);
        g.ponto(c - 5.6 * F, c - 8.4 * F, 2.4 * u, N.BRILHO);   // o especular
      }, .97), 0, 0);
      p.limpar();
    });
  }
  /* A sombra é o que diz a altura: encolhe, afina e some quando o dado sobe.
     Sem ela o dado não cai, só troca de lugar na tela. */
  function sombraDado(altura) {
    const k = Math.max(0, Math.min(3, Math.round(altura * 3)));
    return pintar('fa3:d20s:' + k, 32, 10, paletaDe('csm'), p => {
      const rx = 13 - k * 3, ry = 4 - k * .9;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 32; x++) {
        const d = ((x - 16) / rx) ** 2 + ((y - 5) / ry) ** 2;
        if (d <= .5) p.px(x, y, N.PRETO);
        else if (d <= .84) { if ((x + y) % 2 === 0) p.px(x, y, N.PRETO); }
        else if (d <= 1.15) { if (x % 2 === 0 && y % 2 === 0) p.px(x, y, N.PRETO); }
      }
    });
  }

  /* ------------------------------------------------------------- glitch */
  /* A corrupção pilota o renderizador — e acima de certo ponto o
     renderizador mente. Tudo aqui é desenhado por cima do quadro pronto. */
  function glitch(ctx, w, h, nivel, t) {
    if (nivel <= 0) return;
    const n = Math.min(1, nivel);
    ctx.save();
    // Grão de filme, ressemeado a cada dois quadros.
    if (n > .18) {
      const semente = Math.floor(t * 30);
      ctx.globalAlpha = .04 + n * .07;
      ctx.fillStyle = '#d8c7b0';
      for (let i = 0; i < Math.floor(90 * n); i++) {
        const x = Math.floor(rnd(i, semente, 31) * w / 2) * 2;
        const y = Math.floor(rnd(i, semente, 32) * h / 2) * 2;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // Scanlines.
    if (n > .38) {
      ctx.globalAlpha = (n - .38) * .18;
      ctx.fillStyle = '#05030a';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  /* As fatias deslocadas: o quadro se parte por um instante. Precisa do
     canvas de origem, então recebe a própria tela. */
  function fatias(ctx, canvas, w, h, nivel, t) {
    const n = Math.min(1, nivel);
    if (n < .5) return;
    const janela = Math.floor(t / (2.4 - n)), disparo = rnd(janela, 1, 41) < n * .8;
    if (!disparo) return;
    const fase = t - janela * (2.4 - n);
    if (fase > .12) return;
    const quantas = 1 + Math.floor(n * 3);
    for (let i = 0; i < quantas; i++) {
      const y = Math.floor(rnd(janela, i, 42) * (h / 2 - 8)) * 2;
      const alt = 6 + Math.floor(rnd(janela, i, 43) * 10) * 2;
      const dx = (Math.round(rnd(janela, i, 44) * 6) - 3) * 2 * (1 + n);
      try { ctx.drawImage(canvas, 0, y, w, alt, Math.round(dx), y, w, alt); } catch (e) { /* tela sem contexto */ }
    }
  }
  /* A mentira: acima de 0,8 de corrupção o número mostrado não é o número.
     Devolve o texto que deve ser desenhado no lugar do verdadeiro. */
  function mente(texto, nivel, t, semente = 0) {
    const n = Math.min(1, nivel);
    if (n < .8) return texto;
    const janela = Math.floor(t * 4);
    if (rnd(janela, semente, 51) > .06) return texto;
    return [...String(texto)].map((ch, i) =>
      rnd(janela, i + semente, 52) > .5 ? ch : '¤§#%&?!'[Math.floor(rnd(janela, i + semente, 53) * 7)]).join('');
  }
  /* Tremor por trauma: eventos somam, o tremor cai sozinho. shake = trauma². */
  class Tremor {
    constructor() { this.trauma = 0; }
    bater(n) { this.trauma = Math.min(1, this.trauma + n); }
    passo(dt) { this.trauma = Math.max(0, this.trauma - dt * 1.2); return this.trauma; }
    aplicar(ctx, t) {
      const s = this.trauma * this.trauma;
      if (s <= 0.001) return false;
      const dx = Math.round((rnd(Math.floor(t * 22), 1, 61) * 2 - 1) * s * 3) * 2;
      const dy = Math.round((rnd(Math.floor(t * 22), 2, 62) * 2 - 1) * s * 3) * 2;
      ctx.save(); ctx.translate(dx, dy);
      return true;
    }
  }

  const api = {CARTA, carta, cartaVirada, naipe, NOME_BAIXO, emAlta, figuraDe, novoQuadro,
    figurasProntas, esquecerFiguras, QUADROS, FIGURAS, FINOS, NAIPES, Pintor, pintar, paletaDe, MOLDURA, NAIPE, M, N, textoPx,
    iconeVida, iconeVela, iconeCorrupcao, luaMordida,
    dadoFace, sombraDado, POSES, glitch, fatias, mente, Tremor};
  root.FichaArte = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
