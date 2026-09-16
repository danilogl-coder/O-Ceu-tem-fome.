/* Ambient sound, synthesised — no audio files, like the art.
   Room tone, a wall clock, rain on the window, crickets at night, wind for
   exterior scenes, thunder after lightning and a heartbeat under the tension
   pulse. Browsers only allow sound after a click, so it starts from a button.

   The clues have their own effects (paper, drawers, keys, the terminal, the
   alarm, the rocket). They go through a separate channel that works even with
   the ambience off, and start on the click that opened the clue. */
(function (root) {
  'use strict';
  class Ambience {
    constructor() { this.ctx = null; this.on = false; this.volume = .6; this.desc = null; this.timers = []; this.fxOn = true; this.fx = null; }
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
    setScene(desc) { this.desc = desc; this.apply(); }
    apply() {
      if (!this.ctx || !this.desc) return;
      const d = this.desc, now = this.ctx.currentTime, interior = d.scene !== 'campo';
      const set = (bed, value) => bed.gain.gain.setTargetAtTime(this.on ? value : 0, now, .8);
      set(this.room, interior ? .5 : .08);
      set(this.rain, d.weather === 'chuva' ? .16 : 0);
      set(this.wind, interior ? (d.weather === 'chuva' ? .05 : 0) : .35);
    }
    schedule() {
      for (const t of this.timers) clearInterval(t);
      this.timers = [
        setInterval(() => { // wall clock
          if (!this.on || !this.desc || this.desc.scene !== 'escritorio') return;
          this.click(3200, .03, .09); this.click(1900, .025, .05, .5);
        }, 1000),
        setInterval(() => { // crickets and drops
          if (!this.on || !this.desc) return;
          const night = ['noite', 'apagao'].includes(this.desc.preset);
          if (night && this.desc.weather !== 'chuva' && Math.random() < .55) for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 200, .045, .012, i * .07);
          if (this.desc.weather === 'chuva' && Math.random() < .7) this.click(900 + Math.random() * 2500, .05, .06, Math.random() * .5);
        }, 700),
        setInterval(() => { // heartbeat under the tension pulse
          if (!this.on || !this.desc?.effects?.pulse) return;
          this.tone(58, .22, .5); this.tone(52, .25, .35, .26);
        }, 2417)
      ];
    }
    thunder() {
      if (!this.on || !this.ctx) return;
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
})(typeof window !== 'undefined' ? window : globalThis);
