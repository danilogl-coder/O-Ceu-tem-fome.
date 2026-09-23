/* O MOTOR DE LUZ DAS ILUSTRAÇÕES DE PERÍCIA.

   Vinte e oito desenhos feitos um a um, cada um com as suas cores e a sua
   ideia de sombra, dão vinte e oito estilos. Numa roda onde eles aparecem
   lado a lado, isso não lê como variedade: lê como sobra de coisas de
   lugares diferentes. Então a cor e a luz não são decisão de cada desenho
   — são deste arquivo, e valem para os vinte e oito.

   COMO SE DESENHA AQUI. Não se pinta pixel com a cor final. Diz-se a
   SILHUETA de uma peça e de que MATERIAL ela é; o motor calcula a luz.

     peca(g, aco, m => { m.elipse(32, 32, 12, 12); });

   A CONTA DA LUZ. De cada pixel, o motor anda na direção da luz até sair
   da peça (a passos) e na direção contrária até sair também (b passos).
   O tom vem de a/(a+b): zero no rebordo aceso, um no rebordo escuro.

   Medir pela distância ao CENTRO da peça — que é o atalho fácil — devolve
   "pillow shading": todo objeto vira uma almofada com o meio claro e as
   bordas escuras, e a forma some. Medir na DIREÇÃO DA LUZ devolve forma:
   uma bola vira bola, um cubo vira cubo, e os vinte e oito objetos ficam
   acesos do mesmo lado, que é o que faz eles parecerem do mesmo mundo.

   A LUZ VEM DE CIMA À ESQUERDA em todos, sem exceção.

   MATIZ QUE ANDA. Nenhuma escada de material é a mesma cor com preto e
   branco misturados. A sombra puxa para o azul e a luz para o quente —
   é o que separa metal de barro quando os dois são cinza. */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------- MATERIAIS
     Cinco degraus: fundo de sombra, sombra, base, luz, brilho. O brilho
     é RESERVADO — só aparece onde a luz bate de raspão e onde o desenho
     pede, nunca espalhado, senão a peça inteira vira reflexo. */
  const M = {
    aco:      ['#141a2b', '#324256', '#65798e', '#a3b6c6', '#eaf4fa'],
    ferro:    ['#12131c', '#2a2c3a', '#4b4e60', '#767b8e', '#b0b6c4'],
    ouro:     ['#2f1d0c', '#6d4413', '#b07c2a', '#e5b956', '#ffeeb0'],
    cobre:    ['#2a120d', '#642a17', '#a4512e', '#d8874f', '#ffd0a0'],
    papel:    ['#463628', '#89714e', '#c6ab7c', '#e9d6a8', '#fff6d8'],
    madeira:  ['#1f1107', '#4a2911', '#7c4920', '#ab723f', '#d7a771'],
    pele:     ['#361820', '#7a3a36', '#b26a4f', '#dc9d72', '#f9d0a4'],
    pano:     ['#121a33', '#273358', '#455a92', '#6f88c6', '#accaf5'],
    couro:    ['#1d1310', '#452a1f', '#6f4830', '#9b6c48', '#c99a6e'],
    sangue:   ['#26050c', '#6a0f1d', '#ab2130', '#dc4e4c', '#ff9280'],
    folha:    ['#0c2214', '#1d4b24', '#3b7e33', '#68b44c', '#a6e376'],
    pedra:    ['#15151d', '#2f2f3c', '#53535f', '#7e7e88', '#b3b3b9'],
    vidro:    ['#10222f', '#23495e', '#3d8096', '#77c0cb', '#d0f5f4'],
    osso:     ['#3a3225', '#70654e', '#a79878', '#d2c4a2', '#f6eed4'],
    roxo:     ['#190a31', '#3c1577', '#6b28b0', '#9d4bd8', '#d9a3f4'],
    ambar:    ['#33200a', '#7a4b0f', '#c08122', '#efb949', '#ffe9a0'],
    esmeralda:['#07231f', '#0f4d45', '#1c8a72', '#46c79c', '#96f5d0'],
    carmim:   ['#2b0819', '#6d1436', '#ab2a56', '#dc5a7d', '#ffa9b8'],
    ceu:      ['#101f3a', '#22406e', '#3e6fae', '#6da0e0', '#b6d8ff']
  };
  /* O contorno. Ele não é preto: é o roxo mais fundo da ficha, para o
     desenho não parecer recortado com tesoura e colado. */
  const TINTA = '#120c1f', TINTA2 = '#1d1530';

  /* A ordem de 4 × 4, a mesma do olho: ela dissolve a fronteira entre
     dois tons num corredor de dois ou três pixels. Faixa com borda dura
     em superfície lisa vira listra; xadrez em superfície lisa vira
     sujeira. O corredor estreito é o meio-termo que funciona. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const ordem = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;

  const L = 64;                       // o lado da grade de toda ilustração
  const LX = -1, LY = -1;             // de onde vem a luz, sempre

  /* Uma silhueta em construção. Mesma API do rasterizador, mas ela não
     pinta cor nenhuma: só marca onde a peça está. */
  function silhueta() {
    const m = new Uint8Array(L * L);
    const dot = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < L && y < L) m[y * L + x] = 1; };
    const rect = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dot(x + i, y + j); };
    const linha = (x, y, X, Y, w = 1) => {
      const n = Math.max(1, Math.abs(X - x), Math.abs(Y - y)), o = (w - 1) / 2;
      for (let i = 0; i <= n; i++) rect(Math.round(x + (X - x) * i / n - o), Math.round(y + (Y - y) * i / n - o), w, w);
    };
    const elipse = (x, y, rx, ry) => {
      for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
        if (i * i / (rx * rx) + j * j / (ry * ry) <= 1) dot(x + i, y + j);
    };
    const anel = (x, y, rx, ry, esp) => {
      for (let j = -Math.ceil(ry) - 1; j <= Math.ceil(ry) + 1; j++) for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
        const d = Math.hypot(i / rx, j / ry);
        if (d <= 1 && d >= 1 - esp / Math.max(rx, ry)) dot(x + i, y + j);
      }
    };
    const poly = (pts) => {
      for (let y = 0; y < L; y++) {
        const xs = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[j];
          if ((ay > y) !== (by > y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) dot(x, y);
      }
    };
    /* Caminho grosso: a espinha de uma coisa comprida (braço, cabo,
       corrente) com espessura que pode variar de ponta a ponta. */
    const fita = (pts, e0, e1 = e0) => {
      let total = 0; const seg = [];
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
      let andou = 0;
      for (let i = 1; i < pts.length; i++) {
        const n = Math.max(1, Math.ceil(seg[i - 1]));
        for (let k = 0; k <= n; k++) {
          const t = (andou + seg[i - 1] * k / n) / (total || 1);
          const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / n;
          const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / n;
          elipse(Math.round(x), Math.round(y), (e0 + (e1 - e0) * t) / 2, (e0 + (e1 - e0) * t) / 2);
        }
        andou += seg[i - 1];
      }
    };
    const tirar = fn => { const outra = silhueta(); fn(outra); for (let i = 0; i < m.length; i++) if (outra.m[i]) m[i] = 0; };
    /* Só o que estiver TAMBÉM na outra forma. É o recorte, e ele é o que
       faz uma coisa aparecer dentro de outra — a digital dentro da lente,
       a íris dentro da pálpebra — sem transbordar. */
    const so = fn => { const outra = silhueta(); fn(outra); for (let i = 0; i < m.length; i++) if (!outra.m[i]) m[i] = 0; };
    const tem = (x, y) => x >= 0 && y >= 0 && x < L && y < L && m[y * L + x] === 1;
    return {m, dot, rect, linha, elipse, anel, poly, fita, tirar, so, tem};
  }

  /* A ILUMINAÇÃO.

     Duas contas somadas, porque uma só não basta:

     1. O RELEVO. Mede-se a distância de cada pixel até a borda da peça e
        trata-se isso como ALTURA: a peça vira um monte com o topo no meio
        e as encostas nas beiradas. A inclinação de cada ponto dá a
        normal, e a normal contra a luz dá o tom. É esta conta que faz
        bola parecer bola: as faixas de tom saem CURVAS, acompanhando a
        superfície. A raiz quadrada da distância é o que transforma o
        monte de cone em calota — cone shade chapado no meio.

     2. A TRAVESSIA. De cada pixel, quantos passos na direção da luz até
        sair da peça, e quantos na direção contrária. Isso dá um gradiente
        geral de um lado ao outro do objeto, que o relevo sozinho não tem:
        sem ele, uma superfície plana grande sai com um tom só.

     A primeira versão tinha só a travessia, e as faixas saíam RETAS numa
     bola — porque, num círculo, os pontos que estão na mesma fração da
     própria corda formam uma reta. Bola com faixa reta não é bola, é
     moeda. O relevo foi o que consertou. */
  function iluminar(g, s, ramp, o = {}) {
    const m = s.m, dentro = (x, y) => x >= 0 && y >= 0 && x < L && y < L && m[y * L + x] === 1;
    const lx = o.lx ?? LX, ly = o.ly ?? LY;
    const janela = o.janela ?? .26;
    const releve = o.releve ?? 1;            // 0 = superfície plana, 1 = cheia
    const amp = o.amp ?? 1.05, inclina = o.inclina ?? .26;
    /* A FORMA do volume, que é o que o relevo vira:
         'chanfro' (padrão) — a peça é uma placa com a beirada arredondada.
                              Serve para quase tudo que é objeto feito.
         'redondo'          — calota inteira. Bola, fruto, cabeça, gota.
         'chapado'          — face plana com fio de luz na quina. Caixa,
                              parede, lâmina de papel.
       Escolher errado é o que faz uma caixa parecer travesseiro. */
    const forma = o.forma || (o.chapado ? 'chapado' : 'chanfro');
    const claro = o.claro ?? 0, escuro = o.escuro ?? 0;
    const chapado = forma === 'chapado';

    /* Distância de cada pixel até a borda, em duas passadas. */
    const D = new Float32Array(L * L);
    const GRANDE = 1e6;
    for (let i = 0; i < D.length; i++) D[i] = m[i] ? GRANDE : 0;
    const ver = (i, j, d) => { if (i >= 0 && j >= 0 && i < L && j < L && D[j * L + i] + d < D[y0 * L + x0]) D[y0 * L + x0] = D[j * L + i] + d; };
    let x0 = 0, y0 = 0;
    for (y0 = 0; y0 < L; y0++) for (x0 = 0; x0 < L; x0++) {
      if (!m[y0 * L + x0]) continue;
      ver(x0 - 1, y0, 1); ver(x0, y0 - 1, 1); ver(x0 - 1, y0 - 1, 1.41); ver(x0 + 1, y0 - 1, 1.41);
    }
    for (y0 = L - 1; y0 >= 0; y0--) for (x0 = L - 1; x0 >= 0; x0--) {
      if (!m[y0 * L + x0]) continue;
      ver(x0 + 1, y0, 1); ver(x0, y0 + 1, 1); ver(x0 + 1, y0 + 1, 1.41); ver(x0 - 1, y0 + 1, 1.41);
    }
    let Dmax = 0; for (let i = 0; i < D.length; i++) if (D[i] < GRANDE && D[i] > Dmax) Dmax = D[i];
    const R = Math.max(2, Dmax);
    /* A altura de cada pixel. Numa calota, ela é a do círculo:
       sqrt(d(2R − d)). A raiz simples — que foi a primeira tentativa —
       concentra toda a inclinação na beirada e devolve uma placa
       chanfrada, não uma bola. */
    const perfil = d => forma === 'redondo' ? Math.sqrt(Math.max(0, d * (2 * R - d))) * .62 : Math.sqrt(d) * 1.5;
    const alt = (x, y) => (x < 0 || y < 0 || x >= L || y >= L) ? 0 : perfil(D[y * L + x]);

    const nl = Math.hypot(lx, ly, 1.15);
    const lvx = lx / nl, lvy = ly / nl, lvz = 1.15 / nl;

    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (!dentro(x, y)) continue;
      let a = 0, b = 0, cx = x, cy = y;
      while (a < 70) { cx += lx; cy += ly; if (!dentro(cx, cy)) break; a++; }
      cx = x; cy = y;
      while (b < 70) { cx -= lx; cy -= ly; if (!dentro(cx, cy)) break; b++; }
      const t = a / (a + b + 1);
      const gx = (alt(x + 1, y) - alt(x - 1, y)) * .5 * releve;
      const gy = (alt(x, y + 1) - alt(x, y - 1)) * .5 * releve;
      const nn = Math.hypot(gx, gy, 1);
      const luz = (-gx * lvx - gy * lvy + lvz) / nn;   // normal contra a luz
      /* A LUZ DE VOLTA: na última fileira do lado escuro o tom sobe, que é
         o mundo em volta devolvendo luz. É ela que descola a peça do fundo
         — sem ela todo desenho termina em borda preta e vira adesivo. */
      const devolvida = b <= 1 ? .26 : b <= 2 ? .12 : 0;
      let v = chapado ? .50 + (luz - lvz) * .45 : .50 + (luz - lvz) * amp + (.5 - t) * inclina;
      v += devolvida + claro - escuro;
      if (a === 0 && !chapado) v += .10;
      const f = Math.max(0, Math.min(.999, v)) * (ramp.length - 1);
      let i = Math.floor(f); const r = f - i;
      const meio = (r - (.5 - janela / 2)) / janela;
      if (meio > 0 && ordem(x, y) < Math.min(1, meio)) i++;
      g.dot(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, i))]);
    }
    /* O CONTORNO ESCOLHIDO. Escuro embaixo e à direita, onde a peça se
       enterra na própria sombra; nada em cima e à esquerda, onde a luz
       bate — ali quem separa a peça do fundo é o próprio tom claro dela.
       Contorno preto em volta de tudo é o que faz desenho pequeno parecer
       figurinha recortada. */
    if (o.contorno !== false) {
      const fora = o.tinta || TINTA;
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
        if (dentro(x, y)) continue;
        let toca = false, nlx = 0, nly = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (dentro(x + dx, y + dy)) { toca = true; nlx -= dx; nly -= dy; }
        if (!toca) continue;
        const virado = nlx * lx + nly * ly;
        if (virado > 0 && o.contorno !== 'todo') continue;
        g.dot(x, y, virado === 0 && o.contorno !== 'todo' ? (o.tinta2 || TINTA2) : fora);
      }
    }
  }

  /* Desenha UMA peça: monta a silhueta e ilumina. */
  function peca(g, ramp, fn, o) {
    const s = silhueta(); fn(s); iluminar(g, s, ramp, o); return s;
  }

  /* Um DETALHE dentro de uma peça já iluminada: um vinco, uma correia,
     uma letra, um fio. Ele não recalcula luz nenhuma — usa um degrau
     fixo da escada do material. Detalhe pequeno com luz própria vira
     confete, e confete é o que mais estraga ícone de sessenta e quatro. */
  function tracar(g, cor, fn) {
    const s = silhueta(); fn(s);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (s.m[y * L + x]) g.dot(x, y, cor);
    return s;
  }
  /* O BRILHO ESPECULAR: um ponto só, do lado da luz, com uma franja um
     degrau abaixo. Dois brilhos na mesma peça matam os dois. */
  function brilho(g, x, y, rx, ry, ramp) {
    const f = Array.isArray(ramp) ? ramp : [ramp, ramp];
    for (let j = -Math.ceil(ry) - 1; j <= Math.ceil(ry) + 1; j++)
      for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
        const d = i * i / ((rx + .8) * (rx + .8)) + j * j / ((ry + .8) * (ry + .8));
        if (d <= 1) g.dot(x + i, y + j, f[Math.min(f.length - 1, 3)] || f[0]);
      }
    for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++)
      for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
        if (i * i / (rx * rx) + j * j / (ry * ry) <= 1) g.dot(x + i, y + j, f[f.length - 1]);
  }
  /* A SOMBRA QUE A PEÇA JOGA na peça de trás: dois pixels na diagonal da
     luz, no tom mais fundo. É o que empilha as peças em vez de deixá-las
     lado a lado no mesmo plano. */
  function projetar(g, s, dist, cor) {
    const m = s.m;
    for (let y = L - 1; y >= 0; y--) for (let x = L - 1; x >= 0; x--) {
      if (!m[y * L + x]) continue;
      for (let k = 1; k <= dist; k++) {
        const X = x + k, Y = y + k;
        if (X < L && Y < L && !m[Y * L + X]) g.dot(X, Y, cor);
      }
    }
  }

  const api = {M, TINTA, TINTA2, L, LX, LY, ordem, silhueta, iluminar, peca, tracar, brilho, projetar};
  root.FichaPericiasMotor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
