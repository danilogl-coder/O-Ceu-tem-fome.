/* Fome e sede.

   O mestre manda: ele pode colocar o personagem em qualquer estágio na hora,
   ou deixar no automático dizendo em quantos minutos ela chega lá. Os minutos
   são os do relógio do mestre (o mesmo da saúde): com “SAÚDE PAUSADA” nada
   avança, e “pular tempo” adianta de uma vez.

   Quatro estágios por necessidade, cada um com efeito no corpo:
     0 Sem fome / Sem sede      nada
     1 Com fome / Com sede      um pouco mais devagar, cura mais lenta
     2 Fome forte / Sede forte  devagar, sem fôlego para correr, vista escurecendo nas bordas
     3 Inanição / Desidratação  bem devagar, vinheta pulsando e perda lenta de vida (o mestre desliga)
   Os dois se somam (multiplicando, com um piso) — passar fome e sede junto é pior.

   Condições que a comida e a água causam (enjoo, dor de barriga, infecção
   intestinal com suas fases, intoxicação, cafeína, tremedeira, moleza e o
   bônus de uma refeição boa) vivem aqui também: elas mexem na velocidade, na
   vista, na cura, na sede e no que o personagem consegue comer.

   LIGAÇÃO COM A SAÚDE (aba de saúde, health.js)
   ---------------------------------------------
   Fome e sede não são um medidor à parte: elas são o metabolismo do corpo.
   A cada passo, este arquivo escreve em `health.metabolism`
     cura      cicatrização, consolidação do osso e reposição de sangue
     infeccao  quanto mais rápido a infecção avança (desnutrida: até ×2,2)
     sangue    quanto o corpo repõe do volume perdido (sem água: nada)
     rotulo    o estado que aparece na aba de saúde
   e a saúde responde: febre (infecção/necrose), sangramento e sangue a repor
   aceleram a sede; a piora suspensa pelo mestre e a morte param as duas.
   No último estágio a sede tira volume de sangue e castiga os rins, a fome
   consome o corpo e castiga o fígado — tudo com piso e desligável.

   Sem DOM: roda no navegador e no Node (testes). A interface do mestre e o
   aviso na tela ficam em mestre/painel-necessidades.js; a ficha clínica que a
   aba de saúde mostra sai de `resumoClinico()`. */
