/* O d20 da ficha — a encenação de um resultado que já existe.

   O número é sorteado pelo modelo ANTES de a animação começar. Aqui só se
   encena: o dado recua, roda rápido, desacelera com esperas crescentes,
   quica duas vezes, assenta, congela por três quadros com um clarão e só
   então o resultado cresce e volta ao tamanho certo. Por ser encenação, o
   clique pula direto para a revelação sem mexer no número — coisa
   impossível se o valor saísse de uma simulação de física.

   Orçamento, a 60 quadros por segundo: 6 de antecipação, 16 de arremesso,
   14 de desaceleração, 5+3 de quique, 4 de assentamento, 3 de congelamento
   e 10 de revelação. Pouco mais de um segundo. Tudo em segundos no código,
   para não depender da taxa de quadros. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, A = root.FichaArte;
  if (!K || !U || !A) return;
  const C = U.C;

  /* Quando cada fase termina, em segundos. */
  const FASES = [
    ['antecipacao', .100], ['arremesso', .367], ['desaceleracao', .600],
    ['quique1', .683], ['quique2', .733], ['assentar', .800],
    ['congelar', .850], ['revelacao', 1.020]
  ];
  const FIM = FASES[FASES.length - 1][1];
  /* As esperas entre trocas de face, em quadros: rápido no começo, e a
     última espera longa é onde o olho já lê o resultado. */
  const CADENCIA = [2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 8, 9];
  const outBack = (u, s = 1.9) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
  const outQuad = u => 1 - (1 - u) * (1 - u);

  class Dado {
    constructor({tremor = null, som = null} = {}) {
      this.rolagem = null; this.t = 0; this.rodando = false;
      this.tremor = tremor; this.som = som; this.pulado = false;
      this.particulas = []; this.rapido = false; this.ultimaEm = -1e9;
      this.faces = [];
    }
    /* Recebe o objeto pronto de `ficha.rolar()`. */
    jogar(rolagem, agora = 0) {
      this.rolagem = rolagem; this.t = 0; this.rodando = true; this.pulado = false;
      this.particulas = []; this.estourou = false;
      // A segunda rolagem seguida corre a 70% do tempo: o jogador já viu.
      this.rapido = agora - this.ultimaEm < 6;
      this.ultimaEm = agora;
      // A sequência de faces mostradas termina exatamente no resultado.
      const n = CADENCIA.length;
      this.faces = [];
      for (let i = 0; i < n - 1; i++) {
        let v;
        do { v = 1 + Math.floor(Math.random() * 20); } while (v === rolagem.d20 && i > n - 5);
        this.faces.push(v);
      }
      this.faces.push(rolagem.d20);
      this.som?.sfx?.('dado');
      return this;
    }
    get escala() { return this.rapido ? .7 : 1; }
    get duracao() { return FIM * this.escala; }
    /* O clique durante a animação salta para a revelação. O número não muda. */
    pular() {
      if (!this.rodando || this.pulado) return false;
      this.pulado = true;
      this.t = Math.max(this.t, FASES[6][1] * this.escala);
      return true;
    }
    fechar() { this.rodando = false; this.rolagem = null; this.particulas = []; }
    passo(dt) {
      if (!this.rodando) return;
      this.t += dt;
      for (const p of this.particulas) { p.x += p.vx; p.y += p.vy; p.vy += .15; p.vida--; }
      this.particulas = this.particulas.filter(p => p.vida > 0);
      if (!this.estourou && this.t >= FASES[6][1] * this.escala) {
        this.estourou = true;
        const r = this.rolagem;
        this.tremor?.bater(r.desastre ? .55 : r.critico ? .4 : r.sucesso ? .12 : .28);
        this.som?.sfx?.(r.sucesso ? 'pista' : 'alerta');
        // Sucesso é seco e silencioso; falha é suja e barulhenta.
        const quantas = r.desastre ? 14 : r.critico ? 12 : r.sucesso ? 6 : 10;
        for (let i = 0; i < quantas; i++) this.particulas.push({
          x: 0, y: 0, vx: (Math.random() * 2 - 1) * 3, vy: -Math.random() * 3 - .5,
          vida: 12 + Math.floor(Math.random() * 9), rampa: r.sucesso ? 'papel' : 'vermelho'
        });
      }
      if (this.t >= this.duracao + 2.6) this.fechar();
    }
    fase() {
      const t = this.t / this.escala;
      for (const [nome, fim] of FASES) if (t < fim) return nome;
      return 'pronto';
    }
    /* Qual face está à mostra agora e o quanto o dado está no alto. */
    estado() {
      const t = this.t / this.escala, r = this.rolagem;
      if (!r) return null;
      let face = r.d20, altura = 0, squash = 1, rodando = false;
      if (t < FASES[0][1]) {                                   // antecipação: recua e achata
        const u = t / FASES[0][1];
        squash = 1 - .15 * Math.sin(u * Math.PI);
        altura = -2 * Math.sin(u * Math.PI);
        face = this.faces[0];
        rodando = true;
      } else if (t < FASES[2][1]) {                            // arremesso e desaceleração
        rodando = true;
        const u = (t - FASES[0][1]) / (FASES[2][1] - FASES[0][1]);
        // A face vem da cadência, em quadros de 1/60 s.
        const quadros = (t - FASES[0][1]) * 60;
        let soma = 0, i = 0;
        while (i < CADENCIA.length - 1 && soma + CADENCIA[i] <= quadros) { soma += CADENCIA[i]; i++; }
        face = this.faces[Math.min(i, this.faces.length - 1)];
        altura = Math.sin(u * Math.PI) * 26 * (1 - u * .35);   // o arco do arremesso
        squash = 1 + .1 * Math.sin(u * Math.PI * 2);
      } else if (t < FASES[3][1]) {                            // primeiro quique
        const u = (t - FASES[2][1]) / (FASES[3][1] - FASES[2][1]);
        altura = Math.sin(u * Math.PI) * 10;
        squash = u < .18 || u > .82 ? 1.15 : 1;
      } else if (t < FASES[4][1]) {                            // segundo quique
        const u = (t - FASES[3][1]) / (FASES[4][1] - FASES[3][1]);
        altura = Math.sin(u * Math.PI) * 4;
        squash = u > .8 ? 1.1 : 1;
      } else if (t < FASES[5][1]) {                            // assentar
        const u = (t - FASES[4][1]) / (FASES[5][1] - FASES[4][1]);
        squash = 1 + (1 - outQuad(u)) * .12;
      }
      const pose = rodando ? Math.floor(t * 34) % A.POSES.length : 0;
      const congelado = t >= FASES[5][1] && t < FASES[6][1];
      const rev = t < FASES[6][1] ? 0 : Math.min(1, (t - FASES[6][1]) / (FASES[7][1] - FASES[6][1]));
      return {face, altura, squash, pose, congelado, rev, rodando, t};
    }
    /* Desenha o dado inteiro centrado em (x, y), em pixels de tela. */
    desenhar(ctx, x, y, {escala = 2, compacto = false} = {}) {
      const e = this.estado();
      if (!e) return;
      const r = this.rolagem;
      const R = r.desastre ? 'sns' : r.critico ? 'mqn' : 'csm';
      const S = escala;
      const alto = Math.round(e.altura) * S;
      // A sombra: encolhe quando sobe. Sem ela, o quique não lê.
      const som = A.sombraDado(Math.min(1, e.altura / 26));
      ctx.drawImage(som, Math.round(x - 16 * S), Math.round(y + 15 * S), 32 * S, 10 * S);
      // O dado, com achatamento em pixels inteiros.
      const face = A.dadoFace(e.pose, R);
      const w = Math.round(28 * e.squash / 2) * 2 * S, h = Math.round(28 / e.squash / 2) * 2 * S;
      ctx.drawImage(face, Math.round(x - w / 2), Math.round(y - h / 2 - alto), w, h);
      // O número na face do meio.
      const txt = String(e.face);
      K.drawText(ctx, txt, Math.round(x), Math.round(y - alto - 5 * S), {color: '#000008', align: 'center', scale: S});
      if (e.congelado) {                                       // o clarão do congelamento
        ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = '#fffaee';
        ctx.fillRect(Math.round(x - 20 * S), Math.round(y - 20 * S), 40 * S, 40 * S);
        ctx.restore();
      }
      for (const p of this.particulas) {                       // as partículas do resultado
        ctx.fillStyle = p.rampa === 'papel' ? (p.vida > 10 ? '#c2d8fb' : '#6b97eb') : (p.vida > 10 ? '#ff9a9a' : '#b30000');
        ctx.fillRect(Math.round(x + p.x * S), Math.round(y + p.y * S), S, S);
      }
      if (e.rev > 0) {
        if (compacto) {
          const cor = r.desastre ? '#ff4b4b' : r.critico ? '#f0bb2a' : r.sucesso ? '#4bff6b' : '#c2d8fb';
          K.drawText(ctx, r.rotulo, Math.round(x + 19 * S), Math.round(y - 8 * S), {color:cor,font:'3x5',shadow:{color:'#05030a',dx:1,dy:1}});
          K.drawText(ctx, `${r.d20} / CD ${r.cd}`, Math.round(x + 19 * S), Math.round(y), {color:'#f3d9be',font:'3x5',shadow:{color:'#05030a',dx:1,dy:1}});
        } else this.desenharResultado(ctx, x, y + 24 * S, e.rev, S);
      }
    }
    /* O veredito: cresce passando do tamanho e volta (easeOutBack). */
    desenharResultado(ctx, x, y, u, S) {
      const r = this.rolagem, k = outBack(u);
      const cor = r.desastre ? '#ff4b4b' : r.critico ? '#f0bb2a' : r.sucesso ? '#4bff6b' : '#c2d8fb';
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      K.drawText(ctx, r.rotulo, 0, 0, {color: cor, align: 'center', scale: S, shadow: {color: '#05030a', dx: 1, dy: 1}});
      ctx.restore();
      const linha = `${r.d20} contra ${r.cd}` + (r.valor ? `  ·  ${r.nome} ${r.valor}` : '');
      ctx.globalAlpha = Math.min(1, u * 2);
      K.drawText(ctx, linha, Math.round(x), Math.round(y + 13 * S), {color: '#b2a0b4', align: 'center', scale: 1});
      ctx.globalAlpha = 1;
    }
  }

  const api = {Dado, FASES, CADENCIA, FIM};
  root.FichaDado = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
