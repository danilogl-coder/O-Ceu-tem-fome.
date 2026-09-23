/* O KIT DE DESENHO DAS PERÍCIAS — segunda versão, escrita depois de uma
   pesquisa longa em Slynyrd, androidarts, Pixel Parmesan, Cure (Pixel Joint),
   Les Forges, Pedro Medeiros, imonk e nos manuais de NMM de miniatura.

   A versão anterior tinha TRÊS tons por material e nenhuma ideia de volume:
   chapa, uma mancha escura e uma mancha clara, todas desenhadas à mão. Lia,
   mas era adesivo — não tinha forma. A versão antes dessa calculava a luz
   pixel a pixel e saiu pior ainda, porque conta de luz devolve degradê e
   degradê precisa de xadrez para caber nos tons.

   O caminho do meio, que é o que os desenhistas de verdade fazem, está aqui:
   a luz não é calculada por pixel, é calculada por FAIXA. Empurro a silhueta
   na direção da luz e a diferença é uma faixa de borda dura que acompanha a
   forma sozinha. Seis tons, seis faixas, nenhuma transição suave:

     REFLEXO  1-2px colados na borda longe da luz. É o chão devolvendo luz.
     MIOLO    2-4px logo acima do reflexo: a parte mais escura da peça, e a
              faixa mais ESTREITA de todas, porque é ali que o olho espera
              o maior salto de valor e não repara na borda (androidarts).
     SOMBRA   2-5px, o corpo da parte escura.
     BASE     a cor local, a maior área.
     LUZ      3-5px colados na borda voltada para a luz.
     BRILHO   1-3px, só em material lustroso; metal ganha branco quase puro
              encostado no tom mais escuro, que é a assinatura do metal.

   REGRAS QUE NÃO SE QUEBRAM, todas vindas da pesquisa:
     · a luz vem sempre de cima e da esquerda, em todo o conjunto;
     · superfície CHATA leva um tom só; superfície CURVA leva rampa;
     · o reflexo nunca fica mais claro que a base (senão vira dois objetos);
     · #000 só no contorno; #fff só em metal, vidro e gema;
     · nada de xadrez — padrão de produção de ícone proíbe;
     · o antisserrilhado mora DENTRO da silhueta; a borda de fora é opaca;
     · textura é contagem, não tamanho: a 64 o luxo é ter mais rebite, não
       rebite maior.

   As rampas têm seis tons cada, geradas com valor crescente de passo
   desigual, saturação com pico no meio e matiz girando para o violeta no
   escuro e para o amarelo na luz — e conferidas uma a uma. */
