/* A ficha de "O Céu tem Fome" — o modelo, sem desenho nenhum.

   Cinco atributos de 0 a 7, comprados com 4 pontos sobre uma base de 1 cada
   (deixar um atributo em 0 devolve o ponto da base — é assim que o jogador
   "pega 1 ponto" sacrificando uma parte de si). O pico é 7.

     TAUMATURGIA · a arte de realizar milagres — e o preço deles
     COSMO       · inteligência e percepção
     SENSO       · carisma e vontade
     SUBSTÂNCIA  · destreza e vigor
     MÁQUINA     · força e constituição

   Resolução em d20: cada ponto do atributo tira 1 da dificuldade do teste.
   A dificuldade base é do mestre (padrão 14: atributo 0 acerta 35%, atributo
   7 acerta 70% — ninguém fica seguro, ninguém fica inútil). O resultado é
   sorteado AQUI, inteiro, antes de qualquer animação: a animação é
   apresentação, não mecânica, e por isso pode ser pulada sem trapaça.

   VITALIDADE nasce de SUBSTÂNCIA (o vigor) e conversa com o sistema de
   saúde por região do corpo: a ficha não duplica o corpo, ela o resume.

   SANIDADE é uma vela de 6 pontos. Quando apaga, o personagem não morre:
   ganha uma MARCA permanente, o teto da vela cai 1 para sempre e ela
   reacende pela metade. Milagre cobra dos dois lados — um ponto de vela
   agora e um ponto de CORRUPÇÃO para sempre. A corrupção é o que faz a
   ficha glitchar, e acima de certo ponto ela mente para quem olha. */
