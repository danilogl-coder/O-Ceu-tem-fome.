/* Montador de cenas — cenas genéricas feitas de peças, editáveis ao vivo.

   Uma cena montável é uma RECEITA (JSON puro, salvo na sessão do mestre):

     {id, modelo, nome, subtitulo, tags, semente, largura,
      casca: {parede, corParede, barra, corBarra, sanca, piso, corPiso, vista, desgaste, exterior, rua},
      luz: {padrao},
      objetos: [{id, mod, x, v?, nome?, p: {parâmetros}, int?: {interação}, pas?: {passagem}, papel?}],
      eventos: [...]}

   O montador compila a receita numa cena comum da SceneLibrary, com as mesmas
   três camadas das cenas pintadas à mão (parede, chão, frente), luzes
   declaradas por objeto (lâmpadas, janelas, telas, postes), estados que
   viram "objetos da cena" (porta aberta, TV ligada, energia), pontos de
   chegada nas passagens e as interações já com a área certa. Mover um móvel
   na receita move a pintura, a luz e a área clicável juntas.

   Peças (módulos) e modelos se registram em outros arquivos:
     Montador.modulo({...})   ver modulos-*.js
     Montador.modelo({...})   ver cenas-genericas.js
     Montador.conjunto({...}) conjuntos de cenas já ligadas

   Medidas do kit (iguais em todas as peças, como num kit modular):
     parede: 62 linhas; 1 linha ≈ 4,2 cm; porta = 26 × 47; chão na linha 62
     x de um objeto = posição no mundo a partir da parede esquerda da sala */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit;
  const {bayer, hash2} = K;
  const S = 2, SW = 480, WALL_ROWS = 62;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const modulos = new Map(), modelos = new Map(), conjuntos = new Map();
  const instancias = new Map();          // id → receita
  const listeners = new Set();

  /* ------------------------------------------------------------ conjuntos de luz */
  const LUZES = {
    interior: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: 0, ceu: 'manha', lampadas: .35,
        sol: {rise: .42, slope: .62, strength: 2.1, tint: 'sun', dust: '#fff2c9'}},
      {id: 'tarde', label: 'Tarde', time: '15:30', variant: 'day', ambient: 0, ceu: 'dia', lampadas: .35,
        sol: {rise: .8, slope: .3, strength: 2, tint: 'sun', dust: '#ffe7ad'}},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -1, ceu: 'tarde', lampadas: 1, character: [1, .9, .82],
        sol: {rise: .36, slope: .9, strength: 1.9, tint: 'sunset', dust: '#ffc996'}},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -3, ceu: 'noite', lampadas: 1.35, rua: 1, character: [.72, .72, .9],
        lua: {rise: .55, slope: -.35, strength: 1.1, tint: 'moon'}},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:10', variant: 'dark', ambient: -4, ceu: 'madrugada', lampadas: 0, escuro: true, rua: .8, character: [.45, .5, .7],
        lua: {rise: .55, slope: -.35, strength: 1.7, tint: 'moon'}}
    ],
    exterior: [
      {id: 'manha', label: 'Manhã', time: '07:40', variant: 'sun', ambient: .5, ceu: 'manha', lampadas: .4, rua: 0},
      {id: 'tarde', label: 'Tarde', time: '15:00', variant: 'day', ambient: .5, ceu: 'dia', lampadas: .4, rua: 0},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:10', variant: 'dusk', ambient: -.5, ceu: 'tarde', lampadas: 1, rua: .7, character: [1, .88, .8]},
      {id: 'noite', label: 'Noite', time: '21:40', variant: 'night', ambient: -3, ceu: 'noite', lampadas: 1.3, rua: 1.4, character: [.74, .72, .88]},
      {id: 'apagao', label: 'Madrugada sem luz', time: '03:30', variant: 'dark', ambient: -4, ceu: 'madrugada', lampadas: 0, rua: 0, escuro: true, character: [.42, .47, .66]}
    ],
    subsolo: [
      {id: 'acesa', label: 'Luz acesa', time: '14:00', variant: 'day', ambient: -1.5, ceu: 'dia', lampadas: 1.2},
      {id: 'meia_luz', label: 'Meia-luz', time: '23:00', variant: 'night', ambient: -3, ceu: 'noite', lampadas: .8, metade: true, character: [.7, .74, .86]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:10', variant: 'dark', ambient: -4.2, ceu: 'madrugada', lampadas: 0, escuro: true, character: [.4, .45, .62]}
    ],
    hospital: [
      {id: 'dia', label: 'Plantão diurno', time: '10:20', variant: 'day', ambient: 0, ceu: 'dia', lampadas: 1,
        sol: {rise: .6, slope: .45, strength: 1.6, tint: 'sun', dust: '#f4f0d8'}},
      {id: 'noite', label: 'Plantão noturno', time: '02:40', variant: 'night', ambient: -2.6, ceu: 'noite', lampadas: 1.1, character: [.76, .8, .9],
        lua: {rise: .5, slope: -.3, strength: .9, tint: 'moon'}},
      {id: 'emergencia', label: 'Emergência', time: '03:17', variant: 'dark', ambient: -4, ceu: 'madrugada', lampadas: 0, escuro: true, emergencia: true, character: [.62, .42, .44]}
    ],
    abandonado: [
      {id: 'nublado', label: 'Dia nublado', time: '11:00', variant: 'musty', ambient: -1, ceu: 'nublado', lampadas: 0,
        sol: {rise: .7, slope: .4, strength: 1.6, tint: 'sun', dust: '#e9e2c4'}},
      {id: 'por_do_sol', label: 'Fim de tarde', time: '17:50', variant: 'dusk', ambient: -1.8, ceu: 'tarde', lampadas: 0, character: [.95, .84, .78],
        sol: {rise: .3, slope: .95, strength: 1.8, tint: 'sunset', dust: '#ffc996'}},
      {id: 'noite', label: 'Noite', time: '23:50', variant: 'dark', ambient: -4, ceu: 'noite', lampadas: 0, escuro: true, character: [.5, .52, .7],
        lua: {rise: .55, slope: -.35, strength: 1.8, tint: 'moon'}}
    ]
  };

  /* ------------------------------------------------------------ registro */
  const Montador = {
    S, WALL_ROWS, LUZES,
    modulo(def) {
      if (!def?.id) throw new Error('Módulo sem id');
      const d = {camada: 'parede', grupo: 'Outros', params: [], w: 20, h: 20, ...def};
      /* Pegadas físicas no piso: decorações penduradas e passagens ficam livres. */
      const solidos = new Set(('sofa poltrona rack_tv estante mesa_jantar cama criado_mudo guarda_roupa comoda geladeira fogao pia_cozinha bancada lixeira vaso_planta cabideiro ventilador abajur_pe escrivaninha arquivo_aco estante_pastas bebedouro copiadora cofre balcao_recepcao cadeiras_espera divisoria mesa_chefe armario_metal prateleira_industrial caixas palete tambor empilhadeira bancada_ferramentas pneus compressor elevador_carro carrinho_ferramentas gondola geladeira_bebidas maquina_venda mesa_lanchonete balcao_bar chapa_cozinha vitrine_balcao fliperama jukebox mesa_sinuca freezer_sorvete mesa_pebolim palco_karaoke leito_hospitalar suporte_soro biombo cadeira_rodas armario_remedios balcao_enfermagem carrinho_medicacao lixeira_hospitalar maca vaso_sanitario pia_banheiro banheira cabine_banheiro mictorio carrinho_limpeza lavatorio_cirurgico poste orelhao ponto_onibus banco_praca hidrante lixeira_publica cacamba carro moto bicicleta alambrado muro arvore_canteiro pilar_garagem guarita cancela entulho movel_velho pedra_beira barranco arvore_estrada').split(' '));
      if(d.tactical===undefined&&solidos.has(d.id))d.tactical={depth:/cama|leito|mesa|carro|sofa|banheira|empilhadeira/.test(d.id)?80:40,kind:'bloqueado'};
      if(d.tactical===undefined&&['roupas_chao','lixo_chao','entulho_chao','azulejo_quebrado','poca'].includes(d.id))d.tactical={kind:'dificil',floor:true};
      d.params = d.params.map(p => ({tipo: 'select', ...p}));
      d.estados = d.params.filter(p => p.tipo === 'estado');
      modulos.set(d.id, d);
      return d;
    },
    modelo(def) { if (!def?.id) throw new Error('Modelo sem id'); modelos.set(def.id, {grupo: 'Outros', tags: [], luz: 'interior', ...def}); return def; },
    conjunto(def) { if (!def?.id) throw new Error('Conjunto sem id'); conjuntos.set(def.id, def); return def; },
    mod: id => modulos.get(id) || null,
    modulos: () => [...modulos.values()],
    modeloDef: id => modelos.get(id) || null,
    modelos: () => [...modelos.values()],
    conjuntoDef: id => conjuntos.get(id) || null,
    conjuntos: () => [...conjuntos.values()],
    receita: id => instancias.get(id) || null,
    instancias: () => [...instancias.values()],
    ehGenerica: id => instancias.has(id),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(kind, id) { for (const fn of listeners) try { fn(kind, id); } catch (e) { console.error(e); } },
    // Memória das interações (TV no canal 3, máquina com a luz queimada): o sistema de exploração troca.
    memoria: () => ({})
  };

  /* ------------------------------------------------------------ parâmetros e medidas */
  function paramsDe(mod, obj) {
    const p = {};
    for (const def of mod.params) p[def.id] = def.padrao ?? (def.tipo === 'estado' ? false : def.tipo === 'numero' ? (def.min ?? 0) : Array.isArray(def.opcoes) ? def.opcoes[0]?.[0] : G.CORES[def.opcoes]?.[0]?.[0] ?? '');
    return Object.assign(p, obj?.p || {});
  }
  const val = (x, p, obj) => typeof x === 'function' ? x(p, obj) : x;
  function medir(mod, obj) {
    const p = paramsDe(mod, obj);
    const w = Math.max(1, Math.round(val(mod.w, p, obj))), h = Math.max(1, Math.round(val(mod.h, p, obj)));
    return {p, w, h};
  }
  /* Largura no mundo (px na profundidade do personagem) que um objeto ocupa. */
  function larguraMundo(mod, obj, room) {
    const {w} = medir(mod, obj);
    if (mod.camada === 'parede') return w * S / room.wallFactor;
    if (mod.camada === 'frente') return w * S / (mod.fator || 1.2);
    return w;
  }
  Montador.paramsDe = paramsDe; Montador.medir = medir; Montador.larguraMundo = larguraMundo;

  /* ------------------------------------------------------------ receita */
  const CASCA = {parede: 'liso', corParede: 'reboco', barra: 'rodape', corBarra: 'madeira', sanca: false, piso: 'tabuas', corPiso: 'taco',
    vista: 'cidade', desgaste: 0, exterior: false, rua: false, teto: true, clima: '', aberto: false};
  let serial = 0;
  const novoId = prefixo => `${prefixo}${Date.now().toString(36).slice(-4)}${(serial++ % 1296).toString(36).padStart(2, '0')}${Math.floor(Math.random() * 36).toString(36)}`;
  Montador.novoId = novoId;
  function normalizar(r) {
    const modelo = modelos.get(r.modelo);
    const out = {v: 1, id: r.id || novoId('g-'), modelo: r.modelo || null, nome: r.nome || modelo?.nome || 'Cena montada', subtitulo: r.subtitulo ?? '',
      tags: Array.isArray(r.tags) ? r.tags : modelo?.tags || ['interior'], semente: (r.semente >>> 0) || 1,
      largura: clamp(Math.round(r.largura || 1000), 520, 6400), casca: {...CASCA, ...(r.casca || {})},
      luz: {conjunto: r.luz?.conjunto || modelo?.luz || 'interior', padrao: r.luz?.padrao || modelo?.luzPadrao || null, ...(r.luz || {})},
      objetos: [], eventos: Array.isArray(r.eventos) ? r.eventos : [], notas: r.notas || '', criada: r.criada || Date.now()};
    if (!LUZES[out.luz.conjunto]) out.luz.conjunto = 'interior';
    out.casca.desgaste = clamp(Math.round(out.casca.desgaste || 0), 0, 3);
    const ids = new Set();
    for (const o of r.objetos || []) {
      if (!modulos.has(o.mod)) continue;
      let id = String(o.id || novoId('o'));
      while (ids.has(id)) id = novoId('o');
      ids.add(id);
      out.objetos.push({...o, id, x: Math.round(Number(o.x) || 0), p: {...(o.p || {})}});
    }
    return out;
  }
  Montador.normalizar = normalizar;

  /* ------------------------------------------------------------ geometria dos objetos */
  function geometria(R, room) {
    const x0 = room.x0, lista = [];
    const ordem = {fundo: 0, parede: 1, chao: 2, frente: 3};
    R.objetos.forEach((obj, i) => {
      const mod = modulos.get(obj.mod);
      if (!mod) return;
      const {p, w, h} = medir(mod, obj);
      const X = x0 + (mod.lateral === 'left' ? 35 : mod.lateral === 'right' ? R.largura - 35 : clamp(obj.x, 0, R.largura));
      const seed = (hash2(G.seedOf(obj.id), R.semente, 17) * 4294967296) >>> 0;
      const o = {obj, mod, id: obj.id, p, w, h, X, seed, i, nome: obj.nome || mod.nome, desgaste: R.casca.desgaste,
        z: (obj.z ?? mod.z ?? 0) + (mod.fundo ? -10 : 0)};
      if (mod.camada === 'parede') {
        o.u = Math.round(room.wallU(X) - w / 2);
        const vPad = val(mod.v, p, obj);
        o.v = mod.livreV && Number.isFinite(obj.v) ? Math.round(obj.v) : Number.isFinite(vPad) ? Math.round(vPad) : WALL_ROWS - h;
      } else if (mod.camada === 'frente') {
        o.fator = mod.fator || 1.2;
        o.top = clamp(Math.round(val(mod.topo, p, obj) ?? 135 - h), 0, 134);
        o.Xp = X - w * S / o.fator / 2;
      } else {                                         // chão: w em px do mundo, profundidade em [d0, d1]
        const prof = val(mod.profundidade, p, obj) || [room.focal + 20, room.dWall - 20];
        o.d0 = prof[0]; o.d1 = prof[1];
        o.X0 = X - w / 2; o.X1 = X + w / 2;
      }
      lista.push(o);
    });
    lista.sort((a, b) => (ordem[a.mod.camada] - ordem[b.mod.camada]) || (a.z - b.z) || (a.i - b.i));
    return lista;
  }
  function rngDe(o, salt = 0) { return K.rng((o.seed + salt * 7919) >>> 0); }
  Montador.rngDe = rngDe;

  /* ------------------------------------------------------------ contexto de pintura */
  function contexto(R, room, ctx, objs) {
    const props = ctx.props || ctx.state?.props || new Set();
    const preset = ctx.preset || {};
    const energia = props.has('energia'), luzes = props.has('luzes');
    const c = {
      R, room, props, preset, weather: ctx.weather || ctx.state?.weather, state: ctx.state, K, G, objs,
      desgaste: R.casca.desgaste, exterior: !!R.casca.exterior, energia, luzes,
      estado: (o, id) => props.has(`${o.id}.${id}`),
      noite: ['noite', 'madrugada'].includes(preset.ceu), chuva: (ctx.weather || ctx.state?.weather) === 'chuva',
      // Força das lâmpadas de teto: energia, interruptor, horário e o próprio estado da peça.
      lampada(o, estadoId = null) {
        if (!energia || preset.escuro) return 0;
        if (estadoId && !props.has(`${o.id}.${estadoId}`)) return 0;
        if (!luzes && !o.mod.semInterruptor) return 0;
        if (preset.metade && o.i % 2) return 0;
        return preset.lampadas ?? 1;
      },
      tela(o, estadoId = 'ligada') { return energia && (!estadoId || props.has(`${o.id}.${estadoId}`)) ? 1 : 0; },
      rua() { return energia ? (preset.rua ?? 0) : 0; },
      emergencia() { return !energia || !!preset.emergencia; },
      wallX: u => room.wallX(u), wallRect: (u0, v0, u1, v1) => room.wallRect(u0, v0, u1, v1),
      hWall: v => room.heightOnWall(v),
      dParede: room.dWall
    };
    return c;
  }

  /* ------------------------------------------------------------ parede */
  const BARRAS = [['nenhuma', 'Nenhuma'], ['rodape', 'Rodapé'], ['lambri', 'Lambri de madeira'], ['azulejo', 'Azulejo até a metade'], ['meia', 'Barra pintada'], ['faixa', 'Faixa colorida']];
  function pintarParede(b, ctx, R, room, objs) {
    const c = contexto(R, room, ctx, objs), C = R.casca, W = b.width, seed = R.semente;
    const cell = [0, 0];
    const barraTopo = C.barra === 'lambri' ? 44 : C.barra === 'azulejo' ? 36 : C.barra === 'meia' ? 38 : C.barra === 'faixa' ? 40 : 59;
    for (let v = 0; v < WALL_ROWS; v++) for (let u = 0; u < W; u++) {
      let ramp, level;
      if (C.barra === 'lambri' && v >= barraTopo) { G.wallMaterial('lambri', u, v, C.corBarra, seed, cell); [ramp, level] = cell; }
      else if (C.barra === 'azulejo' && v >= barraTopo) { G.wallMaterial('azulejo', u, v, C.corBarra, seed, cell); [ramp, level] = cell; }
      else if (C.barra === 'meia' && v >= barraTopo) { G.wallMaterial(C.parede === 'tijolo' ? 'tijolo' : 'liso', u, v, C.corBarra, seed + 1, cell); [ramp, level] = cell; }
      else { G.wallMaterial(C.parede, u, v, C.corParede, seed, cell); [ramp, level] = cell; }
      b.px(u, v, ramp, level);
    }
    // Arremates: rodapé, barra, faixa e sanca.
    if (C.barra === 'lambri') {
      b.hline(0, W - 1, barraTopo - 1, C.corBarra, 2); b.hline(0, W - 1, barraTopo, C.corBarra, 6); b.hline(0, W - 1, barraTopo + 1, C.corBarra, 4); b.hline(0, W - 1, barraTopo + 2, C.corBarra, 2);
      b.dither(0, barraTopo - 2, W, 1, C.corParede, 3, .5);
    } else if (C.barra === 'azulejo') {
      b.hline(0, W - 1, barraTopo - 1, C.corBarra, 6); b.hline(0, W - 1, barraTopo, C.corBarra, 3);
    } else if (C.barra === 'meia') {
      b.hline(0, W - 1, barraTopo - 1, C.corBarra, 2); b.hline(0, W - 1, barraTopo, C.corBarra, 5);
    } else if (C.barra === 'faixa') {
      b.rect(0, barraTopo - 3, W, 3, C.corBarra, 4); b.hline(0, W - 1, barraTopo - 3, C.corBarra, 5); b.hline(0, W - 1, barraTopo - 1, C.corBarra, 3);
    }
    if (C.barra !== 'nenhuma' && !C.exterior) {
      const rod = C.barra === 'lambri' ? C.corBarra : C.corRodape || (C.parede === 'azulejo' ? C.corParede : 'madeira');
      b.rect(0, 59, W, 3, rod, 3); b.hline(0, W - 1, 59, rod, 5); b.hline(0, W - 1, 61, rod, 2);
    }
    if (C.sanca && !C.exterior) { b.hline(0, W - 1, 2, C.corParede, 5); b.hline(0, W - 1, 3, C.corParede, 3); b.hline(0, W - 1, 4, C.corParede, 5); }
    desgasteParede(b, c, R);
    // Objetos, do fundo para a frente.
    for (const o of objs) if (o.mod.camada === 'parede') {
      try { o.mod.pinta(b, o, c); } catch (error) { console.error(`Módulo ${o.mod.id} falhou:`, error); }
    }
    // Teto escuro e cantos.
    if (C.teto && !C.exterior) for (let v = 0; v < 4; v++) b.shade(0, v, W, 1, -1, (4 - v) / 5);
    b.shade(0, 60, W, 2, -1, .45);
    for (let u = 0; u < 5; u++) { b.shade(u, 0, 1, WALL_ROWS, -1, (5 - u) / 7); b.shade(W - 1 - u, 0, 1, WALL_ROWS, -1, (5 - u) / 7); }
  }
  const PICHOS = ['KAOS', 'VIDA', 'CRIA', 'ZONA', 'RUA', 'SOL', '1987', 'NOIA', 'FE', 'VILA', 'OCUPA', 'LUA'];
  function desgasteParede(b, c, R) {
    const n = R.casca.desgaste, W = b.width;
    if (!n) return;
    const random = K.rng(R.semente * 13 + 5);
    // Marcas de uso junto ao rodapé.
    for (let i = 0; i < W / (n >= 2 ? 9 : 18); i++) {
      const u = random.int(0, W - 6), v = random.int(51, 57), len = random.int(2, 6);
      b.shade(u, v, len, 1, -1, .7);
    }
    if (n >= 1) b.shadeFn(0, 50, W, 9, (u, v) => (v - 50) / 9 * -.6 * n / 2);
    if (n >= 2) {
      // Manchas de infiltração descendo do teto.
      for (let i = 0; i < W / 70; i++) {
        const cu = random.int(0, W), rw = random.int(6, 16), rh = random.int(8, 22);
        b.shadeFn(cu - rw, 0, rw * 2, rh + 2, (u, v) => {
          const t = Math.hypot((u - cu) / rw, v / rh) + G.valueNoise(u / 3, v / 3, cu) * .35;
          return t < .85 ? -.8 : t < 1 ? -1.4 : 0;
        });
      }
      for (let i = 0; i < 2 + n; i++) G.pincel.rachadura(b, random.int(8, W - 8), random.int(0, 20), random.int(8, 26), random);
    }
    if (n >= 3) {
      // Tinta descascada mostrando o tijolo e pichações.
      for (let i = 0; i < W / 55; i++) {
        const cu = random.int(0, W), cv = random.int(6, 44), rw = random.int(4, 11), rh = random.int(3, 8);
        const base = random() < .5 ? 'tijolo' : 'concreto';
        for (let v = cv - rh; v <= cv + rh; v++) for (let u = cu - rw; u <= cu + rw; u++) {
          const t = Math.hypot((u - cu) / rw, (v - cv) / rh) + G.valueNoise(u / 2, v / 2, cu + v) * .5;
          if (t < .9) { const cell = G.wallMaterial(base === 'tijolo' ? 'tijolo' : 'concreto', u, v, base, 3, [0, 0]); b.px(u, v, cell[0], cell[1] - 1); }
          else if (t < 1.05) b.shade(u, v, 1, 1, 1);
        }
      }
      for (let i = 0; i < W / 120; i++) {
        const word = PICHOS[random.int(0, PICHOS.length - 1)], ramp = ['neon_rosa', 'azul_vivo', 'verde_vivo', 'vermelho', 'amarelo_vivo', 'branco'][random.int(0, 5)];
        const u = random.int(10, W - 30), v = random.int(24, 46);
        b.text(u + 1, v + 1, word, 'carvao', 1, {font: '3x5'});
        b.text(u, v, word, ramp, 4, {font: '3x5'});
      }
      for (let i = 0; i < W / 20; i++) { const u = random.int(0, W - 1), v = random.int(0, 8); b.px(u, v, 'folha', 1); }
    }
  }

  /* ------------------------------------------------------------ chão */
  function preparaChao(R, room, objs) {
    const decals = objs.filter(o => o.mod.camada === 'chao');
    // Sombra de contato no chão junto aos móveis encostados na parede.
    const x0 = room.x0, cols = Math.ceil((room.x1 - room.x0) / 4) + 2, sombra = new Float32Array(cols);
    for (const o of objs) {
      if (o.mod.camada !== 'parede' || o.mod.semSombra || o.v + o.h < WALL_ROWS - 1) continue;
      const a = Math.floor((room.wallX(o.u) - x0) / 4), z = Math.ceil((room.wallX(o.u + o.w) - x0) / 4);
      for (let i = Math.max(0, a - 1); i <= Math.min(cols - 1, z + 1); i++) sombra[i] = Math.max(sombra[i], i < a || i > z ? .5 : 1);
    }
    return {decals, sombra};
  }
  function pintarChao(X, d, k, u, out, ctx, R, room, prep) {
    const C = R.casca;
    let kind = C.piso, cor = C.corPiso;
    const tx = S / room.rowF[k], td = k + 1 < room.floorRows ? d - room.focal / room.rowF[k + 1] : 2;
    if (C.rua && d < (C.ruaD || room.focal * .93)) {
      const edge = (C.ruaD || room.focal * .93) - d;
      if (edge < 6) { out.r = 'calcada'; out.l = edge < 3 ? 5 : 2; }
      else { G.floorMaterial('asfalto', X, d, 'asfalto', R.semente, out, tx, td); if (C.faixa !== false && d < 400 && d > 392 && ((X % 90) + 90) % 90 < 44) { out.r = 'amarelo_vivo'; out.l = 3; } }
      return;
    }
    G.floorMaterial(kind, X, d, cor, R.semente, out, tx, td);
    // Sombra junto à parede.
    if (d > room.dWall - 26) {
      const s = prep.sombra[Math.floor((X - room.x0) / 4)] || 0, t = (d - (room.dWall - 26)) / 26;
      const dark = t * .55 + s * t * .9;
      if (bayer(u, k) < dark) out.l -= 1;
    }
    // Sujeira pelos cantos e lixo miúdo.
    if (C.desgaste) {
      const n = G.fbm(X / 26, d / 18, R.semente + 11);
      if (bayer(u, k) < (n - .62) * C.desgaste * .9) out.l -= 1;
      if (C.desgaste >= 2 && hash2(Math.floor(X / 3), Math.floor(d / 3), R.semente + 12) > .996 - C.desgaste * .0015) { out.r = hash2(Math.floor(X), 1, 3) > .5 ? 'papel' : 'papelao'; out.l = 4; }
    }
    for (const o of prep.decals) {
      if (X < o.X0 || X > o.X1 || d < o.d0 || d > o.d1) continue;
      o.mod.pintaChao?.(X, d, out, o, u, k);
    }
  }
  function reflexoChao(floor, wall, ctx, R, room) {
    const C = R.casca;
    if (!G.GLOSSY.has(C.piso) || C.desgaste >= 3) return;
    const pal = floor.palette, strengthBase = C.piso === 'tabuas' || C.piso === 'taco' ? .35 : .55;
    for (let k = 0; k < 30; k++) {
      const y = room.floorTop + k * 2 + 1, h = (y - room.H) / room.wallFactor - room.eye;
      const v = Math.round(room.vOnWall(h));
      if (v < 0 || v >= wall.height) continue;
      const strength = strengthBase * (1 - k / 30);
      for (let u = 0; u < room.rowW[k]; u++) {
        const i = k * floor.width + u;
        if (!floor.ramp[i]) continue;
        const X = room.x0 + (u + .5) * 2 / room.rowF[k], wu = Math.round(room.wallU(X));
        if (wu < 0 || wu >= wall.width) continue;
        const wi = v * wall.width + wu, ramp = wall.ramp[wi], lv = wall.level[wi], fl = wall.flags[wi];
        let delta = 0;
        if (!ramp || (fl & K.EMISSIVE && lv >= 4)) delta = 1;
        else if (lv === 0 && k < 14) delta = -1;
        if (delta > 0 && k > 1 && bayer(u >> 1, k) < strength * 1.4) floor.level[i] = Math.min(pal.levels - 1, floor.level[i] + 1);
        else if (delta < 0 && k > 1 && bayer(u >> 1, k) < strength) floor.level[i] = Math.max(0, floor.level[i] - 1);
      }
    }
  }

  /* ------------------------------------------------------------ paredes laterais */
  function pintarLateral(b, side, ctx, R, room, objs) {
    const C = R.casca, cols = b.width, rows = b.height, cell = [0, 0];
    /* MAPA ABERTO: uma beira de estrada não tem parede nas pontas. Deixando as
       laterais transparentes, o que aparece no fim do mapa é o próprio céu com
       as camadas de longe — a estrada some no horizonte em vez de bater num
       muro. Também não se desenha o vão escuro da saída lateral: a estrada
       continuar é o convite, não um buraco na parede. */
    if (C.aberto) return;
    const hBarra = C.barra === 'lambri' ? room.heightOnWall(44) : C.barra === 'azulejo' ? room.heightOnWall(36) : C.barra === 'meia' ? room.heightOnWall(38) : -1;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const d = room.sideNear + x * room.sideStep, h = y * room.sideStep;
      const a = Math.floor(d / 2.94) + (side === 'left' ? 0 : 500), bb = Math.floor((260 - h) / 2.94);
      let kind = C.parede, cor = C.corParede;
      if (hBarra > 0 && h < hBarra) { kind = C.barra === 'lambri' ? 'lambri' : C.barra === 'azulejo' ? 'azulejo' : 'liso'; cor = C.corBarra; }
      G.wallMaterial(kind, a, bb, cor, R.semente, cell);
      let level = cell[1] + (side === 'left' ? 0 : -1);
      if (!C.exterior && C.barra !== 'nenhuma' && h < 7) { cell[0] = C.barra === 'lambri' ? C.corBarra : 'madeira'; level = h < 2 ? 2 : h > 5 ? 5 : 3; }
      b.px(x, y, cell[0], level);
    }
    // Saída lateral: um vão escuro perto do personagem.
    const lat = objs.find(o => o.mod.lateral === side);
    if (lat) {
      const d0 = room.sideNear + 8, d1 = room.sideNear + 120, hTop = 150;
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        const d = room.sideNear + x * room.sideStep, h = y * room.sideStep;
        if (d < d0 - 6 || d > d1 + 6 || h > hTop + 6) continue;
        const inside = d >= d0 && d <= d1 && h <= hTop;
        if (!inside) { b.px(x, y, lat.mod.moldura || 'madeira', d < d0 || h > hTop ? 4 : 2); continue; }
        const depth = (d - d0) / (d1 - d0);
        const lv = C.exterior ? 1 + Math.floor((1 - h / hTop) * 2 + bayer(x, y)) : Math.floor(depth * 1.6 + bayer(x, y) * .8);
        b.px(x, y, C.exterior ? 'asfalto' : 'carvao', lv);
      }
    }
    // Teto e rodapé escurecidos.
    if (!C.exterior) b.shade(0, rows - 6, cols, 6, -1, .6);
  }

  /* ------------------------------------------------------------ lá fora */
  function humor(ctx) {
    const p = ctx.preset || {};
    if ((ctx.weather || ctx.state?.weather) === 'chuva') return p.ceu === 'noite' || p.ceu === 'madrugada' ? 'noite' : 'chuva';
    return p.ceu || 'dia';
  }
  function pintarFora(b, name, ctx, R) {
    const mood = humor(ctx), W = b.width, random = K.rng(name.length * 31 + R.semente % 97);
    const vista = R.casca.vista || 'cidade';
    if (name === 'sky') {
      for (let v = 0; v < WALL_ROWS; v++) {
        const t = Math.min(1, v / 42);
        for (let u = 0; u < W; u++) {
          const j = bayer(u, v);
          if (mood === 'dia' || mood === 'manha') b.px(u, v, 'ceu', Math.floor(1.4 + t * 3.8 + (mood === 'manha' ? .6 : 0) + j));
          else if (mood === 'tarde') b.px(u, v, 'crepusculo', Math.floor(.8 + t * 4.4 + j));
          else if (mood === 'noite') b.px(u, v, 'noite', Math.floor(t * 2.6 + j));
          else if (mood === 'madrugada') b.px(u, v, 'noite', Math.floor(t * 1.6 + j));
          else b.px(u, v, 'cidade', Math.floor((mood === 'nublado' ? 3.2 : 2.6) + t * 1.8 + j));
        }
      }
      if (mood === 'noite' || mood === 'madrugada') {
        for (let i = 0; i < W * .05; i++) b.px(random.int(0, W - 1), random.int(0, 30), 'papel', random() < .3 ? 7 : 5, K.EMISSIVE);
        const mx = 60 + (R.semente % 200);
        b.sphere(mx, 12, 4, 4, 'papel', 4, 7, K.EMISSIVE); b.px(mx + 1, 11, 'papel', 3, K.EMISSIVE);
      }
      if (mood === 'tarde') b.sphere(90 + (R.semente % 160), 38, 6, 6, 'amarelo_vivo', 4, 7, K.EMISSIVE);
      if (mood === 'manha') b.sphere(150 + (R.semente % 120), 22, 4, 4, 'amarelo_vivo', 6, 7, K.EMISSIVE);
    } else if (name === 'far') {
      /* Estrada: no lugar da silhueta da cidade, a serra em camadas (cristas
         que vão clareando com a distância) ou o campo aberto (lombadas baixas
         e uma linha de mata bem no fundo). */
      if (vista === 'serra' || vista === 'campo' || vista === 'arvores') {
        const night = mood === 'noite' || mood === 'madrugada';
        const rampa = night ? 'noite' : mood === 'tarde' ? 'crepusculo' : vista === 'campo' ? 'folha' : 'azul';
        const camadas = vista === 'serra' ? [[16, 58, 2], [26, 40, 1], [36, 26, 0]] : vista === 'campo' ? [[34, 70, 1], [44, 34, 0]] : [[30, 44, 1], [40, 24, 0]];
        for (const [base, passo, lv] of camadas) {
          const fase = random() * 1e3;
          let topo = [];
          for (let x = 0; x < W; x++) {
            const h1 = Math.sin((x + fase) / passo) * .5 + Math.sin((x + fase) / (passo * .37) + 1.7) * .28 + G.valueNoise((x + fase) / (passo * .8), lv * 3, R.semente) * .5;
            topo.push(Math.round(base - h1 * (vista === 'campo' ? 6 : 13)));
          }
          for (let x = 0; x < W; x++) for (let v = topo[x]; v < WALL_ROWS; v++) {
            // A cara sul da crista (onde a próxima sobe) fica um degrau mais escura.
            const subindo = x > 0 && topo[x] < topo[x - 1];
            b.px(x, v, rampa, Math.max(0, (night ? 1 : 2 + lv) + (v === topo[x] && !subindo ? 1 : 0) - (subindo ? 1 : 0)));
          }
          // Neve/luz raspando o alto da crista mais distante da serra.
          if (vista === 'serra' && lv === 2 && !night) for (let x = 0; x < W; x++) if (topo[x] <= base - 9) b.px(x, topo[x], mood === 'tarde' ? 'crepusculo' : 'papel', mood === 'tarde' ? 5 : 4);
        }
        return;
      }
      let u = -4;
      while (u < W) {
        const w = random.int(6, 15), top = random.int(14, 32), tall = random() < .12, t0 = tall ? top - 10 : top;
        for (let x = u; x < u + w; x++) for (let v = t0; v < WALL_ROWS; v++) {
          const lit = x >= u + w - 2;
          if (mood === 'noite' || mood === 'madrugada') {
            const win = (x - u) % 3 === 1 && (v - t0) % 3 === 1 && hash2(x, v, 3) < (mood === 'noite' ? .3 : .12);
            b.px(x, v, win ? 'luz_quente' : 'noite', win ? 3 + (hash2(x, v, 4) < .4 ? 1 : 0) : lit ? 2 : 1, win ? K.EMISSIVE : 0);
          } else if (mood === 'tarde') b.px(x, v, 'crepusculo', lit ? 2 : 1);
          else if (mood === 'chuva' || mood === 'nublado') b.px(x, v, 'cidade', lit ? 2 : 1);
          else { const win = (x - u) % 3 === 1 && (v - t0) % 4 === 2; b.px(x, v, 'cidade', win ? 2 : lit ? (mood === 'manha' ? 5 : 4) : 3); }
        }
        if (tall) { b.vline(u + Math.floor(w / 2), t0 - 5, t0 - 1, mood === 'noite' ? 'noite' : 'cidade', 2); if (mood === 'noite') b.px(u + Math.floor(w / 2), t0 - 6, 'led', 5, K.EMISSIVE); }
        u += w + random.int(-2, 2);
      }
    } else if (name === 'near') {
      const night = mood === 'noite' || mood === 'madrugada';
      if (vista === 'serra' || vista === 'campo') {
        /* Estrada, camada de perto: o morro logo atrás da pista. Na serra ele
           sobe fechando a cena e leva pinheiros; no campo é quase reto, com
           um pasto seco e árvores soltas ao longe. */
        const serra = vista === 'serra';
        const mata = night ? 'noite' : serra ? 'arvore' : 'folha';
        const base = serra ? 30 : 44;
        const topo = [];
        for (let x = 0; x < W; x++) {
          const h1 = Math.sin(x / (serra ? 34 : 60)) * .5 + G.valueNoise(x / (serra ? 18 : 40), 7, R.semente + 5) * .6;
          topo.push(Math.round(base - h1 * (serra ? 16 : 7)));
        }
        for (let x = 0; x < W; x++) for (let v = topo[x]; v < WALL_ROWS; v++) {
          const t = (v - topo[x]) / Math.max(1, WALL_ROWS - topo[x]);
          b.px(x, v, night ? 'noite' : serra ? 'arvore' : 'folha', night ? 1 : Math.max(0, 1 + Math.round(t * 2.2) + (v === topo[x] ? 1 : 0)));
        }
        // Mata pontuada: bolotas de copa no serrado, arbustos soltos no campo.
        for (let i = 0; i < W / (serra ? 5 : 14); i++) {
          const cx = random() * W, rx = (serra ? 3 : 4) + random() * (serra ? 5 : 6);
          const cy = topo[Math.max(0, Math.min(W - 1, Math.floor(cx)))] + (serra ? 1 + random() * 8 : 2 + random() * 4);
          if (serra && random() < .4) {                       // pinheiro: cone em vez de bola
            for (let dy = 0; dy < rx * 2.2; dy++) {
              const wl = Math.round(rx * .8 * (dy / (rx * 2.2)));
              for (let x = Math.round(cx - wl); x <= cx + wl; x++) b.px(x, Math.round(cy - rx * 1.4 + dy), mata, night ? 1 : 2 + (x > cx ? 1 : 0));
            }
          } else b.sphere(cx, cy, rx, rx * .78, mata, night ? 1 : 1, night ? 2 : mood === 'tarde' ? 3 : 4);
        }
        // Pasto seco descendo até a pista, e a cerca de arame que acompanha.
        if (!serra) for (let x = 0; x < W; x++) {
          const y0 = Math.max(topo[x] + 6, 50);
          for (let v = y0; v < WALL_ROWS; v++) b.px(x, v, night ? 'noite' : 'verde', night ? 1 : 2 + (hash2(x, v, 11) < .3 ? 1 : 0));
          if (x % 17 === 0) b.vline(x, 47, 53, night ? 'noite' : 'madeira', night ? 1 : 2);
          if (!night && (x % 2 === 0)) { b.px(x, 49, 'aco', 2); b.px(x, 52, 'aco', 2); }
        }
        for (let u2 = 0; u2 < W; u2++) for (let v = 56; v < WALL_ROWS; v++) if (!b.rampAt(u2, v)) b.px(u2, v, night ? 'noite' : serra ? 'arvore' : 'verde', 1);
        return;
      }
      if (vista === 'arvores' || vista === 'cidade') {
        for (let i = 0; i < W / (vista === 'arvores' ? 4 : 7); i++) {
          const cx = random() * W, cy = (vista === 'arvores' ? 30 : 40) + random() * 18, rx = 5 + random() * 8;
          b.sphere(cx, cy, rx, rx * .8, night ? 'noite' : 'arvore', night ? 1 : 1, night ? 2 : mood === 'tarde' ? 2 : 4);
        }
        for (let u = 0; u < W; u++) for (let v = 52; v < WALL_ROWS; v++) if (!b.rampAt(u, v)) b.px(u, v, night ? 'noite' : 'arvore', 1);
      } else if (vista === 'predios') {
        let u = 0;
        while (u < W) {
          const w = random.int(22, 40), top = random.int(4, 16), ramp = ['cinza', 'reboco', 'tijolo', 'azul'][random.int(0, 3)];
          for (let x = u; x < u + w; x++) for (let v = top; v < WALL_ROWS; v++) {
            const win = (x - u) % 6 >= 2 && (x - u) % 6 <= 4 && (v - top) % 8 >= 2 && (v - top) % 8 <= 5;
            if (night) b.px(x, v, win && hash2(Math.floor((x - u) / 6), Math.floor((v - top) / 8), u) < .35 ? 'luz_quente' : 'noite', win ? 3 : x === u ? 1 : 2, win ? K.EMISSIVE : 0);
            else b.px(x, v, win ? 'vidro' : ramp, win ? 2 : x === u ? 2 : mood === 'tarde' ? 2 : 3);
          }
          u += w + random.int(0, 4);
        }
      } else if (vista === 'muro') {
        for (let u = 0; u < W; u++) for (let v = 10; v < WALL_ROWS; v++) {
          const cell = G.wallMaterial('tijolo', u, v, 'tijolo', 9, [0, 0]);
          b.px(u, v, cell[0], night ? Math.max(0, cell[1] - 2) : cell[1] - 1);
        }
        for (let i = 0; i < W / 3; i++) { const u = random.int(0, W - 1), v = random.int(10, 40); b.px(u, v, 'folha', night ? 1 : 3); }
      }
    }
  }
  function animarFora(g, name, t) {
    if (name !== 'sky') return;
    const p = g.preset || {};
    if (p.ceu === 'dia' || p.ceu === 'manha' || p.ceu === 'tarde') {
      const colors = p.ceu === 'tarde' ? [g.color('crepusculo', 5), g.color('crepusculo', 3)] : [g.color('papel', 7), g.color('ceu', 4)];
      for (let i = 0; i < 7; i++) {
        const x = ((i * 97 + t * (1.2 + i * .25)) % 420) - 30, y = 6 + (i * 7) % 18, w = 12 + (i * 5) % 10;
        g.rect(x + 2, y, w - 4, 2, colors[0]); g.rect(x, y + 2, w, 2, colors[0]); g.rect(x + 1, y + 4, w - 2, 1, colors[1]);
      }
    } else if (p.ceu === 'noite') {
      for (let i = 0; i < 9; i++) if (Math.sin(t * (1 + i * .37) + i) > .6) g.px((i * 53) % 400, (i * 11) % 28, g.color('papel', 7, 'day'));
    }
  }

  /* ------------------------------------------------------------ luzes */
  function luzes(ctx, R, room, objs) {
    const c = contexto(R, room, ctx, objs), p = c.preset, list = [];
    const vidros = [];
    for (const o of objs) {
      if (o.mod.vidro) { const g = o.mod.vidro(o, c); if (g) vidros.push({...room.wallRect(g.u, g.v, g.u + g.w, g.v + g.h), cols: g.cols || 2, rows: g.rows || 2, bar: g.bar ?? 4}); }
      if (o.mod.luzes) { try { for (const L of o.mod.luzes(o, c) || []) if (L && L.strength) list.push(L); } catch (error) { console.error(error); } }
    }
    if (vidros.length) {
      const sol = c.chuva ? (p.sol ? {...p.sol, strength: p.sol.strength * .35, dust: null} : null) : p.sol;
      if (sol) list.push({kind: 'sun', windows: vidros, rise: sol.rise, slope: sol.slope, strength: sol.strength, soft: 3, tint: sol.tint, dust: sol.dust || null, layers: ['floor', 'front', 'side'], occludable: true});
      if (p.lua) list.push({kind: 'sun', windows: vidros, rise: p.lua.rise, slope: p.lua.slope, strength: p.lua.strength, soft: 4, tint: p.lua.tint, layers: ['floor', 'front', 'side'], occludable: true});
    }
    // Um pouco de escuro subindo para o teto, nas salas fechadas.
    if (!R.casca.exterior) list.push({kind: 'band', h0: 110, h1: 200, strength: -.8, layers: ['wall', 'side']});
    return list;
  }

  /* ------------------------------------------------------------ compilar */
  function compilar(receita) {
    const R = normalizar(receita);
    const modelo = modelos.get(R.modelo);
    const room = root.makeRoom({x0: 0, x1: R.largura});
    const objs = geometria(R, room);
    const pal = G.palette();
    const conj = LUZES[R.luz.conjunto] || LUZES.interior;
    const temJanela = objs.some(o => o.mod.vidro) || R.casca.exterior;
    const chuvaTune = ctx => ctx.weather === 'chuva' ? {ambient: (ctx.preset.ambient || 0) - .6, variant: ctx.preset.variant === 'day' || ctx.preset.variant === 'sun' ? 'rain' : ctx.preset.variant} : null;
    const presets = conj.map(base => ({...base, tune: temJanela ? chuvaTune : null, lights: ctx => luzes(ctx, R, room, objs)}));
    const padrao = presets.some(p => p.id === R.luz.padrao) ? R.luz.padrao : presets[Math.min(presets.length - 1, conj === LUZES.interior ? 3 : 0)].id;
    // Objetos da cena: energia, interruptor e o estado de cada peça.
    const props = [];
    if (!R.casca.semEnergia) props.push({id: 'energia', label: 'Energia', default: R.casca.energia !== false, group: 'Luz'}, {id: 'luzes', label: 'Luzes acesas (interruptor)', default: R.casca.luzes !== false, group: 'Luz'});
    for (const o of objs) for (const e of o.mod.estados) props.push({id: `${o.id}.${e.id}`, label: e.label, default: !!o.p[e.id], group: o.nome});
    // Pontos de chegada: centro e cada passagem.
    const spawns = [{id: 'centro', label: 'Centro', x: Math.round(R.largura / 2), facing: 1}];
    const clues = [];
    for (const o of objs) {
      const area = areaDe(o);
      if (o.mod.passagem) {
        const pas = {...(o.mod.passagem.padrao || {}), ...(o.obj.pas || {})};
        const cx = anchorX(o, room, area);
        const lateral = o.mod.lateral;
        const x = lateral === 'left' ? room.x0 + 34 : lateral === 'right' ? room.x1 - 34 : Math.round(cx);
        spawns.push({id: o.id, label: o.nome, x, facing: lateral ? (lateral === 'left' ? 1 : -1) : (x < R.largura / 2 ? 1 : -1)});
        const extra = typeof o.mod.passagem.dados === 'function' ? o.mod.passagem.dados(o) : {};
        clues.push({id: o.id, name: o.nome, type: 'passagem', marker: pas.marca || 'discreta', anchor: area, objeto: o.id,
          enabled: pas.ativo !== false, requires: pas.requer || null, note: pas.nota || '', data: {tipo: o.mod.passagem.tipo || 'porta', sentido: o.p.sentido || '', lateral: o.mod.lateral || '', papel: o.obj.papel || '', ...extra, ...pas}});
        continue;
      }
      // A interação do módulo pode depender dos parâmetros: objeto, função do objeto ou tipo calculado.
      const raw = typeof o.mod.interacao === 'function' ? o.mod.interacao(o) : o.mod.interacao;
      const base = raw ? {...raw, tipo: typeof raw.tipo === 'function' ? raw.tipo(o) : raw.tipo} : null;
      if (o.obj.int === false || (!base && !o.obj.int)) continue;
      const int = {...(base || {}), ...(o.obj.int || {})};
      if (o.obj.int?.tipo && base?.tipo && o.obj.int.tipo !== base.tipo && !o.obj.int.dados) int.dados = {};
      if (!int.tipo) continue;
      const dadosBase = o.obj.int?.tipo && base?.tipo && o.obj.int.tipo !== base.tipo ? {} : (typeof base?.dados === 'function' ? base.dados(o) : base?.dados || {});
      const dados = {...dadosBase, ...(o.obj.int?.dados || {})};
      clues.push({id: o.id, name: o.nome, type: int.tipo, marker: int.marca || 'discreta', anchor: area, objeto: o.id, requires: int.requer || null,
        enabled: int.ativo !== false, note: int.nota || '', data: dados});
    }
    const front = objs.filter(o => o.mod.camada === 'frente').map(o => {
      return {id: o.id, X: o.Xp, w: o.w, top: o.top, h: o.h, factor: o.fator,
        paint: (b, ctx) => { const c = contexto(R, room, ctx, objs); try { o.mod.pinta(b, o, c); } catch (e) { console.error(`Módulo ${o.mod.id} falhou:`, e); } if (!o.mod.luzDeTras) b.setFlags(0, 0, o.w, o.h, K.FACES_CAMERA); },
        animate: o.mod.anima ? (g, t, state, stage) => o.mod.anima(g, o, t, animCtx(R, room, objs, state, stage, g)) : null};
    });
    const wallAnim = objs.filter(o => o.mod.camada === 'parede' && o.mod.anima);
    const floorAnim = objs.filter(o => o.mod.camada === 'chao' && o.mod.anima);
    let prep = null;
    const def = {
      id: R.id, name: R.nome, subtitle: R.subtitulo || modelo?.nome || '', tags: [...new Set([...(R.tags || []), 'genérica'])],
      kind: 'room', room: {x0: 0, x1: R.largura, wallFactor: .68, frontFactor: 1.17, outsideMargin: 124, aberto: !!R.casca.aberto}, palette: pal,
      defaultPreset: padrao, flickerPreset: presets[presets.length - 1].id, presets,
      weathers: temJanela ? (R.casca.clima === 'chuva' ? [{id: 'chuva', label: 'Chuva'}, {id: 'limpo', label: 'Céu limpo'}]
        : [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}]) : [{id: 'limpo', label: 'Normal'}],
      props, spawns, clues, conclusions: [], front,
      generica: true, receita: R, modelo: R.modelo, objetos: objs,
      paint: {
        wall: (b, ctx) => pintarParede(b, ctx, R, room, objs),
        floor: (X, d, k, u, out, ctx) => { if (k === 0 && u === 0 || !prep) prep = preparaChao(R, room, objs); pintarChao(X, d, k, u, out, ctx, R, room, prep); },
        floorReflect: (floor, wall, ctx) => reflexoChao(floor, wall, ctx, R, room),
        side: (b, side, ctx) => pintarLateral(b, side, ctx, R, room, objs),
        outside: (b, name, ctx) => pintarFora(b, name, ctx, R)
      },
      animate: {
        outside: (g, name, t, state) => animarFora(g, name, t, state),
        wall: wallAnim.length || R.casca.exterior ? (g, t, state, stage) => {
          const c = animCtx(R, room, objs, state, stage, g);
          for (const o of wallAnim) { try { o.mod.anima(g, o, t, c); } catch (e) { console.error(e); } }
          if (c.chuva && R.casca.exterior) chuvaParede(g, t);
        } : null,
        floor: floorAnim.length || R.casca.exterior ? (g, t, state, stage, cc) => {
          const c = animCtx(R, room, objs, state, stage, g);
          c.cc = cc;
          for (const o of floorAnim) { try { o.mod.anima(g, o, t, c); } catch (e) { console.error(e); } }
          if (c.chuva && R.casca.exterior) chuvaChao(g, t);
        } : null
      }
    };
    return def;
  }
  function animCtx(R, room, objs, state, stage, g) {
    const c = contexto(R, room, {state, props: state?.props, preset: g?.preset, weather: state?.weather}, objs);
    c.stage = stage; c.time = stage?.time || 0;
    c.memoria = id => Montador.memoria(R.id, id) || {};
    return c;
  }
  function chuvaParede(g, t) {
    const col = g.color('vidro', 5, 'day');
    for (let i = 0; i < 70; i++) {
      const x = (i * 37 + Math.floor(t * 40) * (i % 3 + 1)) % 250 - 5, y = (i * 23 + t * 160 * (1 + i % 2 * .4)) % 70 - 6;
      g.rect(x, y, 1, 3, col);
    }
  }
  function chuvaChao(g, t) {
    const col = g.color('vidro', 6, 'day');
    for (let i = 0; i < 26; i++) {
      const ph = (t * 3 + i * .37) % 1, x = (i * 53) % 240, y = 70 + (i * 29) % 64;
      if (ph < .25) { g.px(x, y, col); } else if (ph < .45) { g.px(x - 1, y, col); g.px(x + 1, y, col); }
    }
  }
  function areaDe(o) {
    const a = o.mod.area ? o.mod.area(o) : null;
    if (o.mod.camada === 'parede') {
      const r = a || {u: 0, v: 0, w: o.w, h: o.h};
      return {layer: 'wall', u: o.u + r.u, v: o.v + r.v, w: r.w, h: r.h};
    }
    if (o.mod.camada === 'frente') {
      const r = a || {x: 0, y: 0, w: o.w, h: o.h};
      return {layer: 'front', piece: o.id, x: r.x, y: r.y, w: r.w, h: r.h};
    }
    return {layer: 'floor', X: Math.round(o.X), dNear: Math.round(o.d0), dFar: Math.round(o.d1), w: Math.round(o.w)};
  }
  function anchorX(o, room, area) {
    if (area.layer === 'wall') return room.wallX(area.u + area.w / 2);
    if (area.layer === 'front') return o.Xp + (area.x + area.w / 2) * S / o.fator;
    return area.X;
  }
  Montador.compilar = compilar;
  Montador.areaDe = areaDe;

  /* ------------------------------------------------------------ instâncias */
  function registrar(receita, {silencioso = false} = {}) {
    const R = normalizar(receita);
    instancias.set(R.id, R);
    const def = compilar(R);
    root.SceneLibrary.register(def);
    if (!silencioso) Montador.emit('registrar', R.id);
    return R;
  }
  Montador.registrar = registrar;
  /* Gera uma receita a partir de um modelo. opcoes: {semente, nome, luz, desgaste, largura, variante} */
  Montador.gerar = function gerar(modeloId, opcoes = {}) {
    const modelo = modelos.get(modeloId);
    if (!modelo) throw new Error(`Modelo desconhecido: ${modeloId}`);
    const semente = (opcoes.semente >>> 0) || (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
    const random = K.rng(semente);
    const L = layout(opcoes.largura || 1000);
    const base = modelo.gerar({rng: random, semente, opcoes, L, G, K, Montador}) || {};
    const receita = {modelo: modeloId, nome: opcoes.nome || base.nome || modelo.nome, subtitulo: opcoes.subtitulo ?? base.subtitulo ?? '', tags: base.tags || modelo.tags,
      semente, largura: base.largura || L.largura, casca: {...(base.casca || {}), ...(opcoes.desgaste !== undefined ? {desgaste: opcoes.desgaste} : {})},
      luz: {conjunto: modelo.luz, padrao: opcoes.luz || base.luzPadrao || modelo.luzPadrao}, objetos: base.objetos || L.objetos, eventos: base.eventos || modelo.eventos?.map(e => ({...e})) || []};
    return normalizar(receita);
  };
  Montador.criar = function criar(modeloId, opcoes = {}) { return registrar(Montador.gerar(modeloId, opcoes)); };
  /* Edita uma cena montada: fn(receita) muda a receita no lugar. */
  /* visual: false quando só mudam dados (destino de uma porta, eventos):
     a cena é recompilada, mas as camadas pintadas continuam valendo. */
  Montador.editar = function editar(id, fn, {stage = null, fade = .35, visual = true} = {}) {
    const R = instancias.get(id);
    if (!R) return null;
    const copia = JSON.parse(JSON.stringify(R));
    const res = fn(copia);
    const novo = normalizar(res && typeof res === 'object' && res.objetos ? res : copia);
    novo.id = id;
    instancias.set(id, novo);
    const def = compilar(novo);
    root.SceneLibrary.register(def);
    const st = stage || Montador.stage;
    if (visual) st?.refreshScene?.(id, {fade});
    else if (st?.live?.scene.id === id) st.live = {...st.live, scene: def};
    Montador.emit(visual ? 'editar' : 'dados', id);
    return novo;
  };
  /* Pintura de uma peça sozinha, com a luz do dia: miniaturas do catálogo e a
     arte ampliada do “examinar”. Devolve {canvas|image, w, h}. */
  Montador.miniatura = function miniatura(modId, obj = {}, {receita = null, props = null, doc = root.document} = {}) {
    const mod = modulos.get(modId);
    if (!mod || mod.camada === 'chao') return null;
    const R = normalizar(receita || {largura: 900, objetos: []});
    const room = root.makeRoom({x0: 0, x1: Math.max(900, R.largura)});
    const full = {id: obj.id || 'm', mod: modId, x: 450, ...obj};
    const o = geometria({...R, largura: room.x1, objetos: [full]}, room)[0];
    if (!o) return null;
    const pal = G.palette();
    const set = new Set(props ? [...props] : []);
    if (!props) { set.add('energia'); set.add('luzes'); for (const e of mod.estados) if (o.p[e.id]) set.add(`${o.id}.${e.id}`); }
    const c = contexto(R, room, {props: set, preset: {id: 'dia', lampadas: 1, rua: 1, ceu: 'dia'}, weather: 'limpo'}, [o]);
    let buf, crop;
    try {
      if (mod.camada === 'parede') {
        const margem = 10, W = o.w + margem * 2;
        buf = new K.PixelBuffer(W, WALL_ROWS, pal);
        const oo = {...o, u: margem};
        mod.pinta(buf, oo, c);
        crop = {x0: 0, y0: Math.max(0, o.v - 12), x1: W, y1: WALL_ROWS};
      } else {
        buf = new K.PixelBuffer(o.w, o.h, pal);
        mod.pinta(buf, o, c);
        crop = {x0: 0, y0: 0, x1: o.w, y1: o.h};
      }
    } catch (error) { console.error(`Miniatura de ${modId} falhou:`, error); return null; }
    // Recorta o que foi pintado.
    let x0 = crop.x1, y0 = crop.y1, x1 = crop.x0, y1 = crop.y0;
    for (let y = crop.y0; y < crop.y1; y++) for (let x = crop.x0; x < crop.x1; x++) if (buf.rampAt(x, y)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new K.PixelBuffer(w, h, pal);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y + y0) * buf.width + (x + x0), j = y * w + x;
      out.ramp[j] = buf.ramp[i]; out.level[j] = buf.level[i]; out.flags[j] = buf.flags[i];
    }
    const image = K.resolve(out, {variant: 'day', ambient: 0});
    if (doc?.createElement) return {canvas: K.toCanvas(image, doc), w, h};
    return {image, w, h};
  };
  Montador.remover = function remover(id) {
    if (!instancias.has(id)) return false;
    instancias.delete(id);
    root.SceneLibrary.unregister?.(id);
    Montador.emit('remover', id);
    return true;
  };
  Montador.duplicar = function duplicar(id, {nome} = {}) {
    const R = instancias.get(id);
    if (!R) return null;
    const copia = JSON.parse(JSON.stringify(R));
    copia.id = novoId('g-'); copia.nome = nome || `${R.nome} (cópia)`; copia.criada = Date.now();
    for (const o of copia.objetos) if (o.pas) { o.pas.destino = ''; o.pas.chegada = ''; }
    return registrar(copia);
  };
  Montador.exportar = () => [...instancias.values()].map(r => JSON.parse(JSON.stringify(r)));
  Montador.importar = function importar(lista, {substituir = true} = {}) {
    if (substituir) for (const id of [...instancias.keys()]) { instancias.delete(id); root.SceneLibrary.unregister?.(id); }
    for (const r of Array.isArray(lista) ? lista : []) { try { registrar(r, {silencioso: true}); } catch (error) { console.error('Cena montada inválida:', error); } }
    Montador.emit('importar');
  };

  /* ------------------------------------------------------------ layout para os modelos */
  function layout(largura) {
    const L = {largura, objetos: [], ocupado: [], n: 0};
    const room = () => root.makeRoom({x0: 0, x1: L.largura});
    L.add = (mod, x, p = {}, extra = {}) => {
      const def = modulos.get(mod);
      if (!def) { console.warn('Módulo desconhecido no modelo:', mod); return null; }
      const obj = {id: extra.id || `o${++L.n}`, mod, x: Math.round(x), p: {...p}, ...extra};
      L.objetos.push(obj);
      if (def.camada === 'parede' && !def.fundo && !extra.sobrepor) {
        const w = larguraMundo(def, obj, room());
        L.ocupado.push([x - w / 2, x + w / 2]);
      }
      return obj;
    };
    /* Cabe um objeto de parede centrado em x? */
    L.livre = (mod, x, p = {}, folga = 4) => {
      const def = modulos.get(mod), w = larguraMundo(def, {mod, p}, room());
      const a = x - w / 2 - folga, b = x + w / 2 + folga;
      return a >= 20 && b <= L.largura - 20 && !L.ocupado.some(([c, d]) => a < d && b > c);
    };
    /* Procura um lugar livre perto de x (ou em qualquer lugar). */
    L.lugar = (mod, random, p = {}, {perto = null, tentativas = 60} = {}) => {
      for (let i = 0; i < tentativas; i++) {
        const x = perto !== null ? perto + (random() - .5) * 80 * (1 + i / 8) : 40 + random() * (L.largura - 80);
        if (L.livre(mod, x, p)) return Math.round(x);
      }
      return null;
    };
    L.tentar = (mod, random, p = {}, opts = {}) => { const x = L.lugar(mod, random, p, opts); return x === null ? null : L.add(mod, x, p, opts.extra || {}); };
    return L;
  }
  Montador.layout = layout;

  /* ------------------------------------------------------------ passagens da cena */
  Montador.passagens = id => (root.SceneLibrary.get(id)?.clues || []).filter(c => c.type === 'passagem');

  root.Montador = Montador;
  if (typeof module !== 'undefined' && module.exports) module.exports = Montador;
})(typeof window !== 'undefined' ? window : globalThis);
