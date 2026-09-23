'use strict';
const assert = require('node:assert/strict');
const T = require('../mestre/transito-estrada.js');
const via = {nossas: [.36, -.36], contra: [-2.04, -2.76], separada: true, largura: .4};
const carro = (z, velocidade, off = .36, extra = {}) => ({z, off, alvo: off,
  velocidade, vOrig: velocidade, sentido: 1, dano: 0, ...extra});
function bancada(atores) {
  const carros = [], motor = T.criar({carros, via, comprimento: 200000, semente: 31});
  carros.push(...atores);
  for (const c of carros) {
    motor.perceber(c);
    Object.assign(c.ia, T.PERFIS.comum, {ritmo: 1, variacao: 1, cooldown: 1e6});
  }
  return {carros, motor};
}
const rodar = (b, segundos, observar = () => {}) => {
  for (let n = 0; n < segundos * 60; n++) { b.motor.passo(); observar(); }
};

// O motorista vê a fila parada além do líder ainda em movimento.
{
  const medir = parada => {
    const a = carro(30000, 6000, .36, {vOrig: 8000}), lider = carro(39000, 6000);
    const b = bancada([a, lider, carro(44000, parada ? 0 : 6000)]);
    b.motor.passo();
    return {v: a.velocidade, ia: a.ia};
  };
  const livre = medir(false), fila = medir(true);
  assert(fila.v < livre.v - 5, 'reduz antes de o carro imediatamente à frente começar a frear');
  assert.notEqual(fila.ia.antecipando, null, 'registra o veículo adiante que motivou a antecipação');
}

// Faixa vizinha livre agora, mas com fluxo pior: não faz uma ultrapassagem inútil.
{
  const a = carro(30000, 3400), lider = carro(35500, 1400), esquerda = carro(39000, 900, -.36);
  const b = bancada([a, lider, esquerda]); a.ia.cooldown = 0;
  assert(b.motor.corredorLivre(a, -.36), 'há espaço físico inicial para começar');
  rodar(b, 1, () => assert.equal(a.off, .36, 'permanece na faixa com melhor fluxo'));
  assert.equal(a.seta, undefined, 'não sinaliza uma troca sem benefício');
}

// Quem está sendo ultrapassado não acelera para disputar com o outro.
{
  const a = carro(40000, 2000, .36, {vOrig: 4000}), passando = carro(41000, 3200, -.36);
  const b = bancada([a, passando]); passando.ia.passando = a.ia.id;
  rodar(b, .5);
  assert(a.velocidade <= 2000, 'mantém o ritmo enquanto o outro passa');
  assert.equal(a.ia.estado, 'cooperacao');
}

// O retorno está bloqueado: o motorista na direita abre espaço gradualmente.
{
  const ultrapassado = carro(45000, 1000), recebendo = carro(57500, 3000), voltando = carro(60000, 3000, -.36);
  const b = bancada([ultrapassado, recebendo, voltando]);
  voltando.ia.passando = ultrapassado.ia.id;
  let cedeu = false, pediu = false, retornou = false, freada = 0;
  rodar(b, 12, () => {
    if (voltando.ia.pedidoFaixa === .36) pediu = true;
    if (recebendo.ia.cooperacao?.solicitante === voltando.ia.id) {
      cedeu = true; freada = Math.min(freada, recebendo.ia.cooperacao.limite);
    }
    if (voltando.off > .35 && voltando.ia.passando === null) retornou = true;
    assert.equal(recebendo.dano + voltando.dano + ultrapassado.dano, 0);
  });
  assert(pediu && cedeu && retornou, JSON.stringify({pediu, cedeu, retornou, ia: voltando.ia}));
  assert(freada >= -700, 'ceder espaço usa frenagem suave');
}

// Perdeu a vantagem: abandona a tentativa sem ficar eternamente ao lado.
{
  const lider = carro(65000, 3000), a = carro(61000, 3000, -.36);
  const b = bancada([lider, a]); a.ia.passando = lider.ia.id;
  let desistiu = false;
  rodar(b, 12, () => { if (a.ia.motivo.includes('sem progresso')) desistiu = true; });
  assert(desistiu, 'memória detecta a falta de progresso');
  assert.equal(a.off, .36, 'volta para a direita com segurança');
  assert.equal(a.ia.passando, null);
  assert.equal(a.dano + lider.dano, 0);
}

// A intenção do piloto automático participa da mesma cooperação dos NPCs.
{
  const medir = intencao => {
    const c = carro(57500, 3000), b = bancada([c]);
    b.motor.passo({z: 60000, off: -.36, velocidade: 3000, intencao});
    return c;
  };
  const auto = medir({pedidoFaixa: .36, alvo: -.36, manobra: null});
  const manual = medir(null);
  assert.equal(auto.ia.cooperacao.solicitante, 'jogador');
  assert(auto.velocidade < manual.velocidade, 'abre espaço quando recebe a intenção de retorno');
  assert.equal(manual.ia.cooperacao.solicitante, null, 'não inventa intenção para quem dirige manualmente');
}

// Pedido persistente não prende o motorista em frenagem de cortesia infinita.
{
  const c = carro(57500, 3000), b = bancada([c]);
  let cooperou = false, descansou = false;
  for (let n = 0; n < 360; n++) {
    b.motor.passo({z: c.z + 2500, off: -.36, velocidade: c.velocidade,
      intencao: {pedidoFaixa: .36, alvo: -.36, manobra: null}});
    if (c.ia.cooperacao.solicitante === 'jogador') cooperou = true;
    if (b.motor.tempo > 4.5 && c.ia.cooperacao.solicitante === null) descansou = true;
  }
  assert(cooperou && descansou, 'encerra a tentativa e respeita o intervalo antes de ceder novamente');
}

// Se o motorista ultrapassado muda para a esquerda, a tentativa é reavaliada.
{
  const lider = carro(68000, 2300, -.36), a = carro(61000, 3100, -.36);
  const b = bancada([lider, a]); a.ia.passando = lider.ia.id;
  rodar(b, 4);
  assert.equal(a.off, .36, 'não persegue o líder para a mesma faixa');
  assert.equal(a.dano + lider.dano, 0);
}
console.log('PASS: antecipação de filas, avaliação do fluxo, cooperação no retorno, manutenção de ritmo e desistência de ultrapassagens sem progresso');
