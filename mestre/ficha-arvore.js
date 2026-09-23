/* A árvore de perícias — o desenho.

   O LUGAR de cada galho e de cada nódulo vem de `layoutArvore()`, no
   modelo: aqui só se pinta. É de propósito, e por dois motivos — dá para
   testar a planta da árvore sem abrir navegador, e o pixel nunca discorda
   da área de clique.

   A árvore é a mesma coluna-planta da carta de SUBSTÂNCIA, crescida: osso
   no tronco, mato nos galhos. A mente fica na copa e o corpo na raiz, e
   cada forquilha puxa a cor do seu naipe. Tudo desenhado duas ou três
   vezes maior e reduzido pelo filtro de maioria, como o resto da ficha. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, A = root.FichaArte;
  if (!K || !U || !A) return;
  const {Pintor, emAlta, pintar, paletaDe, M, N, textoPx, QUADROS} = A;
  const rnd = (a, b, s = 0) => K.hash2(Math.floor(a), Math.floor(b), s);

  /* ---------------------------------------------------------- os glifos
     Vinte e oito símbolos de 11×11. Nesse tamanho não cabe ilustração: o
     que cabe é UMA ideia por glifo, em silhueta fechada, com o tom vivo
     por corpo e o escuro só gravando. Desenhados em 3× e reduzidos, que é
     o que dá a curva da lupa e o dente da engrenagem. */
  const G = 15;
  const GLIFOS = {
    /* -------------------------------------------------------- COSMO */
    atualidades(g, F, u) {                                  // o jornal dobrado
      g.rect(1.2 * F, 2.2 * F, 8.6 * F, 7 * F, N.VIVO);
      g.rect(1.2 * F, 2.2 * F, 8.6 * F, 1.5 * F, N.BRILHO);
      for (let i = 0; i < 3; i++)
        g.traco(2.4 * F, (5 + i * 1.5) * F, 8.6 * F, (5 + i * 1.5) * F, N.MEIO, u);
      g.traco(5.6 * F, 2.2 * F, 5.6 * F, 9.2 * F, N.PRETO, u);
      g.traco(1.2 * F, 2.2 * F, 1.2 * F, 9.2 * F, N.MEIO, u);
    },
    ciencias(g, F, u) {                                     // o frasco de bojo
      g.elipse(5.5 * F, 7 * F, 3.8 * F, 3.4 * F, N.VIVO);
      g.rect(4.4 * F, 1.2 * F, 2.2 * F, 4.4 * F, N.VIVO);
      g.traco(3.6 * F, 1.2 * F, 7.4 * F, 1.2 * F, N.BRILHO, 1.5 * u);
      g.traco(4.4 * F, 1.6 * F, 4.4 * F, 5.4 * F, N.BRILHO, u);
      g.traco(6.6 * F, 2 * F, 6.6 * F, 5.4 * F, N.MEIO, u);
      g.anel(5.5 * F, 7 * F, 3.8 * F, 3.4 * F, N.BRILHO, u, Math.PI * .98, Math.PI * 1.52);
      g.traco(2.4 * F, 7.8 * F, 8.6 * F, 7.8 * F, N.MEIO, 1.4 * u);   // o líquido
      g.ponto(4.6 * F, 6.2 * F, 1.6 * u, N.BRILHO);
      g.ponto(6.6 * F, 5.4 * F, 1.2 * u, N.BRILHO);
    },
    investigacao(g, F, u) {                                 // a lupa
      g.anel(4.6 * F, 4.4 * F, 3.4 * F, 3.4 * F, N.VIVO, 1.6 * u);
      g.anel(4.6 * F, 4.4 * F, 3.4 * F, 3.4 * F, N.BRILHO, u, Math.PI * 1.05, Math.PI * 1.75);
      g.traco(6.9 * F, 6.8 * F, 9.6 * F, 9.6 * F, N.MEIO, 2.2 * u);
      g.traco(6.9 * F, 6.8 * F, 9.2 * F, 9.2 * F, N.VIVO, u);
    },
    medicina(g, F, u) {                                     // a cruz
      g.rect(4.2 * F, 1 * F, 2.6 * F, 9 * F, N.VIVO);
      g.rect(1 * F, 4.2 * F, 9 * F, 2.6 * F, N.VIVO);
      g.traco(4.2 * F, 1 * F, 4.2 * F, 10 * F, N.BRILHO, u);
      g.traco(1 * F, 4.2 * F, 10 * F, 4.2 * F, N.BRILHO, u);
      g.traco(6.6 * F, 1 * F, 6.6 * F, 10 * F, N.MEIO, u);
      g.traco(1 * F, 6.6 * F, 10 * F, 6.6 * F, N.MEIO, u);
    },
    ocultismo(g, F, u) {                                    // a estrela virada
      /* Sem anel: no tamanho de um glifo, anel mais estrela viram um
         borrão só. A estrela de ponta para baixo já diz tudo sozinha. */
      const c = 5.5 * F, pts = [];
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 2 : 4.8) * F;
        pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
      }
      g.poly(pts, N.VIVO);
      for (let i = 0; i < 10; i += 2) {
        const q = pts[i], w = pts[(i + 1) % 10];
        g.traco(q[0], q[1], w[0], w[1], N.BRILHO, u);
      }
      g.elipse(c, c, 1.5 * F, 1.5 * F, N.PRETO);
      g.ponto(c, c, 1.3 * u, N.BRILHO);
    },
    percepcao(g, F, u) {                                    // a orelha
      g.anel(5.4 * F, 5 * F, 3.6 * F, 4.2 * F, N.VIVO, 2 * u, Math.PI * .58, Math.PI * 1.92);
      g.anel(5.4 * F, 5 * F, 3.6 * F, 4.2 * F, N.BRILHO, u, Math.PI * 1.1, Math.PI * 1.7);
      g.anel(5.2 * F, 5 * F, 1.7 * F, 2.1 * F, N.MEIO, 1.3 * u, Math.PI * .4, Math.PI * 1.8);
      g.traco(4.6 * F, 8.2 * F, 6.4 * F, 9.6 * F, N.VIVO, 1.6 * u);
    },
    profissao(g, F, u) {                                    // o martelo
      g.rect(1.4 * F, 1.6 * F, 7.4 * F, 2.8 * F, N.VIVO);
      g.traco(1.4 * F, 1.6 * F, 8.8 * F, 1.6 * F, N.BRILHO, u);
      g.traco(1.4 * F, 4.2 * F, 8.8 * F, 4.2 * F, N.MEIO, u);
      g.traco(8.8 * F, 1.6 * F, 8.8 * F, 4.4 * F, N.MEIO, u);
      g.capsula(4.8 * F, 4.4 * F, 5.4 * F, 9.8 * F, 2 * F, N.MEIO);
      g.traco(4.2 * F, 4.8 * F, 4.8 * F, 9.4 * F, N.VIVO, u);
    },
    sobrevivencia(g, F, u) {                                // a fogueira
      /* As achas vão no tom VIVO e o vão entre elas é cavado: no escuro da
         árvore, acha desenhada no tom médio simplesmente não existe. */
      g.traco(1.2 * F, 9.6 * F, 9.8 * F, 7.4 * F, N.VIVO, 2.4 * u);
      g.traco(1.2 * F, 7.4 * F, 9.8 * F, 9.6 * F, N.MEIO, 2.4 * u);
      g.traco(1.2 * F, 9.6 * F, 9.8 * F, 7.4 * F, N.BRILHO, u);
      g.poly([[5.4 * F, .4 * F], [8.6 * F, 4 * F], [7.2 * F, 6.8 * F],
              [3.6 * F, 6.8 * F], [2.2 * F, 4 * F]], N.VIVO);
      g.poly([[5.4 * F, 2.6 * F], [7 * F, 4.6 * F], [5.4 * F, 6.4 * F], [3.8 * F, 4.6 * F]], N.BRILHO);
      g.traco(2.2 * F, 4 * F, 5.4 * F, .4 * F, N.BRILHO, u);
    },
    tatica(g, F, u) {                                       // a bandeira no mastro
      g.capsula(2.2 * F, 1 * F, 2.2 * F, 10 * F, 1.8 * F, N.MEIO);
      g.traco(1.6 * F, 1.4 * F, 1.6 * F, 9.6 * F, N.VIVO, u);
      g.poly([[3.2 * F, 1.4 * F], [9.6 * F, 3 * F], [3.2 * F, 4.6 * F]], N.VIVO);
      g.poly([[3.2 * F, 1.4 * F], [7.4 * F, 2.4 * F], [3.2 * F, 3 * F]], N.BRILHO);
      g.ponto(2.2 * F, 10 * F, 2.4 * u, N.MEIO);
    },
    tecnologia(g, F, u) {                                   // a engrenagem
      const c = 5.5 * F;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.traco(c + Math.cos(a) * 2.6 * F, c + Math.sin(a) * 2.6 * F,
                c + Math.cos(a) * 4.8 * F, c + Math.sin(a) * 4.8 * F, N.VIVO, 2.1 * u);
      }
      g.elipse(c, c, 3.5 * F, 3.5 * F, N.VIVO);
      g.anel(c, c, 3.5 * F, 3.5 * F, N.BRILHO, u, Math.PI * 1.02, Math.PI * 1.88);
      g.elipse(c, c, 1.6 * F, 1.6 * F, N.PRETO);
      g.anel(c, c, 1.6 * F, 1.6 * F, N.MEIO, u);
    },
    /* -------------------------------------------------------- SENSO */
    adestramento(g, F, u) {                                 // a pata
      g.elipse(5.5 * F, 7.8 * F, 3.8 * F, 2.9 * F, N.VIVO);
      g.elipse(5.3 * F, 7.2 * F, 2.6 * F, 1.8 * F, N.BRILHO);
      for (const [x, y, r] of [[1.7, 4.2, 1.5], [4.3, 2.2, 1.5], [7, 2.2, 1.5], [9.3, 4.2, 1.5]]) {
        g.elipse(x * F, y * F, r * F, (r + .3) * F, N.VIVO);
        g.ponto(x * F - .5 * F, y * F - .6 * F, 1.2 * u, N.BRILHO);
      }
      // O vão entre o coxim e cada dedo: sem ele a pata vira uma mancha.
      g.cavar(1.7 * F, 5.8 * F, 9.3 * F, 5.8 * F, 1.15 * u);
      g.cavar(3 * F, 1.6 * F, 3 * F, 5.4 * F, 1.15 * u);
      g.cavar(5.65 * F, 1 * F, 5.65 * F, 4.2 * F, 1.15 * u);
      g.cavar(8.2 * F, 1.6 * F, 8.2 * F, 5.4 * F, 1.15 * u);
    },
    artes(g, F, u) {                                        // o pincel
      g.capsula(9.4 * F, .8 * F, 5.4 * F, 5 * F, 2.4 * F, N.MEIO);   // o cabo
      g.traco(8.8 * F, 1 * F, 4.8 * F, 5 * F, N.VIVO, 1.1 * u);
      g.capsula(6.1 * F, 4.3 * F, 4.9 * F, 5.5 * F, 3.2 * F, N.BRILHO);  // a virola
      g.poly([[4.6 * F, 4.6 * F], [6.2 * F, 6.2 * F], [3.4 * F, 9.8 * F],
              [1.4 * F, 8 * F]], N.VIVO);                              // a ponta
      g.traco(4.6 * F, 4.6 * F, 1.8 * F, 7.8 * F, N.BRILHO, u);
      g.ponto(2.6 * F, 9.2 * F, 2 * u, N.MEIO);
      g.ponto(8.6 * F, 9 * F, 2.2 * u, N.VIVO);                        // o pingo
    },
    diplomacia(g, F, u) {                                   // dois elos presos
      /* Os dois elos se cruzam de verdade: o da frente cava o de trás onde
         passa por cima. Sem a cava, os dois viram uma nuvem só. */
      g.anel(7.4 * F, 5.5 * F, 2.9 * F, 3.4 * F, N.MEIO, 2.2 * u);
      g.anel(7.4 * F, 5.5 * F, 2.9 * F, 3.4 * F, N.VIVO, 1.1 * u);
      g.cavar(4.4 * F, 5.5 * F, 6 * F, 5.5 * F, 4.4 * u);
      g.anel(3.6 * F, 5.5 * F, 2.9 * F, 3.4 * F, N.VIVO, 2.2 * u);
      g.anel(3.6 * F, 5.5 * F, 2.9 * F, 3.4 * F, N.BRILHO, u, Math.PI * 1.02, Math.PI * 1.78);
    },
    enganacao(g, F, u) {                                    // a máscara torta
      g.poly([[5.5 * F, 1 * F], [9.6 * F, 3 * F], [8.4 * F, 8.4 * F],
              [5.5 * F, 10.2 * F], [2.6 * F, 8.4 * F], [1.4 * F, 3 * F]], N.VIVO);
      g.traco(1.4 * F, 3 * F, 5.5 * F, 1 * F, N.BRILHO, 1.2 * u);
      g.poly([[2.8 * F, 4 * F], [4.8 * F, 3.4 * F], [4.6 * F, 5 * F], [3 * F, 5.2 * F]], N.PRETO);
      g.poly([[6.4 * F, 3.4 * F], [8.4 * F, 4.2 * F], [8 * F, 5.4 * F], [6.4 * F, 5 * F]], N.PRETO);
      g.traco(3.6 * F, 7.6 * F, 7.6 * F, 6.8 * F, N.PRETO, 1.3 * u);
    },
    intimidacao(g, F, u) {                                  // os dentes
      g.anel(5.5 * F, 4.6 * F, 4.2 * F, 4 * F, N.VIVO, 1.8 * u, .1, Math.PI - .1);
      g.rect(1.6 * F, 4.2 * F, 7.8 * F, 1.4 * F, N.VIVO);
      for (let i = 0; i < 5; i++) {
        const x = (2.2 + i * 1.75) * F;
        g.poly([[x, 5.4 * F], [x + 1.3 * F, 5.4 * F], [x + .65 * F, 8.4 * F]], N.BRILHO);
      }
      g.traco(1.6 * F, 4.2 * F, 9.4 * F, 4.2 * F, N.BRILHO, u);
    },
    intuicao(g, F, u) {                                     // a espiral
      const c = 5.5 * F;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60 * Math.PI * 3.4, r = (.5 + i / 60 * 4.2) * F;
        g.ponto(c + Math.cos(t) * r, c + Math.sin(t) * r, (1.5 - i / 60 * .4) * u,
                i > 44 ? N.BRILHO : i > 18 ? N.VIVO : N.MEIO);
      }
    },
    religiao(g, F, u) {                                     // o cálice
      g.anel(5.5 * F, 2.8 * F, 3.6 * F, 3.4 * F, N.VIVO, 1.9 * u, 0, Math.PI);
      g.traco(1.9 * F, 2.8 * F, 9.1 * F, 2.8 * F, N.BRILHO, 1.3 * u);
      g.capsula(5.5 * F, 6.2 * F, 5.5 * F, 8.6 * F, 1.6 * F, N.MEIO);
      g.rect(3 * F, 8.8 * F, 5 * F, 1.4 * F, N.VIVO);
      g.traco(3 * F, 8.8 * F, 8 * F, 8.8 * F, N.BRILHO, u);
    },
    vontade(g, F, u) {                                      // a chama
      g.poly([[5.5 * F, .6 * F], [8.6 * F, 5 * F], [7.4 * F, 9 * F],
              [3.6 * F, 9 * F], [2.4 * F, 5 * F]], N.VIVO);
      g.poly([[5.5 * F, 3.4 * F], [7 * F, 6 * F], [5.5 * F, 8.6 * F], [4 * F, 6 * F]], N.BRILHO);
      g.traco(2.4 * F, 5 * F, 5.5 * F, .6 * F, N.BRILHO, u);
      g.ponto(5.5 * F, 10 * F, 1.7 * u, N.MEIO);
    },
    /* --------------------------------------------------- SUBSTÂNCIA */
    acrobacia(g, F, u) {                                    // o salto
      g.anel(5.5 * F, 8.4 * F, 4.4 * F, 5.4 * F, N.VIVO, 1.8 * u, Math.PI * 1.06, Math.PI * 1.94);
      g.anel(5.5 * F, 8.4 * F, 4.4 * F, 5.4 * F, N.BRILHO, u, Math.PI * 1.1, Math.PI * 1.5);
      g.ponto(1.4 * F, 8.6 * F, 2.4 * u, N.MEIO);
      g.ponto(9.6 * F, 8.6 * F, 2.4 * u, N.MEIO);
      g.ponto(5.5 * F, 2.6 * F, 2.2 * u, N.BRILHO);
    },
    crime(g, F, u) {                                        // a gazua
      g.capsula(7.6 * F, 1.6 * F, 3.4 * F, 7 * F, 1.8 * F, N.VIVO);
      g.traco(7.2 * F, 1.8 * F, 3 * F, 6.8 * F, N.BRILHO, u);
      g.anel(2.8 * F, 8.4 * F, 2.2 * F, 2.2 * F, N.VIVO, 1.7 * u);
      g.traco(6.4 * F, 3.2 * F, 8.6 * F, 3.6 * F, N.MEIO, 1.4 * u);
      g.traco(5.4 * F, 4.6 * F, 7.4 * F, 5 * F, N.MEIO, 1.4 * u);
    },
    furtividade(g, F, u) {                                  // a pegada
      g.elipse(5.2 * F, 7.8 * F, 3 * F, 3 * F, N.VIVO);
      g.elipse(5 * F, 7.2 * F, 2.1 * F, 2.1 * F, N.BRILHO);
      for (const [x, y] of [[2.6, 2.4], [5.4, 1.5], [8.2, 2.6]]) {
        g.elipse(x * F, y * F, 1.5 * F, 1.5 * F, N.VIVO);
        g.ponto(x * F - .5 * F, y * F - .6 * F, 1.2 * u, N.BRILHO);
      }
      // O vão entre os dedos e a sola. Cuidado: cavar alto demais corta a
      // sola e a pegada vira caco — a linha passa RENTE, nunca por dentro.
      g.cavar(.6 * F, 4.4 * F, 10.4 * F, 4.4 * F, 1.2 * u);
      g.cavar(4 * F, .8 * F, 4 * F, 4 * F, 1.2 * u);
      g.cavar(6.8 * F, .8 * F, 6.8 * F, 4 * F, 1.2 * u);
    },
    iniciativa(g, F, u) {                                   // a ampulheta
      g.poly([[1.8 * F, 1.2 * F], [9.2 * F, 1.2 * F], [5.5 * F, 5.5 * F]], N.VIVO);
      g.poly([[5.5 * F, 5.5 * F], [9.2 * F, 9.8 * F], [1.8 * F, 9.8 * F]], N.MEIO);
      g.poly([[5.5 * F, 6.6 * F], [8.2 * F, 9.4 * F], [2.8 * F, 9.4 * F]], N.BRILHO);
      g.traco(1.4 * F, 1.2 * F, 9.6 * F, 1.2 * F, N.BRILHO, 1.4 * u);
      g.traco(1.4 * F, 9.8 * F, 9.6 * F, 9.8 * F, N.VIVO, 1.4 * u);
    },
    pilotagem(g, F, u) {                                    // o volante
      const c = 5.5 * F;
      g.anel(c, c, 4.4 * F, 4.4 * F, N.VIVO, 2 * u);
      g.anel(c, c, 4.4 * F, 4.4 * F, N.BRILHO, u, Math.PI * 1.02, Math.PI * 1.7);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
        g.traco(c, c, c + Math.cos(a) * 4 * F, c + Math.sin(a) * 4 * F, N.MEIO, 1.7 * u);
      }
      g.elipse(c, c, 1.8 * F, 1.8 * F, N.VIVO);
      g.ponto(c - .6 * F, c - .6 * F, 1.2 * u, N.BRILHO);
    },
    pontaria(g, F, u) {                                     // o alvo
      const c = 5.5 * F;
      g.anel(c, c, 4.4 * F, 4.4 * F, N.VIVO, 1.6 * u);
      g.anel(c, c, 2.6 * F, 2.6 * F, N.MEIO, 1.4 * u);
      g.elipse(c, c, 1.1 * F, 1.1 * F, N.BRILHO);
      g.traco(c, .4 * F, c, 2 * F, N.VIVO, 1.3 * u);
      g.traco(c, 9 * F, c, 10.6 * F, N.VIVO, 1.3 * u);
      g.traco(.4 * F, c, 2 * F, c, N.VIVO, 1.3 * u);
      g.traco(9 * F, c, 10.6 * F, c, N.VIVO, 1.3 * u);
    },
    reflexos(g, F, u) {                                     // o raio
      g.poly([[6.6 * F, .8 * F], [9 * F, .8 * F], [6 * F, 4.6 * F],
              [8.4 * F, 4.6 * F], [3.4 * F, 10.2 * F], [4.8 * F, 6 * F],
              [2.4 * F, 6 * F]], N.VIVO);
      g.traco(6.6 * F, .8 * F, 3.6 * F, 5 * F, N.BRILHO, u);
      g.traco(9 * F, .8 * F, 6.2 * F, 4.4 * F, N.MEIO, u);
    },
    /* ------------------------------------------------------ MÁQUINA */
    atletismo(g, F, u) {                                    // o haltere
      g.rect(1 * F, 3.4 * F, 2.2 * F, 4.4 * F, N.VIVO);
      g.rect(7.8 * F, 3.4 * F, 2.2 * F, 4.4 * F, N.VIVO);
      g.rect(2.8 * F, 2.4 * F, 1.8 * F, 6.4 * F, N.MEIO);
      g.rect(6.4 * F, 2.4 * F, 1.8 * F, 6.4 * F, N.MEIO);
      g.rect(4.4 * F, 4.6 * F, 2.4 * F, 2 * F, N.VIVO);
      g.traco(1 * F, 3.4 * F, 10 * F, 3.4 * F, N.BRILHO, u);
      g.traco(4.4 * F, 4.6 * F, 6.8 * F, 4.6 * F, N.BRILHO, u);
    },
    fortitude(g, F, u) {                                    // o escudo
      g.poly([[5.5 * F, .8 * F], [9.6 * F, 2.4 * F], [8.8 * F, 7 * F],
              [5.5 * F, 10.2 * F], [2.2 * F, 7 * F], [1.4 * F, 2.4 * F]], N.VIVO);
      g.traco(1.4 * F, 2.4 * F, 5.5 * F, .8 * F, N.BRILHO, 1.3 * u);
      g.traco(5.5 * F, .8 * F, 9.6 * F, 2.4 * F, N.MEIO, 1.2 * u);
      g.traco(2.4 * F, 5 * F, 8.6 * F, 5 * F, N.MEIO, 1.5 * u);
      g.traco(5.5 * F, 2.2 * F, 5.5 * F, 9 * F, N.MEIO, 1.3 * u);
      g.ponto(3.6 * F, 3.2 * F, 1.5 * u, N.BRILHO);
    },
    luta(g, F, u) {                                         // o punho
      /* No tamanho de um glifo o punho da carta não cabe: aqui é a massa,
         UMA fileira de nós e o polegar. Três coisas, e nada mais. */
      g.poly([[1.6 * F, 3.6 * F], [9.4 * F, 3.6 * F], [9.4 * F, 7.6 * F],
              [7.8 * F, 9.4 * F], [3.2 * F, 9.4 * F], [1.6 * F, 7.6 * F]], N.VIVO);
      for (let i = 0; i < 4; i++) {
        const x = (2.6 + i * 2.1) * F;
        g.elipse(x, 3.6 * F, 1.2 * F, 1.5 * F, N.VIVO);
        g.ponto(x - .4 * F, 2.8 * F, 1.3 * u, N.BRILHO);
      }
      for (let i = 0; i < 3; i++)
        g.cavar((3.65 + i * 2.1) * F, 1.8 * F, (3.65 + i * 2.1) * F, 5 * F, 1.2 * u);
      g.traco(1.8 * F, 6.2 * F, 9.2 * F, 6.2 * F, N.PRETO, 1.2 * u);
      g.traco(1.8 * F, 7.1 * F, 9.2 * F, 7.1 * F, N.BRILHO, u);
      g.poly([[1.2 * F, 6 * F], [4.6 * F, 5.2 * F], [5 * F, 7 * F], [1.6 * F, 8.2 * F]], N.MEIO);
      g.traco(1.2 * F, 6 * F, 4.6 * F, 5.2 * F, N.BRILHO, u);
    }
  };
  /* Um glifo, desenhado em 3× e guardado. */
  function glifo(p, atr) {
    return pintar(`arv:glifo:${p}`, G, G, paletaDe(atr), q => {
      // O desenho é pensado numa grade de 11 e cresce para a de 15: a
      // coordenada continua legível e `u` segue valendo UM pixel do
      // resultado, que é o que não pode variar com o tamanho.
      q.colar(emAlta(G, G, paletaDe(atr), 3,
        (g, F) => (GLIFOS[p] || GLIFOS.ocultismo)(g, F * G / 11, F), .94), 0, 0);
      q.limpar();
    });
  }

  /* As três paletas de estado, todas dentro das nove cores da carta. */
  function tintaDo(estado) {
    if (estado === 'tomado') return {corpo: N.VIVO, luz: N.BRILHO, sombra: N.MEIO, talo: N.MEIO, vao: N.PRETO};
    if (estado === 'livre') return {corpo: N.MEIO, luz: N.VIVO, sombra: N.PRETO, talo: N.PRETO, vao: N.PRETO};
    /* TRANCADO É A MESMA COR, MAIS APAGADA — e não outra cor.
       A versão anterior pintava todo nódulo trancado com os magentas da
       moldura, iguais nos quatro naipes. Economizava sprite e custava duas
       coisas caras: a pessoa deixava de ver a que família aquilo pertence
       antes de comprar, e cento e trinta contornos magenta viravam o
       assunto da tela, porque quase tudo numa árvore está trancado.

       Com o tom do próprio naipe, os três estados viram uma escada de
       LUMINÂNCIA dentro da mesma cor — escuro, médio, aceso — que é o
       canal que sobrevive a qualquer daltonismo, e a árvore passa a
       mostrar o que você ainda pode vir a ser. */
    return {corpo: N.FUNDO, luz: N.MEIO, sombra: N.PRETO, talo: N.PRETO, vao: N.PRETO};
  }
  /* -------------------------------------------- O NÓDULO DE UMA PERÍCIA
     Ele É a arte da perícia, e não uma sementinha com a arte pendurada em
     cima. A versão anterior tinha as duas coisas — um broto na raia e o
     ícone da perícia numa boca separada — e era desenho repetido: duas
     marcas na tela para dizer a mesma palavra.

     Agora o glifo mora DENTRO do nódulo, e em volta dele há um ANEL DE
     TRÊS GATILHOS: um aceso no grau I, dois no II, três no III. O jogador
     lê a perícia e o quanto dela já é seu na mesma olhada, sem contar
     nada e sem texto nenhum.

     O ESTADO não muda o desenho: muda a PALETA. A paleta do naipe é
     deslocada um degrau para o escuro no que está livre e dois no que
     está trancado, e o glifo inteiro desce junto sem uma linha de código
     por glifo. É isso que deixa os vinte e oito ícones funcionarem nos
     quatro estados sem virar cento e doze desenhos à mão. */
  function paletaDoEstado(naipe, estado) {
    const P = paletaDe(naipe);
    const desce = estado === 'tomado' ? 0 : estado === 'livre' ? 1 : 2;
    if (!desce) return P;
    const tons = P.slice(6);
    const fora = [];
    for (let i = 0; i < 5; i++) fora.push(tons[Math.max(0, i - desce)]);
    return P.slice(0, 6).concat(fora);
  }
  const NOP = 19;
  function noduloPericia(p, naipe, nivel, estado) {
    const n = Math.max(1, Math.min(3, Math.round(nivel)));
    const pal = paletaDoEstado(naipe, estado);
    const m = NOP / 2, rG = 8.2;
    return pintar(`arv:per:${p}:${naipe}:${n}:${estado}`, NOP, NOP, pal, q => {
      // A CAMA. Escura e fechada, para o glifo não sentar na cor da
      // fatia: é o contorno que fabrica contraste em qualquer fundo.
      q.colar(emAlta(NOP, NOP, pal, 3, (g, F) => {
        g.elipse(m * F, m * F, 6.8 * F, 6.8 * F, N.PRETO);
        g.anel(m * F, m * F, 6.8 * F, 6.8 * F, N.FUNDO, 1.1 * F);
      }, .96), 0, 0);
      // O GLIFO, no tamanho em que foi desenhado, centrado na cama.
      q.colar(emAlta(G, G, pal, 3,
        (g, F) => (GLIFOS[p] || GLIFOS.ocultismo)(g, F * G / 11, F), .94),
        Math.round((NOP - G) / 2), Math.round((NOP - G) / 2));
      /* O ANEL DE TRÊS GATILHOS: um por grau, aceso quando é seu. Ele
         mora FORA do glifo — a primeira versão passava por cima dele e as
         duas coisas viravam uma mancha só. O vão entre os gatilhos é
         largo de propósito: a dezenove pixels, três arcos colados lêem
         como um círculo, e círculo não conta nada.

         É contagem, e não barra: numa escala de três degraus a pessoa vê
         quantos estão acesos sem medir nada, que é o que uma mesa de RPG
         precisa — e o que o número escrito custaria em pixel. */
      q.colar(emAlta(NOP, NOP, pal, 3, (g, F) => {
        for (let i = 0; i < 3; i++) {
          const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3 + .30;
          const a1 = a0 + Math.PI * 2 / 3 - .60;
          g.anel(m * F, m * F, rG * F, rG * F, N.PRETO, 3 * F, a0, a1);
          g.anel(m * F, m * F, rG * F, rG * F, i < n ? N.BRILHO : N.FUNDO, 1.5 * F, a0, a1);
        }
      }, .96), 0, 0);
      if (estado === 'barrado') {
        q.colar(emAlta(NOP, NOP, pal, 3, (g, F) => {
          g.traco(NOP * .22 * F, NOP * .78 * F, NOP * .78 * F, NOP * .22 * F, M.PRETO, 3 * F);
          g.traco(NOP * .22 * F, NOP * .78 * F, NOP * .78 * F, NOP * .22 * F, M.MEDIA, 1.2 * F);
        }, .96), 0, 0);
      }
      q.limpar();
    });
  }

  /* ------------------------------------------------- as formas dos tipos
     Oito tipos de nódulo, e a cor sozinha não aguenta oito categorias —
     na medida em que a marca encolhe, a diferença de matiz que a gente
     percebe cresce, e no eixo amarelo-azul chega a mais que o dobro. Por
     isso cada tipo é dito TRÊS vezes:

       · pela REGIÃO onde mora (posição é o canal mais forte que existe);
       · pela FAMÍLIA da forma, que é a leitura de longe — REDONDA para o
         que é treino e quantidade (broto, grau), ANGULAR para o que muda
         comportamento (marco, enxerto, milagre, vereda, chave, coroa);
       · pela silhueta, que é a leitura de perto.

     O tamanho anda em três degraus e só: 11 para o que é passagem, 13 para
     o que caracteriza, 16 para o que decide. Mais de três degraus de
     tamanho ninguém distingue, e tamanho é o pior canal de todos quando
     tem que carregar a informação principal — por isso ele carrega só
     IMPORTÂNCIA, nunca tipo.

     Desenho em silhueta fechada e contorno escuro de um pixel, porque o
     fundo da árvore varia (folha, galho, céu) e sem contorno o nódulo se
     funde em algum desses estados. */
  const FORMAS_TIPO = {
    /* BROTO · a semente. Redonda, pequena, sem talo: é passagem. */
    broto(g, F, S, c) {
      const m = S / 2, r = S * .34;
      g.elipse(m * F, m * F, r * F, r * F, c.corpo);
      g.anel(m * F, m * F, r * F, r * F, c.sombra, 1.1 * F, .2, Math.PI - .2);
      g.anel(m * F, m * F, r * F, r * F, c.luz, F, Math.PI * 1.08, Math.PI * 1.66);
      g.ponto((m - r * .3) * F, (m - r * .35) * F, 1.2 * F, c.luz);
    },
    /* MARCO · o losango. Primeira forma angular: aqui a árvore para de
       contar treino e começa a dizer quem o personagem é. */
    marco(g, F, S, c) {
      const m = S / 2, r = S * .40;
      const pts = a => [[m, m - r], [m + r * a, m], [m, m + r], [m - r * a, m]]
        .map(([x, y]) => [x * F, y * F]);
      g.poly(pts(1), c.sombra);
      g.poly(pts(.82), c.corpo);
      g.traco((m - r * .7) * F, m * F, m * F, (m - r * .86) * F, c.luz, 1.3 * F);
      g.ponto(m * F, m * F, 1.6 * F, c.luz);
    },
    /* ENXERTO · o losango COM OUTRO GRUDADO NELE. Um losango grande — a
       coisa que já era sua — e um pequeno, mais claro, encaixado na
       lateral. Duas formas, e a leitura é imediata: alguma coisa foi
       acrescentada a alguma coisa.

       Duas versões antes desta falharam. Partir o losango em duas fatias
       diagonais virava rabisco a treze pixels; emendar as duas metades
       com um risco no meio virava dois triângulos soltos. O que lê é
       CONTRASTE DE TAMANHO entre duas peças inteiras. */
    enxerto(g, F, S, c) {
      const m = S / 2, r = S * .36, cx0 = m - r * .30, ex = m + r * .70;
      const lo = (x, y, k, w, cor) => g.poly(
        [[x, y - r * k], [x + r * w, y], [x, y + r * k], [x - r * w, y]]
          .map(([a, b]) => [a * F, b * F]), cor);
      lo(cx0, m, 1, .82, c.sombra);
      lo(cx0, m, .78, .60, c.corpo);
      g.traco((cx0 - r * .5) * F, (m - r * .2) * F, cx0 * F, (m - r * .74) * F, c.luz, 1.2 * F);
      lo(ex, m, .60, .48, c.sombra);
      lo(ex, m, .40, .30, c.luz);
    },
    /* MILAGRE · o hexágono com a hóstia dentro. Fechado por seis lados,
       que é a forma de uma coisa guardada. */
    milagre(g, F, S, c) {
      const m = S / 2, r = S * .44;
      const hex = k => {
        const p = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + i * Math.PI / 3;
          p.push([(m + Math.cos(a) * r * k) * F, (m + Math.sin(a) * r * k) * F]);
        }
        return p;
      };
      g.poly(hex(1), c.sombra);
      g.poly(hex(.78), c.corpo);
      g.elipse(m * F, m * F, S * .15 * F, S * .15 * F, c.luz);
      g.traco((m - r * .62) * F, (m - r * .3) * F, (m - r * .2) * F, (m - r * .66) * F, c.luz, 1.2 * F);
    },
    /* VEREDA · o PORTAL. Dois montantes e um arco, com um VÃO de verdade
       embaixo: é a única forma da carta que se atravessa, e é justamente
       o nódulo que abre um ramo inteiro.

       O vão é pintado no preto do naipe, e não cavado: cavar deixava
       lascas soltas na base quando o desenho grande era reduzido. */
    vereda(g, F, S, c) {
      const m = S / 2, w = S * .30, h = S * .40;
      const arco = (k, cor) => {
        g.elipse(m * F, (m - h * .30) * F, (w - k) * F, (w - k) * F, cor);
        g.rect((m - w + k) * F, (m - h * .30) * F, ((w - k) * 2) * F, (h * 1.30 - k) * F, cor);
      };
      arco(0, c.sombra);
      arco(1.1, c.corpo);
      const v = w - 3;
      g.elipse(m * F, (m - h * .24) * F, v * F, v * F, c.vao);
      g.rect((m - v) * F, (m - h * .24) * F, (v * 2) * F, (h * 1.3) * F, c.vao);
      g.anel(m * F, (m - h * .24) * F, v * F, v * F, c.sombra, 1.1 * F, Math.PI, Math.PI * 2);
      // A luz no montante da esquerda e no alto do arco.
      g.anel(m * F, (m - h * .30) * F, (w - .6) * F, (w - .6) * F, c.luz, 1.1 * F,
        Math.PI * 1.04, Math.PI * 1.64);
      g.traco((m - w + 1) * F, (m - h * .2) * F, (m - w + 1) * F, (m + h * .9) * F, c.luz, F);
      // A soleira, que é o que faz o portal pousar em vez de flutuar.
      g.traco((m - w - 1) * F, (m + h) * F, (m + w + 1) * F, (m + h) * F, c.sombra, 1.8 * F);
      g.traco((m - w - 1) * F, (m + h - .8) * F, (m + w + 1) * F, (m + h - .8) * F, c.luz, F);
    },
    /* CHAVE · o anel partido. A falha no anel é a regra que ela quebra, e
       a lasca do lado é o preço. Maior nódulo da árvore junto com a coroa,
       porque chegar numa é uma declaração e não um acidente. */
    chave(g, F, S, c) {
      const m = S / 2, r = S * .42;
      g.anel(m * F, m * F, r * F, r * F, c.sombra, 3.2 * F, Math.PI * .22, Math.PI * 1.78);
      g.anel(m * F, m * F, r * F, r * F, c.corpo, 2 * F, Math.PI * .26, Math.PI * 1.74);
      g.anel(m * F, m * F, r * F, r * F, c.luz, 1.1 * F, Math.PI * 1.06, Math.PI * 1.62);
      // a lasca que saiu do anel, caída embaixo do vão
      g.poly([[m - r * .5, m + r * .68], [m + r * .16, m + r * 1.04], [m - r * .14, m + r * 1.2]]
        .map(([x, y]) => [x * F, y * F]), c.corpo);
      g.ponto(m * F, m * F, 2 * F, c.sombra);
      g.ponto(m * F, m * F, 1.2 * F, c.luz);
    },
    /* COROA · os raios. Fim de caminho: a única forma que aponta para
       fora em todas as direções. */
    coroa(g, F, S, c) {
      const m = S / 2, r = S * .46;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.traco((m + Math.cos(a) * r * .38) * F, (m + Math.sin(a) * r * .38) * F,
          (m + Math.cos(a) * r) * F, (m + Math.sin(a) * r) * F, c.sombra, 2.4 * F);
      }
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, k = i % 2 ? .78 : 1;
        g.traco((m + Math.cos(a) * r * .4) * F, (m + Math.sin(a) * r * .4) * F,
          (m + Math.cos(a) * r * k) * F, (m + Math.sin(a) * r * k) * F, c.corpo, 1.3 * F);
      }
      g.elipse(m * F, m * F, r * .46 * F, r * .46 * F, c.sombra);
      g.elipse(m * F, m * F, r * .32 * F, r * .32 * F, c.corpo);
      g.ponto((m - r * .14) * F, (m - r * .16) * F, 1.4 * F, c.luz);
    }
  };

  /* Quatro estados, e o quarto é novo: BARRADO, que é o nódulo fechado
     pela chave oposta. Ele não é igual a trancado — trancado ainda pode
     vir a ser seu, barrado só volta se você devolver a outra chave — e
     por isso ganha a tranca desenhada por cima. */
  function noduloDe(tipo, atr, estado) {
    const T = (root.FichaGrafo && root.FichaGrafo.TIPO[tipo]) || {lado: 11};
    const S = T.lado, box = S + 6;
    const naipe = estado === 'trancado' || estado === 'barrado' ? 'moldura' : atr;
    return pintar(`arv:tp:${tipo}:${atr}:${estado}`, box, box, paletaDe(atr), q => {
      const c = tintaDo(estado === 'barrado' ? 'trancado' : estado);
      q.colar(emAlta(box, box, paletaDe(atr), 3, (g, F) => {
        const desenha = FORMAS_TIPO[tipo] || FORMAS_TIPO.broto;
        desenha(g, F, box, c);
        if (estado === 'barrado') {
          /* A tranca é uma barra na diagonal, e ela é desenhada em escuro
             POR CIMA da forma inteira: a pessoa tem que continuar vendo o
             que está perdendo, senão a escolha não dói. */
          /* A tranca é um risco FINO na diagonal. Grosso, ela virava o
             assunto do desenho e a pessoa deixava de ver o que estava
             perdendo — e é justamente isso que a escolha precisa doer. */
          g.traco(box * .26 * F, box * .74 * F, box * .74 * F, box * .26 * F, M.PRETO, 2.6 * F);
          g.traco(box * .26 * F, box * .74 * F, box * .74 * F, box * .26 * F, M.MEDIA, 1.1 * F);
        }
      }, .96), 0, 0);
      q.limpar();
    });
  }
  const ladoDoTipo = tipo =>
    ((root.FichaGrafo && root.FichaGrafo.TIPO[tipo]) || {lado: 11}).lado;

  /* ------------------------------------------------------------- a carta
     O FUNDO. Não é uma árvore desenhada, e a versão que era ensinou por
     quê: folha e galho competiam com os nódulos pelo mesmo espaço, e o
     que a pessoa precisa ver numa tela de progressão é o que está ligado
     a quê. Aqui o fundo é campo escuro, fatia e anel — ele diz ONDE se
     está e sai da frente.

     A hierarquia de separação entre fatias vai do mais barato ao mais
     caro, e para de subir assim que basta: primeiro o VÃO angular, que é
     espaço e não custa tinta; depois a CUNHA tingida, um ou dois valores
     acima do fundo, que já aciona região comum; e a LINHA de um pixel na
     costura por último, só onde duas famílias se encostam. */
  function tracoCurvo(g, F, ponto, e0, e1, cor, passos) {
    for (let i = 0; i <= passos; i++) {
      const t = i / passos, q = ponto(t);
      g.ponto(q.x * F, q.y * F, (e0 + (e1 - e0) * t) * F, cor);
    }
  }
  const reta = (a, b) => t => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});

  /* O miolo: o centro de onde tudo sai, com os anéis-guia. É o marco de
     orientação da carta — de perto, sem uma referência fixa em quadro, a
     pessoa se perde entre nódulos iguais. */
  function fundoDe(L) {
    const pal = paletaDe('osso');
    const C = L.centro;
    return emAlta(L.larg, L.alto, pal, 2, (g, F) => {
      const u = F;
      // Os anéis-guia, fininhos: eles dizem que a distância é degrau, e
      // não continuidade. Quem lê a carta aprende que fora é mais caro.
      for (const r of [L.aneis[0], L.aneis[1], L.aneis[2], L.rCoroa]) {
        for (let i = 0; i < 220; i++) {
          if (i % 3) continue;                       // pontilhado, não linha
          const a = i / 220 * Math.PI * 2;
          g.ponto((C.x + Math.cos(a) * L.rx * r) * F, (C.y + Math.sin(a) * L.ry * r) * F,
            1.2 * u, N.PRETO);
        }
      }
      // As costuras: uma linha por emenda, do miolo até fora. Só aqui,
      // porque é só aqui que duas famílias se encostam.
      for (const c of L.costuras) {
        const a = {x: C.x + Math.cos(c.ang) * L.rx * .12, y: C.y + Math.sin(c.ang) * L.ry * .12};
        const b = {x: C.x + Math.cos(c.ang) * L.rx * (L.rBorda + .08), y: C.y + Math.sin(c.ang) * L.ry * (L.rBorda + .08)};
        tracoCurvo(g, F, reta(a, b), 1.2, 1.2, N.PRETO, 90);
        tracoCurvo(g, F, reta(a, b), .8, .8, N.FUNDO, 90);
      }
      /* O MIOLO é a órbita, e só. O olho que mora nela é desenhado ao
         vivo pela tela, porque ele pisca e olha para onde o cursor está —
         coisa que não cabe numa camada guardada. */
      g.elipse(C.x * F, C.y * F, 40 * F, 30 * F, N.PRETO);
      g.anel(C.x * F, C.y * F, 39 * F, 29 * F, N.FUNDO, 1.6 * u);
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        g.traco((C.x + Math.cos(a) * 31) * F, (C.y + Math.sin(a) * 22) * F,
          (C.x + Math.cos(a) * 39) * F, (C.y + Math.sin(a) * 29) * F, N.PRETO, 2.2 * u);
        g.traco((C.x + Math.cos(a) * 32) * F, (C.y + Math.sin(a) * 23) * F,
          (C.x + Math.cos(a) * 38) * F, (C.y + Math.sin(a) * 28) * F, N.FUNDO, 1.2 * u);
      }
    }, 1);
  }

  /* Uma fatia: a cunha tingida, a boca de cada raia e o halo de cada
     nódulo daquela família. */
  /* O NAIPE DE UM ARQUÉTIPO. Os quatro que se treinam se chamam como o
     atributo deles, e o nome cai de pé como naipe. DOLORA e AMAZONA não:
     perícia nenhuma as alcança, e por isso têm naipe próprio — `dol` e
     `ama`. Sem esta conta a paleta caía no padrão quando o nome não era
     de naipe, e as duas saíam pintadas de ÁGUA, com a mesma cor de AERUS
     no outro lado da roda: três fatias, uma cor só, e a região deixava de
     dizer região. */
  const naipeDaRegiao = reg => {
    const R = root.FichaGrafo && root.FichaGrafo.REGIAO[reg];
    return (R && R.naipe) || reg;
  };
  function setorDe(L, atr) {
    const pal = paletaDe(naipeDaRegiao(atr));
    const S = L.doSetor(atr);
    const C = L.centro;
    return emAlta(L.larg, L.alto, pal, 2, (g, F) => {
      const u = F;
      if (!S) return;
      /* A CUNHA. Um tom só, o mais escuro do naipe, e mesmo assim ela é o
         canal mais forte da carta: região comum sobrepõe proximidade e
         cor. A borda de fora ganha um degrau a mais para a fatia ter
         contorno sem precisar de linha. */
      const passos = Math.max(12, Math.round(S.abertura * 60));
      for (let i = 0; i <= passos; i++) {
        const a = S.a0 + S.abertura * (i / passos);
        const x0 = C.x + Math.cos(a) * L.rx * .10, y0 = C.y + Math.sin(a) * L.ry * .11;
        const x1 = C.x + Math.cos(a) * L.rx * L.rBorda, y1 = C.y + Math.sin(a) * L.ry * L.rBorda;
        g.traco(x0 * F, y0 * F, x1 * F, y1 * F, N.PRETO, 5 * u);
      }
      /* A FAIXA DA BORDA. Um degrau a mais de tom nos últimos vinte por
         cento do raio, que é onde moram o marco, a coroa e a placa. Com a
         cunha inteira num tom só a fatia sumia no fundo; com a faixa, a
         família ganha um contorno de verdade sem custar uma linha. */
      for (let i = 0; i <= passos * 2; i++) {
        const a = S.a0 + S.abertura * (i / (passos * 2));
        const x0 = C.x + Math.cos(a) * L.rx * 1.10, y0 = C.y + Math.sin(a) * L.ry * 1.10;
        const x1 = C.x + Math.cos(a) * L.rx * L.rBorda, y1 = C.y + Math.sin(a) * L.ry * L.rBorda;
        g.traco(x0 * F, y0 * F, x1 * F, y1 * F, N.MEIO, 3 * u);
      }
      for (let i = 0; i <= passos * 2; i++) {
        const a = S.a0 + S.abertura * (i / (passos * 2));
        g.ponto((C.x + Math.cos(a) * L.rx * L.rBorda) * F, (C.y + Math.sin(a) * L.ry * L.rBorda) * F,
          1.8 * u, N.VIVO);
      }
      /* A RAIA de cada perícia: um fio do miolo até o último grau. Ele
         não é enfeite — é o que faz I, II e III lerem como uma corrente
         em vez de três pontos soltos na mesma direção. */
      for (const l of L.lanes) {
        if (l.atr !== atr) continue;
        const a = {x: C.x + Math.cos(l.ang) * L.rx * .40, y: C.y + Math.sin(l.ang) * L.ry * .40};
        const b = {x: C.x + Math.cos(l.ang) * L.rx * .96, y: C.y + Math.sin(l.ang) * L.ry * .96};
        tracoCurvo(g, F, reta(a, b), 1, 1, N.MEIO, 70);
      }
      /* O HALO PRETO de cada nódulo. O contorno escuro é o truque mais
         velho do ícone pequeno: ele fabrica contraste local seja qual for
         o fundo, e aqui o fundo varia entre cunha, raia e costura. */
      for (const q of L.nos.values()) {
        if (q.regiao !== atr) continue;
        g.elipse(q.x * F, q.y * F, (q.raio + 3.4) * F, (q.raio + 3.4) * F, N.PRETO);
      }
    }, 1);
  }

  /* As arestas: os fios que ligam um nódulo ao seguinte. Retas, de um
     pixel, e escuras.

     Retas de propósito: num estudo de seguir caminho em grafo, aresta
     reta acertou 84,5% e aresta muito curva 67,5%, com dois segundos a
     mais por tarefa. Aresta curva é bonita e custa leitura, e numa árvore
     de habilidade seguir o caminho É a tarefa.

     Estas ficam apagadas. A aresta ACESA — a do caminho que o personagem
     realmente comprou — é desenhada por cima, ao vivo, pela tela. */
  function arestasDe(L) {
    return emAlta(L.larg, L.alto, paletaDe('osso'), 2, (g, F) => {
      for (const e of L.arestas) {
        if (e.implicita) continue;
        const a = L.nos.get(e.de), b = L.nos.get(e.para);
        if (!a || !b) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
        const x0 = a.x + ux * (a.raio + 1), y0 = a.y + uy * (a.raio + 1);
        const x1 = b.x - ux * (b.raio + 1), y1 = b.y - uy * (b.raio + 1);
        g.traco(x0 * F, y0 * F, x1 * F, y1 * F, N.PRETO, 3.4 * F);
        g.traco(x0 * F, y0 * F, x1 * F, y1 * F, N.FUNDO, 1.2 * F);
      }
    }, 1);
  }

  /* ------------------------------------------------------------- O ARCANO
     Cada Arquétipo ganha uma CARTA em miniatura na coluna do lado: a mesma
     moldura magenta das cartas de atributo, o campo no naipe da família e
     o numeral romano em cima. É o que faz a coluna deixar de ser uma lista
     de texto e virar um baralho de seis — e é assim que a pessoa aprende
     que os seis são uma coisa só antes de ler qualquer palavra. */
  const ARCANO = {w: 20, h: 28};
  const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  function arcano(naipe, n, aceso) {
    const {w, h} = ARCANO;
    return pintar(`arv:arc:${naipe}:${n}:${aceso ? 1 : 0}`, w, h, paletaDe(naipe), p => {
      // A moldura, nos mesmos três degraus de magenta da carta de verdade.
      p.rect(0, 0, w, h, M.PRETO);
      p.rect(1, 1, w - 2, h - 2, aceso ? M.VIVA : M.ESCURA);
      p.rect(2, 2, w - 4, h - 4, M.PRETO);
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) p.apagar(x, y);
      // O campo, no naipe da família.
      p.rect(3, 7, w - 6, h - 11, N.PRETO);
      p.rect(4, 8, w - 8, h - 13, N.FUNDO);
      p.dither(4, 8 + Math.floor((h - 13) / 2), w - 8, Math.ceil((h - 13) / 2), N.MEIO, .45);
      if (aceso) {
        p.rect(4, 8, w - 8, 2, N.VIVO);
        p.rect(4, h - 7, w - 8, 2, N.MEIO);
      }
      // A faixa de cima com o numeral, como numa carta de tarô.
      p.rect(3, 2, w - 6, 5, aceso ? M.MEDIA : M.QUASE);
      textoPx(p, ROMANO[n] || '?', w / 2, 3, aceso ? M.LUZ : M.ESCURA, 'center');
      p.limpar();
    });
  }

  /* --------------------------------------------------------------- O OLHO
     O miolo da carta é um olho, e ele é o único desenho da tela que está
     VIVO: pisca sozinho e vira a pupila para o nódulo que está sob o
     cursor. Não é enfeite — é o que diz onde o cursor está sem escrever
     nada, e é a marca do baralho no meio do baralho.

     Desenhado na língua das cartas: a amêndoa em três degraus de magenta
     da moldura, exatamente como no verso da carta, e a íris nos tons vivos
     do mesmo magenta. Ele pertence à mesma coisa que as cartas de
     atributo, e é por isso que a carta inteira parece uma coisa só.

     São três sprites guardados por quadro, e não um: a órbita (que pisca),
     a íris (que gira e dilata) e o reflexo. A tela compõe os três com a
     íris DESLOCADA e recortada pela amêndoa — é isso que faz o olho olhar
     em vez de só existir. */
  const OLHO = {w: 64, h: 40, iris: 26, larg: 30, alto: 12.4};
  const TAU = Math.PI * 2;
  /* A PISCADA. Ela não anda no ciclo de dezesseis quadros da carta: anda
     no relógio, uma vez a cada quatro segundos e meio, e dura um sexto de
     segundo. Piscada no compasso da animação lê como pisca-pisca; piscada
     rara e rápida lê como bicho. São cinco níveis de abertura guardados,
     e não dezesseis quadros — o olho aberto é um sprite só, e é o que
     está na tela 96% do tempo. */
  const ABERTURAS = [1, .72, .44, .2, .04];
  function nivelDaPiscada(t) {
    const fase = ((t % 4.5) + 4.5) % 4.5;
    const d = fase - 4.34;
    if (d < 0 || d > .16) return 0;
    const v = 1 - Math.abs(d / .16 - .5) * 2;
    return Math.min(4, Math.round(v * 4.6));
  }
  function abertura(n) { return ABERTURAS[Math.max(0, Math.min(4, n | 0))]; }

  /* A amêndoa: duas quadráticas que se encontram nos cantos. A abertura
     achata a de cima e a de baixo ao mesmo tempo, como pálpebra de gente. */
  function amendoa(cx0, cy0, larg, alt, a, so) {
    const N2 = 46, pts = [];
    const arco = (sinal, de, ate) => {
      for (let i = de; i <= ate; i++) {
        const t = i / N2, u = 1 - t;
        pts.push([cx0 - larg + t * larg * 2, cy0 + sinal * (2 * u * t * alt * 1.36) * a]);
      }
    };
    if (so !== 'baixo') arco(-1, 0, N2);
    if (so === 'cima') return pts;
    if (so === 'baixo') { arco(1, 0, N2); return pts; }
    for (let i = N2; i >= 0; i--) {
      const t = i / N2, u = 1 - t;
      pts.push([cx0 - larg + t * larg * 2, cy0 + (2 * u * t * alt * 1.36) * a]);
    }
    return pts;
  }
  const fio = (g, F, pts, cor, esp) => {
    for (let i = 1; i < pts.length; i++)
      g.traco(pts[i - 1][0] * F, pts[i - 1][1] * F, pts[i][0] * F, pts[i][1] * F, cor, esp * F);
  };

  function olhoOrbita(nivel) {
    return pintar(`arv:olho:${nivel}`, OLHO.w, OLHO.h, paletaDe('tmg'), p => {
      p.colar(emAlta(OLHO.w, OLHO.h, paletaDe('tmg'), 3, (g, F) => {
        const cx0 = OLHO.w / 2, cy0 = OLHO.h / 2;
        const a = abertura(nivel), L = OLHO.larg, H = OLHO.alto;
        const esc = v => v.map(([x, y]) => [x * F, y * F]);
        if (a < .22) {
          /* FECHADO. Amêndoa achatada vira tracinho picotado, e tracinho
             picotado não lê como olho fechado — lê como erro. Fechado é
             desenhado à parte: uma linha grossa com a sombra embaixo. */
          const linha = amendoa(cx0, cy0, L, H, Math.max(.06, a), 'baixo');
          fio(g, F, linha, M.PRETO, 3.4);
          fio(g, F, linha, M.VIVA, 1.8);
          fio(g, F, linha.map(([x, y]) => [x, y + 1.6]), M.ESCURA, 1.2);
          return;
        }
        /* 1. A ESCLERA. Não é branca — é o magenta escuro da moldura. Num
              jogo em que o céu tem fome, olho branco seria o único pixel
              simpático da tela. Mas ela é claramente MAIS CLARA que o
              breu em volta, senão a íris flutua no vazio. */
        /* A ESCLERA fica UM degrau abaixo da íris, e não no mesmo. Tentei
           com o meio-tom e a íris sumiu dentro dela: sobrava um anel preto
           e um ponto preto, que é desenho de botão e não de olho. A escada
           é: contorno preto, sombra da pálpebra no quase-preto, esclera no
           escuro, íris no vivo, fibra e pálpebra na luz. */
        g.poly(esc(amendoa(cx0, cy0, L, H, a)), M.ESCURA);
        /* 2. A SOMBRA DA PÁLPEBRA, por cima da esclera e só na metade de
              cima. É ela que dá volume: sem essa faixa o olho fica com
              cara de adesivo. */
        g.poly(esc(amendoa(cx0, cy0 - H * a * .62, L * .86, H * a * .44, 1)), M.QUASE);
        /* 2b. E a luz que bate no fundo do olho, pelo lado de baixo. Sem
               ela a esclera é uma mancha chapada e o olho não tem dentro. */
        fio(g, F, amendoa(cx0, cy0 - 1.2, L - 3.4, H - 1.6, a, 'baixo'), M.MEDIA, 1.5);
        if (a > .5) fio(g, F, amendoa(cx0, cy0 - 2.6, L - 7, H - 3, a, 'baixo'), M.MEDIA, 1.1);
        /* 3. O CONTORNO, escuro e fechado. */
        fio(g, F, amendoa(cx0, cy0, L, H, a), M.PRETO, 2);
        /* 4. A LINHA DA PÁLPEBRA DE CIMA, clara e mais grossa no canto de
              fora — é o traço que faz um olho desenhado parecer olho. */
        const topo = amendoa(cx0, cy0 - .5, L - .4, H + .3, a, 'cima');
        fio(g, F, topo, M.LUZ, 1.7);
        fio(g, F, topo.slice(Math.floor(topo.length * .62)), M.LUZ, 2.6);
        /* 5. A de baixo, fina e mais apagada: pálpebra de baixo é sempre
              menos presente que a de cima. */
        fio(g, F, amendoa(cx0, cy0 + .4, L - 1.4, H - .6, a, 'baixo'), M.MEDIA, 1.2);
        /* 6. Os dois cantos: o lacrimal, gordo, e o de fora, em bico. */
        g.ponto((cx0 - L + 2.4) * F, cy0 * F, 2.6 * F, M.MEDIA);
        g.ponto((cx0 - L + 2.4) * F, cy0 * F, 1.3 * F, M.VIVA);
        g.traco((cx0 + L - 3) * F, cy0 * F, (cx0 + L + 1.4) * F, (cy0 - 1.2) * F, M.VIVA, 1.6 * F);
        /* 7. O molhado: um risco de luz no fundo do olho, embaixo e do
              lado de fora. É um pixel e meio, e é ele que tira o olho do
              lugar de desenho e põe no lugar de coisa viva. */
        if (a > .5) g.traco((cx0 + 3) * F, (cy0 + H * a * .72) * F,
          (cx0 + L * .58) * F, (cy0 + H * a * .5) * F, M.LUZ, 1.2 * F);
      }, .96), 0, 0);
      p.limpar();
    });
  }
  function olhoIris(q, quadros) {
    return pintar(`arv:iris:${q}`, OLHO.iris, OLHO.iris, paletaDe('tmg'), p => {
      p.colar(emAlta(OLHO.iris, OLHO.iris, paletaDe('tmg'), 3, (g, F) => {
        const m = OLHO.iris / 2, f = (((q % quadros) + quadros) % quadros) / quadros;
        const r = 10.6;
        g.elipse(m * F, m * F, r * F, r * F, M.PRETO);
        g.elipse(m * F, m * F, (r - 1.4) * F, (r - 1.4) * F, M.VIVA);
        /* AS FIBRAS. Vão no tom CLARO sobre o vivo, e não no escuro: a
           primeira versão usava escuro sobre médio e a íris virava um
           borrão roxo. Vinte fibras é o que cabe num raio de onze sem
           virar mingau, e elas giram devagar — mais que a pupila e mais
           que a piscada, é a fibra girando que faz o olho parecer vivo. */
        for (let i = 0; i < 20; i++) {
          const ang = i * TAU / 20 + f * TAU / 20;
          const dentro = 3.2 + (i % 3) * .6, fora2 = r - 1.8 - (i % 2) * .9;
          g.traco((m + Math.cos(ang) * dentro) * F, (m + Math.sin(ang) * dentro) * F,
            (m + Math.cos(ang) * fora2) * F, (m + Math.sin(ang) * fora2) * F,
            i % 2 ? M.LUZ : M.MEDIA, 1.2 * F);
        }
        /* O ANEL LÍMBICO, escuro, na borda da íris. É o detalhe que
           separa olho de bola de gude. */
        g.anel(m * F, m * F, (r - 1.5) * F, (r - 1.5) * F, M.PRETO, 1.4 * F);
        /* A pupila dilata e contrai. Ela é PEQUENA de propósito: a
           primeira versão tinha raio quatro e a íris virava uma rosquinha
           — num desenho de vinte e dois pixels, pupila grande come a
           única coisa que a íris tem para mostrar, que é a fibra. */
        const pup = 3.1 + Math.sin(f * TAU) * .7;
        g.elipse(m * F, m * F, pup * F, pup * F, M.PRETO);
        // Os dois reflexos, o grande em cima e o pequeno do lado oposto.
        g.elipse((m - 3.8) * F, (m - 4.2) * F, 2.6 * F, 2.2 * F, M.LUZ);
        g.ponto((m - 3.8) * F, (m - 4.2) * F, 1.2 * F, M.LUZ);
        g.ponto((m + 3.6) * F, (m + 4) * F, 1.5 * F, M.VIVA);
      }, .96), 0, 0);
      p.limpar();
    });
  }

  /* Compõe o olho na tela: órbita, íris recortada pela amêndoa e deslocada
     na direção de quem está sendo olhado. */
  function desenharOlho(ctx, x, y, z, t, olhar) {
    const nivel = nivelDaPiscada(t);
    const q = Math.floor(t * 5) % QUADROS;
    const orb = olhoOrbita(nivel), ir = olhoIris(q, QUADROS);
    const a = abertura(nivel);
    const ox = Math.round(x - OLHO.w * z / 2), oy = Math.round(y - OLHO.h * z / 2);
    ctx.drawImage(orb, ox, oy, OLHO.w * z, OLHO.h * z);
    if (a < .3) return;
    const dx = Math.max(-1, Math.min(1, (olhar && olhar.x) || 0));
    const dy = Math.max(-1, Math.min(1, (olhar && olhar.y) || 0));
    const px = Math.round(x + dx * 9.5 * z), py = Math.round(y + dy * 3.2 * z);
    ctx.save();
    /* O RECORTE tem que ter o tamanho da amêndoa, e não um palpite: com
       um recorte baixo demais a íris saía com o topo cortado reto, e olho
       com íris chapada em cima não é olho, é boca. */
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), (OLHO.larg - 3.5) * z,
      OLHO.alto * 1.28 * a * z, 0, 0, TAU);
    ctx.clip();
    ctx.drawImage(ir, Math.round(px - OLHO.iris * z / 2), Math.round(py - OLHO.iris * z / 2),
      OLHO.iris * z, OLHO.iris * z);
    ctx.restore();
  }

  /* A carta inteira, montada uma camada por quadro de tela: o fundo, uma
     fatia de cada vez, e as arestas por cima. São sete camadas; fazer as
     sete de uma vez daria meio segundo de engasgo na hora de abrir. */
  let cacheArv = null;
  function arvore(L) {
    if (!cacheArv) {
      const cv = root.document.createElement('canvas');
      cv.width = L.larg; cv.height = L.alto;
      cacheArv = {canvas: cv, ctx: cv.getContext('2d'), etapa: 0,
        ordem: ['fundo', ...L.setores.map(s => s.id), 'arestas']};
      cacheArv.ctx.imageSmoothingEnabled = false;
    }
    if (cacheArv.etapa < cacheArv.ordem.length) {
      const qual = cacheArv.ordem[cacheArv.etapa++];
      const camada = qual === 'fundo' ? fundoDe(L)
        : qual === 'arestas' ? arestasDe(L) : setorDe(L, qual);
      cacheArv.ctx.drawImage(camada.paraCanvas(), 0, 0);
    }
    return cacheArv.canvas;
  }
  const arvorePronta = () => !!cacheArv && cacheArv.etapa >= cacheArv.ordem.length;
  function esquecerArvore() { cacheArv = null; }

  const api = {GLIFOS, glifo, G, FORMAS_TIPO, noduloDe, ladoDoTipo,
    tintaDo, arvore, arvorePronta, esquecerArvore, desenharOlho, OLHO, abertura, nivelDaPiscada,
    noduloPericia, NOP, paletaDoEstado,
    arcano, ARCANO, ROMANO};
  root.FichaArvore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
