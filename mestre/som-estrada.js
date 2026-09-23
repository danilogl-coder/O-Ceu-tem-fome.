/* Som da estrada — a trilha e o barulho do carro no minigame de viagem.

   Como todo o resto do jogo, nada disso é arquivo de áudio: é sintetizado no
   navegador, em cima do mesmo `MapAmbience` das cenas.

   O QUE TOCA
   ----------
   · TRILHA — sete músicas curtas em loop, uma para cada trecho da estrada,
     escritas em notas (o mesmo formato das trilhas das cenas) e registradas em
     `MapAmbience.MUSIC`, então elas também aparecem nas fichas de música do
     mapa do mestre e podem ser tocadas fora da viagem.
   · MOTOR — contínuo, e é o coração da coisa: quatro osciladores (corpo,
     batimento, harmônico e sub) atravessando um filtro cuja abertura segue a
     carga, mais o ruído da admissão. A frequência sai da rotação, e a rotação
     sai de uma CAIXA DE CINCO MARCHAS — é o subir-e-cair a cada troca que faz
     um motor soar como motor, e não como uma sirene. Cada modelo tem o motor
     dele: o sedã de seis cilindros é grave e liso, o hatch é pequeno e
     zumbido, a picape é diesel e engasgada.
   · PNEU E VENTO — dois leitos de ruído: o rolamento no asfalto (ruído marrom
     num passa-baixa que abre com a velocidade) e o vento (ruído branco num
     passa-faixa). Fora da pista o rolamento vira cascalho: mais agudo, mais
     alto e com estalos.
   · DERRAPAGEM — guinada forte em velocidade alta faz o pneu cantar.

   O MESTRE MANDA
   --------------
   Tudo passa por um mixer com controles próprios na seção **Som** do mapa do
   mestre (bloco SOM DA ESTRADA): liga/desliga, trilha (“combina com o trecho”
   ou uma escolhida), e volume separado de motor, pneus e vento, efeitos e
   música da viagem. Fica salvo na sessão. */
