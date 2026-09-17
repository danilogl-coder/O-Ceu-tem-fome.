/* Cenas genéricas — os modelos da biblioteca de improviso e os conjuntos já
   ligados entre si.

   Cada modelo é um gerador: com a mesma semente sai a mesma sala; com outra,
   a mesma sala com outras cores, móveis trocados de lugar, outra bagunça e
   outros detalhes. Tudo sai como receita editável (ver montador.js), com
   pelo menos três coisas para os jogadores mexerem (os “três aspectos” de um
   lugar memorável) e alguns eventos aleatórios que o mestre liga ou desliga.

   As passagens recebem um `papel` (entrada, quarto, banheiro, elevador…):
   é por ele que os conjuntos ligam as cenas e que o improviso escolhe por
   onde a personagem chega. */
(function (root) {
  'use strict';
  const M = root.Montador;
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const chance = (r, p) => r() < p;
  const jit = (r, n) => Math.round((r() - .5) * 2 * n);
  const ev = (nome, quando, efeito, extra = {}) => ({id: 'e' + nome.normalize('NFD').replace(/[^\w]+/g, '').toLowerCase().slice(0, 18), nome, quando, efeito, chance: quando === 'entrar' ? 20 : 30, min: 90, max: 240, ativo: true, ...extra});

  /* Portas e passagens com nome e papel. */
  const porta = (L, x, nome, papel, p = {}, pas = {}) => L.add('porta', x, {modelo: 'madeira', ...p}, {nome, papel, pas});
  const luzes = (L, xs, modelo, p = {}) => xs.forEach(x => L.add('luminaria', x, {modelo, ...p}, {sobrepor: true}));

  /* ------------------------------------------------------------ nomes para o improviso */
  const NOMES = {
    rua: ['Rua das Acácias', 'Rua Treze de Maio', 'Travessa do Relógio', 'Rua Padre Anchieta', 'Avenida São João', 'Rua dos Ferroviários', 'Rua Voluntários da Pátria', 'Rua da Aurora'],
    predio: ['Edifício Aurora', 'Residencial Ipê', 'Edifício Solar das Palmeiras', 'Condomínio Monte Verde', 'Edifício São Jorge', 'Residencial Primavera'],
    loja: ['Mercadinho Bom Preço', 'Mercearia Santa Rita', 'Conveniência 24 Horas', 'Empório do Bairro', 'Mercadinho Estrela'],
    restaurante: ['Lanchonete do Zé', 'Pastelaria Ki-Delícia', 'Bar e Lanches Avenida', 'Lanchonete Central', 'Cantina da Dona Célia'],
    bar: ['Bar do Tião', 'Boteco Saideira', 'Bar Esquina', 'Recanto do Sinuca', 'Bar Lua Cheia'],
    oficina: ['Auto Center Pereira', 'Oficina do Nenê', 'Funilaria Irmãos Costa', 'Mecânica Boa Viagem'],
    hospital: ['Hospital São Lucas', 'Pronto-Socorro Municipal', 'Santa Casa', 'Hospital Santa Luzia'],
    comercial: ['Edifício Central', 'Centro Empresarial Paulista', 'Edifício Itália', 'Torre Norte', 'Edifício Bandeirantes', 'Condomínio Comercial Aliança'],
    empresa: ['Contábil Almeida & Filhos', 'Seguradora Horizonte', 'Imobiliária Porto Seguro', 'Cartório do 2º Ofício']
  };
  const nome = (r, tipo) => pick(r, NOMES[tipo] || ['Lugar']);

  /* ------------------------------------------------------------ corredor */
  M.modelo({
    id: 'corredor', nome: 'Corredor de prédio', grupo: 'Conectores', tags: ['interior', 'prédio', 'corredor'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Portas numeradas, escada numa ponta e elevador na outra.',
    opcoes: [{id: 'estilo', label: 'Estilo', opcoes: [['residencial', 'Residencial'], ['escritorio', 'Comercial'], ['hospital', 'Hospital'], ['hotel', 'Hotel']]}, {id: 'andar', label: 'Andar', tipo: 'numero'}],
    gerar({rng: r, L, opcoes}) {
      const estilo = opcoes.estilo || pick(r, ['residencial', 'residencial', 'hotel', 'escritorio']);
      const portas = opcoes.portas || 4;
      L.largura = opcoes.largura || 1500;
      const andar = opcoes.andar ?? 1 + Math.floor(r() * 5);
      let casca;
      if (estilo === 'hospital') casca = {parede: 'liso', corParede: pick(r, ['verde', 'azul', 'branco']), barra: 'meia', corBarra: 'branco', piso: 'linoleo', corPiso: pick(r, ['linoleo', 'azul'])};
      else if (estilo === 'escritorio') casca = {parede: pick(r, ['liso', 'painel']), corParede: pick(r, ['branco', 'cinza', 'reboco']), barra: 'rodape', piso: pick(r, ['carpete', 'linoleo']), corPiso: pick(r, ['tecido_cinza', 'tecido_azul', 'linoleo'])};
      else if (estilo === 'hotel') casca = {parede: pick(r, ['papel', 'arabesco']), corParede: pick(r, ['vinho', 'petroleo', 'amarelo']), barra: 'lambri', corBarra: pick(r, ['madeira', 'madeira_escura']), sanca: true, piso: 'carpete', corPiso: pick(r, ['tecido_vinho', 'tecido_verde', 'tecido_mostarda'])};
      else { const lambri = chance(r, .4); casca = {parede: chance(r, .25) ? 'papel' : 'liso', corParede: pick(r, ['reboco', 'verde', 'azul', 'amarelo', 'rosa']), barra: lambri ? 'lambri' : 'meia', corBarra: lambri ? pick(r, ['madeira', 'madeira_escura']) : pick(r, ['petroleo', 'vinho', 'cinza']), piso: pick(r, ['ceramica', 'xadrez', 'linoleo', 'tabuas']), corPiso: pick(r, ['ceramica', 'branco', 'linoleo', 'taco'])}; }
      casca.desgaste = opcoes.desgaste ?? (chance(r, .3) ? 1 : 0);
      const sentido = opcoes.escada || 'sobe';
      L.add('escada', 70, {sentido, placa: sentido === 'desce' ? 'TERREO' : ''}, {nome: sentido === 'desce' ? 'Escada (desce)' : 'Escada (sobe)', papel: sentido === 'desce' ? 'escada_desce' : 'escada_sobe'});
      L.add('placa_saida', 70, {}, {v: 0, sobrepor: true});
      L.add('interruptor', 150, {});
      const passo = (L.largura - 380) / portas;
      for (let i = 0; i < portas; i++) {
        const x = 230 + passo * (i + .5), numero = `${andar}0${i + 1}`;
        if (estilo === 'hospital') porta(L, x, i === portas - 1 ? 'Banheiro' : `Quarto ${numero}`, i === portas - 1 ? 'banheiro' : `porta${i + 1}`, {modelo: i === portas - 1 ? 'banheiro' : 'vaivem', cor: 'verde', placa: i === portas - 1 ? 'WC' : numero});
        else if (estilo === 'escritorio') porta(L, x, i === portas - 1 ? 'Banheiro' : `Sala ${numero}`, i === portas - 1 ? 'banheiro' : `porta${i + 1}`, {modelo: i === portas - 1 ? 'banheiro' : 'vidro', placa: i === portas - 1 ? 'WC' : numero, alem: chance(r, .4) ? 'frio' : 'escuro'});
        else porta(L, x, `Apartamento ${numero}`, `porta${i + 1}`, {modelo: 'apartamento', cor: pick(r, ['madeira', 'madeira_escura', 'madeira_clara']), placa: numero, alem: chance(r, .25) ? 'quente' : 'escuro'});
        if (estilo === 'residencial' && chance(r, .55)) L.add('tapete', x + jit(r, 6), {padrao: pick(r, ['liso', 'listrado']), largura: 64 + jit(r, 6), posicao: 'porta', cor: pick(r, ['tecido_vinho', 'tecido_verde', 'tecido_mostarda', 'tecido_cinza'])});
        if (i < portas - 1) L.add(estilo === 'hotel' ? 'quadro' : 'cartaz', x + passo / 2, estilo === 'hotel' ? {motivo: pick(r, ['paisagem', 'mar', 'flores']), moldura: 'latao'} : {estilo: 'aviso', titulo: estilo === 'hospital' ? 'SILENCIO' : 'AVISO', tamanho: 'P'}, {v: 14});
      }
      luzes(L, Array.from({length: portas + 1}, (_, i) => 150 + (L.largura - 300) * i / portas), estilo === 'hotel' ? 'arandela' : estilo === 'residencial' ? 'plafon' : 'fluorescente', {defeito: false});
      L.objetos.filter(o => o.mod === 'luminaria')[Math.floor(r() * portas)].p.defeito = chance(r, .5);
      L.add('elevador', L.largura - 120, {andar: String(andar)}, {nome: 'Elevador', papel: 'elevador'});
      L.tentar('extintor', r, {}, {perto: L.largura * .5});
      L.tentar('quadro_energia', r, {}, {perto: L.largura - 240});
      L.add('luz_emergencia', 180, {}, {v: 4, sobrepor: true});
      L.add('camera', L.largura - 200, {}, {v: 1, sobrepor: true});
      if (estilo !== 'residencial') L.add('tapete', L.largura / 2, {padrao: estilo === 'hotel' ? 'persa' : 'liso', largura: L.largura - 420, cor: casca.corPiso?.startsWith('tecido') ? 'tecido_vinho' : pick(r, ['tecido_cinza', 'tecido_azul'])});
      if (chance(r, .6)) L.tentar('vaso_planta', r, {tipo: pick(r, ['espada', 'costela', 'jiboia'])}, {perto: L.largura - 230});
      if (estilo === 'hospital') L.tentar('cadeiras_espera', r, {lugares: '3', cor: 'azul_vivo'}, {perto: L.largura * .5});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Lâmpada pisca', 'tempo', 'piscar', {chance: 35, duracao: 2.5, texto: ''}),
        ev('Porta bate lá no fundo', 'tempo', 'som', {som: 'porta_fechar', texto: 'Uma porta bate em algum lugar do corredor.', chance: 25}),
        ev('Elevador chega vazio', 'manual', 'som', {som: 'elevador', texto: 'O elevador chega. Ninguém sai.'})]};
    }
  });

  /* ------------------------------------------------------------ apartamento */
  M.modelo({
    id: 'apartamento', nome: 'Apartamento', grupo: 'Casa', tags: ['interior', 'casa', 'apartamento'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Sala com TV e sofá, cozinha americana, portas para o quarto e o banheiro.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1420;
      const casca = {parede: chance(r, .2) ? 'papel' : 'liso', corParede: pick(r, ['reboco', 'branco', 'amarelo', 'azul', 'verde', 'rosa']), barra: 'rodape',
        piso: pick(r, ['tabuas', 'taco', 'ceramica']), corPiso: pick(r, ['taco', 'madeira_clara', 'ceramica']), desgaste: opcoes.desgaste ?? (chance(r, .35) ? 1 : 0), vista: pick(r, ['cidade', 'predios', 'arvores'])};
      const madeira = pick(r, ['madeira', 'madeira_clara', 'madeira_escura', 'mdf']);
      porta(L, 70, 'Porta de entrada', 'entrada', {modelo: 'apartamento', cor: pick(r, ['madeira', 'madeira_escura']), placa: opcoes.placa || ''});
      L.add('interruptor', 132, {});
      L.add('cabideiro', 170, {casaco: chance(r, .7)});
      const sala = 380 + jit(r, 20);
      L.add('janela', sala, {modelo: 'residencial', cortina: pick(r, ['aberta', 'aberta', 'fechada']), corCortina: pick(r, ['tecido_mostarda', 'tecido_vinho', 'tecido_verde', 'tecido_azul'])}, {sobrepor: true});
      L.add('sofa', sala, {cor: pick(r, ['tecido_vinho', 'tecido_azul', 'tecido_verde', 'tecido_mostarda', 'tecido_cinza', 'couro']), lugares: '3'});
      L.add('luminaria', sala, {modelo: 'pendente'}, {sobrepor: true});
      L.add('poltrona', sala + 150, {cor: pick(r, ['tecido_mostarda', 'couro', 'tecido_verde'])});
      L.add('rack_tv', sala + 275, {cor: madeira, tv: pick(r, ['tubo', 'plana', 'plana'])});
      L.add('quadro', sala + 275, {motivo: pick(r, ['paisagem', 'mar', 'flores', 'abstrato'])}, {v: 12, sobrepor: true});
      L.add(chance(r, .5) ? 'estante' : 'vaso_planta', sala + 390, {cor: madeira, conteudo: pick(r, ['livros', 'enfeites', 'bagunca']), tipo: pick(r, ['costela', 'espada', 'jiboia'])});
      porta(L, 900, 'Porta do quarto', 'quarto', {modelo: 'madeira', cor: madeira === 'mdf' ? 'mdf' : 'madeira_clara'});
      const coz = 1010;
      L.add('geladeira', coz, {cor: pick(r, ['branco', 'branco', 'aluminio', 'vermelho'])});
      L.add('pia_cozinha', coz + 105, {cor: madeira, tampo: pick(r, ['granito', 'inox']), louca: chance(r, .5)});
      L.add('armario_aereo', coz + 105, {cor: madeira}, {sobrepor: true});
      L.add('fogao', coz + 200, {cor: pick(r, ['branco', 'aco'])});
      L.add('luminaria', coz + 110, {modelo: pick(r, ['plafon', 'fluorescente'])}, {sobrepor: true});
      porta(L, 1340, 'Porta do banheiro', 'banheiro', {modelo: 'banheiro'});
      L.add('mesa_centro', sala + 20, {cor: madeira, coisas: true});
      L.add('tapete', sala + 10, {cor: pick(r, ['tecido_vinho', 'tecido_azul', 'tecido_mostarda']), padrao: pick(r, ['persa', 'listrado', 'liso']), largura: 240});
      if (chance(r, .4)) L.add('planta_grande', 30, {tipo: pick(r, ['costela', 'palmeira', 'ficus'])});
      if (casca.desgaste) L.add('roupas_chao', sala + 180, {cor: 'tecido_azul'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('TV liga sozinha', 'tempo', 'tv', {chance: 20, min: 120, max: 300, texto: 'A TV da sala liga sozinha.'}),
        ev('Telefone toca', 'entrar', 'telefone', {chance: 15, texto: ''}),
        ev('Passos no andar de cima', 'tempo', 'som', {som: 'passos_cima', texto: 'Passos no apartamento de cima. Alguém arrasta alguma coisa pesada.', chance: 30})]};
    }
  });

  /* ------------------------------------------------------------ quarto */
  M.modelo({
    id: 'quarto', nome: 'Quarto', grupo: 'Casa', tags: ['interior', 'casa', 'quarto'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Cama, criados-mudos, guarda-roupa e cômoda com espelho.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1040;
      const casca = {parede: pick(r, ['liso', 'papel', 'arabesco']), corParede: pick(r, ['rosa', 'azul', 'amarelo', 'verde', 'branco', 'vinho']), barra: 'rodape',
        piso: pick(r, ['tabuas', 'taco', 'carpete']), corPiso: pick(r, ['taco', 'madeira_clara', 'tecido_cinza']), desgaste: opcoes.desgaste ?? (chance(r, .3) ? 1 : 0), vista: pick(r, ['cidade', 'arvores', 'predios'])};
      const madeira = pick(r, ['madeira', 'madeira_clara', 'madeira_escura', 'mdf']);
      porta(L, 70, 'Porta do quarto', 'entrada', {modelo: 'madeira', cor: madeira === 'mdf' ? 'mdf' : 'madeira'});
      L.add('interruptor', 132, {});
      const cama = 390 + jit(r, 25), casal = chance(r, .6);
      L.add('criado_mudo', cama - (casal ? 120 : 100), {cor: madeira, abajur: true});
      L.add('cama', cama, {cor: madeira, tamanho: casal ? 'casal' : 'solteiro', bagunca: chance(r, .5), lencol: pick(r, ['lencol', 'tecido_azul', 'tecido_rosa', 'tecido_verde'])});
      if (casal) L.add('criado_mudo', cama + 120, {cor: madeira, abajur: chance(r, .6)});
      L.add(chance(r, .5) ? 'janela' : 'quadro', cama, chance(r, .5) ? {modelo: 'residencial', cortina: pick(r, ['aberta', 'fechada']), corCortina: pick(r, ['tecido_rosa', 'tecido_azul', 'tecido_mostarda'])} : {motivo: pick(r, ['paisagem', 'flores', 'retrato', 'mar'])}, {v: 8, sobrepor: true});
      L.add('luminaria', cama, {modelo: pick(r, ['plafon', 'pendente'])}, {sobrepor: true});
      L.add('guarda_roupa', 700, {cor: madeira, portas: pick(r, ['2', '3']), aberto: chance(r, .25)});
      L.add('comoda', 850, {cor: madeira});
      L.add('espelho', 850, {moldura: pick(r, ['madeira', 'latao'])}, {v: 18, sobrepor: true});
      L.add(chance(r, .5) ? 'ventilador' : 'abajur_pe', 960, {ligado: chance(r, .3)});
      L.add('prateleira', 560, {conteudo: pick(r, ['livros', 'plantas', 'fotos'])}, {v: 16, sobrepor: true});
      L.add('tapete', cama, {cor: pick(r, ['tecido_rosa', 'tecido_azul', 'tecido_mostarda']), padrao: pick(r, ['redondo', 'liso', 'persa']), largura: 200});
      if (chance(r, .5)) L.add('roupas_chao', 620, {cor: pick(r, ['tecido_azul', 'tecido_vinho'])});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Arranhões no guarda-roupa', 'tempo', 'legenda', {chance: 20, min: 150, max: 360, texto: 'Alguma coisa arranha por dentro do guarda-roupa. Depois, silêncio.'}),
        ev('Abajur pisca', 'tempo', 'piscar', {chance: 25, duracao: 1.8})]};
    }
  });

  /* ------------------------------------------------------------ banheiro */
  M.modelo({
    id: 'banheiro', nome: 'Banheiro', grupo: 'Casa', tags: ['interior', 'banheiro'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Azulejo, pia com espelho, vaso e chuveiro ou banheira; ou banheiro público com cabines.',
    opcoes: [{id: 'estilo', label: 'Estilo', opcoes: [['casa', 'De casa'], ['publico', 'Público']]}],
    gerar({rng: r, L, opcoes}) {
      const publico = (opcoes.estilo || (chance(r, .35) ? 'publico' : 'casa')) === 'publico';
      L.largura = opcoes.largura || (publico ? 1160 : 820);
      const casca = {parede: pick(r, ['azulejo', 'azulejo', 'pastilha']), corParede: pick(r, ['branco', 'azul', 'verde', 'rosa']), barra: 'nenhuma',
        piso: pick(r, ['ceramica', 'xadrez']), corPiso: pick(r, ['branco', 'ceramica']), desgaste: opcoes.desgaste ?? (publico ? 1 + Math.floor(r() * 2) : chance(r, .3) ? 1 : 0), vista: 'predios'};
      porta(L, 70, publico ? 'Porta do banheiro' : 'Porta do banheiro', 'entrada', {modelo: 'banheiro', placa: publico ? 'WC' : ''});
      L.add('interruptor', 132, {});
      if (publico) {
        L.add('pia_banheiro', 230, {espelho: true}); L.add('pia_banheiro', 310, {espelho: true});
        L.add('secador_maos', 390, {}, {sobrepor: true}); L.add('papeleira', 180, {}, {v: 22, sobrepor: true});
        L.add('lixeira', 390, {tipo: 'banheiro'});
        for (let i = 0; i < 3; i++) L.add('cabine_banheiro', 560 + i * 110, {cor: pick(r, ['ferro_bege', 'ferro_azul', 'aco']), ocupada: i === 2 && chance(r, .4)});
        L.add('mictorio', 920); L.add('mictorio', 980);
        luzes(L, [250, 600, 900], 'fluorescente', {defeito: chance(r, .4)});
        L.add('janela', 1060, {modelo: 'basculante'}, {sobrepor: true});
        L.add('placa_piso_molhado', 480, {});
        L.add('ralo', 650, {});
      } else {
        L.add('pia_banheiro', 250, {espelho: true, armario: chance(r, .5)});
        L.add('toalheiro', 340, {cor: pick(r, ['tecido_azul', 'tecido_rosa', 'tecido_verde'])}, {v: 24, sobrepor: true});
        L.add('vaso_sanitario', 420, {tampa_aberta: chance(r, .3)});
        L.add('lixeira', 480, {tipo: 'banheiro'});
        L.add(chance(r, .6) ? 'chuveiro' : 'banheira', 640, {box: pick(r, ['vidro', 'cortina']), cortina: true});
        L.add('janela', 640, {modelo: 'basculante'}, {v: 6, sobrepor: true});
        L.add('luminaria', 350, {modelo: 'plafon'}, {sobrepor: true});
        L.add('ralo', 640, {});
      }
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Chuveiro liga sozinho', 'tempo', 'estado', {chance: 20, texto: 'O chuveiro liga sozinho.', alvo: ''}),
        ev('Recado no espelho', 'manual', 'legenda', {texto: 'No espelho embaçado, alguém escreveu com o dedo: SAIA.'}),
        ev('Goteira', 'entrar', 'som', {som: 'goteira', chance: 60, texto: ''})]};
    }
  });

  /* ------------------------------------------------------------ escritório */
  M.modelo({
    id: 'escritorio', nome: 'Escritório', grupo: 'Trabalho', tags: ['interior', 'trabalho', 'escritório'], luz: 'interior', luzPadrao: 'tarde',
    descricao: 'Mesas com computador, arquivos, quadro branco, copiadora e bebedouro.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1480;
      const casca = {parede: pick(r, ['liso', 'painel']), corParede: pick(r, ['branco', 'cinza', 'azul', 'reboco']), barra: pick(r, ['rodape', 'faixa']), corBarra: pick(r, ['azul_vivo', 'vermelho', 'petroleo']),
        piso: pick(r, ['carpete', 'linoleo', 'ceramica']), corPiso: pick(r, ['tecido_cinza', 'tecido_azul', 'linoleo', 'ceramica']), desgaste: opcoes.desgaste ?? (chance(r, .3) ? 1 : 0), vista: pick(r, ['predios', 'cidade'])};
      const madeira = pick(r, ['mdf', 'madeira_clara', 'madeira']);
      porta(L, 70, 'Porta de entrada', 'entrada', {modelo: 'vidro', placa: opcoes.placa || nome(r, 'empresa').split(' ')[0].toUpperCase(), alem: 'frio'});
      L.add('interruptor', 132, {});
      L.add('bebedouro', 185, {tipo: pick(r, ['galao', 'coluna'])});
      const mesas = 3;
      for (let i = 0; i < mesas; i++) {
        const x = 330 + i * 190;
        L.add('escrivaninha', x, {cor: madeira, computador: pick(r, ['monitor', 'monitor', 'crt', 'notebook']), bagunca: pick(r, ['0', '1', '2']), cadeira: true, tela: chance(r, .7)});
        L.add('janela', x, {modelo: 'persiana', moldura: 'aluminio', cortina: 'nenhuma'}, {v: 8, sobrepor: true});
        if (i < mesas - 1) L.add('divisoria', x + 95, {cor: pick(r, ['tecido_azul', 'tecido_cinza']), largura: 32}, {sobrepor: true});
      }
      L.add('quadro_branco', 830, {texto: pick(r, ['META: 120%', 'REUNIAO 9H', 'NAO ESQUECER', 'PRAZO: SEXTA'])}, {v: 12});
      L.add('copiadora', 945, {ligada: true});
      L.add('arquivo_aco', 1015, {gavetas: '4', aberto: chance(r, .3)});
      L.add('arquivo_aco', 1060, {gavetas: '4'});
      L.add('estante_pastas', 1140, {cor: pick(r, ['aco', 'ferro_bege'])});
      L.add('relogio', 1015, {}, {v: 6, sobrepor: true});
      porta(L, 1260, 'Sala da diretoria', 'diretoria', {modelo: 'madeira', placa: 'DIRETOR', cor: 'madeira_escura'});
      L.add('cofre', 1380, {});
      luzes(L, [230, 520, 820, 1120], 'fluorescente', {defeito: false});
      L.tentar('extintor', r, {}, {perto: 200});
      L.add('mesa_escritorio_frente', 610, {cor: madeira, coisas: true});
      if (chance(r, .5)) L.add('caixas_frente', 1300, {tipo: 'papelao'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Telefone toca', 'tempo', 'telefone', {chance: 25, min: 120, max: 300}),
        ev('Copiadora dispara', 'tempo', 'som', {som: 'maquina', texto: 'A copiadora liga sozinha e cospe uma folha em branco.', chance: 20}),
        ev('Queda de energia', 'manual', 'apagar', {texto: 'As luzes se apagam. Só os monitores ficam acesos por um segundo.'})]};
    }
  });

  /* ------------------------------------------------------------ sala administrativa */
  M.modelo({
    id: 'sala_administrativa', nome: 'Sala administrativa', grupo: 'Trabalho', tags: ['interior', 'trabalho', 'administrativa'], luz: 'interior', luzPadrao: 'tarde',
    descricao: 'Balcão de atendimento, arquivos de aço, mesa do chefe e cofre.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1180;
      const casca = {parede: pick(r, ['liso', 'lambri', 'painel']), corParede: pick(r, ['reboco', 'verde', 'branco', 'amarelo']), barra: pick(r, ['lambri', 'meia', 'rodape']), corBarra: pick(r, ['madeira', 'petroleo', 'madeira_escura']),
        piso: pick(r, ['taco', 'ceramica', 'linoleo']), corPiso: pick(r, ['taco', 'ceramica', 'linoleo']), desgaste: opcoes.desgaste ?? (chance(r, .4) ? 1 : 0), vista: 'cidade'};
      porta(L, 70, 'Porta da administração', 'entrada', {modelo: 'madeira', placa: 'ADM'});
      L.add('relogio_ponto', 178, {}, {v: 24, sobrepor: true});
      L.add('balcao_recepcao', 300, {cor: pick(r, ['madeira', 'madeira_escura']), placa: 'ATENDIMENTO', telefone: true});
      L.add('quadro_cortica', 300, {}, {v: 8, sobrepor: true});
      L.add('arquivo_aco', 460, {gavetas: '4'}); L.add('arquivo_aco', 505, {gavetas: '4', aberto: chance(r, .4)}); L.add('arquivo_aco', 550, {gavetas: '3'});
      L.add('estante_pastas', 650, {cor: 'ferro_bege'});
      L.add('janela', 870, {modelo: pick(r, ['persiana', 'residencial']), moldura: 'aluminio', cortina: 'nenhuma'}, {v: 8, sobrepor: true});
      L.add('mesa_chefe', 870, {cor: 'madeira_escura', placa: pick(r, ['DIRETOR', 'CHEFIA', 'GERENTE'])});
      L.add('quadro', 1010, {motivo: 'retrato', formato: 'retrato', moldura: 'latao'}, {v: 10, sobrepor: true});
      L.add('cofre', 1010, {});
      L.add('vaso_planta', 1100, {tipo: pick(r, ['costela', 'espada'])});
      luzes(L, [300, 650, 950], pick(r, ['fluorescente', 'plafon']), {});
      L.add('interruptor', 128, {});
      L.add('tapete', 870, {cor: 'tecido_vinho', padrao: 'persa', largura: 200});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Relógio de ponto bate', 'tempo', 'som', {som: 'maquina', texto: 'O relógio de ponto marca um cartão. Não há ninguém perto dele.', chance: 20, min: 150, max: 360}),
        ev('Telefone do balcão', 'entrar', 'telefone', {chance: 20})]};
    }
  });

  /* ------------------------------------------------------------ depósito */
  M.modelo({
    id: 'deposito', nome: 'Depósito', grupo: 'Trabalho', tags: ['interior', 'depósito', 'subsolo'], luz: 'subsolo', luzPadrao: 'meia_luz',
    descricao: 'Estantes industriais, caixas, paletes, tambores e o quadro de energia.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1300;
      const casca = {parede: pick(r, ['blocos', 'concreto', 'tijolo']), corParede: pick(r, ['concreto', 'cinza', 'tijolo']), barra: 'faixa', corBarra: pick(r, ['amarelo_vivo', 'verde', 'azul']),
        piso: 'concreto', corPiso: pick(r, ['concreto', 'epoxi']), desgaste: opcoes.desgaste ?? 1 + Math.floor(r() * 2), exterior: false};
      porta(L, 80, 'Porta do depósito', 'entrada', {modelo: 'metal', cor: pick(r, ['ferro_verde', 'ferro_azul', 'cinza']), placa: 'DEPOSITO'});
      L.add('quadro_energia', 170, {cor: 'cinza'});
      L.add('interruptor', 135, {});
      const xs = [300, 440, 580];
      xs.forEach(x => L.add('prateleira_industrial', x + jit(r, 8), {conteudo: pick(r, ['caixas', 'pecas', 'latas', 'caixas'])}));
      L.add('caixas', 700, {pilha: pick(r, ['2', '3']), tipo: pick(r, ['papelao', 'madeira'])});
      L.add('caixas', 755, {pilha: pick(r, ['1', '2']), tipo: 'papelao'});
      L.add('palete', 860, {carga: pick(r, ['sacos', 'caixas'])});
      L.add('tambor', 980, {quantidade: pick(r, ['2', '3']), cor: pick(r, ['ferro_azul', 'vermelho', 'ferrugem'])});
      L.add('empilhadeira', 1090, {});
      if (chance(r, .6)) L.add('escada', 1220, {sentido: 'desce', placa: 'SUBSOLO'}, {nome: 'Escada para o subsolo', papel: 'escada_desce'});
      else L.add('armario_metal', 1210, {portas: '4', cor: 'ferro_verde'});
      luzes(L, [250, 550, 850, 1150], 'industrial', {defeito: false});
      L.objetos.filter(o => o.mod === 'luminaria')[1 + Math.floor(r() * 2)].p.defeito = true;
      L.add('faixa_seguranca', 700, {largura: 260});
      L.add('caixas_frente', 420, {tipo: pick(r, ['papelao', 'madeira'])});
      L.add('mancha', 980, {tipo: 'oleo', largura: 70});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Queda de energia', 'tempo', 'apagar', {chance: 20, min: 180, max: 420, texto: 'Um estalo no quadro de força. Tudo apaga.'}),
        ev('Caixas caem no fundo', 'tempo', 'som', {som: 'objeto', texto: 'Algo cai lá no fundo, atrás das caixas.', chance: 30}),
        ev('Luzes piscam', 'entrar', 'piscar', {chance: 40, duracao: 2})]};
    }
  });

  /* ------------------------------------------------------------ beco */
  M.modelo({
    id: 'beco', nome: 'Beco', grupo: 'Rua', tags: ['exterior', 'rua', 'beco'], luz: 'exterior', luzPadrao: 'noite',
    descricao: 'Fundos de prédios, caçamba, escada de incêndio, portas de serviço e pichações.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1400;
      const casca = {exterior: true, parede: 'tijolo', corParede: 'tijolo', barra: 'nenhuma', teto: false, piso: pick(r, ['asfalto', 'concreto']), corPiso: 'concreto',
        desgaste: opcoes.desgaste ?? 2, vista: 'predios', semEnergia: false};
      L.add('saida_esq', 35, {}, {nome: 'Saída do beco (esquerda)', papel: 'rua_esq'});
      L.add('saida_dir', L.largura - 35, {}, {nome: 'Saída do beco (direita)', papel: 'rua_dir'});
      L.add('fachada', 330, {estilo: 'galpao', cor: pick(r, ['concreto', 'cinza']), largura: 200, toldo: 'nenhum', letreiro: ''});
      L.add('fachada', 1000, {estilo: 'predio', cor: pick(r, ['reboco', 'amarelo', 'tijolo']), largura: 190, toldo: 'nenhum', letreiro: ''});
      porta(L, 220, 'Porta de serviço', 'servico1', {modelo: 'metal', cor: pick(r, ['ferro_verde', 'ferro_azul', 'vermelho']), placa: pick(r, ['COZINHA', 'SERVICO', 'PRIVADO'])});
      L.add('cacamba', 420, {cor: pick(r, ['ferro_verde', 'ferro_azul', 'ferrugem'])});
      L.add('escada_incendio', 640, {}, {nome: 'Escada de incêndio', papel: 'escada_sobe'});
      L.add('ar_janela', 560, {}, {v: 10, sobrepor: true});
      L.add('grafite', 820, {texto: pick(r, ['KAOS', 'VILA', 'LUA', 'ZONA']), cor: pick(r, ['rosa_vivo', 'turquesa', 'laranja'])}, {v: 18, sobrepor: true});
      porta(L, 960, 'Porta dos fundos', 'servico2', {modelo: pick(r, ['metal', 'grade']), cor: 'ferrugem'});
      L.add('poste', 1120, {modelo: 'antigo', defeito: chance(r, .5)});
      L.add('lixeira_publica', 1200, {cor: 'verde_vivo'});
      L.add('vao_ceu', 1310, {largura: 40, cerca: 'alambrado'});
      L.add('fios', 700, {largura: 480}, {v: 1, sobrepor: true});
      L.add('poca', 520, {largura: 110}); L.add('poca', 1050, {largura: 70});
      L.add('lixo_chao', 380, {quantidade: 'muito'}); L.add('mancha', 800, {tipo: 'oleo', largura: 80});
      L.add('lixeira_frente', 760, {cor: 'laranja'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Gato no lixo', 'tempo', 'som', {som: 'objeto', texto: 'Uma tampa de lata cai. Um gato magro some entre as caixas.', chance: 35}),
        ev('Começa a chover', 'manual', 'chuva', {texto: ''}),
        ev('Alguém observa', 'manual', 'legenda', {texto: 'Na escada de incêndio, uma silhueta fica parada olhando. Quando você pisca, não está mais lá.'})]};
    }
  });

  /* ------------------------------------------------------------ rua */
  M.modelo({
    id: 'rua', nome: 'Rua', grupo: 'Rua', tags: ['exterior', 'rua'], luz: 'exterior', luzPadrao: 'tarde',
    descricao: 'Calçada com lojas, portaria de prédio, casa, oficina, ponto de ônibus e orelhão.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 2200;
      const casca = {exterior: true, parede: 'liso', corParede: pick(r, ['reboco', 'cinza']), barra: 'nenhuma', teto: false, piso: pick(r, ['calcada', 'portuguesa']), corPiso: 'calcada', rua: true,
        desgaste: opcoes.desgaste ?? (chance(r, .4) ? 1 : 0), vista: 'predios'};
      L.add('saida_esq', 35, {}, {nome: 'Rua (para a esquerda)', papel: 'rua_esq'});
      L.add('saida_dir', L.largura - 35, {}, {nome: 'Rua (para a direita)', papel: 'rua_dir'});
      const loja = nome(r, 'loja');
      L.add('fachada', 300, {estilo: 'loja', cor: pick(r, ['amarelo', 'azul', 'verde', 'rosa']), largura: 170, letreiro: loja.split(' ')[0].toUpperCase().slice(0, 12), toldo: pick(r, ['liso', 'listrado']), corToldo: pick(r, ['vermelho', 'verde_vivo', 'azul_vivo', 'laranja'])});
      porta(L, 230, loja, 'loja', {modelo: 'vidro', placa: 'ABERTO', alem: 'quente'});
      L.add('janela', 370, {modelo: 'comercial', moldura: 'aluminio', cortina: 'nenhuma'}, {v: 20, sobrepor: true});
      L.add('orelhao', 520, {cor: pick(r, ['azul_vivo', 'laranja'])});
      const predio = nome(r, 'predio');
      L.add('fachada', 780, {estilo: 'predio', cor: pick(r, ['cinza', 'reboco', 'branco']), largura: 150, letreiro: predio.replace('Edifício ', '').toUpperCase().slice(0, 12), toldo: 'nenhum'});
      porta(L, 780, predio, 'predio', {modelo: 'vidro', placa: '', alem: 'frio'});
      L.add('poste', 640, {modelo: 'sodio'});
      L.add('vao_ceu', 1040, {largura: 90, cerca: pick(r, ['alambrado', 'tapume', 'muro_baixo'])});
      L.add('arvore_canteiro', 1065, {});
      L.add('placa_rua', 930, {texto: nome(r, 'rua').replace('Rua ', 'R. ').replace('Avenida ', 'AV. ').replace('Travessa ', 'TV. ').toUpperCase().slice(0, 16), poste: true}, {v: 8, sobrepor: true});
      L.add('hidrante', 1150, {});
      // A casa pode virar um bar (o conjunto do quarteirão pede isso).
      const bar = opcoes.casa === 'bar' ? opcoes.nomeBar || nome(r, 'bar') : null;
      if (bar) {
        L.add('fachada', 1380, {estilo: 'loja', cor: pick(r, ['vinho', 'petroleo', 'tijolo']), largura: 160, letreiro: bar.replace(/^(Bar|Boteco)( d[oa]| e)? /, '').toUpperCase().slice(0, 12), toldo: 'liso', corToldo: pick(r, ['vermelho', 'laranja'])});
        porta(L, 1262, bar, 'casa', {modelo: 'madeira', cor: 'madeira_escura', placa: 'BAR', alem: 'quente'});
        L.add('janela', 1395, {modelo: 'comercial', moldura: 'aluminio', cortina: 'nenhuma'}, {v: 18, sobrepor: true});
      } else {
        L.add('fachada', 1380, {estilo: 'casa', cor: pick(r, ['rosa', 'verde', 'amarelo', 'azul']), largura: 160, letreiro: '', toldo: 'nenhum'});
        porta(L, 1262, 'Casa', 'casa', {modelo: 'madeira', cor: 'madeira'});
        L.add('janela', 1395, {modelo: 'grade', moldura: 'ferro_verde', cortina: 'fechada', corCortina: 'tecido_mostarda'}, {v: 16, sobrepor: true});
      }
      L.add('carro', 1478, {modelo: pick(r, ['sedan', 'fusca', 'pickup', 'taxi']), cor: pick(r, ['vermelho', 'azul_vivo', 'amarelo_vivo', 'verde_vivo'])}, {sobrepor: true, z: 2});
      L.add('ponto_onibus', 1742, {linha: String(100 + Math.floor(r() * 800))});
      const oficina = nome(r, 'oficina');
      L.add('fachada', 2020, {estilo: 'galpao', cor: pick(r, ['azul', 'cinza', 'concreto']), largura: 120, letreiro: oficina.split(' ').slice(-1)[0].toUpperCase().slice(0, 10), toldo: 'nenhum'});
      L.add('porta', 2020, {modelo: 'enrolar', cor: 'ferro_azul', placa: 'OFICINA'}, {nome: oficina, papel: 'oficina'});
      L.add('poste', 1880, {modelo: 'sodio'});
      L.add('lixeira_publica', 580, {cor: 'laranja'});
      L.add('fios', 1150, {largura: 640}, {v: 0, sobrepor: true});
      L.add('bueiro', 1640, {}); L.add('folhas', 1080, {quantidade: 'pouco'});
      if (casca.desgaste || chance(r, .5)) L.add('poca', 700 + jit(r, 60), {largura: 70});
      if (casca.desgaste) L.add('lixo_chao', 560, {});
      L.add('poste_frente', 1150, {aceso: true});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Carro passa', 'tempo', 'som', {som: 'buzina', texto: '', chance: 40, min: 40, max: 120}),
        ev('Começa a chover', 'manual', 'chuva', {}),
        ev('Orelhão toca', 'manual', 'telefone', {texto: 'O orelhão da esquina começa a tocar.'})]};
    }
  });

  /* ------------------------------------------------------------ estacionamento */
  M.modelo({
    id: 'estacionamento', nome: 'Estacionamento subterrâneo', grupo: 'Rua', tags: ['interior', 'estacionamento', 'subsolo'], luz: 'subsolo', luzPadrao: 'meia_luz',
    descricao: 'Pilares numerados, vagas, carros, elevador, escada e a guarita da saída.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1950;
      const faixa = pick(r, ['amarelo_vivo', 'vermelho', 'azul_vivo']), setor = pick(r, ['G', 'B', 'S']);
      const casca = {parede: 'concreto', corParede: 'concreto', barra: 'faixa', corBarra: faixa, piso: 'epoxi', corPiso: pick(r, ['epoxi', 'concreto']), desgaste: opcoes.desgaste ?? 1 + Math.floor(r() * 2)};
      L.add('elevador', 150, {andar: `${setor}1`}, {nome: 'Elevador', papel: 'elevador'});
      L.add('escada', 290, {sentido: 'sobe', placa: 'TERREO'}, {nome: 'Escada para o térreo', papel: 'escada_sobe'});
      L.add('placa_saida', 290, {}, {v: 0, sobrepor: true});
      for (let i = 0; i < 4; i++) {
        const x = 470 + i * 340;
        L.add('pilar_garagem', x, {numero: `${setor}${i + 1}`, cor: faixa});
        if (i < 3) {
          if (chance(r, .75)) L.add('carro', x + 170, {modelo: pick(r, ['sedan', 'fusca', 'pickup', 'van']), cor: pick(r, ['plastico_preto', 'branco', 'vermelho', 'azul_vivo', 'aluminio']), estado_carro: pick(r, ['bom', 'bom', 'batido'])}, {sobrepor: true});
          L.add('vaga', x + 170, {largura: 280});
        }
      }
      L.add('placa_garagem', 1320, {texto: 'SAIDA'}, {v: 6, sobrepor: true});
      L.add('guarita', 1640, {luz: true}); L.add('cancela', 1790, {aberta: false});
      L.add('saida_dir', L.largura - 35, {}, {nome: 'Rampa de saída', papel: 'rampa'});
      luzes(L, [200, 470, 810, 1150, 1490, 1800], 'fluorescente', {});
      L.objetos.filter(o => o.mod === 'luminaria')[2 + Math.floor(r() * 3)].p.defeito = true;
      L.add('mancha', 980, {tipo: 'oleo', largura: 90});
      L.add('pilar_frente', 810, {numero: `${setor}2`, cor: faixa});
      L.add('cone', 1720, {quantidade: '2'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Alarme de carro', 'tempo', 'som', {som: 'buzina', texto: 'Um alarme de carro dispara e para sozinho.', chance: 25, min: 150, max: 360}),
        ev('Lâmpadas piscam', 'tempo', 'piscar', {chance: 30, duracao: 3}),
        ev('Passos ecoando', 'manual', 'som', {som: 'passos_escada', texto: 'Passos ecoam entre os pilares. Param quando você para.'})]};
    }
  });

  /* ------------------------------------------------------------ loja */
  M.modelo({
    id: 'loja', nome: 'Loja de conveniência', grupo: 'Comércio', tags: ['interior', 'comércio', 'loja'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Gôndolas, geladeiras de bebida, caixa, máquina de venda e a porta do estoque.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1400;
      const casca = {parede: pick(r, ['liso', 'pastilha']), corParede: pick(r, ['branco', 'amarelo', 'verde', 'azul']), barra: 'faixa', corBarra: pick(r, ['vermelho', 'verde_vivo', 'azul_vivo', 'laranja']),
        piso: pick(r, ['ceramica', 'xadrez', 'linoleo']), corPiso: pick(r, ['branco', 'ceramica', 'linoleo']), desgaste: opcoes.desgaste ?? (chance(r, .35) ? 1 : 0), vista: 'predios'};
      porta(L, 80, 'Porta da loja', 'entrada', {modelo: 'vidro', placa: 'ABERTO', alem: 'escuro'});
      L.add('janela', 228, {modelo: 'comercial', moldura: 'aluminio', cortina: 'nenhuma'}, {v: 10, sobrepor: true});
      L.add('letreiro_neon', 228, {texto: pick(r, ['ABERTO', '24H', 'AQUI']), cor: pick(r, ['neon_rosa', 'neon_azul', 'neon_verde'])}, {v: 2, sobrepor: true});
      L.add('maquina_venda', 352, {estilo: pick(r, ['refrigerante', 'salgadinho']), cor: pick(r, ['vermelho', 'azul_vivo', 'laranja'])});
      ['mercado', 'limpeza', 'farmacia'].forEach((p, i) => L.add('gondola', 470 + i * 110, {produtos: i === 2 ? pick(r, ['farmacia', 'mercado']) : p, tamanho: 'curta'}));
      L.add('geladeira_bebidas', 802, {portas: '2'}); L.add('geladeira_bebidas', 940, {portas: '2'});
      L.add('placa_promocao', 1200, {texto: pick(r, ['PROMOCAO', 'OFERTA']), preco: pick(r, ['4,99', '2,50', '9,90']), cor: 'vermelho'}, {v: 4, sobrepor: true});
      L.add('caixa_registradora', 1080, {cor: pick(r, ['madeira', 'mdf'])});
      L.add('camera', 1080, {}, {v: 1, sobrepor: true});
      L.add('freezer_sorvete', 1200, {cor: pick(r, ['azul_vivo', 'vermelho'])});
      porta(L, 1320, 'Porta do estoque', 'estoque', {modelo: 'metal', placa: 'ESTOQUE', cor: 'cinza'});
      luzes(L, [220, 520, 820, 1120], 'fluorescente', {});
      L.add('gondola_frente', 600, {produtos: pick(r, ['mercado', 'bebidas'])});
      L.add('balcao_frente', 1090, {cor: 'madeira', coisas: true});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Campainha da porta', 'tempo', 'som', {som: 'campainha', texto: 'A campainha da porta toca. Ninguém entrou.', chance: 25}),
        ev('Luzes piscam', 'tempo', 'piscar', {chance: 20, duracao: 2}),
        ev('Queda de energia', 'manual', 'apagar', {texto: 'Tudo apaga. As geladeiras param de zumbir.'})]};
    }
  });

  /* ------------------------------------------------------------ restaurante */
  M.modelo({
    id: 'restaurante', nome: 'Lanchonete', grupo: 'Comércio', tags: ['interior', 'comércio', 'restaurante'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Mesas, balcão com banquetas, chapa, cardápio luminoso, TV e jukebox.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1480;
      const casca = {parede: pick(r, ['azulejo', 'liso', 'pastilha']), corParede: pick(r, ['branco', 'amarelo', 'vermelho', 'verde']), barra: pick(r, ['azulejo', 'faixa']), corBarra: pick(r, ['vermelho', 'branco', 'verde_vivo']),
        piso: pick(r, ['xadrez', 'ceramica']), corPiso: pick(r, ['branco', 'ceramica']), desgaste: opcoes.desgaste ?? (chance(r, .4) ? 1 : 0), vista: 'predios'};
      const nomeLugar = nome(r, 'restaurante');
      porta(L, 80, 'Porta da lanchonete', 'entrada', {modelo: 'vidro', placa: 'ABERTO', alem: 'escuro'});
      L.add('letreiro_neon', 230, {texto: pick(r, ['LANCHES', 'PASTEL', 'CAFE']), cor: pick(r, ['neon_rosa', 'neon_azul'])}, {v: 3, sobrepor: true});
      const cor = pick(r, ['vermelho', 'azul_vivo', 'madeira']);
      L.add('mesa_lanchonete', 250, {cor, cadeiras: '4', coisas: true});
      L.add('mesa_lanchonete', 440, {cor, cadeiras: '4', coisas: chance(r, .6)});
      L.add('jukebox', 580, {ligada: chance(r, .6)});
      L.add('tv_parede', 680, {modelo: 'plana', ligada: true}, {v: 8, sobrepor: true});
      L.add('balcao_bar', 820, {cor: 'madeira', banquetas: '5'});
      L.add('chapa_cozinha', 1040, {ligada: chance(r, .7)});
      L.add('cardapio_luminoso', 1040, {}, {v: 2, sobrepor: true});
      L.add('estufa_salgados', 760, {}, {sobrepor: true});
      L.add('maquina_cafe', 890, {}, {sobrepor: true});
      L.add('maquina_venda', 1220, {estilo: 'refrigerante', cor: 'vermelho'});
      L.add('porta', 1370, {modelo: 'vaivem', cor: 'branco', placa: 'COZINHA'}, {nome: 'Porta da cozinha', papel: 'cozinha'});
      luzes(L, [250, 450, 820, 1100], pick(r, ['pendente', 'fluorescente']), {});
      L.add('mesa_frente', 360, {cor: cor === 'madeira' ? 'madeira' : 'vermelho'});
      L.add('banqueta_frente', 800, {cor: 'vermelho'}); L.add('banqueta_frente', 880, {cor: 'vermelho'});
      return {largura: L.largura, casca, objetos: L.objetos, subtitulo: nomeLugar, eventos: [
        ev('TV muda de canal', 'tempo', 'tv', {chance: 30, min: 90, max: 200, texto: ''}),
        ev('Chapa acende', 'manual', 'estado', {texto: 'A chapa acende sozinha. Cheiro de carne queimando.'}),
        ev('Pedido pronto', 'tempo', 'som', {som: 'campainha', texto: 'Alguém bate na campainha do balcão: pedido pronto. A cozinha está vazia.', chance: 20})]};
    }
  });

  /* ------------------------------------------------------------ bar */
  M.modelo({
    id: 'bar', nome: 'Bar e fliperama', grupo: 'Comércio', tags: ['interior', 'comércio', 'bar', 'diversão'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Balcão com chopeira, sinuca, dardos, fliperamas, jukebox e karaokê.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1560;
      const casca = {parede: pick(r, ['tijolo', 'lambri', 'liso']), corParede: pick(r, ['tijolo', 'vinho', 'petroleo', 'madeira']), barra: 'lambri', corBarra: 'madeira_escura',
        piso: pick(r, ['tabuas', 'xadrez', 'concreto']), corPiso: pick(r, ['madeira_escura', 'branco', 'concreto']), desgaste: opcoes.desgaste ?? 1 + Math.floor(r() * 2), vista: 'predios'};
      porta(L, 80, 'Porta do bar', 'entrada', {modelo: pick(r, ['madeira', 'vidro']), placa: 'BAR', alem: 'escuro'});
      L.add('letreiro_neon', 176, {texto: 'BAR', cor: pick(r, ['neon_azul', 'neon_rosa']), defeito: chance(r, .5)}, {v: 7, sobrepor: true});
      L.add('balcao_bar', 300, {cor: 'madeira', banquetas: '5'});
      L.add('prateleira_bar', 300, {}, {v: 10, sobrepor: true});
      L.add('chopeira', 250, {}, {sobrepor: true});
      L.add('tv_parede', 480, {modelo: pick(r, ['tubo', 'plana'])}, {v: 6, sobrepor: true});
      L.add('mesa_sinuca', 620, {});
      L.add('luminaria', 620, {modelo: 'pendente'}, {sobrepor: true});
      L.add('alvo_dardos', 772, {}, {v: 14, sobrepor: true});
      L.add('fliperama', 880, {titulo: 'CEU INVASOR', jogo: 'invasores', cor: pick(r, ['roxo', 'vermelho', 'azul_vivo'])});
      L.add('fliperama', 970, {titulo: 'QUEBRA BLOCO', jogo: 'blocos', cor: pick(r, ['verde_vivo', 'laranja', 'turquesa'])});
      L.add('jukebox', 1070, {ligada: true});
      L.add(chance(r, .5) ? 'palco_karaoke' : 'mesa_pebolim', 1220, {});
      porta(L, 1470, 'Banheiro do bar', 'banheiro', {modelo: 'banheiro', placa: 'WC'});
      luzes(L, [300, 900, 1250], 'pendente', {});
      L.add('mesa_frente', 450, {cor: 'madeira'}); L.add('banqueta_frente', 180, {cor: 'vermelho'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Jukebox troca de música', 'tempo', 'som', {som: 'arcade', texto: 'A jukebox escolhe uma música sozinha.', chance: 30}),
        ev('Briga lá fora', 'manual', 'legenda', {texto: 'Gritos e um vidro quebrando lá fora. Depois, sirenes ao longe.'}),
        ev('Fliperama liga', 'entrar', 'som', {som: 'arcade', chance: 30, texto: ''})]};
    }
  });

  /* ------------------------------------------------------------ hospital */
  M.modelo({
    id: 'hospital', nome: 'Enfermaria', grupo: 'Saúde', tags: ['interior', 'hospital', 'saúde'], luz: 'hospital', luzPadrao: 'noite',
    descricao: 'Leitos com soro e monitores, cortinas, armário de remédios e o posto de enfermagem.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1560;
      const casca = {parede: 'liso', corParede: pick(r, ['verde', 'azul', 'branco']), barra: 'meia', corBarra: pick(r, ['branco', 'verde', 'azul']), piso: 'linoleo', corPiso: pick(r, ['linoleo', 'azul', 'branco']),
        desgaste: opcoes.desgaste ?? (chance(r, .4) ? 1 : 0), vista: 'cidade'};
      L.add('porta', 90, {modelo: 'vaivem', cor: 'verde', placa: 'ENFERMARIA'}, {nome: 'Porta da enfermaria', papel: 'entrada'});
      L.add('interruptor', 165, {});
      for (let i = 0; i < 3; i++) {
        const x = 330 + i * 330;
        // A cortina vem antes do soro, que fica na frente dela.
        if (i < 2) L.add('cortina_hospital', x + 168, {cor: pick(r, ['tecido_verde', 'tecido_azul']), largura: 40, fechada: chance(r, .4)}, {sobrepor: true});
        L.add('leito_hospitalar', x, {lencol: pick(r, ['lencol', 'tecido_azul', 'tecido_verde']), grades: true, velho: casca.desgaste > 1, ocupado: chance(r, .35)});
        L.add('suporte_soro', x + 95, {bolsa: pick(r, ['cheia', 'cheia', 'vazia'])});
        L.add('painel_gases', x, {}, {v: 18, sobrepor: true});
        L.add('monitor_cardiaco', x - 46, {ligado: chance(r, .6)}, {v: 1, sobrepor: true});
      }
      L.add('armario_remedios', 1230, {cor: 'branco', aberto: chance(r, .3)});
      L.add('negatoscopio', 1230, {ligado: chance(r, .5)}, {v: 10, sobrepor: true});
      L.add('lixeira_hospitalar', 1300, {tipo: 'infectante'});
      L.add('cadeira_rodas', 1380, {});
      porta(L, 1490, 'Banheiro', 'banheiro', {modelo: 'banheiro', placa: 'WC'});
      L.add('relogio', 1380, {}, {v: 8, sobrepor: true});
      luzes(L, [330, 630, 930, 1230], 'fluorescente', {});
      L.objetos.filter(o => o.mod === 'luminaria')[Math.floor(r() * 4)].p.defeito = chance(r, .6);
      L.add('luz_emergencia', 215, {}, {v: 4, sobrepor: true});
      L.add('carrinho_limpeza', 780, {cor: pick(r, ['amarelo_vivo', 'azul_vivo'])});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Monitor apita', 'tempo', 'som', {som: 'beep', texto: 'Um monitor apita mais rápido. Depois, uma linha contínua.', chance: 30}),
        ev('Chamada no alto-falante', 'tempo', 'legenda', {texto: '“Doutor Álvaro, compareça ao subsolo. Doutor Álvaro.”', chance: 20, min: 150, max: 360}),
        ev('Emergência', 'manual', 'apagar', {texto: 'As luzes caem. Só as de emergência acendem, vermelhas.'})]};
    }
  });

  /* ------------------------------------------------------------ prédio abandonado */
  M.modelo({
    id: 'predio_abandonado', nome: 'Prédio abandonado', grupo: 'Abandonado', tags: ['interior', 'abandonado'], luz: 'abandonado', luzPadrao: 'noite',
    descricao: 'Paredes descascadas, janelas quebradas, entulho, móveis largados e um buraco na parede.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1400;
      const casca = {parede: 'liso', corParede: pick(r, ['branco', 'verde', 'amarelo', 'azul']), barra: pick(r, ['rodape', 'meia']), corBarra: 'cinza', piso: pick(r, ['podre', 'concreto', 'ceramica']), corPiso: pick(r, ['madeira', 'concreto', 'ceramica']),
        desgaste: opcoes.desgaste ?? 3, energia: false, vista: pick(r, ['predios', 'arvores'])};
      porta(L, 80, 'Porta arrombada', 'entrada', {modelo: 'madeira', cor: 'madeira_escura', aberta: true, alem: 'escuro'});
      L.add('janela', 300, {modelo: 'quebrada', moldura: 'madeira', cortina: 'nenhuma'}, {sobrepor: true});
      L.add('movel_velho', 300, {tipo: pick(r, ['sofa_rasgado', 'colchao'])});
      L.add('entulho', 480, {tamanho: 'grande'});
      L.add('grafite', 1168, {texto: pick(r, ['OCUPA', 'LUA', 'KAOS', '1987']), cor: pick(r, ['rosa_vivo', 'turquesa', 'amarelo_vivo'])}, {v: 14, sobrepor: true});
      L.add('buraco_parede', 700, {}, {nome: 'Buraco na parede', papel: 'buraco'});
      L.add('quadro', 830, {motivo: 'retrato', formato: 'retrato', torto: true}, {v: 14, sobrepor: true});
      L.add('movel_velho', 850, {tipo: pick(r, ['geladeira_velha', 'cadeira_quebrada'])});
      L.add('janela', 1000, {modelo: 'quebrada', moldura: 'madeira', cortina: 'nenhuma'}, {sobrepor: true});
      L.add('tabuas_parede', 1000, {}, {v: 12, sobrepor: true});
      L.add('entulho', 1120, {tamanho: 'pequeno'});
      L.add('escada', 1280, {sentido: 'sobe', cor: 'concreto'}, {nome: 'Escada (sobe)', papel: 'escada_sobe'});
      L.add('luminaria', 500, {modelo: 'lampada', acesa: false}, {sobrepor: true});
      L.add('entulho_chao', 480, {}); L.add('folhas', 300, {quantidade: 'muito'}); L.add('mancha', 900, {tipo: pick(r, ['agua', 'sujeira', 'sangue']), largura: 90});
      L.add('caixas_frente', 1180, {tipo: 'madeira'});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Algo corre lá em cima', 'tempo', 'som', {som: 'passos_cima', texto: 'Algo corre no andar de cima. Pés pequenos. Muitos.', chance: 35}),
        ev('Vento pelas janelas', 'entrar', 'som', {som: 'vento', chance: 60, texto: ''}),
        ev('Tremor', 'manual', 'tremor', {texto: 'O prédio inteiro range. Cai reboco do teto.'})]};
    }
  });

  /* ------------------------------------------------------------ oficina */
  M.modelo({
    id: 'oficina', nome: 'Oficina mecânica', grupo: 'Trabalho', tags: ['interior', 'trabalho', 'oficina'], luz: 'interior', luzPadrao: 'tarde',
    descricao: 'Carro no elevador, bancada, painel de ferramentas, pneus, tambores e compressor.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1500;
      const casca = {parede: pick(r, ['blocos', 'tijolo', 'concreto']), corParede: pick(r, ['concreto', 'azul', 'tijolo', 'cinza']), barra: 'faixa', corBarra: pick(r, ['amarelo_vivo', 'azul_vivo', 'vermelho']),
        piso: pick(r, ['concreto', 'epoxi']), corPiso: pick(r, ['concreto', 'epoxi']), desgaste: opcoes.desgaste ?? 1 + Math.floor(r() * 2), vista: 'predios'};
      L.add('porta', 120, {modelo: 'enrolar', cor: pick(r, ['ferro_azul', 'aco', 'vermelho']), placa: 'OFICINA', aberta: chance(r, .4), alem: 'frio'}, {nome: 'Portão da oficina', papel: 'rua'});
      L.add('quadro_energia', 250, {cor: 'cinza'});
      L.add('elevador_carro', 540, {carro: true, cor: pick(r, ['vermelho', 'azul_vivo', 'amarelo_vivo', 'verde_vivo'])});
      L.add('bancada_ferramentas', 850, {cor: pick(r, ['ferro_verde', 'madeira', 'aco'])});
      L.add('painel_ferramentas', 850, {}, {v: 14, sobrepor: true});
      L.add('pneus', 980, {pilha: pick(r, ['3', '4'])}); L.add('pneus', 1040, {pilha: '2'});
      L.add('tambor', 1140, {quantidade: '2', cor: pick(r, ['ferro_azul', 'vermelho'])});
      L.add('compressor', 1240, {ligado: false});
      L.add('janela', 745, {modelo: 'basculante'}, {v: 4, sobrepor: true});
      L.add('cartaz', 1000, {estilo: 'calendario', tamanho: 'M'}, {v: 12, sobrepor: true});
      porta(L, 1400, 'Escritório da oficina', 'escritorio', {modelo: 'metal', placa: 'ESCRITORIO', cor: 'ferro_bege'});
      luzes(L, [300, 650, 1000, 1300], 'industrial', {});
      L.add('carrinho_ferramentas', 700, {cor: 'vermelho'});
      L.add('mancha', 540, {tipo: 'oleo', largura: 120}); L.add('mancha', 1150, {tipo: 'oleo', largura: 60});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Compressor liga', 'tempo', 'estado', {chance: 25, texto: 'O compressor liga sozinho e enche o ar de barulho.'}),
        ev('Rádio chiando', 'entrar', 'som', {som: 'estatica', chance: 40, texto: ''})]};
    }
  });

  /* ------------------------------------------------------------ escadaria */
  M.modelo({
    id: 'escadaria', nome: 'Escadaria', grupo: 'Conectores', tags: ['interior', 'prédio', 'escadaria'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Patamar com escada que sobe, escada que desce e a porta corta-fogo do andar.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 860;
      const casca = {parede: pick(r, ['liso', 'blocos']), corParede: pick(r, ['cinza', 'branco', 'verde', 'amarelo']), barra: 'meia', corBarra: pick(r, ['cinza', 'petroleo', 'vermelho']),
        piso: pick(r, ['ceramica', 'concreto']), corPiso: pick(r, ['ceramica', 'concreto']), desgaste: opcoes.desgaste ?? (chance(r, .5) ? 1 : 2), vista: 'predios'};
      const andar = opcoes.andar ?? 1 + Math.floor(r() * 6);
      L.add('porta', 90, {modelo: 'metal', cor: pick(r, ['ferro_verde', 'vermelho', 'cinza']), placa: ''}, {nome: `Porta do ${andar}º andar`, papel: 'andar'});
      L.add('placa_saida', 90, {}, {v: 0, sobrepor: true});
      L.add('extintor', 180, {});
      L.add('escada', 360, {sentido: 'desce'}, {nome: 'Escada (desce)', papel: 'escada_desce'});
      L.add('janela', 500, {modelo: pick(r, ['grade', 'basculante']), moldura: 'aluminio', cortina: 'nenhuma'}, {v: 8, sobrepor: true});
      L.add('escada', 650, {sentido: 'sobe'}, {nome: 'Escada (sobe)', papel: 'escada_sobe'});
      L.add('cartaz', 226, {estilo: 'aviso', titulo: `${andar}º`, tamanho: 'G'}, {v: 16, sobrepor: true});
      L.add('luminaria', 500, {modelo: 'plafon', defeito: chance(r, .4)}, {sobrepor: true});
      L.add('luz_emergencia', 250, {}, {v: 4, sobrepor: true});
      L.add('interruptor', 150, {});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Passos subindo', 'tempo', 'som', {som: 'passos_escada', texto: 'Alguém sobe a escada, alguns andares abaixo. Os passos param no seu andar.', chance: 35}),
        ev('Luz com sensor apaga', 'tempo', 'escuridao', {chance: 30, duracao: 4, texto: ''})]};
    }
  });

  /* ------------------------------------------------------------ portaria */
  M.modelo({
    id: 'portaria', nome: 'Portaria de prédio', grupo: 'Conectores', tags: ['interior', 'prédio', 'portaria'], luz: 'interior', luzPadrao: 'noite',
    descricao: 'Balcão do porteiro, plantas, elevador e escada; a porta de vidro dá para a rua.',
    gerar({rng: r, L, opcoes}) {
      L.largura = opcoes.largura || 1300;
      const casca = {parede: pick(r, ['pastilha', 'liso', 'painel']), corParede: pick(r, ['reboco', 'branco', 'azul', 'petroleo']), barra: pick(r, ['rodape', 'lambri']), corBarra: 'madeira',
        piso: pick(r, ['xadrez', 'ceramica']), corPiso: pick(r, ['branco', 'ceramica']), sanca: true, desgaste: opcoes.desgaste ?? (chance(r, .3) ? 1 : 0), vista: 'cidade'};
      L.add('porta', 90, {modelo: 'vidro', placa: '', alem: 'escuro'}, {nome: 'Porta para a rua', papel: 'rua'});
      L.add('vaso_planta', 190, {tipo: pick(r, ['costela', 'espada', 'jiboia'])});
      L.add('balcao_recepcao', 360, {cor: pick(r, ['madeira', 'madeira_escura']), placa: 'PORTARIA', telefone: true});
      L.add('quadro', 360, {motivo: pick(r, ['paisagem', 'cidade', 'abstrato']), moldura: 'latao'}, {v: 10, sobrepor: true});
      L.add('camera', 480, {}, {v: 1, sobrepor: true});
      L.add('cadeiras_espera', 560, {lugares: '3', cor: 'couro_preto'});
      L.add('elevador', 820, {andar: 'T'}, {nome: 'Elevador', papel: 'elevador'});
      L.add('vaso_planta', 940, {tipo: pick(r, ['espada', 'costela'])});
      L.add('escada', 1110, {sentido: 'sobe'}, {nome: 'Escada', papel: 'escada_sobe'});
      L.add('relogio', 600, {}, {v: 6, sobrepor: true});
      luzes(L, [300, 700, 1050], pick(r, ['pendente', 'plafon']), {});
      L.add('tapete', 96, {cor: 'tecido_vinho', padrao: 'liso', largura: 96, posicao: 'porta'});
      L.add('interruptor', 150, {});
      return {largura: L.largura, casca, objetos: L.objetos, eventos: [
        ev('Interfone toca', 'tempo', 'telefone', {chance: 25, texto: ''}),
        ev('Elevador chega vazio', 'tempo', 'som', {som: 'elevador', texto: 'O elevador chega ao térreo. As portas abrem. Ninguém sai.', chance: 20, min: 150, max: 360})]};
    }
  });

  /* ============================================================ conjuntos */
  /* Um conjunto gera várias receitas e as liga pelo papel das passagens,
     antes de registrá-las. `cena(chave, modelo, opcoes)` e `ligar(a, papelA, b, papelB)`. */
  function construtor(opcoesGerais) {
    const receitas = new Map(), elevadores = [];
    const api = {
      cena(chave, modelo, opcoes = {}) { const R = M.gerar(modelo, {...opcoesGerais, ...opcoes}); receitas.set(chave, R); return R; },
      obj(chave, papel) { return receitas.get(chave)?.objetos.find(o => o.papel === papel) || null; },
      ligar(a, pa, b, pb) {
        const A = api.obj(a, pa), B = api.obj(b, pb);
        if (!A || !B) { console.warn('Conjunto: passagem não encontrada', a, pa, b, pb); return; }
        A.pas = {...(A.pas || {}), destino: receitas.get(b).id, chegada: B.id};
        B.pas = {...(B.pas || {}), destino: receitas.get(a).id, chegada: A.id};
      },
      /* Elevador que atende várias cenas: [[chave, rótulo], …]. */
      elevador(paradas) { elevadores.push(paradas); },
      registrar() {
        for (const paradas of elevadores) {
          const linhas = paradas.map(([chave, rotulo]) => ({rotulo, cena: receitas.get(chave)?.id || '', chegada: api.obj(chave, 'elevador')?.id || ''}));
          for (const [chave] of paradas) { const o = api.obj(chave, 'elevador'); if (o) o.pas = {...(o.pas || {}), andares: linhas.map(l => [l.rotulo, l.cena, l.chegada].join(' | ')).join('\n')}; }
        }
        return [...receitas.values()].map(R => M.registrar(R));
      }
    };
    return api;
  }
  M.conjunto({
    id: 'predio_residencial', nome: 'Prédio residencial', grupo: 'Conjuntos',
    descricao: 'Rua → portaria → corredor do 1º andar (escada e elevador) → dois apartamentos, cada um com quarto e banheiro.',
    criar(opcoes = {}) {
      const r = K.rng(opcoes.semente || Math.floor(Math.random() * 1e9)), B = construtor({desgaste: opcoes.desgaste});
      const predio = nome(r, 'predio');
      B.cena('rua', 'rua', {nome: nome(r, 'rua')});
      B.cena('portaria', 'portaria', {nome: `${predio} · Portaria`});
      B.cena('andar1', 'corredor', {nome: `${predio} · 1º andar`, estilo: 'residencial', andar: 1, portas: 2, largura: 1100, escada: 'desce'});
      B.cena('apA', 'apartamento', {nome: 'Apartamento 101', placa: '101'});
      B.cena('apB', 'apartamento', {nome: 'Apartamento 102', placa: '102'});
      B.cena('quartoA', 'quarto', {nome: 'Apartamento 101 · Quarto'});
      B.cena('banheiroA', 'banheiro', {nome: 'Apartamento 101 · Banheiro', estilo: 'casa'});
      B.cena('quartoB', 'quarto', {nome: 'Apartamento 102 · Quarto'});
      B.cena('banheiroB', 'banheiro', {nome: 'Apartamento 102 · Banheiro', estilo: 'casa'});
      B.ligar('rua', 'predio', 'portaria', 'rua');
      B.ligar('portaria', 'escada_sobe', 'andar1', 'escada_desce');
      B.ligar('andar1', 'porta1', 'apA', 'entrada');
      B.ligar('andar1', 'porta2', 'apB', 'entrada');
      B.ligar('apA', 'quarto', 'quartoA', 'entrada'); B.ligar('apA', 'banheiro', 'banheiroA', 'entrada');
      B.ligar('apB', 'quarto', 'quartoB', 'entrada'); B.ligar('apB', 'banheiro', 'banheiroB', 'entrada');
      B.elevador([['portaria', 'TÉRREO'], ['andar1', '1º ANDAR']]);
      return B.registrar();
    }
  });
  M.conjunto({
    id: 'hospital_completo', nome: 'Hospital', grupo: 'Conjuntos',
    descricao: 'Rua → corredor do hospital → enfermaria (com banheiro), sala administrativa, almoxarifado e banheiro; escada e elevador para o estacionamento.',
    criar(opcoes = {}) {
      const r = K.rng(opcoes.semente || Math.floor(Math.random() * 1e9)), B = construtor({desgaste: opcoes.desgaste});
      const hosp = nome(r, 'hospital');
      B.cena('rua', 'rua', {nome: `${nome(r, 'rua')} · ${hosp}`});
      B.cena('corredor', 'corredor', {nome: `${hosp} · Corredor`, estilo: 'hospital', andar: 1, portas: 5, escada: 'desce', largura: 1700});
      B.cena('enfermaria', 'hospital', {nome: `${hosp} · Enfermaria`});
      B.cena('banheiro', 'banheiro', {nome: `${hosp} · Banheiro`, estilo: 'publico'});
      B.cena('banheiroEnf', 'banheiro', {nome: `${hosp} · Banheiro da enfermaria`, estilo: 'casa'});
      B.cena('adm', 'sala_administrativa', {nome: `${hosp} · Administração`});
      B.cena('deposito', 'deposito', {nome: `${hosp} · Almoxarifado`});
      B.cena('garagem', 'estacionamento', {nome: `${hosp} · Estacionamento`});
      B.ligar('rua', 'predio', 'corredor', 'porta1');
      B.ligar('corredor', 'porta2', 'enfermaria', 'entrada');
      B.ligar('corredor', 'porta3', 'adm', 'entrada');
      B.ligar('corredor', 'banheiro', 'banheiro', 'entrada');
      B.ligar('corredor', 'porta4', 'deposito', 'entrada');
      B.ligar('enfermaria', 'banheiro', 'banheiroEnf', 'entrada');
      B.ligar('corredor', 'escada_desce', 'garagem', 'escada_sobe');
      B.elevador([['corredor', 'TÉRREO'], ['garagem', 'SUBSOLO']]);
      return B.registrar();
    }
  });
  M.conjunto({
    id: 'quarteirao', nome: 'Quarteirão comercial', grupo: 'Conjuntos',
    descricao: 'Rua com loja (e estoque), oficina e bar; beco nos fundos com a cozinha da lanchonete e uma porta de serviço para improvisar.',
    criar(opcoes = {}) {
      const r = K.rng(opcoes.semente || Math.floor(Math.random() * 1e9)), B = construtor({desgaste: opcoes.desgaste});
      const nomeBar = nome(r, 'bar');
      B.cena('rua', 'rua', {nome: nome(r, 'rua'), casa: 'bar', nomeBar});
      B.cena('loja', 'loja', {nome: nome(r, 'loja')});
      B.cena('estoque', 'deposito', {nome: 'Estoque da loja'});
      B.cena('oficina', 'oficina', {nome: nome(r, 'oficina')});
      B.cena('beco', 'beco', {nome: 'Beco atrás da rua'});
      B.cena('lanchonete', 'restaurante', {nome: nome(r, 'restaurante')});
      B.cena('bar', 'bar', {nome: nomeBar});
      B.ligar('rua', 'loja', 'loja', 'entrada');
      B.ligar('loja', 'estoque', 'estoque', 'entrada');
      B.ligar('rua', 'oficina', 'oficina', 'rua');
      B.ligar('rua', 'rua_dir', 'beco', 'rua_esq');
      B.ligar('beco', 'servico1', 'lanchonete', 'cozinha');
      B.ligar('rua', 'casa', 'bar', 'entrada');
      return B.registrar();
    }
  });
  M.conjunto({
    id: 'predio_comercial', nome: 'Prédio de escritórios', grupo: 'Conjuntos',
    descricao: 'Portaria → corredor comercial → dois escritórios (um com diretoria) e banheiro; uma sala sem destino para improvisar; escadaria e elevador até a garagem.',
    criar(opcoes = {}) {
      const r = K.rng(opcoes.semente || Math.floor(Math.random() * 1e9)), B = construtor({desgaste: opcoes.desgaste});
      const empresa = nome(r, 'empresa'), outra = pick(r, NOMES.empresa.filter(n => n !== empresa));
      B.cena('portaria', 'portaria', {nome: `${nome(r, 'comercial')} · Portaria`});
      B.cena('corredor', 'corredor', {nome: 'Corredor do 3º andar', estilo: 'escritorio', andar: 3, portas: 4, escada: 'desce'});
      B.cena('escritorio', 'escritorio', {nome: empresa});
      B.cena('adm', 'sala_administrativa', {nome: `${empresa} · Diretoria`});
      B.cena('escritorio2', 'escritorio', {nome: outra});
      B.cena('banheiro', 'banheiro', {nome: 'Banheiro do 3º andar', estilo: 'publico'});
      B.cena('escadaria', 'escadaria', {nome: 'Escadaria', andar: 3});
      B.cena('garagem', 'estacionamento', {nome: 'Garagem do prédio'});
      B.ligar('corredor', 'porta1', 'escritorio', 'entrada');
      B.ligar('escritorio', 'diretoria', 'adm', 'entrada');
      B.ligar('corredor', 'porta2', 'escritorio2', 'entrada');
      B.ligar('corredor', 'banheiro', 'banheiro', 'entrada');
      B.ligar('corredor', 'escada_desce', 'escadaria', 'andar');
      B.ligar('escadaria', 'escada_desce', 'garagem', 'escada_sobe');
      B.ligar('portaria', 'escada_sobe', 'escadaria', 'escada_sobe');
      B.elevador([['portaria', 'TÉRREO'], ['corredor', '3º ANDAR'], ['garagem', 'GARAGEM']]);
      return B.registrar();
    }
  });
  M.conjunto({
    id: 'abandonado', nome: 'Prédio abandonado', grupo: 'Conjuntos',
    descricao: 'Beco → térreo abandonado → escadaria → andar de cima; o buraco na parede leva a um depósito esquecido.',
    criar(opcoes = {}) {
      const B = construtor({desgaste: opcoes.desgaste ?? 3});
      B.cena('beco', 'beco', {nome: 'Beco sem saída', desgaste: 3});
      B.cena('terreo', 'predio_abandonado', {nome: 'Prédio abandonado · Térreo'});
      B.cena('escadaria', 'escadaria', {nome: 'Escadaria em ruínas', desgaste: 3, andar: 1});
      B.cena('cima', 'predio_abandonado', {nome: 'Prédio abandonado · 1º andar'});
      B.cena('deposito', 'deposito', {nome: 'Depósito esquecido', desgaste: 3});
      B.ligar('beco', 'servico2', 'terreo', 'entrada');
      B.ligar('terreo', 'escada_sobe', 'escadaria', 'andar');
      B.ligar('escadaria', 'escada_sobe', 'cima', 'entrada');
      B.ligar('terreo', 'buraco', 'deposito', 'entrada');
      return B.registrar();
    }
  });
  const K = root.PixelKit;
  M.criarConjunto = (id, opcoes) => { const c = M.conjuntoDef(id); if (!c) throw new Error(`Conjunto desconhecido: ${id}`); const lista = c.criar(opcoes || {}); M.emit('conjunto', id); return lista; };
})(typeof window !== 'undefined' ? window : globalThis);