(function (root) {
  'use strict';

  /* O catálogo, o grafo e a planta moram em arquivos separados de
     propósito: o mestre acrescenta nódulo mexendo só no catálogo. */
  const pega = (glob, arq) => root[glob] ||
    (typeof require !== 'undefined' ? require(arq) : null);
  const DADOS = pega('FichaArvoreDados', './ficha-arvore-dados.js');
  const GRAFO_API = pega('FichaGrafo', './ficha-grafo.js');
  const PLANTA = pega('FichaPlanta', './ficha-planta.js');

  /* [id, nome, sigla, o que é, rampa de cor do PixelKit] */
  const ATRIBUTOS = [
    ['tmg', 'TAUMATURGIA', 'TMG', 'ARTE DE REALIZAR MILAGRES', 'roxo'],
    ['csm', 'COSMO', 'CSM', 'INTELIGÊNCIA E PERCEPÇÃO', 'agua'],
    ['sns', 'SENSO', 'SNS', 'CARISMA E VONTADE', 'vermelho'],
    ['sbt', 'SUBSTÂNCIA', 'SBT', 'DESTREZA E VIGOR', 'folha'],
    ['mqn', 'MÁQUINA', 'MQN', 'FORÇA E CONSTITUIÇÃO', 'latao']
  ];
  /* As 28 perícias, reagrupadas nos atributos novos. TAUMATURGIA não tem
     perícia: quem faz milagre não treina, paga. */
  const PERICIAS = [
    ['atualidades', 'Atualidades', 'csm'], ['ciencias', 'Ciências', 'csm'],
    ['investigacao', 'Investigação', 'csm'], ['medicina', 'Medicina', 'csm'],
    ['ocultismo', 'Ocultismo', 'csm'], ['percepcao', 'Percepção', 'csm'],
    ['profissao', 'Profissão', 'csm'], ['sobrevivencia', 'Sobrevivência', 'csm'],
    ['tatica', 'Tática', 'csm'], ['tecnologia', 'Tecnologia', 'csm'],
    ['adestramento', 'Adestramento', 'sns'], ['artes', 'Artes', 'sns'],
    ['diplomacia', 'Diplomacia', 'sns'], ['enganacao', 'Enganação', 'sns'],
    ['intimidacao', 'Intimidação', 'sns'], ['intuicao', 'Intuição', 'sns'],
    ['religiao', 'Religião', 'sns'], ['vontade', 'Vontade', 'sns'],
    ['acrobacia', 'Acrobacia', 'sbt'], ['crime', 'Crime', 'sbt'],
    ['furtividade', 'Furtividade', 'sbt'], ['iniciativa', 'Iniciativa', 'sbt'],
    ['pilotagem', 'Pilotagem', 'sbt'], ['pontaria', 'Pontaria', 'sbt'],
    ['reflexos', 'Reflexos', 'sbt'],
    ['atletismo', 'Atletismo', 'mqn'], ['fortitude', 'Fortitude', 'mqn'],
    ['luta', 'Luta', 'mqn']
  ];
  /* Grau de treino: nome e o quanto ainda tira da dificuldade no futuro. */
  const GRAUS = [['Destreinada', 0], ['Treinada', 1], ['Veterana', 2], ['Expert', 3]];

  /* --------------------------------------------------------- a árvore
     A planta mora em `ficha-planta.js` e o catálogo em
     `ficha-arvore-dados.js`. Aqui fica só o que depende do PERSONAGEM: o
     que está tomado, o que dá para pegar, e por que o resto não dá.

     A separação não é arrumação: o catálogo é o único arquivo que o mestre
     precisa abrir para inventar nódulo, e ele não tem uma linha de regra
     nem de desenho dentro. */
  const GRAFO = PLANTA && GRAFO_API ? GRAFO_API.monta(PERICIAS) : {nos: [], arestas: [], porId: new Map()};
  let PLANTA_CACHE = null;
  function layoutArvore() {
    if (!PLANTA_CACHE) PLANTA_CACHE = PLANTA.layoutArvore(PERICIAS, GRAFO);
    return PLANTA_CACHE;
  }

  /* O que fica quando a vela apaga. Nunca some da ficha. */
  const MARCAS = [
    ['boca', 'A BOCA QUE NÃO FECHA', 'Você fala dormindo. Nem sempre é você.'],
    ['dentes', 'OS DENTES CONTADOS', 'Conta os próprios dentes sem perceber. Nunca dá o mesmo número.'],
    ['nome', 'O NOME ESQUECIDO', 'Esqueceu o nome de alguém que te amava. O rosto ficou.'],
    ['mao', 'A MÃO QUE OBEDECE OUTRO', 'Uma das mãos às vezes termina o gesto sozinha.'],
    ['ceu', 'O CÉU OLHANDO DE VOLTA', 'Não consegue mais ficar sob céu aberto sem se encolher.'],
    ['fome', 'A FOME QUE NÃO É SUA', 'Sente fome na hora errada, de coisa que não se come.'],
    ['espelho', 'O ATRASO NO ESPELHO', 'O reflexo demora um instante a mais para copiar você.'],
    ['numero', 'O NÚMERO NA NUCA', 'Sabe, sem contar, quantas pessoas estão atrás de você.']
  ];

  const ATR_MAX = 7, ATR_BASE = 1, PONTOS = 4, GRAU_MAX = GRAUS.length - 1;
  /* A bolsa de pontos da árvore de perícias. Cada nódulo custa 1, e uma
     perícia inteira sai por 3 — com 10 dá para fechar três perícias e ainda
     sobrar uma. É a mesa que decide: o mestre mexe nesse número. */
  const PP_PADRAO = 18, PP_MIN = 0, PP_MAX = 160;
  const VELA_MAX = 6, CORRUPCAO_MAX = 20, FICHAS_MAX = 12;
  const TEXTO = {personagem: 26, jogador: 26, origem: 34, palavra: 18, descricao: 620};
  const CD_MIN = 6, CD_MAX = 20, CD_PADRAO = 14;
  const STORE = 'ficha.v2';

  const inteiro = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
  const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);

  function fichaNova(n = 1) {
    const atributos = {};
    for (const [id] of ATRIBUTOS) atributos[id] = ATR_BASE;
    return {
      id: 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      personagem: '', jogador: '', origem: '', descricao: '', palavra: '',
      atributos, pericias: {}, arvore: [], emCena: n === 1,
      vela: VELA_MAX, marcas: [], corrupcao: 0, criadaEm: Date.now()
    };
  }
  /* Uma ficha que veio de fora (arquivo, código colado, sessão antiga) passa
     por aqui antes de entrar na mesa: nada de lixo, nada fora dos limites. */
  function validar(f, n = 1) {
    const base = fichaNova(n);
    if (!f || typeof f !== 'object') return base;
    if (typeof f.id === 'string' && /^[\w-]{2,40}$/.test(f.id)) base.id = f.id;
    for (const campo of ['personagem', 'jogador', 'origem', 'descricao', 'palavra']) base[campo] = texto(f[campo], TEXTO[campo]);
    if (!base.personagem && f.nome) base.personagem = texto(f.nome, TEXTO.personagem);   // fichas da versão antiga
    base.emCena = !!f.emCena;
    for (const [id] of ATRIBUTOS) base.atributos[id] = inteiro(f.atributos?.[id] ?? ATR_BASE, 0, ATR_MAX);
    for (const [id] of PERICIAS) {
      const g = inteiro(f.pericias?.[id] ?? 0, 0, GRAU_MAX);
      if (g > 0) base.pericias[id] = g;
    }
    // Migração idempotente: só pericias guarda progresso. Compras antigas
    // deixam de contar no gasto; ppBase não aumenta e nenhum grau é perdido.
    base.arvore = [];
    base.marcas = (Array.isArray(f.marcas) ? f.marcas : []).filter(m => MARCAS.some(x => x[0] === m)).slice(0, MARCAS.length);
    base.corrupcao = inteiro(f.corrupcao ?? 0, 0, CORRUPCAO_MAX);
    base.vela = inteiro(f.vela ?? VELA_MAX, 0, Math.max(1, VELA_MAX - base.marcas.length));
    if (Number.isFinite(f.criadaEm)) base.criadaEm = f.criadaEm;
    return base;
  }

  class FichaSystem {
    constructor({armazenar = true} = {}) {
      this.fichas = [fichaNova(1)];
      this.ativa = 0;
      this.cdBase = CD_PADRAO;          // a dificuldade base é do mestre
      this.ppBase = PP_PADRAO;          // e a bolsa da árvore também
      this.listeners = new Set();
      this.saveTimer = null;
      this.armazenar = armazenar;
      this.ultimaRolagem = null;
      this.revisao = 0;
      if (armazenar) this.restaurar();
    }

    /* ------------------------------------------------------------ catálogo */
    get atributos() { return ATRIBUTOS; }
    get pericias() { return PERICIAS; }
    get graus() { return GRAUS; }
    get marcasPossiveis() { return MARCAS; }
    atributo(id) { return ATRIBUTOS.find(a => a[0] === id) || null; }
    pericia(id) { return PERICIAS.find(p => p[0] === id) || null; }
    porAtributo(atr) { return PERICIAS.filter(p => p[2] === atr); }
    marca(id) { return MARCAS.find(m => m[0] === id) || null; }
    nomeDoGrau(g) { return (GRAUS[inteiro(g, 0, GRAU_MAX)] || GRAUS[0])[0]; }
    bonusDoGrau(g) { return (GRAUS[inteiro(g, 0, GRAU_MAX)] || GRAUS[0])[1]; }

    /* -------------------------------------------------------------- fichas */
    atual() { return this.fichas[this.ativa]; }
    de(id) { return this.fichas.find(f => f.id === id) || null; }
    emCena() { return this.fichas.find(f => f.emCena) || null; }
    criar(nome = '') {
      if (this.fichas.length >= FICHAS_MAX) return null;
      const f = fichaNova(this.fichas.length + 1);
      f.emCena = false;
      if (nome) f.personagem = texto(nome, TEXTO.personagem);
      this.fichas.push(f);
      this.ativa = this.fichas.length - 1;
      this.mudou('criar');
      return f;
    }
    remover(id = this.atual()?.id) {
      if (this.fichas.length <= 1) return false;
      const i = this.fichas.findIndex(f => f.id === id);
      if (i < 0) return false;
      const eraEmCena = this.fichas[i].emCena;
      this.fichas.splice(i, 1);
      this.ativa = Math.min(this.ativa > i ? this.ativa - 1 : this.ativa, this.fichas.length - 1);
      if (eraEmCena) this.fichas[0].emCena = true;
      this.mudou('remover');
      return true;
    }
    selecionar(i) {
      const n = this.fichas.length;
      this.ativa = ((Math.round(i) % n) + n) % n;
      this.mudou('folhear');
      return this.atual();
    }
    folhear(d) { return this.selecionar(this.ativa + (d < 0 ? -1 : 1)); }
    porEmCena(id = this.atual()?.id) {
      for (const f of this.fichas) f.emCena = f.id === id;
      this.mudou('emcena');
    }
    /* Uma ficha que chegou de fora (do jogador) entra ou atualiza a que já
       existe com o mesmo id — é assim que o código colado vira ficha. */
    receber(dados) {
      const f = validar(dados, this.fichas.length + 1);
      f.emCena = false;
      const i = this.fichas.findIndex(x => x.id === f.id);
      if (i >= 0) { f.emCena = this.fichas[i].emCena; this.fichas[i] = f; this.ativa = i; this.mudou('receber'); return {ficha: f, novo: false}; }
      if (this.fichas.length >= FICHAS_MAX) return null;
      this.fichas.push(f);
      this.ativa = this.fichas.length - 1;
      this.mudou('receber');
      return {ficha: f, novo: true};
    }

    /* -------------------------------------------------------------- escrita */
    limiteDe(campo) { return TEXTO[campo] || 0; }
    escrever(campo, valor, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f || !(campo in TEXTO)) return false;
      f[campo] = texto(valor, TEXTO[campo]);
      this.mudou('escrever');
      return true;
    }
    nomeVisivel(f = this.atual()) { return (f?.personagem || '').trim() || 'SEM NOME'; }

    /* ----------------------------------------------------------- atributos */
    valorDe(atr, id = this.atual()?.id) { const f = this.de(id); return f ? inteiro(f.atributos[atr] ?? 0, 0, ATR_MAX) : 0; }
    /* Base 1 em cada um; o que passa disso é ponto gasto, o que falta para 1
       é ponto devolvido. Por isso zerar um atributo devolve exatamente 1. */
    gastos(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return 0;
      return ATRIBUTOS.reduce((n, [a]) => n + (f.atributos[a] ?? 0), 0) - ATR_BASE * ATRIBUTOS.length;
    }
    pontosRestantes(id) { return PONTOS - this.gastos(id); }
    get pontosTotais() { return PONTOS; }
    podeSubir(atr, id) { return this.valorDe(atr, id) < ATR_MAX && this.pontosRestantes(id) > 0; }
    podeDescer(atr, id) { return this.valorDe(atr, id) > 0; }
    definirAtributo(atr, valor, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f || !this.atributo(atr)) return 0;
      const alvo = inteiro(valor, 0, ATR_MAX), antes = f.atributos[atr];
      f.atributos[atr] = alvo;
      if (this.gastos(id) > PONTOS) { f.atributos[atr] = antes; return antes; }  // sem saldo, nada muda
      this.mudou('atributo');
      return alvo;
    }
    ajustarAtributo(atr, d, id) { return this.definirAtributo(atr, this.valorDe(atr, id) + d, id); }
    /* Tudo de volta à base, saldo cheio. */
    zerarPontos(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return;
      for (const [a] of ATRIBUTOS) f.atributos[a] = ATR_BASE;
      this.mudou('atributo');
    }

    /* ------------------------------------------------------------ perícias */
    grauDe(p, id = this.atual()?.id) { const f = this.de(id); return f ? inteiro(f.pericias[p] ?? 0, 0, GRAU_MAX) : 0; }
    definirGrau(p, g, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f || !this.pericia(p)) return 0;
      const v = inteiro(g, 0, GRAU_MAX);
      if (v > 0) f.pericias[p] = v; else delete f.pericias[p];
      this.mudou('pericia');
      return v;
    }
    cicloPericia(p, id) { return this.definirGrau(p, (this.grauDe(p, id) + 1) % (GRAU_MAX + 1), id); }
    treinadas(id = this.atual()?.id) { const f = this.de(id); return f ? Object.keys(f.pericias).length : 0; }

    /* Árvore de perícias: um ponto por grau, três graus independentes por
       perícia. Os identificadores grau:<pericia>:<nivel> continuam estáveis. */
    get pontosPericiaBase() { return this.ppBase; }
    set pontosPericiaBase(v) { this.ppBase = inteiro(v, PP_MIN, PP_MAX); this.mudou('config'); }
    get grafo() { return GRAFO; }
    get tiposDeNodulo() { return DADOS ? DADOS.TIPOS : []; }
    get regioesDaArvore() { return DADOS ? DADOS.REGIOES : []; }
    nodulo(no) { return GRAFO.porId.get(no) || null; }
    /* O nódulo de um grau, e o grau de um nódulo: a ponte entre a página
       de perícias (que fala em grau) e a árvore (que fala em nódulo). */
    noDoGrau(p, n) { return `grau:${p}:${inteiro(n, 1, GRAU_MAX)}`; }

    tomado(no, id = this.atual()?.id) {
      const n = GRAFO.porId.get(no);
      if (!n) return false;
      if (n.tipo === 'grau') return this.grauDe(n.pericia, id) >= n.nivel;
      const f = this.de(id);
      return !!f && Array.isArray(f.arvore) && f.arvore.indexOf(no) >= 0;
    }
    tomados(id = this.atual()?.id) {
      const fora = new Set();
      for (const n of GRAFO.nos) if (this.tomado(n.id, id)) fora.add(n.id);
      return fora;
    }
    gastoArvore(id = this.atual()?.id) {
      let n = 0;
      for (const no of GRAFO.nos) if (this.tomado(no.id, id)) n += no.custo;
      return n;
    }
    pontosArvore(id) { return Math.max(0, this.ppBase - this.gastoArvore(id)); }
    gastoNaRegiao(reg, id = this.atual()?.id) {
      let n = 0;
      for (const no of GRAFO.nos)
        if (no.regiao === reg && this.tomado(no.id, id)) n += no.custo;
      return n;
    }
    /* Quanto foi investido FORA de um Arquétipo. É o requisito que
       obriga a Queda a ter passaporte: ninguém desanda um princípio
       inteiro sem ter atravessado o mundo pelo menos uma vez. */
    gastoFora(reg, id = this.atual()?.id) {
      let n = 0;
      for (const no of GRAFO.nos)
        if (no.regiao !== reg && this.tomado(no.id, id)) n += no.custo;
      return n;
    }

    /* A LISTA DE REQUISITOS, que é o coração da interface: cada linha sabe
       se passou, o que pede e quanto falta. Nódulo trancado que não diz o
       motivo é só um botão apagado. */
    requisitosDe(no, id = this.atual()?.id) {
      const n = GRAFO.porId.get(no);
      if (!n) return [];
      const fora = [];
      const R = n.req || {};
      if (n.de.length) {
        const pais = n.de.map(p => GRAFO.porId.get(p)).filter(Boolean);
        const tem = pais.filter(p => this.tomado(p.id, id));
        const todos = n.modo === 'todos';
        fora.push({tipo: 'de', ok: todos ? tem.length === pais.length : tem.length > 0,
          txt: pais.length === 1 ? pais[0].nome
            : (todos ? pais.map(p => p.nome).join(' e ') : pais.map(p => p.nome).join(' ou ')),
          rotulo: pais.length === 1 ? 'Vem de' : (todos ? 'Vem de todos' : 'Vem de um destes')});
      }
      for (const a in (R.atr || {})) {
        const alvo = R.atr[a], tenho = this.valorDe(a, id), nome = (this.atributo(a) || [, a])[1];
        fora.push({tipo: 'atr', ok: tenho >= alvo, rotulo: 'Atributo',
          txt: `${nome} ${alvo}`, tenho, alvo});
      }
      for (const r in (R.gasto || {})) {
        const alvo = R.gasto[r], tenho = this.gastoNaRegiao(r, id);
        const nome = (DADOS.REGIOES.find(x => x[0] === r) || [, r])[1];
        fora.push({tipo: 'gasto', ok: tenho >= alvo, rotulo: 'Investido',
          txt: `${alvo} em ${nome}`, tenho, alvo});
      }
      if (R.fora) {
        const tenho = this.gastoFora(n.regiao, id);
        const nome = (DADOS.REGIOES.find(x => x[0] === n.regiao) || [, n.regiao])[1];
        fora.push({tipo: 'fora', ok: tenho >= R.fora, rotulo: 'E fora',
          txt: `${R.fora} fora de ${nome}`, tenho, alvo: R.fora});
      }
      for (const p in (R.grau || {})) {
        const alvo = R.grau[p], tenho = this.grauDe(p, id);
        const nome = (this.pericia(p) || [, p])[1];
        fora.push({tipo: 'grau', ok: tenho >= alvo, rotulo: 'Treino',
          txt: `${nome} ${'I'.repeat(alvo)}`, tenho, alvo});
      }
      /* As exclusões viram UMA linha só quando são muitas. Uma Queda
         fecha as outras cinco, e cinco linhas dizendo "Fecha" empurrariam
         o requisito que realmente falta para fora do painel — e o
         requisito que falta é a única informação que muda a decisão. */
      const barras = (R.sem || []).map(b => GRAFO.porId.get(b)).filter(Boolean);
      const tomadas = barras.filter(o => this.tomado(o.id, id));
      if (barras.length === 1)
        fora.push({tipo: 'sem', ok: !tomadas.length, rotulo: 'Fecha', txt: barras[0].nome});
      else if (barras.length > 1)
        fora.push({tipo: 'sem', ok: !tomadas.length, rotulo: tomadas.length ? 'Fechada por' : 'Fecha',
          txt: tomadas.length ? tomadas.map(o => o.nome).join(', ')
            : `as outras ${barras.length}`, barras: barras.map(o => o.id)});
      return fora;
    }
    /* O estado de um nódulo, nas quatro palavras que o desenho conhece. */
    estadoDe(no, id = this.atual()?.id) {
      if (!this.nodulo(no)) return 'trancado';
      if (this.tomado(no, id)) return 'tomado';
      const reqs = this.requisitosDe(no, id);
      if (reqs.some(r => r.tipo === 'sem' && !r.ok)) return 'barrado';
      return reqs.every(r => r.ok) && this.pontosArvore(id) >= (this.nodulo(no)?.custo || 1)
        ? 'livre' : 'trancado';
    }
    /* Por que está trancado — a primeira linha que falhou, para quem só
       tem espaço para uma frase. `null` quer dizer que dá para pegar. */
    motivoDe(no, id = this.atual()?.id) {
      if (!this.nodulo(no)) return 'perícia inexistente';
      if (this.tomado(no, id)) return null;
      const falha = this.requisitosDe(no, id).find(r => !r.ok);
      if (falha) return falha.tipo === 'sem' ? `fechado por ${falha.txt}` : `falta ${falha.txt}`;
      if (this.pontosArvore(id) < (this.nodulo(no)?.custo || 1)) return 'sem pontos';
      return null;
    }
    podeComprar(no, id) { return this.estadoDe(no, id) === 'livre'; }
    comprar(no, id = this.atual()?.id) {
      if (!this.podeComprar(no, id)) return false;
      const n = GRAFO.porId.get(no), f = this.de(id);
      if (!n || !f) return false;
      if (n.tipo === 'grau') { this.definirGrau(n.pericia, n.nivel, id); return true; }
      if (!Array.isArray(f.arvore)) f.arvore = [];
      f.arvore.push(no);
      this.mudou('pericia');
      return true;
    }
    /* Quem cairia junto se este nódulo saísse. Grim Dawn trava e não
       explica, e é a reclamação mais repetida sobre o sistema dele: aqui a
       cascata é mostrada ANTES de confirmar. */
    dependentesDe(no, id = this.atual()?.id) {
      const n = this.nodulo(no);
      if (!n || !this.tomado(no, id)) return [];
      return GRAFO.nos.filter(o => o.pericia === n.pericia && o.nivel > n.nivel && this.tomado(o.id, id)).map(o => o.id);
    }
    /* O requisito de um nódulo contra um conjunto de tomados hipotético.
       É o mesmo teste de `requisitosDe`, sem o custo e sem o texto. */
    valeCom(n, tomados, id) {
      const R = n.req || {};
      if (n.de.length) {
        const pais = n.de.filter(p => GRAFO.porId.has(p));
        const tem = pais.filter(p => tomados.has(p));
        if (n.modo === 'todos' ? tem.length < pais.length : tem.length === 0) return false;
      }
      for (const a in (R.atr || {})) if (this.valorDe(a, id) < R.atr[a]) return false;
      for (const p in (R.grau || {})) if (this.grauDe(p, id) < R.grau[p]) return false;
      for (const barra of (R.sem || [])) if (tomados.has(barra)) return false;
      for (const r in (R.gasto || {})) {
        let n2 = 0;
        for (const o of GRAFO.nos) if (o.regiao === r && tomados.has(o.id)) n2 += o.custo;
        if (n2 < R.gasto[r]) return false;
      }
      if (R.fora) {
        let n2 = 0;
        for (const o of GRAFO.nos) if (o.regiao !== n.regiao && tomados.has(o.id)) n2 += o.custo;
        if (n2 < R.fora) return false;
      }
      return true;
    }
    /* Devolver leva junto quem dependia. Nada de travar sem explicar: quem
       chama recebe a lista do que caiu. */
    devolver(no, id = this.atual()?.id) {
      if (!this.tomado(no, id)) return null;
      const junto = this.dependentesDe(no, id);
      for (const q of [no, ...junto]) this.soltar(q, id);
      this.mudou('pericia');
      return junto;
    }
    soltar(no, id) {
      const n = GRAFO.porId.get(no), f = this.de(id);
      if (!n || !f) return;
      if (n.tipo === 'grau') {
        const g = this.grauDe(n.pericia, id);
        if (g >= n.nivel) {
          const v = n.nivel - 1;
          if (v > 0) f.pericias[n.pericia] = v; else delete f.pericias[n.pericia];
        }
        return;
      }
      if (Array.isArray(f.arvore)) f.arvore = f.arvore.filter(x => x !== no);
    }
    /* O caminho mais barato até um nódulo ainda trancado, contando só o
       que falta comprar. É o que a tela realça antes de a pessoa gastar. */
    caminhoAte(no, id = this.atual()?.id) {
      const alvo = GRAFO.porId.get(no);
      if (!alvo || this.tomado(no, id)) return [];
      const visto = new Map();
      const anda = q => {
        if (visto.has(q)) return visto.get(q);
        visto.set(q, null);                      // corta ciclo
        const n = GRAFO.porId.get(q);
        if (!n) return null;
        if (this.tomado(q, id)) { visto.set(q, []); return []; }
        let melhor = [];
        if (n.de.length) {
          const rotas = n.de.map(p => anda(p)).filter(Boolean);
          if (!rotas.length) { visto.set(q, null); return null; }
          melhor = n.modo === 'todos'
            ? [...new Set(rotas.flat())]
            : rotas.reduce((a, b) => (a.length <= b.length ? a : b));
        }
        const rota = [...melhor, q];
        visto.set(q, rota);
        return rota;
      };
      const cadeia = anda(no);
      if (!cadeia) return null;
      /* O caminho não é só a corrente de pais: um nódulo que pede GASTO
         numa região também precisa desse gasto acontecer. Sem isto o
         painel prometia "custa 3 pontos" para um nódulo que na verdade
         custava oito, e promessa de preço errada é pior que nenhuma. */
      return this.completarGasto(cadeia, no, id);
    }
    completarGasto(cadeia, no, id) {
      const alvo = GRAFO.porId.get(no);
      const pede = (alvo && alvo.req && alvo.req.gasto) || null;
      const foraPede = (alvo && alvo.req && alvo.req.fora) || 0;
      if (!pede && !foraPede) return cadeia;
      const rota = cadeia.slice();
      /* O alvo fica FORA do conjunto enquanto se procura o que falta: ele
         ainda não foi comprado, e contá-lo faria o gasto que ele mesmo
         exige parecer já satisfeito — e faria a rota escolher um nódulo
         que só abriria depois dele. */
      const set = new Set([...this.tomados(id), ...rota]);
      set.delete(no);
      /* O próprio alvo não conta para o gasto que ele exige: quando ele
         for comprado, o requisito já vai ter sido conferido sem ele. */
      const gastoEm = reg => GRAFO.nos.reduce((n, o) =>
        n + (o.regiao === reg && o.id !== no && set.has(o.id) ? o.custo : 0), 0);
      for (const reg in (pede || {})) {
        let voltas = 0;
        while (gastoEm(reg) < pede[reg] && voltas++ < 60) {
          /* O mais barato que dá para pegar agora naquela região, e entre
             os empatados o que estiver mais perto do começo do catálogo:
             assim a rota é a mesma toda vez que se olha para ela. */
          const cand = GRAFO.nos.filter(o => o.regiao === reg && !set.has(o.id) &&
            o.id !== no && this.valeCom(o, set, id));
          if (!cand.length) break;
          cand.sort((a, b) => a.custo - b.custo);
          set.add(cand[0].id); rota.splice(rota.length - 1, 0, cand[0].id);
        }
      }
      /* E o que tem que ser investido FORA do Arquétipo. É o que faz o
         painel prometer o preço certo de uma Queda: sem isto ele dizia
         "custa 8" para um nódulo que custava doze. */
      if (foraPede) {
        const foraDe = () => GRAFO.nos.reduce((n, o) =>
          n + (o.regiao !== alvo.regiao && o.id !== no && set.has(o.id) ? o.custo : 0), 0);
        let voltas = 0;
        while (foraDe() < foraPede && voltas++ < 60) {
          const cand = GRAFO.nos.filter(o => o.regiao !== alvo.regiao && !set.has(o.id) &&
            o.id !== no && this.valeCom(o, set, id));
          if (!cand.length) break;
          cand.sort((a, b) => a.custo - b.custo);
          set.add(cand[0].id); rota.splice(rota.length - 1, 0, cand[0].id);
        }
      }
      return rota;
    }
    zerarArvore(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return false;
      f.pericias = {}; f.arvore = [];
      this.mudou('pericia');
      return true;
    }

    /* ----------------------------------------------- compatibilidade
       A página de perícias continua falando em perícia e grau. Estas
       quatro conversam com ela sem que ela precise saber de nódulo. */
    gastoPericias(id) { return this.gastoArvore(id); }
    pontosPericia(id) { return this.pontosArvore(id); }
    travaDe(p, nivel, id = this.atual()?.id) {
      const n = inteiro(nivel, 1, GRAU_MAX);
      if (n <= this.grauDe(p, id)) return null;
      return this.motivoDe(this.noDoGrau(p, n), id) || null;
    }
    proximoNodulo(p, id = this.atual()?.id) {
      const g = this.grauDe(p, id);
      return g < GRAU_MAX && this.podeComprar(this.noDoGrau(p, g + 1), id) ? g + 1 : 0;
    }
    destravar(p, id = this.atual()?.id) {
      const g = this.grauDe(p, id);
      return g < GRAU_MAX && this.comprar(this.noDoGrau(p, g + 1), id);
    }
    zerarPericias(id) { return this.zerarArvore(id); }

    /* Baixar um atributo pode deixar nódulo pendurado no que o tronco já
       não aguenta. Em vez de proibir, a árvore PODA: derruba o que ficou
       sem requisito, em cascata, e devolve quantos pontos voltaram. */
    podar(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return 0;
      let podados = 0, mexeu = true;
      while (mexeu) {
        mexeu = false;
        const agora = this.tomados(id);
        for (const n of GRAFO.nos) {
          if (!agora.has(n.id)) continue;
          if (this.valeCom(n, agora, id)) continue;
          this.soltar(n.id, id); podados += n.custo; mexeu = true;
        }
      }
      if (podados) this.mudou('pericia');
      return podados;
    }
    /* ----------------------------------------------------------- vitalidade */
    /* O vigor mora em SUBSTÂNCIA: é ele que diz quanta vida o corpo tem. */
    vitalidadeMax(id) { return 10 + this.valorDe('sbt', id) * 2; }
    /* A saúde do jogo é percentual por região; aqui ela vira um número de
       ficha sem deixar de ser o mesmo corpo. */
    vitalidade(saude, id) {
      const max = this.vitalidadeMax(id);
      const pct = saude && Number.isFinite(saude.vitality) ? saude.vitality : 100;
      return {max, atual: Math.max(0, Math.round(max * Math.max(0, Math.min(100, pct)) / 100)), pct};
    }
    /* O quanto cada região do corpo aguenta por causa do vigor. Dois pontos
       fixam a régua, e os dois foram escolhidos na mesa: o PADRÃO e o PICO.

         SBT 1 — o ponto que todo mundo tem de graça — é o corpo inteiro, 100%.
         SBT 7 — o pico do atributo — fecha em 300%: o triplo.

       Entre eles a reta sobe um terço por ponto, e ela segue para baixo até o
       único ponto abaixo do padrão: quem ZERA SUBSTÂNCIA para comprar outra
       coisa fica com 67% de corpo — o sacrifício custa um terço de si.

         0 → 67%   1 → 100%   2 → 133%   3 → 167%
         4 → 200%  5 → 233%   6 → 267%   7 → 300%

       Isto muda o TETO, não a saúde: um personagem de 300 inteiro está tão
       sadio quanto um de 100 inteiro — ele só tem três vezes mais o que
       perder. Quem aplica é a ponte do jogo (`aplicarVigor`, em app.js). */
    resistenciaDoCorpo(id) { return 1 + (this.valorDe('sbt', id) - 1) / 3; }

    /* -------------------------------------------------------------- vela */
    tetoVela(id = this.atual()?.id) { const f = this.de(id); return f ? Math.max(1, VELA_MAX - f.marcas.length) : VELA_MAX; }
    vela(id = this.atual()?.id) { const f = this.de(id); return f ? inteiro(f.vela, 0, this.tetoVela(id)) : 0; }
    get velaMax() { return VELA_MAX; }
    /* Quatro estágios de chama: alta, média, bruxuleando, fumaça. */
    estagioDaChama(id) {
      const teto = this.tetoVela(id), v = this.vela(id);
      if (v <= 0) return 3;
      const p = v / teto;
      return p > .66 ? 0 : p > .33 ? 1 : 2;
    }
    definirVela(v, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return 0;
      f.vela = inteiro(v, 0, this.tetoVela(id));
      this.mudou('vela');
      return f.vela;
    }
    /* Perder sanidade. Se a vela apagar, o personagem não cai: ele muda. */
    abalar(n = 1, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return null;
      f.vela = Math.max(0, f.vela - Math.max(1, Math.round(n)));
      let marca = null;
      if (f.vela <= 0) marca = this.marcar(id);
      this.mudou('vela');
      return {vela: f.vela, marca};
    }
    acalmar(n = 1, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return 0;
      f.vela = Math.min(this.tetoVela(id), f.vela + Math.max(1, Math.round(n)));
      this.mudou('vela');
      return f.vela;
    }
    /* A cicatriz: o teto cai 1 para sempre e a vela reacende pela metade. */
    marcar(id = this.atual()?.id, escolha = null) {
      const f = this.de(id);
      if (!f) return null;
      const livres = MARCAS.filter(m => !f.marcas.includes(m[0]));
      if (!livres.length) { f.vela = 0; return null; }
      const m = (escolha && livres.find(x => x[0] === escolha)) || livres[Math.floor(Math.random() * livres.length)];
      f.marcas.push(m[0]);
      f.vela = Math.max(1, Math.ceil(this.tetoVela(id) / 2));
      this.mudou('marca');
      return m;
    }
    marcasDe(id = this.atual()?.id) { const f = this.de(id); return f ? f.marcas.map(x => this.marca(x)).filter(Boolean) : []; }

    /* --------------------------------------------------------- corrupção */
    corrupcao(id = this.atual()?.id) { const f = this.de(id); return f ? f.corrupcao : 0; }
    /* 0 a 1 — é este número que pilota o quanto a ficha inteira apodrece. */
    glitch(id) { return Math.min(1, this.corrupcao(id) / CORRUPCAO_MAX); }
    corromper(n = 1, id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return 0;
      f.corrupcao = inteiro(f.corrupcao + n, 0, CORRUPCAO_MAX);
      this.mudou('corrupcao');
      return f.corrupcao;
    }
    /* O milagre cobra dos dois lados: um ponto de vela agora e um ponto de
       corrupção para sempre. Sem TAUMATURGIA não há milagre. */
    milagre(id = this.atual()?.id) {
      if (this.valorDe('tmg', id) <= 0) return null;
      const corrupcao = this.corromper(1, id);
      const {marca} = this.abalar(1, id) || {};
      return {corrupcao, marca, glitch: this.glitch(id)};
    }

    /* -------------------------------------------------------------- dados */
    get dificuldadeBase() { return this.cdBase; }
    set dificuldadeBase(v) { this.cdBase = inteiro(v, CD_MIN, CD_MAX); this.mudou('config'); }
    /* A dificuldade que este personagem enfrenta neste atributo. */
    dificuldade(atr, {base = this.cdBase, mod = 0, pericia = null, id} = {}) {
      const treino = pericia ? this.bonusDoGrau(this.grauDe(pericia, id)) : 0;
      return inteiro(base - this.valorDe(atr, id) - treino + mod, 2, 20);
    }
    chance(atr, opts) { return Math.round((21 - this.dificuldade(atr, opts)) / 20 * 100); }
    /* Rola AGORA e devolve tudo pronto: a animação só encena o que já é. */
    rolar(atr, opts = {}) {
      const rng = opts.rng || Math.random;
      const d20 = 1 + Math.floor(rng() * 20);
      const cd = this.dificuldade(atr, opts);
      const critico = d20 === 20, desastre = d20 === 1;
      const sucesso = desastre ? false : critico ? true : d20 >= cd;
      const r = {
        atributo: atr, nome: this.atributo(atr)?.[1] || atr, d20, cd,
        base: opts.base ?? this.cdBase, valor: this.valorDe(atr, opts.id),
        pericia: opts.pericia || null, sucesso, critico, desastre,
        margem: d20 - cd, ficha: opts.id || this.atual()?.id, em: Date.now(),
        rotulo: desastre ? 'DESASTRE' : critico ? 'TRIUNFO' : sucesso ? 'PASSOU' : 'FALHOU'
      };
      this.ultimaRolagem = r;
      this.mudou('rolagem');
      return r;
    }

    /* ------------------------------------------------------------- sessão */
    resumo(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return null;
      return {
        id: f.id, personagem: this.nomeVisivel(f), jogador: f.jogador, origem: f.origem,
        palavra: f.palavra, emCena: f.emCena,
        atributos: Object.fromEntries(ATRIBUTOS.map(([a]) => [a, f.atributos[a]])),
        pontos: this.pontosRestantes(id), treinadas: this.treinadas(id),
        vela: this.vela(id), teto: this.tetoVela(id), marcas: f.marcas.length,
        corrupcao: f.corrupcao, vitalidadeMax: this.vitalidadeMax(id)
      };
    }
    exportar() { return JSON.parse(JSON.stringify({v: 2, cdBase: this.cdBase, ppBase: this.ppBase, ativa: this.ativa, fichas: this.fichas})); }
    importar(dados) {
      if (!dados || typeof dados !== 'object') return false;
      const lista = Array.isArray(dados.fichas) ? dados.fichas.slice(0, FICHAS_MAX) : [];
      this.fichas = lista.length ? lista.map((f, i) => validar(f, i + 1)) : [fichaNova(1)];
      let viu = false;
      for (const f of this.fichas) { if (f.emCena && viu) f.emCena = false; if (f.emCena) viu = true; }
      if (!viu) this.fichas[0].emCena = true;
      this.ativa = inteiro(dados.ativa ?? 0, 0, this.fichas.length - 1);
      if (Number.isFinite(dados.cdBase)) this.cdBase = inteiro(dados.cdBase, CD_MIN, CD_MAX);
      if (Number.isFinite(dados.ppBase)) this.ppBase = inteiro(dados.ppBase, PP_MIN, PP_MAX);
      this.mudou('importar');
      return true;
    }
    /* O código que o jogador copia e o mestre cola: uma ficha só, em texto
       que sobrevive a Discord, WhatsApp e e-mail. */
    codigoDe(id = this.atual()?.id) {
      const f = this.de(id);
      if (!f) return '';
      return 'CEU1:' + FichaSystem.paraTexto(JSON.stringify(f));
    }
    lerCodigo(codigo) {
      const bruto = String(codigo || '').trim().replace(/\s+/g, '');
      const corpo = bruto.startsWith('CEU1:') ? bruto.slice(5) : bruto;
      if (!corpo) return null;
      try {
        const dados = JSON.parse(FichaSystem.deTexto(corpo));
        return dados && typeof dados === 'object' ? validar(dados) : null;
      } catch (e) { return null; }
    }
    static paraTexto(s) {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      const b64 = (typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64'));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    static deTexto(s) {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
      const bin = (typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    restaurar() {
      try {
        const salvo = JSON.parse(root.localStorage?.getItem(STORE) || 'null');
        if (salvo) this.importar(salvo);
      } catch (e) { /* navegador sem armazenamento: a ficha vive só na sessão */ }
    }
    salvar() {
      if (!this.armazenar) return;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        try { root.localStorage?.setItem(STORE, JSON.stringify(this.exportar())); } catch (e) {}
      }, 250);
    }
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    mudou(kind) {
      this.revisao++;
      this.salvar();
      for (const fn of this.listeners) try { fn(kind); } catch (e) { console.error(e); }
    }
  }
  Object.assign(FichaSystem, {ATR_MAX, ATR_BASE, PONTOS, GRAU_MAX, PP_PADRAO, PP_MIN, PP_MAX, VELA_MAX, CORRUPCAO_MAX, FICHAS_MAX, TEXTO, CD_MIN, CD_MAX, CD_PADRAO, STORE, validar});

  const api = {FichaSystem, FICHA_ATRIBUTOS: ATRIBUTOS, FICHA_PERICIAS: PERICIAS, FICHA_GRAUS: GRAUS,
    FICHA_MARCAS: MARCAS, FICHA_ARV: PLANTA ? PLANTA.ARV : null, layoutArvore,
    FICHA_GRAFO: GRAFO, FICHA_DADOS: DADOS};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