(function (root) {
  'use strict';
  const A = root.MapAmbience;
  if (!A) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ============================================================== trilhas
     As notas são [tempo, altura MIDI, duração em tempos]. Como as trilhas das
     cenas, cada voz tem onda, volume, envelope e um `every` que repete o
     padrão. Os ajudantes abaixo escrevem as partes repetitivas (baixo em
     colcheias, acordes sustentados, levada de bateria) sem encher o arquivo. */
  const COMPASSO = 4;
  const baixo = (raizes, div = 2, dur = .42) => {
    const out = [];
    raizes.forEach((nota, c) => { for (let i = 0; i < COMPASSO * div; i++) out.push([c * COMPASSO + i / div, nota, dur / div * 2]); });
    return out;
  };
  const acordes = (prog, dur = COMPASSO) => {
    const out = [];
    prog.forEach((acorde, c) => acorde.forEach(n => out.push([c * dur, n, dur])));
    return out;
  };
  const batida = (tempos, dur = .08) => tempos.map(b => [b, 0, dur]);
  /* Arpejo subindo e descendo dentro do acorde: o “motorzinho” das trilhas de
     corrida dos anos 80. */
  const arpejo = (prog, porCompasso = 8, oitava = 0) => {
    const out = [];
    prog.forEach((acorde, c) => {
      for (let i = 0; i < porCompasso; i++) {
        const passo = i < porCompasso / 2 ? i : porCompasso - i;
        out.push([c * COMPASSO + i * COMPASSO / porCompasso, acorde[passo % acorde.length] + oitava, COMPASSO / porCompasso * .85]);
      }
    });
    return out;
  };

  const TRILHAS = {
    /* Rodovia ao sol: lá maior, I–vi–IV–V, levada reta e um sopro de otimismo. */
    estrada_rodovia: {label: 'Estrada · Rodovia', bpm: 138, length: 32, tone: 'chase', trecho: 'rodovia',
      voices: [
        {wave: 'square', gain: .085, attack: .004, release: .06, low: 1000, notes: baixo([45, 42, 38, 40, 45, 42, 38, 40])},
        {wave: 'sawtooth', gain: .045, attack: .004, release: .1, low: 3000,
          notes: arpejo([[69, 73, 76], [66, 69, 73], [62, 66, 69], [64, 68, 71], [69, 73, 76], [66, 69, 73], [62, 66, 69], [64, 68, 71]], 8)},
        {wave: 'triangle', gain: .13, attack: .01, release: .3, low: 2800,
          notes: [[0, 81, 1.5], [1.5, 80, .5], [2, 76, 2], [4, 78, 1], [5, 76, 1], [6, 73, 2], [8, 74, 1.5], [9.5, 76, .5], [10, 78, 2],
            [12, 80, 1], [13, 78, 1], [14, 76, 2], [16, 81, 1.5], [17.5, 83, .5], [18, 85, 2], [20, 83, 1], [21, 81, 1], [22, 78, 2],
            [24, 76, 1], [25, 78, 1], [26, 80, 2], [28, 76, 4]]},
        {wave: 'sawtooth', gain: .022, attack: .8, release: 1.2, low: 800, notes: acordes([[57, 61, 64], [54, 57, 61], [50, 54, 57], [52, 56, 59], [57, 61, 64], [54, 57, 61], [50, 54, 57], [52, 56, 59]])},
        {wave: 'sine', gain: .24, attack: .002, release: .08, low: 190, notes: [[0, 33, .16], [1.5, 33, .16], [2.5, 33, .16]], every: 4},
        {wave: 'noise', gain: .1, attack: .002, release: .1, freq: 1900, notes: batida([1, 3], .1), every: 4},
        {wave: 'noise', gain: .035, attack: .002, release: .03, freq: 8200, notes: batida([0, .5, 1, 1.5, 2, 2.5, 3, 3.5], .035), every: 4}]},

    /* Serra ao entardecer: ré menor com sétima, andando devagar, sopro melancólico. */
    estrada_serra: {label: 'Estrada · Serra ao entardecer', bpm: 96, length: 32, tone: 'sad', trecho: 'entardecer',
      voices: [
        {wave: 'sine', gain: .2, attack: .02, release: .4, low: 420, notes: baixo([38, 43, 41, 36, 38, 43, 40, 38], 1, .8)},
        {wave: 'triangle', gain: .14, attack: .03, release: .55, low: 2400,
          notes: [[0, 69, 2], [2, 72, 1], [3, 74, 1], [4, 72, 3], [8, 65, 2], [10, 69, 1.5], [11.5, 67, .5], [12, 65, 3],
            [16, 69, 1.5], [17.5, 72, .5], [18, 77, 2], [20, 76, 1], [21, 74, 1], [22, 72, 2], [24, 70, 2], [26, 69, 1], [27, 67, 1], [28, 65, 4]]},
        {wave: 'sawtooth', gain: .03, attack: 1.2, release: 1.6, low: 700, notes: acordes([[50, 53, 57, 60], [55, 58, 62], [53, 57, 60], [48, 52, 55], [50, 53, 57, 60], [55, 58, 62], [52, 55, 59], [50, 53, 57]])},
        {wave: 'noise', gain: .045, attack: .01, release: .3, freq: 3400, notes: batida([2, 6], .2), every: 8}]},

    /* Estrada de terra: pentatônica, corda solta, poucos instrumentos. */
    estrada_terra: {label: 'Estrada · Terra', bpm: 112, length: 32, tone: 'calm', trecho: 'terra',
      voices: [
        {wave: 'triangle', gain: .17, attack: .01, release: .2, low: 900, notes: baixo([43, 43, 48, 48, 41, 41, 43, 43], 1, .7)},
        {wave: 'square', gain: .07, attack: .004, release: .18, low: 2600,
          notes: [[0, 67, .5], [.5, 71, .5], [1, 74, 1], [2.5, 71, .5], [3, 67, 1], [4, 67, .5], [4.5, 70, .5], [5, 74, 1.5],
            [8, 72, .5], [8.5, 76, .5], [9, 79, 1.5], [11, 76, 1], [12, 72, .5], [12.5, 74, .5], [13, 76, 2],
            [16, 65, .5], [16.5, 69, .5], [17, 72, 1.5], [19, 69, 1], [20, 65, 2],
            [24, 67, .5], [24.5, 71, .5], [25, 74, 1], [26, 71, 1], [27, 67, 2], [30, 62, 2]]},
        {wave: 'sawtooth', gain: .016, attack: 1, release: 1.4, low: 620, notes: acordes([[55, 59, 62], [55, 59, 62], [60, 64, 67], [60, 64, 67], [53, 57, 60], [53, 57, 60], [55, 59, 62], [55, 59, 62]])},
        {wave: 'noise', gain: .07, attack: .002, release: .07, freq: 2600, notes: batida([2], .08), every: 4},
        {wave: 'noise', gain: .025, attack: .004, release: .05, freq: 6000, notes: batida([0, 1, 2, 3], .04), every: 4}]},

    /* Rodovia à noite: pulso de synthwave, pad largo, melodia rala. */
    estrada_noite: {label: 'Estrada · Noite', bpm: 124, length: 32, tone: 'noir', trecho: 'noite',
      voices: [
        {wave: 'sawtooth', gain: .075, attack: .004, release: .08, low: 700, notes: baixo([33, 33, 36, 36, 31, 31, 33, 33], 2, .34)},
        {wave: 'sawtooth', gain: .028, attack: 1.4, release: 2, low: 900, detune: 6, notes: acordes([[57, 60, 64], [57, 60, 64], [60, 63, 67], [60, 63, 67], [55, 58, 62], [55, 58, 62], [57, 60, 64], [57, 60, 64]])},
        {wave: 'triangle', gain: .1, attack: .02, release: .6, low: 3200,
          notes: [[2, 76, 1.5], [6, 72, 1.5], [10, 79, 1], [11, 76, 2], [14, 74, 2], [18, 72, 1.5], [22, 76, 1.5], [26, 79, 2], [29, 76, 3]]},
        {wave: 'sine', gain: .26, attack: .002, release: .09, low: 170, notes: [[0, 31, .18], [1, 31, .12], [2, 31, .18], [3, 31, .12]], every: 4},
        {wave: 'noise', gain: .09, attack: .002, release: .12, freq: 1600, notes: batida([1, 3], .11), every: 4},
        {wave: 'noise', gain: .03, attack: .002, release: .035, freq: 9000, notes: batida([.5, 1.5, 2.5, 3.5], .03), every: 4}]},

    /* Chuva forte: menor, tudo abafado, o pulso mais lento. */
    estrada_chuva: {label: 'Estrada · Chuva', bpm: 88, length: 32, tone: 'drone', trecho: 'chuva',
      voices: [
        {wave: 'sine', gain: .22, attack: .06, release: .7, low: 320, notes: baixo([40, 40, 36, 36, 38, 38, 33, 33], 1, .9)},
        {wave: 'sawtooth', gain: .034, attack: 1.6, release: 2.2, low: 520, detune: 9, notes: acordes([[52, 55, 59], [52, 55, 59], [48, 51, 55], [48, 51, 55], [50, 53, 57], [50, 53, 57], [45, 48, 52], [45, 48, 52]])},
        {wave: 'triangle', gain: .08, attack: .06, release: .8, low: 1800,
          notes: [[1, 64, 2], [5, 67, 1.5], [9, 63, 2], [13, 60, 3], [17, 64, 2], [21, 67, 1.5], [25, 71, 2], [29, 67, 3]]},
        {wave: 'noise', gain: .05, attack: .5, release: 1.4, freq: 900, notes: [[0, 0, 6]], every: 8}]},

    /* Neblina de madrugada: nota pedal, tudo espaçado, nada resolve. */
    estrada_neblina: {label: 'Estrada · Neblina', bpm: 72, length: 32, tone: 'drone', trecho: 'neblina',
      voices: [
        // Baixo que anda de oito em oito tempos: Lám → Fá → Rém → Mi suspenso.
        // A harmonia nunca resolve — é o que faz a neblina não ter fim.
        {wave: 'sine', gain: .3, attack: 2, release: 2.6, low: 260,
          notes: [[0, 33, 8], [8, 29, 8], [16, 26, 8], [24, 28, 8]]},
        // Colchão desafinado de propósito: três vozes por acorde, ataque longuíssimo.
        {wave: 'sawtooth', gain: .03, attack: 2.4, release: 3, low: 420, detune: 11,
          notes: [[0, 57, 9], [0, 60, 9], [0, 64, 9], [8, 53, 9], [8, 57, 9], [8, 60, 9],
            [16, 50, 9], [16, 53, 9], [16, 57, 9], [24, 52, 9], [24, 57, 9], [24, 59, 9]]},
        // Sino distante: nota solta aqui e ali, sem pulso — quem escuta não marca tempo.
        {wave: 'triangle', gain: .07, attack: .1, release: 1.4, low: 2600,
          notes: [[0, 72, 2], [2.5, 76, 2], [6, 81, 1.5], [11, 79, 2], [14, 72, 2],
            [18, 74, 1.5], [21, 79, 1.5], [25, 76, 2], [28, 71, 3], [30.5, 72, 2]]},
        // E o sopro de ar úmido que passa por cima de tudo.
        {wave: 'noise', gain: .035, attack: 1.4, release: 2, freq: 520, notes: [[0, 0, 8], [9, 0, 5]], every: 16}]},

    /* Beira da cidade: baixo sincopado, sopros curtos, bateria cheia. */
    estrada_cidade: {label: 'Estrada · Cidade', bpm: 150, length: 32, tone: 'chase', trecho: 'cidade',
      voices: [
        {wave: 'square', gain: .08, attack: .003, release: .05, low: 1100,
          notes: [[0, 40, .4], [.75, 40, .3], [1.5, 47, .3], [2, 40, .4], [3, 45, .4], [3.5, 43, .4]], every: 4},
        {wave: 'sawtooth', gain: .05, attack: .004, release: .1, low: 3200,
          notes: arpejo([[64, 67, 71], [64, 67, 71], [62, 65, 69], [62, 65, 69], [60, 64, 67], [60, 64, 67], [59, 62, 66], [59, 62, 66]], 8, 12)},
        {wave: 'triangle', gain: .09, attack: .008, release: .18, low: 3000,
          notes: [[0, 76, .5], [.5, 79, .5], [1, 83, 1], [3, 81, 1], [8, 74, .5], [8.5, 77, .5], [9, 81, 1], [11, 79, 1],
            [16, 76, .5], [16.5, 79, .5], [17, 84, 1.5], [20, 83, 1], [21, 81, 1], [24, 79, .5], [24.5, 76, .5], [25, 74, 2]]},
        {wave: 'sine', gain: .24, attack: .002, release: .07, low: 180, notes: [[0, 33, .14], [1.75, 33, .14], [2.5, 33, .14]], every: 4},
        {wave: 'noise', gain: .1, attack: .002, release: .09, freq: 2100, notes: batida([1, 3], .09), every: 4},
        {wave: 'noise', gain: .04, attack: .002, release: .03, freq: 9500, notes: batida([0, .5, 1, 1.5, 2, 2.5, 3, 3.5], .03), every: 4}]}
  };
  for (const [id, t] of Object.entries(TRILHAS)) if (!A.MUSIC[id]) A.MUSIC[id] = t;
  const TRECHOS = Object.fromEntries(Object.entries(TRILHAS).map(([id, t]) => [t.trecho, id]));

  /* ============================================================== motores
     Cada modelo tem o motor dele. `cil` muda a frequência de explosão (é a
     conta de verdade: rotação/60 × cilindros/2), `aspereza` mede quanto de
     ruído de admissão entra, `corpo` é o peso do sub e `corte` a abertura do
     filtro — é a diferença entre um seis-cilindros liso e um diesel engasgado. */
  const MOTORES = {
    sedan_oficial: {nome: 'Seis cilindros', cil: 6, aspereza: .5, corpo: .55, corte: 1, marcha: 1, ronco: .18},
    hatch_velho: {nome: 'Quatro pequeno', cil: 4, aspereza: .95, corpo: .3, corte: 1.35, marcha: 1.18, ronco: .1},
    picape: {nome: 'Diesel', cil: 4, aspereza: 1.5, corpo: .85, corte: .62, marcha: .82, ronco: .34},
    /* Bicicleta: NÃO tem motor. `mudo` desliga o oscilador do motor inteiro —
       o que fica é o pneu no asfalto, o vento e o tique da corrente. Uma
       bicicleta com ronco de escapamento seria o detalhe que estraga tudo. */
    bicicleta: {nome: 'Sem motor (pedal)', cil: 1, aspereza: .2, corpo: .05, corte: 2.2, marcha: 1, ronco: 0, mudo: true, corrente: true}
  };
  const motorDe = id => MOTORES[id] || MOTORES.sedan_oficial;
  // Cinco marchas: dentro de cada faixa a rotação sobe; na troca, cai de novo.
  const BANDAS = [0, .15, .32, .51, .73, 1.0001];
  const ROT_MIN = 900, ROT_MAX = 5600;

  /* ============================================================== o aparelho */
  class Aparelho {
    constructor(ctx, bus, ruidoBranco, ruidoMarrom, perfil) {
      this.ctx = ctx; this.perfil = perfil; this.fontes = [];
      const osc = (tipo, det, g, destino) => {
        const o = ctx.createOscillator(); o.type = tipo; o.detune.value = det;
        const gg = ctx.createGain(); gg.gain.value = g;
        o.connect(gg).connect(destino); o.start(); this.fontes.push(o);
        return {o, g: gg};
      };
      const leito = (buffer, tipo, freq, q, destino) => {
        const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(destino); src.start(Math.random()); this.fontes.push(src);
        return {f, g};
      };
      // ---- motor
      this.motor = ctx.createGain(); this.motor.gain.value = 0; this.motor.connect(bus);
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 700; this.lp.Q.value = .8;
      this.lp.connect(this.motor);
      this.corpo = osc('sawtooth', 0, .45, this.lp);
      this.bate = osc('sawtooth', 13, .3, this.lp);          // batimento: a aspereza do motor
      this.harm = osc('square', -6, .16, this.lp);
      this.sub = osc('sine', 0, perfil.corpo, this.lp);
      this.admissao = leito(ruidoBranco, 'bandpass', 900, 1.1, this.lp);
      // ---- rolamento e vento
      this.rolo = ctx.createGain(); this.rolo.gain.value = 1; this.rolo.connect(bus);
      this.pneu = leito(ruidoMarrom, 'lowpass', 400, .8, this.rolo);
      this.vento = leito(ruidoBranco, 'bandpass', 700, .6, this.rolo);
      this.canto = leito(ruidoBranco, 'bandpass', 1400, 9, this.rolo);   // derrapagem
    }
    parar() { for (const s of this.fontes) { try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} } this.fontes.length = 0; }
  }

  /* ============================================================== o controle */
  const mixerPadrao = () => ({ligado: true, trilha: '', motor: .8, pneus: .6, efeitos: .9, musica: .55});
  const elo = {som: null, aparelho: null, bus: null, ativo: null, musicaAntes: null, mixer: mixerPadrao(), marcha: 0, rot: ROT_MIN, freq: 0};
  const ouvintes = new Set();
  const avisar = () => { for (const fn of ouvintes) try { fn(elo.mixer); } catch (e) { console.error(e); } };

  function ligar(som) { if (som) elo.som = som; return SomEstrada; }
  /* O barramento da estrada: sai direto na saída, como os efeitos, para
     funcionar mesmo com o ambiente das cenas desligado. */
  function barramento() {
    const som = elo.som;
    if (!som || !som.ensureFx || !som.ensureFx()) return null;
    const ctx = som.ctx;
    if (!elo.bus || elo.busCtx !== ctx) {
      elo.bus = ctx.createGain(); elo.bus.gain.value = 0; elo.bus.connect(ctx.destination); elo.busCtx = ctx;
    }
    return ctx;
  }

  function iniciar({variacao = 'rodovia', modelo = 'sedan_oficial'} = {}) {
    parar(true);
    const m = elo.mixer;
    if (!m.ligado) return false;
    const ctx = barramento();
    if (!ctx) return false;
    const som = elo.som;
    elo.aparelho = new Aparelho(ctx, elo.bus, som.white, som.brown, motorDe(modelo));
    elo.ativo = {variacao, modelo, perfil: motorDe(modelo)};
    elo.marcha = 0; elo.rot = ROT_MIN;
    elo.bus.gain.setTargetAtTime(Math.max(.05, som.volume) * .9, ctx.currentTime, .1);
    // Trilha: a do trecho, ou a que o mestre fixou.
    const trilha = m.trilha === 'silencio' ? null : (m.trilha || TRECHOS[variacao] || null);
    elo.musicaAntes = som.musicId || null;
    if (trilha && m.musica > 0) { som.setMusicVolume(m.musica); som.playMusic(trilha); }
    else if (trilha === null && m.trilha === 'silencio') som.stopMusic(true);
    return true;
  }

  /* Um passo por quadro: rotação, marcha, carga, rolamento, vento e canto. */
  function passo(dt, estado = {}) {
    const ap = elo.aparelho, som = elo.som, m = elo.mixer;
    if (!ap || !som || !som.ctx) return;
    const t = som.ctx.currentTime;
    const v = clamp(estado.velocidade || 0, 0, 1);
    const acelerando = estado.acelerando !== false && !estado.freando;
    // Marcha pela faixa de velocidade; a rotação sobe dentro da marcha.
    let marcha = 0;
    while (marcha < BANDAS.length - 2 && v >= BANDAS[marcha + 1]) marcha++;
    const faixa = (v - BANDAS[marcha]) / Math.max(1e-4, BANDAS[marcha + 1] - BANDAS[marcha]);
    const alvo = ROT_MIN + clamp(faixa, 0, 1) * (ROT_MAX - ROT_MIN) * ap.perfil.marcha;
    elo.rot += (alvo - elo.rot) * clamp(dt * 9, 0, 1);
    const trocou = marcha !== elo.marcha;
    elo.marcha = marcha;
    const rot = elo.rot;
    // A conta de verdade de um motor: explosões por segundo = rotação/60 × cilindros/2
    // (quatro tempos: cada cilindro queima uma vez a cada duas voltas).
    const f = rot / 60 * ap.perfil.cil / 2;
    elo.freq = f;
    const carga = clamp((acelerando ? .45 : .12) + v * .55 + (estado.fora ? .2 : 0), 0, 1);
    const set = (p, val, tau = .06) => { try { p.setTargetAtTime(val, t, tau); } catch (e) { p.value = val; } };
    set(ap.corpo.o.frequency, f);
    set(ap.bate.o.frequency, f * 1.006);
    set(ap.harm.o.frequency, f * 2);
    set(ap.sub.o.frequency, Math.max(26, f * .5));
    set(ap.lp.frequency, (240 + carga * 1500 + f * 2.6) * ap.perfil.corte, .09);
    set(ap.admissao.f.frequency, Math.max(320, f * 4.5));
    set(ap.admissao.g.gain, (.02 + carga * .05) * ap.perfil.aspereza * m.motor);
    // Um motor engasgado (diesel) treme de propósito; o liso, quase nada.
    const tremor = 1 + Math.sin(t * rot * .012) * ap.perfil.ronco * .35;
    /* Bicicleta: o motor fica em zero e não há troca de marcha para estalar.
       No lugar do ronco entra o TIQUE da corrente — um clique curto por volta
       de pedal, mais rápido quanto mais depressa ela vai. */
    if (ap.perfil.mudo) {
      set(ap.motor.gain, 0, .05);
      if (ap.perfil.corrente && m.motor > 0 && v > .06) {
        const periodo = .5 / Math.max(.08, v);
        if (t - (elo.tiqueEm || 0) > periodo) {
          elo.tiqueEm = t;
          try { som.click(2600 + v * 900, .012, .03 * m.motor * (.4 + v), 0, 'highpass', elo.bus); } catch (e) {}
        }
      }
    } else {
      set(ap.motor.gain, (.04 + carga * .3) * m.motor * tremor, trocou ? .02 : .07);
      if (trocou && m.motor > 0) { try { som.click(280, .06, .12 * m.motor, 0, 'lowpass', elo.bus); } catch (e) {} }
    }
    // Rolamento: asfalto liso, ou cascalho fora da pista.
    const fora = !!estado.fora;
    set(ap.pneu.f.frequency, fora ? 1500 + v * 1800 : 260 + v * 900, .08);
    set(ap.pneu.g.gain, (fora ? .09 + v * .22 : .012 + v * .085) * m.pneus);
    set(ap.vento.f.frequency, 500 + v * 1700, .1);
    set(ap.vento.g.gain, v * v * .07 * m.pneus);
    // Canto do pneu: guinada forte com velocidade, ou freada.
    const guinada = Math.abs(estado.giro || 0) * v;
    const cantando = (guinada > .55 || (estado.freando && v > .5)) ? clamp((guinada - .4) * 1.4 + (estado.freando ? .4 : 0), 0, 1) : 0;
    set(ap.canto.f.frequency, 1100 + cantando * 900, .05);
    set(ap.canto.g.gain, cantando * .06 * m.pneus, .04);
    // O volume geral acompanha o volume do mapa do mestre.
    if (elo.bus) set(elo.bus.gain, Math.max(.05, som.volume) * .9, .2);
  }

  function parar(silencioso = false) {
    if (elo.aparelho) {
      const ap = elo.aparelho; elo.aparelho = null;
      try { ap.motor.gain.setTargetAtTime(0, elo.som.ctx.currentTime, .08); ap.rolo.gain.setTargetAtTime(0, elo.som.ctx.currentTime, .08); } catch (e) {}
      setTimeout(() => ap.parar(), 400);
    }
    elo.ativo = null;
    if (!silencioso && elo.som) {
      // A música volta para o que estava tocando antes da viagem.
      const antes = elo.musicaAntes;
      elo.som.setMusicVolume(elo.musicaAntes === null ? elo.som.musicVolume : elo.som.musicVolume);
      if (antes) elo.som.playMusic(antes); else elo.som.stopMusic();
    }
    elo.musicaAntes = null;
  }
  /* Os efeitos do minigame (batida, cascalho, passagem, buzina, chegada) passam
     por aqui para respeitarem o volume de efeitos da estrada. */
  function efeito(nome) {
    const m = elo.mixer;
    if (!m.ligado || !(m.efeitos > 0) || !elo.som || !elo.som.sfx) return false;
    try { elo.som.sfx(nome, m.efeitos); } catch (e) { return false; }
    return true;
  }

  /* Amostra de quatro segundos para o mestre ouvir o motor sem viajar. */
  function testar(modelo = 'sedan_oficial') {
    if (!barramento()) return false;
    iniciar({variacao: 'rodovia', modelo});
    if (!elo.aparelho) return false;
    const antes = elo.mixer.trilha;
    elo.som.stopMusic(true);
    let t = 0;
    const passoTeste = () => {
      t += .05;
      const v = t < 3 ? Math.min(1, t / 3) : Math.max(0, 1 - (t - 3) / 1);
      passo(.05, {velocidade: v, acelerando: t < 3, giro: 0});
      if (t < 4.2) setTimeout(passoTeste, 50); else { parar(); elo.mixer.trilha = antes; }
    };
    passoTeste();
    return true;
  }

  function definirMixer(chave, valor) {
    if (!(chave in elo.mixer)) return false;
    elo.mixer[chave] = chave === 'ligado' ? !!valor : chave === 'trilha' ? String(valor || '') : clamp(Number(valor) || 0, 0, 1);
    if (chave === 'ligado' && !elo.mixer.ligado) parar();
    if (chave === 'musica' && elo.ativo && elo.som) elo.som.setMusicVolume(elo.mixer.musica);
    avisar();
    return true;
  }
  const aplicarMixer = dados => {
    if (!dados || typeof dados !== 'object') return;
    for (const chave of Object.keys(mixerPadrao())) if (dados[chave] !== undefined) definirMixer(chave, dados[chave]);
  };

  const SomEstrada = {
    ligar, iniciar, passo, parar, efeito, testar, definirMixer, aplicarMixer,
    TRILHAS, TRECHOS, MOTORES, motorDe,
    get mixer() { return {...elo.mixer}; },
    get tocando() { return !!elo.aparelho; },
    get estado() {
      return {marcha: elo.marcha + 1, rotacao: Math.round(elo.rot),
        explosoes: Math.round((elo.freq || 0) * 10) / 10, ativo: elo.ativo};
    },
    opcoesTrilha: () => [['', 'Combina com o trecho'], ...Object.entries(TRILHAS).map(([id, t]) => [id, t.label]), ['silencio', 'Sem música']],
    on(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
  };
  root.SomEstrada = SomEstrada;
  if (typeof module !== 'undefined' && module.exports) module.exports = SomEstrada;
})(typeof window !== 'undefined' ? window : globalThis);
