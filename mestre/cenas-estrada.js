/* Cenas de beira de estrada — uma para cada trecho do minigame de corrida.

   Quando o carro morre no meio da viagem (lataria em 90), a viagem não chega:
   ela para onde estava. O mapa do mestre abre um pedido de PANE e oferece
   estas cenas. Cada uma reproduz, na cena montada, o trecho em que a corrida
   estava: a rodovia ao sol tem campo aberto e defensa; a serra ao entardecer
   tem barranco, curva e pinheiro; a estrada de terra tem cerca de arame e
   poeira; a rodovia à noite tem poste de sódio e olho de gato; a chuva tem
   asfalto molhado e a cena já nasce chovendo; a neblina é madrugada de pouca
   luz; a beira da cidade tem muro pichado e o primeiro poste do bairro.

   O trecho de cada modelo é o mesmo id das VARIACOES do minigame
   (minigame-estrada.js), e é por ele que o pedido de pane escolhe qual
   oferecer primeiro — ver `sugestoesPara` em exploracao.js.

   Cada cena tem o que uma cena de improviso precisa: passagens com papel
   (a estrada para os dois lados, e um desvio que leva a algum lugar), pelo
   menos três coisas para mexer e eventos que o mestre liga ou desliga. */
(function (root) {
  'use strict';
  const M = root.Montador;
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const chance = (r, p) => r() < p;
  /* Mesma cena, outro lugar: o enfeite da beira nunca cai no mesmo metro. */
  const j = (r, x, n = 70) => Math.round(x + (r() - .5) * 2 * n);
  const ev = (nome, quando, efeito, extra = {}) => ({id: 'e' + nome.normalize('NFD').replace(/[^\w]+/g, '').toLowerCase().slice(0, 18), nome, quando, efeito, chance: quando === 'entrar' ? 20 : 30, min: 90, max: 240, ativo: true, ...extra});

  const DESTINOS = ['CENTRO', 'SAO BENTO', 'VILA NOVA', 'RIO CLARO', 'MONTE ALTO', 'PORTO VELHO', 'SANTA LUZIA', 'CAMPO GRANDE'];
  const SAIDAS = ['POSTO 3 KM', 'BORRACHARIA', 'SITIO SAO JOSE', 'DESVIO', 'BALANCA', 'PEDAGIO 8 KM'];

  /* Beira comum: a estrada continua para os dois lados. É por aqui que o
     personagem sai da pane a pé, se o mestre deixar. */
  function beiras(L, r, trecho) {
    L.add('saida_esq', 30, {}, {nome: 'Estrada (de onde vocês vieram)', papel: 'rua_esq'});
    L.add('saida_dir', L.largura - 30, {}, {nome: 'Estrada (para onde iam)', papel: 'rua_dir'});
    void r; void trecho;
  }
  /* A pista atrás do personagem (o chão da cena) e o outro lado dela (a parede
     do fundo apagada até o horizonte). Sempre as duas juntas: é o par que faz
     a cena ler como beira de estrada e não como terreno baldio. */
  function pista(L, {piso = 'asfalto', faixa = 'branca', longe = 700, horizonte = 40, chao = 'capim', outra = true} = {}) {
    L.add('horizonte_estrada', Math.round(L.largura / 2), {largura: L.largura + 240, altura: horizonte, chao, pista: outra});
    L.add('pista_chao', Math.round(L.largura / 2), {largura: L.largura + 200, piso, faixa, longe});
  }
  /* Três eventos que servem a qualquer beira de estrada, mais os do trecho. */
  const EVENTOS_COMUNS = t => [
    ev('Passa um caminhão', 'tempo', 'som', {som: 'carro_passa', texto: 'Um caminhão passa rente. O deslocamento de ar sacode o carro parado.', chance: 40}),
    ev('Alguém buzina longe', 'manual', 'som', {som: 'buzina', texto: ''}),
    ev('Silêncio de estrada', 'manual', 'legenda', {texto: t})
  ];

  /* ================================================================ modelos */
  /* Cada trecho descreve a mesma beira com outra cara. `montar` recebe o rng
     e o layout e devolve a casca; o resto (passagens, eventos, o que mexer)
     é comum. */
  const TRECHOS = [
    {
      id: 'estrada_rodovia', trecho: 'rodovia', nome: 'Beira de rodovia', luzPadrao: 'tarde',
      descricao: 'Acostamento de rodovia ao sol: campo aberto, defensa metálica, placa de destino e marco de quilômetro.',
      resumo: 'A rodovia continua reta nos dois sentidos. Nada por perto além do campo.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'terra', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'terra', rua: true, vista: 'campo', desgaste: chance(r, .4) ? 1 : 0}),
      montar(L, r) {
        pista(L, {piso: 'asfalto', faixa: 'branca', horizonte: 41, chao: 'capim'});
        L.add('defensa', 260, {largura: 320, cor: 'aco', amassada: chance(r, .35), refletor: true});
        L.add('defensa', 1180, {largura: 300, cor: 'aco', refletor: true});
        L.add('placa_rodovia', 700, {tipo: 'destino', texto: pick(r, DESTINOS), km: (4 + Math.floor(r() * 60)) + ' KM'},
          {nome: 'Placa de destino', papel: 'placa'});
        L.add('marco_km', j(r, 960), {km: String(60 + Math.floor(r() * 340))});
        L.add('mato_beira', j(r, 540), {largura: 150, altura: 12, cor: 'folha', flor: chance(r, .5)});
        L.add('mato_beira', j(r, 1420), {largura: 180, altura: 16, cor: 'folha'});
        L.add('arvore_estrada', j(r, 1560), {tipo: 'copa', cor: 'arvore'});
        L.add('defensa_frente', 210, {largura: 112, cor: 'aco', refletor: true});
        L.add('mato_frente', j(r, 1300, 120), {largura: 128, altura: 52, cor: 'folha'});
        return [ev('Gaivota de estrada', 'tempo', 'som', {som: 'passaro', texto: 'Um bando de urubus levanta de alguma coisa morta no acostamento.', chance: 30})];
      }
    },
    {
      id: 'estrada_serra', trecho: 'entardecer', nome: 'Curva da serra', luzPadrao: 'por_do_sol',
      descricao: 'Curva de serra no fim da tarde: barranco de corte, pinheiros, pedra caída e a defensa amassada de quem não fez a curva.',
      resumo: 'A serra desce em camadas. A curva fecha à direita e não se enxerga o que vem.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'concreto', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'calcada', rua: true, vista: 'serra', desgaste: chance(r, .5) ? 2 : 1}),
      montar(L, r) {
        pista(L, {piso: 'asfalto', faixa: 'amarela', horizonte: 44, chao: 'mata'});
        L.add('barranco', 420, {largura: 520, altura: 48, cor: pick(r, ['terra', 'ferrugem'])});
        L.add('defensa', 1020, {largura: 420, cor: 'aco', amassada: true, refletor: true});
        L.add('pedra_beira', j(r, 240), {tamanho: 40, cor: 'concreto', musgo: true});
        L.add('pedra_beira', j(r, 700), {tamanho: 26, cor: 'concreto', musgo: chance(r, .5)});
        L.add('arvore_estrada', j(r, 120), {tipo: 'pinheiro', cor: 'arvore'});
        L.add('arvore_estrada', j(r, 1440), {tipo: 'pinheiro', cor: 'arvore'});
        L.add('placa_rodovia', 1560, {tipo: 'aviso', texto: 'CURVA', km: 'REDUZA'}, {nome: 'Placa de curva perigosa', papel: 'placa'});
        L.add('marco_km', j(r, 860), {km: String(10 + Math.floor(r() * 90)), cor: 'branco'});
        L.add('defensa_frente', 1420, {largura: 112, cor: 'aco', refletor: true});
        L.add('mato_frente', j(r, 260, 120), {largura: 128, altura: 52, cor: 'arvore'});
        return [ev('Cai pedra do barranco', 'tempo', 'tremor', {texto: 'Pedrisco desce o corte e bate no capô. O barranco não parece firme.', chance: 25}),
          ev('O sol some atrás da serra', 'manual', 'legenda', {texto: 'O último dedo de sol sai da estrada. A serra vira uma parede preta.'})];
      }
    },
    {
      id: 'estrada_terra', trecho: 'terra', nome: 'Estrada de terra', luzPadrao: 'tarde',
      descricao: 'Estrada de chão batido: cerca de arame, porteira de sítio, caixa d’água ao longe e poeira em tudo.',
      resumo: 'A terra guarda o rastro dos pneus. A cerca acompanha a estrada até sumir.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'terra', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'terra', rua: true, vista: 'campo', desgaste: 2 + (chance(r, .4) ? 1 : 0)}),
      montar(L, r) {
        pista(L, {piso: 'terra', faixa: 'nenhuma', longe: 660, horizonte: 39, chao: 'terra', outra: false});
        L.add('cerca_arame', 300, {largura: 420, mourao: pick(r, ['madeira', 'galho']), fios: 4});
        L.add('cerca_arame', 1120, {largura: 380, mourao: 'madeira', fios: 3});
        L.add('porta', 840, {modelo: 'grade', cor: 'ferrugem', placa: ''},
          {nome: 'Porteira do sítio', papel: 'sitio', pas: {tipo: 'portao'}});
        L.add('placa_rodovia', 620, {tipo: 'servico', texto: pick(r, SAIDAS), km: ''}, {nome: 'Placa de madeira', papel: 'placa'});
        L.add('arvore_estrada', j(r, 1500), {tipo: 'copa', cor: 'folha'});
        L.add('arvore_estrada', j(r, 60), {tipo: 'seca', cor: 'papelao'});
        L.add('mato_beira', j(r, 1320), {largura: 160, altura: 18, cor: 'verde'});
        L.add('mato_beira', j(r, 200), {largura: 140, altura: 13, cor: 'papelao'});
        L.add('mato_frente', j(r, 1240, 140), {largura: 128, altura: 52, cor: 'papelao'});
        return [ev('Poeira de um carro', 'tempo', 'som', {som: 'carro_passa', texto: 'Uma nuvem de poeira sobe lá na frente. Some antes de chegar perto.', chance: 35}),
          ev('Gado na cerca', 'manual', 'legenda', {texto: 'Três cabeças de gado param do outro lado do arame e ficam olhando, sem piscar.'})];
      }
    },
    {
      id: 'estrada_noite', trecho: 'noite', nome: 'Rodovia à noite', luzPadrao: 'noite',
      descricao: 'Rodovia no escuro: um poste de sódio, olhos de gato na defensa e o mato que começa logo depois do acostamento.',
      resumo: 'Fora do cone do poste, a estrada é um corredor preto nos dois sentidos.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'terra', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'calcada', rua: true, vista: 'campo', desgaste: chance(r, .5) ? 1 : 0}),
      montar(L, r) {
        pista(L, {piso: 'asfalto', faixa: 'branca', horizonte: 42, chao: 'capim'});
        L.add('poste', 760, {modelo: 'sodio', defeito: chance(r, .45)});
        L.add('defensa', 340, {largura: 360, cor: 'aco', refletor: true, amassada: chance(r, .3)});
        L.add('defensa', 1200, {largura: 340, cor: 'aco', refletor: true});
        L.add('marco_km', j(r, 1020), {km: String(100 + Math.floor(r() * 200))});
        L.add('placa_rodovia', 200, {tipo: 'destino', texto: pick(r, DESTINOS), km: (8 + Math.floor(r() * 40)) + ' KM'},
          {nome: 'Placa de destino', papel: 'placa'});
        L.add('arvore_estrada', j(r, 1520), {tipo: 'copa', cor: 'arvore'});
        L.add('mato_beira', j(r, 560), {largura: 170, altura: 15, cor: 'arvore'});
        L.add('defensa_frente', 240, {largura: 112, cor: 'aco', refletor: true});
        L.add('mato_frente', j(r, 1320, 120), {largura: 128, altura: 52, cor: 'arvore'});
        return [ev('Faróis se aproximando', 'tempo', 'som', {som: 'carro_passa', texto: 'Dois faróis crescem na curva, passam sem diminuir e somem. Ninguém parou.', chance: 45}),
          ev('O poste apaga', 'manual', 'apagar', {texto: 'O poste estala e apaga. Leva um tempo até os olhos servirem para alguma coisa.'}),
          ev('Alguma coisa no mato', 'manual', 'legenda', {texto: 'O mato do acostamento mexe onde não bate vento.'})];
      }
    },
    {
      id: 'estrada_chuva', trecho: 'chuva', nome: 'Rodovia na chuva', luzPadrao: 'tarde',
      descricao: 'Pista molhada, poça no acostamento, defensa enferrujada e a chuva que não dá trégua.',
      resumo: 'A chuva apaga o fim da estrada. A água escorre do barranco para o asfalto.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'terra', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'calcada', rua: true, vista: 'campo', clima: 'chuva',
        desgaste: 1 + (chance(r, .5) ? 1 : 0)}),
      montar(L, r) {
        pista(L, {piso: 'molhado', faixa: 'branca', horizonte: 43, chao: 'capim'});
        L.add('defensa', 380, {largura: 400, cor: 'ferrugem', refletor: true, amassada: chance(r, .4)});
        L.add('defensa', 1240, {largura: 300, cor: 'ferrugem', refletor: true});
        L.add('placa_rodovia', 880, {tipo: 'aviso', texto: 'PISTA', km: 'ESCORREGA'}, {nome: 'Placa de pista escorregadia', papel: 'placa'});
        L.add('mato_beira', j(r, 620), {largura: 200, altura: 20, cor: 'folha'});
        L.add('arvore_estrada', j(r, 140), {tipo: 'copa', cor: 'arvore'});
        L.add('arvore_estrada', j(r, 1520), {tipo: 'copa', cor: 'arvore'});
        L.add('poca', j(r, 700), {largura: 140}); L.add('poca', j(r, 1080), {largura: 110});
        L.add('marco_km', j(r, 1400), {km: String(20 + Math.floor(r() * 180))});
        L.add('defensa_frente', 1380, {largura: 112, cor: 'ferrugem', refletor: true});
        L.add('mato_frente', j(r, 300, 120), {largura: 128, altura: 52, cor: 'folha'});
        return [ev('A chuva aperta', 'tempo', 'chuva', {texto: 'A chuva engrossa. Não dá para ver dez metros de estrada.', chance: 40}),
          ev('Relâmpago', 'tempo', 'relampago', {texto: '', chance: 30}),
          ev('Para de chover', 'manual', 'legenda', {texto: 'A chuva passa de repente, como passa chuva de estrada. Fica o barulho da água escorrendo.'})];
      }
    },
    {
      id: 'estrada_neblina', trecho: 'neblina', nome: 'Estrada na neblina', luzPadrao: 'apagao',
      descricao: 'Madrugada fechada de neblina: pinheiro que aparece em cima da hora, cerca molhada e refletor que mal se vê.',
      resumo: 'A neblina come a estrada a vinte metros. O que existe além disso é palavra do mestre.',
      casca: r => ({exterior: true, aberto: true, parede: 'concreto', corParede: 'concreto', barra: 'nenhuma', teto: false,
        piso: 'cascalho', corPiso: 'calcada', rua: true, vista: 'serra', desgaste: 1 + (chance(r, .4) ? 1 : 0)}),
      montar(L, r) {
        pista(L, {piso: 'molhado', faixa: 'branca', horizonte: 46, chao: 'mata'});
        L.add('cerca_arame', 420, {largura: 360, mourao: 'concreto', fios: 5});
        L.add('arvore_estrada', j(r, 180), {tipo: 'pinheiro', cor: 'arvore'});
        L.add('arvore_estrada', j(r, 1180), {tipo: 'pinheiro', cor: 'arvore'});
        L.add('arvore_estrada', j(r, 1480), {tipo: 'seca', cor: 'papelao'});
        L.add('marco_km', j(r, 880), {km: String(30 + Math.floor(r() * 150)), cor: 'branco'});
        L.add('placa_rodovia', 1020, {tipo: 'aviso', texto: 'NEBLINA', km: 'ACENDA O FAROL'}, {nome: 'Placa de neblina', papel: 'placa'});
        L.add('defensa', 1260, {largura: 260, cor: 'concreto', refletor: true});
        L.add('mato_beira', j(r, 660), {largura: 180, altura: 16, cor: 'arvore'});
        L.add('poste', 300, {modelo: 'antigo', defeito: chance(r, .6)});
        L.add('mato_frente', j(r, 1320, 140), {largura: 128, altura: 52, cor: 'arvore'});
        return [ev('Passos na neblina', 'tempo', 'som', {som: 'cascalho', texto: 'Passos no cascalho, do lado de fora do farol. Param quando vocês param.', chance: 35}),
          ev('A neblina abre', 'manual', 'legenda', {texto: 'A neblina abre por um instante e mostra a estrada vazia até a curva. Depois fecha de novo.'}),
          ev('Luz que não é farol', 'manual', 'piscar', {texto: 'Uma luz branca varre a neblina de cima para baixo e some.'})];
      }
    },
    {
      id: 'estrada_cidade', trecho: 'cidade', nome: 'Entrada da cidade', luzPadrao: 'tarde',
      descricao: 'A rodovia virando avenida: muro pichado, primeiro poste do bairro, ponto de ônibus e o outdoor na entrada.',
      resumo: 'Daqui já se vê a cidade. A pista ganha guia, calçada e o primeiro semáforo lá na frente.',
      casca: r => ({exterior: true, aberto: true, parede: 'liso', corParede: pick(r, ['concreto', 'reboco']), barra: 'nenhuma', teto: false,
        piso: 'calcada', corPiso: 'calcada', rua: true, vista: 'predios', desgaste: 1 + (chance(r, .5) ? 1 : 0)}),
      montar(L, r) {
        pista(L, {piso: 'asfalto', faixa: 'dupla', longe: 720, horizonte: 36, chao: 'pedrisco'});
        L.add('muro', 300, {largura: 200, cor: pick(r, ['concreto', 'reboco']), altura: 30});
        L.add('grafite', 320, {texto: pick(r, ['ZONA', 'VILA', 'KAOS']), cor: pick(r, ['rosa_vivo', 'turquesa', 'laranja'])}, {v: 22, sobrepor: true});
        L.add('poste', 900, {modelo: 'sodio', defeito: chance(r, .3)});
        L.add('ponto_onibus', 1180, {linha: String(100 + Math.floor(r() * 800))});
        L.add('placa_rodovia', 180, {tipo: 'destino', texto: pick(r, DESTINOS), km: 'ENTRADA'}, {nome: 'Placa da entrada da cidade', papel: 'placa'});
        L.add('defensa', 1380, {largura: 220, cor: 'aco', refletor: true, amassada: chance(r, .5)});
        L.add('lixeira_publica', j(r, 1080), {cor: 'laranja'});
        L.add('mato_beira', j(r, 700), {largura: 120, altura: 10, cor: 'verde'});
        L.add('bueiro', j(r, 1260), {});
        L.add('mato_frente', j(r, 1480, 90), {largura: 110, altura: 44, cor: 'verde'});
        return [ev('Ônibus passa direto', 'tempo', 'som', {som: 'carro_passa', texto: 'O ônibus da linha passa sem encostar no ponto. O motorista nem olha.', chance: 35}),
          ev('Cachorro no muro', 'manual', 'legenda', {texto: 'Um cachorro magro aparece no alto do muro, decide que vocês não valem a pena e some.'})];
      }
    }
  ];

  for (const T of TRECHOS) {
    M.modelo({
      id: T.id, nome: T.nome, grupo: 'Estrada', tags: ['exterior', 'estrada', 'rodovia', T.trecho],
      luz: 'exterior', luzPadrao: T.luzPadrao, trecho: T.trecho, descricao: T.descricao,
      gerar({rng: r, L, opcoes}) {
        L.largura = opcoes.largura || 2000;
        const casca = T.casca(r);
        if (opcoes.desgaste !== undefined) casca.desgaste = opcoes.desgaste;
        beiras(L, r, T.trecho);
        const extras = T.montar(L, r) || [];
        return {largura: L.largura, casca, objetos: L.objetos, eventos: [...extras, ...EVENTOS_COMUNS(T.resumo)]};
      }
    });
  }

  /* A lista que o pedido de pane usa: trecho do minigame → modelo de cena. */
  M.cenasDeEstrada = TRECHOS.map(T => ({id: T.id, trecho: T.trecho, nome: T.nome}));
  M.cenaDoTrecho = trecho => (TRECHOS.find(T => T.trecho === trecho) || TRECHOS[0]).id;
})(typeof window !== 'undefined' ? window : globalThis);
