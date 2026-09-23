'use strict';
/* O trânsito do minigame.

   A queixa foi específica: “um carro não vai só se chocar com o nosso e acabou,
   não tem sentido; eles ou vão tentar desviar ou vão brecar. E vi carros
   andando nas duas vias, eles devem respeitar o trânsito. E quero que colidam
   com o nosso carro e não atravessem ele.”

   Então é isso que este teste cobra, e nesta ordem: faixa (ninguém anda no meio
   da pista nem na contramão sem motivo), comportamento (fila, desvio,
   ultrapassagem, frear quando não dá), e colisão (bate, empurra, e NUNCA fica
   por cima do nosso carro).

   O desenho é conferido por `minigame-arte`; aqui é só o que acontece. */
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const M = require('../mestre/minigame-estrada.js');

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};
const abrir = (opts = {}) => {
  const ctl = M.criar({variacao: 'rodovia', semente: 21, duracao: 30, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: '', ...opts});
  // Cenários de manobra controlam o trânsito; curvas, cristas e eventos têm testes próprios.
  for (const seg of ctl.segmentos) { seg.curva = 0; seg.p1.mundo.y = 0; seg.p2.mundo.y = 0; seg.evento = null; }
  ctl.draw(ctx, 1 / 30);
  return ctl;
};
const rodar = (ctl, n, v = 5000) => { for (let k = 0; k < n; k++) { ctl.estado.velocidade = v; ctl.draw(ctx, 1 / 30); } };
const REL = (ctl, z) => {
  const pista = ctl.segmentos.length * 200;
  const d = ((z - ctl.estado.posicao) % pista + pista) % pista;
  return d > pista / 2 ? d - pista : d;
};

/* ------------------------------------------------------- cada trecho tem via */
{
  assert.deepEqual(Object.keys(M.VIAS).sort(), ['dupla', 'maoDupla']);
  for (const id of M.LISTA) {
    const v = M.VARIACOES[id];
    assert(M.VIAS[v.via], `${id}: declara em que tipo de via corre ("${v.via}")`);
  }
  // Pista dupla tem duas faixas nossas e a contramão longe, do outro lado do
  // canteiro; mão dupla tem uma de cada lado, e por isso ultrapassar é invadir.
  const d = M.VIAS.dupla, m = M.VIAS.maoDupla;
  assert.equal(d.nossas.length, 2, 'pista dupla: duas faixas na nossa mão');
  assert.equal(m.nossas.length, 1, 'mão dupla: uma só');
  assert(d.separada === true && m.separada === false);
  assert(Math.min(...d.contra) < -1.2, 'na pista dupla, quem vem de frente está longe, não do nosso lado');
  assert(Math.abs(m.contra[0] + m.nossas[0]) < .01, 'na mão dupla as duas faixas são simétricas');
  for (const via of [d, m]) for (const f of [...via.nossas, ...via.contra])
    assert(Number.isFinite(f), 'toda faixa é um número');
}

