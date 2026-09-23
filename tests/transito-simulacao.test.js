'use strict';
const assert = require('node:assert/strict');
const T = require('../mestre/transito-estrada.js');
const dupla = {nossas: [.36, -.36], contra: [-2.04, -2.76], separada: true, largura: .4};
const simples = {nossas: [.36], contra: [-.36], separada: false, largura: .4};
const carro = (z, velocidade = 3000, off = .36, extra = {}) => ({z, velocidade, vOrig: velocidade,
  off, alvo: off, sentido: velocidade < 0 ? -1 : 1, dano: 0, ...extra});
function bancada(atores = [], opts = {}) {
  const carros = [], contatos = [];
  const motor = T.criar({carros, via: dupla, comprimento: 200000, semente: 31,
    aoContato: c => contatos.push(c), ...opts});
  carros.push(...atores);
  // Um passo inicial cria perfis; congelar o perfil torna os cenários explícitos.
  motor.passo();
  for (const c of carros) { Object.assign(c.ia, T.PERFIS.comum, {ritmo: 1, variacao: 1, cooldown: 1e6, manobra: null, passando: null}); c.alvo = c.off; c.seta = null; }
  return {motor, carros, contatos};
}
function rodar(b, segundos, fps = 60, jogador, inspecionar = () => {}) {
  for (let n = 0; n < segundos * fps; n++) { b.motor.avancar(1 / fps, jogador); inspecionar(); }
}

// Uma fila realmente para e depois anda, sem ultrapassar ou encostar no líder.
for (const sentido of [1, -1]) {
  const off = sentido > 0 ? .36 : -2.76;
  const lider = carro(60000, 0, off, {sentido});
  const a = carro(60000 - sentido * 7500, sentido * 3000, off);
  const b = carro(60000 - sentido * 15000, sentido * 3200, off);
  const teste = bancada([lider, a, b]);
  rodar(teste, 20, 60, null, () => {
    assert(teste.motor.distancia(a.z, lider.z) * sentido > 1470, 'fila mantém comprimento dos carros');
    assert(teste.motor.distancia(b.z, a.z) * sentido > 1470, 'segundo veículo freia em cadeia');
  });
  assert(Math.abs(a.velocidade) < 3 && Math.abs(b.velocidade) < 3, 'fila para completamente');
  assert.equal(a.dano + b.dano + lider.dano, 0, 'fila sem danos');
  lider.vOrig = sentido * 2200;
  rodar(teste, 10);
  assert(Math.abs(b.velocidade) > 800, 'fila retoma sem travamento');
}

// A percepção escolhe o mais próximo, independe da ordem e atravessa a emenda.
{
  const a = carro(198000), perto = carro(1500, 1500), longe = carro(8000, 500);
  const b = bancada([a, longe, perto]);
  assert.equal(b.motor.perceber(a).carro.ref, perto);
  const player = carro(199900, 0); player.modelo = 'sedan_oficial';
  assert.equal(b.motor.perceber(a, player).carro.jogador, true);
}

// Um carro rápido atrás e o ponto cego bloqueiam a troca.
{
  const a = carro(20000), rapido = carro(14000, 7000, -.36);
  const b = bancada([a, rapido]);
  assert.equal(b.motor.corredorLivre(a, -.36), false);
  rapido.z = a.z; rapido.velocidade = a.velocidade;
  assert.equal(b.motor.corredorLivre(a, -.36), false);
  rapido.z = 80000;
  assert.equal(b.motor.corredorLivre(a, -.36), true);
}

// Ultrapassa pela esquerda, sinaliza antes de sair, passa e só então retorna.
for (const via of [dupla, simples]) {
  const lento = carro(34000, 1500), rapido = carro(28000, 3400);
  const b = bancada([lento, rapido], {via}); rapido.ia.cooldown = 0;
  let sinalizou = false, saiu = false, passou = false, retornou = false;
  rodar(b, 25, 60, null, () => {
    if (rapido.seta === 'esquerda' && Math.abs(rapido.off - .36) < .001) sinalizou = true;
    if (rapido.off < -.3) saiu = true;
    if (saiu && b.motor.distancia(lento.z, rapido.z) > 2000) passou = true;
    if (passou && rapido.off > .35 && !rapido.ia.manobra) retornou = true;
    assert.equal(rapido.dano + lento.dano, 0, 'ultrapassagem sem colisão');
  });
  assert(sinalizou && saiu && passou && retornou, JSON.stringify({via, sinalizou, saiu, passou, retornou, ia: rapido.ia}));
}

// Curva forte, crista, cruzamento ou contramão próxima impedem ultrapassagem.
for (const obstaculo of ['curva', 'crista', 'cruzamento', 'oposto']) {
  const lento = carro(36000, 1300), a = carro(30000, 3400);
  const atores = [lento, a];
  if (obstaculo === 'oposto') atores.push(carro(46000, -3000, -.36));
  const b = bancada(atores, {via: simples, segmentoEm: z => ({
    curva: obstaculo === 'curva' ? 4 : 0,
    evento: obstaculo === 'cruzamento' ? {tipo: 'cruzamento'} : null,
    p1: {mundo: {y: 0}}, p2: {mundo: {y: obstaculo === 'crista' ? (z % 4000 < 2000 ? 8 : -8) : 0}}
  })});
  a.ia.cooldown = 0;
  rodar(b, 1.5);
  assert.equal(a.off, .36, obstaculo + ': permanece na sua mão');
}