(function (root) {
  'use strict';

  const L = 64;
  /* O contorno de todo o conjunto é o mesmo. Contorno de cor própria por
     peça é o que faz um ícone virar colagem. */
  const TRACO = '#0a0812';

  /* T0 oclusão · T1 miolo · T2 sombra · T3 cor local · T4 luz · T5 brilho */
  const M = {
    aco:       ['#0d0d14', '#151826', '#3c475e', '#77899e', '#baccd9', '#f2fcff'],
    cromo:     ['#0d0d14', '#151926', '#3c4b5e', '#778e9e', '#bad1d9', '#f2feff'],
    ferro:     ['#17151f', '#212136', '#343861', '#505b8a', '#778ead', '#a1bfcc'],
    ouro:      ['#170909', '#29130a', '#613b0c', '#a18320', '#d9c55b', '#fffcd6'],
    latao:     ['#170b0a', '#29150d', '#613a14', '#a17a2d', '#d9bd68', '#fffada'],
    cobre:     ['#17090b', '#290d0b', '#612010', '#a14d27', '#d99d61', '#fff4d8'],
    papel:     ['#261a19', '#3d2a22', '#694d31', '#917a4c', '#b5a474', '#d4cba1'],
    madeira:   ['#211112', '#381a15', '#6b351e', '#9c6338', '#c79d69', '#e8d3a2'],
    pele:      ['#211315', '#381a19', '#6b3527', '#9c6444', '#c79f75', '#e8d6ab'],
    pano:      ['#191526', '#1c1b3d', '#242b69', '#3a4e91', '#648bb5', '#94c7d4'],
    couro:     ['#211214', '#381b19', '#6b3726', '#9c6642', '#c7a073', '#e8d5a9'],
    sangue:    ['#21111a', '#381523', '#6b1e32', '#9c3845', '#c77569', '#e8c1a2'],
    folha:     ['#15261f', '#1b3d28', '#246932', '#3a9140', '#72b564', '#b2d494'],
    pedra:     ['#1f1d26', '#2d2a3d', '#444369', '#616591', '#8895b5', '#b1c5d4'],
    vidro:     ['#0f131c', '#162330', '#265166', '#4c93a1', '#8dd1d4', '#d0f7f2'],
    osso:      ['#261e1c', '#3d3129', '#69563f', '#91825d', '#b5ab84', '#d4d0ae'],
    roxo:      ['#09041a', '#14032b', '#380663', '#731ba6', '#c85dde', '#ffdbfd'],
    ambar:     ['#1a0604', '#2b1003', '#633406', '#a6731b', '#debc5d', '#fffadb'],
    verde:     ['#04181a', '#032b27', '#06634d', '#1ba673', '#5dde8e', '#dbffde'],
    carmim:    ['#21111d', '#38152b', '#6b1e43', '#9c385d', '#c76977', '#e8aca2'],
    ceu:       ['#0c0d1c', '#101630', '#163466', '#376ca1', '#7bb5d4', '#c6eff7'],
    fogo:      ['#1a0406', '#2b0803', '#632106', '#a6571b', '#dea65d', '#fff5db'],
    borracha:  ['#17141a', '#292430', '#47415c', '#676185', '#8688a8', '#acb4c7'],
    plastico:  ['#1c0e15', '#30131d', '#661e2f', '#a1414e', '#d48b84', '#f7dbcb'],
    tinta:     ['#161217', '#2a212e', '#4e3c59', '#705b82', '#8e80a6', '#aba7c4'],
    porcelana: ['#382728', '#573f39', '#8a7160', '#b8a993', '#ded6c5', '#fcfaf2'],
    breu:      ['#0d0b0f', '#1f1926', '#3d3152', '#5c4e7a', '#79739e', '#9b9dbd'],
    musgo:     ['#1a261a', '#293d23', '#476935', '#6e9150', '#a1b578', '#d0d4a4'],
    laranja:   ['#1a0605', '#2b0e07', '#632b0d', '#a66126', '#dead67', '#fff6de'],
    grafite:   ['#0b0c12', '#15171f', '#252833', '#3a3e4c', '#565c6e', '#7b8395'],
    placa:     ['#04120c', '#0a2116', '#123524', '#1d4d33', '#2f6b46', '#4d8f60'],
    tijolo:    ['#1c0d0c', '#301613', '#5c2a20', '#8a4530', '#b56d48', '#d69b74']
  };

  /* ---------------------------------------------------------------- FORMA */
  /* Uma forma não pinta nada. Ela só marca onde a peça está; quem decide o
     que fazer com isso é o desenho. */
  function forma(dados) {
    const m = dados || new Uint8Array(L * L);
    const dentroDoQuadro = (x, y) => x >= 0 && y >= 0 && x < L && y < L;
    const pt = (x, y) => { x = Math.round(x); y = Math.round(y); if (dentroDoQuadro(x, y)) m[y * L + x] = 1; };
    const ret = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pt(x + i, y + j); };
    /* A elipse leva meio pixel a mais em cada raio. Sem isso, um raio 2 sai
       LOSANGO e não círculo — e conta de terço, cabeça de alfinete e elo de
       corrente são todos raio 2 ou 3. Meio pixel resolve os pequenos e não
       muda nada nos grandes. */
    const eli = (x, y, rx, ry) => {
      const a = rx + 0.5, b = ry + 0.5;
      for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
        if ((i * i) / (a * a) + (j * j) / (b * b) <= 1) pt(x + i, y + j);
    };
    const anel = (x, y, rx, ry, esp) => {
      const a = rx + 0.5, b = ry + 0.5, f = 1 - esp / Math.max(a, b);
      for (let j = -Math.ceil(ry) - 1; j <= Math.ceil(ry) + 1; j++) for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
        const d = Math.hypot(i / a, j / b);
        if (d <= 1 && d >= f) pt(x + i, y + j);
      }
    };
    /* Um arco de anel, de a até b em graus (0 = leste, cresce no sentido
       horário porque o y cresce para baixo). */
    const arco = (x, y, rx, ry, esp, a, b) => {
      const ex = rx + 0.5, ey = ry + 0.5, f = 1 - esp / Math.max(ex, ey);
      const ra = a * Math.PI / 180, rb = b * Math.PI / 180;
      for (let j = -Math.ceil(ry) - 1; j <= Math.ceil(ry) + 1; j++) for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
        const d = Math.hypot(i / ex, j / ey);
        if (d > 1 || d < f) continue;
        let t = Math.atan2(j, i); if (t < ra) t += Math.PI * 2;
        if (t <= rb) pt(x + i, y + j);
      }
    };
    const pol = pts => {
      let y0 = L, y1 = 0;
      for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(L - 1, Math.ceil(y1)); y++) {
        const xs = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[j];
          if ((ay > y) !== (by > y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) pt(x, y);
      }
    };
    /* Linha grossa de verdade: quadrados empilhados, não círculos carimbados.
       Círculo carimbado deixa a beirada roída. */
    const risco = (x0, y0, x1, y1, e) => {
      e = e || 1;
      const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      const o = (e - 1) / 2;
      for (let i = 0; i <= n; i++) ret(Math.round(x0 + (x1 - x0) * i / n - o), Math.round(y0 + (y1 - y0) * i / n - o), e, e);
    };
    const cam = (pts, e) => { for (let i = 1; i < pts.length; i++) risco(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], e || 1); };
    /* Curva de três pontos, para cabo, alça, mangueira, fio. */
    const curva = (a, b, c, e) => {
      const p = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, u = 1 - t;
        p.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]);
      }
      cam(p, e || 1);
    };
    const menos = fn => { const o = forma(); fn(o); for (let i = 0; i < m.length; i++) if (o.m[i]) m[i] = 0; };
    const so = fn => { const o = forma(); fn(o); for (let i = 0; i < m.length; i++) if (!o.m[i]) m[i] = 0; };
    const mais = fn => { const o = forma(); fn(o); for (let i = 0; i < m.length; i++) if (o.m[i]) m[i] = 1; };
    const tem = (x, y) => dentroDoQuadro(x, y) && m[y * L + x] === 1;
    const copia = () => forma(m.slice());
    const conta = () => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };
    const caixa = () => {
      let x0 = L, y0 = L, x1 = -1, y1 = -1;
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (m[y * L + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return {x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1};
    };
    return {m, pt, ret, eli, anel, arco, pol, risco, cam, curva, menos, so, mais, tem, copia, conta, caixa};
  }

  /* Empurra a forma. Base de tudo que vem depois. */
  function desloca(s, dx, dy) {
    const o = forma();
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (s.m[y * L + x]) o.pt(x + dx, y + dy);
    return o;
  }
  /* A profundidade de cada pixel medida a partir da borda OPOSTA a (dx,dy).
     Empurrar a forma n vezes e ver quem sobrou é o mesmo que medir a
     distância até a beirada naquele rumo — e sai com borda dura, que é o
     ponto. Devolve um mapa de inteiros: 1 = colado na beirada. */
  function fundura(s, dx, dy, max) {
    const d = new Uint8Array(L * L);
    let atual = s.m;
    for (let n = 1; n <= max; n++) {
      const prox = new Uint8Array(L * L);
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
        if (!atual[y * L + x]) continue;
        d[y * L + x] = n;
        const X = x - dx, Y = y - dy;
        if (X >= 0 && Y >= 0 && X < L && Y < L && atual[Y * L + X]) prox[y * L + x] = 1;
      }
      atual = prox;
    }
    /* quem sobreviveu a todas as erosões está no miolo da peça, longe de
       qualquer beirada: zero, fora de toda faixa. Sem isto o fundo inteiro
       entra na última faixa e a peça vira uma mancha só. */
    for (let i = 0; i < d.length; i++) if (atual[i]) d[i] = 0;
    return d;
  }

  /* ---------------------------------------------------------------- TINTA */
  function chapa(g, s, cor) {
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (s.m[y * L + x]) g.dot(x, y, cor);
  }
  /* Pinta uma segunda forma só onde ela cai dentro da primeira. É assim que
     a mancha fica presa na peça. */
  function dentro(g, s, cor, fn) {
    const o = forma(); fn(o);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (s.m[y * L + x] && o.m[y * L + x]) g.dot(x, y, cor);
  }

  /* O CONTORNO: um pixel por fora, nas oito direções, contínuo, sem furo.
     Ele não é todo da mesma cor: no arco de cima e da esquerda, onde a luz
     bate, ele sobe um degrau e fica com a cor do material. Isso é o
     contorno seletivo, e é a pista de profundidade mais barata que existe. */
  function contorno(g, s, o) {
    o = o || {};
    const escuro = o.tinta || TRACO;
    const claro = o.tintaLuz || null;
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (s.m[y * L + x]) continue;
      let toca = false;
      for (let k = 0; k < 8; k++) {
        const X = x + VIZ[k][0], Y = y + VIZ[k][1];
        if (X >= 0 && Y >= 0 && X < L && Y < L && s.m[Y * L + X]) { toca = true; break; }
      }
      if (!toca) continue;
      /* de que lado da peça este pixel está? se a peça fica abaixo e à
         direita dele, ele é o lado da luz. */
      const luzDoLado = claro && (s.tem(x + 1, y + 1) || s.tem(x + 1, y) || s.tem(x, y + 1)) &&
        !(s.tem(x - 1, y - 1) || s.tem(x - 1, y) || s.tem(x, y - 1));
      g.dot(x, y, luzDoLado ? claro : escuro);
    }
  }
  const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /* --------------------------------------------------------------- VOLUME */
  /* Os rumos de faixa. A luz é sempre de cima e da esquerda; o que muda é
     como a superfície vira.
       esfera   — vira nos dois eixos: faixa na diagonal
       tuboV    — cilindro em pé: faixa vertical, igual de cima a baixo
       tuboH    — cilindro deitado: faixa horizontal
       chato    — superfície plana: um tom só, sem faixa nenhuma
       cunha    — cone/lâmina: como o tubo, mas afinando */
  const RUMO = {esfera: [1, 1], tuboV: [1, 0], tuboH: [0, 1], cunha: [1, 0], chato: [0, 0]};

  /* A receita completa de uma peça. `mat` é uma rampa de seis tons.
       corte   'esfera' | 'tuboV' | 'tuboH' | 'chato'
       faixas  [reflexo, miolo, sombra, luz] em pixels
       brilhoFaixa  pixels de T5 colados na beirada da luz — só metal, vidro
                    e gema ganham isso; material fosco fica em T4.

     As faixas encolhem sozinhas quando a peça é fina. Um cabo de três
     pixels não tem onde pôr sete pixels de sombra, e sem isto ele sairia
     preto inteiro. */
  function volume(g, s, mat, o) {
    o = o || {};
    const corte = o.corte || 'esfera';
    const base = o.base === undefined ? 3 : o.base;
    if (corte === 'chato') { chapa(g, s, mat[base]); return s; }

    const [rx, ry] = RUMO[corte] || RUMO.esfera;
    const cx = o.giro ? o.giro[0] : rx, cy = o.giro ? o.giro[1] : ry;
    let [wRef, wMio, wSom, wLuz] = o.faixas || [1, 3, 3, 4];
    let wBri = o.brilhoFaixa || 0;

    const TETO = 26;
    const dEscuro = fundura(s, -cx, -cy, TETO);
    const dClaro = fundura(s, cx, cy, TETO);
    let maxE = 0, maxC = 0;
    for (let i = 0; i < dEscuro.length; i++) {
      if (!s.m[i]) continue;
      if (dEscuro[i] > maxE) maxE = dEscuro[i];
      if (dClaro[i] > maxC) maxC = dClaro[i];
      if (!dEscuro[i] || !dClaro[i]) { maxE = TETO; maxC = TETO; }
    }
    const grosso = Math.max(2, Math.min(maxE, maxC) * 2 - 1);
    const pedido = wRef + wMio + wSom + wLuz + wBri;
    if (pedido > grosso) {
      const k = grosso / pedido;
      const ap = (v, min) => v ? Math.max(min, Math.round(v * k)) : 0;
      wRef = ap(wRef, 0); wMio = ap(wMio, 1); wSom = ap(wSom, 0);
      wLuz = ap(wLuz, 1); wBri = ap(wBri, 0);
    }
    const somaEscura = wRef + wMio + wSom;
    const somaClara = wLuz + wBri;
    const tomReflexo = o.reflexo === false ? null : mat[o.tomReflexo === undefined ? 2 : o.tomReflexo];
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      const i = y * L + x;
      if (!s.m[i]) continue;
      const de = dEscuro[i], dc = dClaro[i];
      let cor = mat[base];
      /* primeiro a luz, depois o escuro por cima: numa peça estreita,
         perder o miolo é perder a forma; perder o brilho não é. */
      if (dc && wBri && dc <= wBri) cor = mat[5];
      else if (dc && dc <= somaClara) cor = mat[4];
      if (de && wRef && de <= wRef && tomReflexo) cor = tomReflexo;
      else if (de && de <= wRef + wMio) cor = mat[o.tomMiolo === undefined ? 0 : o.tomMiolo];
      else if (de && de <= somaEscura) cor = mat[1];
      g.dot(x, y, cor);
    }
    return s;
  }

  /* peça = contorno + volume, que é o que quase todo desenho quer.
     Depois do volume vêm as manchas de mão: sombra, luz, brilho e marca.
     Cada uma é uma função que desenha uma forma; o recorte prende a mancha
     dentro da peça. O brilho é sempre mancha de mão — a pesquisa é unânime
     em que o alto-brilho é um estouro de poucos pixels, não o fim de uma
     rampa longa. */
  function peca(g, mat, fn, o) {
    o = o || {};
    const s = forma(); fn(s);
    /* O contorno do lado da LUZ sobe um degrau e ganha a cor do material.
       Esse é o contorno seletivo, e é a pista de profundidade mais barata
       que existe: não custa cor nova e tira a peça do fundo. Em T1 puro ele
       some; meio caminho até T2 é onde ele aparece sem virar borda clara. */
    if (o.contorno !== false) contorno(g, s, {
      tinta: o.tinta,
      tintaLuz: o.tintaLuz === undefined ? mistura(mat[1], mat[2], 0.5) : o.tintaLuz
    });
    volume(g, s, mat, o);
    if (o.sombra) dentro(g, s, mat[o.tomSombra === undefined ? 1 : o.tomSombra], o.sombra);
    if (o.luz) dentro(g, s, mat[4], o.luz);
    if (o.brilho) dentro(g, s, mat[5], o.brilho);
    if (o.marca) dentro(g, s, mat[0], o.marca);
    return s;
  }

  /* -------------------------------------------------------------- METAL  */
  /* Metal não é degradê: é espelho, e espelho tem horizonte. Acima do
     horizonte reflete o céu e clareia até quase branco; no horizonte cai
     para o tom mais escuro em UM pixel; abaixo reflete o chão e volta a
     clarear, mas morno. É o branco encostado no preto que faz metal. */
  function horizonte(g, s, mat, y0, o) {
    o = o || {};
    const alto = o.alto === undefined ? 1 : o.alto;
    /* O horizonte de um espelho CURVO não é uma reta: ele arqueia junto com
       a superfície. Sem o arco, as fileiras saem todas do mesmo comprimento
       e empilhadas, que é exatamente a definição de faixa. */
    const c = s.caixa(), meio = (c.x0 + c.x1) / 2, meiaLarg = Math.max(1, (c.x1 - c.x0) / 2);
    const arco = o.arco === undefined ? 0 : o.arco;
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (!s.m[y * L + x]) continue;
      const t = (x - meio) / meiaLarg;
      const d = y - (y0 + Math.round(arco * (1 - t * t)));
      let cor = null;
      if (d >= 0 && d < alto) cor = mat[0];
      else if (d < 0) cor = d >= -2 ? mat[5] : (d >= -5 ? mat[4] : (d >= -9 ? mat[3] : mat[2]));
      else cor = d < alto + 3 ? mat[1] : (d < alto + 7 ? mat[2] : mat[3]);
      g.dot(x, y, cor);
    }
  }

  /* ------------------------------------------------------------- TEXTURA */
  /* Sorteio com semente, para o desenho sair igual toda vez. Teste compara
     sprite, e sprite que muda sozinho quebra teste. */
  function sorte(semente) {
    let s = (semente | 0) || 1;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* VEIO DE MADEIRA. Madeira é padrão, não é luz: as linhas não mudam de
     tom quando a peça escurece. Paralelas mas tortas, partidas em pedaços
     de 4 a 9px, defasadas entre si para nenhuma alinhar com a vizinha. */
  function veio(g, s, cor, o) {
    o = o || {};
    const r = sorte(o.semente || 7);
    const c = s.caixa();
    const n = o.n || 3;
    const vert = o.vertical;
    const compA = vert ? c.h : c.w, compB = vert ? c.w : c.h;
    for (let k = 0; k < n; k++) {
      const off = Math.round(compB * (k + 1) / (n + 1) + (r() - 0.5) * 2);
      let p = Math.round(r() * 3);
      while (p < compA) {
        const len = 4 + Math.round(r() * 5);
        for (let i = 0; i < len && p + i < compA; i++) {
          const onda = Math.round(Math.sin((p + i) * 0.28 + k * 2.1) * 1.1);
          const x = vert ? c.x0 + off + onda : c.x0 + p + i;
          const y = vert ? c.y0 + p + i : c.y0 + off + onda;
          if (s.tem(x, y)) g.dot(x, y, cor);
        }
        p += len + 2 + Math.round(r() * 4);
      }
    }
  }

  /* SALPICO: couro, pedra, concreto. Aglomera nas beiradas e some na
     sombra, que é como sujeira se comporta de verdade. */
  function salpico(g, s, cor, o) {
    o = o || {};
    const r = sorte(o.semente || 13);
    const c = s.caixa();
    const n = o.n || 12;
    for (let k = 0; k < n; k++) {
      let x, y, t = 0;
      do { x = c.x0 + Math.floor(r() * c.w); y = c.y0 + Math.floor(r() * c.h); t++; } while (!s.tem(x, y) && t < 30);
      if (!s.tem(x, y)) continue;
      g.dot(x, y, cor);
      if (r() > 0.55 && s.tem(x + 1, y)) g.dot(x + 1, y, cor);
    }
  }

  /* ARRANHÃO de metal: um risco claro com um pixel escuro atrás. Sem o
     escuro, o risco lê como fio de cabelo. */
  function arranhao(g, s, mat, lista) {
    for (const [x0, y0, x1, y1] of lista) {
      const a = forma(); a.risco(x0, y0, x1, y1, 1);
      const b = desloca(a, 0, 1);
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
        if (b.m[y * L + x] && s.m[y * L + x] && !a.m[y * L + x]) g.dot(x, y, mat[1]);
      }
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (a.m[y * L + x] && s.m[y * L + x]) g.dot(x, y, mat[4]);
    }
  }

  /* REBITE: quatro pixels. Escuro embaixo à direita, claro em cima à
     esquerda. Três seguidos já leem como chapa parafusada. */
  function rebite(g, s, mat, x, y) {
    if (!s.tem(x, y)) return;
    g.dot(x, y, mat[4]); g.dot(x + 1, y, mat[3]);
    g.dot(x, y + 1, mat[2]); g.dot(x + 1, y + 1, mat[1]);
  }

  /* COSTURA: tracinhos de dois em dois, na cor do fio. */
  function costura(g, s, cor, pts, passo) {
    passo = passo || 3;
    const a = forma(); a.cam(pts, 1);
    let n = 0;
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (!a.m[y * L + x] || !s.m[y * L + x]) continue;
      if ((n++ % passo) < 2) g.dot(x, y, cor);
    }
  }

  /* DOBRA de pano: o vinco é sombra dura de um pixel e a crista ao lado é
     luz. Nunca se contorna uma dobra — ela se define por tom. */
  function dobra(g, s, mat, pts) {
    const vinco = forma(); vinco.cam(pts, 1);
    const crista = desloca(vinco, -1, -1);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (crista.m[y * L + x] && s.m[y * L + x] && !vinco.m[y * L + x]) g.dot(x, y, mat[4]);
    }
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (vinco.m[y * L + x] && s.m[y * L + x]) g.dot(x, y, mat[1]);
    }
  }

  /* SOMBRA PROJETADA: uma peça jogando escuro na outra. Borda dura sempre —
     sombra projetada é a mais dura que existe. */
  function projeta(g, alvo, quem, mat, dx, dy) {
    const s = desloca(quem, dx, dy);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (s.m[y * L + x] && alvo.m[y * L + x] && !quem.m[y * L + x]) g.dot(x, y, mat[1]);
    }
  }

  /* MISTURA para antisserrilhado manual: o tom de apoio não precisa ser a
     média — precisa ter o valor certo. Mas a média resolve e não inventa
     cor nova fora da peça. */
  function mistura(a, b, t) {
    t = t === undefined ? 0.5 : t;
    const A = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
    const B = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  /* --------------------------------------------------------- FAXINA */
  /* A última coisa que um desenhista faz é varrer o pixel solto. Cure e
     Slynyrd dizem a mesma coisa: pixel órfão é ruído, e as duas únicas
     licenças são o alto-brilho e um detalhe essencial minúsculo — olho,
     bico, faísca.

     Aqui a regra é: pixel sem NENHUM vizinho da própria cor nas oito
     direções vira a cor que manda na vizinhança, desde que ela mande de
     verdade (quatro dos oito). Pixel claro passa livre, porque é brilho.
     Buraco de um pixel no meio de uma peça também some — furo de agulha
     no meio de uma chapa é o mesmo defeito visto do avesso. */
  function luzDe(c) {
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function limpar(g, tamanho) {
    const n = tamanho || L;
    if (!g.ler) return;
    const antes = new Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) antes[y * n + x] = g.ler(x, y);
    const em = (x, y) => (x >= 0 && y >= 0 && x < n && y < n) ? antes[y * n + x] : null;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = em(x, y);
      const conta = {};
      let iguais = 0, cheios = 0;
      for (let k = 0; k < 8; k++) {
        const v = em(x + VIZ[k][0], y + VIZ[k][1]);
        if (!v) continue;
        cheios++;
        if (v === c) iguais++;
        conta[v] = (conta[v] || 0) + 1;
      }
      if (c && (iguais > 0 || luzDe(c) >= 0.72)) continue;
      if (!c && cheios < 8) continue;
      let dono = null, maior = 0;
      for (const k in conta) if (conta[k] > maior) { maior = conta[k]; dono = k; }
      if (dono && maior >= 4) g.dot(x, y, dono);
    }
  }

  const api = {
    L, TRACO, M, forma, desloca, fundura, chapa, dentro, contorno, volume, peca,
    horizonte, veio, salpico, arranhao, rebite, costura, dobra, projeta, mistura, sorte, limpar
  };
  root.FichaPericiasKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
