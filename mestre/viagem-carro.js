/* Viagem de carro — entrar, ligar, sair do mapa e escolher para onde.

   O caminho inteiro, na ordem em que o usuário pediu:

     1. O personagem entra no carro  → abre a INTERFACE DO CARRO, por dentro:
        painel, ponteiros, combustível, rádio, faróis, pisca, buzina e a chave
        de ignição. Cada modelo tem o seu painel (o sedã oficial tem rádio de
        polícia, o hatch tem o ponteiro que gruda, a picape tem o volante de
        caminhão).
     2. Gira a chave                 → o motor pega e o carro SAI DO MAPA: ele
        anda de verdade dentro da cena, na perspectiva dela, levantando poeira,
        até sumir na beira — o personagem já não está no cenário, está dentro
        dele.
     3. O carro sumiu                → aparece só para o MESTRE a lista de
        CENAS DE DESTINO. Ele escolhe para onde o carro vai com o personagem,
        e ali mesmo decide se a viagem tem o minigame de estrada ou se corta
        direto para a chegada.
     4. Com minigame                 → roda mestre/minigame-estrada.js (a
        traseira é o modelo do carro com que o jogador interagiu). Sem
        minigame, a cena troca na hora.
     5. Chega                        → a cena de destino entra, o personagem
        desce e O CARRO VAI JUNTO: ele é tirado da cena de origem e estacionado
        na de destino, com a mesma cor, placa e sujeira.

   A viagem custa tempo do relógio do mestre, e esse tempo passa na fome e na
   sede (necessidades.pular). Batida no minigame pode virar hematoma — o
   mestre liga e desliga isso nas preferências.

   Preferências (ficam em exploracao.prefs, e portanto na sessão salva):
     viagemMinigame      'perguntar' | 'sempre' | 'nunca'
     viagemVariacao      '' (sortear) ou o id de um trecho
     viagemPercurso      'perto' | 'medio' | 'longe' | 'bem_longe' | 'livre'
     viagemMinutos       minutos de jogo que a viagem custa (só no 'livre')
     viagemConsequencias liga o hematoma da batida
     viagemDuracao       tamanho do trecho do minigame, em segundos (só no 'livre') */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  if (!K || !U) return;
  const SW = 480, SH = 270, S = 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const elo = {clues: null, stage: null, exploracao: null, necessidades: null, saude: null, ligado: false};
  const estado = {partida: null, viagem: null, pane: null, ultimoDestino: {}};
  const ouvintes = new Set();
  const avisar = (tipo, dados) => { for (const fn of ouvintes) try { fn(tipo, dados); } catch (e) { console.error(e); } };

  const V = () => root.Veiculos;
  const prefs = () => (elo.exploracao && elo.exploracao.prefs) || (estado.prefsSoltas = estado.prefsSoltas || {});
  const pref = (chave, padrao) => { const p = prefs(); return p[chave] === undefined ? padrao : p[chave]; };
  const definirPref = (chave, valor) => { prefs()[chave] = valor; avisar('prefs', {chave, valor}); };

  /* ============================================================ percursos
     “Quanto de pista?” é uma decisão de ficção antes de ser de relógio: um
     lugar logo ali não pode custar o mesmo que outra cidade. Por isso cada
     atalho traz as três coisas amarradas — a **distância** que a viagem diz ter
     (km, que aparecem no painel do minigame), o **tamanho da pista** (segundos
     de estrada, que é o que o minigame monta) e o **tempo de relógio** que isso
     cobra (minutos, que passam na fome e na sede). `livre` é a saída para quem
     quer os números na mão. */
  const PERCURSOS = [
    {id: 'perto', nome: 'Logo ali', resumo: 'uns quarteirões daqui', km: 3, segundos: 13, minutos: 8},
    {id: 'medio', nome: 'Do outro lado da cidade', resumo: 'a travessia inteira', km: 12, segundos: 26, minutos: 25},
    {id: 'longe', nome: 'Estrada afora', resumo: 'saindo da cidade', km: 34, segundos: 48, minutos: 55},
    {id: 'bem_longe', nome: 'Outra cidade', resumo: 'uma viagem de verdade', km: 80, segundos: 80, minutos: 110},
    {id: 'livre', nome: 'Personalizado', resumo: 'os números que você digitar', km: 0, segundos: 0, minutos: 0}
  ];
  const percursoDe = id => PERCURSOS.find(p => p.id === id) || PERCURSOS[1];
  /* O percurso de uma viagem: o atalho escolhido no pedido, o padrão do mestre,
     ou — no 'livre' — os números que ele digitou. */
  function resolverPercurso(id) {
    const p = percursoDe(id || pref('viagemPercurso', 'medio'));
    if (p.id !== 'livre') return {...p};
    const segundos = clamp(Math.round(Number(pref('viagemDuracao', 26)) || 26), 8, 120);
    const minutos = clamp(Math.round(Number(pref('viagemMinutos', 25)) || 0), 0, 600);
    // Estrada longa é estrada aberta: o quilômetro rende mais quanto maior a viagem.
    return {...p, segundos, minutos, km: Math.max(1, Math.round(segundos * segundos / 80))};
  }

  /* ================================================================ sons */
  function registrarSons() {
    const A = root.MapAmbience;
    if (!A || !A.registrar || (A.temSom && A.temSom('carro_radio'))) return;
    A.registrar('carro_radio', 'Rádio do carro', ({noise, tone}) => {
      noise({type: 'bandpass', freq: 1800, q: 1.4, duration: .18, gain: .22, attack: .004});
      tone(440, .1, .05, .06, 'square'); tone(330, .12, .04, .16, 'square');
    });
    A.registrar('carro_buzina', 'Buzina', ({tone}) => { tone(392, .32, .16, 0, 'square'); tone(494, .32, .11, .01, 'square'); });
    A.registrar('carro_chave', 'Chave na ignição', ({click, noise}) => {
      click(2600, .02, .12); noise({type: 'highpass', freq: 2600, duration: .05, gain: .18, attack: .002});
    });
    A.registrar('carro_saindo', 'Carro saindo', ({hold, noise}) => {
      hold(70, 2.4, .07, .85, 'sawtooth', 420); noise({type: 'lowpass', freq: 300, duration: 2.2, gain: .2, attack: .3});
    });
    /* Bicicleta saindo não tem motor para segurar a nota: o que se ouve é o
       pneu no chão e o TIQUE da corrente, que é o mesmo som da estrada. */
    A.registrar('bike_saindo', 'Bicicleta saindo', ({noise, click}) => {
      noise({type: 'lowpass', freq: 900, duration: 2.4, gain: .15, attack: .4});
      // O tique da corrente, adiantando junto com a pedalada (o 4o argumento
      // do clique é o atraso, então tudo é agendado de uma vez, sem relógio).
      for (let k = 0; k < 8; k++) click(3200, .012, .05, .15 + k * .26 - k * k * .008);
    });
  }

  /* ================================================================ painel do carro */
  /* Um mostrador redondo com ponteiro — o mesmo desenho serve para velocidade,
     giro, combustível e temperatura, mudando a faixa e o número de marcas. */
  function mostrador(ctx, cx, cy, r, {valor = 0, marcas = 8, rotulo = '', cor = '#ffd18c', fundo = '#120a14', aceso = false, min = -2.3, max = 2.3}) {
    U.rect(ctx, cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4, '#05030700');
    for (let y = -r; y <= r; y += S) for (let x = -r; x <= r; x += S) {
      const d = Math.hypot(x, y);
      if (d > r) continue;
      ctx.fillStyle = d > r - 3 ? '#3a2a40' : aceso ? fundo : '#150d1a';
      ctx.fillRect(U.snap(cx + x), U.snap(cy + y), S, S);
    }
    for (let k = 0; k <= marcas; k++) {
      const a = min + (max - min) * (k / marcas);
      const x0 = cx + Math.sin(a) * (r - 6), y0 = cy - Math.cos(a) * (r - 6);
      const x1 = cx + Math.sin(a) * (r - 2), y1 = cy - Math.cos(a) * (r - 2);
      ctx.fillStyle = k >= marcas - 1 ? '#ff7a70' : aceso ? '#e6d6ea' : '#6d5a76';
      for (let t = 0; t <= 1; t += .25) ctx.fillRect(U.snap(x0 + (x1 - x0) * t), U.snap(y0 + (y1 - y0) * t), S, S);
    }
    const a = min + (max - min) * clamp(valor, 0, 1);
    ctx.fillStyle = aceso ? cor : '#9a80a2';
    for (let t = 0; t <= 1; t += .06) ctx.fillRect(U.snap(cx + Math.sin(a) * (r - 5) * t), U.snap(cy - Math.cos(a) * (r - 5) * t), S, S);
    ctx.fillStyle = '#2a1a2e'; ctx.fillRect(U.snap(cx - 2), U.snap(cy - 2), 4, 4);
    if (rotulo) K.drawText(ctx, rotulo, cx, cy + r + 4, {color: aceso ? '#c99cc7' : '#6a5670', align: 'center', font: '3x5'});
  }
  /* A luzinha de aviso do painel. */
  function luzAviso(ctx, x, y, acesa, corAcesa, simbolo) {
    U.rect(ctx, x, y, 14, 10, acesa ? corAcesa : '#1a1020');
    U.outline(ctx, x, y, 14, 10, acesa ? '#ffe6c8' : '#3a2a40', 1);
    K.drawText(ctx, simbolo, x + 7, y + 2, {color: acesa ? '#1a0c10' : '#4a3a50', align: 'center', font: '3x5'});
  }

  const RADIO = ['RÁDIO DESLIGADO', 'AM 680 · NOTÍCIAS', 'FM 91,3 · MÚSICA', 'CHIADO', 'FAIXA DA POLÍCIA'];

  function registrarTipos() {
    const T = root.ClueTypes;
    if (!T || T.get('painel_carro')) return;

    /* ---------------------------------------------------------- em cima da moto
       Na moto não há para-brisa, nem capô, nem retrovisor pendurado no teto: há
       o guidão atravessado embaixo, dois espelhos nas pontas, o painel redondo
       preso na mesa e o tanque entre os joelhos. O céu ocupa a tela inteira —
       é a diferença que o jogador sente antes de ler qualquer texto. */
    function painelDaMoto(ctx, st, dados, M, aceso) {
      const cor = corDoCarro(dados);
      // Bicicleta não tem bateria, nem óleo, nem conta-giros, nem espelho, nem
      // tanque: o que ela tem é guidão, campainha e a cesta. `bike` corta tudo
      // o que seria mentira e põe no lugar o que ela tem de verdade.
      const bike = !!M.bicicleta;
      // Vista aberta: céu, campo e a pista fugindo, sem moldura nenhuma.
      const topo = 8, alturaVista = 128, chao = Math.round(alturaVista * .5);
      for (let y = 0; y < alturaVista; y++) {
        const u = y / alturaVista;
        ctx.fillStyle = y < chao ? U.C('ceu', 4 - Math.floor(u * 6)) : y < chao + 5 ? U.C('folha', 1) : U.C('grama', 2 + (y % 7 === 0 ? 1 : 0));
        ctx.fillRect(0, topo + y, SW, 1);
      }
      for (let y = chao; y < alturaVista; y++) {
        const u = (y - chao) / (alturaVista - chao), meio = SW / 2, larg = 5 + u * u * 250;
        ctx.fillStyle = U.C('concreto', 1 + (y % 6 === 0 ? 1 : 0));
        ctx.fillRect(Math.round(meio - larg), topo + y, Math.round(larg * 2), 1);
        ctx.fillStyle = U.C('papel', 4);
        ctx.fillRect(Math.round(meio - larg), topo + y, 2, 1); ctx.fillRect(Math.round(meio + larg - 2), topo + y, 2, 1);
        if (Math.floor(u * 7 + st.t * 2.4) % 2 === 0 && u > .15) ctx.fillRect(Math.round(meio - 1 - u * 2), topo + y, Math.round(2 + u * 4), 1);
      }
      // Espelhos nas pontas do guidão, com o que vem atrás dentro deles.
      if (!bike) for (const mx of [26, SW - 82]) {
        U.rect(ctx, mx, 96, 56, 26, '#140a18'); U.outline(ctx, mx, 96, 56, 26, '#6a5a70', 2);
        U.rect(ctx, mx + 3, 99, 50, 20, U.C('ceu', 2));
        U.rect(ctx, mx + 3, 111, 50, 8, U.C('concreto', 1));
        U.rect(ctx, mx + 22, 112, 12, 5, cor[0]);
      }
      // Guidão: a barra, os punhos e as manetes.
      const gy = 150;
      U.rect(ctx, 10, gy, SW - 20, 9, '#3c3444'); U.rect(ctx, 10, gy, SW - 20, 3, '#6a6276');
      for (const px of [10, SW - 54]) {
        U.rect(ctx, px, gy - 3, 44, 15, '#1a141e'); U.outline(ctx, px, gy - 3, 44, 15, '#42384a', 2);
        for (let k = 0; k < 6; k++) U.rect(ctx, px + 4 + k * 6, gy - 1, 3, 11, '#0f0b12');
      }
      U.rect(ctx, 52, gy - 8, 40, 4, '#8a8296'); U.rect(ctx, SW - 92, gy - 8, 40, 4, '#8a8296');
      if (bike) {
        /* CAMPAINHA e cestinha de guidão: é o painel de uma bicicleta. Uma
           campainha é uma calota de metal com o gatilho do lado, e ela toca —
           o círculo abre quando se aperta a buzina. */
        const cx = 240, cy = 136, r = 15;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d2 = Math.hypot(x, y);
          if (d2 > r) continue;
          const lum = d2 > r - 2 ? 1 : (x + y) < -r * .3 ? 5 : (x + y) > r * .4 ? 2 : 4;
          ctx.fillStyle = U.C('metal', lum);
          ctx.fillRect(cx + x, cy + y, 1, 1);
        }
        U.rect(ctx, cx + 12, cy + 6, 9, 5, U.C('metal', 2));
        K.drawText(ctx, 'CAMPAINHA', cx, cy + 24, {color: '#8a8296', align: 'center', font: '3x5'});
        // Farol de guidão, que é o que ela tem de luz.
        U.rect(ctx, 176, 126, 26, 16, '#241a28'); U.outline(ctx, 176, 126, 26, 16, '#4e3a54', 2);
        U.rect(ctx, 180, 130, 18, 8, dados.farois ? U.C('amarelo', 6) : U.C('concreto', 2));
        luzAviso(ctx, 294, 134, !!dados.pisca && Math.floor(st.t * 2) % 2 === 0, '#ffd18c', 'PIS');
      } else {
      // Mesa e painel redondo: velocímetro grande, giro pequeno ao lado.
      U.rect(ctx, 176, 128, 128, 34, '#160d1a'); U.outline(ctx, 176, 128, 128, 34, '#3a2a40', 2);
      mostrador(ctx, 212, 146, 26, {valor: 0, marcas: 10, rotulo: 'KM/H', aceso});
      mostrador(ctx, 266, 146, 18, {valor: aceso ? .2 + Math.abs(Math.sin(st.t * 6)) * .06 : 0, marcas: 8, rotulo: 'GIRO', aceso, cor: '#ff9a5c'});
      luzAviso(ctx, 186, 134, !aceso, '#ff6b6b', 'BAT');
      luzAviso(ctx, 186, 150, !!dados.farois, '#8fd3ff', 'LUZ');
      luzAviso(ctx, 294, 134, !!dados.pisca && Math.floor(st.t * 2) % 2 === 0, '#ffd18c', 'PIS');
      luzAviso(ctx, 294, 150, !aceso, '#ffb35c', 'OLE');
      }
      /* Tanque entre os joelhos, na cor da moto, com a placa gravada na tampa.
         Na bicicleta o que há entre os joelhos é o QUADRO: dois tubos finos e a
         cesta pendurada na frente deles. */
      if (bike) {
        const qx = 240, base = SH;
        ctx.fillStyle = cor[0];
        for (let y = 176; y < base; y++) {
          const u = (y - 176) / (base - 176);
          const larg = Math.round(4 + u * 3);
          ctx.fillRect(qx - 42 + Math.round(u * 26) - larg, y, larg * 2, 1);
          ctx.fillRect(qx + 42 - Math.round(u * 26) - larg, y, larg * 2, 1);
        }
        U.rect(ctx, 198, 178, 84, 40, U.C('madeira', 4));
        U.outline(ctx, 198, 178, 84, 40, U.C('madeira', 1), 2);
        for (let x = 202; x < 280; x += 6) U.rect(ctx, x, 180, 2, 36, U.C('madeira', 5));
        for (let y = 182; y < 216; y += 6) U.rect(ctx, 200, y, 80, 2, U.C('madeira', 2));
        // Alça de couro por cima do vime: o detalhe que a faz parecer cesta e não grade.
        U.rect(ctx, 226, 176, 28, 5, U.C('couro', 3));
        U.rect(ctx, 226, 176, 28, 2, U.C('couro', 5));
        return;
      }
      const tq = {x: 158, y: 176, w: 164, h: SH - 176};
      ctx.fillStyle = cor[0]; ctx.fillRect(tq.x, tq.y, tq.w, tq.h);
      U.rect(ctx, tq.x, tq.y, tq.w, 3, cor[1]);
      U.rect(ctx, tq.x + 20, tq.y + 10, tq.w - 40, 2, cor[1]);
      for (let y = 0; y < tq.h; y++) {                       // barriga do tanque
        const u = y / tq.h, recuo = Math.round(u * u * 26);
        ctx.fillStyle = '#0a060d';
        ctx.fillRect(tq.x - 1, tq.y + y, -recuo + 1, 1);
        ctx.fillRect(tq.x + tq.w - 1, tq.y + y, recuo, 1);
      }
      U.rect(ctx, 231, tq.y + 14, 18, 12, '#2a2230'); U.outline(ctx, 231, tq.y + 14, 18, 12, cor[1], 2);
      K.drawText(ctx, (dados.placa || '').slice(0, 8), 240, tq.y + 30, {color: '#cbb4cf', align: 'center', font: '3x5'});
      // A chave fica na mesa, à direita do painel.
      const chaveX = 336, chaveY = 140;
      U.rect(ctx, chaveX, chaveY, 26, 26, '#241a28'); U.outline(ctx, chaveX, chaveY, 26, 26, '#4e3a54', 2);
      ctx.fillStyle = aceso ? '#ffd18c' : '#a89078';
      for (let t = 0; t <= 1; t += .1) ctx.fillRect(U.snap(chaveX + 13 + Math.sin((aceso ? 1 : 0) * 1.2) * 9 * t), U.snap(chaveY + 13 - Math.cos((aceso ? 1 : 0) * 1.2) * 9 * t), 3, 3);
    }

    /* ---------------------------------------------------------- por dentro */
    T.register('painel_carro', {
      label: 'Dentro do carro', icon: 'carro', sound: 'carro_porta', categoria: 'interacao', veil: .7,
      clickOutsideCloses: false,
      create: () => ({t: 0, ligado: false, girando: 0, radio: 0, faixa: 0, partiu: false, aviso: ''}),
      render(ctx, ui, st, clue, sys) {
        const dados = clue.data && clue.data.carro || {};
        const M = V() ? V().medidas(dados.modelo) : {nome: 'Carro', L: 300, W: 116, H: 97};
        st.t += ui.dt || 0;
        const aceso = st.ligado;
        U.rect(ctx, 0, 0, SW, SH, '#0a060d');
        const emMoto = !!M.moto, emBike = !!M.bicicleta;
        if (emMoto) painelDaMoto(ctx, st, dados, M, aceso);
        else {
          /* Para-brisa: a moldura primeiro (ela pinta o miolo), o céu e a rua
             por cima, e o capô do próprio carro na cor dele fechando embaixo. */
          const pb = {x: 24, y: 24, w: SW - 48, h: 92};
          U.frame(ctx, pb.x - 6, pb.y - 6, pb.w + 12, pb.h + 12, 'metal');
          const chao = Math.round(pb.h * .52);
          for (let y = 0; y < pb.h; y++) {
            const u = y / pb.h;
            ctx.fillStyle = y < chao ? U.C('ceu', 4 - Math.floor(u * 6)) : y < chao + 5 ? U.C('folha', 1) : U.C('grama', 2 + (y % 7 === 0 ? 1 : 0));
            ctx.fillRect(pb.x, pb.y + y, pb.w, 1);
          }
          /* A pista fugindo no meio, para dar profundidade ao que se vê: asfalto
             claro sobre o campo, com a faixa central piscando enquanto corre. */
          for (let y = chao; y < pb.h; y++) {
            const u = (y - chao) / (pb.h - chao), meio = pb.x + pb.w / 2, larg = 4 + u * u * 210;
            ctx.fillStyle = U.C('concreto', 1 + (y % 6 === 0 ? 1 : 0));
            ctx.fillRect(Math.round(meio - larg), pb.y + y, Math.round(larg * 2), 1);
            ctx.fillStyle = U.C('papel', 4);
            ctx.fillRect(Math.round(meio - larg), pb.y + y, 2, 1); ctx.fillRect(Math.round(meio + larg - 2), pb.y + y, 2, 1);
            if (Math.floor(u * 7 + st.t * 2.4) % 2 === 0 && u > .15) ctx.fillRect(Math.round(meio - 1 - u * 2), pb.y + y, Math.round(2 + u * 4), 1);
          }
          const corCapo = corDoCarro(dados);
          U.rect(ctx, pb.x, pb.y + pb.h - 16, pb.w, 16, corCapo[0]);
          U.rect(ctx, pb.x, pb.y + pb.h - 16, pb.w, 2, corCapo[1]);
          U.rect(ctx, pb.x + 40, pb.y + pb.h - 12, pb.w - 80, 2, corCapo[1]);
          // Retrovisor, pendurado no alto do vidro.
          U.rect(ctx, SW / 2 - 34, pb.y + 2, 68, 15, '#140a18'); U.outline(ctx, SW / 2 - 34, pb.y + 2, 68, 15, '#5a4a60', 2);
          K.drawText(ctx, M.nome.toUpperCase(), SW / 2, pb.y + 6, {color: '#9d7d9a', align: 'center'});
          // Tábua do painel.
          U.rect(ctx, 0, 124, SW, SH - 124, '#160d1a');
          U.rect(ctx, 0, 124, SW, 3, '#3a2a40');
          U.rect(ctx, 0, 127, SW, 2, '#241830');
          for (let x = 300; x < 470; x += 6) U.rect(ctx, x, 132, 3, 10, '#0e070f');   // difusor de ar
          mostrador(ctx, 86, 172, 30, {valor: 0, marcas: 10, rotulo: 'KM/H', aceso});
          mostrador(ctx, 154, 172, 22, {valor: aceso ? .18 + Math.abs(Math.sin(st.t * 6)) * .05 : 0, marcas: 8, rotulo: 'GIRO', aceso, cor: '#ff9a5c'});
          mostrador(ctx, 208, 172, 16, {valor: .72, marcas: 4, rotulo: 'COMB.', aceso, cor: '#9fe0b0'});
          mostrador(ctx, 250, 172, 16, {valor: aceso ? .3 : .12, marcas: 4, rotulo: 'TEMP.', aceso, cor: '#8fd3ff'});
          // Luzes de aviso: batería e óleo apagam quando o motor pega.
          luzAviso(ctx, 62, 208, !aceso, '#ff6b6b', 'BAT');
          luzAviso(ctx, 80, 208, !aceso, '#ffb35c', 'OLE');
          luzAviso(ctx, 98, 208, !!dados.farois, '#8fd3ff', 'LUZ');
          luzAviso(ctx, 116, 208, !!dados.pisca && Math.floor(st.t * 2) % 2 === 0, '#ffd18c', 'PIS');
          // Volante.
          const vx = 92, vy = 244;
          for (let a = 0; a < 6.283; a += .035) {
            const x = vx + Math.cos(a) * 52, y = vy + Math.sin(a) * 24;
            ctx.fillStyle = '#241a28'; ctx.fillRect(U.snap(x), U.snap(y), 6, 6);
            ctx.fillStyle = '#42303f'; ctx.fillRect(U.snap(x), U.snap(y), 4, 4);
          }
          U.rect(ctx, vx - 52, vy - 2, 104, 4, '#2c2030');
          U.rect(ctx, vx - 20, vy - 8, 40, 14, '#2c2030'); U.outline(ctx, vx - 20, vy - 8, 40, 14, '#4e3a54', 2);
          K.drawText(ctx, (dados.placa || '').slice(0, 8), vx, vy - 4, {color: '#a98fae', align: 'center', font: '3x5'});
          // Rádio.
          U.rect(ctx, 176, 200, 140, 26, '#0e070f'); U.outline(ctx, 176, 200, 140, 26, '#4a3a50', 2);
          K.drawText(ctx, RADIO[st.radio], 246, 208, {color: st.radio ? '#9fe0b0' : '#5a4a60', align: 'center'});
          if (st.radio) { const n = Math.floor(st.t * 8) % 9; U.rect(ctx, 182 + n * 15, 218, 11, 4, '#2d6b3b'); }
          // A chave, com o tambor girando.
          const chaveX = 336, chaveY = 140;
          U.rect(ctx, chaveX, chaveY, 26, 26, '#241a28'); U.outline(ctx, chaveX, chaveY, 26, 26, '#4e3a54', 2);
          const giro = aceso ? 1 : 0;
          ctx.fillStyle = aceso ? '#ffd18c' : '#a89078';
          for (let t = 0; t <= 1; t += .1) ctx.fillRect(U.snap(chaveX + 13 + Math.sin(giro * 1.2) * 9 * t), U.snap(chaveY + 13 - Math.cos(giro * 1.2) * 9 * t), 3, 3);
        }
        U.header(ctx, ui, emBike ? 'NA BICICLETA' : emMoto ? 'NA MOTO' : 'DENTRO DO CARRO', M.nome + (dados.placa ? ' · ' + dados.placa : ''), 'carro');
        const estrago = V() ? V().manejo(clue.data.carro || {}) : null;
        if (!aceso) {
          if (ui.button(ctx, 'ligar', 370, 138, 100, 30, emBike ? 'PÉ NO PEDAL' : emMoto ? 'DAR A PARTIDA' : 'GIRAR A CHAVE',
            {style: estrago && !estrago.anda ? 'roxo' : 'fosforo'})) {}
        } else {
          K.drawText(ctx, st.partiu ? 'ENGATANDO…' : 'MOTOR LIGADO', 403, 172, {color: '#9fe0b0', align: 'center'});
          if (!st.partiu && ui.button(ctx, 'partir', 370, 140, 100, 28, 'PARTIR', {style: 'fosforo'})) {}
          if (!st.partiu && ui.button(ctx, 'desligar', 336, 184, 134, 18, 'Desligar o motor')) {}
        }
        if (!aceso && ui.button(ctx, 'sair', 336, 176, 134, 20, emBike ? 'Descer da bicicleta' : emMoto ? 'Descer da moto' : 'Sair do carro')) {}
        if (ui.button(ctx, 'farois', 336, 206, 64, 20, 'Faróis', {pressed: !!dados.farois})) {}
        if (ui.button(ctx, 'pisca', 406, 206, 64, 20, 'Pisca', {pressed: !!dados.pisca})) {}
        if (ui.button(ctx, 'buzina', 336, 230, 64, 20, 'Buzina')) {}
        if (!emMoto && ui.button(ctx, 'radio', 406, 230, 64, 20, 'Rádio')) {}
        // O porta-malas fica à mão de quem está dentro do carro.
        if (ui.button(ctx, 'portamalas', 176, 232, 140, 20, emBike ? 'CESTA' : emMoto ? 'BAÚ' : 'PORTA-MALAS', {style: 'roxo'})) {}
        // O estado da lataria é lido no painel, como quem olha para o carro.
        if (estrago && estrago.dano) {
          K.drawText(ctx, estrago.estado.nome.toUpperCase() + ' · ' + estrago.estado.resumo, 16, 252,
            {color: estrago.anda ? '#e0a070' : '#ff8a70'});
        }
        if (st.aviso) K.drawText(ctx, st.aviso, 246, 218, {color: '#ffd18c', align: 'center'});
      },
      action(id, st, clue, sys) {
        const dados = clue.data && clue.data.carro || {};
        const veiculo = clue.data && clue.data.veiculo;
        if (id === 'sair') { sys.close(); return; }
        if (id === 'farois' || id === 'pisca') {
          dados[id] = !dados[id];
          if (V() && veiculo) V().atualizar(veiculo, {[id]: dados[id]}, clue.data.cena);
          sys.sfx('clique');
          return;
        }
        if (id === 'buzina') { sys.sfx('carro_buzina'); return; }
        if (id === 'radio') { st.radio = (st.radio + 1) % RADIO.length; sys.sfx('carro_radio'); return; }
        if (id === 'desligar') { st.ligado = false; st.aviso = 'Motor desligado.'; sys.sfx('carro_chave'); return; }
        if (id === 'portamalas') {
          const pm = root.PortaMalas;
          if (!pm || !pm.abrir) { st.aviso = 'Porta-malas emperrado.'; return; }
          sys.close();
          pm.abrir({veiculo, cena: clue.data.cena, carro: dados});
          return;
        }
        if (id === 'ligar') {
          // Carro destruído não pega: a chave gira, o motor rateia e para.
          if (V() && !V().podeAndar({data: dados})) {
            st.aviso = 'O motor rateia e morre. Esse carro não anda mais.';
            sys.sfx('carro_trancado');
            return;
          }
          st.girando = .2; st.ligado = true; st.aviso = '';
          sys.sfx('carro_chave');
          setTimeout(() => { try { sys.sfx('carro_partida'); } catch (e) {} }, 140);
          if (V() && veiculo) V().atualizar(veiculo, {motor: true}, clue.data.cena);
          return;
        }
        if (id === 'partir') {
          if (st.partiu) return;
          st.partiu = true;
          st.aviso = 'Engatando…';
          setTimeout(() => { sys.close(); sairDoMapa(clue.data); }, 520);
        }
      },
      key(e, st, clue, sys) {
        if (e.key === 'Escape') { sys.close(); return true; }
        return false;
      }
    });

    /* ---------------------------------------------------------- destinos */
    T.register('destino_viagem', {
      label: 'Para onde o carro vai', icon: 'mapa', categoria: 'interacao', veil: .85,
      clickOutsideCloses: false,
      create: () => ({pagina: 0, t: 0, comMinigame: pref('viagemMinigame', 'perguntar') !== 'nunca'}),
      render(ctx, ui, st, clue, sys) {
        st.t += ui.dt || 0;
        const d = clue.data || {};
        const cenas = cenasPossiveis(d.origem);
        const porPagina = 12, paginas = Math.max(1, Math.ceil(cenas.length / porPagina));
        st.pagina = clamp(st.pagina, 0, paginas - 1);
        U.rect(ctx, 0, 0, SW, SH, '#0a060de8');
        U.header(ctx, ui, 'PARA ONDE O CARRO VAI', 'só você vê isto', 'mapa');
        K.drawText(ctx, 'O carro saiu de ' + (nomeDaCena(d.origem) || '—').toUpperCase() + ' com o personagem dentro.', 12, 28, {color: '#c99cc7'});
        const lista = cenas.slice(st.pagina * porPagina, st.pagina * porPagina + porPagina);
        lista.forEach((c, i) => {
          const col = i % 3, lin = Math.floor(i / 3);
          const x = 12 + col * 154, y = 42 + lin * 29;
          const marcado = estado.ultimoDestino[d.origem] === c.id;
          if (ui.button(ctx, 'ir:' + c.id, x, y, 146, 25, cortar(c.rotulo, 22), {style: marcado ? 'fosforo' : 'roxo'})) {
            U.tooltip(ctx, c.rotulo, x + 73, y - 15);
          }
        });
        if (paginas > 1) {
          if (ui.button(ctx, 'antes', 12, 160, 60, 18, '< antes', {disabled: st.pagina === 0})) {}
          if (ui.button(ctx, 'depois', 78, 160, 60, 18, 'depois >', {disabled: st.pagina >= paginas - 1})) {}
          K.drawText(ctx, (st.pagina + 1) + ' / ' + paginas + ' · ' + cenas.length + ' cenas', 148, 165, {color: '#9d7d9a'});
        }
        // A decisão do minigame, aqui mesmo.
        U.rect(ctx, 8, 184, SW - 16, 70, '#1a0c1e'); U.outline(ctx, 8, 184, SW - 16, 70, '#522045', 2);
        K.drawText(ctx, 'A VIAGEM ATÉ LÁ', 16, 190, {color: '#ffd18c'});
        const modo = pref('viagemMinigame', 'perguntar');
        const vari = pref('viagemVariacao', '');
        const M = root.MinigameEstrada;
        const nomeVar = vari && M && M.VARIACOES[vari] ? M.VARIACOES[vari].nome : 'sortear o trecho';
        if (ui.button(ctx, 'minigame', 16, 200, 150, 22, 'COM MINIGAME', {style: st.comMinigame ? 'fosforo' : 'roxo', pressed: st.comMinigame})) {}
        if (ui.button(ctx, 'direto', 174, 200, 150, 22, 'IR DIRETO', {style: st.comMinigame ? 'roxo' : 'fosforo', pressed: !st.comMinigame})) {}
        if (ui.button(ctx, 'variacao', 332, 200, 130, 22, cortar(nomeVar, 18))) {}
        const rota = resolverPercurso();
        if (ui.button(ctx, 'percurso', 16, 234, 150, 18, cortar('Percurso: ' + rota.nome, 22))) {}
        K.drawText(ctx, rota.km + ' km · custa ' + rota.minutos + ' min do relógio · ' +
          (pref('viagemConsequencias', true) ? 'batida machuca' : 'batida não machuca') + ' · padrão: ' +
          ({perguntar: 'perguntar sempre', sempre: 'sempre com minigame', nunca: 'sempre direto'}[modo]), 16, 226, {color: '#9d7d9a'});
        if (ui.button(ctx, 'padrao', 332, 234, 130, 18, 'Trocar o padrão')) {}
        if (ui.button(ctx, 'cancelar', 174, 234, 150, 18, 'Cancelar: o carro volta')) {}
      },
      action(id, st, clue, sys, info) {
        const d = clue.data || {};
        if (id === 'antes') { st.pagina--; return; }
        if (id === 'depois') { st.pagina++; return; }
        if (id === 'variacao') {
          const M = root.MinigameEstrada;
          if (!M) return;
          const lista = ['', ...M.LISTA];
          const atual = lista.indexOf(pref('viagemVariacao', ''));
          definirPref('viagemVariacao', lista[(atual + 1) % lista.length]);
          return;
        }
        if (id === 'percurso') {
          const lista = PERCURSOS.map(r => r.id);
          const atual = lista.indexOf(percursoDe(pref('viagemPercurso', 'medio')).id);
          definirPref('viagemPercurso', lista[(atual + 1) % lista.length]);
          return;
        }
        if (id === 'padrao') {
          const ordem = ['perguntar', 'sempre', 'nunca'];
          definirPref('viagemMinigame', ordem[(ordem.indexOf(pref('viagemMinigame', 'perguntar')) + 1) % ordem.length]);
          return;
        }
        if (id === 'cancelar') { sys.close(); cancelarViagem(); return; }
        if (id === 'minigame' || id === 'direto') { st.comMinigame = id === 'minigame'; return; }
        if (id.indexOf('ir:') === 0) {
          const destino = id.slice(3);
          if (!destino) return;
          const comMinigame = !!st.comMinigame;
          estado.ultimoDestino[d.origem] = destino;
          sys.close();
          viajar({origem: d.origem, destino, veiculo: d.veiculo, carro: d.carro, minigame: comMinigame});
        }
      },
      key(e, st, clue, sys) {
        if (e.key === 'Escape') { sys.close(); cancelarViagem(); return true; }
        return false;
      }
    });
  }
  const cortar = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const nomeDaCena = id => { const s = root.SceneLibrary && root.SceneLibrary.get(id); return s ? s.name : ''; };
  /* A que lugar a cena pertence — senão o mestre vê duas “Copa” e dois
     “Corredor” na lista e não sabe qual é qual. */
  const FAMILIAS = [['pref_', 'Prefeitura'], ['jorge', 'Jorge'], ['campo', 'Campo']];
  function familiaDe(id) {
    for (const [prefixo, nome] of FAMILIAS) if (String(id).indexOf(prefixo) === 0) return nome;
    return '';
  }
  function cenasPossiveis(origem) {
    const L = root.SceneLibrary;
    if (!L || !L.list) return [];
    const salas = L.list().filter(s => s.kind === 'room' && s.id !== origem);
    const vezes = {};
    for (const s of salas) vezes[s.name] = (vezes[s.name] || 0) + 1;
    return salas.map(s => {
      const fam = familiaDe(s.id);
      return {id: s.id, name: s.name, rotulo: vezes[s.name] > 1 && fam ? `${fam}: ${s.name}` : s.name, familia: fam};
    }).sort((a, b) => (a.familia || 'zz').localeCompare(b.familia || 'zz') || a.name.localeCompare(b.name));
  }
  function corDoCarro(dados) {
    const v = V();
    if (!v) return ['#3a3550', '#5a5570'];
    const c = v.dados({data: dados}), ramp = (v.RAMPS[c.cor] || v.RAMPS[v.medidas(c.modelo).corOriginal] || []);
    return [ramp[Math.max(0, ramp.length - 4)] || '#3a3550', ramp[ramp.length - 2] || '#5a5570'];
  }

  /* ================================================================ entrar no carro */
  /* É este o gancho que o veiculos.js já documentava. */
  function aoUsar({veiculo, cena, fonte, sys}) {
    if (!veiculo || !sys) return false;
    if (estado.partida || estado.viagem) return true;
    const v = V();
    const dados = v ? v.dados(veiculo) : {modelo: 'sedan_oficial'};
    sys.sfx('carro_porta');
    sys.open({id: 'painel_carro:' + veiculo.id, name: dados.bicicleta ? 'Em cima da bicicleta' : dados.moto ? 'Em cima da moto' : 'Dentro do carro', type: 'painel_carro',
      data: {veiculo: veiculo.id, cena, carro: {...dados}, fonte}}, {audience: 'todos', source: 'cena'});
    avisar('entrou', {cena, veiculo: veiculo.id});
    return true;
  }

  /* ================================================================ sair do mapa */
  /* O carro anda de verdade dentro da cena, na perspectiva dela, até sumir na
     beira. Quem desenha é o provedor de objetos do mundo (o mesmo caminho dos
     carros estacionados), só que com o X animado. */
  function sairDoMapa({veiculo, cena, carro}) {
    const sys = elo.clues, stage = elo.stage, v = V();
    if (!sys || !stage || !v) return false;
    const sala = stage.room;
    const c = {...carro};
    const sentido = c.sentido < 0 ? -1 : 1;
    const alvo = sentido < 0 ? (sala ? sala.x0 - 420 : c.X - 900) : (sala ? sala.x1 + 420 : c.X + 900);
    /* Bicicleta sai mais devagar que carro — é perna, não motor —, e por isso
       leva mais tempo para vencer o mesmo pedaço de cena. */
    const dur = c.bicicleta ? 3.6 : c.moto ? 2.4 : 2.6;
    estado.partida = {veiculo, cena, carro: c, x0: c.X, alvo, t0: null, dur, pronto: false};
    if (v.esconder) { v.esconder(veiculo, true, cena); estado.veiculoEscondido = {id: veiculo, cena}; }
    /* Ele sai EM CIMA do veículo: o corpo que estava andando pela cena some do
       palco no mesmo quadro em que o piloto aparece no selim. Quem desenha o
       piloto é o próprio veículo (`pilotada`), com a roupa do guarda-roupa. */
    sys.ocultarPersonagem = true;
    sys.toast('SAINDO', c.bicicleta ? 'A bicicleta deixa a cena' : c.moto ? 'A moto deixa a cena' : 'O carro deixa a cena', 'carro');
    sys.sfx(c.bicicleta ? 'bike_saindo' : 'carro_saindo');
    avisar('partiu', {cena, veiculo});
    return true;
  }
  /* O provedor: enquanto há uma partida em andamento, desenha o carro andando. */
  function provedorPartida(scene, state, stage) {
    const p = estado.partida, v = V();
    if (!p || !v || !scene || scene.id !== p.cena) return null;
    const desenhar = (ctx, info) => {
      if (p.t0 === null) p.t0 = info.time;
      const u = clamp((info.time - p.t0) / p.dur, 0, 1);
      const s = u * u * (3 - 2 * u);                      // arranca devagar, some rápido
      const X = Math.round(p.x0 + (p.alvo - p.x0) * s);
      /* A PEDALADA anda com a DISTÂNCIA, não com o relógio — a mesma lei da
         estrada. Arrancando devagar, o pé sai devagar e acelera junto com a
         bicicleta; parasse no meio, o pé parava onde estivesse. */
      const pose = p.carro.bicicleta && v.posePorDistancia ? v.posePorDistancia(X - p.x0) : 0;
      const c = {...p.carro, X, pose, pilotada: true, motor: true, farois: p.carro.farois};
      p.ultimo = c;                      // o que foi desenhado neste quadro
      v.desenharMancha(ctx, info, c);
      v.desenharCarro(ctx, info, c);
      // Pneu de bicicleta não levanta poeira: o peso não dá, e a roda é fina.
      if (!p.carro.bicicleta) poeiraDaSaida(ctx, info, c, u);
      if (u >= 1 && !p.pronto) { p.pronto = true; setTimeout(chegouNaBeira, 0); }
    };
    return [{d: p.carro.d, draw: desenhar}];
  }
  function poeiraDaSaida(ctx, info, c, u) {
    const sala = info.room;
    if (!sala || u > .9) return;
    const v = V(), M = v.medidas(c.modelo), sentido = c.sentido < 0 ? -1 : 1;
    for (let k = 0; k < 7; k++) {
      const idade = ((info.time * 1.6 + k * .21) % 1);
      const X = c.X - sentido * (M.L / 2 + idade * 40), h = 4 + idade * 22;
      const p = sala.project(X, c.d + M.W * .5, h, info.cc);
      if (!p || p[0] < -6 || p[0] > SW + 6) continue;
      ctx.fillStyle = idade < .4 ? '#9a8d78' : idade < .7 ? '#7d7160' : '#5e5548';
      const w = idade < .3 ? S : S * 2;
      ctx.fillRect(Math.round(p[0] / S) * S, Math.round(p[1] / S) * S, w, w);
    }
  }
  /* O carro sumiu na beira. Quem pergunta "para onde?" é o MAPA DO MESTRE:
     isto vira um pedido igual aos das portas sem destino, com as sugestões de
     cena, a lista das cenas que já existem e o botão de criar uma na hora —
     tudo o que o painel já fazia. Só quando não há exploração (testes soltos)
     é que a lista aparece na própria tela. */
  function chegouNaBeira() {
    const p = estado.partida, sys = elo.clues, ex = elo.exploracao;
    if (!p || !sys) return;
    estado.partida = null;
    estado.esperando = {origem: p.cena, veiculo: p.veiculo, carro: p.carro};
    const clue = sys.clue ? sys.clue(p.veiculo, p.cena) : null;
    if (ex && ex.pedir && clue) {
      const pedido = ex.pedir(clue, 'viagem', 'mestre', {carro: p.carro});
      if (pedido) { avisar('escolher', {cena: p.cena, pedido: pedido.id}); return; }
    }
    sys.open({id: 'destino_viagem', name: 'Para onde o carro vai', type: 'destino_viagem',
      data: {origem: p.cena, veiculo: p.veiculo, carro: p.carro}}, {audience: 'mestre', source: 'cena'});
    avisar('escolher', {cena: p.cena});
  }
  /* O mestre desistiu: o carro volta para o lugar e o personagem desce. */
  function desistir() {
    const sys = elo.clues, v = V();
    if (!sys) return false;
    estado.partida = null; estado.viagem = null; estado.esperando = null;
    sys.ocultarPersonagem = false;
    if (v && estado.veiculoEscondido) { v.esconder(estado.veiculoEscondido.id, false, estado.veiculoEscondido.cena); estado.veiculoEscondido = null; }
    estado.rota = null;
    sys.toast('DESISTIU', 'O carro deu meia-volta e estacionou', 'carro');
    avisar('desistiu', {});
    return true;
  }
  const cancelarViagem = desistir;

  /* ================================================================ viajar */
  function viajar({origem, destino, veiculo, carro, minigame, percurso}) {
    const sys = elo.clues, ex = elo.exploracao;
    if (!sys) return false;
    // Vindo do pedido do painel, o carro e a cena de origem estão guardados aqui.
    const esperando = estado.esperando || {};
    origem = origem || esperando.origem;
    veiculo = veiculo || esperando.veiculo;
    carro = carro || esperando.carro;
    estado.esperando = null;
    if (!carro) return false;
    // O percurso vale para esta viagem: a pista, os quilômetros e o relógio.
    const rota = resolverPercurso(percurso);
    estado.rota = rota;
    estado.viagem = {origem, destino, veiculo, carro, minigame, rota, em: Date.now()};
    avisar('viajando', estado.viagem);
    if (minigame && root.MapCinematics && root.MapCinematics.has('estrada')) {
      const vari = pref('viagemVariacao', '');
      const ok = sys.playCinematic('estrada', {
        // O carro do minigame é o do jogador inteiro: modelo, cor, placa — e o
        // estado da lataria, que é o que muda a direção e o que se vê.
        carro: {data: carro}, variacao: vari || null, duracao: rota.segundos,
        minutos: rota.minutos, km: rota.km, percurso: rota.nome, destinoNome: nomeDaCena(destino),
        aoTerminar: rel => { estado.relatorio = rel; },
        /* O filme não acaba sozinho: ele SEGURA a tela e avisa. Chegando ou
           quebrando, quem o solta é a viagem, no instante em que a cena nova
           já está preta — assim a cena de onde o veículo saiu não volta a
           aparecer, nem por um quadro. */
        aoFim: () => setTimeout(chegar, 0),
        // Esc na espera da pane: o mestre não vai escolher. Ver `pararNaBeira`.
        aoDispensar: () => setTimeout(pararNaBeira, 0),
        // Fora do quadro: trocar de cena no meio do desenho da cinemática não.
        onEnd: () => setTimeout(chegar, 0)
      });
      if (ok) return true;
    }
    chegar();
    return true;
  }
  /* A troca de cena de uma viagem: o veículo é a passagem, e o corte é o mesmo
     de qualquer porta lateral. Devolve se foi e QUANTO tempo falta para a tela
     estar toda preta — é esse instante que o filme segurado tem de esperar. */
  function levarPara(cena, veiculoId) {
    const ex = elo.exploracao;
    const passagem = {id: 'carro:' + veiculoId, name: 'Viagem de carro', type: 'passagem',
      data: {tipo: 'lateral', transicao: 'fade', letreiro: ''}};
    let foi = false, meia = .3;                      // metade de uma passagem lateral
    if (ex && ex.atravessar) foi = ex.atravessar(passagem, {cena, rotulo: ''});
    if (!foi && elo.stage && root.SceneLibrary && root.SceneLibrary.has(cena)) {
      elo.stage.goLive({scene: cena, transition: 'fade', duration: .8}); foi = true; meia = .4;
    }
    return {foi, meia};
  }
  /* Solta o filme que está segurando a tela, escurecendo o que falta dele no
     mesmo tempo que a transição leva para fechar. E o personagem só reaparece
     quando a cena nova já entrou: ele não pisa na cena de origem no caminho. */
  function soltarEDescer(sys, {foi, meia}) {
    const cine = sys && sys.cinematic;
    if (cine && cine.segurando && cine.soltar) cine.soltar(meia);
    if (foi) setTimeout(() => { if (sys) sys.ocultarPersonagem = false; }, Math.round(meia * 1000));
    else if (sys) sys.ocultarPersonagem = false;
  }
  /* Plano B da pane: o mestre dispensou o pedido (ou apertou Esc na espera).
     Eles NÃO voltam para o lugar de onde o veículo saiu — param na beira do
     trecho em que estavam rodando, que é a primeira sugestão do próprio
     pedido. Quem faz o serviço é a exploração, pelo caminho de sempre. */
  function pararNaBeira() {
    const p = estado.pane, ex = elo.exploracao;
    if (!p) return false;
    const pedido = ex && ex.pedidos ? ex.pedidos.find(x => x.tipo === 'pane') : null;
    if (pedido && ex.dispensarPedido) { ex.dispensarPedido(pedido.id); return true; }
    return parar({cena: p.origem});
  }

  function chegar() {
    const v = estado.viagem, sys = elo.clues, veic = V();
    if (!v) return;
    /* A estrada matou o carro: a viagem não chega, ela PARA. Nada de cena de
       destino — o que abre é um pedido de pane no mapa do mestre, com a beira
       do trecho em que eles estavam rodando. Ver `parar`, logo abaixo. */
    const relPane = estado.relatorio;
    if (relPane && relPane.quebrou) { quebrouNaEstrada(v, relPane); return; }
    estado.viagem = null;
    // O carro vai junto: sai da cena de origem e estaciona na de destino.
    if (veic) {
      try { veic.remover(v.veiculo, v.origem); } catch (e) { console.error(e); }
    }
    soltarEDescer(sys, levarPara(v.destino, v.veiculo));
    /* O que a estrada fez com o carro entra AQUI, antes de ele estacionar na
       cena nova — o carro que chega é o carro que bateu, com os amassados e com
       o que estava no porta-malas. */
    const rel = estado.relatorio;
    const antes = Math.round(Number(v.carro.dano) || 0);
    const depois = Math.max(0, Math.min(100, antes + Math.round((rel && rel.dano) || 0)));
    v.carro.dano = depois;
    const estadoNovo = veic && veic.estadoDano ? veic.estadoDano(depois) : null;
    // Estaciona o carro na chegada, com a cara que ele tinha.
    setTimeout(() => {
      if (!veic || !veic.adicionar) return;
      const novo = veic.adicionar(v.carro.modelo, {sceneId: v.destino, cor: v.carro.cor, placa: v.carro.placa,
        sujeira: v.carro.sujeira, sentido: v.carro.sentido, farois: v.carro.farois, motor: false, pisca: false,
        dano: depois, carga: v.carro.carga || [],
        nome: (veic.medidas(v.carro.modelo).nome || 'Carro')});
      avisar('chegou', {...v, novo: novo && novo.id, dano: depois});
    }, 260);
    if (depois > antes && sys && estadoNovo) {
      sys.toast(depois >= 90 && antes < 90 ? 'O CARRO MORREU' : 'O CARRO SE ESTRAGOU',
        estadoNovo.nome + ' · ' + estadoNovo.resumo, depois >= 90 ? 'alerta' : 'carro');
    }
    aplicarCusto(rel);
    estado.relatorio = null;
    sys.toast('CHEGOU', nomeDaCena(v.destino), 'carro');
  }
  /* ============================================================ pane
     O carro morreu no meio do caminho. A viagem fica pendurada em
     `estado.pane` até o mestre dizer onde eles pararam; o carro guarda a
     lataria acabada e a carga, e o personagem continua escondido (ele está
     dentro do carro, parado no acostamento) até a cena nova existir. */
  function quebrouNaEstrada(v, rel) {
    const sys = elo.clues, ex = elo.exploracao, veic = V();
    estado.viagem = null;
    const antes = Math.round(Number(v.carro.dano) || 0);
    const LIM = (veic && veic.LIMITE_ANDA) || 90;
    const dano = Math.max(LIM, Math.min(100, antes + Math.round(rel.dano || 0)));
    v.carro.dano = dano;
    estado.pane = {...v, rel, dano};
    avisar('quebrou', {...estado.pane});
    // O pedido é igual ao da viagem: o carro é a passagem, e o que falta é o lugar.
    const clue = {id: v.veiculo, name: (veic && veic.medidas(v.carro.modelo).nome) || 'Carro',
      type: 'veiculo', data: {tipo: 'carro'}};
    if (ex && ex.pedir) {
      const pedido = ex.pedir(clue, 'pane', 'mestre',
        {carro: v.carro, trecho: (rel && rel.variacao) || '', andou: rel && rel.andou,
         destino: v.destino, veiculo: v.veiculo});
      if (pedido) return;
    }
    // Sem exploração (testes soltos): para na própria cena de origem.
    parar({cena: v.origem, pedido: null});
    void sys;
  }
  /* O mestre escolheu a beira: leva o personagem para lá, estaciona o carro
     quebrado ao lado dele e cobra da viagem só o pedaço que eles andaram. */
  function parar({cena, pedido = null} = {}) {
    const p = estado.pane, sys = elo.clues, veic = V();
    if (!p || !cena || !root.SceneLibrary || !root.SceneLibrary.has(cena)) return false;
    estado.pane = null;
    estado.esperando = null;
    if (veic) { try { veic.remover(p.veiculo, p.origem); } catch (e) { console.error(e); } }
    estado.veiculoEscondido = null;
    soltarEDescer(sys, levarPara(cena, p.veiculo));
    setTimeout(() => {
      if (!veic || !veic.adicionar) return;
      const novo = veic.adicionar(p.carro.modelo, {sceneId: cena, cor: p.carro.cor, placa: p.carro.placa,
        sujeira: p.carro.sujeira, sentido: p.carro.sentido, farois: false, motor: false, pisca: false,
        dano: p.dano, carga: p.carro.carga || [],
        nome: (veic.medidas(p.carro.modelo).nome || 'Carro')});
      avisar('parou', {...p, cena, novo: novo && novo.id});
    }, 260);
    /* O relógio cobra só o trecho que venceram, e as batidas do caminho doem
       igual — foi o mesmo caminho, só que interrompido. */
    const rel = p.rel || {};
    const andou = clamp(Number(rel.andou) || 0, 0, 1);
    aplicarCusto({...rel, minutos: Math.max(1, Math.round((rel.minutos ?? 0) * (.35 + andou * .65)))});
    estado.relatorio = null;
    if (sys) {
      const est = veic && veic.estadoDano ? veic.estadoDano(p.dano) : null;
      sys.toast('PAROU NA ESTRADA', (est ? est.nome + ' · ' : '') + 'A viagem acabou na beira', 'alerta');
    }
    void pedido;
    return true;
  }

  /* O que a viagem cobra: tempo do relógio (que passa na fome e na sede) e,
     se o mestre quiser, o hematoma de quem bateu no caminho. */
  function aplicarCusto(rel) {
    const n = elo.necessidades, saude = elo.saude, sys = elo.clues;
    const rota = estado.rota || resolverPercurso();
    estado.rota = null;
    const minutos = rel && rel.minutos !== undefined ? rel.minutos : rota.minutos;
    if (n && minutos > 0) n.pular(minutos);
    if (!rel) return;
    if (!pref('viagemConsequencias', true) || !saude) return;
    /* O que machuca não é bater, é a velocidade com que se bate. Roçar num
       carro a caminho não deixa marca; jogar o carro contra um de frente,
       deixa. Por isso só os impactos acima do limiar viram ferimento, e a
       força do ferimento sai da força do impacto. */
    const LIMIAR = .34;
    const fortes = (rel.impactos || []).filter(f => f >= LIMIAR).sort((a, b) => b - a).slice(0, 3);
    if (!fortes.length) return;
    /* CARROCERIA. Num carro, quem bate primeiro é a lataria: o para-choque
       amassa, o cinto segura, e o corpo leva o que sobra. De moto e de
       bicicleta não há lataria nenhuma — quem bate é a pessoa, e ela ainda cai
       e desliza no asfalto. Por isso o mesmo impacto machuca bem mais, e a
       bicicleta é a pior das três: não tem nem a roupa de couro de quem anda
       de moto, nem o peso da moto para levar a pancada embora.

       O capacete desconta a cabeça (e só ela): é exatamente para isso que ele
       serve, e é o que faz valer a pena o mestre marcar aquela caixinha. */
    const M = rel.veiculo ? V().medidas(rel.veiculo) : null;
    const semLataria = M && M.moto, deBike = M && M.bicicleta;
    const peso = deBike ? 2.1 : semLataria ? 1.75 : 1;
    const decapacete = !!(rel.capacete);
    const onde = semLataria ? ['shin_near', 'arm_near', 'torso', 'head'] : ['torso', 'head', 'arm_near', 'shin_near'];
    let pior = 0;
    fortes.forEach((f, k) => {
      pior = Math.max(pior, f);
      const parte = onde[k % onde.length];
      const capacetado = parte === 'head' && decapacete;
      const forca = f * peso * (capacetado ? .35 : 1);
      // Acima de 0,85 de fechamento (de frente, no talo) não é mais hematoma: corta.
      if (f >= .85 && k === 0 && !capacetado) saude.injure(parte, 'cut', Math.round((10 + (f - .85) * 40) * peso));
      else saude.injure(parte, 'bruise', Math.round(6 + (forca - LIMIAR) * 46));
    });
    /* Cair da moto ou da bicicleta é um ferimento à parte da pancada: a
       raspada no asfalto, que vem em cima de tudo o que já doeu. */
    if (semLataria && pior >= .55) saude.injure('arm_far', 'bruise', Math.round((deBike ? 14 : 10) + (pior - .55) * 30));
    if (sys) {
      const comoFoi = pior >= .85 ? 'Batida em cheio: corte e hematomas'
        : fortes.length + (fortes.length > 1 ? ' batidas fortes' : ' batida forte') + ' na estrada';
      sys.toast('A VIAGEM DOEU', semLataria ? comoFoi + ' — e sem lataria nenhuma para segurar' : comoFoi, 'alerta');
    }
  }

  /* ================================================================ ligar */
  function ligar({clues = null, stage = null, exploracao = null, necessidades = null, saude = null} = {}) {
    elo.clues = clues || elo.clues;
    elo.stage = stage || elo.stage;
    elo.exploracao = exploracao || elo.exploracao;
    elo.necessidades = necessidades || elo.necessidades;
    elo.saude = saude || elo.saude;
    registrarSons();
    registrarTipos();
    if (V()) V().aoUsar = aoUsar;
    if (root.SceneStage && !root.SceneStage.__viagemCarro) {
      root.SceneStage.__viagemCarro = true;
      root.SceneStage.worldObjects.add(provedorPartida);
    }
    elo.ligado = true;
    return ViagemDeCarro;
  }

  const ViagemDeCarro = {
    ligar, aoUsar, sairDoMapa, viajar, chegar, parar, pararNaBeira, desistir, estado, prefs: () => ({
      minigame: pref('viagemMinigame', 'perguntar'), variacao: pref('viagemVariacao', ''),
      percurso: percursoDe(pref('viagemPercurso', 'medio')).id,
      minutos: pref('viagemMinutos', 25), duracao: pref('viagemDuracao', 26),
      rota: resolverPercurso(), consequencias: pref('viagemConsequencias', true)
    }),
    PERCURSOS, percursoDe, resolverPercurso,
    definirPref, pref,
    on(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    get emViagem() { return !!(estado.partida || estado.viagem || estado.esperando || estado.pane); }
  };
  root.ViagemDeCarro = ViagemDeCarro;
  registrarSons();
  registrarTipos();
  if (V()) V().aoUsar = aoUsar;
  if (typeof module !== 'undefined' && module.exports) module.exports = ViagemDeCarro;
})(typeof window !== 'undefined' ? window : globalThis);