// Mudança nas condições durante a ultrapassagem: freia e busca retorno.
{
  const lento = carro(35000, 1200), a = carro(29000, 3400);
  const b = bancada([lento, a], {via: simples}); a.ia.cooldown = 0;
  for (let n = 0; n < 900 && a.off > -.35; n++) b.motor.passo();
  assert(a.off < -.3, 'iniciou a ultrapassagem');
  const vindo = carro(a.z + 14000, -3300, -.36); b.carros.push(vindo);
  let abortou = false;
  rodar(b, 6, 60, null, () => { if (a.ia.abortar || a.ia.motivo.includes('abortando')) abortou = true; });
  assert(abortou, 'detecta risco novo e aborta');
  assert(a.off > .3, 'recupera sua mão');
}

// Fora da tela, parada do jogador, frenagem antecipada e nenhum tratamento hostil.
{
  const a = carro(120000, 3000), b = bancada([a]);
  const jogador = {z: 129000, off: .36, velocidade: 0, modelo: 'sedan_oficial'};
  rodar(b, 15, 60, jogador);
  assert(a.velocidade < 3 && b.contatos.length === 0, 'para atrás do jogador sem contato');
}

// Contato inevitável produz dano uma vez e resolve a penetração em z.
{
  const a = carro(20000, 6500), b = bancada([a]);
  const jogador = {z: 21600, off: .36, velocidade: 0};
  rodar(b, .5, 60, jogador);
  assert.equal(b.contatos.length, 1);
  assert(Math.abs(b.motor.distancia(a.z, jogador.z)) >= a.comprimento, 'não atravessa o jogador');
}

// Um carro incapacitado continua no mundo, sinaliza e os outros param atrás.
{
  const parado = carro(40000, 0, .36, {dano: 95}), a = carro(32000, 3000);
  const b = bancada([parado, a]); rodar(b, 15);
  assert(parado.alerta && parado.velocidade === 0);
  assert(a.velocidade < 5 && a.dano === 0);
}

// Mesmo tempo simulado, exatamente a mesma trajetória a 30, 60 e 120 FPS.
{
  const resultados = [30, 60, 120].map(fps => {
    const b = bancada([carro(38000, 1500), carro(28000, 3300)]);
    b.carros[1].ia.cooldown = 0;
    rodar(b, 15, fps);
    return b.carros.map(c => [c.z, c.off, c.velocidade, c.ia.estado]);
  });
  assert.deepEqual(resultados[0], resultados[1]); assert.deepEqual(resultados[1], resultados[2]);
}

// Dois pedidos simultâneos para a mesma faixa: o carro de trás não fecha o da frente.
{
  const lider = carro(42000, 900), primeiro = carro(37000, 3300), segundo = carro(32700, 3700);
  const b = bancada([lider, primeiro, segundo]);
  primeiro.ia.cooldown = segundo.ia.cooldown = 0;
  let reservou = false;
  rodar(b, 14, 60, null, () => {
    if (primeiro.ia.manobra || segundo.ia.manobra) reservou = true;
    if (Math.abs(primeiro.off - segundo.off) < .4)
      assert(Math.abs(b.motor.distancia(primeiro.z, segundo.z)) >= primeiro.comprimento, 'reserva preserva espaço durante toda a manobra');
    assert.equal(primeiro.dano + segundo.dano + lider.dano, 0);
  });
  assert(reservou, 'houve disputa real por manobra');
}

// Corte de faixa e movimento lateral atravessando o veículo entre dois passos.
{
  const a = carro(20000, 3200), b = bancada([a]);
  const player = {z: 24500, off: -.36, velocidade: 1500};
  rodar(b, .5, 60, player);
  player.off = .36;
  b.motor.passo(player);
  assert(a.freando, 'reage ao corte no próximo passo, sem esperar decisão normal');
  assert.equal(b.contatos.length, 0, 'corte evitável não vira colisão');
  const c = carro(20000, 0), lateral = bancada([c]);
  lateral.motor.passo({z: c.z, off: .9, anteriorOff: -.9, velocidade: 0});
  assert.equal(lateral.contatos.length, 1, 'varredura detecta passagem lateral entre quadros');
}

// Contato frontal inevitável entre NPCs: dano, sem troca de ordem nem atravessamento.
{
  const a = carro(20000, 7000), vindo = carro(21700, -7000, .36);
  const b = bancada([a, vindo]);
  rodar(b, .5);
  assert(a.dano > 0 && vindo.dano > 0);
  assert(b.motor.distancia(a.z, vindo.z) >= a.comprimento, 'contato frontal separa os veículos');
  assert(a.dano < 80, 'contato persistente não repete dano a cada passo');
}

// Perfis reproduzíveis, distribuição inicial segura e velocidade menor na chuva.
{
  const criar = () => {
    const carros = Array.from({length: 40}, (_, i) => carro(i * 300, 3000, i % 2 ? -.36 : .36));
    const motor = T.criar({carros, via: dupla, comprimento: 400000, semente: 77});
    return {carros, motor};
  };
  const a = criar(), b = criar();
  assert.deepEqual(a.carros, b.carros);
  assert(new Set(a.carros.map(c => c.ia.perfil)).size === 3);
  for (const c of a.carros) for (const d of a.carros) if (c !== d && c.off === d.off)
    assert(Math.abs(a.motor.distancia(c.z, d.z)) > c.comprimento + 1000);
  const seco = bancada([carro(20000)]), chuva = bancada([carro(20000)], {condicoes: {aderencia: .62, chuva: true}});
  rodar(seco, 10); rodar(chuva, 10);
  assert(chuva.carros[0].velocidade < seco.carros[0].velocidade * .85);
}
console.log('PASS: simulação de trânsito — filas, sentidos, percepção circular, pontos cegos, ultrapassagens, aborto, emergência, parada, contatos, perfis, chuva e independência de FPS');
