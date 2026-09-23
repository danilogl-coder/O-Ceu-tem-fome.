/* Exploração — passar de uma cena para outra por portas, corredores, escadas,
   elevadores e saídas laterais, em qualquer cena (as pintadas à mão e as
   montadas), e o que acontece quando os jogadores tentam ir aonde o mestre
   ainda não preparou nada.

   Referências que moldaram o sistema:
   - Portas ao fundo dos side-scrollers 2.5D: chegou na porta, aparece a dica
     e ↑ entra (a mesma tecla que “olha para cima”); clique leva o personagem
     até a porta, como nas aventuras de apontar e clicar.
   - Regiões de teleporte das mesas virtuais (Foundry VTT: Teleport Token com
     região de destino, escolha entre vários destinos): cada passagem aponta
     para uma passagem de destino; o elevador é uma passagem com vários.
     Chegar numa passagem nunca dispara outra (o laço infinito que o Foundry
     documenta), porque atravessar exige uma ação.
   - Design por nós (The Alexandrian): cenas são nós, passagens são ligações;
     um prédio inteiro é um nó que contém outros (os conjuntos prontos).
   - Improviso (Sly Flourish, “lugares fantásticos”): nomes evocativos, poucas
     linhas ligando os lugares, o resto preenchido na mesa — daí os pedidos com
     sugestões e a cena genérica criada e ligada num clique.

   Uma passagem é uma “pista” de tipo `passagem` (categoria passagem):
     data: {tipo: porta|corredor|escada|elevador|lateral|buraco|janela,
            destino: id da cena, chegada: id da passagem de lá,
            tranca: aberta|trancada|chave|codigo|mestre, chave, codigo, dica,
            mensagem, transicao, letreiro, andares: 'RÓTULO | cena | chegada'}
   Nas cenas montadas ela vem do objeto (porta, escada…); nas pintadas à mão o
   mestre marca a área, como numa pista. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  const {ClueTypes, normalize} = root;
  const SW = 480, SH = 270, S = 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (root.performance ? performance.now() : Date.now());
  const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const minutos = hhmm => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? (Number(m[1]) % 24) * 60 + Number(m[2]) : null; };

  const TIPOS = [['porta', 'Porta'], ['corredor', 'Corredor / vão'], ['escada', 'Escada'], ['elevador', 'Elevador'], ['lateral', 'Saída lateral'], ['buraco', 'Buraco'], ['janela', 'Janela'], ['portao', 'Portão']];
  const TRANCAS = [['aberta', 'Aberta'], ['trancada', 'Trancada'], ['chave', 'Precisa de chave'], ['codigo', 'Fechadura com código'], ['mestre', 'Só com a liberação do mestre']];
  const TRANSICOES = [['', 'Padrão'], ['fade', 'Esmaecer'], ['dissolve', 'Dissolver'], ['iris', 'Íris'], ['persiana', 'Persiana'], ['elevador', 'Portas de elevador'], ['corte', 'Corte seco']];
  const EFEITOS = [['legenda', 'Legenda na tela'], ['som', 'Som'], ['piscar', 'Luzes piscando'], ['apagar', 'Queda de energia'], ['acender', 'Energia volta'], ['tremor', 'Tremor'], ['relampago', 'Relâmpago'], ['chuva', 'Começa a chover'], ['telefone', 'Telefone toca'], ['tv', 'TV liga sozinha'], ['estado', 'Liga/desliga um objeto'], ['escuridao', 'Escuridão em volta']];
  const QUANDO = [['entrar', 'Ao entrar na cena'], ['tempo', 'De tempos em tempos'], ['manual', 'Só quando eu disparar']];

  /* Linhas do elevador: RÓTULO | cena | chegada */
  function parseAndares(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [rotulo = '', cena = '', chegada = ''] = l.split('|').map(x => x.trim());
      return {rotulo, cena, chegada};
    }).filter(a => a.rotulo || a.cena);
  }
  const formatAndares = list => list.map(a => [a.rotulo, a.cena || '', a.chegada || ''].join(' | ')).join('\n');

  /* ------------------------------------------------------------ sugestões para o improviso */
  /* Palavras no nome (ou no papel, ou na placa) de uma passagem que já dizem o que tem do outro lado. */
  const PALAVRAS = [[/banheir|\bwc\b|sanitar|lavabo|toalete/, 'banheiro'], [/quarto|dormit|suite/, 'quarto'], [/cozinha|copa\b|lanchonete|restaurante|refeit/, 'restaurante'],
    [/estoque|deposit|almoxarif|despensa|porao|arquivo morto/, 'deposito'], [/diretor|gerencia|escritorio|\bsala \d|consultorio/, 'escritorio'], [/\badm|financeiro|secretaria|recepcao|atendimento|administra/, 'sala_administrativa'],
    [/apart|\bap\.? ?\d|residencia|\bcasa\b/, 'apartamento'], [/corredor|\bandar\b|\bhall\b/, 'corredor'], [/escada/, 'escadaria'], [/garagem|estacionamento|rampa/, 'estacionamento'],
    [/\brua\b|calcada|avenida/, 'rua'], [/beco|fundos|servico/, 'beco'], [/oficina|mecanic/, 'oficina'], [/\bloja|mercad|conveniencia|farmacia/, 'loja'], [/\bbar\b|boteco|fliperama/, 'bar'],
    [/enfermaria|\bleito|\buti\b|hospital|ambulatorio/, 'hospital'], [/portaria|recepcao do predio|lobby/, 'portaria'], [/abandon|ruina|buraco/, 'predio_abandonado']];
  function sugestoesPara(clue, scene, extra = {}) {
    const d = clue?.data || {}, tags = new Set((scene?.tags || []).map(plain)), modelo = scene?.modelo || '';
    const tem = t => tags.has(t) || modelo === t;
    let lista;
    /* Pane na estrada: eles não escolhem para onde ir, eles param onde estão.
       A primeira sugestão é sempre a beira do trecho que estava rodando no
       minigame (ver cenas-estrada.js); depois vêm os lugares a que dá para
       chegar a pé ou de guincho. */
    if (extra.pane) {
      const M2 = root.Montador;
      const daEstrada = (M2 && M2.cenasDeEstrada) || [];
      const doTrecho = M2 && M2.cenaDoTrecho ? M2.cenaDoTrecho(extra.trecho) : null;
      const outras = daEstrada.filter(c => c.id !== doTrecho).map(c => c.id);
      lista = [doTrecho, ...outras, 'oficina', 'rua'].filter(Boolean);
      return [...new Set(lista)].filter(id => !M2 || M2.modeloDef(id)).slice(0, 8);
    }
    // Viagem de carro: o que dá para alcançar dirigindo, não o que tem atrás da porta.
    if (clue?.type === 'veiculo' || d.tipo === 'carro') lista = ['rua', 'estacionamento', 'oficina', 'loja', 'predio_abandonado', 'beco'];
    else if (d.tipo === 'elevador') lista = ['portaria', 'corredor', 'estacionamento', 'escritorio'];
    else if (d.tipo === 'escada') lista = d.sentido === 'desce' ? ['estacionamento', 'deposito', 'escadaria', 'predio_abandonado'] : ['escadaria', 'corredor', 'predio_abandonado', 'apartamento'];
    else if (d.tipo === 'lateral') lista = tem('exterior') || tem('rua') || tem('beco') ? ['rua', 'beco', 'estacionamento', 'predio_abandonado'] : ['corredor', 'escadaria', 'sala_administrativa', 'deposito'];
    else if (d.tipo === 'buraco') lista = ['predio_abandonado', 'deposito', 'beco', 'estacionamento'];
    else if (tem('exterior') || tem('rua')) lista = ['loja', 'restaurante', 'portaria', 'oficina', 'predio_abandonado', 'deposito'];
    else if (tem('beco')) lista = ['deposito', 'restaurante', 'oficina', 'escadaria', 'predio_abandonado'];
    else if (tem('hospital')) lista = ['hospital', 'banheiro', 'sala_administrativa', 'deposito', 'corredor'];
    else if (tem('corredor') || tem('predio')) lista = ['apartamento', 'quarto', 'banheiro', 'deposito', 'escritorio'];
    else if (tem('casa') || modelo === 'apartamento') lista = ['quarto', 'banheiro', 'corredor', 'deposito'];
    else if (tem('loja') || tem('restaurante') || tem('comercio')) lista = ['deposito', 'banheiro', 'beco', 'sala_administrativa'];
    else if (tem('abandonado')) lista = ['predio_abandonado', 'escadaria', 'deposito', 'banheiro'];
    else if (tem('oficina') || tem('deposito')) lista = ['escritorio', 'banheiro', 'beco', 'estacionamento'];
    else lista = ['corredor', 'sala_administrativa', 'escritorio', 'banheiro', 'deposito', 'escadaria'];
    const placa = scene?.objetos?.find(o => o.id === clue?.id)?.p?.placa || '';
    const texto = plain(`${clue?.name || ''} ${d.papel || ''} ${placa}`);
    const pelaPalavra = PALAVRAS.filter(([re]) => re.test(texto)).map(([, id]) => id);
    const M = root.Montador;
    return [...new Set([...pelaPalavra, ...lista])].filter(id => !M || M.modeloDef(id)).slice(0, 6);
  }

  /* ------------------------------------------------------------ o sistema */
  class Exploracao {
    constructor({stage, clues, link = null} = {}) {
      this.stage = stage; this.clues = clues; this.link = link;
      clues.exploracao = this;
      this.prefs = {pedidos: true, dica: true, jogadoresAtravessam: true, horario: true, eventos: true, alcanceInteracoes: true};
      this.estados = {};           // última luz/clima/objetos de cada cena visitada
      this.eventosCena = {};       // eventos das cenas pintadas à mão (as montadas guardam na receita)
      this.pedidos = [];
      this.log = [];
      this.legendas = [];
      this.listeners = new Set();
      this.perto = null; this.auto = null; this.viagem = null; this.empurrao = 0; this.chegouEm = -1e9;
      this.personagem = null; this.relogio = 0; this.agenda = new Map(); this.cenaAgenda = null;
      this.cacheArte = new Map();
      const M = root.Montador;
      if (M) {
        M.stage = stage;
        M.memoria = (sceneId, id) => clues.memory(id, sceneId);
        M.on(kind => { this.cacheArte.clear(); if (kind === 'registrar' || kind === 'remover' || kind === 'importar') this.emit('cenas'); });
      }
      clues.arteObjeto = clue => this.arteObjeto(clue);
      stage.listeners.add(desc => this.aoMudarPalco(desc));
    }
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(kind, data) { for (const fn of this.listeners) try { fn(kind, data); } catch (e) { console.error(e); } }
    sfx(name) { this.clues.sfx(name); }
    toast(t, s, i) { if (this.clues.announce !== false || /TRANCAD|NÃO ABRE|DESTRANC/.test(t)) this.clues.toast(t, s, i); }

    /* ---------------------------------------------------------- passagens */
    passagens(sceneId = this.stage.scene?.id) { return sceneId ? this.clues.clues(sceneId).filter(c => c.type === 'passagem') : []; }
    passagem(sceneId, id) { return this.passagens(sceneId).find(c => c.id === id) || null; }
    destino(clue) {
      const d = clue?.data || {};
      return d.destino && root.SceneLibrary.has(d.destino) ? {cena: d.destino, chegada: d.chegada || ''} : null;
    }
    rotuloDestino(clue) {
      const dest = this.destino(clue);
      if (clue?.data?.tipo === 'elevador' && parseAndares(clue.data.andares).length) return `${parseAndares(clue.data.andares).length} andares`;
      if (!dest) return 'sem destino';
      const scene = root.SceneLibrary.get(dest.cena), p = dest.chegada ? this.passagem(dest.cena, dest.chegada) : null;
      return p ? `${scene.name} · ${p.name}` : scene.name;
    }
    /* Muda os dados de uma passagem onde ela mora: na receita (cena montada) ou na sessão das pistas. */
    editarPassagem(sceneId, id, patch = {}) {
      const M = root.Montador, R = M?.receita(sceneId), obj = R?.objetos.find(o => o.id === id && M.mod(o.mod)?.passagem);
      const scene = root.SceneLibrary.get(sceneId);
      const builtIn = (scene?.clues || []).some(c => c.id === id);
      if (obj && builtIn) {
        M.editar(sceneId, r => {
          const o = r.objetos.find(x => x.id === id);
          o.pas = {...(o.pas || {}), ...(patch.data || {})};
          if (patch.name) o.nome = patch.name;
          if (patch.marker) o.pas.marca = patch.marker;
          if ('enabled' in patch) o.pas.ativo = patch.enabled !== false;
          if ('requires' in patch) o.pas.requer = patch.requires || '';
          if ('note' in patch) o.pas.nota = patch.note || '';
        }, {visual: false});
        this.clues.emit('change');
      } else this.clues.updateClue(id, patch, sceneId);
      this.emit('passagens', {sceneId, id});
    }
    criarPassagem(sceneId, campos) {
      const clue = this.clues.createClue({type: 'passagem', marker: 'discreta', ...campos, data: {tipo: 'porta', tranca: 'aberta', ...(campos.data || {})}}, sceneId);
      this.emit('passagens', {sceneId, id: clue.id});
      return clue;
    }
    removerPassagem(sceneId, id) {
      const M = root.Montador;
      if (M?.receita(sceneId)?.objetos.some(o => o.id === id)) M.editar(sceneId, r => { r.objetos = r.objetos.filter(o => o.id !== id); });
      else this.clues.removeClue(id, sceneId);
      this.emit('passagens', {sceneId, id});
    }
    /* Liga a → b (e b → a, se b ainda não leva a lugar nenhum ou se sobrescrever). */
    ligar(a, b, {idaVolta = true, sobrescrever = false} = {}) {
      if (!a?.cena || !a.id) return false;
      let chegada = b?.id || '';
      if (b?.cena && !chegada && idaVolta) chegada = this.entradaPara(b.cena, this.passagem(a.cena, a.id), a.cena)?.id || '';
      this.editarPassagem(a.cena, a.id, {data: {destino: b?.cena || '', chegada}});
      if (idaVolta && b?.cena && chegada) {
        const volta = this.passagem(b.cena, chegada);
        if (volta && volta.data?.tipo !== 'elevador' && (sobrescrever || !this.destino(volta))) this.editarPassagem(b.cena, chegada, {data: {destino: a.cena, chegada: a.id}});
      }
      this.emit('ligacoes');
      return true;
    }
    desligar(sceneId, id) { this.editarPassagem(sceneId, id, {data: {destino: '', chegada: ''}}); this.emit('ligacoes'); }
    /* A passagem de uma cena por onde se chega vindo de `origem` (uma passagem de outra cena). */
    entradaPara(sceneId, origem, origemCena = null) {
      const list = this.passagens(sceneId);
      if (!list.length) return null;
      const d = origem?.data || {};
      const score = p => {
        const q = p.data || {};
        let s = 0;
        if (origemCena && q.destino === origemCena && (!q.chegada || q.chegada === origem?.id)) s += 100;
        if (!this.destino(p)) s += 20;
        if (q.papel === 'entrada' || /entrada|saida|rua/.test(plain(p.name))) s += 8;
        if (d.tipo === 'lateral' && q.tipo === 'lateral') s += (d.lateral === 'right' && q.lateral === 'left') || (d.lateral === 'left' && q.lateral === 'right') ? 40 : 10;
        if (d.tipo === 'escada' && q.tipo === 'escada') s += (d.sentido === 'sobe' && q.sentido === 'desce') || (d.sentido === 'desce' && q.sentido === 'sobe') ? 40 : 15;
        if (d.tipo && d.tipo === q.tipo && d.tipo !== 'lateral' && d.tipo !== 'escada') s += 25;
        if (q.tipo === 'elevador' && d.tipo !== 'elevador') s -= 30;
        return s;
      };
      return [...list].sort((p, q) => score(q) - score(p))[0];
    }

    /* ---------------------------------------------------------- atravessar */
    podeAndar() { return !!this.personagem?.livre; }
    alcance(clue) {
      const st = this.stage, room = st.room, a = clue?.anchor;
      if (!a) return null;
      const cx = st.anchorWorldX(a);
      let w = a.w || 20;
      if (room && a.layer === 'wall') w = a.w * S / room.wallFactor;
      else if (room && a.layer === 'front') { const piece = st.live?.scene.front?.find(p => p.id === a.piece); w = a.w * S / (piece?.factor || room.frontFactor); }
      if (clue.data?.lateral && room) {
        const edge = clue.data.lateral === 'left' ? room.x0 + room.margin : room.x1 - room.margin;
        return {x0: edge - 40, x1: edge + 40, cx: edge};
      }
      return {x0: cx - w / 2, x1: cx + w / 2, cx};
    }
    andarAte(x, depois, tol = 5) {
      this.auto = {x, depois, tol, t: 0};
      this.emit('andando');
    }
    cancelarAuto() { if (this.auto) { this.auto = null; this.emit('andando'); } }
    /* Direção automática para o jogo: -1, 0 ou 1. */
    direcao(x) {
      if (!this.auto) return 0;
      const dx = this.auto.x - x;
      return Math.abs(dx) <= this.auto.tol ? 0 : Math.sign(dx);
    }
    usar(clue, {source = 'mestre', perto = false} = {}) {
      if (!clue) return false;
      clue = normalize(clue);
      if (this.stage.busy || this.clues.cinematic) return true;
      const cat = ClueTypes.categoria(clue);
      if (cat === 'interacao') {
        const kind = ClueTypes.get(clue.type);
        if (kind?.activate && kind.activate(clue, this.clues, {source}) !== false) return true;
        this.clues.open(clue, {source: source === 'mestre' ? 'cena' : 'jogadores'});
        return true;
      }
      if (cat !== 'passagem') return false;
      const d = clue.data || {};
      if (source === 'jogadores' && this.prefs.jogadoresAtravessam === false) { this.toast('SÓ O MESTRE', 'Peça ao mestre para atravessar', 'alerta'); return true; }
      // Longe: o personagem anda até a passagem e tenta de lá.
      const r = this.alcance(clue), pos = this.personagem;
      if (!perto && r && pos && (pos.x < r.x0 - 3 || pos.x > r.x1 + 3)) {
        if (!pos.livre) { this.toast('NÃO CONSEGUE ANDAR', 'O personagem precisa estar de pé', 'alerta'); return true; }
        const alvo = d.lateral ? r.cx : clamp(pos.x, r.x0 + 4, r.x1 - 4);
        this.andarAte(alvo, () => this.usar(clue, {source, perto: true}), d.lateral ? 12 : 4);
        return true;
      }
      const mem = this.clues.memory(clue.id);
      const tranca = mem.destrancada ? 'aberta' : (d.tranca || 'aberta');
      if (tranca === 'trancada') { this.sfx('porta_trancada'); this.clues.toast('TRANCADA', d.mensagem || clue.name, 'cadeado'); this.emit('tentativa', {clue, resultado: 'trancada'}); return true; }
      if (tranca === 'chave') {
        if (this.clues.itens?.temChave?.(d.chave || '')) {
          mem.destrancada = true; this.sfx('destranca'); this.clues.toast('DESTRANCOU', d.chave ? `Chave: ${d.chave}` : clue.name, 'cadeado'); this.clues.emit('change');
        } else { this.sfx('porta_trancada'); this.clues.toast('TRANCADA', d.chave ? `Precisa da chave: ${d.chave}` : 'Precisa de uma chave', 'cadeado'); this.emit('tentativa', {clue, resultado: 'chave'}); return true; }
      }
      if (tranca === 'codigo' && !mem.destrancada) { this.clues.open(clue, {source: source === 'mestre' ? 'cena' : 'jogadores'}); return true; }
      if (tranca === 'mestre' && !mem.liberada) { this.pedir(clue, 'liberar', source); return true; }
      if (d.tipo === 'elevador' && parseAndares(d.andares).length) { this.clues.open(clue, {source: source === 'mestre' ? 'cena' : 'jogadores'}); return true; }
      if (!this.destino(clue)) { this.pedir(clue, 'improviso', source); return true; }
      if (mem.liberada === 'uma') { mem.liberada = false; this.clues.emit('change'); }
      return this.atravessar(clue);
    }
    atravessar(clue, {cena = null, chegada = null, rotulo = ''} = {}) {
      const d = clue?.data || {}, dest = cena ? {cena, chegada: chegada || ''} : this.destino(clue);
      if (!dest || !root.SceneLibrary.has(dest.cena) || this.stage.busy) return false;
      const origem = this.stage.scene?.id;
      const tipo = d.tipo || 'porta';
      this.sfx({porta: 'porta_abrir', portao: 'porta_metal', elevador: 'elevador', escada: 'passos_escada', corredor: 'passos_escada', lateral: '', buraco: 'objeto', janela: 'vidro_quebrando'}[tipo] ?? 'porta_abrir');
      const transition = d.transicao || (tipo === 'elevador' ? 'elevador' : 'fade');
      const duration = tipo === 'elevador' ? 1.5 : tipo === 'escada' ? 1.1 : tipo === 'lateral' ? .6 : .8;
      this.viagem = {de: origem, para: dest.cena, passagem: clue.id, chegada: dest.chegada, tipo, at: now()};
      this.cancelarAuto();
      this.onViagem?.(this.viagem);
      this.stage.goLive({scene: dest.cena, state: this.estadoPara(dest.cena), transition, duration, title: d.letreiro || rotulo || '',
        spawn: () => this.pontoDeChegada(dest.cena, dest.chegada, origem, clue.id)});
      this.emit('viagem', this.viagem);
      return true;
    }
    pontoDeChegada(sceneId, chegadaId, origemCena, origemId) {
      const room = this.stage.room;
      let p = chegadaId ? this.passagem(sceneId, chegadaId) : null;
      if (!p) p = this.passagens(sceneId).find(q => q.data?.destino === origemCena && (!q.data.chegada || q.data.chegada === origemId)) || null;
      this.chegouEm = now();
      if (!p) {
        const scene = root.SceneLibrary.get(sceneId), sp = scene?.spawns?.[1] || scene?.spawns?.[0];
        return sp ? {x: sp.x, facing: sp.facing || 1} : null;
      }
      if (p.data?.lateral && room) return p.data.lateral === 'left' ? {x: room.x0 + room.margin + 30, facing: 1} : {x: room.x1 - room.margin - 30, facing: -1};
      const x = this.stage.anchorWorldX(p.anchor);
      const mid = room ? (room.x0 + room.x1) / 2 : x;
      return {x, facing: x < mid ? 1 : -1};
    }
    /* Estado com que a cena de destino entra: o que ela tinha da última vez e
       o horário (e a chuva) da cena de onde o personagem vem. */
    estadoPara(sceneId) {
      const scene = root.SceneLibrary.get(sceneId), lembrado = this.estados[sceneId] || {}, atual = this.stage.state;
      const out = {preset: lembrado.preset, weather: lembrado.weather, props: lembrado.props ? new Set(lembrado.props) : undefined, clock: lembrado.clock};
      if (this.prefs.horario !== false && atual && scene) {
        const alvo = minutos(atual.clock);
        if (alvo !== null) {
          let best = null, bestD = Infinity;
          for (const p of scene.presets) {
            const m = minutos(p.time);
            if (m === null) continue;
            const dd = Math.min(Math.abs(m - alvo), 1440 - Math.abs(m - alvo));
            if (dd < bestD) { bestD = dd; best = p.id; }
          }
          if (best) out.preset = best;
          out.clock = atual.clock;
        }
        if (scene.weathers.some(w => w.id === atual.weather)) out.weather = atual.weather;
      }
      return out;
    }
    aoMudarPalco(desc) {
      if (!desc) return;
      if (desc.transition) this.cancelarAuto();
      const st = this.stage.state;
      if (st && !desc.transition) this.estados[desc.scene] = {preset: st.preset, weather: st.weather, props: [...st.props], clock: st.clock};
      if (this.viagem && desc.scene === this.viagem.para && !desc.transition) {
        const tipo = this.viagem.tipo;
        this.sfx(tipo === 'porta' ? 'porta_fechar' : tipo === 'portao' ? 'porta_metal' : '');
        this.viagem = null;
        this.emit('chegada', desc);
      }
      if (this.cenaAgenda !== desc.scene && !desc.transition) { this.cenaAgenda = desc.scene; this.entrarNaCena(desc.scene); }
    }

    /* ---------------------------------------------------------- por quadro */
    /* p = {x, livre, direcao (teclas), borda (-1/1 empurrando a parede), grounded} */
    passo(dt, p) {
      this.personagem = p;
      this.relogio += dt;
      for (const l of this.legendas) l.t += dt;
      this.legendas = this.legendas.filter(l => l.t < l.dur + .4);
      this.passoEventos(dt);
      if (!this.stage.live || this.stage.busy) { this.perto = null; return; }
      if (this.auto) {
        this.auto.t += dt;
        if (!p.livre || p.direcao || this.clues.busy || this.auto.t > 8) this.cancelarAuto();
        else if (Math.abs(p.x - this.auto.x) <= this.auto.tol) { const f = this.auto.depois; this.auto = null; this.emit('andando'); f?.(); }
      }
      if (this.clues.busy) { this.perto = null; this.empurrao = 0; return; }
      let best = null, bestD = Infinity;
      for (const clue of this.clues.visibleClues()) {
        const cat = ClueTypes.categoria(clue);
        if (cat === 'pista' || clue.marker === 'oculta' || (cat === 'interacao' && !this.prefs.alcanceInteracoes)) continue;
        const r = this.alcance(clue);
        if (!r) continue;
        const dist = p.x < r.x0 ? r.x0 - p.x : p.x > r.x1 ? p.x - r.x1 : 0;
        const score = dist + (cat === 'passagem' ? 0 : .5) + Math.abs(p.x - r.cx) * .001;
        if (dist <= 10 && score < bestD) { bestD = score; best = clue; }
      }
      this.perto = best;
      // Encostar na borda da sala empurrando: sai pela lateral.
      if (p.borda && p.livre && now() - this.chegouEm > 900) {
        this.empurrao += dt;
        if (this.empurrao > .28) {
          const lat = this.passagens().find(c => c.enabled !== false && c.data?.lateral === (p.borda < 0 ? 'left' : 'right') && (!c.requires || this.stage.state?.props.has(c.requires)));
          this.empurrao = 0;
          if (lat) this.usar(lat, {source: 'mestre', perto: true});
        }
      } else this.empurrao = 0;
    }
    /* E: usa o que estiver ao alcance. */
    interagir({source = 'mestre'} = {}) {
      if (!this.perto || this.stage.busy || this.clues.busy) return false;
      return this.usar(this.perto, {source, perto: true});
    }
    rotuloAcao(clue) {
      const d = clue.data || {}, cat = ClueTypes.categoria(clue);
      if (cat === 'passagem') {
        if (d.tipo === 'elevador') return 'Chamar o elevador';
        if (d.tipo === 'escada') return d.sentido === 'desce' ? 'Descer' : 'Subir';
        if (d.tipo === 'lateral' || d.tipo === 'corredor') return 'Seguir';
        if (d.tipo === 'buraco') return 'Passar';
        if (d.tipo === 'janela') return 'Pular a janela';
        return 'Entrar';
      }
      const proprio = ClueTypes.get(clue.type)?.rotuloAcao;
      if (proprio) { const r = typeof proprio === 'function' ? proprio(clue, this) : proprio; if (r) return r; }
      return {recipiente: 'Abrir', exame: 'Examinar', interruptor: this.stage.state?.props.has(d.alvo || 'luzes') ? 'Apagar' : 'Acender', tv: 'Ver TV', telefone: 'Usar o telefone',
        terminal: 'Usar o computador', computador: 'Usar o computador', maquina_venda: 'Comprar', fliperama: 'Jogar', painel_eletrico: 'Abrir o quadro', cofre: 'Abrir o cofre'}[clue.type] || 'Usar';
    }

    /* ---------------------------------------------------------- pedidos */
    pedir(clue, tipo, source, extra = {}) {
      const cena = this.stage.scene?.id, d = clue.data || {};
      if (tipo === 'improviso' && this.prefs.pedidos === false) { this.sfx('porta_trancada'); this.clues.toast('TRANCADA', d.mensagem || clue.name, 'cadeado'); return null; }
      let p = this.pedidos.find(x => x.cena === cena && x.passagem === clue.id && x.tipo === tipo && (x.andar || '') === (extra.andar || ''));
      if (!p) {
        p = {id: 'pd' + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36), cena, passagem: clue.id, nome: clue.name, tipoPassagem: d.tipo || 'porta',
          tipo, fonte: source, at: Date.now(), andar: extra.andar || '', carro: extra.carro || null,
          // Pane: de que trecho de estrada é a beira, e quanto do caminho eles venceram.
          trecho: extra.trecho || '', andou: extra.andou ?? null, destino: extra.destino || '', veiculo: extra.veiculo || '',
          sugestoes: sugestoesPara(clue, root.SceneLibrary.get(cena), {pane: tipo === 'pane', trecho: extra.trecho})};
        this.pedidos.push(p);
      } else p.at = Date.now();
      if (tipo === 'viagem') this.clues.toast('O CARRO PEGOU A ESTRADA', 'Escolha o destino no mapa do mestre · Exploração', 'carro');
      else if (tipo === 'pane') this.clues.toast('O CARRO MORREU NA ESTRADA',
        'Escolha onde eles ficaram parados · Exploração', 'alerta');
      else {
        this.sfx('porta_trancada');
        if (tipo === 'liberar') this.clues.toast('TRANCADA', d.mensagem || 'Parece que alguém precisa abrir', 'cadeado');
        else this.clues.toast(d.tipo === 'elevador' ? 'NÃO RESPONDE' : 'NÃO ABRE', extra.andar || clue.name, 'cadeado');
      }
      this.emit('pedidos', p);
      return p;
    }
    /* Resolve um pedido: cria uma cena de um modelo (ou usa uma existente),
       liga nos dois sentidos e, se `levar`, atravessa já. */
    resolverPedido(id, {modelo = null, cena = null, chegada = '', levar = true, opcoes = {}} = {}) {
      const p = this.pedidos.find(x => x.id === id);
      if (!p) return null;
      if (p.tipo === 'liberar') return this.liberarPedido(id, {levar});
      /* Viagem de carro: não há passagem para ligar — o carro é a passagem. A
         cena de destino é criada (ou escolhida) exatamente como num improviso,
         e quem leva o personagem até lá é a viagem, com ou sem o minigame. */
      /* Pane: igual à viagem, mas sem escolha de destino — a cena criada É o
         lugar onde o carro parou. Quem leva o personagem e estaciona o carro
         quebrado lá é a própria viagem de carro. */
      if (p.tipo === 'pane') {
        const onde = modelo ? this.cenaDoModelo(p, modelo, {nome: opcoes.nome, ...opcoes}) : cena;
        if (!onde || !root.SceneLibrary.has(onde)) return null;
        this.pedidos = this.pedidos.filter(x => x !== p);
        this.emit('pedidos');
        const VC = root.ViagemDeCarro;
        if (VC && VC.parar) VC.parar({cena: onde, pedido: p});
        return onde;
      }
      if (p.tipo === 'viagem') {
        const destino = modelo ? this.cenaDoModelo(p, modelo, opcoes) : cena;
        if (!destino || !root.SceneLibrary.has(destino)) return null;
        this.pedidos = this.pedidos.filter(x => x !== p);
        this.emit('pedidos');
        const VC = root.ViagemDeCarro;
        if (VC && VC.viajar) VC.viajar({origem: p.cena, destino, veiculo: p.passagem, carro: p.carro,
          minigame: opcoes.minigame !== false, percurso: opcoes.percurso});
        return destino;
      }
      const origem = this.passagem(p.cena, p.passagem);
      if (!origem) { this.dispensarPedido(id); return null; }
      let destino = cena;
      if (modelo && root.Montador) destino = this.cenaDoModelo(p, modelo, opcoes);
      if (!destino || !root.SceneLibrary.has(destino)) return null;
      const entrada = chegada ? this.passagem(destino, chegada) : this.entradaPara(destino, origem, p.cena);
      if (p.andar && origem.data?.tipo === 'elevador') {
        const andares = parseAndares(origem.data.andares).map(a => a.rotulo === p.andar ? {...a, cena: destino, chegada: entrada?.id || ''} : a);
        this.editarPassagem(p.cena, p.passagem, {data: {andares: formatAndares(andares)}});
        if (entrada && !this.destino(entrada)) this.editarPassagem(destino, entrada.id, {data: {destino: p.cena, chegada: p.passagem}});
      } else this.ligar({cena: p.cena, id: p.passagem}, {cena: destino, id: entrada?.id || ''}, {idaVolta: true});
      this.pedidos = this.pedidos.filter(x => x !== p);
      this.emit('pedidos');
      if (levar && this.stage.scene?.id === p.cena) {
        const clue = this.passagem(p.cena, p.passagem);
        if (p.andar) this.atravessar(clue, {cena: destino, chegada: entrada?.id || '', rotulo: ''});
        else this.atravessar(clue);
      }
      return destino;
    }
    /* A cena nova de um pedido: o modelo escolhido, com o nome que a placa da
       passagem sugere e o desgaste dos vizinhos. */
    cenaDoModelo(p, modelo, opcoes = {}) {
      const M = root.Montador;
      if (!M) return null;
      const def = M.modeloDef(modelo);
      if (!def) return null;
      const placa = root.SceneLibrary.get(p.cena)?.objetos?.find(o => o.id === p.passagem)?.p?.placa;
      const nome = opcoes.nome || (p.andar ? `${def.nome} · ${p.andar}` : placa && /^\d{1,4}[A-Z]?$/.test(placa) ? `${def.nome} ${placa}` : def.nome);
      const R = M.criar(modelo, {nome, desgaste: opcoes.desgaste ?? this.desgasteVizinho(p.cena), ...opcoes});
      this.emit('cenas', R.id);
      return R.id;
    }
    liberarPedido(id, {levar = true, sempre = false} = {}) {
      const p = this.pedidos.find(x => x.id === id);
      if (!p) return null;
      const clue = this.passagem(p.cena, p.passagem);
      this.pedidos = this.pedidos.filter(x => x !== p);
      this.emit('pedidos');
      if (!clue) return null;
      if (sempre) this.editarPassagem(p.cena, p.passagem, {data: {tranca: 'aberta'}});
      else { this.clues.memory(clue.id, p.cena).liberada = 'uma'; this.clues.emit('change'); }
      if (levar && this.stage.scene?.id === p.cena) this.usar(this.passagem(p.cena, p.passagem), {source: 'mestre', perto: true});
      return p.cena;
    }
    dispensarPedido(id, {mensagem = ''} = {}) {
      const p = this.pedidos.find(x => x.id === id);
      /* PANE dispensada não pode simplesmente sumir: a tela está segurada na
         beira da estrada esperando uma cena, e o carro quebrado está com eles.
         Sem escolha do mestre, eles param na beira do trecho em que quebraram
         — a primeira sugestão do próprio pedido. Ninguém volta para o lugar de
         onde o veículo saiu, que é o único lugar onde eles com certeza não
         estão. */
      if (p && p.tipo === 'pane') {
        const modelo = (p.sugestoes || [])[0];
        if (modelo && this.resolverPedido(id, {modelo})) { if (mensagem) this.legenda(mensagem); return; }
        this.pedidos = this.pedidos.filter(x => x.id !== id);
        if (mensagem) this.legenda(mensagem);
        this.emit('pedidos');
        const VC = root.ViagemDeCarro;
        if (VC && VC.parar) VC.parar({cena: p.cena, pedido: p});
        return;
      }
      this.pedidos = this.pedidos.filter(x => x.id !== id);
      if (p && mensagem) this.legenda(mensagem);
      this.emit('pedidos');
    }
    desgasteVizinho(sceneId) { return root.Montador?.receita(sceneId)?.casca?.desgaste ?? 0; }

    /* ---------------------------------------------------------- eventos */
    eventos(sceneId = this.stage.scene?.id) {
      const R = root.Montador?.receita(sceneId);
      return R ? (R.eventos || []) : (this.eventosCena[sceneId] ||= []);
    }
    salvarEventos(sceneId, lista) {
      const M = root.Montador;
      if (M?.receita(sceneId)) M.editar(sceneId, r => { r.eventos = lista; }, {visual: false});
      else this.eventosCena[sceneId] = lista;
      this.agenda.clear(); this.emit('eventos', sceneId);
    }
    entrarNaCena(sceneId) {
      this.agenda.clear();
      if (!this.prefs.eventos) return;
      for (const ev of this.eventos(sceneId)) {
        if (ev.ativo === false) continue;
        if (ev.quando === 'entrar' && Math.random() * 100 < (ev.chance ?? 100)) setTimeout(() => { if (this.stage.scene?.id === sceneId) this.disparar(ev, {auto: true}); }, 1200 + Math.random() * 1500);
      }
    }
    passoEventos(dt) {
      if (!this.prefs.eventos || !this.stage.live || this.stage.busy || this.clues.cinematic) return;
      for (const ev of this.eventos()) {
        if (ev.ativo === false || ev.quando !== 'tempo') continue;
        const key = ev.id || ev.nome;
        let t = this.agenda.get(key);
        const [a, b] = [Number(ev.min ?? 60), Number(ev.max ?? 180)];
        if (t === undefined) { t = a + Math.random() * Math.max(0, b - a); this.agenda.set(key, t); }
        t -= dt;
        if (t <= 0) { if (Math.random() * 100 < (ev.chance ?? 50)) this.disparar(ev, {auto: true}); t = a + Math.random() * Math.max(0, b - a); }
        this.agenda.set(key, t);
      }
    }
    legenda(texto, dur = null) { if (texto) this.legendas.push({texto: String(texto), t: 0, dur: dur ?? clamp(String(texto).length / 11, 2.6, 7)}); }
    disparar(ev, {auto = false} = {}) {
      const st = this.stage, scene = st.scene;
      if (!scene) return false;
      const clues = this.clues, props = st.state?.props;
      const dur = Number(ev.duracao) || 3;
      const achar = tipo => clues.visibleClues().find(c => c.type === tipo && (!ev.alvo || c.id === ev.alvo || c.objeto === ev.alvo)) || clues.clues().find(c => c.type === tipo);
      switch (ev.efeito) {
        case 'som': if (ev.som) this.sfx(ev.som); break;
        case 'piscar': st.setFlicker(true); setTimeout(() => st.setFlicker(false), dur * 1000); this.sfx('faisca'); break;
        case 'apagar': if (scene.props.some(p => p.id === 'energia')) st.setProp('energia', false); else st.update({preset: scene.flickerPreset || scene.presets.at(-1).id}); this.sfx('disjuntor'); break;
        case 'acender': if (scene.props.some(p => p.id === 'energia')) st.setProp('energia', true); this.sfx('energia'); break;
        case 'tremor': st.shake(8, .7); clues.sound?.shake?.(); break;
        case 'relampago': st.lightning(); clues.sound?.thunder?.(); break;
        case 'chuva': if (scene.weathers.some(w => w.id === 'chuva')) st.update({weather: 'chuva'}); break;
        case 'escuridao': st.setDarkness(true, 80); setTimeout(() => st.setDarkness(false), dur * 1000); break;
        case 'estado': { const id = ev.alvo; if (id && scene.props.some(p => p.id === id)) st.setProp(id, !props?.has(id)); break; }
        case 'telefone': {
          const tel = achar('telefone');
          if (tel) { clues.memory(tel.id).tocando = true; clues.emit('change'); }
          let n = 0; const ring = () => { if (n++ < 3 && (!tel || clues.memory(tel.id).tocando)) { this.sfx('telefone_tocando'); setTimeout(ring, 2200); } }; ring();
          break;
        }
        case 'tv': {
          const tv = achar('tv');
          if (tv) {
            const m = clues.memory(tv.id); m.canal = Number.isFinite(Number(ev.canal)) ? Number(ev.canal) : Math.floor(Math.random() * 4);
            if (tv.objeto) st.setProp(`${tv.objeto}.ligada`, true);
            clues.emit('change');
          }
          this.sfx('tv_liga');
          break;
        }
      }
      if (ev.texto && (ev.efeito === 'legenda' || ev.legenda !== false)) this.legenda(ev.texto);
      this.log.unshift({at: Date.now(), cena: scene.id, nome: ev.nome || ev.texto || ev.efeito, auto});
      this.log = this.log.slice(0, 30);
      this.emit('evento', ev);
      return true;
    }

    /* ---------------------------------------------------------- arte dos objetos */
    arteObjeto(clue) {
      const M = root.Montador, scene = root.SceneLibrary.get(this.clues.stackScene || this.stage.scene?.id) || this.stage.scene;
      if (!M || !scene?.generica || !clue?.objeto) return null;
      const o = scene.objetos?.find(x => x.id === clue.objeto);
      if (!o || o.mod.camada === 'chao') return null;
      const key = `${scene.id}:${o.id}:${JSON.stringify(o.obj)}:${scene.receita.semente}:${[...(this.stage.state?.props || [])].filter(p => p.startsWith(o.id + '.')).join(',')}`;
      if (this.cacheArte.has(key)) return this.cacheArte.get(key);
      const art = M.miniatura?.(o.mod.id, o.obj, {receita: scene.receita, props: this.stage.state?.props}) || null;
      this.cacheArte.set(key, art);
      if (this.cacheArte.size > 40) this.cacheArte.delete(this.cacheArte.keys().next().value);
      return art;
    }

    /* ---------------------------------------------------------- desenho */
    /* Na imagem dos jogadores: legendas dos eventos e a dica de ↑ perto das coisas. */
    desenhar(ctx, camera, {x = null, topo = 110} = {}) {
      if (this.legendas.length) this.desenharLegendas(ctx);
      if (!this.perto || this.prefs.dica === false || this.clues.busy || this.stage.busy || x === null) return;
      const label = `${this.rotuloAcao(this.perto)} · ${this.perto.name}`;
      const w = U.snap(K.measure(label) + 30), sx = U.snap(clamp(x - camera - w / 2, 4, SW - w - 4)), sy = U.snap(Math.max(24, topo - 24));
      const bob = Math.round(Math.sin(this.relogio * 4) * .8) * S;
      U.rect(ctx, sx + 2, sy + 2 + bob, w, 16, '#07030acc');
      U.rect(ctx, sx, sy + bob, w, 16, '#140619e6'); U.outline(ctx, sx, sy + bob, w, 16, '#9c3e88', 2);
      // Tecla ↑ desenhada em pixels (a fonte não tem seta).
      U.rect(ctx, sx + 4, sy + 3 + bob, 12, 10, '#ffd18c'); U.rect(ctx, sx + 4, sy + 11 + bob, 12, 2, '#b98a4a');
      ctx.fillStyle = '#2a0d22';
      ctx.fillRect(sx + 9, sy + 5 + bob, 2, 6); ctx.fillRect(sx + 7, sy + 7 + bob, 6, 2); ctx.fillRect(sx + 8, sy + 6 + bob, 4, 1);
      K.drawText(ctx, label, sx + 22, sy + 4 + bob, {color: '#ffe6f7'});
    }
    desenharLegendas(ctx) {
      const l = this.legendas[this.legendas.length - 1];
      const a = Math.min(1, l.t / .3, (l.dur + .4 - l.t) / .4);
      if (a <= 0) return;
      const lines = K.wrap(l.texto, 360).slice(0, 3), w = U.snap(Math.max(...lines.map(s => K.measure(s))) + 24), h = lines.length * 11 + 10;
      const x = U.snap((SW - w) / 2), y = U.snap(SH - 52 - h);
      ctx.save(); ctx.globalAlpha = a;
      U.rect(ctx, x, y, w, h, '#07040bd9');
      U.rect(ctx, x, y, 2, h, '#9c3e88'); U.rect(ctx, x + w - 2, y, 2, h, '#9c3e88');
      lines.forEach((s, i) => K.drawText(ctx, s, SW / 2, y + 6 + i * 11, {color: '#f3e6c8', align: 'center'}));
      ctx.restore();
    }
    /* Só o mestre: pedidos pendentes. */
    desenharPrivado(ctx) {
      if (!this.pedidos.length || this.clues.cinematic) return;
      const p = this.pedidos[this.pedidos.length - 1];
      const txt = p.tipo === 'liberar' ? `QUEREM PASSAR · ${p.nome}` : `PEDIDO · ${p.andar || p.nome} sem destino`;
      const w = U.snap(K.measure(txt) + K.measure('M escolhe') + 30);
      const pulse = Math.floor(this.relogio * 2) % 2;
      U.rect(ctx, 6, 6, w, 14, '#140619ee'); U.outline(ctx, 6, 6, w, 14, pulse ? '#ffd18c' : '#8fd3ff', 2);
      K.drawText(ctx, txt, 12, 9, {color: '#ffe6f7'});
      K.drawText(ctx, 'M escolhe', 6 + w - K.measure('M escolhe') - 8, 9, {color: '#ffd18c'});
    }

    /* ---------------------------------------------------------- sessão */
    exportar() { return {prefs: {...this.prefs}, estados: JSON.parse(JSON.stringify(this.estados)), eventos: JSON.parse(JSON.stringify(this.eventosCena)), pedidos: this.pedidos.map(p => ({...p}))}; }
    importar(d = {}) {
      Object.assign(this.prefs, d.prefs || {});
      this.estados = d.estados && typeof d.estados === 'object' ? d.estados : {};
      this.eventosCena = d.eventos && typeof d.eventos === 'object' ? d.eventos : {};
      this.pedidos = Array.isArray(d.pedidos) ? d.pedidos.filter(p => p && root.SceneLibrary.has(p.cena)) : [];
      this.emit('importar');
    }
    snapshot() {
      return {perto: this.perto ? {id: this.perto.id, type: this.perto.type, acao: this.rotuloAcao(this.perto)} : null, andando: !!this.auto, alvo: this.auto?.x ?? null,
        viagem: this.viagem ? {...this.viagem} : null, pedidos: this.pedidos.map(p => ({id: p.id, cena: p.cena, passagem: p.passagem, tipo: p.tipo, trecho: p.trecho || '', sugestoes: p.sugestoes})),
        legendas: this.legendas.map(l => l.texto), log: this.log.slice(0, 5)};
    }
  }

  /* ------------------------------------------------------------ interface da passagem */
  const C = U.C;
  function portaArte(tipo) {
    return U.art('passagem:fundo:' + tipo, 240, 124, b => {
      const metal = tipo === 'elevador';
      b.rect(0, 0, 240, 124, metal ? 'metal' : 'madeira', metal ? 3 : 2);
      if (metal) for (let x = 0; x < 240; x += 3) b.vline(x, 0, 123, 'metal', (x / 3) % 2 ? 3 : 4);
      else { for (let x = 0; x < 240; x += 30) { b.vline(x, 0, 123, 'madeira', 0); b.vline(x + 1, 0, 123, 'madeira', 3); } b.grain(0, 0, 240, 124, 1, .08, K.rng(4)); }
      b.shadeFn(0, 0, 240, 124, (x, y) => -Math.max(0, Math.hypot((x - 120) / 130, (y - 62) / 80) - .45) * 3);
    });
  }
  function teclado(ctx, ui, x, y, st, {tecla = 'tecla'} = {}) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
    keys.forEach((k, i) => {
      const bx = x + (i % 3) * 30, by = y + Math.floor(i / 3) * 24;
      const hover = ui.region(tecla, bx, by, 26, 20, {data: k});
      const down = st.aperto?.k === k && st.aperto.t > 0;
      U.rect(ctx, bx + 2, by + 2, 26, 20, '#0a0b10');
      U.rect(ctx, bx, by + (down ? 2 : 0), 26, 20, hover ? C('metal', 5) : C('metal', 4));
      U.outline(ctx, bx, by + (down ? 2 : 0), 26, 20, C('metal', 2), 2);
      U.rect(ctx, bx + 2, by + 2 + (down ? 2 : 0), 22, 2, C('metal', 6));
      K.drawText(ctx, k, bx + 13, by + 7 + (down ? 2 : 0), {color: k === 'OK' ? C('verde', 2) : k === 'C' ? C('vermelho', 3) : C('preto', 1), align: 'center'});
    });
  }
  ClueTypes.register('passagem', {
    label: 'Passagem', icon: 'porta', categoria: 'passagem', sound: 'porta_trancada',
    fields: [
      {id: 'tipo', label: 'Tipo', kind: 'select', options: TIPOS},
      {id: 'destino', label: 'Leva para (cena)', kind: 'cena'},
      {id: 'chegada', label: 'Chega por (passagem de lá)', kind: 'passagem'},
      {id: 'tranca', label: 'Tranca', kind: 'select', options: TRANCAS},
      {id: 'chave', label: 'Nome da chave (tranca por chave)', kind: 'text', placeholder: 'ex.: Porão'},
      {id: 'codigo', label: 'Código (fechadura)', kind: 'text', placeholder: 'ex.: 1987'},
      {id: 'dica', label: 'Dica perto da fechadura', kind: 'text'},
      {id: 'mensagem', label: 'Mensagem quando trancada', kind: 'text', placeholder: 'ex.: Trancada por dentro.'},
      {id: 'transicao', label: 'Transição', kind: 'select', options: TRANSICOES},
      {id: 'letreiro', label: 'Letreiro ao chegar', kind: 'text', placeholder: 'opcional'},
      {id: 'andares', label: 'Andares do elevador: RÓTULO | cena | chegada, um por linha', kind: 'textarea', rows: 4}],
    defaults: {tipo: 'porta', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', dica: '', mensagem: '', transicao: '', letreiro: '', andares: ''},
    activate(clue, sys, info) { return sys.exploracao ? sys.exploracao.usar(clue, {source: info?.source || 'mestre'}) : false; },
    wantsKeys: st => st.modo === 'codigo' && !st.certo,
    create(clue, sys, entry) {
      const d = clue.data || {}, mem = sys.memory(clue.id);
      const modo = d.tranca === 'codigo' && !mem.destrancada ? 'codigo' : d.tipo === 'elevador' && parseAndares(d.andares).length ? 'elevador' : 'info';
      return {mem, modo, digitos: '', erro: 0, certo: 0, aperto: null, escolhido: -1, partida: 0, source: entry?.source};
    },
    describe: st => ({modo: st.modo, digitos: st.digitos, certo: !!st.certo, escolhido: st.escolhido}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data || {}, dt = ui.dt;
      if (st.aperto) st.aperto.t -= dt;
      U.blit(ctx, portaArte(st.modo === 'elevador' ? 'elevador' : 'porta'), 0, 22);
      if (st.modo === 'codigo') {
        st.erro = Math.max(0, st.erro - dt);
        if (st.certo) { st.certo += dt; if (st.certo > .7 && !st.foi) { st.foi = true; sys.close(); setTimeout(() => sys.exploracao?.usar(clue, {source: st.source === 'jogadores' ? 'jogadores' : 'mestre', perto: true}), 220); } }
        const shake = st.erro > 0 ? (Math.floor(st.erro * 40) % 2 ? 3 : -3) : 0;
        const X = U.snap(170 + shake), Y = 52, W = 140, H = 176;
        U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
        U.rect(ctx, X, Y, W, H, C('metal', 3)); U.outline(ctx, X, Y, W, H, C('metal', 1), 2);
        U.rect(ctx, X + 2, Y + 2, W - 4, 2, C('metal', 5)); U.rect(ctx, X + W - 4, Y + 2, 2, H - 4, C('metal', 2));
        U.rect(ctx, X + 16, Y + 14, W - 32, 26, C('preto', 1)); U.outline(ctx, X + 16, Y + 14, W - 32, 26, C('metal', 1), 2);
        const visor = st.certo ? 'ABERTO' : st.erro > 0 ? 'ERRO' : st.digitos.replace(/./g, '*').padEnd(Math.max(4, String(d.codigo || '').length), '-');
        K.drawText(ctx, visor, X + W / 2, Y + 23, {color: st.certo ? C('fosforo', 5) : st.erro > 0 ? C('vermelho', 4) : C('fosforo', 4), align: 'center', scale: 1});
        U.rect(ctx, X + W - 22, Y + 46, 8, 8, st.certo ? C('fosforo', 5) : st.erro > 0 || Math.floor(ui.t * 2) % 2 ? C('vermelho', 4) : C('vermelho', 2));
        teclado(ctx, ui, X + 26, Y + 62, st);
        if (d.dica) { U.rect(ctx, 40, 150, 110, 64, C('amarelo', 4)); U.rect(ctx, 40, 150, 110, 10, C('amarelo', 3)); U.hand(ctx, d.dica, 46, 164, {color: C('tinta', 2), width: 104, maxLines: 4}); }
        U.header(ctx, ui, clue.name, 'digite o código · Enter confirma', 'cadeado');
        return;
      }
      if (st.modo === 'elevador') {
        const andares = parseAndares(d.andares), aqui = sys.stage?.scene?.id;
        if (st.partida) { st.partida += dt; if (st.partida > .9 && !st.foi) { st.foi = true; const a = andares[st.escolhido]; sys.close(); setTimeout(() => this.irAndar(a, clue, sys, st), 150); } }
        const X = 176, Y = 34, W = 128, H = 214;
        U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
        U.rect(ctx, X, Y, W, H, C('metal', 4)); U.outline(ctx, X, Y, W, H, C('metal', 1), 2);
        for (let yy = Y + 4; yy < Y + H - 4; yy += 4) U.rect(ctx, X + 4, yy, W - 8, 1, C('metal', 5));
        U.rect(ctx, X + 20, Y + 12, W - 40, 22, C('preto', 1));
        const atual = andares.find(a => a.cena === aqui)?.rotulo || '';
        K.drawText(ctx, (st.escolhido >= 0 ? andares[st.escolhido]?.rotulo : atual).toUpperCase().slice(0, 12), X + W / 2, Y + 19, {color: C('vermelho', 4), align: 'center'});
        andares.slice(0, 8).forEach((a, i) => {
          const by = Y + 44 + i * 20, here = a.cena === aqui, lit = st.escolhido === i;
          const hover = !here && ui.region('andar', X + 12, by, W - 24, 18, {data: i});
          U.rect(ctx, X + 16, by + 2, 14, 14, C('metal', 2));
          U.rect(ctx, X + 17, by + 3, 12, 12, lit ? C('ambar', 5) : here ? C('fosforo', 3) : hover ? C('metal', 6) : C('metal', 5));
          K.drawText(ctx, a.rotulo, X + 36, by + 5, {color: here ? C('fosforo', 2) : C('preto', 1)});
          if (here) K.drawText(ctx, 'AQUI', X + W - 14, by + 5, {color: C('fosforo', 2), align: 'right'});
        });
        U.header(ctx, ui, clue.name, 'escolha o andar', 'porta');
        return;
      }
      // Informação (aberta pelo mestre no painel).
      const X = 96, Y = 60, W = 288, H = 150;
      U.frame(ctx, X, Y, W, H, 'roxo');
      K.drawText(ctx, clue.name, X + 16, Y + 16, {color: '#ffd18c'});
      const dest = sys.exploracao?.rotuloDestino(clue) || '—';
      const tranca = TRANCAS.find(t => t[0] === (d.tranca || 'aberta'))?.[1] || '';
      [[`Tipo: ${TIPOS.find(t => t[0] === d.tipo)?.[1] || d.tipo}`], [`Leva para: ${dest}`], [`Tranca: ${tranca}${d.tranca === 'chave' && d.chave ? ' · ' + d.chave : ''}${d.tranca === 'codigo' ? ' · ' + (d.codigo || '') : ''}`]].forEach(([t], i) => K.drawText(ctx, t, X + 16, Y + 36 + i * 14, {color: '#ffe6f7'}));
      if (ui.button(ctx, 'atravessar', X + 16, Y + H - 40, 120, 24, 'Atravessar agora', {disabled: !sys.exploracao?.destino(clue)})) {}
      U.header(ctx, ui, clue.name, 'passagem', 'porta');
    },
    irAndar(a, clue, sys, st) {
      if (!a) return;
      const ex = sys.exploracao;
      if (!ex) return;
      if (a.cena && root.SceneLibrary.has(a.cena)) ex.atravessar(clue, {cena: a.cena, chegada: a.chegada});
      else ex.pedir(clue, 'improviso', st.source === 'jogadores' ? 'jogadores' : 'mestre', {andar: a.rotulo});
    },
    tecla(k, st, clue, sys) {
      st.aperto = {k, t: .12};
      if (st.certo) return;
      if (k === 'C') { st.digitos = ''; sys.sfx('tecla'); return; }
      if (k === 'OK') {
        const code = String(clue.data.codigo || '').replace(/\D/g, '');
        if (code && st.digitos === code) { st.certo = .01; st.mem.destrancada = true; sys.sfx('destranca'); sys.toast('DESTRANCOU', clue.name, 'cadeado'); sys.emit('change'); }
        else { st.erro = .45; st.digitos = ''; sys.sfx('erro'); }
        return;
      }
      if (st.digitos.length < 8) { st.digitos += k; sys.sfx('tecla'); }
    },
    action(id, st, clue, sys, info) {
      if (id === 'tecla') this.tecla(String(info.data), st, clue, sys);
      if (id === 'andar' && st.escolhido < 0) { st.escolhido = Number(info.data); st.partida = .01; sys.sfx('elevador_motor'); }
      if (id === 'atravessar') { sys.close(); setTimeout(() => sys.exploracao?.atravessar(clue), 150); }
    },
    key(e, st, clue, sys) {
      if (st.modo !== 'codigo' || st.certo) return false;
      if (/^\d$/.test(e.key)) { this.tecla(e.key, st, clue, sys); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { st.digitos = st.digitos.slice(0, -1); return true; }
      if (e.key === 'Enter') { this.tecla('OK', st, clue, sys); return true; }
      return false;
    }
  });
  if (!U.ICONS.porta) U.ICONS.porta = b => { b.rect(4, 1, 9, 14, 'madeira', 3); b.frame(3, 0, 11, 16, 'madeira', 5); b.rect(6, 3, 5, 4, 'madeira', 2); b.rect(6, 9, 5, 4, 'madeira', 2); b.px(11, 8, 'latao', 5); };

  const api = {Exploracao, parseAndares, formatAndares, sugestoesPara, TIPOS_PASSAGEM: TIPOS, TRANCAS, TRANSICOES, EFEITOS, QUANDO};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
