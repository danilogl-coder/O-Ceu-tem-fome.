/* The wardrobe window: a pixel-art panel, drawn on a canvas at 1x and shown
   scaled, where the character is dressed. Left, the character herself, alive
   (breathing, blinking, hair moving) and able to walk on the spot so cloth
   physics can be judged; right, the categories, the items of the open one as
   pixel tiles cut from the garments themselves, the colours, and ready-made
   outfits. Key G opens it; Esc closes it. What is chosen is kept in this
   browser. */
(function (scope) {
  'use strict';
  const W = 320, H = 248;
  // The HUD's purple ink, panel and text, plus a few for the tiles.
  const C = {ink: '#140619', panel: '#210b26', deep: '#1a0820', line: '#803570', lit: '#e574cc', text: '#f3b4e8', muted: '#b581b3',
             tile: '#2c1233', tileHi: '#3f1a48', gold: '#ffd2a0', body: '#5b4a5e', bodyLit: '#7a6480', white: '#ffffff', green: '#8fe08a'};
  const STORAGE = 'wardrobe.v1';

  /* Text. PixelKit's 5x7 with accents when the master scripts are loaded, a
     3x5 capitals fallback otherwise, so the panel never depends on them. */
  const G3 = {A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.', E: '###|#..|##.|#..|###', F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#', I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.', K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###', M: '#.#|###|###|#.#|#.#', N: '##.|#.#|#.#|#.#|#.#', O: '.#.|#.#|#.#|#.#|.#.', P: '##.|#.#|##.|#..|#..', Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.', T: '###|.#.|.#.|.#.|.#.', U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#.#|#.#|###|###|#.#', X: '#.#|#.#|.#.|#.#|#.#', Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###', 0: '###|#.#|#.#|#.#|###', 1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.', 4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|###|#.#|###', 7: '###|..#|.#.|.#.|.#.', 8: '###|#.#|###|#.#|###', 9: '###|#.#|###|..#|##.', '.': '.|.|.|.|#', '-': '...|...|###|...|...', ':': '.|#|.|#|.', '+': '...|.#.|###|.#.|...', '?': '###|..#|.##|...|.#.', '·': '.|.|#|.|.', '!': '#|#|#|.|#', '<': '..#|.#.|#..|.#.|..#', '>': '#..|.#.|..#|.#.|#..', '×': '...|#.#|.#.|#.#|...', '✓': '...|..#|#.#|.#.|...'};
  const strip = s => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function text3(ctx, str, x, y, color, align = 'left') {
    const glyphs = [...strip(str)].map(ch => ch === ' ' ? null : (G3[ch] || G3['?']).split('|'));
    const width = glyphs.reduce((w, g) => w + (g ? g[0].length + 1 : 3), 0) - 1;
    let cx = align === 'center' ? Math.round(x - width / 2) : align === 'right' ? x - width : x;
    ctx.fillStyle = color;
    for (const g of glyphs) {
      if (!g) { cx += 3; continue; }
      g.forEach((row, gy) => { for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') ctx.fillRect(cx + gx, y + gy, 1, 1); });
      cx += g[0].length + 1;
    }
    return width;
  }
  function measure(str, font) {
    if (scope.PixelKit) return scope.PixelKit.measure(str, font === 'small' ? '3x5' : '5x7');
    return [...strip(str)].reduce((w, ch) => w + (ch === ' ' ? 3 : (G3[ch] || G3['?']).indexOf('|') + 1), 0) - 1;
  }
  function label(ctx, str, x, y, {color = C.text, align = 'left', font = 'big'} = {}) {
    if (scope.PixelKit) return scope.PixelKit.drawText(ctx, str, x, y, {font: font === 'small' ? '3x5' : '5x7', color, align});
    return text3(ctx, str, x, y, color, align);
  }

  class WardrobePanel {
    constructor({asset, rig, onChange, Skeleton2D, CharacterMotion, CharacterPhysics}) {
      this.asset = asset; this.rig = rig; this.onChange = onChange;
      this.catalog = asset.wardrobe.catalog; this.byId = new Map(this.catalog.map(c => [c.id, c]));
      this.categories = asset.wardrobe.categories; this.presets = asset.wardrobe.presets;
      this.state = {items: {}, dyes: {}, tab: 'torso', facing: 1, walking: false, page: 0, presetPage: 0};
      this.load();
      // Her twin for the preview: same asset, own pose, own life.
      this.preview = new Skeleton2D(asset);
      this.previewMotion = new CharacterMotion(this.preview);
      this.previewBody = new CharacterPhysics();
      this.clock = 0; this.hits = []; this.icons = new Map(); this.hover = null; this.flash = 0; this.message = '';
      this.panel = document.querySelector('#wardrobePanel');
      this.canvas = document.querySelector('#wardrobeCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = W; this.canvas.height = H;
      this.buffer = document.createElement('canvas'); this.buffer.width = 64; this.buffer.height = 96;
      this.picker = document.querySelector('#wardrobeColor');
      this.toggleButton = document.querySelector('#wardrobeToggle');
      this.bind();
      this.apply();
    }
    // ------------------------------------------------------------ state
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
        if (saved && saved.items) { this.state.items = saved.items; this.state.dyes = saved.dyes || {}; this.state.tab = saved.tab || 'torso'; }
      } catch {}
      const fresh = !Object.keys(this.state.items).length;
      for (const c of this.categories) if (this.state.items[c.id] === undefined) this.state.items[c.id] = c.multi ? [] : null;
      if (!this.state.items.cabelo) this.state.items.cabelo = 'cabelo.original';
      // First visit: she starts dressed, in the drawn outfit.
      if (fresh) { const p = this.presets.find(p => p.id === 'original'); if (p) Object.assign(this.state.items, JSON.parse(JSON.stringify(p.items))); }
    }
    save() { try { localStorage.setItem(STORAGE, JSON.stringify({items: this.state.items, dyes: this.state.dyes, tab: this.state.tab})); } catch {} }
    get open() { return this.panel && !this.panel.hidden; }
    // What she is wearing, as the rig understands it, sent to the game.
    apply() {
      const {slots, tints} = scope.Wardrobe.resolve(this.asset, this.state);
      this.slots = slots; this.tints = tints;
      this.preview.restyle(tints);
      if (this.onChange) this.onChange(slots, tints, {silent: !!this.silent, clothing: this.clothing(), dressed: this.dressed});
      this.save();
    }
    wear(category, id) {
      const cat = this.categories.find(c => c.id === category);
      if (cat.multi) {
        const list = this.state.items[category] || [];
        this.state.items[category] = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
      } else this.state.items[category] = this.state.items[category] === id ? null : id;
      // A dress empties the legs; putting legs back takes the dress off.
      const item = id && this.byId.get(id);
      if (item && this.state.items[category] === id) for (const ex of item.excludes) this.state.items[ex] = this.categories.find(c => c.id === ex)?.multi ? [] : null;
      for (const c of this.categories) {
        const worn = this.state.items[c.id];
        for (const w of Array.isArray(worn) ? worn : worn ? [worn] : []) {
          const other = this.byId.get(w);
          if (other && other.excludes.includes(category) && this.state.items[category]) this.state.items[c.id] = c.multi ? [] : null;
        }
      }
      this.apply();
    }
    dye(key, hex) { if (hex) this.state.dyes[key] = hex; else delete this.state.dyes[key]; this.apply(); }
    preset(p) {
      for (const c of this.categories) this.state.items[c.id] = c.multi ? [] : null;
      this.state.items.cabelo = 'cabelo.original';
      Object.assign(this.state.items, JSON.parse(JSON.stringify(p.items)));
      this.state.dyes = {...(p.dyes || {})};
      this.apply();
    }
    random() {
      const pick = list => list[Math.floor(Math.random() * list.length)];
      for (const c of this.categories) {
        if (c.id === 'pele') continue;
        const items = this.catalog.filter(i => i.category === c.id);
        if (c.multi) this.state.items[c.id] = items.filter(() => Math.random() < .3).map(i => i.id);
        else this.state.items[c.id] = c.id === 'cabelo' || Math.random() < .8 ? pick(items).id : null;
      }
      if (this.state.items.torso && this.byId.get(this.state.items.torso).excludes.includes('pernas')) this.state.items.pernas = null;
      this.state.dyes = {};
      const colors = ['#b5473a', '#df9d42', '#3e8a6a', '#2f5aa8', '#8c3a5e', '#e8e4dc', '#4a4a5a', '#c98a3a', '#7fa6c9', '#a9b87a'];
      for (const c of this.categories) {
        const worn = this.state.items[c.id];
        for (const w of Array.isArray(worn) ? worn : worn ? [worn] : []) if (Math.random() < .5 && !this.byId.get(w).builtin) this.state.dyes[w] = pick(colors);
      }
      if (Math.random() < .5) this.state.dyes.hair = pick(this.asset.wardrobe.hairColors);
      this.state.dyes.skin = pick(this.asset.wardrobe.skins).hex;
      this.apply();
    }
    reset() {
      for (const c of this.categories) this.state.items[c.id] = c.multi ? [] : null;
      this.state.items.cabelo = 'cabelo.original'; this.state.dyes = {};
      this.apply();
    }
    /* A PESSOA inteira, e não só a roupa: cabelo, barba, corpo, pele e olhos
       vêm junto. É o que uma troca de personagem precisa carregar de um corpo
       para o outro — `clothing()` abaixo dá só a trouxa que caberia na bolsa,
       que é outra coisa. Sai e entra em cópia: dois personagens nunca podem
       acabar apontando para o mesmo guarda-roupa. */
    look() { return {items: JSON.parse(JSON.stringify(this.state.items)), dyes: {...this.state.dyes}}; }
    vestirLook(look, {silent = true} = {}) {
      if (!look || typeof look !== 'object') return;
      for (const c of this.categories) this.state.items[c.id] = c.multi ? [] : null;
      this.state.items.cabelo = 'cabelo.original';
      this.state.dyes = {};
      if (look.items) for (const c of this.categories)
        if (look.items[c.id] !== undefined) this.state.items[c.id] = JSON.parse(JSON.stringify(look.items[c.id]));
      if (look.dyes) Object.assign(this.state.dyes, look.dyes);
      /* Calado de propósito: trocar de personagem não cria nem destrói a
         trouxa de roupa dentro da bolsa, que é da mesa. */
      this.silent = silent; this.apply(); this.silent = false;
    }
    /* The clothes as a bundle the bag can hold: only what can be taken off —
       hair, beard, build, skin and eyes stay with the person. */
    static get CLOTHING() { return ['cabeca', 'torso', 'casaco', 'pernas', 'pes', 'extras']; }
    clothing() {
      const items = {}, dyes = {};
      for (const cat of WardrobePanel.CLOTHING) items[cat] = JSON.parse(JSON.stringify(this.state.items[cat] ?? (cat === 'extras' ? [] : null)));
      for (const [key, hex] of Object.entries(this.state.dyes)) if (!['hair', 'skin', 'eyeLeft', 'eyeRight'].includes(key) && !/^(cabelo|barba|corpo)\./.test(key)) dyes[key] = hex;
      return {items, dyes};
    }
    get dressed() { return WardrobePanel.CLOTHING.some(cat => { const v = this.state.items[cat]; return Array.isArray(v) ? v.length > 0 : !!v; }); }
    // Put a bundle on (replacing whatever clothes were on) or take everything off.
    wearClothing(bundle, {silent = false} = {}) {
      this.stripClothing({silent: true});
      if (bundle?.items) for (const cat of WardrobePanel.CLOTHING) if (bundle.items[cat] !== undefined) this.state.items[cat] = JSON.parse(JSON.stringify(bundle.items[cat]));
      if (bundle?.dyes) Object.assign(this.state.dyes, bundle.dyes);
      this.silent = silent; this.apply(); this.silent = false;
    }
    stripClothing({silent = false} = {}) {
      for (const cat of WardrobePanel.CLOTHING) this.state.items[cat] = cat === 'extras' ? [] : null;
      for (const key of Object.keys(this.state.dyes)) if (!['hair', 'skin', 'eyeLeft', 'eyeRight'].includes(key) && !/^(cabelo|barba|corpo)\./.test(key)) delete this.state.dyes[key];
      this.silent = silent; this.apply(); this.silent = false;
    }
    // The item a category's colour row dyes, and the key it dyes under.
    dyeTarget(category) {
      if (category === 'pele') return {key: 'skin', label: 'Pele', colors: this.asset.wardrobe.skins.map(s => s.hex), current: this.state.dyes.skin || '#cf8e82'};
      if (category === 'cabelo') return {key: 'hair', label: 'Cabelo', colors: this.asset.wardrobe.hairColors, current: this.state.dyes.hair || '#66296c'};
      const worn = this.state.items[category];
      const id = Array.isArray(worn) ? this.hover && worn.includes(this.hover) ? this.hover : worn[worn.length - 1] : worn;
      if (!id) return null;
      const item = this.byId.get(id);
      const colors = ['#e8e4dc', '#2b2b33', '#b5473a', '#df9d42', '#3e8a6a', '#2f5aa8', '#8c3a5e', '#6b4a34', '#c8c3cf', '#7fa6c9'];
      return {key: id, label: item.label, colors, current: this.state.dyes[id] || item.base};
    }
    // ------------------------------------------------------------ icons
    /* A tile is the garment's own pixels over a muted silhouette of her, cut
       from a rest-pose render: whatever the garment changes is kept as is,
       whatever is left of the body is greyed. */
    icon(item) {
      if (this.icons.has(item.id)) return this.icons.get(item.id);
      const rig = this.preview;
      const pose = {...rig.pose}, offset = [...rig.rootOffset], drift = new Map(rig.drift), sway = new Map([...rig.sway].map(([k, v]) => [k, Float64Array.from(v)]));
      rig.setAnimation('rest', 0);
      for (const key of rig.drift.keys()) rig.drift.set(key, [0, 0]);
      for (const curve of rig.sway.values()) curve.fill(0);
      rig.repin();
      const bare = rig.rasterize({}), dressed = rig.rasterize({outfit: item.slot ? new Set([item.slot]) : new Set()});
      rig.pose = pose; rig.rootOffset = offset; rig.drift = drift; rig.sway = sway; rig.resolve();
      const out = new Uint8ClampedArray(64 * 96 * 4);
      const cx = new Set();
      let l = 64, t = 96, r = -1, b = -1;
      for (let i = 0; i < 64 * 96; i++) {
        const p = i * 4, same = bare[p] === dressed[p] && bare[p + 1] === dressed[p + 1] && bare[p + 2] === dressed[p + 2] && bare[p + 3] === dressed[p + 3];
        if (dressed[p + 3] && !same) {
          out.set(dressed.subarray(p, p + 4), p);
          const x = i % 64, y = (i - x) / 64; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
        } else if (bare[p + 3]) { out[p] = 0x5b; out[p + 1] = 0x4a; out[p + 2] = 0x5e; out[p + 3] = 255; }
      }
      const icon = {pixels: out, bounds: r < 0 ? [24, 30, 40, 60] : [l, t, r, b]};
      this.icons.set(item.id, icon);
      return icon;
    }
    // ------------------------------------------------------------- draw
    frame(ctx, x, y, w, h, {fill = C.panel, line = C.line, lit = null} = {}) {
      ctx.fillStyle = line; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      if (lit) { ctx.fillStyle = lit; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2); }
      // Notched corners, like the HUD's frames.
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + w - 1, y, 1, 1); ctx.fillRect(x, y + h - 1, 1, 1); ctx.fillRect(x + w - 1, y + h - 1, 1, 1);
    }
    button(ctx, x, y, w, str, action, {active = false, small = true} = {}) {
      const hot = this.hover === action;
      const h = small ? 10 : 10;
      this.frame(ctx, x, y, w, h, {fill: active ? C.tileHi : hot ? C.tile : C.deep, line: active ? C.lit : hot ? C.lit : C.line});
      label(ctx, str, x + Math.floor(w / 2), y + (small ? 3 : 2), {color: active ? C.gold : C.text, align: 'center', font: small ? 'small' : 'big'});
      this.hits.push({x, y, w, h, action});
    }
    render(dt) {
      if (!this.open) return;
      const ctx = this.ctx, s = this.state;
      this.hits = [];
      this.clock += dt; this.flash = Math.max(0, this.flash - dt);
      // Background and title bar.
      ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
      this.frame(ctx, 0, 0, W, H, {fill: C.panel, line: C.line, lit: '#a44590'});
      ctx.fillStyle = C.deep; ctx.fillRect(1, 1, W - 2, 11);
      ctx.fillStyle = C.line; ctx.fillRect(1, 12, W - 2, 1);
      label(ctx, 'GUARDA-ROUPA', 6, 3, {color: C.gold});
      label(ctx, 'G ABRE · ESC FECHA', W - 32, 4, {color: C.muted, align: 'right', font: 'small'});
      this.button(ctx, W - 14, 2, 11, 'X', 'close');

      // ---- the preview, alive.
      const px = 6, py = 17, pw = 80, ph = 150;
      this.frame(ctx, px, py, pw, ph, {fill: '#17061b'});
      // Floor line.
      ctx.fillStyle = '#3a1440'; ctx.fillRect(px + 2, py + ph - 8, pw - 4, 1);
      const body = this.previewBody;
      body.vx = s.walking ? 72 * s.facing : 0; body.facing = s.facing; body.grounded = true; body.y = 0;
      const mode = s.walking ? 'walk' : 'idle';
      this.previewMotion.update(dt, mode, this.clock, body, s.facing);
      const pixels = this.preview.rasterize({facing: s.facing, outfit: this.slots});
      this.buffer.getContext('2d').putImageData(new ImageData(pixels, 64, 96), 0, 0);
      ctx.drawImage(this.buffer, px + 8, py + ph - 8 - 76 - 1 + 1 - 10);
      this.button(ctx, px + 2, py + ph + 3, 26, 'VIRAR', 'flip');
      this.button(ctx, px + 29, py + ph + 3, 26, 'ANDAR', 'walk', {active: s.walking});
      this.button(ctx, px + 56, py + ph + 3, 22, 'SORTE', 'random');
      this.button(ctx, px + 2, py + ph + 15, 38, 'LIMPAR', 'reset');
      this.button(ctx, px + 42, py + ph + 15, 36, 'SALVO', 'noop', {active: this.flash > 0});

      // ---- category tabs, on two rows.
      let tx = 92, ty = 16;
      for (const c of this.categories) {
        const w = measure(c.label, 'small') + 4;
        if (tx + w > W - 6) { tx = 92; ty += 11; }
        this.button(ctx, tx, ty, w, c.label, 'tab:' + c.id, {active: s.tab === c.id});
        tx += w + 1;
      }
      // ---- items of the open category, as tiles, three rows a page.
      const cat = this.categories.find(c => c.id === s.tab);
      const gx = 92, gy = 40, tw = 32, th = 42, cols = 6, perPage = cols * 3;
      const tiles = [];
      if (cat.id === 'pele') {
        for (const skin of this.asset.wardrobe.skins) tiles.push({kind: 'skin', id: skin.hex, label: skin.label, color: skin.hex});
      } else {
        if (!cat.multi && cat.id !== 'cabelo') tiles.push({kind: 'none', id: null, label: 'Nada'});
        for (const item of this.catalog.filter(i => i.category === cat.id)) tiles.push({kind: 'item', id: item.id, label: item.label, item});
      }
      const worn = s.items[cat.id];
      const isWorn = id => cat.id === 'pele' ? (s.dyes.skin || '#cf8e82') === id : Array.isArray(worn) ? worn.includes(id) : worn === id;
      const pages = Math.max(1, Math.ceil(tiles.length / perPage));
      s.page = Math.min(s.page || 0, pages - 1);
      if (pages > 1) {
        this.button(ctx, W - 40, 27, 10, '<', 'page:-1');
        label(ctx, `${s.page + 1}/${pages}`, W - 23, 30, {color: C.muted, align: 'center', font: 'small'});
        this.button(ctx, W - 16, 27, 10, '>', 'page:1');
      }
      tiles.slice(s.page * perPage, s.page * perPage + perPage).forEach((tile, i) => {
        const x = gx + (i % cols) * (tw + 2), y = gy + Math.floor(i / cols) * (th + 2);
        const action = tile.kind === 'skin' ? 'skin:' + tile.id : 'wear:' + (tile.id || '');
        const on = isWorn(tile.id), hot = this.hover === action;
        this.frame(ctx, x, y, tw, th, {fill: on ? C.tileHi : hot ? '#33153a' : C.tile, line: on ? C.gold : hot ? C.lit : C.line});
        if (tile.kind === 'item') {
          const icon = this.icon(tile.item);
          const [l, t, r, b] = icon.bounds, cx = Math.round((l + r) / 2), cy = Math.round((t + b) / 2);
          // A window of the sheet centred on the garment, clamped to the sheet.
          let sx = Math.max(0, Math.min(64 - (tw - 4), cx - Math.floor((tw - 4) / 2)));
          let sy = Math.max(0, Math.min(96 - (th - 12), cy - Math.floor((th - 12) / 2)));
          const img = new ImageData(icon.pixels, 64, 96);
          this.buffer.getContext('2d').putImageData(img, 0, 0);
          ctx.drawImage(this.buffer, sx, sy, tw - 4, th - 12, x + 2, y + 2, tw - 4, th - 12);
        } else if (tile.kind === 'skin') {
          ctx.fillStyle = tile.color; ctx.fillRect(x + 4, y + 4, tw - 8, th - 16);
        } else {
          label(ctx, '—', x + tw / 2, y + 14, {color: C.muted, align: 'center'});
        }
        // Name under the tile, cut to fit.
        let name = tile.label; while (measure(name, 'small') > tw - 4 && name.length > 3) name = name.slice(0, -1);
        label(ctx, name, x + tw / 2, y + th - 8, {color: on ? C.gold : C.muted, align: 'center', font: 'small'});
        this.hits.push({x, y, w: tw, h: th, action, id: tile.id});
      });

      // ---- colours of what is worn in this category.
      const target = cat.id === 'pele' ? null : this.dyeTarget(cat.id);
      const cy2 = 176;
      if (cat.id === 'pele') {
        // Eyes, dyed one at a time.
        label(ctx, 'OLHOS', gx, cy2 + 1, {color: C.muted, font: 'small'});
        this.asset.wardrobe.eyeColors.forEach((hex, i) => {
          const x = gx + 30 + i * 12, on = (s.dyes.eyeLeft || '#4a5b88') === hex;
          this.frame(ctx, x, cy2 - 2, 10, 10, {fill: hex, line: on ? C.gold : C.line});
          this.hits.push({x, y: cy2 - 2, w: 10, h: 10, action: 'eyes:' + hex});
        });
        this.button(ctx, gx + 30 + this.asset.wardrobe.eyeColors.length * 12, cy2 - 2, 10, '+', 'pick:eyes', {small: false});
      } else if (target) {
        label(ctx, 'COR', gx, cy2 + 1, {color: C.muted, font: 'small'});
        target.colors.forEach((hex, i) => {
          const x = gx + 20 + i * 12, on = target.current.toLowerCase() === hex.toLowerCase();
          this.frame(ctx, x, cy2 - 2, 10, 10, {fill: hex, line: on ? C.gold : C.line});
          this.hits.push({x, y: cy2 - 2, w: 10, h: 10, action: 'dye:' + target.key + ':' + hex});
        });
        const plus = gx + 20 + target.colors.length * 12;
        this.button(ctx, plus, cy2 - 2, 10, '+', 'pick:' + target.key, {small: false});
        this.button(ctx, plus + 12, cy2 - 2, 34, 'ORIGINAL', 'dye:' + target.key + ':');
      } else {
        label(ctx, 'ESCOLHA UMA PEÇA PARA PINTAR', gx, cy2 + 1, {color: C.muted, font: 'small'});
      }

      // ---- ready-made outfits: the sets, then the characters from the reference sheets.
      ctx.fillStyle = C.line; ctx.fillRect(gx, 188, W - gx - 6, 1);
      const groups = [['CONJUNTOS', this.presets.filter(p => !p.group)], ['PERSONAGENS', this.presets.filter(p => p.group === 'personagens')]];
      const group = groups[s.presetPage % groups.length];
      label(ctx, group[0], gx, 192, {color: C.gold, font: 'small'});
      this.button(ctx, W - 40, 190, 34, groups[(s.presetPage + 1) % groups.length][0] === 'CONJUNTOS' ? 'CONJ.' : 'PERS.', 'presets:1');
      let bx = gx, by = 202;
      for (const p of group[1]) {
        const w = measure(p.label, 'small') + 6;
        if (bx + w > W - 6) { bx = gx; by += 12; }
        if (by > H - 18) break;
        this.button(ctx, bx, by, w, p.label, 'preset:' + p.id);
        bx += w + 2;
      }
      // Status line.
      const count = this.slots.size;
      label(ctx, this.message || `${count} ${count === 1 ? 'peça vestida' : 'peças vestidas'}`, W - 6, H - 8, {color: C.muted, align: 'right', font: 'small'});
    }
    // -------------------------------------------------------------- input
    point(event) {
      const box = this.canvas.getBoundingClientRect();
      return [(event.clientX - box.left) / box.width * W, (event.clientY - box.top) / box.height * H];
    }
    at(event) {
      const [x, y] = this.point(event);
      for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h; }
      return null;
    }
    act(action, hit) {
      const [kind, ...rest] = action.split(':');
      const s = this.state;
      if (kind === 'close') this.close();
      else if (kind === 'flip') s.facing *= -1;
      else if (kind === 'walk') s.walking = !s.walking;
      else if (kind === 'random') this.random();
      else if (kind === 'reset') this.reset();
      else if (kind === 'tab') { s.tab = rest[0]; s.page = 0; this.save(); }
      else if (kind === 'page') { s.page = Math.max(0, (s.page || 0) + Number(rest[0])); }
      else if (kind === 'presets') { s.presetPage = (s.presetPage || 0) + 1; }
      else if (kind === 'wear') { if (rest[0]) this.wear(this.byId.get(rest[0]).category, rest[0]); else { s.items[s.tab] = null; this.apply(); } }
      else if (kind === 'skin') { s.dyes.skin = rest[0]; this.apply(); }
      else if (kind === 'eyes') { s.dyes.eyeLeft = s.dyes.eyeRight = rest[0]; this.apply(); }
      else if (kind === 'dye') { this.dye(rest[0], rest.slice(1).join(':')); }
      else if (kind === 'pick') {
        const key = rest[0];
        this.picker.value = key === 'eyes' ? (s.dyes.eyeLeft || '#4a5b88') : key === 'skin' ? (s.dyes.skin || '#cf8e82') : key === 'hair' ? (s.dyes.hair || '#66296c') : (s.dyes[key] || this.byId.get(key)?.base || '#888888');
        this.picker.onchange = this.picker.oninput = () => { if (key === 'eyes') { s.dyes.eyeLeft = s.dyes.eyeRight = this.picker.value; this.apply(); } else this.dye(key, this.picker.value); };
        this.picker.click();
      }
      else if (kind === 'preset') { const p = this.presets.find(p => p.id === rest[0]); if (p) this.preset(p); }
      this.flash = kind === 'wear' || kind === 'preset' || kind === 'dye' || kind === 'skin' || kind === 'eyes' ? 1.2 : this.flash;
    }
    bind() {
      if (!this.canvas) return;
      this.canvas.addEventListener('pointermove', e => { const h = this.at(e); this.hover = h ? h.action : null; this.canvas.style.cursor = h ? 'pointer' : ''; });
      this.canvas.addEventListener('pointerleave', () => { this.hover = null; });
      this.canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; const h = this.at(e); if (h) { e.preventDefault(); this.act(h.action, h); } });
      this.toggleButton?.addEventListener('click', () => this.toggle());
      document.querySelector('#wardrobeClose')?.addEventListener('click', () => this.close());
      window.addEventListener('keydown', e => {
        if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
        if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); this.toggle(); }
        else if (e.key === 'Escape' && this.open) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      }, true);
    }
    toggle() { if (this.open) this.close(); else this.show(); }
    show() { if (!this.panel) return; this.panel.hidden = false; this.toggleButton?.setAttribute('aria-expanded', 'true'); this.clock = 0; }
    close() { if (!this.panel) return; this.panel.hidden = true; this.toggleButton?.setAttribute('aria-expanded', 'false'); }
    snapshot() { return {open: this.open, items: JSON.parse(JSON.stringify(this.state.items)), dyes: {...this.state.dyes}, slots: [...this.slots], tab: this.state.tab, walking: this.state.walking}; }
  }
  scope.WardrobePanel = WardrobePanel;
  if (typeof module !== 'undefined') module.exports = {WardrobePanel};
})(globalThis);