/* ------------------------------------------------------- ninguém anda fora de faixa */
{
  for (const id of ['rodovia', 'terra', 'cidade']) {
    /* Sem desenhar um quadro sequer: “no nascimento” é antes de a IA rodar.
       Depois do primeiro quadro um carro já pode ter começado a mudar de
       faixa de propósito, e aí a conta seria de outra coisa. */
    const ctl = M.criar({variacao: id, semente: 21, duracao: 30, doc: null,
      carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: ''});
    const via = M.VIAS[M.VARIACOES[id].via];
    const faixas = [...via.nossas, ...via.contra];
    // No nascimento, todo carro está EXATAMENTE numa faixa.
    for (const c of ctl.transito)
      assert(faixas.some(f => Math.abs(c.off - f) < 1e-6),
        `${id}: carro nasce numa faixa, não num lugar qualquer (${c.off})`);
    // E cada um anda no sentido da mão dele.
    for (const c of ctl.transito) {
      const dele = c.contramao ? via.contra : via.nossas;
      assert(dele.some(f => Math.abs(c.off - f) < 1e-6), `${id}: e na mão certa`);
      assert(c.contramao ? c.velocidade < 0 : c.velocidade > 0, `${id}: anda para o lado da mão dele`);
    }
    // Depois de um tempo rodando, ninguém foi parar no mato nem na mão errada
    // sem estar ultrapassando.
    rodar(ctl, 300);
    /* O limite sai do PRÓPRIO desenho da via, não de um número solto: a faixa
       mais distante mais a largura de um carro. Estava fixo em 2.4 e passou a
       acusar falso quando as faixas foram afastadas para dar margem de manobra. */
    const limite = Math.max(...faixas.map(Math.abs)) + via.largura + .2;
    for (const c of ctl.transito) {
      assert(Math.abs(c.off) < limite, `${id}: ninguém sai do mundo (${c.off.toFixed(2)}, limite ${limite.toFixed(2)})`);
      // Em manobra (ultrapassando, voltando, ou se recompondo de uma batida)
      // ele está entre faixas de propósito — o invariante é para quem já chegou.
      if (c.contramao || c.ultrapassando > 0 || c.reagindo > 0 || c.espera > 0
        || Math.abs(c.off - c.alvo) > .01) continue;
      if (c.ia.cedendoJogador) {
        assert(['espera', 'prioridade'].includes(c.ia.estado), 'fora da faixa, aguarda retorno após ceder ao jogador');
        assert((via.separada || c.off > 0) && Math.abs(c.off) + c.larguraContato / 2 <= 1,
          'ao ceder, permanece numa faixa ou na beira da própria mão');
        continue;
      }
      const dele = via.nossas;
      const perto = Math.min(...dele.map(f => Math.abs(c.off - f)));
      assert(perto < .3, `${id}: fora de manobra, o carro fica na faixa dele (${c.off.toFixed(2)})`);
    }
    /* DE TODA FAIXA NOSSA TEM DE HAVER PARA ONDE FUGIR. O pedido foi “alargue as
       ruas das corridas… para que eu possa desviar dos carros sem precisar ir
       pro mato ou ir contra mão”, e é exatamente isso que se mede aqui — não um
       vão fixo entre faixas, que é um número arbitrário, mas a pergunta que o
       jogador faz com um carro parado na frente: **existe um lugar para onde eu
       possa ir?**

       Um lugar serve quando cumpre as três coisas ao mesmo tempo:
         · fica longe o bastante para o outro carro não pegar mais — a MESMA
           conta da batida (`LARGURA_CARRO * .9`), para o teste não medir uma
           régua diferente da que o jogo usa;
         · a lataria inteira ainda está no asfalto (|x| + meio carro ≤ 1);
         · e é do nosso lado da estrada: na mão dupla, a contramão não conta
           como saída, que é metade da queixa.

       Pede-se folga de 10%, senão o desvio existe no papel e não na mão. */
    const esquiva = via.largura * .9, meio = via.largura / 2;
    for (const f of via.nossas) {
      const candidatos = [Math.sign(f || 1) * (1 - meio), ...via.nossas.filter(o => o !== f)];
      const nosso = p => via.nossas.length > 1 || Math.sign(p) === Math.sign(f || 1);
      const saidas = candidatos.filter(p => Math.abs(p - f) >= esquiva * 1.1 && Math.abs(p) + meio <= 1.0001 && nosso(p));
      const melhor = Math.max(...candidatos.map(p => Math.abs(p - f)));
      assert(saidas.length > 0,
        `${id}: da faixa ${f.toFixed(2)} dá para desviar sem mato nem contramão ` +
        `(precisa andar ${esquiva.toFixed(3)}, o melhor que há é ${melhor.toFixed(3)})`);
    }
  }
}

