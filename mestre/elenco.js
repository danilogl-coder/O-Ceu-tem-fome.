/* O ELENCO — cada ficha é uma pessoa, e cada pessoa tem corpo.

   Até aqui a mesa tinha uma ficha "em cena" e um corpo só: a ficha regulava
   o corpo que já existia. Agora a mesa tem ELENCO. Cada ficha ganha um
   registro com o que faz dela alguém dentro do cenário:

     x, facing   onde está e para que lado olha
     cena        em que cenário ela está — quem ficou no Escritório não
                 aparece na estrada
     look        o guarda-roupa dela: cabelo, roupa, pele, olhos
     saude       as feridas dela, região por região
     fome        o metabolismo dela
     palco       se está no cenário agora

   Só UM desses corpos é simulado de verdade: o do personagem CONTROLADO.
   Ele é o corpo do jogo — ragdoll, bolsa, tratamento, exploração, saúde,
   fome, tudo o que já existia. Os outros são FIGURANTES: esqueleto próprio,
   respiração própria, roupa própria, de pé na mesma linha do chão, sem
   física e sem custo de simulação.

   ASSUMIR O CONTROLE é uma TROCA, não um teletransporte: o corpo do jogo
   guarda no registro de quem estava nele (posição, roupa, feridas, fome) e
   veste o registro de quem entra. Quem saiu continua lá, de pé, onde
   estava — agora como figurante. Nada se perde no caminho, e é por isso que
   o mestre pode ir e voltar quantas vezes quiser na mesma cena.

   Este arquivo não conhece o documento nem o canvas do jogo: quem desenha
   passa um contexto, e quem troca de corpo passa um ADAPTADOR (`corpo`,
   montado no app.js) com `ler()` e `vestir()`. É o que deixa o elenco
   rodar em node, nos testes, sem navegador. O menu do botão direito é a
   única classe com DOM aqui, e só é construída por quem tem documento. */
