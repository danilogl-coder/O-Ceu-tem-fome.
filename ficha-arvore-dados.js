/* Catálogo de perícias: apresentação e descrições. Regras em ficha-grafo.js. */
(function(root){
  'use strict';
  const TIPOS=[['grau','Grau de perícia','redonda',96,1,'Um ponto compra um grau de treinamento.']];
  const REGIOES=[
    ['csm','COSMO','CONHECIMENTO E PERCEPÇÃO','csm','csm','Conhecer o mundo, compreender seus sinais e encontrar respostas.',''],
    ['sbt','SUBSTÂNCIA','DESTREZA E VIGOR','sbt','sbt','Mover-se com precisão e agir no instante certo.',''],
    ['mqn','MÁQUINA','FORÇA E CONSTITUIÇÃO','mqn','mqn','Sustentar o esforço, resistir e enfrentar.',''],
    ['sns','SENSO','CARISMA E VONTADE','sns','sns','Entender pessoas, expressar intenções e manter a própria convicção.','']
  ];
  const DESCRICOES={
    atualidades:'Acompanhar acontecimentos, reconhecer figuras públicas e relacionar notícias com o que está acontecendo agora.',
    ciencias:'Aplicar o método científico, interpretar fenômenos e reconhecer princípios da física, química e biologia.',
    investigacao:'Examinar pistas, confrontar versões e reconstruir acontecimentos a partir de evidências.',
    medicina:'Reconhecer lesões e sintomas, prestar primeiros socorros e compreender tratamentos.',
    ocultismo:'Interpretar símbolos, rituais e conhecimentos proibidos ligados ao sobrenatural.',
    percepcao:'Notar detalhes, sons, movimentos e sinais que passam despercebidos.',
    profissao:'Aplicar conhecimentos de um ofício, reconhecer ferramentas e executar tarefas especializadas.',
    sobrevivencia:'Encontrar abrigo, água e alimento, reconhecer rastros e enfrentar ambientes hostis.',
    tatica:'Analisar o terreno, antecipar movimentos e planejar posicionamentos e rotas.',
    tecnologia:'Operar computadores, compreender sistemas eletrônicos e diagnosticar falhas técnicas.',
    adestramento:'Interpretar o comportamento animal, acalmar e ensinar comandos.',
    artes:'Criar, interpretar e reconhecer expressões artísticas com técnica e sensibilidade.',
    diplomacia:'Negociar, mediar conflitos e construir acordos entre interesses diferentes.',
    enganacao:'Sustentar disfarces e mentiras, desviar suspeitas e ocultar intenções.',
    intimidacao:'Impor presença e pressionar alguém por meio de postura, palavras e ameaça.',
    intuicao:'Ler intenções, perceber contradições e reconhecer quando algo não parece certo.',
    religiao:'Conhecer crenças, tradições, símbolos e práticas religiosas.',
    vontade:'Manter a determinação e resistir ao medo, à pressão e à influência alheia.',
    acrobacia:'Executar saltos, rolamentos e movimentos que exigem equilíbrio e controle corporal.',
    crime:'Manipular fechaduras e mecanismos de segurança com ferramentas e precisão.',
    furtividade:'Mover-se sem chamar atenção, aproveitar coberturas e permanecer escondido.',
    iniciativa:'Reconhecer uma abertura e agir antes que a situação se feche.',
    pilotagem:'Conduzir veículos, controlar manobras e reagir às condições do percurso.',
    pontaria:'Alinhar um disparo, calcular distância e atingir um alvo com precisão.',
    reflexos:'Reagir rapidamente, interceptar movimentos e evitar perigos imediatos.',
    atletismo:'Correr, saltar, escalar e sustentar esforços físicos intensos.',
    fortitude:'Resistir à exaustão, ao impacto e às condições que desafiam o corpo.',
    luta:'Aplicar golpes, bloqueios e técnicas de combate corpo a corpo.'
  };
  const api={TIPOS,REGIOES,DESCRICOES};
  root.FichaArvoreDados=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
