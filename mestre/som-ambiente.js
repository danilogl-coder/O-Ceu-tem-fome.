/* Ambient sound, synthesised — no audio files, like the art.
   Room tone, a wall clock, rain on the window, crickets at night, wind for
   exterior scenes, thunder after lightning and a heartbeat under the tension
   pulse. Browsers only allow sound after a click, so it starts from a button.

   The clues have their own effects (paper, drawers, keys, the terminal, the
   alarm, the rocket), and so does exploring the building (coins and vending
   machines, the arcade, fuses and power, the television and the phone line,
   doors and the lift, the fridge, the flush, glass, a drip). They go through
   a separate channel that works even with the ambience off, and start on the
   click that set them off. */
(function (root) {
  'use strict';
  /* Every ambient sound is a channel the master can mute on its own. */
  const CHANNELS = [
    ['sala', 'Tom da sala', 'o ar parado do escritório'], ['chuva', 'Chuva na janela', 'quando o clima é chuva'],
    ['vento', 'Vento', 'lá fora, e um fio dele com chuva'], ['relogio', 'Relógio de parede', 'tique-taque no escritório'],
    ['noite', 'Grilos e pingos', 'grilos à noite, pingos na chuva'], ['coracao', 'Batimento', 'sob o pulso de tensão'],
    ['trovao', 'Trovão', 'depois de cada relâmpago'], ['passos', 'Passos do personagem', 'madeira ou grama, andando e correndo']];
  /* Music, written as notes and played by the browser: a few short loops the
     master turns on and off. Beats are quarter notes; pitches are MIDI. Each
     voice has a wave, a loudness, an envelope and its notes as [beat, pitch,
     length in beats]; `every` repeats a voice's pattern every so many beats. */
  const arp = (beats, chords, pattern) => { const out = []; chords.forEach((chord, c) => pattern.forEach((k, i) => out.push([c * beats + i * beats / pattern.length, chord[k % chord.length], beats / pattern.length * .9]))); return out; };
  const SFX = [['porta_abrir', 'Porta abrindo'], ['porta_fechar', 'Porta batendo'], ['porta_trancada', 'Porta trancada'], ['porta_metal', 'Porta de metal'],
    ['passos_escada', 'Passos na escada'], ['passos_cima', 'Passos no andar de cima'], ['campainha', 'Campainha'], ['telefone_tocando', 'Telefone tocando'],
    ['elevador', 'Elevador chegando'], ['elevador_motor', 'Motor do elevador'], ['vidro_quebrando', 'Vidro quebrando'], ['objeto', 'Coisa caindo'],
    ['goteira', 'Goteira'], ['descarga', 'Descarga'], ['geladeira', 'Geladeira'], ['armario', 'Armário'], ['gaveta', 'Gaveta'], ['gaveta_metal', 'Gaveta de metal'],
    ['buzina', 'Buzina'], ['sirene', 'Sirene'], ['alarme', 'Alarme'], ['vento', 'Vento'], ['assobio', 'Assobio'], ['grave', 'Estrondo grave'], ['explosao', 'Explosão'],
    ['estatica', 'Estática'], ['glitch', 'Falha eletrônica'], ['beep', 'Bipe'], ['maquina', 'Máquina'], ['disjuntor', 'Disjuntor'], ['faisca', 'Faísca'], ['energia', 'Energia voltando'],
    ['tv_liga', 'TV ligando'], ['tv_canal', 'Troca de canal'], ['discagem', 'Discagem'], ['ocupado', 'Linha ocupada'], ['arcade', 'Fliperama'], ['moeda', 'Moeda'],
    ['queda_produto', 'Produto caindo'], ['tranca', 'Trancando'], ['destranca', 'Destrancando'], ['interruptor', 'Interruptor'], ['papel', 'Papel'], ['clique', 'Clique']];
  const MUSIC = {
    investigacao: {label: 'Investigação', bpm: 84, length: 32, tone: 'noir',
      voices: [
        {wave: 'sine', gain: .22, attack: .01, release: .12, low: 900, notes: [[0, 38, 1], [1, 38, 1], [2, 41, 1], [3, 43, 1], [4, 45, 1], [5, 45, 1], [6, 43, 1], [7, 41, 1], [8, 36, 1], [9, 36, 1], [10, 39, 1], [11, 41, 1], [12, 43, 1], [13, 43, 1], [14, 41, 1], [15, 39, 1], [16, 38, 1], [17, 38, 1], [18, 41, 1], [19, 43, 1], [20, 45, 1], [21, 45, 1], [22, 48, 1], [23, 46, 1], [24, 45, 1], [25, 43, 1], [26, 41, 1], [27, 39, 1], [28, 38, 1], [29, 36, 1], [30, 34, 1], [31, 33, 1]]},
        {wave: 'triangle', gain: .12, attack: .005, release: .25, low: 2600, notes: [[0, 62, .5], [1.5, 65, .5], [3, 69, 1.5], [6, 67, .5], [7, 65, 1], [8, 60, .5], [9.5, 62, .5], [11, 65, 2], [16, 62, .5], [17.5, 65, .5], [19, 72, 1.5], [22, 70, .5], [23, 69, 1], [24, 67, .5], [25.5, 65, .5], [27, 62, 3]]},
        {wave: 'sawtooth', gain: .035, attack: .6, release: 1.2, low: 700, notes: [[0, 50, 8], [0, 53, 8], [0, 57, 8], [8, 48, 8], [8, 51, 8], [8, 55, 8], [16, 50, 8], [16, 53, 8], [16, 57, 8], [24, 45, 8], [24, 48, 8], [24, 52, 8]]},
        {wave: 'noise', gain: .05, attack: .002, release: .07, freq: 4200, notes: [[1, 0, .1], [3, 0, .1], [5, 0, .1], [7, 0, .1]], every: 8}]},
    tensao: {label: 'Tensão', bpm: 60, length: 16, tone: 'drone',
      voices: [
        {wave: 'sine', gain: .3, attack: 1.5, release: 2, low: 300, notes: [[0, 31, 16]]},
        {wave: 'sawtooth', gain: .05, attack: 2, release: 2.5, low: 260, detune: 7, notes: [[0, 43, 16], [0, 49.5, 16]]},
        {wave: 'triangle', gain: .07, attack: .02, release: .6, low: 3000, notes: [[3, 74, .3], [7.5, 75, .3], [11, 74, .3], [14, 80, .6]]},
        {wave: 'noise', gain: .09, attack: 1.2, release: 1.6, freq: 240, notes: [[0, 0, 4]], every: 8}]},
    chuva: {label: 'Chuva calma', bpm: 72, length: 32, tone: 'calm',
      voices: [
        {wave: 'triangle', gain: .09, attack: .01, release: .35, low: 3200, notes: arp(8, [[57, 60, 64, 67, 71], [55, 59, 62, 65, 69], [53, 57, 60, 64, 67], [52, 55, 59, 62, 67]], [0, 1, 2, 3, 4, 3, 2, 1])},
        {wave: 'sine', gain: .18, attack: .05, release: .6, low: 500, notes: [[0, 45, 4], [4, 45, 4], [8, 43, 4], [12, 43, 4], [16, 41, 4], [20, 41, 4], [24, 40, 4], [28, 40, 4]]},
        {wave: 'sawtooth', gain: .025, attack: 1.2, release: 1.5, low: 600, notes: [[0, 64, 8], [0, 67, 8], [8, 62, 8], [8, 65, 8], [16, 60, 8], [16, 64, 8], [24, 59, 8], [24, 62, 8]]}]},
    perseguicao: {label: 'Perseguição', bpm: 150, length: 32, tone: 'chase',
      voices: [
        {wave: 'square', gain: .09, attack: .003, release: .05, low: 1200, notes: [[0, 33, .5], [.5, 33, .5], [1, 45, .5], [1.5, 33, .5], [2, 33, .5], [2.5, 44, .5], [3, 33, .5], [3.5, 45, .5]], every: 4},
        {wave: 'sawtooth', gain: .06, attack: .005, release: .12, low: 2500, notes: [[0, 57, .5], [1, 60, .5], [2, 64, .5], [3, 60, .5], [4, 57, .5], [5, 60, .5], [6, 63, .5], [7, 60, .5], [8, 56, .5], [9, 60, .5], [10, 63, .5], [11, 60, .5], [12, 56, .5], [13, 59, .5], [14, 62, .5], [15, 59, .5]], every: 16},
        {wave: 'noise', gain: .16, attack: .002, release: .12, freq: 1800, notes: [[1, 0, .1], [3, 0, .1]], every: 4},
        {wave: 'noise', gain: .08, attack: .002, release: .04, freq: 6500, notes: [[0, 0, .05], [.5, 0, .05], [1, 0, .05], [1.5, 0, .05], [2, 0, .05], [2.5, 0, .05], [3, 0, .05], [3.5, 0, .05]], every: 4},
        {wave: 'sine', gain: .2, attack: .002, release: .1, low: 200, notes: [[0, 33, .3], [2, 33, .3], [2.5, 33, .3]], every: 4}]},
    lamento: {label: 'Lamento', bpm: 66, length: 32, tone: 'sad',
      voices: [
        {wave: 'triangle', gain: .13, attack: .02, release: .5, low: 2400, notes: [[0, 69, 2], [2, 67, 1], [3, 65, 1], [4, 64, 3], [8, 65, 2], [10, 67, 1], [11, 69, 1], [12, 64, 3], [16, 69, 1.5], [17.5, 72, 1.5], [19, 71, 1], [20, 69, 2], [22, 67, 2], [24, 65, 2], [26, 64, 1], [27, 62, 1], [28, 60, 4]]},
        {wave: 'sine', gain: .2, attack: .1, release: .8, low: 400, notes: [[0, 45, 4], [4, 40, 4], [8, 41, 4], [12, 40, 4], [16, 45, 4], [20, 43, 4], [24, 41, 4], [28, 36, 4]]},
        {wave: 'sawtooth', gain: .03, attack: 1, release: 1.5, low: 650, notes: [[0, 57, 4], [0, 60, 4], [4, 55, 4], [4, 59, 4], [8, 53, 4], [8, 57, 4], [12, 52, 4], [12, 55, 4], [16, 57, 4], [16, 60, 4], [20, 55, 4], [20, 59, 4], [24, 53, 4], [24, 57, 4], [28, 48, 4], [28, 52, 4]]}]},
  };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  class Ambience {
    constructor() {
      this.ctx = null; this.on = false; this.volume = .6; this.desc = null; this.timers = []; this.fxOn = true; this.fx = null;
      this.channels = Object.fromEntries(CHANNELS.map(([id]) => [id, true]));
      this.music = null; this.musicVolume = .5; this.musicGain = null; this.musicTimer = null;
      this.surface = 'madeira'; this.lastStep = 0;
    }
    static get CHANNELS() { return CHANNELS; }
    static get MUSIC() { return MUSIC; }
    /* Os efeitos com nome, para os eventos das cenas escolherem. */
    static get SFX() { return SFX; }
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
      const noise = (seconds, brown) => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
        return buf;
      };
      this.white = noise(2, false); this.brown = noise(4, true);
      const bed = (buffer, type, freq, q = .7) => {
        const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(this.master); src.start();
        return {gain, filter};
      };
      this.room = bed(this.brown, 'lowpass', 220);
      this.rain = bed(this.white, 'bandpass', 2600, .45);
      this.wind = bed(this.brown, 'bandpass', 480, .9);
      this.windLfo = ctx.createOscillator(); this.windLfo.frequency.value = .08;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 180; this.windLfo.connect(lfoGain).connect(this.wind.filter.frequency); this.windLfo.start();
      return ctx;
    }
    click(freq, duration, gain, when = 0, type = 'bandpass', dest = this.master) {
      const ctx = this.ctx, t = ctx.currentTime + when;
      const src = ctx.createBufferSource(); src.buffer = this.white;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      src.connect(f).connect(g).connect(dest); src.start(t, Math.random()); src.stop(t + duration + .05);
    }
    tone(freq, duration, gain, when = 0, type = 'sine', dest = this.master, toFreq = null) {
      const ctx = this.ctx, t = ctx.currentTime + when;
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + duration);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      o.connect(g).connect(dest); o.start(t); o.stop(t + duration + .05);
      return o;
    }
    /* Filtered noise with an envelope; the filter may sweep. */
    noise({buffer = this.white, type = 'bandpass', freq = 1000, to = null, q = 1, duration = .3, gain = .2, attack = .01, when = 0, dest = this.fx} = {}) {
      const ctx = this.ctx, t = ctx.currentTime + when;
      const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (to) f.frequency.exponentialRampToValueAtTime(to, t + duration);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      src.connect(f).connect(g).connect(dest); src.start(t, Math.random() * 1.5); src.stop(t + duration + .1);
      return {src, g, f};
    }
    ensureFx() {
      if (!this.fxOn) return null;
      const ctx = this.ensure();
      if (!ctx) return null;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!this.fx) { this.fx = ctx.createGain(); this.fx.gain.value = Math.max(.05, this.volume) * .9; this.fx.connect(ctx.destination); }
      return ctx;
    }
    stopFx() {
      if (!this.fx || !this.ctx) return;
      const old = this.fx; this.fx = null;
      old.gain.setTargetAtTime(0, this.ctx.currentTime, .04);
      setTimeout(() => { try { old.disconnect(); } catch {} }, 400);
    }
    setFx(on) { this.fxOn = !!on; if (!on) this.stopFx(); }
    /* Effects for clues and cinematics. */
    sfx(name) {
      if (!this.ensureFx()) return;
      const fx = this.fx, c = (f, d, g, w = 0, type) => this.click(f, d, g, w, type, fx), n = o => this.noise({dest: fx, ...o});
      const tone = (f, d, g, w = 0, type = 'sine', to = null) => this.tone(f, d, g, w, type, fx, to);
      /* A held tone - a line tone, a hum - that stays level instead of dying away; `low` puts a lowpass on it. */
      const hold = (f, d, g, w = 0, type = 'sine', low = 0) => {
        const ctx = this.ctx, t = ctx.currentTime + w, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
        const env = ctx.createGain(); env.gain.setValueAtTime(.0001, t); env.gain.exponentialRampToValueAtTime(g, t + .015); env.gain.setValueAtTime(g, t + Math.max(.02, d - .04)); env.gain.exponentialRampToValueAtTime(.0001, t + d);
        let head = o;
        if (low) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = low; head = o.connect(lp); }
        head.connect(env).connect(fx); o.start(t); o.stop(t + d + .05);
      };
      switch (name) {
        case 'clique': c(2600, .025, .1); break;
        case 'papel': n({freq: 3200, q: .7, duration: .16, gain: .16}); n({freq: 2200, q: .9, duration: .12, gain: .1, when: .07}); break;
        case 'fechar': n({type: 'lowpass', freq: 520, duration: .09, gain: .22}); break;
        case 'pista': tone(660, .2, .11); tone(990, .3, .1, .09); tone(1320, .38, .06, .18, 'triangle'); break;
        case 'gaveta': n({type: 'lowpass', freq: 260, to: 1300, q: 2, duration: .32, gain: .28}); c(300, .08, .35, .3, 'lowpass'); break;
        case 'teclado': c(1500, .03, .15); c(900, .04, .12, .06); break;
        case 'tecla': c(1700 + Math.random() * 500, .025, .12); break;
        case 'beep': tone(880, .12, .07, 0, 'square'); break;
        case 'erro': tone(220, .2, .08, 0, 'square'); tone(170, .24, .07, .14, 'square'); break;
        case 'boot': n({type: 'lowpass', freq: 160, duration: .5, gain: .4, attack: .005}); tone(58, .9, .18); c(3200, .02, .1, .35); tone(15600, .8, .015, .4); break;
        case 'desligar': tone(1400, .38, .06, 0, 'sine', 70); n({type: 'lowpass', freq: 200, duration: .2, gain: .15}); break;
        case 'lupa': c(5200, .02, .07); tone(2400, .06, .03, .01); break;
        case 'tampa': c(3000, .03, .14); c(1400, .06, .14, .07); break;
        case 'botao': n({type: 'lowpass', freq: 190, duration: .3, gain: .7, attack: .004}); c(700, .07, .35, .01); break;
        case 'alarme': {
          const ctx = this.ctx, t = ctx.currentTime;
          const o = ctx.createOscillator(); o.type = 'square';
          const lfo = ctx.createOscillator(); lfo.frequency.value = 2.3; const depth = ctx.createGain(); depth.gain.value = 170;
          o.frequency.value = 760; lfo.connect(depth).connect(o.frequency);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
          const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .05); g.gain.setValueAtTime(.08, t + 2.45); g.gain.exponentialRampToValueAtTime(.0001, t + 2.7);
          o.connect(lp).connect(g).connect(fx); o.start(t); lfo.start(t); o.stop(t + 2.8); lfo.stop(t + 2.8);
          break;
        }
        case 'interruptor': c(1200, .02, .2); c(3000, .015, .12, .025); break;
        case 'telefone': n({freq: 1300, q: .8, duration: 1.8, gain: .04, attack: .1}); n({buffer: this.brown, type: 'lowpass', freq: 420, duration: 1.1, gain: .18, attack: .5, when: .5}); break;
        case 'fone': c(480, .07, .3, 0, 'lowpass'); break;
        case 'roda': c(2300, .02, .1); c(1600, .015, .06, .03); break;
        case 'tranca': n({freq: 900, q: 3, duration: .12, gain: .3}); tone(140, .16, .14, 0, 'triangle'); break;
        case 'destranca': c(1900, .03, .22); c(2700, .03, .22, .09); tone(190, .12, .12, .09, 'triangle'); break;
        case 'lacre': c(900, .05, .25); n({freq: 3600, q: .6, duration: .3, gain: .12, when: .05}); break;
        case 'objeto': c(700, .05, .12); break;
        case 'barbante': n({freq: 1700, to: 2600, q: 2, duration: .9, gain: .07, attack: .1}); break;
        case 'glitch': for (let i = 0; i < 26; i++) tone(90 + Math.random() * 1900, .05 + Math.random() * .05, .05, i * .1, Math.random() < .5 ? 'square' : 'sawtooth'); break;
        case 'estatica': n({type: 'highpass', freq: 1200, q: .3, duration: .45, gain: .22, attack: .005}); break;
        case 'sirene': tone(520, .9, .025, 0, 'triangle', 780); tone(780, .9, .025, .9, 'triangle', 520); break;
        case 'lancamento': {
          n({buffer: this.brown, type: 'lowpass', freq: 140, to: 900, q: .7, duration: 3.6, gain: .9, attack: .6});
          tone(44, 3.4, .22, .1, 'sine', 30);
          n({type: 'bandpass', freq: 300, to: 1800, q: .5, duration: 3.2, gain: .12, attack: 1, when: .3});
          break;
        }
        case 'vento': n({buffer: this.brown, type: 'bandpass', freq: 380, to: 700, q: .6, duration: 3, gain: .35, attack: 1}); break;
        case 'assobio': tone(2100, 1.25, .07, 0, 'sine', 380); break;
        case 'explosao': {
          n({buffer: this.brown, type: 'lowpass', freq: 110, to: 60, q: .5, duration: 5, gain: 2, attack: .012});
          n({type: 'bandpass', freq: 700, to: 200, q: .4, duration: 1.8, gain: .5, attack: .005});
          tone(36, 3.5, .5, 0, 'sine', 24);
          for (let i = 0; i < 16; i++) c(200 + Math.random() * 900, .08, .3 * Math.random(), .2 + Math.random() * 2.5, 'bandpass');
          break;
        }
        case 'grave': tone(55, 2.8, .12, 0, 'sine', 48); n({buffer: this.brown, type: 'lowpass', freq: 120, duration: 2.8, gain: .2, attack: .8}); break;
        /* ---- exploring: money and machines */
        case 'moeda': // a coin on the counter: bright, inharmonic rings, and a small bounce
          c(5200, .015, .09); tone(2637, .32, .05); tone(3951, .22, .03, .004); tone(5588, .14, .018, .008);
          tone(2793, .18, .03, .11); tone(4186, .12, .018, .112); c(5600, .012, .05, .11);
          break;
        case 'maquina': // a vending machine: the motor hums while the spiral turns
          n({buffer: this.brown, type: 'bandpass', freq: 220, q: 1.4, duration: 1.3, gain: .32, attack: .08});
          hold(98, 1.25, .04, 0, 'sawtooth', 700); hold(196, 1.2, .012, 0, 'square', 900);
          for (let i = 0; i < 6; i++) c(1100 + (i % 2) * 300, .025, .07, .15 + i * .17);
          break;
        case 'queda_produto': // what was bought lands in the tray, and bumps once more
          n({buffer: this.brown, type: 'lowpass', freq: 200, duration: .28, gain: .5, attack: .003});
          c(420, .09, .25, 0, 'lowpass'); c(1500, .03, .1, .02); tone(150, .18, .07, 0, 'triangle', 90);
          c(900, .03, .08, .16); n({buffer: this.brown, type: 'lowpass', freq: 260, duration: .1, gain: .25, attack: .003, when: .16});
          break;
        case 'arcade': // coin-op jingle: up an arpeggio to a bright top note
          [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i, all) => tone(f, i === all.length - 1 ? .28 : .09, .045, i * .075, 'square'));
          tone(131, .3, .05, 0, 'triangle'); tone(196, .35, .05, .3, 'triangle');
          break;
        case 'arcade_tiro': tone(1600, .13, .065, 0, 'square', 220); c(3000, .02, .06); break;
        case 'arcade_explosao':
          n({type: 'lowpass', freq: 3000, to: 90, q: .6, duration: .5, gain: .25, attack: .003});
          tone(180, .35, .05, 0, 'square', 45);
          for (let i = 0; i < 4; i++) tone(90 + Math.random() * 120, .06, .04, .05 + i * .07, 'square');
          break;
        case 'arcade_fim': // game over: down the scale, the last note sagging
          [784, 740, 698, 659].forEach((f, i) => tone(f, .2, .045, i * .19, 'square'));
          tone(622, .55, .045, .78, 'square', 311); tone(98, .9, .05, .78, 'triangle', 65);
          break;
        /* ---- power */
        case 'disjuntor': // a heavy breaker lever: the clack, and the box rings with it
          c(2200, .025, .35); c(800, .07, .45, .005, 'lowpass');
          n({buffer: this.brown, type: 'lowpass', freq: 380, duration: .16, gain: .8, attack: .002});
          tone(82, .22, .14, 0, 'triangle'); tone(1240, .25, .012, .01);
          break;
        case 'faisca': // sparks: a crackle of tiny discharges over a buzz
          for (let i = 0; i < 12; i++) c(2600 + Math.random() * 5000, .008 + Math.random() * .014, .1 + Math.random() * .16, Math.random() * .42, 'highpass');
          hold(120, .4, .02, 0, 'sawtooth', 2400); n({type: 'highpass', freq: 3500, q: .5, duration: .12, gain: .14, attack: .002});
          break;
        case 'energia': // the power comes back: a hum climbing up to mains pitch
          tone(40, 1.5, .09, 0, 'sawtooth', 120); tone(80, 1.5, .035, .05, 'square', 240);
          n({type: 'bandpass', freq: 180, to: 1400, q: 2, duration: 1.4, gain: .05, attack: .5});
          hold(120, .75, .03, 1.2, 'sawtooth', 1200);
          break;
        /* ---- the television and the phone line */
        case 'tv_liga': // the tube pops on, whines, a burst of snow
          c(620, .06, .5, 0, 'lowpass'); tone(15625, .7, .01, .02);
          n({type: 'highpass', freq: 1400, q: .3, duration: .38, gain: .2, attack: .004, when: .04});
          break;
        case 'tv_canal': n({type: 'highpass', freq: 1200, q: .3, duration: .2, gain: .2, attack: .003}); c(1000, .02, .14); break;
        case 'discagem': { // touch-tone digits, quickly
          const pad = [[941, 1336], [697, 1209], [697, 1336], [697, 1477], [770, 1209], [770, 1336], [770, 1477], [852, 1209], [852, 1336], [852, 1477]];
          for (let i = 0; i < 7; i++) { const [lo, hi] = pad[Math.floor(Math.random() * pad.length)]; hold(lo, .09, .03, i * .13); hold(hi, .09, .025, i * .13); }
          break;
        }
        case 'chamando': for (const w of [0, 1.4]) { hold(425, 1, .04, w); hold(850, 1, .005, w); } break;   // ringback: two long tones (425 Hz, as in Brazil)
        case 'ocupado': for (let i = 0; i < 4; i++) hold(425, .25, .04, i * .5); break;                          // busy: short beeps
        /* ---- doors, the lift, the building */
        case 'porta_abrir': // the latch, then the hinge creaks as the door swings
          c(1700, .03, .3); c(650, .06, .3, .03, 'lowpass');
          n({buffer: this.brown, type: 'bandpass', freq: 520, to: 880, q: 7, duration: .75, gain: .55, attack: .2, when: .1});
          n({buffer: this.brown, type: 'lowpass', freq: 260, duration: .5, gain: .2, attack: .2, when: .15});
          break;
        case 'porta_fechar': // air, the slam, the latch catching
          n({buffer: this.brown, type: 'lowpass', freq: 600, to: 250, duration: .28, gain: .15, attack: .12});
          n({buffer: this.brown, type: 'lowpass', freq: 170, duration: .35, gain: .75, attack: .003, when: .24});
          c(700, .07, .35, .24, 'lowpass'); c(2300, .025, .18, .29);
          break;
        case 'porta_trancada': // the handle is forced: it rattles and will not give
          for (let i = 0; i < 3; i++) { const w = i * .16; c(1250, .04, .26, w); c(2500, .02, .14, w + .025); n({buffer: this.brown, type: 'lowpass', freq: 240, duration: .08, gain: .35, attack: .002, when: w + .02}); }
          break;
        case 'porta_metal': // a steel door: a heavy clang that rings on
          n({buffer: this.brown, type: 'lowpass', freq: 320, duration: .4, gain: .55, attack: .002}); c(2600, .05, .22);
          tone(174, 1.1, .065, 0, 'triangle'); tone(262, .9, .04, .005, 'triangle'); tone(417, .7, .025, .01); tone(689, .5, .015, .01);
          break;
        case 'elevador': tone(1319, 1, .07); tone(2638, .5, .015); tone(1047, 1.3, .07, .38); tone(2094, .6, .015, .38); break;   // the lift arrives: ding-dong
        case 'elevador_motor': // the motor and the cables, for a couple of seconds
          n({buffer: this.brown, type: 'lowpass', freq: 140, to: 240, duration: 2.2, gain: .35, attack: .6});
          hold(62, 2.1, .05, 0, 'sawtooth', 400); hold(124, 2, .012, .05, 'square', 600);
          c(380, .06, .12, .05, 'lowpass'); c(420, .06, .1, 1.95, 'lowpass');
          break;
        case 'passos_escada': // four steps up a staircase, each a little further off
          for (let i = 0; i < 4; i++) {
            const w = i * .34, k = 1 - i * .12;
            n({buffer: this.brown, type: 'lowpass', freq: 250 + i * 25, duration: .12, gain: .55 * k, attack: .002, when: w});
            c(1900 + Math.random() * 600, .02, .08 * k, w); tone(78 + i * 6, .07, .09 * k, w);
          }
          break;
        case 'campainha': // an old electric doorbell: the clapper rattling on its bell
          for (let i = 0; i < 18; i++) { tone(1870, .08, .085, i * .042, 'triangle'); tone(2710, .06, .03, i * .042); }
          tone(1870, .35, .06, .76, 'triangle');
          break;
        case 'gaveta_metal': // a steel drawer runs out and hits its stop
          n({type: 'bandpass', freq: 800, to: 1700, q: 3, duration: .34, gain: .16, attack: .06});
          n({buffer: this.brown, type: 'lowpass', freq: 300, duration: .12, gain: .45, attack: .002, when: .32});
          c(2500, .04, .22, .32); tone(610, .4, .03, .32, 'triangle'); tone(930, .3, .015, .33);
          break;
        case 'armario': // a wooden cupboard door: a creak and a soft knock
          n({buffer: this.brown, type: 'bandpass', freq: 420, to: 690, q: 6, duration: .5, gain: .42, attack: .12});
          c(480, .07, .32, .46, 'lowpass'); c(1300, .025, .12, .48);
          break;
        case 'geladeira': // the rubber seal lets go with a suck, and the compressor hums
          n({type: 'bandpass', freq: 2000, to: 450, q: 1.2, duration: .2, gain: .22, attack: .01}); c(320, .06, .3, .03, 'lowpass');
          hold(50, 1.3, .06, .15); hold(100, 1.3, .02, .15, 'sawtooth', 300);
          n({buffer: this.brown, type: 'lowpass', freq: 180, duration: 1.3, gain: .14, attack: .3, when: .15});
          break;
        case 'descarga': // the lever, the rush of water, the swirl going down
          c(900, .04, .22); c(420, .05, .2, .03, 'lowpass');
          n({type: 'bandpass', freq: 900, to: 380, q: .7, duration: 2, gain: .22, attack: .25, when: .12});
          n({buffer: this.brown, type: 'lowpass', freq: 520, to: 180, duration: 2.2, gain: .34, attack: .35, when: .12});
          for (let i = 0; i < 6; i++) tone(260 + Math.random() * 260, .09, .02, .7 + i * .22, 'sine', 140);
          break;
        case 'buzina': for (const [w, d] of [[0, .45], [.58, .22]]) { hold(349, d, .03, w, 'sawtooth', 900); hold(440, d, .025, w, 'sawtooth', 900); } break;   // a car horn down the street
        case 'passos_cima': // someone walking upstairs: dull thumps through the ceiling
          for (let i = 0; i < 5; i++) { const w = i * .48 + Math.random() * .04; n({buffer: this.brown, type: 'lowpass', freq: 110, duration: .2, gain: .6, attack: .012, when: w}); tone(52, .14, .07, w); }
          break;
        case 'vidro_quebrando': // the pane cracks and bursts; shards tinkle down
          c(3200, .04, .3); n({buffer: this.brown, type: 'lowpass', freq: 400, duration: .15, gain: .35, attack: .002});
          n({type: 'highpass', freq: 2400, q: .4, duration: .55, gain: .2, attack: .002});
          for (let i = 0; i < 22; i++) { const w = .04 + Math.random() * .8; tone(2400 + Math.random() * 4800, .04 + Math.random() * .1, .01 + Math.random() * .018, w); if (i % 3 === 0) c(4000 + Math.random() * 3000, .015, .02 + Math.random() * .05, w, 'highpass'); }
          break;
        case 'telefone_tocando': // an old phone's bell: the clapper between two bells, a second and a half
          for (let i = 0; i < 30; i++) { const f = i % 2 ? 1180 : 1020; tone(f, .14, .08, i * .048, 'triangle'); tone(f * 2.76, .08, .02, i * .048); }
          break;
        case 'goteira': tone(700, .09, .09, 0, 'sine', 1700); c(3500, .01, .05); tone(900, .06, .035, .38, 'sine', 1900); break;   // a drip, and a smaller one
        default: c(1800, .03, .08);
      }
    }
    async start() {
      const ctx = this.ensure();
      if (!ctx) return false;
      await ctx.resume();
      this.on = true;
      this.master.gain.setTargetAtTime(this.volume * .9, ctx.currentTime, .4);
      this.schedule();
      this.apply();
      return true;
    }
    stop() {
      this.on = false;
      for (const t of this.timers) clearInterval(t);
      this.timers = [];
      if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .25);
    }
    setVolume(v) {
      this.volume = v;
      if (this.ctx && this.on) this.master.gain.setTargetAtTime(v * .9, this.ctx.currentTime, .15);
      if (this.ctx && this.fx) this.fx.gain.setTargetAtTime(Math.max(.05, v) * .9, this.ctx.currentTime, .15);
    }
    setScene(desc) { this.desc = desc; this.surface = desc?.scene === 'campo' ? 'grama' : 'madeira'; this.apply(); }
    /* Mute or unmute one ambient sound. */
    setChannel(id, on) { if (id in this.channels) { this.channels[id] = !!on; this.apply(); } }
    setChannels(map) { for (const [id, on] of Object.entries(map || {})) if (id in this.channels) this.channels[id] = !!on; this.apply(); }
    apply() {
      if (!this.ctx || !this.desc) return;
      const d = this.desc, now = this.ctx.currentTime, interior = d.scene !== 'campo', ch = this.channels;
      const set = (bed, value) => bed.gain.gain.setTargetAtTime(this.on ? value : 0, now, .8);
      set(this.room, ch.sala ? (interior ? .5 : .08) : 0);
      set(this.rain, ch.chuva && d.weather === 'chuva' ? .16 : 0);
      set(this.wind, ch.vento ? (interior ? (d.weather === 'chuva' ? .05 : 0) : .35) : 0);
    }
    /* ---- footsteps. A heel on wood is a dull knock with a click on top; on
       grass it is a soft crush of noise. Running is louder and shorter. */
    footstep({surface = this.surface, run = false, land = false} = {}) {
      if (!this.channels.passos || !this.ensureFx()) return false;
      const now = this.ctx.currentTime;
      if (now - this.lastStep < .09) return false;
      this.lastStep = now;
      const fx = this.fx, loud = (land ? 1.6 : run ? 1.2 : 1) * (.7 + Math.random() * .3);
      if (surface === 'grama') {
        this.noise({dest: fx, type: 'bandpass', freq: 1400 + Math.random() * 600, to: 700, q: .8, duration: run ? .11 : .16, gain: .16 * loud, attack: .004});
        this.noise({dest: fx, buffer: this.brown, type: 'lowpass', freq: 260, duration: .1, gain: .12 * loud, attack: .002});
      } else {
        this.noise({dest: fx, buffer: this.brown, type: 'lowpass', freq: 240 + Math.random() * 80, duration: run ? .09 : .13, gain: .55 * loud, attack: .002});
        this.click(1800 + Math.random() * 900, .022, .09 * loud, 0, 'bandpass', fx);
        this.tone(72 + Math.random() * 14, .07, .1 * loud, 0, 'sine', fx);
      }
      if (land) { this.noise({dest: fx, buffer: this.brown, type: 'lowpass', freq: 160, duration: .2, gain: .6, attack: .003}); }
      return true;
    }
    /* ---- music. One loop at a time, scheduled a little ahead of the clock. */
    playMusic(id) {
      const track = MUSIC[id];
      if (!track) return false;
      const ctx = this.ensure(); if (!ctx) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      this.stopMusic(true);
      if (!this.musicGain) { this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(ctx.destination); }
      this.musicGain.gain.setTargetAtTime(this.musicVolume * .8, ctx.currentTime, .6);
      const beat = 60 / track.bpm;
      this.music = {id, track, beat, start: ctx.currentTime + .1, next: 0, lowpass: null};
      const tick = () => {
        const m = this.music; if (!m || m.id !== id) return;
        const horizon = ctx.currentTime + .35;
        while (m.start + m.next * beat < horizon) { this.scheduleBeat(m, m.next); m.next += .5; }
      };
      tick();
      this.musicTimer = setInterval(tick, 120);
      return true;
    }
    scheduleBeat(m, at) {
      const {track, beat} = m, ctx = this.ctx;
      const loopBeat = ((at % track.length) + track.length) % track.length;
      for (const voice of track.voices) {
        const period = voice.every || track.length;
        for (const [b, pitch, len] of voice.notes) {
          if (Math.abs(((loopBeat % period) + period) % period - b) > 1e-6) continue;
          const t = m.start + at * beat, dur = Math.max(.05, len * beat);
          const g = ctx.createGain();
          g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(voice.gain, t + (voice.attack || .01)); g.gain.setValueAtTime(voice.gain, t + Math.max(voice.attack || .01, dur - .01)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + (voice.release || .1));
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = voice.low || voice.freq || 2000;
          if (voice.wave === 'noise') {
            const src = ctx.createBufferSource(); src.buffer = this.white; src.loop = true;
            f.type = 'bandpass'; f.frequency.value = voice.freq || 2000; f.Q.value = 1.2;
            src.connect(f).connect(g).connect(this.musicGain); src.start(t, Math.random()); src.stop(t + dur + (voice.release || .1) + .05);
          } else {
            const o = ctx.createOscillator(); o.type = voice.wave; o.frequency.setValueAtTime(midiHz(pitch), t);
            if (voice.detune) o.detune.value = voice.detune;
            o.connect(f).connect(g).connect(this.musicGain); o.start(t); o.stop(t + dur + (voice.release || .1) + .05);
          }
        }
      }
    }
    stopMusic(quick = false) {
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
      const was = this.music; this.music = null;
      if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, quick ? .15 : .8);
      return was ? was.id : null;
    }
    setMusicVolume(v) { this.musicVolume = v; if (this.musicGain && this.ctx && this.music) this.musicGain.gain.setTargetAtTime(v * .8, this.ctx.currentTime, .15); }
    get musicId() { return this.music ? this.music.id : null; }
    schedule() {
      for (const t of this.timers) clearInterval(t);
      this.timers = [
        setInterval(() => { // wall clock
          if (!this.on || !this.desc || this.desc.scene !== 'escritorio' || !this.channels.relogio) return;
          this.click(3200, .03, .09); this.click(1900, .025, .05, .5);
        }, 1000),
        setInterval(() => { // crickets and drops
          if (!this.on || !this.desc || !this.channels.noite) return;
          const night = ['noite', 'apagao'].includes(this.desc.preset);
          if (night && this.desc.weather !== 'chuva' && Math.random() < .55) for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 200, .045, .012, i * .07);
          if (this.desc.weather === 'chuva' && Math.random() < .7) this.click(900 + Math.random() * 2500, .05, .06, Math.random() * .5);
        }, 700),
        setInterval(() => { // heartbeat under the tension pulse
          if (!this.on || !this.desc?.effects?.pulse || !this.channels.coracao) return;
          this.tone(58, .22, .5); this.tone(52, .25, .35, .26);
        }, 2417)
      ];
    }
    thunder() {
      if (!this.on || !this.ctx || !this.channels.trovao) return;
      const ctx = this.ctx, t = ctx.currentTime + .35 + Math.random() * .6;
      const src = ctx.createBufferSource(); src.buffer = this.brown;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
      src.connect(f).connect(g).connect(this.master); src.start(t, Math.random() * 2); src.stop(t + 3.4);
      this.click(700, .12, .5, .35);
    }
    shake() { if (this.on && this.ctx) { this.tone(40, .7, .6, 0, 'triangle'); this.click(180, .5, .4, 0, 'lowpass'); } }
  }
  root.MapAmbience = Ambience;
  if (typeof module !== 'undefined' && module.exports) module.exports = {MapAmbience: Ambience, CHANNELS, MUSIC};
})(typeof window !== 'undefined' ? window : globalThis);
