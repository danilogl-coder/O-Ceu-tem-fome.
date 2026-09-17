/* Montador · paleta e materiais — a caixa de tintas das cenas montáveis.

   Todas as cenas genéricas e todos os módulos (portas, móveis, máquinas,
   fachadas) pintam com a mesma paleta, como um kit de peças que se encaixa
   em qualquer sala (o "kit" do design modular: poucas peças, medidas iguais,
   variantes 01/02/03). Cada rampa vai do escuro (sombra fria) ao claro (luz
   quente); a luz da cena sobe e desce a rampa depois, então manhã, noite e
   apagão saem do mesmo desenho.

   Módulos podem acrescentar rampas próprias com GenKit.addRamps() antes da
   primeira cena ser montada; a paleta é construída uma vez, sob demanda.

   Também ficam aqui os padrões de material pintados por código: reboco,
   azulejo, tijolo, papel de parede, lambri, blocos, concreto, tábuas,
   cerâmica, carpete, asfalto, calçada portuguesa… e os tons oferecidos ao
   mestre em cada escolha de cor. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const {bayer, hash2} = K;

  /* ------------------------------------------------------------ rampas */
  const RAMPS = {
    // Paredes pintadas.
    reboco: ['#3a2e30', '#6f5a52', '#a38b74', '#c9b393', '#e6d6b6', '#f7eedb'],
    branco: ['#34303c', '#67616e', '#9d97a2', '#c9c4c6', '#e8e4dc', '#faf7ef'],
    verde: ['#15241f', '#2e4a3d', '#4f735c', '#7a9d7f', '#a8c4a2', '#d6e6c8'],
    azul: ['#161d33', '#2e3d5c', '#4f6485', '#7b90ab', '#a9bccd', '#d8e4ea'],
    rosa: ['#2e1620', '#5c2e38', '#8f5354', '#bd7f74', '#dfab98', '#f5d6c4'],
    amarelo: ['#2e2010', '#5e4418', '#93702a', '#c29e46', '#e3c774', '#f7e8b0'],
    cinza: ['#15161e', '#2c2f3b', '#4a4e5c', '#707584', '#9ca1ab', '#cdd0d2'],
    vinho: ['#1a080e', '#3b1220', '#5e2231', '#853a45', '#ab5f63', '#d08f8a'],
    petroleo: ['#081312', '#132624', '#1f3a36', '#2f524b', '#476f63', '#6b917f'],
    concreto: ['#17171c', '#302f36', '#4d4b52', '#6d6a6f', '#928e90', '#bab5b2'],
    tijolo: ['#1c0c0a', '#431a13', '#6e2e1e', '#984a2f', '#bd7049', '#dd9a70'],
    argamassa: ['#241f22', '#4a4244', '#72686a', '#9a8f8c', '#bfb4ab', '#ddd3c6'],
    // Madeiras.
    madeira: ['#140807', '#321710', '#552a19', '#7a4325', '#a26336', '#c98d55'],
    madeira_clara: ['#261508', '#57361a', '#8a5f2f', '#b88a4e', '#dbb577', '#f3dba6'],
    madeira_escura: ['#0c0506', '#1f0e0c', '#361b14', '#52291c', '#733f28', '#98593a'],
    taco: ['#1c0d0a', '#44200f', '#6f3d1d', '#9a5e30', '#c5854b', '#e8b176'],
    mdf: ['#2f2a2c', '#5f5856', '#948a80', '#c2b6a6', '#e2d8c8', '#f7f1e6'],
    // Metais.
    aco: ['#10131a', '#232a35', '#3d4755', '#5f6b7a', '#8995a2', '#bcc6cd', '#e9eff1'],
    aluminio: ['#2a2f36', '#4f5760', '#79838b', '#a6aeb3', '#cdd3d4', '#f0f3f1'],
    ferro_verde: ['#0b1612', '#193128', '#2b4d3e', '#446d58', '#6a9377', '#9dbf9f'],
    ferro_azul: ['#0b1122', '#172647', '#29406c', '#425f92', '#6b87b5', '#a3b9d6'],
    ferro_bege: ['#211b14', '#463a2b', '#716048', '#9d8a6a', '#c5b491', '#e6dabb'],
    ferrugem: ['#170906', '#3d170c', '#693013', '#944f1f', '#b97834', '#d8a15a'],
    latao: ['#2a1905', '#5e3c10', '#9a6a22', '#d09c43', '#f3d27e', '#fff3c9'],
    cromado: ['#1d2330', '#46506a', '#7d8aa4', '#b6c2d4', '#e2ebf3', '#fbfdff'],
    // Tecidos e couro.
    tecido_vinho: ['#16060c', '#380f1d', '#5d1d2e', '#843244', '#ab5360', '#cd8185'],
    tecido_azul: ['#070d1f', '#12214a', '#213875', '#3a579d', '#6181c0', '#95addb'],
    tecido_verde: ['#08130d', '#15301f', '#264c31', '#3d6d46', '#61925f', '#95b98b'],
    tecido_mostarda: ['#231606', '#4f3510', '#80581c', '#ae7f2f', '#d3a64e', '#ecd08a'],
    tecido_cinza: ['#131219', '#292832', '#45434f', '#66636e', '#8d8a92', '#b9b5b7'],
    tecido_rosa: ['#23101a', '#4e2336', '#7e3e55', '#ad6177', '#d18e9d', '#efc2c8'],
    couro: ['#0e0605', '#28120c', '#462216', '#673621', '#8e5231', '#b67a4f'],
    couro_preto: ['#050407', '#0f0b10', '#1c161d', '#2c232c', '#40333e', '#5a4955'],
    lencol: ['#3b3845', '#6f6d7c', '#a3a2ae', '#cfcfd4', '#ebebea', '#fbfaf5'],
    // Plásticos e pintados.
    plastico_bege: ['#2f2a22', '#5e5446', '#8f826c', '#b8aa90', '#d9ccb2', '#f1e7d0'],
    plastico_preto: ['#050407', '#0e0c12', '#1b1820', '#2c2832', '#433d4a', '#625a68'],
    vermelho: ['#1f0305', '#4d080d', '#841418', '#bb2a24', '#e45a3c', '#ff9f73'],
    laranja: ['#2a0e03', '#652808', '#a54a10', '#dc7420', '#f7a345', '#ffd08a'],
    amarelo_vivo: ['#3a2a05', '#7c5c0e', '#c49a1f', '#eccb44', '#fde88a', '#fff9d6'],
    verde_vivo: ['#04140a', '#0c3219', '#16562b', '#2a8141', '#56b35f', '#a5e08e'],
    azul_vivo: ['#050b2a', '#0e1f5a', '#1b3a93', '#2f5fc4', '#5f92e6', '#a8c9f7'],
    roxo: ['#12061c', '#2c0e3d', '#4b1a63', '#70318a', '#9a56b0', '#c890d3'],
    rosa_vivo: ['#2a0716', '#5f1235', '#982457', '#cc4280', '#ee7aa8', '#ffb9d1'],
    turquesa: ['#03161a', '#083a40', '#10636a', '#1f9294', '#4fc2b8', '#a4ecdc'],
    papelao: ['#211307', '#4a2e13', '#775023', '#a2773b', '#c79d5f', '#e6c794'],
    borracha: ['#060508', '#110e14', '#1d1920', '#2b262e', '#3c353f', '#51484f'],
    // Vidro, telas e luzes (quase sempre EMISSIVE).
    vidro: ['#172633', '#2e4a5c', '#4f7485', '#7ea2ad', '#b5d0d2', '#e6f5f1'],
    tela: ['#020714', '#071a3c', '#0f3673', '#2463ab', '#62a6e0', '#cdeaff'],
    fosforo: ['#010805', '#03200d', '#08401c', '#127535', '#34c864', '#b5ffc6'],
    luz_quente: ['#3d2a08', '#7d5714', '#c38f2a', '#eec35a', '#fff0a6', '#fffbe6'],
    luz_fria: ['#1b2a2e', '#3f5d62', '#74999b', '#acd0cc', '#dff3ec', '#f7fffb'],
    neon_rosa: ['#2a0418', '#6e0a3f', '#b81d6e', '#f0479c', '#ff8cc6', '#ffe0f0'],
    neon_azul: ['#02102a', '#06306e', '#0d5fb5', '#2a9cf0', '#78d0ff', '#dff5ff'],
    neon_verde: ['#021a0c', '#054d22', '#0c8a3c', '#26c95e', '#79f59a', '#dcffe6'],
    led: ['#1a0204', '#4a0508', '#8c0c10', '#d9261f', '#ff6a4a', '#ffc2a8'],
    sodio: ['#2b1204', '#6b3208', '#b3620f', '#eb9a2a', '#ffc86a', '#fff0c8'],
    // Natureza.
    folha: ['#07140b', '#12311a', '#23552a', '#3f7e38', '#71ab55', '#b5d684'],
    terra: ['#140b07', '#301c11', '#52321d', '#76502f', '#9c7449', '#c29e6e'],
    agua: ['#081b2e', '#12385a', '#205d86', '#3a8ab1', '#72b9d4', '#bfe6ee'],
    // Papel e tinta.
    papel: ['#3e3327', '#85745a', '#c2ad86', '#e2d3b0', '#f3e9d2', '#fffaee'],
    tinta: ['#0c0f26', '#1b2660', '#2f459c', '#5a74c8', '#9fb2e8'],
    // Pisos.
    ceramica: ['#2a2220', '#56473e', '#85735f', '#b09c83', '#d4c3a8', '#eee2ca'],
    linoleo: ['#141c16', '#2c3b30', '#4a5d4c', '#6d8169', '#96a78c', '#c2cdb2'],
    asfalto: ['#0b0b10', '#18181f', '#28272f', '#3b3a42', '#524f56', '#6f6a6e'],
    calcada: ['#1f1d22', '#3d3a40', '#5f5b5e', '#86807f', '#aea6a0', '#d2c9bf'],
    epoxi: ['#101512', '#232c27', '#3a4640', '#56645c', '#7a877c', '#a6ae9f'],
    carvao: ['#040308', '#0f0d17', '#1c1927', '#302c3d', '#4d475c', '#7e7790'],
    // Céu e cidade.
    ceu: ['#4f7fae', '#76a3cb', '#9fc4df', '#c5dfea', '#e7f3f2'],
    crepusculo: ['#241838', '#57305f', '#9c4c66', '#d9745f', '#f5a864', '#ffd98f'],
    noite: ['#03040b', '#080d20', '#111a3d', '#1e2d63', '#33478f'],
    cidade: ['#1f2a3c', '#3a4a60', '#5c6f86', '#8295ab', '#adbdcc', '#d6e0e6'],
    arvore: ['#122517', '#244528', '#3d6a3a', '#65944e', '#9dbf72'],
    // Sujeira, manchas.
    sujeira: ['#0d0906', '#221810', '#3a2b1d', '#57432e', '#786043'],
    sangue: ['#140204', '#34060a', '#5c0c11', '#861519', '#ae2a24'],
    oleo: ['#07060c', '#141222', '#231f36', '#36304c', '#4d4563']
  };
  const VARIANTS = [
    ['sun', {light: 1.06, chroma: 1.06, hue: 88, bias: .016}],
    ['sunset', {light: 1.04, chroma: 1.1, hue: 52, bias: .042}],
    ['lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .035}],
    ['fluor', {light: 1.02, chroma: .62, hue: 175, bias: .026}],
    ['screen', {light: 1, chroma: .7, hue: 235, bias: .05}],
    ['neon', {light: 1.02, chroma: 1.15, hue: 330, bias: .06}],
    ['sodium', {light: .98, chroma: 1.05, hue: 62, bias: .055}],
    ['emergency', {light: .95, chroma: .95, hue: 28, bias: .075}],
    ['exit', {light: .96, chroma: .55, hue: 150, bias: .06}],
    ['dusk', {light: .9, chroma: 1.05, hue: 330, bias: .02, contrast: 1.02}],
    ['night', {light: .8, chroma: .55, hue: 262, bias: .035, contrast: .96}],
    ['moon', {light: .96, chroma: .45, hue: 238, bias: .035}],
    ['dark', {light: .64, chroma: .45, hue: 270, bias: .03, contrast: .95}],
    ['rain', {light: .92, chroma: .72, hue: 235, bias: .018}],
    ['musty', {light: .94, chroma: .7, hue: 110, bias: .018, contrast: .97}]
  ];
  const extra = {};
  let palette = null;
  const GenKit = {
    RAMPS, VARIANTS,
    addRamps(defs) {
      for (const [name, keys] of Object.entries(defs || {})) {
        if (RAMPS[name] || extra[name]) continue;
        extra[name] = keys;
        if (palette) palette = null;             // reconstrói na próxima montagem
      }
    },
    palette() {
      if (palette) return palette;
      palette = new K.Palette({...RAMPS, ...extra}, {levels: 8});
      for (const [name, opts] of VARIANTS) palette.variant(name, opts);
      palette.version = (GenKit.paletteVersion = (GenKit.paletteVersion || 0) + 1);
      return palette;
    },
    has: name => !!(RAMPS[name] || extra[name])
  };

  /* ------------------------------------------------------------ ruído */
  function valueNoise(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, seed = 0) => valueNoise(x, y, seed) * .62 + valueNoise(x * 2.3, y * 2.3, seed + 7) * .38;
  const seedOf = str => [...String(str)].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 2166136261) >>> 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------ opções de cor */
  const CORES = {
    parede: [['reboco', 'Bege'], ['branco', 'Branco'], ['verde', 'Verde-claro'], ['azul', 'Azul'], ['rosa', 'Salmão'], ['amarelo', 'Amarelo'], ['cinza', 'Cinza-azulado'], ['vinho', 'Vinho'], ['petroleo', 'Verde-petróleo'], ['concreto', 'Concreto'], ['tijolo', 'Tijolo']],
    madeira: [['madeira', 'Madeira'], ['madeira_clara', 'Madeira clara'], ['madeira_escura', 'Madeira escura'], ['mdf', 'MDF branco']],
    tecido: [['tecido_vinho', 'Vinho'], ['tecido_azul', 'Azul'], ['tecido_verde', 'Verde'], ['tecido_mostarda', 'Mostarda'], ['tecido_cinza', 'Cinza'], ['tecido_rosa', 'Rosa'], ['couro', 'Couro'], ['couro_preto', 'Couro preto']],
    metal: [['aco', 'Aço'], ['aluminio', 'Alumínio'], ['ferro_verde', 'Verde'], ['ferro_azul', 'Azul'], ['ferro_bege', 'Bege'], ['vermelho', 'Vermelho'], ['ferrugem', 'Enferrujado']],
    plastico: [['plastico_bege', 'Bege'], ['branco', 'Branco'], ['plastico_preto', 'Preto'], ['vermelho', 'Vermelho'], ['azul_vivo', 'Azul'], ['verde_vivo', 'Verde'], ['amarelo_vivo', 'Amarelo'], ['laranja', 'Laranja'], ['roxo', 'Roxo'], ['rosa_vivo', 'Rosa']],
    viva: [['vermelho', 'Vermelho'], ['laranja', 'Laranja'], ['amarelo_vivo', 'Amarelo'], ['verde_vivo', 'Verde'], ['turquesa', 'Turquesa'], ['azul_vivo', 'Azul'], ['roxo', 'Roxo'], ['rosa_vivo', 'Rosa']],
    neon: [['neon_rosa', 'Rosa'], ['neon_azul', 'Azul'], ['neon_verde', 'Verde'], ['led', 'Vermelho'], ['luz_quente', 'Amarelo']],
    chao: [['taco', 'Madeira'], ['madeira_clara', 'Madeira clara'], ['madeira_escura', 'Madeira escura'], ['ceramica', 'Bege'], ['branco', 'Branco'], ['linoleo', 'Verde'], ['azul', 'Azul'], ['vinho', 'Vinho'], ['concreto', 'Concreto'], ['epoxi', 'Epóxi'], ['asfalto', 'Asfalto'], ['calcada', 'Calçada'], ['tijolo', 'Terracota'], ['carvao', 'Grafite']]
  };

  /* ------------------------------------------------------------ materiais da parede
     Cada material devolve [rampa, nível] para um ponto (a, b) da superfície:
     na parede do fundo a = coluna u e b = linha v (b cresce para baixo); nas
     laterais a = profundidade/2 e b = altura invertida. `cor` é a rampa. */
  const PAREDES = [['liso', 'Pintura lisa'], ['azulejo', 'Azulejo'], ['tijolo', 'Tijolo aparente'], ['papel', 'Papel listrado'], ['arabesco', 'Papel florido'], ['lambri', 'Lambri de madeira'], ['blocos', 'Blocos de concreto'], ['concreto', 'Concreto aparente'], ['painel', 'Painéis'], ['pastilha', 'Pastilhas']];
  function wallMaterial(kind, a, b, cor, seed, out) {
    const n = fbm(a / 11, b / 7, seed + 3);
    let level = 4;
    switch (kind) {
      case 'azulejo': {
        const cw = 7, ch = 6, ga = ((a % cw) + cw) % cw, gb = ((b % ch) + ch) % ch;
        if (ga === 0 || gb === 0) { out[0] = cor; out[1] = 2; return out; }
        level = 4 + (hash2(Math.floor(a / cw), Math.floor(b / ch), seed) > .85 ? -1 : 0);
        if (gb === 1 || ga === cw - 1) level += 1;                   // brilho no canto do azulejo
        out[0] = cor; out[1] = level; return out;
      }
      case 'pastilha': {
        const ga = ((a % 3) + 3) % 3, gb = ((b % 3) + 3) % 3;
        if (ga === 2 || gb === 2) { out[0] = cor; out[1] = 2; return out; }
        const h = hash2(Math.floor(a / 3), Math.floor(b / 3), seed);
        out[0] = cor; out[1] = h > .8 ? 5 : h < .2 ? 3 : 4; return out;
      }
      case 'tijolo': {
        const rh = 3, row = Math.floor(b / rh), off = row % 2 ? 4 : 0, bw = 8;
        const ga = (((a + off) % bw) + bw) % bw, gb = ((b % rh) + rh) % rh;
        if (gb === rh - 1 || ga === bw - 1) { out[0] = 'argamassa'; out[1] = n > .6 ? 3 : 2; return out; }
        const h = hash2(Math.floor((a + off) / bw), row, seed);
        level = 3 + (h > .78 ? 1 : h < .18 ? -1 : 0) + (gb === 0 ? 1 : 0);
        out[0] = cor === 'tijolo' || !cor ? 'tijolo' : cor; out[1] = level; return out;
      }
      case 'papel': {
        const s = ((a % 8) + 8) % 8;
        level = s < 2 ? 3 : s === 4 ? 5 : 4;
        if (n > .7 && bayer(a, b) < .3) level -= 1;
        out[0] = cor; out[1] = level; return out;
      }
      case 'arabesco': {
        const ca = ((a % 12) + 12) % 12, cb = ((b + (Math.floor(a / 12) % 2) * 6) % 12 + 12) % 12;
        const dx = ca - 6, dy = cb - 6, r = dx * dx + dy * dy;
        level = r <= 2 ? 5 : (r >= 9 && r <= 11 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) ? 3 : 4;
        out[0] = cor; out[1] = level; return out;
      }
      case 'lambri': {
        const s = ((a % 6) + 6) % 6;
        out[0] = cor && cor.startsWith('madeira') ? cor : 'madeira';
        out[1] = s === 0 ? 1 : s === 1 ? 4 : 3 + (hash2(Math.floor(a / 6), Math.floor(b / 9), seed) > .6 ? 1 : 0);
        if (s > 1 && hash2(a, Math.floor(b / 3), seed + 2) > .93) out[1] -= 1;
        return out;
      }
      case 'blocos': {
        const bw = 10, bh = 5, row = Math.floor(b / bh), off = row % 2 ? 5 : 0;
        const ga = (((a + off) % bw) + bw) % bw, gb = ((b % bh) + bh) % bh;
        if (ga === 0 || gb === 0) { out[0] = cor; out[1] = 2; return out; }
        level = 4 + (hash2(Math.floor((a + off) / bw), row, seed) > .7 ? -1 : 0);
        if (gb === 1) level += 1;
        if (bayer(a, b) < (n - .5) * .6) level -= 1;
        out[0] = cor; out[1] = level; return out;
      }
      case 'concreto': {
        const pw = 40, ph = 20, ga = ((a % pw) + pw) % pw, gb = ((b % ph) + ph) % ph;
        level = 4;
        if (ga === 0 || gb === 0) level = 3;
        if ((ga === 6 || ga === pw - 6) && (gb === 5 || gb === ph - 5)) level = 1;  // furos da forma
        if (n > .64 && bayer(a + 1, b) < (n - .64) * 2.4) level += 1;
        else if (n < .34 && bayer(a, b + 2) < (.34 - n) * 2) level -= 1;
        out[0] = cor; out[1] = level; return out;
      }
      case 'painel': {
        const pw = 28, ga = ((a % pw) + pw) % pw;
        level = ga === 0 ? 2 : ga === 1 ? 5 : 4;
        if (ga > 2 && bayer(a, b) < (n - .55) * .8) level += 1;
        out[0] = cor; out[1] = level; return out;
      }
      default: {                                                       // liso
        level = 4;
        const m = fbm(a / 19, b / 12, seed + 3);
        if (m > .7 && bayer(a + 1, b) < (m - .7) * 1.6) level = 5;
        else if (m < .26 && bayer(a, b + 2) < (.26 - m) * 1.4) level = 3;
        out[0] = cor; out[1] = level; return out;
      }
    }
  }

  /* ------------------------------------------------------------ pisos
     Em coordenadas do mundo: X ao longo da sala, d = profundidade. */
  const PISOS = [['tabuas', 'Tábuas'], ['taco', 'Taco em espinha'], ['ceramica', 'Cerâmica'], ['xadrez', 'Xadrez'], ['carpete', 'Carpete'], ['concreto', 'Concreto'], ['linoleo', 'Vinílico'], ['asfalto', 'Asfalto'], ['calcada', 'Calçada'], ['portuguesa', 'Calçada portuguesa'], ['epoxi', 'Epóxi'], ['podre', 'Tábuas podres']];
  /* Rejunte que cai exatamente num texel: `a` é a coordenada, `t` o tamanho do
     texel nessa direção; verdadeiro no primeiro texel de cada peça. Assim as
     linhas não viram tracejado na perspectiva. */
  const junta = (a, s, t, off = 0) => Math.floor((a + off) / s) !== Math.floor((a + off - Math.max(.5, t)) / s);
  /* Em coordenadas do mundo: X ao longo da sala, d = profundidade; tx e td são
     o tamanho do texel no mundo (largura e profundidade). */
  function floorMaterial(kind, X, d, cor, seed, out, tx = 2, td = 2) {
    switch (kind) {
      case 'taco': {
        const s = 22, cx = Math.floor(X / s), cd = Math.floor(d / 11);
        const vertical = (cx + cd) % 2 === 0;
        const gap = vertical ? junta(X, s, tx) || (junta(d, 11, td) && ((d / 11) % 2 < 1)) : junta(d, 11, td) || (junta(X, s, tx) && ((X / s) % 2 < 1));
        out.r = cor; out.l = gap ? 2 : 4 + (hash2(cx, cd, seed) > .72 ? 1 : 0) - (hash2(cx, cd, seed + 5) < .12 ? 1 : 0);
        return;
      }
      case 'ceramica': case 'xadrez': {
        const s = kind === 'xadrez' ? 34 : 44, sd = kind === 'xadrez' ? 23 : 30, cx = Math.floor(X / s), cd = Math.floor(d / sd);
        if (junta(X, s, tx) || junta(d, sd, td)) { out.r = kind === 'xadrez' ? 'carvao' : cor; out.l = kind === 'xadrez' ? 4 : 2; return; }
        if (kind === 'xadrez') {
          // Escuro sem chegar ao preto: o xadrez não pode engolir a sala.
          const dark = (cx + cd) % 2 === 0;
          out.r = dark ? 'carvao' : cor; out.l = dark ? 3 : 5;
          if (!dark && hash2(cx, cd, seed) > .8) out.l = 4;
          return;
        }
        out.r = cor; out.l = 4 + (hash2(cx, cd, seed) > .82 ? 1 : 0);
        return;
      }
      case 'carpete': {
        const n = fbm(X / 22, d / 16, seed);
        out.r = cor; out.l = 3;
        if (n > .6 && bayer(Math.floor(X / 2), Math.floor(d / 2)) < (n - .6) * 1.6) out.l = 4;
        else if (n < .32 && bayer(Math.floor(X / 2), Math.floor(d / 2)) < (.32 - n) * 1.6) out.l = 2;
        return;
      }
      case 'concreto': case 'epoxi': {
        // Manchas largas e suaves (pontilhadas nas bordas), juntas de dilatação e um pouco de brita.
        const joint = junta(X, 180, tx) || junta(d, 120, td);
        out.r = cor;
        if (joint) { out.l = 2; return; }
        const n = fbm(X / 52, d / 30, seed + 1), bx = Math.floor(X / 2), bd = Math.floor(d / 2);
        let l = 3;
        if (n > .64 && bayer(bx, bd) < (n - .64) * 2.4) l = 4;
        else if (n < .3 && bayer(bx, bd) < (.3 - n) * 1.8) l = 2;
        const h = hash2(Math.floor(X / 2), Math.floor(d / 2), seed + 5);
        if (h > .993) l = Math.min(5, l + 1); else if (h < .005) l = Math.max(1, l - 1);
        if (kind === 'epoxi' && hash2(Math.floor(X / 3), Math.floor(d / 3), seed) > .985) l += 1;
        out.l = l;
        return;
      }
      case 'linoleo': {
        const s = 46, sd = 30, cx = Math.floor(X / s), cd = Math.floor(d / sd);
        if (junta(X, s, tx) || junta(d, sd, td)) { out.r = cor; out.l = 3; return; }
        out.r = cor; out.l = 4;
        const h = hash2(Math.floor(X / 4), Math.floor(d / 3), seed);
        if (h > .985) out.l = 3; else if (h < .012) out.l = 5;
        if ((cx + cd) % 2 === 0 && bayer(Math.floor(X / 2), Math.floor(d / 2)) < .12) out.l = 3;
        return;
      }
      case 'asfalto': {
        const n = fbm(X / 40, d / 25, seed + 2);
        out.r = 'asfalto'; out.l = 3 + (n > .64 ? 1 : 0) - (n < .28 ? 1 : 0);
        const h = hash2(Math.floor(X / 3), Math.floor(d / 2), seed);
        if (h > .975) out.l += 1; else if (h < .02) out.l -= 1;
        return;
      }
      case 'calcada': {
        const s = 52, sd = 34;
        out.r = cor; out.l = junta(X, s, tx) || junta(d, sd, td) ? 2 : 4 - (hash2(Math.floor(X / s), Math.floor(d / sd), seed) < .2 ? 1 : 0);
        if (hash2(Math.floor(X / 3), Math.floor(d / 2), seed + 3) > .97) out.l -= 1;
        return;
      }
      case 'portuguesa': {                                         // ondas pretas e brancas
        const wave = Math.sin(X / 34 + Math.sin(d / 40) * 1.6) * 16 + d * .9;
        const band = ((wave % 64) + 64) % 64;
        const stone = hash2(Math.floor(X / 3), Math.floor(d / 2), seed);
        const dark = band < 20;
        out.r = dark ? 'carvao' : 'calcada'; out.l = dark ? 2 + (stone > .7 ? 1 : 0) : 5 - (stone > .75 ? 1 : 0);
        if (stone < .06) out.l -= 1;
        return;
      }
      case 'podre': {
        const plank = Math.floor(d / 22), off = plank * 57, joint = Math.floor((X + off) / 120);
        const hole = hash2(plank, joint, seed + 9) > .9 && ((X + off) % 120 + 120) % 120 > 30;
        out.r = hole ? 'carvao' : cor; out.l = hole ? 0 : junta(d, 22, td) || junta(X, 120, tx, off) ? 1 : 3 - (hash2(plank, joint, seed) > .6 ? 1 : 0);
        if (!hole && hash2(Math.floor(X / 2), Math.floor(d / 2), seed + 4) > .93) out.l -= 1;
        return;
      }
      default: {                                                   // tabuas
        const plank = Math.floor(d / 24), off = plank * 53, joint = Math.floor((X + off) / 160);
        out.r = cor; out.l = 4 + (hash2(plank, joint, seed) > .7 ? 1 : 0) - (hash2(plank, joint, seed + 3) < .12 ? 1 : 0);
        if (junta(d, 24, td)) out.l = 2;
        else if (junta(X, 160, tx, off)) out.l = 2;
        else if (hash2(Math.floor(X / 5), plank, seed + 7) > .93) out.l -= 1;
      }
    }
  }
  const GLOSSY = new Set(['ceramica', 'xadrez', 'linoleo', 'epoxi', 'taco', 'tabuas']);

  /* ------------------------------------------------------------ pincéis comuns
     Pequenas receitas usadas por muitos módulos. `b` é um PixelBuffer. */
  const pincel = {
    /* Sombra de contato: escurece a parede logo ao redor de um móvel apoiado no chão. */
    contato(b, u, w, {base = 61, alto = 3} = {}) {
      b.shade(u - 1, base - alto, 1, alto + 1, -1, .5); b.shade(u + w, base - alto, 1, alto + 1, -1, .5);
      b.shade(u - 2, base, w + 4, 1, -1, .6);
    },
    /* Madeira com veios horizontais. */
    veios(b, x, y, w, h, ramp, base, seed, {vertical = false} = {}) {
      b.rect(x, y, w, h, ramp, base);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const t = vertical ? valueNoise(xx / 1.6, yy / 7, seed) : valueNoise(xx / 7, yy / 1.6, seed);
        if (t > .72) b.px(x + xx, y + yy, ramp, base + 1); else if (t < .2) b.px(x + xx, y + yy, ramp, base - 1);
      }
    },
    /* Metal escovado com rebites nos cantos. */
    chapa(b, x, y, w, h, ramp, base, {rebites = true} = {}) {
      b.bevel(x, y, w, h, ramp, base, base + 2, base - 2);
      for (let yy = y + 2; yy < y + h - 2; yy += 2) if (bayer(x, yy) < .3) b.hline(x + 2, x + w - 3, yy, ramp, base + 1);
      if (rebites) for (const [px, py] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) b.px(px, py, ramp, base + 3);
    },
    /* Tecido estofado: gomos arredondados com luz de cima à direita. */
    estofado(b, x, y, w, h, ramp, lo, hi, seed = 1) {
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const nx = xx / Math.max(1, w - 1) * 2 - 1, ny = yy / Math.max(1, h - 1) * 2 - 1;
        const lit = clamp(.55 + nx * .25 - ny * .45 - (nx * nx + ny * ny) * .25, 0, 1);
        const lv = Math.floor(lo + (hi - lo) * lit + bayer(x + xx, y + yy) - .5);
        b.px(x + xx, y + yy, ramp, lv);
      }
      if (seed) for (let i = 0; i < Math.max(1, Math.floor(w * h / 40)); i++) {
        const px = x + 1 + Math.floor(hash2(i, 3, seed) * (w - 2)), py = y + 1 + Math.floor(hash2(i, 5, seed) * (h - 2));
        b.shade(px, py, 1, 1, -1);
      }
    },
    /* Livros numa prateleira: lombadas de alturas e cores diferentes. */
    livros(b, x, y, w, h, random, {cores = ['vermelho', 'azul_vivo', 'verde_vivo', 'amarelo_vivo', 'tecido_mostarda', 'vinho', 'tecido_azul', 'papel'], vazio = .08} = {}) {
      let xx = x;
      while (xx < x + w) {
        const bw = random() < .2 ? 2 : 1 + (random() < .5 ? 1 : 0);
        if (random() < vazio) { xx += bw + 1; continue; }
        const bh = Math.max(2, h - Math.floor(random() * 3));
        const ramp = cores[Math.floor(random() * cores.length)];
        const lv = 3 + Math.floor(random() * 2);
        if (random() < .1 && xx + 4 < x + w) {                    // livro deitado
          b.rect(xx, y + h - 2, 4, 2, ramp, lv); b.hline(xx, xx + 3, y + h - 2, ramp, lv + 1); xx += 5; continue;
        }
        b.rect(xx, y + h - bh, bw, bh, ramp, lv);
        b.px(xx, y + h - bh, ramp, lv + 1);
        if (bh > 3 && random() < .5) b.px(xx, y + h - bh + 1 + Math.floor(random() * (bh - 2)), 'papel', 5);
        xx += bw;
      }
    },
    /* Papel preso na parede, com linhas de texto. */
    folha(b, x, y, w, h, random, {nivel = 5, alfinete = 'vermelho', linhas = true, rampa = 'papel'} = {}) {
      b.rect(x + 1, y + 1, w, h, 'carvao', 2);
      b.rect(x, y, w, h, rampa, nivel);
      b.hline(x, x + w - 1, y, rampa, nivel + 1); b.vline(x + w - 1, y, y + h - 1, rampa, nivel - 1);
      if (linhas) for (let ly = y + 2; ly < y + h - 1; ly += 2) b.hline(x + 1, x + Math.max(1, Math.round((w - 3) * (.4 + random() * .6))), ly, 'tinta', 3);
      if (alfinete) b.px(x + Math.floor(w / 2), y, alfinete, 4);
    },
    /* Planta de folhas pontudas saindo de um ponto. */
    planta(b, cx, baseY, {folhas = 11, alcance = 14, abertura = 1, seed = 1, rampa = 'folha'} = {}) {
      const random = K.rng(seed);
      const leaves = [];
      for (let i = 0; i < folhas; i++) {
        const a = -Math.PI / 2 + (i / Math.max(1, folhas - 1) - .5) * 2.5 * abertura + (random() - .5) * .35;
        leaves.push({a, len: alcance * (.55 + random() * .45), shade: random()});
      }
      leaves.sort((p, q) => Math.abs(q.a + Math.PI / 2) - Math.abs(p.a + Math.PI / 2));
      for (const leaf of leaves) {
        const steps = Math.round(leaf.len);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, droop = t * t * 5 * Math.cos(leaf.a) * Math.cos(leaf.a);
          const x = cx + Math.cos(leaf.a) * s, y = baseY + Math.sin(leaf.a) * s + droop;
          const lit = Math.cos(leaf.a) > 0 ? 1 : 0, level = 2 + Math.round(leaf.shade * 1.5) + lit + (t > .7 ? 1 : 0);
          b.px(x, y, rampa, Math.min(6, level));
          if (t < .75) b.px(x + (Math.cos(leaf.a) > 0 ? 0 : 1), y + 1, rampa, Math.max(1, level - 2));
        }
      }
    },
    /* Moita arredondada (jiboia, samambaia): cachos iluminados sobrepostos. */
    moita(b, cx, cy, rx, ry, {seed = 3, cachos = 26, escuro = 0, rampa = 'folha'} = {}) {
      const random = K.rng(seed);
      for (let i = 0; i < cachos; i++) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random());
        const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r, size = 1.4 + random() * 1.6;
        const lit = clamp(.5 + (x - cx) / rx * .35 - (y - cy) / ry * .35, 0, 1);
        b.sphere(x, y, size, size * .85, rampa, 1 + escuro, 3 + Math.round(lit * 2) - escuro);
      }
    },
    /* Vidro com reflexo diagonal. */
    vidro(b, x, y, w, h, {rampa = 'vidro', nivel = 2, reflexo = true, flags = 0} = {}) {
      b.rect(x, y, w, h, rampa, nivel, flags);
      if (reflexo) for (let i = 0; i < w + h; i += 7) for (let t = 0; t < 3; t++) {
        const xx = x + i - t, yy = y + t;
        for (let s = 0; s < h; s++) if (xx - s >= x && xx - s < x + w && yy + s < y + h) b.px(xx - s, yy + s, rampa, nivel + (t === 1 ? 2 : 1), flags);
      }
    },
    /* Texto em 3×5 centralizado dentro de uma largura. */
    placa(b, cx, y, str, ramp, level, flags = 0) { b.text(cx, y, String(str || '').toUpperCase(), ramp, level, {font: '3x5', align: 'center', flags}); },
    /* Rachadura descendo irregular. */
    rachadura(b, u, v, len, random, {rampa = null, nivel = 1} = {}) {
      let x = u, y = v;
      for (let i = 0; i < len; i++) {
        if (rampa) b.px(x, y, rampa, nivel); else b.shade(x, y, 1, 1, -2);
        y += 1; if (random() < .55) x += random() < .5 ? -1 : 1;
        if (random() < .08) { const bx = x + (random() < .5 ? -1 : 1); b.shade(bx, y, 1, 1, -1); }
      }
    }
  };

  const api = {GenKit, valueNoise, fbm, seedOf, clamp, CORES, PAREDES, PISOS, wallMaterial, floorMaterial, GLOSSY, pincel};
  Object.assign(GenKit, api);
  root.GenKit = GenKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = GenKit;
})(typeof window !== 'undefined' ? window : globalThis);
