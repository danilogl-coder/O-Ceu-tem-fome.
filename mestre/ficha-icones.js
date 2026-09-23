/* Pixel art original, desenhada por código em uma grade inteira de 64 × 64.
   O rasterizador emite somente retângulos SVG: sem fontes, filtros, Canvas
   ou imagens externas. Cada linha de pixels iguais vira um único retângulo. */
(function (root) {
  'use strict';
  const cores = {
    csm: ['#091326', '#183764', '#315fa8', '#629bf0', '#c5dcff'],
    sns: ['#260911', '#671426', '#b82b45', '#f15b77', '#ffc8cc'],
    sbt: ['#081c13', '#164c2a', '#288e48', '#65e88b', '#d1ffd4'],
    mqn: ['#251c09', '#665019', '#a88629', '#e4be55', '#fff0b0'],
    dolora: ['#171223', '#423451', '#7b639a', '#b4a1d2', '#ede0ff'],
    amazona: ['#271021', '#662f50', '#aa507e', '#ed8bb9', '#ffdbed']
  };
  const cache = new Map();
  function raster(size, height = size) {
    const pixels = new Array(size * height).fill(null);
    const dot = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < size && y < height) pixels[y * size + x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(i, j, c); };
    const line = (x, y, X, Y, c, w = 1) => {
      const n = Math.max(1, Math.abs(X - x), Math.abs(Y - y));
      for (let i = 0; i <= n; i++) rect(Math.round(x + (X - x) * i / n), Math.round(y + (Y - y) * i / n), w, w, c);
    };
    const ellipse = (x, y, rx, ry, c) => {
      for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if (i * i / (rx * rx) + j * j / (ry * ry) <= 1) dot(x + i, y + j, c);
    };
    const poly = (pts, c) => {
      for (let y = 0; y < height; y++) {
        const xs = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[j];
          if ((ay > y) !== (by > y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) dot(x, y, c);
      }
    };
    function rects(dx = 0, dy = 0) {
      let out = '';
      for (let y = 0; y < height; y++) for (let x = 0; x < size;) {
        const c = pixels[y * size + x], start = x++;
        while (x < size && pixels[y * size + x] === c) x++;
        if (c) out += `<rect x="${start + dx}" y="${y + dy}" width="${x - start}" height="1" fill="${c}"/>`;
      }
      return out;
    }
    function svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" shape-rendering="crispEdges">${rects()}</svg>`;
    }
    const ler = (x, y) => (x >= 0 && y >= 0 && x < size && y < height) ? pixels[y * size + x] : null;
    return {dot, rect, line, ellipse, poly, rects, svg, ler, larg: size, alt: height};
  }
  const ART=root.FichaPericiasArte||(typeof require!=='undefined'?require('./ficha-pericias-arte.js'):null);
  function desenho(n) {
    const g=raster(64);
    ART.desenhar(g,n.pericia||String(n.id).split(':')[1]);
    return g.svg();
  }
  function frame() {
    const {rect:r,line:l,svg} = raster(96);
    const layers = [[4,88,'#070912'],[6,84,'#504154'],[8,80,'#b29a6a'],[10,76,'#3e3542'],[12,72,'#74614c'],[14,68,'#080c18']];
    for(const [x,w,c] of layers)r(x,x,w,w,c);
    l(9,9,85,9,'#ebd6a1');l(9,9,9,85,'#ebd6a1');l(10,86,86,86,'#271d2b',2);
    for(const [x,y,sx,sy] of [[4,4,1,1],[91,4,-1,1],[4,91,1,-1],[91,91,-1,-1]]){
      for(let a=0;a<15;a++){r(x+sx*a,y,2,2,'#ceb281');r(x,y+sy*a,2,2,'#ceb281');}
      r(x+sx*3,y+sy*3,5,5,'#e8d2a0');r(x+sx*4,y+sy*4,3,3,'#66546a');
      r(x+sx*10,y+sy*3,3,3,'#9a7d55');r(x+sx*3,y+sy*10,3,3,'#9a7d55');
    }
    for(const x of [31,63]){r(x,5,2,5,'#ead09b');r(x,86,2,5,'#9d7b55');}
    r(43,0,10,5,'#3f3549');r(46,0,4,4,'#ecd3a4');r(44,3,8,3,'#b49a6d');
    return svg();
  }
  const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  function radialFrame(reg,tipo){
    const key=`ring:${reg}:${tipo}`;if(cache.has(key))return cache.get(key);
    const g=raster(96),C=cores[reg]||cores.csm;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const d=Math.hypot(x-47.5,y-47.5),angle=Math.atan2(y-48,x-48);
      if(d<46&&d>42)g.dot(x,y,Math.floor((angle+Math.PI)*32)%2?C[2]:C[3]);
      else if(d<=42&&d>39)g.dot(x,y,'#040309');
      else if(d<=39&&d>37)g.dot(x,y,C[1]);
      else if(d<=37)g.dot(x,y,'#08060f');
    }
    if(['coroa','chave','milagre','vereda','marco'].includes(tipo)){
      for(const [x,y] of [[47,2],[91,47],[47,91],[2,47]]){
        g.poly([[x,y-4],[x+4,y],[x,y+4],[x-4,y]],C[2]);g.dot(x,y,C[4]);
      }
    }
    const result=uri(g.svg());cache.set(key,result);return result;
  }
  function orbita(L){
    const key='orbit:'+L.larg+':'+L.alto+':'+L.setores.map(s=>s.id+':'+s.a0+':'+s.a1).join('|');
    if(cache.has(key))return cache.get(key);
    const scale=4,w=Math.round(L.larg/scale),h=Math.round(L.alto/scale);
    const g=raster(w,h),{dot,line}=g;
    for(const s of L.setores){
      const C=cores[s.id];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const dx=(x*scale-L.centro.x)/L.rx,dy=(y*scale-L.centro.y)/L.ry,r=Math.hypot(dx,dy);
        let a=Math.atan2(dy,dx);while(a<s.a0)a+=Math.PI*2;
        if(a>s.a1)continue;
        if(r>=1.135&&r<1.174)dot(x,y,C[2]);
        else if(r>=1.174&&r<1.186)dot(x,y,C[3]);
        else if(r>=1.118&&r<1.128&&((x+y)%3===0))dot(x,y,C[1]);
        else if(r<1.09&&r>.3&&(x*29+y*13)%337===0)dot(x,y,C[1]);
      }
      for(const ang of [s.a0,s.a1]){
        const a=L.ponto(ang,.32),b=L.ponto(ang,1.1);line(Math.round(a.x/scale),Math.round(a.y/scale),Math.round(b.x/scale),Math.round(b.y/scale),'#221626');
      }
    }
    const result=uri(g.svg());cache.set(key,result);return result;
  }
  /* ------------------------------------------------------------- O OLHO
     O miolo da carta, e o único desenho vivo dela: a íris ANDA atrás do
     ponteiro. Por isso ele não é uma figura só — são três camadas, e a do
     meio é solta:

       FUNDO   a esclera, já recortada pela amêndoa;
       ÍRIS    uma peça inteira que o JS desloca dentro do recorte;
       FRENTE  pálpebras, cílios e cantos, POR CIMA da íris — sem isso,
               ao olhar para o canto a íris sobe por cima da pálpebra e o
               olho vira adesivo.

     O recorte e a esclera saem da MESMA lista de colunas, uma por pixel
     de x: assim não existe a chance de o recorte discordar do desenho, e
     as bordas saem em pixel inteiro (recorte por polígono sairia
     serrilhado, que é o oposto de pixel art).

     Regras de ofício que este desenho segue, e que a versão anterior
     quebrava em quase todas:
     · A ÍRIS É MAIOR QUE A ABERTURA. Íris inteira dentro da pálpebra lê
       como ovo em cima de um losango. Olho é íris CORTADA em cima e
       embaixo — e é esse corte que faz o olhar ter direção.
     · LUZ DE UM LADO SÓ, nunca do meio para fora. Gradiente radial
       centrado ("pillow shading") achata a forma; aqui a luz vem de cima
       à esquerda, a pálpebra joga sombra no alto do globo, e o brilho da
       esclera fica embaixo à esquerda.
     · A ÍRIS ACENDE DO LADO OPOSTO À LUZ. Ela é uma tigela: a luz entra
       e se acumula na parede de lá. É o truque que separa íris de bolinha.
     · MATIZ QUE ANDA, e não preto e branco misturados no tom. A sombra
       puxa para o azul e a luz para o magenta — a escada inteira é a
       mesma cor mudando de temperatura.
     · CONTORNO ESCOLHIDO: grosso e escuro em cima, onde a pálpebra pesa;
       embaixo, um fio claro, que é a linha molhada pegando a luz.
     · DITHER SÓ ONDE HÁ TEXTURA. Na fibra da íris e na borda da sombra
       da pálpebra, sim. Na esclera, nunca: dither em superfície lisa lê
       como sujeira. */
  const OLHO = {
    w: 128, h: 64, cx: 64, cy: 34, x0: 4, x1: 124,
    supAlt: 25, supPico: .43, supDureza: .66,   // a pálpebra de cima, com o pico à esquerda
    infAlt: 18, infPico: .57, infDureza: .74,   // a de baixo, mais rasa e com o fundo à direita
    iris: 22, caixaIris: 45,
    passeioX: 15, passeioY: 5                   // até onde a íris anda
  };
  /* A escada de cor. Um tom por degrau, do frio ao quente. */
  const TOM = {
    breu:   '#080512', beira: '#0c0619', traco: '#180d2c', fio: '#2a1848', lacrimal: '#54324b',
    sombra: '#33204f',
    escC:   '#4a3c64', escB: '#6d5d89', escA: '#9a8cb2', escLuz: '#c7bcda', molhado: '#eee6f8',
    limbo:  '#1b0a33', irisE: '#3d1478', irisD: '#5f22a6', irisC: '#8b3ccd',
    irisB:  '#b268e2', irisA: '#dda4f2',
    pupila: '#050209', brilho: '#fffaff', brilho2: '#e6d4ff'
  };
  /* A MATRIZ ORDENADA de 4 × 4. Ela não serve para chapar a figura toda
     de xadrez: serve para amolecer SÓ a fronteira entre dois tons. Faixa
     de cor com borda dura em superfície lisa vira listra ("banding"), e
     xadrez em superfície lisa vira sujeira — a saída é um corredor
     estreito de mistura, de dois ou três pixels, e o resto chapado. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const ordem = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
  /* Escolhe o degrau de uma escada a partir de um valor contínuo, com a
     fronteira dissolvida. */
  function degrau(escada, v, x, y, janela = .34) {
    const f = Math.max(0, Math.min(1, v)) * (escada.length - 1);
    let i = Math.floor(f); const r = f - i;
    if (i >= escada.length - 1) return escada[escada.length - 1];
    const meio = (r - (.5 - janela / 2)) / janela;
    if (meio > 0 && ordem(x, y) < Math.min(1, meio)) i++;
    return escada[Math.min(escada.length - 1, i)];
  }
  /* A curva de uma pálpebra: zero nas pontas, cheia no pico, e com o pico
     FORA do meio. É a assimetria que separa um olho de uma folha. */
  function curvaPalpebra(x, alt, pico, dureza) {
    const u = (x - OLHO.x0) / (OLHO.x1 - OLHO.x0);
    if (u <= 0 || u >= 1) return 0;
    const v = u <= pico ? .5 * u / pico : .5 + .5 * (u - pico) / (1 - pico);
    return alt * Math.pow(Math.sin(Math.PI * v), dureza);
  }
  const tetoOlho = x => OLHO.cy - curvaPalpebra(x + .5, OLHO.supAlt, OLHO.supPico, OLHO.supDureza);
  const chaoOlho = x => OLHO.cy + curvaPalpebra(x + .5, OLHO.infAlt, OLHO.infPico, OLHO.infDureza);
  function colunasOlho() {
    const cols = [];
    for (let x = OLHO.x0; x <= OLHO.x1; x++) {
      const t = Math.round(tetoOlho(x)), b = Math.round(chaoOlho(x));
      if (b - t >= 1) cols.push([x, t, b]);
    }
    return cols;
  }
  /* A ESCLERA. Quatro tons, e as faixas seguem a curva da pálpebra em vez
     de serem linhas retas — faixa reta em cima de forma curva é a receita
     do "banding", que é o que faz um degradê virar listra. */
  function olhoFundo(cols) {
    const g = raster(OLHO.w, OLHO.h);
    const escada = [TOM.sombra, TOM.escC, TOM.escB, TOM.escA, TOM.escLuz];
    for (const [x, t, b] of cols) {
      const h = Math.max(1, b - t), nx = (x - OLHO.cx) / 60;
      for (let y = t; y <= b; y++) {
        const prof = (y - t) / h;
        /* UM campo de luz, e não uma pilha de faixas. A pálpebra joga
           sombra no alto e ela cai rápido; a luz entra pela esquerda; o
           globo devolve luz embaixo; e os dois cantos afundam, porque
           canto de olho é buraco. */
        let L = .47;
        L -= .78 * Math.max(0, 1 - prof / .34);          // a sombra da pálpebra, e ela cai rápido
        L -= .19 * nx;                                   // a luz entra pela esquerda
        L += .19 * Math.max(0, Math.min(1, (prof - .52) / .40));  // o globo devolve luz embaixo
        L -= .90 * Math.max(0, (Math.abs(nx) - .50) / .50);       // os cantos afundam
        /* O tom mais claro é RESERVADO a um naco só, embaixo à esquerda,
           que é onde a luz de fato bate — e ele tem borda MOLE, porque o
           que tem borda dura na esclera não é luz, é mancha. A primeira
           versão acendia a esclera inteira e o olho lia como um losango
           escuro em volta de uma bolha branca. */
        const bx = (nx + .21) / .32, by = (prof - .80) / .28;
        L += .34 * Math.max(0, 1 - (bx * bx + by * by));
        g.dot(x, y, degrau(escada, L, x, y, .50));
      }
    }
    return g;
  }
  /* A ÍRIS. Peça inteira, desenhada numa caixa própria para poder andar. */
  function olhoIris() {
    const R = OLHO.iris, S = OLHO.caixaIris, m = (S - 1) / 2;
    const g = raster(S, S);
    const escada = [TOM.irisE, TOM.irisD, TOM.irisC, TOM.irisB, TOM.irisA];
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j) / R;
      if (d > 1) continue;
      const a = Math.atan2(j, i);
      if (d > .90) { g.dot(m + i, m + j, TOM.limbo); continue; }   // o anel escuro do rebordo
      if (d > .855) { g.dot(m + i, m + j, ((i + j) & 1) ? TOM.limbo : TOM.irisE); continue; }
      /* O degrau base vem do RAIO: íris de verdade é escura no rebordo e
         clara perto da pupila. E a fibra é um leque de raios de
         comprimento desigual — desigual de propósito, porque leque
         regular vira roda dentada. */
      const setor = Math.floor((a + Math.PI) / (Math.PI * 2) * 44);
      const semente = (setor * 2654435761) >>> 0;
      const alcance = .46 + ((semente >>> 7) % 40) / 100;          // até onde esta fibra vai
      const forca = (semente >>> 13) % 3;
      let n = d > .62 ? 1 : d > .40 ? 2 : 3;
      if (d < alcance + .30 && d > .26) n += forca === 0 ? 1 : forca === 1 ? 0 : -1;
      /* A TIGELA: a luz entra por cima à esquerda e se junta na parede de
         baixo à direita. Sem isto a íris é um disco chapado. */
      const tigela = (i * .62 + j * .52) / R;
      /* O degrau da tigela é MOLE. Duro, ele partia a íris em duas
         metades com uma linha no meio — e íris não tem costura. */
      const tacha = Math.max(-2, Math.min(1, tigela * 2.1 - .28));
      const inteiro = Math.floor(tacha), resto = tacha - inteiro;
      n += inteiro + (ordem(m + i, m + j) < resto ? 1 : 0);
      g.dot(m + i, m + j, escada[Math.max(0, Math.min(4, n))]);
    }
    /* O COLARINHO: o anel franzido em volta da pupila. É a marca que
       mais rápido diz "isto é uma íris e não uma bolinha", e cabe em
       dois pixels de espessura. */
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i / 1.06, j / 1.42);
      if (d < 14 || d > 16.6) continue;
      const a = Math.atan2(j, i), franja = Math.sin(a * 13) * .9;
      if (d > 15.2 + franja) continue;
      const tigela = (i * .62 + j * .52) / R;
      g.dot(m + i, m + j, tigela > .18 ? TOM.irisA : TOM.irisD);
    }
    // A PUPILA: uma fenda vertical de ponta afiada. Não é redonda porque
    // a coisa que mora no meio desta carta não é gente.
    for (let j = -15; j <= 15; j++) for (let i = -6; i <= 6; i++) {
      const v = Math.pow(Math.abs(i) / 4.6, 1.7) + Math.pow(Math.abs(j) / 14.4, 1.9);
      if (v <= 1) g.dot(m + i, m + j, TOM.pupila);
      else if (v <= 1.16) g.dot(m + i, m + j, TOM.limbo);
    }
    return g;
  }
  /* O BRILHO, e ele NÃO é da íris. É o reflexo da luz na superfície do
     olho, que é uma calota de vidro por cima de tudo: quando o olhar
     vira, a íris atravessa o olho inteiro e o reflexo quase não sai do
     lugar. Por isso ele mora numa camada só dele e anda a um terço do
     passo da íris. Na versão anterior o brilho ia grudado na íris, e o
     olho virava adesivo — porque adesivo é justamente a coisa cujo
     reflexo anda junto com o desenho.

     Ele vem ANTES do véu: pálpebra em cima de reflexo apaga o reflexo, e
     é isso que acontece de verdade quando a pessoa olha para cima. */
  function olhoBrilho() {
    const g = raster(OLHO.w, OLHO.h);
    const luzinha = (ox, oy, rx, ry, c) => {
      for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++)
        for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
          if (i * i / (rx * rx) + j * j / (ry * ry) <= 1) g.dot(OLHO.cx + ox + i, OLHO.cy + oy + j, c);
    };
    luzinha(-10, -7, 5.6, 4.6, TOM.brilho2);
    luzinha(-10, -7, 4.0, 3.1, TOM.brilho);
    luzinha(-13, -10, 1.4, 1.4, TOM.brilho);
    luzinha(11, 11, 2.0, 1.7, TOM.escLuz);      // a luz que atravessou e voltou, fraca
    return g;
  }
  /* O VÉU: a sombra da pálpebra POR CIMA da íris. Ela fica dentro do
     recorte e é desenhada depois da íris, então escurece o que estiver
     embaixo — esclera ou íris, tanto faz, que é o que sombra faz. */
  function olhoVeu(cols) {
    const g = raster(OLHO.w, OLHO.h);
    for (const [x, t, b] of cols) {
      const h = Math.max(1, b - t);
      for (let y = t; y <= b; y++) {
        /* A sombra é um CAMPO que apaga, e não uma tarja com borda. A
           versão anterior punha duas fileiras cheias e três picotadas
           sempre na mesma altura, e o picote virava um tracejado
           atravessando o olho de ponta a ponta — que é exatamente a
           listra que dither serve para evitar. */
        const v = Math.max(0, 1 - (y - t) / h / .30) * 2;
        let n = Math.floor(v); const r = v - n;
        const meio = (r - .24) / .52;
        if (meio > 0 && ordem(x, y) < Math.min(1, meio)) n++;
        if (n >= 2) g.dot(x, y, TOM.fio);
        else if (n >= 1) g.dot(x, y, TOM.sombra);
      }
    }
    return g;
  }
  /* AS PÁLPEBRAS. Grossa e escura em cima, onde a carne pesa; embaixo, o
     fio claro da linha molhada. Contorno escolhido, e não caixa preta em
     volta de tudo. */
  function olhoFrente(cols) {
    /* Duas camadas: ALTA é a beira da pálpebra de cima com os cílios, e
       ela desce junto na piscada; BAIXA é a linha molhada, os cantos e a
       carúncula, que não vão a lugar nenhum. Separá-las é o que faz a
       piscada fechar o olho inteiro em vez de passar uma cortina por
       trás de um contorno parado. */
    const g = raster(OLHO.w, OLHO.h), gb = raster(OLHO.w, OLHO.h);
    const topo = new Map(cols.map(([x, t]) => [x, t])), base = new Map(cols.map(([x, , b]) => [x, b]));
    const alt = new Map(cols.map(([x, t, b]) => [x, b - t]));
    const maior = Math.max(...alt.values());
    for (const [x, t, b] of cols) {
      const nx = (x - OLHO.cx) / 60, peso = alt.get(x) / maior;
      /* EM CIMA, A BORDA MAIS ESCURA DA FIGURA, e encostada na esclera.
         Sem esses dois pixels o alto do olho dissolvia no breu e a forma
         ficava sem contorno — borda mole é o que faz desenho pequeno
         parecer borrão. A pálpebra pesa mais no meio, como carne pesa. */
      const grossa = peso > .60 ? 3 : peso > .28 ? 2 : 1;
      for (let k = 1; k <= grossa; k++) g.dot(x, t - k, k <= 2 ? TOM.beira : TOM.traco);
      g.dot(x, t - grossa - 1, TOM.traco);
      // O serrilhado só incomoda onde a curva é rasa; ali um pixel de
      // meio-tom no degrau resolve, e o comprimento dos degraus já varia
      // sozinho porque a curva é curva.
      const viz = topo.get(x + 1);
      if (viz !== undefined && Math.abs(viz - t) >= 2)
        g.dot(x + (viz < t ? 1 : 0), Math.round((viz + t) / 2) - 1, TOM.fio);
      /* EMBAIXO, A LINHA MOLHADA. A pálpebra de baixo é a única parte do
         olho virada para cima, então é a que pega luz: aqui vai o fio
         claro, encostado na esclera, e o escuro fica POR FORA dele. O
         contrário — escuro encostado, claro fora — é o erro que faz o
         olho parecer recortado e colado. */
      const molhado = nx > -.44 && nx < .12 ? TOM.molhado : nx > -.70 && nx < .40 ? TOM.escLuz : TOM.escC;
      gb.dot(x, b + 1, molhado);
      gb.dot(x, b + 2, TOM.beira);
      gb.dot(x, b + 3, TOM.breu);
      const abaixo = base.get(x + 1);
      if (abaixo !== undefined && Math.abs(abaixo - b) >= 2)
        gb.dot(x + (abaixo > b ? 1 : 0), Math.round((abaixo + b) / 2) + 1, TOM.fio);
    }
    /* OS CANTOS. Cunha escura dos dois lados, porque canto de olho é
       buraco e nunca pega luz — e no canto de dentro, a carúncula: três
       pixels de rosa apagado. É o único pixel quente da figura inteira e
       é ele que tira o olho do território de vitral. */
    for (const [x0, dir] of [[OLHO.x0, 1], [OLHO.x1, -1]])
      for (let k = 0; k < 8; k++) {
        const x = x0 + dir * k, t = topo.get(x), b = base.get(x);
        if (t === undefined) continue;
        for (let y = t; y <= b; y++)
          if (k < 3 || (y - t) < 2 || (b - y) < 2) gb.dot(x, y, k < 2 ? TOM.traco : TOM.fio);
      }
    for (let k = 4; k < 8; k++) {
      const x = OLHO.x0 + k, t = topo.get(x), b = base.get(x);
      if (t === undefined || b - t < 5) continue;
      for (let y = t + 2; y <= b - 2; y++) gb.dot(x, y, k < 6 ? TOM.lacrimal : TOM.fio);
    }
    /* OS CÍLIOS. Curtos, desiguais, grossos na raiz e DEITADOS — cílio
       não sai do olho em raio de sol, ele se inclina para fora e cresce
       para o canto de fora. Doze, e nenhum do mesmo tamanho do vizinho:
       passo igual e comprimento igual não é cílio, é pente. */
    const cilios = [[15, 3, -.85], [21, 4, -.78], [27, 3, -.70], [33, 5, -.60],
      [40, 4, -.48], [47, 5, -.34], [54, 4, -.20], [62, 5, -.04],
      [70, 4, .14], [77, 6, .30], [84, 5, .44], [90, 7, .56],
      [96, 6, .68], [103, 7, .80], [109, 5, .92], [115, 3, 1.05]];
    for (const [x, comp, incl] of cilios) {
      const t = topo.get(x); if (t === undefined) continue;
      const g0 = alt.get(x) / maior > .60 ? 3 : 2;
      let px = x;
      for (let k = 0; k < comp; k++) {
        const py = t - g0 - k;
        g.dot(Math.round(px), py, k >= comp - 2 ? TOM.fio : TOM.traco);
        if (k === 0) g.dot(Math.round(px) + (incl > 0 ? -1 : 1), py, TOM.traco);
        px += incl * (.55 + k * .22);                 // a raiz sobe, a ponta deita
      }
    }
    return {alta: g, baixa: gb};
  }

  /* A PÁLPEBRA QUE DESCE. A piscada da versão anterior era a figura
     inteira achatada no eixo Y: o olho encolhia em vez de fechar, e num
     desenho de pixel achatar significa pular fileiras de pixel. Aqui a
     piscada é uma peça com a forma da própria pálpebra, que desce por
     dentro do recorte — a borda que varre o olho é a curva certa. */
  function olhoPalpebra(cols) {
    /* Ela é desenhada numa folha do DOBRO da altura e colada meio quadro
       acima: precisa ter carne de sobra em cima, senão descer não fecha o
       olho — passa uma tarja por ele e o olho reaparece embaixo. Foi
       exatamente o que a primeira tentativa fez. */
    const alto = OLHO.h * 2, salto = OLHO.h;
    const g = raster(OLHO.w, alto);
    for (const [x, t] of cols) {
      const e = t + salto;
      for (let y = e - 2; y >= 0; y--) g.dot(x, y, y > e - 7 ? TOM.sombra : TOM.traco);
      g.dot(x, e - 1, TOM.traco);
      g.dot(x, e, TOM.fio);
    }
    return {g, salto};
  }
  const CORTE = 'olho-amendoa';
  function olhoSVG() {
    const cols = colunasOlho(), frente = olhoFrente(cols), palpebra = olhoPalpebra(cols);
    const dx = OLHO.cx - (OLHO.caixaIris - 1) / 2, dy = OLHO.cy - (OLHO.caixaIris - 1) / 2;
    const corte = cols.map(([x, t, b]) => `<rect x="${x}" y="${t}" width="1" height="${b - t + 1}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OLHO.w} ${OLHO.h}"`
      + ` width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">`
      + `<defs><clipPath id="${CORTE}">${corte}</clipPath></defs>`
      + `<g clip-path="url(#${CORTE})">`
      + olhoFundo(cols).rects()
      + `<g class="st-eye-iris"><g transform="translate(${dx} ${dy})">${olhoIris().rects()}</g></g>`
      + `<g class="st-eye-glint">${olhoBrilho().rects()}</g>`
      + olhoVeu(cols).rects()
      + `<g class="st-eye-lid">${palpebra.g.rects(0, -palpebra.salto)}</g>`
      + `</g>`
      + `<g class="st-eye-lash">${frente.alta.rects()}</g>`
      + frente.baixa.rects()
      + `</svg>`;
  }
  /* A mesma figura numa imagem só, parada, para quem não precisa que ela
     olhe — o emblema, a galeria, qualquer lugar sem JS. */
  function olho() {
    if (cache.has('eye')) return cache.get('eye');
    const cols = colunasOlho(), g = raster(OLHO.w, OLHO.h);
    const dentro = new Map(cols.map(([x, t, b]) => [x, [t, b]]));
    const copiar = (fonte, ox, oy, recortar) => {
      for (let y = 0; y < fonte.alt; y++) for (let x = 0; x < fonte.larg; x++) {
        const c = fonte.ler(x, y); if (!c) continue;
        const X = x + ox, Y = y + oy;
        if (recortar) { const d = dentro.get(X); if (!d || Y < d[0] || Y > d[1]) continue; }
        g.dot(X, Y, c);
      }
    };
    copiar(olhoFundo(cols), 0, 0, false);
    copiar(olhoIris(), OLHO.cx - (OLHO.caixaIris - 1) / 2, OLHO.cy - (OLHO.caixaIris - 1) / 2, true);
    copiar(olhoBrilho(), 0, 0, true);
    copiar(olhoVeu(cols), 0, 0, false);
    const f = olhoFrente(cols);
    copiar(f.alta, 0, 0, false);
    copiar(f.baixa, 0, 0, false);
    const result = uri(g.svg()); cache.set('eye', result); return result;
  }
  const api = {cores, frame:uri(frame()), radialFrame, orbita, olho, olhoSVG, OLHO, svg:desenho, icon(n){const k='skill:'+n.pericia; if(!cache.has(k))cache.set(k,uri(desenho(n)));return cache.get(k);}};
  root.FichaIcones = api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
