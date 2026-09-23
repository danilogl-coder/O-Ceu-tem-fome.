(function (root) {
  'use strict';
  const K = root.FichaPericiasKit || (typeof require !== 'undefined' ? require('./ficha-pericias-kit.js') : null);
  const {L, TRACO, M, forma, desloca, chapa, dentro, contorno, volume, peca,
         horizonte, veio, salpico, arranhao, rebite, costura, dobra, projeta, mistura, sorte, limpar} = K;

  const A = {};

  /* ============================== COSMO =============================== */

  /* ATUALIDADES — o jornal dobrado. Papel é um material de faces CHATAS:
     cada face um tom só, vinco de um pixel, e faces vizinhas separadas por
     exatamente um degrau da rampa. A única curva é a ponta enrolada. */
  A.atualidades = g => {
    const pap = M.papel, tin = M.grafite;
    const folha = [[7,13],[33,9],[57,15],[55,52],[32,56],[9,50]];
    const s = peca(g, pap, t => t.pol(folha), {corte:'chato', base:3});
    /* a página da direita fica um degrau abaixo: a dobra inclina ela para
       longe da luz */
    dentro(g, s, pap[2], t => t.pol([[33,9],[57,15],[55,52],[32,56]]));
    dentro(g, s, pap[4], t => t.cam([[32,10],[31,55]], 1));
    dentro(g, s, pap[1], t => t.cam([[33,10],[32,55]], 1));
    /* a tarja do cabeçalho atravessa as DUAS páginas — é isso que diz
       "jornal" e não "livro aberto" */
    dentro(g, s, tin[1], t => t.pol([[9,14],[33,10],[57,16],[56,23],[32,17],[9,21]]));
    dentro(g, s, tin[4], t => t.pol([[10,15],[33,11],[56,17],[56,18],[33,12],[10,16]]));
    dentro(g, s, pap[5], t => { t.pol([[13,16],[28,14],[28,19],[13,20]]);
      t.pol([[37,17],[52,20],[52,22],[37,20]]); });
    dentro(g, s, tin[1], t => { t.cam([[15,17],[15,19]],1); t.cam([[18,16],[18,19]],1);
      t.cam([[21,16],[21,19]],1); t.cam([[25,16],[25,19]],1); });
    /* a foto: moldura escura e uma imagem clara dentro dela */
    dentro(g, s, tin[0], t => t.pol([[11,26],[28,24],[28,38],[11,39]]));
    dentro(g, s, pap[4], t => t.pol([[12,27],[27,25],[27,37],[12,38]]));
    dentro(g, s, pap[2], t => t.pol([[12,33],[17,28],[21,32],[25,27],[27,31],[27,37],[12,38]]));
    dentro(g, s, pap[5], t => t.eli(23,28,2,2));
    /* as linhas de texto: comprimento irregular, e nunca duas iguais
       encostadas — é o que evita a faixa */
    const linhas = [[11,43,26,41],[11,46,23,44],[11,49,27,47],
                    [35,26,54,29],[35,30,50,32],[35,34,54,37],[35,38,48,39],
                    [35,42,54,45],[35,46,51,48],[35,50,46,51]];
    for (const [x0,y0,x1,y1] of linhas) dentro(g, s, pap[1], t => t.cam([[x0,y0],[x1,y1]], 1));
    dentro(g, s, pap[2], t => t.cam([[45,25],[44,51]], 1));
    /* a sombra que a página de cima joga na de baixo, junto ao vinco */
    dentro(g, s, pap[1], t => { t.cam([[34,13],[33,54]],1); });
    /* um fio só embaixo do cabeçalho: dois viram toldo listrado */
    dentro(g, s, pap[5], t => { t.cam([[10,25],[31,21]],1); });
    dentro(g, s, pap[0], t => { t.cam([[35,26],[43,27]],1); t.cam([[35,34],[43,35]],1); });
    /* a ponta enrolada: a única coisa redonda do ícone */
    peca(g, pap, t => t.pol([[55,44],[57,45],[56,53],[48,55],[50,50]]),
      {corte:'esfera', faixas:[1,1,1,2], base:2});
  };

  /* CIÊNCIAS — o microscópio. Corpo de aço com a faixa do horizonte, tubo
     na diagonal (a faixa gira noventa graus junto com o eixo), lente de
     vidro e a lâmina de vidro no palco. */
  A.ciencias = g => {
    const gra = M.pedra, cro = M.cromo, vid = M.vidro;
    /* A silhueta do microscópio é um L: pé largo embaixo, coluna reta atrás,
       tubo saindo na diagonal em cima. Se esses três não se separarem na
       silhueta, o ícone vira um amontoado escuro. */
    const pe = peca(g, gra, t => { t.pol([[8,60],[56,60],[50,50],[14,50]]); t.pol([[28,50],[46,50],[44,42],[31,42]]); },
      {corte:'tuboH', faixas:[1,2,2,2], base:2});
    dentro(g, pe, gra[4], t => { t.cam([[14,50],[27,50]],1); t.cam([[31,42],[44,42]],1); });
    dentro(g, pe, gra[0], t => t.cam([[8,59],[56,59]], 1));
    dentro(g, pe, gra[1], t => t.cam([[9,57],[55,57]], 1));
    /* a coluna */
    peca(g, gra, t => t.ret(36,14,10,29), {corte:'tuboV', faixas:[1,2,2,3], base:3, brilhoFaixa:1});
    dentro(g, (()=>{const f=forma();f.ret(36,14,10,29);return f;})(), gra[0],
      t => { t.cam([[38,20],[38,40]],1); t.cam([[43,20],[43,40]],1); });
    /* o palco, com o vão da luz no meio */
    const palco = forma(); palco.ret(8,32,30,6); palco.menos(t => t.ret(18,34,8,2));
    peca(g, gra, t => { t.m.set(palco.m); }, {corte:'tuboH', faixas:[1,1,2,1], base:2});
    dentro(g, palco, gra[5], t => t.cam([[8,32],[37,32]], 1));
    dentro(g, palco, gra[0], t => t.cam([[8,37],[37,37]], 1));
    peca(g, cro, t => { t.ret(11,30,3,4); t.ret(29,30,3,4); }, {corte:'tuboV', faixas:[1,1,1,1], brilhoFaixa:1});
    peca(g, vid, t => t.ret(13,29,17,4), {corte:'tuboH', faixas:[1,1,1,1], base:4, tomReflexo:1,
      brilho: t => t.cam([[15,30],[24,30]], 1)});
    /* o revólver das objetivas, com um VÃO claro entre ele e o tubo */
    peca(g, gra, t => { t.pol([[15,18],[37,18],[37,25],[15,25]]); },
      {corte:'tuboV', faixas:[1,2,2,2], base:3, brilhoFaixa:1});
    peca(g, cro, t => { t.ret(16,25,6,4); t.ret(17,29,4,2); }, {corte:'tuboV', faixas:[1,1,1,1], brilhoFaixa:1});
    peca(g, cro, t => { t.ret(24,25,6,3); t.ret(25,28,4,2); }, {corte:'tuboV', faixas:[1,1,1,1], base:2});
    /* o tubo, na diagonal, com a faixa girada para o eixo dele */
    peca(g, gra, t => { t.risco(12,9,28,16, 10); },
      {corte:'esfera', giro:[1,-1], faixas:[1,2,2,3], base:3, brilhoFaixa:1});
    /* a ocular: um anel de cromo MAIS GROSSO que o tubo, senão some */
    peca(g, cro, t => { t.risco(7,6,13,9, 12); }, {corte:'esfera', giro:[1,-1], faixas:[1,1,2,2], brilhoFaixa:1});
    peca(g, vid, t => t.eli(9,7,4,4), {corte:'esfera', faixas:[1,1,1,1], base:1,
      brilho: t => t.ret(7,5,2,1)});
    /* o parafuso de foco, com os gomos contados */
    peca(g, gra, t => t.ret(46,26,5,6), {corte:'tuboH', faixas:[1,1,1,1], base:2});
    peca(g, cro, t => t.eli(52,29,6,6), {corte:'esfera', faixas:[1,1,2,2], brilho: t => t.eli(50,27,1,1)});
    const pino = forma(); pino.eli(52,29,6,6);
    for (const a of [20,70,120,170,220,270,320]) {
      const r = a * Math.PI/180;
      dentro(g, pino, cro[1], t => t.cam([[52+Math.cos(r)*4,29+Math.sin(r)*4],[52+Math.cos(r)*6,29+Math.sin(r)*6]],1));
    }
    arranhao(g, pe, gra, [[16,52,26,52],[34,44,42,44]]);
  };

  /* INVESTIGAÇÃO — a lupa e a digital. O vidro é o contrário de um corpo
     opaco: escuro na beirada, onde o material é grosso, e claro no miolo.
     O realce é um risco longo e duro, não uma bolinha. */
  A.investigacao = g => {
    const lat = M.latao, mad = M.madeira, vid = M.vidro;
    /* o cabo, enfiado por baixo do aro */
    peca(g, mad, t => t.risco(40,40,53,53, 7), {corte:'esfera', giro:[1,-1], faixas:[1,2,2,2]});
    veio(g, (()=>{const f=forma();f.risco(40,40,53,53,7);return f;})(), mad[1], {n:2, semente:5});
    peca(g, lat, t => t.risco(37,37,42,42, 8), {corte:'esfera', giro:[1,-1], faixas:[1,1,2,2], brilhoFaixa:1});
    /* o vidro primeiro, o aro por cima */
    const lente = forma(); lente.eli(25,25,15,15);
    chapa(g, lente, vid[4]);
    dentro(g, lente, vid[3], t => { t.anel(25,25,15,15,4); });
    dentro(g, lente, vid[2], t => { t.anel(25,25,15,15,2); });
    /* a digital, ampliada: arcos concêntricos abertos de um lado */
    for (let i = 0; i < 5; i++) {
      const r = 3 + i * 2.6;
      dentro(g, lente, mistura(vid[1], vid[3], 0.25), t => t.arco(24,26, r, r*1.12, 1.2, 205, 500));
    }
    dentro(g, lente, mistura(vid[1], vid[3], 0.25), t => t.cam([[24,17],[25,14],[28,12]], 1));
    /* o risco de luz do vidro: duro, longo, na beirada da luz */
    dentro(g, lente, vid[5], t => t.cam([[16,19],[14,25],[15,30]], 2));
    dentro(g, lente, vid[5], t => t.cam([[20,15],[25,13]], 1));
    /* o aro */
    peca(g, lat, t => t.anel(25,25,18,18,4), {corte:'esfera', faixas:[1,2,2,2], brilhoFaixa:1});
    for (const [x,y] of [[10,18],[38,16],[12,36]]) rebite(g, forma(), lat, x, y);
  };

  /* MEDICINA — o estetoscópio. Borracha é fosca: rampa curta, sem brilho.
     O auscultador é cromo e ganha a faixa do horizonte, que é a coisa que
     faz metal parecer metal. */
  A.medicina = g => {
    const bor = M.grafite, cro = M.cromo;
    /* a mangueira em Y. Borracha é fosca: rampa curta, zero brilho. */
    const tubo = forma();
    tubo.curva([13,12],[4,34],[26,43], 5);
    tubo.curva([47,12],[56,34],[34,43], 5);
    tubo.risco(26,43,34,43, 5);
    peca(g, bor, t => { t.m.set(tubo.m); }, {corte:'tuboV', faixas:[1,1,2,2], base:2});
    /* as hastes e as olivas */
    peca(g, cro, t => { t.risco(13,12,11,7, 3); t.risco(47,12,49,7, 3); },
      {corte:'tuboV', faixas:[1,1,1,1], brilhoFaixa:1});
    peca(g, bor, t => { t.eli(10,6,4.5,3.5); t.eli(50,6,4.5,3.5); }, {corte:'esfera', faixas:[1,1,1,1], base:3});
    /* o pescoço vai ANTES do disco, senão ele corta a membrana ao meio */
    peca(g, cro, t => t.risco(30,42,30,37, 5), {corte:'tuboV', faixas:[1,1,1,1], brilhoFaixa:1});
    /* o auscultador. O branco encostado no tom mais escuro é a assinatura
       do metal — é o horizonte do espelho, não um degradê. */
    const disco = forma(); disco.eli(30,47,15,15);
    contorno(g, disco, {tinta:TRACO, tintaLuz:cro[1]});
    horizonte(g, disco, cro, 44, {alto:1, arco:-2});
    /* a membrana, chata, um degrau abaixo do aro */
    dentro(g, disco, cro[2], t => t.eli(30,47,12,12));
    dentro(g, disco, cro[1], t => t.arco(30,47,12,12,2,5,175));
    dentro(g, disco, cro[3], t => t.arco(30,47,12,12,2,190,350));
    dentro(g, disco, cro[0], t => t.anel(30,47,12,12,1));
    /* a serrilha do aro: vinte e quatro entalhes contados. A sessenta e
       quatro, o luxo em cima de um ícone de trinta e dois é ter MAIS
       entalhe, não entalhe maior. */
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, r0 = 12.5, r1 = 14.5;
      dentro(g, disco, k % 2 ? cro[0] : cro[4], t => t.cam([
        [30 + Math.cos(a)*r0, 47 + Math.sin(a)*r0],
        [30 + Math.cos(a)*r1, 47 + Math.sin(a)*r1]], 1));
    }
    /* a gravação do fabricante e o furo do diafragma */
    dentro(g, disco, cro[0], t => { t.cam([[25,52],[35,52]],1); t.cam([[26,54],[34,54]],1); });
    dentro(g, disco, cro[4], t => { t.cam([[25,53],[35,53]],1); });
    dentro(g, disco, cro[5], t => t.cam([[23,41],[26,39]], 1));
  };

  /* OCULTISMO — a vela sobre o grimório. Fogo é o único material que se
     desenha de fora para dentro: quatro cascas, da mais fria para a mais
     quente, cada uma menor que a anterior, e o branco só no miolo. */
  A.ocultismo = g => {
    const cou = M.couro, pap = M.papel, our = M.ouro, cer = M.osso, fog = M.fogo;
    /* o grimório fechado, deitado */
    const capa = peca(g, cou, t => t.pol([[3,42],[40,36],[61,44],[23,51]]), {corte:'chato', base:3});
    dentro(g, capa, cou[4], t => t.pol([[3,42],[40,36],[44,37],[5,43]]));
    dentro(g, capa, cou[1], t => t.pol([[23,51],[61,44],[61,45],[23,52]]));
    peca(g, pap, t => t.pol([[3,42],[23,51],[23,57],[3,48]]), {corte:'tuboH', faixas:[1,1,1,1], base:3});
    const corte = forma(); corte.pol([[3,42],[23,51],[23,57],[3,48]]);
    /* o corte das folhas: seis fios, espaçamento irregular, porque fio
       igualmente espaçado vira pente */
    for (const d of [1,2,4,6,7,9]) dentro(g, corte, pap[1], t => t.cam([[3,42+d],[23,51+d]], 1));
    for (const d of [3,5,8]) dentro(g, corte, pap[4], t => t.cam([[3,42+d],[23,51+d]], 1));
    peca(g, cou, t => t.pol([[23,51],[61,44],[61,49],[23,57]]), {corte:'chato', base:2});
    /* o selo dourado na capa: um anel com raios, grande o bastante para ler */
    /* o selo: anel grosso, estrela dentro e raios contados. Fio de um pixel
       some a esse tamanho; dois pixels leem. */
    dentro(g, capa, our[2], t => t.anel(36,44,16,7,2));
    dentro(g, capa, our[4], t => t.arco(36,44,16,7,2,190,350));
    dentro(g, capa, our[3], t => { t.pol([[36,38],[44,44],[36,50],[28,44]]); });
    dentro(g, capa, our[0], t => { t.pol([[36,41],[40,44],[36,47],[32,44]]); });
    dentro(g, capa, our[4], t => { t.cam([[28,44],[36,38]],1); t.cam([[36,38],[44,44]],1); });
    dentro(g, capa, our[5], t => { t.cam([[31,43],[36,39]],1); });
    for (const a of [200,240,300,340]) { const r = a*Math.PI/180;
      dentro(g, capa, our[3], t => t.cam([[36+Math.cos(r)*17,44+Math.sin(r)*8],[36+Math.cos(r)*20,44+Math.sin(r)*9]],1)); }
    /* a vela */
    const vela = peca(g, cer, t => t.ret(26,18,11,20), {corte:'tuboV', faixas:[1,2,2,3]});
    dentro(g, vela, cer[1], t => { t.cam([[35,21],[35,31]],1); t.eli(35,32,1,2);
      t.cam([[28,23],[28,29]],1); t.eli(28,30,1,1); });
    dentro(g, vela, cer[5], t => t.cam([[27,19],[27,36]], 1));
    dentro(g, vela, cer[0], t => t.cam([[26,18],[37,18]], 1));
    dentro(g, vela, cer[2], t => t.cam([[27,18],[36,18]], 1));
    /* a poça de cera no topo, e o escorrido que desce dela */
    dentro(g, vela, cer[1], t => t.eli(31,19,5,1.6));
    dentro(g, vela, cer[5], t => t.eli(30,18,3,1));
    peca(g, M.tinta, t => t.risco(31,18,31,14, 1), {corte:'chato', base:0});
    /* a chama: quatro cascas, da mais fria para a mais quente */
    const casca = (pts, cor) => { const f = forma(); f.pol(pts); chapa(g, f, cor); };
    casca([[31,2],[36,9],[37,16],[31,21],[25,16],[26,9]], fog[1]);
    casca([[31,4],[35,10],[35,15],[31,20],[27,15],[27,10]], fog[2]);
    casca([[31,6],[34,11],[34,15],[31,19],[28,15],[28,11]], fog[3]);
    casca([[31,9],[33,12],[32,16],[30,16],[29,12]], fog[4]);
    casca([[31,12],[32,14],[31,16],[30,14]], fog[5]);
    /* a luz da chama caindo na cera e na capa */
    dentro(g, vela, mistura(cer[4], fog[4], .45), t => t.ret(28,18,6,3));
    dentro(g, capa, mistura(cou[3], fog[2], .4), t => t.eli(31,40,11,3));
    dentro(g, capa, mistura(cou[4], fog[3], .4), t => t.eli(31,39,7,1));
  };

  /* PERCEPÇÃO — o olho. É de propósito que ele é ÂMBAR: o olho do miolo da
     árvore é violeta, e dois olhos roxos no mesmo painel viram repetição. */
  A.percepcao = g => {
    const esc = M.osso, amb = M.ambar, pel = M.pele;
    const olho = forma();
    olho.pol([[6,32],[14,21],[26,16],[40,16],[52,21],[58,32],[48,43],[32,47],[17,43]]);
    contorno(g, olho, {tinta:TRACO, tintaLuz:esc[1]});
    chapa(g, olho, esc[4]);
    /* a esclera não é branca: escurece em cima, onde a pálpebra faz sombra
       própria, e clareia embaixo, onde o queixo devolve luz. */
    dentro(g, olho, esc[2], t => t.pol([[6,32],[14,21],[26,16],[40,16],[52,21],[58,32],[58,26],[34,18],[10,27]]));
    dentro(g, olho, esc[5], t => t.pol([[14,40],[32,46],[48,42],[40,44],[24,45]]));
    /* a íris, com o limbo escuro em volta */
    dentro(g, olho, M.ambar[0], t => t.eli(31,30,12,12));
    dentro(g, olho, amb[3], t => t.eli(31,30,11,11));
    /* íris é tigela: clareia do lado OPOSTO à luz, porque a luz entra e
       bate no fundo dela. É o contrário de uma bola, e é o que faz olho. */
    dentro(g, olho, amb[4], t => t.arco(31,30,10,10,4,10,175));
    dentro(g, olho, amb[5], t => t.arco(31,31,9,9,3,35,145));
    dentro(g, olho, amb[2], t => t.arco(31,30,10,10,4,190,355));
    dentro(g, olho, amb[1], t => t.arco(31,30,10,10,2,205,335));
    for (let k = 0; k < 14; k++) {
      const a = k * Math.PI / 7 + 0.2, r0 = 4.5, r1 = k % 2 ? 9.6 : 8.2;
      dentro(g, olho, k % 3 ? amb[2] : amb[4], t => t.cam([
        [31 + Math.cos(a) * r0, 30 + Math.sin(a) * r0],
        [31 + Math.cos(a) * r1, 30 + Math.sin(a) * r1]], 1));
    }
    dentro(g, olho, M.ambar[0], t => t.anel(31,30,11,11,1));
    dentro(g, olho, M.tinta[0], t => t.eli(31,30,4,4));
    dentro(g, olho, mistura(M.tinta[0], amb[0], .5), t => t.arco(31,30,4,4,1,20,160));
    /* o realce: bloco duro em cima à esquerda, faísca pequena do outro
       lado. Nunca redondo, nunca no meio. */
    dentro(g, olho, '#fffaf0', t => { t.ret(23,22,4,3); t.ret(22,23,1,2); });
    dentro(g, olho, mistura('#fffaf0', amb[4], .5), t => { t.ret(27,22,2,2); t.ret(22,25,2,1); });
    dentro(g, olho, mistura('#fffaf0', amb[4], .35), t => t.ret(37,35,2,2));
    /* pálpebra de cima: sombra dura na esclera, e o cílio por fora */
    dentro(g, olho, mistura(esc[1], amb[0], .4), t => t.pol([[6,32],[14,21],[26,16],[40,16],[52,21],[58,32],[56,29],[38,19],[20,21],[11,29]]));
    const cilio = forma();
    cilio.cam([[6,31],[13,21],[26,16],[40,16],[52,21],[58,31]], 2);
    cilio.cam([[9,24],[6,21]],1); cilio.cam([[14,20],[12,16]],1); cilio.cam([[21,17],[19,13]],1);
    cilio.cam([[31,15],[31,11]],1); cilio.cam([[42,16],[45,12]],1); cilio.cam([[51,20],[54,17]],1);
    chapa(g, cilio, M.tinta[0]);
    const baixo = forma(); baixo.cam([[7,33],[17,44],[32,48],[48,44],[57,33]], 1);
    chapa(g, baixo, esc[5]);
    chapa(g, desloca(baixo,0,1), pel[2]);
    /* a sobrancelha: afina nas pontas, porque sobrancelha de espessura
       igual vira lagarta. */
    const sob = forma();
    sob.pol([[8,13],[20,6],[34,4],[48,6],[56,10],[54,12],[46,9],[33,7],[21,9],[10,15]]);
    chapa(g, sob, M.couro[0]);
    /* fios, para não virar lagarta: riscos curtos, todos no mesmo rumo */
    for (let k = 0; k < 11; k++) {
      const t = k / 10, x = 10 + t * 44, y = 13 - Math.sin(t * Math.PI) * 6 + t * 1.5;
      const f = forma(); f.cam([[x, y],[x + 3, y - 2]], 1); f.so(q => q.m.set(sob.m));
      chapa(g, f, k % 2 ? M.couro[2] : M.couro[1]);
    }
  };

  /* PROFISSÃO — a chave inglesa e a chave de fenda cruzadas. Duas hastes
     na diagonal, cada uma com a faixa girada para o seu próprio eixo. */
  A.profissao = g => {
    const aco = M.aco, cro = M.cromo, amb = M.grafite;
    /* A chave de fenda vai primeiro: a chave inglesa passa por cima e é
       isso que dá a profundidade do cruzamento. */
    const haste = forma(); haste.risco(29,30,49,48, 6);
    peca(g, cro, t => { t.m.set(haste.m); t.pol([[47,46],[54,53],[50,57],[44,51]]); },
      {corte:'esfera', giro:[1,-1], faixas:[1,1,2,2], brilhoFaixa:1});
    /* cabo âmbar, gordo, com gomos — cabo fino lê como galho */
    const cabo = forma(); cabo.risco(14,15,30,31, 12); cabo.eli(13,14,6,6);
    peca(g, amb, t => { t.m.set(cabo.m); }, {corte:'esfera', giro:[1,-1], faixas:[1,2,2,3], base:2,
      brilho: t => t.cam([[12,19],[22,29]], 1)});
    /* a tarja vermelha do cabo. Cabo de ferramenta é escuro com UMA tarja
       de cor; cabo inteiro de cor quente lê como pedaço de carne, e foi
       isso que aconteceu nas duas tentativas anteriores. */
    const tarja = forma(); tarja.risco(17,29,28,18, 5); tarja.so(t => t.m.set(cabo.m));
    chapa(g, tarja, M.sangue[2]);
    const tarjaLuz = forma(); tarjaLuz.risco(16,28,27,17, 2); tarjaLuz.so(t => t.m.set(cabo.m));
    chapa(g, tarjaLuz, M.sangue[3]);
    const tarjaAlto = forma(); tarjaAlto.risco(15,27,26,16, 1); tarjaAlto.so(t => t.m.set(cabo.m));
    chapa(g, tarjaAlto, M.sangue[4]);
    /* UM anel só perto da virola, e um risco de luz correndo o cabo
       inteiro. Gomo repetido a sessenta e quatro vira espiga de milho, e
       foi isso que aconteceu nas duas tentativas anteriores. */
    const anel = forma(); anel.risco(21,33,32,22, 2); anel.so(t => t.m.set(cabo.m));
    chapa(g, anel, amb[0]);
    const anelLuz = forma(); anelLuz.risco(20,32,31,21, 1); anelLuz.so(t => t.m.set(cabo.m));
    chapa(g, anelLuz, amb[4]);
    const fio = forma(); fio.risco(11,19,26,34, 2); fio.so(t => t.m.set(cabo.m));
    chapa(g, fio, amb[3]);
    const fio2 = forma(); fio2.risco(10,18,25,33, 1); fio2.so(t => t.m.set(cabo.m));
    chapa(g, fio2, amb[5]);
    /* a virola de metal entre o cabo e a haste */
    peca(g, cro, t => t.risco(28,29,33,34, 8), {corte:'esfera', giro:[1,-1], faixas:[1,1,1,2], brilhoFaixa:1});

    /* A chave inglesa: cabo grosso e DUAS bocas grandes. Boca pequena lê
       como gancho; é o vão que diz que aquilo aperta porca. */
    const ch = forma();
    ch.risco(19,47,45,21, 9);
    ch.pol([[9,45],[18,36],[26,44],[24,53],[15,57],[7,53]]);
    ch.pol([[39,21],[47,13],[56,11],[58,19],[51,27],[43,28]]);
    /* as bocas: vãos GRANDES. Vão pequeno lê como gancho; é o buraco que
       diz que aquilo aperta porca. */
    const boca = forma();
    boca.pol([[4,47],[16,35],[21,40],[11,54]]);
    boca.pol([[57,7],[61,16],[50,24],[46,18]]);
    boca.eli(51,18,4,4);
    ch.menos(t => { t.m.set(boca.m); });
    peca(g, aco, t => { t.m.set(ch.m); }, {corte:'esfera', giro:[1,1], faixas:[1,2,3,4], base:2, brilhoFaixa:1});
    /* o ajuste: um rasgo e a rosca */
    const rasgo = forma(); rasgo.risco(34,32,42,24, 2); rasgo.so(t => t.m.set(ch.m));
    chapa(g, rasgo, aco[0]);
    chapa(g, desloca(rasgo,-1,-1), aco[4]);
    chapa(g, rasgo, aco[0]);
    arranhao(g, ch, aco, [[24,42,31,35],[28,46,33,41]]);
    for (const [x,y] of [[17,45],[45,21]]) rebite(g, ch, aco, x, y);
  };

  /* SOBREVIVÊNCIA — a fogueira. Madeira é padrão, não é luz: o veio não
     muda de tom quando a tora escurece. O fogo por cima é que manda na cor
     de todo o resto. */
  A.sobrevivencia = g => {
    const mad = M.madeira, fog = M.fogo, bra = M.laranja, cin = M.pedra;
    /* as cinzas: uma mancha baixa e irregular, salpicada, nunca uma barra */
    const cinza = forma(); cinza.pol([[10,56],[22,52],[42,52],[54,56],[46,59],[18,59]]);
    peca(g, cin, t => { t.m.set(cinza.m); }, {corte:'tuboH', faixas:[1,1,1,1], base:1});
    salpico(g, cinza, cin[3], {n:14, semente:71});
    salpico(g, cinza, cin[0], {n:10, semente:83});
    /* três toras cruzadas; a da frente é a mais clara */
    const toras = [[[10,52],[54,46]], [[9,45],[55,55]], [[14,57],[50,41]]];
    const tom = [1,2,3];
    for (let i = 0; i < 3; i++) {
      const [a,b] = toras[i];
      const t = forma(); t.risco(a[0],a[1],b[0],b[1], 8);
      const eixo = Math.abs(b[1]-a[1]) > Math.abs(b[0]-a[0]) ? [1,0] : [0,1];
      peca(g, mad, f => { f.m.set(t.m); }, {corte:'tuboH', giro:eixo, faixas:[1,2,2,2], base:tom[i]});
      veio(g, t, mad[1], {n:3, semente:11 + i*7});
      /* a ponta cortada: anéis concêntricos e a face mais escura de todas,
         porque madeira cortada de topo bebe luz */
      const p = i % 2 ? a : b;
      const cabeca = forma(); cabeca.eli(p[0], p[1], 4, 4);
      cabeca.so(f => { f.m.set(t.m); });
      dentro(g, cabeca, mad[1], f => f.eli(p[0],p[1],4,4));
      dentro(g, cabeca, mad[2], f => f.anel(p[0],p[1],3,3,1));
      dentro(g, cabeca, mad[0], f => f.eli(p[0],p[1],1,1));
      dentro(g, cabeca, mad[3], f => f.arco(p[0],p[1],4,4,1,190,350));
    }
    /* as brasas entre as toras */
    const bs = forma(); bs.eli(32,48,13,4);
    salpico(g, bs, bra[3], {n:16, semente:31});
    salpico(g, bs, bra[4], {n:8, semente:47});
    salpico(g, bs, bra[1], {n:10, semente:53});
    /* a chama, lambendo para a esquerda: chama simétrica não lê como fogo */
    const casca = (pts, cor) => { const f = forma(); f.pol(pts); chapa(g, f, cor); };
    casca([[30,6],[38,18],[41,30],[36,44],[26,46],[18,38],[20,26],[25,14]], fog[1]);
    casca([[30,10],[36,20],[38,31],[34,42],[26,43],[21,36],[23,26],[27,17]], fog[2]);
    casca([[30,15],[34,23],[35,32],[32,40],[27,41],[24,35],[25,27],[28,20]], fog[3]);
    casca([[30,21],[33,28],[32,37],[28,39],[26,33],[27,26]], fog[4]);
    casca([[30,27],[31,32],[30,37],[28,34],[28,30]], fog[5]);
    for (const [x,y] of [[16,22],[44,16],[12,33],[47,29],[38,8],[21,9]]) g.dot(x,y, bra[4]);
    for (const [x,y] of [[18,15],[42,24],[26,4]]) g.dot(x,y, fog[5]);
  };

  /* TÁTICA — o mapa com alfinetes. Papel de novo: faces chatas, vinco de um
     pixel, faces vizinhas a exatamente um degrau. */
  A.tatica = g => {
    const pap = M.papel, ver = M.musgo, agu = M.ceu, gra = M.grafite;
    const s = peca(g, pap, t => t.pol([[6,10],[58,7],[57,55],[7,57]]), {corte:'chato', base:3});
    dentro(g, s, pap[2], t => t.pol([[32,8],[58,7],[57,31],[32,32]]));
    dentro(g, s, pap[2], t => t.pol([[6,32],[32,32],[31,57],[7,57]]));
    dentro(g, s, pap[1], t => t.pol([[32,32],[57,31],[57,55],[31,57]]));
    dentro(g, s, pap[4], t => { t.cam([[31,9],[30,56]],1); t.cam([[7,31],[57,30]],1); });
    dentro(g, s, pap[0], t => { t.cam([[32,9],[31,56]],1); t.cam([[7,32],[57,31]],1); });
    /* o rio */
    dentro(g, s, agu[1], t => t.curva([6,23],[24,33],[33,55], 3));
    dentro(g, s, agu[3], t => t.curva([6,22],[24,32],[33,54], 2));
    dentro(g, s, agu[4], t => t.curva([6,21],[23,31],[32,53], 1));
    /* a mata: árvores contadas, nunca mancha */
    for (const [x,y,h] of [[45,22,6],[52,26,5],[47,31,4],[54,18,4]]) {
      dentro(g, s, ver[1], t => t.pol([[x,y-h],[x+h,y+2],[x-h,y+2]]));
      dentro(g, s, ver[3], t => t.pol([[x,y-h],[x+h-2,y+1],[x-1,y+1]]));
      dentro(g, s, M.madeira[1], t => t.ret(x-1,y+2,2,3));
    }
    /* a estrada */
    dentro(g, s, pap[1], t => t.curva([9,49],[30,41],[56,45], 2));
    dentro(g, s, pap[5], t => t.curva([9,48],[30,40],[56,44], 1));
    /* a rosa dos ventos, grande o bastante para ler */
    dentro(g, s, pap[1], t => t.anel(16,19,8,8,1));
    dentro(g, s, gra[2], t => { t.pol([[16,10],[19,19],[16,28],[13,19]]);
      t.pol([[7,19],[16,16],[25,19],[16,22]]); });
    dentro(g, s, pap[5], t => { t.pol([[16,10],[18,19],[16,19]]); t.pol([[16,16],[25,19],[16,19]]); });
    dentro(g, s, gra[0], t => { t.cam([[16,20],[16,28]],1); t.cam([[16,20],[8,19]],1); });
    dentro(g, s, M.sangue[3], t => t.cam([[16,10],[16,13]], 1));
    /* a rota traçada por cima de tudo */
    costura(g, s, M.sangue[3], [[14,46],[25,35],[37,28],[48,16]], 3);
    /* três alfinetes. A sombra dura é o que levanta o alfinete do papel. */
    const pinos = [[23,36, M.sangue], [46,23, M.ambar], [49,46, M.ceu]];
    for (const [x,y,cor] of pinos) {
      dentro(g, s, pap[0], t => t.pol([[x+1,y+6],[x+7,y+8],[x+7,y+10],[x+1,y+8]]));
      peca(g, M.cromo, t => t.risco(x,y+3,x+1,y+9, 2), {corte:'chato', base:4});
      dentro(g, s, gra[0], t => t.ret(x,y+9,2,1));
      /* a cabeça do alfinete é uma bolinha, e bolinha a nove pixels não
         aguenta seis tons: três. */
      const bola = forma(); bola.eli(x,y,4,4);
      contorno(g, bola, {tinta:TRACO, tintaLuz:cor[1]});
      chapa(g, bola, cor[3]);
      dentro(g, bola, cor[1], t => { t.ret(x-1,y+2,5,3); t.ret(x+2,y-1,3,4); });
      dentro(g, bola, cor[4], t => t.ret(x-3,y-2,4,3));
      dentro(g, bola, cor[5], t => t.ret(x-2,y-2,2,2));
    }
  };

  /* TECNOLOGIA — o chip. Corpo chato e fosco, perninhas de ouro com a
     faixa do horizonte, trilhas gravadas na face de cima. */
  A.tecnologia = g => {
    const cor = M.grafite, our = M.ouro, pla = M.placa, ver = M.verde;
    /* as perninhas antes do corpo, para o corpo cobrir a raiz delas */
    /* As perninhas são cilindros deitados, e cilindro deitado tem faixa
       HORIZONTAL igual de ponta a ponta — o detector de faixa acusa isso,
       e o detector é que está errado: aqui a fileira repetida é a forma,
       não um defeito. O que quebra o ritmo é o comprimento alternado. */
    for (let i = 0; i < 5; i++) {
      const y = 17 + i * 8, w = i % 2 ? 10 : 9;
      peca(g, our, t => { t.ret(4,y,w,4); t.ret(60-w,y,w,4); },
        {corte:'tuboH', faixas:[1,1,1,1], brilhoFaixa:1});
    }
    const corpo = peca(g, cor, t => t.ret(13,12,38,40), {corte:'chato', base:2});
    /* o chanfro: dois pixels de luz em cima e à esquerda, dois de sombra
       do outro lado. É o que levanta uma face chata do fundo. */
    dentro(g, corpo, cor[4], t => { t.cam([[13,12],[50,12]],1); t.cam([[13,12],[13,51]],1); });
    dentro(g, corpo, cor[3], t => { t.cam([[14,13],[49,13]],1); t.cam([[14,13],[14,50]],1); });
    dentro(g, corpo, cor[0], t => { t.cam([[14,51],[50,51]],1); t.cam([[50,13],[50,51]],1); });
    dentro(g, corpo, cor[1], t => { t.cam([[15,50],[49,50]],1); t.cam([[49,14],[49,50]],1); });
    /* o entalhe de orientação e o ponto do pino um */
    dentro(g, corpo, cor[0], t => t.arco(13,32,5,5,5,270,450));
    dentro(g, corpo, cor[4], t => t.arco(13,32,5,5,1,285,435));
    dentro(g, corpo, cor[0], t => t.eli(20,19,2,2));
    dentro(g, corpo, cor[4], t => t.arco(20,19,3,3,1,200,340));
    /* a janela da placa: verde escuro, com as trilhas gravadas nela */
    const jan = forma(); jan.ret(19,22,26,24);
    dentro(g, corpo, pla[2], t => t.ret(19,22,26,24));
    dentro(g, corpo, pla[0], t => { t.cam([[19,22],[44,22]],1); t.cam([[19,22],[19,45]],1); });
    dentro(g, corpo, pla[4], t => { t.cam([[20,45],[44,45]],1); t.cam([[44,23],[44,45]],1); });
    const trilhas = [
      [[22,27],[31,27],[31,24],[41,24]],
      [[22,33],[26,33],[26,38],[36,38],[36,31],[42,31]],
      [[23,43],[23,36],[29,36],[29,43],[41,43]],
      [[34,26],[34,20]]
    ];
    for (const pts of trilhas) {
      const f = forma(); f.cam(pts, 1); f.so(t => t.ret(19,22,26,24));
      chapa(g, desloca(f,1,1), pla[0]);
      chapa(g, f, ver[3]);
    }
    /* soldas: quatro pixels de ouro, que é o único lugar onde ouro entra */
    for (const [x,y] of [[41,24],[42,31],[41,43],[23,43],[22,27],[22,33]]) {
      g.dot(x,y, our[4]); g.dot(x+1,y, our[3]); g.dot(x,y+1, our[2]); g.dot(x+1,y+1, our[1]);
    }
    /* o dado de silício no meio */
    const dado = forma(); dado.ret(30,30,9,9);
    chapa(g, dado, cor[3]);
    chapa(g, (()=>{const f=forma();f.cam([[30,30],[38,30]],1);f.cam([[30,30],[30,38]],1);return f;})(), cor[5]);
    chapa(g, (()=>{const f=forma();f.cam([[31,38],[38,38]],1);f.cam([[38,31],[38,38]],1);return f;})(), cor[0]);
    chapa(g, (()=>{const f=forma();f.cam([[32,32],[36,32]],1);f.cam([[32,35],[36,35]],1);
                   f.cam([[33,31],[33,37]],1);f.cam([[36,31],[36,37]],1);return f;})(), cor[1]);
    for (const [x,y] of [[32,31],[36,34],[34,36]]) g.dot(x,y, ver[4]);
  };

  /* ============================== SENSO =============================== */

  /* ADESTRAMENTO — a cabeça do cão. Pelo é material fosco: rampa curta,
     zero alto-brilho, e o que separa uma mecha da outra é o TOM, não um
     contorno em volta de cada tufo. */
  A.adestramento = g => {
    const pel = M.tijolo, cre = M.osso, foc = M.grafite, tan = M.ambar, cor = M.sangue;
    /* Três tentativas de frente deram errado, e o motivo é de pesquisa:
       numa vista de frente o focinho fica DENTRO da silhueta do crânio, e
       a silhueta é justamente o que sobrevive quando o ícone encolhe. De
       perfil o focinho sai para fora e a silhueta sozinha já diz "cão".

       O que separa cão de raposa, de lobo e de gato, em ordem de força:
         · ORELHA CAÍDA — orelha em pé não distingue nada, porque lobo,
           raposa e gato têm todos; caída é exclusiva de bicho domesticado
           e muda a silhueta, que é onde a informação sobrevive.
         · O DEGRAU DA TESTA (o "stop"): de perfil ele é um degrau visível
           entre o focinho e a testa. Lobo tem rampa lisa; raposa tem
           crânio achatado. O degrau é cão.
         · FOCINHO CURTO E ROMBUDO, de lados quase paralelos, com o alto
           reto. Focinho longo e afilado é lobo; em gota é raposa.
         · NARIZ LARGO, que faz TELHADO sobre a ponta do focinho.
         · MARCA DE BORDA DURA e a COLEIRA, que não é anatomia nenhuma e
           por isso atropela toda a ambiguidade de forma de uma vez. */

    /* a orelha de trás, espiando por cima do crânio */
    peca(g, pel, t => t.pol([[43,9],[52,12],[56,20],[54,26],[49,17],[43,13]]),
      {corte:'esfera', faixas:[1,2,2,2], base:1});

    /* o pescoço e o peito, atrás da cabeça */
    const pesc = forma();
    pesc.pol([[37,37],[50,45],[54,56],[54,62],[24,62],[26,52],[31,44]]);
    peca(g, pel, t => { t.m.set(pesc.m); }, {corte:'esfera', faixas:[2,2,3,3], base:3});
    dentro(g, pesc, pel[1], t => { t.curva([33,47],[30,55],[32,62], 1); t.curva([45,50],[47,56],[46,62], 1); });
    /* o peito branco: marca de borda dura, e lobo nenhum tem */
    dentro(g, pesc, cre[3], t => t.pol([[31,50],[38,54],[38,62],[28,62]]));
    dentro(g, pesc, cre[5], t => t.cam([[31,52],[35,56],[35,62]], 1));

    /* A CABEÇA, numa peça só: crânio redondo, DEGRAU na testa, focinho
       curto saindo para a frente, queixo e papada voltando. */
    const cab = forma();
    cab.pol([
      [36,8],[44,10],[50,16],[52,24],      /* alto e fundo do crânio */
      [51,32],[47,39],                      /* bochecha */
      [40,44],[32,47],                      /* mandíbula indo para a frente */
      [23,48],[16,46],                      /* papada */
      [11,42],[9,37],                       /* queixo */
      [8,31],[10,27],                       /* ponta do focinho */
      [16,25],[23,24],[28,23],               /* cavalete, quase reto */
      [30,19],                               /* O DEGRAU */
      [31,14],[33,10]
    ]);
    /* dois tufos de bochecha, de um a dois pixels. Tufo grande é lobo. */
    cab.pol([[47,36],[50,37],[46,39]]);
    cab.pol([[18,46],[16,48],[21,48]]);
    const C = peca(g, pel, t => { t.m.set(cab.m); }, {corte:'esfera', faixas:[2,3,4,5], base:3});

    /* A MÁSCARA DO FOCINHO: quebra DURA de valor, tom mais claro e mais
       quente na frente. É de graça e separa focinho de crânio num olhar. */
    const fuc = forma();
    fuc.pol([[29,23],[30,32],[28,41],[22,46],[14,45],[9,38],[8,30],[12,26],[20,24]]);
    fuc.so(t => { t.m.set(cab.m); });
    dentro(g, C, cre[3], t => { t.m.set(fuc.m); });
    dentro(g, C, cre[4], t => t.pol([[12,26],[26,24],[27,31],[14,33]]));
    dentro(g, C, cre[5], t => t.cam([[13,27],[25,25]], 1));
    dentro(g, C, cre[2], t => t.pol([[11,38],[24,38],[22,44],[15,44]]));
    /* o degrau da testa, reforçado por tom: um risco escuro subindo do
       cavalete até a sobrancelha */
    dentro(g, C, pel[1], t => t.cam([[29,23],[31,17]], 1));
    dentro(g, C, pel[5], t => t.cam([[28,23],[30,17]], 1));

    /* a papada e a garganta: sombras DIAGONAIS descendo para trás, que é a
       única direção de pelo que sobrevive a sessenta e quatro pixels */
    for (const [x0,y0,x1,y1] of [[26,40,22,46],[33,41,30,47],[40,38,38,44],[45,33,44,40]]) {
      dentro(g, C, pel[1], t => t.cam([[x0,y0],[x1,y1]], 1));
      dentro(g, C, pel[4], t => t.cam([[x0+1,y0],[x1+1,y1]], 1));
    }

    /* O OLHO: oval achatado, eixo maior deitado, pupila REDONDA. Fica logo
       atrás do degrau, na mesma altura dele. */
    /* O contorno do olho NÃO é preto. Cão tem "o contorno do olho não tão
       escuro" e o olho parece maior por isso; contorno preto e canto preto
       são justamente o que faz um olho de LOBO. Aqui o aro é o tom mais
       escuro do PELO, e a íris toma quase toda a abertura. */
    const olho = forma(); olho.pol([[24,23],[27,20],[34,20],[37,23],[35,27],[28,28],[25,26]]);
    dentro(g, C, pel[0], t => { t.m.set(olho.m); });
    dentro(g, C, tan[3], t => t.eli(30.5, 23.8, 4, 3));
    dentro(g, C, tan[4], t => t.eli(30, 23.5, 3.4, 2.4));
    dentro(g, C, tan[5], t => t.eli(29, 23, 2.2, 1.6));
    dentro(g, C, foc[0], t => t.eli(31.5, 24, 2, 2));
    dentro(g, C, foc[5], t => { t.ret(28,22,3,1); t.pt(28,23); });
    /* a lasquinha clara no canto de dentro e de baixo: é a terceira
       pálpebra, o sinal mais barato de "cão e não lobo" — no lobo esse
       canto é PRETO */
    dentro(g, C, cre[5], t => t.pt(35,26));
    dentro(g, C, pel[1], t => t.cam([[26,28],[34,28]], 1));
    /* O PONTINHO DE SOBRANCELHA: a marca "tan point", impossível num lobo,
       e mora exatamente onde mora a expressão */
    dentro(g, C, tan[3], t => t.ret(27,16,6,2));
    dentro(g, C, tan[4], t => t.ret(27,16,4,1));

    /* O NARIZ: trapézio arredondado que faz TELHADO sobre a ponta do
       focinho, em vez de encaixar de frente. Nunca um triângulo. */
    const nar = forma();
    nar.pol([[14,26],[17,28],[17,33],[14,36],[10,36],[7,33],[6,29],[9,26]]);
    contorno(g, nar, {tinta:TRACO, tintaLuz:foc[1]});
    chapa(g, nar, foc[1]);
    dentro(g, nar, foc[3], t => t.pol([[10,26],[16,28],[15,31],[8,30]]));
    dentro(g, nar, foc[5], t => t.cam([[10,27],[13,28]], 1));
    dentro(g, nar, foc[0], t => { t.ret(8,32,2,2); t.pt(7,34); });
    dentro(g, nar, foc[0], t => { t.ret(13,32,2,2); t.pt(15,34); });

    /* A BOCA: de perfil ela é um "3" deitado — sobe no lábio, cai no canto.
       Canto caído é cão; canto reto é gato. */
    dentro(g, C, foc[0], t => { t.curva([10,37],[19,42],[28,40], 2); });
    dentro(g, C, cre[5], t => { t.curva([10,35],[19,40],[28,38], 1); });
    dentro(g, C, foc[0], t => { t.cam([[28,41],[30,43]],1); });
    dentro(g, C, cre[4], t => { t.curva([11,39],[19,44],[27,42], 1); });
    dentro(g, C, cre[5], t => t.eli(12,40,2.4,1.2));

    /* A ORELHA CAÍDA, na parte ESCURA da mesma rampa do pelo e com o
       contorno todo escuro dos dois lados. Orelha do mesmo tom da cabeça,
       com contorno seletivo justo do lado que encosta nela, gruda no
       crânio e vira aba de capuz — foi o que aconteceu duas vezes aqui.
       Cão bicolor, de orelha escura, resolve sem inventar material novo. */
    const or = forma();
    or.pol([[42,14],[49,17],[54,25],[55,35],[52,44],[47,48],[42,45],[40,35],[40,22]]);
    or.menos(t => { t.eli(43,45,2,2); t.eli(55,30,2,2); t.eli(49,48,1.8,1.8); });
    /* a sombra que ela joga na bochecha, antes dela, com borda dura */
    projeta(g, C, or, pel, -3, 2);
    contorno(g, or, {tinta:TRACO, tintaLuz:TRACO});
    chapa(g, or, pel[1]);
    dentro(g, or, pel[2], t => t.pol([[41,15],[50,19],[52,30],[49,42],[44,46],[42,34]]));
    dentro(g, or, pel[0], t => t.pol([[50,22],[55,28],[54,40],[49,47],[47,40],[50,30]]));
    /* a dobra de cima, a única parte que pega luz de verdade */
    dentro(g, or, pel[3], t => t.pol([[41,15],[49,18],[51,23],[41,21]]));
    dentro(g, or, pel[4], t => t.cam([[42,16],[48,19]], 1));
    dentro(g, or, pel[0], t => t.cam([[41,22],[52,24]], 1));

    /* A COLEIRA: a peça de maior croma do ícone, e o único elemento que não
       é anatomia. Sozinha ela resolve o que forma nenhuma resolve. */
    const col = forma();
    col.pol([[27,48],[52,53],[50,60],[25,55]]);
    col.so(t => { t.m.set(pesc.m); t.pol([[20,44],[60,44],[60,62],[20,62]]); });
    const CO = peca(g, cor, t => { t.m.set(col.m); }, {corte:'tuboH', faixas:[1,2,2,2], base:3});
    dentro(g, CO, cor[5], t => t.cam([[27,48],[52,53]], 1));
    dentro(g, CO, cor[0], t => t.cam([[26,54],[50,59]], 1));
    for (const [x,y] of [[31,51],[36,52],[45,54]]) dentro(g, CO, cor[0], t => t.eli(x,y,1,1));
    rebite(g, CO, M.cromo, 29, 50);
    /* a argola e a plaquinha penduradas */
    const arg = forma(); arg.anel(41,55,4,4,2);
    contorno(g, arg, {tinta:TRACO, tintaLuz:M.cromo[1]});
    chapa(g, arg, M.cromo[2]);
    dentro(g, arg, M.cromo[4], t => t.arco(41,55,4,4,2,195,345));
    dentro(g, arg, M.cromo[0], t => t.arco(41,55,4,4,2,15,165));
    dentro(g, arg, M.cromo[5], t => t.pt(38,53));
    const pla = forma(); pla.eli(41,60,4,3);
    contorno(g, pla, {tinta:TRACO, tintaLuz:M.cromo[1]});
    chapa(g, pla, M.cromo[2]);
    dentro(g, pla, M.cromo[4], t => t.eli(40,59,2.4,1.6));
    dentro(g, pla, M.cromo[5], t => t.pt(39,58));
    dentro(g, pla, M.cromo[0], t => t.arco(41,60,4,3,1,20,160));
  };

  /* ARTES — a paleta. A madeira é padrão, não é luz: o veio atravessa a
     peça inteira e não muda de tom quando ela escurece. As tintas são
     manchas de dois tons cada, e é ali que mora a cor do ícone. */
  A.artes = g => {
    const mad = M.madeira;
    /* os pincéis, atrás */
    for (const [a,b,c,tin] of [[[57,3],[43,19],M.cobre,M.sangue], [[61,16],[47,29],M.latao,M.ceu]]) {
      /* o cabo */
      peca(g, mad, t => t.risco(a[0],a[1],b[0],b[1], 5), {corte:'esfera', giro:[1,1], faixas:[1,1,1,2], base:3});
      /* a virola de metal, com as duas ranhuras */
      const vir = peca(g, c, t => t.risco(b[0],b[1],b[0]-4,b[1]+4, 6),
        {corte:'esfera', giro:[1,1], faixas:[1,1,1,1], brilhoFaixa:1});
      dentro(g, vir, c[1], t => { t.cam([[b[0]-4,b[1]-1],[b[0]-1,b[1]+3]],1); });
      /* as cerdas: uma cunha escura, com a ponta molhada de tinta */
      const cer = forma(); cer.pol([[b[0]-3,b[1]+3],[b[0],b[1]+6],[b[0]-6,b[1]+13],[b[0]-9,b[1]+9]]);
      contorno(g, cer, {tinta:TRACO, tintaLuz:M.grafite[1]});
      chapa(g, cer, M.grafite[2]);
      dentro(g, cer, M.grafite[4], t => t.cam([[b[0]-3,b[1]+4],[b[0]-7,b[1]+9]], 1));
      dentro(g, cer, tin[3], t => t.pol([[b[0]-4,b[1]+8],[b[0]-1,b[1]+6],[b[0]-6,b[1]+13],[b[0]-8,b[1]+11]]));
    }
    /* a paleta: um rim com o buraco do polegar */
    const pal = forma();
    pal.pol([[6,26],[12,16],[26,12],[40,15],[50,24],[52,36],[44,48],[30,53],[16,50],[7,40]]);
    pal.menos(t => t.eli(36,40,7,6));
    const P = peca(g, mad, t => { t.m.set(pal.m); }, {corte:'esfera', faixas:[2,3,3,4], base:3});
    veio(g, P, mad[1], {n:4, semente:23});
    dentro(g, P, mad[4], t => t.arco(36,40,9,8,2,190,350));
    dentro(g, P, mad[1], t => t.arco(36,40,8,7,1,10,170));
    /* as tintas: seis manchas, cada uma com um tom e um realce. Mais que
       isso e a paleta vira confete. */
    const tintas = [[16,24,M.sangue],[27,20,M.ambar],[39,24,M.ceu],
                    [14,37,M.verde],[23,45,M.roxo]];
    for (const [x,y,c] of tintas) {
      const b = forma(); b.eli(x,y,4,3);
      contorno(g, b, {tinta:mad[0], tintaLuz:mad[1]});
      chapa(g, b, c[3]);
      dentro(g, b, c[1], t => t.eli(x+1,y+1,4,3));
      dentro(g, b, c[4], t => t.eli(x-1,y-1,3,2));
    }
  };

  /* DIPLOMACIA — o aperto de mão. Duas mãos a essa altura só leem se
     houver uma COSTURA visível entre elas: o vinco onde uma entra na
     outra, e o polegar de cima passando por cima do punho de baixo. */
  A.diplomacia = g => {
    const frente = M.porcelana, fundo = M.ceu, gra = M.grafite;
    /* Duas mãos apertadas não leem a 64 pixels: viram um braço. O que lê
       é a CONVERSA — dois balões, um na frente do outro, com espessura de
       esmalte: chanfro claro em cima, chanfro escuro embaixo, e um
       alto-brilho duro de poucos pixels. */
    const balao = (mat, cx, cy, w, h, rabo, linhas) => {
      const b = forma();
      b.ret(cx - w/2 + 3, cy - h/2, w - 6, h);
      b.ret(cx - w/2, cy - h/2 + 3, w, h - 6);
      b.eli(cx - w/2 + 3, cy - h/2 + 3, 3, 3);
      b.eli(cx + w/2 - 4, cy - h/2 + 3, 3, 3);
      b.eli(cx - w/2 + 3, cy + h/2 - 4, 3, 3);
      b.eli(cx + w/2 - 4, cy + h/2 - 4, 3, 3);
      b.pol(rabo);
      contorno(g, b, {tinta:TRACO, tintaLuz:mat[1]});
      chapa(g, b, mat[3]);
      /* o chanfro */
      dentro(g, b, mat[5], t => { t.ret(cx-w/2+3, cy-h/2, w-6, 1); t.ret(cx-w/2, cy-h/2+3, 1, h-6);
        t.eli(cx-w/2+3, cy-h/2+3, 4, 4); });
      dentro(g, b, mat[4], t => { t.ret(cx-w/2+3, cy-h/2+1, w-8, 1); t.ret(cx-w/2+1, cy-h/2+3, 1, h-8); });
      dentro(g, b, mat[3], t => t.eli(cx-w/2+3, cy-h/2+3, 2, 2));
      dentro(g, b, mat[1], t => { t.ret(cx-w/2+4, cy+h/2-1, w-7, 1); t.ret(cx+w/2-1, cy-h/2+4, 1, h-7);
        t.pol(rabo); });
      dentro(g, b, mat[2], t => { t.ret(cx-w/2+4, cy+h/2-2, w-8, 1); t.ret(cx+w/2-2, cy-h/2+4, 1, h-8); });
      /* as linhas de fala: comprimentos diferentes, nunca duas iguais
         encostadas — é o que evita a faixa */
      for (const [x0,y0,x1] of linhas) {
        dentro(g, b, mat[0], t => t.ret(x0, y0, x1 - x0, 2));
        dentro(g, b, mat[5], t => t.ret(x0, y0 + 2, x1 - x0, 1));
      }
      return b;
    };
    /* o balão de trás, escuro */
    const b2 = balao(fundo, 40, 24, 34, 26, [[46,34],[54,44],[42,36]],
      [[28,17,50],[28,22,44],[28,27,48],[28,32,40]]);
    /* os três pontos de "está escrevendo": detalhe pequeno e contado, do
       tipo que a sessenta e quatro ainda cabe */
    for (const x of [28,33,38]) { dentro(g, b2, fundo[5], t => t.eli(x,12,1.4,1.4)); }
    /* o da frente, claro, cobrindo um canto do outro */
    const f = balao(frente, 24, 42, 36, 26, [[16,52],[8,60],[22,54]],
      [[11,33,35],[11,38,29],[11,43,33],[11,48,25]]);
    /* o alto-brilho: um risco duro, curto, na beirada da luz */
    dentro(g, f, '#ffffff', t => { t.ret(9,33,10,1); t.ret(8,34,1,4); });
  };

  /* ENGANAÇÃO — a máscara de porcelana rachada. Porcelana é lisa: é o
     único material do conjunto que ganha antisserrilhado de verdade, e é
     por isso que a rachadura precisa ser DURA — o contraste entre a curva
     macia e a linha quebrada é o ícone inteiro. */
  A.enganacao = g => {
    const por = M.porcelana, fit = M.roxo;
    /* a fita de amarrar, atrás, atravessando a testa */
    peca(g, fit, t => { t.pol([[2,16],[12,13],[12,20],[2,23]]); t.pol([[52,13],[62,17],[62,24],[52,20]]); },
      {corte:'tuboH', faixas:[1,1,1,2], base:3});
    /* o rosto: um oval que afina no queixo */
    const face = forma();
    face.pol([[32,4],[44,7],[52,15],[54,26],[51,38],[44,50],[35,58],[29,58],[20,50],[13,38],[10,26],[12,15],[20,7]]);
    const f = peca(g, por, t => { t.m.set(face.m); }, {corte:'esfera', faixas:[2,3,4,5], base:3});
    /* a testa e a maçã do rosto pegam a luz; o queixo devolve um pouco */
    dentro(g, f, por[5], t => { t.eli(24,14,8,5); t.eli(20,30,4,6); });
    dentro(g, f, por[4], t => { t.eli(40,15,6,4); t.eli(41,32,5,5); });
    dentro(g, f, por[1], t => { t.eli(32,40,9,5); });
    /* os buracos dos olhos: amêndoas vazias, e é o VAZIO que assusta */
    for (const [x,y,d] of [[23,25,1],[41,25,-1]]) {
      const olho = forma();
      olho.pol([[x-8*d,y+1],[x-4*d,y-4],[x+3*d,y-4],[x+8*d,y],[x+3*d,y+4],[x-4*d,y+4]]);
      chapa(g, olho, '#060410');
      dentro(g, olho, mistura('#060410', por[1], .5), t => t.cam([[x-8*d,y+1],[x-4*d,y-3]],1));
      contorno(g, olho, {tinta:por[1]});
      dentro(g, f, por[5], t => t.cam([[x-7*d,y+4],[x+3*d,y+5]], 1));
    }
    /* a boca: um sorriso torto, e torto é o ponto */
    dentro(g, f, '#060410', t => { t.curva([20,42],[32,55],[46,38], 4); });
    dentro(g, f, por[5], t => { t.curva([20,46],[32,59],[46,42], 1); });
    dentro(g, f, por[1], t => { t.curva([20,40],[32,52],[46,36], 1); });
    dentro(g, f, mistura('#060410', por[3], .45), t => { t.curva([24,45],[32,53],[42,41], 1); });
    /* os dentes da fenda: quatro traços, que é o que faz a boca ler como
       boca e não como risco */
    for (const dx of [-8,-3,3,8]) dentro(g, f, por[2], t => t.cam([[32+dx,45],[32+dx,50]], 1));
    /* a rachadura: linha quebrada, dura, nunca curva, com um fio de luz de
       um lado só — é assim que se vê que a peça tem espessura */
    const rac = [[30,4],[28,12],[32,18],[29,26],[31,34],[27,42],[30,50],[27,57]];
    const r1 = forma(); r1.cam(rac, 1); r1.so(t => t.m.set(face.m));
    chapa(g, desloca(r1,-1,0), por[4]);
    chapa(g, r1, mistura('#0d0910', por[1], .4));
    const r2 = forma(); r2.cam([[31,34],[38,30],[44,31]], 1); r2.so(t => t.m.set(face.m));
    chapa(g, desloca(r2,0,-1), por[4]);
    chapa(g, r2, mistura('#0d0910', por[1], .4));
    /* lascas soltas na borda da rachadura */
    for (const [x,y] of [[29,9],[31,22],[28,38],[40,30]]) { g.dot(x,y,mistura('#0d0910', por[1], .4)); g.dot(x-1,y-1,por[4]); }
  };

  /* INTIMIDAÇÃO — o crânio. Osso é fosco e NUNCA chega ao branco puro: o
     branco é reservado a metal e vidro. A luz só encosta em três lugares —
     testa, arco da sobrancelha e maçã do rosto. Todo o resto é meio-tom. */
  A.intimidacao = g => {
    const oss = M.osso;
    /* a mandíbula, atrás, para a caveira passar por cima */
    peca(g, oss, t => t.pol([[18,40],[46,40],[45,52],[38,58],[26,58],[19,52]]),
      {corte:'esfera', faixas:[1,2,3,3], base:2});
    /* a caixa craniana: uma peça só */
    const cra = forma();
    cra.pol([[32,4],[44,7],[53,16],[55,28],[51,38],[45,43],[42,48],[22,48],[19,43],[13,38],[9,28],[11,16],[20,7]]);
    const c = peca(g, oss, t => { t.m.set(cra.m); }, {corte:'esfera', faixas:[2,3,4,5], base:3});
    /* os três planos que a luz encontra */
    dentro(g, c, oss[5], t => { t.eli(25,14,9,6); });
    dentro(g, c, oss[4], t => { t.eli(41,15,7,5); t.eli(17,26,4,5); t.eli(46,28,4,5); });
    dentro(g, c, oss[1], t => { t.eli(32,36,12,6); t.eli(32,45,8,4); });
    /* as órbitas: o preto mais fundo do ícone, com a borda de cima
       encostando num fio claro — é a borda que faz o buraco ter beirada */
    for (const [x,d] of [[23,1],[41,-1]]) {
      const orb = forma();
      orb.pol([[x-8*d,22],[x-3*d,18],[x+4*d,19],[x+8*d,25],[x+6*d,32],[x-1*d,34],[x-7*d,30]]);
      chapa(g, orb, '#060409');
      dentro(g, orb, mistura('#060409', oss[2], .45), t => t.cam([[x-8*d,23],[x-3*d,19],[x+4*d,20]], 1));
      dentro(g, orb, mistura('#060409', oss[1], .35), t => t.eli(x+4*d,29,3,2));
      contorno(g, orb, {tinta:oss[1]});
      dentro(g, c, oss[5], t => t.cam([[x-8*d,20],[x-3*d,16],[x+4*d,17]], 1));
    }
    /* o nariz: um coração de ponta-cabeça, vazio */
    const nar = forma(); nar.pol([[32,33],[37,41],[34,44],[32,41],[30,44],[27,41]]);
    chapa(g, nar, '#060409');
    dentro(g, nar, mistura('#060409', oss[2], .4), t => t.cam([[32,34],[36,41]], 1));
    dentro(g, c, oss[5], t => t.cam([[32,32],[27,40]], 1));
    /* os dentes: contados, com o vão escuro entre eles */
    const arc = forma(); arc.pol([[20,47],[44,47],[42,56],[36,59],[28,59],[22,56]]);
    chapa(g, arc, oss[3]);
    contorno(g, arc, {tinta:TRACO, tintaLuz:oss[1]});
    dentro(g, arc, oss[0], t => t.cam([[20,48],[44,48]], 1));
    /* os dentes: larguras diferentes, altura diferente, e o vão entre eles
       não vai até embaixo. Dente igualzinho em fila vira pente. */
    const largs = [4,3,4,5,4,3,4];
    let x = 21;
    for (let k = 0; k < largs.length; k++) {
      const w = largs[k], h = k === 0 || k === largs.length - 1 ? 6 : (k === 3 ? 10 : 8);
      dentro(g, arc, oss[5], t => t.ret(x, 49, w - 1, h - 3));
      dentro(g, arc, oss[1], t => t.ret(x + w - 1, 49, 1, h));
      dentro(g, arc, oss[2], t => t.ret(x, 49 + h - 2, w - 1, 2));
      x += w;
    }
    dentro(g, arc, oss[1], t => t.pol([[20,56],[44,56],[42,57],[22,57]]));
    /* a trinca e as manchas: pouco, e tudo na parte iluminada */
    const tri = forma(); tri.cam([[40,8],[44,14],[41,20],[45,25]], 1); tri.so(t => t.m.set(cra.m));
    chapa(g, desloca(tri,-1,0), oss[5]);
    chapa(g, tri, oss[0]);
    const tri2 = forma(); tri2.cam([[14,20],[11,26],[14,31]], 1); tri2.so(t => t.m.set(cra.m));
    chapa(g, desloca(tri2,1,0), oss[5]); chapa(g, tri2, oss[0]);
    const tri3 = forma(); tri3.cam([[28,10],[31,14],[29,18]], 1); tri3.so(t => t.m.set(cra.m));
    chapa(g, desloca(tri3,-1,0), oss[5]); chapa(g, tri3, oss[1]);
    /* as suturas do crânio: duas linhas serrilhadas, que é o detalhe que
       separa caveira de abóbora */
    const sut = forma();
    for (let k = 0; k < 9; k++) sut.cam([[20+k*3, 12+(k%2?1:-1)], [23+k*3, 12+(k%2?-1:1)]], 1);
    sut.so(t => t.m.set(cra.m));
    chapa(g, desloca(sut,0,-1), oss[5]); chapa(g, sut, oss[1]);
    salpico(g, (()=>{const f=forma();f.eli(26,17,9,5);return f;})(), oss[2], {n:5, semente:29});
    salpico(g, (()=>{const f=forma();f.eli(46,30,5,6);return f;})(), oss[2], {n:4, semente:37});
  };

  /* INTUIÇÃO — a mão em concha e a luz que pousa nela. A luz é a única
     coisa do conjunto que se desenha de dentro para fora: miolo branco,
     três cascas esfriando, e os raios contados. */
  A.intuicao = g => {
    const pel = M.pele, luz = M.verde;
    /* o clarão vai primeiro, para a mão ficar DENTRO dele */
    chapa(g, (()=>{const f=forma();f.eli(30,16,20,15);return f;})(), mistura('#0b0a14', luz[1], .3));
    chapa(g, (()=>{const f=forma();f.eli(30,16,14,11);return f;})(), mistura('#0b0a14', luz[2], .4));
    /* A mão: palma embaixo, quatro dedos em cima com VÃO DE DOIS PIXELS
       entre eles. É o vão na silhueta que faz a mão ler; vinco pintado por
       dentro de uma mancha só nunca fez. */
    const dedos = [[16,29],[25,25],[34,25],[43,29]];
    const mao = forma();
    mao.pol([[12,48],[13,42],[47,42],[48,48],[46,56],[36,61],[24,61],[14,56]]);
    for (const [x,y] of dedos) { mao.ret(x-3, y, 7, 46-y); mao.eli(x, y, 3.2, 3.2); }
    /* o polegar: sai pela esquerda e SOBE, com a ponta virada para dentro.
       Polegar reto para o lado lê como quinto dedo. */
    mao.pol([[13,48],[8,42],[4,34],[9,31],[14,38],[15,46]]);
    mao.eli(6, 32, 4, 4);
    const m = peca(g, pel, t => { t.m.set(mao.m); }, {corte:'esfera', faixas:[1,2,2,4], base:3});
    /* a palma é côncava: funda no meio, clara na borda de dentro. É o
       contrário de uma bola, e é o que faz a mão virar concha. */
    dentro(g, m, pel[2], t => t.eli(30,54,12,4));
    dentro(g, m, pel[1], t => t.eli(30,55,7,2));
    dentro(g, m, pel[4], t => { t.cam([[15,45],[15,55]],1); t.cam([[8,35],[12,44]],1); });
    /* a linha das juntas, e a sombra que cada dedo joga no vizinho */
    for (const [x,y] of dedos) {
      dentro(g, m, pel[1], t => { t.ret(x-3, 44, 7, 1); t.ret(x+3, y+2, 1, 42-y); });
      dentro(g, m, pel[4], t => t.ret(x-3, y+2, 1, 42-y));
    }
    dentro(g, m, pel[1], t => t.cam([[12,46],[9,38]], 1));
    /* só a CRISTA das pontas pega o verde: duas fileiras, não a ponta
       inteira, senão os dedos leem como garras separadas */
    for (const [x,y] of dedos) {
      dentro(g, m, mistura(pel[5], luz[4], .45), t => t.ret(x-2, y-3, 5, 1));
      dentro(g, m, mistura(pel[4], luz[3], .3), t => t.ret(x-3, y-2, 7, 1));
    }
    dentro(g, m, mistura(pel[5], luz[4], .45), t => t.ret(4,29,4,1));
    /* as unhas */
    for (const [x,y] of dedos) dentro(g, m, pel[5], t => t.eli(x-1, y+1, 2, 1.6));
    dentro(g, m, pel[5], t => t.eli(5,32,1.8,1.6));
    /* a luz: quatro cascas e um miolo */
    const casca = (r, cor) => { const f = forma(); f.eli(30,16,r,r); chapa(g, f, cor); };
    casca(9, luz[1]); casca(7, luz[2]); casca(5, luz[3]); casca(3, luz[4]); casca(1, '#f2fff4');
    const raios = [[0,-15],[11,-11],[15,0],[10,10],[-10,10],[-15,-1],[-11,-11]];
    for (let k = 0; k < raios.length; k++) {
      const [dx,dy] = raios[k], n = k % 2 ? 4 : 6;
      const f = forma();
      f.cam([[30+dx*0.78, 16+dy*0.78],[30+dx*(0.78+n/17), 16+dy*(0.78+n/17)]], 1);
      chapa(g, f, luz[k % 3 ? 3 : 4]);
    }
    for (const [x,y] of [[12,5],[48,8],[43,3],[10,13]]) g.dot(x,y, luz[4]);
  };

  /* RELIGIÃO — o terço. Contas são esferas de cinco pixels, e esfera de
     cinco pixels não cabe seis tons: três, e o realce é UM pixel. */
  A.religiao = g => {
    const con = M.madeira, met = M.ouro;
    /* o cordão */
    const fio = forma();
    fio.curva([31,4],[6,16],[15,38], 2);
    fio.curva([31,4],[56,16],[47,38], 2);
    fio.cam([[15,38],[31,45],[47,38]], 2);
    chapa(g, fio, con[0]);
    /* Uma conta é uma bola de sete pixels, e bola de sete pixels não
       aguenta seis tons: três, e o realce é UM pixel no alto à esquerda. */
    /* Uma conta é uma bola de sete pixels, e bola de sete pixels não
       aguenta seis tons: três, e o realce é UM pixel no alto à esquerda.
       A sombra entra como ARCO e não como elipse deslocada, senão a conta
       fica com dente e lê como engrenagem. */
    const conta = (x, y, mat, r) => {
      const b = forma(); b.eli(x,y,r,r);
      contorno(g, b, {tinta:TRACO, tintaLuz:mat[1]});
      chapa(g, b, mat[3]);
      dentro(g, b, mat[1], t => t.arco(x, y, r, r, 2, 15, 165));
      dentro(g, b, mat[4], t => t.arco(x, y, r, r, 2, 195, 345));
      g.dot(x-1, y-1, mat[5]);
    };
    const caminho = [];
    for (let k = 1; k < 8; k++) { const t = k/8, u = 1-t;
      caminho.push([u*u*31+2*u*t*6+t*t*15, u*u*4+2*u*t*16+t*t*38]); }
    for (let k = 1; k < 8; k++) { const t = k/8, u = 1-t;
      caminho.push([u*u*31+2*u*t*56+t*t*47, u*u*4+2*u*t*16+t*t*38]); }
    for (let i = 0; i < caminho.length; i++)
      conta(Math.round(caminho[i][0]), Math.round(caminho[i][1]), i % 5 === 2 ? M.roxo : con, 3);
    conta(31, 4, met, 3);
    conta(21, 42, con, 3); conta(31, 45, met, 3); conta(41, 42, con, 3);
    /* a cruz: duas faces chatas e um chanfro. Nada de curva. */
    const cruz = forma(); cruz.ret(28,46,7,16); cruz.ret(22,52,19,6);
    const c = peca(g, met, t => { t.m.set(cruz.m); }, {corte:'chato', base:3});
    /* O chanfro de uma cruz a essa altura é UMA linha clara em cima e à
       esquerda e UMA escura embaixo e à direita. Duas linhas de cada lado
       viram gancho — foi o que aconteceu na primeira tentativa. */
    const quina = (claro) => {
      const f = forma();
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        if (!cruz.tem(x, y)) continue;
        if (claro && (!cruz.tem(x, y - 1) || !cruz.tem(x - 1, y))) f.pt(x, y);
        if (!claro && (!cruz.tem(x, y + 1) || !cruz.tem(x + 1, y))) f.pt(x, y);
      }
      return f;
    };
    chapa(g, quina(true), met[5]);
    chapa(g, quina(false), met[1]);
    /* o vinco do meio, que é o que diz que a cruz tem duas faces */
    dentro(g, c, met[0], t => { t.ret(31,47,1,14); t.ret(23,54,17,1); });
    dentro(g, c, met[4], t => { t.ret(30,47,1,14); t.ret(23,53,17,1); });
    dentro(g, c, met[5], t => { t.ret(29,48,1,3); });
  };

  /* VONTADE — o coração acorrentado. O que conta aqui é o contraste de
     material: carne é fosca e não tem brilho nenhum; o aço tem branco
     encostado no preto. Um ao lado do outro, cada um fica mais ele mesmo. */
  A.vontade = g => {
    const car = M.sangue, aco = M.aco;
    /* os vasos, atrás */
    peca(g, car, t => { t.curva([26,16],[22,6],[15,5], 4); t.curva([36,15],[42,7],[50,9], 4);
      t.curva([31,14],[31,6],[34,3], 4); }, {corte:'tuboV', faixas:[1,1,2,2], base:2});
    /* o coração: uma peça só */
    const cor = forma();
    cor.pol([[31,18],[38,12],[48,13],[54,21],[53,33],[45,45],[34,56],[26,50],[16,40],[10,29],[10,19],[18,12],[27,13]]);
    const c = peca(g, car, t => { t.m.set(cor.m); }, {corte:'esfera', faixas:[2,2,3,4], base:3});
    /* os dois lobos: um vinco fundo entre eles, e cada um com seu realce */
    dentro(g, c, car[1], t => t.curva([31,17],[30,28],[34,44], 2));
    dentro(g, c, car[4], t => { t.eli(20,24,7,6); t.eli(42,25,5,5); });
    dentro(g, c, car[5], t => { t.eli(19,22,4,3); });
    dentro(g, c, car[0], t => { t.eli(41,43,6,5); });
    dentro(g, c, car[2], t => t.arco(33,44,14,13,2,20,120));
    dentro(g, c, car[4], t => t.eli(38,30,6,7));
    /* a corrente: elos alternando em pé e deitado, que é o que faz corrente
       parecer corrente e não uma cobra de bolinhas */
    /* Um elo é um anel com BURACO, e uma corrente é uma fila de elos que
       se TOCAM. Elo espaçado vira colar de contas. E corrente em volta,
       feito coroa, não amarra nada: ela tem que ATRAVESSAR o coração. */
    const elo = (x, y, vert, sombra) => {
      const rx = vert ? 3 : 6, ry = vert ? 6 : 3;
      const fora = forma(); fora.eli(x, y, rx, ry);
      if (sombra) chapa(g, desloca(fora, 2, 3), mistura(TRACO, car[0], .5));
      contorno(g, fora, {tinta:TRACO, tintaLuz:aco[1]});
      chapa(g, fora, aco[1]);
      dentro(g, fora, aco[3], t => t.eli(x - 1, y - 1, rx, ry));
      dentro(g, fora, aco[5], t => t.eli(x - rx + 1, y - ry + 1, 1, 1));
      /* o buraco: a parede de dentro é o inverso da de fora — clara
         embaixo, escura em cima. É isso que dá o vazado. */
      const furo = forma(); furo.eli(x, y, rx - 2.5, ry - 2.5);
      chapa(g, furo, mistura(TRACO, car[0], .35));
      dentro(g, furo, aco[0], t => t.arco(x, y, rx - 2.5, ry - 2.5, 1, 20, 160));
      dentro(g, furo, aco[2], t => t.arco(x, y, rx - 2.5, ry - 2.5, 1, 200, 340));
    };
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      elo(Math.round(8 + t * 48), Math.round(53 - t * 26), k % 2 === 0, true);
    }
    /* o elo que está cedendo: aberto, com a ponta clara */
    const rompe = forma(); rompe.anel(53,18,5,4,2); rompe.menos(t => t.pol([[53,13],[61,14],[60,21],[53,19]]));
    contorno(g, rompe, {tinta:TRACO, tintaLuz:aco[1]});
    chapa(g, rompe, aco[3]);
    dentro(g, rompe, aco[5], t => t.ret(49,15,2,1));
    dentro(g, rompe, aco[0], t => t.arco(53,18,5,4,2,20,160));
    g.dot(57,15, aco[5]); g.dot(56,22, aco[5]);
  };

  /* =========================== SUBSTÂNCIA ============================ */

  /* ACROBACIA — a figura no ar. Corpo se desenha como UMA silhueta só; o
     corpo montado de pedaços ganha um contorno preto em cada junta e vira
     boneco articulado. A roupa vem pintada por dentro, depois. */
  A.acrobacia = g => {
    const pel = M.pele, rou = M.ceu, cal = M.pano, sap = M.grafite;
    /* o rastro do salto: o que diz "acrobacia" e não "uma pessoa" */
    for (let k = 0; k < 22; k++) {
      const a = 2.7 - k * 0.135, r = 28;
      const x = 32 + Math.cos(a) * r, y = 33 + Math.sin(a) * r * 0.95;
      g.dot(Math.round(x), Math.round(y), mistura('#0b0a14', rou[4], k % 4 === 0 ? .7 : .4));
      if (k % 4 === 0) g.dot(Math.round(x) + 1, Math.round(y), mistura('#0b0a14', rou[3], .45));
    }
    /* a silhueta inteira: cabeça, tronco, dois braços abertos, duas pernas
       em tesoura */
    const corpo = forma();
    corpo.eli(31, 15, 6, 6.5);                       /* cabeça */
    corpo.pol([[25,21],[37,21],[40,32],[36,42],[27,42],[23,32]]);  /* tronco */
    corpo.cam([[26,24],[14,18],[6,10]], 5);          /* braço esquerdo */
    corpo.cam([[37,24],[49,20],[58,14]], 5);         /* braço direito */
    corpo.cam([[28,40],[20,48],[10,54]], 6);         /* perna esquerda */
    corpo.cam([[36,40],[45,47],[54,52]], 6);         /* perna direita */
    const c = peca(g, pel, t => { t.m.set(corpo.m); }, {corte:'esfera', faixas:[2,2,3,3], base:3});
    /* a roupa, pintada DENTRO da silhueta */
    dentro(g, c, rou[3], t => { t.pol([[24,21],[38,21],[41,33],[36,43],[26,43],[22,33]]);
      t.cam([[26,24],[16,19]], 6); t.cam([[37,24],[47,21]], 6); });
    dentro(g, c, rou[1], t => { t.pol([[33,21],[38,21],[41,33],[36,43],[32,43]]);
      t.cam([[38,25],[47,22]], 4); });
    dentro(g, c, rou[4], t => { t.pol([[25,22],[30,22],[28,34],[24,32]]);
      t.cam([[26,22],[17,17]], 2); });
    dentro(g, c, rou[5], t => t.cam([[26,23],[18,18]], 1));
    dentro(g, c, cal[3], t => { t.pol([[25,40],[38,40],[36,46],[27,46]]);
      t.cam([[28,42],[21,49]], 6); t.cam([[36,42],[44,48]], 6); });
    dentro(g, c, cal[1], t => { t.pol([[32,40],[38,40],[36,46],[32,46]]);
      t.cam([[37,43],[44,49]], 4); });
    dentro(g, c, cal[4], t => t.cam([[27,42],[21,48]], 2));
    dentro(g, c, sap[2], t => { t.eli(11,54,4,3.5); t.eli(53,52,4,3.5); });
    dentro(g, c, sap[4], t => { t.cam([[8,53],[13,52]],1); t.cam([[50,51],[55,51]],1); });
    /* o cabelo e o rosto de perfil */
    dentro(g, c, M.couro[0], t => { t.eli(31,11,6,4.5); t.pol([[25,10],[28,20],[24,18]]);
      t.pol([[36,10],[39,16],[36,15]]); });
    dentro(g, c, M.couro[2], t => { t.cam([[27,8],[35,9]], 1); t.cam([[26,12],[25,17]], 1); });
    dentro(g, c, M.couro[1], t => t.cam([[29,9],[34,10]], 1));
    dentro(g, c, pel[5], t => t.eli(30,15,3,3));
    dentro(g, c, pel[1], t => t.eli(34,17,2,2));
    dentro(g, c, M.grafite[0], t => { t.pt(33,14); t.pt(28,14); });
    /* as mãos */
    dentro(g, c, pel[4], t => { t.eli(7,11,3,3); t.eli(56,15,3,3); });
  };

  /* CRIME — o cadeado e as gazuas. O ferrolho é aço e a caixa é latão: dois
     metais lado a lado, cada um com sua rampa, é o que faz os dois
     parecerem metal de verdade em vez de cinza e amarelo. */
  A.crime = g => {
    const aco = M.aco, lat = M.latao;
    /* o ferrolho, atrás */
    const ferro = forma(); ferro.anel(32, 24, 13, 13, 5); ferro.menos(t => t.ret(0,26,64,20));
    ferro.ret(20,24,5,14); ferro.ret(40,24,5,10);
    peca(g, aco, t => { t.m.set(ferro.m); }, {corte:'tuboV', faixas:[1,2,2,2], brilhoFaixa:1});
    /* a caixa */
    const caixa = forma();
    caixa.ret(11,33,42,26); caixa.eli(15,37,4,4); caixa.eli(48,37,4,4);
    caixa.eli(15,54,4,4); caixa.eli(48,54,4,4);
    const cx = peca(g, lat, t => { t.m.set(caixa.m); }, {corte:'tuboV', faixas:[2,3,4,5], brilhoFaixa:1});
    /* o chanfro da frente: uma moldura rebaixada */
    dentro(g, cx, lat[1], t => t.ret(15,37,34,18));
    dentro(g, cx, lat[2], t => t.ret(16,38,32,16));
    dentro(g, cx, lat[0], t => { t.ret(15,37,34,1); t.ret(15,37,1,18); });
    dentro(g, cx, lat[5], t => { t.ret(16,54,33,1); t.ret(48,38,1,17); });
    /* a fechadura: o buraco mais fundo do ícone */
    const buraco = forma(); buraco.eli(32,42,4,4); buraco.pol([[29,44],[35,44],[36,52],[28,52]]);
    chapa(g, buraco, '#060409');
    dentro(g, buraco, mistura('#060409', lat[1], .5), t => t.arco(32,42,4,4,1,190,350));
    contorno(g, buraco, {tinta:lat[1]});
    dentro(g, cx, lat[4], t => t.arco(32,42,6,6,1,20,160));
    /* a plaqueta gravada embaixo da fechadura, para o latão não ficar
       liso demais */
    dentro(g, cx, lat[1], t => t.ret(20,54,24,3));
    dentro(g, cx, lat[4], t => t.ret(20,53,24,1));
    for (let k = 0; k < 6; k++) dentro(g, cx, lat[0], t => t.ret(22 + k*4, 55, 2, 1));
    /* as gazuas: dois arames de dois pixels entrando no buraco. Arame de um
       pixel some; de três vira chave de fenda. */
    /* arame de um pixel some; de quatro vira chave de fenda. Dois: um
       claro e um escuro logo abaixo, que é o cilindro inteiro. */
    for (const cam of [[[56,9],[46,24],[36,38]], [[9,15],[20,28],[28,38]]]) {
      const a = forma(); a.cam(cam, 1);
      const b = forma(); b.cam(cam.map(q => [q[0], q[1] + 1]), 1);
      const c = forma(); c.cam(cam.map(q => [q[0], q[1] + 2]), 1);
      const todo = forma(); todo.m.set(a.m); todo.mais(t => t.m.set(b.m)); todo.mais(t => t.m.set(c.m));
      contorno(g, todo, {tinta:TRACO});
      chapa(g, c, M.cromo[0]);
      chapa(g, b, M.cromo[2]);
      chapa(g, a, M.cromo[5]);
    }
    peca(g, M.grafite, t => { t.risco(56,9,61,4, 5); t.risco(9,15,4,10, 5); },
      {corte:'esfera', faixas:[1,1,1,1], base:3});
    /* os riscos de quem já forçou essa caixa antes */
    arranhao(g, cx, lat, [[19,41,26,40]]);
    for (const [x,y] of [[15,37],[48,37],[15,54],[48,54],[15,45],[48,45]]) rebite(g, cx, aco, x, y);
    /* o desgaste em volta da fechadura: onde a chave raspa todo dia */
    salpico(g, (()=>{const f=forma();f.anel(32,44,10,9,3);return f;})(), lat[1], {n:7, semente:97});
  };

  /* FURTIVIDADE — o vulto encapuzado. É o único ícone do conjunto que se
     desenha quase todo em UM tom escuro: o que dá forma não é a luz de
     cima, é a LUZ DE BORDA, um fio claro de um pixel no contorno voltado
     para a luz. Sem ela, é uma mancha; com ela, é uma pessoa. */
  A.furtividade = g => {
    const bre = M.breu, pan = M.pano;
    /* o vulto: capuz e ombros numa peça só */
    const vulto = forma();
    vulto.pol([[32,6],[42,10],[47,20],[48,32],[54,38],[59,52],[60,60],[4,60],[5,50],[10,38],[16,32],[16,20],[22,10]]);
    const v = peca(g, bre, t => { t.m.set(vulto.m); }, {corte:'esfera', faixas:[2,3,4,4], base:1});
    /* o pano do capuz: dobras que saem de onde ele é puxado */
    dentro(g, v, bre[2], t => { t.curva([22,12],[18,24],[19,34], 2); t.curva([42,11],[47,22],[46,33], 2); });
    dentro(g, v, bre[0], t => { t.curva([24,13],[20,25],[21,35], 1); t.curva([40,12],[45,23],[44,34], 1); });
    dentro(g, v, bre[3], t => { t.curva([21,13],[17,25],[18,35], 1); });
    /* as dobras saem dos pontos de tensão — o ombro e o alto do capuz —
       e abrem para baixo. Dobra paralela de largura igual é a versão em
       pano da faixa de cor. */
    dobra(g, v, bre, [[12,40],[8,58]]);
    dobra(g, v, bre, [[52,40],[56,58]]);
    dobra(g, v, bre, [[25,46],[22,60]]);
    dobra(g, v, bre, [[41,47],[44,60]]);
    /* o vazio do capuz: preto de verdade, com só um fio de borda */
    const oco = forma();
    oco.pol([[32,14],[40,18],[41,28],[36,38],[28,38],[23,28],[24,18]]);
    chapa(g, oco, '#050309');
    dentro(g, oco, mistura('#050309', bre[2], .5), t => t.cam([[24,19],[31,15]], 1));
    contorno(g, oco, {tinta:bre[1]});
    /* os dois olhos, a única coisa clara dentro do capuz */
    dentro(g, oco, mistura(pan[5], '#050309', .25), t => { t.ret(27,26,3,2); t.ret(34,26,3,2); });
    dentro(g, oco, pan[5], t => { t.pt(28,26); t.pt(35,26); });
    /* A LUZ DE BORDA: um pixel claro no contorno de cima e da esquerda. É
       o ícone inteiro. */
    const borda = forma();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (!vulto.tem(x,y)) continue;
      if (!vulto.tem(x-1,y-1) || !vulto.tem(x,y-1) || !vulto.tem(x-1,y)) borda.pt(x,y);
    }
    chapa(g, borda, bre[4]);
    const borda2 = forma();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (borda.tem(x,y) && (!vulto.tem(x-1,y-1) && !vulto.tem(x-2,y))) borda2.pt(x,y);
    }
    chapa(g, borda2, bre[5]);
  };

  /* INICIATIVA — o cronômetro. Caixa de cromo com a faixa do horizonte,
     mostrador chato de osso, ponteiro vermelho e o raio por cima. */
  A.iniciativa = g => {
    const cro = M.cromo, oss = M.osso, ver = M.sangue, amb = M.ambar;
    /* a coroa e as duas orelhas, atrás */
    peca(g, cro, t => { t.ret(28,2,9,6); t.risco(19,12,15,8, 5); t.risco(45,12,49,8, 5); },
      {corte:'tuboV', faixas:[1,1,1,2], brilhoFaixa:1});
    dentro(g, (()=>{const f=forma();f.ret(28,2,9,6);return f;})(), cro[1],
      t => { t.cam([[30,2],[30,7]],1); t.cam([[33,2],[33,7]],1); });
    /* a caixa */
    const caixa = forma(); caixa.eli(32,36,23,23);
    contorno(g, caixa, {tinta:TRACO, tintaLuz:cro[1]});
    horizonte(g, caixa, cro, 33, {alto:1, arco:-3});
    /* o mostrador: uma face chata, um tom só */
    const face = forma(); face.eli(32,36,18,18);
    contorno(g, face, {tinta:cro[0]});
    /* o mostrador é uma FACE CHATA: um tom só, e o que dá a espessura é o
       anel de sombra colado na borda de baixo — não um degradê por cima
       dela inteira, que foi o que deixou o relógio encardido. */
    chapa(g, face, oss[5]);
    dentro(g, face, oss[3], t => t.arco(32,36,18,18,2,15,165));
    dentro(g, face, oss[4], t => t.arco(32,36,16,16,1,20,160));
    /* os traços das horas: contados, e os de quarto mais grossos */
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6 - Math.PI / 2, gro = k % 3 === 0;
      const r0 = gro ? 12 : 14, r1 = 17;
      const f = forma();
      f.risco(32 + Math.cos(a)*r0, 36 + Math.sin(a)*r0, 32 + Math.cos(a)*r1, 36 + Math.sin(a)*r1, gro ? 2 : 1);
      f.so(t => t.eli(32,36,18,18));
      chapa(g, f, gro ? M.grafite[1] : M.grafite[3]);
    }
    /* o sub-mostrador dos minutos: só o aro e um ponteiro. É o detalhe que
       diz "cronômetro" e não "relógio", e três tons bastam — mais que isso
       e o mostrador fica encardido, que foi o que aconteceu na primeira
       tentativa. */
    dentro(g, face, oss[4], t => t.anel(30,47,6,6,1));
    dentro(g, face, oss[2], t => t.arco(30,47,6,6,1,15,165));
    dentro(g, face, M.grafite[2], t => t.cam([[30,47],[33,44]], 1));
    dentro(g, face, M.grafite[0], t => t.eli(30,47,0.6,0.6));
    /* os ponteiros e o eixo */
    peca(g, M.grafite, t => t.risco(32,36,24,26, 2), {corte:'chato', base:1});
    peca(g, ver, t => t.risco(32,36,43,30, 2), {corte:'chato', base:3});
    dentro(g, face, ver[5], t => t.cam([[36,34],[41,31]], 1));
    peca(g, cro, t => t.eli(32,36,2,2), {corte:'esfera', faixas:[1,1,1,1], brilhoFaixa:1});
    /* o vidro: um risco duro e longo, e é só isso que vidro precisa */
    dentro(g, face, mistura(oss[5], '#ffffff', .65), t => { t.curva([21,27],[18,34],[21,42], 2); });
    /* o raio, atravessando: âmbar com miolo branco */
    const raio = forma(); raio.pol([[44,8],[54,8],[46,26],[56,24],[38,54],[42,34],[33,36]]);
    contorno(g, raio, {tinta:TRACO, tintaLuz:amb[1]});
    chapa(g, raio, amb[3]);
    dentro(g, raio, amb[1], t => t.pol([[50,9],[54,8],[46,26],[56,24],[38,54],[44,36],[40,36]]));
    dentro(g, raio, amb[4], t => t.pol([[44,9],[50,9],[43,25],[50,24],[39,48],[42,33],[36,35]]));
    dentro(g, raio, '#fffadb', t => t.pol([[45,10],[48,10],[43,24],[47,24],[40,44],[42,32],[38,34]]));
  };

  /* PILOTAGEM — o volante. Aro de couro costurado, três raios de metal e
     o cubo no meio. A costura é o detalhe que diz "couro" sem precisar de
     textura nenhuma. */
  A.pilotagem = g => {
    const cou = M.couro, cro = M.cromo, gra = M.grafite;
    /* os três raios, atrás do aro */
    const raios = forma();
    raios.cam([[32,32],[32,54]], 8);
    raios.cam([[32,32],[13,21]], 7);
    raios.cam([[32,32],[51,21]], 7);
    peca(g, cro, t => { t.m.set(raios.m); }, {corte:'esfera', faixas:[1,2,2,2], brilhoFaixa:1});
    /* os rasgos dos raios, que é o que os faz parecer chapa furada */
    const furo = forma();
    furo.eli(32,46,3,6); furo.eli(21,27,5,3); furo.eli(43,27,5,3);
    chapa(g, furo, TRACO);
    dentro(g, furo, gra[0], t => { t.eli(32,46,3,6); t.eli(21,27,5,3); t.eli(43,27,5,3); });
    dentro(g, furo, gra[3], t => { t.arco(32,46,3,6,1,200,340); t.arco(21,27,5,3,1,200,340); t.arco(43,27,5,3,1,200,340); });
    /* o aro */
    const aro = forma(); aro.anel(32,32,26,26,7);
    const A2 = peca(g, cou, t => { t.m.set(aro.m); }, {corte:'esfera', faixas:[1,2,2,3], base:2});
    /* o aro é um tubo: clareia por dentro também, onde a luz entra */
    dentro(g, A2, cou[4], t => t.anel(32,32,21,21,2));
    dentro(g, A2, cou[1], t => t.arco(32,32,20,20,2,10,170));
    salpico(g, A2, cou[1], {n:7, semente:41});
    /* a costura: dois pontos, um vão, dois pontos. Uma volta só — duas
       viram renda. */
    const linha = forma(); linha.anel(32,32,24,24,1);
    let n = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++)
      if (linha.m[y*64+x] && A2.m[y*64+x]) { if ((n++ % 5) < 2) g.dot(x, y, cou[5]); }
    /* o cubo do meio, e a buzina */
    peca(g, gra, t => t.eli(32,32,9,9), {corte:'esfera', faixas:[1,2,2,3], base:2});
    const cubo = forma(); cubo.eli(32,32,9,9);
    dentro(g, cubo, gra[4], t => t.arco(32,32,9,9,2,190,350));
    dentro(g, cubo, gra[0], t => t.arco(32,32,9,9,2,10,170));
    dentro(g, cubo, cro[3], t => t.eli(32,32,5,5));
    dentro(g, cubo, cro[5], t => t.arco(32,32,5,5,2,195,345));
    dentro(g, cubo, cro[0], t => t.arco(32,32,5,5,2,15,165));
    dentro(g, cubo, cro[1], t => t.eli(32,32,2,2));
  };

  /* PONTARIA — o alvo com o dardo cravado. O alvo é um disco visto de
     esguelha: anéis chatos, um tom cada. A sombra que o dardo joga é o que
     levanta ele do alvo. */
  A.pontaria = g => {
    const bra = M.porcelana, ver = M.sangue, cro = M.cromo, mad = M.madeira, pen = M.ceu;
    /* o tripé, atrás */
    peca(g, mad, t => { t.risco(20,44,16,60, 4); t.risco(44,44,48,60, 4); },
      {corte:'tuboV', faixas:[1,1,1,1], base:2});
    /* o disco: anéis chatos, alternando */
    const disco = forma(); disco.eli(32,30,26,22);
    contorno(g, disco, {tinta:TRACO, tintaLuz:bra[1]});
    const anel = (r, cor) => { const f = forma(); f.eli(32,30,r,r*0.85); dentro(g, disco, cor, t => t.m.set(f.m)); };
    anel(26, ver[2]); anel(22, bra[3]); anel(17, ver[2]);
    anel(12, bra[3]); anel(7, ver[2]); anel(3, M.ambar[3]);
    /* cada anel ganha um fio claro em cima e um escuro embaixo: é o que
       tira o alvo do papel e põe ele no espaço */
    for (const [r, claro, escuro] of [[26,ver[4],ver[0]],[22,bra[5],bra[1]],[17,ver[4],ver[0]],
                                      [12,bra[5],bra[1]],[7,ver[4],ver[0]]]) {
      dentro(g, disco, claro, t => t.arco(32,30,r,r*0.85,1,195,345));
      dentro(g, disco, escuro, t => t.arco(32,30,r,r*0.85,1,15,165));
    }
    dentro(g, disco, M.ambar[5], t => t.arco(32,30,3,2.5,1,200,340));
    /* os furos de tiros antigos: contados, espalhados, cada um com um
       pixel claro embaixo para ter fundo */
    for (const [x,y] of [[22,22],[41,38],[26,41],[45,24],[18,33],[36,17],[30,44]]) {
      dentro(g, disco, '#0b0810', t => t.eli(x,y,1.4,1.2));
      dentro(g, disco, bra[1], t => t.pt(x,y+2));
    }
    /* a sombra do dardo, dura, antes do dardo */
    dentro(g, disco, mistura(ver[0], bra[0], .5), t => t.cam([[34,29],[50,10]], 3));
    /* o dardo: haste de cromo, corpo escuro, três penas */
    peca(g, cro, t => t.risco(32,28,38,21, 3), {corte:'esfera', giro:[1,1], faixas:[1,1,1,1], brilhoFaixa:1});
    peca(g, M.grafite, t => t.risco(37,22,48,9, 6), {corte:'esfera', giro:[1,1], faixas:[1,1,2,2], base:3});
    peca(g, pen, t => { t.pol([[47,10],[57,4],[56,11],[48,14]]); t.pol([[45,12],[54,14],[46,18]]); },
      {corte:'esfera', faixas:[1,1,1,2], base:3});
    const pena = forma(); pena.pol([[47,10],[57,4],[56,11],[48,14]]); pena.pol([[45,12],[54,14],[46,18]]);
    dentro(g, pena, pen[1], t => { t.cam([[49,11],[56,7]],1); t.cam([[47,13],[53,14]],1); });
    dentro(g, pena, pen[5], t => t.cam([[48,10],[55,5]], 1));
  };

  /* REFLEXOS — a mão fechando na lâmina no ar. O que diz "reflexo" não é
     a mão nem a faca: são os traços de velocidade e a faca estar TORTA,
     parada no meio de uma queda. */
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

  /* ============================== MÁQUINA ============================= */

  /* ATLETISMO — o tênis. Três materiais numa peça: borracha fosca embaixo,
     pano no cano, e o cadarço, que é a coisa que faz a silhueta ler como
     calçado e não como pedra. */
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

  /* FORTITUDE — a chapa de aço. É o ícone onde o metal aparece inteiro: o
     branco quase puro encostado no tom mais escuro, na altura do horizonte.
     Nenhum outro material do conjunto faz isso, e é por isso que aço lê
     como aço. */
  A.fortitude = g => {
    const aco = M.aco, lat = M.latao;
    const escudo = forma();
    escudo.pol([[32,3],[50,8],[57,14],[56,34],[48,49],[32,60],[16,49],[8,34],[7,14],[14,8]]);
    contorno(g, escudo, {tinta:TRACO, tintaLuz:aco[1]});
    horizonte(g, escudo, aco, 32, {alto:2, arco:-4});
    /* a nervura do meio: duas faces chatas encontrando-se numa quina, e a
       quina é um corte DURO de valor, sem antisserrilhado */
    dentro(g, escudo, aco[1], t => t.pol([[32,3],[38,8],[38,56],[32,60]]));
    dentro(g, escudo, aco[0], t => t.cam([[32,4],[32,60]], 1));
    dentro(g, escudo, aco[5], t => t.cam([[31,4],[31,28]], 1));
    dentro(g, escudo, aco[3], t => t.cam([[31,30],[31,58]], 1));
    /* a moldura rebitada */
    const mold = forma(); mold.m.set(escudo.m);
    mold.menos(t => t.pol([[32,9],[47,13],[52,18],[51,33],[44,46],[32,55],[20,46],[13,33],[12,18],[17,13]]));
    dentro(g, escudo, lat[2], t => { t.m.set(mold.m); });
    dentro(g, escudo, lat[4], t => { const f = forma(); f.m.set(mold.m);
      f.so(q => q.pol([[32,3],[50,8],[57,14],[56,26],[8,26],[7,14],[14,8]])); t.m.set(f.m); });
    dentro(g, escudo, lat[1], t => { const f = forma(); f.m.set(mold.m);
      f.so(q => q.pol([[8,36],[56,36],[48,49],[32,60],[16,49]])); t.m.set(f.m); });
    dentro(g, escudo, lat[5], t => t.cam([[14,9],[31,4]], 1));
    /* os rebites: contados, um a um, na moldura */
    const cravos = [[14,11],[21,8],[28,6],[36,6],[43,8],[50,11],[54,17],[55,25],[53,33],
                    [49,41],[44,48],[38,54],[31,58],[24,54],[19,48],[14,41],[10,33],[8,25],[9,17]];
    for (const [x,y] of cravos) rebite(g, escudo, lat, x, y);
    /* o amassado: uma cratera com sombra dura de um lado e luz do outro */
    dentro(g, escudo, aco[0], t => t.eli(45,38,7,5));
    dentro(g, escudo, aco[1], t => t.arco(45,38,7,5,2,200,340));
    dentro(g, escudo, aco[4], t => t.arco(45,38,7,5,2,20,160));
    dentro(g, escudo, aco[2], t => t.eli(45,39,4,3));
    dentro(g, escudo, aco[5], t => t.cam([[42,41],[48,41]], 1));
    /* os riscos de quem já levou pancada aqui */
    /* o segundo amassado, menor, do outro lado */
    dentro(g, escudo, aco[0], t => t.eli(20,22,4,3));
    dentro(g, escudo, aco[1], t => t.arco(20,22,4,3,1,200,340));
    dentro(g, escudo, aco[4], t => t.arco(20,22,4,3,1,20,160));
    arranhao(g, escudo, aco, [[18,20,30,17],[20,44,33,40],[42,16,52,20],[16,32,26,30],
                              [40,28,50,31],[22,50,31,48],[14,26,21,25],[36,20,46,17]]);
    salpico(g, (()=>{const f=forma();f.eli(20,44,10,8);return f;})(), aco[1], {n:9, semente:59});
    salpico(g, (()=>{const f=forma();f.eli(45,38,9,7);return f;})(), aco[1], {n:7, semente:73});
  };

  /* LUTA — o punho enfaixado. Os nós dos dedos são a coisa toda: quatro
     ressaltos com luz em cima e sombra embaixo, e o vão entre eles. Sem
     eles, punho é uma pedra. */
  A.luta = g => {
    const pel = M.pele, fai = M.osso;
    /* os traços de impacto, atrás: quatro, de comprimento irregular */
    for (const [a, n] of [[-2.7,9],[-2.1,6],[-0.5,7],[0.3,5],[2.6,8],[3.4,6]]) {
      const f = forma();
      f.cam([[32 + Math.cos(a)*27, 30 + Math.sin(a)*25],
             [32 + Math.cos(a)*(27+n), 30 + Math.sin(a)*(25+n)]], 2);
      chapa(g, f, mistura('#0b0a14', pel[4], .45));
    }
    /* o antebraço, atrás */
    peca(g, pel, t => t.pol([[20,46],[44,46],[48,62],[16,62]]), {corte:'tuboV', faixas:[1,2,2,3], base:2});
    /* O PUNHO. A silhueta de cima é RECORTADA em quatro calombos: é o
       recorte que diz "nós dos dedos". Punho de topo liso vira pedra, e
       foi assim que esse ícone deu errado das outras vezes. */
    const punho = forma();
    punho.pol([[11,28],[11,44],[16,52],[26,55],[40,55],[50,50],[53,40],[53,28]]);
    for (let k = 0; k < 4; k++) punho.eli(15 + k * 11, 28 - (k === 1 || k === 2 ? 2 : 0), 6, 7);
    const p = peca(g, pel, t => { t.m.set(punho.m); }, {corte:'esfera', faixas:[2,3,3,4], base:3});
    /* cada nó ganha luz em cima e sombra embaixo, e o VÃO entre eles é a
       linha mais escura do ícone */
    for (let k = 0; k < 4; k++) {
      const x = 15 + k * 11, y = 28 - (k === 1 || k === 2 ? 2 : 0);
      dentro(g, p, pel[4], t => t.eli(x, y - 1, 5, 5));
      dentro(g, p, pel[5], t => t.eli(x - 2, y - 3, 2.6, 2));
      dentro(g, p, pel[1], t => t.eli(x, y + 5, 5, 2.4));
      if (k < 3) dentro(g, p, pel[0], t => t.cam([[x + 5.5, y - 5],[x + 5.5, 52]], 1));
      if (k < 3) dentro(g, p, pel[4], t => t.cam([[x + 6.5, y - 3],[x + 6.5, 50]], 1));
    }
    /* a prega da segunda falange, atravessando os quatro dedos */
    dentro(g, p, pel[1], t => t.curva([12,41],[32,46],[53,39], 2));
    dentro(g, p, pel[4], t => t.curva([12,39],[32,44],[53,37], 1));
    /* o polegar, dobrado na frente, embaixo à esquerda */
    const pol = forma(); pol.pol([[10,38],[22,40],[32,46],[30,54],[18,55],[9,48]]);
    contorno(g, pol, {tinta:mistura(TRACO, pel[0], .45), tintaLuz:pel[1]});
    chapa(g, pol, pel[3]);
    dentro(g, pol, pel[4], t => t.pol([[11,39],[22,41],[30,46],[26,48],[16,45],[10,44]]));
    dentro(g, pol, pel[5], t => t.cam([[13,40],[23,43]], 1));
    dentro(g, pol, pel[1], t => t.pol([[12,50],[22,52],[31,49],[30,53],[19,54],[11,50]]));
    dentro(g, pol, pel[5], t => t.eli(28,47,2.4,2));
    /* a faixa: só no pulso. Faixa atravessando a mão foi o que fez este
       ícone virar sanduíche nas versões anteriores. */
    const faixa = forma();
    faixa.pol([[14,53],[50,50],[51,56],[15,59]]);
    faixa.pol([[15,58],[51,55],[52,62],[16,62]]);
    const F = peca(g, fai, t => { t.m.set(faixa.m); }, {corte:'tuboH', faixas:[1,2,2,3], base:3});
    dentro(g, F, fai[1], t => { t.cam([[14,57],[50,54]],1); t.cam([[16,62],[52,59]],1); });
    dentro(g, F, fai[5], t => { t.cam([[14,53],[50,50]],1); t.cam([[15,58],[51,55]],1); });
    dentro(g, F, fai[0], t => { t.cam([[30,50],[31,62]],1); });
    salpico(g, F, fai[2], {n:10, semente:67});
  };

  /* ================================================================== */
  const nomes = Object.keys(A);
  function desenhar(g0, id) {
    const fn = A[id];
    if (!fn) return false;
    /* guarda dos cantos: o aro redondo do nó corta ali, e pixel vazando no
       canto vira sujeira em volta do ícone. */
    const dot0 = g0.dot;
    const g = Object.create(g0);
    g.dot = (x, y, c) => {
      x = Math.round(x); y = Math.round(y);
      const a = Math.min(x, 63 - x), b = Math.min(y, 63 - y);
      if (a + b < 3) return;
      dot0(x, y, c);
    };
    fn(g);
    /* a faxina no fim: varre o pixel solto e o furo de agulha, que é a
       última coisa que um desenhista faz antes de entregar */
    limpar(g0);
    return true;
  }
  const api = {nomes, desenhar, A};
  root.FichaPericiasArte = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