(function (root) {
  'use strict';

  const STORE = 'elenco.v1';
  const PASSO = 56;                 // o vão entre dois figurantes, em pixels de cena
  const LARG = 64, ALT = 96;        // o quadro do personagem, em pixels de arte
  const QUADROS = 1 / 20;           // teto de desenhos NOVOS por segundo, por figurante
  /* Um corpo com física muda de pose a cada quadro, então o desenho guardado
     não serve de nada enquanto ele cai — e redesenhar 60 vezes por segundo
     quatro corpos ao mesmo tempo derruba o jogo pela metade. Trinta desenhos
     por segundo bastam para uma queda ler como queda, e custam metade. */
  const QUADROS_FISICA = 1 / 30;
  const CACHE = 32;                 // quantos desenhos diferentes cada figurante guarda
  const TELA_ESQ = -80, TELA_DIR = 560;   // fora disto, ninguém desenha nem anima
  /* Um corpo com física para de ser calculado quando para de se mexer: um
     cadáver caído custa o mesmo que uma pedra. Acorda ao ser pego, empurrado
     ou atingido. Sem isso, cada corpo no chão comia 14% do quadro para
     sempre — e uma cena de mesa acumula corpos. */
  const SONO = .45, SONO_VEL = 14;
  const FOLGA = 7;                  // o vão entre o cursor e o canto do menu
  const SISTEMAS = ['saude', 'fome', 'fisica'];
  const num = (v, p = 0) => (Number.isFinite(Number(v)) ? Number(v) : p);
  const bool = v => (v === true || v === false ? v : null);

  /* Um número estável a partir do id da ficha. A cara de um personagem novo
     nasce daqui: a mesma ficha é sempre a mesma pessoa, em qualquer
     navegador, sem guardar nada — e duas fichas nunca saem gêmeas. */
  function semente(txt, sal = 0) {
    let h = (2166136261 ^ sal) >>> 0;
    const s = String(txt);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  const escolher = (lista, txt, sal) => (lista && lista.length) ? lista[Math.floor(semente(txt, sal) * lista.length) % lista.length] : null;
  const cor = c => (c && typeof c === 'object' ? c.hex : c) || null;
  const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

  class Elenco {
    constructor({ficha, asset = null, Skeleton2D = null, CharacterMotion = null, CharacterPhysics = null,
                 Wardrobe = null, corpo = null, tela = null, armazenar = true,
                 CharacterRagdoll = null, CharacterHealth = null, CharacterNeeds = null, relogio = null} = {}) {
      this.F = ficha;
      this.asset = asset;
      this.Rig = Skeleton2D; this.Motion = CharacterMotion; this.Fisica = CharacterPhysics;
      this.W = Wardrobe;
      /* OS BASTIDORES. Até aqui, quem não estava sendo controlado era um
         boneco: respirava, piscava, e nada mais acontecia com ele. Agora cada
         pessoa da mesa tem um corpo que corre por conta própria — a saúde
         dela no mesmo relógio do mestre, a fome dela no mesmo ritmo da mesa,
         e física de verdade quando ela cai. É barato porque é tudo lógica:
         nenhuma dessas três coisas desenha nada. O que custava caro — o
         desenho — continua guardado por assinatura de pose, e um corpo parado
         no chão dorme. */
      this.Ragdoll = CharacterRagdoll; this.Saude = CharacterHealth; this.Fome = CharacterNeeds;
      this.relogio = relogio;
      /* O que roda POR PADRÃO para todo mundo. O mestre desliga a mesa
         inteira aqui, ou uma pessoa de cada vez em `r.sistemas`. */
      this.sistemas = {saude: true, fome: true, fisica: true};
      /* As ferramentas do mestre, que não são regra do jogo e sim modo de
         trabalhar: arrastar um corpo pela cena não deve machucá-lo a menos
         que o mestre queira que machuque. */
      this.ferramentas = {danoAoArrastar: false, ferramenta: 'mao'};
      this.selecao = new Set();
      this.corpo = corpo;              // o corpo do jogo: ler() e vestir()
      this.fazerTela = tela;           // como nasce um buffer de 64×96 (o app passa o do documento)
      this.armazenar = armazenar;
      this.membros = new Map();
      this.cena = null;                // cenário ao vivo
      this.parede = null;              // limite da sala (sceneStage.clampBody)
      this.escala = 2;
      this.chao = 229;
      this.sobre = null;               // quem está sob o cursor, para a etiqueta acender
      this.listeners = new Set();
      this.revisao = 0;
      if (armazenar) this.restaurar();
      this.sincronizar();
    }

    /* ------------------------------------------------------------ registros */
    get max() { return this.F?.constructor?.FICHAS_MAX || 12; }
    controlado() { return this.F?.emCena()?.id || null; }
    ficha(id) { return this.F?.de(id) || null; }
    nome(id) { return (this.ficha(id)?.personagem || '').trim().toUpperCase() || 'SEM NOME'; }

    registro(id, {criar = true} = {}) {
      if (!id) return null;
      const tem = this.membros.get(id);
      if (tem) return tem;
      if (!criar || !this.ficha(id)) return null;
      const novo = {id, x: null, depth: null, tacticalConditions: {}, facing: 1, cena: null, look: null, saude: null, fome: null, palco: false, figurante: null,
        /* null = segue o padrão da mesa; true/false = o mestre decidiu por esta pessoa. */
        sistemas: {saude: null, fome: null, fisica: null},
        travado: false,      // não se pega nem se arrasta com o mouse
        oculto: false,       // não é desenhado (nem para o mestre nem para os jogadores)
        congelado: false,    // a física dele está parada onde está
        pose: null,          // a pose física guardada: um cadáver continua caído depois de recarregar
        poseOrigem: null,    // e o canto do mundo em que aquela pose foi tirada
        vivo: null};         // o corpo que corre nos bastidores: {saude, fome}
      this.membros.set(id, novo);
      return novo;
    }

    /* Quem some da mesa some do palco; quem está no corpo do jogo não guarda
       cópia da aparência — a verdade dele é o corpo, porque o guarda-roupa
       tem memória própria neste navegador e não se deve brigar com ela. */
    sincronizar() {
      if (!this.F) return;
      const vivos = new Set(this.F.fichas.map(f => f.id));
      for (const id of [...this.membros.keys()]) if (!vivos.has(id)) {
        this.desligarBastidor(this.membros.get(id));
        this.selecao.delete(id);
        this.membros.delete(id);
      }
      const dono = this.controlado();
      if (!dono) return;
      const r = this.registro(dono);
      if (!r) return;
      r.palco = true;
      if (this.cena) r.cena = this.cena;
      const foto = this.corpo?.ler?.();
      if (foto) {
        if (Number.isFinite(foto.x)) r.x = foto.x;
        r.facing = foto.facing === -1 ? -1 : 1;
        if (foto.look) r.look = foto.look;
      }
    }

    /* ------------------------------------------------------------ aparência */
    look(id) {
      const r = this.registro(id);
      if (!r) return null;
      if (!r.look) r.look = this.lookSorteado(id);
      return r.look;
    }
    /* A cara de quem acabou de entrar na mesa: um conjunto pronto do
       guarda-roupa, um corte de cabelo, uma cor de cabelo, um tom de pele e
       uma cor de olho — todos tirados do id, nenhum do relógio. */
    lookSorteado(id) {
      const g = this.asset?.wardrobe;
      if (!g) return {items: {}, dyes: {}};
      /* Só os conjuntos que VESTEM alguém: o guarda-roupa tem um "só a base",
         que é o corpo sem roupa nenhuma, e um personagem novo não pode
         aparecer na cena pelado porque o sorteio calhou nele. */
      const vestidos = (g.presets || []).filter(p => p?.items && (p.items.torso || p.items.casaco || p.items.pernas));
      const p = escolher(vestidos.length ? vestidos : g.presets, id, 1) || {};
      const items = copia(p.items) || {};
      const dyes = {...(p.dyes || {})};
      const cabelo = escolher((g.catalog || []).filter(c => c.category === 'cabelo'), id, 2);
      if (cabelo) items.cabelo = cabelo.id;
      const c1 = cor(escolher(g.hairColors, id, 3)); if (c1) dyes.hair = c1;
      const c2 = cor(escolher(g.skins, id, 4)); if (c2) dyes.skin = c2;
      const c3 = cor(escolher(g.eyeColors, id, 5)); if (c3) { dyes.eyeLeft = c3; dyes.eyeRight = c3; }
      return {items, dyes};
    }

    /* ------------------------------------------------------------ figurantes */
    figurante(r) {
      if (!r) return null;
      if (r.figurante) return r.figurante;
      if (!this.Rig || !this.Motion || !this.Fisica || !this.asset) return null;
      const rig = new this.Rig(this.asset);
      const motion = new this.Motion(rig);
      /* Figurante não tem física de cabelo: sem ela o desenho passa a depender
         só da pose, e é isso que deixa o quadro ser guardado e repetido. Um
         cabelo parado num personagem que está de pé esperando ninguém nota;
         meio segundo de engasgo por causa dele, todos notam. */
      motion.hairPhysics = false; motion.breeze = 0;
      r.figurante = {rig, motion, fisica: new this.Fisica(),
        t: semente(r.id, 7) * 4,          // cada um respira no seu compasso
        atraso: semente(r.id, 8) * QUADROS, versao: 0,
        cache: new Map(), assinatura: null, pixels: null, larg: LARG, alt: ALT, vista: null,
        tela: null, desenho: null, slots: new Set(), feridas: null,
        ragdoll: null, origem: null, sono: 0, morte: false};
      this.vestir(r);
      /* Quem já estava caído continua caído. Um cadáver que se levanta sozinho
         ao trocar de cena seria pior do que não ter cadáver nenhum. */
      if (r.pose || this.morto(r)) {
        const antes = r.x;
        this.derrubar(r, {morte: this.morto(r)});
        r.x = antes;
      }
      return r.figurante;
    }
    vestir(r) {
      const f = r?.figurante;
      if (!f) return;
      if (this.W && this.asset) {
        const {slots, tints} = this.W.resolve(this.asset, this.look(r.id) || {});
        f.slots = slots; f.rig.restyle(tints);
      }
      f.feridas = this.feridas(r);
      /* Trocou de roupa ou de ferida: o que estava guardado não serve mais. */
      f.cache.clear(); f.pixels = null; f.assinatura = null; f.vista = null; f.versao++;
      /* Zerar o atraso junto: com o quadro guardado jogado fora e o atraso
         ainda correndo, o personagem ficava invisível até ele vencer — um
         piscar no primeiro instante de todo arrasto. */
      f.atraso = 0;
      if (f.ragdoll) f.ragdoll.healthParts = r.vivo?.saude?.parts || null;
    }
    /* As feridas do figurante, no formato que o rasterizador entende. Um
       personagem que levou tiro no ombro aparece com o tiro no ombro mesmo
       quando não é ele que está sendo jogado. */
    feridas(r) {
      const partes = r?.saude?.parts;
      if (!partes) return null;
      const m = new Map();
      for (const [n, p] of Object.entries(partes)) m.set(n, p);
      return m.size ? m : null;
    }
    escondidos(r) {
      const fora = new Set();
      const partes = r?.saude?.parts;
      if (!partes) return fora;
      for (const [n, p] of Object.entries(partes)) if (p && p.missing) fora.add(n);
      if (partes.head && partes.head.missing) { fora.add('hair_back'); fora.add('hair_front'); }
      return fora;
    }

    /* ------------------------------------------- os sistemas de cada pessoa

       A regra da mesa é simples: TUDO roda para todo mundo, o tempo todo, e
       o mestre desliga o que não quiser. Quem fica no Escritório enquanto o
       grupo viaja continua com fome quando o grupo volta; quem levou um tiro
       e ficou para trás continua sangrando. Sem isso, sair do controle de
       alguém era congelá-lo no tempo, e a mesa tinha de fingir que não.

       O que roda: a SAÚDE (no mesmo relógio do mestre, para que "pausar a
       saúde" pause a de todos), a FOME (no mesmo ritmo e com as mesmas
       regras da mesa) e a FÍSICA (o corpo cai, é arrastado, e fica caído).
       Cada um liga e desliga para a mesa inteira (`this.sistemas`) ou para
       uma pessoa só (`r.sistemas`), e o padrão é ligado. */
    ligado(r, qual) {
      const meu = bool(r?.sistemas?.[qual]);
      return meu === null ? this.sistemas[qual] !== false : meu;
    }
    definirSistema(qual, valor, id = null) {
      if (!SISTEMAS.includes(qual)) return false;
      if (id) {
        const r = this.registro(id);
        if (!r) return false;
        r.sistemas[qual] = bool(valor);
      } else this.sistemas[qual] = valor !== false;
      this.revisarSistemas();
      this.mudou('sistemas');
      return true;
    }
    /* O corpo que corre nos bastidores. Nasce da foto guardada no registro —
       ou inteiro, se a pessoa nunca foi ferida — e é o mesmo tipo de corpo
       que o jogo usa: não há uma saúde "de figurante" e outra "de verdade". */
    bastidor(r) {
      if (!r || r.id === this.controlado()) return null;
      if (r.vivo) return r.vivo;
      if (!this.Saude) return null;
      const saude = new this.Saude();
      saude.definirVigor?.(this.vigorDe(r.id));
      if (r.saude) this.vestirSaude(saude, r.saude);
      let fome = null;
      if (this.Fome) {
        fome = new this.Fome({health: saude, clock: this.relogio});
        fome.importar({...(this.regrasFome || {}), fome: r.fome?.fome ?? 0, sede: r.fome?.sede ?? 0,
          efeitos: r.fome?.efeitos || []});
      }
      r.vivo = {saude, fome, revisaoSaude: -1, revisaoFome: -1, noRelogio: false};
      this.revisarSistemas();
      return r.vivo;
    }
    vigorDe(id) { return num(this.F?.resistenciaDoCorpo?.(id), 1); }
    /* Vestir uma foto num corpo vivo: as mesmas chaves que o app.js usa para
       vestir o corpo do jogo, para que a foto seja a MESMA em qualquer
       direção da troca. */
    vestirSaude(saude, foto) {
      if (!saude || !foto) return;
      for (const [n, p] of saude.parts) {
        const alvo = foto.parts?.[n];
        if (!alvo) continue;
        for (const k of Object.keys(p)) if (!(k in alvo)) delete p[k];
        Object.assign(p, alvo);
      }
      for (const [id, o] of saude.organs) if (foto.organs?.[id]) Object.assign(o, foto.organs[id]);
      saude.episodes.clear();
      for (const [k, e] of foto.episodes || []) saude.episodes.set(k, {...e});
      saude.blood = num(foto.blood, 100); saude.dead = !!foto.dead; saude.time = num(foto.time, 0);
      saude.vitalState = foto.vitalState || 'active'; saude.suspended = !!foto.suspended;
      saude.deathCause = foto.deathCause || null;
      if (foto.metabolism) Object.assign(saude.metabolism, foto.metabolism);
      saude.revision++;
    }
    fotoDe(saude) {
      return {parts: Object.fromEntries([...saude.parts].map(([n, p]) => [n, {...p}])),
        organs: Object.fromEntries([...saude.organs].map(([id, o]) => [id, {...o}])),
        episodes: [...saude.episodes].map(([k, e]) => [k, {...e}]),
        blood: saude.blood, dead: saude.dead, time: saude.time, vitality: saude.vitality,
        condicao: saude.vitality, vitalState: saude.vitalState, suspended: saude.suspended,
        deathCause: saude.deathCause, metabolism: {...saude.metabolism}};
    }
    /* Quem está no relógio da mesa e quem não está. O relógio é o mesmo da
       saúde do personagem controlado de propósito: "SAÚDE PAUSADA" tem de
       parar a mesa inteira, e não só quem está no corpo. */
    revisarSistemas() {
      const dono = this.controlado();
      for (const r of this.membros.values()) {
        const v = r.vivo;
        if (!v) continue;
        const deve = r.id !== dono && this.ligado(r, 'saude');
        if (deve === v.noRelogio) continue;
        v.noRelogio = deve;
        if (deve) this.relogio?.add?.(v.saude);
        else this.relogio?.remove?.(v.saude) ?? this.relogio?.characters?.delete?.(v.saude);
      }
    }
    /* As REGRAS da fome são da mesa, não da pessoa: o mestre ajusta uma vez e
       vale para todo mundo. Só as duas barras e as condições são de cada um. */
    definirRegrasFome(regras) {
      if (!regras) return;
      this.regrasFome = {auto: regras.auto, congelado: regras.congelado, perdaDeVida: regras.perdaDeVida, ritmo: regras.ritmo};
      for (const r of this.membros.values()) {
        const f = r.vivo?.fome;
        if (f) f.importar({...this.regrasFome, fome: f.fome, sede: f.sede, minutos: f.minutos,
          efeitos: [...f.efeitos.values()].map(e => ({id: e.id, fase: e.fase, restante: e.restante, forca: e.forca}))});
      }
    }
    /* Um passo da mesa inteira. A saúde já anda sozinha (está no relógio); o
       que se faz aqui é a fome, a queda de quem morreu, e copiar para o
       registro o que mudou — é o registro que a troca de corpo lê. */
    passoSistemas(d) {
      const dono = this.controlado();
      for (const r of this.membros.values()) {
        if (r.id === dono || !this.ficha(r.id)) continue;
        if (!this.ligado(r, 'saude') && !this.ligado(r, 'fome') && !r.vivo) continue;
        const v = this.bastidor(r);
        if (!v) continue;
        if (v.fome && this.ligado(r, 'fome')) v.fome.step(d);
        if (v.saude.revision !== v.revisaoSaude) {
          v.revisaoSaude = v.saude.revision;
          r.saude = this.fotoDe(v.saude);
          /* Ferida nova muda o desenho: o quadro guardado não serve mais. */
          if (r.figurante) this.vestir(r);
          /* MORREU fora do controle. O cadáver não pode ficar de pé na pose
             padrão: é o mesmo corpo, e corpo morto cai. */
          if (v.saude.dead) this.derrubar(r.id, {morte: true});
        }
        if (v.fome && v.fome.revision !== v.revisaoFome) {
          v.revisaoFome = v.fome.revision;
          r.fome = {fome: v.fome.fome, sede: v.fome.sede,
            efeitos: [...v.fome.efeitos.values()].map(e => ({id: e.id, fase: e.fase, restante: e.restante, forca: e.forca}))};
        }
      }
    }
    morto(r) { return !!(r?.vivo ? r.vivo.saude.dead : r?.saude?.dead); }
    /* Recolher: passar para o registro o que o corpo dos bastidores viveu.
       Desligar: tirá-lo do relógio e esquecê-lo — o registro já sabe tudo. */
    recolherBastidor(r) {
      const v = r?.vivo;
      if (!v) return;
      r.saude = this.fotoDe(v.saude);
      if (v.fome) r.fome = {fome: v.fome.fome, sede: v.fome.sede,
        efeitos: [...v.fome.efeitos.values()].map(e => ({id: e.id, fase: e.fase, restante: e.restante, forca: e.forca}))};
    }
    desligarBastidor(r) {
      const v = r?.vivo;
      if (!v) return;
      if (v.noRelogio) this.relogio?.remove?.(v.saude) ?? this.relogio?.characters?.delete?.(v.saude);
      r.vivo = null;
    }

    /* ------------------------------------------- a física de quem está em cena

       O figurante ganha o MESMO ragdoll do personagem controlado, amarrado ao
       esqueleto dele. O quadro de referência é o mesmo do jogo: origem em
       `x - 64`, chão em pixels de arte, escala 2. Enquanto o ragdoll está
       ligado é ele quem diz onde a pessoa está — `r.x` passa a ser lido do
       quadril, como o app.js faz com o corpo do jogo. */
    origemDe(r, f) {
      return {x: num(r.x) - LARG, y: this.chao - (f.rig.baseline + 1) * this.escala};
    }
    derrubar(id, {vx = 0, vy = 0, morte = false, acordar = true} = {}) {
      const r = typeof id === 'object' ? id : this.membros.get(id);
      if (!r || r.id === this.controlado()) return false;
      if (!this.ligado(r, 'fisica') || !this.Ragdoll) return false;
      const f = this.figurante(r);
      if (!f) return false;
      if (f.ragdoll?.active) { if (acordar) f.sono = 0; return true; }
      if (!r.palco) return false;
      f.ragdoll = f.ragdoll || new this.Ragdoll(f.rig, {autoRecover: false});
      f.ragdoll.healthParts = r.vivo?.saude?.parts || null;
      f.ragdoll.semDano = !this.ferramentas.danoAoArrastar;
      f.origem = r.poseOrigem ? {...r.poseOrigem} : this.origemDe(r, f);
      try { f.ragdoll.start({ground: (this.chao - f.origem.y) / this.escala, vx, vy}); }
      catch (e) { f.ragdoll = null; return false; }
      f.ragdoll.onImpact = (nome, vel) => this.impacto(r, nome, vel);
      f.sono = 0; f.morte = !!morte;
      f.cache.clear(); f.pixels = null; f.assinatura = null; f.vista = null; f.versao++;
      /* Zerar o atraso junto: com o quadro guardado jogado fora e o atraso
         ainda correndo, o personagem ficava invisível até ele vencer — um
         piscar no primeiro instante de todo arrasto. */
      f.atraso = 0;
      if (r.pose) this.vestirPose(f, r.pose);
      this.mudou('fisica');
      return true;
    }
    /* Pôr o corpo de volta na pose que ele tinha: é isto que faz um cadáver
       continuar caído depois de trocar de cena ou recarregar a página. */
    vestirPose(f, pose) {
      if (!f?.ragdoll?.bodies || !pose) return;
      for (const p of pose) {
        const b = f.ragdoll.bodies.get(p.n);
        if (!b) continue;
        b.x = num(p.x, b.x); b.y = num(p.y, b.y); b.angle = num(p.a, b.angle);
        b.vx = 0; b.vy = 0; b.omega = 0;
      }
      f.sono = SONO;
    }
    guardarPose(r, f) {
      if (!f?.ragdoll?.bodies) return;
      r.pose = [...f.ragdoll.bodies.values()].map(b => ({n: b.name, x: +b.x.toFixed(2), y: +b.y.toFixed(2), a: +b.angle.toFixed(3)}));
      r.poseOrigem = f.origem ? {...f.origem} : null;
      this.salvar();
    }
    levantar(id) {
      const r = typeof id === 'object' ? id : this.membros.get(id);
      const f = r?.figurante;
      if (!f?.ragdoll?.active) return false;
      if (this.morto(r)) return false;              // morto não levanta
      f.ragdoll.stop(); f.rig.physical = false; f.origem = null; r.pose = null; r.poseOrigem = null;
      f.motion.initialized = false;
      f.cache.clear(); f.pixels = null; f.assinatura = null; f.vista = null; f.versao++;
      /* Zerar o atraso junto: com o quadro guardado jogado fora e o atraso
         ainda correndo, o personagem ficava invisível até ele vencer — um
         piscar no primeiro instante de todo arrasto. */
      f.atraso = 0;
      this.mudou('fisica');
      return true;
    }
    /* A batida do corpo no chão. Só machuca quando o mestre quer: arrastar
       alguém pela cena é encenação, e encenação não deve abrir uma fratura. */
    impacto(r, nome, velocidade) {
      if (!this.ferramentas.danoAoArrastar) return;
      const saude = r.vivo?.saude;
      if (!saude || !this.ligado(r, 'saude')) return;
      try { saude.impact(nome, velocidade); } catch (e) {}
    }
    passoFisica(r, f, d) {
      if (this.tacticalClock?.()) return;
      const rag = f.ragdoll;
      if (!rag?.active) return;
      rag.semDano = !this.ferramentas.danoAoArrastar;
      if (r.congelado && !rag.grab) return;
      /* Dormir. Um corpo parado não se calcula: mede-se a velocidade de todas
         as peças e, abaixo do limiar por um tempinho, ele passa a custar
         nada até alguém encostar nele. */
      let vel = 0;
      for (const b of rag.bodies.values()) vel = Math.max(vel, Math.hypot(b.vx, b.vy) + Math.abs(b.omega) * 5);
      if (rag.grab || vel > SONO_VEL) f.sono = 0; else f.sono += d;
      if (f.sono >= SONO) { if (!r.pose) this.guardarPose(r, f); return; }
      r.pose = null;
      try { rag.step(Math.min(d, 1 / 30)); } catch (e) { return; }
      const quadril = rag.bodies.get('pelvis');
      if (!quadril) return;
      const pivo = rag.point(quadril, {x: -quadril.local.x, y: -quadril.local.y});
      const x = f.origem.x + (r.facing > 0 ? pivo.x : 64 - pivo.x) * this.escala;
      const parede = this.limitar(x);
      if (Math.abs(parede - x) > .01) f.origem.x += parede - x;
      r.x = parede;
    }
    /* Pegar o corpo com o mouse, no mesmo gesto com que se pega o personagem
       controlado. `px`/`py` estão em pixels de tela, com a câmera já somada
       em `camera`. */
    pegar(id, px, py, camera = 0) {
      const r = typeof id === 'object' ? id : this.membros.get(id);
      if (!r || r.travado) return false;
      if (!this.ligado(r, 'fisica')) return false;
      if (!this.derrubar(r)) return false;
      const f = r.figurante;
      if(this.pointerToLocal)[px,py]=this.pointerToLocal(r.id,px,py,camera);
      f.sono = 0; r.congelado = false;
      const local = (px + camera - f.origem.x) / this.escala;
      f.ragdoll.pick(r.facing > 0 ? local : 64 - local, (py - f.origem.y) / this.escala);
      this.agarrado = r.id;
      return true;
    }
    arrastar(px, py, camera = 0) {
      const r = this.agarrado ? this.membros.get(this.agarrado) : null;
      const f = r?.figurante;
      if (!f?.ragdoll?.grab) return false;
      if(this.pointerToLocal)[px,py]=this.pointerToLocal(r.id,px,py,camera);
      f.sono = 0;
      const local = (px + camera - f.origem.x) / this.escala;
      f.ragdoll.move(r.facing > 0 ? local : 64 - local, (py - f.origem.y) / this.escala);
      return true;
    }
    soltar() {
      const r = this.agarrado ? this.membros.get(this.agarrado) : null;
      this.agarrado = null;
      const f = r?.figurante;
      if (!f?.ragdoll?.active) return false;
      f.ragdoll.release(); f.sono = 0;
      this.mudou('fisica');
      return true;
    }

    /* ------------------------------------------------------------ o palco */
    limitar(x) { const f = this.parede; return f ? f(num(x, 240)) : num(x, 240); }
    /* Onde alguém está AGORA. Para quem está no corpo do jogo a resposta não
       é o registro — é o corpo, que andou desde a última vez que alguém
       olhou. Perguntar ao registro dava o lugar de onde ele saiu, e era assim
       que um figurante nascia em cima de quem se está controlando. */
    onde(id) {
      if (id && id === this.controlado()) {
        const x = num(this.corpo?.posicao?.() ?? this.corpo?.ler?.()?.x, NaN);
        if (Number.isFinite(x)) return x;
      }
      const r = this.membros.get(id);
      return Number.isFinite(r?.x) ? r.x : null;
    }
    /* Onde cabe mais um: passos de 56 px para os dois lados, o primeiro vão
       que não encosta em ninguém. Dois figurantes no mesmo pixel viram um
       borrão, e borrão não se clica. */
    vaga(base, id) {
      const ocupados = [];
      for (const r of this.membros.values()) {
        if (r.id === id || !(r.palco || r.id === this.controlado())) continue;
        const x = this.onde(r.id);
        if (Number.isFinite(x)) ocupados.push(x);
      }
      const alvo0 = this.limitar(base);
      if (!ocupados.some(x => Math.abs(x - alvo0) < 40)) return alvo0;
      for (let n = 1; n <= 12; n++) for (const s of [1, -1]) {
        const alvo = this.limitar(base + s * n * PASSO);
        if (!ocupados.some(x => Math.abs(x - alvo) < 40)) return alvo;
      }
      return this.limitar(base + PASSO);
    }
    /* Pôr em cena. Sem posição dita, entra a um passo de quem o mestre está
       controlando: é onde a câmera está olhando, e é de lá que ele arrasta. */
    entrar(id, {x = null, facing = null} = {}) {
      const r = this.registro(id);
      if (!r) return null;
      if (facing === 1 || facing === -1) r.facing = facing;
      if (id === this.controlado()) { r.palco = true; r.cena = this.cena; this.mudou('entrar'); return r; }
      const base = Number.isFinite(x) ? x
        : Number.isFinite(r.x) && r.cena === this.cena ? r.x
        : num(this.onde(this.controlado()), 240);
      r.x = Number.isFinite(x) ? this.limitar(x) : this.vaga(base, id);
      r.cena = this.cena; r.palco = true;
      this.figurante(r);
      this.mudou('entrar');
      return r;
    }
    /* Tirar de cena. O corpo do jogo não sai por aqui: para o personagem
       controlado sair do palco, alguém tem que assumir o corpo primeiro. */
    sair(id) {
      const r = this.membros.get(id);
      if (!r || id === this.controlado()) return false;
      r.palco = false;
      this.mudou('sair');
      return true;
    }
    alternar(id) { return this.noPalco(id) ? this.sair(id) : !!this.entrar(id); }
    noPalco(id) {
      const r = this.membros.get(id);
      return !!r && (!!r.palco || id === this.controlado());
    }
    /* Arrastar um figurante pela cena é encenação, e encenação acontece a 60
       quadros por segundo: durante o arrasto ninguém é avisado nem nada é
       salvo, e a mesa só sabe quando o mestre solta. */
    mover(id, x, {avisar = true} = {}) {
      const r = this.membros.get(id);
      if (!r) return false;
      if (id === this.controlado()) { this.corpo?.mover?.(this.limitar(x)); return true; }
      r.x = this.limitar(x);
      if (avisar) this.mudou('mover');
      return true;
    }
    /* Trazer alguém para o lado de quem está sendo controlado: é o gesto de
       pôr o figurante em cena de novo sem procurá-lo pelo cenário. */
    chamar(id) {
      const r = this.registro(id);
      if (!r) return false;
      const base = num(this.onde(this.controlado()), 240);
      r.palco = true; r.cena = this.cena;
      r.x = this.vaga(base, id);
      r.facing = r.x > base ? -1 : 1;                 // chega olhando para quem o chamou
      if (r.figurante) r.figurante.raster = null;
      this.figurante(r);
      this.mudou('chamar');
      return true;
    }
    /* A ficha de alguém, aberta na tela da ficha. Quem abre é o jogo (o
       app.js liga `aoAbrirFicha`); aqui só se garante que a ficha folheada
       é a da pessoa clicada. */
    abrirFicha(id) {
      const i = this.F?.fichas.findIndex(f => f.id === id) ?? -1;
      if (i >= 0) this.F.selecionar(i);
      this.aoAbrirFicha?.(id);
      return i >= 0;
    }
    virar(id) {
      const r = this.membros.get(id);
      if (!r) return false;
      if (id === this.controlado()) { this.corpo?.virar?.(); return true; }
      r.facing = r.facing === 1 ? -1 : 1;
      if (r.figurante) r.figurante.raster = null;
      this.mudou('virar');
      return true;
    }
    /* Quem aparece no cenário agora: quem está no palco, nesta cena, menos
       quem está no corpo do jogo — esse o próprio jogo desenha. */
    emCena() {
      const dono = this.controlado();
      const fora = [];
      for (const r of this.membros.values())
        if (r.palco && r.id !== dono && (!this.cena || !r.cena || r.cena === this.cena) && this.ficha(r.id)) fora.push(r);
      return fora.sort((a, b) => num(a.x) - num(b.x));
    }
    /* Todo mundo da mesa, na ordem das fichas, do jeito que o painel lista. */
    lista() {
      if (!this.F) return [];
      const dono = this.controlado();
      return this.F.fichas.map((f, i) => {
        const r = this.registro(f.id);
        /* A condição é o quanto do corpo ainda está de pé, em porcentagem do
           que ELE aguenta — e não a vida absoluta, que o vigor de SUBSTÂNCIA
           encolhe: um personagem franzino e inteiro não pode aparecer na
           lista como se estivesse machucado. */
        const vida = f.id === dono ? num(this.corpo?.vitalidade?.(), 100)
          : r?.vivo ? r.vivo.saude.vitality : num(r?.saude?.condicao, num(r?.saude?.vitality, 100));
        const fome = f.id === dono ? null : r?.vivo?.fome
          ? {fome: Math.round(r.vivo.fome.fome), sede: Math.round(r.vivo.fome.sede),
             estagio: Math.max(r.vivo.fome.estagio('fome'), r.vivo.fome.estagio('sede'))}
          : r?.fome ? {fome: Math.round(num(r.fome.fome)), sede: Math.round(num(r.fome.sede)), estagio: 0} : null;
        return {id: f.id, indice: i, nome: this.nome(f.id), controlado: f.id === dono,
          palco: f.id === dono || !!r?.palco, x: r?.x ?? null, cena: r?.cena ?? null,
          vida: Math.round(vida), morto: f.id === dono ? !!this.corpo?.morto?.() : this.morto(r),
          fome, selecionado: this.selecao.has(f.id),
          travado: !!r?.travado, oculto: !!r?.oculto, congelado: !!r?.congelado,
          caido: !!r?.figurante?.ragdoll?.active,
          sistemas: Object.fromEntries(SISTEMAS.map(q => [q, this.ligado(r, q)])),
          proprios: Object.fromEntries(SISTEMAS.map(q => [q, bool(r?.sistemas?.[q])]))};
      });
    }

    /* ------------------------------------------------------------ o controle */
    /* A troca. Guarda quem sai, veste quem entra, e devolve os dois para
       quem quiser avisar a mesa. */
    assumir(id) {
      if (!this.F || !this.corpo) return null;
      const alvo = this.registro(id);
      if (!alvo) return null;
      const donoId = this.controlado();
      if (donoId === id) return null;
      const foto = this.corpo.ler?.() || {};
      const dono = donoId ? this.registro(donoId) : null;
      if (dono) {
        if (Number.isFinite(foto.x)) dono.x = foto.x;
        dono.facing = foto.facing === -1 ? -1 : 1;
        if (foto.look) dono.look = foto.look;
        if (foto.saude !== undefined) dono.saude = foto.saude;
        if (foto.fome !== undefined) dono.fome = foto.fome;
        dono.cena = this.cena; dono.palco = true;
        /* A POSE FÍSICA vem junto. Quem sai do corpo caído — porque morreu,
           porque desmaiou, porque o mestre o derrubou — continua caído
           exatamente onde e como estava. Sem isto o cadáver se levantava e
           ficava de pé na pose padrão no instante em que o mestre assumia
           outra pessoa, que é o contrário de tudo o que o jogo mostra. */
        dono.pose = foto.pose || null;
        dono.poseOrigem = foto.poseOrigem || null;
        /* O corpo que corre nos bastidores renasce da foto nova. */
        this.desligarBastidor(dono);
        /* O figurante de quem saiu nasce (ou se troca) já com a roupa e as
           feridas com que o corpo foi deixado: quem sai do controle tem de
           continuar visivelmente a mesma pessoa. */
        if (this.figurante(dono)) this.vestir(dono);
      }
      if (!Number.isFinite(alvo.x) || (alvo.cena && this.cena && alvo.cena !== this.cena))
        alvo.x = this.vaga(Number.isFinite(foto.x) ? foto.x : 240, id);
      alvo.palco = true; alvo.cena = this.cena;
      /* A ficha muda de dono ANTES do corpo: é ela que manda no vigor de
         SUBSTÂNCIA, e o corpo precisa acordar já com a resistência de quem
         entrou nele. */
      const i = this.F.fichas.findIndex(f => f.id === id);
      this.F.porEmCena(id);
      if (i >= 0) this.F.selecionar(i);
      /* O que estava correndo nos bastidores de quem ENTRA é a verdade dele:
         a fome que passou, a ferida que infeccionou, o sangue que perdeu.
         Recolhe-se tudo para a foto antes de o corpo do jogo vesti-la. */
      this.recolherBastidor(alvo);
      this.desligarBastidor(alvo);
      if (alvo.figurante?.ragdoll?.active) { this.guardarPose(alvo, alvo.figurante); alvo.figurante.ragdoll.stop(); alvo.figurante.origem = null; }
      this.corpo.vestir?.({x: alvo.x, facing: alvo.facing, look: this.look(id),
        saude: alvo.saude || null, fome: alvo.fome || null, novo: !alvo.saude, id, nome: this.nome(id),
        pose: alvo.pose || null, poseOrigem: alvo.poseOrigem || null});
      if (alvo.figurante) { alvo.figurante.desenho = null; alvo.figurante.raster = null; }
      /* A física de quem SAIU só se acerta DEPOIS da troca: até a ficha mudar
         de dono, ele ainda é "o controlado", e o corpo do jogo é que manda
         nele. Derrubar antes não fazia nada — e o cadáver aparecia de pé. */
      if (dono) {
        if (dono.pose || this.morto(dono)) this.derrubar(dono, {morte: this.morto(dono)});
        else if (dono.figurante?.ragdoll?.active) this.levantar(dono);
      }
      this.revisarSistemas();
      this.mudou('assumir');
      return {de: dono, para: alvo};
    }

    /* Criar e excluir, como o mestre pede. A ficha é a pessoa: criar uma
       ficha é contratar alguém, excluir é tirar da mesa junto com o corpo. */
    criar(nome = '') {
      const f = this.F?.criar(nome);
      if (!f) return null;
      const r = this.registro(f.id);
      this.look(f.id);
      this.mudou('criar');
      return r;
    }
    excluir(id) {
      if (!this.F) return false;
      this.lembrar('excluir');
      const dono = this.controlado();
      /* Excluir quem está sendo controlado deixaria o corpo do jogo sem
         ficha. Então o corpo passa antes para outra ficha — a ficha.js já
         escolhe a primeira da lista, e aqui o corpo vai atrás dela. */
      if (id === dono) {
        const outra = this.F.fichas.find(f => f.id !== id);
        if (!outra) return false;
        this.assumir(outra.id);
      }
      const ok = this.F.remover(id);
      if (!ok) return false;
      this.desligarBastidor(this.membros.get(id));
      this.selecao.delete(id);
      this.membros.delete(id);
      this.mudou('excluir');
      return true;
    }

    /* ------------------------------------------------------------ o quadro */
    naTela(r, camera) {
      const x = num(r.x) - num(camera);
      return x > TELA_ESQ && x < TELA_DIR;
    }
    passo(dt, {camera = null} = {}) {
      const d = Math.max(0, Math.min(num(dt), .1));
      /* Os bastidores andam para TODA a mesa, esteja quem estiver em cena:
         a fome de quem ficou no Escritório não espera o mestre olhar. */
      if (d > 0) this.passoSistemas(this.tacticalClock?.() ? 0 : d);
      for (const r of this.emCena()) {
        const f = this.figurante(r);
        if (!f) continue;
        /* A FÍSICA roda mesmo fora do enquadramento — um corpo que cai atrás
           da câmera tem de estar no chão quando a câmera chegar lá. É barato
           porque corpo parado dorme. */
        if (f.ragdoll?.active) { f.atraso -= d; this.passoFisica(r, f, d); if (camera !== null && !this.naTela(r, camera)) f.desenho = null; continue; }
        /* Quem está fora do enquadramento não anima nem desenha: a cena tem
           mais largura do que a tela, e ninguém paga por quem não se vê. */
        if (camera !== null && !this.naTela(r, camera)) { f.desenho = null; continue; }
        f.t += d; f.atraso -= d;
        f.fisica.x = num(r.x); f.fisica.vx = 0; f.fisica.vy = 0; f.fisica.y = 0;
        f.fisica.grounded = true; f.fisica.facing = r.facing;
        try { f.motion.update(d, this.walking?.(r.id)?'walk':'idle', f.t, f.fisica, r.facing); } catch (e) { /* um figurante nunca derruba o quadro */ }
        this.afterPose?.(r, f);
      }
    }
    /* A ASSINATURA de um quadro: tudo que muda o desenho, em passos de um
       pixel — onde cada osso está, o desvio da roupa, o piscar e o olhar.
       Duas assinaturas iguais dão o mesmo desenho, e DESENHAR custa umas cem
       vezes mais do que COMPARAR. Então o figurante desenha uma vez cada pose
       e, na volta seguinte da respiração, repete o que já tem guardado: a
       partir do segundo ciclo ele praticamente não custa mais nada. */
    assinatura(f, r) {
      const rig = f.rig;
      let s = (r.facing === -1 ? 'e' : 'd') + f.versao;
      for (const w of rig.world.values())
        s += '|' + Math.round(w.x) + ',' + Math.round(w.y) + ',' + Math.round(w.c * 32) + ',' + Math.round(w.s * 32);
      for (const dr of rig.drift.values()) s += '|' + Math.round(dr[0]) + ',' + Math.round(dr[1]);
      for (const v of rig.sway.values()) s += '|' + Math.round(v[80] || 0) + ',' + Math.round(v[81] || 0);
      return s + '|' + (rig.blink >= .75 ? 2 : rig.blink > 0 ? 1 : 0) + (rig.gaze < 0 ? '-' : '+');
    }
    tela(f, larg = LARG, alt = ALT) {
      if (!f.tela) f.tela = this.fazerTela ? this.fazerTela(larg, alt) : null;
      if (f.tela && (f.tela.width !== larg || f.tela.height !== alt)) { f.tela.width = larg; f.tela.height = alt; }
      return f.tela;
    }
    /* O RECORTE de um corpo com física. O personagem controlado usa uma janela
       fixa de 144×144 em volta do quadril, e ela custa 11 ms por quadro. Um
       corpo caído cabe em muito menos que isso — e o recorte apertado sai mais
       barato até do que desenhar alguém de pé. A física acha os cantos de
       graça: as peças já sabem onde estão. */
    recorte(f) {
      let e = Infinity, t = Infinity, d = -Infinity, b = -Infinity;
      for (const corpo of f.ragdoll.bodies.values())
        for (const p of corpo.shape) {
          const q = f.ragdoll.point(corpo, p);
          if (q.x < e) e = q.x; if (q.x > d) d = q.x;
          if (q.y < t) t = q.y; if (q.y > b) b = q.y;
        }
      if (!Number.isFinite(e)) return null;
      const x = Math.floor(e) - 4, y = Math.floor(t) - 6;
      return {x, y, width: Math.min(200, Math.ceil(d) - x + 8), height: Math.min(200, Math.ceil(b) - y + 8)};
    }
    /* Os figurantes, atrás do personagem controlado, com a luz da cena por
       cima — sem isso eles ficavam acesos numa sala escura. */
    desenhar(ctx, {camera = 0, chao = this.chao, escala = this.escala, luz = null, only = null} = {}) {
      if (!ctx) return;
      this.chao = chao; this.escala = escala;
      for (const r of this.emCena()) {
        if (only && r.id !== only) continue;
        const f = this.figurante(r);
        if (!f) continue;
        if (!this.naTela(r, camera)) { f.desenho = null; continue; }
        const fisico = !!f.ragdoll?.active;
        /* Um corpo com física desenha só o retângulo que ele ocupa. De pé, o
           quadro é sempre o mesmo 64×96; caído, o recorte muda a cada quadro
           e entra na chave junto com a pose. */
        let view = null;
        if (fisico) {
          try { f.ragdoll.apply(); } catch (e) { }
          view = this.recorte(f);
          if (!view) continue;
        }
        const chave = this.assinatura(f, r) + (view ? '@' + view.x + ',' + view.y + ',' + view.width + ',' + view.height : '');
        if ((chave !== f.assinatura || !f.pixels) && f.atraso <= 0) {
          let px = f.cache.get(chave);
          if (!px) {
            try { px = f.rig.rasterize({facing: r.facing, outfit: f.slots, hidden: this.escondidos(r), wounds: f.feridas, viewport: view}); }
            catch (e) { px = null; }
            /* Guardar a pose de um corpo com física não serve para nada: ela
               nunca se repete exatamente, e cada quadro desses é um buffer
               grande. Só o corpo de pé, que respira em ciclo, se repete. */
            if (px && !fisico) {
              f.cache.set(chave, px);
              if (f.cache.size > CACHE) f.cache.delete(f.cache.keys().next().value);
            }
          }
          if (px) {
            /* O QUADRO PRONTO e a MOLDURA DELE andam juntos, sempre. */
            f.pixels = px; f.assinatura = chave;
            f.larg = view ? view.width : LARG; f.alt = view ? view.height : ALT;
            f.vista = view ? {...view} : null;
            f.atraso = fisico ? QUADROS_FISICA : QUADROS;
          }
        }
        if (!f.pixels) continue;              // ainda não desenhou nem uma vez
        /* Daqui para baixo tudo sai do quadro pronto e do recorte DELE, e
           nunca do recorte que se acabou de medir.

           O desenho de um corpo caindo fica até 1/30 s atrás da física, de
           propósito — é o que faz quatro corpos caírem juntos sem derrubar o
           quadro. Misturar as duas coisas punha o pixel numa moldura que não
           era a dele: nos quadros em que os tamanhos não batiam,
           `putImageData` recusava o dado e o personagem SUMIA da tela por um
           quadro. Era isso que fazia o sprite piscar enquanto o mestre
           arrastava alguém — um quarto dos quadros do arrasto. */
        const vista = f.vista, larg = f.larg, alt = f.alt;
        const tela = this.tela(f, larg, alt);
        if (!tela) continue;
        const x = vista ? Math.round(f.origem.x - camera + (r.facing > 0 ? vista.x : 64 - vista.x - larg) * escala)
          : Math.round(num(r.x) - camera - LARG);
        const y = vista ? Math.round(f.origem.y + vista.y * escala)
          : Math.round(chao - (f.rig.baseline + 1) * escala);
        /* ESCONDIDO é o personagem que está em cena e agindo, mas que ninguém
           vê: a emboscada esperando atrás da porta. O mestre o encontra pela
           etiqueta, que é desenhada depois do quadro dos jogadores. */
        if (r.oculto) { f.desenho = {x, y, w: larg * escala, h: alt * escala, escala}; continue; }
        /* A luz da cena é aplicada a cada quadro, e não guardada junto com o
           desenho: o mestre muda a luz ao vivo, e o figurante tem de escurecer
           com a sala no mesmo instante. */
        const pintado = luz ? luz(f.pixels) : f.pixels;
        try { tela.getContext('2d').putImageData(new root.ImageData(pintado, larg, alt), 0, 0); } catch (e) { continue; }
        ctx.fillStyle = '#20271d';
        ctx.fillRect(Math.round(num(r.x) - camera - 17), chao - 1, 34, 2);
        ctx.drawImage(tela, x, y, larg * escala, alt * escala);
        f.desenho = {x, y, w: larg * escala, h: alt * escala, escala};
      }
    }
    /* A etiqueta com o nome. Desenhada DEPOIS do finishFrame, de propósito:
       é anotação de mestre, não cenário — os jogadores veem a pessoa, não a
       plaquinha com o nome dela. */
    etiquetas(ctx, {camera = 0, K = root.PixelKit} = {}) {
      if (!ctx || !K) return;
      /* A caixa de seleção é anotação de mestre: desenhada aqui, depois do
         quadro que vai para os jogadores, junto com as plaquinhas. */
      if (this.caixa) {
        const c = this.caixa;
        const e = Math.min(c.x1, c.x2), t = Math.min(c.y1, c.y2);
        const w = Math.abs(c.x2 - c.x1), h = Math.abs(c.y2 - c.y1);
        ctx.save();
        ctx.fillStyle = 'rgba(125,224,200,.10)';
        ctx.fillRect(e, t, w, h);
        ctx.strokeStyle = '#7de0c8'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.round(e) + .5, Math.round(t) + .5, Math.round(w), Math.round(h));
        ctx.restore();
      }
      const postas = [];
      for (const r of this.emCena()) {
        const f = r.figurante;
        if (!f || !f.desenho) continue;
        const aceso = this.sobre === r.id, escolhido = this.selecao.has(r.id);
        /* Um personagem ESCONDIDO não aparece no quadro dos jogadores, mas o
           mestre precisa saber onde ele está: aqui, depois do finishFrame, ele
           ganha um contorno tracejado e a etiqueta de sempre. */
        /* A MOLDURA de uma pessoa. De pé, o quadro tem 64×96 e ela ocupa vinte
           pixels no meio dele, então a caixa é desenhada em volta do corpo e
           não da folha; caída, o recorte já é justo, e a caixa é ele mesmo. */
        const g = f.desenho, caido = !!f.ragdoll?.active;
        const cx0 = Math.round(num(r.x) - camera);
        const cima = caido ? g.y + 1 : g.y + 18;
        const baixo = caido ? g.y + g.h - 1 : this.chao - 1;
        const meia = caido ? Math.max(14, Math.round(g.w / 2)) : 16;
        if (r.oculto) {
          ctx.save();
          ctx.strokeStyle = '#7e5aa8'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
          ctx.strokeRect(cx0 - meia + .5, cima + .5, meia * 2 - 1, Math.max(6, baixo - cima - 1));
          ctx.restore();
        }
        /* Quem está SELECIONADO ganha os colchetes e a base acesa: é a única
           forma de o mestre saber quem vai junto quando ele arrastar. */
        if (escolhido) {
          ctx.fillStyle = '#7de0c8';
          ctx.fillRect(cx0 - meia + 1, baixo, meia * 2 - 2, 1);
          const braco = Math.min(7, Math.max(3, Math.round(meia / 2)));
          for (const [px, py, w, h] of [
            [cx0 - meia, cima, 1, braco], [cx0 - meia, cima, braco, 1],
            [cx0 + meia - 1, cima, 1, braco], [cx0 + meia - braco, cima, braco, 1],
            [cx0 - meia, baixo - braco, 1, braco], [cx0 - meia, baixo, braco, 1],
            [cx0 + meia - 1, baixo - braco, 1, braco], [cx0 + meia - braco, baixo, braco, 1]]) ctx.fillRect(px, py, w, h);
        }
        const marcas = (r.travado ? '\u00b7' : '') + (r.congelado ? '*' : '');
        const nome = this.nome(r.id) + (marcas ? ' ' + marcas : '');
        const largura = K.measure(nome, '3x5') + 6;
        const cx = Math.round(num(r.x) - camera);
        const esq = cx - Math.round(largura / 2);
        /* Duas pessoas encostadas põem duas plaquinhas no mesmo lugar, e duas
           plaquinhas embaralhadas não são nome de ninguém: quem chega depois
           sobe um degrau até achar altura livre. */
        let topo = Math.round(this.chao - 132), degrau = 0;
        while (degrau < 4 && postas.some(p => p.topo === topo && esq < p.esq + p.largura + 2 && esq + largura + 2 > p.esq)) {
          topo -= 11; degrau++;
        }
        postas.push({esq, largura, topo});
        ctx.fillStyle = aceso ? '#48163f' : escolhido ? '#10382f' : '#180820';
        ctx.fillRect(cx - Math.round(largura / 2), topo, largura, 9);
        ctx.fillStyle = aceso ? '#ffd18c' : escolhido ? '#7de0c8' : '#a44590';
        ctx.fillRect(cx - Math.round(largura / 2), topo + 8, largura, 1);
        K.drawText(ctx, nome, cx, topo + 2, {font: '3x5', color: aceso ? '#ffd18c' : '#f3b4e8', align: 'center'});
        if (aceso) {
          const d = f.desenho;
          ctx.fillStyle = '#ffd18c';
          for (const [px, py, w, h] of [[d.x + 40, d.y + 20, 2, 10], [d.x + 40, d.y + 20, 10, 2],
            [d.x + d.w - 42, d.y + 20, 2, 10], [d.x + d.w - 50, d.y + 20, 10, 2]]) ctx.fillRect(px, py, w, h);
        }
      }
    }
    /* Quem está debaixo do cursor. Testa o alfa do desenho, e não a moldura:
       o quadro tem 64 px de largura e a pessoa ocupa vinte, então caixa
       inteira pegava meio cenário. A folga existe porque braço de pixel art
       tem um pixel e ninguém deve caçar pixel com o mouse. */
    sob(px, py, {folga = 4} = {}) {
      let achado = null;
      for (const r of this.emCena()) {
        const f = r.figurante;
        if (!f || !f.desenho || !f.pixels) continue;
        const d = f.desenho;
        if (px < d.x - folga * d.escala || px > d.x + d.w + folga * d.escala || py < d.y || py > d.y + d.h) continue;
        const larg = f.larg || LARG, alt = f.alt || ALT;
        const ax = Math.floor((px - d.x) / d.escala), ay = Math.floor((py - d.y) / d.escala);
        let bateu = false;
        for (let y = Math.max(0, ay - folga); y <= Math.min(alt - 1, ay + folga) && !bateu; y++)
          for (let x = Math.max(0, ax - folga); x <= Math.min(larg - 1, ax + folga); x++)
            if (f.pixels[(y * larg + x) * 4 + 3]) { bateu = true; break; }
        if (!bateu) continue;
        const dist = Math.abs(px - (d.x + d.w / 2));
        if (!achado || dist < achado.dist) achado = {dist, r};
      }
      return achado ? achado.r : null;
    }

    /* O RETRATO do painel: a mesma pessoa que está na cena, do peito para
       cima, num quadro pequeno. Nasce do mesmo look e do mesmo rasterizador,
       então a lista do mestre nunca mente sobre quem é quem. O recorte sai do
       próprio desenho — acha a silhueta e pega o alto dela — porque o que
       está vestido muda a altura do que aparece. */
    retrato(id, ctx, {w = 34, h = 44} = {}) {
      if (!ctx || !this.Rig || !this.asset || !this.fazerTela) return false;
      const r = this.registro(id);
      if (!r) return false;
      const look = (id === this.controlado() ? this.corpo?.ler?.()?.look : null) || this.look(id);
      if (!this.rascunho) {
        this.rascunho = {rig: new this.Rig(this.asset), tela: this.fazerTela(LARG, ALT)};
        if (this.Motion && this.Fisica) {
          this.rascunho.motion = new this.Motion(this.rascunho.rig);
          this.rascunho.fisica = new this.Fisica();
        }
      }
      const s = this.rascunho, rig = s.rig;
      let slots = new Set();
      if (this.W) { const v = this.W.resolve(this.asset, look || {}); slots = v.slots; rig.restyle(v.tints); }
      if (s.motion && s.fisica) {
        s.fisica.x = 0; s.fisica.vx = 0; s.fisica.vy = 0; s.fisica.y = 0; s.fisica.grounded = true; s.fisica.facing = 1;
        try { s.motion.update(0, 'rest', 0, s.fisica, 1); } catch (e) {}
      }
      let px;
      try { px = rig.rasterize({facing: 1, outfit: slots, hidden: this.escondidos(r), wounds: this.feridas(r)}); }
      catch (e) { return false; }
      let x0 = LARG, x1 = -1, y0 = ALT, y1 = -1;
      for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++)
        if (px[(y * LARG + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return false;
      try { s.tela.getContext('2d').putImageData(new root.ImageData(px, LARG, ALT), 0, 0); } catch (e) { return false; }
      const altura = Math.max(8, Math.round((y1 - y0 + 1) * .42));
      const largura = Math.max(8, Math.round(altura * w / h));
      const meio = (x0 + x1 + 1) / 2;
      const cx = Math.max(0, Math.min(LARG - largura, Math.round(meio - largura / 2)));
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(s.tela, cx, Math.max(0, y0 - 1), largura, altura, 0, 0, w, h);
      return true;
    }

    /* As opções do botão direito. O app só precisa saber o que fazer com a
       chave escolhida. */
    opcoes(id) {
      const dono = this.controlado();
      const r = this.membros.get(id);
      const itens = [];
      if (id !== dono) itens.push({chave: 'assumir', rotulo: 'Assumir o controle', atalho: 'no corpo'});
      itens.push({chave: 'ficha', rotulo: 'Abrir a ficha', atalho: 'C'});
      if (id !== dono) itens.push({chave: 'chamar', rotulo: 'Trazer para perto'});
      itens.push({chave: 'virar', rotulo: 'Virar de lado'});
      if (id !== dono) {
        itens.push({chave: 'selecionar', rotulo: this.selecao.has(id) ? 'Tirar da seleção' : 'Selecionar', atalho: 'Shift+clique'});
        itens.push({chave: 'duplicar', rotulo: 'Duplicar', atalho: 'Alt+arrastar'});
        const caido = !!r?.figurante?.ragdoll?.active;
        itens.push({chave: caido ? 'levantar' : 'derrubar', rotulo: caido ? 'Levantar' : 'Derrubar', atalho: caido ? 'V' : 'Q'});
        itens.push({chave: 'congelar', rotulo: r?.congelado ? 'Descongelar' : 'Congelar no lugar', atalho: 'X'});
        itens.push({chave: 'travar', rotulo: r?.travado ? 'Destravar' : 'Travar'});
        itens.push({chave: 'ocultar', rotulo: r?.oculto ? 'Revelar' : 'Esconder dos jogadores', atalho: 'O'});
        itens.push({chave: 'curar', rotulo: 'Curar por inteiro'});
        itens.push({chave: 'sair', rotulo: 'Tirar de cena', perigo: true});
      }
      return itens;
    }

    /* ------------------------------------------------ as mãos do mestre
       Seleção, e o que se faz com vários de uma vez. O gesto é o de sempre
       em qualquer editor: clicar troca a seleção, Shift+clicar soma, arrastar
       no vazio desenha a caixa, arrastar alguém selecionado leva o grupo. */
    selecionar(id, {somar = false} = {}) {
      if (!id || !this.membros.has(id)) return false;
      if (somar) { if (this.selecao.has(id)) this.selecao.delete(id); else this.selecao.add(id); }
      else { this.selecao.clear(); this.selecao.add(id); }
      this.mudou('selecao');
      return true;
    }
    limparSelecao() { if (!this.selecao.size) return false; this.selecao.clear(); this.mudou('selecao'); return true; }
    selecionarCaixa(x1, y1, x2, y2, {somar = false} = {}) {
      const e = Math.min(x1, x2), d = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
      if (!somar) this.selecao.clear();
      for (const r of this.emCena()) {
        const g = r.figurante?.desenho;
        if (!g) continue;
        /* A caixa pega quem ENCOSTA nela, e não só quem cabe inteiro dentro:
           ninguém desenha uma caixa em volta de um personagem inteiro para
           depois descobrir que faltou um pixel do pé. */
        if (g.x + g.w < e || g.x > d || g.y + g.h < t || g.y > b) continue;
        this.selecao.add(r.id);
      }
      this.mudou('selecao');
      return this.selecao.size;
    }
    selecionados() { return [...this.selecao].map(id => this.membros.get(id)).filter(r => r && this.ficha(r.id)); }
    /* Mover o grupo inteiro guardando as distâncias entre eles. Com física no
       meio, mover é TELETRANSPORTAR e reassentar: empurrar com força faria os
       corpos se atropelarem e sairia voando gente que ninguém tocou. */
    moverSelecao(dx, {lembrar = false} = {}) {
      const gente = this.selecionados();
      if (!gente.length || !dx) return 0;
      if (lembrar) this.lembrar('mover');
      for (const r of gente) {
        const novo = this.limitar(num(r.x) + dx), passo = novo - num(r.x);
        r.x = novo;
        const f = r.figurante;
        if (f?.ragdoll?.active && f.origem) {
          f.origem.x += passo;
          if (r.pose) r.poseOrigem = {...f.origem};
        }
      }
      return gente.length;
    }
    /* Espalhar em fila, do primeiro ao último, com o vão de sempre: é como se
       enfileira um pelotão sem catar pixel a pixel. */
    espalhar(vao = PASSO) {
      const gente = this.selecionados().sort((a, b) => num(a.x) - num(b.x));
      if (gente.length < 2) return 0;
      this.lembrar('espalhar');
      const base = num(gente[0].x);
      gente.forEach((r, i) => this.mover(r.id, base + i * vao, {avisar: false}));
      this.mudou('mover');
      return gente.length;
    }
    /* ------------------------------------------------------------ desfazer
       Toda ferramenta do mestre é destrutiva de algum jeito — tirar de cena,
       derrubar, duplicar, excluir. Uma pilha de estados antes de cada gesto é
       o que permite experimentar: sem ela, a mesa vira campo minado. O que se
       guarda é o registro do elenco e a lista de fichas; quem está no corpo do
       jogo NÃO volta atrás, porque o corpo é do jogo e não da ferramenta — e
       um desfazer que troca o corpo por baixo do mestre assusta mais do que
       ajuda. */
    lembrar(rotulo = '') {
      if (this.semLembrar) return;
      this.pilha = this.pilha || [];
      this.pilha.push({rotulo, controlado: this.controlado(),
        ficha: this.F?.exportar ? this.F.exportar() : null, elenco: this.exportar()});
      if (this.pilha.length > 24) this.pilha.shift();
    }
    podeDesfazer() { return !!this.pilha?.length; }
    desfazer() {
      const p = this.pilha?.pop();
      if (!p) return null;
      const dono = this.controlado();
      if (p.ficha && this.F?.importar) {
        /* Quem está no corpo continua no corpo: a ficha volta como era, menos
           a marca de "em cena", que é o elo com o corpo do jogo. */
        const copiaFicha = copia(p.ficha);
        if (dono && copiaFicha.fichas?.some(f => f.id === dono)) copiaFicha.ativa = dono;
        this.F.importar(copiaFicha);
      }
      this.sincronizar();
      this.semLembrar = true;
      try { this.importar(p.elenco); } finally { this.semLembrar = false; }
      for (const r of this.membros.values()) {
        if (r.figurante?.ragdoll?.active) { r.figurante.ragdoll.stop(); r.figurante.origem = null; }
        if (r.figurante) { this.vestir(r); if (r.pose || this.morto(r)) this.derrubar(r, {morte: this.morto(r)}); }
      }
      this.mudou('desfazer');
      return p.rotulo || 'desfeito';
    }
    /* Uma ação em todo mundo que está selecionado (ou numa pessoa só). */
    emMassa(acao, ids = null) {
      const alvos = (ids || [...this.selecao]).filter(id => this.membros.has(id));
      if (!alvos.length) return 0;
      this.lembrar(acao);
      this.semLembrar = true;
      let n = 0;
      try { for (const id of alvos) if (this.aplicar(acao, id)) n++; } finally { this.semLembrar = false; }
      if (n) this.mudou(acao);
      return n;
    }
    aplicar(acao, id) {
      const r = this.membros.get(id);
      if (!r) return false;
      this.lembrar(acao);
      const antes = this.semLembrar;
      this.semLembrar = true;
      try { return this.aplicarGesto(acao, id, r); } finally { this.semLembrar = antes; }
    }
    aplicarGesto(acao, id, r) {
      const dono = id === this.controlado();
      switch (acao) {
        case 'derrubar': return dono ? !!this.corpo?.derrubar?.() : this.derrubar(r);
        case 'levantar': return dono ? !!this.corpo?.levantar?.() : this.levantar(r);
        case 'congelar': r.congelado = !r.congelado; return true;
        case 'travar': r.travado = !r.travado; return true;
        case 'ocultar': if (dono) return false; r.oculto = !r.oculto; return true;
        case 'curar': return this.curar(id);
        case 'virar': return this.virar(id);
        case 'chamar': return this.chamar(id);
        case 'palco': return this.alternar(id);
        case 'duplicar': return !!this.duplicar(id);
        case 'excluir': return this.excluir(id);
        default: return false;
      }
    }
    /* Curar por inteiro: o corpo volta a ser o que era antes de tudo, com o
       vigor da ficha dele. É a ferramenta que permite ao mestre experimentar
       sem medo — e ela é a única maneira de desfazer um membro decepado. */
    curar(id) {
      const r = this.membros.get(id);
      if (!r) return false;
      if (id === this.controlado()) return !!this.corpo?.curar?.();
      this.desligarBastidor(r);
      r.saude = null; r.pose = null; r.poseOrigem = null;
      const v = this.bastidor(r);
      if (v) r.saude = this.fotoDe(v.saude);
      if (r.figurante?.ragdoll?.active) this.levantar(r);
      if (r.figurante) this.vestir(r);
      return true;
    }
    /* Duplicar: uma ficha nova, a mesma cara, a mesma roupa, o mesmo corpo, um
       passo ao lado. É o gesto mais repetido de quem povoa uma cena. */
    duplicar(id) {
      const r = this.membros.get(id);
      if (!r || !this.F) return null;
      this.lembrar('duplicar');
      const base = this.nome(id).replace(/\s+\d+$/, '');
      const f = this.F.criar(base);
      if (!f) return null;
      const novo = this.registro(f.id);
      if (!novo) return null;
      novo.look = copia(id === this.controlado() ? (this.corpo?.ler?.()?.look || this.look(id)) : this.look(id));
      novo.saude = copia(id === this.controlado() ? this.corpo?.ler?.()?.saude : (r.vivo ? this.fotoDe(r.vivo.saude) : r.saude));
      novo.fome = copia(r.vivo?.fome ? {fome: r.vivo.fome.fome, sede: r.vivo.fome.sede, efeitos: []} : r.fome);
      novo.facing = r.facing;
      novo.sistemas = {...r.sistemas};
      novo.cena = this.cena; novo.palco = true;
      novo.x = this.vaga(num(this.onde(id), 240), f.id);
      this.figurante(novo);
      this.mudou('duplicar');
      return novo;
    }
    definirFerramenta(qual) { this.ferramentas.ferramenta = qual; this.mudou('ferramenta'); return qual; }
    definirDanoAoArrastar(v) {
      this.ferramentas.danoAoArrastar = !!v;
      for (const r of this.membros.values()) if (r.figurante?.ragdoll) r.figurante.ragdoll.semDano = !v;
      this.corpo?.danoAoArrastar?.(!!v);
      this.mudou('ferramenta');
      return this.ferramentas.danoAoArrastar;
    }

    /* ------------------------------------------------------------ memória */
    exportar() {
      for (const r of this.membros.values()) this.recolherBastidor(r);
      return {sistemas: {...this.sistemas}, ferramentas: {...this.ferramentas},
        membros: [...this.membros.values()].map(r => ({id: r.id, x: r.x, depth: r.depth, tacticalConditions: copia(r.tacticalConditions||{}), facing: r.facing, cena: r.cena,
          look: copia(r.look), saude: copia(r.saude), fome: copia(r.fome), inventory:r.inventory?.snapshot?.()||copia(r.inventoryData)||null, palco: !!r.palco,
          sistemas: {...r.sistemas}, travado: !!r.travado, oculto: !!r.oculto, congelado: !!r.congelado,
          pose: copia(r.pose), poseOrigem: copia(r.poseOrigem)}))};
    }
    importar(dados) {
      if (!dados || !Array.isArray(dados.membros)) return;
      if (dados.sistemas) for (const q of SISTEMAS) if (q in dados.sistemas) this.sistemas[q] = dados.sistemas[q] !== false;
      if (dados.ferramentas) {
        this.ferramentas.danoAoArrastar = !!dados.ferramentas.danoAoArrastar;
        if (typeof dados.ferramentas.ferramenta === 'string') this.ferramentas.ferramenta = dados.ferramentas.ferramenta;
      }
      for (const m of dados.membros) {
        if (!m || typeof m.id !== 'string') continue;
        const r = this.registro(m.id);
        if (!r) continue;
        r.x = Number.isFinite(m.x) ? m.x : null;
        r.depth = Number.isFinite(m.depth) ? m.depth : null;
        r.tacticalConditions = m.tacticalConditions&&typeof m.tacticalConditions==='object'?copia(m.tacticalConditions):{};
        r.facing = m.facing === -1 ? -1 : 1;
        r.cena = typeof m.cena === 'string' ? m.cena : null;
        r.look = m.look && typeof m.look === 'object' ? m.look : null;
        r.saude = m.saude && typeof m.saude === 'object' ? m.saude : null;
        r.fome = m.fome && typeof m.fome === 'object' ? m.fome : null;
        r.inventoryData=m.inventory&&Array.isArray(m.inventory.entries)?copia(m.inventory):null;
        if(r.inventory&&r.inventoryData)r.inventory.restore(r.inventoryData);
        r.palco = !!m.palco;
        if (m.sistemas) for (const q of SISTEMAS) r.sistemas[q] = bool(m.sistemas[q]);
        r.travado = !!m.travado; r.oculto = !!m.oculto; r.congelado = !!m.congelado;
        r.pose = Array.isArray(m.pose) ? m.pose : null;
        r.poseOrigem = m.poseOrigem && typeof m.poseOrigem === 'object' ? m.poseOrigem : null;
        this.desligarBastidor(r);
      }
      this.mudou('importar');
    }
    restaurar() {
      try {
        const salvo = JSON.parse(root.localStorage?.getItem(STORE) || 'null');
        if (salvo) this.importar(salvo);
      } catch (e) { /* navegador sem armazenamento: o elenco vive a sessão */ }
    }
    salvar() {
      if (!this.armazenar) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
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

  /* ------------------------------------------------------------ o menu
     O menu do botão direito vive no DOCUMENTO, e não na cena. É de
     propósito: o que o mestre abre para escolher não é imagem do jogo, e
     por isso não entra no quadro que vai para a tela dos jogadores nem na
     captura da cena. */
  class ElencoMenu {
    constructor({doc = root.document, aoEscolher = null, aoFechar = null} = {}) {
      this.doc = doc; this.aoEscolher = aoEscolher; this.aoFechar = aoFechar;
      this.alvo = null;
      this.el = doc.querySelector('#cenaMenu');
      if (!this.el) {
        this.el = doc.createElement('div');
        this.el.id = 'cenaMenu'; this.el.className = 'cena-menu'; this.el.hidden = true;
        this.el.setAttribute('role', 'menu');
        doc.body.appendChild(this.el);
      }
      this.el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-chave]');
        if (!b) return;
        const chave = b.dataset.chave, alvo = this.alvo;
        this.fechar();
        this.aoEscolher?.(chave, alvo);
      });
      doc.addEventListener('pointerdown', ev => {
        if (!this.el.hidden && !this.el.contains(ev.target)) this.fechar();
      }, true);
      doc.addEventListener('keydown', ev => {
        if (this.el.hidden) return;
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); this.fechar(); }
      }, true);
      root.addEventListener?.('blur', () => this.fechar());
    }
    get aberto() { return !this.el.hidden; }
    abrir({titulo, sub = '', itens = [], alvo = null}, x, y) {
      if (!itens.length) return;
      this.alvo = alvo;
      this.el.innerHTML = '';
      const h = this.doc.createElement('h4');
      h.textContent = titulo;
      this.el.appendChild(h);
      if (sub) {
        const p = this.doc.createElement('p');
        p.textContent = sub;
        this.el.appendChild(p);
      }
      for (const it of itens) {
        const b = this.doc.createElement('button');
        b.type = 'button'; b.dataset.chave = it.chave; b.setAttribute('role', 'menuitem');
        b.textContent = it.rotulo;
        if (it.atalho) { const k = this.doc.createElement('kbd'); k.textContent = it.atalho; b.appendChild(k); }
        if (it.perigo) b.dataset.danger = 'true';
        this.el.appendChild(b);
      }
      this.el.hidden = false;
      /* Encostar na borda da janela e abrir para dentro: menu cortado é menu
         que não se usa. E abrir com uma FOLGA do cursor, e não colado nele:
         com o canto do menu exatamente sob o ponteiro, o clique seguinte
         caía no primeiro item — quem abria o menu e ia agarrar o personagem
         abria a ficha dele sem querer. */
      const caixa = this.el.getBoundingClientRect();
      const larg = root.innerWidth || caixa.width, alt = root.innerHeight || caixa.height;
      this.el.style.left = Math.max(4, Math.min(x + FOLGA, larg - caixa.width - 6)) + 'px';
      this.el.style.top = Math.max(4, Math.min(y + FOLGA, alt - caixa.height - 6)) + 'px';
      this.el.querySelector('button')?.focus({preventScroll: true});
    }
    fechar() {
      if (this.el.hidden) return;
      this.el.hidden = true; this.alvo = null;
      this.aoFechar?.();
    }
  }

  const api = {Elenco, ElencoMenu, ELENCO_STORE: STORE, elencoSemente: semente};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