(function (scope) {
  'use strict';
  const LIMITES = [30, 60, 85];                 // início dos estágios 1, 2 e 3
  const NECESSIDADES = ['fome', 'sede'];
  /* Os nomes dos estágios são substantivos de propósito: o personagem é uma
     base sem gênero para o jogador montar o dele, e substantivo não combina
     com gênero nenhum — “Fome forte” serve para qualquer ficha, “Faminta” não. */
  const NOMES = {
    fome: ['Sem fome', 'Com fome', 'Fome forte', 'Inanição'],
    sede: ['Sem sede', 'Com sede', 'Sede forte', 'Desidratação']
  };
  const ROTULO = {fome: 'Fome', sede: 'Sede'};
  /* O que o personagem diz (em primeira pessoa) ao entrar no estágio. */
  const FALAS = {
    fome: ['', 'Meu estômago está roncando.', 'Preciso comer alguma coisa. Agora.', 'Minhas pernas estão fracas de fome.'],
    sede: ['', 'Minha boca está seca.', 'Preciso de água.', 'A cabeça dói e a vista escurece de sede.']
  };
  /* Velocidade, corrida, vinheta e cura por estágio. */
  const EFEITO_ESTAGIO = {
    fome: [{v: 1, cura: 1, vinheta: 0}, {v: .95, cura: .75, vinheta: 0}, {v: .85, cura: .4, vinheta: .15}, {v: .7, cura: 0, vinheta: .3}],
    sede: [{v: 1, cura: 1, vinheta: 0}, {v: .95, cura: .75, vinheta: 0}, {v: .85, cura: .4, vinheta: .2}, {v: .65, cura: 0, vinheta: .35}]
  };
  const PERDA_VIDA = {fome: .25, sede: .5};      // % de vida por minuto no último estágio
  const PERDA_SANGUE = {sede: .6};              // % de volume de sangue por minuto, na desidratação
  const DESGASTE_ORGAO = {sede: .35, fome: .25};// rins (sede) e fígado (fome), por minuto
  /* Quanto o corpo ainda consegue repor de sangue, por estágio. Sem água ele
     simplesmente não repõe — é o elo mais direto entre a sede e a saúde. */
  const SANGUE_SEDE = [1, .75, .35, 0], SANGUE_FOME = [1, .9, .6, .25];

  /* Condições. `minutos` é a duração; `fases` faz uma condição com etapas. */
  const EFEITOS = {
    enjoo: {label: 'Enjoo', minutos: 10, icone: 'enjoo', velocidade: .92, vinheta: .12, verde: .35, impedeComer: 'Ela está enjoada demais para comer.'},
    dor_de_barriga: {label: 'Dor de barriga', minutos: 12, icone: 'barriga', velocidade: .9, vinheta: .08},
    intoxicacao: {label: 'Intoxicação alimentar', icone: 'enjoo', verde: .3, fases: [
      {id: 'incubacao', label: 'Algo caiu mal', minutos: 5},
      {id: 'enjoo', label: 'Enjoo forte', minutos: 12, velocidade: .9, vinheta: .12, sedeTaxa: 1.4, impedeComer: 'O estômago dela não aceita mais nada agora.'},
      {id: 'fraqueza', label: 'Fraqueza', minutos: 8, velocidade: .92, cura: .5}]},
    infeccao_intestinal: {label: 'Infecção intestinal', icone: 'infeccao', verde: .4, fases: [
      {id: 'incubacao', label: 'Incubando', minutos: 8},
      {id: 'enjoo', label: 'Enjoo', minutos: 10, velocidade: .9, vinheta: .12, sedeTaxa: 1.5, impedeComer: 'Ela está enjoada demais para comer.'},
      {id: 'gastroenterite', label: 'Gastroenterite', minutos: 20, velocidade: .85, vinheta: .2, sedeTaxa: 2, vida: .2, vomitos: [3, 5],
        impedeComer: 'Ela não consegue segurar nada no estômago.'},
      {id: 'fraqueza', label: 'Fraqueza', minutos: 10, velocidade: .9, cura: .5}]},
    cafeina: {label: 'Ligada', minutos: 20, icone: 'cafe', velocidade: 1.05, sedeTaxa: 1.2},
    tremedeira: {label: 'Tremedeira', minutos: 15, icone: 'cafe', tremor: 1, velocidade: .97},
    moleza: {label: 'Moleza', minutos: 5, icone: 'moleza', velocidade: .95},
    bem_alimentada: {label: 'Bem alimentada', minutos: 10, icone: 'estrela', cura: 1.5, velocidade: 1.02}
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const estagioDe = valor => (valor >= LIMITES[2] ? 3 : valor >= LIMITES[1] ? 2 : valor >= LIMITES[0] ? 1 : 0);

  class CharacterNeeds {
    constructor({health = null, clock = null, random = Math.random} = {}) {
      this.health = health; this.clock = clock; this.random = random;
      this.fome = 0; this.sede = 0;
      this.minutos = 0;                       // minutos de jogo já corridos
      this.auto = {fome: {ativo: true, alvo: 1, minutos: 45}, sede: {ativo: true, alvo: 1, minutos: 30}};
      this.congelado = {fome: false, sede: false};
      this.perdaDeVida = {ativo: true, piso: 15, pisoSangue: 20, pisoOrgao: 25};
      this.efeitos = new Map();
      this.listeners = new Set();
      this.revision = 0;
      this.log = [];
      this.estagios = {fome: 0, sede: 0};
      this.aviso = {fome: 0, sede: 0};
      this.velocidadeTempo = 1;               // ×0,5 devagar · ×1 normal · ×1,5 puxado
      this.restoVida = 0;
    }
    /* ------------------------------------------------------------ estado */
    get rodando() { return this.clock ? !!this.clock.running : true; }
    estagio(qual) { return estagioDe(this[qual]); }
    nome(qual) { return NOMES[qual][this.estagio(qual)]; }
    nomeDe(qual, estagio) { return NOMES[qual][clamp(estagio | 0, 0, 3)]; }
    valorDoEstagio(estagio) { return estagio <= 0 ? 0 : LIMITES[estagio - 1]; }
    /* Quanto falta, em minutos, para chegar no estágio (null: não chega). */
    minutosAte(qual, estagio = this.estagio(qual) + 1) {
      const alvo = this.valorDoEstagio(clamp(estagio, 0, 3));
      const taxa = this.taxa(qual);
      if (alvo <= this[qual]) return 0;
      if (taxa <= 0) return null;
      return (alvo - this[qual]) / taxa;
    }
    /* Pontos por minuto. Morta, ou com a piora suspensa pelo mestre na aba de
       saúde, nada avança: as duas coisas param juntas. */
    taxa(qual) {
      const a = this.auto[qual];
      if (this.congelado[qual] || !a.ativo || !(a.minutos > 0)) return 0;
      const h = this.health;
      if (h && (h.dead || h.suspended)) return 0;
      const base = this.valorDoEstagio(clamp(a.alvo, 1, 3)) / a.minutos;
      const extra = qual === 'sede' ? this.modificadores.sedeTaxa : 1;
      return base * this.velocidadeTempo * extra * this.fatorDoCorpo(qual);
    }
    /* O corpo pedindo mais: febre gasta água e comida, e sangue perdido dá
       sede — o corpo quer repor o volume. Corpo são, fator 1. */
    fatorDoCorpo(qual) {
      const h = this.health;
      if (!h) return 1;
      const febre = h.febre || 0, falta = h.deficitDeSangue || 0, sangrando = h.bleeding > 0;
      if (qual === 'sede') return clamp(1 + febre * .8 + falta * 1.2 + (sangrando ? .35 : 0), 1, 3);
      return clamp(1 + febre * .45 + falta * .3, 1, 2);
    }
    /* O recado que vai para health.metabolism: cura, defesa contra infecção e
       reposição de sangue. É por aqui que a fome e a sede entram na aba de
       saúde e mexem no corpo todo minuto, não só na hora de morrer. */
    get metabolismo() {
      const f = this.estagio('fome'), s = this.estagio('sede'), m = this.modificadores;
      return {cura: clamp(m.cura, 0, 2), infeccao: clamp(1 + f * .2 + s * .15, 1, 2.2),
        sangue: clamp(SANGUE_SEDE[s] * SANGUE_FOME[f], 0, 1), rotulo: this.rotuloClinico(), fome: f, sede: s};
    }
    rotuloClinico() {
      const f = this.estagio('fome'), s = this.estagio('sede');
      if (f >= 3 && s >= 3) return 'Inanição e desidratação';
      if (s >= 3) return NOMES.sede[3];
      if (f >= 3) return NOMES.fome[3];
      if (s >= 2) return NOMES.sede[2];
      if (f >= 2) return NOMES.fome[2];
      return '';
    }
    aplicarNoCorpo() {
      const h = this.health, alvo = h && h.metabolism;
      if (!alvo) return null;
      const m = this.metabolismo;
      if (alvo.cura !== m.cura || alvo.infeccao !== m.infeccao || alvo.sangue !== m.sangue || alvo.rotulo !== m.rotulo) {
        alvo.cura = m.cura; alvo.infeccao = m.infeccao; alvo.sangue = m.sangue; alvo.rotulo = m.rotulo;
        h.revision++;
      }
      return m;
    }
    /* Tudo o que o jogo precisa saber para aplicar os efeitos. */
    get modificadores() {
      let velocidade = 1, cura = 1, vinheta = 0, sedeTaxa = 1, verde = 0, tremor = 0, pulso = false, impedeComer = '';
      for (const qual of NECESSIDADES) {
        const e = EFEITO_ESTAGIO[qual][this.estagio(qual)];
        velocidade *= e.v; cura *= e.cura; vinheta = Math.max(vinheta, e.vinheta);
        if (this.estagio(qual) >= 3) pulso = true;
      }
      if (this.estagio('fome') >= 2 && this.estagio('sede') >= 2) vinheta += .1;
      for (const ef of this.efeitos.values()) {
        const f = this.faseAtual(ef) || {};
        const d = EFEITOS[ef.id] || {};
        velocidade *= num(f.velocidade ?? d.velocidade, 1);
        cura *= num(f.cura ?? d.cura, 1);
        vinheta = Math.max(vinheta, num(f.vinheta ?? d.vinheta, 0));
        sedeTaxa *= num(f.sedeTaxa ?? d.sedeTaxa, 1);
        verde = Math.max(verde, num(f.verde ?? d.verde, 0));
        tremor = Math.max(tremor, num(f.tremor ?? d.tremor, 0));
        const bloqueio = f.impedeComer || d.impedeComer;
        if (bloqueio && !impedeComer) impedeComer = bloqueio;
      }
      return {velocidade: clamp(velocidade, .5, 1.1), cura: clamp(cura, 0, 2), vinheta: clamp(vinheta, 0, .75),
        sedeTaxa: clamp(sedeTaxa, .5, 3), verde: clamp(verde, 0, 1), tremor, pulso, impedeComer,
        corrida: this.estagio('fome') < 3 && this.estagio('sede') < 3 && !impedeComer};
    }
    podeComer() {
      const m = this.modificadores;
      if (m.impedeComer) return {ok: false, motivo: m.impedeComer};
      return {ok: true, motivo: ''};
    }
    podeBeber() { return {ok: true, motivo: ''}; }
    temEfeito(id) { return this.efeitos.has(id); }
    faseAtual(ef) {
      const def = EFEITOS[ef.id];
      if (!def?.fases) return null;
      return def.fases[ef.fase] || null;
    }
    /* ------------------------------------------------------------ mexer */
    definir(qual, valor, {origem = 'mestre'} = {}) {
      if (!NECESSIDADES.includes(qual)) return false;
      this[qual] = clamp(num(valor, 0), 0, 100);
      this.conferirEstagios(origem);
      this.mudou();
      return true;
    }
    somar(qual, delta, opts) { return this.definir(qual, this[qual] + num(delta, 0), opts); }
    porEstagio(qual, estagio, opts) { return this.definir(qual, this.valorDoEstagio(clamp(estagio | 0, 0, 3)) + (estagio >= 1 ? 2 : 0), opts); }
    congelar(qual, valor) { this.congelado[qual] = !!valor; this.mudou(); }
    configurarAuto(qual, patch = {}) {
      const a = this.auto[qual];
      if ('ativo' in patch) a.ativo = !!patch.ativo;
      if ('alvo' in patch) a.alvo = clamp(patch.alvo | 0, 1, 3);
      if ('minutos' in patch) a.minutos = clamp(num(patch.minutos, 45), 1, 24 * 60);
      this.mudou();
    }
    ritmo(fator) { this.velocidadeTempo = clamp(num(fator, 1), .1, 4); this.mudou(); }
    definirPerdaDeVida(ativo, piso, extras = {}) {
      this.perdaDeVida.ativo = !!ativo;
      if (piso !== undefined) this.perdaDeVida.piso = clamp(num(piso, 15), 0, 90);
      if (extras.pisoSangue !== undefined) this.perdaDeVida.pisoSangue = clamp(num(extras.pisoSangue, 20), 0, 95);
      if (extras.pisoOrgao !== undefined) this.perdaDeVida.pisoOrgao = clamp(num(extras.pisoOrgao, 25), 0, 95);
      this.mudou();
    }
    /* Comer, beber, tomar um susto: aplica o alívio e as condições. */
    aplicar({fome = 0, sede = 0, efeitos = [], origem = '', cura = null} = {}) {
      const antes = {fome: this.fome, sede: this.sede};
      this.fome = clamp(this.fome + num(fome, 0), 0, 100);
      this.sede = clamp(this.sede + num(sede, 0), 0, 100);
      const aplicados = [];
      for (const e of efeitos || []) {
        const id = typeof e === 'string' ? e : e?.id;
        if (!id || !EFEITOS[id]) continue;
        const chance = typeof e === 'object' && e.chance !== undefined ? num(e.chance, 1) : 1;
        if (chance < 1 && this.random() > chance) continue;
        this.aplicarEfeito(id, typeof e === 'object' ? e : {});
        aplicados.push(id);
      }
      for (const id of cura || []) this.curar(id);
      this.conferirEstagios(origem || 'consumo');
      this.anotar(origem, {fome: this.fome - antes.fome, sede: this.sede - antes.sede, efeitos: aplicados});
      this.mudou();
      return {fome: this.fome - antes.fome, sede: this.sede - antes.sede, efeitos: aplicados};
    }
    aplicarEfeito(id, {minutos = null, forca = 1} = {}) {
      const def = EFEITOS[id];
      if (!def) return false;
      const existente = this.efeitos.get(id);
      if (existente && def.fases) {                 // reincidência: volta um pouco e agrava
        existente.restante = Math.max(existente.restante, (def.fases[existente.fase]?.minutos || 5) * .6);
        existente.forca = Math.min(2, existente.forca + .25);
      } else if (existente) {
        existente.restante = Math.max(existente.restante, minutos ?? def.minutos ?? 5);
        existente.forca = Math.min(2, existente.forca + .2);
      } else {
        const ef = {id, forca, fase: 0, restante: def.fases ? def.fases[0].minutos : (minutos ?? def.minutos ?? 5), proximoVomito: 0};
        this.efeitos.set(id, ef);
        this.emit('efeito', {id, entrou: true, label: def.label});
      }
      this.mudou();
      return true;
    }
    curar(id, {parcial = 0} = {}) {
      const ef = this.efeitos.get(id);
      if (!ef) return false;
      if (parcial > 0) { ef.restante *= clamp(1 - parcial, 0, 1); this.mudou(); return true; }
      this.efeitos.delete(id);
      this.emit('efeito', {id, entrou: false, label: EFEITOS[id]?.label || id});
      this.mudou();
      return true;
    }
    curarTudo() { for (const id of [...this.efeitos.keys()]) this.curar(id); }
    /* O mestre adiantando o relógio. */
    pular(minutos) {
      const m = clamp(num(minutos, 0), 0, 24 * 60);
      if (m > 0) this.avancar(m, {pulo: true});
      return m;
    }
    /* ------------------------------------------------------------ tempo */
    step(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || !this.rodando) return;
      this.avancar(dt / 60);
    }
    avancar(minutos, {pulo = false} = {}) {
      if (!(minutos > 0)) return;
      this.minutos += minutos;
      const passo = pulo ? Math.min(minutos, 1) : minutos;   // pulos longos em fatias de 1 min
      let restante = minutos;
      while (restante > 0) {
        const m = Math.min(passo, restante);
        restante -= m;
        for (const qual of NECESSIDADES) {
          const taxa = this.taxa(qual);
          if (taxa > 0) this[qual] = clamp(this[qual] + taxa * m, 0, 100);
        }
        this.passoEfeitos(m);
        this.passoVida(m);
      }
      this.conferirEstagios('tempo');
      this.mudou();
    }
    passoEfeitos(minutos) {
      for (const [id, ef] of [...this.efeitos]) {
        const def = EFEITOS[id];
        if (!def) { this.efeitos.delete(id); continue; }
        ef.restante -= minutos;
        const fase = this.faseAtual(ef);
        if (fase?.vomitos) {
          ef.proximoVomito -= minutos;
          if (ef.proximoVomito <= 0) {
            const [a, b] = fase.vomitos;
            ef.proximoVomito = a + this.random() * (b - a);
            if (ef.iniciado) this.vomitar(def.label);
            ef.iniciado = true;
          }
        }
        if (fase?.vida && this.health) this.desgastar(fase.vida * minutos);
        if (ef.restante > 0) continue;
        if (def.fases && ef.fase < def.fases.length - 1) {
          ef.fase++;
          ef.restante = def.fases[ef.fase].minutos;
          ef.proximoVomito = 0; ef.iniciado = false;
          this.emit('efeito', {id, fase: def.fases[ef.fase].id, label: `${def.label} · ${def.fases[ef.fase].label}`});
        } else this.curar(id);
      }
    }
    vomitar(origem = '') {
      this.sede = clamp(this.sede + 20, 0, 100);
      this.fome = clamp(this.fome + 12, 0, 100);
      this.anotar(origem || 'Vômito', {fome: 12, sede: 20, efeitos: []});
      this.emit('vomito', {origem});
      this.conferirEstagios('vomito');
    }
    /* Último estágio: o corpo começa a se consumir. A sede tira volume de
       sangue e castiga os rins; a fome consome o corpo inteiro e o fígado
       sente primeiro. Tudo com piso, e o mestre desliga num botão. */
    passoVida(minutos) {
      if (!this.perdaDeVida.ativo || !this.health || this.health.dead) return;
      const h = this.health;
      if (this.estagio('sede') >= 3) {
        const alvo = Math.max(clamp(this.perdaDeVida.pisoSangue, 0, 95), h.blood - PERDA_SANGUE.sede * minutos);
        if (alvo < h.blood) { h.blood = alvo; h.revision++; }
        this.desgastarOrgaos(['kidney_left', 'kidney_right'], DESGASTE_ORGAO.sede * minutos);
      }
      if (this.estagio('fome') >= 3) this.desgastarOrgaos(['liver'], DESGASTE_ORGAO.fome * minutos);
      let perda = 0;
      for (const qual of NECESSIDADES) if (this.estagio(qual) >= 3) perda += PERDA_VIDA[qual] * minutos;
      if (perda > 0) this.desgastar(perda);
      if (this.estagio('sede') >= 3 || this.estagio('fome') >= 3) h.checkFatal?.();
    }
    /* Órgãos que a falta castiga, nunca abaixo do piso. */
    desgastarOrgaos(ids, quanto) {
      const h = this.health;
      if (!h || !h.organs || !(quanto > 0)) return;
      const piso = clamp(this.perdaDeVida.pisoOrgao, 0, 95);
      let mexeu = false;
      for (const id of ids) {
        const o = h.organs.get(id);
        if (!o || o.detached) continue;
        const alvo = Math.max(piso, o.hp - quanto);
        if (alvo < o.hp) { o.hp = alvo; mexeu = true; }
      }
      if (mexeu) { h.revision++; h.checkFatal?.(); }
    }
    /* Fraqueza: a vida cai devagar em todo o corpo, nunca abaixo do piso. */
    desgastar(quanto) {
      const h = this.health;
      if (!h || !(quanto > 0)) return;
      const piso = this.perdaDeVida.piso;
      let mexeu = false;
      for (const p of h.parts.values()) {
        if (p.missing) continue;
        // O piso é uma PORCENTAGEM (é assim que o painel o chama): num corpo
        // cujo máximo o vigor mudou, 15 de PV não é 15% de nada.
        const alvo = Math.max((p.maxHp > 0 ? p.maxHp : 100) * piso / 100, p.hp - quanto);
        if (alvo < p.hp) { p.hp = alvo; mexeu = true; }
      }
      if (mexeu) { h.revision++; h.checkFatal?.(); }
    }
    conferirEstagios(origem = '') {
      for (const qual of NECESSIDADES) {
        const agora = this.estagio(qual), antes = this.estagios[qual];
        if (agora === antes) {
          // Aviso ao mestre dois minutos antes de piorar.
          const falta = this.minutosAte(qual);
          if (falta !== null && falta <= 2 && this.aviso[qual] !== agora + 1 && agora < 3) {
            this.aviso[qual] = agora + 1;
            this.emit('quase', {qual, estagio: agora + 1, nome: NOMES[qual][agora + 1], minutos: falta});
          }
          continue;
        }
        this.estagios[qual] = agora;
        this.aviso[qual] = 0;
        this.emit('estagio', {qual, estagio: agora, antes, nome: NOMES[qual][agora], rotulo: ROTULO[qual],
          fala: FALAS[qual][agora] || '', piorou: agora > antes, origem});
      }
    }
    anotar(origem, {fome = 0, sede = 0, efeitos = []}) {
      if (!origem && !fome && !sede && !efeitos.length) return;
      this.log.unshift({at: Date.now(), minuto: this.minutos, origem: String(origem || ''), fome, sede, efeitos});
      this.log.length = Math.min(this.log.length, 40);
    }
    /* ------------------------------------------------------------ avisos */
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(kind, data) { for (const fn of this.listeners) try { fn(kind, data); } catch (e) { console.error(e); } }
    mudou() { this.aplicarNoCorpo(); this.revision++; this.emit('mudou'); }
    /* A ficha que a aba de saúde mostra: as duas barras, o que a falta está
       fazendo no corpo agora e quanto falta para piorar. */
    resumoClinico() {
      const m = this.metabolismo, mod = this.modificadores, h = this.health;
      const linha = qual => {
        const e = this.estagio(qual);
        return {qual, rotulo: ROTULO[qual], valor: this[qual], estagio: e, nome: this.nome(qual),
          congelado: !!this.congelado[qual], taxa: this.taxa(qual),
          minutos: e >= 3 ? null : this.minutosAte(qual, e + 1), proximo: e >= 3 ? '' : NOMES[qual][e + 1]};
      };
      const efeitos = [...this.efeitos.values()].map(ef => {
        const def = EFEITOS[ef.id], fase = this.faseAtual(ef);
        return {id: ef.id, label: def.label + (fase ? ' · ' + fase.label : ''), restante: Math.max(0, ef.restante), icone: def.icone || 'enjoo'};
      });
      const corpo = [];
      if (m.cura <= 0) corpo.push('Não cicatriza: sem energia para fechar ferida nem colar osso.');
      else if (m.cura < .999) corpo.push(`Cicatrização, osso e bandagem a ${Math.round(m.cura * 100)}%.`);
      else if (m.cura > 1.001) corpo.push(`Bem alimentado: cicatrização a ${Math.round(m.cura * 100)}%.`);
      if (m.sangue <= 0) corpo.push('Sem água, o corpo não repõe o sangue perdido.');
      else if (m.sangue < .999) corpo.push(`Reposição de sangue a ${Math.round(m.sangue * 100)}%.`);
      if (m.infeccao > 1.001) corpo.push(`Defesa baixa: infecção avança ${Math.round((m.infeccao - 1) * 100)}% mais rápido.`);
      if (this.perdaDeVida.ativo && this.estagio('sede') >= 3) corpo.push(`Desidratação: perde sangue e castiga os rins (piso ${Math.round(this.perdaDeVida.pisoSangue)}%).`);
      if (this.perdaDeVida.ativo && this.estagio('fome') >= 3) corpo.push(`Inanição: o corpo se consome e o fígado sente primeiro (piso ${Math.round(this.perdaDeVida.piso)}%).`);
      if (mod.velocidade < .999) corpo.push(`Anda a ${Math.round(mod.velocidade * 100)}% da velocidade${mod.corrida ? '' : ' e não corre'}.`);
      if (mod.impedeComer) corpo.push(mod.impedeComer);
      const pedidos = [];
      if ((h?.febre || 0) > .02) pedidos.push('febre');
      if ((h?.deficitDeSangue || 0) > .02) pedidos.push('sangue a repor');
      if (h?.bleeding > 0) pedidos.push('sangramento');
      if (pedidos.length) corpo.push(`O corpo pede mais água (${pedidos.join(', ')}): sede ${Math.round(this.fatorDoCorpo('sede') * 100 - 100)}% mais rápida.`);
      if (h?.suspended) corpo.push('Piora suspensa pelo mestre: fome e sede também estão paradas.');
      else if (h?.dead) corpo.push('Sem sinais vitais: fome e sede pararam.');
      return {fome: linha('fome'), sede: linha('sede'), metabolismo: m, efeitos, corpo,
        suspenso: !!h?.suspended, morto: !!h?.dead, rodando: this.rodando, perdaDeVida: {...this.perdaDeVida}};
    }
    /* ------------------------------------------------------------ sessão */
    snapshot() {
      return {fome: this.fome, sede: this.sede, minutos: this.minutos, rodando: this.rodando,
        estagios: {fome: this.estagio('fome'), sede: this.estagio('sede')},
        nomes: {fome: this.nome('fome'), sede: this.nome('sede')},
        auto: JSON.parse(JSON.stringify(this.auto)), congelado: {...this.congelado},
        perdaDeVida: {...this.perdaDeVida}, ritmo: this.velocidadeTempo,
        efeitos: [...this.efeitos.values()].map(e => ({id: e.id, label: EFEITOS[e.id].label, fase: this.faseAtual(e)?.label || '',
          restante: Math.max(0, e.restante), forca: e.forca, icone: EFEITOS[e.id].icone || 'enjoo'})),
        modificadores: this.modificadores, metabolismo: this.metabolismo, clinico: this.resumoClinico(), log: this.log.slice(0, 12)};
    }
    exportar() {
      return {fome: this.fome, sede: this.sede, minutos: this.minutos, auto: JSON.parse(JSON.stringify(this.auto)),
        congelado: {...this.congelado}, perdaDeVida: {...this.perdaDeVida}, ritmo: this.velocidadeTempo,
        efeitos: [...this.efeitos.values()].map(e => ({id: e.id, fase: e.fase, restante: e.restante, forca: e.forca}))};
    }
    importar(dados) {
      if (!dados || typeof dados !== 'object') return;
      this.fome = clamp(num(dados.fome, 0), 0, 100);
      this.sede = clamp(num(dados.sede, 0), 0, 100);
      this.minutos = Math.max(0, num(dados.minutos, 0));
      this.velocidadeTempo = clamp(num(dados.ritmo, 1), .1, 4);
      for (const qual of NECESSIDADES) {
        const a = dados.auto?.[qual];
        if (a) this.auto[qual] = {ativo: !!a.ativo, alvo: clamp(a.alvo | 0, 1, 3), minutos: clamp(num(a.minutos, 45), 1, 1440)};
        this.congelado[qual] = !!dados.congelado?.[qual];
      }
      if (dados.perdaDeVida) this.perdaDeVida = {ativo: !!dados.perdaDeVida.ativo, piso: clamp(num(dados.perdaDeVida.piso, 15), 0, 90),
        pisoSangue: clamp(num(dados.perdaDeVida.pisoSangue, 20), 0, 95), pisoOrgao: clamp(num(dados.perdaDeVida.pisoOrgao, 25), 0, 95)};
      this.efeitos.clear();
      for (const e of dados.efeitos || []) {
        if (!EFEITOS[e?.id]) continue;
        this.efeitos.set(e.id, {id: e.id, fase: clamp(e.fase | 0, 0, (EFEITOS[e.id].fases?.length || 1) - 1),
          restante: Math.max(0, num(e.restante, 1)), forca: num(e.forca, 1), proximoVomito: 0, iniciado: true});
      }
      this.estagios = {fome: this.estagio('fome'), sede: this.estagio('sede')};
      this.mudou();
    }
  }
  const api = {CharacterNeeds, NECESSIDADES_SANGUE: {SANGUE_SEDE, SANGUE_FOME, PERDA_SANGUE, DESGASTE_ORGAO}, NECESSIDADES_LIMITES: LIMITES, NECESSIDADES_NOMES: NOMES, NECESSIDADES_EFEITOS: EFEITOS,
    NECESSIDADES_FALAS: FALAS, NECESSIDADES_ESTAGIO: EFEITO_ESTAGIO, estagioDeNecessidade: estagioDe};
  Object.assign(scope, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
