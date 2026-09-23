  A.reflexos = g => {
    const pel = M.pele, aco = M.cromo, cabo = M.madeira, lat = M.latao;
    /* Três tentativas antes desta viraram borrão de mão, e a conta explica
       por quê: mão de catorze pixels de palma dividida em quatro dedos dá
       três e meio cada, que é abaixo do que lê, e o resultado é cacho de
       banana. O manual manda desenhar mão como LUVA — uma massa só —, com
       três dedos no máximo, separados por SOMBRA de um pixel e nunca por
       recorte na silhueta.

       Então aqui a mão é pequena e são três peças: o punho numa massa só,
       o POLEGAR por baixo e o INDICADOR por cima, ainda aberto.

       O indicador aberto é o ícone inteiro. Medindo gente pegando objeto,
       a mão abre a pinça bem mais que o objeto e só depois fecha — a folga
       extra fica em uns 25 mm quase fixos, o que num cabo de seis pixels
       dá uns dez pixels de vão. Mão que SEGURA tem esse vão em zero. E o
       indicador é justamente o primeiro dedo a abrir e o último a fechar
       numa pegada, então ele é o que fica para trás. */

    /* os traços de velocidade, ATRÁS da faca e paralelos ao rumo da queda.
       Espessura e espaçamento iguais = velocidade constante. Nunca cruzam
       a mão: traço por cima de mão lê como arranhão. */
    for (const [x0,y0,n] of [[40,1,13],[47,2,9],[33,3,8],[53,4,7]]) {
      const f = forma(); f.cam([[x0, y0],[x0 - Math.round(n*0.7), y0 + n]], 1);
      chapa(g, f, mistura('#0b0a14', aco[4], .5));
    }
    /* o fantasma da ponta, deslocado para trás no rumo da queda: é o único
       tipo de borrão que funciona em quadro parado */
    const eco = forma(); eco.pol([[30,26],[34,29],[21,43],[17,40]]);
    chapa(g, eco, mistura('#0b0a14', aco[3], .3));

    /* A FACA, num caimento de um para dois: vertical demais fica parada,
       quarenta e cinco graus lê como arremessada. */
    const punho = forma(); punho.pol([[46,2],[52,5],[45,18],[39,15]]);
    peca(g, cabo, t => { t.m.set(punho.m); }, {corte:'esfera', giro:[1,-1], faixas:[1,2,2,2]});
    dentro(g, punho, cabo[4], t => t.cam([[46,4],[41,14]], 1));
    dentro(g, punho, cabo[0], t => { t.cam([[48,7],[43,17]],1); t.cam([[49,3],[44,12]],1); });
    dentro(g, punho, cabo[5], t => t.cam([[46,5],[42,12]], 1));
    /* a GUARDA. Sem ela o cabo e a lâmina viram uma peça só e o objeto
       deixa de ler como faca — isso não é opcional. */
    const gua = forma(); gua.pol([[34,14],[45,19],[43,24],[32,19]]);
    peca(g, lat, t => { t.m.set(gua.m); }, {corte:'esfera', giro:[1,-1], faixas:[1,1,1,1], brilhoFaixa:1});
    /* A LÂMINA: cinco pixels com TRÊS valores atravessados, que é o mínimo
       que lê como bisel. Fio claro de um lado e dorso escuro do outro, os
       dois correndo o comprimento inteiro — é essa assimetria que faz aço
       afiado em vez de régua. */
    const lam = forma(); lam.pol([[36,21],[43,24],[15,54],[11,49]]);
    contorno(g, lam, {tinta:TRACO, tintaLuz:aco[2]});
    chapa(g, lam, aco[2]);
    dentro(g, lam, aco[0], t => t.cam([[42,24],[15,53]], 2));
    dentro(g, lam, aco[3], t => t.cam([[40,23],[14,51]], 1));
    dentro(g, lam, aco[5], t => t.cam([[36,22],[12,49]], 1));
    dentro(g, lam, '#ffffff', t => t.cam([[30,30],[24,37]], 1));
    dentro(g, lam, aco[1], t => t.cam([[19,48],[14,52]], 1));

    /* O PUNHO: uma massa só, compacta, com o antebraço saindo pela
       direita e o pulso DOBRADO. Antebraço e mão no mesmo eixo lê como
       luva num pau. */
    peca(g, pel, t => t.pol([[62,54],[62,36],[54,33],[50,48]]),
      {corte:'esfera', giro:[-1,-1], faixas:[2,2,3,3], base:2});
    const mao = forma();
    mao.pol([[40,26],[44,20],[51,18],[58,21],[61,29],[59,39],[52,44],[44,40]]);
    const M2 = peca(g, pel, t => { t.m.set(mao.m); }, {corte:'esfera', giro:[-1,1], faixas:[2,3,3,4], base:3});
    /* o arco dos nós: UMA linha clara curva, com dois pixels de corcova no
       meio. Quatro calombos separados a esse tamanho viram ruído. */
    dentro(g, M2, pel[5], t => t.curva([43,23],[50,19],[58,22], 1));
    dentro(g, M2, pel[1], t => t.curva([43,26],[50,22],[58,25], 1));
    /* três divisões de dedo, cada uma parando num lugar diferente: dedo
       fazendo todos a mesma coisa é a falha mais citada */
    for (const [a,b] of [[[41,28],[52,26]], [[42,33],[54,31]], [[45,38],[55,36]]]) {
      dentro(g, M2, pel[2], t => t.cam([a,b], 1));
      dentro(g, M2, pel[5], t => t.cam([[a[0],a[1]-1],[b[0],b[1]-1]], 1));
    }
    dentro(g, M2, pel[1], t => t.eli(57,38,5,4));

    /* O INDICADOR, ainda ABERTO e sem tocar no cabo. É ele que separa
       "pegando" de "segurando". */
    const ind = forma();
    ind.cam([[50,21],[42,15],[35,12]], 5); ind.eli(34, 12, 2.8, 2.8);
    contorno(g, ind, {tinta:mistura(TRACO, pel[0], .45), tintaLuz:pel[1]});
    chapa(g, ind, pel[3]);
    dentro(g, ind, pel[4], t => t.cam([[49,19],[41,13],[34,10]], 2));
    dentro(g, ind, pel[5], t => t.cam([[48,18],[41,12],[34,9]], 1));
    dentro(g, ind, pel[1], t => t.cam([[51,24],[43,18],[36,15]], 1));
    dentro(g, ind, pel[5], t => t.eli(33,11,1.6,1.4));

    /* O POLEGAR, cruzando por baixo, do outro lado do cabo */
    const pol = forma();
    pol.cam([[56,44],[48,42],[42,37]], 6); pol.eli(41, 36, 3, 3);
    contorno(g, pol, {tinta:TRACO, tintaLuz:pel[1]});
    chapa(g, pol, pel[3]);
    dentro(g, pol, pel[4], t => t.cam([[56,42],[48,40],[43,35]], 2));
    dentro(g, pol, pel[5], t => t.cam([[55,41],[48,39],[43,34]], 1));
    dentro(g, pol, pel[1], t => t.cam([[56,47],[48,45],[42,40]], 1));
    dentro(g, pol, pel[5], t => t.eli(41,35,1.8,1.6));

    /* A FAÍSCA do contato, onde o punho encontra a guarda: é ali que o
       olho pousa primeiro. */
    const fai = forma();
    fai.cam([[39,19],[45,25]], 1); fai.cam([[39,25],[45,19]], 1);
    fai.cam([[38,22],[46,22]], 1); fai.cam([[42,18],[42,26]], 1);
    chapa(g, fai, mistura(aco[5], '#ffffff', .55));
    chapa(g, (()=>{const f=forma();f.eli(42,22,1.2,1.2);return f;})(), '#ffffff');
  };
