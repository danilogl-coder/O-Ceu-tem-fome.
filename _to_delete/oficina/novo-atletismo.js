  A.atletismo = g => {
    const cano = M.ceu, sol = M.porcelana, bor = M.grafite, cad = M.osso;
    /* As primeiras tentativas ficaram embaçadas, e a pesquisa nomeia a
       doença: "tantos detalhes que eles começam a se misturar". A receita
       é curta — MENOS detalhe e MAIS contraste, com cores que não sejam
       parecidas entre si. Então aqui são quatro coisas e não quinze:
       cabedal azul escuro com DUAS peças claras, entressola branca chata,
       sola escura numa tira, e a boca como um vão preto com três xis
       brancos dentro.

       As medidas vieram de tabela de modelagem e de ficha técnica de
       tênis real (Pegasus 41: 37 mm atrás, 27 mm na frente, 10 mm de
       drop, quatro ilhoses):
         · entressola em CUNHA — tira de espessura igual lê como sapato;
         · o bico descola do chão a partir de 65% do comprimento;
         · a linha de cima DESCE do calcanhar para o bico, e é esse degrau
           que diz "tênis";
         · três quartos RASO, que é o que abre a boca. De perfil a boca
           tem largura zero e os cadarços desabam numa coluna de
           pontinhos — era esse o defeito da versão original. */

    /* os traços de velocidade vão ATRÁS. Na versão anterior estavam na
       frente, que é o contrário de rastro. Espessura e espaçamento iguais
       = velocidade constante; só o comprimento varia. */
    for (const [x, y, n] of [[3,14,18],[5,19,13],[3,24,21],[7,29,10]]) {
      const f = forma(); f.ret(x, y, n, 1);
      chapa(g, f, mistura('#0b0a14', cano[4], .5));
    }

    /* A ENTRESSOLA: cunha branca, sete pixels no calcanhar e cinco na
       frente, canto de trás chanfrado e bico levantado do chão. UM tom. */
    const meia = forma();
    meia.pol([[9,40],[30,40],[46,39],[56,36],[60,38],[59,42],[48,45],[30,47],[12,47],[8,45]]);
    const S = peca(g, sol, t => { t.m.set(meia.m); }, {corte:'chato', base:5});
    dentro(g, S, sol[4], t => t.curva([10,45],[30,45],[58,40], 1));

    /* A SOLA: uma tira escura só, com o vão do arco no meio. A 53 pixels
       a garra tem menos de um pixel de altura, então ela vira VALOR e não
       relevo — e o vão é a pista mais clara de que aquilo é sola. */
    const gar = forma();
    gar.pol([[11,45],[24,46],[28,46],[27,49],[12,49],[9,46]]);
    gar.pol([[37,46],[48,45],[58,40],[60,42],[49,48],[37,48]]);
    peca(g, bor, t => { t.m.set(gar.m); }, {corte:'chato', base:1});
    dentro(g, gar, bor[3], t => { t.curva([11,45],[21,46],[28,46], 1); t.curva([37,46],[48,45],[58,40], 1); });
    for (const x of [40,44,48,52,56]) dentro(g, gar, bor[0], t => t.cam([[x,44],[x+1,48]], 1));
    for (const x of [15,20,24]) dentro(g, gar, bor[0], t => t.cam([[x,46],[x,49]], 1));

    /* O CABEDAL, numa peça só, num tom escuro só. */
    const cima = forma();
    cima.pol([
      [10,40],[9,32],[11,26],[16,24],[22,25],          /* calcanhar e gola */
      [27,28],[31,30],                                  /* o mergulho da gola */
      [37,31],[43,32],                                  /* boca e gáspea */
      [50,33],[56,35],[60,38],[56,36],[46,39],[30,40]
    ]);
    const C = peca(g, cano, t => { t.m.set(cima.m); }, {corte:'chato', base:2});
    dentro(g, C, cano[3], t => { t.curva([11,26],[22,26],[31,31], 1); t.curva([37,31],[49,32],[59,37], 1); });
    dentro(g, C, cano[0], t => t.curva([11,39],[30,39],[57,37], 1));

    /* DUAS peças claras e nada mais: contraforte atrás e gáspea na
       frente. Foram a terceira, a quarta e a quinta que embaçaram as
       tentativas anteriores. */
    dentro(g, C, cano[4], t => t.pol([[11,39],[10,31],[14,26],[18,26],[17,30],[15,39]]));
    dentro(g, C, cano[5], t => t.cam([[12,30],[15,27]], 1));
    dentro(g, C, cano[1], t => t.cam([[16,28],[18,38]], 1));
    dentro(g, C, cano[4], t => t.pol([[46,32],[54,34],[60,38],[57,38],[47,39],[44,35]]));
    dentro(g, C, cano[5], t => t.cam([[47,33],[55,36]], 1));
    dentro(g, C, cano[0], t => { t.curva([20,32],[31,34],[44,35], 1); t.cam([[44,35],[46,39]], 1); });
    /* a faixa da marca: UM pixel, e o único croma alto do ícone */
    dentro(g, C, M.ambar[4], t => t.curva([21,38],[33,37],[46,34], 1));
    dentro(g, C, M.ambar[2], t => t.curva([21,39],[33,38],[46,35], 1));

    /* A BOCA vista de três quartos: a linha de dentro recua para cima, e o
       vão escuro entre as duas é a abertura. Sem ela não há onde pôr
       cadarço. */
    dentro(g, C, '#080910', t => t.pol([[16,25],[23,26],[29,28],[35,30],[43,32],[41,34],[33,32],[27,30],[21,28],[17,27]]));
    dentro(g, C, cano[5], t => t.cam([[16,24],[23,25],[29,27],[35,29],[43,31]], 1));
    /* a língua, clara, no fundo da boca */
    dentro(g, C, cad[1], t => t.pol([[30,29],[37,31],[43,32],[42,34],[34,32]]));
    dentro(g, C, cad[3], t => t.cam([[31,30],[38,32]], 1));

    /* OS CADARÇOS. A regra que a versão de perfil quebrava: só aparece o
       pedaço que ATRAVESSA a boca. Chegando no ilhós, o cadarço entra no
       furo e some por baixo da aba até sair no de cima. Zigue-zague
       contínuo por cima da lateral lê como zíper, não como cadarço. */
    const perto = [[26,30],[31,31],[36,32],[41,33]];
    const longe = [[24,26],[29,27],[34,28],[39,29]];
    for (let k = 0; k < 4; k++)
      dentro(g, C, '#080910', t => { t.pt(perto[k][0], perto[k][1]); t.pt(longe[k][0], longe[k][1]); });
    for (let k = 0; k < 3; k++) {
      dentro(g, C, cad[2], t => { t.cam([[perto[k][0],perto[k][1]+1],[longe[k+1][0],longe[k+1][1]+1]], 1);
                                  t.cam([[longe[k][0],longe[k][1]+1],[perto[k+1][0],perto[k+1][1]+1]], 1); });
      dentro(g, C, '#fbf7ea', t => { t.cam([perto[k], longe[k+1]], 1); t.cam([longe[k], perto[k+1]], 1); });
    }
    /* o laço, com as pontas caindo para fora */
    dentro(g, C, '#fbf7ea', t => { t.curva([24,26],[20,21],[25,22], 2); t.curva([24,26],[29,22],[28,25], 2); });
    dentro(g, C, cad[2], t => { t.curva([24,27],[21,23],[24,23], 1); });

    /* a lingueta de puxar do calcanhar, traço de tênis de corrida */
    const ling = peca(g, cano, t => t.pol([[12,25],[19,24],[19,20],[13,21]]), {corte:'chato', base:1});
    dentro(g, ling, cano[4], t => t.cam([[13,21],[19,20]], 1));
    dentro(g, ling, cano[0], t => t.cam([[13,24],[19,23]], 1));

    /* a sombra no chão: dura, e é ela que assenta o tênis */
    chapa(g, (()=>{const f=forma();f.pol([[11,51],[52,51],[58,53],[9,53]]);return f;})(),
      mistura('#0b0a14', bor[2], .6));
    chapa(g, (()=>{const f=forma();f.pol([[16,51],[48,51],[50,52],[14,52]]);return f;})(),
      mistura('#0b0a14', bor[3], .45));
  };