/* ------------------------------------------------------- fila e desvio */
{
  /* Um lento na frente de um rápido, os dois na mesma faixa de uma pista dupla:
     o de trás tem para onde ir, então ele DESVIA — e não para nem atravessa. */
  const ctl = abrir();
  const via = M.VIAS.dupla;
  ctl.transito.length = 2;
  const [lento, rapido] = ctl.transito;
  const p = ctl.estado.posicao;
  Object.assign(lento, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 1500, vOrig: 1500, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  Object.assign(rapido, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 3600, vOrig: 3600, modelo: 'hatch_velho', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  lento.z = p + 200 * 40; rapido.z = p + 200 * 28;
  ctl.estado.jogadorX = -1.5;                       // fora do caminho dos dois
  /* A manobra inteira, quadro a quadro: sair da faixa, passar e voltar. Olhar
     só o fim daria “não mudou de faixa” justamente quando tudo deu certo. */
  let saiu = false, vMin = Infinity, passou = false;
  for (let k = 0; k < 600; k++) {
    ctl.estado.velocidade = 1200; ctl.draw(ctx, 1 / 30);
    if (Math.abs(rapido.off - via.nossas[1]) < .1) saiu = true;
    if (saiu) vMin = Math.min(vMin, rapido.velocidade);
    if (saiu && REL(ctl, rapido.z) > REL(ctl, lento.z)) passou = true;
  }
  assert(saiu, `o carro de trás mudou de faixa para passar (ficou em ${rapido.off.toFixed(2)})`);
  assert(passou, 'e passou mesmo pelo lento, em vez de ficar do lado dele');
  assert(vMin > 500, `freia enquanto ainda ocupa a faixa do líder e continua a manobra (mínima ${Math.round(vMin)})`);
  assert(Math.abs(rapido.off - via.nossas[0]) < .12, 'e voltou para a faixa da direita depois');
  assert(Math.abs(lento.off - via.nossas[0]) < .02, 'o da frente continua na faixa dele, sem ser empurrado');
}
{
  /* Agora sem para onde ir: mão dupla, contramão ocupada. Quem está atrás TEM
     de frear — é o caso em que “só se chocar e acabou” seria o errado. */
  const ctl = abrir({variacao: 'terra'});
  const via = M.VIAS.maoDupla;
  ctl.transito.length = 3;
  const [lento, atras, vindo] = ctl.transito;
  const p = ctl.estado.posicao;
  Object.assign(lento, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 1300, vOrig: 1300, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  Object.assign(atras, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 3400, vOrig: 3400, modelo: 'hatch_velho', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  Object.assign(vindo, {contramao: true, sentido: -1, off: via.contra[0], alvo: via.contra[0], faixa: 0,
    velocidade: -2600, vOrig: -2600, modelo: 'sedan_oficial', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  lento.z = p + 200 * 44; atras.z = p + 200 * 32;
  ctl.estado.jogadorX = via.nossas[0];
  /* O carro que vem de frente é mantido vindo: um só, solto, passaria em três
     segundos e aí a contramão ficaria livre de verdade — o que este bloco quer
     ver é o comportamento ENQUANTO ela está ocupada. */
  let vMin = Infinity, invadiu = false;
  for (let k = 0; k < 80; k++) {
    vindo.z = (ctl.estado.posicao + 200 * 55) % (ctl.segmentos.length * 200);
    vindo.off = via.contra[0]; vindo.alvo = via.contra[0];
    ctl.estado.velocidade = 900; ctl.draw(ctx, 1 / 30);
    vMin = Math.min(vMin, atras.velocidade);
    if (Math.abs(atras.off - via.contra[0]) < .3) invadiu = true;
  }
  assert(!invadiu, 'com alguém vindo, o carro de trás não sai para a contramão');
  assert(vMin < 3000, `e freia atrás do lento (mínima ${Math.round(vMin)})`);
  assert(atras.velocidade > 0, 'mas não para no meio da estrada');
  // A distância entre eles não vira sobreposição: ninguém entra dentro do outro.
  assert(REL(ctl, lento.z) - REL(ctl, atras.z) > 0, 'o de trás continua atrás');
}

/* ------------------------------------------------------- ultrapassar pela contramão */
{
  /* Mão dupla com o corredor limpo: aí o carro ARRISCA — é o que dá tensão a
     uma estrada de mão dupla, e foi o que o mestre escolheu. */
  const ctl = abrir({variacao: 'terra'});
  const via = M.VIAS.maoDupla;
  ctl.transito.length = 2;
  const [lento, atras] = ctl.transito;
  const p = ctl.estado.posicao;
  Object.assign(lento, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 1300, vOrig: 1300, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  Object.assign(atras, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 3400, vOrig: 3400, modelo: 'hatch_velho', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  lento.z = p + 200 * 44; atras.z = p + 200 * 32;
  ctl.estado.jogadorX = -1.9;                       // longe, para não atrapalhar
  let saiu = false;
  for (let n = 0; n < 200 && !saiu; n++) {
    ctl.estado.velocidade = 900; ctl.draw(ctx, 1 / 30);
    if (Math.abs(atras.off - via.contra[0]) < .12) saiu = true;
  }
  assert(saiu, `com a contramão limpa, o carro sai para ultrapassar (ficou em ${atras.off.toFixed(2)})`);
  assert(atras.ultrapassando > 0 || atras.espera > 0, 'e fica comprometido com a manobra, não oscilando');
  // E volta sozinho depois.
  rodar(ctl, 600, 900);
  assert(Math.abs(atras.off - via.nossas[0]) < .2, `e depois volta para a mão dele (${atras.off.toFixed(2)})`);
}

/* ------------------------------------------------------- bater, e não atravessar */
{
  const ctl = abrir();
  const via = M.VIAS.dupla;
  const pista = ctl.segmentos.length * 200;
  ctl.transito.length = 1;
  const c = ctl.transito[0];
  Object.assign(c, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 1600, vOrig: 1600, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0, dano: 0});
  ctl.estado.jogadorX = via.nossas[0];
  ctl.estado.manual = true;
  let bateu = -1;
  for (let n = 0; n < 40; n++) {
    if (bateu < 0) { ctl.estado.velocidade = 8200; c.z = (ctl.estado.posicao + 8200 / 30 + 120) % pista; }
    ctl.draw(ctx, 1 / 30);
    if (ctl.estado.batidas && bateu < 0) bateu = n;
  }
  assert(bateu >= 0, 'bateu no carro da frente');
  const rel = ctl.relatorio();
  assert(rel.pior > .6, `e foi uma batida forte, porque a diferença de velocidade era grande (${rel.pior})`);
  assert(c.dano > 0, 'o outro carro também ficou amassado');
  assert(c.reagindo !== 0 || Math.abs(c.off - via.nossas[0]) > .05, 'e reagiu: guinou ou freou');
  /* O que o pedido pede em letras maiúsculas: NUNCA por cima do nosso carro.
     Dentro do espaço do jogador, ninguém pode ocupar a mesma faixa. */
  for (let n = 0; n < 120; n++) {
    ctl.draw(ctx, 1 / 30);
    const r = REL(ctl, c.z);
    if (Math.abs(r) < 200 * 2.6)
      assert(Math.abs(c.off - ctl.estado.jogadorX) > via.largura * .62,
        `quadro ${n}: o carro saiu de cima do nosso em vez de atravessar (dist ${Math.abs(c.off - ctl.estado.jogadorX).toFixed(2)})`);
  }
}

/* ------------------------------------------------------- a derrapagem da batida */
{
  const ctl = abrir();
  const via = M.VIAS.dupla;
  const pista = ctl.segmentos.length * 200;
  ctl.transito.length = 1;
  const c = ctl.transito[0];
  Object.assign(c, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0], faixa: 0,
    velocidade: 1600, vOrig: 1600, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0});
  ctl.estado.jogadorX = via.nossas[0];
  ctl.estado.manual = true;
  ctl.key({code: 'KeyD', key: 'd'});                // segurando para a direita
  for (let n = 0; n < 6; n++) {
    ctl.estado.velocidade = 8200; c.z = (ctl.estado.posicao + 8200 / 30 + 120) % pista;
    ctl.draw(ctx, 1 / 30);
    if (ctl.estado.batidas) break;
  }
  assert(ctl.estado.batidas > 0, 'bateu');
  assert(ctl.estado.derrapagem > .3, 'a batida põe o carro em derrapagem');
  const antes = ctl.estado.jogadorX;
  ctl.draw(ctx, 1 / 30);
  // Durante a derrapagem o volante não responde: mesmo com D apertado, o carro
  // vai para o lado do impacto, não para onde o jogador manda.
  assert(Math.abs(ctl.estado.atravessado) > .1, 'e o carro fica atravessado — a batida tem animação');
  let i = 0;
  while (ctl.estado.derrapagem > .02 && i < 200) { ctl.draw(ctx, 1 / 30); i++; }
  assert(i < 40, `a derrapagem passa rápido (${(i / 30).toFixed(2)} s)`);
  assert(Math.abs(ctl.estado.atravessado) < .3, 'e o carro se endireita depois');
  assert(ctl.estado.jogadorX !== antes, 'o impacto empurrou o carro de lado');
}

/* ============================================ a FROTA da estrada
   A queixa: “não é porque eu estou de moto que só aparece moto no minigame —
   aparece carro também”.

   E estava certa: o modelo de cada veículo do trânsito era sorteado com peso
   igual entre TODOS os modelos do jogo. Com três carros, isso dava três
   carros; com três motos e uma bicicleta no catálogo, virou quase metade de
   moto e uma bicicleta a cada sete — numa rodovia.

   Nunca houve ligação entre o que o jogador pilota e o que vem na estrada, e
   este teste fixa as duas coisas: a frota é do TRECHO, e é a mesma pilotando
   o que for. */
{
  const V = globalThis.Veiculos;
  const classe = id => { const m = V.medidas(id); return m.bicicleta ? 'bicicleta' : m.moto ? 'moto' : 'carro'; };
  const frota = (variacao, meu, sementes = 40) => {
    const c = {carro: 0, moto: 0, bicicleta: 0};
    for (let s = 0; s < sementes; s++) {
      const ctl = M.criar({variacao, semente: 400 + s, duracao: 30, doc: null,
        carro: {data: {modelo: meu}}, destinoNome: ''});
      for (const t of ctl.transito) c[classe(t.modelo)]++;
    }
    const tot = c.carro + c.moto + c.bicicleta;
    return {tot, carro: c.carro / tot, moto: c.moto / tot, bicicleta: c.bicicleta / tot};
  };

  // 1. Numa rodovia o que passa é CARRO.
  const rodovia = frota('rodovia', 'moto_rua');
  assert(rodovia.tot > 100, `há trânsito de sobra para medir (${rodovia.tot})`);
  assert(rodovia.carro > .75, `numa rodovia o trânsito é de carro (${(rodovia.carro * 100).toFixed(0)}%)`);
  assert(rodovia.moto > .03 && rodovia.moto < .25,
    `moto aparece de vez em quando, e não o tempo todo (${(rodovia.moto * 100).toFixed(0)}%)`);
  assert.equal(rodovia.bicicleta, 0, 'e bicicleta não anda em rodovia');

  // 2. Pilotando o que for, a frota é a mesma: nunca houve espelho.
  const deCarro = frota('rodovia', 'sedan_oficial');
  assert(Math.abs(deCarro.moto - rodovia.moto) < .05,
    `de carro ou de moto, o trânsito é o mesmo (${(deCarro.moto * 100).toFixed(0)}% contra ${(rodovia.moto * 100).toFixed(0)}% de moto)`);

  // 3. Onde cabe duas rodas, cabe mais: terra e cidade.
  for (const onde of ['terra', 'cidade']) {
    const f = frota(onde, 'sedan_oficial');
    assert(f.moto > rodovia.moto, `em ${onde} passa mais moto que na rodovia (${(f.moto * 100).toFixed(0)}%)`);
    assert(f.bicicleta > 0, `e é onde uma bicicleta faz sentido (${(f.bicicleta * 100).toFixed(0)}%)`);
    assert(f.carro > .5, `mesmo lá, a maioria continua sendo carro (${(f.carro * 100).toFixed(0)}%)`);
  }

  // 4. Cada um da sua cor: uma fila de carros idênticos lê como adesivo repetido.
  const ctl = M.criar({variacao: 'rodovia', semente: 21, duracao: 30, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: ''});
  const combinacoes = new Set(ctl.transito.map(t => t.modelo + ':' + t.cor));
  assert(combinacoes.size >= 8, `os veículos da estrada não são todos iguais (${combinacoes.size} combinações)`);
  // E a cor escolhida é uma cor de verdade daquele modelo, que sobrevive a `dados`.
  for (const t of ctl.transito)
    assert.equal(V.dados({data: {modelo: t.modelo, cor: t.cor}}).cor, t.cor,
      `${t.modelo}: a cor "${t.cor}" é uma cor válida daquele modelo`);

  // 5. E cada um anda no passo dele: bicicleta no meio do trânsito não vem a 70.
  const porClasse = {};
  for (let s = 0; s < 30; s++) {
    const k = M.criar({variacao: 'cidade', semente: 700 + s, duracao: 30, doc: null,
      carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: ''});
    for (const t of k.transito) if (!t.contramao) (porClasse[classe(t.modelo)] = porClasse[classe(t.modelo)] || []).push(t.vOrig);
  }
  const media = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert(porClasse.bicicleta && porClasse.bicicleta.length > 3, 'há bicicletas medidas');
  assert(media(porClasse.bicicleta) < media(porClasse.carro) * .5,
    `a bicicleta do trânsito anda devagar (${Math.round(media(porClasse.bicicleta))} contra ${Math.round(media(porClasse.carro))})`);
  assert(media(porClasse.moto) > media(porClasse.carro),
    'e a moto anda um pouco mais que o carro');
}

console.log('PASS: trânsito da estrada — cada trecho com a via dele, ninguém fora de faixa nem na mão errada, fila que desvia quando há espaço e freia quando não há, ultrapassagem pela contramão só com o corredor limpo (e volta depois), a batida com estrago dos dois lados, derrapagem com o carro atravessado e ninguém por cima do nosso, e a FROTA de cada trecho (rodovia é carro, terra e cidade têm mais duas rodas, bicicleta só onde cabe) — a mesma pilotando o que for, cada um da sua cor e no passo dele');
