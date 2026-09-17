/* Módulos de estrutura — portas, passagens, janelas, luzes e o que se prende
   na parede. Medidas do kit: porta de 30 × 48 (folha 24 × 45), parede de 62
   linhas, luz de cima à direita. Ver montador.js. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K;
  const P = G.pincel;
  const ALEM = [['escuro', 'Escuro'], ['quente', 'Luz quente'], ['frio', 'Luz fria']];
  /* O texto que cabe numa largura: inteiro, senão as primeiras palavras,
     senão a primeira palavra abreviada com ponto; nunca uma palavra cortada. */
  const cabeTexto = (texto, largura, font = '3x5', abreviar = true) => {
    const s = String(texto || '').toUpperCase().trim().replace(/\s+/g, ' ');
    if (!s || K.measure(s, font) <= largura) return s;
    const palavras = s.split(' ');
    let acc = '';
    for (const pal of palavras) { const next = acc ? `${acc} ${pal}` : pal; if (K.measure(next, font) > largura) break; acc = next; }
    if (acc || !abreviar) return acc;
    let a = palavras[0];
    while (a.length > 2 && K.measure(`${a}.`, font) > largura) a = a.slice(0, -1);
    return a.length > 3 && K.measure(`${a}.`, font) <= largura ? `${a}.` : '';
  };
  const PLACA = (b, cx, y, texto, ramp = 'latao', tinta = 'madeira_escura', largura = 44) => {
    const t = cabeTexto(texto, largura - 4);
    if (!t) return;
    const w = K.measure(t, '3x5') + 4, x = Math.round(cx - w / 2);
    b.bevel(x, y, w, 9, ramp, 3, 5, 1);
    b.text(x + 2, y + 2, t, tinta, 1, {font: '3x5'});
  };
  /* Placa de porta: na folha quando o texto cabe nela; senão, na parede,
     logo acima do batente (como nas portas de serviço e de hospital). */
  const PLACA_PORTA = (b, o, texto, {x, y, cabe, ramp = 'latao', tinta = 'madeira_escura'}) => {
    const t = String(texto || '').toUpperCase().trim();
    if (!t) return;
    if (cabe > 0 && K.measure(t, '3x5') + 4 <= cabe) return PLACA(b, x, y, t, ramp, tinta, cabe);
    const acima = o.v - 11;
    PLACA(b, o.u + o.w / 2, acima >= 0 ? acima : y, t, ramp, tinta, Math.max(52, o.w + 20));
  };

  /* ------------------------------------------------------------ vãos abertos */
  /* O que se vê atrás de uma porta aberta: escuro com um pouco de chão e,
     se houver luz do outro lado, um retângulo iluminado no fundo. */
  function vaoEscuro(b, x, y, w, h, alem = 'escuro', seed = 1) {
    const bottom = y + h - 1;
    for (let yy = y; yy <= bottom; yy++) for (let xx = x; xx < x + w; xx++) {
      const t = (yy - y) / h, edge = Math.min(xx - x, x + w - 1 - xx) / (w / 2);
      let lv = t > .78 ? 1 : 0;
      if (edge > .5 && t > .15 && bayer(xx, yy) < .22) lv += 1;
      b.px(xx, yy, 'carvao', lv);
    }
    if (alem !== 'escuro') {
      const ramp = alem === 'quente' ? 'luz_quente' : 'luz_fria';
      const fx = x + Math.round(w * .3), fw = Math.max(3, Math.round(w * .4)), fy = y + Math.round(h * .28), fh = Math.round(h * .5);
      b.rect(fx, fy, fw, fh, ramp, 2, EMISSIVE);
      b.dither(fx, fy, fw, fh, ramp, 3, .35, EMISSIVE);
      // Luz que escorre pelo chão até a soleira.
      for (let yy = fy + fh; yy <= bottom; yy++) {
        const spread = Math.round((yy - fy - fh) / Math.max(1, bottom - fy - fh) * (w * .35));
        for (let xx = fx - spread; xx < fx + fw + spread; xx++) if (xx >= x && xx < x + w && bayer(xx, yy) < .5) b.px(xx, yy, ramp, 1, EMISSIVE);
      }
    }
  }
  /* Um corredor visto pelo vão: paredes convergindo, chão, luz no fundo. */
  function corredorVisto(b, x, y, w, h, {parede = 'branco', piso = 'ceramica', alem = 'frio', seed = 1} = {}) {
    const fx0 = x + w * .32, fx1 = x + w * .68, fy0 = y + h * .22, fy1 = y + h * .62;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const cx = xx + .5, cy = yy + .5;
      let ramp, lv;
      if (cx >= fx0 && cx <= fx1 && cy >= fy0 && cy <= fy1) {      // parede do fundo
        ramp = parede; lv = 2 + (alem !== 'escuro' ? 1 : 0);
        if (alem !== 'escuro' && Math.abs(cx - (fx0 + fx1) / 2) < 2 && cy < fy0 + 3) { ramp = alem === 'quente' ? 'luz_quente' : 'luz_fria'; lv = 5; }
      } else {
        const tx = cx < fx0 ? (fx0 - cx) / (fx0 - x) : cx > fx1 ? (cx - fx1) / (x + w - fx1) : 0;
        const ty = cy < fy0 ? (fy0 - cy) / (fy0 - y) : cy > fy1 ? (cy - fy1) / (y + h - fy1) : 0;
        if (ty >= tx && cy > fy1) { ramp = piso; lv = 1 + Math.floor((1 - ty) * 2 + bayer(xx, yy) * .8); if (Math.floor((cy - fy1) * (1 + ty * 3)) % 5 === 0) lv -= 1; }
        else if (ty >= tx) { ramp = 'carvao'; lv = 1; }
        else { ramp = parede; lv = Math.max(0, 1 + Math.floor((1 - tx) * 1.5 + bayer(xx, yy) * .6)); }
      }
      b.px(xx, yy, ramp, Math.max(0, lv));
    }
  }

  /* ------------------------------------------------------------ porta */
  const PORTAS = [['madeira', 'Madeira'], ['apartamento', 'Apartamento'], ['metal', 'Metal (serviço)'], ['vidro', 'Vidro'], ['vaivem', 'Vaivém (hospital)'], ['banheiro', 'Banheiro'], ['enrolar', 'Porta de enrolar'], ['grade', 'Portão de grade']];
  const larguraPorta = p => ({vaivem: 38, enrolar: 50, grade: 34, vidro: 32}[p.modelo] || 30);
  M.modulo({
    id: 'porta', nome: 'Porta', grupo: 'Portas e passagens', camada: 'parede',
    w: larguraPorta, h: 48,
    params: [
      {id: 'modelo', label: 'Modelo', opcoes: PORTAS, padrao: 'madeira'},
      {id: 'cor', label: 'Cor da folha', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'placa', label: 'Placa / número', tipo: 'texto', padrao: ''},
      {id: 'alem', label: 'Do outro lado', opcoes: ALEM, padrao: 'escuro'},
      {id: 'aberta', label: 'Aberta', tipo: 'estado', padrao: false}
    ],
    passagem: {tipo: 'porta'},
    area: o => ({u: 1, v: 1, w: o.w - 2, h: o.h - 1}),
    pinta(b, o, c) {
      const {u, v, w} = o, p = o.p, modelo = p.modelo, seed = o.seed;
      const aberta = c.estado(o, 'aberta'), bottom = 61;
      const frame = modelo === 'metal' || modelo === 'enrolar' || modelo === 'grade' ? 'aco' : modelo === 'vidro' || modelo === 'vaivem' ? 'aluminio' : p.cor === 'mdf' ? 'mdf' : 'madeira_clara';
      const L = u + 3, T = v + 3, LW = w - 6, LH = bottom - T + 1;
      // Batente.
      b.bevel(u, v, w, 3, frame, 3, 5, 1);
      b.rect(u, T, 3, LH, frame, 3); b.vline(u, T, bottom, frame, 4); b.vline(u + 2, T, bottom, frame, 1);
      b.rect(u + w - 3, T, 3, LH, frame, 3); b.vline(u + w - 1, T, bottom, frame, 5); b.vline(u + w - 3, T, bottom, frame, 2);
      if (modelo === 'enrolar') {
        if (aberta) {
          vaoEscuro(b, L, T + 6, LW, LH - 6, p.alem, seed);
          b.rect(L - 1, T - 1, LW + 2, 7, 'aco', 2);
          for (let i = 0; i < 7; i += 2) b.hline(L - 1, L + LW, T - 1 + i, 'aco', 4);
        } else {
          b.rect(L, T, LW, LH, p.cor.startsWith('madeira') ? 'aco' : p.cor, 3);
          for (let yy = T; yy <= bottom; yy += 2) { b.hline(L, L + LW - 1, yy, p.cor.startsWith('madeira') ? 'aco' : p.cor, 2); b.hline(L, L + LW - 1, yy + 1, p.cor.startsWith('madeira') ? 'aco' : p.cor, 4); }
          b.rect(L + LW / 2 - 4, bottom - 3, 8, 2, 'cromado', 4); b.px(L + LW / 2 + 3, bottom - 3, 'cromado', 6);
          if (c.desgaste >= 2) for (let i = 0; i < 6; i++) b.px(L + Math.floor(hash2(i, 1, seed) * LW), T + Math.floor(hash2(i, 2, seed) * LH), 'ferrugem', 3);
        }
        PLACA_PORTA(b, o, p.placa, {x: u + w / 2, y: v + 4, cabe: 0, ramp: 'amarelo_vivo', tinta: 'carvao'});
        return;
      }
      if (aberta && modelo !== 'grade') {
        vaoEscuro(b, L, T, LW, LH, p.alem, seed);
        if (modelo === 'vaivem') { b.rect(L, T, 3, LH, 'aluminio', 3); b.rect(L + LW - 3, T, 3, LH, 'aluminio', 3); }
        else { b.rect(L, T, 4, LH, p.cor, 2); b.vline(L + 3, T, bottom, p.cor, 4); b.vline(L, T, bottom, p.cor, 1); b.px(L + 2, T + 24, 'latao', 5); }
        return;
      }
      switch (modelo) {
        case 'apartamento': {
          P.veios(b, L, T, LW, LH, p.cor, 3, seed, {vertical: true});
          b.vline(L, T, bottom, p.cor, 2); b.vline(L + LW - 1, T, bottom, p.cor, 4);
          b.inset(L + 3, T + 16, LW - 6, 26, p.cor, 3, 4, 2);
          const numero = String(p.placa || '101').slice(0, 4);
          const nw = K.measure(numero, '3x5') + 4;
          b.bevel(L + Math.round((LW - nw) / 2), T + 4, nw, 9, 'latao', 3, 5, 1);
          b.text(L + Math.round((LW - nw) / 2) + 2, T + 6, numero, 'madeira_escura', 1, {font: '3x5'});
          b.px(L + LW / 2, T + 14, 'cromado', 5); b.px(L + LW / 2, T + 15, 'carvao', 1);
          b.rect(L + LW - 5, T + 21, 2, 5, 'cromado', 3); b.px(L + LW - 4, T + 23, 'cromado', 6); b.px(L + LW - 5, T + 27, 'carvao', 1);
          break;
        }
        case 'metal': {
          const cor = p.cor.startsWith('madeira') ? 'ferro_verde' : p.cor;
          P.chapa(b, L, T, LW, LH, cor, 3, {rebites: false});
          b.inset(L + 6, T + 5, LW - 12, 10, 'aco', 2, 4, 1);
          G.pincel.vidro(b, L + 7, T + 6, LW - 14, 8, {rampa: 'vidro', nivel: 1});
          for (let i = 0; i < LW - 14; i += 3) for (let j = 0; j < 8; j++) if ((i + j) % 3 === 0) b.px(L + 7 + i + (j % 2), T + 6 + j, 'aco', 3);
          b.rect(L + 2, T + 22, LW - 4, 3, 'cromado', 3); b.hline(L + 2, L + LW - 3, T + 22, 'cromado', 5);
          b.rect(L + 3, T + 21, 2, 5, 'aco', 2); b.rect(L + LW - 5, T + 21, 2, 5, 'aco', 2);
          b.rect(L + 1, bottom - 6, LW - 2, 6, 'aco', 3); b.hline(L + 1, L + LW - 2, bottom - 6, 'aco', 5);
          PLACA_PORTA(b, o, p.placa, {x: L + LW / 2, y: T + 30, cabe: 0, ramp: 'amarelo_vivo', tinta: 'carvao'});
          if (c.desgaste >= 2) for (let i = 0; i < 14; i++) b.px(L + Math.floor(hash2(i, 1, seed) * LW), T + 30 + Math.floor(hash2(i, 2, seed) * 14), 'ferrugem', 2 + (i % 2));
          break;
        }
        case 'vidro': {
          b.rect(L, T, LW, LH, 'aluminio', 3);
          const gx = L + 2, gy = T + 2, gw = LW - 4, gh = LH - 9;
          const dentro = p.alem !== 'escuro';
          b.rect(gx, gy, gw, gh, 'vidro', 1);
          if (dentro) {
            const ramp = p.alem === 'quente' ? 'luz_quente' : 'luz_fria';
            b.dither(gx, gy + gh * .55, gw, gh * .45, ramp, 2, .5, EMISSIVE);
            for (let i = 0; i < 3; i++) b.rect(gx + 2 + i * Math.floor(gw / 3), gy + 6, 3, 10 + (i % 2) * 4, 'carvao', 2);
            b.hline(gx, gx + gw - 1, gy + 2, ramp, 4, EMISSIVE);
          }
          for (let i = 0; i < gw + gh; i += 9) for (let t = 0; t < 2; t++) for (let s = 0; s < gh; s++) { const xx = gx + i - t - s, yy = gy + s; if (xx >= gx && xx < gx + gw) b.px(xx, yy, 'vidro', 3 + t); }
          b.rect(L + 1, T + 22, LW - 2, 2, 'cromado', 5);
          b.rect(L, bottom - 6, LW, 7, 'aluminio', 3); b.hline(L, L + LW - 1, bottom - 6, 'aluminio', 5);
          if (p.placa) {
            const t = String(p.placa).toUpperCase().trim();
            if (K.measure(t, '3x5') <= gw + 2) b.text(L + LW / 2, T + 12, t, dentro ? 'branco' : 'amarelo_vivo', 5, {font: '3x5', align: 'center'});
            else PLACA_PORTA(b, o, t, {x: 0, y: T + 12, cabe: 0, ramp: 'branco', tinta: 'carvao'});
          }
          break;
        }
        case 'vaivem': {
          const half = Math.floor(LW / 2);
          for (const [lx, lw] of [[L, half], [L + half, LW - half]]) {
            b.bevel(lx, T, lw, LH, p.cor.startsWith('madeira') ? 'verde' : p.cor, 4, 5, 2);
            const cx = lx + lw / 2, cy = T + 11;
            b.ellipse(cx, cy, 4.5, 4.5, 'aluminio', 5); b.ellipse(cx, cy, 3.4, 3.4, 'vidro', 1);
            if (p.alem !== 'escuro') b.px(cx, cy - 1, p.alem === 'quente' ? 'luz_quente' : 'luz_fria', 5, EMISSIVE);
            b.px(cx + 1, cy - 2, 'vidro', 4);
            b.rect(lx + 1, bottom - 9, lw - 2, 9, 'aluminio', 3); b.hline(lx + 1, lx + lw - 2, bottom - 9, 'aluminio', 5);
            b.rect(lx + 2, T + 21, lw - 4, 5, 'aluminio', 4);
          }
          b.vline(L + half, T, bottom, 'carvao', 1);
          PLACA_PORTA(b, o, p.placa, {x: u + w / 2, y: T + 30, cabe: 0, ramp: 'branco', tinta: 'azul_vivo'});
          break;
        }
        case 'banheiro': {
          const cor = p.cor === 'madeira' ? 'mdf' : p.cor;
          b.bevel(L, T, LW, LH, cor, 4, 5, 2);
          b.bevel(L + LW / 2 - 5, T + 6, 10, 10, 'azul_vivo', 3, 4, 2);
          b.px(L + LW / 2 - 3, T + 8, 'branco', 6); b.rect(L + LW / 2 - 4, T + 10, 3, 4, 'branco', 6);
          b.px(L + LW / 2 + 2, T + 8, 'branco', 6); b.poly([[L + LW / 2 + .5, T + 10], [L + LW / 2 + 4.5, T + 10], [L + LW / 2 + 4.5, T + 14], [L + LW / 2 + .5, T + 14]], 'branco', 6);
          for (let yy = bottom - 10; yy < bottom - 2; yy += 2) { b.hline(L + 3, L + LW - 4, yy, cor, 2); b.hline(L + 3, L + LW - 4, yy + 1, cor, 5); }
          b.rect(L + LW - 5, T + 22, 3, 2, 'cromado', 5);
          PLACA_PORTA(b, o, p.placa, {x: L + LW / 2, y: T + 28, cabe: LW - 2, ramp: 'branco', tinta: 'azul_vivo'});
          break;
        }
        case 'grade': {
          vaoEscuro(b, L, T, LW, LH, p.alem, seed);
          const cor = p.cor.startsWith('madeira') ? 'ferro_verde' : p.cor;
          for (let xx = L; xx < L + LW; xx += 4) { b.vline(xx, T, bottom, cor, 3); b.vline(xx + 1, T, bottom, cor, 1); }
          b.rect(L, T + 2, LW, 2, cor, 4); b.rect(L, bottom - 4, LW, 2, cor, 4); b.rect(L, T + 24, LW, 2, cor, 4);
          if (!c.estado(o, 'aberta')) { b.rect(L + LW - 8, T + 26, 4, 4, 'latao', 3); b.px(L + LW - 7, T + 25, 'aco', 4); b.px(L + LW - 6, T + 25, 'aco', 4); }
          if (c.desgaste >= 1) for (let i = 0; i < 12; i++) b.px(L + Math.floor(hash2(i, 4, seed) * LW), T + Math.floor(hash2(i, 5, seed) * LH), 'ferrugem', 3);
          break;
        }
        default: {                                                   // madeira
          P.veios(b, L, T, LW, LH, p.cor, 3, seed, {vertical: true});
          b.vline(L, T, bottom, p.cor, 2); b.vline(L + LW - 1, T, bottom, p.cor, 4);
          b.inset(L + 3, T + 3, LW - 6, 18, p.cor, 3, 5, 1); b.inset(L + 6, T + 6, LW - 12, 12, p.cor, 2, 4, 1);
          b.inset(L + 3, T + 25, LW - 6, 17, p.cor, 3, 5, 1); b.inset(L + 6, T + 28, LW - 12, 11, p.cor, 2, 4, 1);
          b.rect(L + LW - 5, T + 21, 2, 2, 'latao', 4); b.px(L + LW - 4, T + 21, 'latao', 6); b.rect(L + LW - 6, T + 20, 1, 4, 'latao', 2);
          PLACA_PORTA(b, o, p.placa, {x: L + LW / 2, y: T + 8, cabe: LW - 2});
        }
      }
      if (c.desgaste >= 2 && modelo !== 'grade') { b.shade(L, bottom - 4, LW, 4, -1, .5); for (let i = 0; i < 4; i++) b.shade(L + Math.floor(hash2(i, 9, seed) * LW), T + 30 + i * 3, 3, 1, -1); }
      // Luz passando por baixo da porta fechada.
      if (p.alem !== 'escuro' && modelo !== 'vidro') b.hline(L + 1, L + LW - 2, bottom, p.alem === 'quente' ? 'luz_quente' : 'luz_fria', 3, EMISSIVE);
    },
    luzes(o, c) {
      if (o.p.alem === 'escuro' || !c.estado(o, 'aberta') || !c.energia) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 14, h: 40, radius: 110, strength: 1.3, tint: o.p.alem === 'quente' ? 'lamp' : 'fluor', layers: ['floor', 'wall']}];
    }
  });

  /* ------------------------------------------------------------ vão de corredor */
  M.modulo({
    id: 'arco', nome: 'Vão de corredor', grupo: 'Portas e passagens', camada: 'parede', w: 36, h: 49,
    params: [{id: 'parede', label: 'Parede do corredor', tipo: 'cor', opcoes: 'parede', padrao: 'branco'}, {id: 'alem', label: 'Luz no fundo', opcoes: ALEM, padrao: 'frio'}, {id: 'placa', label: 'Placa', tipo: 'texto', padrao: ''}],
    passagem: {tipo: 'corredor'},
    pinta(b, o, c) {
      const {u, v, w} = o, p = o.p;
      corredorVisto(b, u + 3, v + 3, w - 6, 62 - v - 3, {parede: p.parede, piso: 'ceramica', alem: p.alem, seed: o.seed});
      b.bevel(u, v, w, 3, c.R.casca.corParede, 4, 5, 2);
      b.rect(u, v + 3, 3, 59 - v, c.R.casca.corParede, 4); b.vline(u + 2, v + 3, 61, c.R.casca.corParede, 2);
      b.rect(u + w - 3, v + 3, 3, 59 - v, c.R.casca.corParede, 4); b.vline(u + w - 1, v + 3, 61, c.R.casca.corParede, 5);
      if (p.placa) PLACA(b, u + w / 2, Math.max(0, v - 10), p.placa, 'branco', 'azul_vivo', Math.max(44, w + 14));
    }
  });

  /* ------------------------------------------------------------ escada */
  M.modulo({
    id: 'escada', nome: 'Escada', grupo: 'Portas e passagens', camada: 'parede', w: 42, h: 50,
    params: [{id: 'sentido', label: 'Sentido', opcoes: [['sobe', 'Sobe'], ['desce', 'Desce']], padrao: 'sobe'}, {id: 'cor', label: 'Degraus', tipo: 'cor', opcoes: 'parede', padrao: 'concreto'},
      {id: 'placa', label: 'Placa', tipo: 'texto', padrao: ''}],
    passagem: {tipo: 'escada'},
    pinta(b, o, c) {
      const {u, v, w} = o, p = o.p, L = u + 3, T = v + 3, LW = w - 6, bottom = 61, LH = bottom - T + 1, cor = p.cor;
      const casca = c.R.casca.corParede;
      b.rect(L, T, LW, LH, 'carvao', 1);
      if (p.sentido === 'desce') {
        // Degraus descendo para a escuridão, vistos por cima.
        for (let i = 0; i < 9; i++) {
          const yy = T + 18 + i * 3, xx = L + 2 + i * 3;
          if (yy > bottom) break;
          const lv = Math.max(0, 4 - Math.floor(i / 2));
          b.rect(xx, yy, LW - 2 - i * 3, 2, cor, lv); b.hline(xx, L + LW - 1, yy, cor, lv + 1);
        }
        b.vgrad(L, T, LW, 16, 'carvao', 0, 2);
        b.line(L + 1, T + 12, L + LW - 3, bottom - 2, 'aco', 4); b.line(L + 1, T + 13, L + LW - 3, bottom - 1, 'aco', 2);
        for (let i = 0; i < 4; i++) b.vline(L + 4 + i * 8, T + 14 + Math.round(i * 8 * (bottom - T - 14) / (LW - 4)) - 6, T + 14 + Math.round(i * 8 * (bottom - T - 14) / (LW - 4)), 'aco', 3);
      } else {
        // Degraus subindo da esquerda para a direita, luz vindo de cima.
        b.vgrad(L, T, LW, LH, 'carvao', 2, 0);
        for (let i = 0; i < 12; i++) {
          const xx = L + i * 3, yy = bottom - 3 - i * 3;
          if (yy < T + 2 || xx >= L + LW) break;
          b.rect(xx, yy, LW - i * 3, 3, cor, 2 + (i > 6 ? 1 : 0)); b.hline(xx, L + LW - 1, yy, cor, 5);
          b.rect(xx, yy + 3, LW - i * 3, bottom - yy - 2, cor, 1);
        }
        b.line(L, bottom - 12, L + LW - 1, T + 2, 'madeira', 4); b.line(L, bottom - 11, L + LW - 1, T + 3, 'madeira', 2);
        for (let i = 1; i < 5; i++) { const xx = L + i * 7, yy = bottom - 3 - Math.floor(i * 7 / 3) * 3; b.vline(xx, yy - 9, yy - 1, 'aco', 3); }
        b.dither(L + LW - 12, T, 12, 8, 'luz_fria', 2, .4, EMISSIVE);
      }
      b.bevel(u, v, w, 3, casca, 4, 5, 2);
      b.rect(u, T, 3, LH, casca, 4); b.vline(u + 2, T, bottom, casca, 2);
      b.rect(u + w - 3, T, 3, LH, casca, 4); b.vline(u + w - 1, T, bottom, casca, 5);
      // Seta pintada.
      const ax = u + w - 9, ay = v + 6, col = 'amarelo_vivo';
      if (p.sentido === 'desce') { for (let i = 0; i < 3; i++) b.hline(ax - i, ax + i, ay + 4 - i + 0, col, 4); b.vline(ax, ay - 1, ay + 1, col, 4); }
      else { for (let i = 0; i < 3; i++) b.hline(ax - i, ax + i, ay + i, col, 4); b.vline(ax, ay + 3, ay + 5, col, 4); }
      if (p.placa) PLACA(b, u + w / 2 - 4, v + 4, p.placa, 'branco', 'azul_vivo', w - 12);
    }
  });

  /* ------------------------------------------------------------ elevador */
  M.modulo({
    id: 'elevador', nome: 'Elevador', grupo: 'Portas e passagens', camada: 'parede', w: 40, h: 50,
    params: [{id: 'andar', label: 'Mostrador', tipo: 'texto', padrao: 'T'}, {id: 'cor', label: 'Portas', opcoes: [['cromado', 'Inox'], ['aco', 'Aço escuro'], ['latao', 'Dourado'], ['ferro_bege', 'Bege']], padrao: 'cromado'},
      {id: 'aberta', label: 'Portas abertas', tipo: 'estado', padrao: false}],
    passagem: {tipo: 'elevador'},
    area: o => ({u: 0, v: 0, w: 32, h: o.h}),
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, W = 32, L = u + 3, T = v + 7, LW = W - 6, bottom = 61, LH = bottom - T + 1;
      b.bevel(u, v, W, 7, 'aco', 3, 5, 1);
      b.rect(u + 9, v + 1, 14, 5, 'carvao', 0);
      const on = c.energia, andar = String(p.andar || 'T').toUpperCase().slice(0, 2);
      b.text(u + 16, v + 1, andar, on ? 'led' : 'carvao', on ? 5 : 2, {font: '3x5', align: 'center', flags: on ? EMISSIVE : 0});
      if (on) { b.px(u + 11, v + 2, 'verde_vivo', 5, EMISSIVE); b.px(u + 10, v + 3, 'verde_vivo', 5, EMISSIVE); b.px(u + 12, v + 3, 'verde_vivo', 5, EMISSIVE); }
      b.rect(u, T, 3, LH, 'aco', 3); b.vline(u, T, bottom, 'aco', 4); b.rect(u + W - 3, T, 3, LH, 'aco', 3); b.vline(u + W - 1, T, bottom, 'aco', 5);
      if (c.estado(o, 'aberta')) {
        b.rect(L, T, LW, LH, 'aluminio', 3, on ? EMISSIVE : 0);
        for (let xx = L; xx < L + LW; xx += 3) b.vline(xx, T, bottom - 6, 'aluminio', 4, on ? EMISSIVE : 0);
        b.rect(L, T, LW, 2, 'luz_fria', on ? 6 : 2, on ? EMISSIVE : 0);
        b.hline(L + 2, L + LW - 3, T + 24, 'cromado', 5, on ? EMISSIVE : 0);
        b.rect(L, bottom - 5, LW, 6, 'borracha', 2);
        b.rect(L, T, 3, LH, p.cor, 3); b.rect(L + LW - 3, T, 3, LH, p.cor, 3);
      } else {
        const half = Math.floor(LW / 2);
        for (const [lx, lw] of [[L, half], [L + half, LW - half]]) {
          b.rect(lx, T, lw, LH, p.cor, 3);
          for (let yy = T; yy < bottom; yy++) if (bayer(lx, yy) < .25) b.hline(lx + 1, lx + lw - 2, yy, p.cor, 4);
          b.vline(lx + lw - 1, T, bottom, p.cor, 5); b.vline(lx, T, bottom, p.cor, 2);
          b.line(lx + 1, T + 4, lx + lw - 2, T + 14, p.cor, 5);
        }
        b.vline(L + half, T, bottom, 'carvao', 0);
      }
      // Botoeira.
      b.bevel(u + W + 2, v + 22, 5, 11, 'aluminio', 4, 5, 2);
      b.px(u + W + 4, v + 25, on ? 'led' : 'aco', on ? 5 : 3, on ? EMISSIVE : 0); b.px(u + W + 4, v + 29, 'aco', 3);
      P.contato(b, u, W);
    },
    anima(g, o, t, c) {
      if (!c.energia || c.estado(o, 'aberta')) return;
      if (Math.sin(t * 1.3 + o.seed) > .92) g.px(o.u + 34, o.v + 29, g.color('led', 5, 'day'));
    }
  });

  /* ------------------------------------------------------------ saídas laterais */
  for (const [side, nome, x] of [['left', 'Saída à esquerda', 'esq'], ['right', 'Saída à direita', 'dir']]) {
    M.modulo({
      id: 'saida_' + x, nome, grupo: 'Portas e passagens', camada: 'chao', lateral: side, fixo: true,
      w: 70, profundidade: () => [470, 640], params: [],
      passagem: {tipo: 'lateral'},
      pintaChao(X, d, out) { /* o vão é pintado na parede lateral */ }
    });
  }

  /* ------------------------------------------------------------ janelas */
  const JANELAS = [['residencial', 'Residencial'], ['basculante', 'Basculante (banheiro)'], ['comercial', 'Comercial larga'], ['grade', 'Com grade'], ['quebrada', 'Quebrada, com tábuas'], ['persiana', 'Com persiana']];
  const dimsJanela = p => ({basculante: [22, 10, 7], comercial: [66, 30, 10], quebrada: [38, 30, 11], persiana: [38, 30, 10]}[p.modelo] || [38, 30, 10]);
  M.modulo({
    id: 'janela', nome: 'Janela', grupo: 'Janelas', camada: 'parede',
    w: p => dimsJanela(p)[0], h: p => dimsJanela(p)[1] + (p.modelo === 'basculante' ? 0 : 3), v: p => dimsJanela(p)[2], livreV: true, semSombra: true,
    params: [
      {id: 'modelo', label: 'Modelo', opcoes: JANELAS, padrao: 'residencial'},
      {id: 'moldura', label: 'Moldura', opcoes: [['branco', 'Branca'], ['madeira', 'Madeira'], ['aluminio', 'Alumínio'], ['ferro_verde', 'Ferro verde']], padrao: 'branco'},
      {id: 'cortina', label: 'Cortina', opcoes: [['nenhuma', 'Nenhuma'], ['aberta', 'Aberta'], ['fechada', 'Fechada']], padrao: 'aberta'},
      {id: 'corCortina', label: 'Cor da cortina', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_mostarda'}
    ],
    vidro(o) {
      const [w, h] = dimsJanela(o.p);
      if (o.p.cortina === 'fechada' || o.p.modelo === 'basculante') return null;
      return {u: o.u + 3, v: o.v + 3, w: w - 6, h: h - 6, cols: o.p.modelo === 'comercial' ? 3 : 2, rows: o.p.modelo === 'persiana' ? 8 : 2, bar: o.p.modelo === 'persiana' ? 6 : 4};
    },
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, [w, h] = dimsJanela(p), fr = p.moldura, seed = o.seed;
      const gx = u + 3, gy = v + 3, gw = w - 6, gh = h - 6;
      if (p.modelo === 'basculante') {
        b.bevel(u, v, w, h, fr, 3, 5, 1);
        b.rect(gx - 1, gy - 1, gw + 2, gh + 2, 'vidro', 3);
        for (let yy = gy - 1; yy < gy + gh + 1; yy++) for (let xx = gx - 1; xx < gx + gw + 1; xx++) if (hash2(xx, yy, 7) > .6) b.px(xx, yy, 'vidro', 4);
        b.hline(gx - 1, gx + gw, gy + Math.floor(gh / 2), fr, 2);
        return;
      }
      b.bevel(u, v, w, h, fr, 3, 5, 1);
      b.erase(gx, gy, gw, gh);
      if (p.modelo === 'persiana') {
        for (let yy = gy; yy < gy + gh; yy += 3) { b.hline(gx, gx + gw - 1, yy, 'aluminio', 4); b.hline(gx, gx + gw - 1, yy + 1, 'aluminio', 3); }
        b.vline(gx + 4, gy, gy + gh - 1, 'branco', 4); b.vline(gx + gw - 5, gy, gy + gh - 1, 'branco', 4);
      } else if (p.modelo === 'quebrada') {
        const random = K.rng(seed);
        for (let i = 0; i < 5; i++) {
          const ax = gx + Math.floor(random() * gw), ay = random() < .5 ? gy : gy + gh - 1;
          b.poly([[ax, ay], [ax + 3 + random() * 5, ay], [ax + 1, ay + (ay === gy ? 1 : -1) * (4 + random() * 8)]], 'vidro', 3);
        }
        for (let i = 0; i < 3; i++) {
          const yy = gy + 4 + i * 8 + Math.floor(random() * 3), tilt = Math.round((random() - .5) * 4);
          for (let t = 0; t < 4; t++) b.line(u - 2, yy + t, u + w + 1, yy + t + tilt, 'madeira', t === 0 ? 5 : t === 3 ? 2 : 3);
          b.px(u + 1, yy + 1, 'aco', 5); b.px(u + w - 2, yy + 1 + tilt, 'aco', 5);
        }
      } else {
        const cols = p.modelo === 'comercial' ? 3 : 2;
        for (let i = 1; i < cols; i++) b.rect(gx + Math.round(gw * i / cols) - 1, gy, 2, gh, fr, 3);
        b.rect(gx, gy + Math.round(gh / 2) - 1, gw, 2, fr, 3);
        if (p.modelo === 'grade') for (let xx = gx + 2; xx < gx + gw; xx += 4) { b.vline(xx, gy, gy + gh - 1, 'ferro_verde', 2); }
      }
      // Peitoril.
      b.bevel(u - 2, v + h - 3, w + 4, 3, fr === 'aluminio' ? 'concreto' : fr, 4, 6, 2);
      b.shade(u - 2, v + h, w + 4, 1, -1, .6);
      if (p.cortina !== 'nenhuma' && p.modelo !== 'quebrada') {
        const cor = p.corCortina;
        b.rect(u - 3, v - 2, w + 6, 2, 'madeira_escura', 3); b.hline(u - 3, u + w + 2, v - 2, 'madeira_escura', 5);
        if (p.cortina === 'fechada') {
          for (let xx = u - 1; xx < u + w + 1; xx++) {
            const fold = (xx - u) % 5, lv = fold === 0 ? 2 : fold === 3 ? 5 : 4;
            b.vline(xx, v, v + h - 1, cor, lv);
          }
          b.dither(u - 1, v + h - 4, w + 2, 3, cor, 3, .5);
        } else {
          for (const side of [0, 1]) for (let i = 0; i < 7; i++) {
            const xx = side ? u + w - 5 + i : u - 2 + i, sway = Math.round(Math.sin(i * 1.3) * .6);
            const lv = i % 3 === 0 ? 2 : i % 3 === 1 ? 4 : 5;
            b.vline(xx + sway, v, v + h + 4, cor, side ? lv : lv - 1);
          }
          b.hline(u - 2, u + 4, v + h - 8, cor, 2); b.hline(u + w - 5, u + w + 1, v + h - 8, cor, 2);
        }
      }
    }
  });

  /* ------------------------------------------------------------ luminárias */
  const LUMINARIAS = {
    pendente: {w: 11, h: 13, v: 0, tint: 'lamp', radius: 230, strength: 2.3},
    fluorescente: {w: 26, h: 4, v: 1, tint: 'fluor', radius: 270, strength: 2.3},
    plafon: {w: 14, h: 4, v: 0, tint: 'lamp', radius: 250, strength: 2.2},
    arandela: {w: 7, h: 8, v: 19, tint: 'lamp', radius: 140, strength: 1.9},
    lampada: {w: 5, h: 11, v: 0, tint: 'lamp', radius: 190, strength: 1.9},
    industrial: {w: 15, h: 9, v: 0, tint: 'fluor', radius: 300, strength: 2.6}
  };
  M.modulo({
    id: 'luminaria', nome: 'Luminária', grupo: 'Luzes', camada: 'parede', semSombra: true, livreV: false,
    w: p => LUMINARIAS[p.modelo]?.w || 11, h: p => LUMINARIAS[p.modelo]?.h || 13, v: p => LUMINARIAS[p.modelo]?.v ?? 0,
    params: [{id: 'modelo', label: 'Modelo', opcoes: [['pendente', 'Pendente'], ['fluorescente', 'Fluorescente'], ['plafon', 'Plafon'], ['arandela', 'Arandela'], ['lampada', 'Lâmpada nua'], ['industrial', 'Industrial']], padrao: 'pendente'},
      {id: 'defeito', label: 'Piscando (com defeito)', tipo: 'bool', padrao: false},
      {id: 'acesa', label: 'Acesa', tipo: 'estado', padrao: true}],
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, on = c.lampada(o, 'acesa') > 0, F = on ? EMISSIVE : 0;
      switch (p.modelo) {
        case 'fluorescente':
          b.rect(u, v, 26, 3, 'branco', 3); b.hline(u, u + 25, v, 'branco', 5);
          b.rect(u + 2, v + 3, 22, 1, on ? 'luz_fria' : 'branco', on ? 6 : 2, F);
          if (on) b.hline(u + 4, u + 21, v + 2, 'luz_fria', 7, EMISSIVE);
          break;
        case 'plafon':
          b.ellipse(u + 7, v, 7, 3.5, on ? 'luz_quente' : 'branco', on ? 5 : 3, F);
          b.hline(u + 2, u + 11, v + 2, on ? 'luz_quente' : 'branco', on ? 6 : 4, F);
          break;
        case 'arandela':
          b.rect(u + 2, v + 5, 3, 3, 'latao', 3);
          b.poly([[u, v], [u + 7, v], [u + 5.5, v + 5], [u + 1.5, v + 5]], on ? 'luz_quente' : 'papel', on ? 5 : 3, F);
          if (on) b.hline(u + 1, u + 5, v + 1, 'luz_quente', 7, EMISSIVE);
          break;
        case 'lampada':
          b.vline(u + 2, v, v + 6, 'plastico_preto', 2);
          b.rect(u + 1, v + 6, 3, 2, 'latao', 3);
          b.ellipse(u + 2.5, v + 9, 2, 2, on ? 'luz_quente' : 'vidro', on ? 6 : 3, F);
          break;
        case 'industrial':
          b.vline(u + 7, v, v + 3, 'aco', 2);
          b.poly([[u + 4, v + 3], [u + 11, v + 3], [u + 15, v + 8], [u, v + 8]], 'ferro_verde', 3);
          b.hline(u + 4, u + 10, v + 3, 'ferro_verde', 5);
          b.hline(u + 2, u + 12, v + 8, on ? 'luz_fria' : 'aco', on ? 6 : 2, F);
          break;
        default:                                                        // pendente
          b.vline(u + 5, v, v + 5, 'plastico_preto', 2);
          b.poly([[u + 3, v + 5], [u + 8, v + 5], [u + 11, v + 11], [u, v + 11]], 'vermelho', 3);
          b.hline(u + 3, u + 7, v + 5, 'vermelho', 5); b.line(u + 8, v + 5, u + 10, v + 10, 'vermelho', 5);
          b.hline(u + 1, u + 10, v + 11, 'vermelho', 2);
          b.rect(u + 3, v + 12, 5, 1, on ? 'luz_quente' : 'vidro', on ? 7 : 3, F);
      }
    },
    luzes(o, c) {
      const k = c.lampada(o, 'acesa'), L = LUMINARIAS[o.p.modelo] || LUMINARIAS.pendente;
      if (!k) return [];
      const teto = o.p.modelo !== 'arandela';
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - (teto ? 34 : 10), h: c.hWall(o.v + o.h), radius: L.radius, strength: L.strength * k, tint: L.tint, power: 1.7,
        depthScale: teto ? .55 : .7, heightScale: teto ? .62 : 1, layers: ['wall', 'floor', 'front', 'side']}];
    },
    anima(g, o, t, c) {
      if (!o.p.defeito || !c.lampada(o, 'acesa')) return;
      const s = Math.sin(t * 13 + o.seed) + Math.sin(t * 7.1 + o.seed * 2);
      if (s > 1.2) {
        const dark = g.color('branco', 1);
        if (o.p.modelo === 'fluorescente') g.rect(o.u + 2, o.v + 2, 22, 2, dark);
        else g.rect(o.u + 1, o.v + o.h - 2, o.w - 2, 2, dark);
      }
    }
  });
  M.modulo({
    id: 'luz_emergencia', nome: 'Luz de emergência', grupo: 'Luzes', camada: 'parede', w: 11, h: 5, v: 6, livreV: true, semSombra: true, semInterruptor: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, on = c.emergencia();
      b.bevel(u, v + 1, 11, 4, 'branco', 4, 5, 2);
      for (const dx of [1, 7]) b.rect(u + dx, v, 3, 2, on ? 'luz_quente' : 'vidro', on ? 6 : 3, on ? EMISSIVE : 0);
      b.px(u + 5, v + 3, on ? 'verde_vivo' : 'led', 5, EMISSIVE);
    },
    luzes(o, c) { return c.emergencia() ? [{kind: 'point', X: c.wallX(o.u + 5), d: c.dParede - 12, h: c.hWall(o.v + 2), radius: 150, strength: 1.8, tint: 'emergency', layers: ['wall', 'floor', 'side']}] : []; }
  });
  M.modulo({
    id: 'placa_saida', nome: 'Placa de saída', grupo: 'Luzes', camada: 'parede', w: 17, h: 7, v: 4, livreV: true, semSombra: true,
    params: [{id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'SAIDA'}],
    pinta(b, o) {
      const {u, v} = o;
      b.bevel(u, v, 17, 7, 'branco', 4, 5, 2);
      b.rect(u + 1, v + 1, 15, 5, 'neon_verde', 3, EMISSIVE);
      b.text(u + 9, v + 1, String(o.p.texto || 'SAIDA').toUpperCase().slice(0, 5), 'lencol', 7, {font: '3x5', align: 'center', flags: EMISSIVE});
    },
    luzes(o, c) { return [{kind: 'point', X: c.wallX(o.u + 8), d: c.dParede - 8, h: c.hWall(o.v + 3), radius: 60, strength: .9, tint: 'exit', layers: ['wall']}]; }
  });

  /* ------------------------------------------------------------ na parede */
  M.modulo({
    id: 'interruptor', nome: 'Interruptor', grupo: 'Parede', camada: 'parede', w: 4, h: 6, v: 33, semSombra: true,
    params: [],
    interacao: {tipo: 'interruptor', marca: 'discreta', dados: () => ({alvo: 'luzes'})},
    area: () => ({u: -3, v: -3, w: 10, h: 12}),
    pinta(b, o, c) {
      b.bevel(o.u, o.v, 4, 6, 'branco', 5, 6, 3);
      b.rect(o.u + 1, o.v + (c.luzes ? 1 : 3), 2, 2, 'branco', c.luzes ? 3 : 2);
    }
  });
  M.modulo({
    id: 'quadro_energia', nome: 'Quadro de energia', grupo: 'Parede', camada: 'parede', w: 14, h: 18, v: 20, semSombra: true,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'cinza'}],
    interacao: {tipo: 'painel_eletrico', marca: 'discreta', dados: () => ({})},
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor;
      P.chapa(b, u, v, 14, 18, cor, 3);
      b.inset(u + 2, v + 2, 10, 14, cor, 3, 4, 2);
      for (let yy = v + 4; yy < v + 9; yy += 2) b.hline(u + 4, u + 9, yy, cor, 1);
      b.poly([[u + 7, v + 10], [u + 10.5, v + 15.5], [u + 3.5, v + 15.5]], 'amarelo_vivo', 4);
      b.vline(u + 7, v + 12, v + 13, 'carvao', 0); b.px(u + 7, v + 15, 'carvao', 0);
      b.rect(u + 11, v + 7, 1, 3, 'cromado', 5);
      if (!c.energia) b.px(u + 12, v + 3, 'led', 5, EMISSIVE); else b.px(u + 12, v + 3, 'verde_vivo', 5, EMISSIVE);
      b.vline(u + 6, v - 8, v - 1, 'plastico_preto', 2);
    }
  });
  M.modulo({
    id: 'extintor', nome: 'Extintor', grupo: 'Parede', camada: 'parede', w: 7, h: 20, v: 36, semSombra: true,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um extintor de incêndio. A etiqueta da última recarga está vencida há anos.'})},
    pinta(b, o, c) {
      const {u, v} = o;
      b.bevel(u, v, 7, 6, 'vermelho', 4, 5, 2); b.text(u + 1, v + 1, '!', 'branco', 6, {font: '3x5'});
      b.sphere(u + 3.5, v + 13.5, 2.8, 6, 'vermelho', 2, 5);
      b.rect(u + 2, v + 7, 3, 2, 'latao', 4); b.px(u + 4, v + 7, 'latao', 6);
      b.hline(u + 1, u + 5, v + 12, 'aco', 3);
    }
  });
  /* Corta o texto até caber na largura em 3×5. */
  const cabe = (t, w) => cabeTexto(t, w, '3x5', false);
  /* Um título que não cabe vira um rabisco de letras, que lê melhor que meia palavra. */
  const rabisco = (b, cx, y, w, ramp, nivel, seed) => {
    const n = Math.max(2, Math.floor((w - 2) / 4)), x0 = Math.round(cx - (n * 4 - 1) / 2);
    for (let i = 0; i < n; i++) { const hh = 2 + Math.floor(hash2(i, 3, seed) * 3); b.rect(x0 + i * 4, y + 5 - hh, 3, hh, ramp, nivel); }
  };
  const ESTILOS_CARTAZ = [['aviso', 'Aviso de papel'], ['show', 'Cartaz de show'], ['procura', 'Procura-se'], ['mapa', 'Mapa de evacuação'], ['propaganda', 'Propaganda'], ['calendario', 'Calendário']];
  M.modulo({
    id: 'cartaz', nome: 'Cartaz', grupo: 'Parede', camada: 'parede', livreV: true, semSombra: true, fundo: false,
    w: p => ({G: 26, M: 18, P: 12}[p.tamanho] || 18), h: p => ({G: 20, M: 24, P: 15}[p.tamanho] || 24), v: 12,
    params: [{id: 'estilo', label: 'Estilo', opcoes: ESTILOS_CARTAZ, padrao: 'aviso'}, {id: 'tamanho', label: 'Tamanho', opcoes: [['P', 'Pequeno'], ['M', 'Médio'], ['G', 'Grande']], padrao: 'M'},
      {id: 'titulo', label: 'Título', tipo: 'texto', padrao: 'AVISO'}, {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}],
    interacao: {tipo: 'bilhete', marca: 'discreta', dados: o => ({texto: `${o.p.titulo || 'AVISO'}\n\nO resto está apagado demais para ler.`, papel: 'papel', tinta: 'tinta'})},
    pinta(b, o, c) {
      const {u, v, w, h} = o, p = o.p, random = M.rngDe(o), titulo = String(p.titulo || '').toUpperCase();
      const envelhecido = c.desgaste >= 2;
      switch (p.estilo) {
        case 'show': {
          b.rect(u + 1, v + 1, w, h, 'carvao', 1);
          b.rect(u, v, w, h, 'carvao', 2);
          b.vgrad(u, v, w, h, p.cor, 1, 4);
          b.sphere(u + w / 2, v + h * .42, w * .28, w * .28, 'amarelo_vivo', 3, 6);
          b.rect(u + 1, v + h - 8, w - 2, 7, 'carvao', 1);
          if (cabe(titulo, w - 3)) b.text(u + w / 2, v + h - 7, cabe(titulo, w - 3), 'branco', 6, {font: '3x5', align: 'center'}); else if (titulo) rabisco(b, u + w / 2, v + h - 7, w - 4, 'branco', 5, o.seed);
          break;
        }
        case 'procura': {
          P.folha(b, u, v, w, h, random, {linhas: false, alfinete: null});
          if (cabe('PROCURA-SE', w - 3)) b.text(u + w / 2, v + 2, cabe('PROCURA-SE', w - 3), 'tinta', 1, {font: '3x5', align: 'center'}); else rabisco(b, u + w / 2, v + 2, w - 4, 'tinta', 1, o.seed);
          b.rect(u + 3, v + 8, w - 6, h - 16, 'papel', 3);
          b.sphere(u + w / 2, v + 11 + (h - 16) * .3, 3, 3.4, 'carvao', 1, 2);
          b.rect(u + w / 2 - 4, v + 12 + (h - 16) * .5, 8, (h - 16) * .5 - 1, 'carvao', 1);
          for (let ly = v + h - 7; ly < v + h - 1; ly += 2) b.hline(u + 2, u + w - 3, ly, 'tinta', 3);
          break;
        }
        case 'mapa': {
          b.bevel(u, v, w, h, 'branco', 5, 6, 3);
          b.rect(u + 2, v + 2, w - 4, 4, 'verde_vivo', 3); b.text(u + w / 2, v + 2, 'ROTA', 'branco', 6, {font: '3x5', align: 'center'});
          for (let i = 0; i < 4; i++) b.frame(u + 2 + i * Math.floor((w - 4) / 4), v + 8, Math.floor((w - 4) / 4), 7, 'tinta', 3);
          b.hline(u + 2, u + w - 3, v + 17, 'verde_vivo', 3); b.px(u + 4, v + 16, 'vermelho', 4); b.px(u + 5, v + 16, 'vermelho', 4);
          break;
        }
        case 'propaganda': {
          b.rect(u + 1, v + 1, w, h, 'carvao', 1);
          b.bevel(u, v, w, h, p.cor, 4, 5, 2);
          b.ellipse(u + w * .3, v + h * .45, w * .16, h * .28, 'branco', 6);
          b.rect(u + w * .55, v + 4, w * .35, 2, 'branco', 6); b.rect(u + w * .55, v + 8, w * .3, 1, 'branco', 5);
          if (cabe(titulo, w - 3)) b.text(u + w / 2, v + h - 7, cabe(titulo, w - 3), 'amarelo_vivo', 6, {font: '3x5', align: 'center'}); else if (titulo) rabisco(b, u + w / 2, v + h - 7, w - 4, 'amarelo_vivo', 5, o.seed);
          break;
        }
        case 'calendario': {
          P.folha(b, u, v, w, h, random, {linhas: false, alfinete: 'aco'});
          b.rect(u + 1, v + 1, w - 2, h * .4, p.cor, 3);
          for (let yy = v + h * .45 + 1; yy < v + h - 2; yy += 3) for (let xx = u + 2; xx < u + w - 2; xx += 3) b.px(xx, yy, 'tinta', 3);
          b.px(u + 5, v + h - 5, 'vermelho', 4); b.px(u + 6, v + h - 6, 'vermelho', 4);
          break;
        }
        default: {
          P.folha(b, u, v, w, h, random, {linhas: false, alfinete: 'vermelho'});
          const t = cabe(titulo, w - 3);
          if (t) b.text(u + w / 2, v + 2, t, 'vermelho', 3, {font: '3x5', align: 'center'});
          else if (titulo) rabisco(b, u + w / 2, v + 2, Math.min(w - 4, 16), 'vermelho', 3, o.seed);
          if (titulo) b.hline(u + 2, u + w - 3, v + 8, 'vermelho', 3);
          for (let ly = v + (titulo ? 11 : 3); ly < v + h - 2; ly += 2) b.hline(u + 2, u + 2 + Math.max(2, Math.round((w - 5) * (.45 + random() * .55))), ly, 'tinta', 3);
        }
      }
      if (envelhecido) { b.shadeFn(u, v, w, h, (x, y) => (hash2(x >> 1, y >> 1, o.seed) > .7 ? -1 : 0)); b.erase(u + w - 3, v + h - 3, 3, 3); b.px(u + w - 3, v + h - 3, 'papel', 2); }
    }
  });
  M.modulo({
    id: 'relogio', nome: 'Relógio de parede', grupo: 'Parede', camada: 'parede', w: 12, h: 12, v: 6, livreV: true, semSombra: true,
    params: [{id: 'cor', label: 'Moldura', opcoes: [['madeira', 'Madeira'], ['plastico_preto', 'Preta'], ['vermelho', 'Vermelha'], ['branco', 'Branca']], padrao: 'plastico_preto'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um relógio de parede comum. O ponteiro dos segundos anda aos trancos.'})},
    pinta(b, o) {
      const cx = o.u + 6, cy = o.v + 6;
      b.ellipse(cx + .5, cy + .5, 6, 6, 'carvao', 1);
      b.sphere(cx, cy, 6, 6, o.p.cor, 2, 5);
      b.ellipse(cx, cy, 4.6, 4.6, 'papel', 6);
      for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) b.px(cx + dx, cy + dy, 'tinta', 1);
      b.px(cx + 2, cy - 3, 'papel', 7);
    },
    anima(g, o, t, c) {
      const stage = c.stage;
      const [hh, mm] = String(stage?.clock || '15:10').split(':').map(Number);
      const minutes = (hh % 12) * 60 + mm + ((stage?.time || 0) - (stage?.clockSetAt || 0)) / 60;
      const cx = o.u + 6, cy = o.v + 6, dark = g.color('tinta', 1), red = g.color('vermelho', 4);
      const hand = (angle, len, color) => g.line(cx, cy, cx + Math.round(Math.sin(angle) * len), cy - Math.round(Math.cos(angle) * len), color);
      hand(minutes / 720 * Math.PI * 2, 2.6, dark);
      hand((minutes % 60) / 60 * Math.PI * 2, 3.8, dark);
      hand((Math.floor(t) % 60) / 60 * Math.PI * 2, 4, red);
    }
  });
  const MOTIVOS = [['paisagem', 'Paisagem'], ['mar', 'Mar'], ['abstrato', 'Abstrato'], ['flores', 'Flores'], ['retrato', 'Retrato'], ['cidade', 'Cidade à noite']];
  M.modulo({
    id: 'quadro', nome: 'Quadro', grupo: 'Parede', camada: 'parede', livreV: true, semSombra: true,
    w: p => p.formato === 'retrato' ? 14 : 22, h: p => p.formato === 'retrato' ? 18 : 15, v: 12,
    params: [{id: 'motivo', label: 'Motivo', opcoes: MOTIVOS, padrao: 'paisagem'}, {id: 'formato', label: 'Formato', opcoes: [['paisagem', 'Deitado'], ['retrato', 'Em pé']], padrao: 'paisagem'},
      {id: 'moldura', label: 'Moldura', opcoes: [['madeira', 'Madeira'], ['latao', 'Dourada'], ['plastico_preto', 'Preta'], ['branco', 'Branca']], padrao: 'madeira'},
      {id: 'torto', label: 'Torto', tipo: 'estado', padrao: false}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => ({texto: 'Um quadro comum, de loja de decoração. Atrás, só a parede e um prego.'})},
    pinta(b, o, c) {
      const {u, v, w, h} = o, p = o.p, random = M.rngDe(o, 3);
      const tmp = new K.PixelBuffer(w, h, b.palette);
      tmp.bevel(0, 0, w, h, p.moldura, 3, 5, 1);
      const ix = 2, iy = 2, iw = w - 4, ih = h - 4;
      switch (p.motivo) {
        case 'mar': tmp.vgrad(ix, iy, iw, ih * .55, 'ceu', 4, 2); tmp.vgrad(ix, iy + ih * .55, iw, ih * .45 + 1, 'agua', 3, 1); tmp.sphere(ix + iw * .7, iy + ih * .3, 1.6, 1.6, 'amarelo_vivo', 5, 6); break;
        case 'abstrato': for (let i = 0; i < 5; i++) tmp.rect(ix + random() * iw * .7, iy + random() * ih * .7, 2 + random() * iw * .4, 2 + random() * ih * .4, ['vermelho', 'azul_vivo', 'amarelo_vivo', 'carvao', 'branco'][i], 3 + (i % 2)); break;
        case 'flores': tmp.rect(ix, iy, iw, ih, 'papel', 4); for (let i = 0; i < 6; i++) { const fx = ix + 2 + random() * (iw - 4), fy = iy + 2 + random() * (ih - 6); tmp.vline(fx, fy, iy + ih - 1, 'folha', 3); tmp.sphere(fx, fy, 1.4, 1.4, ['vermelho', 'amarelo_vivo', 'rosa_vivo'][i % 3], 3, 5); } break;
        case 'retrato': tmp.vgrad(ix, iy, iw, ih, 'tecido_verde', 1, 3); tmp.sphere(ix + iw / 2, iy + ih * .38, iw * .2, ih * .18, 'rosa', 3, 5); tmp.rect(ix + iw * .22, iy + ih * .62, iw * .56, ih * .38, 'carvao', 2); break;
        case 'cidade': tmp.rect(ix, iy, iw, ih, 'noite', 2); for (let xx = ix; xx < ix + iw; xx += 3) { const top = iy + 3 + Math.floor(random() * ih * .5); tmp.rect(xx, top, 3, iy + ih - top, 'noite', 1); if (random() < .6) tmp.px(xx + 1, top + 2, 'luz_quente', 5); } break;
        default: tmp.vgrad(ix, iy, iw, ih * .6, 'ceu', 4, 2); tmp.poly([[ix, iy + ih * .75], [ix + iw * .35, iy + ih * .35], [ix + iw * .6, iy + ih * .7], [ix + iw, iy + ih * .45], [ix + iw, iy + ih], [ix, iy + ih]], 'arvore', 3); tmp.rect(ix, iy + ih * .8, iw, ih * .2 + 1, 'folha', 3);
      }
      if (c.estado(o, 'torto')) {
        const ang = .16, ca = Math.cos(ang), sa = Math.sin(ang), R0 = Math.ceil(Math.hypot(w, h) / 2) + 1;
        for (let y = -R0; y <= R0; y++) for (let x = -R0; x <= R0; x++) {
          const sx = Math.floor(x * ca + y * sa + w / 2), sy = Math.floor(-x * sa + y * ca + h / 2);
          const r = tmp.rampAt(sx, sy); if (!r) continue;
          b.px(u + w / 2 + x, v + h / 2 + y, r, tmp.levelAt(sx, sy));
        }
      } else { b.rect(u + 1, v + 1, w, h, 'carvao', 1); b.blit(tmp, u, v); }
      b.px(u + w / 2, v - 2, 'aco', 4);
    }
  });
  M.modulo({
    id: 'espelho', nome: 'Espelho', grupo: 'Parede', camada: 'parede', w: 13, h: 18, v: 14, livreV: true, semSombra: true,
    params: [{id: 'moldura', label: 'Moldura', opcoes: [['aluminio', 'Alumínio'], ['madeira', 'Madeira'], ['latao', 'Dourada']], padrao: 'aluminio'}, {id: 'quebrado', label: 'Rachado', tipo: 'estado', padrao: false}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Seu reflexo parece cansado. Por um instante, ele demora meio segundo para piscar.'})},
    pinta(b, o, c) {
      const {u, v} = o;
      b.rect(u + 1, v + 1, 13, 18, 'carvao', 1);
      b.bevel(u, v, 13, 18, o.p.moldura, 3, 5, 1);
      b.vgrad(u + 2, v + 2, 9, 14, 'vidro', 3, 1);
      b.line(u + 3, v + 9, u + 7, v + 3, 'vidro', 5); b.line(u + 5, v + 12, u + 10, v + 5, 'vidro', 4);
      if (c.estado(o, 'quebrado')) { const r = M.rngDe(o, 5); for (let i = 0; i < 4; i++) b.line(u + 6, v + 8, u + 2 + r() * 9, v + 2 + r() * 14, 'carvao', 3); }
    }
  });
  M.modulo({
    id: 'camera', nome: 'Câmera de segurança', grupo: 'Parede', camada: 'parede', w: 10, h: 6, v: 2, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Uma câmera de segurança. A luzinha vermelha diz que está gravando — ou quer que você pense isso.'})},
    pinta(b, o) {
      const {u, v} = o;
      b.rect(u + 7, v, 3, 2, 'branco', 4);
      b.poly([[u, v + 2], [u + 8, v + 1], [u + 9, v + 4], [u + 1, v + 6]], 'branco', 4);
      b.hline(u + 1, u + 7, v + 2, 'branco', 6);
      b.px(u + 1, v + 4, 'carvao', 0); b.px(u + 2, v + 4, 'vidro', 3);
    },
    anima(g, o, t) { if (Math.floor(t * 1.5 + o.seed) % 2) g.px(o.u + 6, o.v + 3, g.color('led', 5, 'day')); }
  });
  M.modulo({
    id: 'ar_condicionado', nome: 'Ar-condicionado', grupo: 'Parede', camada: 'parede', w: 24, h: 8, v: 4, livreV: true, semSombra: true,
    params: [{id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: true}],
    pinta(b, o, c) {
      const {u, v} = o;
      b.rect(u + 1, v + 1, 24, 8, 'carvao', 1);
      b.bevel(u, v, 24, 7, 'branco', 5, 6, 3);
      b.rect(u + 2, v + 5, 20, 2, 'branco', 2); for (let xx = u + 3; xx < u + 21; xx += 2) b.px(xx, v + 6, 'branco', 4);
      b.px(u + 20, v + 2, c.estado(o, 'ligado') && c.energia ? 'verde_vivo' : 'carvao', 5, EMISSIVE);
      if (c.desgaste >= 2) b.shade(u + 6, v + 7, 6, 12, -1, .35);
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'ligado') || !c.energia) return;
      const y = o.v + 7 + ((t * 30 + o.seed) % 40);
      if (y < 60) g.px(o.u + 8, y, g.color('agua', 4));
    }
  });
  M.modulo({
    id: 'tubulacao', nome: 'Tubulação', grupo: 'Parede', camada: 'parede', fundo: true, semSombra: true, livreV: true,
    w: p => Math.max(20, Math.min(600, Number(p.comprimento) || 120)), h: 6, v: 1,
    params: [{id: 'comprimento', label: 'Comprimento', tipo: 'numero', min: 20, max: 600, padrao: 120}, {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'aco'}],
    pinta(b, o, c) {
      const {u, v, w} = o, cor = o.p.cor;
      for (const [dy, r] of [[1, 2], [4, 1]]) {
        for (let yy = -r; yy <= r; yy++) b.hline(u, u + w - 1, v + dy + yy, cor, 3 - yy + (yy === -r ? 1 : 0));
      }
      for (let xx = u + 6; xx < u + w; xx += 40) { b.rect(xx, v - 1, 3, 7, cor, 2); b.vline(xx + 2, v - 1, v + 5, cor, 5); }
      if (c.desgaste >= 2) for (let i = 0; i < w / 8; i++) b.px(u + Math.floor(hash2(i, 2, o.seed) * w), v + 1 + Math.floor(hash2(i, 3, o.seed) * 4), 'ferrugem', 3);
    },
    anima(g, o, t, c) {
      if (c.desgaste < 2) return;
      const x = o.u + Math.floor(hash2(1, 1, o.seed) * o.w), y = o.v + 6 + ((t * 24) % 50);
      if (y < 61) g.px(x, y, g.color('agua', 3));
    }
  });
  M.modulo({
    id: 'grade_ventilacao', nome: 'Grade de ventilação', grupo: 'Parede', camada: 'parede', w: 12, h: 7, v: 6, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Duto de ventilação', estilo: 'duto', compartimentos: 'Dentro do duto | Poeira, um parafuso solto e um bilhete dobrado: “não confie no zelador”.'})},
    pinta(b, o) {
      const {u, v} = o;
      b.bevel(u, v, 12, 7, 'aluminio', 3, 5, 1);
      for (let yy = v + 1; yy < v + 6; yy += 2) b.hline(u + 1, u + 10, yy, 'carvao', 1);
      b.px(u + 1, v + 1, 'aco', 5); b.px(u + 10, v + 5, 'aco', 5);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
